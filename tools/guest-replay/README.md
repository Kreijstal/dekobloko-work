# Real guest workload replay

This diagnostic harness captures real GeoBlox method inputs and expected outputs,
then replays them without booting the game. It is not a replacement applet or a
full-frame benchmark. Source changes are made locally and deployed with rsync.

See [PHASE-COVERAGE.md](PHASE-COVERAGE.md) for measured remaining failures
and explicitly missing logo/tutorial/rendering reductions. `browser.cjs` also
exports `installAudioCapture(jvm, {owner, name, descriptor, phase, sampleRate})`
for a one-shot capture in a visually confirmed live phase. Capture timings are
invalid; replay is a separate measurement. `collect-live.mjs OUTPUT.json`
exports a completed `window.phaseCapture` through the local diagnostic browser
bridge. The capture is a state-isolated workload, not minimal Java source.

## Workloads and execution modes

### Continuous component streams

An artifact may set `invocations` to repeat its entry without restoring guest
state or performing verification between calls. The original single-call mode
is unchanged. A stream can also specify `stream: {arrayArgument: 1,
clearBeforeCall: true, expectedSamples: [...]}`: the diagnostic driver clears
the caller-owned accumulation buffer before each invocation and retains every
output sample. The first buffer clear is setup; subsequent buffer clears and
all output copying are included in execution time.
The host-yield deadline is not reset between blocks. Exact final state and
every PCM block must match; corruption in an early block fails the oracle even
when the final receiver state matches.

`streaming-fixture.cjs CLASSES OUTPUT.json` builds an unrelated Java workload
with 64 stereo blocks, voice changes, allocation, inheritance and synchronized
entry. Its complete PCM is checked against HotSpot, and its final state against
the interpreter, before checking the generated tiers. These are component
measurements, not device playback or full-game acceptance.

`stream-from-capture.cjs INPUT.json CLASSES OUTPUT.json [64]` creates a continuous
driver from captured music state. External controls/statics remain frozen;
this is not a recording of the full game's scheduling. Keep the original
single-block capture and oracle as a separate test.

`GUEST_REPLAY_EXTRA_TARGET='Owner.method(Descriptor)V'` adds a diagnostic
component entry to the capture preload and writes `component.json`.
`resume-equivalence.cjs COMPONENT.json CLASSES` checks its exact oracle with
the interpreter, ordinary JS scheduling, and deliberately forced repeated
quantum exits. It is correctness-only, not a performance benchmark.
`resume-matrix.cjs` is an ablation helper for the compiler's existing options;
its errors are reported per arm rather than treated as accepted results.

**Representation correction:** the older `heavy-dense` capture has plain
primitive arrays, whereas the live browser has heap-backed typed arrays.
Those captures test a valid representation but do not measure the browser's
actual array path. Capture with an explicit browser runtime manifest and
check input array kinds; enabling the heap during replay does not convert
plain captured arrays. Do not normalize away an oracle mismatch to convert
between representations.

- Audio: `kj.a([III)V`, captured with an active `kl` voice; 256 stereo frames at
  22050 Hz (11.61 ms of audio).
- Visual: `hi.a(IIIIILnf;II)V`, one mesh rasterization call. The recording must
  change non-black pixels; the captured buffer records its actual dimensions.
- Combined: both isolated jobs, plus their estimated single-thread CPU demand
  at the audio cadence and 24 visual jobs/sec. This is **not** a live concurrent
  scheduler, an audio-underrun measurement, or measured game FPS.

Backends are interpreter, generated JavaScript (with interpreter fallback), and
Wasm (with interpreter fallback, generated JavaScript disabled). The programmatic
API and CLI also accept `hybrid`, which prepares both compiled backends and uses
normal runtime tier selection. `wasmRuns`
distinguishes actual Wasm execution from fallback. Compilation/preparation is
outside execution timing; missing prepared bodies stay interpreted. The first
replay is retained, so browser-engine cold-code costs are visible.

The default `schedulerMode: "production"` uses the same synchronous JIT and
interpreter bursts as `JVM.execute()`, and renews the host deadline after actual
host yields. `hostYieldMs` is included in `executionMs`, not subtracted from the
deadline test. `schedulerMode: "single-step"` is available only for diagnostics.
Earlier timings using an expired preparation-time deadline and single-step
`executeTick()` do **not** measure production throughput; their output/state
checks remain useful, but rerun their timing comparisons with this version.

Each trial rebuilds the captured data graph and compares the resulting argument
graph and selected raster outputs exactly against the recording. Reset and
verification times are reported separately, not charged to the guest execution
budget. Those diagnostic operations are expensive and make this unsuitable for
direct live playback. Repeated trials restore identical inputs, not successive
game states. Passing a tiny warmed workload cannot prove full-game 24 FPS.

The audio button requires a user click and loops the captured block: it checks
sample playback, not music continuity or runtime audio scheduling.

## Running

Keep `java-tools` and `dekobloko-work` as sibling directories, with java-tools
dependencies installed. Use Node 22 and a JDK for the small equivalence test.
Commands below run from `dekobloko-work`:

```sh
node tools/guest-replay/test.cjs
node tools/guest-replay/run.cjs CAPTURES/audio.json CLASSES javascript 3
node tools/guest-replay/run.cjs CAPTURES/visual.json CLASSES wasm 3
node tools/guest-replay/run.cjs CAPTURES/audio.json CLASSES interpreter 3
node tools/guest-replay/run.cjs CAPTURES/audio.json CLASSES hybrid 3
node tools/guest-replay/build.cjs BUNDLE_DIR
node tools/guest-replay/server.cjs CLASSES CAPTURES BUNDLE_DIR 18092
```

The server binds to 127.0.0.1 and serves only allowlisted diagnostic inputs.
For a NUC-hosted server, forward port 18092 over SSH and open
`http://localhost:18092/` in **local Firefox**, keeping the tab visible. The UI
caches prepared runtimes until reload. All three modes default to the shared launcher
runtime options. Both CLI and server accept a final optional `RUNTIME.json`
argument to pin the tested configuration. Browser results include a class-set SHA-256; CLI results include
the fixture SHA-256. Preserve these alongside measurements and runtime revisions.

Current session inputs on the NUC:

```text
classes:  /tmp/deko-900-classes
audio:    /tmp/deko-guest-replay-captures-v2/audio.json
visual:   /tmp/deko-guest-replay-captures-v5/visual.json
served:   /tmp/deko-guest-replay-accepted (audio v2 + visual v5)
bundle:   /tmp/deko-replay-bundle
```

Captures are also saved locally under
`/home/kreijstal/work/deko-firefox/replay-captures`. They are generated diagnostic
artifacts, not committed game assets. The v1/v2 visual captures are invalid for
rendering comparisons: they captured geometry preparation, not rasterization.

## Recording and boundaries

`capture.cjs` is an opt-in Node preload for the normal JVMJS game launcher. Set
`GUEST_REPLAY_CAPTURE_DIR` to a new output directory and add the absolute path to
`capture.cjs` through `NODE_OPTIONS=--require=...` for that launch only. It saves
`audio.json` and `visual.json` on normal completion of their captured roots.
Recording instruments call entry/exit and must never be used for performance
measurements. Do not install the preload in production.

`GUEST_REPLAY_AUDIO_SKIP_BLOCKS=1024` selects a later active-voice block instead
of the first one; the selected ordinal is recorded in provenance. This does not
run extra guest code or change the requested mixer block size. Match capture
layout to the browser with `JVM_DENSE_INSTANCE_FIELDS=1`: legacy plain instance
templates include auxiliary static-named fields that newly allocated dense
objects do not have, causing exact graph comparisons to fail. Do not ignore
those mismatches or accept timing from a failed oracle.

The later fixture is `/tmp/deko-heavy-dense-replay/audio.json` on the NUC,
SHA-256 `86434fdaacf36cb2251279b6ff7f5b188f912c6b4288ba69e107db4dd6422344`.
It contains nine `kl` objects at entry and note/voice changes during the call.
It is a busy 256-frame passage, not a continuous-song throughput measurement.

For the current NUC inputs (Node 22 must be on PATH):

```sh
ALTERORB_JVMJS_HTTP_PROXY_PORT=18093 \
GUEST_REPLAY_CAPTURE_DIR=/tmp/deko-guest-replay-captures-v5 \
NODE_OPTIONS=--require=/home/kreijstal/git/dekobloko-work/tools/guest-replay/capture.cjs \
node scripts/launch-alterorb-games-jvmjs.js --game geoblox \
  --classes-dir /tmp/deko-900-classes --local-cache /tmp/deko-900-cache \
  --until-main-menu --timeout-ms 240000 \
  --report /tmp/deko-replay-capture-report-v5.json
```

Snapshots preserve supported guest fields, cycles, aliases, primitive arrays,
primitive-valued static data, and the rasterizer's `l.field_i` guest texture
descriptor table. Other nonprimitive static references are explicitly
listed in `omittedStatics`; this is not a complete JVM checkpoint. Object locks,
identity hashes, and native host resources are not preserved. Unsupported host
objects/functions and distinct overlapping typed-array views are rejected.
Recreated guest objects use the destination JVM's object/array layout.

Replay rejects blocking and guest exceptions, with bounded execution. Most
native registry entries are replaced with errors; arithmetic, bit conversion,
class lookup and array copy remain available. This guard is not a security
sandbox, and built-in intrinsics can bypass that registry. Only trusted local
captures should be loaded.

Next diagnostic expansion: capture multiple voice/mesh states and a complete
visual frame, then compare optimizations against unchanged fixtures before
re-testing the real game's foreground frame and audio deadlines.
