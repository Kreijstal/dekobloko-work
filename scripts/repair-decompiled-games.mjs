#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inventory, validateReport} from './publish-decompiled-games.mjs';

const script = fileURLToPath(import.meta.url);
const repository = path.resolve(path.dirname(script), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {maxBuffer: 128 * 1024 * 1024});
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function run(command, args) {
  const result = spawnSync(command, args, {maxBuffer: 128 * 1024 * 1024});
  if (result.status !== 0) throw new Error(result.stderr?.toString() || result.error?.message || `${command} exited ${result.status}`);
  return Buffer.concat([result.stdout || Buffer.alloc(0), result.stderr || Buffer.alloc(0)]);
}

export function repairFailedGames(batch, javaTools) {
  batch = path.resolve(batch); javaTools = path.resolve(javaTools);
  if (git(javaTools, 'status', '--porcelain').toString().trim() || git(repository, 'status', '--porcelain', '--untracked-files=no').toString().trim())
    throw new Error('Repair tools and publisher must be clean committed sources');
  const commit = git(javaTools, 'rev-parse', 'HEAD').toString().trim();
  const compiler = {repository: 'Kreijstal/java-tools', commit, trackedClean: true,
    sourceArchive: {sha256: hash(git(javaTools, 'archive', '--format=tar', commit)),
      reproduce: `git archive --format=tar ${commit} | sha256sum`,
      format: 'Git-generated tar archive of all tracked decompiler repository files; excludes build caches and dependencies'}};
  const runner = {repository: 'Kreijstal/dekobloko-work', commit: git(repository, 'rev-parse', 'HEAD').toString().trim(), sourceSha256: hash(fs.readFileSync(script))};
  const stub = path.join(batch, 'tooling/dekobloko-work/lib/dekobloko-stubs.jar');
  let repaired = 0;
  for (const game of fs.readdirSync(batch).sort()) {
    const root = path.join(batch, game), owned = path.join(root, 'decompile-owned');
    const reportFile = path.join(owned, 'logs/report.json');
    if (!fs.existsSync(reportFile)) continue;
    const previous = json(reportFile);
    if (previous.status === 'pass' || previous.failures?.pipeline !== 0 || previous.failures?.verify !== 0) continue;
    console.log(`${game}\trebuilding with ${commit}`);
    const stage = fs.mkdtempSync(path.join(root, '.compiler-repair-'));
    const backup = path.join(stage, 'previous-java');
    const previousClasses = path.join(stage, 'previous-classes');
    try {
      const java = path.join(stage, 'java'), diagnosticsFile = path.join(stage, 'diagnostics.json');
      const input = path.join(owned, 'out');
      const decompilerLog = run(process.execPath, [path.join(javaTools, 'scripts/runCfr.js'), '--fail-on-hard-failure',
        '--classpath', input + path.delimiter + stub, '--diagnostics-json', diagnosticsFile, '--outputdir', java, input]);
      const inputs = inventory(path.join(root, 'classes'), '.class'), sources = inventory(java, '.java');
      const diagnostics = json(diagnosticsFile);
      const report = {...previous, status: 'pass', sources: sources.files, hardFailures: diagnostics.hardFailures,
        failures: {pipeline: 0, cli: 0, verify: 0, javac: 0},
        decompiler: {...compiler, sourceTreeSha256: sources.sha256, correctedFailures: previous.failures, runner}};
      validateReport(game, report, diagnostics, inputs, sources);
      const argumentsFile = path.join(stage, 'sources.args'), classes = path.join(stage, 'classes');
      fs.mkdirSync(classes);
      fs.writeFileSync(argumentsFile, sources.entries.map(([file]) => JSON.stringify(path.join(java, file))).join('\n') + '\n');
      const javacLog = run('javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-sourcepath', '',
        '-classpath', stub, '-d', classes, '@' + argumentsFile]);
      const replacements = new Map([
        ['diagnostics.json', fs.readFileSync(diagnosticsFile)], ['decompiler.log', decompilerLog], ['javac.log', javacLog],
        ['report.json', Buffer.from(JSON.stringify(report, null, 2) + '\n')],
      ]);
      const originals = new Map([...replacements.keys()].map(file => {
        const current = path.join(owned, 'logs', file);
        return [file, fs.existsSync(current) ? fs.readFileSync(current) : null];
      }));
      fs.renameSync(path.join(owned, 'java'), backup);
      try {
        fs.renameSync(path.join(owned, 'classes'), previousClasses);
        fs.renameSync(classes, path.join(owned, 'classes'));
        fs.renameSync(java, path.join(owned, 'java'));
        for (const [file, bytes] of replacements) {
          const candidate = path.join(stage, file);
          fs.writeFileSync(candidate, bytes);
          fs.renameSync(candidate, path.join(owned, 'logs', file));
        }
      } catch (error) {
        fs.rmSync(path.join(owned, 'java'), {recursive: true, force: true});
        fs.renameSync(backup, path.join(owned, 'java'));
        if (fs.existsSync(previousClasses)) {
          fs.rmSync(path.join(owned, 'classes'), {recursive: true, force: true});
          fs.renameSync(previousClasses, path.join(owned, 'classes'));
        }
        for (const [file, bytes] of originals) {
          const current = path.join(owned, 'logs', file);
          if (bytes === null) fs.rmSync(current, {force: true});
          else fs.writeFileSync(current, bytes);
        }
        throw error;
      }
      fs.rmSync(backup, {recursive: true});
      fs.rmSync(previousClasses, {recursive: true});
      repaired++;
      console.log(`${game}\t${sources.files}\tcompiled\tfallbacks=${diagnostics.validFallbacks}`);
    } finally {
      if (!fs.existsSync(backup) && !fs.existsSync(previousClasses)) fs.rmSync(stage, {recursive: true, force: true});
    }
  }
  return {repaired, compilerCommit: commit, compilerSourceSha256: compiler.sourceArchive.sha256};
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/repair-decompiled-games.mjs BATCH JAVA_TOOLS');
  console.log(JSON.stringify(repairFailedGames(process.argv[2], process.argv[3])));
}
