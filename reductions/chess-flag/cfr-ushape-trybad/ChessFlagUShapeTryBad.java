/*
 * Decompiled with CFR 0.152.
 */
public class ChessFlagUShapeTryBad {
    public static int G;
    public static int M;

    public static int test() {
        int n;
        block10: {
            int n2;
            int n3;
            int n4;
            block9: {
                block11: {
                    n4 = G;
                    n = M;
                    n3 = 14;
                    n2 = M;
                    if (-2 == ~n2) break block11;
                    if (0 != n2) {
                        // empty if block
                    }
                    break block9;
                }
                for (n2 = 1; n2 < n3; ++n2) {
                    if (n4 != 0) break block9;
                    n += n2;
                    if (n2 != 3) continue;
                    n += 10;
                    if (n4 == 0) continue;
                    if (n4 == 0) break block10;
                    break block9;
                }
                if (n4 == 0) break block10;
            }
            n2 = 1;
            while (~n2 > ~n3) {
                block14: {
                    block13: {
                        block12: {
                            if (n4 == 0) {
                                // empty if block
                            }
                            if (~n2 != -14) break block12;
                            n += 7;
                            if (n4 != 0) break block13;
                            if (n4 == 0) break block14;
                        }
                        n += n2;
                        ++n2;
                        if (n4 == 0) continue;
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
