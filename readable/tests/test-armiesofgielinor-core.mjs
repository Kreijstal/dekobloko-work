import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {archivedInput, digest, funorbRepository, workflowRoot} from '../game-export.mjs';
import {buildCompilationStubs} from '../compilation-stubs.mjs';

export function verifyArmiesCore(input,named,mapping,classpath,temporary) {
  const aliases=new Map(mapping.rules.map(rule=>[rule.symbol,rule.to]));
  const symbols=new Map(mapping.symbols.map(symbol=>[symbol.symbol,symbol]));
  const outputs=[];
  for(const readable of [false,true]) {
    const className=owner=>readable?aliases.get('C:'+owner)||owner:owner;
    const member=(owner,original,descriptor,kind='F')=>{
      const symbol=`${kind}:${owner}.${kind==='F'?'field_':''}${original}${kind==='F'?':':''}${descriptor}`;
      assert.ok(symbols.has(symbol),'Missing probe identity: '+symbol);
      return readable?aliases.get(symbol)||(kind==='F'?'field_':'')+original:(kind==='F'?'field_':'')+original;
    };
    const f=(owner,original,type)=>member(owner,original,type);
    const m=(owner,original,type)=>member(owner,original,type,'M');
    const directory=path.join(temporary,readable?'named-core':'raw-core');
    const compiled=path.join(directory,'classes'),shims=path.join(directory,'shims');
    fs.mkdirSync(compiled,{recursive:true});fs.mkdirSync(shims);
    // Both variants see only the false branch-control flag at runtime. Avoid
    // Applet/audio initialization; compile every real class before this shim.
    const client=className('ArmiesOfGielinor'),shim=path.join(directory,client+'.java');
    fs.writeFileSync(shim,`public final class ${client} {public static boolean ${f('ArmiesOfGielinor','M','Z')}=false;}`);
    captureProcess('javac',['--release','8','-d',shims,shim]);
    const harness=path.join(directory,'ArmiesCoreProbe.java');
    fs.writeFileSync(harness,`import java.lang.reflect.*;import java.util.*;import sun.misc.Unsafe;
public class ArmiesCoreProbe {
static Class<?> board,unit,tile,meta;static Unsafe unsafe;static int cases;
static Field field(Class<?> c,String name)throws Exception{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}
static void set(Class<?> c,Object o,String n,Object v)throws Exception{field(c,n).set(o,v);}
static Object get(Class<?> c,Object o,String n)throws Exception{return field(c,n).get(o);}
static Object call(Class<?> c,Object o,String n,Class<?>[] p,Object...v)throws Exception{Method m=c.getDeclaredMethod(n,p);m.setAccessible(true);return m.invoke(o,v);}
static Object make(Class<?> c,Class<?>[] p,Object...v)throws Exception{Constructor<?> k=c.getDeclaredConstructor(p);k.setAccessible(true);return k.newInstance(v);}
static void check(String label,Object actual,Object expected){if(!Objects.equals(actual,expected))throw new AssertionError(label+": "+actual+" != "+expected);System.out.println(label+":"+actual);cases++;}
public static void main(String[] args)throws Exception{
Field u=Unsafe.class.getDeclaredField("theUnsafe");u.setAccessible(true);unsafe=(Unsafe)u.get(null);
board=Class.forName("${className('ha')}");unit=Class.forName("${className('jd')}");tile=Class.forName("${className('ne')}");meta=Class.forName("${className('ca')}");
Object b=unsafe.allocateInstance(board); // Construction also creates terrain/resources; this probe controls only the named core state.
int[] teams={0,1,0,2,1,2};set(board,b,"${f('ha','yb','[I')}",teams);
for(int a:new int[]{-1,0,1,2,3,4,5,255})for(int z:new int[]{-1,0,1,2,3,4,5,255}){
boolean expected=a>=0&&a<6&&z>=0&&z<6&&teams[a]==teams[z];
check("allied/"+a+"/"+z,call(board,b,"${m('ha','c','(III)Z')}",new Class<?>[]{int.class,int.class,int.class},a,-16985,z),expected);}
for(int a=0;a<6;a++)check("team/"+a,call(board,b,"${m('ha','o','(II)I')}",new Class<?>[]{int.class,int.class},a,-1),teams[a]);
Class<?> roster=Class.forName("${className('go')}");int teamIndex=0;
for(int[] players:new int[][]{{},{2},{0,2,4}}){String name="team"+teamIndex++;Object team=make(roster,new Class<?>[]{String.class,int[].class},name,players);
check("roster-count/"+name,call(roster,team,"${m('go','c','(I)I')}",new Class<?>[]{int.class},16648),players.length);
check("roster-name/"+name,call(roster,team,"${m('go','d','(I)Ljava/lang/String;')}",new Class<?>[]{int.class},3),name);
for(int player:new int[]{-1,0,1,2,3,4,5,255}){boolean expected=false;for(int p:players)if(p==player)expected=true;
check("roster-member/"+name+"/"+player,call(roster,team,"${m('go','a','(IB)Z')}",new Class<?>[]{int.class,byte.class},player,(byte)-100),expected);}
// A noncanonical dummy guard changes behaviour in the original; preserve it.
check("roster-guard/"+name,call(roster,team,"${m('go','a','(IB)Z')}",new Class<?>[]{int.class,byte.class},255,(byte)0),true);}
for(int[] shape:new int[][]{{3,5},{5,2},{1,5}}){int width=shape[0],height=shape[1];Object cells=Array.newInstance(tile,width*height);
set(board,b,"${f('ha','v','I')}",width);set(board,b,"${f('ha','db','I')}",height);set(board,b,"${f('ha','Eb','[Lne;')}",cells);
Object[] occupants=new Object[width*height];for(int i=0;i<occupants.length;i++){Object t=make(tile,new Class<?>[]{});Array.set(cells,i,t);
if(i%2==0){Object v=make(unit,new Class<?>[]{int.class,int.class,int.class},i%width,i/width,20);occupants[i]=v;set(tile,t,"${f('ne','c','Ljd;')}",v);
check("x/"+width+"/"+i,get(unit,v,"${f('jd','J','I')}"),i%width);check("y/"+width+"/"+i,get(unit,v,"${f('jd','w','I')}"),i/width);check("type/"+width+"/"+i,get(unit,v,"${f('jd','N','I')}"),20);}}
for(int y=-1;y<=height;y++)for(int x=-1;x<=width;x++){Object actual=call(board,b,"${m('ha','c','(IZI)Ljd;')}",new Class<?>[]{int.class,boolean.class,int.class},y,true,x);
Object expected=x>=0&&x<width&&y>=0&&y<height?occupants[x+y*width]:null;check("cell/"+width+"/"+x+"/"+y,actual==expected,true);}}
Object v=make(unit,new Class<?>[]{int.class,int.class,int.class},0,0,20);
String[] flags={"${f('jd','s','Z')}","${f('jd','W','Z')}","${f('jd','I','Z')}","${f('jd','F','Z')}","${f('jd','C','Z')}","${f('jd','bb','Z')}","${f('jd','D','Z')}"};int[] bits={4,8,16,32,64,256,512};
for(int mask=0;mask<128;mask++){for(int i=0;i<7;i++)set(unit,v,flags[i],(mask&(1<<i))!=0);for(int low=0;low<4;low++){set(unit,v,"${f('jd','B','I')}",low);int expected=low;for(int i=0;i<7;i++)if((mask&(1<<i))!=0)expected|=bits[i];
check("flags/"+mask+"/"+low,call(unit,v,"${m('jd','h','(B)I')}",new Class<?>[]{byte.class},(byte)96),expected);}}
for(int flagsValue=0;flagsValue<16;flagsValue++){set(unit,v,"${f('jd','V','I')}",flagsValue);check("movement/"+flagsValue,call(unit,v,"${m('jd','c','(Z)Z')}",new Class<?>[]{boolean.class},false),(flagsValue&1)!=0);}
for(int protection:new int[]{0,7,8})for(int charges:new int[]{1,3})for(int damage:new int[]{0,1,5,100}){
set(unit,v,"${f('jd','Y','I')}",50);set(unit,v,"${f('jd','P','I')}",protection);set(unit,v,"${f('jd','o','I')}",charges);
call(unit,v,"${m('jd','a','(IZ)V')}",new Class<?>[]{int.class,boolean.class},damage,false);
check("damage/"+protection+"/"+charges+"/"+damage,get(unit,v,"${f('jd','Y','I')}"),protection==0?50-damage:50);
check("charges/"+protection+"/"+charges+"/"+damage,get(unit,v,"${f('jd','o','I')}"),protection==0||charges==1?charges:charges-1);
check("protection/"+protection+"/"+charges+"/"+damage,get(unit,v,"${f('jd','P','I')}"),protection!=0&&charges==1?0:protection);}
Object t=make(tile,new Class<?>[]{});check("absent-tag",call(tile,t,"${m('ne','a','(B)I')}",new Class<?>[]{byte.class},(byte)-107),0);
check("absent-owner",call(tile,t,"${m('ne','b','(B)I')}",new Class<?>[]{byte.class},(byte)-79),-1);
for(int tag:new int[]{0,1,31,65535}){call(tile,t,"${m('ne','a','(ZI)V')}",new Class<?>[]{boolean.class,int.class},true,tag);check("tag/"+tag,call(tile,t,"${m('ne','a','(B)I')}",new Class<?>[]{byte.class},(byte)-107),tag);}
for(int owner:new int[]{0,1,5,255}){call(tile,t,"${m('ne','b','(ZI)V')}",new Class<?>[]{boolean.class,int.class},true,owner);check("owner/"+owner,call(tile,t,"${m('ne','b','(B)I')}",new Class<?>[]{byte.class},(byte)-79),owner==255?-1:owner);}
Object md=get(tile,t,"${f('ne','n','Lca;')}");
for(int mask=0;mask<32;mask++){set(meta,md,"${f('ca','c','I')}",mask);
check("modifier1/"+mask,call(tile,t,"${m('ne','k','(I)Z')}",new Class<?>[]{int.class},12),(mask&1)!=0);
check("modifier2/"+mask,call(tile,t,"${m('ne','h','(I)Z')}",new Class<?>[]{int.class},-1),(mask&2)!=0);
check("modifier4/"+mask,call(tile,t,"${m('ne','e','(B)Z')}",new Class<?>[]{byte.class},(byte)-120),(mask&4)!=0);
check("corpse/"+mask,call(tile,t,"${m('ne','c','(I)Z')}",new Class<?>[]{int.class},89),(mask&8)!=0);
check("explicitOwner/"+mask,call(tile,t,"${m('ne','c','(B)Z')}",new Class<?>[]{byte.class},(byte)-79),(mask&16)!=0);
call(tile,t,"${m('ne','i','(I)V')}",new Class<?>[]{int.class},14);check("clearCorpse/"+mask,get(meta,md,"${f('ca','c','I')}"),mask&~8);}
System.out.println("checks:"+cases);
}}
`);
    const root=readable?named:input,argumentsFile=path.join(directory,'sources.args');
    fs.writeFileSync(argumentsFile,[...sourceInventory(root).map(file=>JSON.stringify(path.join(root,file.path)))].join('\n')+'\n');
    captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-sourcepath','','-classpath',classpath,'-d',compiled,'@'+argumentsFile]);
    // The harness alone needs Unsafe, which javac --release deliberately hides.
    captureProcess('javac',['-encoding','UTF-8','-classpath',compiled,'-d',compiled,harness]);
    outputs.push(captureProcess('java',['-Djava.awt.headless=true','-cp',[shims,compiled,classpath].join(path.delimiter),'ArmiesCoreProbe']).stdout);
  }
  assert.deepEqual(outputs[1],outputs[0],'Named gameplay core differs from pinned raw Java');
  const checks=Number(outputs[0].toString().trimEnd().split('\n').at(-1).split(':')[1]);
  assert.ok(checks>900);
  return {checks,rawNamedIdentical:true,independentExpectations:true,headlessClientBoundary:true,battlefieldConstructorBypassed:true,traceSha256:digest(outputs[0])};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'armies-core-check-'));
  try {
    const rules=JSON.parse(fs.readFileSync(path.join(workflowRoot,'armiesofgielinor-rules.json')));
    const mapping=JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/armiesofgielinor-naming.json')));
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    console.log(JSON.stringify(verifyArmiesCore(input,path.join(funorbRepository,'games/armiesofgielinor'),mapping,stubs.jar,temporary)));
  } catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
  finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
