#!/usr/bin/env python3
"""Diff server vs client board signatures to locate the first replica drift.

    python3 tools/instr/diff_boards.py srv.log client.log

Both sides emit positional dumps in the same vocabulary:

    server:  [garbage] SIG slot=1 at=finalize 8x18 fill=6 rows=........|...
    client:  [CT] SIG board=34c1ff58 at=install 8x18 fill=6 rows=........|...

The client keys boards by identity hash and the server by slot, so the two
streams cannot be paired directly.  Piece ids bridge them -- the server logs
``sent piece event slot=N piece=ID`` and the client logs
``INSTALL {board=HASH ...} id=ID``.

Piece ids RESTART every game, so the pairing must be done per game or boards
from different matches get spliced into one stream and the diff reports drift
that is really just a game boundary.  Games are delimited server-side by
``sent player match start game=N``.

Why positional and not fill counts: a replica holding the right NUMBER of
cells in the wrong PLACES reports an identical fill, then lands later pieces
at the wrong height.  That is the failure this exists to catch.
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict

MATCH_START = re.compile(r"sent player match start game=(\d+)")
SRV_PIECE = re.compile(r"sent piece event slot=(\d+) piece=(\d+)")
SRV_SIG = re.compile(r"SIG slot=(\d+) at=(\w+) \d+x\d+ fill=\d+ rows=(\S+)")
CLI_INSTALL = re.compile(r"INSTALL \{board=([0-9a-f]+).*?\} id=(\d+)")
CLI_SIG = re.compile(r"SIG\s+board=([0-9a-f]+) at=(\w+) \d+x\d+ fill=\d+ rows=(\S+)")


def read(path: str) -> list[str]:
    with open(path, encoding="utf-8", errors="replace") as handle:
        return handle.readlines()


def parse_server(lines: list[str]):
    """-> (piece_slot_by_game, sigs_by_game_slot) keyed by game number."""
    piece_slot: dict[int, dict[str, int]] = defaultdict(dict)
    sigs: dict[tuple[int, int], list[str]] = defaultdict(list)
    game = 0
    for line in lines:
        m = MATCH_START.search(line)
        if m:
            game = int(m.group(1))
            continue
        m = SRV_PIECE.search(line)
        if m:
            piece_slot[game].setdefault(m.group(2), int(m.group(1)))
            continue
        m = SRV_SIG.search(line)
        if m and m.group(2) == "finalize":
            sigs[(game, int(m.group(1)))].append(m.group(3))
    return piece_slot, sigs


def parse_client(lines: list[str]):
    """-> (piece ids installed per board, install signatures per board)."""
    pieces: dict[str, list[str]] = defaultdict(list)
    sigs: dict[str, list[str]] = defaultdict(list)
    for line in lines:
        m = CLI_INSTALL.search(line)
        if m:
            pieces[m.group(1)].append(m.group(2))
            continue
        m = CLI_SIG.search(line)
        # Only ``install``: it fires once the PREVIOUS piece has committed,
        # the same instant the server's ``finalize`` describes.  ``landed``
        # fires before the cells are written to the grid, so mixing the two
        # compares different instants and manufactures drift.
        if m and m.group(2) == "install":
            sigs[m.group(1)].append(m.group(3))
    return pieces, sigs


def locate(board_pieces: list[str], piece_slot) -> tuple[int, int] | None:
    """Assign a client board to the (game, slot) its piece ids best explain."""
    votes: Counter = Counter()
    for game, mapping in piece_slot.items():
        for piece in board_pieces:
            if piece in mapping:
                votes[(game, mapping[piece])] += 1
    if not votes:
        return None
    (best, count), = votes.most_common(1)
    # A board whose ids scatter across several games is not trustworthy.
    if count < max(1, len(board_pieces) // 2):
        return None
    return best


def rows_of(sig: str) -> list[str]:
    return sig.split("|")


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    piece_slot, srv_sigs = parse_server(read(sys.argv[1]))
    cli_pieces, cli_sigs = parse_client(read(sys.argv[2]))

    placed: dict[tuple[int, int], list[str]] = {}
    print("board -> (game, slot):")
    for board, ids in sorted(cli_pieces.items()):
        where = locate(ids, piece_slot)
        print(f"  {board} -> {where if where else 'unresolved'}"
              f"  ({len(ids)} installs)")
        if where and board in cli_sigs:
            if where in placed:
                print(f"    note: {where} already claimed; skipping {board}")
                continue
            placed[where] = cli_sigs[board]
    print()

    drift = False
    for key in sorted(set(srv_sigs) | set(placed)):
        game, slot = key
        srv, cli = srv_sigs.get(key, []), placed.get(key, [])
        print(f"=== game {game} slot {slot}: "
              f"{len(srv)} server / {len(cli)} client sync points ===")
        if not srv or not cli:
            print("  not enough data on one side\n")
            continue
        # The streams can start a piece apart (the client installs a first
        # piece the server never finalized).  Pick the shift that agrees
        # longest rather than assuming one.
        best_shift, best_run = 0, -1
        for shift in range(-3, 4):
            run = 0
            for n, s in enumerate(srv):
                j = n + shift
                if 0 <= j < len(cli) and cli[j] == s:
                    run += 1
                else:
                    break
            if run > best_run:
                best_shift, best_run = shift, run
        if best_run <= 0:
            print("  no alignment: streams differ from the first sync point")
            best_shift = 0
        elif best_shift:
            print(f"  (aligned with client offset {best_shift:+d})")
        shifted = cli[best_shift:] if best_shift > 0 else [""] * -best_shift + cli

        for n, (s, c) in enumerate(zip(srv, shifted)):
            if s == c:
                continue
            drift = True
            print(f"  FIRST DRIFT at sync point {n} "
                  f"(after {best_run} matching):")
            srv_rows, cli_rows = rows_of(s), rows_of(c)
            width = max(len(srv_rows), len(cli_rows))
            for r in range(width):
                a = srv_rows[r] if r < len(srv_rows) else ""
                b = cli_rows[r] if r < len(cli_rows) else ""
                if a == b and not a.strip("."):
                    continue          # skip shared empty rows for readability
                mark = "" if a == b else "   <-- differs"
                print(f"    row {r:2d}  srv {a or '(none)':10s} "
                      f"cli {b or '(none)':10s}{mark}")
            break
        else:
            print(f"  identical across {min(len(srv), len(shifted))} sync points")
        print()

    return 1 if drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
