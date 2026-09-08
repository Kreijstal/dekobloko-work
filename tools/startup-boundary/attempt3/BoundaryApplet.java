import java.applet.Applet;

public final class BoundaryApplet extends Applet {
    public static volatile int entered, unlocked, updated, presented, done, caught;
    public void init() { new Thread(new Worker()).start(); }
}
abstract class Loop implements Runnable {
    private static final long[] ticks = new long[32];
    private static int cursor;
    private static long previous;
    private static synchronized long clock() {
        long now = System.currentTimeMillis();
        if (now < previous) now = previous;
        previous = now;
        return now;
    }
    public final void run() {
        int state=0, iteration=0;
        while (true) {
            if (state==0) {
                try { long stamp=clock(); state=stamp!=0 ? 1 : 4; }
                catch (Throwable e) { state=4; }
                continue;
            }
            if (state==1) {
                try { step(); state=2; }
                catch (Throwable e) { state=4; }
                continue;
            }
            if (state==2) {
                try { BoundaryApplet.presented++; iteration++; state=iteration<3 ? 0 : 3; }
                catch (Throwable e) { state=4; }
                continue;
            }
            if (state==3) { BoundaryApplet.done=1; return; }
            BoundaryApplet.caught=1;
            return;
        }
    }
    private final void step() {
        try {
            long now = clock();
            ticks[cursor] = now;
            cursor = (cursor+1)&31;
            BoundaryApplet.entered++;
            Object monitor = this;
            synchronized(monitor) { BoundaryApplet.unlocked++; }
            update(false);
        } catch (RuntimeException e) { throw wrap(e); }
    }
    private static RuntimeException wrap(RuntimeException e) { return e; }
    abstract void update(boolean flag);
}
final class Worker extends Loop {
    final void update(boolean flag) {
        if (!flag) BoundaryApplet.updated++;
    }
}
