/*
 * Decompiled with CFR 0.152.
 */
import java.io.OutputStream;

public final class QkRunBad
implements Runnable {
    int f;
    int q;
    int r;
    boolean g;
    boolean c;
    byte[] h;
    OutputStream b;

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    @Override
    public final void run() {
        while (true) {
            int n;
            int n2;
            QkRunBad qkRunBad = this;
            synchronized (qkRunBad) {
                if (this.f == this.q) {
                    if (this.g) {
                        break;
                    }
                    try {
                        this.wait();
                    }
                    catch (Throwable throwable) {
                        // empty catch block
                    }
                }
                n2 = this.q;
                n = this.q <= this.f ? this.f - this.q : this.r - this.q;
            }
            if (n <= 0) continue;
            try {
                this.b.write(this.h, n2, n);
            }
            catch (Throwable throwable) {
                this.c = true;
            }
            this.q = (n + this.q) % this.r;
            try {
                if (this.f != this.q) continue;
                this.b.flush();
            }
            catch (Throwable throwable) {
                this.c = true;
            }
        }
        this.h = null;
    }
}
