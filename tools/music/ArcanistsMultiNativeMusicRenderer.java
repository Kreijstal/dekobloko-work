import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;

public final class ArcanistsMultiNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = SAMPLE_RATE;
    private static final int MAX_SECONDS = 180;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 3;
    private static final String[] TRACKS = {
        "arcanists_titlescreen",
        "arcanists_grassland",
    };

    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args.length > 0 ? args[0] : ".work/games/arcanistsmulti/js5-cache");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/arcanistsmulti/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        lb.a(SAMPLE_RATE, false, 0);
        eg sampleArchive2 = archive(cache, 2);
        eg sampleArchive3 = archive(cache, 3);
        eg patchArchive = archive(cache, 4);
        eg songArchive = archive(cache, 5);
        gi samples = new gi(sampleArchive2, sampleArchive3);

        int written = 0;
        for (String name : TRACKS) {
            ha track = ha.a(songArchive, "", name);
            if (track == null) {
                System.out.printf("missing %s%n", name);
                continue;
            }

            byte[] midi = repairMidi(track.g);
            Path midiOut = outRoot.resolve("midi/" + name + ".mid");
            Files.write(midiOut, midi);
            MidiSystem.getSequence(midiOut.toFile());

            gh player = new gh();
            player.b(128, 68, 9);
            if (!player.a(0, samples, patchArchive, track, -123)) {
                throw new IllegalStateException("could not hydrate instruments for " + name);
            }
            player.a((byte)-96, false, track);
            byte[] pcm = renderPcm(player);
            Path wavOut = outRoot.resolve("wav/" + name + ".wav");
            writeMonoWav(wavOut, pcm);
            System.out.printf("track %s midi=%d wav=%d%n", name, midi.length, pcm.length);
            written++;
        }
        System.out.printf("wrote %d tracks%n", written);
    }

    private static byte[] renderPcm(gh player) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int silentTail = 0;
        int total = 0;
        int maxSamples = MAX_SECONDS * SAMPLE_RATE;
        while (total < maxSamples) {
            Arrays.fill(mix, 0);
            player.a(mix, 0, mix.length);
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
            if (!player.e((byte)-8) && silentTail >= TAIL_SILENCE_SAMPLES) {
                break;
            }
        }
        return out.toByteArray();
    }

    private static eg archive(Path cache, int archive) {
        return new eg(new CacheBackend(cache, archive), true, 1);
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
                pos = (int) (parsed >>> 32);
                int length = (int) parsed;
                for (int i = 0; i < length && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            } else if (status == 0xf0 || status == 0xf7) {
                long parsed = copyVarIntWithValue(midi, pos, out);
                pos = (int) (parsed >>> 32);
                int length = (int) parsed;
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
        return ((long) pos << 32) | (value & 0xffffffffL);
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

    private static final class CacheBackend extends tl {
        private final Path cache;
        private final int archive;
        private jk index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        jk d(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                try {
                    index = new jk(raw, mj.a(raw.length, (byte)-104, raw), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new jk(stripped, mj.a(stripped.length, (byte)-104, stripped), null);
                }
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(int group, boolean ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int group, byte ignored) {
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
        return out;
    }
}
