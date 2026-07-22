# Single-player and Master Challenge gameplay audit

This note records the rules recovered from the original Dekobloko client,
with particular attention to Master Challenge. It also separates rules that
apply locally in single-player from similarly named multiplayer feedback
rules. The source is obfuscated, so field names below are identified by how
they are configured, rendered, and consumed rather than by their generated
names alone.

The local decompilation used for the audit is under
`.work/games/dekobloko/decompile-owned/java/`. The corresponding original
classes are in `classes-original/` and `dekobloko.jar`.

## Terminology

- **Loose piece/tile**: an ordinary independently falling or settled colored
  cell.
- **Falling shape**: the normal two-cell piece. The client constructs it as a
  `2 x 1` cell array; rotation can make it `1 x 2`.
- **Solid shape**: a multi-cell object made by "cooking" eliminated loose
  pieces. The game and its help text call these shapes *solid*, not frozen.
- **Bucket**: the stationary playfield. Left and right move the active falling
  shape within the bucket; they do not move the bucket itself.
- **Feedback level**: controls which eliminated material is converted to solid
  shapes and queued again. In multiplayer the queue belongs to the next
  player. In Master Challenge it feeds the player's own bucket.

## Core matching rule

A normal match is a connected component of at least four orthogonally touching
loose pieces of the same color. A wildcard may substitute for a colored loose
piece. The component search walks the four cardinal neighbors and the main
board scan calls it with a threshold of `4` (`lk.java`, around line 3065).
A wildcard can participate in two differently colored matches during the same
resolution; each match retains its own color and feedback geometry while the
shared wildcard is removed only once from the source bucket. Wildcards do not
reduce the four-cell threshold, and multiple adjacent wildcards can substitute
within one color's component.

The normal falling-shape factory creates exactly two cells with width `2` and
height `1` (`lc.b`, around lines 18-26). This supports the useful shorthand
"pieces are dominoes," but it is not true of every object in a bucket: returned
solid shapes may have arbitrary dimensions and occupied-cell geometry.

When loose pieces are cooked into a solid shape, `lk` finds the matched
component's bounds, allocates a rectangular cell map, and copies only the
occupied cells into it (`lk.a(lk, oi, int, int, int)`, around lines 5826-6055).
Thus the solid object preserves the matched geometry, including empty cells
inside its bounding box.

After a horizontal two-color piece locks across uneven tower heights, its cells
are resolved as loose cells independently. The half supported by the taller
tower stays at its placed height while the unsupported half falls until it
reaches the shorter tower. If that falling cell completes a four-cell color
component, the lower match pops and the supported other color remains on the
higher tower.

## Master Challenge progression

Master Challenge has eight themes. At each transition, `qc` computes:

- feedback level: `themeIndex / 2`;
- number of colors: `min(3 + themeIndex, 7)`;
- special-item level: `min(themeIndex, 4)`.

`themeIndex` is zero-based. In player-facing terms the progression is:

| Theme | Colors | Special-item level | Feedback | Base drop ticks |
|---:|---:|---|---|---:|
| 1 | 3 | None | Level 1 (off; raw 0) | 40 |
| 2 | 4 | Wildcards | Level 1 (off; raw 0) | 30 |
| 3 | 5 | Wildcards, earthquakes, drills | Level 2 (loose; raw 1) | 24 |
| 4 | 6 | Adds bombs and Power Drills | Level 2 (loose; raw 1) | 19 |
| 5 | 7 | All special items | Level 2 (whole solids; raw 2) | 15 |
| 6 | 7 | All special items | Level 2 (whole solids; raw 2) | 12 |
| 7 | 7 | All special items | Level 3 (special destruction; raw 3) | 9 |
| 8 | 7 | All special items | Level 3 (special destruction; raw 3) | 6 |

The transition assignments are in `qc.java`, around lines 1456-1520. The
player-facing strategy messages in `jj.field_d` corroborate the sequence:
ordinary clearing, wildcards, controlling solid shapes, special items, larger
returning solids, preparing for danger, special items ceasing to save the
player, and the final theme.

Master Challenge presents three broad feedback phases, backed by four raw
strength values:

1. Level 1, Themes 1-2 / raw 0: no feedback.
2. Level 2, Themes 3-4 / raw 1: eliminated loose components are cooked and
   queued again. Themes 5-6 remain in the broad Level 2 phase but advance to
   raw 2, which also queues eliminated whole solids. When a loose match removes
   a directly touching same-color solid, their occupied cells form one combined
   returned shape.
3. Level 3, Themes 7-8 / raw 3: raw 2 behavior plus material destroyed by
   special items.

The multiplayer options in `qd.field_Pb` name raw strengths 1, 2, and 3 as
Levels 1, 2, and 3. That numbering is not the same as the broader Challenge
phase terminology above.

In Master Challenge, "queued again" means returned to the same player's
bucket. The tutorial explicitly says matched shapes "come back as solid
shapes." The wording "sent to the next player" belongs to the multiplayer
description of the same feedback levels (`qd.field_Pb`). This distinction is
important: describing Master Challenge matches as attacks being sent to a
bucket conflates the two modes.

Feedback is off for Themes 1 and 2. Therefore it is not generally true that
every four-piece match in Master Challenge immediately comes back as a solid
shape; loose-match feedback starts at Theme 3, while previously cooked solids
join the returned geometry at Theme 5.

## Speed, gravity, and the forced-drop timer

Speed is a rule level, not just a rendering or animation setting. `lk.field_g`
holds the selected base drop interval in logic ticks. `lk.a(int, int, boolean)`
loads it from one of two static tables, and spawning an active shape initializes
the normal drop countdown from it (clamped to a minimum of two ticks).

The five configurable labels use the first five values of the standard table:

| Setting | Base drop ticks |
|---|---:|
| Slow | 40 |
| Medium | 30 |
| Fast | 24 |
| Maximum | 19 |
| Panic! | 15 |

Master Challenge advances farther through that table, as shown above. The
complete standard table in `mn.field_b` is
`40, 30, 24, 19, 15, 12, 9, 6, 4, 2, 0`. Stamina uses a separate, finer
17-stage table in `pn.field_eb`:
`40, 33, 27, 22, 18, 15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0`.

Each newly spawned shape also receives a separate anti-stall deadline:

```text
forcedDropTicks = 80 + baseDropTicks * bucketHeight
```

The deadline is initialized in the spawn path (`lk.java`, around lines
1848-1865) and computed by `lk.l` (around lines 516-519). `lk.d` decrements it
once per input/logic update. Once it expires, the board enters the same
acceleration path as a held Down key, reducing a slower drop countdown to two
ticks. Consequently there are two related timing rules:

1. the selected speed controls ordinary automatic descent;
2. the per-piece deadline prevents indefinite stalling and eventually forces
   fast descent even without Down being held.

Down can invoke that acceleration before the deadline and may award fast-drop
bonus points. The values above are logic ticks; this audit does not assume a
wall-clock tick rate because that belongs to the surrounding client scheduler.
The extracted library exposes the arithmetic through `DropTiming` and the
mutable per-piece countdown through `DropTimer`.

## Special items

The authoritative in-game descriptions are stored in `nk.field_d`:

| Item | Actual behavior |
|---|---|
| Earthquake | Collapses stacks of loose pieces. |
| Drill | Individually pops every piece in its path. |
| Bomb | When a shape touching the bomb is popped, destroys everything in the bucket of that same color. |
| Power Drill | Pops every entire loose or solid shape in its path; loose shapes take touching solid shapes with them. |
| Water Capsule | Turns every solid shape in the bucket into loose pieces. |
| Poison | Turns all loose pieces in the bucket into solid shapes. |
| Wildcard | Substitutes for another loose-piece color. |

The item sometimes called a "mega drill" is named **Power Drill** by the game.
There is likewise no item named **Whirlpool** in the original item table. The
water-based effect is **Water Capsule**.

Earthquake is more specific than a vertical gravity pass. Once activated, the
original board scans from the bottom row upward and from right to left within
each row. Each loose cell first falls into an empty cell below. If supported,
it tries to slide in the current shake direction, then the opposite direction;
a slide requires both the adjacent cell and the diagonal cell below it to be
empty. The shake direction reverses after every update that moves or animates
at least one cell. A moving packed cell remains eligible to fall or slide on
the next update. Only a blocked moving cell advances through the thirteen
remaining animation states before becoming stationary. These details are why
a vertical-only collapse produces the wrong shape for tall sparse towers.

A Drill does not intrinsically "send 1 x 1 pieces." It destroys cells one at a
time. Under feedback Level 3, the individually destroyed cells are eligible to
return/send, which explains the observed one-cell solid results. Likewise, a
Power Drill operates on complete shapes. When it intersects a loose component,
directly touching same-color solid shapes join that component in one returned
geometry; directly intersected solid components return as whole shapes.

"Bombs send all" is also too broad. A bomb destroys all material of the
triggering color, not every color in the bucket. Sending/returning that
destroyed material additionally requires feedback Level 3. At that level a
loose component and directly touching same-color solid shapes are returned as
one combined geometry, rather than as separate queue entries.

Water Capsule changes only occupied solid cells into loose cells; empty cells
inside a cooked shape's rectangular bounds remain empty. In the checked hollow
`3 x 3` ring, the two cells in the hole's column compact independently from the
three cells in each outer column. The resulting eight loose cells are still one
same-color component, so the normal resolver immediately pops all eight. This
Water-plus-resolution sequence matches the original board exactly.

## Achievement triggers

The local controller evaluates these renderer-independent gameplay triggers
after resolving an update. The numbers are the original achievement IDs:

| ID | Trigger |
|---:|---|
| 0 | Form a Deko and a Bloko in the same update. |
| 1, 2, 3 | A wildcard participates in at least 2, 3, or 7 simultaneous shapes. |
| 4, 5 | Double- or triple-eliminate solid shapes in one update. |
| 6, 7 | Reach a chain length of 5 or 10. |
| 8 | Form a solid shape as tall as the bucket. |
| 12, 13, 14 | Unlock Master Challenge Theme 5, 7, or 8. |
| 15, 16, 17 | Reach 50,000, 100,000, or 200,000 Master Challenge points. |
| 23 | Reach 50,000 points while still in the first two themes. |

Thresholds are cumulative: for example, a chain of 10 satisfies both chain
achievements and 200,000 points satisfies all three score achievements. The
extracted `AchievementRules` takes already-computed counters and flags; account
persistence, notifications, and multiplayer-only achievements IDs 9–11 and
18–30 remain client/session responsibilities.

## Headless differential evidence

The extracted `game-logic` library is checked against the untouched original
`lk` board class under presentation-only stubs; loading AWT or Swing is
rejected. Methods are located by descriptors instead of obfuscated method
names. The current focused fixtures establish the following:

- two-wave and three-wave cascades produce the same final colored cells and
  reach original chain counters `2` and `3`;
- wildcard fixtures cover match completion, threshold rejection, two
  wildcards in one component, one wildcard shared by two colors, and the two
  returned feedback shapes;
- two uneven-tower fixtures verify independent post-lock falling, both with and
  without the falling half completing a match;
- an ordinary four-cell match touching a 50-cell same-color solid removes all
  54 cells at every raw strength; raw 0 queues nothing, raw 1 queues only the
  four loose cells, and raw 2 and raw 3 each queue the same combined 54-cell
  geometry;
- a Drill crossing three cells removes the same path and leaves the same
  off-path cells at Levels 2 and 3, but queues nothing at Level 2 and queues
  three independent `1 x 1` feedback shapes at Level 3;
- Bomb and Power Drill fixtures remove the same source material and queue the
  same Level 3 shape geometry, including loose/same-color-solid combinations;
- a hollow cooked ring retains its empty center during Water Capsule
  conversion, compacts by occupied cells only, and then produces the same
  eight-cell match as the original;
- a 23-cell bucket with sparse towers matches every original Earthquake update
  until settled, including packed animation values and shake direction;
- 24 additional deterministic, match-free sparse-tower buckets settle to the
  same colored cell positions.

The Earthquake trace exposed an important implementation detail: transient
movement values do not impose a cooldown while a cell can still move. They
animate only after becoming blocked. The earlier cooldown model happened to
match one final arrangement but failed generated towers, so it was replaced by
the verified state machine above. Generated Earthquakes that create a normal
match are excluded here because their cascade path is covered separately.

## Controls

The AWT key map and `qc` input collector produce this board-control mask:

| Input | Mask | Behavior |
|---|---:|---|
| Left arrow | `1` | Move active shape left. |
| Right arrow | `2` | Move active shape right. |
| Z | `4` | Rotate 90 degrees in one direction. |
| X, Up arrow, or Space | `8` | Rotate 90 degrees in the other direction. |
| Down arrow | `16` | Accelerate descent/fast drop. |

`qc.java`, around lines 1060-1110, assembles this mask. `lk.d`, around lines
1214-1390, consumes it, including held-key repeat for horizontal movement and
edge-triggered rotations. Because the normal active shape is a two-cell
domino, each rotation exchanges its `2 x 1` and `1 x 2` orientations.

Down is best described as fast or soft drop rather than an unconditional hard
drop. The game's tip text says that dropping quickly with Down awards
"fast drop" bonus points (`jg.field_k`).

## Claim-by-claim audit

| Claim | Finding |
|---|---|
| There are 4-7 colors. | Incomplete: Master Challenge begins at 3 colors, then uses 4, 5, 6, and 7. Configurable games also expose 3-7. |
| Pieces are always two cells / `2 x 1`. | Correct for normal falling shapes, which can rotate to `1 x 2`; incorrect for arbitrary returned solid shapes. |
| Four or more matching pieces pop. | Correct for orthogonally connected loose pieces of one color, with wildcard substitution. |
| Matches are sent frozen to a bucket. | Mixed terminology and modes: the objects are solid/cooked; Master Challenge returns them locally from Theme 3, while multiplayer sends them to the next player. |
| Drills send pieces in `1 x 1` form. | A consequence possible under Level 3 feedback, not the base Drill rule. The Drill individually pops cells in its path. |
| Mega drills send entire shapes. | Substantively correct; the official name is Power Drill, and it pops complete shapes in its path. |
| Bombs send all. | Incorrect without qualification: bombs destroy all pieces of one color, and feedback Level 3 determines whether the result returns/is sent. |
| Up rotates 90 degrees. | Correct. Up shares one rotation direction with X/Space; Z provides the opposite direction. |
| Down pulls pieces down faster. | Correct. It is the fast-drop input and can award bonus points. |
| Left/right move with the bucket. | The active falling shape moves inside a stationary bucket. |

## Source landmarks

- `lc.b(int, int, int)`: normal two-cell falling-shape construction.
- `qc.b(int, boolean)`: input collection and Master Challenge transitions.
- `lk.d(int, int)`: movement, rotation, and fast-drop input handling.
- `lk.l(int)`: per-piece forced-fast-drop deadline calculation.
- `lk.a(int, int, boolean)`: selection of the standard/Master Challenge or
  Stamina speed table.
- `lk.a(boolean, int, int, lk, boolean, int, int, int, oi, boolean, byte)`:
  connected-component matching and feedback eligibility.
- `lk.a(lk, oi, int, int, int)`: solid-shape construction from eliminated
  cells.
- `qd.field_Pb`: configurable color, special-item, and multiplayer feedback
  labels.
- `nk.field_d`: in-game special-item names and descriptions.
- `rk.field_O` and `rk.field_N`: tutorial matching and solid-shape text.
- `jj.field_d`: eight Master Challenge strategy messages.
- `jg.field_k`: rotation and fast-drop tips.
- `mn.field_b` and `pn.field_eb`: speed progression tables.
- `qc`'s post-resolution achievement checks: gameplay IDs 0–8, Master
  Challenge IDs 12–17 and 23.
