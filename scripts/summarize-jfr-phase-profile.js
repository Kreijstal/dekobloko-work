#!/usr/bin/env node
'use strict';

const {execFileSync} = require('child_process');
const path = require('path');

function readEvents(profile, filters) {
  const output = execFileSync('jfr', [
    'print', '--json', '--events', filters, profile,
  ], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  return JSON.parse(output).recording.events || [];
}

function methodKey(frame) {
  const method = frame?.method;
  const className = method?.type?.name || '(native/unmapped)';
  return `${className}.${method?.name || '(unknown)'}${method?.descriptor || ''}`;
}

function category(frame) {
  const name = frame?.method?.type?.name || '';
  if (!name) return 'native/unmapped';
  if (name === 'ReflectionMainMenuProbe' ||
      name.startsWith('ReflectionMainMenuProbe$')) return 'probe';
  if (/^(?:java|javax|jdk|sun)\//.test(name)) return 'JRE library/runtime';
  return 'guest Java';
}

function ranked(counter, sampleCount, limit = 20) {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, samples]) => ({
      key,
      samples,
      percent: sampleCount ? samples * 100 / sampleCount : 0,
    }));
}

function summarize(profile, startPhase = 'logo-complete',
    endPhase = 'menu-surface') {
  const events = readEvents(profile,
    'jdk.ExecutionSample,jvmjs.NativeMainMenuPhase');
  const boundaries = events.filter(event =>
    event.type === 'jvmjs.NativeMainMenuPhase');
  const start = boundaries.find(event => event.values.phase === startPhase);
  const end = boundaries.find(event => event.values.phase === endPhase);
  if (!start || !end) {
    throw new Error(`Missing ${!start ? startPhase : endPhase} boundary`);
  }
  const startTime = Date.parse(start.values.startTime);
  const endTime = Date.parse(end.values.startTime);
  const samples = events.filter(event => event.type === 'jdk.ExecutionSample' &&
    Date.parse(event.values.startTime) >= startTime &&
    Date.parse(event.values.startTime) <= endTime);
  const self = new Map();
  const inclusive = new Map();
  const categories = new Map();
  const threads = new Map();
  for (const event of samples) {
    const frames = event.values.stackTrace?.frames || [];
    const top = frames[0];
    const key = methodKey(top);
    self.set(key, (self.get(key) || 0) + 1);
    const categoryKey = category(top);
    categories.set(categoryKey, (categories.get(categoryKey) || 0) + 1);
    const thread = event.values.sampledThread?.javaName || '(unknown)';
    threads.set(thread, (threads.get(thread) || 0) + 1);
    for (const inclusiveKey of new Set(frames.map(methodKey))) {
      inclusive.set(inclusiveKey, (inclusive.get(inclusiveKey) || 0) + 1);
    }
  }
  return {
    profile: path.resolve(profile),
    phase: {
      start: startPhase,
      end: endPhase,
      elapsedMs: end.values.elapsedMillis - start.values.elapsedMillis,
    },
    executionSamples: samples.length,
    categories: ranked(categories, samples.length),
    threads: ranked(threads, samples.length),
    topSelf: ranked(self, samples.length),
    topInclusive: ranked(inclusive, samples.length),
  };
}

if (require.main === module) {
  const [profile, startPhase, endPhase] = process.argv.slice(2);
  if (!profile) {
    console.error('Usage: summarize-jfr-phase-profile.js profile.jfr ' +
      '[start-phase] [end-phase]');
    process.exit(2);
  }
  console.log(JSON.stringify(summarize(profile, startPhase, endPhase), null, 2));
}

module.exports = {category, methodKey, ranked, summarize};
