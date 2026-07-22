# Multiplayer rooms, invites, chat, and gameplay — session notes

Findings from getting the lobby room flow working end to end against a real
client, and from starting to debug in-match gameplay. Cross-references the
deobfuscated reference client `lexi-lambda/shattered-plans` (same FunOrb
framework), whose packet enums name what we had reverse-engineered by number.

For the audited local rules, Master Challenge progression, special-item
semantics, and the distinction between single-player recycling and multiplayer
sending, see [Single-player and Master Challenge gameplay audit](single-player-master-challenge-gameplay.md).

Native room actions are enabled by default; `DEKOBLOKO_ROOMS=0` disables them
for protocol debugging. The protocol server contains no roster-placeholder or
demo players. The optional `dekobloko_demo` launcher owns its socket-free
sessions and registers them through the `dekobloko_server.api` surface and the
same `Lobby.join()` operation as connections.

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

`SPECTATE_GAME` carries a big-endian `u16 game_id`, matching the framework's
writer and server handler. ID zero stops spectating. The Python server now wires
this action for running hosted games: it sends the spectator-start packet,
hydrates every live bucket with full-state snapshots, relays subsequent
gameplay to the observer, and removes the observer without consuming a player
slot or affecting the winner.

S2C LOBBY modes (server opcode 10, first payload byte): `0 YOU_LEFT_ROOM,
4 YOU_JOINED_ROOM, 5 PLAYER_ENTERED_LOBBY, 8 ADD_ROOM, 9 REMOVE_ROOM,
11 YOU_ARE_INVITED, 14 ADD_PLAYER_INVITE, 18 PLAYER_JOINED_ROOM,
19 PLAYER_LEFT_ROOM, 23 PLAYER_ID`. The frame-10 dispatcher is `ke.b`.

## Lobby lifecycle now implemented

The Python lobby follows the reference room lifecycle rather than hiding active
players from other users:

1. Creating sends YOU_JOINED_ROOM and PLAYER_JOINED_ROOM to the host, then an
   ADD_ROOM record to every initialized lobby connection.
2. Inviting sends YOU_ARE_INVITED to the target and ADD_PLAYER_INVITE to the
   host. Joining hydrates the joiner's member list, broadcasts the new member,
   and refreshes the global ADD_ROOM player count.
3. Starting retains the room in the lobby list and changes its flags to running;
   the spectator bit reflects `GameOptions.allow_spectators`. A denied spectate
   request has no side effects on the caller's current attachment.
4. Conclusion is published once, result/game-over packets return players and
   spectators to the lobby, then REMOVE_ROOM retires the listing.

When explicitly launched with `python -m dekobloko_demo`, Player5 repeats this
flow: create and invite immediately, Player6 joins after 10 seconds, and
Player5 starts after another 10 seconds. Settings are randomized; spectator
permission alternates so observers can test both outcomes. The two participants
drive the authoritative engine with normal controls, and a 60-second safety
result prevents a demo room from lingering. The ordinary
`python -m dekobloko_server` process starts no fixture.

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
  `uc.field_g` is set only by the mode-23 PLAYER_ID packet. That packet remains
  opt-in (`DEKOBLOKO_ROSTER=id` or `1`) because a live A/B run tied it to a
  return-to-main-menu crash. Room owner ids still use the same account-id
  derivation, but native host controls must be retested before declaring the
  mode-23 tradeoff resolved.

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

The room envelope also requires `u16 roomId + cstring ownerName` after the
speaker. The old builder omitted those fields even when it set channel 1; the
client therefore could not associate the line with a game. Both free-text and
quick-chat builders now include that context. C2S opcode 15 is the length-byte
quick-chat packet (`u8 channel + u16 id` for lobby/room); the server relays its
id verbatim on S2C opcode 12. Room traffic is sent to live players plus
spectators, never unrelated lobby users, so an observer sees future game chat
without becoming a player.

## In-match gameplay

The live protocol is now decoded and exercised against the untouched original
board engine. See [Multiplayer gameplay protocol](multiplayer-gameplay-protocol.md)
for the packet layouts, deterministic board-replica model, state resync,
feedback queues, immutable player slots, defeat/removal flow, and remaining
unknowns.

Corrections to these earlier session notes:

- C2S-60 batches flush at 20 ticks **or when the piece lands**. A short batch is
  a lock boundary, but can repeat until the transition is acknowledged.
- S2C 64 finalizes/corrects the old piece and spawns the next one; C2S 59
  acknowledges its update counter.
- S2C 67 queues an incoming feedback/bombardment shape, not a normal next piece.
- Full S2C-61 state does not transmit dimensions or the grid twice.
- C2S 63 is rematch negotiation, not a piece request.
- S2C 62 tombstones a defeated board's original slot; survivors are never
  renumbered.

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

Fake players live outside the protocol package in `apps/server/dekobloko_demo.py`.
They implement the `LobbySession` surface and register normally, so invite and
kick resolution sees ordinary sessions rather than name-based bot exceptions.
Focused tests additionally assert that `dekobloko_server/__main__.py`,
`game.py`, and `lobby.py` contain no demo player names or fixture dependency.
