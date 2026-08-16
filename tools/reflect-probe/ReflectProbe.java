import java.applet.Applet;
import java.applet.AppletContext;
import java.applet.AppletStub;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.HashMap;
import java.util.Map;
import javax.imageio.ImageIO;

/**
 * Reflective driver for a FunOrb gamepack.
 *
 * Boots the applet, screenshots by reading the game's own raster
 * (ro.g -> lk.e/i/d) rather than asking AWT to paint, and can invoke a
 * button's action handler directly instead of synthesizing mouse input.
 *
 * Field names are resolved with or without the deobfuscation pipeline's
 * "field_" prefix, so the same probe runs against the original jar and a
 * recompiled build.
 *
 * Usage: ReflectProbe <gamepack.jar> <outDir> [--click] [--settle-ms N]
 */
public final class ReflectProbe {

    private static ClassLoader loader;

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: ReflectProbe <gamepack.jar> <outDir> [--click] [--settle-ms N]");
            System.exit(2);
        }
        File jar = new File(args[0]);
        File outDir = new File(args[1]);
        outDir.mkdirs();
        boolean click = false;
        long settle = 25000L;
        for (int i = 2; i < args.length; i++) {
            if ("--click".equals(args[i])) click = true;
            else if ("--settle-ms".equals(args[i])) settle = Long.parseLong(args[++i]);
        }

        loader = new URLClassLoader(new URL[] { jar.toURI().toURL() },
            ReflectProbe.class.getClassLoader());

        Applet applet = (Applet) loader.loadClass("Vertigo2").newInstance();
        Frame frame = new Frame("probe");
        frame.setLayout(null);
        applet.setBounds(0, 0, 640, 480);
        frame.add(applet);
        frame.setSize(660, 520);
        applet.setStub(new Stub(applet));
        frame.setVisible(true);

        applet.init();
        applet.start();
        System.out.println("probe.started settle=" + settle + "ms");

        waitForRaster(settle);
        shot(outDir, "before");
        dumpSurfaces(outDir, "before");

        if (click) {
            System.out.println("probe.click " + invokeJustPlay());
            Thread.sleep(6000L);
            shot(outDir, "after");
            dumpSurfaces(outDir, "after");
        }

        applet.stop();
        applet.destroy();
        frame.dispose();
        System.out.println("probe.done");
        System.exit(0);
    }

    /** Field lookup tolerating the field_ prefix and walking superclasses. */
    private static Field field(Class<?> c, String bare) {
        for (Class<?> k = c; k != null; k = k.getSuperclass()) {
            for (String n : new String[] { "field_" + bare, bare }) {
                try {
                    Field f = k.getDeclaredField(n);
                    f.setAccessible(true);
                    return f;
                } catch (NoSuchFieldException ignored) {
                    // try the next spelling
                }
            }
        }
        return null;
    }

    private static Object raster() throws Exception {
        Class<?> ro = loader.loadClass("ro");
        Field g = field(ro, "g");
        return g == null ? null : g.get(null);
    }

    private static void waitForRaster(long budgetMs) throws Exception {
        long deadline = System.currentTimeMillis() + budgetMs;
        while (System.currentTimeMillis() < deadline) {
            Object lk = raster();
            if (lk != null) {
                Field e = field(lk.getClass(), "e");
                if (e != null && e.get(lk) != null) {
                    System.out.println("probe.raster ready");
                    Thread.sleep(2000L);
                    return;
                }
            }
            Thread.sleep(500L);
        }
        System.out.println("probe.raster NOT ready within budget");
    }

    /** Screenshot straight out of the game's pixel array. */
    private static void shot(File outDir, String tag) throws Exception {
        Object lk = raster();
        if (lk == null) {
            System.out.println("probe.shot." + tag + " no raster");
            return;
        }
        int[] px = (int[]) field(lk.getClass(), "e").get(lk);
        int w = field(lk.getClass(), "i").getInt(lk);
        int h = field(lk.getClass(), "d").getInt(lk);
        if (px == null || w <= 0 || h <= 0) {
            System.out.println("probe.shot." + tag + " empty raster w=" + w + " h=" + h);
            return;
        }
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        img.setRGB(0, 0, w, h, px, 0, w);
        File out = new File(outDir, tag + ".png");
        ImageIO.write(img, "png", out);
        System.out.println("probe.shot." + tag + " " + w + "x" + h + " -> " + out);
    }

    /**
     * Invoke the "Just play" button's action directly: eb.d is the live ob
     * screen, ob.G is the button, and ob.a(int, d, byte, int, int) is its
     * ij handler. param2 must keep (param2 + 63) / 51 non-zero.
     */
    private static void dumpSurfaces(File outDir, String tag) throws Exception {
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
            File out = new File(outDir, tag + "-bi-" + f.getName() + ".png");
            ImageIO.write(img, "png", out);
            System.out.println("probe.surface " + f.getName()
                + " len=" + px.length + " -> " + out);
            written++;
        }
        if (written == 0) System.out.println("probe.surface none varied for " + tag);
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
                handler = m;
                break;
            }
        }
        if (handler == null) return "no ij handler on " + screen.getClass().getName();
        handler.setAccessible(true);

        Field nF = field(screen.getClass(), "N");
        Field rF = field(screen.getClass(), "R");
        String flags = "N=" + (nF == null ? "?" : nF.getBoolean(screen))
            + " R=" + (rF == null ? "?" : rF.getBoolean(screen));

        handler.invoke(screen, 0, button, (byte) -123, 0, 0);
        return "invoked " + handler.getName() + " on " + screen.getClass().getName()
            + " button=" + button.getClass().getName() + " " + flags;
    }

    /** Minimal stub mirroring what the launcher supplies. */
    private static final class Stub implements AppletStub {
        private final Applet applet;
        private final Map<String, String> params = new HashMap<String, String>();

        Stub(Applet applet) {
            this.applet = applet;
            // Mirrors the launcher's parameter set; the game parses several of
            // these as ints, so a missing one fails init with a
            // NumberFormatException rather than anything meaningful.
            params.put("overxgames", "45");
            params.put("overxachievements", "1000");
            params.put("member", "no");
            params.put("gameport1", "43594");
            params.put("gameport2", "43594");
            params.put("servernum", "8003");
            params.put("instanceid", "1");
            params.put("gamecrc", "0");
            params.put("simplemode", "false");
            params.put("game", "vertigo2");
        }

        public boolean isActive() { return true; }

        public URL getDocumentBase() { return codeBase(); }

        public URL getCodeBase() { return codeBase(); }

        private URL codeBase() {
            try {
                return new URL("https://mgg-server.alterorb.net/");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        public String getParameter(String name) { return params.get(name); }

        public AppletContext getAppletContext() { return null; }

        public void appletResize(int w, int h) { applet.setSize(w, h); }
    }
}
