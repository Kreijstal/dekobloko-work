package local.awt;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.Rectangle;
import java.awt.Shape;
import java.awt.image.BufferedImage;
import java.awt.image.DataBuffer;
import java.awt.image.DataBufferInt;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.text.AttributedCharacterIterator;

/** Measures completed software frames at the fake-AWT drawImage boundary. */
public final class FrameProfiler {
    private static final boolean ENABLED = Boolean.getBoolean("dekobloko.profile.frames");
    private static final String OUTPUT = System.getProperty("dekobloko.profile.output", "frame-profile.csv");
    private static final Object LOCK = new Object();
    private static PrintWriter writer;
    private static long firstNanos;
    private static long lastNanos;
    private static long lastHash;
    private static boolean haveHash;
    private static int presents;
    private static int changes;
    private static Field rasterProviderField;
    private static Field pixelsField;
    private static ProfilingGraphics activeGraphics;

    static {
        if (ENABLED) {
            try {
                File output = new File(OUTPUT);
                File parent = output.getParentFile();
                if (parent != null) parent.mkdirs();
                writer = new PrintWriter(new BufferedWriter(new FileWriter(output)));
                writer.println("present,time_ms,changed,hash,width,height,nonblack_samples,commands");
                Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
                    @Override
                    public void run() {
                        finish();
                    }
                }, "frame-profiler-shutdown"));
                System.out.println("FRAME_PROFILE enabled output=" + output.getAbsolutePath());
            } catch (IOException ex) {
                throw new ExceptionInInitializerError(ex);
            }
        }
    }

    private FrameProfiler() {
    }

    public static void registerGameClassLoader(ClassLoader loader) {
        if (!ENABLED) return;
        try {
            Class<?> providerOwner = Class.forName("le", false, loader);
            rasterProviderField = providerOwner.getDeclaredField("m");
            rasterProviderField.setAccessible(true);
            Class<?> providerType = Class.forName("eh", false, loader);
            pixelsField = providerType.getDeclaredField("f");
            pixelsField.setAccessible(true);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("Could not locate game raster provider", ex);
        }
    }

    static Graphics wrap(Graphics delegate) {
        return ENABLED ? new ProfilingGraphics(delegate) : delegate;
    }

    static synchronized Graphics beginGameFrame() {
        if (activeGraphics != null) activeGraphics.finish();
        activeGraphics = new ProfilingGraphics(null);
        return activeGraphics;
    }

    private static void present(Image image) {
        present(image, 0L, 0);
    }

    private static void present(Image image, long commandHash, int commandCount) {
        if (!ENABLED) return;
        int[] pixels = reflectedPixels();
        int width = 0;
        int height = 0;
        if (image instanceof BufferedImage) {
            BufferedImage buffered = (BufferedImage) image;
            width = buffered.getWidth();
            height = buffered.getHeight();
            if (pixels == null) {
                DataBuffer data = buffered.getRaster().getDataBuffer();
                if (data instanceof DataBufferInt) pixels = ((DataBufferInt) data).getData();
            }
        }
        if (pixels == null && commandCount == 0) return;

        // Sampling every fourth pixel keeps profiler cost small while still
        // detecting sub-pixel movement throughout the 640x480 logo buffer.
        long hash = 0xcbf29ce484222325L;
        int nonBlack = 0;
        if (pixels != null) {
            for (int i = 0; i < pixels.length; i += 4) {
                int pixel = pixels[i];
                hash ^= pixel;
                hash *= 0x100000001b3L;
                if ((pixel & 0x00ffffff) != 0) ++nonBlack;
            }
        }
        hash ^= commandHash;
        hash *= 0x100000001b3L;

        synchronized (LOCK) {
            long now = System.nanoTime();
            if (firstNanos == 0L) firstNanos = now;
            lastNanos = now;
            ++presents;
            boolean changed = !haveHash || hash != lastHash;
            if (changed) ++changes;
            haveHash = true;
            lastHash = hash;
            writer.printf("%d,%.3f,%s,%016x,%d,%d,%d,%d%n",
                    presents, (now - firstNanos) / 1000000.0, changed,
                    hash, width, height, nonBlack, commandCount);
        }
    }

    private static int[] reflectedPixels() {
        if (rasterProviderField == null || pixelsField == null) return null;
        try {
            Object provider = rasterProviderField.get(null);
            return provider == null ? null : (int[]) pixelsField.get(provider);
        } catch (IllegalAccessException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static void finish() {
        if (!ENABLED) return;
        synchronized (FrameProfiler.class) {
            if (activeGraphics != null) {
                activeGraphics.finish();
                activeGraphics = null;
            }
        }
        synchronized (LOCK) {
            if (writer == null) return;
            writer.flush();
            writer.close();
            writer = null;
            double seconds = firstNanos == 0L ? 0.0 : (lastNanos - firstNanos) / 1000000000.0;
            double presentFps = seconds == 0.0 ? 0.0 : (presents - 1) / seconds;
            double changedFps = seconds == 0.0 ? 0.0 : (changes - 1) / seconds;
            System.out.printf("FRAME_PROFILE result presents=%d changes=%d seconds=%.3f present_fps=%.2f changed_fps=%.2f%n",
                    presents, changes, seconds, presentFps, changedFps);
        }
    }

    private static final class ProfilingGraphics extends Graphics {
        private final Graphics delegate;
        private Color color = Color.black;
        private Font font = new Font("Dialog", Font.PLAIN, 12);
        private long commandHash = 0xcbf29ce484222325L;
        private int commandCount;
        private boolean finished;

        private ProfilingGraphics(Graphics delegate) {
            this.delegate = delegate;
        }

        private void mix(int value) {
            commandHash ^= value;
            commandHash *= 0x100000001b3L;
        }

        private void command(int opcode, int... values) {
            ++commandCount;
            mix(opcode);
            mix(color == null ? 0 : color.getRGB());
            for (int value : values) mix(value);
        }

        private int imageId(Image image) {
            if (image == null) return 0;
            int value = System.identityHashCode(image);
            value = 31 * value + image.getWidth(null);
            value = 31 * value + image.getHeight(null);
            return value;
        }

        private void finish() {
            if (finished) return;
            finished = true;
            present(null, commandHash, commandCount);
        }

        @Override public Graphics create() { return new ProfilingGraphics(delegate == null ? null : delegate.create()); }
        @Override public Graphics create(int x, int y, int width, int height) { return new ProfilingGraphics(delegate == null ? null : delegate.create(x, y, width, height)); }
        @Override public void translate(int x, int y) { command(1, x, y); if (delegate != null) delegate.translate(x, y); }
        @Override public Color getColor() { return delegate == null ? color : delegate.getColor(); }
        @Override public void setColor(Color value) { color = value; command(2, value == null ? 0 : value.getRGB()); if (delegate != null) delegate.setColor(value); }
        @Override public void setPaintMode() { command(3); if (delegate != null) delegate.setPaintMode(); }
        @Override public void setXORMode(Color value) { command(4, value == null ? 0 : value.getRGB()); if (delegate != null) delegate.setXORMode(value); }
        @Override public Font getFont() { return delegate == null ? font : delegate.getFont(); }
        @Override public void setFont(Font value) { font = value; command(5, value == null ? 0 : value.hashCode()); if (delegate != null) delegate.setFont(value); }
        @Override public FontMetrics getFontMetrics(Font value) { return delegate == null ? new FontMetrics(value == null ? font : value) { } : delegate.getFontMetrics(value); }
        @Override public Rectangle getClipBounds() { return delegate == null ? null : delegate.getClipBounds(); }
        @Override public void clipRect(int x, int y, int width, int height) { command(6, x, y, width, height); if (delegate != null) delegate.clipRect(x, y, width, height); }
        @Override public void setClip(int x, int y, int width, int height) { command(7, x, y, width, height); if (delegate != null) delegate.setClip(x, y, width, height); }
        @Override public Shape getClip() { return delegate == null ? null : delegate.getClip(); }
        @Override public void setClip(Shape clip) { command(8, clip == null ? 0 : clip.hashCode()); if (delegate != null) delegate.setClip(clip); }
        @Override public void copyArea(int x, int y, int width, int height, int dx, int dy) { command(9, x, y, width, height, dx, dy); if (delegate != null) delegate.copyArea(x, y, width, height, dx, dy); }
        @Override public void drawLine(int x1, int y1, int x2, int y2) { command(10, x1, y1, x2, y2); if (delegate != null) delegate.drawLine(x1, y1, x2, y2); }
        @Override public void fillRect(int x, int y, int width, int height) { command(11, x, y, width, height); if (delegate != null) delegate.fillRect(x, y, width, height); }
        @Override public void clearRect(int x, int y, int width, int height) { command(12, x, y, width, height); if (delegate != null) delegate.clearRect(x, y, width, height); }
        @Override public void drawRoundRect(int x, int y, int width, int height, int arcWidth, int arcHeight) { command(13, x, y, width, height, arcWidth, arcHeight); if (delegate != null) delegate.drawRoundRect(x, y, width, height, arcWidth, arcHeight); }
        @Override public void fillRoundRect(int x, int y, int width, int height, int arcWidth, int arcHeight) { command(14, x, y, width, height, arcWidth, arcHeight); if (delegate != null) delegate.fillRoundRect(x, y, width, height, arcWidth, arcHeight); }
        @Override public void drawOval(int x, int y, int width, int height) { command(15, x, y, width, height); if (delegate != null) delegate.drawOval(x, y, width, height); }
        @Override public void fillOval(int x, int y, int width, int height) { command(16, x, y, width, height); if (delegate != null) delegate.fillOval(x, y, width, height); }
        @Override public void drawArc(int x, int y, int width, int height, int startAngle, int arcAngle) { command(17, x, y, width, height, startAngle, arcAngle); if (delegate != null) delegate.drawArc(x, y, width, height, startAngle, arcAngle); }
        @Override public void fillArc(int x, int y, int width, int height, int startAngle, int arcAngle) { command(18, x, y, width, height, startAngle, arcAngle); if (delegate != null) delegate.fillArc(x, y, width, height, startAngle, arcAngle); }
        @Override public void drawPolyline(int[] xPoints, int[] yPoints, int nPoints) { command(19, nPoints); if (delegate != null) delegate.drawPolyline(xPoints, yPoints, nPoints); }
        @Override public void drawPolygon(int[] xPoints, int[] yPoints, int nPoints) { command(20, nPoints); if (delegate != null) delegate.drawPolygon(xPoints, yPoints, nPoints); }
        @Override public void fillPolygon(int[] xPoints, int[] yPoints, int nPoints) { command(21, nPoints); if (delegate != null) delegate.fillPolygon(xPoints, yPoints, nPoints); }
        @Override public void drawString(String text, int x, int y) { command(22, text == null ? 0 : text.hashCode(), x, y, font == null ? 0 : font.hashCode()); if (delegate != null) delegate.drawString(text, x, y); }
        @Override public void drawString(AttributedCharacterIterator text, int x, int y) { command(23, text == null ? 0 : text.toString().hashCode(), x, y); if (delegate != null) delegate.drawString(text, x, y); }
        @Override public boolean drawImage(Image image, int x, int y, java.awt.image.ImageObserver observer) { command(24, imageId(image), x, y); return delegate == null || delegate.drawImage(image, x, y, observer); }
        @Override public boolean drawImage(Image image, int x, int y, int width, int height, java.awt.image.ImageObserver observer) { command(25, imageId(image), x, y, width, height); return delegate == null || delegate.drawImage(image, x, y, width, height, observer); }
        @Override public boolean drawImage(Image image, int x, int y, Color background, java.awt.image.ImageObserver observer) { command(26, imageId(image), x, y, background == null ? 0 : background.getRGB()); return delegate == null || delegate.drawImage(image, x, y, background, observer); }
        @Override public boolean drawImage(Image image, int x, int y, int width, int height, Color background, java.awt.image.ImageObserver observer) { command(27, imageId(image), x, y, width, height, background == null ? 0 : background.getRGB()); return delegate == null || delegate.drawImage(image, x, y, width, height, background, observer); }
        @Override public boolean drawImage(Image image, int dx1, int dy1, int dx2, int dy2, int sx1, int sy1, int sx2, int sy2, java.awt.image.ImageObserver observer) { command(28, imageId(image), dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2); return delegate == null || delegate.drawImage(image, dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2, observer); }
        @Override public boolean drawImage(Image image, int dx1, int dy1, int dx2, int dy2, int sx1, int sy1, int sx2, int sy2, Color background, java.awt.image.ImageObserver observer) { command(29, imageId(image), dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2, background == null ? 0 : background.getRGB()); return delegate == null || delegate.drawImage(image, dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2, background, observer); }
        @Override public void dispose() { finish(); if (delegate != null) delegate.dispose(); }
    }
}
