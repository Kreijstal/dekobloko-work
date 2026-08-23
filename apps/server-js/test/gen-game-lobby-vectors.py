#!/usr/bin/env python3
"""Golden-vector fixtures for src/lobby.js + src/game.js, produced by RUNNING
apps/server/dekobloko_server/{lobby,game}.py.

Usage:
    cd /home/kreijstal/git/dekobloko-work
    PYTHONPATH=apps/server python3 apps/server-js/test/gen-game-lobby-vectors.py

Writes test/fixtures/game_lobby.json. Bytes are hex-encoded.
"""
from __future__ import annotations

import json
import random
import struct
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "server"))

from dekobloko_server.accounts import AccountStore  # noqa: E402
from dekobloko_server.engine import AuthoritativeMatch, ActiveDomino  # noqa: E402
from dekobloko_server.lobby import (  # noqa: E402
    GameOptions,
    HostedGame,
    Lobby,
    Piece,
    CookedShape,
    QueuedPowerup,
)
from dekobloko_server.game import GameSession  # noqa: E402
from dekobloko_server.packets import (  # noqa: E402
    build_chat_broadcast,
    build_quickchat_broadcast,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"
NL = chr(10)


class FakeSession:
    def __init__(self, name):
        self.display_name = name
        self.current_game = None
        self.player_slot = None
        self.messages = []
        self.lobby_events = []

    def send_server_message(self, message):
        self.messages.append(message)

    def send_lobby_event(self, payload):
        self.lobby_events.append(bytes(payload))

    def send_match_start(self, game, local_slot):
        pass

    current_full_state = None

    def send_full_state(self, player_slot, state_payload):
        self.current_full_state = (player_slot, bytes(state_payload))

    def send_player_removed(self, player_slot, result_code):
        pass

    def send_elimination_order(self, player_slot):
        pass

    def send_match_result(self, winner_slot):
        pass

    def send_game_over(self):
        pass


class PacketSink:
    peer = "test"
    _local_id_sent = False
    _LOCAL_ID_RESET = GameSession._LOCAL_ID_RESET

    def __init__(self):
        self.sent = []

    def _send_packet(self, opcode, payload=b""):
        self.sent.append((opcode, bytes(payload)))


def h(b):
    return bytes(b).hex()


def dump(obj):
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / "game_lobby.json"
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + NL, encoding="utf-8")
    print("wrote " + str(path))


def main() -> None:
    fx = {}

    option_cases = [
        {},
        {"bucket_large": True, "speed_index": 4, "bombardment_level": 0,
         "colours": 7, "special_level": 4},
        {"bombardment_level": 3},
        {"rated": True, "invite_only": True, "allow_spectators": False},
        {"speed_index": 0, "colours": 1, "special_level": 9},
    ]
    fx["game_options"] = [
        {
            "inputs": case,
            "settings_word": GameOptions(**case).settings_word(),
            "room_bytes": h(GameOptions(**case).room_bytes()),
        }
        for case in option_cases
    ]

    piece = Piece(5, 2, 1, (16, 17), 0x01)
    cooked_a = CookedShape(5, 3, 3, 2, (True, False, False, True, True, True))
    cooked_b = CookedShape(
        6, 5, 3, 3,
        (True, True, True, True, False, True, True, True, True),
    )
    powerup = QueuedPowerup(9, 2, 2, (24, 25, 26, 27))
    powerup_default = QueuedPowerup(10, 1, 1, (24,))
    fx["encode_rf"] = {
        "piece_5": {"cells": list(piece.cells), "hex": h(piece.encode_rf())},
        "cooked_hollow": {
            "cells": list(cooked_a.cells), "hex": h(cooked_a.encode_rf())},
        "cooked_ring": {
            "cells": list(cooked_b.cells), "hex": h(cooked_b.encode_rf())},
        "powerup": {
            "cells": list(powerup.cells), "colour": powerup.colour,
            "occupied": [bool(o) for o in powerup.occupied],
            "hex": h(powerup.encode_rf())},
        "powerup_default_colour": {
            "colour": powerup_default.colour,
            "hex": h(powerup_default.encode_rf())},
    }

    def expect_error(fn):
        try:
            fn()
        except Exception as exc:
            return {"type": type(exc).__name__, "message": str(exc)}
        return None

    fx["encode_rf_errors"] = {
        "negative_id": expect_error(
            lambda: Piece(-1, 2, 1, (16, 17), 0).encode_rf()),
        "width_zero": expect_error(
            lambda: Piece(0, 0, 1, (), 0).encode_rf()),
        "height_overflow": expect_error(
            lambda: Piece(0, 2, 256, (0,) * 512, 0).encode_rf()),
        "cell_count_mismatch": expect_error(
            lambda: Piece(0, 2, 1, (16,), 0).encode_rf()),
        "cell_out_of_vocabulary": expect_error(
            lambda: Piece(0, 1, 1, (32,), 0).encode_rf()),
        "cooked_colour_7": expect_error(lambda: CookedShape(0, 7, 1, 1, (True,))),
        "cooked_empty": expect_error(
            lambda: CookedShape(0, 2, 2, 1, (False, False))),
        "cooked_dim_mismatch": expect_error(
            lambda: CookedShape(0, 2, 2, 2, (True, True, True))),
    }

    # HostedGame.__post_init__ reseeds rng from (game_id, created_at), so the
    # generator reseeds EXPLICITLY afterwards -- exactly like
    # test_enabled_item_generator_uses_original_packed_vocabulary does.
    game = HostedGame(
        game_id=41, host=FakeSession("host"),
        options=GameOptions(colours=7),
        rng=random.Random(12345),
    )
    game.rng.seed(12345)
    seq = []
    for piece_id in range(200):
        p = game.next_piece()
        seq.append({
            "piece_id": p.piece_id,
            "cells": list(p.cells),
            "descriptor": p.descriptor,
            "rf_hex": h(p.encode_rf()),
        })
    fx["piece_sequence_colours7_seed12345"] = seq

    game2 = HostedGame(
        game_id=43, host=FakeSession("host"),
        options=GameOptions(colours=7, special_level=4),
        rng=random.Random(12345),
    )
    game2.rng.seed(12345)
    head = []
    seen = set()
    for index in range(3000):
        p = game2.next_piece()
        seen.update(p.cells)
        if index < 60:
            head.append({"cells": list(p.cells), "descriptor": p.descriptor})
    fx["piece_sequence_special4_head60"] = head
    fx["piece_sequence_special4_coverage"] = sorted(seen)

    sink = PacketSink()
    piece64 = Piece(5, 2, 1, (16, 17), 0x01)
    GameSession.send_piece_event(
        sink, player_slot=2, piece=piece64, speed_index=2,
        final_x=3, final_y=-1, final_orientation=3, finalize_argument=7,
    )
    op64, pay64 = sink.sent[-1]
    fx["send_piece_event"] = {
        "opcode": op64,
        "payload_hex": h(pay64),
        "rf_hex": h(piece64.encode_rf()),
    }

    GameSession.send_full_state(sink, 2, b"\x124")
    fx["send_full_state"] = {
        "opcode": sink.sent[-1][0], "payload_hex": h(sink.sent[-1][1])}

    spectator_game = HostedGame(game_id=51, host=FakeSession("host"))
    GameSession.send_match_start(sink, spectator_game, -1)
    spec_op, spec_pay = sink.sent[-1]

    named = HostedGame(game_id=52, host=FakeSession("host"))
    named.add_player(FakeSession("peer"))
    GameSession.send_match_start(sink, named, 1)
    play_op, play_pay = sink.sent[-1]
    fx["match_start"] = {
        "spectator": {"opcode": spec_op, "payload_hex": h(spec_pay)},
        "player_slot1_two_players": {
            "opcode": play_op,
            "payload_hex": h(play_pay),
            "names": list(named.names),
            "mask": named.active_mask(),
        },
    }

    sink._local_id_sent = False
    GameSession._send_local_player_id(sink, 485641658)
    fx["local_player_id_set"] = {
        "opcode": sink.sent[-1][0], "payload_hex": h(sink.sent[-1][1])}
    GameSession._send_local_player_id(sink, 0xFFFFFFFFFFFFFFFF)
    fx["local_player_id_reset"] = {
        "opcode": sink.sent[-1][0], "payload_hex": h(sink.sent[-1][1])}

    # Authoritative snapshot (opcode 61 body), built WITHOUT start(): the match
    # is constructed directly and pinned onto the HostedGame so neither RNG nor
    # wall clock participates.
    def build_snapshot(bucket_large):
        g = HostedGame(
            game_id=90,
            host=FakeSession("host"),
            options=GameOptions(bucket_large=bucket_large),
        )
        match = AuthoritativeMatch(
            2, 12 if bucket_large else 8, 27 if bucket_large else 18,
            2, 4, 1,
        )
        g.engine = match
        g.transition_counters = [7, 7]
        g.next_pieces = [
            Piece(0, 2, 1, (16, 17), 0x11),
            Piece(1, 2, 1, (17, 18), 0x22),
        ]
        player = match.players[0]
        player.lives = 2
        w = player.board.width
        player.board.set(3, 15, 17)
        player.board.set(4, 15, 18)
        player.board.set(0, 17, 23)
        player.board.set_solid(w - 1, 17, 2, 99)
        player.board.set(1, 16, 0)
        player.active = ActiveDomino(
            player.board,
            (16, 17),
            match.base_drop_ticks,
            orientation=3 if bucket_large else 1,
            top_x=5,
            top_y=7,
            drop_countdown=9,
            forced_drop_countdown=1234,
            previous_controls=5,
            horizontal_repeat=2,
            grounded=bool(bucket_large),
        )
        recipient = FakeSession("recipient")
        g.send_authoritative_snapshot(recipient, 0)
        slot_no, payload = recipient.current_full_state  # set by send_full_state
        return {
            "bucket_large": bucket_large,
            "slot": slot_no,
            "payload_hex": h(payload),
            "lives": player.lives,
            "transition_counter": g.transition_counters[0],
            "active_x": player.active.x,
            "active_y": player.active.y,
            "drop_countdown": player.active.drop_countdown,
            "forced_drop_countdown": player.active.forced_drop_countdown,
            "previous_controls": player.active.previous_controls,
            "horizontal_repeat": player.active.horizontal_repeat,
            "descriptor": player.active.descriptor,
            "orientation": player.active.orientation,
        }

    fx["snapshots"] = [build_snapshot(False), build_snapshot(True)]

    rl = HostedGame(game_id=13, host=FakeSession("host"))
    rl.control_credit = [0.0]
    rl.control_refill_at = [100.0]
    fx["rate_limiter"] = {
        "sequence": [
            {"requested": req, "now": now,
             "allowed": rl._admit_control_ticks(0, req, now)}
            for req, now in ((20, 100.2), (20, 100.3), (99, 200.0))
        ],
        "credit_after": rl.control_credit[0],
    }

    names = ["Hello", "Player1", "A", "MixedCase User", "  spaced  "]
    accounts = AccountStore(Path(tempfile.mktemp()), True)
    fx["uid_for"] = {
        name: {
            "uid": Lobby.uid_for(name),
            "player_id": accounts.player_id(name),
        }
        for name in names
    }

    def build_record(u, x, q, t, v, w, y, values, checksum, tail=b""):
        out = bytearray()
        out.append(1)  # sub-command
        out += struct.pack(">HHH", u, x, q)
        out += struct.pack(">iiii", t, v, w, y)
        out.append(len(values))
        for value in values:
            out += struct.pack(">i", value)
        out += struct.pack(">I", checksum)
        out += tail
        return bytes(out)

    record = build_record(0xBEEF, 1, 65534, 10, -20, 30, 40,
                          [384443, -7], 0xDEADBEEF, b"\xaa\xbb")
    decoded = Lobby._decode_achievement(record)
    decoded["trailing"] = h(decoded["trailing"])
    fx["achievement_record_decode"] = {
        "payload_hex": h(record), "fields": decoded}
    fx["achievement_record_too_short"] = {
        "payload_hex": h(record[:23]),
        "decoded": Lobby._decode_achievement(record[:23]),
    }

    def progress(stage_tag_bytes, field_q=7, ctx_words=(1, -2, 3), csum=0xCAFEF00D):
        out = bytearray([1, field_q])
        out += bytes(stage_tag_bytes)
        for word in ctx_words:
            out += struct.pack(">i", word)
        out += struct.pack(">I", csum)
        return bytes(out)

    class PeerOnly:
        peer = "fixture"

    fx["progress_record_decode"] = {
        "one_byte_stage3": {
            "payload_hex": h(progress([0x43])),
            "stage": GameSession._decode_progress_record(PeerOnly(), progress([0x43])),
        },
        "two_byte_stage64": {
            "payload_hex": h(progress([0xC0, 0x40])),
            "stage": GameSession._decode_progress_record(
                PeerOnly(), progress([0xC0, 0x40])),
        },
        "unknown_tag": {
            "payload_hex": h(progress([0x03])),
            "stage": GameSession._decode_progress_record(
                PeerOnly(), progress([0x03])),
        },
        "count_not_one": {
            "payload_hex": h(bytes([2, 7, 0x43])),
            "stage": GameSession._decode_progress_record(
                PeerOnly(), bytes([2, 7, 0x43])),
        },
    }

    fx["chat_relay_payloads"] = {
        "lobby_chat": h(build_chat_broadcast("outsider", 2, b"hi", 0)),
        "room_chat": h(build_chat_broadcast(
            "peer", 3, b"abc", 1, room_id=77, room_owner="host")),
        "room_quickchat": h(build_quickchat_broadcast(
            "spectator", 0x8123, 1, room_id=77, room_owner="host")),
        "lobby_quickchat": h(build_quickchat_broadcast(
            "spectator", 0x8123, 0)),
    }

    # Lobby room lifecycle over fake sessions. Freeze wall-clock so elapsed_ms
    # is reproducible. NOTE: HostedGame.created_at uses default_factory=time.time,
    # which binds the REAL clock at class definition -- patching time.time later
    # does not freeze creation stamps. So every golden room update is recorded
    # after explicitly normalizing created_at back to T0 (elapsed 0).
    T0 = 2000000000.0
    real_time = time.time
    time.time = lambda: T0
    try:
        lobby = Lobby()
        lobby._scores_path = Path(tempfile.mktemp())
        lobby._achievements_path = Path(tempfile.mktemp())
        lobby._progress_path = Path(tempfile.mktemp())
        host_s = FakeSession("host")
        peer_s = FakeSession("peer")
        observer = FakeSession("observer")

        for session in (host_s, peer_s, observer):
            session.current_game = None
            session.player_slot = None

        lobby.join(host_s)
        lobby.join(peer_s)
        lobby.join(observer)

        def norm_update():
            game.created_at = T0
            lobby._broadcast_room_update(game)
            return h(observer.lobby_events[-1])

        game = lobby.create_game(
            host_s, GameOptions(allow_spectators=False, invite_only=True))
        create_events = [norm_update()]

        count_before = len(observer.lobby_events)
        rejected = lobby.join_game(observer, game.game_id)
        reject_added_none = len(observer.lobby_events) == count_before
        invitation_only_message = "invitation-only" in observer.messages[-1]

        invited = lobby.invite_player(host_s, lobby.uid_for("peer"))
        invite_events = [norm_update()]
        lobby.join_game(peer_s, game.game_id)
        join_events = [norm_update()]
        lobby.start_game(host_s)
        start_events = [norm_update()]
        # Nonzero elapsed: rewind creation and re-broadcast.
        game.created_at = T0 - 6.128
        lobby._broadcast_room_update(game)
        elapsed_update = h(observer.lobby_events[-1])

        end_count = len(observer.lobby_events)
        game.end_game(host_s)
        end_events = [h(e) for e in observer.lobby_events[end_count:]]
        room_survives_first_dismiss = [game] == lobby.games_snapshot()
        game.dismiss(host_s)
        dismiss_host_pair = [h(e) for e in observer.lobby_events[end_count:]]
        game.dismiss(peer_s)
        dismiss_peer_pair = [h(e) for e in observer.lobby_events[end_count:]]
        final_modes = [e[0] for e in observer.lobby_events[-2:]]
        concluded_bit4 = bool(observer.lobby_events[-2][6] & 0x04)
        fx["room_lifecycle"] = {
            "game_id": game.game_id,
            "create_events": create_events,
            "reject_added_none": bool(reject_added_none),
            "observer_rejected": rejected is None,
            "invitation_only_message": bool(invitation_only_message),
            "invite_accepted": bool(invited),
            "invite_events": invite_events,
            "join_events": join_events,
            "start_events": start_events,
            "elapsed_update": elapsed_update,
            "elapsed_ms": 6128,
            "end_events": end_events,
            "room_survives_first_dismiss": bool(room_survives_first_dismiss),
            "dismiss_events": dismiss_peer_pair,
            "dismiss_pairs_identical": dismiss_host_pair == dismiss_peer_pair,
            "final_modes": final_modes,
            "concluded_flag_bit4": bool(concluded_bit4),
            "snapshot_empty_after_last_dismiss": lobby.games_snapshot() == [],
            "sessions_detached": (
                host_s.current_game is None and peer_s.current_game is None
            ),
        }
    finally:
        time.time = real_time

    dump(fx)


if __name__ == "__main__":
    main()
