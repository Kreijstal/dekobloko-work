import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.lang.reflect.Constructor;
import java.util.Arrays;

public final class HostileSpawnMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int CHANNELS = 2;
    private static final int MAX_RENDER_SECONDS = 240;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final String[] TRACKS = {
        "hostilespawntitle",
        "hostilespawninstructions",
        "hostilespawnmissioncomplete",
        "hostilespawngameover",
        "Hostilespawnloop",
        "Hostilespawnloop_planet",
        "Hostilespawnloop_goo",
        "Hostilespawnthreat",
        "hostilespawnloop_vengeance",
        "hostilespawnthreat_vengeance",
    };

    public static void main(String[] args) throws Exception {
        Path gameRoot = Path.of(args.length > 0 ? args[0] : ".work/games/hostilespawn_vengeance");
        Path outRoot = args.length > 1 ? Path.of(args[1]) : gameRoot.resolve("music");
        Path cache = args.length > 2 ? Path.of(args[2]) : gameRoot.resolve("download-complete/hostilespawn_vengeance");
        Files.createDirectories(outRoot.resolve("wav"));

        ug.a(SAMPLE_RATE, true, 10);
        gb synthArchive = archive(cache, 1);
        gb vorbisArchive = archive(cache, 2);
        gb musicArchive = archive(cache, 3);
        gb patchArchive = archive(cache, 7);
        rd samples = new rd(synthArchive, vorbisArchive);

        Constructor<ji> songConstructor = ji.class.getDeclaredConstructor(vi.class);
        songConstructor.setAccessible(true);

        for (int i = 0; i < TRACKS.length; i++) {
            String name = TRACKS[i];
            ji song = ji.a(musicArchive, "", name);
            if (song == null) {
                byte[] raw = musicArchive.a(false, i, 0);
                if (raw != null) {
                    try {
                        song = songConstructor.newInstance(new vi(raw));
                    } catch (ReflectiveOperationException | RuntimeException ex) {
                        song = null;
                    }
                }
            }
            if (song == null) {
                System.out.printf("missing %s%n", name);
                continue;
            }
            w player = new w();
            player.c(2, 128, 9);
            boolean hydrated;
            try {
                hydrated = player.a(0, song, patchArchive, samples, false);
            } catch (RuntimeException ex) {
                System.out.printf("unhydrated %s (%s)%n", name, ex.getClass().getSimpleName());
                continue;
            }
            if (!hydrated) {
                System.out.printf("unhydrated %s%n", name);
                continue;
            }
            player.a(false, (byte)124, false, song);

            byte[] pcm = render(player);
            Path wav = outRoot.resolve("wav/" + safeName(name) + ".wav");
            writePcm16Wav(wav, pcm);
            System.out.printf("music %s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2));
        }
    }

    private static gb archive(Path cache, int archive) {
        return new gb(new CacheBackend(cache, archive), true, 1);
    }

    private static byte[] render(w player) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        int silentTail = 0;
        int rendered = 0;
        int maxSamples = SAMPLE_RATE * MAX_RENDER_SECONDS;
        while (rendered < maxSamples) {
            Arrays.fill(mix, 0);
            player.b(mix, 0, BUFFER_SAMPLES);
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
            if (silentTail >= TAIL_SILENCE_SAMPLES || player.f(323697071)) {
                break;
            }
        }
        byte[] bytes = pcm.toByteArray();
        int trim = Math.min(silentTail, TAIL_SILENCE_SAMPLES) * CHANNELS * 2;
        if (trim > 0 && trim < bytes.length) {
            return Arrays.copyOf(bytes, bytes.length - trim);
        }
        return bytes;
    }

    private static void writePcm16(ByteArrayOutputStream out, int sample) {
        int s = Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, sample));
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

    private static final class CacheBackend extends uk {
        private final Path cache;
        private final int archive;
        private wc index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
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
        int b(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
            }
        }

        @Override
        wc c(int ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new wc(raw, pi.a(raw.length, 31465, raw), null);
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
