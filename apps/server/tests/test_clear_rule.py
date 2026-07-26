"""The colour-clear rule, pinned against the unmodified client.

Every expectation here was produced by executing ``dekobloko.jar`` under
``tools/oracle/ClearProbe`` -- none of it is read off the decompiled source,
which has misled this project repeatedly on exactly this code.

Re-measure with::

    cd tools/oracle
    J8=/usr/lib/jvm/java-8-openjdk
    $J8/bin/javac -nowarn -cp ../../dekobloko.jar -d stub stub/ai.java
    $J8/bin/javac -nowarn -cp ../../dekobloko.jar -d . ClearProbe.java
    $J8/bin/java -cp stub:.:../../dekobloko.jar ClearProbe cases
    echo "8 18 <144 cells>" | $J8/bin/java -cp stub:.:../../dekobloko.jar \
        ClearProbe settle
"""

from __future__ import annotations

import unittest
from pathlib import Path

from dekobloko_server.engine import (
    BOMB_CELL,
    Board,
    DRILL_CELL,
    EARTHQUAKE_CELL,
    POISON_CELL,
    POWER_DRILL_CELL,
    WATER_CELL,
    WILDCARD_CELL,
    _fire_settled_drills,
    _find_matches,
    _resolve_matches_once,
)


FIXTURE = Path(__file__).with_name("fixtures") / "golden-clear-settle.tsv"


def cell_of(char: str) -> int:
    if char == ".":
        return 0
    if "a" <= char <= "h":
        return 16 + (ord(char) - ord("a"))
    if "A" <= char <= "H":
        return 8 + (ord(char) - ord("A"))
    return 24 + (ord(char) - ord("0"))


def char_of(cell: int) -> str:
    if cell == 0:
        return "."
    if 16 <= cell <= 23:
        return chr(ord("a") + cell - 16)
    if 8 <= cell <= 15:
        return chr(ord("A") + cell - 8)
    if 24 <= cell <= 31:
        return chr(ord("0") + cell - 24)
    return "?"


def board_from(rows: list[str]) -> Board:
    board = Board(len(rows[0]), len(rows))
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            board.set(x, y, cell_of(char))
    return board


def render(board: Board) -> list[str]:
    return [
        "".join(char_of(board.get(x, y)) for x in range(board.width))
        for y in range(board.height)
    ]


def settle(board: Board) -> None:
    """The engine's resting state, mirroring ``_resolve_cascades``.

    Gravity, then matches, then -- only once nothing matches -- drills. That
    order is measured; see ``AuthoritativeMatch._resolve_cascades``.
    """
    board.collapse_loose()
    while True:
        changed, _ = _resolve_matches_once(board, 7, 0)
        if changed:
            board.collapse_loose()
            continue
        if _fire_settled_drills(board, 0) is None:
            return
        board.collapse_loose()


class ClearDetection(unittest.TestCase):
    """What the client counts as a group. Measured with ``ClearProbe cases``."""

    def groups(self, rows: list[str]) -> list[set[tuple[int, int]]]:
        board = board_from(rows)
        return [set(positions) for _colour, positions in _find_matches(board, 7)]

    def test_four_in_a_row_is_the_minimum(self) -> None:
        # Client: seed (0,0) returns 4; three in a row returns nothing.
        self.assertEqual(1, len(self.groups(["aaaa"])))
        self.assertEqual([], self.groups(["aaa."]))

    def test_groups_are_four_connected_not_eight(self) -> None:
        # A diagonal chain of four never returns a group on the client.
        self.assertEqual([], self.groups(["a...", ".a..", "..a.", "...a"]))
        # The same four cells as an L do.
        self.assertEqual(1, len(self.groups(["aaa.", "a...", "....", "...."])))

    def test_wildcards_join_a_group_but_never_seed_one(self) -> None:
        # 23 short-circuits at the head of the flood fill when param5 == -1,
        # so a field of wildcards clears nothing on its own...
        self.assertEqual([], self.groups(["hhhh"]))
        # ...but three colours plus a wildcard reach four and clear.
        self.assertEqual(1, len(self.groups(["aaah"])))

    def test_one_wildcard_serves_two_colours(self) -> None:
        # Measured: "8 2 aaah....hbbb...." tags 0,1,2,3,8,9,10,11 -- every
        # cell. The client clears the visited flag on wildcards after each
        # seed (lk.java:1000), so both the a group and the b group count it.
        board = board_from(["aaah....", "hbbb...."])
        changed, _ = _resolve_matches_once(board, 7, 0)
        self.assertTrue(changed)
        self.assertEqual(0, board.occupied_count())

    def test_powerups_never_join_a_colour_group(self) -> None:
        # The seed test is (cell & 0x8FFFFFFF) >> 3 == 2, i.e. 16..23 only.
        for powerup in (EARTHQUAKE_CELL, BOMB_CELL, WATER_CELL, POISON_CELL):
            board = board_from(["aa.a"])
            board.set(2, 0, powerup)
            self.assertEqual(
                [], [g for _c, g in _find_matches(board, 7)],
                f"powerup {powerup} must not bridge a colour group",
            )

    def test_all_groups_of_a_wave_clear_together(self) -> None:
        # Measured: "aaaabbbb" on one row tags both runs in the same pass.
        board = board_from(["aaaabbbb"])
        changed, _ = _resolve_matches_once(board, 7, 0)
        self.assertTrue(changed)
        self.assertEqual(0, board.occupied_count())


class ClearGravity(unittest.TestCase):
    """When cells fall. Measured with ``ClearProbe settle``."""

    def test_overhang_falls_with_no_match_anywhere(self) -> None:
        # Measured: the client drops the overhanging cell to the floor even
        # though nothing on the board can ever match. Its tick runs gravity
        # before detection, and a fresh piece leaves field_ib = 0.
        board = board_from(
            ["aa", "b.", "c.", "d.", "e.", "f."]
        )
        settle(board)
        self.assertEqual(
            ["a.", "b.", "c.", "d.", "e.", "fa"], render(board)
        )

    def test_powerups_fall_but_solids_do_not(self) -> None:
        # Measured one powerup at a time: 24, 26, 28, 29 and 30 all land on
        # the floor; a solid (8) stays in mid-air. The client's gravity gate
        # is (cell & 24) == 16 || (cell & 24) == 24, which admits 16..31 and
        # excludes 8..15.
        for powerup in (EARTHQUAKE_CELL, BOMB_CELL, WATER_CELL, POISON_CELL, 30):
            board = board_from(["aa", "b.", "c."])
            board.set(1, 0, powerup)
            board.collapse_loose()
            self.assertEqual(0, board.get(1, 0), f"powerup {powerup} must fall")
            self.assertEqual(powerup, board.get(1, 2))

        solid = board_from(["a.", "b.", "c."])
        solid.set_solid(1, 0, 0, solid.allocate_solid_id())
        solid.collapse_loose()
        self.assertEqual(8, solid.get(1, 0), "a solid must stay in mid-air")

    def test_collapse_before_the_first_match_can_create_a_group(self) -> None:
        # This is the shape of the live bug: three of a colour on the floor
        # and a fourth hanging over the gap. The client drops it and clears;
        # an engine that only collapsed after a wave would clear nothing and
        # then disagree with the client's board for the rest of the match.
        # Measured: "4 3 ...ab...aaa." settles to "........b..." on the
        # client -- the hanging cell drops into the gap, completes the run of
        # four, the run clears, and the stray b lands on the floor.
        board = board_from(
            [
                "...a",
                "b...",
                "aaa.",
            ]
        )
        settle(board)
        self.assertEqual(["....", "....", "b..."], render(board))


class Drills(unittest.TestCase):
    """Drill reach and triggering. Measured with ``ClearProbe settle``.

    The whole family was unpinned before this: the differential fuzz that
    validated the colour rule only ever generated ``. a b c d h`` boards, so
    no powerup was exercised even once and these bugs sat behind a green
    suite.
    """

    def drill_at(self, rows: list[str], x: int, y: int, cell: int) -> Board:
        board = board_from(rows)
        board.set(x, y, cell)
        settle(board)
        return board

    def test_a_drill_clears_downward_not_the_whole_column(self) -> None:
        # Measured: a drill at (3,15) over a full column destroys itself,
        # (3,16) and (3,17), and the two cells ABOVE it fall into the hole.
        # The old _drill cleared range(board.height) -- the entire column --
        # which ate the rest of the piece whenever a drill settled as the
        # bottom cell of a vertical triple.
        # Client: "4 5 a...b...1...cbcbbcbc" settles to the a and b landing on
        # top of the untouched support rows -- they are NOT destroyed.
        board = self.drill_at(["a...", "b...", "....", "cbcb", "bcbc"], 0, 2, DRILL_CELL)
        self.assertEqual(
            ["....", "....", "....", "abcb", "bcbc"], render(board)
        )

    def test_a_drill_fires_when_it_comes_to_rest_not_only_when_placed(self) -> None:
        # Measured: a drill riding on top of a group that clears falls into
        # the hole and fires there, with nothing having been placed. The
        # engine used to fire drills only from _activate_placed_specials.
        board = board_from(["....", "aaaa", "bcbc"])
        board.set(1, 0, DRILL_CELL)
        settle(board)
        self.assertEqual(["....", "....", "b.bc"], render(board))

    def test_a_power_drill_takes_the_colour_group_a_plain_drill_does_not(self) -> None:
        plain = board_from(["....", ".aaa", "bcbc"])
        plain.set(2, 0, DRILL_CELL)
        settle(plain)
        self.assertEqual(["....", ".a.a", "bc.c"], render(plain))

        power = board_from(["....", ".aaa", "bcbc"])
        power.set(2, 0, POWER_DRILL_CELL)
        settle(power)
        self.assertEqual(["....", "....", "bc.c"], render(power))

    def test_a_wildcard_is_a_joker_only_when_the_drill_hits_it_directly(self) -> None:
        # Hit directly, every adjacent colour goes with it.
        seeded = board_from(["....", "bha.", "cbcb"])
        seeded.set(1, 0, POWER_DRILL_CELL)
        settle(seeded)
        self.assertEqual(["....", "....", "c.cb"], render(seeded))

        # Merely absorbed into a colour group, it does NOT extend that group
        # into a different colour. Re-measured, because this one data point
        # decides the rule: the b directly beneath the absorbed h survives.
        # Client: "4 3 3...aah.bcbc" settles to ".cbc" -- the b at (2,2), the
        # cell directly under the absorbed h, is still standing.
        absorbed = board_from(["....", "aah.", "bcbc"])
        absorbed.set(0, 0, POWER_DRILL_CELL)
        settle(absorbed)
        self.assertEqual(["....", "....", ".cbc"], render(absorbed))
        self.assertEqual("b", char_of(absorbed.get(2, 2)),
                         "the cell under an ABSORBED wildcard must survive")

    def test_all_settled_drills_fire_in_one_pass_without_collapsing(self) -> None:
        # Shrunk from a fuzz failure to five cells. Collapsing between the two
        # shots drops the c into (0,17), where the power drill's group then
        # reaches and destroys it. The client keeps it: when the power drill
        # fires, that square is still the hole the first drill just made.
        board = board_from(["c...", "....", "h...", ".c.."])
        board.set(0, 1, DRILL_CELL)
        board.set(1, 1, POWER_DRILL_CELL)
        settle(board)
        self.assertEqual("c", char_of(board.get(0, 3)),
                         "the c must survive and fall, not be drilled")

    def test_only_the_drills_fire_on_their_own(self) -> None:
        # Measured over all eight powerups on a settled board: 25 and 27 fire
        # by themselves, the rest sit inert until something triggers them.
        for powerup in (EARTHQUAKE_CELL, BOMB_CELL, WATER_CELL, POISON_CELL):
            board = board_from(["....", "abca"])
            board.set(1, 0, powerup)
            self.assertIsNone(
                _fire_settled_drills(board, 0), f"powerup {powerup} must not fire"
            )
        for drill in (DRILL_CELL, POWER_DRILL_CELL):
            board = board_from(["....", "abca"])
            board.set(1, 0, drill)
            self.assertIsNotNone(_fire_settled_drills(board, 0))


@unittest.skipIf(
    not FIXTURE.exists(),
    f"golden table not generated: {FIXTURE.name} -- regenerate it with "
    "tools/oracle/ClearProbe settle (see this module's docstring)",
)
class GoldenClearSettle(unittest.TestCase):
    """160 client-measured boards, replayed against the engine."""

    def test_matches_the_client(self) -> None:
        rows = []
        with FIXTURE.open() as handle:
            for line in handle:
                if line.startswith("#") or line.startswith("width"):
                    continue
                width, height, start, settled = line.rstrip("\n").split("\t")
                rows.append((int(width), int(height), start, settled))
        self.assertEqual(160, len(rows))

        failures = []
        for width, height, start, expected in rows:
            board = board_from(
                [start[y * width:(y + 1) * width] for y in range(height)]
            )
            settle(board)
            actual = "".join(render(board))
            if actual != expected:
                failures.append((width, height, start, expected, actual))
        self.assertEqual([], failures[:3], f"{len(failures)} of {len(rows)} boards")


if __name__ == "__main__":
    unittest.main()
