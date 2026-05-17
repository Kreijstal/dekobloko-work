package jagdx;

public class IDirect3DDevice {
    public int BeginScene() { return 0; }
    public int Clear(int flags, int color, float z, int stencil) { return 0; }
    public int DrawIndexedPrimitive(int type, int baseVertexIndex, int minVertexIndex, int numVertices, int startIndex, int primitiveCount) { return 0; }
    public int DrawPrimitive(int type, int startVertex, int primitiveCount) { return 0; }
    public int EndScene() { return 0; }
    public int Reset(D3DPRESENT_PARAMETERS params) { return 0; }
    public int SetIndices(IDirect3DIndexBuffer indexBuffer) { return 0; }
    public int SetRenderState(int state, int value) { return 0; }
    public int SetSamplerState(int sampler, int type, int value) { return 0; }
    public int SetScissorRect(int x, int y, int width, int height) { return 0; }
    public int SetStreamSource(int stream, IDirect3DVertexBuffer buffer, int offset, int stride) { return 0; }
    public int SetTexture(int stage, IDirect3DBaseTexture texture) { return 0; }
    public int SetTextureStageState(int stage, int type, int value) { return 0; }
    public int SetTransform(int state, float[] matrix) { return 0; }
    public int SetVertexDeclaration(IDirect3DVertexDeclaration declaration) { return 0; }
    public int SetViewport(int x, int y, int width, int height, float minZ, float maxZ) { return 0; }
    public int TestCooperativeLevel() { return 0; }
    public IDirect3DSurface a(int index) { return new IDirect3DSurface(); }
    public IDirect3DSurface a(int width, int height, int format, int usage, int pool, boolean lockable) { return new IDirect3DSurface(); }
    public IDirect3DCubeTexture a(int edgeLength, int levels, int usage, int format, int pool) { return new IDirect3DCubeTexture(); }
    public IDirect3DTexture a(int width, int height, int levels, int usage, int format, int pool) { return new IDirect3DTexture(); }
    public IDirect3DVertexDeclaration a(VertexElementCollection elements, Object unused) { return new IDirect3DVertexDeclaration(); }
    public IDirect3DSurface b() { return new IDirect3DSurface(); }
    public IDirect3DSwapChain b(int index) { return new IDirect3DSwapChain(); }
    public int StretchRect(IDirect3DSurface src, int sx, int sy, int sw, int sh, IDirect3DSurface dst, int dx, int dy, int dw, int dh, int filter) { return 0; }
    public int LightEnable(int index, boolean enable) { return 0; }
    public int SetLight(int index, D3DLIGHT light) { return 0; }
    public int SetPixelShader(IDirect3DPixelShader shader) { return 0; }
    public int SetVertexShader(IDirect3DVertexShader shader) { return 0; }
    public int SetVertexShaderConstantF(int register, float[] values, int count) { return 0; }
    public IDirect3DPixelShader a(int[] data) { return new IDirect3DPixelShader(); }
    public IDirect3DPixelShader a(Object data) { return new IDirect3DPixelShader(); }
    public IDirect3DVertexShader b(int[] data) { return new IDirect3DVertexShader(); }
    public IDirect3DVertexShader b(Object data) { return new IDirect3DVertexShader(); }
    public IDirect3DVertexBuffer a(int size, int usage, int fvf, int pool, IDirect3DVertexBuffer oldBuffer) { return new IDirect3DVertexBuffer(); }
    public IDirect3DIndexBuffer a(int size, int usage, int format, int pool, IDirect3DIndexBuffer oldBuffer) { return new IDirect3DIndexBuffer(); }
    public IDirect3DVolumeTexture a(int width, int height, int depth, int levels, int usage, int format, int pool) { return new IDirect3DVolumeTexture(); }
    public int a(Object... args) { return 0; }
    public int b(Object... args) { return 0; }
}
