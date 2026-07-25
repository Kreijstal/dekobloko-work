"""Assert the generalized active piece against the real client.

``tools/oracle/ParityProbe`` drives the unmodified ``dekobloko.jar`` and dumps
what ``lk`` actually does when an arbitrary shape is installed as the falling
piece. This checks the Python engine reproduces it exactly, which is what makes
it safe to deliver cooked feedback shapes as real falling pieces.
"""

from pathlib import Path
import unittest

from dekobloko_server.engine import ActiveDomino, Board

FIXTURE = Path(__file__).parent / "fixtures" / "golden-active-piece.tsv"
ROTATION_FIXTURE = Path(__file__).parent / "fixtures" / "golden-rotation.tsv"

BUCKETS = {"small": (8, 18), "large": (12, 27)}
CELL = 24  # value is irrelevant: the install keys on occupancy only


def parse_map(text: str, width: int, height: int) -> tuple[int, ...]:
    rows = text.split("/")
    assert len(rows) == height, f"{text} is not {height} rows"
    cells: list[int] = []
    for row in rows:
        assert len(row) == width, f"{text} row is not {width} wide"
        cells.extend(CELL if char == "#" else 0 for char in row)
    return tuple(cells)


def load_golden():
    with FIXTURE.open() as handle:
        for line in handle:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            bucket, width, height, shape, x, y, hpar, vpar, drop, forced = (
                line.split("\t")
            )
            yield {
                "bucket": bucket,
                "width": int(width),
                "height": int(height),
                "map": shape,
                "x": int(x),
                "y": int(y),
                "h_parity": int(hpar),
                "v_parity": int(vpar),
                "drop": int(drop),
                "forced_drop": int(forced),
            }


def load_rotation_golden():
    with ROTATION_FIXTURE.open() as handle:
        for line in handle:
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            (
                bucket, width, height, shape, direction,
                rw, rh, rmap, x, y, hpar, vpar,
            ) = line.split("\t")
            yield {
                "bucket": bucket,
                "width": int(width),
                "height": int(height),
                "map": shape,
                "dir": direction,
                "rw": int(rw),
                "rh": int(rh),
                "rmap": rmap,
                "x": int(x),
                "y": int(y),
                "h_parity": int(hpar),
                "v_parity": int(vpar),
            }


class ActivePieceMatchesOriginalClient(unittest.TestCase):
    def test_spawn_geometry_matches_every_golden_row(self):
        rows = list(load_golden())
        self.assertGreater(len(rows), 100_000, "golden fixture looks truncated")

        failures = []
        for row in rows:
            board_width, board_height = BUCKETS[row["bucket"]]
            cells = parse_map(row["map"], row["width"], row["height"])
            piece = ActiveDomino(
                Board(board_width, board_height),
                cells,
                0,
                shape_width=row["width"],
                shape_height=row["height"],
            )
            actual = (
                piece.x,
                piece.y,
                piece.horizontal_parity,
                piece.vertical_parity,
                piece.drop_countdown,
                piece.forced_drop_countdown,
            )
            expected = (
                row["x"],
                row["y"],
                row["h_parity"],
                row["v_parity"],
                row["drop"],
                row["forced_drop"],
            )
            if actual != expected:
                failures.append((row["bucket"], row["map"], expected, actual))
                if len(failures) >= 10:
                    break

        self.assertEqual(
            failures, [], f"{len(failures)} golden row(s) disagree with the client"
        )

    def test_dimensions_track_the_bounding_box(self):
        for row in list(load_golden())[:2000]:
            board_width, board_height = BUCKETS[row["bucket"]]
            cells = parse_map(row["map"], row["width"], row["height"])
            piece = ActiveDomino(
                Board(board_width, board_height),
                cells,
                0,
                shape_width=row["width"],
                shape_height=row["height"],
            )
            self.assertEqual(piece.dimensions, (row["width"], row["height"]))

    def test_ordinary_domino_is_unchanged(self):
        """The two-cell form must construct exactly as it did before."""
        piece = ActiveDomino(Board(8, 18), (16, 17), 40)
        self.assertTrue(piece.is_domino)
        self.assertEqual(piece.dimensions, (2, 1))
        self.assertEqual((piece.x, piece.y), (3, 0))
        self.assertEqual(piece.horizontal_parity, 1)
        self.assertEqual(piece.vertical_parity, 0)
        self.assertEqual(piece.bitmap, (16, 17))
        self.assertEqual(piece.descriptor, 1)

    def test_four_rotations_return_to_the_spawn_geometry(self):
        """Matches `ParityProbe rotate`, where rot4 always re-closes."""
        shapes = [
            (3, 2, "#../###"),
            (3, 2, "###/.#."),
            (3, 2, ".##/##."),
            (2, 3, ".#/.#/##"),
            (4, 1, "####"),
        ]
        for width, height, shape in shapes:
            with self.subTest(shape=shape):
                piece = ActiveDomino(
                    Board(8, 18), parse_map(shape, width, height), 0,
                    shape_width=width, shape_height=height,
                )
                start = (piece.bitmap, piece.dimensions)
                for _ in range(4):
                    piece._rotate(clockwise=False)
                self.assertEqual((piece.bitmap, piece.dimensions), start)

    def test_both_rotation_directions_match_every_golden_row(self):
        """bit4 -> lk.c(boolean), bit8 -> lk.i(int): two distinct directions.

        They live in different client methods, so a single-direction engine
        would pass a spawn-only check and still desync the moment a player
        rotated the other way.
        """
        rows = list(load_rotation_golden())
        self.assertGreater(len(rows), 200_000, "rotation fixture looks truncated")

        failures = []
        for row in rows:
            board_width, board_height = BUCKETS[row["bucket"]]
            piece = ActiveDomino(
                Board(board_width, board_height),
                parse_map(row["map"], row["width"], row["height"]),
                0,
                shape_width=row["width"],
                shape_height=row["height"],
            )
            piece._rotate(clockwise=(row["dir"] == "bit8"))
            actual = (
                piece.dimensions,
                piece.x,
                piece.y,
                piece.horizontal_parity,
                piece.vertical_parity,
            )
            expected = (
                (row["rw"], row["rh"]),
                row["x"],
                row["y"],
                row["h_parity"],
                row["v_parity"],
            )
            if actual != expected:
                failures.append((row["map"], row["dir"], expected, actual))
                if len(failures) >= 10:
                    break

        self.assertEqual(
            failures, [], f"{len(failures)} rotation row(s) disagree with the client"
        )

    def test_rotated_bitmap_matches_the_client(self):
        """The rotated cell layout itself, not just the bounding box."""
        failures = []
        for row in list(load_rotation_golden()):
            if row["bucket"] != "small":
                continue
            board_width, board_height = BUCKETS[row["bucket"]]
            piece = ActiveDomino(
                Board(board_width, board_height),
                parse_map(row["map"], row["width"], row["height"]),
                0,
                shape_width=row["width"],
                shape_height=row["height"],
            )
            piece._rotate(clockwise=(row["dir"] == "bit8"))
            width, height = piece.dimensions
            rendered = "/".join(
                "".join(
                    "#" if piece.bitmap[y * width + x] else "."
                    for x in range(width)
                )
                for y in range(height)
            )
            if rendered != row["rmap"]:
                failures.append((row["map"], row["dir"], row["rmap"], rendered))
                if len(failures) >= 10:
                    break
        self.assertEqual(failures, [], "rotated bitmaps disagree with the client")

    def test_cooked_shape_that_cannot_descend_costs_a_life_on_landing(self):
        """Garbage takes a life by OVERFLOWING, not by arriving.

        A multi-row shape spawns partly above the board (y = -height + 1); if
        the stack leaves it no room, it locks with y < 0 and that is a lost
        life -- the same path an ordinary piece takes. Checked at the engine
        level so no colour-clear can empty the board underneath it.
        """
        board = Board(8, 18)
        # Fill without ever putting the same colour next to itself, so nothing
        # the piece touches can form a matching group.
        for y in range(board.height):
            for x in range(board.width):
                board.set(x, y, 16 + ((x + y) % 2))

        piece = ActiveDomino(
            board, (8 | 2, 8 | 2), 0, shape_width=1, shape_height=2
        )
        self.assertEqual(-1, piece.y)
        self.assertFalse(piece.is_domino)

        for _ in range(60):
            if piece.tick(0):
                break
        self.assertTrue(piece.landed, "piece should have locked against the stack")

        result = piece.finalize(3)
        self.assertTrue(result.life_lost)
        self.assertEqual(2, result.lives_remaining)

    def test_cooked_shape_reports_no_descriptor_instead_of_raising(self):
        """Cooked cells are 8|colour, outside the descriptor vocabulary."""
        piece = ActiveDomino(
            Board(8, 18), (8 | 2, 8 | 3, 8 | 2, 8 | 3), 0,
            shape_width=2, shape_height=2,
        )
        self.assertFalse(piece.is_domino)
        self.assertEqual(piece.descriptor, 0)


if __name__ == "__main__":
    unittest.main()
