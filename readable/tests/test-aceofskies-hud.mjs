import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {digest} from '../game-export.mjs';

// Compare drawing requests and exception context across original bytecode,
// historical dispatcher Java and newly reconstructed Java. No real graphics
// device, applet constructor, game resources or screenshot is required.
export function verifyAceHud(rawClasses, classpath, temporary) {
  const directory = path.join(temporary, 'hud-probe'); fs.mkdirSync(directory);
  const helper = path.join(directory, 'classes'), old = path.join(directory, 'old');
  fs.mkdirSync(helper); fs.mkdirSync(old);
  const generator = path.join(directory, 'HudSpyGenerator.java');
  fs.writeFileSync(generator, `import java.lang.reflect.*;import java.nio.file.*;import java.util.*;
public class HudSpyGenerator {
static String type(Class<?> c){return c.getCanonicalName();}
static String zero(Class<?> c){return c==boolean.class?"false":c==char.class?"(char)0":c==byte.class?"(byte)0":c==short.class?"(short)0":c==float.class?"0f":c==double.class?"0d":c==long.class?"0L":c.isPrimitive()?"0":"null";}
static String spy(String base,String name,boolean sprite)throws Exception{
Class<?> owner=Class.forName(base);StringBuilder out=new StringBuilder("class "+name+" extends "+base+" {int spriteId; ");
Constructor<?> constructor=Arrays.stream(owner.getDeclaredConstructors()).min(Comparator.comparingInt(Constructor::getParameterCount)).get();
out.append(name+"() throws Throwable {super(");Class<?>[] cp=constructor.getParameterTypes();for(int i=0;i<cp.length;i++){if(i>0)out.append(',');out.append(zero(cp[i]));}out.append(");}");
Method[] methods=owner.getDeclaredMethods();Arrays.sort(methods,Comparator.comparing(Method::toString));
for(Method method:methods)if(Modifier.isAbstract(method.getModifiers())){
out.append("public "+type(method.getReturnType())+" "+method.getName()+"(");Class<?>[] parameters=method.getParameterTypes();
for(int i=0;i<parameters.length;i++){if(i>0)out.append(',');out.append(type(parameters[i])+" p"+i);}out.append("){ ");
if(parameters.length>0){out.append("HudProbe.record(");out.append((char)34).append(sprite?"S":"R").append((char)34).append('+');if(sprite)out.append("spriteId+");out.append((char)34).append(':').append(method.getName()).append('#').append(parameters.length).append((char)34).append(",new Object[]{");for(int i=0;i<parameters.length;i++){if(i>0)out.append(',');out.append("p"+i);}out.append("});");}
if(method.getReturnType()!=void.class)out.append("return "+zero(method.getReturnType())+";");out.append('}');
}return out.append('}').toString();}
public static void main(String[] args)throws Exception{Files.write(Paths.get(args[0]),(spy("ha","HudRenderer",false)+"\\n"+spy("pa","HudSprite",true)).getBytes("UTF-8"));}
}
`);
  // Keep source generation explicit and deterministic; only the abstract
  // renderer/sprite boundary is mocked. All final wrappers remain actual code.
  const cp = [rawClasses, classpath].join(path.delimiter);
  captureProcess('javac', ['-classpath', cp, '-d', helper, generator]);
  const spies = path.join(directory, 'HudSpies.java');
  captureProcess('java', ['-cp', [helper, cp].join(path.delimiter), 'HudSpyGenerator', spies]);
  const harness = path.join(directory, 'HudProbe.java');
  fs.writeFileSync(harness, `import java.lang.reflect.*;import java.util.*;import sun.misc.Unsafe;
public class HudProbe {
static boolean nativeNames,error;static int fault,operations,cases,checks;static List<String> events=new ArrayList<>();static Unsafe unsafe;
static Field field(Class<?> owner,String name)throws Exception{Field f=owner.getDeclaredField(nativeNames?name:"field_"+name);f.setAccessible(true);return f;}
static void check(boolean value){if(!value)throw new AssertionError("independent HUD expectation");checks++;}
static void record(String name,Object[] values){events.add(name+Arrays.toString(values));operations++;if(operations==fault){if(error)throw new AssertionError("injected");throw new IllegalStateException("injected");}}
static void run(Object game,Method draw,int value,int oldValue,int digits,int phase,boolean leading,boolean alternate,int fail,boolean failError)throws Exception{
events.clear();fault=fail;error=failError;operations=0;String failure="ok";
try{draw.invoke(game,value,digits,90,leading,phase,oldValue,400,alternate,10);}
catch(InvocationTargetException exception){Throwable cause=exception.getCause();failure=cause.getClass().getName();if(cause.getClass().getName().equals("ak"))failure+="/"+field(cause.getClass(),"a").get(cause);}
if(fail==0&&value==oldValue){check(failure.equals("ok"));check(events.size()==2*digits);for(int i=0;i<events.size();i++)check(events.get(i).startsWith("S"));}
if(fail>0){check(operations==fail);check(failError?failure.equals("java.lang.AssertionError"):failure.startsWith("ak/"));}
System.out.println(value+"/"+oldValue+"/"+digits+"/"+phase+"/"+leading+"/"+alternate+"/"+fail+"/"+failError+":"+failure+":"+String.join("|",events));cases++;
}
public static void main(String[] args)throws Throwable{
nativeNames=args[0].equals("native");Field u=Unsafe.class.getDeclaredField("theUnsafe");u.setAccessible(true);unsafe=(Unsafe)u.get(null);
Class<?> session=Class.forName("pk"),manager=Class.forName("l"),selected=Class.forName("vu"),sprite=Class.forName("pa"),assets=Class.forName("in");
Object game=unsafe.allocateInstance(session),renderManager=unsafe.allocateInstance(manager),selection=unsafe.allocateInstance(selected),renderer=unsafe.allocateInstance(HudRenderer.class);
field(selected,"c").set(selection,renderer);field(manager,"e").set(renderManager,selection);field(session,"wb").set(null,renderManager);
Object sprites=Array.newInstance(sprite,44);for(int i=0;i<44;i++){HudSprite s=(HudSprite)unsafe.allocateInstance(HudSprite.class);s.spriteId=i;Array.set(sprites,i,s);}field(assets,"c").set(null,sprites);
Method draw=session.getDeclaredMethod("a",int.class,int.class,int.class,boolean.class,int.class,int.class,int.class,boolean.class,int.class);draw.setAccessible(true);
for(int value:new int[]{0,1,9,10,99,100,12345678})for(int oldValue:new int[]{0,1,9,10,99,100,12345678})for(int digits:new int[]{1,3,8})for(int phase:new int[]{0,5,10,15,20})for(boolean leading:new boolean[]{false,true})for(boolean alternate:new boolean[]{false,true})
run(game,draw,value,oldValue,digits,phase,leading,alternate,0,false);
for(int phase:new int[]{0,5,10,15,20})for(int fail=1;fail<=6;fail++)for(boolean failError:new boolean[]{false,true})run(game,draw,123,124,3,phase,true,true,fail,failError);
// Negative digits retain the existing array failure and wrapped argument state.
for(int value:new int[]{-1,-11,Integer.MIN_VALUE})run(game,draw,value,0,3,0,false,false,0,false);
System.out.println("cases:"+cases+"/checks:"+checks);
}}
`);
  captureProcess('javac', ['-encoding', 'UTF-8', '-classpath', cp, '-d', helper, spies, harness]);
  // Historical preprocessing removes some diagnostic catch wrappers. Isolate
  // the selected HUD method by supplying the same original final renderer and
  // sprite wrappers to all three variants, above their respective peer classes.
  for (const name of ['ha.class', 'pa.class'])
    fs.copyFileSync(path.join(temporary, 'original-bytecode', name), path.join(helper, name));
  const shim = path.join(directory, 'AceOfSkies.java');
  fs.writeFileSync(shim, 'public class AceOfSkies {public static boolean G=false;public static boolean field_G=false;}');
  captureProcess('javac', ['--release', '8', '-d', helper, shim]);
  const original = path.join(temporary, 'original-pk.java');
  assert.ok(fs.existsSync(original), 'Historical HUD source was not retained for verification');
  captureProcess('javac', ['--release', '8', '-proc:none', '-sourcepath', '', '-classpath', cp, '-d', old, original]);
  const run = (classes, mode) => captureProcess('java', ['-Xverify:all', '-Djava.awt.headless=true',
    '-cp', [helper, ...classes, classpath].join(path.delimiter), 'HudProbe', mode], {maxBuffer: 64 * 1024 * 1024}).stdout;
  const oracle = run([path.join(temporary, 'original-bytecode')], 'native');
  const historical = run([old, rawClasses], 'source'), candidate = run([rawClasses], 'source');
  function sameTrace(actual, expected, label) {
    if (actual.equals(expected)) return;
    const left = actual.toString().split('\n'), right = expected.toString().split('\n');
    const index = right.findIndex((line, i) => line !== left[i]);
    throw new Error(label + ' at line ' + (index + 1) + '\nexpected: ' + right[index]?.slice(0, 800) + '\nactual: ' + left[index]?.slice(0, 800));
  }
  sameTrace(historical, oracle, 'Historical HUD Java differs from original bytecode');
  sameTrace(candidate, oracle, 'Reconstructed HUD differs from original bytecode');
  return {summary: oracle.toString().trimEnd().split('\n').at(-1),
    originalBytecodeOldJavaNewJavaIdentical: true, independentEqualDigitExpectations: true,
    runtimeExceptionAndErrorInjection: true, originalFinalDrawingWrappersShared: true,
    drawingCallTrace: true, physicalPixelsVerified: false,
    traceSha256: digest(oracle)};
}
