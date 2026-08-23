'use strict';

// A faithful port of CPython's Mersenne Twister surface -- just enough of
// random.Random for dekobloko_server: seeding by int/BigInt (init_by_array on
// the little-endian 32-bit words of |seed|), getrandbits(k), _randbelow(n)
// and randrange(). HostedGame draws its piece cells and powerup cells through
// rng.randrange(), so pinning the exact PRNG lets tests compare piece
// sequences byte-for-byte against fixtures produced by RUNNING the Python
// code (test/gen-game-lobby-vectors.py).
//
// Reference: CPython Modules/_randommodule.c (random_seed, init_by_array,
// _random_getrandbits below Random.getrandbits) and Lib/random.py
// (_randbelow_with_getrandbits, randrange).

const UINT32 = 0xffffffffn;
const N = 624;
const MATRIX_A = 0x9908b0dfn;
const UPPER_MASK = 0x80000000n;
const LOWER_MASK = 0x7fffffffn;

class PyRandom {
  constructor(seed) {
    this.mt = new Uint32Array(N);
    // Python leaves the generator unseeded (OS entropy) until seed(); mirror
    // that lazily so an explicit seed() right after construction behaves
    // exactly like it does on the Python side.
    this.index = N + 1;
    if (seed !== undefined && seed !== null) {
      this.seed(seed);
    }
  }

  /** random.seed(a) for int/long seeds (version 2). */
  seed(a) {
    let value = BigInt(a);
    if (value < 0n) value = -value; // CPython seeds with abs(value)
    const key = [];
    if (value === 0n) {
      key.push(0);
    }
    while (value > 0n) {
      key.push(Number(value & UINT32));
      value >>= 32n;
    }
    this._init_by_array(key);
  }

  _init_genrand(s) {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < N; i += 1) {
      const prev = this.mt[i - 1];
      // mt[i] = (1812433253 * (mt[i-1] ^ (mt[i-1] >> 30)) + i) mod 2**32
      this.mt[i] =
        (Math.imul(prev ^ (prev >>> 30), 1812433253) + i) >>> 0;
    }
    this.index = N;
  }

  _init_by_array(key) {
    this._init_genrand(19650218);
    let i = 1;
    let j = 0;
    let k = Math.max(N, key.length);
    for (; k > 0; k -= 1) {
      const prev = this.mt[i - 1];
      // (mt[i] ^ ((mt[i-1] ^ (mt[i-1] >> 30)) * 1664525)) + key[j] + j
      this.mt[i] =
        ((this.mt[i] ^
          ((Math.imul(prev ^ (prev >>> 30), 1664525) >>> 0))) +
          key[j] +
          j) >>>
        0;
      i += 1;
      j += 1;
      if (i >= N) {
        this.mt[0] = this.mt[N - 1];
        i = 1;
      }
      if (j >= key.length) {
        j = 0;
      }
    }
    for (let kk = N - 1; kk > 0; kk -= 1) {
      const prev = this.mt[i - 1];
      // (mt[i] ^ ((mt[i-1] ^ (mt[i-1] >> 30)) * 1566083941)) - i
      this.mt[i] =
        ((this.mt[i] ^
          (Math.imul(prev ^ (prev >>> 30), 1566083941) >>> 0)) -
          i) >>>
        0;
      i += 1;
      if (i >= N) {
        this.mt[0] = this.mt[N - 1];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
    this.index = N;
  }

  _generate() {
    for (let i = 0; i < N; i += 1) {
      const y =
        (this.mt[i] & 0x80000000) | (this.mt[(i + 1) % N] & 0x7fffffff);
      let next = this.mt[(i + 397) % N] ^ (y >>> 1);
      if (y & 1) next ^= 0x9908b0df;
      this.mt[i] = next >>> 0;
    }
    this.index = 0;
  }

  genrand_uint32() {
    if (this.index >= N) {
      this._generate();
    }
    let y = this.mt[this.index];
    this.index += 1;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /**
   * random.getrandbits(k): k <= 0 yields 0; otherwise ceil(k/32) words,
   * little-endian, with the top word shifted right so only k bits remain.
   */
  getrandbits(k) {
    if (!Number.isInteger(k) || k < 0) {
      throw new RangeError("number of bits must be a non-negative integer");
    }
    if (k === 0) return 0n;
    const words = Math.floor((k - 1) / 32) + 1;
    let result = 0n;
    for (let i = 0; i < words; i += 1) {
      let r = this.genrand_uint32();
      if (i === words - 1 && k !== words * 32) {
        r >>>= words * 32 - k;
      }
      result |= BigInt(r) << BigInt(32 * i);
    }
    return result;
  }

  _bit_length(n) {
    return n.toString(2).length;
  }

  /** Lib/random.py::_randbelow_with_getrandbits. */
  _randbelow(n) {
    if (n <= 0) throw new ValueErrorLike();
    const nb = BigInt(n);
    const k = this._bit_length(nb);
    let r = this.getrandbits(k);
    while (r >= nb) {
      r = this.getrandbits(k);
    }
    return r;
  }

  /**
   * random.randrange(stop) or randrange(start, stop). Only the one- and
   * two-int forms the server uses are provided.
   */
  randrange(start, stop) {
    let lo = 0;
    let hi;
    if (stop === undefined) {
      hi = start;
    } else {
      lo = start;
      hi = stop;
    }
    const width = BigInt(hi) - BigInt(lo);
    if (width <= 0n) {
      throw new RangeError(
        "empty range for randrange (" + lo + ", " + hi + ")"
      );
    }
    return Number(BigInt(lo) + this._randbelow(Number(width)));
  }

  /** random.random(): two draws, 53 bits. Included for completeness. */
  random() {
    const a = this.genrand_uint32() >>> 5; // 27 bits
    const b = this.genrand_uint32() >>> 6; // 26 bits
    return (a * 67108864 + b) / 9007199254740992;
  }
}

class ValueErrorLike extends Error {
  constructor(message) {
    super(message === undefined ? "cannot pick from an empty range" : message);
    this.name = "ValueError";
  }
}

module.exports = { PyRandom };
