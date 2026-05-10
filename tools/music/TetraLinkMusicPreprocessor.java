import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class TetraLinkMusicPreprocessor {
    private static final int SAMPLE_RATE = 22050;
    private static final int MAX_SECONDS = 360;

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/tetralink-build17");
        Path wavRoot = root.resolve("wav");
        Files.createDirectories(wavRoot.resolve("archive07_synth"));
        Files.createDirectories(wavRoot.resolve("archive08_packvorbis"));
        Files.createDirectories(root.resolve("midi/archive10_tracks"));

        decodeSynth(root.resolve("split/archive07"), wavRoot.resolve("archive07_synth"));
        decodeVorbis(root.resolve("split/archive08"), wavRoot.resolve("archive08_packvorbis"));
        dumpMidi(root.resolve("split/archive10"), root.resolve("midi/archive10_tracks"));
        renderNativeTracks(root, wavRoot.resolve("archive10_tracks"));
    }

    private static void decodeSynth(Path inDir, Path outDir) throws Exception {
        Constructor<ge> ctor = ge.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Method decode = ge.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        for (Path file : sortedBins(inDir, ".synth.bin")) {
            ge sample = ctor.newInstance(new bh(Files.readAllBytes(file)));
            wf pcm = (wf) decode.invoke(sample);
            writeWav(outDir.resolve(file.getFileName().toString().replace(".synth.bin", ".wav")), pcm);
        }
    }

    private static void decodeVorbis(Path inDir, Path outDir) throws Exception {
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

        Exception lastHeaderError = null;
        for (int headerIndex = 0; headerIndex < files.size(); headerIndex++) {
            try {
                loadHeaders.invoke(null, (Object) Files.readAllBytes(files.get(headerIndex)));
                int decoded = 0;
                for (int i = 0; i < files.size(); i++) {
                    if (i == headerIndex) {
                        continue;
                    }
                    try {
                        ag sample = ctor.newInstance((Object) Files.readAllBytes(files.get(i)));
                        wf pcm = (wf) decode.invoke(sample);
                        writeWav(outDir.resolve(files.get(i).getFileName().toString().replace(".packvorbis.bin", ".wav")), pcm);
                        decoded++;
                    } catch (ReflectiveOperationException | RuntimeException ignored) {
                        // Some candidate headers decode fewer files. Keep probing until one decodes most of the bank.
                    }
                }
                if (decoded > 0) {
                    System.out.printf("archive08 header=%s decoded=%d%n", files.get(headerIndex).getFileName(), decoded);
                    return;
                }
            } catch (ReflectiveOperationException | RuntimeException ex) {
                lastHeaderError = ex instanceof Exception ? (Exception) ex : new Exception(ex);
            }
        }
        if (lastHeaderError != null) {
            throw lastHeaderError;
        }
    }

    private static void dumpMidi(Path inDir, Path outDir) throws Exception {
        Constructor<ri> ctor = ri.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Field midi = ri.class.getDeclaredField("o");
        midi.setAccessible(true);
        for (Path file : sortedBins(inDir, ".ri.bin")) {
            ri track = ctor.newInstance(new bh(Files.readAllBytes(file)));
            Files.write(outDir.resolve(file.getFileName().toString().replace(".ri.bin", ".mid")), repairMidi((byte[]) midi.get(track)));
        }
    }

    private static void renderNativeTracks(Path root, Path outDir) throws Exception {
        nk.k = SAMPLE_RATE;
        Files.createDirectories(outDir);

        TreeMap<Integer, wf> synthSamples = loadSynthSamples(root.resolve("split/archive07"));
        TreeMap<Integer, wf> vorbisSamples = loadVorbisSamples(root.resolve("split/archive08"));
        Map<Integer, byte[]> patchBytes = loadPatchBytes(root.resolve("split/archive09"));
        List<Path> tracks = sortedBins(root.resolve("split/archive10"), ".ri.bin");

        for (Path file : tracks) {
            ri track = newRi(Files.readAllBytes(file));
            g player = new g();
            hydrateInstruments(player, track, patchBytes, synthSamples, vorbisSamples);
            track.b();
            player.a(false, track, (byte) 2);
            byte[] pcm = render(player);
            Path wav = outDir.resolve(file.getFileName().toString().replace(".ri.bin", ".wav"));
            writePcm16Wav(wav, pcm);
            System.out.printf("%s %.3fs native%n", wav.getFileName(), pcm.length / (double) (SAMPLE_RATE * 2));
        }
    }

    private static TreeMap<Integer, wf> loadSynthSamples(Path dir) throws Exception {
        Constructor<ge> ctor = ge.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Method decode = ge.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        TreeMap<Integer, wf> out = new TreeMap<>();
        for (Path file : sortedBins(dir, ".synth.bin")) {
            ge sample = ctor.newInstance(new bh(Files.readAllBytes(file)));
            out.put(fileId(file), (wf) decode.invoke(sample));
        }
        return out;
    }

    private static TreeMap<Integer, wf> loadVorbisSamples(Path dir) throws Exception {
        List<Path> files = sortedBins(dir, ".packvorbis.bin");
        TreeMap<Integer, wf> out = new TreeMap<>();
        if (files.isEmpty()) {
            return out;
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
                TreeMap<Integer, wf> decoded = new TreeMap<>();
                for (Path file : files) {
                    if (file.equals(header)) {
                        continue;
                    }
                    ag sample = ctor.newInstance((Object) Files.readAllBytes(file));
                    decoded.put(fileId(file), (wf) decode.invoke(sample));
                }
                return decoded;
            } catch (ReflectiveOperationException | RuntimeException ex) {
                lastError = ex instanceof Exception ? (Exception) ex : new Exception(ex);
            }
        }
        throw lastError != null ? lastError : new IllegalStateException("no archive08 Vorbis header found");
    }

    private static Map<Integer, byte[]> loadPatchBytes(Path dir) throws Exception {
        Map<Integer, byte[]> out = new HashMap<>();
        for (Path file : sortedBins(dir, ".patch.bin")) {
            out.put(fileId(file), Files.readAllBytes(file));
        }
        return out;
    }

    private static void hydrateInstruments(
        g player,
        ri track,
        Map<Integer, byte[]> patchBytes,
        Map<Integer, wf> synthSamples,
        Map<Integer, wf> vorbisSamples
    ) throws Exception {
        track.a();
        Field cacheField = g.class.getDeclaredField("A");
        cacheField.setAccessible(true);
        dj cache = (dj) cacheField.get(player);

        ch used = (ch) track.n.b(43);
        List<String> missing = new ArrayList<>();
        while (used != null) {
            int patchId = (int) used.c;
            byte[] patch = patchBytes.get(patchId);
            if (patch == null) {
                missing.add("patch:" + patchId);
            } else {
                ng instrument = new ng(patch);
                hydrateInstrument(instrument, used.p, synthSamples, vorbisSamples, missing);
                cache.a(patchId, -53, instrument);
            }
            used = (ch) track.n.a(-1);
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("missing native music resources " + missing);
        }
    }

    private static void hydrateInstrument(
        ng instrument,
        byte[] noteMask,
        Map<Integer, wf> synthSamples,
        Map<Integer, wf> vorbisSamples,
        List<String> missing
    ) throws Exception {
        Field refsField = ng.class.getDeclaredField("B");
        refsField.setAccessible(true);
        int[] refs = (int[]) refsField.get(instrument);
        int previousRef = 0;
        wf previousSample = null;
        for (int note = 0; note < 128; note++) {
            if (noteMask != null && noteMask[note] == 0) {
                continue;
            }
            int ref = refs[note];
            if (ref == 0) {
                continue;
            }
            if (ref != previousRef) {
                previousRef = ref;
                int key = ref - 1;
                int sampleId = key >> 2;
                boolean synth = (key & 1) == 0;
                previousSample = (synth ? synthSamples : vorbisSamples).get(sampleId);
                if (previousSample == null) {
                    missing.add((synth ? "synth:" : "vorbis:") + sampleId);
                }
            }
            if (previousSample != null) {
                instrument.z[note] = previousSample;
                refs[note] = 0;
            }
        }
    }

    private static byte[] render(g player) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] buffer = new int[1024];
        int silence = 0;
        int maxBytes = SAMPLE_RATE * MAX_SECONDS * 2;
        while (out.size() < maxBytes) {
            Arrays.fill(buffer, 0);
            player.b(buffer, 0, buffer.length);
            for (int sample : buffer) {
                int value = sample >> 8;
                if (value < -32768) value = -32768;
                if (value > 32767) value = 32767;
                out.write(value & 0xff);
                out.write((value >>> 8) & 0xff);
            }
            silence = isSilent(buffer) ? silence + buffer.length : 0;
            if (!player.d((byte) -20) && silence > SAMPLE_RATE * 2) {
                break;
            }
        }
        return trimTrailingSilence(out.toByteArray(), SAMPLE_RATE / 2);
    }

    private static boolean isSilent(int[] buffer) {
        for (int sample : buffer) {
            if (Math.abs(sample >> 8) > 4) return false;
        }
        return true;
    }

    private static byte[] trimTrailingSilence(byte[] pcm16le, int keepSamples) {
        int last = pcm16le.length - 2;
        while (last >= 0) {
            int lo = pcm16le[last] & 0xff;
            int hi = pcm16le[last + 1];
            short sample = (short) ((hi << 8) | lo);
            if (Math.abs(sample) > 4) break;
            last -= 2;
        }
        int keepBytes = keepSamples * 2;
        int len = Math.min(pcm16le.length, Math.max(0, last + 2 + keepBytes));
        byte[] out = new byte[len];
        System.arraycopy(pcm16le, 0, out, 0, len);
        return out;
    }

    private static ri newRi(byte[] bytes) throws Exception {
        Constructor<ri> ctor = ri.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        return ctor.newInstance(new bh(bytes));
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
            byte[] track = java.util.Arrays.copyOfRange(midi, dataStart, dataEnd);
            if (track.length >= 3 && track[track.length - 3] == 0 && track[track.length - 2] == 0x2f && track[track.length - 1] == 0) {
                byte[] repaired = new byte[track.length + 1];
                System.arraycopy(track, 0, repaired, 0, track.length - 2);
                repaired[track.length - 2] = (byte) 0xff;
                repaired[track.length - 1] = 0x2f;
                repaired[track.length] = 0;
                track = repaired;
            }
            fixed.write(new byte[] {'M', 'T', 'r', 'k'});
            writeBe32(fixed, track.length);
            fixed.write(track);
            pos = dataEnd;
        }
        return fixed.toByteArray();
    }

    private static List<Path> sortedBins(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static void writeWav(Path path, wf pcm) throws Exception {
        byte[] samples = (byte[]) field(pcm, "s");
        int rate = (Integer) field(pcm, "o");
        byte[] data = new byte[samples.length];
        for (int i = 0; i < samples.length; i++) {
            data[i] = (byte) (samples[i] ^ 0x80);
        }

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        writeAscii(out, "RIFF");
        writeLe32(out, 36 + data.length);
        writeAscii(out, "WAVEfmt ");
        writeLe32(out, 16);
        writeLe16(out, 1);
        writeLe16(out, 1);
        writeLe32(out, rate);
        writeLe32(out, rate);
        writeLe16(out, 1);
        writeLe16(out, 8);
        writeAscii(out, "data");
        writeLe32(out, data.length);
        out.write(data);
        Files.write(path, bytes.toByteArray());
    }

    private static void writePcm16Wav(Path path, byte[] data) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        writeAscii(out, "RIFF");
        writeLe32(out, 36 + data.length);
        writeAscii(out, "WAVEfmt ");
        writeLe32(out, 16);
        writeLe16(out, 1);
        writeLe16(out, 1);
        writeLe32(out, SAMPLE_RATE);
        writeLe32(out, SAMPLE_RATE * 2);
        writeLe16(out, 2);
        writeLe16(out, 16);
        writeAscii(out, "data");
        writeLe32(out, data.length);
        out.write(data);
        Files.write(path, bytes.toByteArray());
    }

    private static Object field(Object object, String name) throws Exception {
        Field field = object.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(object);
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

    private static void writeBe32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }
}
