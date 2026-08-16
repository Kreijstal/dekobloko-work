import java.applet.Applet;
import java.awt.Component;
import java.awt.Container;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import javax.imageio.ImageIO;

/**
 * Runs the real launcher, then reaches into the running game reflectively.
 *
 * The launcher renders correctly, so instead of re-creating its environment we
 * start it in a thread, locate the live Applet through Frame.getFrames(), and
 * borrow its class loader. That gives screenshots straight from the game's own
 * pixel arrays and lets a button's action be invoked without any mouse input,
 * with no X11 involvement.
 *
 * Usage:
 *   Wrapper <outDir> <settleMs> <click|noclick> -- <launcher args...>
 */
public final class Wrapper {

    private static ClassLoader loader;

    public static void main(String[] args) throws Exception {
        File outDir = new File(args[0]);
        outDir.mkdirs();
        final long settle = Long.parseLong(args[1]);
        final boolean click = "click".equals(args[2]);

        int sep = -1;
        for (int i = 0; i < args.length; i++) if ("--".equals(args[i])) { sep = i; break; }
        final String[] launcherArgs = new String[args.length - sep - 1];
        System.arraycopy(args, sep + 1, launcherArgs, 0, launcherArgs.length);

        Thread t = new Thread(new Runnable() {
            public void run() {
                try {
                    Class<?> c = Class.forName("local.DekoblokoLauncher");
                    Method m = c.getMethod("main", String[].class);
                    m.invoke(null, (Object) launcherArgs);
                } catch (Throwable e) {
                    System.out.println("wrapper.launcher.error " + e);
                }
            }
        });
        t.setDaemon(true);
        t.start();

        Applet applet = awaitApplet(settle);
        if (applet == null) {
            System.out.println("wrapper.applet NOT found");
            System.exit(1);
        }
        loader = applet.getClass().getClassLoader();
        System.out.println("wrapper.applet " + applet.getClass().getName());
        // The applet appears almost immediately; the real wait is the game
        // loading its cache and reaching a drawn screen. settle is now a
        // budget, not a duration -- it returns as soon as pixels exist.
        if (awaitDrawn(settle) == null) {
            System.out.println("wrapper.diag no drawn surface within " + settle + "ms");
        }

        dumpState();
        dump(outDir, "before");
        if ("clickqm".equals(args[2])) {
            walkToAccountPromptAndPlay(outDir);
        } else if (click) {
            System.out.println("wrapper.click " + invokeJustPlay());
            Thread.sleep(6000L);
            dump(outDir, "after");
        }
        System.out.println("wrapper.done");
        System.exit(0);
    }

    /**
     * The wrong-button bug lives on the SECOND screen, not the first.
     *
     * ob's "Just play" correctly navigates to the Jagex account prompt (`qm`)
     * whenever ob.R is true -- that is true of the original game too, so
     * reaching the prompt proves nothing. The prompt itself carries a third
     * button, qm.H ("Just play"), and that is the one whose action the
     * decompiler dropped: qm.H must reach wq.i(0), not ff.b(-104).
     *
     * So press through both screens and report which class is live after each
     * press. Staying on qm means the account action ran; leaving it means play
     * actually started.
     */
    private static void walkToAccountPromptAndPlay(File outDir) throws Exception {
        // Press 1 goes through eb.d: the login screen is the one screen that
        // field can hold, and pressing its G ("Just play") is what navigates.
        Object login = loginScreen();
        System.out.println("wrapper.screen1 " + describe(login));
        int[] baseline = liveSurface();
        if (baseline != null) baseline = baseline.clone();
        System.out.println("wrapper.press1 " + press(login, "G"));
        System.out.println("wrapper.moved1 " + awaitChange(baseline, 8000L));

        // Only now is the manager's Z populated -- reading it at startup gives
        // null, which is what made the earlier version of this probe useless.
        Object prompt = liveScreen();
        System.out.println("wrapper.screen2 " + describe(prompt));
        dump(outDir, "prompt");

        // Locating the prompt object has failed every way it was tried, so drive
        // its action instead of its button: qm's "Just play" is exactly wq.i(0).
        // Same effect, and it needs no screen pointer at all.
        int[] promptBaseline = liveSurface();
        if (promptBaseline != null) promptBaseline = promptBaseline.clone();
        String pressed = press(prompt, "H");
        System.out.println("wrapper.press2 " + pressed);
        if (prompt == null) System.out.println("wrapper.press2b " + callJustPlayAction());
        System.out.println("wrapper.moved2 " + awaitChange(promptBaseline, 10000L));

        System.out.println("wrapper.screen3 " + describe(liveScreen()));
        dump(outDir, "after");
        sampleAnimation(24, 500L);
        dump(outDir, "settled");

        // The probe exits as soon as it is done, which now takes seconds and
        // closes the window before a human can watch the animation. Hold it
        // open; the caller's `timeout` reaps it.
        System.out.println("wrapper.hold window open -- kill the process when finished watching");
        Thread.sleep(600000L);
    }

    /**
     * The live screen is the screen manager's Z field, NOT eb.d.
     *
     * `eb.d` is declared `static ob`, so it can never hold the account prompt
     * (`qm`) -- reading it reports "ob" forever and makes a two-screen probe
     * silently test the first screen twice. Navigation runs
     * `n.b.a(false, new qm())`, and `rl.a(boolean, iq)` assigns `this.Z = qm`.
     *
     * No fallback on purpose: if this pointer cannot be read the probe must
     * fail loudly rather than quietly report the wrong screen.
     */
    private static Object liveScreen() throws Exception {
        Field b = field(loader.loadClass("n"), "b");
        Object manager = b == null ? null : b.get(null);
        if (manager == null) {
            System.out.println("wrapper.diag n.b is null -- no screen manager");
            return null;
        }
        Field z = field(manager.getClass(), "Z");
        if (z == null) {
            System.out.println("wrapper.diag no Z field on " + manager.getClass().getName());
            return null;
        }
        return z.get(manager);
    }

    /**
     * qm's "Just play" button action, invoked directly.
     *
     * The prompt screen object could not be located by any field tried
     * (eb.d is `static ob`; n.b.Z reads null), so drive the action rather than
     * the button. `i` is the same name in the original jar and in the
     * ABI-restored recompiled build, so this works against both.
     */
    private static String callJustPlayAction() throws Exception {
        try {
            Method m = loader.loadClass("wq").getDeclaredMethod("i", int.class);
            m.setAccessible(true);
            m.invoke(null, 0);
            return "invoked wq.i(0)";
        } catch (Throwable t) {
            return "wq.i(0) failed: " + t;
        }
    }

    /** The login screen specifically; eb.d is declared `static ob` so this only ever yields it. */
    private static Object loginScreen() throws Exception {
        Field d = field(loader.loadClass("eb"), "d");
        return d == null ? null : d.get(null);
    }

    private static String describe(Object screen) {
        return screen == null ? "null" : screen.getClass().getName();
    }

    /** The ij click handler, located by signature rather than by name. */
    private static Method handlerOn(Object screen) throws Exception {
        Class<?> dCls = loader.loadClass("d");
        for (Method m : screen.getClass().getDeclaredMethods()) {
            Class<?>[] p = m.getParameterTypes();
            if (p.length == 5 && p[0] == int.class && p[1] == dCls
                && p[2] == byte.class && p[3] == int.class && p[4] == int.class) {
                m.setAccessible(true);
                return m;
            }
        }
        return null;
    }

    /** param2 must keep (param2 + 63) / 51 non-zero; -123 is what a real click passes. */
    private static String press(Object screen, String buttonField) throws Exception {
        if (screen == null) return "no live screen";
        Field bf = field(screen.getClass(), buttonField);
        Object button = bf == null ? null : bf.get(screen);
        if (button == null) {
            return "no button " + buttonField + " on " + screen.getClass().getName();
        }
        Method handler = handlerOn(screen);
        if (handler == null) return "no ij handler on " + screen.getClass().getName();
        handler.invoke(screen, 0, button, (byte) -123, 0, 0);
        return "pressed " + screen.getClass().getName() + "." + buttonField;
    }

    private static Applet awaitApplet(long budgetMs) throws Exception {
        long deadline = System.currentTimeMillis() + budgetMs;
        while (System.currentTimeMillis() < deadline) {
            for (Frame f : Frame.getFrames()) {
                Applet a = findApplet(f);
                if (a != null) return a;
            }
            Thread.sleep(500L);
        }
        return null;
    }

    private static Applet findApplet(Container c) {
        for (Component comp : c.getComponents()) {
            if (comp instanceof Applet) return (Applet) comp;
            if (comp instanceof Container) {
                Applet a = findApplet((Container) comp);
                if (a != null) return a;
            }
        }
        return null;
    }

    private static Field field(Class<?> c, String bare) {
        for (Class<?> k = c; k != null; k = k.getSuperclass()) {
            for (String n : new String[] { "field_" + bare, bare }) {
                try {
                    Field f = k.getDeclaredField(n);
                    f.setAccessible(true);
                    return f;
                } catch (NoSuchFieldException ignored) {
                    // try next spelling
                }
            }
        }
        return null;
    }

    /** Enough sampled pixels differing to mean the screen actually changed. */
    private static final int CHANGE_THRESHOLD = 8000;

    /**
     * Wait on conditions, not on the clock.
     *
     * Fixed sleeps cost the worst case on every run -- 45s of settle plus 18s
     * of post-press waiting, when the game is usually ready far sooner. These
     * poll instead, so a run takes as long as the game needs and no longer.
     */
    private static int[] awaitDrawn(long budgetMs) throws Exception {
        long deadline = System.currentTimeMillis() + budgetMs;
        while (System.currentTimeMillis() < deadline) {
            int[] px = liveSurface();
            if (px != null) return px.clone();
            Thread.sleep(200L);
        }
        return null;
    }

    /**
     * Wait until the surface differs from the baseline enough to be a new
     * screen. Safe here because the screens being left (login, account prompt)
     * are static -- on the animated main menu this would trip immediately.
     */
    private static boolean awaitChange(int[] baseline, long budgetMs) throws Exception {
        if (baseline == null) return false;
        long deadline = System.currentTimeMillis() + budgetMs;
        while (System.currentTimeMillis() < deadline) {
            int[] px = liveSurface();
            if (px != null) {
                int changed = 0;
                for (int i = 0; i < 640 * 480 && changed <= CHANGE_THRESHOLD; i += 7) {
                    if (px[i] != baseline[i]) changed += 1;
                }
                if (changed > CHANGE_THRESHOLD) return true;
            }
            Thread.sleep(150L);
        }
        return false;
    }

    /** The one live surface on bi -- the static int[] whose pixels actually vary. */
    private static int[] liveSurface() throws Exception {
        Class<?> bi = loader.loadClass("bi");
        for (Field f : bi.getDeclaredFields()) {
            if (f.getType() != int[].class) continue;
            f.setAccessible(true);
            int[] px = (int[]) f.get(null);
            if (px == null || px.length < 640 * 480) continue;
            int first = px[0];
            for (int i = 1; i < 640 * 480; i += 97) {
                if (px[i] != first) return px;
            }
        }
        return null;
    }

    /**
     * Animation timing signature.
     *
     * Stills cannot answer "is the animation running at the wrong rate", so
     * sample the surface on a fixed interval and report, per frame, a hash and
     * the pixel-change count against the previous sample. Comparing those two
     * series between the original and the recompiled build measures the
     * animation instead of describing it.
     */
    private static void sampleAnimation(int frames, long intervalMs) throws Exception {
        int[] prev = null;
        for (int n = 0; n < frames; n += 1) {
            int[] live = liveSurface();
            if (live == null) {
                System.out.println("wrapper.frame " + n + " no-surface");
                Thread.sleep(intervalMs);
                continue;
            }
            int[] snap = live.clone();
            long hash = 1469598103934665603L;
            int changed = 0;
            for (int i = 0; i < 640 * 480; i += 1) {
                hash = (hash ^ snap[i]) * 1099511628211L;
                if (prev != null && prev[i] != snap[i]) changed += 1;
            }
            System.out.println("wrapper.frame " + n
                + " hash=" + Long.toHexString(hash) + " changed=" + changed);
            prev = snap;
            Thread.sleep(intervalMs);
        }
    }

    /** Write every static int[] surface in bi that has varied pixels. */
    private static void dump(File outDir, String tag) throws Exception {
        Class<?> bi = loader.loadClass("bi");
        int written = 0;
        for (Field f : bi.getDeclaredFields()) {
            if (f.getType() != int[].class) continue;
            f.setAccessible(true);
            int[] px = (int[]) f.get(null);
            if (px == null || px.length < 640 * 480) continue;
            int first = px[0];
            boolean varied = false;
            for (int i = 1; i < 640 * 480; i += 97) {
                if (px[i] != first) { varied = true; break; }
            }
            if (!varied) continue;
            BufferedImage img = new BufferedImage(640, 480, BufferedImage.TYPE_INT_RGB);
            img.setRGB(0, 0, 640, 480, px, 0, 640);
            File out = new File(outDir, tag + "-" + f.getName() + ".png");
            ImageIO.write(img, "png", out);
            System.out.println("wrapper.surface " + f.getName() + " -> " + out);
            written++;
        }
        if (written == 0) System.out.println("wrapper.surface none varied for " + tag);
    }

    /**
     * The whole "Just play" decision reduces to a few flags, so read them
     * directly instead of inferring anything from pixels:
     *
     *   pb.f is set true as a side effect of model rendering (param7 < 30);
     *   kd.c passes !pb.f into or.a, which becomes ob.R; and ob's click
     *   handler runs sg.b(81) (the account prompt) when R is true, or
     *   oq.a(true) (play) when it is false.
     *
     * ob.N/R/S also identify which of the three `new ob(...)` sites built the
     * live screen: aj:199 is (false,true,true) and sm:85 is (true,false,false).
     */
    private static void dumpState() throws Exception {
        try {
            Field f = field(loader.loadClass("pb"), "f");
            System.out.println("wrapper.state pb.f=" + (f == null ? "?" : f.getBoolean(null)));
        } catch (Throwable t) {
            System.out.println("wrapper.state pb.f unavailable: " + t);
        }
        try {
            Field d = field(loader.loadClass("eb"), "d");
            Object screen = d == null ? null : d.get(null);
            if (screen == null) {
                System.out.println("wrapper.state eb.d=null");
                return;
            }
            System.out.println("wrapper.state screen=" + screen.getClass().getName()
                + " N=" + flag(screen, "N") + " R=" + flag(screen, "R")
                + " S=" + flag(screen, "S"));
        } catch (Throwable t) {
            System.out.println("wrapper.state screen unavailable: " + t);
        }
    }

    private static String flag(Object owner, String bare) throws Exception {
        Field f = field(owner.getClass(), bare);
        return f == null ? "?" : String.valueOf(f.getBoolean(owner));
    }

    private static String invokeJustPlay() throws Exception {
        Class<?> eb = loader.loadClass("eb");
        Field d = field(eb, "d");
        Object screen = d == null ? null : d.get(null);
        if (screen == null) return "no ob screen (eb.d null)";

        Field gF = field(screen.getClass(), "G");
        Object button = gF == null ? null : gF.get(screen);
        if (button == null) return "no Just-play button (ob.G null)";

        Class<?> dCls = loader.loadClass("d");
        Method handler = null;
        for (Method m : screen.getClass().getDeclaredMethods()) {
            Class<?>[] p = m.getParameterTypes();
            if (p.length == 5 && p[0] == int.class && p[1] == dCls
                && p[2] == byte.class && p[3] == int.class && p[4] == int.class) {
                handler = m; break;
            }
        }
        if (handler == null) return "no ij handler on " + screen.getClass().getName();
        handler.setAccessible(true);

        Field nF = field(screen.getClass(), "N");
        Field rF = field(screen.getClass(), "R");
        String flags = "N=" + (nF == null ? "?" : nF.getBoolean(screen))
            + " R=" + (rF == null ? "?" : rF.getBoolean(screen));

        handler.invoke(screen, 0, button, (byte) -123, 0, 0);
        return "invoked on " + screen.getClass().getName() + " " + flags;
    }
}
