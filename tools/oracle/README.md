# Active-piece ground-truth oracle

Extracts the real client's active-piece install behaviour by calling
`lk.a(int, int, rf)` on the **unmodified original** `dekobloko.jar`, with no
game, no network and no rendering.

This exists because generalizing the server's `ActiveDomino` from 2-cell
dominoes to arbitrary garbage bitmaps requires the spawn position and the
rotation-kick parities to be bit-exact. If the server and the owner's local
simulation disagree, the board desyncs and the client self-disconnects (the
"T5" path). Those values could not be read off the decompiled source with
confidence, so they are measured instead.

## How it works

`lk` is allocated with `Unsafe.allocateInstance`, which skips its constructor,
so none of the game state it would normally need is required. Only the fields
`lk.a(int, int, rf)` actually reads are seeded:

* `field_O` = bucket width, `field_a` = bucket height (note this order — the
  `lk` constructor sets `field_O=12, field_a=27` for the large bucket)
* `field_P` / `field_w` — the board grids it indexes
* `field_U = -1`, `field_t = 0`, `field_X`, `field_jb`

`rf` is a plain data holder, so a stub is just `field_b` (width), `field_n`
(height) and `field_c` (the packed 5-bit cells).

The method is invoked with `param0 = 127`; the branch at `param0 > 73` skips
the `this.a(false)` call, which is the only part that would need rendering
state.

Field names are resolved with or without the deobfuscation pipeline's
`field_` prefix, so the same probe runs against the original jar and against a
recompiled build as a cross-check.

## Field mapping

Taken from the opcode-61 reader `lk.a(boolean, wl, byte)`, which fixes the
wire order and therefore the meaning of each field:

| `lk` field | meaning |
|---|---|
| `field_ab` | orientation (flags bits 9-10) |
| `field_o`  | vertical parity (flags bits 3-4, sign-extended) |
| `field_db` | horizontal parity (flags bits 1-2, sign-extended) |
| `field_q`  | active piece x |
| `field_L`  | active piece y |
| `field_e`  | drop countdown |
| `field_Ab` | forced drop countdown |
| `field_C` / `field_zb` | piece width / height |

## Rotation

`ParityProbe rotate` drives a shape through four rotations on an empty board
and dumps the live geometry (`field_T` laid out `field_C x field_zb`) each
step. Gravity is parked so each step isolates the rotation.

The rotation is `lk.c(boolean)`, which `lk.d` dispatches to on the rotate bit.
Calling it directly avoids the `lk.i(0)` redraw in the same tick. `lk.t(int)`
— the rotation attempt itself — still redraws via `ge.a(int,int,byte,ud)`, so
`stub/ge.java` shadows that one method with a no-op; every other class still
comes from the original jar. Without the stub the NPE from the missing sprite
is swallowed by the obfuscator's `dh.a(Throwable,String) -> jb` wrapper, which
hides the real cause; the probe unwraps `jb`'s fields to recover it.

What the traces establish:

* **`lk.c(boolean)`'s parameter is not the direction.** `c(true)` and
  `c(false)` produce byte-identical geometry; the flag only gates a side call
  (`c(61,75)`). `lk.d` has a single `c(Z)` call site, on bit 4.
* **There are nevertheless two rotation directions**, because bit 8 reaches a
  different method. `lk.d` dispatches bit 4 to `lk.c(boolean)` and bit 8 to
  `lk.i(int)` (`lk.java:1186` and `lk.java:1203`). `lk.i` negates `field_o`
  and `field_db` and re-tests placement with `q()`, which reads like a parity
  flip rather than a rotation in the decompiled source -- but measured, it
  rotates. See the correction below.
* The rotation is **counter-clockwise**, and `field_ab` is a free-running
  counter that *decrements* (0, -1, -2, -3, -4) rather than a masked 0..3.
  Only `& 3` reaches the wire, and `(orientation + 3) & 3` is the same value,
  so the server's representation is compatible.
* The server's `_rotate(clockwise=False)` reproduces the client exactly
  (domino: `x=4 y=0 hpar=0 vpar=-1`), so the existing bit-4 handler is right.
  `_rotate(clockwise=True)` does **not** (`y=-1`, `vpar=+1`) — see below.
* Four rotations always close back to the spawn geometry.

### Correction (2026-07-25): there is no divergence — do NOT remove bit 8

An earlier revision of this file claimed the client ignored bit 8 and that
`ActiveDomino`'s `_rotate(clockwise=True)` should be deleted. That was wrong,
and acting on it would have introduced the desync it was trying to prevent.

The mistake was comparing the server's *clockwise* result against the client's
*bit 4* result and reporting the difference as an error. Driving bit 8 through
`lk.i(int)` on the original jar (`ParityProbe rotate`, `directionCompare`)
shows it is a genuine second rotation — the domino goes `##` -> `#/#` either
way — and that it lands exactly where the server already puts it:

| bit | client (measured) | server |
|---|---|---|
| 4 | `x=4 y=0 hpar=0 vpar=-1` | `_rotate(clockwise=False)` — identical |
| 8 | `x=4 y=-1 hpar=0 vpar=+1` | `_rotate(clockwise=True)` — identical |

Both handlers are correct as they stand. The lesson is the one this directory
exists for: `lk.i` *reads* like a parity flip in the decompiled source, and
only measurement showed it is the opposite rotation.

### Full rotation sweep: 231,424 rows, 0 mismatches (2026-07-25)

`ParityProbe rotsweep` piped through a comparator that rebuilds each shape in
`ActiveDomino` and applies the matching `_rotate` agrees on **every** row --
resulting dimensions, cell map, x, y, and both parities, for every tight
bitmap in a 4x4 box, both buckets, both bits.

So the rotation primitive is settled: it is NOT a source of board divergence,
and a desync seen mid-match should not be blamed on it. This was checked after
a live T5 in which a replica landed a 3x4 garbage shape at row 3 while the
server placed it at row 7 with identical board contents on both sides -- the
rotation looked like the obvious culprit and measurably was not.

**What this sweep does not cover**, and where that divergence must therefore
live:

* rotation against a NON-empty board -- now covered, see `kicksweep` below;
* sequences of more than one rotation, where `field_ab` free-runs and the
  parities evolve step to step;
* the interaction with the garbage `RELEASE`/`DROP` packets, which change the
  active shape mid-descent.

### Kick sweep: 51,200 rows, 0 mismatches (2026-07-25)

`ParityProbe kicksweep` closes the first of those gaps. Rows 16-17 are solid,
row 15 is carved by a 6-bit pattern, and the piece is parked directly above by
assigning `field_q`/`field_L` -- deliberately NOT by descending, so the kick is
isolated from the descent path. Every tight bitmap in a 3x3 box, both bits, all
64 patterns.

Geometry, position, both parities and `field_ab & 3` agree on every row.

Coverage caveat, because "0 mismatches" is only as good as the sweep's power:
of the 800 shape/direction groups, **41 change their result depending on the
terrain**. So the blocked path is genuinely exercised and genuinely agrees --
but the terrain sits below the piece, so this mostly tests rotations that grow
DOWNWARD into it. Lateral blocking is thinner. If a desync is ever traced back
to a kick, widen the pattern to the columns beside the piece before concluding
the engine is right.

### Still open

Rotation is now well established in both directions, empty and blocked. The
live failure it was meant to explain -- a replica landing a 3x4 garbage shape
at row 3 where the server placed it at row 7, with byte-identical boards -- is
therefore NOT a rotation bug. The untested primitive that would explain it is
the multi-cell **descent collision** test: park a shape above terrain, descend
until it stops, and compare the resting row. That probe does not exist yet.

## Running

Needs JDK 8 — the classes are class-file version 50 and `client` extends
`java.applet.Applet`, which modern JDKs no longer ship.

```sh
J8=/usr/lib/jvm/java-8-openjdk
$J8/bin/javac -nowarn -cp ../../dekobloko.jar -d . ParityProbe.java

# labelled spot checks
$J8/bin/java -cp .:../../dekobloko.jar ParityProbe

# exhaustive golden table -> tests/fixtures/golden-active-piece.tsv
$J8/bin/java -cp .:../../dekobloko.jar ParityProbe sweep

# anything that ROTATES needs stub/ FIRST on the classpath, so the no-op ge
# shadows the real one -- lk.t redraws through ge.a and dies on the missing
# sprite otherwise. The failure surfaces as `jb` wrapping an NPE in lk.t,
# which looks like a probe bug rather than a missing stub.
$J8/bin/java -cp stub:.:../../dekobloko.jar ParityProbe rotate
$J8/bin/java -cp stub:.:../../dekobloko.jar ParityProbe rotsweep
```

## Sweep coverage

`_shape_from_positions` takes the tight bounding box of whatever cells a clear
removed, so the shape space is wider than the observed 2x2 / 3x2 blobs:

* the box runs to the bucket width and the board height — a drill clears a
  whole column, giving `1 x 18` (small) or `1 x 27` (large);
* the cells need **not** be 4-connected. A bomb unit is a loose component
  unioned with every touching solid's full extent (`_bomb`), and at feedback
  level >= 2 a match is unioned with whole solids (`_resolve_matches_once`).
  Either can leave disjoint islands inside one shape.

The sweep therefore covers three bands, for both bucket sizes:

1. exhaustive over every tight bitmap in a 4x4 box, connected **and**
   disconnected;
2. the degenerate full-row and full-column strips out to the real board
   bounds;
3. a deterministic (fixed-seed) sample of larger boxes, half of them forced to
   be disconnected.

Total: 120,354 rows, up to 12x27.

An invariant worth asserting separately: no row has both parities non-zero.
Every row is `(0,0)`, `(±1,0)` or `(0,±1)`.

## What the table already establishes

* Spawn position generalizes exactly as the server already computes it:
  `x = (bucket_width - piece_width) >> 1` and `y = -piece_height + 1`.
* `drop = 2` and `forced_drop = 80 + base_drop * bucket_height` are unchanged
  for non-domino shapes.
* Parity is never set on both axes at once, across all 120,354 rows. Shapes
  whose width and height share a parity are always `(0,0)`; the rest are
  decided by the centroid test at `lk.java:1691`.
* The 2x1 domino rows agree with the current `ActiveDomino`, which makes the
  existing behaviour the control for the whole sweep.
* The install depends on **occupancy only, not cell value**. `ParityProbe
  cellvalue` replays fixed bitmaps across the whole 5-bit vocabulary (ordinary
  colours, wildcard, and every powerup) and reports 0 mismatches, so the table
  is valid for powerup-bearing shapes even though it was generated with cell
  24 (which is `EARTHQUAKE_CELL`).
