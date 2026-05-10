.version 50 0
.class public super ChessFlagBad
.super java/lang/Object

.field public static G I

.method public static test : (I)I
    .code stack 2 locals 4
L0:     getstatic Field ChessFlagBad G I
L3:     istore_3
L4:     iconst_0
L5:     istore_1
L6:     iconst_0
L7:     istore_2
L8:     iload_1
L9:     iload_0
L10:    if_icmpge L70
L13:    iload_1
L14:    iconst_1
L15:    if_icmpne L25
L18:    iload_3
L19:    ifeq L40
L22:    goto L55
L25:    iload_1
L26:    iconst_2
L27:    if_icmpne L37
L30:    iload_3
L31:    ifeq L46
L34:    goto L55
L37:    goto L52
L40:    iinc 2 10
L43:    goto L52
L46:    iinc 2 20
L49:    goto L52
L52:    goto L60
L55:    iinc 2 100
L58:    goto L60
L60:    iinc 1 1
L63:    goto L8
L70:    iload_2
L71:    ireturn
    .end code
.end method
.end class
