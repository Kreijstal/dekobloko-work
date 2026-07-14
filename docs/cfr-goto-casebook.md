# CFR GOTO Casebook

This casebook is the working model for reducing CFR `** GOTO` markers without
regressions.

> **Strategic note (2026-07-10):** the oracle-gated transform approach in this
> casebook hit a wall — the residual markers are CFR/Vineflower *heuristic*
> limits, not properties of the bytecode, and the two tools fail on *disjoint*
> method sets (swapping oracles relocates failures, never removes them). The
> long-term direction is to **own the structurer** rather than chase third-party
> decompiler quirks: a provably goto-free structurer (Ramsey "Beyond Relooper")
> plus controlled node splitting for the irreducible minority plus a conservative
> try/catch layer. That work lives in the `java-tools` repo — see
> `java-tools/docs/decompiler.md` for the design, results (443/443 residual-marker
> methods structured goto-free), and full rationale. The transforms below remain
> the record of the CFR-gated campaign.

## Workflow

1. Ingest real markers from an all-game scan.
2. Cluster by normalized CFR source shape plus bytecode risk facts.
3. If guessed labs stay clean, extract the complete real failing method and use
   that as the reduction anchor.
4. State a hypothesis and predictions before changing a transform.
5. Run the lab and compare predicted versus actual CFR/javac/verifier results.
6. Only then test the target game, sensitive games, and the all-game baseline.

## Current Baseline

The all-game baseline is generated in place under each game directory:
`.work/games/<game>/deob-safe/{out,cfr,logs}`. Run
`scripts/regenerate-goto-baseline.sh .work/games`, then
`scripts/check-goto-baseline.sh .work/games`. Historical Steel Sentinels runs
had 114 total structure markers: 97 actual `** GOTO` markers, 16
`Unable to fully structure code` markers, and one `lbl-1000` GOTO marker. The
largest historical marker sources were:

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
  --class-file .work/games/steelsentinels/deob-safe/out/se.class \
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

## Steel Sentinels Follow-Ups

Two later Steel Sentinels cases were solved by shape-based bytecode rewrites,
without class-name hardcoding.

`ji` contained an event-loop action tail:

- loop guard: `dl.f(I)Z` followed by `ifeq loopExit`
- action branch: `bipush 13; getstatic ei.ei_q; if_icmpeq actionTail`
- action tail contains the render/action call shape `q.a(IZII)V`

The production transform is `STRUCTURED_GOTO_EVENT_LOOP_ACTION_TAIL_CLONE`.
It clones the action tail to the loop exit for the conditional branch source, so
CFR no longer has to represent the shared tail as a `** GOTO`.

`wl` contained a raster row-scan continue into a shared outer header:

- source branch exits an inner loop body
- source fallthrough increments the row local by one
- the following `goto` targets an earlier outer row-scan header
- that header starts with `rowLocal <= endLocal` and has at least two skip guards
  that also increment the same row local and jump back to the header
- the row body includes the raster blend helper `vn.a(II)I`

The production transform is `STRUCTURED_GOTO_RASTER_ROW_SCAN_HEADER_CLONE`.
It clones only the bounded outer row-scan header before re-entering the row body,
not the whole scan body. This is important: cloning the whole scan body changed
bytecode but did not reduce the CFR marker. The transform is additionally bounded
by `STRUCTURED_GOTO_RASTER_ROW_SCAN_HEADER_MAX_SPAN` to avoid scanning or cloning
large unrelated methods.

## Sumoblitz Base-38 Split Loop

`sumoblitz/fs.a(String, int)` had two CFR `** GOTO` markers in a fixed-width
base-38 string encoder. The loop scans from index 19 down to 0, multiplies an
accumulator by 38, maps `A-Z`, `a-z`, `0-9`, and default characters into the
accumulator, and splits the encoded value at index 10.

The first marker came from a shared decrement/backedge tail after the split
check:

- split compare: `iload index; iconst_m1; ixor; bipush -11`
- branch target: `iinc index, -1; goto header`
- the preceding region contains `String.charAt(index)`

The second marker came from a forward length/index guard jumping directly into
the same bounded `String.charAt(index)` character-mapping body. The production
transform is `STRUCTURED_GOTO_STRING_BASE38_SPLIT_TAIL`. It first clones the tiny
decrement/backedge tail, then clones the bounded character-mapping body up to
the final `a(long, int)` write block. The gate is based on the bytecode shape
and the `String.charAt`/base-38 split pattern, not on the `fs` class name.

## Forward IINC Continue Tails

`dungeonassault/go.a(ZLec;II)` had a CFR `if (true) ** GOTO` marker in an item
option loop. Several forward entries used the same shape:

- duplicate entry: `iinc local, delta; goto header`
- canonical entry: the same `iinc local, delta` immediately before `header`
- loop body backedges already target the canonical entry

The production transform is `STRUCTURED_GOTO_FORWARD_IINC_CONTINUES`. It
retargets duplicate forward entries to the canonical increment tail and removes
only the now-unreferenced trailing `goto`. The detector requires the same local,
same increment, a forward jump to the header, and an identical canonical
increment immediately before that header; it is not gated on a game or class
name.

## Duplicate Integer Guard Aliases

`orbdefence/jl.a(IIIIIIII[II)` had a CFR `** GOTO` marker in a raster row loop.
The bytecode contained two adjacent identical integer guards:

- first guard: `const; iload local; if_icmp* exit; goto body`
- second guard: `const; iload local; if_icmp* exit`
- the loop backedge already targets the second guard

The production transform is `STRUCTURED_GOTO_DUPLICATE_INT_GUARD_ALIAS`. It
rewrites the first guard sequence into a direct jump to the canonical second
guard, removing only the duplicate operand load, compare, and immediate body
goto. The detector requires matching constants, matching local load, matching
compare opcode, matching exit target, and the body label immediately after the
second guard; it is not gated on a game or class name.

## Duplicate Forward Tails

`dekobloko/client.i(byte)` had a shared forward static-assignment tail. Two
conditional branches targeted a later duplicate tail, while an earlier identical
labelled tail already existed between the branch and target:

```text
condition -> laterTail
earlierTail:
  bipush 50
  putstatic int
  getstatic int
  putstatic int
  goto exit
...
laterTail:
  bipush 50
  putstatic int
  getstatic int
  putstatic int
  goto exit
```

The production transform is
`STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET`. It retargets the conditional
branches to the earlier identical tail when both tails have the same final
`goto` exit and the duplicated tail contains a static write. The gate is the
duplicated bytecode shape, not the `client` class name or the game name.

## Shared Render/Join Follow-Ups

Three later single-class reductions were solved by shape-based bytecode rewrites,
without game or class-name gates.

`voidhunters/uca.a(Lsg;ILrsb;Z)V` had a shared static-boolean render restore
tail. A branch on a static boolean entered a shared path shaped as:

```text
getstatic object
iconst_1
invokevirtual ... (Z)V
iload flagLocal
ifeq falseDraw
goto restore
falseDraw: getstatic object
           iconst_0
           iconst_0
           invokevirtual ... (II)V
restore:   iload savedStaticBoolean
           putstatic boolean
```

The production transform is
`STRUCTURED_GOTO_SHARED_STATIC_BOOLEAN_RENDER_RESTORE_TAIL`. It clones only this
bounded render/restore tail when the source fallthrough has the matching one-byte
static side-effect call and branch to the same restore label. Focused `uca` CFR
output dropped from 3 markers to 0, and `voidhunters` is now GOTO-free.

`zombiedawn/hi.a(ILah;BZLkk;)V` had two branches into the same small static
notification tail:

```text
const
const
invokestatic ... (II)V
goto exit
```

The production transform is `STRUCTURED_GOTO_SHARED_STATIC_INVOKE_JOIN_TAIL`.
It clones the small static invoke tail for multiple conditional refs when the
tail also has an immediate fallthrough predecessor, avoiding a shared join that
CFR rendered as direct `** GOTO` markers.

`zombiedawn/hi.e(Z)V` had an `instanceof` false path jumping into a shared loop
summary body. The production transform is
`STRUCTURED_GOTO_INSTANCEOF_SUMMARY_BODY_CLONE`. It recognizes the bytecode
shape `aload local; instanceof; ifne typedPath; goto summaryBody`, where the
summary body starts from the same local, contains further `instanceof` checks and
array counter updates, and ends at a bounded loop backedge.

`orbdefence/nk.a(IZ)V` had a stack-carried dummy branch into a later integer
compare body. The production transform is
`STRUCTURED_GOTO_STACK_CARRIED_FORWARD_COMPARE_BODY`. It clones the forward
compare body only when a local dummy branch sits between an integer-compare
fallthrough and another forward integer compare, preserving the carried stack
operands locally instead of constant-folding the dummy flag.

Focused validation after these transforms:

```text
voidhunters gotos=0
zombiedawn gotos=0
orbdefence gotos=0
```

Rejected follow-ups in this pass:

- `minerdisturbance/MinerDisturbance`: cloning the two-static-zero reset tail at
  the remaining marker regressed focused CFR from 1 to 2 direct markers.
- `escapevector/oe`: cloning the fallback collision body at the remaining marker
  regressed focused CFR from 1 to 2 direct markers.

## Ace of Skies Remaining GOTO Cases

`aceofskies/ro.a(int, boolean, int, CharSequence)` was a duplicated signed
radix parser. CFR failed because the obfuscated method contained several copies
of the same `CharSequence.length()`/`charAt(index)` parse loop and several
synthetic increment chains. Retargeting a single branch was not enough: the
method still had alternate parser bodies with the same locals.

The production transform extends `STRUCTURED_GOTO_DUPLICATE_RADIX_PARSER_LOOP`.
It recognizes the static `(int, boolean, int, CharSequence) -> int` parser shape
by bytecode facts:

- multiple `CharSequence.charAt(int)` calls
- multiple `CharSequence.length()` calls
- repeated `NumberFormatException` construction
- the obfuscation guard that stores `null` into a `String` static when the dummy
  int argument crosses its threshold

When all facts match, the transform replaces the duplicated parser body with a
canonical equivalent radix parser while preserving that dummy side effect. This
is deliberately shape-based and does not mention `ro` or `aceofskies`.

`aceofskies/l.a(Canvas, int)` was a renderer/backend selection loop over an
`sn[]`. Several capability checks jump into a shared "disable this option and
continue the outer loop" tail:

- `aload optionLocal`
- `iconst_0`
- `putfield <boolean enabled flag>`
- `iinc indexLocal, 1`
- `goto loopHeader`

The production transform is `STRUCTURED_GOTO_DISABLE_OPTION_CONTINUE_TAIL`.
It localizes conditional branches whose target is exactly that small tail,
including backward references into a previously shared tail. The loop header is
verified by the same index local and a nearby conditional branch, so the pass is
not tied to class names or game names.

Focused validation after these two transforms:

```text
aceofskies gotos=0
```

Next reductions should shrink from this lab, not from guessed source shapes.
Every proposed transform should first predict whether the method-only anchor and
its smaller slices keep or clear markers.

## Void Hunters Remaining GOTO Cases

After the current default structured-GOTO passes, `voidhunters` is down to two
GOTO markers with no baseline regressions:

```text
tw: 2 markers
```

`tw` and the now-fixed `rsb` case are related change-log cascades. The already-enabled
`STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL` removes the short shared changed-log
tails, leaving shared forward labels that start the next field-change detector.
Topology windows show labels with seven forward references and no fallthrough,
for example `tw.a(Ltv;I)V` at the next `tw_c` detector and `rsb.a(Ltv;I)V` at
the next `rsb_e`/`rsb_f` detector.

The kept reduction is a duplicate-null-XOR normalization inside
`STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL`. It detects two adjacent booleanized
null checks over the same object field, followed by `ixor` and an `ifeq` into
the false path. Because both sides load the same field from the same local,
`x ^ x` is always false. The replacement keeps one field read plus `pop` to
preserve the null-check side effect, then jumps to the false path. This reduced
`voidhunters` from 8 to 7 markers.

The `rsb` follow-up reduction is also inside
`STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL`. It clones shared instance-change
return summaries when the target shape is exactly:

```text
iload changedLocal
ifne print
goto return
print: getstatic System.out
       ldc "This instance of ... has changed"
       invokevirtual PrintStream.println(String)
return: return
```

The gate is bytecode shape and forward-reference based; it does not key on
`rsb`, `voidhunters`, or any class name. Focused `rsb` CFR output dropped from
3 markers to 0, and the full `voidhunters` baseline passed with 4 markers and
no regressions.

The fixed `amb.a(IZ)V` case is a different renderer/control-flow shape around a
duplicated boolean selector:

```text
getstatic idb_o
ifeq false
getstatic vqa_g.N
ifne maybeTrue
getstatic jkb_a
ifeq false
maybeTrue:
  getstatic fva_p
  ifeq false
  iconst_0
  invokestatic tob.g(I)Z
  ifeq false
  iconst_1
  goto join
false:
  iconst_0
join:
  istore selectedLocal
```

The production transform is `STRUCTURED_GOTO_SHARED_RENDERER_BOOLEAN_SELECTOR`.
It clones only selectors that have all of these bytecode facts:

- shared `iconst_0` false label followed immediately by `istore selectedLocal`
- immediately preceding true arm `iconst_1; goto join`
- at least three forward conditional refs into the false label
- a boolean probe shaped as `iconst_0; invoke* ... )Z; ifeq false`
- at least two static boolean guards, with one near that boolean probe
- a nearby object-field boolean gate `getstatic object; getfield Z; if<cond>`
  into the renderer probe region
- downstream use of the selected local before a static `(ZZ)V` call, allowing
  the small forward `goto` used by javac-style ternary lowering

This richer gate keeps the useful `amb` clone without matching the unrelated
false-constant selectors that previously regressed `uca`, `bea`, `roa`, and
`soa`. Focused `amb` CFR output dropped from 2 markers to 0, and the full
`voidhunters` baseline passed with 2 markers and no regressions.

Rejected approaches:

- broad `STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS=1`: focused `amb/tw/rsb`
  regressed from 8 markers to many markers because it cloned arbitrary shared
  continuations rather than just the change-log detector shape.
- broad shared-false boolean selector clone: focused `amb` dropped to 0, but
  full `voidhunters` regressed from 4 to 7 markers by creating new markers in
  `uca`, `bea`, `roa`, and `soa`, so the code was removed.
- selector clone requiring an immediate downstream `(ZZ)V` consumer: avoided
  the broad false-selector regressions but rejected `amb` because the selected
  local is consumed through a small forward ternary `goto`.
- simple `goto` trampoline collapse and tiny prelude cloning: focused
  `amb/tw/rsb` stayed at the same 8 markers, so the code was removed.
- self-compare detector normalization for `field != null && field.a(byte, field)`:
  focused `amb/tw/rsb` stayed at 7 markers, so the code was removed. It is also
  semantically stronger than the null-XOR simplifier because it assumes behavior
  of the compare method.

The next transform should focus on the remaining `tw` detector shape, not a
class-name gate and not the broad forward-continuation pass.

## Hold The Line Remaining GOTO Cases

After the current structured-GOTO reductions, `holdtheline` is down to zero
GOTO markers with no baseline regressions:

```text
sg: 0 markers
```

The fixed `dk.a(IIIBIILn;I)V` case was a duplicated dummy-guard body. The method
has an early branch on a dummy byte argument. One path performs a short
side-effect prefix, then both paths enter the same large renderer body. The
duplicated body contains a mode dispatch over an int field and calls three
renderer methods with descriptors shaped like `(Ljava/lang/String;IIII)V`.

The production transform is `STRUCTURED_GOTO_DUPLICATE_DUMMY_GUARD_BODY`. It
retargets the dummy guard to the post-side-effect shared body only when:

- the branch target is a far duplicate body
- the fallthrough prefix before the real body is short, branch-free, and contains
  an invoke side effect
- the first 32 instructions of the fallthrough body and duplicate body match
  structurally, ignoring only branch labels
- the rewrite does not cross an exception-table protected range

This is not keyed on `dk` or `holdtheline`. Focused `dk` CFR output dropped from
9 markers to 0, and the full `holdtheline` baseline passed with 5 markers and no
regressions.

The fixed `jh.a(Lhj;BF[I)V` case was a stack-boolean guard entering duplicated
raster row-scan bodies:

```text
invokestatic ...()Z
goto Lcond
Lcond:
ifne LrasterBody
return
...
LrasterBody:
  getstatic int[] pixels
  ...
  fmul/f2i blend math
  iastore
  iinc rowRemaining, -1
  ...
```

The production transforms are `STRUCTURED_GOTO_STACK_BOOLEAN_TERMINAL_GOTO` and
`STRUCTURED_GOTO_STACK_BOOLEAN_RASTER_BODY`. The first materializes the
stack-carried boolean goto into a local conditional only when the target branch
has a terminal fallthrough. The second clones the long raster body into the
branch fallthrough when the target body is structurally a pixel blend loop
(`iastore`, float blend math, and loop backedges). These are shape checks, not
`jh` or `holdtheline` gates. Focused `jh` CFR output dropped from 2 markers to
0, and the full `holdtheline` baseline passed with 3 markers and no regressions.

The fixed `sg.a(byte, long)` case was a dominated integer range around a modulo
residue. The bytecode computed `value % 157`, tested `local < 2`, and then
tested two lower bounds that are always satisfied on the fallthrough where
`local >= 2`:

```text
iload local
iconst_2
if_icmplt compute
sipush -140
iload local
if_icmple second
iconst_0
goto join
second:
  iload local
  sipush -142
  if_icmpge compute
```

The production transform is
`STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_RANGE_BRANCHES`. It replaces the
dominated compare operand loads with `nop` and the compares with direct `goto`
instructions, preserving stack balance while removing unreachable false arms.
The detector requires the local/lower-bound dominance shape and matching compute
target; it is not gated on `sg` or `holdtheline`. The full `holdtheline`
baseline now reports zero GOTO markers.

Rejected approach:

- spilling shared stack boolean conditions for `jh`: it preserved the two
  original markers and an earlier branch-materializing form increased focused
  `jh` from 2 markers to 4, so that approach was removed. The accepted
  materializer is only useful together with the raster-body localization above.
- a simple raster pixel-column advance-tail clone for `pd.a(Lhj;IIIII)V`: the
  visible marker is around a shared inner-loop advance tail
  (`iinc dest; source += scaleStep; iinc column; goto innerHeader`), but a
  branch-to-tail clone did not match the final bytecode shape and focused `pd`
  stayed at 2 markers. The remaining `pd` work likely needs a richer scaled
  image-loop transform, plus a separate transform for the large interaction
  selector in `pd.a(BZ)I`.

## Commands

```bash
node scripts/cfr-shape-db.js goto-ingest \
  --scan .work/games \
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
