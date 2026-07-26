from __future__ import annotations

from dataclasses import dataclass, field, replace
import itertools
import json
import os
import random
from pathlib import Path
import threading
import time
import hashlib
import zlib
from typing import Callable, Protocol

from .engine import FAST_DROP, AuthoritativeMatch, LockResult, Outcome

#: How close (in rows) the authoritative piece must be to resting before the
#: relay stops telling replicas to fast drop. Small enough that a replica
#: tracks the real descent for almost the whole fall, large enough that it
#: coasts across the landing instead of racing the S2C 64 to it -- the race it
#: loses by latching field_Bb and self-disconnecting ("T5").
FINAL_APPROACH_ROWS = 3

#: Wire byte for opcode 70 meaning "nobody won". The client reads the payload as
#: a SIGNED byte and any negative value renders the "DRAW!" banner.
DRAW_RESULT_SLOT = 0xFF
from .packets import (
    PacketBuilder,
    build_add_room,
    build_chat_broadcast,
    build_create_room_reply,
    build_host_invitation_added,
    build_host_invitation_removed,
    build_kicked_room_reply,
    build_player_joined_room,
    build_player_left_room,
    build_quickchat_broadcast,
    build_remove_room,
    build_room_invitation,
    decode_control_batch,
    pack_5bit,
)


LOGIC_TICKS_PER_SECOND = 50.0
CONTROL_BURST_TICKS = 40.0
PROACTIVE_SNAPSHOT_TICKS = 500

# Trace the incoming-garbage lifecycle: queue -> spawn as falling piece ->
# descent -> landing. On by default while this path is being brought up; set
# DEKOBLOKO_TRACE_GARBAGE=0 to silence it.
TRACE_GARBAGE = os.environ.get("DEKOBLOKO_TRACE_GARBAGE", "1") != "0"


def _trace(message: str) -> None:
    if TRACE_GARBAGE:
        print(f"[garbage] {message}")


#: How often to dump a full positional board signature per slot, in engine
#: ticks.  Landings are dumped unconditionally regardless of this.
SIGNATURE_TICK_INTERVAL = 200


def _board_signature(board) -> str:
    """Row-by-row occupancy of a settled board, for diffing against the client.

    ``fill`` counts alone are not enough: a replica whose stack has the right
    number of cells in the wrong *places* reports an identical fill while
    landing later pieces at the wrong height.  That is exactly the failure this
    was written to catch, so the dump is positional and uses the same '#'/'.'
    vocabulary as ``GarbageTrace.boardSig`` on the client side.
    """
    if board is None:
        return "board=None"
    rows = "|".join(
        "".join("#" if board.get(x, y) else "." for x in range(board.width))
        for y in range(board.height)
    )
    fill = sum(
        1
        for y in range(board.height)
        for x in range(board.width)
        if board.get(x, y)
    )
    return f"{board.width}x{board.height} fill={fill} rows={rows}"


def _describe_piece(active) -> str:
    """One-line dump of an active piece, in the client's own vocabulary."""
    if active is None:
        return "active=None"
    width, height = active.dimensions
    bitmap = active.bitmap
    shape = "/".join(
        "".join("#" if bitmap[y * width + x] else "." for x in range(width))
        for y in range(height)
    )
    return (
        f"{width}x{height} map={shape} x={active.x} y={active.y} "
        f"orient={active.orientation} hpar={active.horizontal_parity} "
        f"vpar={active.vertical_parity} drop={active.drop_countdown} "
        f"forced={active.forced_drop_countdown} "
        f"grounded={active.grounded} landed={active.landed} "
        f"domino={active.is_domino}"
    )


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

    def send_lobby_event(self, payload: bytes) -> None:
        ...

    def send_chat_payload(self, opcode: int, payload: bytes) -> None:
        ...

    def send_match_start(self, game: "HostedGame", local_slot: int) -> None:
        ...

    def send_piece_event(
        self,
        player_slot: int,
        piece: "Piece",
        speed_index: int,
        final_x: int = 0,
        final_y: int = 0,
        final_orientation: int = 0,
        finalize_argument: int = 0,
    ) -> None:
        ...

    def send_cooked_shape(self, player_slot: int, shape: "CookedShape") -> None:
        ...

    def send_action_stream(self, player_slot: int, controls_payload: bytes) -> None:
        ...

    def send_player_removed(self, player_slot: int, result_code: int) -> None:
        ...

    def send_full_state(self, player_slot: int, state_payload: bytes) -> None:
        ...

    def send_match_result(self, winner_slot: int) -> None:
        ...

    def send_game_over(self) -> None:
        ...


@dataclass(frozen=True)
class GameOptions:
    bucket_large: bool = False
    speed_index: int = 2
    bombardment_level: int = 1
    colours: int = 4
    special_level: int = 0
    allow_spectators: bool = True
    invite_only: bool = False
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

    def room_bytes(self) -> bytes:
        """The five lobby selectors in ``si.field_f`` / ``tg.field_d`` order.

        They are selector indices, not the packed S2C-58 settings word:
        bucket, speed, colours (3..7), special items, feedback (1..3/off).
        """
        feedback_index = 3 if self.bombardment_level == 0 else self.bombardment_level - 1
        return bytes(
            (
                1 if self.bucket_large else 0,
                max(0, min(4, self.speed_index)),
                max(0, min(4, self.colours - 3)),
                max(0, min(4, self.special_level)),
                max(0, min(3, feedback_index)),
            )
        )


@dataclass(frozen=True)
class Piece:
    piece_id: int
    width: int
    height: int
    cells: tuple[int, ...]
    descriptor: int

    def encode_rf(self) -> bytes:
        return _encode_rf(
            self.piece_id, self.width, self.height, self.cells, "piece"
        )


@dataclass(frozen=True)
class CookedShape:
    """A returned solid shape encoded exactly as the original `rf` geometry."""

    shape_id: int
    colour: int
    width: int
    height: int
    occupied: tuple[bool, ...]

    def __post_init__(self) -> None:
        if not 0 <= self.colour <= 6:
            raise ValueError("cooked shape colour must be 0..6")
        if not 1 <= self.width <= 255 or not 1 <= self.height <= 255:
            raise ValueError("cooked shape dimensions must fit unsigned bytes")
        if len(self.occupied) != self.width * self.height:
            raise ValueError("cooked shape occupancy does not match its dimensions")
        if not any(self.occupied):
            raise ValueError("cooked shape must contain at least one occupied cell")

    @property
    def cells(self) -> tuple[int, ...]:
        # The original resolver writes param2 after converting a completed
        # group to `8 | colour`. Zero is retained for holes in the bounding box.
        cooked_cell = 8 | self.colour
        return tuple(cooked_cell if present else 0 for present in self.occupied)

    def encode_rf(self) -> bytes:
        return _encode_rf(
            self.shape_id, self.width, self.height, self.cells, "cooked shape"
        )


def _encode_rf(
    shape_id: int,
    width: int,
    height: int,
    cells: tuple[int, ...],
    label: str,
) -> bytes:
    if shape_id < 0:
        raise ValueError(f"{label} id cannot be negative")
    if not 1 <= width <= 255 or not 1 <= height <= 255:
        raise ValueError(f"{label} dimensions must fit unsigned bytes")
    if len(cells) != width * height:
        raise ValueError(f"{label} cell count does not match dimensions")
    if any(cell < 0 or cell > 31 for cell in cells):
        raise ValueError(f"{label} cells must fit the 5-bit rf vocabulary")
    return (
        PacketBuilder()
        .varint7(shape_id)
        .u8(width)
        .u8(height)
        .raw(pack_5bit(cells))
        .finish()
    )


@dataclass
class HostedGame:
    game_id: int
    host: LobbySession
    options: GameOptions = field(default_factory=GameOptions)
    players: list[LobbySession] = field(default_factory=list)
    spectators: list[LobbySession] = field(default_factory=list)
    invitations: set[int] = field(default_factory=set)
    inactive_slots: set[int] = field(default_factory=set)
    state: str = "waiting"
    created_at: float = field(default_factory=time.time)
    shape_counter: int = 0
    rng: random.Random = field(default_factory=random.Random)
    engine: AuthoritativeMatch | None = field(default=None, init=False, repr=False)
    transition_counters: list[int] = field(default_factory=list, init=False, repr=False)
    awaiting_transition_ack: dict[int, int] = field(
        default_factory=dict, init=False, repr=False
    )
    feedback_cursor: list[int] = field(default_factory=list, init=False, repr=False)
    control_credit: list[float] = field(default_factory=list, init=False, repr=False)
    control_refill_at: list[float] = field(default_factory=list, init=False, repr=False)
    ticks_since_snapshot: list[int] = field(default_factory=list, init=False, repr=False)
    on_finished: Callable[["HostedGame"], None] | None = field(
        default=None, repr=False, compare=False
    )
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def __post_init__(self) -> None:
        seed = (self.game_id << 32) ^ int(self.created_at * 1000)
        # [probe] SERVER-ONLY gameplay seed. It is never put on the wire (see
        # send_match_start), and the client's own cooked-shape RNG is an
        # unseeded java.util.Random (tf.field_cb), so the two sequences cannot
        # match by construction -- authoritative geometry must come from S2C 67.
        print(
            f"[probe seed] game={self.game_id} created_at={self.created_at} "
            f"seed={seed}  -- NOT sent on the wire"
        )
        self.rng.seed(seed)
        self.add_player(self.host)

    @property
    def names(self) -> list[str]:
        return [player.display_name for player in self.players]

    def active_mask(self) -> int:
        mask = 0
        for index, _player in enumerate(self.players[:8]):
            if index not in self.inactive_slots:
                mask |= 1 << index
        return mask

    def active_players(self) -> list[LobbySession]:
        """Return live sessions without changing their immutable match slots."""
        with self._lock:
            return [
                player
                for slot, player in enumerate(self.players)
                if slot not in self.inactive_slots
            ]

    def replication_recipients(self) -> list[LobbySession]:
        """Live players plus observers, without assigning spectators slots."""
        with self._lock:
            return self.active_players() + [
                spectator
                for spectator in self.spectators
                if spectator.current_game is self
            ]

    def attached_sessions(self) -> list[LobbySession]:
        """Every connected participant or observer, including defeated slots."""
        with self._lock:
            return [
                session
                for session in self.players + self.spectators
                if session.current_game is self
            ]

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

    def add_spectator(self, session: LobbySession) -> None:
        """Attach an observer to a running match and send its complete state."""
        with self._lock:
            if self.state != "playing":
                raise ValueError("only running games can be spectated")
            if not self.options.allow_spectators:
                raise ValueError("this game does not allow spectators")
            if session in self.players:
                raise ValueError("a player in the match cannot also spectate it")
            if session in self.spectators:
                return
            if session.current_game is not None and session.current_game is not self:
                raise ValueError("session is already attached to another game")

            # Hold the simulation lock until initialization and subscription
            # are both complete. Otherwise a control/transition could arrive
            # before S2C 59 or in the gap after the final snapshot.
            session.send_match_start(self, -1)
            self.send_all_authoritative_snapshots(session)
            self.spectators.append(session)
            session.current_game = self
            session.player_slot = None

    def is_spectator(self, session: LobbySession) -> bool:
        with self._lock:
            return session in self.spectators

    def remove_player(self, session: LobbySession) -> bool:
        """Detach a session and return whether it occupied a player slot."""
        with self._lock:
            if session in self.spectators:
                self.spectators.remove(session)
                session.current_game = None
                session.player_slot = None
                detached_spectator = True
            elif session not in self.players:
                return False
            else:
                detached_spectator = False
                slot = self.players.index(session)
                if self.state == "playing":
                    if slot in self.inactive_slots:
                        return False
                    # S2C 62 targets a stable board-array index. Broadcast while
                    # the departing session is still active, then tombstone that
                    # slot; compacting/reindexing would redirect every later packet.
                    self._broadcast_player_removed(slot, 0)
                    if self.engine is not None:
                        self.engine.eliminate(slot)
                    self.inactive_slots.add(slot)
                    session.current_game = None
                    session.player_slot = None
                    return True

                self.players.remove(session)
                session.current_game = None
                session.player_slot = None
                for index, player in enumerate(self.players):
                    player.player_slot = index
                return True

        if detached_spectator:
            _safe_call(session.send_game_over)
            return False

    def start(self) -> None:
        with self._lock:
            if self.state == "playing":
                return
            if not self.players:
                raise ValueError("cannot start a game with no players")
            if len(self.players) < 2:
                raise ValueError("authoritative multiplayer requires at least two players")
            self.state = "playing"
            players = self.active_players()
            width, height = ((12, 27) if self.options.bucket_large else (8, 18))
            self.engine = AuthoritativeMatch(
                len(self.players),
                width,
                height,
                self.options.speed_index,
                self.options.colours,
                self.options.bombardment_level,
            )
            self.transition_counters = [-1] * len(self.players)
            self.awaiting_transition_ack.clear()
            self.feedback_cursor = list(range(len(self.players)))
            # Cooked shapes queued on a board (S2C 67) and waiting to become
            # that board's falling piece. They sit in the client's incoming
            # queue at field_e==0 as the visible warning until the board's next
            # piece transition, at which point one is spawned as the active
            # piece and released (S2C 66) so it leaves the queue.
            #
            # Garbage is NEVER written straight into the grid. It arrives as a
            # real falling piece that descends under gravity and is steered by
            # the player, exactly like an ordinary domino.
            self.pending_garbage: dict[int, list[CookedShape]] = {}
            now = time.monotonic()
            self.control_credit = [CONTROL_BURST_TICKS] * len(self.players)
            self.control_refill_at = [now] * len(self.players)
            self.ticks_since_snapshot = [0] * len(self.players)
            # Ticks consumed since each slot's last positional board dump.
            self._signature_ticks: dict[int, int] = {}

        for index, player in enumerate(players):
            player.send_match_start(self, index)

        self.broadcast_message(f"Game {self.game_id} started with {len(players)} player(s).")

        # Do NOT open a match with packet 64. It is a TRANSITION: it corrects
        # the prior active piece and then finalizes it. The old code here sent
        # one per slot with zero correction fields, on the assumption that "at
        # match start there is no prior piece, so the zeroes are benign". They
        # are not. The client has already spawned a piece on every board by the
        # time this arrives, and lk.a(int,int,int,boolean,int,int) assigns
        #     this.field_L = param5;  this.field_q = param4;
        # unconditionally (lk.java:1352-1353) before falling through to the
        # commit at lk.java:1452. So the zeroes teleported that live piece to
        # the top-left corner and locked it there. Measured live 2026-07-25:
        #     [game] sent piece event slot=1 piece=1 2x1 final=(0,0)
        #     [CT] LANDING board=6dec2fc9 final=(0,0) was=(3,0) fillBefore=0
        # Every client board therefore began the match one domino ahead of the
        # server, in a column the server had no cell in, and nothing ever
        # reconciled it -- the replica's own top-out test (lk.java:5793) then
        # fired at a different time than the engine's, which is why an opponent
        # could be eliminated server-side while their bucket still looked
        # playable on screen.
        #
        # Packet 61 is the right tool: it installs the grid AND the active
        # piece without finalizing anything, and it is what the surrounding
        # code already reserves for initial state. Unlike the steady-state
        # broadcast it is sent to the owner too -- the "never snapshot a live
        # owner" rule in broadcast_authoritative_snapshot exists because 61
        # resets the gravity counter mid-play, and at match start there is no
        # play in progress to disturb.
        #
        # (Packet 67 is not a "next piece" either: it fills the incoming
        # bombardment queue, so sending a domino through it here would falsely
        # attack every board.)
        for slot, _player in enumerate(players):
            active = self.next_piece()
            with self._lock:
                self.engine.spawn(slot, (active.cells[0], active.cells[1]))
                # Advance the counter WITHOUT arming awaiting_transition_ack:
                # that latch is cleared by the ack to a packet 64, and no 64 is
                # coming. handle_transition_ack already accepts an unsolicited
                # ack whose value matches the current counter as a snapshot ack.
                self.transition_counters[slot] = (
                    self.transition_counters[slot] + 1
                ) & 0xFF

        # This also lifts every replica's field_U off -1. A fresh lk has
        # field_U=-1 and the carousel render loop draws only boards with
        # field_U>=0, so opponent buckets stay culled until a 61 arrives.
        for slot, _player in enumerate(players):
            self.seed_authoritative_snapshot(slot)

    def next_piece(self) -> Piece:
        piece_id = self._next_shape_id()

        colour_count = max(1, min(7, self.options.colours))
        cell_a, nibble_a = self._next_piece_cell(colour_count)
        cell_b, nibble_b = self._next_piece_cell(colour_count)
        descriptor = ((nibble_a & 0xF) << 4) | (nibble_b & 0xF)

        # lc.b constructs an ordinary piece from two descriptor nibbles as a
        # 2x1 domino. Ordinary cells use 16+colour; 24+kind is reserved for
        # special items. The former tetromino generator violated both rules.
        #
        # Both nibbles MUST stay inside 0..7: the preview indexes an 8x8 sprite
        # table with them (qc.java:11480, fb.java:94), so a nibble of 8 or more
        # kills the client with ArrayIndexOutOfBoundsException on the first
        # rendered frame.
        if not (0 <= nibble_a <= 7 and 0 <= nibble_b <= 7):
            raise ValueError(
                f"piece descriptor nibbles must be 0..7, got "
                f"({nibble_a}, {nibble_b}) from cells ({cell_a}, {cell_b}) -- "
                f"the client's preview sprite table is only 8 wide"
            )
        return Piece(
            piece_id=piece_id,
            width=2,
            height=1,
            cells=(cell_a, cell_b),
            descriptor=descriptor,
        )

    def _next_piece_cell(self, colour_count: int) -> tuple[int, int]:
        """Generate one cell using an explicit server-side item frequency.

        The client defines which item kinds each option level enables, but the
        historical server's frequency is unavailable. One enabled item chance
        per twelve cells is therefore our documented server policy.
        """
        level = max(0, min(4, self.options.special_level))
        enabled: list[tuple[int, int]] = []
        if level >= 1:
            enabled.append((23, 7))       # Wildcard is loose colour slot 7.
        # Item cells 24..31 are DELIBERATELY not generated here.
        #
        # An ordinary piece is described to the client by one descriptor byte of
        # two nibbles, and the next-piece preview indexes a sprite table with
        # each nibble directly:
        #     var21 = field_yb & 15
        #     fb.field_c[param7][var21]          (qc.java:11480)
        # with fb.field_c = new ck[8][8] (fb.java:94). Only nibbles 0..7 exist.
        #
        # lc.b decodes a nibble as (n & 7) + (n & 8 ? 24 : 16), so cells 24..31
        # are exactly nibbles 8..15 -- unrenderable. Emitting one crashed the
        # client on the first frame of the match with
        # ArrayIndexOutOfBoundsException: 8, the moment a room was created with
        # special items enabled (observed live 2026-07-25, special_level=4).
        #
        # The wildcard is cell 23 -> nibble 7, which is inside the table and so
        # remains safe. Item cells reach a board by other means (the feedback
        # resolver already handles drills, bombs, water, poison and earthquake
        # when they are ON the board); they are simply never part of an
        # ordinary falling domino.
        if enabled and self.rng.randrange(12) == 0:
            return enabled[self.rng.randrange(len(enabled))]
        colour = self.rng.randrange(colour_count)
        return 16 + colour, colour

    def _next_shape_id(self) -> int:
        # Ordinary pieces and cooked feedback share the connection's oi/rf
        # cache, so their ids must come from one namespace.
        with self._lock:
            shape_id = self.shape_counter
            self.shape_counter += 1
            # Reusing an id is not a cosmetic slip: the client's cache insert
            # oi.a(rf, int) throws IllegalArgumentException when handed an id it
            # already holds (oi.java:283), which kills the client outright. That
            # is exactly how the first garbage-as-falling-piece build died, so
            # make a repeat loud here rather than at the far end of a socket.
            issued = getattr(self, "_issued_shape_ids", None)
            if issued is None:
                issued = self._issued_shape_ids = set()
            if shape_id in issued:
                print(
                    f"[garbage] BUG: shape id {shape_id} issued twice -- the "
                    f"client will throw IllegalArgumentException on insert"
                )
            issued.add(shape_id)
            return shape_id

    def send_cooked_feedback(
        self,
        player_slot: int,
        colour: int,
        width: int,
        height: int,
        occupied: tuple[bool, ...] | list[bool],
    ) -> CookedShape:
        """Serialize and broadcast one engine-returned shape to a target board."""
        with self._lock:
            if not 0 <= player_slot < len(self.players):
                raise ValueError(f"invalid feedback target slot: {player_slot}")
            if player_slot in self.inactive_slots:
                raise ValueError(f"feedback target slot is inactive: {player_slot}")
        shape = CookedShape(
            shape_id=self._next_shape_id(),
            colour=colour,
            width=width,
            height=height,
            occupied=tuple(occupied),
        )
        self.broadcast_cooked_shape(player_slot, shape)
        return shape

    def broadcast_message(self, message: str) -> None:
        with self._lock:
            recipients = self.replication_recipients()
        for recipient in recipients:
            _safe_send_message(recipient, message)

    def broadcast_chat(self, sender: LobbySession, message: str) -> None:
        self.broadcast_message(f"[game {self.game_id}] {sender.display_name}: {message}")

    def broadcast_piece_event(
        self,
        player_slot: int,
        piece: Piece,
        lock: LockResult | None = None,
    ) -> None:
        with self._lock:
            recipients = self.replication_recipients()
        for player in recipients:
            _safe_call(
                lambda p=player: p.send_piece_event(
                    player_slot,
                    piece,
                    self.options.speed_index,
                    0 if lock is None else lock.x,
                    0 if lock is None else lock.y,
                    0 if lock is None else lock.orientation,
                    0,
                )
            )

    def broadcast_cooked_shape(self, player_slot: int, shape: CookedShape) -> None:
        with self._lock:
            recipients = self.replication_recipients()
        for player in recipients:
            _safe_call(lambda p=player: p.send_cooked_shape(player_slot, shape))

    def broadcast_cooked_release(self, player_slot: int, count: int) -> None:
        """S2C 66 to every replica: release `count` queued cooked shapes on a
        board. Pairs with broadcast_cooked_shape (67); without it the queued
        garbage never leaves its field_e==0 "pending" state on the client."""
        with self._lock:
            recipients = self.replication_recipients()
        for player in recipients:
            _safe_call(lambda p=player: p.send_cooked_release(player_slot, count))

    def handle_controls(self, sender: LobbySession, payload: bytes) -> None:
        """Ingest the client's only live world contribution: per-tick actions."""
        slot = sender.player_slot
        if slot is None:
            return
        try:
            controls = decode_control_batch(payload)
        except ValueError as exc:
            print(f"[game] rejected malformed controls slot={slot}: {exc}")
            return

        with self._lock:
            if self.state != "playing":
                print(f"[game] ignored controls slot={slot} while state={self.state}")
                return
            engine = self.engine
            awaiting = self.awaiting_transition_ack.get(slot)
            authoritative = engine is not None
        if authoritative and awaiting is not None:
            print(
                f"[game] ignored controls slot={slot} while awaiting "
                f"transition ack={awaiting}"
            )
            return

        needs_sender_resync = False
        if authoritative:
            with self._lock:
                allowed = self._admit_control_ticks(slot, len(controls), time.monotonic())
            if allowed == 0 and controls:
                print(f"[game] rate-limited all {len(controls)} controls from slot={slot}")
                self.send_authoritative_snapshot(sender, slot)
                return
            if allowed < len(controls):
                needs_sender_resync = True
                print(
                    f"[game] rate-limited {len(controls) - allowed} "
                    f"control sample(s) from slot={slot}"
                )
                controls = controls[:allowed]
                payload = bytes([allowed]) + pack_5bit(controls)

        landed = False
        accepted_controls = controls
        if authoritative:
            try:
                with self._lock:
                    if self.state != "playing" or slot in self.inactive_slots:
                        return
                    accepted: list[int] = []
                    for control in controls:
                        accepted.append(control)
                        if engine.apply_controls(slot, (control,)):
                            landed = True
                            break
                    accepted_controls = tuple(accepted)
            except (IndexError, RuntimeError, ValueError) as exc:
                print(f"[game] rejected controls for authoritative slot={slot}: {exc}")
                return
            # Follow a garbage piece down. Ordinary dominoes are left alone so
            # this stays readable -- only the never-before-exercised path talks.
            with self._lock:
                active = engine.players[slot].active if engine else None
                interesting = active is not None and not active.is_domino
            if interesting:
                _trace(
                    f"TICK slot={slot} ctrl={accepted_controls!r} "
                    f"landed={landed} {_describe_piece(active)}"
                )
            # Periodic positional dump, independent of landings, so a drift
            # that appears mid-flight is still visible.
            counters = self._signature_ticks
            counters[slot] = counters.get(slot, 0) + len(accepted_controls)
            if counters[slot] >= SIGNATURE_TICK_INTERVAL:
                counters[slot] = 0
                with self._lock:
                    board = engine.players[slot].board if engine else None
                _trace(f"SIG slot={slot} at=periodic {_board_signature(board)}")

        # A REPLICA must never land a piece under its own steam.
        #
        # The relay is queued input the replica works through one sample per
        # rendered frame, and it cannot apply a pending authoritative landing
        # (S2C 64) until it reaches the end of that queue. So if the relay
        # contains the sample that lands the piece, the replica gets there
        # first, decides the piece has come to rest, and sets lk.field_y to
        # wait for the transition that confirms it. lk.c then latches
        # field_Bb, and qc turns that into the "T5" self-disconnect -- which
        # kills the HUMAN's connection over an OPPONENT's bucket. Captured
        # 2026-07-25, with the two boards in perfect agreement either side of
        # the gap, so nothing had actually diverged:
        #     [CT] LOCK board=502ccf0a at=(3,12) y=true
        #     Error: T5: 1 3 true
        #     [CT] LANDING board=502ccf0a final=(3,13)      <- arrived after
        #
        # Widening the window does not close this. field_e collapses 20 -> 1
        # in a single tick, so the replica has a couple of frames, and no
        # feed rate makes a couple of frames reliable.
        #
        # Withholding the landing sample removes the race instead of racing
        # it: the replica advances to one tick short of the landing and stops,
        # with no opinion about whether the piece is down. The S2C 64 that
        # follows carries final_x, final_y and the orientation and applies
        # them absolutely (lk.java:1352-1353), so nothing is lost by not
        # replaying the last sample -- whatever it would have done to the
        # piece's position or rotation, the transition overrides anyway.
        #
        # This does not touch the owner's own board, which never receives its
        # own action stream: a player waiting on field_y for a landing THEY
        # made is the mechanism working as intended.
        relayed_controls = accepted_controls
        if landed and relayed_controls:
            # Withholding the landing sample is not enough on its own: a
            # replica HOLDS the last control mask it was given and keeps
            # applying it once the relay runs out, so it simply lands on the
            # next frame under its own steam.
            relayed_controls = relayed_controls[:-1]
        # Only the FINAL APPROACH is dangerous. Stripping the drop bit from
        # every sample (an earlier revision) does stop the T5, but it drops the
        # replica to base gravity -- 40 ticks a row against the authoritative
        # 2 -- so it barely leaves the spawn before the transition snaps it to
        # the floor. Measured 2026-07-25, every piece teleported the full
        # height of the bucket and the opponent's board was unwatchable:
        #     LANDING was=(3,0)  -> final=(3,16)
        #     LANDING was=(2,0)  -> final=(3,15)
        #     LANDING was=(4,-1) -> final=(5,15)
        # against the owner's own board, which predicts exactly (was == final).
        #
        # So relay the drop bit for the bulk of the fall, where it is what makes
        # the replica track the real descent, and cut it only once the
        # authoritative piece is within FINAL_APPROACH_ROWS of resting. The
        # replica then coasts the last stretch, arrives after the server rather
        # than before it, and still holds its full 20-tick grace if it does
        # touch down first.
        # No engine means no authoritative piece to measure against, so fall
        # back to the conservative end: cut the bit. Being early costs smooth
        # replication; being late costs the client its connection.
        active = (
            None if self.engine is None else self.engine.active_piece(slot)
        )
        clearance = (
            0 if active is None else active.clearance_rows(FINAL_APPROACH_ROWS + 1)
        )
        if relayed_controls and clearance <= FINAL_APPROACH_ROWS:
            #
            # Two narrower versions of this were tried and both failed live.
            # Stripping only landing batches misses the case that actually
            # fires, because the replica reaches the floor BEFORE the server and
            # so no landing batch exists yet.  Stripping only the trailing
            # sample of every batch is one tick too late: the replica can land
            # part-way through a batch, and the fast-drop samples still queued
            # behind it collapse the grace before the cleared sample is ever
            # reached.  Measured 2026-07-25, with the trailing-sample fix live
            # and visibly working (ctrl does reach 0) yet still fatal:
            #     [INSTR lk.d] Ab=786 e=20 ctrl=16 y=true  <- landed, grace 20
            #     [INSTR lk.d] Ab=785 e=1  ctrl=0  y=true  <- too late, e gone
            #     Error: T5: 1 3 true
            # lk.d clamps field_e to 2 whenever the drop bit is seen
            # (lk.java:1241/1270), so ONE such sample after the landing is
            # enough to spend a 20-tick grace.  Nothing short of stripping them
            # all closes that.
            #
            # For reference, the original measurement on a bot's replica:
            #     [INSTR lk.d] Ab=782 e=20 ctrl=16 y=true   <- grace set to 20
            #     [INSTR lk.d] Ab=781 e=1  ctrl=16 y=true   <- gone next tick
            # then field_Bb latched and qc raised the "T5" self-disconnect,
            # killing the human's connection over an OPPONENT's bucket.
            #
            # Restricting this to landing batches (as an earlier revision did)
            # misses the case that actually fires, because the replica reaches
            # the floor BEFORE the server does and so no landing batch exists
            # yet.  The engine spends exactly four ticks per piece that the
            # replica does not -- a final blocked drop cycle, then the
            # grounded->landed promotion -- so a piece that falls r rows takes
            # 2r ticks on the replica and 2r+4 here.  Measured over one match,
            # server ticks against landing row: 38/17, 34/15, 36/16, 38/17,
            # 32/14, i.e. 2r+4 every time.  The replica banks two rows a piece
            # and eventually touches down first; the client's own probe shows
            # the transition catching it progressively lower each piece:
            #     final=(4,17) was=(3,0)     <- replica still at the top
            #     final=(4,15) was=(4,4)
            #     final=(5,16) was=(3,9)
            #     final=(2,17) was=(3,8)
            #     final=(3,14) was=(3,13)    <- on the floor: y=true, then T5
            #
            # With the bit cleared the replica coasts on base gravity whenever
            # it outruns the relay, so it can no longer arrive early, and if it
            # does land first the full 20-tick grace survives -- ample for the
            # four-tick overhead plus the round trip.  Steering bits are left
            # alone: the S2C 64 applies position and rotation absolutely
            # (lk.java:1352-1353), so nothing they would have done is lost.
            #
            # The cost is one non-accelerated tick per batch, so a replica
            # descends slightly slower than the authoritative piece.  That is
            # the safe direction to err -- being late only means the transition
            # teleports the piece down, which is already the normal case above.
            relayed_controls = tuple(
                mask & ~FAST_DROP for mask in relayed_controls
            )
        if len(accepted_controls) != len(controls):
            print(
                f"[game] trimmed {len(controls) - len(accepted_controls)} "
                f"post-landing control sample(s) from slot={slot}"
            )

        if relayed_controls:
            relay_payload = payload
            # Compare CONTENT, not just length: clearing the drop bit from the
            # final sample rewrites a batch without shortening it, and a length
            # test would forward the untouched original.
            if relayed_controls != controls:
                relay_payload = (
                    bytes([len(relayed_controls)]) + pack_5bit(relayed_controls)
                )
            with self._lock:
                recipients = [
                    recipient
                    for recipient in self.replication_recipients()
                    if recipient is not sender
                ]
            for recipient in recipients:
                _safe_call(lambda p=recipient: p.send_action_stream(slot, relay_payload))
        elif landed:
            # The batch's first sample landed the piece, so there is nothing
            # left to replay. Staying silent is correct: the S2C 64 about to
            # follow carries the landing in full. An empty action stream would
            # only be a packet the replica has to decode for no effect.
            print(f"[game] withheld landing-only batch from slot={slot} replicas")

        print(
            f"[game] controls slot={slot} samples={len(accepted_controls)} "
            f"client_short_batch={len(accepted_controls) < 20} "
            f"authoritative_landed={landed} masks={accepted_controls!r}"
        )
        if authoritative:
            with self._lock:
                self.ticks_since_snapshot[slot] += len(accepted_controls)
            # Do NOT broadcast a proactive snapshot into a live REMOTE board. It
            # arrives stale relative to a replica that is mid clear-animation
            # (its field_U < the replica's) and reverts cells the replica is
            # already clearing, overflowing the next active piece ->
            # lk.field_Bb=true -> the client's qc.b "T5" self-disconnect (verified
            # live 2026-07-25). Remote replicas keep their OWN deterministic sim
            # from the relayed action stream (S2C 63) + piece events (S2C 64) and
            # DO run the local clear, so they need no ongoing correction.
            # Snapshots are reserved for INITIAL state (match-start seed,
            # spectator join). ticks_since_snapshot is kept for diagnostics only.
        if landed and engine is not None:
            self._finish_authoritative_piece(slot)
        if needs_sender_resync:
            with self._lock:
                can_resync = self.state == "playing" and slot not in self.inactive_slots
            if can_resync:
                self.send_authoritative_snapshot(sender, slot)

    def handle_transition_ack(self, sender: LobbySession, counter: int) -> None:
        """Accept C2S 59 only when it acknowledges this slot's last S2C 64."""
        slot = sender.player_slot
        if slot is None:
            return
        counter &= 0xFF
        mismatch = False
        with self._lock:
            expected = self.awaiting_transition_ack.get(slot)
            if expected is None:
                if (
                    slot < len(self.transition_counters)
                    and counter == self.transition_counters[slot]
                ):
                    print(f"[game] accepted snapshot ack slot={slot} value={counter}")
                else:
                    print(
                        f"[game] duplicate/unexpected transition ack "
                        f"slot={slot} value={counter}"
                    )
                return
            if counter != expected:
                print(
                    f"[game] rejected transition ack slot={slot} "
                    f"expected={expected} got={counter}"
                )
                mismatch = True
            else:
                del self.awaiting_transition_ack[slot]
        if mismatch:
            self.send_authoritative_snapshot(sender, slot)
            return
        print(f"[game] accepted transition ack slot={slot} value={counter}")

    def _mark_transition_pending(self, slot: int) -> int:
        counter = (self.transition_counters[slot] + 1) & 0xFF
        self.transition_counters[slot] = counter
        self.awaiting_transition_ack[slot] = counter
        return counter

    def _admit_control_ticks(self, slot: int, requested: int, now: float) -> int:
        elapsed = max(0.0, now - self.control_refill_at[slot])
        self.control_refill_at[slot] = now
        self.control_credit[slot] = min(
            CONTROL_BURST_TICKS,
            self.control_credit[slot] + elapsed * LOGIC_TICKS_PER_SECOND,
        )
        allowed = min(requested, int(self.control_credit[slot] + 1.0e-9))
        self.control_credit[slot] -= allowed
        return allowed

    def send_authoritative_snapshot(self, recipient: LobbySession, slot: int) -> None:
        """Serialize the server-owned slot using the exact S2C 61 field order.

        ENABLED BY DEFAULT (set DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS=0 to disable).
        This packet is the ONLY way a remote board replica becomes visible: a
        freshly-constructed lk has field_U=-1, and the client's carousel render
        loop (qc.a, qc.java:8257/8530) draws only boards with field_U>=0. The
        local board advances field_U through its own gravity (lk.d); a remote
        board's field_U is set solely here, by opcode 61.

        The earlier "format mismatch / field_P overrun" note applied to the
        pre-regeneration decompilation. Re-traced against the CURRENT client
        (lk.a(boolean, wl, byte), lk.java:4890) 2026-07-25 and confirmed the
        byte order below matches exactly:
          u16 flags, u8 lives,
          board grid  = field_a*field_O cells (=width*height, field_P),
          u8 field_U, u8 width, u8 height,
          active grid = width*height cells (field_T),
          i8 x, i8 y, u8 drop, u16 forced_drop, u8 prev_controls,
          i8 h_repeat, u8 descriptor, u8 0, u8 0.
        field_P is new int[field_O*field_a], so width*height board cells never
        overrun it. Broadcasting is owner-skipped (see
        broadcast_authoritative_snapshot) so a player's own live physics -- incl.
        the gravity counter field_Ab -- is never reset out from under them.
        """
        if os.environ.get("DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS") == "0":
            return
        with self._lock:
            engine = self.engine
            if engine is None or not 0 <= slot < len(engine.players):
                return
            player = engine.players[slot]
            active = player.active
            if active is None:
                return
            flags = 32  # field_ib == 0 in the normal active-board state.
            flags |= (active.orientation & 3) << 9
            flags |= (active.vertical_parity & 3) << 3
            flags |= (active.horizontal_parity & 3) << 1
            if active.grounded:
                flags |= 64
            builder = PacketBuilder().u16(flags).u8(player.lives)
            for row in player.board.cells:
                for cell in row:
                    builder.varint7(cell & 31)
            width, height = active.dimensions
            builder.u8(self.transition_counters[slot]).u8(width).u8(height)
            for cell in active.bitmap:
                builder.u8(cell)
            builder.i8(active.x).i8(active.y)
            builder.u8(active.drop_countdown).u16(active.forced_drop_countdown)
            builder.u8(active.previous_controls).i8(active.horizontal_repeat)
            builder.u8(active.descriptor).u8(0).u8(0)
            payload = builder.finish()
        recipient.send_full_state(slot, payload)
        print(
            f"[game] sent authoritative snapshot slot={slot} "
            f"update={self.transition_counters[slot]} bytes={len(payload)}"
        )

    def broadcast_authoritative_snapshot(self, slot: int) -> None:
        with self._lock:
            recipients = self.replication_recipients()
        for recipient in recipients:
            # Never send a player their OWN board. Opcode 61 overwrites the live
            # physics (board dims, offsets, and the gravity counter field_Ab),
            # which would stutter the owner's local play. Only the REMOTE
            # replicas need it -- that snapshot is what lifts a remote lk.field_U
            # off -1 so the opponent bucket stops being culled.
            if recipient.player_slot == slot:
                continue
            _safe_call(lambda target=recipient: self.send_authoritative_snapshot(target, slot))

    def seed_authoritative_snapshot(self, slot: int) -> None:
        """Initial state for one slot, sent to EVERY client including the owner.

        The owner-skip in broadcast_authoritative_snapshot guards live physics
        that does not exist yet at match start, and the owner needs this packet
        as much as the replicas do: it is what gives their own board its first
        authoritative piece now that match start no longer sends a packet 64.
        """
        with self._lock:
            recipients = self.replication_recipients()
        for recipient in recipients:
            _safe_call(lambda target=recipient: self.send_authoritative_snapshot(target, slot))

    def resync_lives(self, slot: int, lives: int) -> None:
        """Correct every replica's life counter for one slot.

        Lives are ``lk.field_jb``. A replica keeps its own count -- the commit
        routine decrements it whenever a piece locks above the top of the
        bucket (lk.java:5793-5801) -- and the ONLY thing on the wire that ever
        writes that field is the ``u8`` in a packet-61 snapshot (lk.java:4964).
        There is no dedicated life packet to implement; this is the channel.

        So a replica shows the right number of lives exactly as long as it
        agrees with the authoritative bucket about when a piece overflows. When
        it does not, the opponent visibly keeps all three lives while the
        server eliminates them -- which is what happened on 2026-07-25. Pushing
        a snapshot at the moment the engine changes a life count both fixes the
        display and re-seats the board that disagreed.

        Deliberately NOT periodic. A snapshot arriving into a replica that is
        mid clear-animation reverts cells it is already clearing, overflows the
        next piece, and trips the client's field_Bb "T5" self-disconnect. This
        fires only on a life change, straight after the finalize that caused
        it, when the bucket has just been committed.
        """
        with self._lock:
            recipients = [
                recipient
                for recipient in self.replication_recipients()
                if recipient.player_slot != slot
            ]
        print(f"[game] resyncing lives slot={slot} lives={lives}")
        for recipient in recipients:
            _safe_call(lambda target=recipient: self.send_authoritative_snapshot(target, slot))

    def send_all_authoritative_snapshots(self, recipient: LobbySession) -> None:
        """Recovery/spectator hook: replace every live stable-slot replica."""
        with self._lock:
            slots = [
                slot for slot in range(len(self.players))
                if slot not in self.inactive_slots
            ]
        for slot in slots:
            self.send_authoritative_snapshot(recipient, slot)

    def _finish_authoritative_piece(self, slot: int) -> None:
        with self._lock:
            engine = self.engine
            if engine is None or slot in self.inactive_slots:
                return
            landing = engine.players[slot].active
            was_garbage = landing is not None and not landing.is_domino
            if was_garbage:
                _trace(f"LAND slot={slot} {_describe_piece(landing)}")
            fill_before = engine.players[slot].board.occupied_count()
            lock = engine.finalize_landed(slot)
            fill_after = engine.players[slot].board.occupied_count()
            if was_garbage:
                _trace(
                    f"LAND slot={slot} final=({lock.x},{lock.y}) "
                    f"orient={lock.orientation} life_lost={lock.life_lost} "
                    f"lives={lock.lives_remaining} "
                    f"placed={sorted(lock.placed_cells)} "
                    f"returned={len(lock.returned_shapes)} "
                    f"board_fill={engine.players[slot].board.occupied_count()}"
                )
            # EVERY finalize, not just garbage. A clear removes cells, so a
            # drop in fill with returned=0 means the resolver cleared but
            # produced no feedback, while no drop at all means it never
            # matched. Without this the two are indistinguishable and a
            # "my clear sent nothing" report cannot be diagnosed.
            _trace(
                f"FINALIZE slot={slot} placed={len(lock.placed_cells)} "
                f"fill {fill_before}->{fill_after} "
                f"cleared={fill_before + len(lock.placed_cells) - fill_after} "
                f"returned={len(lock.returned_shapes)} "
                f"shapes={[(s.colour, s.width, s.height, sum(s.occupied)) for s in lock.returned_shapes]} "
                f"feedback_level={engine.feedback_level} "
                f"life_lost={lock.life_lost} lives={lock.lives_remaining}"
            )
            # The settled board immediately after a landing commits.  This is
            # the sync point the client must agree with; if the two signatures
            # differ here, every later landing height is suspect.
            _trace(
                f"SIG slot={slot} at=finalize "
                f"{_board_signature(engine.players[slot].board)}"
            )

        if lock.eliminated:
            self._complete_authoritative_elimination(slot, "final life")
            return

        if self._dispatch_returned_shapes(slot, lock):
            return

        # Incoming garbage takes priority over a fresh domino: the queued cooked
        # shape becomes this board's next FALLING piece.
        with self._lock:
            queued = self.pending_garbage.get(slot)
            cooked = queued.pop(0) if queued else None
            if queued is not None and not queued:
                del self.pending_garbage[slot]

        if cooked is None:
            next_piece = self.next_piece()
            with self._lock:
                engine.spawn(slot, (next_piece.cells[0], next_piece.cells[1]))
                self._mark_transition_pending(slot)
            self.broadcast_piece_event(slot, next_piece, lock)
        else:
            # A FRESH id, never the cooked shape's own. The client caches every
            # rf it receives by id in `oi`, and oi.a(rf, int) throws
            # IllegalArgumentException if asked to insert an id that is already
            # cached (oi.java:283). The S2C 67 that queued this shape already
            # registered cooked.shape_id, so reusing it here killed the client
            # the instant the first garbage piece spawned.
            #
            # descriptor 0: that byte is the next-piece PREVIEW (two nibbles,
            # qc.java:11480), and a cooked shape has no such encoding -- its
            # cells are 8|colour, outside the descriptor vocabulary.
            next_piece = Piece(
                piece_id=self._next_shape_id(),
                width=cooked.width,
                height=cooked.height,
                cells=cooked.cells,
                descriptor=0,
            )
            with self._lock:
                engine.spawn(
                    slot,
                    cooked.cells,
                    shape_width=cooked.width,
                    shape_height=cooked.height,
                )
                self._mark_transition_pending(slot)
            # ORDER MATTERS: release (S2C 66) BEFORE the piece event (S2C 64).
            #
            # This mirrors the client's own spawn-from-queue path, which calls
            # lk.b(-19939) to take the shape out of the queue and then
            # lk.a(int,int,rf) to install it as the active piece in the same
            # pass (qc.java case 214 -> 221).
            #
            # Sending them the other way round leaves a window where the board
            # has had its queue drained but no active piece installed yet. The
            # client concludes that board is dead, sets field_Bb and raises the
            # T5 self-disconnect -- captured live with a nearly EMPTY board
            # (fill 16/144), so it was never a real top-out:
            #   client 1077 [CT] RELEASE
            #   client 1079 Error: T5: 1 3 true
            #   client 1085 [CT] INSTALL id=17 3x3
            # Exactly one release, matching what we queued: lk.b(-19939) throws
            # IllegalStateException if asked to release more than are pending.
            self.broadcast_cooked_release(slot, 1)
            self.broadcast_piece_event(slot, next_piece, lock)
            with self._lock:
                spawned = engine.players[slot].active
                fill = engine.players[slot].board.occupied_count()
                remaining = len(self.pending_garbage.get(slot, ()))
            _trace(
                f"SPAWN slot={slot} queued_id={cooked.shape_id} "
                f"piece_id={next_piece.piece_id} colour={cooked.colour} "
                f"rf={cooked.width}x{cooked.height} "
                f"cells={sum(1 for cell in cooked.cells if cell)} "
                f"board_fill={fill} still_queued={remaining}"
            )
            _trace(f"SPAWN slot={slot} engine {_describe_piece(spawned)}")

        # NOTE: do NOT snapshot the board here. A remote replica keeps its OWN
        # deterministic simulation from the relayed action stream (S2C 63) + piece
        # events (S2C 64) and DOES run the colour-clear locally (the lk.field_kb
        # gate only suppresses the clear's network notification, not the clear
        # itself -- verified live via CLEAR-ZERO field_kb=false). Pushing an
        # authoritative snapshot into a live remote board arrives one or more
        # updates STALE (its field_U < the replica's) and reverts cells the
        # replica is mid-way through clearing, which makes the next active piece
        # overflow -> lk.field_Bb=true -> the qc.b "T5" self-disconnect. Live
        # replicas are therefore input-driven; snapshots are only for INITIAL
        # state (match-start seed, spectator join). See
        # test_no_ongoing_snapshot_into_live_remote_replica.
        print(
            f"[game] authoritative transition slot={slot} "
            f"final=({lock.x},{lock.y}) rotation={lock.orientation} "
            f"lives={lock.lives_remaining} next={next_piece.piece_id}"
        )
        # Re-seat every replica of this slot, now, on the transition itself.
        #
        # This reverses the NOTE above, which assumed a replica's own
        # simulation stays faithful and only needs the action stream and the
        # piece events. It does not. The replica runs its OWN colour-clear, and
        # that clear does not agree with this engine's. Measured 2026-07-25 by
        # comparing committed cell counts at equal landing indices -- a metric
        # with no phase ambiguity, unlike board dumps:
        #
        #   slot 2   server 10 12 14 16 18 20     client 10 12 14 12 14 16
        #   slot 1   server 24 26 28 25 27        client 24 26 28 26 28
        #
        # On slot 2 the replica cleared four cells where this engine cleared
        # none at all; on slot 1 both cleared on the same landing but removed
        # five cells against four. Each side then builds on its own stack, so
        # the divergence is permanent and grows. It surfaces as the replica
        # coming to rest somewhere this engine did not put the piece, which
        # sets lk.field_y, latches field_Bb, and self-disconnects the human
        # with "T5" over an opponent's bucket.
        #
        # DEFAULT OFF, and the paragraph above is why it looked defensible
        # rather than why it works. The argument was that a snapshot sent here,
        # immediately behind the piece event, carries a field_U the replica has
        # just adopted and so cannot be stale. That reasons about SEND time. The
        # replica does not stop: lk.d ticks every rendered frame, so by ARRIVAL
        # the packet always describes a board the replica has already moved on
        # from. There is no moment at which a snapshot into a live board is
        # fresh, which is exactly what the "Do NOT push snapshots into a LIVE
        # remote board" section of docs/multiplayer-gameplay-protocol.md says --
        # a rule this code overrode, along with the regression test that had
        # been written to enforce it.
        #
        # Reported 2026-07-26 and consistent with that section's prediction:
        # opponent buckets showed "pieces teleporting and board changing". S2C
        # 61 rewrites field_q/field_L/field_ab as well as the grid, so one stale
        # packet jumps the active piece AND reverts settled cells the replica is
        # mid clear-animation on -- both halves of the report, in one packet,
        # on every single landing.
        #
        # The divergence measured below is real and still unfixed, but a
        # correction that fires ~50 times a match is worse than the fault it
        # was masking. Set DEKOBLOKO_RESYNC_ON_TRANSITION=1 to re-enable for
        # experiments. The cure remains making the engine's clear rules match
        # the client's -- measured with tools/oracle, not read off the
        # decompiled source.
        if os.environ.get("DEKOBLOKO_RESYNC_ON_TRANSITION") == "1":
            self.broadcast_authoritative_snapshot(slot)
        elif lock.life_lost:
            # Rare (at most twice a match before elimination), and lk.field_jb
            # rides only in packet 61 (lk.java:4964), so there is no cheaper
            # channel for it.
            self.resync_lives(slot, lock.lives_remaining)

    def _dispatch_returned_shapes(self, source_slot: int, lock: LockResult) -> bool:
        """Target cooked shapes round-robin across the remaining live opponents."""
        engine = self.engine
        if engine is None:
            return False
        for returned in lock.returned_shapes:
            target = self._next_feedback_target(source_slot)
            if target is None:
                return False
            cooked = self.send_cooked_feedback(
                target,
                returned.colour,
                returned.width,
                returned.height,
                returned.occupied,
            )
            # S2C 67 only QUEUES the shape (field_e=0, "pending") as the visible
            # incoming-material warning. Hold it there until the target's next
            # piece transition, which spawns it as their FALLING piece and
            # releases it from the queue (S2C 66) in the same breath.
            #
            # It is deliberately NOT settled into the target's grid here. The
            # earlier code wrote the cells immediately via receive_feedback and
            # pushed a snapshot, which made garbage appear fully-placed the
            # instant it was sent -- no descent, nothing to steer or react to.
            # A life is lost only if the shape overflows when it LANDS, which
            # falls out of the ordinary finalize path.
            with self._lock:
                self.pending_garbage.setdefault(target, []).append(cooked)
            print(
                f"[game] feedback queued source={source_slot} target={target} "
                f"shape={cooked.shape_id} {cooked.width}x{cooked.height} "
                f"colour={cooked.colour} cells={sum(returned.occupied)} "
                f"of {len(lock.returned_shapes)} cursor={self.feedback_cursor}"
            )
        return False

    def _next_feedback_target(self, source_slot: int) -> int | None:
        with self._lock:
            player_count = len(self.players)
            cursor = self.feedback_cursor[source_slot]
            for offset in range(1, player_count + 1):
                candidate = (cursor + offset) % player_count
                if candidate != source_slot and candidate not in self.inactive_slots:
                    self.feedback_cursor[source_slot] = candidate
                    return candidate
        return None

    def _complete_authoritative_elimination(self, slot: int, reason: str) -> None:
        engine = self.engine
        if engine is None:
            return
        # Broadcast while the slot is still addressable, then tombstone it.
        self._broadcast_player_removed(slot, 0)
        with self._lock:
            self.inactive_slots.add(slot)
            winner_slot = engine.winner_slot if engine.outcome is Outcome.WON else None
            winner = self.players[winner_slot] if winner_slot is not None else None
        print(f"[game] authoritative slot={slot} eliminated by {reason}")
        if winner is not None:
            self.end_game(winner)
        elif engine.outcome is Outcome.DRAW:
            self.end_game(None)

    def debug_advance_piece(self, sender: LobbySession) -> None:
        """Refuse the old manual transition path now that state is authoritative."""
        sender.send_server_message(
            "Pieces advance only when the server-owned bucket reaches its lock boundary."
        )

    def _broadcast_player_removed(self, slot: int, result_code: int) -> None:
        with self._lock:
            recipients = self.replication_recipients()
        for recipient in recipients:
            _safe_call(lambda p=recipient: p.send_player_removed(slot, result_code))

    def end_game(self, winner: LobbySession | None, result_code: int = 0) -> None:
        """Finish the game: per-player results first, then teardown.

        ORDER IS LOAD-BEARING and is the whole reason this is one method:

          1. opcode 62 for every loser  (removes the slot, fires the defeat UI)
          2. opcode 70 to EVERYONE      (announces the winner by slot index)
          3. opcode 60 to everyone      (tears the game down)

        Opcode 60 clears the state the other two refer to, so sending it first
        strands the results and the client shows nothing.

        CONFIRMED LIVE 2026-07-25. This ordering, and the claim that 60 tears
        down what 62 and 69 set up, were previously reasoned from a static read
        with the warning "if the end-of-game screen misbehaves, suspect this
        ordering first". That is exactly what happened, and the diagnosis held:
        while 60 was sent here, a finished match flashed nothing and dumped the
        player straight back to the lobby. With 60 withheld until dismiss(), the
        defeat UI renders for real -- an eliminated opponent now shows

            PLAYER 3 IS OUT

        on screen. So opcode 62's defeat UI is execution-proven, and 60 is
        confirmed to be the teardown rather than part of the result display.

        FIXED 2026-07-26: the winner used to be sent opcode 69, which showed
        the "Panic!" screen. That was not a wrong result byte -- 69 is simply
        NOT the winner packet. It is the in-game PANIC banner, and its byte is
        a music tempo level (qc.field_T -> qc.b -> mb.a -> ob.a, a playback
        rate). No byte of 69 could ever have produced a win screen.

        The winner packet is opcode 70, carrying the winner's SLOT INDEX read
        as a signed byte. Measured across all 256 values with the local player
        in two different slots (tools/oracle/WinBannerProbe):

            byte == my slot      -> "YOU WIN!"
            byte == another slot -> "<NAME> WINS!"
            byte  < 0            -> "DRAW!"
            byte >= roster size  -> the client throws and dies

        so it is broadcast to everyone -- the losers' "<NAME> WINS!" line comes
        from the same packet -- and the slot is range-checked before sending.

        Still missing: no score payload accompanies the result, so the win
        menu's scores and highscore table cannot populate, and the post-game
        S2C 71-74 masks that the rematch UI reads have no senders at all. See
        docs/multiplayer-gameplay-protocol.md.
        """
        with self._lock:
            if self.state != "playing":
                return
            active_players = self.active_players()
            # A just-defeated slot is already tombstoned but still needs the
            # final opcode 60 teardown. A disconnected session has cleared its
            # current_game and must not be called.
            recipients = self.attached_sessions()
            self.state = "finished"

        for player in active_players:
            if player is winner:
                continue
            slot = player.player_slot
            if slot is not None:
                self._broadcast_player_removed(slot, result_code)

        # Opcode 70 goes to EVERY attached session, winner included: each client
        # compares the byte against its own slot to choose "YOU WIN!" versus
        # "<NAME> WINS!". A slot >= the client's roster length crashes it with an
        # ArrayIndexOutOfBoundsException, so an unknown or out-of-range winner
        # degrades to the signed-negative "DRAW!" byte rather than a dead client.
        winner_slot = None if winner is None else winner.player_slot
        if winner_slot is None or not 0 <= winner_slot < len(self.players):
            if winner is not None:
                print(
                    f"[game] game {self.game_id} winner slot {winner_slot} is "
                    f"outside the roster of {len(self.players)}; sending DRAW"
                )
            winner_slot = DRAW_RESULT_SLOT
        for player in recipients:
            _safe_call(lambda p=player: p.send_match_result(winner_slot))

        # Opcode 60 is DELIBERATELY not sent here, and the room is deliberately
        # not retired yet. 62 and 69 raise the defeat/win screen; 60 tears it
        # straight back down, and _on_game_finished then clears current_game and
        # removes the room. Doing all of that at once meant the result screen was
        # destroyed in the same breath as it was created, so a finished match
        # dumped the player back in the lobby with no won/lost screen at all --
        # exactly the failure this method's own docstring warned to suspect
        # first, since the ordering had been read from bytecode but never run.
        #
        # Instead the game sits in "finished" holding the screen, and each player
        # is torn down individually when THEY dismiss it (see dismiss()). The
        # room is retired once everyone has.
        self.awaiting_dismissal = list(recipients)

        print(
            f"[game] game {self.game_id} ended; winner="
            f"{winner.display_name if winner else 'none'}"
            f"; holding result screen for {len(recipients)} player(s)"
        )

    def dismiss(self, session: LobbySession) -> None:
        """One player has acknowledged the result screen: tear their game down.

        This is the opcode 60 that end_game withholds. It is per-session on
        purpose -- one player leaving the results must not yank the screen out
        from under anyone still reading it -- and the room is only retired once
        the last of them has gone.
        """
        pending = getattr(self, "awaiting_dismissal", None)
        if pending is None:
            return
        # Drop anyone who disconnected rather than dismissing, or the room would
        # be held open forever by a session that can never answer.
        attached = set(self.attached_sessions())
        pending[:] = [
            player for player in pending if player is session or player in attached
        ]
        if session in pending:
            pending.remove(session)
            _safe_call(session.send_game_over)
            print(f"[game] game {self.game_id} dismissed by {session.display_name}")
        if not pending:
            self.awaiting_dismissal = None
            if self.on_finished is not None:
                self.on_finished(self)


# How many scores to keep per player per board. The client's request asked for
# rows=10, so anything beyond that can never be displayed.
MAX_SCORES_PER_BOARD = 10


class Lobby:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sessions: set[LobbySession] = set()
        self._games: dict[int, HostedGame] = {}
        self._game_ids = itertools.count(1)
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
        self._send_all_room_updates(session)
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
        return [
            (self.uid_for(session.display_name), session.display_name, 0, 0)
            for session in sessions
        ]

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

    @staticmethod
    def _effective_chat_channel(sender: LobbySession, channel: int) -> int:
        """Resolve the client's context channel to a concrete route.

        CONFIRMED against the client's own send path (nm.java text chat and
        ig.java quickchat both call ce.a, which writes `pk.field_r` as the
        channel byte): the sent byte is the SELECTED TAB, which is 0 for the
        default tab EVEN WHILE IN A ROOM. The client never upgrades the byte to
        1 -- the room-aware value it computes (nm.java var5) is only used for a
        local mute check, not the wire. So channel 0 means "my current context":
        the server must route it to the sender's ROOM when they are in one, and
        to the lobby otherwise. Without this, every in-room message the user
        types lands in the lobby channel (the reported bug).
        """
        if channel == 0 and sender.current_game is not None:
            return 1
        return channel

    def relay_chat_payload(
        self, sender: LobbySession, count: int, body: bytes, channel: int
    ) -> None:
        """Route a client's already-compressed chat without decoding/re-encoding it."""
        channel = self._effective_chat_channel(sender, channel)
        if channel == 0:
            recipients = self.sessions_snapshot()
            payload = build_chat_broadcast(sender.display_name, count, body, 0)
        elif channel == 1 and sender.current_game is not None:
            game = sender.current_game
            recipients = game.replication_recipients()
            payload = build_chat_broadcast(
                sender.display_name,
                count,
                body,
                1,
                room_id=game.game_id,
                room_owner=game.host.display_name,
            )
        else:
            return
        for recipient in recipients:
            _safe_call(lambda peer=recipient: peer.send_chat_payload(11, payload))

    def relay_quickchat(
        self, sender: LobbySession, quickchat_id: int, channel: int
    ) -> None:
        """Apply the same lobby/room boundary to canned quick-chat messages."""
        channel = self._effective_chat_channel(sender, channel)
        if channel == 0:
            recipients = self.sessions_snapshot()
            payload = build_quickchat_broadcast(
                sender.display_name, quickchat_id, channel=0
            )
        elif channel == 1 and sender.current_game is not None:
            game = sender.current_game
            recipients = game.replication_recipients()
            payload = build_quickchat_broadcast(
                sender.display_name,
                quickchat_id,
                channel=1,
                room_id=game.game_id,
                room_owner=game.host.display_name,
            )
        else:
            return
        for recipient in recipients:
            _safe_call(lambda peer=recipient: peer.send_chat_payload(12, payload))

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
                self.join_game(sender, waiting.game_id)
            return
        if game.host is sender and game.state == "waiting":
            self.start_game(sender)
            return
        if game.state == "playing":
            sender.send_server_message(
                "The game button is not a piece request; transitions are server-driven."
            )
            return
        if game.state == "finished":
            # The lobby button on a result screen means "I'm done looking at
            # this", so treat it as the dismissal and send them back.
            self.leave_game(sender, announce=False)
            return
        sender.send_server_message("Only the host can start this game. Type ::leave to leave it.")

    @staticmethod
    def parse_game_specific_options(
        body: bytes, base: GameOptions | None = None
    ) -> GameOptions | None:
        """Decode the 5-byte gameSpecificOptions at body[2:7] into GameOptions.

        Confirmed by reflection-reading the client's OWN writers (2026-07-23):
        the create writer (ad.java:201) emits [maxPlayers][flags=0x80][5B
        gameSpecificOptions] and SET_ROOM_OPTIONS (qa.java:26) emits
        [field_mc][(field_qc<<6)|field_Wb][5B field_kc] -- in BOTH the 5-byte
        array (ve.field_kc) sits at body[2:7], in room_bytes() order:
        [bucket, speed, colours-3, special, feedback]. field_kc[0] != 0 == large
        bucket. Theme is NOT here (the server picks it), matching room_bytes.
        """
        if len(body) < 7:
            return None
        kc = body[2:7]
        feedback = kc[4]
        return replace(
            base or GameOptions(),
            bucket_large=kc[0] != 0,
            speed_index=kc[1],
            colours=kc[2] + 3,
            special_level=kc[3],
            # room_bytes maps bombardment->feedback as (3 if 0 else level-1);
            # invert it here.
            bombardment_level=0 if feedback == 3 else feedback + 1,
        )

    def apply_room_options(self, host: LobbySession, body: bytes) -> bool:
        """Handle SET_ROOM_OPTIONS (action 5): update the waiting room's options."""
        game = host.current_game
        if game is None or game.host is not host or game.state != "waiting":
            return False
        options = self.parse_game_specific_options(body, game.options)
        if options is None:
            return False
        with self._lock:
            game.options = options
        self._broadcast_room_update(game)
        return True

    def create_game(
        self, host: LobbySession, options: GameOptions | None = None
    ) -> HostedGame:
        # Spectating attaches the viewer to someone else's match
        # (add_spectator sets current_game). If we do not detach first, the
        # guard below hands back the SPECTATED room -- owned by another player
        # -- with no YOU_JOINED_ROOM reply, so "create game" silently drops the
        # user into that room as a non-host. Leaving is the right resolution:
        # you cannot host a new game while glued to another one as an observer.
        current = host.current_game
        if current is not None and current.is_spectator(host):
            self.leave_game(host, announce=False)
        with self._lock:
            if host.current_game is not None:
                return host.current_game
            game_id = next(self._game_ids)
            game = HostedGame(
                game_id=game_id,
                host=host,
                options=options or GameOptions(),
                on_finished=self._on_game_finished,
            )
            self._games[game_id] = game
        owner_id = self.uid_for(host.display_name)
        self._send_lobby_event(
            host,
            build_create_room_reply(
                game.game_id,
                owner_id,
                host.display_name,
                options=game.options.room_bytes(),
                allow_spectators=game.options.allow_spectators,
                invite_only=game.options.invite_only,
            ),
        )
        self._send_lobby_event(
            host, build_player_joined_room(owner_id, host.display_name)
        )
        self._broadcast_room_update(game)
        self._broadcast_lobby_status(f"{host.display_name} created game {game_id}.", exclude=host)
        return game

    def invite_player(self, host: LobbySession, invited_uid: int) -> bool:
        game = host.current_game
        if game is None or game.host is not host or game.state != "waiting":
            return False
        invitee = self._session_for_uid(invited_uid)
        if invitee is None or invitee is host:
            return False
        game.invitations.add(invited_uid)
        self._send_lobby_event(invitee, build_room_invitation(game.game_id))
        self._send_lobby_event(host, build_host_invitation_added(invited_uid))
        self._broadcast_room_update(game)
        return True

    def kick_player(self, host: LobbySession, target_uid: int) -> bool:
        """Remove a real waiting-room participant selected by lobby uid."""
        game = host.current_game
        target = self._session_for_uid(target_uid)
        if (
            game is None
            or game.host is not host
            or game.state != "waiting"
            or target is None
            or target is host
            or target not in game.players
        ):
            return False
        if not game.remove_player(target):
            return False
        self._send_lobby_event(target, build_kicked_room_reply())
        left = build_player_left_room(target_uid, reason=12)
        for player in game.players:
            self._send_lobby_event(player, left)
        self._broadcast_room_update(game)
        return True

    def join_game(self, session: LobbySession, game_id: int) -> HostedGame | None:
        with self._lock:
            game = self._games.get(game_id)
        if game is None:
            session.send_server_message(f"No game {game_id} exists.")
            return None
        if session.current_game is not None and session.current_game is not game:
            self.leave_game(session, announce=False)
        if game.state == "playing":
            self.spectate_game(session, game_id)
            return game
        session_uid = self.uid_for(session.display_name)
        if game.options.invite_only and session_uid not in game.invitations:
            session.send_server_message("This room is invitation-only.")
            return None
        existing = list(game.players)
        try:
            slot = game.add_player(session)
        except ValueError as exc:
            session.send_server_message(str(exc))
            return None
        self._send_lobby_event(
            session,
            build_create_room_reply(
                game.game_id,
                self.uid_for(game.host.display_name),
                game.host.display_name,
                options=game.options.room_bytes(),
                allow_spectators=game.options.allow_spectators,
                invite_only=game.options.invite_only,
            ),
        )
        for player in existing:
            self._send_lobby_event(
                session,
                build_player_joined_room(
                    self.uid_for(player.display_name), player.display_name
                ),
            )
        joined_packet = build_player_joined_room(
            self.uid_for(session.display_name), session.display_name
        )
        for player in game.players:
            self._send_lobby_event(player, joined_packet)
        if session_uid in game.invitations:
            game.invitations.discard(session_uid)
            self._send_lobby_event(
                game.host,
                build_host_invitation_removed(session_uid, status=2),
            )
        self._broadcast_room_update(game)
        game.broadcast_message(
            f"{session.display_name} joined game {game.game_id} as slot {slot}."
        )
        return game

    def spectate_game(self, session: LobbySession, game_id: int) -> None:
        with self._lock:
            game = self._games.get(game_id)
        if game is None:
            session.send_server_message(f"No game {game_id} exists.")
            return
        if game.state != "playing":
            session.send_server_message("Only running games can be spectated.")
            return
        if not game.options.allow_spectators:
            session.send_server_message("This game does not allow spectators.")
            return
        if session.current_game is game:
            if game.is_spectator(session):
                game.send_all_authoritative_snapshots(session)
                session.send_server_message(
                    f"Already spectating game {game_id}; snapshots refreshed."
                )
            else:
                session.send_server_message("Players cannot spectate their own match.")
            return
        if session.current_game is not None:
            self.leave_game(session, announce=False)
        try:
            game.add_spectator(session)
        except ValueError as exc:
            session.send_server_message(str(exc))
            return
        game.broadcast_message(
            f"{session.display_name} is now spectating game {game.game_id}."
        )

    def stop_spectating(self, session: LobbySession) -> None:
        game = session.current_game
        if game is None or not game.is_spectator(session):
            return
        game.remove_player(session)
        game.broadcast_message(
            f"{session.display_name} stopped spectating game {game.game_id}."
        )

    def leave_game(self, session: LobbySession, announce: bool = True) -> None:
        game = session.current_game
        if game is None:
            return
        was_host = game.host is session
        was_playing = game.state == "playing"
        was_spectator = game.is_spectator(session)
        departed_uid = self.uid_for(session.display_name)
        removed_player = game.remove_player(session)

        if removed_player and not was_playing:
            left = build_player_left_room(departed_uid, reason=13)
            for player in game.players:
                self._send_lobby_event(player, left)

        # A resign that leaves exactly one player standing is a WIN for them,
        # not just a departure. Routing it through end_game is what sends the
        # winner their opcode 69 and then tears the game down in the right
        # order; without this the last player sits in a finished game that
        # never resolves.
        if was_playing and removed_player:
            remaining = game.active_players()
            if len(remaining) == 1:
                game.end_game(remaining[0])
        if game.state == "finished":
            # Leaving a finished game IS dismissing its result screen: this is
            # where the withheld opcode 60 finally goes out.
            game.dismiss(session)
            if announce:
                session.send_server_message(f"Left game {game.game_id}.")
            return
        if announce:
            action = "stopped spectating" if was_spectator else "left"
            game.broadcast_message(
                f"{session.display_name} {action} game {game.game_id}."
            )
            session.send_server_message(
                f"{'Stopped spectating' if was_spectator else 'Left'} game {game.game_id}."
            )
        with self._lock:
            active_players = game.active_players()
            if was_host or not active_players:
                self._games.pop(game.game_id, None)
                attached = game.attached_sessions()
                needs_teardown = game.state != "finished"
                game.spectators.clear()
                for recipient in attached:
                    recipient.current_game = None
                    recipient.player_slot = None
                    if needs_teardown:
                        _safe_call(recipient.send_game_over)
                    _safe_send_message(
                        recipient,
                        f"Game {game.game_id} closed because the host left.",
                    )
                remove = build_remove_room(game.game_id, reason=0)
                for peer in list(self._sessions):
                    self._send_lobby_event(peer, remove)
            elif not was_playing and removed_player:
                self._broadcast_room_update(game)

    def start_game(self, session: LobbySession) -> None:
        game = session.current_game
        if game is None:
            game = self.create_game(session)
        if game.host is not session:
            session.send_server_message("Only the game host can start the match.")
            return
        game.start()
        self._broadcast_room_update(game)

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
                f"players={len(game.players)}/8, spectators={len(game.spectators)}"
            )
        session.send_server_message("Hosted games: " + " | ".join(rows))

    def games_snapshot(self) -> list[HostedGame]:
        with self._lock:
            return list(self._games.values())

    def _session_for_uid(self, uid: int) -> LobbySession | None:
        with self._lock:
            sessions: list[LobbySession] = list(self._sessions)
        return next(
            (session for session in sessions if self.uid_for(session.display_name) == uid),
            None,
        )

    @staticmethod
    def _send_lobby_event(session: LobbySession, payload: bytes) -> None:
        callback = getattr(session, "send_lobby_event", None)
        if callback is not None:
            _safe_call(lambda: callback(payload))

    def _room_packet(
        self,
        game: HostedGame,
        recipient: LobbySession | None = None,
        *,
        concluded: bool = False,
    ) -> bytes:
        elapsed = int(max(0.0, time.time() - game.created_at) * 1000)
        invited = (
            recipient is not None
            and self.uid_for(recipient.display_name) in game.invitations
        )
        return build_add_room(
            game.game_id,
            self.uid_for(game.host.display_name),
            game.host.display_name,
            player_count=len(game.players),
            max_players=8,
            who_can_join=0 if game.options.invite_only else 4,
            options=game.options.room_bytes(),
            started=game.state in ("playing", "finished"),
            concluded=concluded or game.state == "finished",
            allow_spectators=game.options.allow_spectators,
            rated=game.options.rated,
            allow_join=(
                game.state == "waiting"
                and (not game.options.invite_only or invited)
            ),
            elapsed_ms=elapsed,
        )

    def _broadcast_room_update(self, game: HostedGame, *, concluded: bool = False) -> None:
        for session in self.sessions_snapshot():
            self._send_lobby_event(
                session,
                self._room_packet(game, session, concluded=concluded),
            )

    def _send_all_room_updates(self, session: LobbySession) -> None:
        for game in self.games_snapshot():
            self._send_lobby_event(session, self._room_packet(game, session))

    def _on_game_finished(self, game: HostedGame) -> None:
        """Return every participant/observer to the lobby and retire its room."""
        self._broadcast_room_update(game, concluded=True)
        with self._lock:
            if self._games.get(game.game_id) is not game:
                return
            self._games.pop(game.game_id, None)
            attached = game.attached_sessions()
            game.spectators.clear()
            game.invitations.clear()
            for session in attached:
                session.current_game = None
                session.player_slot = None
        remove = build_remove_room(game.game_id, reason=0)
        for session in self.sessions_snapshot():
            self._send_lobby_event(session, remove)
        self._broadcast_lobby_status(
            f"Game {game.game_id} is over; its players returned to the lobby."
        )

    def _handle_command(self, sender: LobbySession, command_line: str) -> None:
        parts = command_line.split()
        command = parts[0].lower() if parts else "help"

        if command in {"help", "?"}:
            sender.send_server_message(
                "Commands: ::create, ::games, ::join <id>, ::spectate <id>, "
                "::start, ::resync, ::leave, ::where"
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
        if command in {"spectate", "watch"}:
            if len(parts) != 2:
                sender.send_server_message("Usage: ::spectate <game-id>")
                return
            self.spectate_game(sender, int(parts[1]))
            return
        if command == "start":
            self.start_game(sender)
            return
        if command == "piece":
            game = sender.current_game
            if game is None or game.state != "playing":
                sender.send_server_message("You are not in a running game.")
                return
            game.debug_advance_piece(sender)
            return
        if command == "resync":
            game = sender.current_game
            if game is None or game.state != "playing":
                sender.send_server_message("You are not in a running game.")
                return
            game.send_all_authoritative_snapshots(sender)
            sender.send_server_message("Authoritative board snapshots sent.")
            return
        if command in {"leave", "quit"}:
            self.leave_game(sender)
            return
        if command == "where":
            game = sender.current_game
            if game is None:
                sender.send_server_message("You are in the lobby.")
            else:
                role = (
                    "spectator"
                    if game.is_spectator(sender)
                    else f"slot {sender.player_slot}"
                )
                sender.send_server_message(
                    f"You are in game {game.game_id}, state={game.state}, role={role}."
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
