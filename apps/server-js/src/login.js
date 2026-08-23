"use strict";

// Port of dekobloko_server/login.py.
//
// Contents, mirroring the Python module one-for-one:
//   * PacketReader      -- bounds-checked big-endian cursor over a Buffer
//   * LoginPrefix / LoginCredentials / ParsedLogin -- frozen dataclass stand-ins
//   * decode_base37     -- packed-u64 name slot -> display name
//   * decode_base38_pair -- 14-byte packed password -> text
//   * _parse_credentials -- recognises the string/base38 vs base37/base38
//                          credential layouts (plus empty/raw fallbacks)
//   * parse_login_body  -- outer framing -> RSA block -> XTEA block -> payload
//
// Numeric policy: everything inside the double-exact envelope stays Number
// (all u8/u16/u24/u32 fields, lengths, flags). Values that genuinely leave
// that envelope -- the u64 name/detail slots, base37/base38 packing math,
// and the 64-bit challenge seed -- use BigInt locally, exactly like io.js's
// write_u64. Where a u64 fits under 2**53 it is surfaced as a plain Number so
// callers keep Python-int ergonomics; larger values surface as BigInt.
// RSA itself never happens here: RsaPrivateKey comes in via ./crypto.js.
//
// Strings on the wire are cp1252, which Node does not ship, so both codecs
// live below (decode errors="replace" -> U+FFFD; encode errors="replace" ->
// '?', matching the Python codec defaults used by login.py).

const { ValueError, u32, signed32, xtea_decrypt_dekobloko } = require("./crypto.js");

const _BASE37 = "_abcdefghijklmnopqrstuvwxyz0123456789";
// decode_base37's upper cutoff: 37 ** 12 -- far beyond double exactness, so
// the guard comparison must run on BigInt to match Python's int compare.
const BASE37_LIMIT = 6582952005840035281n;

// --- cp1252 -----------------------------------------------------------------

// Bytes 0x80..0x9F map through this table; undefined code points in real
// cp1252 decode as U+FFFD under errors="replace".
const CP1252_HIGH = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

const CP1252_TO_BYTE = new Map();
for (let i = 0; i < 32; i++) {
  if (CP1252_HIGH[i] !== 0xfffd) CP1252_TO_BYTE.set(CP1252_HIGH[i], 0x80 + i);
}

/** raw bytes -> str, like bytes.decode("cp1252", errors="replace"). */
function cp1252_decode(raw) {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    out +=
      b < 0x80 || b >= 0xa0
        ? String.fromCharCode(b)
        : String.fromCharCode(CP1252_HIGH[b - 0x80]);
  }
  return out;
}

/** str -> raw bytes, like str.encode("cp1252", errors="replace"). */
function cp1252_encode(text) {
  const out = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) {
      out.push(cp);
    } else if (CP1252_TO_BYTE.has(cp)) {
      out.push(CP1252_TO_BYTE.get(cp));
    } else {
      out.push(0x3f); // errors="replace" substitutes '?'
    }
  }
  return Buffer.from(out);
}

/**
 * Surface a u64 magnitude as Number when it stays double-exact (< 2**53),
 * else as BigInt, so typical ids/details behave like small Python ints.
 */
function wrap64(value) {
  return value <= 0x1fffffn * 0x100000000n ? Number(value) : value;
}

/** b"%aa %bb"-style spaced hex used by the debug dump and error messages. */
function hex_spaced(data) {
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join(" ");
}

// --- PacketReader -----------------------------------------------------------

class PacketReader {
  constructor(data) {
    this.data = data;
    this.pos = 0;
  }

  remaining() {
    return this.data.length - this.pos;
  }

  read_u8() {
    if (this.pos >= this.data.length) {
      throw new ValueError("not enough data for u8");
    }
    const value = this.data[this.pos];
    this.pos += 1;
    return value;
  }

  read_u16() {
    return this.read_bytes(2).readUInt16BE(0);
  }

  read_u24() {
    const b = this.read_bytes(3);
    return ((b[0] << 16) | (b[1] << 8) | b[2]) >>> 0;
  }

  read_u32() {
    return this.read_bytes(4).readUInt32BE(0);
  }

  read_u64() {
    // hi <= 0x1fffff keeps hi * 2**32 + lo within 2**53, hence exact as Number.
    const b = this.read_bytes(8);
    const hi = b.readUInt32BE(0);
    const lo = b.readUInt32BE(4);
    return hi <= 0x1fffff ? hi * 0x100000000 + lo : (BigInt(hi) << 32n) | BigInt(lo);
  }

  read_i32() {
    return this.read_bytes(4).readInt32BE(0);
  }

  read_bytes(length) {
    const available = Math.max(this.data.length - this.pos, 0);
    const got = Math.min(available, length);
    if (got !== length) {
      throw new ValueError("not enough data: wanted " + length + ", got " + got);
    }
    const value = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return value;
  }

  read_cstring() {
    const end = this.data.indexOf(0, this.pos);
    if (end === -1) throw new ValueError("unterminated string");
    const raw = this.data.subarray(this.pos, end);
    this.pos = end + 1;
    return cp1252_decode(raw);
  }

  read_nullable_cstring() {
    if (this.pos < this.data.length && this.data[this.pos] === 0) {
      this.pos += 1;
      return null;
    }
    return this.read_cstring();
  }
}

// --- dataclass stand-ins ------------------------------------------------------

class LoginPrefix {
  constructor(client_revision, client_detail, flags, client_string, extra_token) {
    this.client_revision = client_revision;
    this.client_detail = client_detail;
    this.flags = flags;
    this.client_string = client_string;
    this.extra_token = extra_token;
    Object.freeze(this);
  }
}

class LoginCredentials {
  constructor(username, password, login_mode, credential_kind, username_raw = 0) {
    this.username = username;
    this.password = password;
    this.login_mode = login_mode;
    this.credential_kind = credential_kind;
    // The RAW u64 from the username slot, before base37 decoding. On a
    // reconnect that slot holds the issued player id, not a packed name --
    // callers must be able to recognise an id before trusting `username`.
    this.username_raw = username_raw;
    Object.freeze(this);
  }
}

class ParsedLogin {
  constructor(
    prefix,
    rsa_plain,
    xtea_keys,
    xtea_plain_length,
    client_seed,
    client_seed_signed,
    challenge_seed,
    challenge_matches,
    random_uid,
    credentials
  ) {
    this.prefix = prefix;
    this.rsa_plain = rsa_plain;
    this.xtea_keys = xtea_keys;
    this.xtea_plain_length = xtea_plain_length;
    this.client_seed = client_seed;
    this.client_seed_signed = client_seed_signed;
    this.challenge_seed = challenge_seed;
    this.challenge_matches = challenge_matches;
    this.random_uid = random_uid;
    this.credentials = credentials;
    Object.freeze(this);
  }
}

// --- name/password codecs -----------------------------------------------------

function decode_base37(value) {
  // BigInt throughout: inputs reach 2**64 and the divmod chain must stay
  // exact (an 11-char name already packs past 2**53).
  const v = typeof value === "bigint" ? value : BigInt(value);
  if (v <= 0n || v >= BASE37_LIMIT || v % 37n === 0n) return v.toString();
  const chars = [];
  let rest = v;
  while (rest !== 0n) {
    const index = Number(rest % 37n);
    rest /= 37n;
    let char = _BASE37[index];
    if (char === "_") {
      if (chars.length > 0) {
        chars[chars.length - 1] = chars[chars.length - 1].toUpperCase();
      }
      char = " ";
    }
    chars.push(char);
  }
  const decoded = chars.reverse().join("").trim();
  return decoded.charAt(0).toUpperCase() + decoded.slice(1);
}

function decode_base38_pair(data) {
  if (data.length !== 14) return data.toString("hex");

  // Each half packs ten base-38 digits (LSB first) into 7 bytes; values reach
  // 38**10 > 2**53, so the divmod runs on BigInt.
  function decode_group(bytes, size) {
    let value = 0n;
    for (const b of bytes) value = (value << 8n) | BigInt(b);
    const chars = [];
    for (let i = 0; i < size; i++) {
      const rem = Number(value % 38n);
      value /= 38n;
      if (rem === 0) chars.push("");
      else if (rem === 1) chars.push(" ");
      else if (rem >= 2 && rem <= 27) chars.push(String.fromCharCode(97 + rem - 2));
      else chars.push(String.fromCharCode(48 + rem - 28));
    }
    return chars;
  }

  const low = decode_group(data.subarray(0, 7), 10);
  const high = decode_group(data.subarray(7, 14), 10);
  return low.concat(high).join("").replace(/ +$/, "");
}

function _parse_credentials(plain, offset, login_mode) {
  // Opt-in because this dumps the decrypted login block, which contains
  // credential material. Set DEKOBLOKO_DEBUG_LOGIN=1 only on a local server
  // you own, and turn it off afterwards.
  if (process.env.DEKOBLOKO_DEBUG_LOGIN === "1") {
    console.log("[login-debug] plain=" + plain.length + "B offset=" + offset + " mode=" + login_mode);
    console.log("[login-debug]   full : " + hex_spaced(plain));
    console.log("[login-debug]   creds: " + hex_spaced(plain.subarray(offset)));
    // Show where a base37-packed name would appear, so a mismatch between
    // "what we read" and "where the name actually is" is visible directly.
    for (const name of ["a", "hello"]) {
      let packed = 0;
      for (const ch of name) packed = packed * 37 + _BASE37.indexOf(ch);
      const needle = Buffer.alloc(8);
      needle.writeBigUInt64BE(BigInt(packed), 0);
      let start = 0;
      while (start < 8 && needle[start] === 0) start++;
      const target = start === 8 ? Buffer.from([0]) : needle.subarray(start);
      const found = plain.indexOf(target);
      console.log(
        "[login-debug]   base37('" + name + "')=" + packed +
        " bytes=" + hex_spaced(needle) +
        " first-seen-at=" + found
      );
    }
    console.log("[login-debug]   literal b'hello' at offset " + plain.indexOf(Buffer.from("hello")));
  }

  if (offset >= plain.length) {
    return new LoginCredentials("Player", "", login_mode, "empty");
  }

  // There are two forms in this client family:
  //
  //   1. string/base38: 00, NUL-terminated email/username, 14-byte packed password
  //   2. base37/base38: u64 packed username, 14-byte packed password
  //
  // The packed u64 username often starts with 00 for normal small names, so a
  // leading zero alone does not identify the string form. It is accepted only
  // with a plausible NUL-terminated printable account string followed by the
  // 14-byte password field; otherwise we fall back to the u64/base37 form.
  if (plain[offset] === 0) {
    try {
      const reader = new PacketReader(plain);
      reader.pos = offset + 1;
      const username = reader.read_cstring();
      if (
        username &&
        reader.remaining() >= 14 &&
        [...username].every((ch) => ch.codePointAt(0) >= 32)
      ) {
        const password = decode_base38_pair(reader.read_bytes(14));
        return new LoginCredentials(username, password, login_mode, "string/base38");
      }
    } catch (err) {
      if (!(err instanceof ValueError)) throw err; // Python catches ValueError only
    }
  }

  const reader = new PacketReader(plain);
  reader.pos = offset;
  if (reader.remaining() >= 22) {
    const username_long = reader.read_u64();
    const password = decode_base38_pair(reader.read_bytes(14));
    return new LoginCredentials(
      decode_base37(username_long),
      password,
      login_mode,
      "base37/base38",
      username_long
    );
  }

  return new LoginCredentials("Player", plain.subarray(offset).toString("hex"), login_mode, "raw");
}

function parse_login_body(body, rsa_key, expected_challenge) {
  const outer = new PacketReader(body);
  const client_revision = outer.read_u32();
  const client_detail = outer.read_u64();
  const flags = outer.read_u8();
  const client_string = outer.read_cstring();
  let extra_token = null;
  if (flags & 0x10) {
    const marker = outer.read_u8();
    if (marker !== 0) {
      throw new ValueError("bad optional login token marker " + marker + "; expected 0");
    }
    extra_token = cp1252_encode(outer.read_cstring());
  }
  const prefix = new LoginPrefix(client_revision, client_detail, flags, client_string, extra_token);

  const rsa_length = outer.read_u16();
  const rsa_cipher = outer.read_bytes(rsa_length);
  const xtea_cipher = outer.read_bytes(outer.remaining());

  const rsa_plain = rsa_key.decrypt_block(rsa_cipher);
  const rsa_reader = new PacketReader(rsa_plain);
  const marker = rsa_reader.read_u8();
  if (marker !== 10) {
    throw new ValueError("bad RSA marker " + marker + "; expected 10; clear=" + hex_spaced(rsa_plain));
  }

  const xtea_keys = [];
  for (let i = 0; i < 4; i++) xtea_keys.push(rsa_reader.read_u32());
  const xtea_plain_length = rsa_reader.read_u16();

  const xtea_plain_padded = xtea_decrypt_dekobloko(xtea_cipher, xtea_keys);
  if (xtea_plain_length > xtea_plain_padded.length) {
    throw new ValueError(
      "XTEA plain length " + xtea_plain_length +
      " exceeds decrypted payload length " + xtea_plain_padded.length
    );
  }
  const xtea_plain = xtea_plain_padded.subarray(0, xtea_plain_length);

  const inner = new PacketReader(xtea_plain);
  const client_seed = [];
  for (let i = 0; i < 4; i++) client_seed.push(inner.read_u32());
  const client_seed_signed = client_seed.map(signed32);
  // ((seed[2] & 0xffffffff) << 32) | (seed[3] & 0xffffffff): a full u64, so
  // assembled in BigInt before the Number/BigInt wrap decision.
  const challenge_seed = wrap64(
    (BigInt(u32(client_seed[2])) << 32n) | BigInt(u32(client_seed[3]))
  );
  const random_uid = inner.read_bytes(24);
  const login_mode = inner.read_u16();
  const credentials = _parse_credentials(xtea_plain, inner.pos, login_mode);

  return new ParsedLogin(
    prefix,
    rsa_plain,
    xtea_keys.map(u32),
    xtea_plain_length,
    client_seed.map(u32),
    client_seed_signed,
    challenge_seed,
    BigInt.asUintN(64, BigInt(expected_challenge)) === BigInt(challenge_seed),
    random_uid,
    credentials
  );
}

module.exports = {
  PacketReader,
  LoginPrefix,
  LoginCredentials,
  ParsedLogin,
  decode_base37,
  decode_base38_pair,
  _parse_credentials,
  parse_login_body,
};
