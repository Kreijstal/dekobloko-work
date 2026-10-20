import test from 'node:test';
import assert from 'node:assert/strict';
import {configureApplet, createGameLauncher, sourcePatchAbi} from '../apps/launcher/browser-loader/loader.mjs';
import {introPreparationPolicy} from '../apps/intro/manifest.mjs';
const vm = () => ({handleException() {}, jre: Object.fromEntries([
  'java/net/InetAddress','java/net/Socket','java/net/SocketInputStream','java/net/SocketOutputStream',
  'java/util/zip/Inflater','java/awt/Toolkit','java/lang/Runtime',
].map(name => [name, {methods: {}, staticMethods: {}}]))});
const game = {gamecrc: -1254821409, internalName: 'geoblox', server: 'https://example.test/', prepareBeforeMain: false};
test('catalog hosts share parameters without JVM knowledge of FunOrb', () => {
  const controller = {options: {}};
  configureApplet(controller, game, {simpleMode: false, instanceId: 123});
  assert.equal(controller.options.appletParameters.gamecrc, '-1254821409');
  assert.equal(controller.options.appletParameters.simplemode, 'false');
  assert.equal(controller.options.appletParameters.instanceid, '123');
  assert.equal(controller.options.appletCodeBase, game.server);
});
for (const asynchronous of [false, true]) test(`launcher reconnects filesystem and endpoint after ${asynchronous ? 'async' : 'sync'} reset`, async () => {
  const reset = function (value) {this.jvm = vm(); return asynchronous ? Promise.resolve(value) : value;};
  const controller = {options: {}, jvm: vm(), reset};
  const fileSystem = {};
  const launcher = createGameLauncher({game, storage: {}});
  launcher.configure(controller, {fileSystem, decoder: {inflate() {}, inflateRaw() {}}});
  assert.equal(controller.options.prepareBeforeMain, false);
  assert.equal(controller.jvm.fs, fileSystem);
  assert.equal(await controller.reset(17), 17);
  assert.equal(controller.jvm.fs, fileSystem);
  assert.equal(typeof controller.jvm.jre['java/net/Socket'].methods['close()V'], 'function');
  launcher.dispose();
  assert.equal(controller.reset, reset);
});

for (const asynchronous of [false, true]) test(`shared preparation reaches the applet VM after ${asynchronous ? 'async' : 'sync'} reset`, async () => {
  const calls = [];
  const makeVm = () => Object.assign(vm(), {precompileInitializedClasses(options) {calls.push(options); return options;}});
  const reset = function () {this.jvm = makeVm(); return asynchronous ? Promise.resolve() : undefined;};
  const controller = {options: {}, jvm: makeVm(), reset};
  const launcher = createGameLauncher({game: {...game, prepareBeforeMain: true}, storage: {}});
  launcher.configure(controller, {sourceIdentity: 'b168d7edeb104599156b5f908df62dfdc9f3b250',
    runtimeManifest: {jvmOptions: {prepareWasmPreparedUpgradesOnly: true}},
    decoder: {inflate() {}, inflateRaw() {}}});
  assert.equal(sourcePatchAbi, 'catalog-account-server-v11-voice-cursor');
  const intro = introPreparationPolicy('d1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b98');
  for (let generation = 0; generation < 2; generation++) {
    const ownPolicy = {maxMethods: 12, priorityMethods: ['Render.draw()V']};
    const prepared = controller.jvm.precompileInitializedClasses({preparationPolicy: ownPolicy, wasm: true});
    assert.deepEqual(prepared.preparationPolicy.wasmCalleeMethods, intro.wasmCalleeMethods);
    assert.deepEqual(prepared.preparationPolicy.priorityMethods, [...intro.priorityMethods, 'Render.draw()V']);
    assert.equal(prepared.preparationPolicy.maxMethods, 12);
    assert.equal(prepared.preparationPolicy.entryMethods, undefined);
    assert.equal(prepared.wasmPreparedUpgradesOnly, true);
    assert.equal(prepared.wasm, true);
    assert.deepEqual(ownPolicy.priorityMethods, ['Render.draw()V']);
    if (generation === 0) await controller.reset();
  }
  assert.equal(calls.length, 2, 'one preparation call per VM, without wrapper duplication');
  launcher.dispose();
});
