import {createBrowserGameServer, LOGIN_MODULUS} from './browser-game-server.mjs';
import {patchLoginEncryption, patchSocketWriter, selectGameSources, patchGameCompatibility, patchGeobloxSource} from './game-source-patches.mjs';
import {installBrowserInflater} from './browser-inflater.mjs';
import {installBrowserImageDecoder} from './browser-image-decoder.mjs';
import {installBrowserRuntimeMemory} from './browser-runtime-memory.mjs';
import {installInterpreterOverrides} from './browser-interpreter-overrides.mjs';
import {configureApplet} from './applet-config.mjs';

// Bump when source transforms change emitted class files, not for host fixes.
export const sourcePatchAbi = 'catalog-account-server-v9';
export {selectGameSources, configureApplet};
export function patchSource(source, sourcePath) {
  source = patchGeobloxSource(source, sourcePath, LOGIN_MODULUS);
  return patchGameCompatibility(patchSocketWriter(patchLoginEncryption(source, LOGIN_MODULUS)), sourcePath);
}

// Each launch owns its endpoint and reset hook. Hosts supply storage, assets,
// filesystem and presentation; this module owns game protocol and policy.
export function createGameLauncher({game, storage, fetchAsset, diagnostics = {}}) {
  const server = createBrowserGameServer({game, storage, fetchAsset, diagnostics});
  let detach = null;
  const configured = new WeakSet();
  return {
    server,
    configure(controller, {fileSystem, codeBase, runtimeManifest, decoder = globalThis.pako} = {}) {
      detach?.();
      configureApplet(controller, game, {codeBase});
      controller.options.prepareWasmPreparedUpgradesOnly = runtimeManifest?.jvmOptions?.prepareWasmPreparedUpgradesOnly ?? true;
      for (const option of ['wasmHeap', 'denseInstanceFields', 'prepareBeforeMain']) {
        if (game[option] !== undefined) controller.options[option] = game[option];
      }
      if (game.compileWorker !== undefined) {
        controller.options.jit = {...(controller.options.jit || {}), compileWorker: game.compileWorker};
      }
      const install = () => {
        const jvm = controller.jvm;
        if (configured.has(jvm)) return;
        jvm.fs = fileSystem;
        installInterpreterOverrides(jvm, game.interpretMethods);
        const prepare = jvm.precompileInitializedClasses?.bind(jvm);
        if (prepare) jvm.precompileInitializedClasses = (options = {}) => prepare({
          ...options, wasm: game.prepareWasm ?? options.wasm,
          wasmPreparedUpgradesOnly: options.wasmPreparedUpgradesOnly ?? controller.options.prepareWasmPreparedUpgradesOnly,
        });
        server.install(jvm);
        installBrowserInflater(jvm, decoder);
        installBrowserImageDecoder(jvm);
        installBrowserRuntimeMemory(jvm);
        configured.add(jvm);
      };
      const reset = controller.reset;
      const wrapped = function (...args) {
        const result = reset.apply(this, args);
        if (result?.then) return result.then(value => {install(); return value;});
        install();
        return result;
      };
      controller.reset = wrapped;
      detach = () => {if (controller.reset === wrapped) controller.reset = reset;};
      install();
    },
    dispose() {detach?.(); detach = null;},
  };
}
