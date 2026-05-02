package local.awt;

import local.Trace;

import java.awt.GraphicsConfiguration;
import java.awt.GraphicsDevice;
import java.awt.Rectangle;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.awt.image.ColorModel;

public final class FakeGraphicsConfiguration extends GraphicsConfiguration {
    private final GraphicsDevice device;

    public FakeGraphicsConfiguration(GraphicsDevice device) {
        this.device = device;
    }

    @Override
    public GraphicsDevice getDevice() {
        Trace.log("fakeGraphicsConfiguration.getDevice");
        return device;
    }

    @Override
    public BufferedImage createCompatibleImage(int width, int height) {
        Trace.log("fakeGraphicsConfiguration.createCompatibleImage " + width + "x" + height);
        return new BufferedImage(Math.max(1, width), Math.max(1, height), BufferedImage.TYPE_INT_ARGB);
    }

    @Override
    public BufferedImage createCompatibleImage(int width, int height, int transparency) {
        Trace.log("fakeGraphicsConfiguration.createCompatibleImage " + width + "x" + height + " transparency=" + transparency);
        return createCompatibleImage(width, height);
    }

    @Override
    public ColorModel getColorModel() {
        Trace.log("fakeGraphicsConfiguration.getColorModel");
        return ColorModel.getRGBdefault();
    }

    @Override
    public ColorModel getColorModel(int transparency) {
        Trace.log("fakeGraphicsConfiguration.getColorModel transparency=" + transparency);
        return ColorModel.getRGBdefault();
    }

    @Override
    public AffineTransform getDefaultTransform() {
        Trace.log("fakeGraphicsConfiguration.getDefaultTransform");
        return new AffineTransform();
    }

    @Override
    public AffineTransform getNormalizingTransform() {
        Trace.log("fakeGraphicsConfiguration.getNormalizingTransform");
        return new AffineTransform();
    }

    @Override
    public Rectangle getBounds() {
        Trace.log("fakeGraphicsConfiguration.getBounds");
        return new Rectangle(0, 0, 1024, 768);
    }
}
