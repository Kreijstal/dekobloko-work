package local;

import java.applet.Applet;
import java.applet.AppletContext;
import java.applet.AppletStub;
import java.applet.AudioClip;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.Image;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Random;
import javax.imageio.ImageIO;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;

public final class DekoblokoLauncher {
    private static final String MAIN_CLASS = "client";
    private static final String DEFAULT_SERVER = "https://mgg-server.alterorb.net";
    private static final int GAME_CRC = 2147312574;

    private DekoblokoLauncher() {
    }

    public static void main(String[] args) throws Exception {
        Options options = Options.parse(args);
        Trace.open(options.traceFile);
        if (options.fakeAwt) {
            System.setProperty("java.awt.headless", "false");
            System.setProperty("awt.toolkit", "local.awt.FakeToolkit");
            System.setProperty("java.awt.graphicsenv", "local.awt.FakeGraphicsEnvironment");
            Trace.log("launcher.fakeAwt enabled");
        } else {
            System.setProperty("java.awt.headless", "false");
            Trace.log("launcher.realAwt enabled");
        }
        Trace.log("launcher.start gamepack=" + options.gamepack.getAbsolutePath());
        URL gamepackUrl = options.gamepack.toURI().toURL();
        URL serverUrl = normalizeUrl(options.server);

        URLClassLoader classLoader = new URLClassLoader(
                new URL[] { gamepackUrl },
                DekoblokoLauncher.class.getClassLoader()
        );

        Class<?> appletClass = classLoader.loadClass(MAIN_CLASS);
        Trace.log("launcher.loadClass " + MAIN_CLASS);
        Applet applet = (Applet) appletClass.getConstructor().newInstance();
        Trace.log("launcher.newApplet " + applet.getClass().getName());

        Map<String, String> params = new HashMap<>();
        params.put("overxgames", "45");
        params.put("overxachievements", "1000");
        params.put("member", "no");
        params.put("gameport1", "43594");
        params.put("gameport2", "43594");
        params.put("servernum", "8003");
        params.put("instanceid", Long.toString(new Random().nextLong()));
        params.put("gamecrc", Integer.toString(GAME_CRC));

        applet.setStub(new BasicAppletStub(new BasicAppletContext(), params, serverUrl, serverUrl));
        Trace.log("applet.setStub");

        applet.setSize(options.width, options.height);
        Trace.log("applet.setSize " + options.width + "x" + options.height);

        if (options.offscreen) {
            runOffscreen(applet, options);
            return;
        }

        if (options.headlessInit) {
            applet.init();
            Trace.log("applet.init.return");
            applet.start();
            Trace.log("applet.start.return");
            Thread.sleep(options.sleepMillis);
            applet.stop();
            Trace.log("applet.stop.return");
            Trace.close();
            System.exit(0);
            return;
        }

        SwingUtilities.invokeAndWait(() -> {
            JFrame frame = new JFrame("Deko Bloko");
            frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
            final AwtInteractionLog.Recorder[] recorder = new AwtInteractionLog.Recorder[1];
            frame.addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosed(WindowEvent event) {
                    if (recorder[0] != null) {
                        recorder[0].close();
                    }
                    applet.stop();
                    Trace.log("applet.stop.return");
                    applet.destroy();
                    Trace.log("applet.destroy.return");
                    Trace.close();
                }
            });
            frame.setLayout(new BorderLayout());
            frame.add(applet, BorderLayout.CENTER);
            frame.setPreferredSize(new Dimension(options.width, options.height));
            frame.pack();
            frame.setLocationRelativeTo(null);
            frame.setVisible(true);
            Trace.log("frame.setVisible true");
            applet.init();
            Trace.log("applet.init.return");
            applet.start();
            Trace.log("applet.start.return");
            if (options.recordAwtFile != null) {
                try {
                    recorder[0] = AwtInteractionLog.recordTo(applet, options.recordAwtFile);
                } catch (IOException ex) {
                    throw new RuntimeException(ex);
                }
            }
            if (options.replayAwtFile != null) {
                try {
                    AwtInteractionLog.replayFrom(applet, options.replayAwtFile, options.replaySpeed, options.exitAfterReplay);
                } catch (IOException ex) {
                    throw new RuntimeException(ex);
                }
            }
        });
    }

    private static void runOffscreen(Applet applet, Options options) throws IOException, InterruptedException {
        File outputDir = options.outputDir;
        if (!outputDir.exists() && !outputDir.mkdirs()) {
            throw new IllegalStateException("Could not create output directory: " + outputDir);
        }

        applet.init();
        Trace.log("applet.init.return");
        applet.start();
        Trace.log("applet.start.return");

        for (int i = 0; i < options.frames; i++) {
            Trace.log("offscreen.frame.begin " + i);
            BufferedImage image = new BufferedImage(options.width, options.height, BufferedImage.TYPE_INT_ARGB);
            Graphics2D graphics = image.createGraphics();
            try {
                applet.update(graphics);
                Trace.log("applet.update.return frame=" + i);
            } finally {
                graphics.dispose();
            }
            ImageIO.write(image, "png", new File(outputDir, String.format("frame-%03d.png", i)));
            Trace.log("offscreen.frame.write " + i);
            Thread.sleep(options.frameDelayMillis);
        }

        applet.stop();
        Trace.log("applet.stop.return");
        applet.destroy();
        Trace.log("applet.destroy.return");
        Trace.close();
        System.exit(0);
    }

    private static URL normalizeUrl(String value) throws MalformedURLException {
        return value.endsWith("/") ? new URL(value) : new URL(value + "/");
    }

    private static final class Options {
        private File gamepack = new File(System.getProperty("user.home"), ".alterorb/gamepacks/dekobloko.jar");
        private String server = DEFAULT_SERVER;
        private int width = 765;
        private int height = 503;
        private boolean headlessInit;
        private long sleepMillis = 3000L;
        private boolean offscreen;
        private int frames = 1;
        private long frameDelayMillis = 1000L;
        private File outputDir = new File("frames");
        private File traceFile = new File("awt-trace.log");
        private boolean fakeAwt = true;
        private File recordAwtFile;
        private File replayAwtFile;
        private double replaySpeed = 1.0d;
        private boolean exitAfterReplay = true;

        static Options parse(String[] args) {
            Options options = new Options();
            for (int i = 0; i < args.length; i++) {
                String arg = args[i];
                if ("--gamepack".equals(arg)) {
                    options.gamepack = new File(args[++i]);
                } else if ("--server".equals(arg)) {
                    options.server = args[++i];
                } else if ("--width".equals(arg)) {
                    options.width = Integer.parseInt(args[++i]);
                } else if ("--height".equals(arg)) {
                    options.height = Integer.parseInt(args[++i]);
                } else if ("--headless-init".equals(arg)) {
                    options.headlessInit = true;
                } else if ("--sleep-ms".equals(arg)) {
                    options.sleepMillis = Long.parseLong(args[++i]);
                } else if ("--offscreen".equals(arg)) {
                    options.offscreen = true;
                } else if ("--frames".equals(arg)) {
                    options.frames = Integer.parseInt(args[++i]);
                } else if ("--frame-delay-ms".equals(arg)) {
                    options.frameDelayMillis = Long.parseLong(args[++i]);
                } else if ("--output-dir".equals(arg)) {
                    options.outputDir = new File(args[++i]);
                } else if ("--trace-file".equals(arg)) {
                    options.traceFile = new File(args[++i]);
                } else if ("--record-awt".equals(arg)) {
                    options.recordAwtFile = new File(args[++i]);
                } else if ("--replay-awt".equals(arg)) {
                    options.replayAwtFile = new File(args[++i]);
                } else if ("--replay-speed".equals(arg)) {
                    options.replaySpeed = Double.parseDouble(args[++i]);
                    if (options.replaySpeed <= 0.0d) {
                        throw new IllegalArgumentException("--replay-speed must be positive");
                    }
                } else if ("--keep-open-after-replay".equals(arg)) {
                    options.exitAfterReplay = false;
                } else if ("--awt".equals(arg)) {
                    String mode = args[++i];
                    if ("fake".equals(mode)) {
                        options.fakeAwt = true;
                    } else if ("real".equals(mode)) {
                        options.fakeAwt = false;
                    } else {
                        throw new IllegalArgumentException("Unknown AWT mode: " + mode);
                    }
                } else if ("--real-awt".equals(arg)) {
                    options.fakeAwt = false;
                } else if ("--fake-awt".equals(arg)) {
                    options.fakeAwt = true;
                } else {
                    throw new IllegalArgumentException("Unknown argument: " + arg);
                }
            }
            return options;
        }
    }

    private static final class BasicAppletStub implements AppletStub {
        private final AppletContext context;
        private final Map<String, String> params;
        private final URL documentBase;
        private final URL codeBase;

        private BasicAppletStub(AppletContext context, Map<String, String> params, URL documentBase, URL codeBase) {
            this.context = context;
            this.params = params;
            this.documentBase = documentBase;
            this.codeBase = codeBase;
        }

        @Override
        public boolean isActive() {
            Trace.log("stub.isActive");
            return true;
        }

        @Override
        public URL getDocumentBase() {
            Trace.log("stub.getDocumentBase " + documentBase);
            return documentBase;
        }

        @Override
        public URL getCodeBase() {
            Trace.log("stub.getCodeBase " + codeBase);
            return codeBase;
        }

        @Override
        public String getParameter(String name) {
            String value = params.get(name);
            Trace.log("stub.getParameter " + name + "=" + value);
            return value;
        }

        @Override
        public AppletContext getAppletContext() {
            Trace.log("stub.getAppletContext");
            return context;
        }

        @Override
        public void appletResize(int width, int height) {
            Trace.log("stub.appletResize " + width + "x" + height);
        }
    }

    private static final class BasicAppletContext implements AppletContext {
        @Override
        public AudioClip getAudioClip(URL url) {
            Trace.log("context.getAudioClip " + url);
            return null;
        }

        @Override
        public Image getImage(URL url) {
            Trace.log("context.getImage " + url);
            return null;
        }

        @Override
        public Applet getApplet(String name) {
            Trace.log("context.getApplet " + name);
            return null;
        }

        @Override
        public Enumeration<Applet> getApplets() {
            Trace.log("context.getApplets");
            return Collections.emptyEnumeration();
        }

        @Override
        public void showDocument(URL url) {
            Trace.log("context.showDocument " + url);
        }

        @Override
        public void showDocument(URL url, String target) {
            Trace.log("context.showDocument " + url + " target=" + target);
        }

        @Override
        public void showStatus(String status) {
            Trace.log("context.showStatus " + status);
        }

        @Override
        public void setStream(String key, InputStream stream) {
            Trace.log("context.setStream " + key);
        }

        @Override
        public InputStream getStream(String key) {
            Trace.log("context.getStream " + key);
            return null;
        }

        @Override
        public Iterator<String> getStreamKeys() {
            Trace.log("context.getStreamKeys");
            return Collections.emptyIterator();
        }
    }
}
