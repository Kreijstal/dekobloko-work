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

# End-of-game banner oracle (`WinBannerProbe`)

`WinBannerProbe.java` measures which end-of-game banner the original client
picks, by executing the real selector. It exists because the winner kept
landing on the "PANIC!" screen and the reason was assumed to be a result-code
vocabulary that nobody had ever driven.

## What it drives

Exactly what `client.i(byte)` does for **server opcode 70**, at bytecode
offsets 4068-4082:

```
qc.field_g.a(<signed byte off the wire>, (byte) -70);   // eb.a(IB)V
qc.a(100);                                              // qc.a(I)V
```

`eb.a(int,byte)` is the only writer of `eb.field_e`; `qc.a(int)` then compares
`field_g.field_e` against `field_P` (the local slot) and pushes
`new in(text, id, false)`.

`stub-ui/in.java` shadows `in`, whose real constructor lays the banner out with
`in.field_n` (an `lm` font) and therefore needs the whole graphics stack. The
stub records the constructor arguments instead. That is the only stub — `qc`,
`eb`, `vj`, `cm` and every string holder come from `dekobloko.jar`. Put
`stub-ui` **first** on the classpath.

## Measured result

Local player in slot 1 of 4, roster `[ALPHA, BRAVO, CHARLIE, DELTA]`, all 256
wire bytes executed:

| wire byte | signed | banner id | text |
|---|---|---|---|
| 0 | 0 | 11 | `ALPHA WINS!` |
| 1 | 1 | **10** | **`YOU WIN!`** |
| 2 | 2 | 11 | `CHARLIE WINS!` |
| 3 | 3 | 11 | `DELTA WINS!` |
| 4..127 | 4..127 | — | `ArrayIndexOutOfBoundsException` in `qc.a` |

| 128..255 | -128..-1 | 9 | `DRAW!` |

Repeating with the local player in slot 0 moves `YOU WIN!` to byte 0. So the
opcode-70 payload is the **winner's player slot**, read as a *signed* byte
(`wl.g(byte)` ends in `baload`), not a result code:

* `byte == qc.field_P` → `YOU WIN!`
* `0 <= byte < roster length`, other slot → `<NAME> WINS!`
* `byte < 0` → `DRAW!`
* `byte >= roster length` → the client throws; do not send one

The upper bound is the length of `eb.field_q` (the name roster the game-start
packet supplied), not `eb.field_b` — `qc.a(int)` indexes the roster without
checking anything. The probe ran with the two equal.

## What this settles about opcodes 68 and 69

They are **in-game banners, not results**. Both write an *unsigned* byte
(`uf.d(B)I`) into `qc.field_T` and raise a banner:

| opcode | offset in `client.i` | banner | side effect |
|---|---|---|---|
| 68 | 3803-3835 | `eb.field_c` = `SPEED UP!` (id 12) | — |
| 69 | 3859-3896 | `bn.field_c` = `PANIC!` (id 8) | sets `qc.field_r = true` |

`qc.field_T` is the speed/tempo level and `qc.field_r` the panic flag. The only
consumer of both is `qc.b(boolean)`, which returns
`256 + var2 * (field_T - var3) + (field_r ? 64 : 0)` via `mb.a`, and that value
is handed to `ob.a(int, ui, byte)` — a **music playback rate**, alongside track
sets `ee.field_a` / `sb.field_u[level]` (`ui[]`, played by `wj.field_Ob`).

The earlier `field_T == 10` reading (qc.java:5063, 5511, 2892) is therefore
about music selection, not about any screen or text. It never had anything to
do with the winner.

## Running

```sh
J8=/usr/lib/jvm/java-8-openjdk
$J8/bin/javac -nowarn -cp ../../dekobloko.jar -d stub-ui stub-ui/in.java
$J8/bin/javac -nowarn -cp ../../dekobloko.jar -d . WinBannerProbe.java
$J8/bin/java -cp stub-ui:.:../../dekobloko.jar WinBannerProbe
```

# Running (`ParityProbe`)

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

# Colour-clear oracle (`ClearProbe`)

`ClearProbe.java` measures which cells the original client clears, and where
the survivors end up, by executing the real board tick. It exists because the
Python engine's clear rule disagreed with the client mid-match, and the
detection pass is a 900-line obfuscated CFG state machine that nobody should
be reading for behaviour.

## What it drives

Two entry points into the unmodified jar, both on an `lk` allocated with
`Unsafe.allocateInstance`:

* **detection only** -- the seed loop of `lk.a(oi,int,boolean,lk)` states
  106-122, verbatim:

  ```
  for (i = 0; i < width * height; i++)
      lk.SA(true, 2, 4, null, true, -1, i, 1, null, false, 71);
  ```

  then the commit, `lk.a(-99, false, 1)`. The probe reports the group each
  seed produced, plus the raw tag bits (28-30) and visited flag (bit 31), so
  the group decomposition is observed rather than inferred.

* **the whole tick** -- `lk.a(null, 127, false, null)` in a loop until the
  board stops changing, starting from `field_ib = 0`. Production calls it as
  `lk.a(field_db, 125, false, lk)` (qc.java:1016), so the flags match; 127 and
  125 are both above the `param1 > 124` gate.

`field_ib` is the phase selector: 1 = the pop animation (states 4-16), 0 =
gravity (states 19-101), 2 = look for matches (states 102-144). A freshly
spawned piece leaves 0 behind (state 307), so **gravity runs before the first
detection**. Starting the probe at 2 instead measures matches between cells
that are still in mid-air, which never happens in a real match -- that mistake
produced 111 phantom mismatches before it was spotted.

## Stubs

`stub/ai.java` joins `stub/ge.java`: the chain sound on the second and later
clear waves goes through `ai.a(62, level, jm.field_v[slot], ...)` and dies
without an audio bank. The fall sound at state 90 (`ei.c`) cannot be stubbed as
cheaply -- `ei extends ol`, which is abstract with five abstract methods -- so
`settle` catches exactly that one throwable and continues. It is raised after
the gravity pass has already written `field_P`, and the states it skips
(92-144 sound, 238-302 bomb/water/poison, all inert on a plain colour board)
touch neither `field_P` nor `field_ib`. Every board that took that path is
flagged with a leading `~`.

**Run everything with `-XX:-OmitStackTraceInFastThrow`.** After a few thousand
boards HotSpot recompiles that implicit NPE into a preallocated exception with
no stack trace, the "is this the sound failure?" test stops recognising it, and
the run turns into a flood of bogus mismatches halfway through.

## Measured rule

Detection, per wave:

* seeds run in index order, `x + width * y`, over the whole board; the group's
  colour is whatever the seed cell holds, so groups are found in board order,
  not colour order;
* a seed must be an unvisited settled cell in 16..22. The gate is
  `(cell & 0x8FFFFFFF) >> 3 == 2`, which also excludes wildcards (23 returns
  immediately when `param5 == -1`), powerups (24..31), solids (8..15), and any
  cell mid-animation (bit 5 or above set);
* the flood is **4-connected**, and a neighbour joins when
  `(cell & 0x8FFFFFFF)` equals the seed's value exactly, or equals 23;
* the minimum group size is **4** (`param2`);
* a group of 4 or more is tagged; the commit pass then rewrites every tagged
  cell to `32 | (cell & 0x0FFFFFFF)` and sets `field_ib = 1`;
* all groups found in one scan pop together;
* ordinary colours keep their visited flag for the rest of the scan, so each
  one belongs to exactly one group -- but **wildcards are unvisited after
  every seed**, so a single wildcard can be counted by two different groups.
  Measured: `8 2 aaah....hbbb....` tags all eight cells.

Gravity:

* a cell falls when `(cell & 24) == 16 || (cell & 24) == 24`, i.e. values
  16..31. Measured one at a time: floating 24, 26, 28, 29 and 30 all land on
  the floor exactly as a colour does, while a solid (8) stays in mid-air;
* it runs on every tick, **with or without a clear**. Measured: a five-cell
  column with one cell overhanging an empty column ends with the overhang on
  the floor, no match anywhere on the board;
* one row per tick, followed by a ~13-tick landing animation (the cell's value
  is bumped by 32 each tick until it reaches 448 and is masked back to
  `& 31`). A replica sampled mid-fall therefore still shows the cell up. That
  is the phase trap, not a physics difference, and reading it as one is what
  put the wrong rule into the engine in the first place.

## Differential result

`_find_matches` in `apps/server/dekobloko_server/engine.py` already agreed with
the client's detection: 1500 random colour/wildcard boards, one wave each, 0
mismatches. The full settle disagreed on 13 of the first 200 boards purely
because the engine collapsed only after a wave cleared. With the collapse moved
ahead of the first match test, 3800 boards over five seeds agree cell for cell.

`apps/server/tests/fixtures/golden-clear-settle.tsv` pins 160 of those boards,
replayed by `apps/server/tests/test_clear_rule.py`.

## Powerups (2026-07-26)

The colour fuzz above only ever generated `. a b c d h`, so **no powerup was
exercised even once** and the whole family sat unpinned behind a green suite.
Driving the same `settle` mode with powerups in the alphabet failed on 150 of
150 boards.

Which powerups act on their own, measured one at a time on a settled board:
only **25 (drill)** and **27 (power drill)**. Earthquake (24), bomb (26), water
(28), poison (29), 30 and 31 sit inert until something else triggers them.

Bombs, measured and found to already agree with the engine: a bomb removes the
matched colour **board-wide** (a distant unconnected cell of that colour dies,
other colours live), it needs adjacency to a real matched **group** (a bomb
resting on an isolated same-colour cell never fires), it fires once per
adjacent matched group, and the blast does **not** take wildcards.

Drills:

* they clear their own cell and everything **below** in the column. Cells
  ABOVE fall into the hole -- they are not destroyed. The engine cleared the
  whole column, which ate the rest of the piece whenever a drill settled as
  the bottom cell of a vertical triple;
* they fire whenever one comes to **rest**, not only when one is placed. A
  drill riding on a group that clears falls into the hole and fires there;
* order within a tick is gravity -> match -> drill. A drill sitting on a group
  that clears does not pre-empt the clear;
* a power drill additionally takes each passed cell's colour group with it,
  where a plain drill takes only its own column;
* a wildcard hit **directly** by a power drill is a joker: every adjacent
  colour goes, each taking its own group. A wildcard merely **absorbed** into
  a colour group does not extend it into a different colour. Re-measured,
  because this one data point decides the rule;
* every settled drill fires in **one pass with no collapse between shots**,
  bottom row first. Collapsing between shots drops a cell into a hole where a
  later drill's group then eats it; the client keeps it.

Residual: **10 mismatches in 900** drill-saturated boards (six seeds), down
from 100%. See "Not measured" -- the exact interleaving of several drills
firing in one pass is not fully pinned.

## Not measured

* the solid-expansion arm (`param4`) and the powerup triggers reached through
  `lk.b(int,int,boolean)`. A bomb next to a colour match **was** measured to
  fire, so that arm is live, but its exact reach was not mapped;
* the earthquake slide (`field_l != 0`, states 35-53). It shares the gravity
  gate in the decompiled source, so it probably falls for powerups too, but
  the engine's `earthquake()` was left alone rather than changed on a reading;
* **the ordering of several drills firing in one pass.** Bottom-row-first,
  left-to-right fits every case shrunk so far and leaves ~1% of
  drill-saturated boards disagreeing. Two shrunk repros pull in opposite
  directions on whether a lower-left or lower-right drill acts first, which
  suggests the real pass is not a simple positional scan. Anything that
  depends on multiple drills landing in one tick is still approximate;
* what a drill does to a **solid** (8..15) in its path -- solids need
  `solid_ids`, which the char-grid probe format cannot express;
* earthquake, water and poison reach. Only their *inertness* on a settled
  board was measured, not what they do when triggered.

## Running

```sh
cd tools/oracle
J8=/usr/lib/jvm/java-8-openjdk
$J8/bin/javac -nowarn -cp ../../dekobloko.jar -d stub stub/ai.java
$J8/bin/javac -nowarn -cp ../../dekobloko.jar -d . ClearProbe.java

F=-XX:-OmitStackTraceInFastThrow

# labelled detection spot checks
$J8/bin/java $F -cp stub:.:../../dekobloko.jar ClearProbe cases

# one board, seed by seed, with the tag/visited dump
$J8/bin/java $F -cp stub:.:../../dekobloko.jar ClearProbe detect "aah/haa"

# one board, tick by tick
$J8/bin/java $F -cp stub:.:../../dekobloko.jar ClearProbe tick "aaaa/bbbb/aaaa"

# streams: "<w> <h> <w*h cells>" per line
#   batch  -> the indices one detection wave tagged
#   settle -> the resting board, prefixed '=' clean or '~' sound muted
$J8/bin/java $F -cp stub:.:../../dekobloko.jar ClearProbe settle < boards.txt
```
