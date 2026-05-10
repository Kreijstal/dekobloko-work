import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.ClassVisitor;
import jdk.internal.org.objectweb.asm.ClassWriter;
import jdk.internal.org.objectweb.asm.MethodVisitor;
import jdk.internal.org.objectweb.asm.Opcodes;

public final class AwtRequestFocusCompat {
    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            throw new IllegalArgumentException("usage: AwtRequestFocusCompat <class files...>");
        }
        for (String arg : args) {
            Path path = Path.of(arg);
            byte[] in = Files.readAllBytes(path);
            ClassReader reader = new ClassReader(in);
            ClassWriter writer = new ClassWriter(0);
            PatchVisitor visitor = new PatchVisitor(writer);
            reader.accept(visitor, 0);
            if (visitor.changed) {
                Files.write(path, writer.toByteArray());
                System.out.println("patched " + path);
            }
        }
    }

    private static final class PatchVisitor extends ClassVisitor {
        boolean changed;

        PatchVisitor(ClassVisitor delegate) {
            super(Opcodes.ASM6, delegate);
        }

        @Override
        public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
            MethodVisitor delegate = super.visitMethod(access, name, descriptor, signature, exceptions);
            return new MethodVisitor(Opcodes.ASM6, delegate) {
                private boolean skipPopAfterRequestFocus;

                @Override
                public void visitMethodInsn(int opcode, String owner, String name, String descriptor, boolean isInterface) {
                    if (
                        opcode == Opcodes.INVOKEVIRTUAL
                            && (owner.equals("java/awt/Canvas")
                                || owner.equals("java/awt/Frame")
                                || owner.equals("java/awt/Component"))
                            && name.equals("requestFocus")
                            && descriptor.equals("()Z")
                    ) {
                        changed = true;
                        skipPopAfterRequestFocus = true;
                        super.visitMethodInsn(opcode, owner, name, "()V", isInterface);
                        return;
                    }
                    skipPopAfterRequestFocus = false;
                    super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
                }

                @Override
                public void visitInsn(int opcode) {
                    if (skipPopAfterRequestFocus && opcode == Opcodes.POP) {
                        skipPopAfterRequestFocus = false;
                        return;
                    }
                    skipPopAfterRequestFocus = false;
                    super.visitInsn(opcode);
                }
            };
        }
    }
}
