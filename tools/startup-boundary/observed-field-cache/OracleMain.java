public final class OracleMain {
    public static void main(String[] args) {
        new Worker().run();
        if (BoundaryApplet.entered != 3 || BoundaryApplet.updated != 384 ||
            BoundaryApplet.presented != 3 || BoundaryApplet.done != 1 ||
            BoundaryApplet.caught != 0) throw new AssertionError();
        System.out.println("entered=3 updated=384 presented=3 done=1 caught=0");
    }
}
