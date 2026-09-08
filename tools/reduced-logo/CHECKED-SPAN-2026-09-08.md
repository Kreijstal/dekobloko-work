# Compact checked span: parked, no repeatable win

No candidate was promoted; no full restoring-body insertion variant was added.
The accepted `runtime-leaf-wasm.json` and its game bundle remain unchanged.

## Attribution before implementation

Two Firefox 1 ms sampled JS/native profiles mapped generated source lines to
compiler-owned call-region markers, distinguishing restoring/adaptive/scalar
caller bodies and engine tiers. CPU-delta-weighted selected-site attribution:

| Diagnostic | Selected site inclusive | Span subtree | Nearest-generated CPU denominator |
| --- | ---: | ---: | ---: |
| A | 306.946 ms (6.75%) | 213.318 ms (4.69%) | 4546.083 ms |
| B | 326.118 ms (7.44%) | 207.170 ms (4.73%) | 4382.119 ms |

Almost all selected-site attribution belongs to the restoring caller. Its
site-local code/helper remainder is 88.404/115.243 ms. Most span samples are
already Ion. One scalar span sample in B (0.695 ms) is outside mapped markers;
it is not assigned to the selected site. Raw profiles, generated source and
sample stacks are in `results/site-profile-2026-09-08-{a,b}`.

These are sampled nearest-generated/subtree CPU attributions, including helper
descendants and startup, **not exclusive CPU or full-frame speedup forecasts**.
The approximately 7% is a prioritization constraint. Other sites were not
assumed to have the same benefit or cost.

## Compact experiment

`CheckedSpanExperiment.js` is an explicit, default-off diagnostic proof of the
frozen bytecode shape, not a general transformation. Both placements use the
same 570-character checked representation at triangle instruction 365.
Separate-callee placement changes representation; inline placement additionally
removes that source-level call boundary. Firefox may itself inline a callee;
this experiment does not force engine-level placement.

Integer arguments, Int32 storage, bounds, overflow, division safety, initialized
class/field links, debug/runnable state and canonical target identity are
checked before writes. Counts above 254 retain the original call and its polls.
The loop proof requires count+1 header visits below the original poll budget.
Every unsupported case falls back before compact-path writes, preserving the
original partial-write exception, handler and suspension protocol.

Both counted oracle runs execute the compact path and match all 2,419,200 pixels.
Counter and oracle runs are not performance results. 83 kernel checks and 74
frozen-fixture integration checks pass, including actual caller execution,
transported callers, null/bounds/division recovery, long-loop suspension,
target/debug/blocked/unready-link guards. The existing 104 insertion checks
also pass. Fixture integration is explicitly run with
`CHECKED_SPAN_JAR=/tmp/logo-chain-components.jar`.

## Clean comparison

Stock local Firefox, 900 MHz; same new bundle with option off for control.
No profiler or entry counters. Every run includes all 32 frames, including
frame zero; no guest warmup or synchronous post-main compilation. Positive
change means slower, relative to mean frame time of adjacent controls.

| Placement | Repeat 1 | Repeat 2 | Repeat 3 |
| --- | ---: | ---: | ---: |
| Compact callee | +13.11% | -2.58% | +6.27% |
| Compact inline | +4.67% | +6.87% | +13.19% |

The small callee win did not repeat. Both candidates are parked without another
implementation round. Raw clean results: `results/checked-span-clean-2026-09-08`.
All frame times and spikes are retained. The earlier
`results/checked-span-matrix-2026-09-08` batch overlapped a background file search
and is preliminary only; it is not used for acceptance.

Frozen JAR SHA-256:
`79ca062571abcb1e1a9425a4c3f2188daf403eefc888328c5c2312ae2992614f`.
Compact comparison bundle SHA-256:
`da5745e2ba120973b249f92bab1834f74a721aaf2185934ac1a9614efc975123`.
Accepted game bundle SHA-256:
`5499a45da94ea569011d5442b0564d34f281f715a33ac23ffb66cd05a74d2d3d`.

Baseline real-game profiling is an independent next step, not contingent on
candidate promotion. No playability or audio improvement is claimed here.
