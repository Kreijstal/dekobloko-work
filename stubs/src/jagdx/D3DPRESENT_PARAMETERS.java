package jagdx;

import java.awt.Canvas;

public class D3DPRESENT_PARAMETERS {
    public int MultiSampleQuality;
    public int BackBufferFormat;
    public int MultiSampleType;
    public int AutoDepthStencilFormat;
    public int PresentationInterval;
    public boolean EnableAutoDepthStencil;
    public boolean Windowed;
    public int BackBufferWidth;
    public int BackBufferHeight;

    public D3DPRESENT_PARAMETERS(Canvas canvas) {}
}
