# Testing

Four suites exist across three runtimes. They are not discovered by a single
command and should not be, because they need different toolchains.

| Suite | Command | Runtime |
|---|---|---|
| `scripts/` self-tests | `node scripts/run-tests.js` | Node 22 |
| Protocol server (JS) | `cd apps/server-js && npm test` | Node 22, zero deps |
| Protocol server (Python) | `PYTHONPATH=apps/server python3 -m unittest discover apps/server/tests` | Python 3, stdlib `unittest` |
| Renderer-free game logic | `./game-logic/build.sh` | JDK |

## `scripts/run-tests.js`

Discovers `scripts/test-*.js`, runs each in a fresh process from the repository
root, and reports one line per file. Twelve files are currently discovered.

```bash
node scripts/run-tests.js            # everything
node scripts/run-tests.js --quick    # skip the files marked slow
node scripts/run-tests.js --list     # show what would run, with markers
node scripts/run-tests.js lib        # only files whose name contains "lib"
```

Design rules, each chosen because it corresponds to a way this repository has
previously reported a false green:

- **Discovering zero tests is a failure.** A glob that matches nothing must
  never read as success.
- **A timeout is a failure, not a skip.** The per-file timeout is 300 s.
- **A known failure does not turn the run green.** It is reported as
  `KNOWN-FAIL` with its cause and owner and excluded from the exit status — and
  if a known failure starts *passing*, the run fails, so the list cannot quietly
  rot.

`KNOWN_FAILURES` in `scripts/run-tests.js` is currently **empty**, which is the
correct state: a known failure is a debt, not a category to keep stocked. Each
entry must name the cause and where the fix belongs.

`test-pipeline-pass-regressions` (~44 s) is the only file marked slow; it shells
out to java-tools and CFR. `--quick` skips it and says so.

### What the contract tests pin

| Test | Pins |
|---|---|
| `test-lib-java-tools` | All six java-tools discovery rules, including the divergence that makes `JAVA_TOOLS_DIR` not configure `serve-game-library.js`. Widening a strategy fails the test. |
| `test-lib-provenance` | That the extracted digest and git helpers reproduce the private copies exactly, that the schema adapters keep each result file's existing key names, and that an unavailable measurement is `null`, never `false` or `0`. |
| `test-lib-offline-guard` | That a public host is refused by name before any DNS or TCP work, that loopback still connects (against a real ephemeral listener), and that `restore()` puts the process back. |
| `test-lib-effective-config` | That every documented consumer file exists and still reads its variable, and that `snapshot()` distinguishes unset from set-and-empty. |
| `test-config-portability` | The configuration bug classes described in [configuration.md](configuration.md), including the author-path fallback ratchet. |
| `test-pipeline-cache-provenance` | That a stale, dirty or missing pipeline-cache stamp forces a rebuild. |
| `test-observable-call-duplication-guard` | That a tail-duplicating transform cannot execute an observable call twice. |
| `test-structured-goto-clone` | The structured-goto cloning pass. |
| `test-js5-server` / `test-js5-recorder` | The JS5 server against a synthetic cache it builds itself, and the recorder format. |
| `test-alterorb-main-menu-harness` | The main-menu launch harness plumbing. |
| `test-pipeline-pass-regressions` | Per-pass decompiler regressions, via java-tools and CFR. |

## Python server suite

`apps/server/tests/test_active_piece_geometry.py` guards on two golden tables
that are gitignored and absent here (`golden-active-piece.tsv`,
`golden-rotation.tsv`, ~21 MB). It reports them as unittest **skips**, not
passes — a bare exit-code check would still read the run as green. The probe
that regenerated them (`tools/oracle/ParityProbe`) is no longer in this
repository, so those skips cannot currently be closed from this checkout.

`golden-clear-settle.tsv` is deliberately committed, because the rule it pins
has been measured wrong twice.

## What is not tested

- No CI configuration exists (`.github/` is absent).
- No root `package.json` exists, so there is no top-level `npm test`.
- The native applet launcher's trace oracle (`apps/launcher/assert-trace.js`)
  is not wired into any runner; it is invoked by
  `scripts/launcher/run-trace-test.sh`.
- Browser behaviour is not covered by any of these suites.

## Measurement is not testing

- **No performance figures are produced or accepted from this checkout.**
  Timing on a shared machine is invalid; back-to-back A/B on the same tree is
  the only usable evidence here.
- When a measurement is recorded, these distinctions must stay explicit and must
  never be collapsed: preparation versus post-start execution; cold versus
  warmed; simulation ticks versus rendered versus submitted versus presented
  frames; compute-only versus compute-and-presentation; profiled versus
  unprofiled; real game versus reduction; PCM production versus delivery versus
  underrun observation; per-output underrun duration versus wall-clock.
- An unavailable metric is reported as unavailable. Never substitute zero, and
  never compute a frame rate from a run that never rendered.
- Every result should carry the effective configuration
  (`node scripts/print-effective-config.js --json`) and the provenance record
  from `scripts/lib/provenance.js`, including the dirty state of both checkouts.
  A dirty tracked tree without its patch is not reproducible.

`tools/differential-methods/` is the retained measurement workflow (capture,
oracle, build, hotspot, server, report). `build.mjs` defaults its compiler to
`/usr/lib/jvm/java-8-openjdk/bin/javac`, which is not installed here, so set
`JAVAC`; see its own `README.md`.
