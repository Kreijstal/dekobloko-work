import java.io.FileInputStream;
import java.lang.reflect.Constructor;

/**
 * Decodes raw FunOrb packvorbis assets inside the guest JVM and publishes
 * compact PCM fingerprints. This intentionally exercises va rather than a
 * pre-decoded sample bank.
 */
public final class JavaVorbisDecodeProbe {
    public static int count;
    public static int error;
    public static int length0;
    public static int nonZero0;
    public static int peak0;
    public static int checksum0;
    public static int length1;
    public static int nonZero1;
    public static int peak1;
    public static int checksum1;
    public static int length2;
    public static int nonZero2;
    public static int peak2;
    public static int checksum2;

    private JavaVorbisDecodeProbe() {
    }

    public static void main(String[] args) {
        reset();
        try {
            if (args == null || args.length < 2) {
                throw new IllegalArgumentException("header and sample paths required");
            }
            va.b(readAll(args[0]));
            Constructor<va> constructor = va.class.getDeclaredConstructor(byte[].class);
            constructor.setAccessible(true);
            count = args.length - 1;
            for (int index = 0; index < count; index++) {
                va compressed = constructor.newInstance((Object) readAll(args[index + 1]));
                if (index == 0) {
                    for (int warmup = 0; warmup < 128; warmup++) {
                        compressed.a(new int[] {0});
                    }
                }
                // The live client reaches Vorbis through pl, which calls this
                // budget-aware overload with a null (unlimited) budget.
                ud decoded = compressed.a((int[]) null);
                record(index, decoded == null ? null : decoded.o);
            }
        } catch (Throwable thrown) {
            error = 1;
            thrown.printStackTrace();
        }
    }

    private static void record(int index, byte[] pcm) {
        int length = pcm == null ? -1 : pcm.length;
        int nonZero = 0;
        int peak = 0;
        int checksum = 0x811c9dc5;
        if (pcm != null) {
            for (int offset = 0; offset < pcm.length; offset++) {
                int sample = pcm[offset];
                int absolute = sample < 0 ? -sample : sample;
                if (sample != 0) nonZero++;
                if (absolute > peak) peak = absolute;
                checksum ^= sample & 255;
                checksum *= 0x01000193;
            }
        }
        System.out.println(
            "[VORBIS_PROBE] index=" + index +
            " length=" + length +
            " nonZero=" + nonZero +
            " peak=" + peak +
            " checksum=" + (checksum & 0xffffffffL));
        if (index == 0) {
            length0 = length;
            nonZero0 = nonZero;
            peak0 = peak;
            checksum0 = checksum;
        } else if (index == 1) {
            length1 = length;
            nonZero1 = nonZero;
            peak1 = peak;
            checksum1 = checksum;
        } else if (index == 2) {
            length2 = length;
            nonZero2 = nonZero;
            peak2 = peak;
            checksum2 = checksum;
        }
    }

    private static byte[] readAll(String path) throws Exception {
        FileInputStream input = new FileInputStream(path);
        try {
            byte[] bytes = new byte[input.available()];
            int offset = 0;
            while (offset < bytes.length) {
                int read = input.read(bytes, offset, bytes.length - offset);
                if (read < 0) throw new IllegalStateException("short read: " + path);
                offset += read;
            }
            return bytes;
        } finally {
            input.close();
        }
    }

    private static void reset() {
        count = 0;
        error = 0;
        length0 = length1 = length2 = 0;
        nonZero0 = nonZero1 = nonZero2 = 0;
        peak0 = peak1 = peak2 = 0;
        checksum0 = checksum1 = checksum2 = 0;
    }
}
