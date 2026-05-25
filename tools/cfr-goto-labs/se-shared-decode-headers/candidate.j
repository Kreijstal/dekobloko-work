.version 50 0
.class public super SeSharedDecodeHeadersCandidate
.super java/lang/Object

.method public static decode : ([B[[II)V
    .code stack 4 locals 8
L0:     iconst_0
        istore_3
        aload_1
        astore 4
        iconst_0
        istore 5
L583:
        aload_1
        arraylength
        iconst_m1
        ixor
        iload 5
        iconst_m1
        ixor
        if_icmpge Lret
        iload_3
        aload_0
        arraylength
        if_icmplt LreadLen
        return
LreadLen:
        sipush 255
        aload_0
        iload_3
        iinc 3 1
        baload
        iand
        istore 6
        iload 6
        iconst_m1
        ixor
        iconst_m1
        if_icmpne LlenOk
        aload 4
        iload 5
        aconst_null
        aastore
        goto L792
LlenOk:
        aload_0
        arraylength
        iconst_m1
        ixor
        iload 6
        iload_3
        ineg
        isub
        iconst_m1
        ixor
        if_icmpgt LboundsBad
        goto LboundsOk
LboundsBad:
        return
LboundsOk:
        aload_1
        iload 5
        aaload
        ifnonnull LmaybeReuse
        aload_1
        iload 5
        iload 6
        newarray int
        aastore
        goto LstartInner
LmaybeReuse:
        aload_1
        iload 5
        aaload
        arraylength
        iconst_m1
        ixor
        iload 6
        iconst_m1
        ixor
        if_icmpne LnewRow
        goto LstartInner
LnewRow:
        aload_1
        iload 5
        iload 6
        newarray int
        aastore
LstartInner:
        iconst_0
        istore 7
L687:
        iload 6
        iload 7
        if_icmple L806
        aload_1
        iload 5
        aaload
        iload 7
        sipush 255
        aload_0
        iload_3
        iinc 3 1
        baload
        iand
        iastore
        aload_1
        iload 5
        aaload
        iload 7
        iaload
        sipush 255
        if_icmpeq L731
        goto L746
L731:
        aload_1
        iload 5
        aaload
        iload 7
        iconst_m1
        iastore
        goto L687
L746:
        iinc 7 1
        goto L687
L752:
        iinc 7 1
        goto L687
L764:
        iload 5
        iinc 5 1
        goto L583
L778:
        iload 5
        iinc 5 1
        goto L583
L792:
        iload 5
        iinc 5 1
        goto L583
L806:
        iload 5
        iinc 5 1
        goto L583
Lret:
        return
    .end code
.end method
.end class
