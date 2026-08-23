"use strict";
// Golden-vector tests for src/js5.js against fixtures/js5.json, produced by
// RUNNING dekobloko_server.js5 (see gen-vectors.py). Covers the pure helpers,
// the full request-handling path over a capturing socket (synthetic + live
// cache), and an end-to-end TCP round trip against a real Js5Session.

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { PassThrough } = require("stream");

const {
  Js5Request,
  Js5Session,
  _load_substitute,
  _as_container,
  _group_table_crc_offset,
  _decompress,
  build_file_packet,
  frame_packet,
  xor_bytes,
  crc32,
} = require("../src/js5.js");
const { CacheStore } = require("../src/cache.js");

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "js5.json"), "utf8")
);
const CACHE_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "cache.json"), "utf8")
);

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function label_of(want) {
  const [priority, archive, group] = want.request;
  return "[" + priority + "," + archive + "," + group + " xor=" + (want.xor_key || 0) + "]";
}

/** Capturing stand-in for net.Socket: write(buf, cb) like node, no events. */
function fake_socket() {
  const chunks = [];
  return {
    chunks,
    write(buf, cb) {
      chunks.push(Buffer.from(buf));
      if (cb) cb();
      return true;
    },
    on() {}, // packet reader attaches listeners; none fire without data
  };
}

async function handle_with_capture(cache, request, xor_key) {
  const sock = fake_socket();
  const session = new Js5Session(sock, cache, "test-peer");
  session.xor_key = xor_key;
  await session._handle_file_request(request);
  // Python's FakeSock recorded one entry per sendall(); each write is one
  // already-framed wire chunk. Mirror that: expose the boundaries AND the
  // concatenated stream (which includes the 0xFF markers).
  return { chunks: sock.chunks, got: Buffer.concat(sock.chunks) };
}

function assert_matches_capture(capture, want, label) {
  const { chunks, got } = capture;
  assert.deepStrictEqual(
    chunks.map((c) => c.length),
    want.chunk_lens,
    label + ": sendall chunk length sequence"
  );
  assert.strictEqual(sha256(got), want.stream_sha256, label + ": stream sha256");
  assert.strictEqual(got.length, want.stream_len, label + ": stream length");
  if (want.stream_hex !== undefined) {
    assert.strictEqual(got.toString("hex"), want.stream_hex, label + ": stream hex");
  }
}

function build_cache_dir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const spec of CACHE_FIXTURE.synthetic.filespecs) {
    const buf = Buffer.alloc(spec.truncate);
    for (const w of spec.writes) {
      Buffer.from(w.hex, "hex").copy(buf, w.offset);
    }
    fs.writeFileSync(path.join(dir, spec.file), buf);
  }
  return dir;
}

async function run() {
  const pure = FIXTURE.pure;

  // ---- substitute loader ---------------------------------------------------
  const sub = _load_substitute(6, 1);
  assert.ok(sub !== null && sub.length === pure.substitute.plain_len,
    "substitute 6/1 length");
  assert.strictEqual(sha256(sub), pure.substitute.plain_sha256, "substitute sha256");
  assert.strictEqual(sub.subarray(0, 32).toString("hex"),
    pure.substitute.plain_head_hex, "substitute head");
  assert.strictEqual(crc32(sub) >>> 0, pure.substitute.crc32,
    "substitute crc32 equals value recorded by js5.py");
  assert.strictEqual(_load_substitute(7, 7), null, "no substitute for unknown group");

  // ---- crc32 / containers / table offsets ----------------------------------
  for (const c of pure.crc32_cases) {
    const blob =
      c.label === "empty" ? Buffer.alloc(0)
      : c.label === "hello" ? Buffer.from("hello")
      : c.label === "123456789" ? Buffer.from("123456789")
      : sub;
    assert.strictEqual(crc32(blob) >>> 0, c.crc32, "crc32(" + c.label + ")");
  }

  assert.strictEqual(_as_container(Buffer.from("abc")).toString("hex"),
    pure.as_container_abc_hex, "_as_container(b'abc')");

  const tbl = Buffer.from(pure.synthetic_table.table_hex, "hex");
  for (const gid of Object.keys(pure.synthetic_table.offsets)) {
    assert.strictEqual(_group_table_crc_offset(tbl, Number(gid)),
      pure.synthetic_table.offsets[gid], "crc offset gid=" + gid);
  }

  // ---- xor ------------------------------------------------------------------
  for (const x of pure.xor_cases) {
    assert.strictEqual(
      xor_bytes(Buffer.from(x.in_hex, "hex"), x.key).toString("hex"),
      x.out_hex, "xor key=" + x.key
    );
  }

  // ---- build_file_packet ----------------------------------------------------
  for (const enc of pure.encode_cases) {
    const got = build_file_packet(
      new Js5Request(enc.priority, enc.archive, enc.group),
      Buffer.from(enc.raw_hex, "hex")
    );
    if (!enc.packet_hex) {
      assert.strictEqual(got, null, "encode " + enc.label + " should bail");
    } else {
      assert.ok(got !== null, "encode " + enc.label + " should succeed");
      assert.strictEqual(got.toString("hex"), enc.packet_hex, "encode " + enc.label);
    }
  }

  // ---- framing --------------------------------------------------------------
  for (const fr of pure.frame_cases) {
    // Same deterministic bytes as the Python generator: (i*37 + 11) & 0xFF.
    // The last chunk of a multi-chunk frame can itself be a single data byte,
    // so markers must be identified by content, not by length.
    const packet = Buffer.from(
      Array.from({ length: fr.packet_len }, (_, i) => (i * 37 + 11) & 0xff)
    );
    const chunks = frame_packet(packet);
    assert.deepStrictEqual(chunks.map((c) => c.length), fr.chunk_lens,
      "frame(" + fr.packet_len + ") chunk lens");
    assert.deepStrictEqual(
      chunks.filter((c) => c.length === 1 && c[0] === 0xff).map((c) => c.toString("hex")),
      fr.marker_positions_hex,
      "frame(" + fr.packet_len + ") markers"
    );
    assert.strictEqual(sha256(Buffer.concat(chunks)), fr.chunks_stream_sha256,
      "frame(" + fr.packet_len + ") reassembly");
  }

  // ---- synthetic cache session captures -------------------------------------
  {
    const dir = build_cache_dir("dekobloko-js5-test-");
    try {
      const cache = new CacheStore(dir);
      for (const want of FIXTURE.synthetic.requests) {
        const [priority, archive, group] = want.request;
        const got = await handle_with_capture(
          cache, new Js5Request(priority, archive, group), want.xor_key || 0
        );
        assert_matches_capture(got, want, "synthetic " + label_of(want));
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ---- live cache captures + master index ------------------------------------
  const live = FIXTURE.live || {};
  if (!live._meta || live._meta.present !== true) {
    console.log("[skip] no live geoblox cache recorded in fixtures");
  } else {
    const cache = new CacheStore(
      path.join(os.homedir(), ".alterorb", "caches", "geoblox")
    );
    for (const want of live.requests) {
      const [priority, archive, group] = want.request;
      const got = await handle_with_capture(cache, new Js5Request(priority, archive, group));
      assert_matches_capture(got, want, "live [" + priority + "," + archive + "," + group + "]");
    }
    const session = new Js5Session(fake_socket(), cache, "mi-peer");
    const masterIndex = await session._build_master_index();
    assert.strictEqual(masterIndex.toString("hex"), live.master_index_generated_hex,
      "_build_master_index byte-exact vs Python");

    const table = cache.read(255, 0);
    const decompressed = _decompress(table);
    assert.strictEqual(decompressed.length, live.table255_0_decompressed_len,
      "table 255/0 decompressed length");
    assert.strictEqual(decompressed.subarray(0, 24).toString("hex"),
      live.table255_0_decompressed_head_hex, "table 255/0 decompressed head");
    for (const g of Object.keys(live.crc_offsets)) {
      assert.strictEqual(_group_table_crc_offset(decompressed, Number(g)),
        live.crc_offsets[g], "live crc offset gid=" + g);
    }
  }

  // ---- TCP integration: real sockets end to end ------------------------------
  const dir = build_cache_dir("dekobloko-js5-tcp-");
  try {
    const cache = new CacheStore(dir);
    const cases = FIXTURE.synthetic.requests.filter((r) => r.stream_hex !== undefined);

    const server = net.createServer((socket) => {
      let pending = Buffer.alloc(0);
      let started = false;
      socket.on("data", (chunk) => {
        if (started) return; // post-handshake data flows through the bridge
        pending = Buffer.concat([pending, chunk]);
        if (pending.length < 4) return;
        const revision = pending.readUInt32BE(0);
        started = true;
        // The 4 handshake bytes are consumed here. Anything already arrived
        // beyond them (the client may send revision+request in one segment)
        // must be replayed to the session's reader, so bridge a PassThrough
        // seeded with the leftovers while writes still hit the real socket.
        const rest = pending.subarray(4);
        const bridge = new PassThrough();
        if (rest.length > 0) bridge.write(rest);
        socket.on("data", (c) => bridge.write(c));
        socket.on("end", () => bridge.end());
        socket.on("error", () => bridge.destroy());
        const hybrid = {
          write: (b, cb) => socket.write(b, cb),
          on: (...a) => bridge.on(...a),
          once: (...a) => bridge.once(...a),
        };
        const session = new Js5Session(hybrid, cache, "tcp-peer");
        session.run_after_handshake(revision).catch(() => {});
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    for (const want of cases) {
      const [priority, archive, group] = want.request;
      const got = await new Promise((resolve, reject) => {
        const client = net.connect(port, "127.0.0.1");
        let received = Buffer.alloc(0);
        const timer = setTimeout(() => {
          client.destroy();
          reject(new Error("timeout waiting for js5 response"));
        }, 5000);
        client.on("connect", () => {
          const rev = Buffer.alloc(4);
          rev.writeUInt32BE(550, 0);
          client.write(rev);
          if (want.xor_key) {
            // Negotiate the XOR key exactly like a real JS5 client (opcode 4)
            // so the session scrambles the response stream before sending.
            const keyReq = Buffer.alloc(6);
            keyReq[0] = 4;
            keyReq[1] = want.xor_key & 0xff;
            client.write(keyReq);
          }
          const req = Buffer.alloc(6);
          req[0] = priority ? 1 : 0;
          req[1] = archive;
          req.writeUInt32BE(group >>> 0, 2);
          client.write(req);
        });
        client.on("data", (chunk) => {
          received = Buffer.concat([received, chunk]);
          // First byte is the JS5 handshake reply (0x00); after it the wire
          // bytes must equal what Python's session wrote.
          if (received.length >= want.stream_len + 1) {
            clearTimeout(timer);
            client.destroy();
            resolve(received.subarray(1, want.stream_len + 1));
          }
        });
        client.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      assert.strictEqual(got.toString("hex"), want.stream_hex,
        "tcp " + label_of(want) + " wire bytes");
    }
    await new Promise((resolve) => server.close(resolve));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { run };

if (require.main === module) {
  run().then(
    () => console.log("test_js5.js: OK"),
    (e) => {
      console.error("test_js5.js FAILED:", e.message);
      process.exit(1);
    }
  );
}
