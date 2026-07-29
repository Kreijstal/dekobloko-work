import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;

/**
 * Deliberately expensive live-client audio diagnostics.
 *
 * The bytecode injector calls this class from the original obfuscated mixer.
 * It reports mixer-budget decisions and a small before/after probe of every
 * raw PCM voice.  Lines beginning with [AUDIO_TRACE] are forwarded by the
 * diagnostic browser launcher to its telemetry endpoint.
 */
public final class AudioTrace {
    private static final int REPORT_CHUNKS = 64;
    private static final int PROBE_POINTS = 32;

    private static final IdentityHashMap<Object, MixerStats> MIXERS =
        new IdentityHashMap<Object, MixerStats>();
    private static final IdentityHashMap<Object, VoiceStats> VOICES =
        new IdentityHashMap<Object, VoiceStats>();
    private static final IdentityHashMap<Object, CompressedStats> COMPRESSED =
        new IdentityHashMap<Object, CompressedStats>();
    private static int nextMixerId = 1;
    private static int nextVoiceId = 1;
    private static MixerStats currentMixer;
    public static String lastReport;
    public static int reports;
    private static int headerCalls;
    private static int headerLength = -1;
    private static int headerNonZero;
    private static int headerChecksum;
    private static int decoderSequence;
    private static int headerSequence;
    private static int cleanupCalls;
    private static int cleanupSequence;
    private static int headerSmallBlock;
    private static int headerLargeBlock;
    private static int headerTableValues;
    private static int headerTableNonZero;
    private static int headerTableChecksum;
    private static int activePacketDecodes;
    private static int maximumConcurrentPacketDecodes;
    private static int overlappingPacketDecodes;

    private AudioTrace() {
    }

    public static void mixerStart(Object mixer, int frames, int budget) {
        MixerStats stats = MIXERS.get(mixer);
        if (stats == null) {
            stats = new MixerStats(nextMixerId++);
            MIXERS.put(mixer, stats);
        }
        currentMixer = stats;
        stats.chunks++;
        stats.frames += frames;
        stats.budget = budget;
    }

    public static void mixerEnd(Object mixer) {
        MixerStats stats = MIXERS.get(mixer);
        currentMixer = null;
        if (stats == null || stats.chunks < REPORT_CHUNKS) return;
        if (stats.catchupCalls != 0 || !stats.mixedByType.isEmpty() ||
                !stats.skippedByType.isEmpty()) {
            emit(stats);
        }
        stats.resetInterval();
    }

    public static void dispatch(Object stream, boolean mixed, int frames) {
        MixerStats stats = currentMixer;
        if (stats == null) return;
        String type = stream == null ? "null" : stream.getClass().getName();
        increment(mixed ? stats.mixedByType : stats.skippedByType, type, frames);
        if (!mixed) {
            VoiceStats voice = voice(stream);
            voice.skippedCalls++;
            voice.skippedFrames += frames;
        }
    }

    public static void catchup(Object mixer, int frames) {
        MixerStats stats = MIXERS.get(mixer);
        if (stats == null) {
            stats = new MixerStats(nextMixerId++);
            MIXERS.put(mixer, stats);
        }
        stats.catchupCalls++;
        stats.catchupFrames += frames;
    }

    public static void voiceCreated(
        Object stream,
        int channel,
        int sample,
        int start,
        int rate,
        int volume,
        int pan
    ) {
        VoiceStats voice = voice(stream);
        voice.channel = channel;
        voice.sample = sample;
        voice.start = start;
        voice.rate = rate;
        voice.volume = volume;
        voice.pan = pan;
        voice.known = true;
        voice.creations++;
        captureSource(voice, stream);
    }

    public static void compressedCreated(Object decoder, byte[] encoded) {
        CompressedStats stats = new CompressedStats();
        fingerprint(encoded, stats, true);
        COMPRESSED.put(decoder, stats);
    }

    public static void compressedHeader(byte[] encoded) {
        CompressedStats stats = new CompressedStats();
        fingerprint(encoded, stats, true);
        headerCalls++;
        headerLength = stats.inputLength;
        headerNonZero = stats.inputNonZero;
        headerChecksum = stats.inputChecksum;
        headerSequence = ++decoderSequence;
    }

    public static void compressedCleanup() {
        cleanupCalls++;
        cleanupSequence = ++decoderSequence;
    }

    public static void compressedHeaderComplete(
        int smallBlock,
        int largeBlock,
        float[] firstA,
        float[] firstB,
        float[] firstC,
        float[] secondA,
        float[] secondB,
        float[] secondC
    ) {
        headerSmallBlock = smallBlock;
        headerLargeBlock = largeBlock;
        headerTableValues = 0;
        headerTableNonZero = 0;
        int checksum = 0x811c9dc5;
        float[][] tables = {
            firstA, firstB, firstC, secondA, secondB, secondC
        };
        for (int tableIndex = 0; tableIndex < tables.length; tableIndex++) {
            float[] table = tables[tableIndex];
            if (table == null) continue;
            headerTableValues += table.length;
            for (int index = 0; index < table.length; index++) {
                if (table[index] != 0.0f) headerTableNonZero++;
                checksum ^= Float.floatToIntBits(table[index]);
                checksum *= 0x01000193;
            }
        }
        headerTableChecksum = checksum;
    }

    public static void packetDecodeStart() {
        activePacketDecodes++;
        if (activePacketDecodes > maximumConcurrentPacketDecodes) {
            maximumConcurrentPacketDecodes = activePacketDecodes;
        }
        if (activePacketDecodes > 1) overlappingPacketDecodes++;
    }

    public static void packetDecodeEnd() {
        activePacketDecodes--;
    }

    public static void decodedCreated(Object decoder, Object decoded) {
        CompressedStats stats = COMPRESSED.get(decoder);
        if (stats == null) {
            stats = new CompressedStats();
            COMPRESSED.put(decoder, stats);
        }
        if (decoded instanceof ud) {
            fingerprint(((ud) decoded).o, stats, false);
            stats.outputSequence = ++decoderSequence;
        }
    }

    private static void fingerprint(
        byte[] bytes,
        CompressedStats stats,
        boolean input
    ) {
        int nonZero = 0;
        int checksum = 0x811c9dc5;
        if (bytes != null) {
            for (int index = 0; index < bytes.length; index++) {
                if (bytes[index] != 0) nonZero++;
                checksum ^= bytes[index] & 255;
                checksum *= 0x01000193;
            }
        }
        if (input) {
            stats.inputLength = bytes == null ? -1 : bytes.length;
            stats.inputNonZero = nonZero;
            stats.inputChecksum = checksum;
        } else {
            stats.outputLength = bytes == null ? -1 : bytes.length;
            stats.outputNonZero = nonZero;
            stats.outputChecksum = checksum;
        }
    }

    private static void captureSource(VoiceStats voice, Object stream) {
        if (!(stream instanceof ol)) return;
        ti rawSource = ((ol) stream).q;
        if (!(rawSource instanceof ud)) return;
        ud source = (ud) rawSource;
        byte[] pcm = source.o;
        voice.sourceRate = source.p;
        voice.sourceLoopStart = source.q;
        voice.sourceLoopEnd = source.s;
        voice.sourcePingPong = source.r;
        voice.sourceLength = pcm == null ? -1 : pcm.length;
        voice.sourceNonZero = 0;
        voice.sourcePeak = 0;
        int checksum = 0x811c9dc5;
        if (pcm != null) {
            for (int index = 0; index < pcm.length; index++) {
                int sample = pcm[index];
                int absolute = sample < 0 ? -sample : sample;
                if (sample != 0) voice.sourceNonZero++;
                if (absolute > voice.sourcePeak) voice.sourcePeak = absolute;
                checksum ^= sample & 255;
                checksum *= 0x01000193;
            }
        }
        voice.sourceChecksum = checksum;
    }

    public static void leafStart(Object stream, int[] output, int offset, int frames) {
        VoiceStats voice = voice(stream);
        voice.mixCalls++;
        int length = output == null ? 0 : output.length;
        voice.probeLength = Math.min(PROBE_POINTS, length);
        for (int index = 0; index < voice.probeLength; index++) {
            int position = probePosition(index, voice.probeLength, length);
            voice.probe[index] = output[position];
        }
    }

    public static void leafEnd(Object stream, int[] output, int offset, int frames) {
        VoiceStats voice = voice(stream);
        int length = output == null ? 0 : output.length;
        int probeLength = Math.min(voice.probeLength, length);
        long delta = 0L;
        int changed = 0;
        for (int index = 0; index < probeLength; index++) {
            int position = probePosition(index, probeLength, length);
            long difference = (long) output[position] - (long) voice.probe[index];
            if (difference != 0L) changed++;
            delta += difference < 0L ? -difference : difference;
        }
        if (changed == 0) {
            voice.silentCalls++;
        } else {
            voice.changedCalls++;
            voice.changedProbePoints += changed;
            voice.absoluteProbeDelta += delta;
        }
    }

    private static VoiceStats voice(Object stream) {
        VoiceStats voice = VOICES.get(stream);
        if (voice == null) {
            voice = new VoiceStats(nextVoiceId++);
            VOICES.put(stream, voice);
        }
        return voice;
    }

    private static int probePosition(int index, int points, int length) {
        if (length <= 1 || points <= 1) return 0;
        return (int) ((long) index * (long) (length - 1) / (long) (points - 1));
    }

    private static void increment(Map<String, Counter> counters, String type, int frames) {
        Counter counter = counters.get(type);
        if (counter == null) {
            counter = new Counter();
            counters.put(type, counter);
        }
        counter.calls++;
        counter.frames += frames;
    }

    private static void emit(MixerStats stats) {
        List<VoiceStats> active = new ArrayList<VoiceStats>();
        List<VoiceStats> silent = new ArrayList<VoiceStats>();
        for (VoiceStats voice : VOICES.values()) {
            if (voice.mixCalls != 0 || voice.skippedCalls != 0) active.add(voice);
            if (voice.known && voice.mixCalls != 0 && voice.changedCalls == 0) {
                silent.add(voice);
            }
        }
        Collections.sort(active, new Comparator<VoiceStats>() {
            public int compare(VoiceStats left, VoiceStats right) {
                if (left.absoluteProbeDelta == right.absoluteProbeDelta) {
                    return left.id - right.id;
                }
                return left.absoluteProbeDelta < right.absoluteProbeDelta ? 1 : -1;
            }
        });
        Collections.sort(silent, new Comparator<VoiceStats>() {
            public int compare(VoiceStats left, VoiceStats right) {
                return right.mixCalls - left.mixCalls;
            }
        });

        StringBuilder out = new StringBuilder(4096);
        out.append('{');
        field(out, "schema", 1).append(',');
        field(out, "mixer", stats.id).append(',');
        field(out, "chunks", stats.chunks).append(',');
        field(out, "frames", stats.frames).append(',');
        field(out, "budget", stats.budget).append(',');
        field(out, "catchupCalls", stats.catchupCalls).append(',');
        field(out, "catchupFrames", stats.catchupFrames).append(',');
        field(out, "headerCalls", headerCalls).append(',');
        field(out, "headerLength", headerLength).append(',');
        field(out, "headerNonZero", headerNonZero).append(',');
        field(out, "headerChecksum", headerChecksum & 0xffffffffL).append(',');
        field(out, "headerSequence", headerSequence).append(',');
        field(out, "cleanupCalls", cleanupCalls).append(',');
        field(out, "cleanupSequence", cleanupSequence).append(',');
        field(out, "headerSmallBlock", headerSmallBlock).append(',');
        field(out, "headerLargeBlock", headerLargeBlock).append(',');
        field(out, "headerTableValues", headerTableValues).append(',');
        field(out, "headerTableNonZero", headerTableNonZero).append(',');
        field(out, "headerTableChecksum", headerTableChecksum & 0xffffffffL).append(',');
        field(out, "maximumConcurrentPacketDecodes",
            maximumConcurrentPacketDecodes).append(',');
        field(out, "overlappingPacketDecodes", overlappingPacketDecodes).append(',');
        out.append("\"mixed\":");
        counters(out, stats.mixedByType);
        out.append(",\"skipped\":");
        counters(out, stats.skippedByType);
        out.append(",\"voices\":");
        voices(out, active, 16);
        out.append(",\"silentVoices\":");
        voices(out, silent, 12);
        out.append(",\"compressed\":");
        compressed(out);
        out.append('}');
        lastReport = out.toString();
        reports++;
        System.out.println("[AUDIO_TRACE] " + lastReport);

        for (VoiceStats voice : VOICES.values()) voice.resetInterval();
    }

    private static void counters(StringBuilder out, Map<String, Counter> values) {
        out.append('{');
        boolean first = true;
        for (Map.Entry<String, Counter> entry : values.entrySet()) {
            if (!first) out.append(',');
            first = false;
            quote(out, entry.getKey()).append(':').append('{');
            field(out, "calls", entry.getValue().calls).append(',');
            field(out, "frames", entry.getValue().frames);
            out.append('}');
        }
        out.append('}');
    }

    private static void voices(StringBuilder out, List<VoiceStats> values, int limit) {
        out.append('[');
        int count = Math.min(limit, values.size());
        for (int index = 0; index < count; index++) {
            if (index != 0) out.append(',');
            VoiceStats voice = values.get(index);
            out.append('{');
            field(out, "id", voice.id).append(',');
            field(out, "known", voice.known).append(',');
            field(out, "channel", voice.channel).append(',');
            field(out, "sample", voice.sample).append(',');
            field(out, "rate", voice.rate).append(',');
            field(out, "volume", voice.volume).append(',');
            field(out, "pan", voice.pan).append(',');
            field(out, "sourceRate", voice.sourceRate).append(',');
            field(out, "sourceLength", voice.sourceLength).append(',');
            field(out, "sourceNonZero", voice.sourceNonZero).append(',');
            field(out, "sourcePeak", voice.sourcePeak).append(',');
            field(out, "sourceChecksum", voice.sourceChecksum & 0xffffffffL).append(',');
            field(out, "sourceLoopStart", voice.sourceLoopStart).append(',');
            field(out, "sourceLoopEnd", voice.sourceLoopEnd).append(',');
            field(out, "sourcePingPong", voice.sourcePingPong).append(',');
            field(out, "mixCalls", voice.mixCalls).append(',');
            field(out, "changedCalls", voice.changedCalls).append(',');
            field(out, "silentCalls", voice.silentCalls).append(',');
            field(out, "skippedCalls", voice.skippedCalls).append(',');
            field(out, "skippedFrames", voice.skippedFrames).append(',');
            field(out, "probeDelta", voice.absoluteProbeDelta);
            out.append('}');
        }
        out.append(']');
    }

    private static void compressed(StringBuilder out) {
        out.append('[');
        boolean first = true;
        int count = 0;
        for (CompressedStats stats : COMPRESSED.values()) {
            if (stats.outputLength <= 0 || count >= 24) continue;
            if (!first) out.append(',');
            first = false;
            count++;
            out.append('{');
            field(out, "inputLength", stats.inputLength).append(',');
            field(out, "inputNonZero", stats.inputNonZero).append(',');
            field(out, "inputChecksum", stats.inputChecksum & 0xffffffffL).append(',');
            field(out, "outputLength", stats.outputLength).append(',');
            field(out, "outputNonZero", stats.outputNonZero).append(',');
            field(out, "outputChecksum", stats.outputChecksum & 0xffffffffL);
            out.append(',');
            field(out, "outputSequence", stats.outputSequence);
            out.append('}');
        }
        out.append(']');
    }

    private static StringBuilder field(StringBuilder out, String name, long value) {
        return quote(out, name).append(':').append(value);
    }

    private static StringBuilder field(StringBuilder out, String name, boolean value) {
        return quote(out, name).append(':').append(value);
    }

    private static StringBuilder quote(StringBuilder out, String value) {
        out.append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character == '"' || character == '\\') out.append('\\');
            out.append(character);
        }
        return out.append('"');
    }

    private static final class MixerStats {
        final int id;
        int chunks;
        long frames;
        int budget;
        int catchupCalls;
        long catchupFrames;
        final Map<String, Counter> mixedByType = new HashMap<String, Counter>();
        final Map<String, Counter> skippedByType = new HashMap<String, Counter>();

        MixerStats(int id) {
            this.id = id;
        }

        void resetInterval() {
            chunks = 0;
            frames = 0L;
            catchupCalls = 0;
            catchupFrames = 0L;
            mixedByType.clear();
            skippedByType.clear();
        }
    }

    private static final class VoiceStats {
        final int id;
        final int[] probe = new int[PROBE_POINTS];
        int probeLength;
        boolean known;
        int channel = -1;
        int sample = -1;
        int start;
        int rate;
        int volume;
        int pan;
        int sourceRate;
        int sourceLength = -1;
        int sourceNonZero;
        int sourcePeak;
        int sourceChecksum;
        int sourceLoopStart;
        int sourceLoopEnd;
        boolean sourcePingPong;
        int creations;
        int mixCalls;
        int changedCalls;
        int silentCalls;
        int changedProbePoints;
        long absoluteProbeDelta;
        int skippedCalls;
        long skippedFrames;

        VoiceStats(int id) {
            this.id = id;
        }

        void resetInterval() {
            probeLength = 0;
            mixCalls = 0;
            changedCalls = 0;
            silentCalls = 0;
            changedProbePoints = 0;
            absoluteProbeDelta = 0L;
            skippedCalls = 0;
            skippedFrames = 0L;
        }
    }

    private static final class Counter {
        int calls;
        long frames;
    }

    private static final class CompressedStats {
        int inputLength = -1;
        int inputNonZero;
        int inputChecksum;
        int outputLength = -1;
        int outputNonZero;
        int outputChecksum;
        int outputSequence;
    }
}
