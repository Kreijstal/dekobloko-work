package local.awt;

import local.Trace;

import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.GraphicsDevice;
import java.awt.GraphicsEnvironment;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.util.Locale;

public class FakeGraphicsEnvironment extends GraphicsEnvironment {
    private final GraphicsDevice device = new FakeGraphicsDevice();

    public FakeGraphicsEnvironment() {
        Trace.log("fakeGraphicsEnvironment.<init>");
    }

    @Override
    public GraphicsDevice[] getScreenDevices() {
        Trace.log("fakeGraphicsEnvironment.getScreenDevices");
        return new GraphicsDevice[] { device };
    }

    @Override
    public GraphicsDevice getDefaultScreenDevice() {
        Trace.log("fakeGraphicsEnvironment.getDefaultScreenDevice");
        return device;
    }

    @Override
    public Graphics2D createGraphics(BufferedImage image) {
        Trace.log("fakeGraphicsEnvironment.createGraphics " + image.getWidth() + "x" + image.getHeight());
        return null;
    }

    @Override
    public Font[] getAllFonts() {
        Trace.log("fakeGraphicsEnvironment.getAllFonts");
        return new Font[] { new Font("Dialog", Font.PLAIN, 12) };
    }

    @Override
    public String[] getAvailableFontFamilyNames() {
        Trace.log("fakeGraphicsEnvironment.getAvailableFontFamilyNames");
        return new String[] { "Dialog", "SansSerif", "Serif", "Monospaced" };
    }

    @Override
    public String[] getAvailableFontFamilyNames(Locale locale) {
        Trace.log("fakeGraphicsEnvironment.getAvailableFontFamilyNames locale=" + locale);
        return getAvailableFontFamilyNames();
    }

    @Override
    public boolean isHeadlessInstance() {
        Trace.log("fakeGraphicsEnvironment.isHeadlessInstance");
        return false;
    }

    @Override
    public Rectangle getMaximumWindowBounds() {
        Trace.log("fakeGraphicsEnvironment.getMaximumWindowBounds");
        return new Rectangle(0, 0, 1024, 768);
    }
}
