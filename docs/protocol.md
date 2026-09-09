# Dekobloko wire protocol

Reference for the protocol that `apps/server/` (authoritative, Python) and
`apps/server-js/` implement, and that the decompiled client speaks. Layouts
below were recovered by executing the client's own classes or reading
ground-truth JAR bytecode; claims that were only inferred are marked
**UNVERIFIED** and listed again at the end.

Related: [game rules the authoritative engine implements](single-player-master-challenge-gameplay.md),
[JS5 sprite format](js5-sprite-format.md), [troubleshooting](troubleshooting.md).

---

## 1. Framing

- The **opcode byte is ISAAC-enciphered** in both directions (`uf.f` on write,
  deciphered by `PacketCodec` on read): `byte0 = (plaintext_opcode +
  isaac_keystream) & 0xFF`. **All payload bytes are plaintext.**
- Length kinds (mirroring `mk.field_c` / `CLIENT_PACKET_LENGTHS`): `N>=0` =
  fixed body of N bytes with **no** length byte on the wire; `-1` = one `u8`
  length byte after the opcode; `-2` = one `u16` big-endian length.
- All multi-byte integers are **big-endian**.
- Strings are CP-1252, NUL-terminated. A "nullable string" is `00`, the bytes,
  then `00`.

All feature traffic except the raw lobby name-list frame rides the single
authenticated game connection carrying the ISAAC codec
(`GameSession._run_packet_loop`). Login, JS5 and HTTP are separate connections.

### The governing rule: unanswered requests stall the client

Most client opcodes are **requests**. The client registers an object on a `vj`
queue, sends the opcode, and blocks that feature until a reply pops the queue.
`bd.g` re-drains its queues every tick, so an unanswered request repeats
forever. One capture showed **70,176 outbound packets of which 13 were real**;
the rest were retries.

Group outbound packets by **call site**, not by opcode. A request issued once
comes from feature code; storms all come from `bd.g`:

```
31199x  opcode 4   kk.a:42  | of.a:106 | bd.g:1455     <- retry storm
28268x  opcode 5   mc.a:18  | wa.a:263 | bd.g:1461     <- retry storm
    1x  opcode 4   gm.b:101 | cc.a:17  | dc.a:307      <- the real request
    1x  opcode 5   oi.a:277 | ub.a:81  | dc.a:359      <- the real request
```

`of.a`/`wa.a` queue `ki` objects, and `cm.a`'s discriminator `1` pops
`cg.field_c` (the `ki` queue) while `0` pops `ef.field_S` — a server that only
ever sends discriminator `0` leaves the `ki` queue draining forever.

| client sends | queue | server must reply | effect |
| --- | --- | --- | --- |
| opcode 5 | `ef.field_S` (an `sb`) | **opcode 4** -> `cm.a(53)` | sets `qj.field_k` |
| opcode 4 | `rc.field_e` (an `f`) | **opcode 3** -> `dk.a` | sets `nm.field_Qb` |
| opcode 9 | -- | lobby bootstrap | enters the lobby |
| opcode 12 | -- | **opcode 11** -> `ki.a` | renders a chat line |
| opcode 3 | -- | **UNVERIFIED** | scores/achievements are dropped |
| opcode 10 | -- | **UNVERIFIED** (15?) | "Return to Main Menu" |

Opcodes 4 and 5 are not a "lobby heartbeat pair". `gm.b` (`gm.java:90`) writes
opcode 4 as `[4][1][2]`; `oi.a` (`oi.java:272`) writes opcode 5 as
`[5][2][0][field_r]`. The `01 02` payload is opcode 4's body.

### KEEPALIVE

The client disconnects after 30 s of server silence (`SERVER_TIMEOUT_MILLIS`,
JagexApplet). A per-connection daemon must send server opcode 0 every 10 s and
echo client keepalives, matching the reference server's
`IdleStateHandler(0, 10, 0)`. Encode+send are under one lock so the keepalive
thread and the packet loop cannot interleave ISAAC opcode-cipher advances.
Most "room" and "gameplay" symptoms in this project were really the 30 s
timeout landing mid-interaction.

### The client uses several connections

Per-connection state does not transfer between game connections. The lobby
request (opcode 9, from `jm.a:151 <- ke.d:3578 <- ke.k:1426`, the ENTER
MULTIPLAYER LOBBY handler) arrives on a connection that never sent the 4/5
exchange. **Do not gate anything on connection-local readiness state** — a
request only a loaded client could send is its own readiness proof. Reading
opcode histograms from the server log is unreliable while any connection is
desynchronised; a desync makes every value 0-255 appear.

---

## 2. Opcode tables

### 2.1 Client → server

| Opcode | Framing | Sub-disc | Feature | Meaning |
|---|---|---|---|---|
| **3** | fixed 6 (no len byte) | `byte0 = 0x05` | high-scores | hiscore-table request `[05][00][u16 key][u8 rows][u8 vcols]` |
| **3** | `-1` (u8 len) | `byte0 = 0x01` | achievement-sync | stat/achievement record push |
| 7 | fixed 2 | — | create-unrated | room request `[u8 q][u8 z]` |
| 11 | `-1` | first payload byte | lobby | room actions (see §4) |
| 12 | `-1` | — | chat | free text, Huffman body |
| 15 | `-1` | — | quick-chat | `[u8 channel][u16 id]` for lobby/room |
| 58 | fixed 0 | — | game | ready / start-my-game (gated on `gm.field_I`) |
| 59 | fixed 1 | — | game | transition acknowledgement `[u8 counter]` |
| 60 | `-1` | — | game | per-tick action masks |
| 61 | fixed 0 | — | game | draw offer/cancel/accept |
| 62 | fixed 0 | — | game | resign / leave active game |
| 63 | fixed 0 | — | game | rematch offer/cancel/accept |
| *var* (via `sn.a`) | `-1` | — | friend/ignore add+remove | `[u64 id][cstring name][u8][u8]` — opcode number **UNVERIFIED** |
| *var* (via `ad.a`) | `-1` | `byte0 = 0x04` | play-rated | rated-game submit — opcode number **UNVERIFIED** (candidate 11, alt 124) |
| 14 | `-1` | — | private messages | **UNVERIFIED**, inventory only |

Reference-client (`lexi-lambda/shattered-plans`, same FunOrb framework) names
for the C2S space: `0x00` KEEPALIVE, `0x03` HIGHSCORE, `0x04` ACHIEVEMENTS,
`0x05` PROGRESS, `0x07` RANKING (fixed 2 — **not** "create room"), `0x0b`
LOBBY, `0x0c` CHAT.

### 2.2 Server → client

| Opcode | Framing | Sub-disc | Feature | Meaning |
|---|---|---|---|---|
| **2** | `-2` | `sub = 0` | high-scores | hiscore table / roster |
| **2** | `-2` | `sub = 1` | achievement-sync | record ACK `[01][u16 key][i64 val]` |
| 6 | `-2` | — | create-unrated | room membership `[u8 disc][u8 N][…]` |
| **10** | `-1` | first payload byte | lobby | room lifecycle modes (see §4) |
| 11 | `-1` | — | chat | free text, Huffman body |
| 12 | `-1` | — | quick-chat | canned-phrase line, `[…][u16 id]` |
| **13** | `-1` | `mode = 0/1/2..4` | friend / ignore / list flags | one entry per packet |
| 58 | `-2` | — | game | match start for this client |
| 59 | `-2` | — | game | match start, spectator twin |
| 60 | **fixed 0** | — | game | teardown |
| 61 | `-2` | — | game | full board resynchronization |
| 62 | fixed 2 | — | game | remove/defeat one player |
| 63 | `-1` | — | game | relayed action masks |
| 64 | `-2` | — | game | piece transition |
| 65 | fixed 1 | — | game | reset one board |
| 66 | fixed 2 | — | game | release queued feedback shapes |
| 67 | `-1` | — | game | queue an incoming feedback shape |
| 68 | fixed 1 | — | game | "SPEED UP!" banner |
| 69 | fixed 1 | — | game | "PANIC!" banner (**not** the winner packet) |
| 70 | fixed 1 | — | game | winner announcement `[i8 winner_slot]` |
| 71–74 | fixed 1 | — | game | draw/rematch mask updates |
| 76 | fixed 1 | — | game | appends one signed byte to a per-game ordering array |
| *(raw, non-ISAAC)* | inline u16 | frameCode 100–105 | lobby-player-list | occupant names on the **login** connection |

Background/infra opcodes handled by `bd.f`: `0` keepalive, `1` `ua.i`, `4`
`cm.a`, `5` `pe.b`, `7` logout/bounce (`bd.i`), `8` dynamic class loader
(`qn.a`), `16` MOTD string (`wm.d`), `17` URL/dialog (`bd.l`), `18` flag toggle
(`ne.c`).

**`bd.f` covers opcodes 0–18 only** and gates every dispatch on the 64-entry
`te.field_v[]` enable table, whose bits are built incrementally during
login/bootstrap. Push 2/6/10/12/13 only after login-success and client-ready.
The in-game 58–76 space is handled by the monolithic `client.java` tick reader
on `bh.field_k` and bypasses that gate entirely.

`SERVER_PACKET_LENGTHS` must contain **`60: 0`** (fixed empty teardown) and
`CLIENT_PACKET_LENGTHS` must contain **`7: 2`**; without the latter the ISAAC
keystream desyncs on the first opcode 7.

### 2.3 Opcode collisions

1. **C2S opcode 3 (high-scores vs achievement-sync).** `wb.a` writes a fixed
   6-byte body with `byte0 = 0x05` and **no** length byte; `fm.a` writes a `u8`
   length then `sub = 0x01`. A single static `CLIENT_PACKET_LENGTHS[3]` cannot
   serve both. Resolution: peek the byte after the deciphered opcode — `0x05`
   means fixed 6, anything else means u8-length with `payload[0] == 0x01`. The
   peek itself is **UNVERIFIED**; a wrong peek storms both features.
2. **S2C opcode 2.** Shared handler `ke.e`, discriminated by the leading `sub`
   byte. Uniform `-2` framing, so one length entry serves both.
3. **S2C opcode 13.** Shared handler `oe.c`, discriminated by `mode`. Uniform
   `-1` framing.
4. **Opcode 62 exists in both directions.** C2S 62 = resign (bare); S2C 62 =
   defeat/remove-player (fixed 2). Direction disambiguates. The same is true of
   58 (C2S fixed 0 / S2C `-2`), 59 (C2S fixed 1 / S2C `-2`) and 60 (C2S `-1` /
   S2C fixed 0).
5. **S2C opcode 6 is reconnect-storm-flagged.** It is required as the answer to
   a pending C2S 7, and must **never** be sent speculatively.

---

## 3. Session lifecycle

```
LOGIN  ── qb.a state ba.f sends the RSA/XTEA login block (login conn, raw)
   ▼
LOGIN-RESPONSE (raw, still on the login conn, qb.a state kb.c)
   │   [code 0 login-success] then IMMEDIATELY the raw name-list frame,
   │   one contiguous write, BEFORE any ISAAC packet
   ▼
LOBBY  (ISAAC bd.f loop active; te.field_v gates dispatch)
   │   server may push, only when client-ready:
   │     op 13 mode 0/1 entries + mode 2 list-complete
   │   client requests that block on a vj queue:
   │     op 3 sub 05  hiscore request   → op 2 sub 0 (echo key)
   │     op 3 sub 01  achievement push  → op 2 sub 1 (echo seq)
   │     op 7         room request      → op 6 [disc==q][N]
   │   fire-and-forget client sends (no storm, but no progress without a push):
   │     social add/remove → op 13 echo; quick-chat → op 12 broadcast;
   │     play-rated submit; resign
   ▼
ROOM   op 11 lobby actions ↔ op 10 lobby modes (§4)
   ▼
IN-GAME  opcodes 58–76 on the SAME socket, client.java tick reader,
         not bd.f, not te.field_v-gated (§6)
   ▼
RESULT → teardown (op 60) when the player dismisses the result screen
```

---

## 4. Lobby and rooms

Native room actions are enabled by default; `DEKOBLOKO_ROOMS=0` disables them
for protocol debugging. The protocol server contains no roster placeholders or
demo players; `apps/server/dekobloko_demo.py` owns its socket-free sessions and
registers them through `dekobloko_server.api` and the same `Lobby.join()`
operation as real connections.

### 4.1 Action and mode vocabulary

C2S LOBBY actions (client opcode 11, first payload byte):

```
0 PLAY_RATED_GAME       1 RETURN_TO_LOBBY        2 SET_RATED_OPTIONS
3 ACK_RATED_ROOM_INFO   4 CREATE_UNRATED_GAME    5 SET_ROOM_OPTIONS
6 INVITE_PLAYER_TO_GAME 7 KICK_PLAYER_FROM_GAME  8 JOIN_ROOM
9 LEAVE_ROOM           10 SPECTATE_GAME         11 SHOW_PLAYERS_IN_GAME
```

S2C LOBBY modes (server opcode 10, first payload byte). The frame-10
dispatcher is `ke.b`:

```
 0 YOU_LEFT_ROOM        4 YOU_JOINED_ROOM        5 PLAYER_ENTERED_LOBBY
 8 ADD_ROOM             9 REMOVE_ROOM           11 YOU_ARE_INVITED
14 ADD_PLAYER_INVITE   18 PLAYER_JOINED_ROOM    19 PLAYER_LEFT_ROOM
23 PLAYER_ID
```

`SPECTATE_GAME` carries a big-endian `u16 game_id`; ID zero stops spectating.

### 4.2 Room lifecycle

1. Creating sends YOU_JOINED_ROOM and PLAYER_JOINED_ROOM to the host, then an
   ADD_ROOM record to every initialized lobby connection.
2. Inviting sends YOU_ARE_INVITED to the target and ADD_PLAYER_INVITE to the
   host. Joining hydrates the joiner's member list, broadcasts the new member,
   and refreshes the global ADD_ROOM player count.
3. Starting retains the room in the lobby list and changes its flags to
   running; the spectator bit reflects `GameOptions.allow_spectators`. A denied
   spectate request has no side effects on the caller's current attachment.
4. Conclusion is published once, result/game-over packets return players and
   spectators to the lobby, then REMOVE_ROOM retires the listing.

### 4.3 Room body layouts

`YOU_JOINED_ROOM` (mode 4) on opcode 10 is `[u8 4][u16 room_id][room body]`.
The room body, measured by driving `wg.a` and matched to the reference
`initializeFromServer`:

```
u8 maxPlayerCount | u8 whoCanJoin | u8 flags | 5B gameSpecificOptions |
u16 averageRating | u32 startedAgo | u64 ownerId | cstring ownerName
```

`gameSpecificOptions` is a **5-byte** array (`ve.field_kc`, built
`new ve(j.field_b)` with `j.field_b == 5`). `ve.c` rendering ".../4" is a
display string, not the array length.

`PLAYER_JOINED_ROOM` (mode 18):

```
u64 id | cstring name | cstring displayName | u16 rating |
varint ratedGames | u8 crown | u8 options
```

The varint is base-128 (reference `writeVariableInt`); a single byte for small
values.

`PLAYER_LEFT_ROOM` (mode 19): `u64 id | u8 reason`. On a kick the reason
**must** be `KICKED = 12`. Reason `1` is `ENTERED_GAME` in
`LobbyPlayer.Status` and renders "Player has entered a game".

`LEAVE_ROOM` → `YOU_LEFT_ROOM` (mode 0), a bare mode byte; clears
`cd.field_m` back to the lobby (`ke.b` tail, `ke.java:2465`).

### 4.4 Host detection and player identity

`ig.java:773`: the client is host when its own player id (`uc.field_g`) equals
the room's `ownerId`. `uc.field_g` is set only by the mode-23 PLAYER_ID packet,
which remains opt-in (`DEKOBLOKO_ROSTER=id` or `1`) because a live A/B run tied
it to a return-to-main-menu crash. Native host controls must be retested before
that tradeoff is declared resolved.

The lobby roster row and the local player id must derive **identically** or the
client cannot recognise its own row and you can invite yourself. `uid_for`
replicates `AccountStore.player_id`: normalize, sha256[:4], with the
`0x10000000` tag. A crc32 of the display name does not match.

### 4.5 create-unrated (client opcode 7 → server opcode 6)

Outbound (`ai.a` → `fh.a`, `fh.java:79`), 3 bytes, no length byte:

```
[enc-op 7][u8 q = cl.field_q][u8 z = cl.field_z]
```

`ai.a` registers a pending `cl` on the `oe.I` queue keyed by `cl.field_q`
before sending, so the feature is blocked on that queue.

Inbound (`ul.a`, `-2`): `[u8 disc][u8 N]` then, only if `N>0`, occupant data.

- `disc` **must equal the request's `q`** or the client calls `si.a(122)` and
  disconnects.
- `N` is the occupant count. `N==0` is the empty sentinel that still finalizes
  the room (`cl.field_A=true`, `cl.b()`). It is **not** `0xFF`: `N` is read
  unsigned via `uf.d` and the branch is `~N==-1`, so `0xFF` makes the client
  read 255 occupants and overrun.
- Minimal coherent reply: `[disc=q][00]`.

**UNVERIFIED:** the `q`/`z` semantics (create vs join, rated vs unrated) were
only driven at `q=0, z=10`, and the multi-occupant `pn.a` per-record layout for
`N>=1` is unreversed. Ship `N=0` only.

### 4.6 lobby-player-list (raw frame on the login connection)

Read by `qb.a`, the login state machine, **not** by the ISAAC `bd.f` loop. It
must not go through `encode_server_packet` / `SERVER_PACKET_LENGTHS`.

```
[u8 frameCode = 100 + nameCount]   # nameCount 0..5 (HARD CAP)
[u16 BE blobLen]                   # byte length of the names blob
nameCount x [ 0x00 | cp1252(name) | 0x00 ]
```

The length is `u16` (2 bytes via `wl.e(3)`, whose mode selector folds to 8) and
each name has a **mandatory leading `0x00`** in addition to the terminator
(`wl.b(true)` throws `IllegalStateException` without it). It fills `ph.Eb`
(String[]), transitions `ph.xb: kb.c → ll.a`, and returns `nameCount+100`.
`si.a(60)` fires afterwards as a redraw signal.

**UNVERIFIED:** the 5-name cap suggests a friends/online preview rather than a
full roster (a large roster likely uses `cl.x` op 6 or `kc.r` op 2), and the
end-to-end timing across the login→ISAAC transition was never proven. The frame
must be sent contiguously right after login-success and before any ISAAC
packet.

### 4.7 play-rated

Outbound (`ad.a`, `ad.java:201`). For
`ad.a(body={1,2,3}, op=99, true, gametype=8, 0, true)` the client's own buffer
held `56 06 04 08 80 01 02 03`:

```
[enc-opcode]          # data-driven; not a literal in the JAR
[u8 length]           # count of following bytes
[u8 0x04]             # fixed sub-command discriminator
[u8 gametype]         # hd.field_u (default 8)
[u8 0x80]             # flag = param4|128
[byte[] body]         # ne.field_c lobby game-options blob (opaque)
```

`ad.a` registers nothing on a `vj` queue: this is fire-and-send, not
queue-blocking.

**UNVERIFIED:** the opcode number is threaded `ph.a param9 → qm.a param1 →
ad.a param1`; `th.java:26` threads literal **11** on the lobby-entry path and
`ph.n` threads **124**. Confirm with JDWP at `qm.java:393` after clicking *Play
rated game* and submitting.

Inbound is server opcode 58 (`-2`). Dispatch is proven from `client.class`
4912–4940: it sets `kf.field_I = new qc(...)`, `fm.field_b = true`, and fires
`eb.a(58)`; opcode 59 is the spectator twin (`ce.field_C`, `fa.field_n=true`).
The body layout is given in §6.

### 4.8 friend and ignore lists

Inbound is server opcode 13 (`-1`), one entry per packet, handler `oe.c`.

Ignore (`mode=1`), proven by running `oe.c` on
`01 00 46 6F 6F 00 57 6F 72 6C 64 31 00`:

```
[u8 mode=1][cstring prevName][cstring name][cstring world]
```

`prevName=""` stores `null` (`wb.field_Vb`); `name` becomes `wb.field_Ob` and
the hashtable key; `world` becomes `wb.field_Tb`. It sets `md.field_Z++`,
allocates `mc.field_a = new nk(128)`, and enqueues `wb` on `qi.field_S`.

Friend (`mode=0`) — note the extra flag byte the ignore branch lacks:

```
[u8 mode=0][u8 flag][cstring name][cstring displayName ONLY if flag==1][cstring world]
```

It populates `hg.field_e` / `ed.field_g` / `uf.field_z`, with
`wb.field_Pb = displayName`.

List control (`mode=2/3/4`) toggles static `jj.field_b` (list-complete/dirty);
mode 4 reads an extra cstring plus a `u8`. Send a mode-2 packet after the
entries as the transfer-complete marker.

Outbound goes through `sn.a`. For
`sn.a(0x1122334455667788, op=0x2A, "Foo", 97, true, 5)` the wire was
`1d 0e 11 22 33 44 55 66 77 88 46 6F 6F 00 05 01`:

```
[enc-opcode][u8 length][u64 targetId BE][cstring name][u8 param5][u8 flag]
```

`targetId` is `pd.field_f.field_Tb` and may be 0 for a typed name. `param5`
comes from `mg.c(497,…)` and `flag` from `mg.e(5658)?1:0`; both semantics are
**UNVERIFIED**, as is the opcode number, which is threaded five levels deep
from the right-click menu-action descriptor. The send is fire-and-forget
(`ji.a` nulls `pd.field_f` immediately), so an unanswered add does not storm —
but the client does **not** insert locally, so the server must echo each add as
an opcode-13 packet or the screen stays empty.

### 4.9 high-scores

Outbound is client opcode 3 sub `0x05` (`wb.a`), fixed 6-byte body, no length
byte. Observed: `03 05 00 00 00 0A 01` (key 0) and `03 05 00 00 07 0A 01`
(key 7):

```
[enc-op 3][0x05][0x00][u16 BE field_n = board key][u8 field_o = rows][u8 field_v = value cols]
```

`am.a` enqueues the `kc` on `dg.field_e`; the reply pops it by matching
`field_n`.

Inbound is server opcode 2 sub 0 (`ke.e`, `-2`):

```
[u8 subtype=0]
[u16 BE key]              # MUST echo field_n
[u8 count]                # columns including col0 = local player; 0 => skip record
for col in 1..count-1:
    [cstring name -> rc.field_c[col].field_i]
    [u8 flag; if 1: cstring second -> rc.field_c[col].field_f]
[u8 entryCount]
per entry:
    [u8 columnIndex]
    [i64 BE score -> kc.field_t]
    [field_v x i32 BE value -> kc.field_u]
# terminator: kc.field_p=true, kc.b()
```

The key is `u16` (`uf.e(3)` folds to 8), **not** int32; an int32 key desyncs
every later field. **UNVERIFIED:** the `count>1` name-string path and
`field_v>1` value mapping were never executed, `subtype=1` is a separate
personal-best branch, and `subtype>=2` is undecoded.

### 4.10 achievement-sync

Outbound is client opcode 3 sub `0x01` (`fm.a`). A 38-byte frame with
`count=2` was `F6 24 01 0000 1234 ABCD 0A0B0C0D 11121314 21222324 31323334 02
41424344 51525354 2A5A5918`:

```
[enc-op 3]
[u8 length]                # ALL following bytes INCLUDING the 4-byte checksum
[u8 sub=1]
[u16 BE kn.field_u]        # client auto-increment correlation id
[u16 BE kn.field_x]
[u16 BE kn.field_q]
[i32 BE kn.field_t]        # 4 bytes, not a flag byte
[i32 BE kn.field_v]
[i32 BE kn.field_w]
[i32 BE kn.field_y]
[u8 count = kn.field_s.length]
count x [i32 BE kn.field_s[i]]   # 4 bytes each, not u8
[i32 BE checksum]          # pe.a rolling hash; the length byte counts it
```

`qb.a` enqueues the `kn` on `pb.field_c` **before** sending, so this is a
blocking request flushed every tick; an unacked record repeats forever.

Inbound is server opcode 2 sub 1 (`ke.e`, `-2`), an 11-byte payload
`[u8 sub=1][u16 BE key][i64 BE value]`. The 8-byte value is straight
big-endian. **Order-sensitive hazard:** `ke.e` pops non-matching queued `kn`
while scanning, so an ACK whose key skips a still-pending record silently
discards the intervening ones. **ACK every push exactly once, in arrival order,
echoing the received `u16` verbatim.** `value` semantics are **UNVERIFIED**;
`0` marks the record synced.

---

## 5. Chat

### 5.1 Text is Huffman-compressed

Both directions compress the message body with the table the client loads from
**archive 3**, file `"huffman"` (`client.java:4669`:
`new jk(cl.field_y.a(0, "huffman", ""))`). That is what archive 3 is for.

The raw table is 256 bytes — one code length per character. The code *values*
come from `jk`'s constructor, which assigns them in character order with
per-length counters and carry propagation.

**Do not reimplement that construction.** Two attempts failed: plain canonical
ordering decodes known-good input as `'sfee'`/`'yb'`, and a literal translation
of the constructor produces nothing at all. The code table was instead dumped
from the client's own `jk` — loaded in a JVM with the real table bytes and read
back by reflection — into
`apps/server/dekobloko_server/huffman-codes.csv` as `char,bitlength,code`.
`huffman.py` does a plain bit-match against that.

Verified against captured traffic:

```
00 04 e7 bc                                   -> "test"
00 04 8d 09 80                                -> "lmao"
00 11 fa 09 c6 74 c1 29 a5 dc da c0           -> "what is happening"   (17 chars, 10 bytes)
```

The server can relay a client's compressed blob **verbatim** — the receiving
client decompresses with the same table — so no encoder is needed server-side.

### 5.2 Client → server: opcode 12

Written by `ce.a` (`ce.java:435`) as
`[12][u8 len][discriminator][count][huffman]`. `ce.a` reserves a byte after the
opcode and backfills it, so the opcode is variable-length.

`payload[0]` is the channel: `0 LOBBY`, `1 ROOM`. Echo the sender's channel
rather than hardcoding 0, or a room message renders in the wrong channel. The
client picks the channel itself: `ig.java:52` / `vm_.java:173` upgrade
LOBBY→ROOM when `cd.field_m != null`, unless a specific chat tab
(`pk.field_r`) is selected.

### 5.3 Server → client: opcode 11

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

`li.a` (`li.java:15`) reads the count, Huffman-decodes into a `byte[]`, and
converts via `un.a`.

A room-channel envelope also requires `u16 roomId + cstring ownerName` after
the speaker; without them the client cannot associate the line with a game.

### 5.4 The formatter decides everything: `mb.java:118-215`

`ki.a` fills an `hl`; `mb.a` turns it into a line. Read that function before
changing any byte:

```java
var2 = null;
if (field_p != null) {
    var2 = field_p;
    if (field_l == 1) var2 = "<img=0>" + var2;
    if (field_l == 2) var2 = "<img=1>" + var2;
}
...
if (field_m == 0 && ii.field_q) var3 = "[" + uc.field_b + "] ";   // "[Lobby] "
if (field_m == 1)               var3 = "[<owner>'s game] ";
if (field_m == 4 && f.field_q)  var3 = "[" + f.field_q + "] ";
if (field_m == 3)               var3 = "[#" + field_g + "] ";
if (!field_j)                   var3 = var3 + var2 + ": ";        // the NAME
```

A working lobby player line therefore needs three things:

| field | source | value | why |
| --- | --- | --- | --- |
| `field_l` | `tg.field_c` (byte 1) | **0**, **1**, or **2** | rank tier: no icon, `<img=0>`, or `<img=1>`; all three retain the name |
| `field_m` | flags & 127 | **0** | the only channel giving "[Lobby] " |
| `field_j` | flags & 0x80 | **clear** | the name is appended under `if (!field_j)` |

So the flags byte is `0x00` and the second byte selects the rank tier. A null
speaker name means `field_p` itself was null — it is not a channel or rank
effect.

| flags | `tg.field_c` | result |
| --- | --- | --- |
| `0x00` | 0 | `[Lobby] <name>: text` |
| `0x00` | 1 | `[Lobby] <img=0><name>: text` |
| `0x00` | 2 | `[Lobby] <img=1><name>: text` |
| `0x01` | any | in-game channel, `[<owner>'s game] ` |
| `0x02` | any | renderer `NullPointerException`, client dies |
| `0x82` | any | server message / status channel, no speaker |
| `0x84` | any | named line, wrong channel and colour |

The prefix also depends on client UI state (`ii.field_q`, `f.field_q`,
`pk.field_r`, `cd.field_m` at `nm.java:255`) — which screen the player is on.
It is not purely a function of the packet.

### 5.5 Quick-chat

Server opcode 12's branch reads a `u16` id and looks the message up with
`wj.field_Qb.a(127, var5)`; the text comes from that table, not the wire. Free
text must use opcode 11's `li.a` Huffman path.

Inbound layout (channel 0, single name):

```
[u8 flags]      # mf.R = flags&127 (channel); flags&0x80 -> fm.f MUST be clear
[u8 tg.c]       # MUST be 1 or the name renders as "null"
[u64 fc.h]
# IF channel==2: [u16 vl.k BE][u24 ic.a]
[u8 var4]       # 0 => reuse one name; 1 => a second name cstring follows
[cstring ad.x]  # speaker name
# IF var4==1: [cstring sa.B]
# IF channel==1 or 4: [u16 dh.d BE][cstring qm.e]
[u16 id BE]     # wj.Qb.a(127,id).me.f(-61) -> ib.pb text
```

Outbound via `ce.a` (freetext==null branch): channel0/id5 →
`[enc-op] 03 00 00 05`; channel2/Bob/0x1234 →
`[enc-op] 07 02 42 6F 62 00 12 34`:

```
[enc-opcode][u8 len][u8 channel][cstring name ONLY if channel==2][u16 id BE]
```

The F10-menu caller `ig.a` computes `id = Nb[menuIndex] | 0x8000`, so the wire
id has bit `0x8000` set; relay it verbatim, since `ki.a` does not mask on read.
C2S opcode 15 is the length-byte quick-chat packet (`u8 channel + u16 id` for
lobby/room) and the server relays its id verbatim on S2C opcode 12. Quick-chat
is a push with no queue, so there is no stall risk, but the client does not
echo locally — the server **must broadcast back to the sender too**.

**UNVERIFIED:** the `ce.a` outbound opcode number, whether `0x8000` must be
stripped on echo, and the channel==2 / var4==1 / channel 1|4 branches.

### 5.6 Scores and achievements are dropped

`fm.a` (`fm.java:56`) writes client opcode 3 with sub-command 1: three 16-bit
values, four flags, then a counted array — a stats/achievement record matching
the observed 32-byte payload. `wb.a` (`wb.java:23`) also sends opcode 3, with
sub-command `5, 0`, and writes **no length byte**. Two producers of one opcode
with different framing is the collision in §2.3. Menu clicks were observed
producing four distinct opcode-3 requests plus one opcode 9.

---

## 6. In-match gameplay

This is the renderer-independent protocol used after the room flow. It was
reconstructed from the original client bytecode and checked by executing the
untouched original `lk` board engine headlessly.

### 6.1 Deterministic board replicas

The server does **not** stream pixels or every bucket on every frame. Every
client owns one `lk` engine instance per player and advances all of them:

1. The local board consumes local controls and gravity.
2. The client sends batches of the local board's 5-bit input masks (C2S 60).
3. The server relays the batch to the other clients (S2C 63).
4. Each other client feeds exactly one mask per simulation tick into that
   player's `lk` replica.
5. At a piece boundary the server sends S2C 64, which corrects/finalizes the
   old active piece, selects speed, and spawns the next server-selected piece.
6. S2C 61 replaces a complete board only for initial/recovery
   resynchronization.
7. S2C 62 removes a defeated player by nulling their fixed board slot after all
   queued input/events for that board have been consumed.

The server therefore needs an authoritative copy of the same deterministic
engine. A relay-only server can animate remote boards but cannot reliably
decide lock boundaries, final placement, generated feedback shapes, defeat, or
repair of divergent clients.

### 6.2 The client sends actions, not its world model

The complete in-match C2S writer inventory is 58, 59, 60, 61, 62 and 63 (§2.1).
There is no client-to-server bucket, active-piece, match-result or cooked-shape
upload. Two bytecode facts make this stronger than an opcode-table inference:

- `lk` has exactly one method accepting a network buffer: the S2C-61 full-state
  **decoder**. It has no board-state encoder.
- In the multiplayer branch of `qc`, a landed local board only flushes its
  buffered action masks. Unlike the single-player branch it does not choose and
  apply its own next piece; it waits for S2C 64.

The server must apply those actions to its own engine at the same logic ticks.
That authoritative result supplies S2C-64 final coordinates, cooked feedback
geometry, loss detection, and any S2C-61 recovery snapshot. Useful validation
the protocol permits: accept at most the elapsed number of logic ticks, accept
only the five defined control bits, and ignore actions after the slot has
landed or lost.

### 6.3 The `rf` shape codec

```text
varint7 shape_id
if shape_id is not already resolved in the connection's shape cache:
    u8 width
    u8 height
    width*height values packed as 5-bit integers, MSB first
    discard padding to the next byte boundary
```

An ordinary falling piece is always a `2 x 1` domino. Its separate descriptor
contains two nibbles; for each nibble `n`:

- bit 3 clear: cell value `16 + (n & 7)`, an ordinary loose colour;
- bit 3 set: cell value `24 + (n & 7)`, a special-item kind.

Cell values `1..7` and tetromino shapes are not valid Dekobloko pieces.

A cooked feedback shape uses the same `rf` envelope with a different cell
vocabulary. The resolver computes the smallest bounding rectangle and
serializes every position in row-major order:

```text
0          hole / unoccupied position inside the bounding rectangle
8 | color  occupied cooked cell (values 8..14)
```

An irregular or hollow cooked shape is transmitted exactly; it must not be
flattened to a cell count or reconstructed as a domino on the recipient.

### 6.4 Match start: S2C 58 / 59

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

**Slots are immutable for the match.** Masks, action packets, piece
transitions, resyncs and removals all address these original indices. A server
must leave a tombstone when a player loses; compacting the player list
redirects later packets to the wrong buckets.

### 6.5 Spectator admission

C2S lobby action 10 is `u8 action=10, u16 game_id`. A nonzero game ID requests
spectation; zero leaves the current spectator session. On admission the server
sends S2C 59 with a negative local slot, then one S2C 61 snapshot for every live
stable player slot. Spectators are not included in `player_count`, player names
or `active_slot_mask` and never receive a slot.

An observer then receives the same S2C 63 controls, S2C 64 transitions, S2C 67
shapes, S2C 61 snapshots, S2C 62 removals, chat and teardown as the players. It
does not send C2S 60 or participate in lives, feedback targeting, active masks
or winner selection. It **does** receive S2C 70: that packet announces who won
rather than telling a recipient it won.

### 6.6 Controls: C2S 60 and S2C 63

The client accumulates one input mask per game tick. C2S 60 uses `-1` framing:

```text
u8 count                    # 0..20
count * 5-bit control mask  # MSB first, packet ends byte-aligned
```

Control bits from the original `lk.d` engine: `1` left, `2` right, `4` rotate
one direction (Z), `8` rotate the other direction (Up, X or Space), `16`
accelerated drop (Down).

The batch flush condition is exactly `count == 20 || board.field_Bb`, so a
count below 20 is a **landing-boundary flush** — but not necessarily a unique
landing notification: the client can keep sending short batches while the
landed piece waits for S2C 64. The server must deduplicate using its
authoritative board transition and the C2S-59 acknowledgement; issuing one new
piece per short batch causes a piece flood.

S2C 63 uses `-1` framing:

```text
u8 player_slot
u8 count
count * 5-bit control mask
```

The receiver queues the bitstream and consumes one mask per board tick.
Validate the count and the exact packed length before relaying.

### 6.7 Piece transition: S2C 64 and C2S 59

S2C 64 uses `-2` framing:

```text
u8      player_slot
i8      final_x
i8      final_y
u8      rotation_and_speed # low 2 bits rotation; upper bits speed index
u8      finalize_argument  # passed to the original correction routine
rf      next_piece
u8      next_descriptor
varint7 dependency_first_id
varint7 dependency_count
```

The receiver enqueues this event behind already-received controls. When it
reaches the event it:

1. corrects/finalizes the previous active piece at `final_x,final_y` with the
   requested rotation;
2. changes the board's speed from `rotation_and_speed >> 2`;
3. spawns `next_piece` with `next_descriptor`;
4. increments the board's `field_U` update counter;
5. if this is the local slot, sends C2S 59 with that one-byte counter and
   clears the outgoing control batch.

The dependency range registers unresolved `rf` placeholders in the shared shape
cache before the event runs.

C2S 59 is fixed length 1, `u8 applied_update_counter`. It is an
acknowledgement, not a request for another piece.

### 6.8 Feedback shapes: S2C 67 and S2C 66

S2C 67 uses `-1` framing: `u8 player_slot`, then `rf incoming_shape`. It
appends a shape to that board's `lk.field_X` incoming queue, which drives the
visible incoming-material warning — it is **not** the queue of ordinary next
dominoes. `incoming_shape` is the cooked bounding-box bitmap (occupied cells
`8 | color`, holes zero). Shape IDs share one cache namespace with ordinary
pieces.

S2C 66 is fixed length 2: `u8 player_slot`, `u8 count`. The client calls
`board.b()` `count` times.

**S2C 66 is the queue RELEASE and it must be DEFERRED:**

* S2C 67 appends a shape with its per-shape counter `field_e = 0`. While
  `field_e == 0` the shape is the *visible* warning: `lk.s` only advances
  `field_e` when it is already `> 0`, so a shape at 0 sits in the queue
  indefinitely and never descends.
* The only thing that lifts `field_e` off 0 is `lk.b(-19939)`
  (`lk.java:1327`), invoked by the S2C-66 handler `count` times.
* Once released the shape climbs `field_e` 1 → 13 at one step per tick and is
  then popped and discarded (`lk.java:7832`) — about **240 ms** total.

Sending 66 alongside 67 makes the queue flash past in a quarter second and the
warning is never seen; sending no 66 leaves the queue permanently stuck. Hold
each queued shape as *pending* and release it on the **target's next
finalize**, which yields a ~1.8 s visible warning. Track pending counts per
slot and flush them exactly: `lk.b(-19939)` throws `IllegalStateException` if
asked to release more shapes than are pending, which kills the client.

**The client never cooks its own shapes in this build.** `qc.java`'s local
cook/stage path (gated on `field_K >= 2` and `eb.field_m >= 2`) fires zero
times; all cooked shapes arrive over S2C 67. This also settles the shared-RNG
question: the client's cooked-cell RNG (`tf.field_cb`) is a `java.util.Random`
constructed once with no seed ever set, and the server's gameplay seed is never
transmitted — but neither matters, because the server's board-derived geometry
is authoritative.

### 6.9 Full board resynchronization: S2C 61

`-2` framing:

```text
u8  player_slot
u16 flags
u8  remaining_lives                # field_jb; initialized to 3
bucket_width*bucket_height * varint7 packed_cell
u8  active_update_counter          # field_U; echoed in C2S 59 for local slot
u8  active_width
u8  active_height
active_width*active_height * u8 active_cell
i8  active_x
i8  active_y
u8  descent_or_lock_state
u16 forced_fast_drop_countdown
u8  previous_control_mask
i8  horizontal_repeat_counter
u8  active_descriptor
u8  board_counter_K
u8  board_row_or_state_z
```

The flags restore orientation parity, grounded state and board-mode booleans.
Bucket dimensions are fixed by the match options and are **not** in this
payload; the grid appears once.

**S2C 61 is what makes an opponent's bucket visible at all.** A freshly
constructed `lk` starts with `field_U = -1`, and the carousel render loop in
`qc.a` (`qc.java:8257`/`8530`) draws a board only when `field_U >= 0`. The
local board advances `field_U` through its own gravity tick, so it always
renders; a **remote** board never runs local gravity, so the only thing that
lifts its `field_U` off `-1` is the `active_update_counter` of an S2C 61 for
that slot (`client.i` case 347 → `lk.a(boolean, wl, byte)`, `lk.java:4890`).
No S2C 61 for a remote slot means that opponent's bucket is invisible for the
whole match.

So the server broadcasts one S2C 61 **per slot at match start** (after the
initial S2C 64 spawns), **owner-skipped**. Owner-skip matters: applying an
S2C 61 to a board overwrites its live physics, including the gravity counter
`field_Ab`, so a player must never receive a snapshot of its own board.

**Do not push snapshots into a LIVE remote board.** A remote replica runs its
own deterministic simulation from S2C 63 + S2C 64, and it does run the
colour-clear locally: the `lk.field_kb` gate (`lk.java:3438`) only suppresses
the clear's network *notification*, not the clear itself. A live replica
therefore needs no ongoing correction.

Pushing an authoritative snapshot into such a board is actively harmful. `lk.a`
sets `field_U` from the packet unconditionally (`lk.java:5045`), and the
snapshot's `field_U` is typically **stale** — lower than the value the replica
already reached from relayed events. Applying it reverts cells the replica is
mid clear-animation on, so the next active piece overflows and the client sets
`lk.field_Bb = true` (`lk.java:6379`). Processing a later piece packet while
`field_Bb` is true but the board still has lives makes `qc.b`
(`qc.java:6489`) fail its consistency check and call `si.a(107)`, which nulls
`qc.field_s` — the client tears down its own server connection. The symptom is
a random mid-match disconnect with no game-over screen, the surviving side
awarded the win, and the player never losing a life.

**Rule: S2C 61 is for initial state only** — the match-start seed and spectator
join.

### 6.10 Reset, defeat and match termination

`lk.field_jb` is the remaining-life counter, not merely a participating flag.
It is initialized to 3. Finalizing a piece whose bitmap top is above the bucket
decrements it once. With lives remaining the original keeps eligible overflow
cells that can occupy the clamped top row and continues with another piece. At
zero it clears the active piece and the slot is defeated. A server that treats
the first overflow as defeat picks the wrong winner.

Winner selection is mechanical after that engine result: tombstone the defeated
stable slot, count the live slots, and when exactly one remains send S2C 62 for
the loser(s), then S2C 70 carrying the survivor's slot index to **everyone**,
then the teardown. No client packet reports a win.

| S2C | Framing | Body | Effect |
|---|---:|---|---|
| 65 | fixed 1 | `u8 slot` | Drain queued events, clear/reset that board, reset local round UI if applicable. |
| 62 | fixed 2 | `u8 slot, u8 result` | Drain the target stream, clear the board pointer and active-mask bit, decrement the live count, show defeat state if local. Result 0 renders "PLAYER N IS OUT". |
| 69 | fixed 1 | `u8 tempo_level` | Raises the in-game **"PANIC!"** banner and sets `qc.field_r`. The byte is a music tempo level (`qc.field_T`). **Not** a result packet. |
| 68 | fixed 1 | `u8 tempo_level` | Same shape with the **"SPEED UP!"** banner. |
| 70 | fixed 1 | `i8 winner_slot` | Announces the winner. Read signed: own slot → `YOU WIN!`, another valid slot → `<NAME> WINS!`, negative → `DRAW!`, `>=` roster length → the client dies with an `ArrayIndexOutOfBoundsException`. Broadcast to everyone. |
| 60 | fixed 0 | none | Tears down multiplayer/spectator game state. |

`qc.field_T`'s only consumer is `qc.b(boolean)` → `mb.a` → `ob.a(int, ui,
byte)`, a music playback rate, so no byte of 69 can produce a win screen.
Range-check the slot byte in S2C 70 before sending: an out-of-range value is a
client-killing array index, not a harmless unknown. "No winner" degrades to a
signed-negative byte for `DRAW!`.

Runtime strings, for matching a screenshot to an opcode: `cn.field_T` =
`YOU WIN!`, `fh.field_b` = `<%0> WINS!`, `ri.field_k` = `DRAW!`, `bn.field_c` =
`PANIC!`, `eb.field_c` = `SPEED UP!`, `a.field_e` = `<%0><br>IS OUT!`.

**S2C 60 must not be sent at match end at all.** Sending 62, 70 and 60 back to
back destroys the result screen in the same breath it is created; the match
flashes nothing and returns the player straight to the lobby. Send 60
per-session when that player leaves the result screen (C2S 62 `leave_game`, or
C2S 58, the lobby button), and retire the room only once the last player has
dismissed it. Sessions with no UI — bots and demo fixtures — must dismiss
themselves or they pin the room open forever.

S2C 62 is how other players' lost buckets disappear. It does not move any
surviving board to a new index.

### 6.11 Draw and rematch

C2S 61, 62 and 63 are three bare UI actions: 61 draw offer/cancel/accept, 62
resign, 63 rated/unrated rematch offer/cancel/accept. This is confirmed by the
menu action dispatch and its dynamic strings (`Offer draw`, `Cancel draw`,
`Accept draw`, and the rematch variants). C2S 63 is **not** a piece request.

S2C 71–74 are fixed one-byte mask/state updates used by those negotiations:

```text
71 -> draw-related mask field_d
72 -> scalar state field_h
73 -> rematch-related mask field_a
74 -> mask cleared from both field_d and field_a, also saved on qc
```

S2C 76 appends one signed byte to a small per-game ordering/result array.

Because the client's rematch choice is selected from the 71–74 masks and the
server has no sender for them, the exchange cannot currently complete even
though C2S 63 is received. The win menu proper — final scores, the highscore
table, the menu buttons — has also never been seen populated; no score payload
accompanies the result packets.

---

## 7. Authoritative server policy

Where the historical service cannot be recovered from the client,
`apps/server/` makes an explicit configuration-level choice. These are policy,
not claims about the original server:

- each enabled piece cell has a 1-in-12 special-item chance;
- returned feedback rotates to the next live opponent in stable-slot order;
- controls replenish at 50 ticks/s with a 40-tick burst;
- incoming feedback is settled immediately in the authoritative engine while
  the wire event lets clients present their warning/drop animation.

`apps/server/dekobloko_server/engine.py` is the Python port of the verified
Java active-piece/match engine. `HostedGame` retains, per immutable slot: an
authoritative board engine and active piece; elapsed-time control credit and
the last held input mask; current `field_U` and last acknowledged transition;
returned-feedback rotation state and incoming cooked solids; accepted ticks
since the last snapshot; and live/defeated state.

The implemented flow:

```text
on C2S 60:
    validate and decode masks
    admit at most the elapsed 50 Hz credit, capped at a 40-tick burst
    step the authoritative board once per admitted mask
    trim masks after landing and relay only accepted masks as S2C 63
    resynchronize the sender after a rejected or partially admitted batch
    if the authoritative board newly lands:
        activate placed special items and resolve bucket matches/chains
        target returned cooked shapes round-robin with S2C 67
        settle each shape on the target authoritative bucket
        allocate the next ordinary domino
        send exactly one S2C 64 transition

on C2S 59:
    accept only the matching per-slot transition counter
    ignore duplicate short lock-boundary batches for that transition
    send S2C 61 to the sender after a mismatched counter

on spectator join or reconnect:
    serialize every live stable slot as S2C 61

on board loss:
    send S2C 62 for its stable slot and tombstone the slot
    if one player remains, send S2C 70, then S2C 60 on dismissal
```

Fake players live outside the protocol package in
`apps/server/dekobloko_demo.py`. They implement the `LobbySession` surface and
register normally, so invite and kick resolution sees ordinary sessions rather
than name-based bot exceptions. Tests assert that
`dekobloko_server/__main__.py`, `game.py` and `lobby.py` contain no demo player
names or fixture dependency.

---

## 8. Verification harnesses

`OriginalMultiplayerProtocolTest` constructs S2C-61 payloads and passes them to
the untouched original `lk.a(boolean, wl, byte)` decoder. It steps both the
original `lk.d(int,int)` and the extracted `ActiveDomino.tick(int)` through the
same controls, comparing active cells, dimensions, position, rotation parity,
gravity/lock timers, forced-drop deadline, held/repeated input, and grounded and
landed state after every tick, then finalizes both and compares every bucket
cell. Fixtures cover an ordinary lock, recoverable overflow with lives
remaining, and terminal overflow on the last life. It runs with AWT/Swing
disabled.

```sh
./game-logic/build.sh
```

`apps/server/tests/test_authoritative_engine.py` runs the Python port through
the same control stream and compares every emitted tick state against the Java
engine trace covered by that differential. Server integration tests cover
initial and subsequent transition acknowledgements, real S2C-64 correction
fields, duplicate landing batches, final-life stable-slot removal, winner
notification, and teardown delivery.

**Reading decompiled control flow is not a substitute.** Conclusions drawn by
reading `bd.f` / `he` / `lg` / `cm` were contradicted by probes three separate
times, and the Huffman table construction and chat envelope were each got wrong
more than once by reading. The reliable technique is to load the client's own
classes and run them. `jk`, `uf`, `ki`, `de` and `sm` are package-private in
the default package, so a harness must live there too; point the classpath at
the built instrumented classes.

A parser harness proves less than it looks: injecting a candidate opcode-11
payload into `de.field_V` and calling `ki.a(0, false)` exercises only the
parser. Rendering happens later in `cl.a`, which can still throw — the `0x02`
chat payload parsed cleanly and then NPEd a live client. Every inbound proof in
this document is a field-decode / state-advance proof; painting (`gf.a`,
`mb.a`, `cl.b`, `ke`, `qc`) needs AWT and was not driven.

---

## 9. Unverified — do not guess

| Item | How to close it |
|---|---|
| The `te.field_v[]` enable gate was bypassed everywhere. Every inbound proof called its handler directly instead of going through `bd.f`. If login/bootstrap does not set `te.field_v[2]/[6]/[12]/[13]`, every reply is dropped and create-unrated, high-scores and achievement-sync all deadlock. | Replay the server's real login-success and bootstrap byte stream through the client's own `bd.f`/`te.field_v` initialization and assert the bits. This de-risks three blocking features at once. |
| The C2S opcode-3 framing collision being one opcode with two framings, and the `0x05` peek that disambiguates it. | Live capture: log the decrypted opcode and raw bytes of a hiscore-screen open versus a stat-generation event. |
| The play-rated outbound opcode number (candidate 11, alt 124). | JDWP breakpoint at `qm.java:393`; click *Play rated game* and submit, read local `param1`. |
| The play-rated S2C-58 `qc` body beyond §6.4 — the `qc` constructor pulls ~20 interleaved locals from prior in-game state and was never driven headless. | Build a candidate body, inject into `de.field_V`, spoof the in-game gate fields, drive the 58 branch headless, assert `kf.field_I != null && fm.field_b == true`. |
| The create-unrated `pn.a` per-occupant record (needed for `N>=1`) and the `q`/`z` create-vs-join semantics. | Feed candidate byte runs to `pn.a(63, wl)` and read `dj.Y`/`tj.Pb`/`oc.c`/`vm.s`; drive the real Create Unrated callback headless. |
| The social add/remove and quick-chat outbound opcode numbers (menu-threaded variables). | Drive the lobby menu-action descriptor init and read the stored action opcodes; this pins play-rated, social and quick-chat together. |
| Whether `0x8000` must be stripped from a relayed quick-chat id. | Test both verbatim and stripped through `ki.a`. |
| Lobby name-list end-to-end timing across the login→ISAAC transition, and whether it or `cl.x`/`kc.r` is the full roster. | Send the raw frame right after login-success against a live client and watch for desync. |
| High-scores `count>1` name-string path and `field_v>1` value mapping. | Run `ke.e` with `count=2` and `field_v=2`; observe `rc.field_c[col]` and `kc.field_u`. |
| Result-code text for S2C 62/68/69/70, and the post-game rating / return-to-lobby opcode. | Drive `mb.a` headless with varying `field_r`/`field_T`; capture the post-teardown sequence from a live match end. |
| The achievement `pe.a` checksum and `kn.field_o` value semantics. | A length-driven read consumes the 4 checksum bytes without recomputing; only reverse `pe.a` if a client validates it. |
| Private messages (`ai.java:310` "Send private message"), candidate opcode 14. | Drive the `ad.a`/`ce.a` PM path and confirm the Huffman body relay. |
| The exact `finalize_argument` vocabulary in S2C 64, and the shape dependency/reference policy spanning S2C 64/66/67. | Multi-client live trace. |
| The historical feedback-recipient rotation, whether any mode broadcasts to multiple opponents, and whether the original server proactively sent S2C 61 during a long match. | Reference-server capture. |
| The complete draw/rematch mask transition table for S2C 71–74/76. | A more complete executable `qc` dispatcher harness. |

None of these change the verified replica architecture, control stream, board
resync layout, or stable-slot removal behaviour.
