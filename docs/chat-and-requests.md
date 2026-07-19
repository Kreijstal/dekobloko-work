# Chat, requests, and the outbound queues

How the client talks to the server after login: which opcodes are requests that
demand a reply, how chat is encoded, and what is still unsolved.

Companion docs: [`loading-and-menu-investigation.md`](loading-and-menu-investigation.md)
(reaching the menu), [`troubleshooting.md`](troubleshooting.md) (symptom index).

## The governing rule: unanswered requests stall the client

Most client opcodes are **requests**. The client registers an object on a queue,
sends the opcode, and blocks that feature until a reply pops the queue.
`bd.g` re-drains its queues every tick, so an unanswered request repeats
forever. A single capture showed **70,176 outbound packets of which 13 were
real** -- the rest were retries.

Every stall chased in this project reduced to the same shape: the server
consumed a request and answered nothing.

| client sends | queue | server must reply | effect |
| --- | --- | --- | --- |
| opcode 5 | `ef.field_S` (an `sb`) | **opcode 4** -> `cm.a(53)` | sets `qj.field_k` |
| opcode 4 | `rc.field_e` (an `f`) | **opcode 3** -> `dk.a` | sets `nm.field_Qb` |
| opcode 9 | -- | lobby bootstrap | enters the lobby |
| opcode 12 | -- | **opcode 11** -> `ki.a` | renders a chat line |
| opcode 3 | -- | **UNKNOWN** | scores/achievements are dropped |
| opcode 10 | -- | **UNCONFIRMED** (15?) | "Return to Main Menu" |

Opcodes 4 and 5 were long labelled a "lobby heartbeat pair". They are not.
`gm.b` (`gm.java:90`) writes opcode 4 as `[4][1][2]`; `oi.a` (`oi.java:272`)
writes opcode 5 as `[5][2][0][field_r]`. The `01 02` payload that looked like
half a heartbeat is opcode 4's body.

## Distinguishing real requests from retry noise

Group outbound packets by **call site**, not by opcode. Requests issued once
come from feature code; the storms all come from `bd.g`:

```
31199x  opcode 4   kk.a:42  | of.a:106 | bd.g:1455     <- retry storm
28268x  opcode 5   mc.a:18  | wa.a:263 | bd.g:1461     <- retry storm
    1x  opcode 4   gm.b:101 | cc.a:17  | dc.a:307      <- the real request
    1x  opcode 5   oi.a:277 | ub.a:81  | dc.a:359      <- the real request
```

A request that fires once and stops is satisfied. One repeating through `bd.g`
is not. `of.a`/`wa.a` queue `ki` objects, and `cm.a`'s discriminator `1` pops
`cg.field_c` (the `ki` queue) while `0` pops `ef.field_S` -- so a server that
only ever sends discriminator `0` leaves the `ki` queue draining forever.

## Chat text is Huffman-compressed

Both directions compress the message body with the table the client loads from
**archive 3**, file `"huffman"` (`client.java:4669`:
`new jk(cl.field_y.a(0, "huffman", ""))`). That is what archive 3 is for.

The raw table is 256 bytes -- one code length per character. The code *values*
come from `jk`'s constructor, which assigns them in character order with
per-length counters and carry propagation.

**Do not reimplement that construction.** Two attempts failed: plain canonical
ordering decodes known-good input as `'sfee'`/`'yb'`, and a literal translation
of the constructor produces nothing at all. Instead the code table was dumped
from the client's own `jk` -- loaded in a JVM with the real table bytes, read
back by reflection -- into `huffman-codes.csv` as `char,bitlength,code`. The
server does a plain bit-match against that (`huffman.py`).

Verified against captured traffic:

```
00 04 e7 bc                                   -> "test"
00 04 8d 09 80                                -> "lmao"
00 11 fa 09 c6 74 c1 29 a5 dc da c0           -> "what is happening"   (17 chars, 10 bytes)
```

Client -> server chat is opcode 12, written by `ce.a` (`ce.java:435`) as
`[12][u8 len][discriminator][count][huffman]`. `ce.a` reserves a byte after the
opcode and backfills it, so the opcode is variable-length.

## Server -> client chat: opcode 11 and the channel byte

Server opcode 11 reaches `cl.a(ki.a(0, false), true)`. `ki.a` (`ki.java:16`)
parses:

```
u8    flags        mf.field_R = v & 127 (channel); bit 0x80 -> fm.field_f
u8    tg.field_c
u64   fc.field_h                (wl.f = two wl.i reads, 4 bytes each)
u16   vl.field_k   } channel 2 only
u24   ic.field_a   }            (wl.h advances 3 bytes)
u8    var4         0 => ONE name string follows and is reused
str   ad.field_x   plain NUL-terminated, NO leading zero byte
u16 + str          } channel 1 or 4 only -> qm.field_e
u8    count        character count (li.a caps at 80)
...   body         Huffman bytes
```

`li.a` (`li.java:15`) reads the count, Huffman-decodes into a byte[], and
converts via `un.a`. The server can relay the client's compressed blob
**verbatim** -- the receiving client decompresses with the same table, so no
encoder is needed server-side.

### The formatter decides everything: mb.java:118-215

`ki.a` fills an `hl`; `mb.a` turns it into a line. Read that function before
changing any byte -- it states the rules outright:

```java
var2 = null;
if (field_p != null && field_l == 1) var2 = "<img=0>" + field_p;
if (field_l == 2)                    var2 = "<img=1>" + var2;
...
if (field_m == 0 && ii.field_q) var3 = "[" + uc.field_b + "] ";   // "[Lobby] "
if (field_m == 1)               var3 = "[<owner>'s game] ";
if (field_m == 4 && f.field_q)  var3 = "[" + f.field_q + "] ";
if (field_m == 3)               var3 = "[#" + field_g + "] ";
if (!field_j)                   var3 = var3 + var2 + ": ";        // the NAME
```

A working lobby player line therefore needs **three** things:

| field | source | value | why |
| --- | --- | --- | --- |
| `field_l` | `tg.field_c` (byte 1) | **1** | the name is built ONLY on this branch |
| `field_m` | flags & 127 | **0** | the only channel giving "[Lobby] " |
| `field_j` | flags & 0x80 | **clear** | the name is appended under `if (!field_j)` |

So the flags byte is `0x00` and the second byte is `1`.

**`tg.field_c` was the real bug, not the channel.** With it at 0, `var2` stays
null and the line reads "null: text" on *every* channel. Five envelope
revisions were spent moving the channel byte in response to that symptom before
reading the formatter. The `<img=0>` is the rank icon drawn before the name.

Channel behaviour observed while getting there:

| flags | result |
| --- | --- |
| `0x00` + `tg.field_c=1` | `[Lobby] <name>: text` -- correct |
| `0x00` + `tg.field_c=0` | `[Lobby] null: text` |
| `0x01` | in-game channel, `[<owner>'s game] ` |
| `0x02` | renderer `NullPointerException` |
| `0x82` | server message / status channel, no speaker |
| `0x84` | named line, wrong channel and colour |

The prefix also depends on client UI state (`ii.field_q`, `f.field_q`,
`pk.field_r`, `cd.field_m` at `nm.java:255`) -- which screen the player is on.
It is not purely a function of the packet.

### Server -> client opcode 12 is quickchat

Its branch reads a `u16` id and looks the message up with
`wj.field_Qb.a(127, var5)`; the text comes from that object, not the wire. Free
text must use opcode 11's `li.a` Huffman path.

## Use the client as a library

The reliable technique in this project: **load the client's own classes and run
them**, rather than reimplementing or reading. Every format derived by reading
decompiled source was wrong -- the `bd.f` dispatch (three times), the Huffman
table construction (twice), the chat envelope (four times). Every time the
client's code was executed instead, it was right immediately.

Two harnesses live in the session scratch dir:

- **`HuffTest`/`DumpCodes`** -- construct `jk` with the real table and decode, or
  dump the code table by reflection.
- **`ChatProbe`** -- inject a candidate opcode 11 payload into `de.field_V`,
  call `ki.a(0, false)`, and print `ad.field_x`, `sa.field_B`, `ib.field_pb`
  and `mf.field_R`: exactly what the client would parse.

`jk`, `uf`, `ki`, `de`, `sm` are package-private in the default package, so a
harness must live there too. Point the classpath at the built instrumented
classes.

**Known limitation:** `ChatProbe` exercises only `ki.a`, the parser. It reported
a clean parse for the `0x02` payload that then crashed the live client, because
the NPE happens later in `cl.a`, the renderer. A green probe means "the fields
decode", **not** "the client will display it". Extending the harness to drive
`cl.a` would need UI state stood up, and is the obvious next improvement.

## The client uses several connections

The client opens multiple game connections, and per-connection state does not
transfer between them. This has caused bugs repeatedly:

- The lobby request (opcode 9, from `jm.a:151 <- ke.d:3578 <- ke.k:1426`, the
  ENTER MULTIPLAYER LOBBY handler) arrives on a connection that never sent the
  4/5 heartbeat. Gating the bootstrap on a per-connection `_lobby_ready` flag
  rejected every real lobby request with "arrived before ready" and broke lobby
  entry that had previously worked.
- Reading opcode histograms from the server log is unreliable while any
  connection is desynchronised; a desync makes every value 0-255 appear.

Do not gate anything on connection-local state. A request that only a loaded
client could send is its own readiness proof.

## Scores and achievements are dropped

`fm.a` (`fm.java:56`) writes **client opcode 3**:

```java
var8.f(3, -4);                        // opcode 3
var8.field_n = var8.field_n + 1;      // reserve a length byte
var8.a(true, 1);                      // sub-command 1
var8.d(-1, param2.field_u);           // u16
var8.d(-1, param2.field_x);           // u16
var8.d(-1, param2.field_q);           // u16
var8.a(param2.field_t, false);        // flags
... a(field_v), a(field_w), a(field_y)
var8.a(true, param2.field_s.length);  // array count
  ... loop over field_s ...
```

Three 16-bit values, four flags, then a counted array -- a stats/achievement
record, matching the observed 32-byte payload.

`wb.a` (`wb.java:23`) also sends opcode 3, with sub-command `5, 0`, and writes
**no length byte**. Two producers of one opcode with apparently different
framing is unresolved; do not assume either shape without capturing plaintext
bytes.

The server has **no handler and no length entry** for opcode 3, so submissions
are framed by guesswork and dropped. Nothing is persisted. Menu clicks were
observed producing four distinct opcode 3 requests plus one opcode 9.
