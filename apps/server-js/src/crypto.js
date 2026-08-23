"use strict";

// Port of dekobloko_server/crypto.py.
//
// Three concerns live here, exactly as in Python:
//   * 32-bit integer helpers (u32/signed32/urshift/i32/read_i32_be),
//   * XTEA with the dekobloko twist -- the second half-step indexes its key
//     with (total & 0x1BC4) >> 11, NOT the canonical (total >> 11) & 3,
//   * ISAAC as the Java client implements it (the seed-add ordering in _init
//     deviates from the reference paper on purpose; see crypto.py comments),
//   * RSA private-key decryption, the only place where BigInt is allowed --
//     every other path stays inside the double-exact 32-bit idiom
//     (Math.imul / | 0 / >>> 0) so wraparound matches Python's masking.
//
// Public names keep snake_case so diffs against crypto.py stay mechanical.

const U32_MASK = 0xffffffff;
const DELTA = 0x9e3779b9;
const XTEA_SUM_32 = (DELTA * 32) >>> 0; // 0xC6EF3720

/** Python's u32(): reduce any int (Number or BigInt) into [0, 2**32). */
function u32(value) {
  if (typeof value === "bigint") return Number(BigInt.asUintN(32, value));
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError("u32() requires an integer");
  }
  return value >>> 0; // ToUint32: exact mod 2**32 for any finite integral input
}

/** Python's signed32(): reinterpret a u32 as two's-complement i32. */
function signed32(value) {
  const v = u32(value);
  return v & 0x80000000 ? v - 0x100000000 : v;
}

/** Compatibility alias: crypto.py defines i32 = signed32. */
function i32(value) {
  return signed32(value);
}

/** Python's urshift(): logical right shift over the 32-bit image. */
function urshift(value, bits) {
  return u32(value) >>> bits;
}

/**
 * Python's read_i32_be(): int.from_bytes(data[offset:offset+4], "big",
 * signed=True). Mirrors the slicing quirk faithfully -- a short tail slice
 * decodes as a SHORT unsigned value instead of raising, because Python
 * slices silently clamp. Negative offsets are not supported (unused).
 */
function read_i32_be(data, offset) {
  let value = 0;
  const end = Math.min(offset + 4, data.length);
  for (let i = Math.max(offset, 0); i < end; i++) value = value * 0x100 + data[i];
  if (end - offset === 4 && value >= 0x80000000) value -= 0x100000000;
  return value;
}

/** Python raises ValueError; mirror the type name for downstream catches. */
class ValueError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
}

// --- BigInt corner (RSA only; nothing else may leave 32-bit land) ----------

/** Square-and-multiply modular exponentiation over BigInt. */
function mod_pow(base, exponent, modulus) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % modulus;
    base = (base * base) % modulus;
    exponent >>= 1n;
  }
  return result;
}

/** Minimal-length big-endian bytes of a non-negative BigInt (no padding). */
function bigint_to_bytes(value) {
  const bytes = [];
  let v = value;
  do {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  } while (v > 0n);
  return Buffer.from(bytes.reverse());
}

// --- XTEA ------------------------------------------------------------------
//
// All state is kept as unsigned doubles in [0, 2**32); every Python u32()
// becomes a >>> 0 and every add/sub/xor rides the exact-mod-2**32 behaviour
// of |0 / >>> 0. No multiplies, so Math.imul is not needed here.

function xtea_keys(keys) {
  const list = Array.from(keys);
  if (list.length !== 4) throw new ValueError("XTEA requires exactly 4 keys");
  return [u32(list[0]), u32(list[1]), u32(list[2]), u32(list[3])];
}

function xtea_check_data(data) {
  if (data.length % 8 !== 0) {
    throw new ValueError("XTEA payload length must be a multiple of 8");
  }
}

function xtea_decrypt_dekobloko(data, keys) {
  const key = xtea_keys(keys);
  xtea_check_data(data);
  const output = Buffer.allocUnsafe(data.length);

  for (let offset = 0; offset < data.length; offset += 8) {
    let v0 = data.readUInt32BE(offset);
    let v1 = data.readUInt32BE(offset + 4);
    let total = XTEA_SUM_32;

    for (let round = 0; round < 32; round++) {
      // v1 -= u32(total + key[(total & 0x1BC4) >> 11])
      //      ^ u32(v0 + (u32(v0 << 4) ^ urshift(v0, 5)))
      const t1 = ((total + key[(total & 0x1bc4) >> 11]) >>> 0) ^
        ((v0 + (((v0 << 4) ^ (v0 >>> 5)) >>> 0)) >>> 0);
      v1 = (v1 - t1) >>> 0;
      total = (total - DELTA) >>> 0;
      // v0 -= u32(total + key[total & 3]) ^ u32((urshift(v1, 5) ^ u32(v1 << 4)) + v1)
      const t0 = ((total + key[total & 3]) >>> 0) ^
        ((((v1 >>> 5) ^ (v1 << 4)) >>> 0) + v1);
      v0 = (v0 - t0) >>> 0;
    }

    output.writeUInt32BE(v0, offset);
    output.writeUInt32BE(v1, offset + 4);
  }

  return output;
}

function xtea_encrypt_dekobloko(data, keys) {
  const key = xtea_keys(keys);
  xtea_check_data(data);
  const output = Buffer.allocUnsafe(data.length);

  for (let offset = 0; offset < data.length; offset += 8) {
    let v0 = data.readUInt32BE(offset);
    let v1 = data.readUInt32BE(offset + 4);
    let total = 0;

    for (let round = 0; round < 32; round++) {
      // v0 += u32(total + key[total & 3]) ^ u32((urshift(v1, 5) ^ u32(v1 << 4)) + v1)
      const t0 = ((total + key[total & 3]) >>> 0) ^
        ((((v1 >>> 5) ^ (v1 << 4)) >>> 0) + v1);
      v0 = (v0 + t0) >>> 0;
      total = (total + DELTA) >>> 0;
      // v1 += u32(total + key[(total & 0x1BC4) >> 11])
      //      ^ u32(v0 + (u32(v0 << 4) ^ urshift(v0, 5)))
      const t1 = ((total + key[(total & 0x1bc4) >> 11]) >>> 0) ^
        ((v0 + (((v0 << 4) ^ (v0 >>> 5)) >>> 0)) >>> 0);
      v1 = (v1 + t1) >>> 0;
    }

    output.writeUInt32BE(v0, offset);
    output.writeUInt32BE(v1, offset + 4);
  }

  return output;
}

/** Compatibility aliases used by the game server implementation. */
function xtea_decrypt(data, keys) {
  return xtea_decrypt_dekobloko(data, keys);
}

function xtea_encrypt(data, keys) {
  return xtea_encrypt_dekobloko(data, keys);
}

// --- ISAAC -----------------------------------------------------------------
//
// Mirrors crypto.py exactly, which itself mirrors a Java client whose _init
// deviates from the reference ISAAC on purpose: all eight seed adds happen
// before any mixing, and the b += rsl[i+1] add sits last inside that add
// block. Do not "clean up" the ordering -- the golden vectors encode it.

const ADD = (x, y) => (x + y) >>> 0;
const XOR_SHL = (x, y, s) => (x ^ ((y << s) | 0)) >>> 0;
const XOR_SHR = (x, y, s) => (x ^ (y >>> s)) >>> 0;

/** One round of the ISAAC mix, shared verbatim by every pass of _init. */
function isaac_mix(s) {
  s.n8 = XOR_SHL(s.n8, s.n5, 11);
  s.n5 = XOR_SHR(ADD(s.n5, s.n6), s.n6, 2);
  s.n4 = ADD(s.n4, s.n5);
  s.n3 = ADD(s.n3, s.n8);
  s.n6 = XOR_SHL(ADD(s.n6, s.n3), s.n3, 8);
  s.n9 = ADD(s.n9, s.n6);
  s.n3 = XOR_SHR(ADD(s.n3, s.n4), s.n4, 16);
  s.n10 = ADD(s.n10, s.n3);
  s.n4 = XOR_SHL(ADD(s.n4, s.n9), s.n9, 10);
  s.n7 = ADD(s.n7, s.n4);
  s.n9 = XOR_SHR(ADD(s.n9, s.n10), s.n10, 4);
  s.n8 = ADD(s.n8, s.n9);
  s.n10 = XOR_SHL(ADD(s.n10, s.n7), s.n7, 8);
  s.n5 = ADD(s.n5, s.n10);
  s.n7 = XOR_SHR(ADD(s.n7, s.n8), s.n8, 9);
  s.n6 = ADD(s.n6, s.n7);
  s.n8 = ADD(s.n8, s.n5);
}

class IsaacCipher {
  constructor(seed) {
    this.mem = new Array(256).fill(0);
    this.results = new Array(256).fill(0);
    this.a = 0;
    this.b = 0;
    this.c = 0;
    this.count = 0;
    const limit = Math.min(seed.length, 256); // Python: seed[:256]
    for (let index = 0; index < limit; index++) {
      this.results[index] = u32(seed[index]);
    }
    this._init();
  }

  next() {
    if (this.count === 0) {
      this._generate();
      this.count = 256;
    }
    this.count -= 1;
    return this.results[this.count];
  }

  // Monkeypatched helpers on the Python side, real methods here.
  next_int() {
    return this.next();
  }

  next_byte() {
    return this.next() & 0xff;
  }

  encrypt_opcode(opcode) {
    return (opcode + (this.next() & 0xff)) & 0xff;
  }

  decrypt_opcode(encoded) {
    return (encoded - (this.next() & 0xff)) & 0xff;
  }

  _init() {
    const self = {
      n3: DELTA, n4: DELTA, n5: DELTA,
      n6: DELTA, n7: DELTA, n8: DELTA, n9: DELTA, n10: DELTA,
    };

    for (let i = 0; i < 4; i++) isaac_mix(self);

    // Pass 1: mix the seed words into mem.
    for (let offset = 0; offset < 256; offset += 8) {
      const rsl = this.results;
      // All eight adds first (order preserved from crypto.py), then one mix.
      self.n7 = ADD(self.n7, rsl[offset + 7]);
      self.n3 = ADD(self.n3, rsl[offset + 3]);
      self.n10 = ADD(self.n10, rsl[offset + 6]);
      self.n4 = ADD(self.n4, rsl[offset + 4]);
      self.n9 = ADD(self.n9, rsl[offset + 5]);
      self.n8 = ADD(self.n8, rsl[offset]);
      self.n6 = ADD(self.n6, rsl[offset + 2]);
      self.n5 = ADD(self.n5, rsl[offset + 1]); // must precede the mix, see header
      isaac_mix(self);

      this.mem[offset] = self.n8;
      this.mem[offset + 1] = self.n5;
      this.mem[offset + 2] = self.n6;
      this.mem[offset + 3] = self.n3;
      this.mem[offset + 4] = self.n4;
      this.mem[offset + 5] = self.n9;
      this.mem[offset + 6] = self.n10;
      this.mem[offset + 7] = self.n7;
    }

    // Pass 2: stir mem with itself.
    for (let offset = 0; offset < 256; offset += 8) {
      const m = this.mem;
      self.n7 = ADD(self.n7, m[offset + 7]);
      self.n3 = ADD(self.n3, m[offset + 3]);
      self.n8 = ADD(self.n8, m[offset]);
      self.n9 = ADD(self.n9, m[offset + 5]);
      self.n10 = ADD(self.n10, m[offset + 6]);
      self.n4 = ADD(self.n4, m[offset + 4]);
      self.n6 = ADD(self.n6, m[offset + 2]);
      self.n5 = ADD(self.n5, m[offset + 1]); // must precede the mix, see header
      isaac_mix(self);

      this.mem[offset] = self.n8;
      this.mem[offset + 1] = self.n5;
      this.mem[offset + 2] = self.n6;
      this.mem[offset + 3] = self.n3;
      this.mem[offset + 4] = self.n4;
      this.mem[offset + 5] = self.n9;
      this.mem[offset + 6] = self.n10;
      this.mem[offset + 7] = self.n7;
    }

    this._generate();
    this.count = 256;
  }

  _generate() {
    this.c = ADD(this.c, 1);
    this.b = ADD(this.b, this.c);

    for (let i = 0; i < 256; i++) {
      const x = this.mem[i];
      if ((i & 2) === 0) {
        if ((i & 1) === 0) this.a = XOR_SHL(this.a, this.a, 13);
        else this.a = XOR_SHR(this.a, this.a, 6);
      } else {
        if ((i & 1) === 0) this.a = XOR_SHL(this.a, this.a, 2);
        else this.a = XOR_SHR(this.a, this.a, 16);
      }

      this.a = ADD(this.a, this.mem[(i + 128) & 0xff]);
      const y = ADD(ADD(this.mem[(x & 0x3fc) >> 2], this.a), this.b);
      this.mem[i] = y;
      this.b = ADD(x, this.mem[(y >> 10) & 0xff]);
      this.results[i] = this.b;
    }
  }
}

// --- RSA -------------------------------------------------------------------
//
// The only BigInt citizen in the port: moduli have nowhere near 32-bit
// reach. Key components are held as BigInt; JSON accepts decimal strings or
// numbers exactly like Python's int(data["n"]).

const DEFAULT_E = 65537;

class RsaPrivateKey {
  /**
   * Mirrors the frozen dataclass: RsaPrivateKey({ n, d, e = 65537 }).
   * Components accept Number or decimal string, like Python int().
   */
  constructor(fields) {
    if (fields === null || typeof fields !== "object") {
      throw new TypeError("RsaPrivateKey expects { n, d, e }");
    }
    const e = fields.e === undefined ? DEFAULT_E : fields.e;
    this.n = BigInt(fields.n);
    this.d = BigInt(fields.d);
    this.e = BigInt(e);
    Object.freeze(this);
  }

  /** Python: RsaPrivateKey.from_json(path). */
  static from_json(path) {
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    return new RsaPrivateKey({
      n: data.n,
      d: data.d,
      e: data.e === undefined ? DEFAULT_E : data.e,
    });
  }

  /** crypto.py monkeypatches RsaPrivateKey.load as an alias of from_json. */
  static load(path) {
    return RsaPrivateKey.from_json(path);
  }

  decrypt_block(encrypted) {
    let cipher_int = 0n;
    for (let i = 0; i < encrypted.length; i++) {
      cipher_int = (cipher_int << 8n) | BigInt(encrypted[i]);
    }
    const plain_int = mod_pow(cipher_int, this.d, this.n);
    if (plain_int === 0n) return Buffer.from([0]);
    // Minimal big-endian bytes == to_bytes(bit_length-based size) followed by
    // the leading-zero strip loop: both collapse to "no leading zero byte".
    return bigint_to_bytes(plain_int);
  }
}

module.exports = {
  ValueError,
  u32,
  signed32,
  i32,
  urshift,
  read_i32_be,
  xtea_decrypt_dekobloko,
  xtea_encrypt_dekobloko,
  xtea_decrypt,
  xtea_encrypt,
  IsaacCipher,
  RsaPrivateKey,
};



