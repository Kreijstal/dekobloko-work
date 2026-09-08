#!/usr/bin/env node
'use strict';

// Print the configuration this checkout would actually use.
//
//   node scripts/print-effective-config.js            human-readable
//   node scripts/print-effective-config.js --json     machine-readable
//   node scripts/print-effective-config.js --group game-serving
//   node scripts/print-effective-config.js --divergences
//
// Use --json to attach an effective-configuration record to a run result.
// Answering "what did this run actually use?" should never require reading
// six scripts to reconstruct an env-var precedence chain by hand.

const path = require('path');
const config = require('./lib/effective-config');
const {describeJavaTools, STRATEGY_NAMES} = require('./lib/java-tools');

function javaToolsResolutions(env) {
  return STRATEGY_NAMES.map((strategy) => {
    const description = describeJavaTools({strategy, env});
    return {
      strategy,
      source: description.source,
      dir: description.dir,
      usesAuthorFallback: description.usesAuthorFallback,
    };
  });
}

function main(argv) {
  const asJson = argv.includes('--json');
  const onlyDivergences = argv.includes('--divergences');
  const groupIndex = argv.indexOf('--group');
  const group = groupIndex >= 0 ? argv[groupIndex + 1] : null;
  if (groupIndex >= 0 && !config.GROUPS.includes(group)) {
    console.error(
      `unknown group ${JSON.stringify(group)}; known groups: ` +
      config.GROUPS.join(', '));
    return 2;
  }

  const snapshot = config.snapshot();
  snapshot.javaToolsResolutions = javaToolsResolutions(process.env);

  if (asJson) {
    process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
    return 0;
  }

  const entries = config.REGISTRY
    .filter((entry) => !group || entry.group === group)
    .filter((entry) => !onlyDivergences || entry.divergent);

  console.log(`repository   ${snapshot.repoRoot}`);
  console.log(`cwd          ${snapshot.cwd}`);
  console.log(`node         ${snapshot.node} (${snapshot.platform})`);
  console.log('');
  console.log('java-tools resolution, per discovery strategy:');
  for (const resolution of snapshot.javaToolsResolutions) {
    const flag = resolution.usesAuthorFallback ? '  [AUTHOR FALLBACK]' : '';
    console.log(`  ${resolution.strategy.padEnd(28)} ` +
      `${String(resolution.source || '(unresolved)').padEnd(18)} ` +
      `${resolution.dir || '(none)'}${flag}`);
  }
  console.log('');

  let currentGroup = null;
  for (const entry of entries) {
    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      console.log(`[${currentGroup}]`);
    }
    const isSet = Object.prototype.hasOwnProperty.call(snapshot.set, entry.name);
    const value = isSet
      ? (snapshot.set[entry.name] === ''
        ? '(set, empty)'
        : snapshot.set[entry.name])
      : '(unset)';
    console.log(`  ${entry.name}`);
    console.log(`      effective : ${value}`);
    if (!isSet) console.log(`      default   : ${entry.defaultText}`);
    console.log(`      ${entry.summary}`);
    if (entry.divergent) console.log(`      DIVERGENT : ${entry.note}`);
    for (const consumer of config.locateConsumers(entry)) {
      const where = !consumer.exists
        ? 'FILE MISSING'
        : (consumer.stale
          ? 'STALE: file no longer reads it'
          : consumer.lines.join(', '));
      console.log(`      read by   : ${consumer.file}:${where}`);
    }
  }

  const gateNames = Object.keys(snapshot.runtimeGates || {});
  console.log('');
  console.log(
    `java-tools runtime gates set in this environment: ` +
    (gateNames.length ? gateNames.join(', ') : '(none)'));
  console.log(
    'Those are owned by java-tools. They are recorded with results because ' +
    'they change them, but they are not documented here.');
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {main, javaToolsResolutions};
