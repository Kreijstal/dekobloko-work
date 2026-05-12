import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

public final class MinerDisturbanceAudioDumper {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int CHANNELS = 2;
    private static final int MAX_SECONDS = 420;
    private static final int TAIL_SILENCE_SAMPLES = SAMPLE_RATE * 2;

    private static final String[] MUSIC_TRACKS = {
        "md_title_music",
        "md_game_music",
        "md_volcano_music",
        "md_ice_music",
        "md_ice_panic_music",
        "md_win",
        "md_lose"
    };
    private static final String[] EFFECTS = {
        "md_slugger",
        "md_menu",
        "md_cha-ching",
        "md_sploch",
        "md_scream",
        "md_lava_noise_500ms",
        "md_drowning",
        "md_choking",
        "md_boom",
        "md_clunk",
        "md_jump",
        "md_ching",
        "md_pickup_iron",
        "md_pickup_silver",
        "md_pickup_gold",
        "md_pickup_xenon",
        "md_pickup_diamond",
        "md_beep",
        "md_hiss",
        "md_splurdoosh",
        "md_whoopf",
        "md_crumble",
        "md_thudathuda",
        "md_chink",
        "md_dull_chink",
        "md_splash",
        "md_splash_2",
        "md_splash_3",
        "md_splash_4",
        "md_splash_5",
        "md_splosh",
        "md_step_150ms",
        "md_twump",
        "md_ice_boom",
        "md_ice_dull_chink",
        "md_ice_jetpack_200ms_loop",
        "md_ice_jetpack_broken_200ms_loop",
        "md_ice_penguin_squawk",
        "md_ice_penguin_squawk_2",
        "md_ice_penguin_squawk_3",
        "md_ice_penguin_squawk_4",
        "md_ice_player_land_on_snow",
        "md_ice_sliding_200ms_loop",
        "md_ice_teeth_chatter_400ms_loop",
        "md_ice_walrus_growl",
        "md_ice_walrus_grunt",
        "md_ice_oil_burning",
        "md_lava_rising_bgsound",
        "md_ice_mining_ice",
        "md_ice_mining_ice_2",
        "md_ice_mining_ice_3",
        "md_ice_mining_snow",
        "md_ice_mining_snow_2",
        "md_ice_mining_snow_3",
        "md_ice_mining_rock",
        "md_ice_mining_rock_2",
        "md_ice_mining_rock_3",
        "md_ice_player_glooping_in_oil",
        "md_ice_player_glooping_in_oil_2",
        "md_ice_player_glooping_in_oil_3",
        "md_ice_player_glooping_in_oil_4",
        "md_ice_pickup_freezium"
    };

    public static void main(String[] args) throws Exception {
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/games/minerdisturbance/music");
        Path cache = args.length > 1
            ? Path.of(args[1])
            : Path.of(".work/games/minerdisturbance/js5-cache");
        Files.createDirectories(outRoot.resolve("midi"));
        Files.createDirectories(outRoot.resolve("wav"));
        Files.createDirectories(outRoot.resolve("samples/effects"));

        fj.a(SAMPLE_RATE, true, 10);

        bj sampleA = archive(cache, 2);
        bj sampleB = archive(cache, 3);
        bj songs = archive(cache, 4);
        bj patches = archive(cache, 5);
        ri samples = new ri(sampleA, sampleB);

        Constructor<wh> trackCtor = wh.class.getDeclaredConstructor(sb.class);
        trackCtor.setAccessible(true);
        for (String name : MUSIC_TRACKS) {
            byte[] raw = songs.a(name, 0, "");
            if (raw == null) {
                throw new IllegalStateException("missing music file " + name);
            }
            wh track = trackCtor.newInstance(new sb(raw));
            Files.write(outRoot.resolve("midi/" + name + ".mid"), repairMidi(track.o));

            di player = new di();
            player.a(128, -6242, 9);
            if (!player.a(false, track, samples, 0, patches)) {
                throw new IllegalStateException("failed to hydrate " + name);
            }
            track.b();
            player.a(false, track, (byte)2);
            byte[] pcm = renderMusic(player);
            Path wav = outRoot.resolve("wav/" + name + ".wav");
            writePcm16Wav(wav, pcm, CHANNELS);
            System.out.printf("music %s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * CHANNELS * 2));
        }

        bj effects = archive(cache, 2);
        for (String name : EFFECTS) {
            jd effect = jd.a(effects, "", name);
            if (effect == null) {
                System.out.printf("missing effect %s%n", name);
                continue;
            }
            ji sample = effect.a();
            Path wav = outRoot.resolve("samples/effects/" + name + ".wav");
            writeEffectWav(wav, sample);
            System.out.printf("effect %s %.3fs%n", wav.getFileName(), sample.r.length / (double)sample.s);
        }
    }

    private static bj archive(Path cache, int archive) {
        return new bj(new CacheBackend(cache, archive), true, 1);
    }

    private static byte[] renderMusic(di player) throws IOException {
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
            if (!player.b((byte)-114) && silentTail >= TAIL_SILENCE_SAMPLES) {
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
            int size = ((midi[pos + 4] & 255) << 24)
                | ((midi[pos + 5] & 255) << 16)
                | ((midi[pos + 6] & 255) << 8)
                | (midi[pos + 7] & 255);
            int dataStart = pos + 8;
            int dataEnd = dataStart + size;
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
            writeRaw32(fixed, track.length);
            fixed.write(track);
            pos = dataEnd;
        }
        return fixed.toByteArray();
    }

    private static void writeRaw32(ByteArrayOutputStream out, int value) {
        out.write((value >>> 24) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write(value & 0xff);
    }

    private static void writeEffectWav(Path out, ji sample) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(sample.r.length * 2);
        for (byte value : sample.r) {
            int s = value << 8;
            pcm.write(s & 0xff);
            pcm.write((s >>> 8) & 0xff);
        }
        writePcm16Wav(out, pcm.toByteArray(), 1);
    }

    private static void writePcm16Wav(Path out, byte[] pcm, int channels) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, channels);
            writeLe32(data, SAMPLE_RATE);
            writeLe32(data, SAMPLE_RATE * channels * 2);
            writeLe16(data, channels * 2);
            writeLe16(data, 16);
            data.writeBytes("data");
            writeLe32(data, pcm.length);
            data.write(pcm);
        }
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

    private static final class CacheBackend extends vb {
        private final Path cache;
        private final int archive;
        private g index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        g a(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                try {
                    index = new g(raw, gn.a(raw.length, raw, true), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new g(stripped, gn.a(stripped.length, stripped, true), null);
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
        int a(byte ignored, int group) {
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
            int gotGroup = ((dat[sectorOffset] & 0xff) << 8) | (dat[sectorOffset + 1] & 0xff);
            int gotChunk = ((dat[sectorOffset + 2] & 0xff) << 8) | (dat[sectorOffset + 3] & 0xff);
            int next = ((dat[sectorOffset + 4] & 0xff) << 16) | ((dat[sectorOffset + 5] & 0xff) << 8) | (dat[sectorOffset + 6] & 0xff);
            int gotIndex = dat[sectorOffset + 7] & 0xff;
            if (gotGroup != group || gotChunk != chunk || gotIndex != index) {
                throw new IOException("bad sector header");
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
