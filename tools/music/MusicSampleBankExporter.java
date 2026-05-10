import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class MusicSampleBankExporter {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/dekobloko");
        List<Track> tracks = loadTracks(root.resolve("split/archive10_group000"));
        TreeMap<Integer, Integer> synthRequired = requiredLengths(tracks, false);
        TreeMap<Integer, Integer> vorbisRequired = requiredLengths(tracks, true);
        TreeMap<Integer, ud> synthSamples = decodeSynth(root.resolve("split/archive08_group000"), synthRequired);
        TreeMap<Integer, ud> vorbisSamples = decodeVorbis(root.resolve("split/archive09_group000"), vorbisRequired);

        Path outDir = root.resolve("json");
        Files.createDirectories(outDir);
        Files.writeString(outDir.resolve("sample-bank.json"), toJson(synthSamples, vorbisSamples), StandardCharsets.UTF_8);
        System.out.printf(
            "wrote %s synth=%d vorbis=%d%n",
            outDir.resolve("sample-bank.json"),
            synthSamples.size(),
            vorbisSamples.size()
        );
    }

    private static List<Track> loadTracks(Path dir) throws Exception {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(".ui.bin"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .map(path -> {
                    try {
                        return new Track(new ui(new wl(Files.readAllBytes(path)), null));
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
                    }
                })
                .collect(Collectors.toList());
        }
    }

    private static TreeMap<Integer, Integer> requiredLengths(List<Track> tracks, boolean vorbis) throws Exception {
        TreeMap<Integer, Integer> required = new TreeMap<>();
        for (Track track : tracks) {
            int[] y = privateIntArray(track.ui, "y");
            int[] D = privateIntArray(track.ui, "D");
            for (int i = 0; i < track.ui.M.length; i++) {
                boolean isVorbis = (track.ui.M[i] >> 4) != 0;
                if (isVorbis != vorbis) continue;
                if (D[i] != 0) {
                    throw new IllegalStateException("unexpected nonzero sample group " + D[i]);
                }
                required.merge(y[i], track.ui.B[i], Math::max);
            }
        }
        return required;
    }

    private static TreeMap<Integer, ud> decodeSynth(Path dir, TreeMap<Integer, Integer> required) throws Exception {
        Constructor<bi> ctor = bi.class.getDeclaredConstructor(wl.class);
        ctor.setAccessible(true);
        List<Path> files = sortedBins(dir, ".bin");
        TreeMap<Integer, ud> out = new TreeMap<>();
        int physical = 0;
        for (int id : required.keySet()) {
            ud sample = ctor.newInstance(new wl(Files.readAllBytes(files.get(physical++)))).b();
            assertLength("synth", id, sample, required.get(id));
            out.put(id, sample);
        }
        return out;
    }

    private static TreeMap<Integer, ud> decodeVorbis(Path dir, TreeMap<Integer, Integer> required) throws Exception {
        List<Path> files = sortedBins(dir, ".bin");
        va.b(Files.readAllBytes(files.get(0)));
        Constructor<va> ctor = va.class.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Method decode = va.class.getDeclaredMethod("a");
        decode.setAccessible(true);
        TreeMap<Integer, ud> out = new TreeMap<>();
        int physical = 1;
        for (int id : required.keySet()) {
            va format = ctor.newInstance((Object) Files.readAllBytes(files.get(physical++)));
            ud sample = (ud) decode.invoke(format);
            assertLength("vorbis", id, sample, required.get(id));
            out.put(id, sample);
        }
        return out;
    }

    private static void assertLength(String bank, int id, ud sample, int expected) {
        if (sample.o.length != expected) {
            throw new IllegalStateException(
                bank + " id " + id + " mapped to length " + sample.o.length + ", expected " + expected
            );
        }
    }

    private static List<Path> sortedBins(Path dir, String suffix) throws Exception {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static String toJson(TreeMap<Integer, ud> synthSamples, TreeMap<Integer, ud> vorbisSamples) {
        StringBuilder out = new StringBuilder(2_000_000);
        out.append("{\n");
        out.append("  \"sampleRate\": 22050,\n");
        out.append("  \"samples\": {\n");
        boolean first = true;
        first = appendSamples(out, "synth", synthSamples, first);
        appendSamples(out, "vorbis", vorbisSamples, first);
        out.append("\n  }\n");
        out.append("}\n");
        return out.toString();
    }

    private static boolean appendSamples(StringBuilder out, String bank, TreeMap<Integer, ud> samples, boolean first) {
        for (var entry : samples.entrySet()) {
            if (!first) out.append(",\n");
            first = false;
            ud sample = entry.getValue();
            out.append("    \"").append(bank).append(':').append(entry.getKey()).append("\": {");
            out.append("\"bank\":\"").append(bank).append("\",");
            out.append("\"id\":").append(entry.getKey()).append(',');
            out.append("\"rate\":").append(sample.p).append(',');
            out.append("\"loopStart\":").append(sample.q).append(',');
            out.append("\"loopEnd\":").append(sample.s).append(',');
            out.append("\"pingPong\":").append(sample.r).append(',');
            out.append("\"pcm8\":\"").append(Base64.getEncoder().encodeToString(sample.o)).append("\"");
            out.append('}');
        }
        return first;
    }

    private static int[] privateIntArray(ui value, String name) throws Exception {
        Field field = ui.class.getDeclaredField(name);
        field.setAccessible(true);
        return (int[]) field.get(value);
    }

    private static final class Track {
        final ui ui;

        Track(ui ui) {
            this.ui = ui;
        }
    }
}
