'use strict';

// Port of dekobloko_server/huffman.py: chat text Huffman codec.
//
// Chat bodies are compressed with the table the client loads from archive 3,
// file "huffman". Code VALUES were dumped from the client's own jk class into
// huffman-codes.csv (char,bitlength,code rows) rather than reimplemented.
// Verified against captured traffic: e7 bc -> "test", 8d 09 80 -> "lmao".

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'huffman-codes.csv');
let _table = null;

function load() {
  if (_table === null) {
    _table = {};
    const rows = fs
      .readFileSync(CSV_PATH, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '');
    for (const row of rows) {
      const [ch, ln, code] = row.split(',');
      const bitLength = parseInt(ln, 10);
      const codeValue = parseInt(code, 10);
      if (!_table[bitLength]) _table[bitLength] = {};
      _table[bitLength][codeValue] = parseInt(ch, 10);
    }
  }
  return _table;
}

// Decode `count` characters from Huffman-compressed `data`.
// Bits are consumed MSB-first; decoding stops at count even if bits remain,
// which is expected since the final byte is usually padded.
function decode(data, count) {
  const table = load();
  const out = [];
  let cur = 0;
  let length = 0;
  for (const byte of data) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      cur = ((cur << 1) | ((byte >> bit) & 1)) >>> 0;
      length += 1;
      const bucket = table[length];
      if (bucket && Object.prototype.hasOwnProperty.call(bucket, cur)) {
        out.push(String.fromCharCode(bucket[cur]));
        cur = 0;
        length = 0;
        if (out.length === count) return out.join('');
      }
    }
  }
  return out.join('');
}

module.exports = { decode, load };
