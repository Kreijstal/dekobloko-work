import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sound.midi.MidiSystem;

public final class DungeonAssaultAudioDumper {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final Map<String, Integer> SONGS = new LinkedHashMap<String, Integer>();
    private static final List<String> SAMPLES = Arrays.asList(
        "da_menu_fire",
        "da_hoardroom_angry_dragon",
        "menu_select",
        "da_ambience_burning_torches_loop_4000ms",
        "da_ambience_running_water_loop_1000ms",
        "da_gold_stealing",
        "da_dice_roll_dry",
        "01-the land of dungaria",
        "02-once it was a battlefield",
        "03-the world itself was in danger",
        "04-now the dragons sleep",
        "05-but still they battle",
        "06-thru the life and death of others",
        "07-take upon yourself",
        "08-defend your hoard",
        "09-become the dragon king"
    );

    static {
        SONGS.put("da_highscores", 150);
        SONGS.put("da_title3", 120);
        SONGS.put("da_raid_lose", 131);
        SONGS.put("da_raid_win", 89);
        SONGS.put("da_intro", 170);
        SONGS.put("da_ingame_battle", 110);
        SONGS.put("da_ingame_stealth", 180);
        SONGS.put("da_stressing_music", 200);
        SONGS.put("da_defeat_monster", 100);
    }

    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args.length > 0 ? args[0] : ".work/games/dungeonassault/js5-cache");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/dungeonassault/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));
        Files.createDirectories(outRoot.resolve("samples"));

        vn.a(SAMPLE_RATE, false, 10);

        nh archive13 = archive(cache, 13);
        nh archive14 = archive(cache, 14);
        nh archive15 = archive(cache, 15);
        nh archive16 = archive(cache, 16);
        lc sampleBank = new lc(archive13, archive14);
        ia.W = archive13;
        ll.ll_r = archive14;
        ha.ha_k = sampleBank;

        for (Map.Entry<String, Integer> song : SONGS.entrySet()) {
            renderSong(outRoot, archive15, archive16, sampleBank, song.getKey(), song.getValue());
        }
        for (String sample : SAMPLES) {
            dumpSample(outRoot, sample);
        }
    }

    private static void renderSong(Path outRoot, nh patchArchive, nh songArchive, lc sampleBank, String name, int volume) throws Exception {
        vh song = vh.a(songArchive, "", name);
        if (song == null) {
            throw new IllegalStateException("missing song " + name);
        }

        Path midi = outRoot.resolve("midi/" + safeName(name) + ".mid");
        Files.write(midi, repairMidi(song.vh_i));
        MidiSystem.getSequence(midi.toFile());

        tc mixer = new tc();
        if (!mixer.A.a(false, sampleBank, patchArchive, 0, song)) {
            throw new IllegalStateException("failed to hydrate song " + name);
        }
        mixer.a(22199, 1000000, 64, song, volume, false);

        byte[] pcm = renderPcm(mixer);
        Path wav = outRoot.resolve("wav/" + safeName(name) + ".wav");
        writeWav(wav, pcm, SAMPLE_RATE);
        System.out.printf("song %s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
    }

    private static void dumpSample(Path outRoot, String name) throws IOException {
        cf sample = hd.a(false, 256, name);
        if (sample == null || sample.cf_e == null) {
            throw new IllegalStateException("missing sample " + name);
        }
        Path wav = outRoot.resolve("samples/" + safeName(name) + ".wav");
        writeSampleWav(wav, sample.cf_e);
        System.out.printf("sample %s rate=%d samples=%d loop=%d..%d%n",
            wav.getFileName(), sample.cf_e.va_n, sample.cf_e.va_k.length, sample.cf_e.va_l, sample.cf_e.va_m);
    }

    private static nh archive(Path cache, int archive) {
        return new nh(new CacheQa(cache, archive), true, 1);
    }

    private static byte[] renderPcm(tc mixer) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int silentTail = 0;
        int rendered = 0;
        int maxSamples = SAMPLE_RATE * MAX_SECONDS;
        while (rendered < maxSamples) {
            Arrays.fill(mix, 0);
            mixer.b(mix, 0, BUFFER_SAMPLES);
            boolean silent = true;
            for (int sample : mix) {
                if (sample != 0) {
                    silent = false;
                }
                writePcm16(pcm, sample >> 8);
            }
            rendered += BUFFER_SAMPLES;
            if (silent) {
                silentTail += BUFFER_SAMPLES;
            } else {
                silentTail = 0;
            }
            if (silentTail >= TAIL_SILENCE_SAMPLES) {
                break;
            }
        }
        byte[] bytes = pcm.toByteArray();
        int trim = Math.min(silentTail, TAIL_SILENCE_SAMPLES) * 2;
        if (trim > 0 && trim < bytes.length) {
            return Arrays.copyOf(bytes, bytes.length - trim);
        }
        return bytes;
    }

    private static void writeSampleWav(Path out, va sample) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(sample.va_k.length * 2);
        for (byte value : sample.va_k) {
            writePcm16(pcm, value << 8);
        }
        writeWav(out, pcm.toByteArray(), sample.va_n);
    }

    private static void writePcm16(ByteArrayOutputStream out, int value) {
        int s = value;
        if (s < Short.MIN_VALUE) {
            s = Short.MIN_VALUE;
        } else if (s > Short.MAX_VALUE) {
            s = Short.MAX_VALUE;
        }
        out.write(s & 0xff);
        out.write((s >>> 8) & 0xff);
    }

    private static void writeWav(Path out, byte[] pcm, int sampleRate) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, 1);
            writeLe32(data, sampleRate);
            writeLe32(data, sampleRate * 2);
            writeLe16(data, 2);
            writeLe16(data, 16);
            data.writeBytes("data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
    }

    private static byte[] repairMidi(byte[] midi) throws IOException {
        ByteArrayOutputStream fixed = new ByteArrayOutputStream(midi.length + 64);
        fixed.write(midi, 0, 14);
        int pos = 14;
        while (pos < midi.length) {
            if (pos + 8 > midi.length || midi[pos] != 'M' || midi[pos + 1] != 'T' || midi[pos + 2] != 'r' || midi[pos + 3] != 'k') {
                throw new IOException("bad MIDI track header at " + pos);
            }
            int size = ((midi[pos + 4] & 0xff) << 24)
                | ((midi[pos + 5] & 0xff) << 16)
                | ((midi[pos + 6] & 0xff) << 8)
                | (midi[pos + 7] & 0xff);
            int dataStart = pos + 8;
            int dataEnd = dataStart + size;
            if (dataEnd > midi.length) {
                throw new IOException("bad MIDI track size at " + pos);
            }
            byte[] track = Arrays.copyOfRange(midi, dataStart, dataEnd);
            if (track.length >= 3 && track[track.length - 3] != (byte)0xff && track[track.length - 2] == 0x2f && track[track.length - 1] == 0) {
                byte[] repaired = new byte[track.length + 1];
                System.arraycopy(track, 0, repaired, 0, track.length - 2);
                repaired[track.length - 2] = (byte)0xff;
                repaired[track.length - 1] = 0x2f;
                repaired[track.length] = 0;
                track = repaired;
            }
            fixed.write(new byte[]{'M', 'T', 'r', 'k'});
            writeBe32(fixed, track.length);
            fixed.write(track);
            pos = dataEnd;
        }
        return fixed.toByteArray();
    }

    private static String safeName(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
    }

    private static void writeBe32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }

    private static void writeLe16(DataOutputStream out, int value) throws IOException {
        out.writeByte(value & 0xff);
        out.writeByte((value >>> 8) & 0xff);
    }

    private static void writeLe32(DataOutputStream out, int value) throws IOException {
        out.writeByte(value & 0xff);
        out.writeByte((value >>> 8) & 0xff);
        out.writeByte((value >>> 16) & 0xff);
        out.writeByte((value >>> 24) & 0xff);
    }

    private static final class CacheQa extends qa {
        private final Path cache;
        private final int archive;
        private tm index;

        CacheQa(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
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

        @Override
        tm a(int ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                try {
                    int crc = qh.a(0xffffff, raw, raw.length);
                    index = new tm(raw, crc, null);
                } catch (RuntimeException first) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    int crc = qh.a(0xffffff, stripped, stripped.length);
                    index = new tm(stripped, crc, null);
                }
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }

    private static byte[] readCacheGroup(Path cache, int index, int archive) throws IOException {
        byte[] idx = Files.readAllBytes(cache.resolve("main_file_cache.idx" + index));
        int offset = archive * 6;
        if (offset + 6 > idx.length) {
            return null;
        }
        int size = ((idx[offset] & 0xff) << 16) | ((idx[offset + 1] & 0xff) << 8) | (idx[offset + 2] & 0xff);
        int sector = ((idx[offset + 3] & 0xff) << 16) | ((idx[offset + 4] & 0xff) << 8) | (idx[offset + 5] & 0xff);
        if (size == 0 || sector == 0) {
            return null;
        }
        byte[] dat = Files.readAllBytes(cache.resolve("main_file_cache.dat2"));
        byte[] out = new byte[size];
        int copied = 0;
        int chunk = 0;
        while (copied < size) {
            int sectorOffset = sector * 520;
            if (sectorOffset + 8 > dat.length) {
                throw new IOException("bad sector " + sector);
            }
            int gotArchive = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16) | ((dat[sectorOffset + 5] & 0xff) << 8) | (dat[sectorOffset + 6] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotArchive != archive || gotChunk != chunk || gotIndex != index) {
                throw new IOException("bad sector header for index " + index + " archive " + archive);
            }
            int n = Math.min(512, size - copied);
            System.arraycopy(dat, sectorOffset + 8, out, copied, n);
            copied += n;
            sector = next;
            chunk++;
        }
        return out;
    }
}
