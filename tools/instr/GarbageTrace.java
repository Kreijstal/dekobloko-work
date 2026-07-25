import java.lang.reflect.Field;

/**
 * Runtime logger injected into the ORIGINAL gamepack by InjectGarbageTrace.
 *
 * Traces the incoming-garbage lifecycle from the client's side so it can be
 * diffed against the server's [garbage] lines:
 *
 *   STAGE   lk.a(rf, byte)      S2C 67 appended a cooked shape to the queue
 *   RELEASE lk.b(int)           S2C 66 started a queued shape's exit animation
 *   INSTALL lk.a(int, int, rf)  a piece became the active falling piece
 *   DROP    lk.p(int)           a shape left the queue for good
 *   CACHE   oi.a(rf, int)       shape-cache insert (throws on a duplicate id)
 *
 * Field access is reflective and accepts either the original short names or
 * the deobfuscation pipeline's field_-prefixed ones, so the same build works
 * against the original jar and a recompiled one.
 */
public final class GarbageTrace {

    private GarbageTrace() {}

    private static Field field(Object o, String name) {
        if (o == null) return null;
        Class<?> c = o.getClass();
        while (c != null) {
            try {
                Field f = c.getDeclaredField(name);
                f.setAccessible(true);
                return f;
            } catch (NoSuchFieldException ignored) {
                try {
                    Field f = c.getDeclaredField("field_" + name);
                    f.setAccessible(true);
                    return f;
                } catch (NoSuchFieldException ignored2) {
                    c = c.getSuperclass();
                }
            }
        }
        return null;
    }

    private static int i(Object o, String name) {
        try {
            Field f = field(o, name);
            return f == null ? -12345 : f.getInt(o);
        } catch (Throwable t) {
            return -12345;
        }
    }

    /** Boolean field reader: field_y and field_Bb are booleans, not ints. */
    private static String z(Object o, String name) {
        try {
            Field f = field(o, name);
            return f == null ? "?" : String.valueOf(f.getBoolean(o));
        } catch (Throwable t) {
            return "?";
        }
    }

    private static int arrayLen(Object o, String name) {
        try {
            Field f = field(o, name);
            if (f == null) return -1;
            Object v = f.get(o);
            return v == null ? -1 : java.lang.reflect.Array.getLength(v);
        } catch (Throwable t) {
            return -1;
        }
    }

    /** rf identity: id, bounding box, and its release counter. */
    private static String rf(Object shape) {
        if (shape == null) return "rf=null";
        int width = i(shape, "b");
        int height = i(shape, "n");
        StringBuilder map = new StringBuilder();
        try {
            Field f = field(shape, "c");
            byte[] cells = f == null ? null : (byte[]) f.get(shape);
            if (cells != null && width > 0 && height > 0
                    && cells.length >= width * height) {
                for (int y = 0; y < height; y++) {
                    if (y > 0) map.append('/');
                    for (int x = 0; x < width; x++) {
                        map.append(cells[y * width + x] == 0 ? '.' : '#');
                    }
                }
            }
        } catch (Throwable ignored) {
            // geometry is best-effort; never let tracing break the client
        }
        return "id=" + i(shape, "j") + " " + width + "x" + height
                + " map=" + map + " e=" + i(shape, "e");
    }

    /**
     * lk queue state, tagged with the board's identity.
     *
     * The identity matters more than it looks: every player has their own lk,
     * and a shape staged on a board nobody is looking at is indistinguishable
     * from one that never staged at all. Correlate `board=` here with the
     * board receiving INSTALLs to tell which bucket is which.
     */
    private static String queue(Object board) {
        return "board=" + Integer.toHexString(System.identityHashCode(board))
                + " t=" + i(board, "t") + " cap=" + arrayLen(board, "X")
                + " U=" + i(board, "U")
                + " wb=" + i(board, "wb")
                + " head_l=" + headDelay(board);
    }

    /**
     * field_l of the first staged shape: the 18-frame incoming-warning
     * countdown (lk.java case 91). 18 means just staged, 0 means the warning
     * has elapsed and lk.e() reports the shape ready.
     */
    private static int headDelay(Object board) {
        try {
            if (i(board, "t") <= 0) return -1;
            Field f = field(board, "X");
            if (f == null) return -1;
            Object arr = f.get(board);
            if (arr == null || java.lang.reflect.Array.getLength(arr) == 0) return -1;
            Object head = java.lang.reflect.Array.get(arr, 0);
            return head == null ? -1 : i(head, "l");
        } catch (Throwable t) {
            return -1;
        }
    }

    private static void say(String line) {
        System.out.println("[CT] " + line);
        System.out.flush();
    }

    public static void stage(Object board, Object shape) {
        try {
            say("STAGE   before{" + queue(board) + "} " + rf(shape));
        } catch (Throwable ignored) {}
    }

    public static void release(Object board, int cookie) {
        try {
            say("RELEASE cookie=" + cookie + " {" + queue(board) + "}");
        } catch (Throwable ignored) {}
    }

    public static void install(Object board, Object shape) {
        try {
            // A new active piece means the previous one has committed, so the
            // grid here is directly comparable to the server's finalize dump.
            emitSig(board, "install");
            say("INSTALL {" + queue(board) + "} " + rf(shape));
        } catch (Throwable ignored) {}
    }

    public static void drop(Object board) {
        try {
            say("DROP    {" + queue(board) + "}");
        } catch (Throwable ignored) {}
    }

    /** Occupied cells of the board grid (field_P), for comparison with the
     *  server's board_fill. A divergence here means the replica's CONTENTS
     *  drifted; equal fills with a different outcome means only the condition
     *  differs. */
    private static int boardFill(Object board) {
        try {
            Field f = field(board, "P");
            if (f == null) return -1;
            Object grid = f.get(board);
            if (grid == null) return -1;
            int len = java.lang.reflect.Array.getLength(grid);
            int filled = 0;
            for (int i = 0; i < len; i++) {
                if (java.lang.reflect.Array.getInt(grid, i) != 0) filled++;
            }
            return filled;
        } catch (Throwable t) {
            return -1;
        }
    }

    /** Dump a full positional board signature every this many lock ticks. */
    private static final int SIGNATURE_TICK_INTERVAL = 200;

    private static final java.util.Map<Object, int[]> SIG_TICKS =
            new java.util.IdentityHashMap<Object, int[]>();

    /**
     * Last signature emitted per (trigger, board), so a repeat dump is
     * skipped.  A plain HashMap, not an IdentityHashMap: the keys are freshly
     * built strings, which an identity map would never match, defeating the
     * dedup entirely.
     */
    private static final java.util.Map<String, String> SIG_LAST =
            new java.util.HashMap<String, String>();

    /**
     * Row-by-row occupancy of the settled grid (field_P), in the same
     * '#'/'.' vocabulary the server's ``_board_signature`` uses.
     *
     * A fill count alone hides the bug this exists to catch: a replica whose
     * stack holds the right NUMBER of cells in the wrong PLACES reports an
     * identical fill, then lands later pieces at the wrong height.
     */
    private static String boardSig(Object board) {
        try {
            Field f = field(board, "P");
            if (f == null) return "board=None";
            Object grid = f.get(board);
            if (grid == null) return "board=None";
            int w = i(board, "O");     // field_O is WIDTH
            int h = i(board, "a");     // field_a is HEIGHT
            int len = java.lang.reflect.Array.getLength(grid);
            if (w <= 0 || h <= 0 || len < w * h) return "board=?" + w + "x" + h;
            StringBuilder rows = new StringBuilder();
            int fill = 0;
            for (int y = 0; y < h; y++) {
                if (y > 0) rows.append('|');
                for (int x = 0; x < w; x++) {
                    // field_P packs flags above bit 27 (lk.java:808 adds
                    // 1<<28 during a clear animation); the client itself
                    // masks with 0x0FFFFFFF before reading a cell, so an
                    // unmasked test would report animating cells as occupied
                    // and desync the diff against the server's plain grid.
                    int cell = java.lang.reflect.Array.getInt(grid, y * w + x)
                            & 0x0FFFFFFF;
                    boolean set = cell != 0;
                    if (set) fill++;
                    rows.append(set ? '#' : '.');
                }
            }
            return w + "x" + h + " fill=" + fill + " rows=" + rows;
        } catch (Throwable t) {
            return "board=err";
        }
    }

    /**
     * Emit a signature for this board, tagged with its trigger.
     *
     * Repeats are suppressed PER TRIGGER, never globally.  A global dedup
     * shares state between triggers, so a ``periodic`` or ``landed`` dump
     * swallows a state and the matching ``install`` dump is then dropped --
     * which silently shortens and shifts the install-only stream the diff
     * pairs against the server's finalize stream, and manufactures a total
     * desync where the boards actually agree.  That cost a whole round of
     * false conclusions; keep the streams independent.
     */
    private static void emitSig(Object board, String when) {
        String sig = boardSig(board);
        String key = when + "@" + System.identityHashCode(board);
        if (sig.equals(SIG_LAST.get(key))) return;
        SIG_LAST.put(key, sig);
        say("SIG     board=" + Integer.toHexString(System.identityHashCode(board))
                + " at=" + when + " " + sig);
    }

    /**
     * lk.c(int,int,int): the lock routine. It retries placement and, when it
     * runs out of attempts, sets field_y and then field_Bb -- which is what
     * makes qc raise the T5 self-disconnect. Logging its entry state shows the
     * board the replica actually believes in at the moment it gives up.
     */
    public static void lock(Object board, int p0, int p1, int p2) {
        try {
            // field_y flips false->true at the exact moment the replica
            // decides the piece has come to rest.  That is the sync point the
            // server's finalize signature must match, so dump it there as well
            // as periodically.
            int[] counter = SIG_TICKS.get(board);
            if (counter == null) {
                counter = new int[]{0};
                SIG_TICKS.put(board, counter);
            }
            if (++counter[0] >= SIGNATURE_TICK_INTERVAL) {
                counter[0] = 0;
                emitSig(board, "periodic");
            }
            if ("true".equals(z(board, "y"))) {
                emitSig(board, "landed");
            }
            say("LOCK    " + queue(board)
                    + " fill=" + boardFill(board)
                    + " active=" + i(board, "C") + "x" + i(board, "zb")
                    + " at=(" + i(board, "q") + "," + i(board, "L") + ")"
                    + " y=" + z(board, "y") + " Bb=" + z(board, "Bb")
                    + " args=(" + p0 + "," + p1 + "," + p2 + ")");
        } catch (Throwable ignored) {}
    }

    /**
     * qk.a(int): the client asking its own connection to close. It sets the
     * shutdown flag g=true and notifies; qk.run() then closes the streams and
     * the socket. The stack trace is the whole point -- it names whatever
     * decided to drop the connection, which the server can only observe as an
     * unexplained EOF.
     */
    public static void closing(Object conn, int cookie) {
        try {
            say("CLOSE   requested cookie=" + cookie);
            StackTraceElement[] frames = new Throwable().getStackTrace();
            // frame 0 is this method; show the callers.
            for (int i = 1; i < Math.min(12, frames.length); i++) {
                say("CLOSE     at " + frames[i]);
            }
        } catch (Throwable ignored) {}
    }

    /**
     * dh.a(Throwable, String): the obfuscator's catch-all wrapper. Every
     * method body funnels its exceptions through here to be rethrown as `jb`,
     * so a protocol parse failure is visible here and almost nowhere else --
     * the context string carries the method and arguments.
     */
    public static void wrapped(Throwable cause, String context) {
        try {
            say("WRAPPED " + context + " <- "
                    + (cause == null ? "null" : cause.toString()));
            if (cause != null) {
                StackTraceElement[] frames = cause.getStackTrace();
                for (int i = 0; i < Math.min(6, frames.length); i++) {
                    say("WRAPPED   at " + frames[i]);
                }
            }
        } catch (Throwable ignored) {}
    }

    /**
     * lk.a(int,int,int,boolean,int,int): the authoritative landing carried by
     * S2C 64.  ``finalX``/``finalY`` are the server's own final_x/final_y and
     * ``orient`` the target orientation, so these lines pair one-to-one with
     * the server's "authoritative transition slot=N final=(x,y) rotation=r".
     *
     * If they agree yet the committed grids still differ, the position is
     * being applied to a stack that was already wrong, and the drift happened
     * earlier -- between landings, in the relayed control replay.
     */
    public static void landing(Object board, int mask, int finalizeArg,
                               int orient, int finalX, int finalY) {
        try {
            say("LANDING board=" + Integer.toHexString(System.identityHashCode(board))
                    + " final=(" + finalX + "," + finalY + ")"
                    + " orient=" + orient
                    + " was=(" + i(board, "q") + "," + i(board, "L") + ")"
                    + " ab=" + i(board, "ab")
                    + " finalizeArg=" + finalizeArg
                    + " fillBefore=" + boardFill(board));
        } catch (Throwable ignored) {}
    }

    public static void cache(Object shape, int cookie) {
        try {
            say("CACHE   cookie=" + cookie + " " + rf(shape));
        } catch (Throwable ignored) {}
    }
}
