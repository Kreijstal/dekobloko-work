from __future__ import annotations

import socketserver

from .cache import CacheStore
from .config import ServerConfig
from .game import GameSession
from .io import read_exact, read_u8
from .js5 import Js5Session


class DekoblokoTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        config: ServerConfig,
        cache: CacheStore,
    ) -> None:
        super().__init__(server_address, DekoblokoTCPHandler)
        self.config = config
        self.cache = cache


class DekoblokoTCPHandler(socketserver.BaseRequestHandler):
    server: DekoblokoTCPServer

    def handle(self) -> None:
        peer = f"{self.client_address[0]}:{self.client_address[1]}"
        sock = self.request
        sock.settimeout(120.0)

        try:
            preamble = read_exact(sock, 8)
            if len(preamble) != 8 or preamble[0] != 12:
                print(f"[tcp] {peer} invalid preamble {preamble.hex(' ')}")
                return

            next_opcode = read_u8(sock)
            if next_opcode == 15:
                revision = int.from_bytes(read_exact(sock, 4), "big")
                Js5Session(sock, self.server.cache, peer).run_after_handshake(revision)
                return

            GameSession(sock, self.server.config, peer).run_after_opcode(next_opcode)

        except (EOFError, ConnectionResetError, BrokenPipeError, TimeoutError, ValueError, OSError) as exc:
            print(f"[tcp] {peer} closed/error: {exc}")
