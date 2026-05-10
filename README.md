# Dekobloko Harness

Small Java 8 launcher and boundary-test harness for the AlterOrb/FunOrb
`dekobloko.jar` gamepack.

The repository intentionally tracks source and retrieval scripts only. Downloaded
gamepacks, decompiler jars, class files, traces, and generated decompiler output
are ignored.

## Repository Layout

Source and tooling are grouped by job:

```text
launcher-src/             local fake/real AWT launcher
scripts/                  regression, compile, deobfuscation, and stub scripts
scripts/pipeline/         Dekobloko/FunOrb deobfuscation pipeline and profiles
stubs-src/                legacy JDK/browser dependency stubs
tools/js5/                JS5 cache download and cache-warming helpers
tools/music/              music cache extraction, JSON export, and Java renderer
web/music-visualizer/     standalone browser visualizer and JS mixer port
.work/                    generated caches, extracted data, compiled helpers, WAVs
```

Anything under `.work/` is disposable generated state. If a helper performs real
work and should survive a cleanup, it belongs under `tools/`, `scripts/`, or
`web/`, not `.work/`.

## Requirements

- JDK 8 or newer
- Bash
- Node.js for `assert-trace.js`
- `curl` for fetching the gamepack

## Fetch the Gamepack

```bash
./scripts/fetch-gamepack.sh
```

By default this downloads `dekobloko.jar` from AlterOrb and verifies:

```text
a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

Override inputs when needed:

```bash
DEKOBLOKO_GAMEPACK_URL=https://example.invalid/dekobloko.jar \
DEKOBLOKO_SHA256=<sha256> \
./scripts/fetch-gamepack.sh path/to/dekobloko.jar
```

## JS5 Cache and Music

Dekobloko and the other AlterOrb gamepacks use the FunOrb/Jagex JS5 cache
protocol. The applet parameters used by the local launcher are enough to talk
to the same cache server without running the gamepack:

```text
host=mgg-server.alterorb.net
port=43594
servernum=8003
lang=0
gamecrc=2147312574 / 0x7ffd63be
build=per gamepack
```

The important footgun is the JS5 build. It is not a global launcher value. It
comes from the gamepack init path and differs by game. For example, the current
AlterOrb gamepacks validate with:

```text
aceofskies        13
brickabrac        65
chess             15
dekobloko         32
tetralink         17
torchallenge      12
voidhunters       26
```

The validated build table for all 44 mirrored gamepacks was generated under:

```text
tools/js5/js5-builds-validated.json
```

Do not reuse one build for every game. A single build can pass the protocol
handshake but point at a different master/index layout. That is why the first
all-game JS5 downloader attempt produced plausible-looking cache directories
with repeated `idx255` sizes while not matching the gamepack-specific cache
metadata.

For one game, pass the build explicitly:

```bash
python3 tools/js5/download-caches.py \
  --game dekobloko \
  --build 32 \
  --output .work/js5-caches
```

For bulk mirroring, use a per-game build map:

```bash
# Only fetch master/index metadata.
python3 tools/js5/download-caches.py \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/js5-caches-metadata \
  --metadata-only

# Fetch archive payloads too.
python3 tools/js5/download-caches.py \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/js5-caches
```

### JS5 Request Shape

After the setup packet and one-byte `0x00` server ack, the client sends cache
mode/control packets and then archive requests. A request is six bytes:

```text
priority archive-id group-id
```

For example:

```text
01 ff 00 00 00 ff  -> priority request, archive 255, group 255 (master index)
01 ff 00 00 00 0a  -> priority request, archive 255, group 10  (archive index)
01 0a 00 00 00 00  -> priority request, archive 10,  group 0   (music bank)
```

Responses are JS5 containers. Archive `255` contains index metadata. The normal
game archives are stored in the local cache as `main_file_cache.idxN` plus
`main_file_cache.dat2` sectors. The downloader writes that same sector format so
the extraction tools can read either a warmed AlterOrb cache or a freshly
downloaded JS5 cache.

### Music Archive Layout

The game does **not** store complete songs as standalone Ogg/Vorbis files. It
stores small sample banks and custom song descriptors, then mixes the final PCM
at runtime:

```text
archive 8,  group 0 -> synth sample bank, 38 split files
archive 9,  group 0 -> packvorbis sample bank, 56 split files
                         file 0 is shared Vorbis headers
                         files 1..55 are compressed sample payloads
archive 10, group 0 -> ui music descriptors, 39 split files
```

Current source-data sizes are small:

```text
156K  split/archive08_group000
520K  split/archive09_group000
1.1M  split/archive10_group000
1.9M  raw JS5 containers/payloads
```

Rendered full-track WAVs are much larger because they are uncompressed PCM:

```text
169M  wav/archive10_tracks
```

So the right artifact to keep is the original JS5/music-format data, not
rendered WAVs. The full songs can be regenerated on demand.

### Track Names

Do not name archive 10 files by split position. The split order is sparse JS5
file-id order, not the order in `client.java` where the tracks are loaded. The
correct mapping comes from build-31 archive-10 metadata: file name hashes map
client strings like `music/Deko Bloko Titlescreen` to sparse file IDs.

Examples:

```text
music/Ant_and_Deko_remix_NORMAL  -> file_id=2,  split index=0
music/Deko Bloko Titlescreen     -> file_id=10, split index=6
music/Swab the Deks!_remix_FINISH_THEM -> file_id=62, split index=38
```

The extractor has the build-31 mapping baked in and refuses to apply it unless
archive 10 splits into the expected 39 files:

```bash
python3 tools/music/extract-dekobloko-music.py \
  ~/.alterorb/caches/dekobloko \
  .work/music/dekobloko
```

Generated files:

```text
.work/music/dekobloko/manifest.json
.work/music/dekobloko/raw/
.work/music/dekobloko/split/archive08_group000/
.work/music/dekobloko/split/archive09_group000/
.work/music/dekobloko/split/archive10_group000/
```

### Rendering and Visualization

The runtime music path is:

```text
ui descriptor
  -> hydrate samples from archive 8/9
  -> ia pattern/effect sequencer
  -> mi mixer/scheduler
  -> ei sample voice/resampler/loop/envelope
  -> PCM
```

The Java renderer uses the original classes for correctness:

```bash
javac -cp classes-original -d .work/music-tools \
  tools/music/MusicSampleDecoder.java \
  tools/music/MusicUiJsonDumper.java \
  tools/music/MusicTrackRenderer.java \
  tools/music/MusicSampleBankExporter.java

java -cp .work/music-tools:classes-original MusicUiJsonDumper .work/music/dekobloko
java -cp .work/music-tools:classes-original MusicTrackRenderer .work/music/dekobloko
java -cp .work/music-tools:classes-original MusicSampleBankExporter .work/music/dekobloko
```

`MusicTrackRenderer` decodes archive 8/9 samples with the original `bi` and
`va` classes, hydrates each `ui`, and renders through the original
`ia -> mi -> ei` chain at 22050 Hz mono.

Brickabrac follows the same split: Python prepares the cache data, Java uses the
original game classes for music conversion/rendering.

```bash
python3 tools/js5/download-caches.py \
  --game brickabrac \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/js5-caches

python3 tools/music/extract-dekobloko-music.py \
  .work/js5-caches/brickabrac \
  .work/music/brickabrac \
  --game brickabrac

javac -cp .work/gamepack-classes/brickabrac -d .work/brickabrac-music-tools \
  tools/music/BrickabracMusicDumper.java \
  tools/music/BrickabracNativeMusicRenderer.java

java -cp .work/brickabrac-music-tools:.work/gamepack-classes/brickabrac \
  BrickabracMusicDumper .work/music/brickabrac

java -cp .work/brickabrac-music-tools:.work/gamepack-classes/brickabrac \
  BrickabracNativeMusicRenderer .work/music/brickabrac .work/js5-caches/brickabrac
```

The Python extractor writes archive 7/8/9/10/13 raw groups and splits archive 10
into 16 named `vm` tracks. `BrickabracMusicDumper` emits repaired MIDI files from those
tracks. `BrickabracNativeMusicRenderer` hydrates archive 9 `pq` patches with
archive 7 `dr` samples plus archive 8 `bk` Vorbis samples, then renders through
the original `ie` mixer at 22050 Hz mono. Brickabrac build `65` stores the
archive 8 Vorbis samples as sparse files inside group `0`, so the renderer reads
the JS5 index metadata and feeds the original classes the same packed-group
layout the client sees.

TetraLink uses a different music path. Archive 7/8 are sample banks, archive 9
is instrument patches, and archive 10 contains `ri` song descriptors that the
client converts to MIDI-like bytes before playing through `g -> go/ng/fa`. The
direct preprocessing step is:

```bash
javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
  tools/music/TetraLinkMusicPreprocessor.java

java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkMusicPreprocessor .work/music/tetralink-build17
```

This writes archive 7/8 sample WAVs under `.work/music/tetralink-build17/wav`,
archive 10 MIDI files under `.work/music/tetralink-build17/midi`, and native
song WAVs under `.work/music/tetralink-build17/wav/archive10_tracks`. The native
WAVs do not use an external `.sf2`; the preprocessor hydrates `ng` patches from
archive 9 with `wf` samples decoded from archives 7/8, then renders through the
original `g` sequencer/mixer at 22050 Hz mono.

For DAW import, export the same FunOrb sample/patch bank to SFZ:

```bash
javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
  tools/music/TetraLinkSfzExporter.java

java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkSfzExporter .work/music/tetralink-build17
```

This writes `.work/music/tetralink-build17/sfz/patches/*.sfz` plus decoded WAV
samples under `.work/music/tetralink-build17/sfz/samples`. The SFZ export is an
interchange format: it preserves sample choice, key mapping, loop points, pitch
offset, per-note volume, pan, and exclusive-class hints, but the native renderer
remains the reference for exact playback.

For a compact single-file bank, export SoundFont 2:

```bash
javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
  tools/music/TetraLinkSf2Exporter.java

java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkSf2Exporter .work/music/tetralink-build17
```

This writes `.work/music/tetralink-build17/sf2/funorb_tetralink.sf2`. It is a
single SF2 bank with one preset per archive 9 patch, including the percussion
patch as bank 128 program 0 so standard MIDI renderers can resolve channel 10.

There is also a first LV2 instrument wrapper around that generated SF2:

```bash
tools/lv2/build-funorb-fluidsynth-lv2.sh

LV2_PATH="$PWD/.work/lv2" lv2ls | grep funorb
LV2_PATH="$PWD/.work/lv2" lv2bench https://funorb.local/lv2/funorb-fluidsynth
```

The bundle is written to `.work/lv2/funorb-fluidsynth.lv2`. This is useful for
testing DAW/plugin-host plumbing, but it still renders through FluidSynth and the
generated SF2 bank. Exact playback still requires a future LV2 plugin that ports
the native FunOrb `g/ng/wf` renderer instead of using SF2.

The native LV2 port uses a generated `.fobank` file instead of SF2:

```bash
javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
  tools/music/TetraLinkNativeBankExporter.java

java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkNativeBankExporter .work/music/tetralink-build17

tools/lv2/build-funorb-native-lv2.sh

LV2_PATH="$PWD/.work/lv2" lv2ls | grep funorb-native
LV2_PATH="$PWD/.work/lv2" lv2bench https://funorb.local/lv2/funorb-native
```

The bundle is written to `.work/lv2/funorb-native.lv2`. It loads
`.work/music/tetralink-build17/native/funorb_tetralink.fobank`, receives MIDI,
and mixes the decoded FunOrb samples directly in the LV2 `.so`. The current
native port includes interpolated sample playback, loop direction, channel
volume/expression/pan, sustain, pitch bend, percussion exclusivity, and note
release ramps. The `.fobank` format is versioned; version 2 carries each
region's `lm` envelope/modulation record so the LV2 side can follow the original
amplitude, release, decay, and vibrato progression. The audio hot loop now uses
the same Q8 sample-position/interpolation shape as `ee`, updates envelopes on
the original 10 ms control cadence, ramps gain across each control block, and
implements the CC81 stream-restart path used by `wn`. The remaining work is
empirical: compare native LV2/offline renders against the Java reference and
close any residual mixer constants or controller edge cases that show up there.

To test editable-MIDI playback through the actual FunOrb mixer, render the
generated MIDI files back through `g` directly:

```bash
javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
  tools/music/TetraLinkFunOrbMidiRenderer.java

java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkFunOrbMidiRenderer .work/music/tetralink-build17
```

This writes `.work/music/tetralink-build17/wav/funorb-midi-rendered/*.wav`. It
does not use SF2, SFZ, or FluidSynth: it hydrates archive 9 `ng` patches with
archive 7/8 `wf` samples, feeds MIDI events into the original `g` event handler,
and renders through the original mixer.

There is also a browser visualizer:

```bash
python3 -m http.server 8765
```

Open:

```text
http://127.0.0.1:8765/web/music-visualizer/index.html
```

The page imports D3 from `esm.sh` instead of bundling it locally. It loads
`json/sample-bank.json`, renders the selected track through browser-side
`Ia`, `Mi`, and `Ei` classes in `web/music-visualizer/audio.js`, and plays the
result through WebAudio while animating the decoded `ui` pattern events. This
JS port uses decoded `ud` sample PCM exported by `MusicSampleBankExporter`; it
does not yet port the custom `bi`/`va` sample decoders to the browser.

When tightening mixer parity, port from the **current deobfuscated** `ia/mi/ei`,
not from the stale raw CFR source. Running the current pipeline on the mixer
slice:

```bash
mkdir -p .work/mixer-pipeline/in .work/mixer-pipeline/out .work/mixer-pipeline/tmp
cp classes-original/{ei,ia,mi,ui,ud,va,bi,en}.class .work/mixer-pipeline/in/

TMPDIR=$PWD/.work/mixer-pipeline/tmp \
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/mixer-pipeline/in \
  .work/mixer-pipeline/out

java -jar lib/cfr.jar \
  --outputdir .work/mixer-pipeline/cfr \
  .work/mixer-pipeline/out/ei.class \
  .work/mixer-pipeline/out/ia.class \
  .work/mixer-pipeline/out/mi.class
```

With the current transforms, `ei.b(int[], int, int)` decompiles cleanly. The
raw `src/ei.java` copy predates those transforms and still contains a CFR
failure stub, so do not use it as the basis for a JS mixer port.

## Build

```bash
./build-launcher.sh
```

This builds `dekobloko-launcher.jar` from `launcher-src/`.

To build dependency stubs for decompilation/compiler linking:

```bash
./scripts/build-stubs.sh
```

This writes `lib/dekobloko-stubs.jar`.

## Run Modes

Automated fake-AWT boundary check:

```bash
./run-fake-awt-check.sh
```

This uses `local.awt.FakeToolkit` and `local.awt.FakeGraphicsEnvironment` as an
AWT MITM. It does not use Xvfb and does not compare pixels. It asserts stable
boundary events such as applet parameters, cache redirects, fake display
discovery, frame peer creation/layout, and lifecycle calls.

Human-in-loop real AWT window:

```bash
./run-real-awt.sh
```

This requires `DISPLAY` or `WAYLAND_DISPLAY`.

Record real AWT interaction:

```bash
./run-record-awt.sh traces/interaction.awtlog
```

Replay interaction through fake AWT:

```bash
./run-replay-awt.sh traces/interaction.awtlog
```

Replay accepts launcher args, for example:

```bash
./run-replay-awt.sh traces/interaction.awtlog --replay-speed 4
```

## Launcher Options

Useful options:

- `--awt fake|real`
- `--headless-init`
- `--sleep-ms <millis>`
- `--trace-file <file>`
- `--record-awt <file>`
- `--replay-awt <file>`
- `--replay-speed <factor>`
- `--keep-open-after-replay`
- `--gamepack <jar>`
- `--server <url>`

## Decompilation Notes

The stubs under `stubs-src/` resolve legacy dependencies referenced by the
gamepack:

- `com.ms.awt.WComponentPeer`
- `com.ms.com.*`
- `com.ms.directX.*`
- `com.ms.dll.*`
- `com.ms.win32.User32`
- `netscape.javascript.JSObject`
- `net.alterorb.launcher.Hook`

Example CFR usage after placing `lib/cfr.jar` locally:

```bash
java -jar lib/cfr.jar dekobloko.jar \
  --extraclasspath lib/dekobloko-stubs.jar \
  --outputdir src
```

### Current State

Known gamepack:

```text
dekobloko.jar sha256=a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

After the deobfuscation pipeline below, **343 of 343 classes** decompile under
CFR with zero structure markers, and **343/343 verify clean** under ASM
`BasicVerifier`. No CFR or other decompiler is used as an oracle inside the
pipeline; CFR is for dev-time validation only.

The reproducible pipeline is owned by this repo. It uses
[`java-tools`](https://github.com/Kreijstal/java-tools) only for generic
bytecode parsing, serialization, and reusable transforms; Dekobloko-specific
pass ordering, targeted CFG fixes, and hardcoded source-conflict renames live
under `scripts/pipeline/`.

```bash
# Bulk-mode: single Node.js process, ~25 seconds for the full 343-class gamepack
./scripts/pipeline/bulk-pipeline.js classes-original/ deobfuscated-out/
```

The IMPORTANT detail is that `scripts/pipeline/bulk-pipeline.js` round-trips the
AST through the bytecode serializer between every pass — the round-trip normalizes
stack-map frames, label aliases, and constant-pool ordering, and several
passes (notably `inline-shared-exit-goto`) only fire correctly on the
normalized state. The CLI form does this round-trip implicitly because every
invocation reads and writes a `.class`.

#### The transforms in plain English

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels. |
| `strip-rethrow-handlers --keep-handler-code` | Drops trivial catch-and-rethrow exception-table entries; **retains** bare `athrow` sentinels (Diobfuscator lesson — deleting both makes CFR worse). |
| `multi-entry-normalize` | Clones loop-header blocks for each forward edge so loops have a single semantic entry. Has a forward-only join splitter for fallthrough-joined CFG diamonds. |
| `coalesce-loop-load` | Folds `LOAD X; goto T2; T1: LOAD X; T2: <use X>` into `goto T1`. Cleans up the duplicate prefix that multi-entry normalization tends to leave behind. |
| `dead-flag-eliminate` | Eliminates dead conditionals on proven always-false static boolean/int flags. Auto-discovery rejects fields whose writes depend on their own previous value; Dekobloko's `client.A` is live and must not be treated as an always-false oracle. |
| `constructor-pre-super-cleanup` | Deletes unused static boolean snapshots before constructor `super(...)` calls so CFR emits legal Java constructors. |
| `remove-shadowing-trivial-rethrow-handlers` | Removes duplicate exception-table entries where a pure rethrow handler shadows a later useful handler for the same protected range. |
| `inline-shared-exit-goto` | The crux. Tail-duplicates a shared exit/merge body at the goto-site reached as the fallthrough of a conditional jump. The obfuscator collapsed javac's natural inline-exit prologues into shared `goto EXIT` chains; this pass puts them back where it matters. Drove `td` from 2 markers → 0 and `lk` from 3 → 0. |
| `cast-object-field-stores` | Inserts a field-descriptor `checkcast` before storing a locally constructed object into an object field, preserving CFR's source type for reused `Object` locals. |
| `primitive-array-copy-loops` | Rewrites exact primitive array copy loops to `System.arraycopy` where CFR otherwise emits malformed enhanced-for assignments. |
| `compile-conflict-renames` | Exact owner/name/descriptor renames for Java source conflicts where CFR emits short class names that collide with inherited fields or override-family methods. |
| `ei-tail-clone`, `qc-doloop-tail-clone` | Targeted tail-cloning passes for the remaining CFG shapes that CFR needs to structure `ei` and `qc` cleanly. |
| `stack-receiver-tail-clone` | Clones a tiny stack-carrying receiver tail such as `iconst_1; invokevirtual X.c(Z)V` when an earlier loop branches into another loop's call site with the receiver already on the operand stack. This preserves bytecode semantics while removing a cross-loop stack join CFR cannot structure. |

#### Generic passes vs profile-driven passes

The split is deliberate:

```text
java-tools/src/
  generic bytecode transforms and serializers

scripts/pipeline/
  Dekobloko/FunOrb pipeline order
  profile-aware pass wrappers
  game-specific JSON profiles
```

`java-tools` should not contain Dekobloko-specific class names, offsets, or
asset knowledge. When a transform needs a specific bytecode site, the site is
described in a profile under:

```text
scripts/pipeline/profiles/dekobloko.json
scripts/pipeline/profiles/chess.json
scripts/pipeline/profiles/tetralink.json
```

The pass implementation is still expected to be mechanically honest: it checks
the surrounding CFG/instruction shape before rewriting. A profile entry selects
a candidate site; it is not permission to blindly patch arbitrary code. This is
how the pipeline avoids hiding game-specific hacks inside reusable transforms.

Examples:

- `eiTailClone` and `qcDoLoopTailClone` are profile-selected tail clones for
  concrete CFR CFG failures. The pass checks the expected local block shape
  before editing.
- `qkExceptionSplit`, `vlCacheJoin`, `bParserLoopHeader`,
  `rasterScanlineEntryClone`, `sourceScopeLocalInit`, and
  `stackReceiverTailClone` are narrow
  profile-driven rewrites for classes where a fully general transform would
  have been too risky at the time.
- `compileConflictRenames` is profile/data driven. It renames only exact
  owner/name/descriptor conflicts and expands method renames across override
  families so call sites and hierarchy members stay consistent.
- `deadFlagFields` began as explicit profile data and is supplemented by
  automatic discovery from zero-valued sentinel fields. Discovery is
  conservative: self-dependent toggle writes are rejected rather than used as
  evidence that a flag is dead.

The useful discipline is:

1. First build a reduced Krakatau/Jasmin or javac-produced example that CFR
   accepts.
2. Compare that bytecode shape to the obfuscated bytecode.
3. Implement the smallest bytecode rewrite that reproduces the accepted shape.
4. Put any class/offset selectors in JSON profile data.
5. Re-run the all-class marker and verifier harnesses.

This is why the pipeline can support multiple FunOrb games without putting
`if (className === "...")` checks throughout `java-tools`.

#### The discovery story for `inline-shared-exit-goto`

Hand-writing Java that matches `td.c(Lvl;)V`'s semantics exactly (including
the unusual "if `var10 == 0` then return immediately, not break to the next
loop" branch) and feeding it through `javac -source 7 -target 7` produces
bytecode that CFR decompiles with **zero markers**. Diffing that bytecode
against the obfuscated `td.c` shows two differences:

1. javac **inlines the entire method-exit prologue** at the
   conditional-fallthrough site (`if var10 == 0 → write all locals back to
   fields → return`). The obfuscator replaced that inline with a single
   `goto EXIT`, where `EXIT` is a shared prologue at method end.
2. javac uses an explicit `goto INNER_LOOP_2` at the var3==1 path's exit; the
   obfuscator uses fallthrough.

Reproducing javac's inline-exit shape — i.e. tail-duplicating the merge
target's body at one specific predecessor — was sufficient to fix both `td`
and `lk`. The general rule emerged from there: the goto's previous
instruction must be a conditional jump, the target must have ≥4 forward
predecessors AND another forward predecessor reachable from inside the
conditional's then-target body (the "shared-join-inside-nested-structure"
shape), and the body must be 5–50 insns ending in a terminator.

#### Vineflower as a sanity check, not as a target

Vineflower (the modern Quiltflower fork) handles `td` and `lk` natively — its
structurer covers the patterns CFR fails on. But it has **its own** failure
mode on this gamepack: 618 javac errors (vs CFR's 244) because the
obfuscator's single-letter naming creates Java-level field-vs-class shadowing
that Vineflower doesn't qualify (e.g. `lb.a(...)` where `lb` is both a field
of type `int` and a sibling class). Switching decompiler oracles doesn't
help; cleaning up the bytecode does.

### Reproducing the result

Per-class regression (25 representative classes, fail-fast):

```bash
./scripts/regression-check.sh
```

Whole-gamepack benchmark (all 343 classes, batch verify, lock-and-update
mode):

```bash
./scripts/regression-check-all.sh             # check vs scripts/EXPECTED-ALL.txt
./scripts/regression-check-all.sh --report    # per-class table
./scripts/regression-check-all.sh --update    # write current state to EXPECTED-ALL.txt
```

Both pass at 0 regressions; the locked baseline is zero markers across all 343
classes. The frozen list is in `scripts/EXPECTED-ALL.txt`.

To reproduce the CFR-source javac count:

```bash
./scripts/compile-check-cfr.sh
```

Current result with `lib/dekobloko-stubs.jar` is `326/343` source files
compilable.

### Tools Used

Local repos and tools used during this investigation:

- `dekobloko-work`: this harness repo. It owns gamepack retrieval, dependency
  stubs, the fake/real AWT launcher, trace assertions, and experiment notes. It
  intentionally does not track downloaded jars, transformed classes, or CFR
  output.
- `java-tools` (`https://github.com/Kreijstal/java-tools`): primary
  bytecode/deobfuscation workbench. Useful pieces include Jasmin
  assemble/disassemble commands, rename/reflection analysis, call graph
  metadata, peephole cleanup, exception trap cleanup, and ASM transforms under
  `tools/asm/`.
- CFR 0.152 (`https://www.benf.org/other/cfr/` and
  `https://github.com/leibnitz27/cfr`): the main decompiler target. All bytecode
  cleanup has been measured against CFR output because the current goal is
  compilable CFR Java.
- Recaf (`https://github.com/Col-E/Recaf`): useful for inspection and
  interactive bytecode/class browsing. It wants a modern JDK, while the gamepack
  itself is Java 6/7 era bytecode.
- Diobfuscator / `Deobfuscator` (`https://github.com/Diobf/Deobfuscator`):
  useful as a reference implementation for peephole ideas. The important
  portable idea was keeping bare handler `athrow` sentinels while removing
  useless try/catch entries.
- Garlic (`https://github.com/neocanable/garlic`) and other decompilers: useful
  comparison points, but CFR remained the main target because its output and
  failure modes were easy to batch-scan.
- ASM (`https://asm.ow2.io/`, Maven artifacts `org.ow2.asm:asm`,
  `org.ow2.asm:asm-tree`, and `org.ow2.asm:asm-analysis`): used for actual class
  rewrites. `java-tools` currently builds `run-join-block-splitter` and
  `run-replace-method-body`.
- `javap` / `javac` from the JDK (`https://openjdk.org/`): `javap` was used to
  check real bytecode offsets and control-flow shapes. `javac -source 7 -target
  7` was used to produce structured donor bytecode for the `td.c(Lvl;)V` proof.
  This is a proof/testcase, not the final generic deobfuscator pass.
- `rg` / ripgrep (`https://github.com/BurntSushi/ripgrep`): used for marker
  scans, string/reflection searches, and quick output audits.
- fake AWT launcher: used as a boundary harness for applet/AWT/cache/network
  calls without Xvfb or pixel comparisons.

Supporting repos cloned during exploration:

- `katana-project/slicer`: `https://github.com/katana-project/slicer`
- `Kreijstal/java-tools`: `https://github.com/Kreijstal/java-tools`
- `alterorb/launcher`: `https://github.com/alterorb/launcher`
- `alterorb/deobfuscator`: `https://github.com/alterorb/deobfuscator`
- `neocanable/garlic`: `https://github.com/neocanable/garlic`
- `Diobf/Deobfuscator`: `https://github.com/Diobf/Deobfuscator`

Reference reading:

- Self-improving decompiler notes:
  `https://shanyu.juneja.net/thoughts/self-improving-decompiler/`

Not every cloned tool became part of the pipeline. The pieces that materially
changed the result were the `java-tools` ASM/peephole work, the Diobfuscator
peephole lesson, CFR marker scans, and the fake-AWT boundary harness.

### CFR Marker Tracking

The useful success metric is not class count or whether names moved around. The
code may be renamed, inlined, duplicated, or restructured. The boundary signals
that matter are network behavior, AWT calls, filesystem/cache behavior, and JVM
verification. For decompiler work, the local mechanical metric is whether CFR
still emits structure markers:

```bash
rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' cfr-output
```

The historic progression on this gamepack:

| Stage | Markers | Classes with markers |
|---|---|---|
| baseline (no pipeline) | many hundreds across the jar | most |
| after `peephole` + `strip-rethrow` | ~150 | ~30 |
| + `multi-entry-normalize` + `coalesce-loop-load` + `dead-flag-eliminate` | 74 | 15 |
| + `inline-shared-exit-goto` | 13 | 4 (`ck=5, qk=4, kh=3, qc=1`) |
| + focused tail clones and exception-table cleanup (current) | **0** | **0** |

343/343 classes now decompile under CFR with zero structure markers and verify
clean under ASM `BasicVerifier`.

### What's still left

The remaining work is Java-source compilability, not CFR structure markers. The
current source compile harness reports 17 failing classes; the largest buckets
are unreachable statements, ambiguous/reused `Object` locals, constructor
structuring, definite-assignment splits, and dependency-stub signature issues.
The existing harnesses (`compile-check-cfr.sh`, `regression-check.sh`, and
`regression-check-all.sh`) keep the next source-compile transforms reproducible:
the compile harness measures javac progress, and the locked marker baseline
rejects any change that makes CFR structure worse.

### Reduced CFR Testcases

The `java-tools` repository has reduced Jasmin examples:

- `examples/sources/jasmin/CfrBadLabelLoop.j`
- `examples/sources/jasmin/TdCExact.j`
- `examples/sources/jasmin/TdDecodeLoopShape.j`
- `examples/sources/jasmin/TwoEntryDecodeLoop.j`

The smallest CFR bad-label shape is a one-local method:

```text
0:  iload_0
1:  ifle 12
4:  iload_0
5:  ifeq 15
8:  iload_0
9:  ifne 4
12: iinc 0, 0
15: iinc 0, 0
18: return
```

CFR 0.152 emits `** GOTO` for that shape. The `--split-fallthrough-joins` pass
fixes this reduced case by cloning the small fallthrough target block and
inserting a skip `goto` so the original path no longer falls through into the
clone.

### Boundary Harness Notes

The launcher supports fake AWT, real AWT, record, and replay modes. The fake AWT
mode is an API boundary test rather than a pixel test. It is intended to keep
network/appcache/AWT/filesystem behavior anchored while bytecode changes.

Useful command shape:

```bash
timeout 20 java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt fake \
  --headless-init \
  --sleep-ms 500 \
  --trace-file .work/traces/headless.log \
  --gamepack /path/to/patched.jar

node assert-trace.js .work/traces/headless.log
```

The quick class-only experiment jars can reach `error_game_crash` under this
harness. Compare against a known baseline before treating that as a regression.
The harness is strongest when the patched jar preserves the same packaging shape
as the original gamepack.
