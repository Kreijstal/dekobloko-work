"""Optional in-lobby bot players (enabled with ``DEKOBLOKO_BOTS=1``).

Headless :class:`LobbySession` presences that sit in the lobby roster so a
single human client can exercise the multiplayer flow end to end:

  * they appear in the lobby player list (each bot is a *real* session
    registered through :meth:`Lobby.join`, so ``roster_rows`` includes it and
    invite/kick resolve it by uid exactly like a networked player);
  * they auto-accept an invitation to a waiting room (a poll loop watches
    ``game.invitations`` for their uid and calls :meth:`Lobby.join_game`);
  * they send a light stream of random controls while a match they are in is
    playing, so their bucket is a live opponent the authoritative engine
    advances rather than a dead grid;
  * after being kicked or when a match ends, ``current_game`` is cleared back to
    ``None`` and the bot is available to be invited again.

This is test scaffolding, deliberately built solely on the public lobby/game
API -- it does not reach into the match engine. It supersedes the pre-merge
``roster_rows`` bot placeholders (which were only names and could not be joined
or played against). See ``dekobloko_demo.py`` for the self-driving Player5/6
fixture that this borrows its ``DummyLobbySession`` surface from.
"""

from __future__ import annotations

import os
import random
import threading
import time

from .engine import FAST_DROP, LEFT, RIGHT, ROTATE_CLOCKWISE
from .lobby import CookedShape, HostedGame, Lobby, Piece
from .packets import pack_5bit

DEFAULT_BOT_NAMES = ("Player1", "Player2", "Player3")


class BotLobbySession:
    """Socket-free :class:`LobbySession` for a lobby-resident bot.

    Mirrors ``dekobloko_demo.DummyLobbySession``: every ``send_*`` sink is a
    no-op except :meth:`send_piece_event`, which acknowledges the piece
    transition so the match keeps advancing for the bot's slot (a real client
    acks by drawing the piece; without it the engine would wait forever).
    """

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

    def send_winner(self, result_code: int) -> None:
        return

    def send_game_over(self) -> None:
        return


class BotManager:
    """Registers bot sessions in a lobby and drives their behaviour."""

    def __init__(
        self,
        lobby: Lobby,
        names: tuple[str, ...] = DEFAULT_BOT_NAMES,
        *,
        poll_interval: float = 0.4,
        seed: int | None = None,
    ) -> None:
        self.lobby = lobby
        self.poll_interval = poll_interval
        self.rng = random.Random(seed)
        self.bots = [BotLobbySession(name) for name in names]
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        for bot in self.bots:
            self.lobby.join(bot)
        self._thread = threading.Thread(
            target=self._run, name="dekobloko-bots", daemon=True
        )
        self._thread.start()
        print(
            "[bots] lobby bots enabled: "
            + ", ".join(bot.display_name for bot in self.bots)
        )

    def stop(self, timeout: float = 2.0) -> None:
        self._stop.set()
        thread = self._thread
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout)
        for bot in self.bots:
            self.lobby.leave(bot)

    def _run(self) -> None:
        while not self._stop.wait(self.poll_interval):
            try:
                self._tick()
            except Exception as exc:  # never let a bot kill the poll loop
                print(f"[bots] tick error: {exc}")

    def _tick(self) -> None:
        # Snapshot the games under the lobby lock, then act without holding it
        # (join_game/handle_controls take their own locks).
        with self.lobby._lock:
            games = list(self.lobby._games.values())
        for bot in self.bots:
            game = bot.current_game
            if game is None:
                self._maybe_accept_invite(bot, games)
            elif game.state == "playing":
                self._play_turn(bot, game)

    def _maybe_accept_invite(
        self, bot: BotLobbySession, games: list[HostedGame]
    ) -> None:
        uid = self.lobby.uid_for(bot.display_name)
        for game in games:
            if (
                game.state == "waiting"
                and uid in game.invitations
                and bot not in game.players
            ):
                self.lobby.join_game(bot, game.game_id)
                print(
                    f"[bots] {bot.display_name} accepted invite to game "
                    f"{game.game_id}"
                )
                return

    def _play_turn(self, bot: BotLobbySession, game: HostedGame) -> None:
        if bot not in game.active_players():
            return
        controls = [FAST_DROP] * 5
        roll = self.rng.randrange(12)
        if roll == 0:
            controls[0] |= LEFT
        elif roll == 1:
            controls[0] |= RIGHT
        elif roll == 2:
            controls[0] |= ROTATE_CLOCKWISE
        game.handle_controls(bot, bytes([len(controls)]) + pack_5bit(controls))


def bots_enabled() -> bool:
    return os.environ.get("DEKOBLOKO_BOTS") == "1"


def bot_names_from_env() -> tuple[str, ...]:
    """Bot names from ``DEKOBLOKO_ROSTER_NAMES`` (comma-separated), else default."""
    raw = os.environ.get("DEKOBLOKO_ROSTER_NAMES", "")
    names = tuple(name.strip() for name in raw.split(",") if name.strip())
    return names or DEFAULT_BOT_NAMES
