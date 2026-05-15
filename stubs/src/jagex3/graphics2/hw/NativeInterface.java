package jagex3.graphics2.hw;

public class NativeInterface {
    public NativeInterface() {}
    public NativeInterface(int textures, int flags) {}
    public void initTextureMetrics(int index, byte width, byte height) {}
    public void release() {}
    public void setAmbient(float value) {}
    public void setSunColour(float a, float r, float g, float b, float intensity) {}
    public void setSunDirection(float x, float y, float z) {}
}
