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
        } catch (Throwable e) { BoundaryApplet.caught=1; }
    }
    private final void step() {
        BoundaryApplet.entered++;
        update(false);
    }
    abstract void update(boolean flag);
}
final class Worker extends Loop {
    private Source source = new Source();
    final void update(boolean flag) {
        if (source.ready()) BoundaryApplet.updated++;
    }
}
final class Source {
    private Payload payload = new Payload();
    final boolean ready() { return this.payload.bytes != null; }
}
final class Payload {
    byte[] bytes = new byte[1];
}
