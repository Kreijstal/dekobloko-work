/** Synthetic execution-gap reproducer, not an extracted GeoBlox reproducer.
 * Both modes compute exactly the same pixels, PCM, and persistent state.
 * No sleeps, timing-dependent work, or guest warmup in the measured kernel.
 */
public final class ReducedRuntimeGap {
    public static final int WIDTH = 320, HEIGHT = 240, BLOCK = 256;
    public final int[] pixels = new int[WIDTH * HEIGHT];
    public final int[] pcm = new int[BLOCK * 2];
    final Voice[] voices = new Voice[8];
    final Shader shader = new Shader();
    public int phase, checksum;

    static class Voice {
        int position, step, gain;
        Voice(int s, int g) { step = s; gain = g; }
        int shape(int p) { return p < 32768 ? p : 65535 - p; }
        int scale(int s) { return (s * gain) >> 15; }
        int sample() {
            position = (position + step) & 65535;
            return scale(shape(position) - 16384);
        }
    }
    static final class Shader {
        int channel(int x, int y, int frame) {
            int v = (x * 3171 + y * 991 + frame * 1234567);
            return ((v >>> 9) ^ (v >>> 17)) & 255;
        }
        int color(int x, int y, int frame) {
            return channel(x, y, frame) << 16 |
                channel(y, x, frame + 7) << 8 | channel(x + y, y, frame + 13);
        }
        int shade(int old, int x, int y, int frame) {
            return 0xff000000 | ((old & 0xfefefe) >>> 1) +
                ((color(x, y, frame) & 0xfefefe) >>> 1);
        }
    }
    public ReducedRuntimeGap() {
        for (int i = 0; i < voices.length; i++) voices[i] = new Voice(251 + i * 97, 1200 + i * 71);
    }
    public synchronized void mix(boolean calls) {
        for (int i = 0; i < BLOCK; i++) {
            int left = 0, right = 0;
            for (int v = 0; v < voices.length; v++) {
                Voice voice = voices[v];
                int sample;
                if (calls) sample = voice.sample();
                else {
                    voice.position = (voice.position + voice.step) & 65535;
                    int p = voice.position;
                    sample = (((p < 32768 ? p : 65535 - p) - 16384) * voice.gain) >> 15;
                }
                left += sample;
                right += (v & 1) == 0 ? sample : -sample;
            }
            pcm[i * 2] = left; pcm[i * 2 + 1] = right;
        }
    }
    public void raster(int frame, boolean calls) {
        int n = 0;
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++, n++) {
                if (calls) pixels[n] = shader.shade(pixels[n], x, y, frame);
                else {
                    int r = x * 3171 + y * 991 + frame * 1234567;
                    int g = y * 3171 + x * 991 + (frame + 7) * 1234567;
                    int b = (x + y) * 3171 + y * 991 + (frame + 13) * 1234567;
                    int color = (((r >>> 9) ^ (r >>> 17)) & 255) << 16 |
                        (((g >>> 9) ^ (g >>> 17)) & 255) << 8 | (((b >>> 9) ^ (b >>> 17)) & 255);
                    pixels[n] = 0xff000000 | ((pixels[n] & 0xfefefe) >>> 1) + ((color & 0xfefefe) >>> 1);
                }
            }
        }
    }
    public void step(int frame, boolean calls) {
        // Same transition sequence in both arms, including first-use allocation.
        int nextPhase = frame / 8;
        if (nextPhase != phase) {
            phase = nextPhase;
            voices[phase & 7] = new Voice(317 + phase * 31, 1800);
        }
        for (int b = 0; b < 4; b++) {
            mix(calls);
            for (int s : pcm) checksum = checksum * 31 + s;
        }
        raster(frame, calls);
        for (int pixel : pixels) checksum = checksum * 31 + pixel;
    }
    public static void main(String[] args) {
        // Exact per-frame oracle, including every array element and voice state.
        ReducedRuntimeGap split = new ReducedRuntimeGap(), fused = new ReducedRuntimeGap();
        long splitNs = 0, fusedNs = 0;
        for (int f = 0; f < 24; f++) {
            long start = System.nanoTime(); split.step(f, true); splitNs += System.nanoTime() - start;
            start = System.nanoTime(); fused.step(f, false); fusedNs += System.nanoTime() - start;
            if (split.checksum != fused.checksum) throw new AssertionError("checksum " + f);
            for (int i = 0; i < split.pixels.length; i++)
                if (split.pixels[i] != fused.pixels[i]) throw new AssertionError("pixel " + i);
            for (int i = 0; i < split.pcm.length; i++)
                if (split.pcm[i] != fused.pcm[i]) throw new AssertionError("PCM " + i);
            for (int i = 0; i < 8; i++)
                if (split.voices[i].position != fused.voices[i].position) throw new AssertionError("voice " + i);
        }
        System.out.println("exact=true frames=24 checksum=" + split.checksum +
            " splitMs=" + splitNs / 1000000 + " fusedMs=" + fusedNs / 1000000);
    }
}
