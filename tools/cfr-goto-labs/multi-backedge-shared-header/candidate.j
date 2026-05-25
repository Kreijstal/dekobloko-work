.version 50 0
.class public super MultiBackedgeSharedHeaderCandidate
.super java/lang/Object

.method public static run : (II)I
    .code stack 2 locals 4
L0:     iconst_0
        istore_2
        iconst_0
        istore_3
Lhead:
        iload_2
        iload_0
        if_icmpge Lret
        iload_2
        iconst_1
        iand
        ifeq LincA
        iload_2
        iconst_2
        iand
        ifeq LincB
        iload_2
        iconst_4
        iand
        ifeq LincC
        goto LincD
LincA:
        iinc 3 1
        iinc 2 1
        goto Lhead
LincB:
        iinc 3 2
        iinc 2 1
        goto Lhead
LincC:
        iinc 3 3
        iinc 2 1
        goto Lhead
LincD:
        iinc 3 4
        iinc 2 1
        goto Lhead
Lret:
        iload_3
        ireturn
    .end code
.end method
.end class
