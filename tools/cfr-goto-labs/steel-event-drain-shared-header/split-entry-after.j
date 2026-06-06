.version 50 0
.class public super SteelEventDrainSplitEntryAfter
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
        getstatic Field SteelEventDrainSplitEntryAfter ticks I
        dup
        ifle Lfalse
        iconst_1
        isub
        putstatic Field SteelEventDrainSplitEntryAfter ticks I
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
        getstatic Field SteelEventDrainSplitEntryAfter mode I
        iload_0
        iadd
        putstatic Field SteelEventDrainSplitEntryAfter mode I
        return
    .end code
.end method

.method public static run : (IZ)V
    .code stack 2 locals 4
        iload_0
        putstatic Field SteelEventDrainSplitEntryAfter ticks I
        iload_1
        putstatic Field SteelEventDrainSplitEntryAfter ready Z
        iconst_0
        istore_2
        getstatic Field SteelEventDrainSplitEntryAfter primary Z
        ifne Lhead

LpreBody:
        iinc 2 1
        iload_2
        bipush 5
        if_icmpge Lret
        getstatic Field SteelEventDrainSplitEntryAfter mode I
        bipush 13
        if_icmpeq Lhead
        getstatic Field SteelEventDrainSplitEntryAfter ready Z
        ifne LpreBody
        bipush 7
        invokestatic Method SteelEventDrainSplitEntryAfter side (I)V
        goto Lhead

Lhead:
        invokestatic Method SteelEventDrainSplitEntryAfter drain ()Z
        ifeq Lret
        getstatic Field SteelEventDrainSplitEntryAfter ready Z
        ifeq Lside
        getstatic Field SteelEventDrainSplitEntryAfter secondary Z
        ifeq Lbody
        goto Lhead
Lbody:
        iinc 2 1
        iload_2
        bipush 5
        if_icmpge Lret
        getstatic Field SteelEventDrainSplitEntryAfter mode I
        bipush 13
        if_icmpeq Lhead
        getstatic Field SteelEventDrainSplitEntryAfter ready Z
        ifne Lbody
Lside:
        bipush 7
        invokestatic Method SteelEventDrainSplitEntryAfter side (I)V
        goto Lhead
Lret:
        return
    .end code
.end method
.end class
