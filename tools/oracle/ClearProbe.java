import java.lang.reflect.*;
import java.util.*;

/**
 * Ground-truth probe for the COLOUR-CLEAR rule of the original dekobloko
 * client.
 *
 * Two entry points, both driving the unmodified jar:
 *
 *   detect <pattern>  -- replays exactly the seed loop of
 *                        lk.a(oi,int,boolean,lk) states 106..122, i.e.
 *                        for (i = 0; i < w*h; i++)
 *                            n = lk.SA(true, 2, 4, null, true, -1, i, 1,
 *                                      null, false, 71);
 *                        and dumps the cell tags (bits 28-30) and the visited
 *                        flag (bit 31) after every seed, so the group
 *                        decomposition is observed directly.
 *
 *   tick <pattern>    -- drives the whole tick, lk.a(oi,127,false,null), with
 *                        field_ib = 2 (the "settled, look for matches" phase),
 *                        repeatedly, so the mark/animate/collapse cycle is
 *                        observed end to end.
 *
 *   batch/settle      -- the same two, one board per stdin line, for
 *                        differential fuzzing against the Python engine.
 *
 * Pattern syntax (rows separated by '/'):
 *   .      empty
 *   a..g   ordinary colours 16..22
 *   h      wildcard 23
 *   A..H   "solid" cells 8..15
 *   0..7   powerups 24..31
 *
 * ALWAYS run with -XX:-OmitStackTraceInFastThrow. `settle` tolerates exactly
 * one failure -- the missing audio subsystem -- and identifies it by the top
 * frame of the NPE the obfuscator wrapped. After a few thousand boards HotSpot
 * recompiles that implicit throw to a preallocated, stack-trace-less
 * exception, the identification silently fails, and the run degrades into a
 * flood of bogus mismatches partway through. That looked exactly like a real
 * divergence for one whole debugging round.
 */
public class ClearProbe {

    static sun.misc.Unsafe unsafe() throws Exception {
        Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
        f.setAccessible(true);
        return (sun.misc.Unsafe) f.get(null);
    }

    static Field field(Class<?> c, String name) throws Exception {
        try {
            Field f = c.getDeclaredField(name);
            f.setAccessible(true);
            return f;
        } catch (NoSuchFieldException e) {
            String alt = name.startsWith("field_") ? name.substring(6) : "field_" + name;
            Field f = c.getDeclaredField(alt);
            f.setAccessible(true);
            return f;
        }
    }

    static void setInt(Object o, String n, int v) throws Exception {
        field(o.getClass(), n).setInt(o, v);
    }

    static void setBool(Object o, String n, boolean v) throws Exception {
        field(o.getClass(), n).setBoolean(o, v);
    }

    static void setObj(Object o, String n, Object v) throws Exception {
        field(o.getClass(), n).set(o, v);
    }

    static int getInt(Object o, String n) throws Exception {
        return field(o.getClass(), n).getInt(o);
    }

    static int cellOf(char c) {
        if (c == '.') return 0;
        if (c >= 'a' && c <= 'h') return 16 + (c - 'a');
        if (c >= 'A' && c <= 'H') return 8 + (c - 'A');
        if (c >= '0' && c <= '7') return 24 + (c - '0');
        throw new IllegalArgumentException("bad cell char " + c);
    }

    static char charOf(int v) {
        if (v == 0) return '.';
        if (v >= 16 && v <= 23) return (char) ('a' + v - 16);
        if (v >= 8 && v <= 15) return (char) ('A' + v - 8);
        if (v >= 24 && v <= 31) return (char) ('0' + v - 24);
        return '?';
    }

    /** lk with just the fields the clear reads. */
    static Object makeBoard(int w, int h) throws Exception {
        Object b = unsafe().allocateInstance(Class.forName("lk"));
        setInt(b, "field_O", w);
        setInt(b, "field_a", h);
        setObj(b, "field_P", new int[w * h]);
        setObj(b, "field_w", new int[w * h]);
        setInt(b, "field_U", -1);
        setInt(b, "field_t", 0);
        setInt(b, "field_jb", 3);
        setInt(b, "field_D", 0);      // feedback level; >= param7 sends shapes
        setInt(b, "field_l", 0);      // slide direction
        setInt(b, "field_k", 0);      // sound volume base
        setBool(b, "field_v", false);
        setBool(b, "field_s", false);
        setBool(b, "field_kb", false);
        setObj(b, "field_rb", null);  // no score-popup sink
        setObj(b, "field_N", null);
        return b;
    }

    static void load(Object board, String pattern, int w, int h) throws Exception {
        int[] p = (int[]) field(board.getClass(), "field_P").get(board);
        Arrays.fill(p, 0);
        String[] rows = pattern.split("/");
        // Bottom-align the pattern, which is where a real bucket holds cells.
        int top = h - rows.length;
        for (int r = 0; r < rows.length; r++) {
            String row = rows[r];
            for (int x = 0; x < row.length() && x < w; x++) {
                p[x + w * (top + r)] = cellOf(row.charAt(x));
            }
        }
    }

    static String dumpValues(Object board) throws Exception {
        int w = getInt(board, "field_O"), h = getInt(board, "field_a");
        int[] p = (int[]) field(board.getClass(), "field_P").get(board);
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < h; y++) {
            boolean empty = true;
            StringBuilder row = new StringBuilder();
            for (int x = 0; x < w; x++) {
                int raw = p[x + w * y];
                int v = raw & 0x0FFFFFFF;
                row.append(v >= 32 ? '*' : charOf(v));
                if (raw != 0) empty = false;
            }
            if (!empty || y >= h - 6) sb.append(String.format("  %2d %s%n", y, row));
        }
        return sb.toString();
    }

    /** tag = bits 28-30 (match counter), visited = bit 31. */
    static String dumpTags(Object board) throws Exception {
        int w = getInt(board, "field_O"), h = getInt(board, "field_a");
        int[] p = (int[]) field(board.getClass(), "field_P").get(board);
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < h; y++) {
            boolean any = false;
            StringBuilder row = new StringBuilder();
            for (int x = 0; x < w; x++) {
                int raw = p[x + w * y];
                int tag = (raw & 0x70000000) >>> 28;
                boolean seen = raw < 0;
                if (raw == 0) { row.append('.'); continue; }
                any = true;
                row.append(tag > 0 ? (char) ('0' + tag) : (seen ? 'v' : '-'));
            }
            if (any) sb.append(String.format("  %2d %s%n", y, row));
        }
        return sb.toString();
    }

    static Method floodMethod() throws Exception {
        Method m = Class.forName("lk").getDeclaredMethod("a",
                boolean.class, int.class, int.class, Class.forName("lk"),
                boolean.class, int.class, int.class, int.class,
                Class.forName("oi"), boolean.class, byte.class);
        m.setAccessible(true);
        return m;
    }

    static Method commitMethod() throws Exception {
        Method m = Class.forName("lk").getDeclaredMethod(
                "a", int.class, boolean.class, int.class);
        m.setAccessible(true);
        return m;
    }

    static Method tickMethod() throws Exception {
        Method m = Class.forName("lk").getDeclaredMethod("a",
                Class.forName("oi"), int.class, boolean.class, Class.forName("lk"));
        m.setAccessible(true);
        return m;
    }

    /**
     * True for the audio-only failure described at the call site: the
     * obfuscator's `jb` wrapper around an NPE whose real top frame is ei.c,
     * the sound-stream factory. Any other throwable is a genuine defect and
     * must not be swallowed.
     */
    static boolean isSoundFailure(Throwable t) throws Exception {
        Throwable c = t instanceof InvocationTargetException
                ? ((InvocationTargetException) t).getTargetException() : t;
        if (!c.getClass().getName().equals("jb")) return false;
        for (Field f : c.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            Object v = f.get(c);
            if (v instanceof Throwable) {
                StackTraceElement[] fr = ((Throwable) v).getStackTrace();
                if (fr.length > 0 && fr[0].getClassName().equals("ei")
                        && fr[0].getMethodName().equals("c")) {
                    return true;
                }
            }
        }
        return false;
    }

    static void unwrap(Throwable t, String prefix) throws Exception {
        Throwable c = t instanceof InvocationTargetException
                ? ((InvocationTargetException) t).getTargetException() : t;
        System.out.println(prefix + " FAILED " + c);
        for (Field f : c.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            System.out.println("      " + f.getName() + " = " + f.get(c));
        }
        StackTraceElement[] fr = c.getStackTrace();
        for (int i = 0; i < Math.min(6, fr.length); i++) {
            System.out.println("      at " + fr[i]);
        }
    }

    /**
     * The detection pass, seed by seed, with the same arguments the tick uses
     * (lk.java:3419).  Prints the group each seed produced.
     */
    static void detect(Object board, boolean verbose) throws Exception {
        int w = getInt(board, "field_O"), h = getInt(board, "field_a");
        int[] p = (int[]) field(board.getClass(), "field_P").get(board);
        int[] queue = (int[]) field(board.getClass(), "field_w").get(board);
        Method flood = floodMethod();
        int groups = 0;
        for (int i = 0; i < w * h; i++) {
            int[] before = p.clone();
            Object r = flood.invoke(board, true, 2, 4, null, true, -1, i, 1,
                    null, false, (byte) 71);
            int n = ((Integer) r).intValue();
            if (n > 0) {
                groups++;
                List<String> cells = new ArrayList<String>();
                for (int j = 0; j < w * h; j++) {
                    if (((p[j] & 0x70000000) != 0) && ((before[j] & 0x70000000) == 0)) {
                        cells.add("(" + (j % w) + "," + (j / w) + ")");
                    }
                }
                System.out.println("  seed " + i + " (" + (i % w) + "," + (i / w)
                        + ") value=" + charOf(before[i] & 31)
                        + " -> returned " + n + " newly tagged=" + cells.size()
                        + " " + cells);
            } else if (verbose && (before[i] & 0x0FFFFFFF) != 0) {
                System.out.println("  seed " + i + " (" + (i % w) + "," + (i / w)
                        + ") value=" + charOf(before[i] & 31) + " -> 0");
            }
        }
        System.out.println("  groups=" + groups);
    }

    static void runDetect(String pattern, int w, int h, boolean verbose) throws Exception {
        Object board = makeBoard(w, h);
        load(board, pattern, w, h);
        System.out.println("PATTERN " + pattern + "  (" + w + "x" + h + ")");
        System.out.print(dumpValues(board));
        detect(board, verbose);
        System.out.println("  tags/visited after the seed loop:");
        System.out.print(dumpTags(board));
        // The commit pass: tagged -> 32 | (cell & 0x0FFFFFFF), untagged ->
        // cell & 0x7FFFFFFF, field_ib = param2.
        try {
            commitMethod().invoke(board, -99, false, 1);
            System.out.println("  after commit (field_ib=" + getInt(board, "field_ib")
                    + "), '*' = marked popping:");
            System.out.print(dumpValues(board));
        } catch (Throwable t) {
            unwrap(t, "  commit");
        }
    }

    static void runTick(String pattern, int w, int h, int ticks) throws Exception {
        Object board = makeBoard(w, h);
        load(board, pattern, w, h);
        Method tick = tickMethod();
        System.out.println("PATTERN " + pattern + "  (" + w + "x" + h + ")");
        System.out.print(dumpValues(board));
        setInt(board, "field_ib", 2);
        String last = null;
        for (int t = 0; t < ticks; t++) {
            try {
                tick.invoke(board, null, 127, false, null);
            } catch (Throwable e) {
                unwrap(e, "  tick " + t);
                return;
            }
            String now = dumpValues(board);
            if (!now.equals(last)) {
                System.out.println("  tick " + t + " field_ib=" + getInt(board, "field_ib"));
                System.out.print(now);
                last = now;
            }
        }
    }

    /**
     * Stream mode for differential fuzzing.
     *
     * stdin:  "<w> <h> <w*h chars, row major>"
     * stdout: "<sorted indices the detection pass tagged>" (empty if none)
     *
     * One line in, one line out, so a Python driver can compare the engine's
     * rule against the real client's over thousands of random boards without
     * paying JVM startup each time.
     */
    static void batch() throws Exception {
        Scanner in = new Scanner(System.in);
        Method flood = floodMethod();
        while (in.hasNextLine()) {
            String line = in.nextLine().trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("\\s+");
            int w = Integer.parseInt(parts[0]);
            int h = Integer.parseInt(parts[1]);
            String cells = parts[2];
            Object board = makeBoard(w, h);
            int[] p = (int[]) field(board.getClass(), "field_P").get(board);
            for (int i = 0; i < w * h; i++) p[i] = cellOf(cells.charAt(i));
            StringBuilder out = new StringBuilder();
            try {
                for (int i = 0; i < w * h; i++) {
                    flood.invoke(board, true, 2, 4, null, true, -1, i, 1,
                            null, false, (byte) 71);
                }
                for (int i = 0; i < w * h; i++) {
                    if ((p[i] & 0x70000000) != 0) {
                        if (out.length() > 0) out.append(',');
                        out.append(i);
                    }
                }
            } catch (Throwable t) {
                out.setLength(0);
                out.append("ERROR");
            }
            System.out.println(out.length() == 0 ? "-" : out.toString());
            System.out.flush();
        }
    }

    /**
     * Stream mode for the WHOLE settle cycle: mark, animate, collapse,
     * re-detect, until the board stops changing.
     *
     * stdin:  "<w> <h> <w*h chars, row major>"
     * stdout: "<w*h chars>" -- the resting board
     *
     * This is the end-to-end behaviour the Python engine's finalize() has to
     * reproduce, so it is what the engine is actually compared against.
     */
    static void batchSettle() throws Exception {
        Scanner in = new Scanner(System.in);
        Method tick = tickMethod();
        while (in.hasNextLine()) {
            String line = in.nextLine().trim();
            if (line.isEmpty()) continue;
            String[] parts = line.split("\\s+");
            int w = Integer.parseInt(parts[0]);
            int h = Integer.parseInt(parts[1]);
            String cells = parts[2];
            Object board = makeBoard(w, h);
            int[] p = (int[]) field(board.getClass(), "field_P").get(board);
            for (int i = 0; i < w * h; i++) p[i] = cellOf(cells.charAt(i));
            // field_ib = 0 is the phase a freshly spawned piece leaves behind
            // (lk.a state 307 sets field_S/field_s false, field_ib 0), so the
            // GRAVITY pass runs before the first detection -- the production
            // order. Starting at 2 would detect matches among cells that are
            // still in mid-air, which never happens in a real match.
            setInt(board, "field_ib", 0);
            String out;
            boolean muted = false;
            try {
                int stable = 0;
                String last = null;
                for (int t = 0; t < 4000 && stable < 40; t++) {
                    try {
                        tick.invoke(board, null, 127, false, null);
                    } catch (Throwable e) {
                        // The ONLY tolerated failure is the fall/clear sound,
                        // lk.a state 90: ei.c(ud,int,int,int) with no audio
                        // subsystem loaded. It is raised after the gravity
                        // pass has already written field_P, and the states it
                        // skips (92-144 sound, 238-302 bomb/water/poison,
                        // all inert here) touch neither field_P nor field_ib.
                        // Anything else is a real failure and is reported.
                        if (!isSoundFailure(e)) throw e;
                        muted = true;
                    }
                    String now = Arrays.toString(p);
                    stable = now.equals(last) ? stable + 1 : 0;
                    last = now;
                }
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < w * h; i++) sb.append(charOf(p[i] & 0x0FFFFFFF));
                out = (muted ? "~" : "=") + sb.toString();
            } catch (Throwable t) {
                Throwable c = t instanceof InvocationTargetException
                        ? ((InvocationTargetException) t).getTargetException() : t;
                StringBuilder sb = new StringBuilder("ERROR ").append(c);
                for (Field f : c.getClass().getDeclaredFields()) {
                    if (Modifier.isStatic(f.getModifiers())) continue;
                    f.setAccessible(true);
                    Object v = f.get(c);
                    sb.append(" | ").append(f.getName()).append('=').append(v);
                    if (v instanceof Throwable) {
                        for (StackTraceElement e2 : ((Throwable) v).getStackTrace()) {
                            sb.append(" >> ").append(e2);
                        }
                    }
                }
                StackTraceElement[] fr = c.getStackTrace();
                for (int i = 0; i < Math.min(3, fr.length); i++) {
                    sb.append(" @ ").append(fr[i]);
                }
                out = sb.toString();
            }
            System.out.println(out);
            System.out.flush();
        }
    }

    public static void main(String[] args) throws Exception {
        String mode = args.length > 0 ? args[0] : "cases";
        int w = 8, h = 18;
        if (mode.equals("batch")) {
            batch();
        } else if (mode.equals("settle")) {
            batchSettle();
        } else if (mode.equals("detect") || mode.equals("detectv")) {
            runDetect(args[1], w, h, mode.equals("detectv"));
        } else if (mode.equals("tick")) {
            runTick(args[1], w, h, args.length > 2 ? Integer.parseInt(args[2]) : 60);
        } else {
            String[] cases = {
                "aaaa",                     // 4 in a row
                "aaa",                      // 3 in a row - below the minimum
                "aa/aa",                    // 2x2 square
                "aaa/a...",                 // L of 4
                "abab/abab",                // interleaved colours
                "aah/haa",                  // wildcards bridging
                "aaha/....",                // wildcard inside a run
                "hhhh",                     // wildcards only
                "aaaaa/aaaaa",              // 10 cells, one colour
                "aaaa/bbbb",                // two groups, different colours
                "aaaabbbb",                 // two groups on one row
            };
            for (String c : cases) {
                runDetect(c, w, h, false);
                System.out.println();
            }
        }
    }
}
