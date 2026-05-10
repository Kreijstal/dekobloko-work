import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public final class BrickabracMusicDumper {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/brickabrac");
        Path midiRoot = root.resolve("midi/archive10_tracks");
        Files.createDirectories(midiRoot);

        Constructor<vm> ctor = vm.class.getDeclaredConstructor(wq.class);
        ctor.setAccessible(true);
        Field midiField = vm.class.getDeclaredField("j");
        midiField.setAccessible(true);

        for (Path file : sorted(root.resolve("split/archive10"), ".vm.bin")) {
            vm track = ctor.newInstance(new wq(Files.readAllBytes(file)));
            byte[] midi = (byte[]) midiField.get(track);
            Path out = midiRoot.resolve(file.getFileName().toString().replace(".vm.bin", ".mid"));
            Files.write(out, repairMidi(midi));
            System.out.printf("%s %d bytes%n", out.getFileName(), Files.size(out));
        }
    }

    private static List<Path> sorted(Path dir, String suffix) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                .filter(path -> path.getFileName().toString().endsWith(suffix))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .collect(Collectors.toList());
        }
    }

    private static byte[] repairMidi(byte[] midi) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bytes);
        int pos = 0;
        while (pos < midi.length) {
            if (pos + 8 <= midi.length
                && midi[pos] == 'M'
                && midi[pos + 1] == 'T'
                && midi[pos + 2] == 'r'
                && midi[pos + 3] == 'k') {
                out.write(midi, pos, 4);
                int lenPos = bytes.size();
                out.writeInt(0);
                pos += 8;
                int dataStart = bytes.size();
                ByteArrayOutputStream track = new ByteArrayOutputStream();
                while (pos < midi.length) {
                    if (pos + 8 <= midi.length
                        && midi[pos] == 'M'
                        && midi[pos + 1] == 'T'
                        && midi[pos + 2] == 'r'
                        && midi[pos + 3] == 'k') {
                        break;
                    }
                    if (pos + 3 <= midi.length
                        && midi[pos] == 0
                        && midi[pos + 1] == 0x2f
                        && midi[pos + 2] == 0) {
                        track.write(0);
                        track.write(0xff);
                        track.write(0x2f);
                        track.write(0);
                        pos += 3;
                        continue;
                    }
                    track.write(midi[pos++]);
                }
                byte[] trackBytes = track.toByteArray();
                out.write(trackBytes);
                byte[] arr = bytes.toByteArray();
                int len = trackBytes.length;
                arr[lenPos] = (byte) (len >>> 24);
                arr[lenPos + 1] = (byte) (len >>> 16);
                arr[lenPos + 2] = (byte) (len >>> 8);
                arr[lenPos + 3] = (byte) len;
                bytes.reset();
                bytes.write(arr);
                continue;
            }
            out.write(midi[pos++]);
        }
        return bytes.toByteArray();
    }
}
