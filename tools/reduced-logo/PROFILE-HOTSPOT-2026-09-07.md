# Procedural logo: current profile and rejected runtime experiments

## Outcome

No new throughput win in this iteration. Keep `runtime-leaf-wasm.json` and the
previous accepted leaf-Wasm bundle. All new runtime experiments remain opt-in;
the shared game bundle was not replaced. 24 FPS and smooth cold frames are not
achieved. These are procedural reductions, not measurements of the actual game,
tutorial, or audio underruns. No replay or captured geometry was used.

Local stock Firefox, CPU capped at 900 MHz. Fresh 32-frame runs include frame
zero, with no guest warmup. Other user applications were left untouched.
Fixture JAR SHA-256:
`79ca062571abcb1e1a9425a4c3f2188daf403eefc888328c5c2312ae2992614f`.

## HotSpot comparison

Local OpenJDK 26, same fixture JAR first on the classpath, plus the host-only
`LogoFrameBenchmark` driver:

```
java -cp /tmp/logo-chain-components.jar:/tmp/logo-profile-host LogoFrameBenchmark thin
```

Two fresh processes completed 32 rendering/composition frames in 349 and 356 ms,
with first frames of 53 and 50 ms. Raster checksum 2134137715, composed surface
checksum -829779237. The host excludes AWT publication; Firefox includes it.
The host driver also computes an untimed surface checksum between frames.
Thus this is a useful backend comparison, not an identical presentation test.

A separate diagnostic run with `-XX:+UnlockDiagnosticVMOptions
-XX:+PrintCompilation -XX:+PrintInlining` shows C2 inlining the 288-bytecode
span into four of six hot triangle call sites, including its integer mask.
Two other span sites were too large. The 1468-bytecode triangle and 1542-bytecode
mesh renderer were compiled separately rather than inlined into their callers.
Different Java compiler output is not the explanation: this used the exact
frontend-produced JAR that Firefox executes.

## Firefox profile

One 1 ms sampled profile with JS and native stacks, isolated to our browser
content process. Profiling was stopped before timing comparisons. The profiled
run itself was 4.93 FPS and is NOT a performance acceptance result.

Nearest-generated-frame attribution of 5018 guest samples:

| Generated body | Samples | Tier observation |
| --- | ---: | --- |
| Span restoring | 990 | 974 Ion |
| Triangle restoring | 909 | 514 Ion, 383 baseline |
| Step adaptive | 668 | 423 Ion, 241 baseline |
| Mesh scalar | 585 | 384 Ion, 188 baseline |
| Mesh restoring | 462 | 136 Ion, 318 baseline |
| Flat dispatch restoring | 351 | Mostly baseline |
| Mesh adaptive | 265 | 253 baseline |
| Compositor Wasm | 195 | Already accelerated |

These are sampled attribution counts, not exclusive CPU percentages. Total
guest attribution: Ion 2584, baseline 1924, interpreter tier 152, unknown 358.
Preparation samples were excluded from this breakdown.

Mesh restoring/adaptive bodies are approximately 125/131 KB; triangle bodies
118/112 KB. Span is 6 KB and already reaches Ion, so attributing the entire gap
to Firefox never optimizing would be incorrect. Cost is distributed across
large mixed-tier callers, cross-method calls and the inner loop. The generated
span still has per-access exceptional paths, an initialization guard and a
budget poll. Its decrement/XOR loop is not admitted by the current increasing-
counter range proof. Any broader admission must prove overflow, bounds,
exception ordering and suspension semantics rather than force-enable a leaf.

Raw profile, generated metadata and HotSpot log are retained locally under
`/home/kreijstal/work/deko-firefox/logo-reduction-iteration/`:
`current-runtime-profile.json`, `current-runtime-metadata.json`, and
`logo-hotspot-inlining.log`.

## A/B experiments

All results below are unprofiled compute-and-publication FPS. Controls were
rerun during this iteration; do not compare these against an earlier peak.

| Experiment | Logo FPS | Contemporary control | Decision |
| --- | ---: | ---: | --- |
| Wide capture-free restoring spills | 6.91 | 8.39 | Disabled |
| Prepared complete-body Wasm selection | 5.51 | 8.65 | Disabled |
| Raw restoring-body ABI | 8.29 | 8.65 | No demonstrated win; disabled |
| Caught-call helper ABI | 4.47 | 7.98 | Disabled |
| Caught-call ABI plus wide spills | 4.04 | 7.98 | Disabled |
| Per-call-site caught-call helpers | 4.21 | 7.98 | Disabled |
| Normal-path-only optional-array analysis | 7.80 | 8.24 | Disabled |

The last experiment separates handler-only null diagnostics from normal-path
optional arrays. This restores a scalar array-storage view, but does not show
a throughput win: chain also fell from 14.63 to 13.86 FPS. Logo median was
97 versus 96 ms; p95 335 versus 296 ms; first/max 500 versus 512 ms. All 32
raster frames match the HotSpot oracle exactly for both reductions (2,419,200
pixels per reduction). Verification runs are not used for timing.

Options: `structuredWideCaptureFreeRestoring`, `preparedCompleteWasm`,
`rawRestoringCalls`, `caughtRuntimeCalls`, `normalPathArrayOptionality`.
They default off. The array-analysis candidate bundle was measured before
adding the opt-in gate; its measured behavior corresponds to that gate on.
No new candidate is an accepted replacement runtime.

## Validation and next architectural target

Focused 11-file suite: 1098 checks passed. This covers prepared compilation,
transported bodies, precise frame restoration, class initialization, exception
identity, active children, asynchronous refusal, scheduler suspension and
handler-mutated locals. New array tests additionally compare interpreted and
compiled null, bounds, zero-trip, optional and sibling-array behavior. No tests
were dropped; this is not a full-suite claim.

The wide-spill prototype initially lost cold locals outside its previous slot
limit; its new differential test caught this and the final version preserves
the full layout. Moving catches into shared or per-site wrappers substantially
regressed despite smaller caller bodies. Selecting a complete Wasm caller alone
also regressed: cross-backend boundaries remain, so more Wasm selection is not
itself a solution.

Next justified work is compiler-level verified span-loop inlining or a coherent
typed compiled-call backend, with cold exception/suspension state separated
from the hot IR. HotSpot demonstrates the inlining opportunity. It does not
prove that the same transformation will reach 24 FPS in Firefox. Continue
checking first frame, p95/max and exact pixels, then remeasure real game phases
and audio before making a playability claim.
