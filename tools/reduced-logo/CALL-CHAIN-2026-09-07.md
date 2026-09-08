# Call-chain reduction, 2026-09-07

## Outcome: improved, NOT 24 FPS

Local stock Firefox, CPU maximum 900000 kHz. No Firefox profiler during
accepted timing runs. All 32 frames retained, including frame zero. These
are reductions, NOT new measurements of the real Jagex logo/tutorial/gameplay.
No audio is present, so this does not establish audio-underrun acceptance.

| Reduction | Fresh control FPS | Retained candidate FPS | Median ms | p95 ms | First/max ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Procedural call chain | 7.38 | 17.20 (repeat 16.82) | 52 | 99 | 136 |
| Procedural thin-triangle logo | 4.48 | 9.92 | 77 | 305 | 444 |

FPS here is compute-plus-publication throughput. Candidate presentation
interval rates were 16.71 and 10.76 FPS, respectively; they are not identical
clocks. Every frame in both candidate runs exceeded 41.67 ms. Preparation is
outside these clocks; no guest warmup or early guest initializer execution.
Applet initialization is also outside frame timing, so these results do not
bound every post-main startup stall.

The fresh control already includes the prior structured-label compiler fix.
Do not present the new chain as a 2 FPS reproducer: its measured control is
7.38 FPS. The larger thin-triangle fixture retains the historical 2.30–2.32 FPS
reproduction before that earlier fix.

## Reduction and causal findings

`LogoCallChain.java`: step -> triangle -> clipping submit -> protected span
-> integer mask. Each frame issues 2304 triangles x 32 rows = 73728 span calls,
alternating zero/two-pixel spans and writing 73728 pixels. Coordinates and
colors are procedural. Exception handlers, array semantics and integer
overflow remain guest Java operations. Nothing is captured from game playback.

The pure integer helper was not eligible for compile-time inlining while its
class was cold. Consequently a tiny helper retained a general protected-call
boundary in the span even after preparation. New opt-in
`prepareColdIntegerInlines` plans eligible declared pure integer helpers
without initializing their class. A symbolic initialization token is tested
at the original invoke; a cold/initializing/erroneous target restores the
original operands and invoke PC for canonical execution. Synchronized,
native, abstract and inherited-owner cold cases are excluded. The scalar
emitter remains conservative. This raised the chain to 12.57 FPS and logo to
7.15 FPS before the other selections below.

Existing checked-leaf positional calls brought those to 13.29 / 8.31 FPS.
Component timing then isolated composition as another material cost:

| Component median | Chain JS selection | Chain selective Wasm | Logo JS selection | Logo selective Wasm |
| --- | ---: | ---: | ---: | ---: |
| Render/checksum | 50 ms | 45 ms | 81 ms | 69 ms |
| Compose | 21 ms | 4 ms | 17 ms | 5 ms |
| Publish | 4 ms | 3 ms | 3 ms | 3 ms |

New opt-in `preparedLoopLeafWasm` selects only already-prepared, ready,
fully compiled call-free loop modules, retaining the exit-storm fallback.
It reuses the existing Wasm backend rather than widening externref call
graphs. Both retained candidate runs reported zero synchronous post-main
compiles. Main-runtime installation and engine JIT costs are not separately
bounded by this census.

The remaining clipping/span boundary still carries substantial generated
frame-restoration and suspension machinery: captured restoring sources were
about 11.4 KB for triangle, 9.6 KB for submit and 3.6 KB for span. That is a
specific next refactoring target, not proof that deleting those semantics or
blindly fusing everything will reach 24 FPS.

## Rejected experiments

- Broad prepared Wasm upgrades: 8.17 / 5.09 FPS (chain/logo).
- Existing hot regions: 8.16 / 8.53; also two post-main region compiles in chain.
- Cold prepared-region experiment: 9.28 / 5.51, zero post-main compiles but
  slower. Experimental compiler changes were removed; raw results and its
  manifest remain historical artifacts, not a supported current option.
- Scalar positional calls combined with the retained candidate: 13.94 / 7.47.
  Keep this experiment disabled.

## Verification and reproduction

`results/leaf-wasm-pixels/{chain,thin4}.json`: each matches all 2,419,200
raster pixels against separately generated HotSpot oracles. These verification
runs are explicitly excluded from performance acceptance. Checksums:
chain 1619828224; thin4 2134137715.

Focused final seven-file test run: 182/182 checks, covering prepared integer
inline planning/transport, real initializer ordering, leaf-Wasm selection,
cold JS/Wasm statics, cooperative call suspension, scalar positional calls
and capture descriptors. No tests were dropped. This is not a full-suite or
real-game regression claim. The earlier focused eight-file run passed 362
checks before the additional initializer-order test and leaf-Wasm test.

Retained configuration: `runtime-leaf-wasm.json`. New runtime switches default
off; the shared game bundle has not been replaced. Source edits are local and
rsynced to NUC; no commit or reset.

```sh
node tools/reduced-logo/build.cjs /tmp/logo-chain-build
node tools/reduced-logo/server.cjs /tmp/logo-chain-build/fixture.jar BUNDLE tools/reduced-logo/runtime-leaf-wasm.json 18136 /tmp/logo-oracles
node tools/reduced-logo/run-matrix.mjs http://localhost:18136 RESULTS chain thin4
node tools/reduced-logo/run-matrix.mjs 'http://localhost:18136/?verify=pixels' PIXEL_RESULTS chain thin4
```

Host oracle: compile the Java sources with host javac, then
`java -cp HOST_CLASSES LogoCallChain /tmp/logo-oracles/oracle-chain.bin`.
Use the existing LogoPixelOracle for thin4. Host oracle generation is a
correctness comparison, not a new apples-to-apples HotSpot timing result.

Raw directories: `results/{chain-control,cold-inline-v2,cold-inline-leaf,
components,leaf-wasm,leaf-wasm-repeat,leaf-wasm-pixels,prepared-region,leaf-scalar}`.
Control and intermediate runs use the pre-component-timer jar; `components`
and `leaf-wasm` use the identical component-timer jar for the compositor A/B.

Retained artifact SHA-256:

- Component jar: `79ca062571abcb1e1a9425a4c3f2188daf403eefc888328c5c2312ae2992614f`
- jvm-debug.js: `5499a45da94ea569011d5442b0564d34f281f715a33ac23ffb66cd05a74d2d3d`
- Chain oracle: `5e7b5bbfcc9358bd377a4c3593ed5bdba25170d6907575af6aa0424e00137190`
- Thin oracle: `bdeda7b9c2d6628d1a7c1a6933fede0e96dad3ad296242d6e95acb459e7d32e1`

Authoritative repositories inspected: java-tools HEAD 32911e3, dekobloko-work
HEAD e44fe9f, both with preserved uncommitted work. Preparation-contract scope
is `docs/refactor.md`. 24 FPS remains an open requirement, not an established
impossibility and not an achieved outcome.
