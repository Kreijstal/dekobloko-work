.version 50 0
.class public super CkClipBad
.super java/lang/Object

; One-quadrant reduction of ck.a(IIIIII)V's CFR failure.
; The key shape is the second clipping guard:
;
;   if (y - height < 0) goto L_SCAN
;   if (dy == 0) goto L_SKIP
;   adjust...
; L_SCAN:
;   while (w < 0 && x >= -4096 && y >= -4096) ...
; L_SKIP:
;   repair pointer
;
; CFR 0.152 should be tested against this before generalizing the transform.
.method public static test : (IIIIII)I
    .code stack 3 locals 12
L0:     iconst_0
L1:     istore        6
L3:     iconst_0
L4:     istore        7
L6:     iload_3
L7:     istore        8
L9:     iload         8
L11:    ifge          L170
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

L29:    iload         9
L31:    sipush        4096
L34:    isub
L35:    dup
L36:    istore        6
L38:    iflt          L72
L41:    iload         4
L43:    ifne          L56
L46:    iload_2
L47:    iload         11
L49:    isub
L50:    istore_2
L51:    goto          L140
L56:    iload         4
L58:    iload         6
L60:    isub
L61:    iload         4
L63:    idiv
L64:    istore        6
L66:    iload         11
L68:    iload         6
L70:    iadd
L71:    istore        11

L72:    iload         10
L74:    sipush        4096
L77:    isub
L78:    dup
L79:    istore        6
L81:    iflt          L115
L84:    iload         5
L86:    ifne          L99
L89:    iload_2
L90:    iload         11
L92:    isub
L93:    istore_2
L94:    goto          L140
L99:    iload         5
L101:   iload         6
L103:   isub
L104:   iload         5
L106:   idiv
L107:   istore        6
L109:   iload         11
L111:   iload         6
L113:   iadd
L114:   istore        11

L115:   iload         11
L117:   ifge          L133
L120:   iload         9
L122:   sipush        -4096
L125:   if_icmplt     L133
L128:   iinc          7 1
L131:   iinc          11 1
L133:   iload_2
L134:   iload         11
L136:   isub
L137:   istore_2
L140:   iinc          8 1
L143:   iload_0
L144:   iload         4
L146:   isub
L147:   istore_0
L148:   iload_1
L149:   iload         5
L151:   iadd
L152:   istore_1
L153:   iload_2
L154:   bipush        7
L156:   iadd
L157:   istore_2
L158:   goto          L9
L170:   iload         7
L172:   ireturn
    .end code
.end method
.end class
