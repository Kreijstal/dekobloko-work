'use strict';

// Port of dekobloko_server/io.py (framing primitives).
//
// Python reads/writes a real socket; to keep this logic unit-testable the same
// surface is mirrored behind a tiny interface that main.js will adapt net.Socket
// to:
//   reader: { recv(size) -> Buffer }  may return FEWER bytes than requested;
//                                     an empty Buffer or null/undefined means EOF
//   writer: { sendAll(buffer) }       must fully consume the given buffer

class EOFError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EOFError';
  }
}

function read_exact(reader, size) {
  const parts = [];
  let have = 0;
  while (have < size) {
    const chunk = reader.recv(size - have);
    if (chunk === null || chunk === undefined || chunk.length === 0) {
      throw new EOFError('socket closed while reading ' + size + ' bytes');
    }
    parts.push(chunk);
    have += chunk.length;
  }
  return Buffer.concat(parts);
}

function read_u8(reader) {
  return read_exact(reader, 1)[0];
}

function read_u16(reader) {
  return read_exact(reader, 2).readUInt16BE(0);
}

function read_i32(reader) {
  return read_exact(reader, 4).readInt32BE(0);
}

function write_u8(writer, value) {
  writer.sendAll(Buffer.from([value & 0xff]));
}

function write_u16(writer, value) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE((value & 0xffff) >>> 0, 0);
  writer.sendAll(buf);
}

function write_u64(writer, value) {
  const masked = BigInt(value) & 0xffffffffffffffffn;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(masked, 0);
  writer.sendAll(buf);
}

function hex_preview(data, limit = 32) {
  const head = data.subarray(0, limit);
  const shown = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join(' ');
  if (data.length > limit) {
    return shown + ' ... (' + data.length + ' bytes)';
  }
  return shown + ' (' + data.length + ' bytes)';
}

module.exports = {
  EOFError,
  read_exact,
  read_u8,
  read_u16,
  read_i32,
  write_u8,
  write_u16,
  write_u64,
  hex_preview,
};
