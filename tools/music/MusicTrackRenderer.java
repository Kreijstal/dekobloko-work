import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.TreeMap;
import java.util.stream.Collectors;

public final class MusicTrackRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int MAX_SECONDS = 360;

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/dekobloko");
        en.o = SAMPLE_RATE;

        List<Track> tracks = loadTracks(root.resolve("split/archive10_group000"));
        TreeMap<Integer, Integer> synthRequired = requiredLengths(tracks, false);
        TreeMap<Integer, Integer> vorbisRequired = requiredLengths(tracks, true);
        TreeMap<Integer, ud> synthSamples = decodeSynth(root.resolve("split/archive08_group000"), synthRequired);
        TreeMap<Integer, ud> vorbisSamples = decodeVorbis(root.resolve("split/archive09_group000"), vorbisRequired);

        Path outDir = root.resolve("wav/archive10_tracks");
        Files.createDirectories(outDir);
        for (Track track : tracks) {
            hydrate(track.ui, synthSamples, vorbisSamples);
            byte[] pcm = render(track.ui);
            writeWav(outDir.resolve(track.name.replace(".ui.bin", ".wav")), pcm);
            System.out.printf("%s %.3fs%n", track.name, pcm.length / (double) (SAMPLE_RATE * 2));
        }
    }

    private static List<Track> loadTracks(Path dir) throws IOException {
        List<Track> tracks = new ArrayList<>();
        for (Path file : sortedBins(dir, ".ui.bin")) {
            tracks.add(new Track(file.getFileName().toString(), new ui(new wl(Files.readAllBytes(file)), null)));
        }
        return tracks;
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

    private static void hydrate(ui song, TreeMap<Integer, ud> synthSamples, TreeMap<Integer, ud> vorbisSamples) throws Exception {
        int[] y = privateIntArray(song, "y");
        for (int i = 0; i < song.M.length; i++) {
            boolean isVorbis = (song.M[i] >> 4) != 0;
            ud sample = (isVorbis ? vorbisSamples : synthSamples).get(y[i]);
            if (sample == null) {
                throw new IllegalStateException("missing " + (isVorbis ? "vorbis" : "synth") + " sample " + y[i]);
            }
            song.g[i] = sample;
            song.M[i] &= 15;
        }
    }

    private static byte[] render(ui song) throws Exception {
        mi mixer = new mi();
        ia player = new ia(song);
        player.a(100);
        player.c(256);
        Field loop = ia.class.getDeclaredField("w");
        loop.setAccessible(true);
        loop.setBoolean(player, false);
        mixer.a(player);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] buffer = new int[1024];
        int silence = 0;
        int maxBytes = SAMPLE_RATE * MAX_SECONDS * 2;
        while (out.size() < maxBytes && player.n != null) {
            java.util.Arrays.fill(buffer, 0);
            mixer.b(buffer, 0, buffer.length);
            for (int sample : buffer) {
                int v = sample >> 8;
                if (v < -32768) v = -32768;
                if (v > 32767) v = 32767;
                out.write(v & 0xff);
                out.write((v >>> 8) & 0xff);
            }
            silence = isSilent(buffer) ? silence + buffer.length : 0;
            if (player.n == null && silence > SAMPLE_RATE * 2) {
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

    private static int[] privateIntArray(ui value, String name) throws Exception {
        Field field = ui.class.getDeclaredField(name);
        field.setAccessible(true);
        return (int[]) field.get(value);
    }

    private static List<Path> sortedBins(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static void writeWav(Path path, byte[] data) throws IOException {
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

    private static final class Track {
        final String name;
        final ui ui;

        Track(String name, ui ui) {
            this.name = name;
            this.ui = ui;
        }
    }
}
