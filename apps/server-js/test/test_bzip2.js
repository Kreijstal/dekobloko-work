"use strict";
// Golden-vector tests for src/bzip2.js.
// Expected bytes were produced by RUNNING Python's bz2 (test/gen-vectors.py).

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { bzip2_decompress, crc32, crc32_bzip2 } = require("../src/bzip2.js");

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "bzip2.json"), "utf8")
);

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function run() {
  const meta = FIXTURE._meta;

  // CRC flavours: reflected (zlib) vs non-reflected (bzip2 blocks).
  assert.strictEqual(crc32(Buffer.from("hello")), meta.crc32_zlib_hello >>> 0, "crc32(hello) vs zlib.crc32");
  assert.strictEqual(crc32_bzip2(Buffer.from("123456789")), 0xfc891918, "CRC-32/BZIP2 check value");
  assert.notStrictEqual(crc32(Buffer.from("123456789")), crc32_bzip2(Buffer.from("123456789")),
    "flavours must not coincide on the catalogue string");

  for (const vec of FIXTURE.vectors) {
    const comp = Buffer.from(vec.compressed_hex, "hex");
    const out = bzip2_decompress(comp);
    assert.strictEqual(out.length, vec.plain_len, vec.name + ": length");
    assert.strictEqual(sha256(out), vec.plain_sha256, vec.name + ": sha256");
    assert.strictEqual(out.subarray(0, 32).toString("hex"), vec.plain_head_hex, vec.name + ": head");
    assert.strictEqual(out.subarray(-32).toString("hex"), vec.plain_tail_hex, vec.name + ": tail");
    if (vec.plain_hex !== null) {
      assert.ok(out.equals(Buffer.from(vec.plain_hex, "hex")), vec.name + ": full byte equality");
    }
  }

  // multiblock: rebuild the deterministic payload and compare byte-for-byte.
  const mb = FIXTURE.vectors.find((v) => v.name === "multiblock");
  assert.ok(mb && mb.blocks >= 2, "multiblock fixture has >=2 blocks");
  const unit = Buffer.from("abcdefghij".repeat(12));
  const big = Buffer.concat(Array(20000).fill(unit));
  assert.ok(bzip2_decompress(Buffer.from(mb.compressed_hex, "hex")).equals(big),
    "multiblock byte-exact across block boundaries");

  // multimember: concatenation of independent members decodes as one stream.
  const mm = FIXTURE.vectors.find((v) => v.name === "multimember");
  assert.ok(
    bzip2_decompress(Buffer.from(mm.compressed_hex, "hex"))
      .equals(Buffer.from(mm.member_plain_hex, "hex")),
    "multimember decode"
  );

  // Error paths.
  assert.throws(() => bzip2_decompress(Buffer.from("this is not bz2 data")), /bad magic/,
    "garbage input rejected");
  const tiny = Buffer.from(FIXTURE.vectors.find((v) => v.name === "tiny").compressed_hex, "hex");
  // NOTE: trimming only the file tail would NOT be an error -- libbz2 files
  // carry slack bytes after the terminator which a decoder may ignore -- so
  // truncate well into the block data instead.
  assert.throws(() => bzip2_decompress(tiny.subarray(0, Math.floor(tiny.length * 0.6))),
    /truncated|corrupt|eof/i, "mid-block truncation rejected");
  assert.throws(
    () => {
      const flipped = Buffer.from(tiny);
      flipped[20] ^= 0xff; // corrupt Huffman/CRC territory
      bzip2_decompress(flipped);
    },
    (e) => /^bzip2: /.test(e.message), // note: regex form would see "Error: bzip2: ..."
    "bit-flip corruption rejected"
  );
  assert.throws(() => {
    // Valid header, impossible level digit.
    const bad = Buffer.from("BZh0" + tiny.subarray(4).toString("binary"), "binary");
    bzip2_decompress(bad);
  }, /level/, "level digit validated");
}

module.exports = { run };

if (require.main === module) {
  run().then(
    () => console.log("test_bzip2.js: OK"),
    (e) => {
      console.error("test_bzip2.js FAILED:", e.message);
      process.exit(1);
    }
  );
}
