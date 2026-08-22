#!/usr/bin/env node
'use strict';

// Compares an offline launch report against an online baseline, per game.
//
// "Did it reach the menu offline?" is the wrong question on its own: a handful
// of these games do not reach the menu online either, and counting those as
// offline failures would both overstate the problem and hide a real
// regression. What matters is whether removing the network changed the
// outcome for any game.
//
//   node scripts/compare-offline-launch.js <baseline.json> <offline.json>

const fs = require('fs');

const [baselinePath, offlinePath] = process.argv.slice(2);
if (!baselinePath || !offlinePath) {
  console.error('usage: compare-offline-launch.js <baseline.json> <offline.json>');
  process.exit(2);
}

const byGame = (report) => new Map(
  report.results.map(result => [result.game, result]));
const baseline = byGame(JSON.parse(fs.readFileSync(baselinePath, 'utf8')));
const offline = byGame(JSON.parse(fs.readFileSync(offlinePath, 'utf8')));

const rows = [];
for (const [game, offlineResult] of [...offline].sort()) {
  const baselineResult = baseline.get(game);
  rows.push({
    game,
    online: baselineResult ? baselineResult.status : '(not in baseline)',
    offlineStatus: offlineResult.status,
    onlineMs: baselineResult ? baselineResult.elapsedMs : null,
    offlineMs: offlineResult.elapsedMs,
    same: baselineResult ? baselineResult.status === offlineResult.status : false,
  });
}

const width = Math.max(...rows.map(row => row.game.length));
for (const row of rows) {
  const seconds = value => value === null ? '    -' :
    `${(value / 1000).toFixed(1)}s`.padStart(7);
  console.log(`${row.same ? '  ' : '!!'} ${row.game.padEnd(width)}  ` +
    `online=${row.online.padEnd(12)}${seconds(row.onlineMs)}  ` +
    `offline=${row.offlineStatus.padEnd(12)}${seconds(row.offlineMs)}`);
}

const menuOffline = rows.filter(row => row.offlineStatus === 'main-menu').length;
const menuOnline = rows.filter(row => row.online === 'main-menu').length;
const changed = rows.filter(row => !row.same);
console.log(`\ngames: ${rows.length}`);
console.log(`reached main-menu online:  ${menuOnline}`);
console.log(`reached main-menu offline: ${menuOffline}`);
console.log(`changed by going offline:  ${changed.length}` +
  (changed.length ? ` (${changed.map(row => row.game).join(', ')})` : ''));
process.exit(changed.length === 0 ? 0 : 1);
