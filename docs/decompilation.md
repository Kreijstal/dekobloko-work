# Deobfuscation and decompilation

The pipeline that turns an obfuscated AlterOrb/FunOrb gamepack into
verifier-clean bytecode and compilable Java, and the rules for changing it.

## Stubs

`stubs/src/` resolves the legacy dependencies the gamepacks reference:

- `com.ms.awt.WComponentPeer`
- `com.ms.com.*`
- `com.ms.directX.*`
- `com.ms.dll.*`
- `com.ms.win32.User32`
- `netscape.javascript.JSObject`
- `net.alterorb.launcher.Hook`

```bash
./scripts/build-stubs.sh          # writes lib/dekobloko-stubs.jar
```

A missing `package com.ms.dll does not exist` at compile time means the stubs
jar is not on the classpath.

## The authoritative workflow: the owned decompiler

```bash
JAVA_TOOLS_DIR=... ./scripts/decompile-all-games.sh .work/games
```

Useful flags: `--game NAME`, `--jobs N`, `--resume`, `--reuse-pipeline`,
`--update-baseline`.

For every game it runs the verifier-safe generic bytecode pipeline
(`--profile none --safe-bytecode`), the JavaScript decompiler from
`java-tools/src/decompiler`, strict fallback diagnostics, ASM `BasicVerifier`
verification via `scripts/Verify.java`, and whole-game `javac` compilation
against `lib/dekobloko-stubs.jar`. Generated sources and reports land under
`.work/games/<game>/decompile-owned/`.

The per-game result row is `game, classes, sources, hard, cli, verify, javac,
status`. The frozen zero-failure baseline is
`scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv`; `--update-baseline` is the only
thing that rewrites it, and it must not be used to make a check pass.

The script fails closed on several preconditions: both checkouts must be Git
worktrees, `ripgrep` must be present, and the owned decompiler
(`java-tools/scripts/runCfr.js`) must exist.

`PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES` defaults to `1` here, because
AlterOrb gamepacks are processed as complete closed-world class corpora: every
write is visible, so the generic fixed-point proof for default-false static
sentinels is sound. Override it for partial-corpus diagnostics.

### Provenance and `--reuse-pipeline`

Each run writes `.work/games/decompilation-provenance.json` recording both
generator commits and their tracked-clean state, the invocation arguments, the
fixed pipeline arguments, and every `PIPELINE_*`, `BULK_PIPELINE_*` and
`SKIP_PIPELINE_PASSES` variable in the environment.

`--resume` refuses to continue when those generator SHAs, cleanliness, or
pipeline gates differ from the existing batch. `--reuse-pipeline` ties each
cached transformed class tree to the input-class digest, both generator commits,
the effective pass list, and the environment gates; missing, dirty or stale
stamps force a bytecode rebuild. A complete class count alone never proves
cached transformed bytecode is current
(`scripts/pipeline-cache-provenance.js`, `scripts/test-pipeline-cache-provenance.js`).

Compilation is only the **static** gate. Operand-stack bugs that a clean
`javac` cannot see appear at runtime; the launch-to-main-menu gate in
[running.md](running.md) §2 is the runtime one.

## Running the bytecode pipeline directly

```bash
JAVA_TOOLS_DIR=... node scripts/pipeline/bulk-pipeline.js <in-classes> <out-classes> [flags]
```

Bulk mode is a single Node process — roughly 25 seconds for a 343-class
gamepack. It round-trips the AST through the bytecode serializer between every
pass, which normalizes stack-map frames, label aliases and constant-pool
ordering.

### Profiles

`--profile <name>` selects a per-game JSON profile from
`scripts/pipeline/profiles/`: `armiesofgielinor`, `brickabrac`, `chess`,
`dekobloko`, `minerdisturbance`, `pixelate`, `tetralink`. The default is
`dekobloko`. Use `--profile none` for a generic runtime-safe run that loads no
game profile, and `--profile all` only when deliberately checking profile
leakage.

### Safety flags

`--safe-bytecode` enables stricter variants of a few local-splitting and
boolean-return cleanup passes. It is useful for new gamepacks where the normal
shape can accidentally create verifier-invalid bytecode. It loads no
game-specific selectors; it only asks generic passes to use extra dominance and
original-local-preservation gates.

The failure modes it fixes are generic, not game-specific:

- array/reference split passes moved only selected loads to a fresh local while
  leaving other paths that still read the original local;
- some split stores were branch targets, so inserting `dup; astore fresh` before
  the target left branch entrants without the fresh local initialized;
- concrete-object splitting rewrote uses after a conditional reassignment even
  when the reassignment did not dominate the later use;
- boolean-return DCE retargeted an identical `iconst_0; ireturn` label to an
  earlier block that had a fallthrough predecessor with another value still on
  the stack.

`--safe-bytecode` requires dominance for fresh-local uses, preserves the
original local when non-rewritten loads remain or a store is a branch target,
and refuses const-return merge targets that have fallthrough predecessors.

`--runtime-safe` is the mode used by the owned-decompiler driver. The remaining
flags are `--keep-runtime-handlers`, `--skip-cfdce`, `--skip-inline` and
`--profiles`.

### Experimental closed-world gates

These are **off by default** because reflection, native integration, or an
omitted external caller can invalidate a closed-world proof. Keep them off when
processing an incomplete class set or while investigating runtime bugs.

`--experimental-interclass-dce` (or `PIPELINE_EXPERIMENTAL_INTERCLASS_DCE=1`)
enables closed-world constant evaluation across classes. It specializes an
integer-like method parameter only when CFG stack analysis proves that every
reachable direct call site supplies the same constant; parameters modified by a
store or `iinc` are excluded. It repeats specialization, constant folding,
branch DCE and unreachable-code removal to a fixed point, so deleting a dummy
call can expose a constant argument in a callee. It stops after 16 iterations;
`PIPELINE_INTERCLASS_DCE_MAX_ITERATIONS` changes that cap.

Under the same gate, a typed-local pass folds literal `int`/`long` arithmetic,
conversions and comparisons before decompilation, removes neutral integer
operations, combines adjacent additive constants, normalizes JVM-masked shift
distances, and reruns constant-branch DCE. Decompiled `x ^ -1` becomes `~x`, and
comparisons against constants are complemented and direction-adjusted. Integer
overflow follows JVM semantics; division or remainder by zero and expressions
with alternate control-flow entries are left untouched.

Visibility rules for that analysis: non-private members of public classes remain
open, as do instance methods on non-public classes implementing platform
interfaces or extending platform callback classes. Private methods, static
methods on non-public classes, and members of ordinary non-public gamepack
classes are internal. Network-, OS- and callback-derived arguments remain
unknown.

`PIPELINE_EXPERIMENTAL_SIGNATURE_COMPACTION=1` adds a stronger closed-world
step. It removes only a contiguous trailing run of already-specialized
integer-like parameters from private or internal static methods, then rewrites
every proven direct call site; argument evaluation is preserved at bytecode
level. `PIPELINE_SIGNATURE_MAP_OUT` retains a deterministic JSON dictionary from
each old owner/name/descriptor to its new signature and the removed parameter
indexes, types and constant values. Inherited call-site owners are recorded as
aliases and resolved through the complete class hierarchy during both proof
collection and rewriting.

This gate does **not** shrink virtual or interface method families. An internal
interface could only be compacted as one coordinated family — the parameter
removable from the interface declaration and every implementation, and every
`invokeinterface`/`invokevirtual` call rewritten with them. One live
implementation, or any public/platform/callback entry, keeps the original family
signature. That extension does not exist yet.

`--allow-mutually-guarded-false-cycles` (or
`PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES=1`) enables the fixed-point
false-field proof on its own. It keeps ordinary method signatures and
constant-argument behavior, removing only static zero/false sentinel cycles
proven from the complete input corpus.

`PIPELINE_EXPERIMENTAL_UNTHROWABLE_CATCH_DCE=1` is an independently gated
source cleanup. After control-flow reconstruction, a catch of a specific checked
type is retained only when the emitted try body contains a call whose source
declaration throws that type; otherwise the catch and its synthetic
`if (false) throw (CheckedException) null;` javac-reachability anchor are both
removed. Broad `Throwable`, `Exception`, `RuntimeException` and `Error`
families stay conservative, because ordinary JVM instructions can produce them.
This favours readable, self-consistent Java over preserving an undeclared
checked exception propagated by arbitrary bytecode.

## Transform catalog

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels, protected load-bridge coalescing, stack-neutral shared forward loop-entry cloning, duplicate loop-tail suffix coalescing, constructor-only `if body; goto exit; body:` inversion, and constructor-only unreachable dead-handler tail cleanup. |
| `strip-rethrow-handlers --keep-handler-code` | Drops trivial catch-and-rethrow exception-table entries while retaining bare `athrow` sentinels. |
| `multi-entry-normalize` | Clones loop-header blocks for each forward edge so loops have a single semantic entry. Has a forward-only join splitter for fallthrough-joined CFG diamonds. |
| `coalesce-loop-load` | Folds `LOAD X; goto T2; T1: LOAD X; T2: <use X>` into `goto T1`, cleaning up the duplicate prefix multi-entry normalization tends to leave behind. |
| `dead-flag-eliminate` | Eliminates dead conditionals on proven always-false static boolean/int flags, handling both local snapshots (`getstatic flag; istore n; iload n; ifeq/ifne`) and direct tests. Full-jar discovery models guarded self-toggle writes as dependencies, so a flag like Dekobloko's `client.A` is discovered rather than hardcoded. |
| `constructor-pre-super-cleanup` | Deletes unused static boolean snapshots before constructor `super(...)` calls so a decompiler emits legal Java constructors. |
| `remove-shadowing-trivial-rethrow-handlers` | Removes duplicate exception-table entries where a pure rethrow handler shadows a later useful handler for the same protected range. |
| `inline-shared-exit-goto` | Tail-duplicates a shared exit/merge body at a goto site reached as the fallthrough of a conditional jump. |
| `cast-object-field-stores` | Inserts a field-descriptor `checkcast` before storing a locally constructed object into an object field, preserving the source type for reused `Object` locals. |
| `primitive-array-copy-loops` | Rewrites exact primitive array copy loops to `System.arraycopy` where the decompiler otherwise emits malformed enhanced-for assignments. |
| `simplify-string-length-not-compare` | Rewrites `~String.length()` comparisons only when the moved instructions are a real String receiver chain. |
| `split-array-reaching-local` | Splits polluted array locals. Under `--safe-bytecode` it requires the source store to dominate every rewritten load and preserves the original local when another path can still read it or the store is a branch target. |
| `split-concrete-object-reaching-local` | Splits polluted concrete object locals, with the same dominance and original-local preservation under `--safe-bytecode`. |
| `split-typed-reused-locals` | Splits typed reference uses into fresh locals. The late pipeline rejects a candidate when its definition can still reach an unrewritten join load around a conditional store. |
| `split-primitive-int-branch-local` | Splits polluted int loop locals only when no earlier branch can bypass the fresh-local initialization, copying the fresh value back so non-rewritten paths stay initialized. |
| `control-flow-dce` | Collapses simple goto/const-return clutter. Under `--safe-bytecode` it refuses to merge a const-return label into an earlier const-return block with a fallthrough predecessor. |
| `structured-goto-clone` | Structured cloning, including duplicate drain-header canonicalization: it retargets an earlier duplicate loop/drain header to a later canonical header when the bytecode recognizer proves both have equivalent opcode/operand windows, the same exit/alternate/tail roles, and any separate redraw tail is instruction-equivalent. The decision is made from bytecode shape only. `STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER=0` is a debug kill switch. |
| `compile-conflict-renames` | Exact owner/name/descriptor renames for Java source conflicts, expanded across override families so call sites and hierarchy members stay consistent. |

Profile-selected passes live beside them in `scripts/pipeline/`:
`eiTailClone`, `qcDoLoopTailClone`, `qkExceptionSplit`, `vlCacheJoin`,
`bParserLoopHeader`, `rasterScanlineEntryClone`, `sourceScopeLocalInit`,
`stackReceiverTailClone`, `ckClipFlag`, `pollLoopReturnNormalize`,
`retargetBranches`, `removeShadowedExceptionHandlers`,
`terminalActionExtract`, `terminalCleanupExtract`, `terminalIteratorExtract`,
`structural-select-better`. Each checks the expected local block shape before
editing; a profile entry selects a candidate site, it does not authorise a blind
patch.

## Transform development rules

1. Build a reduced Krakatau/Jasmin or javac-produced example that reproduces the
   structuring failure.
2. Compare that bytecode shape to the obfuscated bytecode.
3. Implement the smallest semantic-preserving bytecode rewrite.
4. Put class/offset selectors in JSON profile data when a fully general gate is
   too risky.
5. Re-run the marker, verifier and compile harnesses.
6. For a new gamepack, start with `--profile none`; if structuring improves
   while the verifier fails, rerun with `--safe-bytecode` and inspect the
   bytecode diff before accepting the result.

A new game profile must not change the existing baselines.

## Verification tools

**ASM verification.** `scripts/Verify.java` runs ASM `BasicVerifier` over class
files and prints a summary; `ClassesWithFails: 0` is the expected result.
`decompile-all-games.sh` builds and runs it itself.

It needs `asm`, `asm-tree` and `asm-analysis` 9.9.1. It takes each from
`$JAVA_TOOLS_DIR/lib/` when present and otherwise **downloads it from Maven
Central** into `.work/games/.owned-decompiler-tools/asm/` and caches it there.
Only `asm-tree` and `asm-analysis` are currently in `java-tools/lib`, so a first
run fetches `asm-9.9.1.jar` over the network. That is the one retained workflow
that reaches outside `127.0.0.1`; pre-seed the cache directory to keep a run
fully offline. `OWNED_DECOMPILER_SKIP_TOOL_BUILD=1` skips the `Verify.java`
build when the tools directory is already populated.

**CFR marker counting.** CFR is a dev-time comparison target, never an oracle
inside the pipeline. `scripts/cfr-marker-count.js` assembles a `.j` or takes a
`.class`, runs `lib/cfr.jar` (place it there yourself), and reports structure
markers (`** GOTO`, `Unable to fully structure code`, `lbl-1000`, `** while`).
It classifies a candidate as bad on `Exception decompiling`, invisible
parameters, uninitialised locals, a constant-guarded `** GOTO`, or a timeout
(`CFR_MARKER_COUNT_TIMEOUT_SECONDS`, default 180).

**Duplicated observable calls.**
`scripts/find-unsafe-observable-call-duplications.js` (and
`scripts/test-observable-call-duplication-guard.js`) catch tail-duplication
passes that would execute an observable call twice.

**Runtime boundary.** `./scripts/launcher/run-fake-awt-check.sh` is a separate
runtime boundary check that catches launcher/AWT/cache regressions after
bytecode or harness changes. It is not part of any decompiler oracle.

## Inspecting one class

```bash
node "$JAVA_TOOLS_DIR/scripts/jvm-cli.js" disassemble <out>/client.class --out client.j
```

That path is preferred for pipeline debugging because it uses the same
parser/serializer conventions as the transforms.

## Related class references

[dekobloko-class-map.md](dekobloko-class-map.md) classifies all 343 Dekobloko
classes and lists the inheritance families, which is usually a safer starting
point than a semantic rename.
