"""Optional Player5/Player6 demonstration for the Dekobloko server.

This is deliberately outside ``dekobloko_server``. It is a fixture consumer of
the lobby API: its sessions register with ``Lobby.join`` and use the same
create/invite/join/start/control methods as network-backed sessions.
"""

from __future__ import annotations

import random
import threading
import time

from dekobloko_server.__main__ import ServerRuntime, build_parser, make_config
from dekobloko_server.engine import FAST_DROP, LEFT, RIGHT, ROTATE_CLOCKWISE
from dekobloko_server.api import (
    CookedShape,
    GameOptions,
    HostedGame,
    LOBBY,
    Lobby,
    Piece,
)
from dekobloko_server.packets import pack_5bit


class DummyLobbySession:
    """Socket-free implementation of the server's public LobbySession surface."""

    def __init__(self, name: str) -> None:
        self.display_name = name
        self.current_game: HostedGame | None = None
        self.player_slot: int | None = None
        self.messages: list[str] = []

    def send_server_message(self, message: str) -> None:
        self.messages.append(message)
        del self.messages[:-20]

    def send_lobby_bootstrap(self) -> None:
        return

    def send_lobby_roster(self, rows: list[tuple[int, str, int, int]]) -> None:
        return

    def send_local_player_id(self, uid: int) -> None:
        return

    def send_lobby_event(self, payload: bytes) -> None:
        return

    def send_chat_payload(self, opcode: int, payload: bytes) -> None:
        return

    def send_match_start(self, game: HostedGame, local_slot: int) -> None:
        return

    def send_piece_event(
        self,
        player_slot: int,
        piece: Piece,
        speed_index: int,
        final_x: int = 0,
        final_y: int = 0,
        final_orientation: int = 0,
        finalize_argument: int = 0,
    ) -> None:
        game = self.current_game
        if (
            game is not None
            and game.state == "playing"
            and self.player_slot == player_slot
            and player_slot < len(game.transition_counters)
        ):
            game.handle_transition_ack(self, game.transition_counters[player_slot])

    def send_cooked_shape(self, player_slot: int, shape: CookedShape) -> None:
        return

    def send_action_stream(self, player_slot: int, controls_payload: bytes) -> None:
        return

    def send_player_removed(self, player_slot: int, result_code: int) -> None:
        return

    def send_full_state(self, player_slot: int, state_payload: bytes) -> None:
        return

    def send_match_result(self, winner_slot: int) -> None:
        return

    def send_game_over(self) -> None:
        return


class LobbyDemo:
    """External repeating fixture built solely on the lobby/game API."""

    def __init__(
        self,
        lobby: Lobby,
        *,
        join_delay: float = 10.0,
        start_delay: float = 10.0,
        between_delay: float = 5.0,
        match_timeout: float = 60.0,
        quickchat_id: int = 0x8000,
        seed: int | None = None,
    ) -> None:
        self.lobby = lobby
        self.join_delay = join_delay
        self.start_delay = start_delay
        self.between_delay = between_delay
        self.match_timeout = match_timeout
        self.quickchat_id = quickchat_id
        self.rng = random.Random(seed)
        self.player5 = DummyLobbySession("Player5")
        self.player6 = DummyLobbySession("Player6")
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self.lobby.join(self.player5)
        self.lobby.join(self.player6)
        self._thread = threading.Thread(
            target=self._run,
            name="dekobloko-lobby-demo",
            daemon=True,
        )
        self._thread.start()

    def stop(self, timeout: float = 2.0) -> None:
        self._stop.set()
        thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout)
        self._detach_players()

    def _run(self) -> None:
        cycle = 0
        try:
            while not self._stop.is_set():
                cycle += 1
                options = GameOptions(
                    bucket_large=bool(self.rng.getrandbits(1)),
                    speed_index=self.rng.randrange(0, 5),
                    bombardment_level=self.rng.randrange(0, 4),
                    colours=self.rng.randrange(4, 8),
                    special_level=self.rng.randrange(0, 5),
                    allow_spectators=(cycle % 2 == 1),
                    invite_only=True,
                    theme=self.rng.randrange(0, 8),
                )
                game = self.lobby.create_game(self.player5, options)
                self.lobby.invite_player(
                    self.player5, self.lobby.uid_for(self.player6.display_name)
                )
                self.lobby.relay_quickchat(
                    self.player5, self.quickchat_id, channel=0
                )
                print(
                    f"[demo] Player5 created room {game.game_id}; "
                    f"Player6 invited; settings={options}"
                )
                if self._stop.wait(max(0.0, self.join_delay)):
                    break
                if game.state != "waiting":
                    continue
                self.lobby.join_game(self.player6, game.game_id)
                self.lobby.relay_quickchat(
                    self.player6, self.quickchat_id, channel=1
                )
                print(f"[demo] Player6 joined room {game.game_id}")
                if self._stop.wait(max(0.0, self.start_delay)):
                    break
                if game.state != "waiting":
                    continue
                self.lobby.start_game(self.player5)
                print(f"[demo] game {game.game_id} started")
                self._play(game)
                if self._stop.wait(max(0.0, self.between_delay)):
                    break
        finally:
            self._detach_players()

    def _play(self, game: HostedGame) -> None:
        deadline = time.monotonic() + max(0.01, self.match_timeout)
        next_chat = time.monotonic() + 10.0
        while game.state == "playing" and not self._stop.is_set():
            for player in tuple(game.active_players()):
                controls = [FAST_DROP] * 5
                roll = self.rng.randrange(12)
                if roll == 0:
                    controls[0] |= LEFT
                elif roll == 1:
                    controls[0] |= RIGHT
                elif roll == 2:
                    controls[0] |= ROTATE_CLOCKWISE
                game.handle_controls(
                    player, bytes([len(controls)]) + pack_5bit(controls)
                )
            if time.monotonic() >= next_chat:
                speakers = game.active_players()
                if speakers:
                    self.lobby.relay_quickchat(
                        self.rng.choice(speakers), self.quickchat_id, channel=1
                    )
                next_chat += 10.0
            if time.monotonic() >= deadline:
                remaining = game.active_players()
                game.end_game(self.rng.choice(remaining) if remaining else None)
                # A finished game HOLDS its result screen until each player
                # dismisses it. These fixtures have no UI to show, so they must
                # answer for themselves or the room is pinned open forever.
                for player in (self.player5, self.player6):
                    game.dismiss(player)
                return
            self._stop.wait(0.1)

    def _detach_players(self) -> None:
        self.lobby.leave(self.player6)
        self.lobby.leave(self.player5)


def main() -> None:
    parser = build_parser()
    parser.description = "Dekobloko server with external Player5/Player6 demo fixture"
    parser.add_argument("--demo-join-seconds", type=float, default=10.0)
    parser.add_argument("--demo-start-seconds", type=float, default=10.0)
    parser.add_argument("--demo-between-seconds", type=float, default=5.0)
    parser.add_argument("--demo-match-seconds", type=float, default=60.0)
    parser.add_argument("--demo-seed", type=int)
    parser.add_argument(
        "--demo-quickchat-id", type=lambda value: int(value, 0), default=0x8000
    )
    args = parser.parse_args()
    runtime = ServerRuntime(make_config(args))
    demo = LobbyDemo(
        LOBBY,
        join_delay=args.demo_join_seconds,
        start_delay=args.demo_start_seconds,
        between_delay=args.demo_between_seconds,
        match_timeout=max(1.0, args.demo_match_seconds),
        quickchat_id=args.demo_quickchat_id,
        seed=args.demo_seed,
    )
    runtime.start()
    demo.start()
    print("[demo] external Player5/Player6 fixture enabled")
    try:
        runtime.wait()
    except KeyboardInterrupt:
        print("\n[demo] stopping")
    finally:
        demo.stop()
        runtime.close()


if __name__ == "__main__":
    main()
