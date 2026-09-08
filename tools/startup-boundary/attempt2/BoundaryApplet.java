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
        try {
            for (int i=0;i<3;i++) { step(); BoundaryApplet.presented++; }
            BoundaryApplet.done=1;
        } catch (RuntimeException e) { BoundaryApplet.caught=1; }
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
