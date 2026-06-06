.version 50 0
.class public super SteelEventDrainIrreducibleAfter
.super java/lang/Object

.field private static ready Z
.field private static primary Z
.field private static secondary Z
.field private static mode I
.field private static ticks I

.method public <init> : ()V
    .code stack 1 locals 1
        aload_0
        invokespecial Method java/lang/Object <init> ()V
        return
    .end code
.end method

.method private static drain : ()Z
    .code stack 2 locals 0
        getstatic Field SteelEventDrainIrreducibleAfter ticks I
        dup
        ifle Lfalse
        iconst_1
        isub
        putstatic Field SteelEventDrainIrreducibleAfter ticks I
        iconst_1
        ireturn
Lfalse:
        pop
        iconst_0
        ireturn
    .end code
.end method

.method private static side : (I)V
    .code stack 2 locals 1
        getstatic Field SteelEventDrainIrreducibleAfter mode I
        iload_0
        iadd
        putstatic Field SteelEventDrainIrreducibleAfter mode I
        return
    .end code
.end method

.method public static run : (IZ)V
    .code stack 2 locals 4
        iload_0
        putstatic Field SteelEventDrainIrreducibleAfter ticks I
        iload_1
        putstatic Field SteelEventDrainIrreducibleAfter ready Z
        iconst_0
        istore_2
        getstatic Field SteelEventDrainIrreducibleAfter primary Z
        ifeq LbodyEntry
        goto Lhead
LbodyEntry:
        goto LbodyFromHead
Lhead:
        invokestatic Method SteelEventDrainIrreducibleAfter drain ()Z
        ifeq Lret
        getstatic Field SteelEventDrainIrreducibleAfter ready Z
        ifeq Lside
        getstatic Field SteelEventDrainIrreducibleAfter secondary Z
        ifne Lhead
LbodyFromHead:
        iinc 2 1
        iload_2
        bipush 5
        if_icmpge Lret
        getstatic Field SteelEventDrainIrreducibleAfter mode I
        bipush 13
        if_icmpeq Lhead
        getstatic Field SteelEventDrainIrreducibleAfter ready Z
        ifne LbodyFromHead
Lside:
        bipush 7
        invokestatic Method SteelEventDrainIrreducibleAfter side (I)V
        goto Lhead
Lret:
        return
    .end code
.end method
.end class
