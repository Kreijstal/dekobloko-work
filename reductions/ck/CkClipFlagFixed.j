.version 50 0
.class public super CkClipFlagFixed
.super java/lang/Object

; Flag-based hand fix for CkClipBad.
; Instead of duplicating the scan continuation, use a synthetic int local 12
; as "enter scan" after each clipping stage.
.method public static test : (IIIIII)I
    .code stack 3 locals 13
L0:     iconst_0
L1:     istore        6
L3:     iconst_0
L4:     istore        7
L6:     iload_3
L7:     istore        8
L9:     iload         8
L11:    ifge          L210
L14:    iload_0
L15:    iload         4
L17:    iadd
L18:    istore        9
L20:    iload_1
L21:    iload         5
L23:    iadd
L24:    istore        10
L26:    iload_2
L27:    istore        11

; x clip: scanOk = xInside || adjustedX
L29:    iconst_0
L30:    istore        12
L32:    iload         9
L34:    sipush        4096
L37:    isub
L38:    dup
L39:    istore        6
L41:    ifge          L49
L44:    iconst_1
L45:    istore        12
L47:    goto          L87
L49:    iload         4
L51:    ifne          L65
L54:    iload_2
L55:    iload         11
L57:    isub
L58:    istore_2
L59:    goto          L170
L65:    iload         4
L67:    iload         6
L69:    isub
L70:    iload         4
L72:    idiv
L73:    istore        6
L75:    iload         11
L77:    iload         6
L79:    iadd
L80:    istore        11
L82:    iconst_1
L83:    istore        12

L87:    iload         12
L89:    ifeq          L170

; y clip: scanOk = yInside || adjustedY
L92:    iconst_0
L93:    istore        12
L95:    iload         10
L97:    sipush        4096
L100:   isub
L101:   dup
L102:   istore        6
L104:   ifge          L112
L107:   iconst_1
L108:   istore        12
L110:   goto          L150
L112:   iload         5
L114:   ifne          L128
L117:   iload_2
L118:   iload         11
L120:   isub
L121:   istore_2
L122:   goto          L170
L128:   iload         5
L130:   iload         6
L132:   isub
L133:   iload         5
L135:   idiv
L136:   istore        6
L138:   iload         11
L140:   iload         6
L142:   iadd
L143:   istore        11
L145:   iconst_1
L146:   istore        12

L150:   iload         12
L152:   ifeq          L170
L155:   iload         11
L157:   ifge          L170
L160:   iload         9
L162:   sipush        -4096
L165:   if_icmplt     L170
L168:   iinc          7 1

L170:   iload_2
L171:   iload         11
L173:   isub
L174:   istore_2
L175:   iinc          8 1
L178:   iload_0
L179:   iload         4
L181:   isub
L182:   istore_0
L183:   iload_1
L184:   iload         5
L186:   iadd
L187:   istore_1
L188:   iload_2
L189:   bipush        7
L191:   iadd
L192:   istore_2
L193:   goto          L9
L210:   iload         7
L212:   ireturn
    .end code
.end method
.end class
