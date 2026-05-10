package net.alterorb.launcher;

import java.io.File;

public final class Hook {
    private Hook() {
    }

    public static File cacheRedirect(String subDirectory, String file) {
        return new File(file);
    }
}
