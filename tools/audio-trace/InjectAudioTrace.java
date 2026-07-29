import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.VarInsnNode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.stream.Stream;

public final class InjectAudioTrace {
    public static void main(String[] args) throws Exception {
        Path input = Paths.get(args[0]);
        Path output = Paths.get(args[1]);
        try (Stream<Path> files = Files.walk(input)) {
            for (Path file : (Iterable<Path>) files
                    .filter(path -> path.toString().endsWith(".class"))::iterator) {
                ClassReader reader = new ClassReader(Files.readAllBytes(file));
                ClassNode node = new ClassNode();
                reader.accept(node, 0);
                boolean changed = instrument(node);
                Path target = output.resolve(input.relativize(file));
                Files.createDirectories(target.getParent());
                if (!changed) {
                    Files.copy(file, target, StandardCopyOption.REPLACE_EXISTING);
                    continue;
                }
                ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                node.accept(writer);
                Files.write(target, writer.toByteArray());
                System.out.println("instrumented " + node.name);
            }
        }
    }

    private static boolean instrument(ClassNode node) {
        boolean changed = false;
        for (MethodNode method : node.methods) {
            if (node.name.equals("en") && method.name.equals("a") &&
                    method.desc.equals("([II)V")) {
                insertEntry(method, mixerStart());
                insertBeforeReturns(method, mixerEnd());
                changed = true;
            } else if (node.name.equals("en") && method.name.equals("b") &&
                    method.desc.equals("(I)V")) {
                insertEntry(method, catchup());
                changed = true;
            } else if (node.name.equals("ol") && method.name.equals("a") &&
                    method.desc.equals("([III)V")) {
                insertEntry(method, dispatch());
                changed = true;
            } else if (node.name.equals("ei") && method.name.equals("b") &&
                    method.desc.equals("([III)V")) {
                insertEntry(method, leafStart());
                insertBeforeReturns(method, leafEnd());
                changed = true;
            } else if (node.name.equals("ia") && method.name.equals("a") &&
                    method.desc.equals("(IIIIII)V")) {
                int stores = instrumentVoiceStore(method);
                if (stores != 1) {
                    throw new IllegalStateException(
                        "Expected exactly one ia.fb voice store, found " + stores);
                }
                changed = true;
            } else if (node.name.equals("va") && method.name.equals("<init>") &&
                    method.desc.equals("([B)V")) {
                insertBeforeReturns(method, compressedCreated());
                changed = true;
            } else if (node.name.equals("va") && method.name.equals("b") &&
                    method.desc.equals("([B)V")) {
                insertEntry(method, compressedHeader());
                insertBeforeReturns(method, compressedHeaderComplete());
                changed = true;
            } else if (node.name.equals("va") && method.name.equals("c") &&
                    method.desc.equals("()V")) {
                insertEntry(method, compressedCleanup());
                changed = true;
            } else if (node.name.equals("va") && method.name.equals("a") &&
                    (method.desc.equals("([I)Lud;") ||
                     method.desc.equals("()Lud;"))) {
                insertBeforeObjectReturns(method, decodedCreated());
                changed = true;
            } else if (node.name.equals("va") && method.name.equals("d") &&
                    method.desc.equals("(I)[F")) {
                insertEntry(method, packetDecodeStart());
                insertBeforeObjectReturns(method, packetDecodeEnd());
                changed = true;
            }
        }
        return changed;
    }

    private static void insertEntry(MethodNode method, InsnList probe) {
        method.instructions.insertBefore(method.instructions.getFirst(), probe);
    }

    private static void insertBeforeReturns(MethodNode method, InsnList template) {
        for (AbstractInsnNode instruction = method.instructions.getFirst();
                instruction != null; instruction = instruction.getNext()) {
            if (instruction.getOpcode() == Opcodes.RETURN) {
                method.instructions.insertBefore(instruction, clone(template));
            }
        }
    }

    private static void insertBeforeObjectReturns(MethodNode method, InsnList template) {
        for (AbstractInsnNode instruction = method.instructions.getFirst();
                instruction != null; instruction = instruction.getNext()) {
            if (instruction.getOpcode() == Opcodes.ARETURN) {
                method.instructions.insertBefore(instruction, clone(template));
            }
        }
    }

    private static int instrumentVoiceStore(MethodNode method) {
        int stores = 0;
        for (AbstractInsnNode instruction = method.instructions.getFirst();
                instruction != null; instruction = instruction.getNext()) {
            if (instruction.getOpcode() != Opcodes.AASTORE) continue;
            AbstractInsnNode cursor = instruction.getPrevious();
            boolean voiceArray = false;
            for (int distance = 0; cursor != null && distance < 5;
                    distance++, cursor = cursor.getPrevious()) {
                if (cursor instanceof FieldInsnNode) {
                    FieldInsnNode field = (FieldInsnNode) cursor;
                    if (field.owner.equals("ia") && field.name.equals("fb") &&
                            field.desc.equals("[Lei;")) {
                        voiceArray = true;
                        break;
                    }
                }
            }
            if (!voiceArray) continue;
            method.instructions.insert(instruction, voiceCreated());
            stores++;
        }
        return stores;
    }

    private static InsnList mixerStart() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new VarInsnNode(Opcodes.ILOAD, 2));
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new FieldInsnNode(Opcodes.GETFIELD, "en", "n", "I"));
        list.add(call("mixerStart", "(Ljava/lang/Object;II)V"));
        return list;
    }

    private static InsnList mixerEnd() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(call("mixerEnd", "(Ljava/lang/Object;)V"));
        return list;
    }

    private static InsnList catchup() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new VarInsnNode(Opcodes.ILOAD, 1));
        list.add(call("catchup", "(Ljava/lang/Object;I)V"));
        return list;
    }

    private static InsnList dispatch() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new FieldInsnNode(Opcodes.GETFIELD, "ol", "p", "Z"));
        list.add(new VarInsnNode(Opcodes.ILOAD, 3));
        list.add(call("dispatch", "(Ljava/lang/Object;ZI)V"));
        return list;
    }

    private static InsnList leafStart() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new VarInsnNode(Opcodes.ALOAD, 1));
        list.add(new VarInsnNode(Opcodes.ILOAD, 2));
        list.add(new VarInsnNode(Opcodes.ILOAD, 3));
        list.add(call("leafStart", "(Ljava/lang/Object;[III)V"));
        return list;
    }

    private static InsnList leafEnd() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new VarInsnNode(Opcodes.ALOAD, 1));
        list.add(new VarInsnNode(Opcodes.ILOAD, 2));
        list.add(new VarInsnNode(Opcodes.ILOAD, 3));
        list.add(call("leafEnd", "(Ljava/lang/Object;[III)V"));
        return list;
    }

    private static InsnList voiceCreated() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 7));
        for (int slot = 1; slot <= 6; slot++) {
            list.add(new VarInsnNode(Opcodes.ILOAD, slot));
        }
        list.add(call("voiceCreated", "(Ljava/lang/Object;IIIIII)V"));
        return list;
    }

    private static InsnList compressedCreated() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new VarInsnNode(Opcodes.ALOAD, 1));
        list.add(call("compressedCreated", "(Ljava/lang/Object;[B)V"));
        return list;
    }

    private static InsnList compressedHeader() {
        InsnList list = new InsnList();
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(call("compressedHeader", "([B)V"));
        return list;
    }

    private static InsnList compressedCleanup() {
        InsnList list = new InsnList();
        list.add(call("compressedCleanup", "()V"));
        return list;
    }

    private static InsnList compressedHeaderComplete() {
        InsnList list = new InsnList();
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "y", "I"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "B", "I"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "v", "[F"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "p", "[F"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "A", "[F"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "U", "[F"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "J", "[F"));
        list.add(new FieldInsnNode(Opcodes.GETSTATIC, "va", "M", "[F"));
        list.add(call(
            "compressedHeaderComplete", "(II[F[F[F[F[F[F)V"));
        return list;
    }

    private static InsnList packetDecodeStart() {
        InsnList list = new InsnList();
        list.add(call("packetDecodeStart", "()V"));
        return list;
    }

    private static InsnList packetDecodeEnd() {
        InsnList list = new InsnList();
        list.add(call("packetDecodeEnd", "()V"));
        return list;
    }

    private static InsnList decodedCreated() {
        InsnList list = new InsnList();
        list.add(new org.objectweb.asm.tree.InsnNode(Opcodes.DUP));
        list.add(new VarInsnNode(Opcodes.ALOAD, 0));
        list.add(new org.objectweb.asm.tree.InsnNode(Opcodes.SWAP));
        list.add(call("decodedCreated", "(Ljava/lang/Object;Ljava/lang/Object;)V"));
        return list;
    }

    private static MethodInsnNode call(String name, String descriptor) {
        return new MethodInsnNode(
            Opcodes.INVOKESTATIC, "AudioTrace", name, descriptor, false);
    }

    private static InsnList clone(InsnList source) {
        InsnList copy = new InsnList();
        for (AbstractInsnNode instruction = source.getFirst();
                instruction != null; instruction = instruction.getNext()) {
            copy.add(instruction.clone(null));
        }
        return copy;
    }
}
