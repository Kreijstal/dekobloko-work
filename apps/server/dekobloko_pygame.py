#!/usr/bin/env python3
"""Pygame view/controller for the real Dekobloko HostedGame runtime."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import random
import time
from dataclasses import dataclass
from pathlib import Path

import pygame

from dekobloko_server.bots import BotLobbySession
from dekobloko_server.engine import (
    BOMB_CELL,
    DRILL_CELL,
    EARTHQUAKE_CELL,
    FAST_DROP,
    LEFT,
    POISON_CELL,
    POWER_DRILL_CELL,
    RIGHT,
    ROTATE_CLOCKWISE,
    WATER_CELL,
    WILDCARD_CELL,
    ActiveDomino,
    Board,
)
from dekobloko_server.lobby import GameOptions, HostedGame, Piece
from dekobloko_server.packets import pack_5bit

BOARD_WIDTH = 8
BOARD_HEIGHT = 18
CELL = 31
BOARD_Y = 94
BOARD_X = (180,)
CLIENT_FPS = 50

INK = (231, 236, 227)
MUTED = (137, 151, 147)
PANEL = (18, 26, 28)
GRID = (50, 65, 66)
ACTIVE_EDGE = (250, 239, 173)
GROUND_EDGE = (255, 122, 90)
COLORS = (
    (242, 91, 86),
    (76, 174, 231),
    (244, 190, 72),
    (93, 205, 137),
    (225, 112, 196),
    (245, 137, 62),
    (129, 116, 232),
)
TEST_ITEMS = (
    ("WILDCARD", WILDCARD_CELL),
    ("EARTHQUAKE", EARTHQUAKE_CELL),
    ("DRILL", DRILL_CELL),
    ("BOMB", BOMB_CELL),
    ("POWER DRILL", POWER_DRILL_CELL),
    ("WATER", WATER_CELL),
    ("POISON", POISON_CELL),
)
ITEM_NAMES = {cell: name for name, cell in TEST_ITEMS}
ASSET_DIR = Path(__file__).resolve().parent / "assets" / "dekobloko"
POWERUP_ASSET_NAMES = {
    EARTHQUAKE_CELL: "earthquake",
    DRILL_CELL: "drill",
    BOMB_CELL: "bomb",
    POWER_DRILL_CELL: "power_drill",
    WATER_CELL: "water",
    POISON_CELL: "poison",
}
ITEM_SPRITES: dict[int, tuple[pygame.Surface, ...]] = {}


def load_game_assets() -> None:
    ITEM_SPRITES[WILDCARD_CELL] = (
        pygame.image.load(ASSET_DIR / "wildcard.png").convert_alpha(),
    )
    for cell, name in POWERUP_ASSET_NAMES.items():
        ITEM_SPRITES[cell] = tuple(
            pygame.image.load(ASSET_DIR / f"{name}_{frame}.png").convert_alpha()
            for frame in range(4)
        )


def item_sprite(value: int, animation_tick: int) -> pygame.Surface | None:
    frames = ITEM_SPRITES.get(value)
    if not frames:
        return None
    frame = (animation_tick >> 2) & 3 if len(frames) == 4 else 0
    return frames[frame]


def board_digest(board: Board) -> str:
    raw = bytes(value & 0xFF for row in board.cells for value in row)
    return hashlib.blake2s(raw, digest_size=6).hexdigest()


def active_cells(piece: ActiveDomino) -> list[tuple[int, int, int]]:
    return [
        (piece._pivot_x + dx, piece._pivot_y + dy, value)
        for dx, dy, value in piece._oriented(piece.orientation)
    ]


def colour_for(value: int) -> tuple[int, int, int]:
    return COLORS[(value & 7) % len(COLORS)]


@dataclass
class BotPlan:
    piece: ActiveDomino | None = None
    target_x: int = 3
    target_orientation: int = 0
    rotate_release: bool = False


class HostedGameView:
    def __init__(
        self,
        seed: int,
        colours: int,
        feedback_level: int,
        speed_index: int,
        trace_path: Path,
        server_log_path: Path,
    ) -> None:
        self.seed = seed
        self.colours = colours
        self.feedback_level = feedback_level
        self.speed_index = speed_index
        self.trace_path = trace_path
        self.server_log_path = server_log_path
        self.trace = trace_path.open("w", encoding="ascii")
        self.server_log = server_log_path.open("w", encoding="ascii")
        self.rng = random.Random(seed)
        self.paused = False
        self.autoplay = False
        self.test_item = "random"
        self.tick_number = 0
        self.plans = [BotPlan()]
        self.sessions: list[BotLobbySession] = []
        self.game: HostedGame
        self.reset()

    def close(self) -> None:
        self.trace.close()
        self.server_log.close()

    def reset(self) -> None:
        self.sessions = [BotLobbySession("Player1")]
        self.game = HostedGame(
            1,
            self.sessions[0],
            GameOptions(
                speed_index=self.speed_index,
                bombardment_level=self.feedback_level,
                colours=self.colours,
                special_level=4,
                allow_spectators=True,
            ),
            rng=random.Random(self.seed),
            debug_single_player=True,
        )
        self.game.add_player(self.sessions[0])
        with contextlib.redirect_stdout(self.server_log):
            self.game.start()
        self.plans = [BotPlan()]
        self.test_item = "random"
        self.tick_number = 0

    def queue_test_item(self, index: int) -> None:
        name, item_cell = TEST_ITEMS[index]
        ordinary_cell = 16 + self.rng.randrange(self.colours)
        item_nibble = item_cell - 16
        ordinary_nibble = ordinary_cell - 16
        with self.game._lock:
            self.game.next_pieces[0] = Piece(
                piece_id=self.game._next_shape_id(),
                width=2,
                height=1,
                cells=(item_cell, ordinary_cell),
                descriptor=((item_nibble & 15) << 4) | (ordinary_nibble & 15),
            )
        self.test_item = name

    def bot_mask(self, slot: int, piece: ActiveDomino) -> int:
        plan = self.plans[slot]
        if plan.piece is not piece:
            plan.piece = piece
            plan.target_x = self.rng.randrange(BOARD_WIDTH)
            plan.target_orientation = self.rng.randrange(4)
            plan.rotate_release = False

        mask = FAST_DROP
        if piece.orientation != plan.target_orientation:
            if not plan.rotate_release:
                mask |= ROTATE_CLOCKWISE
            plan.rotate_release = not plan.rotate_release
        elif piece._pivot_x < plan.target_x:
            mask |= RIGHT
        elif piece._pivot_x > plan.target_x:
            mask |= LEFT
        return mask

    @staticmethod
    def keyboard_mask() -> int:
        keys = pygame.key.get_pressed()
        mask = 0
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            mask |= LEFT
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            mask |= RIGHT
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            mask |= FAST_DROP
        if keys[pygame.K_UP] or keys[pygame.K_w] or keys[pygame.K_x]:
            mask |= ROTATE_CLOCKWISE
        return mask

    def step(self) -> None:
        engine = self.game.engine
        if self.game.state != "playing" or engine is None:
            return
        for slot, session in enumerate(self.sessions):
            if slot in self.game.inactive_slots:
                continue
            active = engine.players[slot].active
            if active is None:
                payload = bytes([1]) + pack_5bit((0,))
                with contextlib.redirect_stdout(self.server_log):
                    self.game.handle_controls(session, payload)
                continue
            if slot == 0 and not self.autoplay:
                mask = self.keyboard_mask()
            else:
                mask = self.bot_mask(slot, active)
            payload = bytes([1]) + pack_5bit((mask,))
            with contextlib.redirect_stdout(self.server_log):
                self.game.handle_controls(session, payload)
        self.tick_number += 1
        self.write_trace()

    def write_trace(self) -> None:
        engine = self.game.engine
        if engine is None:
            return
        row = {
            "time": time.time(),
            "tick": self.tick_number,
            "game_state": self.game.state,
            "pending_garbage": {
                str(slot): len(shapes)
                for slot, shapes in self.game.pending_garbage.items()
            },
            "players": [],
        }
        for slot, player in enumerate(engine.players):
            active = player.active
            row["players"].append(
                {
                    "slot": slot,
                    "lives": player.lives,
                    "occupied": player.board.occupied_count(),
                    "board_hash": board_digest(player.board),
                    "active": None
                    if active is None
                    else {
                        "cooked": not active.is_domino,
                        "x": active.x,
                        "y": active.y,
                        "orientation": active.orientation,
                        "grounded": active.grounded,
                        "landed": active.landed,
                    },
                }
            )
        self.trace.write(json.dumps(row, separators=(",", ":")) + "\n")
        if self.tick_number % CLIENT_FPS == 0:
            self.trace.flush()
            self.server_log.flush()


def text(
    surface: pygame.Surface,
    font: pygame.font.Font,
    value: str,
    x: int,
    y: int,
    colour: tuple[int, int, int] = INK,
) -> None:
    surface.blit(font.render(value, True, colour), (x, y))


def draw_background(surface: pygame.Surface) -> None:
    width, height = surface.get_size()
    for y in range(height):
        blend = y / height
        colour = (int(9 + 9 * blend), int(16 + 15 * blend), int(19 + 13 * blend))
        pygame.draw.line(surface, colour, (0, y), (width, y))
    pygame.draw.circle(surface, (30, 58, 54), (1110, 65), 250)


def draw_cell(
    surface: pygame.Surface,
    board_x: int,
    x: int,
    y: int,
    value: int,
    animation_tick: int,
    *,
    active: bool = False,
    grounded: bool = False,
    cooked: bool = False,
) -> None:
    if not (0 <= x < BOARD_WIDTH and 0 <= y < BOARD_HEIGHT):
        return
    rect = pygame.Rect(board_x + x * CELL, BOARD_Y + y * CELL, CELL, CELL)
    colour = colour_for(value)
    inset = 2 if cooked else 5
    radius = 2 if cooked else 7
    pygame.draw.rect(surface, colour, rect.inflate(-inset, -inset), border_radius=radius)
    shine = tuple(min(channel + 45, 255) for channel in colour)
    if cooked:
        pygame.draw.rect(surface, (32, 39, 39), rect.inflate(-4, -4), 3, border_radius=2)
        pygame.draw.line(
            surface,
            shine,
            (rect.left + 6, rect.bottom - 7),
            (rect.right - 7, rect.top + 6),
            2,
        )
    else:
        pygame.draw.line(
            surface,
            shine,
            (rect.left + 8, rect.top + 8),
            (rect.right - 9, rect.top + 8),
            2,
        )
    if active:
        edge = GROUND_EDGE if grounded else ACTIVE_EDGE
        pygame.draw.rect(surface, edge, rect.inflate(-1, -1), 2, border_radius=radius)
    sprite = item_sprite(value, animation_tick)
    if sprite is not None:
        surface.blit(sprite, sprite.get_rect(center=rect.center))


def draw_board(
    surface: pygame.Surface,
    fonts: dict[str, pygame.font.Font],
    view: HostedGameView,
    slot: int,
) -> None:
    engine = view.game.engine
    if engine is None:
        return
    player = engine.players[slot]
    board = player.board
    pending_effect = view.game.pending_effects.get(slot)
    display_cells: tuple[tuple[int, ...], ...] | list[list[int]] = board.cells
    effect_elapsed = 0
    effect_landing = False
    if pending_effect is not None:
        remaining, effect_lock = pending_effect
        effect_elapsed = effect_lock.effect_ticks - remaining
        movement_frames = effect_lock.effect_frames
        movement_ticks = max(0, len(movement_frames) - 1)
        if effect_elapsed < 13 and movement_frames:
            display_cells = movement_frames[0]
        elif movement_frames and effect_elapsed < 13 + movement_ticks:
            frame = min(effect_elapsed - 12, len(movement_frames) - 1)
            display_cells = movement_frames[max(0, frame)]
        elif movement_frames:
            display_cells = movement_frames[-1]
            effect_landing = True
    board_x = BOARD_X[slot]
    text(surface, fonts["heading"], view.sessions[slot].display_name, board_x, 53)
    text(
        surface,
        fonts["small"],
        f"slot {slot}  lives {player.lives}  fill {board.occupied_count()}",
        board_x,
        76,
        MUTED,
    )
    frame = pygame.Rect(
        board_x - 8,
        BOARD_Y - 8,
        BOARD_WIDTH * CELL + 16,
        BOARD_HEIGHT * CELL + 16,
    )
    pygame.draw.rect(surface, PANEL, frame, border_radius=12)
    pygame.draw.rect(surface, (69, 91, 88), frame, 2, border_radius=12)
    for y in range(BOARD_HEIGHT):
        for x in range(BOARD_WIDTH):
            rect = pygame.Rect(board_x + x * CELL, BOARD_Y + y * CELL, CELL, CELL)
            pygame.draw.rect(surface, GRID, rect, 1)
            value = display_cells[y][x]
            if (
                pending_effect is not None
                and effect_elapsed < 13
                and effect_lock.effect_origin
                and effect_lock.effect_frames
            ):
                origin_value = effect_lock.effect_origin[y][x]
                if (
                    origin_value
                    and origin_value != effect_lock.effect_frames[0][y][x]
                    and (effect_elapsed // 2) % 2 == 0
                ):
                    value = origin_value
            if value:
                draw_cell(
                    surface,
                    board_x,
                    x,
                    y,
                    value,
                    view.tick_number,
                    active=effect_landing and (effect_elapsed // 2) % 2 == 0,
                    cooked=board.solid_ids[y][x] != 0,
                )
    active = player.active
    if active is not None:
        cooked = not active.is_domino
        for x, y, value in active_cells(active):
            draw_cell(
                surface,
                board_x,
                x,
                y,
                value,
                view.tick_number,
                active=True,
                grounded=active.grounded,
                cooked=cooked,
            )
    if pending_effect is not None:
        remaining, lock = pending_effect
        banner = pygame.Rect(board_x + 16, BOARD_Y + 245, 216, 68)
        pygame.draw.rect(surface, (34, 50, 46), banner, border_radius=10)
        pygame.draw.rect(surface, ACTIVE_EDGE, banner, 2, border_radius=10)
        text(surface, fonts["heading"], "POWERUP WAVE", banner.x + 17, banner.y + 12)
        text(
            surface,
            fonts["small"],
            f"effect tick {lock.effect_ticks - remaining + 1}/{lock.effect_ticks}",
            banner.x + 17,
            banner.y + 40,
            MUTED,
        )
    draw_next_warning(surface, fonts, view, slot, board_x)


def draw_next_warning(
    surface: pygame.Surface,
    fonts: dict[str, pygame.font.Font],
    view: HostedGameView,
    slot: int,
    board_x: int,
) -> None:
    if slot >= len(view.game.next_pieces):
        return
    rewards = view.game.pending_rewards.get(slot, ())
    feedback = view.game.pending_garbage.get(slot, ())
    preview_is_reward = False
    preview = view.game.next_pieces[slot]
    if feedback:
        candidate = feedback[0]
        eligible_after = view.game.garbage_eligible_after.get(
            (slot, candidate.shape_id), 0
        )
        if eligible_after <= view.game.completed_pieces[slot] + 1:
            preview = candidate
    elif rewards:
        preview = rewards[0]
        preview_is_reward = True
    queued = len(feedback)
    origin_x = board_x + 154
    origin_y = 48
    colours = (
        (239, 91, 82),
        (248, 173, 65),
        (238, 219, 91),
        (82, 190, 126),
        (72, 164, 213),
        (104, 116, 213),
        (188, 105, 202),
        (224, 224, 218),
    )
    text(surface, fonts["small"], "NEXT", origin_x, origin_y, MUTED)
    for index, value in enumerate(preview.cells[:2]):
        rect = pygame.Rect(origin_x + 48 + index * 25, origin_y - 2, 22, 22)
        pygame.draw.rect(surface, colours[value & 7], rect, border_radius=5)
        pygame.draw.rect(surface, INK, rect, 2, border_radius=5)
        sprite = item_sprite(value, view.tick_number)
        if sprite is not None:
            surface.blit(sprite, sprite.get_rect(center=rect.center))
    item_name = next(
        (ITEM_NAMES[value] for value in preview.cells if value in ITEM_NAMES),
        None,
    )
    reward_name = next(
        (
            ITEM_NAMES[value]
            for reward in rewards[:1]
            for value in reward.cells
            if value in ITEM_NAMES
        ),
        None,
    )
    notice = None
    if preview_is_reward and item_name:
        notice = f"POWERUP NEXT: {item_name}"
    elif rewards and reward_name:
        notice = f"POWERUP AFTER FEEDBACK: {reward_name}"
    elif item_name:
        notice = f"TEST: {item_name}"
    if notice:
        text(
            surface,
            fonts["small"],
            notice,
            origin_x,
            origin_y + 25,
            ACTIVE_EDGE,
        )
    if queued:
        text(
            surface,
            fonts["small"],
            f"COOKED WARNING x{queued}",
            origin_x,
            origin_y + (47 if notice else 25),
            GROUND_EDGE,
        )


def draw_panel(
    surface: pygame.Surface,
    fonts: dict[str, pygame.font.Font],
    view: HostedGameView,
) -> None:
    x = 560
    pygame.draw.rect(surface, PANEL, (x, 94, 470, 558), border_radius=12)
    text(surface, fonts["heading"], "REAL HOSTEDGAME STATE", x + 24, 116)
    mode = "AUTOPLAY" if view.autoplay else "MANUAL SLOT 0"
    engine = view.game.engine
    rows = [
        ("runtime", "dekobloko_server.lobby.HostedGame"),
        ("mode", mode),
        ("state", view.game.state),
        ("tick", str(view.tick_number)),
        ("colours", str(view.colours)),
        ("feedback", f"ON level {view.feedback_level}"),
    ]
    if engine is not None:
        for slot, player in enumerate(engine.players):
            active = player.active
            rows.extend(
                [
                    (f"slot {slot} hash", board_digest(player.board)),
                    (
                        f"slot {slot} active",
                        "none"
                        if active is None
                        else (
                            f"{'cooked' if not active.is_domino else 'domino'} "
                            f"x={active.x} y={active.y} r={active.orientation}"
                        ),
                    ),
                    (
                        f"slot {slot} queued",
                        str(len(view.game.pending_garbage.get(slot, ()))),
                    ),
                    (
                        f"slot {slot} next",
                        (
                            f"{view.game.next_pieces[slot].descriptor:02x}"
                            if slot < len(view.game.next_pieces)
                            else "none"
                        ),
                    ),
                ]
            )
    y = 160
    for label, value in rows:
        text(surface, fonts["small"], label.upper(), x + 24, y, MUTED)
        text(surface, fonts["mono"], value, x + 170, y)
        y += 34
    text(surface, fonts["small"], "No game rules live in this Pygame file.", x + 24, 594, INK)
    text(surface, fonts["small"], f"server log: {view.server_log_path}", x + 24, 620, MUTED)


def draw(
    surface: pygame.Surface,
    fonts: dict[str, pygame.font.Font],
    view: HostedGameView,
) -> None:
    draw_background(surface)
    text(surface, fonts["title"], "DEKOBLOKO SINGLE-PLAYER ENGINE", 52, 18)
    draw_board(surface, fonts, view, 0)
    draw_panel(surface, fonts, view)
    paused = " PAUSED" if view.paused else ""
    text(
        surface,
        fonts["small"],
        f"SPACE pause | B autoplay/manual | R new HostedGame | arrows control slot 0{paused}",
        54,
        686,
        MUTED,
    )
    text(surface, fonts["small"], f"trace: {view.trace_path}", 54, 712, MUTED)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=8003)
    parser.add_argument("--fps", type=int, default=CLIENT_FPS)
    parser.add_argument("--colours", type=int, choices=range(1, 8), default=3)
    parser.add_argument("--feedback-level", type=int, choices=range(4), default=1)
    parser.add_argument("--speed-index", type=int, choices=range(5), default=2)
    parser.add_argument("--trace", type=Path, default=Path("/tmp/dekobloko-engine.jsonl"))
    parser.add_argument("--server-log", type=Path, default=Path("/tmp/dekobloko-hosted.log"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pygame.init()
    pygame.display.set_caption("Dekobloko HostedGame visualizer")
    surface = pygame.display.set_mode((1180, 750))
    load_game_assets()
    fonts = {
        "title": pygame.font.SysFont("dejavusans", 27, bold=True),
        "heading": pygame.font.SysFont("dejavusans", 18, bold=True),
        "small": pygame.font.SysFont("dejavusans", 13),
        "mono": pygame.font.SysFont("dejavusansmono", 13, bold=True),
    }
    view = HostedGameView(
        args.seed,
        args.colours,
        args.feedback_level,
        args.speed_index,
        args.trace,
        args.server_log,
    )
    clock = pygame.time.Clock()
    accumulator = 0.0
    tick_seconds = 1.0 / args.fps
    running = True
    try:
        while running:
            elapsed = min(clock.tick(120) / 1000.0, 0.1)
            accumulator += elapsed
            single_step = False
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key == pygame.K_SPACE:
                        view.paused = not view.paused
                    elif event.key == pygame.K_b:
                        view.autoplay = not view.autoplay
                    elif event.key == pygame.K_r:
                        view.reset()
                    elif event.key == pygame.K_n:
                        single_step = True
                    elif pygame.K_1 <= event.key <= pygame.K_7:
                        view.queue_test_item(event.key - pygame.K_1)
            if single_step:
                view.step()
            if not view.paused:
                while accumulator >= tick_seconds:
                    view.step()
                    accumulator -= tick_seconds
            else:
                accumulator = 0.0
            draw(surface, fonts, view)
            pygame.display.flip()
    finally:
        view.close()
        pygame.quit()


if __name__ == "__main__":
    main()
