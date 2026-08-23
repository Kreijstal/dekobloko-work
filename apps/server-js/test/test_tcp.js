'use strict';

const assert = require('assert');
const { handleStream } = require("../src/tcp");

// Reader over a fixed byte string; recv mirrors io.js semantics (short reads OK).
function fixedReader(bytes) {
  let pos = 0;
  return {
    recv(n) {
      if (pos >= bytes.length) return Buffer.alloc(0);
      const take = bytes.subarray(pos, Math.min(pos + Math.max(1, n), bytes.length));
      pos += take.length;
      return take;
    },
  };
}

class StubJs5Session {
  constructor(writer, cache, peer) { this.calls = ["ctor", writer, cache, peer]; }
  async run_after_handshake(revision) { this.calls.push("handshake", revision); }
}
class StubGameSession {
  constructor(writer, config, peer) { this.calls = ["ctor", writer, config, peer]; }
  async run_after_opcode(opcode) { this.calls.push("opcode", opcode); }
}

const SESSIONS = { Js5Session: StubJs5Session, GameSession: StubGameSession };
const BASE = { peer: "127.0.0.1:1", config: { tag: "cfg" }, cache: { tag: "cache" }, sessions: SESSIONS, log: () => {} };

async function run() {
  let passed = 0;

  // js5 route: preamble(8, first byte 12) + opcode 15 + u32BE revision.
  {
    const stream = Buffer.concat([Buffer.from([12,0,0,0,0,0,0,0]), Buffer.from([15]), Buffer.from([0,0,3,237])]);
    const disposition = await handleStream(fixedReader(stream), {}, Object.assign({}, BASE));
    assert.strictEqual(disposition, "js5");
    passed += 1;
  }

  // game route: any other opcode goes to GameSession.run_after_opcode.
  {
    const stream = Buffer.concat([Buffer.from([12,1,2,3,4,5,6,7]), Buffer.from([66]), Buffer.from([9,9])]);
    const disposition = await handleStream(fixedReader(stream), {}, Object.assign({}, BASE));
    assert.strictEqual(disposition, "game");
    passed += 1;
  }

  // invalid preamble: first byte != 12.
  {
    const logs = [];
    const stream = Buffer.alloc(8, 0); stream[0] = 13;
    const opts = Object.assign({}, BASE, { log: (m) => logs.push(m) });
    const disposition = await handleStream(fixedReader(stream), {}, opts);
    assert.strictEqual(disposition, "invalid-preamble");
    assert.ok(logs[0].startsWith("[tcp] 127.0.0.1:1 invalid preamble 0d 00"), "log line: " + logs[0]);
    passed += 1;
  }

  // short stream: EOF mid-preamble -> disconnect path, not a crash.
  {
    const logs = [];
    const opts = Object.assign({}, BASE, { log: (m) => logs.push(m) });
    const disposition = await handleStream(fixedReader(Buffer.from([12, 0])), {}, opts);
    assert.strictEqual(disposition, "closed");
    assert.ok(logs[0].includes("closed/error"));
    passed += 1;
  }

  console.log("tcp: " + passed + " passed, 0 failed");
}

module.exports = { run };
if (require.main === module) run();
