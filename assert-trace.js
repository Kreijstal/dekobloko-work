#!/usr/bin/env node
'use strict';

const fs = require('fs');

const traceFile = process.argv[2] || 'traces/headless-init.log';
const text = fs.readFileSync(traceFile, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);

function requireLine(pattern, description) {
  if (!lines.some((line) => pattern.test(line))) {
    console.error(`Missing trace event: ${description}`);
    process.exit(1);
  }
}

function requireOrder(patterns) {
  let cursor = 0;
  for (const [pattern, description] of patterns) {
    const index = lines.findIndex((line, i) => i >= cursor && pattern.test(line));
    if (index < 0) {
      console.error(`Missing ordered trace event: ${description}`);
      process.exit(1);
    }
    cursor = index + 1;
  }
}

requireOrder([
  [/^launcher\.start /, 'launcher.start'],
  [/^launcher\.loadClass client$/, 'load client class'],
  [/^launcher\.newApplet client$/, 'construct applet'],
  [/^applet\.setStub$/, 'set stub'],
  [/^stub\.appletResize 765x503$/, 'initial resize'],
  [/^applet\.setSize 765x503$/, 'set applet size'],
  [/^stub\.getCodeBase https:\/\/mgg-server\.alterorb\.net\/$/, 'code base'],
  [/^stub\.getParameter gamecrc=2147312574$/, 'gamecrc parameter'],
  [/^hook\.cacheRedirect subDirectory=null file=random\.dat$/, 'random cache redirect'],
  [/^hook\.cacheRedirect subDirectory=dekobloko file=main_file_cache\.dat2$/, 'dat2 cache redirect'],
  [/^hook\.cacheRedirect subDirectory=dekobloko file=main_file_cache\.idx0$/, 'idx0 cache redirect'],
  [/^applet\.init\.return$/, 'init returned'],
  [/^applet\.start\.return$/, 'start returned'],
  [/^applet\.stop\.return$/, 'stop returned'],
]);

requireLine(/^stub\.getParameter instanceid=-?\d+$/, 'instanceid parameter');
requireLine(/^stub\.getParameter member=no$/, 'member parameter');
requireLine(/^hook\.cacheRedirect subDirectory=dekobloko file=main_file_cache\.idx31$/, 'idx31 cache redirect');

console.log(`Trace OK: ${traceFile}`);
