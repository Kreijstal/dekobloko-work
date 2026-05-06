/*
 * Decompiled with CFR 0.152.
 */
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

public final class QkRunJavac
implements Runnable {
    int f;
    int q;
    int r;
    boolean g;
    boolean c;
    byte[] h;
    InputStream o;
    OutputStream b;
    Socket l;

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    @Override
    public final void run() {
        while (true) {
            int n;
            int n2;
            QkRunJavac qkRunJavac = this;
            synchronized (qkRunJavac) {
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
                int n3 = n = this.q <= this.f ? this.f - this.q : this.r - this.q;
                if (n <= 0) {
                    continue;
                }
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
            }
            catch (Throwable throwable) {
                this.c = true;
            }
        }
        try {
            if (this.o != null) {
                this.o.close();
            }
            if (this.b != null) {
                this.b.close();
            }
            if (this.l != null) {
                this.l.close();
            }
        }
        catch (Throwable throwable) {
            // empty catch block
        }
        this.h = null;
    }
}
