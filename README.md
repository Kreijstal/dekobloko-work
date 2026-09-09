# Dekobloko Harness

Application integration and development tooling for running the Deko Bloko /
GeoBlox (AlterOrb / FunOrb) game stack: the native Java applet launcher,
headless `jvm.js` runners, a browser game library, the deobfuscation and
decompilation pipeline, gamepack and JS5 services, and the protocol servers.

The generic compiler, interpreter, JIT and JVM runtime live in the sibling
repository [`java-tools`](https://github.com/Kreijstal/java-tools). Nothing
generic belongs here, and nothing game-specific belongs there — see
[docs/architecture.md](docs/architecture.md).

## Prerequisites

| Component | Needed for |
|---|---|
| Node.js 22 | everything in `scripts/`, `tools/`, `apps/server-js/` |
| A JDK with `java.applet` | `game-logic/`, `scripts/build-stubs.sh`, the applet launcher |
| Python 3 | `apps/server`, `tools/js5` |
| `java-tools` checkout | the pipeline and all jvm.js runs |
| `bash`, `curl`, `ripgrep` | gamepack fetch; `scripts/decompile-all-games.sh` fails closed without `rg` |

Every game here is a `java.applet.Applet`. The Applet API is deprecated for
removal from JDK 17 and **removed in JDK 26**, so a JDK 26 toolchain cannot
compile the sources or build the launcher. `scripts/build-stubs.sh` targets
`--release 8` itself, so it does not need a JDK 8 installation. Details:
[docs/running.md](docs/running.md) §5.

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
java-tools discovery rules exist across the repository, two of which fall back
to a hardcoded author path. Print what your checkout will actually use:

```bash
node scripts/print-effective-config.js
node scripts/print-effective-config.js --divergences   # just the disagreements
```

Full inventory, precedence and consumers:
[docs/configuration.md](docs/configuration.md).

## Commands

| Task | Command |
|---|---|
| Show the effective configuration | `node scripts/print-effective-config.js` |
| Run the `scripts/` self-tests | `node scripts/run-tests.js` (`--quick` skips the slow one) |
| Fetch and verify a gamepack | `./scripts/fetch-gamepack.sh` |
| Build the dependency stubs | `./scripts/build-stubs.sh` |
| Decompile every game with the owned decompiler | `JAVA_TOOLS_DIR=... ./scripts/decompile-all-games.sh .work/games` |
| Run the bytecode pipeline directly | `node scripts/pipeline/bulk-pipeline.js <in> <out>` |
| Boot a gamepack headlessly on jvm.js | `node scripts/run-jvmjs.js .work/games/<game>/classes` |
| Launch games and gate on the main menu | `node scripts/launch-alterorb-games-jvmjs.js --until-main-menu` |
| Serve the browser game library | `JAVA_TOOLS_ROOT=... node scripts/serve-game-library.js` |
| Serve a local JS5 update server | `node scripts/js5-server.js --cache-dir <dir>` |
| Build the applet launcher | `./scripts/launcher/build.sh` |
| Fake-AWT boundary check | `./scripts/launcher/run-fake-awt-check.sh` |
| Build and test the renderer-free game logic | `./game-logic/build.sh` |
| Run the protocol server suites | `cd apps/server-js && npm test` / `PYTHONPATH=apps/server python3 -m unittest discover apps/server/tests` |

The owned-decompiler workflow is the authoritative one: it runs the
verifier-safe generic bytecode pipeline, the JavaScript decompiler from
`java-tools/src/decompiler`, strict fallback diagnostics, ASM verification and
whole-game `javac` compilation. Output lands under
`.work/games/<game>/decompile-owned/`, and the frozen zero-failure baseline is
`scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv`. Compilation is only the static
gate; the launch-to-main-menu run is the runtime one.

## Documentation

- [Architecture](docs/architecture.md) — components, ownership boundary, standing invariants
- [Running the games](docs/running.md) — gamepacks, JS5, headless, browser, applet launcher
- [Deobfuscation and decompilation](docs/decompilation.md) — the pipeline, its gates and transform catalog
- [Configuration](docs/configuration.md) — every variable, its consumers and the known divergences
- [Testing](docs/testing.md) — the four suites and how to run them
- [Wire protocol](docs/protocol.md) — what `apps/server` and `apps/server-js` implement
- [Game rules](docs/single-player-master-challenge-gameplay.md) — the rules the authoritative engine implements
- [JS5 sprite format](docs/js5-sprite-format.md) — archive 6
- [Class map](docs/dekobloko-class-map.md) — all 343 obfuscated Dekobloko classes
- [Troubleshooting](docs/troubleshooting.md) — symptom-first index

## Standing rules

- **Never contact AlterOrb or any public game host.** All game serving is
  `127.0.0.1`. `scripts/lib/offline-guard.js` enforces this at the socket layer;
  install it in anything that claims to run offline.
- `.work/` is generated state, but **not everything in it is disposable**. Do
  not keep the only copy of source, a patch, an oracle or a failing fixture
  there.
- Never regenerate an oracle or a baseline to make a check pass.
- **No performance figures are produced or accepted from this checkout.** Timing
  on a shared machine is invalid; back-to-back A/B on the same tree is the only
  usable evidence here.
