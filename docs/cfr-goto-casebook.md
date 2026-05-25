# CFR GOTO Casebook

This casebook is the working model for reducing CFR `** GOTO` markers without
regressions.

## Workflow

1. Ingest real markers from an all-game scan.
2. Cluster by normalized CFR source shape plus bytecode risk facts.
3. If guessed labs stay clean, extract the complete real failing method and use
   that as the reduction anchor.
4. State a hypothesis and predictions before changing a transform.
5. Run the lab and compare predicted versus actual CFR/javac/verifier results.
6. Only then test the target game, sensitive games, and the all-game baseline.

## Current Baseline

The current all-game baseline is stored in `.work/current-goto-scan`. Steel
Sentinels has 114 total structure markers: 97 actual `** GOTO` markers, 16
`Unable to fully structure code` markers, and one `lbl-1000` GOTO marker. The
largest marker sources are:

| Class | Markers |
| --- | ---: |
| `nb` | 63 |
| `se` | 35 |
| `ji` | 10 |
| `SteelSentinels` | 5 |
| `pb` | 1 |

## Initial Categories

### Fallthrough Shared Join

Seed lab: `tools/cfr-goto-labs/fallthrough-shared-join`.

Hypothesis: CFR can fail when a small block is both a forward branch target and
a loop-internal fallthrough continuation. Cloning the forward entry while leaving
the fallthrough block in place should clear the marker if stack/local effects are
neutral and there are no externally referenced inner labels.

Required gate before any production rewrite:

- target block has a fallthrough predecessor
- at least one forward branch also targets the block
- cloned block has no exception overlap
- cloned block has no external inner-label references
- stack effect is known and compatible with both entries
- branch/fallthrough counts improve under bytecode facts before running CFR

### Nested Sentinel Loop

Seed lab: `tools/cfr-goto-labs/nested-sentinel-loop`.

Observed source: Steel Sentinels `se`. The current casebook cluster has 29 plain
`** GOTO lbl#` markers in `se`, plus five conditional sentinel markers shaped
like `if (array[row][col] == 255) ** GOTO lbl#`.

Hypothesis: the repeated failure is not the array store itself. It is a nested
decode-loop control-flow shape: shared inner and outer loop headers, sentinel
rewrites, and multiple side exits that advance an index before jumping back into
the same headers.

Current status: `before.j`, `candidate.j`, and `after.j` are all clean. This is
a useful failed prediction: the obvious nested sentinel loop shape alone is not
enough to trigger CFR. The missing ingredient is likely a more exact bytecode
entry pattern from `se.class`, not the source-level loop itself. Do not write or
broaden a production transform for this category until a marker-producing
reduction exists.

### Steel `se` Shared Decode Headers

Seed lab: `tools/cfr-goto-labs/se-shared-decode-headers`.

Observed bytecode source: first decode block in `se.class`, around bytecode
labels `L583` and `L687`. This is closer than the source-level nested sentinel
lab: it keeps the obfuscated `ixor` comparisons, row-length check, sentinel
rewrite, side exits, and repeated jumps back to the shared inner/outer headers.

Actual result: `candidate.j` is clean. This falsifies the local-header-only
hypothesis. The reducer must keep still more surrounding `se` bytecode, or the
missing ingredient is metadata/region interaction absent from the lab.

New bytecode-window evidence:

```bash
node scripts/cfr-shape-db.js bytecode-windows \
  --class-file .work/current-goto-scan/steelsentinels/out/se.class \
  --limit 6
```

The highest-risk `se` windows are repeated labels with four backward incoming
branches plus fallthrough, for example inner-loop headers around bytecode PCs
`6971`, `3355`, and `2562`, and outer-loop headers around `6866`, `3251`, and
`2458`. That differs from the first successful fallthrough-shared-join lab,
which has a forward entry plus fallthrough. The next reduction should model
multi-backedge shared headers, not only forward shared joins.

### Multi-Backedge Shared Header

Seed lab: `tools/cfr-goto-labs/multi-backedge-shared-header`.

This lab isolates the bytecode-window shape above: one loop header with
fallthrough plus four backward entries. It stays clean under CFR, so the
casebook treats `incoming=4 + fallthrough` as only a weak risk feature, not a
sufficient rewrite trigger. The unresolved ingredient is likely in the larger
surrounding region, CFR block sorting, or interleaved side exits from the real
`se` method.

### Real `se.a(I[B)V` Anchor

Seed lab: `tools/cfr-goto-labs/real-se-a-bytearray`.

This lab is generated from the real Steel Sentinels `se.class` disassembly by
keeping only the complete failing method `a(I[B)V` and class-level fields. It
preserves the CFR failure: the method-only lab emits 35 markers, the same count
as the full `se.java` source. This is now the reduction anchor for `se`.

The first bounded reducer pass produced `reduced.j`: 3810 lines shrank to 3650
lines while preserving 28 markers. That is not yet a small reproducer, but it
confirms the real-method reduction loop can delete irrelevant regions without
losing the failure.

The second bounded pass produced `reduced2.j`: 3650 lines shrank to 3202 lines
while preserving all 28 remaining markers from `reduced.j`.

The third bounded pass produced `reduced3.j`: 3202 lines shrank to 2786 lines
while still preserving all 28 markers.

The fourth bounded pass produced `reduced4.j`: 2786 lines shrank to 2626 lines.
The marker count dropped from 28 to 26, which means the reducer has started
crossing individual marker-producing regions while still preserving the broader
failure.

The fifth bounded pass produced `reduced5.j`: 2626 lines shrank to 2482 lines
while preserving 26 markers. `cvise` and `creduce` were not installed at that
point, so this used the local Jasmin label-block reducer.

The sixth bounded pass produced `reduced6.j`: 2482 lines shrank to 2130 lines
while preserving 26 markers. After this pass, `cvise-git` was installed
successfully (`cvise 2.12.0 (64ff7de)`), so future reductions can use C-Vise
with the same assemble+CFR interestingness predicate.

The first C-Vise run used `scripts/cfr-goto-interesting.sh` and
`tools/cfr-goto-labs/jasmin-cvise-pass-group.json`, reducing `reduced6.j` from
2130 lines to 674 lines while preserving CFR structure markers. The run hit the
outer timeout during cleanup, but the saved testcase still passes the
interestingness predicate and is stored as `reduced7.j`.

The second C-Vise run used the same Jasmin pass group with
`CFR_GOTO_PATTERN='== 255.*\*\* GOTO'`, reducing `reduced7.j` from 674 lines to
45 lines while preserving a conditional sentinel GOTO. This is stored as
`reduced8.j` and is now the smallest marker-producing `se` specimen.

Variant evidence from `reduced8.j`:

- replacing the first always-taken compare with a direct forward `goto` keeps
  the marker
- making that first compare fall through clears the marker
- replacing the loop backedge with `return` clears the marker
- changing array-store details or seeding local 7 does not clear the marker

That falsifies the literal sentinel-compare hypothesis. The stronger model is a
forward entry into a short loop-body tail that is also reached from a backward
loop edge. A first bytecode transform for this exists in `structuredGotoClone`,
but it is deliberately gated by definite local assignment at the forward source:
on the minimized invalid-local specimen, cloning clears `** GOTO` but turns the
CFR result into a hard "Exception decompiling" failure. The pass must therefore
only clone when the copied tail's read locals have prior stores before the
forward branch source.

A later C-Vise run restarted from `reduced7.j` with an oracle that rejects CFR
hard failures and the degenerate `if (true) ** GOTO` / constant-compare GOTO
collapse. It reduced the case to 48 lines as `reduced9.j`, preserving
`Unable to fully structure code` and CFR's malformed `** while (true)` output.
This is a better transform seed than `reduced8.j` because it avoids the
constant-true source artifact while keeping a real forward-entry/backedge loop
region.

Handwritten variants on `reduced9.j` show that direct edge retargeting can clear
the marker but is not behavior-preserving. The first behavior-preserving-looking
clearing variant is a one-shot preheader flag: initialize a fresh int flag before
the preheader jump, retarget that jump to the outer header, and have the outer
header consume the flag once to jump to the original update block. CFR then
emits a structured `if (!flag) { ... } else { flag = false; update; }` loop
instead of `** while (true)`. This is the current best production-transform
hypothesis, pending a strict structural gate and regression scan.

The first experimental pass is gated behind
`STRUCTURED_GOTO_ONESHOT_PREHEADER=1`. It rewrites `reduced9.j` into
`reduced9-after.j`, which CFR decompiles with zero structure markers. Keep this
flag disabled by default until it has been tested on larger `se` reductions and
an all-game regression scan.

Testing on `reduced7.j` showed the first broader version can match and rewrite a
simple update-entry candidate, but it does not reduce marker count; it leaves
one `Unable to fully structure code`, four `** GOTO`, and one `** while`. Use an
oracle/selector around this pass before applying it to real game outputs:
candidate output must reduce marker count and must not introduce CFR hard
failures or constant-true GOTO artifacts.

Next reductions should shrink from this lab, not from guessed source shapes.
Every proposed transform should first predict whether the method-only anchor and
its smaller slices keep or clear markers.

## Commands

```bash
node scripts/cfr-shape-db.js goto-ingest \
  --scan .work/current-goto-scan \
  --game steelsentinels \
  --tag baseline-374

node scripts/cfr-shape-db.js goto-clusters --game steelsentinels --limit 20

node scripts/cfr-goto-lab.js run tools/cfr-goto-labs/fallthrough-shared-join

node scripts/cfr-real-method-lab.js extract \
  --j .work/cfr-goto-reduce/steelsentinels/se.j \
  --method a \
  --descriptor '(I[B)V' \
  --out tools/cfr-goto-labs/real-se-a-bytearray \
  --category real-se-a-bytearray
```
