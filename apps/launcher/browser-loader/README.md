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

Escape Vector's account services are embedded here in
`escape-account-service.mjs`, selected automatically. They persist separate
campaign progress, achievement bits, saved game bytes and board-specific best
scores in browser storage. Score tables can include profiles on the same
browser origin; they are not global online leaderboards. Reconnect IDs remain
stable across page reloads. No TCP service or persistent backend process is
needed on Sites. Passwords are not stored or authenticated by local profiles.

Run `node --test scripts/test-escape-account-service.mjs` for service tests and
92 checks using the original client bytecode's packet writers and decoders.
The native case needs a local original JAR and JDK; it is explicitly skipped
when the JAR is absent. The TCP bridge in that test is only a native test adapter.

`applet-config.mjs` is also used directly by `serve-game-library.js`, whose game
sockets continue to use its server transport. The browser endpoint is an
alternative transport for static deployment, not an additional JVM feature.

Compatibility modules implement application-side workarounds for older cloned
JVM bundles. General Java API fixes should go upstream to java-tools, never as
Jagex-specific hooks.

The shared `browser-runtime.json` requests a 256 MiB linear heap and permits
startup expansion up to 384 MiB when java-tools has a usable Chromium estimate.
The planning budget is 512 MiB with 96 MiB of headroom for unmeasured/runtime
growth. Small reported devices and browsers without an estimate keep 256 MiB.
This policy was enabled at the user's request; approximate counters and focused
checks do not establish an application-wide memory limit or game FPS. Java-tools
selects capacity before views exist and falls back to 256 MiB if an expanded
reservation is refused. The cloner reports the estimate and decision. No game
profile or feature flag is needed, and live buffers are never grown.

Bump `sourcePatchAbi` when source transforms change emitted classes. Module
loading follows the updated Git checkout, so host-only changes do not invalidate
compiled Java classes. Native recovery and asset metadata are maintained by the
Deko's [cache tools](../../../scripts/README-cache-assets.md).

Login RSA adaptation selects the byte-buffer serialization method by typed
BigInteger parameters and its encode/decode operations, independent of renamed
argument spellings. Retained JS5 verification keys are untouched. ABI v12
invalidates classes compiled before this fix; users only need to reload once
the updated Deko source is available, while local account records remain intact.

Validation:

```sh
node --test scripts/test-browser-loader.mjs
# From the sibling cloner:
npm run test:games
npm run test:browser-natives
```
