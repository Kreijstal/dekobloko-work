from __future__ import annotations

import argparse
import shutil
import threading
from pathlib import Path

from .cache import CacheStore
from .config import ServerConfig
from .http import DekoblokoHTTPServer
from .tcp import DekoblokoTCPServer


def parse_args() -> argparse.Namespace:
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
    return parser.parse_args()


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


def main() -> None:
    config = make_config(parse_args())
    config.cache_dir.mkdir(parents=True, exist_ok=True)
    maybe_copy_default_jar(config)

    cache = CacheStore(config.cache_dir)
    if cache.available():
        print(f"[main] cache: {config.cache_dir}")
    else:
        print(f"[main] cache missing dat2 in {config.cache_dir}; JS5 requests will miss")

    if config.jar_path.is_file():
        print(f"[main] jar: {config.jar_path}")
    else:
        print(f"[main] jar missing: {config.jar_path}")

    if config.rsa_key_path.is_file():
        print(f"[main] rsa key: {config.rsa_key_path}")
    else:
        print(f"[main] rsa key missing: {config.rsa_key_path}")

    print(f"[main] accounts: {config.accounts_path} auto_register={config.auto_register}")

    http_server = DekoblokoHTTPServer((config.host, config.http_port), config)
    tcp_server1 = DekoblokoTCPServer((config.host, config.game_port1), config, cache)
    tcp_server2 = DekoblokoTCPServer((config.host, config.game_port2), config, cache)

    serve_in_thread(http_server, "dekobloko-http")
    serve_in_thread(tcp_server1, "dekobloko-game-1")
    serve_in_thread(tcp_server2, "dekobloko-game-2")

    print(f"[main] http://{config.host}:{config.http_port}/")
    print(f"[main] tcp ports {config.game_port1}, {config.game_port2}")

    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        print("\n[main] stopping")
    finally:
        http_server.shutdown()
        tcp_server1.shutdown()
        tcp_server2.shutdown()
        http_server.server_close()
        tcp_server1.server_close()
        tcp_server2.server_close()


if __name__ == "__main__":
    main()
