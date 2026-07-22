# Multiplayer rooms, invites, chat, and gameplay — session notes

Findings from getting the lobby room flow working end to end against a real
client, and from starting to debug in-match gameplay. Cross-references the
deobfuscated reference client `lexi-lambda/shattered-plans` (same FunOrb
framework), whose packet enums name what we had reverse-engineered by number.

All room features are behind `DEKOBLOKO_ROOMS=1`; bot test players behind
`DEKOBLOKO_BOTS=1`.

## Packet name map (from shattered-plans)

Client→server (C2S):
- `0x00` KEEPALIVE, `0x03` HIGHSCORE, `0x04` ACHIEVEMENTS, `0x05` PROGRESS,
  `0x07` RANKING (fixed 2 — NOT "create room"; our old opcode-7 handler is
  misidentified), `0x0b` LOBBY (room actions), `0x0c` CHAT.

Server→client (S2C):
- `0x00` KEEPALIVE, `0x02` HISCORE, `0x03` ACHIEVEMENTS, `0x04` LEVEL_PROGRESS,
  `0x0a` LOBBY (all the room modes below).

C2S LOBBY actions (client opcode 11, first payload byte):
`0 PLAY_RATED_GAME, 1 RETURN_TO_LOBBY, 2 SET_RATED_OPTIONS,
3 ACK_RATED_ROOM_INFO, 4 CREATE_UNRATED_GAME, 5 SET_ROOM_OPTIONS,
6 INVITE_PLAYER_TO_GAME, 7 KICK_PLAYER_FROM_GAME, 8 JOIN_ROOM, 9 LEAVE_ROOM,
10 SPECTATE_GAME, 11 SHOW_PLAYERS_IN_GAME`.

S2C LOBBY modes (server opcode 10, first payload byte): `0 YOU_LEFT_ROOM,
4 YOU_JOINED_ROOM, 5 PLAYER_ENTERED_LOBBY, 18 PLAYER_JOINED_ROOM,
19 PLAYER_LEFT_ROOM, 23 PLAYER_ID`. The frame-10 dispatcher is `ke.b`.

## KEEPALIVE — the foundational fix

The client disconnects after 30 s of server silence (`SERVER_TIMEOUT_MILLIS`,
JagexApplet). Our loop only ever wrote in reply to a client packet, so an idle
client heard nothing and reconnected roughly every minute (thousands of
disconnects per run in the log). Fix: a per-connection daemon sends server
opcode 0 every 10 s and we echo client keepalives, matching the reference
server's `IdleStateHandler(0, 10, 0)`. encode+send moved under one lock so the
keepalive thread and the packet loop can't interleave ISAAC opcode-cipher
advances. This unblocked every room/gameplay symptom that had really been the
30 s timeout landing mid-interaction.

## Room create → host

- `CREATE_UNRATED_GAME` → reply `YOU_JOINED_ROOM` (mode 4) on opcode 10:
  `[u8 4][u16 room_id][room body]`.
- Room body layout, MEASURED by driving `wg.a` via reflection AND matched to the
  reference `initializeFromServer`:
  `u8 maxPlayerCount | u8 whoCanJoin | u8 flags | 5B gameSpecificOptions |
   u16 averageRating | u32 startedAgo | u64 ownerId | cstring ownerName`.
- `gameSpecificOptions` is a **5-byte** array (`ve.field_kc`, built `new
  ve(j.field_b)`, j.field_b == 5). The single-byte reflection probe could not
  see this — it built `ve(1)` — which mis-shifted ownerId and ate 4 bytes of the
  owner name ("Hello" → "o", then "ello" at 4 bytes). Live iteration (name at a
  fixed absolute offset 22) pinned it at 5. `ve.c` rendering ".../4" is a display
  string, not the array length — a red herring that cost two iterations.
- Host detection: `ig.java:773` — `uc.field_g == cd.field_m.field_Xb`. The client
  is host when its own player id (`uc.field_g`) equals the room's `ownerId`.
  `uc.field_g` is set only by the mode-23 PLAYER_ID packet, so we now send that
  (with the login player id) before the room reply. `ownerId` = same id.

## Player list, invite, kick

- `PLAYER_JOINED_ROOM` (mode 18): `u64 id | cstring name | cstring displayName |
  u16 rating | varint ratedGames | u8 crown | u8 options`. Sent for the host on
  create, and for a bot on invite. The varint is base-128 (reference
  writeVariableInt); single byte for small values.
- `PLAYER_LEFT_ROOM` (mode 19): `u64 id | u8 reason`. reason **must** be
  `KICKED = 12`. Reason `1` is `ENTERED_GAME` in `LobbyPlayer.Status`, which
  rendered "Player has entered a game" on a kick.
- `LEAVE_ROOM` → `YOU_LEFT_ROOM` (mode 0), a bare mode byte; clears `cd.field_m`
  back to the lobby (ke.b tail, ke.java:2465).

## Unified player id (invite-self bug)

The lobby roster row and the local player id must derive **identically** or the
client can't recognise its own row — you could invite yourself. `uid_for` was a
crc32 of the display name; `AccountStore.player_id` is a sha256-based value. They
never matched. `uid_for` now replicates `player_id` (normalize, sha256[:4] with
the 0x10000000 tag).

## Chat channel

C2S chat `payload[0]` is the channel: `0 LOBBY`, `1 ROOM`. We were hardcoding 0
on the broadcast; now we echo the sender's channel so a room message renders in
the game channel ("[<owner>'s game] "). The client picks the channel itself:
`ig.java:52`/`vm_.java:173` upgrade LOBBY→ROOM when `cd.field_m != null`, unless
a specific chat tab (`pk.field_r`) is selected. Observed messages were `ch=0`,
i.e. sent from the lobby context.

## In-match gameplay (IN PROGRESS, not working)

Model, confirmed by the user: **each board runs single-player physics locally**
(gravity, lock, line clears); the only multiplayer coupling is completed pieces
sent to the next player (bombardment). The server feeds the piece *sequence*
(same piece on both buckets confirms this), not the physics.

- Piece flood fixed: `handle_controls` fed a new piece whenever opcode-60's
  count byte was `< 20`. That byte is just the number of buffered 5-bit input
  samples (`qc.java:2005`, field_w), not a lock signal — small counts arrive
  constantly, so the active piece was replaced many times a second and never
  settled. Disabled; pieces now render.
- Remaining bug: piece spins but never falls/locks; bucket stays empty.
  Gravity is `lk.d`'s `field_Ab` countdown; a new piece resets it via
  `field_Ab = l(123)` (lk.java:1381). `lk.d` throws `IllegalStateException`
  when `field_C == 0` (board width unset). Suspect our opcode-64 piece event
  installs a piece without the board width/gravity the single-player spawn path
  sets up.
- Full board-state wire format is `lk.a(boolean, wl, byte)` (lk.java:2950):
  width, height, the full cell grid (twice), then `field_q, field_L, field_e,
  field_Ab (gravity), field_A (buttons), field_Cb, field_yb`, …
- Control bitmask (from `lk.d`): bit 1 = left, bit 2 = right, bit 4 = rotate,
  bit 16 = drop. `~field_A & param0` = newly-pressed edges.

## Client instrumentation pipeline (works)

The running gamepack shares class names with the decompiled sources but uses the
original single-letter field names, so a single recompiled class can't be
hot-swapped directly. `scripts/restore-abi.sh` (ASM-based) strips the CFR-JS
`field_` prefix from a recompiled class's field decls and refs, making it
ABI-identical to the original jar. Pipeline:

1. Edit a decompiled source (add `System.out.println`).
2. `javac -cp <recompiled-tree> -d out src.java`.
3. `scripts/restore-abi.sh out abi_out` (needs ASM jars under
   `.work/games/.owned-decompiler-tools/asm/`; fetch from Maven Central
   org.ow2.asm 9.9.1 if absent).
4. `jar uf <gamepack> abi_out/<Class>.class`, then relaunch the client.

Verified: an instrumented `lk.d` (printing `field_C/zb/Ab/e/ctrl/y`) links and
runs with no `NoSuchFieldError`. Gamepack backup kept at
`dekobloko-serverkey.jar.orig-backup`.

## Test scaffolding

`DEKOBLOKO_BOTS=1` adds Player1/2/3 as roster presences that auto-accept invites
and can be kicked, so a single real client can exercise the invite/join/kick
flow. Accounts player1/2/3 are registered. Bots are UI placeholders — they never
send input, so real multiplayer gameplay cannot be exercised against them.
