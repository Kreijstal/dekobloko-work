.version 50 0
.class final super cw
.super java/lang/Object
.field static cw_a Ljava/lang/String;

.field static cw_b Ljava/lang/String;
.method static final a : (IIIIII)V
    .code stack 64 locals 19
L0:    getstatic Field ArmiesOfGielinor M Z
L3:    istore 18
L5:    bipush 50
L7:    getstatic Field ic ic_f I
L10:    iadd
L11:    istore 6
L13:    iload_3
L14:    bipush -116
L16:    if_icmple L917
L19:    aconst_null
L20:    checkcast java/lang/String
L23:    putstatic Field cw cw_b Ljava/lang/String;
L26:    aconst_null
L27:    getstatic Field jf C Lic;
L30:    getfield Field ic T Ljd;
L33:    if_acmpeq L4540
L36:    getstatic Field jf C Lic;
L39:    getfield Field ic ic_q I
L42:    getstatic Field bv bv_w Lha;
L45:    getfield Field ha ha_gb I
L48:    if_icmpeq L72
L51:    getstatic Field jf C Lic;
L54:    getfield Field ic T Ljd;
L57:    getfield Field jd O I
L60:    getstatic Field jf C Lic;
L63:    getfield Field ic ic_q I
L66:    if_icmpeq L915
L69:    goto L72
L72:    getstatic Field jf C Lic;
L75:    getfield Field ic T Ljd;
L78:    getfield Field jd B I
L81:    iconst_m1
L82:    ixor
L83:    iconst_m1
L84:    if_icmpge L912
L87:    getstatic Field jf C Lic;
L90:    getfield Field ic T Ljd;
L93:    getfield Field jd jd_s Z
L96:    ifne L469
L99:    getstatic Field jf C Lic;
L102:    getfield Field ic T Ljd;
L105:    getfield Field jd O I
L108:    iconst_m1
L109:    ixor
L110:    getstatic Field jf C Lic;
L113:    getfield Field ic ic_q I
L116:    iconst_m1
L117:    ixor
L118:    if_icmpne L469
L121:    getstatic Field jf C Lic;
L124:    getfield Field ic T Ljd;
L127:    sipush -13494
L130:    invokevirtual Method jd h (I)Z
L133:    ifne L469
L136:    getstatic Field jf C Lic;
L139:    getfield Field ic T Ljd;
L142:    sipush 3257
L145:    invokevirtual Method jd B (I)I
L148:    istore 7
L150:    getstatic Field jf C Lic;
L153:    getfield Field ic T Ljd;
L156:    bipush -79
L158:    invokevirtual Method jd l (B)I
L161:    istore 8
L163:    getstatic Field jf C Lic;
L166:    getfield Field ic ic_vb Lnn;
L169:    getfield Field nn nn_n I
L172:    istore 9
L174:    getstatic Field jf C Lic;
L177:    getfield Field ic ic_vb Lnn;
L180:    getfield Field nn nn_b I
L183:    istore 10
L185:    getstatic Field jf C Lic;
L188:    getfield Field ic T Ljd;
L191:    sipush -28467
L194:    invokevirtual Method jd o (I)Z
L197:    ifne L203
L200:    goto L228
L203:    getstatic Field jf C Lic;
L206:    getfield Field ic T Ljd;
L209:    iconst_0
L210:    invokevirtual Method jd a (Z)I
L213:    istore 9
L215:    getstatic Field jf C Lic;
L218:    getfield Field ic T Ljd;
L221:    bipush -65
L223:    invokevirtual Method jd D (I)I
L226:    istore 10
L228:    iload 9
L230:    iload 4
L232:    isub
L233:    invokestatic Method java/lang/Math abs (I)I
L236:    istore 11
L238:    iload 10
L240:    iload 5
L242:    ineg
L243:    iadd
L244:    invokestatic Method java/lang/Math abs (I)I
L247:    istore 12
L249:    iload 11
L251:    iload 12
L253:    iadd
L254:    iload 7
L256:    if_icmpgt L469
L259:    iload 8
L261:    iload 11
L263:    iload 12
L265:    ineg
L266:    isub
L267:    if_icmpgt L469
L270:    iload 12
L272:    iload 11
L274:    iadd
L275:    iconst_1
L276:    if_icmpne L283
L279:    iconst_1
L280:    goto L284
L283:    iconst_0
L284:    istore 13
L286:    iload 13
L288:    ifne L385
L291:    getstatic Field bv bv_w Lha;
L294:    bipush 31
L296:    iload 10
L298:    iload 9
L300:    getstatic Field jf C Lic;
L303:    getfield Field ic T Ljd;
L306:    getfield Field jd O I
L309:    invokevirtual Method ha b (IIII)I
L312:    iconst_2
L313:    iand
L314:    iconst_m1
L315:    ixor
L316:    iconst_m1
L317:    if_icmpne L385
L320:    iconst_2
L321:    getstatic Field bv bv_w Lha;
L324:    bipush 31
L326:    iload 5
L328:    iload 4
L330:    getstatic Field jf C Lic;
L333:    getfield Field ic T Ljd;
L336:    getfield Field jd O I
L339:    invokevirtual Method ha b (IIII)I
L342:    iand
L343:    ifne L385
L346:    getstatic Field bv bv_w Lha;
L349:    getfield Field ha ha_j Lul;
L352:    iload 10
L354:    iload 4
L356:    iload 9
L358:    getstatic Field jf C Lic;
L361:    getfield Field ic T Ljd;
L364:    bipush -111
L366:    invokevirtual Method jd x (I)Z
L369:    iload 7
L371:    iload 5
L373:    bipush 62
L375:    invokevirtual Method ul a (IIIZIIB)Z
L378:    ifeq L385
L381:    iconst_1
L382:    goto L386
L385:    iconst_0
L386:    istore 14
L388:    iload 13
L390:    ifne L401
L393:    iload 14
L395:    ifne L401
L398:    goto L469
L401:    iconst_1
L402:    istore 15
L404:    iload 15
L406:    iconst_m1
L407:    ixor
L408:    bipush -41
L410:    if_icmple L469
L413:    iload 15
L415:    iconst_2
L416:    imul
L417:    ineg
L418:    bipush 40
L420:    iadd
L421:    invokestatic Method java/lang/Math abs (I)I
L424:    istore 16
L426:    bipush -20
L428:    iload_1
L429:    iload 15
L431:    iadd
L432:    iadd
L433:    istore 17
L435:    bipush -40
L437:    iload_2
L438:    iadd
L439:    iload 16
L441:    iadd
L442:    iload 17
L444:    iconst_m1
L445:    iload 16
L447:    ineg
L448:    iadd
L449:    iload_2
L450:    iadd
L451:    bipush -40
L453:    isub
L454:    iload 17
L456:    ldc 16711680
L458:    iload 6
L460:    invokestatic Method qn d (IIIIII)V
L463:    iinc 15 2
L466:    goto L404
L469:    getstatic Field jf C Lic;
L472:    getfield Field ic T Ljd;
L475:    getfield Field jd jd_s Z
L478:    ifne L485
L481:    iconst_3
L482:    goto L486
L485:    iconst_1
L486:    istore 7
L488:    getstatic Field jf C Lic;
L491:    getfield Field ic ic_vb Lnn;
L494:    sipush 27732
L497:    invokevirtual Method nn c (I)I
L500:    istore 8
L502:    getstatic Field jf C Lic;
L505:    getfield Field ic ic_vb Lnn;
L508:    getfield Field nn nn_e [I
L511:    iload_0
L512:    iaload
L513:    iload 7
L515:    iand
L516:    iconst_m1
L517:    ixor
L518:    iconst_m1
L519:    if_icmpeq L916
L522:    getstatic Field jf C Lic;
L525:    getfield Field ic T Ljd;
L528:    getfield Field jd jd_s Z
L531:    ifne L554
L534:    getstatic Field jf C Lic;
L537:    getfield Field ic ic_vb Lnn;
L540:    getfield Field nn nn_q [I
L543:    iload_0
L544:    iaload
L545:    iload 8
L547:    if_icmple L553
L550:    goto L554
L553:    return
L554:    iload 5
L556:    ifeq L626
L559:    iload 8
L561:    getstatic Field jf C Lic;
L564:    getfield Field ic ic_vb Lnn;
L567:    getfield Field nn nn_q [I
L570:    getstatic Field bv bv_w Lha;
L573:    getfield Field ha ha_v I
L576:    ineg
L577:    iload_0
L578:    iadd
L579:    iaload
L580:    if_icmplt L598
L583:    getstatic Field jf C Lic;
L586:    getfield Field ic T Ljd;
L589:    getfield Field jd jd_s Z
L592:    ifeq L646
L595:    goto L598
L598:    iconst_m1
L599:    iload 7
L601:    getstatic Field jf C Lic;
L604:    getfield Field ic ic_vb Lnn;
L607:    getfield Field nn nn_e [I
L610:    iload_0
L611:    getstatic Field ks y I
L614:    ineg
L615:    iadd
L616:    iaload
L617:    iand
L618:    iconst_m1
L619:    ixor
L620:    if_icmpne L646
L623:    goto L626
L626:    bipush -40
L628:    iload_2
L629:    iadd
L630:    iload_1
L631:    iload_2
L632:    bipush -20
L634:    iload_1
L635:    iadd
L636:    ldc 16711680
L638:    iload 6
L640:    invokestatic Method qn d (IIIIII)V
L643:    goto L646
L646:    iload 5
L648:    iconst_m1
L649:    getstatic Field ef ef_c I
L652:    iadd
L653:    if_icmpeq L718
L656:    iload 8
L658:    getstatic Field jf C Lic;
L661:    getfield Field ic ic_vb Lnn;
L664:    getfield Field nn nn_q [I
L667:    getstatic Field ks y I
L670:    iload_0
L671:    iadd
L672:    iaload
L673:    if_icmplt L691
L676:    getstatic Field jf C Lic;
L679:    getfield Field ic T Ljd;
L682:    getfield Field jd jd_s Z
L685:    ifeq L735
L688:    goto L691
L691:    getstatic Field jf C Lic;
L694:    getfield Field ic ic_vb Lnn;
L697:    getfield Field nn nn_e [I
L700:    getstatic Field ks y I
L703:    iload_0
L704:    iadd
L705:    iaload
L706:    iload 7
L708:    iand
L709:    iconst_m1
L710:    ixor
L711:    iconst_m1
L712:    if_icmpeq L718
L715:    goto L735
L718:    bipush 40
L720:    iload_2
L721:    iadd
L722:    iload_1
L723:    iload_2
L724:    iload_1
L725:    bipush -20
L727:    isub
L728:    ldc 16711680
L730:    iload 6
L732:    invokestatic Method qn d (IIIIII)V
L735:    iconst_0
L736:    iload 4
L738:    if_icmpeq L803
L741:    getstatic Field jf C Lic;
L744:    getfield Field ic ic_vb Lnn;
L747:    getfield Field nn nn_q [I
L750:    iconst_m1
L751:    iload_0
L752:    iadd
L753:    iaload
L754:    iconst_m1
L755:    ixor
L756:    iload 8
L758:    iconst_m1
L759:    ixor
L760:    if_icmplt L778
L763:    getstatic Field jf C Lic;
L766:    getfield Field ic T Ljd;
L769:    getfield Field jd jd_s Z
L772:    ifeq L823
L775:    goto L778
L778:    iload 7
L780:    getstatic Field jf C Lic;
L783:    getfield Field ic ic_vb Lnn;
L786:    getfield Field nn nn_e [I
L789:    iload_0
L790:    iconst_1
L791:    isub
L792:    iaload
L793:    iand
L794:    iconst_m1
L795:    ixor
L796:    iconst_m1
L797:    if_icmpne L823
L800:    goto L803
L803:    iload_2
L804:    bipush -40
L806:    iadd
L807:    iload_1
L808:    iload_2
L809:    bipush 20
L811:    iload_1
L812:    iadd
L813:    ldc 16711680
L815:    iload 6
L817:    invokestatic Method qn d (IIIIII)V
L820:    goto L823
L823:    iload 4
L825:    iconst_m1
L826:    ixor
L827:    iconst_m1
L828:    getstatic Field ks y I
L831:    iadd
L832:    iconst_m1
L833:    ixor
L834:    if_icmpeq L895
L837:    iload 8
L839:    getstatic Field jf C Lic;
L842:    getfield Field ic ic_vb Lnn;
L845:    getfield Field nn nn_q [I
L848:    iconst_1
L849:    iload_0
L850:    iadd
L851:    iaload
L852:    if_icmplt L870
L855:    getstatic Field jf C Lic;
L858:    getfield Field ic T Ljd;
L861:    getfield Field jd jd_s Z
L864:    ifeq L912
L867:    goto L870
L870:    iload 7
L872:    getstatic Field jf C Lic;
L875:    getfield Field ic ic_vb Lnn;
L878:    getfield Field nn nn_e [I
L881:    iload_0
L882:    iconst_m1
L883:    isub
L884:    iaload
L885:    iand
L886:    iconst_m1
L887:    ixor
L888:    iconst_m1
L889:    if_icmpeq L895
L892:    goto L915
L895:    bipush 40
L897:    iload_2
L898:    iadd
L899:    iload_1
L900:    iload_2
L901:    bipush -20
L903:    iload_1
L904:    iadd
L905:    ldc 16711680
L907:    iload 6
L909:    invokestatic Method qn d (IIIIII)V
L912:    goto L915
L915:    return
L916:    return
L917:    aconst_null
L918:    getstatic Field jf C Lic;
L921:    getfield Field ic T Ljd;
L924:    if_acmpne L928
L927:    return
L928:    getstatic Field jf C Lic;
L931:    getfield Field ic ic_q I
L934:    getstatic Field bv bv_w Lha;
L937:    getfield Field ha ha_gb I
L940:    if_icmpeq L1805
L943:    getstatic Field jf C Lic;
L946:    getfield Field ic T Ljd;
L949:    getfield Field jd O I
L952:    getstatic Field jf C Lic;
L955:    getfield Field ic ic_q I
L958:    if_icmpne L962
L961:    return
L962:    getstatic Field jf C Lic;
L965:    getfield Field ic T Ljd;
L968:    getfield Field jd B I
L971:    iconst_m1
L972:    ixor
L973:    iconst_m1
L974:    if_icmplt L978
L977:    return
L978:    getstatic Field jf C Lic;
L981:    getfield Field ic T Ljd;
L984:    getfield Field jd jd_s Z
L987:    ifne L1360
L990:    getstatic Field jf C Lic;
L993:    getfield Field ic T Ljd;
L996:    getfield Field jd O I
L999:    iconst_m1
L1000:    ixor
L1001:    getstatic Field jf C Lic;
L1004:    getfield Field ic ic_q I
L1007:    iconst_m1
L1008:    ixor
L1009:    if_icmpne L1360
L1012:    getstatic Field jf C Lic;
L1015:    getfield Field ic T Ljd;
L1018:    sipush -13494
L1021:    invokevirtual Method jd h (I)Z
L1024:    ifne L1360
L1027:    getstatic Field jf C Lic;
L1030:    getfield Field ic T Ljd;
L1033:    sipush 3257
L1036:    invokevirtual Method jd B (I)I
L1039:    istore 7
L1041:    getstatic Field jf C Lic;
L1044:    getfield Field ic T Ljd;
L1047:    bipush -79
L1049:    invokevirtual Method jd l (B)I
L1052:    istore 8
L1054:    getstatic Field jf C Lic;
L1057:    getfield Field ic ic_vb Lnn;
L1060:    getfield Field nn nn_n I
L1063:    istore 9
L1065:    getstatic Field jf C Lic;
L1068:    getfield Field ic ic_vb Lnn;
L1071:    getfield Field nn nn_b I
L1074:    istore 10
L1076:    getstatic Field jf C Lic;
L1079:    getfield Field ic T Ljd;
L1082:    sipush -28467
L1085:    invokevirtual Method jd o (I)Z
L1088:    ifne L1094
L1091:    goto L1119
L1094:    getstatic Field jf C Lic;
L1097:    getfield Field ic T Ljd;
L1100:    iconst_0
L1101:    invokevirtual Method jd a (Z)I
L1104:    istore 9
L1106:    getstatic Field jf C Lic;
L1109:    getfield Field ic T Ljd;
L1112:    bipush -65
L1114:    invokevirtual Method jd D (I)I
L1117:    istore 10
L1119:    iload 9
L1121:    iload 4
L1123:    isub
L1124:    invokestatic Method java/lang/Math abs (I)I
L1127:    istore 11
L1129:    iload 10
L1131:    iload 5
L1133:    ineg
L1134:    iadd
L1135:    invokestatic Method java/lang/Math abs (I)I
L1138:    istore 12
L1140:    iload 11
L1142:    iload 12
L1144:    iadd
L1145:    iload 7
L1147:    if_icmpgt L1360
L1150:    iload 8
L1152:    iload 11
L1154:    iload 12
L1156:    ineg
L1157:    isub
L1158:    if_icmpgt L1360
L1161:    iload 12
L1163:    iload 11
L1165:    iadd
L1166:    iconst_1
L1167:    if_icmpne L1174
L1170:    iconst_1
L1171:    goto L1175
L1174:    iconst_0
L1175:    istore 13
L1177:    iload 13
L1179:    ifne L1276
L1182:    getstatic Field bv bv_w Lha;
L1185:    bipush 31
L1187:    iload 10
L1189:    iload 9
L1191:    getstatic Field jf C Lic;
L1194:    getfield Field ic T Ljd;
L1197:    getfield Field jd O I
L1200:    invokevirtual Method ha b (IIII)I
L1203:    iconst_2
L1204:    iand
L1205:    iconst_m1
L1206:    ixor
L1207:    iconst_m1
L1208:    if_icmpne L1276
L1211:    iconst_2
L1212:    getstatic Field bv bv_w Lha;
L1215:    bipush 31
L1217:    iload 5
L1219:    iload 4
L1221:    getstatic Field jf C Lic;
L1224:    getfield Field ic T Ljd;
L1227:    getfield Field jd O I
L1230:    invokevirtual Method ha b (IIII)I
L1233:    iand
L1234:    ifne L1276
L1237:    getstatic Field bv bv_w Lha;
L1240:    getfield Field ha ha_j Lul;
L1243:    iload 10
L1245:    iload 4
L1247:    iload 9
L1249:    getstatic Field jf C Lic;
L1252:    getfield Field ic T Ljd;
L1255:    bipush -111
L1257:    invokevirtual Method jd x (I)Z
L1260:    iload 7
L1262:    iload 5
L1264:    bipush 62
L1266:    invokevirtual Method ul a (IIIZIIB)Z
L1269:    ifeq L1276
L1272:    iconst_1
L1273:    goto L1277
L1276:    iconst_0
L1277:    istore 14
L1279:    iload 13
L1281:    ifne L1292
L1284:    iload 14
L1286:    ifne L1292
L1289:    goto L1360
L1292:    iconst_1
L1293:    istore 15
L1295:    iload 15
L1297:    iconst_m1
L1298:    ixor
L1299:    bipush -41
L1301:    if_icmple L1360
L1304:    iload 15
L1306:    iconst_2
L1307:    imul
L1308:    ineg
L1309:    bipush 40
L1311:    iadd
L1312:    invokestatic Method java/lang/Math abs (I)I
L1315:    istore 16
L1317:    bipush -20
L1319:    iload_1
L1320:    iload 15
L1322:    iadd
L1323:    iadd
L1324:    istore 17
L1326:    bipush -40
L1328:    iload_2
L1329:    iadd
L1330:    iload 16
L1332:    iadd
L1333:    iload 17
L1335:    iconst_m1
L1336:    iload 16
L1338:    ineg
L1339:    iadd
L1340:    iload_2
L1341:    iadd
L1342:    bipush -40
L1344:    isub
L1345:    iload 17
L1347:    ldc 16711680
L1349:    iload 6
L1351:    invokestatic Method qn d (IIIIII)V
L1354:    iinc 15 2
L1357:    goto L1295
L1360:    getstatic Field jf C Lic;
L1363:    getfield Field ic T Ljd;
L1366:    getfield Field jd jd_s Z
L1369:    ifne L1376
L1372:    iconst_3
L1373:    goto L1377
L1376:    iconst_1
L1377:    istore 7
L1379:    getstatic Field jf C Lic;
L1382:    getfield Field ic ic_vb Lnn;
L1385:    sipush 27732
L1388:    invokevirtual Method nn c (I)I
L1391:    istore 8
L1393:    getstatic Field jf C Lic;
L1396:    getfield Field ic ic_vb Lnn;
L1399:    getfield Field nn nn_e [I
L1402:    iload_0
L1403:    iaload
L1404:    iload 7
L1406:    iand
L1407:    iconst_m1
L1408:    ixor
L1409:    iconst_m1
L1410:    if_icmpeq L1804
L1413:    getstatic Field jf C Lic;
L1416:    getfield Field ic T Ljd;
L1419:    getfield Field jd jd_s Z
L1422:    ifne L1445
L1425:    getstatic Field jf C Lic;
L1428:    getfield Field ic ic_vb Lnn;
L1431:    getfield Field nn nn_q [I
L1434:    iload_0
L1435:    iaload
L1436:    iload 8
L1438:    if_icmple L1444
L1441:    goto L1445
L1444:    return
L1445:    iload 5
L1447:    ifeq L1517
L1450:    iload 8
L1452:    getstatic Field jf C Lic;
L1455:    getfield Field ic ic_vb Lnn;
L1458:    getfield Field nn nn_q [I
L1461:    getstatic Field bv bv_w Lha;
L1464:    getfield Field ha ha_v I
L1467:    ineg
L1468:    iload_0
L1469:    iadd
L1470:    iaload
L1471:    if_icmplt L1489
L1474:    getstatic Field jf C Lic;
L1477:    getfield Field ic T Ljd;
L1480:    getfield Field jd jd_s Z
L1483:    ifeq L1537
L1486:    goto L1489
L1489:    iconst_m1
L1490:    iload 7
L1492:    getstatic Field jf C Lic;
L1495:    getfield Field ic ic_vb Lnn;
L1498:    getfield Field nn nn_e [I
L1501:    iload_0
L1502:    getstatic Field ks y I
L1505:    ineg
L1506:    iadd
L1507:    iaload
L1508:    iand
L1509:    iconst_m1
L1510:    ixor
L1511:    if_icmpne L1537
L1514:    goto L1517
L1517:    bipush -40
L1519:    iload_2
L1520:    iadd
L1521:    iload_1
L1522:    iload_2
L1523:    bipush -20
L1525:    iload_1
L1526:    iadd
L1527:    ldc 16711680
L1529:    iload 6
L1531:    invokestatic Method qn d (IIIIII)V
L1534:    goto L1537
L1537:    iload 5
L1539:    iconst_m1
L1540:    getstatic Field ef ef_c I
L1543:    iadd
L1544:    if_icmpeq L1609
L1547:    iload 8
L1549:    getstatic Field jf C Lic;
L1552:    getfield Field ic ic_vb Lnn;
L1555:    getfield Field nn nn_q [I
L1558:    getstatic Field ks y I
L1561:    iload_0
L1562:    iadd
L1563:    iaload
L1564:    if_icmplt L1582
L1567:    getstatic Field jf C Lic;
L1570:    getfield Field ic T Ljd;
L1573:    getfield Field jd jd_s Z
L1576:    ifeq L1626
L1579:    goto L1582
L1582:    getstatic Field jf C Lic;
L1585:    getfield Field ic ic_vb Lnn;
L1588:    getfield Field nn nn_e [I
L1591:    getstatic Field ks y I
L1594:    iload_0
L1595:    iadd
L1596:    iaload
L1597:    iload 7
L1599:    iand
L1600:    iconst_m1
L1601:    ixor
L1602:    iconst_m1
L1603:    if_icmpeq L1609
L1606:    goto L1626
L1609:    bipush 40
L1611:    iload_2
L1612:    iadd
L1613:    iload_1
L1614:    iload_2
L1615:    iload_1
L1616:    bipush -20
L1618:    isub
L1619:    ldc 16711680
L1621:    iload 6
L1623:    invokestatic Method qn d (IIIIII)V
L1626:    iconst_0
L1627:    iload 4
L1629:    if_icmpeq L1694
L1632:    getstatic Field jf C Lic;
L1635:    getfield Field ic ic_vb Lnn;
L1638:    getfield Field nn nn_q [I
L1641:    iconst_m1
L1642:    iload_0
L1643:    iadd
L1644:    iaload
L1645:    iconst_m1
L1646:    ixor
L1647:    iload 8
L1649:    iconst_m1
L1650:    ixor
L1651:    if_icmplt L1669
L1654:    getstatic Field jf C Lic;
L1657:    getfield Field ic T Ljd;
L1660:    getfield Field jd jd_s Z
L1663:    ifeq L1714
L1666:    goto L1669
L1669:    iload 7
L1671:    getstatic Field jf C Lic;
L1674:    getfield Field ic ic_vb Lnn;
L1677:    getfield Field nn nn_e [I
L1680:    iload_0
L1681:    iconst_1
L1682:    isub
L1683:    iaload
L1684:    iand
L1685:    iconst_m1
L1686:    ixor
L1687:    iconst_m1
L1688:    if_icmpne L1714
L1691:    goto L1694
L1694:    iload_2
L1695:    bipush -40
L1697:    iadd
L1698:    iload_1
L1699:    iload_2
L1700:    bipush 20
L1702:    iload_1
L1703:    iadd
L1704:    ldc 16711680
L1706:    iload 6
L1708:    invokestatic Method qn d (IIIIII)V
L1711:    goto L1714
L1714:    iload 4
L1716:    iconst_m1
L1717:    ixor
L1718:    iconst_m1
L1719:    getstatic Field ks y I
L1722:    iadd
L1723:    iconst_m1
L1724:    ixor
L1725:    if_icmpeq L1786
L1728:    iload 8
L1730:    getstatic Field jf C Lic;
L1733:    getfield Field ic ic_vb Lnn;
L1736:    getfield Field nn nn_q [I
L1739:    iconst_1
L1740:    iload_0
L1741:    iadd
L1742:    iaload
L1743:    if_icmplt L1761
L1746:    getstatic Field jf C Lic;
L1749:    getfield Field ic T Ljd;
L1752:    getfield Field jd jd_s Z
L1755:    ifeq L1803
L1758:    goto L1761
L1761:    iload 7
L1763:    getstatic Field jf C Lic;
L1766:    getfield Field ic ic_vb Lnn;
L1769:    getfield Field nn nn_e [I
L1772:    iload_0
L1773:    iconst_m1
L1774:    isub
L1775:    iaload
L1776:    iand
L1777:    iconst_m1
L1778:    ixor
L1779:    iconst_m1
L1780:    if_icmpeq L1786
L1783:    goto L1803
L1786:    bipush 40
L1788:    iload_2
L1789:    iadd
L1790:    iload_1
L1791:    iload_2
L1792:    bipush -20
L1794:    iload_1
L1795:    iadd
L1796:    ldc 16711680
L1798:    iload 6
L1800:    invokestatic Method qn d (IIIIII)V
L1803:    return
L1804:    return
L1805:    getstatic Field jf C Lic;
L1808:    getfield Field ic T Ljd;
L1811:    getfield Field jd B I
L1814:    iconst_m1
L1815:    ixor
L1816:    iconst_m1
L1817:    if_icmplt L1821
L1820:    return
L1821:    getstatic Field jf C Lic;
L1824:    getfield Field ic T Ljd;
L1827:    getfield Field jd jd_s Z
L1830:    ifeq L2276
L1833:    getstatic Field jf C Lic;
L1836:    getfield Field ic T Ljd;
L1839:    getfield Field jd jd_s Z
L1842:    ifne L1849
L1845:    iconst_3
L1846:    goto L1850
L1849:    iconst_1
L1850:    istore 7
L1852:    getstatic Field jf C Lic;
L1855:    getfield Field ic ic_vb Lnn;
L1858:    sipush 27732
L1861:    invokevirtual Method nn c (I)I
L1864:    istore 8
L1866:    getstatic Field jf C Lic;
L1869:    getfield Field ic ic_vb Lnn;
L1872:    getfield Field nn nn_e [I
L1875:    iload_0
L1876:    iaload
L1877:    iload 7
L1879:    iand
L1880:    iconst_m1
L1881:    ixor
L1882:    iconst_m1
L1883:    if_icmpeq L2275
L1886:    getstatic Field jf C Lic;
L1889:    getfield Field ic T Ljd;
L1892:    getfield Field jd jd_s Z
L1895:    ifne L1918
L1898:    getstatic Field jf C Lic;
L1901:    getfield Field ic ic_vb Lnn;
L1904:    getfield Field nn nn_q [I
L1907:    iload_0
L1908:    iaload
L1909:    iload 8
L1911:    if_icmple L1917
L1914:    goto L1918
L1917:    return
L1918:    iload 5
L1920:    ifeq L1990
L1923:    iload 8
L1925:    getstatic Field jf C Lic;
L1928:    getfield Field ic ic_vb Lnn;
L1931:    getfield Field nn nn_q [I
L1934:    getstatic Field bv bv_w Lha;
L1937:    getfield Field ha ha_v I
L1940:    ineg
L1941:    iload_0
L1942:    iadd
L1943:    iaload
L1944:    if_icmplt L1962
L1947:    getstatic Field jf C Lic;
L1950:    getfield Field ic T Ljd;
L1953:    getfield Field jd jd_s Z
L1956:    ifeq L2010
L1959:    goto L1962
L1962:    iconst_m1
L1963:    iload 7
L1965:    getstatic Field jf C Lic;
L1968:    getfield Field ic ic_vb Lnn;
L1971:    getfield Field nn nn_e [I
L1974:    iload_0
L1975:    getstatic Field ks y I
L1978:    ineg
L1979:    iadd
L1980:    iaload
L1981:    iand
L1982:    iconst_m1
L1983:    ixor
L1984:    if_icmpne L2010
L1987:    goto L1990
L1990:    bipush -40
L1992:    iload_2
L1993:    iadd
L1994:    iload_1
L1995:    iload_2
L1996:    bipush -20
L1998:    iload_1
L1999:    iadd
L2000:    ldc 16711680
L2002:    iload 6
L2004:    invokestatic Method qn d (IIIIII)V
L2007:    goto L2010
L2010:    iload 5
L2012:    iconst_m1
L2013:    getstatic Field ef ef_c I
L2016:    iadd
L2017:    if_icmpeq L2082
L2020:    iload 8
L2022:    getstatic Field jf C Lic;
L2025:    getfield Field ic ic_vb Lnn;
L2028:    getfield Field nn nn_q [I
L2031:    getstatic Field ks y I
L2034:    iload_0
L2035:    iadd
L2036:    iaload
L2037:    if_icmplt L2055
L2040:    getstatic Field jf C Lic;
L2043:    getfield Field ic T Ljd;
L2046:    getfield Field jd jd_s Z
L2049:    ifeq L2099
L2052:    goto L2055
L2055:    getstatic Field jf C Lic;
L2058:    getfield Field ic ic_vb Lnn;
L2061:    getfield Field nn nn_e [I
L2064:    getstatic Field ks y I
L2067:    iload_0
L2068:    iadd
L2069:    iaload
L2070:    iload 7
L2072:    iand
L2073:    iconst_m1
L2074:    ixor
L2075:    iconst_m1
L2076:    if_icmpeq L2082
L2079:    goto L2099
L2082:    bipush 40
L2084:    iload_2
L2085:    iadd
L2086:    iload_1
L2087:    iload_2
L2088:    iload_1
L2089:    bipush -20
L2091:    isub
L2092:    ldc 16711680
L2094:    iload 6
L2096:    invokestatic Method qn d (IIIIII)V
L2099:    iconst_0
L2100:    iload 4
L2102:    if_icmpeq L2167
L2105:    getstatic Field jf C Lic;
L2108:    getfield Field ic ic_vb Lnn;
L2111:    getfield Field nn nn_q [I
L2114:    iconst_m1
L2115:    iload_0
L2116:    iadd
L2117:    iaload
L2118:    iconst_m1
L2119:    ixor
L2120:    iload 8
L2122:    iconst_m1
L2123:    ixor
L2124:    if_icmplt L2142
L2127:    getstatic Field jf C Lic;
L2130:    getfield Field ic T Ljd;
L2133:    getfield Field jd jd_s Z
L2136:    ifeq L2187
L2139:    goto L2142
L2142:    iload 7
L2144:    getstatic Field jf C Lic;
L2147:    getfield Field ic ic_vb Lnn;
L2150:    getfield Field nn nn_e [I
L2153:    iload_0
L2154:    iconst_1
L2155:    isub
L2156:    iaload
L2157:    iand
L2158:    iconst_m1
L2159:    ixor
L2160:    iconst_m1
L2161:    if_icmpne L2187
L2164:    goto L2167
L2167:    iload_2
L2168:    bipush -40
L2170:    iadd
L2171:    iload_1
L2172:    iload_2
L2173:    bipush 20
L2175:    iload_1
L2176:    iadd
L2177:    ldc 16711680
L2179:    iload 6
L2181:    invokestatic Method qn d (IIIIII)V
L2184:    goto L2187
L2187:    iload 4
L2189:    iconst_m1
L2190:    ixor
L2191:    iconst_m1
L2192:    getstatic Field ks y I
L2195:    iadd
L2196:    iconst_m1
L2197:    ixor
L2198:    if_icmpeq L2257
L2201:    iload 8
L2203:    getstatic Field jf C Lic;
L2206:    getfield Field ic ic_vb Lnn;
L2209:    getfield Field nn nn_q [I
L2212:    iconst_1
L2213:    iload_0
L2214:    iadd
L2215:    iaload
L2216:    if_icmplt L2232
L2219:    getstatic Field jf C Lic;
L2222:    getfield Field ic T Ljd;
L2225:    getfield Field jd jd_s Z
L2228:    ifne L2232
L2231:    return
L2232:    iload 7
L2234:    getstatic Field jf C Lic;
L2237:    getfield Field ic ic_vb Lnn;
L2240:    getfield Field nn nn_e [I
L2243:    iload_0
L2244:    iconst_m1
L2245:    isub
L2246:    iaload
L2247:    iand
L2248:    iconst_m1
L2249:    ixor
L2250:    iconst_m1
L2251:    if_icmpeq L2257
L2254:    goto L2274
L2257:    bipush 40
L2259:    iload_2
L2260:    iadd
L2261:    iload_1
L2262:    iload_2
L2263:    bipush -20
L2265:    iload_1
L2266:    iadd
L2267:    ldc 16711680
L2269:    iload 6
L2271:    invokestatic Method qn d (IIIIII)V
L2274:    return
L2275:    return
L2276:    getstatic Field jf C Lic;
L2279:    getfield Field ic T Ljd;
L2282:    getfield Field jd O I
L2285:    iconst_m1
L2286:    ixor
L2287:    getstatic Field jf C Lic;
L2290:    getfield Field ic ic_q I
L2293:    iconst_m1
L2294:    ixor
L2295:    if_icmpne L3086
L2298:    getstatic Field jf C Lic;
L2301:    getfield Field ic T Ljd;
L2304:    sipush -13494
L2307:    invokevirtual Method jd h (I)Z
L2310:    ifne L3086
L2313:    getstatic Field jf C Lic;
L2316:    getfield Field ic T Ljd;
L2319:    sipush 3257
L2322:    invokevirtual Method jd B (I)I
L2325:    istore 7
L2327:    getstatic Field jf C Lic;
L2330:    getfield Field ic T Ljd;
L2333:    bipush -79
L2335:    invokevirtual Method jd l (B)I
L2338:    istore 8
L2340:    getstatic Field jf C Lic;
L2343:    getfield Field ic ic_vb Lnn;
L2346:    getfield Field nn nn_n I
L2349:    istore 9
L2351:    getstatic Field jf C Lic;
L2354:    getfield Field ic ic_vb Lnn;
L2357:    getfield Field nn nn_b I
L2360:    istore 10
L2362:    getstatic Field jf C Lic;
L2365:    getfield Field ic T Ljd;
L2368:    sipush -28467
L2371:    invokevirtual Method jd o (I)Z
L2374:    ifne L2380
L2377:    goto L2405
L2380:    getstatic Field jf C Lic;
L2383:    getfield Field ic T Ljd;
L2386:    iconst_0
L2387:    invokevirtual Method jd a (Z)I
L2390:    istore 9
L2392:    getstatic Field jf C Lic;
L2395:    getfield Field ic T Ljd;
L2398:    bipush -65
L2400:    invokevirtual Method jd D (I)I
L2403:    istore 10
L2405:    iload 9
L2407:    iload 4
L2409:    isub
L2410:    invokestatic Method java/lang/Math abs (I)I
L2413:    istore 11
L2415:    iload 10
L2417:    iload 5
L2419:    ineg
L2420:    iadd
L2421:    invokestatic Method java/lang/Math abs (I)I
L2424:    istore 12
L2426:    iload 11
L2428:    iload 12
L2430:    iadd
L2431:    iload 7
L2433:    if_icmpgt L3086
L2436:    iload 8
L2438:    iload 11
L2440:    iload 12
L2442:    ineg
L2443:    isub
L2444:    if_icmpgt L3086
L2447:    iload 12
L2449:    iload 11
L2451:    iadd
L2452:    iconst_1
L2453:    if_icmpne L2460
L2456:    iconst_1
L2457:    goto L2461
L2460:    iconst_0
L2461:    istore 13
L2463:    iload 13
L2465:    ifne L2562
L2468:    getstatic Field bv bv_w Lha;
L2471:    bipush 31
L2473:    iload 10
L2475:    iload 9
L2477:    getstatic Field jf C Lic;
L2480:    getfield Field ic T Ljd;
L2483:    getfield Field jd O I
L2486:    invokevirtual Method ha b (IIII)I
L2489:    iconst_2
L2490:    iand
L2491:    iconst_m1
L2492:    ixor
L2493:    iconst_m1
L2494:    if_icmpne L2562
L2497:    iconst_2
L2498:    getstatic Field bv bv_w Lha;
L2501:    bipush 31
L2503:    iload 5
L2505:    iload 4
L2507:    getstatic Field jf C Lic;
L2510:    getfield Field ic T Ljd;
L2513:    getfield Field jd O I
L2516:    invokevirtual Method ha b (IIII)I
L2519:    iand
L2520:    ifne L2562
L2523:    getstatic Field bv bv_w Lha;
L2526:    getfield Field ha ha_j Lul;
L2529:    iload 10
L2531:    iload 4
L2533:    iload 9
L2535:    getstatic Field jf C Lic;
L2538:    getfield Field ic T Ljd;
L2541:    bipush -111
L2543:    invokevirtual Method jd x (I)Z
L2546:    iload 7
L2548:    iload 5
L2550:    bipush 62
L2552:    invokevirtual Method ul a (IIIZIIB)Z
L2555:    ifeq L2562
L2558:    iconst_1
L2559:    goto L2563
L2562:    iconst_0
L2563:    istore 14
L2565:    iload 13
L2567:    ifne L3018
L2570:    iload 14
L2572:    ifne L3018
L2575:    getstatic Field jf C Lic;
L2578:    getfield Field ic T Ljd;
L2581:    getfield Field jd jd_s Z
L2584:    ifne L2591
L2587:    iconst_3
L2588:    goto L2592
L2591:    iconst_1
L2592:    istore 7
L2594:    getstatic Field jf C Lic;
L2597:    getfield Field ic ic_vb Lnn;
L2600:    sipush 27732
L2603:    invokevirtual Method nn c (I)I
L2606:    istore 8
L2608:    getstatic Field jf C Lic;
L2611:    getfield Field ic ic_vb Lnn;
L2614:    getfield Field nn nn_e [I
L2617:    iload_0
L2618:    iaload
L2619:    iload 7
L2621:    iand
L2622:    iconst_m1
L2623:    ixor
L2624:    iconst_m1
L2625:    if_icmpeq L3017
L2628:    getstatic Field jf C Lic;
L2631:    getfield Field ic T Ljd;
L2634:    getfield Field jd jd_s Z
L2637:    ifne L2660
L2640:    getstatic Field jf C Lic;
L2643:    getfield Field ic ic_vb Lnn;
L2646:    getfield Field nn nn_q [I
L2649:    iload_0
L2650:    iaload
L2651:    iload 8
L2653:    if_icmple L2659
L2656:    goto L2660
L2659:    return
L2660:    iload 5
L2662:    ifeq L2732
L2665:    iload 8
L2667:    getstatic Field jf C Lic;
L2670:    getfield Field ic ic_vb Lnn;
L2673:    getfield Field nn nn_q [I
L2676:    getstatic Field bv bv_w Lha;
L2679:    getfield Field ha ha_v I
L2682:    ineg
L2683:    iload_0
L2684:    iadd
L2685:    iaload
L2686:    if_icmplt L2704
L2689:    getstatic Field jf C Lic;
L2692:    getfield Field ic T Ljd;
L2695:    getfield Field jd jd_s Z
L2698:    ifeq L2752
L2701:    goto L2704
L2704:    iconst_m1
L2705:    iload 7
L2707:    getstatic Field jf C Lic;
L2710:    getfield Field ic ic_vb Lnn;
L2713:    getfield Field nn nn_e [I
L2716:    iload_0
L2717:    getstatic Field ks y I
L2720:    ineg
L2721:    iadd
L2722:    iaload
L2723:    iand
L2724:    iconst_m1
L2725:    ixor
L2726:    if_icmpne L2752
L2729:    goto L2732
L2732:    bipush -40
L2734:    iload_2
L2735:    iadd
L2736:    iload_1
L2737:    iload_2
L2738:    bipush -20
L2740:    iload_1
L2741:    iadd
L2742:    ldc 16711680
L2744:    iload 6
L2746:    invokestatic Method qn d (IIIIII)V
L2749:    goto L2752
L2752:    iload 5
L2754:    iconst_m1
L2755:    getstatic Field ef ef_c I
L2758:    iadd
L2759:    if_icmpeq L2824
L2762:    iload 8
L2764:    getstatic Field jf C Lic;
L2767:    getfield Field ic ic_vb Lnn;
L2770:    getfield Field nn nn_q [I
L2773:    getstatic Field ks y I
L2776:    iload_0
L2777:    iadd
L2778:    iaload
L2779:    if_icmplt L2797
L2782:    getstatic Field jf C Lic;
L2785:    getfield Field ic T Ljd;
L2788:    getfield Field jd jd_s Z
L2791:    ifeq L2841
L2794:    goto L2797
L2797:    getstatic Field jf C Lic;
L2800:    getfield Field ic ic_vb Lnn;
L2803:    getfield Field nn nn_e [I
L2806:    getstatic Field ks y I
L2809:    iload_0
L2810:    iadd
L2811:    iaload
L2812:    iload 7
L2814:    iand
L2815:    iconst_m1
L2816:    ixor
L2817:    iconst_m1
L2818:    if_icmpeq L2824
L2821:    goto L2841
L2824:    bipush 40
L2826:    iload_2
L2827:    iadd
L2828:    iload_1
L2829:    iload_2
L2830:    iload_1
L2831:    bipush -20
L2833:    isub
L2834:    ldc 16711680
L2836:    iload 6
L2838:    invokestatic Method qn d (IIIIII)V
L2841:    iconst_0
L2842:    iload 4
L2844:    if_icmpeq L2909
L2847:    getstatic Field jf C Lic;
L2850:    getfield Field ic ic_vb Lnn;
L2853:    getfield Field nn nn_q [I
L2856:    iconst_m1
L2857:    iload_0
L2858:    iadd
L2859:    iaload
L2860:    iconst_m1
L2861:    ixor
L2862:    iload 8
L2864:    iconst_m1
L2865:    ixor
L2866:    if_icmplt L2884
L2869:    getstatic Field jf C Lic;
L2872:    getfield Field ic T Ljd;
L2875:    getfield Field jd jd_s Z
L2878:    ifeq L2929
L2881:    goto L2884
L2884:    iload 7
L2886:    getstatic Field jf C Lic;
L2889:    getfield Field ic ic_vb Lnn;
L2892:    getfield Field nn nn_e [I
L2895:    iload_0
L2896:    iconst_1
L2897:    isub
L2898:    iaload
L2899:    iand
L2900:    iconst_m1
L2901:    ixor
L2902:    iconst_m1
L2903:    if_icmpne L2929
L2906:    goto L2909
L2909:    iload_2
L2910:    bipush -40
L2912:    iadd
L2913:    iload_1
L2914:    iload_2
L2915:    bipush 20
L2917:    iload_1
L2918:    iadd
L2919:    ldc 16711680
L2921:    iload 6
L2923:    invokestatic Method qn d (IIIIII)V
L2926:    goto L2929
L2929:    iload 4
L2931:    iconst_m1
L2932:    ixor
L2933:    iconst_m1
L2934:    getstatic Field ks y I
L2937:    iadd
L2938:    iconst_m1
L2939:    ixor
L2940:    if_icmpeq L2999
L2943:    iload 8
L2945:    getstatic Field jf C Lic;
L2948:    getfield Field ic ic_vb Lnn;
L2951:    getfield Field nn nn_q [I
L2954:    iconst_1
L2955:    iload_0
L2956:    iadd
L2957:    iaload
L2958:    if_icmplt L2974
L2961:    getstatic Field jf C Lic;
L2964:    getfield Field ic T Ljd;
L2967:    getfield Field jd jd_s Z
L2970:    ifne L2974
L2973:    return
L2974:    iload 7
L2976:    getstatic Field jf C Lic;
L2979:    getfield Field ic ic_vb Lnn;
L2982:    getfield Field nn nn_e [I
L2985:    iload_0
L2986:    iconst_m1
L2987:    isub
L2988:    iaload
L2989:    iand
L2990:    iconst_m1
L2991:    ixor
L2992:    iconst_m1
L2993:    if_icmpeq L2999
L2996:    goto L3016
L2999:    bipush 40
L3001:    iload_2
L3002:    iadd
L3003:    iload_1
L3004:    iload_2
L3005:    bipush -20
L3007:    iload_1
L3008:    iadd
L3009:    ldc 16711680
L3011:    iload 6
L3013:    invokestatic Method qn d (IIIIII)V
L3016:    return
L3017:    return
L3018:    iconst_1
L3019:    istore 15
L3021:    iload 15
L3023:    iconst_m1
L3024:    ixor
L3025:    bipush -41
L3027:    if_icmple L3086
L3030:    iload 15
L3032:    iconst_2
L3033:    imul
L3034:    ineg
L3035:    bipush 40
L3037:    iadd
L3038:    invokestatic Method java/lang/Math abs (I)I
L3041:    istore 16
L3043:    bipush -20
L3045:    iload_1
L3046:    iload 15
L3048:    iadd
L3049:    iadd
L3050:    istore 17
L3052:    bipush -40
L3054:    iload_2
L3055:    iadd
L3056:    iload 16
L3058:    iadd
L3059:    iload 17
L3061:    iconst_m1
L3062:    iload 16
L3064:    ineg
L3065:    iadd
L3066:    iload_2
L3067:    iadd
L3068:    bipush -40
L3070:    isub
L3071:    iload 17
L3073:    ldc 16711680
L3075:    iload 6
L3077:    invokestatic Method qn d (IIIIII)V
L3080:    iinc 15 2
L3083:    goto L3021
L3086:    getstatic Field jf C Lic;
L3089:    getfield Field ic T Ljd;
L3092:    getfield Field jd jd_s Z
L3095:    ifne L3102
L3098:    iconst_3
L3099:    goto L3103
L3102:    iconst_1
L3103:    istore 7
L3105:    getstatic Field jf C Lic;
L3108:    getfield Field ic ic_vb Lnn;
L3111:    sipush 27732
L3114:    invokevirtual Method nn c (I)I
L3117:    istore 8
L3119:    getstatic Field jf C Lic;
L3122:    getfield Field ic ic_vb Lnn;
L3125:    getfield Field nn nn_e [I
L3128:    iload_0
L3129:    iaload
L3130:    iload 7
L3132:    iand
L3133:    iconst_m1
L3134:    ixor
L3135:    iconst_m1
L3136:    if_icmpeq L4539
L3139:    getstatic Field jf C Lic;
L3142:    getfield Field ic T Ljd;
L3145:    getfield Field jd jd_s Z
L3148:    ifne L3171
L3151:    getstatic Field jf C Lic;
L3154:    getfield Field ic ic_vb Lnn;
L3157:    getfield Field nn nn_q [I
L3160:    iload_0
L3161:    iaload
L3162:    iload 8
L3164:    if_icmple L3170
L3167:    goto L3171
L3170:    return
L3171:    iload 5
L3173:    ifeq L3243
L3176:    iload 8
L3178:    getstatic Field jf C Lic;
L3181:    getfield Field ic ic_vb Lnn;
L3184:    getfield Field nn nn_q [I
L3187:    getstatic Field bv bv_w Lha;
L3190:    getfield Field ha ha_v I
L3193:    ineg
L3194:    iload_0
L3195:    iadd
L3196:    iaload
L3197:    if_icmplt L3215
L3200:    getstatic Field jf C Lic;
L3203:    getfield Field ic T Ljd;
L3206:    getfield Field jd jd_s Z
L3209:    ifeq L3263
L3212:    goto L3215
L3215:    iconst_m1
L3216:    iload 7
L3218:    getstatic Field jf C Lic;
L3221:    getfield Field ic ic_vb Lnn;
L3224:    getfield Field nn nn_e [I
L3227:    iload_0
L3228:    getstatic Field ks y I
L3231:    ineg
L3232:    iadd
L3233:    iaload
L3234:    iand
L3235:    iconst_m1
L3236:    ixor
L3237:    if_icmpne L3263
L3240:    goto L3243
L3243:    bipush -40
L3245:    iload_2
L3246:    iadd
L3247:    iload_1
L3248:    iload_2
L3249:    bipush -20
L3251:    iload_1
L3252:    iadd
L3253:    ldc 16711680
L3255:    iload 6
L3257:    invokestatic Method qn d (IIIIII)V
L3260:    goto L3263
L3263:    iload 5
L3265:    iconst_m1
L3266:    getstatic Field ef ef_c I
L3269:    iadd
L3270:    if_icmpeq L3508
L3273:    iload 8
L3275:    getstatic Field jf C Lic;
L3278:    getfield Field ic ic_vb Lnn;
L3281:    getfield Field nn nn_q [I
L3284:    getstatic Field ks y I
L3287:    iload_0
L3288:    iadd
L3289:    iaload
L3290:    if_icmplt L3308
L3293:    getstatic Field jf C Lic;
L3296:    getfield Field ic T Ljd;
L3299:    getfield Field jd jd_s Z
L3302:    ifeq L3525
L3305:    goto L3308
L3308:    getstatic Field jf C Lic;
L3311:    getfield Field ic ic_vb Lnn;
L3314:    getfield Field nn nn_e [I
L3317:    getstatic Field ks y I
L3320:    iload_0
L3321:    iadd
L3322:    iaload
L3323:    iload 7
L3325:    iand
L3326:    iconst_m1
L3327:    ixor
L3328:    iconst_m1
L3329:    if_icmpeq L3508
L3332:    iconst_0
L3333:    iload 4
L3335:    if_icmpeq L3400
L3338:    getstatic Field jf C Lic;
L3341:    getfield Field ic ic_vb Lnn;
L3344:    getfield Field nn nn_q [I
L3347:    iconst_m1
L3348:    iload_0
L3349:    iadd
L3350:    iaload
L3351:    iconst_m1
L3352:    ixor
L3353:    iload 8
L3355:    iconst_m1
L3356:    ixor
L3357:    if_icmplt L3375
L3360:    getstatic Field jf C Lic;
L3363:    getfield Field ic T Ljd;
L3366:    getfield Field jd jd_s Z
L3369:    ifeq L3420
L3372:    goto L3375
L3375:    iload 7
L3377:    getstatic Field jf C Lic;
L3380:    getfield Field ic ic_vb Lnn;
L3383:    getfield Field nn nn_e [I
L3386:    iload_0
L3387:    iconst_1
L3388:    isub
L3389:    iaload
L3390:    iand
L3391:    iconst_m1
L3392:    ixor
L3393:    iconst_m1
L3394:    if_icmpne L3420
L3397:    goto L3400
L3400:    iload_2
L3401:    bipush -40
L3403:    iadd
L3404:    iload_1
L3405:    iload_2
L3406:    bipush 20
L3408:    iload_1
L3409:    iadd
L3410:    ldc 16711680
L3412:    iload 6
L3414:    invokestatic Method qn d (IIIIII)V
L3417:    goto L3420
L3420:    iload 4
L3422:    iconst_m1
L3423:    ixor
L3424:    iconst_m1
L3425:    getstatic Field ks y I
L3428:    iadd
L3429:    iconst_m1
L3430:    ixor
L3431:    if_icmpeq L3490
L3434:    iload 8
L3436:    getstatic Field jf C Lic;
L3439:    getfield Field ic ic_vb Lnn;
L3442:    getfield Field nn nn_q [I
L3445:    iconst_1
L3446:    iload_0
L3447:    iadd
L3448:    iaload
L3449:    if_icmplt L3465
L3452:    getstatic Field jf C Lic;
L3455:    getfield Field ic T Ljd;
L3458:    getfield Field jd jd_s Z
L3461:    ifne L3465
L3464:    return
L3465:    iload 7
L3467:    getstatic Field jf C Lic;
L3470:    getfield Field ic ic_vb Lnn;
L3473:    getfield Field nn nn_e [I
L3476:    iload_0
L3477:    iconst_m1
L3478:    isub
L3479:    iaload
L3480:    iand
L3481:    iconst_m1
L3482:    ixor
L3483:    iconst_m1
L3484:    if_icmpeq L3490
L3487:    goto L3507
L3490:    bipush 40
L3492:    iload_2
L3493:    iadd
L3494:    iload_1
L3495:    iload_2
L3496:    bipush -20
L3498:    iload_1
L3499:    iadd
L3500:    ldc 16711680
L3502:    iload 6
L3504:    invokestatic Method qn d (IIIIII)V
L3507:    return
L3508:    bipush 40
L3510:    iload_2
L3511:    iadd
L3512:    iload_1
L3513:    iload_2
L3514:    iload_1
L3515:    bipush -20
L3517:    isub
L3518:    ldc 16711680
L3520:    iload 6
L3522:    invokestatic Method qn d (IIIIII)V
L3525:    iconst_0
L3526:    iload 4
L3528:    if_icmpeq L4376
L3531:    getstatic Field jf C Lic;
L3534:    getfield Field ic ic_vb Lnn;
L3537:    getfield Field nn nn_q [I
L3540:    iconst_m1
L3541:    iload_0
L3542:    iadd
L3543:    iaload
L3544:    iconst_m1
L3545:    ixor
L3546:    iload 8
L3548:    iconst_m1
L3549:    ixor
L3550:    if_icmplt L4044
L3553:    getstatic Field jf C Lic;
L3556:    getfield Field ic T Ljd;
L3559:    getfield Field jd jd_s Z
L3562:    ifne L3711
L3565:    iload 4
L3567:    iconst_m1
L3568:    ixor
L3569:    iconst_m1
L3570:    getstatic Field ks y I
L3573:    iadd
L3574:    iconst_m1
L3575:    ixor
L3576:    if_icmpne L3597
L3579:    bipush 40
L3581:    iload_2
L3582:    iadd
L3583:    iload_1
L3584:    iload_2
L3585:    bipush -20
L3587:    iload_1
L3588:    iadd
L3589:    ldc 16711680
L3591:    iload 6
L3593:    invokestatic Method qn d (IIIIII)V
L3596:    return
L3597:    iload 8
L3599:    getstatic Field jf C Lic;
L3602:    getfield Field ic ic_vb Lnn;
L3605:    getfield Field nn nn_q [I
L3608:    iconst_1
L3609:    iload_0
L3610:    iadd
L3611:    iaload
L3612:    if_icmplt L3670
L3615:    getstatic Field jf C Lic;
L3618:    getfield Field ic T Ljd;
L3621:    getfield Field jd jd_s Z
L3624:    ifeq L4541
L3627:    iload 7
L3629:    getstatic Field jf C Lic;
L3632:    getfield Field ic ic_vb Lnn;
L3635:    getfield Field nn nn_e [I
L3638:    iload_0
L3639:    iconst_m1
L3640:    isub
L3641:    iaload
L3642:    iand
L3643:    iconst_m1
L3644:    ixor
L3645:    iconst_m1
L3646:    if_icmpeq L3652
L3649:    goto L3669
L3652:    bipush 40
L3654:    iload_2
L3655:    iadd
L3656:    iload_1
L3657:    iload_2
L3658:    bipush -20
L3660:    iload_1
L3661:    iadd
L3662:    ldc 16711680
L3664:    iload 6
L3666:    invokestatic Method qn d (IIIIII)V
L3669:    return
L3670:    iload 7
L3672:    getstatic Field jf C Lic;
L3675:    getfield Field ic ic_vb Lnn;
L3678:    getfield Field nn nn_e [I
L3681:    iload_0
L3682:    iconst_m1
L3683:    isub
L3684:    iaload
L3685:    iand
L3686:    iconst_m1
L3687:    ixor
L3688:    iconst_m1
L3689:    if_icmpne L3710
L3692:    bipush 40
L3694:    iload_2
L3695:    iadd
L3696:    iload_1
L3697:    iload_2
L3698:    bipush -20
L3700:    iload_1
L3701:    iadd
L3702:    ldc 16711680
L3704:    iload 6
L3706:    invokestatic Method qn d (IIIIII)V
L3709:    return
L3710:    return
L3711:    iload 7
L3713:    getstatic Field jf C Lic;
L3716:    getfield Field ic ic_vb Lnn;
L3719:    getfield Field nn nn_e [I
L3722:    iload_0
L3723:    iconst_1
L3724:    isub
L3725:    iaload
L3726:    iand
L3727:    iconst_m1
L3728:    ixor
L3729:    iconst_m1
L3730:    if_icmpne L3897
L3733:    iload_2
L3734:    bipush -40
L3736:    iadd
L3737:    iload_1
L3738:    iload_2
L3739:    bipush 20
L3741:    iload_1
L3742:    iadd
L3743:    ldc 16711680
L3745:    iload 6
L3747:    invokestatic Method qn d (IIIIII)V
L3750:    iload 4
L3752:    iconst_m1
L3753:    ixor
L3754:    iconst_m1
L3755:    getstatic Field ks y I
L3758:    iadd
L3759:    iconst_m1
L3760:    ixor
L3761:    if_icmpne L3782
L3764:    bipush 40
L3766:    iload_2
L3767:    iadd
L3768:    iload_1
L3769:    iload_2
L3770:    bipush -20
L3772:    iload_1
L3773:    iadd
L3774:    ldc 16711680
L3776:    iload 6
L3778:    invokestatic Method qn d (IIIIII)V
L3781:    return
L3782:    iload 8
L3784:    getstatic Field jf C Lic;
L3787:    getfield Field ic ic_vb Lnn;
L3790:    getfield Field nn nn_q [I
L3793:    iconst_1
L3794:    iload_0
L3795:    iadd
L3796:    iaload
L3797:    if_icmplt L3855
L3800:    getstatic Field jf C Lic;
L3803:    getfield Field ic T Ljd;
L3806:    getfield Field jd jd_s Z
L3809:    ifeq L3896
L3812:    iload 7
L3814:    getstatic Field jf C Lic;
L3817:    getfield Field ic ic_vb Lnn;
L3820:    getfield Field nn nn_e [I
L3823:    iload_0
L3824:    iconst_m1
L3825:    isub
L3826:    iaload
L3827:    iand
L3828:    iconst_m1
L3829:    ixor
L3830:    iconst_m1
L3831:    if_icmpeq L3837
L3834:    goto L3854
L3837:    bipush 40
L3839:    iload_2
L3840:    iadd
L3841:    iload_1
L3842:    iload_2
L3843:    bipush -20
L3845:    iload_1
L3846:    iadd
L3847:    ldc 16711680
L3849:    iload 6
L3851:    invokestatic Method qn d (IIIIII)V
L3854:    return
L3855:    iload 7
L3857:    getstatic Field jf C Lic;
L3860:    getfield Field ic ic_vb Lnn;
L3863:    getfield Field nn nn_e [I
L3866:    iload_0
L3867:    iconst_m1
L3868:    isub
L3869:    iaload
L3870:    iand
L3871:    iconst_m1
L3872:    ixor
L3873:    iconst_m1
L3874:    if_icmpne L3895
L3877:    bipush 40
L3879:    iload_2
L3880:    iadd
L3881:    iload_1
L3882:    iload_2
L3883:    bipush -20
L3885:    iload_1
L3886:    iadd
L3887:    ldc 16711680
L3889:    iload 6
L3891:    invokestatic Method qn d (IIIIII)V
L3894:    return
L3895:    return
L3896:    return
L3897:    iload 4
L3899:    iconst_m1
L3900:    ixor
L3901:    iconst_m1
L3902:    getstatic Field ks y I
L3905:    iadd
L3906:    iconst_m1
L3907:    ixor
L3908:    if_icmpne L3929
L3911:    bipush 40
L3913:    iload_2
L3914:    iadd
L3915:    iload_1
L3916:    iload_2
L3917:    bipush -20
L3919:    iload_1
L3920:    iadd
L3921:    ldc 16711680
L3923:    iload 6
L3925:    invokestatic Method qn d (IIIIII)V
L3928:    return
L3929:    iload 8
L3931:    getstatic Field jf C Lic;
L3934:    getfield Field ic ic_vb Lnn;
L3937:    getfield Field nn nn_q [I
L3940:    iconst_1
L3941:    iload_0
L3942:    iadd
L3943:    iaload
L3944:    if_icmplt L4002
L3947:    getstatic Field jf C Lic;
L3950:    getfield Field ic T Ljd;
L3953:    getfield Field jd jd_s Z
L3956:    ifeq L4043
L3959:    iload 7
L3961:    getstatic Field jf C Lic;
L3964:    getfield Field ic ic_vb Lnn;
L3967:    getfield Field nn nn_e [I
L3970:    iload_0
L3971:    iconst_m1
L3972:    isub
L3973:    iaload
L3974:    iand
L3975:    iconst_m1
L3976:    ixor
L3977:    iconst_m1
L3978:    if_icmpeq L3984
L3981:    goto L4001
L3984:    bipush 40
L3986:    iload_2
L3987:    iadd
L3988:    iload_1
L3989:    iload_2
L3990:    bipush -20
L3992:    iload_1
L3993:    iadd
L3994:    ldc 16711680
L3996:    iload 6
L3998:    invokestatic Method qn d (IIIIII)V
L4001:    return
L4002:    iload 7
L4004:    getstatic Field jf C Lic;
L4007:    getfield Field ic ic_vb Lnn;
L4010:    getfield Field nn nn_e [I
L4013:    iload_0
L4014:    iconst_m1
L4015:    isub
L4016:    iaload
L4017:    iand
L4018:    iconst_m1
L4019:    ixor
L4020:    iconst_m1
L4021:    if_icmpne L4042
L4024:    bipush 40
L4026:    iload_2
L4027:    iadd
L4028:    iload_1
L4029:    iload_2
L4030:    bipush -20
L4032:    iload_1
L4033:    iadd
L4034:    ldc 16711680
L4036:    iload 6
L4038:    invokestatic Method qn d (IIIIII)V
L4041:    return
L4042:    return
L4043:    return
L4044:    iload 7
L4046:    getstatic Field jf C Lic;
L4049:    getfield Field ic ic_vb Lnn;
L4052:    getfield Field nn nn_e [I
L4055:    iload_0
L4056:    iconst_1
L4057:    isub
L4058:    iaload
L4059:    iand
L4060:    iconst_m1
L4061:    ixor
L4062:    iconst_m1
L4063:    if_icmpeq L4212
L4066:    iload 4
L4068:    iconst_m1
L4069:    ixor
L4070:    iconst_m1
L4071:    getstatic Field ks y I
L4074:    iadd
L4075:    iconst_m1
L4076:    ixor
L4077:    if_icmpne L4098
L4080:    bipush 40
L4082:    iload_2
L4083:    iadd
L4084:    iload_1
L4085:    iload_2
L4086:    bipush -20
L4088:    iload_1
L4089:    iadd
L4090:    ldc 16711680
L4092:    iload 6
L4094:    invokestatic Method qn d (IIIIII)V
L4097:    return
L4098:    iload 8
L4100:    getstatic Field jf C Lic;
L4103:    getfield Field ic ic_vb Lnn;
L4106:    getfield Field nn nn_q [I
L4109:    iconst_1
L4110:    iload_0
L4111:    iadd
L4112:    iaload
L4113:    if_icmplt L4171
L4116:    getstatic Field jf C Lic;
L4119:    getfield Field ic T Ljd;
L4122:    getfield Field jd jd_s Z
L4125:    ifeq L4542
L4128:    iload 7
L4130:    getstatic Field jf C Lic;
L4133:    getfield Field ic ic_vb Lnn;
L4136:    getfield Field nn nn_e [I
L4139:    iload_0
L4140:    iconst_m1
L4141:    isub
L4142:    iaload
L4143:    iand
L4144:    iconst_m1
L4145:    ixor
L4146:    iconst_m1
L4147:    if_icmpeq L4153
L4150:    goto L4170
L4153:    bipush 40
L4155:    iload_2
L4156:    iadd
L4157:    iload_1
L4158:    iload_2
L4159:    bipush -20
L4161:    iload_1
L4162:    iadd
L4163:    ldc 16711680
L4165:    iload 6
L4167:    invokestatic Method qn d (IIIIII)V
L4170:    return
L4171:    iload 7
L4173:    getstatic Field jf C Lic;
L4176:    getfield Field ic ic_vb Lnn;
L4179:    getfield Field nn nn_e [I
L4182:    iload_0
L4183:    iconst_m1
L4184:    isub
L4185:    iaload
L4186:    iand
L4187:    iconst_m1
L4188:    ixor
L4189:    iconst_m1
L4190:    if_icmpne L4211
L4193:    bipush 40
L4195:    iload_2
L4196:    iadd
L4197:    iload_1
L4198:    iload_2
L4199:    bipush -20
L4201:    iload_1
L4202:    iadd
L4203:    ldc 16711680
L4205:    iload 6
L4207:    invokestatic Method qn d (IIIIII)V
L4210:    return
L4211:    return
L4212:    iload_2
L4213:    bipush -40
L4215:    iadd
L4216:    iload_1
L4217:    iload_2
L4218:    bipush 20
L4220:    iload_1
L4221:    iadd
L4222:    ldc 16711680
L4224:    iload 6
L4226:    invokestatic Method qn d (IIIIII)V
L4229:    iload 4
L4231:    iconst_m1
L4232:    ixor
L4233:    iconst_m1
L4234:    getstatic Field ks y I
L4237:    iadd
L4238:    iconst_m1
L4239:    ixor
L4240:    if_icmpne L4261
L4243:    bipush 40
L4245:    iload_2
L4246:    iadd
L4247:    iload_1
L4248:    iload_2
L4249:    bipush -20
L4251:    iload_1
L4252:    iadd
L4253:    ldc 16711680
L4255:    iload 6
L4257:    invokestatic Method qn d (IIIIII)V
L4260:    return
L4261:    iload 8
L4263:    getstatic Field jf C Lic;
L4266:    getfield Field ic ic_vb Lnn;
L4269:    getfield Field nn nn_q [I
L4272:    iconst_1
L4273:    iload_0
L4274:    iadd
L4275:    iaload
L4276:    if_icmplt L4335
L4279:    getstatic Field jf C Lic;
L4282:    getfield Field ic T Ljd;
L4285:    getfield Field jd jd_s Z
L4288:    ifne L4292
L4291:    return
L4292:    iload 7
L4294:    getstatic Field jf C Lic;
L4297:    getfield Field ic ic_vb Lnn;
L4300:    getfield Field nn nn_e [I
L4303:    iload_0
L4304:    iconst_m1
L4305:    isub
L4306:    iaload
L4307:    iand
L4308:    iconst_m1
L4309:    ixor
L4310:    iconst_m1
L4311:    if_icmpeq L4317
L4314:    goto L4334
L4317:    bipush 40
L4319:    iload_2
L4320:    iadd
L4321:    iload_1
L4322:    iload_2
L4323:    bipush -20
L4325:    iload_1
L4326:    iadd
L4327:    ldc 16711680
L4329:    iload 6
L4331:    invokestatic Method qn d (IIIIII)V
L4334:    return
L4335:    iload 7
L4337:    getstatic Field jf C Lic;
L4340:    getfield Field ic ic_vb Lnn;
L4343:    getfield Field nn nn_e [I
L4346:    iload_0
L4347:    iconst_m1
L4348:    isub
L4349:    iaload
L4350:    iand
L4351:    iconst_m1
L4352:    ixor
L4353:    iconst_m1
L4354:    if_icmpeq L4358
L4357:    return
L4358:    bipush 40
L4360:    iload_2
L4361:    iadd
L4362:    iload_1
L4363:    iload_2
L4364:    bipush -20
L4366:    iload_1
L4367:    iadd
L4368:    ldc 16711680
L4370:    iload 6
L4372:    invokestatic Method qn d (IIIIII)V
L4375:    return
L4376:    iload_2
L4377:    bipush -40
L4379:    iadd
L4380:    iload_1
L4381:    iload_2
L4382:    bipush 20
L4384:    iload_1
L4385:    iadd
L4386:    ldc 16711680
L4388:    iload 6
L4390:    invokestatic Method qn d (IIIIII)V
L4393:    iload 4
L4395:    iconst_m1
L4396:    ixor
L4397:    iconst_m1
L4398:    getstatic Field ks y I
L4401:    iadd
L4402:    iconst_m1
L4403:    ixor
L4404:    if_icmpne L4425
L4407:    bipush 40
L4409:    iload_2
L4410:    iadd
L4411:    iload_1
L4412:    iload_2
L4413:    bipush -20
L4415:    iload_1
L4416:    iadd
L4417:    ldc 16711680
L4419:    iload 6
L4421:    invokestatic Method qn d (IIIIII)V
L4424:    return
L4425:    iload 8
L4427:    getstatic Field jf C Lic;
L4430:    getfield Field ic ic_vb Lnn;
L4433:    getfield Field nn nn_q [I
L4436:    iconst_1
L4437:    iload_0
L4438:    iadd
L4439:    iaload
L4440:    if_icmplt L4498
L4443:    getstatic Field jf C Lic;
L4446:    getfield Field ic T Ljd;
L4449:    getfield Field jd jd_s Z
L4452:    ifeq L4543
L4455:    iload 7
L4457:    getstatic Field jf C Lic;
L4460:    getfield Field ic ic_vb Lnn;
L4463:    getfield Field nn nn_e [I
L4466:    iload_0
L4467:    iconst_m1
L4468:    isub
L4469:    iaload
L4470:    iand
L4471:    iconst_m1
L4472:    ixor
L4473:    iconst_m1
L4474:    if_icmpeq L4480
L4477:    goto L4497
L4480:    bipush 40
L4482:    iload_2
L4483:    iadd
L4484:    iload_1
L4485:    iload_2
L4486:    bipush -20
L4488:    iload_1
L4489:    iadd
L4490:    ldc 16711680
L4492:    iload 6
L4494:    invokestatic Method qn d (IIIIII)V
L4497:    return
L4498:    iload 7
L4500:    getstatic Field jf C Lic;
L4503:    getfield Field ic ic_vb Lnn;
L4506:    getfield Field nn nn_e [I
L4509:    iload_0
L4510:    iconst_m1
L4511:    isub
L4512:    iaload
L4513:    iand
L4514:    iconst_m1
L4515:    ixor
L4516:    iconst_m1
L4517:    if_icmpne L4538
L4520:    bipush 40
L4522:    iload_2
L4523:    iadd
L4524:    iload_1
L4525:    iload_2
L4526:    bipush -20
L4528:    iload_1
L4529:    iadd
L4530:    ldc 16711680
L4532:    iload 6
L4534:    invokestatic Method qn d (IIIIII)V
L4537:    return
L4538:    return
L4539:    return
L4540:    return
L4541:    return
L4542:    return
L4543:    return
L4544:
    .end code
.end method

.method public static a : (B)V
    .code stack 64 locals 2
L0:    iload_0
L1:    bipush -91
L3:    if_icmple L30
L6:    bipush -12
L8:    bipush 36
L10:    bipush -105
L12:    bipush 64
L14:    bipush -39
L16:    bipush -61
L18:    invokestatic Method cw a (IIIIII)V
L21:    aconst_null
L22:    putstatic Field cw cw_b Ljava/lang/String;
L25:    aconst_null
L26:    putstatic Field cw cw_a Ljava/lang/String;
L29:    return
L30:    aconst_null
L31:    putstatic Field cw cw_b Ljava/lang/String;
L34:    aconst_null
L35:    putstatic Field cw cw_a Ljava/lang/String;
L38:    return
L39:
    .end code
.end method

.method static <clinit> : ()V
    .code stack 64 locals 0
L0:    ldc "Options"
L2:    putstatic Field cw cw_b Ljava/lang/String;
L5:    ldc "This unit has an attack range of <%0> to <%1>"
L7:    putstatic Field cw cw_a Ljava/lang/String;
L10:    return
L11:
    .end code
.end method
.sourcefile "null"
.end class