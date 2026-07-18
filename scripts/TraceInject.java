import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.LdcInsnNode;
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
 * Injects TraceHelper entry logging into selected gamepack methods so the SAME
 * instrumented classes can run on a real JVM and on jvm.js, making their
 * behaviour diffable line-by-line (dekobloko JS5 divergence hunt).
 *
 *   TraceInject <classesInDir> <classesOutDir>
 *
 * Gamepack classes are major version 50, so inserting instructions at method
 * entry needs no StackMapTable surgery.
 */
public final class TraceInject {

    public static void main(String[] args) throws Exception {
        Path in = Paths.get(args[0]);
        Path out = Paths.get(args[1]);
        try (Stream<Path> s = Files.walk(in)) {
            for (Path p : (Iterable<Path>) s.filter(f -> f.toString().endsWith(".class"))::iterator) {
                ClassReader cr = new ClassReader(Files.readAllBytes(p));
                ClassNode cn = new ClassNode();
                cr.accept(cn, 0);
                boolean changed = instrument(cn);
                Path target = out.resolve(in.relativize(p));
                Files.createDirectories(target.getParent());
                if (changed) {
                    // Old verifier (<=49) needs no StackMapTable, so entry
                    // injection cannot trip the split verifier.
                    cn.version = Math.min(cn.version, 49);
                    ClassWriter cw = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                    cn.accept(cw);
                    Files.write(target, cw.toByteArray());
                    System.out.println("instrumented " + cn.name);
                } else {
                    Files.copy(p, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    private static boolean instrument(ClassNode cn) {
        boolean changed = false;
        for (MethodNode m : cn.methods) {
            InsnList pre = new InsnList();
            String id = cn.name + "." + m.name + m.desc;
            if (cn.name.equals("ad") && m.name.equals("<init>") && m.desc.equals("([BI[B)V")) {
                pre.add(logBytes(id + " a1", 1));
                pre.add(logInt(id + " a2", 2));
                pre.add(logBytes(id + " a3", 3));
            } else if (cn.name.equals("le") && m.name.equals("a") && m.desc.equals("(IIB)Lsf;")) {
                pre.add(logInt(id + " i1", 1));
                pre.add(logInt(id + " i2", 2));
            } else if (cn.name.equals("um") && m.name.equals("a") && m.desc.equals("(I[BII)[B")) {
                // static: args start at slot 0
                pre.add(logInt(id + " i1", 0));
                pre.add(logBytes(id + " data", 1));
                pre.add(logInt(id + " i3", 2));
                pre.add(logInt(id + " i4", 3));
            } else {
                continue;
            }
            m.instructions.insertBefore(m.instructions.getFirst(), pre);
            changed = true;
        }
        return changed;
    }

    private static InsnList logBytes(String tag, int slot) {
        InsnList l = new InsnList();
        l.add(new LdcInsnNode(tag));
        l.add(new VarInsnNode(ALOAD, slot));
        l.add(new MethodInsnNode(INVOKESTATIC, "TraceHelper", "b", "(Ljava/lang/String;[B)V", false));
        return l;
    }

    private static InsnList logInt(String tag, int slot) {
        InsnList l = new InsnList();
        l.add(new LdcInsnNode(tag));
        l.add(new VarInsnNode(ILOAD, slot));
        l.add(new MethodInsnNode(INVOKESTATIC, "TraceHelper", "i", "(Ljava/lang/String;I)V", false));
        return l;
    }
}
