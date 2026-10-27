import fs from 'node:fs';
import path from 'node:path';
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
 public static void main(String[] args)throws Exception{
  Class<?> unsafeClass=Class.forName("sun.misc.Unsafe");Field field=unsafeClass.getDeclaredField("theUnsafe");field.setAccessible(true);unsafe=field.get(null);allocate=unsafeClass.getMethod("allocateInstance",Class.class);
  terrain();stamps();collections();System.out.println("checks="+checks);
 }
}
`;

// Used by refresh-raw-class as an original-bytecode correctness gate.
export const expected = 'checks=903';

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
    covers:['terrain header versions 9/10','empty/full/partial masks','sprite terrain stamping/removal','intrusive deque transfer'],
    fullGameplayVerified:false};
}
