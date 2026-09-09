# Actual-method differential runner

This benchmarks ordinary calls to the running game's actual classfiles. It is
not yet a reproducer of the Solar → Candy freeze. No runtime changes are made.

First operation: `hf.a(Z[B)V → sc.a(B)Ldm;`, the sprite parse and palette-expand
portion of `Geoblox.p(7) → ug.a → qc.a → mf.a → hf.a → sc.a` for
`sweets/sweets_foreground`. Archive 1, group 7, file 1 is extracted from the
launcher's JS5 data. Source linkage is established; execution during the visible
transition and its time contribution have **not** been established. Loading can
also happen in background update work before the transition.

The old repository `dekobloko.jar` is a different obfuscation/build and must not
be substituted. `capture.mjs` exports class bytes from the current diagnostic
game session and pauses that session. It does not mutate Java state. Use only
with a dedicated diagnostic browser, not a user's playing session.

## Commands

From `/home/kreijstal/work/deko-transition`, with the diagnostic browser bridge
on port 9226 and game selected:

```sh
node dekobloko-work/tools/differential-methods/capture.mjs differential/classes
rsync -az kreijstal@kreijstalnuc:/home/kreijstal/git/blank-github-cloner/public/jvm-assets/geoblox-js5/ differential/js5/
python dekobloko-work/tools/differential-methods/extract-candy.py differential/js5 differential/input
node dekobloko-work/tools/differential-methods/oracle.mjs differential/input
node dekobloko-work/tools/differential-methods/build.mjs dekobloko-work/tools/differential-methods/candy.json differential/classes differential/input differential/candy
node dekobloko-work/tools/differential-methods/hotspot.mjs differential/candy 3
node dekobloko-work/tools/differential-methods/server.mjs differential/candy bundle runtime.json 18212
```

Then open `http://localhost:18212/` in stock Firefox. Results are automatically
saved to `differential/candy/firefox-*.json`. Reload only after completion for
another fresh-runtime fork. Run HotSpot and Firefox sequentially; pause other
agent-controlled guest workloads and do not build/search/benchmark on the
target during timed execution. Leave unrelated user applications untouched.

With the existing diagnostic Marionette bridge, `node
dekobloko-work/tools/differential-methods/firefox.mjs http://localhost:18212/`
automates this bounded run. `--attach` observes an already-started run instead
of reloading it. Preparation can finish while hidden, but the harness waits
for visibility before any guest instruction; the automation restores only its
selected isolated benchmark window. Do not close/minimize it during timing.

```sh
node dekobloko-work/tools/differential-methods/report.mjs differential/candy
```

The report rejects missing/incomplete runs, differing JAR identities, and output
checksums that disagree with the independent JS pixel decoder. It orders by
absolute cold excess milliseconds; warmed excess and ratios are separate.
Output validation traverses every output pixel but currently compares a 32-bit
checksum, not collision-free byte equality. `pixels.bin` and its SHA-256 retain
the independent exact pixel oracle for stronger validation.

## Contract and limitations

- Identical complete JAR, including Java driver and real asset, in both engines.
- `javap -p -s` records classfile discovery; `driver-bytecode.txt` records direct
  calls. Reflection is not included in timings. No access flags are rewritten.
- First invocation is measured before any target warmup. It includes lazy guest
  class initialization. Fixture decoding occurs before the timer. The generated
  `FixtureInput` embeds the unchanged asset as hexadecimal literals because the
  accepted browser runtime does not implement `Class.getResourceAsStream`.
- Twelve explicit warmup calls precede eight recorded calls. These are labeled
  post-warmup, **not proof of steady-state peak performance**. Report all samples.
- Reset and full output traversal are outside each operation timer. Allocation
  and collection inside the operation remain measured. No forced GC.
- Pre-main browser compilation/preparation is outside the operation timer and
  reported separately. The game manifest's JVM options are unchanged; its
  game-specific before-start hook is not used by the independent main driver.
- No frame-rate, presentation, audio deadline, or device-underrun claim follows
  from a method microbenchmark. Audio is not tested by this first workload.
- Three fresh forks per engine are required before calling a discrepancy
  repeatable; one Firefox run is preliminary even with many within-run samples.
- Add workloads via JSON with fixture setup, reset, ordinary call body, oracle,
  and method descriptors. Use demonstrated real inputs. Recurring rendering and
  guest mixer/decoder production are subsequent workloads, not generic loops
  pretending to represent those operations.

Measurement environment, which comparable runs must hold fixed:

- All logical CPUs pinned to a fixed frequency (the recorded runs used 900000
  kHz, powersave). An unpinned machine makes cold/warm deltas meaningless.
- Timed runs sequential, with the diagnostic game paused and the browser
  visible during guest execution; a hidden tab throttles and invalidates a run.
- Record the engine versions and the bundle/manifest SHA-256 with the results;
  the bundle hash, not the source revision, identifies the runtime under test.
- Capture the game classes from the working browser compilation, not from the
  differently obfuscated `dekobloko.jar` in this repository.

No game/compiler optimization or deployment is included in this runner.

## Additional actual-method workloads

`candy-render.json` calls the same six-integer transform entry used by
`gh` to draw `ec.field_c` into `jf.field_a`. It uses the real 461×461 Candy
sprite, unity scale and zero rotation, with a cleared same-sized target.
This is a recurring renderer component, not a complete game frame or an
assertion that zero rotation covers every expensive angle. Its exact output
is the same independently decoded pixel image. Build with the Candy input.

`audio-voice.json` calls `kl.a(int[],0,256)` for one stereo voice. Run
`extract-audio.py differential/js5 differential/audio-input` first; build
with that input directory. Setup runs the actual Vorbis decoder on archive 3,
group 0, files 0/1; reflection only constructs its private decoder outside
timing. Reset constructs a fresh voice at rate 256, volume 64, pan 8192.
Each operation produces 256 frames, and verification rejects silence.
The frozen output checksum is 62529537, established with HotSpot `-Xint`.
This measures sample production only: no polyphony, device writes, queueing,
or underrun test. Decoder setup is not an audio-transition timing result.

`method-state.mjs OUT` stores post-run tier metadata without enabling a
profiler; cached/generated bodies are not by themselves proof of execution.
`check-final-pixels.mjs OUT differential/input/pixels.bin` compares the decode
driver's final pixels byte-for-byte after all timing has finished.

The browser clock in this pinned runtime is approximately millisecond-quantized.
The report withholds warmed ratios below 10 ms and flags them as clock-limited.
Do not interpret a zero-duration audio block as free work.

Current local embedded-fixture results live in `differential/candy-embedded`.
`differential/candy` retains the unsuccessful resource-loader experiment; do not
mix its results/JAR with the embedded-fixture run. To reproduce the current run,
use `differential/candy-embedded` as the output directory in the commands above.
`JAVAC` may override the Java 8 compiler executable; the HotSpot runner's third
argument overrides its Java executable.
