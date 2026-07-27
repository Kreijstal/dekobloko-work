import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Executes the original client's cooked-shape queue methods directly.
 *
 * lk.a(rf, byte) stages a shape and lk.b(-19939) selects the next staged
 * shape for a transition. Randomized FIFO queues verify that once field_t is
 * non-zero the client drains queued shapes consecutively rather than
 * inserting generated normal dominoes between them.
 */
public final class QueueProbe {
    private static sun.misc.Unsafe unsafe() throws Exception {
        Field field = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
        field.setAccessible(true);
        return (sun.misc.Unsafe) field.get(null);
    }

    private static Object allocate(Class<?> type) throws Exception {
        return unsafe().allocateInstance(type);
    }

    private static Field field(Class<?> type, String name) throws Exception {
        try {
            Field result = type.getDeclaredField(name);
            result.setAccessible(true);
            return result;
        } catch (NoSuchFieldException exception) {
            String alternate = name.startsWith("field_")
                    ? name.substring(6)
                    : "field_" + name;
            Field result = type.getDeclaredField(alternate);
            result.setAccessible(true);
            return result;
        }
    }

    private static void setInt(Object target, String name, int value)
            throws Exception {
        field(target.getClass(), name).setInt(target, value);
    }

    private static void setObject(Object target, String name, Object value)
            throws Exception {
        field(target.getClass(), name).set(target, value);
    }

    private static Object makeBoard() throws Exception {
        Class<?> boardType = Class.forName("lk");
        Class<?> shapeType = Class.forName("rf");
        Object board = allocate(boardType);
        setObject(board, "field_X", Array.newInstance(shapeType, 1));
        setInt(board, "field_t", 0);
        setInt(board, "field_wb", 0);
        return board;
    }

    private static Object makeShape(int id) throws Exception {
        Object shape = allocate(Class.forName("rf"));
        setInt(shape, "field_m", id);
        setInt(shape, "field_e", 0);
        return shape;
    }

    private static void enqueue(Object board, Object shape) throws Exception {
        Method method = Class.forName("lk").getDeclaredMethod(
                "a", Class.forName("rf"), byte.class);
        method.setAccessible(true);
        method.invoke(board, shape, (byte) -120);
    }

    private static Object take(Object board) throws Exception {
        Method method = Class.forName("lk").getDeclaredMethod("b", int.class);
        method.setAccessible(true);
        return method.invoke(board, -19939);
    }

    public static void main(String[] args) throws Exception {
        Random random = new Random(8003L);
        int rows = 0;
        for (int trial = 0; trial < 256; trial++) {
            int count = 1 + random.nextInt(24);
            List<Integer> expected = new ArrayList<Integer>();
            for (int index = 0; index < count; index++) {
                expected.add(trial * 100 + index + 1);
            }
            Collections.shuffle(expected, random);

            Object board = makeBoard();
            for (int id : expected) {
                enqueue(board, makeShape(id));
            }
            for (int id : expected) {
                Object selected = take(board);
                int actual = field(selected.getClass(), "field_m").getInt(selected);
                int releases = field(selected.getClass(), "field_e").getInt(selected);
                if (actual != id || releases != 1) {
                    throw new AssertionError(
                            "trial=" + trial + " expected=" + id
                            + " actual=" + actual + " releases=" + releases);
                }
                rows++;
            }
        }
        System.out.println("CLIENT_QUEUE rows=" + rows + " mismatches=0");
    }
}
