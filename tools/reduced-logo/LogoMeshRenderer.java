/** Reduced matching mesh lighting/dispatch routine. Geometry, normals,
 * materials and draw order are procedural; no serialized guest input. */
final class LogoMeshRenderer {
 static int[] normalX=new int[8],normalY=new int[8],normalZ=new int[8],screenX,screenY;
 static int[] order=new int[12],specular=new int[512];
 static int faceCount=12;
 static byte[] weights=new byte[12];
 static LogoMaterial[] materials={new LogoMaterial(0x80b0e0)};
 static {for(int i=0;i<8;i++){normalX[i]=(i&1)==0?-80:80;normalY[i]=(i&2)==0?-80:80;normalZ[i]=(i&4)==0?-80:80;}
  for(int i=0;i<specular.length;i++)specular[i]=(i*i)>>12;for(int i=0;i<12;i++)order[i]=i;}
 // Fixture supplies deterministic order; the game's face-group merge is excluded.
 static void orderFaces(int unused){}
 static void copyWeights(int a,byte[] src,int b,byte[] dst,byte unused){System.arraycopy(src,a,dst,b,Math.min(src.length-a,dst.length-b));}
 static void flat(int a,int tag,int b,int c,int e,int f,int g,int color){LogoFlatDispatch.draw(a,tag,b,c,e,f,g,color);}
    static void draw(int param0, int param1, int param2, int param3, int param4, LogoMesh param5, int param6, int param7) {
        int stackIn_18_0 = 0;
        int[] stackIn_20_0 = null;
        int[] stackIn_21_0 = null;
        int stackIn_21_1 = 0;
        int stackIn_27_0 = 0;
        int stackIn_30_0 = 0;
        int stackIn_33_0 = 0;
        LogoMaterial stackIn_40_0 = null;
        int stackIn_45_0 = 0;
        int stackIn_49_0 = 0;
        RuntimeException stackIn_54_0 = null;
        StringBuilder stackIn_54_1 = null;
        RuntimeException stackIn_55_0 = null;
        StringBuilder stackIn_55_1 = null;
        String stackIn_55_2 = null;
        int decompiledRegionSelector0 = 0;
        RuntimeException decompiledCaughtException = null;
        int[] var8 = null;
        RuntimeException var8_ref = null;
        int var13 = 0;
        int var14 = 0;
        int var15 = 0;
        int var16 = 0;
        int var17 = 0;
        int var18 = 0;
        int var19 = 0;
        int var20 = 0;
        LogoMaterial var21 = null;
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
        int[] var41 = null;
        LogoMesh var44 = null;
        int[] var49 = null;
        int[] var54 = null;
        byte[] var60 = null;
        int[] var61 = null;
        int[] var62 = null;
        int[] var63 = null;
        int[] var64 = null;
        var40 = LogoRasterState.opaque;
        try {
          L0: {
            L1: {
              L2: {
                var44 = param5;
                if (null == var44.weights) {
                  break L2;
                } else {
                  if ((var44.materialMode ^ -1) < -2) {
                    var60 = var44.weights;
                    copyWeights(0, var60, 0, weights, (byte) -85);
                    break L1;
                  } else {
                    break L2;
                  }
                }
              }
              orderFaces(2971);
              break L1;
            }
            if (param3 == 6562) {
              var54 = new int[param5.normalCount];
              var49 = var54;
              var41 = var49;
              var8 = var41;
              var64 = new int[param5.normalCount];
              var62 = normalX;
              var61 = normalY;
              var63 = normalZ;
              var13 = 0;
              L3: while (true) {
                if (param5.normalCount <= var13) {
                  var13 = 0;
                  L4: while (true) {
                    if (var13 >= faceCount) {
                      decompiledRegionSelector0 = 1;
                      break L0;
                    } else {
                      L5: {
                        var14 = order[var13];
                        var15 = param5.faceA[var14];
                        var16 = param5.faceB[var14];
                        var17 = param5.faceC[var14];
                        if (param5.normalA[var14] >= normalX.length) {
                          stackIn_27_0 = -1;
                          break L5;
                        } else {
                          stackIn_27_0 = param5.normalA[var14];
                          break L5;
                        }
                      }
                      L6: {
                        var18 = stackIn_27_0;
                        if (normalX.length > param5.normalB[var14]) {
                          stackIn_30_0 = param5.normalB[var14];
                          break L6;
                        } else {
                          stackIn_30_0 = -1;
                          break L6;
                        }
                      }
                      L7: {
                        var19 = stackIn_30_0;
                        if (normalX.length > param5.normalC[var14]) {
                          stackIn_33_0 = param5.normalC[var14];
                          break L7;
                        } else {
                          stackIn_33_0 = -1;
                          break L7;
                        }
                      }
                      L8: {
                        L9: {
                          var20 = stackIn_33_0;
                          if (materials == null) {
                            break L9;
                          } else {
                            if (param5.materials == null) {
                              break L9;
                            } else {
                              if (param5.materials.length <= var14) {
                                break L9;
                              } else {
                                if (0 == (param5.materials[var14] ^ -1)) {
                                  break L9;
                                } else {
                                  if (materials.length <= param5.materials[var14]) {
                                    break L9;
                                  } else {
                                    stackIn_40_0 = materials[param5.materials[var14]];
                                    break L8;
                                  }
                                }
                              }
                            }
                          }
                        }
                        stackIn_40_0 = null;
                        break L8;
                      }
                      L10: {
                        L11: {
                          var21 = stackIn_40_0;
                          var22 = screenX[var15];
                          var23 = screenY[var15];
                          var24 = screenX[var16];
                          var25 = screenY[var16];
                          var26 = screenX[var17];
                          var27 = screenY[var17];
                          if (var18 != var19) {
                            break L11;
                          } else {
                            if (var20 != var19) {
                              break L11;
                            } else {
                              L12: {
                                var28 = var54[var18];
                                var29 = var64[var18];
                                if (var21 != null) {
                                  stackIn_45_0 = var21.color;
                                  break L12;
                                } else {
                                  stackIn_45_0 = 8355711;
                                  break L12;
                                }
                              }
                              var30 = stackIn_45_0;
                              var31 = var30 & 16711935;
                              var32 = 65280 & var30;
                              var33 = (-16711703 & var31 * var28) >>> 1087510824 | -285147392 & var32 * var28 >>> -1091139000;
                              var33 = var33 + var29 * 65793;
                              flat(var26, -122, var27, var25, var24, var22, var23, 8355711 & var33 >> -906591487);
                              break L10;
                            }
                          }
                        }
                        L13: {
                          var28 = var54[var18];
                          var29 = var54[var19];
                          var30 = var54[var20];
                          var31 = var64[var18];
                          var32 = var64[var19];
                          var33 = var64[var20];
                          if (var21 != null) {
                            stackIn_49_0 = var21.color;
                            break L13;
                          } else {
                            stackIn_49_0 = 8355711;
                            break L13;
                          }
                        }
                        var34 = stackIn_49_0;
                        var35 = var34 & 16711935;
                        var36 = 65280 & var34;
                        var37 = (var28 * var36 & 16711921) >>> -932940408 | -822148865 & var28 * var35 >>> 1822318632;
                        var38 = (var36 * var29 & 16711688) >>> 1466976808 | (var29 * var35 & -16711783) >>> 1474249800;
                        var38 = var38 + 65793 * var32;
                        var37 = var37 + 65793 * var31;
                        var39 = var30 * var36 >>> -1415641368 & 1543569152 | var30 * var35 >>> -1297425400 & -536936193;
                        var39 = var39 + var33 * 65793;
                        LogoDispatch.draw(255 & var37, 255 & var37 >> 752032680, var39 >> -30653808, var39 >> 1208420200 & 255, var25, 255 & var38, var37 >> 567486192, var23, var26, 255 & var39, -2, var38 >> 637744048, 255 & var38 >> 1425466440, var24, var22, var27);
                        break L10;
                      }
                      var13++;
                      continue L4;
                    }
                  }
                } else {
                  L14: {
                    var14 = var61[var13] * param7 + param4 * var62[var13] - -(var63[var13] * param1) >> -1846498232;
                    if (0 > var14) {
                      var14 = -var14;
                      break L14;
                    } else {
                      break L14;
                    }
                  }
                  L15: {
                    if ((var14 ^ -1) <= -1) {
                      if (128 <= var14) {
                        stackIn_18_0 = 256;
                        break L15;
                      } else {
                        stackIn_18_0 = 128 - -var14;
                        break L15;
                      }
                    } else {
                      stackIn_18_0 = 128;
                      break L15;
                    }
                  }
                  L16: {
                    var14 = stackIn_18_0;
                    var15 = param0 * var63[var13] + (param2 * var62[var13] + param6 * var61[var13]) >> -1093387128;
                    stackIn_20_0 = specular;

                    if (var15 < 0) {
                      stackIn_21_0 = (int[]) ((Object) stackIn_20_0);
                      stackIn_21_1 = -var15;
                      break L16;
                    } else {
                      stackIn_21_0 = (int[]) ((Object) stackIn_20_0);
                      stackIn_21_1 = var15;
                      break L16;
                    }
                  }
                  var15 = stackIn_21_0[stackIn_21_1];
                  var14 = var14 * (256 + -var15) >>> 1405589960;
                  var54[var13] = var14;
                  var64[var13] = var15;
                  var13++;
                  continue L3;
                }
              }
            } else {
              decompiledRegionSelector0 = 0;
              break L0;
            }
          }
        } catch (java.lang.RuntimeException decompiledCaughtParameter0) {
          decompiledCaughtException = decompiledCaughtParameter0;
          L17: {
            var8_ref = decompiledCaughtException;
            stackIn_54_0 = (RuntimeException) (var8_ref);

            stackIn_54_1 = new StringBuilder().append("hi.M(").append(param0).append(',').append(param1).append(',').append(param2).append(',').append(param3).append(',').append(param4).append(',');

            if (param5 == null) {
              stackIn_55_0 = (RuntimeException) ((Object) stackIn_54_0);
              stackIn_55_1 = (StringBuilder) ((Object) stackIn_54_1);
              stackIn_55_2 = "null";
              break L17;
            } else {
              stackIn_55_0 = (RuntimeException) ((Object) stackIn_54_0);
              stackIn_55_1 = (StringBuilder) ((Object) stackIn_54_1);
              stackIn_55_2 = "{...}";
              break L17;
            }
          }
          throw LogoRasterState.failure((Throwable) ((Object) stackIn_55_0), stackIn_55_2 + ',' + param6 + ',' + param7 + ')');
        }
        if (decompiledRegionSelector0 == 0) {
          return;
        } else {
          return;
        }
    }
}
final class LogoMaterial {int color;LogoMaterial(int c){color=c;}}
final class LogoMesh {
 LogoMesh(int vertices,int triangles){normalCount=(short)vertices;faceA=new short[triangles];faceB=new short[triangles];faceC=new short[triangles];normalA=new short[triangles];normalB=new short[triangles];normalC=new short[triangles];materials=new short[triangles];}
 byte[] weights;byte materialMode;short normalCount=8;
 short[] faceA=new short[12],faceB=new short[12],faceC=new short[12],normalA=new short[12],normalB=new short[12],normalC=new short[12],materials=new short[12];
 LogoMesh(int[] faces){for(int i=0;i<12;i++){faceA[i]=(short)faces[i*3];normalA[i]=faceA[i];faceB[i]=(short)faces[i*3+1];normalB[i]=faceB[i];faceC[i]=(short)faces[i*3+2];normalC[i]=faceC[i];}}
}
