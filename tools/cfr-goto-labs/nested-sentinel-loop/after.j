.version 50 0
.class public super NestedSentinelAfter
.super java/lang/Object

.method public static decode : (II)V
    .code stack 2 locals 4
L0:     iconst_0
        istore_2
        iload_0
        ifle LouterAdvanceClone
Louter:
        iload_2
        iload_0
        if_icmpge Lret
        iconst_0
        istore_3
        iload_1
        ifle LouterAdvance
Linner:
        iload_3
        iload_1
        if_icmpge LouterAdvance
        iload_3
        sipush 255
        if_icmpeq Lsentinel
        iload_3
        ifeq LinnerAdvance
        goto LinnerAdvance2
Lsentinel:
        iconst_m1
        istore_3
        iinc 3 1
        goto Linner
LinnerAdvance:
        iinc 3 1
        goto Linner
LinnerAdvance2:
        iinc 3 1
        goto Linner
LouterAdvance:
        iinc 2 1
        goto Louter
LouterAdvanceClone:
        iinc 2 1
        goto Louter
Lret:
        return
    .end code
.end method
.end class
