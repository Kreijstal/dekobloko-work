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
.work/                    ignored generated caches, extracted data, compiled
                          helpers, traces, CFR output, and WAVs
```

Anything under `.work/` is disposable generated state. If a helper performs real
work and should survive a cleanup, it belongs under `tools/`, `scripts/`, or
`web/`, not `.work/`.

Suggested `.work/` organization:

```text
.work/games/<game>/gamepack.jar        downloaded gamepack jar
.work/games/<game>/classes/            extracted original class files
.work/games/<game>/js5-cache/          best/current downloaded JS5 cache
.work/games/<game>/music/              generated music JSON, MIDI, and WAV data
.work/games/<game>/deob-<purpose>/     transformed bytecode, CFR output, logs
.work/games/<game>/compile-<purpose>/  javac/CFR compile-check output
.work/games/<game>/launcher/           game-specific launcher build output
```

Do not create root-level `.work/*-probe`, `.work/*-check`,
`.work/*-buildNN`, or `.work/*-final` directories. Keep the latest useful
variant under the owning game directory and delete stale probes. Do not keep the
only copy of source code, patches, or scripts in `.work/`; promote those to
tracked repository paths.

## Requirements

- JDK 8 or newer
- Bash
- Node.js for `apps/launcher/assert-trace.js`
- `curl` for fetching the gamepack

For launcher-only work, this repository is otherwise self-contained. For the
deobfuscation pipeline, also clone
[`java-tools`](https://github.com/Kreijstal/java-tools); the pipeline uses it
for generic bytecode parsing, serialization, and reusable transforms.

## Checkout Setup

The repository can live anywhere. The examples below use `~/git`:

```bash
mkdir -p ~/git
cd ~/git
git clone https://github.com/Kreijstal/dekobloko-work.git
git clone https://github.com/Kreijstal/java-tools.git

cd dekobloko-work
export JAVA_TOOLS_DIR="$HOME/git/java-tools"
```

`JAVA_TOOLS_DIR` is only required for scripts that call into `java-tools`, such
as `scripts/pipeline/bulk-pipeline.js`. If `JAVA_TOOLS_DIR` is unset, those
scripts fall back to the author's local path, `/home/kreijstal/git/java-tools`,
which is not expected to exist on other machines.

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
gamecrc=from .work/games/dekobloko/upstream-alterorb-launcher/config.json
build=per gamepack
```

The first thing to check for a new game is the JS5 build. The build is not
global, and a wrong build can still pass the handshake while exposing a
different archive layout. Do not trust "connects successfully" as validation:
verify the archive indexes against client load strings or against expected
archive roles before extracting/rendering assets. Keep the canonical map in
`tools/js5/js5-builds-validated.json`; examples from the current mirror:

| Game | JS5 build | Music status |
|---|---:|---|
| `dekobloko` | 32 | 39 tracks extracted/rendered. |
| `brickabrac` | 65 | 16 tracks extracted/rendered. |
| `pixelate` | 55 | 18 tracks extracted/rendered. Build 13 handshakes but has the wrong archive 10 shape. |
| `tetralink` | 17 | 4 tracks plus sample banks, SFZ/SF2/native-bank exports. |
| `virogrid` | 77 | 4 tracks extracted/rendered. Build 15 handshakes but has the wrong archive 10 shape. |
| `steelsentinels` | 71 | 6 tracks extracted/rendered. Build 15 handshakes but exposes font/UI data in archive 10. |
| `orbdefence` | 60 | 14 tracks extracted/rendered. Build 11 handshakes but does not contain the music file-name hashes in archive 9. |
| `zombiedawn` | 41 | 14 tracks extracted/rendered. Build 12 handshakes but does not contain the single-player music names in archive 7. |
| `zombiedawnmulti` | 72 | 11 tracks extracted/rendered. Build 14 handshakes but does not contain the multiplayer music names in archive 7. |
| `minerdisturbance` | 5 | 7 native music tracks and 62 `jd` effects extracted/rendered. Build 13 handshakes but exposes a different archive layout. |
| `trackcontroller` | 12 | 4 native music tracks plus 12 named SFX extracted/rendered. |
| `dungeonassault` | 32 | 9 `vh` MIDI/WAV tracks plus 16 named PCM samples extracted/rendered. |
| `starcannon` | 10 | 20 SFX plus 14 voice WAVs extracted/rendered; no music renderer yet (no native-MIDI loader found in CFR). |
| `bouncedown` | 11 | 13 decoded sample WAVs extracted. No music tracks (no native-MIDI loader). |
| `crazycrystals` | 15 | 11 `rm` tracks extracted and rendered through the client `wg` mixer at the stored MIDI sequence lengths; build 14 has SFX but not the named music archive layout. |
| `escapevector` | 21 | 8 native music tracks plus 52 decoded sample WAVs extracted/rendered. Build 12 handshakes but archive 4 lacks the music file-name table. |
| `geoblox` | 1 | 4 `rf` tracks extracted and rendered through the client `kj` mixer at the stored MIDI sequence lengths. Build 11 handshakes but has the wrong archive 5 song-name layout. |
| `fleacircus` | 12 | 22 decoded sample WAVs extracted. No music tracks (no native-MIDI loader). |
| `holdtheline` | 8 | Native `vi -> kf` renderer added and renders the available tracks at stored MIDI sequence lengths. The build-8 mirror exposes 3 of the 7 named music groups (`title`, `victory_jingle`, `classic`); the other four are missing from the cache mirror. |
| `hostilespawn_vengeance` | 14 | 126 decoded sample WAVs extracted. No music tracks (no native-MIDI loader). |
| `vertigo2` | 20 | 33 decoded sample WAVs extracted. No music tracks (CFR markers remain in `bh`, `pm`, `up`). |
| `arcanistsmulti` | 19 | 10 `ha` tracks extracted and rendered through the client `gh` mixer at the stored MIDI sequence lengths. Build 15 handshakes but has the wrong archive 5 song-name layout. |
| `bachelorfridge` | 70 | 11 `kia` tracks extracted and rendered through the client `jp` mixer at the stored MIDI sequence lengths. Build 21 handshakes but does not expose the 8/9 music indexes used by this gamepack. |
| `tombracer` | 81 | 4 `qua` tracks extracted and rendered through the client `l` mixer at the stored MIDI sequence lengths. Build 31 handshakes but does not expose the 26-29 music indexes used by this gamepack. |
| `torquing` | 11 | 13 source-audio music tracks extracted and rendered through the client `wl` mixer. Build 16 handshakes but lacks the named archive-4 music table used by this gamepack. |
| `pool` | 61 | 16 `cg` tracks extracted and rendered through the client `vk` mixer at the stored MIDI sequence lengths. Build 20 handshakes but does not expose the archive 10/11 music shape used by this gamepack. |
| `aceofskies` | 18 | 3 `ap` tracks extracted and rendered through the client `hk` mixer as stereo WAVs at the stored MIDI sequence lengths. Build 13 handshakes but lacks the named archive-9 song hashes. |
| `chess` | 14 | 8 `pf` tracks (`chess1`-`chess7`, `fanfare`) extracted and rendered through the client `vl` mixer as stereo WAVs at the stored MIDI sequence lengths. Build 15 handshakes but exposes a different archive-5 shape without the deobfuscated music file hashes. |
| `36cardtrick` | 7 | 3 source-audio music tracks rendered through the client `uf`/`qj` mixer. Build 10 handshakes but lacks the named music table. |
| `armiesofgielinor` | 31 | No named music load site found. The generic native-MIDI profile only found UI strings such as `lobby`. |
| `confined` | 20 | One custom `vk` sequence at `music/music` rendered through the client `dd` scheduler and `be` mixer. Build 15 handshakes, but build 20 exposes the archive-9 `music/music` name hash and matching archive 7/8 sample data. |
| `drphlogistonsavestheearth` | 4 | 7 `ok` tracks extracted and rendered through the client `ug` mixer as stereo WAVs at the stored MIDI sequence lengths. Builds 12 and 17 expose only partial/mismatched cache data with no matching name hashes. |
| `kickabout` | 19 | No named soundtrack load site found. The deobfuscated `"music"` load is a wordpack/string table assigned to `kd.A` and later exposed as menu text, not a playable sequence; `MThd` markers are present only in generic audio classes. |
| `lexicominos` | 14 | No soundtrack loader found. `ingameleft` and `ingameright` are image/sprite resources, not music; the only music-like audio is the `score_increase_loop`/`score_increase_stop` sound-effect pair loaded through the Vorbis `sd` path. |
| `monkeypuzzle2` | 24 | 10 source-audio music tracks extracted and rendered through the client `lg`/`ud`/`qf` mixer. The renderer derives each WAV length from the stored sequencer duration instead of using silence trimming or a fixed capture limit. |
| `shatteredplans` | 15 | No named music load site found; generic profile candidates are UI/font assets. No renderer-generated soundtrack is available. |
| `solknight` | 11 | No named music load site found; generic profile candidates are UI/font assets. No renderer-generated soundtrack is available. |
| `stellarshard` | 10 | Two custom `jj` tracks (`music/Stellar_Shard_ingame`, `music/Stellar_Shard_Halloween`) rendered through the client `d` scheduler and `hl` mixer for one stored sequence pass. Build 11 handshakes, but build 10 exposes the archive-4 music names and archive 2/3 sample data. |
| `sumoblitz` | 60 | 14 unnamed archive-9 `tv` tracks rendered through the client `bs` player as stereo WAVs at the stored MIDI sequence lengths. The deobfuscated build-13 loader has nine named strings, but build 13 lacks archive 9; build 60 exposes matching archive 6/7 sample banks, archive 8 patches, and an anonymous archive-9 song group that hydrates cleanly through the Sumoblitz renderer. |
| `terraphoenix` | 26 | Eight `tk` native sequence tracks extracted from archive 5 and rendered through the client `wl` mixer as stereo WAVs at the stored MIDI sequence lengths. Build 32 handshakes but exposes no index 5/6; build 26 has the named music table and matching archives 3/4/6. |
| `torchallenge` | 39 | 14 `ej` tracks extracted and rendered through the client `kb` mixer as stereo WAVs at the stored MIDI sequence lengths. Build 12 handshakes but lacks the named archive-9 song hashes. |
| `transmogrify` | 13 | 10 source-audio music tracks extracted from archive 5 and rendered through the client `pl`/`lc` mixer. The renderer derives each WAV length from the stored sequence duration instead of using silence trimming or a fixed capture limit. |
| `voidhunters` | 26 | Four `kka` native tracks (`VH_Title_Music`, `VH_Ingame_Music`, `VH_Jingle_Win`, `VH_Jingle_Lose`) rendered through the client `hbb` mixer as stereo WAVs at the stored MIDI sequence lengths. The standalone JS5 sweep missed these because the deobfuscated applet creates `~/.alterorb/caches/voidhunters` through `Hook.cacheRedirect`; running the launcher path under Xvfb populated archive 19 samples, archive 20 patches, and archive 21 songs. Archive 21 is a single unnamed group split into the four deob-named songs. |
| `wizardrun` | 6 | 10 `ji` tracks extracted and rendered through the client `fl` mixer at the stored MIDI sequence lengths. Build 12 handshakes but lacks the named archive-5 song hashes. |

For the games above, the remaining work is not more profile examples. The
native-MIDI family is exhausted where it validates; the unresolved cases are
either older source-audio engines that need game-specific stream renderers, or
cache mirror gaps where the client has track names but the mirrored JS5 index
does not provide the matching groups/patches.

Do not count web-downloaded OGGs as extracted soundtracks. Soundtrack WAVs must
come from the game cache and the matching FunOrb/client renderer path.

Download one cache with the build table:

```bash
python3 tools/js5/download-caches.py \
  --game pixelate \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/games/pixelate/download
rm -rf .work/games/pixelate/js5-cache
mv .work/games/pixelate/download/pixelate .work/games/pixelate/js5-cache
rmdir .work/games/pixelate/download
```

For bulk payload mirroring, run the same pattern per game so the normalized
result remains `.work/games/<game>/js5-cache`. Do not leave downloader output
as root-level `.work/js5-*` directories.

For metadata-only discovery, use a game-owned scratch directory and delete it
after extracting the data you need:

```bash
python3 tools/js5/download-caches.py \
  --game pixelate \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/games/pixelate/js5-metadata \
  --metadata-only
```

For an unknown build, scan candidate build numbers by fetching only the master
index and the specific archive index you care about. For music, archive 10 is
the usual first check: parse archive 255 group 10, then compare its group/file
name hashes with strings loaded by the client, such as calls to `tg.a(...)`,
`sc.a(...)`, `ua.a(...)`, or the equivalent song-loader class. A build is
accepted only when the archive shape and names match the client.

Steel Sentinels is the concrete example. The client loads:

```java
tg.a(g.g_i, "", "md_title_music");
tg.a(g.g_i, "", "war_zone");
tg.a(g.g_i, "", "lost_world");
tg.a(g.g_i, "", "cityscape");
tg.a(g.g_i, "", "thats_no_moon");
tg.a(g.g_i, "", "star_fleet");
```

Build 15 handshakes, but archive 10 contains font/UI names such as `login`,
`benefits`, `commonui`, `arialish12`, and `roman20`, so it is the wrong cache
for Steel music. Scanning builds found build 71: archive 10 has one empty-named
group whose file-name hashes resolve to the six client track names, with file
IDs `1`, `3`, `4`, `5`, `6`, and `7`.

The build scan used the same JS5 protocol downloader classes, but stopped after
metadata:

```bash
python3 - <<'PY'
import importlib.util, json

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

dl = load("tools/js5/download-caches.py", "download_caches")
music = load("tools/music/extract-dekobloko-music.py", "music_extract")

game = next(
    g for g in json.load(open(".work/upstream-alterorb-launcher/config.json"))["games"]
    if g["internalName"] == "steelsentinels"
)
targets = {
    music.name_hash(name): name
    for name in [
        "md_title_music",
        "war_zone",
        "lost_world",
        "cityscape",
        "thats_no_moon",
        "star_fleet",
    ]
}

def parse_index_body(raw):
    body = dl.decompress_container(raw)
    buf = music.Buffer(body)
    version = buf.u8()
    if version >= 6:
        buf.u32()
    flags = buf.u8()
    has_names = bool(flags & 1)
    has_whirlpool = bool(flags & 2)
    group_count = buf.large_smart() if version >= 7 else buf.u16()
    group_ids = []
    last = 0
    for _ in range(group_count):
        last += buf.large_smart() if version >= 7 else buf.u16()
        group_ids.append(last)
    group_hashes = {}
    if has_names:
        for group_id in group_ids:
            group_hashes[group_id] = buf.i32()
    for _ in group_ids:
        buf.u32()
    if has_whirlpool:
        for _ in group_ids:
            buf.bytes(64)
    for _ in group_ids:
        buf.u32()
    file_counts = {
        group_id: (buf.large_smart() if version >= 7 else buf.u16())
        for group_id in group_ids
    }
    file_ids = {}
    for group_id in group_ids:
        last = 0
        ids = []
        for _ in range(file_counts[group_id]):
            last += buf.large_smart() if version >= 7 else buf.u16()
            ids.append(last)
        file_ids[group_id] = ids
    file_hashes = {}
    if has_names:
        for group_id in group_ids:
            file_hashes[group_id] = {file_id: buf.i32() for file_id in file_ids[group_id]}
    return group_hashes, file_hashes

for build in range(1, 161):
    try:
        with dl.Js5Client(
            dl.DEFAULT_HOST,
            dl.DEFAULT_PORT,
            game["gamecrc"],
            build,
            dl.DEFAULT_SERVER_NUM,
            dl.DEFAULT_LANG,
            1.2,
        ) as client:
            master = client.fetch(255, 255)[2]
            indexes = dl.parse_master(master)
            if len(indexes) <= 10 or indexes[10]["crc"] == 0:
                continue
            group_hashes, file_hashes = parse_index_body(client.fetch(255, 10)[2])
            hits = []
            for group_id, group_hash in group_hashes.items():
                if group_hash in targets:
                    hits.append(("group", group_id, targets[group_hash]))
                for file_id, file_hash in file_hashes.get(group_id, {}).items():
                    if file_hash in targets:
                        hits.append(("file", group_id, file_id, targets[file_hash]))
            if hits:
                print(build, hits)
    except Exception:
        pass
PY
```

For Steel Sentinels this prints build `71` with the six archive-10 file hits.

Miner Disturbance is another concrete failure mode: build 13 connects and
downloads cleanly, but the indexes do not contain the hashes for
`md_title_music`, `md_menu`, or the other `md_*` strings loaded by the client.
Build 5 is the matching cache: archive 2 holds the named `jd` sound effects,
archive 3 is the second sample archive, archive 4 holds the named `wh` songs,
and archive 5 holds the instrument patches. Redo the local audio cache and WAVs
with:

```bash
rm -rf .work/games/minerdisturbance/js5-cache-audio
python3 tools/js5/download-caches.py \
  --game minerdisturbance \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/minerdisturbance/js5-cache-audio \
  --build 5 \
  --indexes 2,3,4,5 \
  --skip-missing-archives \
  --archive-batch-size 50 \
  --archive-idle-timeout 5 \
  --timeout 30

mkdir -p .work/games/minerdisturbance/music-tools
javac -cp .work/games/minerdisturbance/classes \
  -d .work/games/minerdisturbance/music-tools \
  tools/music/MinerDisturbanceAudioDumper.java

rm -rf .work/games/minerdisturbance/music
java -cp .work/games/minerdisturbance/classes:.work/games/minerdisturbance/music-tools \
  MinerDisturbanceAudioDumper \
  .work/games/minerdisturbance/music \
  .work/games/minerdisturbance/js5-cache-audio/minerdisturbance
```

Expected output is 76 files: 7 repaired `.mid` files under `midi/`, 7 stereo
native-rendered music WAVs under `wav/`, and 62 mono `jd` effect WAVs under
`samples/effects/`.

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

Music output layout per game (`.work/games/<game>/music/`):

```text
midi/<name>.mid          repaired MIDI per rendered music track
wav/<name>.wav           rendered music tracks (the headline audio)
samples/<name>.wav       decoded PCM sample bank assets
samples/effects/<n>.wav  decoded PCM sound effects (when distinguished)
samples/voices/<n>.wav   decoded PCM voice lines (when distinguished)
json/                    extractor JSON (Dekobloko ui descriptors, sample banks)
raw/                     raw JS5 container/payload bytes per archive group
split/                   per-archive split blobs used by the renderers
sfz/   sf2/   native/    optional interchange exports (TetraLink)
wav-funorb/              alternate FunOrb-MIDI renderer output (TetraLink)
```

The audio archive sometimes is not archive 10; e.g. Dungeon Assault renders
from archive 16 and Zombie Dawn from archive 7. The filename inside `midi/` and
`wav/` is the named track from the JS5 hash or client load string, so the
source archive does not need to appear in the path.

Known archive roles:

| Game | Archives | Song class/path |
|---|---|---|
| Dekobloko | 8 synth samples, 9 packvorbis samples, 10 `ui` descriptors | `ui -> ia -> mi -> ei` |
| Brickabrac | 7 `dr` samples, 8 `bk` Vorbis samples, 9 `pq` patches, 10 `vm` songs, 13 labels | `vm -> ie` |
| Pixelate | 7/8 sound banks, 9 `sn` patches, 10 `ua` songs | `ua -> ti` |
| TetraLink | 7/8 `wf` samples, 9 `ng` patches, 10 `ri` songs | `ri -> g/go/ng/fa` |
| Virogrid | 7/8 sound banks, 9 `rc` patches, 10 `sc` songs | `sc -> i/rc/jg` |
| Steel Sentinels | 7/8 sound banks, 9 `ca` patches, 10 `tg` songs | `tg -> ic/ca/ub` |
| Orb Defence | 6/7 sound banks, 8 `ik` patches, 9 `fj` songs | `fj -> lj/ik/vd` |
| Zombie Dawn | 4/5 sound banks, 6 `dj` patches, 7 `wj` songs | `wj -> rj/dj/ka` |
| Zombie Dawn Multi | 4/5 sound banks, 6 `ul` patches, 7 `ug` songs | `ug -> gd/ul/me` |
| Dungeon Assault | 13/14 `va` samples, 15 `kk` patches, 16 `vh` songs | `vh -> ug/tc`, samples via `lc -> va` |

Archive 10 names must come from JS5 file-name hashes or client load strings, not
from split position. Dekobloko build 31/32, for example, maps sparse file IDs to
names such as `music/Deko Bloko Titlescreen`; Pixelate build 55 maps
`pix_title`, `pix_end_game`, and `skin1` through `skin16`. This is why files
named only `track_XX` are suspect.

Raw client MIDI bytes are also suspect. Several FunOrb song classes build
mostly-standard MIDI but omit the `0xff` byte in end-of-track events, leaving
track tails as `delta, 2f 00` instead of `delta, ff 2f 00`. The Unix `file`
command can still identify these as Standard MIDI, so validate exported `.mid`
files with a real parser such as Java's `MidiSystem.getSequence(...)`. The
renderers that write MIDI should pass client bytes through `repairMidi(...)`
before writing them.

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
  .work/games/dekobloko/js5-cache \
  .work/games/dekobloko/music \
  --game dekobloko

javac -cp classes-original -d .work/games/dekobloko/music-tools \
  tools/music/MusicSampleDecoder.java \
  tools/music/MusicUiJsonDumper.java \
  tools/music/MusicTrackRenderer.java \
  tools/music/MusicSampleBankExporter.java

java -cp .work/games/dekobloko/music-tools:classes-original MusicUiJsonDumper .work/games/dekobloko/music
java -cp .work/games/dekobloko/music-tools:classes-original MusicTrackRenderer .work/games/dekobloko/music
java -cp .work/games/dekobloko/music-tools:classes-original MusicSampleBankExporter .work/games/dekobloko/music
```

```bash
python3 tools/music/extract-dekobloko-music.py \
  .work/games/brickabrac/download-build65-full/brickabrac \
  .work/games/brickabrac/music \
  --game brickabrac

javac -cp .work/games/brickabrac/classes -d .work/games/brickabrac/music-tools \
  tools/music/BrickabracMusicDumper.java \
  tools/music/BrickabracNativeMusicRenderer.java

java -cp .work/games/brickabrac/music-tools:.work/games/brickabrac/classes \
  BrickabracMusicDumper .work/games/brickabrac/music
java -cp .work/games/brickabrac/music-tools:.work/games/brickabrac/classes \
  BrickabracNativeMusicRenderer .work/games/brickabrac/music \
  .work/games/brickabrac/download-build65-full/brickabrac
```

Brickabrac is the odd case here: the warmed cache that contains archive 10 may
not contain enough archive-255 metadata to recover the archive-10 file-name
hashes. The extractor therefore uses the decompiled client load strings
(`BaB_panic`, `BaB_desert`, ..., `BAB_ninja`) when archive 10 splits into the
known 16-track shape, instead of emitting anonymous `brickabrac_track_NN` names.

For the native-MIDI family, prefer the generic generator. It owns the repeated
cache adapter, MIDI repair, `MidiSystem` validation, render loop, and WAV
writer, then compiles a small game-specific adapter against the target classes.
The adapter still uses profile data because obfuscated class names and archive
backend superclasses differ by game.

Use `tools/music/profile-funorb-music.py` to draft those profiles from CFR Java
instead of writing them by hand. The profiler scans known native-MIDI loader
families, follows wrapper methods such as `tl.a("track", ...) -> wj.a(...)`,
traces the archive expression used by the loader, validates candidate track
names against JS5 name hashes, and writes a JSON profile that
`render-funorb-native.py --profile-file` can run:

```bash
python3 tools/music/profile-funorb-music.py \
  --game zombiedawn \
  --java .work/games/zombiedawn/cfr \
  --classes .work/games/zombiedawn/classes \
  --cache .work/games/zombiedawn/js5-cache \
  --out .work/games/zombiedawn/music-profile/zombiedawn.json

python3 tools/music/render-funorb-native.py \
  --profile-file .work/games/zombiedawn/music-profile/zombiedawn.json \
  --classes .work/games/zombiedawn/classes \
  --cache .work/games/zombiedawn/js5-cache \
  --out .work/games/zombiedawn/music
```

The generated profile records `_discovery` evidence: selected renderer family,
loader class, source files, inferred archive IDs, candidate archive-name scores,
and final song-archive scores. Treat a profile as accepted only after the
generated renderer compiles and renders at least one track; `--validate` runs
that compile/render step directly.

Supported profiles currently cover the normalized native renderers for
Pixelate, Virogrid, Steel Sentinels, Orb Defence, Zombie Dawn, and Zombie Dawn
Multi:

```bash
python3 tools/music/render-funorb-native.py \
  --game pixelate \
  --classes .work/games/pixelate/classes \
  --cache .work/games/pixelate/js5-cache \
  --out .work/games/pixelate/music

python3 tools/music/render-funorb-native.py \
  --game virogrid \
  --classes .work/games/virogrid/classes \
  --cache .work/games/virogrid/js5-cache \
  --out .work/games/virogrid/music

python3 tools/music/render-funorb-native.py \
  --game steelsentinels \
  --classes .work/games/steelsentinels/regression-tailgate-out \
  --cache .work/games/steelsentinels/js5-cache \
  --out .work/games/steelsentinels/music

python3 tools/music/render-funorb-native.py \
  --game orbdefence \
  --classes .work/games/orbdefence/deob-safe/out \
  --cache .work/games/orbdefence/js5-cache \
  --out .work/games/orbdefence/music

python3 tools/music/render-funorb-native.py \
  --game zombiedawn \
  --classes .work/games/zombiedawn/classes \
  --cache .work/games/zombiedawn/js5-cache \
  --out .work/games/zombiedawn/music

python3 tools/music/render-funorb-native.py \
  --game zombiedawnmulti \
  --classes .work/games/zombiedawnmulti/classes \
  --cache .work/games/zombiedawnmulti/js5-cache \
  --out .work/games/zombiedawnmulti/music
```

The same tool can scan every game directory and render the profiles that match
the current cache and class API:

```bash
python3 tools/music/render-funorb-native.py --all --root .work/games
```

This is intentionally conservative. It only treats archive 10 group `0` names
that also appear in the class constant pool as candidate tracks, then requires
the generated adapter to compile and run against the target classes. With the
current cache set, the native-MIDI family renders:

| Game | Profile |
|---|---|
| `orbdefence` | `orbdefence` |
| `pixelate` | `pixelate` |
| `steelsentinels` | `steelsentinels` |
| `virogrid` | `virogrid` |
| `zombiedawn` | `zombiedawn` |
| `zombiedawnmulti` | `zombiedawnmulti` |

For archive-10 profiles, auto-discovery only treats archive 10 group `0` names
that also appear in the class constant pool as candidate tracks. Orb Defence is
an older shape: CFR source shows `lg.lg_c = qk.a(9, ...)`, then fourteen
`fj.a(lg.lg_c, "", name)` loads. Build 60 is accepted because archive 9 group
0 resolves those fourteen file-name hashes. The offline renderer uses a larger
instrument hydration budget than the game's per-frame `176400` budget so the
native `lj` player can hydrate all patches in one pass.

Most other games either have no matching music group in the current cache, or
their candidate archive names are UI/font assets such as `arezzo14`, `chatfont`,
or `smallfont`. Those are reported as unsupported rather than rendered.
Dekobloko, Brickabrac, and TetraLink still use their dedicated
extractor/preprocessor paths below because their formats are not this direct
native-MIDI profile.

Arcanists Multi is a dedicated `ha -> gh` path. The client initializes archive
2 and 3 sample banks through `gi`, archive 4 patches, and archive 5 `ha` songs.
Build 19 is required for the named song hashes; build 15 handshakes but
does not expose the matching archive-5 layout.

```bash
python3 tools/js5/download-caches.py \
  --game arcanistsmulti \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/arcanistsmulti/js5-cache-build19 \
  --build 19 \
  --indexes 2,3,4,5

javac -cp .work/games/arcanistsmulti/classes \
  -d .work/games/arcanistsmulti/music-tools \
  tools/music/ArcanistsMultiNativeMusicRenderer.java

java -cp .work/games/arcanistsmulti/classes:.work/games/arcanistsmulti/music-tools \
  ArcanistsMultiNativeMusicRenderer \
  .work/games/arcanistsmulti/js5-cache-build19/arcanistsmulti \
  .work/games/arcanistsmulti/music
```

Crazy Crystals uses the native `rm -> wg` music path. The client loads `menu`
plus the 10 `hf.b` tracks from archive 3, hydrates patches from archive 8, and
uses `bn(archive2, archive4)` for the generated and Vorbis sample banks. Build
14 contains the sample-effect layout used by the older dumper, but build 15 is
the matching cache for the named music groups.

```bash
python3 tools/js5/download-caches.py \
  --game crazycrystals \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/crazycrystals/js5-cache-build15 \
  --build 15 \
  --indexes 2,3,4,8

javac -cp .work/games/crazycrystals/classes \
  -d .work/games/crazycrystals/music-tools \
  tools/music/CrazyCrystalsNativeMusicRenderer.java

java -cp .work/games/crazycrystals/classes:.work/games/crazycrystals/music-tools \
  CrazyCrystalsNativeMusicRenderer \
  .work/games/crazycrystals/js5-cache-build15/crazycrystals \
  .work/games/crazycrystals/music
```

Bachelor Fridge uses the native `kia -> jp` music path. The client wires archive
10 as songs, archive 9 as patches, and archives 7/8 as the two sample banks via
`i(archive7, archive8)`. Build 21 handshakes, but that master omits archives 8
and 9; build 70 contains the file-name hashes for all 11 `bf_*` tracks loaded by
the game.

```bash
python3 tools/js5/download-caches.py \
  --game bachelorfridge \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/bachelorfridge/js5-cache-build70 \
  --build 70 \
  --indexes 7,8,9,10

javac -cp .work/games/bachelorfridge/classes \
  -d .work/games/bachelorfridge/music-tools \
  tools/music/BachelorFridgeNativeMusicRenderer.java

java -cp .work/games/bachelorfridge/classes:.work/games/bachelorfridge/music-tools \
  BachelorFridgeNativeMusicRenderer \
  .work/games/bachelorfridge/js5-cache-build70/bachelorfridge \
  .work/games/bachelorfridge/music
```

Tomb Racer uses the native `qua -> l` music path. The deobfuscated client loads
`TR_theme`, `TR_temple_music`, `TR_win_jingle_long`, and
`TR_lose_jingle_long` from archive 29, uses archive 28 for patches, and hydrates
samples through `nda(archive26, archive27)`. The launcher build table currently
lists build 31, but that master does not contain the 26-29 indexes used by this
gamepack; build 81 matches the deobfuscated loader layout.

```bash
python3 tools/js5/download-caches.py \
  --game tombracer \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/tombracer/js5-cache-build81 \
  --build 81 \
  --indexes 26-29

javac -cp .work/games/tombracer/classes \
  -d .work/games/tombracer/music-tools \
  tools/music/TombRacerNativeMusicRenderer.java

java -cp .work/games/tombracer/classes:.work/games/tombracer/music-tools \
  TombRacerNativeMusicRenderer \
  .work/games/tombracer/js5-cache-build81/tombracer \
  .work/games/tombracer/music
```

Geoblox uses the native `rf -> kj` MIDI path with archives 2/3 as sample banks,
archive 4 as patches, and archive 5 as songs. Build 1 is the matching cache for
the four named tracks in this gamepack.

```bash
python3 tools/js5/download-caches.py \
  --game geoblox \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/geoblox/js5-cache-build1 \
  --build 1 \
  --indexes 2,3,4,5

javac -cp .work/games/geoblox/classes \
  -d .work/games/geoblox/music-tools \
  tools/music/GeobloxAudioDumper.java

java -cp .work/games/geoblox/classes:.work/games/geoblox/music-tools \
  GeobloxAudioDumper \
  .work/games/geoblox/js5-cache-build1/geoblox \
  .work/games/geoblox/music
```

Torquing uses a source-audio path rather than native MIDI. Build 11 exposes the
archive-4 music names loaded by the client; archives 5 and 6 provide the Vorbis
and synth sample data.

```bash
python3 tools/js5/download-caches.py \
  --game torquing \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/torquing/js5-cache-build11 \
  --build 11 \
  --indexes 4,5,6

javac -cp .work/games/torquing/classes \
  -d .work/games/torquing/music-tools \
  tools/music/TorquingAudioDumper.java

java -cp .work/games/torquing/classes:.work/games/torquing/music-tools \
  TorquingAudioDumper \
  .work/games/torquing/music \
  .work/games/torquing/js5-cache-build11/torquing
```

36 Card Trick uses a source-audio path. Build 7 exposes the named archive-4
music table and archives 2/3 provide the synth and Vorbis sample data.

```bash
python3 tools/js5/download-caches.py \
  --game 36cardtrick \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/36cardtrick/js5-cache-build7 \
  --build 7 \
  --indexes 2,3,4 \
  --skip-missing-archives

javac -cp .work/games/36cardtrick/classes \
  -d .work/games/36cardtrick/music-tools \
  tools/music/CardTrick36AudioRenderer.java

java -cp .work/games/36cardtrick/classes:.work/games/36cardtrick/music-tools \
  CardTrick36AudioRenderer \
  .work/games/36cardtrick/js5-cache-build7/36cardtrick \
  .work/games/36cardtrick/music
```

Hold the Line uses the native `vi -> kf` MIDI path. Build 8 matches the
gamepack's song table, but the current mirror only returns three of the seven
named song groups; the renderer logs the missing groups and renders the
available `title`, `victory_jingle`, and `classic` tracks.

```bash
python3 tools/js5/download-caches.py \
  --game holdtheline \
  --config .work/upstream-alterorb-launcher/config.json \
  --output .work/games/holdtheline/js5-cache-build8 \
  --build 8 \
  --indexes 5,6,7,8 \
  --skip-missing-archives

javac -cp .work/games/holdtheline/classes \
  -d .work/games/holdtheline/music-tools \
  tools/music/HoldTheLineNativeMusicRenderer.java

java -cp .work/games/holdtheline/classes:.work/games/holdtheline/music-tools \
  HoldTheLineNativeMusicRenderer \
  .work/games/holdtheline/js5-cache-build8/holdtheline \
  .work/games/holdtheline/music-native
```

Pool uses the native `cg -> vk` MIDI path rather than the generic archive-10
profile. Deobfuscated CFR source shows the client loading `title`,
`title_next_door`, `pool_modern`, `pool_jungle`, `pool_plasma`, `pool_polar`,
`pool_space`, and the associated win/lose jingles through `cg.a(...)`.
The renderer below follows the client setup: archives 8 and 9 feed `cf`, archive
10 is the instrument archive passed to `vk.a(...)`, and archive 11 holds the
`cg` tracks.

The current validated build 20 handshakes, but the protocol mirror has not yet
produced the complete audio cache: archive 11 only returned group 21 locally and
archive 10 was absent from the master table. The renderer is kept as the client
path to use once a warmed or corrected Pool cache includes archives 10 and 11.

```bash
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/games/pool/classes \
  .work/games/pool/deob-profile/out \
  --profile none \
  --runtime-safe

java -jar /home/kreijstal/git/java-tools/lib/cfr.jar \
  .work/games/pool/deob-profile/out/*.class \
  --outputdir .work/games/pool/deob-profile/cfr

javac -cp .work/games/pool/classes \
  -d .work/games/pool/music-tools \
  tools/music/PoolNativeMusicRenderer.java

java -cp .work/games/pool/classes:.work/games/pool/music-tools \
  PoolNativeMusicRenderer \
  .work/games/pool/js5-cache/pool \
  .work/games/pool/music
```

Dungeon Assault is another dedicated path. CFR source shows `bo` initializing
archives 13, 14, 15, and 16; `mi` loads nine `vh` songs from archive 16 by
name (`da_title3`, `da_intro`, `da_ingame_battle`, and the other `da_*`
tracks), and `vh` converts the compact song format into MIDI bytes in
`vh_i`. Those MIDI bytes need the same end-of-track repair as other FunOrb
MIDI exports. Offline WAV rendering can use the client's own `ug/tc` mixer
after hydrating `kk` patches from archive 15 against `lc(archive13, archive14)`.
Archives 13 and 14 also contain standalone `va` sample assets such as
`menu_select`, `da_menu_fire`, the ambience loops, and the nine numbered
Dungaria assets; those can be written directly as PCM WAVs.

```bash
javac -cp .work/games/dungeonassault/music-profile-validate/out \
  -d .work/games/dungeonassault/music-tools \
  tools/music/DungeonAssaultAudioDumper.java

java -cp .work/games/dungeonassault/music-tools:.work/games/dungeonassault/music-profile-validate/out \
  DungeonAssaultAudioDumper \
  .work/games/dungeonassault/js5-cache \
  .work/games/dungeonassault/music
```

Zombie Dawn is an older native-MIDI profile where the song archive is 7, not
10. The single-player client uses build 41 and loads fourteen `wj` songs through
`wj.a(archive7, name, "")`; the multiplayer client uses build 72 and loads
eleven `ug` songs through `ug.a(archive7, "", name)`. Both use archives 4 and 5
as sample banks and archive 6 as patch/instrument data. The single-player
renderer initializes `qf` with stereo enabled, so generated offline renderers
must allocate `BUFFER_SAMPLES * 2` mix slots and write a stereo WAV header even
though most newer profiles are mono. A mono-sized buffer fails inside the native
`rj` mixer with an array-bounds error.

Pixelate renders directly from its build-55 JS5 cache through deobfuscated
classes. Its local cache must include archive 10 from build 55; an incomplete
cache can still leave stale old MIDI files on disk. `PixelateNativeMusicRenderer`
repairs `ua.k` before writing `.mid` files because the raw bytes have the same
missing end-of-track marker shape as Virogrid, TetraLink, Brickabrac, and Steel
Sentinels.

```bash
python3 tools/js5/download-caches.py \
  --game pixelate \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/games/pixelate/download \
  --skip-missing-archives \
  --archive-workers 8
rm -rf .work/games/pixelate/js5-cache
mv .work/games/pixelate/download/pixelate .work/games/pixelate/js5-cache
rmdir .work/games/pixelate/download

javac -cp .work/games/pixelate/classes -d .work/games/pixelate/music-tools \
  tools/music/PixelateNativeMusicRenderer.java

java -cp .work/games/pixelate/music-tools:.work/games/pixelate/classes \
  PixelateNativeMusicRenderer \
  .work/games/pixelate/music \
  .work/games/pixelate/js5-cache

cat > .work/games/pixelate/music-tools/ValidateMidi.java <<'EOF'
import java.io.File;
import javax.sound.midi.MidiSystem;

public final class ValidateMidi {
    public static void main(String[] args) throws Exception {
        for (String arg : args) {
            MidiSystem.getSequence(new File(arg));
            System.out.println("ok " + arg);
        }
    }
}
EOF
javac -d .work/games/pixelate/music-tools .work/games/pixelate/music-tools/ValidateMidi.java
java -cp .work/games/pixelate/music-tools ValidateMidi \
  .work/games/pixelate/music/midi/*.mid
```

Virogrid uses the TetraLink-style archive layout, but its working cache is
build 77:

```bash
python3 tools/music/extract-dekobloko-music.py \
  .work/games/virogrid/js5-cache \
  .work/games/virogrid/music \
  --game virogrid

javac -cp .work/games/virogrid/deob-profile/out -d .work/games/virogrid/music-tools \
  tools/music/VirogridNativeMusicRenderer.java

java -cp .work/games/virogrid/music-tools:.work/games/virogrid/deob-profile/out \
  VirogridNativeMusicRenderer \
  .work/games/virogrid/music \
  .work/games/virogrid/js5-cache
```

Expected Virogrid native render output is four repaired MIDI files under
`.work/games/virogrid/music/midi/` and four WAVs under
`.work/games/virogrid/music/wav/`:

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

Steel Sentinels uses the same native-client rendering pattern, but its usable
music cache is build 71. Build 15 still handshakes and downloads, but archive
10 there is a font/UI layout and does not contain the client load strings
`md_title_music`, `war_zone`, `lost_world`, `cityscape`, `thats_no_moon`, or
`star_fleet`.

```bash
python3 tools/js5/download-caches.py \
  --game steelsentinels \
  --builds tools/js5/js5-builds-validated.json \
  --output .work/games/steelsentinels/download \
  --skip-missing-archives \
  --archive-workers 8
rm -rf .work/games/steelsentinels/js5-cache
mv .work/games/steelsentinels/download/steelsentinels .work/games/steelsentinels/js5-cache
rmdir .work/games/steelsentinels/download

javac -cp .work/games/steelsentinels/regression-tailgate-out \
  -d .work/games/steelsentinels/music-tools \
  tools/music/SteelSentinelsNativeMusicRenderer.java

java -cp .work/games/steelsentinels/music-tools:.work/games/steelsentinels/regression-tailgate-out \
  SteelSentinelsNativeMusicRenderer \
  .work/games/steelsentinels/music \
  .work/games/steelsentinels/js5-cache
```

TetraLink has the richest export path:

```bash
javac -cp .work/games/tetralink/classes -d .work/games/tetralink/music-tools \
  tools/music/TetraLinkMusicPreprocessor.java \
  tools/music/TetraLinkSfzExporter.java \
  tools/music/TetraLinkSf2Exporter.java \
  tools/music/TetraLinkNativeBankExporter.java \
  tools/music/TetraLinkFunOrbMidiRenderer.java

java -cp .work/games/tetralink/music-tools:.work/games/tetralink/classes \
  TetraLinkMusicPreprocessor .work/games/tetralink/music
java -cp .work/games/tetralink/music-tools:.work/games/tetralink/classes \
  TetraLinkSfzExporter .work/games/tetralink/music
java -cp .work/games/tetralink/music-tools:.work/games/tetralink/classes \
  TetraLinkSf2Exporter .work/games/tetralink/music
java -cp .work/games/tetralink/music-tools:.work/games/tetralink/classes \
  TetraLinkNativeBankExporter .work/games/tetralink/music
java -cp .work/games/tetralink/music-tools:.work/games/tetralink/classes \
  TetraLinkFunOrbMidiRenderer .work/games/tetralink/music
```

### Editable Formats

SFZ and SF2 are interchange formats, not byte-exact FunOrb renderers. SFZ keeps
sample choice, key mapping, loop points, pitch offset, per-note volume, pan, and
exclusive-class hints. SF2 is compact and DAW-friendly, with one preset per
archive-9 patch and the percussion patch at bank 128 program 0. Both lose some
native mixer behavior.

The native LV2 route is closer to the client: `TetraLinkNativeBankExporter`
writes `.work/games/tetralink/music/native/funorb_tetralink.fobank`, and
`tools/lv2/build-funorb-native-lv2.sh` builds `.work/games/dekobloko/lv2/funorb-native.lv2`.
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
mkdir -p .work/games/dekobloko/mixer-pipeline/in .work/games/dekobloko/mixer-pipeline/out .work/games/dekobloko/mixer-pipeline/tmp
cp classes-original/{ei,ia,mi,ui,ud,va,bi,en}.class .work/games/dekobloko/mixer-pipeline/in/

TMPDIR=$PWD/.work/games/dekobloko/mixer-pipeline/tmp \
JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/games/dekobloko/mixer-pipeline/in \
  .work/games/dekobloko/mixer-pipeline/out

java -jar lib/cfr.jar \
  --outputdir .work/games/dekobloko/mixer-pipeline/cfr \
  .work/games/dekobloko/mixer-pipeline/out/ei.class \
  .work/games/dekobloko/mixer-pipeline/out/ia.class \
  .work/games/dekobloko/mixer-pipeline/out/mi.class
```

With the current transforms, `ei.b(int[], int, int)` decompiles cleanly. The
old raw `src/ei.java` copy predates those transforms and still contains a CFR
failure stub.

## Build

```bash
./scripts/launcher/build.sh
```

This builds `.work/games/dekobloko/launcher/dekobloko-launcher.jar` from
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

Some gamepacks open Java Sound through ALSA. On systems where plain ALSA maps to
hardware, that bypasses PipeWire and can either produce no mixed desktop audio
or lock `/dev/snd/pcm*` directly. Force the ALSA PipeWire plugin explicitly when
launching these clients:

```bash
mkdir -p .work/alsa
printf '%s\n' \
  '@hooks [' \
  '  {' \
  '    func load' \
  '    files [' \
  '      "/usr/share/alsa/alsa.conf"' \
  '      "/usr/share/alsa/alsa.conf.d/50-pipewire.conf"' \
  '      "/usr/share/alsa/alsa.conf.d/99-pipewire-default.conf"' \
  '    ]' \
  '    errors false' \
  '  }' \
  ']' > .work/alsa/pipewire-java.conf

DISPLAY=:10.0 ALSA_CONFIG_PATH="$PWD/.work/alsa/pipewire-java.conf" \
  java -Djava.awt.headless=false -jar .work/launcher/dekobloko-launcher.jar \
    --awt real \
    --gamepack .work/games/minerdisturbance/gamepack.jar \
    --main-class MinerDisturbance \
    --gamecrc 1412183595 \
    --server https://mgg-server.alterorb.net \
    --trace-file .work/games/minerdisturbance/logs/real-awt-pipewire.trace
```

Verify that the process is using PipeWire rather than direct ALSA hardware:

```bash
pid=<java-pid>
ls -l /proc/$pid/fd | grep -E 'snd|pipewire|pcm' || true
grep -E 'pipewire|libasound_module_pcm_pipewire|/dev/snd' /proc/$pid/maps || true
pactl list sink-inputs short
```

A direct-ALSA launch shows open fds such as `/dev/snd/pcmC0D0p`,
`/dev/snd/controlC0`, and `/dev/snd/timer`. A PipeWire-routed launch loads
`libasound_module_pcm_pipewire.so`, has `pipewire-memfd` fds, and appears in
`pactl list sink-inputs`.

Record real AWT interaction:

```bash
./scripts/launcher/run-record-awt.sh .work/games/dekobloko/traces/interaction.awtlog
```

Replay interaction through fake AWT:

```bash
./scripts/launcher/run-replay-awt.sh .work/games/dekobloko/traces/interaction.awtlog
```

Replay accepts launcher args, for example:

```bash
./scripts/launcher/run-replay-awt.sh .work/games/dekobloko/traces/interaction.awtlog --replay-speed 4
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
  .work/games/virogrid/classes \
  .work/games/virogrid/deob-profile/out \
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
rm -rf .work/games/steelsentinels/deob-safe
mkdir -p \
  .work/games/steelsentinels/deob-safe/classes \
  .work/games/steelsentinels/deob-safe/out \
  .work/games/steelsentinels/deob-safe/cfr \
  .work/games/steelsentinels/deob-safe/logs

(cd .work/games/steelsentinels/deob-safe/classes && \
  jar xf ../../gamepacks/steelsentinels.jar)

JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  .work/games/steelsentinels/deob-safe/classes \
  .work/games/steelsentinels/deob-safe/out \
  --profile none \
  --safe-bytecode
```

Verifier check:

```bash
javac -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  -d .work/games/steelsentinels/verify-tools \
  scripts/Verify.java

java -cp .work/games/steelsentinels/verify-tools:/home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  Verify .work/games/steelsentinels/deob-safe/out/*.class
```

CFR marker scan:

```bash
java -jar lib/cfr.jar \
  .work/games/steelsentinels/deob-safe/out/*.class \
  --outputdir .work/games/steelsentinels/deob-safe/cfr

rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' \
  .work/games/steelsentinels/deob-safe/cfr \
  > .work/games/steelsentinels/deob-safe/logs/cfr-markers.txt
```

Steel Sentinels baseline:

| Metric | Result |
|---|---:|
| Input classes | 347 |
| Pipeline passthrough failures | 0 |
| ASM `BasicVerifier` failures | 0 methods / 0 classes |
| CFR Java files emitted | 347 |
| CFR structure marker lines | 0 |
| CFR classes with markers | 0 |
| CFR-source javac | 314/347 |

Steel Sentinels marker classes:

```text
(none)
```

The former `ao` marker was a protected-entry bridge: an unprotected
`aload_0; goto join` duplicated the first load of a protected retry block.
`peephole-clean` now rewrites that bridge to jump to the protected copy of the
same load, so the stack shape is unchanged while CFR sees a single entry.

The former `hb` marker was a javac-shaped labeled-block loop where a
stack-neutral conditional fallthrough jumped to a shared forward loop entry.
`peephole-clean` now clones the bounded loop-entry range only when the
conditional/goto block is stack-neutral, the shared entry has exactly two
instruction references, and there is no fallthrough predecessor.

The former `nb` marker was a duplicated loop-tail update before a `continue`.
The duplicated suffix (`mask <<= k; ++index; goto loopHead`) matched a later
canonical loop tail. `peephole-clean` now coalesces only such suffixes when they
are immediately after a conditional, contain an `iinc`, and exactly match a
later tail that jumps to the same loop head.

The per-class javac failures are still source-shape/type-pollution work, not
bytecode verifier failures. The most common categories at this baseline are
ambiguous short-name references, constructor/super placement, residual CFR
structure (`illegal start of expression`), and object/array type pollution.

#### Transform Catalog

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels, protected load-bridge coalescing, stack-neutral shared forward loop-entry cloning, duplicate loop-tail suffix coalescing, constructor-only `if body; goto exit; body:` inversion, and constructor-only unreachable dead-handler tail cleanup. |
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
rm -rf .work/games/dekobloko/roundtrip
mkdir -p .work/games/dekobloko/roundtrip/out .work/games/dekobloko/roundtrip/cfr

JAVA_TOOLS_DIR=/home/kreijstal/git/java-tools \
node scripts/pipeline/bulk-pipeline.js \
  classes-original \
  .work/games/dekobloko/roundtrip/out \
  --profile dekobloko
```

Decompile that output with CFR and scan for structure markers:

```bash
java -jar lib/cfr.jar \
  .work/games/dekobloko/roundtrip/out/*.class \
  --outputdir .work/games/dekobloko/roundtrip/cfr

rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' \
  .work/games/dekobloko/roundtrip/cfr
```

An empty `rg` result is expected.

Batch verifier check for the transformed class files:

```bash
javac -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar \
  -d scripts \
  scripts/Verify.java

java -cp /home/kreijstal/git/java-tools/lib/asm-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-tree-9.9.1.jar:/home/kreijstal/git/java-tools/lib/asm-analysis-9.9.1.jar:scripts \
  Verify .work/games/dekobloko/roundtrip/out/*.class
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
  .work/games/dekobloko/roundtrip/out/client.class \
  --out .work/games/dekobloko/roundtrip/client.j
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
Trace OK: .../.work/games/dekobloko/traces/headless-init.log
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

Steel Sentinels baseline:

| Stage | Markers | Classes with markers |
|---|---|---|
| `--profile none --safe-bytecode` | **0** | **0** |

Vertigo2 baseline with the same generic safe pipeline is verifier-clean but not
yet marker-clean:

| Stage | Marker lines | Classes with markers |
|---|---:|---|
| `--profile none --safe-bytecode` | 8 | `bh`, `pm`, `up` |

The former `pq` marker was a conditional forward jump into a loop preheader
that also had a fallthrough clamp entry. The bytecode rewrite that CFR accepts
clones the loop for the forward conditional path, leaves a guard `goto` so the
clamp fallthrough still reaches the original loop, and retargets only the
conditional branch to the clone. The java-tools implementation is shape-based:
it requires a forward conditional loop entry, a fallthrough predecessor at the
loop label, a skip-to-exit branch in the fallthrough region, stack-neutral
region analysis, no protected exception labels, and no unrelated external
branch entries into the cloned loop.

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
  --trace-file .work/games/dekobloko/traces/headless.log \
  --gamepack /path/to/patched.jar

node apps/launcher/assert-trace.js .work/games/dekobloko/traces/headless.log
```

The quick class-only experiment jars can reach `error_game_crash` under this
harness. Compare against a known baseline before treating that as a regression.
The harness is strongest when the patched jar preserves the same packaging shape
as the original gamepack.
