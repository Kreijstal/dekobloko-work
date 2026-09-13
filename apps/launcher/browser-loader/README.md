# Browser game loader

This is the shared FunOrb application layer. `java-tools` supplies a generic
applet-capable JVM; game identifiers, parameters, JS5/login, source patches and
older-runtime compatibility belong here.

The cloner imports `manifest.json` and the listed ES modules from its browser Git
checkout. Modules must be listed before modules that import them, with relative
static imports. The local development endpoint serves these same sources.
Publish this directory before deploying a cloner that requires it.

`loader.mjs` exports source selection/patching, `sourcePatchAbi`, and
`createGameLauncher({game, storage, fetchAsset, diagnostics})`. Its `configure`
method connects the host filesystem and game endpoint to the current JVM and to
new JVMs created by controller reset. Call `dispose` to remove the reset hook;
it does not erase browser profiles. The host still invokes the generic
`debug.run(mainClass, options)` API and handles UI, cloning and compilation.

`applet-config.mjs` is also used directly by `serve-game-library.js`, whose game
sockets continue to use its server transport. The browser endpoint is an
alternative transport for static deployment, not an additional JVM feature.

Compatibility modules implement application-side workarounds for older cloned
JVM bundles. General Java API fixes should go upstream to java-tools, never as
Jagex-specific hooks.

Bump `sourcePatchAbi` when source transforms change emitted classes. Module
loading follows the updated Git checkout, so host-only changes do not invalidate
compiled Java classes. Native recovery and asset metadata are maintained by the
Deko's [cache tools](../../../scripts/README-cache-assets.md).

Validation:

```sh
node --test scripts/test-browser-loader.mjs
# From the sibling cloner:
npm run test:games
npm run test:browser-natives
```
