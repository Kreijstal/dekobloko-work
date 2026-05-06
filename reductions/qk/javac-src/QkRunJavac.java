import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

public final class QkRunJavac implements Runnable {
    int f;
    int q;
    int r;
    boolean g;
    boolean c;
    byte[] h;
    InputStream o;
    OutputStream b;
    Socket l;

    @Override
    public final void run() {
        while (true) {
            int start;
            int len;
            synchronized (this) {
                if (this.f == this.q) {
                    if (this.g) {
                        break;
                    }
                    try {
                        this.wait();
                    } catch (Throwable ignored) {
                    }
                }
                start = this.q;
                len = this.q <= this.f ? this.f - this.q : this.r - this.q;
                if (len <= 0) {
                    continue;
                }
            }
            try {
                this.b.write(this.h, start, len);
            } catch (Throwable ignored) {
                this.c = true;
            }
            this.q = (len + this.q) % this.r;
            try {
                if (this.f == this.q) {
                    this.b.flush();
                }
            } catch (Throwable ignored) {
                this.c = true;
                continue;
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
        } catch (Throwable ignored) {
        }
        this.h = null;
    }
}
