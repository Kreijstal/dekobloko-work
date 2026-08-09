#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

function classFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.class')) {
        files.push(path.relative(root, absolute).split(path.sep).join('/'));
      }
    }
  };
  visit(root);
  return files.sort();
}

function hashClassTree(root) {
  const hash = crypto.createHash('sha256');
  const files = classFiles(root);
  for (const relative of files) {
    const bytes = fs.readFileSync(path.join(root, ...relative.split('/')));
    hash.update(String(Buffer.byteLength(relative)));
    hash.update(':');
    hash.update(relative);
    hash.update(String(bytes.length));
    hash.update(':');
    hash.update(bytes);
  }
  return {files: files.length, sha256: hash.digest('hex')};
}

function gitSnapshot(directory) {
  const commit = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', [
    '-C', directory, 'status', '--porcelain', '--untracked-files=no',
  ], {encoding: 'utf8'}).trim();
  return {commit, trackedClean: status.length === 0};
}

function selectedEnvironment(environment = process.env) {
  const selected = {};
  for (const key of Object.keys(environment).sort()) {
    if (key.startsWith('PIPELINE_') || key.startsWith('BULK_PIPELINE_') ||
        key === 'SKIP_PIPELINE_PASSES') {
      selected[key] = String(environment[key]);
    }
  }
  return selected;
}

function fingerprintSnapshot(snapshot) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex');
}

function buildSnapshot(options, environment = process.env) {
  return {
    formatVersion: 1,
    generators: {
      dekoblokoWork: gitSnapshot(options.repo),
      javaTools: gitSnapshot(options.javaTools),
    },
    inputClasses: hashClassTree(options.input),
    pipeline: {
      arguments: ['--profile', 'none', '--safe-bytecode'],
      skipPasses: options.skipPasses,
      environment: selectedEnvironment(environment),
    },
  };
}

function writeStamp(file, snapshot) {
  const stamp = {
    formatVersion: 1,
    fingerprint: fingerprintSnapshot(snapshot),
    snapshot,
  };
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(stamp, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function stampMatches(file, snapshot) {
  if (!snapshot.generators.dekoblokoWork.trackedClean ||
      !snapshot.generators.javaTools.trackedClean) return false;
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return false;
  }
  return stamp && stamp.formatVersion === 1 &&
    stamp.fingerprint === fingerprintSnapshot(snapshot);
}

function parseArgs(argv) {
  const options = {command: null, stamp: null, skipPasses: ''};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === 'check' || arg === 'write') && !options.command) {
      options.command = arg;
      options.stamp = path.resolve(argv[++index]);
    } else if (arg === '--repo') options.repo = path.resolve(argv[++index]);
    else if (arg === '--java-tools') {
      options.javaTools = path.resolve(argv[++index]);
    } else if (arg === '--input') options.input = path.resolve(argv[++index]);
    else if (arg === '--skip-passes') options.skipPasses = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  for (const key of ['command', 'stamp', 'repo', 'javaTools', 'input']) {
    if (!options[key]) throw new Error(`Missing ${key}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = buildSnapshot(options);
  if (options.command === 'write') {
    writeStamp(options.stamp, snapshot);
    return;
  }
  if (!stampMatches(options.stamp, snapshot)) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  buildSnapshot,
  fingerprintSnapshot,
  hashClassTree,
  selectedEnvironment,
  stampMatches,
  writeStamp,
};
