# Dekobloko game-logic library

A zero-dependency Java 8 extraction of Dekobloko's deterministic bucket rules.
It replaces obfuscated client names with a small API that is independent of
AWT, rendering, audio, networking, and global client state.

## Build and test

```sh
./game-logic/build.sh
```

This produces `game-logic/build/dekobloko-game-logic.jar` and runs the focused
executable test suite. When `classes-original/` is present, it also loads the
untouched `mn.b` and `pn.eb` arrays reflectively and differentially verifies
the extracted speed tables against the original bytecode. It then runs a
state-level match differential against the untouched original `lk` board
implementation for four named fixtures and 200 deterministic generated
initial states. Advanced fixtures additionally exercise two- and three-wave
chains, wildcard matching, uneven-tower falling, Drill/Bomb/Power Drill
feedback, hollow cooked-shape Water conversion, and Earthquake settling.

The state harness uses an isolated class loader. The real board class comes
only from `classes-original/`; child-first replacements for the Applet client,
audio dispatcher, sound resources, and audio-channel table come from
`src/original-stubs/java`. Any attempt by this logic path to load AWT or Swing
fails the test. The original routines are selected by their descriptors rather
than their obfuscated method names.

For every initial state the harness compares:

- match group color and size from the original connected-component routine;
- every cell selected by the original enclosing resolver;
- every unmatched cell's position and color after the update.

The advanced differential also verifies:

- final cells and the original maximum chain counter for two- and three-wave
  cascades;
- wildcard completion and rejection, two wildcards in one match, one wildcard
  shared by two colors, and the resulting feedback geometries;
- horizontal two-color placement over uneven towers, including the unsupported
  half falling into a four-cell match while the supported half stays high;
- an ordinary four-cell pop touching a 50-cell solid at all four raw feedback
  strengths: raw 0 returns nothing, raw 1 returns the four loose cells, and raw
  2 and 3 each return one identical combined 54-cell shape;
- the Drill's identical removed path and unaffected cells at Levels 2 and 3,
  with no returned shapes at Level 2 and three independent `1 x 1` shapes at
  Level 3;
- Bomb and Power Drill source removal plus their exact whole-shape feedback
  geometry at Level 3, including loose/same-color-solid grouping;
- Water Capsule conversion of a cooked ring with an internal hole, including
  per-column falling and the resulting eight-cell loose match;
- a 23-cell tall-tower Earthquake against every original resolver tick, plus
  24 deterministic generated sparse-tower final states.

The original resolver represents a newly selected cell as the transient packed
state `48 + color`; the extracted library removes it immediately. The ordinary
match harness normalizes only that known first removal-animation state. Its
generated fixtures contain ordinary loose cells in gravity-stable columns
with feedback disabled. The focused advanced fixtures cover later chain
updates, wildcard feedback, real feedback queues for destructive items, solid
shape destruction, and the Earthquake movement-animation state machine.
Scoring and other special-item feedback remain outside the original-code
differential. Active-piece behavior is covered separately below.

The build also runs `OriginalMultiplayerProtocolTest`. It decodes synthetic
full-board multiplayer states with the untouched original `lk` engine, then
feeds the same relayed controls to both `lk` and the extracted `ActiveDomino`.
After every tick it compares bitmap geometry, position, rotation parity,
gravity and lock counters, held/repeated input, and grounded/landed state. It
then finalizes the piece and compares every settled cell. Separate fixtures
cover a normal lock, a recoverable above-top overflow, and a final-life
overflow. This verifies the
renderer-free board-replica protocol described in
[`docs/multiplayer-gameplay-protocol.md`](../docs/multiplayer-gameplay-protocol.md).
It also invokes the original cooked-feedback builder for a hollow ring and
verifies that the resulting `rf` bitmap preserves its dimensions, zero-valued
hole, and `8 | color` occupied cells.

## Public surface

- `Board`, `Tile`, `Material`, `Position`, and `Shape`: bucket state and
  arbitrary solid geometry.
- `Domino`: the normal two-cell `2 x 1` / `1 x 2` falling shape.
- `ActiveDomino` and `PieceLockResult`: exact per-tick movement, rotations and
  wall correction, held-key repeat, gravity/Down acceleration, the 20-tick
  lock delay, placement, and above-top life loss.
- `AuthoritativeMultiplayerMatch`: 2-8 immutable player slots, one server-owned
  board/active piece per slot, three lives, post-lock match cascades, stable
  tombstones, and server-derived win/draw state.
- `MatchRules`: four-cell connected matching, wildcard participation,
  same-color solid clearing, and Levels 1-2 feedback.
- `SpecialItemRules`: earthquake, Drill, Bomb, Power Drill, Water Capsule,
  Poison, and Level 3 feedback effects.
- `MasterChallengeRules`: the eight themes' colors, item levels, feedback, and
  speed.
- `Achievement` and `AchievementRules`: original IDs and pure trigger
  predicates for renderer-independent single-player and Master Challenge
  achievements.
- `SpeedLevel`, `SpeedRules`, `DropTiming`, and `DropTimer`: configurable,
  Master Challenge, and Stamina speed tables plus per-piece automatic descent
  and the forced-fast-drop deadline.
- `Controls`: the original renderer-independent board input mask.

All mutation is explicit on a `Board`. Resolution methods return value objects
describing matches, removed cells, and shapes queued by feedback, allowing a
caller to serialize state or compare executions without depending on pixels.

## Speed model

The original client uses logic ticks:

- configurable speed intervals: Slow 40, Medium 30, Fast 24, Maximum 19,
  Panic 15;
- Master Challenge intervals by theme: 40, 30, 24, 19, 15, 12, 9, 6;
- Stamina intervals by zero-based stage: 40, 33, 27, 22, 18, 15, 12, 10, 8,
  7, 6, 5, 4, 3, 2, 1, 0.

A new shape's anti-stall deadline is `80 + speedTicks * bucketHeight`. Expiry
uses the same acceleration path as Down and clamps a slower descent countdown
to two ticks. `DropTiming` exposes these exact calculations without assuming a
wall-clock scheduler frequency.

`DropTimer.tick` advances those clocks once and reports when the caller must
attempt a one-row descent. After a successful move, the caller invokes
`descentSucceeded`; a zero-tick late-game speed remains immediately due, so a
host can continue stepping until collision just as the original loop does.

## Provenance and current boundary

This is a named semantic extraction, not copied decompiler output. Constants
and behavior were traced from the original `lc`, `lk`, `qc`, `qd`, `nk`, `mn`,
and `pn` classes. See
[`docs/single-player-master-challenge-gameplay.md`](../docs/single-player-master-challenge-gameplay.md)
for the evidence map and mode distinctions.

The library now includes the deterministic active-piece and multiplayer winner
boundary. It does not yet reproduce scoring itself, simultaneous-match item
awards, frame-by-frame chain timing, theme transitions triggered by score, the
original random piece generator, or multiplayer feedback-recipient selection.
`AuthoritativeMultiplayerMatch.finalizeLanded` resolves ordinary match cascades
immediately and exposes their `Resolution` objects; a network host is still
responsible for serializing their returned shapes and scheduling presentation
ticks. Special-item path selection and item
activation are explicit API calls; the client/UI decides when and where an
earned item fires. Achievement score/shape counters are inputs to pure trigger
predicates; the surrounding client remains responsible for persistence and UI.
Wildcard destruction by a Power Drill is removed correctly,
but it is not emitted as a Level 3 returned `Shape` until the original client's
wildcard-to-solid color rule is verified.

## Server ownership and winner detection

The multiplayer protocol contains no client-to-server board or result packet.
The server creates one `AuthoritativeMultiplayerMatch`, feeds each decoded C2S
60 control mask to the addressed stable slot, and calls `finalizeLanded` exactly
once when `applyControls` reports a lock boundary. The returned x/y/orientation
are the correction for S2C 64. Returned cascade shapes are inputs to S2C 67.

Each slot begins with three lives, matching original `lk.field_jb`. A piece
whose bitmap top is above row zero consumes one life. The slot is tombstoned
only when the third life is consumed (or when it resigns/disconnects). At that
point `outcome()` and `winnerSlot()` are derived solely from the remaining
server-owned slots. A client never tells the server that it won.

The experimental Python server now contains the matching port in
`apps/server/dekobloko_server/engine.py`. `HostedGame` feeds it validated C2S 60
masks, waits for the correct C2S 59 transition acknowledgement, emits
authoritative S2C 64 correction coordinates, decrements lives, tombstones the
defeated stable slot, and sends S2C 62/69 from the last-survivor result.
It also generates and activates enabled special items, sends cooked feedback to
the next live opponent round-robin, applies incoming solid shapes to the target
engine, rate-limits control ticks by elapsed time, and emits S2C 61 snapshots on
divergence, explicit resync, and a proactive interval. These scheduling values
are documented Python-server policy; the Java library stays deterministic and
policy-free.
