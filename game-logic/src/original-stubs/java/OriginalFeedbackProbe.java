/** Package-level accessor for original feedback shapes without AWT reflection. */
public final class OriginalFeedbackProbe {
    private OriginalFeedbackProbe() {
    }

    public static int width(Object shape) {
        return ((rf) shape).b;
    }

    public static int height(Object shape) {
        return ((rf) shape).n;
    }

    public static byte[] cells(Object shape) {
        return ((rf) shape).c;
    }

    public static Throwable unwrap(Throwable throwable) {
        return throwable instanceof jb ? ((jb) throwable).e : throwable;
    }
}
