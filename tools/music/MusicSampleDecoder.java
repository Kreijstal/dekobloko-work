import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public final class MusicSampleDecoder {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/dekobloko");
        Path samplesRoot = root.resolve("samples");
        Files.createDirectories(samplesRoot.resolve("synth"));
        Files.createDirectories(samplesRoot.resolve("packvorbis"));

        decodeSynth(root.resolve("split/archive08_group000"), samplesRoot.resolve("synth"));
        decodeVorbis(root.resolve("split/archive09_group000"), samplesRoot.resolve("packvorbis"));
    }

    private static void decodeSynth(Path inDir, Path outDir) throws Exception {
        Constructor<bi> ctor = bi.class.getDeclaredConstructor(wl.class);
        ctor.setAccessible(true);
        for (Path file : sortedBins(inDir)) {
            bi sample = ctor.newInstance(new wl(Files.readAllBytes(file)));
            ud pcm = sample.b();
            writeWav(outDir.resolve(file.getFileName().toString().replace(".bin", ".wav")), pcm);
        }
    }

    private static void decodeVorbis(Path inDir, Path outDir) throws Exception {
        List<Path> files = sortedBins(inDir);
        if (files.isEmpty()) {
            return;
        }
        va.b(Files.readAllBytes(files.get(0)));
        Constructor<va> ctor = va.class.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Method decode = va.class.getDeclaredMethod("a");
        decode.setAccessible(true);
        for (int i = 1; i < files.size(); i++) {
            Path file = files.get(i);
            va sample = ctor.newInstance((Object) Files.readAllBytes(file));
            ud pcm = (ud) decode.invoke(sample);
            writeWav(outDir.resolve(file.getFileName().toString().replace(".bin", ".wav")), pcm);
        }
    }

    private static List<Path> sortedBins(Path dir) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(".bin"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static void writeWav(Path path, ud pcm) throws IOException {
        byte[] data = new byte[pcm.o.length];
        for (int i = 0; i < pcm.o.length; i++) {
            data[i] = (byte) (pcm.o[i] ^ 0x80);
        }

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        writeAscii(out, "RIFF");
        writeLe32(out, 36 + data.length);
        writeAscii(out, "WAVEfmt ");
        writeLe32(out, 16);
        writeLe16(out, 1);
        writeLe16(out, 1);
        writeLe32(out, pcm.p);
        writeLe32(out, pcm.p);
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
}
