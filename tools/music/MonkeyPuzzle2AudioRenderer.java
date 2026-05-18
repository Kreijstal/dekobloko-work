import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

public final class MonkeyPuzzle2AudioRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;

    private static final String[] TRACKS = {
        "music/Monkey Puzzle water",
        "music/Monkey Puzzle jungle",
        "music/Monkey_Puzzle_world_Complete_Jingle",
        "music/monkey_puzzle_level_complete_jingle",
        "music/Monkey Puzzle countryside",
        "music/Monkey Puzzle aztec",
        "music/Monkey Puzzle Panic",
        "music/Monkey_Puzzle_game_over_Jingle",
        "music/Monkey Puzzle TitleScreen",
        "music/Monkey_Puzzle_Game_Complete_Jingle",
    };

    public static void main(String[] args) throws Exception {
        Path cache = Paths.get(args.length > 0 ? args[0] : ".work/games/monkeypuzzle2/js5-cache-build24/monkeypuzzle2");
        Path outRoot = Paths.get(args.length > 1 ? args[1] : ".work/games/monkeypuzzle2/music");
        Files.createDirectories(outRoot.resolve("wav"));

        va.i = SAMPLE_RATE;
        va.n = false;
        ad synth = archive(cache, 2);
        ad vorbis = archive(cache, 3);
        ud samples = new ud(synth, vorbis);
        byte[][] musicFiles = unpackGroup(readCacheGroup(cache, 5, 0), TRACKS.length);

        for (int i = 0; i < TRACKS.length; i++) {
            String name = TRACKS[i];
            lg song = new lg(new gk(musicFiles[i]), samples);
            int storedSamples = storedSamples(song);
            qf player = new qf(song);
            player.a(false);
            mj mixer = new mj();
            mixer.c(player);

            byte[] pcm = render(mixer, storedSamples);
            Path wav = outRoot.resolve("wav/" + safeName(name) + ".wav");
            writePcm16Wav(wav, pcm);
            System.out.printf(
                "music %s stored=%.3fs rendered=%.3fs%n",
                wav.getFileName(),
                storedSamples / (double)SAMPLE_RATE,
                pcm.length / (double)(SAMPLE_RATE * 2)
            );
        }
    }

    private static int storedSamples(lg song) {
        qf sequencer = new qf(song);
        sequencer.a(false);
        long samples = 0;
        while (true) {
            int delay = sequencer.a(null);
            if (delay < 0) {
                break;
            }
            samples += delay;
            if (samples > Integer.MAX_VALUE) {
                throw new IllegalStateException("stored song duration is too long");
            }
        }
        return (int)samples;
    }

    private static ad archive(Path cache, int archive) {
        return new ad(new CacheBackend(cache, archive), true, 1);
    }

    private static byte[][] unpackGroup(byte[] raw, int fileCount) {
        byte[] body = rc.a(raw, 120);
        if (fileCount == 1) {
            return new byte[][] {body};
        }
        int chunks = body[body.length - 1] & 0xff;
        int tableOffset = body.length - 1 - chunks * fileCount * 4;
        int[] sizes = new int[fileCount];
        int offset = tableOffset;
        for (int chunk = 0; chunk < chunks; chunk++) {
            int size = 0;
            for (int file = 0; file < fileCount; file++) {
                size += readInt(body, offset);
                offset += 4;
                sizes[file] += size;
            }
        }
        byte[][] files = new byte[fileCount][];
        for (int file = 0; file < fileCount; file++) {
            files[file] = new byte[sizes[file]];
            sizes[file] = 0;
        }
        offset = tableOffset;
        int dataOffset = 0;
        for (int chunk = 0; chunk < chunks; chunk++) {
            int size = 0;
            for (int file = 0; file < fileCount; file++) {
                size += readInt(body, offset);
                offset += 4;
                System.arraycopy(body, dataOffset, files[file], sizes[file], size);
                dataOffset += size;
                sizes[file] += size;
            }
        }
        return files;
    }

    private static int readInt(byte[] data, int offset) {
        return ((data[offset] & 0xff) << 24)
            | ((data[offset + 1] & 0xff) << 16)
            | ((data[offset + 2] & 0xff) << 8)
            | (data[offset + 3] & 0xff);
    }

    private static byte[] render(mj mixer, int storedSamples) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int rendered = 0;
        while (rendered < storedSamples) {
            Arrays.fill(mix, 0);
            int count = Math.min(BUFFER_SAMPLES, storedSamples - rendered);
            mixer.b(mix, 0, count);
            for (int i = 0; i < count; i++) {
                int sample = mix[i];
                writePcm16(pcm, sample >> 8);
            }
            rendered += count;
        }
        return pcm.toByteArray();
    }

    private static void writePcm16(ByteArrayOutputStream out, int sample) {
        int s = Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, sample));
        out.write(s & 0xff);
        out.write((s >>> 8) & 0xff);
    }

    private static void writePcm16Wav(Path out, byte[] pcm) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, 1);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * 2);
            writeLe16(data, 2);
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

    private static final class CacheBackend extends rf {
        private final Path cache;
        private final int archive;
        private wd index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        wd a(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                try {
                    index = new wd(raw, w.a(raw.length, raw, -18694), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new wd(stripped, w.a(stripped.length, stripped, -18694), null);
                }
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] b(int ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int ignored, int group) {
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
