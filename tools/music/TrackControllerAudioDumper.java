import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import javax.sound.midi.MidiSystem;

public final class TrackControllerAudioDumper {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int CHANNELS = 2;
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final String[] MUSIC_TRACKS = {
        "track controller titlescreen",
        "track controller new",
        "track controller level complete",
        "track controller game over"
    };

    private static final String[] EFFECTS = {
        "track_wrong_password",
        "track_correct_password",
        "track_train_loop",
        "track_train_whistle",
        "track_train_fade",
        "track_blockconnect",
        "track_blockpush_1",
        "track_footstep_1_and_2",
        "track_slide_4",
        "score_count",
        "block_disconnect_placeholder",
        "cannot_push_placeholder"
    };

    public static void main(String[] args) throws Exception {
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/games/trackcontroller/music");
        Path cache = args.length > 1
            ? Path.of(args[1])
            : Path.of(".work/games/trackcontroller/js5-cache");
        Files.createDirectories(outRoot.resolve("midi/named"));
        Files.createDirectories(outRoot.resolve("wav-native/named"));
        Files.createDirectories(outRoot.resolve("wav-effects/named"));

        oa.a(SAMPLE_RATE, true, 10);

        kk music = archive(cache, 2);
        kk effects = archive(cache, 3);
        kk patches = archive(cache, 4);
        kk samplesArchive = archive(cache, 5);
        jc samples = new jc(effects, samplesArchive);

        for (String name : MUSIC_TRACKS) {
            wb track = wb.a(music, "", name);
            if (track == null) {
                throw new IllegalStateException("missing music file " + name);
            }
            Path midi = outRoot.resolve("midi/named/" + safeName(name) + ".mid");
            Files.write(midi, repairMidi(track.j));
            MidiSystem.getSequence(midi.toFile());

            nb player = new nb();
            player.a(128, (byte)-119, -1);
            player.d(16384, kc.b);
            if (!player.a(patches, (byte)-27, 0, samples, track)) {
                throw new IllegalStateException("failed to hydrate " + name);
            }
            player.a(track, 14526, false);

            byte[] pcm = renderMusic(player);
            Path wav = outRoot.resolve("wav-native/named/" + safeName(name) + ".wav");
            writePcm16Wav(wav, pcm, CHANNELS);
            System.out.printf("music %s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2));
        }

        for (String name : EFFECTS) {
            cc effect = cc.a(effects, "", name);
            if (effect == null) {
                System.out.printf("missing effect %s%n", name);
                continue;
            }
            ik sample = effect.b();
            Path wav = outRoot.resolve("wav-effects/named/" + safeName(name) + ".wav");
            writeEffectWav(wav, sample);
            System.out.printf("effect %s %.3fs%n", wav.getFileName(), sample.j.length / (double)sample.l);
        }
    }

    private static kk archive(Path cache, int archive) {
        return new kk(new CacheBackend(cache, archive), true, 1);
    }

    private static byte[] renderMusic(nb player) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES * CHANNELS];
        int silentTail = 0;
        int rendered = 0;
        int maxSamples = SAMPLE_RATE * MAX_SECONDS;
        while (rendered < maxSamples) {
            Arrays.fill(mix, 0);
            player.a(mix, 0, BUFFER_SAMPLES);
            boolean silent = true;
            for (int sample : mix) {
                if (sample != 0) {
                    silent = false;
                }
                int s = sample >> 8;
                if (s < Short.MIN_VALUE) {
                    s = Short.MIN_VALUE;
                } else if (s > Short.MAX_VALUE) {
                    s = Short.MAX_VALUE;
                }
                pcm.write(s & 0xff);
                pcm.write((s >>> 8) & 0xff);
            }
            rendered += BUFFER_SAMPLES;
            if (silent) {
                silentTail += BUFFER_SAMPLES;
            } else {
                silentTail = 0;
            }
            if (!player.c((byte)-64) && silentTail >= TAIL_SILENCE_SAMPLES) {
                break;
            }
        }
        byte[] bytes = pcm.toByteArray();
        int trim = Math.min(silentTail, TAIL_SILENCE_SAMPLES) * CHANNELS * 2;
        if (trim > 0 && trim < bytes.length) {
            return Arrays.copyOf(bytes, bytes.length - trim);
        }
        return bytes;
    }

    private static byte[] repairMidi(byte[] midi) throws IOException {
        ByteArrayOutputStream fixed = new ByteArrayOutputStream(midi.length + 64);
        fixed.write(midi, 0, 14);
        int pos = 14;
        while (pos < midi.length) {
            if (pos + 8 > midi.length || midi[pos] != 'M' || midi[pos + 1] != 'T'
                    || midi[pos + 2] != 'r' || midi[pos + 3] != 'k') {
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
            if (track.length >= 3 && track[track.length - 3] != (byte)0xff
                    && track[track.length - 2] == 0x2f && track[track.length - 1] == 0) {
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

    private static void writeEffectWav(Path out, ik sample) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(sample.j.length * 2);
        for (byte value : sample.j) {
            int s = value << 8;
            pcm.write(s & 0xff);
            pcm.write((s >>> 8) & 0xff);
        }
        writePcm16Wav(out, pcm.toByteArray(), 1, sample.l);
    }

    private static void writePcm16Wav(Path out, byte[] pcm, int channels) throws IOException {
        writePcm16Wav(out, pcm, channels, SAMPLE_RATE);
    }

    private static void writePcm16Wav(Path out, byte[] pcm, int channels, int sampleRate) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, channels);
            writeLe32(data, sampleRate);
            writeLe32(data, sampleRate * channels * 2);
            writeLe16(data, channels * 2);
            writeLe16(data, 16);
            data.writeBytes("data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
    }

    private static String safeName(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
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

    private static final class CacheBackend extends wi {
        private final Path cache;
        private final int archive;
        private pc index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        pc a(int ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                try {
                    index = new pc(raw, ql.a(0, raw, raw.length), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new pc(stripped, ql.a(0, stripped, stripped.length), null);
                }
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int b(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                return 0;
            }
        }
    }

    private static byte[] readCacheGroup(Path cache, int index, int group) throws IOException {
        Path idxPath = cache.resolve("main_file_cache.idx" + index);
        if (!Files.exists(idxPath)) {
            return null;
        }
        byte[] idx = Files.readAllBytes(idxPath);
        int offset = group * 6;
        if (offset + 6 > idx.length) {
            return null;
        }
        int size = ((idx[offset] & 0xff) << 16) | ((idx[offset + 1] & 0xff) << 8) | (idx[offset + 2] & 0xff);
        int sector = ((idx[offset + 3] & 0xff) << 16) | ((idx[offset + 4] & 0xff) << 8) | (idx[offset + 5] & 0xff);
        if (size == 0 || sector == 0) {
            return null;
        }
        byte[] dat = Files.readAllBytes(cache.resolve("main_file_cache.dat2"));
        byte[] out = new byte[size];
        int copied = 0;
        int chunk = 0;
        while (copied < size) {
            int sectorOffset = sector * 520;
            if (sectorOffset + 8 > dat.length) {
                throw new IOException("bad sector " + sector + " for index " + index + " group " + group);
            }
            int gotGroup = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16)
                | ((dat[sectorOffset + 5] & 0xff) << 8)
                | (dat[sectorOffset + 6] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotGroup != group || gotChunk != chunk || gotIndex != index) {
                throw new IOException("bad sector header for index " + index + " group " + group);
            }
            int n = Math.min(512, size - copied);
            System.arraycopy(dat, sectorOffset + 8, out, copied, n);
            copied += n;
            sector = next;
            chunk++;
        }
        return out;
    }
}
