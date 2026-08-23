"use strict";
// Dependency-free BZIP2 decompressor.
//
// Node's zlib covers gzip/deflate but not bzip2, and this port must have zero
// npm dependencies -- so cache.py's `import bz2` is served by this module.
// It implements the full bzip2 container: multi-member streams, multiple
// blocks per member, up to 6 Huffman tables with MTF-selected groups, RUNA/RUNB
// run symbols, inverse BWT and the final RLE1 pass. Every block is verified
// against its stored CRC32, same as libbz2.
//
// Deliberate gap: blocks with the "randomised" flag set are rejected. No
// released bzip2 compressor ever emits that flag (it was disabled before
// 0.9.0), Python's bz2 cannot produce one for golden vectors, and the 512-entry
// randomisation table is not derivable from anything shipped locally. If a
// cache ever contains such a block this throws a clear error rather than
// returning garbage.

const BLOCK_MAGIC = [0x31, 0x41, 0x59, 0x26, 0x53, 0x59]; // pi
const EOS_MAGIC = [0x17, 0x72, 0x45, 0x38, 0x50, 0x90]; // sqrt(pi)

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? Math.imul(c >>> 1, 0xedb88320) ^ 0xffffffff : c >>> 1;
    table[n] = c | 0;
  }
  return table;
})();

/** Standard IEEE CRC32 (identical polynomial/init/finalise to zlib.crc32,
 * which is what bzip2 block CRCs use). */
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

class BitReader {
  constructor(buf) {
    this.buf = buf;
    this.bitPos = 0; // absolute bit position
  }
  get bitsLeft() {
    return this.buf.length * 8 - this.bitPos;
  }
  readBits(n) {
    if (this.bitsLeft < n) throw new Error("bzip2: truncated stream");
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.buf[this.bitPos >> 3];
      v = v * 2 + ((byte >> (7 - (this.bitPos & 7))) & 1);
      this.bitPos++;
    }
    return v;
  }
  peekBits(n) {
    const save = this.bitPos;
    try {
      return this.readBits(n);
    } finally {
      this.bitPos = save;
    }
  }
  alignToByte() {
    this.bitPos = (this.bitPos + 7) & ~7;
  }
}

function makeHuffmanTable(lengths, alphaSize) {
  let minLen = 32;
  let maxLen = 0;
  for (let i = 0; i < alphaSize; i++) {
    if (lengths[i] > maxLen) maxLen = lengths[i];
    if (lengths[i] < minLen) minLen = lengths[i];
  }
  const perm = new Int32Array(alphaSize);
  let pp = 0;
  for (let l = minLen; l <= maxLen; l++) {
    for (let j = 0; j < alphaSize; j++) if (lengths[j] === l) perm[pp++] = j;
  }
  // base[c] counts codes of length < c before offset adjustment (as in bzlib).
  const base = new Int32Array(25);
  for (let i = 0; i < alphaSize; i++) base[lengths[i] + 1]++;
  for (let i = 1; i < 25; i++) base[i] += base[i - 1];
  const limit = new Int32Array(25);
  let vec = 0;
  for (let l = minLen; l <= maxLen; l++) {
    vec += base[l + 1] - base[l];
    limit[l] = vec - 1;
    vec *= 2;
  }
  for (let l = minLen + 1; l <= maxLen; l++) {
    base[l] = (limit[l - 1] + 1) * 2 - base[l + 1];
  }
  return { minLen, maxLen, limit, base, perm };
}

function decodeSymbol(br, table) {
  let zn = table.minLen;
  let zvec = br.readBits(zn);
  while (zn <= 20 && zvec > table.limit[zn]) {
    zn++;
    zvec = zvec * 2 + br.readBits(1);
  }
  if (zn > 20 || zvec - table.base[zn] < 0 || zvec - table.base[zn] >= table.perm.length) {
    throw new Error("bzip2: corrupt Huffman stream");
  }
  return table.perm[zvec - table.base[zn]];
}

/** Decompress a complete .bz2 member stream (possibly several concatenated). */
function bzip2_decompress(input) {
  if (!(input instanceof Buffer)) input = Buffer.from(input);
  const br = new BitReader(input);
  const members = [];
  for (;;) {
    // Member header "BZh" + level digit, byte aligned at member start.
    if (br.bitsLeft < 32) break; // under 4 bytes left: no room for another member
    const BZH = charCode("B") * 65536 + charCode("Z") * 256 + charCode("h");
    if (br.peekBits(24) !== BZH) {
      if (members.length === 0) throw new Error("bzip2: bad magic");
      break; // trailing non-member bytes: stop like GzipFile would
    }
    br.readBits(24);
    const level = br.readBits(8); // ASCII digit consumed as raw byte value
    const digit = String.fromCharCode(level);
    if (!/^[1-9]$/.test(digit)) throw new Error("bzip2: bad level " + JSON.stringify(digit));
    const blockSize100k = Number(digit);

    const blockMax = blockSize100k * 100000;

    for (;;) {
      const magic = readMagic(br);
      if (isMagic(magic, EOS_MAGIC)) break;
      if (!isMagic(magic, BLOCK_MAGIC)) throw new Error("bzip2: bad block magic");
      members.push(decodeBlock(br, blockMax));
    }

    br.alignToByte();
    // Multi-member stream? Loop again if another "BZh" header follows.
    if (br.bitsLeft < 32 || br.peekBits(24) !== BZH) {
      break;
    }
  }
  if (members.length === 0) throw new Error("bzip2: empty stream");
  return Buffer.concat(members);
}

function charCode(c) {
  return c.charCodeAt(0);
}

function readMagic(br) {
  const out = new Array(6);
  for (let i = 0; i < 6; i++) out[i] = br.readBits(8);
  return out;
}

function isMagic(got, want) {
  for (let i = 0; i < 6; i++) if (got[i] !== want[i]) return false;
  return true;
}

function decodeBlock(br, blockMax) {
  const storedCrc = br.readBits(32) >>> 0;
  const randomized = br.readBits(1);
  if (randomized) throw new Error("bzip2: randomized blocks not supported (never produced in practice)");
  const origPtr = br.readBits(24);

  // Symbol map: 16 granularity flags, then a 16-bit bitmap per used group.
  const seqToUnseq = [];
  const usedGroups = br.readBits(16);
  for (let g = 0; g < 16; g++) {
    if (!((usedGroups >> (15 - g)) & 1)) continue;
    const bitmap = br.readBits(16);
    for (let b = 0; b < 16; b++) {
      if ((bitmap >> (15 - b)) & 1) seqToUnseq.push(g * 16 + b);
    }
  }
  const nInUse = seqToUnseq.length;
  if (nInUse === 0) throw new Error("bzip2: empty symbol map");
  const alphaSize = nInUse + 2;
  const EOB = alphaSize - 1;

  // Huffman table count and MTF-coded selector list.
  const nGroups = br.readBits(3) + 1;
  const nSelectors = br.readBits(15) + 1;
  if (nGroups > 6) throw new Error("bzip2: too many tables");
  const selectorMtf = new Int32Array(nSelectors);
  for (let j = 0; j < nSelectors; j++) {
    let k = 0;
    while (br.readBits(1)) {
      k++;
      if (k >= nGroups) throw new Error("bzip2: selector out of range");
    }
    selectorMtf[j] = k;
  }
  const pos = new Int32Array(nGroups);
  for (let i = 0; i < nGroups; i++) pos[i] = i;
  const selectors = new Int32Array(nSelectors);
  for (let j = 0; j < nSelectors; j++) {
    const v = selectorMtf[j];
    const tmp = pos[v];
    for (let k = v; k > 0; k--) pos[k] = pos[k - 1];
    pos[0] = tmp;
    selectors[j] = tmp;
  }

  // The Huffman tables themselves.
  const tables = [];
  for (let t = 0; t < nGroups; t++) {
    const lengths = new Int32Array(alphaSize);
    let curr = br.readBits(5);
    for (let s = 0; s < alphaSize; s++) {
      for (;;) {
        if (curr < 1 || curr > 20) throw new Error("bzip2: bad code length");
        if (!br.readBits(1)) break;
        curr += br.readBits(1) ? -1 : 1;
      }
      lengths[s] = curr;
    }
    tables.push(makeHuffmanTable(lengths, alphaSize));
  }

  // MTF/RLE2 symbol decoding into the BWT string.
  const bwt = Buffer.allocUnsafe(blockMax);
  let nblock = 0;
  const unzftab = new Int32Array(256);
  const mtf = Buffer.from(seqToUnseq); // move-to-front buffer, nInUse entries
  let groupPos = 0;
  let gSel = -1;
  let table = null;
  let runLen = 0;
  let runBit = 0;
  const nextSym = () => {
    if (groupPos === 0) {
      gSel++;
      if (gSel >= nSelectors) throw new Error("bzip2: ran out of selectors");
      table = tables[selectors[gSel]];
      groupPos = 50;
    }
    groupPos--;
    return decodeSymbol(br, table);
  };
  const emit = (byte, count) => {
    for (let i = 0; i < count; i++) {
      if (nblock >= blockMax) throw new Error("bzip2: block overflow");
      bwt[nblock++] = byte;
      unzftab[byte]++;
    }
  };
  for (;;) {
    const sym = nextSym();
    if (sym === 0 || sym === 1) {
      // RUNA / RUNB accumulate a run length of the current front byte.
      runLen += (sym + 1) << runBit;
      runBit++;
      continue;
    }
    if (runLen > 0) {
      emit(mtf[0], runLen);
      runLen = 0;
      runBit = 0;
    }
    if (sym === EOB) break;
    const nn = sym - 1;
    if (nn >= nInUse || nn < 1) throw new Error("bzip2: bad MTF index");
    const ch = mtf[nn];
    for (let i = nn; i > 0; i--) mtf[i] = mtf[i - 1];
    mtf[0] = ch;
    emit(ch, 1);
  }
  if (runLen > 0) emit(mtf[0], runLen); // defensive; encoder never ends on a run

  if (origPtr >= nblock) throw new Error("bzip2: origPtr out of range");

  // Inverse BWT via LF mapping.
  const cftab = new Int32Array(257);
  for (let i = 0; i < nblock; i++) cftab[bwt[i] + 1]++;
  for (let i = 1; i <= 256; i++) cftab[i] += cftab[i - 1];
  const tt = new Int32Array(nblock);
  for (let i = 0; i < nblock; i++) tt[cftab[bwt[i]]++] = i;
  const decoded = Buffer.allocUnsafe(nblock);
  let p = tt[origPtr];
  for (let i = 0; i < nblock; i++) {
    decoded[i] = bwt[p];
    p = tt[p];
  }

  // Final RLE1 pass: four equal bytes are followed by a repeat-count byte.
  const out = [];
  let i = 0;
  while (i < nblock) {
    const c = decoded[i];
    let run = 1;
    while (run < 4 && i + run < nblock && decoded[i + run] === c) run++;
    if (run < 4) {
      out.push(decoded.subarray(i, i + run));
      i += run;
    } else {
      if (i + 4 >= nblock) throw new Error("bzip2: truncated RLE run");
      const extra = decoded[i + 4];
      const chunk = Buffer.alloc(4 + extra);
      chunk.fill(c);
      out.push(chunk);
      i += 5;
    }
  }
  const plain = Buffer.concat(out);

  // Verify the block CRC over the fully decoded bytes.
  const got = crc32(plain);
  if (got !== storedCrc) {
    throw new Error(
      "bzip2: block CRC mismatch (stored 0x" +
        storedCrc.toString(16).padStart(8, "0") +
        " computed 0x" +
        got.toString(16).padStart(8, "0") +
        ")"
    );
  }
  return plain;
}

/** cache.py / js5.py pattern: bz2.decompress(b"BZh1" + body). */
function bzip2_decompress_bzh1(body) {
  return bzip2_decompress(Buffer.concat([Buffer.from("BZh1", "ascii"), body]));
}

module.exports = { bzip2_decompress, bzip2_decompress_bzh1, crc32 };
