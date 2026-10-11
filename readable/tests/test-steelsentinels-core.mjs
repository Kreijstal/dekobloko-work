import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {archivedInput, digest, funorbRepository, workflowRoot} from '../game-export.mjs';
import {buildCompilationStubs} from '../compilation-stubs.mjs';

export function verifySteelCore(input,named,mapping,classpath,temporary) {
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
    const f=(owner,original,type)=>member(owner,original,type),m=(owner,original,type)=>member(owner,original,type,'M');
    const directory=path.join(temporary,readable?'named-core':'raw-core');
    const compiled=path.join(directory,'classes'),shims=path.join(directory,'shims');
    fs.mkdirSync(compiled,{recursive:true});fs.mkdirSync(shims);
    // Compile every actual game class; replace only the branch-control integer
    // at runtime to avoid the Applet/UI graph. Both variants use this boundary.
    const client=className('SteelSentinels'),shim=path.join(directory,client+'.java');
    fs.writeFileSync(shim,`public final class ${client} {public static int ${f('SteelSentinels','G','I')}=0;}`);
    captureProcess('javac',['--release','8','-d',shims,shim]);
    const harness=path.join(directory,'SteelCoreProbe.java');
    fs.writeFileSync(harness,`import java.lang.reflect.*;import java.util.*;import sun.misc.Unsafe;
public class SteelCoreProbe {
static Unsafe unsafe;static int cases;static Class<?> world,sentinel,terrain,deque,node,part,instruction;
static Field field(Class<?> c,String name)throws Exception{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}
static void set(Class<?> c,Object o,String n,Object v)throws Exception{field(c,n).set(o,v);}
static Object get(Class<?> c,Object o,String n)throws Exception{return field(c,n).get(o);}
static Object call(Class<?> c,Object o,String n,Class<?>[] p,Object...v)throws Exception{Method m=c.getDeclaredMethod(n,p);m.setAccessible(true);return m.invoke(o,v);}
static Object make(Class<?> c,Class<?>[] p,Object...v)throws Exception{Constructor<?> k=c.getDeclaredConstructor(p);k.setAccessible(true);return k.newInstance(v);}
static void check(String label,Object actual,Object expected){if(!Objects.equals(actual,expected))throw new AssertionError(label+": "+actual+" != "+expected);System.out.println(label+":"+actual);cases++;}
public static void main(String[] args)throws Exception{
Field u=Unsafe.class.getDeclaredField("theUnsafe");u.setAccessible(true);unsafe=(Unsafe)u.get(null);
world=Class.forName("${className('ee')}");sentinel=Class.forName("${className('mb')}");terrain=Class.forName("${className('hd')}");deque=Class.forName("${className('ul')}");node=Class.forName("${className('ck')}");part=Class.forName("${className('nk')}");instruction=Class.forName("${className('qd')}");
Object w=unsafe.allocateInstance(world),s=unsafe.allocateInstance(sentinel);set(sentinel,s,"${f('mb','xc','Lee;')}",w);
// Capability aliases are intentionally different from the bonus-count rules.
int[] supportedActive={-1,20,34,40};int[][] installed={{},{27,33},{34},{20,30,4}};
for(int active:supportedActive)for(int[] modules:installed){set(sentinel,s,"${f('mb','rc','I')}",active);set(sentinel,s,"${f('mb','nb','[I')}",modules);set(sentinel,s,"${f('mb','s','I')}",modules.length);
Set<Integer> capabilities=new HashSet<>();capabilities.add(active);if(active==40){capabilities.add(26);capabilities.add(27);}for(int id:modules){capabilities.add(id);if(id==34)for(int v=-1;v<35;v++)if(v!=20&&v!=30)capabilities.add(v);}
for(int requested=-1;requested<=42;requested++){
check("module/"+active+"/"+Arrays.toString(modules)+"/"+requested,call(sentinel,s,"${m('mb','i','(II)Z')}",new Class<?>[]{int.class,int.class},requested,-27),capabilities.contains(requested));
int expected=7;Set<Integer> activeBonus=new HashSet<>();activeBonus.add(active);if(active==40){activeBonus.add(32);activeBonus.add(33);}if(activeBonus.contains(requested))expected++;
Set<Integer> moduleBonus=new HashSet<>();for(int id:modules)moduleBonus.add(id);if(moduleBonus.contains(requested)||moduleBonus.contains(34))expected++;
check("bonus/"+active+"/"+Arrays.toString(modules)+"/"+requested,call(sentinel,s,"${m('mb','h','(II)I')}",new Class<?>[]{int.class,int.class},7,requested),expected);}}
for(int player:new int[]{0,1})for(int start:new int[]{0,100,500})for(int amount:new int[]{-20,0,1,100,1000}){
set(sentinel,s,"${f('mb','Bb','I')}",player);set(sentinel,s,"${f('mb','rb','I')}",start);set(world,w,"${f('ee','q','I')}",100000);
call(sentinel,s,"${m('mb','e','(II)V')}",new Class<?>[]{int.class,int.class},128,amount);
check("armour/"+player+"/"+start+"/"+amount,get(sentinel,s,"${f('mb','rb','I')}"),start-amount);
check("armour-world/"+player+"/"+start+"/"+amount,get(world,w,"${f('ee','q','I')}"),100000-(player==0?128*amount:0));
set(sentinel,s,"${f('mb','rb','I')}",start);set(sentinel,s,"${f('mb','Eb','I')}",600);set(world,w,"${f('ee','a','I')}",100000);set(world,w,"${f('ee','q','I')}",100000);
call(sentinel,s,"${m('mb','e','(I)V')}",new Class<?>[]{int.class},-20039);
check("restore/"+player+"/"+start+"/"+amount,get(sentinel,s,"${f('mb','rb','I')}"),600);
check("restore-old/"+player+"/"+start+"/"+amount,get(world,w,"${f('ee','a','I')}"),100000-(player==0?128*start:0));
check("restore-new/"+player+"/"+start+"/"+amount,get(world,w,"${f('ee','q','I')}"),100000+(player==0?128*600:0));
set(sentinel,s,"${f('mb','rb','I')}",start);set(world,w,"${f('ee','a','I')}",100000);
call(sentinel,s,"${m('mb','f','(I)V')}",new Class<?>[]{int.class},128);
check("clear/"+player+"/"+start+"/"+amount,get(sentinel,s,"${f('mb','rb','I')}"),0);
check("clear-world/"+player+"/"+start+"/"+amount,get(world,w,"${f('ee','a','I')}"),100000-(player==0?128*start:0));}
for(int player:new int[]{0,1})for(int active:new int[]{-1,37})for(int old:new int[]{0,5,30})for(int amount:new int[]{-100,0,1,40,100}){
set(sentinel,s,"${f('mb','Bb','I')}",player);set(sentinel,s,"${f('mb','rc','I')}",active);set(sentinel,s,"${f('mb','Tb','I')}",old);set(sentinel,s,"${f('mb','x','I')}",20);
set(world,w,"${f('ee','r','I')}",12);set(world,w,"${f('ee','N','I')}",100000);set(world,w,"${f('ee','f','I')}",100000);
int next=active==37?40:Math.min(20,old-amount);
call(sentinel,s,"${m('mb','a','(ZI)V')}",new Class<?>[]{boolean.class,int.class},true,amount);
check("charge/"+player+"/"+active+"/"+old+"/"+amount,get(sentinel,s,"${f('mb','Tb','I')}"),next);
check("charge-world/"+player+"/"+active+"/"+old+"/"+amount,get(world,w,"${f('ee','N','I')}"),100000+(player==0?(12+next-old)*256:0));
call(sentinel,s,"${m('mb','g','(I)V')}",new Class<?>[]{int.class},5);check("refill/"+player+"/"+active+"/"+old+"/"+amount,get(sentinel,s,"${f('mb','Tb','I')}"),20);}
Object t=unsafe.allocateInstance(terrain);int[][] profiles={{200,400,100,800,600},{5,4,3,2,1},{9,8,7,6,5}};String[] profileFields={"${f('hd','m','[I')}","${f('hd','e','[I')}","${f('hd','f','[I')}"};
set(terrain,t,"${f('hd','n','I')}",5);for(int i=0;i<3;i++)set(terrain,t,profileFields[i],profiles[i]);
for(int x:new int[]{-100,-1,0,1,4,5,100}){
check("ground/"+x,call(terrain,t,"${m('hd','a','(BI)I')}",new Class<?>[]{byte.class,int.class},(byte)-98,x),profiles[0][Math.max(0,Math.min(4,x))]);
check("secondary/"+x,call(terrain,t,"${m('hd','a','(ZI)I')}",new Class<?>[]{boolean.class,int.class},false,x),profiles[1][Math.max(0,Math.min(4,x))]);
check("surface/"+x,call(terrain,t,"${m('hd','b','(BI)I')}",new Class<?>[]{byte.class,int.class},(byte)120,x),profiles[2][Math.max(0,Math.min(4,x))]);}
// Two-level attached-part fixture: contributions count once at each attachment.
Object leaf=unsafe.allocateInstance(part),root=unsafe.allocateInstance(part);Object leafInstructions=Array.newInstance(instruction,2),rootInstructions=Array.newInstance(instruction,2);
for(int i=0;i<2;i++){Object item=unsafe.allocateInstance(instruction);set(instruction,item,"${f('qd','e','I')}",10+i*20);Array.set(leafInstructions,i,item);}
set(part,leaf,"${f('nk','I','[Lqd;')}",leafInstructions);
for(int i=0;i<2;i++){Object item=unsafe.allocateInstance(instruction);set(instruction,item,"${f('qd','e','I')}",100+i*100);if(i==0)set(instruction,item,"${f('qd','d','Lnk;')}",leaf);Array.set(rootInstructions,i,item);}
set(part,root,"${f('nk','I','[Lqd;')}",rootInstructions);
check("leaf-armour",call(part,leaf,"${m('nk','g','(I)I')}",new Class<?>[]{int.class},8192),40);
check("root-armour",call(part,root,"${m('nk','g','(I)I')}",new Class<?>[]{int.class},8192),340);
// Check full Java-int wrapping in synchronization, including large coordinates.
String[] stateFields={"${f('mb','hc','I')}","${f('mb','Gb','I')}","${f('mb','K','I')}","${f('mb','ab','I')}","${f('mb','ub','I')}","${f('mb','Tb','I')}","${f('mb','vb','I')}","${f('mb','rb','I')}"};
Random random=new Random(918273);for(int seed=0;seed<64;seed++){Object list=make(deque,new Class<?>[]{});set(world,w,"${f('ee','K','Lul;')}",list);int tick=seed*10,d=seed-20,level=seed*3,points=seed*100;set(world,w,"${f('ee','r','I')}",tick);set(world,w,"${f('ee','d','I')}",d);set(world,w,"${f('ee','M','I')}",level);set(world,w,"${f('ee','gb','I')}",points);
int expected=tick+(((d+level+points)&65535)<<16);for(int i=0;i<seed%5;i++){Object value=unsafe.allocateInstance(sentinel);int[] state=new int[8];for(int j=0;j<8;j++){state[j]=random.nextInt();set(sentinel,value,stateFields[j],state[j]);}set(sentinel,value,"${f('mb','Bb','I')}",i);
call(deque,list,"${m('ul','a','(ILck;)V')}",new Class<?>[]{int.class,node},3,value);
expected+=(3*state[1]+2*state[0])&65535;expected+=state[2]&65535;expected+=(state[3]&65535)<<16;expected+=(11*state[4]+7*state[5])&65535;expected+=(state[6]&65535)<<16;expected+=(5*state[7])&65535;
check("find/"+seed+"/"+i,call(world,w,"${m('ee','f','(II)Lmb;')}",new Class<?>[]{int.class,int.class},i,-127)==value,true);}
check("checksum/"+seed,call(world,w,"${m('ee','b','(Z)I')}",new Class<?>[]{boolean.class},false),expected);
check("missing/"+seed,call(world,w,"${m('ee','f','(II)Lmb;')}",new Class<?>[]{int.class,int.class},123,-127)==null,true);}
// Independent command duration table, including unknown variants and Java overflow.
Class<?> command=Class.forName("${className('je')}");
int[] weaponDuration={25,20,35,50,75,75,40,50,100,30,20};
for(int type=-1;type<=13;type++)for(int variant=-1;variant<=11;variant++)for(int start:new int[]{-100,0,27,Integer.MAX_VALUE}){
int duration=50;boolean active=false;
switch(type){case 0:duration=variant>=0&&variant<weaponDuration.length?weaponDuration[variant]:10;active=variant>=6&&variant<=10;break;
case 3:duration=100;active=true;break;case 5:duration=125;active=true;break;case 6:case 12:duration=5;break;
case 7:duration=variant==3?100:25;active=true;break;case 8:case 9:duration=25;active=true;break;case 10:duration=1;break;case 11:duration=25;break;}
Object c=make(command,new Class<?>[]{int.class,int.class,int.class},type,variant,start);
String label="command/"+type+"/"+variant+"/"+start;
check(label+"/type",get(command,c,"${f('je','s','I')}"),type);check(label+"/variant",get(command,c,"${f('je','A','I')}"),variant);
check(label+"/start",get(command,c,"${f('je','x','I')}"),start);check(label+"/end",get(command,c,"${f('je','r','I')}"),start+duration);
check(label+"/active",get(command,c,"${f('je','z','Z')}"),active);check(label+"/scheduled",get(command,c,"${f('je','p','Z')}"),false);}
// Both scheduling queues independently remain sorted; equal ticks replace.
Object queuedSentinel=unsafe.allocateInstance(sentinel),primary=make(deque,new Class<?>[]{}),secondary=make(deque,new Class<?>[]{});
set(sentinel,queuedSentinel,"${f('mb','B','Lul;')}",primary);set(sentinel,queuedSentinel,"${f('mb','Ec','Lul;')}",secondary);
TreeMap<Integer,Object> primaryExpected=new TreeMap<>(),secondaryExpected=new TreeMap<>();
int[] ticks={20,10,30,20,5,40,30};
for(int type:new int[]{0,3,4,6,7,11})for(int tick:ticks){Object c=make(command,new Class<?>[]{int.class,int.class,int.class},type,0,tick);
TreeMap<Integer,Object> expected=(type==3||type==4||type==6)?secondaryExpected:primaryExpected;Object replaced=expected.put(tick,c);
call(sentinel,queuedSentinel,"${m('mb','d','(BLje;)V')}",new Class<?>[]{byte.class,command},(byte)100,c);
check("scheduled/"+type+"/"+tick,get(command,c,"${f('je','p','Z')}"),true);
if(replaced!=null)check("replacement-unlinked/"+type+"/"+tick,get(node,replaced,"${f('ck','i','Lck;')}")==null,true);
for(int q=0;q<2;q++){Object queue=q==0?primary:secondary;Object item=call(deque,queue,"${m('ul','e','(I)Lck;')}",new Class<?>[]{int.class},13058);
for(Object want:(q==0?primaryExpected:secondaryExpected).values()){check("queue/"+type+"/"+tick+"/"+q+"/"+get(command,want,"${f('je','x','I')}"),item==want,true);item=call(deque,queue,"${m('ul','a','(B)Lck;')}",new Class<?>[]{byte.class},(byte)-36);}
check("queue-end/"+type+"/"+tick+"/"+q,item==null,true);}}
// A noncanonical guard rejects insertion; stale unscheduled entries are removed.
Object rejected=make(command,new Class<?>[]{int.class,int.class,int.class},0,0,50);
call(sentinel,queuedSentinel,"${m('mb','d','(BLje;)V')}",new Class<?>[]{byte.class,command},(byte)45,rejected);
check("rejected-scheduled",get(command,rejected,"${f('je','p','Z')}"),false);check("rejected-link",get(node,rejected,"${f('ck','i','Lck;')}")==null,true);
Object stale=primaryExpected.firstEntry().getValue();set(command,stale,"${f('je','p','Z')}",false);
Object next=make(command,new Class<?>[]{int.class,int.class,int.class},0,0,50);
call(sentinel,queuedSentinel,"${m('mb','d','(BLje;)V')}",new Class<?>[]{byte.class,command},(byte)100,next);
check("stale-unlinked",get(node,stale,"${f('ck','i','Lck;')}")==null,true);
set(sentinel,queuedSentinel,"${f('mb','V','Z')}",true);
call(sentinel,queuedSentinel,"${m('mb','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)75,50);
check("primary-cleared",call(deque,primary,"${m('ul','b','(B)I')}",new Class<?>[]{byte.class},(byte)-128),0);
check("secondary-cleared",call(deque,secondary,"${m('ul','b','(B)I')}",new Class<?>[]{byte.class},(byte)-128),0);
System.out.println("checks:"+cases);
}}
`);
    const root=readable?named:input,argumentsFile=path.join(directory,'sources.args');
    fs.writeFileSync(argumentsFile,sourceInventory(root).map(file=>JSON.stringify(path.join(root,file.path))).join('\n')+'\n');
    captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-sourcepath','','-classpath',classpath,'-d',compiled,'@'+argumentsFile]);
    captureProcess('javac',['-encoding','UTF-8','-classpath',compiled,'-d',compiled,harness]);
    outputs.push(captureProcess('java',['-Djava.awt.headless=true','-cp',[shims,compiled,classpath].join(path.delimiter),'SteelCoreProbe']).stdout);
  }
  assert.deepEqual(outputs[1],outputs[0],'Named Steel gameplay core differs from pinned raw Java');
  const checks=Number(outputs[0].toString().trimEnd().split('\n').at(-1).split(':')[1]);assert.ok(checks>1500);
  return {checks,rawNamedIdentical:true,independentExpectations:true,headlessClientBoundary:true,gameConstructorsBypassed:true,traceSha256:digest(outputs[0])};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'steel-core-check-'));
  try {
    const rules=JSON.parse(fs.readFileSync(path.join(workflowRoot,'steelsentinels-rules.json')));
    const mapping=JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/steelsentinels-naming.json')));
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    console.log(JSON.stringify(verifySteelCore(input,path.join(funorbRepository,'games/steelsentinels'),mapping,stubs.jar,temporary)));
  } catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
  finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
