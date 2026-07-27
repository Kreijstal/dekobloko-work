import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.VarInsnNode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.objectweb.asm.Opcodes.AALOAD;
import static org.objectweb.asm.Opcodes.ALOAD;
import static org.objectweb.asm.Opcodes.ARETURN;
import static org.objectweb.asm.Opcodes.ASTORE;
import static org.objectweb.asm.Opcodes.DUP;
import static org.objectweb.asm.Opcodes.ILOAD;
import static org.objectweb.asm.Opcodes.INVOKESTATIC;
import static org.objectweb.asm.Opcodes.ISTORE;
import static org.objectweb.asm.Opcodes.RETURN;

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
 * StackMapTable surgery (same reasoning as TraceInject).  The mid-method probes
 * added for the staging-area trace are inserted at points where the operand
 * stack is empty and which are not themselves jump targets, and every probe is
 * stack-neutral, so the existing frames stay valid; ASM's tree API re-emits the
 * FrameNodes at their (shifted) labels.  maxStack is raised by exactly what a
 * probe pushes, which is always sufficient: the depth at the insertion point is
 * by definition <= the original maxStack.
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
            boolean touched = false;

            if (cn.name.equals("client") && mn.name.equals("<init>")
                    && mn.desc.equals("()V")) {
                // Start a daemon which waits for the title resources, then
                // enters the real single-player path through reflection. This
                // works with the launcher's fake AWT and needs no X11 events.
                touched |= atReturns(mn, RETURN, false,
                        call("startSingleplayerBot", "()V",
                                new int[]{}, new int[]{}), 0);

            } else if (cn.name.equals("lk") && mn.name.equals("d")
                    && mn.desc.equals("(II)V")) {
                // The real bucket tick. Replace its control argument before
                // any client state changes, then capture the complete state at
                // every normal return. The helper also supplies the synthetic
                // clock barrier when the reflection bot is enabled.
                pre = call("beforeTick", "(Ljava/lang/Object;I)I",
                        new int[]{ALOAD, ILOAD}, new int[]{0, 1});
                pre.add(new VarInsnNode(ISTORE, 1));
                touched |= atReturns(mn, RETURN, false,
                        call("afterTick", "(Ljava/lang/Object;I)V",
                                new int[]{ALOAD, ILOAD}, new int[]{0, 1}), 2);

            } else if (cn.name.equals("lk") && mn.name.equals("a")
                    && mn.desc.equals("(Lrf;B)V")) {
                // The append itself.  Entry gives the queue BEFORE, the return
                // sites give it AFTER, which is the only way to see whether an
                // S2C 67 actually landed in field_X (grow-the-array bug or not).
                pre = call("stageBefore", "(Ljava/lang/Object;Ljava/lang/Object;)V",
                        new int[]{ALOAD, ALOAD}, new int[]{0, 1});
                touched |= atReturns(mn, RETURN, false,
                        call("stageAfter", "(Ljava/lang/Object;Ljava/lang/Object;)V",
                                new int[]{ALOAD, ALOAD}, new int[]{0, 1}), 2);

            } else if (cn.name.equals("lk") && mn.name.equals("b")
                    && mn.desc.equals("(I)Lrf;")) {
                // Takes ONE shape out of pending (field_e 0 -> 1).  Called both
                // from the S2C 66 handler in `client` and from qc's spawn path,
                // so the probe records its caller.  The ARETURN probe DUPs the
                // returned rf, which names exactly which shape was released.
                pre = call("releaseBefore", "(Ljava/lang/Object;I)V",
                        new int[]{ALOAD, ILOAD}, new int[]{0, 1});
                touched |= atReturns(mn, ARETURN, true,
                        call("releaseAfter", "(Ljava/lang/Object;Ljava/lang/Object;)V",
                                new int[]{ALOAD}, new int[]{0}), 3);

            } else if (cn.name.equals("qc") && mn.name.equals("a")
                    && mn.desc.equals("(Llk;IIIIZII)V")) {
                // The staging-area renderer: it walks i in [0, lk.t) over
                // lk.X[i] and draws each shape's cells on a rotating ring,
                // skipping any entry whose rf.c is null.  This is the only
                // reader of lk.X outside lk itself (verified against the
                // shipped bytecode, not the decompiled source, which does not
                // show the field access at all).
                pre = call("stagingDraw", "(Ljava/lang/Object;)V",
                        new int[]{ALOAD}, new int[]{1});

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
                touched = true;
            }

            if (cn.name.equals("client")) {
                touched |= patchClientHandlers(mn);
            }

            if (touched) {
                changed = true;
                System.out.println("  + " + cn.name + "." + mn.name + mn.desc);
            }
        }
        return changed;
    }

    /**
     * The two S2C opcode handlers, located by their unique call sites inside
     * the client's protocol state machine rather than by bytecode offset.
     *
     * opcode 66 (release):  slot=uf.d(), count=uf.d(), board=qc.g.p[slot],
     *                       then board.b(-19939) count times.
     * opcode 67 (cooked):   slot=uf.d(), shape=qc.db.a(true,true,uf),
     *                       then qc.g.p[slot].a(shape, -121).
     *
     * In both, the probe goes immediately after the ASTORE that parks the board
     * (66) or the shape (67): the operand stack is empty there and neither
     * instruction is a branch target, so no StackMapTable frame is disturbed.
     * The slot local is derived from the AALOAD index rather than hardcoded.
     */
    private static boolean patchClientHandlers(MethodNode mn) {
        boolean changed = false;
        for (AbstractInsnNode n : new ArrayList<AbstractInsnNode>(list(mn))) {
            if (!(n instanceof MethodInsnNode)) continue;
            MethodInsnNode m = (MethodInsnNode) n;

            if (m.owner.equals("lk") && m.name.equals("b") && m.desc.equals("(I)Lrf;")) {
                VarInsnNode store = prevStore(m);
                int slot = slotLocalBefore(store);
                int count = loopBoundBefore(m);
                if (store == null || slot < 0 || count < 0) {
                    System.out.println("  ! client S2C66 anchor not found");
                    continue;
                }
                mn.instructions.insert(store,
                        call("recv66", "(IILjava/lang/Object;)V",
                                new int[]{ILOAD, ILOAD, ALOAD},
                                new int[]{slot, count, store.var}));
                mn.maxStack += 3;
                changed = true;
                System.out.println("  + client S2C66 slot=L" + slot + " count=L" + count
                        + " board=L" + store.var);

            } else if (m.owner.equals("lk") && m.name.equals("a")
                    && m.desc.equals("(Lrf;B)V")) {
                VarInsnNode store = prevStore(m);
                int slot = slotLocalBefore(m);
                if (store == null || slot < 0) {
                    System.out.println("  ! client S2C67 anchor not found");
                    continue;
                }
                mn.instructions.insert(store,
                        call("recv67", "(ILjava/lang/Object;)V",
                                new int[]{ILOAD, ALOAD},
                                new int[]{slot, store.var}));
                mn.maxStack += 2;
                changed = true;
                System.out.println("  + client S2C67 slot=L" + slot
                        + " shape=L" + store.var);
            }
        }
        return changed;
    }

    private static List<AbstractInsnNode> list(MethodNode mn) {
        List<AbstractInsnNode> out = new ArrayList<AbstractInsnNode>();
        for (AbstractInsnNode n = mn.instructions.getFirst(); n != null; n = n.getNext()) {
            out.add(n);
        }
        return out;
    }

    /** Nearest ASTORE walking backwards from {@code from}. */
    private static VarInsnNode prevStore(AbstractInsnNode from) {
        for (AbstractInsnNode n = from.getPrevious(); n != null; n = n.getPrevious()) {
            if (n.getOpcode() == ASTORE) return (VarInsnNode) n;
        }
        return null;
    }

    /**
     * The board array is indexed as {@code qc.g.p[slot]}, so the ILOAD directly
     * in front of the nearest preceding AALOAD names the slot local.
     */
    private static int slotLocalBefore(AbstractInsnNode from) {
        if (from == null) return -1;
        for (AbstractInsnNode n = from.getPrevious(); n != null; n = n.getPrevious()) {
            if (n.getOpcode() == AALOAD) {
                AbstractInsnNode prev = prevReal(n);
                return prev != null && prev.getOpcode() == ILOAD
                        ? ((VarInsnNode) prev).var : -1;
            }
        }
        return -1;
    }

    /**
     * The release loop is {@code for (i = 0; i < count; i++) board.b(-19939)},
     * compiled as {@code iload i; iload count; if_icmpge end}. The ILOAD in
     * front of that comparison names the count local.
     */
    private static int loopBoundBefore(AbstractInsnNode from) {
        for (AbstractInsnNode n = from.getPrevious(); n != null; n = n.getPrevious()) {
            if (n.getOpcode() == org.objectweb.asm.Opcodes.IF_ICMPGE) {
                AbstractInsnNode prev = prevReal(n);
                return prev != null && prev.getOpcode() == ILOAD
                        ? ((VarInsnNode) prev).var : -1;
            }
        }
        return -1;
    }

    private static AbstractInsnNode prevReal(AbstractInsnNode n) {
        for (AbstractInsnNode p = n.getPrevious(); p != null; p = p.getPrevious()) {
            if (p.getOpcode() >= 0) return p;
        }
        return null;
    }

    /**
     * Clone {@code probe} in front of every {@code opcode} exit.
     *
     * With {@code dupReturnValue} the returned reference is DUPed first, so the
     * helper's first argument is the value the method is about to return.
     */
    private static boolean atReturns(MethodNode mn, int opcode, boolean dupReturnValue,
                                     InsnList probe, int peak) {
        List<AbstractInsnNode> exits = new ArrayList<AbstractInsnNode>();
        for (AbstractInsnNode n = mn.instructions.getFirst(); n != null; n = n.getNext()) {
            if (n.getOpcode() == opcode) exits.add(n);
        }
        if (exits.isEmpty()) return false;
        for (AbstractInsnNode exit : exits) {
            InsnList copy = new InsnList();
            if (dupReturnValue) copy.add(new InsnNode(DUP));
            for (AbstractInsnNode n = probe.getFirst(); n != null; n = n.getNext()) {
                if (n instanceof VarInsnNode) {
                    VarInsnNode v = (VarInsnNode) n;
                    copy.add(new VarInsnNode(v.getOpcode(), v.var));
                } else if (n instanceof MethodInsnNode) {
                    MethodInsnNode m = (MethodInsnNode) n;
                    copy.add(new MethodInsnNode(m.getOpcode(), m.owner, m.name, m.desc, false));
                }
            }
            mn.instructions.insertBefore(exit, copy);
        }
        mn.maxStack += peak;
        return true;
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
