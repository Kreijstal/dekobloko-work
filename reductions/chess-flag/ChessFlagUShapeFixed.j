.version 50 0
.class public super ChessFlagUShapeFixed
.super java/lang/Object

.field public static G I
.field public static M I

.method public static test : ()I
    .code stack 3 locals 5
L0:     iconst_0
L3:     istore 4
L5:     getstatic Field ChessFlagUShapeFixed M I
L8:     istore_0
L9:     bipush 14
L11:    istore_1
L12:    getstatic Field ChessFlagUShapeFixed M I
L15:    istore_2
L16:    bipush -2
L18:    iload_2
L19:    iconst_m1
L20:    ixor
L21:    if_icmpeq L32
L24:    iconst_0
L25:    iload_2
L26:    if_icmpeq L88
L29:    goto L88
L32:    iconst_1
L33:    istore_2
L34:    iload_2
L35:    iload_1
L36:    if_icmpge L83
L39:    iload 4
L41:    ifne L170
L44:    iload_0
L45:    iload_2
L46:    iadd
L47:    istore_0
L48:    iload_2
L49:    iconst_3
L50:    if_icmpne L60
L53:    iload_0
L54:    bipush 10
L56:    iadd
L57:    istore_0
L60:    iinc 2 1
L63:    iload 4
L65:    ifeq L34
L68:    iload 4
L70:    ifeq L160
L73:    goto L88
L83:    iload 4
L85:    ifeq L160
L88:    iconst_1
L89:    istore_2
L90:    iload_2
L91:    iconst_m1
L92:    ixor
L93:    iload_1
L94:    iconst_m1
L95:    ixor
L96:    if_icmple L160
L99:    iload_2
L100:   iconst_m1
L101:   ixor
L102:   bipush -14
L104:   iload 4
L106:   ifne L109
L109:   if_icmpeq L115
L112:   goto L130
L115:   iload_0
L116:   bipush 7
L118:   iadd
L119:   istore_0
L120:   iload 4
L122:   ifne L145
L125:   iload 4
L127:   ifeq L150
L130:   iload_0
L131:   iload_2
L132:   iadd
L133:   istore_0
L134:   iinc 2 1
L137:   iload 4
L139:   ifeq L90
L142:   goto L145
L145:   iload_0
L146:   bipush 100
L148:   iadd
L149:   istore_0
L150:   iload_0
L151:   bipush 3
L153:   iadd
L154:   istore_0
L155:   goto L160
L160:   iload_0
L161:   ireturn
L170:   goto L88
    .end code
.end method
.end class
