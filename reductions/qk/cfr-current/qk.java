/*
 * Decompiled with CFR 0.152.
 */
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;

final class qk
implements Runnable {
    private fd j;
    static int d;
    private InputStream o;
    private boolean g = false;
    static int a;
    private int r;
    private mh p;
    static int n;
    static int m;
    private Socket l;
    private int q = 0;
    private boolean c = false;
    private OutputStream b;
    static String[] s;
    static int i;
    private byte[] h;
    static int k;
    static String[] e;
    private int f = 0;

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    final void a(int n, int n2, int n3, byte[] byArray) throws IOException {
        boolean bl = client.A;
        try {
            if (this.g) {
                return;
            }
            if (n3 != 1) {
                s = null;
            }
            if (this.c) {
                this.c = false;
                throw new IOException();
            }
            if (this.h == null) {
                this.h = new byte[this.r];
            }
            qk qk2 = this;
            synchronized (qk2) {
                for (int i = 0; i < n2; ++i) {
                    this.h[this.f] = byArray[n + i];
                    this.f = (1 + this.f) % this.r;
                    if (this.f != (this.r + this.q + -100) % this.r) continue;
                    throw new IOException();
                }
                if (null == this.p) {
                    this.p = this.j.a((byte)-45, 3, this);
                }
                this.notifyAll();
            }
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.G(" + n + ',' + n2 + ',' + n3 + ',' + (byArray != null ? "{...}" : "null") + ')');
        }
    }

    final int c(byte by) throws IOException {
        try {
            if (this.g) {
                return 0;
            }
            int n = -99 % ((-44 - by) / 41);
            return this.o.read();
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.J(" + by + ')');
        }
    }

    static final String d(byte by) {
        boolean bl = client.A;
        try {
            String string = "(" + lg.U + " " + bb.d + " " + kf.L + ") " + bh.k;
            if (by < 14) {
                return null;
            }
            if (-1 > ~sm.e) {
                string = string + ":";
                for (int i = 0; i < sm.e; ++i) {
                    string = string + ' ';
                    int n = de.V.r[i] & 0xFF;
                    int n2 = n >> -1389597532;
                    n2 = n2 < 10 ? (n2 += 48) : (n2 += 55);
                    string = string + (char)n2;
                    n = -11 < ~(n &= 0xF) ? (n += 48) : (n += 55);
                    string = string + (char)n;
                }
            }
            return string;
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.F(" + by + ')');
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     */
    final void a(int n) {
        boolean bl = client.A;
        try {
            if (this.g) {
                return;
            }
            qk qk2 = this;
            synchronized (qk2) {
                this.g = true;
                this.notifyAll();
            }
            if (n != 0) {
                return;
            }
            if (null != this.p) {
                while (this.p.c == 0) {
                    ua.a(1L, n ^ 0xFFFFFF80);
                }
                if (1 == this.p.c) {
                    try {
                        ((Thread)this.p.b).join();
                    }
                    catch (Throwable throwable) {
                        // empty catch block
                    }
                }
            }
            this.p = null;
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.C(" + n + ')');
        }
    }

    /*
     * WARNING - Removed try catching itself - possible behaviour change.
     * Unable to fully structure code
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    @Override
    public final void run() {
        var6_1 = client.A;
        try {
            try {
                while (true) lbl-1000:
                // 5 sources

                {
                    var3_7 = this;
                    synchronized (var3_7) {
                        if (~this.f == ~this.q) {
                            if (this.g) {
                                // MONITOREXIT @DISABLED, blocks:[0, 17, 1, 18, 7, 14] lbl9 : MonitorExitStatement: MONITOREXIT : var3_7
                                try {
                                    if (null != this.o) {
                                        this.o.close();
                                    }
                                    if (null != this.b) {
                                        this.b.close();
                                    }
                                    if (null == this.l) ** break;
                                    this.l.close();
                                }
                                catch (Throwable var1_3) {
                                    // empty catch block
                                }
                                ** break;
                            }
                            try {
                                this.wait();
                            }
                            catch (Throwable var4_10) {
                                // empty catch block
                            }
                        }
                        var2_6 = this.q;
                        var1_2 = this.q <= this.f ? this.f + -this.q : this.r - this.q;
                        if (~var1_2 >= -1) continue;
                    }
                    try {
                        this.b.write(this.h, var2_6, var1_2);
                    }
                    catch (Throwable var3_8) {
                        this.c = true;
                    }
                    this.q = (var1_2 + this.q) % this.r;
                    try {
                        if (this.f != this.q) ** GOTO lbl-1000
                        this.b.flush();
                    }
                    catch (Throwable var3_9) {
                        this.c = true;
                        continue;
                    }
                    break;
                }
                ** GOTO lbl-1000
lbl43:
                // 3 sources

                this.h = null;
                return;
            }
            catch (Throwable var1_4) {
                qb.a(var1_4, 16408, null);
                return;
            }
        }
        catch (Throwable var1_5) {
            throw dh.a(var1_5, "qk.run()");
        }
    }

    protected final void finalize() {
        try {
            this.a(0);
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.finalize()");
        }
    }

    static final Object a(byte[] byArray, int n, boolean bl) {
        try {
            if (null == byArray) {
                return null;
            }
            if (136 < byArray.length) {
                fn fn2 = new fn();
                ((mk)fn2).a(byArray, true);
                return fn2;
            }
            if (n != -1389597532) {
                i = 67;
            }
            if (bl) {
                return jd.a(0, byArray);
            }
            return byArray;
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.E(" + (byArray != null ? "{...}" : "null") + ',' + n + ',' + bl + ')');
        }
    }

    final int b(int n) throws IOException {
        try {
            if (this.g) {
                return 0;
            }
            if (n != 0) {
                return -106;
            }
            return this.o.available();
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.H(" + n + ')');
        }
    }

    public static void c(int n) {
        try {
            e = null;
            if (n != -11657) {
                return;
            }
            s = null;
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.D(" + n + ')');
        }
    }

    /*
     * Enabled aggressive block sorting
     * Enabled unnecessary exception pruning
     * Enabled aggressive exception aggregation
     */
    final void a(int n, int n2, byte by, byte[] byArray) throws IOException {
        boolean bl = client.A;
        try {
            if (this.g) {
                return;
            }
            int n3 = -1;
            while (true) {
                if (n3 <= ~n) {
                    if (by == 17) return;
                    this.a(31);
                    return;
                }
                int n4 = this.o.read(byArray, n2, n);
                if (0 >= n4) throw new EOFException();
                n2 += n4;
                n -= n4;
                n3 = -1;
            }
        }
        catch (Throwable throwable) {
            String string;
            StringBuilder stringBuilder = new StringBuilder().append("qk.I(").append(n).append(',').append(n2).append(',').append(by).append(',');
            if (byArray != null) {
                string = "{...}";
                throw dh.a(throwable, stringBuilder.append(string).append(')').toString());
            }
            string = "null";
            throw dh.a(throwable, stringBuilder.append(string).append(')').toString());
        }
    }

    final void b(byte by) throws IOException {
        try {
            if (this.g) {
                return;
            }
            if (by > -21) {
                return;
            }
            if (this.c) {
                this.c = false;
                throw new IOException();
            }
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.B(" + by + ')');
        }
    }

    qk(Socket socket, fd fd2) throws IOException {
        this(socket, fd2, 5000);
    }

    static final void a(byte by) {
        try {
            dj.ab.setLength(0);
            pk.r = 0;
            if (by != 94) {
                d = -4;
            }
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.A(" + by + ')');
        }
    }

    private qk(Socket socket, fd fd2, int n) throws IOException {
        try {
            this.j = fd2;
            this.l = socket;
            this.l.setSoTimeout(30000);
            this.l.setTcpNoDelay(true);
            this.o = this.l.getInputStream();
            this.b = this.l.getOutputStream();
            this.r = n;
        }
        catch (Throwable throwable) {
            throw dh.a(throwable, "qk.<init>(" + (socket != null ? "{...}" : "null") + ',' + (fd2 != null ? "{...}" : "null") + ',' + n + ')');
        }
    }

    static {
        s = new String[]{"Deko Bloko", "Double Deko", "Triple Deko", "Mega Deko", "Double Bloko", "Triple Bloko", "Mini Bombo", "Maxi Bombo", "Tower Bloko", "Massive Attako", "Clean Sweepo", "Uh-Oh Bloko", "Floral Bloko", "Urban Bloko", "Retro Bloko", "Bronze Blokker", "Silver Blokker", "Gold Blokker", "Blok of Beginning", "Blok of Victory", "Blok of Supremacy", "Deko Pwnage", "Ultimate Pwnage", "Quick Deko", "Safe Deko", "Deko Modo", "Shape Mover", "Shape Sender", "Shape Dispatcher", "Shape Consigner", "Shape Shifter"};
        e = new String[]{null, "to discard it and<nbsp>continue.", "to discard it and<nbsp>continue.", "to discard them and<nbsp>continue.", "to discard them and<nbsp>continue.", "to discard them and<nbsp>continue.", "to discard them and<nbsp>continue.", "to discard them and<nbsp>continue."};
    }
}
