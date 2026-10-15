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
export function verifyBrickListReset({classpath, mapping, readable = false, originalGamepack = false, temporary}) {
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
    assert.ok(symbols.has(symbol), 'Missing list-reset fixture field: ' + symbol);
    return originalGamepack ? name : readable ? aliases.get(symbol) || 'field_' + name : 'field_' + name;
  };
  const method = (owner, name, descriptor) => {
    const symbol = `M:${owner}.${name}${descriptor}`;
    assert.ok(symbols.has(symbol), 'Missing list-reset fixture method: ' + symbol);
    return readable ? aliases.get(symbol) || name : name;
  };
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'brick-list-reset-'));
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node readable/tests/brickabrac-list-reset-probe.mjs ORIGINAL_GAMEPACK.jar');
    const mapping = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/brickabrac-naming.json')));
    const stubs = buildCompilationStubs(funorbRepository, temporary);
    const result = verifyBrickListReset({classpath: [path.resolve(process.argv[2]), stubs.jar].join(path.delimiter),
      mapping, originalGamepack: true, temporary});
    console.log(JSON.stringify({originalGamepackSha256, ...result}));
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
}
