.version 50 0
.class public super CkClipFlagJavacShape
.super java/lang/Object

; Handwritten version of the bytecode shape javac emits for CkClipJavac.java.
; This is the flag-based CFG that CFR accepts.
.method public static test : (IIIIII)I
    .code stack 3 locals 13
L0:     iconst_0
L1:     istore        7
L3:     iload_3
L4:     istore        8
L6:     iload         8
L8:     ifge          L186
L11:    iload_0
L12:    iload         4
L14:    iadd
L15:    istore        9
L17:    iload_1
L18:    iload         5
L20:    iadd
L21:    istore        10
L23:    iload_2
L24:    istore        11
L26:    iconst_0
L27:    istore        12
L29:    iload         9
L31:    sipush        4096
L34:    isub
L35:    istore        6
L37:    iload         6
L39:    ifge          L48
L42:    iconst_1
L43:    istore        12
L45:    goto          L81
L48:    iload         4
L50:    ifne          L61
L53:    iload_2
L54:    iload         11
L56:    isub
L57:    istore_2
L58:    goto          L81
L61:    iload         4
L63:    iload         6
L65:    isub
L66:    iload         4
L68:    idiv
L69:    istore        6
L71:    iload         11
L73:    iload         6
L75:    iadd
L76:    istore        11
L78:    iconst_1
L79:    istore        12
L81:    iload         12
L83:    ifeq          L162
L86:    iconst_0
L87:    istore        12
L89:    iload         10
L91:    sipush        4096
L94:    isub
L95:    istore        6
L97:    iload         6
L99:    ifge          L108
L102:   iconst_1
L103:   istore        12
L105:   goto          L141
L108:   iload         5
L110:   ifne          L121
L113:   iload_2
L114:   iload         11
L116:   isub
L117:   istore_2
L118:   goto          L141
L121:   iload         5
L123:   iload         6
L125:   isub
L126:   iload         5
L128:   idiv
L129:   istore        6
L131:   iload         11
L133:   iload         6
L135:   iadd
L136:   istore        11
L138:   iconst_1
L139:   istore        12
L141:   iload         12
L143:   ifeq          L162
L146:   iload         11
L148:   ifge          L162
L151:   iload         9
L153:   sipush        -4096
L156:   if_icmplt     L162
L159:   iinc          7 1
L162:   iload_2
L163:   iload         11
L165:   isub
L166:   istore_2
L167:   iinc          8 1
L170:   iload_0
L171:   iload         4
L173:   isub
L174:   istore_0
L175:   iload_1
L176:   iload         5
L178:   iadd
L179:   istore_1
L180:   iinc          2 7
L183:   goto          L6
L186:   iload         7
L188:   ireturn
    .end code
.end method
.end class
