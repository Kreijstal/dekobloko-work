import java.io.FileInputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.SourceDataLine;

/**
 * Runs Dekobloko's recovered music mixer inside the browser guest JVM.
 *
 * The selected ui descriptor and a decoded ud sample bank are supplied through
 * the JVM virtual filesystem. ia/mi/ei produce each PCM chunk and this guest
 * immediately writes it through SourceDataLine.
 */
public final class JavaFunOrbTrackPlayer {
    private static final int SAMPLE_RATE = 22050;
    private static final int CHUNK_FRAMES = 512;
    private static final int BYTES_PER_SAMPLE = 2;
    private static final int BUFFER_CHUNKS = 8;
    private static final int WARMUP_CHUNKS = 32;
    private static final long CHUNK_DEADLINE_NANOS =
        CHUNK_FRAMES * 1000000000L / SAMPLE_RATE;
    private static final int BANK_MAGIC = 0x464f5042; // FOPB

    public static long bankLoadNanos;
    public static long trackLoadNanos;
    public static long mixNanos;
    public static long convertNanos;
    public static long writeNanos;
    public static long waitNanos;
    public static long pushNanos;
    public static long drainNanos;
    public static long mixMaxNanos;
    public static long convertMaxNanos;
    public static long writeMaxNanos;
    public static long waitMaxNanos;
    public static long pipelineMaxNanos;
    public static long worstDeadlineOverrunNanos;
    public static long warmupPipelineNanos;
    public static long steadyPipelineNanos;
    public static long chunkDeadlineNanos;
    public static int targetFrames;
    public static int writtenFrames;
    public static int writtenBytes;
    public static int writes;
    public static int blockedPolls;
    public static int checksum;
    public static int channels;
    public static int schedulerMix;
    public static int leftChecksum;
    public static int rightChecksum;
    public static long leftAbsoluteSum;
    public static long rightAbsoluteSum;
    public static int stopRequested;
    public static int error;
    public static int done;
    public static int profiledChunks;
    public static int warmupChunks;
    public static int steadyChunks;
    public static int deadlineMisses;
    public static int currentDeadlineMissStreak;
    public static int longestDeadlineMissStreak;
    public static int pipelineLe5Ms;
    public static int pipelineLe10Ms;
    public static int pipelineLe15Ms;
    public static int pipelineLe20Ms;
    public static int pipelineWithinDeadline;
    public static int pipelineLe30Ms;
    public static int pipelineLe50Ms;
    public static int pipelineOver50Ms;

    private JavaFunOrbTrackPlayer() {}

    public static void main(String[] args) {
        reset();
        if (args == null || args.length < 2) {
            error = 1;
            done = 1;
            return;
        }
        if (args.length > 2) {
            try {
                targetFrames = Integer.parseInt(args[2]);
            } catch (NumberFormatException ignored) {
                targetFrames = 0;
            }
        }
        channels = args.length > 3 && "stereo".equalsIgnoreCase(args[3])
            ? 2
            : 1;
        schedulerMix = args.length > 4 &&
            "scheduler".equalsIgnoreCase(args[4]) ? 1 : 0;

        SourceDataLine line = null;
        try {
            long started = System.nanoTime();
            ud[][] banks = readSampleBank(args[1]);
            bankLoadNanos = System.nanoTime() - started;

            started = System.nanoTime();
            byte[] trackBytes = readAll(args[0]);
            ui song = new ui(new wl(trackBytes), null);
            hydrate(song, banks[0], banks[1]);
            trackLoadNanos = System.nanoTime() - started;

            en.o = SAMPLE_RATE;
            en.u = channels == 2;
            ia player = new ia(song);
            player.a(100);
            player.c(256);
            Field loop = ia.class.getDeclaredField("w");
            loop.setAccessible(true);
            loop.setBoolean(player, false);
            mi mixer = new mi();
            mixer.a(player);
            Object audioScheduler = null;
            Method scheduledMix = null;
            if (schedulerMix != 0) {
                audioScheduler = new en();
                Field rootStream = en.class.getDeclaredField("b");
                rootStream.setAccessible(true);
                rootStream.set(audioScheduler, mixer);
                scheduledMix = en.class.getDeclaredMethod(
                    "a", int[].class, Integer.TYPE);
                scheduledMix.setAccessible(true);
            }

            AudioFormat format =
                new AudioFormat((float) SAMPLE_RATE, 16, channels, true, false);
            int chunkBytes =
                CHUNK_FRAMES * channels * BYTES_PER_SAMPLE;
            int bufferBytes = chunkBytes * BUFFER_CHUNKS;
            DataLine.Info info =
                new DataLine.Info(SourceDataLine.class, format, bufferBytes);
            line = (SourceDataLine) AudioSystem.getLine(info);
            line.open(format, bufferBytes);
            line.start();

            int[] mixed = new int[CHUNK_FRAMES * channels];
            byte[] pcm = new byte[chunkBytes];
            long pushStarted = System.nanoTime();
            while (player.n != null && stopRequested == 0 &&
                   (targetFrames <= 0 || writtenFrames < targetFrames)) {
                int framesThisChunk = targetFrames > 0
                    ? Math.min(CHUNK_FRAMES, targetFrames - writtenFrames)
                    : CHUNK_FRAMES;
                Arrays.fill(mixed, 0);
                long mixStarted = System.nanoTime();
                if (scheduledMix == null) {
                    mixer.b(mixed, 0, framesThisChunk);
                } else {
                    scheduledMix.invoke(audioScheduler, new Object[] {
                        mixed, Integer.valueOf(framesThisChunk)
                    });
                }
                long mixElapsed = System.nanoTime() - mixStarted;
                mixNanos += mixElapsed;

                long convertStarted = System.nanoTime();
                int hash = checksum;
                int leftHash = leftChecksum;
                int rightHash = rightChecksum;
                long leftEnergy = leftAbsoluteSum;
                long rightEnergy = rightAbsoluteSum;
                for (int sampleIndex = 0;
                     sampleIndex < framesThisChunk * channels;
                     sampleIndex++) {
                    int sample = mixed[sampleIndex] >> 8;
                    if (sample < -32768) sample = -32768;
                    if (sample > 32767) sample = 32767;
                    int offset = sampleIndex * BYTES_PER_SAMPLE;
                    pcm[offset] = (byte) sample;
                    pcm[offset + 1] = (byte) (sample >> 8);
                    hash = hash * 31 + pcm[offset];
                    hash = hash * 31 + pcm[offset + 1];
                    int channel = sampleIndex % channels;
                    if (channel == 0) {
                        leftHash = leftHash * 31 + pcm[offset];
                        leftHash = leftHash * 31 + pcm[offset + 1];
                        leftEnergy += Math.abs((long) sample);
                    } else {
                        rightHash = rightHash * 31 + pcm[offset];
                        rightHash = rightHash * 31 + pcm[offset + 1];
                        rightEnergy += Math.abs((long) sample);
                    }
                }
                checksum = hash;
                leftChecksum = leftHash;
                rightChecksum = rightHash;
                leftAbsoluteSum = leftEnergy;
                rightAbsoluteSum = rightEnergy;
                long convertElapsed = System.nanoTime() - convertStarted;
                convertNanos += convertElapsed;

                long waitStarted = System.nanoTime();
                int pcmBytes =
                    framesThisChunk * channels * BYTES_PER_SAMPLE;
                while (line.available() < pcmBytes && stopRequested == 0) {
                    blockedPolls++;
                    try {
                        Thread.sleep(1L);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw interrupted;
                    }
                }
                long waitElapsed = System.nanoTime() - waitStarted;
                waitNanos += waitElapsed;
                if (waitElapsed > waitMaxNanos) waitMaxNanos = waitElapsed;
                if (stopRequested != 0) break;

                long writeStarted = System.nanoTime();
                int accepted = line.write(pcm, 0, pcmBytes);
                long writeElapsed = System.nanoTime() - writeStarted;
                writeNanos += writeElapsed;
                if (accepted != pcmBytes) {
                    throw new IOException(
                        "short SourceDataLine write: " + accepted);
                }
                writtenFrames += framesThisChunk;
                writtenBytes += accepted;
                writes++;
                recordChunk(mixElapsed, convertElapsed, writeElapsed);
            }
            pushNanos = System.nanoTime() - pushStarted;

            long drainStarted = System.nanoTime();
            line.drain();
            drainNanos = System.nanoTime() - drainStarted;
        } catch (Exception exception) {
            error = 1;
            exception.printStackTrace();
        } finally {
            if (line != null) {
                try {
                    line.close();
                } catch (Exception ignored) {
                    error = 1;
                }
            }
            done = 1;
        }
    }

    private static void recordChunk(
        long mixElapsed,
        long convertElapsed,
        long writeElapsed
    ) {
        long pipelineElapsed = mixElapsed + convertElapsed + writeElapsed;
        profiledChunks++;
        if (mixElapsed > mixMaxNanos) mixMaxNanos = mixElapsed;
        if (convertElapsed > convertMaxNanos) convertMaxNanos = convertElapsed;
        if (writeElapsed > writeMaxNanos) writeMaxNanos = writeElapsed;
        if (pipelineElapsed > pipelineMaxNanos) {
            pipelineMaxNanos = pipelineElapsed;
        }

        if (profiledChunks <= WARMUP_CHUNKS) {
            warmupChunks++;
            warmupPipelineNanos += pipelineElapsed;
        } else {
            steadyChunks++;
            steadyPipelineNanos += pipelineElapsed;
        }

        if (pipelineElapsed <= 5000000L) pipelineLe5Ms++;
        else if (pipelineElapsed <= 10000000L) pipelineLe10Ms++;
        else if (pipelineElapsed <= 15000000L) pipelineLe15Ms++;
        else if (pipelineElapsed <= 20000000L) pipelineLe20Ms++;
        else if (pipelineElapsed <= CHUNK_DEADLINE_NANOS) {
            pipelineWithinDeadline++;
        } else if (pipelineElapsed <= 30000000L) pipelineLe30Ms++;
        else if (pipelineElapsed <= 50000000L) pipelineLe50Ms++;
        else pipelineOver50Ms++;

        if (pipelineElapsed > CHUNK_DEADLINE_NANOS) {
            deadlineMisses++;
            currentDeadlineMissStreak++;
            if (currentDeadlineMissStreak > longestDeadlineMissStreak) {
                longestDeadlineMissStreak = currentDeadlineMissStreak;
            }
            long overrun = pipelineElapsed - CHUNK_DEADLINE_NANOS;
            if (overrun > worstDeadlineOverrunNanos) {
                worstDeadlineOverrunNanos = overrun;
            }
        } else {
            currentDeadlineMissStreak = 0;
        }
    }

    private static void hydrate(ui song, ud[] synth, ud[] vorbis)
        throws Exception {
        Field yField = ui.class.getDeclaredField("y");
        yField.setAccessible(true);
        int[] sampleIds = (int[]) yField.get(song);
        for (int index = 0; index < song.M.length; index++) {
            boolean compressed = (song.M[index] >> 4) != 0;
            int sampleId = sampleIds[index];
            ud sample = compressed ? vorbis[sampleId] : synth[sampleId];
            if (sample == null) {
                throw new IOException(
                    "missing " + (compressed ? "vorbis" : "synth") +
                    " sample " + sampleId);
            }
            song.g[index] = sample;
            song.M[index] &= 15;
        }
    }

    private static ud[][] readSampleBank(String path) throws IOException {
        ByteReader reader = new ByteReader(readAll(path));
        if (reader.i32() != BANK_MAGIC) {
            throw new IOException("invalid FunOrb sample bank");
        }
        ud[] synth = new ud[reader.i32()];
        ud[] vorbis = new ud[reader.i32()];
        int count = reader.i32();
        for (int index = 0; index < count; index++) {
            boolean compressed = reader.u8() != 0;
            int id = reader.i32();
            int rate = reader.i32();
            int loopStart = reader.i32();
            int loopEnd = reader.i32();
            boolean pingPong = reader.u8() != 0;
            byte[] pcm = reader.bytes(reader.i32());
            ud sample = new ud(rate, pcm, loopStart, loopEnd, pingPong);
            (compressed ? vorbis : synth)[id] = sample;
        }
        return new ud[][] { synth, vorbis };
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
        bankLoadNanos = 0L;
        trackLoadNanos = 0L;
        mixNanos = 0L;
        convertNanos = 0L;
        writeNanos = 0L;
        waitNanos = 0L;
        pushNanos = 0L;
        drainNanos = 0L;
        mixMaxNanos = 0L;
        convertMaxNanos = 0L;
        writeMaxNanos = 0L;
        waitMaxNanos = 0L;
        pipelineMaxNanos = 0L;
        worstDeadlineOverrunNanos = 0L;
        warmupPipelineNanos = 0L;
        steadyPipelineNanos = 0L;
        chunkDeadlineNanos = CHUNK_DEADLINE_NANOS;
        targetFrames = 0;
        writtenFrames = 0;
        writtenBytes = 0;
        writes = 0;
        blockedPolls = 0;
        checksum = 0;
        channels = 1;
        leftChecksum = 0;
        rightChecksum = 0;
        leftAbsoluteSum = 0L;
        rightAbsoluteSum = 0L;
        stopRequested = 0;
        error = 0;
        done = 0;
        profiledChunks = 0;
        warmupChunks = 0;
        steadyChunks = 0;
        deadlineMisses = 0;
        currentDeadlineMissStreak = 0;
        longestDeadlineMissStreak = 0;
        pipelineLe5Ms = 0;
        pipelineLe10Ms = 0;
        pipelineLe15Ms = 0;
        pipelineLe20Ms = 0;
        pipelineWithinDeadline = 0;
        pipelineLe30Ms = 0;
        pipelineLe50Ms = 0;
        pipelineOver50Ms = 0;
    }

    private static final class ByteReader {
        private final byte[] data;
        private int offset;

        ByteReader(byte[] data) {
            this.data = data;
        }

        int u8() throws IOException {
            require(1);
            return data[offset++] & 255;
        }

        int i32() throws IOException {
            require(4);
            int value = (data[offset] & 255) << 24 |
                (data[offset + 1] & 255) << 16 |
                (data[offset + 2] & 255) << 8 |
                data[offset + 3] & 255;
            offset += 4;
            return value;
        }

        byte[] bytes(int length) throws IOException {
            if (length < 0) throw new IOException("negative sample length");
            require(length);
            byte[] value = new byte[length];
            System.arraycopy(data, offset, value, 0, length);
            offset += length;
            return value;
        }

        void require(int length) throws IOException {
            if (offset + length > data.length) {
                throw new IOException("truncated FunOrb sample bank");
            }
        }
    }
}
