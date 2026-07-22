package org.alterorb.dekobloko.logic;

import java.io.File;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Arrays;

/** Decodes one Python-produced S2C-61 body with untouched original lk. */
public final class OriginalSnapshotProbe {
    private OriginalSnapshotProbe() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1 || args.length > 2) {
            throw new IllegalArgumentException(
                    "expected a hexadecimal state payload and optional large-bucket flag");
        }
        boolean largeBucket = args.length == 2 && Boolean.parseBoolean(args[1]);
        File original = requiredDirectory("dekobloko.original.classes");
        File stubs = requiredDirectory("dekobloko.original.stubs");
        ClassLoader loader = new HeadlessLoader(new URL[] {
                stubs.toURI().toURL(), original.toURI().toURL()
        });
        Class<?> boardClass = Class.forName("lk", true, loader);
        Class<?> bufferClass = Class.forName("wl", true, loader);
        Constructor<?> boardConstructor = boardClass.getDeclaredConstructor(
                boolean.class, int.class, int.class, int.class, int.class);
        Constructor<?> bufferConstructor = bufferClass.getDeclaredConstructor(byte[].class);
        boardConstructor.setAccessible(true);
        bufferConstructor.setAccessible(true);
        Object board = boardConstructor.newInstance(largeBucket, 0, 0, 4, 0);
        Method decoder = findMethod(boardClass, void.class,
                boolean.class, bufferClass, byte.class);
        decoder.setAccessible(true);
        decoder.invoke(board, false,
                bufferConstructor.newInstance((Object) hex(args[0])), (byte) 118);

        System.out.println(field(boardClass, board, "jb") + "|"
                + field(boardClass, board, "U") + "|"
                + field(boardClass, board, "q") + "|"
                + field(boardClass, board, "L") + "|"
                + field(boardClass, board, "e") + "|"
                + field(boardClass, board, "Ab") + "|"
                + field(boardClass, board, "A") + "|"
                + field(boardClass, board, "Cb") + "|"
                + field(boardClass, board, "yb") + "|"
                + field(boardClass, board, "ab") + "|"
                + field(boardClass, board, "o") + "|"
                + field(boardClass, board, "db") + "|"
                + booleanField(boardClass, board, "y") + "|"
                + Arrays.toString(arrayField(boardClass, board, "T")) + "|"
                + Arrays.toString(arrayField(boardClass, board, "P")));
    }

    private static Method findMethod(Class<?> owner, Class<?> returnType,
            Class<?>... parameters) {
        for (Method method : owner.getDeclaredMethods()) {
            if (method.getReturnType() == returnType
                    && Arrays.equals(method.getParameterTypes(), parameters)) {
                return method;
            }
        }
        throw new IllegalStateException("snapshot decoder descriptor not found");
    }

    private static int field(Class<?> owner, Object instance, String name) throws Exception {
        Field field = owner.getDeclaredField(name);
        field.setAccessible(true);
        return field.getInt(instance);
    }

    private static boolean booleanField(Class<?> owner, Object instance, String name)
            throws Exception {
        Field field = owner.getDeclaredField(name);
        field.setAccessible(true);
        return field.getBoolean(instance);
    }

    private static int[] arrayField(Class<?> owner, Object instance, String name)
            throws Exception {
        Field field = owner.getDeclaredField(name);
        field.setAccessible(true);
        return (int[]) field.get(instance);
    }

    private static byte[] hex(String value) {
        if ((value.length() & 1) != 0) {
            throw new IllegalArgumentException("hex length must be even");
        }
        byte[] result = new byte[value.length() / 2];
        for (int index = 0; index < result.length; index++) {
            result[index] = (byte) Integer.parseInt(
                    value.substring(index * 2, index * 2 + 2), 16);
        }
        return result;
    }

    private static File requiredDirectory(String property) throws Exception {
        String value = System.getProperty(property);
        if (value == null) {
            throw new IllegalStateException("missing -D" + property);
        }
        File directory = new File(value).getCanonicalFile();
        if (!directory.isDirectory()) {
            throw new IllegalStateException(property + " is not a directory: " + directory);
        }
        return directory;
    }

    private static final class HeadlessLoader extends URLClassLoader {
        HeadlessLoader(URL[] urls) {
            super(urls, null);
        }

        @Override
        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
            if (name.startsWith("java.awt.") || name.startsWith("javax.swing.")) {
                throw new ClassNotFoundException("AWT disabled in snapshot probe: " + name);
            }
            return super.loadClass(name, resolve);
        }
    }
}
