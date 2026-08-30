# Firefox GeoBlox performance investigation

This log records measured hypotheses so unsuccessful optimizations are not
repeated. GeoBlox names below identify profile locations only. Runtime policy
and optimizations must remain structural and game-independent.

## Measurement rules

- Classes are the same 353 class files produced by `javac.js`.
- HotSpot and browser comparisons use those same class files.
- Browser tests run through the Git-cloning page and its cloned `jvm.js`.
- The main menu is visually confirmed before clicking Instructions.
- A run samples 30 one-second windows after the click.
- Idle windows are excluded. Transition work is not idle and remains part of
  the floor measurement.
- Average FPS cannot establish success when active valleys remain below the
  target. The current target is a roughly 40 ms maximum non-idle frame gap
  (about a 25 FPS instantaneous floor).

## Established evidence

The Java workload is not inherently a 2--5 FPS workload. HotSpot presents
approximately 149--151 frames per second with the same `javac.js` classes.
Its CPU profile is dominated by useful raster work:

- `dm.b([I[IIIIIIII)V`: 67.03% self time
- `dm.a([I[IIIIIII)V`: 8.94% self time
- `vb.c()V`: 5.08% self time

The original Chromium browser profile instead spent 52.2% in JVM
dispatch/scheduling and 29.4% in generated guest JavaScript. Canvas upload was
only about 441 ms over 30 seconds and was not the primary bottleneck.

Keeping imported-array raster loops and their same-class wrappers in
JavaScript improved Chromium from 5.09 to 18.24 FPS, with a measured 10.94 FPS
active floor. Firefox does not optimize the same generated code nearly as
well.

The Firefox Instructions screen was visually confirmed. Its initial overlay
showed about 2.2 FPS. Two clean runs with the scheduler cap alone measured
8.14 and 7.41 FPS average, 3.96 FPS one-second-window floors, and maximum
continuously active gaps of 583 and 524 ms.

Native samples inside a later exact 754 ms profiled valley showed 584 samples
under the structured-SSA generator continuation wrapper. The stacks repeatedly
resumed nested `kj`, `ad`, and `kl` generated methods. Enabling the existing
generic compiled-call-chain tier converts verified non-recursive call graphs
to ordinary JavaScript activations. Initial clean runs measured maximum active
gaps of 483 and 447 ms. A corrected harness that moves its confirmation
screenshot after diagnostics measured 456 and 492 ms at multiplier 100, with
one-second floors of 8.91 and 7.33 FPS. The conservative retained maximum is
therefore 492 ms, equivalent to a 2.03 FPS instantaneous floor. Neither the
one-second nor exact-gap 10 FPS target is complete.

Later exploratory runtime builds reached roughly 7.6 FPS average, but their
clean maximum active presentation gaps were 655--760 ms. They therefore fail
the floor objective and are not evidence of a completed performance fix.

## Retained changes

| Commit | Result | Reason retained |
| --- | --- | --- |
| `0cc3471` | Chromium 5.09 -> 7.88 FPS | Avoids Wasm-to-JS crossing for every imported array element. |
| `f4c97e6` | Chromium 7.88 -> 16.94+ FPS | Keeps a wrapper and its raster callee in one JS locality chain. |
| `a7dcb21` | Firefox average approximately 3.50 -> 4.66 FPS in its measured run | Gives the AWT producer a bounded structured quantum instead of repeatedly reconstructing a slow frame. |
| `1059a0f` | Firefox approximately 3.63 -> 4.29 FPS | Recognizes the structurally verified javac.js transparent-blit lowering. |
| `2b7052f` | Firefox approximately 4.29 -> 5.06 FPS | Replaces redundant per-row bounds validation with an equivalent constant-time proof, retaining an overflow fallback. |
| `3eb8e9e` | Firefox 5.06 -> 6.30 FPS average; one-second floor 3.91 FPS | Keeps small acyclic reference-field cursor helpers in positional JavaScript instead of scheduling every invocation through ready Wasm. |
| `234ed6f`, corrected by `d8e9dac` | Clean maximum active gaps 583 and 524 ms, versus the retained 629 ms baseline | Caps generated-loop polling at 256 backedges while preserving the proven 64-backedge minimum, so the 16 ms host deadline is observed before a generated call tree monopolizes Firefox for an entire frame valley. |
| cloning page `2f2fec8` | Corrected-harness maximum active gaps 456 and 492 ms | Enables the runtime's generic compiled-call-chain tier so verified non-recursive generated call graphs use ordinary activations instead of nested generator resumptions. |
| java-tools `d70bf4d`, cloning page `89733cb` | Foreground Instructions average 17.57/16.69 FPS; one-second floors 12.75/11.71 FPS, versus 11.63 average and 1.97 floor before | During a long actively mutating software-rendered AWT frame, host scheduler yields may publish the current framebuffer. Eight bounded mutation fingerprints suppress unchanged idle surfaces; the normal completed-frame repaint remains authoritative. |

The transparent intrinsic is genuinely active. One measured run recorded
16,479,272 successful calls and zero slow-path fallbacks. This call count marks
the hot execution location; it does **not** prove the Java game performs
unnecessary work, because HotSpot runs the same workload quickly.

Exact presentation-gap correlation identified `tf.d(I)Lhf;` as the dominant
cost in a 1,513 ms active valley: 209,318 scheduler activations consumed about
20.9 seconds over the profiled run. Each activation was individually tiny;
the cumulative scheduler crossings were the problem. After the generic cursor
policy change, clean low-overhead sampling recorded only 244 activations of
the adjacent `tf.g(I)Lhf;` cursor and no sampled `tf.d` contribution. The
remaining gap therefore had a different cause; the native continuation
attribution and compiled-call-chain result above supersede that open item.

## Rejected hypotheses and experiments

| Hypothesis or experiment | Measurement | Conclusion |
| --- | --- | --- |
| Canvas upload/presentation is the 75x cause. | Chromium upload consumed about 441 ms of a 30-second profile. | Rejected. Rendering computation and runtime overhead dominate. |
| Full graph fusion into Wasm must be faster. | Firefox/Chromium profiles showed Wasm crossing into JS for Java-array accesses; an experimental fused path increased the worst gap. | Rejected for ordinary JS-backed primitive arrays. Bytecode coverage is not execution locality. |
| Force Firefox raster chains back to ready Wasm. | JS-locality A/B: 3.50 FPS average. Partial live Wasm control: 3.72. Clean reload with Wasm policy: 1.42 average, 0.98 floor. | Rejected. The partial live switch did not invalidate already-linked JS callers and was misleading; the clean reload is authoritative. |
| Enable the existing linear Wasm array heap in browsers. | Typed arrays with the JS path: 3.52 average, 0.99 floor. Direct heap-backed Wasm: 1.52 average, 0.98 floor. A 64 MiB trial also exhausted the heap and exposed a browser-only `process.stderr` bug. | Rejected and fully reverted. Direct array loads do not repair Firefox's slow structured-Wasm body. |
| Fuse the representation as well as code: heap-backed primitive arrays, slab-backed primitive object fields, and direct Wasm static/monomorphic instance links. | Clean Firefox run: 2.19 FPS average, 0.90 floor, versus the retained 5.06/0.98 baseline. Transparent intrinsic calls fell to 5,250,056, but completed frames became slower. | Rejected and reverted (`04364cc`, reverted by `0464065`). Boundary reduction worked, but the current structured-Wasm body has an independent throughput problem. |
| The opaque int-array blit is the remaining Firefox limiter. | Direct opaque-blit experiment: 4.75 average versus the 5.06 retained baseline, same 0.98 floor. | Rejected and reverted (`ea880b4`, reverted by `dd937c2`). HotSpot share did not translate into a Firefox improvement. |
| Generated JavaScript `try/catch` around transparent blits prevents SpiderMonkey optimization. | Exception-status experiment: 3.97 average versus 5.06 baseline. Floor was 1.96, but sustained throughput regressed. | Rejected and reverted (`856f54e`, reverted by `e93da9c`). |
| The workload itself explains Firefox performance. | HotSpot runs the identical class files at approximately 150 presentations/second. | Rejected. The problem is runtime cost per unit of useful work, not merely the existence of the work. |
| A presented-frame threshold alone identifies Instructions. | Captured canvas at 500 presentations was the main menu; after the click, a second capture confirmed Instructions. Some early profiles also included transition asset work. | The threshold is valid only together with visual/state confirmation. |
| Selecting a large call-heavy method for whole-method JavaScript entry is sufficient to remove the remaining valley. | Exact Firefox attribution still recorded about 1,803 entries and 5,970 ms inclusive time for the selected UI dispatcher; the clean maximum gap remained 655 ms. | Failed. Publication of a generated body does not prove that nested calls avoid expensive runtime boundaries, and inclusive timing cannot identify the exclusive leaf cost. |
| Higher average FPS proves that the latest helper/entry policies improved responsiveness. | Exploratory builds averaged about 7.4--7.6 FPS but had 655--760 ms maximum active gaps, versus the retained 629 ms gap. | Rejected under the floor-first objective unless a later change reduces the clean maximum gap below the retained baseline. |
| Lower every generated-loop poll interval to 32--256 backedges. | The runtime failed during startup when a synchronized long-return continuation resumed with `undefined` in a generated audio scheduler body. | Rejected on correctness. Keeping the existing 64 minimum and reducing only the 10,000 maximum boots correctly and improves the clean floor. |
| Precompile every supplied class before guest execution to move Acorn parsing out of animation. | An eagerly compiled positional body captured an uninitialized static-array view and later dereferenced `null`. | Rejected and reverted (`012b514`, reverted by `55ab825`). Pre-initialization compilation is not safe until all static-cache entry guards are proven for that lifecycle. |
| Replace the per-plan Acorn discovery pass with exact compiler-line matching. | All 2,404 focused JIT tests passed, but the clean maximum active gap regressed from 583 ms to 714 ms. | Rejected and reverted (`06a8d1a`, reverted by `726d114`). A smaller compile path did not produce a better Firefox floor. |
| Tighten the generated-loop maximum from 256 to 128 backedges while preserving the 64 minimum. | The clean run averaged 7.03 FPS but its maximum active gap was 666 ms, versus the retained conservative 583 ms. | Rejected and reverted (`26f2df6`, reverted by `114e841`). More frequent polling increased the worst valley despite acceptable average throughput. |
| Precompile methods from already initialized classes after applet lifecycle startup. | The clean run booted and averaged 7.31 FPS, but its maximum active gap was 673 ms and its one-second floor was 2.98 FPS. | Rejected and reverted (`d7cd9e6`, reverted by `876d5ba`). Safely initialized classes did not cover enough first-use transition work to improve the floor. |
| Give mixed recursive/unresolved generated call graphs an ordinary deoptimizing entry instead of retaining a continuation. | All 2,406 focused JIT tests passed. The clean run averaged 16.92 FPS, but its maximum active gap remained 483 ms and its one-second floor slipped to 9.88 FPS. | Rejected and reverted (`bd42e3a`, reverted by `1be2dea`). Removing additional generators did not reduce the authoritative maximum gap. |
| Reduce the adaptive frameless multiplier further from 20 to 5. | The first clean run reached a 391 ms maximum and 13.77 FPS one-second floor, but the repeat regressed to a 531 ms maximum and 5.81 FPS floor. | Rejected. The favorable first result was not repeatable and the conservative maximum is worse than the retained 492 ms. |
| Reduce the adaptive frameless multiplier from 20 to 10. | The clean run averaged 17.38 FPS with a 12.76 FPS one-second floor, but its maximum active gap was 496 ms. | Rejected because its first maximum exceeded the corrected retained 492 ms. Quantum length and valley size are not monotonic. |
| Reduce the adaptive frameless multiplier from 100 to 20. | Initial runs measured 475 and 427 ms, but the corrected no-mid-measurement-screenshot pair measured 515 and 459 ms. Repeating multiplier 100 under the same harness measured 456 and 492 ms. | Rejected and restored by cloning-page commit `2097c8a`: multiplier 20 has the worse conservative exact gap, despite better one-second windows in some runs. |
| The profiler's five-second confirmation screenshot causes the second transition valley. | Moving the screenshot after diagnostics still produced gaps separated by about five seconds; corrected runs reached 515 and 459 ms. | Rejected. The periodic valley belongs to application/runtime work and remains in the floor. |
| Compiled call chains lose their positional child-work safe point, so restoring an exact pre-call handoff must bound the remaining valley. | The generic implementation passed all 2,410 JIT assertions and restored the caller at the pending invoke before child effects. Firefox runs measured 519 and 449 ms maximum active gaps, with averages 13.67 and 14.05 FPS, versus the retained corrected 456/492 ms pair. | Rejected and reverted (`3bd84f6`, reverted by `ab0f0be`). The repeat improved, but the conservative 519 ms result regressed both the exact floor and throughput; added deoptimization overhead does not reliably bound the nested work. |
| Special-case the dominant one-pixel transparent blit to avoid general rectangle range arithmetic and nested loops. | A bounded sampler found 81,960 of 100,000 calls were 1x1 and 14,308 were 12x12, all over ordinary JavaScript arrays. The exact source-first/conditional-store path passed all 2,406 JIT assertions and raised average Firefox throughput to 17.45 and 18.14 FPS, but maximum active gaps were 495 and 490 ms. | Rejected and reverted (`b050067`, reverted by `8b50257`). Despite a real throughput gain, its conservative 495 ms gap is worse than the retained corrected 492 ms; average FPS does not override the floor objective. |
| Restore four-pixel grouping in the validated transparent-blit path to reduce loop overhead for the large rectangles that dominate copied pixels. | The sequential unroll passed all 2,405 JIT assertions, including overlapping source/destination aliasing. Matched Firefox runs measured 468 and 504 ms maximum active gaps, averaging 16.73 and 17.11 FPS. | Rejected and reverted (`06a89f9`, reverted by `3e76104`). The first floor gain did not repeat; the conservative 504 ms gap is worse than the retained 492 ms. |
| Reintroduce the one-pixel transparent-blit fast path against the latest runtime. | All 2,418 JIT assertions passed. A low-overhead foreground Instructions run raised average throughput from 11.63 to 12.35 FPS, but the steady maximum active gap worsened from 518 ms to 580 ms, with another 562 ms valley. | Rejected and reverted locally. The newer runtime confirms the earlier conclusion: removing tiny-call overhead helps throughput but not the periodic floor. |
| Disable `guestKernelOracles` on the cloning page because its name describes a differential-test facility. | The bytecode-derived transparent intrinsic was also gated by this option: its counter fell from more than 16 million calls to zero. Average fell to 9.18 FPS and the steady maximum active gap was 562 ms. | Rejected and reverted locally. The option currently couples full-algorithm oracles and structural raster intrinsics; that naming/policy defect should be separated without disabling the proven intrinsic. |
| Specialize the common 12x12 transparent rectangle with fixed loop trip counts. | All 2,416 JIT assertions passed, but Firefox produced a 1,181 ms active gap and a 0.88 FPS one-second floor. | Rejected and reverted locally. Adding the equivalent shape branch destabilized SpiderMonkey optimization of the shared helper. |
| Lower the structured-JavaScript linear-partition unit from 98,304 to 49,152 bytes so the large parser body is split before execution. | The parser split into three generated segments, but a clean Firefox run worsened the Instructions maximum gap from 102 to 125 ms and the one-second floor from 25.87 to 24.70 FPS. | Rejected. Smaller generated functions did not improve the active floor. |
| Prefer every small acyclic verified positional method in JavaScript, even after its Wasm body is ready. | All focused unit tests passed, but the clean browser run never reached the ten-frame readiness threshold and timed out. | Rejected and reverted. The broad ownership rule changed lifecycle-sensitive methods that do not satisfy the narrow field-helper invariants. |
| Run static void wrappers around JS-local primitive-array loops directly from the interpreter instead of creating a canonical child frame. | All 2,456 experimental JIT assertions passed, but GeoBlox failed during startup with `ArrayIndexOutOfBoundsException: Index 4892 out of bounds for length 4892`. | Rejected and reverted. Positional execution at that boundary is not generally equivalent to canonical frame execution. |
| Keep small scalar reference-field predicates in positional JavaScript, excluding cold exception-handler code from the structural shape test. | All 2,451 retained JIT assertions pass. A clean Firefox run reduced the Instructions maximum gap from 102 to 86 ms; gameplay measured 75 ms and the one-second floor was 25.52 FPS. | Retained locally. The helper is structurally bounded, preserves the positional result, and gives a repeatable floor improvement, but it does not yet meet the 40 ms goal. |
| Compare one fixed incremental-framebuffer sample bank on every scheduler yield instead of revisiting a rotating bank every eighth yield. | A prepared Firefox run produced a 170 ms PLAY-entry gap, then 100/93/86 ms Instructions gaps; one-second floor was 24.68 FPS. | Rejected. One bank misses localized mutations and does not bound uninterrupted transition work. |
| Compare all eight incremental-framebuffer sample banks on every scheduler yield. | The detector did publish intermediate changes, but a prepared Firefox run worsened PLAY-entry gaps to 149/131/124/109/103 ms; one-second floor was 24.39 FPS. | Rejected and reverted. Extra partial publications compete with transition work; reducing presentation-detection latency does not reduce the underlying uninterrupted work. |

## Transition valleys

Entering Instructions performs lazy archive/cache reads, decoding, sprite
construction, and first-use compilation on the producer/UI thread. Measured
examples include `pk.e`, `ji.a`, `uh.a`, and `ua.c`, with uninterrupted
activations around 115--289 ms. This work is non-idle and must count against the
floor. Moving generic compilation preparation earlier is acceptable, but game
Java sources must not be modified and asset work must not be guessed away.

## Current direction

The remaining investigation should compare Firefox's cost per transparent
blit against V8 and HotSpot while separating:

1. correlate the remaining exact 492 ms active gap with scheduler activity at
   a sampling rate that does not materially perturb Firefox;
2. intrinsic body time;
3. generated caller and positional-call overhead;
4. array representation/access cost;
5. transition-only archive/decode work; and
6. frame-production work versus presentation coalescing.

Scheduler method timing is inclusive: parent and child durations overlap and
must not be summed as independent causes. The next attribution pass must use
exclusive nested timing (or a native sampled profile) around the active-valley
roots before changing another generic runtime policy.

Exclusive timing cleared two misleading parents: `bl.b(I)Z` consumed about
1 ms exclusive across 98 calls, and `kj.c(IIII)V` consumed about 125 ms
exclusive across 1,610 calls. Native Firefox sampling instead showed the
content process saturated inside one long promise callback. In one profiled
954 ms valley, approximately 24% of samples were named generic runtime
JavaScript, 16% named generated guest JavaScript, and 56% unsymbolicated
native/JIT code. Acorn `parseSubscript`/`readWord1` frames prove that lazy JIT
parsing contributes to transition valleys, but the two attempts above did not
reduce the clean floor safely.

After compiled call chains were enabled, a native profile of a 613 ms
instrumented valley still contained 359 samples below continuation wrappers,
but useful raster execution was now prominent: the two direct raster bodies
and transparent-blit intrinsic were the largest named exclusive leaves.
Broadening ordinary entries removed more wrapper eligibility barriers without
improving the low-overhead 483 ms maximum, so continuation presence alone is
no longer a sufficient next hypothesis.

A later 1/64 scheduler-correlation run on restored multiplier 100 measured
449 and 371 ms transition gaps. The first contained only zero-duration sampled
roots (`m.a` and `kl.a`), and the second only about 1 ms attributed to `bg.a`.
This rules out one long top-level scheduler activation as the whole periodic
valley; the next pass must separate nested generated work and SpiderMonkey
JIT/GC time rather than increasing root-timing overhead further.

Gecko marker correlation over the exact 613 ms native-profile valley rules
out garbage collection as the missing pause. Eight minor collections totaled
6.43 ms and the largest lasted 1.42 ms; the only main-thread long-task marker
was 64.21 ms. Native samples throughout the interval instead remain inside
nested generated rendering, direct raster bodies, transparent blits, and the
runtime call-chain machinery. The interval is therefore accumulated execution
without a presentation, not a single Firefox GC stop-the-world event.

Do not reintroduce the rejected Wasm-heap, forced-Wasm, opaque-blit, or
exception-status experiments without new evidence that changes their measured
premises.

## Main menu, Instructions, and gameplay on current Firefox (August 26, 2026)

Measured with the cloning page on `localhost:5173`, the same `javac.js`
classes, and two headed Firefox builds under Xvfb on this machine:
Playwright Firefox 146.0.1 and stock Firefox 154.0.1. Frame counts come from
`jvm._awtPresentationStats` (`presented` = canvas uploads, `dirtyMarks` =
completed guest frames). HotSpot with the fake-AWT launcher presents about
60 changed frames per second at the same menu (`.work/hotspot-geoblox-floor`).

| State | Firefox 146 | Firefox 154 | Guest frames/s | Notes |
| --- | ---: | ---: | ---: | --- |
| Main menu | 30.0 avg, 25.8 floor | 32.5 avg | 92--137 | Presentation-bound, not JVM-bound: 60--70% of completed frames are coalesced. |
| Instructions (tutorial) | -- | 10--15 | 10--15 | `dirty == presented`: the JVM only finishes 10--15 frames/s; 0.7--1.3 s worst gaps. |
| Gameplay | 10.8 avg, 4.7 floor | 15--19 | 10--19 | `dirty == presented`; 0.8--2 s hitches on transitions. |

### The 0.9 FPS sessions were background tabs

Two long telemetry sessions from a LAN client (Firefox 153, sessions
`mtadx2oq` and `mtah7k4l`) sat at a steady 0.9 FPS for minutes. In those
sessions the guest still completed about 57 frames per second (`dirtyMarks`),
but `presented` advanced once per second, `worstGapMs` was 0 because the
page's `requestAnimationFrame` watcher never ran, and the `frame_gap`
records were spaced 978--1124 ms apart with `samplesSinceFrame = 1`. That
is Firefox's throttled refresh driver: a hidden or occluded document ticks
rAF at about 1 Hz and, after `dom.timeout.throttling_delay` (30 s), clamps
timers to 1 s, so the presenter's 17--33 ms fallback timer also fires once
per second. Reproduced on Firefox 154 with Ctrl+T: `visibilityState` became
`hidden` and rAF fell to 0.1/s within one 10 s window. The `performance`
telemetry now records `host.visibilityState`, `host.hasFocus`,
`host.rafPerSecond`, and measured `setTimeout` latency so a throttled
session can no longer be mistaken for a slow runtime.

### Gameplay profile (Firefox 154, Gecko profiler, 49 s window, 24,359 samples)

Named guest frames appear in 90% of samples, but guest *self* time is only
about 15%. The largest single cost is the Wasm-to-JavaScript array import
path under four raster kernels: `na.a(I[BIII[I[IIIIII)V` (20.4% inclusive,
2.6% self), `dm.b(IIIIII)V` (11.8%), `dm.a(IIIIII)V` (12.1%, which calls the
acyclic plotter `dm.c(IIIII)V` four times per pixel through
`instanceCallImport -> runNested`), and `nc.a`. Their per-element exits
(`fast exit trampoline` -> `arrayImports` closure -> the interpreter's
string-dispatched array helper -> `load`/`store`/`kindWidth`) account for
roughly 29% of main-thread samples. Every one of these methods has a
published structured-JS body and is JS-preferred by
`isImportedArrayJsClosurePreferred`, yet Wasm ran `nc.a` 227,609 times,
`dm.a` 4,354 times, and `dm.b` 3,536 times during one 20 s gameplay sample.

Two routing defects explain that:

1. `JitCompiler.invokeChildAsync` (the "Ask the Wasm tier before rejecting
   the child on JS-JIT policy" site) never consulted the JS array-locality
   preference. A guard on `jsChildSupported &&
   isImportedArrayJsClosurePreferred` dropped `dm.a` to 7 and `dm.b` to 293
   Wasm runs in the next sample.
2. `isImportedArrayLoopJsPreferred` required `calls === 0`, so rotated
   blits that call `java.lang.Math.sin/cos/floor` (`dm.b`) or a same-class
   call-free plotter (`dm.a` -> `dm.c`) were never JS-preferred. Both are
   now admitted structurally (pure Math statics; private/static/final
   same-class helpers with no calls and at least one primitive array
   access, whose call sites count as the loop's element accesses). Focused
   JIT tests: 2410/2410.

Rerouting `dm.a`/`dm.b` alone did not change gameplay throughput (9.3 vs
10.8 FPS, within run noise), and `na.a` still entered Wasm 417 times through
the scheduler-tick path (`_tryExecuteSynchronousJitTick -> tryRunFrame ->
WasmJit.tryRunFrame`) with `invocationCounts` never touched, i.e. without
`canRun` being consulted. That entry path is the open item; see the trace
below.

A runtime trace of the Wasm gate (`jit.jsPreferredWasmEntryTrace`, 20 s of
gameplay) then identified the path: `nc.a` reached the gate 216,718 times at
pc 48, `bg.a(IIIIIIZ)V` 6,286 times at pc 0, and `na.a` 377 times at pc 9,
each with a published generated body, `canRun === false`, nothing disabled,
and `invocationCounts` untouched. The only `canRun` early returns with that
signature are the transient `frame.jitSkipOnce` step and the warmup gates.
The generated body deoptimizes transiently mid-loop, the frame is marked for
one canonical interpreter step, `canRun` consumes the marker and declines,
and the Wasm gate immediately below takes the frame and finishes the loop
with per-element imports. Fixing that hand-off, and the reason those bodies
deoptimize on nearly every call, is the next experiment; a serial
hypothesis/act/measure/revert loop records its results in the java-tools
branch `perf/geoblox-raster-locality`.

### Experiment loop results (August 26, 2026, branch `perf/geoblox-raster-locality`)

Serial hypothesis -> act -> measure -> keep/revert loop (Opus 5 subagents,
one experiment at a time, each measured twice with the Playwright/Xvfb
Firefox 146 harness: menu -> START GAME -> Space -> 25 s gameplay sample,
`?jvm=local` bundle). Keep bar: +1.5 FPS average and no min-1s regression.

| Step | Change | Gameplay avg FPS | min 1 s | Menu | Outcome |
| --- | --- | --- | --- | --- | --- |
| baseline (eecf41f) | - | 8.04 | 1 | 30.5 | - |
| H1 | skip the Wasm gate for transiently declined JS-preferred frames | 7.29 / 7.15 | 1 / 1.8 | 28.3 / 27.8 | REVERTED |
| H1b (12ef58b) | failed runtime range guard -> two-arm polled loop instead of deopt | 11.74 / 11.52 | 4.9 / 4.0 | 24.9 / 24.7 | KEPT |
| H3 (fdf5262) | per-opcode specialized i32 Wasm array-load imports | 12.66 / 13.13 | 1 / 1 | 24.3 / 24.5 | KEPT |
| H4 (c5decf0) | release the positional link of a ready Wasm body that never runs | 27.07 / 26.75 | 2.9 / 8.2 | 25.0 / 25.2 | KEPT |

What each step established:

- **H1 (reverted)** made the routing mechanism work perfectly (`nc.a` Wasm runs
  249,251 -> 0, all four raster kernels became stable JS entries) and gameplay
  got slower. The ~29% of Gecko samples on the Wasm->JS array-import path were
  not recoverable by tier choice: the kernels were not "stuck in Wasm", they
  were wrecked before either tier ran them.
- **H1b (kept)** named the wreck with a new opt-in `JitCompiler.generatedDeoptTrace`
  Map: 225,623 `structured SSA range guard` deopts per 25 s in `nc.a`, one per
  Wasm-gate entry. The guard is a property of the arguments, so kernels whose
  real arrays never satisfy it deopted on essentially every call (frame
  restore + one interpreter bytecode + the remainder of the loop in partial
  Wasm). The restoring direct-positional emitter in `JvmSsaBlockRenderer` now
  emits `if (guard) { specialized unpolled loop } else { polled loop }` for
  runtime-bounded guards; statically coarse loops keep the restoring deopt
  because removing it there dropped whole methods out of structured SSA.
  Cost: menu 30.5 -> ~25 FPS (the polled slow arm runs where Wasm used to);
  still open.
- **H3 (kept, +1 FPS)** removed the string/instanceof re-derivation of the
  element kind that the opcode already fixes statically in the Wasm array
  imports.
- **H4 (kept, +14 FPS)** came from profiling HEAD instead of counting deopts:
  the top of the gameplay profile was one call boundary, `dm.a(IIIIII)V ->
  dm.c(IIIII)V` (plotter, 4x per pixel). `getPositionalGeneratedInvoker`
  refused to publish `dm.c`'s direct positional entry because it had a
  ready, fully compiled Wasm module — a module that had zero runs, because a
  callee reached only through generated callers never reaches a scheduler
  entry. Every call therefore paid for a canonical child Frame it did not
  need. The veto is now released once a target has served 64 JS child runs
  while its module has never run once (a single Wasm run restores it; flag
  `JVM_DISABLE_READY_WASM_POSITIONAL_RELEASE=1`). Re-publishing fills
  `site.fastPositional`, the structured-SSA renderer late-links it inside the
  running activation, and the callee goes adaptive-frameless.

Net: gameplay 8 -> 27 FPS on Firefox 146 under Xvfb, `dirty/s` 8 -> 30, i.e.
the guest now produces 30 frames/s and the presenter keeps up. Open items:
the H1b menu regression (30.5 -> 25), the `non-canonical primitive array
storage` deopt shared by `bg.a(IIIIIIZ)V` and `m.a(String,II)` (~14.7k per
25 s), and ~100k/25 s "asynchronous structured SSA callee" deopts whose
root cause is callees with no synchronous generated body. The page's default
bundle is cloned from GitHub, so the deployed page only sees this once the
branch is merged and pushed; until then `?jvm=local` loads the synced build.

### Menu regression repaid (August 27, 2026)

A second serial loop targeted the 12ef58b menu cost with a two-sided rule
(menu >= 28.5 AND gameplay >= 25.0 on the same run).

- **m1 (reverted, attribution)** — the 5 FPS was confirmed to be 12ef58b's one
  `coarse &&` token, but NOT because the polled JS arm is slower than Wasm:
  `nc.a`'s slow arm is 1.16% of menu samples versus ~11% as Wasm+imports
  before, and guest frame production went UP (88 -> 105 dirty/s). What was
  lost was safe-point *cadence*: the per-invocation deopt had been the raster
  call chains' only frequent wall-clock check, so JVM event-loop turns grew
  from 17.4 to 19.3 ms and the presenter (which presents off a 20 ms fallback
  timer ≈ 0.5 x turn boundaries) lost ~5 uploads/s. The painted frame rate
  (RefreshDriverTick 12.8/s) was identical before and after. Re-adding a
  counter-gated safe point at the two-arm loop head plateaued at 27.1 and cost
  gameplay; reverted.
- **m2 (kept, b3584a6 "Pace guest frame production against host presentation")**
  — frame-production backpressure: `Graphics.js markSoftSurfaceDirty` counts
  completed frames superseded before presentation; once the backlog reaches
  `awtPresentationBackpressureFrames` (default 2, env
  `JVM_AWT_PRESENTATION_BACKPRESSURE`, 0 disables) the JVM's host yield parks
  until the pending presentation lands (release timer max(24, yield+12) ms
  so hidden tabs still progress). Uploads move from the starvation timer onto
  real rAF ticks (presentation fallbacks 323 -> 44/25 s). Also fixed on the
  way: `yieldToEventLoop` consulted a global `setImmediate` before the
  configured strategy, and jszip's bundled polyfill defines one in the
  browser, so the page's "message-channel" choice had been inert.
  Menu 36.3 / 35.6 / 36.1 / 36.8 / 33.5 (was 25; pre-regression 30.5);
  gameplay 28.6 / 27.7 / 28.7 / 27.2 / 25.9 (HEAD before: 26.8-27.1), dirty/s
  up in both states (menu 105 -> 131, game 30 -> 33). Backpressure did not
  throttle the guest; freeing the main thread at the presentation boundary
  made the pipeline faster.
- **m3** — no change; two confirmation runs, full test gate green.

Remaining: gameplay variance (the second after START GAME -> Space is a
compile-warmup cliff at 0-17 fps; mid-run dips to 16-22), and the harness's
scalar `game_min1s` reads that warm-up second, so threshold rules on it are
noise — use the steady-state window. `dm.c` still never runs in Wasm (the H4
release works through the JS tier).

## Transition stalls (August 27, 2026)

Shipping gap first: the page without `?jvm=local` evals the *committed* `java-tools/browser-runtime/jvm-debug.js`, which had not been rebuilt since 73bb2b0; every perf commit must refresh it (4829a16).

Remote telemetry (user's box) for "start game / tutorial abysmal": the 32 s START GAME stall and 4 fps menu were a **hidden tab** (`host.visibilityState: hidden`, rAF 0); the tutorial at 6–12 fps was real, on a box whose rAF runs ~12 Hz even during 25 fps gameplay.

Gecko profile of START GAME on this box: ~57 % synchronous compile (WasmJit translate 39 %, JS codegen 33 %, acorn re-parse of generated JS 13 %, `cacheKillsFor` 4 %). A per-method compile census (`wasmJit.compileStats`, `jit.codegenStats`) found two retry storms:

| storm | cause | cost | fix |
|---|---|---|---|
| `ua.c()Lgd;` 12,527 identical failed compiles | reference-return deferral set `retryAfter = 1` → recompiled on next entry | 30.7 s of 75.9 s wasm compile per boot (+20 s bj.a/hj.a/uh.a) | e5bc18d gate on blockers moving |
| `kc.b(I)V` 11 × 350 ms, `gh.a(B)V` 9 × | `no compiled loop` retried on every epoch bump / any blocker movement | ~5.6 s of the START GAME window | 12bb09b: retry only when all blockers resolved, else ≥50 ms failures wait 20× their cost |

Result: wasm compile self time 75.9 s → 19 s per session, boot-to-menu 141 s → 85 s, START GAME reaches ≥15 fps ~7 s after the click instead of ~11 s. Steady-state menu/tutorial/gameplay unchanged (36/17/27). Rejected: JS-owned wasm warmup (neutral, breaks a coverage test).

Follow-up transition profiling separated the click-time and recurring costs.
The remaining `kc.b(I)V` rejection had no named blocker at all, so no class or
callee state could ever change its outcome; nevertheless it was rebuilt at
each level transition (529/453/421/392/366/361/361 ms in one run). A
blockerless `no compiled loop` is now terminal and retains the correct JS
fallback (6536dce). Verification produced one 436 ms rejection and no retry;
after the initial entry window the largest gap over the next minute was 229 ms
instead of the recurring 592/495/469/388/376/372 ms series.

The launcher now uses a generic JVM API to precompile loop-bearing methods of
already initialized classes after the menu is stable and before enabling
pointer input (java-tools 6536dce, cloner b50674c). Longer startup is accepted
here to keep compiler work outside PLAY/level frames. In the warmed transition
run there were zero JavaScript compile events above 30 ms during the measured
PLAY transition; 60-second average was 15.73 FPS (15.45 without warmup). The
two remaining ~1.1 s initial-entry gaps contain transition workload and Wasm
tiering, not the eliminated JS first-use or recurring `kc.b` retry storms.

## Active-frame floor experiments (August 30, 2026)

These runs measure consecutive presented frames in foreground Firefox and omit
genuinely static input-wait windows. The target is the worst non-idle gap, not a
short peak FPS sample. A retained scalar reference-field helper baseline gave an
86 ms Instructions gap and 75 ms gameplay gap.

- **Rejected: clipped transparent wrapper fusion.** The generic verified wrapper
  and direct intrinsic activated, but Instructions/gameplay worsened to 111/105
  ms. The matcher, helper, ABI, and test were reverted.
- **Rejected hypothesis: host-yield starvation.** A causal trace around
  `_yieldHostTurn` showed the 101 ms Instructions valley still contained three
  successful message-channel yields of 3--5 ms. Firefox was receiving control;
  the incremental framebuffer sampler simply had not discovered a mutation at
  those turns.
- **Exact AWT raster mutation signal.** `drawImage` tags only its live producer
  `int[]`; verified generic raster intrinsics mark that tag once per call. The
  presenter consumes the tag at a host yield, and a pending partial presentation
  selects the bounded presentation handoff. The signal alone measured 97/78 ms;
  adding the handoff raised the sustained floor to 28.66 FPS but left 96/78 ms
  worst gaps. The signal is retained because it is exact and does not manufacture
  idle frames.
- **Rejected: sample more framebuffer banks.** Checking two banks per yield
  instead of one of eight reduced the sustained floor and worsened gameplay to
  94 ms, so the eight-bank fallback remains.
- **Rejected: signal every generated method with a reachable `iastore` at
  entry.** This marked the surface before the stores occurred, raced the
  presenter against incomplete raster work, and dropped the floor to 16.75 FPS.
  Instructions reached 125 ms and gameplay included a 325 ms active gap. The
  entry signal was removed.
- **Retained: completion-only generated raster signal.** Methods with
  reachable integer-array stores now test only tracked AWT arrays and publish the
  mutation after normal completion. This preserves the low-frequency signal while
  preventing the stale partial-frame race.

### 40 ms transition-floor investigation

The transition harness performs the real guest stage change by reflecting
`ld.b(false)` onto the live AWT producer thread. It records the level field before
and after, waits for the reflected frame to retire, and measures presented-frame
gaps. A transition window is the call plus the next second; later gaps are reported
as ordinary post-level gameplay. Static input-wait frames remain excluded.

Several hypotheses were rejected before the retained routing change:

- Lowering the generic oversized-loop threshold from 2048 to 1024 did nothing;
  the dominant affine raster already has 2079 bytecodes and qualified at 2048.
- A ready Wasm state did not imply it was eligible. The module for the dominant
  raster was fully compiled but had zero runs because imported-array locality and
  call-graph-first policy selected JavaScript.
- Preparing only initialized loops was incomplete. Non-loop transition bodies
  remained first-use work, producing a 104 ms reflected stage call and much larger
  unrelated valleys.
- Preparing every Wasm fallback was over-broad: 2493 module candidates took more
  than ten minutes under host contention. Preparation now separates complete
  JavaScript coverage from the much smaller prepared-oversized Wasm set.

Retained generic runtime changes:

1. Exact AWT mutations observed at a cooperative yield may upload immediately,
   followed by one timer task boundary so Firefox can paint. Sampled/uncertain
   mutations retain the requestAnimationFrame path. This removed a measured 74 ms
   presentation wait.
2. `precompileInitializedClasses` can prepare all loaded JavaScript bodies while
   compiling Wasm only for prepared oversized full-module upgrades. In the measured
   run this prepared 4950 JavaScript methods and only 37 Wasm candidates in 76 s.
3. A prepared, fully compiled oversized module may supersede JavaScript even when
   the ordinary imported-array heuristic prefers JS. The exception is narrow: no
   partial module, no foreground compilation, and no exit storm.
4. The same decision now applies to generated-to-generated nested calls. Before
   this, only scheduler entries reached Wasm (5 runs) while positional child calls
   retained 55--81 ms JavaScript raster valleys. Afterward the module ran 23 times
   with zero exits and those valleys disappeared.

Sampled Firefox result after the nested-dispatch fix: reflected stage call 26 ms,
worst gap in its one-second transition window 36 ms, active one-second floor
48.09 FPS, average 54.17 FPS. PLAY-to-Instructions still contained a 60 ms sampled
gap. The clean unsampled confirmation measured a 42 ms reflected stage call,
47 ms worst PLAY-to-Instructions gap, 47.10 FPS one-second floor, and 52.90 FPS
average. No level-transition gap was large enough to enter its top-30 gap list
(all were below 35 ms); later ordinary gameplay still has separate 65--109 ms
valleys and is not hidden by the transition result.

The accepted preparation policy is owned by DekoBloko in
`apps/launcher/browser-runtime.json` and its cloned after-start script. java-tools
contains only generic preparation and tier-routing machinery; the clone page only
loads the repository-declared hook. No game Java source was optimized.

The final production-path confirmation used neither `?jvm=local` nor a
profiler-triggered preparation. It fetched the committed JVM and Deko hook through
the browser Git clones. The reflected stage call took 39 ms, the worst transition
gap was 37 ms, PLAY-to-Instructions peaked at 38 ms, the one-second floor was
48.85 FPS, and the average was 54.34 FPS. The complete oversized module ran 18
times with zero exits. This also caught and fixed a late-preparation case where a
previously cached positional JavaScript child link had to be invalidated when the
prepared Wasm module became ready.
