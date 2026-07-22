from __future__ import annotations

import unittest
from pathlib import Path
import subprocess

from dekobloko_server.engine import (
    ActiveDomino,
    AuthoritativeMatch,
    BOMB_CELL,
    Board,
    DRILL_CELL,
    EARTHQUAKE_CELL,
    FAST_DROP,
    LEFT,
    Outcome,
    POISON_CELL,
    POWER_DRILL_CELL,
    ROTATE_CLOCKWISE,
    ROTATE_COUNTER_CLOCKWISE,
    ReturnedShape,
    WATER_CELL,
    WILDCARD_CELL,
)


class AuthoritativeEngineTest(unittest.TestCase):
    def test_tick_trace_matches_original_verified_java_engine(self) -> None:
        repo = Path(__file__).resolve().parents[3]
        main_classes = repo / "game-logic/build/classes/main"
        test_classes = repo / "game-logic/build/classes/test"
        if not main_classes.is_dir() or not test_classes.is_dir():
            self.skipTest("run ./game-logic/build.sh to build the Java oracle")
        java_trace = subprocess.run(
            [
                "java",
                "-cp",
                f"{main_classes}:{test_classes}",
                "org.alterorb.dekobloko.logic.PythonEngineTrace",
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.splitlines()

        board = Board(8, 18)
        board.set(0, 17, 18)
        active = ActiveDomino(
            board,
            (16, 17),
            40,
            top_x=3,
            top_y=0,
            drop_countdown=2,
            forced_drop_countdown=30,
            horizontal_parity=0,
        )
        prefix = (
            0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
            2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 8, 0,
            16, 16, 16, 16, 0, 4, 0, 1, 0, 2, 0,
        )
        python_trace = []
        tick = 0
        while not active.landed and tick < 120:
            control = prefix[tick] if tick < len(prefix) else FAST_DROP
            active.tick(control)
            python_trace.append("|".join((
                str(tick),
                str(control),
                str(active.orientation),
                str(active.x),
                str(active.y),
                str(active.drop_countdown),
                str(active.forced_drop_countdown),
                str(active.previous_controls),
                str(active.horizontal_repeat),
                str(active.vertical_parity),
                str(active.horizontal_parity),
                str(active.grounded).lower(),
                str(active.landed).lower(),
                ",".join(str(cell) for cell in active.bitmap),
            )))
            tick += 1

        self.assertEqual(java_trace, python_trace)

    def test_original_rotation_coordinates_and_key_repeat(self) -> None:
        clockwise = ActiveDomino(Board(8, 18), (16, 17), 40)
        clockwise.tick(ROTATE_CLOCKWISE)
        self.assertEqual((1, 4, -1, (16, 17)), (
            clockwise.orientation,
            clockwise.x,
            clockwise.y,
            clockwise.bitmap,
        ))

        counter = ActiveDomino(Board(8, 18), (16, 17), 40)
        counter.tick(ROTATE_COUNTER_CLOCKWISE)
        self.assertEqual((3, 4, 0, (17, 16)), (
            counter.orientation,
            counter.x,
            counter.y,
            counter.bitmap,
        ))

        repeated = ActiveDomino(Board(8, 18), (16, 17), 40)
        for _tick in range(10):
            repeated.tick(LEFT)
        self.assertEqual(1, repeated.x)
        self.assertEqual(-3, repeated.horizontal_repeat)

    def test_fast_drop_observes_lock_delay_and_commits_both_cells(self) -> None:
        board = Board(8, 18)
        active = ActiveDomino(board, (16, 17), 40)
        ticks = 0
        while not active.grounded:
            self.assertFalse(active.tick(FAST_DROP))
            ticks += 1
            self.assertLess(ticks, 100)
        lock_ticks = 0
        while not active.tick(0):
            lock_ticks += 1
            self.assertLess(lock_ticks, 30)
        self.assertEqual(19, lock_ticks)
        self.assertEqual(17, active.y)
        result = active.finalize(3)
        self.assertFalse(result.life_lost)
        self.assertEqual(3, result.lives_remaining)
        self.assertEqual(frozenset({(3, 17), (4, 17)}), result.placed_cells)
        self.assertEqual((16, 17), (board.get(3, 17), board.get(4, 17)))

    def test_original_overflow_keeps_three_lives_and_only_third_eliminates(self) -> None:
        match = AuthoritativeMatch(2, 8, 18, 0, 4, 0)
        for expected_lives in (2, 1, 0):
            board = match.players[1].board
            board.set(3, 0, 0)
            board.set(3, 1, 22)
            match.players[1].active = ActiveDomino(
                board,
                (16, 17),
                40,
                orientation=3,
                top_x=3,
                top_y=-1,
                drop_countdown=2,
                forced_drop_countdown=30,
                horizontal_parity=0,
            )
            guard = 0
            while not match.apply_controls(1, (FAST_DROP,)):
                guard += 1
                self.assertLess(guard, 40)
            result = match.finalize_landed(1)
            self.assertTrue(result.life_lost)
            self.assertEqual(expected_lives, result.lives_remaining)
            self.assertEqual(expected_lives == 0, result.eliminated)

        self.assertEqual(Outcome.WON, match.outcome)
        self.assertEqual(0, match.winner_slot)
        self.assertFalse(match.players[1].active_slot)

    def test_lock_resolves_match_and_returns_exact_cooked_geometry(self) -> None:
        match = AuthoritativeMatch(2, 8, 18, 0, 4, 1)
        board = match.players[0].board
        for x in range(3):
            board.set(x, 17, 16)
        match.spawn(0, (16, 17))
        guard = 0
        while not match.apply_controls(0, (FAST_DROP,)):
            guard += 1
            self.assertLess(guard, 100)
        result = match.finalize_landed(0)
        self.assertEqual(1, len(result.returned_shapes))
        shape = result.returned_shapes[0]
        self.assertEqual((0, 4, 1, (True, True, True, True)), (
            shape.colour,
            shape.width,
            shape.height,
            shape.occupied,
        ))
        self.assertEqual(1, board.occupied_count())
        self.assertEqual(17, board.get(4, 17))

    def test_wildcard_and_bomb_activation(self) -> None:
        match = AuthoritativeMatch(2, 8, 18, 0, 4, 3)
        board = match.players[0].board
        for x in range(3):
            board.set(x, 17, 18)
        board.set(3, 17, WILDCARD_CELL)
        board.set(2, 16, BOMB_CELL)
        board.set(7, 17, 18)
        returned = match._resolve_cascades(board)
        self.assertEqual(0, board.occupied_count())
        self.assertGreaterEqual(len(returned), 2)

    def test_automatic_drill_and_power_drill(self) -> None:
        drill_match = AuthoritativeMatch(2, 8, 18, 0, 4, 3)
        drill_board = drill_match.players[0].board
        drill_board.set(3, 10, 16)
        drill_match.players[0].active = ActiveDomino(
            drill_board,
            (DRILL_CELL, 17),
            40,
            top_x=3,
            top_y=17,
            landed=True,
        )
        drilled = drill_match.finalize_landed(0)
        self.assertEqual(0, drill_board.get(3, 10))
        self.assertEqual(0, drill_board.get(3, 17))
        self.assertEqual(17, drill_board.get(4, 17))
        self.assertEqual(2, len(drilled.returned_shapes))

        power_match = AuthoritativeMatch(2, 8, 18, 0, 4, 3)
        power_board = power_match.players[0].board
        power_board.set(3, 10, 18)
        power_board.set(4, 10, 18)
        power_match.players[0].active = ActiveDomino(
            power_board,
            (POWER_DRILL_CELL, 17),
            40,
            top_x=3,
            top_y=17,
            landed=True,
        )
        powered = power_match.finalize_landed(0)
        self.assertEqual(0, power_board.get(3, 10))
        self.assertEqual(0, power_board.get(4, 10))
        self.assertGreaterEqual(len(powered.returned_shapes), 1)

    def test_automatic_water_poison_and_earthquake(self) -> None:
        water_match = AuthoritativeMatch(2, 8, 18, 0, 4, 0)
        water_board = water_match.players[0].board
        water_board.set_solid(0, 16, 2, 1)
        water_board.set_solid(0, 17, 2, 1)
        water_match.players[0].active = ActiveDomino(
            water_board,
            (WATER_CELL, 17),
            40,
            top_x=3,
            top_y=17,
            landed=True,
        )
        water_match.finalize_landed(0)
        self.assertEqual(0, water_board.solid_ids[16][0])
        self.assertEqual(18, water_board.get(0, 16))

        poison_match = AuthoritativeMatch(2, 8, 18, 0, 4, 0)
        poison_board = poison_match.players[0].board
        poison_board.set(0, 17, 18)
        poison_board.set(1, 17, 18)
        poison_match.players[0].active = ActiveDomino(
            poison_board,
            (POISON_CELL, 17),
            40,
            top_x=3,
            top_y=17,
            landed=True,
        )
        poison_match.finalize_landed(0)
        self.assertGreater(poison_board.solid_ids[17][0], 0)
        self.assertEqual(
            poison_board.solid_ids[17][0], poison_board.solid_ids[17][1]
        )

        quake_match = AuthoritativeMatch(2, 8, 18, 0, 4, 0)
        quake_board = quake_match.players[0].board
        quake_board.set(0, 10, 16)
        quake_match.players[0].active = ActiveDomino(
            quake_board,
            (EARTHQUAKE_CELL, 17),
            40,
            top_x=3,
            top_y=17,
            landed=True,
        )
        quake_match.finalize_landed(0)
        self.assertEqual(0, quake_board.get(0, 10))
        self.assertNotEqual(0, quake_board.get(0, 17))

    def test_incoming_feedback_overflow_consumes_last_life_and_selects_winner(self) -> None:
        match = AuthoritativeMatch(2, 8, 18, 0, 4, 1)
        target = match.players[1]
        target.lives = 1
        target.board.set(3, 0, 16)

        eliminated = match.receive_feedback(
            1,
            shape=ReturnedShape(2, 1, 1, (True,)),
            shape_id=17,
        )

        self.assertTrue(eliminated)
        self.assertEqual(0, target.lives)
        self.assertFalse(target.active_slot)
        self.assertEqual(Outcome.WON, match.outcome)
        self.assertEqual(0, match.winner_slot)


if __name__ == "__main__":
    unittest.main()
