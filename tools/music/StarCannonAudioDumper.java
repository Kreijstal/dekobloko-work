import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

public final class StarCannonAudioDumper {
    private static final String[] EFFECTS = {
        "SC_bossdamage",
        "SC_bossdestroy",
        "SC_collect1",
        "SC_enemydamage2",
        "SC_enemydamage3",
        "SC_enemydestroy3",
        "SC_enemydestroy4",
        "SC_enemyfire1",
        "SC_enemyfire2",
        "SC_enemyfire3",
        "SC_enemyfire4",
        "SC_playerdestroy",
        "SC_backcannon",
        "SC_FOLLOWERFIRE",
        "SC_playerfire1",
        "SC_playerfire2",
        "SC_helix_1",
        "SC_helix_2",
        "SC_helix_3",
        "SC_lance_1",
        "SC_lance_2",
        "SC_lance_3",
        "SC_rewind_activated_part1",
        "SC_rewind_installed",
        "SC_seekermine_explode",
        "SC_shield_discharged",
        "SC_shield_rearm",
        "SC_shieldburst",
        "SC_thruster_upgrade",
        "SC_rearcannon_upgrade",
        "SC_shield_upgraded",
        "SC_sidecannons_upgrade",
        "SC_xenon_operational",
        "SC_xenonbeamshot"
    };

    private static final int[] EFFECT_FILE_IDS = {
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33
    };

    private static final String[] VOICES = {
        "SC_systems malfunction",
        "SC_VOC_54321",
        "SC_VOC_back cannons upgraded",
        "SC_VOC_hostile mothership approaching",
        "SC_VOC_powerup collected",
        "SC_VOC_returning to normal space",
        "SC_VOC_rewind module activated",
        "SC_VOC_rewind module installed",
        "SC_VOC_shield discharged",
        "SC_VOC_shield rearmed",
        "SC_VOC_shields upgraded",
        "SC_VOC_side cannons upgraded",
        "SC_VOC_thrusters upgraded",
        "SC_VOC_zenon beam operational"
    };

    private static final int[] VOICE_FILE_IDS = {
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13
    };

    public static void main(String[] args) throws Exception {
        Path outRoot = Path.of(args.length > 0 ? args[0] : ".work/games/starcannon/music");
        Path cache = args.length > 1
            ? Path.of(args[1])
            : Path.of(".work/games/starcannon/js5-cache");
        Files.createDirectories(outRoot.resolve("samples/effects"));
        Files.createDirectories(outRoot.resolve("samples/voices"));

        ue effects = archive(cache, 2);
        ue voices = archive(cache, 2);

        for (int i = 0; i < EFFECTS.length; i++) {
            String name = EFFECTS[i];
            aj effect = aj.a(effects, 0, EFFECT_FILE_IDS[i]);
            if (effect == null) {
                System.out.printf("missing effect %s%n", name);
                continue;
            }
            ud sample = effect.a();
            Path wav = outRoot.resolve("samples/effects/" + safeName(name) + ".wav");
            writeSampleWav(wav, sample);
            System.out.printf("effect %s %.3fs%n", wav.getFileName(), sample.i.length / (double)sample.j);
        }

        for (int i = 0; i < VOICES.length; i++) {
            String name = VOICES[i];
            nj voice;
            try {
                voice = nj.a(voices, 0, VOICE_FILE_IDS[i]);
            } catch (Throwable ex) {
                System.out.printf("skipping voice %s (%s)%n", name, ex.getClass().getSimpleName());
                nj.a();
                continue;
            }
            if (voice == null) {
                System.out.printf("missing voice %s%n", name);
                continue;
            }
            ud sample = voice.c();
            Path wav = outRoot.resolve("samples/voices/" + safeName(name) + ".wav");
            writeSampleWav(wav, sample);
            System.out.printf("voice %s %.3fs%n", wav.getFileName(), sample.i.length / (double)sample.j);
        }
    }

    private static ue archive(Path cache, int archive) {
        return new ue(new CacheBackend(cache, archive), true, 1);
    }

    private static void writeSampleWav(Path out, ud sample) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream(sample.i.length * 2);
        for (byte value : sample.i) {
            int s = value << 8;
            pcm.write(s & 0xff);
            pcm.write((s >>> 8) & 0xff);
        }
        writePcm16Wav(out, pcm.toByteArray(), sample.j);
    }

    private static void writePcm16Wav(Path out, byte[] pcm, int sampleRate) throws IOException {
        try (DataOutputStream data = new DataOutputStream(Files.newOutputStream(out))) {
            data.writeBytes("RIFF");
            writeLe32(data, 36 + pcm.length);
            data.writeBytes("WAVEfmt ");
            writeLe32(data, 16);
            writeLe16(data, 1);
            writeLe16(data, 1);
            writeLe32(data, sampleRate);
            writeLe32(data, sampleRate * 2);
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

    static final class CacheBackend extends ti {
        private final Path cache;
        private final int archive;
        private ak index;

        CacheBackend(Path cache, int archive) {
            this.cache = cache;
            this.archive = archive;
        }

        @Override
        ak b(byte ignored) {
            if (index != null) {
                return index;
            }
            try {
                byte[] raw = readCacheGroup(cache, 255, archive);
                if (raw == null) {
                    return null;
                }
                try {
                    index = new ak(raw, mg.a(raw.length, raw, (byte)-67), null);
                } catch (RuntimeException ex) {
                    byte[] stripped = Arrays.copyOf(raw, raw.length - 2);
                    index = new ak(stripped, mg.a(stripped.length, stripped, (byte)-67), null);
                }
                return index;
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        byte[] b(int group, boolean ignored) {
            try {
                return readCacheGroup(cache, archive, group);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        @Override
        int a(int group, boolean ignored) {
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
