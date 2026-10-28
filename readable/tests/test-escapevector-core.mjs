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
 public static void main(String[] args)throws Exception{
  Class<?> unsafeClass=Class.forName("sun.misc.Unsafe");Field field=unsafeClass.getDeclaredField("theUnsafe");field.setAccessible(true);unsafe=field.get(null);allocate=unsafeClass.getMethod("allocateInstance",Class.class);
  terrain();stamps();collections();System.out.println("checks="+checks);
  int previous=checks;levels();System.out.println("level-checks="+(checks-previous));
  previous=checks;widgets();System.out.println("widget-checks="+(checks-previous));
 }
}
`;

// Used by refresh-raw-class as an original-bytecode correctness gate.
export const expected = 'checks=903\nlevel-checks=393\nwidget-checks=26';

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
      'widget hit-test boundaries/origins','hover versus keyboard focus','virtual focus traversal and Enter action callback'],
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
