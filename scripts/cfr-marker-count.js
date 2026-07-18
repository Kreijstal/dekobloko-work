#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const CFR_JAR = path.join(DEKOB, 'lib', 'cfr.jar');
const MARKER_RE = /\*\* GOTO|Unable to fully structure code|lbl-1000|\*\* while/g;
const BAD_RE = /Exception decompiling|Invisible function parameters|uninitialised local|uninitialized local|if \(true\) \*\* GOTO|if \([0-9]+ == [0-9]+\) \*\* GOTO/;

if (process.argv.length !== 3) {
  console.error('usage: node scripts/cfr-marker-count.js CASE.j|CASE.class');
  process.exit(2);
}

const input = path.resolve(process.argv[2]);
const work = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'cfr-marker-count-'));
try {
  const className = path.basename(input, path.extname(input));
  const classFile = path.join(work, `${className}.class`);
  if (input.endsWith('.class')) {
    fs.copyFileSync(input, classFile);
  } else {
    const assemble = spawnSync(process.execPath, [
      path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js'),
      'assemble',
      input,
      '--out',
      classFile,
    ], { cwd: DEKOB, encoding: 'utf8' });
    if (assemble.status !== 0) {
      console.error((assemble.stderr || assemble.stdout || '').trim());
      process.exit(1);
    }
  }

  const cfrDir = path.join(work, 'cfr');
  fs.mkdirSync(cfrDir, { recursive: true });
  // CFR can blow up on pathological control flow; a candidate that CFR cannot
  // decompile inside the budget counts as bad instead of hanging the caller.
  const timeoutMs = Number(process.env.CFR_MARKER_COUNT_TIMEOUT_SECONDS || 180) * 1000;
  const cfr = spawnSync('java', ['-jar', CFR_JAR, classFile, '--outputdir', cfrDir, '--silent', 'true', '--caseinsensitivefs', 'false'], {
    cwd: DEKOB,
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    // CFR can spew megabytes of warnings on pathological classes; the default
    // 1MB maxBuffer turns that into ENOBUFS, which reads as a bad candidate.
    maxBuffer: 64 * 1024 * 1024,
  });
  const timedOut = !!(cfr.error && cfr.error.code === 'ETIMEDOUT');
  let markers = 0;
  const javaFiles = fs.readdirSync(cfrDir).filter((name) => name.endsWith('.java'));
  let bad = timedOut || cfr.status !== 0 || javaFiles.length === 0 || BAD_RE.test(`${cfr.stdout || ''}\n${cfr.stderr || ''}`);
  for (const file of javaFiles) {
    const text = fs.readFileSync(path.join(cfrDir, file), 'utf8');
    markers += (text.match(MARKER_RE) || []).length;
    bad = bad || BAD_RE.test(text);
  }
  console.log(JSON.stringify({ markers, bad }));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
