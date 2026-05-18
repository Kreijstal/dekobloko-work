import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class GeobloxAudioDumper {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;

    private static final String[] TRACKS = {
        "title_music_loop",
        "game_over",
        "sun",
        "bonus_bubble_jingle",
    };

    public static void main(String[] args) throws Exception {
        Path cache = Paths.get(args.length > 0 ? args[0] : ".work/games/geoblox/js5-cache-audio");
        Path outRoot = Paths.get(args.length > 1 ? args[1] : ".work/games/geoblox/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        qk.a(SAMPLE_RATE, false, 10);

        rh synthArchive = archive(cache, 2);
        rh vorbisArchive = archive(cache, 3);
        rh patchArchive = archive(cache, 4);
        rh songArchive = archive(cache, 5);
        ci samples = new ci(synthArchive, vorbisArchive);

        for (String name : TRACKS) {
            rf track = rf.a(songArchive, "", name);
            if (track == null) {
                throw new IllegalStateException("missing track " + name);
            }

            Path midi = outRoot.resolve("midi/" + safeName(name) + ".mid");
            Files.write(midi, repairMidi(byteArrayField(track, "rf_f", "f")));
            Sequence sequence = MidiSystem.getSequence(midi.toFile());
            int storedSamples = storedSamples(sequence);

            kj player = new kj();
            if (!player.a(samples, 0, -1, track, patchArchive)) {
                throw new IllegalStateException("failed to hydrate track " + name);
            }
            player.a(false, track, -1706);

            byte[] pcm = renderPcm(player, storedSamples);
            Path wav = outRoot.resolve("wav/" + safeName(name) + ".wav");
            writeWav(wav, pcm, SAMPLE_RATE);
            System.out.printf("track %s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
        }
    }

    private static rh archive(Path cache, int archive) {
        return new rh(new CacheBackend(cache, archive), true, 1);
    }

    private static int storedSamples(Sequence sequence) {
        return (int)Math.min(
            Integer.MAX_VALUE,
            (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
        );
    }

    private static byte[] renderPcm(kj player, int storedSamples) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int rendered = 0;
        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(BUFFER_SAMPLES, storedSamples - rendered);
            player.a(mix, 0, count);
            for (int i = 0; i < count; i++) {
                int sample = mix[i];
                writePcm16(pcm, sample >> 8);
            }
            rendered += count;
        }
        return pcm.toByteArray();
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

    private static byte[] byteArrayField(Object target, String... names) {
        try {
            return (byte[])field(target.getClass(), names).get(target);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    private static Field field(Class<?> owner, String... names) throws NoSuchFieldException {
        for (String name : names) {
            try {
                Field field = owner.getDeclaredField(name);
                field.setAccessible(true);
                return field;
            } catch (NoSuchFieldException ignored) {
                // Try the next known obfuscated/deobfuscated spelling.
            }
        }
        throw new NoSuchFieldException(owner.getName() + "." + Arrays.toString(names));
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

    private static void writeBe32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }

    private static final class CacheBackend extends nh {
        private final Path cache;
        private final int archive;
        private bm index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        bm a(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                try {
                    index = new bm(raw, gg.a(raw, 107, raw.length), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new bm(stripped, gg.a(stripped, 107, stripped.length), null);
                }
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] b(int ignored, int group) {
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
        return out;
    }
}
