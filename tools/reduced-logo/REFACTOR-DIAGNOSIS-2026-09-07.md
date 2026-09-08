# Why the optimized logo reduction is still slow

## Decision

Refactor **prepared call planning and frame-free leaf admission** first, not
the whole JVM. There is a demonstrated gap between an inline the compiler can
prove safe structurally and one it admits during pre-main preparation. This
turn diagnoses that gap; it does not implement a new production call policy.

## Evidence from the fixed runtime

A separate Firefox sampling run of the label-fixed `thin4` workload attributed
7,969 samples to generated methods. Of these, 2,149 were nearest the span's
adaptive body in Ion and 1,123 nearest its positional-entry adapter in Ion:
41.1% combined. These are attribution counts, not exclusive CPU percentages
or percentages of all elapsed time. Sampling timings are not accepted FPS.

The runtime's generated-code metadata explains the selected path:

- The span has 47 normal reachable bytecodes, but an approximately 10.8KB
  adaptive JS body and a canonical-frame positional adapter.
- Its restoring direct body is refused with:
  `handler-protected non-void call requires a canonical caller frame`.
- The only normal Java child is `LogoRasterState.mask(int,int)`, simply `a & b`.
- The adapter resets/reuses a Frame, locals, operand stack and continuation
  state on each span entry, including spans with little or no pixel work.
- The earlier work census found 2,291,527 span entries and 2,261,113 pixel
  writes over 32 frames: roughly one written pixel per span entry on average.

The underlying preparation mismatch is in `getCompileTimeIntegerLeaf`:
it returns null unless the class is already INITIALIZED. In a fresh preloaded
JVM, `LogoRasterState` has no initialized state and the method returns null;
`getInlineIntegerPlan` already produces the two-argument bitwise expression
with no guards and one method. Thus structural planning succeeds, but the
initialization-state gate prevents its use in prepared caller compilation.

The renderer then sees an ordinary protected non-void call and correctly
retains canonical frame ownership for potential child suspension. Later
linking produces a fast integer helper entry, but does not redo the span's
earlier body admission. Removing the protected-call safety check would be the
wrong fix: genuine suspending callees still need exact return ownership.

## Causal Java-source A/B (not a delivered runtime optimization)

`build-inline-mask.cjs` builds a separate diagnostic fixture, changing only
the span expression `mask(value, constant)` to `value & constant`. It uses
the same procedural geometry, pixel operations, checksums, surface publication,
runtime bundle/settings and 32-frame measurement. No replay or guest warmup.
The original fixture remains unchanged. This removes a pure helper invocation
and changes the compiler's choice of call ABI; it is not an isolated estimate
of adapter cost alone.

| Same-session run | thin4 FPS | First ms | Median ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source-inline first | 7.958 | 540 | 91 | 313 | 540 |
| Unmodified control | 5.103 | 572 | 174 | 368 | 572 |
| Source-inline repeat | 7.382 | 461 | 109 | 358 | 461 |

Raw results: `results/mask-inline-first`, `results/mask-control-now`,
`results/mask-inline-repeat`. CPU cap: 900MHz, local stock Firefox, no sampling
profiler for these runs, zero post-main JVM compiles. Runtime timings exclude
applet initialization and the 1ms post-frame yield. The fresh 5.10 FPS control
is faster than earlier 3.77–4.67 results; use the current control rather than
claiming a clean 2x gain against yesterday's number.

After source inlining, the span obtains a 5,109-byte restoring direct body;
the triangle's call links use it instead of the canonical-frame adapter.
This is evidence of useful headroom, not proof that this refactor alone will
reach 24 FPS. Even 7–8 FPS and 461–540ms cold frames remain unacceptable.

The separate verification run matched all **2,419,200 raster pixels** against
the unchanged HotSpot oracle (`results/mask-inline-exact-pixels.json`). Its
timings are excluded from performance acceptance.

## Proposed bounded refactor

1. Separate structural inline planning from execution readiness. Prepare
   verified small pure integer bodies before class initialization, recording
   symbolic targets, effects and initialization requirements explicitly.
2. Generate guarded prepared fast bodies plus canonical fallbacks. An
   uninitialized target must execute through the ordinary path at the original
   Java initialization boundary, never initialize early or skip `<clinit>`.
   Once ready, select already-prepared code without post-main compilation.
3. Let frame-free admission consume the lowered call plan. An admitted pure
   inline is arithmetic, not an independently suspending child. Keep actual
   exception/suspension paths and reconstruct exact frames only when needed.
4. Test initialization side effects/failure/inheritance, debugger invalidation,
   transport, overflow and throwing guards, protected return operands, and
   scheduler/audio deadlines. Gate on the existing full-raster oracle and
   cold frame distributions; then remeasure real logo/tutorial/gameplay.

Do not remove exception handling, enlarge audio buffers to hide stalls, warm
guest code before main, or add guest-name intrinsics. A whole heap/backend
rewrite is not yet justified by this experiment. The remaining triangle body,
composition cost and cold host-JIT transitions require further measurement.

Large profiles/generated-source captures are archived under
`/home/kreijstal/work/deko-firefox/logo-reduction-iteration/`:
`logo-label-profile.json`, `logo-label-generated.json`, `logo-inline-generated.json`.
`capture-generated.mjs` reproduces the read-only body/link inspection.
Diagnostic fixture provenance: `results/mask-inline-provenance.json`.
