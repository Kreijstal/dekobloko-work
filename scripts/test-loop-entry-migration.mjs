import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inventory} from './publish-decompiled-games.mjs';

// Game fixtures and the historical offset-selected patch belong here. The
// reusable compiler tests use arbitrary classes, labels, types and local slots.
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselineCommit = '28c17068a9a5522b304ebd8c1c5b31aef464fadc';
if (process.argv.length !== 3) throw new Error('Usage: node scripts/test-loop-entry-migration.mjs CHESS_ORIGINAL_CLASSES');
const input = path.resolve(process.argv[2]);
const originalTree = inventory(input, '.class');
assert.equal(originalTree.files, 346, 'Expected the complete fixed Chess class set');
assert.equal(originalTree.sha256, 'cb11a7585f65041308a97b4da97aa8063b00846504e6adcbecebed5e76548035');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const original = fs.readFileSync(path.join(input, 'b.class'));
assert.equal(hash(original), '6c0ca9e2fc820897a1fe02c349e9db23acbc5c2f22d24ace6637b4a8c35b06e9',
  'Expected the fixed original Chess class fixture');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-entry-migration-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 180000,
    maxBuffer: 8 * 1024 * 1024, ...options});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
try {
  const javaTools = path.resolve(process.env.JAVA_TOOLS_DIR || path.join(repository, '../java-tools'));
  const environment = {...process.env, JAVA_TOOLS_DIR: javaTools,
    BULK_PIPELINE_CLASS_FILTER: '^b\\.class$', BULK_PIPELINE_SKIP_UNSELECTED_COPY: '1',
    BULK_PIPELINE_LOG_FAILURES: '1', PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES: '1',
    SKIP_PIPELINE_PASSES: 'intize-boolean-parameters,compile-conflict-renames'};
  delete environment.JAVA_TOOL_OPTIONS;
  const outputs = [];
  for (const variant of ['baseline', 'candidate']) {
    const checkout = path.join(temporary, variant), archive = path.join(temporary, variant + '.tar');
    fs.mkdirSync(checkout);
    run('git', ['-C', repository, 'archive', '--format=tar', '--output=' + archive, baselineCommit]);
    run('tar', ['-xf', archive, '-C', checkout]);
    if (variant === 'candidate') {
      for (const relative of ['scripts/pipeline/bulk-pipeline.js', 'scripts/pipeline/profiles/chess.json'])
        fs.copyFileSync(path.join(repository, relative), path.join(checkout, relative));
      fs.rmSync(path.join(checkout, 'scripts/pipeline/bParserLoopHeader.js'));
    }
    const output = path.join(temporary, variant + '-out');
    const stdout = run(process.execPath, ['scripts/pipeline/bulk-pipeline.js', input, output,
      '--profile', 'chess', '--safe-bytecode'], {cwd: checkout, env: environment});
    // A silent passthrough has identical bytes too. It is a failed comparison,
    // not evidence that the removed preprocessing was unnecessary.
    assert.match(stdout, /Done: 1\/1 processed, 0 failed \(passthrough\), 0 copied/);
    outputs.push(fs.readFileSync(path.join(output, 'b.class')));
  }
  assert.deepEqual(outputs[0], outputs[1], 'Removing the offset patch changes the fixed class output');
  assert.deepEqual(fs.readFileSync(path.join(input, 'b.class')), original, 'Original input was modified');
  console.log(JSON.stringify({baselineCommit, game: 'chess', class: 'b',
    originalClassTreeSha256: originalTree.sha256,
    originalClassSha256: hash(original), outputClassSha256: hash(outputs[0]),
    identicalPipelineOutput: true, processedPerVariant: 1, failuresPerVariant: 0,
    wholeGameEquivalenceVerified: false}));
} finally {fs.rmSync(temporary, {recursive: true, force: true});}
