import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * Runtime logger injected into the ORIGINAL gamepack by InjectGarbageTrace.
 *
 * Traces the incoming-garbage lifecycle from the client's side so it can be
 * diffed against the server's [garbage] lines:
 *
 *   G67     client            an S2C 67 "cooked shape" packet was parsed
 *   STAGE<  lk.a(rf, byte)    queue immediately BEFORE the append
 *   STAGE>  lk.a(rf, byte)    queue immediately AFTER the append
 *   G66     client            an S2C 66 "cooked release" packet was parsed
 *   REL<    lk.b(int)         queue before one shape is taken out of pending
 *   REL>    lk.b(int)         which shape came out, and what is left
 *   STGDRAW qc.a(lk,...)      the staging-area renderer's view of the queue
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

    /** CT_LOCK=1 re-enables the per-tick LOCK lines (off by default). */
    private static final boolean LOCK_LINES = System.getenv("CT_LOCK") != null;
    private static final boolean REFLECT_BOT =
            Boolean.getBoolean("dekobloko.reflectBot");
    private static final long BOT_TICK_NANOS =
            Math.max(0L, Long.getLong("dekobloko.botTickMillis", 20L)) * 1000000L;
    private static boolean botStarterStarted;
    private static final java.util.IdentityHashMap<Object, BotState> BOT_STATES =
            new java.util.IdentityHashMap<Object, BotState>();

    private static final class BotState {
        int tick;
        int piece;
        int age;
        int targetX;
        int targetOrientation;
        int lastForced = Integer.MIN_VALUE;
        long nextTickNanos;
    }

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

    // ------------------------------------------------------------------
    // Reflection-only deterministic single-player driver
    // ------------------------------------------------------------------

    public static synchronized void startSingleplayerBot() {
        if (!REFLECT_BOT || botStarterStarted) return;
        botStarterStarted = true;
        Thread starter = new Thread(new Runnable() {
            public void run() {
                try {
                    Object stages = null;
                    for (int attempt = 0; attempt < 1200; attempt++) {
                        stages = staticValue("sb", "u");
                        if (nestedArrayReady(stages)) break;
                        Thread.sleep(25L);
                    }
                    if (!nestedArrayReady(stages)) {
                        say("DIFF_START error=singleplayer-resources-timeout");
                        return;
                    }
                    Method start = Class.forName("pn").getDeclaredMethod(
                            "a", Boolean.TYPE, Boolean.TYPE, Boolean.TYPE);
                    start.setAccessible(true);
                    start.invoke(null, Boolean.FALSE, Boolean.FALSE, Boolean.FALSE);
                    Object game = staticValue("kf", "I");
                    say("DIFF_START game="
                            + (game == null ? "null" : game.getClass().getName())
                            + " awt=stub reflection=true");
                } catch (Throwable t) {
                    say("DIFF_START error=" + t.getClass().getName()
                            + ":" + String.valueOf(t.getMessage()).replace(' ', '_'));
                }
            }
        }, "dekobloko-reflection-bot-start");
        starter.setDaemon(true);
        starter.start();
    }

    private static Object staticValue(String className, String fieldName)
            throws Exception {
        Class<?> type = Class.forName(className);
        Field f;
        try {
            f = type.getDeclaredField(fieldName);
        } catch (NoSuchFieldException missing) {
            f = type.getDeclaredField("field_" + fieldName);
        }
        f.setAccessible(true);
        return f.get(null);
    }

    private static boolean nestedArrayReady(Object value) {
        if (value == null || !value.getClass().isArray()
                || java.lang.reflect.Array.getLength(value) == 0) return false;
        Object first = java.lang.reflect.Array.get(value, 0);
        return first != null && first.getClass().isArray()
                && java.lang.reflect.Array.getLength(first) > 0
                && java.lang.reflect.Array.get(first, 0) != null;
    }

    public static int beforeTick(Object board, int originalControl) {
        if (!REFLECT_BOT) return originalControl;
        BotState state;
        synchronized (BOT_STATES) {
            state = BOT_STATES.get(board);
            if (state == null) {
                state = new BotState();
                state.nextTickNanos = System.nanoTime();
                BOT_STATES.put(board, state);
            }
        }
        pace(state);
        int forced = i(board, "Ab");
        if (state.lastForced == Integer.MIN_VALUE
                || forced > state.lastForced + 100) {
            state.piece++;
            state.age = 0;
            int width = Math.max(1, i(board, "O"));
            int pieceWidth = Math.max(1, i(board, "C"));
            int span = Math.max(1, width - pieceWidth + 1);
            state.targetX = ((state.piece - 1) * 3) % span;
            state.targetOrientation = state.piece & 1;
        }
        state.lastForced = forced;
        state.age++;
        int control = chooseControl(board, state);
        state.tick++;
        say(diffFrame("pre", board, control, state.tick));
        return control;
    }

    public static void afterTick(Object board, int control) {
        if (!REFLECT_BOT) return;
        BotState state;
        synchronized (BOT_STATES) {
            state = BOT_STATES.get(board);
        }
        if (state != null) say(diffFrame("post", board, control, state.tick));
    }

    private static void pace(BotState state) {
        if (BOT_TICK_NANOS <= 0L) return;
        long now = System.nanoTime();
        long wait = state.nextTickNanos - now;
        if (wait > 0L) {
            try {
                long millis = wait / 1000000L;
                int nanos = (int) (wait % 1000000L);
                Thread.sleep(millis, nanos);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        }
        now = System.nanoTime();
        state.nextTickNanos = Math.max(
                state.nextTickNanos + BOT_TICK_NANOS,
                now + BOT_TICK_NANOS);
    }

    private static int chooseControl(Object board, BotState state) {
        if ("true".equals(z(board, "y"))) return 0;
        int previous = i(board, "A") & 31;
        int orientation = i(board, "ab") & 3;
        if (orientation != state.targetOrientation) {
            return (previous & 8) != 0 ? 0 : 8;
        }
        int x = i(board, "q");
        if (x > state.targetX) return 1;
        if (x < state.targetX) return 2;
        // Exercise both normal gravity and accelerated timing while still
        // finishing enough pieces to expose settle/queue mismatches quickly.
        return state.age % 5 == 0 ? 0 : 16;
    }

    private static String diffFrame(
            String phase, Object board, int control, int tick) {
        int boardWidth = i(board, "O");
        int boardHeight = i(board, "a");
        int pieceWidth = i(board, "C");
        int pieceHeight = i(board, "zb");
        return "DIFF"
                + " phase=" + phase
                + " tick=" + tick
                + " board=" + Integer.toHexString(System.identityHashCode(board))
                + " ctrl=" + (control & 31)
                + " bw=" + boardWidth
                + " bh=" + boardHeight
                + " grid=" + packedHex(board, "P", boardWidth * boardHeight)
                + " pw=" + pieceWidth
                + " ph=" + pieceHeight
                + " piece=" + packedHex(board, "T", pieceWidth * pieceHeight)
                + " x=" + i(board, "q")
                + " y=" + i(board, "L")
                + " orient=" + (i(board, "ab") & 3)
                + " drop=" + i(board, "e")
                + " forced=" + i(board, "Ab")
                + " base=" + i(board, "g")
                + " prev=" + (i(board, "A") & 31)
                + " repeat=" + i(board, "Cb")
                + " hp=" + i(board, "o")
                + " vp=" + i(board, "db")
                + " grounded=" + z(board, "y");
    }

    private static String packedHex(Object owner, String fieldName, int limit) {
        StringBuilder out = new StringBuilder();
        try {
            Field f = field(owner, fieldName);
            Object array = f == null ? null : f.get(owner);
            int length = array == null ? 0 : java.lang.reflect.Array.getLength(array);
            int count = Math.max(0, Math.min(length, limit));
            for (int index = 0; index < count; index++) {
                int value = java.lang.reflect.Array.getInt(array, index) & 31;
                if (value < 16) out.append('0');
                out.append(Integer.toHexString(value));
            }
        } catch (Throwable ignored) {}
        return out.toString();
    }

    // ------------------------------------------------------------------
    // Incoming-garbage STAGING AREA lifecycle
    //
    // Vocabulary, all confirmed against the shipped bytecode rather than the
    // decompiled source:
    //
    //   lk.X   rf[]  the staging queue; it starts life one element long and is
    //                doubled in place by lk.a(rf,byte) when it fills up
    //   lk.t   int   how many of lk.X are live -- the render loops [0, t)
    //   lk.wb  int   next shape's approach delay; set to 18 at reset, bumped by
    //                3 per append, ticked back down towards 18 once per frame
    //   lk.m   int   how many shapes have left the queue; also rotates the ring
    //                the staging area is drawn on
    //   rf.l   int   this shape's approach countdown, seeded from lk.wb.  The
    //                renderer offsets the shape by 8192*l, so a big l parks it
    //                far off-screen: a staged shape is only VISIBLE near l==0
    //   rf.e   int   0 = pending; lk.b() makes it 1 and lk.s() then increments
    //                it every frame until it hits 13, when lk.p() dequeues it
    //   rf.c   byte[] per-cell colour; the renderer SKIPS any entry whose c is
    //                null, so such an entry is staged-but-invisible forever
    // ------------------------------------------------------------------

    /** One queue entry, in a form a log parser can split on ';' then ','. */
    private static String entry(int index, Object shape) {
        if (shape == null) return index + ",null";
        byte[] cells = null;
        try {
            Field f = field(shape, "c");
            cells = f == null ? null : (byte[]) f.get(shape);
        } catch (Throwable ignored) {}
        int filled = 0;
        java.util.TreeSet<Integer> colours = new java.util.TreeSet<Integer>();
        if (cells != null) {
            for (int k = 0; k < cells.length; k++) {
                int c = cells[k] & 255;
                if (c != 0) { filled++; colours.add(Integer.valueOf(c)); }
            }
        }
        return index
                + ",id=" + i(shape, "j")
                + ",e=" + i(shape, "e")
                + ",l=" + i(shape, "l")
                + ",m=" + i(shape, "m")
                + ",wh=" + i(shape, "b") + "x" + i(shape, "n")
                + ",cells=" + (cells == null ? "NULL" : String.valueOf(filled))
                + ",colours=" + (cells == null ? "NULL" : colours.toString().replace(" ", ""));
    }

    /** The whole live part of lk.X, [0, lk.t). */
    private static String entries(Object board) {
        StringBuilder sb = new StringBuilder();
        try {
            Field f = field(board, "X");
            Object arr = f == null ? null : f.get(board);
            int len = arr == null ? 0 : java.lang.reflect.Array.getLength(arr);
            int t = i(board, "t");
            for (int k = 0; k < t && k < len; k++) {
                if (sb.length() > 0) sb.append(';');
                sb.append(entry(k, java.lang.reflect.Array.get(arr, k)));
            }
        } catch (Throwable t) {
            sb.append("err");
        }
        return "[" + sb + "]";
    }

    /** Entries still waiting for a release, i.e. rf.e == 0. */
    private static int pending(Object board) {
        int n = 0;
        try {
            Field f = field(board, "X");
            Object arr = f == null ? null : f.get(board);
            int len = arr == null ? 0 : java.lang.reflect.Array.getLength(arr);
            int t = i(board, "t");
            for (int k = 0; k < t && k < len; k++) {
                Object s = java.lang.reflect.Array.get(arr, k);
                if (s != null && i(s, "e") == 0) n++;
            }
        } catch (Throwable t) {
            return -1;
        }
        return n;
    }

    /** Queue header shared by every staging line. */
    private static String q(Object board) {
        return "board=" + Integer.toHexString(System.identityHashCode(board))
                + " t=" + i(board, "t")
                + " cap=" + arrayLen(board, "X")
                + " wb=" + i(board, "wb")
                + " m=" + i(board, "m")
                + " pending=" + pending(board);
    }

    /**
     * The first frame outside this class.  lk.b() is reached both from the S2C
     * 66 handler in `client` and from qc's spawn path, and lk.a(rf,byte) is
     * called by lk itself as well as by the packet handler, so an untagged line
     * cannot be attributed to a packet.
     */
    private static String caller() {
        try {
            StackTraceElement[] frames = new Throwable().getStackTrace();
            for (int k = 0; k < frames.length; k++) {
                if (!"GarbageTrace".equals(frames[k].getClassName())) {
                    return frames[k].getClassName() + "." + frames[k].getMethodName();
                }
            }
        } catch (Throwable ignored) {}
        return "?";
    }

    /** S2C 67 parsed: the shape as it came off the wire, before the append. */
    public static void recv67(int slot, Object shape) {
        try {
            say("G67     slot=" + slot + " shape={" + entry(-1, shape) + "}");
        } catch (Throwable ignored) {}
    }

    /** S2C 66 parsed: how many releases the server asked for, and how many the
     *  queue can actually satisfy (lk.b throws IllegalStateException if asked
     *  for more than are pending). */
    public static void recv66(int slot, int count, Object board) {
        try {
            say("G66     slot=" + slot + " count=" + count + " " + q(board)
                    + " entries=" + entries(board));
        } catch (Throwable ignored) {}
    }

    public static void stageBefore(Object board, Object shape) {
        try {
            say("STAGE<  " + q(board) + " via=" + caller()
                    + " shape={" + entry(-1, shape) + "}"
                    + " entries=" + entries(board));
        } catch (Throwable ignored) {}
    }

    public static void stageAfter(Object board, Object shape) {
        try {
            say("STAGE>  " + q(board)
                    + " shape={" + entry(-1, shape) + "}"
                    + " entries=" + entries(board));
        } catch (Throwable ignored) {}
    }

    public static void releaseBefore(Object board, int cookie) {
        try {
            say("REL<    " + q(board) + " cookie=" + cookie + " via=" + caller()
                    + " entries=" + entries(board));
        } catch (Throwable ignored) {}
    }

    public static void releaseAfter(Object shape, Object board) {
        try {
            say("REL>    " + q(board)
                    + " released={" + entry(-1, shape) + "}"
                    + " entries=" + entries(board));
        } catch (Throwable ignored) {}
    }

    /** Last STGDRAW summary per board, so the every-frame renderer only speaks
     *  when its view of the queue actually changes. */
    private static final java.util.Map<Object, String> DRAW_LAST =
            new java.util.IdentityHashMap<Object, String>();

    /**
     * qc.a(lk,int,int,int,int,boolean,int,int) -- the staging-area renderer.
     *
     * It iterates i in [0, lk.t) over lk.X[i], skips any entry whose rf.c is
     * null, and otherwise draws the shape's cells at a vertical offset of
     * 8192*rf.l on a ring position derived from (lk.m + i) & 15.  So `drawn` is
     * how many entries it believes it should paint, `nocells` how many it
     * silently discards, and `far` how many it paints so far away they are not
     * on screen yet.
     */
    public static void stagingDraw(Object board) {
        try {
            int t = i(board, "t");
            int drawn = 0, nocells = 0, far = 0;
            StringBuilder shape = new StringBuilder();
            Field f = field(board, "X");
            Object arr = f == null ? null : f.get(board);
            int len = arr == null ? 0 : java.lang.reflect.Array.getLength(arr);
            for (int k = 0; k < t && k < len; k++) {
                Object s = java.lang.reflect.Array.get(arr, k);
                boolean hasCells = false;
                if (s != null) {
                    try {
                        Field cf = field(s, "c");
                        hasCells = cf != null && cf.get(s) != null;
                    } catch (Throwable ignored) {}
                }
                int l = s == null ? -1 : i(s, "l");
                if (!hasCells) nocells++; else { drawn++; if (l > 0) far++; }
                shape.append(i(s, "j")).append('/').append(i(s, "e"))
                     .append('/').append(hasCells ? 'c' : 'N')
                     .append('/').append(l > 0 ? "far" : "near").append(' ');
            }
            String key = t + "|" + shape;
            if (key.equals(DRAW_LAST.get(board))) return;
            DRAW_LAST.put(board, key);
            say("STGDRAW " + q(board)
                    + " drawn=" + drawn + " nocells=" + nocells + " far=" + far
                    + " entries=" + entries(board));
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
            // One LOCK line per board per tick drowns everything else at ~50
            // lines/second/board.  The SIG dumps above are what diff_boards.py
            // consumes, so they always run; the per-tick line is opt-in with
            // CT_LOCK=1 for when the lock routine itself is the question.
            if (!LOCK_LINES) return;
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
