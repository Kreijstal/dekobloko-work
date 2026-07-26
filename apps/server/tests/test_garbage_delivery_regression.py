"""Regression tests for incoming-garbage delivery as a falling piece.

Every case here pins behaviour that was verified live against the ORIGINAL
client on 2026-07-25, and most of them pin a bug that actually shipped and
broke something. Read the docstrings before relaxing an assertion.

The live capture that these tests encode:

    server: SPAWN slot=1 queued_id=9 piece_id=11 rf=2x3 map=.#/.#/##
                  x=3 y=-2 orient=0 hpar=1 vpar=0
    client: STAGE   t=0->1 id=9 2x3 map=.#/.#/##
            RELEASE head_l=0
            DROP
    server: LAND  slot=1 3x2 map=#../### x=5 y=16 orient=1 life_lost=False

i.e. the blob queued as a visible warning, released, became the receiver's
falling piece, and was rotated and steered before landing.
"""

from __future__ import annotations

import unittest

from dekobloko_server.engine import (
    FAST_DROP,
    LEFT,
    ROTATE_CLOCKWISE,
    ROTATE_COUNTER_CLOCKWISE,
    LockResult,
    ReturnedShape,
)
from dekobloko_server.lobby import HostedGame

from test_multiplayer_gameplay_protocol import FakeSession


def render(piece) -> str:
    """The piece's live bitmap, in the same notation the tracers print."""
    width, height = piece.dimensions
    bitmap = piece.bitmap
    return "/".join(
        "".join("#" if bitmap[y * width + x] else "." for x in range(width))
        for y in range(height)
    )


def shape_from(text: str, width: int, height: int, colour: int = 2) -> ReturnedShape:
    rows = text.split("/")
    assert len(rows) == height and all(len(r) == width for r in rows)
    occupied = tuple(char == "#" for row in rows for char in row)
    return ReturnedShape(colour, width, height, occupied)


def start_game(game_id: int, players: int = 2):
    host = FakeSession("host")
    others = [FakeSession(f"peer{i}") for i in range(players - 1)]
    game = HostedGame(game_id=game_id, host=host)
    for peer in others:
        game.add_player(peer)
    game.start()
    return game, host, others


def land_current_piece(game, slot: int) -> None:
    for _ in range(80):
        if game.engine.apply_controls(slot, (FAST_DROP,)):
            return
    raise AssertionError(f"slot {slot} piece never landed")


def send_garbage(game, source: int, shape: ReturnedShape) -> None:
    lock = LockResult(3, 17, 0, 3, False, frozenset(), (shape,))
    game._dispatch_returned_shapes(source, lock)


class GarbageDeliveryRegression(unittest.TestCase):

    def test_spawned_piece_id_differs_from_the_queued_shape_id(self) -> None:
        """The crash that killed the client on the first build.

        The client caches every rf by id, and oi.a(rf, int) throws
        IllegalArgumentException when handed an id it already holds
        (oi.java:283). S2C 67 registers the cooked shape's id, so the S2C 64
        that spawns it must carry a DIFFERENT one. Live capture:
        queued_id=9, piece_id=11.
        """
        game, host, _ = start_game(41)
        send_garbage(game, 0, shape_from(".#/.#/##", 2, 3))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)

        queued = {shape_id for _slot, shape_id in host.feedback_shapes}
        spawned = {event[1] for event in host.piece_events}
        self.assertTrue(queued)
        self.assertTrue(spawned)
        self.assertEqual(set(), queued & spawned)

    def test_release_is_exactly_one_per_spawn(self) -> None:
        """lk.b(-19939) throws IllegalStateException if asked to release more
        shapes than are staged at field_e==0 (lk.java:1333), killing the
        client. One spawn consumes exactly one staged shape, so one release."""
        game, host, _ = start_game(42)
        send_garbage(game, 0, shape_from("##/##", 2, 2))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)

        self.assertEqual([(1, 1)], host.cooked_releases)

    def test_multiple_queued_shapes_drain_one_per_transition(self) -> None:
        """Three shapes must not be released in one breath.

        Releasing more than the client has staged throws; and draining them
        all at once would skip two of the three falling pieces entirely.
        """
        game, host, _ = start_game(43)
        for text, w, h in ((".#/.#/##", 2, 3), ("##/##", 2, 2), ("#../###", 3, 2)):
            send_garbage(game, 0, shape_from(text, w, h))
        self.assertEqual(3, len(game.pending_garbage[1]))

        seen = []
        for _ in range(3):
            land_current_piece(game, 1)
            game._finish_authoritative_piece(1)
            seen.append(len(host.cooked_releases))
            self.assertFalse(game.engine.players[1].active.is_domino)

        self.assertEqual([1, 2, 3], seen, "one release per transition")
        self.assertTrue(all(count == 1 for _slot, count in host.cooked_releases))
        self.assertEqual({}, game.pending_garbage)

    def test_arrival_neither_settles_cells_nor_snapshots(self) -> None:
        """Garbage must not be written into the grid on receipt.

        This is the original defect: the shape was settled immediately and the
        board pushed to every replica, so it appeared already-placed instead
        of dropping.
        """
        game, host, peers = start_game(44)
        board = game.engine.players[1].board
        before = board.occupied_count()
        # Match start legitimately seeds one snapshot per slot (it is what
        # lifts a remote replica's field_U off -1). Only arrival must be silent.
        host.full_states.clear()
        peers[0].full_states.clear()

        send_garbage(game, 0, shape_from("##/##", 2, 2))

        self.assertEqual(before, board.occupied_count())
        self.assertEqual([], [slot for slot, _payload in host.full_states])
        self.assertEqual([], [slot for slot, _payload in peers[0].full_states])

    def test_spawn_geometry_matches_the_live_capture(self) -> None:
        """The exact numbers observed against the original client."""
        game, _host, _ = start_game(45)
        send_garbage(game, 0, shape_from(".#/.#/##", 2, 3))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)

        active = game.engine.players[1].active
        self.assertEqual(".#/.#/##", render(active))
        self.assertEqual((2, 3), active.dimensions)
        self.assertEqual(3, active.x)          # (8 - 2) >> 1
        self.assertEqual(-2, active.y)         # -height + 1
        self.assertEqual(0, active.orientation)
        self.assertEqual(1, active.horizontal_parity)
        self.assertEqual(0, active.vertical_parity)
        self.assertFalse(active.is_domino)
        self.assertFalse(active.landed)

    def test_garbage_piece_rotates_exactly_as_the_client_does(self) -> None:
        """The rotation seen live: .#/.#/## -> #../### at orientation 1.

        Matches the oracle's golden row for J-2x3 under bit 8 (lk.i(int)).
        Both directions are covered here because they live in DIFFERENT client
        methods -- bit 4 -> lk.c(boolean), bit 8 -> lk.i(int) -- and an engine
        implementing only one would still pass a spawn-only check.
        """
        game, _host, _ = start_game(46)
        send_garbage(game, 0, shape_from(".#/.#/##", 2, 3))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)

        clockwise = game.engine.players[1].active
        clockwise.tick(ROTATE_CLOCKWISE)
        self.assertEqual("#../###", render(clockwise))
        self.assertEqual(1, clockwise.orientation)

        game2, _h2, _ = start_game(47)
        send_garbage(game2, 0, shape_from(".#/.#/##", 2, 3))
        land_current_piece(game2, 1)
        game2._finish_authoritative_piece(1)

        counter = game2.engine.players[1].active
        counter.tick(ROTATE_COUNTER_CLOCKWISE)
        self.assertEqual("###/..#", render(counter))
        self.assertEqual(3, counter.orientation)

    def test_garbage_piece_is_steerable_before_it_lands(self) -> None:
        """The behaviour the whole change exists for: it DROPS, it is not
        placed. It must accept movement and still be airborne afterwards."""
        game, _host, _ = start_game(48)
        send_garbage(game, 0, shape_from("#../###", 3, 2))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)

        active = game.engine.players[1].active
        start_x, start_y = active.x, active.y
        self.assertLess(start_y, 0, "spawns partly above the bucket")

        active.tick(LEFT)
        self.assertEqual(start_x - 1, active.x)
        self.assertFalse(active.landed)

        # Gravity is one row per base_drop_ticks (~40 at the default speed),
        # so a handful of ticks is not enough to move it.
        for _ in range(active.base_drop_ticks + 5):
            active.tick(0)
        self.assertGreater(active.y, start_y, "must fall under gravity")
        self.assertFalse(active.landed)

    def test_garbage_lands_and_commits_its_cells(self) -> None:
        """End of the lifecycle: the blob's cells reach the grid only on
        landing, and the count is exactly the blob's occupied cells."""
        game, _host, _ = start_game(49)
        board = game.engine.players[1].board
        send_garbage(game, 0, shape_from("#../###", 3, 2))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)

        fill_before = board.occupied_count()
        land_current_piece(game, 1)
        lock = game.engine.finalize_landed(1)

        self.assertFalse(lock.life_lost)
        self.assertEqual(4, len(lock.placed_cells))
        self.assertEqual(fill_before + 4, board.occupied_count())

    def test_full_bucket_tops_out_instead_of_spinning_forever(self) -> None:
        """A full bucket must end the match, not loop.

        Observed live: pieces 473, 474, 475, ... every one reporting
        "final=(3,0) lives=2" in an unbroken loop. The overflow test was
        `y < 0`, but an ordinary 2x1 domino spawns at top_y = -height + 1 = 0,
        so it can never be negative -- once the stack reached the top every
        piece landed instantly at y=0, no life was ever lost, and the game ran
        forever. Block out (the piece cannot occupy its spawn cells) is the
        condition that actually fires for a domino.
        """
        game, _host, _ = start_game(51)
        board = game.engine.players[1].board
        # Solid cells, not loose ones. A checkerboard of two LOOSE colours has
        # no group of four by itself, but the pieces that rain onto it are
        # random: a domino landing next to two matching cells completes one,
        # the top clears, and the bucket never tops out. That made this test
        # fail about one run in five. Solid cells are excluded by _is_loose, so
        # they can never match and never collapse, while still occupying the
        # spawn cells -- which is the only property the block-out test reads.
        for y in range(4):
            for x in range(board.width):
                board.set_solid(x, y, (x + y) % 2, 1 + y * board.width + x)

        for _ in range(12):
            land_current_piece(game, 1)
            game._finish_authoritative_piece(1)
            if game.state != "playing":
                break

        self.assertEqual("finished", game.state)
        self.assertIn(1, game.inactive_slots)
        self.assertEqual(0, game.engine.players[1].lives)

    def test_overhanging_cells_fall_even_when_nothing_clears(self) -> None:
        """A landing that matches nothing STILL collapses overhangs.

        This test previously asserted the opposite, from a replica board
        sampled at an install. That reading was wrong, and it is the reason
        the engine stalled boards mid-match: cells the client had already
        dropped stayed in mid-air server-side, so the two sides disagreed
        about which groups existed.

        Ground truth, measured on the unmodified jar with
        ``tools/oracle/ClearProbe settle``: a five-cell column with one cell
        overhanging an empty column ends with the overhang on the floor, with
        no match anywhere on the board. The client's tick runs gravity
        (lk.a states 19-101) before it ever looks for a match (states
        102-144), and a freshly spawned piece leaves field_ib = 0, the gravity
        phase.

        A replica sampled mid-fall does show the cell still up: the client
        moves it one row per tick and then plays a ~13-tick landing
        animation. That is the phase trap, not a physics difference.
        """
        game, _host, _ = start_game(53)
        board = game.engine.players[1].board
        # finalize_landed needs a piece that has actually come to rest, so drop
        # the spawned one out of the way first.
        land_current_piece(game, 1)
        # Then perch a cell at (2,16) with column 2 empty all the way down. A
        # colour of its own, so nothing here can be confused with a match.
        board.set(2, 16, 17)

        game.engine.finalize_landed(1)

        self.assertEqual(0, board.get(2, 16), "the overhang must not stay up")
        self.assertEqual(17, board.get(2, 17), "it falls to the floor")

    def test_spawn_on_an_empty_bucket_is_never_blocked(self) -> None:
        """The block-out test must not misfire on a normal spawn."""
        game, _host, _ = start_game(52)
        self.assertFalse(game.engine.players[0].active.blocked_at_spawn)
        self.assertFalse(game.engine.players[1].active.blocked_at_spawn)

        send_garbage(game, 0, shape_from("#../###", 3, 2))
        land_current_piece(game, 1)
        game._finish_authoritative_piece(1)
        self.assertFalse(game.engine.players[1].active.blocked_at_spawn)

    def test_release_is_sent_before_the_piece_event(self) -> None:
        """S2C 66 must precede S2C 64 for a garbage spawn.

        The client's own spawn-from-queue path takes the shape out of the
        queue and installs it as the active piece in one pass (qc.java case
        214 -> 221: lk.b(-19939) then lk.a(int,int,rf)). Sending the piece
        event first leaves a window where the board's queue has been drained
        but no active piece is installed; the client decides that board is
        dead, sets field_Bb and raises the T5 self-disconnect. Captured live
        with a nearly empty board:

            client 1077  [CT] RELEASE
            client 1079  Error: T5: 1 3 true
            client 1085  [CT] INSTALL id=17 3x3
        """
        game, host, _ = start_game(53)
        send_garbage(game, 0, shape_from("#../#../###", 3, 3))
        land_current_piece(game, 1)
        host.ordered_sends.clear()
        game._finish_authoritative_piece(1)

        kinds = [kind for kind in host.ordered_sends if kind in ("release", "piece")]
        self.assertIn("release", kinds, "no S2C 66 was sent for the garbage spawn")
        self.assertIn("piece", kinds, "no S2C 64 was sent for the garbage spawn")
        self.assertLess(
            kinds.index("release"),
            kinds.index("piece"),
            "S2C 66 release must be sent BEFORE the S2C 64 piece event",
        )

    def test_ordinary_pieces_never_carry_unrenderable_item_cells(self) -> None:
        """The crash seen the moment a room enabled special items.

        A piece is described by one byte of two nibbles, and the client's
        next-piece preview indexes a sprite table with each nibble directly:

            var21 = field_yb & 15
            fb.field_c[param7][var21]     (qc.java:11480)

        with fb.field_c = new ck[8][8] (fb.java:94) -- only nibbles 0..7 exist.
        lc.b decodes a nibble as (n & 7) + (n & 8 ? 24 : 16), so item cells
        24..31 are nibbles 8..15 and cannot be drawn. Emitting one killed the
        client on the first frame with ArrayIndexOutOfBoundsException: 8
        (observed live at special_level=4).

        The wildcard (cell 23 -> nibble 7) stays inside the table and is fine.
        """
        from dekobloko_server.lobby import GameOptions

        for level in range(5):
            for colours in range(3, 8):
                host = FakeSession("host")
                game = HostedGame(
                    game_id=200 + level * 10 + colours,
                    host=host,
                    options=GameOptions(special_level=level, colours=colours),
                )
                for _ in range(400):
                    piece = game.next_piece()
                    high = (piece.descriptor >> 4) & 0xF
                    low = piece.descriptor & 0xF
                    self.assertLessEqual(
                        high, 7,
                        f"level={level} colours={colours}: high nibble {high} "
                        f"overflows the client's 8-wide preview table",
                    )
                    self.assertLessEqual(low, 7, f"level={level} low nibble {low}")
                    for cell in piece.cells:
                        self.assertTrue(
                            16 <= cell <= 23,
                            f"level={level}: cell {cell} is outside the "
                            f"renderable ordinary range 16..23",
                        )

    def test_queue_survives_until_the_target_transitions(self) -> None:
        """The SOURCE finalizing must not drain the target's queue -- the
        shape has to stay staged as the visible incoming warning."""
        game, host, _ = start_game(50)
        send_garbage(game, 0, shape_from("##/##", 2, 2))
        self.assertEqual(1, len(game.pending_garbage[1]))

        land_current_piece(game, 0)
        game._finish_authoritative_piece(0)

        self.assertEqual([], host.cooked_releases)
        self.assertEqual(1, len(game.pending_garbage[1]))


if __name__ == "__main__":
    unittest.main()
