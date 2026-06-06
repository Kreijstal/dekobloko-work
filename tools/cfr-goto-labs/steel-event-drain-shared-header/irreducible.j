.version 50 0
.class public super SteelEventDrainIrreducible
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
        getstatic Field SteelEventDrainIrreducible ticks I
        dup
        ifle Lfalse
        iconst_1
        isub
        putstatic Field SteelEventDrainIrreducible ticks I
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
        getstatic Field SteelEventDrainIrreducible mode I
        iload_0
        iadd
        putstatic Field SteelEventDrainIrreducible mode I
        return
    .end code
.end method

.method public static run : (IZ)V
    .code stack 2 locals 4
        iload_0
        putstatic Field SteelEventDrainIrreducible ticks I
        iload_1
        putstatic Field SteelEventDrainIrreducible ready Z
        iconst_0
        istore_2
        getstatic Field SteelEventDrainIrreducible primary Z
        ifne Lhead
        goto Lbody
Lhead:
        invokestatic Method SteelEventDrainIrreducible drain ()Z
        ifeq Lret
        getstatic Field SteelEventDrainIrreducible ready Z
        ifeq Lside
        getstatic Field SteelEventDrainIrreducible secondary Z
        ifeq Lbody
        goto Lhead
Lbody:
        iinc 2 1
        iload_2
        bipush 5
        if_icmpge Lret
        getstatic Field SteelEventDrainIrreducible mode I
        bipush 13
        if_icmpeq Lhead
        getstatic Field SteelEventDrainIrreducible ready Z
        ifne Lbody
Lside:
        bipush 7
        invokestatic Method SteelEventDrainIrreducible side (I)V
        goto Lhead
Lret:
        return
    .end code
.end method
.end class
