import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {funorbRepository} from '../game-export.mjs';
import {buildCompilationStubs} from '../compilation-stubs.mjs';

export const originalGamepackSha256 = '91284c0ec25fa4f8913876c78be9d80d273d8dd567d5b92950f1795f37b3c95d';

// The same independent model runs against original gamepack classes, raw Java,
// and renamed Java. Original gamepack fields have no decompiler `field_` prefix.
function contractBindings({classpath, mapping, readable, originalGamepack}) {
  assert.ok(!(readable && originalGamepack), 'Original gamepacks do not use readable symbol aliases');
  if (originalGamepack) {
    const archive = classpath.split(path.delimiter)[0];
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
      originalGamepackSha256, 'Original gamepack identity differs');
  }
  const aliases = new Map(mapping.rules.map(rule => [rule.symbol, rule.to]));
  const symbols = new Set(mapping.symbols.map(symbol => symbol.symbol));
  const className = owner => readable ? aliases.get('C:' + owner) || owner : owner;
  const field = (owner, name, descriptor) => {
    const symbol = `F:${owner}.field_${name}:${descriptor}`;
    assert.ok(symbols.has(symbol), 'Missing original-contract fixture field: ' + symbol);
    return originalGamepack ? name : readable ? aliases.get(symbol) || 'field_' + name : 'field_' + name;
  };
  const method = (owner, name, descriptor) => {
    const symbol = `M:${owner}.${name}${descriptor}`;
    assert.ok(symbols.has(symbol), 'Missing original-contract fixture method: ' + symbol);
    return readable ? aliases.get(symbol) || name : name;
  };
  return {className, field, method};
}

export function verifyBrickListReset({classpath, mapping, readable = false, originalGamepack = false, temporary}) {
  const {className, field, method} = contractBindings({classpath, mapping, readable, originalGamepack});
  const directory = path.join(temporary, 'list-reset-probe');
  fs.mkdirSync(directory, {recursive: true});
  const source = path.join(directory, 'ListResetProbe.java');
  const strings = values => values.map(value => JSON.stringify(value)).join(',');
  const vertical = ['zb', 'cb', 'Db', 'C'].map(name => field('mh', name, 'I'));
  const horizontal = ['P', 'Ib', 'J'].map(name => field('mh', name, 'I'));
  fs.writeFileSync(source, `import java.lang.reflect.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;
public class ListResetProbe {
 static final Class<?> component=load(${JSON.stringify(className('mh'))});
 static final Class<?> node=load(${JSON.stringify(className('nm'))});
 static final Class<?> deque=load(${JSON.stringify(className('vl'))});
 static final Class<?> helper=load(${JSON.stringify(className('jh'))});
 static final Class<?> wrapped=load(${JSON.stringify(className('v'))});
 static final String[] bounds={${strings([...vertical, ...horizontal])}};
 static final Field children=field(component,${JSON.stringify(field('mh', 'bb', 'Lvl;'))});
 static final Field cursor=field(deque,${JSON.stringify(field('vl', 'b', 'Lnm;'))});
 static final Field sentinel=field(deque,${JSON.stringify(field('vl', 'e', 'Lnm;'))});
 static final Field previous=field(node,${JSON.stringify(field('nm', 'b', 'Lnm;'))});
 static final Field next=field(node,${JSON.stringify(field('nm', 'e', 'Lnm;'))});
 static final Field cause=field(wrapped,${JSON.stringify(field('v', 'f', 'Ljava/lang/Throwable;'))});
 static final Method append=method(deque,${JSON.stringify(method('vl', 'a', '(Lnm;B)V'))},node,byte.class);
 static final Method reset=method(helper,${JSON.stringify(method('jh', 'a', '(ZLmh;)V'))},boolean.class,component);
 static MessageDigest trace;static int checks;
 static Class<?> load(String name){try{return Class.forName(name);}catch(Exception error){throw new RuntimeException(error);}}
 static Field field(Class<?> type,String name){try{Field f=type.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception error){throw new RuntimeException(error);}}
 static Method method(Class<?> type,String name,Class<?>...parameters){try{Method m=type.getDeclaredMethod(name,parameters);m.setAccessible(true);return m;}catch(Exception error){throw new RuntimeException(error);}}
 static Object create(Class<?> type)throws Exception{Constructor<?> c=type.getDeclaredConstructor();c.setAccessible(true);return c.newInstance();}
 static int[] snapshot(Object value)throws Exception{int[] result=new int[bounds.length];for(int i=0;i<result.length;i++)result[i]=field(component,bounds[i]).getInt(value);return result;}
 static void seed(Object value,int seed)throws Exception{for(int i=0;i<bounds.length;i++)field(component,bounds[i]).setInt(value,seed^(0x1020304*(i+1)));}
 static void check(String label,Object actual,Object expected)throws Exception{
  checks++;if(!Objects.equals(actual,expected))throw new AssertionError(label+": "+actual+" != "+expected);
  trace.update((label+"="+actual+"\\n").getBytes(StandardCharsets.UTF_8));
 }
 static void checkBounds(String label,Object value,int[] before,boolean cleared)throws Exception{
  int[] after=snapshot(value);for(int i=0;i<after.length;i++)check(label+"/"+i,after[i],cleared&&i<4?0:before[i]);
 }
 static String invoke(boolean guard,Object root)throws Exception{
  try{reset.invoke(null,guard,root);return "ok";}
  catch(InvocationTargetException error){
   Throwable value=error.getCause();Set<Throwable> seen=Collections.newSetFromMap(new IdentityHashMap<Throwable,Boolean>());
   while(wrapped.isInstance(value)){if(!seen.add(value))throw new AssertionError("cyclic exception wrapper");value=(Throwable)cause.get(value);}
   return value.getClass().getName();
  }
 }
 static void run(int count,int badIndex,int seed,boolean guard)throws Exception{
  String label="reset/"+count+"/"+badIndex+"/"+seed+"/"+guard;
  Object root=create(component),list=create(deque);children.set(root,list);seed(root,seed);
  int[] rootBefore=snapshot(root);Object[] entries=new Object[count];int[][] before=new int[count][];
  for(int i=0;i<count;i++){
   entries[i]=create(i==badIndex?node:component);
   if(i!=badIndex){seed(entries[i],seed+i*73);before[i]=snapshot(entries[i]);}
   append.invoke(list,entries[i],(byte)3);
  }
  Object grandchild=create(component);seed(grandchild,seed^0x345678);int[] grandchildBefore=snapshot(grandchild);
  for(int i=0;i<count;i++)if(i!=badIndex){Object nested=create(deque);children.set(entries[i],nested);append.invoke(nested,grandchild,(byte)3);break;}
  Object end=sentinel.get(list);Object[] all=new Object[count+1];all[0]=end;System.arraycopy(entries,0,all,1,count);
  Object[] oldPrevious=new Object[all.length],oldNext=new Object[all.length];
  for(int i=0;i<all.length;i++){oldPrevious[i]=previous.get(all[i]);oldNext[i]=next.get(all[i]);}
  String expected=badIndex>=0?"java.lang.ClassCastException":guard?"ok":"java.lang.ArithmeticException";
  check(label+"/result",invoke(guard,root),expected);
  checkBounds(label+"/root",root,rootBefore,expected.equals("ok"));
  for(int i=0;i<count;i++)if(i!=badIndex)checkBounds(label+"/child/"+i,entries[i],before[i],badIndex<0||i<badIndex);
  checkBounds(label+"/grandchild",grandchild,grandchildBefore,false);
  check(label+"/deque",children.get(root)==list,true);
  for(int i=0;i<all.length;i++){
   check(label+"/previous/"+i,previous.get(all[i])==oldPrevious[i],true);
   check(label+"/next/"+i,next.get(all[i])==oldNext[i],true);
  }
  Object expectedCursor=badIndex<0?null:badIndex+1<count?entries[badIndex+1]:end;
  check(label+"/cursor",cursor.get(list)==expectedCursor,true);
 }
 public static void main(String[] args)throws Exception{
  trace=MessageDigest.getInstance("SHA-256");
  Field flag=field(load(${JSON.stringify(className('BrickABrac'))}),${JSON.stringify(field('BrickABrac', 'J', 'Z'))});
  boolean saved=flag.getBoolean(null);flag.setBoolean(null,false);
  try{
   for(int seed:new int[]{Integer.MIN_VALUE,-3,0,11,Integer.MAX_VALUE})
    for(int count:new int[]{0,1,2,9})for(boolean guard:new boolean[]{true,false}){
     run(count,-1,seed,guard);
     Set<Integer> badIndices=new LinkedHashSet<Integer>();if(count>0){badIndices.add(0);badIndices.add(count/2);badIndices.add(count-1);}
     for(int badIndex:badIndices)run(count,badIndex,seed,guard);
    }
   Object root=create(component);seed(root,19);int[] before=snapshot(root);
   check("missing-deque/result",invoke(true,root),"java.lang.NullPointerException");
   checkBounds("missing-deque/root",root,before,false);
   check("null-root/result",invoke(true,null),"java.lang.NullPointerException");
  }finally{flag.setBoolean(null,saved);}
  StringBuilder hex=new StringBuilder();for(byte b:trace.digest())hex.append(String.format("%02x",b&255));
  System.out.println("checks:"+checks);System.out.println("traceSha256:"+hex);
 }
}
`);
  captureProcess('timeout', ['30', 'javac', '--release', '8', '-encoding', 'UTF-8', '-d', directory, source]);
  const result = captureProcess('timeout', ['30', 'java', '-Xverify:all', '-Djava.awt.headless=true', '-cp',
    [directory, classpath].join(path.delimiter), 'ListResetProbe']);
  const match = /^checks:(\d+)\ntraceSha256:([a-f0-9]{64})\n$/.exec(result.stdout.toString());
  assert.ok(match, 'Missing list-reset probe result');
  return {checks: Number(match[1]), traceSha256: match[2], independentExpectations: true};
}

// Standard Java stream encoders define the wire bytes independently of the
// game's packet writers. A bounded stream model additionally checks partial
// writes, cursor overflow, null storage and retention of caller-owned arrays.
export function verifyBrickServiceHeader({classpath, mapping, readable = false, originalGamepack = false, temporary}) {
  const {className, field, method} = contractBindings({classpath, mapping, readable, originalGamepack});
  const directory = path.join(temporary, 'service-header-probe');
  fs.mkdirSync(directory, {recursive: true});
  const source = path.join(directory, 'ServiceHeaderProbe.java');
  fs.writeFileSync(source, `import java.io.*;
import java.lang.reflect.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;
public class ServiceHeaderProbe {
 static final Class<?> packet=load(${JSON.stringify(className('wq'))});
 static final Class<?> owner=load(${JSON.stringify(className('c'))});
 static final Class<?> wrapped=load(${JSON.stringify(className('v'))});
 static final Field bytes=field(packet,${JSON.stringify(field('wq', 'k', '[B'))});
 static final Field position=field(packet,${JSON.stringify(field('wq', 'l', 'I'))});
 static final Field cause=field(wrapped,${JSON.stringify(field('v', 'f', 'Ljava/lang/Throwable;'))});
 static final Method write=method(owner,${JSON.stringify(method('c', 'a', '(IIIILwq;)V'))},int.class,int.class,int.class,int.class,packet);
 static MessageDigest trace;static int checks;
 static Class<?> load(String name){try{return Class.forName(name);}catch(Exception e){throw new RuntimeException(e);}}
 static Field field(Class<?> type,String name){try{Field f=type.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception e){throw new RuntimeException(e);}}
 static Method method(Class<?> type,String name,Class<?>...parameters){try{Method m=type.getDeclaredMethod(name,parameters);m.setAccessible(true);return m;}catch(Exception e){throw new RuntimeException(e);}}
 static void check(String label,Object actual,Object expected){
  if(!Objects.equals(actual,expected))throw new AssertionError(label+": "+actual+" != "+expected);
  checks++;trace.update((label+"="+actual+"\\n").getBytes(StandardCharsets.UTF_8));
 }
 static byte[] encode(int wordOne,int serviceCode,int wordTwo,int headerByte)throws Exception{
  ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);
  out.writeByte(serviceCode);out.writeShort(17);out.writeShort(wordOne);out.writeShort(wordTwo);out.writeByte(headerByte);
  return buffer.toByteArray();
 }
 static String invoke(Object value,int wordOne,int serviceCode,int wordTwo,int headerByte)throws Exception{
  try{write.invoke(null,wordOne,serviceCode,wordTwo,headerByte,value);return "ok";}
  catch(InvocationTargetException error){
   Throwable valueError=error.getCause();Set<Throwable> seen=Collections.newSetFromMap(new IdentityHashMap<Throwable,Boolean>());
   while(wrapped.isInstance(valueError)){if(!seen.add(valueError))throw new AssertionError("cyclic exception wrapper");valueError=(Throwable)cause.get(valueError);}
   return valueError.getClass().getName();
  }
 }
 static void run(String label,int wordOne,int serviceCode,int wordTwo,int headerByte,int length,int start)throws Exception{
  byte[] storage=length<0?null:new byte[length];
  if(storage!=null)for(int i=0;i<storage.length;i++)storage[i]=(byte)(0x5b+i*37);
  byte[] expected=storage==null?null:storage.clone(),wire=encode(wordOne,serviceCode,wordTwo,headerByte);
  int cursor=start;String outcome="ok";
  for(byte value:wire){
   int index=cursor++;
   if(expected==null){outcome="java.lang.NullPointerException";break;}
   if(index<0||index>=expected.length){outcome="java.lang.ArrayIndexOutOfBoundsException";break;}
   expected[index]=value;
  }
  Constructor<?> constructor=packet.getDeclaredConstructor(byte[].class);constructor.setAccessible(true);
  Object value=constructor.newInstance(new Object[]{storage});position.setInt(value,start);
  check(label+"/outcome",invoke(value,wordOne,serviceCode,wordTwo,headerByte),outcome);
  check(label+"/position",position.getInt(value),cursor);
  check(label+"/caller-array",bytes.get(value)==storage,true);
  check(label+"/bytes",Arrays.toString((byte[])bytes.get(value)),Arrays.toString(expected));
 }
 public static void main(String[] args)throws Exception{
  trace=MessageDigest.getInstance("SHA-256");
  for(int value=0;value<=65535;value++){
   run("word-one/"+value,value,0xc1,0x5678,0xe7,16,3);
   run("word-two/"+value,0x1234,0xc1,value,0xe7,16,3);
  }
  for(int value=0;value<=255;value++){
   run("service/"+value,0x1234,value,0x5678,0xe7,14,1);
   run("last-byte/"+value,0x1234,0xc1,0x5678,value,14,1);
  }
  int[] boundary={Integer.MIN_VALUE,-65537,-65536,-257,-256,-129,-128,-1,0,1,127,128,255,256,257,32767,32768,65535,65536,Integer.MAX_VALUE};
  for(int value:boundary){
   run("signed-word-one/"+value,value,12,0x5678,0xe7,20,5);
   run("signed-word-two/"+value,0x1234,12,value,0xe7,20,5);
   run("signed-service/"+value,0x1234,value,0x5678,0xe7,20,5);
   run("signed-last-byte/"+value,0x1234,12,0x5678,value,20,5);
  }
  for(int length=0;length<=12;length++)for(int start:new int[]{-3,-1,0,1,3,7,length-1,length,length+1,Integer.MIN_VALUE,Integer.MAX_VALUE})
   run("partial/"+length+"/"+start,0x12345678,0xabcdef12,0x90abcdef,0x76543210,length,start);
  for(int start:new int[]{Integer.MIN_VALUE,-1,0,1,Integer.MAX_VALUE})run("null-storage/"+start,1,12,2,3,-1,start);
  check("null-packet",invoke(null,1,12,2,3),"java.lang.NullPointerException");
  StringBuilder hex=new StringBuilder();for(byte value:trace.digest())hex.append(String.format("%02x",value&255));
  System.out.println("checks:"+checks);System.out.println("traceSha256:"+hex);
 }
}
`);
  captureProcess('timeout', ['30', 'javac', '--release', '8', '-encoding', 'UTF-8', '-d', directory, source]);
  const result = captureProcess('timeout', ['30', 'java', '-Xmx256m', '-Xverify:all', '-Djava.awt.headless=true', '-cp',
    [directory, classpath].join(path.delimiter), 'ServiceHeaderProbe']);
  const match = /^checks:(\d+)\ntraceSha256:([a-f0-9]{64})\n$/.exec(result.stdout.toString());
  assert.ok(match, 'Missing service-header probe result');
  return {checks: Number(match[1]), traceSha256: match[2], independentExpectations: true, wireBytes: 8, fixedWord: 17};
}


// A discrete movement model supplies position/control expectations independently
// of the game's clamp order. Bounds include nonzero and negative left edges.
export function verifyBrickPaddleMovement({classpath, mapping, readable = false, originalGamepack = false, temporary}) {
  const {className, field, method} = contractBindings({classpath, mapping, readable, originalGamepack});
  const directory = path.join(temporary, 'paddle-movement-probe');
  fs.mkdirSync(directory, {recursive: true});
  const source = path.join(directory, 'PaddleMovementProbe.java');
  fs.writeFileSync(source, `import java.lang.reflect.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;
public class PaddleMovementProbe {
 static final Class<?> board=load(${JSON.stringify(className('j'))}),paddle=load(${JSON.stringify(className('vo'))}),body=load(${JSON.stringify(className('vi'))}),rectangle=load(${JSON.stringify(className('bn'))}),match=load(${JSON.stringify(className('ak'))}),deque=load(${JSON.stringify(className('vl'))});
 static final Field position=field(body,${JSON.stringify(field('vi','j','I'))}),width=field(rectangle,${JSON.stringify(field('bn','u','I'))}),leftBound=field(paddle,${JSON.stringify(field('vo','B','I'))}),rightBound=field(paddle,${JSON.stringify(field('vo','y','I'))}),reversedTicks=field(paddle,${JSON.stringify(field('vo','w','I'))}),aftertouchTicks=field(paddle,${JSON.stringify(field('vo','H','I'))}),controls=field(board,${JSON.stringify(field('j','db','I'))});
 static final Method advance=method(match,${JSON.stringify(method('ak','a','(Lj;Lvl;Lvl;I)V'))},board,deque,deque,int.class);
 static Object allocator;static Method allocate;static MessageDigest trace;static int checks;
 static Class<?> load(String name){try{return Class.forName(name);}catch(Exception e){throw new RuntimeException(e);}}
 static Field field(Class<?> type,String name){try{Field f=type.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception e){throw new RuntimeException(e);}}
 static Method method(Class<?> type,String name,Class<?>...parameters){try{Method m=type.getDeclaredMethod(name,parameters);m.setAccessible(true);return m;}catch(Exception e){throw new RuntimeException(e);}}
 static Object create(Class<?> type)throws Exception{Constructor<?> c=type.getDeclaredConstructor();c.setAccessible(true);return c.newInstance();}
 static Object instance(Class<?> type)throws Exception{return allocate.invoke(allocator,type);}
 static void check(String label,Object actual,Object expected)throws Exception{checks++;if(!Objects.equals(actual,expected))throw new AssertionError(label+": "+actual+" != "+expected);trace.update((label+"="+actual+"\\n").getBytes(StandardCharsets.UTF_8));}
 static Object freshBoard()throws Exception{
  Object value=instance(board);
  for(String name:new String[]{${['K','gb','pb','C','nb','x'].map(n=>JSON.stringify(field('j',n,'Lvl;'))).join(',')}})field(board,name).set(value,create(deque));
  Object groups=Array.newInstance(deque,3);for(int i=0;i<3;i++)Array.set(groups,i,create(deque));
  field(board,${JSON.stringify(field('j','z','[Lvl;'))}).set(value,groups);
  field(board,${JSON.stringify(field('j','Z','I'))}).setInt(value,2);
  field(board,${JSON.stringify(field('j','L','I'))}).setInt(value,1);
  field(board,${JSON.stringify(field('j','k','I'))}).setInt(value,-1);
  field(board,${JSON.stringify(field('j','mb','I'))}).setInt(value,640);
  return value;
 }
 static void run(int left,int right,int size,int start,int mask,int initialReversed,int initialAftertouch)throws Exception{
  String label="motion/"+left+"/"+right+"/"+size+"/"+start+"/"+mask+"/"+initialReversed+"/"+initialAftertouch;
  Object value=freshBoard(),session=instance(match);field(match,${JSON.stringify(field('ak','k','I'))}).setInt(session,2);
  Constructor<?> constructor=paddle.getDeclaredConstructor(int.class,int.class,int.class,int.class);constructor.setAccessible(true);
  Object bat=constructor.newInstance(50000,119296,left,right);field(board,${JSON.stringify(field('j','yb','Lvo;'))}).set(value,bat);
  check(label+"/constructor-left",leftBound.getInt(bat),left);check(label+"/constructor-right",rightBound.getInt(bat),right);
  position.setInt(bat,start);width.setInt(bat,size);reversedTicks.setInt(bat,initialReversed);aftertouchTicks.setInt(bat,initialAftertouch);
  int x=start,reverse=initialReversed,aftertouch=initialAftertouch;
  for(int tick=0;tick<5;tick++){
   controls.setInt(value,mask);int effective=mask^(reverse>0?3:0);
   int step=((effective&2)!=0?256:0)-((effective&1)!=0?256:0);
   for(int eighth=0;eighth<8;eighth++)x=Math.max(left,Math.min(right-size,x+step));
   if(reverse>0)reverse--;if(aftertouch>0)aftertouch--;
   advance.invoke(session,value,create(deque),create(deque),0);
   check(label+"/"+tick+"/x",position.getInt(bat),x);check(label+"/"+tick+"/controls",controls.getInt(value),effective);
   check(label+"/"+tick+"/reversed",reversedTicks.getInt(bat),reverse);check(label+"/"+tick+"/aftertouch",aftertouchTicks.getInt(bat),aftertouch);
  }
 }
 public static void main(String[] args)throws Exception{
  Class<?> unsafe=Class.forName("sun.misc.Unsafe");Field singleton=field(unsafe,"theUnsafe");allocator=singleton.get(null);allocate=unsafe.getMethod("allocateInstance",Class.class);trace=MessageDigest.getInstance("SHA-256");
  Field branch=field(load(${JSON.stringify(className('BrickABrac'))}),${JSON.stringify(field('BrickABrac','J','Z'))}),recording=field(load(${JSON.stringify(className('r'))}),${JSON.stringify(field('r','A','Z'))});boolean savedBranch=branch.getBoolean(null),savedRecording=recording.getBoolean(null);branch.setBoolean(null,false);recording.setBoolean(null,false);
  try{
   for(int[] limits:new int[][]{{-8192,65536},{2048,100000},{0,163840}}){int left=limits[0],right=limits[1];
    for(int size:new int[]{1,22528,right-left})for(int start:new int[]{left-4096,left,left+123,right-size-123,right-size,right-size+4096})
     for(int mask=0;mask<4;mask++)for(int reverse:new int[]{-3,0,1,2,250})for(int aftertouch:new int[]{-1,0,1,2})run(left,right,size,start,mask,reverse,aftertouch);
   }
  }finally{branch.setBoolean(null,savedBranch);recording.setBoolean(null,savedRecording);}
  StringBuilder hex=new StringBuilder();for(byte b:trace.digest())hex.append(String.format(Locale.ROOT,"%02x",b&255));System.out.println("checks:"+checks);System.out.println("traceSha256:"+hex);
 }
}
`);
  captureProcess('timeout', ['30', 'javac', '--release', '8', '-encoding', 'UTF-8', '-d', directory, source]);
  const result = captureProcess('timeout', ['30', 'java', '-Xmx256m', '-Xverify:all', '-Djava.awt.headless=true', '-cp',
    [directory, classpath].join(path.delimiter), 'PaddleMovementProbe']);
  const match = /^checks:(\d+)\ntraceSha256:([a-f0-9]{64})\n$/.exec(result.stdout.toString());
  assert.ok(match, 'Missing paddle movement probe result');
  return {checks: Number(match[1]), traceSha256: match[2], independentExpectations: true, framesPerCase: 5};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'brick-original-contracts-'));
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node readable/tests/brickabrac-original-contracts.mjs ORIGINAL_GAMEPACK.jar');
    const mapping = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/brickabrac-naming.json')));
    const stubs = buildCompilationStubs(funorbRepository, temporary);
    const options = {classpath: [path.resolve(process.argv[2]), stubs.jar].join(path.delimiter),
      mapping, originalGamepack: true, temporary};
    console.log(JSON.stringify({originalGamepackSha256, listReset: verifyBrickListReset(options),
      serviceHeader: verifyBrickServiceHeader(options), paddleMovement: verifyBrickPaddleMovement(options)}));
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}
