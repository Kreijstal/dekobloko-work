import test from 'node:test';
import assert from 'node:assert/strict';
import {configureApplet, createGameLauncher} from '../apps/launcher/browser-loader/loader.mjs';
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
