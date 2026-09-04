# Dekobloko Multiplayer Wire Protocol — Consolidated Specification

> The in-match 58--76 findings in this older consolidation have been
> superseded by the executable-engine audit in
> [Dekobloko multiplayer gameplay protocol](multiplayer-gameplay-protocol.md).
> In particular, the match-start body is now decoded, C2S 63 is rematch control
> rather than a piece request, and S2C 67 carries feedback shapes rather than
> ordinary next pieces.

Synthesis of seven per-feature investigations (play-rated, create-unrated, lobby-player-list, ignore-list, quick-chat, winning, high-scores, achievement-sync) plus the outbound/inbound opcode inventories. Every claim is tagged **PROVEN** (executed the client's own classes and/or read from ground-truth JAR bytecode) or **HYPOTHESIS** (read-only / inferred). The governing rule throughout: most client opcodes register an object on a `vj` queue and block until a reply pops it; `bd.g` re-drains queues each tick, so an unanswered request repeats forever. Every layout below nails **both** directions where the feature blocks on one.

---

## 1. Consolidated Opcode Table

### 1.1 Framing conventions

- The **opcode byte is always ISAAC-enciphered** in both directions (`uf.f` on write, deciphered by `PacketCodec` on read). On the wire, `byte0 = (plaintext_opcode + isaac_keystream) & 0xFF`. **All payload bytes are plaintext** — proven for every feature.
- Length-table kinds (mirroring `mk.field_c` / `CLIENT_PACKET_LENGTHS`): `N>=0` = fixed body of N bytes, **no length byte on the wire**; `-1` = one `u8` length byte follows the opcode; `-2` = one `u16` big-endian length follows the opcode.
- All multi-byte integers are **big-endian** (proven for every id/score/key field).

### 1.2 Client → Server

| Opcode | Framing | Sub-disc | Feature | Meaning | Status |
|---|---|---|---|---|---|
| **3** | **fixed 6** (no len byte) | `byte0 = 0x05` | high-scores | hiscore-table request `[05][00][u16 key][u8 rows][u8 vcols]` | **PROVEN** (ran `wb.a`) |
| **3** | **-1** (u8 len) | `byte0 = 0x01` | achievement-sync | stat/achievement record push | **PROVEN** (ran `fm.a`) |
| 7 | fixed 2 | — | create-unrated | room request `[u8 q][u8 z]` | **PROVEN** (ran `fh.a`/`ai.a`) |
| 11 *(candidate)* | -1 | `byte0 = 0x04` | play-rated | rated-game submit `[04][u8 gametype][0x80][body]` | layout PROVEN; **opcode # HYPOTHESIS** |
| *var* (via `sn.a`) | -1 | — | friend/ignore add/remove | `[u64 id][cstring name][u8][u8]` | layout PROVEN; **opcode # UNKNOWN** |
| *var* (via `ce.a`) | -1 | `channel` | quick-chat | `[u8 channel][cstring name if ch==2][u16 id]` | layout PROVEN; **opcode # UNKNOWN** |
| 58 | fixed 0 (bare) | — | winning/game | ready / start-my-game (gated on `gm.field_I`) | **PROVEN** (ran `uf.f(58)`) |
| 59 | fixed 1 | — | winning/game | move/turn ACK `[u8 value]` | **PROVEN** |
| 60 | -1 | — | game | gameplay move batch `[u8 count][bitpacked…]` | PROVEN framing (inventory) |
| 61 | fixed 0 (bare) | — | game | game-control (`qc.b`) | **PROVEN** (bare) |
| 62 | fixed 0 (bare) | — | winning | resign / leave active game (`qc.f`) | **PROVEN** (bare) |
| 63 | fixed 0 (bare) | — | game | rematch offer/cancel/accept (`qc.c`); not a piece request | **PROVEN** (bare + menu strings) |
| 14 *(candidate)* | -1 | — | private-messages | PM send `[u64 target][body]` (inventory only) | **HYPOTHESIS** |

### 1.3 Server → Client

| Opcode | Framing | Sub-disc | Feature | Meaning | Status |
|---|---|---|---|---|---|
| **2** | -2 | `sub = 0` | high-scores | hiscore table / roster | **PROVEN** (ran `ke.e`) |
| **2** | -2 | `sub = 1` | achievement-sync | record ACK `[01][u16 key][i64 val]` | **PROVEN** (ran `ke.e`) |
| 6 | -2 | — | create-unrated | room membership `[u8 disc][u8 N][…]` | **PROVEN** (ran `ul.a`) |
| 11 | -1 | — | (chat) | free-text chat (Huffman body) | PROVEN adjacent |
| 12 | -1 | — | quick-chat | canned-phrase line (`[…][u16 id]`) | **PROVEN** (ran `ki.a`, `bd.f` dispatch) |
| **13** | -1 | `mode = 0` | friend-list | friend entry | **PROVEN** (ran `oe.c`) |
| **13** | -1 | `mode = 1` | ignore-list | ignore entry | **PROVEN** (ran `oe.c`) |
| **13** | -1 | `mode = 2/3/4` | friend/ignore | list-complete / dirty flags | **PROVEN** (bytecode) |
| 58 | -2 | — | play-rated | start own multiplayer game (`qc` descriptor) | dispatch PROVEN (bytecode); **body layout HYPOTHESIS** |
| 59 | -2 | — | play-rated | start spectator game | bytecode |
| **60** | **0 (MISSING — add `60:0`)** | — | winning | game teardown / game over (no body) | **PROVEN** (ran `wl.d`, bytecode) |
| 62 | fixed 2 | — | winning | remove/defeat one player `[u8 slot][u8 result]` | **PROVEN** |
| 69 | fixed 1 | — | winning | winner / you-won `[u8 result]` | **PROVEN** |
| *(raw, non-ISAAC)* | inline u16 | frameCode 100–105 | lobby-player-list | occupant name list on the **login connection** | **PROVEN** (ran `qb.a`) |

Background/infra server→client opcodes handled by `bd.f` (from the inbound inventory, not feature-specific): `0` keepalive, `1` `ua.i`, `4` `cm.a`, `5` `pe.b`, `7` logout/bounce (`bd.i`), `8` dynamic class loader (`qn.a`), `16` MOTD string (`wm.d`), `17` URL/dialog (`bd.l`), `18` flag toggle (`ne.c`). `bd.f` gates every dispatch on the 64-entry `te.field_v[]` enable table and only covers opcodes 0–18; the in-game 58–76 space is handled by the monolithic `client.java` tick reader on `bh.field_k`, **not** `bd.f`.

### 1.4 Opcode collisions and their resolution

1. **Client→server opcode 3 (high-scores vs achievement-sync).** THE critical collision. Both were execution-proven to emit plaintext opcode 3, but with **incompatible framing**:
   - high-scores (`wb.a`): **no length byte**, fixed 6-byte body, `byte0 = 0x05`.
   - achievement-sync (`fm.a`): **one u8 length byte**, then `sub = 0x01`.
   
   A single static `CLIENT_PACKET_LENGTHS[3]` entry cannot serve both. **Resolution:** the server must special-case opcode 3 by peeking the byte immediately after the (deciphered) opcode. If it equals `0x05`, frame as fixed 6 (hiscore). Otherwise treat it as a u8 length (achievement) and expect `payload[0] == 0x01`. This peek is safe because the two sub-command bytes (`0x05` vs a length value whose following byte is `0x01`) never alias for realistic short bodies. **Flag for live confirmation:** it is genuinely unusual for two writers to share one opcode with different framing; a JDWP/live capture should confirm whether they really both emit 3 (both `iconst_3` reads in the JAR say yes) before this is trusted in production.

2. **Server→client opcode 2 (high-scores table vs achievement ACK).** Shared handler `ke.e`, discriminated by the leading `sub` byte: `sub=0` = hiscore/roster table, `sub=1` = 11-byte achievement ACK. Framing is uniform (`-2`, u16 length) so **no conflict** — one length entry serves both.

3. **Server→client opcode 13 (friend vs ignore vs list-flags).** Shared handler `oe.c`, discriminated by the leading `mode` byte: `0`=friend (has an extra flag byte), `1`=ignore (3 cstrings), `2/3/4`=list control. Uniform `-1` framing, no conflict.

4. **Opcode 62 exists in BOTH directions with different meaning.** Client→server 62 = resign (bare). Server→client 62 = defeat/remove-player (fixed 2). Direction disambiguates; no table conflict.

5. **Server→client opcode 6 is reconnect-storm-flagged.** Correct and required as the answer to a pending client opcode 7, but must **never** be sent speculatively/unprompted.

---

## 2. Per-Feature Specifications

### 2.1 create-unrated *(fully PROVEN both directions)*

Cleanest request/reply pair; use it as the template.

**Outbound — client opcode 7** (`ai.a` → `fh.a`, `fh.java:79`). 3 bytes total, no length byte:
```
[enc-op 7][u8 q = cl.field_q][u8 z = cl.field_z]
```
Observed wire (q=0, z=10, zero ISAAC): `45 00 0A`. `ai.a` first **registers a pending `cl`** on the `oe.I` queue keyed by `cl.field_q`, then sends — the feature is now blocked on that queue.

**Inbound — server opcode 6** (`ul.a`, `-2` framing). Payload:
```
[u8 disc][u8 N] then, only if N>0, occupant data
```
- `disc` **MUST equal the request's `q`** or the client calls `si.a(122)` and **disconnects** (proven by mismatch control).
- `N` = occupant count. `N==0` is the proven early-out that still **finalizes the room** (`cl.field_A=true`, `cl.b()`), showing an empty occupant list.
- **CORRECTION over hypothesis:** the empty sentinel is `N==0`, not `0xFF` (read unsigned via `uf.d`, branch is `~N==-1`). Sending `0xFF` makes the client read 255 occupants and overrun.
- Minimal proven-coherent reply: `[disc=q][00]`.

**State transition:** client on room screen fires 7 → server echoes 6 with `disc==q` → `cl.field_A=true` → create-unrated unblocks. **HYPOTHESIS:** the `q`/`z` semantics (create vs join, rated vs unrated) were only driven at `q=0, z=10`; the create-vs-join flag was not isolated. The multi-occupant `pn.a` per-record byte layout (for `N>=1`) is **UNRESOLVED** — ship `N=0` only.

---

### 2.2 play-rated *(outbound layout PROVEN; opcode # and inbound body HYPOTHESIS)*

**Outbound** (`ad.a`, `ad.java:201`, the same call `qm.a:393` issues). Bytes read out of the client's own buffer for `ad.a(body={1,2,3}, op=99, true, gametype=8, 0, true)`: `56 06 04 08 80 01 02 03`. Layout:
```
[enc-opcode]          # data-driven; candidate 11 (see below), NOT literal in JAR
[u8 length]           # count of following bytes (=6 for a 3-byte body)
[u8 0x04]             # fixed sub-command discriminator
[u8 gametype]         # hd.field_u (default 8)
[u8 0x80]             # flag = param4|128
[byte[] body]         # ne.field_c lobby game-options blob (opaque)
```
Proven by running `ad.a` twice (op 99→`0x56`, op 100→`0x57`, delta 1) — only the opcode byte varies with ISAAC. `ad.a` registers **nothing** on a `vj` queue: this is a fire-and-send matchmaking request, not a queue-blocking one.

**Opcode number (HYPOTHESIS = 11, alt 124).** Data-driven, threaded `ph.a param9 → qm.a param1 → ad.a param1`. Static tracing narrows it: `th.java:26` threads literal **11** on the lobby-entry path; `ph.n` threads **124**. Must be confirmed by JDWP at `qm.java:393` after clicking *Play rated game* + submit. This refutes the old "literal 11 at `ad.a:207`" claim (no literal lives there) while keeping 11 as the live static candidate.

**Inbound — server opcode 58** (`-2`). Dispatch PROVEN by bytecode (`client.class` 4912–4940): sets `kf.field_I = new qc(...)`, `fm.field_b = true`, fires `eb.a(58)`; opcode 59 is the spectator twin (`ce.field_C`, `fa.field_n=true`). **Body layout is a GUESS** (`u16 settings`, `u16 game_id`, `u8 theme`, `u8 player_count`, `i8 local_slot`, N jagex-strings, `u8 active_mask`) reverse-guessed from `qc` field order — the `qc` ctor pulls ~20 interleaved locals from prior in-game state and was never driven headless. Because 58 is `-2` the client reads exactly `length` bytes, so a byte-count mismatch will not desync the stream, but the `qc` ctor can throw. **Open:** whether the server must first push opcode 6 (room membership) before 58 — untested; try 58-alone first, never send 6 speculatively.

---

### 2.3 lobby-player-list *(inbound PROVEN; a RAW non-ISAAC frame)*

Server push on the **login/lobby connection**, read by `qb.a` (the login state machine), **NOT** by the ISAAC `bd.f` loop. Entirely raw bytes — must **not** go through `encode_server_packet` / `SERVER_PACKET_LENGTHS`.

Proven wire (fed to `qb.a`, decoded to `[Alice,Bob,Carol]`):
```
67 00 13 00 41 6C 69 63 65 00 00 42 6F 62 00 00 43 61 72 6F 6C 00
```
```
[u8 frameCode = 100 + nameCount]   # nameCount 0..5 (HARD CAP)
[u16 BE blobLen]                   # byte length of the names blob
nameCount x [ 0x00 | cp1252(name) | 0x00 ]   # mandatory 0x00 prefix + terminator
```
**CORRECTIONS over hypothesis:** length is **u16** (2 bytes via `wl.e(3)`, whose mode selector folds to 8), not u24; and each name has a **mandatory leading `0x00`** in addition to the terminator (`wl.b(true)` throws `IllegalStateException` without it). Fills static `ph.Eb` (String[]) + transitions `ph.xb: kb.c → ll.a`; return value = `nameCount+100`. `si.a(60)` fires as a post-list redraw signal (names stored before it).

**HYPOTHESIS / risk:** the 5-name cap suggests this is a *friends/online preview*, not a full roster; a large roster likely uses the separate `cl.x` (op 6) or `kc.r` (op 2) models. The title `rk.Y` is a **different** frame (read via `wl.c(-38)`, `0xFF`-terminated, in the `rb.f` path). Render (`gf.a` → `da.e.db`/`sn.k.W`) not driven. **Highest risk:** end-to-end timing across the login→ISAAC transition was not proven — the raw frame must be sent contiguously right after the login-success response and before any ISAAC packet, or the client mis-reads it.

---

### 2.4 ignore-list + friend-list *(both directions PROVEN)*

One server→client opcode (**13**, handler `oe.c`) serves friend and ignore, discriminated by the leading `mode` byte. One client→server writer (`sn.a`) serves add/remove for both, differing only in a menu-supplied opcode constant.

**Inbound — server opcode 13** (`-1`, already in `SERVER_PACKET_LENGTHS`, `te.field_v[13]` enabled). One entry per packet.

Ignore (mode=1), proven by running `oe.c` on `01 00 46 6F 6F 00 57 6F 72 6C 64 31 00`:
```
[u8 mode=1][cstring prevName]  [cstring name]  [cstring world]
```
`prevName=""` → stored `null` (`wb.field_Vb`); `name` → `wb.field_Ob` + hashtable key; `world` → `wb.field_Tb`. Sets `md.field_Z++`, allocates `mc.field_a=new nk(128)`, enqueues `wb` on `qi.field_S` (id 2777).

Friend (mode=0) — **note the extra flag byte the ignore branch lacks**:
```
[u8 mode=0][u8 flag][cstring name][cstring displayName ONLY if flag==1][cstring world]
```
Populates `hg.field_e`/`ed.field_g`/`uf.field_z`; `wb.field_Pb=displayName`.

List control (mode=2/3/4): toggles static `jj.field_b` (list-complete/dirty); mode=4 reads an extra cstring + u8. Send a mode=2 packet after the entries as the "transfer complete" marker.

**Outbound — via `sn.a`**, proven for `sn.a(0x1122334455667788, op=0x2A, "Foo", 97, true, 5)` → `1d 0e 11 22 33 44 55 66 77 88 46 6F 6F 00 05 01`:
```
[enc-opcode]              # ISAAC-enciphered (CORRECTION: hypothesis said raw)
[u8 length]               # back-patched (=14 here)
[u64 targetId BE]         # pd.field_f.field_Tb; may be 0 for typed name
[cstring name]
[u8 param5]               # mg.c(497,…) menu/state index — semantics TBD
[u8 flag]                 # mg.e(5658)?1:0 — online/visibility — semantics TBD
```
**Opcode number is UNKNOWN** — traced as a threaded parameter through **5 levels** (`sn.a param1 ← ji.a arg0 ← lk.a arg2 ← th.a param1 ← lk.a arg2`), no literal anywhere; it originates in the right-click menu-action descriptor (classic RS pattern). Friend-add, ignore-add and remove all reuse `sn.a` differing only in this constant. It is **fire-and-forget** (`ji.a` nulls `pd.field_f` right after send) — an unanswered add does **not** storm; the only symptom is the name never appearing until the server echoes an opcode-13 packet. The client does **not** insert locally — the server must echo each add as opcode 13 or the screen stays empty.

---

### 2.5 quick-chat *(both directions PROVEN except the outbound opcode number)*

**Inbound — server opcode 12** (`-1`). Dispatch PROVEN from `bd.f` bytecode (`iload_2; bipush 12; if_icmpeq → bl2=1 → ki.a(0,true)`); opcode 11 = free text. This **supersedes** the stale `packets.py` note that "opcode 12 is discarded at bd.java:974". Layout (channel 0, single name):
```
[u8 flags]      # mf.R = flags&127 (channel); flags&0x80 -> fm.f MUST be clear
[u8 tg.c]       # MUST be 1 or the name renders as "null"
[u64 fc.h]
# IF channel==2: [u16 vl.k BE][u24 ic.a]           (bytecode-read, not executed)
[u8 var4]       # 0 => reuse one name; 1 => a second name cstring follows
[cstring ad.x]  # speaker name
# IF var4==1: [cstring sa.B]
# IF channel==1 or 4: [u16 dh.d BE][cstring qm.e]
[u16 id BE]     # wj.Qb.a(127,id).me.f(-61) -> ib.pb text
```
Only the `u16 id` is on the wire; the **text lives in the client's own `wj.Qb` sm table**. Proven by running `ki.a(0,true)` (all header fields decoded) and `me.f(-61)` (returned the canned string from a constructed table). `ib.pb` came back null in-harness only because `wj.field_Qb` was unpopulated (expected off-cache).

**Outbound — via `ce.a`** (freetext==null branch), proven bytes: channel0/id5 → `[enc-op] 03 00 00 05`; channel2/Bob/0x1234 → `[enc-op] 07 02 42 6F 62 00 12 34`:
```
[enc-opcode][u8 len][u8 channel][cstring name ONLY if channel==2][u16 id BE]
```
**NEW (bytecode):** the F10-menu caller `ig.a` computes `id = Nb[menuIndex] | 0x8000`, so the wire id has bit `0x8000` set. **Opcode number is UNKNOWN** — a runtime variable (`iload`) in `ce.a` and both callers; likely **different** from 12 (12 is already the server→client / free-text send). The CFR-invented `ce.a(15,…)`/`ce.a(12,…)` literals are decompiler inventions.

**Behavior:** quick-chat is a push, no queue — no stall risk, but the client does not echo locally, so the server **must broadcast back to the sender too** or it looks dead. Server relays the received id **verbatim** (with `0x8000` set) since `ki.a` does not mask on read.

---

### 2.6 winning *(both directions PROVEN; result-code semantics HYPOTHESIS)*

Server-adjudicated; no "I won" packet. In-game opcodes 58–76 are handled by the monolithic `client.java` tick reader on `bh.field_k`, not `bd.f`, on the same game socket.

**Outbound (all PROVEN via the client's own `uf` writer + `Instr` log):**
| Call | Bytes | Meaning |
|---|---|---|
| `qc.f` | `[62]` bare | resign / leave active game |
| `qc.b` | `[61]` bare | game control |
| `qc.c` | `[63]` bare | game control |
| `uf.f(59,-4)+wl.a(true,v)` | `[59][u8 v]` | move/turn ACK |
| `uf.f(58,-4)` | `[58]` bare | ready (gated on `gm.field_I`) |

**Inbound (PROVEN via the client's own `wl.d` reader + bytecode of the same `.class`):**
```
op 62  = [u8 player_slot][u8 result]   # result -> qc.field_T; slot eliminated
         (field_p[i]=null, field_d bit clear, field_i--);
         if slot==field_P (local): cd.a(true)+ob.field_k=true+defeat UI
op 60  = [] no body                    # teardown: clears fm.field_b/am.field_c/
         fa.field_n/wk.field_i, cd.a(true)/un.a/jg.a -> back toward lobby
op 69  = [u8 result]                    # -> qc.field_T; qc.field_r=true (you-won)
```
Verified reads: op62 `[player=3][result=5]` → `qc.field_T=5`; op69 `[9]` → `qc.field_T=9`.

**Ordering (critical):** send all **62/69 result signals first, then 60 last** — 60 tears down `qc`, so a 62/69 arriving afterward has no live game object to mutate (NPE). **HYPOTHESIS:** the `result` byte value→text mapping (win vs placement vs reason) was never driven through `mb.a`; treat `field_T` as opaque. The post-teardown rating/return-to-lobby update rides `bd.f` (candidate op 2 roster-with-ratings or op 6), a separate follow-up not exercised.

**COHERENCE GAP:** opcode 60 is **absent** from `SERVER_PACKET_LENGTHS`; the client reads zero body, so it must be framed fixed length 0. **Add `60: 0`.**

---

### 2.7 high-scores *(both directions PROVEN; key width CORRECTED to u16)*

**Outbound — client opcode 3, sub 0x05** (`wb.a`). Proven bytes: `03 05 00 00 00 0A 01` (key=0), `03 05 00 00 07 0A 01` (key=7). Fixed 6-byte body, no length byte:
```
[enc-op 3][0x05][0x00][u16 BE field_n = board key][u8 field_o = rows][u8 field_v = value cols]
```
`am.a` enqueues the `kc` on `dg.field_e` — the reply pops it by matching `field_n`.

**Inbound — server opcode 2, sub 0** (`ke.e`, `-2`, already correct in table). Proven-accepted payload `00 00 00 01 01 00 00 00 00 00 00 00 03 E7 00 00 00 05` → `kc.field_p=true`, `kc.field_t[0][0]=999`, `kc.field_u[0][0]=5`:
```
[u8 subtype=0]
[u16 BE key]              # CORRECTION: u16 (uf.e(3) folds to 8), NOT int32; MUST echo field_n
[u8 count]               # columns incl. col0=local player; 0 => skip record
for col in 1..count-1:   # (skipped when count==1 — the proven case)
    [cstring name -> rc.field_c[col].field_i]
    [u8 flag; if 1: cstring second -> rc.field_c[col].field_f]
[u8 entryCount]
per entry:
    [u8 columnIndex]
    [i64 BE score -> kc.field_t]
    [field_v x i32 BE value -> kc.field_u]
# terminator: kc.field_p=true, kc.b()
```
`score` = int64 BE, `value` = int32 BE (both proven with pattern bytes). **Key-width regression is the top risk:** sending an int32 key (the original hypothesis) desyncs every later field. **HYPOTHESIS (read-only):** the `count>1` name-string path and `field_v>1` value mapping were never executed (only `count=1, field_v=1`); `subtype=1` is a separate personal-best branch, `subtype>=2` undecoded.

---

### 2.8 achievement-sync *(both directions PROVEN; several widths CORRECTED)*

**Outbound — client opcode 3, sub 0x01** (`fm.a`). Proven 38-byte frame (`count=2`): `F6 24 01 0000 1234 ABCD 0A0B0C0D 11121314 21222324 31323334 02 41424344 51525354 2A5A5918`:
```
[enc-op 3]                 # 0xF6 = (3 + isaac 0xF3); plaintext opcode = 3
[u8 length]                # count of ALL following bytes INCLUDING the 4-byte checksum (0x24=36)
[u8 sub=1]
[u16 BE kn.field_u]        # client auto-increment correlation id (65535 & dk.field_a++)
[u16 BE kn.field_x]
[u16 BE kn.field_q]
[i32 BE kn.field_t]        # CORRECTION: 4 bytes, NOT a flag byte
[i32 BE kn.field_v]
[i32 BE kn.field_w]
[i32 BE kn.field_y]
[u8 count = kn.field_s.length]
count x [i32 BE kn.field_s[i]]   # CORRECTION: 4 bytes each, NOT u8
[i32 BE checksum]          # NEW: pe.a XOR/iand-255 rolling hash; length byte counts it
```
`qb.a` enqueues the `kn` on `pb.field_c` **before** sending — this is a **blocking request** (flushed each tick from `bd.java:1443`/`client.java:2021`), so an unacked record repeats forever.

**Inbound — server opcode 2, sub 1** (`ke.e`, `-2`). Proven: `01 AB CD 11 22 33 44 55 66 77 88` → `kn.field_o = 0x1122334455667788` exactly, `kn` popped from `pb.field_c`, `kn.b(101)` reached. 11-byte payload:
```
[u8 sub=1][u16 BE key][i64 BE value]
```
**CORRECTION:** the 8-byte value is straight big-endian (MSB first), not low-dword-first. Key correlates on `kn.field_u`. **Order-sensitive hazard:** `ke.e` pops non-matching queued `kn` while scanning, so an ACK whose key **skips** a still-pending record silently discards the intervening ones — **ACK every push exactly once, in arrival order, echoing the received `u16` verbatim.** `value` semantics (timestamp/score/id) are HYPOTHESIS; `0` marks the record synced.

---

## 3. Lobby / Game Lifecycle State Machine

All feature traffic (except the raw name-list frame) rides the **single authenticated game connection** carrying the ISAAC codec (`GameSession._run_packet_loop`). The login/JS5/HTTP connections are separate; the lobby name-list frame is the only feature riding the **login connection** (raw, pre-ISAAC).

```
LOGIN  ── qb.a state ba.f sends RSA/XTEA login block (login conn, raw)
   │        server parses (parse_login_body)
   ▼
LOGIN-RESPONSE (raw, still on login conn, qb.a state kb.c)
   │   server writes: [code 0 login-success]  then IMMEDIATELY
   │                  [raw name-list frame 100+N …]   (lobby-player-list)
   │   (must be one contiguous write, BEFORE any ISAAC packet)
   ▼
LOBBY  (ISAAC bd.f loop now active; te.field_v gates dispatch)
   │   server may push (only when client-ready, never speculatively):
   │     op 13 mode 0/1  friend/ignore entries  + mode 2 list-complete
   │   client may send (request/reply, blocks on a vj queue):
   │     op 3 sub 05  hiscore request      → server op 2 sub 0 (echo key)
   │     op 3 sub 01  achievement push     → server op 2 sub 1 (echo seq)  [blocks pb.c]
   │     op 7         room request [q][z]  → server op 6 [disc==q][N]      [blocks oe.I]
   │     op <var>     social add/remove    → server op 13 echo             (fire&forget)
   │     op <var>     quickchat send       → server op 12 broadcast (incl. sender)
   ▼
CREATE / JOIN
   │   op 7 → op 6 finalizes the cl room (cl.field_A=true)
   │   play-rated: op 11(?) sub 04 submit → server op 58 (qc descriptor)
   ▼
IN-GAME  (opcodes 58–76 on the SAME socket, handled by client.java tick reader,
          NOT bd.f, NOT te.field_v-gated; direct qc mutation, no queue)
   │   client: op 58 ready, op 59 move-ACK, op 60 move-batch, op 61/63 control,
   │           op 62 resign
   │   server (match end): op 62 [slot][result] per loser, op 69 [result] to winner,
   │           THEN op 60 [] to ALL (teardown)  ← 60 LAST
   ▼
BACK TO LOBBY  (op 60 restored lobby state; rating/roster update via bd.f op 2/6)
```

**Governing-rule reminders per transition:**
- Requests that register a `vj` queue and **block until popped**: op 3 (both subs → `pb.c`/`dg.e`), op 7 (→ `oe.I`), op 1/4/5 infra. Failing to answer any of these = infinite re-drain storm.
- Requests that are **fire-and-forget** (no queue): social add (`sn.a` nulls `pd.field_f`), quickchat, resign 62, play-rated submit (`ad.a` registers nothing). No storm, but the feature silently never advances without the corresponding server push.
- **Never send speculatively:** op 6 (reconnect-storm-flagged) — only as the answer to a pending op 7.
- **te.field_v gate:** `bd.f` (opcodes 0–18) drops any opcode whose `te.field_v[]` bit is false; the bits are built incrementally during login/bootstrap. Push op 2/6/12/13 only after login-success + client-ready. In-game 58–76 bypass this gate entirely.

---

## 4. Server Implementation Plan (apps/server)

Ordered so each step is independently testable with a library harness (`/home/kreijstal/.claude/jobs/720d2707/tmp/huff`) **before** it touches the wire. Highest-value / lowest-risk first.

**Step 0 — length-table corrections (load-bearing, do first).** In `packets.py`:
- `SERVER_PACKET_LENGTHS`: **add `60: 0`** (teardown, fixed empty). Leave `2:-2`, `6:-2`, `13:-1`, `62:2`, `69:1`, `58:-2`, `59:-2` untouched (all ground-truth-correct).
- `CLIENT_PACKET_LENGTHS`: **add `7: 2`** (create-unrated; without it the ISAAC keystream desyncs on the first op 7). Confirm `58:0, 59:1, 60:-1, 61:0, 62:0, 63:0` present.
- **Opcode-3 collision:** do **not** add a single static entry. Special-case in `read_client_packet`: after deciphering opcode 3, peek the next byte — `0x05` → fixed 6-byte frame (hiscore); else → u8 length (achievement, expect `payload[0]==0x01`).
- Harness test: none needed — this is table data; verify by replaying the proven capture bytes through `read_client_packet` and asserting no desync.

**Step 1 — create-unrated (fully proven, template).**
- `packets.py`: `build_room_membership(room_id, occupant_count=0)` → `[room_id][occupant_count]` (ship `occupant_count=0` only).
- `game.py`: `if packet.opcode == 7:` read `q=payload[0]`, `z=payload[1]`, `_ensure_lobby_bootstrap`, `LOBBY.handle_room_request(self, q, z)`.
- `lobby.py`: `handle_room_request` creates/resolves the room, then `session._send_packet(6, build_room_membership(q, 0))` — **echo `q` as disc** (mismatch → client disconnect).
- Harness: re-run `H_create_unrated.java`; assert `cl.field_A==true` for `[q][0]` and disconnect for `[wrong][0]`.

**Step 2 — winning result signals (proven).**
- `packets.py`: keep `send_player_removed` (op 62). Add `send_winner(result)` (op 69, 1-byte) and `send_game_over()` (op 60, empty).
- `game.py`: add `if packet.opcode == 61: continue` no-op (so the bare control packet isn't fed to the chat parser). Add the two send helpers.
- `lobby.py`: `HostedGame.end_game(...)` fans out 62 per loser, then 69 to winner, then 60 to all — **62/69 before 60**. Wire the resign path so a resign that leaves one player routes through `end_game`.
- Harness: `H_winning.java` already proves the byte layouts; assert ordering in a unit test.

**Step 3 — high-scores (proven, watch key width).**
- `packets.py`: `build_hiscore_table(key, vcols, entries)` — `[00][u16 key][count][entryCount][per entry: colIndex, i64 score, vcols×i32]`. **Echo the u16 key verbatim.**
- `game.py`: opcode-3 handler branch keyed on `payload[0]==0x05`; parse `key/rows/vcols`, call `LOBBY.hiscore_rows`, reply `_send_packet(2, build_hiscore_table(...))`.
- Harness: `H_high_scores.java`; assert `kc.field_p==true`, `field_t/field_u` populated. Ship `count=1` only.

**Step 4 — achievement-sync (proven, order-sensitive).**
- `packets.py`: `build_achievement_ack(key, value)` → `[01][u16 key][i64 value]`.
- `game.py`: opcode-3 branch keyed on `payload[0]==0x01`; parse seq, immediately `_send_packet(2, build_achievement_ack(seq, 0))`. **ACK 1:1, in order, echo seq verbatim.**
- Harness: `H_achievement_sync.java`; assert `kn.field_o` set and `pb.field_c` popped.

**Step 5 — ignore-list / friend-list (inbound proven, outbound opcode unknown).**
- `packets.py`: `build_ignore_entry`, `build_friend_entry`, `build_social_list_complete` (op 13; already `-1`).
- `game.py`: `send_ignore_list`/`send_friend_list` helpers. Add a **diagnostic branch** logging any unhandled inbound packet whose payload is `u64 + cstring + exactly 2 trailing bytes` (the `sn.a` signature) — this reveals the real social opcode from a live click. Match social opcodes by number **before** the chat/text fallbacks or an add is misread as chat.
- Harness: `H_ignore_list.java`; assert `md.field_Z`/`mc.field_a` (ignore) and `ed.field_g`/`hg.field_e` (friend).

**Step 6 — quick-chat (inbound proven, outbound opcode unknown).**
- `packets.py`: `build_quickchat_broadcast(name, qc_id, channel=0)` → `[flags][tg.c=1][u64][var4=0][name\0][u16 id]`. Correct the stale "opcode 12 discarded" comment.
- `game.py`: quickchat handler branch (opcode TBD from live capture) → broadcast op 12 to all peers **including sender**. Relay the id verbatim.
- Harness: `H_quick_chat_in.java`; assert header decodes; only ship channel 0.

**Step 7 — lobby-player-list (raw frame, timing risk).**
- `packets.py`: `build_lobby_name_list(names)` — RAW `[100+N][u16 blobLen][per name 0x00+bytes+0x00]`, **not** through `encode_server_packet`; cap 5 names.
- `game.py`: `send_lobby_name_list` writes raw via `sock.sendall`; call it in `_handle_seeded_login` **immediately after** `_send_login_success` and **before** any ISAAC packet.
- Harness: `H_lobby_player_list.java` proves decode; the raw-over-socket + login→ISAAC transition is the untested part — validate against a live client, be ready to fall back to a separate lobby connection or the ISAAC roster path if it storms.

**Step 8 — play-rated (both ends partly hypothesis, do last / guarded).**
- Only after JDWP-confirming the outbound opcode (`qm.java:393`) and reversing the op-58 `qc` body. Until then: route any inbound whose payload starts with `0x04` to a logged `start_rated_game`, reply op 58 with the best-guess body **only after** driving `H_playrated` inbound headless to prove `kf.field_I!=null && fm.field_b==true`. Try 58-alone; never send 6 speculatively.

---

## 5. Still Unverified — Do Not Guess

Each item lists the exact harness/action that would close it.

| # | Unproven item | How to close it |
|---|---|---|
| 1 | **Opcode-3 framing collision** really being one opcode with two framings. | JDWP/live capture: log the decrypted opcode + raw bytes of a hiscore-screen open vs a stat-generation event; confirm both are 3 and the peek (`byte==0x05`) disambiguates. |
| 2 | **play-rated outbound opcode number** (candidate 11 / 124). | JDWP breakpoint at `qm.java:393`, click *Play rated game* + submit, read local `param1`; or drive the `mf.a` lobby init headless and read `o.field_a`'s stored action opcode. |
| 3 | **play-rated op-58 `qc` body layout.** | Reconstruct from `client.java:844–1367`, build a candidate body, inject into `de.field_V`, spoof the in-game gate fields, drive the 58 branch headless; assert `kf.field_I!=null && fm.field_b==true`. |
| 4 | **create-unrated `pn.a` per-occupant record** (needed for `N>=1`). | Feed candidate byte runs to `pn.a(63, wl)` and read `dj.Y`/`tj.Pb`/`oc.c`/`vm.s` after each. Ship `N=0` until reversed. |
| 5 | **create-unrated `q`/`z` semantics** (create vs join, rated vs unrated). | Drive the actual "Create Unrated" button callback headless; compare `q`/`z` against the screen-entry `ai.a(7,10,…)` values. |
| 6 | **social add/remove/friend opcode numbers** (`sn.a` variable). | Live capture of an "Add to ignore list" / "Add friend" / remove click; or drive the fully-populated menu UI headless and read the byte `uf.f` writes. |
| 7 | **quick-chat outbound opcode number** (`ce.a` variable) and whether `0x8000` must be stripped on echo. | Drive the F10 menu callback under AWT, or live-capture a quickchat send; test both verbatim and stripped id through `ki.a`. |
| 8 | **lobby name-list end-to-end timing** across login→ISAAC. | Send the raw frame right after login-success against a live client; watch for desync/storm. Also disambiguate whether this 5-name list or `cl.x`/`kc.r` is the full roster. |
| 9 | **high-scores `count>1` name-string path and `field_v>1` mapping.** | Run `ke.e` with `count=2` (name+flag+optional second cstring) and `field_v=2`; observe `rc.field_c[col]` and `kc.field_u` columns. |
| 10 | **winning result-code → text mapping** (`qc.field_T`). | Drive `mb.a(field_r, …, field_T, …)` headless with varying `field_r`/`field_T`; map codes to the rendered win/lose/placement line. |
| 11 | **post-game rating / return-to-lobby opcode** (op 2 roster-with-ratings vs op 6). | Capture the post-op-60 sequence from a live match end; drive the winning `bd.f` follow-up. |
| 12 | **`te.field_v[2/6/12/13]` enabled at push time.** | Confirm the login/bootstrap packets set the enable bits before the corresponding server push; the harnesses bypassed `bd.f` by calling handlers directly. |
| 13 | **Renderer proof for every inbound feature.** | All inbound proofs are *field-decode / state-advance* only (`ib.pb`, `kc.field_p`, `cl.field_A`, `ph.Eb`, etc.). Painting (`gf.a`, `mb.a`, `cl.b`, `ke`, `qc`) needs AWT and was not driven — a correct decode does not prove the screen paints. |
| 14 | **achievement `pe.a` checksum** and `kn.field_o` value semantics. | A length-driven server read consumes the 4 checksum bytes without recomputing; only reverse `pe.a` if a future client validates it. `field_o` value meaning (timestamp/score/id) needs a live client that displays it. |
| 15 | **private-messages** (inventory only, not investigated). | Drive the `ad.a`/`ce.a` PM path (`ai.java:310` "Send private message"); confirm opcode (candidate 14) and Huffman body relay. |

---

## 6. Adversarial review — where this spec overclaims

Ranked by severity. These qualify the PROVEN tags above; the numbered
"how to close it" harnesses are in §5.

1. **[BLOCKER] The `te.field_v[]` enable gate was bypassed everywhere.** Every
   inbound proof called its handler directly (`ke.e`, `ul.a`, `oe.c`, `ki.a`)
   instead of going through `bd.f`. If login/bootstrap does not set
   `te.field_v[2]/[6]/[12]/[13]`, every reply is dropped and all three
   "fully proven" blocking features (create-unrated, high-scores,
   achievement-sync) deadlock. See §5 item 12.
2. **[BLOCKER] Opcode-3 collision.** `wb.a` writes a fixed 6-byte frame,
   `fm.a` a length-prefixed one; the two source specs demand
   `CLIENT_PACKET_LENGTHS[3] = 6` and `= -1` respectively. The "peek `0x05`"
   disambiguation is synthesis that was never executed, and it was never shown
   both writers fire in one session. A wrong peek storms both features.
3. **[HIGH] play-rated inbound op-58 body was never executed.** The concrete
   `build_match_start()` is reverse-guessed from `qc` field order; the outbound
   opcode (11 vs 124) is also unknown. Keep it behind the guarded gate.
4. **[HIGH] winning op60 handler effects are bytecode-read, not run.** `wl.d`
   was never run for op60 (op60 has no body). Byte layout is proven; the
   elimination/teardown/defeat-UI mutations are not.
5. **[MEDIUM] 58/59/60 are bidirectional too**, not just 62 — client 58 fixed-0
   vs server −2, client 59 fixed-1 vs server −2, client 60 −1 vs server fixed-0.
6. **[MEDIUM] play-rated contradicts itself**: "fire-and-forget, no storm"
   versus the raw finding's "stalls forever re-firing". Unresolved.
7. **[MEDIUM] Three outbound opcodes are menu-threaded and unknown**
   (`sn.a` social, `ce.a` quick-chat, `ad.a` play-rated); the quick-chat server
   branch is keyed on a TBD opcode. The ignore-list opcode byte is
   ISAAC-encrypted, so a prematurely guessed length key desyncs the keystream.
8. **[MEDIUM] lobby-player-list was proven by injecting into `de.field_V`**,
   bypassing the login→ISAAC transition, and its 5-name cap suggests a friends
   preview rather than the room roster (`cl.x`/`kc.r` may be the real one).
9. **[MEDIUM] create-unrated is proven only for the degenerate empty room**
   (`N=0`); the `N>=1` occupant record and the `q`/`z` create-vs-join meaning
   are unreversed.
10. **[LOW] quick-chat**: the `0x8000` strip-on-echo rule is a hypothesis, and
    the channel==2 / var4==1 / channel 1|4 branches were never executed.
11. **[LOW] No renderer was driven for any inbound feature.** Every proof is
    field-decode/state-advance; a correct decode does not prove the screen
    paints.

**Highest-value next harness:** replay the server's real login-success and
bootstrap byte stream through the client's own `bd.f`/`te.field_v`
initialization and assert `te.field_v[2] == te.field_v[6] == te.field_v[13] ==
true` (and read `[12]`). It de-risks three blocking features at once. Runner-up:
drive the lobby menu-action descriptor init and read the stored action opcodes,
which would pin the play-rated, social, and quick-chat outbound numbers together.
