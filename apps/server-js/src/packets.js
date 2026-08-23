"use strict";

// Port of dekobloko_server/packets.py.
//
// Three concerns live here, exactly as in Python:
//   * the framing tables (CLIENT_PACKET_LENGTHS / SERVER_PACKET_LENGTHS) and
//     the opcode-3/opcode-5 dual-producer peeks,
//   * PacketCodec (ISAAC-obfuscated opcodes both directions over the
//     crypto.js IsaacCipher) and PacketBuilder (big-endian field writer),
//   * the build_* payload constructors for every server message family.
//
// Divergences from Python, all mechanical:
//   * read_client_packet() takes a reader ({ recv(size) -> Buffer }) instead
//     of a socket, mirroring src/io.js; payloads come back as Buffer.
//   * unpack_5bit returns an Array (Python tuple).
//   * Python keyword-only/optional arguments become a trailing opts object
//     with the SAME snake_case keys (e.g. build_add_room's player_count,
//     which stays required).
//   * cp1252 encoding is implemented locally (encode_cp1252); Node has no
//     built-in windows-1252 and Buffer latin1 differs exactly in 0x80-0x9F.
//     errors="replace" maps unmappable code points to '?' like Python.
//
// ValueError-shaped errors reuse crypto.js ValueError with byte-identical
// messages; build_sb_reply mirrors int.to_bytes OverflowError by name too.
// The unlisted-opcode warning in encode_server_packet prints via console.log
// with print()'s exact text.

const { IsaacCipher, u32, ValueError } = require("./crypto.js");
const { read_exact, read_u8, read_u16 } = require("./io.js");

// --- framing tables -----------------------------------------------------------

// Client-to-server packet sizes. -1 means a one-byte length follows the
// opcode; -2 means a two-byte length. Opcode 5 is absent on purpose: it has
// two producers with different framing and is peek-dispatched before this
// table is consulted (see _read_opcode_5). See packets.py for the provenance
// of every entry -- several are load-bearing against ISAAC keystream desyncs.
const CLIENT_PACKET_LENGTHS = Object.freeze({
  0: 0,
  1: 0,
  4: -1,
  9: 0,
  10: 0,
  11: -1,
  12: -1,
  14: -1,
  15: -1,
  7: 2,
  17: 0,
  18: -1,
  58: 0,
  59: 1,
  60: -1,
  61: 0,
  62: 0,
  63: 0,
});

// Server-to-client packet sizes. GROUND TRUTH from the client's own table
// (mk.field_c). Fixed-size opcodes carry NO length byte on the wire; a
// missing entry makes encode_server_packet guess fixed framing LOUDLY.
const SERVER_PACKET_LENGTHS = Object.freeze({
  0: 0,
  1: 16,
  2: -2,
  3: -1,
  4: -1,
  5: -1,
  6: -2,
  7: -1,
  8: -2,
  9: -1,
  10: -1,
  11: -1,
  12: -1,
  13: -1,
  14: 0,
  15: 0,
  16: -1,
  17: -1,
  18: 1,
  58: -2,
  59: -2,
  60: 0,
  61: -2,
  62: 2,
  63: -1,
  64: -2,
  65: 1,
  66: 2,
  67: -1,
  68: 1,
  69: 1,
  70: 1,
  71: 1,
  72: 1,
  73: 1,
  74: 1,
  75: -1,
  76: 1,
});

// Client LOBBY action codes (client opcode 11, first payload byte). Logging
// only -- naming an action is not knowing Dekobloko's payload for it.
const LOBBY_ACTION_NAMES = Object.freeze({
  0: "PLAY_RATED_GAME",
  1: "RETURN_TO_LOBBY",
  2: "SET_RATED_OPTIONS",
  3: "ACK_RATED_ROOM_INFO",
  4: "CREATE_UNRATED_GAME",
  5: "SET_ROOM_OPTIONS",
  6: "INVITE_PLAYER_TO_GAME",
  7: "KICK_PLAYER_FROM_GAME",
  8: "JOIN_ROOM",
  9: "LEAVE_ROOM",
  10: "SPECTATE_GAME",
  11: "SHOW_PLAYERS_IN_GAME",
});

// te.field_v snapshot of client-side dispatch gates; length and dispatch are
// independent. A snapshot, not a law -- see packets.py.
const SERVER_OPCODES_SEEN_ENABLED = new Set([
  0, 2, 3, 4, 6, 7, 8, 11, 12, 13, 16, 17, 18,
]);

// --- cp1252 -------------------------------------------------------------------
//
// Python's errors="replace" substitutes '?' for unencodable characters;
// U+0080-U+009F (C1 controls) are NOT encodable in cp1252 because those byte
// slots belong to the specials below.

const CP1252_SPECIAL_TO_BYTE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** Python: value.encode("cp1252", errors="replace"). */
function encode_cp1252(text) {
  const out = [];
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7f || (cp >= 0xa0 && cp <= 0xff)) {
      out.push(cp);
    } else {
      const special = CP1252_SPECIAL_TO_BYTE.get(cp);
      out.push(special === undefined ? 0x3f : special);
    }
  }
  return Buffer.from(out);
}

/** Python raises builtin OverflowError from int.to_bytes(); mirror the name. */
class OverflowError extends Error {
  constructor(message) {
    super(message);
    this.name = "OverflowError";
  }
}

// --- helpers --------------------------------------------------------------------

/** Big-endian u64 bytes of any Number / decimal string / BigInt, masked. */
function u64_be_bytes(value) {
  const big = typeof value === "bigint" ? value : BigInt(value);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt.asUintN(64, big), 0);
  return buf;
}

/**
 * Resolve a Python-style single optional argument that callers may pass
 * either positionally (the value itself) or as a trailing keyword object
 * ({ [name]: value }). Buffers/typed arrays, arrays and BigInts are always
 * values; a plain object is treated as the opts form.
 */
function one_opt(tail, name, fallback) {
  if (tail === undefined) return fallback;
  if (
    tail !== null &&
    typeof tail === "object" &&
    !Array.isArray(tail) &&
    typeof tail !== "bigint" &&
    !(tail instanceof Uint8Array)
  ) {
    const v = tail[name];
    return v === undefined ? fallback : v;
  }
  return tail;
}

/** Shared achievement-word packing for the opcode-3 reply and opcode-75 mask. */
function achievement_words(indices) {
  const words = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const index of indices) {
    if (index >= 0 && index < 31) {
      words[index >> 5] |= 1 << (index & 31);
    }
  }
  // Trailing zero words carry no information; at least one word always goes.
  let count = 1;
  while (count < 8 && words.slice(count).some((w) => w !== 0)) count += 1;
  return { words, count };
}

// --- GamePacket -----------------------------------------------------------------

/** Frozen dataclass(frozen=True)-alike: { opcode, payload, assumed_variable }. */
class GamePacket {
  constructor(opcode, payload, assumed_variable = false) {
    this.opcode = opcode;
    this.payload = payload;
    this.assumed_variable = assumed_variable;
    Object.freeze(this);
  }
}

// --- PacketCodec ------------------------------------------------------------------

class PacketCodec {
  /**
   * client_seed: iterable of four ints (Number or BigInt ok). Outbound adds
   * 50 BEFORE masking, so seeds near 2**32 wrap exactly like Python.
   */
  constructor(client_seed) {
    const seed = Array.from(client_seed);
    const inbound_seed = seed.map((value) => u32(value));
    const outbound_seed = seed.map((value) => u32(value + 50));
    this.inbound = new IsaacCipher(inbound_seed);
    this.outbound = new IsaacCipher(outbound_seed);
  }

  /**
   * Read one client packet from reader ({ recv(size) -> Buffer }, possibly
   * short-returning). Opcodes 3 and 5 are peek-dispatched BEFORE the length
   * table because each has two producers with different framing.
   */
  read_client_packet(reader) {
    const raw_opcode = read_u8(reader);
    const opcode = (raw_opcode - this.inbound.next()) & 0xff;

    if (opcode === 3) return this._read_opcode_3(reader);

    if (opcode === 5) return this._read_opcode_5(reader);

    let length = Object.prototype.hasOwnProperty.call(
      CLIENT_PACKET_LENGTHS,
      opcode
    )
      ? CLIENT_PACKET_LENGTHS[opcode]
      : undefined;
    let assumed_variable = false;

    if (length === undefined) {
      length = read_u8(reader);
      assumed_variable = true;
    } else if (length === -1) {
      length = read_u8(reader);
    } else if (length === -2) {
      length = read_u16(reader);
    }

    const payload = length ? read_exact(reader, length) : Buffer.alloc(0);
    return new GamePacket(opcode, payload, assumed_variable);
  }

  /**
   * Client opcode 3 has TWO producers: wb.a hiscore request (no length byte,
   * fixed 6-byte body starting 0x05 0x00) and fm.a achievement record (one
   * u8 length byte, body far larger than 5). Peek the first byte to split.
   */
  _read_opcode_3(reader) {
    const first = read_u8(reader);
    if (first === 0x05) {
      const payload = Buffer.concat([Buffer.from([first]), read_exact(reader, 5)]);
      return new GamePacket(3, payload, false);
    }
    const payload = first ? read_exact(reader, first) : Buffer.alloc(0);
    return new GamePacket(3, payload, false);
  }

  /**
   * Same story for opcode 5: oi.a saved-value request (fixed 3 bytes starting
   * 0x02) versus mc.a progress record (u8 length, never shorter than 23).
   */
  _read_opcode_5(reader) {
    const first = read_u8(reader);
    if (first === 0x02) {
      const payload = Buffer.concat([Buffer.from([first]), read_exact(reader, 2)]);
      return new GamePacket(5, payload, false);
    }
    const payload = first ? read_exact(reader, first) : Buffer.alloc(0);
    return new GamePacket(5, payload, false);
  }

  /**
   * Encode one server packet framed per SERVER_PACKET_LENGTHS. Fixed-size
   * opcodes carry NO length byte; an unlisted opcode guesses fixed framing
   * and PRINTS A WARNING, because a framing guess that disagrees with the
   * client's own table desyncs it silently.
   *
   * Ordering note: the outbound ISAAC word is consumed BEFORE validation, so
   * even a failed encode advances the keystream (pinned by golden tests).
   */
  encode_server_packet(opcode, payload = Buffer.alloc(0)) {
    const raw_opcode = (opcode + this.outbound.next()) & 0xff;
    const known = Object.prototype.hasOwnProperty.call(
      SERVER_PACKET_LENGTHS,
      opcode
    );
    if (!known) {
      console.log(
        "[packets] WARNING opcode " + opcode + " has no measured length entry; " +
          "guessing fixed " + payload.length + "-byte framing. If the client's " +
          "mk.field_c[" + opcode + "] disagrees, this DESYNCS the stream and " +
          "the client will die somewhere unrelated."
      );
    }
    const length_kind = known ? SERVER_PACKET_LENGTHS[opcode] : payload.length;
    const head = [raw_opcode];
    if (length_kind === -1) {
      if (payload.length > 255) {
        throw new ValueError(
          "packet " + opcode + ": " + payload.length +
            " bytes does not fit a one-byte length"
        );
      }
      head.push(payload.length);
    } else if (length_kind === -2) {
      if (payload.length > 65535) {
        throw new ValueError(
          "packet " + opcode + ": " + payload.length +
            " bytes does not fit a two-byte length"
        );
      }
      head.push((payload.length >> 8) & 0xff, payload.length & 0xff);
    } else if (length_kind !== payload.length) {
      throw new ValueError(
        "packet " + opcode + " is fixed at " + length_kind +
          " bytes, got " + payload.length
      );
    }
    head.push.apply(head, payload);
    return Buffer.from(head);
  }

  /** Server message string: cp1252(replace) text + NUL terminator, opcode 9. */
  make_server_message(text) {
    const payload = Buffer.concat([encode_cp1252(text), Buffer.from([0])]);
    return this.encode_server_packet(9, payload);
  }
}

// --- PacketBuilder -----------------------------------------------------------------

/**
 * Chainable big-endian field writer. Every method returns this; finish()
 * concatenates. Values mask exactly where Python masks.
 */
class PacketBuilder {
  constructor() {
    this.chunks = [];
  }

  _push_byte(value) {
    this.chunks.push(Buffer.from([value & 0xff]));
    return this;
  }

  u8(value) {
    return this._push_byte(value);
  }

  /** Python i8 is the same masked single byte as u8. */
  i8(value) {
    return this._push_byte(value);
  }

  u16(value) {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE((value & 0xffff) >>> 0, 0);
    this.chunks.push(buf);
    return this;
  }

  u24(value) {
    const masked = (typeof value === "bigint"
      ? Number(BigInt.asUintN(24, value))
      : value) >>> 0;
    this.chunks.push(
      Buffer.from([(masked >> 16) & 0xff, (masked >> 8) & 0xff, masked & 0xff])
    );
    return this;
  }

  u32(value) {
    const buf = Buffer.alloc(4);
    // ToUint32 is exact mod 2**32 for any finite integral input, covering
    // negatives and values past 2**32 without BigInt.
    buf.writeUInt32BE(
      (typeof value === "bigint"
        ? Number(BigInt.asUintN(32, value))
        : value) >>> 0,
      0
    );
    this.chunks.push(buf);
    return this;
  }

  u64(value) {
    this.chunks.push(u64_be_bytes(value));
    return this;
  }

  cstring(value) {
    if (String(value).indexOf("\u0000") !== -1) {
      throw new ValueError("NUL is not allowed inside client strings");
    }
    this.chunks.push(encode_cp1252(String(value)));
    return this._push_byte(0);
  }

  /** wl.b(true) reader flavour: leading zero byte, then a NUL string. */
  jagex_string(value) {
    this._push_byte(0);
    return this.cstring(value);
  }

  varint7(value) {
    if (value < 0) {
      throw new ValueError("varint7 cannot encode negative values");
    }
    // Arithmetic (not bitwise) so values above 2**31 stay exact.
    const groups = [value % 128];
    let rest = Math.floor(value / 128);
    while (rest > 0) {
      groups.push(rest % 128);
      rest = Math.floor(rest / 128);
    }
    // High groups first, continuation bit set; lowest group last, bare.
    for (let i = groups.length - 1; i >= 1; i--) {
      this._push_byte(groups[i] | 0x80);
    }
    return this._push_byte(groups[0]);
  }

  raw(value) {
    this.chunks.push(Buffer.from(value));
    return this;
  }

  finish() {
    return Buffer.concat(this.chunks);
  }
}

// --- 5-bit control packing ---------------------------------------------------------

/** Byte-aligned MSB-first packer used by C2S opcode-60 control batches. */
function pack_5bit(values) {
  const out = [];
  let current = 0;
  let bits_left = 8;

  for (let raw of Array.from(values)) {
    let value = raw & 0x1f;
    let remaining = 5;
    while (remaining > bits_left) {
      current += value >> (remaining - bits_left);
      out.push(current & 0xff);
      value &= (1 << (remaining - bits_left)) - 1;
      remaining -= bits_left;
      current = 0;
      bits_left = 8;
    }
    if (remaining === bits_left) {
      current += value;
      out.push(current & 0xff);
      current = 0;
      bits_left = 8;
    } else {
      bits_left -= remaining;
      current += value << bits_left;
    }
  }

  if (bits_left !== 8) {
    out.push(current & 0xff);
  }

  return Buffer.from(out);
}

/** Decode one byte-aligned, MSB-first stream of 5-bit values (Array, not tuple). */
function unpack_5bit(data, count) {
  if (count < 0) {
    throw new ValueError("5-bit value count cannot be negative");
  }
  const expected_length = Math.floor((count * 5 + 7) / 8);
  if (data.length !== expected_length) {
    throw new ValueError(
      "5-bit stream for " + count + " values requires " + expected_length +
        " bytes, got " + data.length
    );
  }

  const values = [];
  let bit_index = 0;
  for (let i = 0; i < count; i++) {
    let value = 0;
    for (let bit = 0; bit < 5; bit++) {
      const byte_index = bit_index >> 3;
      const shift = 7 - (bit_index & 7);
      value = (value << 1) | ((data[byte_index] >> shift) & 1);
      bit_index += 1;
    }
    values.push(value);
  }
  return values;
}

/** Decode C2S opcode 60: u8 count plus packed 5-bit input masks. */
function decode_control_batch(payload) {
  if (!payload || payload.length === 0) {
    throw new ValueError("control batch is missing its count byte");
  }
  const count = payload[0];
  if (count > 20) {
    throw new ValueError("control batch count exceeds client buffer: " + count);
  }
  return unpack_5bit(payload.subarray(1), count);
}

// --- opcode 3 / 4 / 2 builders -------------------------------------------------------

/** Payload for SERVER opcode 4, answering the client's opcode-5 request. */
function build_sb_reply(value) {
  const big = typeof value === "bigint" ? value : BigInt(Math.trunc(Number(value)));
  if (big < 0n) {
    throw new OverflowError("can't convert negative int to unsigned");
  }
  if (big > 0xffffffffn) {
    throw new OverflowError("int too big to convert");
  }
  // Python: bytes([0, 0]) + int(value).to_bytes(4, "little") -- six bytes total.
  const out = Buffer.alloc(6);
  out[0] = 0;
  out[1] = 0;
  out.writeUInt32LE(Number(big), 2);
  return out;
}

/** Payload for server opcode 3 -- reply to a client ACHIEVEMENTS request. */
function build_achievements_reply(indices) {
  const words = achievement_words(indices);
  const parts = [Buffer.from([0, words.count])]; // status 0 = OK
  for (let i = 0; i < words.count; i++) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(words.words[i] >>> 0, 0);
    parts.push(buf);
  }
  return Buffer.concat(parts);
}

/** Payload for server opcode 75 -- the earned-achievement mask push. UNUSED. */
function build_achievement_mask(indices) {
  const words = achievement_words(indices);
  const parts = [Buffer.from([words.count])];
  for (let i = 0; i < words.count; i++) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(words.words[i] >>> 0, 0);
    parts.push(buf);
  }
  return Buffer.concat(parts);
}

/** Payload for server opcode 3 discriminator 2: achievements sync latch. */
function build_f_reply() {
  return Buffer.from([2]);
}

/**
 * Payload for server opcode 11 -- a lobby chat line from a player. body is
 * the client's own Huffman blob relayed verbatim; count its char count.
 * opts: room_id / room_owner required together once (channel & 0x7F) is 1
 * or 4. The 0x80 flag bit is forced CLEAR on purpose (see packets.py).
 */
function build_chat_broadcast(name, count, body, channel = 0, opts = {}) {
  const room_id = opts.room_id === undefined ? null : opts.room_id;
  const room_owner = opts.room_owner === undefined ? null : opts.room_owner;
  const encoded = encode_cp1252(name);
  const parts = [];
  parts.push(Buffer.from([channel & 0x7f]));
  parts.push(Buffer.from([1])); // tg.field_c = 1: only branch that renders the name
  parts.push(Buffer.alloc(8)); // fc.field_h
  parts.push(Buffer.from([0])); // var4: single reused name
  parts.push(encoded); // ad.field_x -> the NAME (plain cstring, no leading zero)
  parts.push(Buffer.from([0]));
  if ((channel & 0x7f) === 1 || (channel & 0x7f) === 4) {
    if (room_id === null || room_owner === null) {
      throw new ValueError("room chat requires room_id and room_owner");
    }
    const idbuf = Buffer.alloc(2);
    idbuf.writeUInt16BE(room_id & 0xffff, 0);
    parts.push(idbuf);
    parts.push(encode_cp1252(room_owner));
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([count & 0xff])); // li.a character count
  parts.push(Buffer.from(body));
  return Buffer.concat(parts);
}

/**
 * Payload for server opcode 12 -- canned quick-chat. NOTE the asymmetry with
 * build_chat_broadcast: the channel here compares RAW (not & 0x7F), exactly
 * as packets.py does. opts: room_id / room_owner.
 */
function build_quickchat_broadcast(name, quickchat_id, channel = 0, opts = {}) {
  const room_id = opts.room_id === undefined ? null : opts.room_id;
  const room_owner = opts.room_owner === undefined ? null : opts.room_owner;
  const builder = new PacketBuilder().u8(channel).u8(1).u64(0).u8(0);
  builder.cstring(name);
  if (channel === 1 || channel === 4) {
    if (room_id === null || room_owner === null) {
      throw new ValueError("room quickchat requires room_id and room_owner");
    }
    builder.u16(room_id).cstring(room_owner);
  } else if (channel !== 0) {
    throw new ValueError("unsupported quickchat channel");
  }
  return builder.u16(quickchat_id).finish();
}

// --- multiplayer builders ------------------------------------------------------------

/** Server opcode 6 -- reply to a client opcode-7 room request. N must be 0. */
function build_room_membership(disc, occupantsOrOpts) {
  const occupants = one_opt(occupantsOrOpts, "occupants", 0);
  if (occupants !== 0) {
    throw new ValueError(
      "occupant records (N >= 1) are not reversed yet; see build_room_membership"
    );
  }
  return new PacketBuilder().u8(disc).u8(occupants).finish();
}

/** Server opcode 2 sub-command 1 -- acknowledge one achievement record. */
function build_achievement_ack(key, valueOrOpts) {
  const value = one_opt(valueOrOpts, "value", 0);
  return new PacketBuilder().u8(1).u16(key).u64(value).finish();
}

/**
 * Server opcode 2 sub-command 0 -- the hiscore table. entries:
 * [[columnIndex, score, [values...]], ...]; opts: vcols = 1 and columns =
 * [[name, secondOrNull], ...]. The proven-minimal vector lives in
 * fixtures/packets.json (builds/proven_minimal).
 */
function build_hiscore_table(key, entries, opts = {}) {
  const vcols = opts.vcols === undefined ? 1 : opts.vcols;
  const columns = opts.columns === undefined ? null : opts.columns;
  const builder = new PacketBuilder().u8(0).u16(key);
  const count = 1 + (columns ? columns.length : 0);
  builder.u8(count);
  for (const column of columns || []) {
    const name = column[0];
    const second = column.length > 1 ? column[1] : undefined;
    builder.cstring(name);
    if (second === null || second === undefined) {
      builder.u8(0);
    } else {
      builder.u8(1).cstring(second);
    }
  }
  builder.u8(entries.length);
  for (const entry of entries) {
    const column_index = entry[0];
    const score = entry[1];
    const values = entry[2];
    if (values.length !== vcols) {
      throw new ValueError(
        "entry needs exactly " + vcols + " values, got " + values.length
      );
    }
    builder.u8(column_index).u64(score);
    for (const value of values) builder.u32(value);
  }
  return builder.finish();
}

/** Server opcode 13 mode 1 -- one ignore-list entry (NO flag byte). */
function build_ignore_entry(name, opts = {}) {
  const previous = opts.previous === undefined ? "" : opts.previous;
  const world = opts.world === undefined ? "" : opts.world;
  return new PacketBuilder()
    .u8(1)
    .cstring(previous)
    .cstring(name)
    .cstring(world)
    .finish();
}

/** Server opcode 13 mode 0 -- one friend-list entry (extra flag byte). */
function build_friend_entry(name, opts = {}) {
  const display_name =
    opts.display_name === undefined ? null : opts.display_name;
  const world = opts.world === undefined ? "" : opts.world;
  const builder = new PacketBuilder().u8(0);
  if (display_name === null) {
    builder.u8(0).cstring(name);
  } else {
    builder.u8(1).cstring(name).cstring(display_name);
  }
  return builder.cstring(world).finish();
}

/** Server opcode 10 mode 18 (PLAYER_JOINED_ROOM) -- add a player to a room. */
function build_player_joined_room(player_id, name, opts = {}) {
  const display_name =
    opts.display_name === undefined ? null : opts.display_name;
  const rating = opts.rating === undefined ? 0 : opts.rating;
  const rated_games = opts.rated_games === undefined ? 0 : opts.rated_games;
  const crown = opts.crown === undefined ? 0 : opts.crown;
  const options = opts.options === undefined ? 0 : opts.options;
  const disp = display_name !== null ? display_name : name;
  const parts = [Buffer.from([18])];
  parts.push(u64_be_bytes(player_id));
  parts.push(encode_cp1252(name));
  parts.push(Buffer.from([0]));
  parts.push(encode_cp1252(disp));
  parts.push(Buffer.from([0]));
  const rating_buf = Buffer.alloc(2);
  rating_buf.writeUInt16BE(rating & 0xffff, 0);
  parts.push(rating_buf);
  // rated-games varint: (rated_games << 1) | rated_flag, masked to 7 bits --
  // faithful to packets.py, which shifts then truncates.
  parts.push(Buffer.from([(rated_games << 1) & 0x7f]));
  parts.push(Buffer.from([crown & 0xff]));
  parts.push(Buffer.from([options & 0xff]));
  return Buffer.concat(parts);
}

/** Server opcode 10 mode 19 (PLAYER_LEFT_ROOM) -- remove a player. */
function build_player_left_room(player_id, reasonOrOpts) {
  const reason = one_opt(reasonOrOpts, "reason", 0);
  return Buffer.concat([
    Buffer.from([19]),
    u64_be_bytes(player_id),
    Buffer.from([reason & 0xff]),
  ]);
}

/** Server opcode 10 mode 0 (YOU_LEFT_ROOM) -- confirm a LEAVE_ROOM. */
function build_leave_room_reply() {
  return Buffer.from([0]);
}

/** Server opcode 10 mode 1 (YOU_WERE_KICKED). */
function build_kicked_room_reply() {
  return Buffer.from([1]);
}

/**
 * Shared Dekobloko room body used by lobby modes 4, 8, and 20. Required opts:
 * max_players, who_can_join; optional: player_count (null hides it), options
 * (five bytes), started, concluded, allow_spectators, rated, allow_join,
 * elapsed_ms.
 */
function _build_room_state(owner_id, owner_name, opts) {
  const max_players = opts.max_players;
  const who_can_join = opts.who_can_join;
  const player_count =
    opts.player_count === undefined ? null : opts.player_count;
  const options = opts.options === undefined ? Buffer.alloc(5) : opts.options;
  const started = !!opts.started;
  const concluded = !!opts.concluded;
  const allow_spectators =
    opts.allow_spectators === undefined ? true : !!opts.allow_spectators;
  const rated = !!opts.rated;
  const allow_join =
    opts.allow_join === undefined ? true : !!opts.allow_join;
  const elapsed_ms = opts.elapsed_ms === undefined ? 0 : opts.elapsed_ms;

  if (options.length !== 5) {
    throw new ValueError(
      "Dekobloko room options must contain exactly five bytes"
    );
  }
  let flags = 0;
  if (concluded) flags |= 4;
  if (!started || concluded) flags |= 8;
  if (allow_spectators) flags |= 16;
  if (rated) flags |= 32;
  if (started) flags |= 64;
  if (allow_join) flags |= 128;

  const body = [];
  if (player_count !== null) {
    body.push(Buffer.from([player_count & 0xff]));
  }
  body.push(Buffer.from([max_players & 0xff]));
  body.push(Buffer.from([who_can_join & 0xff])); // 0 invite-only, 4 open
  body.push(Buffer.from([flags & 0xff]));
  body.push(Buffer.from(options));
  body.push(Buffer.from([0, 0])); // average rating
  const elapsed_buf = Buffer.alloc(4);
  elapsed_buf.writeUInt32BE(Math.max(0, elapsed_ms) >>> 0, 0);
  body.push(elapsed_buf);
  if (concluded) {
    body.push(Buffer.from(elapsed_buf));
  }
  body.push(u64_be_bytes(owner_id));
  body.push(encode_cp1252(owner_name));
  body.push(Buffer.from([0]));
  return Buffer.concat(body);
}

/** Server opcode 10 mode 8 (ADD_ROOM), also used for room updates. */
function build_add_room(room_id, owner_id, owner_name, opts = {}) {
  if (opts.player_count === undefined) {
    throw new TypeError("build_add_room requires player_count");
  }
  const body = _build_room_state(owner_id, owner_name, {
    max_players: opts.max_players === undefined ? 8 : opts.max_players,
    who_can_join: opts.who_can_join === undefined ? 4 : opts.who_can_join,
    player_count: opts.player_count,
    options: opts.options,
    started: opts.started,
    concluded: opts.concluded,
    allow_spectators: opts.allow_spectators,
    rated: opts.rated,
    allow_join: opts.allow_join,
    elapsed_ms: opts.elapsed_ms,
  });
  const head = Buffer.alloc(3);
  head[0] = 8;
  head.writeUInt16BE(room_id & 0xffff, 1);
  return Buffer.concat([head, body]);
}

/** Server opcode 10 mode 9 (REMOVE_ROOM). */
function build_remove_room(room_id, reasonOrOpts) {
  const reason = one_opt(reasonOrOpts, "reason", 0);
  const out = Buffer.alloc(4);
  out[0] = 9;
  out.writeUInt16BE(room_id & 0xffff, 1);
  out[3] = reason & 0xff;
  return out;
}

/** Server opcode 10 mode 11 (YOU_ARE_INVITED). */
function build_room_invitation(room_id) {
  const out = Buffer.alloc(3);
  out[0] = 11;
  out.writeUInt16BE(room_id & 0xffff, 1);
  return out;
}

/** Server opcode 10 mode 6 (PLAYER_LEFT_LOBBY). */
function build_lobby_player_left(player_id, reasonOrOpts) {
  const reason = one_opt(reasonOrOpts, "reason", 0);
  return Buffer.concat([
    Buffer.from([6]),
    u64_be_bytes(player_id),
    Buffer.from([reason & 0xff]),
  ]);
}

/** Server opcode 10 mode 14 (ADD_PLAYER_INVITE). */
function build_host_invitation_added(player_id) {
  return Buffer.concat([Buffer.from([14]), u64_be_bytes(player_id)]);
}

/** Server opcode 10 mode 15 (REMOVE_PLAYER_INVITE). */
function build_host_invitation_removed(player_id, statusOrOpts) {
  const status = one_opt(statusOrOpts, "status", 2);
  return Buffer.concat([
    Buffer.from([15]),
    u64_be_bytes(player_id),
    Buffer.from([status & 0xff]),
  ]);
}

/** Server opcode 10 mode 4 (YOU_JOINED_ROOM) -- answer CREATE_UNRATED_GAME. */
function build_create_room_reply(room_id, owner_id, owner_name, opts = {}) {
  const body = _build_room_state(owner_id, owner_name, {
    max_players: opts.max_players === undefined ? 8 : opts.max_players,
    who_can_join: opts.invite_only ? 0 : 4,
    player_count: null,
    options: opts.options,
    started: false,
    concluded: false,
    allow_spectators:
      opts.allow_spectators === undefined ? true : opts.allow_spectators,
    rated: false,
    allow_join: true,
  });
  const head = Buffer.alloc(3);
  head[0] = 4;
  head.writeUInt16BE(room_id & 0xffff, 1);
  return Buffer.concat([head, body]);
}

/** Server frame 10 mode 23 -- tell the client which player id it is. */
function build_local_player_id(uid) {
  const big = typeof uid === "bigint" ? uid : BigInt(uid);
  if (big < 0n || big > 0xffffffffffffffffn) {
    throw new ValueError("uid must fit in u64, got " + big);
  }
  return new PacketBuilder().u8(23).u64(uid).finish();
}

/** Server frame 10 mode 5 -- add-or-update ONE lobby roster row. */
function build_lobby_player(uid, name, rating, opts = {}) {
  const rated_games = opts.rated_games === undefined ? 0 : opts.rated_games;
  const flag = !!opts.flag;
  const display_name =
    opts.display_name === undefined ? null : opts.display_name;
  const previous_name =
    opts.previous_name === undefined ? "" : opts.previous_name;
  const seconds_ago = opts.seconds_ago === undefined ? 0 : opts.seconds_ago;
  const icon = opts.icon === undefined ? 0 : opts.icon;
  const options = opts.options === undefined ? 0 : opts.options;

  if (!(rating >= 0 && rating <= 0xffff)) {
    throw new ValueError("rating must fit in u16, got " + rating);
  }
  if (!(rated_games >= 0 && rated_games <= 0x7f)) {
    throw new ValueError(
      "rated_games must fit in 7 bits (packed as games << 1 | flag), got " +
        rated_games
    );
  }
  return new PacketBuilder()
    .u8(5)
    .u64(uid)
    .cstring(name)
    .cstring(previous_name)
    .cstring(display_name === null ? name : display_name)
    .u32(seconds_ago)
    .u16(rating)
    .u8((rated_games << 1) | (flag ? 1 : 0))
    .u8(icon)
    .u8(options)
    .finish();
}

/** Server opcode 13 mode 2/3 -- social-list transfer-complete marker. */
function build_social_list_complete(modeOrOpts) {
  const mode = one_opt(modeOrOpts, "mode", 2);
  if (mode !== 2 && mode !== 3) {
    throw new ValueError(
      "only the proven list-complete modes 2 and 3 are supported"
    );
  }
  return new PacketBuilder().u8(mode).finish();
}

module.exports = {
  CLIENT_PACKET_LENGTHS,
  LOBBY_ACTION_NAMES,
  SERVER_PACKET_LENGTHS,
  SERVER_OPCODES_SEEN_ENABLED,
  GamePacket,
  PacketCodec,
  PacketBuilder,
  encode_cp1252,
  pack_5bit,
  unpack_5bit,
  decode_control_batch,
  build_sb_reply,
  build_achievements_reply,
  build_achievement_mask,
  build_f_reply,
  build_chat_broadcast,
  build_room_membership,
  build_achievement_ack,
  build_hiscore_table,
  build_ignore_entry,
  build_friend_entry,
  build_player_joined_room,
  build_player_left_room,
  build_leave_room_reply,
  build_kicked_room_reply,
  _build_room_state,
  build_add_room,
  build_remove_room,
  build_room_invitation,
  build_lobby_player_left,
  build_host_invitation_added,
  build_host_invitation_removed,
  build_create_room_reply,
  build_local_player_id,
  build_lobby_player,
  build_social_list_complete,
  build_quickchat_broadcast,
};
