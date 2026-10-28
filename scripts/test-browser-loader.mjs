import test from 'node:test';
import assert from 'node:assert/strict';
import {configureApplet, createGameLauncher, sourcePatchAbi} from '../apps/launcher/browser-loader/loader.mjs';
import {introPreparationPolicy} from '../apps/intro/manifest.mjs';
import {patchLoginEncryption} from '../apps/launcher/browser-loader/game-source-patches.mjs';

for (const [exponent, modulus] of [['param2','param1'],['exponent','modulus'],['e$1','n_2']]) {
  test(`local RSA selection survives parameter naming: ${exponent}, ${modulus}`, () => {
    const source = `class Buffer {
      void encrypt(final java.math.BigInteger ${modulus}, BigInteger ${exponent}) {
        BigInteger value = new BigInteger(payload);
        byte[] bytes = value.modPow(${exponent}, ${modulus}).toByteArray();
      }
      void verify() { byte[] signature = value.modPow(this.exponent, this.modulus).toByteArray(); }
    }`;
    const patched = patchLoginEncryption(source, '123456789');
    assert.ok(patched.includes(`value.modPow(${exponent}, new java.math.BigInteger("123456789"))`));
    assert.ok(patched.includes('value.modPow(this.exponent, this.modulus)'));
    assert.equal(patchLoginEncryption(patched, '123456789'), patched);
  });
}
test('RSA selection ignores comments, literals, retained verification keys and non-buffer methods', () => {
  const source = `class Verify {
    // void encrypt(BigInteger param1, BigInteger param2) { new BigInteger(bytes).modPow(param2, param1).toByteArray(); }
    String text = "value.modPow(param2, param1)";
    void verify(BigInteger exponent, BigInteger modulus) { value.modPow(exponent, modulus); }
    void retained(BigInteger exponent, BigInteger modulus) {
      byte[] data = new BigInteger(bytes).modPow(this.exponent, this.modulus).toByteArray();
    }
  }`;
  assert.equal(patchLoginEncryption(source, '123'), source);
  assert.throws(() => patchLoginEncryption(source, '123";'), /Invalid browser login modulus/);
});
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
  assert.equal(sourcePatchAbi, 'catalog-account-server-v12-typed-login-rsa');
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
