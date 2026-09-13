#!/usr/bin/env node
'use strict';

// The play page names its own game on the JS5 bridge socket, and the bridge
// serves that game's cache.
//
// This is an end-to-end check on purpose: it starts the real server, reads the
// URL-building code out of the page it actually serves, calls that code, and
// connects the resulting URL to the real bridge. Testing the helper alone
// would have stayed green through the original defect, because the helper was
// correct and the page simply never passed a game.
//
// The server runs against a copied tree in a temporary directory so the test
// cannot touch the working .work caches or the cached AlterOrb catalog.

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const javaToolsRoot = process.env.JAVA_TOOLS_ROOT ||
  path.resolve(repositoryRoot, '..', 'java-tools');
const {WebSocket} = require(path.join(javaToolsRoot, 'node_modules', 'ws'));

const SECTOR_SIZE = 520;

// --- fixtures ---------------------------------------------------------------

function container(payload) {
  const head = Buffer.alloc(5);
  head.writeUInt32BE(payload.length, 1);
  return Buffer.concat([head, payload]);
}

// Same on-disk shape as scripts/test-js5-server.js builds; kept local so this
// test owns its fixtures.
function writeCache(directory, entries) {
  fs.mkdirSync(directory, {recursive: true});
  const indexes = new Map();
  const sectors = [];
  for (const [archiveId, groupId, payload] of entries) {
    const first = sectors.length + 1;
    let written = 0;
    let chunk = 0;
    while (written < payload.length) {
      const block = payload.subarray(written, written + 512);
      const sector = Buffer.alloc(SECTOR_SIZE);
      sector.writeUInt16BE(groupId, 0);
      sector.writeUInt16BE(chunk, 2);
      sector[7] = archiveId;
      block.copy(sector, 8);
      sectors.push(sector);
      written += block.length;
      chunk += 1;
    }
    for (let index = first; index < sectors.length + 1; index += 1) {
      const isLast = index === sectors.length;
      sectors[index - 1].writeUIntBE(isLast ? 0 : index + 1, 4, 3);
    }
    if (!indexes.has(archiveId)) indexes.set(archiveId, []);
    indexes.get(archiveId).push({groupId, length: payload.length, first});
  }
  fs.writeFileSync(path.join(directory, 'main_file_cache.dat2'),
    Buffer.concat([Buffer.alloc(SECTOR_SIZE), ...sectors]));
  for (const [archiveId, records] of indexes) {
    const highest = Math.max(...records.map(record => record.groupId));
    const index = Buffer.alloc((highest + 1) * 6);
    for (const record of records) {
      index.writeUIntBE(record.length, record.groupId * 6, 3);
      index.writeUIntBE(record.first, record.groupId * 6 + 3, 3);
    }
    fs.writeFileSync(
      path.join(directory, `main_file_cache.idx${archiveId}`), index);
  }
}

const freePort = () => new Promise(resolve => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1', () => {
    const {port} = probe.address();
    probe.close(() => resolve(port));
  });
});

// --- the client half of the JS5 protocol, spoken over the WebSocket bridge ---

function js5Client(url) {
  const socket = new WebSocket(url);
  let buffer = Buffer.alloc(0);
  let waiter = null;
  let closed = false;
  const settle = () => {
    if (!waiter) return;
    if (closed && buffer.length < waiter.count) {
      const {reject} = waiter;
      waiter = null;
      reject(new Error('bridge closed'));
      return;
    }
    if (buffer.length < waiter.count) return;
    const {count, resolve} = waiter;
    waiter = null;
    const taken = buffer.subarray(0, count);
    buffer = buffer.subarray(count);
    resolve(taken);
  };
  socket.on('message', data => {
    buffer = Buffer.concat([buffer, Buffer.from(data)]);
    settle();
  });
  socket.on('close', () => { closed = true; settle(); });
  socket.on('error', () => { closed = true; settle(); });
  return {
    socket,
    read: count => new Promise((resolve, reject) => {
      waiter = {count, resolve, reject};
      settle();
    }),
    write: bytes => socket.send(bytes),
    isClosed: () => closed,
    opened: new Promise((resolve, reject) => {
      socket.once('open', () => resolve(true));
      socket.once('close', () => reject(new Error('closed before open')));
      socket.once('error', error => reject(error));
    }),
  };
}

async function handshake(client, revision = 26) {
  const version = Buffer.alloc(4);
  version.writeUInt32BE(revision);
  client.write(Buffer.concat([
    Buffer.from([12, 0, 0, 0, 0, 0, 0, 0, 15]), version,
  ]));
  const reply = await client.read(1);
  assert.strictEqual(reply[0], 0, 'the bridged server acknowledges the handshake');
}

async function requestGroup(client, archiveId, groupId) {
  const packet = Buffer.alloc(6);
  packet[0] = 1;
  packet[1] = archiveId;
  packet.writeUInt32BE(groupId, 2);
  client.write(packet);
  const head = await client.read(10);
  assert.strictEqual(head[0], archiveId, 'the reply names the archive asked for');
  assert.strictEqual(head.readUInt32BE(1), groupId,
    'the reply names the group asked for');
  const compression = head[5] & 0x7f;
  const compressedLength = head.readUInt32BE(6);
  const total = compressedLength + (compression === 0 ? 0 : 4);
  let body = Buffer.alloc(0);
  let remaining = total;
  const first = Math.min(remaining, 502);
  if (first > 0) {
    body = Buffer.concat([body, await client.read(first)]);
    remaining -= first;
  }
  while (remaining > 0) {
    assert.strictEqual((await client.read(1))[0], 0xff,
      'continuation blocks carry the marker');
    const take = Math.min(remaining, 511);
    body = Buffer.concat([body, await client.read(take)]);
    remaining -= take;
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(compressedLength);
  return Buffer.concat([Buffer.from([compression]), length, body]);
}

const get = url => new Promise((resolve, reject) => {
  http.get(url, response => {
    let text = '';
    response.on('data', chunk => { text += chunk; });
    response.on('end', () => resolve({status: response.statusCode, text}));
  }).on('error', reject);
});

// --- the checks -------------------------------------------------------------

const PAYLOADS = {
  routefixa: container(Buffer.from('cache belonging to routefixa')),
  routefixb: container(Buffer.from('a different cache, owned by routefixb')),
};

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js5-routing-test-'));
  let server = null;
  try {
    // An isolated copy of the tree the server reads.
    fs.cpSync(path.join(repositoryRoot, 'scripts'), path.join(root, 'scripts'),
      {recursive: true});
    fs.mkdirSync(path.join(root, 'web'), {recursive: true});
    fs.copyFileSync(path.join(repositoryRoot, 'web', 'jvm-js-logo.svg'),
      path.join(root, 'web', 'jvm-js-logo.svg'));
    const bundleDir = path.join(root, 'bundle');
    fs.mkdirSync(bundleDir, {recursive: true});
    fs.writeFileSync(path.join(bundleDir, 'jvm-debug-current.js'),
      '// stub runtime for the routing test\n');
    const jarDir = path.join(root, 'jars');
    fs.mkdirSync(jarDir, {recursive: true});

    for (const game of ['routefixa', 'routefixb']) {
      writeCache(path.join(root, '.work', 'js5-recorded', game), [
        [0, 0, PAYLOADS[game]],
        [255, 0, container(Buffer.from([1, 2, 3]))],
      ]);
      fs.writeFileSync(path.join(jarDir, game + '.jar'), 'not a real jar');
    }
    // routefixc is in the catalog and has a JAR, but no cache at all.
    fs.writeFileSync(path.join(jarDir, 'routefixc.jar'), 'not a real jar');

    const catalogPath = path.join(root, 'catalog.json');
    fs.writeFileSync(catalogPath, JSON.stringify({
      server: 'http://127.0.0.1/',
      games: ['routefixa', 'routefixb', 'routefixc'].map((name, index) => ({
        internalName: name,
        name: 'Routing Fixture ' + name.slice(-1).toUpperCase(),
        mainClass: 'Fixture',
        gamecrc: index,
        gamepackHash: 'unused-because-the-jar-is-overridden',
      })),
    }));

    const httpPort = await freePort();
    server = spawn(process.execPath,
      [path.join(root, 'scripts', 'serve-game-library.js')], {
        env: {
          ...process.env,
          JAVA_TOOLS_ROOT: javaToolsRoot,
          ALTERORB_CONFIG_URL: 'file://' + catalogPath,
          GAME_LIBRARY_PORT: String(httpPort),
          GAME_LIBRARY_BUNDLE_DIR: bundleDir,
          GAME_LIBRARY_TELEMETRY_PATH: path.join(root, 'telemetry.jsonl'),
          // The documented default for a socket that names no game.
          GAME_LIBRARY_JS5_GAME: 'routefixb',
          GAME_LIBRARY_JAR_ROUTEFIXA: path.join(jarDir, 'routefixa.jar'),
          GAME_LIBRARY_JAR_ROUTEFIXB: path.join(jarDir, 'routefixb.jar'),
          GAME_LIBRARY_JAR_ROUTEFIXC: path.join(jarDir, 'routefixc.jar'),
          GAME_LIBRARY_TCP_BRIDGE_PORT: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    const log = [];
    server.stdout.on('data', chunk => log.push(String(chunk)));
    server.stderr.on('data', chunk => log.push(String(chunk)));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() =>
        reject(new Error('server did not start:\n' + log.join(''))), 30000);
      const check = () => {
        if (log.join('').includes('listening on')) {
          clearTimeout(timer);
          resolve();
        }
      };
      server.stdout.on('data', check);
      server.stderr.on('data', check);
      server.on('exit', code => {
        clearTimeout(timer);
        reject(new Error('server exited with ' + code + ':\n' + log.join('')));
      });
    });
    assert.ok(log.join('').includes('3/3 validated game JARs'),
      'all three fixture games are available');

    const host = '127.0.0.1:' + httpPort;
    const origin = 'http://' + host;

    // --- URL construction, taken from the page the server actually serves ---
    const page = await get(origin + '/play/routefixa');
    assert.strictEqual(page.status, 200, 'the play page renders');
    const builder = /const js5SocketUrl = ([\s\S]*?);\n\s*const openSocket/
      .exec(page.text);
    assert.ok(builder,
      'the served play page defines the socket-URL builder');
    assert.ok(/js5SocketUrl\(\s*location\.host,\s*location\.protocol,\s*port,\s*game\.id\s*\)/
      .test(page.text),
      'the served page opens its socket through that builder with its own game id');
    const manifest = JSON.parse(
      /const assetManifest = (\{[\s\S]*?\});\n/.exec(page.text)[1]);
    assert.strictEqual(manifest.game.id, 'routefixa',
      'the page carries its own game identity');

    // eslint-disable-next-line no-new-func
    const buildUrl = new Function('return (' + builder[1] + ');')();
    const socketUrl = buildUrl(host, 'http:', 43594, manifest.game.id);
    assert.strictEqual(socketUrl,
      'ws://' + host + '/tcp?port=43594&game=routefixa',
      'the page builds a socket URL that names its game');

    // --- selection, driven by exactly that URL ------------------------------
    const served = async url => {
      const client = js5Client(url);
      await client.opened;
      try {
        await handshake(client);
        return await requestGroup(client, 0, 0);
      } finally {
        client.socket.close();
      }
    };

    assert.deepStrictEqual(await served(socketUrl), PAYLOADS.routefixa,
      'the page-built URL selects routefixa\'s own cache');

    const pageB = await get(origin + '/play/routefixb');
    const manifestB = JSON.parse(
      /const assetManifest = (\{[\s\S]*?\});\n/.exec(pageB.text)[1]);
    const urlB = buildUrl(host, 'http:', 43594, manifestB.game.id);
    assert.strictEqual(urlB, 'ws://' + host + '/tcp?port=43594&game=routefixb',
      'the second game builds its own socket URL');
    assert.deepStrictEqual(await served(urlB), PAYLOADS.routefixb,
      'the second game selects its own cache, not the first one\'s');

    // The regression itself: the old page sent no game parameter, so every
    // game reached whichever cache the default named.
    const legacyUrl = 'ws://' + host + '/tcp?port=43594';
    assert.deepStrictEqual(await served(legacyUrl), PAYLOADS.routefixb,
      'a socket naming no game still follows GAME_LIBRARY_JS5_GAME, explicitly');
    assert.ok(log.join('').includes('socket carried no game parameter'),
      'and that fallback is announced rather than silent');

    // --- invalid and unavailable selections ---------------------------------
    const refused = async url => {
      const client = js5Client(url);
      try {
        await client.opened;
      } catch (error) {
        return 'closed';
      }
      try {
        await handshake(client);
        return 'served';
      } catch (error) {
        return 'closed';
      } finally {
        client.socket.close();
      }
    };

    assert.strictEqual(
      await refused('ws://' + host + '/tcp?port=43594&game=routefixc'),
      'closed',
      'a catalogued game with no cache closes the bridge');
    assert.strictEqual(
      await refused('ws://' + host + '/tcp?port=43594&game=' +
        encodeURIComponent('../../../etc')),
      'closed',
      'a malformed game id closes the bridge instead of escaping the cache root');
    assert.strictEqual(
      await refused('ws://' + host + '/tcp?port=43594&game=neverheardofit'),
      'closed',
      'an unknown game closes the bridge instead of becoming another game');

    const transcript = log.join('');
    assert.ok(transcript.includes('rejecting malformed game id'),
      'the malformed id is reported as such');
    assert.ok(!/routefixc on 127\.0\.0\.1/.test(transcript),
      'no JS5 server is started for a game with no cache');

    console.log('js5 game routing: page URL carries the game, ' +
      'each game gets its own cache, fallbacks are explicit');
  } finally {
    if (server) server.kill('SIGKILL');
    fs.rmSync(root, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
