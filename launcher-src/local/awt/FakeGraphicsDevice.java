package local.awt;

import local.Trace;

import java.awt.DisplayMode;
import java.awt.GraphicsConfiguration;
import java.awt.GraphicsDevice;

public final class FakeGraphicsDevice extends GraphicsDevice {
    private final GraphicsConfiguration configuration = new FakeGraphicsConfiguration(this);

    @Override
    public int getType() {
        Trace.log("fakeGraphicsDevice.getType");
        return TYPE_RASTER_SCREEN;
    }

    @Override
    public String getIDstring() {
        Trace.log("fakeGraphicsDevice.getIDstring");
        return "fake-screen";
    }

    @Override
    public GraphicsConfiguration[] getConfigurations() {
        Trace.log("fakeGraphicsDevice.getConfigurations");
        return new GraphicsConfiguration[] { configuration };
    }

    @Override
    public GraphicsConfiguration getDefaultConfiguration() {
        Trace.log("fakeGraphicsDevice.getDefaultConfiguration");
        return configuration;
    }

    @Override
    public DisplayMode getDisplayMode() {
        Trace.log("fakeGraphicsDevice.getDisplayMode");
        return new DisplayMode(1024, 768, 32, 60);
    }

    @Override
    public DisplayMode[] getDisplayModes() {
        Trace.log("fakeGraphicsDevice.getDisplayModes");
        return new DisplayMode[] { getDisplayMode() };
    }
}
