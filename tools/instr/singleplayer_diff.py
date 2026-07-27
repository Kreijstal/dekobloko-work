#!/usr/bin/env python3
"""Live tick differential: reflected original client vs Python game engine.

The instrumented client writes ``[CT] DIFF`` pre/post frames. This observer
bootstraps one Python ``ActiveDomino`` from the first pre-frame of each falling
piece, applies the exact reflected control once, then compares every mutable
physics field after the original client's matching tick.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

from dekobloko_server.engine import ActiveDomino, Board


def parse_frame(line: str) -> dict[str, str] | None:
    marker = "[CT] DIFF "
    start = line.find(marker)
    if start < 0:
        return None
    fields: dict[str, str] = {}
    for item in line[start + len(marker) :].strip().split():
        if "=" in item:
            key, value = item.split("=", 1)
            fields[key] = value
    return fields if "phase" in fields else None


def integer(frame: dict[str, str], key: str) -> int:
    return int(frame[key])


def cells(encoded: str) -> tuple[int, ...]:
    if len(encoded) % 2:
        raise ValueError(f"odd packed-cell string: {encoded!r}")
    return tuple(int(encoded[index : index + 2], 16)
                 for index in range(0, len(encoded), 2))


@dataclass
class Shadow:
    active: ActiveDomino
    initial_orientation: int
    last_frame: dict[str, str]
    waiting_for_transition: bool = False


def bootstrap(frame: dict[str, str]) -> Shadow:
    width, height = integer(frame, "bw"), integer(frame, "bh")
    board = Board(width, height)
    grid = cells(frame["grid"])
    if len(grid) != width * height:
        raise ValueError("client board snapshot has the wrong cell count")
    for index, value in enumerate(grid):
        board.set(index % width, index // width, value)

    piece_width, piece_height = integer(frame, "pw"), integer(frame, "ph")
    bitmap = cells(frame["piece"])
    active = ActiveDomino(
        board,
        bitmap,
        integer(frame, "base"),
        shape_width=piece_width,
        shape_height=piece_height,
        orientation=0,
        top_x=integer(frame, "x"),
        top_y=integer(frame, "y"),
        previous_controls=integer(frame, "prev"),
        horizontal_repeat=integer(frame, "repeat"),
        drop_countdown=integer(frame, "drop"),
        forced_drop_countdown=integer(frame, "forced"),
        grounded=frame["grounded"] == "true",
        landed=False,
        horizontal_parity=integer(frame, "hp"),
        vertical_parity=integer(frame, "vp"),
    )
    return Shadow(active, integer(frame, "orient"), frame)


def encoded_board(board: Board) -> str:
    return "".join(f"{value & 31:02x}"
                   for row in board.cells for value in row)


def encoded_piece(active: ActiveDomino) -> str:
    return "".join(f"{value & 31:02x}" for value in active.bitmap)


def expected(shadow: Shadow) -> dict[str, str]:
    active = shadow.active
    width, height = active.dimensions
    return {
        "grid": encoded_board(active.board),
        "pw": str(width),
        "ph": str(height),
        "piece": encoded_piece(active),
        "x": str(active.x),
        "y": str(active.y),
        "orient": str((shadow.initial_orientation + active.orientation) & 3),
        "drop": str(active.drop_countdown),
        "forced": str(active.forced_drop_countdown),
        "prev": str(active.previous_controls),
        "repeat": str(active.horizontal_repeat),
        "hp": str(active.horizontal_parity),
        "vp": str(active.vertical_parity),
        "grounded": "true" if active.grounded else "false",
    }


def is_new_piece(shadow: Shadow, frame: dict[str, str]) -> bool:
    if shadow.waiting_for_transition:
        return True
    previous = shadow.last_frame
    return (
        integer(frame, "forced") > integer(previous, "forced") + 100
        or frame["grid"] != previous["grid"]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trace", help="also preserve the complete client stdout")
    parser.add_argument("--max-ticks", type=int, default=0,
                        help="stop after this many compared ticks (0 = unlimited)")
    args = parser.parse_args()

    trace = open(args.trace, "w", encoding="utf-8") if args.trace else None
    shadows: dict[str, Shadow] = {}
    compared = 0
    mismatches = 0
    try:
        for line in sys.stdin:
            if trace:
                trace.write(line)
                trace.flush()
            frame = parse_frame(line)
            if frame is None:
                if "DIFF_START" in line:
                    print(line.rstrip(), flush=True)
                continue

            board_id = frame["board"]
            shadow = shadows.get(board_id)
            if frame["phase"] == "pre":
                if shadow is None or is_new_piece(shadow, frame):
                    shadow = bootstrap(frame)
                    shadows[board_id] = shadow
                    print(
                        f"[diff] bootstrap board={board_id} tick={frame['tick']} "
                        f"piece={frame['pw']}x{frame['ph']} "
                        f"at=({frame['x']},{frame['y']})",
                        flush=True,
                    )
                shadow.last_frame = frame
                shadow.waiting_for_transition = shadow.active.tick(
                    integer(frame, "ctrl")
                )
                continue

            if shadow is None:
                continue
            wanted = expected(shadow)
            differences = [
                f"{key}:engine={wanted[key]} client={frame.get(key)}"
                for key in wanted
                if wanted[key] != frame.get(key)
            ]
            compared += 1
            shadow.last_frame = frame
            if differences:
                mismatches += 1
                print(
                    f"[diff] MISMATCH board={board_id} tick={frame['tick']} "
                    + " | ".join(differences),
                    flush=True,
                )
            elif compared % 100 == 0:
                print(
                    f"[diff] matched={compared} mismatches={mismatches} "
                    f"last_tick={frame['tick']}",
                    flush=True,
                )
            if args.max_ticks and compared >= args.max_ticks:
                break
    finally:
        if trace:
            trace.close()

    print(f"[diff] summary matched_ticks={compared - mismatches} "
          f"mismatches={mismatches}", flush=True)
    return 1 if mismatches else 0


if __name__ == "__main__":
    raise SystemExit(main())
