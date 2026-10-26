import path from 'node:path';
import Module from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withPinnedCompiler} from '../pinned-compiler.mjs';
import {aceRecoveryCompiler} from '../reconstruct-aceofskies.mjs';

test('pinned modules load from verified Git objects and restore hooks/cache after failure', () => {
  const extensions = {...Module._extensions}, cache = new Map(Object.entries(Module._cache));
  assert.throws(() => withPinnedCompiler(aceRecoveryCompiler.commit, aceRecoveryCompiler.sourceArchiveSha256, (require, root) => {
    const compiler = require(path.join(root, 'src/decompiler/exceptionStructurer.js'));
    assert.equal(typeof compiler.structureMethod, 'function');
    const unpinned = path.join(root, 'src/untracked-diagnostic-module.js');
    assert.throws(() => Module._extensions['.js'](new Module(unpinned), unpinned), /Unpinned compiler module/);
    throw new Error('owned test interruption');
  }), /owned test interruption/);
  assert.equal(Module._extensions['.js'], extensions['.js']);
  assert.equal(Module._extensions['.json'], extensions['.json']);
  for (const [file, module] of cache) assert.equal(Module._cache[file], module, 'Preexisting module cache changed: ' + file);
});

test('incorrect compiler source archive hashes fail before any operation runs', () => {
  let ran = false;
  assert.throws(() => withPinnedCompiler(aceRecoveryCompiler.commit, '0'.repeat(64), () => {ran = true;}), /source archive differs/);
  assert.equal(ran, false);
});
