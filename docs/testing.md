# Testing

Four separate suites exist, with three different runtimes. They are not
discovered by any single command and should not be, because they need
different toolchains.

| Suite | Command | Runtime | Status here |
|---|---|---|---|
| `scripts/` self-tests | `node scripts/run-tests.js` | Node 22 | runs; 15 pass, 2 known-fail |
| Protocol server (JS) | `cd apps/server-js && npm test` | Node 22, zero deps | runs |
| Protocol server (Python) | `PYTHONPATH=apps/server python3 -m unittest discover apps/server/tests` | Python 3, stdlib `unittest` | runs, with skips (below) |
| Renderer-free game logic | `./game-logic/build.sh` | JDK | runs |

## `scripts/run-tests.js`

Discovers `scripts/test-*.js`, runs each in a fresh process from the repository
root, and reports one line per file.

```bash
node scripts/run-tests.js            # everything
node scripts/run-tests.js --quick    # skip the two slow files
node scripts/run-tests.js --list     # show what would run, with markers
node scripts/run-tests.js lib        # only files whose name contains "lib"
```

Design rules, chosen because each corresponds to a way this repository has
previously reported a false green:

- **Discovering zero tests is a failure.** A glob that matches nothing must
  never read as success.
- **A timeout is a failure, not a skip.**
- **A known failure does not turn the run green.** It is reported as
  `KNOWN-FAIL` with its cause and owner and is excluded from the exit status —
  and if a known failure starts *passing*, the run fails, so the list cannot
  quietly rot.
- Before this runner existed, each of the twelve test files had to be invoked
  by name and only two were named in any document, so "the tests pass" was
  never a checkable statement.

### Current known failures

Both are cross-repository and neither is fixable from here. Their expected
values are oracles and **must not be regenerated to get green**.

| Test | Cause |
|---|---|
| `test-cfr-goto-casebook` | Ingests zero goto records (`goto_ingested=0`). The casebook is populated from java-tools decompiler output; the java-tools working tree is mid-refactor, with `src/conditionInverter.js` and `src/conditionInverterCfg.js` moved under `src/passes/`. |
| `test-cfr-oracle-policy` | Pinned marker counts no longer reproduce: the "terminal-helper fallback" case selects `baseline` (15 markers) where the baseline expects `candidate` (7). |

Both were already failing before any change in this cleanup; the 2026-09-08
baseline is recorded in the report that accompanied it.

### Slow files

`test-cfr-pass-regressions` (~48 s) and `test-cfr-oracle-policy` (~7 s) shell
out to java-tools and CFR. `--quick` skips them and says so.

## The contract tests added by the 2026-09-08 cleanup

These pin behaviour that used to be implicit, so a later change to it is a
visible test change rather than a silent one.

| Test | Pins |
|---|---|
| `test-lib-java-tools` | All six java-tools discovery rules, including the divergence that makes `JAVA_TOOLS_DIR` not configure `serve-game-library.js`. Widening a strategy fails the test |
| `test-lib-provenance` | That the extracted digest and git helpers reproduce the six private copies exactly, and that the schema adapters keep each result file's existing key names. Also that an unavailable measurement is `null`, never `false` or `0` |
| `test-lib-offline-guard` | That a public host is refused by name before any DNS or TCP work, that loopback still connects (against a real ephemeral listener), and that `restore()` puts the process back |
| `test-lib-effective-config` | That every documented consumer file exists and still reads its variable, and that `snapshot()` distinguishes unset from set-and-empty |
| `test-config-portability` | The three configuration bug classes described in [docs/configuration.md](configuration.md), including the author-path ratchet |

## Python server suite

`apps/server/tests/test_active_piece_geometry.py` guards on two golden tables
that are gitignored and absent here (`golden-active-piece.tsv`,
`golden-rotation.tsv`). It reports them as unittest **skips**, not passes —
but a bare exit-code check would still read the run as green. Regenerate them
with `tools/oracle/ParityProbe` (needs JDK 8, which is not installed here)
before treating that suite as complete.

`golden-clear-settle.tsv` is deliberately committed, because the rule it pins
has been measured wrong twice.

## What is not tested

- No CI configuration exists (`.github/` is absent).
- No root `package.json` exists, so there is no `npm test` at the top level.
- The native applet launcher's trace oracle (`apps/launcher/assert-trace.js`)
  is not wired into any runner; it is invoked by
  `scripts/launcher/run-trace-test.sh` and needs JDK 8.
- Browser behaviour is not covered by any of these suites.

## Measurement

Measurement is not testing and is kept separate.

- **No performance figures are produced or accepted from this checkout.**
  Timing on a shared machine is invalid; see the standing rule that back-to-back
  A/B on the same tree is the only usable evidence here.
- Machine-specific numbers live in the untracked `docs/performance.md`.
- When a measurement is recorded, these distinctions must stay explicit and
  must never be collapsed: preparation vs post-start execution; cold vs warmed;
  simulation ticks vs rendered vs submitted vs presented frames; compute-only
  vs compute-and-presentation; profiled vs unprofiled; real game vs reduction;
  PCM production vs delivery vs underrun observation; per-output underrun
  duration vs wall-clock.
- An unavailable metric is reported as unavailable. Never substitute zero, and
  never compute a frame rate from a run that never rendered.
- Every result should carry the effective configuration
  (`node scripts/print-effective-config.js --json`) and the provenance record
  from `scripts/lib/provenance.js`, including the dirty state of both
  checkouts. A dirty tracked tree without its patch is not reproducible.
