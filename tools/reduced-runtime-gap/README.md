# Reduced Java execution-gap reproducer

**Update:** runtime changes bring the unchanged nested-call Java workload to
28.6–29.4 presented FPS. See [HotSpot comparison and iteration results](ITERATION-2026-09-07.md).
The original measurements below remain the baseline; cold spikes are not fixed.

This **synthetic** reduction reproduces approximately 2 FPS in local throttled
stock Firefox. It is not extracted GeoBlox code, and does not prove that every
game slowdown has the same cause. No runtime special cases are required.

`ReducedRuntimeGap.java` is the standalone Java workload and correctness
oracle. `ReducedGapApplet.java` adds AWT presentation and per-frame timings.
The page serves the same jar in both modes:

- **split:** nested Java virtual calls for raster shading and PCM generation;
- **fused:** the identical arithmetic written directly, with identical arrays,
  state updates, dimensions, block count and publication path.

Each cold run has 24 frames at 320x240, eight voices, four 256-frame stereo PCM
blocks per visual frame, and first-use voice allocation at frames 8 and 16.
There is no artificial workload multiplier, frame-rate cap, or guest warmup.
A 1 ms sleep after each publication allows the browser to present; it is the
same in both modes. All frames, including cold frames and transitions, count.

PCM is **computed, not played**. Four blocks represent about 46.4 ms at 22050
Hz, but the fixture does not impose a real-time audio deadline. This first
reduction isolates execution overhead; it is not an audio-underrun acceptance
test or a 3D rendering benchmark.

## Measured 2026-09-07

Local Firefox 154, the user's throttled machine, isolated foreground tab.
No sampling profiler during these measurements. Both arms use the same
runtime configuration and fresh guest state. Order: split, fused, fused,
split. Preparation is outside execution; no guest work is moved before main.

| First pair | Nested calls | Direct arithmetic |
| --- | ---: | ---: |
| Presented FPS (23 inter-presentation gaps) | 1.66 | 38.98 |
| Java compute + publication FPS (all 24 frames) | 1.70 | 38.59 |
| First frame | 665 ms | 89 ms |
| Median frame | 584 ms | 19 ms |
| Worst frame | 665 ms | 89 ms |
| Post-main synchronous JVM compilations | 0 | 0 |
| Final checksum | -1348238077 | -1348238077 |

The second direct-arithmetic run measured 43.89 presented FPS, with a 71 ms
first/worst frame. This does not meet a strict 41.7 ms worst-frame target.
The second nested-call run measured 1.98 presented FPS, with a 592 ms first
frame and 599 ms worst frame. All four checksums matched and all four had
zero post-main synchronous JVM compilations.

NUC HotSpot's standalone oracle: split 29 ms, fused 27 ms for 24 computations.
NUC java-tools Node execution: split 2685 ms, fused 108 ms. These exclude AWT
and compare computation, not browser FPS. The oracle checks every pixel and
the final PCM block after every frame, persistent voice positions, and a
rolling checksum including every generated PCM block. Both passed.

Conclusion: the same small Java computation can run above 24 presented FPS
when its call structure is removed, while nested calls put it near 2 FPS.
This supports investigating generated call-path overhead. It does not prove
the entire game can reach 24 FPS, isolate each helper's cost, or reproduce the
game's multi-second freezes. The generated-method-size hypothesis also needs
its own reduction; this fixture does not deliberately manufacture huge methods.

Tested bundle SHA256:
`a880e6302df494bfd421f47319f95fef206493de401ab56956bad7ead08e63b8`.
`runtime.json` records the JVM options. The experimental suspension-retention
policy is enabled in **both** arms. No shared launcher settings were changed.

## Run

Compile and check on HotSpot (JDK 9+):

```sh
mkdir -p /tmp/deko-reduced-gap-classes
javac --release 8 -d /tmp/deko-reduced-gap-classes ReducedRuntimeGap.java ReducedGapApplet.java
java -cp /tmp/deko-reduced-gap-classes ReducedRuntimeGap
jar cf /tmp/deko-reduced-gap.jar -C /tmp/deko-reduced-gap-classes .
```

Serve against a built java-tools bundle directory containing its lazy chunks:

```sh
node server.cjs /tmp/deko-reduced-gap.jar /path/to/java-tools/dist runtime.json 18106
```

Open `http://localhost:18106/?mode=split`, then `?mode=fused` in the same stock
Firefox. Wait for `completed` each time. The page exposes `window.gapResult`,
including raw frame times, presentation gaps, checksum and compilation census.
Preparation duration is observational (250 ms polling), not an exact main
boundary. Timing arrays are guest compute/publication times; presentation gaps
come from the runtime's AWT completion records, not physical display scanout.

`collect.mjs OUTPUT.json` optionally exports from the existing Marionette
helper at port 9226; it is not required to run the page. Raw results are kept
in the `results` directory. Source edits were local, then rsynced to the NUC.
