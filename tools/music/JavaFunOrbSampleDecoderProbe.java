import java.io.FileInputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;

/**
 * Deterministic differential probe for the two compressed sample families
 * consumed by Dekobloko's live music loader.
 */
public final class JavaFunOrbSampleDecoderProbe {
    public static int synthLength;
    public static int synthHash;
    public static long synthAbsoluteSum;
    public static int vorbisLength;
    public static int vorbisHash;
    public static long vorbisAbsoluteSum;
    public static int error;
    public static int done;

    private JavaFunOrbSampleDecoderProbe() {}

    public static void main(String[] args) {
        reset();
        try {
            if (args == null || args.length != 3) {
                throw new IllegalArgumentException(
                    "expected synth, Vorbis headers, and Vorbis sample paths");
            }
            Constructor<bi> synthConstructor =
                bi.class.getDeclaredConstructor(wl.class);
            synthConstructor.setAccessible(true);
            bi synth = synthConstructor.newInstance(new wl(readAll(args[0])));
            recordSynth(synth.b());

            va.b(readAll(args[1]));
            Constructor<va> vorbisConstructor =
                va.class.getDeclaredConstructor(byte[].class);
            vorbisConstructor.setAccessible(true);
            Method decode = va.class.getDeclaredMethod("a");
            decode.setAccessible(true);
            va compressed =
                vorbisConstructor.newInstance((Object) readAll(args[2]));
            recordVorbis((ud) decode.invoke(compressed));
        } catch (Throwable failure) {
            error = 1;
            failure.printStackTrace();
        } finally {
            done = 1;
            System.out.println(
                synthLength + "," + (synthHash & 0xffffffffL) + "," +
                synthAbsoluteSum + "," + vorbisLength + "," +
                (vorbisHash & 0xffffffffL) + "," + vorbisAbsoluteSum + "," +
                error);
        }
    }

    private static void recordSynth(ud sample) {
        synthLength = sample.o.length;
        synthHash = hash(sample);
        synthAbsoluteSum = absoluteSum(sample.o);
    }

    private static void recordVorbis(ud sample) {
        vorbisLength = sample.o.length;
        vorbisHash = hash(sample);
        vorbisAbsoluteSum = absoluteSum(sample.o);
    }

    private static int hash(ud sample) {
        int value = 1;
        value = value * 31 + sample.p;
        value = value * 31 + sample.q;
        value = value * 31 + sample.s;
        value = value * 31 + (sample.r ? 1 : 0);
        for (int index = 0; index < sample.o.length; index++) {
            value = value * 31 + sample.o[index];
        }
        return value;
    }

    private static long absoluteSum(byte[] samples) {
        long value = 0L;
        for (int index = 0; index < samples.length; index++) {
            value += Math.abs((int) samples[index]);
        }
        return value;
    }

    private static byte[] readAll(String path) throws IOException {
        FileInputStream input = new FileInputStream(path);
        try {
            byte[] bytes = new byte[input.available()];
            int offset = 0;
            while (offset < bytes.length) {
                int count = input.read(bytes, offset, bytes.length - offset);
                if (count < 0) throw new IOException("short read: " + path);
                offset += count;
            }
            return bytes;
        } finally {
            input.close();
        }
    }

    private static void reset() {
        synthLength = 0;
        synthHash = 0;
        synthAbsoluteSum = 0L;
        vorbisLength = 0;
        vorbisHash = 0;
        vorbisAbsoluteSum = 0L;
        error = 0;
        done = 0;
    }
}
