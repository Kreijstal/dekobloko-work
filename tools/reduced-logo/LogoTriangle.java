/** Source-isolated logo triangle/span control flow; procedural inputs only.
 * Derived from matching geoblox wh.a/jf.a; unrelated game members removed.
 * External identifiers renamed, arithmetic and branch structure retained.
 */
final class LogoTriangle {
    static void draw(int param0, int param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8, int param9, int param10, int[] param11, int param12, int param13, int param14, int param15, int param16) {
        int stackIn_73_0 = 0;
        int stackIn_73_1 = 0;
        RuntimeException stackIn_113_0 = null;
        StringBuilder stackIn_113_1 = null;
        RuntimeException stackIn_114_0 = null;
        StringBuilder stackIn_114_1 = null;
        String stackIn_114_2 = null;
        int decompiledRegionSelector0 = 0;
        Throwable caughtException = null;
        RuntimeException decompiledCaughtException = null;
        int var17_int = 0;
        RuntimeException var17 = null;
        int var18 = 0;
        int var19 = 0;
        int var20 = 0;
        int var21 = 0;
        int var22 = 0;
        int var23 = 0;
        int var24 = 0;
        int var25 = 0;
        int var26 = 0;
        int var27 = 0;
        int var28 = 0;
        int var29 = 0;
        int var30 = 0;
        int var31 = 0;
        int var32 = 0;
        int var33 = 0;
        int var34 = 0;
        int var35 = 0;
        int var36 = 0;
        int var37 = 0;
        int var38 = 0;
        int var39 = 0;
        int var40 = 0;
        int var41 = 0;
        int var42 = 0;
        var42 = LogoRasterState.opaque;
        try {
          L0: {
            L1: {
              if ((param4 ^ -1) > -1) {
                break L1;
              } else {
                if ((LogoRasterState.height ^ -1) < (param8 ^ -1)) {
                  L2: {
                    if (-1 >= (param2 ^ -1)) {
                      break L2;
                    } else {
                      if (-1 >= (param9 ^ -1)) {
                        break L2;
                      } else {
                        if (param13 < 0) {
                          decompiledRegionSelector0 = 1;
                          break L0;
                        } else {
                          break L2;
                        }
                      }
                    }
                  }
                  L3: {
                    if ((LogoRasterState.width ^ -1) < (param2 ^ -1)) {
                      break L3;
                    } else {
                      if ((LogoRasterState.width ^ -1) < (param9 ^ -1)) {
                        break L3;
                      } else {
                        if (param13 < LogoRasterState.width) {
                          break L3;
                        } else {
                          decompiledRegionSelector0 = 2;
                          break L0;
                        }
                      }
                    }
                  }
                  if (param16 == -1275583984) {
                    L4: {
                      L5: {
                        var34 = -param8 + param4;
                        if (param8 != param15) {
                          break L5;
                        } else {
                          L6: {
                            L7: {
                              if ((param4 ^ -1) != (param8 ^ -1)) {
                                break L7;
                              } else {
                                var29 = param14;
                                var17_int = param2 << 358182032;
                                var31 = 0;
                                var30 = param7;
                                var19 = 0;
                                var21 = param1;
                                var24 = 0;
                                var32 = 0;
                                var20 = 0;
                                var26 = param3;
                                var23 = 0;
                                var22 = param10;
                                var27 = 0;
                                var28 = 0;
                                var18 = param9 << 1795594064;
                                var25 = param12;
                                if (var42 == 0) {
                                  break L6;
                                } else {
                                  break L7;
                                }
                              }
                            }
                            L8: {
                              var35 = -param15 + param4;
                              if (param9 > param2) {
                                break L8;
                              } else {
                                var27 = (param0 - param3 << -1074531760) / var35;
                                var29 = param7 << -1947888496;
                                var20 = (param13 - param2 << -364475504) / var34;
                                var24 = (param6 - param1 << 1382202064) / var34;
                                var17_int = param9 << -608899408;
                                var23 = (-param10 + param6 << 1069954736) / var35;
                                var18 = param2 << 910288432;
                                var31 = (-param7 + param5 << 1801290704) / var35;
                                var32 = (-param14 + param5 << 2044116112) / var34;
                                var25 = param3 << 1939952240;
                                var30 = param14 << 484143472;
                                var28 = (-param12 + param0 << -828023600) / var34;
                                var19 = (-param9 + param13 << -614106128) / var35;
                                var21 = param10 << 753361392;
                                var22 = param1 << 1855667952;
                                var26 = param12 << -1097332720;
                                if (var42 == 0) {
                                  break L6;
                                } else {
                                  break L8;
                                }
                              }
                            }
                            var28 = (param0 + -param3 << -1838617200) / var35;
                            var23 = (param6 + -param1 << -469259472) / var34;
                            var19 = (param13 - param2 << 919315408) / var34;
                            var25 = param12 << -1932867984;
                            var22 = param10 << 1517688272;
                            var32 = (param5 - param7 << 2139072240) / var35;
                            var26 = param3 << -288466704;
                            var17_int = param2 << -1488668400;
                            var24 = (-param10 + param6 << -343657936) / var35;
                            var21 = param1 << 1498191728;
                            var30 = param7 << 1041192944;
                            var18 = param9 << 170305712;
                            var20 = (param13 - param9 << -2094236560) / var35;
                            var31 = (param5 - param14 << -512329264) / var34;
                            var27 = (param0 + -param12 << 2129025008) / var34;
                            var29 = param14 << 192682064;
                            break L6;
                          }
                          var33 = 0;
                          if (0 <= param8) {
                            break L4;
                          } else {
                            param8 = Math.min(-param8, param15 - param8);
                            var22 = var22 + var24 * param8;
                            var30 = var30 + param8 * var32;
                            var18 = var18 + var20 * param8;
                            var17_int = var17_int + var19 * param8;
                            var25 = var25 + var27 * param8;
                            var21 = var21 + var23 * param8;
                            var29 = var29 + var31 * param8;
                            var26 = var26 + param8 * var28;
                            param8 = 0;
                            if (var42 == 0) {
                              break L4;
                            } else {
                              break L5;
                            }
                          }
                        }
                      }
                      L9: {
                        L10: {
                          var18 = param2 << 778489424;
                          var17_int = param2 << 778489424;
                          var30 = param14 << 2118783760;
                          var29 = param14 << 2118783760;
                          var26 = param12 << -1801560272;
                          var25 = param12 << -1801560272;
                          var22 = param1 << 1903384240;
                          var21 = param1 << 1903384240;
                          var35 = param15 + -param8;
                          var20 = (-param2 + param13 << 440131920) / var34;
                          var19 = (param9 + -param2 << 1272988272) / var35;
                          if (var20 > var19) {
                            break L10;
                          } else {
                            var23 = (-param1 + param6 << -2000993456) / var34;
                            var27 = (-param12 + param0 << 1142761648) / var34;
                            var31 = (-param14 + param5 << -1987100592) / var34;
                            var36 = var19;
                            var19 = var20;
                            var20 = var36;
                            var28 = (-param12 + param3 << 432415280) / var35;
                            var33 = 1;
                            var32 = (-param14 + param7 << 214314576) / var35;
                            var24 = (-param1 + param10 << -1879453296) / var35;
                            if (var42 == 0) {
                              break L9;
                            } else {
                              break L10;
                            }
                          }
                        }
                        var32 = (-param14 + param5 << -2120283184) / var34;
                        var28 = (param0 - param12 << 718199120) / var34;
                        var23 = (param10 - param1 << -868271056) / var35;
                        var24 = (-param1 + param6 << -2107665712) / var34;
                        var31 = (param7 + -param14 << -1485610160) / var35;
                        var27 = (-param12 + param3 << -1320681136) / var35;
                        var33 = 0;
                        break L9;
                      }
                      L11: {
                        L12: {
                          L13: {
                            if (-1 >= (param8 ^ -1)) {
                              break L13;
                            } else {
                              L14: {
                                if (param15 < 0) {
                                  break L14;
                                } else {
                                  param8 = -param8;
                                  var30 = var30 + var32 * param8;
                                  var26 = var26 + param8 * var28;
                                  var29 = var29 + var31 * param8;
                                  var25 = var25 + param8 * var27;
                                  var17_int = var17_int + param8 * var19;
                                  var18 = var18 + param8 * var20;
                                  var22 = var22 + var24 * param8;
                                  var21 = var21 + param8 * var23;
                                  param8 = 0;
                                  if (var42 == 0) {
                                    break L13;
                                  } else {
                                    break L14;
                                  }
                                }
                              }
                              param8 = param15 - param8;
                              var21 = var21 + param8 * var23;
                              var26 = var26 + param8 * var28;
                              var17_int = var17_int + param8 * var19;
                              var18 = var18 + param8 * var20;
                              var25 = var25 + var27 * param8;
                              var30 = var30 + var32 * param8;
                              var22 = var22 + param8 * var24;
                              var29 = var29 + var31 * param8;
                              param8 = param15;
                              if (var42 == 0) {
                                break L12;
                              } else {
                                break L13;
                              }
                            }
                          }
                          var36 = LogoRasterState.rows[param8];
                          L15: while (true) {
                            if ((param15 ^ -1) >= (param8 ^ -1)) {
                              break L12;
                            } else {
                              var37 = var17_int >> 433424592;
                              stackIn_73_0 = LogoRasterState.width ^ -1;

                              stackIn_73_1 = var37 ^ -1;

                              if (var42 != 0) {
                                break L11;
                              } else {
                                L16: {
                                  if (stackIn_73_0 >= stackIn_73_1) {
                                    break L16;
                                  } else {
                                    L17: {
                                      var38 = (var18 >> 1802867664) - (var17_int >> 1124703984);
                                      if (-1 == (var38 ^ -1)) {
                                        break L17;
                                      } else {
                                        L18: {
                                          var39 = (var22 + -var21) / var38;
                                          var40 = (-var25 + var26) / var38;
                                          var41 = (var30 + -var29) / var38;
                                          if (LogoRasterState.width <= var38 + var37) {
                                            var38 = -1 + (LogoRasterState.width + -var37);
                                            break L18;
                                          } else {
                                            break L18;
                                          }
                                        }
                                        L19: {
                                          L20: {
                                            if (0 > var37) {
                                              break L20;
                                            } else {
                                              LogoSpan.draw(var37 + var36, var39, 33423689, var21, var41, var25, var40, var38, var29, param11);
                                              if (var42 == 0) {
                                                break L19;
                                              } else {
                                                break L20;
                                              }
                                            }
                                          }
                                          LogoSpan.draw(var36, var39, 33423689, -(var39 * var37) + var21, var41, var25 + -(var37 * var40), var40, var38 - -var37, -(var41 * var37) + var29, param11);
                                          break L19;
                                        }
                                        if (var42 == 0) {
                                          break L16;
                                        } else {
                                          break L17;
                                        }
                                      }
                                    }
                                    if (-1 < (var37 ^ -1)) {
                                      break L16;
                                    } else {
                                      if ((var37 ^ -1) <= (LogoRasterState.width ^ -1)) {
                                        break L16;
                                      } else {
                                        LogoSpan.draw(var37 - -var36, 0, 33423689, var21, 0, var25, 0, var38, var29, param11);
                                        break L16;
                                      }
                                    }
                                  }
                                }
                                param8++;
                                if ((param8 ^ -1) > (LogoRasterState.height ^ -1)) {
                                  var18 = var18 + var20;
                                  var26 = var26 + var28;
                                  var22 = var22 + var24;
                                  var25 = var25 + var27;
                                  var29 = var29 + var31;
                                  var30 = var30 + var32;
                                  var17_int = var17_int + var19;
                                  var21 = var21 + var23;
                                  var36 = var36 + LogoRasterState.stride;
                                  if (var42 == 0) {
                                    continue L15;
                                  } else {
                                    break L12;
                                  }
                                } else {
                                  decompiledRegionSelector0 = 4;
                                  break L0;
                                }
                              }
                            }
                          }
                        }
                        var36 = param4 + -param15;
                        stackIn_73_0 = var36 ^ -1;
                        stackIn_73_1 = -1;
                        break L11;
                      }
                      L21: {
                        if (stackIn_73_0 != stackIn_73_1) {
                          break L21;
                        } else {
                          var23 = 0;
                          var27 = 0;
                          var20 = 0;
                          var19 = 0;
                          var24 = 0;
                          var31 = 0;
                          var28 = 0;
                          var32 = 0;
                          if (var42 == 0) {
                            break L4;
                          } else {
                            break L21;
                          }
                        }
                      }
                      L22: {
                        L23: {
                          var37 = param13 << 1962303440;
                          var38 = param6 << 769735280;
                          var39 = param0 << 1520988336;
                          var40 = param5 << 742704;
                          if (var33 != 0) {
                            break L23;
                          } else {
                            var17_int = param9 << -2099010000;
                            var29 = param7 << -1275583984;
                            var21 = param10 << -1640258480;
                            var25 = param3 << 780067984;
                            if (var42 == 0) {
                              break L22;
                            } else {
                              break L23;
                            }
                          }
                        }
                        var22 = param10 << 16805488;
                        var18 = param9 << 1905270256;
                        var26 = param3 << 1281477616;
                        var30 = param7 << -1931827536;
                        break L22;
                      }
                      var28 = (var39 + -var26) / var36;
                      var31 = (-var29 + var40) / var36;
                      var19 = (var37 - var17_int) / var36;
                      var23 = (-var21 + var38) / var36;
                      var27 = (var39 + -var25) / var36;
                      var24 = (var38 + -var22) / var36;
                      var20 = (var37 - var18) / var36;
                      var32 = (-var30 + var40) / var36;
                      break L4;
                    }
                    L24: {
                      if (-1 >= (param8 ^ -1)) {
                        break L24;
                      } else {
                        param8 = -param8;
                        var18 = var18 + param8 * var20;
                        var17_int = var17_int + param8 * var19;
                        var22 = var22 + var24 * param8;
                        var30 = var30 + param8 * var32;
                        var21 = var21 + var23 * param8;
                        var29 = var29 + param8 * var31;
                        var26 = var26 + var28 * param8;
                        var25 = var25 + var27 * param8;
                        param8 = 0;
                        break L24;
                      }
                    }
                    var35 = LogoRasterState.rows[param8];
                    L25: while (true) {
                      L26: {
                        L27: {
                          if (param4 <= param8) {
                            break L27;
                          } else {
                            var36 = var17_int >> 2004845488;
                            if (var42 != 0) {
                              break L26;
                            } else {
                              L28: {
                                if (var36 >= LogoRasterState.width) {
                                  break L28;
                                } else {
                                  L29: {
                                    var37 = -(var17_int >> -134889776) + (var18 >> 1844746576);
                                    if (var37 == 0) {
                                      break L29;
                                    } else {
                                      L30: {
                                        var38 = (var22 + -var21) / var37;
                                        var39 = (var26 + -var25) / var37;
                                        var40 = (-var29 + var30) / var37;
                                        if (var37 + var36 < LogoRasterState.width) {
                                          break L30;
                                        } else {
                                          var37 = LogoRasterState.width - var36 - 1;
                                          break L30;
                                        }
                                      }
                                      L31: {
                                        L32: {
                                          if (var36 >= 0) {
                                            break L32;
                                          } else {
                                            LogoSpan.draw(var35, var38, 33423689, var21 - var38 * var36, var40, var25 + -(var36 * var39), var39, var37 + var36, -(var36 * var40) + var29, param11);
                                            if (var42 == 0) {
                                              break L31;
                                            } else {
                                              break L32;
                                            }
                                          }
                                        }
                                        LogoSpan.draw(var36 + var35, var38, 33423689, var21, var40, var25, var39, var37, var29, param11);
                                        break L31;
                                      }
                                      if (var42 == 0) {
                                        break L28;
                                      } else {
                                        break L29;
                                      }
                                    }
                                  }
                                  if (var36 < 0) {
                                    break L28;
                                  } else {
                                    if (LogoRasterState.width > var36) {
                                      LogoSpan.draw(var35 + var36, 0, 33423689, var21, 0, var25, 0, var37, var29, param11);
                                      break L28;
                                    } else {
                                      break L28;
                                    }
                                  }
                                }
                              }
                              param8++;
                              if ((LogoRasterState.height ^ -1) < (param8 ^ -1)) {
                                var18 = var18 + var20;
                                var22 = var22 + var24;
                                var35 = var35 + LogoRasterState.stride;
                                var25 = var25 + var27;
                                var26 = var26 + var28;
                                var29 = var29 + var31;
                                var21 = var21 + var23;
                                var17_int = var17_int + var19;
                                var30 = var30 + var32;
                                if (var42 == 0) {
                                  continue L25;
                                } else {
                                  break L27;
                                }
                              } else {
                                decompiledRegionSelector0 = 6;
                                break L0;
                              }
                            }
                          }
                        }
                        break L26;
                      }
                      decompiledRegionSelector0 = 5;
                      break L0;
                    }
                  } else {
                    decompiledRegionSelector0 = 3;
                    break L0;
                  }
                } else {
                  break L1;
                }
              }
            }
            decompiledRegionSelector0 = 0;
            break L0;
          }
        } catch (java.lang.RuntimeException decompiledCaughtParameter0) {
          decompiledCaughtException = decompiledCaughtParameter0;
          L33: {
            var17 = decompiledCaughtException;
            stackIn_113_0 = (RuntimeException) (var17);

            stackIn_113_1 = new StringBuilder().append("wh.KA(").append(param0).append(',').append(param1).append(',').append(param2).append(',').append(param3).append(',').append(param4).append(',').append(param5).append(',').append(param6).append(',').append(param7).append(',').append(param8).append(',').append(param9).append(',').append(param10).append(',');

            if (param11 == null) {
              stackIn_114_0 = (RuntimeException) ((Object) stackIn_113_0);
              stackIn_114_1 = (StringBuilder) ((Object) stackIn_113_1);
              stackIn_114_2 = "null";
              break L33;
            } else {
              stackIn_114_0 = (RuntimeException) ((Object) stackIn_113_0);
              stackIn_114_1 = (StringBuilder) ((Object) stackIn_113_1);
              stackIn_114_2 = "{...}";
              break L33;
            }
          }
          throw LogoRasterState.failure((Throwable) ((Object) stackIn_114_0), stackIn_114_2 + ',' + param12 + ',' + param13 + ',' + param14 + ',' + param15 + ',' + param16 + ')');
        }
        if (decompiledRegionSelector0 == 0) {
          return;
        } else {
          if (decompiledRegionSelector0 == 1) {
            return;
          } else {
            if (decompiledRegionSelector0 == 2) {
              return;
            } else {
              if (decompiledRegionSelector0 == 3) {
                return;
              } else {
                if (decompiledRegionSelector0 == 4) {
                  return;
                } else {
                  if (decompiledRegionSelector0 == 5) {
                    return;
                  } else {
                    return;
                  }
                }
              }
            }
          }
        }
    }
}
final class LogoSpan {
    static void draw(int param0, int param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8, int[] param9) {
        int[] var10 = null;
        RuntimeException var10_ref = null;
        int var11 = 0;
        int var12 = 0;
        int var13 = 0;
        int var14 = 0;
        int var15 = 0;
        int var16 = 0;
        int[] var17 = null;
        RuntimeException stackIn_8_0 = null;
        StringBuilder stackIn_8_1 = null;
        RuntimeException stackIn_9_0 = null;
        StringBuilder stackIn_9_1 = null;
        String stackIn_9_2 = null;
        RuntimeException decompiledCaughtException = null;
        var16 = LogoRasterState.opaque;
        try {
          L0: {
            L1: while (true) {
              param7--;
              if ((param7 ^ -1) > -1) {
                if (param2 == 33423689) {
                  break L0;
                } else {
                  LogoRasterState.sentinel = -7;
                  return;
                }
              } else {
                var17 = param9;
                var10 = var17;
                var11 = param0;
                var12 = param3;
                var13 = param5;
                var14 = param8;
                var15 = var17[var11] >> -1748235839 & 8355711;
                var10[var11] = LogoRasterState.mask(255, var14 >> -1416780783) + ((LogoRasterState.mask(33423689, var13) >> -151652535) + (LogoRasterState.mask(33423360, var12) >> -400894207)) + var15;
                param0++;
                param8 = param8 + param4;
                param3 = param3 + param1;
                param5 = param5 + param6;
                continue L1;
              }
            }
          }
        } catch (java.lang.RuntimeException decompiledCaughtParameter0) {
          decompiledCaughtException = decompiledCaughtParameter0;
          L2: {
            var10_ref = decompiledCaughtException;
            stackIn_8_0 = (RuntimeException) (var10_ref);

            stackIn_8_1 = new StringBuilder().append("jf.F(").append(param0).append(',').append(param1).append(',').append(param2).append(',').append(param3).append(',').append(param4).append(',').append(param5).append(',').append(param6).append(',').append(param7).append(',').append(param8).append(',');

            if (param9 == null) {
              stackIn_9_0 = (RuntimeException) ((Object) stackIn_8_0);
              stackIn_9_1 = (StringBuilder) ((Object) stackIn_8_1);
              stackIn_9_2 = "null";
              break L2;
            } else {
              stackIn_9_0 = (RuntimeException) ((Object) stackIn_8_0);
              stackIn_9_1 = (StringBuilder) ((Object) stackIn_8_1);
              stackIn_9_2 = "{...}";
              break L2;
            }
          }
          throw LogoRasterState.failure((Throwable) ((Object) stackIn_9_0), stackIn_9_2 + ')');
        }
    }
}
final class LogoRasterState {
 static int[] pixels;
 static int width=540,height=140,stride=540,opaque,sentinel;
 static int[] rows=new int[140];
 static {for(int i=0;i<rows.length;i++)rows[i]=i*stride;}
 static int mask(int a,int b){return a&b;}
 static RuntimeException failure(Throwable cause,String message){return new IllegalStateException(message,cause);}
}
