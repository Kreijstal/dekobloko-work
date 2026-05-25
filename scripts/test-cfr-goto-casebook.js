#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-goto-casebook-test-'));
try {
  const scan = path.join(tmp, 'scan');
  const gameDir = path.join(scan, 'samplegame');
  const cfrDir = path.join(gameDir, 'cfr');
  fs.mkdirSync(cfrDir, { recursive: true });
  const source = path.join(cfrDir, 'Foo.java');
  fs.writeFileSync(source, [
    'public class Foo {',
    '  void f(int n) {',
    '    if (n == 0) ** GOTO lbl12',
    '  }',
    '}',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(gameDir, 'markers.txt'), `${source}:3:    if (n == 0) ** GOTO lbl12\n`);

  const db = path.join(tmp, 'records.jsonl');
  const ingest = execFileSync(process.execPath, [
    path.join(DEKOB, 'scripts', 'cfr-shape-db.js'),
    'goto-ingest',
    '--scan',
    scan,
    '--game',
    'samplegame',
    '--db',
    db,
    '--tag',
    'selftest',
  ], { cwd: DEKOB, encoding: 'utf8' });
  assert.match(ingest, /goto_ingested=1/);

  const records = fs.readFileSync(db, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, 'cfr-goto-marker');
  assert.equal(records[0].game, 'samplegame');
  assert.equal(records[0].className, 'Foo');
  assert.equal(records[0].marker.type, 'goto');
  assert.equal(records[0].marker.line, 3);
  assert.equal(records[0].marker.sourceShape, 'if (id == #) ** GOTO id#');

  const clusters = execFileSync(process.execPath, [
    path.join(DEKOB, 'scripts', 'cfr-shape-db.js'),
    'goto-clusters',
    '--db',
    db,
    '--game',
    'samplegame',
  ], { cwd: DEKOB, encoding: 'utf8' });
  assert.match(clusters, /goto_records=1 clusters=1/);
  console.log('PASS cfr-goto-casebook selftest');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
