from __future__ import annotations

from dataclasses import dataclass, field
import itertools
import json
import os
import random
from pathlib import Path
import threading
import time
import hashlib
import zlib
from typing import Protocol

from .packets import PacketBuilder, pack_5bit


class LobbySession(Protocol):
    display_name: str
    current_game: "HostedGame | None"
    player_slot: int | None

    def send_server_message(self, message: str) -> None:
        ...

    def send_lobby_bootstrap(self) -> None:
        ...

    def send_lobby_roster(self, rows: list[tuple[int, str, int, int]]) -> None:
        ...

    def send_local_player_id(self, uid: int) -> None:
        ...

    def send_match_start(self, game: "HostedGame", local_slot: int) -> None:
        ...

    def send_piece_event(self, player_slot: int, piece: "Piece", speed_index: int) -> None:
        ...

    def send_queued_piece(self, player_slot: int, piece: "Piece") -> None:
        ...

    def send_action_stream(self, player_slot: int, controls_payload: bytes) -> None:
        ...

    def send_player_removed(self, player_slot: int, result_code: int) -> None:
        ...


@dataclass(frozen=True)
class GameOptions:
    bucket_large: bool = False
    speed_index: int = 2
    bombardment_level: int = 1
    colours: int = 4
    special_level: int = 0
    allow_spectators: bool = True
    rated: bool = False
    theme: int = 0

    def settings_word(self) -> int:
        word = self.speed_index & 0xF
        word |= (self.bombardment_level & 0x3) << 4
        word |= (self.colours & 0x7) << 6
        word |= (self.special_level & 0x7) << 9
        if self.bucket_large:
            word |= 0x1000
        if self.allow_spectators:
            word |= 0x2000
        if self.rated:
            word |= 0x8000
        return word & 0xFFFF


@dataclass(frozen=True)
class Piece:
    piece_id: int
    width: int
    height: int
    cells: tuple[int, ...]
    descriptor: int

    def encode_rf(self) -> bytes:
        if len(self.cells) != self.width * self.height:
            raise ValueError("piece cell count does not match piece dimensions")
        return (
            PacketBuilder()
            .varint7(self.piece_id)
            .u8(self.width)
            .u8(self.height)
            .raw(pack_5bit(list(self.cells)))
            .finish()
        )


@dataclass
class HostedGame:
    game_id: int
    host: LobbySession
    options: GameOptions = field(default_factory=GameOptions)
    players: list[LobbySession] = field(default_factory=list)
    state: str = "waiting"
    created_at: float = field(default_factory=time.time)
    piece_counter: int = 0
    rng: random.Random = field(default_factory=random.Random)
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def __post_init__(self) -> None:
        seed = (self.game_id << 32) ^ int(self.created_at * 1000)
        self.rng.seed(seed)
        self.add_player(self.host)

    @property
    def names(self) -> list[str]:
        return [player.display_name for player in self.players]

    def active_mask(self) -> int:
        mask = 0
        for index, _player in enumerate(self.players[:8]):
            mask |= 1 << index
        return mask

    def add_player(self, session: LobbySession) -> int:
        with self._lock:
            if self.state != "waiting":
                raise ValueError("cannot join a game that has already started")
            if session in self.players:
                return self.players.index(session)
            if len(self.players) >= 8:
                raise ValueError("Dekobloko multiplayer supports at most 8 players")
            self.players.append(session)
            slot = len(self.players) - 1
            session.current_game = self
            session.player_slot = slot
            return slot

    def remove_player(self, session: LobbySession) -> None:
        with self._lock:
            if session not in self.players:
                return
            slot = self.players.index(session)
            self.players.remove(session)
            session.current_game = None
            session.player_slot = None
            for index, player in enumerate(self.players):
                player.player_slot = index
            if self.state == "playing":
                self._broadcast_player_removed(slot, 0)

    def start(self) -> None:
        with self._lock:
            if self.state == "playing":
                return
            if not self.players:
                raise ValueError("cannot start a game with no players")
            self.state = "playing"
            players = list(self.players)

        for index, player in enumerate(players):
            player.send_match_start(self, index)

        self.broadcast_message(f"Game {self.game_id} started with {len(players)} player(s).")

        # Send one active piece and one queued piece for every player. Packet 64
        # is BELIEVED to start the currently falling piece and 67 to fill the
        # client's queue -- read off the decompiled client, never observed. No
        # match has ever started, so this loop has never run against a client.
        # If multiplayer is ever reached, expect to debug this from scratch:
        # the piece counts, the ordering, and whether every player should see
        # every other player's pieces are all assumptions.
        for slot, _player in enumerate(players):
            active = self.next_piece()
            queued = self.next_piece()
            self.broadcast_piece_event(slot, active)
            self.broadcast_queued_piece(slot, queued)

    def next_piece(self) -> Piece:
        with self._lock:
            piece_id = self.piece_counter
            self.piece_counter += 1

        colour_count = max(1, min(7, self.options.colours))
        colour_a = self.rng.randrange(colour_count)
        colour_b = self.rng.randrange(colour_count)
        if colour_a == colour_count:
            colour_a = 7
        if colour_b == colour_count:
            colour_b = 7
        descriptor = ((colour_a & 0x7) << 4) | (colour_b & 0x7)

        shape = self.rng.choice(
            [
                (2, 2, (1, 1, 1, 1)),
                (3, 2, (2, 0, 0, 2, 2, 2)),
                (3, 2, (0, 3, 0, 3, 3, 3)),
                (3, 2, (0, 4, 4, 4, 4, 0)),
                (3, 2, (5, 5, 0, 0, 5, 5)),
                (4, 1, (6, 6, 6, 6)),
            ]
        )
        width, height, cells = shape
        remapped = tuple(0 if cell == 0 else 1 + ((cell - 1) % colour_count) for cell in cells)
        return Piece(piece_id=piece_id, width=width, height=height, cells=remapped, descriptor=descriptor)

    def broadcast_message(self, message: str) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_send_message(player, message)

    def broadcast_chat(self, sender: LobbySession, message: str) -> None:
        self.broadcast_message(f"[game {self.game_id}] {sender.display_name}: {message}")

    def broadcast_piece_event(self, player_slot: int, piece: Piece) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_call(lambda p=player: p.send_piece_event(player_slot, piece, self.options.speed_index))

    def broadcast_queued_piece(self, player_slot: int, piece: Piece) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_call(lambda p=player: p.send_queued_piece(player_slot, piece))

    def handle_controls(self, sender: LobbySession, payload: bytes) -> None:
        slot = sender.player_slot
        if slot is None:
            return
        with self._lock:
            players = [player for player in self.players if player is not sender]
        for player in players:
            _safe_call(lambda p=player: p.send_action_stream(slot, payload))

        # GUESSWORK, and the weakest thing in this file. The claim is that
        # packet 60 arrives either after 20 input samples or when the local
        # piece locks, so a short payload means a lock and warrants handing out
        # a new piece. Nothing verifies that: no client has ever sent packet 60
        # to this server. The "< 20" threshold in particular is a heuristic
        # standing in for a lock signal we have not located in the client.
        #
        # If pieces ever duplicate, vanish, or arrive at the wrong time in a
        # real match, suspect this branch first rather than the piece encoding.
        if payload and payload[0] < 20:
            self.broadcast_piece_event(slot, self.next_piece())
            self.broadcast_queued_piece(slot, self.next_piece())

    def handle_piece_request(self, sender: LobbySession) -> None:
        slot = sender.player_slot
        if slot is None:
            return
        self.broadcast_piece_event(slot, self.next_piece())
        self.broadcast_queued_piece(slot, self.next_piece())

    def _broadcast_player_removed(self, slot: int, result_code: int) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_call(lambda p=player: p.send_player_removed(slot, result_code))

    def end_game(self, winner: LobbySession | None, result_code: int = 0) -> None:
        """Finish the game: per-player results first, then teardown.

        ORDER IS LOAD-BEARING and is the whole reason this is one method:

          1. opcode 62 for every loser  (removes the slot, fires the defeat UI)
          2. opcode 69 to the winner    (sets qc.field_r, pushes the win UI)
          3. opcode 60 to everyone      (tears the game down)

        Opcode 60 clears the state the other two refer to, so sending it first
        strands the results and the client shows nothing.

        Proven vs not: the BYTE LAYOUTS of 62/69/60 are execution-proven, and 60
        genuinely carries no body. The handler EFFECTS -- slot nulling, the
        active-count decrement, the defeat/win UI, the teardown clearing
        fm.field_b / am.field_c / fa.field_n -- were read from bytecode but never
        run, because driving them needs AWT. So this ordering is reasoned from a
        static read, not measured. If the end-of-game screen misbehaves, suspect
        this ordering first.
        """
        with self._lock:
            if self.state != "playing":
                return
            players = list(self.players)
            self.state = "finished"

        for player in players:
            if player is winner:
                continue
            slot = player.player_slot
            if slot is not None:
                self._broadcast_player_removed(slot, result_code)

        if winner is not None:
            _safe_call(lambda: winner.send_winner(result_code))

        for player in players:
            _safe_call(lambda p=player: p.send_game_over())

        print(
            f"[game] game {self.game_id} ended; winner="
            f"{winner.display_name if winner else 'none'}"
        )


# How many scores to keep per player per board. The client's request asked for
# rows=10, so anything beyond that can never be displayed.
MAX_SCORES_PER_BOARD = 10


class Lobby:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sessions: set[LobbySession] = set()
        self._games: dict[int, HostedGame] = {}
        self._game_ids = itertools.count(1)
        # Room ids for the experimental CREATE_UNRATED_GAME path. u16 on the
        # wire (build_create_room_reply), so keep it in range.
        self._room_ids = itertools.count(1)
        # Bot presences: fake lobby players so a single real client has someone
        # to see and invite. Enabled with DEKOBLOKO_BOTS=1. They appear in the
        # roster and auto-accept an invite to the host's room. Names must have
        # accounts so uid_for/player_id line up with what the client compares.
        self._bots: list[str] = (
            ["Player1", "Player2", "Player3"]
            if os.environ.get("DEKOBLOKO_BOTS") == "1"
            else []
        )
        # board -> {player_name: best_score}. Persisted, so scores survive a
        # restart. Kept as best-per-player rather than an append log because the
        # client asks for a top-N table, not a history.
        self._scores: dict[str, list[int]] = {}
        self._scores_path = Path("hiscores.json")
        self._load_scores()
        # player -> sorted list of earned achievement indices (0..30).
        #
        # The server is the authority here, not a mirror: the client shows a
        # popup locally the moment you earn one, then expects the server to hand
        # the confirmed mask back at login (server opcode 75, client.java:761).
        # Without this file achievements vanish on every restart.
        self._achievements: dict[str, list[int]] = {}
        self._achievements_path = Path("achievements.json")
        self._load_achievements()
        # player -> highest stamina stage index reached (0-based).
        #
        # This is what gates the Master Challenge button. The client zeroes its
        # own copy on logout (s.java:359) and asks us for it at login
        # (dc.java:359 -> ub.a -> client opcode 5 request), so if we do not
        # store and return it, the button is grey every session.
        self._progress: dict[str, int] = {}
        self._progress_path = Path("progress.json")
        self._load_progress()

    # Achievement display names, qk.java:586 (qk.field_s). Index order IS the
    # wire order -- index 0 is the one the client sends as field_v.
    ACHIEVEMENT_NAMES = [
        "Deko Bloko", "Double Deko", "Triple Deko", "Mega Deko", "Double Bloko",
        "Triple Bloko", "Mini Bombo", "Maxi Bombo", "Tower Bloko",
        "Massive Attako", "Clean Sweepo", "Uh-Oh Bloko", "Floral Bloko",
        "Urban Bloko", "Retro Bloko", "Bronze Blokker", "Silver Blokker",
        "Gold Blokker", "Blok of Beginning", "Blok of Victory",
        "Blok of Supremacy", "Deko Pwnage", "Ultimate Pwnage", "Quick Deko",
        "Safe Deko", "Deko Modo", "Shape Mover", "Shape Sender",
        "Shape Dispatcher", "Shape Consigner", "Shape Shifter",
    ]

    # Master Challenge unlocks at stage index >= 3 (vk.java:671), which the
    # in-game hint calls "Stage 4" because the index is 0-based.
    MASTER_CHALLENGE_STAGE = 3

    def _load_progress(self) -> None:
        """Load persisted stamina progress. A missing or corrupt file is not fatal."""
        try:
            raw = json.loads(self._progress_path.read_text("utf-8"))
        except FileNotFoundError:
            return
        except (OSError, ValueError) as exc:
            print(f"[prog] could not read {self._progress_path}: {exc}")
            return
        if isinstance(raw, dict):
            for name, stage in raw.items():
                if isinstance(stage, int) and stage >= 0:
                    self._progress[name] = stage

    def _save_progress(self) -> None:
        try:
            self._progress_path.write_text(
                json.dumps(self._progress, indent=2, sort_keys=True) + "\n", "utf-8"
            )
        except OSError as exc:
            print(f"[prog] could not write {self._progress_path}: {exc}")

    def progress_for(self, player: str) -> int:
        """Highest stamina stage index this player has reached."""
        with self._lock:
            return self._progress.get(player, 0)

    def record_progress(self, player: str, stage: int) -> None:
        """Store progress as the client's own COUNTER, not the stage index.

        id.field_P is a count of confirmed progress records, not a stage index.
        The client's guard (qc.java:638-645) is:

            if (field_ab >= 3)          skip     <- stages 3+ NEVER upload
            if (field_ab != id.field_P) skip     <- strictly sequential
            upload ff(0, field_ab); id.field_P++

        So clearing stages 0,1,2 walks the counter 0 -> 1 -> 2 -> 3, and 3 is
        exactly what vk.java:671 tests for. We must therefore store stage + 1:
        storing the raw index caps us at 2 and the Master Challenge can never
        unlock, no matter how far the player actually gets. Stage 12 looks the
        same as stage 3 here, because the client stops reporting after index 2.

        Max rather than last-write because the client itself restores with
        `if (id.field_P < var1_int) id.field_P = var1_int` (dc.java:371) -- it
        never lowers progress, so neither do we.
        """
        if stage < 0:
            print(f"[prog] {player} negative stage {stage} -- ignored")
            return
        counter = stage + 1
        with self._lock:
            previous = self._progress.get(player, 0)
            if counter <= previous:
                print(
                    f"[prog] {player} stage {stage} -> counter {counter} "
                    f"<= stored {previous} -- kept {previous}"
                )
                return
            self._progress[player] = counter
            self._save_progress()
        unlocked = counter >= self.MASTER_CHALLENGE_STAGE
        if unlocked and previous < self.MASTER_CHALLENGE_STAGE:
            note = "Master Challenge UNLOCKED"
        elif unlocked:
            note = "Master Challenge unlocked"
        else:
            need = self.MASTER_CHALLENGE_STAGE - counter
            note = f"still locked -- {need} more stage(s) to report"
        print(
            f"[prog] {player} cleared stage index {stage} -> counter {counter} "
            f"(was {previous}) -- {note}"
        )

    def _load_achievements(self) -> None:
        """Load persisted achievements. A missing or corrupt file is not fatal."""
        try:
            raw = json.loads(self._achievements_path.read_text("utf-8"))
        except FileNotFoundError:
            return
        except (OSError, ValueError) as exc:
            print(f"[achv] could not read {self._achievements_path}: {exc}")
            return
        if isinstance(raw, dict):
            for name, earned in raw.items():
                if isinstance(earned, list):
                    self._achievements[name] = sorted(
                        {i for i in earned if isinstance(i, int) and 0 <= i < 31}
                    )

    def _save_achievements(self) -> None:
        try:
            self._achievements_path.write_text(
                json.dumps(self._achievements, indent=2, sort_keys=True) + "\n",
                "utf-8",
            )
        except OSError as exc:
            print(f"[achv] could not write {self._achievements_path}: {exc}")

    def allocate_room_id(self) -> int:
        """Next room id for the experimental create-room path (u16, wraps)."""
        with self._lock:
            return (next(self._room_ids) & 0xFFFF) or 1

    def achievements_for(self, player: str) -> list[int]:
        with self._lock:
            return list(self._achievements.get(player, []))

    def record_earned_achievement(self, player: str, index: int) -> bool:
        """Persist one achievement index. True if it was newly earned.

        Sent by the client as opcode 4 carrying a `ki` record; the index is
        field_v. Duplicates are expected and harmless -- the client re-sends
        from its queue until acked -- so this is idempotent by construction.
        """
        if not 0 <= index < 31:
            print(f"[achv] {player} index {index} out of range 0..30 -- ignored")
            return False
        name = self.ACHIEVEMENT_NAMES[index]
        with self._lock:
            earned = self._achievements.setdefault(player, [])
            if index in earned:
                print(f"[achv] {player} re-sent {index} ({name}) -- already held")
                return False
            earned.append(index)
            earned.sort()
            self._save_achievements()
        print(f"[achv] {player} EARNED {index} ({name}) -- {len(earned)}/31 total")
        return True

    def _load_scores(self) -> None:
        """Load persisted scores. A missing or corrupt file is not fatal."""
        try:
            raw = json.loads(self._scores_path.read_text("utf-8"))
        except FileNotFoundError:
            return
        except (OSError, ValueError) as exc:
            print(f"[hiscore] could not read {self._scores_path}: {exc}; starting empty")
            return
        def entry(item: object) -> list[int]:
            # Accept the older forms so scores written before the wire value was
            # kept are not discarded. Where the raw value was never stored, it is
            # reconstructed as (score << 8) -- that is the observed packing, and
            # a reconstructed raw beats a 0 that would render the score as 0.
            if isinstance(item, (list, tuple)):
                score = int(item[0])
                raw = int(item[1]) if len(item) > 1 else 0
                return [score, raw if raw > 0xFF else score << 8]
            score = int(item)  # type: ignore[arg-type]
            return [score, score << 8]

        try:
            self._scores = {
                str(player): [entry(s) for s in scores] for player, scores in raw.items()
            }
        except (AttributeError, TypeError, ValueError) as exc:
            print(f"[hiscore] {self._scores_path} is malformed: {exc}; starting empty")
            self._scores = {}
            return
        total = sum(len(s) for s in self._scores.values())
        print(f"[hiscore] loaded {total} score(s) for {len(self._scores)} player(s)")

    def _save_scores(self) -> None:
        """Write scores out. Caller must hold the lock."""
        try:
            self._scores_path.write_text(json.dumps(self._scores, indent=2), "utf-8")
        except OSError as exc:
            # Never let a disk problem kill the session -- the in-memory table
            # is still correct and the client is waiting on an ack.
            print(f"[hiscore] WARNING could not write {self._scores_path}: {exc}")

    def record_score(self, player: str, score: int, raw: int) -> None:
        """Append one score to this player's table.

        DELIBERATELY NOT PER-BOARD. The submitted record carries no field that
        has been identified as a board id, so there is nothing to key on.
        The low byte of values[0] was tried and REFUTED by testing: two stamina
        games produced flag=1 and flag=0, so it varies within a single game mode
        and cannot be the board. Filing scores under it sent them to board 0
        while the client was reading board 1, and they never appeared.

        Until a real board field is identified, one table per player is served
        for every requested key. The cost is that different game modes would
        share a table; the benefit is that scores actually show up. That trade
        is deliberate and should be revisited once the board field is known --
        a Master Challenge score is the sample that would reveal it.

        A LIST per player, not a single best, because of how the client renders
        the table. Entry names are not on the wire: ke.java:136 reads a u8
        columnIndex and takes the name from rc.field_c[columnIndex].field_i,
        and ke.java:105 sets column 0's name to oa.field_f -- the local player.
        With the single-column table (count == 1) that is the only valid column,
        so EVERY row displays the requesting player's own name. The table is
        therefore "your top N scores", not a cross-player leaderboard.
        """
        entry = [score, raw]
        with self._lock:
            scores = self._scores.setdefault(player, [])
            scores.append(entry)
            scores.sort(key=lambda e: e[0], reverse=True)
            del scores[MAX_SCORES_PER_BOARD:]
            rank = scores.index(entry) + 1 if entry in scores else None
            self._save_scores()
        where = f"rank {rank}" if rank else f"below the top {MAX_SCORES_PER_BOARD}"
        print(f"[hiscore] {player} scored {score} (raw {raw}) -- stored ({where})")

    def hiscore_rows(
        self, key: int, rows: int, vcols: int, player: str | None = None
    ) -> list[tuple[int, int, list[int]]]:
        """Rows for a hiscore table request (client opcode 3, sub-command 5).

        Returns (column_index, score, values) tuples for build_hiscore_table.

        EVERY row uses column index 0. That is not a simplification: with the
        single-column table the client takes each row's name from
        rc.field_c[columnIndex].field_i, and column 0's name is set to
        oa.field_f -- the local player. Any other index would read an unset
        column. So the table shows the requesting player's own scores, which is
        why `player` selects whose list to serve.

        Only the single-board shape is execution-proven, so this deliberately
        never returns extra columns: the count > 1 path adds per-column name
        strings that were read from the handler but never actually run. Serving
        an empty table is a valid, proven response -- the client accepts
        entryCount = 0 -- so an unknown board yields no rows rather than a guess.

        THE SCORE THE PLAYER SEES COMES FROM values[0], NOT THE i64 score.
        The i64 is never rendered; sending a bare 0 in values made a stored
        1090 render as "0".

        values[0] is ECHOED BACK VERBATIM, exactly as the client submitted it.
        That is deliberate: the field is packed, carrying at least a score and
        a stage, and the packing is only partly understood. Decoding it and
        re-encoding it means every unknown bit gets destroyed -- an attempt to
        re-pack as (score * 8 + label) turned a real 1090 into "stage 57,
        score 34", because both the divisor and the extra fields were guessed
        wrong.

        Echoing needs no knowledge of the layout and cannot corrupt fields we
        have not identified. The client packed it; the client unpacks it.

        The score IS decoded (values[0] >> 8), but only to sort and log --
        never to rebuild the wire value.

        The requested `key` is echoed back by the caller but does NOT select a
        table: see record_score for why scores are not stored per board yet.
        Every board therefore shows the same list.
        """
        if player is None:
            return []
        with self._lock:
            stored = list(self._scores.get(player, ()))
        out: list[tuple[int, int, list[int]]] = []
        for score, raw in stored[: max(0, rows)]:
            values = [0] * max(0, vcols)
            if values:
                values[0] = raw          # verbatim; see the docstring
            out.append((0, score, values))
        return out

    def record_achievement(self, session: LobbySession, payload: bytes) -> None:
        """Record one SCORE submission (client opcode 3, sub-command 1).

        NOT an achievement record, despite the name kept here for its callers.
        This carries a `kn`, built by qc.c(boolean) from
        `this.field_g.field_p[0].a(0)` -- the end-of-game score. Achievements
        are a different record type (`ki`) on a different opcode: see
        record_earned_achievement().

        The field LAYOUT is proven by execution (fm.a, 38-byte frame):

            [u8 sub=1][u16 field_u][u16 field_x][u16 field_q]
            [i32 field_t][i32 field_v][i32 field_w][i32 field_y]
            [u8 count][count x i32 field_s[i]][i32 checksum]

        What those numbers MEAN is NOT proven, so they are printed under their
        obfuscated `kn.field_*` names rather than being given invented labels
        like "achievement id" or "score". Naming them would turn a guess into
        something that reads like a fact in the log.

        The ack is what actually matters for client liveness and is sent by the
        caller regardless of what happens here: the client blocks on the ack,
        not on us understanding the contents. Persisting is a separate problem
        and this is deliberately in-memory.
        """
        who = session.display_name
        fields = self._decode_achievement(payload)
        if fields is None:
            print(
                f"[stats] {who} achievement record {len(payload)} bytes "
                f"-- TOO SHORT to decode: {payload.hex(' ')}"
            )
            return

        print(
            f"[stats] {who} achievement record ({len(payload)} bytes)"
            f"  id(field_u)={fields['u']}"
            f" field_x={fields['x']} field_q={fields['q']}"
        )
        print(
            f"[stats] {who}   field_t={fields['t']} field_v={fields['v']}"
            f" field_w={fields['w']} field_y={fields['y']}"
        )
        # values[0] packs the score together with a small counter, but there are
        # TWO packings and field_x selects between them. Proven by reading the
        # client's own builder, qc.c(boolean) at qc.java:3038-3050:
        #
        #   field_x == 0 (field_q 65535):  values[0] = 8 * score + field_bb
        #   field_x == 1 (field_q 65534):  values[0] = score * 256 + field_ab
        #
        # kn's constructor (kn.java:157-169) maps param0 -> field_x and
        # param1 -> field_q, so the two `new kn(0, 65535, ...)` and
        # `new kn(1, 65534, ...)` call sites are exactly these two variants.
        #
        # Applying the >> 8 variant to EVERY record was a real bug: a variant-A
        # record decoded as 384443 >> 8 = 1501 with a low byte of 187, which the
        # client would render as "stage 188" -- impossible for stamina. Read as
        # variant A the same bytes give 8 * 48055 + 3, an in-range counter.
        # A wrong-but-plausible score is worse than none, so branch on field_x
        # and refuse to guess when it is neither known value.
        if fields["values"]:
            raw = fields["values"][0]
            variant = fields["x"]
            if variant == 1:
                score, extra = raw >> 8, raw & 0xFF
                shape = "score * 256 + field_ab"
                extra_name = "field_ab (stage index, rendered stage+1)"
            elif variant == 0:
                score, extra = divmod(raw, 8)
                shape = "8 * score + field_bb"
                extra_name = "field_bb (0..7 counter, rendered N+1/8)"
            else:
                score = extra = None
                shape = extra_name = ""

            if score is None:
                # An unknown discriminator means an unproven packing. Log the
                # raw value and store nothing rather than invent a score.
                print(
                    f"[stats] {who}   NOT stored: unknown field_x={variant} "
                    f"-- packing of values[0]={raw} is not proven"
                )
            else:
                print(
                    f"[stats] {who}   -> score={score} {extra_name}={extra} "
                    f"(field_x={variant}: values[0]={raw} = {shape})"
                )
                if score >= 0:
                    self.record_score(who, score, raw)
                else:
                    # Negative would mean the packing interpretation is wrong.
                    # Say so instead of storing nonsense.
                    print(f"[stats] {who}   NOT stored: negative score from {raw}")

        print(
            f"[stats] {who}   values[{len(fields['values'])}]={fields['values']}"
            f" checksum={fields['checksum']:#010x}"
        )
        if fields["trailing"]:
            # Not an error -- just the honest signal that the proven layout did
            # not account for every byte the client sent.
            print(f"[stats] {who}   UNPARSED TAIL: {fields['trailing'].hex(' ')}")

    @staticmethod
    def _decode_achievement(payload: bytes) -> dict | None:
        """Split an opcode-3/sub-1 record into its proven fields, or None.

        Returns None rather than raising or padding when the buffer is short:
        a truncated record means the framing assumption is wrong, and that is
        worth seeing in the log as-is instead of as a plausible-looking
        half-decode.
        """
        if len(payload) < 24:  # sub + 3xu16 + 4xi32 + count
            return None

        def u16(o: int) -> int:
            return int.from_bytes(payload[o : o + 2], "big")

        def i32(o: int) -> int:
            return int.from_bytes(payload[o : o + 4], "big", signed=True)

        count = payload[23]
        need = 24 + count * 4 + 4
        if len(payload) < need:
            return None

        values = [i32(24 + i * 4) for i in range(count)]
        csum_at = 24 + count * 4
        return {
            "u": u16(1),
            "x": u16(3),
            "q": u16(5),
            "t": i32(7),
            "v": i32(11),
            "w": i32(15),
            "y": i32(19),
            "values": values,
            "checksum": int.from_bytes(payload[csum_at : csum_at + 4], "big"),
            "trailing": payload[csum_at + 4 :],
        }

    def join(self, session: LobbySession) -> None:
        """Register the session only. The bootstrap is deliberately NOT sent here.

        client.n(int) loads resources across five ticks and only builds the
        lobby UI in stage 3 (mf.a -> gf.field_c at mf.java:546). Sending the
        bootstrap at login time drives bh.field_k to 14 while the client is
        still on stage 1, so client.i() dereferences the not-yet-built lobby
        object and dies with an NPE at jg.java:169 (gf.field_c.field_Ob).
        See send_bootstrap(), which is gated on the client's heartbeat.
        """
        session.current_game = None
        session.player_slot = None
        with self._lock:
            self._sessions.add(session)
            peers = list(self._sessions)
        for peer in peers:
            if peer is not session:
                _safe_send_message(peer, f"{session.display_name} has joined the lobby.")

    def sessions_snapshot(self) -> list["LobbySession"]:
        """Current lobby sessions, copied under the lock.

        Chat relay iterates this outside the lock, so it must not hand back the
        live set -- a session leaving mid-broadcast would mutate it during
        iteration.
        """
        with self._lock:
            return list(self._sessions)

    def send_bootstrap(self, session: LobbySession) -> None:
        """Send the lobby state once the client reports it is ready.

        Readiness signal: the client only starts emitting opcode 4/5 after its
        resource load completes. That much is supported -- sending earlier
        reliably produced the NPE at jg.java:169.

        Everything else here is unconfirmed. The only observation of this
        function's effect is a client that CRASHED on it; a client has never
        been seen to consume the bootstrap successfully and show a working
        lobby. So the sequence below (bootstrap, then a message, then the game
        list) is a plausible order, not a known-correct one, and the payloads it
        sends are untested. Note also that opcode 5 was recently found to be a
        request rather than a heartbeat, which means the "4/5 heartbeat pair"
        framing this docstring inherited is itself only half right.
        """
        session.send_lobby_bootstrap()
        # The roster (frame 10 / modes 23 and 5) is OPT-IN and OFF by default.
        #
        # It is the only genuinely new thing added in this session, and
        # return-to-main-menu was reported working BEFORE it and broken after.
        # Its packets are verified against the client's own parsers, but the
        # teardown path walks the same lobby structures these populate, and the
        # crash there (client.java:1598) fires when kf.field_I is null while
        # am.field_c is still true. Suspicious, not proven -- so it defaults off
        # rather than staying on by default and breaking a working button.
        #
        # Roster mode, ISOLATED BY A/B TEST against a real client:
        #
        #   both (mode 23 + mode 5)  -> roster renders, return-to-main-menu CRASHES
        #   mode 5 alone ("rows")    -> roster renders, return-to-main-menu WORKS
        #   neither                  -> no roster,      return-to-main-menu works
        #
        # So mode 5 is innocent and mode 23 (local-player id -> uc.field_g) is
        # what breaks the teardown. Default is therefore "rows": the half that
        # actually draws name and rating, without the half that crashes.
        #
        # Mode 23's only job is telling the client which roster row is itself.
        # Nothing visible depends on it today, so dropping it costs nothing
        # currently -- but it WILL matter for any feature that must distinguish
        # the local player, so this is a deferral, not a deletion.
        #
        # The crash it causes is client.java:1598, `kf.field_I.b(2, true)` with
        # kf.field_I == null while am.field_c is still true (proven by
        # reflection; the harness trap trail matches the live crash string).
        # Why setting uc.field_g leads there is NOT yet understood -- do not
        # re-enable mode 23 until it is.
        #
        #   DEKOBLOKO_ROSTER=id   mode 23 only   (for investigating the crash)
        #   DEKOBLOKO_ROSTER=1    both           (KNOWN CRASHING)
        #   DEKOBLOKO_ROSTER=off  neither
        mode = os.environ.get("DEKOBLOKO_ROSTER", "rows")
        if mode in ("1", "id"):
            session.send_local_player_id(self.uid_for(session.display_name))
        if mode in ("1", "rows"):
            session.send_lobby_roster(self.roster_rows())
        session.send_server_message("Lobby ready. Type ::help for server commands.")
        self.send_games(session)

    def roster_rows(self) -> list[tuple[int, str, int, int]]:
        """Rows for the lobby player list: (uid, name, rating, rated_games).

        The uid is a stable hash of the display name. The client uses it only
        as the roster hashtable key and to spot the local player (cl.java:645
        compares it against uc.field_g), so any stable non-colliding value
        works -- but note nothing here yet SETS uc.field_g, so the client has
        no way to tell which row is itself. That is a separate packet and is
        not implemented.

        rating and rated_games are 0 because the server does not track them.
        They cannot simply be omitted: pd.field_a is hardcoded true, so the
        Rating column always renders, and a row must carry the field. 0 is an
        honest placeholder, not a measured value.
        """
        with self._lock:
            sessions = list(self._sessions)
        rows = [(self.uid_for(o.display_name), o.display_name, 0, 0) for o in sessions]
        # Append bot presences so a lone real client has players to invite.
        rows.extend((self.uid_for(name), name, 0, 0) for name in self._bots)
        return rows

    def bot_for_uid(self, uid: int) -> str | None:
        """Return the bot display name whose roster uid matches, or None."""
        for name in self._bots:
            if self.uid_for(name) == uid:
                return name
        return None

    @staticmethod
    def uid_for(display_name: str) -> int:
        """Stable roster uid for a player name.

        MUST equal AccountStore.player_id for the same player. The client
        identifies its own lobby row -- and excludes itself from the invite
        list -- by comparing each row's id against uc.field_g, which is the
        login player id (AccountStore.player_id). This used to be a crc32 of the
        display name, a DIFFERENT value, so the client never recognised its own
        row: you could invite yourself, and your own row was treated as another
        player. Replicating player_id's derivation here (normalize, then
        sha256[:4] with the 0x10000000 tag) makes the two agree.
        """
        normalized = display_name.strip().lower()
        digest = hashlib.sha256(normalized.encode("utf-8")).digest()
        return 0x1000_0000 | (int.from_bytes(digest[:4], "big") & 0x0FFF_FFFF)

    def leave(self, session: LobbySession) -> None:
        self.leave_game(session, announce=False)
        with self._lock:
            existed = session in self._sessions
            self._sessions.discard(session)
            peers = list(self._sessions)
        if existed:
            for peer in peers:
                _safe_send_message(peer, f"{session.display_name} has left the lobby.")

    def broadcast_chat(self, sender: LobbySession, message: str) -> None:
        text = f"{sender.display_name}: {message}"
        with self._lock:
            peers = list(self._sessions)
        for peer in peers:
            _safe_send_message(peer, text)

    def handle_chat_or_command(self, sender: LobbySession, message: str) -> None:
        if message.startswith("::"):
            self._handle_command(sender, message[2:].strip())
            return
        if sender.current_game is not None:
            sender.current_game.broadcast_chat(sender, message)
            return
        self.broadcast_chat(sender, message)

    def handle_lobby_button(self, sender: LobbySession) -> None:
        game = sender.current_game
        if game is None:
            waiting = self._first_waiting_game()
            if waiting is None:
                game = self.create_game(sender)
                sender.send_server_message(f"Created game {game.game_id}. Type ::start to start it.")
            else:
                slot = waiting.add_player(sender)
                waiting.broadcast_message(f"{sender.display_name} joined game {waiting.game_id} as slot {slot}.")
            return
        if game.host is sender and game.state == "waiting":
            game.start()
            return
        if game.state == "playing":
            game.handle_piece_request(sender)
            return
        sender.send_server_message("Only the host can start this game. Type ::leave to leave it.")

    def create_game(self, host: LobbySession) -> HostedGame:
        with self._lock:
            if host.current_game is not None:
                return host.current_game
            game_id = next(self._game_ids)
            game = HostedGame(game_id=game_id, host=host)
            self._games[game_id] = game
        self._broadcast_lobby_status(f"{host.display_name} created game {game_id}.", exclude=host)
        return game

    def join_game(self, session: LobbySession, game_id: int) -> None:
        with self._lock:
            game = self._games.get(game_id)
        if game is None:
            session.send_server_message(f"No game {game_id} exists.")
            return
        if session.current_game is not None and session.current_game is not game:
            self.leave_game(session, announce=False)
        slot = game.add_player(session)
        game.broadcast_message(f"{session.display_name} joined game {game.game_id} as slot {slot}.")

    def leave_game(self, session: LobbySession, announce: bool = True) -> None:
        game = session.current_game
        if game is None:
            return
        was_host = game.host is session
        was_playing = game.state == "playing"
        game.remove_player(session)

        # A resign that leaves exactly one player standing is a WIN for them,
        # not just a departure. Routing it through end_game is what sends the
        # winner their opcode 69 and then tears the game down in the right
        # order; without this the last player sits in a finished game that
        # never resolves.
        if was_playing:
            with self._lock:
                remaining = list(game.players)
            if len(remaining) == 1:
                game.end_game(remaining[0])
        if announce:
            game.broadcast_message(f"{session.display_name} left game {game.game_id}.")
            session.send_server_message(f"Left game {game.game_id}.")
        with self._lock:
            if was_host or not game.players:
                self._games.pop(game.game_id, None)
                for player in list(game.players):
                    player.current_game = None
                    player.player_slot = None
                    _safe_send_message(player, f"Game {game.game_id} closed because the host left.")

    def start_game(self, session: LobbySession) -> None:
        game = session.current_game
        if game is None:
            game = self.create_game(session)
        if game.host is not session:
            session.send_server_message("Only the game host can start the match.")
            return
        game.start()

    def send_games(self, session: LobbySession) -> None:
        with self._lock:
            games = list(self._games.values())
        if not games:
            session.send_server_message("No hosted games. Type ::create to host one.")
            return
        rows = []
        for game in games:
            rows.append(
                f"#{game.game_id} {game.state}, host={game.host.display_name}, "
                f"players={len(game.players)}/8"
            )
        session.send_server_message("Hosted games: " + " | ".join(rows))

    def _handle_command(self, sender: LobbySession, command_line: str) -> None:
        parts = command_line.split()
        command = parts[0].lower() if parts else "help"

        if command in {"help", "?"}:
            sender.send_server_message(
                "Commands: ::create, ::games, ::join <id>, ::start, ::piece, ::leave, ::where"
            )
            return
        if command in {"create", "host"}:
            game = self.create_game(sender)
            sender.send_server_message(f"You are hosting game {game.game_id}. Type ::start to begin.")
            return
        if command in {"games", "list"}:
            self.send_games(sender)
            return
        if command == "join":
            if len(parts) != 2:
                sender.send_server_message("Usage: ::join <game-id>")
                return
            self.join_game(sender, int(parts[1]))
            return
        if command == "start":
            self.start_game(sender)
            return
        if command == "piece":
            game = sender.current_game
            if game is None or game.state != "playing":
                sender.send_server_message("You are not in a running game.")
                return
            game.handle_piece_request(sender)
            return
        if command in {"leave", "quit"}:
            self.leave_game(sender)
            return
        if command == "where":
            game = sender.current_game
            if game is None:
                sender.send_server_message("You are in the lobby.")
            else:
                sender.send_server_message(
                    f"You are in game {game.game_id}, state={game.state}, slot={sender.player_slot}."
                )
            return

        sender.send_server_message(f"Unknown command ::{command}. Type ::help.")

    def _first_waiting_game(self) -> HostedGame | None:
        with self._lock:
            for game in self._games.values():
                if game.state == "waiting" and len(game.players) < 8:
                    return game
        return None

    def _broadcast_lobby_status(self, message: str, exclude: LobbySession | None = None) -> None:
        with self._lock:
            peers = [peer for peer in self._sessions if peer is not exclude]
        for peer in peers:
            if peer.current_game is None:
                _safe_send_message(peer, message)


def _safe_send_message(peer: LobbySession, message: str) -> None:
    try:
        peer.send_server_message(message)
    except OSError:
        peer.current_game = None
        peer.player_slot = None


def _safe_call(callback) -> None:
    try:
        callback()
    except OSError:
        return


LOBBY = Lobby()
