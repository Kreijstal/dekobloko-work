# Dekobloko multiplayer gameplay protocol

This is the renderer-independent, in-match protocol used after the room flow.
It was reconstructed from the original client bytecode and checked by executing
the untouched original `lk` board engine headlessly. It supersedes the older
gameplay guesses in `multiplayer-protocol.md` and
`multiplayer-rooms-and-gameplay.md`.

## The central result: deterministic board replicas

The server does **not** stream pixels or every bucket on every frame. Every
client owns one `lk` engine instance per player and advances all of them:

1. The local board consumes local controls and gravity.
2. The client sends batches of the local board's 5-bit input masks to the
   server (C2S 60).
3. The server relays the batch to the other clients (S2C 63).
4. Each other client feeds exactly one mask per simulation tick into that
   player's local `lk` replica.
5. At a piece boundary, the server sends S2C 64. It corrects/finalizes the old
   active piece, selects speed, and spawns the next server-selected piece.
6. S2C 61 replaces a complete board only for initial/recovery resynchronization.
7. S2C 62 removes a defeated player by nulling their fixed board slot after all
   queued input/events for that board have been consumed.

The server therefore needs an authoritative copy of the same deterministic
engine. A relay-only server can animate remote boards, but it cannot reliably
decide lock boundaries, final placement, generated feedback shapes, defeat, or
repair divergent clients.

## Direction and trust boundary: the client sends actions, not its world model

The complete in-match C2S writer inventory is:

| C2S | Framing | Client contribution |
|---|---:|---|
| 58 | fixed 0 | Ready/start UI trigger. |
| 59 | fixed 1 | Last applied server transition counter. |
| 60 | `-1` | Per-tick 5-bit action masks. This is the only live gameplay input. |
| 61 | fixed 0 | Draw negotiation action. |
| 62 | fixed 0 | Resign. |
| 63 | fixed 0 | Rematch negotiation action. |

There is no client-to-server bucket, active-piece, match-result, or cooked-shape
upload. Two independent bytecode facts make this stronger than an opcode-table
inference:

- `lk` has one method accepting a network buffer: the S2C-61 full-state
  **decoder**. It has no board-state encoder or writer method.
- In the multiplayer branch of `qc`, a landed local board only flushes its
  buffered action masks. Unlike the single-player branch, it does not choose
  and apply its own next piece; it waits for the server's S2C-64 transition.

So the player informs the server of attempted actions, not of the resulting
world. The server must apply those actions to its own engine at the same logic
ticks. That authoritative result supplies S2C-64 final coordinates, cooked
feedback geometry, loss detection, and any S2C-61 recovery snapshot.

This does not prove how aggressively the historical server policed cheating.
The protocol permits useful validation: accept at most the elapsed number of
logic ticks, accept only the five defined control bits, and ignore actions after
the slot has landed or lost. Even if the original server was permissive, it
could not have trusted a client-uploaded bucket because no such message exists.

## Executable verification

`OriginalMultiplayerProtocolTest` constructs S2C-61 state payloads and passes
them to the untouched original `lk.a(boolean, wl, byte)` decoder. It steps both
original `lk.d(int,int)` and extracted `ActiveDomino.tick(int)` through the same
controls, comparing active cells, dimensions, position, rotation parity,
gravity/lock timers, forced-drop deadline, held/repeated input, grounded and
landed state after every tick. It then finalizes both and compares every bucket
cell. The fixtures cover an ordinary lock, recoverable overflow with lives
remaining, and terminal overflow on the last life. It runs with AWT/Swing
disabled and currently performs 1,427 assertions.

This proves the board-replica mechanism, full-state field order, active-piece
movement/rotation/gravity/lock behavior, placement, and life-loss boundary. It
does not prove server policy such as matchmaking, result-code text, feedback
recipient selection, item frequency, snapshot cadence, or rematch voting. The
Python server makes those unavailable historical choices explicit below.

`apps/server/tests/test_authoritative_engine.py` additionally runs the Python
port through the same control stream and compares every emitted tick state with
`PythonEngineTrace`, the Java engine trace already covered by that original-code
differential. Server integration tests cover initial and subsequent transition
acknowledgements, real S2C-64 correction fields, duplicate landing batches,
final-life stable-slot removal, winner notification, and teardown delivery.

Run it as part of:

```sh
./game-logic/build.sh
```

## Framing and common encodings

Only the opcode is ISAAC-enciphered. Payload bytes are plaintext. Multi-byte
integers are big-endian.

- fixed length `N`: opcode followed immediately by `N` payload bytes;
- `-1`: opcode, `u8 payload_length`, payload;
- `-2`: opcode, `u16 payload_length`, payload.

The `rf` shape codec is:

```text
varint7 shape_id
if shape_id is not already resolved in the connection's shape cache:
    u8 width
    u8 height
    width*height values packed as 5-bit integers, MSB first
    discard padding to the next byte boundary
```

An ordinary falling piece is always a `2 x 1` domino. Its separate descriptor
contains two nibbles. For each nibble `n`:

- bit 3 clear: cell value `16 + (n & 7)`, an ordinary loose color;
- bit 3 set: cell value `24 + (n & 7)`, a special item kind.

The old Python scaffold's tetromino generator and cell values `1..7` were not
valid Dekobloko pieces; it now emits `2 x 1` dominoes with values `16..22`.

A cooked feedback shape uses the same `rf` envelope but a different cell
vocabulary. The original resolver computes the smallest bounding rectangle and
serializes every position in row-major order:

```text
0          hole / unoccupied position inside the bounding rectangle
8 | color  occupied cooked cell (values 8..14)
```

Thus an irregular or hollow cooked shape is transmitted exactly; it must not be
flattened to a cell count or reconstructed as a domino on the recipient.

## Match start

S2C 58 starts a match owned by this client; S2C 59 is the spectator twin. Both
use `-2` framing and the same body:

```text
u16 settings
u16 round_id
u8  theme_or_game_parameter
u8  player_count
i8  local_slot                 # negative becomes spectator sentinel -2
player_count * nullable_string # 00, CP-1252 bytes, 00 terminator
u8  active_slot_mask
```

`settings`:

```text
bits  0..3   speed index
bits  4..5   feedback/bombardment level
bits  6..8   color count
bits  9..11  special-item level
bit   12     large bucket (12x27; otherwise 8x18)
bit   13     game/spectator option passed into the board group
bit   14     initial result-state flag
bit   15     alternate result/UI flag
```

Slots are immutable for the match. Masks, action packets, piece transitions,
resyncs, and removals all address these original indices. A server must leave a
tombstone when a player loses; compacting the player list redirects later
packets to the wrong buckets.

## Spectator admission and replication

C2S lobby action 10 is `u8 action=10, u16 game_id`. A nonzero game ID requests
spectation; zero leaves the current spectator session. On admission the server
sends S2C 59 with a negative local slot, then one S2C 61 snapshot for every live
stable player slot. Spectators are not included in `player_count`, player names,
or `active_slot_mask` and never receive a slot of their own.

After initialization an observer is a read-only replication recipient. It gets
the same S2C 63 controls, S2C 64 transitions, S2C 67 cooked shapes, proactive
S2C 61 snapshots, S2C 62 removals, chat, and final teardown as the players. It
does not send C2S 60 controls or participate in lives, feedback targeting,
active masks, or winner selection. Only the actual winner receives S2C 69.

## Controls: C2S 60 and S2C 63

The local client accumulates one input mask per game tick. C2S 60 uses `-1`
framing:

```text
u8 count                    # 0..20
count * 5-bit control mask  # MSB first, packet ends byte-aligned
```

Control bits from the original `lk.d` engine:

```text
1   left
2   right
4   rotate one direction (Z)
8   rotate the other direction (Up, X, or Space)
16  accelerated drop (Down)
```

The batch flush condition is exactly `count == 20 || board.field_Bb`. A count
below 20 is therefore a **landing-boundary flush**, correcting an older note.
It is not necessarily a unique landing notification: the client can continue
to send short batches while the landed piece waits for S2C 64. The server must
deduplicate using its authoritative board transition and the C2S-59 update
acknowledgement; issuing one new piece per short batch causes a piece flood.

The relay S2C 63 uses `-1` framing:

```text
u8 player_slot
u8 count
count * 5-bit control mask
```

The receiver queues the bitstream and consumes one mask per board tick. The
Python server now validates the count and exact packed length before relaying.

## Piece transition: S2C 64 and C2S 59

S2C 64 uses `-2` framing:

```text
u8      player_slot
i8      final_x
i8      final_y
u8      rotation_and_speed # low 2 bits rotation; upper bits speed index
u8      finalize_argument  # passed to the original correction routine
rf       next_piece
u8      next_descriptor
varint7 dependency_first_id
varint7 dependency_count
```

The receiver enqueues this event behind already received controls. When it
reaches the event it:

1. corrects/finalizes the previous active piece at `final_x,final_y` with the
   requested rotation;
2. changes the board's speed from `rotation_and_speed >> 2`;
3. spawns `next_piece` with `next_descriptor`;
4. increments the board's `field_U` update counter;
5. if this is the local slot, sends C2S 59 containing that one-byte counter and
   clears the outgoing control batch.

The dependency range causes unresolved `rf` placeholders to be registered in
the shared shape cache before the event runs. Its precise relationship to
cross-board feedback reference counting still needs a live multi-client trace.

C2S 59 is fixed length 1:

```text
u8 applied_update_counter
```

It is an acknowledgement, not a request for another piece.

## Feedback/bombardment shapes: S2C 67 and S2C 66

S2C 67 uses `-1` framing:

```text
u8 player_slot
rf  incoming_shape
```

It appends a shape to that board's `lk.field_X` incoming queue. The queue drives
the visible incoming-material warning/drop sequence; it is **not** the queue of
ordinary next dominoes. The old scaffold sent an extra normal piece with S2C 67
at match start, effectively scheduling a false attack, and no longer does so.

For normal match feedback, `incoming_shape` is the cooked bounding-box bitmap:
occupied cells are `8 | color`, and holes are zero. Shape IDs share one cache
namespace with ordinary pieces. The server's `send_cooked_feedback` path now
allocates that shared ID, serializes the exact bitmap, and broadcasts the same
S2C-67 packet to every live client so all replicas enqueue it on the same target
slot. The target is the next live opponent in stable-slot order, rotating after
each returned shape. This is an explicit server policy because the historical
recipient algorithm is not encoded in the client.

S2C 66 is fixed length 2:

```text
u8 player_slot
u8 count
```

The client calls `board.b()` `count` times. That method selects queued shapes
and increments their use/reference counter.

**S2C 66 is the queue RELEASE, and it must be DEFERRED (resolved 2026-07-25).**
Execution-proven against a real client with injected probes:

* S2C 67 appends a shape to `lk.field_X` with its per-shape counter `field_e = 0`.
  While `field_e == 0` the shape is the *visible* incoming-material warning: the
  per-tick code (`lk.s`) only advances `field_e` when it is **already > 0**
  (case 98 decodes as "if `field_e <= 0`, skip the increment"), so a shape at 0
  sits in the queue indefinitely and never descends.
* The ONLY thing that lifts `field_e` off 0 is `lk.b(-19939)` (lk.java:1327),
  invoked by the S2C-66 handler (client.java case 445-449) `count` times.
* Once released the shape climbs `field_e` 1 → 13 at one step per tick and is
  then popped and discarded (lk.java:7832) — about **240 ms total**.

So sending the 66 alongside the 67 makes the queue flash past in a quarter
second and the incoming warning is never seen (measured: queue at 10036 ms,
release at 10036 ms, discard at 10274 ms). Sending no 66 at all leaves the queue
permanently stuck. The server therefore holds each queued shape as *pending* and
releases it on the **target's next finalize**, which yields a ~1.8 s visible
warning (measured: queue 13193 ms → release 15035 ms). Pending counts are tracked
per slot in `HostedGame.pending_releases` and flushed exactly: `lk.b(-19939)`
throws `IllegalStateException` if asked to release more shapes than are pending,
which would kill the client. Guarded by
`test_queued_cooked_shape_releases_on_target_next_finalize`.

**The client never cooks its own shapes in this build.** qc.java's local
cook/stage path (gated on `field_K >= 2` and `eb.field_m >= 2`) was probed and
fired **zero** times — all cooked shapes arrive over S2C 67. This also settles
the shared-RNG question: the client's cooked-cell RNG (`tf.field_cb`) is a
`java.util.Random` constructed once with no seed ever set, and the server's
gameplay seed is never transmitted, but neither matters because the client does
not generate cooked geometry — the server's board-derived geometry is
authoritative.

The authoritative server runs match/special-item resolution after a lock,
obtains returned shapes for the configured feedback level, chooses their target,
allocates cache-shared `rf` IDs, broadcasts S2C 67, and immediately settles the
cooked solid geometry on the target authoritative board. Incoming overflow uses
the same three-life and stable-slot winner path. The Java library implements the
deterministic engine boundary; the Python host owns recipient scheduling and
wire serialization.

## Full board resynchronization: S2C 61

S2C 61 uses `-2` framing:

```text
u8 player_slot
u16 flags
u8 remaining_lives                # field_jb; initialized to 3
bucket_width*bucket_height * varint7 packed_cell
u8 active_update_counter          # field_U; echoed in C2S 59 for local slot
u8 active_width
u8 active_height
active_width*active_height * u8 active_cell
i8 active_x
i8 active_y
u8 descent_or_lock_state
u16 forced_fast_drop_countdown
u8 previous_control_mask
i8 horizontal_repeat_counter
u8 active_descriptor
u8 board_counter_K
u8 board_row_or_state_z
```

The flags restore orientation parity, grounded state, and board-mode booleans. The bucket dimensions
are fixed by the match options; they are not present in this payload. The old
note that the bucket grid appeared twice was wrong: the second allocation is an
internal work array initialized locally to `8`, not another wire read.

After decode the client redraws the selected board. For the local slot it sends
C2S 59 with the restored update counter. This packet is the mechanism for
joining/spectating an existing state or repairing divergence; normal movement
uses the much smaller input relay.

### S2C 61 is what makes an opponent's bucket visible at all (field_U gate)

A freshly constructed board (`lk`) starts with `field_U = -1` (lk.java constructor).
The carousel render loop in `qc.a(...)` (qc.java:8257 / 8530) draws a board only
when `field_U >= 0`; a board still at `-1` is silently **culled**. The **local**
board advances `field_U` through its own gravity tick (`lk.d`), so it always
renders. A **remote** board never runs local gravity, so the only thing that
lifts its `field_U` off `-1` is the `active_update_counter` field of an **S2C 61**
for that slot (client.i case 347 → `lk.a(boolean, wl, byte)`, lk.java:4890). No
S2C 61 for a remote slot ⇒ that opponent's bucket is invisible for the whole
match.

Because of this, the server broadcasts one S2C 61 **per slot at match start**
(after the initial S2C 64 spawns), owner-skipped. Owner-skip matters: applying an
S2C 61 to a board overwrites its live physics — including the gravity counter
`field_Ab` — so a player must never receive a snapshot of its **own** board
(it would stutter local play); only the remote replicas need it. Proactive
snapshots (after `PROACTIVE_SNAPSHOT_TICKS` accepted ticks) and the mismatch
resync are broadcast the same owner-skipped way, so opponent buckets keep
updating as each side plays.

### Do NOT push snapshots into a LIVE remote board (they arrive stale and top it out)

A remote board replica runs its OWN deterministic simulation from the relayed
action stream (S2C 63) + piece events (S2C 64), and it DOES run the colour-clear
locally: the `lk.field_kb` gate (lk.java:3438) only suppresses the clear's
network *notification* (the commit branch, cases 113–119), not the clear itself.
Verified live 2026-07-25 — a remote replica logged `CLEAR-ZERO field_kb=false`
emptying groups of 8. So a live replica needs **no** ongoing correction; the
relayed accepted controls keep it in step with the server.

Pushing an authoritative snapshot into such a live board is actively harmful.
The client applies whatever snapshot it receives (`lk.a` sets `field_U` from the
packet unconditionally, lk.java:5045), and the snapshot's `field_U`
(= `transition_counters[slot]`) is typically **stale** — lower than the value the
replica has already reached from relayed events. Applying it reverts cells the
replica is mid clear-animation on, so the next active piece overflows and the
client sets `lk.field_Bb=true` (lk.java:6379). Processing a later piece packet
while `field_Bb` is true but the board still has lives makes `qc.b`
(qc.java:6489) fail its consistency check, log `T5: <slot> <lives> <field_Bb>`,
and call `si.a(107)` — which nulls `qc.field_s`, i.e. the client **tears down its
own server connection**. Symptom: a random mid-match disconnect (no game-over
screen), the surviving side awarded the win, and the player never lost a life.

Rule: snapshots (S2C 61) are for **initial** state only — the match-start seed
(so `field_U` leaves −1 and the bucket renders) and spectator join. The server
therefore does NOT broadcast the old proactive (~10 s) snapshot, nor one per
finalize, into live remote boards. Guarded by
`test_no_ongoing_snapshot_into_live_remote_replica` and
`test_reaching_snapshot_tick_interval_does_not_snapshot_live_boards`.

Regression 2026-07-25: the match-start seed was previously gated off
(`DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS` defaulted off, and `start()` sent no
snapshot), on a stale belief that the serializer's byte order did not match the
client's `lk.a` decoder. Re-tracing `lk.a` against the current (regenerated)
decompilation confirmed the byte order above matches exactly and that
`field_P = new int[field_O*field_a]` (= `width*height`) cannot overrun. The flag
now defaults **on** (`=0` disables). Proven live with an instrumented all-original
client: `OP61 … slot=1 field_U(before)=-1 → after=0 → DRAWABLE`, then
`RENDER-GATE slot=1 … -> DRAWN`. Guarded by
`test_match_start_seeds_opponent_snapshots`.

## Reset, defeat, and match termination

`lk.field_jb` is the remaining-life counter, not merely a participating flag.
It is initialized to 3. Finalizing a piece whose bitmap top is above the bucket
decrements it once. With lives remaining, the original keeps eligible overflow
cells that can occupy the clamped top row and continues with another piece. At
zero it clears the active piece and the slot is defeated. Therefore a server
that treats the first overflow as defeat chooses the wrong winner.

Winner selection is mechanical after that engine result: tombstone the defeated
stable slot, count the live slots, and when exactly one remains send S2C 62 for
the loser(s), S2C 69 to that survivor, then the teardown packet. No client
packet reports a win.

Verified receiver effects:

| S2C | Framing | Body | Effect |
|---|---:|---|---|
| 65 | fixed 1 | `u8 slot` | Drain queued events, clear/reset that board, reset local round UI if applicable. |
| 62 | fixed 2 | `u8 slot, u8 result` | Drain the target stream, clear the board pointer and active-mask bit, decrement live count, and show defeat state if local. |
| 69 | fixed 1 | `u8 result` | Mark this recipient as winner and enter winner UI state. |
| 70 | fixed 1 | `i8 result_or_winner` | Drain all board streams, freeze/end the board group, and enter an end-of-round UI state. Exact byte vocabulary is unresolved. |
| 68 | fixed 1 | `u8 result` | Store a result/status and show a distinct result resource. Exact meaning unresolved. |
| 60 | fixed 0 | none | Tear down the multiplayer/spectator game state. Send only after result packets. |

S2C 62 is specifically how other players' lost buckets disappear. It does not
move any surviving board to a new index.

### 60 is the teardown, not part of the result display (confirmed 2026-07-25)

The table above says "send only after result packets". That is necessary but
not sufficient: 60 must not be sent at match end *at all*. Sending 62, 69 and
60 back to back destroys the result screen in the same breath it is created,
and the observed behaviour was a finished match flashing nothing and returning
the player straight to the lobby.

Withholding 60 until the player dismisses the screen makes the defeat UI render
for real -- an eliminated opponent shows `PLAYER 3 IS OUT` on screen. So:

* **62's defeat UI is now execution-proven**, not merely read from bytecode;
* **60 is confirmed to be the teardown**, and is now sent per-session when that
  player leaves the result screen (C2S 62 `leave_game`, or C2S 58, the lobby
  button). The room is retired only once the last player has dismissed it.

Sessions with no UI -- bots and the demo fixtures -- must dismiss themselves, or
they pin the room open forever.

### The winner gets the "Panic!" screen, not "You win!" (observed 2026-07-26)

With the teardown deferred so the end screen survives long enough to be read,
the winner's screen is now visible -- and it is **wrong**. The client shows the
**"Panic!"** screen rather than "You win!". So S2C 69 does reach the winner UI
(the screen changes, and it is not the defeat screen), but it selects the wrong
end-of-game resource.

The server sends 69 with `result_code = 0`, and 0 is the default that every
internal caller passes; no call site has ever chosen a different value. The
obvious reading is that this byte is not a formality but the **selector for
which end screen is shown**, with 0 landing on panic rather than victory. That
matches the neighbouring opcodes: the table above already records 68 as "show a
distinct result resource" and 70 as carrying an `i8 result_or_winner` whose
"exact byte vocabulary is unresolved" -- three opcodes with an unexplained
result byte is a strong hint they share one vocabulary.

This is a hypothesis, not a measurement. It should be settled the way the
rotation question was: drive `qc`'s 69 handler with each candidate byte and see
which resource each selects, rather than guessing values against a live match.
Note "Panic!" is plainly a real game state in its own right (a bucket close to
topping out), so the value space likely encodes several outcomes -- win, loss,
draw, panic -- not just a win/lose flag.

Beyond picking the right byte, the win menu proper -- final scores, the
highscore table, the menu buttons -- has never been seen populated. Two further
gaps, neither yet resolved:

* no score payload accompanies 69, and the client presumably needs one to fill
  a score/highscore panel;
* the post-game **S2C 71-74** masks that drive the rematch UI have **no senders
  anywhere in the server**. C2S 63 (rematch offer/cancel/accept) is received and
  logged, but since the client's choice is selected from those masks, the
  exchange cannot complete.

Deferring the teardown is the prerequisite for any of that, and is now in place;
the score and rematch payloads are the remaining work.

## Draw and rematch controls

C2S 61, 62, and 63 are three bare UI actions:

- 61: draw offer/cancel/accept, selected from current draw masks;
- 62: resign;
- 63: rated/unrated rematch offer/cancel/accept, selected from current rematch
  masks.

This mapping is confirmed by the menu action dispatch and its dynamic strings
(`Offer draw`, `Cancel draw`, `Accept draw`, and the rematch variants). C2S 63
is not a piece request.

S2C 71--74 are fixed one-byte mask/state updates used by those negotiations:

```text
71 -> draw-related mask field_d
72 -> scalar state field_h
73 -> rematch-related mask field_a
74 -> mask cleared from both field_d and field_a, also saved on qc
```

S2C 76 appends one signed byte to a small per-game ordering/result array. The
exact voting state machine and S2C-72/76 semantics are not yet named.

## Python server implementation status

`apps/server/dekobloko_server/engine.py` is the Python port of the verified Java
active-piece/match engine. `HostedGame` now retains, for every immutable slot:

- an authoritative board engine and active piece;
- elapsed-time control credit and the last held-input mask;
- current `field_U`/last acknowledged transition;
- returned-feedback rotation state and incoming cooked solids;
- accepted ticks since the last proactive snapshot;
- live/defeated state.

The implemented flow is:

```text
on C2S 60:
    validate and decode masks
    admit at most elapsed 50 Hz credit, capped at a 40-tick burst
    step authoritative board once per admitted mask
    trim masks after landing and relay only accepted masks as S2C 63
    resynchronize the sender after a rejected or partially admitted batch
    if the authoritative board newly lands:
        activate placed special items and resolve bucket matches/chains
        target returned cooked shapes round-robin with S2C 67
        settle each shape on the target authoritative bucket
        allocate the next ordinary domino
        send exactly one S2C 64 transition
    after 500 accepted non-landing ticks, broadcast S2C 61 for that slot

on C2S 59:
    accept only the matching per-slot transition counter
    ignore duplicate short lock-boundary batches for that transition
    send S2C 61 to the sender after a mismatched counter

on divergence, spectator join, or reconnect:
    serialize every live stable slot as S2C 61

on C2S lobby action 10 with a running game ID:
    send S2C 59 with a negative local slot
    send every live stable slot as S2C 61
    subscribe the observer to all subsequent replicated gameplay events

on C2S lobby action 10 with game ID zero:
    send S2C 60 teardown only to that observer
    leave player slots, lives, and match outcome unchanged

on board loss:
    send S2C 62 for its stable slot
    tombstone the slot
    if one player remains, send winner/result packets, then S2C 60
```

The server uses an explicit policy where the historical service cannot be
recovered from the client: each enabled piece cell has a 1-in-12 item chance,
feedback rotates to the next live opponent, controls replenish at 50 ticks/s
with a 40-tick burst, and a proactive S2C 61 is sent every 500 accepted ticks.
Incoming feedback is settled immediately in the authoritative engine while the
wire event lets clients present their warning/drop animation. These choices are
configuration-level policy, not claims about the original server.

## Remaining unknowns

- Exact `finalize_argument` vocabulary in S2C 64 beyond its call position.
- Shape dependency/reference policy spanning S2C 64, 66, and 67.
- Historical feedback-recipient rotation and whether any modes broadcast to
  multiple opponents; the Python server uses next-live round-robin.
- Exact result-code text for S2C 62/68/69/70.
- Complete draw/rematch mask transition table for S2C 71--74/76.
- Whether and how often the original server proactively sent S2C 61 during a
  long match; the Python server uses 500 accepted ticks plus mismatch/manual
  recovery.

These require either a reference-server capture or a more complete executable
`qc` dispatcher harness. They do not change the verified replica architecture,
control stream, board resync layout, or stable-slot removal behavior.
