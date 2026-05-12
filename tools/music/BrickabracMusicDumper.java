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
                int originalLength = readInt(midi, pos + 4);
                int lenPos = bytes.size();
                out.writeInt(0);
                pos += 8;
                int end = Math.min(midi.length, pos + originalLength);
                ByteArrayOutputStream track = repairTrack(midi, pos, end);
                pos = end;
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

    private static int readInt(byte[] data, int pos) {
        return ((data[pos] & 0xff) << 24)
            | ((data[pos + 1] & 0xff) << 16)
            | ((data[pos + 2] & 0xff) << 8)
            | (data[pos + 3] & 0xff);
    }

    private static ByteArrayOutputStream repairTrack(byte[] midi, int pos, int end) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int runningStatus = -1;
        while (pos < end) {
            pos = copyVarInt(midi, pos, out);
            if (pos >= end) {
                break;
            }
            int status = midi[pos] & 0xff;
            if (status == 0x2f && pos + 2 == end && midi[pos + 1] == 0) {
                out.write(0xff);
                out.write(0x2f);
                out.write(0);
                pos += 2;
                continue;
            }
            if (status < 0x80) {
                if (runningStatus < 0) {
                    out.write(midi[pos++]);
                    continue;
                }
                int dataBytes = channelDataBytes(runningStatus);
                for (int i = 0; i < dataBytes && pos < end; i++) {
                    out.write(midi[pos++]);
                }
                continue;
            }
            out.write(midi[pos++]);
            if (status == 0xff) {
                if (pos >= midi.length) {
                    break;
                }
                out.write(midi[pos++]);
                long parsed = copyVarIntWithValue(midi, pos, out);
                pos = (int) (parsed >>> 32);
                int length = (int) parsed;
                for (int i = 0; i < length && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            } else if (status == 0xf0 || status == 0xf7) {
                long parsed = copyVarIntWithValue(midi, pos, out);
                pos = (int) (parsed >>> 32);
                int length = (int) parsed;
                for (int i = 0; i < length && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            } else {
                runningStatus = status;
                int dataBytes = channelDataBytes(status);
                for (int i = 0; i < dataBytes && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            }
        }
        return out;
    }

    private static int copyVarInt(byte[] data, int pos, ByteArrayOutputStream out) {
        for (int i = 0; i < 4 && pos < data.length; i++) {
            int value = data[pos++] & 0xff;
            out.write(value);
            if ((value & 0x80) == 0) {
                break;
            }
        }
        return pos;
    }

    private static long copyVarIntWithValue(byte[] data, int pos, ByteArrayOutputStream out) {
        int value = 0;
        for (int i = 0; i < 4 && pos < data.length; i++) {
            int part = data[pos++] & 0xff;
            out.write(part);
            value = (value << 7) | (part & 0x7f);
            if ((part & 0x80) == 0) {
                break;
            }
        }
        return ((long) pos << 32) | (value & 0xffffffffL);
    }

    private static int channelDataBytes(int status) {
        int command = status & 0xf0;
        return command == 0xc0 || command == 0xd0 ? 1 : 2;
    }
}
