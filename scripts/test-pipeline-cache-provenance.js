#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  fingerprintSnapshot,
  hashClassTree,
  selectedEnvironment,
  stampMatches,
  writeStamp,
} = require('./pipeline-cache-provenance');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-cache-test-'));
try {
  const classes = path.join(temporary, 'classes');
  fs.mkdirSync(path.join(classes, 'pkg'), {recursive: true});
  fs.writeFileSync(path.join(classes, 'A.class'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(classes, 'pkg', 'B.class'), Buffer.from([4, 5]));
  fs.writeFileSync(path.join(classes, 'ignored.txt'), 'ignored');

  const initial = hashClassTree(classes);
  assert.strictEqual(initial.files, 2);
  fs.writeFileSync(path.join(classes, 'ignored.txt'), 'still ignored');
  assert.deepStrictEqual(hashClassTree(classes), initial,
    'non-class files do not invalidate transformed bytecode');
  fs.writeFileSync(path.join(classes, 'A.class'), Buffer.from([1, 2, 4]));
  assert.notStrictEqual(hashClassTree(classes).sha256, initial.sha256,
    'class content changes invalidate the cache');

  assert.deepStrictEqual(selectedEnvironment({
    Z: 'ignored',
    PIPELINE_B: '2',
    BULK_PIPELINE_A: '1',
    SKIP_PIPELINE_PASSES: 'x',
  }), {
    BULK_PIPELINE_A: '1',
    PIPELINE_B: '2',
    SKIP_PIPELINE_PASSES: 'x',
  });

  const snapshot = {
    formatVersion: 1,
    generators: {
      dekoblokoWork: {commit: 'a'.repeat(40), trackedClean: true},
      javaTools: {commit: 'b'.repeat(40), trackedClean: true},
    },
    inputClasses: initial,
    pipeline: {arguments: [], skipPasses: '', environment: {}},
  };
  const stamp = path.join(temporary, 'stamp.json');
  writeStamp(stamp, snapshot);
  assert.strictEqual(stampMatches(stamp, snapshot), true);
  assert.strictEqual(stampMatches(stamp, {
    ...snapshot,
    inputClasses: {...initial, sha256: 'c'.repeat(64)},
  }), false, 'input changes invalidate the stamp');
  assert.strictEqual(stampMatches(stamp, {
    ...snapshot,
    generators: {
      ...snapshot.generators,
      dekoblokoWork: {...snapshot.generators.dekoblokoWork, trackedClean: false},
    },
  }), false, 'dirty generators are never reusable');
  assert.strictEqual(fingerprintSnapshot(snapshot).length, 64);
  const configured = require('./pipeline-cache-provenance').buildSnapshot({
    repo: path.resolve(__dirname, '..'),
    javaTools: path.resolve(__dirname, '..'),
    input: classes,
    skipPasses: '',
  });
  assert.strictEqual(configured.pipeline.runtimeSafetyRetry,
    'removed-runtime-handlers-with-observable-call-duplication');
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}

console.log('pipeline cache provenance tests passed');
