import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class TransmogrifyMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final String[] TRACKS = {
        "transmogrify intro jingle",
        "transmogrify 1-3",
        "transmogrify 4-6",
        "transmogrify 7-9",
        "transmogrify 10",
        "transmogrify linking jingle",
        "transmogrify title",
        "transmogrify complete well jingle",
        "transmogrify complete ok jingle",
        "transmogrify complete poor jingle",
    };

    public static void main(String[] args) throws Exception {
        Path cache = Paths.get(args.length > 0 ? args[0] : ".work/games/transmogrify/js5-cache-build13/transmogrify");
        Path outRoot = Paths.get(args.length > 1 ? args[1] : ".work/games/transmogrify/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        qh.a(SAMPLE_RATE, false, 1);
        ci synth = archive(cache, 2);
        ci vorbis = archive(cache, 3);
        ci patches = archive(cache, 4);
        ci music = archive(cache, 5);
        bl samples = new bl(synth, vorbis);

        for (String name : TRACKS) {
            pl track = pl.a(music, "", name);
            if (track == null) {
                throw new IllegalStateException("missing music track " + name);
            }
            if (!hydrate(track, samples, patches)) {
                throw new IllegalStateException("could not hydrate samples for " + name);
            }
            Path midiOut = outRoot.resolve("midi/" + safeName(name) + ".mid");
            byte[] midi = repairMidi(track.g);
            Files.write(midiOut, midi);
            Sequence sequence = MidiSystem.getSequence(midiOut.toFile());
            int storedSamples = (int)Math.min(
                Integer.MAX_VALUE,
                (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
            );

            lc player = new lc();
            player.b(128, 9, -23780);
            if (!player.a(-1, false, samples, track, patches)) {
                throw new IllegalStateException("could not hydrate player for " + name);
            }
            player.d(true);
            player.c(-1, 256, 0);
            player.f(16);
            player.a(-63, false, track);

            byte[] pcm = render(player, storedSamples);
            Path wavOut = outRoot.resolve("wav/" + safeName(name) + ".wav");
            writeMonoWav(wavOut, pcm);
            System.out.printf(
                "music %s stored=%.3fs rendered=%.3fs%n",
                wavOut.getFileName(),
                storedSamples / (double)SAMPLE_RATE,
                pcm.length / (double)(SAMPLE_RATE * 2)
            );
        }
    }

    private static boolean hydrate(pl track, bl samples, ci patches) {
        lc player = new lc();
        player.b(128, 9, -23780);
        return player.a(-1, false, samples, track, patches);
    }

    private static ci archive(Path cache, int archive) {
        return new ci(new CacheBackend(cache, archive), true, 1);
    }

    private static byte[] render(lc player, int storedSamples) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int rendered = 0;
        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(BUFFER_SAMPLES, storedSamples - rendered);
            player.b(mix, 0, count);
            for (int i = 0; i < count; i++) {
                int sample = mix[i] >> 8;
                if (sample < Short.MIN_VALUE) {
                    sample = Short.MIN_VALUE;
                } else if (sample > Short.MAX_VALUE) {
                    sample = Short.MAX_VALUE;
                }
                out.write(sample & 0xff);
                out.write((sample >>> 8) & 0xff);
            }
            rendered += count;
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

    private static String safeName(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
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

    private static final class CacheBackend extends ih {
        private final Path cache;
        private final int archive;
        private el index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        el a(int ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                try {
                    index = new el(raw, v.a(raw, raw.length, (byte)40), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new el(stripped, v.a(stripped, stripped.length, (byte)40), null);
                }
                return index;
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
        return out;
    }
}
