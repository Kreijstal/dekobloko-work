.version 50 0
.class public super SteelEventDrainBefore
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
        getstatic Field SteelEventDrainBefore ticks I
        dup
        ifle Lfalse
        iconst_1
        isub
        putstatic Field SteelEventDrainBefore ticks I
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
        getstatic Field SteelEventDrainBefore ready Z
        ireturn
    .end code
.end method

.method private static side : (I)V
    .code stack 2 locals 1
        getstatic Field SteelEventDrainBefore mode I
        iload_0
        iadd
        putstatic Field SteelEventDrainBefore mode I
        return
    .end code
.end method

.method public static run : (IZ)V
    .code stack 2 locals 4
L0:     iload_0
        putstatic Field SteelEventDrainBefore ticks I
        iload_1
        putstatic Field SteelEventDrainBefore ready Z
        iconst_0
        istore_2
Louter:
        iload_2
        iconst_3
        if_icmpge Lret
        iinc 2 1
        invokestatic Method SteelEventDrainBefore hit ()Z
        ifeq LafterDrain
Lhead:
        invokestatic Method SteelEventDrainBefore drain ()Z
        ifeq LafterDrain
        getstatic Field SteelEventDrainBefore primary Z
        ifeq LbreakA
        getstatic Field SteelEventDrainBefore secondary Z
        ifne LcheckHit
        getstatic Field SteelEventDrainBefore mode I
        bipush 13
        if_icmpeq Lhead
        goto LbreakB
LcheckHit:
        invokestatic Method SteelEventDrainBefore hit ()Z
        ifne Lhead
LbreakB:
        getstatic Field SteelEventDrainBefore primary Z
        ifne Lhead
        getstatic Field SteelEventDrainBefore secondary Z
        ifeq Lhead
        bipush 7
        invokestatic Method SteelEventDrainBefore side (I)V
        goto Lhead
LbreakA:
        iconst_3
        invokestatic Method SteelEventDrainBefore side (I)V
        goto Louter
LafterDrain:
        getstatic Field SteelEventDrainBefore mode I
        iflt Lret
        goto Louter
Lret:
        return
    .end code
.end method
.end class
