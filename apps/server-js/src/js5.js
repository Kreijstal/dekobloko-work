"use strict";
// Port of dekobloko_server/js5.py (JS5 handshake + archive/group request
// serving, including the CRC-patch trickery documented inline below).
//
// Python methods wrote to a blocking socket; here the network-facing methods
// are async and write via sock.write() callbacks. The pure byte-shaping logic
// (build_file_packet / frame_packet / xor_bytes) is factored into exported
// functions so golden-vector tests can exercise it without sockets -- the
// session methods are thin orchestration over the same code.

const fs = require("fs");
const path = require("path");

const { bzip2_decompress_bzh1, crc32 } = require("./bzip2.js");

// --- substitutes for cache groups that no longer exist anywhere -------------
//
// Archive 6 group 1 is "benefits" (files: borders, logo, price, screenshots) --
// the FunOrb subscription upsell panel. The original service is dead and the
// data is in no surviving cache, so the client blocks forever on "Loading extra
// data" waiting for it. An empty container does NOT satisfy it: the client
// treats a zero-length group as a failed fetch and re-requests indefinitely.
//
// So serve a structurally valid replacement instead. The generator lives in
// apps/server/synthetic/ (make_happy.py); Python resolved that directory as
// Path(__file__).parents[1] / "synthetic", which from src/js5.js maps to
// ../../server/synthetic.
const SUBSTITUTE_DIR =
  process.env.DEKOBLOKO_SYNTHETIC_DIR !== undefined
    ? process.env.DEKOBLOKO_SYNTHETIC_DIR
    : path.join(__dirname, "..", "..", "server", "synthetic");
const _SUBSTITUTES = new Map([["6,1", "archive6_group1.bin"]]);
const _substitute_cache = new Map(); // "archive,group" -> Buffer | null

function _key(archive_id, group_id) {
  return `${archive_id},${group_id}`;
}

function _load_substitute(archive_id, group_id) {
  const key = _key(archive_id, group_id);
  if (_substitute_cache.has(key)) {
    return _substitute_cache.get(key);
  }
  const name = _SUBSTITUTES.get(key);
  let data = null;
  if (name !== undefined) {
    const p = path.join(SUBSTITUTE_DIR, name);
    try {
      data = fs.readFileSync(p);
    } catch (err) {
      console.log(`[js5] substitute ${archive_id}/${group_id} unreadable at ${p}: ${err.message}`);
    }
  }
  _substitute_cache.set(key, data);
  return data;
}

// --- CRC reconciliation for substituted groups -----------------------------
//
// (Full rationale in apps/server/dekobloko_server/js5.py.) The client checks
// every downloaded group against the CRC in its archive's group table, and the
// master index signs those tables -- so a naive patch chain invalidates the
// signature and kills the client with error_game_crash. Levels 1 and 2 below
// are therefore DISABLED in Python (unreachable after an unconditional
// return); the working approach forges the substitute so its CRC already
// equals the recorded value (0xaacfba29 for archive 6 group 1). The helpers
// and disabled branches are ported anyway so diffs against Python stay
// mechanical.

function _decompress(raw) {
  const compression = raw[0];
  const length = raw.readUInt32BE(1);
  if (compression === 0) {
    return raw.subarray(5, 5 + length);
  }
  const body = raw.subarray(9, 9 + length);
  if (compression === 1) {
    return bzip2_decompress_bzh1(body);
  }
  // Python: gzip.GzipFile(fileobj=BytesIO(body)).read() -- first member only,
  // tolerant of trailing bytes. gunzipSync behaves the same way here.
  return require("zlib").gunzipSync(body);
}

function _as_container(payload) {
  // Wrap payload as an uncompressed js5 container. Re-emitting uncompressed
  // rather than recompressing keeps the bytes deterministic, which matters
  // because the advertised CRC must match exactly what goes on the wire.
  return Buffer.concat([
    Buffer.from([0]),
    (() => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(payload.length, 0);
      return len;
    })(),
    payload,
  ]);
}

function _group_table_crc_offset(table, group_id) {
  // Byte offset of group_id's CRC field inside a decompressed group table.
  let p = 0;
  const protocol = table[p];
  p += 1;
  if (protocol >= 6) {
    p += 4; // version
  }
  const flags = table[p];
  p += 1;
  const count = table.readUIntBE(p, 2);
  p += 2;
  const ids = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    acc += table.readUIntBE(p, 2);
    p += 2;
    ids.push(acc);
  }
  if (flags & 1) {
    p += 4 * count; // name hashes
  }
  const idx = ids.indexOf(group_id);
  if (idx === -1) {
    return null;
  }
  return p + 4 * idx;
}

/** Frozen equivalent of the Js5Request dataclass. */
class Js5Request {
  constructor(priority, archive_id, group_id) {
    this.priority = priority;
    this.archive_id = archive_id;
    this.group_id = group_id;
    Object.freeze(this);
  }
}

/** sendall(): resolve when the socket has flushed the bytes to the kernel. */
function sendall(sock, buf) {
  return new Promise((resolve, reject) => {
    sock.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Buffered exact-length reader over a net.Socket (or any EventEmitter with
 * data/end/close/error plus write()). Resolves with exactly n bytes; rejects
 * with io.EOFError when the peer closes first -- mirroring io.py's
 * read_exact raising EOFError out of the session loop.
 */
function make_packet_reader(sock) {
  const { EOFError } = require("./io.js");
  let queue = Buffer.alloc(0);
  let dead = false;
  const waiters = [];
  const onData = (chunk) => {
    queue = queue.length === 0 ? chunk : Buffer.concat([queue, chunk]);
    pump();
  };
  const markDead = () => {
    dead = true;
    pump();
  };
  sock.on("data", onData);
  sock.on("end", markDead);
  sock.on("close", markDead);
  sock.on("error", markDead);
  function pump() {
    let i = 0;
    while (i < waiters.length) {
      const waiter = waiters[i];
      if (queue.length >= waiter.n) {
        const out = queue.subarray(0, waiter.n);
        queue = queue.subarray(waiter.n);
        waiters.splice(i, 1);
        waiter.resolve(out);
      } else if (dead) {
        waiters.splice(i, 1);
        waiter.reject(new EOFError("socket closed while reading JS5 packets"));
      } else {
        i += 1;
      }
    }
  }
  return function read_exact(n) {
    return new Promise((resolve, reject) => {
      waiters.push({ n, resolve, reject });
      pump();
    });
  };
}

/**
 * Build the unframed JS5 file-response packet for a cache entry
 * (Python Js5Session._handle_file_request lines from truncation checks to
 * packet assembly). Returns null where Python would silently return:
 * truncated entries or entries too short to hold a container header.
 */
function build_file_packet(request, raw) {
  if (request.archive_id !== 255) {
    const compression = raw[0];
    const compressed_length = raw.readUInt32BE(1);
    const container_length = (compression === 0 ? 5 : 9) + compressed_length;
    if (raw.length < container_length) {
      return null; // Python prints "truncated cache entry" and returns
    }
    var trimmed = raw;
    if (raw.length > container_length) {
      // Python strips and logs the on-disk trailer.
      trimmed = raw.subarray(0, container_length);
    }
    raw = trimmed;
  }

  if (raw.length < 5) {
    return null; // Python prints "invalid short cache entry" and returns
  }

  const compression = raw[0];
  const compressed_length = raw.readUInt32BE(1);
  let flags = compression & 0x7f;
  if (!request.priority) {
    flags |= 0x80;
  }

  const head = Buffer.alloc(10);
  head[0] = request.archive_id & 0xff;
  head.writeUInt32BE(request.group_id >>> 0, 1);
  head[5] = flags & 0xff;
  head.writeUInt32BE(compressed_length >>> 0, 6);

  return Buffer.concat([head, raw.subarray(5)]);
}

/**
 * Pure _send_framed: split a response packet into the exact sequence of
 * socket writes Python performs (first 512 bytes, then 0xFF marker plus up
 * to 511 bytes per chunk).
 */
function frame_packet(packet) {
  if (packet.length <= 512) {
    return [packet];
  }
  const chunks = [packet.subarray(0, 512)];
  let offset = 512;
  while (offset < packet.length) {
    chunks.push(Buffer.from([0xff]));
    const end = Math.min(offset + 511, packet.length);
    chunks.push(packet.subarray(offset, end));
    offset = end;
  }
  return chunks;
}

/** Apply the client-selected JS5 XOR key (opcode 4) to outgoing bytes. */
function xor_bytes(data, xor_key) {
  if (!xor_key) {
    return data;
  }
  const k = xor_key & 0xff;
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ k;
  return out;
}

class Js5Session {
  /**
   * sock: net.Socket (or any object with a write(callback)); cache: CacheStore;
   * peer: "ip:port" string used in log lines.
   */
  constructor(sock, cache, peer) {
    this.sock = sock;
    this.cache = cache;
    this.peer = peer;
    this.xor_key = 0;
  }

  async run_after_handshake(revision) {
    console.log(`[js5] ${this.peer} accepted revision=${revision}`);
    await sendall(this.sock, Buffer.from([0x00]));

    // tcp.js hands us the raw duplex socket as "writer"; requests are read
    // back off the same socket through our own buffered packet reader. EOF
    // surfaces as io.EOFError so tcp.js logs it like Python's tcp.py did.
    const read_packet = make_packet_reader(this.sock);

    for (;;) {
      const packet = await read_packet(6);
      const opcode = packet[0];

      if (opcode === 0 || opcode === 1) {
        const request = new Js5Request(
          opcode === 1,
          packet[1],
          packet.readUInt32BE(2)
        );
        await this._handle_file_request(request);
        continue;
      }

      if (opcode === 2) {
        console.log(`[js5] ${this.peer} priority control ${packet.toString("hex").replace(/(..)/g, "$1 ").trim()}`);
        continue;
      }

      if (opcode === 3) {
        console.log(`[js5] ${this.peer} normal control ${packet.toString("hex").replace(/(..)/g, "$1 ").trim()}`);
        continue;
      }

      if (opcode === 4) {
        this.xor_key = packet[1];
        console.log(`[js5] ${this.peer} xor-key=${this.xor_key}`);
        continue;
      }

      if (opcode === 6) {
        console.log(`[js5] ${this.peer} setup ${packet.toString("hex").replace(/(..)/g, "$1 ").trim()}`);
        continue;
      }

      if (opcode === 7) {
        console.log(`[js5] ${this.peer} disconnect control`);
        return;
      }

      console.log(
        `[js5] ${this.peer} unknown opcode=${opcode} ${packet.toString("hex").replace(/(..)/g, "$1 ").trim()}`
      );
    }
  }

  async _patched_read(archive_id, group_id) {
    // cache.read() with substituted groups and reconciled CRCs applied.
    //
    // Every read path must use this. Reading the cache directly anywhere
    // re-introduces the mismatch this exists to remove.
    const raw = this.cache.read(archive_id, group_id);

    // Level 0: the substituted group itself.
    if (raw === null) {
      const substitute = _load_substitute(archive_id, group_id);
      if (substitute !== null) {
        console.log(
          `[js5] ${this.peer} SUBSTITUTE archive=${archive_id} ` +
            `group=${group_id} bytes=${substitute.length} ` +
            `crc=0x${crc32(substitute).toString(16).padStart(8, "0")}`
        );
        return substitute;
      }
      return null;
    }

    // Levels 1 and 2 are DISABLED. Rewriting the recorded CRC does not work:
    // the master index (255/255) is *signed*, and it covers the group-table
    // CRCs. Patching a group table forces a matching edit to the master
    // index, which invalidates the signature -- the client verifies it,
    // throws RuntimeException and dies with error_game_crash before it ever
    // reaches the login screen.
    //
    // The workable direction is the reverse: forge the substitute so its CRC
    // equals the value already recorded (0xaacfba29 for archive 6 group 1).
    // CRC32 is affine over GF(2), so 32 probe CRCs are enough to solve for
    // four bytes that land on any target. Put them somewhere inert -- the
    // palette, not pixel indices, which could go out of bounds and crash the
    // sprite reader. Then nothing signed has to change.
    return raw;

    if (archive_id !== 255) {
      return raw;
    }

    // Level 1: a group table vouching for a substituted group.
    if (group_id !== 255) {
      let patched = raw;
      for (const [key, _name] of _SUBSTITUTES) {
        const [arch, grp] = key.split(",").map(Number);
        if (arch !== group_id) {
          continue;
        }
        const substitute = _load_substitute(arch, grp);
        if (substitute === null) {
          continue;
        }
        const table = Buffer.from(_decompress(patched));
        const off = _group_table_crc_offset(table, grp);
        if (off === null) {
          console.log(`[js5] ${this.peer} group ${grp} absent from table ${arch}; CRC not patched`);
          continue;
        }
        const want = crc32(substitute) >>> 0;
        const had = table.readUInt32BE(off);
        table.writeUInt32BE(want, off);
        patched = _as_container(table);
        console.log(
          `[js5] ${this.peer} patched table ${arch} group ${grp} ` +
            `crc 0x${had.toString(16).padStart(8, "0")} -> 0x${want.toString(16).padStart(8, "0")}`
        );
      }
      return patched;
    }

    // Level 2: the master index vouching for those group tables.
    const touched = new Set();
    for (const key of _SUBSTITUTES.keys()) touched.add(Number(key.split(",")[0]));
    if (touched.size === 0) {
      return raw;
    }
    const body = Buffer.from(_decompress(raw));
    const count = body[0];
    for (const arch of [...touched].sort((a, b) => a - b)) {
      if (arch >= count) {
        continue;
      }
      const table = await this._patched_read(255, arch);
      if (table === null) {
        continue;
      }
      const off = 1 + arch * 72; // crc(4) + version(4) + whirlpool(64)
      const want = crc32(table) >>> 0;
      const had = body.readUInt32BE(off);
      if (had === want) {
        continue;
      }
      body.writeUInt32BE(want, off);
      console.log(
        `[js5] ${this.peer} patched master index archive ${arch} ` +
          `crc 0x${had.toString(16).padStart(8, "0")} -> 0x${want.toString(16).padStart(8, "0")}`
      );
    }
    return _as_container(body);
  }

  async _build_master_index() {
    // Generate the js5 master index (archive 255, group 255) from the
    // per-archive indexes (255, N). The master index is never stored on disk;
    // a real js5 server computes it live. Format:
    //   container([count:u8] then per archive [crc:u32][version:u32][whirlpool:64b])
    const idx_path = path.join(String(this.cache.cache_dir), "main_file_cache.idx255");
    let count = 0;
    try {
      if (fs.statSync(idx_path).isFile()) {
        count = Math.floor(fs.statSync(idx_path).size / 6);
      }
    } catch {
      count = 0;
    }
    const body = Buffer.alloc(1 + count * 72);
    body[0] = count & 0xff;
    for (let n = 0; n < count; n++) {
      const entry = await this._patched_read(255, n);
      const crcValue = entry === null ? 0 : crc32(entry) >>> 0;
      body.writeUInt32BE(crcValue, 1 + n * 72); // crc
      body.writeUInt32BE(0, 1 + n * 72 + 4); // version = 0
      // whirlpool stays zero-filled (64 bytes)
    }
    return _as_container(body); // compression byte 0 + u32 length + body
  }

  async _handle_file_request(request) {
    let raw;
    if (request.archive_id === 255 && request.group_id === 255) {
      raw = await this._patched_read(255, 255);
      if (raw === null) {
        raw = await this._build_master_index();
        console.log(`[js5] ${this.peer} generated unsigned fallback master index (${raw.length}b)`);
      } else {
        console.log(`[js5] ${this.peer} loaded signed master index (${raw.length}b)`);
      }
    } else {
      raw = await this._patched_read(request.archive_id, request.group_id);
    }
    if (raw === null) {
      console.log(
        `[js5] ${this.peer} MISS archive=${request.archive_id} ` +
          `group=${request.group_id} priority=${request.priority}`
      );
      // Answer the miss instead of staying silent. A bare return leaves the
      // client waiting ~30s forever; see the long comment in js5.py. Reply
      // with a well-formed empty container (compression 0, length 0).
      let flags = 0;
      if (!request.priority) {
        flags |= 0x80;
      }
      const empty = Buffer.alloc(10);
      empty[0] = request.archive_id & 0xff;
      empty.writeUInt32BE(request.group_id >>> 0, 1);
      empty[5] = flags & 0xff;
      empty.writeUInt32BE(0, 6); // compressed length 0
      await this._send_framed(empty);
      console.log(
        `[js5] ${this.peer} sent EMPTY container for miss ` +
          `archive=${request.archive_id} group=${request.group_id}`
      );
      return;
    }

    const packet = build_file_packet(request, raw);
    if (packet === null) {
      // Python's branch order means archive != 255 nulls are always the
      // "truncated" case (its slice-based header read tolerates short
      // entries); only archive 255 entries can hit "invalid short".
      if (request.archive_id !== 255) {
        console.log(
          `[js5] ${this.peer} truncated cache entry archive=${request.archive_id} ` +
            `group=${request.group_id} bytes=${raw.length} expected=${expected_container_length(raw)}`
        );
      } else {
        console.log(`[js5] ${this.peer} invalid short cache entry: ${JSON.stringify(request)}`);
      }
      return;
    }

    // Trailer logging parity: report what got stripped from over-long entries.
    if (request.archive_id !== 255) {
      const container_length = expected_container_length(raw);
      if (container_length !== null && raw.length > container_length) {
        const trailer = raw.subarray(container_length);
        console.log(
          `[js5] ${this.peer} stripped disk trailer=${trailer.toString("hex").replace(/(..)/g, "$1 ").trim()} ` +
            `archive=${request.archive_id} group=${request.group_id}`
        );
      }
    }

    await this._send_framed(packet);
    console.log(
      `[js5] ${this.peer} sent archive=${request.archive_id} ` +
        `group=${request.group_id} bytes=${raw.length} priority=${request.priority}`
    );
  }

  async _send_framed(packet) {
    for (const chunk of frame_packet(packet)) {
      await sendall(this.sock, xor_bytes(chunk, this.xor_key));
    }
  }
}

/** Container length implied by a raw entry header. Mirrors Python's
 * slice-based int.from_bytes(raw[1:5]), which tolerates short entries instead
 * of throwing -- needed so truncated/short classification matches exactly. */
function expected_container_length(raw) {
  let compressed_length = 0;
  const stop = Math.min(5, raw.length);
  for (let i = 1; i < stop; i++) compressed_length = compressed_length * 256 + raw[i];
  return (raw[0] === 0 ? 5 : 9) + compressed_length;
}

module.exports = {
  Js5Request,
  Js5Session,
  _load_substitute,
  _decompress,
  _as_container,
  _group_table_crc_offset,
  build_file_packet,
  frame_packet,
  xor_bytes,
  crc32,
  SUBSTITUTE_DIR,
  _SUBSTITUTES,
};
