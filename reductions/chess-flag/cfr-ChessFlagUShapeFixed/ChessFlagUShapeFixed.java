/*
 * Decompiled with CFR 0.152.
 */
public class ChessFlagUShapeFixed {
    public static int G;
    public static int M;

    public static int test() {
        int n;
        block8: {
            int n2;
            int n3;
            boolean bl;
            block7: {
                block9: {
                    bl = false;
                    n = M;
                    n3 = 14;
                    n2 = M;
                    if (-2 == ~n2) break block9;
                    if (0 != n2) {
                        // empty if block
                    }
                    break block7;
                }
                for (n2 = 1; n2 < n3; ++n2) {
                    if (bl) break block7;
                    n += n2;
                    if (n2 != 3) continue;
                    n += 10;
                    if (!bl) continue;
                    if (!bl) break block8;
                    break block7;
                }
                if (!bl) break block8;
            }
            n2 = 1;
            while (~n2 > ~n3) {
                block12: {
                    block11: {
                        block10: {
                            if (!bl) {
                                // empty if block
                            }
                            if (~n2 != -14) break block10;
                            n += 7;
                            if (bl) break block11;
                            if (!bl) break block12;
                        }
                        n += n2;
                        ++n2;
                        if (!bl) continue;
                    }
                    n += 100;
                }
                n += 3;
                break;
            }
        }
        return n;
    }
}
