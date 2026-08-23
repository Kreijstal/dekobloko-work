#!/usr/bin/env python3
"""Golden reference for test_main.js: RUN the real dekobloko_server stack.

Builds the deterministic synthetic cache from fixtures/cache.json, boots
ServerConfig + DekoblokoHTTPServer + two DekoblokoTCPServers exactly like
__main__.py does (on EPHEMERAL ports), then drives them as a client:

  * JS5 handshake (preamble 12..., opcode 15, revision 550) -> reply byte
  * one priority file request (archive 255, group 255)     -> response stream
  * GET /                                                  -> index html

Writes {"tcp_hex", "tcp2_hex", "http_hex"} to the output path given as argv[1].
test_main.js compares these bytes against the JS ServerRuntime's answers.
"""
from __future__ import annotations

import json
import os
import socket
import sys
import tempfile
import threading
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "apps" / "server"))

from dekobloko_server.cache import CacheStore
from dekobloko_server.config import ServerConfig
from dekobloko_server.http import DekoblokoHTTPServer
from dekobloko_server.tcp import DekoblokoTCPServer

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "cache.json").read_text())

tmp = tempfile.mkdtemp(prefix="dekobloko-golden-smoke-")
cache_dir = Path(tmp) / "cache"
cache_dir.mkdir()

# Same replay recipe as test_js5.js build_cache_dir().
for spec in FIXTURE["synthetic"]["filespecs"]:
    buf = bytearray(spec["truncate"])
    for write in spec["writes"]:
        blob = bytes.fromhex(write["hex"])
        buf[write["offset"]:write["offset"] + len(blob)] = blob
    (cache_dir / spec["file"]).write_bytes(bytes(buf))

config = ServerConfig(
    host="127.0.0.1",
    http_port=0,
    game_port1=0,
    game_port2=0,
    cache_dir=cache_dir,
    jar_path=Path(tmp) / "smoke.jar",
    rsa_key_path=Path(tmp) / "smoke-rsa.json",
    accounts_path=Path(tmp) / "smoke-accounts.json",
    auto_register=True,
    servernum=7,
    gamecrc=99,
    instanceid=42,
    member="yes",
    lang=3,
    affid=9,
    simplemode="true",
    display_name="Smoke",
    player_id=5,
    welcome_message="Hello smoke",
)

cache = CacheStore(config.cache_dir)
http_server = DekoblokoHTTPServer((config.host, config.http_port), config)
tcp1 = DekoblokoTCPServer((config.host, config.game_port1), config, cache)
tcp2 = DekoblokoTCPServer((config.host, config.game_port2), config, cache)

threads = {}
for name, srv in (("http", http_server), ("game1", tcp1), ("game2", tcp2)):
    thread = threading.Thread(target=srv.serve_forever, name=name, daemon=True)
    thread.start()
    threads[name] = thread


def recv_until(sock, n):
    got = bytearray()
    while len(got) < n:
        chunk = sock.recv(65536)
        if not chunk:
            break
        got.extend(chunk)
    return bytes(got)


# --- game port 1: handshake + priority fetch of archive 255 group 255 --------
sock = socket.create_connection(
    (config.host, tcp1.server_address[1]), timeout=15
)
sock.sendall(bytes([12]) + b"\x00" * 7 + bytes([15]) + (550).to_bytes(4, "big"))
handshake = recv_until(sock, 1)
assert handshake == b"\x00", handshake
sock.sendall(bytes([1, 255]) + (255).to_bytes(4, "big"))
stream = recv_until(sock, 732)
assert len(stream) == 732, len(stream)
sock.close()
tcp_hex = (handshake + stream).hex()

# --- game port 2: reachable, answers the handshake ---------------------------
sock = socket.create_connection(
    (config.host, tcp2.server_address[1]), timeout=15
)
sock.sendall(bytes([12]) + b"\x00" * 7 + bytes([15]) + (550).to_bytes(4, "big"))
handshake2 = recv_until(sock, 1)
assert handshake2 == b"\x00", handshake2
sock.close()

# --- HTTP / -------------------------------------------------------------------
with urllib.request.urlopen(
    "http://%s:%d/" % (config.host, http_server.server_address[1])
) as response:
    index = response.read()

for srv in (http_server, tcp1, tcp2):
    srv.shutdown()
    srv.server_close()

out = {
    "tcp_hex": tcp_hex,
    "tcp_len": len(tcp_hex) // 2,
    "tcp2_hex": handshake2.hex(),
    "http_hex": index.hex(),
}
Path(sys.argv[1]).write_text(json.dumps(out))
print("[golden] wrote " + sys.argv[1] + " tcp_len=%d" % out["tcp_len"])
