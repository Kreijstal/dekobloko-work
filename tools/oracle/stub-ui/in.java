import java.util.ArrayList;
import java.util.List;

/**
 * Stub shadowing the original `in` banner/notification node for the oracle
 * harness.
 *
 * `qc.a(int)` -- the end-of-game banner selector -- pushes `new in(text, id,
 * flag)` onto its `vj` queue. The real constructor immediately measures the
 * text with `in.field_n` (an `lm` font) to lay the banner out, which needs the
 * font cache and therefore the whole graphics stack. The SELECTION is what we
 * want to measure, not the layout, so this stub records the constructor
 * arguments and does nothing else.
 *
 * It extends the original `bh` from the jar, so `vj.a(bh,int)` still links and
 * the queue still behaves like the real one.
 *
 * Put this directory FIRST on the classpath (-cp stub-ui:.:../../dekobloko.jar)
 * so it shadows the jar's `in` and nothing else.
 */
public final class in extends bh {

    /** Every banner constructed since the last {@link #reset()}. */
    public static final List<String[]> LOG = new ArrayList<String[]>();

    public boolean field_p;
    public int field_r;

    public in(String text, int id, boolean flag) {
        this.field_r = id;
        LOG.add(new String[]{text, Integer.toString(id), Boolean.toString(flag)});
    }

    public static void reset() {
        LOG.clear();
    }
}
