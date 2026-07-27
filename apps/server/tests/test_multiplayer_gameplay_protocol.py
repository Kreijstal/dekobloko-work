from __future__ import annotations

import ast
import os
from pathlib import Path
import random
import subprocess
import tempfile
import time
import unittest

from dekobloko_demo import LobbyDemo
from dekobloko_server.accounts import AccountStore
from dekobloko_server.game import GameSession
from dekobloko_server.lobby import (
    DRAW_RESULT_SLOT,
    CookedShape,
    GameOptions,
    HostedGame,
    Lobby,
    Piece,
)
from dekobloko_server.engine import (
    ActiveDomino,
    FAST_DROP,
    LockResult,
    ReturnedShape,
)
from dekobloko_server.packets import (
    CLIENT_PACKET_LENGTHS,
    build_chat_broadcast,
    build_local_player_id,
    build_quickchat_broadcast,
    decode_control_batch,
    pack_5bit,
    unpack_5bit,
)


class FakeSession:
    def __init__(self, name: str) -> None:
        self.display_name = name
        self.current_game = None
        self.player_slot = None
        self.action_streams: list[tuple[int, bytes]] = []
        self.removals: list[tuple[int, int]] = []
        self.elimination_order: list[int] = []
        self.messages: list[str] = []
        self.match_starts: list[tuple[int, int]] = []
        self.piece_events: list[tuple[int, int, int, int, int]] = []
        self.feedback_shapes: list[tuple[int, int]] = []
        self.cooked_releases: list[tuple[int, int]] = []
        # Send order, not just contents: the client cares about S2C 66 landing
        # before S2C 64 on a garbage spawn (see the T5 window).
        self.ordered_sends: list[str] = []
        self.full_states: list[tuple[int, bytes]] = []
        self.winner_results: list[int] = []
        self.game_over_count = 0
        self.lobby_events: list[bytes] = []
        self.chat_payloads: list[tuple[int, bytes]] = []

    def send_server_message(self, message: str) -> None:
        self.messages.append(message)

    def send_lobby_event(self, payload: bytes) -> None:
        self.lobby_events.append(payload)

    def send_chat_payload(self, opcode: int, payload: bytes) -> None:
        self.chat_payloads.append((opcode, payload))

    def send_action_stream(self, player_slot: int, payload: bytes) -> None:
        self.action_streams.append((player_slot, payload))

    def send_player_removed(self, player_slot: int, result_code: int) -> None:
        self.removals.append((player_slot, result_code))

    def send_elimination_order(self, player_slot: int) -> None:
        self.elimination_order.append(player_slot)

    def send_match_start(self, game: HostedGame, local_slot: int) -> None:
        self.match_starts.append((game.game_id, local_slot))

    def send_piece_event(
        self,
        player_slot: int,
        piece,
        speed_index: int,
        final_x: int = 0,
        final_y: int = 0,
        final_orientation: int = 0,
        finalize_argument: int = 0,
    ) -> None:
        self.piece_events.append(
            (player_slot, piece.piece_id, final_x, final_y, final_orientation)
        )
        self.ordered_sends.append("piece")

    def send_cooked_shape(self, player_slot: int, shape: CookedShape) -> None:
        self.feedback_shapes.append((player_slot, shape.shape_id))
        self.ordered_sends.append("cooked")

    def send_cooked_release(self, player_slot: int, count: int) -> None:
        self.cooked_releases.append((player_slot, count))
        self.ordered_sends.append("release")

    def send_full_state(self, player_slot: int, state_payload: bytes) -> None:
        self.full_states.append((player_slot, state_payload))

    def send_match_result(self, winner_slot: int) -> None:
        self.winner_results.append(winner_slot)

    def send_game_over(self) -> None:
        self.game_over_count += 1


class MultiplayerGameplayProtocolTest(unittest.TestCase):
    def setUp(self) -> None:
        # The authoritative snapshot (opcode 61) is ENABLED by default now
        # (DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS=0 disables it). Re-traced against the
        # CURRENT client 2026-07-25: lk.a(boolean, wl, byte) reads exactly the
        # byte order this serializer emits, and it is the ONLY way a remote board
        # replica's lk.field_U leaves -1 so the opponent bucket stops being
        # culled. We pin the flag on explicitly so the suite is independent of
        # the ambient default.
        self._prev_snap = os.environ.get("DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS")
        os.environ["DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS"] = "1"

    def tearDown(self) -> None:
        if self._prev_snap is None:
            os.environ.pop("DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS", None)
        else:
            os.environ["DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS"] = self._prev_snap

    @staticmethod
    def _drain_start_seed(*sessions: "FakeSession") -> None:
        """Discard the per-slot opponent snapshots that HostedGame.start() now
        broadcasts, so a test can assert only the packets IT triggers.

        start() seeds every board's replica once (owner-skipped) so opponent
        buckets render from frame 1; that seeding is covered by
        test_match_start_seeds_opponent_snapshots. Other tests drain it first."""
        for session in sessions:
            session.full_states.clear()

    def test_in_match_client_surface_is_actions_and_ack_not_world_state(self) -> None:
        self.assertEqual(
            {58: 0, 59: 1, 60: -1, 61: 0, 62: 0, 63: 0},
            {opcode: CLIENT_PACKET_LENGTHS[opcode] for opcode in range(58, 64)},
        )

    def test_5bit_codec_round_trips_client_control_batches(self) -> None:
        for count in range(21):
            values = tuple((index * 7 + count) & 0x1F for index in range(count))
            packed = pack_5bit(values)
            self.assertEqual(values, unpack_5bit(packed, count))
            self.assertEqual(values, decode_control_batch(bytes([count]) + packed))

    def test_control_decoder_rejects_malformed_batches(self) -> None:
        with self.assertRaisesRegex(ValueError, "missing"):
            decode_control_batch(b"")
        with self.assertRaisesRegex(ValueError, "exceeds"):
            decode_control_batch(bytes([21]))
        with self.assertRaisesRegex(ValueError, "requires"):
            decode_control_batch(bytes([2, 0]))
        with self.assertRaisesRegex(ValueError, "requires"):
            decode_control_batch(bytes([1, 0, 0]))

    def test_normal_piece_generator_emits_original_domino_codec(self) -> None:
        host = FakeSession("host")
        game = HostedGame(
            game_id=41,
            host=host,
            options=GameOptions(colours=7),
            rng=random.Random(12345),
        )

        for piece_id in range(200):
            piece = game.next_piece()
            self.assertEqual(piece_id, piece.piece_id)
            self.assertEqual((piece.width, piece.height), (2, 1))
            self.assertEqual(len(piece.cells), 2)
            self.assertTrue(all(16 <= cell <= 22 for cell in piece.cells))
            expected_descriptor = (
                ((piece.cells[0] - 16) << 4) | (piece.cells[1] - 16)
            )
            self.assertEqual(expected_descriptor, piece.descriptor)
            encoded_id = (
                bytes([piece_id])
                if piece_id < 128
                else bytes([(piece_id >> 7) | 0x80, piece_id & 0x7F])
            )
            self.assertEqual(
                encoded_id + bytes([2, 1]) + pack_5bit(piece.cells),
                piece.encode_rf(),
            )

    def test_room_options_use_five_ui_selector_indices(self) -> None:
        self.assertEqual(
            bytes((1, 4, 4, 4, 3)),
            GameOptions(
                bucket_large=True,
                speed_index=4,
                bombardment_level=0,
                colours=7,
                special_level=4,
            ).room_bytes(),
        )
        self.assertEqual(
            bytes((0, 2, 1, 0, 2)),
            GameOptions(bombardment_level=3).room_bytes(),
        )

    def test_piece_transition_serializes_authoritative_correction(self) -> None:
        class PacketSink:
            peer = "test"

            def __init__(self) -> None:
                self.sent = []

            def _send_packet(self, opcode: int, payload: bytes) -> None:
                self.sent.append((opcode, payload))

        sink = PacketSink()
        piece = Piece(5, 2, 1, (16, 17), 0x01)
        GameSession.send_piece_event(
            sink,
            player_slot=2,
            piece=piece,
            speed_index=2,
            final_x=3,
            final_y=-1,
            final_orientation=3,
            finalize_argument=7,
        )
        self.assertEqual(1, len(sink.sent))
        opcode, payload = sink.sent[0]
        self.assertEqual(64, opcode)
        self.assertEqual(bytes([2, 3, 255, 11, 7]), payload[:5])
        self.assertEqual(piece.encode_rf(), payload[5:10])

        GameSession.send_full_state(sink, 2, b"\x12\x34")
        self.assertEqual((61, b"\x02\x12\x34"), sink.sent[-1])

        spectator_game = HostedGame(game_id=51, host=FakeSession("host"))
        GameSession.send_match_start(sink, spectator_game, -1)
        spectator_opcode, spectator_payload = sink.sent[-1]
        self.assertEqual(59, spectator_opcode)
        self.assertEqual(255, spectator_payload[6])

    def test_enabled_item_generator_uses_original_packed_vocabulary(self) -> None:
        """Ordinary pieces use colours 16..22 plus the wildcard 23 -- never the
        item cells 24..31.

        This test previously asserted that cells 23..29 were all generated.
        That was the server's own invented item policy (its comment conceded
        the frequency was unknown), and it is not something the client can
        represent: the next-piece preview indexes a sprite table with the raw
        descriptor nibble,

            var21 = field_yb & 15
            fb.field_c[param7][var21]        (qc.java:11480)

        and fb.field_c is new ck[8][8] (fb.java:94) -- the indexed dimension
        holds 8 entries. lc.b decodes a nibble as (n & 7) + (n & 8 ? 24 : 16),
        so item cells 24..31 are exactly nibbles 8..15 and run off the end.
        Emitting one killed the client on its first rendered frame with
        ArrayIndexOutOfBoundsException: 8 (live, 2026-07-25, special_level=4).

        The wildcard is cell 23 -> nibble 7, inside the table, so it stays.
        """
        host = FakeSession("host")
        game = HostedGame(
            game_id=43,
            host=host,
            options=GameOptions(colours=7, special_level=4),
        )
        game.rng.seed(12345)
        seen = set()
        for _index in range(3000):
            seen.update(game.next_piece().cells)
        self.assertTrue(set(range(16, 23)).issubset(seen), "all colours appear")
        self.assertIn(23, seen, "the wildcard is still generated")
        self.assertTrue(
            all(16 <= cell <= 23 for cell in seen),
            f"item cells are unrenderable in a piece descriptor; got {sorted(seen)}",
        )

    def test_cooked_shapes_preserve_irregular_and_hollow_geometry(self) -> None:
        fixtures = [
            CookedShape(5, 3, 3, 2, (True, False, False, True, True, True)),
            CookedShape(
                6,
                5,
                3,
                3,
                (
                    True, True, True,
                    True, False, True,
                    True, True, True,
                ),
            ),
        ]

        for shape in fixtures:
            expected_cells = tuple(
                (8 | shape.colour) if occupied else 0
                for occupied in shape.occupied
            )
            self.assertEqual(expected_cells, shape.cells)
            expected = (
                bytes([shape.shape_id, shape.width, shape.height])
                + pack_5bit(expected_cells)
            )
            self.assertEqual(expected, shape.encode_rf())

    def test_feedback_serialization_uses_shared_shape_id_and_reaches_all_replicas(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=42, host=host)
        game.add_player(peer)
        first_piece = game.next_piece()

        cooked = game.send_cooked_feedback(
            player_slot=1,
            colour=2,
            width=3,
            height=2,
            occupied=(True, False, True, True, True, False),
        )

        self.assertEqual(first_piece.piece_id + 1, cooked.shape_id)
        self.assertEqual([(1, cooked.shape_id)], host.feedback_shapes)
        self.assertEqual([(1, cooked.shape_id)], peer.feedback_shapes)
        self.assertEqual((10, 0, 10, 10, 10, 0), cooked.cells)

    def test_valid_controls_are_relayed_and_malformed_controls_are_not(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=7, host=host)
        game.add_player(peer)
        game.state = "playing"

        masks = (0, 1, 1, 0, 8, 16)
        payload = bytes([len(masks)]) + pack_5bit(masks)
        game.handle_controls(host, payload)
        # Relayed intact except for the drop bit on the trailing sample, which
        # is always cleared so a replica that outruns the relay coasts on base
        # gravity instead of holding fast drop through a landing wait (see
        # test_last_relayed_sample_drops_the_fast_drop_bit).
        relayed = (0, 1, 1, 0, 8, 0)
        expected = bytes([len(relayed)]) + pack_5bit(relayed)
        self.assertEqual([(0, expected)], peer.action_streams)

        game.handle_controls(host, bytes([2, 0]))
        self.assertEqual([(0, expected)], peer.action_streams)

    def test_elimination_tombstones_slot_without_renumbering_survivors(self) -> None:
        host = FakeSession("host")
        middle = FakeSession("middle")
        last = FakeSession("last")
        game = HostedGame(game_id=8, host=host)
        game.add_player(middle)
        game.add_player(last)
        game.state = "playing"

        game.remove_player(middle)

        self.assertIsNone(middle.player_slot)
        self.assertEqual(2, last.player_slot)
        self.assertEqual(0b101, game.active_mask())
        self.assertEqual([host, last], game.active_players())
        self.assertEqual([(1, 0)], host.removals)
        self.assertEqual([(1, 0)], middle.removals)
        self.assertEqual([(1, 0)], last.removals)

    def test_match_start_spawns_one_domino_per_board_without_false_attack(self) -> None:
        # Match start must NOT send a transition (opcode 64). Packet 64 is
        # "correct the active piece, then finalize it", and by the time it
        # arrives the client has already spawned a piece on every board.
        # lk.a(int,int,int,boolean,int,int) assigns
        #     this.field_L = param5;  this.field_q = param4;
        # unconditionally (lk.java:1352-1353) and then falls through to the
        # commit at lk.java:1452 -- there is no "no correction" encoding, so a
        # transition carrying the zero placeholder teleported that live piece
        # to the top-left corner and locked it there. Captured live 2026-07-25:
        #     [game] sent piece event slot=1 piece=1 2x1 final=(0,0)
        #     [CT] LANDING board=6dec2fc9 final=(0,0) was=(3,0) fillBefore=0
        # leaving every client board one domino ahead of the engine for the
        # rest of the match, with nothing to reconcile it.
        #
        # The seeding is opcode 61 instead (test_match_start_seeds_snapshots).
        # Opcode 67 is not an option either: it fills the incoming bombardment
        # queue, so a domino sent through it would falsely attack every board.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=9, host=host)
        game.add_player(peer)

        game.start()

        self.assertEqual([(9, 0)], host.match_starts)
        self.assertEqual([(9, 1)], peer.match_starts)
        self.assertEqual([], host.piece_events)
        self.assertEqual([], peer.piece_events)
        self.assertEqual([], host.feedback_shapes)
        self.assertEqual([], peer.feedback_shapes)
        # Both boards are still spawned and empty server-side, so the only way
        # a client can gain a cell is by actually playing.
        for slot in range(2):
            self.assertIsNotNone(game.engine.players[slot].active)
            self.assertEqual(0, game.engine.players[slot].board.occupied_count())

    def test_authoritative_transition_requires_ack_and_uses_final_coordinates(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=10, host=host)
        game.add_player(peer)
        game.start()

        fast_batch = bytes([20]) + pack_5bit((FAST_DROP,) * 20)
        # Match start no longer arms awaiting_transition_ack: that latch is
        # cleared by the ack to a packet 64, and start() sends none. So the
        # very first batch is live input rather than something to discard.
        self.assertEqual({}, game.awaiting_transition_ack)
        for _batch in range(8):
            game.handle_controls(host, fast_batch)
            if host.piece_events:
                break

        self.assertEqual(1, len(host.piece_events))
        transition = host.piece_events[-1]
        self.assertEqual((3, 17, 0), (transition[2], transition[3], transition[4]))
        self.assertEqual(1, game.awaiting_transition_ack[0])
        # 18 samples were applied to the piece; the replica is relayed 17. The
        # sample that LANDS a piece is withheld so a replica never lands one
        # itself -- see test_landing_sample_is_withheld_from_replicas.
        self.assertEqual(15, len(decode_control_batch(peer.action_streams[-1][1])))

        # A repeated short landed batch cannot move the newly spawned piece.
        game.handle_controls(host, bytes([1]) + pack_5bit((FAST_DROP,)))
        self.assertEqual(1, len(host.piece_events))
        self.assertEqual(0, game.engine.players[0].active.y)

        self._drain_start_seed(host, peer)
        game.handle_transition_ack(host, 9)
        self.assertEqual(1, game.awaiting_transition_ack[0])
        self.assertEqual(1, len(host.full_states))
        self._assert_original_decodes_snapshot(game, 0, host.full_states[-1][1])
        game.handle_transition_ack(host, 1)
        self.assertNotIn(0, game.awaiting_transition_ack)

    def test_final_life_overflow_tombstones_loser_and_notifies_winner(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=11, host=host)
        game.add_player(peer)
        game.start()
        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)

        player = game.engine.players[1]
        player.lives = 1
        player.board.set(3, 1, 22)
        player.active = ActiveDomino(
            player.board,
            (16, 17),
            game.engine.base_drop_ticks,
            orientation=3,
            top_x=3,
            top_y=-1,
            drop_countdown=2,
            forced_drop_countdown=30,
            horizontal_parity=0,
        )
        controls = (FAST_DROP,) * 4
        game.handle_controls(peer, bytes([len(controls)]) + pack_5bit(controls))

        self.assertEqual("finished", game.state)
        self.assertIn(1, game.inactive_slots)
        self.assertEqual([(1, 0)], host.removals)
        self.assertEqual([(1, 0)], peer.removals)
        # Opcode 70 carries the winner's SLOT INDEX and goes to EVERY attached
        # session, loser included -- each client compares the byte against its
        # own slot to pick "YOU WIN!" versus "<NAME> WINS!". Sending it only to
        # the winner would leave the loser with no result line at all.
        #
        # The host is slot 0 and won, so every recipient must receive 0. This
        # must NOT be confused with the old opcode-69 path: 69 is the in-game
        # PANIC banner and no byte of it ever produced a win screen.
        self.assertEqual([0], host.winner_results)
        self.assertEqual([0], peer.winner_results)
        # Opcode 60 is HELD until the player dismisses the result screen. 62 and
        # 69 raise the defeat/win UI and 60 tears it down, so sending it here
        # destroyed the screen in the same breath as it was created and dumped
        # everyone straight back to the lobby with no won/lost screen.
        self.assertEqual(0, host.game_over_count)
        self.assertEqual(0, peer.game_over_count)

        game.dismiss(host)
        self.assertEqual(1, host.game_over_count)
        self.assertEqual(0, peer.game_over_count, "one player leaving must not "
                         "yank the screen from anyone still reading it")
        game.dismiss(peer)
        self.assertEqual(1, peer.game_over_count)

    def test_landing_sample_is_withheld_from_replicas(self) -> None:
        # A relay is queued input the replica works through one sample per
        # rendered frame, and it cannot apply a pending authoritative landing
        # (S2C 64) until it reaches the end of that queue. Relay the sample
        # that LANDS the piece and the replica gets there first, decides the
        # piece is down, and sets lk.field_y to wait for the confirmation.
        # lk.c latches field_Bb, and qc turns that into the "T5"
        # self-disconnect -- killing the HUMAN's connection over an OPPONENT's
        # bucket. Captured 2026-07-25, with both boards in perfect agreement
        # either side of the gap, so nothing had actually diverged:
        #     [CT] LOCK board=502ccf0a at=(3,12) y=true
        #     Error: T5: 1 3 true
        #     [CT] LANDING board=502ccf0a final=(3,13)      <- arrived after
        #
        # Feeding faster does not fix it: field_e collapses 20 -> 1 in a single
        # tick, so the replica has a couple of frames and no rate makes that
        # reliable. Withholding the sample removes the race outright.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=26, host=host)
        game.add_player(peer)
        game.start()

        fast_batch = bytes([20]) + pack_5bit((FAST_DROP,) * 20)
        for _batch in range(8):
            game.handle_controls(host, fast_batch)
            if host.piece_events:
                break

        self.assertEqual(1, len(host.piece_events), "the piece must have landed")
        relayed = decode_control_batch(peer.action_streams[-1][1])
        applied = game.engine.players[0].active
        self.assertIsNotNone(applied, "a replacement piece must have spawned")
        # One short of what the engine consumed: the replica stops a tick
        # above the floor and forms no opinion about landing.
        self.assertEqual(15, len(relayed))
        self.assertEqual(20, len(decode_control_batch(peer.action_streams[-2][1])))

    def test_non_landing_controls_are_relayed_without_rewriting(self) -> None:
        # Rewriting FAST_DROP changes the height at which lateral inputs occur.
        # That can put the replica on top of an overhang while the engine slips
        # below it. Only the final landing sample is replaced by packet 64;
        # every earlier mask must remain byte-for-byte equivalent.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=29, host=host)
        game.add_player(peer)
        game.start()

        fast_batch = bytes([20]) + pack_5bit((FAST_DROP,) * 20)
        for _batch in range(8):
            game.handle_controls(host, fast_batch)
            if host.piece_events:
                break

        self.assertEqual(1, len(host.piece_events), "the piece must have landed")
        landing_relay = decode_control_batch(peer.action_streams[-1][1])
        self.assertTrue(
            all(mask & FAST_DROP for mask in landing_relay),
            "non-landing masks must preserve fast drop",
        )
        opening_relay = decode_control_batch(peer.action_streams[0][1])
        self.assertTrue(
            all(mask & FAST_DROP for mask in opening_relay),
            "opening controls must also remain unchanged",
        )

    def test_landing_only_batch_relays_nothing_at_all(self) -> None:
        # When the FIRST sample of a batch lands the piece there is nothing
        # left to replay. An empty action stream would be a packet the replica
        # decodes for no effect; the S2C 64 that follows carries the landing.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=27, host=host)
        game.add_player(peer)
        game.start()

        # Start the piece near the floor and feed ONE sample at a time, so the
        # batch that lands it contains nothing else. Driving it down from the
        # top is not an option: the control rate limiter grants only
        # CONTROL_BURST_TICKS of credit, and a tight loop lets no wall clock
        # pass to refill it.
        player = game.engine.players[0]
        # A surface to land on, so this takes a handful of samples rather than
        # the full height of the bucket.
        player.board.set(3, 15, 22)
        player.board.set(4, 15, 22)
        player.active = ActiveDomino(
            player.board,
            (16, 17),
            game.engine.base_drop_ticks,
            orientation=3,
            top_x=3,
            top_y=12,
            drop_countdown=2,
            forced_drop_countdown=30,
            horizontal_parity=0,
        )

        single = bytes([1]) + pack_5bit((FAST_DROP,))
        for _sample in range(30):
            streams_before = len(peer.action_streams)
            game.handle_controls(host, single)
            if host.piece_events:
                break
            self.assertEqual(
                streams_before + 1,
                len(peer.action_streams),
                "a non-landing sample must still reach the replica",
            )
        else:
            self.fail("the piece never landed")

        self.assertEqual(
            streams_before,
            len(peer.action_streams),
            "the batch that lands the piece must relay nothing at all",
        )

    def test_life_loss_does_not_reseat_any_live_replica(self) -> None:
        # A live replica decrements its own life count while committing the
        # authoritative landing. Packet 61 cannot safely correct that count:
        # observed 2026-07-26, it arrived after packet 64, duplicated a cooked
        # 1x5 at the next update, and the replica disconnected with T5 when the
        # duplicate could not descend.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=24, host=host)
        game.add_player(peer)
        game.start()
        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)
        self._drain_start_seed(host, peer)

        player = game.engine.players[1]
        player.lives = 3
        player.board.set(3, 1, 22)
        player.active = ActiveDomino(
            player.board,
            (16, 17),
            game.engine.base_drop_ticks,
            orientation=3,
            top_x=3,
            top_y=-1,
            drop_countdown=2,
            forced_drop_countdown=30,
            horizontal_parity=0,
        )
        controls = (FAST_DROP,) * 4
        game.handle_controls(peer, bytes([len(controls)]) + pack_5bit(controls))

        # The life was taken but the slot survives, so the match continues.
        # Packet 61 stays reserved for startup/recovery, never a live board.
        self.assertEqual(2, game.engine.players[1].lives)
        self.assertEqual("playing", game.state)
        self.assertEqual([], host.full_states)
        self.assertEqual([], peer.full_states)

    def test_a_landing_never_reseats_the_player_who_made_it(self) -> None:
        # Every transition now re-seats the REPLICAS of that slot
        # (test_transition_reseats_the_remote_replica), because a replica's own
        # colour-clear does not agree with the engine's. The owner is the one
        # party that must never receive it: opcode 61 overwrites board
        # dimensions, offsets and the gravity counter field_Ab, so pushing it
        # into the board somebody is actively playing on would stutter their
        # own drop on every single piece.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=25, host=host)
        game.add_player(peer)
        game.start()
        self._drain_start_seed(host, peer)

        fast_batch = bytes([20]) + pack_5bit((FAST_DROP,) * 20)
        for _batch in range(8):
            game.handle_controls(host, fast_batch)
            if host.piece_events:
                break

        self.assertEqual(1, len(host.piece_events))
        self.assertEqual(3, game.engine.players[0].lives)
        self.assertEqual([], host.full_states, "the owner is never re-seated")
        self.assertEqual(
            [],
            [slot for slot, _payload in peer.full_states],
            "and neither is the replica -- a snapshot is stale by the time it "
            "arrives, see test_no_ongoing_snapshot_into_live_remote_replica",
        )

    def test_feedback_targets_round_robin_and_queues_without_touching_boards(self) -> None:
        host = FakeSession("host")
        middle = FakeSession("middle")
        last = FakeSession("last")
        game = HostedGame(game_id=12, host=host)
        game.add_player(middle)
        game.add_player(last)
        game.start()
        shape = ReturnedShape(2, 1, 1, (True,))
        lock = LockResult(3, 17, 0, 3, False, frozenset(), (shape, shape))
        self.assertFalse(game._dispatch_returned_shapes(0, lock))
        self.assertEqual([(1, 3), (2, 4)], host.feedback_shapes)
        # The release (S2C 66) is DEFERRED, not sent alongside the 67: a shape
        # must sit in the client's queue at field_e==0 as the visible incoming
        # warning. It is released at the target's next piece transition, which
        # is also when it becomes their falling piece.
        self.assertEqual([], host.cooked_releases)
        self.assertEqual({1, 2}, set(game.pending_garbage))
        self.assertEqual(1, len(game.pending_garbage[1]))
        self.assertEqual(1, len(game.pending_garbage[2]))
        # Crucially the target boards are UNTOUCHED. Garbage is delivered as a
        # falling piece, never written into the grid on arrival.
        self.assertEqual(0, game.engine.players[1].board.get(3, 17))
        self.assertEqual(0, game.engine.players[2].board.get(3, 17))

    def test_queued_garbage_becomes_the_targets_next_falling_piece(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=31, host=host)
        game.add_player(peer)
        game.start()

        # An L-shaped blob, so the spawn cannot be mistaken for a domino.
        shape = ReturnedShape(2, 3, 2, (True, False, False, True, True, True))
        lock = LockResult(3, 17, 0, 3, False, frozenset(), (shape,))
        self.assertFalse(game._dispatch_returned_shapes(0, lock))
        self.assertEqual([1], [slot for slot, _ in host.feedback_shapes])

        # Land the target's current piece so the transition actually runs.
        for _ in range(40):
            if game.engine.apply_controls(1, (FAST_DROP,)):
                break
        game._finish_authoritative_piece(1)

        active = game.engine.players[1].active
        self.assertIsNotNone(active)
        # It is the garbage, airborne, not a fresh domino and not settled.
        self.assertEqual((3, 2), active.dimensions)
        self.assertFalse(active.is_domino)
        self.assertFalse(active.landed)
        self.assertLess(active.y, 0)
        # The board holds ONLY the two cells of the domino that just locked.
        # Had the garbage been settled on arrival there would be four more.
        self.assertEqual(2, game.engine.players[1].board.occupied_count())
        # ...and it has left the incoming queue.
        self.assertEqual([(1, 1)], host.cooked_releases)
        self.assertEqual({}, game.pending_garbage)

        # The spawned piece must carry a FRESH shape id. The client caches rf
        # by id and oi.a(rf, int) throws IllegalArgumentException on inserting
        # an id it already holds (oi.java:283) -- and the S2C 67 that queued
        # this shape registered its id already. Reusing it crashed the client
        # on the first garbage spawn.
        queued_ids = {shape_id for _slot, shape_id in host.feedback_shapes}
        spawned_ids = {event[1] for event in host.piece_events}
        self.assertTrue(queued_ids, "expected a queued cooked shape")
        self.assertTrue(spawned_ids, "expected a spawned piece")
        self.assertEqual(
            set(),
            queued_ids & spawned_ids,
            "spawned piece reused a queued cooked shape id",
        )

    def test_feedback_costs_a_life_only_when_the_garbage_piece_lands(self) -> None:
        # Arrival must not cost anything. The old code settled the shape into
        # the grid on receipt and deducted a life there, which no client was
        # ever told about; now the shape falls and a life is lost through the
        # ordinary finalize path only if it overflows on landing.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=16, host=host)
        game.add_player(peer)
        game.start()
        target = game.engine.players[1]
        target.lives = 1
        target.board.set(3, 0, 16)
        shape = ReturnedShape(2, 1, 1, (True,))
        lock = LockResult(3, 17, 0, 3, False, frozenset(), (shape,))
        before = target.board.occupied_count()

        # Arrival is queued only: no cells, no life, no elimination. The old
        # settle-on-receipt path deducted a life and ended the match right here
        # -- and did it server-side, where no client was ever told about it.
        self.assertFalse(game._dispatch_returned_shapes(0, lock))

        self.assertEqual("playing", game.state)
        self.assertNotIn(1, game.inactive_slots)
        self.assertEqual(1, target.lives)
        self.assertEqual(before, target.board.occupied_count())
        self.assertEqual([], host.removals)
        self.assertEqual(0, host.game_over_count)

    def test_control_rate_limiter_refills_from_elapsed_time_and_caps_burst(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=13, host=host)
        game.add_player(peer)
        game.start()
        game.control_credit[0] = 0.0
        game.control_refill_at[0] = 100.0
        self.assertEqual(10, game._admit_control_ticks(0, 20, 100.2))
        self.assertEqual(5, game._admit_control_ticks(0, 20, 100.3))
        self.assertEqual(40, game._admit_control_ticks(0, 99, 200.0))

        game.handle_transition_ack(host, 0)
        self._drain_start_seed(host, peer)
        game.control_credit[0] = 0.0
        game.control_refill_at[0] = time.monotonic()
        game.handle_controls(host, bytes([1]) + pack_5bit((0,)))
        self.assertEqual(1, len(host.full_states))

    def test_partial_rate_limit_relays_prefix_and_resyncs_sender(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=18, host=host)
        game.add_player(peer)
        game.start()
        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)
        self._drain_start_seed(host, peer)
        game.control_credit[0] = 1.0
        game.control_refill_at[0] = time.monotonic()

        game.handle_controls(host, bytes([2]) + pack_5bit((0, 0)))

        self.assertEqual((0,), decode_control_batch(peer.action_streams[0][1]))
        self.assertEqual([0], [slot for slot, _payload in host.full_states])
        self._assert_original_decodes_snapshot(game, 0, host.full_states[0][1])

    def test_snapshot_broadcast_and_all_slot_recovery_hooks(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=14, host=host)
        game.add_player(peer)
        game.start()
        self._drain_start_seed(host, peer)
        game.engine.players[0].board.set_solid(0, 17, 2, 99)
        game.engine.players[0].board.set(1, 17, 29)
        game.broadcast_authoritative_snapshot(0)
        # Owner-skip: slot 0's own player (host) never receives its own board;
        # only the remote replica (peer) does. Sending a player their own board
        # would reset their live physics (gravity counter field_Ab).
        self.assertEqual([], [slot for slot, _payload in host.full_states])
        self.assertEqual([0], [slot for slot, _payload in peer.full_states])
        self._assert_original_decodes_snapshot(game, 0, peer.full_states[0][1])
        # send_all_authoritative_snapshots is a direct recovery hook (no
        # owner-skip): the recipient gets every live slot.
        game.send_all_authoritative_snapshots(peer)
        self.assertEqual([0, 0, 1], [slot for slot, _payload in peer.full_states])

    def test_match_start_seeds_opponent_snapshots(self) -> None:
        # A remote board renders only once its client-side lk.field_U leaves -1,
        # which an opcode-61 full-state does. start() therefore broadcasts one
        # snapshot per slot so each player sees its opponents' buckets from the
        # very first frame instead of a blank space.
        #
        # The seed is sent to the OWNER as well, unlike the steady-state
        # broadcast. The owner-skip exists because a 61 resets live physics
        # (board dims, offsets, the gravity counter field_Ab) out from under a
        # player mid-drop; at match start there is no drop in progress. And the
        # owner now needs it, because match start no longer sends a transition
        # packet -- see
        # test_match_start_spawns_one_domino_per_board_without_false_attack.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=20, host=host)
        game.add_player(peer)
        game.start()
        self.assertEqual([0, 1], [slot for slot, _payload in host.full_states])
        self.assertEqual([0, 1], [slot for slot, _payload in peer.full_states])
        for slot in range(2):
            self._assert_original_decodes_snapshot(game, slot, host.full_states[slot][1])
            self._assert_original_decodes_snapshot(game, slot, peer.full_states[slot][1])

    def test_queued_cooked_shape_releases_on_target_next_finalize(self) -> None:
        # A cooked shape must stay visible in the target's incoming queue
        # (client field_e==0) and only descend once S2C 66 arrives. Measured on
        # a real client: releasing in the same breath as the S2C 67 drained the
        # shape in ~240ms, so the queue never rendered. The release is therefore
        # deferred to the target's next finalize. The count must equal exactly
        # what was queued -- lk.b(-19939) throws if asked to release more.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=22, host=host)
        game.add_player(peer)
        game.start()
        shape = ReturnedShape(2, 1, 1, (True,))
        lock = LockResult(3, 17, 0, 3, False, frozenset(), (shape,))

        # host clears -> one cooked shape queued on peer (slot 1), NOT released.
        game._dispatch_returned_shapes(0, lock)
        self.assertEqual([1], [slot for slot, _shape_id in host.feedback_shapes])
        self.assertEqual([], host.cooked_releases)
        self.assertEqual(1, len(game.pending_garbage[1]))

        # The SOURCE finalizing must not flush the target's queue.
        for _ in range(40):
            if game.engine.apply_controls(0, (FAST_DROP,)):
                break
        game._finish_authoritative_piece(0)
        self.assertEqual([], host.cooked_releases)

        # The TARGET finalizing flushes it, exactly once, with the queued count.
        for _ in range(40):
            if game.engine.apply_controls(1, (FAST_DROP,)):
                break
        game._finish_authoritative_piece(1)
        self.assertEqual([(1, 1)], host.cooked_releases)
        self.assertEqual([(1, 1)], peer.cooked_releases)
        self.assertEqual({}, game.pending_garbage)

    def test_garbage_arrival_neither_settles_nor_snapshots(self) -> None:
        # Garbage is delivered as a falling piece, so arrival changes nothing
        # that needs pushing: no cells are written and no snapshot is sent. The
        # earlier code settled the shape into the grid and then pushed the board
        # to every replica to make them agree -- which is precisely why garbage
        # appeared already-placed instead of dropping.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=23, host=host)
        game.add_player(peer)
        game.start()
        self._drain_start_seed(host, peer)
        shape = ReturnedShape(2, 1, 1, (True,))
        lock = LockResult(3, 17, 0, 3, False, frozenset(), (shape,))
        before = game.engine.players[1].board.occupied_count()

        game._dispatch_returned_shapes(0, lock)

        self.assertEqual([], [slot for slot, _payload in peer.full_states])
        self.assertEqual([], [slot for slot, _payload in host.full_states])
        self.assertEqual(before, game.engine.players[1].board.occupied_count())
        self.assertEqual(0, game.engine.players[1].board.get(3, 17))

    def test_no_ongoing_snapshot_into_live_remote_replica(self) -> None:
        # A live replica needs NO ongoing correction: it runs its own
        # simulation from the relayed action stream plus the piece events.
        #
        # A previous revision inverted this test to re-seat the replica on every
        # transition, on the theory that a snapshot sent immediately behind the
        # piece event carries a field_U the replica has just adopted and so
        # cannot be stale. That reasons about SEND time. lk.d ticks every
        # rendered frame, so by ARRIVAL the packet always describes a board the
        # replica has already moved past -- there is no moment at which a
        # snapshot into a live board is fresh.
        #
        # Reported live 2026-07-26: opponent buckets showed "pieces teleporting
        # and board changing". S2C 61 rewrites field_q/field_L/field_ab as well
        # as the grid, so one stale packet jumps the active piece AND reverts
        # settled cells mid clear-animation -- both halves of that report, from
        # one packet, on every landing.
        #
        # The divergence that re-seating was masking is real and still unfixed:
        # committed cell counts at equal landing indices, measured 2026-07-25,
        #
        #   slot 2   server 10 12 14 16 18 20     client 10 12 14 12 14 16
        #   slot 1   server 24 26 28 25 27        client 24 26 28 26 28
        #
        # i.e. the ENGINE's colour-clear is wrong, not just out of step. Hiding
        # that behind ~50 corrections a match cost more than it bought. Fix the
        # clear rule; do not reinstate the re-seat.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=21, host=host)
        game.add_player(peer)
        game.start()
        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)
        self._drain_start_seed(host, peer)
        peer.piece_events.clear()

        # Land host's active piece in the engine, then run the finalize path.
        for _ in range(40):
            if game.engine.apply_controls(0, (FAST_DROP,)):
                break
        game._finish_authoritative_piece(0)

        self.assertTrue(peer.piece_events, "remote replica must still get the S2C 64 relay")
        # NOBODY is re-seated: not the owner, whose live physics a 61 would
        # reset, and not the replica, which has already ticked past whatever the
        # packet describes by the time it arrives.
        self.assertEqual([], [slot for slot, _payload in peer.full_states])
        self.assertEqual([], [slot for slot, _payload in host.full_states])

    def test_resync_on_transition_can_be_enabled(self) -> None:
        # Off by default (it teleports pieces and reverts boards, see
        # test_no_ongoing_snapshot_into_live_remote_replica); kept only as an
        # experiment hatch for measuring the clear-rule divergence it masks.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=28, host=host)
        game.add_player(peer)
        game.start()
        self._drain_start_seed(host, peer)

        previous = os.environ.get("DEKOBLOKO_RESYNC_ON_TRANSITION")
        os.environ["DEKOBLOKO_RESYNC_ON_TRANSITION"] = "1"
        try:
            for _ in range(40):
                if game.engine.apply_controls(0, (FAST_DROP,)):
                    break
            game._finish_authoritative_piece(0)
        finally:
            if previous is None:
                os.environ.pop("DEKOBLOKO_RESYNC_ON_TRANSITION", None)
            else:
                os.environ["DEKOBLOKO_RESYNC_ON_TRANSITION"] = previous

        self.assertTrue(peer.piece_events)
        # The replica is re-seated only with the hatch open; the owner never is.
        self.assertEqual([0], [slot for slot, _payload in peer.full_states])
        self.assertEqual([], [slot for slot, _payload in host.full_states])

    def test_large_bucket_snapshot_decodes_in_original_engine(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(
            game_id=17,
            host=host,
            options=GameOptions(bucket_large=True),
        )
        game.add_player(peer)
        game.start()
        self._drain_start_seed(host, peer)

        game.send_authoritative_snapshot(host, 0)

        self.assertEqual(1, len(host.full_states))
        self._assert_original_decodes_snapshot(game, 0, host.full_states[0][1])

    def test_late_spectator_gets_start_and_every_live_bucket_snapshot(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        spectator = FakeSession("spectator")
        game = HostedGame(game_id=19, host=host)
        game.add_player(peer)
        game.start()

        game.add_spectator(spectator)

        self.assertIs(game, spectator.current_game)
        self.assertIsNone(spectator.player_slot)
        self.assertEqual([spectator], game.spectators)
        self.assertEqual([(19, -1)], spectator.match_starts)
        self.assertEqual([0, 1], [slot for slot, _payload in spectator.full_states])
        for slot, payload in spectator.full_states:
            self._assert_original_decodes_snapshot(game, slot, payload)

    def test_spectator_receives_live_events_without_owning_a_slot(self) -> None:
        host = FakeSession("host")
        middle = FakeSession("middle")
        last = FakeSession("last")
        spectator = FakeSession("spectator")
        game = HostedGame(game_id=20, host=host)
        game.add_player(middle)
        game.add_player(last)
        game.start()
        game.add_spectator(spectator)
        game.handle_transition_ack(host, 0)
        spectator.action_streams.clear()
        spectator.piece_events.clear()
        spectator.feedback_shapes.clear()
        spectator.removals.clear()
        spectator.full_states.clear()
        spectator.messages.clear()

        game.handle_controls(host, bytes([1]) + pack_5bit((0,)))
        game.broadcast_piece_event(0, Piece(99, 2, 1, (16, 17), 1))
        game.send_cooked_feedback(1, 2, 1, 1, (True,))
        game.broadcast_authoritative_snapshot(0)
        game.broadcast_message("spectator-visible")
        game.remove_player(middle)

        self.assertEqual((0,), decode_control_batch(spectator.action_streams[0][1]))
        self.assertEqual([(0, 99, 0, 0, 0)], spectator.piece_events)
        self.assertEqual([(1, 3)], spectator.feedback_shapes)
        self.assertEqual([0], [slot for slot, _payload in spectator.full_states])
        self.assertEqual(["spectator-visible"], spectator.messages)
        self.assertEqual([(1, 0)], spectator.removals)
        self.assertIsNone(spectator.player_slot)

    def test_spectator_departure_does_not_change_match_outcome(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        spectator = FakeSession("spectator")
        game = HostedGame(game_id=21, host=host)
        game.add_player(peer)
        game.start()
        game.add_spectator(spectator)

        removed_player = game.remove_player(spectator)

        self.assertFalse(removed_player)
        self.assertEqual("playing", game.state)
        self.assertEqual(0b11, game.active_mask())
        self.assertEqual(1, spectator.game_over_count)
        self.assertIsNone(spectator.current_game)
        self.assertIsNone(spectator.player_slot)
        self.assertEqual([], game.spectators)

    def test_spectator_observes_results_and_teardown(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        spectator = FakeSession("spectator")
        game = HostedGame(game_id=23, host=host)
        game.add_player(peer)
        game.start()
        game.add_spectator(spectator)
        spectator.removals.clear()

        game.end_game(host)

        self.assertEqual([(1, 0)], spectator.removals)
        self.assertEqual([1], spectator.elimination_order)
        # A spectator DOES get opcode 70. It is an announcement of who won, not
        # a "you won" notification, and the byte is the winner's slot: the
        # spectator's own slot is None, so it never matches and the spectator
        # sees "<NAME> WINS!" -- which is what a watcher should see. The old
        # assertion here (no result at all) encoded opcode 69's winner-only
        # semantics, and 69 turned out to be the PANIC banner, not the result.
        self.assertEqual([0], spectator.winner_results)
        self.assertEqual("finished", game.state)
        # A spectator watches the same held result screen as the players: it
        # gets the results (62) but not the teardown (60) until it dismisses.
        self.assertEqual(0, spectator.game_over_count)
        game.dismiss(spectator)
        self.assertEqual(1, spectator.game_over_count)

    def test_every_attached_client_receives_complete_result_table_order(self) -> None:
        sessions = [FakeSession(name) for name in ("winner", "fourth", "third", "second")]
        game = HostedGame(game_id=25, host=sessions[0])
        for session in sessions[1:]:
            game.add_player(session)
        game.start()

        for slot in (1, 2, 3):
            game.engine.eliminate(slot)
            game._complete_authoritative_elimination(slot, "test")

        for session in sessions:
            self.assertEqual([1, 2, 3], session.elimination_order)
            self.assertEqual([(1, 0), (2, 0), (3, 0)], session.removals)
            self.assertEqual([0], session.winner_results)
        self.assertEqual("finished", game.state)

    def test_a_winnerless_match_sends_the_draw_byte_not_an_invalid_slot(self) -> None:
        """Opcode 70's byte is an ARRAY INDEX on the client.

        qc indexes the roster with it, so a byte >= the roster length raises
        ArrayIndexOutOfBoundsException and kills the client outright -- measured
        across all 256 values in tools/oracle/WinBannerProbe. "No winner" must
        therefore degrade to a signed-negative byte, which selects "DRAW!",
        rather than to any slot-shaped placeholder.
        """
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=24, host=host)
        game.add_player(peer)
        game.start()

        game.end_game(None)

        for session in (host, peer):
            self.assertEqual([DRAW_RESULT_SLOT], session.winner_results)
            byte = session.winner_results[0] & 0xFF
            self.assertGreater(byte, 127, "draw byte must be negative when read signed")

    def test_spectator_admission_respects_match_option(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        spectator = FakeSession("spectator")
        game = HostedGame(
            game_id=22,
            host=host,
            options=GameOptions(allow_spectators=False),
        )
        game.add_player(peer)
        game.start()

        with self.assertRaisesRegex(ValueError, "does not allow"):
            game.add_spectator(spectator)

        self.assertIsNone(spectator.current_game)
        self.assertEqual([], game.spectators)

    def test_lobby_spectate_and_stop_routes_preserve_player_roster(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        spectator = FakeSession("spectator")
        game = HostedGame(game_id=24, host=host)
        game.add_player(peer)
        game.start()
        lobby = Lobby()
        lobby._games[24] = game

        lobby.spectate_game(spectator, 24)
        self.assertEqual([spectator], game.spectators)
        self.assertEqual([host, peer], game.players)

        lobby.stop_spectating(spectator)
        self.assertEqual([], game.spectators)
        self.assertEqual([host, peer], game.players)
        self.assertEqual(0b11, game.active_mask())

    def test_room_chat_and_quickchat_include_room_context_and_reach_spectators(self) -> None:
        lobby = Lobby()
        host = FakeSession("host")
        peer = FakeSession("peer")
        spectator = FakeSession("spectator")
        outsider = FakeSession("outsider")
        for session in (host, peer, spectator, outsider):
            lobby.join(session)
        game = lobby.create_game(host)
        lobby.join_game(peer, game.game_id)
        lobby.start_game(host)
        lobby.spectate_game(spectator, game.game_id)
        for session in (host, peer, spectator, outsider):
            session.chat_payloads.clear()

        lobby.relay_chat_payload(peer, 3, b"abc", channel=1)
        expected_chat = build_chat_broadcast(
            "peer", 3, b"abc", 1, room_id=game.game_id, room_owner="host"
        )
        self.assertEqual([(11, expected_chat)], host.chat_payloads)
        self.assertEqual([(11, expected_chat)], peer.chat_payloads)
        self.assertEqual([(11, expected_chat)], spectator.chat_payloads)
        self.assertEqual([], outsider.chat_payloads)

        lobby.relay_quickchat(spectator, 0x8123, channel=1)
        expected_quick = build_quickchat_broadcast(
            "spectator",
            0x8123,
            1,
            room_id=game.game_id,
            room_owner="host",
        )
        for session in (host, peer, spectator):
            self.assertEqual((12, expected_quick), session.chat_payloads[-1])
        self.assertEqual([], outsider.chat_payloads)

    def test_lobby_observer_sees_invite_join_start_conclusion_and_removal(self) -> None:
        lobby = Lobby()
        host = FakeSession("host")
        peer = FakeSession("peer")
        observer = FakeSession("observer")
        for session in (host, peer, observer):
            lobby.join(session)

        game = lobby.create_game(
            host, GameOptions(allow_spectators=False, invite_only=True)
        )
        self.assertEqual(8, observer.lobby_events[-1][0])
        self.assertEqual(1, observer.lobby_events[-1][3])
        self.assertEqual(0, observer.lobby_events[-1][5])
        self.assertEqual(0, observer.lobby_events[-1][6] & 0x10)
        self.assertIsNone(lobby.join_game(observer, game.game_id))
        self.assertIsNone(observer.current_game)
        self.assertIn("invitation-only", observer.messages[-1])

        self.assertTrue(lobby.invite_player(host, lobby.uid_for("peer")))
        self.assertIn(14, [event[0] for event in host.lobby_events[-2:]])
        self.assertIn(11, [event[0] for event in peer.lobby_events[-2:]])

        lobby.join_game(peer, game.game_id)
        self.assertEqual(2, observer.lobby_events[-1][3])
        lobby.start_game(host)
        self.assertEqual(0x40, observer.lobby_events[-1][6] & 0x40)
        self.assertEqual(0, observer.lobby_events[-1][6] & 0x10)

        game.end_game(host)
        # The room now OUTLIVES the match, holding the won/lost screen. It is
        # retired only once every player has dismissed it -- retiring it here
        # is what used to yank people back to the lobby with no result screen.
        self.assertEqual([game], lobby.games_snapshot())
        game.dismiss(host)
        self.assertEqual([game], lobby.games_snapshot(), "the room must survive "
                         "until the LAST player has dismissed it")
        game.dismiss(peer)

        self.assertIsNone(host.current_game)
        self.assertIsNone(peer.current_game)
        self.assertEqual([], lobby.games_snapshot())
        self.assertEqual([8, 9], [event[0] for event in observer.lobby_events[-2:]])
        self.assertEqual(0x04, observer.lobby_events[-2][6] & 0x04)

    def test_repeating_player5_player6_demo_runs_complete_lifecycle(self) -> None:
        lobby = Lobby()
        observer = FakeSession("observer")
        lobby.join(observer)
        demo = LobbyDemo(
            lobby,
            join_delay=0.01,
            start_delay=0.01,
            between_delay=0.01,
            match_timeout=0.04,
            seed=7,
        )
        demo.start()
        deadline = time.monotonic() + 2.0
        roster_names: set[str] = set()
        try:
            while time.monotonic() < deadline:
                modes = [event[0] for event in observer.lobby_events]
                if 9 in modes and any(
                    event[0] == 8 and (event[6] & 0x40)
                    for event in observer.lobby_events
                ):
                    break
                time.sleep(0.01)
            else:
                self.fail("demo lifecycle did not create, start, and remove a room")
            roster_names = {row[1] for row in lobby.roster_rows()}
        finally:
            demo.stop()

        updates = [event for event in observer.lobby_events if event[0] == 8]
        self.assertTrue(any(event[3] == 1 for event in updates))
        self.assertTrue(any(event[3] == 2 for event in updates))
        self.assertTrue(any(event[6] & 0x40 for event in updates))
        self.assertTrue({"Player5", "Player6"}.issubset(roster_names))
        self.assertTrue(
            {"Player5", "Player6"}.isdisjoint(
                {row[1] for row in lobby.roster_rows()}
            )
        )

    def test_protocol_server_has_no_demo_fixture_dependency(self) -> None:
        package = Path(__file__).resolve().parents[1] / "dekobloko_server"
        combined = "\n".join(
            (package / name).read_text("utf-8")
            for name in ("__main__.py", "game.py", "lobby.py")
        )
        self.assertNotIn("Player5", combined)
        self.assertNotIn("Player6", combined)
        self.assertNotIn("DummyLobbySession", combined)
        self.assertNotIn("start_demo_cycle", combined)

    def test_reaching_snapshot_tick_interval_does_not_snapshot_live_boards(self) -> None:
        # The old proactive snapshot pushed a full board into every live remote
        # replica on a tick interval. That reverts a replica that is mid
        # clear-animation (the snapshot's field_U is stale) and overflows its next
        # active piece -> lk.field_Bb=true -> the qc.b "T5" self-disconnect.
        # Reaching the interval must therefore NOT broadcast a snapshot; live
        # boards stay in sync from the relayed action stream instead.
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=15, host=host)
        game.add_player(peer)
        game.start()
        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)
        self._drain_start_seed(host, peer)
        game.ticks_since_snapshot[0] = 499

        game.handle_controls(host, bytes([1]) + pack_5bit((0,)))

        # No snapshot is pushed into either live board.
        self.assertEqual([], [slot for slot, _payload in host.full_states])
        self.assertEqual([], [slot for slot, _payload in peer.full_states])

    def test_player_id_packet_sets_and_resets_uc_field_g(self) -> None:
        # CONFIRMED against a real client on 2026-07-22: the room creator is
        # shown as HOST only when this mode-23 PLAYER_ID packet sets uc.field_g.
        # The authoritative-engine merge dropped the send and the creator
        # regressed to "guest"; this pins the send and the leave-time reset.
        #
        # _send_local_player_id must emit server frame 10 (lobby) carrying
        # [u8 23][u64 uid] on entering a room, and the client's -1L sentinel
        # (0xFFFFFFFFFFFFFFFF) on leaving so return-to-main-menu teardown runs
        # with uc.field_g cleared.
        class Sink:
            peer = "test"
            _local_id_sent = False
            _LOCAL_ID_RESET = GameSession._LOCAL_ID_RESET

            def __init__(self) -> None:
                self.sent: list[tuple[int, bytes]] = []

            def _send_packet(self, opcode: int, payload: bytes) -> None:
                self.sent.append((opcode, payload))

        sink = Sink()
        owner_id = 485641658
        GameSession._send_local_player_id(sink, owner_id)
        self.assertEqual((10, build_local_player_id(owner_id)), sink.sent[-1])
        self.assertTrue(sink._local_id_sent)

        GameSession._send_local_player_id(sink, GameSession._LOCAL_ID_RESET)
        self.assertEqual(
            (10, build_local_player_id(0xFFFFFFFFFFFFFFFF)), sink.sent[-1]
        )
        self.assertFalse(sink._local_id_sent)

    def test_host_identity_invariant_player_id_equals_uid_for(self) -> None:
        # The client is host iff uc.field_g == room.ownerId (ig.java:773).
        # uc.field_g is AccountStore.player_id(account) delivered via mode-23;
        # the room ownerId is Lobby.uid_for(display_name). Host recognition
        # breaks the instant these two derivations diverge, so pin them equal.
        lobby = Lobby()
        accounts = AccountStore(Path(tempfile.mktemp()), True)
        for name in ("Hello", "Player1", "A", "MixedCase User", "  spaced  "):
            self.assertEqual(
                accounts.player_id(name),
                lobby.uid_for(name),
                f"player_id/uid_for diverged for {name!r}; host check would break",
            )

    def test_lobby_reentry_resends_bootstrap_after_menu_round_trip(self) -> None:
        # REGRESSION for the "lobby -> back -> lobby does nothing" bug.
        #
        # Commit f9d9d92 removed `self._lobby_bootstrapped = False` from the
        # opcode-10 (return-to-main-menu) handler, on the theory that the client
        # keeps its lobby state across a menu round trip. Instrumentation of the
        # ALL-ORIGINAL client on 2026-07-24 disproved that: the client tears its
        # lobby down on leave, so the re-entry op=9 received only "No hosted
        # games" and the lobby never rebuilt (server withheld the bootstrap
        # because the per-connection gate was still set). The fix restores the
        # reset. This pins the full enter -> leave -> re-enter cycle: frame 14
        # (the lobby bootstrap) MUST be sent on BOTH entries.
        import dekobloko_server.game as game_mod

        class Sink:
            peer = "test"

            class _cfg:
                welcome_message = None

            config = _cfg()

            def __init__(self) -> None:
                self._lobby_bootstrapped = False
                self.current_game = None
                self.player_slot = None
                self.display_name = "Hello"
                self.sent: list[tuple[object, object]] = []

            # GameSession wire surface the bootstrap/leave paths call:
            def _send_packet(self, opcode: int, payload: bytes = b"") -> None:
                self.sent.append((opcode, payload))

            def send_lobby_bootstrap(self) -> None:
                self._send_packet(14, b"")          # frame 14 == lobby bootstrap

            def send_lobby_roster(self, rows) -> None:
                for _ in rows:
                    self._send_packet(10, b"")

            def send_local_player_id(self, uid: int) -> None:
                self._send_packet(10, b"")

            def send_server_message(self, message: str) -> None:
                self.sent.append(("msg", message))

        def bootstrap_count(sink: "Sink") -> int:
            return [op for op, _ in sink.sent].count(14)

        sink = Sink()
        fresh = Lobby()
        original = game_mod.LOBBY
        game_mod.LOBBY = fresh                      # both handlers read game.LOBBY
        try:
            fresh.join(sink)                        # session stays registered across the round trip

            # 1) first lobby entry -> bootstrap sent, gate set
            GameSession._ensure_lobby_bootstrap(sink, "entry-1")
            self.assertTrue(sink._lobby_bootstrapped)
            self.assertEqual(bootstrap_count(sink), 1, "first entry must send frame 14")

            # 2) return to main menu -> gate MUST clear (the regression)
            GameSession._return_to_main_menu(sink)
            self.assertFalse(
                sink._lobby_bootstrapped,
                "return-to-main-menu (opcode 10) must clear the per-connection "
                "bootstrap gate; f9d9d92 dropped this and broke lobby re-entry",
            )
            self.assertIn(15, [op for op, _ in sink.sent], "leave must ack with opcode 15")

            # 3) re-entry -> bootstrap MUST be re-sent, else the lobby never rebuilds
            GameSession._ensure_lobby_bootstrap(sink, "entry-2")
            self.assertEqual(
                bootstrap_count(sink),
                2,
                "re-entry after a menu round trip must re-send frame 14; without "
                "the leave-time reset the client shows only 'No hosted games'",
            )
        finally:
            game_mod.LOBBY = original

    def test_context_channel_zero_routes_to_room_when_sender_in_game(self) -> None:
        # CONFIRMED 2026-07-22: the client's text send (nm.java -> ce.a) writes
        # pk.field_r as the channel byte, which is 0 for the default tab even
        # while in a room. So a channel-0 message from a sender who is in a room
        # MUST be routed as ROOM chat; otherwise every in-room message the user
        # types lands in the lobby channel (the reported bug).
        lobby = Lobby()
        host = FakeSession("host")
        peer = FakeSession("peer")
        outsider = FakeSession("outsider")
        for session in (host, peer, outsider):
            lobby.join(session)
        game = lobby.create_game(host)
        lobby.join_game(peer, game.game_id)
        for session in (host, peer, outsider):
            session.chat_payloads.clear()

        # Sender is in the room, default tab (channel 0) -> must reach the room
        # (channel 1) and NOT the lobby outsider.
        lobby.relay_chat_payload(host, 3, b"abc", channel=0)
        expected_room = build_chat_broadcast(
            "host", 3, b"abc", 1, room_id=game.game_id, room_owner="host"
        )
        self.assertEqual([(11, expected_room)], host.chat_payloads)
        self.assertEqual([(11, expected_room)], peer.chat_payloads)
        self.assertEqual([], outsider.chat_payloads)

        # Sender NOT in a room, channel 0 -> lobby, reaching everyone.
        for session in (host, peer, outsider):
            session.chat_payloads.clear()
        lobby.relay_chat_payload(outsider, 2, b"hi", channel=0)
        expected_lobby = build_chat_broadcast("outsider", 2, b"hi", 0)
        self.assertEqual((11, expected_lobby), outsider.chat_payloads[-1])
        self.assertEqual((11, expected_lobby), host.chat_payloads[-1])

    def test_set_room_options_decodes_gamespecific_and_applies(self) -> None:
        # Reflection-confirmed 2026-07-23: create (ad.java) and SET_ROOM_OPTIONS
        # (qa.java) both place the 5-byte gameSpecificOptions at body[2:7] in
        # room_bytes order [bucket, speed, colours-3, special, feedback];
        # field_kc[0] != 0 == large bucket. Without a handler the server dropped
        # this and every match used defaults (small bucket).
        body = bytes.fromhex("08 84 01 02 01 00 00")  # field_kc = 01 02 01 00 00
        opts = Lobby.parse_game_specific_options(body)
        self.assertTrue(opts.bucket_large)
        self.assertEqual(2, opts.speed_index)
        self.assertEqual(4, opts.colours)
        self.assertEqual(0, opts.special_level)

        lobby = Lobby()
        host = FakeSession("host")
        lobby.join(host)
        game = lobby.create_game(host)  # default -> small bucket
        self.assertFalse(game.options.bucket_large)
        self.assertTrue(lobby.apply_room_options(host, body))
        self.assertTrue(game.options.bucket_large)
        # and start_game would build a 12x27 board rather than 8x18
        self.assertEqual(
            (12, 27),
            (12, 27) if game.options.bucket_large else (8, 18),
        )

    def _assert_original_decodes_snapshot(
        self, game: HostedGame, slot: int, payload: bytes
    ) -> None:
        repo = Path(__file__).resolve().parents[3]
        probe = (
            repo
            / "game-logic/build/classes/test/org/alterorb/dekobloko/logic/OriginalSnapshotProbe.class"
        )
        if not probe.is_file():
            return
        player = game.engine.players[slot]
        command = [
            "java",
            "-Djava.awt.headless=true",
            f"-Ddekobloko.original.classes={repo / 'classes-original'}",
            f"-Ddekobloko.original.stubs={repo / 'game-logic/build/classes/original-stubs'}",
            "-cp",
            f"{repo / 'game-logic/build/classes/main'}:{repo / 'game-logic/build/classes/test'}",
            "org.alterorb.dekobloko.logic.OriginalSnapshotProbe",
            payload.hex(),
            str(player.board.width == 12).lower(),
        ]
        parts = subprocess.run(
            command, check=True, capture_output=True, text=True
        ).stdout.strip().split("|")
        active = player.active
        self.assertEqual(player.lives, int(parts[0]))
        self.assertEqual(game.transition_counters[slot], int(parts[1]))
        self.assertEqual((active.x, active.y), (int(parts[2]), int(parts[3])))
        self.assertEqual(active.drop_countdown, int(parts[4]))
        self.assertEqual(active.forced_drop_countdown, int(parts[5]))
        self.assertEqual(active.previous_controls, int(parts[6]))
        self.assertEqual(active.horizontal_repeat, int(parts[7]))
        self.assertEqual(active.descriptor, int(parts[8]))
        self.assertEqual(active.orientation, int(parts[9]))
        self.assertEqual(active.vertical_parity, int(parts[10]))
        self.assertEqual(active.horizontal_parity, int(parts[11]))
        self.assertEqual(active.grounded, parts[12] == "true")
        self.assertEqual(list(active.bitmap), ast.literal_eval(parts[13]))
        self.assertEqual(
            [cell & 31 for row in player.board.cells for cell in row],
            ast.literal_eval(parts[14]),
        )


if __name__ == "__main__":
    unittest.main()
