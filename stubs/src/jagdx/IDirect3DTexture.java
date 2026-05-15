package jagdx;

public class IDirect3DTexture extends IDirect3DBaseTexture {
    public int LockRect(int level, int x, int y, int w, int h, int flags, PixelBuffer buffer) { return 0; }
    public int UnlockRect(int level) { return 0; }
}
