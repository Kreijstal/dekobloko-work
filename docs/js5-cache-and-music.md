# JS5 cache, protocol and music tooling

Cache acquisition, the JS5 protocol notes, the music model, and every
per-game music command. Moved out of README.md unchanged.

Source: previously README.md lines 397-1480; the text below is
unchanged apart from this header.

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
| `vertigo2` | 20 | 33 decoded sample WAVs extracted. The deobfuscated client loads named archive-10 songs (`vertigo2_theme`, `vertigo2_level_1`/`2`/`3`, and jingles) with archive 7/8 samples and archive 9 patches. If a local cache has no music, the mirror is incomplete rather than the game lacking a soundtrack. |
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
as root-level `.work/js5-*` directories. When using `--skip-missing-archives`,
keep the downloader retries enabled so a temporarily idle mirror does not leave
holes such as a missing music index in an otherwise usable cache.

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

For a playback-focused PCM diagnostic without the D3 dependency, prepare its
local data (the first argument may point at any complete Dekobloko cache):

```bash
# Defaults to ~/.alterorb/caches/dekobloko and .work/music/dekobloko.
python3 tools/music/extract-dekobloko-music.py

mkdir -p .work/music/dekobloko-tools
javac -cp classes-original -d .work/music/dekobloko-tools \
  tools/music/MusicSampleDecoder.java \
  tools/music/MusicUiJsonDumper.java \
  tools/music/MusicSampleBankExporter.java

java -cp .work/music/dekobloko-tools:classes-original \
  MusicUiJsonDumper .work/music/dekobloko
java -cp .work/music/dekobloko-tools:classes-original \
  MusicSampleBankExporter .work/music/dekobloko
```

Then start:

```bash
node scripts/serve-audio-diagnostics.js
```

Open `http://127.0.0.1:8775/audio-diagnostics/`. The page exposes every
extracted soundtrack track and records PCM synthesis time, audio duration,
real-time factor, event-loop stalls, WebAudio buffer-copy time, peak/RMS, and a
stable checksum. Rendering uses a Web Worker by default; switching to
`Main thread` measures the same JavaScript mixer while it competes with browser
animation and input.

`Play track through Java` and `Play all through Java` execute the recovered
FunOrb mixer inside the browser guest JVM. The browser loads the untouched
`dekobloko.jar` plus a separate, small `JavaFunOrbTrackPlayer` driver JAR, while
the browser virtual filesystem supplies the selected raw `ui` descriptor plus
a decoded `ud` sample bank.
Guest `ui` parses the track, `ia`/`mi`/`ei` synthesize every 512-frame chunk,
and guest Java converts it to PCM16 and calls `SourceDataLine.write`. There is
no host-rendered WAV or synthetic two-second playback button.

The panel reports guest mixer CPU, PCM conversion, bridge-write time,
backpressure wait, event-loop stalls, and WebAudio underruns separately. Stop
sets a guest static safe-point flag, so a multi-minute track ends cleanly after
the short queued tail. The server records SHA-256 values for `dekobloko.jar`,
the mixer source, sample bank, generated driver JAR, JVM bundle, and WebAudio
bridge. The Worker/main selector and `Render only` remain as the pure-JavaScript
comparison.

Completed, stopped, and failed guest-mixer runs are appended to
`.work/telemetry/audio-diagnostics.jsonl`. The latest 20 records are available
from `/api/audio-diagnostics/latest`, including the timing breakdown, underruns,
browser identity, and exact artifact hashes. While playback is active, a
progress record is sent every five seconds.

The guest driver records every 512-frame chunk without retaining PCM: phase
maxima, warmup and steady averages, the 23.22 ms deadline-miss count and
longest streak, and a latency histogram. JVM.js additionally samples scheduler
ownership at 1/16 execution slices and generated-method inclusive time at
1/128 entries. These rates can be changed with `schedulerSampleRate` and
`jitSampleRate`; `?profile=0` keeps chunk timing but disables both JVM samplers
for observer-overhead comparisons.

`java-tools/benchmarks/JavaPcmPushDiagnostic.java` remains available as a
standalone synthetic bridge microbenchmark, but the integrated soundtrack page
does not use it.

`FUNORB_AUDIO_DATA`, `JAVA_TOOLS_DIR`, `AUDIO_DIAGNOSTICS_HOST`, and
`AUDIO_DIAGNOSTICS_PORT` override the generated-data directory, sibling
java-tools checkout, bind address, and port. Extracted sample data and the
generated diagnostic JAR remain under `.work/` and are not committed.

To run the identical guest mixer and track as an unpaced Node throughput
benchmark:

```bash
node scripts/benchmark-guest-mixer-node.js
```

The JSON result records both repository revisions and dirty states, relevant
`JVM_*` gates, Node/V8 versions, every input SHA-256, phase timings, deadline
misses, and execution-tier counters. `--tier alternate` selects the alternate
generated tier, while `--tier interpreter --stop-after-ms 12000` gives a
bounded interpreter control. `--profile-timings` enables the same 1/128
generated-method and 1/16 scheduler sampling used by the browser diagnostic;
`--profile-methods` is a separate intrusive control that disables some
inlining and should not be used for production comparisons.
`--structured-ssa off` retains the baseline generated tier for a same-process
differential against the default verified primitive-array-loop policy. Node
uses the JVM's non-blocking mock
`SourceDataLine`, so this isolates guest compute and bridge conversion rather
than real-time browser scheduling or WebAudio backpressure.

The browser page accepts the matching `?structuredSsa=off` differential;
`?structuredSsa=on` enables the broader experimental tier, while omitting the
parameter uses the default verified primitive-array-loop policy. The selected
mode is included in submitted telemetry.
`?inlineLoops=off` independently disables embedded primitive-array regions;
`?inlineLoops=on` explicitly enables them. They are enabled by default. The
profile reports region-entry and interpreter-OSR counts so a result can prove
that every measured chunk reached optimized code.

For low-overhead Firefox attribution, select one generated root with its JVM
identity and disable the sampled profilers:

```text
/audio-diagnostics/?profile=0&exclusiveRoot=mi.b(%5BIII)V
```

This is a diagnostic selector, not an optimizer allowlist. Outside the selected
subtree the JIT does not read the clock or format method keys. Inside it, exact
entry/exit timing subtracts generated children and reports both self and
inclusive time plus parent/child edges. Compare the steady chunk average with
an unprofiled `?profile=0` run to quantify observer overhead. Browser telemetry
also records the JVM bundle and input hashes, both repository commit/tree
SHA-1s and dirty states, the tracked-patch SHA-256, relevant environment gates,
and the selected structured-SSA mode.

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
