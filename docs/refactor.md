# Plan: non-blocking tiered compilation, linear-memory objects, and wide Wasm

Revised: 2026-09-06.

Target: Deko Bloko logo and menu at **at least 24 fps in stock Firefox at
900 MHz**, with smooth frame delivery and low loading latency after `main()`.

Priority: correctness, then runtime smoothness, then post-`main()` loading
latency and sustained throughput. Work before `main()` is outside the
performance objective. It must still preserve program semantics.

Order: **G0 â†’ Phase 1 â†’ Phase 2 â†’ Phase 3**.

- G0 establishes whether direct linear-memory access and direct compiled calls
  offer enough headroom to pursue the architecture.
- Phase 1 establishes non-blocking tier replacement and measures its actual
  effect on loading and frame pacing.
- Phase 2 moves guest objects, references, arrays, strings, and static storage
  into a managed linear heap.
- Phase 3 widens Wasm over that model and makes tier changes reachable through
  the call paths the game actually uses.

Do not expand the old externref/import-closure Wasm model merely to throw that
expansion away in Phase 2. Preserve working tiers throughout the migration.
The worker protocol and scheduling policy are intended to survive the layout
change; individual link descriptors and backends may need extension.

## Document authority and implementation status

This is a replacement plan, not a claim that its requirements are implemented.
Its evidence is the supplied `plan-linear-runtime.md`, including its updates
through 2026-09-06, and the subsequently clarified runtime objective.
No repository checkout, benchmark, or test was rerun for this rewrite.

**Reported implemented** means the supplied document reports it as landed.
**Required** means a requirement of this revised plan, whether or not the
current implementation satisfies it. New measurement and design requirements
below are proposals, not new experimental findings.

Recorded worktree: `~/git/java-tools-slim`, branch `jit/slim-callsites`;
local mirror: `scratchpad/slim`, synchronized with rsync. These are the source
plan's locations, not a confirmation that the branch is published remotely.
The recorded full-suite baseline is 11 known failures; a clean, reproducible
baseline must identify them rather than relying on that count alone.[^source]

## 0. Governing execution and measurement contract

### 0.1 Before `main()`: preparation is free

The main thread may preload the classpath, construct metadata, prepare
executable tiers, or wait for preparation to finish. There is no performance
budget for this interval. Compiling every eligible method before `main()` is
allowed, but is not a prerequisite imposed on every execution mode.

Synchronous preparation is valid here. A worker may also start during
preparation, but moving work to a worker does not create useful overlap when
the caller immediately waits and has nothing else to do. Choose the
preparation implementation for correctness and simplicity, not for a smaller
reported startup number.

Pre-main compilation must not execute guest code in the shadow JVM or move
observable guest side effects merely to put their cost outside the clock.
Record preparation duration separately for diagnosis; never use it to excuse
a regression in the measured runtime.[^contract]

### 0.2 After `main()`: never wait for an optimization

A method executes using its best currently valid body: an existing optimized
body, a baseline body, or the interpreter. Missing optimization is not missing
executability.

The required lifecycle is:

```text
main / guest:   execute current body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ execute replacement
                                      â”‚                       â–²
                                      â”‚ enqueue / reprioritizeâ”‚ publish
                                      â–¼                       â”‚
compiler:                       compile independently â”€â”€ result ready
```

No guest invocation waits on a compiler promise, queue drain, worker startup,
`whenIdle()`, or tier-up completion. A class loaded after `main()` must not
force the guest to wait for its methods to be optimized.

A refused, stale, or failed compile leaves the current executable tier intact.
It does **not** authorize synchronous compilation on the main thread. Required
linkage, class initialization, I/O, synchronization, and other guest operations
remain semantically necessary; report their waits separately rather than
calling all main-thread work an optimization stall.

Preparation policy must test whether `main()` has started. â€œThe guest is pausedâ€
or â€œthis pass is effectfulâ€ is not sufficient permission to compile inline
once the measured runtime has begun.

### 0.3 Publication is not a stop-and-recompile operation

Compile independently, validate the result, bind it to the receiving runtime,
and publish only a complete executable replacement. Keep the old body usable
until publication succeeds. Subsequent invocations should find the new body,
including through previously warmed call sites.

Existing activations may finish in their current body. Preserve the established
deoptimization and continuation contracts. Replacing future call targets does
not, by itself, migrate a currently running loop; retain and test existing
re-entry machinery rather than claiming automatic on-stack replacement.

The old plan exempted `deopt-to-generated_sync` from its synchronous-compilation
ban. This revision permits transfer to an **already available** continuation,
not an unmeasured compile hidden inside deoptimization. Audit that distinction.
If a required continuation is unavailable, provide an executable lower-tier
continuation and request optimization asynchronously.

Do not freeze all future tier upgrades just because preparation ended. An
execution-only mode using prepared bodies is possible, but runtime optimization
must remain asynchronous whenever enabled.

### 0.4 Main-thread installation is still runtime work

The existing transport design rebuilds JS functions with `new Function` and
instantiates Wasm against main-runtime imports. That work is not made free by
calling it â€œinstallation.â€ The source's approximately 1% boot observation for
`new Function` is not a bound on any individual frame stall.[^workerdesign]

Required accounting separates worker compilation, main-thread binding,
function materialization, Wasm instantiation, and publication. Schedule
installation in measured slices rather than draining an arbitrary backlog in
one callback. An individually expensive body requires its own investigation;
yielding between bodies does not shorten that body's installation.

The contract is therefore **no waiting for optimization and no synchronous
optimizer/code-generation path after `main()`**, plus explicit control and
measurement of unavoidable main-thread installation work. It is not an
unsupported promise that publishing code consumes zero time.

### 0.5 What counts

Primary measurements are made after `main()`:

1. **Frame pacing and sustained fps**, separately during the logo and menu.
   Record frame-time distribution, p95, p99, maximum observed gap, and frames
   exceeding the approximately 41.67 ms budget corresponding to 24 fps.
   Average fps alone is insufficient.
2. **Loading latency.** Retain `postLogoToMenuMs` from the launcher:
   `firstMenuSurfaceAt - logoCompletedAt`. Also record `main()` to first menu
   surface and logo duration when instrumentation permits, so moving a stall
   into the logo cannot masquerade as a loading improvement.
3. **Optimization interference.** Record synchronous post-main compile count
   and duration, guest waits on optimization, installation costs, queue
   latency, and how long hot methods execute in their lower tiers.

The existing source defines only the post-logo loading metric and the
post-menu `--measure-fps-ms` sample. Additional clocks and frame distributions
above are required instrumentation, not measurements already available.

A worker can be worthwhile even if aggregate compilation is small: removing a
few long interruptions can improve pacing. Conversely, a worker is not a win
merely because compilation moved threads; late optimization, installation
bursts, or resource contention may worsen guest execution. Decide from paired
runtime measurements, not compile share alone.

### 0.6 Comparison rules

Use `ALTERORB_JVMJS_PREPARE_BEFORE_START=1` on every primary A/B arm. Run
worker off/on/off/on back-to-back on the same tree, with identical game input,
configuration, measurement windows, and instrumentation. Record machine,
clock policy, runtime, revision, and local changes.

The worker-off arm may retain legacy synchronous optimization as an
experimental control; it is not an exemption for the delivered runtime.
Preparation-disabled tests are useful for transport stress and equivalence,
but do not replace the primary preparation-enabled comparison.

Do not compare a new tree with yesterday's number. Do not compare profiled
and unprofiled fps. Do not treat a Node result as a 900 MHz Firefox result.
The Node launcher substitutes only for the unavailable browser experiment,
not for final browser acceptance.[^verification]

### 0.7 Historical starting point, not a freshly measured baseline

The supplied plan records 6.8â€“7.06 menu fps for the best-known JS-first browser
configuration, 171 s time-to-menu, and compiler share of 24.5% during the logo
and 0â€“2% at the menu. Preserve these as historical observations. The 171 s
wall-time measure is not the revised post-main or post-logo loading metric.
The source says the 900 MHz browser measurements were not repeated in G0.

## G0 â€” architecture experiment

### Question and method

Determine whether removing current call protocol overhead and accessing fields
and arrays directly in linear memory provides enough headroom to pursue
Phases 2 and 3. This is a kernel/driver experiment, not proof of end-to-end
24 fps.

The original experiment hand-wrote the hottest raster leaf `ck.a`, described
in `scratchpad/jsshell/bench_blit.js`, and one call-heavy per-frame driver,
`fh.a`, with direct Wasm callees. The earlier 14.1 ns/source-pixel Ion number
is historical and is not interchangeable with the later paired G0 baseline.

The original 2.5Ã— gate referred ambiguously to â€œIon's version.â€ In this
replacement its recorded pass is explicitly against the **current generated
jvm.js code running under Ion**, not against the best hand-written JavaScript.
The latter comparison did not reach 2.5Ã—.[^g0]

### Recorded result, 2026-09-06

Machine: i7-1360P with turbo, not the 900 MHz target. Runtime: SpiderMonkey
153 shell, Ion. One variant per process; raster checksums identical. Kernel
figures are medians of seven rounds, with three repeats. Artifacts are
recorded under `bench/g0-linear-runtime/`, with a README there.

Kernel: `ck.a(III[I[IIIIIIIIII)V`, the additive sprite blit behind `ck.f(III)V`.
The Node menu profile identifies it as the hottest raster leaf at 6.5% self,
using the `ssa-direct-restoring-positional` tier.

| Kernel variant | ns/source pixel |
| --- | ---: |
| jvm.js restoring-positional, plain Array, heap off | 8.5â€“9.0 |
| jvm.js restoring-positional, Int32Array, heap on | 8.5â€“8.8 |
| Hand-written JS over Int32Array | 3.5â€“3.7 |
| Hand-written Wasm, linear-memory arrays, no per-pixel imports | 1.7â€“1.9 |

Recorded ratios: approximately 4.7Ã— versus generated jvm.js and 1.9Ã— versus
hand-written JS.

Driver: `fh.a(IIZI)V`, with two table lookups, an `int[6]`, and
`ok.a([III)V` calling through `ok.b([III)V`, `ok.a(II[I[I)V`, `ok.a()V`,
`ok.a(II)V`, `ok.b()Z`, `ok.b(II)V`, `ok.c()V`, and `hk.c(IIIII)V`.
Workload: 48 elements, 640Ã—480 raster. The source driver table's values are in
**milliseconds per frame**, despite its earlier microseconds heading.

| Driver variant | ms/frame |
| --- | ---: |
| Game-linked jvm.js tiers, plain Array | 8.5â€“9.1 |
| Same tiers, Int32Array | 8.4â€“8.8 |
| Hand-written JS, direct calls, Int32Array | 2.5â€“2.8 |
| Hand-written Wasm, statics as globals, linear arrays, direct calls | 1.5â€“1.6 |
| jvm.js chain with only `hk.c` replaced by hand-written JS | 9.2â€“9.8 |

The game-linked driver uses a structured-SSA framed entry, restoring-positional
callees, and a positional-entry frame adapter for `ok.a([IIIII[I[I)V`.
Recorded ratios: approximately 5.5Ã— versus jvm.js and 1.6Ã— versus hand JS.
Replacing the span leaf alone did not improve the driver.

### Decision and limits

Proceed with the architectural direction. Preserve both targets: reduce
current tier/call overhead and make memory access/direct compiled calls
cheaper. The source identifies entry guards, `Number()|0` argument coercions,
frame adapters, static cells, and per-span protocol as remaining overhead.

Treat the 1.6â€“1.9Ã— hand-Wasm/hand-JS comparison as evidence for the combined
representation and code-generation direction, not an isolated measurement of
the object layout alone. Neither comparison proves the complete game will
meet its target, nor proves that both changes are individually necessary.
These are hypotheses to test at the phase gates.

The source reports Node menu fps of 48 with plain boot and 6.3 with
`--profile-jit`; the latter is instrumented and must not be compared with
browser fps. No new 900 MHz browser result is established here.

## Phase 1 â€” background optimization without guest waits

Goal: preserve executable code throughout optimization; remove synchronous
post-main optimizer work; improve or preserve loading and frame pacing.

### 1.1 Hotness is queue priority, not permission to execute or optimize

Use a per-method decaying score to prioritize eligible compilation work.
Credit method entries and interpreted work; tick approximately every 50 ms.
Seed eligible loaded methods and allow demand to raise their priority.
Deduplicate pending requests by method, tier, and relevant compilation state.

The reported implementation is behind `JVM_JIT_HOTNESS=1`, off by default:
`JitCompiler.recordHotness`, `hotnessTick`, and `isHotnessSelected`, with
`JVM_JIT_HOTNESS_TOP=4`, `_TICK_MS=50`, `_MIN_SCORE=1`, and
`_BYTECODE_WEIGHT=1/32`. It credits entries and interpreted bytecode bursts
through both scheduler interpreter paths. There was no existing interpreter
backedge counter; do not write the implementation as though one already
exists. Existing counters were `invocationCounts` and Wasm `st.entries`.
Tests: `test/jitHotness.test.js`, fixture `sources/HotnessProbe.java`.

**Important correction:** the first sampler changed Wasm eligibility and
caused a large regression. The classic Wasm entry/backedge gate was restored.
The sampler currently governs JS selection; it has not already delivered
loop-free Wasm eligibility. Keep this distinction explicit until a replacement
is implemented and measured.[^sampler]

Required changes:

- Do not make a hot method wait interpreted for a sampling tick when a valid
  compiled body already exists. Enqueueing never invalidates that body.
- Treat top-N and score cutoffs as scheduling controls, not permanent backend
  refusals. Eligibility and queue priority are different concepts.
- Prioritize actual demand over cold classpath seeds, and measure queue
  starvation and lower-tier execution time.
- Preserve existing successful Wasm choices until the asynchronous replacement
  is verified. Do not repeat the `va.d(I)[F` tier regression.

### 1.2 Worker architecture: shadow JVM and transportable results

The reported Node implementation consists of
`src/jit/compileWorkerThread.js` and `src/jit/CompileWorkerClient.js`.
The worker owns a shadow JVM; it must never execute guest instructions.
It loads the same classpath independently and accepts pushed metadata for
synthesized JRE stubs and array classes that the classpath cannot supply.

The browser architecture remains the original proposal: a Web Worker loads
from the same data package as the page, via the `browser-entry.js` `dataUrl`
configuration. The source documents a landed `worker_threads` implementation,
not a completed browser worker. Browser boot, message transport, and result
installation therefore remain unverified requirements.

Start worker initialization during class loading/preparation where useful.
After `main()`, readiness is asynchronous: the guest keeps executing even if
the worker is still initializing.

A compile request identifies class, method, tier, compilation options,
requester class epoch, and the initialized-class assumptions the compiler may
use. Learned call-link/PIC state needs a separately defined symbolic protocol
where compilation decisions depend on it; do not assume mirroring class ASTs
also mirrors runtime profiles.

The worker runs the existing JS renderers/compilers and returns source,
parameters, hoisted source, symbolic captures, wrapper/continuation metadata,
and provenance. Descriptors represent field sites, call sites, class guards,
static cells, sentinels, direct static targets, and restoring layouts, not
live objects or sender-specific numeric table identities.

The main runtime interns these descriptors into its own tables, reconstructs
wrappers, validates assumptions, and publishes a complete result. Do not
reparse generated JavaScript to repair foreign indices. Emit symbolic
references at the source of code generation instead.[^transport]

### 1.3 Finish symbolic transport; preserve the receiving runtime's state

The source reports symbolic conversion at these sites:

| Table | Emit sites converted | Mechanism |
| --- | ---: | --- |
| `fieldSites` | 13 | ID wrapper plus `â€¦AtSite` core |
| `directStaticTargets` | 6 | `capturedDirectStaticTarget`; `staticTarget` descriptor |
| `restoringFrameLayouts` | 2 | Registered layout; `restoringLayout` descriptor |
| `syncCallSites` | 1 | `tryInvokeSyncAtSite`; `capturedSyncCallSite` |

Do not infer that every remaining shared-ID dependency has therefore vanished.
Audit generated text, wrappers, and helper tables. The source explicitly
leaves bare indices for `directJreIntrinsics` and `checkedLeafCaptureCaches`;
earlier refusals also involved `directJreInitializationTokens` and
`inlineLoopRegions`. Establish the current status of each table before
claiming complete transport.

Shared watermark grants and fixed 512-ID strides are historical scaffolding,
not the target architecture. Remove their correctness role only after every
reachable reference is local or symbolic. Do not retain huge sparse tables
as a substitute for that audit.

`describeRegionCallSites` / `internRegionCallSites` transport a resolved target
as `{className, name, descriptor}` and resolve it on receipt.
`materializeGeneratedResult` must consume `payload.dropped`. The recorded
optional-key allowlist contains only
`jvmRestoringDirectPositionalInsertion`: losing its statement assemblers
prevents a lexical inline, and its consumer guards absence. An unrecognized
drop blocks installation; it does not silently remove required metadata.

Preserve warmed receiver state when replacing code. Call-site identity includes
opcode, target, descriptor, caller PC, and caller method; unrelated callers
must not share one PIC. The recorded warm-link mismatch is unresolved by
static-value mirroring and was almost unaffected by arrival-site aliasing.
Specify and test profile transport or receiving-side relinking rather than
repeating those rejected explanations.[^symbolic]

### 1.4 Correctness, refusal, invalidation, and deoptimization

Use dependency-specific validity checks. A moved global class epoch alone is
not a reason to reject a body with no corresponding unguarded assumption.
The reported fix stamps epoch sensitivity on the compiling JIT and applies
it to eager monomorphic linking, which is off by default. Wasm speculative
links have their own `specok` invalidation inside `bumpClassEpoch`.

Keep initialized-class assumptions valid. Re-resolve field/static targets on
the receiving thread, reset class-initialization guards for local verification,
and preserve entry checks for value-dependent speculation. Do not weaken a
real dependency check merely to improve installation counts.

**The revised refusal policy supersedes `decline() â†’ local compile`:**

- A supported but temporarily unready request can be rescheduled after the
  relevant metadata/dependency change. Prevent unconditional per-call retries.
- An unsupported compilation records a named refusal and leaves the current
  executable tier in place. Reconsider only when a meaningful capability or
  dependency changes.
- A stale result is not installed. Preserve execution, record the cause, and
  request a fresh compile when warranted.
- A transport defect is visible through diagnostics and strict test failures.
  It must not become either a silent partial installation or an inline compile.

A correctness-mandated discard is legitimate. Discards caused by avoidable
protocol defects are engineering work to remove. Neither category inherently
requires synchronous recompilation. The original statement â€œevery discard
means a main-thread compileâ€ describes the old implementation, not the desired
execution model.[^epoch]

### 1.5 Preparation, queueing, and bounded installation

The reported preparation fix compiles on the calling thread during an
`effectful` preparation pass, while seed passes during execution queue work.
Retain the pre-main benefit, but enforce the actual runtime boundary: an
inline optimization is allowed only before `main()` starts.

The runtime queue must deduplicate requests, prioritize demand, and avoid
unbounded retries. Commit class-delivery state only after a successful send.
The source's `quarantineUnsendable` bisection isolates uncloneable ASTs;
retain visible diagnostics for them rather than marking an unsent batch as
delivered. Avoid reserving ID space or other scarce state for failed sends.

Prioritize installing results that unblock hot call paths, not merely those
that arrived first. Measure installation time per body and per callback,
choose a slice budget from the target-machine frame measurements, and defer
remaining work between slices. No numeric slice budget is established by the
source, so do not present one as already validated.

Audit every post-main compile entry path, including class-load seeds,
`getGeneratedFunction`, Wasm tier triggers, refusal handling, and deopt/re-entry.
A queue that returns `null` must mean â€œcontinue executing the current tier,â€
not â€œwait until the queue emptiesâ€ and not â€œcompile locally now.â€

### 1.6 Wasm tier: asynchronous optimization without premature widening

Wasm result transport is not reported complete. The original design returns
a compiled `WebAssembly.Module` plus symbolic import descriptors instead of
shipping live import closures. Its inventory mentions 35+22+29 `addImport`
sites across field/static, dispatch, intrinsic, and bridge paths.

Keep pre-main Wasm preparation and already published Wasm bodies working.
During runtime, no missing Wasm body permits synchronous optimization.
Until a candidate's transport is supported, keep its existing valid tier and
report the limitation explicitly.

Implement the transport needed by the measured workload without using Phase 1
to widen the old object model. If missing transport causes loading or pacing
to regress, it is a Phase 1 blocker, not evidence that the sampler should
silently suppress that tier. Wider opcodes and direct linear-memory execution
remain Phase 3.

The end state is the same non-blocking lifecycle for every runtime optimizer.
A JS-only worker does not justify calling synchronous runtime Wasm compilation
â€œbackground compilation.â€

## 1.7 Verification and acceptance

Retain the synchronous in-process shadow compiler as a protocol test double.
`JVM_JIT_SHADOW_COMPILE=1` selects it; verification forces serialization;
strict mode turns silent recovery into an error; diff mode compares tier
selection; a report path records the transport census. These modes test
transport, not actual concurrency.

Required verification adds:

- Program equivalence with preparation on/off and worker on/off, including
  outputs, mutations, exceptions, and continuation behavior; real asynchronous
  tests must delay results deliberately and demonstrate continued execution.
- Refused/stale results, worker initialization delay, unsupported captures,
  method/class loading during execution, and replacement at warmed call sites.
  Assert no optimization wait and no synchronous post-main optimizer entry.
- Regression coverage for bare indices, duplicate lazy-static declarations,
  metadata drops, resume partitioning, and test-environment leakage.
- Repeated launcher A/B with preparation enabled, followed by target Firefox
  A/B. Include compilation, queue, installation, tier, and frame statistics.

The source reports only thin worker/preparation coverage because many JIT tests
set `compileWorker: false` to retain a synchronous test contract. A green suite
alone is not acceptance. The original 14-test worker gate and 3310/3310 default
mode gate both missed a real-boot timeout.[^verification]

Phase 1 closes only when:

1. There are no guest waits for optimization and no synchronous post-main
   optimizer/code-generation paths in the measured workload.
2. Installation and transport costs are visible, and repeated comparisons show
   no reproducible frame-pacing regression. Loading and sustained fps must
   improve or remain within measured baseline variation; do not trade new
   stutters for a prettier aggregate number.
3. Refusal, staleness, and tier replacement preserve executable state and pass
   equivalence tests, including realistic boot-scale cases.
4. Browser worker behavior is demonstrated, not inferred from Node.

Record any unfinished transport, test, or measurement obligation as open.
The remaining amount of post-main compilation is a workload observation, not
an architectural gate that makes optimization waits acceptable.

## Phase 1 status and immediate execution order

This table reconciles the chronological notes below using the latest supplied
entry for each topic. It does not substitute for checking the worktree.

| Work item | Source-reported state | Remaining obligation |
| --- | --- | --- |
| G0 kernel/driver experiment | Completed; substantial headroom against current generated code | Final target-machine application validation remains |
| JS hotness sampler | Implemented, opt-in; classic Wasm gate restored | Use as queue priority; test fairness and tier preservation |
| JS descriptors and result serialization | Implemented, with subsequent corrections | Finish the reachable-reference audit and required metadata coverage |
| In-process shadow compiler | Implemented | Close unresolved learned-link/tier mismatches; retain strict tests |
| Real Node worker | Implemented; real-boot defects fixed in later entries | Enforce the revised non-blocking refusal policy and audit all entry paths |
| Classpath-driven shadow loading | Implemented | Verify synthesized-class delivery and late-load behavior |
| Dependency-sensitive epoch handling | Implemented for reported cases | Test asynchronous invalidation and actual dependency coverage |
| Four primary table conversions re-index consumers and remove obsolete shared-ID scaffolding |
| Pre-main calling-thread compilation | Implemented for effectful preparation | Distinguish pre-main from any later guest pause |
| Browser Web Worker | **Verified in stock Firefox, 2026-09-06** | Protocol closed: a bundled Worker builds a JVM, takes a pushed class and returns a compile payload. Fixed a defect that made the JVM constructor impossible in a worker (`typeof window === "undefined"` used as a Node test; a Web Worker has no `window` and took webpack's truthy-but-empty `fs` stub). Remaining: boot the game in Firefox *through* the worker, and measure whether it helps there |
| Wasm result/import transport | **Underspecified callee-linking contract, not a structural blocker** | CORRECTION: an earlier entry here called this structurally blocked because `WasmJit.js`:613 refuses a method whose callee is not already compiled. That is a constraint of this code generator, not of WebAssembly, which separates `compile` from `instantiate` and resolves imports at instantiation; a `WebAssembly.Module` is also structured-cloneable to/from a worker. 1.6 already specifies the right design ("a compiled `WebAssembly.Module` plus symbolic import descriptors"), and `WasmJit.js`:3181-3182 already builds module and instance as separate steps -- both on the main thread, so module construction is main-thread compile work a worker could take today. Real remaining work: emit typed symbolic imports for supported calls; move concrete binding and callee-state mutation into a runtime linker; hold compiled callers in a pending-link queue on their existing tier until dependencies resolve. Genuinely open sub-designs: mutually recursive modules (same-module compilation or indirect calls), later callee replacement (`WebAssembly.Table` + `call_indirect`), and measuring residual instantiation/publication cost. **2026-09-06, measured**: the coupling is now demonstrated rather than inferred. With a callee kept off every compiled tier (`JVM_JIT_DENY`) and large enough that the inliner cannot absorb the call, the caller does not compile at all in 3 of 3 fresh processes: `wasmCompiled=[]`, `lastCompileError: "no compiled loop"`, `blockers: ["LateLinkCallee.callee(I)I"]`. The caller's only hot loop contains the call, that block demotes for readiness, and nothing compilable remains. With a *small* callee the inliner absorbs the call, `compiledCallee` is never reached, and the same test passes while proving nothing -- a trap worth recording. ABI specified in `docs/phase1-linked-call-abi.md`; fail-first acceptance tests in java-tools `test/linkedCallAbi.test.js`, gated behind `JVM_LINKED_CALL_ABI=1` so the default suite stays green. **2026-09-07, closed in the structured backend**: all 15 assertions pass. `staticCallImport` now lowers an UNKNOWN callee to a late-bound `lcall_` import and records the dependency as a pending link binding; the runtime resolves it. The first landing was wrong and the suite caught it: emitting the trampoline unconditionally also lowered calls that can NEVER resolve, which is the "caller that exits Wasm on every invocation" the design forbids. It is now gated on `WasmJit.staticLinkClassification`, a real three-state function; INCOMPATIBLE keeps the pre-existing refusal unchanged in message and blockers. **Pending-link registry, publication gate and recursive groups closed the same day.** `WasmJit` now records each unresolved late-bound dependency, drains exactly its own waiters on resolution, and refuses to install a module whose late-bound sites have *all* become unresolvable -- a caller that would leave Wasm on every one of those calls. The first gate was wrong and the suite caught it (structuredWasm 426 -> 424): `staticCallImport` records a binding for every static call site **before** the incompatible check that demotes the block, so a demoted site left `pending: true` with no trampoline behind it and the gate counted it as dead. Bindings now carry `lateBound`, set only on the path that actually emits an `lcall_`, and both the registry and the verdict filter on `pending && lateBound`. Recursive dependency groups needed a test rather than machinery: mutually recursive `ping`/`pong`, neither linkable at the other's codegen time, agree exactly with an interpreter arm and both reach the wasm tier. 31 assertions in java-tools `test/wasmPendingLinks.test.js`; full suite 10119 passing, 0 failures (10088 baseline + the 31 new). Still open: the trampoline is NOT mirrored in `WasmJit.compiledCallee` (it needs the structured compiler's `runNested` partial-link helper, which that backend has no counterpart for -- and neither the suite nor the browser bundle exercises that backend, so this is a decision, not an omission; see doc 11), callee replacement via `WebAssembly.Table` + `call_indirect`, and moving `new WebAssembly.Module` off the main thread. See docs/phase1-linked-call-abi.md 10-11 |
| Worker/preparation equivalence | Explicit coverage gap | Add real asynchronous and realistic workload tests |
| Post-main latency and frame-pacing A/B | Latest conclusion is an open measurement | Add instrumentation and run paired Node and browser comparisons |
| Phase 2/3 architecture | Planned; primitive slab/heap foundations exist, allocator measured | Object-slab and array-extent size-class free lists implemented with tests; neither has a caller, because 2.2 requires that reclamation wait until liveness is known. Measured stable-menu growth is 5.83 MB/min, ~3.9x the inherited figure, and it is **all primitive arrays** (`bumped`/`reused` stay 0), so 2.2's free lists must target array extents. An 8-byte extent rounding tried on the way to cross-type reuse cost +17.7% (5.83 -> 6.86 MB/min): the menu allocates ~446k arrays/minute averaging 16.1 bytes, so nearly every one paid padding. Reverted to exact sizing with alignment checked when an extent is popped; re-measured at 5.91 MB/min. This is the fixed allocator revision for the Phase 1 ABI measurement arms. **2026-09-07**: Design A chosen and implemented (docs/phase2-representation.md 7-10). Guest identity stays a JS wrapper, so the host GC supplies liveness and no collector is written: `FinalizationRegistry` gives `freeArray` its caller, default on. That makes 2.2's root inventory, safepoint coordination and relocation contract vacuous rather than skipped, and 2.5's "pause durations" a row with no collector pause to measure (the reclamation callback costs 61.2 ns, ~27 ms/min at the menu allocation rate). 2.3 closed: single `refreshViews()` hook, real `growTo` used by both exhaustion paths, and a hard guard -- `memory.grow()` silently makes an existing view zero-length, and a guest array IS a view, so growth is refused while any is outstanding; reserving 256 MB costs ~1.8 MB RSS, which is why this heap reserves. 2.4 audited: reflection, Unsafe and the JIT emitters already route through the accessors. Still open: reference fields, reference arrays, strings and static slabs are not in the heap. The reclamation A/B is **done** (2.6 row): retained growth 5.96 -> 0.27 MB/min for 0.33 fps, inside noise |

Immediate order:

1. Reproduce the clean baseline and inventory the actual local changes against
   this document. Locate the recorded launcher and benchmark artifacts.
2. Instrument the `main()` boundary, synchronous compiler entries, optimization
   waits, installation slices, frame gaps, and loading milestones.
3. Remove runtime wait/local-compile escapes while retaining the best executable
   tier; finish transport/link correctness and browser-worker coverage needed
   for the workload.
4. Run the equivalence and realistic A/B gates. Keep Phase 1 open wherever the
   runtime contract or target-browser measurements are unproven.
5. Implement Phase 2 incrementally; widen execution in Phase 3 only on the
   managed representation.

## Phase 2 â€” guest objects in linear memory with a collector

Goal: fixed-offset fields; guest references, arrays, strings, and statics in
one managed heap; complete roots; stable object identity; no unbounded live
allocation growth during a stable menu workload.

This extends the slab/primitive-array work recorded in the worktree. It is not
a claim that a complete guest heap or collector already exists.[^phase2]

### 2.1 Specify and implement the representation

Retain the original layout direction:

- Object header: class index (`cidx`, already produced by `makeObjectRef` in
  `objectModel.js`), identity hash, and monitor slot.
- Instance fields: per-class fixed offsets. Extend `slabLayoutFor` beyond
  primitive fields to references represented as i32 heap addresses.
- Arrays: header, length, then elements. Extend `wasmHeap.js` primitive-array
  support to reference arrays.
- Strings: guest objects with backing value arrays in the heap. JS strings
  exist at the JRE/JS boundary through the intern machinery, including
  `jvm.internString`.
- Static fields: one slab per class.

Before migrating consumers, write down field widths, alignment, inherited
layout, null encoding, array element representation, and reference-location
metadata needed by the collector. These are implementation requirements of
this revision, not details already specified by the source.

Keep class identity, object identity, and current heap address distinct.
A moving collector must not change the guest-visible identity hash or monitor
association. JS-side handles must continue to resolve the same guest object
after relocation.

Use one representation contract across interpreter, JS-generated bodies,
Wasm-generated bodies, allocator, and native bridge. Do not establish a second
incompatible layout merely to make one benchmark faster.

### 2.2 Allocation and GC, in that order of prerequisites

The recorded bump allocator never frees and showed approximately 1.5 MB/min
menu growth. Implement size-class free lists as the first allocation
foundation, s complete.
Free lists alone do not establish which guest objects are dead; reclaim only
when liveness is known.

Required roots retain the source inventory:

- Interpreter frame locals and operand stacks.
- Generated-body reference locals at safepoints.
- Static slabs and the intern table.
- Handles for references retained by JS-side JRE/native code.

Extend that inventory explicitly to references retained by generated-code
metadata or continuations wherever the implementation creates them. Existing
safepoint budget checks identify places to cooperate; they do not, by
themselves, specify every live reference or how to update it after movement.
Define the spill/root-map or handle contract for each tier and its adapters.

Implement stop-the-world coordination at safepoints. For compaction, update
all heap reference slots, frame/root slots, and external handles consistently.
Do not resume a body with a stale pre-move reference or a cached address whose
lifetime crosses collection without a relocation contract.

The compiler worker owns metadata, not the live guest heap. Generated results
must bind to the receiving runtime's current heap and must not carry raw
worker-world object addresses as if they were guest references.

### 2.3 Memory growth and cached views

**Closed, 2026-09-07 (docs/phase2-representation.md 9).** The hook, the audit
and the separation test are all in place, but the first requirement does not
end where this wording expects: growth is refused while any guest array view is
outstanding, because under Design A a guest array *is* a view into this memory
and `memory.grow()` makes an existing view silently zero-length -- measured, it
does not throw. A TypedArray cannot be repointed, so this is a property of the
representation, not of the implementation. Reserving instead costs ~1.8 MB RSS
for a 256 MB reservation, which is why the default heap reserves.

Allow `WebAssembly.Memory` growth once consumers re-derive their views after
growth. Keep a single view-refresh hook, as the original plan requires.
Audit interpreter helpers, generated JS, Wasm bridges, native code, and
DOM/canvas adapters for cached views.

Test view refresh and heap relocation separately: growing a memory and moving
an object are different events. Code must not mistake a refreshed view for
proof that all object references were updated.

### 2.4 Migrate the JS-side runtime through accessors

Route interpreter and JS-tier field accesses through `readField`/`writeField`
and the object-model helpers before replacing their representation. Generate
slab accesses using the same layouts, extending the existing primitive
`wasmFields` direction.

Inventory direct `obj.fields` and JS-property access in `jre-bootstrap.js`,
`jni.js`, and native implementations. Migrate package by package, keeping the
suite and guest-output equivalence as gates after each step.

JS object wrappers remain only where the JRE/JS or DOM/canvas boundary needs
handles. Wrappers are not a second authoritative copy of fields. Make handle
ownership and lifetime explicit so a native reference cannot disappear from
the collector's root set while still in use.

### 2.5 Smoothness is still a requirement

Stop-the-world GC is the collector strategy in this plan; it is not made
pause-free by the compile worker. Collection after `main()` counts as runtime
interference and must appear in frame and loading measurements.

Record allocation rate, live bytes after collection, reserved heap capacity,
collection count, and pause durations. Stable retained capacity is different
from continuously growing live data. Do not claim success because memory
merely grows more slowly or because a benchmark ends before collection.

The original Phase 2 gate records fps without requiring final 24 fps yet.
Keep that distinction, but detect and report any pacing regression immediately.
A collector that prevents growth but produces unacceptable frame gaps is not
the final performance solution; retain the evidence for Phase 3 acceptance.

### 2.6 Verification and exit gate

At each migration step, run the full suite against a reproducible baseline
and add focused tests for reference fields, reference arrays, stri, collection at generated safepoints,
and memory growth. No new failures are allowed; list each accepted baseline
failure by identity and evidence, not just â€œ11 known.â€

Deko Bloko must still boot and reach the menu. Use the recorded
`heap_check.py` harness if available, or explicitly document its replacement.
Demonstrate repeated collection with bounded live heap under a stable menu
workload, not simply a run with a sufficiently large fixed heap.

Phase 2 closes when the managed representation is authoritative, reference
roots and relocation are correct across tiers and native boundaries, memory
growth refresh is verified, and the application remains correct with measured
GC behavior. Final logo/menu fps remains Phase 3's gate.

## Phase 3 â€” widen Wasm on the managed object model

Goal: hot per-frame paths execute in Wasm end to end, are reachable from their
actual callers after tier replacement, and meet the browser performance target.
All new runtime compilation follows Phase 1's non-blocking contract.[^phase3]

### 3.1 Direct field, static, and array access

Lower heap accesses to layout-correct loads and stores, including the i32/f64
operations identified in the original plan and the actual widths required by
the representation. Remove old per-access field/static/dispatch import
closures on the converted hot paths.

Preserve required null, bounds, type, initialization, and deoptimization
semantics. The objective is eliminating avoidable representation and bridge
overhead, not dropping observable behavior.

### 3.2 Shared dispatch and reachable tier replacement

Implement the original class-index â†’ vtable â†’ `call_indirect` direction with
a shared function-table dispatch contract. Specify signatures and the
interpreter/JS/Wasm entry adapters explicitly; a common table alone is not an
explanation of how different tier calling conventions agree.

The recorded obstacle is real caller linkage: parents use
`site.fastPositional`, preventing `ck.a`, `hk.c`, `ok.b`, and `lm.a` from being
reached as Wasm callees through those paths. Publication must update or
invalidate all relevant cached entry paths so a warmed JS positional caller
can reach a newly installed Wasm body.

Distinguish â€œa method has a compiled Wasm bodyâ€ from â€œthe game executes that
body.â€ Verify both using actual per-frame execution. Preserve correct current
activations and continuations during replacement.

Use direct calls for statically resolved targets where compatible with the
invalidation policy; use the shared dispatch mechanism for dynamic targets.
Measure adapter and dispatch cost instead of assuming it disappears when
method compilation succeeds.

### 3.3 Widen supported operations

Implement the operations named in the original plan:

- String `charAt`, `length`, `indexOf`, and `equals` as Wasm helpers over heap
  character arrays; `ldc` strings as managed heap constants; inline `ldc2_w`
  constants.
- `checkcast` and `instanceof` through class-index metadata/table lookup.
- Constructor compilation once allocation follows the managed-heap protocol.
  Audit the existing `ctor-or-clinit` exclusion without conflating ordinary
  constructors with class-initialization ordering and side effects.
  **Audited.** The census now records `clinit` and `ctor` separately, which the
  fused reason made impossible. `<clinit>` stays excluded unconditionally: its
  all-or-nothing ordering is against the INITIALIZED flag, and that is the half
  the original comment was about. An ordinary `<init>` has no such flag -- a
  partial exit leaves the object as half-built as an interpreter preempted at
  the same pc -- so it becomes a candidate behind `JVM_WASM_CTOR`, off by
  default. The acceptance fixture found a pre-existing structured-SSA
  miscompile in the process (a local written only inside a catch block was
  spilled back as its entry constant); fixed, with a regression test.
- Loop-free methods as optimization candidates. This is still outstanding for
  Wasm: the earlier broad backedge-gate removal was reverted. Introduce the
  replacement under the queue-priority model and verify existing tier choices.
  **Implemented behind `JVM_WASM_LOOPFREE_WARMUP`, off by default**: a candidate
  rule (`isLoopFreeWasmCandidate`, which keeps the load-bearing opaque-control
  half of the old fused predicate closed) plus a call-count threshold, and
  admission additionally requires end-to-end coverage so no module is installed
  that would exit on the entry it was admitted for. The gate exists in two
  places -- `prepare` and the compiler's `no compiled loop` admission -- and
  opening only the first changes nothing.

Heap constants and generated references must obey Phase 2's rooting and
ralization.

### 3.4 Retain execution coverage, not silent compilation escapes

Keep JS/interpreter execution for methods the Wasm backend does not support.
Record refusal reasons and leave the current body executable. An unsupported
Wasm method does not authorize inline compilation or a wait for its replacement.

Use the refusal census, originally `wasm_flags.py`, to guide work on the
actual per-frame drivers `fh.a`, `hn.f`, `ke.k`, and `ib.l`, plus raster leaves
`ck.a`, `hk.c`, `ok.b`, and `lm.a`. Do not optimize a synthetic leaf in
isolation and declare the call-heavy driver complete.

**Done, 2026-09-07.** `wasm_flags.py` does not exist here; its documented
replacement is `scripts/wasm-refusal-census.js`, reading the census jvm.js
already writes with `JVM_WASM_CENSUS_FILE`. Collected over a boot to the menu
plus 120 s of menu: 956 methods reached the gate, **17 were installed**, and two
exclusions own 99.1% of the refusals -- `ctor-or-clinit` (153,849) and
`no-supported-backedge` (88,835). `fh.a(I)V` and `hn.f(I)V` are both in the
second, refused for having no loop, not for anything the representation work
would change. Every row is keyed by descriptor, which section 3.2/3.4's
`class.method` naming cannot be. Full reading and the two gates built from it:
`docs/phase3-wasm-widening.md`.

### 3.5 Verification and final exit gate

Require semantic equivalence across tiers, replacement through warmed sites,
collection under mixed-tier execution, and no post-main optimization waits.
Inspect both compilation census and executed-tier profiles.

On the 900 MHz stock-Firefox target, measure logo and menu separately using
`logo_session9.py` if available, or a documented equivalent. Require at least
24 fps in both, report frame distributions and GC/installation stalls, and
preserve the post-main loading objective. No result from a turbo Node or
SpiderMonkey-shell run satisfies this browser gate.

**Deferred pending hardware, 2026-09-06 (user instruction).** This browser gate
is not verifiable on the machine this work is being done on: the plan itself
records the host as an i7-1360P with turbo, "not the 900 MHz target". The gate
stays OPEN and unmet -- it must not be reported as satisfied by any measurement
taken here. Everything else in the plan proceeds; only this verification waits.

What is known so far, and its limits: the menu measures 21.63 fps mean with
99.9% of frames over the 41.67 ms budget, p50 46 / p95 50 / p99 52 ms. That was
taken in stock Firefox, so it is a real browser result, but on hardware
substantially FASTER than the target. Read it as an upper bound on target
performance, never as an 11% shortfall against 24 fps -- the shortfall on the
target class is larger by an unknown multiple, and that multiple must be
measured rather than estimated.

One approximation is available without the hardware: pinning this host's CPU
frequency near 900 MHz via frequency scaling. That approximates a clock, not a
machine class, and it needs privileges, so it is an option to be agreed rather
than assumed. It would turn an unverifiable gate into a measurable one.

The original profile objective is Wasm becoming dominant in the menu instead
of its recorded 0.4% share. Treat executed-tier share as diagnostic evidence;
fps, frame pacing, loading latency, and correctness remain the acceptance
criteria. No numeric post-main loading bound or p99 cutoff beyond the fps
frame-budget reference has been established by the source; report actual
values rather than inventing a claimed target.

## Phase 2 and Phase 3 status, 2026-09-07

Written against the worktree, not inferred from the sections above. "Declined"
means a decision with a stated reason, not an omission.

| Item | State | Note |
| --- | --- | --- |
| 2.1 specification | **done** | docs/phase2-representation.md 1-4 |
| 2.1 instance primitive fields in the heap | **done** | `slabLayoutFor` + per-class accessor prototypes; on by default in the browser bundle (`wasmFields: true`), off in Node |
| 2.1 primitive arrays in the heap | **done** | `wasmHeap.alloc`, exact-size extents |
| 2.1 reference fields / reference arrays | **deferred** | needs an address-to-wrapper mapping under Design A; see 11.2 |
| 2.1 strings with heap-backed value arrays | **declined under Design A** | a guest string is a JS `String`; re-encoding it buys wasm loads on a path no census row implicates. See 11.1 |
| 2.1 static slabs | **deferred** | implementable through `StaticFieldStore`, but trades a plain `cell.value` read for an accessor on the commoner path; count crossings first. See 11.3 |
| 2.2 size-class free lists | **done** | object and array bins, exact fit |
| 2.2 liveness and reclamation | **done, Design A** | `FinalizationRegistry`; default on |
| 2.2 roots / safepoints / relocation | **vacuous under Design A** | the host GC traces every root; nothing moves. See 10.1 |
| 2.3 growth and cached views | **done** | hook, guarded `growTo`, audit, separate growth-vs-relocation tests |
| 2.4 accessor migration | **not closed** | the gate ran and failed both representations. It found a real gap the inventory missed: `MethodHandle.js` imported the accessors but still reached guest fields by plain property access at 13 sites, which a dense (array-backed) layout loses silently -- migrated, `seldom-used-features` 23/24 -> 24/24. Still failing with dense fields: `jvm-crashes` (1), `workerEquivalence` (3). With slab fields: 6 tier-preference assertions in `jitCompiler.test.js`, pre-existing (HEAD fails 8 under the same flags) |
| 2.5 measurement series | **done except one row** | reclamation costs 61.2 ns/call, ~27 ms/min at menu rate; there is no collector pause to report |
| 2.6 exit gate | **closed for the measurement, open on one gate** | default suite green (10088, 0 failures) and the game boots to the menu, including in the browser's own heap configuration (`JVM_WASM_HEAP=1 JVM_WASM_FIELDS=1`, 33.89 fps) -- which the Node A/B arms never exercised, since they ran with the heap off. **2026-09-07, reclamation isolated**: two back-to-back arms, same allocator revision, `JVM_WASM_HEAP=1` in both, only `JVM_WASM_HEAP_RECLAIM` differing. Stable-menu *retained* growth falls from **5.96 MB/min to 0.27 MB/min** (~22x, essentially flat), with 503,657 of 1,412,141 array allocations served from free lists (35.7%) and 1,311,170 extents reclaimed. The off arm reproduces the 5.91 MB/min baseline, which is what makes the on arm believable. Cost: 33.11 -> 32.78 fps and 62.0s -> 63.5s post-logo, both inside the 1.08 fps / load-variance noise band. The earlier 3.99 MB/min figure is **withdrawn**: it was measured with `JVM_WASM_FIELDS=1` also on, and it tracked the allocation rate rather than retained footprint -- `allocated` still climbs at 3.51 MB/min in the on arm while `live` does not |
| 3.1 direct field/array access | **done for instance primitives and arrays** | statics still cross an import |
| 3.2 reachable tier replacement | **done** | `publishWasmTargetReady` invalidates `fastPositional` / `fastPositionalTargets` / `fastDynamicTarget`, called from `WasmJit` on install |
| 3.2 shared `call_indirect` dispatch | **not started** | no census row implicates dispatch; measure before building |
| 3.3 loop-free candidates | **implemented, off by default** | `JVM_WASM_LOOPFREE_WARMUP`; both halves of the gate |
| 3.3 constructor compilation | **implemented, off by default** | `JVM_WASM_CTOR`; `<clinit>` stays excluded |
| 3.3 string / checkcast widening | **declined / pre-existing** | strings follow 11.1; `checkcast` is already a backend option |
| 3.4 refusal census | **done** | `scripts/wasm-refusal-census.js`, per descriptor |
| 3.5 final browser gate | **OPEN, deferred pending hardware** | must not be reported as satisfied by anything measured here |

The single largest finding is in docs/phase3-wasm-widening.md: of 956 methods
that reached the Wasm gate at the menu, **17 were installed**, and two
exclusions own 99.1% of the refusals. Neither is about representation.

Opening both, measured back-to-back over four boots, moved the module count
from 17 to **17**. `ctor` went to zero and `no-supported-backedge` fell from 472
methods to 137, but `compilation-frozen` rose from 2,151 attempts across 6
methods to 87,829 across 24: everything the gates admitted was then refused by
the execution-only freeze, which `prepare` checks *after* them. fps moved −0.51
and +0.87 across the two pairs, inside the 0.55 spread between the two base
arms -- noise.

This inverts part of this plan's ordering claim. Phase 3's widening is not
blocked by Phase 2's representation; it is blocked by **Phase 1's** unfinished
obligation, because the freeze exists only while no Wasm result crosses the
compile worker.

Lifting the freeze in both arms isolates the gates, and produced the more
important result. Across eight boots, installed Wasm modules span **17 to 73**
(fully covered: 5 to 20) while mean menu fps spans **32.31 to 32.85** -- a range
of 0.54, smaller than the spread within the noisiest single configuration.
Quadrupling Wasm coverage changes nothing measurable.

**At the Deko Bloko menu, in Node, Wasm tier coverage is not the fps lever.**
Sections 3.1, 3.2 and 3.3 are coverage-and-crossing work, and this measures the
coverage half as inert over a 4.3x range. It does not measure the crossing half,
and it says nothing about the 900 MHz browser target, where the compute budget
is smaller by an unknown multiple. Before building `call_indirect` dispatch,
static slabs, or reference-field representation, measure where the menu frame
actually goes at the target performance class -- building coverage against a
1.08 fps envelope optimizes a variable shown not to matter here.

## Housekeeping, configuration, and reporting

The source says `browser-entry.js` ships `wasmHeap`, `wasmHeapMb`, and
`wasmFields` enabled, while the best-known JS-first 6.8â€“7.06 fps build had them
disabled. This remains an unresolved default-configuration decision. Keep
comparison arms explicit and do not silently flip defaults as part of a
compiler-worker change. Use isolated Phase 2 configuration until comparative
correctness and performance evidence supports a default change.

The recorded bundle issue is that `process.env` was empty, so browser
`JVM_WASM_*` switches were ineffective until `jit.wasm` option plumbing.
Expose and record effective browser options rather than inferring them from
shell environment variables.[^housekeeping]

Maintain a reproducible results log with revision, local diff, machine,
clock/runtime settings, preparation boundary, effective tier/heap/worker
options, input workload, instrumentation, output checks, frame distributions,
loading clocks, and named refusals. Preserve the G0 results, browser compile
shares, refusal census, and positional-link finding there; conversational
memory is not the only record.

Missing harnesses are missing evidence. The source explicitly says
`nav.py`, `profile_attach2.py`, and `gecko-logo.json` were absent from the
checkout used for Phase 1, so its Node launcher was a substitute. Confirm
availability before referring to any named script as a completed validation.

Do not commit, push, or open a PR unless asked. Rewriting this plan does not
itself authorize changing repository state.

## Appendix A â€” evidence and corrections retained from 2026-09-06

These are historical observations reported by the supplied plan. They are not
new measurements and do not override the revised requirements above. In
particular, historical total elapsed times are not the primary acceptance
metric, and historical local recompilation is not the revised refusal policy.rison, Deko Bloko to menu plus a 15 s fps window:

| Arm | Elapsed | Post-logo â†’ menu | Compiles / compile time | fps |
| --- | ---: | ---: | --- | ---: |
| Sampler off | 65.9 s | 17.7 s | 713 / 11.6 s | 49.8 |
| Sampler on, changed Wasm gate | 108.8 s | 37.6 s | 611 / 11.2 s | 50.1 |
| Sampler off, repeat | 64.6 s | Not supplied | Not supplied | 49.9 |
| Sampler on, changed Wasm gate, repeat | 113.1 s | Not supplied | Not supplied | 49.9 |

Profiling found `va.d(I)[F` moved out of Wasm and consumed 8.7% of samples in
the JS structured tier. GC rose from 8.0% to 15.0%; `jvm-core` from 4.7% to
9.0%; Wasm fell from 6.2% to 3.8%. Compiler files `ssa.js`, `WasmJit.js`,
`StructuredWasmCompiler.js`, and `wasmInline.js` gained approximately 13% of
samples in retries.

Restoring the classic Wasm gate produced 65.7 s / 49.9 fps with the sampler
off and 67.5 s / 49.9 fps with it on. The source therefore revises the
sampler's own observed cost to approximately 2 s, not approximately 45 s.

The original bad-gate run removed only 14% of compiles and 3% of compile time.
Hot methods waited interpreted for thousands of entries: `td.d(Lvl;)V` 2589,
`kj.a(II)[I` 1975. Large compiles still dominated: `client.n` approximately
0.7 s, `ia.c` 0.7 s, `td.d` 0.46 s. Preserve these as the evidence behind
â€œpriority, not main-thread deferralâ€; do not reuse bad-gate totals as the
current sampler benchmark.[^sampler]

### A.2 Shadow compiler inputs and the first capture census

The inventory found class ASTs and method lookup; class-initialization state,
epochs, and tokens; static key-to-cell resolution; site registrations; and
compile-time access to generated callee bodies. A shadow JVM could provide
metadata and compile callees, but did not have the main runtime's learned
receiver profiles or eager monomorphic links.

`resolveStaticFieldSite` needed declared static keys even when the shadow
never executed `<clinit>`. Pre-creating keys with default values for classes
reported initialized prevented unnecessary slow-path degradation. This is
not evidence that mirroring all current static values solves profile mismatch.
Wasm's compiler paths also read `jvm.classes` and constructed live import
closures, motivating a separate result/import protocol.

Generated functions gained `jvmParameters`, `jvmTier`, `jvmGenerator`,
`jvmAsynchronous`, `jvmHoistedSource`, and `jvmCaptureDescriptors`.
`describeLinkRecords`, `internLinkRecords`, and `rebindGeneratedFunction`
transported symbolic `staticCell`, `callSite`, `fieldSite`, `classGuard`, and
`sentinel` records.

The original capture-only census over 3155 game-generated bodies recorded:
5158 static cells, 3372 call sites, 923 class guards, 206 field sites, and
2044 sentinels. `test/jitCaptureDescriptors.test.js` with
`sources/CaptureProbe.java` checked that a rebound `CaptureProbe.walk` returned
the same value and mutated the receiving JVM's own static cell equivalently.
`JVM_DUMP_GENERATED_CAPTURES=1` supplied sidecars for
`JVM_DUMP_GENERATED_DIR` output. A then-current `jitCompiler.test.js` run was
reported green at 2364 tests.

**Retracted conclusion:** this census did not prove the full JS protocol
complete. It inspected captures, not bare numeric references embedded in
source or every wrapper/metadata object.[^transport]

### A.3 Multi-tier transport and wrapper reconstruction

Continuation/adaptive wrappers were closures over guarded-static-boolean
sites, field-backed array guards, item counts, and adaptive policy flags.
The renderer factored them into shared module-level factories:
`redBody`, and `attachStructuredContinuationHelpers`, driven
by `jvmStructuredSpeculation` and `jvmStructuredWrapperShape`.
`JitCompiler.buildResumeDispatcher` performed the corresponding resume work.

`serializeGeneratedResult` projected source and descriptors plus supported
scalar/array/object metadata, with tagged Set and bigint handling.
`materializeGeneratedResult` interned receiving-side records and rebuilt
wrappers using the same factories. Nonprojectable metadata was named in
`payload.dropped`; a later correction made that list enforceable.

The shadow test compiled without guest execution and verified a payload after
a JSON serialize/parse round trip. This is the project's deliberately
restricted data-transport test, not a claim that every structured-cloneable
value has the same capabilities as untagged JSON.

A roughly 170 KB `CaptureProbe.walk` payload initially dropped
`jvmRestoringDirectPositionalInsertion` (statement assemblers) and
`jvmStructuredRegionCallSites` (resolved method ASTs), preventing the original
transported body from being a region-outlining candidate. Later region-site
descriptors corrected the second omission; do not retain the earlier blanket
claim as current status.

### A.4 Full shadow routing exposed numeric IDs and profile differences

`src/jit/ShadowCompiler.js` owns a second JVM, cloned ASTs, its own
`StaticFieldStore`, and its own JIT. Recorded diagnostic switches include
`JVM_JIT_SHADOW_COMPILE_VERIFY`, `_STRICT`, `_DIFF`, and `_REPORT`.
An explicit `shadowCompile: false` was changed to override the environment
variable, after accidental recursive shadow construction exhausted the heap.

Three transport problems emerged:

1. Generated slow paths contained sender indices such as
   `helpers.getFieldAt(7, â€¦)`, `helpers.directStaticTargets[3]`, and
   `restoreDirectFrame(2, â€¦)`. The initial workaround used
   `siteIdWatermark`, `reserveSiteIdSpace`, `describeSiteTablesSince`, and
   `placeSiteTables` to share index space rather than reparsing source.
2. `directJreIntrinsics`, `directJreInitializationTokens`,
   `checkedLeafCaptureCaches`, and `inlineLoopRegions` lacked descriptors.
   `untransportableTableGrowth` refused affected results.
3. Shadow configuration could recursively create another shadow until the
   explicit-option fix above.

The then-current 2342-test compiler run reported 210 requests, 173 transported
(82.4%), and 10.8 MB of payload. Refusals: 19 without an owning class, seven
refused by the shadow compiler, four classes not mirrored, four involving
untransportable tables (three `inlineLoopRegions`, one direct-JRE pair), and
two stale on arrival. Twenty-one tests still failed in shadow mode.

The explanation that these 21 failures were caused by missing `<clinit>`
values was tested and retracted. Shipping current primitives/bigints, primitive
array contents, and opaque stand-ins for other references fixed none and
crashed at `jitCompiler.test.js:6983` when an explicit preparation returned
null. The experiment was reverted.

Aliasing arriving sites onto caller-identical receiving sites fixed one test:
2321 â†’ 2322 passing, without new failures. Its census was:

```text
Aliased: 15, none with a learned link.
Fresh: 132, comprising:
   63  no receiving site for that target
   45  matching identity, but created cold during the same placement
   11  same caller, different PC, cold
    7  different caller method, cold
    6  different caller method, linked
```

Of the 132, 108 had no warm counterpart to inherit. The remaining design
question was learned urce tentatively groups failures into warmed
methods taking generic dispatch (1176â€“1237), a checked leaf not arriving as
a function (1342â€“1346), and a null region plan (1626â€“1627). Those suspected
clusters are not established root-cause fixes or a current full-suite count.

### A.5 Resume partitioning and test-environment leakage

Two hot-call-graph-region failures were initially called pre-existing based
on a one-file working-tree backup. A clean worktree at HEAD passed 174/174,
so that baseline claim was withdrawn.

Uncommitted `ssaResumePc` dispatch wrapped a framed body in
`switch (ssaResumePc)`, leaving one approximately 58 KB group. The partitioner
only descended into oversized groups with relocatable heads, so the switch
blocked every intended cut. `partitionOversizedLinearBlocks` was changed to
descend while keeping a nonrelocatable head in place. The file returned to
174/174; the harness cut nine segments instead of zero; a same-tree nine-file
A/B removed exactly those two failures.

Separately, `test/jitCompiler.test.js` set
`process.env.JVM_PROFILE_JIT_METHODS = '1'` at module scope. Tape loaded every
test file before executing tests, leaking profiling into other JVMs. The
hot-call-graph-region guard deliberately declined under `profileMethods`, so
four tests got the async sentinel rather than a scalar. A clean HEAD worktree
reproduced those four together with two compiler-test failures when the files
ran in one process.

The newly added phase tests instead opted in per JVM with
`jit: {profileMethods: true}`; hot-call-graph tests explicitly selected false.
The option expression `options.profileMethods ?? envProfileMethods` gives the
explicit value precedence. Preserve isolated-versus-combined execution in the
baseline procedure rather than hiding environment leakage under a broad
â€œknown failuresâ€ allowance.

### A.6 Real worker: green small tests, catastrophic real boot

The real Node worker passed 14 tests and a 3310/3310 ten-file default-mode
gate, yet a real boot went from approximately 66 s to a 180 s timeout twice.
`JVM_JIT_COMPILE_WORKER_STATS=1` with five-second dumps exposed 8547 requests,
29 installed, 8467 refused, and `syncCallSites` growing from 152k to
4.4 million entries at roughly 360k additional entries per five seconds.

The source identifies four simultaneous defects:

1. **Delivery committed before send.** One uncloneable class made an entire
   344-class structured-clone batch fail, but those classes were already
   marked sent. Fix: commit only after send and bisect unsendable batches.
2. **Refusals immediately requeued.** A refused method left `inFlight` but was
   not retired, so every entry retried and the method remained interpreted.
   Historical fix: `decline()` retired it to the local compiler. Revised
   requirement: retire/deduplicate the request while retaining execution,
   without synchronous runtime optimization.
3. **Grants reserved before send.** Failed requests consumed 512 IDs in five
   tables; installation scanned the entire expanding call-site array.
   Fix: reserve after send and index sites by caller in
   `registerSyncCallSite` instead of scanning per installation.
4. **FIFO queue.** Cold class-load seeds buried running methods. Fix: demand
   priority when the sampler is off; repeated requests raise a running
   method's priority without creating duplicate jobs.

After those changes, requests plateaued at 498, `failed` was zero, and the
table stabilized at approximately 261k entries. Those are historical results
before later symbolass-epoch rejection discarded valid finished work

At the next measured stage, 498 results included 244 installed, 82 refused,
and 172 discarded on arrival, each with `class epoch moved 311 -> 312`.
Continuous class registration made the asynchronous path lose a race the
synchronous shadow compiler never encountered.

The audit found transported call sites arrived cold; field/static targets
were re-resolved locally; initialization guards started at epoch âˆ’1; and
static-boolean/array-range speculation rechecked at entry. No JS CHA
single-implementor devirtualization was found in the audited JIT. Wasm
speculative monomorphic links invalidated their own `specok` state in
`bumpClassEpoch`.

The fix made provenance epoch-sensitive only when the compiling JIT declared
an actual relevant assumption, via `stampResultProvenance`; eager monomorphic
linking was recorded as off by default after a tombracer miscompile.

Preloading alone could not stop epochs moving: array-class creation and JRE
stub synthesis also bump them, not just jar class loading. Keep precise
invalidation rather than dropping every result or disabling all checks.

### A.8 Classpath mirroring, symbolic sites, and the drop gate

The worker's independent classpath preload removed ordinary classpath-mirror
gaps. Main-thread pushes remained for synthesized JRE stubs and arrays,
with successful-send delivery accounting and unsendable-AST quarantine.

Four tables' emitted references became symbolic as listed in Phase 1.3.
Region targets gained symbolic method references. The receiver now consumed
`payload.dropped`, allowing only the documented optional insertion metadata.
The source reports `jitShadowCompile` passing 19/19 after this work.

Two miscompiles surfaced:

- `ssaLazyStaticTarget<n> is not defined`: multiple `getstatic` sites shared
  a class/field cache but retained separate variables/link records, while the
  `referenced` flag was set only when new lines were emitted. One variable
  was therefore used without its declaration.
- A transported body still called `helpers.tryInvokeSyncAt(1025, â€¦)` even
  though its symbolic `ssaLinkCallSite1025` had rebound to receiver ID 2053.
  The wrong target returned the void Symbol, which the body used as an array
  index. The metadata-drop gate did not catch an ID embedded in source.

Preserve both regressions independently of the worker. The source says both
could be reached without the worker; changing tier selection merely exposed
paths the earlier tests missed.[^symbolic]

### A.9 Preparation waited for a worker that had no work to overlap

`producerConsumer` exceeded its 2000 ms bound with the worker default-on:

| Mode | Three paired observed durations |
| --- | --- |
| Worker on, old preparation path | 2051 / 2077 / 2089 ms |
| Worker off | 1485 / 1526 / 1511 ms |

The test constructed `new JVM({classpath:['sources']})`; preparation defaulted
to true and queued all 311 methods. Every request returned `null`, then
preparation waited for `whenIdle()` while one worker booted, preloaded, and
serialized bodies. No guest work overlapped.

With `prepareBeforeMain: false`, both arms measured 1039â€“1046 ms, close to the
guest's ten `Thread.sleep(100)` operations. After moving effectful preparation
to the calling thread, worker-on was 1438/1496/1525 ms and worker-off was
1473/1497/1498 ms.

The source measured and rejected four alternate explanations:

| Hypothesis | Recorded evidence |
| --- | --- |
| Sparse-ID bloat | 311 Ã— 512 grants left roughly 160,000 slots; stride 64 versus 512 changed nothin` approximately 45â€“63; about 75 ms of a 560 ms gap |
| Duplicate compilation | Exactly 311 compiles per arm: 311 local off; on, 311 worker attempts with six refusals producing six local compiles |
| Event-loop starvation | Timer lag 83/26 ms on versus 19/13 ms off; source found no starvation |

Main-thread busy time was 671 â†’ 719 ms while idle rose 968 â†’ 1521 ms: the
main thread was waiting rather than doing substantially more work.

The `jitCompileWorker` tests subsequently disabled preparation so they still
exercised the worker. The latest source conclusion was that the amount of
post-main work remained to be measured. The revised conclusion is narrower:
measure that work **and its interference with pacing/loading**. Pre-main
waiting is allowed; runtime waiting for optimization is not.[^preparation]

## Appendix B â€” source map

All source line ranges refer to the original supplied paste, whose first line
is the shell command printing `docs/plan-linear-runtime.md`. They do not refer
to line numbers in this replacement. The evidence appendix is condensed from
that document; new contracts and implementation obligations in the main plan
are identified as requirements rather than historical results.

[^source]: Original source, lines 1â€“15: title, target, phase order, worktree, and recorded baseline.
[^contract]: Original source, lines 79â€“105 and 166â€“170: free pre-main preparation, post-main measurement, and lower-tier execution while compiling.
[^workerdesign]: Original source, lines 122â€“149: shadow-JVM worker proposal, symbolic captures, `new Function`, and Wasm instantiation.
[^g0]: Original source, lines 19â€“75: G0 method, thresholds, kernel/driver measurements, interpretation, and machine/profile limitations.
[^sampler]: Original source, lines 107â€“120 and 223â€“267: hotness proposal, implementation, regressions, and restored Wasm gate.
[^transport]: Original source, lines 269â€“346: runtime-state inventory, capture census, serialization, wrappers, and initial shadow test.
[^epoch]: Original source, lines 151â€“219, 348â€“357, and 533â€“569: initial refusal/invalidation policy and its later class-epoch correction.
[^verification]: Original source, lines 173â€“188, 359â€“488, 492â€“504, and 634â€“639: test strategy, shadow failures, baseline corrections, real-boot scale, missing browser artifacts, and coverage gaps.
[^realworker]: Original source, lines 492â€“531: landed Node worker, request storm, four defects, and first stabilized census.
[^symbolic]: Original source, lines 571â€“639: classpath mirroring, four-table conversion, residual tables, metadata enforcement, miscompiles, and coverage status.
[^preparation]: Original source, lines 641â€“692: paired preparation timings, rejected explanations, calling-thread fix, and remaining measurement.
[^phase2]: Original source, lines 694â€“740: managed layout, allocator/collector, roots, memory growth, runtime migration, and Phase 2 verification.
[^phase3]: Original source, lines 744â€“769: Wasm widening, dispatch, strings, casts, constructors, loop-free eligibility claim, hot methods, and browser gate.
[^housekeeping]: Original source, lines 773â€“781: heap flags, effective browser options, retained findings, and commit authorization.

