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
showed about 2.2 FPS. Two clean runs with the latest retained scheduler cap
measured 8.14 and 7.41 FPS average, 3.96 FPS one-second-window floors, and
maximum continuously active gaps of 583 and 524 ms. The conservative retained
maximum is therefore 583 ms, equivalent to a 1.72 FPS instantaneous floor.
This improves the earlier 629 ms gap but is not a completed fix.

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
remaining 629 ms maximum gap therefore has a different cause and remains to
be attributed.

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

1. correlate the remaining exact 629 ms active gap with scheduler activity at
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

Do not reintroduce the rejected Wasm-heap, forced-Wasm, opaque-blit, or
exception-status experiments without new evidence that changes their measured
premises.
