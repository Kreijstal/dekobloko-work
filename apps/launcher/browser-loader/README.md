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

## Original Escape Vector mission

`?game=escapevector&level=switchback-salvage` selects **Switchback Salvage**,
an original cargo-retrieval cave. Choose Start Game, Retrieval–Normal, then
level 1. Descend the switchbacks, land on the cargo to attach it, and tow it
back above the surface. The upper chambers provide braking/turning space.
This uses existing public theme artwork and the ordinary game physics; it
does not recover or unlock the encrypted member campaigns.

The readable level definition and deterministic version-11 encoder live in
`escape-levels.mjs`. The launch parameter selects one custom mission without
changing normal campaigns. Custom missions do not submit original campaign
progress, scores or achievements. The source patch ABI must be bumped whenever
the encoded map or generated Java changes, so cached classes cannot retain an
earlier map. No binary map or generated Java is committed here.

From the Deko root:

```sh
node scripts/build-escape-level.mjs switchback-salvage /tmp/switchback-salvage.bin
node --test scripts/test-escape-level.mjs
node scripts/test-escape-level-browser.mjs
```

The output path must not exist. Tests check route clearance and compare every
terrain pixel and the full stream layout against both the original gamepack and
the patched readable client. These checks alone do not establish winnability:
landing, pickup and loaded return also require a successful physics playthrough.
The browser check requires the cloner's local development server. It drives
rotation and thrust, reads state through reflection, and requires the game's
own `isMissionComplete` result with the cargo attached, cheats off, and fuel
and shield remaining. Crashes, lost cargo and unsuccessful runs fail the check.
Its temporary browser profile is removed afterwards; it saves no screenshots.

Verified 2026-10-30: the input-only browser pilot completed the current map in
4,797 game ticks, landed to collect the cargo and exited with it attached.
`isMissionComplete` returned true; 4,300 of 6,500 fuel and all 300 shield remained,
with no ship destruction, easy mode or time-hack mode. Map SHA-256:
`c2d5aa643f16505ec158b977f4dc2472a2dda09c50cf0245a8f546b1a414ae37`.
Earlier trials exposed a narrow landing and a pickup obstructing the loaded
return. The current map supplies a landing shelf and keeps that tow route clear.
This proves a winning route; it does not measure how easy new players find it.

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
