.version 50 0
.class public super DeadReturnCatch
.super java/lang/Object

.method public <init> : ()V
    .code stack 1 locals 1
L0:     aload_0
L1:     invokespecial Method java/lang/Object <init> ()V
L4:     return
L5:
    .end code
.end method

.method public static d : (Ljava/lang/Object;B)Z
    .code stack 3 locals 3
        .catch java/lang/Throwable from L0 to L27 using L30
L0:     iload_1
L1:     bipush -68
L3:     if_icmpeq L16
L6:     aload_0
L7:     invokevirtual Method java/lang/Object hashCode ()I
L10:    pop
L11:    goto L16
L16:    aload_0
L17:    ifnull L26
L20:    goto L28
L26:    iconst_0
L27:    ireturn
        .catch java/lang/Throwable from L28 to L29 using L30
L28:    iconst_1
L29:    ireturn
        .stack stack_1 Object java/lang/Throwable
L30:    astore_2
L31:    aload_2
L32:    athrow
L33:
    .end code
.end method
.sourcefile "DeadReturnCatch.java"
.end class
