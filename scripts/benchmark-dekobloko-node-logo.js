#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = process.env.JAVA_TOOLS_DIR ||
  path.join(os.homedir(), 'git', 'java-tools');

function parseArgs(argv) {
  const options = {
    classes: path.join(
      ROOT, '.work', 'jvmjs', 'hybrid-all-recompiled-lean-carriers', 'classes'),
    generatedFromJar: path.join(ROOT, 'dekobloko.jar'),
    output: null,
    timeoutMs: 180000,
    minimumWarmFps: 0,
    cpuProfile: false,
    frameLimit: 36,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--classes') options.classes = path.resolve(argv[++index]);
    else if (argument === '--generated-from-jar') {
      options.generatedFromJar = path.resolve(argv[++index]);
    } else if (argument === '--output') options.output = path.resolve(argv[++index]);
    else if (argument === '--timeout-ms') options.timeoutMs = Number(argv[++index]);
    else if (argument === '--minimum-warm-fps') {
      options.minimumWarmFps = Number(argv[++index]);
    } else if (argument === '--cpu-prof') options.cpuProfile = true;
    else if (argument === '--frame-limit') options.frameLimit = Number(argv[++index]);
    else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/benchmark-dekobloko-node-logo.js ' +
        '[--classes DIR] [--generated-from-jar JAR] [--output DIR] ' +
        '[--timeout-ms N] [--minimum-warm-fps N] [--frame-limit N] [--cpu-prof]\n');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be positive');
  }
  if (!Number.isFinite(options.minimumWarmFps) || options.minimumWarmFps < 0) {
    throw new Error('--minimum-warm-fps must be zero or positive');
  }
  if (!Number.isInteger(options.frameLimit) || options.frameLimit < 4) {
    throw new Error('--frame-limit must be an integer of at least 4');
  }
  return options;
}

function runGit(directory, args) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function sha(algorithm, value) {
  return crypto.createHash(algorithm).update(value).digest('hex');
}

function hashFile(file, algorithm) {
  const digest = crypto.createHash(algorithm);
  digest.update(fs.readFileSync(file));
  return digest.digest('hex');
}

function sortedFiles(directory) {
  const result = [];
  const visit = (relative) => {
    const absolute = path.join(directory, relative);
    for (const name of fs.readdirSync(absolute).sort()) {
      const childRelative = path.join(relative, name);
      const child = path.join(directory, childRelative);
      const stat = fs.lstatSync(child);
      if (stat.isDirectory()) visit(childRelative);
      else if (stat.isFile()) result.push(childRelative);
    }
  };
  visit('');
  return result;
}

function hashTree(directory) {
  const digest = crypto.createHash('sha256');
  const files = sortedFiles(directory);
  for (const relative of files) {
    digest.update(relative.split(path.sep).join('/'));
    digest.update('\0');
    digest.update(fs.readFileSync(path.join(directory, relative)));
    digest.update('\0');
  }
  return { sha256: digest.digest('hex'), files: files.length };
}

function gitMetadata(directory, output, label) {
  const status = runGit(directory, ['status', '--porcelain']).split(/\r?\n/).filter(Boolean);
  const trackedStatus = runGit(
    directory, ['status', '--porcelain', '--untracked-files=no']);
  const trackedDiff = execFileSync(
    'git', ['-C', directory, 'diff', '--binary', 'HEAD']);
  const patchFile = path.join(output, `${label}-tracked.patch`);
  fs.writeFileSync(patchFile, trackedDiff);
  return {
    path: directory,
    commitSha1: runGit(directory, ['rev-parse', 'HEAD']),
    treeSha1: runGit(directory, ['rev-parse', 'HEAD^{tree}']),
    trackedDirty: Boolean(trackedStatus),
    anyDirty: status.length > 0,
    trackedDiffSha1: sha('sha1', trackedDiff),
    trackedPatch: {
      path: patchFile,
      bytes: trackedDiff.length,
      sha256: sha('sha256', trackedDiff),
    },
    untrackedPaths: status
      .filter((line) => line.startsWith('??'))
      .map((line) => line.slice(3)),
  };
}

function decodeFrame(file) {
  const { decodePng } = require(path.join(JAVA_TOOLS_DIR, 'src', 'io', 'gifDecoder'));
  const decoded = decodePng(fs.readFileSync(file));
  let nonBlackPixels = 0;
  for (const pixel of decoded.pixels) {
    const value = pixel >>> 0;
    const red = (value >>> 16) & 255;
    const green = (value >>> 8) & 255;
    const blue = value & 255;
    if (red + green + blue > 24) nonBlackPixels += 1;
  }
  return { width: decoded.width, height: decoded.height, nonBlackPixels };
}

function rate(first, last) {
  const seconds = (last.mtimeMs - first.mtimeMs) / 1000;
  return {
    firstFrame: first.frame,
    lastFrame: last.frame,
    frameIntervals: last.frame - first.frame,
    seconds,
    fps: seconds > 0 ? (last.frame - first.frame) / seconds : 0,
  };
}

function readFrames(directory) {
  return fs.readdirSync(directory)
    .map((name) => {
      const match = /^frame-(\d+)\.png$/.exec(name);
      if (!match) return null;
      const file = path.join(directory, name);
      const pixels = decodeFrame(file);
      return {
        frame: Number(match[1]),
        file,
        mtimeMs: fs.statSync(file).mtimeMs,
        sha256: hashFile(file, 'sha256'),
        ...pixels,
        // The login panel covers roughly 68k non-black pixels; every sampled
        // Jagex-logo frame in the verified 640x480 sequence remains below 16k.
        phase: pixels.nonBlackPixels > 50000 ? 'login' : 'jagex-logo',
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.frame - right.frame);
}

function extractJsonLine(stderr, prefix) {
  const line = stderr.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
  return line ? JSON.parse(line.slice(prefix.length)) : null;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.classes) || !fs.statSync(options.classes).isDirectory()) {
    throw new Error(`Generated class directory not found: ${options.classes}`);
  }
  if (!fs.existsSync(options.generatedFromJar) ||
      !fs.statSync(options.generatedFromJar).isFile()) {
    throw new Error(`Generating source JAR not found: ${options.generatedFromJar}`);
  }
  if (!fs.existsSync(JAVA_TOOLS_DIR)) {
    throw new Error(`java-tools not found: ${JAVA_TOOLS_DIR}`);
  }

  const output = options.output ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'dekobloko-node-logo-benchmark.'));
  const framesDirectory = path.join(output, 'frames');
  fs.mkdirSync(framesDirectory, { recursive: true });

  const environment = {
    ...process.env,
    JAVA_TOOLS_DIR,
    JVM_BENCHMARK_METADATA: '1',
    JVM_FAKE_TIME: '1000000000000',
    JVM_FAKE_TIME_REALTIME: '1',
    JVM_WASM_JIT: '1',
    JVM_WASM_STRUCTURED: '1',
    JVM_ENABLE_RENDERER_PIPELINE: '1',
    JVM_FRAME_DIR: framesDirectory,
    JVM_FRAME_EVERY: '10',
    JVM_FRAME_LIMIT: String(options.frameLimit),
    JVM_EXIT_AFTER_FRAME_LIMIT: '1',
  };
  const command = [];
  if (options.cpuProfile) {
    command.push(
      '--cpu-prof', `--cpu-prof-dir=${output}`, '--cpu-prof-name=logo.cpuprofile');
  }
  command.push(
    path.join(ROOT, 'scripts', 'run-jvmjs.js'),
    options.classes,
    'gameport1=43595',
    'gameport2=43595',
  );
  const startedAt = new Date().toISOString();
  const child = spawnSync(process.execPath, command, {
    cwd: ROOT,
    env: environment,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(output, 'stdout.log'), child.stdout || '');
  fs.writeFileSync(path.join(output, 'stderr.log'), child.stderr || '');

  const frames = readFrames(framesDirectory);
  const firstLoginIndex = frames.findIndex((frame) => frame.phase === 'login');
  const logoFrames = firstLoginIndex < 0 ? frames : frames.slice(0, firstLoginIndex);
  if (logoFrames.length < 3) {
    throw new Error(`Insufficient Jagex-logo samples: ${logoFrames.length}`);
  }
  if (firstLoginIndex < 0) {
    throw new Error(
      `Capture ended at frame ${frames.at(-1)?.frame ?? 'unknown'} before the ` +
      'first login surface; increase --frame-limit');
  }
  const warmFirst = logoFrames.find((frame) => frame.frame >= 20) || logoFrames[0];
  const logoLast = logoFrames[logoFrames.length - 1];
  const fullRate = rate(logoFrames[0], logoLast);
  const warmRate = rate(warmFirst, logoLast);
  const jvmEnvironment = Object.fromEntries(
    Object.entries(environment)
      .filter(([name]) => name.startsWith('JVM_'))
      .sort(([left], [right]) => left.localeCompare(right)));
  const result = {
    schema: 1,
    benchmark: 'dekobloko-node-jagex-logo',
    startedAt,
    finishedAt: new Date().toISOString(),
    outcome: {
      exitCode: child.status,
      signal: child.signal,
      timedOut: Boolean(child.error && child.error.code === 'ETIMEDOUT'),
      runtimeErrors: `${child.stdout || ''}\n${child.stderr || ''}`
        .split(/\r?\n/)
        .filter((line) => !line.startsWith('[jvm-benchmark-'))
        .filter((line) =>
          /unhandled exception|startup failed|failed to run|run failed|runtime error/i
            .test(line)),
    },
    measurement: {
      phaseRule: '640x480 sampled surface has <=50000 non-black pixels',
      sampleStride: 10,
      fullLogo: fullRate,
      warmLogo: warmRate,
      firstLoginFrame: firstLoginIndex < 0 ? null : frames[firstLoginIndex].frame,
      frames: frames.map((frame) => ({
        frame: frame.frame,
        mtimeMs: frame.mtimeMs,
        sha256: frame.sha256,
        nonBlackPixels: frame.nonBlackPixels,
        phase: frame.phase,
      })),
    },
    provenance: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      javaTools: gitMetadata(JAVA_TOOLS_DIR, output, 'java-tools'),
      dekoblokoWork: gitMetadata(ROOT, output, 'dekobloko-work'),
      generatedFromJar: {
        path: options.generatedFromJar,
        declaration: 'declared input used to generate the measured class directory',
        sha1: hashFile(options.generatedFromJar, 'sha1'),
        sha256: hashFile(options.generatedFromJar, 'sha256'),
      },
      generatedClasses: {
        path: options.classes,
        ...hashTree(options.classes),
      },
      command: [process.execPath, ...command],
      environment: jvmEnvironment,
      resolvedGates: extractJsonLine(child.stderr || '', '[jvm-benchmark-gates] '),
      runtimeCounters: extractJsonLine(
        child.stderr || '', '[jvm-benchmark-counters] '),
      scripts: {
        benchmark: {
          path: __filename,
          sha256: hashFile(__filename, 'sha256'),
        },
        runner: {
          path: path.join(ROOT, 'scripts', 'run-jvmjs.js'),
          sha256: hashFile(path.join(ROOT, 'scripts', 'run-jvmjs.js'), 'sha256'),
        },
      },
    },
    artifacts: { directory: output },
  };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (child.error || child.status !== 0 || result.outcome.runtimeErrors.length) {
    process.exitCode = 1;
  } else if (options.minimumWarmFps > 0 &&
      warmRate.fps < options.minimumWarmFps) {
    process.exitCode = 4;
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
}
