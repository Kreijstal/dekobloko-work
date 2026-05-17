import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;

public final class TombRacerNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = SAMPLE_RATE;
    private static final int MAX_SECONDS = 180;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 3;
    private static final String[] TRACKS = {
        "TR_theme",
        "TR_temple_music",
        "TR_win_jingle_long",
        "TR_lose_jingle_long",
    };
    private static final int[] TRACK_FILE_IDS = {0, 1, 9, 4};

    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args.length > 0 ? args[0] : ".work/games/tombracer/js5-cache-build81/tombracer");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/tombracer/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        kta.a(SAMPLE_RATE, false, 10);
        cn patches = archive(cache, 28);
        cn instruments = archive(cache, 26);
        cn synths = archive(cache, 27);
        cn songs = archive(cache, 29);
        nda sampleLoader = new nda(instruments, synths);

        int written = 0;
        for (int i = 0; i < TRACKS.length; i++) {
            String name = TRACKS[i];
            qua track = qua.a(songs, "", name);
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
            MidiSystem.getSequence(midiOut.toFile());

            l player = new l();
            if (!player.a(0, track, patches, sampleLoader, 0)) {
                throw new IllegalStateException("could not hydrate instruments for " + name);
            }
            player.a(track, false, (byte)80);

            byte[] pcm = renderPcm(player);
            Path wavOut = outRoot.resolve("wav/" + name + ".wav");
            writeMonoWav(wavOut, pcm);
            System.out.printf("track %s midi=%d wav=%d%n", name, midi.length, pcm.length);
            written++;
        }
        System.out.printf("wrote %d tracks%n", written);
    }

    private static cn archive(Path cache, int archive) {
        return new cn(new CacheBackend(cache, archive), true, 1);
    }

    private static qua trackFromArchiveFile(Path cache, int fileId) throws Exception {
        byte[] raw = readCacheGroup(cache, 29, 0);
        if (raw == null) {
            return null;
        }
        byte[] decoded = sua.a(raw, -101);
        byte[] file = splitGroup(decoded, 10)[fileId];
        Constructor<qua> constructor = qua.class.getDeclaredConstructor(uia.class);
        constructor.setAccessible(true);
        return constructor.newInstance(new uia(file));
    }

    private static byte[] renderPcm(l player) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int silentTail = 0;
        int total = 0;
        int maxSamples = MAX_SECONDS * SAMPLE_RATE;
        while (total < maxSamples) {
            Arrays.fill(mix, 0);
            player.b(mix, 0, mix.length);
            boolean silent = true;
            for (int value : mix) {
                int sample = value >> 8;
                if (sample < -32768) sample = -32768;
                if (sample > 32767) sample = 32767;
                if (sample != 0) silent = false;
                out.write(sample & 0xff);
                out.write((sample >>> 8) & 0xff);
            }
            total += mix.length;
            if (silent) {
                silentTail += mix.length;
            } else {
                silentTail = 0;
            }
            if (!player.a((byte)-72) && silentTail >= TAIL_SILENCE_SAMPLES) {
                break;
            }
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

    private static final class CacheBackend extends dr {
        private final Path cache;
        private final int archive;
        private dla index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        dla a(boolean ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new dla(raw, sq.a(raw.length, raw, (byte)-100), null);
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(int group, byte ignored) {
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
