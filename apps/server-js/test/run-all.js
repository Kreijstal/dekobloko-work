'use strict';

// Minimal zero-dependency test runner: executes every test/test_*.js in a
// fresh node process and reports overall status. Wired to "npm test" via
// package.json.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const tests = fs
  .readdirSync(dir)
  .filter((f) => /^test_.+\.js$/.test(f))
  .sort();

if (tests.length === 0) {
  console.log('no test files found');
  process.exit(0);
}

let failedFiles = [];
for (const t of tests) {
  console.log('--- ' + t);
  const r = spawnSync(process.execPath, [path.join(dir, t)], {
    stdio: 'inherit',
  });
  if (r.status !== 0) failedFiles.push(t);
}

if (failedFiles.length === 0) {
  console.log('ALL GREEN (' + tests.length + ' test files)');
  process.exit(0);
}
console.log(
  'FAILED: ' + failedFiles.join(', ') + ' (' + failedFiles.length + '/' + tests.length + ')'
);
process.exit(1);
