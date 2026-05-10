package net.alterorb.launcher;

import java.io.File;
import local.Trace;

public final class Hook {
    private static final File CACHE_DIR = new File(System.getProperty("user.home"), ".alterorb/caches");

    private Hook() {
    }

    public static File cacheRedirect(String subDirectory, String file) {
        Trace.log("hook.cacheRedirect subDirectory=" + subDirectory + " file=" + file);
        File directory = subDirectory == null ? CACHE_DIR : new File(CACHE_DIR, subDirectory);
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("Could not create cache directory: " + directory);
        }
        return new File(directory, file);
    }
}
