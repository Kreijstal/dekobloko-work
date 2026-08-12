import java.applet.Applet;
import java.applet.AppletContext;
import java.applet.AppletStub;
import java.applet.AudioClip;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.Robot;
import java.awt.image.BufferedImage;
import java.awt.image.ImageObserver;
import java.io.File;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import sun.misc.Unsafe;

public final class ReflectionMainMenuProbe {
    private static final int WIDTH = 640;
    private static final int HEIGHT = 480;
    private static final int MIN_SURFACE_PIXELS = 100_000;
    private static final Unsafe UNSAFE = unsafe();

    private ReflectionMainMenuProbe() {
    }

    public static void main(String[] arguments) throws Exception {
        Map<String, String> options = parseArguments(arguments);
        String game = required(options, "game");
        String mainClassName = required(options, "main-class");
        Path classPath = Paths.get(required(options, "classpath")).toAbsolutePath();
        URL codeBase = normalizedUrl(required(options, "code-base"));
        long timeoutMillis = Long.parseLong(options.getOrDefault("timeout-ms", "180000"));
        long startedAt = System.nanoTime();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            error.printStackTrace(System.err);
        });

        URLClassLoader loader = new URLClassLoader(
            new URL[] {classPath.toUri().toURL()},
            ReflectionMainMenuProbe.class.getClassLoader()
        );
        List<Class<?>> classes = loadClassesWithoutInitialization(classPath, loader);
        Class<?> mainClass = Class.forName(mainClassName, true, loader);
        Applet applet = (Applet) mainClass.getConstructor().newInstance();

        Map<String, String> parameters = new HashMap<>();
        parameters.put("overxgames", "45");
        parameters.put("overxachievements", "1000");
        parameters.put("member", "no");
        parameters.put("gameport1", options.getOrDefault("game-port", "43594"));
        parameters.put("gameport2", options.getOrDefault("game-port", "43594"));
        parameters.put("servernum", "8003");
        parameters.put("simplemode", "true");
        parameters.put("instanceid", Long.toString(System.nanoTime()));
        parameters.put("gamecrc", required(options, "gamecrc"));
        applet.setStub(new ProbeAppletStub(parameters, codeBase));
        applet.setSize(WIDTH, HEIGHT);
        applet.setPreferredSize(new Dimension(WIDTH, HEIGHT));

        JFrame frame = new JFrame(game + " JRE reflection probe");
        SwingUtilities.invokeAndWait(() -> {
            frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
            frame.setLayout(new BorderLayout());
            frame.add(applet, BorderLayout.CENTER);
            frame.setPreferredSize(new Dimension(WIDTH, HEIGHT));
            frame.pack();
            frame.setVisible(true);
            applet.init();
            applet.start();
        });

        String status = "timeout";
        SurfaceSnapshot lastSurface = null;
        long firstFrameAt = -1;
        long menuCandidateAt = -1;
        Set<String> seenHashes = new HashSet<>();
        Throwable failure = null;
        Robot robot = new Robot();
        try {
            while (elapsedMillis(startedAt) < timeoutMillis) {
                int[] pixels = largestInitializedStaticIntArray(classes);
                SurfaceSnapshot reflectedSurface = snapshot(pixels);
                SurfaceSnapshot capturedSurface = captureSnapshot(applet, robot);
                SurfaceSnapshot surface = richerSurface(reflectedSurface, capturedSurface);
                if (surface != null) {
                    lastSurface = surface;
                    seenHashes.add(surface.hash);
                    long now = elapsedMillis(startedAt);
                    if (firstFrameAt < 0 && surface.nonblankSamples >= 16) {
                        firstFrameAt = now;
                    }
                    boolean dense = surface.nonblankSamples >= 2500 &&
                        surface.uniqueSampleColors >= 96;
                    boolean sparse = surface.nonblankSamples >= 800 &&
                        surface.nonblankSamples < 2500 &&
                        surface.uniqueSampleColors >= 32 && seenHashes.size() >= 10;
                    if ((dense || sparse) && menuCandidateAt < 0) {
                        menuCandidateAt = now;
                    }
                    if (firstFrameAt >= 0 && now - firstFrameAt >= 5000 &&
                        menuCandidateAt >= 0 && now - menuCandidateAt >= 10000 &&
                        seenHashes.size() >= 3 && (dense || sparse)) {
                        status = "main-menu";
                        break;
                    }
                }
                Thread.sleep(100);
            }
        } catch (Throwable error) {
            status = "error";
            failure = error;
        } finally {
            try {
                SwingUtilities.invokeAndWait(() -> {
                    try {
                        applet.stop();
                        applet.destroy();
                    } finally {
                        frame.dispose();
                    }
                });
            } catch (Throwable ignored) {
                // The result below retains the primary failure.
            }
            loader.close();
        }

        long elapsed = elapsedMillis(startedAt);
        System.out.println("JRE_REFLECTION_RESULT\t" + game + "\t" + status +
            "\t" + elapsed + "\t" + (lastSurface == null ? "" : lastSurface.hash) +
            "\t" + (lastSurface == null ? 0 : lastSurface.nonblankSamples) +
            "\t" + (lastSurface == null ? 0 : lastSurface.uniqueSampleColors));
        if (failure != null) failure.printStackTrace(System.err);
        System.exit("main-menu".equals(status) ? 0 : 1);
    }

    private static Unsafe unsafe() {
        try {
            Field field = Unsafe.class.getDeclaredField("theUnsafe");
            field.setAccessible(true);
            return (Unsafe) field.get(null);
        } catch (ReflectiveOperationException error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    private static int[] largestInitializedStaticIntArray(List<Class<?>> classes) {
        int[] largest = null;
        for (Class<?> type : classes) {
            Field[] fields;
            try {
                fields = type.getDeclaredFields();
            } catch (Throwable ignored) {
                continue;
            }
            for (Field field : fields) {
                if (!Modifier.isStatic(field.getModifiers()) || field.getType() != int[].class) {
                    continue;
                }
                try {
                    Object base = UNSAFE.staticFieldBase(field);
                    long offset = UNSAFE.staticFieldOffset(field);
                    Object value = UNSAFE.getObjectVolatile(base, offset);
                    if (value instanceof int[]) {
                        int[] candidate = (int[]) value;
                        if (candidate.length >= MIN_SURFACE_PIXELS &&
                            (largest == null || candidate.length > largest.length)) {
                            largest = candidate;
                        }
                    }
                } catch (Throwable ignored) {
                    // An inaccessible or unresolved class is not an initialized surface owner.
                }
            }
        }
        return largest;
    }

    private static SurfaceSnapshot snapshot(int[] pixels) {
        if (pixels == null) return null;
        int stride = Math.max(1, pixels.length / 4096);
        int nonblank = 0;
        int hash = 0x811c9dc5;
        Set<Integer> colors = new HashSet<>();
        for (int index = 0; index < pixels.length; index += stride) {
            int pixel = pixels[index];
            int rgb = pixel & 0xffffff;
            if (rgb != 0 && rgb != 0xffffff) nonblank++;
            colors.add(rgb);
            hash ^= pixel;
            hash *= 0x01000193;
        }
        return new SurfaceSnapshot(nonblank, colors.size(), String.format("%08x", hash));
    }

    private static SurfaceSnapshot captureSnapshot(Applet applet, Robot robot) {
        try {
            Point location = applet.getLocationOnScreen();
            int width = applet.getWidth();
            int height = applet.getHeight();
            if (width < 100 || height < 100) return null;
            BufferedImage image = robot.createScreenCapture(
                new Rectangle(location.x, location.y, width, height));
            int[] pixels = image.getRGB(0, 0, width, height, null, 0, width);
            return snapshot(pixels);
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static SurfaceSnapshot richerSurface(SurfaceSnapshot left,
            SurfaceSnapshot right) {
        if (left == null) return right;
        if (right == null) return left;
        if (right.nonblankSamples != left.nonblankSamples) {
            return right.nonblankSamples > left.nonblankSamples ? right : left;
        }
        return right.uniqueSampleColors > left.uniqueSampleColors ? right : left;
    }

    private static List<Class<?>> loadClassesWithoutInitialization(Path classPath,
            ClassLoader loader) throws Exception {
        List<String> names = new ArrayList<>();
        if (Files.isDirectory(classPath)) {
            try (java.util.stream.Stream<Path> paths = Files.walk(classPath)) {
                paths.filter(path -> path.toString().endsWith(".class")).forEach(path -> {
                    String relative = classPath.relativize(path).toString();
                    names.add(relative.substring(0, relative.length() - 6)
                        .replace(File.separatorChar, '.'));
                });
            }
        } else {
            try (JarFile jar = new JarFile(classPath.toFile())) {
                Enumeration<JarEntry> entries = jar.entries();
                while (entries.hasMoreElements()) {
                    String name = entries.nextElement().getName();
                    if (name.endsWith(".class")) {
                        names.add(name.substring(0, name.length() - 6).replace('/', '.'));
                    }
                }
            }
        }
        List<Class<?>> classes = new ArrayList<>();
        for (String name : names) {
            try {
                classes.add(Class.forName(name, false, loader));
            } catch (Throwable ignored) {
                // Optional/incompatible classes cannot own an initialized framebuffer.
            }
        }
        return classes;
    }

    private static long elapsedMillis(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000L;
    }

    private static URL normalizedUrl(String value) throws Exception {
        return new URL(value.endsWith("/") ? value : value + "/");
    }

    private static Map<String, String> parseArguments(String[] arguments) {
        Map<String, String> parsed = new HashMap<>();
        for (int index = 0; index < arguments.length; index += 2) {
            if (index + 1 >= arguments.length || !arguments[index].startsWith("--")) {
                throw new IllegalArgumentException("Arguments must be --name value pairs");
            }
            parsed.put(arguments[index].substring(2), arguments[index + 1]);
        }
        return parsed;
    }

    private static String required(Map<String, String> options, String name) {
        String value = options.get(name);
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("Missing --" + name);
        }
        return value;
    }

    private static final class SurfaceSnapshot {
        final int nonblankSamples;
        final int uniqueSampleColors;
        final String hash;

        SurfaceSnapshot(int nonblankSamples, int uniqueSampleColors, String hash) {
            this.nonblankSamples = nonblankSamples;
            this.uniqueSampleColors = uniqueSampleColors;
            this.hash = hash;
        }
    }

    private static final class ProbeAppletStub implements AppletStub {
        private final Map<String, String> parameters;
        private final URL base;
        private final AppletContext context = new ProbeAppletContext();

        ProbeAppletStub(Map<String, String> parameters, URL base) {
            this.parameters = parameters;
            this.base = base;
        }

        public boolean isActive() { return true; }
        public URL getDocumentBase() { return base; }
        public URL getCodeBase() { return base; }
        public String getParameter(String name) { return parameters.get(name); }
        public AppletContext getAppletContext() { return context; }
        public void appletResize(int width, int height) { }
    }

    private static final class ProbeAppletContext implements AppletContext {
        public AudioClip getAudioClip(URL url) { return null; }
        public Image getImage(URL url) { return null; }
        public Applet getApplet(String name) { return null; }
        public Enumeration<Applet> getApplets() { return Collections.emptyEnumeration(); }
        public void showDocument(URL url) { }
        public void showDocument(URL url, String target) { }
        public void showStatus(String status) { }
        public void setStream(String key, InputStream stream) { }
        public InputStream getStream(String key) { return null; }
        public Iterator<String> getStreamKeys() { return Collections.emptyIterator(); }
    }
}
