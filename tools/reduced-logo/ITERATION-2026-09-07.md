# Source-guided logo reduction: reproduced 2 FPS

The procedural Java fixture now reproduces **2.319 / 2.297 FPS** in local stock
Firefox on the 900MHz-capped computer, retaining cold frame zero. This is not
a new full-game measurement or a runtime fix. The previously measured actual
logo was 2.3137 presented FPS (25 frames / 10.805s, maximum gap 1243ms).

Geometry is generated, not captured or replayed. Read-only real-logo metadata
at animation tick 1 found 16 meshes, 2,604 triangles, 1,178 normals and 1,290
vertices (`results/logo-geometry-metadata.json`). No coordinates were retained.
The fixture uses twelve boxes and 2,304 triangles per frame.

## Controlled measurements

Both arms use 540x140 raster and 640x480 fade/composite/AWT publication over
32 frames. Only face tessellation changes: 4x4 cells (`full4`) versus 16x1
cells (`thin4`). Triangle count and box dimensions stay fixed. Edge rounding
differs, so these two layouts are not pixel-identical to each other.

| Mode / run | Compute + publication FPS | First ms | Median ms | p95 ms | Maximum ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| thin4 / first | 2.319 | 771 | 402 | 539 | 771 |
| thin4 / repeat | 2.297 | 779 | 413 | 551 | 779 |
| full4 / first | 3.752 | 548 | 250 | 437 | 548 |
| full4 / repeat | 3.815 | 566 | 247 | 429 | 566 |

Raw results: `results/thin-first/` and `results/thin-repeat/`. Each run recorded
32 presentations, zero post-main JVM compiles and no active sampling profiler.
Applet initialization and the following 1ms yield are outside the frame timer.
There is no guest warmup. These are not full-game presentation FPS measurements.

Separate host-only instrumentation (`census.cjs`) counts work over 32 frames:

| Layout | Triangles | Triangle-row steps | Span entries | Written pixels |
| --- | ---: | ---: | ---: | ---: |
| Square | 73,728 | 1,065,263 | 1,063,331 | 2,252,892 |
| Thin | 73,728 | 2,293,886 | 2,291,527 | 2,261,113 |

Thin triangles cause about 2.15x as much row traversal with only 0.36% more
pixel writes. The reduction exposes disproportionate scanline traversal /
tiny-span cost, rather than merely more triangles or pixels. It does not
establish the actual glyphs' triangle-aspect distribution.

A separate sampling run attributed 4,934 nearest-generated samples to the flat
triangle scalar method in Ion and 1,281 to the flat span in Ion, out of 7,681
generated-attributed samples. This is not simply failure to reach Ion. These
are sampled attribution counts, not exclusive CPU percentages.

## Source-guided experiments

1. Exception-shaped original triangle/span: 33.30 FPS; insufficient.
2. Isolated Java `wh.a` -> `jf.a` triangle/span: 14.04 FPS.
3. Added `nb.a` ordering/dispatch: 13.45 FPS.
4. Added `hi.a` mesh/material processing: 12.84 FPS.
5. Tessellation approaching measured model complexity: 12.69, 8.47, 6.40,
   5.28 FPS at densities 1 through 4.
6. State-shaped versus direct projection: 5.11 versus 5.13 FPS; negative.
7. Source flat path `gi.a` -> `sd.a` -> `ib.a`: 3.98 FPS versus Gouraud 5.08,
   with matching raster pixels in this A/B.
8. Full-surface composition/publication: 3.82 FPS.
9. Thin tessellation at fixed triangle count: 2.32 / 2.30 FPS.

Isolated methods/fields are renamed. Fixture omissions include game face-group
merge ordering, textures, clipped geometry and invalid debug-tag paths. These
are source reductions, not production runtime special cases. No runtime
changes, dropped tests or call-identity intrinsics were added.

## Correctness and HotSpot

`results/thin-exact-pixels.json` checks all **2,419,200 raster pixels** against
HotSpot. That verification-only run has `performanceAccepted: false`. It does
not compare every final compositor pixel. Thin checksum: 2134137715; square:
2045229082. Host javac and javac.js thin oracle files matched byte-for-byte.
`LogoReductionTest` passed 9,676,800 pixel positions across direct/state and
flat/Gouraud alternatives.

Same-machine HotSpot, same CPU cap, test browser idle:

| Layout / process | 32-frame total ms | First / maximum ms |
| --- | ---: | ---: |
| Square 1 | 229 | 44 / 44 |
| Thin 1 | 223 | 40 / 40 |
| Square 2 | 241 | 38 / 38 |
| Thin 2 | 230 | 39 / 39 |

`LogoFrameBenchmark` includes raster and full-surface composition/copy but
excludes AWT/device publication. Firefox thin totals are about 13.8–13.9s;
this is therefore not a pure engine-only speed ratio. Surface checksums were
-997226961 (square) and -829779237 (thin).

## Provenance and remaining work

`results/thin-provenance.json` records the accepted build. A subsequent source
header documentation edit does not change workload logic.

- Fixture SHA256: `1e4d585707d7dddb4980f8ab84a03590e362c45d40f9af6b27e52dcefe67c979`.
- Runtime SHA256: `cc725ba1061165247adfa80102071a2b21d875a72ca86b2c16c79c6cc0362849`.
- Thin oracle SHA256: `bdeda7b9c2d6628d1a7c1a6933fede0e96dad3ad296242d6e95acb459e7d32e1`.
- Runtime settings: `results/runtime.json`.

Large fixture/oracle/profile artifacts are retained outside the repository in
`/home/kreijstal/work/deko-firefox/logo-reduction-iteration/` on the test computer.

Next: inspect generated flat-triangle loop/span-boundary overhead and test
general runtime changes against this exact-pixel oracle. Then remeasure actual
logo, tutorial and gameplay cold spikes. This result neither proves 24 FPS
attainable nor justifies a whole-runtime rewrite. Audio underruns and full-game
causal coverage remain untested by this renderer-only fixture.
