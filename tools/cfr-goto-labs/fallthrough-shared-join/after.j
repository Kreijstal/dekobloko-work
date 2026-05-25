.version 50 0
.class public super FallthroughSharedJoinAfter
.super java/lang/Object

.method public static c : (I)V
    .code stack 1 locals 1
L0:     iload_0
L1:     ifle L30_clone
L4:     iload_0
L5:     ifeq L40
L8:     iload_0
L9:     ifne L4
L30:    iinc          0 0
L40:    iinc          0 0
L42:    return
L30_clone:
        iinc          0 0
        goto L40
    .end code
.end method
.end class
