#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');

const cases = [
  {
    name: 'terminal-helper fallback',
    input: 'tools/cfr-goto-labs/oracle-20-sample/accepted/02-aceofskies-fg/input.j',
    expectedAction: 'candidate',
    expectedProfile: 'default',
    expectedBaseline: 15,
    expectedCandidate: 7,
    expectedCandidateCount: 2,
  },
  {
    name: 'terminal-tail fallback',
    input: 'tools/cfr-goto-labs/oracle-20-sample/accepted/20-brickabrac-nh/input.j',
    expectedAction: 'candidate',
    expectedProfile: 'no-terminal-tail-clone',
    expectedBaseline: 17,
    expectedCandidate: 7,
    expectedCandidateCount: 3,
  },
  {
    name: 'default-only acceptance',
    input: 'tools/cfr-goto-labs/real-se-a-bytearray/reduced9.j',
    expectedAction: 'candidate',
    expectedProfile: 'default',
    expectedBaseline: 2,
    expectedCandidate: 0,
    expectedCandidateCount: 2,
  },
  {
    name: 'default-only rejection',
    input: 'tools/cfr-goto-labs/real-se-a-bytearray/reduced7.j',
    expectedAction: 'baseline',
    expectedProfile: null,
    expectedBaseline: 6,
    expectedCandidate: 6,
    expectedCandidateCount: 2,
  },
];

for (const testCase of cases) {
  const stem = testCase.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const result = spawnSync(process.execPath, [
    path.join(DEKOB, 'scripts', 'cfr-oracle-select-transform.js'),
    path.join(DEKOB, testCase.input),
    path.join(DEKOB, '.work', 'oracle-policy-selftest', `${stem}.class`),
  ], {
    cwd: DEKOB,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout.trim().split(/\n/).at(-1));
  assert.equal(payload.action, testCase.expectedAction, testCase.name);
  assert.equal(payload.candidateName, testCase.expectedProfile, testCase.name);
  assert.equal(payload.baseline.markers, testCase.expectedBaseline, testCase.name);
  assert.equal(payload.candidate.markers, testCase.expectedCandidate, testCase.name);
  assert.equal(payload.candidates.length, testCase.expectedCandidateCount, testCase.name);
}

console.log('PASS cfr-oracle-policy selftest');
