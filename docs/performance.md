# Performance: startup time and browser frame rate

Two acceptance metrics live here: **post-logo loading time** (native JRE versus
jvm.js, all 44 games) and **complete-frame rate in the browser** (GeoBlox on
Firefox, the worst case in the catalogue). Everything below is measurement;
the runtime changes themselves live in java-tools.

## Measurement rules

- Same class files everywhere: the 353 files produced by `javac.js`. HotSpot
  comparisons use those same files.
- Browser runs go through the Git-cloning page and its cloned `jvm.js`, not a
  local bundle, unless the run is an explicit A/B with `?jvm=local`.
- Confirm the screen visually (screenshot) before trusting a state's numbers. A
  presented-frame count alone does not identify a screen.
- Idle windows are excluded; transition work is **not** idle and counts.
- One presented frame per guest `drawImage`. Never sample a framebuffer the
  guest is still painting -- that inflates fps with partial uploads and tears
  the image. Numbers produced before this rule (anything citing "incremental
  presentation") are not comparable with anything here.
- Average fps does not establish success on its own; report the worst non-idle
  frame gap next to it. Target: ~40 ms max gap (a 25 fps instantaneous floor).
- Check `document.hidden`/`hasFocus`. A background tab throttles rAF to ~1 Hz
  and has repeatedly produced fake "0.9 fps" and "32 s stall" reports.
- Never trust a single run on this machine; repeat back to back.

## Current browser numbers (September 3, 2026)

GeoBlox through the cloning page on `localhost:5173`, Playwright Firefox 146
under Xvfb `:10`, 20 s per state, each state confirmed by screenshot. Gaps are
between consecutive complete presented frames. Two back-to-back runs, reported
as `run 1 / run 2`.

| State | avg fps | 1 s floor | median gap | p99 gap | max gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Main menu | 46.8 / 44.1 | 36.9 / 25.6 | 18 / 18 ms | 66 / 68 ms | 209 / 245 ms |
| Instructions | 14.9 / 13.8 | 12.7 / 12.3 | 61 / 66 ms | 139 / 171 ms | 234 / 565 ms |
| Tutorial (after START GAME) | 12.1 / 12.0 | 8.7 / 9.7 | 72 / 74 ms | 186 / 167 ms | 361 / 315 ms |
| Gameplay (after Space) | 15.0 / 13.2 | 11.7 / 10.8 | 67 / 74 ms | 148 / 132 ms | 318 / 163 ms |

Reference: HotSpot presents ~150 frames/s on the same class files, and ~60
changed frames/s through the fake-AWT launcher.

Menu is presentation-coalesced (guest produces more frames than are uploaded);
in every other state `dirtyMarks == presented`, so those are JVM-bound. Upload
is 12-13 ms/s in the slow states and never the limiter.

Harness: `scripts/measure-geoblox-fps.js`. States are reached by
canvas-relative clicks START GAME (320,158) and INSTRUCTIONS (320,198), with
Space to skip the tutorial.

## Startup: native JRE versus jvm.js

Whole-startup screening (August 12, 2026, OpenJDK 11.0.31, one warm sample per
variant, 88 runs) established two durable facts:

- Generated (owned-decompiler) Java has **no** native-JRE startup penalty:
  original 28.069 s versus recompiled 28.539 s median, and the median of the 44
  paired changes is -0.07%. TerraPhoenix is the one exception (58.205 s ->
  113.554 s) and needs its own investigation.
- The median jvm.js/JRE whole-startup ratio was 11.24x, but those jvm.js values
  came from mixed serial and three-way batch runs, so use them only to locate
  large gaps.

The current acceptance metric is **post-logo loading**, not whole startup: from
the first framebuffer state proving the Jagex logo finished, through archive
decompression, asset/music/sound preparation and menu construction, to the first
qualifying menu surface. Neither probe contains a game, class, method or field
name; both use the same palette/density/frame-history classifier, pinned to one
performance CPU. Target: jvm.js within **1.5x** of the recompiled JRE.

August 13, 2026 catalogue sweep, matched class-tree SHA-256, one clean sample
per runtime (Stellar Shard is a three-run median):

| Game | JRE | jvm.js | Ratio | Result |
| --- | ---: | ---: | ---: | :--- |
| Ace of Skies | 46.295 s | — | >1.877x | fail (lower bound) |
| Arcanists | 48.183 s | 168.325 s | 3.493x | fail |
| Armies of Gielinor | 344.596 s | 256.313 s | 0.744x | pass |
| Bachelor Fridge | 20.367 s | — | — | no logo boundary |
| Bouncedown | 17.381 s | 14.695 s | 0.845x | pass |
| Brick-A-Brac | 43.823 s | — | >4.694x | fail (lower bound) |
| Chess | 36.382 s | 39.439 s | 1.084x | pass |
| Confined | 29.382 s | 49.709 s | 1.692x | fail |
| Crazy Crystals | 85.105 s | 22.348 s | 0.263x | pass |
| Deko Bloko | 49.082 s | 71.959 s | 1.466x | pass |
| Dr. Phlogiston Saves The Earth | 36.318 s | 49.625 s | 1.366x | pass |
| Dungeon Assault | 176.480 s | — | — | crash |
| Escape Vector | 19.613 s | 33.011 s | 1.683x | fail |
| Flea Circus | 27.708 s | — | — | no first frame (900 s timeout) |
| Geoblox | 27.674 s | 23.022 s | 0.832x | pass |
| Hold The Line | 48.622 s | — | >4.209x | fail (lower bound) |
| Hostile Spawn | 61.829 s | 140.797 s | 2.277x | fail |
| Kickabout League | 112.193 s | 49.333 s | 0.440x | pass |
| Lexicominos | 45.446 s | 40.420 s | 0.889x | pass |
| Miner Disturbance | 27.201 s | 45.031 s | 1.655x | fail |
| Monkey Puzzle 2 | 28.291 s | 23.989 s | 0.848x | pass |
| Orb Defence | 29.286 s | 90.975 s | 3.106x | fail |
| Pixelate | 33.836 s | 38.296 s | 1.132x | pass |
| Pool | 48.015 s | 62.189 s | 1.295x | pass |
| Shattered Plans | 50.102 s | 41.207 s | 0.822x | pass |
| Sol-Knight | 21.646 s | 60.801 s | 2.809x | fail |
| Star Cannon | 22.051 s | 25.891 s | 1.174x | pass |
| Steel Sentinels | 75.868 s | 143.065 s | 1.886x | fail |
| Stellar Shard | 22.998 s | 53.641 s | 2.332x | fail |
| Sumoblitz | 59.170 s | 67.304 s | 1.137x | pass |
| TerraPhoenix | 60.962 s | 185.463 s | 3.042x | fail |
| TetraLink | 36.358 s | 46.637 s | 1.283x | pass |
| The Track Controller | 21.653 s | 37.417 s | 1.728x | fail |
| Thirty-Six Card Trick | 15.731 s | 23.255 s | 1.478x | pass |
| Tomb Racer | 108.064 s | — | >5.735x | fail (lower bound) |
| Tor Challenge | 41.656 s | — | — | no logo boundary (900 s timeout) |
| Torquing! | 44.337 s | — | — | crash |
| Transmogrify | 47.405 s | 30.573 s | 0.645x | pass |
| Vertigo 2 | 54.735 s | — | >3.403x | fail (lower bound) |
| Virogrid | 47.419 s | — | >4.338x | fail (lower bound) |
| Void Hunters | 48.769 s | 75.129 s | 1.541x | fail |
| Wizard Run | 30.399 s | 134.919 s | 4.438x | fail |
| Zombie Dawn | 70.922 s | 27.376 s | 0.386x | pass |
| Zombie Dawn Multiplayer | 55.274 s | 148.175 s | 2.681x | fail |

19 of the 33 exact pairs meet the target (median 1.366x); with the six proven
lower-bound failures, at least 20 of 44 games miss it. Tomb Racer, the standing
worst case, was still ~215-221 s against a 24.021 s ceiling after nine series of
JIT work, so **the 1.5x target is not met**.

## What is known about the remaining browser cost

- The workload is not inherently slow: HotSpot runs the identical class files at
  ~150 presentations/s, dominated by useful raster work (`dm.b` 67% self).
- Presentation is not the limiter. Canvas upload is 1-5 ms per frame; a native
  profile of a 491 ms Instructions valley spent all of it before Java frame
  completion.
- The cost is useful call-bearing raster work under one long-lived activation.
  In one instrumented transition `ma.a(IIIBI[Ldm;)V` ran 1,645,712 iterations
  invoking a child each time, with 2.1M/1.2M iterations in `dm.b`, 1.3M in
  `dm.a`, 0.74M in `kl.b`.
- Firefox tiers those bodies asymmetrically: the leaf rasters reach Ion, the
  large generator-continuation activation above them stays Baseline.
- The other ~30% of a slow frame is the audio mixer (`ad.a`, `kj.a`, `kl.a/b`,
  `qk.a/b`, `ng.h`), present on the menu too.
- GC is not the pause: over one 613 ms valley, eight minor collections totalled
  6.43 ms.
- One legitimate workload quirk: the nine-slice panels tile a **1x1** centre
  sprite, so `ma.a` makes ~100k `dm.b(II)V` calls per Instructions frame.
  HotSpot inlines that chain; we pay a call each time.

The remaining ~5x needs a separate correctly differential-tested optimization
unit for that generated computation (or an equivalent representation change) --
not another link-release, presentation, warm-up or exception-status tweak.

## Retained changes

| Change | Effect |
| --- | --- |
| Keep imported-array raster loops and their wrappers in JavaScript | Chromium 5.09 -> 16.94 fps |
| Bounded structured quantum for the AWT producer | Firefox 3.50 -> 4.66 fps |
| Recognize the verified transparent-blit lowering | 3.63 -> 4.29 fps |
| Constant-time row-bounds proof with overflow fallback | 4.29 -> 5.06 fps |
| Small acyclic reference-field helpers stay positional JS | 5.06 -> 6.30 fps |
| Cap generated-loop polling at 256 backedges (64 minimum kept) | 629 -> 583/524 ms worst gap |
| Compiled call-chain tier (ordinary activations, not nested generators) | 456/492 ms worst gap |
| Release a ready-Wasm veto after repeated JS child runs on one edge | global max 357 -> 296 ms |
| Reuse the already sampled wall clock per structured-quantum check | Instructions 194 ms |
| Disable the linear generator partitioner | global max 296 -> 285 ms |
| `ordinaryAdaptiveCallChainSafePointBudget` (loops kept the 64-item budget) | roughly halved the Instructions floor |
| Direct-to-visible WebGL presenter + `Int32Array` AWT rasters from the first draw | 38/211/96 ms; menu meets the 40 ms target |
| Admit verifier-safe monitor-owning methods to adaptive codegen | best global gap 198 ms |
| Unified dense instance fields + 256 MiB linear primitive heap | Instructions 135 -> 114 ms |
| Transitive Wasm dependency blockers (factory/ctor linking) | 940 ns vs 3,743 ns per tile iteration |
| Static field value cells + inlined `arrayData` | ~340 -> ~220 ns per blit call chain |
| Presentation backpressure (park the host yield until a coalesced frame lands) | menu 25 -> 36 fps |
| Deferral retry-storm fixes | wasm compile 75.9 -> 19 s/session, boot 141 -> 85 s |

## Rejected — do not retry without new evidence

Grouped by what the experiment assumed. Each was measured and reverted.

**"Move it to Wasm."** Forcing raster chains back to ready Wasm (1.42 fps on a
clean reload); enabling the linear Wasm array heap for browsers (1.52); fusing
representation *and* code (2.19 vs 5.06); direct heap-backed Wasm raster
execution with the locality veto removed (`dm.b` ran in Wasm with zero exits and
the floor stayed 258-268 ms). Bytecode coverage is not execution locality, and
primitive-array boundary crossings are not the dominant cost.

**"Make the generated function smaller."** Lowering the oversized-loop threshold
2048 -> 1024; splitting oversized adaptive bodies (59/382/285 ms, and 112/363/841
restricted to compiled chains); outlining abnormal child-call branches
(227/363/682); lowering the linear-partition unit 98,304 -> 49,152 bytes;
ordinary call-loop outlining in all three forms (94/230/132 with state buffers,
761/1,012/519 with a fixed-arity ABI, 130/374/199 capped at 20 live outputs).
Generated source size is not a monotonic proxy for SpiderMonkey performance.

**"Fuse the call graph."** Late hot-call-graph fusion (the fused root never ran
-- `ma` is one long-lived activation already in flight; the forced child graph
cost 980 ms, 225 ms after guard inlining); pre-start fusion (14 graphs, 73
methods, 324 KB of generated source -> 319/298 ms). Needs OSR-quality state
transfer or a much smaller module ABI.

**"Change the object/array representation."** Canonical guest-wrapper shape
(260/141 and 341/247 vs a 241/113 control); hybrid dense instance fields in
three forms (233/162, 515/548, 1,251/364); field-site interning (214/117 and
237/140, no conservative win); object-property static maps instead of `Map`
(72/255/114); a parallel numeric class-index call-site cache (95/349/483). A
census found no holey arrays, no polymorphic field-key sites, and one stable
shape per class -- there is no layout defect to fix.

**"Remove a check or a branch."** Per-loop induction range specialization
(regressed the global max 260 -> 327 ms); a labelled fast-success edge around
positional calls (68/390/366); encoding synchronous-call exceptions as an
internal result (54/234/117, transition regressed); the one-pixel transparent
blit fast path, twice (throughput up, floor worse); four-pixel unrolling
(468/504 ms); a 12x12 specialization (1,181 ms gap).

**"Tune the scheduler quantum."** Adaptive frameless multiplier 100 -> 20 -> 10
-> 5, and generated-loop maximum 256 -> 128: all worsened the conservative
maximum gap even when average fps improved. Multiplier 100 is restored.

**"Compile earlier."** Precompiling every class before guest execution (guest
null dereference); precompiling initialized classes after startup (673 ms gap);
before-start preparation of all 7,816 methods (never presented a frame). Exact
compiler-line matching instead of the Acorn discovery pass (583 -> 714 ms).

**"It is the host."** Disabling Firefox's 100 KB Ion script-size gate
(64/221/163) and dropping its Ion warm-up threshold to 10 (50/224/142) left the
dominant bodies Baseline. GC markers, the profiler's confirmation screenshot,
and host-yield starvation were each ruled out by direct measurement.

**Measurement artefacts, not results.** The "0.9 fps" and "32 s START GAME
stall" reports were hidden tabs. The 37 fps incremental-presentation bundle was
3.35 real draws/s plus partial uploads. An Ion-off pref left in the shared
Firefox profile faked a 3-7x boot regression -- perf experiments need a
throwaway `--profile-dir`. Per-call timing attribution inflated a kernel win
~6x. Pixel MD5 is not a valid boot oracle.

## Harness recipes

Browser fps/gap run (this is what produced the table above):

```bash
DISPLAY=:10 NODE_PATH=~/git/java-tools/node_modules \
  node scripts/measure-geoblox-fps.js --out .work/geoblox-fps/run1 --sample 20
```

It reads `jvm._awtPresentationStats` (`presented`, `dirtyMarks`, `coalesced`,
`uploadMs`, and the 256-entry `recentFrameTimings` ring) once a second, writes
`samples.jsonl`, and screenshots every state. Do not run two browser
measurements concurrently on this machine.

Native profile:

```bash
MOZ_PROFILER_STARTUP=1 MOZ_PROFILER_STARTUP_FEATURES=js,stackwalk,cpu \
MOZ_PROFILER_STARTUP_INTERVAL=2 MOZ_PROFILER_SHUTDOWN=profile.json firefox ...
node ~/git/java-tools/scripts/analyzeFirefoxProfile.js profile.json   # window = wallclock - meta.startTime
```

Note that `jit.profileMethods` disables production fast links, so a profile
taken with it measures a different runtime. Profiling overhead inflates absolute
gaps: use profiles for attribution, never as a floor measurement.

Startup comparison:

```bash
node scripts/run-jre-reflection-main-menu.js      # native probe
node scripts/render-startup-comparison-table.js --jre-report <r> --jvmjs-report <r>
```

Reports land under the ignored `.work/jre-reflection-main-menu/` and
`.work/alterorb-jvmjs/`.

**Shipping trap:** the cloning page without `?jvm=local` evaluates the committed
`java-tools/browser-runtime/jvm-debug.js` from the clone, not `dist/`. Every
java-tools perf commit must run `npm run build:bundle` and copy the bundle into
`browser-runtime/`, or users keep the old runtime while local harness runs look
fixed.
