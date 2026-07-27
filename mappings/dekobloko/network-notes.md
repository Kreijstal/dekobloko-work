# DekoBloko networking name-map evidence

This fragment contains only networking names supported by concrete behavior in
the generated DekoBloko Java. Shattered Plans is used as a semantic
cross-reference for shared FunOrb infrastructure and lobby protocol, not as
evidence based on matching obfuscated class names.

## Sources and method

- Primary source: `games/dekobloko/*.java` in this repository.
- Shared reference:
  <https://github.com/lexi-lambda/shattered-plans/tree/master/src/main/java/funorb/io>
- Lobby/game packet reference:
  <https://github.com/lexi-lambda/shattered-plans/blob/master/src/main/java/funorb/shatteredplans/C2SPacket.java>
- Server packet reference:
  <https://github.com/lexi-lambda/shattered-plans/blob/master/src/main/java/funorb/shatteredplans/S2CPacket.java>

The GitHub material was inspected with `gh api`. No original gamepack bytecode,
`javap`, or separately cloned source was used.

Mappings were accepted only when descriptors, inheritance, constants, and
call behavior agreed. Short-name coincidence was ignored.

## Shared buffer classes

### `wl` -> `Buffer`

Confidence: high.

`wl` owns `byte[] r` and cursor `int n`, provides constructors from a byte
array and capacity, and implements the standard big-endian FunOrb operations:
byte, unsigned byte, unsigned short, int, long, null-terminated strings,
bulk copies, backwards length insertion, CRC, XTEA/RSA-related operations,
and variable-width integers. This is the same structural API as Shattered
Plans `funorb.io.Buffer`.

The dummy guard arguments are retained because this source snapshot retains
the original descriptors. Semantic method names describe the effective
operation and deliberately do not claim that guard arguments are meaningful.

### `uf` -> `CipheredBuffer`

Confidence: high.

`uf extends wl`, holds an `ee` instance used to add/subtract a generated value
from packet opcodes, and adds bit-level access. `f(II)V` is called immediately
before packet payload writes and subtractive `i(B)I` is its read counterpart.
This matches Shattered Plans `funorb.io.CipheredBuffer`.

`uf.u` is named `opcodeCipher`, but `ee` itself is left unmapped in this
fragment because its complete algorithm was not needed to establish the
network boundary.

## Socket transport

### `qk` -> `DuplexStream`

Confidence: high.

`qk` wraps one `Socket`, its input and output streams, and an outgoing byte
ring. It exposes byte/array reads, `available`, queued writes, close, and a
writer-thread `run` method. Its constructor takes the socket plus the shared
asynchronous platform service. This is the same transport role as Shattered
Plans `funorb.io.DuplexStream`.

Only fields whose JVM types and direct use are unambiguous are named. Ring
indexes and failure flags remain obfuscated rather than guessing which is the
producer or consumer cursor.

### `we`, `sc`, and `db`

Confidence: high.

`we` stores a host and port, opens a direct socket, and declares an overridable
socket-opening operation. `sc extends we`, consults `ProxySelector`, supports
DIRECT, SOCKS, and HTTP CONNECT, and falls back to the direct connection.
`db extends IOException` is constructed with the HTTP
`Proxy-Authenticate` scheme when a CONNECT request receives status 407.

Therefore these are mapped as `SocketFactory`, `ProxySocketFactory`, and
`ProxyAuthenticationException`.

## Packet buffers and connection lifecycle

Confidence: high.

- `de.V` is the shared `uf` read buffer. Packet-length readers reset its cursor
  and transport reads fill its backing array.
- `we.b` is the shared `uf` write buffer. All C2S helpers write a ciphered
  opcode to it before their payload.
- `bh.k` is compared against S2C opcode constants while dispatching payloads.
- `sm.e` is populated from one- or two-byte length prefixes, then passed to
  the transport read helper.
- `qc.s` is the active DekoBloko game-server `qk`.
- `pe.b(II)Z` checks transport availability and fills `de.V`.
- `fh.a(B)Z` resolves the variable packet length and requests the complete
  payload.
- `wj.c(II)V` writes the accumulated `we.b` bytes to `qc.s` and resets the
  output cursor.
- `mb.a(II)Z` advances the asynchronous socket-open state and installs a
  `qk` plus fresh incoming/outgoing buffers.
- `si.a(I)V` closes and clears the active game connection.

The containing classes `pe`, `fh`, `wj`, `mb`, and `si` also contain unrelated
obfuscator-coalesced static helpers and assets, so only their protocol methods
are renamed.

## Lobby C2S operations

Confidence: high.

The shared FunOrb lobby packet is a variable-byte packet whose first payload
byte is a lobby subaction. Shattered Plans names subactions 7, 8, and 10 as
`KICK_PLAYER_FROM_GAME`, `JOIN_ROOM`, and `SPECTATE_GAME`.

- `mn.a(ZJI)V` writes subaction `7` followed by a player ID as a long:
  `kickPlayerFromGame`.
- `cg.a(IBI)V` writes subaction `8` followed by a room ID as an unsigned
  short: `requestToJoinRoom`.
- `ga.a(ZII)V` writes subaction `10` followed by a room ID as an unsigned
  short: `spectateGame`.

The outer opcode is passed by the caller in DekoBloko, while the stable
subaction and payload identify the operation.

`sn.a(JILjava/lang/String;IZI)V` writes a variable packet containing a player
ID, null-terminated evidence/name string, rule/category byte, and mute flag.
That payload agrees with the clean `reportAbuse` implementation.

## DekoBloko game protocol observations

The generated client dispatches DekoBloko game packets through
`bh.k` and `de.V`. Observed game opcodes include:

| S2C opcode | Observed payload/effect |
| --- | --- |
| 61 | bucket index followed by a bucket-state update |
| 62 | player/bucket removal or elimination data |
| 63 | bucket index, sequence/count, and queued encoded feedback data |
| 64 | bucket index plus a queued gameplay event |
| 65 | bucket reset/life-loss transition |
| 66 | bucket index and reset/clear transition |

The client also writes C2S opcode 59 with a per-bucket sequence/state byte,
and the game object writes opcodes 61, 62, and 63 for game-specific actions.
These meanings are documented but not mapped yet: the payload behavior is
clear enough for tracing, but the user-facing action names are not uniquely
established from the inspected paths.

## Deliberately unmapped

- Login-state constants and session-record classes: the inspected code proves
  their transport role but not stable semantic names for every state/field.
- Lobby player and room record classes: no DekoBloko class was renamed without
  a complete field-order match to the clean shared implementation.
- Game-over, victory, resign, and rematch helpers: their numeric packet paths
  are visible, but this fragment avoids naming wrappers until caller and
  receiver semantics both agree.
- `ee`: strongly associated with opcode ciphering, but not renamed without
  independently confirming the algorithm.
- Mixed utility classes containing one network helper: methods are mapped,
  classes remain obfuscated.

These omissions are intentional. They prevent plausible but incorrect names
from becoming reproducible API.
