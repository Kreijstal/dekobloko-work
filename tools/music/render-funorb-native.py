#!/usr/bin/env python3
import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path


SAMPLE_RATE = 22050


PROFILES = {
    "pixelate": {
        "tracks": [
            "pix_title",
            "pix_end_game",
            "skin1",
            "skin2",
            "skin3",
            "skin4",
            "skin5",
            "skin6",
            "skin7",
            "skin8",
            "skin9",
            "skin10",
            "skin11",
            "skin12",
            "skin13",
            "skin14",
            "skin15",
            "skin16",
        ],
        "init": "mm.h = SAMPLE_RATE;\n        mm.o = false;",
        "archive_type": "fm",
        "archive_new": "new fm(new CacheArchive(cache, archive), true, 1)",
        "backend_extends": "jp",
        "index_type": "kj",
        "index_new": "new kj(raw, wg.a(raw, 125, raw.length), null)",
        "backend_methods": "pixelate",
        "samples_type": "po",
        "samples_new": "new po(archive7, archive8)",
        "track_type": "ua",
        "track_load": "ua.a(archive10, \"\", name)",
        "midi_expr": "track.k",
        "player_type": "ti",
        "player_setup": "",
        "hydrate_condition": "player.a(track, samples, archive9, 109, 1 << 28)",
        "track_prepare": "",
        "start": "player.a(track, -39, false);",
        "render_call": "player.b(mix, 0, mix.length);",
        "active_expr": "player.a((byte)82)",
    },
    "virogrid": {
        "tracks": [
            "ataxx titlescreen",
            "tetralink ingame 1",
            "tetralink ingame 2",
            "tetralink ingame 3",
        ],
        "init": "ua.p = SAMPLE_RATE;\n        ua.q = false;",
        "archive_type": "eh",
        "archive_new": "new eh(new CacheArchive(cache, archive), true, 0)",
        "backend_extends": "ba",
        "index_type": "sj",
        "index_new": "new sj(raw, na.a(false, raw.length, raw), null)",
        "backend_methods": "virogrid",
        "samples_type": "jg",
        "samples_new": "new jg(archive7, archive8)",
        "track_type": "sc",
        "track_load": "sc.a(archive10, \"\", name)",
        "midi_expr": "track.g",
        "player_type": "i",
        "player_setup": "",
        "hydrate_condition": "player.a(archive9, 0, samples, track, 0)",
        "track_prepare": "track.b();",
        "start": "player.a(false, 37, track);",
        "render_call": "player.b(mix, 0, mix.length);",
        "active_expr": "player.d(111)",
    },
    "steelsentinels": {
        "tracks": [
            "md_title_music",
            "war_zone",
            "lost_world",
            "cityscape",
            "thats_no_moon",
            "star_fleet",
        ],
        "init": "tb.a(SAMPLE_RATE, false, 10);",
        "archive_type": "cm",
        "archive_new": "new cm(new CacheArchive(cache, archive), true, 1)",
        "backend_extends": "fa",
        "index_type": "jl",
        "index_new": "new jl(raw, ba.a((byte)-107, raw, raw.length), null)",
        "backend_methods": "steelsentinels",
        "samples_type": "ub",
        "samples_new": "new ub(archive7, archive8)",
        "track_type": "tg",
        "track_load": "tg.a(archive10, \"\", name)",
        "midi_expr": "track.tg_p",
        "player_type": "ic",
        "player_setup": "player.a(256, 1000000);\n            player.a(-1, (byte)20, 200);",
        "hydrate_condition": "player.a(0, track, 21687, samples, archive9)",
        "track_prepare": "track.b();",
        "start": "player.a(true, false, track);",
        "render_call": "player.a(mix, 0, mix.length);",
        "active_expr": "player.d((byte)90)",
    },
    "orbdefence": {
        "tracks": [
            "Orb_defence_level_1_construction",
            "Orb_defence_level_1_waves",
            "Orb_defence_level_1_boss",
            "Orb_defence_level_2_construction",
            "Orb_defence_level_2_waves",
            "Orb_defence_level_2_boss",
            "Orb_defence_level_3_construction",
            "Orb_defence_level_3_waves",
            "Orb_defence_level_3_boss",
            "Orb_defence_level_4_construction",
            "Orb_defence_level_4_waves",
            "Orb_defence_level_4_boss",
            "Orb_defence_titlescreen_1",
            "Orb_defence_gameover",
        ],
        "discover_archive10": False,
        "archives": [6, 7, 8, 9],
        "init": "la.la_c = SAMPLE_RATE;\n        la.la_g = false;",
        "archive_type": "ki",
        "archive_new": "new ki(new CacheArchive(cache, archive), true, 1)",
        "backend_extends": "jl",
        "index_type": "hd",
        "index_new": "new hd(raw, eg.a(raw, 0, raw.length), null)",
        "backend_methods": "orbdefence",
        "samples_type": "vd",
        "samples_new": "new vd(archive7, archive8)",
        "track_type": "fj",
        "track_load": "fj.a(archive10, \"\", name)",
        "midi_expr": "track.fj_f",
        "player_type": "lj",
        "player_setup": "player.a(128, 9, (byte)125);",
        "hydrate_condition": "player.a(archive9, samples, (byte)31, track, 1 << 28)",
        "track_prepare": "",
        "start": "player.a(false, track, 2, false, 1, -107);",
        "render_call": "player.b(mix, 0, mix.length);",
        "active_expr": "player.f(-21)",
    },
    "zombiedawnmulti": {
        "tracks": [
            "ZD_multi_GAME_FINISH",
            "ZD_multi_laboratory",
            "ZD_multi_TITLESCREEn",
            "zombie dawn precinct",
            "ZD_multi_PANIC_LOOP",
            "zombie dawn white house",
            "zombie dawn powerplant",
            "zombie dawn mall",
            "ZD_multi_GAME_WIN",
            "zombie dawn instructions loop",
            "ZD_multi_GAME_LOSE",
        ],
        "discover_archive10": False,
        "archives": [4, 5, 6, 7],
        "init": "gp.a(SAMPLE_RATE, false, 10);",
        "archive_type": "ul",
        "archive_new": "new ul(new CacheArchive(cache, archive), true, 1)",
        "backend_extends": "ng",
        "index_type": "be",
        "index_new": "new be(raw, pb.a(raw, raw.length, (byte)-120), null)",
        "backend_methods": "zombiedawnmulti",
        "samples_type": "me",
        "samples_new": "new me(archive7, archive8)",
        "track_type": "ug",
        "track_load": "ug.a(archive10, \"\", name)",
        "midi_expr": "track.g",
        "player_type": "gd",
        "player_setup": "player.f(128, 15, 9);",
        "hydrate_condition": "player.a(-10783, samples, 1 << 28, track, archive9)",
        "track_prepare": "",
        "start": "player.a(track, false, 8361407);",
        "render_call": "player.b(mix, 0, mix.length);",
        "active_expr": "player.c(-37)",
    },
    "zombiedawn": {
        "tracks": [
            "zombie dawn precinct",
            "zombie dawn white house",
            "zombie dawn powerplant",
            "zombie dawn mall",
            "zombie dawn titlescreen",
            "zombie dawn end level",
            "zombie dawn bonus level",
            "zombie dawn countup part 1",
            "zombie dawn countup part 2",
            "zombie dawn instructions loop",
            "zombie dawn update area51",
            "zombie dawn update buckingham",
            "zombie dawn update country",
            "zombie dawn update airport",
        ],
        "discover_archive10": False,
        "archives": [4, 5, 6, 7],
        "init": "qf.a(SAMPLE_RATE, true, 10);",
        "channels": 2,
        "archive_type": "dj",
        "archive_new": "new dj(new CacheArchive(cache, archive), true, 1)",
        "backend_extends": "w",
        "index_type": "jh",
        "index_new": "new jh(raw, ii.a(8099, raw.length, raw), null)",
        "backend_methods": "zombiedawn",
        "samples_type": "ka",
        "samples_new": "new ka(archive7, archive8)",
        "track_type": "wj",
        "track_load": "wj.a(archive10, name, \"\")",
        "midi_expr": "track.i",
        "player_type": "rj",
        "player_setup": "player.a(128, (byte)-128, 9);",
        "hydrate_condition": "player.a(track, (byte)20, archive9, 1 << 28, samples)",
        "track_prepare": "",
        "start": "player.a((byte)-22, track, false);",
        "render_call": "player.a(mix, 0, mix.length);",
        "active_expr": "player.c((byte)-34)",
    },
    "aceofskies": {
        "tracks": [
            "aos_main_title",
            "aos level_channels_v2",
            "aos boss level",
        ],
        "discover_archive10": False,
        "archives": [6, 7, 8, 9],
        "init": "tk.f = SAMPLE_RATE;\n        tk.r = true;",
        "archive_type": "gk",
        "archive_new": "new gk(new CacheArchive(cache, archive), true, 1)",
        "backend_extends": "ip",
        "index_type": "ps",
        "index_new": "new ps(raw, lj.a(-124, raw, raw.length), null)",
        "backend_methods": "aceofskies",
        "samples_type": "ob",
        "samples_new": "new ob(archive7, archive8)",
        "track_type": "ap",
        "track_load": "ap.a(archive10, \"\", name)",
        "midi_expr": "track.e",
        "player_type": "hk",
        "player_setup": "",
        "hydrate_condition": "player.a(-1, 0, track, archive9, samples)",
        "track_prepare": "",
        "start": "player.a(false, -2029711608, track);",
        "render_call": "player.b(mix, 0, mix.length);",
        "active_expr": "player.f(-21)",
    },
}


BACKEND_METHODS = {
    "pixelate": """
        @Override
        byte[] a(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        INDEX_TYPE a(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = INDEX_NEW;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
""",
    "virogrid": """
        @Override
        int a(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        INDEX_TYPE a(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = INDEX_NEW;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        byte[] b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
""",
    "steelsentinels": """
        @Override
        INDEX_TYPE b(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = INDEX_NEW;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int a(boolean ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
""",
    "orbdefence": """
        @Override
        hd a(int ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = new hd(raw, eg.a(raw, 0, raw.length), null);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
""",
    "zombiedawnmulti": """
        @Override
        byte[] a(int magic, int group) {
            try {
                return magic == -123 ? readCacheGroup(cache, archive, group) : null;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        be a(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = INDEX_NEW;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
""",
    "zombiedawn": """
        @Override
        byte[] a(int group, byte magic) {
            try {
                return magic == 112 ? readCacheGroup(cache, archive, group) : null;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        jh b(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = INDEX_NEW;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }
""",
    "aceofskies": """
        @Override
        ps a(boolean ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = INDEX_NEW;
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        byte[] a(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
            }
        }
""",
}


def java_string(value):
    return json.dumps(value)


def java_list(values):
    return ",\n        ".join(java_string(value) for value in values)


def load_music_extract_module():
    path = Path(__file__).with_name("extract-dekobloko-music.py")
    spec = importlib.util.spec_from_file_location("funorb_music_extract", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def class_strings(classes):
    strings = set()
    pattern = re.compile(rb"[\x20-\x7e]{3,96}")
    for class_file in classes.glob("*.class"):
        data = class_file.read_bytes()
        for match in pattern.finditer(data):
            try:
                strings.add(match.group(0).decode("cp1252"))
            except UnicodeDecodeError:
                pass
    return strings


def discover_archive10_tracks(cache, classes):
    music = load_music_extract_module()
    index = music.parse_index(cache, 10)
    hashes = {}
    for value in class_strings(classes):
        hashes.setdefault(music.name_hash(value), []).append(value)

    tracks = []
    seen = set()
    for group in index["groups"].values():
        if group["id"] != 0:
            continue
        for file_id in group.get("file_ids", []):
            file_hash = group.get("file_name_hashes", {}).get(file_id)
            if file_hash not in hashes:
                continue
            for name in sorted(hashes[file_hash], key=lambda s: (len(s), s)):
                if name in seen:
                    continue
                seen.add(name)
                tracks.append((group["id"], file_id, name))
                break
    return tracks


def render_source(profile):
    backend_methods = BACKEND_METHODS[profile["backend_methods"]]
    backend_methods = backend_methods.replace("INDEX_TYPE", profile["index_type"])
    backend_methods = backend_methods.replace("INDEX_NEW", profile["index_new"])
    archive_ids = profile.get("archives", [7, 8, 9, 10])
    channels = profile.get("channels", 1)
    render_call = profile["render_call"].replace("mix.length", "BUFFER_SAMPLES")
    player_setup = profile["player_setup"]
    if player_setup:
        player_setup = "\n            " + player_setup
    track_prepare = profile["track_prepare"]
    if track_prepare:
        track_prepare = "\n            " + track_prepare

    return f"""import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import javax.sound.midi.MidiSystem;

public final class GeneratedFunOrbMusicRenderer {{
    private static final int SAMPLE_RATE = {SAMPLE_RATE};
    private static final int BUFFER_SAMPLES = 1024;
    private static final int CHANNELS = {channels};
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final List<String> TRACK_NAMES = List.of(
        {java_list(profile["tracks"])}
    );

    public static void main(String[] args) throws Exception {{
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/music");
        Path cache = args.length > 1 ? Path.of(args[1]) : Path.of(".work/js5-cache");
        Files.createDirectories(outRoot.resolve("midi/archive10_tracks"));
        Files.createDirectories(outRoot.resolve("wav-native/archive10_tracks"));

        {profile["init"]}

        {profile["archive_type"]} archive7 = archive(cache, {archive_ids[0]});
        {profile["archive_type"]} archive8 = archive(cache, {archive_ids[1]});
        {profile["archive_type"]} archive9 = archive(cache, {archive_ids[2]});
        {profile["archive_type"]} archive10 = archive(cache, {archive_ids[3]});
        {profile["samples_type"]} samples = {profile["samples_new"]};

        for (String name : TRACK_NAMES) {{
            {profile["track_type"]} track = {profile["track_load"]};
            if (track == null) {{
                throw new IllegalStateException("missing music track " + name);
            }}

            Path midi = outRoot.resolve("midi/archive10_tracks/" + safeName(name) + ".mid");
            Files.write(midi, repairMidi({profile["midi_expr"]}));
            MidiSystem.getSequence(midi.toFile());

            {profile["player_type"]} player = new {profile["player_type"]}();{player_setup}
            if (!({profile["hydrate_condition"]})) {{
                throw new IllegalStateException("failed to hydrate instruments for " + name);
            }}{track_prepare}
            {profile["start"]}

            byte[] pcm = renderPcm(player);
            Path wav = outRoot.resolve("wav-native/archive10_tracks/" + safeName(name) + ".wav");
            writeMonoWav(wav, pcm);
            System.out.printf("%s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2));
        }}
    }}

    private static {profile["archive_type"]} archive(Path cache, int archive) {{
        return {profile["archive_new"]};
    }}

    private static byte[] renderPcm({profile["player_type"]} player) throws IOException {{
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        int silentTail = 0;
        int maxSamples = SAMPLE_RATE * MAX_SECONDS;
        int rendered = 0;

        while (rendered < maxSamples) {{
            Arrays.fill(mix, 0);
            {render_call}

            boolean silent = true;
            for (int sample : mix) {{
                if (sample != 0) {{
                    silent = false;
                }}
                int s = sample >> 8;
                if (s < Short.MIN_VALUE) {{
                    s = Short.MIN_VALUE;
                }} else if (s > Short.MAX_VALUE) {{
                    s = Short.MAX_VALUE;
                }}
                pcm.write(s & 0xff);
                pcm.write((s >>> 8) & 0xff);
            }}

            rendered += BUFFER_SAMPLES;
            if (silent) {{
                silentTail += BUFFER_SAMPLES;
            }} else {{
                silentTail = 0;
            }}
            if (!({profile["active_expr"]}) && silentTail >= TAIL_SILENCE_SAMPLES) {{
                break;
            }}
        }}

        byte[] bytes = pcm.toByteArray();
        int trim = Math.min(silentTail, TAIL_SILENCE_SAMPLES) * CHANNELS * 2;
        if (trim > 0 && trim < bytes.length) {{
            return Arrays.copyOf(bytes, bytes.length - trim);
        }}
        return bytes;
    }}

    private static String safeName(String name) {{
        return name.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
    }}

    private static byte[] repairMidi(byte[] midi) throws IOException {{
        ByteArrayOutputStream fixed = new ByteArrayOutputStream(midi.length + 64);
        fixed.write(midi, 0, 14);
        int pos = 14;
        while (pos < midi.length) {{
            if (pos + 8 > midi.length || midi[pos] != 'M' || midi[pos + 1] != 'T' || midi[pos + 2] != 'r' || midi[pos + 3] != 'k') {{
                throw new IOException("bad MIDI track header at " + pos);
            }}
            int size = ((midi[pos + 4] & 0xff) << 24)
                | ((midi[pos + 5] & 0xff) << 16)
                | ((midi[pos + 6] & 0xff) << 8)
                | (midi[pos + 7] & 0xff);
            int dataStart = pos + 8;
            int dataEnd = dataStart + size;
            if (dataEnd > midi.length) {{
                throw new IOException("bad MIDI track size at " + pos);
            }}
            byte[] track = Arrays.copyOfRange(midi, dataStart, dataEnd);
            if (track.length >= 3 && track[track.length - 3] != (byte)0xff && track[track.length - 2] == 0x2f && track[track.length - 1] == 0) {{
                byte[] repaired = new byte[track.length + 1];
                System.arraycopy(track, 0, repaired, 0, track.length - 2);
                repaired[track.length - 2] = (byte)0xff;
                repaired[track.length - 1] = 0x2f;
                repaired[track.length] = 0;
                track = repaired;
            }}
            fixed.write(new byte[] {{'M', 'T', 'r', 'k'}});
            writeBe32(fixed, track.length);
            fixed.write(track);
            pos = dataEnd;
        }}
        return fixed.toByteArray();
    }}

    private static void writeMonoWav(Path out, byte[] pcm) throws IOException {{
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {{
            writeAscii(data, "RIFF");
            writeLe32(data, 36 + pcm.length);
            writeAscii(data, "WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, CHANNELS);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * CHANNELS * 2);
            writeLe16(data, CHANNELS * 2);
            writeLe16(data, 16);
            writeAscii(data, "data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }}
    }}

    private static void writeAscii(DataOutputStream out, String s) throws IOException {{
        out.writeBytes(s);
    }}

    private static void writeLe16(DataOutputStream out, int value) throws IOException {{
        out.writeByte(value & 0xff);
        out.writeByte((value >>> 8) & 0xff);
    }}

    private static void writeLe32(DataOutputStream out, int value) throws IOException {{
        out.writeByte(value & 0xff);
        out.writeByte((value >>> 8) & 0xff);
        out.writeByte((value >>> 16) & 0xff);
        out.writeByte((value >>> 24) & 0xff);
    }}

    private static void writeBe32(ByteArrayOutputStream out, int value) {{
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }}

    private static byte[] readCacheGroup(Path cache, int index, int archive) throws IOException {{
        Path data = cache.resolve("main_file_cache.dat2");
        Path indexPath = cache.resolve("main_file_cache.idx" + index);
        byte[] idx = Files.readAllBytes(indexPath);
        int offset = archive * 6;
        if (offset + 6 > idx.length) {{
            return null;
        }}
        int size = ((idx[offset] & 0xff) << 16) | ((idx[offset + 1] & 0xff) << 8) | (idx[offset + 2] & 0xff);
        int sector = ((idx[offset + 3] & 0xff) << 16) | ((idx[offset + 4] & 0xff) << 8) | (idx[offset + 5] & 0xff);
        if (size == 0 || sector == 0) {{
            return null;
        }}

        byte[] dat = Files.readAllBytes(data);
        byte[] out = new byte[size];
        int copied = 0;
        int chunk = 0;
        while (copied < size) {{
            int sectorOffset = sector * 520;
            if (sectorOffset + 8 > dat.length) {{
                throw new IOException("bad sector " + sector + " for index " + index + " archive " + archive);
            }}
            int gotArchive = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16)
                | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotArchive != archive || gotChunk != chunk || gotIndex != index) {{
                throw new IOException("bad sector header for index " + index + " archive " + archive);
            }}
            int n = Math.min(512, size - copied);
            System.arraycopy(dat, sectorOffset + 8, out, copied, n);
            copied += n;
            sector = next;
            chunk++;
        }}
        return out;
    }}

    private static final class CacheArchive extends {profile["backend_extends"]} {{
        private final Path cache;
        private final int archive;
        private {profile["index_type"]} index;

        CacheArchive(Path cache, int archive) {{
            this.cache = cache;
            this.archive = archive;
        }}
{backend_methods}
    }}
}}
"""


def run(cmd, quiet=False):
    if not quiet:
        print("+ " + " ".join(str(part) for part in cmd), flush=True)
    subprocess.run(
        cmd,
        check=True,
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.DEVNULL if quiet else None,
    )


def load_profile(profile_name, profile_file=None):
    if profile_file is None:
        return dict(PROFILES[profile_name])
    profile = json.loads(profile_file.read_text(encoding="utf-8"))
    profile.setdefault("name", profile_name)
    return profile


def render_game(game, profile_name, classes, cache, out, work, keep_source, discover_tracks, quiet=False, profile_file=None):
    profile = load_profile(profile_name, profile_file)
    if discover_tracks and profile.get("discover_archive10", True):
        tracks = discover_archive10_tracks(cache, classes)
        if not tracks:
            raise RuntimeError("no archive-10 track names matched class strings")
        profile["tracks"] = [name for _, _, name in tracks]
        if not quiet:
            print(
                f"{game}: discovered {len(tracks)} archive-10 tracks: "
                + ", ".join(f"{group}:{file_id}={name}" for group, file_id, name in tracks),
                flush=True,
            )

    src_dir = work / "src"
    classes_dir = work / "classes"
    src_dir.mkdir(parents=True, exist_ok=True)
    classes_dir.mkdir(parents=True, exist_ok=True)

    source = src_dir / "GeneratedFunOrbMusicRenderer.java"
    source.write_text(render_source(profile), encoding="utf-8")

    run(["javac", "-cp", str(classes), "-d", str(classes_dir), str(source)], quiet=quiet)
    run([
        "java",
        "-cp",
        f"{classes_dir}:{classes}",
        "GeneratedFunOrbMusicRenderer",
        str(out),
        str(cache),
    ], quiet=quiet)

    if not keep_source:
        source.unlink(missing_ok=True)


def run_all(args):
    root = args.root
    failures = []
    successes = []
    for game_dir in sorted(root.iterdir()):
        classes = preferred_classes(game_dir)
        cache = game_dir / "js5-cache"
        if not classes.is_dir() or not cache.is_dir():
            continue
        game = game_dir.name
        profiles = [game] if game in PROFILES else sorted(PROFILES)
        for profile_name in profiles:
            if game != profile_name and not PROFILES[profile_name].get("discover_archive10", True):
                continue
            out = game_dir / "music-general"
            work = game_dir / "music-general-tools" / profile_name
            try:
                render_game(
                    game,
                    profile_name,
                    classes,
                    cache,
                    out,
                    work,
                    args.keep_source,
                    True,
                    True,
                )
                successes.append((game, profile_name))
                print(f"{game}: rendered with {profile_name}", flush=True)
                break
            except Exception as exc:
                failures.append((game, profile_name, str(exc).splitlines()[0]))
                if args.stop_on_error:
                    raise
    print("native renderer successes:", successes, flush=True)
    print("native renderer failures:", failures, flush=True)
    return 0 if successes else 1


def preferred_classes(game_dir):
    for candidate in (
        game_dir / "regression-tailgate-out",
        game_dir / "deob-profile" / "out",
        game_dir / "deob-safe" / "out",
        game_dir / "classes",
    ):
        if candidate.is_dir():
            return candidate
    return game_dir / "classes"


def main():
    parser = argparse.ArgumentParser(description="Generate and run a native FunOrb music renderer from a profile.")
    parser.add_argument("--game", choices=sorted(PROFILES))
    parser.add_argument("--profile-file", type=Path, help="external JSON profile to render instead of the built-in --game profile")
    parser.add_argument("--classes", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--work", type=Path)
    parser.add_argument("--discover-tracks", action="store_true")
    parser.add_argument("--all", action="store_true", help="try supported profiles across .work/games/*")
    parser.add_argument("--root", type=Path, default=Path(".work/games"))
    parser.add_argument("--stop-on-error", action="store_true")
    parser.add_argument("--keep-source", action="store_true")
    args = parser.parse_args()

    if args.all:
        raise SystemExit(run_all(args))
    if (not args.game and not args.profile_file) or not args.classes or not args.cache or not args.out:
        parser.error("--game or --profile-file plus --classes, --cache, and --out are required unless --all is used")

    work = args.work or (args.out / "generated-renderer")
    profile_name = args.game or args.profile_file.stem
    render_game(
        args.game or profile_name,
        profile_name,
        args.classes,
        args.cache,
        args.out,
        work,
        args.keep_source,
        args.discover_tracks,
        False,
        args.profile_file,
    )


if __name__ == "__main__":
    main()
