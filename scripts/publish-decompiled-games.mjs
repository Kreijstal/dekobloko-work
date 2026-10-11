#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(import.meta.url);
const repository = path.resolve(path.dirname(script), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (command, args, options = {}) => execFileSync(command, args, {
  maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options});
const git = (root, ...args) => run('git', ['-C', root, ...args]).toString().trim();
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function inventory(root, extension) {
  const result = [];
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink() || /[\r\n\t]/.test(relative)) throw new Error(`Unsafe entry: ${relative}`);
      if (entry.isDirectory()) visit(path.join(directory, entry.name), relative + '/');
      else if (entry.isFile() && entry.name.endsWith(extension))
        result.push([relative, hash(fs.readFileSync(path.join(root, relative)))]);
      else throw new Error(`Unexpected entry: ${relative}`);
    }
  };
  visit(root);
  result.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return {files: result.length, sha256: hash(JSON.stringify(result)), entries: result};
}

export function validateReport(game, report, diagnostics, inputs, sources) {
  if (report.game !== game || report.status !== 'pass' || report.hardFailures !== 0 ||
      ['pipeline', 'cli', 'verify', 'javac'].some(key => report.failures?.[key] !== 0) ||
      report.classes !== inputs.files || report.sources !== sources.files || !sources.files ||
      report.classes !== report.sources || diagnostics.generatedFiles !== sources.files ||
      !Number.isInteger(diagnostics.validFallbacks) || diagnostics.validFallbacks < 0 ||
      diagnostics.hardFailures !== 0 || !Array.isArray(diagnostics.panics) || diagnostics.panics.length ||
      ['stackUnderflow', 'rawControlFlow', 'placeholders'].some(key => diagnostics.totals?.[key] !== 0))
    throw new Error(`Incomplete or failed export: ${game}`);
}

export function publish({batch, destination, javaTools, update = false}) {
  batch = path.resolve(batch);
  destination = path.resolve(destination);
  javaTools = path.resolve(javaTools);
  const baseline = fs.readFileSync(path.join(repository, 'scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv'), 'utf8');
  const games = baseline.split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split('\t')[0]).sort();
  const existingGames = fs.readdirSync(path.join(destination, 'games')).sort();
  if (JSON.stringify(existingGames) !== JSON.stringify(games)) throw new Error('Publication roster differs from canonical catalog');
  const provenance = json(path.join(batch, 'decompilation-provenance.json'));
  const compiler = provenance.generators?.javaTools;
  if (!compiler?.trackedClean || !provenance.generators?.dekoblokoWork?.trackedClean ||
      git(javaTools, 'rev-parse', 'HEAD') !== compiler.commit || git(javaTools, 'status', '--porcelain'))
    throw new Error('Compiler checkout must match the clean batch compiler');
  const archive = run('git', ['-C', javaTools, 'archive', '--format=tar', compiler.commit]);
  const stub = path.join(batch, 'tooling/dekobloko-work/lib/dekobloko-stubs.jar');
  if (!fs.existsSync(stub)) throw new Error('Missing batch compilation stubs');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-publish-validation-'));
  const records = {};
  const pipelineEnvironment = {...process.env};
  for (const key of Object.keys(pipelineEnvironment))
    if (key.startsWith('PIPELINE_') || key.startsWith('BULK_PIPELINE_') || key === 'SKIP_PIPELINE_PASSES')
      delete pipelineEnvironment[key];
  Object.assign(pipelineEnvironment, provenance.invocation.environment);
  try {
    for (const game of games) {
      const root = path.join(batch, game);
      const owned = path.join(root, 'decompile-owned');
      const inputs = inventory(path.join(root, 'classes'), '.class');
      const transformed = inventory(path.join(owned, 'out'), '.class');
      const sources = inventory(path.join(owned, 'java'), '.java');
      const report = json(path.join(owned, 'logs/report.json'));
      const diagnostics = json(path.join(owned, 'logs/diagnostics.json'));
      validateReport(game, report, diagnostics, inputs, sources);
      const stamp = json(path.join(owned, 'pipeline-provenance.json'));
      if (JSON.stringify(stamp.snapshot.generators) !== JSON.stringify(provenance.generators))
        throw new Error(`Pipeline generators differ: ${game}`);
      run(process.execPath, [path.join(batch, 'tooling/dekobloko-work/scripts/pipeline-cache-provenance.js'),
        'check', path.join(owned, 'pipeline-provenance.json'), '--repo', path.join(batch, 'tooling/dekobloko-work'),
        '--java-tools', javaTools, '--input', path.join(root, 'classes'),
        '--skip-passes', stamp.snapshot.pipeline.skipPasses], {env: pipelineEnvironment});
      // Compile all emitted peers, without original classes on the classpath.
      // A previous successful report cannot conceal later source edits.
      const classes = path.join(temporary, game);
      fs.mkdirSync(classes);
      const argumentsFile = path.join(temporary, `${game}.args`);
      fs.writeFileSync(argumentsFile, sources.entries.map(([file]) => JSON.stringify(path.join(owned, 'java', file))).join('\n') + '\n');
      run('javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-sourcepath', '', '-classpath', stub,
        '-d', classes, '@' + argumentsFile]);
      const {entries: inputEntries, ...inputIdentity} = inputs;
      const {entries: transformedEntries, ...transformedIdentity} = transformed;
      const {entries: sourceEntries, ...sourceIdentity} = sources;
      records[game] = {originalClasses: inputIdentity, transformedClasses: transformedIdentity,
        sources: sourceIdentity, pipelineFingerprint: stamp.fingerprint,
        diagnostics: {hardFailures: diagnostics.hardFailures, validFallbacks: diagnostics.validFallbacks,
          totals: diagnostics.totals}, validation: {bytecodeVerifier: 'pass', javac: 'pass',
          javacArguments: ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-sourcepath', '', '-classpath', 'batch-stubs']}};
      if (!update && inventory(path.join(destination, 'games', game), '.java').sha256 !== sources.sha256)
        throw new Error(`Published source differs: ${game}`);
      console.log(`${game}\t${sources.files}\tcompiled\tfallbacks=${diagnostics.validFallbacks}`);
    }
    const manifest = {...provenance, generators: {...provenance.generators,
      javaTools: {...compiler, sourceArchive: {sha256: hash(archive),
        reproduce: `git archive --format=tar ${compiler.commit} | sha256sum`,
        format: 'Git-generated tar archive of all tracked decompiler repository files; excludes build caches and dependencies'}}},
      publication: {syncedGames: games, contentIdentityAlgorithm: 'SHA-256 of JSON-encoded sorted [relative path, file SHA-256] pairs',
        compilerReadability: 'automatic defaults; no CFR_JS transformation flags',
        stubJarSha256: hash(fs.readFileSync(stub)),
        publisher: {repository: 'Kreijstal/dekobloko-work', commit: git(repository, 'rev-parse', 'HEAD'),
          sourceSha256: hash(fs.readFileSync(script))},
        readableExports: 'Separately pinned named exports retain their own input commits and provenance.', games: records}};
    const manifestFile = path.join(destination, 'decompilation-provenance.json');
    if (update) {
      const refresh = fs.mkdtempSync(path.join(destination, '.catalog-refresh-'));
      try {
        const generated = path.join(refresh, 'games');
        fs.mkdirSync(generated);
        for (const game of games) fs.cpSync(path.join(batch, game, 'decompile-owned/java'), path.join(generated, game), {recursive: true});
        const bytes = JSON.stringify(manifest, null, 2) + '\n';
        fs.writeFileSync(path.join(refresh, 'provenance.json'), bytes);
        const current = path.join(destination, 'games');
        const previous = path.join(refresh, 'previous');
        fs.renameSync(current, previous);
        try {
          fs.renameSync(generated, current);
          fs.renameSync(path.join(refresh, 'provenance.json'), manifestFile);
        } catch (error) {
          fs.rmSync(current, {recursive: true, force: true});
          fs.renameSync(previous, current);
          throw error;
        }
        fs.rmSync(previous, {recursive: true});
      } finally {
        if (!fs.existsSync(path.join(refresh, 'previous'))) fs.rmSync(refresh, {recursive: true, force: true});
      }
    } else {
      const previous = json(manifestFile);
      if (JSON.stringify(previous) !== JSON.stringify(manifest)) throw new Error('Publication provenance differs');
    }
    return {games: games.length, sources: Object.values(records).reduce((n, record) => n + record.sources.files, 0),
      compilerCommit: compiler.commit, compilerSourceSha256: hash(archive), updated: update};
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  const args = process.argv.slice(2);
  const update = args.at(-1) === '--update';
  if (update || args.at(-1) === '--check') args.pop();
  if (args.length !== 3) throw new Error('Usage: node scripts/publish-decompiled-games.mjs BATCH FUNORB_REPO JAVA_TOOLS [--update|--check]');
  console.log(JSON.stringify(publish({batch: args[0], destination: args[1], javaTools: args[2], update})));
}
