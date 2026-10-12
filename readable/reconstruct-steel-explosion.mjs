import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {archivedInput,digest,funorbRepository,workflowRoot} from './game-export.mjs';
import {sourceInventory,sourceIdentity} from './tools/readable-java.mjs';
import {inventory} from '../scripts/publish-decompiled-games.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';

// Application-owned method selection; the generic decompiler supplies both
// reconstruction proofs. Compare against verified bytecode and historical Java
// before returning a new raw corpus. All internal generated files are temporary.
const compilerCommit='83acdd6beb2590213f8e4f0d2a5a4f7a52355b89';
const oldCompilerCommit='92e6a69ec0692bf9e6b1f63a30406bfc5455e86c';
const sourceCommit='1655ca853d0d4027018f3efcdc37be76ab7895f4';
const expectedBytecode='73c5ce3191038cd4472776e90ab73049ba41ca39bea2d34b97b61f815333b353';
export function reconstructSteelExplosion(bytecode,output){
bytecode=path.resolve(bytecode);
if(output){output=path.resolve(output);assert.equal(fs.existsSync(output),false,'Reconstruction output already exists');}
const compiler=path.resolve(workflowRoot,'../../java-tools');
const git=(...args)=>captureProcess('git',['-C',compiler,...args],{maxBuffer:128*1024*1024}).stdout;
assert.equal(git('rev-parse','HEAD').toString().trim(),compilerCommit,'Compiler source pin differs');
assert.equal(git('status','--porcelain','--untracked-files=no').toString().trim(),'','Compiler tracked files changed');
const bytecodeIdentity=inventory(bytecode,'.class');
assert.equal(bytecodeIdentity.files,347);assert.equal(bytecodeIdentity.sha256,expectedBytecode);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'steel-explosion-native-'));
const previousNodePath=process.env.NODE_PATH;
try{
  process.env.NODE_PATH=[path.join(compiler,'node_modules'),process.env.JAVA_TOOLS_NODE_DEPS_DIR&&path.join(process.env.JAVA_TOOLS_NODE_DEPS_DIR,'node_modules'),previousNodePath].filter(Boolean).join(path.delimiter);Module._initPaths();
  const req=createRequire(path.join(compiler,'package.json'));
  const {getAST}=req('jvm_parser'),{convertJson}=req(path.join(compiler,'src/parsing/convert_tree.js'));
  const {decompileAstRoot,buildExceptionModel}=req(path.join(compiler,'src/decompiler/cfr.js'));
  const {buildCfgFromCode}=req(path.join(compiler,'src/decompiler/structurer.js'));
  const {structureMethod}=req(path.join(compiler,'src/decompiler/exceptionStructurer.js'));
  const {verifyStructuredFlow}=req(path.join(compiler,'src/decompiler/structuredFlowVerifier.js'));
  const {splitIrreducibleTerms}=req(path.join(compiler,'src/decompiler/exceptionStructurer.js'));
  const {verifyCopiedFlow}=req(path.join(compiler,'src/decompiler/copiedFlowVerifier.js'));
  const {tokenizeJava}=req(path.join(compiler,'src/java-frontend/lexer.js'));
  const roots=bytecodeIdentity.entries.map(([file])=>{const p=getAST(new Uint8Array(fs.readFileSync(path.join(bytecode,file))));return convertJson(p.ast,p.constantPool);});
  const model=buildExceptionModel(roots.flatMap(root=>root.classes||[]));
  const selected=JSON.parse(JSON.stringify(roots.find(root=>root.classes[0].className==='jb')));
  selected.classes[0].items=selected.classes[0].items.filter(i=>!i.method||i.method.name==='a'&&i.method.descriptor==='(Z)V');
  const code=selected.classes[0].items.find(i=>i.method).method.attributes.find(a=>a.type==='code').code;
  assert.equal(code.exceptionTable.length,0);
  const cfg=buildCfgFromCode(code.codeItems),proof=structureMethod(code.codeItems,code.exceptionTable);
  assert.equal(proof.ok,true,proof.reason);assert.equal(proof.normalFlowVerified,true);
  assert.equal(verifyCopiedFlow(cfg.term,cfg.entry,splitIrreducibleTerms(cfg.term,cfg.entry)),true);
  assert.equal(verifyStructuredFlow(proof.tree,{entry:cfg.entry,blocks:cfg.term.map((term,block)=>({block,term}))}),true);
  function candidate(){const diagnostics=[],source=decompileAstRoot(JSON.parse(JSON.stringify(selected)),{exceptionModel:model,diagnostics});assert.deepEqual(diagnostics,[]);assert.doesNotMatch(source,/switch\s*\(statePc\)/);return source;}
  const generated=candidate();assert.equal(candidate(),generated,'Generated candidate is not deterministic');
  const baseline=path.join(temporary,'baseline');fs.mkdirSync(baseline);
  captureProcess('git',['-C',compiler,'archive','--format=tar','--output='+path.join(temporary,'compiler.tar'),oldCompilerCommit]);captureProcess('tar',['-xf',path.join(temporary,'compiler.tar'),'-C',baseline]);
  const oldReq=createRequire(path.join(baseline,'package.json')),old=oldReq(path.join(baseline,'src/decompiler/cfr.js'));
  const oldDiagnostics=[],oldSource=old.decompileAstRoot(JSON.parse(JSON.stringify(selected)),{exceptionModel:model,diagnostics:oldDiagnostics});
  assert.equal(oldDiagnostics.length,1);assert.equal(oldDiagnostics[0].kind,'stateMachineFallback');assert.match(oldSource,/switch\s*\(statePc\)/);
  if(previousNodePath===undefined)delete process.env.NODE_PATH;else process.env.NODE_PATH=previousNodePath;Module._initPaths();
  const source=archivedInput({game:'steelsentinels',source:{repository:'Kreijstal/funorb-decompiled',commit:sourceCommit,subdirectory:'games/steelsentinels'},inputTreeSha256:'2713f45b1bf8186a4a2e4c283f1b1cca876716cb17a00318e3d87ceaa13e5399'},temporary);
  const stubs=buildCompilationStubs(funorbRepository,temporary),raw=path.join(temporary,'raw'),rebuilt=path.join(temporary,'rebuilt'),shims=path.join(temporary,'shims');for(const dir of [raw,rebuilt,shims])fs.mkdirSync(dir);
  const argsFile=path.join(temporary,'sources.args');fs.writeFileSync(argsFile,sourceInventory(source).map(file=>JSON.stringify(path.join(source,file.path))).join('\n')+'\n');
  captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-sourcepath','','-cp',stubs.jar,'-d',raw,'@'+argsFile]);
  function body(text){const lexed=tokenizeJava(text);assert.deepEqual(lexed.diagnostics,[]);const ts=lexed.tokens,head=['void','a','(','boolean','param0',')','{'],found=[];for(let i=0;i<ts.length;i++)if(head.every((s,j)=>ts[i+j]?.text===s))found.push(i+head.length-1);assert.equal(found.length,1);const open=found[0];let depth=1,close=open+1;for(;close<ts.length;close++){if(ts[close].text==='{')depth++;if(ts[close].text==='}'&&!--depth)break;}assert.equal(depth,0);return [ts[open].range.startOffset,ts[close].range.endOffset];}
  const original=fs.readFileSync(path.join(source,'jb.java'),'utf8'),[start,end]=body(original),[newStart,newEnd]=body(generated),newBody=generated.slice(newStart,newEnd);
  const changed=path.join(source,'jb.java');fs.writeFileSync(changed,original.slice(0,start)+newBody+original.slice(end));
  captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-sourcepath','','-cp',[raw,stubs.jar].join(path.delimiter),'-d',rebuilt,changed]);
  const shim=path.join(temporary,'SteelSentinels.java');fs.writeFileSync(shim,'public final class SteelSentinels {public static int G;public static int field_G;}');captureProcess('javac',['--release','8','-d',shims,shim]);
  const harness=path.join(temporary,'ExplosionProbe.java');fs.writeFileSync(harness,`import java.lang.reflect.*;import java.util.*;import sun.misc.Unsafe;
public class ExplosionProbe {
static Unsafe u;static boolean nativeNames;static int checks,cases;static Class<?> e,w,t,p,s,deque,dual;
static Field f(Class<?> c,String name)throws Exception{Field x=c.getDeclaredField(nativeNames?name:"field_"+name);x.setAccessible(true);return x;}
static void set(Class<?> c,Object obj,String name,Object value)throws Exception{f(c,name).set(obj,value);}static Object get(Class<?> c,Object obj,String name)throws Exception{return f(c,name).get(obj);}
static Object call(Class<?> c,Object obj,String name,Class<?>[] types,Object...args)throws Exception{Method m=c.getDeclaredMethod(name,types);m.setAccessible(true);return m.invoke(obj,args);}
static Object make(Class<?> c,Class<?>[] types,Object...args)throws Exception{Constructor<?> k=c.getDeclaredConstructor(types);k.setAccessible(true);return k.newInstance(args);}
static void check(Object a,Object b){if(!Objects.equals(a,b))throw new AssertionError(a+" != "+b);checks++;}
static Object world()throws Exception{Object world=u.allocateInstance(w),terrain=u.allocateInstance(t);set(w,world,"ab",terrain);set(w,world,"h",true);set(w,world,"J",make(dual,new Class<?>[]{}));set(w,world,"K",make(deque,new Class<?>[]{}));set(t,terrain,"n",32);for(String name:new String[]{"m","e","f"}){int[] profile=new int[32];Arrays.fill(profile,10);set(t,terrain,name,profile);}return world;}
static Object explosion(Object world,int duration)throws Exception{return make(e,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,w,Array.newInstance(s,0).getClass(),p},80,-160,16,33,duration,world,null,null);}
static String advance(Object explosion,boolean guard)throws Exception{try{call(e,explosion,"a",new Class<?>[]{boolean.class},guard);return "ok";}catch(InvocationTargetException failure){return failure.getCause().getClass().getName();}}
static String snapshot(Object explosion)throws Exception{return get(e,explosion,"H")+","+get(e,explosion,"M")+","+get(e,explosion,"Y")+","+get(e,explosion,"N")+","+get(e,explosion,"F")+","+(get(Class.forName("kd"),explosion,"v")!=null);}
public static void main(String[] args)throws Exception{nativeNames=args[0].equals("native");Field unsafe=Unsafe.class.getDeclaredField("theUnsafe");unsafe.setAccessible(true);u=(Unsafe)unsafe.get(null);e=Class.forName("jb");w=Class.forName("ee");t=Class.forName("hd");p=Class.forName("wl");s=Class.forName("mb");deque=Class.forName("ul");dual=Class.forName("ra");
for(int control:new int[]{-1,0,1})for(boolean guard:new boolean[]{false,true})for(int count:new int[]{-1,0,1,3})for(int duration:new int[]{0,1,7,64})for(int age:new int[]{0,6,63,64})for(int vy:new int[]{-33,33}){
SteelSentinels.G=SteelSentinels.field_G=control;Object world=world(),explosion=explosion(world,duration);set(e,explosion,"N",count);set(e,explosion,"Y",age);set(e,explosion,"T",vy);
String result=advance(explosion,guard);check(result,"ok");
if(control==0){int steps=Math.max(0,count+1),afterAge=age+steps,afterY=-160;for(int i=0;i<steps;i++)afterY=Math.min(-160,afterY+vy);check(get(e,explosion,"H"),80+16*steps);check(get(e,explosion,"M"),afterY);check(get(e,explosion,"Y"),afterAge);check(get(e,explosion,"N"),!guard&&count>0?count-1:count);check(get(Class.forName("kd"),explosion,"v")!=null,!guard&&afterAge>Math.max(1,duration));if(!guard)check(get(e,explosion,"F"),64*(afterAge+(Math.max(1,duration)-afterAge)/4)/Math.max(1,duration));}
System.out.println("integration/"+control+"/"+guard+"/"+count+"/"+duration+"/"+age+"/"+vy+":"+result+"/"+snapshot(explosion));cases++;
}
SteelSentinels.G=SteelSentinels.field_G=0;
for(int size:new int[]{0,1,7})for(int total:new int[]{0,2,5})for(boolean guard:new boolean[]{false,true}){
Object world=world(),explosion=explosion(world,128),projectile=u.allocateInstance(p);set(e,explosion,"N",0);set(e,explosion,"Y",63);set(e,explosion,"I",projectile);set(p,projectile,"C",7);Object values=Array.newInstance(s,size);for(int i=0;i<size;i++)Array.set(values,i,u.allocateInstance(s));set(e,explosion,"X",values);Object entities=Array.newInstance(s,total),queue=get(w,world,"K");for(int i=0;i<total;i++){Object entity=u.allocateInstance(s);Array.set(entities,i,entity);call(deque,queue,"a",new Class<?>[]{int.class,Class.forName("ck")},3,entity);}check(advance(explosion,guard),"ok");Object after=get(e,explosion,"X");check(Array.getLength(after),Math.max(size,total));for(int i=0;i<Array.getLength(after);i++)check(Array.get(after,i),i<total?Array.get(entities,i):null);System.out.println("refresh/"+size+"/"+total+"/"+guard+":"+Array.getLength(after)+"/"+snapshot(explosion));cases++;
}
for(String failure:new String[]{"world","terrain","duration","removals"}){Object world=world(),explosion=explosion(world,1);set(e,explosion,"N",0);set(e,explosion,"Y",2);if(failure.equals("world"))set(e,explosion,"Z",null);if(failure.equals("terrain"))set(w,world,"ab",null);if(failure.equals("duration"))set(e,explosion,"z",0);if(failure.equals("removals"))set(w,world,"J",null);String result=advance(explosion,false);check(result,failure.equals("duration")?"java.lang.ArithmeticException":"java.lang.NullPointerException");System.out.println("failure/"+failure+":"+result+"/"+snapshot(explosion));cases++;}
System.out.println("cases:"+cases+"/checks:"+checks);
}}
`);
  captureProcess('javac',['-cp',shims,'-d',shims,harness]);
  const run=(directories,mode)=>captureProcess('java',['-Xverify:all','-Djava.awt.headless=true','-cp',[shims,...directories,stubs.jar].join(path.delimiter),'ExplosionProbe',mode],{maxBuffer:4*1024*1024}).stdout;
  const oracle=run([bytecode],'native'),oldTrace=run([raw],'source'),newTrace=run([rebuilt,raw],'source');assert.deepEqual(oldTrace,oracle,'Published dispatcher differs from verified bytecode');assert.deepEqual(newTrace,oracle,'Reconstructed Explosion differs from verified bytecode');
  const rawSources={files:347,sha256:sourceIdentity(sourceInventory(source))};
  const result={method:'jb.a(Z)V',bytecode:bytecodeIdentity.sha256,sourcePin:sourceCommit,compiler:{commit:compilerCommit,sourceArchiveSha256:digest(git('archive','--format=tar',compilerCommit))},baseline:{commit:oldCompilerCommit,reason:oldDiagnostics[0].reason,dispatchStates:oldDiagnostics[0].dispatchStatesAfter},reconstruction:{originalBlocks:cfg.n,clonedBlocks:proof.splitBlocks,originalEdgesVerified:true,copyCertificateVerified:true,stateMachine:false,deterministic:true,oldBodySha256:digest(original.slice(start,end)),newBodySha256:digest(newBody)},native:{summary:oracle.toString().trimEnd().split('\n').at(-1),bytecodeOldJavaNewJavaIdentical:true,traceSha256:digest(oracle),visualEmissionSuppressed:true,fullCollisionAndRenderingVerified:false},rawSources,runner:{repository:'Kreijstal/dekobloko-work',path:'readable/reconstruct-steel-explosion.mjs',sha256:digest(fs.readFileSync(fileURLToPath(import.meta.url)))},publishedExportChanged:false};
  if(output)fs.cpSync(source,output,{recursive:true});
  return result;
}finally{if(previousNodePath===undefined)delete process.env.NODE_PATH;else process.env.NODE_PATH=previousNodePath;Module._initPaths();fs.rmSync(temporary,{recursive:true,force:true});}

}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(![3,4].includes(process.argv.length))throw new Error('Usage: node readable/reconstruct-steel-explosion.mjs VERIFIED_BYTECODE [NEW_RAW_OUTPUT]');
  try{console.log(JSON.stringify(reconstructSteelExplosion(process.argv[2],process.argv[3])));}
  catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
}
