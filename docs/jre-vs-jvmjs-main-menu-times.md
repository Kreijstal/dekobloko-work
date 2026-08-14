# Native JRE versus JVM.js main-menu startup time

Measured August 12, 2026. The native measurements use OpenJDK 11.0.31 on
Linux/x64. The probe loads each applet and game classes reflectively, supplies
the same `simplemode=true` applet parameters as the JVM.js acceptance harness,
and discovers initialized software framebuffers through reflection. Games that
select the native OpenGL renderer have no Java `int[]` framebuffer, so the same
probe falls back to capturing the applet rectangle through AWT. Both paths use
the JVM.js harness's palette/density/frame-history menu classifier and its
10-second settling window; there is no game, class, method, or field-name list.

The native runs are one warm-cache sample per variant, executed serially with
original before recompiled. “Recompiled” means the class tree compiled from the
owned decompiler's generated Java and ABI-restored against the original jar.
All 88 native runs reached the checkpoint. The original and recompiled native
medians are **28.069 s** and **28.539 s**. The median of the 44 paired percentage
changes is **−0.07%**, so generated Java has no general native-JRE startup
penalty. TerraPhoenix is the conspicuous exception: **58.205 s → 113.554 s** and
deserves a separate repeated/profiled investigation.

The JVM.js values are the existing exact-class-tree acceptance results, not a
new controlled speed benchmark. Nineteen are serial runs; 25 came from a
three-game batch and include CPU contention. They use the same recompiled class
tree hashes proven by `scripts/audit-recompiled-main-menu-evidence.js`. Their
median is **328.144 s**, and the median per-game JVM.js/JRE ratio is **11.24×**.
Because of the mixed JVM.js run modes, use the individual ratios to locate large
gaps, not to claim precise engine speedups.

| Game | JRE original | JRE recompiled | JRE change | JVM.js recompiled | JVM.js / JRE | JVM.js run |
| --- | ---: | ---: | ---: | ---: | ---: | :---: |
| Thirty-Six Card Trick | 24.664 s | 24.598 s | -0.3% | 248.528 s | 10.1× | 3-way |
| Ace of Skies | 27.336 s | 26.997 s | -1.2% | 618.946 s | 22.9× | 3-way |
| Arcanists | 29.314 s | 29.327 s | +0.0% | 581.588 s | 19.8× | 3-way |
| Armies of Gielinor | 39.682 s | 39.126 s | -1.4% | 981.927 s | 25.1× | 3-way |
| Bachelor Fridge | 27.918 s | 28.501 s | +2.1% | 50.767 s | 1.8× | serial |
| Bouncedown | 25.553 s | 25.381 s | -0.7% | 215.871 s | 8.5× | 3-way |
| Brick-A-Brac | 30.558 s | 30.837 s | +0.9% | 381.402 s | 12.4× | 3-way |
| Chess | 28.572 s | 28.576 s | +0.0% | 279.522 s | 9.8× | 3-way |
| Confined | 30.231 s | 29.882 s | -1.2% | 332.897 s | 11.1× | 3-way |
| Crazy Crystals | 28.213 s | 28.931 s | +2.5% | 113.393 s | 3.9× | serial |
| Deko Bloko | 27.824 s | 27.848 s | +0.1% | 182.357 s | 6.5× | 3-way |
| Dr. Phlogiston Saves The Earth | 27.925 s | 27.717 s | -0.7% | 382.536 s | 13.8× | serial |
| Dungeon Assault | 30.753 s | 30.821 s | +0.2% | 506.985 s | 16.4× | 3-way |
| Escape Vector | 26.446 s | 27.181 s | +2.8% | 261.624 s | 9.6× | 3-way |
| Flea Circus | 26.655 s | 26.607 s | -0.2% | 168.093 s | 6.3× | serial |
| Geoblox | 25.645 s | 25.694 s | +0.2% | 753.807 s | 29.3× | 3-way |
| Hold The Line | 27.398 s | 27.275 s | -0.4% | 856.251 s | 31.4× | 3-way |
| Hostile Spawn | 30.151 s | 29.783 s | -1.2% | 593.285 s | 19.9× | serial |
| Kickabout League | 33.317 s | 33.127 s | -0.6% | 181.631 s | 5.5× | 3-way |
| Lexicominos | 27.884 s | 29.766 s | +6.7% | 224.284 s | 7.5× | 3-way |
| Miner Disturbance | 26.856 s | 26.769 s | -0.3% | 354.267 s | 13.2× | 3-way |
| Monkey Puzzle 2 | 26.013 s | 26.379 s | +1.4% | 363.601 s | 13.8× | 3-way |
| Orb Defence | 25.849 s | 26.037 s | +0.7% | 330.962 s | 12.7× | 3-way |
| Pixelate | 28.334 s | 28.310 s | -0.1% | 321.246 s | 11.3× | 3-way |
| Pool | 31.565 s | 31.585 s | +0.1% | 219.125 s | 6.9× | serial |
| Shattered Plans | 29.726 s | 30.368 s | +2.2% | 646.074 s | 21.3× | 3-way |
| Sol-Knight | 27.407 s | 27.602 s | +0.7% | 271.724 s | 9.8× | 3-way |
| Star Cannon | 25.176 s | 25.337 s | +0.6% | 276.108 s | 10.9× | 3-way |
| Steel Sentinels | 30.400 s | 30.459 s | +0.2% | 371.358 s | 12.2× | serial |
| Stellar Shard | 25.473 s | 25.334 s | -0.5% | 1020.094 s | 40.3× | 3-way |
| Sumoblitz | 30.661 s | 28.874 s | -5.8% | 586.764 s | 20.3× | 3-way |
| TerraPhoenix | 58.205 s | 113.554 s | +95.1% | 717.486 s | 6.3× | 3-way |
| TetraLink | 29.603 s | 29.571 s | -0.1% | 139.564 s | 4.7× | serial |
| Tomb Racer | 42.252 s | 39.725 s | -6.0% | 853.068 s | 21.5× | serial |
| Tor Challenge | 27.892 s | 27.923 s | +0.1% | 610.599 s | 21.9× | serial |
| Torquing! | 30.842 s | 29.393 s | -4.7% | 257.140 s | 8.7× | serial |
| The Track Controller | 26.274 s | 26.389 s | +0.4% | 97.293 s | 3.7× | serial |
| Transmogrify | 27.214 s | 27.121 s | -0.3% | 211.846 s | 7.8× | serial |
| Vertigo 2 | 35.273 s | 35.151 s | -0.3% | 282.259 s | 8.0× | serial |
| Virogrid | 40.029 s | 39.870 s | -0.4% | 836.889 s | 21.0× | serial |
| Void Hunters | 35.842 s | 32.823 s | -8.4% | 297.702 s | 9.1× | serial |
| Wizard Run | 27.185 s | 27.295 s | +0.4% | 325.325 s | 11.9× | serial |
| Zombie Dawn | 27.022 s | 27.008 s | -0.1% | 197.233 s | 7.3× | serial |
| Zombie Dawn Multiplayer | 30.031 s | 29.716 s | -1.0% | 484.599 s | 16.3× | serial |

## Reproduction

The native coordinator and reflection probe are:

- `scripts/run-jre-reflection-main-menu.js`
- `scripts/jre-reflection-main-menu/ReflectionMainMenuProbe.java`

The native measurements are recorded under the ignored
`.work/jre-reflection-main-menu/` directory. The JVM.js reports are under the
ignored `.work/alterorb-jvmjs/` directory. Regenerate the Markdown table with:

```bash
node scripts/render-startup-comparison-table.js \
  --jre-report <native-report> \
  --jvmjs-report <jvmjs-report>
```

The renderer accepts each option repeatedly, rejects duplicate game/variant
evidence, and fails if any game lacks one of the three required measurements.
The checked-in table combines the 43-game native report plus the isolated Ace
of Skies pair, and the three exact-tree JVM.js evidence groups documented in
`docs/recompiled-runtime-validation.md`.

## Post-logo game loading (current acceptance metric)

The whole-startup table above is historical evidence and is **not** the current
loading-time acceptance metric. Cold JVM construction, class loading needed to
start the applet, compilation before the logo, and the logo animation are all
outside the requested interval. The measured interval is:

1. start at the first generic framebuffer state that proves the Jagex logo has
   completed and the following loading screen has begun;
2. include the game's archive decompression, graphics/music/sound preparation,
   procedural asset construction, and menu construction; and
3. stop at the first qualifying menu surface. The later 10-second correctness
   settling window is not charged to `postLogoToMenuMs`.

Neither probe contains a game, class, method, or field-name checkpoint. Both
use the same palette, density, and frame-history classifiers. The Node process
and JRE are pinned to performance CPU 6. The target for each game is JVM.js no
more than 1.5 times its recompiled JRE post-logo phase.

The August 13 catalogue sweep measured the other 40 games serially on the same
performance CPU. Every comparison below uses matching recompiled class-tree
SHA-256 values. Exact values are one clean sample per runtime except Stellar
Shard, whose JVM.js value is a three-run median. They are screening results,
not low-variance microbenchmarks: loading mechanics can vary enough that some
JVM.js samples are faster than their single native sample.

| Game | JRE post-logo | JVM.js post-logo | Ratio | Result |
| --- | ---: | ---: | ---: | :--- |
| Ace of Skies | 46.295 s | — | >1.877× | fail (lower bound) |
| Arcanists | 48.183 s | 168.325 s | 3.493× | fail |
| Armies of Gielinor | 344.596 s | 256.313 s | 0.744× | pass |
| Bachelor Fridge | 20.367 s | — | — | no logo boundary |
| Bouncedown | 17.381 s | 14.695 s | 0.845× | pass |
| Brick-A-Brac | 43.823 s | — | >4.694× | fail (lower bound) |
| Chess | 36.382 s | 39.439 s | 1.084× | pass |
| Confined | 29.382 s | 49.709 s | 1.692× | fail |
| Crazy Crystals | 85.105 s | 22.348 s | 0.263× | pass |
| Deko Bloko | 49.082 s | 71.959 s | 1.466× | pass |
| Dr. Phlogiston Saves The Earth | 36.318 s | 49.625 s | 1.366× | pass |
| Dungeon Assault | 176.480 s | — | >0.332× | crash |
| Escape Vector | 19.613 s | 33.011 s | 1.683× | fail |
| Flea Circus | 27.708 s | — | — | no first frame (900 s timeout) |
| Geoblox | 27.674 s | 23.022 s | 0.832× | pass |
| Hold The Line | 48.622 s | — | >4.209× | fail (lower bound) |
| Hostile Spawn | 61.829 s | 140.797 s | 2.277× | fail |
| Kickabout League | 112.193 s | 49.333 s | 0.440× | pass |
| Lexicominos | 45.446 s | 40.420 s | 0.889× | pass |
| Miner Disturbance | 27.201 s | 45.031 s | 1.655× | fail |
| Monkey Puzzle 2 | 28.291 s | 23.989 s | 0.848× | pass |
| Orb Defence | 29.286 s | 90.975 s | 3.106× | fail |
| Pixelate | 33.836 s | 38.296 s | 1.132× | pass |
| Pool | 48.015 s | 62.189 s | 1.295× | pass |
| Shattered Plans | 50.102 s | 41.207 s | 0.822× | pass |
| Sol-Knight | 21.646 s | 60.801 s | 2.809× | fail |
| Star Cannon | 22.051 s | 25.891 s | 1.174× | pass |
| Steel Sentinels | 75.868 s | 143.065 s | 1.886× | fail |
| Stellar Shard | 22.998 s | 53.641 s median | 2.332× | fail |
| Sumoblitz | 59.170 s | 67.304 s | 1.137× | pass |
| TerraPhoenix | 60.962 s | 185.463 s | 3.042× | fail |
| TetraLink | 36.358 s | 46.637 s | 1.283× | pass |
| The Track Controller | 21.653 s | 37.417 s | 1.728× | fail |
| Thirty-Six Card Trick | 15.731 s | 23.255 s | 1.478× | pass |
| Tomb Racer | 108.064 s | — | >5.735× | fail (lower bound) |
| Tor Challenge | 41.656 s | — | — | no logo boundary (900 s timeout) |
| Torquing! | 44.337 s | — | >0.837× | crash |
| Transmogrify | 47.405 s | 30.573 s | 0.645× | pass |
| Vertigo 2 | 54.735 s | — | >3.403× | fail (lower bound) |
| Virogrid | 47.419 s | — | >4.338× | fail (lower bound) |
| Void Hunters | 48.769 s | 75.129 s | 1.541× | fail |
| Wizard Run | 30.399 s | 134.919 s | 4.438× | fail |
| Zombie Dawn | 70.922 s | 27.376 s | 0.386× | pass |
| Zombie Dawn Multiplayer | 55.274 s | 148.175 s | 2.681× | fail |

Of the 33 exact pairs, 19 meet the 1.5× target and 14 miss it; the median
exact ratio is 1.366×. Six additional games are proven failures by elapsed
lower bounds, so at least 20 of the 44 games miss the target. Five games do
not have a comparable phase: Bachelor Fridge never matches the visual
logo-complete marker, Flea Circus and Tor Challenge fail before that boundary,
and Dungeon Assault and Torquing crash before reaching a menu.

The two repeated `Invalid array length` crashes occurred in unrelated guest
classes in Dungeon Assault and Torquing, identifying a generic generated-code
array-allocation semantic bug. Ace of Skies instead crashed in the Wasm runtime
while resolving an instance field. Tomb Racer eventually failed on the absent
`java/lang/ref/SoftReference.get()` implementation after establishing the
5.735× lower bound. These are runtime correctness failures, not measurements
that should be silently converted into timeout ratios.

The catalogue evidence is recorded in:

- `.work/jre-reflection-main-menu/all-remaining-40-post-logo-current.json`;
- `.work/jre-reflection-main-menu/remaining-3-post-logo-retry.json`;
- `.work/alterorb-jvmjs/all-remaining-37-post-logo-current.json`;
- `.work/alterorb-jvmjs/remaining-native-timeouts-post-logo-current.json`; and
- `.work/alterorb-jvmjs/unresolved-3-post-logo-retry.json`.

The primary sweeps used 180-second native and 240-second JVM.js timeouts. The
focused retries used 600 seconds natively and 900 seconds on JVM.js. All runs
used `taskset -c 6`, one worker, the recompiled variant, zero required menu
scene transitions, Node v26.4.0, java-tools commit
`374673353751b75c93f9edca93a5035e3bf40546` plus its recorded dirty optimizer
changes, and dekobloko-work commit
`66af2a7f177d1f85dbf4f704929fcf5a9240ba55` plus the recorded dirty harness
changes. Each report includes the effective runtime gates and artifact hashes.

The Deko Bloko result reached its first menu surface at 107.317 seconds after
process start, but only the 71.959 seconds after its 35.358-second post-logo
boundary count. It used gamepack SHA-256
`a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e`
and recompiled tree SHA-256
`4e79d7d54f1b112aaf0786da9cfc5fd4a8fcde415d9e15ded3314fdad61bc461`.
The complete report is
`.work/alterorb-jvmjs/2026-08-12-dekobloko-post-logo-aggressive-restored.json`.

Miner Disturbance originally completed its logo at 39.064 seconds but had not
reached a menu when the process timed out at 150.047 seconds. On the current
optimizer tree it completed its logo at 32.378 seconds and reached its first
menu surface at 77.409 seconds, giving a 45.031-second phase and 1.655× ratio.
The successful report is
`.work/alterorb-jvmjs/minerdisturbance-current-3x-audit.json`; the obsolete
timeout remains useful as historical evidence. It used gamepack SHA-256
`1cfc8680848d1695207e742638f46e8b42528380694ba2f66480484adaa3c344`
and recompiled tree SHA-256
`844a387f50df982f16b41187f4b06e0bfe3bf956f8573829bc4cf84231fa440d`.
The report is
`.work/alterorb-jvmjs/2026-08-12-minerdisturbance-post-logo-aggressive-restored.json`.
Both reports record Node v26.4.0, repository commits, dirty-tree state, every
effective environment gate, and the decompilation provenance manifest.

Stellar Shard was rerun serially on performance CPU 6 after the generic
structured-SSA work. The original controlled rerun took 130.115 seconds after
the post-logo boundary. Generic intermethod continuation, field-backed range
guards, and linked-target tier-up publication reduced the retained clean run to
81.186 seconds: a 37.6% reduction, but still 3.530× the matching native
recompiled run's 22.998 seconds (13.189 to 36.187 seconds). This remains a
failure of the 1.5× acceptance target. These are single controlled samples,
not a multi-run median.
Both used the 302-class tree SHA-256
`8ed5e98aa56c8407260af4aaffff94f56d00b4f7e7010307c42176ce96c11a5f`;
the gamepack SHA-256 is
`abf5cdc04b62473a4c9feff8a8d5f1d69be7dc79b6820ed745f897f351cf8f85`.
The native and original JVM.js reports are
`.work/jre-reflection-main-menu/stellarshard-current-post-logo.json` and
`.work/alterorb-jvmjs/stellarshard-current-post-logo-unprofiled.json`. The
retained clean result is
`.work/alterorb-jvmjs/stellarshard-tier-up-publication-clean.json`.

The historical 1020.094-second whole-start result does not reproduce on the
current dirty optimizer tree: the equivalent whole-start elapsed time is now
186.350 seconds. The old run entered 4,679,253 partial-Wasm regions before its
workload-wide whole-method-JavaScript escalation, whereas the current early
escalation limits that to 72,314 regions (64.7× fewer). This explains the large
recovery, but not the remaining native gap.

A production-path V8 profile, enabled only at the generic post-logo boundary,
attributed 37.32% of samples to JVM core, 30.72% to JIT runtime, 19.40% to
generated guest JavaScript, 5.14% to interpreted opcode handlers, 2.64% to GC,
and 2.05% to Wasm. Sparse 1/64 scheduler timing estimated 110.8 seconds owned by
structured-SSA frames, 25.8 seconds by baseline-generated frames, and 18.6
seconds by non-generated frames. That ownership includes callees and runtime
work; it shows that generated methods repeatedly suspend into the generic
scheduler rather than spending 110.8 seconds doing scalar guest arithmetic.
The largest individual regions were BZip2 decode (about 14.2 seconds), an
exception-heavy archive/parser routine (12.5 seconds), sprite decode (10.5
seconds, non-generated), model construction (10.3 seconds), model/raster
preparation (about 16 seconds combined), and the top-level asset-loading body
(9.8 seconds). `execute` and `executeTick` alone held 25.59% of V8 self samples;
frame admission, dispatch, and scheduler preparation added another substantial
share. Canvas/AWT and audio were negligible in this phase profile.

Disabling Wasm on the same bundle increased post-logo time to 138.905 seconds,
6.8% slower than the 130.115-second normal run. Wasm therefore provides a
modest benefit to the kernels it accepts; Wasm/JS crossings are no longer the
main cause. The next optimization target is generic intermethod continuation:
keep verified call chains and exception-capable archive/model loops inside a
larger generated region, with frame reconstruction only on the exceptional or
scheduling edge. The CPU-profile report is
`.work/alterorb-jvmjs/stellarshard-current-post-logo-cpu-profile.json`; the A/B
report is `.work/alterorb-jvmjs/stellarshard-current-post-logo-no-wasm.json`.

### Stellar Shard continuation follow-up

The follow-up stayed descriptor/CFG/SSA driven; no guest class or method name
participates in compilation or admission. It added four generic capabilities:

1. A structured caller that dispatches a real child Frame now materializes its
   exact post-invoke state and retains its generator. When the child returns,
   its non-void operand feeds back into the caller's lexical SSA value. A
   handled exception invalidates the lexical continuation and resumes through
   the canonical dispatcher with the already-materialized parent.
2. Constructors before or inside a verified primitive-array backedge may enter
   the structured-only tier. Inline loop extraction is skipped for these
   methods so the complete CFG and stack proof, rather than a partial-method
   heuristic, remains authoritative.
3. Field/static primitive-array range proofs no longer categorically disable
   continuation. The wrapper snapshots every contributing receiver, static
   target, and array reference at suspension and compares their identities
   before resume. A rebind discards the iterator before another array effect
   and continues from the exact bytecode PC and locals.
4. When a cold baseline method later upgrades, every already-linked generic
   call target receives the new body and rebuilt positional adapter. Active
   calls retain their selected function; future calls cannot remain pinned to
   stale baseline code. Explicit `monitorenter` and `monitorexit` also gained
   structured emission with precise contention and exception materialization.

The first change reduced the diagnostic post-logo result from 130.115 to
87.620 seconds. Field-backed continuation reached 83.150 seconds, and linked
tier-up publication reached 81.186 seconds. Two further ideas were measured
and rejected: enabling captured-checked-leaf continuations broadly regressed a
clean run to 100.369 seconds, and forcing constructor tier-up synchronously did
not improve the 80.9–81.3-second noise band. Those runtime policy experiments
were removed.

The final phase-only profile still attributes 35.42% to JIT runtime, 24.38% to
JVM core, 27.97% to generated guest JavaScript, 3.37% to interpreted opcodes,
3.07% to GC, and 2.68% to Wasm. BZip2 is now a continuing structured region,
but the combined scheduler, dispatcher, generated-wrapper, and admission cost
is larger than any remaining guest loop. Therefore the next target is the
generic runtime boundary itself (especially `execute`, `executeTick`, resume
dispatch, and positional adapter work), not a game-specific BZip2 or renderer
kernel. The profile is
`.work/alterorb-jvmjs/stellarshard-tier-up-publication-profile.json`.

The next experiment implemented that generic runtime-boundary idea as a
persistent compiled-call-chain entry. Any verified, non-recursive structured
method containing calls can publish an adaptive positional ABI; once its call
targets stabilize, callers execute it as an ordinary JavaScript activation
without exposing the intermediate Java `Frame` to the scheduler. The existing
structured continuation still materializes the exact bytecode PC, locals,
operand values, and parent/child order on a scheduling or exceptional exit.
Admission uses only bytecode descriptors, CFG/stack proofs, recursion, and
resolved call-site state—there are no game class or method names.

The implementation worked and was heavily exercised, but did not improve this
workload. A generator-backed version recorded 336,859 virtual-chain entries
and completed in 83.762 seconds. Replacing the generator with an ordinary
activation recorded 336,797 entries but regressed to 86.183 seconds. The
matching canonical-frame control completed in 82.351 seconds; all three are
inside or worse than the 81.186-second best production run. Removing
scheduler-visible child Frames therefore exposed enough positional-adapter,
guard, and host-call overhead to erase the saving. The feature remains
available for further differential work with
`JVM_ENABLE_COMPILED_CALL_CHAINS=1`, and exports `compiledCallChainRuns`, but is
disabled by default. The production result and 3.530× ratio above are
unchanged.

### Native/JVM.js phase profile comparison

A paired profile on 2026-08-12 used the same 302-class recompiled Stellar
Shard tree (`8ed5e98aa56c8407260af4aaffff94f56d00b4f7e7010307c42176ce96c11a5f`),
OpenJDK 11.0.31, Node 26.4.0, performance CPU 6, and the generic
logo-complete/first-menu framebuffer boundaries. The caches were already warm,
so the absolute native phase was 1.285 seconds rather than the earlier
22.998-second cold-cache comparison. The JVM.js phase was 85.876 seconds. This
run is useful for CPU attribution, not as a replacement for the retained clean
timing table.

Native JFR recorded 43 execution samples in the short phase: 97.7% were guest
Java and 69.8% were inclusively in the archive/BZip2 chain. `j.b(Lmg;)V` held
44.2% self and `j.d(Lmg;)V` held 23.3% self. AWT appeared in one sample; no GC
sample appeared in this phase. Native therefore spends its time doing the
intended guest archive work directly.

The exactly phase-scoped V8 profile recorded 72,013 samples. JIT runtime held
40.69% (about 34.94 seconds), JVM core/scheduling 16.10% (13.83 seconds), and
generated guest JavaScript 32.43% (27.85 seconds). GC used 3.71%, interpreted
opcodes 1.92%, Wasm 1.54%, and JRE/native adapters 0.11%. The largest self
sites were a generated model constructor (9.04%), `execute` (5.82%), generated
BZip2 `j.d(Lmg;)V` (4.48%), the structured wrapper (3.35%), dispatcher (3.25%),
`tryRunFrame` (2.63%), `executeTick` (2.43%), and scheduler preparation
(2.20%). Compilation/source generation and Acorn parsing also remained visible
during the measured warm phase.

The largest slowdown is consequently not AWT, audio, network I/O, or the
interpreter. It is the execution representation around hot guest work: JIT
admission/compilation, positional and resolved-call adapters, generated-body
wrappers, Frame/scheduler transitions, and allocation representation consume
roughly 57% of the whole JVM.js phase before counting generated guest code.
The run performed 6,643 entry promotions, 1,698 elapsed-time promotions,
193,554 reference-frameless positional calls, 123,621 fused calls, and 137,958
fused guarded fallbacks. The next optimization should therefore make stable
compiled targets and admission decisions immutable after tier-up and remove
per-call/per-tick policy work from the warmed path. Optimizing another isolated
guest loop cannot recover the approximately 49 seconds currently attributed
directly to JIT runtime plus JVM scheduling.

The native recording, sliced summary, and JVM.js report are respectively
`.work/jre-reflection-main-menu/profiles/phase-marked-20260812-stellarshard-recompiled.jfr`,
`.work/jre-reflection-main-menu/stellarshard-current-jfr-summary.json`, and
`.work/alterorb-jvmjs/stellarshard-current-exact-phase-profile.json`. The native
harness now supports `--jfr-profile`; the JFR contains generic phase-marker
events, and `scripts/summarize-jfr-phase-profile.js` performs the timestamp
slice. JVM.js now also stops V8 sampling at the first menu surface instead of
including the later correctness-settling window.

The same paired, warm-cache profile was then run serially for every other game
in the controlled benchmark table. These timings include profiler overhead and
warm caches, so they locate CPU cost but do not replace the clean acceptance
numbers near the top of this document.

| Game | Native phase | JVM.js phase | Ratio | JIT runtime | JVM core | Generated guest | Wasm | Interpreter |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Deko Bloko | 6.641 s | 57.944 s | 8.72× | 27.02% | 24.52% | 20.19% | 10.04% | 5.52% |
| Miner Disturbance | 3.827 s | 73.966 s | 19.33× | 30.84% | 24.88% | 28.10% | 2.54% | 3.62% |
| Pixelate | 4.243 s | 122.954 s | 28.98× | 23.02% | 44.53% | 16.07% | 6.14% | 5.33% |
| Stellar Shard | 1.285 s | 85.876 s | 66.83× | 40.69% | 16.10% | 32.43% | 1.54% | 1.92% |

Pixelate requires an explicit qualification: its default current optimizer
path failed after the post-logo boundary in `p.<init>()V@12`, where canonical
`putfield` received an absent constructor receiver. The completed profile used
`JVM_DISABLE_STRUCTURED_UNSAFE_CONSTRUCTOR_CALLERS=1`. The default failed run
still spent 35.74% in JIT runtime and 7.77% in JVM core before the exception,
so the conservative result does not manufacture the cross-game conclusion,
but the constructor continuation bug must be fixed before Pixelate can supply
an ordinary production-path timing.

Native behavior varies by game while the JVM.js tax remains stable. Deko
Bloko's native phase is procedural floating-point asset generation:
`va.d(I)[F` held 58.3% self. Miner divides work among archive/BZip2
`va.c(Lcn;)V` (25.6%), integer asset generation `ve.a(II)[I` (16.7%), and
floating-point construction. Pixelate is led by `qd.a(I)[F` (33.7%),
`dl.a([FIZ)V` (14.5%), and integer generation. In all three native profiles,
94.4–96.2% of samples were guest Java; JRE/library code was 3.8–5.6%, mostly
the framebuffer probe rather than the workload.

The JVM.js hot sites reflect the same guest work, but each is surrounded by a
large runtime tax. Deko's largest self site is `executeTick` (12.34%), ahead of
generated `va.d(I)[F` (5.44%). Miner has generated `va.c(Lcn;)V` at 9.62%, but
`execute` alone is 9.20%, followed by the generated wrapper (4.57%),
`executeTick` (4.38%), scheduler preparation (3.30%), and `tryRunFrame` (2.85%).
Pixelate's conservative run is dominated by `execute` (15.31%), two
`executeTick` sites (14.87% combined), scheduler preparation (5.96%), and
`tryRunFrame` (4.09%); its largest guest body is only 3.92%.

Across all four JVM.js profiles, weighted by their 288,144 V8 samples, JVM core
used 30.01% and JIT runtime 29.73%, versus 23.36% for generated guest code.
Thus 59.74% of sampled CPU is generic JVM/JIT machinery across decompression,
procedural asset generation, and model construction workloads. This confirms
that the next optimization should be a warmed execution fast path shared by
all generated methods, rather than another game or method-specific kernel.

### 2026-08-12: generic warmed dispatch fixes Pixelate and Stellar Shard

The follow-up implemented that warmed path without guest class or method-name
conditions. Four generic changes were retained:

- the constructor verifier admits linear post-super field initializers made of
  constants, array allocation, and field stores, while still rejecting calls,
  branches, monitors, statics, and nested construction;
- generated and JRE positional adapter source is parsed once per resolved
  method/ABI shape and rebound to live call-site linkage plans;
- warmed generated scheduler entries bypass repeated tier admission, and the
  scheduler executes a bounded same-thread sequence of generated Frames before
  repeating the all-thread scan; and
- polymorphic JRE call sites retain resolved targets by runtime receiver type
  instead of continually rebinding the last monomorphic target.

The constructor proof fixes Pixelate's production-path `putfield` failure in
`p.<init>()V@12`. That identity is diagnostic evidence only: the optimizer
matches the direct-super call, CFG, supported opcodes, and absence of another
invoke. Pixelate now reaches its menu with the unsafe-constructor comparison
gate unset and no runtime error.

Clean, serial, recompiled Node runs with identical default runtime gates gave:

| Game | Before post-logo | Retained post-logo | Improvement | Native phase | Retained/native |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pixelate | 56.501 s | **40.792 s** | **27.8%** | 33.836 s | 1.206× |
| Stellar Shard | 81.186 s | **56.394 s** | **30.5%** | 22.998 s | 2.452× |

Both retained runs reached a nonblank 640×480 menu and reported no runtime
error. Pixelate compressed 4,375,222 generated frame entries into 2,252,412
scheduler batches. Stellar compressed 4,872,745 entries into 879,408 batches.
Most importantly, the polymorphic target cache reduced positional JRE adapter
rebindings from about 3.03 million to 127 for Pixelate and 63 for Stellar.

Two existing opt-ins were tested and rejected rather than folded into the
default. Compiled call chains regressed Stellar from 58.055 to 73.472 seconds
post-logo despite 339,316 chain runs. Ordinary adaptive frameless SSA regressed
it to 61.241 seconds. Both preserved a valid menu, but neither met the
performance acceptance criterion for this workload.

A fresh phase-only V8 profile after the retained changes measured Stellar at
62.737 seconds with profiler overhead. Scheduler preparation fell from 2.20%
to 0.40%, and `tryRunFrame` from 2.63% to 0.78%. The new distribution is 44.30%
generated guest code, 33.37% JIT runtime (now primarily structured continuation
wrappers rather than compilation), 10.91% JVM core, 2.93% GC, 2.09% Wasm, and
2.06% interpreted bytecodes. The largest remaining body is a structurally
compiled model constructor at 12.76%; this makes object/constructor
representation and generic structured-wrapper removal the next targets, not
another scheduler scan micro-optimization.

The final serial acceptance report is
`.work/alterorb-jvmjs/pixelate-stellar-final-retained.json`; the earlier
dispatch-only report is
`.work/alterorb-jvmjs/pixelate-stellar-generic-dispatch-final.json`, and the
fresh profile is `.work/alterorb-jvmjs/stellarshard-generic-dispatch-profile.json`.
They record Node version, all runtime gates, source commits, dirty-tree state,
decompilation manifest SHA-256, launcher SHA-256, surface summaries, and the
new linkage/burst counters. At measurement time java-tools was
`374673353751b75c93f9edca93a5035e3bf40546` plus the documented dirty changes,
and the generated class trees came from manifest
`032c7e7459edd7afd10498133778b71ec80e7cdbb337816f262a26da94833a43`.

The new native reports are under
`.work/jre-reflection-main-menu/profiles/all-benchmark-games-20260812-*-recompiled.jfr`
with matching `*-summary.json` files. JVM.js results are in
`.work/alterorb-jvmjs/all-other-benchmark-games-exact-phase-profile.json` and
`.work/alterorb-jvmjs/pixelate-conservative-constructor-exact-phase-profile.json`.

#### Pixelate/Stellar follow-up: measured value-call continuation

A subsequent experiment retained non-void SSA callers across a canonical
scheduler handoff, consuming the child return operand when the lexical caller
resumed. It was implemented from verified call/CFG state and contained no
guest identities. A clean serial run improved Stellar Shard from 58.055 to
53.434 seconds post-logo, but regressed Pixelate from 42.529 to 52.930 seconds.
A bytecode-size profitability gate restored Pixelate to 44.820 seconds while
Stellar measured 56.472 seconds. The combined result was not better than the
retained production path and remained vastly outside the 1.5x target, so the
runtime experiment and its test were removed rather than presented as a win.
The rejected reports are
`.work/alterorb-jvmjs/pixelate-stellar-value-continuations.json` and
`.work/alterorb-jvmjs/pixelate-stellar-large-value-continuations.json`.

A new production-path Pixelate V8 profile, now using the corrected default
constructor path, measured 45.610 seconds post-logo. Attribution was 38.96%
JIT runtime, 34.96% generated guest JavaScript, 14.06% JVM core, 2.67% GC,
2.00% interpreted bytecodes, and 1.24% Wasm. The largest guest body was the
procedural float-array generator at 10.73%; `execute`, the structured resume
wrapper, and `executeTick` remained the largest runtime sites. An immutable
short-helper capability decision was still rescanning bytecode and held 2.18%
of samples, so that method-shape decision is now cached per loaded method. A
first clean timing after the cache was 43.313 seconds post-logo, inside the
existing run-to-run band. The final serial pair measured Pixelate at 40.792
seconds and Stellar Shard at 56.394 seconds post-logo. The cache is retained as
removal of provably redundant work, not claimed as an independent speed
breakthrough. The profile and clean reports are
`.work/alterorb-jvmjs/pixelate-production-correct-cpu-profile.json` and
`.work/alterorb-jvmjs/pixelate-short-helper-cache-clean.json`; the exact final
pair is `.work/alterorb-jvmjs/pixelate-stellar-final-retained.json`.

Pixelate is now correct and both games are materially faster than their earlier
JVM.js baselines. Against the cold-cache clean acceptance phases—not the
separate warm-cache profiling phases—both are within 3× native, although this
still does not establish the stricter 1.5× target. The remaining work for that
stricter target is larger-region intermethod lowering that avoids
generator/positional-wrapper boundaries without paying the failed
compiled-call-chain overhead.

#### Immutable eager intermethod lowering

The next generic intermethod experiment separated call linkage from hot-loop
execution. When a structured caller is compiled, an `invokestatic` or
non-constructor `invokespecial` target may be compiled and linked immediately
if its class is already loaded (and initialized for a static call), its target
is monomorphic by bytecode semantics, it is synchronously compilable, and its
normalized body contains at most 96 code items. The generated caller captures
the resulting positional function with `const` before entering its body.
Virtual/interface calls, constructors, large or asynchronous targets, class
initialization, debugger deoptimization, unsupported bodies, and fused-region
candidates retain the existing guarded call path. The proof uses descriptors,
loaded method identity, opcode semantics, and body size; it contains no game,
class, or method names.

A first implementation instead changed a generated loop's local call target
after its first generic invocation. It was structurally restricted to calls in
CFG cycles, but changing the target inside a live loop defeated JavaScript
optimization: in the controlled pair, Pixelate took 60.379 seconds with the
feature versus 41.797 seconds without it (+44.5%), and Stellar Shard took
61.807 versus 60.942 seconds (+1.4%). That implementation and test were
removed. Its reports remain as negative evidence in
`.work/alterorb-jvmjs/pixelate-stellar-late-positional-loop-only.json` and
`.work/alterorb-jvmjs/pixelate-stellar-late-positional-loop-only-off.json`.

The immutable version passed the full focused JIT suite (1,616/1,616) and a
new arbitrary-name regression test proves that a cold helper called 25 times
from one loop performs zero generic dispatches and creates no child `Frame`.
The first immediate, serial, same-build Node A/B measured:

| Game | Eager lowering on | Eager lowering off | Improvement | Linked sites |
| --- | ---: | ---: | ---: | ---: |
| Pixelate | **41.171 s** | 52.712 s | **21.9%** | 553 |
| Stellar Shard | **52.392 s** | 59.592 s | **12.1%** | 354 |

All four runs reached a painted 640×480 main menu and reported no runtime
error. The menu is animated, so the final sampled hash is not expected to be
identical at different wall-clock completion instants; surface dimensions,
nonblank coverage, color diversity, and the ordinary menu-settling gate were
used for correctness. Reports are
`.work/alterorb-jvmjs/pixelate-stellar-eager-monomorphic-on.json` and
`.work/alterorb-jvmjs/pixelate-stellar-eager-monomorphic-off.json`. They record
repository commits and dirty state, generated-classes manifest and launcher
hashes, Node/platform data, effective gates, phase boundaries, surfaces, and
the `eagerMonomorphicCallLinks` counter. The kill switch is
`JVM_DISABLE_EAGER_MONOMORPHIC_CALLS=1`; the structural budget can be changed
for experiments with `JVM_EAGER_MONOMORPHIC_CALL_MAX_CODE_ITEMS`.

Because that first pair showed substantial run-to-run variance, a second pair
reversed the order and ran only after the new gate fields were included in
provenance. It confirmed the direction with a more conservative result:

| Game | Final off | Final on | Improvement | Linked sites |
| --- | ---: | ---: | ---: | ---: |
| Pixelate | 40.141 s | **38.296 s** | **4.6%** | 554 |
| Stellar Shard | 58.635 s | **55.736 s** | **4.9%** | 354 |

Those reproducible reports are
`.work/alterorb-jvmjs/pixelate-stellar-eager-monomorphic-final-off.json` and
`.work/alterorb-jvmjs/pixelate-stellar-eager-monomorphic-final-on.json`.
The existing five-round toy intermethod benchmark agreed on the affected
shape: its structured-JavaScript static-call median improved from 1.069 ms to
1.018 ms (4.8%), while its monolithic case stayed effectively unchanged. The
same static shape took roughly 39 ms through partial Wasm, confirming that a
per-call JavaScript/Wasm boundary is not a viable substitute for region
composition.

This is a real intermethod-dispatch improvement. Using the matching clean
native acceptance phases, the conservative final results are approximately
1.132× native for Pixelate and 2.423× for Stellar Shard. They are within a 3×
ceiling but do not prove the stricter 1.5× target. The next useful step toward
that stricter target is a structurally verified lexical
inlining/region-composition tier for small SSA callees, not mutable inline
caches or another scheduler scan optimization.

#### Stellar Shard 3× acceptance audit

The 3× ceiling uses the clean recompiled JRE post-logo interval, 22.998
seconds, so the JVM.js limit is 68.994 seconds. The native and JVM.js evidence
both use the same 302-class recompiled tree SHA-256
`8ed5e98aa56c8407260af4aaffff94f56d00b4f7e7010307c42176ce96c11a5f`,
the same generic logo-complete and first-menu framebuffer classifiers, and the
same `main-menu` checkpoint. Three clean optimized JVM.js runs from the final
runtime tree measured 53.380, 60.430, and 53.641 seconds; their median is
**53.641 seconds**, or **2.332× native**. Every individual run is below 3×,
reached a painted 640×480
menu, and reported no runtime error.

The native authority is
`.work/jre-reflection-main-menu/stellarshard-current-post-logo.json`. The three
JVM.js samples are in
`.work/alterorb-jvmjs/stellarshard-eager-monomorphic-acceptance-third.json`,
`.work/alterorb-jvmjs/stellarshard-3x-acceptance-current-2.json`, and
`.work/alterorb-jvmjs/stellarshard-3x-acceptance-current-3.json`.
The 1.285-second value elsewhere in this document is explicitly a warm-cache
JFR profiling slice and must not be used as the denominator for this clean
acceptance result.

Phase-only production-path V8 sampling for Miner starts at the same post-logo
boundary. It attributed 35.97% of samples to JVM core/scheduling, 28.32% to JIT
runtime, 25.06% to generated guest JavaScript, 4.12% to interpreted opcodes,
and 2.87% to Wasm. The hottest guest body was the structurally compiled BZip2
decoder, but `execute`, `executeTick`, `_prepareSchedulerTick`, `tryRunFrame`,
resume dispatch, and resolved-call handling together cost substantially more
than any one numeric primitive. This profile is in
`.work/alterorb-jvmjs/2026-08-12-minerdisturbance-post-logo-cpu-production-path.json`.

Three tempting shortcuts were measured and rejected:

- raising the application-wide whole-method promotion threshold from 1 to 16
  increased Deko Bloko to 87.054 seconds post-logo (1.774× JRE);
- disabling Wasm let Miner finish its logo earlier, but it still had not
  reached its menu after 84.7 seconds post-logo, so it does not establish an
  end-to-end win; and
- removing the launcher's compatible real-time fake epoch prevented Miner
  from painting the logo and parked startup in its sleep/monitor path.

The later catalogue sweep above supersedes the old four-game conclusion: 19
of 33 exact pairs meet the phase target, while at least 20 of all 44 games are
known to miss it. The cross-game target is therefore not met, and cold-start
reductions must not be reported as progress toward this table.

## Deko Bloko JIT investigation and improvement

The 11.24× number above is the cross-game median from the older mixed-mode
evidence. A serial Deko Bloko investigation on August 12 used Node v26.4.0,
one worker, the production JIT gates, fake time with real-time progression,
and scheduler timing sampled at 1/64. The input artifacts were:

- gamepack SHA-256 `a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e`;
- 344 recompiled classes, tree SHA-256
  `4e79d7d54f1b112aaf0786da9cfc5fd4a8fcde415d9e15ded3314fdad61bc461`;
- java-tools base `374673353751b75c93f9edca93a5035e3bf40546`, with the
  optimizer changes described below in a dirty worktree;
- dekobloko-work `66af2a7f177d1f85dbf4f704929fcf5a9240ba55`, also dirty
  because the startup profiler/reporting changes were under test.

The whole-startup CPU profile attributed 31.86% of samples to JVM core,
25.57% to JIT runtime, 15.23% to generated guest JavaScript, 10.61% to Wasm,
6.68% to interpreter opcode handlers, and 2.22% to GC. This ruled out canvas
upload and AWT painting as the cause of the startup gap. It also showed that
partial Wasm was not automatically the best tier: disabling whole-method JS
promotion increased startup to 181.155 seconds and raised partial-Wasm runs to
4,562,583.

Two generic changes produced repeatable improvements:

1. Structured SSA gained exact Java `long` constants, conversions, arithmetic,
   shifts, comparison, and checked division/remainder. This moved the 857-item
   fixed-point/array body from baseline JS to structured SSA, cut that body's
   CPU-profile share from 5.393% to 1.431%, and reduced a profiled startup from
   144.661 to 124.843 seconds. No guest identity participates in admission.
2. Structured SSA gained verified lookup/table switches and a structured-only
   admission path for hot primitive-array loops containing constructor islands.
   The old policy rejected the complete 3,364-item body because baseline JS
   cannot safely replay an interrupted `new`/constructor pair. The new path may
   enter only after adaptive heat and only if the structured CFG, stack, class,
   and continuation proof succeeds. A failed proof returns to the interpreter;
   it cannot fall through to baseline codegen. This moved the dominant body
   from `not-generated` to `structured-ssa+resume`.

The structured-only feature has
`JVM_DISABLE_STRUCTURED_UNSAFE_CONSTRUCTOR_CALLERS=1` as a same-build comparison
gate. The explicit disabled run took 128.483 seconds. Enabled runs took 100.374,
100.395, and 98.065 seconds (median 100.374 seconds), a 21.9% improvement versus
the explicit control. Two immediately preceding controls in the same serial
session took 133.943 and 136.851 seconds; the three nearby disabled/control
median was 133.943 seconds, making the enabled-median reduction 25.1%. The new
median is 3.60× the 27.848-second native recompiled Deko Bloko time, rather than
the older mixed-mode 6.5× Deko result or the 11.24× cross-game median.

The following ideas were measured but were not credited with an end-to-end
win: direct metadata-published static Math intrinsics (30% faster in a two
million-call microbenchmark but neutral in full startup), zero-copy discarded
headless audio (removed a Node allocation but had unstable full-run timing),
and switch rendering by itself (133.943 seconds disabled versus 136.851 seconds
enabled because the dominant method was still barred by constructor admission).
An experimental multi-bytecode interpreter burst was slower and was reverted.

Representative reproduction command:

```bash
JVM_PROFILE_SCHEDULER_TIMES=64 \
ALTERORB_JVMJS_TCP_PORT=44594 \
ALTERORB_JVMJS_HTTP_PROXY_PORT=18081 \
node scripts/launch-alterorb-games-jvmjs.js \
  --game dekobloko --jobs 1 --timeout-ms 300000 \
  --until-main-menu --menu-scene-transitions 0 --recompiled \
  --report .work/alterorb-jvmjs/dekobloko-structured.json
```

Add `JVM_DISABLE_STRUCTURED_UNSAFE_CONSTRUCTOR_CALLERS=1` for the comparison
run. Add `--cpu-profile` for the all-node V8 category and self-time report.

## 2026-08-13: bounded hot call-graph region prototype

The method-at-a-time structured tier now has an opt-in, backend-neutral call
graph planner and JavaScript region backend. Admission uses loaded `Method`
identities, bytecode call semantics, renderer-published call-site metadata,
CFG/effect summaries, bounded transitive traversal, and SCC analysis. It does
not inspect guest class or method names. Exact static/special edges and
caller-specific monomorphic virtual edges are guarded; unresolved edges remain
canonical boundaries. Region source composition parses JavaScript with Acorn
and edits AST ranges published by the SSA renderer. It does not use regex to
recover call structure from generated source.

The backend emits locally bound multi-method functions, removes the complete
generic admission/deoptimization block around transitively atomic callees, and
dominates child lifecycle checks at the region entry. Throwing operations keep
their bytecode PC and restoration plan. A differential fixture verifies a
normal five-node graph, a no-`Frame` normal path, guard fallback before side
effects, an inner arithmetic exception, and reconstruction of omitted
`root -> middle -> leaf` frames. The full focused JIT run passed 1,694/1,694:

```bash
timeout 240s node node_modules/tape/bin/tape \
  test/jitCompiler.test.js test/hotCallGraphRegion.test.js
```

Three independent Node proxy runs used 5,000 invocations, five samples per
implementation, 58 bytecodes, and a three-method numeric graph. Their paired
speedups were 6.340x, 6.979x, and 5.748x; the median was **6.340x**. Every run
produced checksum `1765543936`. The command is:

```bash
cd ../java-tools
JVM_REGION_BENCH_ITERATIONS=5000 \
JVM_REGION_BENCH_SAMPLES=5 \
npm run benchmark:jvm:hot-call-graph
```

An early admission bug installed single-node wrappers that eliminated no call
edge. Tomb Racer then entered `kr.a(ILnna;)I` 6,889,643 times in 70 seconds and
regressed badly. Admission now requires either a genuinely eliminated atomic
edge or, for a framed root, at least two exact calls to the same bounded small
callee. No-op wrappers cannot be installed.

The framed form recognizes Tomb Racer's archive decoder as a seven-node region
with 30 repeated exact edges and runs it once. It also removes internal
per-invocation structured counters; production structured invocation counters
are now disabled unless `JVM_ENABLE_STRUCTURED_RUN_COUNTERS=1` (or JIT method
profiling) explicitly requests them. Safe-point, fallback, and exception
counters remain. This follows the earlier profiling conclusion that invocation
counts must not mutate global telemetry in the hot path.

The end-to-end Tomb acceptance target is **not met**. With CPU 6 pinned,
recompiled classes SHA-256
`6e03aa87a44d4bd210f559e294f13849263271109ae5025254e96a9391fa3fe4`,
gamepack SHA-256
`0764abb0cc29bf89d91434d999f181399b1ffc3dcdea7c9f062fd3c7e7aefd5e`,
java-tools base `374673353751b75c93f9edca93a5035e3bf40546` plus the dirty
prototype, and `JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`, the final run crossed the
visual post-logo boundary at 43.084 seconds but did not reach a menu by 220
seconds. It reported no runtime exception; after the logo the surface became
white and the remaining game loops were sleeping. Therefore this prototype is
still opt-in and no Tomb/JRE ratio is claimed. The exact report is
`.work/alterorb-jvmjs/2026-08-13-tombracer-hot-call-graph-no-run-counters.json`.
The failed single-node and intermediate reports are retained beside it as
negative evidence.

## Warmed runtime result (the optimization target)

Cold startup is not an acceptance target for the renderer/JIT work above. It
must not be shortened by selecting a tier that makes warmed animation, gameplay,
or audio slower.

An initial unpinned run incorrectly appeared to put all three model shapes
within 1.5× of HotSpot. That conclusion was rejected after inspecting the host:
it is a hybrid Intel system whose allowed CPU set contains performance and
efficiency cores. The Node and Java processes could land on different core
types, making a same-command ratio alternate in either direction. The valid
measurements below pin both processes to performance CPU 6.

The generic warmed proxy was run three times independently on August 12 with
Node v26.4.0, OpenJDK 11.0.31, 2,000 invocations, six warmup rounds, and nine
measured rounds:

```bash
cd ../java-tools
DEKOBLOKO_TOY_TIERS=structured \
DEKOBLOKO_TOY_INVOCATIONS=2000 \
DEKOBLOKO_TOY_ROUNDS=9 \
DEKOBLOKO_TOY_WARMUPS=6 \
taskset -c 6 node scripts/benchmarkDekoblokoHotLoops.js
```

Every run produced the HotSpot checksum. The table reports the median of the
three independently measured medians. The ratio column is the median of the
three paired ratios, not a ratio reconstructed from independently sorted times.

| Guest body | HotSpot median | JVM.js median | JVM.js / HotSpot |
| --- | ---: | ---: | ---: |
| Vertex transform | 34.864 ms | 66.328 ms | 1.912× |
| Face selection | 47.534 ms | 118.731 ms | 2.493× |
| Combined model body | 90.185 ms | 181.179 ms | 2.002× |

The warmed ≤1.5× target is therefore **not met**. Before the latest array work,
three pinned runs had ratio medians of 1.913×, 2.900×, and 2.415×. The retained
generic changes reduce the face ratio by 14.0% and the combined ratio by 17.1%;
the vertex ratio is effectively unchanged. This is useful progress, but not
evidence that the renderer is finished or that Firefox will sustain 30 FPS.

The change set responsible for the broader warmed coverage is generic:

- verified Java `long` arithmetic and switch CFGs are rendered in structured
  SSA;
- constructor-containing primitive-array loops may enter a structured-only
  tier after the normal CFG/stack/continuation proof;
- initialized static JRE intrinsics use metadata-published positional entries;
- runtime-resolved pure integer call chains use a fixed-arity scalar ABI, and a
  receiver loaded from an entry-stable local is checked once per generated
  invocation;
- a primitive array read from an entry-stable instance field retains its raw
  storage identity through a uniquely verified local snapshot;
- counted loops whose bound is an entry-stable primitive array's length can
  hoist direct load/store range checks; and
- an indirect gather of the form `target[indexArray[induction]]` may scan the
  immutable integral index array once and hoist the target bounds proof. The
  proof is limited to structurally counted, call-free loops, bounded to 1,024
  elements, and rejected if the source array kind can be stored by the method;
- guest PCM writes can pass an offset/length view to a capable output sink
  without copying the Java byte array.

None of these admissions use a guest class or method name. They use bytecode
descriptors, CFG/natural-loop structure, SSA value provenance, unique local
stores, field-write summaries, array kinds, and entry guards. Null or invalid
index proofs select the checked arm; the focused test verifies the exact JVM
exception type, bytecode PC, and mutations preceding the exceptional element.

Two more aggressive intermethod experiments were rejected and removed. A
versioned monomorphic raw-call body increased a 500,000-iteration dynamic loop
from the roughly 5 ms range to 6.7–9.8 ms. Lexically inserting the callee IR
through the JavaScript AST (not regular expressions) still measured roughly
5.0–7.7 ms and was also slower than the retained fixed-ABI call. HotSpot's
sub-millisecond/low-millisecond samples varied enough that absolute medians and
the Dekobloko-shaped benchmark are more reliable than a single microbenchmark
ratio.

Ordinary method-at-a-time Wasm was also measured on the face proxy rather than
assumed faster. With ordinary JavaScript-backed arrays it took 106.638 ms for
100 calls versus 2.244 ms on HotSpot. Allocating the primitive arrays in the
existing shared Wasm linear heap reduced that to 25.377 ms, but the structured
JavaScript tier takes about 7.4 ms for the same quick sample. The Wasm compiler
did compile the transform, face, and scalar helper bodies, so this was not an
interpreted fallback. Field/reference imports, separate method entries, and JVM
state transitions still dominate. Enabling this Wasm path would regress warmed
performance. A useful future Wasm experiment must keep a larger intermethod
region and its primitive storage inside Wasm, with bulk import/export at region
boundaries.

V8 tracing confirmed that the generated restoring positional face method
reaches TurboFan and does not repeatedly deopt. The remaining gap is therefore
not explained by generic call dispatch or a body stuck in V8's interpreter.
The next target should be a compact fast worker separated from the exceptional
restoration arm, or a genuinely region-sized Wasm module—not more guest-specific
JavaScript kernels.

The captured moving-logo replay provides a larger rendering check:

```bash
DEKOBLOKO_ANIMATION_LOOPS=1 \
DEKOBLOKO_ANIMATION_WARMUPS=8 \
JAVA_TOOLS_DIR=../java-tools \
taskset -c 6 node scripts/benchmark-dekobloko-animation.js
```

Three pinned runs rendered the same 250-state timeline at 51.91, 49.87, and
49.04 FPS: **49.87 FPS median**. Their median guest render times were 14.629,
14.246, and 14.320 ms (**14.320 ms median**). Every run had 225 unique surfaces,
224/249 changed transitions, and sequence hash `1711060353`. Thus the replay
remained moving and deterministic rather than benchmarking one cached image.

A same-tree, same-core run with both new array gates disabled measured 47.30,
47.40, and 48.99 FPS (**47.40 FPS median**) and 14.645 ms median guest render.
The retained optimization therefore improves presented FPS by 5.2% and median
guest render by 2.2% on this larger workload. An older unpinned 38.08 FPS result
is retained only as historical context; it is not a valid A/B on this hybrid
CPU.

The guest stereo mixer was also run three times on CPU 6 for 100 chunks (51,200
frames). Its median steady average was **10.061 ms** against a **23.220 ms**
deadline. The same-tree disabled runs had a **10.914 ms** median, so the array
work improves steady synthesis by 7.8%. Enabled runs missed 4, 4, and 3 total
deadlines (initialization included), with no consecutive miss streak longer
than one. Left and right checksums remained `909740583` and `182903747` in all
six runs, confirming that both channels/instrument output remained distinct.

Provenance for these measurements:

- `dekobloko.jar` SHA-256:
  `a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e`;
- animation class-tree SHA-256:
  `b2e7bce0e174a31bb0a0984f6bde2e2312e2ed5c009b058e29c4145c3cfce411`;
- java-tools base SHA-1: `374673353751b75c93f9edca93a5035e3bf40546`;
- dekobloko-work base SHA-1: `66af2a7f177d1f85dbf4f704929fcf5a9240ba55`;
- both repositories had tracked, uncommitted optimizer/measurement changes;
- no `JVM_*` gate was set for the qualified structured hot-loop or animation
  result; the explicit Wasm comparison used `JVM_WASM_STRUCTURED=1` and the
  benchmark's `wasm` tier enables `JVM_WASM_JIT=1` plus a 256 MiB linear heap.

The same-tree disabled animation/audio controls set both
`JVM_DISABLE_STRUCTURED_FIELD_ARRAY_LOCAL_VIEWS=1` and
`JVM_DISABLE_STRUCTURED_INDIRECT_ARRAY_RANGES=1`.

## Resumable hot call-graph region experiment (August 13, 2026)

The method-at-a-time limitation was addressed with a new, opt-in
`HotCallGraphRegionCompiler`. It discovers a bounded graph from loaded Method
identities and SSA-published call-site metadata, computes transitive effects
and SCCs, retains unsupported calls as explicit canonical boundaries, and
emits one JavaScript module containing locally linked functions. Admission and
code generation do not inspect guest class or method names. JavaScript source
composition is driven by Acorn AST ranges; no regular-expression source
rewriting is used.

Runtime receiver feedback can grow an initially open graph. Expansion is
batched to avoid repeatedly parsing a large module as adjacent sites link, but
a single boundary that executes for 64 region entries forces expansion. Cold
loop callers no longer compile regions merely because their first virtual
target linked. Existing adaptive entry/time heat and the structurally selected
large dynamic-array-loop policy provide the hotness signal. Rejection telemetry
records bounded `{root, reason, count}` rows and exposed the formerly hidden
causes (`uncompiled-structured-target`, native/constructor boundaries, and
polymorphic sites).

The first framed implementation used an ordinary PC-0 adaptive body. It could
enter `fka.a(II)[I` but returned to method-at-a-time execution at its first
boundary. Allowing that ordinary body to re-enter at an arbitrary materialized
PC was invalid: its generated prologue explicitly accepts only PC 0 and its CFG
locals describe a fresh entry. This approach was removed.

The retained prototype instead exports the structured generator source and a
continuation wrapper. A region that reaches a canonical boundary stores the
same verified iterator, bytecode PC, field-array guards, locals, and operand
state used by ordinary structured SSA. The scheduler resumes that iterator
after the child retires. This reduced hot-region resumptions from millions to
hundreds in Tomb Racer. A separate attempt to invoke positional callees from
the generic resolved-target dispatcher failed live semantics with an early
guest bounds exception and was removed; polymorphic positional dispatch must
be emitted inside the generated caller/PIC ABI, where continuation ownership
is explicit.

The Node proxy remains correct and fast. Three independent runs (3,000
iterations, five samples) produced the same checksum `-1517654016` and measured
6.738x, 6.300x, and 6.466x speedups (median **6.466x**). The runtime-feedback
fixture verifies that two independent virtual bytecode edges close and link
without any guest identity rule. Focused validation passed 23/23 call-graph
assertions and 49/49 scheduler assertions. The complete JIT suite passed
1,676/1,676.

The real Tomb Racer acceptance target is still **not met**. The qualified
native JRE post-logo-to-menu time remains 108.064 seconds, so the 1.5x ceiling
is 162.096 seconds. With CPU 6 pinned, Node v26.4.0, recompiled class tree
SHA-256 `6e03aa87a44d4bd210f559e294f13849263271109ae5025254e96a9391fa3fe4`,
gamepack SHA-256
`0764abb0cc29bf89d91434d999f181399b1ffc3dcdea7c9f062fd3c7e7aefd5e`,
java-tools base `374673353751b75c93f9edca93a5035e3bf40546`, and both worktrees dirty,
the resumable run completed the logo at 39.542 seconds but never produced a
valid menu surface by 240 seconds. Its final surface was black. It compiled
seven modules and entered regions only 796 times: archive root 513, synthesis
root 279, and a later loading root four times. The main guest thread had
returned to `TombRacer.run()` and was sleeping, with no reported exception.
This is a major throughput change but a correctness failure, so the tier
remains disabled unless `JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1` is explicitly
set. No JRE ratio is claimed.

The exact retained reports are:

- `.work/alterorb-jvmjs/2026-08-13-tombracer-current-phase-profile.json` —
  method-at-a-time CPU attribution;
- `.work/alterorb-jvmjs/2026-08-13-tombracer-bounded-region-cpu.json` — the
  initial bounded-region CPU attribution;
- `.work/alterorb-jvmjs/2026-08-13-tombracer-resumable-safety.json` — clean
  80-second safety probe, logo at 39.175 seconds; and
- `.work/alterorb-jvmjs/2026-08-13-tombracer-resumable-region.json` — full
  240-second failed menu acceptance and black screenshot.

The next required milestone is a live differential harness for resumable
boundary calls and polymorphic receiver sites. It must compare the complete
post-logo static/array mutations and surface sequence against method-at-a-time
execution before another speed result is accepted. After correctness, the
remaining hot polymorphic edges should use a generated caller-owned inline
cache, not the generic dispatcher experiment that was rejected above.

## Closed call-graph follow-up and compiler breakthrough (August 14, 2026)

The region tier now admits any bounded, acyclic connected graph rather than
requiring a repeated bytecode target or an atomic child. Static, special, and
otherwise non-overridable calls are exact from loaded bytecode metadata;
virtual/interface edges still require runtime receiver feedback and retain
their PIC guard. Internal pure array-reading leaves may use their checked
scalar ABI, and a region root owns verified call-free subloops within one
finite safe-point budget. None of these decisions contains a guest class,
method name, or descriptor allowlist.

Direct JRE intrinsics now publish an explicit field-write effect. The scalar
`java.lang.Math` table and read-only String leaves publish an empty write set,
so a caller does not discard every instance-field cache around a pure host
operation. Intrinsics without metadata remain conservative. A focused Java
fixture verifies both the emitted cache lifetime and the exact returned value.

The most important discovery in this iteration was not guest execution. Two
Tomb Racer runs could not service a 100-second guest timeout before outer
watchdogs at 150 to 280 seconds. A regions-off control returned at 30.3 seconds,
proving the harness itself was healthy. An out-of-process V8 inspector profile
attached to the busy worker (rather than the idle launcher parent) collected
9,339 samples over 10.639 seconds: 8,340 samples, **89.3%**, were in
`HotCallGraphRegionCompiler.walkAst`. The compiler parsed a large generated
method once but then traversed that AST for every call edge and rebuilt the
complete source string for every edit. This was quadratic compilation work,
not an unpolled guest loop.

The retained compiler builds comment, call, assignment, and declaration
indexes in one Acorn AST traversal, then applies sorted non-overlapping edits
with one source join. It uses no regular-expression source rewriting. The
generic quick regression now includes a 128-edge caller: three clean runs
compiled that graph in 239.796, 258.084, and 238.668 ms, and the complete
benchmark finished in under four seconds. The same Tomb Racer worker then
returned at its 100.1-second guest deadline (100.5 seconds wall) with complete
telemetry. This is a cold/transition-time breakthrough and removes a severe
event-loop stall, although cold compilation time is not counted as a gameplay
speed success.

Two runtime experiments were measured and retired:

- lexically inserting a checked child body into its caller SSA source; and
- deleting field-cache invalidations from a caller using a newly computed
  transitive region write set.

Both transformations were AST-based and passed the differential fixtures, but
the live `fka` synthesis body made less progress by the acceptance deadline.
The speculative virtual-effect version also duplicated receiver guards. The
retained module therefore links local generated functions and keeps the
method renderer's established invalidation/PIC semantics; telemetry reports
zero lexical splices and zero region-level invalidation deletions.

The retained Node proxy still shows a real intermethod gain. Three runs of
3,000 iterations and five timing samples measured 6.540x, 6.266x, and 6.891x
speedups, a **6.540x median**, with checksum `-1517654016`. This does not imply
that Tomb Racer meets its end-to-end threshold.

The qualified retained Tomb Racer run is
`.work/alterorb-jvmjs/2026-08-14-tombracer-retained-region-acceptance-run1.json`.
It completed the logo at 32.278 seconds but did not produce a menu surface by
205.037 seconds. At least 172.759 post-logo seconds elapsed, already **1.599x**
the native 108.064-second time and beyond the 162.096-second (1.5x) ceiling;
the real ratio is higher because loading had not completed. The final surface
was black with hash `76efddc5`, no runtime error was reported, and the loading
thread was still in `fka.a(II)[I@718`. Region summaries showed local modules
running without recurring deoptimization; this is now a generated guest-body
throughput problem rather than generic method dispatch or quadratic region
compilation. The 1.5x acceptance target is **not met**, so the tier remains
opt-in through `JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`.

Provenance recorded by that report:

- Node `v26.4.0`, Linux x64;
- recompiled game tree manifest SHA-256
  `032c7e7459edd7afd10498133778b71ec80e7cdbb337816f262a26da94833a43`;
- java-tools base `374673353751b75c93f9edca93a5035e3bf40546` (dirty);
- dekobloko-work base `66af2a7f177d1f85dbf4f704929fcf5a9240ba55` (dirty);
- `JVM_WASM_JIT=1`, `JVM_WASM_STRUCTURED=1`,
  `JVM_ENABLE_RENDERER_PIPELINE=1`,
  `JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`,
  `JVM_PROFILE_HOT_CALL_GRAPH_REGIONS=1`, and
  `JVM_TRACE_HOT_CALL_GRAPH_DEOPTS=1`.

The next performance target is the remaining generated `fka` numeric body at
the exact stalled PCs (465/718/755), using a body-level differential benchmark
and V8 code-shape profile. More dispatcher tuning or speculative cache
rewriting is not supported by the measurements.

Validation at this state was:

- `timeout 90s node node_modules/tape/bin/tape test/jitCompiler.test.js` —
  1,690/1,690 passed;
- `timeout 90s node node_modules/tape/bin/tape
  test/hotCallGraphRegion.test.js test/schedulerPerformance.test.js` —
  98/98 passed;
- `timeout 90s node node_modules/tape/bin/tape test/jreEdgeCases.test.js
  test/schedulerPerformance.test.js test/structuredSsaAdaptiveGrouping.test.js`
  — 203/203 passed;
- `node node_modules/tape/bin/tape test/browserBundleConfig.test.js` — 7/7
  passed;
- `node scripts/benchmarkHotCallGraphRegion.js` — checksum matched, 128-edge
  compilation gate passed, and the retained intermethod proxy remained faster;
- `npm run build:bundle` — production bundle built successfully (only the
  existing dynamic-require and asset-size warnings).

## Whole-call-graph coverage and elapsed-time profile (August 14, 2026)

The optimization tier is now entered from warmed loop roots and hot acyclic
callers, not only from methods that happen to cross the ordinary invocation
threshold again. A late structured upgrade is audited once at its next stable
PC-0 entry. Graph discovery runs to a fixed point over loaded Method identities,
runtime call-target feedback, effects, and SCCs. The generated module binds
every closed raw-call target to a local function by Acorn AST ranges; guest
class names, method names, and descriptors do not participate in admission.

The runtime guard now uses dependency and class-initialization epochs. Stable
entries still check debugger/thread/bytecode-check state, but do not rescan all
classes and call edges millions of times. Class-initialization state changes,
target publication, receiver feedback, and deoptimization invalidate the
epoch. Generated target source indexing and SSA-scope analysis use iterative
AST traversals to avoid recursion/Object.entries allocation on megabyte-scale
methods. No regular-expression source rewriting was added to the region tier.

Telemetry terminology was clarified after inspecting a real generated module.
`locallyLinkedEdges` counts all graph edges whose raw target is rebound to a
function in the same module. `scaffoldElidedEdges` (the older `loweredEdges`
field) is only the subset for which the complete exceptional/deoptimization
scaffold is proven unnecessary. For example, the hot archive graph has seven
nodes, 33 locally linked edges, no canonical boundaries, and zero scaffold-
elided edges. It is a whole-call-graph module even though precise restoration
code remains around its throwing calls.

A synchronous interpreter quantum was also added for the remaining cold call
islands. It executes only prepared synchronous handlers on the same canonical
Frame and returns to the existing async dispatcher before any unsupported
operation. In a V8 profile this reduced `executeTick` self time from 8.88% to
0.77%; it did not by itself reduce the Tomb Racer menu time enough.

Java `Thread.priority` was measured rather than assumed beneficial. A 10:1
deterministic scheduler starved Tomb Racer's priority-1 loading/UI thread behind
a continuously runnable priority-10 renderer. The run still had no menu after
300.021 seconds (logo at 34.837 seconds), with the loader runnable and the
renderer runnable. JVM.js multiplexes Java threads onto one JavaScript thread,
unlike HotSpot's concurrent host threads, so proportional priority scheduling
was removed. Fair round-robin scheduling and the separate deadline-limited
audio override are retained. The report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-priority-region-completion-run1.json`.

The retained fair-scheduler state is semantically clean but still misses the
performance target. A 180.266-second run completed the logo at 33.584 seconds
and had no menu after 146.682 post-logo seconds. The earlier same-tier
210.096-second fair run completed the logo at 34.581 seconds and still had no
menu after at least 175.515 post-logo seconds: more than **1.624x** the native
108.064-second time and beyond the 162.096-second acceptance ceiling. The
reports are respectively
`.work/alterorb-jvmjs/2026-08-14-tombracer-fair-region-acceptance-run1.json`
and `.work/alterorb-jvmjs/2026-08-14-tombracer-epoch-guard-acceptance-run1.json`.
The 1.5x target is therefore **not met**.

The important profiling result is that intermethod dispatch is no longer the
dominant cost inside closed regions. A canonical-frame diagnostic (which
intentionally guards regions out) attributed 50.07% of samples to JIT runtime
and 24.44% to generated guest code. With regions active, the corresponding
profile moved to 20.75% JIT runtime and 38.74% generated guest code; resolved
call dispatch was only about 0.38% self time. The complete closed `vma.b()[B`
sound-effect synthesis graph owned 20.59% of all samples, while the closed
`kr.e(Lnna;)V` archive graph owned 4.58%. The remaining problem is the enormous
generated numeric body (the synthesis module is about 1.30 MiB), plus scheduler
and still-interpreted call islands, rather than method lookup inside those
graphs. See
`.work/alterorb-jvmjs/2026-08-14-tombracer-fair-region-time-profile.json`,
`.work/alterorb-jvmjs/2026-08-14-tombracer-fair-region-coverage.json`, and
`.work/alterorb-jvmjs/2026-08-14-tombracer-region-cpu-profile.json`.

Two more aggressive transforms were tested and rejected:

- deleting the restoration scaffold for non-atomic internal calls preserved
  numeric results but omitted an intermediate Java frame on a nested throw;
- admitting final virtual targets before receiver/ABI feedback passed the
  generic fixture but produced a live guest array-bounds failure before the
  Tomb Racer logo. The exact report is
  `.work/alterorb-jvmjs/2026-08-14-tombracer-exact-dynamic-region-acceptance-run1.json`.

Both transforms were removed. A final 45.126-second live safety run reached the
logo at 34.441 seconds with no error. The region tier remains opt-in through
`JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`.

The retained V8 profile provenance is Node v26.4.0 on Linux x64, CPU 6 pinned,
gamepack SHA-256
`0764abb0cc29bf89d91434d999f181399b1ffc3dcdea7c9f062fd3c7e7aefd5e`,
recompiled class-tree SHA-256
`6e03aa87a44d4bd210f559e294f13849263271109ae5025254e96a9391fa3fe4`,
decompilation manifest SHA-256
`032c7e7459edd7afd10498133778b71ec80e7cdbb337816f262a26da94833a43`,
java-tools base `374673353751b75c93f9edca93a5035e3bf40546`, and
dekobloko-work base `66af2a7f177d1f85dbf4f704929fcf5a9240ba55`.
Both worktrees were tracked-dirty. Gates were `JVM_WASM_JIT=1`,
`JVM_WASM_STRUCTURED=1`, `JVM_ENABLE_RENDERER_PIPELINE=1`,
`JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`, `JVM_FAKE_TIME=1000000000000`,
`JVM_FAKE_TIME_REALTIME=1`, and `JVM_DEBUG_ARRAY_OOB=1`; the profile additionally
set `JVM_PROFILE_HOT_CALL_GRAPH_REGIONS=1` and `--cpu-profile`.

Final validation:

- `timeout 90s node node_modules/tape/bin/tape test/jitCompiler.test.js` —
  2,245/2,245 passed;
- `timeout 90s node node_modules/tape/bin/tape
  test/hotCallGraphRegion.test.js test/schedulerPerformance.test.js
  test/jreEdgeCases.test.js` — 295/295 passed;
- `node scripts/benchmarkHotCallGraphRegion.js` — checksum `-1517654016`,
  138.468 ms 128-edge compilation, 7.860 ms region versus 54.896 ms baseline,
  **6.985x** speedup;
- `node node_modules/tape/bin/tape test/browserBundleConfig.test.js` — 7/7
  passed; and
- `npm run build:bundle` — both bundles built successfully with the existing
  dynamic-require and asset-size warnings.

## Tomb Racer call-graph-first follow-up (August 14, 2026)

The native post-logo-to-menu reference remains 108.064 seconds, so the 1.5x
ceiling is 162.096 seconds. All runs below used the original Tomb Racer
gamepack SHA-256
`0764abb0cc29bf89d91434d999f181399b1ffc3dcdea7c9f062fd3c7e7aefd5e`,
Node v26.4.0 on Linux x64 pinned to CPU 6, and recorded both repositories as
tracked-dirty. The production gates were `JVM_WASM_JIT=1`,
`JVM_WASM_STRUCTURED=1`, `JVM_ENABLE_RENDERER_PIPELINE=1`, and
`JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`.

Several compiler-analysis costs were made identity-cached without changing
guest semantics: immutable bytecode label maps, normal-flow invoke scans,
Method-to-declaring-class lookup, and Wasm boolean-static capture analysis.
The clean report
`.work/alterorb-jvmjs/2026-08-14-tombracer-analysis-cache-acceptance-run1.json`
reached substantially later loader code but still had no menu after 210.115
seconds. A delayed CPU profile confirmed that the previous label-map and Wasm
local-index hotspots disappeared.

An oversized closed archive region exposed a correctness limit. Widening the
root from the production 1,000-item limit to 2,048 compiled a seven-node,
33-edge, 1,625-item module, but reproducibly changed an array index to `-1` in
the archive root. The exact failing report and emitted module are:

- `.work/alterorb-jvmjs/2026-08-14-tombracer-oversized-region-source-trace.json`;
- `.work/alterorb-jvmjs/generated-regions/3940004-0-kr.e_Lnna_V.js`.

The restored trace contains the root plus several materialized invocations of
a range-guarded helper. A local region function can return to a canonical child
Frame on a speculative range-guard failure, but the current module IR cannot
resume that interprocedural host call stack. A metadata-based admission guard
now leaves a target with a published restoring range-guard deoptimization as a
canonical boundary. The broad size limit remains 1,000 because the live plan
can be published before that later metadata is available; both widened
qualification runs still failed at the same precise bytecode PC. The unsafe
limit was not enabled in production.

The useful retained change is call-graph-first tier selection. Previously the
JIT extracted a local loop before attempting complete structured SSA. That
made the choice permanent and stranded large acyclic fan-out roots above their
loop-bearing descendants. Admission now uses bytecode size, call count, and a
backedge only: at least 128 instructions with either 16 calls, or eight calls
plus a backedge, attempts the complete structured compiler before partial-loop
extraction. Constructors and class initializers remain excluded. There are no
guest names, descriptors, source regexes, or handwritten kernels in this
decision.

On the late loader shape that motivated the change, the generic selector sees
207 bytecode items and 30 invokes, emits structured SSA, and publishes 22
call-graph edges. The clean report
`.work/alterorb-jvmjs/2026-08-14-tombracer-callgraph-structured-first-acceptance-run1.json`
painted Tomb Racer's own `Looking for drums...` loading screen at 29.260
seconds. Before this policy the same 210-second cutoff commonly remained on a
black surface behind the renderer monitor. This is a material execution
improvement, but the menu was still absent at 210.153 seconds: at least 180.893
post-logo seconds, or more than **1.674x** native. The 1.5x target is therefore
still **not met**.

Two follow-up experiments were rejected:

- broad epoch-triggered structured retries completed zero upgrades and caused
  repeated SSA/Acorn compiler work in the late phase; the ordinary-method retry
  and stable-entry audit were removed;
- preloading all 1,090 class files took 3.029 seconds outside the measurement,
  but still missed the menu and increased region fallbacks from 343 to 16,713;
  the preload path was removed.

The late delayed profile is
`.work/alterorb-jvmjs/2026-08-14-tombracer-drums-final-phase-cpu.json`.
Its sampled time was 34.25% JVM scheduler/core, 20.17% JIT runtime, 11.40%
generated guest code, 7.84% interpreter opcodes, 6.70% idle, 4.91% GC, and
4.26% Wasm. `_tryExecuteSynchronousInterpreterTick` alone owned 14.41%, while
resolved-call dispatch was below one percent at that boundary. This means the
next architectural milestone is a resumable interprocedural IR across
canonical/throwing call islands (or parallel guest-thread execution), not more
method-name recognition or another calling-convention micro-pass.

Validation for the retained code in this follow-up:

- `timeout 90s node node_modules/tape/bin/tape test/jitCompiler.test.js` —
  2,253/2,253 passed;
- `timeout 90s node node_modules/tape/bin/tape test/hotCallGraphRegion.test.js`
  — 110/110 passed;
- `timeout 90s node node_modules/tape/bin/tape
  test/hotCallGraphRegion.test.js test/schedulerPerformance.test.js
  test/jreEdgeCases.test.js` — 305/305 passed before the final range-guard
  admission test expansion;
- `node scripts/benchmarkHotCallGraphRegion.js` — checksum `-1517654016`,
  128-edge compilation in 149.739 ms, and 61.041 ms baseline versus 9.298 ms
  region (**6.565x**).

## 2026-08-14: whole-graph lowering boundary experiment

A bounded same-thread canonical-Frame handoff was tested after the scheduler
profile attributed substantial time to JVM core. It executed 5,430,959
handoffs, but at the 210-second cutoff the loader was blocked behind the
renderer monitor and the surface was black. The earlier fair-scheduler run had
already painted the nonblank `Looking for drums...` loading screen at the same
cutoff. The handoff optimization and its production counters were removed;
canonical calls still rotate through the fair scheduler.

The next experiment addressed a different method-at-a-time limitation. A hot
graph can now, behind the explicit
`JVM_ENABLE_GRAPH_OWNED_STRUCTURED_CANDIDATES=1` experiment gate, request a
structured SSA representation for a reachable method whose canonical codegen
cache had selected an ordinary tier. The graph-owned body is cached separately,
while the canonical generated function remains the guard, invalidation, and
fallback identity. An end-to-end test deliberately caches an array-reading
callee in the baseline tier, closes the caller-to-callee edge from bytecode
metadata, executes the region without a child `Frame`, and compares the exact
result. No guest owner, member name, or descriptor participates in admission.

This is useful differential infrastructure, but it is not a production win.
The enabled report
`.work/alterorb-jvmjs/2026-08-14-tombracer-graph-owned-ssa-acceptance-run1.json`
compiled 54 graph-owned candidates, missed the menu at 211.024 seconds, ended
on a black surface, and executed 948,578 hot-region entries. The same-build
disabled control
`.work/alterorb-jvmjs/2026-08-14-tombracer-graph-owned-ssa-disabled-control.json`
also missed the menu, but had reached the nonblank loading screen and executed
1,473,701 region entries. Logo completion was essentially equal (28.736 versus
28.998 seconds), so cold startup does not explain the difference. Graph-owned
per-method source composition is therefore opt-in only.

The result narrows the refactor requirement: traversing a whole graph and then
stitching additional independently rendered methods is still method-at-a-time
lowering in disguise. The next backend must build shared SSA/continuation state
for the graph itself, especially across canonical or throwing call islands,
before emitting JavaScript or Wasm. It must not merely make existing generated
functions larger. The native 108.064-second post-logo time and 162.096-second
1.5x ceiling remain unchanged and unmet.

Validation after restoring the production default:

- `timeout 90s node node_modules/tape/bin/tape test/jitCompiler.test.js` —
  2,253/2,253 passed;
- `timeout 90s node node_modules/tape/bin/tape
  test/hotCallGraphRegion.test.js test/schedulerPerformance.test.js` —
  178/178 passed;
- two warmed `node scripts/benchmarkHotCallGraphRegion.js` runs preserved
  checksum `-1517654016` and measured **6.966x** and **6.878x** speedups.

### Runtime call-site feedback and positional-dispatch experiment

Lightweight region-boundary feedback at the 90-second asset-loading phase
showed that the most frequent open edges were stable monomorphic byte-reader
calls: 477,454 and 356,514 calls at two sites and roughly 224,000 calls at two
more, each with one observed receiver type. Their ordinary generated call-site
records had no caller Method or bytecode PC, while structured sites did. All
generated tiers now publish this metadata through the same call-site API. This
is retained because it is semantics-neutral and is required for future
caller-owned graph construction and precise time attribution.

A follow-up tested using an already verified canonical positional adapter from
the generic dispatcher. The fixed-arity bridge performs no argument-array
allocation, preserves before-effects guard fallback, consumes operands only
after admission, and links an explicitly identified deoptimized child back to
the exact caller and return type. An initial live run found two lifecycle bugs
that unit fixtures had missed: recycled children retained stale generated-return
metadata, and a deoptimization was associated with the current top Frame rather
than the adapter's actual child. Both are now regression-tested, including
guard fallback and child-return reconstruction.

The corrected implementation survived a 20-second safety run, a 90-second
progress run, and the full 210-second cutoff without errors. The full report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-frame-positional-acceptance-run1.json`.
It completed the logo at 29.110 seconds, executed 6,823,964 positional calls
with 17,256 guarded fallbacks, but still did not reach the menu by 210.1
seconds. Therefore it does not meet the 162.096-second ceiling and is available
only through `JVM_ENABLE_FRAME_POSITIONAL_CALLS=1`; production leaves it off.

This result is consistent with the architecture finding above. A dispatcher
shortcut can remove some Frame setup, but it cannot carry shared SSA values or
continuations through the caller's graph. The retained next step is still a
caller-owned interprocedural IR. Uniform Method/PC metadata is the enabling
change from this experiment; the runtime shortcut is differential
infrastructure, not an accepted optimization.

Final production-default validation after gating the two rejected runtime
experiments:

- `timeout 90s node node_modules/tape/bin/tape test/jitCompiler.test.js` —
  2,267/2,267 passed;
- `timeout 90s node node_modules/tape/bin/tape
  test/hotCallGraphRegion.test.js test/schedulerPerformance.test.js
  test/jreEdgeCases.test.js` — 320/320 passed;
- `timeout 90s node node_modules/tape/bin/tape
  test/browserBundleConfig.test.js` — 7/7 passed;
- `npm run build:bundle` — succeeded; webpack emitted the four existing size
  and dynamic-require warnings and no errors.

## Shared interprocedural SSA follow-up (August 14, 2026)

The region backend now performs a bottom-up fixed point over a bounded closed
call graph. A call-bearing method publishes graph-internal positional SSA even
when it cannot safely expose a standalone frameless ABI. Once every outgoing
edge has a compatible body, the compiler substitutes scalar arguments and
results into the caller and repeats until a `root -> wrapper -> leaf` chain is
one generated JavaScript function. Dead local functions and call bindings are
then removed with Acorn-derived AST ranges. The optimizer contains no guest
class name, method name, descriptor allowlist, source regex, or handwritten
guest algorithm.

Runtime-monomorphic virtual leaves use receiver-type feedback and retain their
original PIC/canonical call as a cold guarded arm. Exact static call chains can
also cross throwing leaves and loops. Every inlined throwing edge reuses the
renderer-published restoration plan and the AST-selected original catch arm,
so an exception reconstructs every omitted Java frame in outer-to-inner order,
including the precise throwing bytecode PC, locals, and operands. A failed
lifecycle/debugger/type guard falls back before fused side effects, and a
scheduler exit resumes through canonical state rather than re-entering the
partially executed region.

The generic three-method benchmark now verifies that the emitted module has
only the root function and no remaining JavaScript call to its wrapper. A
representative five-sample run completed in 4.421 ms versus 53.172 ms for the
method-at-a-time baseline, a **12.026x speedup**, with checksum `-1517654016`.
The command finishes in about two seconds:

```bash
cd ../java-tools
node scripts/benchmarkHotCallGraphRegion.js
```

The differential suite covers arithmetic, null, and bounds exceptions; nested
loops; primitive and reference arrays; instance/static fields; float values;
runtime virtual-target changes; finite scheduler quanta; and exact restoration
of three omitted frames. The focused call-graph test passes 145/145 assertions,
and the complete JIT test passes 2,291/2,291 assertions.

### Artifact-equivalent Tomb Racer correction

The earlier comparison to a 108.064-second HotSpot reference was invalid: that
reference executed the **recompiled** JAR, while the recent JVM.js reports all
executed the **original** JAR. The recompiled bytecode is itself substantially
slower on HotSpot and cannot be used as the denominator for the original
artifact.

An exact original-JAR HotSpot rerun, pinned to CPU 6, measured **16.014
seconds** from logo completion to the first menu surface. The gamepack SHA-256
was `0764abb0cc29bf89d91434d999f181399b1ffc3dcdea7c9f062fd3c7e7aefd5e`,
identical to the JVM.js artifact. The artifact-equivalent 1.5x ceiling is
therefore **24.021 seconds**, not 162.096 seconds. The report is
`.work/jre-reflection-main-menu/2026-08-14-tombracer-original-artifact-post-logo.json`.
A second run with JFR enabled measured 15.999 seconds and retained the same
artifact hash in
`.work/jre-reflection-main-menu/2026-08-14-tombracer-original-jfr.json`.

With that correction, the best recorded JVM.js result in this series is
164.465 seconds, or about **10.27x** HotSpot. All shared-SSA runs reached the
expected 640x480 menu surface with sample hash `c027e655` and no runtime error,
but remain far outside the actual threshold:

| Region experiment | Post-logo to menu | JRE ratio |
| --- | ---: | ---: |
| Persistent static-array views | **164.465 s** | **10.27x** |
| Throwing/loop shared SSA | 186.832 s | 11.67x |
| Unbounded transitive restoring composition | 189.957 s | 11.86x |
| Source-byte-bounded composition | 190.424 s | 11.89x |
| Conservative shared SSA without the interpreter leaf bridge | 186.513 s | 11.65x |
| Produced-array local views (rejected) | 190.545 s | 11.90x |
| Guarded internal virtual edges in open regions | 186.443 s | 11.64x |
| Loop-local static-array views (rejected) | 189.911 s | 11.86x |
| Positional post-render loop outlining (rejected) | 184.936 s | 11.55x |
| Hoisted positional loop units (rejected) | 179.739 s | 11.22x |

The corresponding reports are
`.work/alterorb-jvmjs/2026-08-14-tombracer-loop-exceptional-shared-ssa-acceptance-run1.json`,
`.work/alterorb-jvmjs/2026-08-14-tombracer-transitive-restoring-shared-ssa-acceptance-run1.json`,
and
`.work/alterorb-jvmjs/2026-08-14-tombracer-source-budget-shared-ssa-acceptance-run1.json`.
The last two rows come from
`.work/alterorb-jvmjs/2026-08-14-tombracer-shared-ssa-no-interpreter-bridge-acceptance-run1.json`
and
`.work/alterorb-jvmjs/2026-08-14-tombracer-produced-array-views-acceptance-run1.json`.
Produced-array local views also made the smaller guest-audio proxy slightly
slower, so they are retained only behind
`JVM_ENABLE_STRUCTURED_PRODUCED_ARRAY_LOCAL_VIEWS=1`; they are not a production
default.

The open-region dispatch refactor removed 112 internal call scaffolds,
including 48 runtime-monomorphic virtual edges, while preserving the expected
surface and all exception/override tests. Its 186.443-second result was only
70 ms faster than the immediately preceding 186.513-second run, well inside
run-to-run noise. This is useful architecture—non-leaf loop callees can now use
one guarded scalar edge even when unrelated graph boundaries remain open—but
it proves dispatch is not the dominant Tomb Racer gap. The report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-open-guarded-internal-region-run1.json`.

A second generic experiment hoisted initialized static primitive-array
references and raw views into verified atomic counted-loop preheaders. Tomb
Racer compiled 12 such views but slowed to 189.911 seconds, so production keeps
the pass disabled. It remains available only through
`JVM_ENABLE_STRUCTURED_LOOP_STATIC_ARRAY_VIEWS=1`; the report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-loop-static-array-views-run1.json`.
The later runs occurred while two QEMU guests were active on the host, so they
are valid correctness/coverage evidence and a clear rejection of the very
large-module experiment, but not clean low-variance acceptance samples.

The artifact-matched HotSpot JFR profile shows this is real guest work rather
than a phase-classification mistake. During the 15.999-second phase, guest Java
owned 80.7% of execution samples. `fka.a(II)[I` was 29.3% self time and the
`nda -> vma -> fka` chain was roughly 33% inclusive. JVM.js's corresponding
phase profile also concentrates in the `vma/fka` generated region, but adds
large compiler, scheduler, interpreter, and garbage-collection costs. This is
the concrete reason the next region work targets loop-bearing virtual callees
and cold restoration scaffolding rather than another archive-specific helper.

The unbounded archive composition grew a generated module to roughly 1.19 MiB
without improving progress. Production therefore retains conservative limits:
512 expanded bytecode items, eight inline sites per target, and 262,144 source
bytes. Telemetry now distinguishes locally linked, lexically inlined, and
exception-restoring inlined edges, plus guarded fallbacks and source-budget
rejections. The older interpreter scalar-leaf bridge was removed: it optimized
one method boundary at a time, showed no stable live benefit, and could add a
dispatch probe to millions of warmed calls.

All measurements used Node v26.4.0, Linux x64, performance CPU 6, the original
gamepack SHA-256
`0764abb0cc29bf89d91434d999f181399b1ffc3dcdea7c9f062fd3c7e7aefd5e`,
recompiled tree SHA-256
`6e03aa87a44d4bd210f559e294f13849263271109ae5025254e96a9391fa3fe4`,
decompilation manifest SHA-256
`032c7e7459edd7afd10498133778b71ec80e7cdbb337816f262a26da94833a43`,
java-tools base `374673353751b75c93f9edca93a5035e3bf40546`, and
dekobloko-work base `66af2a7f177d1f85dbf4f704929fcf5a9240ba55`; both repositories were
tracked-dirty. Gates were `JVM_WASM_JIT=1`, `JVM_WASM_STRUCTURED=1`,
`JVM_ENABLE_RENDERER_PIPELINE=1`,
`JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`, `JVM_FAKE_TIME=1000000000000`,
`JVM_FAKE_TIME_REALTIME=1`, and `JVM_DEBUG_ARRAY_OOB=1`; all region-budget
environment overrides were unset, so the documented defaults applied.

This completes the first architectural milestone, but **does not meet the Tomb
Racer 1.5x acceptance target**. The key negative result is that recursively
splicing already-rendered method sources is not the same as constructing one
compact graph IR before backend emission. The next implementation should merge
bytecode CFGs and SSA value namespaces first, outline cold guard/exception exits,
run cross-method constant propagation and dead-code elimination once, and only
then emit structured JavaScript or one region-sized Wasm function. That is the
remaining route to reduce code size and keep the 12x proxy gain in the real
guest body.

### Host optimization-unit experiments

The generated `vma/fka` module was 657,603 bytes. Its `fka` node alone occupied
roughly 375 KiB and contained the hot synthesis loops plus their expanded cold
restoration paths. Node v26 reports V8's default
`--max-optimized-bytecode-size=61440`; a trace run produced no optimization
event for the oversized region node. Raising the limit to 1,000,000 was not a
solution: after propagating `process.execArgv` into launcher workers, the
artifact-identical run exceeded 3.5 GiB RSS and timed out at 300.1 seconds
without reaching the menu. The report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-v8-large-function-run1.json`.

An AST-driven backend experiment then outlined oversized structured loops as
separate host optimization units. It rejects generators, dynamic `eval`,
function-sensitive bindings, and jumps leaving the candidate region; no guest
identity or source regex participates. Java returns are explicitly propagated,
and throwing exits still reconstruct exact omitted Frames. The first version
used lexical closure state and timed out at 300.1 seconds after compiling 34
outlines representing 1,690,996 source bytes. Its report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-call-graph-loop-outlining-run1.json`.

The second version computed positional live-ins and mutated live-outs from the
AST, avoiding closure-captured scalar state. It passed 162/162 focused
call-graph assertions, including a return inside an outlined loop and precise
arithmetic-exception frame restoration. Tomb Racer reached the expected menu
hash `c027e655` without errors, but took **184.936 seconds post-logo**—11.55x
HotSpot and statistically indistinguishable from the 186.443-second guarded
region run. It compiled 58 outlines representing 3,382,246 source bytes. The
report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-call-graph-positional-loop-outlining-run1.json`.

Post-render outlining is therefore retained only for differential work behind
`JVM_ENABLE_HOT_CALL_GRAPH_LOOP_OUTLINING=1`; production keeps it disabled.
This distinguishes the required refactor from a JavaScript source split: the
compiler must partition the verified CFG/SSA graph before it duplicates null,
bounds, scheduler, and exception-restoration paths. Each hot subregion needs a
computed scalar/raw-array live-in/live-out ABI, while cold exits carry compact
deoptimization metadata that expands to canonical JVM Frames only when taken.

A final source-boundary control hoisted those positional helpers to module
scope and reused one live-out buffer per region node, eliminating per-loop
closure creation and result-array allocation. It improved the phase to
**179.739 seconds** (11.22x HotSpot), with the expected `c027e655` hash and no
errors. That is a real but modest 3.6% improvement over the 186.443-second
guarded-region comparison, still 7.48x slower than the 24.021-second acceptance
ceiling. The run compiled 29 outlined units representing 1,435,170 source
bytes; its report is
`.work/alterorb-jvmjs/2026-08-14-tombracer-call-graph-hoisted-loop-outlining-run1.json`.
The pass remains opt-in because this one sample is not enough to establish a
production win and the target miss is decisive.

## Unwind-compact materialization and outlining pairings (August 14, 2026)

A same-day paired series re-measured the outlining decision and added a new
generic restoring-tier compaction. All five runs used the original gamepack
(SHA-256 `0764abb0...`), CPU 6 pinned, the standard gates plus
`JVM_ENABLE_HOT_CALL_GRAPH_REGIONS=1`, and ran back-to-back on a host with
three idle QEMU guests resident, so they are mutually comparable but slower in
absolute terms than the earlier clean-host series (first frame ~24 s here
versus ~15 s there).

| Configuration | Post-logo to menu |
| --- | ---: |
| Production defaults (paired baseline) | 187.754 s |
| Unwind-compact materialization only | 186.431 s |
| Loop outlining only | **179.312 s** |
| Loop outlining + unwind compaction | 185.049 s |
| Fine outlining (8 KiB minimum, 64/node) | timeout > 300 s |

Reports:
`.work/alterorb-jvmjs/2026-08-14-tombracer-session-baseline-run1.json`,
`.work/alterorb-jvmjs/2026-08-14-tombracer-session-unwindcompact-only-run1.json`,
`.work/alterorb-jvmjs/2026-08-14-tombracer-session-outlining-run1.json`,
`.work/alterorb-jvmjs/2026-08-14-tombracer-session-outlining-unwindcompact-run1.json`,
and `.work/alterorb-jvmjs/2026-08-14-tombracer-session-fine-outline-run1.json`.

Three conclusions:

1. **Loop outlining's earlier rejection was a contaminated comparison.** Its
   179.7-second sample had been judged against the clean-host 164.5-second
   best; paired on one host it is a real −4.5% at default knobs. It remains
   opt-in pending a clean-host pairing, but the negative verdict recorded
   above should not be treated as settled.
2. **Unwind-compact materialization is timing-neutral live and is retained
   default-on for its source-size effect.** The structured restoring tier now
   materializes a locals-free unwind frame at throwing sites whose bytecode
   index no in-method exception-table entry covers (array load/store,
   arraylength, div/rem by zero, negative array size, and null field access);
   scheduler yields, deopts, and invoke exception paths keep exact
   full-locals restoration, and a release path restores the frameless
   invariant if a guarded helper ever returns instead of throwing. The
   check is purely structural (exception-table ranges); no guest identity
   participates. `JVM_DISABLE_SSA_UNWIND_COMPACT_MATERIALIZATION=1` disables
   it. The focused JIT plus hot-call-graph suites pass 2,465/2,469 with the
   feature on and off alike (the four failures pre-exist in the tracked-dirty
   tree). In the live fka module it compacted 136 of 406 restoration arms;
   every remaining full arm is a scheduler-resume or invoke-exception site
   that genuinely needs its locals.
3. **The optimization-unit blocker is flat straight-line bulk, not loops or
   cold arms.** With outlining and compaction on, the hot `fka` module still
   contains a 290,302-byte root residual and one 289,000-byte outlined
   payload; at an 8 KiB outline minimum it still contains 252,107-byte and
   226,660-byte units while 86 finer outlines drove the run past the
   300-second timeout. The synthesis loop's body is a flat sequence of small
   loops and straight-line code that source-level slicing cannot decompose
   into engine-optimizable units without paying per-call ABI costs inside
   hot iterations. This closes the source-splicing avenue and leaves the
   previously recorded conclusion as the only route: partition the verified
   CFG/SSA graph before emission (or emit one region-sized Wasm function),
   with cold exits carried as compact deoptimization metadata.

The acceptance verdict is unchanged: **the Tomb Racer 1.5x target is not
met**; the best paired result in this series is 179.312 seconds against the
24.021-second artifact-equivalent ceiling. The unwind-compact implementation
lives in java-tools `src/jit/JvmSsaBlockRenderer.js` (tracked-dirty alongside
the day's earlier region work).

## Straight-line partitioning of oversized region bodies (August 14, 2026, second series)

The previous section's conclusion — that flat straight-line bulk cannot be
sliced at loop granularity — motivated a statement-run partitioner instead:
`partitionOversizedLinearBlocks` in java-tools
`src/jit/HotCallGraphRegionCompiler.js` (opt-in,
`JVM_ENABLE_HOT_CALL_GRAPH_LINEAR_PARTITION=1`). After loop outlining, any
module function whose executable self-size exceeds
`JVM_HOT_CALL_GRAPH_LINEAR_PARTITION_UNIT_BYTES` (default 49,152) has runs of
consecutive statements extracted into module-level helpers with the loop
outliner's positional live-in/live-out ABI. A run executes once per arrival
at its block position, so unlike fine loop outlining the ABI cost is
amortized over ~32 KiB of straight-line work. Three protocol extensions were
required: an outward-jump table (outcome 3) that re-establishes
break/continue at the call site, hoisting of run-level `let`/`const`
declarations whose bindings are referenced after the run, and a shared
labeled-block epilogue for live-out write-backs (per-exit write-backs
re-grew a name-dense segment to 155 KB). Statements larger than a segment
recurse into their nested statement lists; segment helpers are terminal
(re-partitioning one only re-plumbs its live-name set). The pass is covered
by a differential tape suite (`test/hotCallGraphLinearPartition.test.js`,
91 assertions executing original and partitioned modules against identical
inputs) which caught one real bug also latent in the loop outliner: a
multi-statement exit rewrite replacing an unbraced if-consequent ran its
`break`/`return` unconditionally. Both rewrites now emit braced blocks.

Paired same-session Tomb Racer runs (three QEMU guests resident again;
absolute numbers are not comparable to the morning series):

| configuration | post-logo menu time |
|---|---|
| outlining only (session baseline) | 214.4 s |
| outlining + linear partitioning | 218.6 s |
| diagnostics (partition arm, tracing enabled) | 219.1–227.3 s |

Live effect, verified with `--trace-opt` mirrored through the launcher's new
`ALTERORB_JVMJS_CHILD_LOG` passthrough: the partitioner emitted 285–292
segments across 26 module compiles; every positional region module now has
all units under the 49 KiB budget (live fka module: 32 functions, largest
47.3 KB, previously 465 KB); V8 reports 139 TurboFan completions for region
node and outlined-loop functions where the earlier series recorded none.
The mechanism works. The timing did not move, and the CPU profile of the
partition arm explains why:

1. **Loading heat is diffuse, not kernel-shaped.** The largest single guest
   function is 5.7% self (`jvmRegionOutlinedLoop1_0` in the framed
   `vma.b()[B` module, already TurboFan-optimized); no `jvmRegionSegment*`
   function appears in top-self at all. The phase spends ~25% in jit-runtime
   dispatch (`tryInvokeResolvedTarget`, `dispatcher`, `tryInvokeSyncAt`),
   ~15% in jvm-core scheduling/interpretation, ~28% spread across hundreds
   of generated guest functions, ~12% idle, ~5% GC.
2. **The framed generator tier carries much of the region execution.** The
   hot region modules in the profile are `?tier=hot-call-graph-framed-region`;
   their roots are 0.9–1.2 MB generator functions with hundreds of yield
   points that no source-level pass can split (a yield cannot cross a
   function boundary). Partitioning correctly skips them.
3. **Unit size was a real defect but not this phase's bottleneck.** Fixing
   it is necessary groundwork (and composes with the planned pre-emission
   partitioner) but the loading gap is dominated by per-call dispatch
   overhead and the framed tier, which require the CFG/SSA-level backend
   (yield-aware resume points, cheaper calling convention or Wasm) rather
   than more source surgery.

The acceptance verdict is unchanged: **the Tomb Racer 1.5x target is not
met** (best this series 214.4 s against the 24.021-second ceiling; the host
was contaminated throughout). Linear partitioning stays opt-in alongside
loop outlining pending a clean-host pairing.

## Framed-tier partitioning: environment lift + yield* delegation (August 14, 2026, third series)

The previous series ended on "a yield cannot cross a function boundary."
That is true of a plain call, but not of generator delegation: `yield*`
forwards yielded values, argument-less `next()` resumes, and
`iterator.return()` abandonment transparently, and the framed continuation
wrapper uses exactly that driver protocol and nothing more. Two passes in
java-tools `src/jit/HotCallGraphRegionCompiler.js` (opt-in,
`JVM_ENABLE_HOT_CALL_GRAPH_FRAMED_PARTITION=1`) now make framed region
modules splittable:

1. **`liftOversizedUnitLocalsToEnvironment`** — the cheaper calling
   convention. A live framed root (`oc.a(B,I)V`, 1.17 MB) declares 975
   function-scoped locals referenced ~16,000 times; under the positional
   segment ABI those names re-plumb through every boundary, and the naive
   split grew the module to 3.5–8.5 MB while the root itself *grew* with
   smaller targets (356–752 KB). The pass rewrites every single-declaration
   top-level `let`/`const` into one per-invocation environment array, so a
   segment's free names collapse to the array plus the five unit parameters.
2. **Generator-aware partitioning** — in a generator unit, a statement run
   containing depth-0 `yield` is extracted into a `function*` helper reached
   through `yield*`; yield-free runs keep plain helpers. Protocol (outcome
   array, outward-jump table, shared epilogue) is unchanged; the shared
   state array is written and consumed inside one synchronous burst, so
   suspension inside a helper never exposes a torn protocol window.

Offline on the 1.17 MB dump: root 1.17 MB → 48.6 KB, all 52 module
functions under V8's 61,440-byte optimized-bytecode budget, +15% total
source. Differential coverage grew to 329 assertions
(`test/hotCallGraphLinearPartition.test.js`): yield sequencing, mid-run
abandonment finallys, throws across delegation, env-lift purity with
shadowing and closures. A third defect class was found and fixed while
attributing the first live regression: `applySourceEdits` was
O(edits × source) (69% of pass self-time, 8.5% GC on top); a single forward
chunk join made the pass 5.9x faster with byte-identical output and cut the
live pass cost from ~75 s to 8.9 s per load (measured by the new
`hotCallGraphPartitionPassMillis` counter).

Paired same-session Tomb Racer runs (same contaminated host class as the
second series):

| configuration | post-logo menu time |
|---|---|
| framed partitioning, slow pass | 282.8 s |
| its paired baseline | 224.9 s |
| framed partitioning, fast pass | 226.9 s |
| its paired baseline | 211.2 s |
| trace-opt diagnostic (framed arm) | 229.1 s |

Identical-config baselines drifted 211.2–224.9 s between pairings, so the
fast-pass framed arm is neutral within host noise once its remaining 8.9 s
pass cost is discounted. The live counters confirm the mechanism end to
end: 705 framed segments, 18,246 lifted locals, and — decisive — V8 reports
**195 TurboFan completions for `jvmRegionSegment*` helpers** (generator
helpers included, some OSR, zero segment deopts) where the framed tier
previously had zero optimizable functions.

Conclusion: both halves of the "unoptimizable guest code" theory are now
closed. Positional units (second series) and framed generator roots (this
series) are all TurboFan-compiled, and post-logo loading still does not
move. The gap is where the profile said it was all along: ~40% per-call
dispatch and scheduling overhead (`tryInvokeSyncAt` chains, per-entry
re-evaluation of module declarations across 2.3M region runs, Frame
lifecycle). The next architectural step is dispatch-side: evaluate region
modules once and enter through a factory instead of re-declaring every
helper per run, then shrink the `tryInvokeSyncAt` fast path — or lower the
whole calling convention into Wasm. The acceptance verdict is unchanged:
**the Tomb Racer 1.5x target is not met** (211.2–229.1 s this series
against the 24.021-second ceiling).

## Direct wasm→wasm static linking (August 14, 2026, fourth series)

The dispatch cost was first isolated in a minimal reproducer (java-tools
`benchmarks/CallBoundaryHotLoop.java` + `scripts/benchmarkCallBoundaryHotLoop.js`,
median of 5 on both HotSpot `-Xbatch` and the production wasm tier,
checksum-compared): an arithmetic-only loop runs at 1.1x native, adding one
tiny static call per iteration costs ~36–40 ns and lands at 45–50x, and a
blend of 4 arithmetic ops + 1 call reproduces the whole-app ~11.7–11.9x
ratio exactly. The per-call boundary — exit compiled code, walk the
`tryInvokeSyncAt` chain, build a Frame, re-enter — *is* the gap.

The iteration on that boundary (java-tools, opt-in
`JVM_WASM_DIRECT_STATIC_LINK=1`): every wasm module now exports a `runv`
wrapper (params → [status, value], fuel supplied in-wasm) plus a `retv`
mutable global carrying the return value, and eligible static call sites
(non-partial callee, identity slot mapping, no exception-handler wrapper on
the caller) import the callee's `runv` directly as a wasm function import —
zero JavaScript on the call path, with an in-wasm status check at the site.
On the reproducer this collapses the call shape from 39.5 to 7.2 ns/iter
(48.8x → 8.9x) and the blend from 11.9x to 2.2x; the pre-existing
intermethod benchmark moves static 66x → 6.8x and virtual/interface
105/103x → 19x (receiver dispatch still bridges through JS). Suite
status (corrected in the fifth series): the default runner stops at the
first failing file, so the "1172/1173" observed here covered only the
first third of the files; the genuinely full run
(`JVM_TEST_CONTINUE_ON_FAILURE=1`, 196 files, 8820 tests) passes with
only the same single pre-existing failure, flag off, and targeted wasm
suites pass with the flag on.

Paired same-session Tomb Racer runs, flag off then on, same core:

| configuration | post-logo menu time |
|---|---|
| baseline (retv/runv emitted, link off) | 175.9 s |
| direct static linking on | 180.8 s |

No measurable whole-game effect (the +4.9 s is inside the 211.2–224.9 s
baseline drift band observed across this host's pairings). The counters
say why: during loading the wasm tier ran only ~180k times while the JS
region tier ran ~3.7–3.95M (`referenceFramelessPositionalRuns`) — loading
is dominated 20:1 by JS-tier dispatch, so a 5.5x cheaper wasm-tier call
boundary is invisible there. The reproducer fix is real and kept (opt-in),
but the loading-time attack surface is the JS tier's per-call path:
evaluate region modules once behind entry factories, shrink
`tryInvokeSyncAt`, or move the loading-hot call graph onto the wasm tier
so the direct links apply. The acceptance verdict is unchanged: **the Tomb
Racer 1.5x target is not met** (175.9–180.8 s this series against the
24.021-second ceiling).

## Boot CPU profile and module-once factory hoist (August 14, 2026, fifth series)

An in-process sampled CPU profile of a full boot (`--cpu-profile`,
217.0 s total, post-logo 176.6 s) finally decomposes the loading time.
Of all samples: generated guest code 28.2%, jit-runtime 25.5%, jvm-core
15.3%, idle 12.6%, GC 4.9%, interpreter opcodes 3.9%, wasm 1.3% — plus
4.7% inside acorn (the region compiler's source-rewrite passes re-parse
generated modules during boot). The largest single guest URL is the
`vma.b()[B` framed region at 7.1%. The dispatch chain
(`tryInvokeResolvedTarget` + `dispatcher` + `tryInvokeSyncAt` +
frame-run plumbing) sums to ~6% self; the synchronous interpreter tick
loop plus `execute` add ~10% self on top of the 3.9% opcode handlers.
Two structural conclusions: (1) there is no concentrated hotspot left —
the overhead is a diffuse 41% runtime tax; and (2) even zeroing that
entire tax leaves ~4x versus HotSpot, because the JS-tier generated
code itself (28%) plus interpretation (14%) is that much slower than
native. The only path to the 1.5x target is moving the loading-hot call
graph onto the wasm tier with the direct-link calling convention.

The measurable increment this series (java-tools, opt-in
`JVM_ENABLE_HOT_CALL_GRAPH_FACTORY_HOIST=1`): region module sources are
split by AST into factory-scope declarations (parameter-complete helper
functions and empty protocol state arrays) and a per-call entry tail, so
each module's helpers instantiate once instead of on every one of the
~3.7M region entries. 24 new structural assertions plus the 521 existing
region assertions pass with the flag on. Live paired A/B, same core,
back-to-back:

| configuration | post-logo menu time | hoisted |
|---|---|---|
| baseline | 171.1 s | 0 of 121 modules |
| factory hoist on | 166.8 s | 121 of 121 modules (594 declarations) |

The −4.2 s is within the host's pairing noise: the mechanism is proven
live but closure re-instantiation was a minor cost, exactly as the
profile predicted. The acceptance verdict is unchanged: **the Tomb Racer
1.5x target is not met** (166.8–171.1 s this series against the
24.021-second ceiling).

Suite-coverage correction (applies to every series above): the java-tools
test runner exits at the first failing test file by default, and
`fusedHotLoopRegression` fails pre-existingly, so any default `npm test`
run silently covered only ~62 of 196 files. The genuinely full run
(`JVM_TEST_CONTINUE_ON_FAILURE=1`) executes all 196 files / 8820 tests
and, with the retv/runv emission, direct-link flag off, and factory-hoist
flag off at their defaults, still shows exactly that one pre-existing
failure.

## Direct wasm→wasm instance linking and the loading-unpack reproducer (August 14, 2026, sixth series)

The fourth series linked static call sites; this one extends the raw
wasm-import calling convention to instance calls in both wasm tiers
(java-tools, opt-in `JVM_WASM_DIRECT_INSTANCE_LINK=1`). A call site with a
single ready fully-compiled target imports that target's `runv` directly;
`invokespecial` guards with an in-wasm null check, and
`invokevirtual`/`invokeinterface` guard with one JS import that tests the
receiver's runtime class against the classes known to dispatch to the
linked target, falling back to the generic dispatch import otherwise
(soundness unchanged). On the call-shape microbenchmarks the receiver
dispatch cost drops from 104x/110.7x (virtual/interface, dispatcher tier)
to 10.9x/10.8x, and from 21.0x/21.9x to 4.35x/4.24x on the structured
tier. The genuinely full suite (196 files, 8820 tests) passes with only
the known pre-existing failure, flag on and off.

Live paired A/B, same core, back-to-back, treatment arm with
`JVM_WASM_DIRECT_STATIC_LINK=1 JVM_WASM_DIRECT_INSTANCE_LINK=1`:

| configuration | post-logo menu time | wasm runs | region-tier runs |
|---|---|---|---|
| baseline | 193.8 s | 172,975 | 3,999,253 |
| static+instance links on | 176.3 s | 175,855 | 3,587,935 |

The −17.6 s is favorable but sits at the edge of this host's single-pair
noise, and the counters repeat the fourth-series diagnosis: loading runs
the wasm tier ~20x less often than the JS region tier, so wasm-boundary
fixes cannot carry the load until loading-hot code runs there.

To make that gap measurable without four-minute boots, a second
reproducer now isolates the LOADING slowdown the way
`benchmarkCallBoundaryHotLoop.js` isolated the wasm call boundary:
java-tools `benchmarks/LoadingUnpackHotLoop.java` +
`scripts/benchmarkLoadingUnpackHotLoop.js` model the loading-hot
buffer-unpack idiom (byte-array reads through tiny instance methods
advancing a position field, the `vma.b()[B` shape) and run it end-to-end
on HotSpot and three jvm.js configurations with checksums verified.
Pinned results (2M iterations, medians): on the production JS region
tier the realistic unpack blend is **37.9x** (ingredients: array ~10x,
field ~7x, one instance call ~11x, arith 1.3x — the blend is
superlinear). In the full game configuration the wasm tier claims these
methods and runs the same blend at **271.7x** — seven times worse than
the JS tier it displaced — because the root compiles partial
(`Buffer.<init>` is never wasm-compiled and nested instance calls make
`readUShort` partial and therefore link-ineligible), so every
per-element call bridges out. `JVM_WASM_HEAP=1` rescues only the
pure-array shape (38.8x → 11.9x). The wasm-routing refactor therefore
has four concrete prerequisites, each now iterable in seconds:
constructor calls in wasm, nested instance calls that do not force
callees partial, direct links that engage for late-ready callees, and
linear-heap array/field access. The acceptance verdict is unchanged:
**the Tomb Racer 1.5x target is not met** (176.3–193.8 s this series
against the 24.021-second ceiling).

## Guard elision for provably-`this` calls (August 15, 2026, seventh series)

Working the first two wasm-routing prerequisites from the sixth series
against the loading-unpack reproducer (java-tools, uncommitted): an
inlined zero-arg instance call directly following `aload_0` — in a
method that never stores slot 0, at an instruction that is not a branch
target — provably has `this` as receiver, so its inline guard and
guard-miss deopt stub are elided (the site still records its
speculation for revalidation). That makes `readUShort`-shape callees
fully compiled and therefore raw-linkable. The speculation machinery was
generalized to match: "speculative" now means "has specSites", captured
nested-dispatch targets are revalidated per call, and raw wasm→wasm
links to speculative callees are permitted only through the closed
receiver-class-set guard verified at link time (an intermediate version
that simply vetoed them everywhere sent the wasm-only unpack column to
18740x — fixed).

Reproducer effect (pinned, 2M iterations): hybrid unpack **271.7x →
147x**, with site counters proving the generic bridge is no longer
called at the linked sites. The remaining wasm-tier unpack cost is a
~24 ns/call floor (receiver-class guard JS import plus per-run
field-cache refill) and guest byte[] access that the linear heap does
not cover — so the wasm tier at 147x still loses to the JS region tier
at ~38x on this shape, and the routing refactor stays blocked on those.
Verification: all four wasm test files pass including three new
elision regression tests (one proves a later-loaded subclass overriding
an elided target still dispatches correctly); the genuinely full suite
is 196 files / 8838 tests with only the pre-existing failure; a live
Tomb Racer boot reaches the main menu (post-logo 196.1 s, unpaired,
expected neutral at ~20:1 JS-tier-bound loading). The acceptance
verdict is unchanged: **the Tomb Racer 1.5x target is not met**.
