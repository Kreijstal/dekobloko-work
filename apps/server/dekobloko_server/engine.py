"""Authoritative, renderer-free Dekobloko multiplayer bucket engine.

This is the Python port of game-logic's differentially verified ActiveDomino
and AuthoritativeMultiplayerMatch. Network code supplies ordered 5-bit control
masks; it never supplies positions, lives, elimination, or a winner.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


LEFT = 1
RIGHT = 2
ROTATE_COUNTER_CLOCKWISE = 4
ROTATE_CLOCKWISE = 8
FAST_DROP = 16
ALL_CONTROLS = 31
LOCK_DELAY_TICKS = 20
SPEED_TICKS = (40, 30, 24, 19, 15, 12, 9, 6, 4, 2, 0)
WILDCARD_CELL = 23
EARTHQUAKE_CELL = 24
DRILL_CELL = 25
BOMB_CELL = 26
POWER_DRILL_CELL = 27
WATER_CELL = 28
POISON_CELL = 29


class Outcome(Enum):
    RUNNING = "running"
    WON = "won"
    DRAW = "draw"


@dataclass(frozen=True)
class ReturnedShape:
    colour: int
    width: int
    height: int
    occupied: tuple[bool, ...]


@dataclass(frozen=True)
class LockResult:
    x: int
    y: int
    orientation: int
    lives_remaining: int
    life_lost: bool
    placed_cells: frozenset[tuple[int, int]]
    returned_shapes: tuple[ReturnedShape, ...] = ()

    @property
    def eliminated(self) -> bool:
        return self.lives_remaining == 0


class Board:
    def __init__(self, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            raise ValueError("board dimensions must be positive")
        self.width = width
        self.height = height
        self.cells = [[0 for _x in range(width)] for _y in range(height)]
        self.solid_ids = [[0 for _x in range(width)] for _y in range(height)]
        self.next_solid_id = 1

    def get(self, x: int, y: int) -> int:
        self._require(x, y)
        return self.cells[y][x]

    def set(self, x: int, y: int, value: int) -> None:
        self._require(x, y)
        if value < 0:
            raise ValueError("packed cells cannot be negative")
        self.cells[y][x] = value
        self.solid_ids[y][x] = 0

    def set_solid(self, x: int, y: int, colour: int, shape_id: int) -> None:
        self._require(x, y)
        if colour < 0 or colour > 6 or shape_id <= 0:
            raise ValueError("solid cells require colour 0..6 and a positive shape id")
        self.cells[y][x] = 8 | colour
        self.solid_ids[y][x] = shape_id
        self.next_solid_id = max(self.next_solid_id, shape_id + 1)

    def allocate_solid_id(self) -> int:
        shape_id = self.next_solid_id
        self.next_solid_id += 1
        return shape_id

    def positions_for_solid(self, shape_id: int) -> set[tuple[int, int]]:
        return {
            (x, y)
            for y in range(self.height)
            for x in range(self.width)
            if self.solid_ids[y][x] == shape_id
        }

    def occupied_count(self) -> int:
        return sum(cell != 0 for row in self.cells for cell in row)

    def collapse_loose(self) -> None:
        moved = True
        while moved:
            moved = False
            for y in range(self.height - 2, -1, -1):
                for x in range(self.width):
                    cell = self.cells[y][x]
                    if cell and _is_loose(cell) and self.cells[y + 1][x] == 0:
                        self.cells[y + 1][x] = cell
                        self.solid_ids[y + 1][x] = self.solid_ids[y][x]
                        self.cells[y][x] = 0
                        self.solid_ids[y][x] = 0
                        moved = True

    def earthquake(self) -> None:
        preferred = 1
        active = True
        while active:
            active = False
            for y in range(self.height - 1, -1, -1):
                for x in range(self.width - 1, -1, -1):
                    cell = self.cells[y][x]
                    if not cell or not _is_loose(cell):
                        continue
                    target: tuple[int, int] | None = None
                    if y < self.height - 1 and self.cells[y + 1][x] == 0:
                        target = (x, y + 1)
                    elif y < self.height - 1:
                        for direction in (preferred, -preferred):
                            target_x = x + direction
                            if (
                                0 <= target_x < self.width
                                and self.cells[y][target_x] == 0
                                and self.cells[y + 1][target_x] == 0
                            ):
                                target = (target_x, y)
                                break
                    if target is not None:
                        target_x, target_y = target
                        self.cells[target_y][target_x] = cell
                        self.cells[y][x] = 0
                        active = True
            if active:
                preferred = -preferred

    def _require(self, x: int, y: int) -> None:
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            raise IndexError(f"board coordinates out of range: ({x},{y})")


class ActiveDomino:
    """Exact per-tick active 2x1 piece state used by the original ``lk``."""

    def __init__(
        self,
        board: Board,
        cells: tuple[int, int],
        base_drop_ticks: int,
        *,
        orientation: int = 0,
        top_x: int | None = None,
        top_y: int | None = None,
        previous_controls: int = 0,
        horizontal_repeat: int = 0,
        drop_countdown: int | None = None,
        forced_drop_countdown: int | None = None,
        grounded: bool = False,
        landed: bool = False,
        vertical_parity: int = 0,
        horizontal_parity: int | None = None,
    ) -> None:
        if len(cells) != 2 or any(cell == 0 for cell in cells):
            raise ValueError("an active domino requires two occupied cells")
        if base_drop_ticks < 0:
            raise ValueError("base drop ticks cannot be negative")
        self.board = board
        self.cells = cells
        self.base_drop_ticks = base_drop_ticks
        self.orientation = orientation & 3
        width, height = self.dimensions
        if top_x is None:
            top_x = (board.width - width) >> 1
        if top_y is None:
            top_y = -height + 1
        min_x, min_y = self._minimum_offsets(self.orientation)
        self._pivot_x = top_x - min_x
        self._pivot_y = top_y - min_y
        self.previous_controls = previous_controls & ALL_CONTROLS
        self.horizontal_repeat = horizontal_repeat
        self.drop_countdown = (
            max(base_drop_ticks, 2) if drop_countdown is None else drop_countdown
        )
        self.forced_drop_countdown = (
            80 + base_drop_ticks * board.height
            if forced_drop_countdown is None
            else forced_drop_countdown
        )
        if self.drop_countdown < 0 or self.forced_drop_countdown < 0:
            raise ValueError("piece countdowns cannot be negative")
        self.grounded = grounded
        self.landed = landed
        self.vertical_parity = vertical_parity
        self.horizontal_parity = (
            (1 if width == 2 else 0)
            if horizontal_parity is None
            else horizontal_parity
        )
        self.finalized = False

    @property
    def dimensions(self) -> tuple[int, int]:
        return ((2, 1) if self.orientation % 2 == 0 else (1, 2))

    @property
    def x(self) -> int:
        return self._pivot_x + self._minimum_offsets(self.orientation)[0]

    @property
    def y(self) -> int:
        return self._pivot_y + self._minimum_offsets(self.orientation)[1]

    @property
    def bitmap(self) -> tuple[int, ...]:
        width, height = self.dimensions
        result = [0] * (width * height)
        min_x, min_y = self._minimum_offsets(self.orientation)
        for cell, (x, y) in zip(self.cells, self._offsets(self.orientation)):
            result[(y - min_y) * width + x - min_x] = cell
        return tuple(result)

    @property
    def descriptor(self) -> int:
        def nibble(cell: int) -> int:
            packed = cell & 31
            if 16 <= packed <= 23:
                return packed - 16
            if 24 <= packed <= 31:
                return 8 | (packed - 24)
            raise ValueError(f"active cell {packed} has no domino descriptor nibble")

        return (nibble(self.cells[0]) << 4) | nibble(self.cells[1])

    def tick(self, controls: int) -> bool:
        self._require_mutable()
        if self.landed:
            return True
        controls &= ALL_CONTROLS
        pressed = (~self.previous_controls) & controls
        self.previous_controls = controls
        accelerate = False

        if self.forced_drop_countdown <= 0:
            accelerate = True
        else:
            self.forced_drop_countdown -= 1
            if pressed & LEFT:
                self._move_horizontal(-1)
                self.horizontal_repeat = -10
            elif pressed & RIGHT:
                self._move_horizontal(1)
                self.horizontal_repeat = 10

            if self.horizontal_repeat < 0:
                if not controls & LEFT:
                    self.horizontal_repeat = 0
                else:
                    self.horizontal_repeat += 1
                    if self.horizontal_repeat == 0:
                        self._move_horizontal(-1)
                        self.horizontal_repeat = -3
            elif self.horizontal_repeat > 0:
                if not controls & RIGHT:
                    self.horizontal_repeat = 0
                else:
                    self.horizontal_repeat -= 1
                    if self.horizontal_repeat == 0:
                        self._move_horizontal(1)
                        self.horizontal_repeat = 3

            if pressed & ROTATE_COUNTER_CLOCKWISE:
                self._rotate(clockwise=False)
            if controls & FAST_DROP:
                accelerate = True
            if pressed & ROTATE_CLOCKWISE:
                self._rotate(clockwise=True)

        if (
            accelerate
            and (self.forced_drop_countdown == 0 or controls & FAST_DROP)
            and self.drop_countdown > 2
        ):
            self.drop_countdown = 2
        if self.drop_countdown > 0:
            self._advance_descent(self.drop_countdown - 1, movement_recovery=False)
        return self.landed

    def finalize(self, lives: int) -> LockResult:
        self._require_mutable()
        if not self.landed:
            raise RuntimeError("active domino has not landed")
        if lives <= 0:
            raise ValueError("an active player must have at least one life")
        life_lost = self.y < 0
        remaining = lives - 1 if life_lost else lives
        placed: set[tuple[int, int]] = set()
        if not life_lost:
            for cell, (dx, dy) in zip(self.cells, self._offsets(self.orientation)):
                x, y = self._pivot_x + dx, self._pivot_y + dy
                self.board.set(x, y, cell)
                placed.add((x, y))
        elif remaining > 0:
            min_y = self._minimum_offsets(self.orientation)[1]
            _width, height = self.dimensions
            offsets = self._offsets(self.orientation)
            for row in range(height - 1, -1, -1):
                for index in range(1, -1, -1):
                    dx, dy = offsets[index]
                    if dy - min_y != row:
                        continue
                    x = self._pivot_x + dx
                    y = max(0, self._pivot_y + dy)
                    if y < self.board.height and self.board.get(x, y) == 0:
                        self.board.set(x, y, self.cells[index])
                        placed.add((x, y))
        self.finalized = True
        return LockResult(
            self.x,
            self.y,
            self.orientation,
            remaining,
            life_lost,
            frozenset(placed),
        )

    def _advance_descent(self, countdown: int, movement_recovery: bool) -> None:
        self.drop_countdown = countdown
        while self.drop_countdown == 0:
            if self.grounded:
                self.landed = True
                return
            if not self._try_move_down():
                self.drop_countdown = LOCK_DELAY_TICKS
                self.grounded = True
                return
            self.drop_countdown = self.base_drop_ticks
            if movement_recovery:
                return

    def _try_move_down(self) -> bool:
        if self._collides(self.orientation, self._pivot_x, self._pivot_y + 1):
            return False
        self._pivot_y += 1
        return True

    def _move_horizontal(self, delta: int) -> None:
        if not self._collides(self.orientation, self._pivot_x + delta, self._pivot_y):
            self._pivot_x += delta
            self._recover_from_grounded_movement()

    def _rotate(self, clockwise: bool) -> None:
        width, height = self.dimensions
        if self._attempt_rotation(
            clockwise, self.vertical_parity, self.horizontal_parity, width, height
        ):
            return
        if self.vertical_parity or self.horizontal_parity:
            self._attempt_rotation(
                clockwise,
                -self.vertical_parity,
                -self.horizontal_parity,
                width,
                height,
            )

    def _attempt_rotation(
        self,
        clockwise: bool,
        old_vertical: int,
        old_horizontal: int,
        old_width: int,
        old_height: int,
    ) -> bool:
        candidate = (self.orientation + (1 if clockwise else 3)) & 3
        if clockwise:
            top_x = self.x + (
                old_horizontal - old_height + old_width + old_vertical
            ) // 2
            top_y = self.y + (
                old_vertical + old_height - old_width - old_horizontal
            ) // 2
            new_horizontal = -old_vertical
            new_vertical = old_horizontal
        else:
            top_x = self.x + (
                -old_vertical - old_height + old_width + old_horizontal
            ) // 2
            top_y = self.y + (
                old_vertical + old_horizontal - old_width + old_height
            ) // 2
            new_horizontal = old_vertical
            new_vertical = -old_horizontal
        min_x, min_y = self._minimum_offsets(candidate)
        pivot_x, pivot_y = top_x - min_x, top_y - min_y
        if self._collides(candidate, pivot_x, pivot_y):
            return False
        self.orientation = candidate
        self._pivot_x = pivot_x
        self._pivot_y = pivot_y
        self.horizontal_parity = new_horizontal
        self.vertical_parity = new_vertical
        self._recover_from_grounded_movement()
        return True

    def _recover_from_grounded_movement(self) -> None:
        if not self.grounded:
            return
        if self._try_move_down():
            self.grounded = False
            self._advance_descent(self.base_drop_ticks, movement_recovery=True)
        else:
            self.drop_countdown = LOCK_DELAY_TICKS

    def _collides(self, orientation: int, pivot_x: int, pivot_y: int) -> bool:
        for dx, dy in self._offsets(orientation):
            x, y = pivot_x + dx, pivot_y + dy
            if x < 0 or x >= self.board.width or y >= self.board.height:
                return True
            if y >= 0 and self.board.get(x, y) != 0:
                return True
        return False

    def _require_mutable(self) -> None:
        if self.finalized:
            raise RuntimeError("active domino was already finalized")

    @staticmethod
    def _offsets(orientation: int) -> tuple[tuple[int, int], tuple[int, int]]:
        satellite = ((1, 0), (0, 1), (-1, 0), (0, -1))[orientation & 3]
        return (0, 0), satellite

    @classmethod
    def _minimum_offsets(cls, orientation: int) -> tuple[int, int]:
        offsets = cls._offsets(orientation)
        return min(x for x, _y in offsets), min(y for _x, y in offsets)


@dataclass
class PlayerBucket:
    board: Board
    lives: int = 3
    active_slot: bool = True
    active: ActiveDomino | None = None
    last_returned_shapes: tuple[ReturnedShape, ...] = ()


class AuthoritativeMatch:
    def __init__(
        self,
        player_count: int,
        width: int,
        height: int,
        speed_index: int,
        colour_count: int,
        feedback_level: int,
    ) -> None:
        if player_count < 2 or player_count > 8:
            raise ValueError("multiplayer requires 2..8 players")
        if speed_index < 0 or speed_index >= len(SPEED_TICKS):
            raise ValueError("speed index is outside the original table")
        if colour_count < 1 or colour_count > 7:
            raise ValueError("colour count must be 1..7")
        if feedback_level < 0 or feedback_level > 3:
            raise ValueError("feedback level must be 0..3")
        self.base_drop_ticks = SPEED_TICKS[speed_index]
        self.colour_count = colour_count
        self.feedback_level = feedback_level
        self.players = [PlayerBucket(Board(width, height)) for _ in range(player_count)]
        self.outcome = Outcome.RUNNING
        self.winner_slot: int | None = None

    def spawn(self, slot: int, cells: tuple[int, int]) -> ActiveDomino:
        player = self._live_player(slot)
        if player.active is not None:
            raise RuntimeError("slot already has an active domino")
        player.active = ActiveDomino(player.board, cells, self.base_drop_ticks)
        return player.active

    def apply_controls(self, slot: int, controls: tuple[int, ...]) -> bool:
        player = self._live_player(slot)
        if player.active is None:
            raise RuntimeError("slot has no active domino")
        for control in controls:
            if player.active.tick(control):
                return True
        return False

    def finalize_landed(self, slot: int) -> LockResult:
        player = self._live_player(slot)
        if player.active is None:
            raise RuntimeError("slot has no active domino")
        result = player.active.finalize(player.lives)
        player.active = None
        player.lives = result.lives_remaining
        returned: list[ReturnedShape] = []
        if player.lives == 0:
            player.active_slot = False
            self._update_outcome()
        else:
            returned.extend(
                _activate_placed_specials(
                    player.board, result.placed_cells, self.feedback_level
                )
            )
            returned.extend(self._resolve_cascades(player.board))
        player.last_returned_shapes = tuple(returned)
        return LockResult(
            result.x,
            result.y,
            result.orientation,
            result.lives_remaining,
            result.life_lost,
            result.placed_cells,
            tuple(returned),
        )

    def eliminate(self, slot: int) -> None:
        player = self._player(slot)
        if not player.active_slot:
            return
        player.active_slot = False
        player.lives = 0
        player.active = None
        self._update_outcome()

    def receive_feedback(
        self, slot: int, shape: ReturnedShape, shape_id: int
    ) -> bool:
        """Settle one targeted cooked shape and return whether it eliminated."""
        player = self._live_player(slot)
        board = player.board
        origin_x = (board.width - shape.width) >> 1
        origin_y = -shape.height

        def collides(candidate_y: int) -> bool:
            for index, occupied in enumerate(shape.occupied):
                if not occupied:
                    continue
                x = origin_x + index % shape.width
                y = candidate_y + index // shape.width
                if x < 0 or x >= board.width or y >= board.height:
                    return True
                if y >= 0 and board.get(x, y):
                    return True
            return False

        while not collides(origin_y + 1):
            origin_y += 1
        overflow = origin_y < 0
        if overflow:
            player.lives -= 1
            if player.lives == 0:
                player.active_slot = False
                player.active = None
                self._update_outcome()
                return True
        solid_id = max(1, shape_id + 1)
        for index, occupied in enumerate(shape.occupied):
            if not occupied:
                continue
            x = origin_x + index % shape.width
            y = origin_y + index // shape.width
            if y >= 0 and board.get(x, y) == 0:
                board.set_solid(x, y, shape.colour, solid_id)
        return False

    def _resolve_cascades(self, board: Board) -> list[ReturnedShape]:
        returned: list[ReturnedShape] = []
        while True:
            changed, wave = _resolve_matches_once(
                board, self.colour_count, self.feedback_level
            )
            if not changed:
                return returned
            returned.extend(wave)
            board.collapse_loose()

    def _update_outcome(self) -> None:
        live = [slot for slot, player in enumerate(self.players) if player.active_slot]
        if len(live) == 1:
            self.outcome = Outcome.WON
            self.winner_slot = live[0]
        elif not live:
            self.outcome = Outcome.DRAW
            self.winner_slot = None

    def _live_player(self, slot: int) -> PlayerBucket:
        player = self._player(slot)
        if not player.active_slot or self.outcome is not Outcome.RUNNING:
            raise RuntimeError("slot is not active in a running match")
        return player

    def _player(self, slot: int) -> PlayerBucket:
        if slot < 0 or slot >= len(self.players):
            raise IndexError(f"invalid player slot: {slot}")
        return self.players[slot]


def _is_loose(cell: int) -> bool:
    return ((cell & 31) & 24) == 16


def _find_matches(
    board: Board, colour_count: int
) -> list[tuple[int, frozenset[tuple[int, int]]]]:
    result: list[tuple[int, frozenset[tuple[int, int]]]] = []
    for colour in range(colour_count):
        visited: set[tuple[int, int]] = set()
        for y in range(board.height):
            for x in range(board.width):
                cell = board.get(x, y)
                if (
                    (x, y) in visited
                    or cell == WILDCARD_CELL
                    or not _cell_matches(cell, colour, wildcards=True)
                ):
                    continue
                component: set[tuple[int, int]] = {(x, y)}
                pending = [(x, y)]
                visited.add((x, y))
                while pending:
                    current_x, current_y = pending.pop(0)
                    for next_x, next_y in (
                        (current_x - 1, current_y),
                        (current_x + 1, current_y),
                        (current_x, current_y - 1),
                        (current_x, current_y + 1),
                    ):
                        if (
                            0 <= next_x < board.width
                            and 0 <= next_y < board.height
                            and (next_x, next_y) not in visited
                            and _cell_matches(
                                board.get(next_x, next_y), colour, wildcards=True
                            )
                        ):
                            visited.add((next_x, next_y))
                            component.add((next_x, next_y))
                            pending.append((next_x, next_y))
                if len(component) >= 4:
                    result.append((colour, frozenset(component)))
    return result


def _cell_matches(cell: int, colour: int, wildcards: bool = False) -> bool:
    return _is_loose(cell) and (
        (cell & 7) == colour or (wildcards and (cell & 31) == WILDCARD_CELL)
    )


def _resolve_matches_once(
    board: Board, colour_count: int, feedback_level: int
) -> tuple[bool, list[ReturnedShape]]:
    groups = _find_matches(board, colour_count)
    if not groups:
        return False, []
    removed: set[tuple[int, int]] = set()
    returned: list[ReturnedShape] = []
    bombs: set[tuple[int, int, int]] = set()
    claimed_solids: set[int] = set()
    for colour, positions in groups:
        feedback_positions = set(positions)
        removed.update(positions)
        for x, y in positions:
            for next_x, next_y in _touching(board, x, y):
                cell = board.get(next_x, next_y) & 31
                solid_id = board.solid_ids[next_y][next_x]
                if solid_id and (cell & 7) == colour:
                    solid_positions = board.positions_for_solid(solid_id)
                    removed.update(solid_positions)
                    if feedback_level >= 2 and solid_id not in claimed_solids:
                        feedback_positions.update(solid_positions)
                        claimed_solids.add(solid_id)
                elif cell == BOMB_CELL:
                    bombs.add((next_x, next_y, colour))
        if feedback_level >= 1:
            returned.append(_shape_from_positions(colour, frozenset(feedback_positions)))

    for x, y in removed:
        board.set(x, y, 0)
    for bomb_x, bomb_y, colour in bombs:
        board.set(bomb_x, bomb_y, 0)
        returned.extend(_bomb(board, colour, feedback_level))
    return True, returned


def _activate_placed_specials(
    board: Board,
    placed: frozenset[tuple[int, int]],
    feedback_level: int,
) -> list[ReturnedShape]:
    returned: list[ReturnedShape] = []
    for x, y in sorted(placed, key=lambda position: (position[1], position[0])):
        cell = board.get(x, y) & 31
        if cell == EARTHQUAKE_CELL:
            board.set(x, y, 0)
            board.earthquake()
        elif cell == DRILL_CELL:
            returned.extend(_drill(board, x, feedback_level))
        elif cell == POWER_DRILL_CELL:
            returned.extend(_power_drill(board, x, feedback_level))
        elif cell == WATER_CELL:
            board.set(x, y, 0)
            _water(board)
        elif cell == POISON_CELL:
            board.set(x, y, 0)
            _poison(board)
        # Bombs remain until a neighbouring coloured match triggers them.
    return returned


def _drill(board: Board, column: int, feedback_level: int) -> list[ReturnedShape]:
    returned: list[ReturnedShape] = []
    for y in range(board.height):
        cell = board.get(column, y) & 31
        if not cell:
            continue
        if feedback_level >= 3 and cell != WILDCARD_CELL:
            returned.append(
                _shape_from_positions(cell & 7, frozenset({(column, y)}))
            )
        board.set(column, y, 0)
    return returned


def _power_drill(board: Board, column: int, feedback_level: int) -> list[ReturnedShape]:
    units: list[tuple[int, set[tuple[int, int]]]] = []
    claimed_loose: set[tuple[int, int]] = set()
    claimed_solids: set[int] = set()
    for y in range(board.height):
        if not board.get(column, y):
            continue
        solid_id = board.solid_ids[y][column]
        if solid_id:
            if solid_id not in claimed_solids:
                claimed_solids.add(solid_id)
                positions = board.positions_for_solid(solid_id)
                colour = board.get(*next(iter(positions))) & 7
                units.append((colour, positions))
            continue
        if (column, y) in claimed_loose:
            continue
        cell = board.get(column, y) & 31
        if cell == WILDCARD_CELL:
            component = {(column, y)}
            colour = -1
        else:
            colour = cell & 7
            component = _loose_component(board, column, y, colour)
        claimed_loose.update(component)
        unit = set(component)
        if colour >= 0:
            for x, cell_y in component:
                for next_x, next_y in _touching(board, x, cell_y):
                    touching_id = board.solid_ids[next_y][next_x]
                    if touching_id and (board.get(next_x, next_y) & 7) == colour:
                        if touching_id not in claimed_solids:
                            claimed_solids.add(touching_id)
                            unit.update(board.positions_for_solid(touching_id))
        units.append((colour, unit))
    return _remove_units(board, units, feedback_level)


def _bomb(board: Board, colour: int, feedback_level: int) -> list[ReturnedShape]:
    units: list[tuple[int, set[tuple[int, int]]]] = []
    claimed_loose: set[tuple[int, int]] = set()
    claimed_solids: set[int] = set()
    for y in range(board.height):
        for x in range(board.width):
            if (x, y) in claimed_loose or board.solid_ids[y][x]:
                continue
            if not _cell_matches(board.get(x, y), colour):
                continue
            component = _loose_component(board, x, y, colour)
            claimed_loose.update(component)
            unit = set(component)
            for cell_x, cell_y in component:
                for next_x, next_y in _touching(board, cell_x, cell_y):
                    solid_id = board.solid_ids[next_y][next_x]
                    if (
                        solid_id
                        and (board.get(next_x, next_y) & 7) == colour
                        and solid_id not in claimed_solids
                    ):
                        claimed_solids.add(solid_id)
                        unit.update(board.positions_for_solid(solid_id))
            units.append((colour, unit))
    for y in range(board.height):
        for x in range(board.width):
            solid_id = board.solid_ids[y][x]
            if (
                solid_id
                and (board.get(x, y) & 7) == colour
                and solid_id not in claimed_solids
            ):
                claimed_solids.add(solid_id)
                units.append((colour, board.positions_for_solid(solid_id)))
    return _remove_units(board, units, feedback_level)


def _remove_units(
    board: Board,
    units: list[tuple[int, set[tuple[int, int]]]],
    feedback_level: int,
) -> list[ReturnedShape]:
    removed: set[tuple[int, int]] = set()
    returned: list[ReturnedShape] = []
    for colour, positions in units:
        fresh = positions - removed
        if not fresh:
            continue
        removed.update(fresh)
        if feedback_level >= 3 and colour >= 0:
            returned.append(_shape_from_positions(colour, frozenset(fresh)))
    for x, y in removed:
        board.set(x, y, 0)
    return returned


def _water(board: Board) -> None:
    for y in range(board.height):
        for x in range(board.width):
            if board.solid_ids[y][x]:
                colour = board.get(x, y) & 7
                board.set(x, y, 16 | colour)
    board.collapse_loose()


def _poison(board: Board) -> None:
    claimed: set[tuple[int, int]] = set()
    for y in range(board.height):
        for x in range(board.width):
            cell = board.get(x, y) & 31
            if (
                (x, y) in claimed
                or not _is_loose(cell)
                or cell == WILDCARD_CELL
            ):
                continue
            colour = cell & 7
            component = _loose_component(board, x, y, colour)
            claimed.update(component)
            solid_id = board.allocate_solid_id()
            for cell_x, cell_y in component:
                board.set_solid(cell_x, cell_y, colour, solid_id)


def _loose_component(
    board: Board, start_x: int, start_y: int, colour: int
) -> set[tuple[int, int]]:
    result = {(start_x, start_y)}
    pending = [(start_x, start_y)]
    while pending:
        x, y = pending.pop(0)
        for next_x, next_y in _touching(board, x, y):
            if (
                (next_x, next_y) not in result
                and not board.solid_ids[next_y][next_x]
                and _cell_matches(board.get(next_x, next_y), colour)
            ):
                result.add((next_x, next_y))
                pending.append((next_x, next_y))
    return result


def _touching(board: Board, x: int, y: int) -> tuple[tuple[int, int], ...]:
    return tuple(
        (next_x, next_y)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
        if 0 <= next_x < board.width and 0 <= next_y < board.height
    )


def _shape_from_positions(
    colour: int, positions: frozenset[tuple[int, int]]
) -> ReturnedShape:
    min_x = min(x for x, _y in positions)
    max_x = max(x for x, _y in positions)
    min_y = min(y for _x, y in positions)
    max_y = max(y for _x, y in positions)
    width = max_x - min_x + 1
    height = max_y - min_y + 1
    occupied = tuple(
        (min_x + x, min_y + y) in positions
        for y in range(height)
        for x in range(width)
    )
    return ReturnedShape(colour, width, height, occupied)
