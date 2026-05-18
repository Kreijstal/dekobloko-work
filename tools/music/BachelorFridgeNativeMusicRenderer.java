import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class BachelorFridgeNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = SAMPLE_RATE;
    private static final String[] TRACKS = {
        "bf_titlescreen_version2",
        "bf_shopping_screen",
        "bf_main_view1",
        "bf_main_view2",
        "bf_new_battle1",
        "bf_new_battle3",
        "bf_new_battle2",
        "bf_competition_arena_intro_jingle",
        "bf_competition_lose_jingle",
        "bf_competition_victory_jingle",
        "bf_combat_arena",
    };
    private static final int[] TRACK_FILE_IDS = {4, 6, 9, 7, 10, 11, 12, 3, 1, 2, 5};

    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args.length > 0 ? args[0] : ".work/games/bachelorfridge/js5-cache-build70/bachelorfridge");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/bachelorfridge/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        pb.a(SAMPLE_RATE, false, 10);
        vr samples = archive(cache, 7);
        vr synths = archive(cache, 8);
        vr patches = archive(cache, 9);
        vr songs = archive(cache, 10);
        i sampleLoader = new i(samples, synths);

        int written = 0;
        for (int i = 0; i < TRACKS.length; i++) {
            String name = TRACKS[i];
            kia track = kia.a(songs, "", name);
            if (track == null) {
                track = trackFromArchiveFile(cache, TRACK_FILE_IDS[i]);
            }
            if (track == null) {
                System.out.printf("missing %s%n", name);
                continue;
            }

            byte[] midi = repairMidi(track.g);
            Path midiOut = outRoot.resolve("midi/" + name + ".mid");
            Files.write(midiOut, midi);
            Sequence sequence = MidiSystem.getSequence(midiOut.toFile());
            int storedSamples = storedSamples(sequence);

            jp player = new jp();
            if (!player.a(patches, track, sampleLoader, (byte)1, 0)) {
                throw new IllegalStateException("could not hydrate instruments for " + name);
            }
            player.a(track, (byte)-109, false);

            byte[] pcm = renderPcm(player, storedSamples);
            Path wavOut = outRoot.resolve("wav/" + name + ".wav");
            writeMonoWav(wavOut, pcm);
            System.out.printf("track %s midi=%d stored=%.3fs wav=%d%n", name, midi.length, storedSamples / (double)SAMPLE_RATE, pcm.length);
            written++;
        }
        System.out.printf("wrote %d tracks%n", written);
    }

    private static vr archive(Path cache, int archive) {
        return new vr(new CacheBackend(cache, archive), true, 1);
    }

    private static kia trackFromArchiveFile(Path cache, int fileId) throws Exception {
        byte[] raw = readCacheGroup(cache, 10, 0);
        if (raw == null) {
            return null;
        }
        byte[] decoded = td.a(-124, raw);
        byte[] file = splitGroup(decoded, 13)[fileId];
        Constructor<kia> constructor = kia.class.getDeclaredConstructor(lu.class);
        constructor.setAccessible(true);
        return constructor.newInstance(new lu(file));
    }

    private static int storedSamples(Sequence sequence) {
        return (int)Math.min(
            Integer.MAX_VALUE,
            (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
        );
    }

    private static byte[] renderPcm(jp player, int storedSamples) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int total = 0;
        while (total < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(mix.length, storedSamples - total);
            player.a(mix, 0, count);
            for (int i = 0; i < count; i++) {
                int value = mix[i];
                int sample = value >> 8;
                if (sample < -32768) sample = -32768;
                if (sample > 32767) sample = 32767;
                out.write(sample & 0xff);
                out.write((sample >>> 8) & 0xff);
            }
            total += count;
        }
        return out.toByteArray();
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
            ByteArrayOutputStream track = repairTrack(midi, dataStart, dataEnd);
            byte[] trackBytes = track.toByteArray();
            out.write(new byte[] {'M', 'T', 'r', 'k'});
            writeBe32(out, trackBytes.length);
            out.write(trackBytes);
            pos = dataEnd;
        }
        return out.toByteArray();
    }

    private static ByteArrayOutputStream repairTrack(byte[] midi, int pos, int end) {
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
                if (pos >= midi.length) {
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
        return out;
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

    private static void writeMonoWav(Path out, byte[] pcm) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, 1);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * 2);
            writeLe16(data, 2);
            writeLe16(data, 16);
            data.writeBytes("data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
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

    private static byte[][] splitGroup(byte[] data, int fileCount) throws IOException {
        if (fileCount == 1) {
            return new byte[][] {data};
        }
        int chunks = data[data.length - 1] & 0xff;
        int tableStart = data.length - 1 - chunks * fileCount * 4;
        if (tableStart < 0) {
            throw new IOException("split table does not fit");
        }
        int[] lengths = new int[fileCount];
        int pos = tableStart;
        for (int chunk = 0; chunk < chunks; chunk++) {
            int size = 0;
            for (int file = 0; file < fileCount; file++) {
                size += readBe32(data, pos);
                pos += 4;
                lengths[file] += size;
            }
        }
        byte[][] files = new byte[fileCount][];
        for (int file = 0; file < fileCount; file++) {
            files[file] = new byte[lengths[file]];
        }
        int[] offsets = new int[fileCount];
        pos = 0;
        int table = tableStart;
        for (int chunk = 0; chunk < chunks; chunk++) {
            int size = 0;
            for (int file = 0; file < fileCount; file++) {
                size += readBe32(data, table);
                table += 4;
                System.arraycopy(data, pos, files[file], offsets[file], size);
                offsets[file] += size;
                pos += size;
            }
        }
        if (pos != tableStart) {
            throw new IOException("split consumed " + pos + ", expected " + tableStart);
        }
        return files;
    }

    private static final class CacheBackend extends tja {
        private final Path cache;
        private final int archive;
        private rf index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        rf b(int ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new rf(raw, wc.a(raw, -31303, raw.length), null);
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(byte ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
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
        if (index != 255 && out.length >= 2) {
            return Arrays.copyOf(out, out.length - 2);
        }
        return out;
    }
}
