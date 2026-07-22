from __future__ import annotations

import argparse
import shutil
import threading
from pathlib import Path

from .bots import BotManager, bot_names_from_env, bots_enabled
from .cache import CacheStore
from .config import ServerConfig
from .http import DekoblokoHTTPServer
from .lobby import LOBBY
from .tcp import DekoblokoTCPServer


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Dekobloko local server with RSA/XTEA/ISAAC login")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--http-port", type=int, default=8080)
    parser.add_argument("--game-port1", type=int, default=43594)
    parser.add_argument("--game-port2", type=int, default=43595)
    parser.add_argument("--cache-dir", type=Path, default=Path("./cache"))
    parser.add_argument("--jar", dest="jar_path", type=Path, default=Path("./www/dekobloko-rsa-client.jar"))
    parser.add_argument("--rsa-key", dest="rsa_key_path", type=Path, default=Path("./dekobloko-rsa-private.json"))
    parser.add_argument("--accounts", dest="accounts_path", type=Path, default=Path("./accounts.json"))
    parser.add_argument("--no-auto-register", action="store_true", help="Reject unknown accounts instead of creating them")
    parser.add_argument("--servernum", type=int, default=1)
    parser.add_argument("--gamecrc", type=int, default=0)
    parser.add_argument("--instanceid", type=int, default=0)
    parser.add_argument("--member", choices=("yes", "no"), default="no")
    parser.add_argument("--lang", type=int, default=0)
    parser.add_argument("--affid", type=int, default=0)
    parser.add_argument("--simplemode", choices=("true", "false"), default="false")
    parser.add_argument("--display-name", default="Player")
    parser.add_argument("--player-id", type=int, default=1)
    parser.add_argument("--welcome-message", default="Welcome to the local Dekobloko server.")
    return parser


def parse_args() -> argparse.Namespace:
    return build_parser().parse_args()


def make_config(args: argparse.Namespace) -> ServerConfig:
    return ServerConfig(
        host=args.host,
        http_port=args.http_port,
        game_port1=args.game_port1,
        game_port2=args.game_port2,
        cache_dir=args.cache_dir,
        jar_path=args.jar_path,
        rsa_key_path=args.rsa_key_path,
        accounts_path=args.accounts_path,
        auto_register=not args.no_auto_register,
        servernum=args.servernum,
        gamecrc=args.gamecrc,
        instanceid=args.instanceid,
        member=args.member,
        lang=args.lang,
        affid=args.affid,
        simplemode=args.simplemode,
        display_name=args.display_name,
        player_id=args.player_id,
        welcome_message=args.welcome_message,
    )


def serve_in_thread(server: object, name: str) -> threading.Thread:
    thread = threading.Thread(target=server.serve_forever, name=name, daemon=True)
    thread.start()
    return thread


def maybe_copy_default_jar(config: ServerConfig) -> None:
    bundled = Path(__file__).resolve().parent.parent / "www" / "dekobloko-rsa-client.jar"
    if config.jar_path.exists() or not bundled.exists() or bundled == config.jar_path:
        return
    config.jar_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(bundled, config.jar_path)


class ServerRuntime:
    """Embeddable lifecycle API for the HTTP and TCP protocol servers."""

    def __init__(self, config: ServerConfig) -> None:
        self.config = config
        self.http_server: DekoblokoHTTPServer | None = None
        self.tcp_servers: list[DekoblokoTCPServer] = []
        self.bot_manager: BotManager | None = None

    def start(self) -> None:
        config = self.config
        config.cache_dir.mkdir(parents=True, exist_ok=True)
        maybe_copy_default_jar(config)
        cache = CacheStore(config.cache_dir)
        print(
            f"[main] cache: {config.cache_dir}"
            if cache.available()
            else f"[main] cache missing dat2 in {config.cache_dir}; JS5 requests will miss"
        )
        print(
            f"[main] jar: {config.jar_path}"
            if config.jar_path.is_file()
            else f"[main] jar missing: {config.jar_path}"
        )
        print(
            f"[main] rsa key: {config.rsa_key_path}"
            if config.rsa_key_path.is_file()
            else f"[main] rsa key missing: {config.rsa_key_path}"
        )
        print(f"[main] accounts: {config.accounts_path} auto_register={config.auto_register}")

        self.http_server = DekoblokoHTTPServer((config.host, config.http_port), config)
        self.tcp_servers = [
            DekoblokoTCPServer((config.host, config.game_port1), config, cache),
            DekoblokoTCPServer((config.host, config.game_port2), config, cache),
        ]
        serve_in_thread(self.http_server, "dekobloko-http")
        serve_in_thread(self.tcp_servers[0], "dekobloko-game-1")
        serve_in_thread(self.tcp_servers[1], "dekobloko-game-2")
        print(f"[main] http://{config.host}:{config.http_port}/")
        print(f"[main] tcp ports {config.game_port1}, {config.game_port2}")

        if bots_enabled():
            self.bot_manager = BotManager(LOBBY, bot_names_from_env())
            self.bot_manager.start()

    @staticmethod
    def wait() -> None:
        threading.Event().wait()

    def close(self) -> None:
        if self.bot_manager is not None:
            self.bot_manager.stop()
        servers = [server for server in [self.http_server, *self.tcp_servers] if server]
        for server in servers:
            server.shutdown()
        for server in servers:
            server.server_close()


def main() -> None:
    runtime = ServerRuntime(make_config(parse_args()))
    runtime.start()

    try:
        runtime.wait()
    except KeyboardInterrupt:
        print("\n[main] stopping")
    finally:
        runtime.close()


if __name__ == "__main__":
    main()
