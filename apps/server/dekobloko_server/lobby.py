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
from typing import Callable, Protocol

from .engine import AuthoritativeMatch, LockResult, Outcome
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

    def send_winner(self, result_code: int) -> None:
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
            now = time.monotonic()
            self.control_credit = [CONTROL_BURST_TICKS] * len(self.players)
            self.control_refill_at = [now] * len(self.players)
            self.ticks_since_snapshot = [0] * len(self.players)

        for index, player in enumerate(players):
            player.send_match_start(self, index)

        self.broadcast_message(f"Game {self.game_id} started with {len(players)} player(s).")

        # Packet 64 is a transition: correct/finalize the prior active piece,
        # then spawn this one. At match start there is no prior piece, so the
        # zero correction fields in GameSession.send_piece_event are benign.
        # Packet 67 is not a normal "next piece": it fills the incoming
        # bombardment/feedback-shape queue. Sending a second ordinary domino
        # there at startup falsely attacks every board, so startup sends only
        # the transition packet. It is broadcast because every client maintains
        # a deterministic replica of every live board.
        for slot, _player in enumerate(players):
            active = self.next_piece()
            with self._lock:
                self.engine.spawn(slot, (active.cells[0], active.cells[1]))
                self._mark_transition_pending(slot)
            self.broadcast_piece_event(slot, active)

    def next_piece(self) -> Piece:
        piece_id = self._next_shape_id()

        colour_count = max(1, min(7, self.options.colours))
        cell_a, nibble_a = self._next_piece_cell(colour_count)
        cell_b, nibble_b = self._next_piece_cell(colour_count)
        descriptor = ((nibble_a & 0xF) << 4) | (nibble_b & 0xF)

        # lc.b constructs an ordinary piece from two descriptor nibbles as a
        # 2x1 domino. Ordinary cells use 16+colour; 24+kind is reserved for
        # special items. The former tetromino generator violated both rules.
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
        if level >= 2:
            enabled.extend(((24, 8), (25, 9)))
        if level >= 3:
            enabled.extend(((26, 10), (27, 11)))
        if level >= 4:
            enabled.extend(((28, 12), (29, 13)))
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

        relay_payload = payload
        if len(accepted_controls) != len(controls):
            relay_payload = bytes([len(accepted_controls)]) + pack_5bit(accepted_controls)
            print(
                f"[game] trimmed {len(controls) - len(accepted_controls)} "
                f"post-landing control sample(s) from slot={slot}"
            )

        with self._lock:
            recipients = [
                recipient
                for recipient in self.replication_recipients()
                if recipient is not sender
            ]
        for recipient in recipients:
            _safe_call(lambda p=recipient: p.send_action_stream(slot, relay_payload))

        print(
            f"[game] controls slot={slot} samples={len(accepted_controls)} "
            f"client_short_batch={len(accepted_controls) < 20} "
            f"authoritative_landed={landed} masks={accepted_controls!r}"
        )
        if authoritative:
            with self._lock:
                self.ticks_since_snapshot[slot] += len(accepted_controls)
                proactive = (
                    not landed
                    and self.ticks_since_snapshot[slot] >= PROACTIVE_SNAPSHOT_TICKS
                )
                if proactive:
                    self.ticks_since_snapshot[slot] = 0
            if proactive:
                self.broadcast_authoritative_snapshot(slot)
                needs_sender_resync = False
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
        """Serialize the server-owned slot using the exact S2C 61 field order."""
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
            lock = engine.finalize_landed(slot)

        if lock.eliminated:
            self._complete_authoritative_elimination(slot, "final life")
            return

        if self._dispatch_returned_shapes(slot, lock):
            return

        next_piece = self.next_piece()
        with self._lock:
            engine.spawn(slot, (next_piece.cells[0], next_piece.cells[1]))
            self._mark_transition_pending(slot)
        self.broadcast_piece_event(slot, next_piece, lock)
        print(
            f"[game] authoritative transition slot={slot} "
            f"final=({lock.x},{lock.y}) rotation={lock.orientation} "
            f"lives={lock.lives_remaining} next={next_piece.piece_id}"
        )

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
            with self._lock:
                eliminated = engine.receive_feedback(target, returned, cooked.shape_id)
            print(
                f"[game] feedback source={source_slot} target={target} "
                f"shape={cooked.shape_id} {cooked.width}x{cooked.height}"
            )
            if eliminated:
                self._complete_authoritative_elimination(target, "incoming feedback")
                return self.state != "playing"
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
          2. opcode 69 to the winner    (sets qc.field_r, pushes the win UI)
          3. opcode 60 to everyone      (tears the game down)

        Opcode 60 clears the state the other two refer to, so sending it first
        strands the results and the client shows nothing.

        Proven vs not: the BYTE LAYOUTS of 62/69/60 are execution-proven, and 60
        active-count decrement, the defeat/win UI, the teardown clearing
        fm.field_b / am.field_c / fa.field_n -- were read from bytecode but never
        run, because driving them needs AWT. So this ordering is reasoned from a
        static read, not measured. If the end-of-game screen misbehaves, suspect
        this ordering first.
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

        if winner is not None:
            _safe_call(lambda: winner.send_winner(result_code))

        for player in recipients:
            _safe_call(lambda p=player: p.send_game_over())

        print(
            f"[game] game {self.game_id} ended; winner="
            f"{winner.display_name if winner else 'none'}"
        )
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

    def relay_chat_payload(
        self, sender: LobbySession, count: int, body: bytes, channel: int
    ) -> None:
        """Route a client's already-compressed chat without decoding/re-encoding it."""
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
        sender.send_server_message("Only the host can start this game. Type ::leave to leave it.")

    def create_game(
        self, host: LobbySession, options: GameOptions | None = None
    ) -> HostedGame:
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
