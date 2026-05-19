import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

public final class ConfinedMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int CHANNELS = 2;
    private static final int BUFFER_SAMPLES = 1024;

    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args.length > 0 ? args[0] : ".work/games/confined/js5-index7-9/build20/confined");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/confined/music");
        Files.createDirectories(outRoot.resolve("wav"));

        dk.a(SAMPLE_RATE, true, 10);
        mi synth = archive(cache, 7);
        mi vorbis = archive(cache, 8);
        mi songs = archive(cache, 9);
        m samples = new m(synth, vorbis);
        vk sequence = gi.a(samples, (byte)-65, songs, "music/music", "");
        if (sequence == null) {
            throw new IllegalStateException("missing music/music");
        }

        dd player = new dd(sequence);
        disableLoop(player);
        player.b(64);
        player.b(66, 32);
        player.d();

        be mixer = new be();
        mixer.a(player);
        byte[] pcm = render(mixer, player);
        Path wavOut = outRoot.resolve("wav/music_music.wav");
        writePcm16Wav(wavOut, pcm);
        System.out.printf("music %s rendered=%.3fs%n", wavOut.getFileName(), pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2));
    }

    private static mi archive(Path cache, int archive) {
        return new mi(new CacheBackend(cache, archive), true, 1);
    }

    private static void disableLoop(dd player) throws ReflectiveOperationException {
        Field loop = dd.class.getDeclaredField("X");
        loop.setAccessible(true);
        loop.setBoolean(player, false);
    }

    private static byte[] render(be mixer, dd player) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        while (player.n != null) {
            Arrays.fill(mix, 0);
            mixer.a(mix, 0, BUFFER_SAMPLES);
            for (int i = 0; i < BUFFER_SAMPLES * CHANNELS; i++) {
                int sample = mix[i] >> 8;
                if (sample < Short.MIN_VALUE) {
                    sample = Short.MIN_VALUE;
                } else if (sample > Short.MAX_VALUE) {
                    sample = Short.MAX_VALUE;
                }
                pcm.write(sample & 0xff);
                pcm.write((sample >>> 8) & 0xff);
            }
        }
        return pcm.toByteArray();
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

    private static final class CacheBackend extends tk {
        private final Path cache;
        private final int archive;
        private we index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        we a(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new we(raw, in.a(raw.length, raw, -127), null);
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int group, boolean ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
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
