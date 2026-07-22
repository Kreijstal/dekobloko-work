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
and increments their use/reference counter. This is structurally verified, but
the exact server event that requires the increment remains unresolved.

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
