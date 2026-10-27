import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrowserGameServer, LOGIN_MODULUS} from '../apps/launcher/browser-loader/browser-game-server.mjs';
import {accountRecordCrc} from '../apps/launcher/browser-loader/escape-account-service.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const game = {internalName: 'escapevector'};
const storage = () => { const map = new Map(); return {getItem: key => map.get(key), setItem: (key, value) => map.set(key, value)}; };
const drain = state => {
  const result = Buffer.concat(state.chunks.map(Buffer.from));
  state.chunks = []; state.size = 0;
  return result;
};
const record = body => {
  const result = Buffer.from([...body, 0,0,0,0]);
  result.writeUInt32BE(accountRecordCrc(body), body.length);
  return result;
};
function profile(server, name = 'Alice') {
  const state = server.createSocket(); state.accountName = name; state.outboundIsaac = {next: () => 0};
  return state;
}
const progress = (mode, level) => record([1, mode, level + 64, ...Array(16).fill(0)]);
const score = (sequence, board, value) => {
  const body = Buffer.alloc(28); body[0] = 1; body.writeUInt16BE(sequence, 1); body.writeUInt16BE(board, 3);
  body.writeUInt16BE(board ^ 65535, 5); body[23] = 1; body.writeInt32BE(value, 24);
  return record(body);
};

test('embedded Escape progress isolates campaign and player and acknowledges each record', () => {
  const data = storage(); let server = createBrowserGameServer({game, storage: data}); const s = profile(server);
  server.handleAccountPacket(s, 5, progress(1, 2)); assert.deepEqual([...drain(s)], [4,3,1,1,66]);
  server = createBrowserGameServer({game, storage: data});
  for (const [name, mode, expected] of [['Alice',1,3],['Alice',0,0],['Bob',1,0]]) {
    const query = profile(server, name); server.handleAccountPacket(query, 5, Uint8Array.of(2,0,mode));
    assert.deepEqual([...drain(query)], [4,6,0,mode,expected,0,0,0]);
  }
});

test('embedded Escape achievement and saved-data CRC acknowledgements survive recreation', () => {
  const data = storage(); let server = createBrowserGameServer({game, storage: data}); let s = profile(server);
  server.handleAccountPacket(s, 4, record([1,37,0,...Array(16).fill(0)])); assert.deepEqual([...drain(s)], [3,1,1]);
  server.handleAccountPacket(s, 6, record([1,3,7,8,9])); assert.deepEqual([...drain(s)], [5,5,1,...record([1,3,7,8,9]).subarray(-4)]);
  server = createBrowserGameServer({game, storage: data}); s = profile(server);
  server.handleAccountPacket(s, 4, Uint8Array.of(2)); const masks = drain(s);
  assert.equal(masks[2], 0); assert.equal(masks[3], 8); assert.equal(masks.readUInt32BE(8), 32);
  server.handleAccountPacket(s, 6, Uint8Array.of(0)); assert.deepEqual([...drain(s)], [5,9,...record([0,3,7,8,9])]);
});

test('malformed embedded records cannot change stored state', () => {
  const data = storage(); const server = createBrowserGameServer({game, storage: data}); const s = profile(server);
  for (const [op, body] of [[4,Buffer.alloc(23)],[5,record([1])],[6,record([1])],[5,progress(3,2)],[3,score(1,4,20)]])
    assert.throws(() => server.handleAccountPacket(s, op, body), /Escape Vector/);
  assert.equal(data.getItem('funorb.account.escapevector.alice'), undefined);
  assert.equal(s.size, 0);
});

test('embedded Escape highscores keep the best value per board and identify other local profiles', () => {
  const data = storage(); data.setItem('funorb.players.escapevector', JSON.stringify(['Alice','Bob']));
  const server = createBrowserGameServer({game, storage: data}); const alice = profile(server), bob = profile(server, 'Bob');
  for (const [state, board, value] of [[alice,1,100],[alice,1,50],[alice,2,999],[bob,1,200]]) {
    server.handleAccountPacket(state,3,score(42,board,value)); drain(state);
  }
  server.handleAccountPacket(alice,3,Uint8Array.of(5,0,0,1,10,1));
  const wire = drain(alice);
  assert.equal(wire.readUInt16BE(1), wire.length - 3);
  assert.deepEqual([...wire.subarray(3,13)], [0,0,1,2,66,111,98,0,0,2]);
  assert.equal(wire[13],1); assert.equal(wire.readBigUInt64BE(14),200n);
  assert.equal(wire[26],0); assert.equal(wire.readBigUInt64BE(27),100n);
});

test('Escape records and queries remain framed when every ISAAC byte arrives separately', () => {
  const server = createBrowserGameServer({game, storage: storage()}); const s = profile(server);
  const seed = [1,2,3,4]; s.inboundIsaac = new server.Isaac(seed); const client = new server.Isaac(seed);
  const body = progress(2, 4);
  const bytes = [(5+client.next())&255,body.length,...body,(5+client.next())&255,2,0,2,(2+client.next())&255,0,0,0];
  for (const byte of bytes) {s.outgoing.push(byte);server.processAccountPackets(s);}
  const wire = drain(s); assert.equal(wire[0], 4); assert.equal(wire[5], 4); assert.equal(wire[9], 5);
  assert.equal(wire[13], 1); assert.equal(wire.length, 30); assert.equal(s.outgoing.length, 0);
});

const original = process.env.ESCAPE_GAMEPACK || path.join(root, '.work/gamepacks/escapevector.jar');
test('original Escape client writers and decoders round-trip through the EMBEDDED server', {
  skip: !existsSync(original) && 'local original Escape Vector JAR required',
}, async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'escape-embedded-'));
  const run = promisify(execFile);
  const classpath = [original, path.join(root, 'lib/dekobloko-stubs.jar')].join(path.delimiter);
  const data = storage();
  const ids = new Map();
  try {
    await run('javac', ['--release','8','-cp',classpath,'-d',temporary, path.join(root,'apps/server/tests/EscapeProtocolProbe.java')]);
    for (const restarted of [false, true]) {
      const embedded = createBrowserGameServer({game, storage: data});
      const sockets = new Set();
      // TCP exists only inside this test to let an unmodified native client's
      // packet code exercise the same memory sockets used on the hosted Site.
      const bridge = createServer(socket => {
        sockets.add(socket);
        const state = embedded.createSocket();
        socket.on('data', bytes => {
          try {
            state.outgoing.push(...bytes); embedded.processWrites(state);
            socket.write(drain(state)); if (state.closed) socket.end();
          } catch (error) {socket.destroy(error);}
        });
        socket.on('error', () => {});
        socket.on('close', () => {state.closed = true; clearInterval(state.keepalive); sockets.delete(socket);});
      });
      try {
        await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve));
        for (const name of ['Alice','Bob']) {
          const args = ['-Djava.awt.headless=true','-cp',temporary + path.delimiter + classpath,
            'EscapeProtocolProbe',String(bridge.address().port),LOGIN_MODULUS,name];
          if (restarted) args.push('restored', ids.get(name));
          const result = await run('java',args,{timeout:30000});
          assert.match(result.stdout, /EscapeProtocolProbe checks=23/);
          ids.set(name, /playerId=(\d+)/.exec(result.stdout)[1]);
        }
      } finally {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => bridge.close(resolve));
      }
    }
  } finally { await rm(temporary, {recursive:true, force:true}); }
});
