import java.lang.reflect.*;
import java.util.*;

/**
 * Differential ground-truth probe for the ORIGINAL dekobloko lk class.
 *
 * Installs an arbitrary rf shape as the active piece via lk.a(int,int,rf) and
 * dumps every instance int field, so the Python engine's generalized
 * ActiveDomino can be asserted against the real client rather than guessed.
 *
 * No game state is required: lk is allocated without running its constructor
 * and only the fields lk.a(int,int,rf) actually reads are seeded.
 */
public class ParityProbe {

    static sun.misc.Unsafe unsafe() throws Exception {
        Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
        f.setAccessible(true);
        return (sun.misc.Unsafe) f.get(null);
    }

    static Object alloc(Class<?> c) throws Exception {
        return unsafe().allocateInstance(c);
    }

    /**
     * The deobfuscation pipeline renames the original's fields by prefixing
     * "field_" (zb -> field_zb). Accept either spelling so one probe runs
     * against both the original jar and the recompiled build.
     */
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

    /** Canonical (field_-prefixed) name, so both jars print identically. */
    static String canon(String name) {
        return name.startsWith("field_") ? name : "field_" + name;
    }

    static void setInt(Object o, String name, int v) throws Exception {
        field(o.getClass(), name).setInt(o, v);
    }

    static void setObj(Object o, String name, Object v) throws Exception {
        field(o.getClass(), name).set(o, v);
    }

    /** Every instance int field, sorted by name. */
    static Map<String, Integer> intFields(Object o) throws Exception {
        Map<String, Integer> out = new TreeMap<String, Integer>();
        for (Field f : o.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            if (f.getType() != int.class) continue;
            f.setAccessible(true);
            out.put(canon(f.getName()), f.getInt(o));
        }
        return out;
    }

    /**
     * Build an rf holding a width x height bitmap. cells are the 5-bit rf
     * vocabulary values; 0 means a hole in the bounding box.
     */
    static Object makeShape(int id, int width, int height, int[] cells) throws Exception {
        Class<?> rf = Class.forName("rf");
        Object shape = alloc(rf);
        byte[] packed = new byte[cells.length];
        for (int i = 0; i < cells.length; i++) packed[i] = (byte) cells[i];
        setObj(shape, "field_c", packed);
        setInt(shape, "field_b", width);   // width
        setInt(shape, "field_n", height);  // height
        setInt(shape, "field_e", 0);       // release counter
        setInt(shape, "field_m", id);
        return shape;
    }

    /**
     * A bare lk with only the state lk.a(int,int,rf) reads: board dimensions
     * (field_a = width, field_O = height) plus the grids it indexes.
     */
    static Object makeBoard(boolean large) throws Exception {
        Class<?> lk = Class.forName("lk");
        Object b = alloc(lk);
        // Per the lk constructor: large -> field_O=12, field_a=27;
        // small -> field_O=8, field_a=18. So field_O is WIDTH, field_a HEIGHT.
        int w = large ? 12 : 8;
        int h = large ? 27 : 18;
        setInt(b, "field_O", w);
        setInt(b, "field_a", h);
        setObj(b, "field_P", new int[w * h]);
        setObj(b, "field_w", new int[w * h]);
        setInt(b, "field_U", -1);
        setInt(b, "field_t", 0);
        setObj(b, "field_X", Array.newInstance(Class.forName("rf"), 1));
        setInt(b, "field_jb", 3);
        return b;
    }

    static void install(Object board, Object shape) throws Exception {
        // param0 > 73 takes the branch that skips this.a(false), which needs
        // rendering state we deliberately have not built.
        Method m = Class.forName("lk").getDeclaredMethod(
                "a", int.class, int.class, Class.forName("rf"));
        m.setAccessible(true);
        m.invoke(board, 127, 0, shape);
    }

    static String describe(int width, int height, int[] cells) {
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) sb.append(cells[y * width + x] == 0 ? '.' : '#');
            if (y + 1 < height) sb.append('/');
        }
        return sb.toString();
    }

    static void probe(String label, boolean large, int width, int height, int[] cells) {
        try {
            Object board = makeBoard(large);
            Object shape = makeShape(1, width, height, cells);
            Map<String, Integer> before = intFields(board);
            install(board, shape);
            Map<String, Integer> after = intFields(board);

            StringBuilder diff = new StringBuilder();
            for (Map.Entry<String, Integer> e : after.entrySet()) {
                Integer b = before.get(e.getKey());
                if (b == null || !b.equals(e.getValue())) {
                    if (diff.length() > 0) diff.append(' ');
                    diff.append(e.getKey()).append('=').append(e.getValue());
                }
            }
            System.out.println("SHAPE " + label
                    + " bucket=" + (large ? "large" : "small")
                    + " dims=" + width + "x" + height
                    + " map=" + describe(width, height, cells)
                    + " | " + diff);
        } catch (Throwable t) {
            Throwable c = t;
            while (c.getCause() != null) c = c.getCause();
            System.out.println("SHAPE " + label + " FAILED " + c);
        }
    }

    static int[] filled(int width, int height, int cell) {
        int[] c = new int[width * height];
        Arrays.fill(c, cell);
        return c;
    }

    /** Read one int field by canonical name, tolerating either spelling. */
    static int get(Object o, String name) throws Exception {
        return field(o.getClass(), name).getInt(o);
    }

    /** Tight bounding box: every edge row and column must contain a cell. */
    static boolean tight(int width, int height, int[] cells) {
        boolean top = false, bottom = false, left = false, right = false;
        for (int x = 0; x < width; x++) {
            if (cells[x] != 0) top = true;
            if (cells[(height - 1) * width + x] != 0) bottom = true;
        }
        for (int y = 0; y < height; y++) {
            if (cells[y * width] != 0) left = true;
            if (cells[y * width + width - 1] != 0) right = true;
        }
        return top && bottom && left && right;
    }

    /** 4-connectivity, matching how the engine derives a returned shape. */
    static boolean connected(int width, int height, int[] cells) {
        int start = -1, total = 0;
        for (int i = 0; i < cells.length; i++) {
            if (cells[i] != 0) { total++; if (start < 0) start = i; }
        }
        if (total == 0) return false;
        boolean[] seen = new boolean[cells.length];
        Deque<Integer> stack = new ArrayDeque<Integer>();
        stack.push(start);
        seen[start] = true;
        int found = 0;
        while (!stack.isEmpty()) {
            int i = stack.pop();
            found++;
            int x = i % width, y = i / width;
            int[][] step = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
            for (int[] d : step) {
                int nx = x + d[0], ny = y + d[1];
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                int j = ny * width + nx;
                if (cells[j] == 0 || seen[j]) continue;
                seen[j] = true;
                stack.push(j);
            }
        }
        return found == total;
    }

    static void emit(boolean large, int w, int h, int[] cells) throws Exception {
        Object board = makeBoard(large);
        install(board, makeShape(1, w, h, cells));
        System.out.println(
                (large ? "large" : "small")
                + "\t" + w + "\t" + h
                + "\t" + describe(w, h, cells)
                + "\t" + get(board, "field_q")
                + "\t" + get(board, "field_L")
                + "\t" + get(board, "field_db")
                + "\t" + get(board, "field_o")
                + "\t" + get(board, "field_e")
                + "\t" + get(board, "field_Ab"));
    }

    /**
     * Golden table over the shapes _shape_from_positions can actually emit.
     *
     * That function takes the tight bounding box of whatever cells a clear
     * removed, so the space is wider than it first looks:
     *   - the box runs to the bucket width and the board height (a drill
     *     clears a whole column, giving 1 x 18 / 1 x 27),
     *   - the cells need NOT be 4-connected. A bomb unit is a loose component
     *     unioned with every touching solid's full extent, and at feedback
     *     level >= 2 a match is unioned with whole solids, either of which can
     *     leave disjoint islands in one shape.
     *
     * So: exhaust the small boxes (connected AND disconnected), enumerate the
     * degenerate full-row / full-column strips up to the real board bounds,
     * and sample larger boxes deterministically.
     */
    static void sweep() throws Exception {
        System.out.println("# bucket\twidth\theight\tmap\tx\ty\th_parity\tv_parity\tdrop\tforced_drop");
        for (boolean large : new boolean[]{false, true}) {
            int bw = large ? 12 : 8;
            int bh = large ? 27 : 18;

            // 1. Exhaustive over every tight bitmap in a 4x4 box, including
            //    disconnected ones.
            for (int h = 1; h <= 4; h++) {
                for (int w = 1; w <= 4; w++) {
                    int n = w * h;
                    for (int mask = 1; mask < (1 << n); mask++) {
                        int[] cells = new int[n];
                        for (int i = 0; i < n; i++) {
                            cells[i] = ((mask >> i) & 1) != 0 ? 24 : 0;
                        }
                        if (!tight(w, h, cells)) continue;
                        emit(large, w, h, cells);
                    }
                }
            }

            // 2. Degenerate strips at full board scale: drills and full-row
            //    clears reach these and nothing in step 1 does.
            for (int h = 5; h <= bh; h++) emit(large, 1, h, filled(1, h, 24));
            for (int w = 5; w <= bw; w++) emit(large, w, 1, filled(w, 1, 24));

            // 3. Deterministic sample of large boxes, half of them forced to
            //    contain a gap so disconnected islands are represented.
            Random rng = new Random(large ? 0x5EEDL : 0xC0FFEEL);
            for (int trial = 0; trial < 4000; trial++) {
                int w = 1 + rng.nextInt(bw);
                int h = 1 + rng.nextInt(bh);
                int n = w * h;
                if (n < 2) continue;
                int[] cells = new int[n];
                int density = 1 + rng.nextInt(9);
                for (int i = 0; i < n; i++) {
                    cells[i] = rng.nextInt(10) < density ? 24 : 0;
                }
                if (!tight(w, h, cells)) continue;
                if (trial % 2 == 0 && connected(w, h, cells)) continue;
                emit(large, w, h, cells);
            }
        }
    }

    /**
     * Does the install depend on the CELL VALUE, or only on occupancy?
     *
     * It matters because the rf 5-bit vocabulary mixes ordinary colours with
     * powerups (23 wildcard, 24 earthquake, 25 drill, 26 bomb, 27 power drill,
     * 28 water, 29 poison) and cooked garbage cells (8|colour). lk stores
     * field_T[i] = 255 & cell, so a value-sensitive install would make a
     * golden table generated with one cell value worthless for the others.
     *
     * Replays a fixed set of bitmaps across the whole vocabulary and reports
     * any (x, y, parity) that differs from the cell=24 baseline.
     */
    static void cellValueSweep() throws Exception {
        int[][] shapes = {
            {2, 1}, {1, 2}, {2, 2}, {3, 2}, {2, 3}, {3, 3}, {4, 1}, {1, 4},
        };
        int[][] masks = {
            null,                       // solid rectangle
            {1, 0, 0, 1, 1, 1},         // L, only valid for 3x2
        };
        int mismatches = 0;
        for (boolean large : new boolean[]{false, true}) {
            for (int[] dim : shapes) {
                int w = dim[0], h = dim[1];
                for (int variant = 0; variant < masks.length; variant++) {
                    if (variant == 1 && !(w == 3 && h == 2)) continue;
                    String baseline = null;
                    for (int cell = 1; cell <= 31; cell++) {
                        int[] cells = new int[w * h];
                        for (int i = 0; i < cells.length; i++) {
                            boolean on = variant == 0 || masks[1][i] != 0;
                            cells[i] = on ? cell : 0;
                        }
                        if (!tight(w, h, cells)) continue;
                        Object board = makeBoard(large);
                        install(board, makeShape(1, w, h, cells));
                        String state = get(board, "field_q") + "," + get(board, "field_L")
                                + "," + get(board, "field_db") + "," + get(board, "field_o")
                                + "," + get(board, "field_e") + "," + get(board, "field_Ab");
                        if (baseline == null) {
                            baseline = state;
                        } else if (!baseline.equals(state)) {
                            mismatches++;
                            System.out.println("CELL-VALUE MISMATCH " + (large ? "large" : "small")
                                    + " " + w + "x" + h + " variant=" + variant
                                    + " cell=" + cell
                                    + " baseline=" + baseline + " got=" + state);
                        }
                    }
                }
            }
        }
        System.out.println("cell-value sweep mismatches=" + mismatches
                + " (0 means the install depends on occupancy only)");
    }

    /**
     * qc's obfuscation cookie is 2: qc.java:1629 calls lk.b(param0 - 19941)
     * and lk.b only yields a shape for -19939. qc.java:1534 then drives the
     * tick as d(controls, param0 - 1674843009).
     */
    static final int QC_COOKIE = 2;
    static final int TICK_COOKIE = QC_COOKIE + -1674843009;

    static final int LEFT = 1, RIGHT = 2, ROT_CCW = 4, ROT_CW = 8, FAST_DROP = 16;

    static void tick(Object board, int controls) throws Exception {
        Method m = Class.forName("lk").getDeclaredMethod("d", int.class, int.class);
        m.setAccessible(true);
        m.invoke(board, controls, TICK_COOKIE);
    }

    /**
     * lk.c(boolean) is the rotation itself -- lk.d dispatches to it on the
     * rotate bits (lk.java:1186, `var3 & 4 -> this.c(false)`). Calling it
     * directly skips the lk.i(0) render call in the same tick, which needs
     * sprite state this harness deliberately does not build.
     */
    static void rotate(Object board, boolean clockwise) throws Exception {
        Method m = Class.forName("lk").getDeclaredMethod("c", boolean.class);
        m.setAccessible(true);
        m.invoke(board, clockwise);
    }

    /**
     * The OTHER rotation direction. lk.d dispatches the two rotate bits to two
     * different methods: bit 4 -> lk.c(boolean) at bytecode offset 283, bit 8
     * -> lk.i(int) at offset 313. lk.c's boolean is not a direction flag.
     */
    static void rotateOther(Object board) throws Exception {
        Method m = Class.forName("lk").getDeclaredMethod("i", int.class);
        m.setAccessible(true);
        m.invoke(board, 0);
    }

    /** The active piece's live bitmap: field_T laid out field_C x field_zb. */
    static String activeMap(Object board) throws Exception {
        int w = get(board, "field_C"), h = get(board, "field_zb");
        int[] t = (int[]) field(board.getClass(), "field_T").get(board);
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) sb.append(t[y * w + x] == 0 ? '.' : '#');
            if (y + 1 < h) sb.append('/');
        }
        return sb.toString();
    }

    static String state(Object board) throws Exception {
        return "dims=" + get(board, "field_C") + "x" + get(board, "field_zb")
                + " map=" + activeMap(board)
                + " x=" + get(board, "field_q")
                + " y=" + get(board, "field_L")
                + " orient=" + get(board, "field_ab")
                + " hpar=" + get(board, "field_db")
                + " vpar=" + get(board, "field_o");
    }

    /**
     * Drive a cooked shape through rotations on an empty board and dump the
     * literal geometry each step, so the server's generalized rotation can be
     * checked against the real client instead of inferred.
     *
     * Gravity is parked (large drop and forced-drop counters) so each step
     * isolates the rotation.
     */
    /** Both directions from spawn, one step each, for a side-by-side compare. */
    static void directionCompare(String label, int w, int h, int[] cells) throws Exception {
        Object a = makeBoard(false);
        install(a, makeShape(1, w, h, cells));
        setInt(a, "field_e", 1 << 20);
        setInt(a, "field_Ab", 1 << 20);
        Object b = makeBoard(false);
        install(b, makeShape(1, w, h, cells));
        setInt(b, "field_e", 1 << 20);
        setInt(b, "field_Ab", 1 << 20);

        System.out.println("DIR " + label);
        System.out.println("    spawn        " + state(a));
        rotate(a, false);
        System.out.println("    bit4 c(bool) " + state(a));
        rotateOther(b);
        System.out.println("    bit8 i(int)  " + state(b));
    }

    static void rotationProbe(String label, boolean large, int w, int h, int[] cells,
                              boolean clockwise, int steps) throws Exception {
        Object board = makeBoard(large);
        install(board, makeShape(1, w, h, cells));
        setInt(board, "field_e", 1 << 20);   // drop countdown: never reaches 0
        setInt(board, "field_Ab", 1 << 20);  // forced drop: stays positive
        setInt(board, "field_A", 0);         // previous controls
        setInt(board, "field_Cb", 0);        // horizontal repeat

        System.out.println("ROT " + label + " " + (clockwise ? "CW" : "CCW")
                + " bucket=" + (large ? "large" : "small"));
        System.out.println("    spawn " + state(board));
        for (int i = 0; i < steps; i++) {
            try {
                rotate(board, clockwise);
                System.out.println("    rot" + (i + 1) + "  " + state(board));
            } catch (Throwable t) {
                Throwable cause = t instanceof InvocationTargetException
                        ? ((InvocationTargetException) t).getTargetException() : t;
                System.out.println("    rot" + (i + 1) + "  FAILED " + cause);
                // jb is the obfuscator's wrapper (dh.a(Throwable,String)->jb);
                // the real failure is stored in its fields, not as a cause.
                for (Field f : cause.getClass().getDeclaredFields()) {
                    if (Modifier.isStatic(f.getModifiers())) continue;
                    f.setAccessible(true);
                    System.out.println("        " + f.getName() + " = " + f.get(cause));
                }
                StackTraceElement[] frames = cause.getStackTrace();
                for (int f = 0; f < Math.min(4, frames.length); f++) {
                    System.out.println("        at " + frames[f]);
                }
                return;
            }
        }
    }

    static void rotations() throws Exception {
        int[] l32 = {24, 0, 0, 24, 24, 24};      // #../###
        int[] t32 = {24, 24, 24, 0, 24, 0};      // ###/.#.
        int[] s32 = {0, 24, 24, 24, 24, 0};      // .##/##.
        int[] j23 = {0, 24, 0, 24, 24, 24};      // .#/.#/##

        // Four rotations must return to the spawn geometry: that closure is the
        // cheapest check that the server's model can be made to agree.
        rotationProbe("domino-2x1", false, 2, 1, new int[]{16, 17}, true, 4);
        rotationProbe("square-2x2", false, 2, 2, filled(2, 2, 24), true, 4);
        rotationProbe("rect-3x2", false, 3, 2, filled(3, 2, 24), true, 4);
        rotationProbe("L-3x2", false, 3, 2, l32, true, 4);
        rotationProbe("L-3x2", false, 3, 2, l32, false, 4);
        rotationProbe("T-3x2", false, 3, 2, t32, true, 4);
        rotationProbe("S-3x2", false, 3, 2, s32, true, 4);
        rotationProbe("J-2x3", false, 2, 3, j23, true, 4);
        rotationProbe("strip-4x1", false, 4, 1, filled(4, 1, 24), true, 4);
        rotationProbe("rect-3x3", false, 3, 3, filled(3, 3, 24), true, 4);

        System.out.println();
        directionCompare("domino-2x1", 2, 1, new int[]{16, 17});
        directionCompare("L-3x2", 3, 2, l32);
        directionCompare("T-3x2", 3, 2, t32);
        directionCompare("J-2x3", 2, 3, j23);
    }

    /**
     * Golden table for BOTH rotation directions over every tight bitmap in a
     * 4x4 box, one step from spawn on an empty board.
     *
     * bit4 -> lk.c(boolean), bit8 -> lk.i(int). Emits the resulting geometry so
     * the server's _rotate can be checked in both directions.
     */
    static void rotationSweep() throws Exception {
        System.out.println("# bucket\twidth\theight\tmap\tdir\trw\trh\trmap\tx\ty\th_parity\tv_parity");
        for (boolean large : new boolean[]{false, true}) {
            for (int h = 1; h <= 4; h++) {
                for (int w = 1; w <= 4; w++) {
                    int n = w * h;
                    for (int mask = 1; mask < (1 << n); mask++) {
                        int[] cells = new int[n];
                        for (int i = 0; i < n; i++) {
                            cells[i] = ((mask >> i) & 1) != 0 ? 24 : 0;
                        }
                        if (!tight(w, h, cells)) continue;
                        for (String dir : new String[]{"bit4", "bit8"}) {
                            Object board = makeBoard(large);
                            install(board, makeShape(1, w, h, cells));
                            setInt(board, "field_e", 1 << 20);
                            setInt(board, "field_Ab", 1 << 20);
                            if (dir.equals("bit4")) rotate(board, false);
                            else rotateOther(board);
                            System.out.println(
                                    (large ? "large" : "small")
                                    + "\t" + w + "\t" + h + "\t" + describe(w, h, cells)
                                    + "\t" + dir
                                    + "\t" + get(board, "field_C")
                                    + "\t" + get(board, "field_zb")
                                    + "\t" + activeMap(board)
                                    + "\t" + get(board, "field_q")
                                    + "\t" + get(board, "field_L")
                                    + "\t" + get(board, "field_db")
                                    + "\t" + get(board, "field_o"));
                        }
                    }
                }
            }
        }
    }

    /**
     * Rotation against NON-EMPTY terrain -- the gap rotationSweep leaves open.
     *
     * rotsweep parks every shape on an empty bucket, so it never exercises a
     * kick or a reject in lk.t/q(). This seeds a floor with a carved pattern,
     * drops the piece directly onto it by assigning field_q/field_L (rather
     * than descending, which would confound the descent path with the kick),
     * and rotates once.
     *
     * Rows 16-17 are solid, row 15 carries a 6-bit pattern over x=1..6, and the
     * piece's bounding box sits immediately above at rows (14-h+1)..14.
     */
    static void kickSweep() throws Exception {
        System.out.println("# bucket\twidth\theight\tmap\tdir\tpx\tpy\tpattern"
                + "\trw\trh\trmap\tx\ty\th_parity\tv_parity\torient");
        final int W = 8, PX = 2, BOTTOM = 14;
        for (int h = 1; h <= 3; h++) {
            for (int w = 1; w <= 3; w++) {
                int n = w * h;
                for (int mask = 1; mask < (1 << n); mask++) {
                    int[] cells = new int[n];
                    for (int i = 0; i < n; i++) {
                        cells[i] = ((mask >> i) & 1) != 0 ? 24 : 0;
                    }
                    if (!tight(w, h, cells)) continue;
                    int py = BOTTOM - h + 1;
                    for (int pattern = 0; pattern < 64; pattern++) {
                        for (String dir : new String[]{"bit4", "bit8"}) {
                            String out;
                            try {
                                Object board = makeBoard(false);
                                int[] grid = (int[]) field(
                                        board.getClass(), "field_P").get(board);
                                for (int x = 0; x < W; x++) {
                                    grid[x + W * 16] = 24;
                                    grid[x + W * 17] = 24;
                                }
                                for (int b = 0; b < 6; b++) {
                                    if (((pattern >> b) & 1) != 0) {
                                        grid[(1 + b) + W * 15] = 24;
                                    }
                                }
                                install(board, makeShape(1, w, h, cells));
                                setInt(board, "field_q", PX);
                                setInt(board, "field_L", py);
                                setInt(board, "field_e", 1 << 20);
                                setInt(board, "field_Ab", 1 << 20);
                                if (dir.equals("bit4")) rotate(board, false);
                                else rotateOther(board);
                                out = get(board, "field_C")
                                        + "\t" + get(board, "field_zb")
                                        + "\t" + activeMap(board)
                                        + "\t" + get(board, "field_q")
                                        + "\t" + get(board, "field_L")
                                        + "\t" + get(board, "field_db")
                                        + "\t" + get(board, "field_o")
                                        + "\t" + get(board, "field_ab");
                            } catch (Throwable t) {
                                out = "ERR\tERR\tERR\tERR\tERR\tERR\tERR\tERR";
                            }
                            System.out.println("small\t" + w + "\t" + h
                                    + "\t" + describe(w, h, cells)
                                    + "\t" + dir + "\t" + PX + "\t" + py
                                    + "\t" + pattern + "\t" + out);
                        }
                    }
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0 && args[0].equals("kicksweep")) {
            kickSweep();
            return;
        }
        if (args.length > 0 && args[0].equals("sweep")) {
            sweep();
            return;
        }
        if (args.length > 0 && args[0].equals("rotsweep")) {
            rotationSweep();
            return;
        }
        if (args.length > 0 && args[0].equals("rotate")) {
            rotations();
            return;
        }
        if (args.length > 0 && args[0].equals("cellvalue")) {
            cellValueSweep();
            return;
        }
        // Ordinary dominoes first: these MUST reproduce the current Python
        // ActiveDomino behaviour, which is the control for the whole sweep.
        probe("domino-h", false, 2, 1, new int[]{16, 17});
        probe("domino-v", false, 1, 2, new int[]{16, 17});

        // Square and rectangular garbage (what _shape_from_positions emits most).
        probe("square-2x2", false, 2, 2, filled(2, 2, 24));
        probe("rect-3x2", false, 3, 2, filled(3, 2, 24));
        probe("rect-2x3", false, 2, 3, filled(2, 3, 24));
        probe("rect-4x1", false, 4, 1, filled(4, 1, 24));
        probe("rect-1x4", false, 1, 4, filled(1, 4, 24));
        probe("rect-3x3", false, 3, 3, filled(3, 3, 24));

        // Asymmetric blobs with holes -- these are where the width/height
        // parity branch at lk.java:1679 stops being a no-op.
        probe("L-3x2", false, 3, 2, new int[]{24, 0, 0, 24, 24, 24});
        probe("S-3x2", false, 3, 2, new int[]{0, 24, 24, 24, 24, 0});
        probe("T-3x2", false, 3, 2, new int[]{24, 24, 24, 0, 24, 0});
        probe("J-2x3", false, 2, 3, new int[]{0, 24, 0, 24, 24, 24});
        probe("corner-3x3", false, 3, 3, new int[]{24, 0, 0, 24, 0, 0, 24, 24, 24});

        // Same sweep on the large bucket, in case spawn centring differs.
        probe("square-2x2", true, 2, 2, filled(2, 2, 24));
        probe("rect-3x2", true, 3, 2, filled(3, 2, 24));
        probe("L-3x2", true, 3, 2, new int[]{24, 0, 0, 24, 24, 24});
    }
}
