import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class Vertigo2MusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int CHANNELS = 2;
    private static final int MAX_RENDER_SECONDS = 240;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final String[] TRACKS = {
        "vertigo2_theme",
        "vertigo2_level_1",
        "vertigo2_level_2",
        "vertigo2_level_3",
        "vertigo2_lvl_complete_jingle",
        "vertigo2_lvl_start_jingle",
        "vertigo2_game_over_jingle",
        "vertigo2_multiplayer_lvl_lost_jingle",
        "vertigo2_time_running_out_jingle",
    };

    public static void main(String[] args) throws Exception {
        Path gameRoot = Path.of(args.length > 0 ? args[0] : ".work/games/vertigo2");
        Path outRoot = args.length > 1 ? Path.of(args[1]) : gameRoot.resolve("music");
        Path cache = args.length > 2 ? Path.of(args[2]) : gameRoot.resolve("download-build19/vertigo2");
        int synthIndex = args.length > 3 ? Integer.parseInt(args[3]) : 7;
        int vorbisIndex = args.length > 4 ? Integer.parseInt(args[4]) : 8;
        int patchIndex = args.length > 5 ? Integer.parseInt(args[5]) : 9;
        int musicIndex = args.length > 6 ? Integer.parseInt(args[6]) : 10;
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        dd.a(SAMPLE_RATE, true, 10);
        r synthArchive = archive(cache, synthIndex);
        r vorbisArchive = archive(cache, vorbisIndex);
        r patchArchive = archive(cache, patchIndex);
        r musicArchive = archive(cache, musicIndex);
        id samples = new id(synthArchive, vorbisArchive);

        int rendered = 0;
        for (String name : TRACKS) {
            si song = si.a(musicArchive, "", name);
            if (song == null) {
                System.out.printf("missing named music %s%n", name);
                continue;
            }
            renderSong(outRoot, samples, patchArchive, name, song);
            rendered++;
        }

        if (rendered == 0) {
            Constructor<si> constructor = si.class.getDeclaredConstructor(ed.class);
            constructor.setAccessible(true);
            int groups = musicArchive.c(-1);
            for (int group = 0; group < groups; group++) {
                int[] files;
                try {
                    files = musicArchive.a(0, group);
                } catch (RuntimeException ex) {
                    System.out.printf("skip archive%d_%02d metadata: %s%n", musicIndex, group, ex.getClass().getName());
                    continue;
                }
                if (files == null) {
                    continue;
                }
                for (int file : files) {
                    byte[] raw;
                    try {
                        raw = musicArchive.a(group, file, (byte)-72);
                    } catch (RuntimeException ex) {
                        System.out.printf("skip archive%d_%02d file%02d raw: %s%n", musicIndex, group, file, ex.getClass().getName());
                        continue;
                    }
                    if (raw == null) {
                        continue;
                    }
                    si song;
                    try {
                        song = constructor.newInstance(new ed(raw));
                    } catch (ReflectiveOperationException | RuntimeException ex) {
                        System.out.printf("skip archive%d_%02d file%02d song: %s (%s)%n", musicIndex, group, file, ex.getClass().getName(), rootSummary(ex));
                        continue;
                    }
                    String autoName = String.format("archive%d_%02d_file%02d", musicIndex, group, file);
                    try {
                        renderSong(outRoot, samples, patchArchive, autoName, song);
                        rendered++;
                    } catch (RuntimeException ex) {
                        System.out.printf("skip %s render: %s (%s)%n", autoName, ex.getClass().getName(), rootSummary(ex));
                    }
                }
            }
        }
    }

    private static void renderSong(Path outRoot, id samples, r patchArchive, String name, si song) throws Exception {
        byte[] midi = repairMidi(song.n);
        Path midiOut = outRoot.resolve("midi/" + safeName(name) + ".mid");
        Files.write(midiOut, midi);
        Sequence sequence = MidiSystem.getSequence(midiOut.toFile());
        int storedSamples = storedSamples(sequence);
        System.out.printf("track %s programs=%s stored=%.3fs%n", name, midiPrograms(sequence), storedSamples / (double)SAMPLE_RATE);

        db player = new db();
        player.a(9, true, 128);
        if (!player.a(0, samples, song, patchArchive, (byte)-52)) {
            throw new IllegalStateException("could not hydrate instruments for " + name);
        }
        player.a(256, -1, (byte)-61);
        player.a(true);
        player.a(-15, song, false);

        byte[] pcm = render(player, storedSamples);
        Path wav = outRoot.resolve("wav/" + safeName(name) + ".wav");
        writePcm16Wav(wav, pcm);
        System.out.printf(
            "music %s stored=%.3fs rendered=%.3fs%n",
            wav.getFileName(),
            storedSamples / (double)SAMPLE_RATE,
            pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2)
        );
    }

    private static r archive(Path cache, int archive) {
        return new r(new CacheBackend(cache, archive), true, 1);
    }

    private static int[] detectSamplePair(Path cache) {
        int[] archives = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
        for (int a : archives) {
            for (int b : archives) {
                if (a == b) {
                    continue;
                }
                if (!hasIndex(cache, a) || !hasIndex(cache, b)) {
                    continue;
                }
                try {
                    id samples = new id(archive(cache, a), archive(cache, b));
                    ae sample = samples.a((int[])null, 64, 0);
                    if (sample != null) {
                        System.out.printf("sample archives %d/%d%n", a, b);
                        return new int[]{a, b};
                    }
                } catch (RuntimeException ignored) {
                }
            }
        }
        return new int[]{7, 8};
    }

    private static boolean hasIndex(Path cache, int archive) {
        return Files.exists(cache.resolve("main_file_cache.idx" + archive));
    }

    private static int storedSamples(Sequence sequence) {
        return (int)Math.min(
            Integer.MAX_VALUE,
            (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
        );
    }

    private static byte[] render(db player, int storedSamples) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        int rendered = 0;
        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(BUFFER_SAMPLES, storedSamples - rendered);
            player.b(mix, 0, count);
            for (int i = 0; i < count * CHANNELS; i++) {
                writePcm16(pcm, mix[i] >> 8);
            }
            rendered += count;
        }
        return pcm.toByteArray();
    }

    private static String midiPrograms(Sequence sequence) {
        java.util.TreeSet<String> programs = new java.util.TreeSet<String>();
        for (javax.sound.midi.Track track : sequence.getTracks()) {
            for (int i = 0; i < track.size(); i++) {
                javax.sound.midi.MidiMessage message = track.get(i).getMessage();
                if (message instanceof javax.sound.midi.ShortMessage) {
                    javax.sound.midi.ShortMessage sm = (javax.sound.midi.ShortMessage)message;
                    if (sm.getCommand() == javax.sound.midi.ShortMessage.PROGRAM_CHANGE) {
                        programs.add(sm.getChannel() + ":" + sm.getData1());
                    }
                }
            }
        }
        return programs.toString();
    }

    private static String patchSampleSummary(si song, r patchArchive) {
        song.b();
        java.util.ArrayList<String> parts = new java.util.ArrayList<String>();
        for (li entry = song.o.b(0); entry != null; entry = song.o.c(-115)) {
            int patchId = (int)entry.k;
            al patch = ap.a(patchId, patchArchive, -125);
            if (patch == null) {
                parts.add(patchId + ":missing");
                continue;
            }
            if (patch.r == null) {
                parts.add(patchId + ":null");
                continue;
            }
            int count = 0;
            for (int i = 0; i < patch.r.length; i++) {
                if (patch.r[i] != null) {
                    count++;
                }
            }
            parts.add(patchId + ":" + count);
        }
        return parts.toString();
    }

    private static String patchUsageSummary(si song, r patchArchive) {
        song.b();
        java.util.ArrayList<String> parts = new java.util.ArrayList<String>();
        for (li entry = song.o.b(0); entry != null; entry = song.o.c(-115)) {
            int patchId = (int)entry.k;
            ph usage = (ph)entry;
            al patch = ap.a(patchId, patchArchive, -125);
            if (patch == null) {
                parts.add(patchId + ":missing");
                continue;
            }
            int used = 0;
            int mapped = 0;
            int empty = 0;
            java.util.ArrayList<String> notes = new java.util.ArrayList<String>();
            for (int i = 0; i < 128; i++) {
                if (usage.n[i] == 0) {
                    continue;
                }
                used++;
                ae sample = patch.r != null ? patch.r[i] : null;
                int len = sample == null || sample.s == null ? -1 : sample.s.length;
                if (len > 0) {
                    mapped++;
                } else {
                    empty++;
                }
                if (notes.size() < 12) {
                    notes.add(i + "=" + len + "/root" + (patch.n[i] & 0xffff) + "/vol" + (patch.p[i] & 0xff) + "/pan" + (patch.B[i] & 0xff));
                }
            }
            parts.add(patchId + ":used=" + used + ",mapped=" + mapped + ",empty=" + empty + ",notes=" + notes);
        }
        return parts.toString();
    }

    private static byte[] repairMidi(byte[] midi) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(midi.length + 64);
        out.write(midi, 0, 14);
        int pos = 14;
        while (pos < midi.length) {
            if (pos + 8 > midi.length
                    || midi[pos] != 'M'
                    || midi[pos + 1] != 'T'
                    || midi[pos + 2] != 'r'
                    || midi[pos + 3] != 'k') {
                throw new IOException("bad MIDI track header at " + pos);
            }
            int originalLength = readBe32(midi, pos + 4);
            int dataStart = pos + 8;
            int dataEnd = Math.min(midi.length, dataStart + originalLength);
            byte[] track = repairTrack(midi, dataStart, dataEnd);
            out.write(new byte[] {'M', 'T', 'r', 'k'});
            writeBe32(out, track.length);
            out.write(track);
            pos = dataEnd;
        }
        return out.toByteArray();
    }

    private static byte[] repairTrack(byte[] midi, int pos, int end) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int runningStatus = -1;
        while (pos < end) {
            pos = copyVarInt(midi, pos, out);
            if (pos >= end) {
                break;
            }
            int status = midi[pos] & 0xff;
            if (status == 0x2f && pos + 2 == end && midi[pos + 1] == 0) {
                out.write(0xff);
                out.write(0x2f);
                out.write(0);
                pos += 2;
                continue;
            }
            if (status < 0x80) {
                if (runningStatus < 0) {
                    out.write(midi[pos++]);
                    continue;
                }
                int dataBytes = channelDataBytes(runningStatus);
                for (int i = 0; i < dataBytes && pos < end; i++) {
                    out.write(midi[pos++]);
                }
                continue;
            }
            out.write(midi[pos++]);
            if (status == 0xff) {
                if (pos >= end) {
                    break;
                }
                out.write(midi[pos++]);
                long parsed = copyVarIntWithValue(midi, pos, out);
                pos = (int)(parsed >>> 32);
                int length = (int)parsed;
                for (int i = 0; i < length && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            } else if (status == 0xf0 || status == 0xf7) {
                long parsed = copyVarIntWithValue(midi, pos, out);
                pos = (int)(parsed >>> 32);
                int length = (int)parsed;
                for (int i = 0; i < length && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            } else {
                runningStatus = status;
                int dataBytes = channelDataBytes(status);
                for (int i = 0; i < dataBytes && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            }
        }
        return out.toByteArray();
    }

    private static int copyVarInt(byte[] data, int pos, ByteArrayOutputStream out) {
        for (int i = 0; i < 4 && pos < data.length; i++) {
            int value = data[pos++] & 0xff;
            out.write(value);
            if ((value & 0x80) == 0) {
                break;
            }
        }
        return pos;
    }

    private static long copyVarIntWithValue(byte[] data, int pos, ByteArrayOutputStream out) {
        int value = 0;
        for (int i = 0; i < 4 && pos < data.length; i++) {
            int part = data[pos++] & 0xff;
            out.write(part);
            value = (value << 7) | (part & 0x7f);
            if ((part & 0x80) == 0) {
                break;
            }
        }
        return ((long)pos << 32) | (value & 0xffffffffL);
    }

    private static int channelDataBytes(int status) {
        int command = status & 0xf0;
        return command == 0xc0 || command == 0xd0 ? 1 : 2;
    }

    private static int readBe32(byte[] data, int pos) {
        return ((data[pos] & 0xff) << 24)
            | ((data[pos + 1] & 0xff) << 16)
            | ((data[pos + 2] & 0xff) << 8)
            | (data[pos + 3] & 0xff);
    }

    private static void writeBe32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }

    private static void writePcm16(ByteArrayOutputStream out, int sample) {
        int s = sample;
        if (s < Short.MIN_VALUE) {
            s = Short.MIN_VALUE;
        } else if (s > Short.MAX_VALUE) {
            s = Short.MAX_VALUE;
        }
        out.write(s & 0xff);
        out.write((s >>> 8) & 0xff);
    }

    private static void writePcm16Wav(Path out, byte[] pcm) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, CHANNELS);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * CHANNELS * 2);
            writeLe16(data, CHANNELS * 2);
            writeLe16(data, 16);
            data.writeBytes("data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
    }

    private static String safeName(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
    }

    private static String rootSummary(Throwable ex) {
        Throwable t = ex;
        while (t.getCause() != null) {
            t = t.getCause();
        }
        String message = t.getMessage();
        return t.getClass().getName() + (message == null ? "" : ": " + message);
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

    private static final class CacheBackend extends ab {
        private final Path cache;
        private final int archive;
        private ff index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        byte[] a(boolean ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int b(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
            }
        }

        @Override
        ff a(boolean ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new ff(raw, w.a(raw.length, raw, -7), null);
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }

    private static byte[] readCacheGroup(Path cache, int index, int group) throws IOException {
        Path idxPath = cache.resolve("main_file_cache.idx" + index);
        if (!Files.exists(idxPath)) {
            return null;
        }
        byte[] idx = Files.readAllBytes(idxPath);
        int offset = group * 6;
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
                throw new IOException("bad sector " + sector + " for index " + index + " group " + group);
            }
            int gotGroup = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16)
                | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotGroup != group || gotChunk != chunk || gotIndex != index) {
                throw new IOException("bad sector header for index " + index + " group " + group);
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
