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

#: Frames per second the client renders every bucket at, including the ones it
#: is only replicating.  A control batch is worth exactly one engine tick per
#: sample, so a bot must supply one per client frame ELAPSED or the server
#: advances its board slower than the client draws it.
#:
#: Under-feeding is not cosmetic drift, it disconnects the human player: the
#: replica lands the piece and then waits for the authoritative transition
#: (S2C 64).  ``lk.c`` gives that wait a 20-tick grace, sets ``field_y`` when it
#: elapses, and latches ``field_Bb`` on the *next* expiry.  Nothing but a full
#: board reset clears ``field_Bb``, and ``qc`` reports it as "T5" and closes the
#: socket -- so a starved bot board kills the real client's connection.
CLIENT_FPS = 50

#: Ceiling on one catch-up batch.  The server refills control credit at
#: ``LOGIC_TICKS_PER_SECOND`` up to ``CONTROL_BURST_TICKS`` (40) and silently
#: drops the excess, so asking for more than that after a long stall would be
#: trimmed anyway -- and dumping a huge burst into a bucket makes it lurch.
MAX_CATCHUP_SAMPLES = 40


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

    def send_cooked_release(self, player_slot: int, count: int) -> None:
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
        # Small on purpose. A relayed batch is buffered input the replica must
        # chew through one sample per frame, and it cannot apply a pending
        # authoritative landing (S2C 64) until it gets there. Land before that
        # packet is available and the replica sets field_y, exhausts its grace
        # and latches field_Bb -- the "T5" self-disconnect that kills the human
        # player's connection over an OPPONENT's bucket.
        #
        # The grace is far shorter than the 20 ticks lk.c seems to promise.
        # Measured 2026-07-25, field_e goes 20 -> 1 in a single tick:
        #     [INSTR lk.d] Ab=774 e=20 ctrl=16 y=true
        #     [INSTR lk.d] Ab=773 e=1  ctrl=16 y=true
        # so the window is a couple of frames, not 0.4s. At 0.4s per batch the
        # replica could be 20 frames of queued input away from the transition;
        # at 0.08s it is at most 4. Billing against the wall clock
        # (_samples_owed) keeps the overall rate identical either way, so this
        # trades nothing for a proportionally narrower window.
        poll_interval: float = 0.08,
        seed: int | None = None,
    ) -> None:
        self.lobby = lobby
        self.poll_interval = poll_interval
        # Nominal batch size. The real size is computed per turn from elapsed
        # wall time (see _play_turn) -- this is only the steady-state value and
        # what a first turn is worth.
        self.samples_per_turn = max(1, round(poll_interval * CLIENT_FPS))
        # Wall-clock instant each bot has supplied control samples up to.
        self._fed_through: dict[str, float] = {}
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
            elif game.state == "finished":
                # A finished game now HOLDS its result screen until each player
                # dismisses it, so somebody has to answer for the bot -- it has
                # no UI to show and would otherwise pin the room open forever.
                # Dismissing only this bot's slot leaves the human's screen up.
                self._fed_through.pop(bot.display_name, None)
                self.lobby.leave_game(bot, announce=False)

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

    def _samples_owed(self, bot: BotLobbySession) -> int:
        """One sample per client frame that has actually elapsed.

        A fixed batch per turn is not enough. The poll loop's sleep is a floor,
        not a promise -- the GIL, lock contention and scheduling all stretch
        it -- and a fixed count makes every stretched turn a permanent deficit,
        because nothing ever makes the missing ticks up. The bucket the client
        replicates has no such problem: lk.d ticks its gravity every rendered
        frame whether or not any input arrived, so it tracks real time exactly.

        The two therefore separate, and the replica ends up AHEAD of the
        authoritative board. That is what disconnects the human. The replica
        reaches a landing the server has not reached, sets field_y, and waits
        for the S2C 64 that finalizes it; lk.c allows a 20-tick grace and
        latches field_Bb on the next expiry, and qc turns that into the "T5"
        self-disconnect. Captured 2026-07-25 -- the replica of the bot's bucket
        held fill=22 against the engine's fill=20, and it was the OPPONENT's
        board that latched while the player's own was healthy:
            [CT] LOCK board=12845bc9 fill=22 active=1x2 at=(4,7) y=true
            [CT] LOCK board=34c1ff58 fill=6  active=2x3 at=(4,6) y=false
            Error: T5: 1 3 true
        A 20-tick grace is 0.4s, exactly one poll interval, so a single
        stretched turn was enough to spend the whole budget.

        Billing against a running clock instead keeps the deficit at zero: a
        turn that arrives late pays for the frames it missed, and the leftover
        fraction stays on the clock rather than being rounded away.
        """
        now = time.monotonic()
        fed_through = self._fed_through.get(bot.display_name)
        if fed_through is None:
            # First turn of a match: bill one nominal interval, not the time
            # since the process started.
            fed_through = now - self.poll_interval
        # The epsilon matters: an interval that is exactly a whole number of
        # frames lands on either side of it in binary floating point, and
        # truncating 19.999999999999996 to 19 would leak a frame per turn --
        # the very deficit this method exists to remove.
        owed = int((now - fed_through) * CLIENT_FPS + 1e-9)
        owed = max(1, min(owed, MAX_CATCHUP_SAMPLES))
        # Advance by what was actually supplied, so the unspent fraction of a
        # frame carries into the next turn instead of being lost.
        self._fed_through[bot.display_name] = fed_through + owed / CLIENT_FPS
        return owed

    def _play_turn(self, bot: BotLobbySession, game: HostedGame) -> None:
        if bot not in game.active_players():
            self._fed_through.pop(bot.display_name, None)
            return
        controls = [FAST_DROP] * self._samples_owed(bot)
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
