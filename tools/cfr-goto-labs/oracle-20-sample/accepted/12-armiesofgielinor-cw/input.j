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
L33:    if_acmpeq L915
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
L66:    if_icmpeq L912
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
L940:    if_icmpeq L1804
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
L974:    if_icmpge L1802
L977:    getstatic Field jf C Lic;
L980:    getfield Field ic T Ljd;
L983:    getfield Field jd jd_s Z
L986:    ifne L1359
L989:    getstatic Field jf C Lic;
L992:    getfield Field ic T Ljd;
L995:    getfield Field jd O I
L998:    iconst_m1
L999:    ixor
L1000:    getstatic Field jf C Lic;
L1003:    getfield Field ic ic_q I
L1006:    iconst_m1
L1007:    ixor
L1008:    if_icmpne L1359
L1011:    getstatic Field jf C Lic;
L1014:    getfield Field ic T Ljd;
L1017:    sipush -13494
L1020:    invokevirtual Method jd h (I)Z
L1023:    ifne L1359
L1026:    getstatic Field jf C Lic;
L1029:    getfield Field ic T Ljd;
L1032:    sipush 3257
L1035:    invokevirtual Method jd B (I)I
L1038:    istore 7
L1040:    getstatic Field jf C Lic;
L1043:    getfield Field ic T Ljd;
L1046:    bipush -79
L1048:    invokevirtual Method jd l (B)I
L1051:    istore 8
L1053:    getstatic Field jf C Lic;
L1056:    getfield Field ic ic_vb Lnn;
L1059:    getfield Field nn nn_n I
L1062:    istore 9
L1064:    getstatic Field jf C Lic;
L1067:    getfield Field ic ic_vb Lnn;
L1070:    getfield Field nn nn_b I
L1073:    istore 10
L1075:    getstatic Field jf C Lic;
L1078:    getfield Field ic T Ljd;
L1081:    sipush -28467
L1084:    invokevirtual Method jd o (I)Z
L1087:    ifne L1093
L1090:    goto L1118
L1093:    getstatic Field jf C Lic;
L1096:    getfield Field ic T Ljd;
L1099:    iconst_0
L1100:    invokevirtual Method jd a (Z)I
L1103:    istore 9
L1105:    getstatic Field jf C Lic;
L1108:    getfield Field ic T Ljd;
L1111:    bipush -65
L1113:    invokevirtual Method jd D (I)I
L1116:    istore 10
L1118:    iload 9
L1120:    iload 4
L1122:    isub
L1123:    invokestatic Method java/lang/Math abs (I)I
L1126:    istore 11
L1128:    iload 10
L1130:    iload 5
L1132:    ineg
L1133:    iadd
L1134:    invokestatic Method java/lang/Math abs (I)I
L1137:    istore 12
L1139:    iload 11
L1141:    iload 12
L1143:    iadd
L1144:    iload 7
L1146:    if_icmpgt L1359
L1149:    iload 8
L1151:    iload 11
L1153:    iload 12
L1155:    ineg
L1156:    isub
L1157:    if_icmpgt L1359
L1160:    iload 12
L1162:    iload 11
L1164:    iadd
L1165:    iconst_1
L1166:    if_icmpne L1173
L1169:    iconst_1
L1170:    goto L1174
L1173:    iconst_0
L1174:    istore 13
L1176:    iload 13
L1178:    ifne L1275
L1181:    getstatic Field bv bv_w Lha;
L1184:    bipush 31
L1186:    iload 10
L1188:    iload 9
L1190:    getstatic Field jf C Lic;
L1193:    getfield Field ic T Ljd;
L1196:    getfield Field jd O I
L1199:    invokevirtual Method ha b (IIII)I
L1202:    iconst_2
L1203:    iand
L1204:    iconst_m1
L1205:    ixor
L1206:    iconst_m1
L1207:    if_icmpne L1275
L1210:    iconst_2
L1211:    getstatic Field bv bv_w Lha;
L1214:    bipush 31
L1216:    iload 5
L1218:    iload 4
L1220:    getstatic Field jf C Lic;
L1223:    getfield Field ic T Ljd;
L1226:    getfield Field jd O I
L1229:    invokevirtual Method ha b (IIII)I
L1232:    iand
L1233:    ifne L1275
L1236:    getstatic Field bv bv_w Lha;
L1239:    getfield Field ha ha_j Lul;
L1242:    iload 10
L1244:    iload 4
L1246:    iload 9
L1248:    getstatic Field jf C Lic;
L1251:    getfield Field ic T Ljd;
L1254:    bipush -111
L1256:    invokevirtual Method jd x (I)Z
L1259:    iload 7
L1261:    iload 5
L1263:    bipush 62
L1265:    invokevirtual Method ul a (IIIZIIB)Z
L1268:    ifeq L1275
L1271:    iconst_1
L1272:    goto L1276
L1275:    iconst_0
L1276:    istore 14
L1278:    iload 13
L1280:    ifne L1291
L1283:    iload 14
L1285:    ifne L1291
L1288:    goto L1359
L1291:    iconst_1
L1292:    istore 15
L1294:    iload 15
L1296:    iconst_m1
L1297:    ixor
L1298:    bipush -41
L1300:    if_icmple L1359
L1303:    iload 15
L1305:    iconst_2
L1306:    imul
L1307:    ineg
L1308:    bipush 40
L1310:    iadd
L1311:    invokestatic Method java/lang/Math abs (I)I
L1314:    istore 16
L1316:    bipush -20
L1318:    iload_1
L1319:    iload 15
L1321:    iadd
L1322:    iadd
L1323:    istore 17
L1325:    bipush -40
L1327:    iload_2
L1328:    iadd
L1329:    iload 16
L1331:    iadd
L1332:    iload 17
L1334:    iconst_m1
L1335:    iload 16
L1337:    ineg
L1338:    iadd
L1339:    iload_2
L1340:    iadd
L1341:    bipush -40
L1343:    isub
L1344:    iload 17
L1346:    ldc 16711680
L1348:    iload 6
L1350:    invokestatic Method qn d (IIIIII)V
L1353:    iinc 15 2
L1356:    goto L1294
L1359:    getstatic Field jf C Lic;
L1362:    getfield Field ic T Ljd;
L1365:    getfield Field jd jd_s Z
L1368:    ifne L1375
L1371:    iconst_3
L1372:    goto L1376
L1375:    iconst_1
L1376:    istore 7
L1378:    getstatic Field jf C Lic;
L1381:    getfield Field ic ic_vb Lnn;
L1384:    sipush 27732
L1387:    invokevirtual Method nn c (I)I
L1390:    istore 8
L1392:    getstatic Field jf C Lic;
L1395:    getfield Field ic ic_vb Lnn;
L1398:    getfield Field nn nn_e [I
L1401:    iload_0
L1402:    iaload
L1403:    iload 7
L1405:    iand
L1406:    iconst_m1
L1407:    ixor
L1408:    iconst_m1
L1409:    if_icmpeq L1803
L1412:    getstatic Field jf C Lic;
L1415:    getfield Field ic T Ljd;
L1418:    getfield Field jd jd_s Z
L1421:    ifne L1444
L1424:    getstatic Field jf C Lic;
L1427:    getfield Field ic ic_vb Lnn;
L1430:    getfield Field nn nn_q [I
L1433:    iload_0
L1434:    iaload
L1435:    iload 8
L1437:    if_icmple L1443
L1440:    goto L1444
L1443:    return
L1444:    iload 5
L1446:    ifeq L1516
L1449:    iload 8
L1451:    getstatic Field jf C Lic;
L1454:    getfield Field ic ic_vb Lnn;
L1457:    getfield Field nn nn_q [I
L1460:    getstatic Field bv bv_w Lha;
L1463:    getfield Field ha ha_v I
L1466:    ineg
L1467:    iload_0
L1468:    iadd
L1469:    iaload
L1470:    if_icmplt L1488
L1473:    getstatic Field jf C Lic;
L1476:    getfield Field ic T Ljd;
L1479:    getfield Field jd jd_s Z
L1482:    ifeq L1536
L1485:    goto L1488
L1488:    iconst_m1
L1489:    iload 7
L1491:    getstatic Field jf C Lic;
L1494:    getfield Field ic ic_vb Lnn;
L1497:    getfield Field nn nn_e [I
L1500:    iload_0
L1501:    getstatic Field ks y I
L1504:    ineg
L1505:    iadd
L1506:    iaload
L1507:    iand
L1508:    iconst_m1
L1509:    ixor
L1510:    if_icmpne L1536
L1513:    goto L1516
L1516:    bipush -40
L1518:    iload_2
L1519:    iadd
L1520:    iload_1
L1521:    iload_2
L1522:    bipush -20
L1524:    iload_1
L1525:    iadd
L1526:    ldc 16711680
L1528:    iload 6
L1530:    invokestatic Method qn d (IIIIII)V
L1533:    goto L1536
L1536:    iload 5
L1538:    iconst_m1
L1539:    getstatic Field ef ef_c I
L1542:    iadd
L1543:    if_icmpeq L1608
L1546:    iload 8
L1548:    getstatic Field jf C Lic;
L1551:    getfield Field ic ic_vb Lnn;
L1554:    getfield Field nn nn_q [I
L1557:    getstatic Field ks y I
L1560:    iload_0
L1561:    iadd
L1562:    iaload
L1563:    if_icmplt L1581
L1566:    getstatic Field jf C Lic;
L1569:    getfield Field ic T Ljd;
L1572:    getfield Field jd jd_s Z
L1575:    ifeq L1625
L1578:    goto L1581
L1581:    getstatic Field jf C Lic;
L1584:    getfield Field ic ic_vb Lnn;
L1587:    getfield Field nn nn_e [I
L1590:    getstatic Field ks y I
L1593:    iload_0
L1594:    iadd
L1595:    iaload
L1596:    iload 7
L1598:    iand
L1599:    iconst_m1
L1600:    ixor
L1601:    iconst_m1
L1602:    if_icmpeq L1608
L1605:    goto L1625
L1608:    bipush 40
L1610:    iload_2
L1611:    iadd
L1612:    iload_1
L1613:    iload_2
L1614:    iload_1
L1615:    bipush -20
L1617:    isub
L1618:    ldc 16711680
L1620:    iload 6
L1622:    invokestatic Method qn d (IIIIII)V
L1625:    iconst_0
L1626:    iload 4
L1628:    if_icmpeq L1693
L1631:    getstatic Field jf C Lic;
L1634:    getfield Field ic ic_vb Lnn;
L1637:    getfield Field nn nn_q [I
L1640:    iconst_m1
L1641:    iload_0
L1642:    iadd
L1643:    iaload
L1644:    iconst_m1
L1645:    ixor
L1646:    iload 8
L1648:    iconst_m1
L1649:    ixor
L1650:    if_icmplt L1668
L1653:    getstatic Field jf C Lic;
L1656:    getfield Field ic T Ljd;
L1659:    getfield Field jd jd_s Z
L1662:    ifeq L1713
L1665:    goto L1668
L1668:    iload 7
L1670:    getstatic Field jf C Lic;
L1673:    getfield Field ic ic_vb Lnn;
L1676:    getfield Field nn nn_e [I
L1679:    iload_0
L1680:    iconst_1
L1681:    isub
L1682:    iaload
L1683:    iand
L1684:    iconst_m1
L1685:    ixor
L1686:    iconst_m1
L1687:    if_icmpne L1713
L1690:    goto L1693
L1693:    iload_2
L1694:    bipush -40
L1696:    iadd
L1697:    iload_1
L1698:    iload_2
L1699:    bipush 20
L1701:    iload_1
L1702:    iadd
L1703:    ldc 16711680
L1705:    iload 6
L1707:    invokestatic Method qn d (IIIIII)V
L1710:    goto L1713
L1713:    iload 4
L1715:    iconst_m1
L1716:    ixor
L1717:    iconst_m1
L1718:    getstatic Field ks y I
L1721:    iadd
L1722:    iconst_m1
L1723:    ixor
L1724:    if_icmpeq L1785
L1727:    iload 8
L1729:    getstatic Field jf C Lic;
L1732:    getfield Field ic ic_vb Lnn;
L1735:    getfield Field nn nn_q [I
L1738:    iconst_1
L1739:    iload_0
L1740:    iadd
L1741:    iaload
L1742:    if_icmplt L1760
L1745:    getstatic Field jf C Lic;
L1748:    getfield Field ic T Ljd;
L1751:    getfield Field jd jd_s Z
L1754:    ifeq L1802
L1757:    goto L1760
L1760:    iload 7
L1762:    getstatic Field jf C Lic;
L1765:    getfield Field ic ic_vb Lnn;
L1768:    getfield Field nn nn_e [I
L1771:    iload_0
L1772:    iconst_m1
L1773:    isub
L1774:    iaload
L1775:    iand
L1776:    iconst_m1
L1777:    ixor
L1778:    iconst_m1
L1779:    if_icmpeq L1785
L1782:    goto L1802
L1785:    bipush 40
L1787:    iload_2
L1788:    iadd
L1789:    iload_1
L1790:    iload_2
L1791:    bipush -20
L1793:    iload_1
L1794:    iadd
L1795:    ldc 16711680
L1797:    iload 6
L1799:    invokestatic Method qn d (IIIIII)V
L1802:    return
L1803:    return
L1804:    getstatic Field jf C Lic;
L1807:    getfield Field ic T Ljd;
L1810:    getfield Field jd B I
L1813:    iconst_m1
L1814:    ixor
L1815:    iconst_m1
L1816:    if_icmplt L1820
L1819:    return
L1820:    getstatic Field jf C Lic;
L1823:    getfield Field ic T Ljd;
L1826:    getfield Field jd jd_s Z
L1829:    ifeq L2277
L1832:    getstatic Field jf C Lic;
L1835:    getfield Field ic T Ljd;
L1838:    getfield Field jd jd_s Z
L1841:    ifne L1848
L1844:    iconst_3
L1845:    goto L1849
L1848:    iconst_1
L1849:    istore 7
L1851:    getstatic Field jf C Lic;
L1854:    getfield Field ic ic_vb Lnn;
L1857:    sipush 27732
L1860:    invokevirtual Method nn c (I)I
L1863:    istore 8
L1865:    getstatic Field jf C Lic;
L1868:    getfield Field ic ic_vb Lnn;
L1871:    getfield Field nn nn_e [I
L1874:    iload_0
L1875:    iaload
L1876:    iload 7
L1878:    iand
L1879:    iconst_m1
L1880:    ixor
L1881:    iconst_m1
L1882:    if_icmpeq L2276
L1885:    getstatic Field jf C Lic;
L1888:    getfield Field ic T Ljd;
L1891:    getfield Field jd jd_s Z
L1894:    ifne L1917
L1897:    getstatic Field jf C Lic;
L1900:    getfield Field ic ic_vb Lnn;
L1903:    getfield Field nn nn_q [I
L1906:    iload_0
L1907:    iaload
L1908:    iload 8
L1910:    if_icmple L1916
L1913:    goto L1917
L1916:    return
L1917:    iload 5
L1919:    ifeq L1989
L1922:    iload 8
L1924:    getstatic Field jf C Lic;
L1927:    getfield Field ic ic_vb Lnn;
L1930:    getfield Field nn nn_q [I
L1933:    getstatic Field bv bv_w Lha;
L1936:    getfield Field ha ha_v I
L1939:    ineg
L1940:    iload_0
L1941:    iadd
L1942:    iaload
L1943:    if_icmplt L1961
L1946:    getstatic Field jf C Lic;
L1949:    getfield Field ic T Ljd;
L1952:    getfield Field jd jd_s Z
L1955:    ifeq L2009
L1958:    goto L1961
L1961:    iconst_m1
L1962:    iload 7
L1964:    getstatic Field jf C Lic;
L1967:    getfield Field ic ic_vb Lnn;
L1970:    getfield Field nn nn_e [I
L1973:    iload_0
L1974:    getstatic Field ks y I
L1977:    ineg
L1978:    iadd
L1979:    iaload
L1980:    iand
L1981:    iconst_m1
L1982:    ixor
L1983:    if_icmpne L2009
L1986:    goto L1989
L1989:    bipush -40
L1991:    iload_2
L1992:    iadd
L1993:    iload_1
L1994:    iload_2
L1995:    bipush -20
L1997:    iload_1
L1998:    iadd
L1999:    ldc 16711680
L2001:    iload 6
L2003:    invokestatic Method qn d (IIIIII)V
L2006:    goto L2009
L2009:    iload 5
L2011:    iconst_m1
L2012:    getstatic Field ef ef_c I
L2015:    iadd
L2016:    if_icmpeq L2081
L2019:    iload 8
L2021:    getstatic Field jf C Lic;
L2024:    getfield Field ic ic_vb Lnn;
L2027:    getfield Field nn nn_q [I
L2030:    getstatic Field ks y I
L2033:    iload_0
L2034:    iadd
L2035:    iaload
L2036:    if_icmplt L2054
L2039:    getstatic Field jf C Lic;
L2042:    getfield Field ic T Ljd;
L2045:    getfield Field jd jd_s Z
L2048:    ifeq L2098
L2051:    goto L2054
L2054:    getstatic Field jf C Lic;
L2057:    getfield Field ic ic_vb Lnn;
L2060:    getfield Field nn nn_e [I
L2063:    getstatic Field ks y I
L2066:    iload_0
L2067:    iadd
L2068:    iaload
L2069:    iload 7
L2071:    iand
L2072:    iconst_m1
L2073:    ixor
L2074:    iconst_m1
L2075:    if_icmpeq L2081
L2078:    goto L2098
L2081:    bipush 40
L2083:    iload_2
L2084:    iadd
L2085:    iload_1
L2086:    iload_2
L2087:    iload_1
L2088:    bipush -20
L2090:    isub
L2091:    ldc 16711680
L2093:    iload 6
L2095:    invokestatic Method qn d (IIIIII)V
L2098:    iconst_0
L2099:    iload 4
L2101:    if_icmpeq L2166
L2104:    getstatic Field jf C Lic;
L2107:    getfield Field ic ic_vb Lnn;
L2110:    getfield Field nn nn_q [I
L2113:    iconst_m1
L2114:    iload_0
L2115:    iadd
L2116:    iaload
L2117:    iconst_m1
L2118:    ixor
L2119:    iload 8
L2121:    iconst_m1
L2122:    ixor
L2123:    if_icmplt L2141
L2126:    getstatic Field jf C Lic;
L2129:    getfield Field ic T Ljd;
L2132:    getfield Field jd jd_s Z
L2135:    ifeq L2186
L2138:    goto L2141
L2141:    iload 7
L2143:    getstatic Field jf C Lic;
L2146:    getfield Field ic ic_vb Lnn;
L2149:    getfield Field nn nn_e [I
L2152:    iload_0
L2153:    iconst_1
L2154:    isub
L2155:    iaload
L2156:    iand
L2157:    iconst_m1
L2158:    ixor
L2159:    iconst_m1
L2160:    if_icmpne L2186
L2163:    goto L2166
L2166:    iload_2
L2167:    bipush -40
L2169:    iadd
L2170:    iload_1
L2171:    iload_2
L2172:    bipush 20
L2174:    iload_1
L2175:    iadd
L2176:    ldc 16711680
L2178:    iload 6
L2180:    invokestatic Method qn d (IIIIII)V
L2183:    goto L2186
L2186:    iload 4
L2188:    iconst_m1
L2189:    ixor
L2190:    iconst_m1
L2191:    getstatic Field ks y I
L2194:    iadd
L2195:    iconst_m1
L2196:    ixor
L2197:    if_icmpeq L2258
L2200:    iload 8
L2202:    getstatic Field jf C Lic;
L2205:    getfield Field ic ic_vb Lnn;
L2208:    getfield Field nn nn_q [I
L2211:    iconst_1
L2212:    iload_0
L2213:    iadd
L2214:    iaload
L2215:    if_icmplt L2233
L2218:    getstatic Field jf C Lic;
L2221:    getfield Field ic T Ljd;
L2224:    getfield Field jd jd_s Z
L2227:    ifeq L2275
L2230:    goto L2233
L2233:    iload 7
L2235:    getstatic Field jf C Lic;
L2238:    getfield Field ic ic_vb Lnn;
L2241:    getfield Field nn nn_e [I
L2244:    iload_0
L2245:    iconst_m1
L2246:    isub
L2247:    iaload
L2248:    iand
L2249:    iconst_m1
L2250:    ixor
L2251:    iconst_m1
L2252:    if_icmpeq L2258
L2255:    goto L2275
L2258:    bipush 40
L2260:    iload_2
L2261:    iadd
L2262:    iload_1
L2263:    iload_2
L2264:    bipush -20
L2266:    iload_1
L2267:    iadd
L2268:    ldc 16711680
L2270:    iload 6
L2272:    invokestatic Method qn d (IIIIII)V
L2275:    return
L2276:    return
L2277:    getstatic Field jf C Lic;
L2280:    getfield Field ic T Ljd;
L2283:    getfield Field jd O I
L2286:    iconst_m1
L2287:    ixor
L2288:    getstatic Field jf C Lic;
L2291:    getfield Field ic ic_q I
L2294:    iconst_m1
L2295:    ixor
L2296:    if_icmpne L3089
L2299:    getstatic Field jf C Lic;
L2302:    getfield Field ic T Ljd;
L2305:    sipush -13494
L2308:    invokevirtual Method jd h (I)Z
L2311:    ifne L3089
L2314:    getstatic Field jf C Lic;
L2317:    getfield Field ic T Ljd;
L2320:    sipush 3257
L2323:    invokevirtual Method jd B (I)I
L2326:    istore 7
L2328:    getstatic Field jf C Lic;
L2331:    getfield Field ic T Ljd;
L2334:    bipush -79
L2336:    invokevirtual Method jd l (B)I
L2339:    istore 8
L2341:    getstatic Field jf C Lic;
L2344:    getfield Field ic ic_vb Lnn;
L2347:    getfield Field nn nn_n I
L2350:    istore 9
L2352:    getstatic Field jf C Lic;
L2355:    getfield Field ic ic_vb Lnn;
L2358:    getfield Field nn nn_b I
L2361:    istore 10
L2363:    getstatic Field jf C Lic;
L2366:    getfield Field ic T Ljd;
L2369:    sipush -28467
L2372:    invokevirtual Method jd o (I)Z
L2375:    ifne L2381
L2378:    goto L2406
L2381:    getstatic Field jf C Lic;
L2384:    getfield Field ic T Ljd;
L2387:    iconst_0
L2388:    invokevirtual Method jd a (Z)I
L2391:    istore 9
L2393:    getstatic Field jf C Lic;
L2396:    getfield Field ic T Ljd;
L2399:    bipush -65
L2401:    invokevirtual Method jd D (I)I
L2404:    istore 10
L2406:    iload 9
L2408:    iload 4
L2410:    isub
L2411:    invokestatic Method java/lang/Math abs (I)I
L2414:    istore 11
L2416:    iload 10
L2418:    iload 5
L2420:    ineg
L2421:    iadd
L2422:    invokestatic Method java/lang/Math abs (I)I
L2425:    istore 12
L2427:    iload 11
L2429:    iload 12
L2431:    iadd
L2432:    iload 7
L2434:    if_icmpgt L3089
L2437:    iload 8
L2439:    iload 11
L2441:    iload 12
L2443:    ineg
L2444:    isub
L2445:    if_icmpgt L3089
L2448:    iload 12
L2450:    iload 11
L2452:    iadd
L2453:    iconst_1
L2454:    if_icmpne L2461
L2457:    iconst_1
L2458:    goto L2462
L2461:    iconst_0
L2462:    istore 13
L2464:    iload 13
L2466:    ifne L2563
L2469:    getstatic Field bv bv_w Lha;
L2472:    bipush 31
L2474:    iload 10
L2476:    iload 9
L2478:    getstatic Field jf C Lic;
L2481:    getfield Field ic T Ljd;
L2484:    getfield Field jd O I
L2487:    invokevirtual Method ha b (IIII)I
L2490:    iconst_2
L2491:    iand
L2492:    iconst_m1
L2493:    ixor
L2494:    iconst_m1
L2495:    if_icmpne L2563
L2498:    iconst_2
L2499:    getstatic Field bv bv_w Lha;
L2502:    bipush 31
L2504:    iload 5
L2506:    iload 4
L2508:    getstatic Field jf C Lic;
L2511:    getfield Field ic T Ljd;
L2514:    getfield Field jd O I
L2517:    invokevirtual Method ha b (IIII)I
L2520:    iand
L2521:    ifne L2563
L2524:    getstatic Field bv bv_w Lha;
L2527:    getfield Field ha ha_j Lul;
L2530:    iload 10
L2532:    iload 4
L2534:    iload 9
L2536:    getstatic Field jf C Lic;
L2539:    getfield Field ic T Ljd;
L2542:    bipush -111
L2544:    invokevirtual Method jd x (I)Z
L2547:    iload 7
L2549:    iload 5
L2551:    bipush 62
L2553:    invokevirtual Method ul a (IIIZIIB)Z
L2556:    ifeq L2563
L2559:    iconst_1
L2560:    goto L2564
L2563:    iconst_0
L2564:    istore 14
L2566:    iload 13
L2568:    ifne L3021
L2571:    iload 14
L2573:    ifne L3021
L2576:    getstatic Field jf C Lic;
L2579:    getfield Field ic T Ljd;
L2582:    getfield Field jd jd_s Z
L2585:    ifne L2592
L2588:    iconst_3
L2589:    goto L2593
L2592:    iconst_1
L2593:    istore 7
L2595:    getstatic Field jf C Lic;
L2598:    getfield Field ic ic_vb Lnn;
L2601:    sipush 27732
L2604:    invokevirtual Method nn c (I)I
L2607:    istore 8
L2609:    getstatic Field jf C Lic;
L2612:    getfield Field ic ic_vb Lnn;
L2615:    getfield Field nn nn_e [I
L2618:    iload_0
L2619:    iaload
L2620:    iload 7
L2622:    iand
L2623:    iconst_m1
L2624:    ixor
L2625:    iconst_m1
L2626:    if_icmpeq L3020
L2629:    getstatic Field jf C Lic;
L2632:    getfield Field ic T Ljd;
L2635:    getfield Field jd jd_s Z
L2638:    ifne L2661
L2641:    getstatic Field jf C Lic;
L2644:    getfield Field ic ic_vb Lnn;
L2647:    getfield Field nn nn_q [I
L2650:    iload_0
L2651:    iaload
L2652:    iload 8
L2654:    if_icmple L2660
L2657:    goto L2661
L2660:    return
L2661:    iload 5
L2663:    ifeq L2733
L2666:    iload 8
L2668:    getstatic Field jf C Lic;
L2671:    getfield Field ic ic_vb Lnn;
L2674:    getfield Field nn nn_q [I
L2677:    getstatic Field bv bv_w Lha;
L2680:    getfield Field ha ha_v I
L2683:    ineg
L2684:    iload_0
L2685:    iadd
L2686:    iaload
L2687:    if_icmplt L2705
L2690:    getstatic Field jf C Lic;
L2693:    getfield Field ic T Ljd;
L2696:    getfield Field jd jd_s Z
L2699:    ifeq L2753
L2702:    goto L2705
L2705:    iconst_m1
L2706:    iload 7
L2708:    getstatic Field jf C Lic;
L2711:    getfield Field ic ic_vb Lnn;
L2714:    getfield Field nn nn_e [I
L2717:    iload_0
L2718:    getstatic Field ks y I
L2721:    ineg
L2722:    iadd
L2723:    iaload
L2724:    iand
L2725:    iconst_m1
L2726:    ixor
L2727:    if_icmpne L2753
L2730:    goto L2733
L2733:    bipush -40
L2735:    iload_2
L2736:    iadd
L2737:    iload_1
L2738:    iload_2
L2739:    bipush -20
L2741:    iload_1
L2742:    iadd
L2743:    ldc 16711680
L2745:    iload 6
L2747:    invokestatic Method qn d (IIIIII)V
L2750:    goto L2753
L2753:    iload 5
L2755:    iconst_m1
L2756:    getstatic Field ef ef_c I
L2759:    iadd
L2760:    if_icmpeq L2825
L2763:    iload 8
L2765:    getstatic Field jf C Lic;
L2768:    getfield Field ic ic_vb Lnn;
L2771:    getfield Field nn nn_q [I
L2774:    getstatic Field ks y I
L2777:    iload_0
L2778:    iadd
L2779:    iaload
L2780:    if_icmplt L2798
L2783:    getstatic Field jf C Lic;
L2786:    getfield Field ic T Ljd;
L2789:    getfield Field jd jd_s Z
L2792:    ifeq L2842
L2795:    goto L2798
L2798:    getstatic Field jf C Lic;
L2801:    getfield Field ic ic_vb Lnn;
L2804:    getfield Field nn nn_e [I
L2807:    getstatic Field ks y I
L2810:    iload_0
L2811:    iadd
L2812:    iaload
L2813:    iload 7
L2815:    iand
L2816:    iconst_m1
L2817:    ixor
L2818:    iconst_m1
L2819:    if_icmpeq L2825
L2822:    goto L2842
L2825:    bipush 40
L2827:    iload_2
L2828:    iadd
L2829:    iload_1
L2830:    iload_2
L2831:    iload_1
L2832:    bipush -20
L2834:    isub
L2835:    ldc 16711680
L2837:    iload 6
L2839:    invokestatic Method qn d (IIIIII)V
L2842:    iconst_0
L2843:    iload 4
L2845:    if_icmpeq L2910
L2848:    getstatic Field jf C Lic;
L2851:    getfield Field ic ic_vb Lnn;
L2854:    getfield Field nn nn_q [I
L2857:    iconst_m1
L2858:    iload_0
L2859:    iadd
L2860:    iaload
L2861:    iconst_m1
L2862:    ixor
L2863:    iload 8
L2865:    iconst_m1
L2866:    ixor
L2867:    if_icmplt L2885
L2870:    getstatic Field jf C Lic;
L2873:    getfield Field ic T Ljd;
L2876:    getfield Field jd jd_s Z
L2879:    ifeq L2930
L2882:    goto L2885
L2885:    iload 7
L2887:    getstatic Field jf C Lic;
L2890:    getfield Field ic ic_vb Lnn;
L2893:    getfield Field nn nn_e [I
L2896:    iload_0
L2897:    iconst_1
L2898:    isub
L2899:    iaload
L2900:    iand
L2901:    iconst_m1
L2902:    ixor
L2903:    iconst_m1
L2904:    if_icmpne L2930
L2907:    goto L2910
L2910:    iload_2
L2911:    bipush -40
L2913:    iadd
L2914:    iload_1
L2915:    iload_2
L2916:    bipush 20
L2918:    iload_1
L2919:    iadd
L2920:    ldc 16711680
L2922:    iload 6
L2924:    invokestatic Method qn d (IIIIII)V
L2927:    goto L2930
L2930:    iload 4
L2932:    iconst_m1
L2933:    ixor
L2934:    iconst_m1
L2935:    getstatic Field ks y I
L2938:    iadd
L2939:    iconst_m1
L2940:    ixor
L2941:    if_icmpeq L3002
L2944:    iload 8
L2946:    getstatic Field jf C Lic;
L2949:    getfield Field ic ic_vb Lnn;
L2952:    getfield Field nn nn_q [I
L2955:    iconst_1
L2956:    iload_0
L2957:    iadd
L2958:    iaload
L2959:    if_icmplt L2977
L2962:    getstatic Field jf C Lic;
L2965:    getfield Field ic T Ljd;
L2968:    getfield Field jd jd_s Z
L2971:    ifeq L3019
L2974:    goto L2977
L2977:    iload 7
L2979:    getstatic Field jf C Lic;
L2982:    getfield Field ic ic_vb Lnn;
L2985:    getfield Field nn nn_e [I
L2988:    iload_0
L2989:    iconst_m1
L2990:    isub
L2991:    iaload
L2992:    iand
L2993:    iconst_m1
L2994:    ixor
L2995:    iconst_m1
L2996:    if_icmpeq L3002
L2999:    goto L3019
L3002:    bipush 40
L3004:    iload_2
L3005:    iadd
L3006:    iload_1
L3007:    iload_2
L3008:    bipush -20
L3010:    iload_1
L3011:    iadd
L3012:    ldc 16711680
L3014:    iload 6
L3016:    invokestatic Method qn d (IIIIII)V
L3019:    return
L3020:    return
L3021:    iconst_1
L3022:    istore 15
L3024:    iload 15
L3026:    iconst_m1
L3027:    ixor
L3028:    bipush -41
L3030:    if_icmple L3089
L3033:    iload 15
L3035:    iconst_2
L3036:    imul
L3037:    ineg
L3038:    bipush 40
L3040:    iadd
L3041:    invokestatic Method java/lang/Math abs (I)I
L3044:    istore 16
L3046:    bipush -20
L3048:    iload_1
L3049:    iload 15
L3051:    iadd
L3052:    iadd
L3053:    istore 17
L3055:    bipush -40
L3057:    iload_2
L3058:    iadd
L3059:    iload 16
L3061:    iadd
L3062:    iload 17
L3064:    iconst_m1
L3065:    iload 16
L3067:    ineg
L3068:    iadd
L3069:    iload_2
L3070:    iadd
L3071:    bipush -40
L3073:    isub
L3074:    iload 17
L3076:    ldc 16711680
L3078:    iload 6
L3080:    invokestatic Method qn d (IIIIII)V
L3083:    iinc 15 2
L3086:    goto L3024
L3089:    getstatic Field jf C Lic;
L3092:    getfield Field ic T Ljd;
L3095:    getfield Field jd jd_s Z
L3098:    ifne L3105
L3101:    iconst_3
L3102:    goto L3106
L3105:    iconst_1
L3106:    istore 7
L3108:    getstatic Field jf C Lic;
L3111:    getfield Field ic ic_vb Lnn;
L3114:    sipush 27732
L3117:    invokevirtual Method nn c (I)I
L3120:    istore 8
L3122:    getstatic Field jf C Lic;
L3125:    getfield Field ic ic_vb Lnn;
L3128:    getfield Field nn nn_e [I
L3131:    iload_0
L3132:    iaload
L3133:    iload 7
L3135:    iand
L3136:    iconst_m1
L3137:    ixor
L3138:    iconst_m1
L3139:    if_icmpeq L5710
L3142:    getstatic Field jf C Lic;
L3145:    getfield Field ic T Ljd;
L3148:    getfield Field jd jd_s Z
L3151:    ifne L3174
L3154:    getstatic Field jf C Lic;
L3157:    getfield Field ic ic_vb Lnn;
L3160:    getfield Field nn nn_q [I
L3163:    iload_0
L3164:    iaload
L3165:    iload 8
L3167:    if_icmple L3173
L3170:    goto L3174
L3173:    return
L3174:    iload 5
L3176:    ifeq L3246
L3179:    iload 8
L3181:    getstatic Field jf C Lic;
L3184:    getfield Field ic ic_vb Lnn;
L3187:    getfield Field nn nn_q [I
L3190:    getstatic Field bv bv_w Lha;
L3193:    getfield Field ha ha_v I
L3196:    ineg
L3197:    iload_0
L3198:    iadd
L3199:    iaload
L3200:    if_icmplt L3218
L3203:    getstatic Field jf C Lic;
L3206:    getfield Field ic T Ljd;
L3209:    getfield Field jd jd_s Z
L3212:    ifeq L3266
L3215:    goto L3218
L3218:    iconst_m1
L3219:    iload 7
L3221:    getstatic Field jf C Lic;
L3224:    getfield Field ic ic_vb Lnn;
L3227:    getfield Field nn nn_e [I
L3230:    iload_0
L3231:    getstatic Field ks y I
L3234:    ineg
L3235:    iadd
L3236:    iaload
L3237:    iand
L3238:    iconst_m1
L3239:    ixor
L3240:    if_icmpne L3266
L3243:    goto L3246
L3246:    bipush -40
L3248:    iload_2
L3249:    iadd
L3250:    iload_1
L3251:    iload_2
L3252:    bipush -20
L3254:    iload_1
L3255:    iadd
L3256:    ldc 16711680
L3258:    iload 6
L3260:    invokestatic Method qn d (IIIIII)V
L3263:    goto L3266
L3266:    iload 5
L3268:    iconst_m1
L3269:    getstatic Field ef ef_c I
L3272:    iadd
L3273:    if_icmpeq L3513
L3276:    iload 8
L3278:    getstatic Field jf C Lic;
L3281:    getfield Field ic ic_vb Lnn;
L3284:    getfield Field nn nn_q [I
L3287:    getstatic Field ks y I
L3290:    iload_0
L3291:    iadd
L3292:    iaload
L3293:    if_icmplt L3311
L3296:    getstatic Field jf C Lic;
L3299:    getfield Field ic T Ljd;
L3302:    getfield Field jd jd_s Z
L3305:    ifeq L3530
L3308:    goto L3311
L3311:    getstatic Field jf C Lic;
L3314:    getfield Field ic ic_vb Lnn;
L3317:    getfield Field nn nn_e [I
L3320:    getstatic Field ks y I
L3323:    iload_0
L3324:    iadd
L3325:    iaload
L3326:    iload 7
L3328:    iand
L3329:    iconst_m1
L3330:    ixor
L3331:    iconst_m1
L3332:    if_icmpeq L3513
L3335:    iconst_0
L3336:    iload 4
L3338:    if_icmpeq L3403
L3341:    getstatic Field jf C Lic;
L3344:    getfield Field ic ic_vb Lnn;
L3347:    getfield Field nn nn_q [I
L3350:    iconst_m1
L3351:    iload_0
L3352:    iadd
L3353:    iaload
L3354:    iconst_m1
L3355:    ixor
L3356:    iload 8
L3358:    iconst_m1
L3359:    ixor
L3360:    if_icmplt L3378
L3363:    getstatic Field jf C Lic;
L3366:    getfield Field ic T Ljd;
L3369:    getfield Field jd jd_s Z
L3372:    ifeq L3423
L3375:    goto L3378
L3378:    iload 7
L3380:    getstatic Field jf C Lic;
L3383:    getfield Field ic ic_vb Lnn;
L3386:    getfield Field nn nn_e [I
L3389:    iload_0
L3390:    iconst_1
L3391:    isub
L3392:    iaload
L3393:    iand
L3394:    iconst_m1
L3395:    ixor
L3396:    iconst_m1
L3397:    if_icmpne L3423
L3400:    goto L3403
L3403:    iload_2
L3404:    bipush -40
L3406:    iadd
L3407:    iload_1
L3408:    iload_2
L3409:    bipush 20
L3411:    iload_1
L3412:    iadd
L3413:    ldc 16711680
L3415:    iload 6
L3417:    invokestatic Method qn d (IIIIII)V
L3420:    goto L3423
L3423:    iload 4
L3425:    iconst_m1
L3426:    ixor
L3427:    iconst_m1
L3428:    getstatic Field ks y I
L3431:    iadd
L3432:    iconst_m1
L3433:    ixor
L3434:    if_icmpeq L3495
L3437:    iload 8
L3439:    getstatic Field jf C Lic;
L3442:    getfield Field ic ic_vb Lnn;
L3445:    getfield Field nn nn_q [I
L3448:    iconst_1
L3449:    iload_0
L3450:    iadd
L3451:    iaload
L3452:    if_icmplt L3470
L3455:    getstatic Field jf C Lic;
L3458:    getfield Field ic T Ljd;
L3461:    getfield Field jd jd_s Z
L3464:    ifeq L3512
L3467:    goto L3470
L3470:    iload 7
L3472:    getstatic Field jf C Lic;
L3475:    getfield Field ic ic_vb Lnn;
L3478:    getfield Field nn nn_e [I
L3481:    iload_0
L3482:    iconst_m1
L3483:    isub
L3484:    iaload
L3485:    iand
L3486:    iconst_m1
L3487:    ixor
L3488:    iconst_m1
L3489:    if_icmpeq L3495
L3492:    goto L3512
L3495:    bipush 40
L3497:    iload_2
L3498:    iadd
L3499:    iload_1
L3500:    iload_2
L3501:    bipush -20
L3503:    iload_1
L3504:    iadd
L3505:    ldc 16711680
L3507:    iload 6
L3509:    invokestatic Method qn d (IIIIII)V
L3512:    return
L3513:    bipush 40
L3515:    iload_2
L3516:    iadd
L3517:    iload_1
L3518:    iload_2
L3519:    iload_1
L3520:    bipush -20
L3522:    isub
L3523:    ldc 16711680
L3525:    iload 6
L3527:    invokestatic Method qn d (IIIIII)V
L3530:    iconst_0
L3531:    iload 4
L3533:    if_icmpeq L5565
L3536:    getstatic Field jf C Lic;
L3539:    getfield Field ic ic_vb Lnn;
L3542:    getfield Field nn nn_q [I
L3545:    iconst_m1
L3546:    iload_0
L3547:    iadd
L3548:    iaload
L3549:    iconst_m1
L3550:    ixor
L3551:    iload 8
L3553:    iconst_m1
L3554:    ixor
L3555:    if_icmplt L5270
L3558:    getstatic Field jf C Lic;
L3561:    getfield Field ic T Ljd;
L3564:    getfield Field jd jd_s Z
L3567:    ifne L3698
L3570:    iload 4
L3572:    iconst_m1
L3573:    ixor
L3574:    iconst_m1
L3575:    getstatic Field ks y I
L3578:    iadd
L3579:    iconst_m1
L3580:    ixor
L3581:    if_icmpeq L3680
L3584:    iload 8
L3586:    getstatic Field jf C Lic;
L3589:    getfield Field ic ic_vb Lnn;
L3592:    getfield Field nn nn_q [I
L3595:    iconst_1
L3596:    iload_0
L3597:    iadd
L3598:    iaload
L3599:    if_icmplt L3657
L3602:    getstatic Field jf C Lic;
L3605:    getfield Field ic T Ljd;
L3608:    getfield Field jd jd_s Z
L3611:    ifeq L3697
L3614:    iload 7
L3616:    getstatic Field jf C Lic;
L3619:    getfield Field ic ic_vb Lnn;
L3622:    getfield Field nn nn_e [I
L3625:    iload_0
L3626:    iconst_m1
L3627:    isub
L3628:    iaload
L3629:    iand
L3630:    iconst_m1
L3631:    ixor
L3632:    iconst_m1
L3633:    if_icmpeq L3639
L3636:    goto L3656
L3639:    bipush 40
L3641:    iload_2
L3642:    iadd
L3643:    iload_1
L3644:    iload_2
L3645:    bipush -20
L3647:    iload_1
L3648:    iadd
L3649:    ldc 16711680
L3651:    iload 6
L3653:    invokestatic Method qn d (IIIIII)V
L3656:    return
L3657:    iload 7
L3659:    getstatic Field jf C Lic;
L3662:    getfield Field ic ic_vb Lnn;
L3665:    getfield Field nn nn_e [I
L3668:    iload_0
L3669:    iconst_m1
L3670:    isub
L3671:    iaload
L3672:    iand
L3673:    iconst_m1
L3674:    ixor
L3675:    iconst_m1
L3676:    if_icmpeq L3680
L3679:    return
L3680:    bipush 40
L3682:    iload_2
L3683:    iadd
L3684:    iload_1
L3685:    iload_2
L3686:    bipush -20
L3688:    iload_1
L3689:    iadd
L3690:    ldc 16711680
L3692:    iload 6
L3694:    invokestatic Method qn d (IIIIII)V
L3697:    return
L3698:    iload 7
L3700:    getstatic Field jf C Lic;
L3703:    getfield Field ic ic_vb Lnn;
L3706:    getfield Field nn nn_e [I
L3709:    iload_0
L3710:    iconst_1
L3711:    isub
L3712:    iaload
L3713:    iand
L3714:    iconst_m1
L3715:    ixor
L3716:    iconst_m1
L3717:    if_icmpne L5123
L3720:    iload_2
L3721:    bipush -40
L3723:    iadd
L3724:    iload_1
L3725:    iload_2
L3726:    bipush 20
L3728:    iload_1
L3729:    iadd
L3730:    ldc 16711680
L3732:    iload 6
L3734:    invokestatic Method qn d (IIIIII)V
L3737:    iload 4
L3739:    iconst_m1
L3740:    ixor
L3741:    iconst_m1
L3742:    getstatic Field ks y I
L3745:    iadd
L3746:    iconst_m1
L3747:    ixor
L3748:    if_icmpne L3769
L3751:    bipush 40
L3753:    iload_2
L3754:    iadd
L3755:    iload_1
L3756:    iload_2
L3757:    bipush -20
L3759:    iload_1
L3760:    iadd
L3761:    ldc 16711680
L3763:    iload 6
L3765:    invokestatic Method qn d (IIIIII)V
L3768:    return
L3769:    iload 8
L3771:    getstatic Field jf C Lic;
L3774:    getfield Field ic ic_vb Lnn;
L3777:    getfield Field nn nn_q [I
L3780:    iconst_1
L3781:    iload_0
L3782:    iadd
L3783:    iaload
L3784:    if_icmplt L3842
L3787:    getstatic Field jf C Lic;
L3790:    getfield Field ic T Ljd;
L3793:    getfield Field jd jd_s Z
L3796:    ifeq L3883
L3799:    iload 7
L3801:    getstatic Field jf C Lic;
L3804:    getfield Field ic ic_vb Lnn;
L3807:    getfield Field nn nn_e [I
L3810:    iload_0
L3811:    iconst_m1
L3812:    isub
L3813:    iaload
L3814:    iand
L3815:    iconst_m1
L3816:    ixor
L3817:    iconst_m1
L3818:    if_icmpeq L3824
L3821:    goto L3841
L3824:    bipush 40
L3826:    iload_2
L3827:    iadd
L3828:    iload_1
L3829:    iload_2
L3830:    bipush -20
L3832:    iload_1
L3833:    iadd
L3834:    ldc 16711680
L3836:    iload 6
L3838:    invokestatic Method qn d (IIIIII)V
L3841:    return
L3842:    iload 7
L3844:    getstatic Field jf C Lic;
L3847:    getfield Field ic ic_vb Lnn;
L3850:    getfield Field nn nn_e [I
L3853:    iload_0
L3854:    iconst_m1
L3855:    isub
L3856:    iaload
L3857:    iand
L3858:    iconst_m1
L3859:    ixor
L3860:    iconst_m1
L3861:    if_icmpne L3882
L3864:    bipush 40
L3866:    iload_2
L3867:    iadd
L3868:    iload_1
L3869:    iload_2
L3870:    bipush -20
L3872:    iload_1
L3873:    iadd
L3874:    ldc 16711680
L3876:    iload 6
L3878:    invokestatic Method qn d (IIIIII)V
L3881:    return
L3882:    return
L3883:    return
L3884:    return
L3885:    bipush 40
L3887:    iload_2
L3888:    iadd
L3889:    iload_1
L3890:    iload_2
L3891:    bipush -20
L3893:    iload_1
L3894:    iadd
L3895:    ldc 16711680
L3897:    iload 6
L3899:    invokestatic Method qn d (IIIIII)V
L3902:    return
L3903:    return
L3904:    bipush 40
L3906:    iload_2
L3907:    iadd
L3908:    iload_1
L3909:    iload_2
L3910:    bipush -20
L3912:    iload_1
L3913:    iadd
L3914:    ldc 16711680
L3916:    iload 6
L3918:    invokestatic Method qn d (IIIIII)V
L3921:    return
L3922:    iload 7
L3924:    getstatic Field jf C Lic;
L3927:    getfield Field ic ic_vb Lnn;
L3930:    getfield Field nn nn_e [I
L3933:    iload_0
L3934:    iconst_m1
L3935:    isub
L3936:    iaload
L3937:    iand
L3938:    iconst_m1
L3939:    ixor
L3940:    iconst_m1
L3941:    if_icmpne L3962
L3944:    bipush 40
L3946:    iload_2
L3947:    iadd
L3948:    iload_1
L3949:    iload_2
L3950:    bipush -20
L3952:    iload_1
L3953:    iadd
L3954:    ldc 16711680
L3956:    iload 6
L3958:    invokestatic Method qn d (IIIIII)V
L3961:    return
L3962:    return
L3963:    return
L3964:    bipush 40
L3966:    iload_2
L3967:    iadd
L3968:    iload_1
L3969:    iload_2
L3970:    bipush -20
L3972:    iload_1
L3973:    iadd
L3974:    ldc 16711680
L3976:    iload 6
L3978:    invokestatic Method qn d (IIIIII)V
L3981:    return
L3982:    bipush 40
L3984:    iload_2
L3985:    iadd
L3986:    iload_1
L3987:    iload_2
L3988:    bipush -20
L3990:    iload_1
L3991:    iadd
L3992:    ldc 16711680
L3994:    iload 6
L3996:    invokestatic Method qn d (IIIIII)V
L3999:    return
L4000:    iload 7
L4002:    getstatic Field jf C Lic;
L4005:    getfield Field ic ic_vb Lnn;
L4008:    getfield Field nn nn_e [I
L4011:    iload_0
L4012:    iconst_m1
L4013:    isub
L4014:    iaload
L4015:    iand
L4016:    iconst_m1
L4017:    ixor
L4018:    iconst_m1
L4019:    if_icmpeq L4023
L4022:    return
L4023:    bipush 40
L4025:    iload_2
L4026:    iadd
L4027:    iload_1
L4028:    iload_2
L4029:    bipush -20
L4031:    iload_1
L4032:    iadd
L4033:    ldc 16711680
L4035:    iload 6
L4037:    invokestatic Method qn d (IIIIII)V
L4040:    return
L4041:    bipush 40
L4043:    iload_2
L4044:    iadd
L4045:    iload_1
L4046:    iload_2
L4047:    bipush -20
L4049:    iload_1
L4050:    iadd
L4051:    ldc 16711680
L4053:    iload 6
L4055:    invokestatic Method qn d (IIIIII)V
L4058:    return
L4059:    bipush 40
L4061:    iload_2
L4062:    iadd
L4063:    iload_1
L4064:    iload_2
L4065:    bipush -20
L4067:    iload_1
L4068:    iadd
L4069:    ldc 16711680
L4071:    iload 6
L4073:    invokestatic Method qn d (IIIIII)V
L4076:    return
L4077:    iload 7
L4079:    getstatic Field jf C Lic;
L4082:    getfield Field ic ic_vb Lnn;
L4085:    getfield Field nn nn_e [I
L4088:    iload_0
L4089:    iconst_m1
L4090:    isub
L4091:    iaload
L4092:    iand
L4093:    iconst_m1
L4094:    ixor
L4095:    iconst_m1
L4096:    if_icmpne L5120
L4099:    bipush 40
L4101:    iload_2
L4102:    iadd
L4103:    iload_1
L4104:    iload_2
L4105:    bipush -20
L4107:    iload_1
L4108:    iadd
L4109:    ldc 16711680
L4111:    iload 6
L4113:    invokestatic Method qn d (IIIIII)V
L4116:    return
L4117:    bipush 40
L4119:    iload_2
L4120:    iadd
L4121:    iload_1
L4122:    iload_2
L4123:    bipush -20
L4125:    iload_1
L4126:    iadd
L4127:    ldc 16711680
L4129:    iload 6
L4131:    invokestatic Method qn d (IIIIII)V
L4134:    return
L4135:    iload 7
L4137:    getstatic Field jf C Lic;
L4140:    getfield Field ic ic_vb Lnn;
L4143:    getfield Field nn nn_e [I
L4146:    iload_0
L4147:    iconst_m1
L4148:    isub
L4149:    iaload
L4150:    iand
L4151:    iconst_m1
L4152:    ixor
L4153:    iconst_m1
L4154:    if_icmpne L4175
L4157:    bipush 40
L4159:    iload_2
L4160:    iadd
L4161:    iload_1
L4162:    iload_2
L4163:    bipush -20
L4165:    iload_1
L4166:    iadd
L4167:    ldc 16711680
L4169:    iload 6
L4171:    invokestatic Method qn d (IIIIII)V
L4174:    return
L4175:    return
L4176:    return
L4177:    bipush 40
L4179:    iload_2
L4180:    iadd
L4181:    iload_1
L4182:    iload_2
L4183:    bipush -20
L4185:    iload_1
L4186:    iadd
L4187:    ldc 16711680
L4189:    iload 6
L4191:    invokestatic Method qn d (IIIIII)V
L4194:    return
L4195:    bipush 40
L4197:    iload_2
L4198:    iadd
L4199:    iload_1
L4200:    iload_2
L4201:    bipush -20
L4203:    iload_1
L4204:    iadd
L4205:    ldc 16711680
L4207:    iload 6
L4209:    invokestatic Method qn d (IIIIII)V
L4212:    return
L4213:    iload 8
L4215:    getstatic Field jf C Lic;
L4218:    getfield Field ic ic_vb Lnn;
L4221:    getfield Field nn nn_q [I
L4224:    iconst_1
L4225:    iload_0
L4226:    iadd
L4227:    iaload
L4228:    if_icmplt L4286
L4231:    getstatic Field jf C Lic;
L4234:    getfield Field ic T Ljd;
L4237:    getfield Field jd jd_s Z
L4240:    ifeq L4327
L4243:    iload 7
L4245:    getstatic Field jf C Lic;
L4248:    getfield Field ic ic_vb Lnn;
L4251:    getfield Field nn nn_e [I
L4254:    iload_0
L4255:    iconst_m1
L4256:    isub
L4257:    iaload
L4258:    iand
L4259:    iconst_m1
L4260:    ixor
L4261:    iconst_m1
L4262:    if_icmpeq L4268
L4265:    goto L4285
L4268:    bipush 40
L4270:    iload_2
L4271:    iadd
L4272:    iload_1
L4273:    iload_2
L4274:    bipush -20
L4276:    iload_1
L4277:    iadd
L4278:    ldc 16711680
L4280:    iload 6
L4282:    invokestatic Method qn d (IIIIII)V
L4285:    return
L4286:    iload 7
L4288:    getstatic Field jf C Lic;
L4291:    getfield Field ic ic_vb Lnn;
L4294:    getfield Field nn nn_e [I
L4297:    iload_0
L4298:    iconst_m1
L4299:    isub
L4300:    iaload
L4301:    iand
L4302:    iconst_m1
L4303:    ixor
L4304:    iconst_m1
L4305:    if_icmpne L4326
L4308:    bipush 40
L4310:    iload_2
L4311:    iadd
L4312:    iload_1
L4313:    iload_2
L4314:    bipush -20
L4316:    iload_1
L4317:    iadd
L4318:    ldc 16711680
L4320:    iload 6
L4322:    invokestatic Method qn d (IIIIII)V
L4325:    return
L4326:    return
L4327:    return
L4328:    bipush 40
L4330:    iload_2
L4331:    iadd
L4332:    iload_1
L4333:    iload_2
L4334:    bipush -20
L4336:    iload_1
L4337:    iadd
L4338:    ldc 16711680
L4340:    iload 6
L4342:    invokestatic Method qn d (IIIIII)V
L4345:    return
L4346:    iload 7
L4348:    getstatic Field jf C Lic;
L4351:    getfield Field ic ic_vb Lnn;
L4354:    getfield Field nn nn_e [I
L4357:    iload_0
L4358:    iconst_m1
L4359:    isub
L4360:    iaload
L4361:    iand
L4362:    iconst_m1
L4363:    ixor
L4364:    iconst_m1
L4365:    if_icmpeq L4369
L4368:    return
L4369:    bipush 40
L4371:    iload_2
L4372:    iadd
L4373:    iload_1
L4374:    iload_2
L4375:    bipush -20
L4377:    iload_1
L4378:    iadd
L4379:    ldc 16711680
L4381:    iload 6
L4383:    invokestatic Method qn d (IIIIII)V
L4386:    return
L4387:    iload_2
L4388:    bipush -40
L4390:    iadd
L4391:    iload_1
L4392:    iload_2
L4393:    bipush 20
L4395:    iload_1
L4396:    iadd
L4397:    ldc 16711680
L4399:    iload 6
L4401:    invokestatic Method qn d (IIIIII)V
L4404:    iload 4
L4406:    iconst_m1
L4407:    ixor
L4408:    iconst_m1
L4409:    getstatic Field ks y I
L4412:    iadd
L4413:    iconst_m1
L4414:    ixor
L4415:    if_icmpeq L4514
L4418:    iload 8
L4420:    getstatic Field jf C Lic;
L4423:    getfield Field ic ic_vb Lnn;
L4426:    getfield Field nn nn_q [I
L4429:    iconst_1
L4430:    iload_0
L4431:    iadd
L4432:    iaload
L4433:    if_icmplt L4491
L4436:    getstatic Field jf C Lic;
L4439:    getfield Field ic T Ljd;
L4442:    getfield Field jd jd_s Z
L4445:    ifeq L4531
L4448:    iload 7
L4450:    getstatic Field jf C Lic;
L4453:    getfield Field ic ic_vb Lnn;
L4456:    getfield Field nn nn_e [I
L4459:    iload_0
L4460:    iconst_m1
L4461:    isub
L4462:    iaload
L4463:    iand
L4464:    iconst_m1
L4465:    ixor
L4466:    iconst_m1
L4467:    if_icmpeq L4473
L4470:    goto L4490
L4473:    bipush 40
L4475:    iload_2
L4476:    iadd
L4477:    iload_1
L4478:    iload_2
L4479:    bipush -20
L4481:    iload_1
L4482:    iadd
L4483:    ldc 16711680
L4485:    iload 6
L4487:    invokestatic Method qn d (IIIIII)V
L4490:    return
L4491:    iload 7
L4493:    getstatic Field jf C Lic;
L4496:    getfield Field ic ic_vb Lnn;
L4499:    getfield Field nn nn_e [I
L4502:    iload_0
L4503:    iconst_m1
L4504:    isub
L4505:    iaload
L4506:    iand
L4507:    iconst_m1
L4508:    ixor
L4509:    iconst_m1
L4510:    if_icmpeq L4514
L4513:    return
L4514:    bipush 40
L4516:    iload_2
L4517:    iadd
L4518:    iload_1
L4519:    iload_2
L4520:    bipush -20
L4522:    iload_1
L4523:    iadd
L4524:    ldc 16711680
L4526:    iload 6
L4528:    invokestatic Method qn d (IIIIII)V
L4531:    return
L4532:    bipush 40
L4534:    iload_2
L4535:    iadd
L4536:    iload_1
L4537:    iload_2
L4538:    bipush -20
L4540:    iload_1
L4541:    iadd
L4542:    ldc 16711680
L4544:    iload 6
L4546:    invokestatic Method qn d (IIIIII)V
L4549:    return
L4550:    iload 7
L4552:    getstatic Field jf C Lic;
L4555:    getfield Field ic ic_vb Lnn;
L4558:    getfield Field nn nn_e [I
L4561:    iload_0
L4562:    iconst_m1
L4563:    isub
L4564:    iaload
L4565:    iand
L4566:    iconst_m1
L4567:    ixor
L4568:    iconst_m1
L4569:    if_icmpeq L4573
L4572:    return
L4573:    bipush 40
L4575:    iload_2
L4576:    iadd
L4577:    iload_1
L4578:    iload_2
L4579:    bipush -20
L4581:    iload_1
L4582:    iadd
L4583:    ldc 16711680
L4585:    iload 6
L4587:    invokestatic Method qn d (IIIIII)V
L4590:    return
L4591:    iload 8
L4593:    getstatic Field jf C Lic;
L4596:    getfield Field ic ic_vb Lnn;
L4599:    getfield Field nn nn_q [I
L4602:    iconst_1
L4603:    iload_0
L4604:    iadd
L4605:    iaload
L4606:    if_icmplt L4664
L4609:    getstatic Field jf C Lic;
L4612:    getfield Field ic T Ljd;
L4615:    getfield Field jd jd_s Z
L4618:    ifeq L5101
L4621:    iload 7
L4623:    getstatic Field jf C Lic;
L4626:    getfield Field ic ic_vb Lnn;
L4629:    getfield Field nn nn_e [I
L4632:    iload_0
L4633:    iconst_m1
L4634:    isub
L4635:    iaload
L4636:    iand
L4637:    iconst_m1
L4638:    ixor
L4639:    iconst_m1
L4640:    if_icmpeq L4646
L4643:    goto L4663
L4646:    bipush 40
L4648:    iload_2
L4649:    iadd
L4650:    iload_1
L4651:    iload_2
L4652:    bipush -20
L4654:    iload_1
L4655:    iadd
L4656:    ldc 16711680
L4658:    iload 6
L4660:    invokestatic Method qn d (IIIIII)V
L4663:    return
L4664:    iload 7
L4666:    getstatic Field jf C Lic;
L4669:    getfield Field ic ic_vb Lnn;
L4672:    getfield Field nn nn_e [I
L4675:    iload_0
L4676:    iconst_m1
L4677:    isub
L4678:    iaload
L4679:    iand
L4680:    iconst_m1
L4681:    ixor
L4682:    iconst_m1
L4683:    if_icmpne L5100
L4686:    bipush 40
L4688:    iload_2
L4689:    iadd
L4690:    iload_1
L4691:    iload_2
L4692:    bipush -20
L4694:    iload_1
L4695:    iadd
L4696:    ldc 16711680
L4698:    iload 6
L4700:    invokestatic Method qn d (IIIIII)V
L4703:    return
L4704:    bipush 40
L4706:    iload_2
L4707:    iadd
L4708:    iload_1
L4709:    iload_2
L4710:    bipush -20
L4712:    iload_1
L4713:    iadd
L4714:    ldc 16711680
L4716:    iload 6
L4718:    invokestatic Method qn d (IIIIII)V
L4721:    return
L4722:    iload 8
L4724:    getstatic Field jf C Lic;
L4727:    getfield Field ic ic_vb Lnn;
L4730:    getfield Field nn nn_q [I
L4733:    iconst_1
L4734:    iload_0
L4735:    iadd
L4736:    iaload
L4737:    if_icmplt L4795
L4740:    getstatic Field jf C Lic;
L4743:    getfield Field ic T Ljd;
L4746:    getfield Field jd jd_s Z
L4749:    ifeq L4836
L4752:    iload 7
L4754:    getstatic Field jf C Lic;
L4757:    getfield Field ic ic_vb Lnn;
L4760:    getfield Field nn nn_e [I
L4763:    iload_0
L4764:    iconst_m1
L4765:    isub
L4766:    iaload
L4767:    iand
L4768:    iconst_m1
L4769:    ixor
L4770:    iconst_m1
L4771:    if_icmpeq L4777
L4774:    goto L4794
L4777:    bipush 40
L4779:    iload_2
L4780:    iadd
L4781:    iload_1
L4782:    iload_2
L4783:    bipush -20
L4785:    iload_1
L4786:    iadd
L4787:    ldc 16711680
L4789:    iload 6
L4791:    invokestatic Method qn d (IIIIII)V
L4794:    return
L4795:    iload 7
L4797:    getstatic Field jf C Lic;
L4800:    getfield Field ic ic_vb Lnn;
L4803:    getfield Field nn nn_e [I
L4806:    iload_0
L4807:    iconst_m1
L4808:    isub
L4809:    iaload
L4810:    iand
L4811:    iconst_m1
L4812:    ixor
L4813:    iconst_m1
L4814:    if_icmpne L4835
L4817:    bipush 40
L4819:    iload_2
L4820:    iadd
L4821:    iload_1
L4822:    iload_2
L4823:    bipush -20
L4825:    iload_1
L4826:    iadd
L4827:    ldc 16711680
L4829:    iload 6
L4831:    invokestatic Method qn d (IIIIII)V
L4834:    return
L4835:    return
L4836:    return
L4837:    bipush 40
L4839:    iload_2
L4840:    iadd
L4841:    iload_1
L4842:    iload_2
L4843:    bipush -20
L4845:    iload_1
L4846:    iadd
L4847:    ldc 16711680
L4849:    iload 6
L4851:    invokestatic Method qn d (IIIIII)V
L4854:    return
L4855:    iload 7
L4857:    getstatic Field jf C Lic;
L4860:    getfield Field ic ic_vb Lnn;
L4863:    getfield Field nn nn_e [I
L4866:    iload_0
L4867:    iconst_m1
L4868:    isub
L4869:    iaload
L4870:    iand
L4871:    iconst_m1
L4872:    ixor
L4873:    iconst_m1
L4874:    if_icmpeq L4878
L4877:    return
L4878:    bipush 40
L4880:    iload_2
L4881:    iadd
L4882:    iload_1
L4883:    iload_2
L4884:    bipush -20
L4886:    iload_1
L4887:    iadd
L4888:    ldc 16711680
L4890:    iload 6
L4892:    invokestatic Method qn d (IIIIII)V
L4895:    return
L4896:    iload_2
L4897:    bipush -40
L4899:    iadd
L4900:    iload_1
L4901:    iload_2
L4902:    bipush 20
L4904:    iload_1
L4905:    iadd
L4906:    ldc 16711680
L4908:    iload 6
L4910:    invokestatic Method qn d (IIIIII)V
L4913:    iload 4
L4915:    iconst_m1
L4916:    ixor
L4917:    iconst_m1
L4918:    getstatic Field ks y I
L4921:    iadd
L4922:    iconst_m1
L4923:    ixor
L4924:    if_icmpeq L5023
L4927:    iload 8
L4929:    getstatic Field jf C Lic;
L4932:    getfield Field ic ic_vb Lnn;
L4935:    getfield Field nn nn_q [I
L4938:    iconst_1
L4939:    iload_0
L4940:    iadd
L4941:    iaload
L4942:    if_icmplt L5000
L4945:    getstatic Field jf C Lic;
L4948:    getfield Field ic T Ljd;
L4951:    getfield Field jd jd_s Z
L4954:    ifeq L5040
L4957:    iload 7
L4959:    getstatic Field jf C Lic;
L4962:    getfield Field ic ic_vb Lnn;
L4965:    getfield Field nn nn_e [I
L4968:    iload_0
L4969:    iconst_m1
L4970:    isub
L4971:    iaload
L4972:    iand
L4973:    iconst_m1
L4974:    ixor
L4975:    iconst_m1
L4976:    if_icmpeq L4982
L4979:    goto L4999
L4982:    bipush 40
L4984:    iload_2
L4985:    iadd
L4986:    iload_1
L4987:    iload_2
L4988:    bipush -20
L4990:    iload_1
L4991:    iadd
L4992:    ldc 16711680
L4994:    iload 6
L4996:    invokestatic Method qn d (IIIIII)V
L4999:    return
L5000:    iload 7
L5002:    getstatic Field jf C Lic;
L5005:    getfield Field ic ic_vb Lnn;
L5008:    getfield Field nn nn_e [I
L5011:    iload_0
L5012:    iconst_m1
L5013:    isub
L5014:    iaload
L5015:    iand
L5016:    iconst_m1
L5017:    ixor
L5018:    iconst_m1
L5019:    if_icmpeq L5023
L5022:    return
L5023:    bipush 40
L5025:    iload_2
L5026:    iadd
L5027:    iload_1
L5028:    iload_2
L5029:    bipush -20
L5031:    iload_1
L5032:    iadd
L5033:    ldc 16711680
L5035:    iload 6
L5037:    invokestatic Method qn d (IIIIII)V
L5040:    return
L5041:    bipush 40
L5043:    iload_2
L5044:    iadd
L5045:    iload_1
L5046:    iload_2
L5047:    bipush -20
L5049:    iload_1
L5050:    iadd
L5051:    ldc 16711680
L5053:    iload 6
L5055:    invokestatic Method qn d (IIIIII)V
L5058:    return
L5059:    iload 7
L5061:    getstatic Field jf C Lic;
L5064:    getfield Field ic ic_vb Lnn;
L5067:    getfield Field nn nn_e [I
L5070:    iload_0
L5071:    iconst_m1
L5072:    isub
L5073:    iaload
L5074:    iand
L5075:    iconst_m1
L5076:    ixor
L5077:    iconst_m1
L5078:    if_icmpeq L5082
L5081:    return
L5082:    bipush 40
L5084:    iload_2
L5085:    iadd
L5086:    iload_1
L5087:    iload_2
L5088:    bipush -20
L5090:    iload_1
L5091:    iadd
L5092:    ldc 16711680
L5094:    iload 6
L5096:    invokestatic Method qn d (IIIIII)V
L5099:    return
L5100:    return
L5101:    return
L5102:    bipush 40
L5104:    iload_2
L5105:    iadd
L5106:    iload_1
L5107:    iload_2
L5108:    bipush -20
L5110:    iload_1
L5111:    iadd
L5112:    ldc 16711680
L5114:    iload 6
L5116:    invokestatic Method qn d (IIIIII)V
L5119:    return
L5120:    return
L5121:    return
L5122:    return
L5123:    iload 4
L5125:    iconst_m1
L5126:    ixor
L5127:    iconst_m1
L5128:    getstatic Field ks y I
L5131:    iadd
L5132:    iconst_m1
L5133:    ixor
L5134:    if_icmpne L5155
L5137:    bipush 40
L5139:    iload_2
L5140:    iadd
L5141:    iload_1
L5142:    iload_2
L5143:    bipush -20
L5145:    iload_1
L5146:    iadd
L5147:    ldc 16711680
L5149:    iload 6
L5151:    invokestatic Method qn d (IIIIII)V
L5154:    return
L5155:    iload 8
L5157:    getstatic Field jf C Lic;
L5160:    getfield Field ic ic_vb Lnn;
L5163:    getfield Field nn nn_q [I
L5166:    iconst_1
L5167:    iload_0
L5168:    iadd
L5169:    iaload
L5170:    if_icmplt L5228
L5173:    getstatic Field jf C Lic;
L5176:    getfield Field ic T Ljd;
L5179:    getfield Field jd jd_s Z
L5182:    ifeq L5269
L5185:    iload 7
L5187:    getstatic Field jf C Lic;
L5190:    getfield Field ic ic_vb Lnn;
L5193:    getfield Field nn nn_e [I
L5196:    iload_0
L5197:    iconst_m1
L5198:    isub
L5199:    iaload
L5200:    iand
L5201:    iconst_m1
L5202:    ixor
L5203:    iconst_m1
L5204:    if_icmpeq L5210
L5207:    goto L5227
L5210:    bipush 40
L5212:    iload_2
L5213:    iadd
L5214:    iload_1
L5215:    iload_2
L5216:    bipush -20
L5218:    iload_1
L5219:    iadd
L5220:    ldc 16711680
L5222:    iload 6
L5224:    invokestatic Method qn d (IIIIII)V
L5227:    return
L5228:    iload 7
L5230:    getstatic Field jf C Lic;
L5233:    getfield Field ic ic_vb Lnn;
L5236:    getfield Field nn nn_e [I
L5239:    iload_0
L5240:    iconst_m1
L5241:    isub
L5242:    iaload
L5243:    iand
L5244:    iconst_m1
L5245:    ixor
L5246:    iconst_m1
L5247:    if_icmpne L5268
L5250:    bipush 40
L5252:    iload_2
L5253:    iadd
L5254:    iload_1
L5255:    iload_2
L5256:    bipush -20
L5258:    iload_1
L5259:    iadd
L5260:    ldc 16711680
L5262:    iload 6
L5264:    invokestatic Method qn d (IIIIII)V
L5267:    return
L5268:    return
L5269:    return
L5270:    iload 7
L5272:    getstatic Field jf C Lic;
L5275:    getfield Field ic ic_vb Lnn;
L5278:    getfield Field nn nn_e [I
L5281:    iload_0
L5282:    iconst_1
L5283:    isub
L5284:    iaload
L5285:    iand
L5286:    iconst_m1
L5287:    ixor
L5288:    iconst_m1
L5289:    if_icmpeq L5420
L5292:    iload 4
L5294:    iconst_m1
L5295:    ixor
L5296:    iconst_m1
L5297:    getstatic Field ks y I
L5300:    iadd
L5301:    iconst_m1
L5302:    ixor
L5303:    if_icmpeq L5402
L5306:    iload 8
L5308:    getstatic Field jf C Lic;
L5311:    getfield Field ic ic_vb Lnn;
L5314:    getfield Field nn nn_q [I
L5317:    iconst_1
L5318:    iload_0
L5319:    iadd
L5320:    iaload
L5321:    if_icmplt L5379
L5324:    getstatic Field jf C Lic;
L5327:    getfield Field ic T Ljd;
L5330:    getfield Field jd jd_s Z
L5333:    ifeq L5419
L5336:    iload 7
L5338:    getstatic Field jf C Lic;
L5341:    getfield Field ic ic_vb Lnn;
L5344:    getfield Field nn nn_e [I
L5347:    iload_0
L5348:    iconst_m1
L5349:    isub
L5350:    iaload
L5351:    iand
L5352:    iconst_m1
L5353:    ixor
L5354:    iconst_m1
L5355:    if_icmpeq L5361
L5358:    goto L5378
L5361:    bipush 40
L5363:    iload_2
L5364:    iadd
L5365:    iload_1
L5366:    iload_2
L5367:    bipush -20
L5369:    iload_1
L5370:    iadd
L5371:    ldc 16711680
L5373:    iload 6
L5375:    invokestatic Method qn d (IIIIII)V
L5378:    return
L5379:    iload 7
L5381:    getstatic Field jf C Lic;
L5384:    getfield Field ic ic_vb Lnn;
L5387:    getfield Field nn nn_e [I
L5390:    iload_0
L5391:    iconst_m1
L5392:    isub
L5393:    iaload
L5394:    iand
L5395:    iconst_m1
L5396:    ixor
L5397:    iconst_m1
L5398:    if_icmpeq L5402
L5401:    return
L5402:    bipush 40
L5404:    iload_2
L5405:    iadd
L5406:    iload_1
L5407:    iload_2
L5408:    bipush -20
L5410:    iload_1
L5411:    iadd
L5412:    ldc 16711680
L5414:    iload 6
L5416:    invokestatic Method qn d (IIIIII)V
L5419:    return
L5420:    iload_2
L5421:    bipush -40
L5423:    iadd
L5424:    iload_1
L5425:    iload_2
L5426:    bipush 20
L5428:    iload_1
L5429:    iadd
L5430:    ldc 16711680
L5432:    iload 6
L5434:    invokestatic Method qn d (IIIIII)V
L5437:    iload 4
L5439:    iconst_m1
L5440:    ixor
L5441:    iconst_m1
L5442:    getstatic Field ks y I
L5445:    iadd
L5446:    iconst_m1
L5447:    ixor
L5448:    if_icmpeq L5547
L5451:    iload 8
L5453:    getstatic Field jf C Lic;
L5456:    getfield Field ic ic_vb Lnn;
L5459:    getfield Field nn nn_q [I
L5462:    iconst_1
L5463:    iload_0
L5464:    iadd
L5465:    iaload
L5466:    if_icmplt L5524
L5469:    getstatic Field jf C Lic;
L5472:    getfield Field ic T Ljd;
L5475:    getfield Field jd jd_s Z
L5478:    ifeq L5564
L5481:    iload 7
L5483:    getstatic Field jf C Lic;
L5486:    getfield Field ic ic_vb Lnn;
L5489:    getfield Field nn nn_e [I
L5492:    iload_0
L5493:    iconst_m1
L5494:    isub
L5495:    iaload
L5496:    iand
L5497:    iconst_m1
L5498:    ixor
L5499:    iconst_m1
L5500:    if_icmpeq L5506
L5503:    goto L5523
L5506:    bipush 40
L5508:    iload_2
L5509:    iadd
L5510:    iload_1
L5511:    iload_2
L5512:    bipush -20
L5514:    iload_1
L5515:    iadd
L5516:    ldc 16711680
L5518:    iload 6
L5520:    invokestatic Method qn d (IIIIII)V
L5523:    return
L5524:    iload 7
L5526:    getstatic Field jf C Lic;
L5529:    getfield Field ic ic_vb Lnn;
L5532:    getfield Field nn nn_e [I
L5535:    iload_0
L5536:    iconst_m1
L5537:    isub
L5538:    iaload
L5539:    iand
L5540:    iconst_m1
L5541:    ixor
L5542:    iconst_m1
L5543:    if_icmpeq L5547
L5546:    return
L5547:    bipush 40
L5549:    iload_2
L5550:    iadd
L5551:    iload_1
L5552:    iload_2
L5553:    bipush -20
L5555:    iload_1
L5556:    iadd
L5557:    ldc 16711680
L5559:    iload 6
L5561:    invokestatic Method qn d (IIIIII)V
L5564:    return
L5565:    iload_2
L5566:    bipush -40
L5568:    iadd
L5569:    iload_1
L5570:    iload_2
L5571:    bipush 20
L5573:    iload_1
L5574:    iadd
L5575:    ldc 16711680
L5577:    iload 6
L5579:    invokestatic Method qn d (IIIIII)V
L5582:    iload 4
L5584:    iconst_m1
L5585:    ixor
L5586:    iconst_m1
L5587:    getstatic Field ks y I
L5590:    iadd
L5591:    iconst_m1
L5592:    ixor
L5593:    if_icmpeq L5692
L5596:    iload 8
L5598:    getstatic Field jf C Lic;
L5601:    getfield Field ic ic_vb Lnn;
L5604:    getfield Field nn nn_q [I
L5607:    iconst_1
L5608:    iload_0
L5609:    iadd
L5610:    iaload
L5611:    if_icmplt L5669
L5614:    getstatic Field jf C Lic;
L5617:    getfield Field ic T Ljd;
L5620:    getfield Field jd jd_s Z
L5623:    ifeq L5709
L5626:    iload 7
L5628:    getstatic Field jf C Lic;
L5631:    getfield Field ic ic_vb Lnn;
L5634:    getfield Field nn nn_e [I
L5637:    iload_0
L5638:    iconst_m1
L5639:    isub
L5640:    iaload
L5641:    iand
L5642:    iconst_m1
L5643:    ixor
L5644:    iconst_m1
L5645:    if_icmpeq L5651
L5648:    goto L5668
L5651:    bipush 40
L5653:    iload_2
L5654:    iadd
L5655:    iload_1
L5656:    iload_2
L5657:    bipush -20
L5659:    iload_1
L5660:    iadd
L5661:    ldc 16711680
L5663:    iload 6
L5665:    invokestatic Method qn d (IIIIII)V
L5668:    return
L5669:    iload 7
L5671:    getstatic Field jf C Lic;
L5674:    getfield Field ic ic_vb Lnn;
L5677:    getfield Field nn nn_e [I
L5680:    iload_0
L5681:    iconst_m1
L5682:    isub
L5683:    iaload
L5684:    iand
L5685:    iconst_m1
L5686:    ixor
L5687:    iconst_m1
L5688:    if_icmpeq L5692
L5691:    return
L5692:    bipush 40
L5694:    iload_2
L5695:    iadd
L5696:    iload_1
L5697:    iload_2
L5698:    bipush -20
L5700:    iload_1
L5701:    iadd
L5702:    ldc 16711680
L5704:    iload 6
L5706:    invokestatic Method qn d (IIIIII)V
L5709:    return
L5710:    return
L5711:
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