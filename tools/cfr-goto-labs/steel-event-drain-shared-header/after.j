.version 50 0
.class public super SteelEventDrainAfter
.super java/lang/Object

.field private static ready Z
.field private static primary Z
.field private static secondary Z
.field private static mode I
.field private static ticks I

.method public <init> : ()V
    .code stack 1 locals 1
L0:     aload_0
        invokespecial Method java/lang/Object <init> ()V
        return
    .end code
.end method

.method private static drain : ()Z
    .code stack 2 locals 0
        getstatic Field SteelEventDrainAfter ticks I
        dup
        ifle Lfalse
        iconst_1
        isub
        putstatic Field SteelEventDrainAfter ticks I
        iconst_1
        ireturn
Lfalse:
        pop
        iconst_0
        ireturn
    .end code
.end method

.method private static hit : ()Z
    .code stack 1 locals 0
        getstatic Field SteelEventDrainAfter ready Z
        ireturn
    .end code
.end method

.method private static side : (I)V
    .code stack 2 locals 1
        getstatic Field SteelEventDrainAfter mode I
        iload_0
        iadd
        putstatic Field SteelEventDrainAfter mode I
        return
    .end code
.end method

.method public static run : (IZ)V
    .code stack 2 locals 4
L0:     iload_0
        putstatic Field SteelEventDrainAfter ticks I
        iload_1
        putstatic Field SteelEventDrainAfter ready Z
        iconst_0
        istore_2
Louter:
        iload_2
        iconst_3
        if_icmpge Lret
        iinc 2 1
        invokestatic Method SteelEventDrainAfter hit ()Z
        ifeq LafterDrain
        goto Lhead
LcontinueA:
        goto Lhead
LcontinueB:
        goto Lhead
LcontinueC:
        goto Lhead
Lhead:
        invokestatic Method SteelEventDrainAfter drain ()Z
        ifeq LafterDrain
        getstatic Field SteelEventDrainAfter primary Z
        ifeq LbreakA
        getstatic Field SteelEventDrainAfter secondary Z
        ifne LcheckHit
        getstatic Field SteelEventDrainAfter mode I
        bipush 13
        if_icmpeq LcontinueA
        goto LbreakB
LcheckHit:
        invokestatic Method SteelEventDrainAfter hit ()Z
        ifne LcontinueB
LbreakB:
        getstatic Field SteelEventDrainAfter primary Z
        ifne LcontinueC
        getstatic Field SteelEventDrainAfter secondary Z
        ifeq LcontinueA
        bipush 7
        invokestatic Method SteelEventDrainAfter side (I)V
        goto LcontinueB
LbreakA:
        iconst_3
        invokestatic Method SteelEventDrainAfter side (I)V
        goto Louter
LafterDrain:
        getstatic Field SteelEventDrainAfter mode I
        iflt Lret
        goto Louter
Lret:
        return
    .end code
.end method
.end class
