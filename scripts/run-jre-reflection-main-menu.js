#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync, spawnSync} = require('child_process');
const {hashClassTree} = require('./pipeline-cache-provenance');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_URL = 'https://static.alterorb.net/launcher/v3/config.json';
const PROBE_SOURCE = path.join(__dirname, 'jre-reflection-main-menu',
  'ReflectionMainMenuProbe.java');
const HOOK_SOURCE = path.join(ROOT, 'stubs', 'src', 'net', 'alterorb',
  'launcher', 'Hook.java');
const PROBE_CLASSES = path.join(ROOT, '.work', 'jre-reflection-main-menu',
  'probe-classes');

function parseArgs(argv) {
  const options = {
    games: [], excludedGames: [], variant: 'both', timeoutMs: 180000,
    report: path.join(ROOT, '.work', 'jre-reflection-main-menu', 'report.json'),
    configUrl: CONFIG_URL,
    cacheRoot: path.join(ROOT, '.work', 'jre-reflection-main-menu', 'cache'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--game') options.games.push(argv[++index]);
    else if (argument === '--exclude-game') options.excludedGames.push(argv[++index]);
    else if (argument === '--variant') options.variant = argv[++index];
    else if (argument === '--timeout-ms') options.timeoutMs = Number(argv[++index]);
    else if (argument === '--report') options.report = path.resolve(argv[++index]);
    else if (argument === '--config-url') options.configUrl = argv[++index];
    else if (argument === '--cache-root') options.cacheRoot = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!['original', 'recompiled', 'both'].includes(options.variant)) {
    throw new Error('--variant must be original, recompiled, or both');
  }
  return options;
}

function compileProbe() {
  fs.mkdirSync(PROBE_CLASSES, {recursive: true});
  execFileSync('javac', [
    '-source', '11', '-target', '11', '-d', PROBE_CLASSES,
    PROBE_SOURCE, HOOK_SOURCE,
  ], {stdio: 'inherit'});
}

function selectedRecompiledDirectory(game, root = ROOT) {
  const owned = path.join(root, '.work', 'games', game, 'decompile-owned');
  for (const name of [
    'classes-abi-final', 'classes-abi-latest', 'classes-abi-current-next',
    'classes-abi-current', 'classes-abi', 'classes',
  ]) {
    const candidate = path.join(owned, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function runGame(game, variant, options, config) {
  const classPath = variant === 'original'
    ? path.join(ROOT, '.work', 'gamepacks', `${game.internalName}.jar`)
    : selectedRecompiledDirectory(game.internalName);
  if (!classPath || !fs.existsSync(classPath)) {
    return {game: game.internalName, variant, status: 'missing-classes', elapsedMs: 0};
  }
  if (variant === 'original' && sha256(classPath) !== game.gamepackHash) {
    return {
      game: game.internalName,
      variant,
      status: 'hash-mismatch',
      elapsedMs: 0,
      expectedHash: game.gamepackHash,
      actualHash: sha256(classPath),
    };
  }
  const cache = path.join(options.cacheRoot, game.internalName);
  fs.mkdirSync(cache, {recursive: true});
  const result = spawnSync('xvfb-run', [
    '-a', 'java', '-cp', PROBE_CLASSES, 'ReflectionMainMenuProbe',
    '--game', game.internalName,
    '--main-class', game.mainClass,
    '--classpath', classPath,
    '--code-base', config.server,
    '--gamecrc', String(game.gamecrc),
    '--timeout-ms', String(options.timeoutMs),
  ], {
    cwd: cache,
    encoding: 'utf8',
    timeout: options.timeoutMs + 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const line = String(result.stdout || '').split(/\r?\n/)
    .find(value => value.startsWith('JRE_REFLECTION_RESULT\t'));
  const fields = line ? line.split('\t') : [];
  return {
    game: game.internalName,
    name: game.name,
    variant,
    status: fields[2] || (result.error ? 'launcher-error' : 'invalid-result'),
    elapsedMs: Number(fields[3] || 0),
    surfaceHash: fields[4] || null,
    nonblankSamples: Number(fields[5] || 0),
    uniqueSampleColors: Number(fields[6] || 0),
    artifact: variant === 'original'
      ? {path: classPath, sha256: sha256(classPath)}
      : {path: classPath, ...hashClassTree(classPath)},
    exitCode: result.status,
    signal: result.signal,
    stderrTail: String(result.stderr || '').trim().split(/\r?\n/).slice(-30),
  };
}

function gitState(directory) {
  return {
    commit: execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'],
      {encoding: 'utf8'}).trim(),
    trackedDirty: execFileSync('git', [
      '-C', directory, 'status', '--porcelain', '--untracked-files=no',
    ], {encoding: 'utf8'}).trim().length > 0,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  compileProbe();
  const response = await fetch(options.configUrl);
  if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
  const config = await response.json();
  let games = config.games || [];
  if (options.games.length) {
    const selected = new Set(options.games);
    games = games.filter(game => selected.has(game.internalName));
  }
  if (options.excludedGames.length) {
    const excluded = new Set(options.excludedGames);
    games = games.filter(game => !excluded.has(game.internalName));
  }
  const variants = options.variant === 'both'
    ? ['original', 'recompiled'] : [options.variant];
  const results = [];
  for (const game of games) {
    for (const variant of variants) {
      process.stdout.write(`launch ${game.internalName} ${variant}\n`);
      const result = runGame(game, variant, options, config);
      results.push(result);
      process.stdout.write(`${game.internalName} ${variant}: ${result.status} ` +
        `${(result.elapsedMs / 1000).toFixed(3)}s\n`);
      writeReport(options, config, results, false);
      if (result.status !== 'main-menu') process.exitCode = 1;
    }
  }
  writeReport(options, config, results, true);
}

function writeReport(options, config, results, complete) {
  const report = {
    schema: 1,
    createdAt: new Date().toISOString(),
    complete,
    configUrl: options.configUrl,
    configVersion: config.version,
    server: config.server,
    timeoutMs: options.timeoutMs,
    coordinator: {source: __filename, sha256: sha256(__filename)},
    probe: {source: PROBE_SOURCE, sha256: sha256(PROBE_SOURCE)},
    runtime: {
      java: String(spawnSync('java', ['-version'], {encoding: 'utf8'}).stderr || '')
        .trim().split(/\r?\n/)[0],
      platform: process.platform,
      architecture: process.arch,
    },
    repositories: {
      dekoblokoWork: gitState(ROOT),
      javaTools: gitState(path.join(os.homedir(), 'git', 'java-tools')),
    },
    results,
  };
  fs.mkdirSync(path.dirname(options.report), {recursive: true});
  const temporary = `${options.report}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`);
  fs.renameSync(temporary, options.report);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || String(error));
    process.exit(1);
  });
}

module.exports = {parseArgs, selectedRecompiledDirectory};
