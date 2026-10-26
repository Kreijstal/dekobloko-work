// Re-export one raw class without claiming an unchanged catalog was regenerated.
// The compiler executes from its committed source archive, excluding local WIP.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {inventory, validateNamedExport} from '../scripts/publish-decompiled-games.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const funorb = path.resolve(root, '../funorb-decompiled'), tools = path.resolve(root, '../java-tools');
const run = (command, args, options = {}) => execFileSync(command, args,
  {maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options});
const git = (directory, ...args) => run('git', ['-C', directory, ...args]).toString().trim();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2), update = args.includes('--update');
const positional = args.filter(arg => !arg.startsWith('--'));
const [game, name, probePath] = positional;
if (args.some(arg => arg.startsWith('--') && !['--update', '--check'].includes(arg)) ||
    !/^[a-z0-9_]+$/.test(game || '') || !/^[\w$/]+$/.test(name || '') || name.includes('..') ||
    (update && args.includes('--check')) || positional.length < 2 || positional.length > 3)
  throw Error('Usage: node readable/refresh-raw-class.mjs GAME CLASS [PROBE_MODULE] [--update|--check]');
assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '', 'Commit the reproduction script first');
assert.equal(git(funorb, 'status', '--porcelain', '--untracked-files=no'), '', 'Export repository must be committed');
const manifestPath = path.join(funorb, 'decompilation-provenance.json');
const manifestBytes = fs.readFileSync(manifestPath), manifest = JSON.parse(manifestBytes);
const record = manifest.publication.games[game];
assert.ok(record && !manifest.namedExports?.[game], 'Only an existing raw game may be refreshed');
// Check every retained source identity before preparing a replacement.
for (const [id, value] of Object.entries(manifest.publication.games)) {
  const named = manifest.namedExports?.[id];
  const actual = named ? validateNamedExport(funorb, id, named)
    : inventory(path.join(funorb, 'games', id), '.java', ['README.md']);
  const expected = named ? value.publishedSources : value.sources;
  assert.equal(actual.sha256, expected.sha256, 'Existing catalog differs: ' + id);
}
const relative = name + '.java', target = path.join(funorb, 'games', game, relative);
const previousBytes = fs.readFileSync(target);
const existing = record.sourceRepairs?.classes?.[relative];
const revision = update ? git(tools, 'rev-parse', 'HEAD') : existing?.generator?.commit;
assert.match(revision || '', /^[a-f0-9]{40}$/, 'A check requires an existing pinned refresh receipt');
const archive = run('git', ['-C', tools, 'archive', '--format=tar', revision]);
const generator = {repository: 'Kreijstal/java-tools', commit: revision, execution: 'committed-source-archive',
  sourceArchive: {sha256: hash(archive), reproduce: `git archive --format=tar ${revision} | sha256sum`,
    format: 'Git-generated tar archive of all tracked decompiler source; not a game JAR'}};
if (!update) assert.deepEqual(generator, existing.generator);
const jar = path.join(root, '.work/gamepacks', game + '.jar');
const jarBytes = fs.readFileSync(jar);
const requireTools = createRequire(path.join(tools, 'package.json'));
const JSZip = requireTools('jszip'), zip = await JSZip.loadAsync(jarBytes);
const originals = [];
for (const file of Object.keys(zip.files).filter(file => file.endsWith('.class')).sort())
  originals.push([file, hash(await zip.file(file).async('nodebuffer'))]);
assert.equal(originals.length, record.originalClasses.files);
assert.equal(hash(JSON.stringify(originals)), record.originalClasses.sha256, 'Fixed original class corpus differs');
const inputBytes = await zip.file(name + '.class')?.async('nodebuffer');
assert.ok(inputBytes, 'Original class is absent');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-class-refresh-'));
try {
  const compiler = path.join(temporary, 'compiler'); fs.mkdirSync(compiler);
  run('tar', ['-xf', '-', '-C', compiler], {input: archive});
  fs.symlinkSync(path.join(tools, 'node_modules'), path.join(compiler, 'node_modules'), 'dir');
  const input = path.join(temporary, 'input', name + '.class');
  fs.mkdirSync(path.dirname(input), {recursive: true}); fs.writeFileSync(input, inputBytes);
  const generated = path.join(temporary, 'generated'), stubs = path.join(root, 'lib/dekobloko-stubs.jar');
  run(process.execPath, [path.join(compiler, 'scripts/runCfr.js'), '--fail-on-hard-failure',
    '--classpath', jar + path.delimiter + stubs, '--outputdir', generated, input]);
  const outputBytes = fs.readFileSync(path.join(generated, relative));
  const candidate = path.join(temporary, 'game');
  fs.cpSync(path.join(funorb, 'games', game), candidate, {recursive: true});
  fs.writeFileSync(path.join(candidate, relative), outputBytes);
  const sources = inventory(candidate, '.java', ['README.md']);
  const argumentsFile = path.join(temporary, 'sources.args'), classes = path.join(temporary, 'classes');
  fs.writeFileSync(argumentsFile, sources.entries.map(([file]) => JSON.stringify(path.join(candidate, file))).join('\n') + '\n');
  run('javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-sourcepath', '',
    '-classpath', stubs, '-d', classes, '@' + argumentsFile]);
  let semanticProbe = null;
  if (probePath) {
    const absolute = path.resolve(root, probePath), moduleRelative = path.relative(root, absolute);
    assert.ok(!moduleRelative.startsWith('..') && !path.isAbsolute(moduleRelative), 'Probe must belong to Deko');
    const probeBytes = fs.readFileSync(absolute), probe = await import(pathToFileURL(absolute));
    assert.match(probe.className, /^[A-Za-z_$][\w$]*$/);
    const java = path.join(temporary, probe.className + '.java'), probeClasses = path.join(temporary, 'probe');
    fs.writeFileSync(java, probe.source);
    run('javac', ['--release', '8', '-d', probeClasses, java]);
    const execute = classpath => run('java', ['-Xverify:all', '-cp',
      [probeClasses, classpath, stubs].join(path.delimiter), probe.className]).toString().trim();
    const original = execute(jar), rebuilt = execute(classes);
    assert.equal(original, probe.expected, 'Independent original-bytecode reference differs');
    assert.equal(rebuilt, original, 'Recompiled class differs from original bytecode');
    semanticProbe = {path: moduleRelative, sha256: hash(probeBytes), reference: original, rebuilt};
  }
  const receipt = {generator, input: {path: name + '.class', sha256: hash(inputBytes), gameJarSha256: hash(jarBytes)},
    output: {path: `games/${game}/${relative}`, sha256: hash(outputBytes)},
    validation: {wholeGameJavac: 'pass', sources: sources.files, originalBytecodeProbe: semanticProbe}};
  if (!update) {
    assert.equal(hash(outputBytes), hash(previousBytes), 'Published class differs from pinned reproduction');
    for (const key of Object.keys(receipt)) assert.deepEqual(receipt[key], existing[key], 'Refresh receipt differs: ' + key);
    assert.equal(sources.sha256, record.sources.sha256);
  } else if (hash(outputBytes) !== hash(previousBytes) || !existing) {
    receipt.base = {commit: git(funorb, 'rev-parse', 'HEAD'), sourceSha256: hash(previousBytes), sources: record.sources};
    receipt.runner = {repository: 'Kreijstal/dekobloko-work', commit: git(root, 'rev-parse', 'HEAD'),
      script: 'readable/refresh-raw-class.mjs'};
    record.sourceRepairs ||= {classes: {}};
    record.sourceRepairs.classes[relative] = receipt;
    record.sources = {files: sources.files, sha256: sources.sha256};
    assert.deepEqual(fs.readFileSync(manifestPath), manifestBytes, 'Manifest changed during refresh');
    assert.deepEqual(fs.readFileSync(target), previousBytes, 'Source changed during refresh');
    try {
      fs.writeFileSync(target, outputBytes);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    } catch (error) {fs.writeFileSync(target, previousBytes); fs.writeFileSync(manifestPath, manifestBytes); throw error;}
  }
  console.log(JSON.stringify({game, class: name, mode: update ? 'update' : 'check', sources: sources.files,
    compilerCommit: revision, compilerSourceSha256: generator.sourceArchive.sha256,
    semanticProbe: semanticProbe?.reference, sourceSha256: hash(outputBytes)}));
} finally {fs.rmSync(temporary, {recursive: true, force: true});}
