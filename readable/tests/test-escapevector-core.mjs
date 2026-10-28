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
 static Object spawnBullet(Object world,int x,int y,int vx,int vy,int kind)throws Exception{
  call(world,"oe","b:spawnBullet",new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class},y,x,vy,256,kind,vx);
  return get(world,"oe","nb");
 }
 static void bulletState(Object bullet,int x,int y,int vx,int vy,int kind,int ticks,boolean inactive)throws Exception{
  String[] fields={"j","l","n","g","k","m","h"};Object[] values={x,y,vx,vy,kind,ticks,inactive};
  for(int i=0;i<fields.length;i++)check("bullet-"+fields[i],get(bullet,"vh",fields[i]),values[i]);
 }
 static void bulletPool()throws Exception{
  Object bullet=construct("vh",new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class},7,11,-3,5,1,90);
  bulletState(bullet,7,11,-3,5,1,90,false);
  call(bullet,"vh","a:reset",new Class<?>[]{int.class,boolean.class,int.class,int.class,byte.class,int.class,int.class,int.class},19,true,23,-29,(byte)-124,0,31,37);
  bulletState(bullet,19,31,23,-29,0,37,true);
  call(bullet,"vh","d:deactivate",new Class<?>[]{int.class},-37);bulletState(bullet,0,0,0,0,0,0,true);
  Object world=make("oe"),deque=construct("cn",new Class<?>[]{});
  set(world,"oe","n",64);set(world,"oe","G",deque);
  Object a=spawnBullet(world,-65536,10<<16,3,-5,0),b=spawnBullet(world,2<<16,20<<16,7,-11,1),c=spawnBullet(world,3<<16,30<<16,13,-17,0);
  bulletState(a,63<<16,10<<16,3,-5,0,250,false);
  check("pool-allocated-three",get(world,"oe","O"),3);check("pool-active-three",get(world,"oe","x"),3);
  set(b,"vh","h",true);call(world,"oe","F:recycle",new Class<?>[]{int.class},127);
  check("recycle-keeps-capacity",get(world,"oe","O"),3);check("recycle-active-two",get(world,"oe","x"),2);
  check("recycle-last-active",get(world,"oe","nb")==c,true);bulletState(b,0,0,0,0,0,0,true);
  check("pool-prefix-first",call(deque,"cn","a:first",new Class<?>[]{boolean.class},false)==a,true);
  check("pool-prefix-second",call(deque,"cn","b",new Class<?>[]{byte.class},(byte)70)==c,true);
  check("pool-inactive-tail",call(deque,"cn","b",new Class<?>[]{byte.class},(byte)70)==b,true);
  Object reused=spawnBullet(world,65<<16,40<<16,-19,23,1);
  check("pool-reuses-retired-object",reused==b,true);bulletState(reused,1<<16,40<<16,-19,23,1,250,false);
  check("reuse-keeps-capacity",get(world,"oe","O"),3);check("reuse-active-three",get(world,"oe","x"),3);
  for(Object item:new Object[]{a,b,c})set(item,"vh","h",true);
  call(world,"oe","F:recycle",new Class<?>[]{int.class},127);
  check("all-retired-no-last",get(world,"oe","nb"),null);check("all-retired-active-zero",get(world,"oe","x"),0);
  check("all-retired-capacity-retained",get(world,"oe","O"),3);
  check("empty-prefix-reuses-first",spawnBullet(world,4,5,6,7,0)==a,true);
  check("empty-prefix-no-allocation",get(world,"oe","O"),3);check("empty-prefix-one-active",get(world,"oe","x"),1);
 }
 static void sessionTerrain()throws Exception{
  Object world=make("oe");int[] full=(int[])get(null,"si","v"),partial=new int[32];partial[5]=1<<7;
  int[][] current={null,full,partial,new int[32]},initial={full,null};
  set(world,"oe","Mb",2);set(world,"oe","D",2);set(world,"oe","n",64);set(world,"oe","nc",1);
  set(world,"oe","V",current);set(world,"oe","Vb",initial);
  for(int y=-1;y<=3;y++)for(int x=0;x<6;x++){
   Object actual=call(world,"oe","a:tile",new Class<?>[]{int.class,int.class,int.class},y,-1,x);
   check("current-tile-wrap-and-y-boundary",actual==(y<0?null:y>=2?full:current[y*2+x%2]),true);
   actual=call(world,"oe","a:initialTile",new Class<?>[]{int.class,byte.class,int.class},x,(byte)-82,y);
   check("initial-tile-independent-height",actual==(y<0?null:y>=1?full:initial[x%2]),true);
  }
  for(int y:new int[]{0,5,31})for(int x:new int[]{0,7,31}){
   check("partial-mask-pixel",call(world,"oe","a:solid",new Class<?>[]{int[].class,int.class,byte.class,int.class},partial,x,(byte)-74,y),x==7&&y==5);
   check("full-sentinel-pixel",call(world,"oe","a:solid",new Class<?>[]{int[].class,int.class,byte.class,int.class},full,x,(byte)-74,y),true);
  }
  Class<?>[] ray={int.class,int.class,int.class,int.class,int.class,int.class};
  check("ray-above-map",call(world,"oe","a:ray",ray,70,0,-1<<16,-2<<16,1<<16,0),true);
  check("ray-below-map",call(world,"oe","a:ray",ray,1,0,64<<16,0,0,0),false);
  check("ray-crosses-full-tile",call(world,"oe","a:ray",ray,4,0,0,30<<16,1<<16,0),false);
  check("ray-wraps-to-empty",call(world,"oe","a:ray",ray,3,0,0,64<<16,1<<16,0),true);
  check("ray-empty-count",call(world,"oe","a:ray",ray,0,0,64<<16,0,0,0),true);
  check("ray-hits-authored-pixel",call(world,"oe","a:ray",ray,8,0,37<<16,0,1<<16,0),false);
  check("ray-misses-authored-pixel",call(world,"oe","a:ray",ray,7,0,37<<16,0,1<<16,0),true);
  Object geometry=construct("uk",new Class<?>[]{});
  String[] points={"e","k","d","g","c"};int[][] xy={{0,0},{16,0},{16,12},{8,16},{24,16}};
  for(int i=0;i<points.length;i++)set(geometry,"uk",points[i],construct("ga",new Class<?>[]{int.class,int.class},xy[i][0]<<(i==0?0:11),xy[i][1]<<(i==0?0:11)));
  for(int[] sample:new int[][]{{12,10,-1},{20,10,1},{16,14,0},{0,0,0}})
   check("hull-half-and-notch",call(world,"oe","a:classify",new Class<?>[]{c("uk"),byte.class,int.class,int.class},geometry,(byte)15,sample[1],sample[0]),sample[2]);
 }
 static void sessionColorsAndClock()throws Exception{
  Object world=make("oe");
  for(int packed:new int[]{0,0xffffff,0x123456,0xffabcdef}){
   check("red-channel",call(world,"oe","d:red",new Class<?>[]{int.class,int.class},packed,30351),(packed>>>16)&255);
   check("green-channel",call(world,"oe","b:green",new Class<?>[]{int.class,int.class},packed,16082),(packed>>>8)&255);
   check("blue-channel",call(world,"oe","a:blue",new Class<?>[]{int.class,int.class},-99,packed),packed&255);
   check("rgb-pack",call(world,"oe","a:rgb",new Class<?>[]{int.class,int.class,boolean.class,int.class},packed&255,(packed>>>16)&255,true,(packed>>>8)&255),packed&0xffffff);
  }
  Class<?>[] pulse={byte.class,int.class,int.class,int.class};int normal=0x102030,expired=0x506070;
  check("inactive-countdown-color",call(world,"oe","a:color",pulse,(byte)100,100,normal,expired),normal);
  set(world,"oe","a",true);
  for(int[] sample:new int[][]{{0,expired},{-1,expired},{100,expired},{75,0x304050},{50,normal},{25,0x304050},{1,0x4f5f6f}}){
   set(world,"oe","X",sample[0]);check("countdown-triangle-color",call(world,"oe","a:color",pulse,(byte)100,100,normal,expired),sample[1]);
  }
  set(world,"oe","a",false);
  int[] ticks={0,49,50,2999,3000,180000,2159999,2160000};String[] text={"0:00:00","0:00:00","0:00:01","0:00:59","0:01:00","1:00:00","11:59:59","12:00:00+"};
  for(int i=0;i<ticks.length;i++){set(world,"oe","cb",ticks[i]);check("fifty-tick-session-clock",call(world,"oe","g:clock",new Class<?>[]{boolean.class},true),text[i]);}
  set(world,"oe","a",true);set(world,"oe","X",1500);
  check("countdown-overrides-capped-elapsed",call(world,"oe","g:clock",new Class<?>[]{boolean.class},true),"0:00:30");
 }
 static Object buffer(byte[] bytes)throws Exception{return construct("n",new Class<?>[]{byte[].class},bytes);}
 static void bufferBytes(String label,Object buffer,int...expected)throws Exception{
  byte[] bytes=(byte[])get(buffer,"n","g"),wanted=new byte[expected.length];for(int i=0;i<wanted.length;i++)wanted[i]=(byte)expected[i];
  check(label,Arrays.toString(Arrays.copyOf(bytes,wanted.length)),Arrays.toString(wanted));
 }
 static void packetOperations()throws Exception{
  Object out=buffer(new byte[128]);
  call(out,"n","f:writeByte",new Class<?>[]{int.class,int.class},0x89,-123);
  call(out,"n","h:writeShort",new Class<?>[]{int.class,int.class},-123,0xabcd);
  call(out,"n","b:writeMedium",new Class<?>[]{int.class,int.class},1743120456,0x123456);
  call(out,"n","a:writeInt",new Class<?>[]{byte.class,int.class},(byte)123,0x789abcde);
  call(out,"n","a:writeLong",new Class<?>[]{long.class,byte.class},0x0123456789abcdefL,(byte)-23);
  call(out,"n","a:write56",new Class<?>[]{int.class,long.class},104,0x0123456789abcdL);
  call(out,"n","a:write40",new Class<?>[]{long.class,int.class},0x0123456789L,-100);
  check("packet-fixed-width-position",get(out,"n","m"),30);
  bufferBytes("packet-big-endian-bytes",out,0x89,0xab,0xcd,0x12,0x34,0x56,0x78,0x9a,0xbc,0xde,1,0x23,0x45,0x67,0x89,0xab,0xcd,0xef,1,0x23,0x45,0x67,0x89,0xab,0xcd,1,0x23,0x45,0x67,0x89);
  set(out,"n","m",0);
  check("packet-signed-byte",call(out,"n","a:readByte",new Class<?>[]{boolean.class},false),(byte)0x89);
  check("packet-unsigned-short",call(out,"n","f:readShort",new Class<?>[]{int.class},1952),0xabcd);
  check("packet-unsigned-medium",call(out,"n","d:readMedium",new Class<?>[]{byte.class},(byte)-128),0x123456);
  check("packet-signed-int",call(out,"n","g:readInt",new Class<?>[]{int.class},-5053),0x789abcde);
  check("packet-long",call(out,"n","i:readLong",new Class<?>[]{int.class},-800509813),0x0123456789abcdefL);
  set(out,"n","m",0);byte[] destination=new byte[8];Arrays.fill(destination,(byte)-1);
  call(out,"n","a:readBytes",new Class<?>[]{byte[].class,byte.class,int.class,int.class},destination,(byte)-96,2,3);
  check("packet-read-slice",Arrays.toString(destination),"[-1, -1, -119, -85, -51, -1, -1, -1]");check("packet-read-slice-position",get(out,"n","m"),3);
  out=buffer(new byte[16]);byte[] source={9,1,2,3,8};
  call(out,"n","a:writeBytes",new Class<?>[]{int.class,byte.class,int.class,byte[].class},3,(byte)21,1,source);
  call(out,"n","g:pad",new Class<?>[]{int.class,int.class},-1,6);bufferBytes("packet-slice-and-padding",out,1,2,3,0,0,0);check("packet-padding-position",get(out,"n","m"),6);
  out=buffer(new byte[8]);set(out,"n","m",1);call(out,"n","a:writeBytes",new Class<?>[]{int.class,byte.class,int.class,byte[].class},3,(byte)21,1,source);
  call(out,"n","e:byteLength",new Class<?>[]{int.class,int.class},82,3);bufferBytes("packet-byte-backpatch",out,3,1,2,3);
  out=buffer(new byte[8]);set(out,"n","m",2);call(out,"n","a:writeBytes",new Class<?>[]{int.class,byte.class,int.class,byte[].class},3,(byte)21,1,source);
  call(out,"n","i:shortLength",new Class<?>[]{int.class,int.class},3,32614);bufferBytes("packet-short-backpatch",out,0,3,1,2,3);
  out=buffer(new byte[32]);int[] signed={-16384,-65,-64,-1,0,63,64,16383};
  for(int value:signed)call(out,"n","d:writeSmart",new Class<?>[]{int.class,int.class},12680,value);
  bufferBytes("packet-signed-smart-boundaries",out,0x80,0,0xbf,0xbf,0,0x3f,0x40,0x7f,0xc0,0x40,0xff,0xff);
  set(out,"n","m",0);for(int value:signed)check("packet-signed-smart-value",call(out,"n","e:readSmart",new Class<?>[]{byte.class},(byte)100),value);
  check("packet-signed-smart-consumption",get(out,"n","m"),12);
  out=buffer(new byte[]{0,127,(byte)0x80,0,1,0,0x7f,(byte)0xff});
  for(int value:new int[]{127,256,32767})check("packet-short-or-int-width",call(out,"n","j:largeSmart",new Class<?>[]{int.class},Integer.MAX_VALUE),value);
  check("packet-short-or-int-consumption",get(out,"n","m"),8);
  out=buffer(new byte[32]);call(out,"n","a:writeString",new Class<?>[]{String.class,int.class},"A\u20ac\u0152\u0178",100);
  call(out,"n","a:writeCircumfixed",new Class<?>[]{byte.class,String.class},(byte)100,"z");bufferBytes("packet-cp1252-delimiters",out,65,128,140,159,0,0,122,0);
  set(out,"n","m",0);check("packet-string",call(out,"n","c:readString",new Class<?>[]{boolean.class},false),"A\u20ac\u0152\u0178");
  check("packet-circumfixed-string",call(out,"n","f:readCircumfixed",new Class<?>[]{byte.class},(byte)100),"z");
  check("packet-nullable-string",call(out,"n","d:nullableString",new Class<?>[]{int.class},-15208),null);check("packet-string-consumption",get(out,"n","m"),9);
  out=buffer(new byte[13]);System.arraycopy("123456789".getBytes("US-ASCII"),0,(byte[])get(out,"n","g"),0,9);set(out,"n","m",9);
  check("packet-standard-crc32",call(out,"n","c:crc",new Class<?>[]{int.class,int.class},0,-50),0xcbf43926);check("packet-crc-position",get(out,"n","m"),13);
  bufferBytes("packet-crc-big-endian",out,49,50,51,52,53,54,55,56,57,0xcb,0xf4,0x39,0x26);
  check("packet-crc-accepted",call(out,"n","h:verifyCrc",new Class<?>[]{int.class},0),true);
  ((byte[])get(out,"n","g"))[4]^=1;check("packet-crc-rejects-corruption",call(out,"n","h:verifyCrc",new Class<?>[]{int.class},0),false);check("packet-crc-retains-position",get(out,"n","m"),13);
  out=buffer(new byte[8]);set(out,"n","m",8);call(out,"n","a:encrypt",new Class<?>[]{int.class,int[].class},1527987844,new int[4]);
  bufferBytes("packet-xtea-zero-vector",out,0xde,0xe9,0xd4,0xd8,0xf7,0x13,0x1e,0xd9);check("packet-xtea-encrypt-position",get(out,"n","m"),8);
  out=buffer(new byte[]{9,8,7,6,5,(byte)0xde,(byte)0xe9,(byte)0xd4,(byte)0xd8,(byte)0xf7,0x13,0x1e,(byte)0xd9,4,3});set(out,"n","m",2);
  call(out,"n","a:decrypt",new Class<?>[]{int.class,int[].class,int.class,int.class},5,new int[4],13,6528);
  bufferBytes("packet-xtea-subrange",out,9,8,7,6,5,0,0,0,0,0,0,0,0,4,3);check("packet-xtea-restores-position",get(out,"n","m"),2);
  out=buffer(new byte[16]);((byte[])get(out,"n","g"))[0]=65;set(out,"n","m",1);
  call(out,"n","a:rsa",new Class<?>[]{byte.class,java.math.BigInteger.class,java.math.BigInteger.class},(byte)-100,java.math.BigInteger.valueOf(3233),java.math.BigInteger.valueOf(17));
  bufferBytes("packet-small-rsa-vector",out,0,2,10,230);check("packet-rsa-position",get(out,"n","m"),4);
  for(String password:new String[]{"A","a","0"}){out=buffer(new byte[16]);call(out,"n","a:password",new Class<?>[]{String.class,byte.class},password,(byte)111);bufferBytes("packet-base38-password",out,0,0,0,0,0,0,password.equals("0")?28:2,0,0,0,0,0,0,0);check("packet-password-position",get(out,"n","m"),14);}
  check("packet-xor",call(null,"n","a:xor",new Class<?>[]{int.class,int.class},0xf0,0xaa),0x5a);
  String[] names={null,"","abc","a b","a.","a__b"};boolean[] valid={false,false,true,true,false,false};
  for(int i=0;i<names.length;i++)check("packet-account-name-policy",call(null,"n","a:validName",new Class<?>[]{boolean.class,CharSequence.class,int.class},false,names[i],113),valid[i]);
  check("packet-relaxed-separators",call(null,"n","a:validName",new Class<?>[]{boolean.class,CharSequence.class,int.class},true,"a__b",113),true);
  check("packet-shape-before-character-policy",call(null,"n","b:nameShape",new Class<?>[]{boolean.class,CharSequence.class,int.class},false,"a.",109),true);
 }
 static void meshBounds(Object mesh,int...expected)throws Exception{
  call(mesh,"ia","a:bounds",new Class<?>[]{byte.class},(byte)49);String[] fields={"b","a","i","R","g","O"};
  for(int i=0;i<fields.length;i++)check("mesh-axis-bound-"+fields[i],get(mesh,"ia",fields[i]),expected[i]);check("mesh-bounds-valid",get(mesh,"ia","B"),true);
 }
 static void meshGeometry()throws Exception{
  Object mesh=construct("ia",new Class<?>[]{});set(mesh,"ia","K",(short)3);set(mesh,"ia","L",new short[]{-4,2,8});set(mesh,"ia","r",new short[]{6,-3,0});set(mesh,"ia","J",new short[]{10,-6,2});
  meshBounds(mesh,-4,8,-3,6,-6,10);call(mesh,"ia","a:scale",new Class<?>[]{int.class,int.class,int.class,int.class,int.class},3,2,4,1,-100);
  check("mesh-scale-invalidates-bounds",get(mesh,"ia","B"),false);
  check("mesh-scaled-x",Arrays.toString((short[])get(mesh,"ia","L")),"[-2, 1, 4]");check("mesh-scaled-y",Arrays.toString((short[])get(mesh,"ia","r")),"[12, -6, 0]");check("mesh-scaled-z",Arrays.toString((short[])get(mesh,"ia","J")),"[15, -9, 3]");
  meshBounds(mesh,-2,4,-6,12,-9,15);call(mesh,"ia","a:translate",new Class<?>[]{int.class,int.class,int.class,int.class},-1,1,5,2);
  check("mesh-translation-invalidates-bounds",get(mesh,"ia","B"),false);
  check("mesh-translated-x",Arrays.toString((short[])get(mesh,"ia","L")),"[-2, 6, 9]");check("mesh-translated-y",Arrays.toString((short[])get(mesh,"ia","r")),"[12, -4, 2]");check("mesh-translated-z",Arrays.toString((short[])get(mesh,"ia","J")),"[15, -10, 2]");meshBounds(mesh,-2,9,-4,12,-10,15);
 }
 static void quickChat()throws Exception{
  Object[] commands=(Object[])call(null,"vh","e:commands",new Class<?>[]{int.class},-91);int[] ids={0,1,2,4,6,7,8,9,10,11,12,13,14,15},counts={1,0,0,1,2,1,1,1,0,2,0,0,1,0};
  check("quick-chat-command-count",commands.length,14);
  for(int i=0;i<ids.length;i++){check("quick-chat-command-id",get(commands[i],"om","f"),ids[i]);check("quick-chat-command-parameters",get(commands[i],"om","d"),counts[i]);check("quick-chat-command-lookup",call(null,"kf","a:command",new Class<?>[]{byte.class,int.class},(byte)-57,ids[i])==commands[i],true);}
  check("quick-chat-unknown-command",call(null,"kf","a:command",new Class<?>[]{byte.class,int.class},(byte)-57,99),null);
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream data=new DataOutputStream(bytes);
  data.writeByte(1);data.write("Ship <cargo< now".getBytes("US-ASCII"));data.writeByte(0);data.writeByte(2);data.writeByte(2);data.writeShort(3);data.writeShort(17);
  data.writeByte(3);data.writeByte(2);data.writeShort(0);data.writeShort(404);data.writeShort(11);data.writeShort(7);data.writeShort(9);data.writeByte(4);data.writeByte(0);
  Object phrase=construct("si",new Class<?>[]{}),input=buffer(bytes.toByteArray());call(phrase,"si","a:decode",new Class<?>[]{c("n"),int.class},input,0);
  check("quick-chat-stream-consumed",get(input,"n","m"),bytes.size());check("quick-chat-fragments",Arrays.toString((String[])get(phrase,"si","s")),"[Ship , cargo,  now]");check("quick-chat-preview",call(phrase,"si","g:preview",new Class<?>[]{int.class},-4),"Ship ...cargo... now");
  check("quick-chat-responses",Arrays.toString((int[])get(phrase,"si","z")),"[3, 17]");check("quick-chat-command-ids",Arrays.toString((int[])get(phrase,"si","x")),"[0, 11]");
  int[][] parameters=(int[][])get(phrase,"si","q");check("quick-chat-single-parameter",Arrays.toString(parameters[0]),"[404]");check("quick-chat-two-parameters",Arrays.toString(parameters[1]),"[7, 9]");
  call(phrase,"si","d:global",new Class<?>[]{byte.class},(byte)-118);check("quick-chat-global-responses",Arrays.toString((int[])get(phrase,"si","z")),"[32771, 32785]");call(phrase,"si","d:global",new Class<?>[]{byte.class},(byte)-118);check("quick-chat-global-idempotence",Arrays.toString((int[])get(phrase,"si","z")),"[32771, 32785]");
  check("quick-chat-empty-preview",call(construct("si",new Class<?>[]{}),"si","g:preview",new Class<?>[]{int.class},-4),"");
  Object custom=construct("om",new Class<?>[]{int.class,int.class,int.class,int.class},30,99,88,3);check("quick-chat-custom-id",get(custom,"om","f"),30);check("quick-chat-custom-parameter-count",get(custom,"om","d"),3);
 }
 static void reflectionChecks()throws Exception{
  Object check=make("mn"),deque=construct("cn",new Class<?>[]{});set(null,"je","a",deque);
  set(check,"mn","g",0x12345678);set(check,"mn","i",4);set(check,"mn","m",new int[]{0,2,4,0});set(check,"mn","o",new int[]{0,0,0,-5});
  Object fieldTasks=Array.newInstance(c("la"),4),methodTasks=Array.newInstance(c("la"),4),pending=make("la");
  set(pending,"la","b",Integer.class.getField("MAX_VALUE"));Array.set(fieldTasks,0,pending);
  Object task=make("la");set(task,"la","f",1);set(task,"la","b",Integer.class.getField("MIN_VALUE"));Array.set(fieldTasks,1,task);
  task=make("la");set(task,"la","f",1);set(task,"la","b",String.class.getMethod("valueOf",int.class));Array.set(methodTasks,2,task);
  set(check,"mn","r",fieldTasks);set(check,"mn","p",methodTasks);call(deque,"cn","a:addLast",new Class<?>[]{int.class,c("hg")},-12328,check);
  Object output=construct("c",new Class<?>[]{byte[].class},new byte[64]);call(null,"mf","a:reflection",new Class<?>[]{int.class,c("c")},-20157,output);
  check("reflection-pending-writes-nothing",get(output,"n","m"),0);check("reflection-pending-stays-queued",call(deque,"cn","a:first",new Class<?>[]{boolean.class},false)==check,true);
  set(pending,"la","f",1);call(null,"mf","a:reflection",new Class<?>[]{int.class,c("c")},-20157,output);
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream data=new DataOutputStream(bytes);data.writeInt(0x12345678);data.writeByte(0);data.writeInt(Integer.MAX_VALUE);data.writeByte(0);data.writeInt(25);data.writeByte(0);data.writeInt(9);data.writeByte(-5);
  java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(bytes.toByteArray());data.writeInt((int)crc.getValue());
  check("reflection-result-and-crc",Arrays.toString(Arrays.copyOf((byte[])get(output,"n","g"),bytes.size())),Arrays.toString(bytes.toByteArray()));check("reflection-result-length",get(output,"n","m"),bytes.size());
  check("reflection-completed-queue-empty",call(deque,"cn","a:empty",new Class<?>[]{int.class},-98),true);check("reflection-completed-unlinked",get(check,"hg","b")==null&&get(check,"hg","d")==null,true);
 }
 static byte[] uncompressed(byte[] content)throws Exception{
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream data=new DataOutputStream(bytes);data.writeByte(0);data.writeInt(content.length);data.write(content);return bytes.toByteArray();
 }
 static Object archiveIndex(int version)throws Exception{
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream data=new DataOutputStream(bytes);data.writeByte(version);if(version>=6)data.writeInt(123);data.writeByte(1);
  data.writeShort(2);data.writeShort(1);data.writeShort(2);data.writeInt("main".hashCode());data.writeInt("aux".hashCode());data.writeInt(100);data.writeInt(200);data.writeInt(7);data.writeInt(8);
  data.writeShort(2);data.writeShort(1);data.writeShort(0);data.writeShort(2);data.writeShort(0);data.writeInt("left".hashCode());data.writeInt("right".hashCode());data.writeInt("only".hashCode());
  byte[] encoded=uncompressed(bytes.toByteArray());java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(encoded);
  return construct("f",new Class<?>[]{byte[].class,int.class,byte[].class},encoded,(int)crc.getValue(),null);
 }
 static void archiveFiles()throws Exception{
  Object index=null;
  for(int version:new int[]{5,6,7}){
   index=archiveIndex(version);check("index-group-count",get(index,"f","c"),2);check("index-group-slot-capacity",get(index,"f","k"),4);check("index-revision",get(index,"f","n"),version>=6?123:0);
   check("index-delta-group-ids",Arrays.toString((int[])get(index,"f","d")),"[1, 3]");check("index-file-counts",Arrays.toString((int[])get(index,"f","i")),"[0, 2, 0, 1]");check("index-file-slot-capacities",Arrays.toString((int[])get(index,"f","e")),"[0, 3, 0, 1]");
   check("index-sparse-file-ids",Arrays.toString(((int[][])get(index,"f","a"))[1]),"[0, 2]");check("index-dense-ids-elided",((int[][])get(index,"f","a"))[3],null);
   check("index-group-crcs",Arrays.toString((int[])get(index,"f","l")),"[0, 100, 0, 200]");check("index-group-versions",Arrays.toString((int[])get(index,"f","q")),"[0, 7, 0, 8]");
  }
  ByteArrayOutputStream chunks=new ByteArrayOutputStream();DataOutputStream table=new DataOutputStream(chunks);
  table.write("ABDEFCGH".getBytes("US-ASCII"));for(int length:new int[]{2,1,1,1})table.writeInt(length);table.writeByte(2);
  byte[] group=uncompressed(chunks.toByteArray()),single=uncompressed("single".getBytes("US-ASCII"));set(null,"uj","d",false);
  for(int policy=0;policy<=2;policy++)for(boolean discard:new boolean[]{false,true}){
   Object archive=construct("mf",new Class<?>[]{c("ob"),boolean.class,int.class},null,discard,policy);Object[] packed=new Object[4];packed[1]=group;packed[3]=single;
   set(archive,"mf","g",index);set(archive,"mf","j",packed);set(archive,"mf","e",new Object[4][]);
   check("archive-index-already-installed",call(archive,"mf","b:index",new Class<?>[]{int.class},0),true);
   check("archive-case-insensitive-group",call(archive,"mf","b:group",new Class<?>[]{int.class,String.class},-1,"MAIN"),1);
   check("archive-case-insensitive-file",call(archive,"mf","a:file",new Class<?>[]{int.class,String.class,boolean.class},1,"RIGHT",true),2);
   check("archive-known-group-name",call(archive,"mf","a:hasGroup",new Class<?>[]{String.class,byte.class},"AUX",(byte)-120),true);
   check("archive-unknown-group-name",call(archive,"mf","a:hasGroup",new Class<?>[]{String.class,byte.class},"absent",(byte)-120),false);
   check("archive-invalid-group-slot",call(archive,"mf","a:validGroup",new Class<?>[]{int.class,byte.class},-1,(byte)-120),false);
   check("archive-sparse-hole-is-in-slot-range",call(archive,"mf","a:validFile",new Class<?>[]{int.class,int.class,int.class},1,11315,1),true);
   check("archive-outside-file-slots",call(archive,"mf","a:validFile",new Class<?>[]{int.class,int.class,int.class},3,11315,1),false);
   check("archive-all-groups-available",call(archive,"mf","a:all",new Class<?>[]{byte.class},(byte)-119),true);
   check("archive-overall-progress",call(archive,"mf","a:progress",new Class<?>[]{int.class},-125),100);
   check("archive-named-group-progress",call(archive,"mf","a:namedProgress",new Class<?>[]{String.class,int.class},"MAIN",0),100);
   check("archive-named-group-loaded",call(archive,"mf","a:loadGroup",new Class<?>[]{int.class,String.class},0,"main"),true);
   check("archive-named-file-loaded",call(archive,"mf","a:loadFile",new Class<?>[]{String.class,String.class,byte.class},"right","main",(byte)-100),true);
   byte[] actual=(byte[])call(archive,"mf","a:named",new Class<?>[]{int.class,String.class,String.class},-4,"LEFT","MAIN");check("archive-two-chunk-first-file",new String(actual,"US-ASCII"),"ABC");
   check("archive-packed-retention-policy",packed[1]==null,discard);Object[][] files=(Object[][])get(archive,"mf","e");
   check("archive-unpacked-group-retention",files[1]==null,policy==2);
   String retained=policy==0?"[[65, 66, 67], null, [68, 69, 70, 71, 72]]":policy==1?"[null, null, [68, 69, 70, 71, 72]]":"null";
   check("archive-unpacked-file-retention",Arrays.deepToString(files[1]),retained);
   // Reinstall the fixture's packed bytes to stand in for a completed provider
   // fetch when a discard policy deliberately removed them. No network involved.
   packed[1]=group;actual=(byte[])call(archive,"mf","a:keyedNamed",new Class<?>[]{byte.class,String.class,String.class,int[].class},(byte)-120,"MAIN","RIGHT",null);
   check("archive-two-chunk-sparse-file",new String(actual,"US-ASCII"),"DEFGH");
   actual=(byte[])call(archive,"mf","a:get",new Class<?>[]{int.class,byte.class,int.class},3,(byte)-97,0);check("archive-single-file-group",new String(actual,"US-ASCII"),"single");
   packed[1]=group;check("archive-sparse-hole-has-no-file",call(archive,"mf","a:get",new Class<?>[]{int.class,byte.class,int.class},1,(byte)-97,1),null);
   check("archive-out-of-range-file-null",call(archive,"mf","a:get",new Class<?>[]{int.class,byte.class,int.class},1,(byte)-97,3),null);
   check("archive-unused-group-null",call(archive,"mf","a:get",new Class<?>[]{int.class,byte.class,int.class},0,(byte)-97,0),null);
  }
 }
 public static void main(String[] args)throws Exception{
  Class<?> unsafeClass=Class.forName("sun.misc.Unsafe");Field field=unsafeClass.getDeclaredField("theUnsafe");field.setAccessible(true);unsafe=field.get(null);allocate=unsafeClass.getMethod("allocateInstance",Class.class);
  terrain();stamps();collections();System.out.println("checks="+checks);
  int previous=checks;levels();System.out.println("level-checks="+(checks-previous));
  previous=checks;widgets();System.out.println("widget-checks="+(checks-previous));
  previous=checks;textGeometry();System.out.println("text-checks="+(checks-previous));
  previous=checks;audioFormats();System.out.println("audio-checks="+(checks-previous));
  previous=checks;pcmKernels();System.out.println("pcm-checks="+(checks-previous));
  previous=checks;bulletPool();sessionTerrain();sessionColorsAndClock();System.out.println("session-checks="+(checks-previous));
  previous=checks;packetOperations();System.out.println("packet-checks="+(checks-previous));
  previous=checks;meshGeometry();System.out.println("mesh-checks="+(checks-previous));
  previous=checks;quickChat();reflectionChecks();System.out.println("metadata-checks="+(checks-previous));
  previous=checks;archiveFiles();System.out.println("archive-checks="+(checks-previous));
 }
}
`;

// Used by refresh-raw-class as an original-bytecode correctness gate.
export const expected = 'checks=903\nlevel-checks=393\nwidget-checks=26\ntext-checks=45\naudio-checks=578\npcm-checks=128\nsession-checks=181\npacket-checks=59\nmesh-checks=29\nmetadata-checks=62\narchive-checks=162';

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
    ['oe','b','(IIIIII)V','spawnBullet'],['oe','F','(I)V','recycle'],
    ['vh','a','(IZIIBIII)V','reset'],['vh','d','(I)V','deactivate'],
    ['oe','a','(III)[I','tile'],['oe','a','(IBI)[I','initialTile'],['oe','a','([IIBI)Z','solid'],
    ['oe','a','(IIIIII)Z','ray'],['oe','a','(Luk;BII)I','classify'],
    ['oe','d','(II)I','red'],['oe','b','(II)I','green'],['oe','a','(II)I','blue'],['oe','a','(IIZI)I','rgb'],
    ['oe','a','(BIII)I','color'],['oe','g','(Z)Ljava/lang/String;','clock'],
    ['n','f','(II)V','writeByte'],['n','h','(II)V','writeShort'],['n','b','(II)V','writeMedium'],['n','a','(BI)V','writeInt'],
    ['n','a','(JB)V','writeLong'],['n','a','(IJ)V','write56'],['n','a','(JI)V','write40'],['n','i','(I)J','readLong'],
    ['n','a','(Z)B','readByte'],['n','f','(I)I','readShort'],['n','d','(B)I','readMedium'],['n','g','(I)I','readInt'],
    ['n','a','([BBII)V','readBytes'],['n','a','(IBI[B)V','writeBytes'],['n','g','(II)V','pad'],
    ['n','e','(II)V','byteLength'],['n','i','(II)V','shortLength'],['n','d','(II)V','writeSmart'],['n','e','(B)I','readSmart'],['n','j','(I)I','largeSmart'],
    ['n','a','(Ljava/lang/String;I)V','writeString'],['n','a','(BLjava/lang/String;)V','writeCircumfixed'],['n','c','(Z)Ljava/lang/String;','readString'],
    ['n','f','(B)Ljava/lang/String;','readCircumfixed'],['n','d','(I)Ljava/lang/String;','nullableString'],
    ['n','c','(II)I','crc'],['n','h','(I)Z','verifyCrc'],['n','a','(I[I)V','encrypt'],['n','a','(I[III)V','decrypt'],
    ['n','a','(BLjava/math/BigInteger;Ljava/math/BigInteger;)V','rsa'],['n','a','(Ljava/lang/String;B)V','password'],['n','a','(II)I','xor'],
    ['n','a','(ZLjava/lang/CharSequence;I)Z','validName'],['n','b','(ZLjava/lang/CharSequence;I)Z','nameShape'],
    ['ia','a','(B)V','bounds'],['ia','a','(IIIII)V','scale'],['ia','a','(IIII)V','translate'],
    ['vh','e','(I)[Lom;','commands'],['kf','a','(BI)Lom;','command'],['si','a','(Ln;I)V','decode'],['si','g','(I)Ljava/lang/String;','preview'],['si','d','(B)V','global'],
    ['mf','a','(ILc;)V','reflection'],
    ['mf','b','(I)Z','index'],['mf','b','(ILjava/lang/String;)I','group'],['mf','a','(ILjava/lang/String;Z)I','file'],
    ['mf','a','(Ljava/lang/String;B)Z','hasGroup'],['mf','a','(IB)Z','validGroup'],['mf','a','(III)Z','validFile'],
    ['mf','a','(B)Z','all'],['mf','a','(I)I','progress'],['mf','a','(Ljava/lang/String;I)I','namedProgress'],
    ['mf','a','(ILjava/lang/String;)Z','loadGroup'],['mf','a','(Ljava/lang/String;Ljava/lang/String;B)Z','loadFile'],
    ['mf','a','(ILjava/lang/String;Ljava/lang/String;)[B','named'],['mf','a','(BLjava/lang/String;Ljava/lang/String;[I)[B','keyedNamed'],['mf','a','(IBI)[B','get'],
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
      'oscillator boundaries','all sixteen PCM forward/reverse mono/stereo interpolation/ramp kernels','equal-power pan endpoints',
      'bullet constructor/reset/deactivation','active-prefix bullet recycling and reuse without allocation',
      'current/initial terrain wrapping and independent height bounds','terrain ray and mask collision boundaries',
      'ship hull half/notch classification','RGB packing and countdown interpolation','50-tick session/countdown clocks and cap',
      'packet fixed widths, smart boundaries and backpatched lengths','CP1252 string delimiters and account-name policy',
      'CRC32 corruption rejection, XTEA zero vector/subrange, RSA vector and base38 passwords',
      'mesh transforms and lazy bounds invalidation','quick-chat command parameters/preview/global responses',
      'pending/completed reflection check framing, CRC and queue ownership','version-five/six/seven archive indexes',
      'sparse named multi-file chunks and all packed/unpacked retention policies'],
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
