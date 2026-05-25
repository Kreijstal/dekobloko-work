#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const CFR_JAR = path.join(DEKOB, 'lib', 'cfr.jar');
const STUBS = path.join(DEKOB, 'lib', 'dekobloko-stubs.jar');

function usage() {
  console.error('Usage: node scripts/cfr-goto-lab.js run <lab-dir> [--keep-work] [--work <dir>]');
}

function main(argv) {
  const cmd = argv[0];
  if (cmd !== 'run') {
    usage();
    process.exit(cmd ? 2 : 0);
  }
  const args = parseArgs(argv.slice(1));
  if (!args.labDir) {
    usage();
    process.exit(2);
  }
  const result = runLab(args);
  printResult(result);
  if (!result.pass) process.exit(1);
}

function parseArgs(argv) {
  const out = { keepWork: false, work: null, labDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--keep-work') out.keepWork = true;
    else if (arg === '--work') out.work = argv[++i];
    else if (arg.startsWith('--work=')) out.work = arg.slice('--work='.length);
    else if (!out.labDir) out.labDir = path.resolve(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function runLab(args) {
  const expectedPath = path.join(args.labDir, 'expected.json');
  if (!fs.existsSync(expectedPath)) throw new Error(`Missing ${expectedPath}`);
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const work = args.work ? path.resolve(args.work) : fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-goto-lab-'));
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const cases = expected.cases || {};
  const results = {};
  try {
    for (const name of Object.keys(cases)) {
      const source = path.join(args.labDir, `${name}.j`);
      if (!fs.existsSync(source)) throw new Error(`Missing lab case ${source}`);
      results[name] = runCase(source, path.join(work, name), cases[name]);
    }
    const pass = Object.values(results).every((entry) => entry.pass);
    return { pass, labDir: args.labDir, work, results };
  } finally {
    if (!args.keepWork) fs.rmSync(work, { recursive: true, force: true });
  }
}

function runCase(source, work, expected) {
  fs.mkdirSync(work, { recursive: true });
  const classFile = path.join(work, `${path.basename(source, '.j')}.class`);
  const assemble = spawnSync(process.execPath, [
    path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js'),
    'assemble',
    source,
    '--out',
    classFile,
  ], { cwd: DEKOB, encoding: 'utf8' });
  if (assemble.status !== 0) {
    return {
      pass: false,
      assembleStatus: assemble.status,
      errors: [`assemble failed: ${(assemble.stderr || assemble.stdout || '').trim()}`],
    };
  }

  const cfrDir = path.join(work, 'cfr');
  fs.mkdirSync(cfrDir, { recursive: true });
  const cfr = spawnSync('java', ['-jar', CFR_JAR, classFile, '--outputdir', cfrDir, '--silent', 'true', '--caseinsensitivefs', 'false'], {
    cwd: DEKOB,
    encoding: 'utf8',
  });
  const cfrLog = `${cfr.stdout || ''}${cfr.stderr || ''}`;
  const javaFiles = fs.readdirSync(cfrDir).filter((name) => name.endsWith('.java')).sort();
  const markers = [];
  for (const file of javaFiles) {
    const lines = fs.readFileSync(path.join(cfrDir, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (/\*\* GOTO|Unable to fully structure code|lbl-1000/.test(line)) {
        markers.push({ file, line: idx + 1, text: line.trim() });
      }
    });
  }

  const javacResults = expected.javac === false ? [] : runJavac(cfrDir, javaFiles, path.dirname(classFile));
  const errors = [];
  checkExpectedMarkers(markers, expected, errors);
  if (expected.cfrStatus === 0 && cfr.status !== 0) errors.push(`CFR exited ${cfr.status}: ${cfrLog.trim()}`);
  if (expected.javac === true && javacResults.some((entry) => entry.status !== 0)) {
    errors.push(`javac failed for ${javacResults.filter((entry) => entry.status !== 0).map((entry) => entry.file).join(', ')}`);
  }
  return {
    pass: errors.length === 0,
    markers,
    markerCount: markers.length,
    cfrStatus: cfr.status,
    javac: javacResults,
    errors,
  };
}

function runJavac(cfrDir, javaFiles, classDir) {
  const out = [];
  for (const file of javaFiles) {
    const javaPath = path.join(cfrDir, file);
    const javacOut = path.join(cfrDir, 'javac', path.basename(file, '.java'));
    fs.mkdirSync(javacOut, { recursive: true });
    const cp = [classDir, STUBS].filter((entry) => fs.existsSync(entry)).join(path.delimiter);
    const args = ['-source', '7', '-target', '7', '-proc:none', '-sourcepath', '', '-d', javacOut];
    if (cp) args.splice(args.length - 2, 0, '-cp', cp);
    const javac = spawnSync('javac', args.concat(javaPath), { cwd: DEKOB, encoding: 'utf8' });
    out.push({ file, status: javac.status, log: `${javac.stdout || ''}${javac.stderr || ''}`.trim().slice(0, 1000) });
  }
  return out;
}

function checkExpectedMarkers(markers, expected, errors) {
  const count = markers.length;
  if (expected.markers != null && count !== Number(expected.markers)) {
    errors.push(`expected exactly ${expected.markers} markers, got ${count}`);
  }
  if (expected.minMarkers != null && count < Number(expected.minMarkers)) {
    errors.push(`expected at least ${expected.minMarkers} markers, got ${count}`);
  }
  if (expected.maxMarkers != null && count > Number(expected.maxMarkers)) {
    errors.push(`expected at most ${expected.maxMarkers} markers, got ${count}`);
  }
  for (const pattern of expected.mustContain || []) {
    const re = new RegExp(pattern);
    if (!markers.some((marker) => re.test(marker.text))) errors.push(`missing marker pattern ${pattern}`);
  }
  for (const pattern of expected.mustNotContain || []) {
    const re = new RegExp(pattern);
    if (markers.some((marker) => re.test(marker.text))) errors.push(`unexpected marker pattern ${pattern}`);
  }
}

function printResult(result) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.labDir}`);
  for (const [name, entry] of Object.entries(result.results)) {
    console.log(`  ${name}: ${entry.pass ? 'PASS' : 'FAIL'} markers=${entry.markerCount == null ? 'n/a' : entry.markerCount}`);
    for (const err of entry.errors || []) console.log(`    ${err}`);
  }
}

main(process.argv.slice(2));
