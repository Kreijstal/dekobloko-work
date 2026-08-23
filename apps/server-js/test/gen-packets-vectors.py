#!/usr/bin/env python3
"""Generate golden-vector fixtures for src/packets.js by RUNNING the Python code.

Standalone companion to gen-vectors.py (same conventions: bytes hex-encoded,
errors recorded verbatim) so it can be regenerated without touching the shared
generator while other modules are being ported.

Usage:
    cd /home/kreijstal/git/dekobloko-work
    PYTHONPATH=apps/server python3 apps/server-js/test/gen-packets-vectors.py

Writes test/fixtures/packets.json.
"""
from __future__ import annotations

import contextlib
import io as _io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "server"))

FIXTURES = Path(__file__).resolve().parent / "fixtures"
NL = chr(10)

PACKETS_SEED_A = (11, 22, 33, 44)
PACKETS_SEED_B_WRAP = (4294967295, 2147483647, 50, 0)


def dump(name, obj):
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / (name + ".json")
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + NL, encoding="utf-8")
    print("wrote " + str(path))


class PktReader:
    """Minimal socket stand-in: recv() returns what is asked while data lasts."""

    def __init__(self, data):
        self._buf = memoryview(bytes(data))

    def recv(self, size):
        if not len(self._buf):
            return b""
        out = self._buf[:size]
        self._buf = self._buf[size:]
        return bytes(out)


_NUMERIC_BUILDER_OPS = {"u8", "i8", "u16", "u24", "u32", "u64", "varint7"}


def _run_builder(ops):
    from dekobloko_server import packets as pm

    pb = pm.PacketBuilder()
    for op in ops:
        method, args = op[0], list(op[1:])
        if method == "raw":
            getattr(pb, method)(bytes.fromhex(args[0]))
        elif method in _NUMERIC_BUILDER_OPS:
            getattr(pb, method)(int(args[0]))
        else:
            getattr(pb, method)(*args)
    return pb.finish()


def _conv(value):
    """Decode fixture sentinels: {"__hex__": ...} -> bytes, {"__bigint__": ...} -> int."""
    if isinstance(value, dict) and "__hex__" in value:
        return bytes.fromhex(value["__hex__"])
    if isinstance(value, dict) and "__bigint__" in value:
        return int(value["__bigint__"])
    if isinstance(value, list):
        return [_conv(x) for x in value]
    if isinstance(value, dict):
        return {k: _conv(x) for k, x in value.items()}
    return value


def main():
    from dekobloko_server import packets as pm

    def h(data):
        return bytes(data).hex()

    out = {}

    # --- static tables -------------------------------------------------------
    out["tables"] = {
        "client_packet_lengths": {str(k): v for k, v in pm.CLIENT_PACKET_LENGTHS.items()},
        "server_packet_lengths": {str(k): v for k, v in pm.SERVER_PACKET_LENGTHS.items()},
        "lobby_action_names": {str(k): v for k, v in pm.LOBBY_ACTION_NAMES.items()},
        "server_opcodes_seen_enabled": sorted(pm.SERVER_OPCODES_SEEN_ENABLED),
    }

    # --- PacketBuilder ---------------------------------------------------------
    builder_cases = []
    for name, ops in [
        ("u8_chain", [["u8", 0], ["u8", 255], ["u8", 256], ["u8", -1]]),
        ("i8_negative", [["i8", -1], ["i8", 300]]),
        ("u16_u24", [["u16", 0xFFFF], ["u16", 70000], ["u24", 0xABCDEF],
                     ["u24", 0x1000000]]),
        ("u32_mask", [["u32", 0xFFFFFFFF], ["u32", 2**32 + 5]]),
        ("u64_masks", [["u64", -1], ["u64", "18446744073709551616"],
                       ["u64", "18446744073709551615"], ["u64", 42]]),
        ("varint7_small", [["varint7", 0], ["varint7", 1], ["varint7", 127]]),
        ("varint7_multi", [["varint7", 128], ["varint7", 129], ["varint7", 16383],
                           ["varint7", 16384], ["varint7", 2097151],
                           ["varint7", 2**32 - 1]]),
        ("cstring_ascii", [["cstring", "Alice"]]),
        ("cstring_cp1252", [["cstring", "caf\u00e9 \u2014 \u2018fancy\u2019 \u2026 \u20ac"]]),
        ("cstring_replaced", [["cstring", "snow \u2603 ok"]]),
        ("jagex_string", [["jagex_string", "Lobby"]]),
        ("mixed_raw", [["u8", 5], ["raw", "deadbeef"], ["cstring", "x"], ["u16", 258]]),
        ("empty", []),
    ]:
        builder_cases.append({"name": name, "ops": ops,
                              "out_hex": h(_run_builder(ops))})
    for name, ops in [
        ("err_varint_negative", [["varint7", -1]]),
        ("err_cstring_nul", [["cstring", "a\u0000b"]]),
    ]:
        try:
            _run_builder(ops)
            raise AssertionError("expected ValueError for " + name)
        except ValueError as exc:
            builder_cases.append({"name": name, "ops": ops,
                                  "error_type": type(exc).__name__,
                                  "error": str(exc)})
    out["builder"] = builder_cases

    # --- pack_5bit / unpack_5bit ----------------------------------------------
    pack_cases = []
    unpack_cases = []
    for name, vals in [
        ("empty", []),
        ("single_zero", [0]),
        ("single_max", [31]),
        ("single_masked", [255]),
        ("two_values", [1, 2]),
        ("three_exact", [3, 14, 15]),
        ("four_boundary", [31, 0, 31, 0]),
        ("five_exact", [1, 2, 3, 4, 5]),
        ("six_spill", [31, 30, 29, 28, 27, 26]),
        ("eight_mixed", [0, 31, 1, 30, 2, 29, 3, 28]),
        ("nine_spill", [9, 8, 7, 6, 5, 4, 3, 2, 1]),
        ("twenty_controls", [5, 0, 31, 7] * 5),
    ]:
        packed = pm.pack_5bit(vals)
        pack_cases.append({"name": name, "values": vals, "out_hex": h(packed)})
        unpack_cases.append({"name": name + "_rt", "data_hex": h(packed),
                             "count": len(vals),
                             "out": list(pm.unpack_5bit(packed, len(vals)))})
    for name, data, count in [
        ("zero_count_empty", b"", 0),
        ("padded_tail", pm.pack_5bit([7, 7, 7]), 3),
    ]:
        unpack_cases.append({"name": name, "data_hex": h(data), "count": count,
                             "out": list(pm.unpack_5bit(data, count))})
    for name, data, count in [
        ("err_negative_count", b"\x00", -1),
        ("err_short_stream", b"\x00\x00", 4),
        ("err_long_stream", b"\x00\x00\x00", 3),
    ]:
        try:
            pm.unpack_5bit(data, count)
            raise AssertionError("expected ValueError for " + name)
        except ValueError as exc:
            unpack_cases.append({"name": name, "data_hex": h(data), "count": count,
                                 "error_type": type(exc).__name__, "error": str(exc)})
    out["pack_5bit"] = pack_cases
    out["unpack_5bit"] = unpack_cases

    # --- decode_control_batch --------------------------------------------------
    cb_cases = []
    for name, payload in [
        ("three_controls", bytes([3]) + pm.pack_5bit([5, 6, 7])),
        ("zero_count", bytes([0])),
        ("max_twenty", bytes([20]) + pm.pack_5bit([1] * 20)),
    ]:
        cb_cases.append({"name": name, "payload_hex": h(payload),
                         "out": list(pm.decode_control_batch(payload))})
    for name, payload in [
        ("err_missing_count", b""),
        ("err_count_over_buffer", bytes([21]) + pm.pack_5bit([0] * 21)),
    ]:
        try:
            pm.decode_control_batch(payload)
            raise AssertionError("expected ValueError for " + name)
        except ValueError as exc:
            cb_cases.append({"name": name, "payload_hex": h(payload),
                             "error_type": type(exc).__name__, "error": str(exc)})
    out["decode_control_batch"] = cb_cases

    # --- PacketCodec.encode_server_packet -------------------------------------
    def cap_encode(codec, opcode, payload=b""):
        buf = _io.StringIO()
        with contextlib.redirect_stdout(buf):
            wire = codec.encode_server_packet(opcode, payload)
        return wire, buf.getvalue().rstrip("\n")

    encode_cases = []
    encode_errors = []
    for label, seed in [("seed_a", PACKETS_SEED_A),
                        ("seed_b_wrap", PACKETS_SEED_B_WRAP)]:
        codec = pm.PacketCodec(seed)
        for opcode, payload in [
            (0, b""),
            (14, b""),
            (18, b"\x07"),
            (62, b"\x01\x02"),
            (9, b"Hello\x00"),
            (75, bytes([1, 0, 0, 0, 8])),
            (2, bytes.fromhex("01abcd1122334455667788")),
            (61, bytes(range(60))),
        ]:
            wire, printed = cap_encode(codec, opcode, payload)
            assert printed == "", "unexpected warning for opcode %d" % opcode
            encode_cases.append({"label": label, "opcode": opcode,
                                 "payload_hex": h(payload), "wire_hex": h(wire)})
        # Unlisted opcode: guessed fixed framing plus the LOUD warning.
        wire, printed = cap_encode(codec, 100, b"\xab\xcd")
        encode_cases.append({"label": label, "opcode": 100,
                             "payload_hex": "abcd", "wire_hex": h(wire),
                             "warning": printed})
        # A failed fixed-length check still burns one outbound ISAAC word
        # (raw_opcode is drawn before validation); pin that ordering.
        err_codec = pm.PacketCodec(seed)
        try:
            cap_encode(err_codec, 0, b"\x01")
            raise AssertionError("expected ValueError")
        except ValueError as exc:
            post_wire, _ = cap_encode(err_codec, 0, b"")
            encode_errors.append({"label": label, "case": "fixed_mismatch",
                                  "error_type": type(exc).__name__,
                                  "error": str(exc),
                                  "post_error_wire_hex": h(post_wire)})
        for case, bad_op, bad_payload in [
            ("too_long_u8", 9, bytes(256)),
            ("too_long_u16", 2, bytes(65536)),
        ]:
            try:
                cap_encode(pm.PacketCodec(seed), bad_op, bad_payload)
                raise AssertionError("expected ValueError")
            except ValueError as exc:
                encode_errors.append({"label": label, "case": case,
                                      "error_type": type(exc).__name__,
                                      "error": str(exc)})
    out["codec_encode"] = {"cases": encode_cases, "errors": encode_errors}

    # --- PacketCodec.read_client_packet ----------------------------------------
    ach_body = (bytes([1]) + (7).to_bytes(2, "big") + (9).to_bytes(2, "big")
                + (1234).to_bytes(4, "big") + (5678).to_bytes(4, "big")
                + bytes(19) + b"\xde\xad\xbe\xef")
    assert len(ach_body) == 36
    progress_body = bytes.fromhex("010043") + bytes(20)
    assert len(progress_body) == 23

    def make_frames():
        return [
            ("table", 17, b""),
            ("assume", 99, b"\xca\xfe\xba\xbe"),
            ("table", 60, bytes([3]) + pm.pack_5bit([2, 9, 31])),
            ("hiscore3", 3, bytes.fromhex("050000000a01")),
            ("table", 7, bytes([0, 10])),
            ("achrec3", 3, ach_body),
            ("req5", 5, bytes.fromhex("020000")),
            ("progress5", 5, progress_body),
            ("assume_zero", 77, b""),
            ("table", 59, b"\x2a"),
        ]

    decode_streams = []
    for label, seed in [("seed_a", PACKETS_SEED_A),
                        ("seed_b_wrap", PACKETS_SEED_B_WRAP)]:
        writer = pm.PacketCodec(seed)
        stream = bytearray()
        for kind, opcode, payload in make_frames():
            stream.append((opcode + writer.inbound.next()) & 0xFF)
            if kind in ("hiscore3", "req5"):
                stream.extend(payload)
            elif kind in ("achrec3", "progress5", "assume"):
                stream.append(len(payload))
                stream.extend(payload)
            elif kind == "assume_zero":
                stream.append(0)
            else:
                ln = pm.CLIENT_PACKET_LENGTHS.get(opcode)
                assert ln is not None, "frame needs a table entry"
                if ln == -1:
                    stream.append(len(payload))
                elif ln != len(payload):
                    raise AssertionError("fixed length mismatch")
                stream.extend(payload)
        decoder = pm.PacketCodec(seed)
        reader = PktReader(bytes(stream))
        frames = []
        for kind, opcode, payload in make_frames():
            gp = decoder.read_client_packet(reader)
            assert gp.opcode == opcode, (gp.opcode, opcode)
            assert bytes(gp.payload) == payload
            frames.append({"kind": kind, "opcode": gp.opcode,
                           "payload_hex": h(gp.payload),
                           "assumed_variable": gp.assumed_variable})
        decode_streams.append({"label": label, "seed": list(seed),
                               "stream_hex": h(bytes(stream)), "frames": frames})
    out["codec_decode"] = decode_streams

    # --- make_server_message ----------------------------------------------------
    sm_cases = []
    for label, seed in [("seed_a", PACKETS_SEED_A),
                        ("seed_b_wrap", PACKETS_SEED_B_WRAP)]:
        codec = pm.PacketCodec(seed)
        for name, text in [
            ("welcome", "Welcome to Dekobloko!"),
            ("cp1252_specials",
             "caf\u00e9 \u2014 \u2018fancy\u2019 \u2026 \u20ac \u00fc\u00f1\u00df\u00d7"),
            ("unmappable_replaced", "snow \u2603 \u0081ctrl end"),
            ("empty", ""),
        ]:
            sm_cases.append({"label": label, "text_name": name, "text": text,
                             "wire_hex": h(codec.make_server_message(text))})
    out["server_message"] = sm_cases

    # --- build_* families --------------------------------------------------------
    build_cases = []

    def add_build(family, name, args, kwargs=None, error=False):
        rec = {"family": family, "name": name, "args": args,
               "kwargs": kwargs or {}}
        fn = getattr(pm, family)
        try:
            result = fn(*_conv(list(args)), **_conv(dict(kwargs or {})))
        except Exception as exc:  # recorded on purpose
            if not error:
                raise
            rec["error_type"] = type(exc).__name__
            rec["error"] = str(exc)
        else:
            assert not error, "expected error for %s/%s" % (family, name)
            rec["out_hex"] = h(result)
        build_cases.append(rec)

    add_build("build_sb_reply", "zero", [0])
    add_build("build_sb_reply", "stage3", [3])
    add_build("build_sb_reply", "large", [305419896])

    add_build("build_achievements_reply", "none", [[]])
    add_build("build_achievements_reply", "one", [[0]])
    add_build("build_achievements_reply", "spread", [[1, 5, 30]])
    add_build("build_achievements_reply", "out_of_range_ignored", [[31, 99, -1]])
    add_build("build_achievements_reply", "dupes", [[2, 2, 2]])

    add_build("build_achievement_mask", "none", [[]])
    add_build("build_achievement_mask", "several", [[0, 3, 17]])
    add_build("build_achievement_mask", "out_of_range_ignored", [[40, -5]])

    add_build("build_f_reply", "always", [])

    add_build("build_chat_broadcast", "lobby_default",
              ["Zed", 5, {"__hex__": "68656c6c6f"}, 0])
    add_build("build_chat_broadcast", "markup_name",
              ["<img=1>Duke", 11, {"__hex__": "6772656574696e6773"}, 0])
    add_build("build_chat_broadcast", "room_channel1",
              ["Amy", 3, {"__hex__": "6869"}, 1],
              {"room_id": 5, "room_owner": "Bob"})
    add_build("build_chat_broadcast", "channel4_via_132",
              ["Cid", 2, {"__hex__": "6869"}, 0x84],
              {"room_id": 4097, "room_owner": "\u00e9owyn"})
    add_build("build_chat_broadcast", "binary_body",
              ["Hex", 4, {"__hex__": "00ff7f80"}, 0])
    add_build("build_chat_broadcast", "err_room_fields_missing",
              ["Nope", 1, {"__hex__": "6869"}, 1], error=True)

    add_build("build_quickchat_broadcast", "lobby", ["Pat", 42, 0])
    add_build("build_quickchat_broadcast", "high_bit_id", ["Pat", 0x8007, 0])
    add_build("build_quickchat_broadcast", "room_ch1",
              ["Sam", 9, 1], {"room_id": 12, "room_owner": "Owner"})
    add_build("build_quickchat_broadcast", "err_unsupported_channel",
              ["X", 1, 2], error=True)
    add_build("build_quickchat_broadcast", "err_room_fields_missing",
              ["Y", 1, 1], error=True)

    add_build("build_room_membership", "disc5", [5])
    add_build("build_room_membership", "disc0", [0])
    add_build("build_room_membership", "err_occupants", [5], {"occupants": 1},
              error=True)

    add_build("build_achievement_ack", "proven",
              [43981, {"__bigint__": "1234605616436508552"}])
    add_build("build_achievement_ack", "neg_value_wraps", [1, -1])
    add_build("build_achievement_ack", "defaults", [7])

    add_build("build_hiscore_table", "proven_minimal", [0, [[0, 999, [5]]]])
    add_build("build_hiscore_table", "columns_vcols",
              [7, [[0, 2**40, [7, 8]], [1, 5, [9, 10]]]],
              {"vcols": 2, "columns": [["Board", None], ["Time", "secs"]]})
    add_build("build_hiscore_table", "err_value_count",
              [0, [[0, 1, [1, 2]]]], error=True)

    add_build("build_ignore_entry", "default", ["Troll"])
    add_build("build_ignore_entry", "full", ["Troll"],
              {"previous": "Foo", "world": "World31"})

    add_build("build_friend_entry", "no_display", ["Amelia"])
    add_build("build_friend_entry", "display", ["Amelia"],
              {"display_name": "Amy", "world": "W2"})

    add_build("build_player_joined_room", "defaults", [42, "GUEST"])
    add_build("build_player_joined_room", "full", [42, "GUEST"],
              {"display_name": "Guesty", "rating": 1487, "rated_games": 37,
               "crown": 3, "options": 1})

    add_build("build_player_left_room", "plain", [42])
    add_build("build_player_left_room", "kicked", [42], {"reason": 3})

    add_build("build_leave_room_reply", "always", [])
    add_build("build_kicked_room_reply", "always", [])

    add_build("build_add_room", "minimal", [1, 1000, "Host"], {"player_count": 1})
    add_build("build_add_room", "started", [2, 1000, "Host"],
              {"player_count": 3, "started": True, "elapsed_ms": 61000})
    add_build("build_add_room", "concluded_rated_nojoin", [3, 1000, "Host"],
              {"player_count": 8, "concluded": True, "elapsed_ms": 120000,
               "rated": True, "allow_join": False})
    add_build("build_add_room", "invite_only_no_spectate", [4, 1000, "H"],
              {"player_count": 0, "allow_spectators": False,
               "options": {"__hex__": "0102030405"}})

    add_build("build_remove_room", "default", [9])
    add_build("build_remove_room", "reason", [9], {"reason": 2})

    add_build("build_room_invitation", "basic", [77])
    add_build("build_lobby_player_left", "default", [500])
    add_build("build_lobby_player_left", "reason", [500], {"reason": 1})
    add_build("build_host_invitation_added", "basic", [501])
    add_build("build_host_invitation_removed", "default_status2", [502])
    add_build("build_host_invitation_removed", "custom", [502], {"status": 7})

    add_build("build_create_room_reply", "open", [10, 1000, "Host"], {})
    add_build("build_create_room_reply", "invite_only_small",
              [11, 1000, "Host"], {"invite_only": True, "max_players": 4})

    add_build("build_local_player_id", "answer42", [42])
    add_build("build_local_player_id", "zero", [0])
    add_build("build_local_player_id", "max_u64",
              [{"__bigint__": "18446744073709551615"}])
    add_build("build_local_player_id", "err_negative", [-1], error=True)
    add_build("build_local_player_id", "err_too_big",
              [{"__bigint__": "18446744073709551616"}], error=True)

    add_build("build_lobby_player", "proven_shape", [42, "Alice", 1487],
              {"rated_games": 37, "flag": True, "previous_name": "",
               "seconds_ago": 600, "icon": 3})
    add_build("build_lobby_player", "display_override", [7, "Bob", 0],
              {"display_name": "Bobby"})
    add_build("build_lobby_player", "err_rating", [1, "X", 65536], error=True)
    add_build("build_lobby_player", "err_rated_games", [1, "X", 0],
              {"rated_games": 128}, error=True)

    add_build("build_social_list_complete", "mode2_default", [])
    add_build("build_social_list_complete", "mode3", [], {"mode": 3})
    add_build("build_social_list_complete", "err_mode4", [], {"mode": 4},
              error=True)

    out["builds"] = build_cases

    dump("packets", out)


if __name__ == "__main__":
    main()
