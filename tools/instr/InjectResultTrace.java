import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.VarInsnNode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

import static org.objectweb.asm.Opcodes.ALOAD;
import static org.objectweb.asm.Opcodes.DUP2;
import static org.objectweb.asm.Opcodes.GETSTATIC;
import static org.objectweb.asm.Opcodes.ILOAD;
import static org.objectweb.asm.Opcodes.INVOKESTATIC;
import static org.objectweb.asm.Opcodes.PUTFIELD;

/**
 * Injects ResultTrace calls into the ORIGINAL gamepack's end-of-game path.
 *
 *   InjectResultTrace &lt;classesInDir&gt; &lt;classesOutDir&gt;
 *
 * Two kinds of probe:
 *
 *  1. Method-entry probes on the winner path
 *       eb.a(int,byte)             the winner index S2C 70 delivered
 *       qc.a(int)                  the banner selector and its inputs
 *       in.&lt;init&gt;(String,int,Z)    the banner text actually constructed
 *
 *  2. In-method probes inside client.i(byte), the packet dispatcher, on every
 *     write to qc.field_T and qc.field_r. Those two writes are what S2C 68 and
 *     S2C 69 do, and they happen inline in the dispatcher so there is no method
 *     to hook. The sequence inserted before each PUTFIELD is
 *
 *         DUP2                       ; duplicate (qc, value)
 *         GETSTATIC bh.k : I         ; the opcode currently being dispatched
 *         INVOKESTATIC ResultTrace.* ; consumes all three
 *
 *     which is stack-neutral, so the frames already attached to the method stay
 *     valid.
 *
 * Gamepack classes are major version 50, so no StackMapTable surgery is needed
 * (same reasoning as InjectGarbageTrace).
 */
public final class InjectResultTrace {

    public static void main(String[] args) throws Exception {
        Path in = Paths.get(args[0]);
        Path out = Paths.get(args[1]);
        int patched = 0;
        try (Stream<Path> s = Files.walk(in)) {
            for (Path p : (Iterable<Path>) s.filter(f -> f.toString().endsWith(".class"))::iterator) {
                ClassReader cr = new ClassReader(Files.readAllBytes(p));
                ClassNode cn = new ClassNode();
                cr.accept(cn, 0);
                if (instrument(cn)) patched++;
                ClassWriter cw = new ClassWriter(0);
                cn.accept(cw);
                Path dest = out.resolve(in.relativize(p));
                Files.createDirectories(dest.getParent());
                Files.write(dest, cw.toByteArray());
            }
        }
        System.out.println("instrumented " + patched + " class(es)");
    }

    private static boolean instrument(ClassNode cn) {
        boolean changed = false;
        for (MethodNode mn : cn.methods) {
            InsnList pre = null;

            if (cn.name.equals("eb") && mn.name.equals("a") && mn.desc.equals("(IB)V")) {
                // Sets eb.field_e, the winner index. S2C 70 is its only caller
                // with mode -70; the argument is a SIGNED byte off the wire.
                pre = call("winner", "(Ljava/lang/Object;II)V",
                        new int[]{ALOAD, ILOAD, ILOAD}, new int[]{0, 1, 2});

            } else if (cn.name.equals("qc") && mn.name.equals("a") && mn.desc.equals("(I)V")) {
                // The banner selector: compares field_g.field_e with field_P.
                pre = call("select", "(Ljava/lang/Object;I)V",
                        new int[]{ALOAD, ILOAD}, new int[]{0, 1});

            } else if (cn.name.equals("in") && mn.name.equals("<init>")
                    && mn.desc.equals("(Ljava/lang/String;IZ)V")) {
                // The banner that actually got built -- the resource chosen.
                pre = call("banner", "(Ljava/lang/String;IZ)V",
                        new int[]{ALOAD, ILOAD, ILOAD}, new int[]{1, 2, 3});
            }

            if (pre != null && mn.instructions.size() > 0) {
                // ClassWriter(0) does not recompute max_stack; the prologue's
                // peak depth is exactly its argument count.
                int pushed = 0;
                for (AbstractInsnNode n = pre.getFirst(); n != null; n = n.getNext()) {
                    if (n instanceof VarInsnNode) pushed++;
                }
                if (pushed > mn.maxStack) mn.maxStack = pushed;
                AbstractInsnNode first = mn.instructions.getFirst();
                if (mn.name.equals("<init>")) {
                    // A constructor's `this` is uninitialised until the super
                    // call, so the probe has to go after it. Only the String
                    // and the two ints are passed, so `this` is never touched.
                    AbstractInsnNode at = firstAfterSuperCall(mn);
                    mn.instructions.insert(at, pre);
                } else {
                    mn.instructions.insertBefore(first, pre);
                }
                changed = true;
                System.out.println("  + " + cn.name + "." + mn.name + mn.desc);
            }

            if (cn.name.equals("client") && mn.name.equals("i") && mn.desc.equals("(B)V")) {
                changed |= traceFieldWrites(mn);
            }
        }
        return changed;
    }

    /** The instruction after `invokespecial <super>.&lt;init&gt;`. */
    private static AbstractInsnNode firstAfterSuperCall(MethodNode mn) {
        for (AbstractInsnNode n = mn.instructions.getFirst(); n != null; n = n.getNext()) {
            if (n instanceof MethodInsnNode && ((MethodInsnNode) n).name.equals("<init>")) {
                return n;
            }
        }
        return mn.instructions.getFirst();
    }

    /**
     * Log every `PUTFIELD qc.T` / `PUTFIELD qc.r` in the dispatcher, together
     * with the opcode being dispatched. These are the S2C 68 and S2C 69 writes.
     */
    private static boolean traceFieldWrites(MethodNode mn) {
        boolean changed = false;
        for (AbstractInsnNode n = mn.instructions.getFirst(); n != null; n = n.getNext()) {
            if (n.getOpcode() != PUTFIELD) continue;
            FieldInsnNode fi = (FieldInsnNode) n;
            if (!fi.owner.equals("qc")) continue;
            String helper;
            if (fi.name.equals("T") || fi.name.equals("field_T")) {
                helper = "fieldT";
            } else if (fi.name.equals("r") || fi.name.equals("field_r")) {
                helper = "fieldR";
            } else {
                continue;
            }
            InsnList probe = new InsnList();
            probe.add(new InsnNode(DUP2));                       // (qc, value) x2
            probe.add(new FieldInsnNode(GETSTATIC, "bh", "k", "I"));
            probe.add(new MethodInsnNode(INVOKESTATIC, "ResultTrace", helper,
                    "(Ljava/lang/Object;II)V", false));
            mn.instructions.insertBefore(n, probe);
            // peak extra depth is the 2 duplicated slots plus the opcode
            if (mn.maxStack < 3) mn.maxStack = 3;
            mn.maxStack += 3;
            changed = true;
            System.out.println("  + client.i(B)V putfield qc." + fi.name + " -> " + helper);
        }
        return changed;
    }

    private static InsnList call(String helper, String desc, int[] opcodes, int[] slots) {
        InsnList list = new InsnList();
        for (int i = 0; i < opcodes.length; i++) {
            list.add(new VarInsnNode(opcodes[i], slots[i]));
        }
        list.add(new MethodInsnNode(INVOKESTATIC, "ResultTrace", helper, desc, false));
        return list;
    }
}
