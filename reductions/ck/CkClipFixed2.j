.version 50 0
.class public super CkClipFixed
.super java/lang/Object

; Hand-fixed version of CkClipBad:
; duplicate the scanline body for the y-bound shortcut path instead of jumping
; into the adjustment block's shared scan label.
.method public static test : (IIIIII)I
    .code stack 3 locals 12
L0:     iconst_0
L1:     istore        6
L3:     iconst_0
L4:     istore        7
L6:     iload_3
L7:     istore        8
L9:     iload         8
L11:    ifge          L190
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
L38:    ifge          L41
L2000:    iload         10
L2001:    sipush        4096
L2002:    isub
L2003:    dup
L2004:    istore        6
L2005:    ifge          L2017

; Shortcut path: y is already inside bounds, so scan directly.
L2006:    iload         11
L2007:    ifge          L2012
L2008:    iload         9
L2009:    sipush        -4096
L2010:    if_icmplt     L2012
L2011:    iinc          7 1
L2012:   iload_2
L2013:   iload         11
L2014:   isub
L2015:   istore_2
L2016:   goto          L170

; Adjustment path: y is outside bounds.
L2017:   iload         5
L2018:   ifne          L2024
L2019:   iload_2
L2020:   iload         11
L2021:   isub
L2022:   istore_2
L2023:   goto          L170
L2024:   iload         5
L2025:   iload         6
L2026:   isub
L2027:   iload         5
L2028:   idiv
L2029:   istore        6
L2030:   iload         11
L2031:   iload         6
L2032:   iadd
L2033:   istore        11

L2034:   iload         11
L2035:   ifge          L2040
L2036:   iload         9
L2037:   sipush        -4096
L2038:   if_icmplt     L2040
L2039:   iinc          7 1
L2040:   iload_2
L2041:   iload         11
L2042:   isub
L2043:   istore_2
L2044:   goto          L170

L41:    iload         4
L43:    ifne          L56
L46:    iload_2
L47:    iload         11
L49:    isub
L50:    istore_2
L51:    goto          L170
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
L81:    ifge          L110

; Shortcut path: y is already inside bounds, so scan directly.
L84:    iload         11
L86:    ifge          L100
L89:    iload         9
L91:    sipush        -4096
L94:    if_icmplt     L100
L97:    iinc          7 1
L100:   iload_2
L101:   iload         11
L103:   isub
L104:   istore_2
L105:   goto          L170

; Adjustment path: y is outside bounds.
L110:   iload         5
L112:   ifne          L125
L115:   iload_2
L116:   iload         11
L118:   isub
L119:   istore_2
L120:   goto          L170
L125:   iload         5
L127:   iload         6
L129:   isub
L130:   iload         5
L132:   idiv
L133:   istore        6
L135:   iload         11
L137:   iload         6
L139:   iadd
L140:   istore        11

L141:   iload         11
L143:   ifge          L157
L146:   iload         9
L148:   sipush        -4096
L151:   if_icmplt     L157
L154:   iinc          7 1
L157:   iload_2
L158:   iload         11
L160:   isub
L161:   istore_2
L162:   goto          L170

L170:   iinc          8 1
L173:   iload_0
L174:   iload         4
L176:   isub
L177:   istore_0
L178:   iload_1
L179:   iload         5
L181:   iadd
L182:   istore_1
L183:   iload_2
L184:   bipush        7
L186:   iadd
L187:   istore_2
L188:   goto          L9
L190:   iload         7
L192:   ireturn
    .end code
.end method
.end class
