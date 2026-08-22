#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {hashClassTree} = require('./pipeline-cache-provenance');

const CLASS_DIRECTORY_CANDIDATES = [
  'classes-abi-final',
  'classes-abi-latest',
  'classes-abi-current-next',
  'classes-abi-current',
  'classes-abi',
  'classes',
];

function parseArgs(argv) {
  const options = {gamesRoot: null, reports: [], json: false};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--games-root') {
      options.gamesRoot = path.resolve(argv[++index]);
    } else if (argument === '--json') {
      options.json = true;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown argument: ${argument}`);
    } else {
      options.reports.push(path.resolve(argument));
    }
  }
  if (!options.gamesRoot) throw new Error('Missing --games-root');
  if (!options.reports.length) throw new Error('At least one report is required');
  return options;
}

function selectedClassesDirectory(gamesRoot, game) {
  const owned = path.join(gamesRoot, game, 'decompile-owned');
  for (const candidate of CLASS_DIRECTORY_CANDIDATES) {
    const directory = path.join(owned, candidate);
    if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
      return directory;
    }
  }
  return null;
}

function discoverCurrentTrees(gamesRoot) {
  return fs.readdirSync(gamesRoot, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const directory = selectedClassesDirectory(gamesRoot, entry.name);
      if (!directory) return null;
      return {game: entry.name, directory, ...hashClassTree(directory)};
    })
    .filter(Boolean)
    .sort((left, right) => left.game.localeCompare(right.game));
}

function readEvidence(reportPaths) {
  const evidence = [];
  for (const reportPath of reportPaths) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    for (const result of report.results || []) {
      const classes = result.artifact ||
        result.artifacts && result.artifacts.recompiledClasses;
      if (result.variant !== 'recompiled' || result.status !== 'main-menu' ||
          !classes || !classes.sha256) continue;
      evidence.push({
        game: result.game,
        sha256: classes.sha256,
        report: reportPath,
        elapsedMs: result.elapsedMs,
      });
    }
  }
  return evidence;
}

function auditTrees(trees, evidence) {
  return trees.map(tree => {
    const match = evidence.find(candidate =>
      candidate.game === tree.game && candidate.sha256 === tree.sha256);
    return {...tree, status: match ? 'proven' : 'missing', evidence: match || null};
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const results = auditTrees(
    discoverCurrentTrees(options.gamesRoot),
    readEvidence(options.reports),
  );
  const summary = {
    expected: results.length,
    proven: results.filter(result => result.status === 'proven').length,
    missing: results.filter(result => result.status === 'missing').length,
    results,
  };
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    for (const result of results) {
      process.stdout.write(`${result.status}\t${result.game}\t${result.sha256}` +
        `${result.evidence ? `\t${result.evidence.report}` : ''}\n`);
    }
    process.stdout.write(`summary\t${summary.proven}/${summary.expected} proven` +
      `\t${summary.missing} missing\n`);
  }
  if (summary.missing) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  auditTrees,
  discoverCurrentTrees,
  parseArgs,
  readEvidence,
  selectedClassesDirectory,
};
