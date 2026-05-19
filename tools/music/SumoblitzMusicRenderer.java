import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class SumoblitzMusicRenderer {
    private static final int SAMPLE_RATE = 48000;
    private static final int CHANNELS = 2;
    private static final int BUFFER_SAMPLES = 1024;

    public static void main(String[] args) throws Exception {
        try {
            run(args);
        } catch (Throwable t) {
            printThrowable(t, "");
            throw t;
        }
    }

    private static void run(String[] args) throws Exception {
        Path cache = Path.of(args.length > 0 ? args[0] : ".work/games/sumoblitz/js5-index6-9/build60/sumoblitz");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/sumoblitz/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        du.a(SAMPLE_RATE, true, 10);
        ki synth = archive(cache, 6);
        ki vorbis = archive(cache, 7);
        ki patches = archive(cache, 8);
        ki songs = archive(cache, 9);
        og samples = new og(synth, vorbis);
        Constructor<tv> trackConstructor = tv.class.getDeclaredConstructor(fs.class);
        trackConstructor.setAccessible(true);

        int written = 0;
        for (int fileId = 0; fileId <= 512; fileId++) {
            byte[] encoded;
            try {
                encoded = songs.a((byte)118, fileId, 0);
            } catch (RuntimeException ex) {
                continue;
            }
            if (encoded == null) {
                continue;
            }
            tv track = trackConstructor.newInstance(new fs(encoded));
            try {
                track.b();
                System.out.printf("fileId=%d patches=%s%n", fileId, patchIds(track));
            } catch (RuntimeException ex) {
                continue;
            }
            byte[] midi = repairMidi(track.k);
            String name = String.format("sumoblitz_archive9_file%03d", fileId);
            Path midiOut = outRoot.resolve("midi/" + name + ".mid");
            Files.write(midiOut, midi);
            Sequence sequence = MidiSystem.getSequence(midiOut.toFile());
            int storedSamples = storedSamples(sequence);

            bs player = new bs();
            player.a(177, 128, 9);
            if (!player.a(samples, track, -1, patches, 1 << 28)) {
                throw new IllegalStateException("could not hydrate instruments for fileId=" + fileId);
            }
            player.a(false, track, 77);

            byte[] pcm = render(player, storedSamples);
            Path wavOut = outRoot.resolve("wav/" + name + ".wav");
            writePcm16Wav(wavOut, pcm);
            System.out.printf(
                "music %s fileId=%d stored=%.3fs rendered=%.3fs%n",
                wavOut.getFileName(),
                fileId,
                storedSamples / (double)SAMPLE_RATE,
                pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2)
            );
            written++;
        }
        System.out.printf("wrote %d tracks%n", written);
    }

    private static String patchIds(tv track) {
        StringBuilder out = new StringBuilder();
        tj entry = (tj)track.l.a(52);
        while (entry != null) {
            if (out.length() > 0) {
                out.append(',');
            }
            out.append(entry.h);
            entry = (tj)track.l.a(true);
        }
        return out.toString();
    }

    private static void printThrowable(Throwable t, String indent) throws ReflectiveOperationException {
        System.err.println(indent + t.getClass().getName() + ": " + t.getMessage());
        if (t instanceof su) {
            System.err.println(indent + "context: " + su.class.getDeclaredField("a").get(t));
            Object cause = su.class.getDeclaredField("b").get(t);
            if (cause instanceof Throwable nested) {
                printThrowable(nested, indent + "  ");
            }
        } else if (t.getCause() != null) {
            printThrowable(t.getCause(), indent + "  ");
        }
    }

    private static ki archive(Path cache, int archive) {
        return new ki(new CacheBackend(cache, archive), true, 1);
    }

    private static int storedSamples(Sequence sequence) {
        return (int)Math.min(
            Integer.MAX_VALUE,
            (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
        );
    }

    private static byte[] render(bs player, int storedSamples) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        int rendered = 0;
        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(BUFFER_SAMPLES, storedSamples - rendered);
            player.b(mix, 0, count);
            for (int i = 0; i < count * CHANNELS; i++) {
                int sample = mix[i] >> 8;
                if (sample < Short.MIN_VALUE) {
                    sample = Short.MIN_VALUE;
                } else if (sample > Short.MAX_VALUE) {
                    sample = Short.MAX_VALUE;
                }
                pcm.write(sample & 0xff);
                pcm.write((sample >>> 8) & 0xff);
            }
            rendered += count;
        }
        return pcm.toByteArray();
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

    private static final class CacheBackend extends rb {
        private final Path cache;
        private final int archive;
        private sg index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        sg b(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new sg(raw, am.a(raw.length, raw, (byte)18), null);
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
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
        int sector = ((idx[offset + 3] & 0xff) << 16)
            | ((idx[offset + 4] & 0xff) << 8)
            | (idx[offset + 5] & 0xff);
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
