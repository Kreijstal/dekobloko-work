from __future__ import annotations

import ast
from pathlib import Path
import random
import subprocess
import tempfile
import time
import unittest

from dekobloko_demo import LobbyDemo
from dekobloko_server.accounts import AccountStore
from dekobloko_server.game import GameSession
from dekobloko_server.lobby import CookedShape, GameOptions, HostedGame, Lobby, Piece
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
        self.messages: list[str] = []
        self.match_starts: list[tuple[int, int]] = []
        self.piece_events: list[tuple[int, int, int, int, int]] = []
        self.feedback_shapes: list[tuple[int, int]] = []
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

    def send_cooked_shape(self, player_slot: int, shape: CookedShape) -> None:
        self.feedback_shapes.append((player_slot, shape.shape_id))

    def send_full_state(self, player_slot: int, state_payload: bytes) -> None:
        self.full_states.append((player_slot, state_payload))

    def send_winner(self, result_code: int) -> None:
        self.winner_results.append(result_code)

    def send_game_over(self) -> None:
        self.game_over_count += 1


class MultiplayerGameplayProtocolTest(unittest.TestCase):
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
        self.assertTrue(set(range(16, 23)).issubset(seen))
        self.assertTrue(set(range(23, 30)).issubset(seen))
        self.assertTrue(all(16 <= cell <= 29 for cell in seen))

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
        self.assertEqual([(0, payload)], peer.action_streams)

        game.handle_controls(host, bytes([2, 0]))
        self.assertEqual([(0, payload)], peer.action_streams)

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
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=9, host=host)
        game.add_player(peer)

        game.start()

        self.assertEqual([(9, 0)], host.match_starts)
        self.assertEqual([(9, 1)], peer.match_starts)
        self.assertEqual([(0, 0, 0, 0, 0), (1, 1, 0, 0, 0)], host.piece_events)
        self.assertEqual([(0, 0, 0, 0, 0), (1, 1, 0, 0, 0)], peer.piece_events)
        self.assertEqual([], host.feedback_shapes)
        self.assertEqual([], peer.feedback_shapes)

    def test_authoritative_transition_requires_ack_and_uses_final_coordinates(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=10, host=host)
        game.add_player(peer)
        game.start()

        fast_batch = bytes([20]) + pack_5bit((FAST_DROP,) * 20)
        game.handle_controls(host, fast_batch)
        self.assertEqual([], peer.action_streams)
        self.assertEqual(2, len(host.piece_events))

        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)
        for _batch in range(6):
            game.handle_controls(host, fast_batch)
            if len(host.piece_events) > 2:
                break

        self.assertEqual(3, len(host.piece_events))
        transition = host.piece_events[-1]
        self.assertEqual((3, 17, 0), (transition[2], transition[3], transition[4]))
        self.assertEqual(1, game.awaiting_transition_ack[0])
        self.assertEqual(18, len(decode_control_batch(peer.action_streams[-1][1])))

        # A repeated short landed batch cannot move the newly spawned piece.
        game.handle_controls(host, bytes([1]) + pack_5bit((FAST_DROP,)))
        self.assertEqual(3, len(host.piece_events))
        self.assertEqual(0, game.engine.players[0].active.y)

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
        self.assertEqual([0], host.winner_results)
        self.assertEqual([], peer.winner_results)
        self.assertEqual(1, host.game_over_count)
        self.assertEqual(1, peer.game_over_count)

    def test_feedback_targets_round_robin_and_settles_on_authoritative_boards(self) -> None:
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
        self.assertEqual(10, game.engine.players[1].board.get(3, 17))
        self.assertEqual(10, game.engine.players[2].board.get(3, 17))

    def test_feedback_overflow_finishes_match_for_last_survivor(self) -> None:
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

        self.assertTrue(game._dispatch_returned_shapes(0, lock))

        self.assertEqual("finished", game.state)
        self.assertIn(1, game.inactive_slots)
        self.assertEqual([(1, 0)], host.removals)
        self.assertEqual([(1, 0)], peer.removals)
        self.assertEqual([0], host.winner_results)
        self.assertEqual(1, host.game_over_count)
        self.assertEqual(1, peer.game_over_count)

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
        game.engine.players[0].board.set_solid(0, 17, 2, 99)
        game.engine.players[0].board.set(1, 17, 29)
        game.broadcast_authoritative_snapshot(0)
        self.assertEqual([0], [slot for slot, _payload in host.full_states])
        self.assertEqual([0], [slot for slot, _payload in peer.full_states])
        self._assert_original_decodes_snapshot(game, 0, host.full_states[0][1])
        game.send_all_authoritative_snapshots(peer)
        self.assertEqual([0, 0, 1], [slot for slot, _payload in peer.full_states])

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

    def test_spectator_observes_results_and_teardown_without_winner_ui(self) -> None:
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
        self.assertEqual([], spectator.winner_results)
        self.assertEqual(1, spectator.game_over_count)
        self.assertEqual("finished", game.state)

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

    def test_proactive_snapshot_fires_after_accepted_tick_interval(self) -> None:
        host = FakeSession("host")
        peer = FakeSession("peer")
        game = HostedGame(game_id=15, host=host)
        game.add_player(peer)
        game.start()
        game.handle_transition_ack(host, 0)
        game.handle_transition_ack(peer, 0)
        game.ticks_since_snapshot[0] = 499

        game.handle_controls(host, bytes([1]) + pack_5bit((0,)))

        self.assertEqual([0], [slot for slot, _payload in host.full_states])
        self.assertEqual([0], [slot for slot, _payload in peer.full_states])
        self.assertEqual(0, game.ticks_since_snapshot[0])
        self._assert_original_decodes_snapshot(game, 0, host.full_states[0][1])

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
