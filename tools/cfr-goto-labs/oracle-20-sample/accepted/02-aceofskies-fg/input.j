.version 50 0
.class final super fg
.super ip
.field private g Lun;

.field private m Lps;

.field private v Lph;

.field private p I

.field private u [B

.field private l Lbl;

.field private z Ldk;

.field private e Lbl;

.field static t Lgk;

.field static r Lkp;

.field private j I

.field private y Lag;

.field private w I

.field private h [B

.field private n Lkp;

.field private o Lkp;

.field private s Z

.field static f [Ljava/lang/String;

.field static A Lke;

.field static k Ljava/lang/String;

.field private q Z

.field private d I

.field private x J

.field private i Z
.method static final a : ([BB)[B
    .code stack 5 locals 4
L0:    iload_1
L1:    bipush 105
L3:    if_icmpgt L20
L6:    aconst_null
L7:    checkcast java/lang/String
L10:    bipush 109
L12:    invokestatic Method fg a (Ljava/lang/String;I)Lcl;
L15:    pop
L16:    goto L20
L19:    athrow
L20:    aload_0
L21:    arraylength
L22:    istore_2
L23:    iload_2
L24:    newarray byte
L26:    astore_3
L27:    aload_0
L28:    iconst_0
L29:    aload_3
L30:    iconst_0
L31:    iload_2
L32:    invokestatic Method au a ([BI[BII)V
L35:    aload_3
L36:    areturn
L37:    astore_2
L38:    aload_2
L39:    new java/lang/StringBuilder
L42:    dup
L43:    invokespecial Method java/lang/StringBuilder <init> ()V
L46:    ldc "fg.F("
L48:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L51:    aload_0
L52:    ifnull L61
L55:    ldc "{...}"
L57:    goto L63
L60:    athrow
L61:    ldc "null"
L63:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L66:    bipush 44
L68:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L71:    iload_1
L72:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L75:    bipush 41
L77:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L80:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L83:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L86:    athrow
L87:
    .catch java/lang/RuntimeException from L0 to L36 using L37
    .catch java/lang/RuntimeException from L38 to L60 using L60
    .catch java/lang/RuntimeException from L0 to L16 using L19
    .end code
.end method

.method static final a : (Ljava/lang/String;I)Lcl;
    .code stack 4 locals 5
L0:    getstatic Field gi g Les;
L3:    ifnull L10
L6:    goto L12
L9:    athrow
L10:    aconst_null
L11:    areturn
L12:    iload_1
L13:    sipush 17680
L16:    if_icmpeq L28
L19:    bipush -26
L21:    invokestatic Method fg b (B)V
L24:    goto L28
L27:    athrow
L28:    iload_1
L29:    sipush 17773
L32:    ixor
L33:    aload_0
L34:    invokestatic Method vu a (ILjava/lang/CharSequence;)Ljava/lang/String;
L37:    astore_2
L38:    aconst_null
L39:    aload_2
L40:    if_acmpne L45
L43:    aload_0
L44:    astore_2
L45:    getstatic Field gi g Les;
L48:    iload_1
L49:    sipush -17556
L52:    iadd
L53:    aload_2
L54:    invokevirtual Method java/lang/String hashCode ()I
L57:    i2l
L58:    invokevirtual Method es a (IJ)Lwt;
L61:    checkcast cl
L64:    astore_3
L65:    aload_3
L66:    ifnull L121
L69:    bipush 125
L71:    aload_3
L72:    getfield Field cl I Ljava/lang/String;
L75:    invokestatic Method vu a (ILjava/lang/CharSequence;)Ljava/lang/String;
L78:    astore 4
L80:    aconst_null
L81:    aload 4
L83:    if_acmpne L92
L86:    aload_3
L87:    getfield Field cl I Ljava/lang/String;
L90:    astore 4
L92:    aload 4
L94:    aload_2
L95:    invokevirtual Method java/lang/String equals (Ljava/lang/Object;)Z
L98:    ifne L105
L101:    goto L107
L104:    athrow
L105:    aload_3
L106:    areturn
L107:    getstatic Field gi g Les;
L110:    iconst_0
L111:    invokevirtual Method es a (Z)Lwt;
L114:    checkcast cl
L117:    astore_3
L118:    goto L65
L121:    aconst_null
L122:    areturn
L123:    astore_2
L124:    aload_2
L125:    new java/lang/StringBuilder
L128:    dup
L129:    invokespecial Method java/lang/StringBuilder <init> ()V
L132:    ldc "fg.K("
L134:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L137:    aload_0
L138:    ifnull L147
L141:    ldc "{...}"
L143:    goto L149
L146:    athrow
L147:    ldc "null"
L149:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L152:    bipush 44
L154:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L157:    iload_1
L158:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L161:    bipush 41
L163:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L166:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L169:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L172:    athrow
L173:
    .catch java/lang/RuntimeException from L0 to L11 using L123
    .catch java/lang/RuntimeException from L92 to L104 using L104
    .catch java/lang/RuntimeException from L0 to L9 using L9
    .catch java/lang/RuntimeException from L12 to L106 using L123
    .catch java/lang/RuntimeException from L12 to L24 using L27
    .catch java/lang/RuntimeException from L107 to L122 using L123
    .catch java/lang/RuntimeException from L124 to L146 using L146
    .end code
.end method

.method final b : (II)I
    .code stack 4 locals 4
L0:    iload_1
L1:    iconst_1
L2:    if_icmpeq L16
L5:    aconst_null
L6:    checkcast java/lang/String
L9:    putstatic Field fg k Ljava/lang/String;
L12:    goto L16
L15:    athrow
L16:    aload_0
L17:    getfield Field fg v Lph;
L20:    bipush 106
L22:    iload_2
L23:    i2l
L24:    invokevirtual Method ph a (BJ)Lwf;
L27:    checkcast ag
L30:    astore_3
L31:    aload_3
L32:    ifnonnull L39
L35:    goto L47
L38:    athrow
L39:    aload_3
L40:    sipush 21513
L43:    invokevirtual Method ag e (I)I
L46:    ireturn
L47:    iconst_0
L48:    ireturn
L49:    astore_3
L50:    aload_3
L51:    new java/lang/StringBuilder
L54:    dup
L55:    invokespecial Method java/lang/StringBuilder <init> ()V
L58:    ldc "fg.C("
L60:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L63:    iload_1
L64:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L67:    bipush 44
L69:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L72:    iload_2
L73:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L76:    bipush 41
L78:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L81:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L84:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L87:    athrow
L88:
    .catch java/lang/RuntimeException from L31 to L38 using L38
    .catch java/lang/RuntimeException from L0 to L46 using L49
    .catch java/lang/RuntimeException from L0 to L12 using L15
    .catch java/lang/RuntimeException from L47 to L48 using L49
    .end code
.end method

.method final b : (I)V
    .code stack 4 locals 5
L0:    getstatic Field AceOfSkies G Z
L3:    istore 4
L5:    aconst_null
L6:    aload_0
L7:    getfield Field fg o Lkp;
L10:    if_acmpeq L16
L13:    goto L17
L16:    return
L17:    aconst_null
L18:    aload_0
L19:    iconst_1
L20:    invokevirtual Method fg a (Z)Lps;
L23:    if_acmpeq L29
L26:    goto L30
L29:    return
L30:    iload_1
L31:    sipush -20254
L34:    if_icmpeq L38
L37:    return
L38:    aload_0
L39:    getfield Field fg n Lkp;
L42:    iload_1
L43:    ldc -268415203
L45:    ixor
L46:    invokevirtual Method kp d (I)Lwf;
L49:    astore_2
L50:    aconst_null
L51:    aload_2
L52:    if_acmpeq L217
L55:    aload_2
L56:    getfield Field wf b J
L59:    l2i
L60:    istore_3
L61:    iload 4
L63:    ifne L250
L66:    iload_3
L67:    iconst_m1
L68:    ixor
L69:    iconst_m1
L70:    if_icmpgt L116
L73:    goto L77
L76:    athrow
L77:    iload_3
L78:    iconst_m1
L79:    ixor
L80:    aload_0
L81:    getfield Field fg m Lps;
L84:    getfield Field ps l I
L87:    iconst_m1
L88:    ixor
L89:    if_icmple L116
L92:    goto L96
L95:    athrow
L96:    aload_0
L97:    getfield Field fg m Lps;
L100:    getfield Field ps k [I
L103:    iload_3
L104:    iaload
L105:    ifeq L116
L108:    goto L112
L111:    athrow
L112:    goto L127
L115:    athrow
L116:    aload_2
L117:    bipush -124
L119:    invokevirtual Method wf c (I)V
L122:    iload 4
L124:    ifeq L202
L127:    aload_0
L128:    getfield Field fg h [B
L131:    iload_3
L132:    baload
L133:    iconst_m1
L134:    ixor
L135:    iconst_m1
L136:    if_icmpne L156
L139:    goto L143
L142:    athrow
L143:    aload_0
L144:    bipush -37
L146:    iconst_1
L147:    iload_3
L148:    invokespecial Method fg a (BII)Lag;
L151:    pop
L152:    goto L156
L155:    athrow
L156:    aload_0
L157:    getfield Field fg h [B
L160:    iload_3
L161:    baload
L162:    iconst_m1
L163:    if_icmpeq L170
L166:    goto L179
L169:    athrow
L170:    aload_0
L171:    bipush -37
L173:    iconst_2
L174:    iload_3
L175:    invokespecial Method fg a (BII)Lag;
L178:    pop
L179:    aload_0
L180:    getfield Field fg h [B
L183:    iload_3
L184:    baload
L185:    iconst_1
L186:    if_icmpeq L193
L189:    goto L202
L192:    athrow
L193:    aload_2
L194:    iload_1
L195:    sipush 20327
L198:    ixor
L199:    invokevirtual Method wf c (I)V
L202:    aload_0
L203:    getfield Field fg n Lkp;
L206:    bipush 103
L208:    invokevirtual Method kp b (B)Lwf;
L211:    astore_2
L212:    iload 4
L214:    ifeq L50
L217:    goto L250
L220:    astore_2
L221:    aload_2
L222:    new java/lang/StringBuilder
L225:    dup
L226:    invokespecial Method java/lang/StringBuilder <init> ()V
L229:    ldc "fg.G("
L231:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L234:    iload_1
L235:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L238:    bipush 41
L240:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L243:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L246:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L249:    athrow
L250:    return
L251:
    .catch java/lang/RuntimeException from L5 to L16 using L220
    .catch java/lang/RuntimeException from L17 to L29 using L220
    .catch java/lang/RuntimeException from L30 to L37 using L220
    .catch java/lang/RuntimeException from L179 to L192 using L192
    .catch java/lang/RuntimeException from L156 to L169 using L169
    .catch java/lang/RuntimeException from L127 to L152 using L155
    .catch java/lang/RuntimeException from L116 to L139 using L142
    .catch java/lang/RuntimeException from L97 to L115 using L115
    .catch java/lang/RuntimeException from L78 to L108 using L111
    .catch java/lang/RuntimeException from L67 to L92 using L95
    .catch java/lang/RuntimeException from L61 to L73 using L76
    .catch java/lang/RuntimeException from L38 to L217 using L220
    .end code
.end method

.method final a : (II)[B
    .code stack 4 locals 5
L0:    aload_0
L1:    bipush -37
L3:    iconst_0
L4:    iload_1
L5:    invokespecial Method fg a (BII)Lag;
L8:    astore_3
L9:    aload_3
L10:    ifnull L17
L13:    goto L19
L16:    athrow
L17:    aconst_null
L18:    areturn
L19:    aload_3
L20:    iconst_1
L21:    invokevirtual Method ag a (Z)[B
L24:    astore 4
L26:    aload_3
L27:    iload_2
L28:    bipush -128
L30:    ixor
L31:    invokevirtual Method ag c (I)V
L34:    iload_2
L35:    iconst_2
L36:    if_icmpeq L44
L39:    aconst_null
L40:    checkcast [B
L43:    areturn
L44:    aload 4
L46:    areturn
L47:    astore_3
L48:    aload_3
L49:    new java/lang/StringBuilder
L52:    dup
L53:    invokespecial Method java/lang/StringBuilder <init> ()V
L56:    ldc "fg.A("
L58:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L61:    iload_1
L62:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L65:    bipush 44
L67:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L70:    iload_2
L71:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L74:    bipush 41
L76:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L79:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L82:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L85:    athrow
L86:
    .catch java/lang/RuntimeException from L9 to L16 using L16
    .catch java/lang/RuntimeException from L0 to L18 using L47
    .catch java/lang/RuntimeException from L19 to L43 using L47
    .catch java/lang/RuntimeException from L44 to L46 using L47
    .end code
.end method

.method static final b : (Z)V
    .code stack 4 locals 2
L0:    iconst_1
L1:    iload_0
L2:    getstatic Field nh b Ljava/lang/String;
L5:    getstatic Field rt e Ljava/lang/String;
L8:    invokestatic Method tn a (IZLjava/lang/String;Ljava/lang/String;)V
L11:    iconst_1
L12:    putstatic Field ae f Z
L15:    goto L48
L18:    astore_1
L19:    aload_1
L20:    new java/lang/StringBuilder
L23:    dup
L24:    invokespecial Method java/lang/StringBuilder <init> ()V
L27:    ldc "fg.H("
L29:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L32:    iload_0
L33:    invokevirtual Method java/lang/StringBuilder append (Z)Ljava/lang/StringBuilder;
L36:    bipush 41
L38:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L41:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L44:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L47:    athrow
L48:    return
L49:
    .catch java/lang/RuntimeException from L0 to L15 using L18
    .end code
.end method

.method final a : (B)V
    .code stack 5 locals 6
L0:    getstatic Field AceOfSkies G Z
L3:    istore 5
L5:    aload_0
L6:    getfield Field fg o Lkp;
L9:    ifnull L658
L12:    aload_0
L13:    iconst_1
L14:    invokevirtual Method fg a (Z)Lps;
L17:    ifnonnull L21
L20:    return
L21:    aload_0
L22:    getfield Field fg q Z
L25:    ifeq L334
L28:    iconst_1
L29:    istore_2
L30:    aload_0
L31:    getfield Field fg o Lkp;
L34:    ldc 268435455
L36:    invokevirtual Method kp d (I)Lwf;
L39:    astore_3
L40:    aload_3
L41:    ifnull L132
L44:    aload_3
L45:    getfield Field wf b J
L48:    l2i
L49:    istore 4
L51:    iconst_m1
L52:    aload_0
L53:    getfield Field fg h [B
L56:    iload 4
L58:    baload
L59:    iconst_m1
L60:    ixor
L61:    iload 5
L63:    ifne L148
L66:    if_icmpne L87
L69:    goto L73
L72:    athrow
L73:    aload_0
L74:    bipush -37
L76:    iconst_1
L77:    iload 4
L79:    invokespecial Method fg a (BII)Lag;
L82:    pop
L83:    goto L87
L86:    athrow
L87:    iconst_m1
L88:    aload_0
L89:    getfield Field fg h [B
L92:    iload 4
L94:    baload
L95:    iconst_m1
L96:    ixor
L97:    if_icmpeq L115
L100:    aload_3
L101:    bipush -124
L103:    invokevirtual Method wf c (I)V
L106:    iload 5
L108:    ifeq L117
L111:    goto L115
L114:    athrow
L115:    iconst_0
L116:    istore_2
L117:    aload_0
L118:    getfield Field fg o Lkp;
L121:    bipush 103
L123:    invokevirtual Method kp b (B)Lwf;
L126:    astore_3
L127:    iload 5
L129:    ifeq L40
L132:    aload_0
L133:    getfield Field fg m Lps;
L136:    getfield Field ps k [I
L139:    arraylength
L140:    iconst_m1
L141:    ixor
L142:    aload_0
L143:    getfield Field fg d I
L146:    iconst_m1
L147:    ixor
L148:    if_icmpge L311
L151:    aload_0
L152:    getfield Field fg m Lps;
L155:    getfield Field ps k [I
L158:    aload_0
L159:    getfield Field fg d I
L162:    iaload
L163:    iload 5
L165:    ifne L312
L168:    goto L172
L171:    athrow
L172:    ifne L198
L175:    goto L179
L178:    athrow
L179:    aload_0
L180:    dup
L181:    getfield Field fg d I
L184:    iconst_1
L185:    iadd
L186:    putfield Field fg d I
L189:    iload 5
L191:    ifeq L132
L194:    goto L198
L197:    athrow
L198:    aload_0
L199:    getfield Field fg z Ldk;
L202:    getfield Field dk d I
L205:    iconst_m1
L206:    ixor
L207:    sipush -251
L210:    if_icmpgt L220
L213:    iconst_0
L214:    istore_2
L215:    iload 5
L217:    ifeq L311
L220:    aload_0
L221:    getfield Field fg h [B
L224:    aload_0
L225:    getfield Field fg d I
L228:    baload
L229:    ifne L252
L232:    goto L236
L235:    athrow
L236:    aload_0
L237:    bipush -37
L239:    iconst_1
L240:    aload_0
L241:    getfield Field fg d I
L244:    invokespecial Method fg a (BII)Lag;
L247:    pop
L248:    goto L252
L251:    athrow
L252:    iconst_m1
L253:    aload_0
L254:    getfield Field fg h [B
L257:    aload_0
L258:    getfield Field fg d I
L261:    baload
L262:    iconst_m1
L263:    ixor
L264:    if_icmpne L296
L267:    new wf
L270:    dup
L271:    invokespecial Method wf <init> ()V
L274:    astore_3
L275:    aload_3
L276:    aload_0
L277:    getfield Field fg d I
L280:    i2l
L281:    putfield Field wf b J
L284:    iconst_0
L285:    istore_2
L286:    aload_0
L287:    getfield Field fg o Lkp;
L290:    bipush 81
L292:    aload_3
L293:    invokevirtual Method kp a (ILwf;)V
L296:    aload_0
L297:    dup
L298:    getfield Field fg d I
L301:    iconst_1
L302:    iadd
L303:    putfield Field fg d I
L306:    iload 5
L308:    ifeq L132
L311:    iload_2
L312:    ifeq L329
L315:    aload_0
L316:    iconst_0
L317:    putfield Field fg q Z
L320:    aload_0
L321:    iconst_0
L322:    putfield Field fg d I
L325:    goto L329
L328:    athrow
L329:    iload 5
L331:    ifeq L658
L334:    aload_0
L335:    getfield Field fg s Z
L338:    ifeq L649
L341:    goto L345
L344:    athrow
L345:    iconst_1
L346:    istore_2
L347:    aload_0
L348:    getfield Field fg o Lkp;
L351:    ldc 268435455
L353:    invokevirtual Method kp d (I)Lwf;
L356:    astore_3
L357:    aload_3
L358:    ifnull L451
L361:    aload_3
L362:    getfield Field wf b J
L365:    l2i
L366:    istore 4
L368:    bipush -2
L370:    aload_0
L371:    getfield Field fg h [B
L374:    iload 4
L376:    baload
L377:    iconst_m1
L378:    ixor
L379:    iload 5
L381:    ifne L463
L384:    if_icmpeq L405
L387:    goto L391
L390:    athrow
L391:    aload_0
L392:    bipush -37
L394:    iconst_2
L395:    iload 4
L397:    invokespecial Method fg a (BII)Lag;
L400:    pop
L401:    goto L405
L404:    athrow
L405:    bipush -2
L407:    aload_0
L408:    getfield Field fg h [B
L411:    iload 4
L413:    baload
L414:    iconst_m1
L415:    ixor
L416:    if_icmpne L434
L419:    aload_3
L420:    bipush -123
L422:    invokevirtual Method wf c (I)V
L425:    iload 5
L427:    ifeq L436
L430:    goto L434
L433:    athrow
L434:    iconst_0
L435:    istore_2
L436:    aload_0
L437:    getfield Field fg o Lkp;
L440:    bipush 103
L442:    invokevirtual Method kp b (B)Lwf;
L445:    astore_3
L446:    iload 5
L448:    ifeq L357
L451:    aload_0
L452:    getfield Field fg d I
L455:    aload_0
L456:    getfield Field fg m Lps;
L459:    getfield Field ps k [I
L462:    arraylength
L463:    if_icmpge L626
L466:    iconst_0
L467:    aload_0
L468:    getfield Field fg m Lps;
L471:    getfield Field ps k [I
L474:    aload_0
L475:    getfield Field fg d I
L478:    iaload
L479:    iload 5
L481:    ifne L661
L484:    goto L488
L487:    athrow
L488:    if_icmpeq L498
L491:    goto L495
L494:    athrow
L495:    goto L513
L498:    aload_0
L499:    dup
L500:    getfield Field fg d I
L503:    iconst_1
L504:    iadd
L505:    putfield Field fg d I
L508:    iload 5
L510:    ifeq L451
L513:    aload_0
L514:    getfield Field fg g Lun;
L517:    bipush -106
L519:    invokevirtual Method un a (B)Z
L522:    ifne L529
L525:    goto L536
L528:    athrow
L529:    iconst_0
L530:    istore_2
L531:    iload 5
L533:    ifeq L626
L536:    aload_0
L537:    getfield Field fg h [B
L540:    aload_0
L541:    getfield Field fg d I
L544:    baload
L545:    iconst_1
L546:    if_icmpne L557
L549:    goto L553
L552:    athrow
L553:    goto L569
L556:    athrow
L557:    aload_0
L558:    bipush -37
L560:    iconst_2
L561:    aload_0
L562:    getfield Field fg d I
L565:    invokespecial Method fg a (BII)Lag;
L568:    pop
L569:    aload_0
L570:    getfield Field fg h [B
L573:    aload_0
L574:    getfield Field fg d I
L577:    baload
L578:    iconst_1
L579:    if_icmpeq L611
L582:    new wf
L585:    dup
L586:    invokespecial Method wf <init> ()V
L589:    astore_3
L590:    aload_3
L591:    aload_0
L592:    getfield Field fg d I
L595:    i2l
L596:    putfield Field wf b J
L599:    iconst_0
L600:    istore_2
L601:    aload_0
L602:    getfield Field fg o Lkp;
L605:    bipush 115
L607:    aload_3
L608:    invokevirtual Method kp a (ILwf;)V
L611:    aload_0
L612:    dup
L613:    getfield Field fg d I
L616:    iconst_1
L617:    iadd
L618:    putfield Field fg d I
L621:    iload 5
L623:    ifeq L451
L626:    iload_2
L627:    ifne L634
L630:    goto L644
L633:    athrow
L634:    aload_0
L635:    iconst_0
L636:    putfield Field fg d I
L639:    aload_0
L640:    iconst_0
L641:    putfield Field fg s Z
L644:    iload 5
L646:    ifeq L658
L649:    aload_0
L650:    aconst_null
L651:    putfield Field fg o Lkp;
L654:    goto L658
L657:    athrow
L658:    iload_1
L659:    bipush 84
L661:    if_icmpgt L676
L664:    aload_0
L665:    aconst_null
L666:    checkcast ps
L669:    putfield Field fg m Lps;
L672:    goto L676
L675:    athrow
L676:    aload_0
L677:    getfield Field fg i Z
L680:    ifeq L827
L683:    aload_0
L684:    getfield Field fg x J
L687:    bipush -106
L689:    invokestatic Method kh a (I)J
L692:    lcmp
L693:    ifle L704
L696:    goto L700
L699:    athrow
L700:    goto L827
L703:    athrow
L704:    aload_0
L705:    getfield Field fg v Lph;
L708:    iconst_0
L709:    invokevirtual Method ph a (Z)Lwf;
L712:    checkcast ag
L715:    astore_2
L716:    aconst_null
L717:    aload_2
L718:    if_acmpeq L814
L721:    iload 5
L723:    ifne L827
L726:    aload_2
L727:    getfield Field ag p Z
L730:    ifeq L746
L733:    goto L737
L736:    athrow
L737:    iload 5
L739:    ifeq L797
L742:    goto L746
L745:    athrow
L746:    aload_2
L747:    getfield Field ag t Z
L750:    ifne L771
L753:    goto L757
L756:    athrow
L757:    aload_2
L758:    iconst_1
L759:    putfield Field ag t Z
L762:    iload 5
L764:    ifeq L797
L767:    goto L771
L770:    athrow
L771:    aload_2
L772:    getfield Field ag q Z
L775:    ifne L791
L778:    goto L782
L781:    athrow
L782:    new java/lang/RuntimeException
L785:    dup
L786:    invokespecial Method java/lang/RuntimeException <init> ()V
L789:    athrow
L790:    athrow
L791:    aload_2
L792:    bipush -124
L794:    invokevirtual Method ag c (I)V
L797:    aload_0
L798:    getfield Field fg v Lph;
L801:    iconst_0
L802:    invokevirtual Method ph a (I)Lwf;
L805:    checkcast ag
L808:    astore_2
L809:    iload 5
L811:    ifeq L716
L814:    aload_0
L815:    ldc2_w 1000L
L818:    bipush -95
L820:    invokestatic Method kh a (I)J
L823:    ladd
L824:    putfield Field fg x J
L827:    goto L861
L830:    astore_2
L831:    aload_2
L832:    new java/lang/StringBuilder
L835:    dup
L836:    invokespecial Method java/lang/StringBuilder <init> ()V
L839:    ldc_w "fg.M("
L842:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L845:    iload_1
L846:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L849:    bipush 41
L851:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L854:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L857:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L860:    athrow
L861:    return
L862:
    .catch java/lang/RuntimeException from L5 to L20 using L830
    .catch java/lang/RuntimeException from L771 to L790 using L790
    .catch java/lang/RuntimeException from L757 to L778 using L781
    .catch java/lang/RuntimeException from L746 to L767 using L770
    .catch java/lang/RuntimeException from L737 to L753 using L756
    .catch java/lang/RuntimeException from L727 to L742 using L745
    .catch java/lang/RuntimeException from L721 to L733 using L736
    .catch java/lang/RuntimeException from L684 to L703 using L703
    .catch java/lang/RuntimeException from L676 to L696 using L699
    .catch java/lang/RuntimeException from L661 to L672 using L675
    .catch java/lang/RuntimeException from L644 to L654 using L657
    .catch java/lang/RuntimeException from L626 to L633 using L633
    .catch java/lang/RuntimeException from L536 to L556 using L556
    .catch java/lang/RuntimeException from L531 to L549 using L552
    .catch java/lang/RuntimeException from L513 to L528 using L528
    .catch java/lang/RuntimeException from L466 to L491 using L494
    .catch java/lang/RuntimeException from L463 to L484 using L487
    .catch java/lang/RuntimeException from L405 to L430 using L433
    .catch java/lang/RuntimeException from L391 to L401 using L404
    .catch java/lang/RuntimeException from L368 to L387 using L390
    .catch java/lang/RuntimeException from L329 to L341 using L344
    .catch java/lang/RuntimeException from L312 to L325 using L328
    .catch java/lang/RuntimeException from L220 to L248 using L251
    .catch java/lang/RuntimeException from L215 to L232 using L235
    .catch java/lang/RuntimeException from L179 to L194 using L197
    .catch java/lang/RuntimeException from L151 to L175 using L178
    .catch java/lang/RuntimeException from L148 to L168 using L171
    .catch java/lang/RuntimeException from L87 to L111 using L114
    .catch java/lang/RuntimeException from L73 to L83 using L86
    .catch java/lang/RuntimeException from L51 to L69 using L72
    .catch java/lang/RuntimeException from L21 to L827 using L830
    .end code
.end method

.method final a : (Z)Lps;
    .code stack 7 locals 5
L0:    getstatic Field AceOfSkies G Z
L3:    istore 4
L5:    aload_0
L6:    getfield Field fg m Lps;
L9:    ifnull L17
L12:    aload_0
L13:    getfield Field fg m Lps;
L16:    areturn
L17:    aconst_null
L18:    aload_0
L19:    getfield Field fg y Lag;
L22:    if_acmpne L64
L25:    aload_0
L26:    getfield Field fg g Lun;
L29:    iconst_0
L30:    invokevirtual Method un a (Z)Z
L33:    ifeq L42
L36:    goto L40
L39:    athrow
L40:    aconst_null
L41:    areturn
L42:    aload_0
L43:    aload_0
L44:    getfield Field fg g Lun;
L47:    sipush 255
L50:    aload_0
L51:    getfield Field fg p I
L54:    bipush -21
L56:    iconst_1
L57:    iconst_0
L58:    invokevirtual Method un a (IIIZB)Lgp;
L61:    putfield Field fg y Lag;
L64:    aload_0
L65:    getfield Field fg y Lag;
L68:    getfield Field ag p Z
L71:    ifeq L76
L74:    aconst_null
L75:    areturn
L76:    aload_0
L77:    getfield Field fg y Lag;
L80:    iload_1
L81:    invokevirtual Method ag a (Z)[B
L84:    astore_2
L85:    aload_0
L86:    getfield Field fg y Lag;
L89:    instanceof os
L92:    ifne L246
L95:    aconst_null
L96:    aload_2
L97:    if_acmpeq L104
L100:    goto L112
L103:    athrow
L104:    new java/lang/RuntimeException
L107:    dup
L108:    invokespecial Method java/lang/RuntimeException <init> ()V
L111:    athrow
L112:    aload_0
L113:    new ps
L116:    dup
L117:    aload_2
L118:    aload_0
L119:    getfield Field fg j I
L122:    aload_0
L123:    getfield Field fg u [B
L126:    invokespecial Method ps <init> ([BI[B)V
L129:    putfield Field fg m Lps;
L132:    goto L212
L135:    astore_3
L136:    aload_0
L137:    getfield Field fg g Lun;
L140:    bipush -126
L142:    invokevirtual Method un c (B)V
L145:    aload_0
L146:    aconst_null
L147:    putfield Field fg m Lps;
L150:    aload_0
L151:    getfield Field fg g Lun;
L154:    iload_1
L155:    ifne L163
L158:    iconst_1
L159:    goto L164
L162:    athrow
L163:    iconst_0
L164:    invokevirtual Method un a (Z)Z
L167:    ifeq L184
L170:    aload_0
L171:    aconst_null
L172:    putfield Field fg y Lag;
L175:    iload 4
L177:    ifeq L210
L180:    goto L184
L183:    athrow
L184:    aload_0
L185:    aload_0
L186:    getfield Field fg g Lun;
L189:    sipush 255
L192:    aload_0
L193:    getfield Field fg p I
L196:    bipush -21
L198:    iconst_1
L199:    iconst_0
L200:    invokevirtual Method un a (IIIZB)Lgp;
L203:    putfield Field fg y Lag;
L206:    goto L210
L209:    athrow
L210:    aconst_null
L211:    areturn
L212:    aload_0
L213:    getfield Field fg e Lbl;
L216:    ifnonnull L223
L219:    goto L374
L222:    athrow
L223:    aload_0
L224:    getfield Field fg z Ldk;
L227:    aload_2
L228:    aload_0
L229:    getfield Field fg e Lbl;
L232:    iload_1
L233:    aload_0
L234:    getfield Field fg p I
L237:    invokevirtual Method dk a ([BLbl;ZI)Los;
L240:    pop
L241:    iload 4
L243:    ifeq L374
L246:    aload_2
L247:    ifnull L254
L250:    goto L262
L253:    athrow
L254:    new java/lang/RuntimeException
L257:    dup
L258:    invokespecial Method java/lang/RuntimeException <init> ()V
L261:    athrow
L262:    aload_0
L263:    new ps
L266:    dup
L267:    aload_2
L268:    aload_0
L269:    getfield Field fg j I
L272:    aload_0
L273:    getfield Field fg u [B
L276:    invokespecial Method ps <init> ([BI[B)V
L279:    putfield Field fg m Lps;
L282:    aload_0
L283:    getfield Field fg m Lps;
L286:    getfield Field ps m I
L289:    iconst_m1
L290:    ixor
L291:    aload_0
L292:    getfield Field fg w I
L295:    iconst_m1
L296:    ixor
L297:    if_icmpne L304
L300:    goto L312
L303:    athrow
L304:    new java/lang/RuntimeException
L307:    dup
L308:    invokespecial Method java/lang/RuntimeException <init> ()V
L311:    athrow
L312:    goto L374
L315:    astore_3
L316:    aload_0
L317:    aconst_null
L318:    putfield Field fg m Lps;
L321:    aload_0
L322:    getfield Field fg g Lun;
L325:    iconst_0
L326:    invokevirtual Method un a (Z)Z
L329:    ifne L363
L332:    aload_0
L333:    aload_0
L334:    getfield Field fg g Lun;
L337:    sipush 255
L340:    aload_0
L341:    getfield Field fg p I
L344:    bipush -21
L346:    iconst_1
L347:    iconst_0
L348:    invokevirtual Method un a (IIIZB)Lgp;
L351:    putfield Field fg y Lag;
L354:    iload 4
L356:    ifeq L372
L359:    goto L363
L362:    athrow
L363:    aload_0
L364:    aconst_null
L365:    putfield Field fg y Lag;
L368:    goto L372
L371:    athrow
L372:    aconst_null
L373:    areturn
L374:    aload_0
L375:    aconst_null
L376:    putfield Field fg y Lag;
L379:    aload_0
L380:    getfield Field fg l Lbl;
L383:    ifnull L403
L386:    aload_0
L387:    aload_0
L388:    getfield Field fg m Lps;
L391:    getfield Field ps l I
L394:    newarray byte
L396:    putfield Field fg h [B
L399:    goto L403
L402:    athrow
L403:    aload_0
L404:    getfield Field fg m Lps;
L407:    areturn
L408:    astore_2
L409:    aload_2
L410:    new java/lang/StringBuilder
L413:    dup
L414:    invokespecial Method java/lang/StringBuilder <init> ()V
L417:    ldc_w "fg.D("
L420:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L423:    iload_1
L424:    invokevirtual Method java/lang/StringBuilder append (Z)Ljava/lang/StringBuilder;
L427:    bipush 41
L429:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L432:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L435:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L438:    athrow
L439:
    .catch java/lang/RuntimeException from L95 to L132 using L135
    .catch java/lang/RuntimeException from L246 to L312 using L315
    .catch java/lang/RuntimeException from L5 to L16 using L408
    .catch java/lang/RuntimeException from L17 to L41 using L408
    .catch java/lang/RuntimeException from L17 to L36 using L39
    .catch java/lang/RuntimeException from L42 to L75 using L408
    .catch java/lang/RuntimeException from L170 to L206 using L209
    .catch java/lang/RuntimeException from L164 to L180 using L183
    .catch java/lang/RuntimeException from L136 to L162 using L162
    .catch java/lang/RuntimeException from L95 to L103 using L103
    .catch java/lang/RuntimeException from L76 to L211 using L408
    .catch java/lang/RuntimeException from L332 to L368 using L371
    .catch java/lang/RuntimeException from L316 to L359 using L362
    .catch java/lang/RuntimeException from L262 to L303 using L303
    .catch java/lang/RuntimeException from L246 to L253 using L253
    .catch java/lang/RuntimeException from L212 to L373 using L408
    .catch java/lang/RuntimeException from L212 to L222 using L222
    .catch java/lang/RuntimeException from L374 to L407 using L408
    .catch java/lang/RuntimeException from L374 to L399 using L402
    .end code
.end method

.method public static b : (B)V
    .code stack 3 locals 2
L0:    aconst_null
L1:    putstatic Field fg f [Ljava/lang/String;
L4:    aconst_null
L5:    putstatic Field fg t Lgk;
L8:    aconst_null
L9:    putstatic Field fg r Lkp;
L12:    aconst_null
L13:    putstatic Field fg k Ljava/lang/String;
L16:    iload_0
L17:    bipush 72
L19:    if_icmpgt L30
L22:    iconst_0
L23:    invokestatic Method fg b (Z)V
L26:    goto L30
L29:    athrow
L30:    aconst_null
L31:    putstatic Field fg A Lke;
L34:    goto L68
L37:    astore_1
L38:    aload_1
L39:    new java/lang/StringBuilder
L42:    dup
L43:    invokespecial Method java/lang/StringBuilder <init> ()V
L46:    ldc_w "fg.N("
L49:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L52:    iload_0
L53:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L56:    bipush 41
L58:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L61:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L64:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L67:    athrow
L68:    return
L69:
    .catch java/lang/RuntimeException from L0 to L34 using L37
    .catch java/lang/RuntimeException from L0 to L26 using L29
    .end code
.end method

.method private final a : (BII)Lag;
    .code stack 6 locals 11
L0:    getstatic Field AceOfSkies G Z
L3:    istore 10
L5:    aload_0
L6:    getfield Field fg v Lph;
L9:    bipush 106
L11:    iload_3
L12:    i2l
L13:    invokevirtual Method ph a (BJ)Lwf;
L16:    checkcast ag
L19:    astore 4
L21:    aload 4
L23:    ifnull L75
L26:    iconst_m1
L27:    iload_2
L28:    iconst_m1
L29:    ixor
L30:    if_icmpne L75
L33:    goto L37
L36:    athrow
L37:    aload 4
L39:    getfield Field ag q Z
L42:    ifne L75
L45:    goto L49
L48:    athrow
L49:    aload 4
L51:    getfield Field ag p Z
L54:    ifne L65
L57:    goto L61
L60:    athrow
L61:    goto L75
L64:    athrow
L65:    aload 4
L67:    bipush -125
L69:    invokevirtual Method ag c (I)V
L72:    aconst_null
L73:    astore 4
L75:    aload 4
L77:    ifnonnull L327
L80:    iconst_0
L81:    iload_2
L82:    if_icmpne L177
L85:    goto L89
L88:    athrow
L89:    aload_0
L90:    getfield Field fg l Lbl;
L93:    ifnull L135
L96:    goto L100
L99:    athrow
L100:    iconst_m1
L101:    aload_0
L102:    getfield Field fg h [B
L105:    iload_3
L106:    baload
L107:    if_icmpeq L135
L110:    goto L114
L113:    athrow
L114:    aload_0
L115:    getfield Field fg z Ldk;
L118:    aload_0
L119:    getfield Field fg l Lbl;
L122:    bipush 96
L124:    iload_3
L125:    invokevirtual Method dk a (Lbl;BI)Los;
L128:    astore 4
L130:    iload 10
L132:    ifeq L314
L135:    aload_0
L136:    getfield Field fg g Lun;
L139:    iconst_0
L140:    invokevirtual Method un a (Z)Z
L143:    ifne L175
L146:    goto L150
L149:    athrow
L150:    aload_0
L151:    getfield Field fg g Lun;
L154:    aload_0
L155:    getfield Field fg p I
L158:    iload_3
L159:    iload_1
L160:    bipush 16
L162:    iadd
L163:    iconst_1
L164:    iconst_2
L165:    invokevirtual Method un a (IIIZB)Lgp;
L168:    astore 4
L170:    iload 10
L172:    ifeq L314
L175:    aconst_null
L176:    areturn
L177:    iload_2
L178:    iconst_m1
L179:    ixor
L180:    bipush -2
L182:    if_icmpeq L275
L185:    iconst_2
L186:    iload_2
L187:    if_icmpeq L203
L190:    goto L194
L193:    athrow
L194:    new java/lang/RuntimeException
L197:    dup
L198:    invokespecial Method java/lang/RuntimeException <init> ()V
L201:    athrow
L202:    athrow
L203:    aload_0
L204:    getfield Field fg l Lbl;
L207:    ifnonnull L219
L210:    new java/lang/RuntimeException
L213:    dup
L214:    invokespecial Method java/lang/RuntimeException <init> ()V
L217:    athrow
L218:    athrow
L219:    iconst_m1
L220:    aload_0
L221:    getfield Field fg h [B
L224:    iload_3
L225:    baload
L226:    if_icmpeq L238
L229:    new java/lang/RuntimeException
L232:    dup
L233:    invokespecial Method java/lang/RuntimeException <init> ()V
L236:    athrow
L237:    athrow
L238:    aload_0
L239:    getfield Field fg g Lun;
L242:    bipush -114
L244:    invokevirtual Method un a (B)Z
L247:    ifeq L252
L250:    aconst_null
L251:    areturn
L252:    aload_0
L253:    getfield Field fg g Lun;
L256:    aload_0
L257:    getfield Field fg p I
L260:    iload_3
L261:    bipush -21
L263:    iconst_0
L264:    iconst_2
L265:    invokevirtual Method un a (IIIZB)Lgp;
L268:    astore 4
L270:    iload 10
L272:    ifeq L314
L275:    aload_0
L276:    getfield Field fg l Lbl;
L279:    ifnull L290
L282:    goto L286
L285:    athrow
L286:    goto L298
L289:    athrow
L290:    new java/lang/RuntimeException
L293:    dup
L294:    invokespecial Method java/lang/RuntimeException <init> ()V
L297:    athrow
L298:    aload_0
L299:    getfield Field fg z Ldk;
L302:    bipush 95
L304:    aload_0
L305:    getfield Field fg l Lbl;
L308:    iload_3
L309:    invokevirtual Method dk a (BLbl;I)Los;
L312:    astore 4
L314:    aload_0
L315:    getfield Field fg v Lph;
L318:    bipush -41
L320:    iload_3
L321:    i2l
L322:    aload 4
L324:    invokevirtual Method ph a (IJLwf;)V
L327:    aload 4
L329:    getfield Field ag p Z
L332:    ifeq L337
L335:    aconst_null
L336:    areturn
L337:    aload 4
L339:    iconst_1
L340:    invokevirtual Method ag a (Z)[B
L343:    astore 5
L345:    iload_1
L346:    bipush -37
L348:    if_icmpeq L356
L351:    aconst_null
L352:    checkcast ag
L355:    areturn
L356:    aload 4
L358:    instanceof os
L361:    ifne L774
L364:    aload 5
L366:    ifnull L380
L369:    iconst_2
L370:    aload 5
L372:    arraylength
L373:    if_icmplt L389
L376:    goto L380
L379:    athrow
L380:    new java/lang/RuntimeException
L383:    dup
L384:    invokespecial Method java/lang/RuntimeException <init> ()V
L387:    athrow
L388:    athrow
L389:    getstatic Field aq d Ljava/util/zip/CRC32;
L392:    invokevirtual Method java/util/zip/CRC32 reset ()V
L395:    getstatic Field aq d Ljava/util/zip/CRC32;
L398:    aload 5
L400:    iconst_0
L401:    bipush -2
L403:    aload 5
L405:    arraylength
L406:    iadd
L407:    invokevirtual Method java/util/zip/CRC32 update ([BII)V
L410:    getstatic Field aq d Ljava/util/zip/CRC32;
L413:    invokevirtual Method java/util/zip/CRC32 getValue ()J
L416:    l2i
L417:    istore 6
L419:    iload 6
L421:    iconst_m1
L422:    ixor
L423:    aload_0
L424:    getfield Field fg m Lps;
L427:    getfield Field ps g [I
L430:    iload_3
L431:    iaload
L432:    iconst_m1
L433:    ixor
L434:    if_icmpne L441
L437:    goto L449
L440:    athrow
L441:    new java/lang/RuntimeException
L444:    dup
L445:    invokespecial Method java/lang/RuntimeException <init> ()V
L448:    athrow
L449:    aconst_null
L450:    aload_0
L451:    getfield Field fg m Lps;
L454:    getfield Field ps i [[B
L457:    if_acmpeq L563
L460:    aconst_null
L461:    aload_0
L462:    getfield Field fg m Lps;
L465:    getfield Field ps i [[B
L468:    iload_3
L469:    aaload
L470:    if_acmpne L481
L473:    goto L477
L476:    athrow
L477:    goto L563
L480:    athrow
L481:    aload_0
L482:    getfield Field fg m Lps;
L485:    getfield Field ps i [[B
L488:    iload_3
L489:    aaload
L490:    astore 7
L492:    iload_1
L493:    bipush -37
L495:    ixor
L496:    bipush -2
L498:    aload 5
L500:    arraylength
L501:    iadd
L502:    aload 5
L504:    iconst_0
L505:    invokestatic Method qm a (II[BI)[B
L508:    astore 8
L510:    iconst_0
L511:    istore 9
L513:    bipush 64
L515:    iload 9
L517:    if_icmple L563
L520:    aload 8
L522:    iload 9
L524:    baload
L525:    iconst_m1
L526:    ixor
L527:    aload 7
L529:    iload 9
L531:    baload
L532:    iconst_m1
L533:    ixor
L534:    iload 10
L536:    ifne L738
L539:    if_icmpeq L555
L542:    goto L546
L545:    athrow
L546:    new java/lang/RuntimeException
L549:    dup
L550:    invokespecial Method java/lang/RuntimeException <init> ()V
L553:    athrow
L554:    athrow
L555:    iinc 9 1
L558:    iload 10
L560:    ifeq L513
L563:    aload_0
L564:    getfield Field fg g Lun;
L567:    iconst_0
L568:    putfield Field un j I
L571:    aload_0
L572:    getfield Field fg g Lun;
L575:    iconst_0
L576:    putfield Field un e I
L579:    goto L662
L582:    astore 6
L584:    aload_0
L585:    getfield Field fg g Lun;
L588:    bipush -46
L590:    invokevirtual Method un c (B)V
L593:    aload 4
L595:    iload_1
L596:    bipush -90
L598:    iadd
L599:    invokevirtual Method ag c (I)V
L602:    aload 4
L604:    getfield Field ag q Z
L607:    ifne L614
L610:    goto L660
L613:    athrow
L614:    aload_0
L615:    getfield Field fg g Lun;
L618:    iconst_0
L619:    invokevirtual Method un a (Z)Z
L622:    ifeq L629
L625:    goto L660
L628:    athrow
L629:    aload_0
L630:    getfield Field fg g Lun;
L633:    aload_0
L634:    getfield Field fg p I
L637:    iload_3
L638:    bipush -21
L640:    iconst_1
L641:    iconst_2
L642:    invokevirtual Method un a (IIIZB)Lgp;
L645:    astore 4
L647:    aload_0
L648:    getfield Field fg v Lph;
L651:    bipush -114
L653:    iload_3
L654:    i2l
L655:    aload 4
L657:    invokevirtual Method ph a (IJLwf;)V
L660:    aconst_null
L661:    areturn
L662:    aload 5
L664:    bipush -2
L666:    aload 5
L668:    arraylength
L669:    iadd
L670:    aload_0
L671:    getfield Field fg m Lps;
L674:    getfield Field ps a [I
L677:    iload_3
L678:    iaload
L679:    ldc_w -1790049912
L682:    iushr
L683:    i2b
L684:    bastore
L685:    aload 5
L687:    iconst_m1
L688:    aload 5
L690:    arraylength
L691:    iadd
L692:    aload_0
L693:    getfield Field fg m Lps;
L696:    getfield Field ps a [I
L699:    iload_3
L700:    iaload
L701:    i2b
L702:    bastore
L703:    aconst_null
L704:    aload_0
L705:    getfield Field fg l Lbl;
L708:    if_acmpne L715
L711:    goto L752
L714:    athrow
L715:    aload_0
L716:    getfield Field fg z Ldk;
L719:    aload 5
L721:    aload_0
L722:    getfield Field fg l Lbl;
L725:    iconst_1
L726:    iload_3
L727:    invokevirtual Method dk a ([BLbl;ZI)Los;
L730:    pop
L731:    iconst_1
L732:    aload_0
L733:    getfield Field fg h [B
L736:    iload_3
L737:    baload
L738:    if_icmpeq L752
L741:    aload_0
L742:    getfield Field fg h [B
L745:    iload_3
L746:    iconst_1
L747:    bastore
L748:    goto L752
L751:    athrow
L752:    aload 4
L754:    getfield Field ag q Z
L757:    ifeq L764
L760:    goto L771
L763:    athrow
L764:    aload 4
L766:    bipush -126
L768:    invokevirtual Method ag c (I)V
L771:    aload 4
L773:    areturn
L774:    aload 5
L776:    ifnull L797
L779:    aload 5
L781:    arraylength
L782:    iconst_m1
L783:    ixor
L784:    bipush -3
L786:    if_icmpge L797
L789:    goto L793
L792:    athrow
L793:    goto L805
L796:    athrow
L797:    new java/lang/RuntimeException
L800:    dup
L801:    invokespecial Method java/lang/RuntimeException <init> ()V
L804:    athrow
L805:    getstatic Field aq d Ljava/util/zip/CRC32;
L808:    invokevirtual Method java/util/zip/CRC32 reset ()V
L811:    getstatic Field aq d Ljava/util/zip/CRC32;
L814:    aload 5
L816:    iconst_0
L817:    aload 5
L819:    arraylength
L820:    iconst_2
L821:    isub
L822:    invokevirtual Method java/util/zip/CRC32 update ([BII)V
L825:    getstatic Field aq d Ljava/util/zip/CRC32;
L828:    invokevirtual Method java/util/zip/CRC32 getValue ()J
L831:    l2i
L832:    istore 6
L834:    iload 6
L836:    iconst_m1
L837:    ixor
L838:    aload_0
L839:    getfield Field fg m Lps;
L842:    getfield Field ps g [I
L845:    iload_3
L846:    iaload
L847:    iconst_m1
L848:    ixor
L849:    if_icmpne L856
L852:    goto L864
L855:    athrow
L856:    new java/lang/RuntimeException
L859:    dup
L860:    invokespecial Method java/lang/RuntimeException <init> ()V
L863:    athrow
L864:    aload_0
L865:    getfield Field fg m Lps;
L868:    getfield Field ps i [[B
L871:    ifnull L966
L874:    aload_0
L875:    getfield Field fg m Lps;
L878:    getfield Field ps i [[B
L881:    iload_3
L882:    aaload
L883:    ifnull L966
L886:    goto L890
L889:    athrow
L890:    aload_0
L891:    getfield Field fg m Lps;
L894:    getfield Field ps i [[B
L897:    iload_3
L898:    aaload
L899:    astore 7
L901:    iconst_0
L902:    aload 5
L904:    arraylength
L905:    iconst_2
L906:    isub
L907:    aload 5
L909:    iconst_0
L910:    invokestatic Method qm a (II[BI)[B
L913:    astore 8
L915:    iconst_0
L916:    istore 9
L918:    bipush -65
L920:    iload 9
L922:    iconst_m1
L923:    ixor
L924:    if_icmpge L966
L927:    aload 8
L929:    iload 9
L931:    baload
L932:    aload 7
L934:    iload 9
L936:    baload
L937:    iload 10
L939:    ifne L995
L942:    if_icmpeq L958
L945:    goto L949
L948:    athrow
L949:    new java/lang/RuntimeException
L952:    dup
L953:    invokespecial Method java/lang/RuntimeException <init> ()V
L956:    athrow
L957:    athrow
L958:    iinc 9 1
L961:    iload 10
L963:    ifeq L918
L966:    sipush 255
L969:    aload 5
L971:    iconst_m1
L972:    aload 5
L974:    arraylength
L975:    iadd
L976:    baload
L977:    iand
L978:    sipush 255
L981:    aload 5
L983:    bipush -2
L985:    aload 5
L987:    arraylength
L988:    iadd
L989:    baload
L990:    iand
L991:    ldc_w -1232438008
L994:    ishl
L995:    iadd
L996:    istore 7
L998:    ldc_w 65535
L1001:    aload_0
L1002:    getfield Field fg m Lps;
L1005:    getfield Field ps a [I
L1008:    iload_3
L1009:    iaload
L1010:    iand
L1011:    iload 7
L1013:    if_icmpne L1020
L1016:    goto L1028
L1019:    athrow
L1020:    new java/lang/RuntimeException
L1023:    dup
L1024:    invokespecial Method java/lang/RuntimeException <init> ()V
L1027:    athrow
L1028:    bipush -2
L1030:    aload_0
L1031:    getfield Field fg h [B
L1034:    iload_3
L1035:    baload
L1036:    iconst_m1
L1037:    ixor
L1038:    if_icmpeq L1064
L1041:    iconst_m1
L1042:    aload_0
L1043:    getfield Field fg h [B
L1046:    iload_3
L1047:    baload
L1048:    iconst_m1
L1049:    ixor
L1050:    if_icmpeq L1057
L1053:    goto L1057
L1056:    athrow
L1057:    aload_0
L1058:    getfield Field fg h [B
L1061:    iload_3
L1062:    iconst_1
L1063:    bastore
L1064:    aload 4
L1066:    getfield Field ag q Z
L1069:    ifeq L1076
L1072:    goto L1085
L1075:    athrow
L1076:    aload 4
L1078:    iload_1
L1079:    bipush -87
L1081:    iadd
L1082:    invokevirtual Method ag c (I)V
L1085:    aload 4
L1087:    areturn
L1088:    astore 6
L1090:    aload_0
L1091:    getfield Field fg h [B
L1094:    iload_3
L1095:    iconst_m1
L1096:    bastore
L1097:    aload 4
L1099:    bipush -125
L1101:    invokevirtual Method ag c (I)V
L1104:    aload 4
L1106:    getfield Field ag q Z
L1109:    ifne L1116
L1112:    goto L1162
L1115:    athrow
L1116:    aload_0
L1117:    getfield Field fg g Lun;
L1120:    iconst_0
L1121:    invokevirtual Method un a (Z)Z
L1124:    ifeq L1131
L1127:    goto L1162
L1130:    athrow
L1131:    aload_0
L1132:    getfield Field fg g Lun;
L1135:    aload_0
L1136:    getfield Field fg p I
L1139:    iload_3
L1140:    bipush -21
L1142:    iconst_1
L1143:    iconst_2
L1144:    invokevirtual Method un a (IIIZB)Lgp;
L1147:    astore 4
L1149:    aload_0
L1150:    getfield Field fg v Lph;
L1153:    bipush -87
L1155:    iload_3
L1156:    i2l
L1157:    aload 4
L1159:    invokevirtual Method ph a (IJLwf;)V
L1162:    aconst_null
L1163:    areturn
L1164:    astore 4
L1166:    aload 4
L1168:    new java/lang/StringBuilder
L1171:    dup
L1172:    invokespecial Method java/lang/StringBuilder <init> ()V
L1175:    ldc_w "fg.J("
L1178:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L1181:    iload_1
L1182:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L1185:    bipush 44
L1187:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L1190:    iload_2
L1191:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L1194:    bipush 44
L1196:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L1199:    iload_3
L1200:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L1203:    bipush 41
L1205:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L1208:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L1211:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L1214:    athrow
L1215:
    .catch java/lang/RuntimeException from L132 to L146 using L149
    .catch java/lang/RuntimeException from L89 to L110 using L113
    .catch java/lang/RuntimeException from L80 to L96 using L99
    .catch java/lang/RuntimeException from L75 to L85 using L88
    .catch java/lang/RuntimeException from L51 to L64 using L64
    .catch java/lang/RuntimeException from L39 to L57 using L60
    .catch java/lang/RuntimeException from L27 to L45 using L48
    .catch java/lang/RuntimeException from L21 to L33 using L36
    .catch java/lang/RuntimeException from L364 to L579 using L582
    .catch java/lang/Exception from L774 to L1087 using L1088
    .catch java/lang/RuntimeException from L5 to L176 using L1164
    .catch java/lang/RuntimeException from L219 to L237 using L237
    .catch java/lang/RuntimeException from L203 to L218 using L218
    .catch java/lang/RuntimeException from L185 to L202 using L202
    .catch java/lang/RuntimeException from L177 to L251 using L1164
    .catch java/lang/RuntimeException from L275 to L289 using L289
    .catch java/lang/RuntimeException from L272 to L282 using L285
    .catch java/lang/RuntimeException from L177 to L190 using L193
    .catch java/lang/RuntimeException from L252 to L336 using L1164
    .catch java/lang/RuntimeException from L337 to L355 using L1164
    .catch java/lang/RuntimeException from L614 to L628 using L628
    .catch java/lang/RuntimeException from L584 to L613 using L613
    .catch java/lang/RuntimeException from L546 to L554 using L554
    .catch java/lang/RuntimeException from L520 to L542 using L545
    .catch java/lang/RuntimeException from L461 to L480 using L480
    .catch java/lang/RuntimeException from L449 to L473 using L476
    .catch java/lang/RuntimeException from L419 to L440 using L440
    .catch java/lang/RuntimeException from L370 to L388 using L388
    .catch java/lang/RuntimeException from L364 to L376 using L379
    .catch java/lang/RuntimeException from L356 to L661 using L1164
    .catch java/lang/RuntimeException from L752 to L763 using L763
    .catch java/lang/RuntimeException from L738 to L748 using L751
    .catch java/lang/RuntimeException from L662 to L773 using L1164
    .catch java/lang/RuntimeException from L1064 to L1075 using L1075
    .catch java/lang/RuntimeException from L1028 to L1053 using L1056
    .catch java/lang/RuntimeException from L998 to L1019 using L1019
    .catch java/lang/RuntimeException from L949 to L957 using L957
    .catch java/lang/RuntimeException from L927 to L945 using L948
    .catch java/lang/RuntimeException from L864 to L886 using L889
    .catch java/lang/RuntimeException from L834 to L855 using L855
    .catch java/lang/RuntimeException from L781 to L796 using L796
    .catch java/lang/RuntimeException from L662 to L714 using L714
    .catch java/lang/RuntimeException from L774 to L1087 using L1164
    .catch java/lang/RuntimeException from L1116 to L1130 using L1130
    .catch java/lang/RuntimeException from L1090 to L1115 using L1115
    .catch java/lang/RuntimeException from L774 to L789 using L792
    .catch java/lang/RuntimeException from L1088 to L1163 using L1164
    .end code
.end method

.method static final a : (IIIII[III)V
    .code stack 10 locals 29
L0:    getstatic Field AceOfSkies G Z
L3:    istore 28
L5:    iload_0
L6:    ifle L37
L9:    iload_0
L10:    bipush 23
L12:    invokestatic Method mg a (IB)Z
L15:    ifeq L26
L18:    goto L22
L21:    athrow
L22:    goto L37
L25:    athrow
L26:    new java/lang/IllegalArgumentException
L29:    dup
L30:    ldc_w ""
L33:    invokespecial Method java/lang/IllegalArgumentException <init> (Ljava/lang/String;)V
L36:    athrow
L37:    iconst_m1
L38:    iload_1
L39:    iconst_m1
L40:    ixor
L41:    if_icmple L72
L44:    iload_1
L45:    bipush 10
L47:    invokestatic Method mg a (IB)Z
L50:    ifeq L61
L53:    goto L57
L56:    athrow
L57:    goto L72
L60:    athrow
L61:    new java/lang/IllegalArgumentException
L64:    dup
L65:    ldc_w ""
L68:    invokespecial Method java/lang/IllegalArgumentException <init> (Ljava/lang/String;)V
L71:    athrow
L72:    iload_3
L73:    ldc_w 32993
L76:    if_icmpne L83
L79:    goto L94
L82:    athrow
L83:    new java/lang/IllegalArgumentException
L86:    dup
L87:    ldc_w ""
L90:    invokespecial Method java/lang/IllegalArgumentException <init> (Ljava/lang/String;)V
L93:    athrow
L94:    iconst_0
L95:    istore 8
L97:    iload_1
L98:    iconst_m1
L99:    ixor
L100:    iload_0
L101:    iconst_m1
L102:    ixor
L103:    if_icmplt L111
L106:    iload_1
L107:    goto L112
L110:    athrow
L111:    iload_0
L112:    istore 9
L114:    iload_0
L115:    ldc_w 2085300097
L118:    ishr
L119:    istore 10
L121:    iload_1
L122:    ldc_w -1719120191
L125:    ishr
L126:    istore 11
L128:    aload 5
L130:    astore 12
L132:    iload 11
L134:    iload 10
L136:    imul
L137:    newarray int
L139:    astore 13
L141:    iload 4
L143:    bipush 35
L145:    if_icmpge L159
L148:    aconst_null
L149:    checkcast ke
L152:    putstatic Field fg A Lke;
L155:    goto L159
L158:    athrow
L159:    iload_2
L160:    iload 8
L162:    iload 7
L164:    iload_0
L165:    iload_1
L166:    iconst_0
L167:    iload_3
L168:    iload 6
L170:    aload 12
L172:    iconst_0
L173:    invokestatic Method jaggl/OpenGL glTexImage2Di (IIIIIIII[II)V
L176:    iload 9
L178:    iconst_m1
L179:    ixor
L180:    bipush -2
L182:    if_icmpge L633
L185:    iconst_0
L186:    istore 15
L188:    iconst_0
L189:    istore 24
L191:    iload 24
L193:    iload_0
L194:    iadd
L195:    istore 25
L197:    aload 13
L199:    astore 14
L201:    iload 28
L203:    ifne L747
L206:    iconst_0
L207:    istore 26
L209:    iload 11
L211:    iconst_m1
L212:    ixor
L213:    iload 26
L215:    iconst_m1
L216:    ixor
L217:    if_icmpge L593
L220:    iconst_0
L221:    iload 28
L223:    ifne L623
L226:    istore 27
L228:    iload 27
L230:    iconst_m1
L231:    ixor
L232:    iload 10
L234:    iconst_m1
L235:    ixor
L236:    if_icmple L573
L239:    aload 12
L241:    iload 24
L243:    iinc 24 1
L246:    iaload
L247:    istore 16
L249:    aload 12
L251:    iload 25
L253:    iinc 25 1
L256:    iaload
L257:    istore 18
L259:    aload 12
L261:    iload 24
L263:    iinc 24 1
L266:    iaload
L267:    istore 17
L269:    sipush 255
L272:    iload 16
L274:    iand
L275:    istore 22
L277:    aload 12
L279:    iload 25
L281:    iinc 25 1
L284:    iaload
L285:    istore 19
L287:    sipush 255
L290:    iload 16
L292:    ldc_w -68277352
L295:    ishr
L296:    iand
L297:    istore 23
L299:    ldc_w 65501
L302:    iload 16
L304:    iand
L305:    ldc_w -908693240
L308:    ishr
L309:    istore 21
L311:    sipush 255
L314:    iload 16
L316:    ldc_w 910558192
L319:    ishr
L320:    iand
L321:    istore 20
L323:    iload 22
L325:    iload 17
L327:    sipush 255
L330:    iand
L331:    iadd
L332:    istore 22
L334:    iload 21
L336:    ldc_w 65454
L339:    iload 17
L341:    iand
L342:    ldc_w -479926520
L345:    ishr
L346:    iadd
L347:    istore 21
L349:    iload 20
L351:    ldc_w 16771045
L354:    iload 17
L356:    iand
L357:    ldc_w -865355920
L360:    ishr
L361:    iadd
L362:    istore 20
L364:    iload 23
L366:    sipush 255
L369:    iload 17
L371:    ldc_w -1195132392
L374:    ishr
L375:    iand
L376:    iadd
L377:    istore 23
L379:    iload 22
L381:    iload 18
L383:    sipush 255
L386:    iand
L387:    iadd
L388:    istore 22
L390:    iload 23
L392:    sipush 255
L395:    iload 18
L397:    ldc_w 294615384
L400:    ishr
L401:    iand
L402:    iadd
L403:    istore 23
L405:    iload 21
L407:    ldc_w 65350
L410:    iload 18
L412:    iand
L413:    ldc_w 912918568
L416:    ishr
L417:    iadd
L418:    istore 21
L420:    iload 20
L422:    iload 18
L424:    ldc_w -783342064
L427:    ishr
L428:    sipush 255
L431:    iand
L432:    iadd
L433:    istore 20
L435:    iload 23
L437:    sipush 255
L440:    iload 19
L442:    ldc_w 1940697176
L445:    ishr
L446:    iand
L447:    iadd
L448:    istore 23
L450:    iload 21
L452:    iload 19
L454:    ldc_w 65535
L457:    iand
L458:    ldc_w -1410121368
L461:    ishr
L462:    iadd
L463:    istore 21
L465:    iload 20
L467:    iload 19
L469:    ldc_w 16745210
L472:    iand
L473:    ldc_w 76567312
L476:    ishr
L477:    iadd
L478:    istore 20
L480:    iload 22
L482:    iload 19
L484:    sipush 255
L487:    iand
L488:    iadd
L489:    istore 22
L491:    aload 13
L493:    iload 15
L495:    iinc 15 1
L498:    iload 21
L500:    sipush 1020
L503:    invokestatic Method pg a (II)I
L506:    ldc_w -1328348026
L509:    ishl
L510:    iload 20
L512:    sipush 1020
L515:    invokestatic Method pg a (II)I
L518:    ldc_w 1912638254
L521:    ishl
L522:    ldc_w -16777216
L525:    iload 23
L527:    ldc_w -1130069354
L530:    ishl
L531:    invokestatic Method pg a (II)I
L534:    invokestatic Method vo a (II)I
L537:    invokestatic Method vo a (II)I
L540:    sipush 1020
L543:    iload 22
L545:    invokestatic Method pg a (II)I
L548:    ldc_w -1819664926
L551:    ishr
L552:    invokestatic Method vo a (II)I
L555:    iastore
L556:    iinc 27 1
L559:    iload 28
L561:    ifne L588
L564:    iload 28
L566:    ifeq L228
L569:    goto L573
L572:    athrow
L573:    iload 24
L575:    iload_0
L576:    iadd
L577:    istore 24
L579:    iload 25
L581:    iload_0
L582:    iadd
L583:    istore 25
L585:    iinc 26 1
L588:    iload 28
L590:    ifeq L209
L593:    aload 12
L595:    astore 13
L597:    iload 11
L599:    istore_1
L600:    iload 10
L602:    istore_0
L603:    aload 14
L605:    astore 12
L607:    iload 9
L609:    iconst_1
L610:    ishr
L611:    istore 9
L613:    iload 11
L615:    iconst_1
L616:    ishr
L617:    istore 11
L619:    iload 10
L621:    iconst_1
L622:    ishr
L623:    istore 10
L625:    iinc 8 1
L628:    iload 28
L630:    ifeq L159
L633:    goto L747
L636:    astore 8
L638:    aload 8
L640:    new java/lang/StringBuilder
L643:    dup
L644:    invokespecial Method java/lang/StringBuilder <init> ()V
L647:    ldc_w "fg.I("
L650:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L653:    iload_0
L654:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L657:    bipush 44
L659:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L662:    iload_1
L663:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L666:    bipush 44
L668:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L671:    iload_2
L672:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L675:    bipush 44
L677:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L680:    iload_3
L681:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L684:    bipush 44
L686:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L689:    iload 4
L691:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L694:    bipush 44
L696:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L699:    aload 5
L701:    ifnull L710
L704:    ldc "{...}"
L706:    goto L712
L709:    athrow
L710:    ldc "null"
L712:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L715:    bipush 44
L717:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L720:    iload 6
L722:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L725:    bipush 44
L727:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L730:    iload 7
L732:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L735:    bipush 41
L737:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L740:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L743:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L746:    athrow
L747:    return
L748:
    .catch java/lang/RuntimeException from L491 to L569 using L572
    .catch java/lang/RuntimeException from L141 to L155 using L158
    .catch java/lang/RuntimeException from L97 to L110 using L110
    .catch java/lang/RuntimeException from L72 to L82 using L82
    .catch java/lang/RuntimeException from L45 to L60 using L60
    .catch java/lang/RuntimeException from L37 to L53 using L56
    .catch java/lang/RuntimeException from L10 to L25 using L25
    .catch java/lang/RuntimeException from L5 to L633 using L636
    .catch java/lang/RuntimeException from L638 to L709 using L709
    .catch java/lang/RuntimeException from L5 to L18 using L21
    .end code
.end method

.method final c : (I)V
    .code stack 3 locals 3
L0:    aload_0
L1:    getfield Field fg l Lbl;
L4:    ifnull L10
L7:    goto L11
L10:    return
L11:    iload_1
L12:    bipush -2
L14:    if_icmpeq L18
L17:    return
L18:    aload_0
L19:    iconst_1
L20:    putfield Field fg s Z
L23:    aconst_null
L24:    aload_0
L25:    getfield Field fg o Lkp;
L28:    if_acmpne L42
L31:    aload_0
L32:    new kp
L35:    dup
L36:    invokespecial Method kp <init> ()V
L39:    putfield Field fg o Lkp;
L42:    goto L76
L45:    astore_2
L46:    aload_2
L47:    new java/lang/StringBuilder
L50:    dup
L51:    invokespecial Method java/lang/StringBuilder <init> ()V
L54:    ldc_w "fg.L("
L57:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L60:    iload_1
L61:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L64:    bipush 41
L66:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L69:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L72:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L75:    athrow
L76:    return
L77:
    .catch java/lang/RuntimeException from L0 to L10 using L45
    .catch java/lang/RuntimeException from L11 to L17 using L45
    .catch java/lang/RuntimeException from L18 to L42 using L45
    .end code
.end method

.method  <init> : (ILbl;Lbl;Lun;Ldk;I[BIZ)V
    .code stack 5 locals 11
L0:    aload_0
L1:    invokespecial Method ip <init> ()V
L4:    aload_0
L5:    new ph
L8:    dup
L9:    bipush 16
L11:    invokespecial Method ph <init> (I)V
L14:    putfield Field fg v Lph;
L17:    aload_0
L18:    iconst_0
L19:    putfield Field fg d I
L22:    aload_0
L23:    new kp
L26:    dup
L27:    invokespecial Method kp <init> ()V
L30:    putfield Field fg n Lkp;
L33:    aload_0
L34:    lconst_0
L35:    putfield Field fg x J
L38:    aload_0
L39:    iload_1
L40:    putfield Field fg p I
L43:    aload_0
L44:    aload_2
L45:    putfield Field fg l Lbl;
L48:    aload_0
L49:    getfield Field fg l Lbl;
L52:    ifnonnull L66
L55:    aload_0
L56:    iconst_0
L57:    putfield Field fg q Z
L60:    getstatic Field AceOfSkies G Z
L63:    ifeq L86
L66:    aload_0
L67:    iconst_1
L68:    putfield Field fg q Z
L71:    aload_0
L72:    new kp
L75:    dup
L76:    invokespecial Method kp <init> ()V
L79:    putfield Field fg o Lkp;
L82:    goto L86
L85:    athrow
L86:    aload_0
L87:    aload 4
L89:    putfield Field fg g Lun;
L92:    aload_0
L93:    aload_3
L94:    putfield Field fg e Lbl;
L97:    aload_0
L98:    aload 7
L100:    putfield Field fg u [B
L103:    aload_0
L104:    iload 9
L106:    putfield Field fg i Z
L109:    aload_0
L110:    iload 6
L112:    putfield Field fg j I
L115:    aload_0
L116:    aload 5
L118:    putfield Field fg z Ldk;
L121:    aload_0
L122:    iload 8
L124:    putfield Field fg w I
L127:    aload_0
L128:    getfield Field fg e Lbl;
L131:    ifnull L159
L134:    aload_0
L135:    aload_0
L136:    getfield Field fg z Ldk;
L139:    aload_0
L140:    getfield Field fg e Lbl;
L143:    bipush 93
L145:    aload_0
L146:    getfield Field fg p I
L149:    invokevirtual Method dk a (Lbl;BI)Los;
L152:    putfield Field fg y Lag;
L155:    goto L159
L158:    athrow
L159:    goto L328
L162:    astore 10
L164:    aload 10
L166:    new java/lang/StringBuilder
L169:    dup
L170:    invokespecial Method java/lang/StringBuilder <init> ()V
L173:    ldc_w "fg.<init>("
L176:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L179:    iload_1
L180:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L183:    bipush 44
L185:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L188:    aload_2
L189:    ifnull L198
L192:    ldc "{...}"
L194:    goto L200
L197:    athrow
L198:    ldc "null"
L200:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L203:    bipush 44
L205:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L208:    aload_3
L209:    ifnull L218
L212:    ldc "{...}"
L214:    goto L220
L217:    athrow
L218:    ldc "null"
L220:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L223:    bipush 44
L225:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L228:    aload 4
L230:    ifnull L239
L233:    ldc "{...}"
L235:    goto L241
L238:    athrow
L239:    ldc "null"
L241:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L244:    bipush 44
L246:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L249:    aload 5
L251:    ifnull L260
L254:    ldc "{...}"
L256:    goto L262
L259:    athrow
L260:    ldc "null"
L262:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L265:    bipush 44
L267:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L270:    iload 6
L272:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L275:    bipush 44
L277:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L280:    aload 7
L282:    ifnull L291
L285:    ldc "{...}"
L287:    goto L293
L290:    athrow
L291:    ldc "null"
L293:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L296:    bipush 44
L298:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L301:    iload 8
L303:    invokevirtual Method java/lang/StringBuilder append (I)Ljava/lang/StringBuilder;
L306:    bipush 44
L308:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L311:    iload 9
L313:    invokevirtual Method java/lang/StringBuilder append (Z)Ljava/lang/StringBuilder;
L316:    bipush 41
L318:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L321:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L324:    invokestatic Method pn a (Ljava/lang/Throwable;Ljava/lang/String;)Lak;
L327:    athrow
L328:    return
L329:
    .catch java/lang/RuntimeException from L86 to L155 using L158
    .catch java/lang/RuntimeException from L55 to L82 using L85
    .catch java/lang/RuntimeException from L38 to L159 using L162
    .catch java/lang/RuntimeException from L262 to L290 using L290
    .catch java/lang/RuntimeException from L241 to L259 using L259
    .catch java/lang/RuntimeException from L220 to L238 using L238
    .catch java/lang/RuntimeException from L200 to L217 using L217
    .catch java/lang/RuntimeException from L164 to L197 using L197
    .end code
.end method

.method static <clinit> : ()V
    .code stack 4 locals 0
L0:    new kp
L3:    dup
L4:    invokespecial Method kp <init> ()V
L7:    putstatic Field fg r Lkp;
L10:    bipush 12
L12:    anewarray java/lang/String
L15:    dup
L16:    iconst_0
L17:    ldc_w "January"
L20:    aastore
L21:    dup
L22:    iconst_1
L23:    ldc_w "February"
L26:    aastore
L27:    dup
L28:    iconst_2
L29:    ldc_w "March"
L32:    aastore
L33:    dup
L34:    iconst_3
L35:    ldc_w "April"
L38:    aastore
L39:    dup
L40:    iconst_4
L41:    ldc_w "May"
L44:    aastore
L45:    dup
L46:    iconst_5
L47:    ldc_w "June"
L50:    aastore
L51:    dup
L52:    bipush 6
L54:    ldc_w "July"
L57:    aastore
L58:    dup
L59:    bipush 7
L61:    ldc_w "August"
L64:    aastore
L65:    dup
L66:    bipush 8
L68:    ldc_w "September"
L71:    aastore
L72:    dup
L73:    bipush 9
L75:    ldc_w "October"
L78:    aastore
L79:    dup
L80:    bipush 10
L82:    ldc_w "November"
L85:    aastore
L86:    dup
L87:    bipush 11
L89:    ldc_w "December"
L92:    aastore
L93:    putstatic Field fg f [Ljava/lang/String;
L96:    new ke
L99:    dup
L100:    invokespecial Method ke <init> ()V
L103:    putstatic Field fg A Lke;
L106:    return
L107:
    .end code
.end method
.sourcefile "null"
.end class