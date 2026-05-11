# Dekobloko Harness

Small Java 8 launcher and boundary-test harness for the AlterOrb/FunOrb
`dekobloko.jar` gamepack.

The repository intentionally tracks source and retrieval scripts only. Downloaded
gamepacks, decompiler jars, class files, traces, and generated decompiler output
are ignored.

## Repository Layout

Source and tooling are grouped by job:

```text
apps/launcher/            local fake/real AWT launcher source and trace checker
scripts/launcher/         launcher build/run wrappers
scripts/                  regression, compile, deobfuscation, and stub scripts
scripts/pipeline/         Dekobloko/FunOrb deobfuscation pipeline and profiles
stubs/src/                legacy JDK/browser dependency stubs
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
- Node.js for `apps/launcher/assert-trace.js`
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

AlterOrb/FunOrb gamepacks fetch assets through the Jagex JS5 protocol. The
launcher parameters are enough to mirror a cache without running the applet:

```text
host=mgg-server.alterorb.net
port=43594
servernum=8003
lang=0
gamecrc=from .work/upstream-alterorb-launcher/config.json
build=per gamepack
```

The build is the main trap. It is not global, and a wrong build can still pass
the handshake while exposing a different archive layout. Keep the canonical map
in `tools/js5/js5-builds-validated.json`; examples from the current mirror:

| Game | JS5 build | Music status |
|---|---:|---|
| `dekobloko` | 32 | 39 tracks extracted/rendered. |
| `brickabrac` | 65 | 16 tracks extracted/rendered. |
| `pixelate` | 55 | 18 tracks extracted/rendered. Build 13 handshakes but has the wrong archive 10 shape. |
| `tetralink` | 17 | 4 tracks plus sample banks, SFZ/SF2/native-bank exports. |
| `virogrid` | 77 | 4 tracks extracted/rendered. Build 15 handshakes but has the wrong archive 10 shape. |
| `chess` | 15 | Deob profile exists; no dedicated music renderer. |

Download one cache with the build table:

```bash
python3 tools/js5/download-caches.py \
  --game pixelate \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/js5-caches
```

For bulk metadata or payload mirroring:

```bash
python3 tools/js5/download-caches.py \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/js5-caches-metadata \
  --metadata-only

python3 tools/js5/download-caches.py \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/js5-caches
```

### JS5 Protocol

After setup and the one-byte `0x00` ack, archive requests are six bytes:

```text
priority archive-id group-id
01 ff 00 00 00 ff  -> archive 255, group 255: master index
01 ff 00 00 00 0a  -> archive 255, group 10:  archive-10 index
01 0a 00 00 00 00  -> archive 10,  group 0:   music group
```

Responses are JS5 containers. Archive `255` contains index metadata; normal
archives are cached as `main_file_cache.idxN` plus `main_file_cache.dat2`
sectors. `tools/js5/download-caches.py` writes that sector format, so the music
tools can read either a warmed AlterOrb cache or a freshly downloaded mirror.

### Music Model

FunOrb music is not stored as finished songs. It is a compact tracker/MIDI-like
format: sample banks plus instrument patches plus song descriptors, mixed to PCM
by the client at runtime. Rendered WAVs are therefore generated artifacts; keep
the JS5/music-format data and regenerate WAVs when needed.

Known archive roles:

| Game | Archives | Song class/path | Renderer output |
|---|---|---|---|
| Dekobloko | 8 synth samples, 9 packvorbis samples, 10 `ui` descriptors | `ui -> ia -> mi -> ei` | `.work/music/dekobloko/wav/archive10_tracks` |
| Brickabrac | 7 `dr` samples, 8 `bk` Vorbis samples, 9 `pq` patches, 10 `vm` songs, 13 labels | `vm -> ie` | `.work/music/brickabrac/wav-native/archive10_tracks` |
| Pixelate | 7/8 sound banks, 9 `sn` patches, 10 `ua` songs | `ua -> ti` | `.work/music/pixelate-build55/wav-native/archive10_tracks` |
| TetraLink | 7/8 `wf` samples, 9 `ng` patches, 10 `ri` songs | `ri -> g/go/ng/fa` | `.work/music/tetralink-build17/wav/archive10_tracks` |
| Virogrid | 7/8 sound banks, 9 `rc` patches, 10 `sc` songs | `sc -> i/rc/jg` | `.work/music/virogrid-build77/wav-native/archive10_tracks` |

Archive 10 names must come from JS5 file-name hashes or client load strings, not
from split position. Dekobloko build 31/32, for example, maps sparse file IDs to
names such as `music/Deko Bloko Titlescreen`; Pixelate build 55 maps
`pix_title`, `pix_end_game`, and `skin1` through `skin16`. This is why files
named only `track_XX` are suspect.

Virogrid is a good example of why the build table has to be validated against
the client's load strings, not just the JS5 handshake. Build 15 connects, but
its archive 10 does not contain the Virogrid music group/file-name layout.
Build 77 has archive 10 group hash `0` (the empty group name) with the four
client-requested file hashes:

| Virogrid archive 10 file ID | Client load string |
|---:|---|
| 2 | `ataxx titlescreen` |
| 0 | `tetralink ingame 1` |
| 1 | `tetralink ingame 2` |
| 5 | `tetralink ingame 3` |

Those names are loaded directly by `Virogrid` through `sc.a(wm.w, "", name)`.
Archive 9 supplies `rc` instrument patches, archive 7 supplies `vn` synth
samples, and archive 8 supplies `gj` packvorbis samples through `jg`.

### Music Commands

Dekobloko and Brickabrac use the Python extractor before Java rendering:

```bash
python3 tools/music/extract-dekobloko-music.py \
  .work/js5-caches/dekobloko \
  .work/music/dekobloko \
  --game dekobloko

javac -cp classes-original -d .work/music-tools \
  tools/music/MusicSampleDecoder.java \
  tools/music/MusicUiJsonDumper.java \
  tools/music/MusicTrackRenderer.java \
  tools/music/MusicSampleBankExporter.java

java -cp .work/music-tools:classes-original MusicUiJsonDumper .work/music/dekobloko
java -cp .work/music-tools:classes-original MusicTrackRenderer .work/music/dekobloko
java -cp .work/music-tools:classes-original MusicSampleBankExporter .work/music/dekobloko
```

```bash
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

Pixelate renders directly from its build-55 JS5 cache through deobfuscated
classes:

```bash
javac -cp .work/deob-pixelate-profile/out -d .work/pixelate-music-tools \
  tools/music/PixelateNativeMusicRenderer.java

java -cp .work/pixelate-music-tools:.work/deob-pixelate-profile/out \
  PixelateNativeMusicRenderer \
  .work/music/pixelate-build55 \
  .work/js5-caches-pixelate-build55/pixelate
```

Virogrid uses the TetraLink-style archive layout, but its working cache is
build 77:

```bash
python3 tools/music/extract-dekobloko-music.py \
  .work/js5-caches-virogrid-build77/virogrid \
  .work/music/virogrid-build77 \
  --game virogrid

javac -cp .work/deob-virogrid-profile/out -d .work/virogrid-music-tools \
  tools/music/VirogridNativeMusicRenderer.java

java -cp .work/virogrid-music-tools:.work/deob-virogrid-profile/out \
  VirogridNativeMusicRenderer \
  .work/music/virogrid-build77 \
  .work/js5-caches-virogrid-build77/virogrid
```

Expected Virogrid native render output is four repaired MIDI files under
`.work/music/virogrid-build77/midi/archive10_tracks` and four WAVs under
`.work/music/virogrid-build77/wav-native/archive10_tracks`:

| Track | Approx rendered length |
|---|---:|
| `ataxx_titlescreen.wav` | 217.243s |
| `tetralink_ingame_1.wav` | 278.497s |
| `tetralink_ingame_2.wav` | 240.091s |
| `tetralink_ingame_3.wav` | 244.875s |

The native renderer intentionally drives Virogrid's own music classes instead
of a generic MIDI engine: `sc` holds the repaired MIDI bytes, `i` is the
sequencer/mixer, `rc` is the patch/instrument class, and `jg` resolves samples
from archives 7 and 8. The cache adapter detail is easy to get wrong:
Virogrid's `eh` archive wrapper calls the backend as `b(group, magic)`, and the
archive index constructor `sj(byte[], crc, whirlpool)` expects the real CRC
(`na.a(false, raw.length, raw)`) rather than zero.

TetraLink has the richest export path:

```bash
javac -cp .work/gamepack-classes/tetralink -d .work/tetralink-music-tools \
  tools/music/TetraLinkMusicPreprocessor.java \
  tools/music/TetraLinkSfzExporter.java \
  tools/music/TetraLinkSf2Exporter.java \
  tools/music/TetraLinkNativeBankExporter.java \
  tools/music/TetraLinkFunOrbMidiRenderer.java

java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkMusicPreprocessor .work/music/tetralink-build17
java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkSfzExporter .work/music/tetralink-build17
java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkSf2Exporter .work/music/tetralink-build17
java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkNativeBankExporter .work/music/tetralink-build17
java -cp .work/tetralink-music-tools:.work/gamepack-classes/tetralink \
  TetraLinkFunOrbMidiRenderer .work/music/tetralink-build17
```

### Editable Formats

SFZ and SF2 are interchange formats, not byte-exact FunOrb renderers. SFZ keeps
sample choice, key mapping, loop points, pitch offset, per-note volume, pan, and
exclusive-class hints. SF2 is compact and DAW-friendly, with one preset per
archive-9 patch and the percussion patch at bank 128 program 0. Both lose some
native mixer behavior.

The native LV2 route is closer to the client: `TetraLinkNativeBankExporter`
writes `.work/music/tetralink-build17/native/funorb_tetralink.fobank`, and
`tools/lv2/build-funorb-native-lv2.sh` builds `.work/lv2/funorb-native.lv2`.
That plugin mixes decoded FunOrb samples directly in its `.so`, with
interpolated playback, loop direction, volume/expression/pan, sustain, pitch
bend, percussion exclusivity, release ramps, envelope/modulation records, Q8
sample-position interpolation, 10 ms control cadence, gain ramps, and the CC81
stream-restart path. Remaining LV2 work is empirical parity against the Java
reference.

There is also a FluidSynth LV2 wrapper around the generated SF2:
`tools/lv2/build-funorb-fluidsynth-lv2.sh`. It is useful for host plumbing, not
for exact playback.

### Browser Visualizer

Serve the repo and open the standalone visualizer:

```bash
python3 -m http.server 8765
```

```text
http://127.0.0.1:8765/web/music-visualizer/index.html
```

The page imports D3 from `esm.sh`, loads `json/sample-bank.json`, plays decoded
sample PCM through browser-side `Ia`, `Mi`, and `Ei` classes in
`web/music-visualizer/audio.js`, and animates decoded `ui` pattern events. It
does not yet port the custom `bi`/`va` sample decoders to the browser.

When porting mixer code, use the current deobfuscated mixer slice, not stale raw
CFR source:

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
old raw `src/ei.java` copy predates those transforms and still contains a CFR
failure stub.

## Build

```bash
./scripts/launcher/build.sh
```

This builds `.work/launcher/dekobloko-launcher.jar` from
`apps/launcher/src/`.

To build dependency stubs for decompilation/compiler linking:

```bash
./scripts/build-stubs.sh
```

This writes `lib/dekobloko-stubs.jar`.

## Run Modes

Automated fake-AWT boundary check:

```bash
./scripts/launcher/run-fake-awt-check.sh
```

This uses `local.awt.FakeToolkit` and `local.awt.FakeGraphicsEnvironment` as an
AWT MITM. It does not use Xvfb and does not compare pixels. It asserts stable
boundary events such as applet parameters, cache redirects, fake display
discovery, frame peer creation/layout, and lifecycle calls.

Human-in-loop real AWT window:

```bash
./scripts/launcher/run-real-awt.sh
```

This requires `DISPLAY` or `WAYLAND_DISPLAY`.

Record real AWT interaction:

```bash
./scripts/launcher/run-record-awt.sh .work/traces/interaction.awtlog
```

Replay interaction through fake AWT:

```bash
./scripts/launcher/run-replay-awt.sh .work/traces/interaction.awtlog
```

Replay accepts launcher args, for example:

```bash
./scripts/launcher/run-replay-awt.sh .work/traces/interaction.awtlog --replay-speed 4
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

The stubs under `stubs/src/` resolve legacy dependencies referenced by the
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

### Deobfuscation Status

Known gamepack:

```text
dekobloko.jar sha256=a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

After the deobfuscation pipeline below, **343 of 343 classes** decompile under
CFR with zero structure markers, and **343/343 verify clean** under ASM
`BasicVerifier`. The CFR sources also compile cleanly: **343/343** Java files
compile with `javac` against `lib/dekobloko-stubs.jar`. No CFR or other
decompiler is used as an oracle inside the pipeline; CFR is for dev-time
validation only.

The reproducible pipeline is owned by this repo. It uses
[`java-tools`](https://github.com/Kreijstal/java-tools) only for generic
bytecode parsing, serialization, and reusable transforms; Dekobloko-specific
pass ordering, targeted CFG fixes, and hardcoded source-conflict renames live
under `scripts/pipeline/`.

```bash
# Bulk-mode: single Node.js process, ~25 seconds for the full 343-class gamepack
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js classes-original/ deobfuscated-out/
```

`scripts/pipeline/bulk-pipeline.js` round-trips the AST through the bytecode
serializer between every pass. This normalizes stack-map frames, label aliases,
and constant-pool ordering. The CLI form does this round-trip implicitly because
each invocation reads and writes a `.class`.

The default profile is `dekobloko`. Use `--profile none` for a generic
runtime-safe run that should not load any game profile, and use `--profile all`
only when deliberately checking profile leakage.

`--safe-bytecode` enables stricter variants of a few local-splitting and
boolean-return cleanup passes. It is useful for new gamepacks where the normal
CFR-oriented shape can accidentally create verifier-invalid bytecode. The flag
does not load game-specific selectors; it only asks generic passes to use extra
dominance and original-local-preservation gates. Keep the default Dekobloko run
without this flag unless a guardrail shows a verifier/runtime need.

### Other Gamepack Baselines

The same generic pipeline can be run over other AlterOrb/FunOrb jars. These
baselines are not all expected to be zero-marker yet; they are useful because
each game exposes a slightly different obfuscator corner case.

Virogrid uses the generic runtime-safe pipeline, without a dedicated profile:

```bash
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/gamepack-classes/virogrid \
  .work/deob-virogrid-profile/out \
  --profile none \
  --runtime-safe
```

Virogrid baseline:

| Metric | Result |
|---|---:|
| Input classes | 347 |
| Pipeline passthrough failures | 0 |
| ASM `BasicVerifier` failures | 0 methods / 0 classes |
| CFR Java files emitted | 347 |
| CFR structure marker lines | 166 |
| CFR classes with markers | 17 |

Virogrid marker classes:

```text
bn c co d ha hm ic jc km nm oa pl qk rc sb sj tk
```

This is a mechanically valid bytecode baseline, not a clean CFR-structuring
baseline like Dekobloko.

Steel Sentinels currently needs the stricter bytecode-safety mode. The generic
run without `--safe-bytecode` initially produced very low CFR markers, but it
also created verifier-invalid bytecode in six classes (`be`, `bh`, `ee`, `nb`,
`nk`, and `qb`). The failing shapes were not Steel-specific hardcodes:

- array/reference split passes moved only selected loads to a fresh local while
  leaving other paths that still read the original local;
- some split stores were branch targets, so inserting `dup; astore fresh`
  before the target left branch entrants without the fresh local initialized;
- concrete-object splitting rewrote uses after a conditional reassignment even
  when the reassignment did not dominate the later use;
- boolean-return DCE retargeted an identical `iconst_0; ireturn` label to an
  earlier block that had a fallthrough predecessor with another value still on
  the stack.

The `--safe-bytecode` mode fixes those mechanically by requiring dominance for
fresh-local uses, preserving the original local when non-rewritten loads remain
or a store is a branch target, and refusing const-return merge targets that have
fallthrough predecessors.

Reproduce the current Steel Sentinels baseline:

```bash
rm -rf .work/steelsentinels-deob-safe
mkdir -p \
  .work/steelsentinels-deob-safe/classes \
  .work/steelsentinels-deob-safe/out \
  .work/steelsentinels-deob-safe/cfr \
  .work/steelsentinels-deob-safe/logs

(cd .work/steelsentinels-deob-safe/classes && \
  jar xf ../../gamepacks/steelsentinels.jar)

JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/steelsentinels-deob-safe/classes \
  .work/steelsentinels-deob-safe/out \
  --profile none \
  --safe-bytecode
```

Verifier check:

```bash
javac -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  -d .work/verify-tools \
  scripts/Verify.java

java -cp .work/verify-tools:/home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  Verify .work/steelsentinels-deob-safe/out/*.class
```

CFR marker scan:

```bash
java -jar lib/cfr.jar \
  .work/steelsentinels-deob-safe/out/*.class \
  --outputdir .work/steelsentinels-deob-safe/cfr

rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' \
  .work/steelsentinels-deob-safe/cfr \
  > .work/steelsentinels-deob-safe/logs/cfr-markers.txt
```

Steel Sentinels baseline:

| Metric | Result |
|---|---:|
| Input classes | 347 |
| Pipeline passthrough failures | 0 |
| ASM `BasicVerifier` failures | 0 methods / 0 classes |
| CFR Java files emitted | 347 |
| CFR structure marker lines | 5 |
| CFR classes with markers | 2 |
| CFR-source javac | 314/347 |

Steel Sentinels marker classes:

```text
hb nb
```

The former `ao` marker was a protected-entry bridge: an unprotected
`aload_0; goto join` duplicated the first load of a protected retry block.
`peephole-clean` now rewrites that bridge to jump to the protected copy of the
same load, so the stack shape is unchanged while CFR sees a single entry.

The per-class javac failures are still source-shape/type-pollution work, not
bytecode verifier failures. The most common categories at this baseline are
ambiguous short-name references, constructor/super placement, residual CFR
structure (`illegal start of expression`), and object/array type pollution.

#### Transform Catalog

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels, protected load-bridge coalescing, constructor-only `if body; goto exit; body:` inversion, and constructor-only unreachable dead-handler tail cleanup. |
| `strip-rethrow-handlers --keep-handler-code` | Drops trivial catch-and-rethrow exception-table entries while retaining bare `athrow` sentinels. |
| `multi-entry-normalize` | Clones loop-header blocks for each forward edge so loops have a single semantic entry. Has a forward-only join splitter for fallthrough-joined CFG diamonds. |
| `coalesce-loop-load` | Folds `LOAD X; goto T2; T1: LOAD X; T2: <use X>` into `goto T1`. Cleans up the duplicate prefix that multi-entry normalization tends to leave behind. |
| `dead-flag-eliminate` | Eliminates dead conditionals on proven always-false static boolean/int flags. It handles both local snapshots (`getstatic flag; istore n; iload n; ifeq/ifne`) and direct tests (`getstatic flag; ifeq/ifne`). Full-jar discovery now models guarded self-toggle writes as dependencies, so Dekobloko's `client.A` is discovered automatically instead of hardcoded in `dekobloko.json`. |
| `constructor-pre-super-cleanup` | Deletes unused static boolean snapshots before constructor `super(...)` calls so CFR emits legal Java constructors. |
| `remove-shadowing-trivial-rethrow-handlers` | Removes duplicate exception-table entries where a pure rethrow handler shadows a later useful handler for the same protected range. |
| `inline-shared-exit-goto` | Tail-duplicates a shared exit/merge body at a goto-site reached as the fallthrough of a conditional jump. |
| `cast-object-field-stores` | Inserts a field-descriptor `checkcast` before storing a locally constructed object into an object field, preserving CFR's source type for reused `Object` locals. |
| `primitive-array-copy-loops` | Rewrites exact primitive array copy loops to `System.arraycopy` where CFR otherwise emits malformed enhanced-for assignments. |
| `simplify-string-length-not-compare` | Rewrites `~String.length()` comparisons only when the moved instructions are a real String receiver chain. |
| `split-array-reaching-local` | Splits polluted array locals. In `--safe-bytecode` mode it requires the source store to dominate every rewritten load and preserves the original local when another path can still read it or the store itself is a branch target. |
| `split-concrete-object-reaching-local` | Splits polluted concrete object locals. In `--safe-bytecode` mode it uses the same dominance/original-local preservation as array splitting, which keeps verifier state valid around conditional reassignments. |
| `split-primitive-int-branch-local` | Splits polluted int loop locals only when no earlier branch can bypass the fresh-local initialization. The split copies the fresh value back to the original local so non-rewritten paths remain initialized. |
| `control-flow-dce` | Collapses simple goto/const-return clutter. In `--safe-bytecode` mode it refuses to merge a const-return label into an earlier const-return block when the earlier block has a fallthrough predecessor that could leave a value on the stack. |
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
scripts/pipeline/profiles/brickabrac.json
scripts/pipeline/profiles/chess.json
scripts/pipeline/profiles/pixelate.json
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

#### Transform Development Rules

1. Build a reduced Krakatau/Jasmin or javac-produced example that CFR accepts.
2. Compare that bytecode shape to the obfuscated bytecode.
3. Implement the smallest semantic-preserving bytecode rewrite.
4. Put class/offset selectors in JSON profile data when a fully general gate is
   too risky.
5. Re-run the all-class marker, verifier, and compile harnesses.
6. For new gamepacks, first check `--profile none`; if CFR improves while the
   verifier fails, rerun with `--safe-bytecode` and inspect the bytecode diff
   before accepting the result.

`java-tools` stays generic. Game-specific selectors stay in
`scripts/pipeline/profiles/*.json`.

### Reproducing the result

These commands run the real Dekobloko bulk pipeline. ASM is used only by
`Verify.java` after the transform, and CFR is used only for validation.

One explicit deobfuscation run:

```bash
rm -rf .work/roundtrip
mkdir -p .work/roundtrip/out .work/roundtrip/cfr

JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  classes-original \
  .work/roundtrip/out \
  --profile dekobloko
```

Decompile that output with CFR and scan for structure markers:

```bash
java -jar lib/cfr.jar \
  .work/roundtrip/out/*.class \
  --outputdir .work/roundtrip/cfr

rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' \
  .work/roundtrip/cfr
```

An empty `rg` result is expected.

Batch verifier check for the transformed class files:

```bash
javac -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  -d scripts \
  scripts/Verify.java

java -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar:scripts \
  Verify .work/roundtrip/out/*.class
```

Expected verifier summary:

```text
ClassesWithFails: 0
```

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

Expected result with `lib/dekobloko-stubs.jar`:

```text
total=343 ok=343 fail=0
```

The compile harness performs the full roundtrip:

1. `bulk-pipeline.js classes-original "$WORK/out"` with the default
   `dekobloko` profile.
2. `java -jar lib/cfr.jar "$WORK/out"/*.class --outputdir "$WORK/cfr"`.
3. Per-class `javac -source 7 -target 7 -Xbootclasspath/p:lib/dekobloko-stubs.jar
   -proc:none -cp "$WORK/out:lib/dekobloko-stubs.jar" -sourcepath ''`.

To inspect a specific transformed class using the java-tools disassembler:

```bash
node /home/kreijstal/git/java-tools/scripts/jvm-cli.js disassemble \
  .work/roundtrip/out/client.class \
  --out .work/roundtrip/client.j
```

That disassembly path is preferred for pipeline debugging because it uses the
same parser/serializer conventions as the transforms.

Runtime boundary smoke check:

```bash
./scripts/launcher/run-fake-awt-check.sh
```

Expected result: the launcher rebuilds, starts `dekobloko.jar` with fake AWT,
records applet parameters, cache redirects, fake graphics/toolkit calls, frame
peer lifecycle, and applet lifecycle, then exits with:

```text
Trace OK: .../.work/traces/headless-init.log
```

This is not part of the CFR oracle. It is a separate runtime boundary check
that catches launcher/AWT/cache regressions after bytecode or harness changes.

### Tool Roles

Local repos and tools:

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
  `https://github.com/leibnitz27/cfr`): the main decompiler target and
  validation tool.
- Recaf (`https://github.com/Col-E/Recaf`): useful for inspection and
  interactive bytecode/class browsing. It wants a modern JDK, while the gamepack
  itself is Java 6/7 era bytecode.
- Diobfuscator / `Deobfuscator` (`https://github.com/Diobf/Deobfuscator`):
  reference implementation for peephole ideas.
- Garlic (`https://github.com/neocanable/garlic`) and other decompilers:
  comparison points.
- ASM (`https://asm.ow2.io/`, Maven artifacts `org.ow2.asm:asm`,
  `org.ow2.asm:asm-tree`, and `org.ow2.asm:asm-analysis`): used for actual class
  rewrites. `java-tools` currently builds `run-join-block-splitter` and
  `run-replace-method-body`.
- `javap` / `javac` from the JDK (`https://openjdk.org/`): bytecode inspection,
  reduced testcase compilation, and final CFR-source compilation.
- `rg` / ripgrep (`https://github.com/BurntSushi/ripgrep`): used for marker
  scans, string/reflection searches, and quick output audits.
- fake AWT launcher: used as a boundary harness for applet/AWT/cache/network
  calls without Xvfb or pixel comparisons.

Supporting repos:

- `katana-project/slicer`: `https://github.com/katana-project/slicer`
- `Kreijstal/java-tools`: `https://github.com/Kreijstal/java-tools`
- `alterorb/launcher`: `https://github.com/alterorb/launcher`
- `alterorb/deobfuscator`: `https://github.com/alterorb/deobfuscator`
- `neocanable/garlic`: `https://github.com/neocanable/garlic`
- `Diobf/Deobfuscator`: `https://github.com/Diobf/Deobfuscator`

### Validation Metrics

The decompiler metric is whether CFR still emits structure markers:

```bash
rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' cfr-output
```

Dekobloko baseline:

| Stage | Markers | Classes with markers |
|---|---|---|
| current pipeline | **0** | **0** |

343/343 classes decompile under CFR with zero structure markers, verify clean
under ASM `BasicVerifier`, and compile as CFR Java against
`lib/dekobloko-stubs.jar`.

### Maintenance Checks

Keep these checks green after bytecode, profile, launcher, cache, or music
changes:

```bash
./scripts/regression-check.sh
./scripts/regression-check-all.sh
./scripts/compile-check-cfr.sh
./scripts/launcher/run-fake-awt-check.sh
```

New FunOrb game profiles must not change the default Dekobloko baseline.

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

node apps/launcher/assert-trace.js .work/traces/headless.log
```

The quick class-only experiment jars can reach `error_game_crash` under this
harness. Compare against a known baseline before treating that as a regression.
The harness is strongest when the patched jar preserves the same packaging shape
as the original gamepack.
