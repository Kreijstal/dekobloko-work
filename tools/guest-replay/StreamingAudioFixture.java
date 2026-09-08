// Diagnostic workload, never a runtime intrinsic or a replacement game mixer.
public class StreamingAudioFixture {
    public static class Voice {
        int phase;
        int step;
        int gain;
        Voice(int step, int gain) { this.step = step; this.gain = gain; }
        int sample() {
            phase = (phase + step) & 65535;
            int triangle = phase < 32768 ? phase : 65535 - phase;
            return ((triangle - 16384) * gain) >> 15;
        }
    }
    public static class QuietVoice extends Voice {
        QuietVoice(int step, int gain) { super(step, gain); }
        int sample() { return super.sample() >> 1; }
    }
    Voice[] voices;
    int block;
    int cursor;
    public synchronized void mix(int[] pcm) {
        if (voices == null) voices = new Voice[8];
        if ((block & 3) == 0) {
            int index = (block >> 2) & 7;
            voices[index] = (block & 4) == 0
                ? new Voice(251 + block * 7, 1600 + block * 13)
                : new QuietVoice(191 + block * 11, 2300);
        }
        if ((block & 15) == 15) voices[(block >> 1) & 7] = null;
        for (int frame = 0; frame < 256; frame++) {
            int left = 0, right = 0;
            for (int voice = 0; voice < voices.length; voice++) {
                Voice active = voices[voice];
                if (active != null) {
                    int sample = active.sample();
                    left += sample;
                    right += (voice & 1) == 0 ? sample : -sample;
                }
            }
            pcm[cursor++] = left;
            pcm[cursor++] = right;
        }
        block++;
    }
    public static void main(String[] args) {
        StreamingAudioFixture mixer = new StreamingAudioFixture();
        int[] pcm = new int[64 * 256 * 2];
        for (int block = 0; block < 64; block++) mixer.mix(pcm);
        for (int sample : pcm) System.out.println(sample);
    }
}
