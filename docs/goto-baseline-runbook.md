# GOTO Baseline Runbook

This doc is the canonical guide for regenerating and validating CFR GOTO baselines.

## Purpose

The deobfuscation pipeline can produce `** GOTO` markers and `Unable to fully structure code` markers in CFR output. We track those as a regression budget per game under

- `.work/games/<game>/deob-safe/logs/cfr-markers.txt`

and compare against checked-in expected baselines.

## Required repositories and files

- `dekobloko-work` (this repo)
- `java-tools` (required by `scripts/pipeline/bulk-pipeline.js`)
- `lib/cfr.jar`
- a populated `.work/games` tree with game classes (at minimum `<game>/classes`)

Nothing else is required to run the baseline scripts.

## Scripts involved

- `scripts/regenerate-goto-baseline.sh`: runs bytecode pipeline + CFR on each game and writes:
  - `.work/games/<game>/deob-safe/out`
  - `.work/games/<game>/deob-safe/cfr`
  - `.work/games/<game>/deob-safe/logs/pipeline.log`
  - `.work/games/<game>/deob-safe/logs/cfr.log`
  - `.work/games/<game>/deob-safe/logs/cfr-markers.txt`
- `scripts/check-goto-baseline.sh`: validates current markers against:
  - `scripts/EXPECTED-GOTO-ALL-GAMES.tsv` (upper bounds)
  - `scripts/EXPECTED-GOTO-FREE-GAMES.txt` (games expected to have `0` goto markers)
- `scripts/analyze-goto-pass-impact.js`: identifies which pipeline pass increases `** GOTO`
  markers on a class set by running pipeline incrementally and counting CFR markers.

## Commands

Run across all games:

```bash
./scripts/regenerate-goto-baseline.sh .work/games
./scripts/check-goto-baseline.sh .work/games
```

Tune timeouts if needed:

```bash
PIPELINE_TIMEOUT_SECONDS=1800 CFR_TIMEOUT_SECONDS=600 ./scripts/regenerate-goto-baseline.sh .work/games
```

Run just one game for faster iteration:

```bash
./scripts/regenerate-goto-baseline.sh .work/games/<game>
./scripts/check-goto-baseline.sh .work/games/<game>
```

When the baseline regresses and you need to attribute the increase to a pass:

```bash
node scripts/analyze-goto-pass-impact.js .work/games/<game>/classes --sample-classes 12 --max-passes 40
node scripts/analyze-goto-pass-impact.js classes-original --sample-classes 12 --max-passes 80 --json > /tmp/impact.json
```

> `check-goto-baseline.sh` expects markers for listed games. If a game is
> missing (`deob-safe/logs/cfr-markers.txt` absent), it reports regression.

## Check output interpretation

`check-goto-baseline.sh` prints one line per game:

- `REGRESSION` when any of `gotos`, `unable`, `classes` exceed baseline bounds.
- `improved` when all three are below baseline bounds.
- separate “expected 0 GOTO markers” section for games listed in `EXPECTED-GOTO-FREE-GAMES.txt`.

Exit code is non-zero if any regression exists.

## Repair phases

`regenerate-goto-baseline.sh` runs three oracle-gated repair phases after the
initial pipeline+CFR pass, each re-running only the classes that still carry
markers and accepting a candidate only when the CFR marker oracle confirms it
improves (`accept_repair_candidates`: direct gotos must not increase, total
markers must decrease, and the candidate must not trip the bad-output detector
in `scripts/cfr-marker-count.js` — e.g. `Exception decompiling`):

1. **Source-scope round** (`GOTO_SOURCE_SCOPE_REPAIR_PHASE`): per-class rerun
   with `BULK_PIPELINE_SCOPE_ANALYSIS_TO_SELECTED=1`.
2. **Early-CFR-oracle round** (`BULK_PIPELINE_EARLY_CFR_ORACLE_*`): batch rerun
   over the current output.
3. **Gates-off round** (`GOTO_GATES_OFF_REPAIR_PHASE`): per-class rerun from raw
   classes with the broad structured-goto preserve/skip shape gates disabled
   (`BULK_PIPELINE_DISABLE_BROAD_PRESERVE_GATE=1`,
   `BULK_PIPELINE_DISABLE_SKIP_BROAD_GATE=1`) and full analysis scope. The gates
   trade transform quality for speed and can false-match classes the full
   pipeline decompiles far better; this round recovers those classes while the
   oracle rejects any candidate that merely trades goto markers for methods CFR
   cannot decompile at all.

## Bytecode validity: exceptions are tracked, not just markers

The `** GOTO` / `Unable to fully structure code` markers only count methods CFR
decompiled *badly*. A method CFR cannot decompile *at all* is emitted as an
`Exception decompiling` stub carrying **zero** GOTO markers, so a goto-only
budget silently rewards leaving a class undecompilable. Some transforms could
lower a class's goto count precisely by producing bytecode CFR (and the real JVM
verifier) reject — an invisible regression under the old metric.

The baseline now measures real decompile breakage as well:

- `regenerate-goto-baseline.sh` writes `.work/games/<game>/deob-safe/logs/cfr-exceptions.txt`
  (grep of `Exception decompiling` over the CFR output).
- `check-goto-baseline.sh` reads it as a fourth per-game count and treats an
  increase as a `REGRESSION`. `EXPECTED-GOTO-ALL-GAMES.tsv` carries a fifth
  column, `exc`; rows without it (older baselines) are not enforced on exceptions.
- Check lines and the summary now print `gotos/unable/classes/exc`.

### Transform stack-safety (why exception counts stopped drifting)

Three mechanisms keep goto-eliminating transforms from producing bytecode CFR
cannot decompile. All are shape-gated (no class/game hardcoding) and only act on
*new* problems relative to the class as loaded, so pre-existing analysis quirks
never trigger a false revert:

- **Orphan-load guard** (`bulk-pipeline.js`, `BULK_PIPELINE_ORPHAN_LOAD_GUARD`):
  reverts a pass whose save introduces an `aload` of a slot that is never stored
  and is `>=` the parameter count — a use-before-assignment the JVM verifier
  rejects and CFR reports as `IllegalStateException` (uninitialised local read).
- **Stack-underflow guard** (same chokepoint): CFG stack-depth abstract
  interpretation; reverts a save that makes a reachable instruction pop below the
  available depth (`ConfusedCFRException: … Stack underflow`).
- **`removeUnreachableCodeCfg`** (java-tools pass, post-final): nops JVM-unreachable
  instruction islands that earlier passes can strand; CFR simulates them and dies
  on their stack underflow even though the verifier ignores them.

The root cause of most orphan loads was fixed at source in the
`castReferenceArrayAssignmentsToDeclaredTypes` alias-collapse (liveness gates so
it never orphans an off-window reference). `materializeConditionalIntConstantCompareBounds`
now declines shared multi-way selector joins it does not solely own (rewriting
one branch of a shared join left the other paths a stack short). Cases the
transforms still cannot make valid are left untouched by the guards — a preserved
goto is strictly better than an undecompilable method.

## Latest all-games rerun (2026-07-09, authoritative)

Ran with:

```bash
PIPELINE_TIMEOUT_SECONDS=1800 CFR_TIMEOUT_SECONDS=600 ./scripts/regenerate-goto-baseline.sh .work/games
./scripts/check-goto-baseline.sh .work/games
```

Result:

- **23 GOTO markers across 12 games, 23 unable markers, 186 decompile exceptions.**
- `scripts/EXPECTED-GOTO-ALL-GAMES.tsv` (now 5 columns incl. `exc`) and
  `scripts/EXPECTED-GOTO-FREE-GAMES.txt` were regenerated from this run's
  `cfr-markers.txt` / `cfr-exceptions.txt`, so expected == got by construction.
- 32 of 44 games are GOTO-free.

Residual GOTO-bearing games from this run (goto / unable / classes / exc):

| game | gotos | unable | classes | exc |
|---|---|---|---|---|
| voidhunters | 5 | 3 | 1 | 9 |
| orbdefence | 4 | 3 | 1 | 3 |
| dekobloko | 2 | 3 | 1 | 3 |
| starcannon | 2 | 1 | 1 | 3 |
| steelsentinels | 2 | 1 | 1 | 2 |
| wizardrun | 2 | 1 | 1 | 3 |
| arcanistsmulti | 1 | 1 | 1 | 8 |
| minerdisturbance | 1 | 1 | 1 | 3 |
| terraphoenix | 1 | 3 | 1 | 6 |
| vertigo2 | 1 | 1 | 1 | 8 |
| virogrid | 1 | 3 | 1 | 5 |
| zombiedawn | 1 | 1 | 1 | 3 |

### Verified against the committed baseline: gotos AND exceptions both dropped

The prior committed `EXPECTED-GOTO-ALL-GAMES.tsv` (216 gotos, no `exc` column)
was stale. To prove this run is not trading gotos for undecompilable methods, the
true committed HEAD pipeline (all transform + regen scripts at `HEAD`) was rerun
on the decision-critical games and compared to this run on **both** axes:

| game | HEAD goto/exc | this run goto/exc | Δgoto | Δexc |
|---|---|---|---|---|
| steelsentinels | 44 / 9 | 2 / 2 | −42 | −7 |
| armiesofgielinor | 58 / 11 | 0 / 4 | −58 | −7 |
| holdtheline | 20 / 12 | 0 / 7 | −20 | −5 |
| zombiedawn | 19 / 7 | 1 / 3 | −18 | −4 |
| voidhunters | 5 / 21 | 5 / 9 | 0 | −12 |
| orbdefence | 5 / 6 | 4 / 3 | −1 | −3 |
| minerdisturbance | 2 / 2 | 1 / 3 | −1 | +1 |
| arcanistsmulti | 0 / 12 | 1 / 8 | +1 | −4 |
| starcannon | 0 / 8 | 2 / 3 | +2 | −5 |
| terraphoenix | 0 / 7 | 1 / 6 | +1 | −1 |
| dekobloko | 0 / 8 | 2 / 3 | +2 | −5 |
| **total** | **153 / 103** | **19 / 54** | **−134** | **−49** |

Across these games the pipeline removes **134 gotos and 49 exceptions** — strictly
better on both metrics. The four games that gained a goto (`arcanistsmulti`,
`starcannon`, `terraphoenix`, `dekobloko`) each *shed* exceptions: the transforms
now emit a readable `** GOTO` in place of an `Exception decompiling` stub, which
is the correct trade (a goto is readable; a stub is a lost method). A separate
`HEAD`-vs-working transform-only A/B (same regen script, only the two transform
files varied) confirmed the transform changes alone reduce exceptions in 4 of 5
sampled games, so the goto reduction does not come from hiding methods as
exceptions.

Sampling **goto-free** games (no gotos to eliminate, so the delta is pure
decompile quality) shows the same direction — working-tree emits fewer
`Exception decompiling` stubs than `HEAD`: aceofskies 8→7, tombracer 17→8,
kickabout 14→7, brickabrac 13→6. The 186-exception total is therefore not an
artifact of this run; the prior committed pipeline produced *more* undecompilable
methods — they were simply never measured before the `exc` column existed.

## Incremental update (2026-07-10): node-splitting repair phases clear 3 games

Three new shape-based, oracle-gated repair phases drive the total from
**23→19 GOTO markers** and **12→9 residual games** — starcannon, virogrid, and
zombiedawn now decompile GOTO-free, each with exceptions unchanged (no
goto→undecompilable trade). `EXPECTED-GOTO-ALL-GAMES.tsv` /
`EXPECTED-GOTO-FREE-GAMES.txt` were regenerated for those three; all other games
are unchanged.

| game | before (g/u/c/e) | after |
|---|---|---|
| starcannon | 2/1/1/3 | 0/0/0/3 |
| virogrid | 1/3/1/5 | 0/0/0/5 |
| zombiedawn | 1/1/1/3 | 0/0/0/3 |

The common principle is **node splitting (tail duplication)**: redirecting a
control-flow edge to a byte-identical copy of its target block can never change
semantics (the clone is entered by the same jump, with the same stack state), so
it is always sound; it only removes a join/multi-entry so the decompiler can
find structure. Every phase below is gated by the existing
`accept_repair_candidates` CFR oracle, so a split is kept only when it strictly
reduces markers, and a class it does not help is left untouched.

- **`loop-guard-entry-split`** (java-tools `src/passes/loopGuardEntrySplit.js`,
  CLI `jvm-cli.js loop-guard-entry-split`; phase
  `GOTO_LOOP_GUARD_ENTRY_SPLIT_REPAIR_PHASE`). A loop entered at its guard test
  from outside by an unconditional `goto`; tail-duplicates the guard block so the
  loop becomes single-entry. The provably-sound form of the rotation path
  `multiEntryLoopNormalizer` leaves disabled (`isSmallGuard = false`). Clears
  **starcannon**.
- **`multi-entry-normalize` repair phase** (`GOTO_MULTI_ENTRY_NORMALIZE_REPAIR_PHASE`):
  re-runs the existing multi-entry loop-header cloner standalone on residual
  classes. It over-splits most classes (oracle rejects those) but clears
  **virogrid**.
- **`goto-oracle-split`** (dekobloko `scripts/goto-oracle-split.js` driving
  java-tools `src/passes/tailDuplicateJoin.js`; phase
  `GOTO_ORACLE_SPLIT_REPAIR_PHASE`, `GOTO_ORACLE_SPLIT_MAX_ITERS`). A
  CFR-oracle-guided greedy search: enumerate every join/loop-guard with a
  jump predecessor, tail-duplicate one, ask CFR whether markers dropped, keep the
  best, repeat. Candidates are confined to the methods CFR actually marks (parsed
  from CFR output) to stay tractable. Clears **zombiedawn**. Runs last (it is the
  slowest phase — CFR is in its loop).

### Remaining 9 residual games and why they resist

arcanistsmulti, dekobloko, minerdisturbance, orbdefence, steelsentinels,
terraphoenix, vertigo2, voidhunters, wizardrun. The node-splitting phases only
clone **straight-line** join bodies (optionally with a single leading guard
conditional). The residuals in these games are joins whose bodies contain
**internal control flow** (nested `if`/loops — e.g. minerdisturbance `lbl718` is a
4-source join whose body is a nested `if`), or irreducible loops needing rotation
rather than join duplication. Cloning those correctly needs a region cloner with
dominator analysis (clone a multi-block single-entry region, rename internal
labels, preserve external exits) — a larger, correctness-sensitive transform not
yet built. `goto-oracle-split` is the right driver for it once that region-clone
primitive exists.

## Notes

- The runbook intentionally avoids creating root-level `.work/*` scratch folders.
  Keep per-game artifacts under `.work/games/<game>/...` only.
- `cfr-markers.txt` is the authoritative input for both baseline files and any
  future regression diffs.
