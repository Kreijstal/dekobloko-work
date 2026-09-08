# Node and jvm.js runtime harnesses

Headless jvm.js runs, save states, and the Node-side benchmarks. Moved out
of README.md unchanged; see docs/repository-map.md for who owns what.

Source: previously README.md lines 115-298; the text below is
unchanged apart from this header.

### JVM.js save states

The headless runner can checkpoint the complete portable Java state after a
wall-clock delay and resume it in a fresh process. This is useful for skipping
the cache load and Jagex animation during repeated runtime experiments:

```bash
node scripts/run-jvmjs.js .work/games/dekobloko/classes \
  --save-state .work/games/dekobloko/login.state.json \
  --save-after-ms 58000 --exit-after-save

node scripts/run-jvmjs.js .work/games/dekobloko/classes \
  --load-state .work/games/dekobloko/login.state.json
```

The state stores Java heap/thread/frame/static data, not generated JIT machine
code. Cache files reopen on load; sockets, audio outputs, and canvas handles are
host resources and are omitted from the portable payload.

### Reproducible Node Jagex-logo FPS

Use the phase-aware benchmark instead of calculating FPS across fixed frame
numbers:

```bash
node scripts/benchmark-dekobloko-node-logo.js \
  --classes .work/jvmjs/hybrid-all-recompiled-lean-carriers/classes \
  --generated-from-jar dekobloko.jar \
  --minimum-warm-fps 45
```

The benchmark samples every tenth published surface and separates the sparse
Jagex-logo animation from the much denser login panel. It reports cold and
warm logo FPS independently and writes `result.json`, logs, surfaces, and any
dirty tracked patches to a temporary artifact directory.

Every result records the complete `java-tools` and `dekobloko-work` commit
SHA-1 and Git tree SHA-1, tracked/overall dirty state, dirty-patch hashes and
files, untracked paths, the declared generating JAR's SHA-1/SHA-256, a
deterministic generated-class-tree SHA-256, Node/platform identity, exact
command, every `JVM_*` variable, and the resolved JIT/Wasm/fusion/scheduler
gates. A result without this provenance is not an authoritative FPS result.

The 2026-07-27 accepted Node series measured 49.8804, 49.9991, and
49.9991 warm logo FPS (**49.9991 median**), with zero runtime errors and the
first login-classified surface at frame 240 in every process. The structural
SSA renderer preserves scalar continuations across scheduler-visible void
children, and the fused compiler now renders verified CFGs as lexical
JavaScript loops/branches with fixed operand join slots rather than scalar
`pc`/`switch` dispatch. Every run compiled six lexical fused kernels and
executed 604,127 direct fusions.

The accepted run installed and executed zero fingerprint-selected handwritten
kernels. Those kernels are now opt-in test oracles; the normal runtime uses
bytecode-derived positional/scalar kernels. The differential harness compares
both generated renderer families against canonical execution and the
handwritten target while also rejecting generated source that contains child
frames, operand-stack access, generic call dispatch, or a raster `pc` switch.
Selection remains class- and method-name independent; names are retained only
in diagnostic output. Set `JVM_DISABLE_LEXICAL_FUSED_KERNELS=1` for the
state-machine A/B control.

### Extracted real-scene animation loop

The end-to-end logo benchmark still includes startup, asset work, animation
timing, and presentation. The focused diagnostic restores a captured entry to
the original guest logo renderer and repeatedly feeds it changing animation
progress:

```text
http://localhost:8775/animation-diagnostics/
```

This is deliberately not the earlier fixed-scene replay or the later
eight-phase throughput probe. The harness finds the dominant integer static
input from the captured method's bytecode shape (eight reads versus one each
for the next candidates), then reads a checked-in timeline tied to the source
game JAR. The audited guest lifecycle initializes the value to zero, advances
it before rendering, draws every value from 1 through 250, and replaces the
logo after the next update reaches 251. The scheduler period is 20 ms, so one
complete visible timeline is 250 states over 5 seconds.

Before every state, the harness executes the original guest framebuffer-clear
method and then the captured logo renderer. The clear is selected by its
descriptor, lack of exception handlers, repeated reads of the recovered raster
field, and repeated zero-valued array stores—not by its obfuscated name. This
matches the original outer render path and prevents pixels from earlier states
accumulating as false animation artifacts. A run fails if per-loop
surface-sequence hashes differ. It executes the original guest methods, nested
geometry and raster calls, live object graph, initialized statics, exception
tables, and scheduler semantics. No optimizer decision contains the guest
class, method, or field names; names used to audit the timeline exist only in
diagnostic metadata and documentation.

Every frame gets an FNV hash over exactly 307,200 visible pixels (not the
raster array's extra sentinel element). A run fails unless it produces at
least two distinct surfaces, changes at least half its consecutive frame
transitions, and repeats the same temporal hash on every loop. Results include
unique and changed-frame counts, guest/render/upload time, original 20 ms plus
60 and 30 FPS deadline misses, scheduler ticks, JIT counters, remote telemetry,
and exact source provenance.

Generate or refresh the input capture with:

```bash
DEKOBLOKO_URL=http://127.0.0.1:3780/ \
PROBE_WAIT_MS=18000 \
PROBE_CHANGED_FRAMES=10 \
PROBE_TRACE_METHOD='qc.a(III)V' \
PROBE_TRACE_AFTER_CHANGED_FRAMES=2 \
PROBE_TRACE_OUTPUT="$PWD/.work/animation-diagnostics/logo-animation-trace.json" \
npm --prefix ../java-tools run profile:dekobloko:firefox
```

The delayed trace gate matters: it captures the renderer only after visible
animation has begun, instead of capturing an earlier asset-preparation call.
Trace mode temporarily requests canonical child Frames so a positional
frameless call can be captured without changing the normal optimized path.
The JIT also has a regression test proving that an unset trace target cannot
accidentally capture a `null` method identity.

The diagnostics server reads that state plus
`.work/games/dekobloko/hybrid-all-recompiled-lean-carriers.jar`. Override them
with `DEKOBLOKO_SCENE_TRACE` and `DEKOBLOKO_SCENE_CLASSES_JAR`. It serves the
48.0 MB JSON capture as a 782 KB gzip response and records the trace, class
JAR, generating game JAR, JVM bundle, repository, dirty-tree, and environment
identities.

The fast Node measurement is:

```bash
DEKOBLOKO_ANIMATION_LOOPS=2 \
DEKOBLOKO_ANIMATION_WARMUPS=8 \
node scripts/benchmark-dekobloko-animation.js
```

On 2026-07-28, Node 26.4 rendered two complete timelines, including the guest
clear, at **143.02 states/s**, with a 6.739 ms median guest state. Three clean
headless Firefox 146.0.1 paced runs measured 34.38, 31.45, and 34.56 states/s
(**34.38 median**). Their median guest times were 20, 25, and 21 ms and their
guest-plus-upload medians were 23, 29, and 24 ms. Each run produced 225 unique
surfaces and 449/499 changed transitions, with no page or JVM errors.

Both Node and Firefox produced per-loop hash `1711060353`, whole two-loop
sequence hash `4093121037`, first hash `2929241493`, and last hash
`3053477317`. This is the current correctness anchor. The earlier 104–143 Node
and 41–49 Firefox results advanced `0,25,…,175`; they were useful renderer
throughput probes, but they did not reproduce the original animation timeline
and are superseded as logo-playback measurements.

The former fused-region and bytecode-fingerprint renderer experiments were
removed on August 31, 2026. They substituted complete workload-shaped
algorithms and made measurements depend on a second implementation rather than
the JVM's execution of the compiled classes. Current runtime optimization is
limited to generic bytecode, SSA, call-graph, and Wasm machinery. AWT frames are
published through `ImageProducer`/`ImageConsumer` completion callbacks.

The recorded inputs were trace SHA-256
`5b49fe4d0739167c0db566a8753661610fe357f82fe2e4398b5049582daa0a79`,
classes JAR SHA-256
`b7e6941c374dce4eeb9230690b618935dadda78372977b1888d8f447f167bb16`,
game JAR SHA-256
`a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e`,
and browser JVM bundle SHA-256
`537299a0ff80342f0133e537bf4c082a8ea61b3e66074f066234a4eb892f7dee`.
The audited timeline SHA-256 was
`93d87afcc1fd552a9247c8d84298a053a94cc3e89e8fcc896733fe75f0183490`.
Both repositories were tracked-dirty, so the emitted manifests also retain
their commits, trees, and tracked-patch hashes.

### JVM.js Firefox renderer performance

Measured frame rates, the post-logo startup acceptance table, retained changes,
the rejected-experiment list, and the harness recipes are kept in a local,
untracked `docs/performance.md`. Those numbers are machine-specific and are
not carried in this repository; reproduce the browser figures with
[`scripts/measure-geoblox-fps.js`](../scripts/measure-geoblox-fps.js).

Obfuscated method identities such as `vk.a(I)V` are permitted only as runtime
profiler roots and trace selectors. Reusable JIT optimizations in `java-tools`
must continue to select code by descriptors, verified CFG/stack structure,
opcodes, and runtime target shape; they must not hardcode Dekobloko method
names.
