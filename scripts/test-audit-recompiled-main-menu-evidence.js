#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  auditTrees,
  discoverCurrentTrees,
  parseArgs,
  readEvidence,
} = require('./audit-recompiled-main-menu-evidence');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'main-menu-evidence-'));
try {
  const classes = path.join(temporary, 'games', 'example', 'decompile-owned',
    'classes-abi-final', 'demo');
  fs.mkdirSync(classes, {recursive: true});
  fs.writeFileSync(path.join(classes, 'Example.class'), Buffer.from([1, 2, 3]));

  const trees = discoverCurrentTrees(path.join(temporary, 'games'));
  assert.strictEqual(trees.length, 1);
  assert.strictEqual(trees[0].game, 'example');

  const reportPath = path.join(temporary, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({results: [{
    game: 'example',
    variant: 'recompiled',
    status: 'main-menu',
    elapsedMs: 123,
    artifacts: {recompiledClasses: {sha256: trees[0].sha256}},
  }]}));
  const evidence = readEvidence([reportPath]);
  assert.strictEqual(auditTrees(trees, evidence)[0].status, 'proven');

  const nativeReportPath = path.join(temporary, 'native-report.json');
  fs.writeFileSync(nativeReportPath, JSON.stringify({results: [{
    game: 'example',
    variant: 'recompiled',
    status: 'main-menu',
    artifact: {sha256: trees[0].sha256},
  }]}));
  assert.strictEqual(
    auditTrees(trees, readEvidence([nativeReportPath]))[0].status,
    'proven',
    'native reflection reports use the singular artifact field',
  );

  const changed = [{...trees[0], sha256: 'changed'}];
  assert.strictEqual(auditTrees(changed, evidence)[0].status, 'missing',
    'evidence for an older class tree must not suppress a new run');

  assert.throws(() => parseArgs([]), /Missing --games-root/);
  assert.deepStrictEqual(
    parseArgs(['--games-root', temporary, '--json', reportPath]),
    {gamesRoot: temporary, reports: [reportPath], json: true},
  );
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}

console.log('recompiled main-menu evidence audit tests passed');
