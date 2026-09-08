# Dekobloko Harness

Application integration and development tooling for running the Deko Bloko /
GeoBlox (AlterOrb / FunOrb) game stack: native Java applet launchers, headless
`jvm.js` runners, a browser game library, the deobfuscation and decompilation
pipeline, gamepack and JS5 services, reduced regression fixtures, and the
measurement harnesses around all of it.

## Repository boundary

This repository owns **application integration and development tooling**.

The sibling repository [`java-tools`](https://github.com/Kreijstal/java-tools)
owns the **generic compiler, interpreter, JIT and JVM runtime**. Nothing
generic belongs here, and nothing game-specific belongs there. Game-specific
compatibility lives in named, documented adapters (`stubs/src/`,
`apps/launcher/src/local/awt/`, `scripts/pipeline/profiles/`), never hidden
inside generic JVM execution.

Concretely:

| Concern | Owner |
|---|---|
| Bytecode parsing, transforms, decompiler, JIT, Wasm tiers, `jvm-cli.js` | `java-tools` |
| Game launchers, gamepack retrieval, JS5 services, per-game profiles, fixtures, reports | this repository |

Cross-repository API changes are tracked as follow-ups, not made from here.

## Tested setup

Verified on this machine on 2026-09-08:

| Component | Version | Needed for |
|---|---|---|
| Node.js | v22.23.2 | everything in `scripts/`, `tools/`, `apps/server-js/` |
| JDK | OpenJDK 11.0.31 (`java`, `javac`) | `game-logic`, `scripts/build-stubs.sh` |
| JDK 8 | **not installed here** | the applet launcher and several `tools/` builds |
| Python 3 | present | `apps/server`, `tools/js5`, `tools/music` |
| Firefox | via Playwright browser packs only; no `firefox` on `PATH` | browser measurement |
| `java-tools` | `/home/kreijstal/git/java-tools`, branch `master` | the pipeline and all jvm.js runs |

> **JDK 8 is a hard requirement for the applet path.** Not "8 or newer": the
> games are applets, and a JDK that removed the Applet API cannot compile or
> run them. See [docs/native-launcher.md](docs/native-launcher.md). With only
> JDK 11 present, the applet launcher, `tools/instr`, `tools/oracle` and
> `tools/differential-methods` cannot be built.

Also needed by specific workflows: `bash`, `curl` (gamepack fetch), and
`ripgrep` (`scripts/decompile-all-games.sh` fails closed without it).

## Setup

```bash
mkdir -p ~/git && cd ~/git
git clone https://github.com/Kreijstal/dekobloko-work.git
git clone https://github.com/Kreijstal/java-tools.git

cd dekobloko-work
export JAVA_TOOLS_DIR="$HOME/git/java-tools"
export JAVA_TOOLS_ROOT="$JAVA_TOOLS_DIR"   # see the note below
```

**Both variables are currently required.** `JAVA_TOOLS_DIR` does not configure
`scripts/serve-game-library.js`, which reads `JAVA_TOOLS_ROOT` instead. Six
different java-tools discovery rules exist across the repository, three of
which fall back to a hardcoded author path. Print what your checkout will
actually use:

```bash
node scripts/print-effective-config.js
node scripts/print-effective-config.js --divergences   # just the disagreements
```

Full inventory, precedence and consumers: [docs/configuration.md](docs/configuration.md).

## Primary commands

| Task | Command |
|---|---|
| Show the effective configuration | `node scripts/print-effective-config.js` |
| Run the `scripts/` self-tests | `node scripts/run-tests.js` (`--quick` skips the slow ones) |
| Decompile every game with the owned decompiler | `JAVA_TOOLS_DIR=... ./scripts/decompile-all-games.sh .work/games` |
| Boot a gamepack headlessly on jvm.js | `node scripts/run-jvmjs.js .work/games/<game>/classes` |
| Serve the browser game library (127.0.0.1 only) | `JAVA_TOOLS_ROOT=... node scripts/serve-game-library.js` |
| Serve a local JS5 update server | `node scripts/js5-server.js` |
| Build the JDK 8 applet launcher | `./scripts/launcher/build.sh` (needs JDK 8) |
| Build and test the renderer-free game logic | `./game-logic/build.sh` |
| Run the protocol server suites | `cd apps/server-js && npm test` / `PYTHONPATH=apps/server python3 -m unittest discover apps/server/tests` |

The owned-decompiler workflow is the authoritative one. It runs the
verifier-safe generic bytecode pipeline, the JavaScript decompiler from
`java-tools/src/decompiler`, strict fallback diagnostics, ASM verification and
whole-game `javac` compilation. Generated sources and reports land under
`.work/games/<game>/decompile-owned/`; the target zero-failure baseline is
`scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv`. Compilation is only the static
gate — see [recompiled runtime validation](docs/recompiled-runtime-validation.md)
for the launch-to-main-menu gate and the operand-stack bugs that only appear at
runtime.

`--reuse-pipeline` is provenance checked: each transformed class tree is tied to
the input-class digest, both generator commits and clean-tree state, the
effective pass list, and pipeline environment gates. Missing, dirty or stale
stamps force a bytecode rebuild. A complete class count alone never proves
cached transformed bytecode is current.

## Component map

| Path | Owns | Status |
|---|---|---|
| `apps/launcher/` | JDK 8 AWT applet host (real and synthetic toolkit), trace capture, `assert-trace.js` oracle | supported; needs JDK 8 |
| `apps/server/` | Python protocol server — **authoritative** reference implementation | supported |
| `apps/server-js/` | Mechanical JS port of `apps/server`, validated against Python golden vectors | experimental; not wired into any launcher |
| `scripts/lib/` | Shared infrastructure: java-tools discovery, provenance, offline guard, configuration registry | supported |
| `scripts/` | Launchers, servers, benchmarks, oracles, baselines and self-tests | mixed; see [docs/repository-map.md](docs/repository-map.md) |
| `scripts/pipeline/` | The deobfuscation pipeline and per-game profiles | supported |
| `scripts/launcher/` | Build and run wrappers for the native launcher | supported |
| `game-logic/` | Renderer-free Java gameplay library, independently buildable | supported |
| `stubs/src/` | Legacy JDK/browser/native dependency stubs → `lib/dekobloko-stubs.jar` | supported |
| `mappings/` | Obfuscated → semantic rename maps | partly orphaned |
| `web/` | Browser diagnostics pages served by `scripts/serve-audio-diagnostics.js` | supported |
| `tools/js5/`, `tools/music/` | JS5 cache download and the music extraction/render corpus | supported |
| `tools/` (rest) | Instrumentation, probes, oracles and reduced fixtures | mixed; see [docs/fixtures.md](docs/fixtures.md) |
| `.work/` | Generated caches, run output and retained evidence | see [docs/artifact-retention.md](docs/artifact-retention.md) |

Directory names are not proof of responsibility. `docs/repository-map.md`
records what each component actually does, who calls it, and its evidence.

## Runbooks

Current instructions:

- [Configuration and effective options](docs/configuration.md)
- [Repository map and migration backlog](docs/repository-map.md)
- [Testing: which suites exist and how to run them](docs/testing.md)
- [Fixture and reduction index](docs/fixtures.md)
- [Artifact retention and cleanup classification](docs/artifact-retention.md)
- [Node and jvm.js runtime harnesses](docs/node-runtime.md)
- [Gamepack retrieval and local JS5 serving](docs/gamepacks-and-js5.md)
- [JS5 cache, protocol and music tooling](docs/js5-cache-and-music.md)
- [Native Java launcher](docs/native-launcher.md)
- [Decompilation, deobfuscation and validation](docs/decompilation.md)
- [GOTO baseline runbook](docs/goto-baseline-runbook.md)
- [Browser game library](docs/browser-game-library.md)
- [Recompiled runtime validation](docs/recompiled-runtime-validation.md)
- [Troubleshooting](docs/troubleshooting.md)

Historical investigations and experiment records (kept with their original
claims and dates, not rewritten): everything else under `docs/`, including the
`docs/phase*` series, `docs/firefox-*-2026-09-07.md`, `docs/runtime-*.md`,
`docs/cfr-goto-casebook.md` and `docs/loading-and-menu-investigation.md`.

## Known limitations

- **JDK 8 is absent on this machine**, so the applet launcher, `tools/instr`,
  `tools/oracle` and `tools/differential-methods` cannot be built or run here.
- **Configuration is not yet portable.** Three discovery rules fall back to
  `/home/kreijstal/git/java-tools`; `scripts/pipeline/bulk-pipeline.js` resolves
  its Node dependency directory to that path even when `JAVA_TOOLS_DIR` is set
  correctly. `docs/configuration.md` lists every case.
- **Two self-tests fail for cross-repository reasons** and are declared as
  known failures in `scripts/run-tests.js`. They are not green; see
  [docs/testing.md](docs/testing.md).
- **`scripts/deobfuscate.sh` does not run.** It resolves `JAVA_TOOLS_DIR` to
  this repository and then looks for `tools/asm/MultiEntryLoopNormalizer.java`
  and `scripts/jvm-cli.js`, neither of which exists here. Nothing calls it.
- **Several `tools/` entries reference paths that no longer exist.** See
  [docs/repository-map.md](docs/repository-map.md) for the verified list.
- **No performance numbers are published from this checkout.** Measurement is
  documented in [docs/testing.md](docs/testing.md); machine-specific figures
  live in the untracked `docs/performance.md`.

## Standing rules

- **Never contact AlterOrb or any public game host.** All game serving is
  `127.0.0.1`. `scripts/lib/offline-guard.js` enforces this at the socket
  layer; install it in anything that claims to run offline.
- `.work/` is generated state, but **not everything in it is disposable**. Do
  not keep the only copy of source, a patch, an oracle or a failing fixture
  there. See [docs/artifact-retention.md](docs/artifact-retention.md).
- Never regenerate an oracle or a baseline to make a check pass.
