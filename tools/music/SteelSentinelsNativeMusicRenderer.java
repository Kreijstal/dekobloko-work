import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

public final class SteelSentinelsNativeMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final List<String> TRACK_NAMES = List.of(
        "md_title_music",
        "war_zone",
        "lost_world",
        "cityscape",
        "thats_no_moon",
        "star_fleet"
    );

    public static void main(String[] args) throws Exception {
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/games/steelsentinels/music");
        Path cache = args.length > 1
            ? Path.of(args[1])
            : Path.of(".work/games/steelsentinels/js5-cache");
        Files.createDirectories(outRoot.resolve("midi/archive10_tracks"));
        Files.createDirectories(outRoot.resolve("wav-native/archive10_tracks"));

        tb.a(SAMPLE_RATE, false, 10);

        cm archive7 = archive(cache, 7);
        cm archive8 = archive(cache, 8);
        cm archive9 = archive(cache, 9);
        cm archive10 = archive(cache, 10);
        ub samples = new ub(archive7, archive8);

        for (String name : TRACK_NAMES) {
            tg track = tg.a(archive10, "", name);
            if (track == null) {
                throw new IllegalStateException("missing Steel Sentinels music track " + name);
            }

            Files.write(outRoot.resolve("midi/archive10_tracks/" + safeName(name) + ".mid"), repairMidi(track.tg_p));

            ic player = new ic();
            player.a(256, 1000000);
            player.a(-1, (byte)20, 200);
            if (!player.a(0, track, 21687, samples, archive9)) {
                throw new IllegalStateException("failed to hydrate Steel Sentinels instruments for " + name);
            }
            track.b();
            player.a(true, false, track);

            byte[] pcm = renderPcm(player);
            Path wav = outRoot.resolve("wav-native/archive10_tracks/" + safeName(name) + ".wav");
            writeMonoWav(wav, pcm);
            System.out.printf("%s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
        }
    }

    private static cm archive(Path cache, int archive) {
        return new cm(new CacheArchive(cache, archive), true, 1);
    }

    private static byte[] renderPcm(ic player) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int silentTail = 0;
        int maxSamples = SAMPLE_RATE * MAX_SECONDS;
        int rendered = 0;

        while (rendered < maxSamples) {
            Arrays.fill(mix, 0);
            player.a(mix, 0, mix.length);

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

            rendered += mix.length;
            if (silent) {
                silentTail += mix.length;
            } else {
                silentTail = 0;
            }
            if (!player.d((byte)90) && silentTail >= TAIL_SILENCE_SAMPLES) {
                break;
            }
        }

        byte[] bytes = pcm.toByteArray();
        int trim = Math.min(silentTail, TAIL_SILENCE_SAMPLES) * 2;
        if (trim > 0 && trim < bytes.length) {
            return Arrays.copyOf(bytes, bytes.length - trim);
        }
        return bytes;
    }

    private static String safeName(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]+", "_").replaceAll("^_+|_+$", "");
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

    private static final class CacheArchive extends fa {
        private final Path cache;
        private final int archive;
        private jl index;

        CacheArchive(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        jl b(byte ignored) {
            if (index == null) {
                try {
                    byte[] raw = readCacheGroup(cache, 255, archive);
                    if (raw == null) {
                        return null;
                    }
                    index = new jl(raw, ba.a((byte)-107, raw, raw.length), null);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }
            return index;
        }

        @Override
        int a(boolean ignored, int group) {
            try {
                return readCacheGroup(cache, archive, group) == null ? 0 : 100;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] a(int group, int ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
