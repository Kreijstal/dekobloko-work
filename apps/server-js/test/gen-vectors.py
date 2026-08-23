#!/usr/bin/env python3
"""Generate golden-vector fixtures for the JS port by RUNNING the Python code.

Usage:
    cd /home/kreijstal/git/dekobloko-work
    PYTHONPATH=apps/server python3 apps/server-js/test/gen-vectors.py <module> ...

Writes JSON fixtures under apps/server-js/test/fixtures/. Bytes are hex-encoded.
"""
from __future__ import annotations

import json
import random
import sys
import tempfile
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def dump(name, obj):
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / (name + ".json")
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + chr(10), encoding="utf-8")
    print("wrote " + str(path))


# ---------------------------------------------------------------- io ---------

class FakeSock:
    """Mirrors socket.recv/sendall semantics used by dekobloko_server.io."""

    def __init__(self, data=b""):
        self._buf = bytearray(data)
        self.sent = bytearray()

    def recv(self, size):
        if not self._buf:
            return b""
        chunk = self._buf[:size]
        del self._buf[:size]
        return bytes(chunk)

    def sendall(self, data):
        self.sent.extend(data)


def gen_io():
    from dekobloko_server import io as io_mod

    cases = []

    sock = FakeSock(bytes([1, 2, 3, 4, 5]))
    got = io_mod.read_exact(sock, 5)
    cases.append({"op": "read_exact", "in_hex": "0102030405", "size": 5,
                  "out_hex": got.hex()})

    sock = FakeSock(b"ab")
    try:
        io_mod.read_exact(sock, 4)
        raise AssertionError("expected EOFError")
    except EOFError as exc:
        cases.append({"op": "read_exact_eof", "in_hex": "6162", "size": 4,
                      "error": type(exc).__name__, "message": str(exc)})

    sock = FakeSock(bytes([0xAB]))
    cases.append({"op": "read_u8", "in_hex": "ab", "out": io_mod.read_u8(sock)})
    sock = FakeSock(bytes.fromhex("f1f2"))
    cases.append({"op": "read_u16", "in_hex": "f1f2", "out": io_mod.read_u16(sock)})
    sock = FakeSock(bytes.fromhex("ffffffff"))
    cases.append({"op": "read_i32", "in_hex": "ffffffff", "out": io_mod.read_i32(sock)})
    sock = FakeSock(bytes.fromhex("80000000"))
    cases.append({"op": "read_i32", "in_hex": "80000000", "out": io_mod.read_i32(sock)})
    sock = FakeSock(bytes.fromhex("7fffffff"))
    cases.append({"op": "read_i32", "in_hex": "7fffffff", "out": io_mod.read_i32(sock)})

    for value in (0, 0xFF, 0x100, 300):
        sock = FakeSock()
        io_mod.write_u8(sock, value)
        cases.append({"op": "write_u8", "value": value, "out_hex": bytes(sock.sent).hex()})
    for value in (0, 0xFFFF, 70000, 0x1234ABCD):
        sock = FakeSock()
        io_mod.write_u16(sock, value)
        cases.append({"op": "write_u16", "value": value, "out_hex": bytes(sock.sent).hex()})
    for value in (0, 1, 2**40 + 5, 2**63, -1):
        sock = FakeSock()
        io_mod.write_u64(sock, value)
        cases.append({"op": "write_u64", "value": value, "out_hex": bytes(sock.sent).hex()})

    data = b"hello world"
    cases.append({"op": "hex_preview", "in_hex": data.hex(), "limit": 32,
                  "out": io_mod.hex_preview(data)})
    data = bytes(range(40))
    cases.append({"op": "hex_preview", "in_hex": data.hex(), "limit": 32,
                  "out": io_mod.hex_preview(data)})
    cases.append({"op": "hex_preview", "in_hex": data.hex(), "limit": 8,
                  "out": io_mod.hex_preview(data, 8)})
    cases.append({"op": "hex_preview", "in_hex": "", "limit": 32,
                  "out": io_mod.hex_preview(b"", 32)})

    dump("io", {"cases": cases})


GENERATORS = {
    "io": gen_io,
}


def main():
    targets = sys.argv[1:] or sorted(GENERATORS)
    for name in targets:
        GENERATORS[name]()
    print("done: " + ", ".join(targets))


if __name__ == "__main__":
    sys.exit(main())
