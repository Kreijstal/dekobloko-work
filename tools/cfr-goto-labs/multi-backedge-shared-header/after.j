.version 50 0
.class public super MultiBackedgeSharedHeaderAfter
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
        ifeq LaddA
        iload_2
        iconst_2
        iand
        ifeq LaddB
        iload_2
        iconst_4
        iand
        ifeq LaddC
        iinc 3 4
        goto LincOne
LaddA:
        iinc 3 1
        goto LincOne
LaddB:
        iinc 3 2
        goto LincOne
LaddC:
        iinc 3 3
LincOne:
        iinc 2 1
        goto Lhead
Lret:
        iload_3
        ireturn
    .end code
.end method
.end class
