import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class Vertigo2AudioDumper {
    private static final Pattern LOAD = Pattern.compile(
        "\\b(hp|vh)\\.a\\([^,]+,\\s*\"([^\"]*)\",\\s*\"([^\"]*)\"\\)\\.(a|b)\\(\\)"
    );

    public static void main(String[] args) throws Exception {
        Path gameRoot = Path.of(args.length > 0 ? args[0] : ".work/games/vertigo2");
        Path outRoot = args.length > 1 ? Path.of(args[1]) : gameRoot.resolve("music");
        Path cache = args.length > 2 ? Path.of(args[2]) : gameRoot.resolve("js5-cache");
        Files.createDirectories(outRoot.resolve("samples"));

        r synthArchive = archive(cache, 7);
        r vorbisArchive = archive(cache, 8);
        Set<String> seen = new LinkedHashSet<>();
        int written = 0;

        List<Path> sources = Files.list(gameRoot.resolve("cfr"))
            .filter(path -> path.toString().endsWith(".java"))
            .sorted()
            .collect(Collectors.toList());
        for (Path source : sources) {
            Matcher matcher = LOAD.matcher(Files.readString(source));
            while (matcher.find()) {
                String loader = matcher.group(1);
                String group = matcher.group(2);
                String name = matcher.group(3);
                String key = loader + "\t" + group + "\t" + name;
                if (!seen.add(key)) {
                    continue;
                }

                ae sample;
                if (loader.equals("hp")) {
                    hp clip = hp.a(synthArchive, group, name);
                    if (clip == null) {
                        System.out.printf("missing hp %s/%s%n", group, name);
                        continue;
                    }
                    sample = clip.a();
                } else {
                    vh clip = vh.a(vorbisArchive, group, name);
                    if (clip == null) {
                        System.out.printf("missing vh %s/%s%n", group, name);
                        continue;
                    }
                    sample = clip.b();
                }

                Path wav = outRoot.resolve("samples/" + safeName(group + "_" + name) + ".wav");
                writeSampleWav(wav, sample);
                written++;
                System.out.printf("%s %s %.3fs%n", loader, wav.getFileName(), sample.s.length / (double)sample.r);
            }
        }
        System.out.printf("wrote %d wavs%n", written);
    }

    private static r archive(Path cache, int archive) {
        return new r(new CacheBackend(cache, archive), true, 1);
    }

    private static void writeSampleWav(Path out, ae sample) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(sample.s.length * 2);
        for (byte value : sample.s) {
            int s = value << 8;
            pcm.write(s & 0xff);
            pcm.write((s >>> 8) & 0xff);
        }
        writePcm16Wav(out, pcm.toByteArray(), sample.r);
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

    private static final class CacheBackend extends ab {
        private final Path cache;
        private final int archive;
        private ff index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        byte[] a(boolean ignored, int group) {
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
        ff a(boolean ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                index = new ff(raw, w.a(raw.length, raw, -7), null);
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
