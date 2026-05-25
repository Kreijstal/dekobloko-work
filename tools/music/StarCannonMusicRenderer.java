import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

public final class StarCannonMusicRenderer {
    private static final int SAMPLE_RATE = 22050;
    private static final int BUFFER_SAMPLES = 1024;
    private static final int MAX_RENDER_SECONDS = 300;

    private static final String[] TRACKS = {
        "music/star cannon level 1 final",
        "music/star cannon level 2 final",
        "music/star cannon boss final",
    };

    public static void main(String[] args) throws Exception {
        Path gameRoot = Path.of(args.length > 0 ? args[0] : ".work/games/starcannon");
        Path outRoot = args.length > 1 ? Path.of(args[1]) : gameRoot.resolve("music");
        Path cache = args.length > 2 ? Path.of(args[2]) : gameRoot.resolve("download-complete/starcannon");
        Files.createDirectories(outRoot.resolve("wav"));

        df.a(SAMPLE_RATE, false, 10);
        ue effectsArchive = archive(cache, 1);
        ue voicesArchive = archive(cache, 2);
        ue musicArchive = archive(cache, 3);
        ja samples = new ja(effectsArchive, voicesArchive);

        for (int i = 0; i < TRACKS.length; i++) {
            String name = TRACKS[i];
            lh song = dl.a(samples, (byte)84, name, "", musicArchive);
            if (song == null) {
                song = qd.a(0, i, samples, (byte)108, musicArchive);
            }
            if (song == null) {
                System.out.printf("missing %s%n", name);
                continue;
            }

            vi mixer = new vi();
            wd player = new wd(song);
            player.a(128);
            mixer.b(player);

            byte[] pcm = render(mixer);
            Path wav = outRoot.resolve("wav/" + safeName(name) + ".wav");
            writePcm16Wav(wav, pcm);
            System.out.printf("music %s %.3fs%n", wav.getFileName(), pcm.length / (double)(SAMPLE_RATE * 2));
        }
    }

    private static ue archive(Path cache, int archive) {
        return new ue(new StarCannonAudioDumper.CacheBackend(cache, archive), true, 1);
    }

    private static byte[] render(vi mixer) throws IOException {
        ByteArrayOutputStream pcm = new ByteArrayOutputStream();
        int[] mix = new int[BUFFER_SAMPLES];
        int rendered = 0;
        int maxSamples = SAMPLE_RATE * MAX_RENDER_SECONDS;
        while (rendered < maxSamples) {
            Arrays.fill(mix, 0);
            mixer.a(mix, 0, BUFFER_SAMPLES);
            for (int sample : mix) {
                writePcm16(pcm, sample >> 8);
            }
            rendered += BUFFER_SAMPLES;
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
}
