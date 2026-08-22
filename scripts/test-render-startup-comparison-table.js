#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {buildRows, median, render} = require('./render-startup-comparison-table');

assert.strictEqual(median([3, 1, 2]), 2);
assert.strictEqual(median([4, 1, 2, 3]), 2.5);

const jre = [{file: 'jre.json', value: {results: [
  {game: 'example', name: 'Example', variant: 'original', status: 'main-menu', elapsedMs: 1000},
  {game: 'example', name: 'Example', variant: 'recompiled', status: 'main-menu', elapsedMs: 1100},
]}}];
const jvmjs = [{file: 'jvmjs.json', value: {jobs: 1, menuSceneTransitions: 0, results: [
  {game: 'example', name: 'Example', variant: 'recompiled', status: 'main-menu', elapsedMs: 5500},
]}}];
const rows = buildRows(jre, jvmjs);
assert.strictEqual(rows.length, 1);
assert.strictEqual(rows[0].jvmjsToJreRatio, 5);
assert.match(render(rows).markdown, /\| Example \| 1\.000 s \| 1\.100 s \| \+10\.0% \|/);
assert.throws(() => buildRows(jre, []), /Incomplete comparison/);
console.log('startup comparison table tests passed');
