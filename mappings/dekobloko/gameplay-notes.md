# DekoBloko gameplay mapping notes

This file records the evidence for every entry in `gameplay.json`. The generated
Java under `games/dekobloko/` is the primary source. Names are deliberately
conservative: an encoded value or branch is left unnamed when the source proves
its mechanics but not a stable domain name.

## Methodology and scope

- JVM identities in the mapping always use the original owner, member name, and
  descriptor.
- Constructor assignments establish mode, option, roster, and ownership fields.
- Call sites in `client.java`, `pn.java`, and `ke.java` establish network,
  single-player, game-over, and rematch semantics.
- Mutation sites in `lk.java` establish bucket physics, piece queues, lives,
  cooked feedback, and powerup resolution.
- The Shattered Plans source tree was queried with `gh api` as a shared FunOrb
  cross-reference. It contains named common client, AWT, cache, graphics, I/O,
  and networking packages, but no DekoBloko gameplay package or matching
  DekoBloko owner annotations were found. No gameplay name below was copied from
  that project.
- Confidence is `high` unless explicitly stated otherwise.

## Class mappings

| JVM class | Semantic name | Evidence |
| --- | --- | --- |
| `eb` | `MatchState` | `qc` constructs one `eb` for every game. Its constructor creates one `lk` per player, retains player names, and initializes the remaining-player count. Protocol handling mutates its active-player mask, winner, game-over flag, elimination order, and rematch mask. |
| `lk` | `GameBucket` | The class owns the settled grid, active piece geometry and position, falling controls, lives, queue, match resolution, powerup effects, and bucket dimensions. Both single-player and multiplayer store one instance per player. |
| `oi` | `PieceRegistry` | The class maintains a hash table keyed by `rf.field_j`, can read a shape or reference from a packet, look it up, register it, remove it, and grows the table on collision pressure. |
| `pn` | `SinglePlayerLauncher` | `pn.a(ZZZ)V` clears the old game, constructs `qc` with multiplayer disabled and one implicit player, installs it in `kf.I`, and starts theme-zero music. |
| `qc` | `DekoBlokoGame` | This is the top-level game coordinator used by both modes. It owns `MatchState`, advances every bucket, consumes input, renders the game and results, and maintains multiplayer-only animation/protocol state. |
| `rf` | `PieceShape` | Instances carry a stable ID, width, height, and byte cell bitmap. They are created as ordinary two-cell pieces, decoded from multiplayer packets, built from popped cells for cooked feedback, queued, and spawned into a bucket. |

## Match-state fields (`eb`)

| JVM field | Semantic name | Evidence |
| --- | --- | --- |
| `eb.a:I` | `rematchOffersMask` | The end-game menu tests the local player's bit to choose offer/cancel/accept-rematch labels. Protocol message handling replaces the mask, and departing-player bits are removed from it. |
| `eb.b:I` | `playerCount` | Set to `1` without a name list or to `names.length`; sizes `playerBuckets`, player-indexed arrays, and all roster loops. |
| `eb.d:I` | `activePlayersMask` | A player-removal packet clears `1 << playerIndex`; the result screen counts its set bits and uses the local bit to distinguish active, defeated, or spectator state. |
| `eb.e:I` | `winnerPlayerIndex` | `finishGame` stores its argument here. `qc.a(I)V` compares it with `localPlayerIndex` and otherwise looks up `playerNames[winnerPlayerIndex]` to display the winner. |
| `eb.f:[I` | `eliminationOrder` | Multiplayer protocol appends player indices at `field_o`, and the result table iterates the populated portion in reverse placement order. |
| `eb.i:I` | `remainingPlayerCount` | Initialized to `playerCount` and decremented when a protocol removal nulls a player's bucket. It is also used to select late-game music/intensity. |
| `eb.j:Z` | `gameOver` | Set by `finishGame`; the main coordinator gates normal simulation and switches to completed-game behavior when true. |
| `eb.l:I` | `themeIndex` | Constructor parameter zero is retained here and directly indexes theme music, bucket art, colors, and tile sprites. Single-player changes it at stage transitions. |
| `eb.o:I` | `eliminatedPlayerCount` | Starts at zero and is incremented immediately after appending to `eliminationOrder`; it bounds result-table placement rows. |
| `eb.p:[Llk;` | `playerBuckets` | Allocated to `playerCount`, populated with one `lk` per player, indexed by every gameplay/protocol update, and nulled when a player is removed. |
| `eb.q:[Ljava/lang/String;` | `playerNames` | Assigned directly from the constructor name list and used by winner messages, HUD labels, and the result table. |

## Game coordinator fields (`qc` and `kf`)

| JVM field | Semantic name | Evidence |
| --- | --- | --- |
| `kf.I:Lqc;` | `activeGame` | Both single-player startup and the multiplayer-start packet install the newly constructed `qc` here; the client tick, input, protocol, menu, and teardown paths all read it as the live game. |
| `qc.P:I` | `localPlayerIndex` | Assigned from the constructor's player-index argument. Single-player passes zero; multiplayer may pass a slot or a negative spectator value. It selects the input bucket and drives local win/elimination comparisons. |
| `qc.g:Leb;` | `matchState` | Constructed once in the `qc` constructor and used as the authoritative player roster, bucket collection, theme, masks, winner, and game-over state. |
| `qc.m:Z` | `multiplayer` | Assigned from constructor parameter zero. Multiplayer startup passes `true`, single-player startup passes `false`, and the field gates network-only queues, remote bucket animation, multiplayer HUD, and local single-player progression. |
| `qc.ob:Z` | `localPlayerEliminated` | Set when the elimination protocol path applies to the local bucket. The game-over path uses it to prevent an eliminated local player from receiving the win outcome when no explicit winner index is present. |

## Bucket simulation fields (`lk`)

| JVM field | Semantic name | Evidence |
| --- | --- | --- |
| `lk.A:I` | `previousControls` | `tickActivePiece` computes newly pressed controls from the current mask against this field, then stores the current mask for the next tick. |
| `lk.Ab:I` | `forcedDropCountdown` | Decremented each active-piece tick and reset as a piece is installed; it participates in forced-drop timing independently of normal gravity. |
| `lk.C:I` | `activePieceWidth` | Loaded from `PieceShape.width`, used for bitmap bounds, collision checks, rotation, and rendering. |
| `lk.Cb:I` | `horizontalRepeatState` | Updated by left/right input and used to implement delayed/repeated horizontal movement rather than a fresh move every held-input tick. |
| `lk.L:I` | `activePieceY` | Updated by gravity and explicit placement, and used with `activePieceX` to collide and settle the active bitmap into the grid. |
| `lk.O:I` | `bucketWidth` | Set to 8 for standard buckets and 12 for large buckets; sizes and indexes the settled grid. |
| `lk.P:[I` | `settledCells` | Allocated as `bucketWidth * bucketHeight`; all matching, overhang gravity, powerups, collision, settling, serialization, and rendering read or mutate it. |
| `lk.Q:I` | `playerIndex` | `MatchState` assigns the array index immediately after constructing each bucket. It indexes per-player effects, audio, HUD state, and local ownership checks. |
| `lk.T:[I` | `activePieceCells` | Filled from `PieceShape.cells` during spawn and used by active-piece rotation, collision, rendering, and final settlement. |
| `lk.X:[Lrf;` | `pieceQueue` | Dynamically grown by `enqueuePiece`, consumed from the front by `dequeuePiece`, and inspected by the next-piece display and queue timing logic. |
| `lk.a:I` | `bucketHeight` | Set to 18 for standard buckets and 27 for large buckets; sizes the grid and bounds falling and overhang scans. |
| `lk.ab:I` | `activePieceOrientation` | Adjusted by clockwise/counter-clockwise controls and used to normalize spawn rotation and render orientation. |
| `lk.db:I` | `horizontalRotationParity` | Recomputed when a piece is installed or rotated and used in centering/collision calculations for rotated dimensions. |
| `lk.e:I` | `dropCountdown` | Decremented by falling ticks; fast drop clamps it, collision can replace it with a landing delay, and expiry advances or settles the piece. |
| `lk.g:I` | `baseDropCountdown` | Selected from the configured speed/stage table and copied back into `dropCountdown` after ordinary gravity steps. |
| `lk.jb:I` | `livesRemaining` | Initialized to three, serialized by multiplayer updates, decremented on overflow/life loss, tested for elimination, and forced to zero by the elimination packet. |
| `lk.kb:Z` | `localPlayerBucket` | Set only on `playerBuckets[localPlayerIndex]`; local input, sound, and feedback paths distinguish it from remote buckets with this flag. |
| `lk.o:I` | `verticalRotationParity` | Maintained alongside horizontal parity and used when rotated piece dimensions change vertical centering/collision offsets. |
| `lk.q:I` | `activePieceX` | Updated by left/right controls and used with `activePieceY` in collision, settlement, and rendering. |
| `lk.t:I` | `queuedPieceCount` | Incremented by `enqueuePiece`, decremented by `dequeuePiece`, and bounds all meaningful entries in `pieceQueue`. |
| `lk.y:Z` | `grounded` | Set after downward collision enters the landing phase and consulted on following ticks before settlement. |
| `lk.zb:I` | `activePieceHeight` | Loaded from `PieceShape.height`, swapped with width by rotation, and used for bitmap bounds, collision, and rendering. |

## Piece fields and registry (`rf` and `oi`)

| JVM field | Semantic name | Evidence |
| --- | --- | --- |
| `rf.b:I` | `width` | Serialized before the bitmap, multiplied by height to size `cells`, and copied to `GameBucket.activePieceWidth`. |
| `rf.c:[B` | `cells` | The serialized shape bitmap. Low bits carry color/type data; higher bits distinguish loose/cooked/special cell forms. |
| `rf.j:I` | `shapeId` | Set by the only constructor and used as the hash-table key in every `PieceRegistry` operation. |
| `rf.n:I` | `height` | Serialized with width, multiplied to size `cells`, and copied to `GameBucket.activePieceHeight`. |
| `oi.c:[Lrf;` | `pieceTable` | Private open-addressed/hash-slot storage indexed by `shapeId % length`; resized when a required insertion slot is occupied. |

`rf.field_l`, `rf.field_e`, and `rf.field_m` participate in queue-release
timing, consumer accounting, and generated-shape sequencing. Their exact
invariants cross multiple bucket and protocol paths, so they remain unmapped
instead of receiving plausible but unproven names.

## Method mappings

| JVM method | Semantic name | Evidence |
| --- | --- | --- |
| `eb.a(IB)V` | `finishGame` | Stores the winner index, sets `gameOver`, and terminates active bucket play. The game-over protocol calls it immediately before result presentation. |
| `lc.b(III)Lrf;` | `createDominoPiece` | Constructs a two-cell, width-two, height-one `PieceShape` and decodes the two packed tile values into its bitmap. |
| `lk.a(IILrf;)V` | `spawnPiece` | Copies shape dimensions and cells into active-piece fields, allocates rotation/animation buffers, computes centering offsets, increments the spawn sequence, and initializes falling state. |
| `lk.a(Llk;Loi;III)V` | `enqueueCookedFeedbackShape` | Computes the bounding rectangle of matched cell indices, creates or reuses a shape ID, copies the matched color/type into a new bitmap, and enqueues it on the target bucket. This is the cooked/solid shape-feedback production path. |
| `lk.a(Loi;IZLlk;)V` | `resolveBoardEffects` | The central post-settlement resolver. It finds matches, pops shapes, handles overhang motion, awards chains/items, executes encoded special-item effects, and optionally creates feedback for another bucket. |
| `lk.a(Lrf;B)V` | `enqueuePiece` | Grows `pieceQueue`, assigns the queue timing field, increments `queuedPieceCount`, and appends the shape. |
| `lk.d(II)V` | `tickActivePiece` | Consumes the five-bit control mask, handles edge-triggered rotation, horizontal repeat, fast drop, gravity, grounded delay, and active-piece movement. |
| `lk.p(I)Lrf;` | `dequeuePiece` | Returns the first queued shape, shifts remaining entries toward index zero, decrements `queuedPieceCount`, and advances the queue-consumption counter. |
| `oi.a(Lrf;B)V` | `removePiece` | Validates that the hash slot contains the supplied shape ID and clears that slot. |
| `oi.a(Lrf;I)V` | `registerPiece` | Expands the table until the shape's keyed slot is free, rejects conflicting duplicate IDs, then stores the shape. |
| `oi.a(ZI)Lrf;` | `findPiece` | Looks up a shape by integer ID and returns it only when the occupant's `shapeId` matches. |
| `oi.a(ZZLuf;)Lrf;` | `readPiece` | Reads a shape ID from the packet, resolves an existing referenced shape when possible, otherwise decodes width, height, and bitmap and registers the new shape when requested. |
| `pn.a(ZZZ)V` | `startSinglePlayer` | Tears down the previous game, constructs a non-multiplayer `DekoBlokoGame`, installs it as `activeGame`, resets stage counters, and starts music. |
| `qc.a(I)V` | `showGameOverResult` | Clears active-play presentation state and emits `YOU WIN`, no-winner, or named-winner result messages from `MatchState.winnerPlayerIndex`. |
| `qc.b(IZ)Z` | `tickGame` | The client calls this as the principal game update. It advances buckets and queues, processes local controls, handles single-player progression and multiplayer remote state, and returns a completion/update condition. |

## Powerups and encoded cells

The source proves the following effects inside
`GameBucket.resolveBoardEffects`, corroborated by the instruction strings and
effect assets:

- Earthquake collapses stacks of loose pieces.
- Drill pops individual cells along its path.
- Bomb removes cells of the matching color.
- Power drill removes entire loose or solid shapes in its path.
- Water capsule converts solid shapes to loose cells and then allows gravity.
- Poison converts loose cells to solid cells after the preceding overhang
  resolution phase.
- Wildcard participates in matches as any loose color.

These are branches over encoded cell values, not separate stable methods or
objects. The mapping therefore names the resolver and cell bitmap but does not
invent one method or field per powerup. A later constant-extraction pass should
introduce named tile masks and special-item IDs before individual branches are
renamed.

## Deliberately unresolved state

- `qc.field_r`, `qc.field_W`, `qc.field_wb`, and `qc.field_X` are mode/options
  booleans, but their call sites do not uniquely distinguish rated, tutorial,
  stamina, master, and UI-transition semantics.
- `eb.field_h` and `qc.field_yb` are player masks involved in result/rematch
  presentation, but the precise distinction from active, offered, accepted,
  departed, or ranked players is not yet proven.
- Several `lk` counters mix animation timing with authoritative queue timing.
  They should be named only after tracing one complete spawn, cooked-feedback,
  powerup-award, and dequeue cycle.
