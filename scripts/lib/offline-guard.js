'use strict';

// Loopback-only enforcement.
//
// "Offline" is only a real claim if it is enforced. This refuses every outbound
// connection that is not loopback so a forgotten dependency on a public host
// fails immediately and visibly, instead of working right up until the machine
// is actually disconnected -- or, worse, quietly contacting a public game host
// during a run that is reported as offline.
//
// Extracted verbatim from scripts/launch-alterorb-games-jvmjs.js:1769
// (`enforceLoopbackOnly`), which was the only place in the repository that had
// it, while scripts/serve-game-library.js, scripts/run-jvmjs.js and the
// benchmark scripts had no equivalent guard at all.
//
// Installing the guard is an explicit, reversible action. Importing this module
// does nothing.

const net = require('net');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0', '']);

function connectTarget(args) {
  if (args[0] && typeof args[0] === 'object') return args[0].host;
  if (typeof args[1] === 'string') return args[1];
  return '';
}

// Returns a handle with restore(); call it to put the process back the way it
// was. Repeated installs are idempotent.
function installOfflineGuard({
  allowedHosts = LOOPBACK_HOSTS,
  refuseFetch = true,
  globals = globalThis,
} = {}) {
  if (globals.__dekoblokoOfflineGuard) return globals.__dekoblokoOfflineGuard;

  const originalConnect = net.Socket.prototype.connect;
  const originalFetch = globals.fetch;

  net.Socket.prototype.connect = function connect(...args) {
    const target = String(connectTarget(args) ?? '');
    if (!allowedHosts.has(target)) {
      throw new Error(`offline: refused outbound connection to ${target}`);
    }
    return originalConnect.apply(this, args);
  };

  if (refuseFetch) {
    globals.fetch = (input) => Promise.reject(
      new Error(`offline: refused fetch ${input}`));
  }

  const handle = {
    allowedHosts: [...allowedHosts],
    refuseFetch,
    restore() {
      net.Socket.prototype.connect = originalConnect;
      if (refuseFetch) globals.fetch = originalFetch;
      delete globals.__dekoblokoOfflineGuard;
    },
  };
  globals.__dekoblokoOfflineGuard = handle;
  return handle;
}

function isOfflineGuardInstalled(globals = globalThis) {
  return Boolean(globals.__dekoblokoOfflineGuard);
}

module.exports = {LOOPBACK_HOSTS, installOfflineGuard, isOfflineGuardInstalled};
