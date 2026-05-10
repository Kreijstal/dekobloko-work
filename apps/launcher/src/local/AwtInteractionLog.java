package local;

import java.applet.Applet;
import java.awt.AWTEvent;
import java.awt.Component;
import java.awt.Point;
import java.awt.Toolkit;
import java.awt.event.AWTEventListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseWheelEvent;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.swing.SwingUtilities;

public final class AwtInteractionLog {
    private static final long EVENT_MASK = AWTEvent.KEY_EVENT_MASK
            | AWTEvent.MOUSE_EVENT_MASK
            | AWTEvent.MOUSE_MOTION_EVENT_MASK
            | AWTEvent.MOUSE_WHEEL_EVENT_MASK;

    private AwtInteractionLog() {
    }

    public static Recorder recordTo(Applet applet, File file) throws IOException {
        Recorder recorder = new Recorder(applet, file);
        recorder.start();
        return recorder;
    }

    public static Thread replayFrom(Applet applet, File file, double speed, boolean exitWhenDone) throws IOException {
        List<Entry> entries = read(file);
        Thread thread = new Thread(() -> {
            try {
                Trace.log("awtReplay.start file=" + file.getPath() + " events=" + entries.size());
                long previous = 0L;
                for (Entry entry : entries) {
                    long delay = entry.timeMillis - previous;
                    if (delay > 0L) {
                        Thread.sleep(Math.max(0L, Math.round(delay / speed)));
                    }
                    previous = entry.timeMillis;
                    dispatch(applet, entry);
                }
                Trace.log("awtReplay.done");
                if (exitWhenDone) {
                    applet.stop();
                    Trace.log("applet.stop.return");
                    applet.destroy();
                    Trace.log("applet.destroy.return");
                    Trace.close();
                    System.exit(0);
                }
            } catch (Exception ex) {
                Trace.log("awtReplay.error " + ex.getClass().getName() + ": " + ex.getMessage());
                ex.printStackTrace();
                if (exitWhenDone) {
                    System.exit(1);
                }
            }
        }, "awt-replay");
        thread.setDaemon(false);
        thread.start();
        return thread;
    }

    private static void dispatch(Applet applet, Entry entry) throws Exception {
        SwingUtilities.invokeAndWait(() -> {
            Component target = SwingUtilities.getDeepestComponentAt(applet, entry.x, entry.y);
            if (target == null) {
                target = applet;
            }
            Point targetPoint = SwingUtilities.convertPoint(applet, entry.x, entry.y, target);
            AWTEvent event;
            if ("key".equals(entry.kind)) {
                event = new KeyEvent(target, entry.id, System.currentTimeMillis(), entry.modifiers,
                        entry.keyCode, entry.keyChar, entry.keyLocation);
            } else if ("wheel".equals(entry.kind)) {
                event = new MouseWheelEvent(target, entry.id, System.currentTimeMillis(), entry.modifiers,
                        targetPoint.x, targetPoint.y, 0, false, MouseWheelEvent.WHEEL_UNIT_SCROLL,
                        entry.scrollAmount, entry.wheelRotation);
            } else {
                event = new MouseEvent(target, entry.id, System.currentTimeMillis(), entry.modifiers,
                        targetPoint.x, targetPoint.y, entry.clickCount, false, entry.button);
            }
            Trace.log("awtReplay.dispatch " + entry.kind + " id=" + entry.id + " x=" + entry.x + " y=" + entry.y);
            target.dispatchEvent(event);
        });
    }

    private static List<Entry> read(File file) throws IOException {
        List<Entry> entries = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                entries.add(Entry.parse(line));
            }
        }
        return entries;
    }

    public static final class Recorder implements AutoCloseable {
        private final Applet applet;
        private final BufferedWriter writer;
        private final long startNanos;
        private AWTEventListener listener;

        private Recorder(Applet applet, File file) throws IOException {
            this.applet = applet;
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("Could not create replay directory: " + parent);
            }
            this.writer = new BufferedWriter(new FileWriter(file, false));
            this.startNanos = System.nanoTime();
        }

        private void start() throws IOException {
            writer.write("# awt-replay-v1\n");
            writer.flush();
            listener = this::capture;
            Toolkit.getDefaultToolkit().addAWTEventListener(listener, EVENT_MASK);
            Trace.log("awtRecord.start");
        }

        private void capture(AWTEvent event) {
            if (!(event.getSource() instanceof Component)) {
                return;
            }
            Component source = (Component) event.getSource();
            if (!SwingUtilities.isDescendingFrom(source, applet) && source != applet) {
                return;
            }
            try {
                if (event instanceof MouseWheelEvent) {
                    writeMouseWheel(source, (MouseWheelEvent) event);
                } else if (event instanceof MouseEvent) {
                    writeMouse(source, (MouseEvent) event);
                } else if (event instanceof KeyEvent) {
                    writeKey((KeyEvent) event);
                }
            } catch (IOException ex) {
                Trace.log("awtRecord.error " + ex.getMessage());
            }
        }

        private void writeMouse(Component source, MouseEvent event) throws IOException {
            Point appletPoint = SwingUtilities.convertPoint(source, event.getX(), event.getY(), applet);
            write(Entry.mouse(elapsedMillis(), event, appletPoint));
        }

        private void writeMouseWheel(Component source, MouseWheelEvent event) throws IOException {
            Point appletPoint = SwingUtilities.convertPoint(source, event.getX(), event.getY(), applet);
            write(Entry.wheel(elapsedMillis(), event, appletPoint));
        }

        private void writeKey(KeyEvent event) throws IOException {
            write(Entry.key(elapsedMillis(), event));
        }

        private long elapsedMillis() {
            return (System.nanoTime() - startNanos) / 1000000L;
        }

        private synchronized void write(Entry entry) throws IOException {
            writer.write(entry.format());
            writer.write('\n');
            writer.flush();
            Trace.log("awtRecord.event " + entry.kind + " id=" + entry.id);
        }

        @Override
        public synchronized void close() {
            if (listener != null) {
                Toolkit.getDefaultToolkit().removeAWTEventListener(listener);
                listener = null;
            }
            try {
                writer.close();
            } catch (IOException ignored) {
                // Nothing useful to do during shutdown.
            }
            Trace.log("awtRecord.stop");
        }
    }

    private static final class Entry {
        private final long timeMillis;
        private final String kind;
        private final int id;
        private final int modifiers;
        private final int x;
        private final int y;
        private final int button;
        private final int clickCount;
        private final int keyCode;
        private final char keyChar;
        private final int keyLocation;
        private final int scrollAmount;
        private final int wheelRotation;

        private Entry(long timeMillis, String kind, int id, int modifiers, int x, int y,
                      int button, int clickCount, int keyCode, char keyChar, int keyLocation,
                      int scrollAmount, int wheelRotation) {
            this.timeMillis = timeMillis;
            this.kind = kind;
            this.id = id;
            this.modifiers = modifiers;
            this.x = x;
            this.y = y;
            this.button = button;
            this.clickCount = clickCount;
            this.keyCode = keyCode;
            this.keyChar = keyChar;
            this.keyLocation = keyLocation;
            this.scrollAmount = scrollAmount;
            this.wheelRotation = wheelRotation;
        }

        private static Entry mouse(long timeMillis, MouseEvent event, Point point) {
            return new Entry(timeMillis, "mouse", event.getID(), event.getModifiersEx(), point.x, point.y,
                    event.getButton(), event.getClickCount(), 0, KeyEvent.CHAR_UNDEFINED, 0, 0, 0);
        }

        private static Entry wheel(long timeMillis, MouseWheelEvent event, Point point) {
            return new Entry(timeMillis, "wheel", event.getID(), event.getModifiersEx(), point.x, point.y,
                    event.getButton(), event.getClickCount(), 0, KeyEvent.CHAR_UNDEFINED, 0,
                    event.getScrollAmount(), event.getWheelRotation());
        }

        private static Entry key(long timeMillis, KeyEvent event) {
            return new Entry(timeMillis, "key", event.getID(), event.getModifiersEx(), 0, 0,
                    0, 0, event.getKeyCode(), event.getKeyChar(), event.getKeyLocation(), 0, 0);
        }

        private String format() {
            return timeMillis + "\t" + kind + "\t" + id + "\t" + modifiers + "\t" + x + "\t" + y
                    + "\t" + button + "\t" + clickCount + "\t" + keyCode + "\t" + (int) keyChar
                    + "\t" + keyLocation + "\t" + scrollAmount + "\t" + wheelRotation;
        }

        private static Entry parse(String line) {
            String[] parts = line.split("\\t");
            if (parts.length != 13) {
                throw new IllegalArgumentException("Bad replay line: " + line);
            }
            return new Entry(Long.parseLong(parts[0]), parts[1], Integer.parseInt(parts[2]),
                    Integer.parseInt(parts[3]), Integer.parseInt(parts[4]), Integer.parseInt(parts[5]),
                    Integer.parseInt(parts[6]), Integer.parseInt(parts[7]), Integer.parseInt(parts[8]),
                    (char) Integer.parseInt(parts[9]), Integer.parseInt(parts[10]),
                    Integer.parseInt(parts[11]), Integer.parseInt(parts[12]));
        }
    }
}
