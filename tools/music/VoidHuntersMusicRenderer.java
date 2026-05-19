import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.zip.GZIPInputStream;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class VoidHuntersMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int CHANNELS = 2;
    private static final int BUFFER_SAMPLES = 1024;
    private static final String[] TRACK_NAMES = {
        "voidhunters_vh_title_music",
        "voidhunters_vh_ingame_music",
        "voidhunters_vh_jingle_win",
        "voidhunters_vh_jingle_lose",
    };

    public static void main(String[] args) throws Exception {
        Path cache = args.length > 0
            ? Path.of(args[0])
            : Path.of(System.getProperty("user.home"), ".alterorb", "caches", "voidhunters");
        Path outRoot = Path.of(args.length > 1 ? args[1] : ".work/games/voidhunters/music");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        byte[][] songs = split(decompress(readCacheGroup(cache, 21, 0)), TRACK_NAMES.length);
        vka.a(SAMPLE_RATE, true, 10);
        asb samplesArchive = archive(cache, 19, 178);
        asb patches = archive(cache, 20, 17);
        bmb samples = new bmb(samplesArchive, samplesArchive);
        Constructor<kka> trackConstructor = kka.class.getDeclaredConstructor(ds.class);
        trackConstructor.setAccessible(true);

        int written = 0;
        for (int i = 0; i < songs.length; i++) {
            kka track = trackConstructor.newInstance(new ds(songs[i]));
            track.a();
            hbb player = new hbb();
            player.a(128, (byte)96, 9);
            if (!player.a(samples, -29476, patches, 1 << 28, track)) {
                throw new IllegalStateException("could not hydrate " + TRACK_NAMES[i]);
            }

            byte[] midi = repairMidi(track.e);
            Path midiOut = outRoot.resolve("midi/" + TRACK_NAMES[i] + ".mid");
            Files.write(midiOut, midi);
            Sequence sequence = MidiSystem.getSequence(midiOut.toFile());
            int storedSamples = (int)Math.min(
                Integer.MAX_VALUE,
                (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
            );

            player.a(false, track, -1);
            Path wavOut = outRoot.resolve("wav/" + TRACK_NAMES[i] + ".wav");
            writePcm16Wav(wavOut, render(player, storedSamples));
            System.out.printf("music %s stored=%.3fs%n", wavOut.getFileName(), storedSamples / (double)SAMPLE_RATE);
            written++;
        }
        System.out.printf("wrote %d tracks%n", written);
    }

    private static asb archive(Path cache, int archive, int fileCount) {
        return new asb(new CacheBackend(cache, archive, fileCount), true, 1);
    }

    private static byte[] render(hbb player, int storedSamples) throws Exception {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        int rendered = 0;
        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(BUFFER_SAMPLES, storedSamples - rendered);
            player.a(mix, 0, count);
            for (int i = 0; i < count * CHANNELS; i++) {
                int sample = mix[i] >> 8;
                sample = Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, sample));
                pcm.write(sample & 0xff);
                pcm.write((sample >>> 8) & 0xff);
            }
            rendered += count;
        }
        return pcm.toByteArray();
    }

    private static byte[] repairMidi(byte[] midi) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(midi.length + 64);
        out.write(midi, 0, 14);
        int pos = 14;
        while (pos < midi.length) {
            int originalLength = readBe32(midi, pos + 4);
            int dataStart = pos + 8;
            int dataEnd = Math.min(midi.length, dataStart + originalLength);
            byte[] track = repairTrack(midi, dataStart, dataEnd);
            out.write(new byte[] {'M', 'T', 'r', 'k'});
            writeBe32(out, track.length);
            out.write(track);
            pos = dataEnd;
        }
        return out.toByteArray();
    }

    private static byte[] repairTrack(byte[] midi, int pos, int end) {
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
            } else if (status < 0x80 && runningStatus >= 0) {
                int dataBytes = channelDataBytes(runningStatus);
                for (int i = 0; i < dataBytes && pos < end; i++) {
                    out.write(midi[pos++]);
                }
            } else {
                out.write(midi[pos++]);
                if (status == 0xff) {
                    if (pos < end) {
                        out.write(midi[pos++]);
                    }
                    long parsed = copyVarIntWithValue(midi, pos, out);
                    pos = (int)(parsed >>> 32);
                    int length = (int)parsed;
                    for (int i = 0; i < length && pos < end; i++) {
                        out.write(midi[pos++]);
                    }
                } else if (status == 0xf0 || status == 0xf7) {
                    long parsed = copyVarIntWithValue(midi, pos, out);
                    pos = (int)(parsed >>> 32);
                    int length = (int)parsed;
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
        }
        return out.toByteArray();
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
        return ((long)pos << 32) | (value & 0xffffffffL);
    }

    private static int channelDataBytes(int status) {
        int command = status & 0xf0;
        return command == 0xc0 || command == 0xd0 ? 1 : 2;
    }

    private static byte[] decompress(byte[] container) throws Exception {
        int compression = container[0] & 0xff;
        int length = readBe32(container, 1);
        if (compression == 0) {
            return Arrays.copyOfRange(container, 5, 5 + length);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(readBe32(container, 5));
        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(container, 9, length))) {
            gzip.transferTo(out);
        }
        return out.toByteArray();
    }

    private static byte[][] split(byte[] group, int count) {
        int stripes = group[group.length - 1] & 0xff;
        int table = group.length - 1 - stripes * count * 4;
        int pos = table;
        int[] sizes = new int[count];
        for (int s = 0; s < stripes; s++) {
            int delta = 0;
            for (int i = 0; i < count; i++) {
                delta += readBe32(group, pos);
                pos += 4;
                sizes[i] += delta;
            }
        }
        byte[][] files = new byte[count][];
        for (int i = 0; i < count; i++) {
            files[i] = new byte[sizes[i]];
        }
        pos = table;
        int data = 0;
        int[] offsets = new int[count];
        for (int s = 0; s < stripes; s++) {
            int delta = 0;
            for (int i = 0; i < count; i++) {
                delta += readBe32(group, pos);
                pos += 4;
                System.arraycopy(group, data, files[i], offsets[i], delta);
                offsets[i] += delta;
                data += delta;
            }
        }
        return files;
    }

    private static byte[] readCacheGroup(Path cache, int index, int group) throws Exception {
        byte[] idx = Files.readAllBytes(cache.resolve("main_file_cache.idx" + index));
        int offset = group * 6;
        int size = ((idx[offset] & 0xff) << 16) | ((idx[offset + 1] & 0xff) << 8) | (idx[offset + 2] & 0xff);
        int sector = ((idx[offset + 3] & 0xff) << 16) | ((idx[offset + 4] & 0xff) << 8) | (idx[offset + 5] & 0xff);
        byte[] dat = Files.readAllBytes(cache.resolve("main_file_cache.dat2"));
        byte[] out = new byte[size];
        int copied = 0;
        int chunk = 0;
        while (copied < size) {
            int sectorOffset = sector * 520;
            int gotGroup = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotGroup != group || gotChunk != chunk || gotIndex != index) {
                throw new IllegalStateException("bad cache sector");
            }
            int n = Math.min(512, size - copied);
            System.arraycopy(dat, sectorOffset + 8, out, copied, n);
            copied += n;
            sector = ((dat[sectorOffset + 4] & 0xff) << 16) | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
            chunk++;
        }
        return out;
    }

    private static int readBe32(byte[] data, int pos) {
        return ((data[pos] & 0xff) << 24) | ((data[pos + 1] & 0xff) << 16)
            | ((data[pos + 2] & 0xff) << 8) | (data[pos + 3] & 0xff);
    }

    private static void writeBe32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }

    private static void writePcm16Wav(Path out, byte[] pcm) throws Exception {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, CHANNELS);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * CHANNELS * 2);
            writeLe16(data, CHANNELS * 2);
            writeLe16(data, 16);
            data.writeBytes("data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
    }

    private static void writeLe16(DataOutputStream out, int value) throws Exception {
        out.writeByte(value & 0xff);
        out.writeByte((value >>> 8) & 0xff);
    }

    private static void writeLe32(DataOutputStream out, int value) throws Exception {
        out.writeByte(value & 0xff);
        out.writeByte((value >>> 8) & 0xff);
        out.writeByte((value >>> 16) & 0xff);
        out.writeByte((value >>> 24) & 0xff);
    }

    private static final class CacheBackend extends fnb {
        private final Path cache;
        private final int archive;
        private final int fileCount;
        private qp index;

        CacheBackend(Path cache, int archive, int fileCount) {
            this.cache = cache;
            this.archive = archive;
            this.fileCount = fileCount;
        }

        @Override
        int a(int group, boolean ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (Exception e) {
                return 0;
            }
        }

        @Override
        byte[] a(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        qp a(byte ignored) {
            if (index == null) {
                byte[] raw = syntheticIndex(fileCount);
                index = new qp(raw, psb.a(raw, raw.length, 0), null);
            }
            return index;
        }
    }

    private static byte[] syntheticIndex(int fileCount) {
        ByteArrayOutputStream rawOut = new ByteArrayOutputStream();
        rawOut.write(6);
        writeBe32(rawOut, 0);
        rawOut.write(1);
        rawOut.write(0);
        rawOut.write(1);
        rawOut.write(0);
        rawOut.write(0);
        writeBe32(rawOut, 0);
        writeBe32(rawOut, 0);
        writeBe32(rawOut, 0);
        rawOut.write((fileCount >>> 8) & 0xff);
        rawOut.write(fileCount & 0xff);
        for (int i = 0; i < fileCount; i++) {
            rawOut.write(0);
            rawOut.write(i == 0 ? 0 : 1);
        }
        for (int i = 0; i < fileCount; i++) {
            writeBe32(rawOut, 0);
        }
        byte[] raw = rawOut.toByteArray();
        ByteArrayOutputStream container = new ByteArrayOutputStream();
        container.write(0);
        writeBe32(container, raw.length);
        container.write(raw, 0, raw.length);
        return container.toByteArray();
    }
}
