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
  target. The current target is a 10 FPS non-idle floor.

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
