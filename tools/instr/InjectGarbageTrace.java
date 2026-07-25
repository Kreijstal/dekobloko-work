import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.VarInsnNode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

import static org.objectweb.asm.Opcodes.ALOAD;
import static org.objectweb.asm.Opcodes.ILOAD;
import static org.objectweb.asm.Opcodes.INVOKESTATIC;

/**
 * Injects GarbageTrace calls into the ORIGINAL gamepack's incoming-garbage path.
 *
 *   InjectGarbageTrace <classesInDir> <classesOutDir>
 *
 * Instrumenting the original bytecode rather than recompiling decompiled
 * sources keeps the decompiler out of the picture entirely -- the client under
 * test stays the shipped one, plus logging.
 *
 * Gamepack classes are major version 50, so inserting at method entry needs no
 * StackMapTable surgery (same reasoning as TraceInject).
 */
public final class InjectGarbageTrace {

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

            if (cn.name.equals("lk") && mn.name.equals("a")
                    && mn.desc.equals("(Lrf;B)V")) {
                // S2C 67: append a cooked shape to the incoming queue.
                pre = call("stage", "(Ljava/lang/Object;Ljava/lang/Object;)V",
                        new int[]{ALOAD, ALOAD}, new int[]{0, 1});

            } else if (cn.name.equals("lk") && mn.name.equals("b")
                    && mn.desc.equals("(I)Lrf;")) {
                // S2C 66: start a staged shape's exit animation.
                pre = call("release", "(Ljava/lang/Object;I)V",
                        new int[]{ALOAD, ILOAD}, new int[]{0, 1});

            } else if (cn.name.equals("lk") && mn.name.equals("a")
                    && mn.desc.equals("(IILrf;)V")) {
                // S2C 64 / spawn: install a shape as the active falling piece.
                pre = call("install", "(Ljava/lang/Object;Ljava/lang/Object;)V",
                        new int[]{ALOAD, ALOAD}, new int[]{0, 3});

            } else if (cn.name.equals("lk") && mn.name.equals("p")
                    && mn.desc.equals("(I)Lrf;")) {
                // A staged shape leaves the queue for good.
                pre = call("drop", "(Ljava/lang/Object;)V",
                        new int[]{ALOAD}, new int[]{0});

            } else if (cn.name.equals("lk") && mn.name.equals("c")
                    && mn.desc.equals("(III)V")) {
                // The lock routine. On repeated placement failure it sets
                // field_y and then field_Bb, which is what makes qc raise the
                // T5 self-disconnect. Its entry state shows the board the
                // replica actually believes in when it gives up.
                pre = call("lock", "(Ljava/lang/Object;III)V",
                        new int[]{ALOAD, ILOAD, ILOAD, ILOAD}, new int[]{0, 1, 2, 3});

            } else if (cn.name.equals("lk") && mn.name.equals("a")
                    && mn.desc.equals("(IIIZII)V")) {
                // The authoritative landing from S2C 64: param4/param5 are the
                // server's final_x/final_y and param2 the target orientation.
                // Logging them next to the board identity answers directly
                // whether the replica commits where the server said, which
                // reading the decompiled source cannot settle.
                pre = call("landing", "(Ljava/lang/Object;IIIII)V",
                        new int[]{ALOAD, ILOAD, ILOAD, ILOAD, ILOAD, ILOAD},
                        new int[]{0, 1, 2, 3, 5, 6});

            } else if (cn.name.equals("qk") && mn.name.equals("a")
                    && mn.desc.equals("(I)V")) {
                // The client asking its own connection to close: sets g=true,
                // qk.run() then closes the socket. The server sees only an
                // unexplained EOF, so this is where the real reason lives.
                pre = call("closing", "(Ljava/lang/Object;I)V",
                        new int[]{ALOAD, ILOAD}, new int[]{0, 1});

            } else if (cn.name.equals("dh") && mn.name.equals("a")
                    && mn.desc.equals("(Ljava/lang/Throwable;Ljava/lang/String;)Ljb;")) {
                // The obfuscator's catch-all exception wrapper. Every method
                // funnels caught exceptions through here, so a protocol parse
                // failure surfaces here and essentially nowhere else. Static,
                // so the args are slots 0 and 1.
                pre = call("wrapped", "(Ljava/lang/Throwable;Ljava/lang/String;)V",
                        new int[]{ALOAD, ALOAD}, new int[]{0, 1});

            } else if (cn.name.equals("oi") && mn.name.equals("a")
                    && mn.desc.equals("(Lrf;I)V")) {
                // Shape-cache insert: throws IllegalArgumentException on a
                // duplicate id, which is how the first build killed the client.
                pre = call("cache", "(Ljava/lang/Object;I)V",
                        new int[]{ALOAD, ILOAD}, new int[]{1, 2});
            }

            if (pre != null && mn.instructions.size() > 0) {
                // ClassWriter(0) does not recompute max_stack, so a probe that
                // pushes more arguments than the method's original limit is
                // rejected by the verifier ("Operand stack overflow").  The
                // prologue is loads followed by one INVOKESTATIC that consumes
                // them all, so its peak depth is exactly the argument count --
                // no need for COMPUTE_MAXS and its whole-method recomputation.
                int pushed = 0;
                for (AbstractInsnNode n = pre.getFirst(); n != null; n = n.getNext()) {
                    if (n instanceof VarInsnNode) pushed++;   // all 1-slot args
                }
                if (pushed > mn.maxStack) mn.maxStack = pushed;
                AbstractInsnNode first = mn.instructions.getFirst();
                mn.instructions.insertBefore(first, pre);
                changed = true;
                System.out.println("  + " + cn.name + "." + mn.name + mn.desc);
            }
        }
        return changed;
    }

    private static InsnList call(String helper, String desc, int[] opcodes, int[] slots) {
        InsnList list = new InsnList();
        for (int i = 0; i < opcodes.length; i++) {
            list.add(new VarInsnNode(opcodes[i], slots[i]));
        }
        list.add(new MethodInsnNode(INVOKESTATIC, "GarbageTrace", helper, desc, false));
        return list;
    }
}
