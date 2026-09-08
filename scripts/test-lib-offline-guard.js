#!/usr/bin/env node
'use strict';

// Contract tests for scripts/lib/offline-guard.js.
//
// The guard is the mechanism that makes "this run was offline" a checkable
// claim rather than an assertion. If it stops refusing non-loopback traffic,
// an offline report becomes a lie, so its behaviour is pinned here.

const assert = require('assert');
const net = require('net');

const {
  LOOPBACK_HOSTS, installOfflineGuard, isOfflineGuardInstalled,
} = require('./lib/offline-guard');

// Importing the module must not change the process.
assert.equal(isOfflineGuardInstalled(), false,
  'requiring the module must not install anything');

const originalConnect = net.Socket.prototype.connect;
const globals = {fetch: () => Promise.resolve('original')};
const guard = installOfflineGuard({globals});

try {
  assert.equal(isOfflineGuardInstalled(globals), true);
  assert.notEqual(net.Socket.prototype.connect, originalConnect,
    'the guard must actually replace Socket.prototype.connect');

  // A non-loopback host is refused synchronously, by name, before any DNS or
  // TCP work happens.
  assert.throws(
    () => new net.Socket().connect({host: 'static.alterorb.net', port: 443}),
    /offline: refused outbound connection to static\.alterorb\.net/,
    'a public game host must be refused by name');
  assert.throws(
    () => new net.Socket().connect(443, 'example.com'),
    /offline: refused outbound connection to example\.com/,
    'the positional (port, host) call form must be guarded too');

  // Loopback is still allowed. Verify against a real ephemeral listener so
  // this tests the actual socket path rather than only the argument check.
  const listener = net.createServer((socket) => socket.end());
  const connected = new Promise((resolve, reject) => {
    listener.listen(0, '127.0.0.1', () => {
      const client = new net.Socket();
      client.on('error', reject);
      client.connect({host: '127.0.0.1', port: listener.address().port}, () => {
        client.destroy();
        resolve(true);
      });
    });
  });

  // fetch is refused wholesale.
  let fetchError = null;
  globals.fetch('https://static.alterorb.net/x').catch((error) => {
    fetchError = error;
  });

  connected.then((ok) => {
    assert.equal(ok, true, 'loopback connections must still succeed');
    listener.close();

    setImmediate(() => {
      assert.ok(fetchError, 'fetch must be refused');
      assert.match(String(fetchError.message), /offline: refused fetch/);

      // Restoring must put the process back exactly as it was.
      guard.restore();
      assert.equal(net.Socket.prototype.connect, originalConnect,
        'restore() must reinstate the original connect');
      assert.equal(isOfflineGuardInstalled(globals), false);

      // The allow-list is the documented one.
      assert.ok(LOOPBACK_HOSTS.has('127.0.0.1'));
      assert.ok(LOOPBACK_HOSTS.has('::1'));
      assert.ok(LOOPBACK_HOSTS.has('localhost'));
      assert.equal(LOOPBACK_HOSTS.has('static.alterorb.net'), false);

      console.log('PASS lib/offline-guard selftest');
    });
  }).catch((error) => {
    guard.restore();
    console.error(error);
    process.exit(1);
  });
} catch (error) {
  guard.restore();
  throw error;
}
