import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class TetraLinkNativeBankExporter {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/tetralink-build17");
        Path output = args.length > 1 ? Path.of(args[1]) : root.resolve("native/funorb_tetralink.fobank");
        Files.createDirectories(output.getParent());

        TreeMap<Integer, Sample> samplesByKey = new TreeMap<>();
        decodeSynth(root.resolve("split/archive07"), samplesByKey);
        decodeVorbis(root.resolve("split/archive08"), samplesByKey);
        List<Sample> samples = new ArrayList<>(samplesByKey.values());
        Map<Sample, Integer> sampleIndexes = new HashMap<>();
        for (int i = 0; i < samples.size(); i++) {
            sampleIndexes.put(samples.get(i), i);
        }

        List<Patch> patches = loadPatches(root.resolve("split/archive09"), samplesByKey, sampleIndexes);
        try (DataOutputStream out = new DataOutputStream(Files.newOutputStream(output))) {
            writeAscii(out, "FOBK");
            writeLe32(out, 2);
            writeLe32(out, samples.size());
            for (Sample sample : samples) {
                writeLe32(out, sample.rate);
                writeLe32(out, sample.loopStart);
                writeLe32(out, sample.loopEnd);
                out.writeByte(sample.pingPong ? 1 : 0);
                writeLe32(out, sample.pcm.length);
                out.write(sample.pcm);
            }
            writeLe32(out, patches.size());
            for (Patch patch : patches) {
                writeLe16(out, patch.id);
                for (Region region : patch.regions) {
                    writeLe16(out, region.sampleIndex);
                    out.writeByte(region.rootKey);
                    writeLe16(out, region.tune);
                    out.writeByte(region.volume);
                    out.writeByte(region.pan);
                    out.writeByte(region.exclusiveClass);
                    writeLe16(out, region.pitch);
                    writeEnvelope(out, region.envelope);
                }
            }
        }
        System.out.printf("wrote %s samples=%d patches=%d%n", output, samples.size(), patches.size());
    }

    private static void decodeSynth(Path inDir, TreeMap<Integer, Sample> out) throws Exception {
        Constructor<ge> ctor = ge.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Method decode = ge.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        for (Path file : sortedBins(inDir, ".synth.bin")) {
            int id = fileId(file);
            ge sample = ctor.newInstance(new bh(Files.readAllBytes(file)));
            out.put(sampleKey(true, id), new Sample((wf)decode.invoke(sample)));
        }
    }

    private static void decodeVorbis(Path inDir, TreeMap<Integer, Sample> out) throws Exception {
        List<Path> files = sortedBins(inDir, ".packvorbis.bin");
        Method loadHeaders = ag.class.getDeclaredMethod("a", byte[].class);
        loadHeaders.setAccessible(true);
        Constructor<ag> ctor = ag.class.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Method decode = ag.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        for (Path header : files) {
            try {
                loadHeaders.invoke(null, (Object)Files.readAllBytes(header));
                for (Path file : files) {
                    if (file.equals(header)) {
                        continue;
                    }
                    int id = fileId(file);
                    ag sample = ctor.newInstance((Object)Files.readAllBytes(file));
                    out.put(sampleKey(false, id), new Sample((wf)decode.invoke(sample)));
                }
                return;
            } catch (ReflectiveOperationException | RuntimeException ignored) {
            }
        }
        throw new IllegalStateException("no archive08 Vorbis header found");
    }

    private static List<Patch> loadPatches(
        Path inDir,
        TreeMap<Integer, Sample> samples,
        Map<Sample, Integer> sampleIndexes
    ) throws Exception {
        Field refsField = ng.class.getDeclaredField("B");
        refsField.setAccessible(true);
        List<Patch> patches = new ArrayList<>();
        for (Path file : sortedBins(inDir, ".patch.bin")) {
            int patchId = fileId(file);
            ng patch = new ng(Files.readAllBytes(file));
            int[] refs = (int[])refsField.get(patch);
            Patch out = new Patch(patchId);
            for (int note = 0; note < 128; note++) {
                int ref = refs[note];
                if (ref == 0) {
                    continue;
                }
                int key = ref - 1;
                int sampleId = key >> 2;
                boolean synth = (key & 1) == 0;
                Sample sample = samples.get(sampleKey(synth, sampleId));
                if (sample == null) {
                    continue;
                }
                int pitch = patch.o[note] & 0x7fff;
                int group = patch.p[note];
                out.regions[note] = new Region(
                    sampleIndexes.get(sample),
                    pitch >> 8,
                    Math.round(-((pitch & 0xff) * 100.0f / 256.0f)),
                    patch.A[note] & 0xff,
                    patch.w[note] & 0xff,
                    group > 0 ? group : 0,
                    pitch,
                    new Envelope(patch.v[note])
                );
            }
            patches.add(out);
        }
        patches.sort(Comparator.comparingInt(patch -> patch.id));
        return patches;
    }

    private static List<Path> sortedBins(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream.filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static int sampleKey(boolean synth, int id) {
        return (synth ? 0 : 1000) + id;
    }

    private static int fileId(Path path) {
        String name = path.getFileName().toString();
        int start = name.indexOf("_file") + 5;
        int end = start;
        while (end < name.length() && Character.isDigit(name.charAt(end))) {
            end++;
        }
        return Integer.parseInt(name.substring(start, end));
    }

    private static void writeAscii(DataOutputStream out, String text) throws IOException {
        out.write(text.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
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

    private static void writeEnvelope(DataOutputStream out, Envelope envelope) throws IOException {
        out.writeByte(envelope.present ? 1 : 0);
        if (!envelope.present) {
            return;
        }
        writeLe32(out, envelope.a);
        writeLe32(out, envelope.b);
        writeLe32(out, envelope.c);
        writeLe32(out, envelope.h);
        writeLe32(out, envelope.i);
        writeLe32(out, envelope.j);
        writeLe32(out, envelope.k);
        writeByteArray(out, envelope.d);
        writeByteArray(out, envelope.e);
    }

    private static void writeByteArray(DataOutputStream out, byte[] bytes) throws IOException {
        writeLe16(out, bytes == null ? 0 : bytes.length);
        if (bytes != null) {
            out.write(bytes);
        }
    }

    private static final class Sample {
        final byte[] pcm;
        final int rate;
        final int loopStart;
        final int loopEnd;
        final boolean pingPong;

        Sample(wf pcm) {
            this.pcm = pcm.s;
            this.rate = pcm.o;
            this.loopStart = Math.max(0, Math.min(pcm.q, pcm.s.length));
            this.loopEnd = Math.max(this.loopStart, Math.min(pcm.r, pcm.s.length));
            this.pingPong = pcm.p;
        }
    }

    private static final class Patch {
        final int id;
        final Region[] regions = new Region[128];

        Patch(int id) {
            this.id = id;
            for (int i = 0; i < regions.length; i++) {
                regions[i] = Region.EMPTY;
            }
        }
    }

    private static final class Region {
        static final Region EMPTY = new Region(-1, 60, 0, 0, 64, 0);
        final int sampleIndex;
        final int rootKey;
        final int tune;
        final int volume;
        final int pan;
        final int exclusiveClass;
        final int pitch;
        final Envelope envelope;

        Region(int sampleIndex, int rootKey, int tune, int volume, int pan, int exclusiveClass) {
            this(sampleIndex, rootKey, tune, volume, pan, exclusiveClass, rootKey << 8, Envelope.EMPTY);
        }

        Region(int sampleIndex, int rootKey, int tune, int volume, int pan, int exclusiveClass, int pitch, Envelope envelope) {
            this.sampleIndex = sampleIndex;
            this.rootKey = rootKey;
            this.tune = tune;
            this.volume = volume;
            this.pan = pan;
            this.exclusiveClass = exclusiveClass;
            this.pitch = pitch;
            this.envelope = envelope;
        }
    }

    private static final class Envelope {
        static final Envelope EMPTY = new Envelope(null);
        final boolean present;
        final int a;
        final int b;
        final int c;
        final int h;
        final int i;
        final int j;
        final int k;
        final byte[] d;
        final byte[] e;

        Envelope(lm env) {
            this.present = env != null;
            if (env == null) {
                this.a = 0;
                this.b = 0;
                this.c = 0;
                this.h = 0;
                this.i = 0;
                this.j = 0;
                this.k = 0;
                this.d = null;
                this.e = null;
            } else {
                this.a = env.a;
                this.b = env.b;
                this.c = env.c;
                this.h = env.h;
                this.i = env.i;
                this.j = env.j;
                this.k = env.k;
                this.d = env.d;
                this.e = env.e;
            }
        }
    }
}
