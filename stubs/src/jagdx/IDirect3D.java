package jagdx;

import java.awt.Canvas;
import jaclib.peer.tqb;

public class IDirect3D {
    public static IDirect3D a(int flags, tqb peer) { return new IDirect3D(); }
    public int a(int adapter, D3DDISPLAYMODE mode) { return 0; }
    public D3DCAPS a(int adapter, int type) { return new D3DCAPS(); }
    public IDirect3DDevice a(int adapter, int type, Canvas canvas, int flags, D3DPRESENT_PARAMETERS params) { return new IDirect3DDevice(); }
    public int CheckDeviceType(int a, int b, int c, int d, boolean e) { return 0; }
    public int CheckDeviceFormat(int a, int b, int c, int d, int e, int f) { return 0; }
    public int CheckDeviceMultiSampleType(int a, int b, int c, boolean d, int e) { return 0; }
    public int CheckDepthStencilMatch(int a, int b, int c, int d, int e) { return 0; }
}
