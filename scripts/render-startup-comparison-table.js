#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const options = {jreReports: [], jvmjsReports: []};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--jre-report') {
      options.jreReports.push(path.resolve(argv[++index]));
    } else if (argument === '--jvmjs-report') {
      options.jvmjsReports.push(path.resolve(argv[++index]));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.jreReports.length) throw new Error('Missing --jre-report');
  if (!options.jvmjsReports.length) throw new Error('Missing --jvmjs-report');
  return options;
}

function readReports(paths) {
  return paths.map(file => ({file, value: JSON.parse(fs.readFileSync(file, 'utf8'))}));
}

function uniqueResult(map, key, result, source) {
  const existing = map.get(key);
  if (existing) {
    throw new Error(`Duplicate result for ${key}: ${existing.source}, ${source}`);
  }
  map.set(key, {...result, source});
}

function buildRows(jreReports, jvmjsReports) {
  const jre = new Map();
  for (const report of jreReports) {
    for (const result of report.value.results || []) {
      if (result.status !== 'main-menu') continue;
      uniqueResult(jre, `${result.game}:${result.variant}`, result, report.file);
    }
  }
  const jvmjs = new Map();
  for (const report of jvmjsReports) {
    for (const result of report.value.results || []) {
      if (result.status !== 'main-menu' || result.variant !== 'recompiled') continue;
      uniqueResult(jvmjs, result.game, {
        ...result,
        jobs: report.value.jobs,
        menuSceneTransitions: report.value.menuSceneTransitions,
      }, report.file);
    }
  }
  const games = [...new Set([...jre.keys()].map(key => key.split(':')[0]))].sort();
  return games.map(game => {
    const original = jre.get(`${game}:original`);
    const recompiled = jre.get(`${game}:recompiled`);
    const javascript = jvmjs.get(game);
    if (!original || !recompiled || !javascript) {
      throw new Error(`Incomplete comparison for ${game}: original=${Boolean(original)} ` +
        `recompiled=${Boolean(recompiled)} jvmjs=${Boolean(javascript)}`);
    }
    return {
      game,
      name: original.name || recompiled.name || javascript.name || game,
      jreOriginalMs: original.elapsedMs,
      jreRecompiledMs: recompiled.elapsedMs,
      jreDeltaPercent: (recompiled.elapsedMs / original.elapsedMs - 1) * 100,
      jvmjsRecompiledMs: javascript.elapsedMs,
      jvmjsToJreRatio: javascript.elapsedMs / recompiled.elapsedMs,
      jvmjsJobs: javascript.jobs,
      jvmjsMenuSceneTransitions: javascript.menuSceneTransitions,
    };
  });
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] :
    (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatSeconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(3)} s`;
}

function render(rows) {
  const lines = [
    '| Game | JRE original | JRE recompiled | JRE change | JVM.js recompiled | JVM.js / JRE | JVM.js run |',
    '| --- | ---: | ---: | ---: | ---: | ---: | :---: |',
  ];
  for (const row of rows) {
    const sign = row.jreDeltaPercent >= 0 ? '+' : '';
    lines.push(`| ${row.name} | ${formatSeconds(row.jreOriginalMs)} | ` +
      `${formatSeconds(row.jreRecompiledMs)} | ${sign}${row.jreDeltaPercent.toFixed(1)}% | ` +
      `${formatSeconds(row.jvmjsRecompiledMs)} | ${row.jvmjsToJreRatio.toFixed(1)}× | ` +
      `${row.jvmjsJobs === 1 ? 'serial' : `${row.jvmjsJobs}-way`} |`);
  }
  const summary = {
    games: rows.length,
    medianJreOriginalMs: median(rows.map(row => row.jreOriginalMs)),
    medianJreRecompiledMs: median(rows.map(row => row.jreRecompiledMs)),
    medianJreDeltaPercent: median(rows.map(row => row.jreDeltaPercent)),
    medianJvmjsRecompiledMs: median(rows.map(row => row.jvmjsRecompiledMs)),
    medianJvmjsToJreRatio: median(rows.map(row => row.jvmjsToJreRatio)),
  };
  return {markdown: `${lines.join('\n')}\n`, summary};
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = buildRows(readReports(options.jreReports),
    readReports(options.jvmjsReports));
  const rendered = render(rows);
  process.stdout.write(rendered.markdown);
  process.stderr.write(`${JSON.stringify(rendered.summary)}\n`);
}

if (require.main === module) main();

module.exports = {buildRows, formatSeconds, median, parseArgs, render};
