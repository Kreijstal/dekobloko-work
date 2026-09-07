#!/usr/bin/env node
'use strict';

// Reads the launcher reports from an A/B run and prints the two numbers that
// are legitimate evidence here: postLogoToMenuMs (never wall time -- load
// variance makes wall time misleading) and the menu fps window. Arms are
// printed in run order, because back-to-back ordering is the only thing that
// makes a comparison on a loaded machine meaningful.

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: compare-gate-arms.js <report.json> [...]');
  process.exit(2);
}

const rows = [];
for (const file of files) {
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { console.error(`skip ${file}: ${err.message}`); continue; }
  const result = (parsed.results || [])[0];
  if (!result) { console.error(`skip ${file}: no result`); continue; }
  rows.push({
    arm: path.basename(file).replace(/^[gt]-|\.json$/g, ''),
    status: result.status,
    postLogoToMenuMs: result.phaseTimings?.postLogoToMenuMs ?? null,
    firstFrameMs: result.phaseTimings?.firstFrameElapsedMs ?? null,
    fps: result.fpsMeasurement?.fps ?? null,
    presented: result.fpsMeasurement?.presented ?? null,
  });
}

const pad = (v, w) => String(v).padStart(w);
console.log(`${pad('arm', 10)} ${pad('status', 14)} ${pad('postLogo->menu', 15)} ${pad('fps', 8)} ${pad('frames', 8)}`);
for (const row of rows) {
  console.log(`${pad(row.arm, 10)} ${pad(row.status, 14)} ` +
    `${pad(row.postLogoToMenuMs === null ? '-' : `${(row.postLogoToMenuMs / 1000).toFixed(1)}s`, 15)} ` +
    `${pad(row.fps === null ? '-' : row.fps.toFixed(2), 8)} ${pad(row.presented ?? '-', 8)}`);
}

// Pair arms by trailing digit so base1/gates1 and base2/gates2 compare as runs.
const byRun = new Map();
for (const row of rows) {
  const run = (row.arm.match(/(\d+)$/) || [])[1];
  const kind = row.arm.replace(/\d+$/, '');
  if (!run) continue;
  if (!byRun.has(run)) byRun.set(run, {});
  byRun.get(run)[kind] = row;
}
const deltas = [];
for (const [run, pair] of byRun) {
  const base = pair.base;
  const other = Object.entries(pair).find(([k]) => k !== 'base');
  if (!base || !other) continue;
  const [kind, arm] = other;
  if (base.fps && arm.fps) {
    deltas.push({ run, kind, fps: arm.fps - base.fps,
      boot: (arm.postLogoToMenuMs - base.postLogoToMenuMs) / 1000 });
  }
}
if (deltas.length) {
  console.log('\n-- paired deltas (arm minus base, same run) --');
  for (const d of deltas) {
    console.log(`  run ${d.run}: fps ${d.fps >= 0 ? '+' : ''}${d.fps.toFixed(2)}   ` +
      `postLogo->menu ${d.boot >= 0 ? '+' : ''}${d.boot.toFixed(1)}s`);
  }
  console.log('\nTwo pairs is not a result. Read a delta smaller than the spread\n' +
    'between the two base arms as noise, and say so.');
}
