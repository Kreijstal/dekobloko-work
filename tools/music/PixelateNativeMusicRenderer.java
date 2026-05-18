import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;

public final class PixelateNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;

    private static final List<String> TRACK_NAMES = List.of(
        "pix_title",
        "pix_end_game",
        "skin1",
        "skin2",
        "skin3",
        "skin4",
        "skin5",
        "skin6",
        "skin7",
        "skin8",
        "skin9",
        "skin10",
        "skin11",
        "skin12",
        "skin13",
        "skin14",
        "skin15",
        "skin16"
    );

    public static void main(String[] args) throws Exception {
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/music/pixelate-build55");
        Path cache = args.length > 1
            ? Path.of(args[1])
            : Path.of(".work/js5-caches-pixelate-build55/pixelate");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));

        mm.h = SAMPLE_RATE;
        mm.o = false;

        fm archive7 = archive(cache, 7);
        fm archive8 = archive(cache, 8);
        fm archive9 = archive(cache, 9);
        fm archive10 = archive(cache, 10);
        po samples = new po(archive7, archive8);

        for (String name : TRACK_NAMES) {
            ua track = ua.a(archive10, "", name);
            if (track == null) {
                throw new IllegalStateException("missing Pixelate music track " + name);
            }

            Path midi = outRoot.resolve("midi/" + name + ".mid");
            Files.write(midi, repairMidi(track.k));
            Sequence sequence = MidiSystem.getSequence(midi.toFile());
            int storedSamples = storedSamples(sequence);

            ti player = new ti();
            if (!player.a(track, samples, archive9, 109, 1 << 28)) {
                throw new IllegalStateException("failed to hydrate Pixelate instruments for " + name);
            }
            player.a(track, -39, false);

            byte[] pcm = renderPcm(player, storedSamples);
            Path wav = outRoot.resolve("wav/" + name + ".wav");
            writeMonoWav(wav, pcm);
            System.out.printf("%s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
        }
    }

    private static fm archive(Path cache, int archive) throws IOException {
        return new fm(new CacheArchive(cache, archive), true, 1);
    }

    private static int storedSamples(Sequence sequence) {
        return (int)Math.min(
            Integer.MAX_VALUE,
            (sequence.getMicrosecondLength() * (long)SAMPLE_RATE + 999_999L) / 1_000_000L
        );
    }

    private static byte[] renderPcm(ti player, int storedSamples) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int rendered = 0;

        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(mix.length, storedSamples - rendered);
            player.b(mix, 0, count);

            for (int i = 0; i < count; i++) {
                int sample = mix[i];
                int s = sample >> 8;
                if (s < Short.MIN_VALUE) {
                    s = Short.MIN_VALUE;
                } else if (s > Short.MAX_VALUE) {
                    s = Short.MAX_VALUE;
                }
                pcm.write(s & 0xff);
                pcm.write((s >>> 8) & 0xff);
            }

            rendered += count;
        }

        return pcm.toByteArray();
    }

    private static void writeMonoWav(Path out, byte[] pcm) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            writeAscii(data, "RIFF");
            writeLe32(data, 36 + pcm.length);
            writeAscii(data, "WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, 1);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * 2);
            writeLe16(data, 2);
            writeLe16(data, 16);
            writeAscii(data, "data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
    }

    private static byte[] repairMidi(byte[] midi) throws IOException {
        ByteArrayOutputStream fixed = new ByteArrayOutputStream(midi.length + 64);
        fixed.write(midi, 0, 14);
        int pos = 14;
        while (pos < midi.length) {
            if (pos + 8 > midi.length || midi[pos] != 'M' || midi[pos + 1] != 'T' || midi[pos + 2] != 'r' || midi[pos + 3] != 'k') {
                throw new IOException("bad MIDI track header at " + pos);
            }
            int size = ((midi[pos + 4] & 0xff) << 24)
                | ((midi[pos + 5] & 0xff) << 16)
                | ((midi[pos + 6] & 0xff) << 8)
                | (midi[pos + 7] & 0xff);
            int dataStart = pos + 8;
            int dataEnd = dataStart + size;
            if (dataEnd > midi.length) {
                throw new IOException("bad MIDI track size at " + pos);
            }
            byte[] track = Arrays.copyOfRange(midi, dataStart, dataEnd);
            if (track.length >= 3 && track[track.length - 3] == 0 && track[track.length - 2] == 0x2f && track[track.length - 1] == 0) {
                byte[] repaired = new byte[track.length + 1];
                System.arraycopy(track, 0, repaired, 0, track.length - 2);
                repaired[track.length - 2] = (byte)0xff;
                repaired[track.length - 1] = 0x2f;
                repaired[track.length] = 0;
                track = repaired;
            }
            fixed.write(new byte[] {'M', 'T', 'r', 'k'});
            writeBe32(fixed, track.length);
            fixed.write(track);
            pos = dataEnd;
        }
        return fixed.toByteArray();
    }

    private static void writeAscii(DataOutputStream out, String s) throws IOException {
        out.writeBytes(s);
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

    private static void writeBe32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }

    private static byte[] readCacheGroup(Path cache, int index, int archive) throws IOException {
        Path data = cache.resolve("main_file_cache.dat2");
        Path indexPath = cache.resolve("main_file_cache.idx" + index);
        byte[] idx = Files.readAllBytes(indexPath);
        int offset = archive * 6;
        if (offset + 6 > idx.length) {
            return null;
        }
        int size = ((idx[offset] & 0xff) << 16) | ((idx[offset + 1] & 0xff) << 8) | (idx[offset + 2] & 0xff);
        int sector = ((idx[offset + 3] & 0xff) << 16) | ((idx[offset + 4] & 0xff) << 8) | (idx[offset + 5] & 0xff);
        if (size == 0 || sector == 0) {
            return null;
        }

        byte[] dat = Files.readAllBytes(data);
        byte[] out = new byte[size];
        int copied = 0;
        int chunk = 0;
        while (copied < size) {
            int sectorOffset = sector * 520;
            if (sectorOffset + 8 > dat.length) {
                throw new IOException("bad sector " + sector + " for index " + index + " archive " + archive);
            }
            int gotArchive = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16)
                | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotArchive != archive || gotChunk != chunk || gotIndex != index) {
                throw new IOException("bad sector header for index " + index + " archive " + archive);
            }
            int n = Math.min(512, size - copied);
            System.arraycopy(dat, sectorOffset + 8, out, copied, n);
            copied += n;
            sector = next;
            chunk++;
        }
        return out;
    }

    private static final class CacheArchive extends jp {
        private final Path cache;
        private final int archive;
        private kj index;

        CacheArchive(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        byte[] a(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        kj a(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = new kj(raw, wg.a(raw, 125, raw.length), null);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int b(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
