from __future__ import annotations

import argparse
from pathlib import Path
import socket
import threading

from dekobloko_server.__main__ import build_parser as deko_parser, make_config, serve_in_thread
from dekobloko_server.crypto import RsaPrivateKey
from dekobloko_server.http import DekoblokoHTTPServer
from dekobloko_server.js5 import Js5Session
from dekobloko_server.tcp import DekoblokoTCPServer
from .http import EscapeHTTPRequestHandler
from .cache import GameCache
from .session import EscapeSession
from .store import EscapeStore


class EscapeJs5Session(Js5Session):
    def _patched_read(self, archive_id: int, group_id: int) -> bytes | None:
        # Deko's missing subscription-art replacement is specific to its cache.
        return self.cache.read(archive_id, group_id)

    def _build_master_index(self) -> bytes:
        raise ValueError("Escape Vector needs the signed 255-255.bin master index; use a complete local cache export")


def build_parser() -> argparse.ArgumentParser:
    parser = deko_parser()
    parser.description = "Escape Vector local server (Deko Bloko transport, Escape account protocol)"
    state = Path.home() / ".local/share/funorb/escapevector"
    parser.set_defaults(cache_dir=Path.home() / ".alterorb/caches/escapevector",
                        jar_path=state / "escapevector-rsa-client.jar",
                        rsa_key_path=state / "rsa-private.json",
                        accounts_path=state / "accounts.json",
                        welcome_message="Welcome to the local Escape Vector server.")
    return parser


class ServerRuntime:
    def __init__(self, config) -> None:
        self.config = config
        self.http_server = None
        self.tcp_servers = []
        self.store = None
        self._running = []
        self._sessions = set()
        self._sessions_lock = threading.Lock()

    def _session(self, sock, config, peer):
        runtime = self

        class TrackedSession(EscapeSession):
            def run_after_opcode(self, opcode):
                with runtime._sessions_lock:
                    runtime._sessions.add(sock)
                try:
                    super().run_after_opcode(opcode)
                finally:
                    with runtime._sessions_lock:
                        runtime._sessions.discard(sock)
        return TrackedSession(sock, config, peer, store=self.store)

    def start(self) -> None:
        config = self.config
        if self._running:
            raise RuntimeError("server already started")
        # Catch missing key/JAR before opening a port, instead of failing on
        # each client connection. Preparation is an explicit local operation.
        RsaPrivateKey.from_json(config.rsa_key_path)
        if not config.jar_path.is_file():
            raise FileNotFoundError(config.jar_path)
        self.store = EscapeStore(config.accounts_path, config.auto_register)
        cache = GameCache(config.cache_dir)
        try:
            self.http_server = DekoblokoHTTPServer((config.host, config.http_port), config,
                                                   handler_class=EscapeHTTPRequestHandler)
            for port in (config.game_port1, config.game_port2):
                self.tcp_servers.append(DekoblokoTCPServer((config.host, port), config, cache,
                                        session_factory=self._session, js5_factory=EscapeJs5Session))
            for index, server in enumerate([self.http_server, *self.tcp_servers]):
                serve_in_thread(server, f"escapevector-{index}")
                self._running.append(server)
        except BaseException:
            self.close()
            raise
        print(f"[escapevector] HTTP {self.http_server.server_address}; TCP "
              f"{[server.server_address for server in self.tcp_servers]}")
        print(f"[escapevector] state={config.accounts_path} cache={config.cache_dir} available={cache.available()}")

    @staticmethod
    def wait() -> None:
        threading.Event().wait()

    def close(self) -> None:
        for server in self._running:
            server.shutdown()
        with self._sessions_lock:
            for sock in self._sessions:
                try:
                    sock.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
        for server in [self.http_server, *self.tcp_servers]:
            if server:
                server.server_close()
        self._running.clear()
        self.http_server = None
        self.tcp_servers.clear()


def main() -> None:
    runtime = ServerRuntime(make_config(build_parser().parse_args()))
    try:
        runtime.start()
        runtime.wait()
    except KeyboardInterrupt:
        pass
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
