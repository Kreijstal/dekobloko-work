import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class TetraLinkSfzExporter {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/tetralink-build17");
        Path out = args.length > 1 ? Path.of(args[1]) : root.resolve("sfz");
        Path samplesOut = out.resolve("samples");
        Path patchesOut = out.resolve("patches");
        Files.createDirectories(samplesOut);
        Files.createDirectories(patchesOut);

        TreeMap<Integer, Sample> synthSamples = decodeSynth(root.resolve("split/archive07"), samplesOut);
        TreeMap<Integer, Sample> vorbisSamples = decodeVorbis(root.resolve("split/archive08"), samplesOut);
        int patches = exportPatches(root.resolve("split/archive09"), patchesOut, synthSamples, vorbisSamples);

        Files.writeString(
            out.resolve("README.txt"),
            "TetraLink FunOrb SFZ export\n\n"
                + "Load one of patches/patch_XXX.sfz in an SFZ-capable sampler.\n"
                + "The samples are decoded from FunOrb archives 7 and 8; the regions are\n"
                + "generated from archive 9 ng instrument patches.\n\n"
                + "This is a DAW interchange export, not a byte-exact replacement for the\n"
                + "game mixer. It preserves sample choice, key mapping, loop points, pitch\n"
                + "offset, per-note volume, and pan/exclusive-class hints. Native playback\n"
                + "should still use the FunOrb g/ng/wf renderer.\n"
        );

        System.out.printf(
            "wrote %s patches=%d synth_samples=%d vorbis_samples=%d%n",
            out,
            patches,
            synthSamples.size(),
            vorbisSamples.size()
        );
    }

    private static TreeMap<Integer, Sample> decodeSynth(Path inDir, Path outDir) throws Exception {
        Constructor<ge> ctor = ge.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Method decode = ge.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        TreeMap<Integer, Sample> out = new TreeMap<>();
        for (Path file : sortedBins(inDir, ".synth.bin")) {
            int id = fileId(file);
            ge sample = ctor.newInstance(new bh(Files.readAllBytes(file)));
            wf pcm = (wf) decode.invoke(sample);
            Path wav = outDir.resolve(String.format(Locale.ROOT, "synth_%03d.wav", id));
            writeWav(wav, pcm);
            out.put(id, new Sample("synth", id, wav.getFileName().toString(), pcm));
        }
        return out;
    }

    private static TreeMap<Integer, Sample> decodeVorbis(Path inDir, Path outDir) throws Exception {
        List<Path> files = sortedBins(inDir, ".packvorbis.bin");
        TreeMap<Integer, Sample> out = new TreeMap<>();
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
                TreeMap<Integer, Sample> decoded = new TreeMap<>();
                for (Path file : files) {
                    if (file.equals(header)) {
                        continue;
                    }
                    int id = fileId(file);
                    ag sample = ctor.newInstance((Object) Files.readAllBytes(file));
                    wf pcm = (wf) decode.invoke(sample);
                    Path wav = outDir.resolve(String.format(Locale.ROOT, "vorbis_%03d.wav", id));
                    writeWav(wav, pcm);
                    decoded.put(id, new Sample("vorbis", id, wav.getFileName().toString(), pcm));
                }
                return decoded;
            } catch (ReflectiveOperationException | RuntimeException ex) {
                lastError = ex instanceof Exception ? (Exception) ex : new Exception(ex);
            }
        }
        throw lastError != null ? lastError : new IllegalStateException("no archive08 Vorbis header found");
    }

    private static int exportPatches(
        Path inDir,
        Path outDir,
        TreeMap<Integer, Sample> synthSamples,
        TreeMap<Integer, Sample> vorbisSamples
    ) throws Exception {
        int count = 0;
        Field refsField = ng.class.getDeclaredField("B");
        refsField.setAccessible(true);
        for (Path file : sortedBins(inDir, ".patch.bin")) {
            int patchId = fileId(file);
            ng patch = new ng(Files.readAllBytes(file));
            int[] refs = (int[]) refsField.get(patch);
            StringBuilder sfz = new StringBuilder(32768);
            sfz.append("// FunOrb TetraLink archive09 patch ").append(patchId).append('\n');
            sfz.append("// Generated from ").append(file.getFileName()).append("\n\n");
            sfz.append("<control>\n");
            sfz.append("default_path=../samples/\n\n");
            sfz.append("<global>\n");
            sfz.append("ampeg_attack=0\n");
            sfz.append("ampeg_release=0.05\n\n");

            for (int note = 0; note < 128; note++) {
                int ref = refs[note];
                if (ref == 0) {
                    continue;
                }
                int key = ref - 1;
                int sampleId = key >> 2;
                boolean synth = (key & 1) == 0;
                Sample sample = (synth ? synthSamples : vorbisSamples).get(sampleId);
                if (sample == null) {
                    sfz.append("// missing ").append(synth ? "synth" : "vorbis").append(' ').append(sampleId)
                        .append(" for note ").append(note).append('\n');
                    continue;
                }
                appendRegion(sfz, patch, note, sample);
            }

            Files.writeString(outDir.resolve(String.format(Locale.ROOT, "patch_%03d.sfz", patchId)), sfz.toString());
            count++;
        }
        return count;
    }

    private static void appendRegion(StringBuilder sfz, ng patch, int note, Sample sample) {
        int pitch = patch.o[note] & 0x7fff;
        int root = pitch >> 8;
        int frac = pitch & 0xff;
        int tuneCents = Math.round(-frac * 100.0f / 256.0f);
        int volume = patch.A[note] & 0xff;
        int pan = patch.w[note] & 0xff;
        int group = patch.p[note];

        sfz.append("<region>\n");
        sfz.append("sample=").append(sample.path).append('\n');
        sfz.append("key=").append(note).append('\n');
        sfz.append("pitch_keycenter=").append(root).append('\n');
        if (tuneCents != 0) {
            sfz.append("tune=").append(tuneCents).append('\n');
        }
        if (sample.loopStart >= 0 && sample.loopEnd > sample.loopStart) {
            sfz.append("loop_mode=").append(sample.pingPong ? "loop_bidirectional" : "loop_continuous").append('\n');
            sfz.append("loop_start=").append(sample.loopStart).append('\n');
            sfz.append("loop_end=").append(sample.loopEnd).append('\n');
        }
        if (volume > 0) {
            sfz.append("volume=").append(String.format(Locale.ROOT, "%.2f", 20.0 * Math.log10(volume / 128.0))).append('\n');
        }
        sfz.append("pan=").append(Math.max(-100, Math.min(100, Math.round((pan - 64) * 100.0f / 64.0f)))).append('\n');
        if (group > 0) {
            sfz.append("group=").append(group).append('\n');
            sfz.append("off_by=").append(group).append('\n');
        }
        sfz.append("// bank=").append(sample.bank).append(" id=").append(sample.id)
            .append(" funorb_pitch=").append(pitch)
            .append(" funorb_volume=").append(volume)
            .append(" funorb_pan=").append(pan)
            .append('\n')
            .append('\n');
    }

    private static List<Path> sortedBins(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
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

    private static void writeWav(Path path, wf pcm) throws Exception {
        byte[] samples = pcm.s;
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
        writeLe32(out, pcm.o);
        writeLe32(out, pcm.o);
        writeLe16(out, 1);
        writeLe16(out, 8);
        writeAscii(out, "data");
        writeLe32(out, data.length);
        out.write(data);
        Files.write(path, bytes.toByteArray());
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

    private static final class Sample {
        final String bank;
        final int id;
        final String path;
        final int loopStart;
        final int loopEnd;
        final boolean pingPong;

        Sample(String bank, int id, String path, wf pcm) {
            this.bank = bank;
            this.id = id;
            this.path = path;
            this.loopStart = pcm.q;
            this.loopEnd = pcm.r;
            this.pingPong = pcm.p;
        }
    }
}
