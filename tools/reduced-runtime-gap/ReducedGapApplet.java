import java.applet.Applet;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.MemoryImageSource;

/** Cold, fixed-work route. PCM is computed and checked, not played here:
 * first isolate the execution gap before adding a real-time audio producer.
 */
public final class ReducedGapApplet extends Applet implements Runnable {
    public static int done, frames, checksum, phase;
    public static long[] frameNanos = new long[24];
    private ReducedRuntimeGap workload;
    private Graphics graphics;
    private Image image;
    private MemoryImageSource source;
    private boolean calls;
    public void init() {
        calls = !"fused".equals(getParameter("mode"));
        workload = new ReducedRuntimeGap();
        setSize(ReducedRuntimeGap.WIDTH, ReducedRuntimeGap.HEIGHT);
        source = new MemoryImageSource(ReducedRuntimeGap.WIDTH, ReducedRuntimeGap.HEIGHT,
            workload.pixels, 0, ReducedRuntimeGap.WIDTH);
        image = createImage(source); graphics = getGraphics();
    }
    public void start() { new Thread(this, "reduced-gap").start(); }
    public void run() {
        for (int f = 0; f < 24; f++) {
            long start = System.nanoTime();
            workload.step(f, calls);
            source.newPixels(); graphics.drawImage(image, 0, 0, this);
            frameNanos[f] = System.nanoTime() - start;
            frames = f + 1; phase = workload.phase;
            // Permit presentation, not an artificial 24 FPS cap.
            try { Thread.sleep(1); } catch (InterruptedException e) { return; }
        }
        checksum = workload.checksum; done = 1;
    }
}
