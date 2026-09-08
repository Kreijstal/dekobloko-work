/** Flat-shaded logo branch: isolated gi.a -> sd.a -> ib.a Java control flow. */
final class LogoFlatDispatch {
static void invalidTag(int unused){throw new IllegalArgumentException("Unsupported diagnostic tag");}
static void draw(int param0, int param1, int param2, int param3, int param4, int param5, int param6, int param7) {
        int var9;
        var9 = LogoRasterState.opaque;
        if (param6 >= param3) {
          if (param2 > param6) {
            LogoFlatTriangle.draw(param5, param4, param7, 110, LogoRasterState.pixels, param2, param0, param6, param3);
            if (param1 >= -102) {
              invalidTag(-38);
              return;
            } else {
              return;
            }
          } else {
            if (param3 < param2) {
              LogoFlatTriangle.draw(param0, param4, param7, 127, LogoRasterState.pixels, param6, param5, param2, param3);
              if (param1 >= -102) {
                invalidTag(-38);
                return;
              } else {
                return;
              }
            } else {
              LogoFlatTriangle.draw(param4, param0, param7, 120, LogoRasterState.pixels, param6, param5, param3, param2);
              if (param1 >= -102) {
                invalidTag(-38);
                return;
              } else {
                return;
              }
            }
          }
        } else {
          if (param3 >= param2) {
            if (param2 > param6) {
              LogoFlatTriangle.draw(param0, param5, param7, -110, LogoRasterState.pixels, param3, param4, param2, param6);
              if (param1 < -102) {
                return;
              } else {
                invalidTag(-38);
                return;
              }
            } else {
              LogoFlatTriangle.draw(param5, param0, param7, -102, LogoRasterState.pixels, param3, param4, param6, param2);
              if (param1 < -102) {
                return;
              } else {
                invalidTag(-38);
                return;
              }
            }
          } else {
            LogoFlatTriangle.draw(param4, param5, param7, 116, LogoRasterState.pixels, param2, param0, param3, param6);
            if (param1 >= -102) {
              invalidTag(-38);
              return;
            } else {
              return;
            }
          }
        }
    }
}
final class LogoFlatTriangle {
static void draw(int param0, int param1, int param2, int param3, int[] param4, int param5, int param6, int param7, int param8) {
        RuntimeException stackIn_74_0 = null;
        StringBuilder stackIn_74_1 = null;
        RuntimeException stackIn_75_0 = null;
        StringBuilder stackIn_75_1 = null;
        String stackIn_75_2 = null;
        int decompiledRegionSelector0 = 0;
        RuntimeException decompiledCaughtException = null;
        int var9_int = 0;
        RuntimeException var9 = null;
        int var10 = 0;
        int var11 = 0;
        int var12 = 0;
        int var13 = 0;
        int var14 = 0;
        int var15 = 0;
        int var16 = 0;
        int var17 = 0;
        int var18 = 0;
        int var19 = 0;
        var19 = LogoRasterState.opaque;
        try {
          L0: {
            L1: {
              if (-1 < (param5 ^ -1)) {
                break L1;
              } else {
                if (param8 < LogoRasterState.height) {
                  L2: {
                    if (0 <= param1) {
                      break L2;
                    } else {
                      if ((param0 ^ -1) <= -1) {
                        break L2;
                      } else {
                        if ((param6 ^ -1) > -1) {
                          decompiledRegionSelector0 = 1;
                          break L0;
                        } else {
                          break L2;
                        }
                      }
                    }
                  }
                  L3: {
                    if (param1 < LogoRasterState.width) {
                      break L3;
                    } else {
                      if (param0 < LogoRasterState.width) {
                        break L3;
                      } else {
                        if (LogoRasterState.width <= param6) {
                          decompiledRegionSelector0 = 2;
                          break L0;
                        } else {
                          break L3;
                        }
                      }
                    }
                  }
                  L4: {
                    var14 = -param8 + param5;
                    if (param7 == param8) {
                      L5: {
                        if (param8 != param5) {
                          var15 = -param7 + param5;
                          if (param0 > param1) {
                            var10 = param0 << 563576176;
                            var11 = (-param1 + param6 << -1553445200) / var14;
                            var9_int = param1 << 2050032944;
                            var12 = (param6 + -param0 << -270184496) / var15;
                            break L5;
                          } else {
                            var10 = param1 << -1300931760;
                            var11 = (param6 + -param0 << 1611829680) / var15;
                            var9_int = param0 << 1690626512;
                            var12 = (-param1 + param6 << 432247536) / var14;
                            break L5;
                          }
                        } else {
                          var11 = 0;
                          var10 = param0 << 876887888;
                          var9_int = param1 << 56769648;
                          var12 = 0;
                          break L5;
                        }
                      }
                      var13 = 0;
                      if ((param8 ^ -1) <= -1) {
                        break L4;
                      } else {
                        param8 = Math.min(-param8, -param8 + param7);
                        var10 = var10 + var12 * param8;
                        var9_int = var9_int + param8 * var11;
                        param8 = 0;
                        break L4;
                      }
                    } else {
                      L6: {
                        var10 = param1 << 1281253328;
                        var9_int = param1 << 1281253328;
                        var15 = -param8 + param7;
                        var11 = (-param1 + param0 << -410776048) / var15;
                        var12 = (param6 + -param1 << -1794392336) / var14;
                        if (var12 > var11) {
                          var13 = 0;
                          break L6;
                        } else {
                          var13 = 1;
                          var16 = var11;
                          var11 = var12;
                          var12 = var16;
                          break L6;
                        }
                      }
                      L7: {
                        L8: {
                          if (0 <= param8) {
                            break L8;
                          } else {
                            if (param7 >= 0) {
                              param8 = -param8;
                              var10 = var10 + var12 * param8;
                              var9_int = var9_int + var11 * param8;
                              param8 = 0;
                              break L8;
                            } else {
                              param8 = param7 - param8;
                              var9_int = var9_int + var11 * param8;
                              var10 = var10 + var12 * param8;
                              param8 = param7;
                              break L7;
                            }
                          }
                        }
                        var16 = LogoRasterState.rows[param8];
                        L9: while (true) {
                          if (param8 >= param7) {
                            break L7;
                          } else {
                            L10: {
                              var17 = var9_int >> 1475495536;
                              if (LogoRasterState.width > var17) {
                                var18 = (var10 >> 1486250608) - (var9_int >> -1222284624);
                                if (-1 != (var18 ^ -1)) {
                                  L11: {
                                    if (var17 - -var18 < LogoRasterState.width) {
                                      break L11;
                                    } else {
                                      var18 = -1 + (-var17 + LogoRasterState.width);
                                      break L11;
                                    }
                                  }
                                  if (0 <= var17) {
                                    LogoFlatSpan.draw(47, param4, var16 + var17, param2, var18);
                                    break L10;
                                  } else {
                                    LogoFlatSpan.draw(57, param4, var16, param2, var17 + var18);
                                    break L10;
                                  }
                                } else {
                                  if (-1 < (var17 ^ -1)) {
                                    break L10;
                                  } else {
                                    if (LogoRasterState.width > var17) {
                                      LogoFlatSpan.draw(-61, param4, var17 + var16, param2, var18);
                                      break L10;
                                    } else {
                                      break L10;
                                    }
                                  }
                                }
                              } else {
                                break L10;
                              }
                            }
                            param8++;
                            if (param8 < LogoRasterState.height) {
                              var16 = var16 + LogoRasterState.stride;
                              var9_int = var9_int + var11;
                              var10 = var10 + var12;
                              continue L9;
                            } else {
                              decompiledRegionSelector0 = 3;
                              break L0;
                            }
                          }
                        }
                      }
                      var16 = -param7 + param5;
                      if (-1 == (var16 ^ -1)) {
                        var12 = 0;
                        var11 = 0;
                        break L4;
                      } else {
                        L12: {
                          var17 = param6 << -903778992;
                          if (var13 == 0) {
                            var9_int = param0 << 1096001584;
                            break L12;
                          } else {
                            var10 = param0 << 1370743920;
                            break L12;
                          }
                        }
                        var11 = (var17 + -var9_int) / var16;
                        var12 = (var17 - var10) / var16;
                        break L4;
                      }
                    }
                  }
                  L13: {
                    if (0 <= param8) {
                      break L13;
                    } else {
                      param8 = -param8;
                      var10 = var10 + var12 * param8;
                      var9_int = var9_int + param8 * var11;
                      param8 = 0;
                      break L13;
                    }
                  }
                  var16 = -91 % ((param3 - 74) / 33);
                  var15 = LogoRasterState.rows[param8];
                  L14: while (true) {
                    if (param5 <= param8) {
                      decompiledRegionSelector0 = 4;
                      break L0;
                    } else {
                      L15: {
                        var17 = var9_int >> -1016334288;
                        if (LogoRasterState.width <= var17) {
                          break L15;
                        } else {
                          var18 = (var10 >> -963505040) + -(var9_int >> -130429392);
                          if (var18 == 0) {
                            if ((var17 ^ -1) > -1) {
                              break L15;
                            } else {
                              if (LogoRasterState.width > var17) {
                                LogoFlatSpan.draw(-67, param4, var17 - -var15, param2, var18);
                                break L15;
                              } else {
                                break L15;
                              }
                            }
                          } else {
                            L16: {
                              if (LogoRasterState.width <= var18 + var17) {
                                var18 = -var17 + LogoRasterState.width + -1;
                                break L16;
                              } else {
                                break L16;
                              }
                            }
                            if (0 > var17) {
                              LogoFlatSpan.draw(127, param4, var15, param2, var17 + var18);
                              break L15;
                            } else {
                              LogoFlatSpan.draw(115, param4, var17 + var15, param2, var18);
                              break L15;
                            }
                          }
                        }
                      }
                      param8++;
                      if (LogoRasterState.height > param8) {
                        var9_int = var9_int + var11;
                        var10 = var10 + var12;
                        var15 = var15 + LogoRasterState.stride;
                        continue L14;
                      } else {
                        decompiledRegionSelector0 = 5;
                        break L0;
                      }
                    }
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
          L17: {
            var9 = decompiledCaughtException;
            stackIn_74_0 = (RuntimeException) (var9);

            stackIn_74_1 = new StringBuilder().append("sd.E(").append(param0).append(',').append(param1).append(',').append(param2).append(',').append(param3).append(',');

            if (param4 == null) {
              stackIn_75_0 = (RuntimeException) ((Object) stackIn_74_0);
              stackIn_75_1 = (StringBuilder) ((Object) stackIn_74_1);
              stackIn_75_2 = "null";
              break L17;
            } else {
              stackIn_75_0 = (RuntimeException) ((Object) stackIn_74_0);
              stackIn_75_1 = (StringBuilder) ((Object) stackIn_74_1);
              stackIn_75_2 = "{...}";
              break L17;
            }
          }
          throw LogoRasterState.failure((Throwable) ((Object) stackIn_75_0), stackIn_75_2 + ',' + param5 + ',' + param6 + ',' + param7 + ',' + param8 + ')');
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
                  return;
                }
              }
            }
          }
        }
    }
}
final class LogoFlatSpan {
static void draw(int param0, int[] param1, int param2, int param3, int param4) {
        int[] var9 = null;
        int var6 = 0;
        int var7 = 0;
        int var8 = LogoRasterState.opaque;
        try {
            while (true) {
                param4--;
                if (-1 < (param4 ^ -1)) {
                    break;
                }
                var9 = param1;
                int[] var5 = var9;
                var6 = param2;
                var7 = param3;
                var9[var6] = var7 + LogoRasterState.mask(var9[var6] >> -453107103, 8355711);
                param2++;
            }
            int var5_int = -30 % ((-2 - param0) / 40);
        } catch (RuntimeException runtimeException) {
            throw LogoRasterState.failure((Throwable) ((Object) runtimeException), "ib.AA(" + param0 + ',' + (param1 != null ? "{...}" : "null") + ',' + param2 + ',' + param3 + ',' + param4 + ')');
        }
    }
}
