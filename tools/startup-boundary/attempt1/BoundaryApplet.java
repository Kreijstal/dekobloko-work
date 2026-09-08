import java.applet.Applet;

public final class BoundaryApplet extends Applet {
    public static volatile int entered, unlocked, updated, presented, done, caught;
    public void init() { new Thread(new Worker()).start(); }
}
abstract class Loop implements Runnable {
    public final void run() {
        try {
            for (int i=0;i<3;i++) { step(); BoundaryApplet.presented++; }
            BoundaryApplet.done=1;
        } catch (RuntimeException e) { BoundaryApplet.caught=1; }
    }
    private final void step() {
        try {
            BoundaryApplet.entered++;
            synchronized(this) { BoundaryApplet.unlocked++; }
            update(false);
        } catch (RuntimeException e) { throw e; }
    }
    abstract void update(boolean flag);
}
final class Worker extends Loop {
    final void update(boolean flag) {
        if (!flag) BoundaryApplet.updated++;
    }
}
