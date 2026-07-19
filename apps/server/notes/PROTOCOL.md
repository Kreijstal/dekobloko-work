# Dekobloko protocol notes

These notes are based on the decompiled client sources and the current Python server implementation.

## Startup HTTP

The applet reads these parameters:

- `gameport1`
- `gameport2`
- `servernum`
- `gamecrc`
- `instanceid`
- `member`
- `lang`
- `affid`
- `simplemode`

The client also requests old `.ws` endpoints through `getCodeBase()`:

- `countrylist.ws`
- `clienterror.ws?...`
- `quit.ws`
- `reload.ws`
- `toserverlist.ws`
- `tosupport.ws`
- `error_game_*.ws`

The server returns small placeholder text/html responses for those endpoints.

## Shared TCP preamble

Both JS5/cache and game/login connections first send an 8-byte preamble written by the client connection helper. The server currently validates only that the first byte is `12`, then reads the next opcode.

After the preamble:

```text
byte 15  -> JS5/cache handshake, followed by 4-byte revision
byte 14  -> game login challenge, followed by 1-byte target
byte 16  -> direct login packet path
byte 18  -> direct/create packet path
```

## Opcode 14 challenge

The normal game login path is:

```text
client: byte 14
client: byte target
server: byte 0              accepted challenge request
server: u64 challenge_seed  8 bytes, big-endian
```

The client stores that challenge as a `long`, then writes it into its four-word login seed as:

```text
seed[0] = client random int
seed[1] = client random int
seed[2] = challenge_seed >> 32
seed[3] = challenge_seed
```

After RSA and XTEA decrypt, the server checks that `seed[2]` and `seed[3]` reconstruct the challenge it sent.

## Login packet after opcode 14

After receiving the challenge, the client sends login opcode `16` or `18`:

```text
client: byte login_opcode       16 or 18
client: u16 packet_length
client: byte[packet_length] body
```

The current server parses the body as:

```text
u32    client_revision
u64    client_detail/cache token
u8     flags
string client_string, null-terminated
[optional 8-byte extra token if flags & 0x10]
u16    rsa_length
byte[] rsa_ciphertext
byte[] xtea_ciphertext
```

The RSA plaintext is:

```text
u8  marker = 10
u32 xtea_key_0
u32 xtea_key_1
u32 xtea_key_2
u32 xtea_key_3
u16 xtea_plain_length
```

The XTEA plaintext begins:

```text
u32 isaac_seed_0
u32 isaac_seed_1
u32 isaac_seed_2 = challenge high
u32 isaac_seed_3 = challenge low
byte[24] random_uid
u16 login_mode
credentials...
```

Email-style credentials are parsed as:

```text
u8     marker = 0
string username/email, null-terminated
byte[14] password encoded as two packed base38 groups
```

Classic username credentials are parsed as:

```text
u64    username encoded as base37
byte[14] password encoded as two packed base38 groups
```

## RSA

The client public key constants are:

```text
uk.uk_p = modulus n
ea.ea_k = exponent e = 65537
```

This server bundles a patched client JAR and the matching generated private key.

## XTEA

The client encrypts the first half-block using the current sum, increments the
sum, and then encrypts the second half-block. Decryption therefore reverses the
second half first, decrements the sum, and then reverses the first half. The
server implementation is in `dekobloko_server.crypto.xtea_decrypt_dekobloko`.

## ISAAC

After successful login, packet opcodes are ISAAC-obfuscated.

```text
client -> server ISAAC seed = decrypted client seed
server -> client ISAAC seed = each client seed word + 50
```

Only packet opcodes are ISAAC-obfuscated; payload bytes are read normally according to the packet length table.

## Login success response

The success response is:

```text
server: byte 0                     login accepted
server: u8 success_payload_length
server: byte[] success_payload
```

Payload currently written:

```text
u64    player_id
u8     staff/mod level
u8     account state
u16    membership/subscription field
string nullable browser/system message; first byte 0 means null
u8     login flags
string display_name, null-terminated
u8     final account flag
```

## Post-login packets

The current server has an initial packet length table and decodes known client packet opcodes. Unknown opcodes are treated as one-byte-variable packets so the stream can continue far enough for logging, but exact packet support is incomplete.

Server packet `9` is a one-byte-variable server-message packet. Its payload is a CP-1252/NUL-terminated string. The client handles it by reading a string and displaying it through its message path.

Implemented post-login behavior is therefore:

```text
read encrypted opcode
ISAAC-decode opcode
read payload by known or assumed variable length
log opcode + payload
if payload has text shape: u64 target + cstring text + u8 channel + u8 quickchat
broadcast server packet 9: "display_name: text"
```

Full world-state sync, movement, player update blocks, NPCs, inventory, object updates, friends/ignore, private messages, and production chat semantics are not implemented yet.

## JS5 request protocol

After JS5 opcode `15`, the server returns one byte:

```text
0 = accepted
```

The client then sends 6-byte control/request packets:

```text
opcode 6: connection setup/control
opcode 2: priority mode control
opcode 3: normal mode control
opcode 4: XOR obfuscation byte control
opcode 0: normal file request
opcode 1: priority file request
```

File requests are:

```text
byte opcode       0 normal, 1 priority
byte archive_id
int  group_id
```

The server responds:

```text
byte archive_id
int  group_id
byte compression_or_flags
int  compressed_length
bytes raw_container_after_first_5_bytes
```

If the request was normal, the high bit of `compression_or_flags` is set. If it was priority, the high bit is clear.

JS5 stream framing inserts `0xFF` after the first 512 bytes of a file response, then after every additional 511 file-response bytes. The first 512-byte block includes the 10-byte response header.

## Cache file format

The server reads classic Jagex cache files:

```text
main_file_cache.idxN  -> 6-byte index records for archive N groups
main_file_cache.dat2  -> 520-byte sectors
```

Index record:

```text
3 bytes length
3 bytes first_sector
```

Sector header for group id <= 65535:

```text
2 bytes group_id
2 bytes chunk_number
3 bytes next_sector
1 byte archive_id
512 bytes payload
```

## Multiplayer packets implemented in the Python scaffold

### Server packet 14: lobby bootstrap

```text
server -> client:
  opcode 14
  length 0
```

This causes the client to enter the multiplayer lobby setup path.

### Server packet 58: start own multiplayer match

```text
server -> client:
  opcode 58, u16 length
  u16 settings_word
      bits 0..3   speed index
      bits 4..5   bombardment level
      bits 6..8   colour count
      bits 9..11  special item level
      bit  12     large bucket
      bit  13     spectators/option flag
      bit  15     rated/flag in this scaffold
  u16 game_id_or_round
  u8  theme
  u8  player_count
  i8  local_player_slot
  repeated player_count times:
      u8 0
      cp1252 name bytes
      u8 0
  u8 active_player_mask
```

The client constructs `new qc(true, ...)` from this packet. Packet `59` has the same body shape but is used by the client as the spectator/secondary-game path.

### Server packet 64: immediate piece/event

```text
server -> client:
  opcode 64, u16 length
  u8  player_slot
  i8  x_or_event_position
  i8  y_or_event_position
  u8  rotation_and_speed     # speed_index << 2 | rotation
  u8  previous_piece_code
  rf  piece
  u8  piece_descriptor
  varint7 placeholder_start
  varint7 placeholder_count_delta
```

`rf` encoding:

```text
varint7 piece_id
u8 width
u8 height
bitpack width*height cells, 5 bits per cell
```

Packet `64` is what actually installs the active falling piece through the client's `vm` event path.

### Server packet 67: queued piece

```text
server -> client:
  opcode 67, u8 length
  u8 player_slot
  rf piece
```

This adds a piece to the player's queued `lk.X` list.

### Client packet 60 -> server packet 63 relay

Client packet `60`:

```text
client -> server:
  opcode 60, u8 length
  u8 control_count
  bitpack control_count values, 5 bits each
```

Server packet `63` relays the same control stream for another player:

```text
server -> client:
  opcode 63, u8 length
  u8 player_slot
  u8 control_count
  bitpack control_count values, 5 bits each
```
