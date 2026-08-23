'use strict';

// Port of dekobloko_server/tcp.py.
//
// Python uses socketserver.ThreadingTCPServer; Node is single-threaded, so
// this is a plain net.Server plus an explicit routing function. The routing
// decision lives in handleStream(), which speaks the reader/writer interface
// from src/io.js (await-compatible), keeping it unit-testable without sockets.
// Js5Session comes from src/js5.js; GameSession is injected via options.sessions
// until the gameplay port lands.

const net = require('net');
const { EOFError: IoEOFError, read_exact, read_u8 } = require('./io');

function defaultLog() { console.log.apply(console, arguments); }

function isDisconnectError(error) {
  return error instanceof IoEOFError || error instanceof DisconnectError ||
    ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(error && error.code);
}

class DisconnectError extends Error {}

// Adapt a net.Socket to the io.js reader contract: recv(n) resolves with up to
// n bytes (short reads allowed); an empty Buffer means EOF/closed.
function makeSocketReader(socket) {
  let queue = Buffer.alloc(0);
  let dead = false;
  const waiters = [];
  socket.on("data", (chunk) => {
    queue = queue.length === 0 ? chunk : Buffer.concat([queue, chunk]);
    pump();
  });
  const markDead = () => { dead = true; pump(); };
  socket.on("end", markDead);
  socket.on("close", markDead);
  socket.on("error", markDead);
  function pump() {
    let i = 0;
    while (i < waiters.length) {
      const waiter = waiters[i];
      if (queue.length > 0) {
        const take = queue.subarray(0, Math.min(waiter.n, queue.length));
        queue = queue.subarray(take.length);
        waiters.splice(i, 1);
        waiter.resolve(take);
      } else if (dead) {
        waiters.splice(i, 1);
        waiter.resolve(Buffer.alloc(0));
      } else {
        i += 1;
      }
    }
  }
  return {
    recv(n) {
      return new Promise((resolve) => {
        if (queue.length > 0 || dead) {
          // Reuse the pump path so ordering stays consistent.
          waiters.push({ n, resolve });
          pump();
        } else {
          waiters.push({ n, resolve });
        }
      });
    },
  };
}

// Route one client stream. Returns a disposition string useful for logs/tests.
async function handleStream(reader, writer, options) {
  const peer = options.peer;
  const config = options.config;
  const cache = options.cache;
  const log = options.log || defaultLog;
  try {
    const preamble = await read_exact(reader, 8);
    if (preamble.length !== 8 || preamble[0] !== 12) {
      const hex = Array.from(preamble).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      log("[tcp] " + peer + " invalid preamble " + hex);
      return "invalid-preamble";
    }
    const nextOpcode = await read_u8(reader);
    if (nextOpcode === 15) {
      const revisionBytes = await read_exact(reader, 4);
      const revision = revisionBytes.readUInt32BE(0);
      const session = new options.sessions.Js5Session(writer, cache, peer);
      await session.run_after_handshake(revision);
      return "js5";
    }
    // GameSession needs the async reader for its recv loop; js5-style
    // sessions ignore the extra argument.
    const session = new options.sessions.GameSession(writer, config, peer, {
      reader,
    });
    await session.run_after_opcode(nextOpcode);
    return "game";
  } catch (error) {
    if (isDisconnectError(error)) {
      log("[tcp] " + peer + " closed/error: " + error.message);
      return "closed";
    }
    throw error;
  }
}

// Real server: adapts node sockets into the reader/writer interface.
function createTcpServer(options) {
  return net.createServer((socket) => {
    const peer = socket.remoteAddress + ":" + socket.remotePort;
    socket.setTimeout(120000);
    handleStream(makeSocketReader(socket), socket, Object.assign({}, options, { peer }))
      .catch((error) => {
        defaultLog("[tcp] " + peer + " handler crash: " + (error && error.stack || error));
        socket.destroy();
      });
  });
}

module.exports = { handleStream, createTcpServer, makeSocketReader };
