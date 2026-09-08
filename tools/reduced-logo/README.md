# Procedural logo renderer reduction

Latest diagnostic: [cold call completion refactor](COLD-COMPLETION-2026-09-07.md)
did not demonstrate a throughput win and remains disabled.

Latest iteration: **16.8–17.2 FPS** for the new `?mode=chain` reduction and
**9.92 FPS** for `?mode=thin4`. Neither passes 24 FPS or cold-frame pacing.
See [call-chain results](CALL-CHAIN-2026-09-07.md) for fixes, controls and pixel verification.

Original reproducer: `?mode=thin4`, **2.32 / 2.30 FPS** in local stock Firefox.
The first general compiler fix improves it to **3.77–4.67 FPS**; see
[optimization results](OPTIMIZATION-2026-09-07.md). Cold spikes remain unacceptable.
Control: `?mode=full4`, square tessellation (~3.8 FPS). See the
[iteration report](ITERATION-2026-09-07.md) for evidence and limitations.

Twelve procedural boxes use source-isolated Java raster kernels, not captured
geometry, game assets, serialized state or replay. `LogoDetailWorkload` changes
4x4 face cells to 16x1 cells at fixed triangle count (2,304/frame). Raster size
is 540x140; fade/composite/publication size is 640x480. `LogoFlatDispatch`
contains the slow flat triangle/span path. `LogoMeshRenderer` handles mesh and
material dispatch; `LogoTriangle` retains the Gouraud alternative.

The original `split` / `fused` modes remain negative controls. Preparation
compiles without guest warmup. All 32 frames include cold frame zero. Timings
include raster/checksum, composition and AWT publication, excluding applet
initialization and the following 1ms yield. There is no audio workload.

From the repository root (sibling `java-tools` required):

```sh
node tools/reduced-logo/build.cjs /tmp/reduced-logo-build
node tools/reduced-logo/server.cjs /tmp/reduced-logo-build/fixture.jar BUNDLE RUNTIME.json 18123 /tmp/logo-oracles
# Open http://localhost:18123/?mode=thin4 in local stock Firefox.
# Existing Marionette helper on port 9226 required for automation:
node tools/reduced-logo/run-matrix.mjs http://localhost:18123 RESULTS thin4 full4
```

`build.cjs` records provenance and excludes host-only tests/counters. Use the
same runtime bundle and manifest for both arms. Correctness and work census:

```sh
javac --release 8 -d /tmp/logo-host tools/reduced-logo/*.java
java -cp /tmp/logo-host LogoReductionTest
java -cp /tmp/logo-host LogoFrameBenchmark thin
node tools/reduced-logo/census.cjs /tmp/reduced-logo-build/fixture.jar
mkdir -p /tmp/logo-oracles
java -cp /tmp/logo-host LogoPixelOracle 4 /tmp/logo-oracles/oracle-thin4.bin thin
# Open ?mode=thin4&verify=pixels to compare every raster pixel.
```

Oracle data is expected output, never rendering input. Verification timings
are not accepted performance results. Census instrumentation is host-only;
never time that jar. HotSpot's benchmark excludes AWT/device publication.

For the actual matching game build, `gb.field_f:I` is the logo counter;
`eh.a(III)V` draws at nonnegative values and `wj.f(I)Z` completes above 250.
Use the last zero before tick 1, excluding initialization/preprocessing.
`../reduced-runtime-gap/measure-logo.mjs` records this phase plus screenshots
while the presentation timestamp probe is attached. Report sampling runs
separately from accepted unprofiled measurements.
