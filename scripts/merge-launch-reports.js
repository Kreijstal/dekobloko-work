#!/usr/bin/env node
'use strict';

// Merges several launch reports into one, per game.
//
// A sweep sometimes has to be re-run for a subset of games -- a timeout that
// was too tight, a cache that turned out to be warm -- and the re-run is the
// result that should count. Later files therefore win over earlier ones, so
// the merge order is "oldest first, corrections last".
//
//   node scripts/merge-launch-reports.js out.json first.json second.json ...

const fs = require('fs');

const [outputPath, ...inputPaths] = process.argv.slice(2);
if (!outputPath || inputPaths.length === 0) {
  console.error('usage: merge-launch-reports.js <out.json> <in.json> [in.json ...]');
  process.exit(2);
}

const merged = new Map();
let last = null;
for (const inputPath of inputPaths) {
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  last = report;
  for (const result of report.results) merged.set(result.game, result);
}

const results = [...merged.values()].sort((a, b) => a.game.localeCompare(b.game));
fs.writeFileSync(outputPath, `${JSON.stringify({ ...last, results }, null, 2)}\n`);

const counts = {};
for (const result of results) counts[result.status] = (counts[result.status] ?? 0) + 1;
console.log(`${results.length} games -> ${outputPath}`);
console.log(JSON.stringify(counts));
