import java.nio.file.Files;
import java.nio.file.Path;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.ClassVisitor;
import jdk.internal.org.objectweb.asm.ClassWriter;
import jdk.internal.org.objectweb.asm.MethodVisitor;
import jdk.internal.org.objectweb.asm.Opcodes;

public final class PrintHnCrash {
    public static void main(String[] args) throws Exception {
        Path path = Path.of(args[0]);
        byte[] in = Files.readAllBytes(path);
        ClassReader reader = new ClassReader(in);
        ClassWriter writer = new ClassWriter(0);
        reader.accept(new Visitor(writer), 0);
        Files.write(path, writer.toByteArray());
    }

    private static final class Visitor extends ClassVisitor {
        Visitor(ClassVisitor delegate) {
            super(Opcodes.ASM6, delegate);
        }

        @Override
        public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
            MethodVisitor delegate = super.visitMethod(access, name, descriptor, signature, exceptions);
            if (!name.equals("a") || !descriptor.equals("(Ljava/lang/String;IIZIII)V")) {
                return delegate;
            }
            return new MethodVisitor(Opcodes.ASM6, delegate) {
                @Override
                public void visitVarInsn(int opcode, int var) {
                    super.visitVarInsn(opcode, var);
                    if (opcode == Opcodes.ASTORE && var == 8) {
                        super.visitVarInsn(Opcodes.ALOAD, 8);
                        super.visitMethodInsn(
                                Opcodes.INVOKEVIRTUAL,
                                "java/lang/Throwable",
                                "printStackTrace",
                                "()V",
                                false);
                    }
                }
            };
        }
    }
}
