import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {digest} from '../game-export.mjs';

// Reflection keeps one identical harness usable on original bytecode, raw Java
// and renamed Java. System properties supply only the reviewed name dictionary.
export const className = 'EscapeTerrainProbe';
export const source = `import java.io.*;import java.lang.reflect.*;import java.util.*;
public class EscapeTerrainProbe {
 static Object unsafe;static Method allocate;static int checks;
 static Class<?> c(String name)throws Exception{return Class.forName(System.getProperty("C."+name,name));}
 static Field f(String owner,String name)throws Exception{
  Class<?> type=c(owner);String mapped=System.getProperty("F."+owner+"."+name,"field_"+name);
  Field field;try{field=type.getDeclaredField(mapped);}catch(NoSuchFieldException missing){field=type.getDeclaredField(name);}
  field.setAccessible(true);return field;
 }
 static Object make(String owner)throws Exception{return allocate.invoke(unsafe,c(owner));}
 static Object construct(String owner,Class<?>[] types,Object...args)throws Exception{
  Constructor<?> constructor=c(owner).getDeclaredConstructor(types);constructor.setAccessible(true);return constructor.newInstance(args);
 }
 static void set(Object object,String owner,String name,Object value)throws Exception{f(owner,name).set(object,value);}
 static Object get(Object object,String owner,String name)throws Exception{return f(owner,name).get(object);}
 static Object call(Object object,String owner,String name,Class<?>[] types,Object...args)throws Exception{
  Method method=c(owner).getDeclaredMethod(System.getProperty("M."+owner+"."+name,name.split(":")[0]),types);
  method.setAccessible(true);try{return method.invoke(object,args);}catch(InvocationTargetException failure){throw new AssertionError(failure.getCause());}
 }
 static void check(String name,Object actual,Object expected){
  if(!Objects.equals(actual,expected))throw new AssertionError(name+": "+actual+" != "+expected);checks++;
 }
 static void terrain()throws Exception{
  Constructor<?> constructor=c("vc").getDeclaredConstructor(DataInputStream.class,int.class);constructor.setAccessible(true);
  for(int version:new int[]{9,10})for(int code:new int[]{0,1,2}){
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);
   out.writeByte(1);out.writeByte(1);out.writeByte(3);if(version>=10)out.writeByte(4);out.writeByte(code);if(code==2)out.writeByte(1);
   Object map=constructor.newInstance(new DataInputStream(new ByteArrayInputStream(bytes.toByteArray())),version);
   check("tiles-x",get(map,"vc","a"),1);check("tiles-y",get(map,"vc","f"),1);
   check("pixels-x",get(map,"vc","h"),32);check("pixels-y",get(map,"vc","g"),32);
   check("theme",get(map,"vc","c"),3);check("secondary-theme",get(map,"vc","b"),version>=10?4:3);
   int[] tile=((int[][])get(map,"vc","d"))[0];
   if(code==0){check("empty",tile==null,true);continue;}
   if(code==1){check("full-sentinel",tile==get(null,"si","v"),true);continue;}
   for(int row=0;row<32;row++)check("quarter-row",tile[row],row<16?65535:0);
  }
 }
 static void stamps()throws Exception{
  Object world=make("oe"),object=make("sa"),sprite=make("ed");
  set(world,"oe","Mb",1);set(world,"oe","D",1);set(world,"oe","n",32);set(null,"ma","a",world);
  set(sprite,"nf","s",1);set(sprite,"nf","x",1);set(sprite,"nf","q",0);set(sprite,"nf","v",0);
  set(sprite,"ed","B",new int[]{0xffffff});set(object,"sa","i",sprite);
  for(int x:new int[]{0,7,16,31})for(int y:new int[]{0,9,31}){
   set(object,"sa","k",x);set(object,"sa","g",y);int[][] masks=new int[1][];set(world,"oe","V",masks);
   call(object,"sa","a:stamp",new Class<?>[]{boolean.class,c("oe")},true,world);
   check("stamp-retained",masks[0]!=null,true);
   for(int row=0;row<32;row++)check("stamp-bit",masks[0][row],row==y?1<<x:0);
   masks[0]=(int[])get(null,"si","v");
   call(object,"sa","a:erase",new Class<?>[]{c("oe"),byte.class},world,(byte)100);
   check("remove-private-mask",masks[0]!=get(null,"si","v"),true);
   for(int row=0;row<32;row++)check("remove-bit",masks[0][row],row==y?~(1<<x):-1);
  }
 }
 static void collections()throws Exception{
  Object deque=c("cn").getDeclaredConstructor().newInstance(),other=c("cn").getDeclaredConstructor().newInstance();
  Object a=make("hg"),b=make("hg");
  check("empty",call(deque,"cn","a:empty",new Class<?>[]{int.class},-98),true);
  call(deque,"cn","a:addLast",new Class<?>[]{int.class,c("hg")},-12328,a);
  call(deque,"cn","a:addLast",new Class<?>[]{int.class,c("hg")},-12328,b);
  check("first",call(deque,"cn","a:first",new Class<?>[]{boolean.class},false)==a,true);
  check("next",call(deque,"cn","b",new Class<?>[]{byte.class},(byte)70)==b,true);
  check("end",call(deque,"cn","b",new Class<?>[]{byte.class},(byte)70)==null,true);
  call(other,"cn","a:addLast",new Class<?>[]{int.class,c("hg")},-12328,a);
  check("transfer",call(deque,"cn","c",new Class<?>[]{int.class},-20245)==b,true);
  check("other",call(other,"cn","c",new Class<?>[]{int.class},-20245)==a,true);
  check("detached",get(a,"hg","d")==null&&get(a,"hg","b")==null,true);
 }
 static void levels()throws Exception{
  // Independently authored streams exercise every format boundary and the
  // complete reader order, without textures, audio devices or member assets.
  for(int version=0;version<=11;version++){
   Object world=make("oe");set(world,"oe","kb",new Vector<>());
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);
   out.writeByte(version);
   if(version>=5)out.writeByte(1);
   if(version>=6){out.writeByte(2);out.writeInt(3000);}
   out.writeByte(2);out.writeByte(1);out.writeByte(3);if(version>=10)out.writeByte(6);out.writeByte(4);
   out.writeByte(2);
   for(int object=0;object<2;object++){
    out.writeByte(object==0?1:8);out.writeShort(20+object);out.writeShort(10+object);
    if(version>=5)out.writeByte(object==1?1:0);
    if(version>=6)out.writeByte(object==1?1:0);
    if(version>=9)out.writeInt(object==1?2:0);
   }
   if(version>=1){out.writeByte(1);out.writeShort(23);out.writeShort(17);}
   if(version>=3){out.writeInt(123<<16);out.writeInt(-44<<16);out.writeInt(4321);}
   if(version>=4)out.writeInt(321);
   if(version>=7){out.writeByte(3);out.writeByte(9);out.writeByte(255);out.writeByte(13);}
   if(version>=8)out.writeShort(768);
   ByteArrayInputStream raw=new ByteArrayInputStream(bytes.toByteArray());
   call(world,"oe","a:decode",new Class<?>[]{boolean.class,int.class,InputStream.class},false,-1,raw);
   check("stream-consumed",raw.available(),0);
   check("objective",get(world,"oe","Q"),version>=5?1:0);
   check("countdown-trigger",get(world,"oe","l"),version>=6?2:0);
   check("countdown-ticks",get(world,"oe","X"),version>=6?3000:0);
   check("countdown-inactive",get(world,"oe","a"),false);
   check("spawn-x",get(world,"oe","t"),version>=3?123<<16:32<<16);
   check("spawn-y",get(world,"oe","bb"),version>=3?-44<<16:-8388608);
   check("initial-fuel",get(world,"oe","U"),version>=3?4321:2500);
   check("initial-shield",get(world,"oe","gc"),version>=4?321:150);
   check("gravity",get(world,"oe","qb"),version>=8?768:512);
   check("terrain-size",get(world,"oe","Mb"),2);check("terrain-theme",get(world,"oe","P"),3);
   check("secondary-theme",get(world,"oe","Yb"),version>=10?6:3);
   int[][] masks=(int[][])get(world,"oe","V"),initial=(int[][])get(world,"oe","Vb");
   check("first-empty-tile",masks[0]==null,true);check("second-full-tile",masks[1]==get(null,"si","v"),true);
   check("separate-snapshot-array",masks!=initial,true);check("snapshot-full-sentinel",initial[1]==masks[1],true);
   Vector<?> objects=(Vector<?>)get(world,"oe","kb");check("object-count",objects.size(),2);
   Object object=objects.elementAt(1);
   check("object-id",get(object,"sa","j"),1);check("object-type-migration",get(object,"sa","n"),version<2?9:8);
   check("object-x",get(object,"sa","k"),21);check("object-y",get(object,"sa","g"),11);
   check("object-target",get(object,"sa","r"),version>=5);check("object-countdown",get(object,"sa","p"),version>=6);
   check("object-frame",get(object,"sa","l"),version>=9?2:0);
   Object mine=call(get(world,"oe","N"),"cn","a:first",new Class<?>[]{boolean.class},false);
   check("mine-exists",mine!=null,version>=1);
   if(mine!=null){
    check("mine-x",get(mine,"ic","p"),23<<16);check("mine-y",get(mine,"ic","q"),17<<16);
    check("mine-home-x",get(mine,"ic","j"),23<<16);check("mine-home-y",get(mine,"ic","l"),17<<16);
   }
   Object powerups=get(world,"oe","s");
   check("valid-powerup-count",call(powerups,"cn","c:size",new Class<?>[]{byte.class},(byte)17),version>=7?2:0);
  }
  Object world=make("oe");
  for(int encoded:new int[]{0,1,255}){
   DataInputStream in=new DataInputStream(new ByteArrayInputStream(new byte[]{(byte)encoded,99}));
   call(world,"oe","a:objective",new Class<?>[]{int.class,DataInputStream.class,byte.class},5,in,(byte)126);
   check("objective-range",get(world,"oe","Q"),encoded==1?1:0);check("objective-width",in.available(),1);
  }
  for(int encoded:new int[]{16,512,768,0,65535}){
   DataInputStream in=new DataInputStream(new ByteArrayInputStream(new byte[]{(byte)(encoded>>>8),(byte)encoded,99}));
   call(world,"oe","a:gravity",new Class<?>[]{int.class,DataInputStream.class,int.class},512,in,8);
   check("gravity-whitelist",get(world,"oe","qb"),encoded==16||encoded==768?encoded:512);check("gravity-width",in.available(),1);
  }
  for(int encoded:new int[]{0,-1,2468}){
   ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);
   out.writeInt(0);out.writeInt(0);out.writeInt(encoded);out.writeInt(encoded);out.writeByte(99);
   DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes.toByteArray()));
   call(world,"oe","a:spawn",new Class<?>[]{byte.class,DataInputStream.class,int.class},(byte)121,in,3);
   call(world,"oe","b:shield",new Class<?>[]{int.class,DataInputStream.class,int.class},-112,in,4);
   check("fuel-default",get(world,"oe","U"),encoded>0?encoded:2500);
   check("shield-default",get(world,"oe","gc"),encoded>0?encoded:150);check("configuration-width",in.available(),1);
  }
 }
 static void widgets()throws Exception{
  Object component=make("hm");
  call(component,"hm","a:bounds",new Class<?>[]{int.class,int.class,int.class,boolean.class,int.class},30,20,10,true,40);
  check("widget-x",get(component,"hm","k"),10);check("widget-y",get(component,"hm","j"),20);
  check("widget-width",get(component,"hm","g"),30);check("widget-height",get(component,"hm","x"),40);
  int[][] cases={{9,20,0,0,0},{10,19,0,0,0},{10,20,0,0,1},{39,59,0,0,1},{40,59,0,0,0},{39,60,0,0,0},
    {15,27,5,7,1},{14,27,5,7,0},{45,27,5,7,0},{15,67,5,7,0}};
  for(int[] point:cases)check("widget-hit",call(component,"hm","a:hit",new Class<?>[]{int.class,int.class,int.class,byte.class,int.class},
    point[0],point[1],point[2],(byte)70,point[3]),point[4]!=0);
  set(component,"hm","i","tooltip");set(component,"hm","u",true);
  check("hover-tooltip",call(component,"hm","d:tooltip",new Class<?>[]{int.class},1),"tooltip");
  set(component,"hm","u",false);check("no-hover-tooltip",call(component,"hm","d:tooltip",new Class<?>[]{int.class},1),null);
  check("base-focus",call(component,"hm","h:focus",new Class<?>[]{int.class},0),false);
  int[] actions={0};Object[][] last={null};
  Object listener=Proxy.newProxyInstance(c("qb").getClassLoader(),new Class<?>[]{c("qb")},(proxy,method,args)->{
    actions[0]++;last[0]=args.clone();return null;
  });
  Constructor<?> constructor=c("hc").getDeclaredConstructor(String.class,c("db"),c("wn"));constructor.setAccessible(true);
  Object button=constructor.newInstance("probe",null,listener);
  check("button-unfocused",call(button,"hm","h:focus",new Class<?>[]{int.class},0),false);
  check("button-focus-traversal",call(button,"hm","a:focusNext",new Class<?>[]{int.class,c("hm")},-4659,button),true);
  check("button-focused",call(button,"hm","h:focus",new Class<?>[]{int.class},0),true);
  check("button-enter",call(button,"hm","a:key",new Class<?>[]{c("hm"),char.class,int.class,int.class},button,(char)0,84,23),true);
  check("button-callback-count",actions[0],1);check("button-code",last[0][1],1);
  check("keyboard-pointer-y",last[0][2],-1);check("keyboard-pointer-x",last[0][4],-1);
  call(button,"hm","f:blur",new Class<?>[]{int.class},93);
  check("button-focus-cleared",call(button,"hm","h:focus",new Class<?>[]{int.class},0),false);
 }
 static void textGeometry()throws Exception{
  // Authored line geometry checks global indices, midpoint ties and vertical
  // gaps independently of the font parser, rendering and layout generator.
  Object first=make("vl"),second=make("vl"),layout=make("wh");
  set(first,"vl","d",0);set(first,"vl","a",10);set(first,"vl","b",new int[]{0,10,20});
  set(second,"vl","d",12);set(second,"vl","a",24);set(second,"vl","b",new int[]{5,13,22,30});
  Object lines=Array.newInstance(c("vl"),2);Array.set(lines,0,first);Array.set(lines,1,second);set(layout,"pg","a",lines);
  check("text-height",call(layout,"pg","c:height",new Class<?>[]{int.class},0),24);
  check("text-maximum-width",call(layout,"pg","a:width",new Class<?>[]{byte.class},(byte)-112),30);
  int[] lineFor={0,0,0,1,1,1,2},xFor={0,10,20,13,22,30,0};
  for(int index=0;index<lineFor.length;index++){
   check("text-character-line",call(layout,"pg","a:line",new Class<?>[]{int.class,int.class},index,0),lineFor[index]);
   check("text-character-x",call(layout,"pg","a:x",new Class<?>[]{byte.class,int.class},(byte)122,index),xFor[index]);
  }
  int[][] points={{-10,0,0},{4,0,0},{5,0,1},{15,10,2},{0,11,-1},{8,12,2},{9,12,3},{26,24,5},{30,25,-1}};
  for(int[] point:points)check("text-point-index",call(layout,"pg","a:hit",new Class<?>[]{byte.class,int.class,int.class},(byte)39,point[0],point[1]),point[2]);
  check("line-width",call(first,"vl","b:width",new Class<?>[]{int.class},119),20);
  int[][] closest={{-1000,0},{4,0},{5,1},{14,1},{15,2},{1000,2}};
  for(int[] point:closest)check("line-midpoint",call(first,"vl","a:hit",new Class<?>[]{byte.class,int.class},(byte)52,point[0]),point[1]);
  for(String text:new String[]{"a b c","a<col=fff> b</col> c","abc"})
   check("text-justification",call(layout,"pg","a:justify",new Class<?>[]{int.class,int.class,String.class,int.class},-21446,20,text,30),text.equals("abc")?0:1280);
  set(layout,"pg","a",Array.newInstance(c("vl"),0));
  check("empty-text-height",call(layout,"pg","c:height",new Class<?>[]{int.class},0),0);
  check("empty-text-width",call(layout,"pg","a:width",new Class<?>[]{byte.class},(byte)-112),-1);
  check("empty-text-hit",call(layout,"pg","a:hit",new Class<?>[]{byte.class,int.class,int.class},(byte)39,0,0),-1);
  check("empty-text-line",call(layout,"pg","a:line",new Class<?>[]{int.class,int.class},0,0),0);
  check("empty-text-x",call(layout,"pg","a:x",new Class<?>[]{byte.class,int.class},(byte)122,0),0);
  set(first,"vl","b",null);
  check("null-line-width",call(first,"vl","b:width",new Class<?>[]{int.class},119),0);
  check("null-line-hit",call(first,"vl","a:hit",new Class<?>[]{byte.class,int.class},(byte)52,12),0);
  set(layout,"pg","a",null);
  check("null-text-height",call(layout,"pg","c:height",new Class<?>[]{int.class},0),0);
  check("null-text-width",call(layout,"pg","a:width",new Class<?>[]{byte.class},(byte)-112),-1);
  check("null-text-hit",call(layout,"pg","a:hit",new Class<?>[]{byte.class,int.class,int.class},(byte)39,0,0),-1);
 }
 static int littleBits(byte[] bytes,int start,int count){
  long value=0;for(int bit=0;bit<count;bit++)if((bytes[(start+bit)/8]&(1<<((start+bit)%8)))!=0)value+=1L<<bit;
  return (int)value;
 }
 static byte[] bitPacket(int[][] fields){
  byte[] bytes=new byte[64];int position=0;
  for(int[] field:fields)for(int bit=0;bit<field[0];bit++,position++)bytes[position/8]|=(byte)(((field[1]>>>bit)&1)<<(position%8));
  return Arrays.copyOf(bytes,(position+7)/8);
 }
 static void audioFormats()throws Exception{
  byte[] bytes={(byte)0xca,0x71,(byte)0x9f,0x26,(byte)0xd4,0x52,(byte)0x83,0x6b};
  for(int offset=0;offset<2;offset++)for(int prefix=0;prefix<8;prefix++)for(int width:new int[]{0,1,7,8,9,16,23,32}){
   call(null,"in","a:bits",new Class<?>[]{byte[].class,int.class},bytes,offset);
   call(null,"in","e:read",new Class<?>[]{int.class},prefix);
   check("vorbis-lsb-order",call(null,"in","e:read",new Class<?>[]{int.class},width),littleBits(bytes,offset*8+prefix,width));
   check("vorbis-byte-cursor",get(null,"in","o"),offset+(prefix+width)/8);
   check("vorbis-bit-cursor",get(null,"in","C"),(prefix+width)%8);
   check("vorbis-next-bit",call(null,"in","c:bit",new Class<?>[]{}),littleBits(bytes,offset*8+prefix+width,1));
  }
  int[] packed={0,788<<21|1,788<<21|3,787<<21|3,789<<21|2,Integer.MIN_VALUE|788<<21|3};
  float[] values={0f,1f,3f,1.5f,4f,-3f};
  for(int i=0;i<packed.length;i++)check("vorbis-packed-float",Float.floatToIntBits((Float)call(null,"in","d:float",new Class<?>[]{int.class},packed[i])),Float.floatToIntBits(values[i]));
  Object instrument=make("we");
  int[][] waves={{0,100,1,100},{16383,100,1,100},{16384,100,1,-100},{32768,100,1,100},
    {0,100,3,-100},{8192,100,3,-50},{16384,100,3,0},{32767,100,3,99},{123,100,0,0},{123,100,5,0}};
  for(int[] wave:waves)check("instrument-wave",call(instrument,"we","a:wave",new Class<?>[]{int.class,int.class,int.class},wave[0],wave[1],wave[2]),wave[3]);
  Object floor=make("u");int[] points={0,16,4,12,8};
  for(int[] neighbor:new int[][]{{2,0,1},{4,2,3}}){
   check("floor-low-neighbor",call(null,"u","b:low",new Class<?>[]{int[].class,int.class},points,neighbor[0]),neighbor[1]);
   check("floor-high-neighbor",call(null,"u","a:high",new Class<?>[]{int[].class,int.class},points,neighbor[0]),neighbor[2]);
  }
  for(int[] point:new int[][]{{0,10,8,2,0,10},{0,10,8,2,4,6},{0,10,8,2,8,2},{0,2,8,10,4,6},{0,1,3,8,1,3}})
   check("floor-interpolation",call(floor,"u","a:point",new Class<?>[]{int.class,int.class,int.class,int.class,int.class},point[0],point[1],point[2],point[3],point[4]),point[5]);
  Object book=make("fm");set(book,"fm","c",3);set(book,"fm","d",new int[]{1,2,2});set(book,"fm","a",new float[][]{{1,2},{3,4},{5,6}});
  call(book,"fm","b:tree",new Class<?>[]{});
  // Canonical prefix codes 0,10,11 are transmitted in that order, LSB first.
  for(boolean vector:new boolean[]{false,true}){
   call(null,"in","a:bits",new Class<?>[]{byte[].class,int.class},new byte[]{0x1a},0);
   for(int entry=0;entry<3;entry++)if(vector)
    check("codebook-vector",Arrays.equals((float[])call(book,"fm","a:vector",new Class<?>[]{}),new float[]{1+entry*2,2+entry*2}),true);
   else check("codebook-scalar",call(book,"fm","c:scalar",new Class<?>[]{}),entry);
  }
  for(int[] lookup:new int[][]{{16,2,4},{17,2,4},{27,3,3}})
   check("codebook-lookup-count",call(null,"fm","a:lookup",new Class<?>[]{int.class,int.class},lookup[0],lookup[1]),lookup[2]);
  for(int submaps:new int[]{1,3}){
   List<int[]> encoded=new ArrayList<>();encoded.add(new int[]{16,0});encoded.add(new int[]{1,submaps==1?0:1});
   if(submaps>1)encoded.add(new int[]{4,submaps-1});encoded.add(new int[]{1,submaps==1?0:1});
   if(submaps>1)encoded.add(new int[]{8,173});encoded.add(new int[]{2,0});
   if(submaps>1)encoded.add(new int[]{4,2});
   for(int i=0;i<submaps;i++){encoded.add(new int[]{8,0});encoded.add(new int[]{8,i+1});encoded.add(new int[]{8,i+4});}
   call(null,"in","a:bits",new Class<?>[]{byte[].class,int.class},bitPacket(encoded.toArray(new int[0][])),0);
   Object mapping=construct("pm",new Class<?>[]{});
   check("mapping-submaps",get(mapping,"pm","a"),submaps);check("mapping-mux",get(mapping,"pm","b"),submaps==1?0:2);
   int[] floors=(int[])get(mapping,"pm","d"),residues=(int[])get(mapping,"pm","c");
   for(int i=0;i<submaps;i++){check("mapping-floor",floors[i],i+1);check("mapping-residue",residues[i],i+4);}
   int bitCount=encoded.stream().mapToInt(field->field[0]).sum();
   check("mapping-byte-count",get(null,"in","o"),bitCount/8);check("mapping-bit-count",get(null,"in","C"),bitCount%8);
  }
  ByteArrayOutputStream raw=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(raw);
  out.writeInt(22050);out.writeInt(8);out.writeInt(2);out.writeInt(~7);out.writeInt(2);out.writeByte(3);out.write(new byte[]{1,2,3});
  byte[] longPacket=new byte[256];for(int i=0;i<longPacket.length;i++)longPacket[i]=(byte)i;
  out.writeByte(255);out.writeByte(1);out.write(longPacket);
  Object sample=construct("in",new Class<?>[]{byte[].class},raw.toByteArray());
  check("sample-rate",get(sample,"in","v"),22050);check("sample-count",get(sample,"in","y"),8);
  check("sample-loop-start",get(sample,"in","L"),2);check("sample-loop-end",get(sample,"in","F"),7);check("sample-pingpong",get(sample,"in","A"),true);
  byte[][] packets=(byte[][])get(sample,"in","h");check("sample-packets",packets.length,2);
  check("sample-short-packet",Arrays.equals(packets[0],new byte[]{1,2,3}),true);check("sample-long-packet",Arrays.equals(packets[1],longPacket),true);
  Object buffer=construct("n",new Class<?>[]{byte[].class},new byte[14]);
  Object effect=construct("kj",new Class<?>[]{c("n")},buffer),pcm=call(effect,"kj","a:pcm",new Class<?>[]{});
  check("empty-effect-rate",get(pcm,"hh","j"),22050);check("empty-effect-samples",((byte[])get(pcm,"hh","h")).length,0);
  check("empty-effect-loop-start",get(pcm,"hh","k"),0);check("empty-effect-loop-end",get(pcm,"hh","l"),0);
  Object filter=construct("cl",new Class<?>[]{}),envelope=construct("wj",new Class<?>[]{});
  buffer=construct("n",new Class<?>[]{byte[].class},new byte[]{0});
  call(filter,"cl","a:decode",new Class<?>[]{c("n"),c("wj")},buffer,envelope);
  check("empty-filter-pairs",Arrays.equals((int[])get(filter,"cl","g"),new int[]{0,0}),true);
  check("empty-filter-consumed",get(buffer,"n","m"),1);
  check("empty-filter-coefficients",call(filter,"cl","a:coefficients",new Class<?>[]{int.class,float.class},0,0f),0);
  check("empty-filter-unity",get(null,"cl","c"),65536);
 }
 static void pcmKernels()throws Exception{
  Object sample=make("hh");set(sample,"hh","h",new byte[]{10,20,30,40,50,60});set(sample,"hh","j",22050);set(sample,"hh","k",0);set(sample,"hh","l",6);
  for(boolean stereo:new boolean[]{false,true})for(boolean reverse:new boolean[]{false,true})
   for(boolean interpolate:new boolean[]{false,true})for(boolean ramp:new boolean[]{false,true}){
    set(null,"ie","o",stereo);int step=interpolate?128:256;
    Object stream=call(null,"hl","a:create",new Class<?>[]{c("hh"),int.class,int.class,int.class},sample,step,64,8192);
    if(reverse)call(stream,"hl","e:reverse",new Class<?>[]{});
    if(ramp)call(stream,"hl","a:ramp",new Class<?>[]{int.class,int.class,int.class},4,128,8192);
    int channels=stereo?2:1;int[] output=new int[3*channels];
    call(stream,"wg","b:mix",new Class<?>[]{int[].class,int.class,int.class},output,0,3);
    int[] amplitudes=reverse?(interpolate?new int[]{50,45,40}:new int[]{60,50,40}):(interpolate?new int[]{10,15,20}:new int[]{10,20,30});
    for(int frame=0;frame<3;frame++)for(int channel=0;channel<channels;channel++)
     check("pcm-kernel-output",output[frame*channels+channel],amplitudes[frame]*(ramp?256+64*frame:256));
    check("pcm-position",get(stream,"hl","u"),reverse?1280-3*step:3*step);
    check("pcm-gain",get(stream,"hl","m"),ramp?112:64);check("pcm-ramp-remaining",get(stream,"hl","v"),ramp?1:0);
   }
  for(int[] pan:new int[][]{{-1,4096,-4096},{0,5793,0},{8192,4096,4096},{16384,0,5793}}){
   check("pcm-left-pan",call(null,"hl","d:left",new Class<?>[]{int.class,int.class},4096,pan[0]),pan[1]);
   check("pcm-right-pan",call(null,"hl","a:right",new Class<?>[]{int.class,int.class},4096,pan[0]),pan[2]);
  }
  set(null,"ie","o",false);
 }
 public static void main(String[] args)throws Exception{
  Class<?> unsafeClass=Class.forName("sun.misc.Unsafe");Field field=unsafeClass.getDeclaredField("theUnsafe");field.setAccessible(true);unsafe=field.get(null);allocate=unsafeClass.getMethod("allocateInstance",Class.class);
  terrain();stamps();collections();System.out.println("checks="+checks);
  int previous=checks;levels();System.out.println("level-checks="+(checks-previous));
  previous=checks;widgets();System.out.println("widget-checks="+(checks-previous));
  previous=checks;textGeometry();System.out.println("text-checks="+(checks-previous));
  previous=checks;audioFormats();System.out.println("audio-checks="+(checks-previous));
  previous=checks;pcmKernels();System.out.println("pcm-checks="+(checks-previous));
 }
}
`;

// Used by refresh-raw-class as an original-bytecode correctness gate.
export const expected = 'checks=903\nlevel-checks=393\nwidget-checks=26\ntext-checks=45\naudio-checks=578\npcm-checks=128';

export function verifyEscapeCore(input, named, mapping, classpath, temporary) {
  const aliases = new Map(mapping.rules.map(r => [r.symbol, r.to]));
  const properties = [];
  for (const rule of mapping.rules) {
    if (rule.symbol.startsWith('C:')) properties.push('-DC.' + rule.symbol.slice(2) + '=' + rule.to);
    if (rule.symbol.startsWith('F:')) {
      const match = /^F:([^.]+)\.field_([^:]+):/.exec(rule.symbol);
      if (match) properties.push(`-DF.${match[1]}.${match[2]}=${rule.to}`);
    }
  }
  // The harness resolves overloads with their actual argument types. Only the
  // two stamped-object overloads retain a shared name, as do deque insertions.
  for (const [owner, name, descriptor, tag] of [
    ['sa','a','(ZLoe;)V','stamp'],['sa','a','(Loe;B)V','erase'],
    ['cn','a','(I)Z','empty'],['cn','a','(ILhg;)V','addLast'],['cn','a','(Z)Lhg;','first'],
    ['cn','b','(B)Lhg;',null],['cn','c','(I)Lhg;',null],
    ['cn','c','(B)I','size'],
    ['oe','a','(ZILjava/io/InputStream;)V','decode'],
    ['oe','a','(ILjava/io/DataInputStream;B)V','objective'],
    ['oe','a','(ILjava/io/DataInputStream;I)V','gravity'],
    ['oe','a','(BLjava/io/DataInputStream;I)V','spawn'],
    ['oe','b','(ILjava/io/DataInputStream;I)V','shield'],
    ['hm','a','(IIIZI)V','bounds'],['hm','a','(IIIBI)Z','hit'],['hm','d','(I)Ljava/lang/String;','tooltip'],
    ['hm','h','(I)Z','focus'],['hm','a','(ILhm;)Z','focusNext'],['hm','a','(Lhm;CII)Z','key'],['hm','f','(I)V','blur'],
    ['pg','c','(I)I','height'],['pg','a','(B)I','width'],['pg','a','(II)I','line'],['pg','a','(BI)I','x'],
    ['pg','a','(BII)I','hit'],['pg','a','(IILjava/lang/String;I)I','justify'],['vl','b','(I)I','width'],['vl','a','(BI)I','hit'],
    ['in','a','([BI)V','bits'],['in','e','(I)I','read'],['in','c','()I','bit'],['in','d','(I)F','float'],
    ['we','a','(III)I','wave'],['u','b','([II)I','low'],['u','a','([II)I','high'],['u','a','(IIIII)I','point'],
    ['fm','b','()V','tree'],['fm','a','()[F','vector'],['fm','c','()I','scalar'],['fm','a','(II)I','lookup'],
    ['kj','a','()Lhh;','pcm'],['cl','a','(Ln;Lwj;)V','decode'],['cl','a','(IF)I','coefficients'],
    ['hl','a','(Lhh;III)Lhl;','create'],['hl','e','()V','reverse'],['hl','a','(III)V','ramp'],
    ['wg','b','([III)V','mix'],['hl','d','(II)I','left'],['hl','a','(II)I','right'],
  ]) {
    const to = aliases.get(`M:${owner}.${name}${descriptor}`);
    if (to) properties.push(`-DM.${owner}.${name}${tag ? ":"+tag : ""}=${to}`);
  }
  const harness = path.join(temporary, className + '.java');fs.writeFileSync(harness, source);
  const outputs = [];
  for (const [label, directory] of [['historical',path.join(temporary,'historical-source')],['prepared',input],['named',named]]) {
    const classes = path.join(temporary, label + '-core');fs.mkdirSync(classes);
    const args = path.join(temporary, label + '.args');
    fs.writeFileSync(args, [...sourceInventory(directory).map(f => JSON.stringify(path.join(directory,f.path))), JSON.stringify(harness)].join('\n'));
    captureProcess('javac', ['--release','8','-encoding','UTF-8','-cp',classpath,'-d',classes,'@'+args]);
    const result = captureProcess('java', [...(label === 'named' ? properties : []), '-Xverify:all', '-cp',classes+path.delimiter+classpath,className]).stdout.toString().trim();
    assert.equal(result, expected, label + ' core differs from independent expected values');outputs.push(result);
  }
  assert.equal(new Set(outputs).size,1);
  return {historicalPreparedNamedMatch:true, expected, harnessSha256:digest(source),
    covers:['terrain header versions 9/10','empty/full/partial masks','sprite terrain stamping/removal','intrusive deque transfer',
      'complete level streams versions 0-11','object target/countdown/frame version boundaries','seeker spawn/home positions',
      'initial powerup filtering','fuel/shield defaults','objective/gravity whitelists','exact stream consumption',
      'widget hit-test boundaries/origins','hover versus keyboard focus','virtual focus traversal and Enter action callback',
      'text insertion indices across lines','midpoint ties and vertical hit-test gaps','markup-aware justification','empty/null text geometry',
      'LSB-first Vorbis bits and cursor boundaries','packed floats and canonical codebook entries','floor neighbors/interpolation',
      'mapping mux and byte consumption','packet length extension and loop flags','empty synthesized effects and filter unity',
      'oscillator boundaries','all sixteen PCM forward/reverse mono/stereo interpolation/ramp kernels','equal-power pan endpoints'],
    fullGameplayVerified:false};
}

// Optional original-input audit; source export itself uses only committed
// source/stubs and does not depend on a disposable .work gamepack cache.
export function verifyOriginalEscapeCore(gamepack) {
  const bytes = fs.readFileSync(gamepack);
  const gamepackSha256 = '8daf42d4c7c434f6b52d49e25e2854b9970f41e51b8696856d9c6b5e9dd55e69';
  assert.equal(digest(bytes), gamepackSha256, 'Original Escape Vector gamepack identity differs');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'escape-original-core-'));
  try {
    const harness = path.join(temporary, className + '.java'); fs.writeFileSync(harness, source);
    captureProcess('javac', ['--release','8','-cp',path.resolve(gamepack),'-d',temporary,harness]);
    const output = captureProcess('java', ['-Xverify:all','-cp',temporary+path.delimiter+path.resolve(gamepack),className]).stdout.toString().trim();
    assert.equal(output, expected, 'Original gamepack core differs from independent expected values');
    return {gamepackSha256, expected, originalGamepackMatch:true};
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [gamepack, ...extra] = process.argv.slice(2);
  if (!gamepack || extra.length) throw new Error('Usage: node readable/tests/test-escapevector-core.mjs ORIGINAL_GAMEPACK.jar');
  console.log(JSON.stringify(verifyOriginalEscapeCore(gamepack)));
}
