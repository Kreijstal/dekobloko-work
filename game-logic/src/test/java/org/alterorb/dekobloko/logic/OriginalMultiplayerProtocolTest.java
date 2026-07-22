package org.alterorb.dekobloko.logic;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.Arrays;

/**
 * Executes multiplayer state packets and relayed controls in the untouched
 * original board engine. This deliberately tests the renderer-free protocol
 * boundary rather than reimplementing the obfuscated board state machine.
 */
public final class OriginalMultiplayerProtocolTest {
    private int assertions;

    public static void main(String[] args) throws Exception {
        OriginalMultiplayerProtocolTest test = new OriginalMultiplayerProtocolTest();
        test.run();
        System.out.println("OriginalMultiplayerProtocolTest: " + test.assertions
                + " assertions passed for full-state decode and deterministic control replay");
    }

    private void run() throws Exception {
        File originalClasses = requiredDirectory("dekobloko.original.classes");
        File stubClasses = requiredDirectory("dekobloko.original.stubs");
        URL[] urls = {stubClasses.toURI().toURL(), originalClasses.toURI().toURL()};
        ClassLoader loader = new HeadlessOriginalLoader(urls);

        Class<?> boardClass = Class.forName("lk", true, loader);
        Class<?> bufferClass = Class.forName("wl", true, loader);
        Class<?> cacheClass = Class.forName("oi", true, loader);
        Constructor<?> boardConstructor = boardClass.getDeclaredConstructor(
                boolean.class, int.class, int.class, int.class, int.class);
        Constructor<?> bufferConstructor = bufferClass.getDeclaredConstructor(byte[].class);
        boardConstructor.setAccessible(true);
        bufferConstructor.setAccessible(true);

        Method decodeState = findMethod(boardClass, void.class,
                boolean.class, bufferClass, byte.class);
        Method applyControls = findMethod(boardClass, void.class,
                int.class, int.class);
        decodeState.setAccessible(true);
        applyControls.setAccessible(true);

        byte[] packet = fullStatePayload();
        Object local = boardConstructor.newInstance(false, 0, 0, 4, 0);
        Object remote = boardConstructor.newInstance(false, 0, 0, 4, 0);
        decode(decodeState, bufferConstructor, local, packet);
        decode(decodeState, bufferConstructor, remote, packet);

        equal(8, intField(boardClass, local, "O"), "base bucket width is retained");
        equal(18, intField(boardClass, local, "a"), "base bucket height is retained");
        equal(7, intField(boardClass, local, "U"), "piece acknowledgement counter decodes");
        equal(2, intField(boardClass, local, "C"), "active piece width decodes");
        equal(1, intField(boardClass, local, "zb"), "active piece height decodes");
        equal(3, intField(boardClass, local, "q"), "active piece x decodes");
        equal(0, intField(boardClass, local, "L"), "active piece y decodes");
        equal(30, intField(boardClass, local, "Ab"), "gravity countdown decodes");
        equal(0x01, intField(boardClass, local, "yb"), "domino descriptor decodes");
        arrayEqual(new int[] {16, 17}, intArrayField(boardClass, local, "T"),
                "active domino cells decode");

        Board extractedBoard = new Board(8, 18);
        extractedBoard.set(0, 17, Tile.loose(2));
        ActiveDomino extracted = ActiveDomino.restore(
                extractedBoard,
                new Domino(Tile.loose(0), Tile.loose(1)),
                new DropTiming(40),
                3, 0, 0, 0, 2, 30, false, false, 0, 0);

        int[] controls = {
                0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,
                2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 8, 0, 16, 16, 16, 16, 0,
                4, 0, 1, 0, 2, 0, 16, 16, 16, 16, 16, 16, 16
        };
        int tick = 0;
        while (!extracted.landed() && tick < 120) {
            int control = tick < controls.length ? controls[tick] : Controls.FAST_DROP;
            applyControls.invoke(local, control, -1674843007);
            applyControls.invoke(remote, control, -1674843007);
            extracted.tick(control);
            equal(snapshot(boardClass, local), snapshot(boardClass, remote),
                    "remote control replay matches local board at tick " + tick);
            compareExtractedActive(boardClass, local, extracted, tick);
            tick++;
        }

        check(intField(boardClass, local, "L") > 0,
                "automatic/accelerated descent advances the active domino");
        check(extracted.landed() && booleanField(boardClass, local, "Bb"),
                "original and extracted engines reach the same lock boundary");

        Method finalizePiece = findMethod(boardClass, void.class,
                int.class, byte.class, boolean.class);
        finalizePiece.setAccessible(true);
        finalizePiece.invoke(local, 0, (byte) 126, false);
        PieceLockResult lock = extracted.finalizePlacement(1);
        check(!lock.lifeLost(), "differential fixture locks in bounds");
        compareSettledBoard(boardClass, local, extractedBoard);

        verifyOverflowLives(boardClass, boardConstructor, bufferConstructor,
                decodeState, applyControls, finalizePiece, 3);
        verifyOverflowLives(boardClass, boardConstructor, bufferConstructor,
                decodeState, applyControls, finalizePiece, 1);

        verifyCookedShapeEncoding(boardClass, cacheClass, boardConstructor);
    }

    private void verifyOverflowLives(Class<?> boardClass,
            Constructor<?> boardConstructor, Constructor<?> bufferConstructor,
            Method decodeState, Method applyControls, Method finalizePiece,
            int startingLives) throws Exception {
        Object original = boardConstructor.newInstance(false, 0, 0, 4, 0);
        decode(decodeState, bufferConstructor, original, overflowStatePayload(startingLives));

        Board extractedBoard = new Board(8, 18);
        extractedBoard.set(3, 1, Tile.loose(6));
        Domino vertical = new Domino(Tile.loose(0), Tile.loose(1))
                .rotateCounterClockwise();
        ActiveDomino extracted = ActiveDomino.restore(
                extractedBoard, vertical, new DropTiming(40),
                3, -1, 0, 0, 2, 30, false, false, 0, 0);

        int tick = 0;
        while (!extracted.landed() && tick < 40) {
            applyControls.invoke(original, Controls.FAST_DROP, -1674843007);
            extracted.tick(Controls.FAST_DROP);
            compareExtractedActive(boardClass, original, extracted, tick);
            tick++;
        }
        check(extracted.landed(), "overflow fixture reaches lock boundary");
        finalizePiece.invoke(original, 0, (byte) 126, false);
        PieceLockResult result = extracted.finalizePlacement(startingLives);
        equal(startingLives - 1, result.livesRemaining(),
                "extracted overflow decrements one life");
        equal(startingLives - 1, intField(boardClass, original, "jb"),
                "original overflow decrements one life");
        compareSettledBoard(boardClass, original, extractedBoard);
    }

    private void compareExtractedActive(Class<?> boardClass, Object original,
            ActiveDomino extracted, int tick) throws Exception {
        equal(intField(boardClass, original, "C"), extracted.domino().width(),
                "active width at tick " + tick);
        equal(intField(boardClass, original, "zb"), extracted.domino().height(),
                "active height at tick " + tick);
        equal(intField(boardClass, original, "q"), extracted.x(),
                "active x at tick " + tick);
        equal(intField(boardClass, original, "L"), extracted.y(),
                "active y at tick " + tick);
        equal(intField(boardClass, original, "e"), extracted.dropCountdown(),
                "descent/lock countdown at tick " + tick);
        equal(intField(boardClass, original, "Ab"), extracted.forcedDropCountdown(),
                "forced-drop countdown at tick " + tick);
        equal(intField(boardClass, original, "A"), extracted.previousControls(),
                "previous controls at tick " + tick);
        equal(intField(boardClass, original, "Cb"), extracted.horizontalRepeat(),
                "horizontal repeat at tick " + tick);
        equal(intField(boardClass, original, "o"), extracted.verticalParity(),
                "vertical parity at tick " + tick);
        equal(intField(boardClass, original, "db"), extracted.horizontalParity(),
                "horizontal parity at tick " + tick);
        check(booleanField(boardClass, original, "y") == extracted.grounded(),
                "grounded state at tick " + tick);
        check(booleanField(boardClass, original, "Bb") == extracted.landed(),
                "landed state at tick " + tick);
        arrayEqual(intArrayField(boardClass, original, "T"), activeCells(extracted.domino()),
                "active bitmap at tick " + tick);
    }

    private static int[] activeCells(Domino domino) {
        int[] cells = new int[domino.width() * domino.height()];
        Position pivot = domino.relativePositions().get(0);
        Position satellite = domino.relativePositions().get(1);
        int minX = Math.min(pivot.x(), satellite.x());
        int minY = Math.min(pivot.y(), satellite.y());
        cells[(pivot.y() - minY) * domino.width() + pivot.x() - minX] =
                16 + domino.pivot().color();
        cells[(satellite.y() - minY) * domino.width() + satellite.x() - minX] =
                16 + domino.satellite().color();
        return cells;
    }

    private void compareSettledBoard(Class<?> boardClass, Object original, Board extracted)
            throws Exception {
        int[] originalCells = intArrayField(boardClass, original, "P");
        for (int y = 0; y < extracted.height(); y++) {
            for (int x = 0; x < extracted.width(); x++) {
                int packed = originalCells[y * extracted.width() + x];
                Tile tile = extracted.get(x, y);
                int expected = tile == null ? 0 : 16 + tile.color();
                equal(expected, packed & 31,
                        "settled board cell " + x + "," + y);
            }
        }
    }

    private void verifyCookedShapeEncoding(Class<?> boardClass, Class<?> cacheClass,
            Constructor<?> boardConstructor) throws Exception {
        Constructor<?> cacheConstructor = cacheClass.getDeclaredConstructor(int.class);
        cacheConstructor.setAccessible(true);
        Object cache = cacheConstructor.newInstance(32);
        Object sourceBoard = boardConstructor.newInstance(false, 0, 2, 4, 0);

        int[] selected = intArrayField(boardClass, sourceBoard, "w");
        int width = intField(boardClass, sourceBoard, "O");
        int cursor = 0;
        for (int y = 5; y <= 7; y++) {
            for (int x = 2; x <= 4; x++) {
                if (!(x == 3 && y == 6)) {
                    selected[cursor++] = y * width + x;
                }
            }
        }

        Method cookedBuilder = findCookedBuilder(boardClass, cacheClass);
        cookedBuilder.setAccessible(true);
        cookedBuilder.invoke(sourceBoard, null, cache, 8 | 3, 0, cursor);

        Method cacheLookup = findCacheLookup(cacheClass);
        cacheLookup.setAccessible(true);
        Object shape = cacheLookup.invoke(cache, false, 0);
        check(shape != null, "original resolver registered cooked rf shape");
        Class<?> shapeClass = shape.getClass();
        equal(3, intField(shapeClass, shape, "b"), "cooked ring width");
        equal(3, intField(shapeClass, shape, "n"), "cooked ring height");
        byte[] actual = byteArrayField(shapeClass, shape, "c");
        byte[] expected = {11, 11, 11, 11, 0, 11, 11, 11, 11};
        check(Arrays.equals(expected, actual), "cooked ring retains 8|colour cells and hole: "
                + Arrays.toString(actual));
    }

    private static void decode(Method decodeState, Constructor<?> bufferConstructor,
            Object board, byte[] packet) throws Exception {
        Object buffer = bufferConstructor.newInstance((Object) packet);
        decodeState.invoke(board, false, buffer, (byte) 118);
    }

    private static byte[] fullStatePayload() {
        Bytes out = new Bytes();
        out.u16(0);       // packed board flags
        out.u8(1);        // field_jb: board is participating
        for (int index = 0; index < 8 * 18; index++) {
            out.varint7(index == 17 * 8 ? 18 : 0); // one settled loose cell
        }
        out.u8(7);        // field_U: piece/update acknowledgement counter
        out.u8(2);        // active width
        out.u8(1);        // active height
        out.u8(16);       // active cell A
        out.u8(17);       // active cell B
        out.i8(3);        // active x
        out.i8(0);        // active y
        out.u8(2);        // descent/lock state
        out.u16(30);      // gravity countdown
        out.u8(0);        // previous control mask
        out.i8(0);        // horizontal repeat counter
        out.u8(0x01);     // two ordinary colors: 0 and 1
        out.u8(0);        // field_K
        out.u8(0);        // field_z
        return out.finish();
    }

    private static byte[] overflowStatePayload(int lives) {
        Bytes out = new Bytes();
        out.u16(0);       // packed board flags
        out.u8(lives);
        for (int index = 0; index < 8 * 18; index++) {
            out.varint7(index == 8 + 3 ? 22 : 0); // obstacle at (3,1)
        }
        out.u8(1);        // acknowledgement counter
        out.u8(1);        // active width
        out.u8(2);        // active height
        out.u8(17);       // satellite at the bitmap top
        out.u8(16);       // pivot at the bitmap bottom
        out.i8(3);        // active bitmap x
        out.i8(-1);       // active bitmap y: above the top
        out.u8(2);        // descent countdown
        out.u16(30);      // forced-fast-drop countdown
        out.u8(0);        // previous controls
        out.i8(0);        // horizontal repeat
        out.u8(0x01);     // ordinary colors 0 and 1
        out.u8(0);        // chain state
        out.u8(0);        // top boundary
        return out.finish();
    }

    private static String snapshot(Class<?> boardClass, Object board) throws Exception {
        return Arrays.toString(intArrayField(boardClass, board, "P")) + '|'
                + Arrays.toString(intArrayField(boardClass, board, "T")) + '|'
                + intField(boardClass, board, "C") + '|'
                + intField(boardClass, board, "zb") + '|'
                + intField(boardClass, board, "q") + '|'
                + intField(boardClass, board, "L") + '|'
                + intField(boardClass, board, "Ab") + '|'
                + intField(boardClass, board, "A") + '|'
                + intField(boardClass, board, "Cb") + '|'
                + booleanField(boardClass, board, "Bb") + '|'
                + intField(boardClass, board, "U");
    }

    private static int intField(Class<?> type, Object instance, String name) throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field.getInt(instance);
    }

    private static boolean booleanField(Class<?> type, Object instance, String name)
            throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field.getBoolean(instance);
    }

    private static int[] intArrayField(Class<?> type, Object instance, String name)
            throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return (int[]) field.get(instance);
    }

    private static byte[] byteArrayField(Class<?> type, Object instance, String name)
            throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return (byte[]) field.get(instance);
    }

    private static Method findCookedBuilder(Class<?> boardClass, Class<?> cacheClass) {
        Class<?>[] signature = {
                boardClass, cacheClass, int.class, int.class, int.class
        };
        Method found = null;
        for (Method method : boardClass.getDeclaredMethods()) {
            if (java.lang.reflect.Modifier.isPrivate(method.getModifiers())
                    && method.getReturnType() == void.class
                    && Arrays.equals(method.getParameterTypes(), signature)) {
                if (found != null) {
                    throw new IllegalStateException("cooked-shape builder descriptor is not unique");
                }
                found = method;
            }
        }
        if (found == null) {
            throw new IllegalStateException("original cooked-shape builder not found");
        }
        return found;
    }

    private static Method findMethod(Class<?> owner, Class<?> returnType,
            Class<?>... parameterTypes) {
        Method found = null;
        for (Method method : owner.getDeclaredMethods()) {
            if (method.getReturnType() == returnType
                    && Arrays.equals(method.getParameterTypes(), parameterTypes)) {
                if (found != null) {
                    throw new IllegalStateException("method descriptor is not unique on "
                            + owner.getName() + ": " + Arrays.toString(parameterTypes));
                }
                found = method;
            }
        }
        if (found == null) {
            throw new IllegalStateException("method descriptor not found on "
                    + owner.getName() + ": " + Arrays.toString(parameterTypes));
        }
        return found;
    }

    private static Method findCacheLookup(Class<?> cacheClass) {
        Class<?>[] signature = {boolean.class, int.class};
        Method found = null;
        for (Method method : cacheClass.getDeclaredMethods()) {
            if (Arrays.equals(method.getParameterTypes(), signature)
                    && method.getReturnType().getName().equals("rf")) {
                if (found != null) {
                    throw new IllegalStateException("shape-cache lookup descriptor is not unique");
                }
                found = method;
            }
        }
        if (found == null) {
            throw new IllegalStateException("original shape-cache lookup not found");
        }
        return found;
    }

    private void check(boolean condition, String message) {
        assertions++;
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private void equal(int expected, int actual, String message) {
        check(expected == actual, message + ": expected " + expected + ", got " + actual);
    }

    private void equal(String expected, String actual, String message) {
        check(expected.equals(actual), message + ": expected " + expected + ", got " + actual);
    }

    private void arrayEqual(int[] expected, int[] actual, String message) {
        check(Arrays.equals(expected, actual), message + ": expected "
                + Arrays.toString(expected) + ", got " + Arrays.toString(actual));
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

    private static final class HeadlessOriginalLoader extends URLClassLoader {
        HeadlessOriginalLoader(URL[] urls) {
            super(urls, null);
        }

        @Override
        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
            if (name.startsWith("java.awt.") || name.startsWith("javax.swing.")) {
                throw new ClassNotFoundException("AWT/UI disabled in protocol differential: "
                        + name);
            }
            return super.loadClass(name, resolve);
        }
    }

    private static final class Bytes {
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();

        void u8(int value) {
            out.write(value & 255);
        }

        void i8(int value) {
            u8(value);
        }

        void u16(int value) {
            u8(value >>> 8);
            u8(value);
        }

        void varint7(int value) {
            if (value >= 128) {
                u8((value >>> 7) | 128);
            }
            u8(value & 127);
        }

        byte[] finish() {
            return out.toByteArray();
        }
    }
}
