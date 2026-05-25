.version 50 0
.class public super NestedSentinelBefore
.super java/lang/Object

.method public static decode : (II)V
    .code stack 2 locals 4
L0:     iconst_0
        istore_2
Louter:
        iload_2
        iload_0
        if_icmpge Lret
        iconst_0
        istore_3
Linner:
        iload_3
        iload_1
        if_icmpge LnextRow
        iload_3
        sipush 255
        if_icmpne Lnormal
        iconst_m1
        istore_3
Lnormal:
        iinc 3 1
        goto Linner
LnextRow:
        iinc 2 1
        goto Louter
Lret:
        return
    .end code
.end method
.end class
