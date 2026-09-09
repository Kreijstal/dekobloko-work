# Architecture

What lives in this repository, what it owns, and the invariants that hold
across all of it.

## Repository boundary

This repository owns **application integration and development tooling**.

The sibling repository [`java-tools`](https://github.com/Kreijstal/java-tools)
owns the **generic compiler, interpreter, JIT and JVM runtime**. Nothing generic
belongs here, and nothing game-specific belongs there.

| Concern | Owner |
|---|---|
| Bytecode parsing, transforms, decompiler, JIT, Wasm tiers, `jvm-cli.js` | `java-tools` |
| Game launchers, gamepack retrieval, JS5 services, per-game profiles, protocol servers | this repository |

Game-specific compatibility lives in named, documented adapters —
`stubs/src/`, `apps/launcher/src/local/awt/`, `scripts/pipeline/profiles/` —
never hidden inside generic JVM execution. Cross-repository API changes are
tracked as follow-ups, not made from here.

`java-tools` must not contain Dekobloko-specific class names, offsets or asset
knowledge. Reusable JIT optimizations there select code by descriptors, verified
CFG/stack structure, opcodes and runtime target shape. Obfuscated method
identities such as `vk.a(I)V` are permitted only as runtime profiler roots and
trace selectors.

## Components

| Path | Owns |
|---|---|
| `apps/launcher/` | AWT applet host (real and synthetic toolkit), trace capture, and the `assert-trace.js` trace oracle. Builds on the installed JDK 11; see [running.md](running.md) §5 for the Applet API constraint. `browser-runtime.json` pins the browser runtime bundle identity used by `scripts/launch-alterorb-games-jvmjs.js`. |
| `apps/server/` | Python protocol server — the **authoritative** reference implementation, including the ported deterministic board engine. |
| `apps/server-js/` | Mechanical JS port of `apps/server`, validated against Python golden vectors. Not wired into any launcher. |
| `game-logic/` | Renderer-free Java gameplay library, independently buildable, checked against the untouched original `lk` board class. |
| `stubs/src/` | Legacy JDK/browser/native dependency stubs → `lib/dekobloko-stubs.jar`. |
| `scripts/lib/` | Shared infrastructure: java-tools discovery, provenance, offline guard, configuration registry. |
| `scripts/pipeline/` | The deobfuscation pipeline (`bulk-pipeline.js`), its passes, and per-game JSON profiles. |
| `scripts/launcher/` | Build and run wrappers for the native applet launcher. |
| `scripts/` | Gamepack fetch, decompile driver, headless and multi-game jvm.js runners, JS5 server/recorder/proxy, the browser game library, the config printer and the test runner. |
| `tools/differential-methods/` | The differential-method benchmark workflow: capture, oracle, build, hotspot, server and report stages. `build.mjs` defaults its compiler to `/usr/lib/jvm/java-8-openjdk/bin/javac`, which is not present here; set `JAVAC`. |
| `tools/js5/` | JS5 cache download and the validated-build list. |
| `web/` | `jvm-js-logo.svg`, served by the game library as its loading logo. The other pages under `web/` have no server in this checkout. |

## Boundaries and invariants

### Offline

**Never contact AlterOrb or any public game host.** All game serving is
`127.0.0.1`. `scripts/lib/offline-guard.js` makes "this run was offline"
checkable rather than asserted: it replaces `net.Socket.prototype.connect` to
refuse any non-loopback host by name, before any DNS or TCP work, and rejects
`fetch` outright. It is currently installed only by
`scripts/launch-alterorb-games-jvmjs.js`; anything else that reports an offline
run should install it too.

### Generic passes versus profile-driven passes

```text
java-tools/src/        generic bytecode transforms and serializers
scripts/pipeline/      pipeline order, profile-aware pass wrappers, game JSON profiles
```

A profile entry selects a *candidate site*; it is not permission to blindly
patch arbitrary code. The pass implementation still checks the surrounding
CFG/instruction shape before rewriting. That is how the pipeline avoids hiding
game-specific hacks inside reusable transforms. Details and the transform
catalog: [decompilation.md](decompilation.md).

### Game recognition

The browser and headless launch adapters may recognise a game — that is what a
launch manifest is. Generated Java execution stays generic: the JVM, bytecode
interpreter, JIT and optimizer never select behavior from a game or method name.

### Provenance

`--reuse-pipeline` is provenance checked: each transformed class tree is tied to
the input-class digest, both generator commits and their clean-tree state, the
effective pass list, and the pipeline environment gates. Missing, dirty or stale
stamps force a bytecode rebuild. **A complete class count alone never proves
cached transformed bytecode is current.**

`scripts/lib/provenance.js` produces the record to attach to any result file. An
unavailable measurement is reported as `null` — never `false` or `0`.

### Oracles and baselines

Never regenerate an oracle or a baseline to make a check pass. The frozen
zero-failure baseline for the owned decompiler is
`scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv`.

### Generated state

`.work/` is generated state, but **not everything in it is disposable**. Do not
keep the only copy of source, a patch, an oracle or a failing fixture there.

### Reading decompiled code is not evidence

Conclusions drawn by reading obfuscated decompiled control flow have been
contradicted by probes repeatedly in this project. Load the client's own classes
and run them, or attach to a live client, before concluding anything about
behavior. See [protocol.md](protocol.md) §8 and
[troubleshooting.md](troubleshooting.md).

## Where to read more

- [running.md](running.md) — obtaining a gamepack and starting a game
- [decompilation.md](decompilation.md) — the deobfuscation and decompile pipeline
- [configuration.md](configuration.md) — every configuration variable and its consumers
- [testing.md](testing.md) — the suites that exist and how to run them
- [protocol.md](protocol.md) — the wire protocol the servers implement
- [troubleshooting.md](troubleshooting.md) — symptom-first index
