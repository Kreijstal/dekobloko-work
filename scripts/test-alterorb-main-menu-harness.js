#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  classifyMenuSurface,
  effectiveRuntimeGates,
  enqueueSyntheticMouseClick,
  hasMenuAdvanceSettled,
  parseArgs,
  sceneDifference,
  shouldResetMenuCandidateOnSceneTransition,
} = require('./launch-alterorb-games-jvmjs');

assert.deepStrictEqual(
  classifyMenuSurface({nonblankSamples: 2860, uniqueSampleColors: 42}, 40),
  {dense: false, sparse: false, advanceable: true},
  'a dense low-palette intro is advanceable but is not a menu',
);
assert.deepStrictEqual(
  classifyMenuSurface({nonblankSamples: 887, uniqueSampleColors: 56}, 34),
  {dense: false, sparse: true, advanceable: false},
  'a sparse animated menu remains accepted',
);
assert.deepStrictEqual(
  classifyMenuSurface({nonblankSamples: 4054, uniqueSampleColors: 687}, 36),
  {dense: true, sparse: false, advanceable: true},
  'a full-color menu is accepted',
);
assert.deepStrictEqual(
  classifyMenuSurface({nonblankSamples: 473, uniqueSampleColors: 120}, 30),
  {dense: false, sparse: false, advanceable: false},
  'the Jagex progress panel is not a menu',
);

const listener = {type: 'example/MouseListener'};
const component = {
  type: 'example/Canvas',
  _visible: true,
  _listeners: {mouse: [listener]},
};
const queued = [];
const jvm = {
  _awtInputComponents: new Map([['mouse', new Set([component])]]),
  enqueueAwtEventInvocation(...args) { queued.push(args); },
};
assert.strictEqual(enqueueSyntheticMouseClick(jvm, 580, 400), 3,
  'one listener receives press, release, and click callbacks');
assert.deepStrictEqual(queued.map(entry => entry[1]),
  ['mousePressed', 'mouseReleased', 'mouseClicked']);
assert.deepStrictEqual(queued.map(entry => entry[3].id), [501, 502, 500]);
assert.ok(queued.every(entry => entry[3].x === 580 && entry[3].y === 400));

const options = parseArgs(['--menu-advance-click', '580,400']);
assert.deepStrictEqual(options.menuAdvanceClick, {x: 580, y: 400});
assert.strictEqual(options.until, 'main-menu');
const sceneOptions = parseArgs(['--menu-scene-transitions', '2']);
assert.strictEqual(sceneOptions.menuSceneTransitions, 2);
assert.strictEqual(sceneOptions.until, 'main-menu');

assert.strictEqual(hasMenuAdvanceSettled(null, null, 3), true,
  'manual runs do not need an automated-advance settling window');
assert.strictEqual(hasMenuAdvanceSettled(1000, 20, 24), false,
  'four post-advance surfaces are still a transition');
assert.strictEqual(hasMenuAdvanceSettled(1000, 20, 25), true,
  'five post-advance surfaces settle the guest transition');
assert.strictEqual(sceneDifference([0x111, 0x222], [0x111, 0x222]), 0);
assert.strictEqual(sceneDifference([0x111, 0x222], [0x333, 0x222]), 0.5);
assert.strictEqual(
  shouldResetMenuCandidateOnSceneTransition(0, 0), false,
  'a disabled transition gate does not reset an animated menu candidate');
assert.strictEqual(
  shouldResetMenuCandidateOnSceneTransition(0, 1), true,
  'the transition satisfying a requested gate starts fresh settling');
assert.strictEqual(
  shouldResetMenuCandidateOnSceneTransition(1, 1), false,
  'later menu animation does not restart settling after the gate is met');

assert.deepStrictEqual(effectiveRuntimeGates({noJit: false, profileJit: true}, {
  JVM_WASM_JIT: '0',
  JVM_PROFILE_SCHEDULER_TIMES: '32',
}), {
  jitEnabled: true,
  JVM_WASM_JIT: '0',
  JVM_WASM_STRUCTURED: '1',
  JVM_ENABLE_RENDERER_PIPELINE: '1',
  JVM_FAKE_TIME: '1000000000000',
  JVM_FAKE_TIME_REALTIME: '1',
  JVM_PROFILE_SCHEDULER_TIMES: '32',
  JVM_DEBUG_ARRAY_OOB: '1',
  ALTERORB_JVMJS_TCP_PORT: '43594',
  ALTERORB_JVMJS_HTTP_PROXY_PORT: '18080',
});

console.log('alterorb main-menu harness tests passed');
