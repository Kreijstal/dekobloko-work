import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;

public final class TetraLinkFunOrbMidiRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int MAX_SECONDS = 360;

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length > 0 ? args[0] : ".work/music/tetralink-build17");
        Path midiDir = root.resolve("midi/archive10_tracks");
        Path outDir = root.resolve("wav/funorb-midi-rendered");
        Files.createDirectories(outDir);

        nk.k = SAMPLE_RATE;
        TreeMap<Integer, wf> synthSamples = loadSynthSamples(root.resolve("split/archive07"));
        TreeMap<Integer, wf> vorbisSamples = loadVorbisSamples(root.resolve("split/archive08"));
        Map<Integer, byte[]> patchBytes = loadPatchBytes(root.resolve("split/archive09"));

        for (Path midi : sortedBins(midiDir, ".mid")) {
            g player = new g();
            hydrateAllInstruments(player, patchBytes, synthSamples, vorbisSamples);
            byte[] pcm = renderMidi(player, midi);
            Path wav = outDir.resolve(midi.getFileName().toString().replace(".mid", ".wav"));
            writePcm16Wav(wav, pcm);
            System.out.printf("%s %.3fs funorb-midi%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
        }
    }

    private static byte[] renderMidi(g player, Path midi) throws Exception {
        Sequence sequence = MidiSystem.getSequence(midi.toFile());
        if (sequence.getDivisionType() != Sequence.PPQ) {
            throw new IllegalArgumentException("only PPQ MIDI is supported: " + midi);
        }
        List<MidiEvent> events = new ArrayList<>();
        for (Track track : sequence.getTracks()) {
            for (int i = 0; i < track.size(); i++) {
                events.add(track.get(i));
            }
        }
        events.sort(Comparator.comparingLong(MidiEvent::getTick));

        Method handle = g.class.getDeclaredMethod("f", int.class, int.class);
        handle.setAccessible(true);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int[] buffer = new int[1024];
        long currentTick = 0;
        long currentFrame = 0;
        int tempoUsPerQuarter = 500000;
        int ppq = sequence.getResolution();

        for (MidiEvent event : events) {
            if (event.getTick() != currentTick) {
                long eventFrame = currentFrame + ticksToFrames(event.getTick() - currentTick, tempoUsPerQuarter, ppq);
                renderSamples(player, out, buffer, eventFrame - currentFrame);
                currentFrame = eventFrame;
                currentTick = event.getTick();
            }

            if (event.getMessage() instanceof MetaMessage) {
                MetaMessage meta = (MetaMessage)event.getMessage();
                if (meta.getType() == 0x51 && meta.getData().length == 3) {
                    byte[] data = meta.getData();
                    tempoUsPerQuarter = ((data[0] & 0xff) << 16) | ((data[1] & 0xff) << 8) | (data[2] & 0xff);
                }
            } else if (event.getMessage() instanceof ShortMessage) {
                ShortMessage shortMessage = (ShortMessage)event.getMessage();
                int packed = shortMessage.getStatus()
                    | (shortMessage.getData1() << 8)
                    | (shortMessage.getData2() << 16);
                handle.invoke(player, 91, packed);
            }
        }

        int silence = 0;
        int maxBytes = SAMPLE_RATE * MAX_SECONDS * 2;
        while (out.size() < maxBytes && silence < SAMPLE_RATE * 2) {
            Arrays.fill(buffer, 0);
            player.b(buffer, 0, buffer.length);
            writeBuffer(out, buffer);
            silence = isSilent(buffer) ? silence + buffer.length : 0;
        }
        return trimTrailingSilence(out.toByteArray(), SAMPLE_RATE / 2);
    }

    private static long ticksToFrames(long ticks, int tempoUsPerQuarter, int ppq) {
        return Math.round((double)ticks * (double)tempoUsPerQuarter * SAMPLE_RATE / ((double)ppq * 1000000.0));
    }

    private static void renderSamples(g player, ByteArrayOutputStream out, int[] buffer, long samples) {
        long remaining = samples;
        while (remaining > 0) {
            int len = (int)Math.min(buffer.length, remaining);
            Arrays.fill(buffer, 0);
            player.b(buffer, 0, len);
            writeBuffer(out, buffer, len);
            remaining -= len;
        }
    }

    private static void writeBuffer(ByteArrayOutputStream out, int[] buffer) {
        writeBuffer(out, buffer, buffer.length);
    }

    private static void writeBuffer(ByteArrayOutputStream out, int[] buffer, int len) {
        for (int i = 0; i < len; i++) {
            int value = buffer[i] >> 8;
            if (value < -32768) value = -32768;
            if (value > 32767) value = 32767;
            out.write(value & 0xff);
            out.write((value >>> 8) & 0xff);
        }
    }

    private static void hydrateAllInstruments(
        g player,
        Map<Integer, byte[]> patchBytes,
        Map<Integer, wf> synthSamples,
        Map<Integer, wf> vorbisSamples
    ) throws Exception {
        Field cacheField = g.class.getDeclaredField("A");
        cacheField.setAccessible(true);
        dj cache = (dj) cacheField.get(player);
        List<String> missing = new ArrayList<>();
        for (Map.Entry<Integer, byte[]> entry : patchBytes.entrySet()) {
            ng instrument = new ng(entry.getValue());
            hydrateInstrument(instrument, null, synthSamples, vorbisSamples, missing);
            cache.a(entry.getKey(), -53, instrument);
        }
        if (!missing.isEmpty()) {
            System.err.println("missing native music resources " + missing);
        }
    }

    private static void hydrateInstrument(
        ng instrument,
        byte[] noteMask,
        Map<Integer, wf> synthSamples,
        Map<Integer, wf> vorbisSamples,
        List<String> missing
    ) throws Exception {
        Field refsField = ng.class.getDeclaredField("B");
        refsField.setAccessible(true);
        int[] refs = (int[]) refsField.get(instrument);
        int previousRef = 0;
        wf previousSample = null;
        for (int note = 0; note < 128; note++) {
            if (noteMask != null && noteMask[note] == 0) {
                continue;
            }
            int ref = refs[note];
            if (ref == 0) {
                continue;
            }
            if (ref != previousRef) {
                previousRef = ref;
                int key = ref - 1;
                int sampleId = key >> 2;
                boolean synth = (key & 1) == 0;
                previousSample = (synth ? synthSamples : vorbisSamples).get(sampleId);
                if (previousSample == null) {
                    missing.add((synth ? "synth:" : "vorbis:") + sampleId);
                }
            }
            if (previousSample != null) {
                instrument.z[note] = previousSample;
                refs[note] = 0;
            }
        }
    }

    private static TreeMap<Integer, wf> loadSynthSamples(Path dir) throws Exception {
        Constructor<ge> ctor = ge.class.getDeclaredConstructor(bh.class);
        ctor.setAccessible(true);
        Method decode = ge.class.getDeclaredMethod("b");
        decode.setAccessible(true);
        TreeMap<Integer, wf> out = new TreeMap<>();
        for (Path file : sortedBins(dir, ".synth.bin")) {
            ge sample = ctor.newInstance(new bh(Files.readAllBytes(file)));
            out.put(fileId(file), (wf)decode.invoke(sample));
        }
        return out;
    }

    private static TreeMap<Integer, wf> loadVorbisSamples(Path dir) throws Exception {
        List<Path> files = sortedBins(dir, ".packvorbis.bin");
        TreeMap<Integer, wf> out = new TreeMap<>();
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
                loadHeaders.invoke(null, (Object)Files.readAllBytes(header));
                TreeMap<Integer, wf> decoded = new TreeMap<>();
                for (Path file : files) {
                    if (file.equals(header)) {
                        continue;
                    }
                    ag sample = ctor.newInstance((Object)Files.readAllBytes(file));
                    decoded.put(fileId(file), (wf)decode.invoke(sample));
                }
                return decoded;
            } catch (ReflectiveOperationException | RuntimeException ex) {
                lastError = ex instanceof Exception ? (Exception)ex : new Exception(ex);
            }
        }
        throw lastError != null ? lastError : new IllegalStateException("no archive08 Vorbis header found");
    }

    private static Map<Integer, byte[]> loadPatchBytes(Path dir) throws Exception {
        Map<Integer, byte[]> out = new HashMap<>();
        for (Path file : sortedBins(dir, ".patch.bin")) {
            out.put(fileId(file), Files.readAllBytes(file));
        }
        return out;
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
            short sample = (short)((hi << 8) | lo);
            if (Math.abs(sample) > 4) break;
            last -= 2;
        }
        int keepBytes = keepSamples * 2;
        int len = Math.min(pcm16le.length, Math.max(0, last + 2 + keepBytes));
        byte[] out = new byte[len];
        System.arraycopy(pcm16le, 0, out, 0, len);
        return out;
    }

    private static void writePcm16Wav(Path path, byte[] data) throws IOException {
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
}
