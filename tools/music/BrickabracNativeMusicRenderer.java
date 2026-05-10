import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

public final class BrickabracNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/brickabrac");
        Path archive8SampleCache = args.length > 1 ? Path.of(args[1]) : defaultArchive8SampleCache();
        Path outRoot = root.resolve("wav-native/archive10_tracks");
        Files.createDirectories(outRoot);

        tj.q = SAMPLE_RATE;
        tj.g = false;

        Constructor<vm> trackCtor = vm.class.getDeclaredConstructor(wq.class);
        trackCtor.setAccessible(true);

        List<Path> trackFiles = sorted(root.resolve("split/archive10"), ".vm.bin");
        Set<Integer> patchIds = collectPatchIds(trackCtor, trackFiles);
        mf archive9 = archive(root, 9, patchIds);
        SampleIds sampleIds = collectSampleIds(archive9, patchIds);
        mf archive7 = archive(root, 7, sampleIds.archive7);
        mf archive8 = vorbisArchive(root, archive8SampleCache, sampleIds.archive8);
        wp samples = new wp(archive7, archive8);

        System.err.printf(
            "patches=%d samples7=%d samples8=%d%n",
            patchIds.size(),
            sampleIds.archive7.size(),
            sampleIds.archive8.size());

        for (Path file : trackFiles) {
            vm track = trackCtor.newInstance(new wq(Files.readAllBytes(file)));
            ie player = new ie();
            if (!player.a(-114, track, 1 << 28, archive9, samples)) {
                throw new IllegalStateException("failed to hydrate instruments for " + file.getFileName());
            }
            player.a(track, -61, false);

            byte[] pcm = renderPcm(player);
            Path out = outRoot.resolve(file.getFileName().toString().replace(".vm.bin", ".wav"));
            writeMonoWav(out, pcm);
            System.out.printf("%s %d bytes%n", out.getFileName(), Files.size(out));
        }
    }

    private static Set<Integer> collectPatchIds(Constructor<vm> trackCtor, List<Path> trackFiles) throws Exception {
        TreeSet<Integer> ids = new TreeSet<>();
        for (Path file : trackFiles) {
            vm track = trackCtor.newInstance(new wq(Files.readAllBytes(file)));
            track.b();
            for (se entry = (se) track.i.b(-15519); entry != null; entry = (se) track.i.a(true)) {
                ids.add((int) entry.g);
            }
        }
        return ids;
    }

    private static SampleIds collectSampleIds(mf patchArchive, Set<Integer> patchIds) throws Exception {
        Field sampleMapField = pq.class.getDeclaredField("s");
        sampleMapField.setAccessible(true);
        TreeSet<Integer> archive7 = new TreeSet<>();
        TreeSet<Integer> archive8 = new TreeSet<>();
        for (int patchId : patchIds) {
            pq patch = mi.a(patchArchive, patchId, 8);
            if (patch == null) {
                throw new IllegalStateException("missing patch " + patchId);
            }
            int[] sampleMap = (int[]) sampleMapField.get(patch);
            for (int encoded : sampleMap) {
                if (encoded == 0) {
                    continue;
                }
                int sample = encoded - 1;
                if ((sample & 1) == 0) {
                    archive7.add(sample >> 2);
                } else {
                    archive8.add(sample >> 2);
                }
            }
        }
        return new SampleIds(archive7, archive8);
    }

    private static mf archive(Path root, int archive, Set<Integer> fileIds) throws IOException {
        Path raw = root.resolve(String.format("raw/archive%02d_group000.container.bin", archive));
        return new mf(new SingleGroupArchive(Files.readAllBytes(raw), fileIds), true, 1);
    }

    private static Path defaultArchive8SampleCache() {
        Path preferred = Path.of(".work/js5-caches/brickabrac");
        if (Files.exists(preferred.resolve("main_file_cache.dat2"))) {
            return preferred;
        }
        return Path.of(".work/js5-caches-brickabrac-full/brickabrac");
    }

    private static mf vorbisArchive(Path root, Path sampleCache, Set<Integer> groupIds) throws IOException {
        Map<Integer, byte[]> groups = new HashMap<>();
        groups.put(0, Files.readAllBytes(root.resolve("raw/archive08_group000.container.bin")));

        if (!Files.exists(sampleCache.resolve("main_file_cache.dat2"))) {
            throw new IOException("archive 8 sample cache not found: " + sampleCache);
        }

        List<Integer> missing = new ArrayList<>();
        for (int groupId : groupIds) {
            if (groupId == 0) {
                continue;
            }
            byte[] raw = readCacheGroup(sampleCache, 8, groupId);
            if (raw == null) {
                missing.add(groupId);
            } else {
                groups.put(groupId, raw);
            }
        }
        if (!missing.isEmpty()) {
            throw new IOException("missing archive 8 Vorbis sample groups in " + sampleCache + ": " + missing);
        }
        return new mf(new MultiGroupArchive(groups), true, 1);
    }

    private static byte[] readCacheGroup(Path cache, int archive, int group) throws IOException {
        Path data = cache.resolve("main_file_cache.dat2");
        Path index = cache.resolve("main_file_cache.idx" + archive);
        if (!Files.exists(data) || !Files.exists(index)) {
            return null;
        }
        byte[] idx = Files.readAllBytes(index);
        int offset = group * 6;
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
                throw new IOException("bad sector " + sector + " for archive " + archive + " group " + group);
            }
            int gotGroup = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16)
                | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
            int gotArchive = dat[sectorOffset + 7] & 0xff;
            if (gotGroup != group || gotChunk != chunk || gotArchive != archive) {
                throw new IOException("bad sector header for archive " + archive + " group " + group);
            }
            int n = Math.min(512, size - copied);
            System.arraycopy(dat, sectorOffset + 8, out, copied, n);
            copied += n;
            sector = next;
            chunk++;
        }
        return out;
    }

    private static byte[] renderPcm(ie player) throws IOException {
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
            if (!player.d(-1) && silentTail >= TAIL_SILENCE_SAMPLES) {
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

    private static List<Path> sorted(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static final class SampleIds {
        private final Set<Integer> archive7;
        private final Set<Integer> archive8;

        SampleIds(Set<Integer> archive7, Set<Integer> archive8) {
            this.archive7 = archive7;
            this.archive8 = archive8;
        }
    }

    private static final class SingleGroupArchive extends bc {
        private final byte[] group0;
        private final byte[] index;
        private ko parsedIndex;

        SingleGroupArchive(byte[] group0, Set<Integer> fileIds) throws IOException {
            this.group0 = group0;
            this.index = js5Container(buildIndex(fileIds));
        }

        @Override
        ko b(byte ignored) {
            if (parsedIndex == null) {
                parsedIndex = new ko(index, cg.a(index.length, index, (byte) -86), null);
            }
            return parsedIndex;
        }

        @Override
        byte[] a(int group, byte ignored) {
            return group == 0 ? group0 : null;
        }

        @Override
        int a(byte ignored, int group) {
            return group == 0 ? 100 : 0;
        }

        private static byte[] buildIndex(Set<Integer> fileIds) throws IOException {
            if (fileIds.isEmpty()) {
                fileIds = Set.of(0);
            }
            List<Integer> ids = new ArrayList<>(fileIds);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(bytes);
            out.writeByte(6);        // JS5 index version.
            out.writeInt(0);         // index revision.
            out.writeByte(0);        // no name hashes.
            out.writeShort(1);       // one group.
            out.writeShort(0);       // group id delta: group 0.
            out.writeInt(0);         // group CRC is not checked by this synthetic bc.
            out.writeInt(0);         // group version.
            out.writeShort(ids.size());
            int previous = 0;
            for (int i = 0; i < ids.size(); i++) {
                int id = ids.get(i);
                out.writeShort(i == 0 ? id : id - previous);
                previous = id;
            }
            return bytes.toByteArray();
        }

        private static byte[] js5Container(byte[] payload) throws IOException {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(bytes);
            out.writeByte(0);
            out.writeInt(payload.length);
            out.write(payload);
            return bytes.toByteArray();
        }
    }

    private static final class MultiGroupArchive extends bc {
        private final Map<Integer, byte[]> groups;
        private final byte[] index;
        private ko parsedIndex;

        MultiGroupArchive(Map<Integer, byte[]> groups) throws IOException {
            this.groups = groups;
            this.index = SingleGroupArchive.js5Container(buildIndex(groups.keySet()));
        }

        @Override
        ko b(byte ignored) {
            if (parsedIndex == null) {
                parsedIndex = new ko(index, cg.a(index.length, index, (byte) -86), null);
            }
            return parsedIndex;
        }

        @Override
        byte[] a(int group, byte ignored) {
            if (Boolean.getBoolean("brickabrac.renderer.traceArchive8")) {
                System.err.printf("archive8 group=%d bytes=%s%n", group, groups.containsKey(group) ? groups.get(group).length : "missing");
            }
            return groups.get(group);
        }

        @Override
        int a(byte ignored, int group) {
            return groups.containsKey(group) ? 100 : 0;
        }

        private static byte[] buildIndex(Set<Integer> groupIds) throws IOException {
            List<Integer> ids = new ArrayList<>(new TreeSet<>(groupIds));
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            DataOutputStream out = new DataOutputStream(bytes);
            out.writeByte(6);
            out.writeInt(0);
            out.writeByte(0);
            out.writeShort(ids.size());
            int previous = 0;
            for (int i = 0; i < ids.size(); i++) {
                int id = ids.get(i);
                out.writeShort(i == 0 ? id : id - previous);
                previous = id;
            }
            for (int ignored : ids) {
                out.writeInt(0);
            }
            for (int ignored : ids) {
                out.writeInt(0);
            }
            for (int ignored : ids) {
                out.writeShort(1);
            }
            for (int ignored : ids) {
                out.writeShort(0);
            }
            return bytes.toByteArray();
        }
    }
}
