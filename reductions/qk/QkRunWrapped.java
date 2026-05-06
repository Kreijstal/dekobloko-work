import java.io.OutputStream;

public final class QkRunWrapped implements Runnable {
    int f;
    int q;
    int r;
    boolean g;
    boolean c;
    byte[] h;
    OutputStream b;

    @Override
    public final void run() {
        try {
            try {
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
                    }
                    if (len <= 0) {
                        continue;
                    }
                    try {
                        this.b.write(this.h, start, len);
                    } catch (Throwable ignored) {
                        this.c = true;
                    }
                    this.q = (len + this.q) % this.r;
                    try {
                        if (this.f != this.q) {
                            continue;
                        }
                        this.b.flush();
                    } catch (Throwable ignored) {
                        this.c = true;
                        continue;
                    }
                }
                this.h = null;
            } catch (Throwable t) {
                report(t);
            }
        } catch (Throwable t) {
            throw wrap(t);
        }
    }

    static void report(Throwable t) {
    }

    static RuntimeException wrap(Throwable t) {
        return new RuntimeException(t);
    }
}
