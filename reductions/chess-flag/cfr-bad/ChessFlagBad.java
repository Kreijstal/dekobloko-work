/*
 * Decompiled with CFR 0.152.
 */
public class ChessFlagBad {
    public static int G;

    public static int test(int n) {
        int n2 = G;
        int n3 = 0;
        for (int i = 0; i < n; ++i) {
            block3: {
                block4: {
                    block2: {
                        block1: {
                            if (i != 1) break block1;
                            if (n2 == 0) break block2;
                            break block3;
                        }
                        if (i != 2) continue;
                        if (n2 == 0) break block4;
                        break block3;
                    }
                    n3 += 10;
                    continue;
                }
                n3 += 20;
                continue;
            }
            n3 += 100;
        }
        return n3;
    }
}
