import {funorbRepository} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const current = JSON.parse(fs.readFileSync(path.join(root, 'geoblox-rules.json')));
function rejection(change, message, update = false) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-current-source-'));
  try {
    captureProcess('git', ['clone', '--shared', '--no-checkout', '--quiet', path.resolve(root, '..'), temporary]);
    const directory = path.join(temporary, 'readable');
    for (const file of ['reproduce-geoblox.mjs', 'build-geoblox-rules.mjs', 'layout.mjs', 'text-resource-evidence.mjs',
      'geoblox-rules.json', ...current.publication.nativeEvidence.map(item => item.file),
      'tools/PIN.json', 'tools/readable-java.mjs',
      'tools/lib/ReadableJava.java', 'tools/lib/capture-process.mjs']) {
      const destination = path.join(directory, file);
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.copyFileSync(path.join(root, file), destination);
    }
    const fixtureFunorb = path.join(temporary, 'funorb');
    captureProcess('git', ['clone', '--shared', '--no-checkout', '--quiet', funorbRepository, fixtureFunorb]);
    fs.mkdirSync(path.join(fixtureFunorb, 'readable'), {recursive: true});
    fs.copyFileSync(path.join(funorbRepository, 'readable/funorb-stubs.jar'), path.join(fixtureFunorb, 'readable/funorb-stubs.jar'));
    const file = path.join(directory, 'geoblox-rules.json');
    const manifest = JSON.parse(fs.readFileSync(file));
    change(manifest, directory, fixtureFunorb);
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    const output = path.join(temporary, 'output');
    const currentOutput = path.join(fixtureFunorb, 'readable/geoblox');
    const retained = path.join(currentOutput, 'src', 'Retained.java');
    if (update) {
      fs.mkdirSync(path.dirname(retained), {recursive: true});
      fs.writeFileSync(retained, 'previous reviewed output\n');
    }
    const inventory = directory => fs.readdirSync(directory, {withFileTypes: true}).sort((a,b) =>
      a.name.localeCompare(b.name)).flatMap(item => item.isDirectory()
        ? inventory(path.join(directory, item.name)).map(([name,bytes]) => [item.name + '/' + name,bytes])
        : [[item.name,fs.readFileSync(path.join(directory, item.name), 'utf8')]]);
    const before = update ? inventory(currentOutput) : undefined;
    assert.throws(() => {
      try { captureProcess('env', ['FUNORB_DECOMPILED_DIR=' + fixtureFunorb, process.execPath, path.join(directory, 'reproduce-geoblox.mjs'),
        ...(update ? ['--update'] : [output])]); }
      catch (error) { throw new Error(error.stderr?.toString() || error.message); }
    }, message);
    assert.equal(fs.existsSync(output), false, 'refusal must not leave a partial export');
    if (update) {
      assert.deepEqual(inventory(currentOutput), before, 'rejected refresh must preserve the complete current output');
      assert.equal(fs.readdirSync(path.join(fixtureFunorb, 'readable')).some(name => name.startsWith('.geoblox-refresh-')), false,
        'failed refresh must clean its staging directory');
    }
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}

test('wrapper checks frozen source bytes directly from the Git input', () => {
  rejection(data => { data.publication.sourceEvidence[0].sha256 = '0'.repeat(64); }, /Reviewed source differs/);
  rejection(data => { data.publication.sourceEvidence[0].file = '../ab.java'; }, /Invalid current source evidence/);
});
test('wrapper refuses unreviewed rule changes and previous Git hash corruption', () => {
  rejection(data => { data.renames[0].to = 'Different'; }, /without an explicit naming change/);
  rejection(data => { data.publication.previousRules.sha256 = '0'.repeat(64); }, /Previous Git rules differ/);
});
test('wrapper rejects changed native probe bytes before compilation', () => {
  rejection(data => { data.publication.nativeEvidence[0].sha256 = '0'.repeat(64); }, /Reviewed native probe differs/);
  for (const item of current.publication.nativeEvidence) rejection((_data, directory) => {
    fs.appendFileSync(path.join(directory, item.file), '\n');
  }, /Reviewed native probe differs/);
});
test('wrapper verifies resource assignments against the actual current source', () => {
  rejection(data => { data.publication.textResources.loaderSourceSha256 = '0'.repeat(64); }, /loader source differs/);
  rejection(data => { data.publication.textResources.resourceAssignments[0].resources[0].key = 'wrong'; },
    /direct guarded assignments/);
});
test('wrapper refuses a changed compilation dependency or naming tool', () => {
  rejection(data => { data.publication.stubJarSha256 = '0'.repeat(64); }, /Frozen compilation dependency changed/);
  rejection((_data, directory) => { fs.appendFileSync(path.join(directory, 'tools/readable-java.mjs'), '\n'); },
    /Frozen naming tool changed/);
});
test('current output survives rejected evidence and stale symbol spelling during refresh', () => {
  rejection(data => { data.publication.sourceEvidence[0].sha256 = '0'.repeat(64); },
    /Reviewed source differs/, true);
  rejection(data => {
    const rule = data.renames.find(item => item.symbol.startsWith('L:'));
    let change = data.publication.ruleChanges.find(item => item.symbol === rule.symbol);
    if (!change) {
      change = {symbol: rule.symbol, before: {...rule}, after: {...rule}};
      data.publication.ruleChanges.push(change);
    }
    rule.originalName = 'incorrectOriginalSpelling';
    change.after = {...rule};
  }, /Original name mismatch/, true);
});
test('refresh refuses unmanaged files in the current export', () => {
  rejection((_data, _directory, fixtureFunorb) => {
    fs.mkdirSync(path.join(fixtureFunorb, 'readable/geoblox'), {recursive: true});
    fs.writeFileSync(path.join(fixtureFunorb, 'readable/geoblox', 'notes.txt'), 'preserve this file\n');
  }, /Refusing to replace unmanaged export entry: notes.txt/, true);
});
test('refresh targets only the current export and cannot be combined with check', () => {
  for (const args of [['--update', '--check'], ['--update', '/tmp/another-export']])
    assert.throws(() => {
      try { captureProcess('env', ['FUNORB_DECOMPILED_DIR=' + funorbRepository, process.execPath, path.join(root, 'reproduce-geoblox.mjs'), ...args]); }
      catch (error) { throw new Error(error.stderr?.toString() || error.message); }
    }, /Usage:/);
});
