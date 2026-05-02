package local;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;

public final class Trace {
    private static PrintWriter writer;

    private Trace() {
    }

    public static synchronized void open(File file) throws IOException {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Could not create trace directory: " + parent);
        }
        writer = new PrintWriter(new FileWriter(file, false));
    }

    public static synchronized void log(String event) {
        System.out.println(event);
        if (writer != null) {
            writer.println(event);
            writer.flush();
        }
    }

    public static synchronized void close() {
        if (writer != null) {
            writer.close();
            writer = null;
        }
    }
}
