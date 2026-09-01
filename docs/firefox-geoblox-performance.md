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

### Correction: incremental uploads were not complete frames (August 31, 2026)

The retained incremental-presentation measurements below do not establish a
completed-frame floor. Remote Firefox session `mtgbpyie-ovjvpsaj` made the
error observable: at the last sample the runtime had counted 8,116 canvas
uploads but only 320 Java `Graphics.drawImage` calls. Of those uploads, 7,796
used the JavaScript swizzle and 2,475 were explicitly triggered at an internal
raster yield. The displayed surface was therefore often a framebuffer still
being modified by the guest.

This path also replaced the presenter's typed snapshot with the guest's live
plain JavaScript array. Full 800x600 conversion and upload averaged 15.56 ms
per counted presentation and ran about 24 times per second, consuming enough
of Firefox's main thread to make WebAudio audibly choppy. The cloning page no
longer enables `awtIncrementalPresentation`; the option and implementation have
been removed from java-tools. The runtime now registers an AWT `ImageConsumer`,
copies pixels delivered by `setPixels`, and makes the image drawable only after
`imageComplete(SINGLEFRAMEDONE|STATICIMAGEDONE)`. Its FPS counter therefore
counts only completed Java image/blit boundaries. Results below that used
incremental presentation remain useful scheduler experiments, but their
displayed FPS must not be compared with HotSpot or complete-frame browser FPS.

Final cleanup also removed the framebuffer field-guessing bridge, mutation
sampler/signals, exact descriptor and bytecode-count renderers, guest-kernel
oracles, and the old fused-region compiler. Any “retained” label below records
the state of an earlier experiment and does not describe the current tree.

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

## Complete-frame floor after removing partial presentation (August 31, 2026)

The valid complete-frame reference is now 38 ms on the main menu, 357 ms for
the menu-to-Instructions transition, and 301 ms on Instructions. The global
worst is therefore 357 ms, 8.9 times the 40 ms target. Earlier sub-40 ms
transition figures above used a presentation path that could upload an image
before Java completed it and are not comparable to this reference.

A native Gecko profile collected without `jit.profileMethods` (which disables
production fast links) attributed an instrumented 532 ms Instructions valley
primarily to the ordinary generated `ma` rendering activation and its nested
calls: the `ma` tree was present in 66.35% of samples, generic resolved-target
dispatch in 62.97%, and the generated `dm.b(II)V` body in 26.5%. Profiling
overhead increased the measured gaps, so these percentages are attribution,
not a replacement floor measurement. A low-overhead deoptimization trace
recorded 1,005 `synchronous generated quantum` exits from the same `ma` method;
the child raster did not itself deopt. One complete frame spans many expensive
ordinary-JavaScript quanta, so this is neither an idle window nor a broken
clock.

New rejected experiments:

- Enabling the generic hot call-graph region tier measured 73/537/449 ms for
  menu/transition/Instructions and was reverted.
- Splitting the oversized ordinary adaptive body first caused a guest null
  pointer due to an invalid lexical capture. After repairing and
  differential-testing the capture ABI, two broad runs measured 59/382/285
  and 87/365/270 ms. Instructions improved, but the global floor regressed.
  Restricting the splitter to compiled call chains was much worse at
  112/363/841 ms. All splitter code was removed.
- Capturing the adaptive tier's 103 immutable sentinel values eliminated 84
  async-sentinel, eight void-return, and eleven static-deopt helper calls, but
  measured 70/387/326 ms. It was removed.
- Outlining the repeated abnormal child-call branches reduced the `ma`
  adaptive source from 204,336 to 177,544 bytes while leaving successful
  calls inline. It measured 227/363/682 ms and was removed. This and the
  splitter results show that generated source size is not a monotonic proxy
  for SpiderMonkey floor performance.

The restored diagnostic bundle is `cfcf0c7c4869`. The next attribution pass
targets the periodic raster execution and its actual positional-link state;
source-size, sentinel-call, whole-graph, and ordinary-body splitting changes
must not be retried without evidence that changes their premises.

The positional-link audit found one remaining generic ownership error. A ready,
fully compiled Wasm method was allowed to veto a positional JavaScript link
forever after *any* invocation had reached that Wasm state, even while one exact
synchronous generated edge subsequently accumulated thousands of JavaScript
child runs. Treating those repeated edge-local runs as proof that this edge
cannot reach scheduler Wasm released the nested `vb.b()V` link. All 2,320 focused
JIT assertions passed. The clean complete-frame run measured 208/296/216 ms for
menu/transition/Instructions, improving the retained global maximum from 357 to
296 ms in that run. Upload work remained 1--5 ms and no frames were coalesced or
partially published.

A low-overhead trace after that fix recorded 4,062 ordinary adaptive positional
safe-point exits from `ma.a(IIIBI[Ldm;)V` at loop PC 568. Converting compiled
call-chain positional bodies from ordinary functions to resumable generators
removed the permanent baseline-resume premise but regressed the clean result to
141/337/341 ms; transition and Instructions medians also rose from 138/136 to
202/192 ms. The experiment passed all 2,321 focused JIT assertions and was fully
reverted. SpiderMonkey's ordinary-function optimization is worth more than the
saved iterator state. A future resume fix must preserve an ordinary optimizable
activation and reconstruct structured state at verified loop leaders; do not
retry whole-method generator conversion.

The normal runtime clock facade was also issuing a second `Date.now()` at every
structured-quantum check, even when fake time was disabled, and did so before it
knew whether any sleeping/waiting thread had a deadline. Reusing the already
sampled wall time and reading guest time lazily passed all 2,321 focused JIT
assertions. Its clean run measured 63/298/194 ms; this improves Instructions but
does not independently change the conservative transition floor.

With that correction, disabling the retained linear generator partitioner was
beneficial under complete-frame measurement. Two clean controlled runs, using
the same cloned after-start lifecycle, measured 71/285/192 and 71/225/208 ms.
The conservative global maximum is 285 ms, versus 296 ms with partitioning. The
second run had zero coalescing; completion timestamps, rather than rAF upload
times, are used in both. This reverses the older conclusion from the partial-
publication era: generated segment helpers accounted for about 12% of effective
self samples in the corrected native Instructions profile, and their removal is
now retained in DekoBloko's generic browser runtime options.

The next generic range-proof experiment explained why the hot transparent
raster still had ten checked primitive-array accesses. Both negative-count
inner loops duplicate the same `iinc` onto mutually exclusive latch arms, while
the counted-loop recognizer required one syntactic write. A CFG proof of exactly
one identical positive update on every backedge admitted all three loops and
specialized all 10/10 accesses. Differential fixtures covered multiple literal
backedges, zero trips, aliasing, cursor overflow, exact bounds exceptions, and
effects before a failing access; all 2,338 focused assertions passed.

That correctness proof did not improve the Firefox floor. Under the same
bundle, class files, after-start preparation, unpartitioned policy, complete
frame publication, and 60-frame settled-screen windows, two disabled controls
measured 80/260/201 and 77/242/209 ms for menu/transition/Instructions. Two
enabled runs measured 52/217/177 and 75/327/205 ms. Thus the conservative global
maximum regressed from 260 to 327 ms even though one run and some Instructions
samples improved. The extra loop version changed SpiderMonkey's code shape more
than the removed checks repaid. The induction proof, its diagnostic option, and
its tests were fully removed; the rebuilt local bundle returned exactly to
`a918ac537be4`. Do not retry this form of per-loop range specialization without
evidence that the generated fast loop itself becomes smaller or a different
host representation removes the duplicated versioned bodies.

An attempted measurement with the uncommitted before-start preparation hook was
excluded: preparing all 7,816 methods before class initialization produced a
guest null-array store and the applet never presented a frame. The controlled
A/B temporarily used the known-valid cloned after-start hook and restored the
pre-existing local before-start files afterward. This is a correctness issue in
that separate lifecycle experiment, not a performance result.

A native Gecko profile of the retained unpartitioned build confirmed that
presentation is not the remaining floor. Canvas queue/upload was 2--5 ms while
the sampled 491 ms Instructions valley was spent before Java frame completion.
In that exact valley, `ma.a(IIIBI[Ldm;)V` accounted for 20.16% effective self,
`dm.b(II)V` for 11%, the transparent raster for 5.91%, and structured quantum
handling for 4.28%. Sampling overhead makes the absolute profile gaps unsuitable
as a baseline, but the ownership is unambiguous and no longer includes the
removed linear-partition segment helpers.

The hot `ma` method's restoring positional admission was blocked only by an
`aaload` from its unchanged reference-array parameter. A generic provenance
proof admitted that shape while retaining Java null/bounds checks, dynamic
receiver guards, and exact exceptional restoration; generic fixtures covered
null/object elements, compiled child calls, caught null-array exceptions, and
the diagnostic-off control. All 2,325 focused assertions passed and the javac.js
method published the intended restoring body. That body was 468,798 bytes,
however, versus 231,239 bytes for the existing ordinary adaptive body.

An exact-bundle Firefox A/B rejected it. With bundle `370d26c58ec4`, two disabled
controls measured 63/233/198 and 61/249/185 ms for menu/transition/Instructions.
Two enabled runs measured 134/250/208 and 100/314/206 ms. Tier inspection proved
the restoring entry was selected, and upload remained separate; the conservative
global floor therefore regressed from 249 to 314 ms. The proof, option, and tests
were fully removed, 2,321 focused assertions passed again, and the served bundle
returned byte-for-byte to `a918ac537be4`. Do not retry broad exact-restoration
source for large call-bearing bodies unless cold restoration arms can be encoded
without roughly doubling the host function.

The existing generic linear primitive-array heap was then tested as a changed
representation premise. Its structured Wasm backend already emits raw linear-
memory loads/stores with a correct import fallback, and 61 focused heap/slab
assertions passed. Merely enabling the heap measured 61/260/230 ms, but tier
inspection showed zero runs in both ready raster Wasm methods: the generic
imported-array policy still assumed every primitive array lived in JavaScript.

Temporarily removing that stale locality veto when direct heap access was active
made `dm.b(II)V` run in Wasm 64 times and its transparent raster run there 119
times, both with zero exits. The exact-bundle enabled run measured 56/268/216 ms
and the heap-disabled control measured 121/258/219 ms. Together with the earlier
61/260/230 ms control-equivalent run, the global floor remained 258--268 ms;
queue/upload stayed at 1--18/1--5 ms. Direct Wasm raster execution therefore did
not remove the transition floor. The tier-policy change, runtime capability
flag, and test were removed rather than retaining a neutral code path. This
rules out primitive-array JS/Wasm boundary crossings as the dominant remaining
periodic cost; the higher-level `ma` activation and repeated `dm` calls remain
the next targets.

Firefox's native implementation labels identify a tiering asymmetry inside that
remaining work. In the retained profile, the higher-level
`ma.a(IIIBI[Ldm;)V` activation had 7,417 inclusive baseline samples and no Ion
samples, while `dm.b(II)V` had 3,539 Ion samples and the transparent raster had
1,946. The leaf loops therefore do optimize; the large generator-continuation
activation above them does not.

A semantic diagnostic disabled structured continuations so the exact Java state
was materialized into the existing ordinary resumable companion. It regressed
the complete-frame gaps to 59/343/401 ms for menu/transition/Instructions,
versus the retained best repeatable 71/285/192 and best single transition run of
225 ms. The switch was removed. Merely replacing the generator with the current
generated-sync resume path is not sufficient; the next implementation must
preserve an ordinary optimizable activation while reconstructing state only at
verified continuation points.

A follow-up kept the generator but added one generic labelled fast-success edge
around each positional call. The edge skipped the cold async/deopt/active-child
handlers only when the result was non-sentinel, non-deoptimizing, the call-stack
depth was unchanged, and the thread remained runnable. All 2,322 focused JIT
assertions passed, but an exact-bundle Firefox A/B rejected the host code shape:
enabled measured 68/390/366 ms for menu/transition/Instructions, while disabled
measured 82/293/213 ms. The option, implementation, and test were removed. Even
fewer executed branches can destabilize the oversized baseline-only generator;
the next tier must move hot work into a separate ordinary optimization unit
rather than adding control flow to that generator.

An ordinary-loop outlining prototype then moved compiler-marked structured
continuation loops into separate non-generator functions and reconstructed
their live scalar state at the verified loop header. Unit-level differential
tests covered completion, cold handoff, generator source offsets, and outward
label routing, but the real browser workload exposed two compiler defects
before any frame measurement: `ch.a(IIIIILjava/lang/String;I)V` first completed
as raw JavaScript `undefined`, and the narrowed version later reached a guest
null pointer and stalled before presenting a frame. Because no end-to-end run
was correct, this produced no valid performance result. The option, compiler
path, diagnostics, and tests were removed; the served bundle was restored
byte-for-byte to `a918ac537be4`. A future ordinary optimization unit needs a
JVM-level differential harness for full structured CFGs before browser timing.

The next audit found that DekoBloko's configured adaptive frameless multiplier
was not reaching generated loops. The method entered with a 6,400-instruction
adaptive allowance, but every loop header replaced it with that loop's original
64-instruction budget. A generic `ordinaryAdaptiveCallChainSafePointBudget`
option now scales every verified loop budget in a canonical, non-recursive
compiled call chain while preserving relative loop weights, wall-clock checks,
and exact deoptimization. The focused JIT suite passed all 2,323 assertions;
offline inspection of `ma.a(IIIBI[Ldm;)V` showed the 4,000,000 budget at entry
and at all six loop resets. A traced Firefox run measured 46/213/102 ms with no
`ma` deopts, and clean repeats measured 54/229/123 and 45/288/138 ms. This
roughly halved the Instructions floor, but transition variance remained.

That profile exposed a separate periodic cost after each completed frame. The
old browser publication copied the 640x480 Java `int[]` framebuffer into Wasm,
swizzled RGB channels there, copied it into `ImageData`, and finally called
`putImageData`. A generic opt-in WebGL presenter instead uploads the same one
complete typed framebuffer as a texture and swaps its BGRA byte layout in a
fragment shader. Its initial compatibility implementation rendered to an
offscreen WebGL canvas and copied that into the visible 2D canvas. Two clean
runs measured 68/200/112 and 122/233/126 ms, with 844/844 and 1,036/1,036 GPU
presentations and no CPU swizzle. The image was color-, orientation-, and
content-correct, but the offscreen-to-2D copy still occupied about 12% of the
exact worst native-profile window.

The visible canvas could not be claimed directly because the first AWT
primitive frame allocated its software raster as a plain JavaScript `Array`.
That frame could not be texture-uploaded and therefore acquired a permanent 2D
context before later typed full-frame blits arrived. AWT software integer
surfaces now use `Int32Array` from their first primitive draw, matching Java
`int[]` storage. Graphics creation and repaint keep raster operations attached
to the component without pre-acquiring 2D when the generic complete-frame
WebGL backend is enabled. A context-order trace proves the first connected
640x480 request is now `webgl`; the only earlier 2D request is a disconnected
304x34 Java image. All 206 focused AWT assertions passed.

With bundle `23e75ffff703`, two clean Firefox runs measured 38/211/96 and
40/219/93 ms for menu/transition/Instructions. Every observed presentation was
direct to the visible canvas (934/934 and 1,047/1,047), with zero WebGL, Wasm,
or scalar fallback and 2--4 ms maximum uploads. The captured Instructions frame
is complete and correctly oriented. This establishes a conservative 219 ms
global floor and a 211 ms best transition gap; the settled main-menu floor now
meets the 40 ms target, but Instructions and especially transition computation
do not. The next native profile therefore targets the transition before Java
frame completion, not presentation.

The next retained generic change admits effectful methods with verifier-safe
monitor ownership to adaptive code generation. Together with the 4,000,000
ordinary call-chain safe-point budget and direct visible WebGL presenter, clean
runs measured 77/203/127 and 101/198/132 ms for
menu/transition/Instructions. The best observed global gap is 198 ms and the
repeatable conservative gap is 203 ms. Bundle `d32ed16fe9a3` is the retained
reference.

An attribution-only native profile inflated those windows to 83/680/129 ms,
so its absolute gaps are excluded. In the exact 680-sample transition valley,
generated Java execution occupied 78.7% inclusively and the synchronous call
root 73.1%. Effective self time was distributed across useful bodies rather
than one presentation or dispatch leaf: `dm.b(II)V` 8.24%,
`kj.a(II[ILpc;Z)Z` 5.74%, `kl.a([III)V` 5.74%,
`kl.b([IIIII)I` 4.26%, the two measured `ad` bodies 6.76% combined, and
`ma.a(IIIBI[Ldm;)V` 2.5%. `ma` and the raster leaf reached Ion in that
profile; several large handler/monitor callers remained Baseline.

Further rejected experiments, all removed from the retained bundle:

- Allowing acyclic handler-protected non-void methods to use structured
  continuations measured 60/226/128 ms. Restricting that admission to methods
  with at most 256 code items measured 61/230/122 ms. Both improved some local
  windows but regressed the global floor.
- Partitioning only oversized ordinary adaptive handler/monitor bodies passed
  its focused differential tests but never progressed beyond startup frame 1
  in the browser and printed a guest null pointer. It produced no valid timing
  result and was fully removed.
- Disabling Firefox's 100 KB Ion script-size gate measured 64/221/163 ms. A
  native profile under that switch still labeled the dominant `ma`, `kj`, and
  `kl` bodies Baseline. Lowering Firefox's Ion warm-up threshold from 1,500 to
  10 measured 50/224/142 ms. Script-size and warm-up gates alone therefore do
  not explain the retained floor.
- Encoding generic synchronous-call exceptions as an internal result removed
  roughly half the host catch regions from the large generated callers and
  passed 2,328 exact JIT assertions, including exceptional frame ownership and
  operand restoration. Its clean run measured 54/234/117 ms: Instructions
  improved but the global transition floor regressed, so the option, ABI, and
  tests were removed. The restored suite has 2,326 passing assertions and the
  rebuilt bundle is again exactly `d32ed16fe9a3`.

A live linkage audit after the restoration found all 28 `ma` call sites and all
seven sites in the measured 121-item `ad` body linked to positional targets.
Other apparently unlinked sites had no resolved target, indicating an
unexecuted/cold branch rather than a hot edge stranded behind generic
dispatch. This changes the next premise: the inclusive `tryInvokeSyncAt` stack
is principally the root owning useful nested work, not proof that 73% is helper
self time. The remaining 5x target requires a separate, correctly
differential-tested optimization unit for the useful generated computation (or
an equivalent generic representation change), not another link-release,
presentation, warm-up, or exception-status tweak.

### Rejected ordinary call-loop outliner (September 1, 2026)

A temporary generic structured-loop counter narrowed the periodic transition
work further. In one instrumented transition, the outer call-bearing loop in
`ma.a(IIIBI[Ldm;)V` executed 1,645,712 iterations and invoked one child on each
iteration. Its raster children included 2,091,374 and 1,205,252 iterations in
`dm.b`, 1,298,923 in `dm.a`, and 742,582 in `kl.b`. The absolute profiled gaps
were excluded because the counters inflated them; the counts establish that
the recurring cost is useful call-bearing raster work rather than unresolved
linkage, presentation, or an idle clock window.

Moving the large ordinary `ma` loop into a separate host function exposed a
generic compiler correctness defect: renderer-local materialization callbacks
captured the parent function's stale scalar bindings while the outlined helper
held the current bindings. Synchronizing live state before those cold callback
calls restored exact behavior. Differential coverage for outward labels,
normal completion, and exceptional exits passed all 352 focused outliner and
2,329 JIT assertions.

The corrected design was still rejected on clean complete-frame measurements.
State-buffer synchronization measured 94/230/132 and 91/224/134 ms for
menu/transition/Instructions, compared with an exact disabled control of
71/271/146 ms and the retained 198--203 ms global reference. A compact
fixed-arity synchronization ABI regressed catastrophically to
761/1,012/519 ms. Limiting outlined loops to at most 20 live outputs still
measured 130/374/199 ms. All loop counters, ordinary-outlining options,
compiler support, and tests were removed. Do not retry this extraction model
without a representation that avoids both parent-closure synchronization and
a high-arity scalar ABI; the retained floor remains 198 ms best and 203 ms
conservative.

### Rejected late hot-call-graph fusion (September 1, 2026)

A late, diagnostic-only compilation of `ma.a(IIIBI[Ldm;)V` first discovered
zero connected edges, 19 productive-Wasm boundaries, and nine unresolved
edges. This proved that the earlier broad graph-tier experiment had not
actually fused the dominant root. Interning regenerated bytecode call-site
metadata reduced repeated compilation attempts from 18 to six and retained
ten connected edges. Honoring the existing edge-local proof that a ready Wasm
target was unused then produced a fully connected seven-node graph with 31
edges and no boundaries.

That complete graph executed zero times: `ma` is one long-lived activation
already running before the interactive menu, and publishing a replacement
entry cannot migrate its live locals or program counter. A forced graph for
the recurring `dm.b(II)V` child did execute 11.65 million times, but its 69 KB
module and generic entry guard enlarged the transition gap to 980 ms. Inlining
the unchanged epoch/class/debug guard fast path reduced that to 225 ms.
Bounding production-only entry counters measured 52/239/124 ms for
menu/transition/Instructions. Graph-disabled controls with call-site interning
measured 112/214/214 and 60/229/210 ms, neither beating the retained floor.

All code and diagnostic switches from this experiment were removed. Late
fusion cannot replace an already active root, while entering even the small
child graph remained slower than the ordinary positional path. Do not retry
this representation without either correct pre-start/OSR state transfer or a
substantially smaller child-module ABI. The retained best remains 198 ms and
the conservative repeatable result remains 203 ms.

### Rejected pre-start hot-call-graph fusion (September 1, 2026)

A generic pre-start candidate pass tested whether compiling complete graph
regions before the first guest instruction could avoid the live-activation
problem above. Candidate selection used only bytecode structure and renderer
metadata, with no game or class identity. In Node it found 313 candidates,
attempted the top 16, and produced 14 graphs containing 73 methods. The large
call-bearing root discussed above was selected thirteenth under the root-size
bound and formed a seven-node graph with 31 connected edges, zero boundaries,
and 324,437 bytes of generated source.

The experiment also implemented a sound declared-receiver fast path: an exact
declared class was guarded locally, while any overriding subclass fell back to
the canonical JVM call path. Focused differential coverage passed. In the real
browser, 7,816 methods were preloaded and all 16 graph attempts completed
before the first frame, so the result was not contaminated by late publication.

The clean complete-frame result nevertheless regressed to 319 ms for the
PLAY-to-Instructions transition and 298 ms on Instructions, with maximum upload
costs of only 5 ms and 2 ms respectively. The comparable restored control was
228/118 ms, and the retained best remains 198 ms (203 ms conservatively).
Eliminating graph boundaries by emitting one 324 KB JavaScript optimization
unit increased host compilation/execution cost; publishing 14 other cold large
graphs also worsened the settled screen. All pre-start graph compiler, JVM, and
Deko runtime changes were removed. Do not retry this representation without a
substantially smaller graph ABI or a region backend that keeps its working data
inside Wasm rather than generating another giant JavaScript body.

### Rejected canonical guest-wrapper shape (September 1, 2026)

A post-measurement reachability census inspected 11,178 live guest values
without placing counters in the render loop. It found one stable field-map
layout per sampled runtime class and no field site with multiple resolved
receiver layouts. Primitive and reference arrays were dense plain Arrays with
the same three metadata properties (`type`, `elementType`, and `hashCode`). A
field-vector rewrite or another typed-array switch therefore lacked new
evidence; the earlier matched typed-array JS-path regression remains applicable.

The wrapper itself did expose an allocation-tier split: 769 live `dm` objects
had the canonical literal shape while 47 interpreter-created objects also had
an own `toString` closure. A generic prototype/shape experiment moved one
shared adapter into the canonical object literal for interpreter, compiled,
and Wasm allocation. Focused representation and JRE suites passed 40 and 206
assertions, and the next census proved all 816 live `dm` objects shared one
shape.

Complete-frame behavior nevertheless regressed. The adjacent restored control
measured 241 ms for transition and 113 ms on Instructions. Two treatment runs
measured 260/141 ms and 341/247 ms, while upload remained at 2 ms. The extra
universal wrapper slot cost more than eliminating this limited shape split, so
the implementation and its test were removed. Guest field-map multiplicity and
the interpreter-only `toString` expando are not supported as the current floor
cause; do not pursue a broad object-layout rewrite without execution evidence
that identifies a specific hot property access or allocation pressure window.

### Rejected hybrid dense instance fields (September 1, 2026)

The same reachability census found 65,693 live guest field sites: 41,232 used
their statically resolved declaring key, 3,950 used inherited aliases, and none
required a polymorphic runtime-key cache. A Firefox microbenchmark over 20
million reads measured dense numeric Array slots in roughly 51--74 ms versus
120--146 ms for the existing fully-qualified string properties. That isolated
result justified testing the representation, but did not establish an
end-to-end win.

The temporary generic implementation assigned superclass-first numeric slots
to every declared instance field. Compiled field sites embedded the fixed
slot, while a shared Array prototype exposed named `Owner.field` access for
the interpreter, reflection, JRE stubs, diagnostics, and save-state restore.
There was no guest class, game, or field-name selection. Focused field, JIT,
JRE, and save-state suites passed 47, 2,332, 206, and 12 assertions.

Real complete-frame measurements rejected all three forms. The first
dual-path form measured 233 ms for transition and 162 ms on Instructions. A
smaller generated direct-slot form exposed a costly `Map.get` in the named
compatibility accessor and regressed to 515/548 ms. Replacing that lookup with
a fixed-slot accessor still measured a 1,251 ms transition maximum and 364 ms
Instructions maximum; complete uploads remained only 2 ms. The adjacent plain
field-map control measured 241/113 ms, and the retained best remains 198 ms
(203 ms conservatively).

The numeric microbenchmark was real, but the hybrid representation forced the
rest of the runtime through compatibility accessors and Array-shape guards.
That cost outweighed direct generated-slot reads by a wide margin. The runtime,
compiler, manifest option, and tests were removed. Do not retry a hybrid
numeric/named object shape. A future field ABI experiment would have to move
all interpreter, reflection/JRE, generated-JavaScript, and Wasm consumers to a
single representation before it is worth another browser measurement.

### Packed-array census and rejected field-site interning (September 1, 2026)

A second post-measurement census questioned the remaining live container
shapes. All 7,142 reachable guest arrays were packed ordinary Arrays: zero
holes across 15,611,446 indexed slots, with one consistent metadata suffix
(`type`, `elementType`, `hashCode`) per descriptor. Active frames were shallow
(at most eight in the sampled run), their maximum locals array was 103, and
the maximum live operand stack contained one value. There is no holey-array or
oversized frame-container defect to optimize. The prior typed-array and linear
heap A/B results still reject changing the packed primitive-array storage on
the present JavaScript/Wasm paths.

Compiler metadata did contain substantial duplication. After preparation,
65,609 field-site records represented only 2,189 unique field references; the
35,981 synchronous call-site records represented 18,619 unique caller-PC
edges and 2,111 target signatures. Call-site linkage feedback is edge-local,
and its earlier interning control did not beat the retained floor, so it was
not changed. A temporary generic field-reference interner safely shared field
resolution and receiver-key caches, including a late-class-loading upgrade.
It reduced the live field-site total to exactly 2,189 and passed all 2,332
focused JIT assertions.

Two clean Firefox runs measured 214/117 ms and 237/140 ms for
transition/Instructions, with 1--2 ms uploads. This is not a conservative
improvement over the retained 198 ms best and 203 ms repeatable global floor,
so the interner, runtime option, and test were removed. The duplication is a
real memory/startup inefficiency, but it is not supported as the periodic
complete-frame limiter and must not be retained as a floor optimization.

### Rejected cross-tier raster representation (September 1, 2026)

A differential Firefox fixture compiled in the browser with `javac.js` split
the dominant renderer ABI into three equivalent shapes: a direct static
primitive-array blit, a monomorphic object draw, and a reference-array-loaded
polymorphic draw. Each draw copied the same 8x8 integer raster, and every tier
matched HotSpot's checksum. Timing is reported per completed draw, not per
pixel or presentation.

The stable generated-JavaScript static path measured 0.34--0.44 us, while
structured Wasm over its ordinary imported arrays measured 2.40--2.64 us.
Moving primitive arrays and primitive object fields into linear memory reduced
the Wasm static/monomorphic shapes to 1.02--1.22 us, but adding the real
reference-array plus polymorphic receiver shape raised it to 2.18 us. A
temporary generic numeric dispatch tag followed by direct Wasm-to-Wasm target
calls reduced that last shape to 1.82 us, about 17%, but remained over four
times slower than the generated-JavaScript primitive-array path. The
non-linear-heap polymorphic result was 3.57 us in the longer run. HotSpot
measured 24--28 ns for static/monomorphic and 81--84 ns for polymorphic.

This rules out two broad representation guesses. The packed JavaScript arrays
are not intrinsically the wrong raster storage for the production JavaScript
route, and moving reference arrays or every object into a Wasm handle table
cannot recover the required fivefold complete-frame improvement when the
best-case all-numeric Wasm body is already slower. The costly shape is the
mixed-tier seam: JavaScript owns object references and Wasm owns numeric
storage, so reference lookup, target classification, reference-field access,
and the numeric child cannot remain in one optimizer. The temporary
polymorphic Wasm implementation was removed rather than adding an unused
runtime option without a plausible route to the floor target. The fixture is
retained as a generic compiler benchmark; its browser result reader stores
elapsed microseconds because the deliberately interpreted reference variants
can exceed a signed 32-bit nanosecond counter.

Future representation work must therefore form a smaller complete
JavaScript-native optimization unit around the useful call-bearing raster
loop, with dataflow-derived inputs/outputs. It must not repeat the global
typed-array, dense-field, wrapper-shape, field-site interning, giant fused
graph, or copy-every-live-local state-buffer experiments rejected above.

A follow-up tested the smallest remaining container-access hypothesis rather
than changing storage. The structured-JavaScript renderer temporarily captured
one raw view for a descriptor-proven reference-array parameter only when no
`astore` could rebind that JVM local. This removed the repeated
`array.elements ? array.elements[index] : array[index]` choice from the normal
`aaload` path while retaining the canonical reference, null/bounds fallback,
legacy wrapper arrays, and exact reassignment behavior. All 2,336 JIT
assertions passed before the browser A/B.

The real cached clone+javac.js Firefox treatment measured 199 ms for the first
18 complete frames after the Instructions click, but 289 ms presentation / 295
ms completion on the subsequent 60-frame Instructions sample and 146 ms on
the menu. Its own 295 ms global gap is already worse than the retained 203 ms
floor. The adjacent disabled control measured 230 ms transition and 128 ms
Instructions (with one noisy 513 ms menu outlier); upload remained 0--4 ms in
both. The treatment also reached the hook's 500-frame preparation boundary at
284 seconds versus 230 seconds for control, while the actual preparation work
was the same 76 seconds. The parameter-view implementation, option, and test
were removed. Even a representation branch proven redundant in isolation can
change SpiderMonkey's large generated-function shape adversely; packed-array
storage and its access wrapper are not the supported floor cause.

### Retained transitive Wasm dependency blockers (September 1, 2026)

A generic Firefox dispatch fixture exposed a circular dependency in the Wasm
callee compiler rather than another slow container. A hot caller recorded only
that an acyclic reference-returning factory method lacked a module. The factory
had actually been deferred because its allocation class was not initialized,
but the caller discarded that transitive class blocker. Because an acyclic
callee compiles only when requested by a caller, the caller then waited for the
factory while no dependency transition could trigger the caller translation
that would retry it.

The underlying blocker representation was lossy in two places. Structured
entry-block demotion retained one global blocker set but threw away the exact
entry block's blocker metadata, and reference-return rejection retained only
the selected lowering's causes even when the alternate structured lowering was
recoverably blocked. The generic correction now stores blockers per structured
block, preserves recoverable causes from every viable lowering, and attaches a
deferred callee's concrete causes alongside its method identity at caller sites.
This is dependency-driven; it adds no timer, warm-up retry, guest identity, or
game-specific selection.

On the Firefox fixture the factory and constructor changed from permanently
cold to fully compiled, and the caller changed from 383 exits in six measured
runs to zero exits. In one same-process comparison the corrected structured
path measured 940 ns per tile iteration versus 3,743 ns for the unresolved
dispatcher path; every variant retained the HotSpot checksum. The focused
instance-link suite passed all 78 assertions.

This correctness and generic-linking improvement is retained, but it is not a
claim that the GeoBlox floor target has been met. A clean local-cloner run with
cached javac.js classes and complete-frame measurement produced 50 ms maximum
on the main menu, 217 ms during the PLAY-to-Instructions transition, and 109 ms
on Instructions. Maximum upload cost was 2 ms. The transition therefore remains
at roughly the prior 198--203 ms floor; the remaining limiter is useful raster
and call work, not lost factory linkage or partial presentation.

### Fully unified dense fields and linear primitive storage (September 1, 2026)

The rejected hybrid-field result above did not test one representation across
all consumers: it retained named compatibility accessors around the numeric
slots. A new generic implementation instead gives loaded classes stable,
superclass-first slots and routes the interpreter, generated JavaScript, Wasm,
reflection, `Unsafe`, method handles, and JRE native code through the same field
read/write helpers. It contains no workload identity or Java source change. A
late-loaded Wasm owner exposed and fixed one correctness defect in inherited
slot resolution before measurement. The focused compiler/JRE/field/Wasm suite
passes all 2,753 assertions with this representation enabled.

Dense fields alone reduced an adjacent Instructions maximum from approximately
135 ms to 114 ms, so the unified representation is retained. Re-testing the
generic linear primitive-array heap with the corrected current runtime produced
two complete-frame runs of 63/227/120 and 58/237/122 ms for
menu/transition/Instructions. Adjacent packed-array controls measured
57/255/114 and 75/246/135 ms. The 256 MiB heap is therefore retained because it
improves the conservative global transition floor, although the result remains
far above 40 ms. A separate attempt to move only garbage-collector bookkeeping
arrays to typed storage measured 71/256/128 ms and was removed.

Two further isolated data-structure wins failed end to end and were removed:

- A Firefox microbenchmark made object-property static-field reads faster than
  `Map.get`, but replacing the canonical static maps measured 72/255/114 and
  78/256/114 ms. It did not improve the global floor.
- Numeric class-index lookup was roughly twice as fast as string receiver lookup
  in a 20-million-operation microbenchmark. Adding a parallel numeric positional
  call-site cache changed the generated-function shape and regressed the real
  browser result to 95/349/483 ms. The cache was completely reverted.

These results narrow the representation premise. Fully unified dense instance
fields and linear primitive storage offer modest retained gains; selectively
adding compatibility shapes, alternate static containers, or parallel dispatch
caches does not. The current conservative complete-frame maximum is 237 ms in
the retained configuration, about 5.9 times the 40 ms target. Upload remains
1--3 ms, so the remaining floor is still useful generated raster/call work.
