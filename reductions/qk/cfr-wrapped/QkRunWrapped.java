/*
 * Decompiled with CFR 0.152.
 */
import java.io.OutputStream;

public final class QkRunWrapped
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
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    @Override
    public final void run() {
        block12: while (true) {
            try {
                try {}
                catch (Throwable throwable) {
                    QkRunWrapped.report(throwable);
                    return;
                }
            }
            catch (Throwable throwable) {
                throw QkRunWrapped.wrap(throwable);
            }
            while (true) {
                int n;
                int n2;
                QkRunWrapped qkRunWrapped = this;
                synchronized (qkRunWrapped) {
                    if (this.f == this.q) {
                        if (this.g) {
                            // MONITOREXIT @DISABLED, blocks:[6, 12, 13, 14, 15] lbl15 : MonitorExitStatement: MONITOREXIT : var3_5
                            this.h = null;
                            return;
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
                    if (n <= 0) continue;
                }
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
                    continue block12;
                }
                catch (Throwable throwable) {
                    this.c = true;
                    continue;
                }
                break;
            }
        }
    }

    static void report(Throwable throwable) {
    }

    static RuntimeException wrap(Throwable throwable) {
        return new RuntimeException(throwable);
    }
}
