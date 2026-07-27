"""Optional in-lobby bot players (enabled with ``DEKOBLOKO_BOTS=1``).

Headless :class:`LobbySession` presences that sit in the lobby roster so a
single human client can exercise the multiplayer flow end to end:

  * they appear in the lobby player list (each bot is a *real* session
    registered through :meth:`Lobby.join`, so ``roster_rows`` includes it and
    invite/kick resolve it by uid exactly like a networked player);
  * they auto-accept an invitation to a waiting room (a poll loop watches
    ``game.invitations`` for their uid and calls :meth:`Lobby.join_game`);
  * they plan cheap board-aware placements while a match is playing, with the
    old random controls available through ``DEKOBLOKO_BOT_STRATEGY=random``;
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
import copy

from .engine import FAST_DROP, LEFT, RIGHT, ROTATE_CLOCKWISE
from .lobby import CookedShape, HostedGame, Lobby, Piece
from .packets import build_lobby_player_left, pack_5bit

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

#: Ceiling on one wall-clock catch-up batch. These samples keep ordinary
#: gravity synchronized with the client; bot fast-drop speed is limited
#: separately below rather than starving the whole simulation.
MAX_CATCHUP_SAMPLES = 20

#: A clearing bot may pulse FAST_DROP once per this many engine ticks after it
#: has reached its target column/orientation. Continuous FAST_DROP crosses the
#: bucket in roughly 0.7 seconds; this cap produces a controlled descent while
#: still letting the bot commit its placement.
BOT_FAST_DROP_PERIOD_TICKS = 10

#: Chance that a bot spends a whole turn holding fast drop. Deliberately well
#: under 1: holding it permanently (which is what the bot used to do, on 99% of
#: samples) makes its replica cross the bucket in ~0.7s and look frantic beside
#: a human board falling at base gravity.
FAST_DROP_TURN_CHANCE = 0.3
BOT_STRATEGY = os.environ.get("DEKOBLOKO_BOT_STRATEGY", "clear").strip().lower()


class BotLobbySession:
    """Socket-free :class:`LobbySession` for a lobby-resident bot.

    Mirrors ``dekobloko_demo.DummyLobbySession``: every ``send_*`` sink is a
    no-op except :meth:`send_piece_event`, which acknowledges the piece
    transition so the match keeps advancing for the bot's slot (a real client
    acks by drawing the piece; without it the engine would wait forever).
    """

    is_bot = True

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

    def send_elimination_order(self, player_slot: int) -> None:
        return

    def send_full_state(self, player_slot: int, state_payload: bytes) -> None:
        return

    def send_match_result(self, winner_slot: int) -> None:
        return

    def send_rematch_state(self, player_mask: int) -> None:
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
        self._plans: dict[str, tuple[int, int, int]] = {}
        self._fast_drop_phase: dict[str, int] = {}
        self.rng = random.Random(seed)
        self.bots = [BotLobbySession(name) for name in names]
        self._available_bots = set(self.bots)
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
            + f" strategy={BOT_STRATEGY}"
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
                if bot not in self._available_bots:
                    self._available_bots.add(bot)
                    self._broadcast_bot_lobby_presence(bot, entered=True)
                self._maybe_accept_invite(bot, games)
            elif game.state == "playing":
                self._play_turn(bot, game)
            elif game.state == "finished":
                self._fed_through.pop(bot.display_name, None)
                self._plans.pop(bot.display_name, None)
                # A human dismissal cancels the rematch. Release bots before
                # considering another vote, otherwise the last bot vote can
                # make the reduced roster unanimous and start a bot-only game.
                pending = getattr(game, "awaiting_dismissal", None)
                if pending is not None and all(
                    player in self.bots for player in pending
                ):
                    self.lobby.leave_game(bot, announce=False)
                    continue

                rematch_mask = getattr(game, "rematch_mask", 0)
                slot = bot.player_slot
                if (
                    slot is not None
                    and rematch_mask & (1 << slot) == 0
                ):
                    # Each bot owns its vote just like a socket player. It asks
                    # independently on entering the result screen; the server's
                    # unanimous player mask keeps the game stopped until the
                    # final human accepts.
                    game.handle_rematch_action(bot)
                    continue

                # Keep bots attached while a human is viewing the results; that
                # gives the human's Offer button a roster that can accept. Once
                # every human has dismissed, only bots remain pending and they
                # can tear themselves down without pinning the room forever.
                pending = getattr(game, "awaiting_dismissal", None)
                if pending is not None and all(
                    player in self.bots for player in pending
                ):
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
                if bot.current_game is game:
                    self._available_bots.discard(bot)
                    self._broadcast_bot_lobby_presence(bot, entered=False)
                    print(
                        f"[bots] {bot.display_name} accepted invite to game "
                        f"{game.game_id}"
                    )
                    return

    def _broadcast_bot_lobby_presence(
        self, bot: BotLobbySession, *, entered: bool
    ) -> None:
        uid = self.lobby.uid_for(bot.display_name)
        with self.lobby._lock:
            recipients = [
                session
                for session in self.lobby._sessions
                if getattr(session, "_lobby_bootstrapped", False)
            ]
            row = next(
                (row for row in self.lobby.roster_rows() if row[0] == uid),
                None,
            )

        if entered:
            if row is None:
                return
            for recipient in recipients:
                recipient.send_lobby_roster([row])
        else:
            payload = build_lobby_player_left(uid)
            for recipient in recipients:
                recipient.send_lobby_event(payload)

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
            self._plans.pop(bot.display_name, None)
            return

        with game._lock:
            engine = game.engine
            slot = bot.player_slot
            active = (
                engine.players[slot].active
                if engine is not None
                and slot is not None
                and 0 <= slot < len(engine.players)
                else None
            )
        if active is None:
            # Pop/collapse animations have no active falling piece. Do not bill
            # those wall-clock ticks to the next piece as catch-up controls.
            self._fed_through[bot.display_name] = time.monotonic()
            self._plans.pop(bot.display_name, None)
            return

        owed = self._samples_owed(bot)
        if BOT_STRATEGY == "random":
            controls = self._random_controls(owed)
        else:
            controls = self._clearing_controls(bot, game, active, owed)
        game.handle_controls(bot, bytes([len(controls)]) + pack_5bit(controls))

    def _random_controls(self, owed: int) -> list[int]:
        """The original unguided strategy, retained behind an environment gate."""
        # Do NOT hold fast drop for the whole match. The bot used to set it on
        # every sample -- measured at 99% of them -- and once the relay stopped
        # swallowing the bit, replicas faithfully reproduced it: an opponent's
        # piece crossed all 18 rows in about 0.7s (2 ticks a row) for the entire
        # game. That reads as chaos next to the player's own bucket, which falls
        # at base gravity (40 ticks a row) unless they press the key.
        #
        # Dropping for a whole turn at a time, some of the time, is what a
        # person actually does: steer for a moment, then commit. At the default
        # 0.08s turn a dropping turn advances the piece ~2 rows and a coasting
        # one ~0.1, so roughly a third gives a piece a ~3s descent.
        dropping = self.rng.random() < FAST_DROP_TURN_CHANCE
        controls = [FAST_DROP if dropping else 0] * owed
        # Steer more than before, too. A bot that almost never moves sideways
        # builds one central tower and tops out -- which is what ended a match
        # in a couple of ticks, since a lost life does not clear the bucket.
        roll = self.rng.randrange(6)
        if roll == 0:
            controls[0] |= LEFT
        elif roll == 1:
            controls[0] |= RIGHT
        elif roll == 2:
            controls[0] |= ROTATE_CLOCKWISE
        return controls

    def _clearing_controls(
        self,
        bot: BotLobbySession,
        game: HostedGame,
        active: object,
        owed: int,
    ) -> list[int]:
        """Steer one piece toward the best cheap authoritative placement."""
        plan = self._plans.get(bot.display_name)
        if plan is None or plan[0] != id(active):
            with game._lock:
                target_orientation, target_x = self._best_placement(game, active)
            plan = (id(active), target_orientation, target_x)
            self._plans[bot.display_name] = plan
            self._fast_drop_phase[bot.display_name] = 0

        _piece_id, target_orientation, target_x = plan
        controls = [0] * owed
        if active.orientation != target_orientation:
            controls[0] = ROTATE_CLOCKWISE
        elif active.x > target_x:
            controls[0] = LEFT
        elif active.x < target_x:
            controls[0] = RIGHT
        else:
            phase = self._fast_drop_phase.get(bot.display_name, 0)
            controls = [
                FAST_DROP
                if (phase + tick) % BOT_FAST_DROP_PERIOD_TICKS == 0
                else 0
                for tick in range(owed)
            ]
            self._fast_drop_phase[bot.display_name] = phase + owed
        return controls

    def _best_placement(self, game: HostedGame, active: object) -> tuple[int, int]:
        """Evaluate every hard-drop landing using the real cascade resolver.

        This is O(4 * bucket_width * bucket_cells) once per piece. It is not a
        look-ahead tree: no future pieces, opponent states, or input sequences
        are searched.
        """
        engine = game.engine
        if engine is None:
            return active.orientation, active.x

        board = active.board
        best_score: tuple[int, int, int] | None = None
        best_target = (active.orientation, active.x)
        base_fill = board.occupied_count()

        for orientation in range(4):
            oriented = active._oriented(orientation)
            min_dx = min(dx for dx, _dy, _cell in oriented)
            max_dx = max(dx for dx, _dy, _cell in oriented)
            max_dy = max(dy for _dx, dy, _cell in oriented)
            for pivot_x in range(-min_dx, board.width - max_dx):
                pivot_y = -max_dy - 1
                while not active._collides(orientation, pivot_x, pivot_y + 1):
                    pivot_y += 1

                positions = {
                    (pivot_x + dx, pivot_y + dy): cell
                    for dx, dy, cell in oriented
                    if 0 <= pivot_y + dy < board.height
                }
                overflow = any(pivot_y + dy < 0 for _dx, dy, _cell in oriented)
                if overflow or not positions:
                    score = (-1_000_000, -abs(pivot_x), -orientation)
                else:
                    candidate = copy.deepcopy(board)
                    if active.is_domino:
                        for (x, y), cell in positions.items():
                            candidate.set(x, y, cell)
                    else:
                        colours = {
                            cell & 7
                            for cell in positions.values()
                            if 8 <= (cell & 31) <= 14
                        }
                        if len(colours) == 1:
                            candidate.merge_solid(
                                set(positions), next(iter(colours))
                            )
                        else:
                            for (x, y), cell in positions.items():
                                candidate.set(x, y, cell)

                    contact_score = self._matching_contacts(
                        board, positions
                    )
                    engine._resolve_cascades(candidate)
                    fill_after = candidate.occupied_count()
                    cleared = base_fill + len(positions) - fill_after
                    heights, holes = self._board_profile(candidate)
                    max_height = max(heights, default=0)
                    roughness = sum(
                        abs(left - right)
                        for left, right in zip(heights, heights[1:])
                    )
                    numeric = (
                        cleared * 1_000
                        + contact_score * 35
                        - holes * 120
                        - max_height * 25
                        - roughness * 8
                        - fill_after * 3
                    )
                    top_x = pivot_x + min_dx
                    score = (
                        numeric,
                        -abs((top_x * 2) - (board.width - 1)),
                        -orientation,
                    )

                if best_score is None or score > best_score:
                    best_score = score
                    best_target = (orientation, pivot_x + min_dx)

        return best_target

    @staticmethod
    def _matching_contacts(
        board: object, positions: dict[tuple[int, int], int]
    ) -> int:
        contacts = 0
        for (x, y), cell in positions.items():
            value = cell & 31
            if not 16 <= value <= 23:
                continue
            colour = value & 7
            for next_x, next_y in (
                (x - 1, y),
                (x + 1, y),
                (x, y - 1),
                (x, y + 1),
            ):
                neighbour = positions.get((next_x, next_y))
                if neighbour is None and 0 <= next_x < board.width and 0 <= next_y < board.height:
                    neighbour = board.get(next_x, next_y)
                if neighbour is None:
                    continue
                neighbour &= 31
                if (
                    16 <= neighbour <= 23
                    and (
                        colour == (neighbour & 7)
                        or value == 23
                        or neighbour == 23
                    )
                ):
                    contacts += 1
        return contacts

    @staticmethod
    def _board_profile(board: object) -> tuple[list[int], int]:
        heights: list[int] = []
        holes = 0
        for x in range(board.width):
            top = board.height
            seen = False
            for y in range(board.height):
                occupied = board.get(x, y) != 0
                if occupied and not seen:
                    top = y
                    seen = True
                elif seen and not occupied:
                    holes += 1
            heights.append(board.height - top)
        return heights, holes


def bots_enabled() -> bool:
    return os.environ.get("DEKOBLOKO_BOTS") == "1"


def bot_names_from_env() -> tuple[str, ...]:
    """Bot names from ``DEKOBLOKO_ROSTER_NAMES`` (comma-separated), else default."""
    raw = os.environ.get("DEKOBLOKO_ROSTER_NAMES", "")
    names = tuple(name.strip() for name in raw.split(",") if name.strip())
    return names or DEFAULT_BOT_NAMES
