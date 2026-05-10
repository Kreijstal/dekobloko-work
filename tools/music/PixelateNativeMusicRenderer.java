import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

public final class PixelateNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final List<String> TRACK_NAMES = List.of(
        "pix_title",
        "pix_end_game",
        "skin1",
        "skin2",
        "skin3",
        "skin4",
        "skin5",
        "skin6",
        "skin7",
        "skin8",
        "skin9",
        "skin10",
        "skin11",
        "skin12",
        "skin13",
        "skin14",
        "skin15",
        "skin16"
    );

    public static void main(String[] args) throws Exception {
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/music/pixelate-build55");
        Path cache = args.length > 1
            ? Path.of(args[1])
            : Path.of(".work/js5-caches-pixelate-build55/pixelate");
        Files.createDirectories(outRoot.resolve("midi/archive10_tracks"));
        Files.createDirectories(outRoot.resolve("wav-native/archive10_tracks"));

        mm.h = SAMPLE_RATE;
        mm.o = false;

        fm archive7 = archive(cache, 7);
        fm archive8 = archive(cache, 8);
        fm archive9 = archive(cache, 9);
        fm archive10 = archive(cache, 10);
        po samples = new po(archive7, archive8);

        for (String name : TRACK_NAMES) {
            ua track = ua.a(archive10, "", name);
            if (track == null) {
                throw new IllegalStateException("missing Pixelate music track " + name);
            }

            Files.write(outRoot.resolve("midi/archive10_tracks/" + name + ".mid"), track.k);

            ti player = new ti();
            if (!player.a(track, samples, archive9, 109, 1 << 28)) {
                throw new IllegalStateException("failed to hydrate Pixelate instruments for " + name);
            }
            player.a(track, -39, false);

            byte[] pcm = renderPcm(player);
            Path wav = outRoot.resolve("wav-native/archive10_tracks/" + name + ".wav");
            writeMonoWav(wav, pcm);
            System.out.printf("%s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
        }
    }

    private static fm archive(Path cache, int archive) throws IOException {
        return new fm(new CacheArchive(cache, archive), true, 1);
    }

    private static byte[] renderPcm(ti player) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int silentTail = 0;
        int maxSamples = SAMPLE_RATE * MAX_SECONDS;
        int rendered = 0;

        while (rendered < maxSamples) {
            Arrays.fill(mix, 0);
            player.b(mix, 0, mix.length);

            boolean silent = true;
            for (int sample : mix) {
                if (sample != 0) {
                    silent = false;
                }
                int s = sample >> 8;
                if (s < Short.MIN_VALUE) {
                    s = Short.MIN_VALUE;
                } else if (s > Short.MAX_VALUE) {
                    s = Short.MAX_VALUE;
                }
                pcm.write(s & 0xff);
                pcm.write((s >>> 8) & 0xff);
            }

            rendered += mix.length;
            if (silent) {
                silentTail += mix.length;
            } else {
                silentTail = 0;
            }
            if (!player.a((byte)82) && silentTail >= TAIL_SILENCE_SAMPLES) {
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

    private static void writeMonoWav(Path out, byte[] pcm) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            writeAscii(data, "RIFF");
            writeLe32(data, 36 + pcm.length);
            writeAscii(data, "WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, 1);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * 2);
            writeLe16(data, 2);
            writeLe16(data, 16);
            writeAscii(data, "data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
    }

    private static void writeAscii(DataOutputStream out, String s) throws IOException {
        out.writeBytes(s);
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

    private static byte[] readCacheGroup(Path cache, int index, int archive) throws IOException {
        Path data = cache.resolve("main_file_cache.dat2");
        Path indexPath = cache.resolve("main_file_cache.idx" + index);
        byte[] idx = Files.readAllBytes(indexPath);
        int offset = archive * 6;
        if (offset + 6 > idx.length) {
            return null;
        }
        int size = ((idx[offset] & 0xff) << 16) | ((idx[offset + 1] & 0xff) << 8) | (idx[offset + 2] & 0xff);
        int sector = ((idx[offset + 3] & 0xff) << 16) | ((idx[offset + 4] & 0xff) << 8) | (idx[offset + 5] & 0xff);
        if (size == 0 || sector == 0) {
            return null;
        }

        byte[] dat = Files.readAllBytes(data);
        byte[] out = new byte[size];
        int copied = 0;
        int chunk = 0;
        while (copied < size) {
            int sectorOffset = sector * 520;
            if (sectorOffset + 8 > dat.length) {
                throw new IOException("bad sector " + sector + " for index " + index + " archive " + archive);
            }
            int gotArchive = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16)
                | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
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

    private static final class CacheArchive extends jp {
        private final Path cache;
        private final int archive;
        private kj index;

        CacheArchive(Path cache, int archive) {
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
        kj a(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = new kj(raw, wg.a(raw, 125, raw.length), null);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
