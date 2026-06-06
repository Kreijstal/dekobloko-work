.version 50 0
.class final super fc
.super java/lang/Object
.field static d I

.field static e [Z

.field static f Ljava/lang/String;

.field static a Ltb;

.field static c Ljava/lang/String;

.field static b [[I
.method static final a : (ILjava/net/URL;Ljava/lang/String;Ljava/lang/String;I)Ljava/net/URL;
    .code stack 64 locals 10
L0:    getstatic Field SteelSentinels G I
L3:    istore 9
L5:    aload_1
L6:    invokevirtual Method java/net/URL getFile ()Ljava/lang/String;
L9:    astore 5
L11:    iconst_0
L12:    istore 6
L14:    iload_0
L15:    sipush -19571
L18:    if_icmpeq L28
L21:    iconst_0
L22:    invokestatic Method fc a (Z)V
L25:    goto L28
L28:    aload 5
L30:    iload 6
L32:    ldc "/l="
L34:    iconst_0
L35:    iconst_3
L36:    invokevirtual Method java/lang/String regionMatches (ILjava/lang/String;II)Z
L39:    ifne L45
L42:    goto L117
L45:    aload 5
L47:    bipush 47
L49:    iconst_1
L50:    iload 6
L52:    iadd
L53:    invokevirtual Method java/lang/String indexOf (II)I
L56:    istore 7
L58:    iload 7
L60:    ifge L66
L63:    goto L117
L66:    iconst_m1
L67:    iload 4
L69:    iconst_m1
L70:    ixor
L71:    if_icmplt L110
L74:    new java/lang/StringBuilder
L77:    dup
L78:    invokespecial Method java/lang/StringBuilder <init> ()V
L81:    aload 5
L83:    iconst_0
L84:    iload 6
L86:    invokevirtual Method java/lang/String substring (II)Ljava/lang/String;
L89:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L92:    aload 5
L94:    iload 7
L96:    invokevirtual Method java/lang/String substring (I)Ljava/lang/String;
L99:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L102:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L105:    astore 5
L107:    goto L28
L110:    iload 7
L112:    istore 6
L114:    goto L28
L117:    aload 5
L119:    iload 6
L121:    ldc "/a="
L123:    iconst_0
L124:    iconst_3
L125:    invokevirtual Method java/lang/String regionMatches (ILjava/lang/String;II)Z
L128:    ifeq L156
L131:    aload 5
L133:    bipush 47
L135:    iload 6
L137:    iconst_m1
L138:    isub
L139:    invokevirtual Method java/lang/String indexOf (II)I
L142:    istore 7
L144:    iload 7
L146:    iflt L156
L149:    iload 7
L151:    istore 6
L153:    goto L28
L156:    aload 5
L158:    iload 6
L160:    ldc "/p="
L162:    iconst_0
L163:    iconst_3
L164:    invokevirtual Method java/lang/String regionMatches (ILjava/lang/String;II)Z
L167:    ifne L173
L170:    goto L237
L173:    aload 5
L175:    bipush 47
L177:    iconst_1
L178:    iload 6
L180:    iadd
L181:    invokevirtual Method java/lang/String indexOf (II)I
L184:    istore 7
L186:    iload 7
L188:    iconst_m1
L189:    ixor
L190:    iconst_m1
L191:    if_icmple L197
L194:    goto L237
L197:    aload_2
L198:    ifnull L5000
L201:    new java/lang/StringBuilder
L204:    dup
L205:    invokespecial Method java/lang/StringBuilder <init> ()V
L208:    aload 5
L210:    iconst_0
L211:    iload 6
L213:    invokevirtual Method java/lang/String substring (II)Ljava/lang/String;
L216:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L219:    aload 5
L221:    iload 7
L223:    invokevirtual Method java/lang/String substring (I)Ljava/lang/String;
L226:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L229:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L232:    astore 5
L234:    goto L28
L5000:    iload 7
L5002:    istore 6
L5004:    goto L28
L237:    aload 5
L239:    iload 6
L241:    ldc "/s="
L243:    iconst_0
L244:    iconst_3
L245:    invokevirtual Method java/lang/String regionMatches (ILjava/lang/String;II)Z
L248:    ifne L268
L251:    aload 5
L253:    iload 6
L255:    ldc "/c="
L257:    iconst_0
L258:    iconst_3
L259:    invokevirtual Method java/lang/String regionMatches (ILjava/lang/String;II)Z
L262:    ifne L268
L265:    goto L336
L268:    aload 5
L270:    bipush 47
L272:    iload 6
L274:    iconst_m1
L275:    isub
L276:    invokevirtual Method java/lang/String indexOf (II)I
L279:    istore 7
L281:    iload 7
L283:    ifge L289
L286:    goto L336
L289:    aload_3
L290:    ifnonnull L300
L293:    iload 7
L295:    istore 6
L297:    goto L28
L300:    new java/lang/StringBuilder
L303:    dup
L304:    invokespecial Method java/lang/StringBuilder <init> ()V
L307:    aload 5
L309:    iconst_0
L310:    iload 6
L312:    invokevirtual Method java/lang/String substring (II)Ljava/lang/String;
L315:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L318:    aload 5
L320:    iload 7
L322:    invokevirtual Method java/lang/String substring (I)Ljava/lang/String;
L325:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L328:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L331:    astore 5
L333:    goto L28
L336:    new java/lang/StringBuilder
L339:    dup
L340:    iload 6
L342:    invokespecial Method java/lang/StringBuilder <init> (I)V
L345:    astore 7
L347:    aload 7
L349:    aload 5
L351:    iconst_0
L352:    iload 6
L354:    invokevirtual Method java/lang/String substring (II)Ljava/lang/String;
L357:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L360:    pop
L361:    iload 4
L363:    ifgt L369
L366:    goto L388
L369:    aload 7
L371:    ldc "/l="
L373:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L376:    pop
L377:    aload 7
L379:    iload 4
L381:    invokestatic Method java/lang/Integer toString (I)Ljava/lang/String;
L384:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L387:    pop
L388:    aload_2
L389:    ifnull L420
L392:    iconst_m1
L393:    aload_2
L394:    invokevirtual Method java/lang/String length ()I
L397:    iconst_m1
L398:    ixor
L399:    if_icmpgt L405
L402:    goto L420
L405:    aload 7
L407:    ldc "/p="
L409:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L412:    pop
L413:    aload 7
L415:    aload_2
L416:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L419:    pop
L420:    aload_3
L421:    ifnull L449
L424:    aload_3
L425:    invokevirtual Method java/lang/String length ()I
L428:    ifgt L434
L431:    goto L449
L434:    aload 7
L436:    ldc "/s="
L438:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L441:    pop
L442:    aload 7
L444:    aload_3
L445:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L448:    pop
L449:    iload 6
L451:    iconst_m1
L452:    ixor
L453:    aload 5
L455:    invokevirtual Method java/lang/String length ()I
L458:    iconst_m1
L459:    ixor
L460:    if_icmpgt L474
L463:    aload 7
L465:    bipush 47
L467:    invokevirtual Method java/lang/StringBuilder append (C)Ljava/lang/StringBuilder;
L470:    pop
L471:    goto L495
L474:    aload 7
L476:    aload 5
L478:    iload 6
L480:    aload 5
L482:    invokevirtual Method java/lang/String length ()I
L485:    invokevirtual Method java/lang/String substring (II)Ljava/lang/String;
L488:    invokevirtual Method java/lang/StringBuilder append (Ljava/lang/String;)Ljava/lang/StringBuilder;
L491:    pop
L492:    goto L495
L495:    new java/net/URL
L498:    dup
L499:    aload_1
L500:    aload 7
L502:    invokevirtual Method java/lang/StringBuilder toString ()Ljava/lang/String;
L505:    invokespecial Method java/net/URL <init> (Ljava/net/URL;Ljava/lang/String;)V
L508:    areturn
L509:    astore 8
L511:    aload 8
L513:    invokevirtual Method java/lang/Exception printStackTrace ()V
L516:    aload_1
L517:    areturn
L518:
    .catch java/lang/Exception from L495 to L508 using L509
    .end code
.end method
.sourcefile "null"
.end class
