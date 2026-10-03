package net.alterorb.launcher;

import java.io.File;
import local.Trace;

public final class Hook {
    // The cache root is absolute, so running the launcher from another
    // directory does NOT redirect the guest's cache writes -- a test that
    // "isolates" itself with a chdir silently reads and writes the real one.
    // -Dalterorb.cacheRoot=<dir> is the supported way to point a run at a
    // disposable copy.
    private static final File CACHE_DIR = new File(
            System.getProperty("alterorb.cacheRoot",
                    new File(System.getProperty("user.home"), ".alterorb/caches").getPath()));

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
