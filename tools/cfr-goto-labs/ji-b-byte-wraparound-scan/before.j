.version 50 0
.class final super ji
.super java/lang/Object
.field static a I

.field private k I

.field static i I

.field private g Lrm;

.field private h I

.field static d [I

.field static l Ljava/lang/String;

.field static b [Ljava/lang/String;

.field static f [Ljava/lang/String;

.field static e I

.field private c I

.field static volatile j I
.method private final b : (B)I
    .code stack 64 locals 6
L0:    getstatic Field SteelSentinels G I
L3:    istore 5
L5:    bipush -17
L7:    aload_0
L8:    getfield Field ji c I
L11:    iconst_m1
L12:    ixor
L13:    if_icmpeq L19
L16:    goto L21
L19:    iconst_m1
L20:    ireturn
L21:    aload_0
L22:    getfield Field ji g Lrm;
L25:    getfield Field rm e I
L28:    istore_2
L29:    iload_2
L30:    ifge L659
L33:    aload_0
L34:    iload_1
L35:    bipush 105
L37:    ixor
L38:    iload_2
L39:    invokespecial Method ji b (II)I
L42:    istore_3
L43:    iconst_m1
L44:    iload_2
L45:    iconst_m1
L46:    ixor
L47:    if_icmplt L81
L50:    getstatic Field uc e [[I
L53:    aload_0
L54:    getfield Field ji c I
L57:    aaload
L58:    arraylength
L59:    iload_2
L60:    if_icmple L81
L63:    getstatic Field uc e [[I
L66:    aload_0
L67:    getfield Field ji c I
L70:    aaload
L71:    iload_2
L72:    iaload
L73:    iconst_m1
L74:    ixor
L75:    ifeq L81
L78:    goto L119
L81:    getstatic Field uc e [[I
L84:    aload_0
L85:    getfield Field ji c I
L88:    aaload
L89:    arraylength
L90:    iconst_1
L91:    isub
L92:    istore_2
L93:    iload_2
L94:    iflt L117
L97:    iconst_m1
L98:    getstatic Field uc e [[I
L101:    aload_0
L102:    getfield Field ji c I
L105:    aaload
L106:    iload_2
L107:    iaload
L108:    if_icmpne L117
L111:    iinc 2 -1
L114:    goto L93
L117:    iload_2
L118:    ireturn
L119:    iconst_0
L120:    aload_0
L121:    getfield Field ji c I
L124:    if_icmpeq L130
L127:    goto L188
L130:    getstatic Field uc e [[I
L133:    aload_0
L134:    getfield Field ji c I
L137:    aaload
L138:    iload_2
L139:    iaload
L140:    bipush 34
L142:    if_icmpeq L186
L145:    getstatic Field uc e [[I
L148:    aload_0
L149:    getfield Field ji c I
L152:    aaload
L153:    iconst_m1
L154:    getstatic Field uc e [[I
L157:    aload_0
L158:    getfield Field ji c I
L161:    aaload
L162:    arraylength
L163:    iadd
L164:    iaload
L165:    bipush 34
L167:    if_icmpne L186
L170:    iload_2
L171:    putstatic Field dh F I
L174:    iconst_m1
L175:    getstatic Field uc e [[I
L178:    aload_0
L179:    getfield Field ji c I
L182:    aaload
L183:    arraylength
L184:    iadd
L185:    ireturn
L186:    iload_2
L187:    ireturn
L188:    aload_0
L189:    getfield Field ji c I
L192:    bipush 20
L194:    if_icmpne L208
L197:    iload_2
L198:    iflt L208
L201:    iconst_3
L202:    iload_2
L203:    if_icmple L208
L206:    iconst_0
L207:    ireturn
L208:    iload_3
L209:    iflt L314
L212:    iinc 3 -1
L215:    iinc 2 -1
L218:    iconst_0
L219:    iload_3
L220:    if_icmpgt L250
L223:    iconst_m1
L224:    getstatic Field uc e [[I
L227:    aload_0
L228:    getfield Field ji c I
L231:    aaload
L232:    iload_2
L233:    iaload
L234:    if_icmpne L312
L237:    iinc 2 -1
L240:    iinc 3 -1
L243:    iload_3
L244:    iflt L2853
L247:    goto L2859
L250:    iinc 3 4
L253:    iinc 2 4
L256:    goto L259
L259:    iconst_m1
L260:    getstatic Field uc e [[I
L263:    aload_0
L264:    getfield Field ji c I
L267:    aaload
L268:    iload_2
L269:    iaload
L270:    if_icmpne L312
L273:    iinc 2 -1
L276:    iinc 3 -1
L279:    iload_3
L280:    iflt L286
L283:    goto L292
L286:    iinc 2 4
L289:    iinc 3 4
L292:    iload_2
L293:    iconst_m1
L294:    ixor
L295:    aload_0
L296:    getfield Field ji g Lrm;
L299:    getfield Field rm e I
L302:    iconst_m1
L303:    ixor
L304:    if_icmpeq L310
L307:    goto L259
L310:    iload_2
L311:    ireturn
L312:    iload_2
L313:    ireturn
L314:    iconst_5
L315:    aload_0
L316:    getfield Field ji c I
L319:    if_icmpne L452
L322:    iload_2
L323:    iconst_3
L324:    if_icmplt L437
L327:    bipush -7
L329:    aload_0
L330:    getfield Field ji c I
L333:    iconst_m1
L334:    ixor
L335:    if_icmpne L362
L338:    iconst_2
L339:    iload_2
L340:    if_icmpgt L346
L343:    goto L362
L346:    iinc 2 -1
L349:    iconst_0
L350:    iload_2
L351:    if_icmpgt L357
L354:    goto L360
L357:    iinc 2 2
L360:    iload_2
L361:    ireturn
L362:    aload_0
L363:    getfield Field ji c I
L366:    iconst_m1
L367:    ixor
L368:    bipush -20
L370:    if_icmpeq L376
L373:    goto L421
L376:    getstatic Field uc e [[I
L379:    aload_0
L380:    getfield Field ji c I
L383:    aaload
L384:    getstatic Field fa c [I
L387:    if_acmpeq L395
L390:    bipush 20
L392:    goto L397
L395:    bipush 30
L397:    istore 4
L399:    iload_2
L400:    iconst_m1
L401:    ixor
L402:    bipush -11
L404:    if_icmpgt L421
L407:    iload_2
L408:    iload 4
L410:    if_icmplt L416
L413:    goto L421
L416:    iload_2
L417:    bipush 10
L419:    isub
L420:    ireturn
L421:    iload_1
L422:    bipush -20
L424:    if_icmpeq L435
L427:    aload_0
L428:    iconst_1
L429:    invokevirtual Method ji r (I)V
L432:    goto L435
L435:    iconst_m1
L436:    ireturn
L437:    iinc 2 -1
L440:    iconst_0
L441:    iload_2
L442:    if_icmple L450
L445:    iinc 2 3
L448:    iload_2
L449:    ireturn
L450:    iload_2
L451:    ireturn
L452:    bipush -7
L454:    aload_0
L455:    getfield Field ji c I
L458:    iconst_m1
L459:    ixor
L460:    if_icmpne L559
L463:    iconst_2
L464:    iload_2
L465:    if_icmpgt L543
L468:    aload_0
L469:    getfield Field ji c I
L472:    iconst_m1
L473:    ixor
L474:    bipush -20
L476:    if_icmpeq L482
L479:    goto L527
L482:    getstatic Field uc e [[I
L485:    aload_0
L486:    getfield Field ji c I
L489:    aaload
L490:    getstatic Field fa c [I
L493:    if_acmpeq L501
L496:    bipush 20
L498:    goto L503
L501:    bipush 30
L503:    istore 4
L505:    iload_2
L506:    iconst_m1
L507:    ixor
L508:    bipush -11
L510:    if_icmpgt L527
L513:    iload_2
L514:    iload 4
L516:    if_icmplt L522
L519:    goto L527
L522:    iload_2
L523:    bipush 10
L525:    isub
L526:    ireturn
L527:    iload_1
L528:    bipush -20
L530:    if_icmpeq L541
L533:    aload_0
L534:    iconst_1
L535:    invokevirtual Method ji r (I)V
L538:    goto L541
L541:    iconst_m1
L542:    ireturn
L543:    iinc 2 -1
L546:    iconst_0
L547:    iload_2
L548:    if_icmpgt L554
L551:    goto L557
L554:    iinc 2 2
L557:    iload_2
L558:    ireturn
L559:    aload_0
L560:    getfield Field ji c I
L563:    iconst_m1
L564:    ixor
L565:    bipush -20
L567:    if_icmpeq L586
L570:    iload_1
L571:    bipush -20
L573:    if_icmpeq L584
L576:    aload_0
L577:    iconst_1
L578:    invokevirtual Method ji r (I)V
L581:    goto L584
L584:    iconst_m1
L585:    ireturn
L586:    getstatic Field uc e [[I
L589:    aload_0
L590:    getfield Field ji c I
L593:    aaload
L594:    getstatic Field fa c [I
L597:    if_acmpeq L605
L600:    bipush 20
L602:    goto L607
L605:    bipush 30
L607:    istore 4
L609:    iload_2
L610:    iconst_m1
L611:    ixor
L612:    bipush -11
L614:    if_icmpgt L644
L617:    iload_2
L618:    iload 4
L620:    if_icmplt L639
L623:    iload_1
L624:    bipush -20
L626:    if_icmpeq L637
L629:    aload_0
L630:    iconst_1
L631:    invokevirtual Method ji r (I)V
L634:    goto L637
L637:    iconst_m1
L638:    ireturn
L639:    iload_2
L640:    bipush 10
L642:    isub
L643:    ireturn
L644:    iload_1
L645:    bipush -20
L647:    if_icmpeq L657
L650:    aload_0
L651:    iconst_1
L652:    invokevirtual Method ji r (I)V
L655:    iconst_m1
L656:    ireturn
L657:    iconst_m1
L658:    ireturn
L659:    iload_2
L660:    iconst_m1
L661:    ixor
L662:    getstatic Field uc e [[I
L665:    aload_0
L666:    getfield Field ji c I
L669:    aaload
L670:    arraylength
L671:    iconst_m1
L672:    ixor
L673:    if_icmpgt L1302
L676:    aload_0
L677:    iload_1
L678:    bipush 105
L680:    ixor
L681:    iload_2
L682:    invokespecial Method ji b (II)I
L685:    istore_3
L686:    iconst_m1
L687:    iload_2
L688:    iconst_m1
L689:    ixor
L690:    if_icmplt L724
L693:    getstatic Field uc e [[I
L696:    aload_0
L697:    getfield Field ji c I
L700:    aaload
L701:    arraylength
L702:    iload_2
L703:    if_icmple L724
L706:    getstatic Field uc e [[I
L709:    aload_0
L710:    getfield Field ji c I
L713:    aaload
L714:    iload_2
L715:    iaload
L716:    iconst_m1
L717:    ixor
L718:    ifeq L724
L721:    goto L762
L724:    getstatic Field uc e [[I
L727:    aload_0
L728:    getfield Field ji c I
L731:    aaload
L732:    arraylength
L733:    iconst_1
L734:    isub
L735:    istore_2
L736:    iload_2
L737:    iflt L760
L740:    iconst_m1
L741:    getstatic Field uc e [[I
L744:    aload_0
L745:    getfield Field ji c I
L748:    aaload
L749:    iload_2
L750:    iaload
L751:    if_icmpne L760
L754:    iinc 2 -1
L757:    goto L736
L760:    iload_2
L761:    ireturn
L762:    iconst_0
L763:    aload_0
L764:    getfield Field ji c I
L767:    if_icmpeq L773
L770:    goto L831
L773:    getstatic Field uc e [[I
L776:    aload_0
L777:    getfield Field ji c I
L780:    aaload
L781:    iload_2
L782:    iaload
L783:    bipush 34
L785:    if_icmpeq L829
L788:    getstatic Field uc e [[I
L791:    aload_0
L792:    getfield Field ji c I
L795:    aaload
L796:    iconst_m1
L797:    getstatic Field uc e [[I
L800:    aload_0
L801:    getfield Field ji c I
L804:    aaload
L805:    arraylength
L806:    iadd
L807:    iaload
L808:    bipush 34
L810:    if_icmpne L829
L813:    iload_2
L814:    putstatic Field dh F I
L817:    iconst_m1
L818:    getstatic Field uc e [[I
L821:    aload_0
L822:    getfield Field ji c I
L825:    aaload
L826:    arraylength
L827:    iadd
L828:    ireturn
L829:    iload_2
L830:    ireturn
L831:    aload_0
L832:    getfield Field ji c I
L835:    bipush 20
L837:    if_icmpne L851
L840:    iload_2
L841:    iflt L851
L844:    iconst_3
L845:    iload_2
L846:    if_icmple L851
L849:    iconst_0
L850:    ireturn
L851:    iload_3
L852:    iflt L957
L855:    iinc 3 -1
L858:    iinc 2 -1
L861:    iconst_0
L862:    iload_3
L863:    if_icmpgt L893
L866:    iconst_m1
L867:    getstatic Field uc e [[I
L870:    aload_0
L871:    getfield Field ji c I
L874:    aaload
L875:    iload_2
L876:    iaload
L877:    if_icmpne L955
L880:    iinc 2 -1
L883:    iinc 3 -1
L886:    iload_3
L887:    iflt L2853
L890:    goto L2859
L893:    iinc 3 4
L896:    iinc 2 4
L899:    goto L902
L902:    iconst_m1
L903:    getstatic Field uc e [[I
L906:    aload_0
L907:    getfield Field ji c I
L910:    aaload
L911:    iload_2
L912:    iaload
L913:    if_icmpne L955
L916:    iinc 2 -1
L919:    iinc 3 -1
L922:    iload_3
L923:    iflt L929
L926:    goto L935
L929:    iinc 2 4
L932:    iinc 3 4
L935:    iload_2
L936:    iconst_m1
L937:    ixor
L938:    aload_0
L939:    getfield Field ji g Lrm;
L942:    getfield Field rm e I
L945:    iconst_m1
L946:    ixor
L947:    if_icmpeq L953
L950:    goto L902
L953:    iload_2
L954:    ireturn
L955:    iload_2
L956:    ireturn
L957:    iconst_5
L958:    aload_0
L959:    getfield Field ji c I
L962:    if_icmpne L1095
L965:    iload_2
L966:    iconst_3
L967:    if_icmplt L1080
L970:    bipush -7
L972:    aload_0
L973:    getfield Field ji c I
L976:    iconst_m1
L977:    ixor
L978:    if_icmpne L1005
L981:    iconst_2
L982:    iload_2
L983:    if_icmpgt L989
L986:    goto L1005
L989:    iinc 2 -1
L992:    iconst_0
L993:    iload_2
L994:    if_icmpgt L1000
L997:    goto L1003
L1000:    iinc 2 2
L1003:    iload_2
L1004:    ireturn
L1005:    aload_0
L1006:    getfield Field ji c I
L1009:    iconst_m1
L1010:    ixor
L1011:    bipush -20
L1013:    if_icmpeq L1019
L1016:    goto L1064
L1019:    getstatic Field uc e [[I
L1022:    aload_0
L1023:    getfield Field ji c I
L1026:    aaload
L1027:    getstatic Field fa c [I
L1030:    if_acmpeq L1038
L1033:    bipush 20
L1035:    goto L1040
L1038:    bipush 30
L1040:    istore 4
L1042:    iload_2
L1043:    iconst_m1
L1044:    ixor
L1045:    bipush -11
L1047:    if_icmpgt L1064
L1050:    iload_2
L1051:    iload 4
L1053:    if_icmplt L1059
L1056:    goto L1064
L1059:    iload_2
L1060:    bipush 10
L1062:    isub
L1063:    ireturn
L1064:    iload_1
L1065:    bipush -20
L1067:    if_icmpeq L1078
L1070:    aload_0
L1071:    iconst_1
L1072:    invokevirtual Method ji r (I)V
L1075:    goto L1078
L1078:    iconst_m1
L1079:    ireturn
L1080:    iinc 2 -1
L1083:    iconst_0
L1084:    iload_2
L1085:    if_icmple L1093
L1088:    iinc 2 3
L1091:    iload_2
L1092:    ireturn
L1093:    iload_2
L1094:    ireturn
L1095:    bipush -7
L1097:    aload_0
L1098:    getfield Field ji c I
L1101:    iconst_m1
L1102:    ixor
L1103:    if_icmpne L1202
L1106:    iconst_2
L1107:    iload_2
L1108:    if_icmpgt L1186
L1111:    aload_0
L1112:    getfield Field ji c I
L1115:    iconst_m1
L1116:    ixor
L1117:    bipush -20
L1119:    if_icmpeq L1125
L1122:    goto L1170
L1125:    getstatic Field uc e [[I
L1128:    aload_0
L1129:    getfield Field ji c I
L1132:    aaload
L1133:    getstatic Field fa c [I
L1136:    if_acmpeq L1144
L1139:    bipush 20
L1141:    goto L1146
L1144:    bipush 30
L1146:    istore 4
L1148:    iload_2
L1149:    iconst_m1
L1150:    ixor
L1151:    bipush -11
L1153:    if_icmpgt L1170
L1156:    iload_2
L1157:    iload 4
L1159:    if_icmplt L1165
L1162:    goto L1170
L1165:    iload_2
L1166:    bipush 10
L1168:    isub
L1169:    ireturn
L1170:    iload_1
L1171:    bipush -20
L1173:    if_icmpeq L1184
L1176:    aload_0
L1177:    iconst_1
L1178:    invokevirtual Method ji r (I)V
L1181:    goto L1184
L1184:    iconst_m1
L1185:    ireturn
L1186:    iinc 2 -1
L1189:    iconst_0
L1190:    iload_2
L1191:    if_icmpgt L1197
L1194:    goto L1200
L1197:    iinc 2 2
L1200:    iload_2
L1201:    ireturn
L1202:    aload_0
L1203:    getfield Field ji c I
L1206:    iconst_m1
L1207:    ixor
L1208:    bipush -20
L1210:    if_icmpeq L1229
L1213:    iload_1
L1214:    bipush -20
L1216:    if_icmpeq L1227
L1219:    aload_0
L1220:    iconst_1
L1221:    invokevirtual Method ji r (I)V
L1224:    goto L1227
L1227:    iconst_m1
L1228:    ireturn
L1229:    getstatic Field uc e [[I
L1232:    aload_0
L1233:    getfield Field ji c I
L1236:    aaload
L1237:    getstatic Field fa c [I
L1240:    if_acmpeq L1248
L1243:    bipush 20
L1245:    goto L1250
L1248:    bipush 30
L1250:    istore 4
L1252:    iload_2
L1253:    iconst_m1
L1254:    ixor
L1255:    bipush -11
L1257:    if_icmpgt L1287
L1260:    iload_2
L1261:    iload 4
L1263:    if_icmplt L1282
L1266:    iload_1
L1267:    bipush -20
L1269:    if_icmpeq L1280
L1272:    aload_0
L1273:    iconst_1
L1274:    invokevirtual Method ji r (I)V
L1277:    goto L1280
L1280:    iconst_m1
L1281:    ireturn
L1282:    iload_2
L1283:    bipush 10
L1285:    isub
L1286:    ireturn
L1287:    iload_1
L1288:    bipush -20
L1290:    if_icmpeq L1300
L1293:    aload_0
L1294:    iconst_1
L1295:    invokevirtual Method ji r (I)V
L1298:    iconst_m1
L1299:    ireturn
L1300:    iconst_m1
L1301:    ireturn
L1302:    aload_0
L1303:    iload_1
L1304:    bipush 105
L1306:    ixor
L1307:    iload_2
L1308:    invokespecial Method ji b (II)I
L1311:    istore_3
L1312:    iconst_m1
L1313:    iload_2
L1314:    iconst_m1
L1315:    ixor
L1316:    if_icmplt L1350
L1319:    getstatic Field uc e [[I
L1322:    aload_0
L1323:    getfield Field ji c I
L1326:    aaload
L1327:    arraylength
L1328:    iload_2
L1329:    if_icmple L1350
L1332:    getstatic Field uc e [[I
L1335:    aload_0
L1336:    getfield Field ji c I
L1339:    aaload
L1340:    iload_2
L1341:    iaload
L1342:    iconst_m1
L1343:    ixor
L1344:    ifeq L1350
L1347:    goto L1388
L1350:    getstatic Field uc e [[I
L1353:    aload_0
L1354:    getfield Field ji c I
L1357:    aaload
L1358:    arraylength
L1359:    iconst_1
L1360:    isub
L1361:    istore_2
L1362:    iload_2
L1363:    iflt L1386
L1366:    iconst_m1
L1367:    getstatic Field uc e [[I
L1370:    aload_0
L1371:    getfield Field ji c I
L1374:    aaload
L1375:    iload_2
L1376:    iaload
L1377:    if_icmpne L1386
L1380:    iinc 2 -1
L1383:    goto L1362
L1386:    iload_2
L1387:    ireturn
L1388:    iconst_0
L1389:    aload_0
L1390:    getfield Field ji c I
L1393:    if_icmpeq L1399
L1396:    goto L1457
L1399:    getstatic Field uc e [[I
L1402:    aload_0
L1403:    getfield Field ji c I
L1406:    aaload
L1407:    iload_2
L1408:    iaload
L1409:    bipush 34
L1411:    if_icmpeq L1455
L1414:    getstatic Field uc e [[I
L1417:    aload_0
L1418:    getfield Field ji c I
L1421:    aaload
L1422:    iconst_m1
L1423:    getstatic Field uc e [[I
L1426:    aload_0
L1427:    getfield Field ji c I
L1430:    aaload
L1431:    arraylength
L1432:    iadd
L1433:    iaload
L1434:    bipush 34
L1436:    if_icmpne L1455
L1439:    iload_2
L1440:    putstatic Field dh F I
L1443:    iconst_m1
L1444:    getstatic Field uc e [[I
L1447:    aload_0
L1448:    getfield Field ji c I
L1451:    aaload
L1452:    arraylength
L1453:    iadd
L1454:    ireturn
L1455:    iload_2
L1456:    ireturn
L1457:    aload_0
L1458:    getfield Field ji c I
L1461:    bipush 20
L1463:    if_icmpeq L2132
L1466:    iload_3
L1467:    iflt L1648
L1470:    iinc 3 -1
L1473:    iinc 2 -1
L1476:    iconst_0
L1477:    iload_3
L1478:    if_icmpgt L1532
L1481:    iconst_m1
L1482:    getstatic Field uc e [[I
L1485:    aload_0
L1486:    getfield Field ji c I
L1489:    aaload
L1490:    iload_2
L1491:    iaload
L1492:    if_icmpne L1646
L1495:    iinc 2 -1
L1498:    iinc 3 -1
L1501:    iload_3
L1502:    iflt L1508
L1505:    goto L1514
L1508:    iinc 2 4
L1511:    iinc 3 4
L1514:    iload_2
L1515:    iconst_m1
L1516:    ixor
L1517:    aload_0
L1518:    getfield Field ji g Lrm;
L1521:    getfield Field rm e I
L1524:    iconst_m1
L1525:    ixor
L1526:    if_icmpeq L1644
L1529:    goto L1481
L1532:    iinc 3 4
L1535:    iinc 2 4
L1538:    iconst_m1
L1539:    getstatic Field uc e [[I
L1542:    aload_0
L1543:    getfield Field ji c I
L1546:    aaload
L1547:    iload_2
L1548:    iaload
L1549:    if_icmpne L1591
L1552:    iinc 2 -1
L1555:    iinc 3 -1
L1558:    iload_3
L1559:    iflt L1565
L1562:    goto L1571
L1565:    iinc 2 4
L1568:    iinc 3 4
L1571:    iload_2
L1572:    iconst_m1
L1573:    ixor
L1574:    aload_0
L1575:    getfield Field ji g Lrm;
L1578:    getfield Field rm e I
L1581:    iconst_m1
L1582:    ixor
L1583:    if_icmpeq L1589
L1586:    goto L1538
L1589:    iload_2
L1590:    ireturn
L1591:    iload_2
L1592:    ireturn
L1593:    iconst_m1
L1594:    getstatic Field uc e [[I
L1597:    aload_0
L1598:    getfield Field ji c I
L1601:    aaload
L1602:    iload_2
L1603:    iaload
L1604:    if_icmpne L1646
L1607:    iinc 2 -1
L1610:    iinc 3 -1
L1613:    iload_3
L1614:    iflt L1620
L1617:    goto L1626
L1620:    iinc 2 4
L1623:    iinc 3 4
L1626:    iload_2
L1627:    iconst_m1
L1628:    ixor
L1629:    aload_0
L1630:    getfield Field ji g Lrm;
L1633:    getfield Field rm e I
L1636:    iconst_m1
L1637:    ixor
L1638:    if_icmpeq L1644
L1641:    goto L1593
L1644:    iload_2
L1645:    ireturn
L1646:    iload_2
L1647:    ireturn
L1648:    iconst_5
L1649:    aload_0
L1650:    getfield Field ji c I
L1653:    if_icmpne L1904
L1656:    iload_2
L1657:    iconst_3
L1658:    if_icmplt L1889
L1661:    bipush -7
L1663:    aload_0
L1664:    getfield Field ji c I
L1667:    iconst_m1
L1668:    ixor
L1669:    if_icmpne L1791
L1672:    iconst_2
L1673:    iload_2
L1674:    if_icmpgt L1775
L1677:    aload_0
L1678:    getfield Field ji c I
L1681:    iconst_m1
L1682:    ixor
L1683:    bipush -20
L1685:    if_icmpeq L1703
L1688:    iload_1
L1689:    bipush -20
L1691:    if_icmpeq L1701
L1694:    aload_0
L1695:    iconst_1
L1696:    invokevirtual Method ji r (I)V
L1699:    iconst_m1
L1700:    ireturn
L1701:    iconst_m1
L1702:    ireturn
L1703:    getstatic Field uc e [[I
L1706:    aload_0
L1707:    getfield Field ji c I
L1710:    aaload
L1711:    getstatic Field fa c [I
L1714:    if_acmpeq L1722
L1717:    bipush 20
L1719:    goto L1724
L1722:    bipush 30
L1724:    istore 4
L1726:    iload_2
L1727:    iconst_m1
L1728:    ixor
L1729:    bipush -11
L1731:    if_icmpgt L1760
L1734:    iload_2
L1735:    iload 4
L1737:    if_icmplt L1755
L1740:    iload_1
L1741:    bipush -20
L1743:    if_icmpeq L1753
L1746:    aload_0
L1747:    iconst_1
L1748:    invokevirtual Method ji r (I)V
L1751:    iconst_m1
L1752:    ireturn
L1753:    iconst_m1
L1754:    ireturn
L1755:    iload_2
L1756:    bipush 10
L1758:    isub
L1759:    ireturn
L1760:    iload_1
L1761:    bipush -20
L1763:    if_icmpeq L1773
L1766:    aload_0
L1767:    iconst_1
L1768:    invokevirtual Method ji r (I)V
L1771:    iconst_m1
L1772:    ireturn
L1773:    iconst_m1
L1774:    ireturn
L1775:    iinc 2 -1
L1778:    iconst_0
L1779:    iload_2
L1780:    if_icmpgt L1786
L1783:    goto L1789
L1786:    iinc 2 2
L1789:    iload_2
L1790:    ireturn
L1791:    aload_0
L1792:    getfield Field ji c I
L1795:    iconst_m1
L1796:    ixor
L1797:    bipush -20
L1799:    if_icmpeq L1817
L1802:    iload_1
L1803:    bipush -20
L1805:    if_icmpeq L1815
L1808:    aload_0
L1809:    iconst_1
L1810:    invokevirtual Method ji r (I)V
L1813:    iconst_m1
L1814:    ireturn
L1815:    iconst_m1
L1816:    ireturn
L1817:    getstatic Field uc e [[I
L1820:    aload_0
L1821:    getfield Field ji c I
L1824:    aaload
L1825:    getstatic Field fa c [I
L1828:    if_acmpeq L1836
L1831:    bipush 20
L1833:    goto L1838
L1836:    bipush 30
L1838:    istore 4
L1840:    iload_2
L1841:    iconst_m1
L1842:    ixor
L1843:    bipush -11
L1845:    if_icmpgt L1874
L1848:    iload_2
L1849:    iload 4
L1851:    if_icmplt L1869
L1854:    iload_1
L1855:    bipush -20
L1857:    if_icmpeq L1867
L1860:    aload_0
L1861:    iconst_1
L1862:    invokevirtual Method ji r (I)V
L1865:    iconst_m1
L1866:    ireturn
L1867:    iconst_m1
L1868:    ireturn
L1869:    iload_2
L1870:    bipush 10
L1872:    isub
L1873:    ireturn
L1874:    iload_1
L1875:    bipush -20
L1877:    if_icmpeq L1887
L1880:    aload_0
L1881:    iconst_1
L1882:    invokevirtual Method ji r (I)V
L1885:    iconst_m1
L1886:    ireturn
L1887:    iconst_m1
L1888:    ireturn
L1889:    iinc 2 -1
L1892:    iconst_0
L1893:    iload_2
L1894:    if_icmple L1902
L1897:    iinc 2 3
L1900:    iload_2
L1901:    ireturn
L1902:    iload_2
L1903:    ireturn
L1904:    bipush -7
L1906:    aload_0
L1907:    getfield Field ji c I
L1910:    iconst_m1
L1911:    ixor
L1912:    if_icmpne L2034
L1915:    iconst_2
L1916:    iload_2
L1917:    if_icmpgt L2018
L1920:    aload_0
L1921:    getfield Field ji c I
L1924:    iconst_m1
L1925:    ixor
L1926:    bipush -20
L1928:    if_icmpeq L1946
L1931:    iload_1
L1932:    bipush -20
L1934:    if_icmpeq L1944
L1937:    aload_0
L1938:    iconst_1
L1939:    invokevirtual Method ji r (I)V
L1942:    iconst_m1
L1943:    ireturn
L1944:    iconst_m1
L1945:    ireturn
L1946:    getstatic Field uc e [[I
L1949:    aload_0
L1950:    getfield Field ji c I
L1953:    aaload
L1954:    getstatic Field fa c [I
L1957:    if_acmpeq L1965
L1960:    bipush 20
L1962:    goto L1967
L1965:    bipush 30
L1967:    istore 4
L1969:    iload_2
L1970:    iconst_m1
L1971:    ixor
L1972:    bipush -11
L1974:    if_icmpgt L2003
L1977:    iload_2
L1978:    iload 4
L1980:    if_icmplt L1998
L1983:    iload_1
L1984:    bipush -20
L1986:    if_icmpeq L1996
L1989:    aload_0
L1990:    iconst_1
L1991:    invokevirtual Method ji r (I)V
L1994:    iconst_m1
L1995:    ireturn
L1996:    iconst_m1
L1997:    ireturn
L1998:    iload_2
L1999:    bipush 10
L2001:    isub
L2002:    ireturn
L2003:    iload_1
L2004:    bipush -20
L2006:    if_icmpeq L2016
L2009:    aload_0
L2010:    iconst_1
L2011:    invokevirtual Method ji r (I)V
L2014:    iconst_m1
L2015:    ireturn
L2016:    iconst_m1
L2017:    ireturn
L2018:    iinc 2 -1
L2021:    iconst_0
L2022:    iload_2
L2023:    if_icmpgt L2029
L2026:    goto L2032
L2029:    iinc 2 2
L2032:    iload_2
L2033:    ireturn
L2034:    aload_0
L2035:    getfield Field ji c I
L2038:    iconst_m1
L2039:    ixor
L2040:    bipush -20
L2042:    if_icmpeq L2060
L2045:    iload_1
L2046:    bipush -20
L2048:    if_icmpeq L2058
L2051:    aload_0
L2052:    iconst_1
L2053:    invokevirtual Method ji r (I)V
L2056:    iconst_m1
L2057:    ireturn
L2058:    iconst_m1
L2059:    ireturn
L2060:    getstatic Field uc e [[I
L2063:    aload_0
L2064:    getfield Field ji c I
L2067:    aaload
L2068:    getstatic Field fa c [I
L2071:    if_acmpeq L2079
L2074:    bipush 20
L2076:    goto L2081
L2079:    bipush 30
L2081:    istore 4
L2083:    iload_2
L2084:    iconst_m1
L2085:    ixor
L2086:    bipush -11
L2088:    if_icmpgt L2117
L2091:    iload_2
L2092:    iload 4
L2094:    if_icmplt L2112
L2097:    iload_1
L2098:    bipush -20
L2100:    if_icmpeq L2110
L2103:    aload_0
L2104:    iconst_1
L2105:    invokevirtual Method ji r (I)V
L2108:    iconst_m1
L2109:    ireturn
L2110:    iconst_m1
L2111:    ireturn
L2112:    iload_2
L2113:    bipush 10
L2115:    isub
L2116:    ireturn
L2117:    iload_1
L2118:    bipush -20
L2120:    if_icmpeq L2130
L2123:    aload_0
L2124:    iconst_1
L2125:    invokevirtual Method ji r (I)V
L2128:    iconst_m1
L2129:    ireturn
L2130:    iconst_m1
L2131:    ireturn
L2132:    iload_2
L2133:    ifge L2802
L2136:    iload_3
L2137:    iflt L2318
L2140:    iinc 3 -1
L2143:    iinc 2 -1
L2146:    iconst_0
L2147:    iload_3
L2148:    if_icmpgt L2202
L2151:    iconst_m1
L2152:    getstatic Field uc e [[I
L2155:    aload_0
L2156:    getfield Field ji c I
L2159:    aaload
L2160:    iload_2
L2161:    iaload
L2162:    if_icmpne L2316
L2165:    iinc 2 -1
L2168:    iinc 3 -1
L2171:    iload_3
L2172:    iflt L2178
L2175:    goto L2184
L2178:    iinc 2 4
L2181:    iinc 3 4
L2184:    iload_2
L2185:    iconst_m1
L2186:    ixor
L2187:    aload_0
L2188:    getfield Field ji g Lrm;
L2191:    getfield Field rm e I
L2194:    iconst_m1
L2195:    ixor
L2196:    if_icmpeq L2314
L2199:    goto L2151
L2202:    iinc 3 4
L2205:    iinc 2 4
L2208:    iconst_m1
L2209:    getstatic Field uc e [[I
L2212:    aload_0
L2213:    getfield Field ji c I
L2216:    aaload
L2217:    iload_2
L2218:    iaload
L2219:    if_icmpne L2261
L2222:    iinc 2 -1
L2225:    iinc 3 -1
L2228:    iload_3
L2229:    iflt L2235
L2232:    goto L2241
L2235:    iinc 2 4
L2238:    iinc 3 4
L2241:    iload_2
L2242:    iconst_m1
L2243:    ixor
L2244:    aload_0
L2245:    getfield Field ji g Lrm;
L2248:    getfield Field rm e I
L2251:    iconst_m1
L2252:    ixor
L2253:    if_icmpeq L2259
L2256:    goto L2208
L2259:    iload_2
L2260:    ireturn
L2261:    iload_2
L2262:    ireturn
L2263:    iconst_m1
L2264:    getstatic Field uc e [[I
L2267:    aload_0
L2268:    getfield Field ji c I
L2271:    aaload
L2272:    iload_2
L2273:    iaload
L2274:    if_icmpne L2316
L2277:    iinc 2 -1
L2280:    iinc 3 -1
L2283:    iload_3
L2284:    iflt L2290
L2287:    goto L2296
L2290:    iinc 2 4
L2293:    iinc 3 4
L2296:    iload_2
L2297:    iconst_m1
L2298:    ixor
L2299:    aload_0
L2300:    getfield Field ji g Lrm;
L2303:    getfield Field rm e I
L2306:    iconst_m1
L2307:    ixor
L2308:    if_icmpeq L2314
L2311:    goto L2263
L2314:    iload_2
L2315:    ireturn
L2316:    iload_2
L2317:    ireturn
L2318:    iconst_5
L2319:    aload_0
L2320:    getfield Field ji c I
L2323:    if_icmpne L2574
L2326:    iload_2
L2327:    iconst_3
L2328:    if_icmplt L2559
L2331:    bipush -7
L2333:    aload_0
L2334:    getfield Field ji c I
L2337:    iconst_m1
L2338:    ixor
L2339:    if_icmpne L2461
L2342:    iconst_2
L2343:    iload_2
L2344:    if_icmpgt L2445
L2347:    aload_0
L2348:    getfield Field ji c I
L2351:    iconst_m1
L2352:    ixor
L2353:    bipush -20
L2355:    if_icmpeq L2373
L2358:    iload_1
L2359:    bipush -20
L2361:    if_icmpeq L2371
L2364:    aload_0
L2365:    iconst_1
L2366:    invokevirtual Method ji r (I)V
L2369:    iconst_m1
L2370:    ireturn
L2371:    iconst_m1
L2372:    ireturn
L2373:    getstatic Field uc e [[I
L2376:    aload_0
L2377:    getfield Field ji c I
L2380:    aaload
L2381:    getstatic Field fa c [I
L2384:    if_acmpeq L2392
L2387:    bipush 20
L2389:    goto L2394
L2392:    bipush 30
L2394:    istore 4
L2396:    iload_2
L2397:    iconst_m1
L2398:    ixor
L2399:    bipush -11
L2401:    if_icmpgt L2430
L2404:    iload_2
L2405:    iload 4
L2407:    if_icmplt L2425
L2410:    iload_1
L2411:    bipush -20
L2413:    if_icmpeq L2423
L2416:    aload_0
L2417:    iconst_1
L2418:    invokevirtual Method ji r (I)V
L2421:    iconst_m1
L2422:    ireturn
L2423:    iconst_m1
L2424:    ireturn
L2425:    iload_2
L2426:    bipush 10
L2428:    isub
L2429:    ireturn
L2430:    iload_1
L2431:    bipush -20
L2433:    if_icmpeq L2443
L2436:    aload_0
L2437:    iconst_1
L2438:    invokevirtual Method ji r (I)V
L2441:    iconst_m1
L2442:    ireturn
L2443:    iconst_m1
L2444:    ireturn
L2445:    iinc 2 -1
L2448:    iconst_0
L2449:    iload_2
L2450:    if_icmpgt L2456
L2453:    goto L2459
L2456:    iinc 2 2
L2459:    iload_2
L2460:    ireturn
L2461:    aload_0
L2462:    getfield Field ji c I
L2465:    iconst_m1
L2466:    ixor
L2467:    bipush -20
L2469:    if_icmpeq L2487
L2472:    iload_1
L2473:    bipush -20
L2475:    if_icmpeq L2485
L2478:    aload_0
L2479:    iconst_1
L2480:    invokevirtual Method ji r (I)V
L2483:    iconst_m1
L2484:    ireturn
L2485:    iconst_m1
L2486:    ireturn
L2487:    getstatic Field uc e [[I
L2490:    aload_0
L2491:    getfield Field ji c I
L2494:    aaload
L2495:    getstatic Field fa c [I
L2498:    if_acmpeq L2506
L2501:    bipush 20
L2503:    goto L2508
L2506:    bipush 30
L2508:    istore 4
L2510:    iload_2
L2511:    iconst_m1
L2512:    ixor
L2513:    bipush -11
L2515:    if_icmpgt L2544
L2518:    iload_2
L2519:    iload 4
L2521:    if_icmplt L2539
L2524:    iload_1
L2525:    bipush -20
L2527:    if_icmpeq L2537
L2530:    aload_0
L2531:    iconst_1
L2532:    invokevirtual Method ji r (I)V
L2535:    iconst_m1
L2536:    ireturn
L2537:    iconst_m1
L2538:    ireturn
L2539:    iload_2
L2540:    bipush 10
L2542:    isub
L2543:    ireturn
L2544:    iload_1
L2545:    bipush -20
L2547:    if_icmpeq L2557
L2550:    aload_0
L2551:    iconst_1
L2552:    invokevirtual Method ji r (I)V
L2555:    iconst_m1
L2556:    ireturn
L2557:    iconst_m1
L2558:    ireturn
L2559:    iinc 2 -1
L2562:    iconst_0
L2563:    iload_2
L2564:    if_icmple L2572
L2567:    iinc 2 3
L2570:    iload_2
L2571:    ireturn
L2572:    iload_2
L2573:    ireturn
L2574:    bipush -7
L2576:    aload_0
L2577:    getfield Field ji c I
L2580:    iconst_m1
L2581:    ixor
L2582:    if_icmpne L2704
L2585:    iconst_2
L2586:    iload_2
L2587:    if_icmpgt L2688
L2590:    aload_0
L2591:    getfield Field ji c I
L2594:    iconst_m1
L2595:    ixor
L2596:    bipush -20
L2598:    if_icmpeq L2616
L2601:    iload_1
L2602:    bipush -20
L2604:    if_icmpeq L2614
L2607:    aload_0
L2608:    iconst_1
L2609:    invokevirtual Method ji r (I)V
L2612:    iconst_m1
L2613:    ireturn
L2614:    iconst_m1
L2615:    ireturn
L2616:    getstatic Field uc e [[I
L2619:    aload_0
L2620:    getfield Field ji c I
L2623:    aaload
L2624:    getstatic Field fa c [I
L2627:    if_acmpeq L2635
L2630:    bipush 20
L2632:    goto L2637
L2635:    bipush 30
L2637:    istore 4
L2639:    iload_2
L2640:    iconst_m1
L2641:    ixor
L2642:    bipush -11
L2644:    if_icmpgt L2673
L2647:    iload_2
L2648:    iload 4
L2650:    if_icmplt L2668
L2653:    iload_1
L2654:    bipush -20
L2656:    if_icmpeq L2666
L2659:    aload_0
L2660:    iconst_1
L2661:    invokevirtual Method ji r (I)V
L2664:    iconst_m1
L2665:    ireturn
L2666:    iconst_m1
L2667:    ireturn
L2668:    iload_2
L2669:    bipush 10
L2671:    isub
L2672:    ireturn
L2673:    iload_1
L2674:    bipush -20
L2676:    if_icmpeq L2686
L2679:    aload_0
L2680:    iconst_1
L2681:    invokevirtual Method ji r (I)V
L2684:    iconst_m1
L2685:    ireturn
L2686:    iconst_m1
L2687:    ireturn
L2688:    iinc 2 -1
L2691:    iconst_0
L2692:    iload_2
L2693:    if_icmpgt L2699
L2696:    goto L2702
L2699:    iinc 2 2
L2702:    iload_2
L2703:    ireturn
L2704:    aload_0
L2705:    getfield Field ji c I
L2708:    iconst_m1
L2709:    ixor
L2710:    bipush -20
L2712:    if_icmpeq L2730
L2715:    iload_1
L2716:    bipush -20
L2718:    if_icmpeq L2728
L2721:    aload_0
L2722:    iconst_1
L2723:    invokevirtual Method ji r (I)V
L2726:    iconst_m1
L2727:    ireturn
L2728:    iconst_m1
L2729:    ireturn
L2730:    getstatic Field uc e [[I
L2733:    aload_0
L2734:    getfield Field ji c I
L2737:    aaload
L2738:    getstatic Field fa c [I
L2741:    if_acmpeq L2749
L2744:    bipush 20
L2746:    goto L2751
L2749:    bipush 30
L2751:    istore 4
L2753:    iload_2
L2754:    iconst_m1
L2755:    ixor
L2756:    bipush -11
L2758:    if_icmpgt L2787
L2761:    iload_2
L2762:    iload 4
L2764:    if_icmplt L2782
L2767:    iload_1
L2768:    bipush -20
L2770:    if_icmpeq L2780
L2773:    aload_0
L2774:    iconst_1
L2775:    invokevirtual Method ji r (I)V
L2778:    iconst_m1
L2779:    ireturn
L2780:    iconst_m1
L2781:    ireturn
L2782:    iload_2
L2783:    bipush 10
L2785:    isub
L2786:    ireturn
L2787:    iload_1
L2788:    bipush -20
L2790:    if_icmpeq L2800
L2793:    aload_0
L2794:    iconst_1
L2795:    invokevirtual Method ji r (I)V
L2798:    iconst_m1
L2799:    ireturn
L2800:    iconst_m1
L2801:    ireturn
L2802:    iconst_3
L2803:    iload_2
L2804:    if_icmple L2809
L2807:    iconst_0
L2808:    ireturn
L2809:    iload_3
L2810:    iflt L2992
L2813:    iinc 3 -1
L2816:    iinc 2 -1
L2819:    iconst_0
L2820:    iload_3
L2821:    if_icmpgt L2876
L2824:    iconst_m1
L2825:    getstatic Field uc e [[I
L2828:    aload_0
L2829:    getfield Field ji c I
L2832:    aaload
L2833:    iload_2
L2834:    iaload
L2835:    if_icmpeq L2840
L2838:    iload_2
L2839:    ireturn
L2840:    iinc 2 -1
L2843:    iinc 3 -1
L2846:    iload_3
L2847:    iflt L2853
L2850:    goto L2859
L2853:    iinc 2 4
L2856:    iinc 3 4
L2859:    iload_2
L2860:    iconst_m1
L2861:    ixor
L2862:    aload_0
L2863:    getfield Field ji g Lrm;
L2866:    getfield Field rm e I
L2869:    iconst_m1
L2870:    ixor
L2871:    if_icmpne L2824
L2874:    iload_2
L2875:    ireturn
L2876:    iinc 3 4
L2879:    iinc 2 4
L2882:    iconst_m1
L2883:    getstatic Field uc e [[I
L2886:    aload_0
L2887:    getfield Field ji c I
L2890:    aaload
L2891:    iload_2
L2892:    iaload
L2893:    if_icmpne L2935
L2896:    iinc 2 -1
L2899:    iinc 3 -1
L2902:    iload_3
L2903:    iflt L2909
L2906:    goto L2915
L2909:    iinc 2 4
L2912:    iinc 3 4
L2915:    iload_2
L2916:    iconst_m1
L2917:    ixor
L2918:    aload_0
L2919:    getfield Field ji g Lrm;
L2922:    getfield Field rm e I
L2925:    iconst_m1
L2926:    ixor
L2927:    if_icmpeq L2933
L2930:    goto L2882
L2933:    iload_2
L2934:    ireturn
L2935:    iload_2
L2936:    ireturn
L2937:    iconst_m1
L2938:    getstatic Field uc e [[I
L2941:    aload_0
L2942:    getfield Field ji c I
L2945:    aaload
L2946:    iload_2
L2947:    iaload
L2948:    if_icmpne L2990
L2951:    iinc 2 -1
L2954:    iinc 3 -1
L2957:    iload_3
L2958:    iflt L2964
L2961:    goto L2970
L2964:    iinc 2 4
L2967:    iinc 3 4
L2970:    iload_2
L2971:    iconst_m1
L2972:    ixor
L2973:    aload_0
L2974:    getfield Field ji g Lrm;
L2977:    getfield Field rm e I
L2980:    iconst_m1
L2981:    ixor
L2982:    if_icmpeq L2988
L2985:    goto L2937
L2988:    iload_2
L2989:    ireturn
L2990:    iload_2
L2991:    ireturn
L2992:    iconst_5
L2993:    aload_0
L2994:    getfield Field ji c I
L2997:    if_icmpne L3248
L3000:    iload_2
L3001:    iconst_3
L3002:    if_icmplt L3233
L3005:    bipush -7
L3007:    aload_0
L3008:    getfield Field ji c I
L3011:    iconst_m1
L3012:    ixor
L3013:    if_icmpne L3135
L3016:    iconst_2
L3017:    iload_2
L3018:    if_icmpgt L3119
L3021:    aload_0
L3022:    getfield Field ji c I
L3025:    iconst_m1
L3026:    ixor
L3027:    bipush -20
L3029:    if_icmpeq L3047
L3032:    iload_1
L3033:    bipush -20
L3035:    if_icmpeq L3045
L3038:    aload_0
L3039:    iconst_1
L3040:    invokevirtual Method ji r (I)V
L3043:    iconst_m1
L3044:    ireturn
L3045:    iconst_m1
L3046:    ireturn
L3047:    getstatic Field uc e [[I
L3050:    aload_0
L3051:    getfield Field ji c I
L3054:    aaload
L3055:    getstatic Field fa c [I
L3058:    if_acmpeq L3066
L3061:    bipush 20
L3063:    goto L3068
L3066:    bipush 30
L3068:    istore 4
L3070:    iload_2
L3071:    iconst_m1
L3072:    ixor
L3073:    bipush -11
L3075:    if_icmpgt L3104
L3078:    iload_2
L3079:    iload 4
L3081:    if_icmplt L3099
L3084:    iload_1
L3085:    bipush -20
L3087:    if_icmpeq L3097
L3090:    aload_0
L3091:    iconst_1
L3092:    invokevirtual Method ji r (I)V
L3095:    iconst_m1
L3096:    ireturn
L3097:    iconst_m1
L3098:    ireturn
L3099:    iload_2
L3100:    bipush 10
L3102:    isub
L3103:    ireturn
L3104:    iload_1
L3105:    bipush -20
L3107:    if_icmpeq L3117
L3110:    aload_0
L3111:    iconst_1
L3112:    invokevirtual Method ji r (I)V
L3115:    iconst_m1
L3116:    ireturn
L3117:    iconst_m1
L3118:    ireturn
L3119:    iinc 2 -1
L3122:    iconst_0
L3123:    iload_2
L3124:    if_icmpgt L3130
L3127:    goto L3133
L3130:    iinc 2 2
L3133:    iload_2
L3134:    ireturn
L3135:    aload_0
L3136:    getfield Field ji c I
L3139:    iconst_m1
L3140:    ixor
L3141:    bipush -20
L3143:    if_icmpeq L3161
L3146:    iload_1
L3147:    bipush -20
L3149:    if_icmpeq L3159
L3152:    aload_0
L3153:    iconst_1
L3154:    invokevirtual Method ji r (I)V
L3157:    iconst_m1
L3158:    ireturn
L3159:    iconst_m1
L3160:    ireturn
L3161:    getstatic Field uc e [[I
L3164:    aload_0
L3165:    getfield Field ji c I
L3168:    aaload
L3169:    getstatic Field fa c [I
L3172:    if_acmpeq L3180
L3175:    bipush 20
L3177:    goto L3182
L3180:    bipush 30
L3182:    istore 4
L3184:    iload_2
L3185:    iconst_m1
L3186:    ixor
L3187:    bipush -11
L3189:    if_icmpgt L3218
L3192:    iload_2
L3193:    iload 4
L3195:    if_icmplt L3213
L3198:    iload_1
L3199:    bipush -20
L3201:    if_icmpeq L3211
L3204:    aload_0
L3205:    iconst_1
L3206:    invokevirtual Method ji r (I)V
L3209:    iconst_m1
L3210:    ireturn
L3211:    iconst_m1
L3212:    ireturn
L3213:    iload_2
L3214:    bipush 10
L3216:    isub
L3217:    ireturn
L3218:    iload_1
L3219:    bipush -20
L3221:    if_icmpeq L3231
L3224:    aload_0
L3225:    iconst_1
L3226:    invokevirtual Method ji r (I)V
L3229:    iconst_m1
L3230:    ireturn
L3231:    iconst_m1
L3232:    ireturn
L3233:    iinc 2 -1
L3236:    iconst_0
L3237:    iload_2
L3238:    if_icmple L3246
L3241:    iinc 2 3
L3244:    iload_2
L3245:    ireturn
L3246:    iload_2
L3247:    ireturn
L3248:    bipush -7
L3250:    aload_0
L3251:    getfield Field ji c I
L3254:    iconst_m1
L3255:    ixor
L3256:    if_icmpne L3378
L3259:    iconst_2
L3260:    iload_2
L3261:    if_icmpgt L3362
L3264:    aload_0
L3265:    getfield Field ji c I
L3268:    iconst_m1
L3269:    ixor
L3270:    bipush -20
L3272:    if_icmpeq L3290
L3275:    iload_1
L3276:    bipush -20
L3278:    if_icmpeq L3288
L3281:    aload_0
L3282:    iconst_1
L3283:    invokevirtual Method ji r (I)V
L3286:    iconst_m1
L3287:    ireturn
L3288:    iconst_m1
L3289:    ireturn
L3290:    getstatic Field uc e [[I
L3293:    aload_0
L3294:    getfield Field ji c I
L3297:    aaload
L3298:    getstatic Field fa c [I
L3301:    if_acmpeq L3309
L3304:    bipush 20
L3306:    goto L3311
L3309:    bipush 30
L3311:    istore 4
L3313:    iload_2
L3314:    iconst_m1
L3315:    ixor
L3316:    bipush -11
L3318:    if_icmpgt L3347
L3321:    iload_2
L3322:    iload 4
L3324:    if_icmplt L3342
L3327:    iload_1
L3328:    bipush -20
L3330:    if_icmpeq L3340
L3333:    aload_0
L3334:    iconst_1
L3335:    invokevirtual Method ji r (I)V
L3338:    iconst_m1
L3339:    ireturn
L3340:    iconst_m1
L3341:    ireturn
L3342:    iload_2
L3343:    bipush 10
L3345:    isub
L3346:    ireturn
L3347:    iload_1
L3348:    bipush -20
L3350:    if_icmpeq L3360
L3353:    aload_0
L3354:    iconst_1
L3355:    invokevirtual Method ji r (I)V
L3358:    iconst_m1
L3359:    ireturn
L3360:    iconst_m1
L3361:    ireturn
L3362:    iinc 2 -1
L3365:    iconst_0
L3366:    iload_2
L3367:    if_icmpgt L3373
L3370:    goto L3376
L3373:    iinc 2 2
L3376:    iload_2
L3377:    ireturn
L3378:    aload_0
L3379:    getfield Field ji c I
L3382:    iconst_m1
L3383:    ixor
L3384:    bipush -20
L3386:    if_icmpeq L3404
L3389:    iload_1
L3390:    bipush -20
L3392:    if_icmpeq L3402
L3395:    aload_0
L3396:    iconst_1
L3397:    invokevirtual Method ji r (I)V
L3400:    iconst_m1
L3401:    ireturn
L3402:    iconst_m1
L3403:    ireturn
L3404:    getstatic Field uc e [[I
L3407:    aload_0
L3408:    getfield Field ji c I
L3411:    aaload
L3412:    getstatic Field fa c [I
L3415:    if_acmpeq L3423
L3418:    bipush 20
L3420:    goto L3425
L3423:    bipush 30
L3425:    istore 4
L3427:    iload_2
L3428:    iconst_m1
L3429:    ixor
L3430:    bipush -11
L3432:    if_icmpgt L3461
L3435:    iload_2
L3436:    iload 4
L3438:    if_icmplt L3456
L3441:    iload_1
L3442:    bipush -20
L3444:    if_icmpeq L3454
L3447:    aload_0
L3448:    iconst_1
L3449:    invokevirtual Method ji r (I)V
L3452:    iconst_m1
L3453:    ireturn
L3454:    iconst_m1
L3455:    ireturn
L3456:    iload_2
L3457:    bipush 10
L3459:    isub
L3460:    ireturn
L3461:    iload_1
L3462:    bipush -20
L3464:    if_icmpeq L3474
L3467:    aload_0
L3468:    iconst_1
L3469:    invokevirtual Method ji r (I)V
L3472:    iconst_m1
L3473:    ireturn
L3474:    iconst_m1
L3475:    ireturn
L3476:
    .end code
.end method
.sourcefile "null"
.end class
