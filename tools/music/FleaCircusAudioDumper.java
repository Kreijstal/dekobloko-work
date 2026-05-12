import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class FleaCircusAudioDumper {
    private static final Pattern LOAD = Pattern.compile(
        "\\bqf\\.a\\([^,]+,\\s*\"([^\"]*)\",\\s*\"([^\"]*)\"\\)\\.b\\(\\)"
    );

    public static void main(String[] args) throws Exception {
        Path gameRoot = Path.of(args.length > 0 ? args[0] : ".work/games/fleacircus");
        Path outRoot = args.length > 1 ? Path.of(args[1]) : gameRoot.resolve("music");
        Path cache = args.length > 2 ? Path.of(args[2]) : gameRoot.resolve("js5-cache");
        Files.createDirectories(outRoot.resolve("samples"));

        rh archive2 = archive(cache, 2);
        Set<String> seen = new LinkedHashSet<>();
        int written = 0;
        for (Path source : Files.list(gameRoot.resolve("cfr")).filter(p -> p.toString().endsWith(".java")).sorted().toArray(Path[]::new)) {
            Matcher matcher = LOAD.matcher(Files.readString(source));
            while (matcher.find()) {
                String group = matcher.group(1);
                String name = matcher.group(2);
                String key = group + "\t" + name;
                if (!seen.add(key)) {
                    continue;
                }
                qf clip = qf.a(archive2, group, name);
                if (clip == null) {
                    System.out.printf("missing qf %s/%s%n", group, name);
                    continue;
                }
                sf sample = clip.b();
                Path wav = outRoot.resolve("samples/" + safeName(group + "_" + name) + ".wav");
                writeSampleWav(wav, sample);
                written++;
                System.out.printf("qf %s %.3fs%n", wav.getFileName(), sample.l.length / (double)sample.k);
            }
        }
        System.out.printf("wrote %d wavs%n", written);
    }

    private static rh archive(Path cache, int archive) {
        return new rh(new CacheBackend(cache, archive), true, 1);
    }

    private static void writeSampleWav(Path out, sf sample) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(sample.l.length * 2);
        for (byte value : sample.l) {
            int s = value << 8;
            pcm.write(s & 0xff);
            pcm.write((s >>> 8) & 0xff);
        }
        writePcm16Wav(out, pcm.toByteArray(), sample.k);
    }

    private static void writePcm16Wav(Path out, byte[] pcm, int sampleRate) throws IOException {
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

    private static final class CacheBackend extends gi {
        private final Path cache;
        private final int archive;
        private rf index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        rf a(int ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new rf(raw, ia.a(true, raw, raw.length), null);
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] b(int group, boolean ignored) {
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
