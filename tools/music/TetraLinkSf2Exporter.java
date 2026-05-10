import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class TetraLinkSf2Exporter {
    private static final int GEN_PAN = 17;
    private static final int GEN_INSTRUMENT = 41;
    private static final int GEN_KEY_RANGE = 43;
    private static final int GEN_INITIAL_ATTENUATION = 48;
    private static final int GEN_FINE_TUNE = 52;
    private static final int GEN_SAMPLE_ID = 53;
    private static final int GEN_SAMPLE_MODES = 54;
    private static final int GEN_EXCLUSIVE_CLASS = 57;
    private static final int GEN_OVERRIDING_ROOT_KEY = 58;

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/tetralink-build17");
        Path output = args.length > 1
            ? Path.of(args[1])
            : root.resolve("sf2/funorb_tetralink.sf2");
        Files.createDirectories(output.getParent());

        TreeMap<Integer, Sample> samples = new TreeMap<>();
        decodeSynth(root.resolve("split/archive07"), samples);
        decodeVorbis(root.resolve("split/archive08"), samples);
        List<Patch> patches = loadPatches(root.resolve("split/archive09"), samples);

        byte[] sf2 = buildSf2(samples, patches);
        Files.write(output, sf2);

        int regions = 0;
        int missing = 0;
        for (Patch patch : patches) {
            regions += patch.regions.size();
            missing += patch.missingRegions;
        }
        System.out.printf(
            "wrote %s presets=%d samples=%d regions=%d missing_regions=%d size=%d%n",
            output,
            patches.size(),
            samples.size(),
            regions,
            missing,
            sf2.length
        );
    }

    private static void decodeSynth(Path inDir, TreeMap<Integer, Sample> out) throws Exception {
        Constructor<ge> ctor = ge.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Method decode = ge.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        for (Path file : sortedBins(inDir, ".synth.bin")) {
            int id = fileId(file);
            ge sample = ctor.newInstance(new bh(Files.readAllBytes(file)));
            out.put(sampleKey(true, id), new Sample("synth_" + id, (wf) decode.invoke(sample)));
        }
    }

    private static void decodeVorbis(Path inDir, TreeMap<Integer, Sample> out) throws Exception {
        List<Path> files = sortedBins(inDir, ".packvorbis.bin");
        if (files.isEmpty()) {
            return;
        }
        Method loadHeaders = ag.class.getDeclaredMethod("a", byte[].class);
        loadHeaders.setAccessible(true);
        Constructor<ag> ctor = ag.class.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Method decode = ag.class.getDeclaredMethod("b");
        decode.setAccessible(true);

        Exception lastError = null;
        for (Path header : files) {
            try {
                loadHeaders.invoke(null, (Object) Files.readAllBytes(header));
                TreeMap<Integer, Sample> decoded = new TreeMap<>();
                for (Path file : files) {
                    if (file.equals(header)) {
                        continue;
                    }
                    int id = fileId(file);
                    ag sample = ctor.newInstance((Object) Files.readAllBytes(file));
                    decoded.put(sampleKey(false, id), new Sample("vorbis_" + id, (wf) decode.invoke(sample)));
                }
                out.putAll(decoded);
                return;
            } catch (ReflectiveOperationException | RuntimeException ex) {
                lastError = ex instanceof Exception ? (Exception) ex : new Exception(ex);
            }
        }
        throw lastError != null ? lastError : new IllegalStateException("no archive08 Vorbis header found");
    }

    private static List<Patch> loadPatches(Path inDir, TreeMap<Integer, Sample> samples) throws Exception {
        Field refsField = ng.class.getDeclaredField("B");
        refsField.setAccessible(true);
        List<Patch> patches = new ArrayList<>();
        for (Path file : sortedBins(inDir, ".patch.bin")) {
            int patchId = fileId(file);
            ng ngPatch = new ng(Files.readAllBytes(file));
            int[] refs = (int[]) refsField.get(ngPatch);
            Patch patch = new Patch(patchId);
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
                    patch.missingRegions++;
                    continue;
                }
                patch.regions.add(new Region(ngPatch, note, sample));
            }
            patches.add(patch);
        }
        patches.sort(Comparator.comparingInt(patch -> patch.id));
        return patches;
    }

    private static byte[] buildSf2(TreeMap<Integer, Sample> samplesByKey, List<Patch> patches) throws IOException {
        List<Sample> samples = new ArrayList<>(samplesByKey.values());
        Map<Sample, Integer> sampleIndexes = new HashMap<>();
        for (int i = 0; i < samples.size(); i++) {
            sampleIndexes.put(samples.get(i), i);
        }

        byte[] info = list("INFO",
            chunk("ifil", le16Bytes(2, 1)),
            chunk("isng", zstr("EMU8000")),
            chunk("INAM", zstr("FunOrb TetraLink"))
        );
        byte[] smpl = chunk("smpl", sampleData(samples));
        byte[] sdta = list("sdta", smpl);
        byte[] pdta = buildPdta(samples, sampleIndexes, patches);
        return riff("sfbk", info, sdta, pdta);
    }

    private static byte[] buildPdta(List<Sample> samples, Map<Sample, Integer> sampleIndexes, List<Patch> patches) throws IOException {
        List<Bag> pbag = new ArrayList<>();
        List<Gen> pgen = new ArrayList<>();
        List<Bag> ibag = new ArrayList<>();
        List<Gen> igen = new ArrayList<>();

        ByteArrayOutputStream phdr = new ByteArrayOutputStream();
        DataOutputStream ph = new DataOutputStream(phdr);
        ByteArrayOutputStream inst = new ByteArrayOutputStream();
        DataOutputStream in = new DataOutputStream(inst);

        int instrumentIndex = 0;
        for (Patch patch : patches) {
            int preset = patch.id == 128 ? 0 : patch.id & 0x7f;
            int bank = patch.id == 128 ? 128 : patch.id >> 7;
            writePresetHeader(ph, "patch_" + patch.id, preset, bank, pbag.size());
            pbag.add(new Bag(pgen.size(), 0));
            pgen.add(new Gen(GEN_INSTRUMENT, instrumentIndex));

            writeInstrument(in, "patch_" + patch.id, ibag.size());
            for (Region region : patch.regions) {
                ibag.add(new Bag(igen.size(), 0));
                appendRegionGens(igen, region, sampleIndexes.get(region.sample));
            }
            instrumentIndex++;
        }
        writePresetHeader(ph, "EOP", 0, 0, pbag.size());
        pbag.add(new Bag(pgen.size(), 0));
        writeInstrument(in, "EOI", ibag.size());
        ibag.add(new Bag(igen.size(), 0));

        return list("pdta",
            chunk("phdr", phdr.toByteArray()),
            chunk("pbag", bagBytes(pbag)),
            chunk("pmod", zeroBytes(10)),
            chunk("pgen", genBytes(pgen)),
            chunk("inst", inst.toByteArray()),
            chunk("ibag", bagBytes(ibag)),
            chunk("imod", zeroBytes(10)),
            chunk("igen", genBytes(igen)),
            chunk("shdr", sampleHeaders(samples))
        );
    }

    private static void appendRegionGens(List<Gen> gens, Region region, int sampleIndex) {
        gens.add(new Gen(GEN_KEY_RANGE, region.note | (region.note << 8)));
        gens.add(new Gen(GEN_OVERRIDING_ROOT_KEY, region.rootKey));
        if (region.tune != 0) {
            gens.add(new Gen(GEN_FINE_TUNE, region.tune));
        }
        if (region.attenuation > 0) {
            gens.add(new Gen(GEN_INITIAL_ATTENUATION, region.attenuation));
        }
        if (region.pan != 0) {
            gens.add(new Gen(GEN_PAN, region.pan));
        }
        if (region.exclusiveClass > 0) {
            gens.add(new Gen(GEN_EXCLUSIVE_CLASS, region.exclusiveClass));
        }
        if (region.sample.loopEnd > region.sample.loopStart) {
            gens.add(new Gen(GEN_SAMPLE_MODES, region.sample.pingPong ? 2 : 1));
        }
        gens.add(new Gen(GEN_SAMPLE_ID, sampleIndex));
    }

    private static byte[] sampleData(List<Sample> samples) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        int cursor = 0;
        for (Sample sample : samples) {
            sample.start = cursor;
            for (byte value : sample.pcm) {
                writeLe16(out, value << 8);
                cursor++;
            }
            sample.end = cursor;
            for (int i = 0; i < 46; i++) {
                writeLe16(out, 0);
                cursor++;
            }
        }
        return bytes.toByteArray();
    }

    private static byte[] sampleHeaders(List<Sample> samples) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        for (Sample sample : samples) {
            writeSampleHeader(out, sample);
        }
        writeFixedAscii(out, "EOS", 20);
        writeLe32(out, 0);
        writeLe32(out, 0);
        writeLe32(out, 0);
        writeLe32(out, 0);
        writeLe32(out, 0);
        out.writeByte(0);
        out.writeByte(0);
        writeLe16(out, 0);
        writeLe16(out, 1);
        return bytes.toByteArray();
    }

    private static void writeSampleHeader(DataOutputStream out, Sample sample) throws IOException {
        writeFixedAscii(out, sample.name, 20);
        writeLe32(out, sample.start);
        writeLe32(out, sample.end);
        writeLe32(out, sample.start + sample.loopStart);
        writeLe32(out, sample.start + sample.loopEnd);
        writeLe32(out, sample.rate);
        out.writeByte(60);
        out.writeByte(0);
        writeLe16(out, 0);
        writeLe16(out, 1);
    }

    private static byte[] bagBytes(List<Bag> bags) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        for (Bag bag : bags) {
            writeLe16(out, bag.genIndex);
            writeLe16(out, bag.modIndex);
        }
        return bytes.toByteArray();
    }

    private static byte[] genBytes(List<Gen> gens) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        for (Gen gen : gens) {
            writeLe16(out, gen.operator);
            writeLe16(out, gen.amount);
        }
        return bytes.toByteArray();
    }

    private static void writePresetHeader(DataOutputStream out, String name, int preset, int bank, int bagIndex) throws IOException {
        writeFixedAscii(out, name, 20);
        writeLe16(out, preset);
        writeLe16(out, bank);
        writeLe16(out, bagIndex);
        writeLe32(out, 0);
        writeLe32(out, 0);
        writeLe32(out, 0);
    }

    private static void writeInstrument(DataOutputStream out, String name, int bagIndex) throws IOException {
        writeFixedAscii(out, name, 20);
        writeLe16(out, bagIndex);
    }

    private static List<Path> sortedBins(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static int sampleKey(boolean synth, int id) {
        return (synth ? 0 : 1000) + id;
    }

    private static int fileId(Path path) {
        String name = path.getFileName().toString();
        int start = name.indexOf("_file");
        if (start < 0) {
            throw new IllegalArgumentException("cannot parse file id from " + name);
        }
        start += "_file".length();
        int end = start;
        while (end < name.length() && Character.isDigit(name.charAt(end))) {
            end++;
        }
        return Integer.parseInt(name.substring(start, end));
    }

    private static byte[] riff(String type, byte[]... chunks) throws IOException {
        ByteArrayOutputStream payload = new ByteArrayOutputStream();
        payload.write(type.getBytes(StandardCharsets.US_ASCII));
        for (byte[] chunk : chunks) {
            payload.write(chunk);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write("RIFF".getBytes(StandardCharsets.US_ASCII));
        writeLe32(out, payload.size());
        out.write(payload.toByteArray());
        return out.toByteArray();
    }

    private static byte[] list(String type, byte[]... chunks) throws IOException {
        ByteArrayOutputStream payload = new ByteArrayOutputStream();
        payload.write(type.getBytes(StandardCharsets.US_ASCII));
        for (byte[] chunk : chunks) {
            payload.write(chunk);
        }
        return chunk("LIST", payload.toByteArray());
    }

    private static byte[] chunk(String id, byte[] payload) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(id.getBytes(StandardCharsets.US_ASCII));
        writeLe32(out, payload.length);
        out.write(payload);
        if ((payload.length & 1) != 0) {
            out.write(0);
        }
        return out.toByteArray();
    }

    private static byte[] zstr(String value) {
        byte[] text = value.getBytes(StandardCharsets.US_ASCII);
        int size = text.length + 1;
        if ((size & 1) != 0) {
            size++;
        }
        byte[] out = new byte[size];
        System.arraycopy(text, 0, out, 0, text.length);
        return out;
    }

    private static byte[] zeroBytes(int size) {
        return new byte[size];
    }

    private static byte[] le16Bytes(int... values) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        for (int value : values) {
            writeLe16(out, value);
        }
        return bytes.toByteArray();
    }

    private static void writeFixedAscii(DataOutputStream out, String value, int size) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.US_ASCII);
        int len = Math.min(bytes.length, size - 1);
        out.write(bytes, 0, len);
        for (int i = len; i < size; i++) {
            out.writeByte(0);
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

    private static void writeLe32(ByteArrayOutputStream out, int value) {
        out.write(value & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 24) & 0xff);
    }

    private static final class Patch {
        final int id;
        final List<Region> regions = new ArrayList<>();
        int missingRegions;

        Patch(int id) {
            this.id = id;
        }
    }

    private static final class Region {
        final int note;
        final Sample sample;
        final int rootKey;
        final int tune;
        final int attenuation;
        final int pan;
        final int exclusiveClass;

        Region(ng patch, int note, Sample sample) {
            int pitch = patch.o[note] & 0x7fff;
            int volume = patch.A[note] & 0xff;
            int panByte = patch.w[note] & 0xff;
            int group = patch.p[note];
            this.note = note;
            this.sample = sample;
            this.rootKey = pitch >> 8;
            this.tune = Math.round(-((pitch & 0xff) * 100.0f / 256.0f));
            this.attenuation = volume <= 0 ? 960 : Math.max(0, Math.round(-200.0f * (float)Math.log10(volume / 128.0f)));
            this.pan = Math.max(-500, Math.min(500, Math.round((panByte - 64) * 500.0f / 64.0f)));
            this.exclusiveClass = group > 0 ? group : 0;
        }
    }

    private static final class Sample {
        final String name;
        final byte[] pcm;
        final int rate;
        final int loopStart;
        final int loopEnd;
        final boolean pingPong;
        int start;
        int end;

        Sample(String name, wf pcm) {
            this.name = name;
            this.pcm = pcm.s;
            this.rate = pcm.o;
            this.loopStart = Math.max(0, Math.min(pcm.q, pcm.s.length));
            this.loopEnd = Math.max(this.loopStart, Math.min(pcm.r, pcm.s.length));
            this.pingPong = pcm.p;
        }
    }

    private static final class Bag {
        final int genIndex;
        final int modIndex;

        Bag(int genIndex, int modIndex) {
            this.genIndex = genIndex;
            this.modIndex = modIndex;
        }
    }

    private static final class Gen {
        final int operator;
        final int amount;

        Gen(int operator, int amount) {
            this.operator = operator;
            this.amount = amount;
        }
    }
}
