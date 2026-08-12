#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {parseArgs, selectedRecompiledDirectory} =
  require('./run-jre-reflection-main-menu');

assert.strictEqual(parseArgs([]).variant, 'both');
assert.ok(parseArgs([]).cacheRoot.endsWith(
  path.join('.work', 'jre-reflection-main-menu', 'cache')));
assert.deepStrictEqual(parseArgs([
  '--game', 'example', '--exclude-game', 'skip', '--variant', 'original',
  '--timeout-ms', '1234',
]).games, ['example']);
assert.deepStrictEqual(parseArgs(['--exclude-game', 'skip']).excludedGames,
  ['skip']);
assert.throws(() => parseArgs(['--variant', 'unknown']), /must be original/);
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'jre-reflection-test-'));
try {
  const owned = path.join(fixture, '.work', 'games', 'example',
    'decompile-owned');
  fs.mkdirSync(path.join(owned, 'classes'), {recursive: true});
  assert.strictEqual(selectedRecompiledDirectory('example', fixture),
    path.join(owned, 'classes'));
  fs.mkdirSync(path.join(owned, 'classes-abi-final'));
  assert.strictEqual(selectedRecompiledDirectory('example', fixture),
    path.join(owned, 'classes-abi-final'), 'the final ABI tree takes priority');
  assert.strictEqual(selectedRecompiledDirectory('missing', fixture), null);
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
console.log('JRE reflection main-menu coordinator tests passed');
