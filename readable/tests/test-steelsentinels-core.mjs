import fs from 'node:fs';
import {archiveIndexProbe} from './archive-index-probe.mjs';
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
static void verifyParticleMotion()throws Exception{
Class<?> particle=Class.forName("${className('qb')}"),dualDeque=Class.forName("${className('ra')}"),dual=Class.forName("${className('kd')}");
Class<?> poolOwner=Class.forName("${className('k')}"),cursorOwner=Class.forName("${className('mg')}"),allocator=Class.forName("${className('ol')}");
Object savedPool=get(poolOwner,null,"${f('k','Cb','[Lqb;')}"),savedCursor=get(cursorOwner,null,"${f('mg','hc','I')}");
Object pool=Array.newInstance(particle,10000);for(int index:new int[]{0,1,9998,9999})Array.set(pool,index,unsafe.allocateInstance(particle));
try{
set(poolOwner,null,"${f('k','Cb','[Lqb;')}",pool);
for(int cursor:new int[]{0,1,2,9999}){
set(cursorOwner,null,"${f('mg','hc','I')}",cursor);int wanted=(cursor+9999)%10000;
check("particle-pool-index/"+cursor,call(allocator,null,"${m('ol','d','(B)Lqb;')}",new Class<?>[]{byte.class},(byte)-105)==Array.get(pool,wanted),true);
check("particle-pool-cursor/"+cursor,get(cursorOwner,null,"${f('mg','hc','I')}"),wanted);
}
Object w=unsafe.allocateInstance(world),t=unsafe.allocateInstance(terrain),p=Array.get(pool,9999),primary=make(deque,new Class<?>[]{});
set(world,w,"${f('ee','ab','Lhd;')}",t);set(terrain,t,"${f('hd','n','I')}",8);
call(deque,primary,"${m('ul','a','(ILck;)V')}",new Class<?>[]{int.class,node},3,p);
set(particle,p,"${f('qb','I','I')}",999);set(cursorOwner,null,"${f('mg','hc','I')}",0);
Object made=call(part,null,"${m('nk','a','(IILee;IIZIIII)Lqb;')}",new Class<?>[]{int.class,int.class,world,int.class,int.class,boolean.class,int.class,int.class,int.class,int.class},3,-17,w,100,-1600,true,250,23,80,123);
check("particle-factory-reuses",made==p,true);check("particle-factory-keeps-link",get(node,p,"${f('ck','i','Lck;')}")!=null,true);
String[] fields={"${f('qb','M','I')}","${f('qb','A','I')}","${f('qb','B','I')}","${f('qb','I','I')}","${f('qb','D','I')}","${f('qb','O','I')}","${f('qb','F','I')}","${f('qb','P','I')}"};
int[] initial={3,-17,-1600,0,250,23,80,123};for(int i=0;i<fields.length;i++)check("particle-factory/"+i,get(particle,p,fields[i]),initial[i]);
check("particle-factory-world",get(particle,p,"${f('qb','z','Lee;')}")==w,true);
// Independent contact scenarios: free flight, each profile, equal-profile
// exceptions, water-like terrain and the terrain mode which skips contact.
int[][] contacts={
 {0,100,200,300,-6400,0,0,-6400,1,0},
 {0,100,200,300,-1600,0,0,-3200,1,0},
 {0,0,200,50,-1600,1,0,-800,1,1},
 {0,0,50,50,-1600,1,0,-800,1,0},
 {4,100,200,300,-1600,0,0,-1600,1,0},
 {0,100,200,200,-1600,0,2,-1600,1,0},
 {2,100,3000,3000,-1600,0,0,-1600,0,0},
 {0,500,200,300,-1600,0,0,-8000,1,0}
};
for(int scenario=0;scenario<contacts.length;scenario++)for(int vx:new int[]{-17,0,17})for(int duration:new int[]{200,201,202}){
int[] row=contacts[scenario];Object removal=make(dualDeque,new Class<?>[]{});set(world,w,"${f('ee','J','Lra;')}",removal);
set(terrain,t,"${f('hd','b','I')}",row[0]);String[] profiles={"${f('hd','m','[I')}","${f('hd','e','[I')}","${f('hd','f','[I')}"};
for(int i=0;i<3;i++){int[] heights=new int[8];Arrays.fill(heights,row[i+1]);set(terrain,t,profiles[i],heights);}
set(particle,p,"${f('qb','z','Lee;')}",w);set(particle,p,"${f('qb','F','I')}",80);set(particle,p,"${f('qb','B','I')}",row[4]-19);
set(particle,p,"${f('qb','A','I')}",vx);set(particle,p,"${f('qb','O','I')}",19);set(particle,p,"${f('qb','G','Z')}",row[5]!=0);
set(particle,p,"${f('qb','M','I')}",row[6]);set(particle,p,"${f('qb','I','I')}",200);set(particle,p,"${f('qb','D','I')}",duration);
call(particle,p,"${m('qb','c','(B)V')}",new Class<?>[]{byte.class},(byte)60);String label="particle-contact/"+scenario+"/"+vx+"/"+duration;
check(label+"/x",get(particle,p,"${f('qb','F','I')}"),80+vx*row[8]);check(label+"/y",get(particle,p,"${f('qb','B','I')}"),row[7]);
check(label+"/vx",get(particle,p,"${f('qb','A','I')}"),row[8]*vx*9/10);check(label+"/vy",get(particle,p,"${f('qb','O','I')}"),17);
check(label+"/surface",get(particle,p,"${f('qb','G','Z')}"),row[9]!=0);check(label+"/age",get(particle,p,"${f('qb','I','I')}"),201);
check(label+"/expired",call(dualDeque,removal,"${m('ra','b','(I)Lkd;')}",new Class<?>[]{int.class},22)==p,duration<201);
check(label+"/primary-kept",get(node,p,"${f('ck','i','Lck;')}")!=null,true);
call(dual,p,"${m('kd','e','(I)V')}",new Class<?>[]{int.class},480);
}
// Type 10 retains horizontal velocity, accelerates vertically and queues a
// type-9 child; the child inherits the unresolved final factory value.
Object pending=make(deque,new Class<?>[]{});set(world,w,"${f('ee','O','Lul;')}",pending);set(world,w,"${f('ee','z','I')}",4);set(terrain,t,"${f('hd','b','I')}",4);
set(particle,p,"${f('qb','M','I')}",10);set(particle,p,"${f('qb','A','I')}",-17);set(particle,p,"${f('qb','O','I')}",19);
set(particle,p,"${f('qb','I','I')}",200);set(particle,p,"${f('qb','D','I')}",202);set(cursorOwner,null,"${f('mg','hc','I')}",1);
call(particle,p,"${m('qb','c','(B)V')}",new Class<?>[]{byte.class},(byte)60);
check("particle-gravity/vx",get(particle,p,"${f('qb','A','I')}"),-17);check("particle-gravity/vy",get(particle,p,"${f('qb','O','I')}"),23);
Object child=call(deque,pending,"${m('ul','e','(I)Lck;')}",new Class<?>[]{int.class},13058);
check("particle-gravity/child",child==Array.get(pool,0),true);check("particle-gravity/type",get(particle,child,"${f('qb','M','I')}"),9);
check("particle-gravity/inherited",get(particle,child,"${f('qb','P','I')}"),123);
call(particle,p,"${m('qb','i','(I)V')}",new Class<?>[]{int.class},-15809);
int previousX=(Integer)get(particle,p,"${f('qb','F','I')}");call(particle,p,"${m('qb','c','(B)V')}",new Class<?>[]{byte.class},(byte)60);
check("particle-detached/x",get(particle,p,"${f('qb','F','I')}"),previousX);check("particle-detached/age",get(particle,p,"${f('qb','I','I')}"),201);
}finally{set(poolOwner,null,"${f('k','Cb','[Lqb;')}",savedPool);set(cursorOwner,null,"${f('mg','hc','I')}",savedCursor);}
}
static void verifyGuidedLaunch()throws Exception{
Class<?> projectile=Class.forName("${className('wl')}");Object w=unsafe.allocateInstance(world);set(world,w,"${f('ee','h','Z')}",true);
for(int age:new int[]{0,1,19,128,129})for(int[] vector:new int[][]{{0,0},{3,4},{-3,4},{3,-4},{-3,-4},{1,0},{0,-1},{173,-29}}){
Object p=unsafe.allocateInstance(projectile);set(projectile,p,"${f('wl','B','Lee;')}",w);set(projectile,p,"${f('wl','Z','I')}",age);
set(projectile,p,"${f('wl','hb','I')}",19);set(projectile,p,"${f('wl','jb','I')}",23);set(projectile,p,"${f('wl','H','Z')}",true);
int vx=vector[0],vy=vector[1];set(projectile,p,"${f('wl','cb','I')}",Integer.signum(vx));set(projectile,p,"${f('wl','Q','I')}",Integer.signum(vy));
set(projectile,p,"${f('wl','eb','I')}",vx);set(projectile,p,"${f('wl','F','I')}",vy);
int magnitude=Math.max(1,(int)Math.hypot(vx,vy));int expectedX=age<20?(age+5)*(vx*300)/(magnitude*25):vx;
int expectedY=age<20?vy*((age+5)*300)/(magnitude*25):vy;
String label="guided-launch/"+age+"/"+vx+"/"+vy;
check(label+"/result",call(projectile,p,"${m('wl','a','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-102,0),false);
check(label+"/vx",get(projectile,p,"${f('wl','eb','I')}"),expectedX);check(label+"/vy",get(projectile,p,"${f('wl','F','I')}"),expectedY);
check(label+"/gravity",get(projectile,p,"${f('wl','H','Z')}"),age>=128);check(label+"/age",get(projectile,p,"${f('wl','Z','I')}"),age);
}
}
static void verifySteering()throws Exception{
Class<?> angles=Class.forName("${className('cm')}"),cosine=Class.forName("${className('kg')}"),sine=Class.forName("${className('jh')}"),projectile=Class.forName("${className('wl')}");
// Mathematical values bound the literal lookup's one-unit rounding; full raw
// and named result traces must also agree exactly, including wrapped angles.
for(int angle=-17;angle<=8209;angle++){
int sin=(Integer)call(sine,null,"${m('jh','a','(II)I')}",new Class<?>[]{int.class,int.class},angle,4096);
int cos=(Integer)call(cosine,null,"${m('kg','a','(IB)I')}",new Class<?>[]{int.class,byte.class},angle,(byte)-127);
check("trig/sin/"+angle,Math.abs(sin-65536*Math.sin(angle*Math.PI/4096))<=1.01,true);
check("trig/cos/"+angle,Math.abs(cos-65536*Math.cos(angle*Math.PI/4096))<=1.01,true);
System.out.println("trig/values/"+angle+":"+sin+","+cos);
}
for(int[] v:new int[][]{{0,0},{1,0},{0,1},{-1,0},{0,-1},{1,1},{-1,1},{-1,-1},{1,-1},{123,17},{-123,17},{123,-17},{-123,-17}}){
int actual=(Integer)call(angles,null,"${m('cm','a','(III)I')}",new Class<?>[]{int.class,int.class,int.class},v[1],200,v[0]);
int expected=(int)Math.round(Math.atan2(v[1],v[0])*4096/Math.PI);
check("atan/"+Arrays.toString(v),Math.abs(actual-expected)<=2,true);System.out.println("atan/value:"+actual);
}
Object w=unsafe.allocateInstance(world);set(world,w,"${f('ee','h','Z')}",true);
for(int age:new int[]{20,21,63,127,128})for(int targetMode=0;targetMode<3;targetMode++)for(int targetAngle:new int[]{0,2048,4096,-2048}){
Object p=unsafe.allocateInstance(projectile),target=unsafe.allocateInstance(sentinel);
set(projectile,p,"${f('wl','B','Lee;')}",w);set(projectile,p,"${f('wl','Z','I')}",age);
set(projectile,p,"${f('wl','eb','I')}",64);set(projectile,p,"${f('wl','F','I')}",0);set(projectile,p,"${f('wl','H','Z')}",true);
int x=1000+(int)Math.round(1000*Math.cos(targetAngle*Math.PI/4096)),y=2000+(int)Math.round(1000*Math.sin(targetAngle*Math.PI/4096));
set(projectile,p,"${f('wl','U','I')}",1000);set(projectile,p,"${f('wl','A','I')}",2000);
set(projectile,p,"${f('wl','K','I')}",targetMode==1?77:x);set(projectile,p,"${f('wl','S','I')}",targetMode==1?88:y);
if(targetMode!=0){set(projectile,p,"${f('wl','nb','Lmb;')}",target);set(sentinel,target,"${f('mb','hc','I')}",x);set(sentinel,target,"${f('mb','Gb','I')}",y+24);set(sentinel,target,"${f('mb','Db','I')}",3);set(sentinel,target,"${f('mb','pc','Z')}",targetMode==2);}
String label="steering/"+age+"/"+targetMode+"/"+targetAngle;
check(label+"/result",call(projectile,p,"${m('wl','a','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-102,0),false);
int delta=age==128?0:targetAngle==0?0:targetAngle==-2048||targetAngle==4096?-16:16;
int speed=age==128?64:69;
int vx=(Integer)get(projectile,p,"${f('wl','eb','I')}"),vy=(Integer)get(projectile,p,"${f('wl','F','I')}");
check(label+"/vx",Math.abs(vx-speed*Math.cos(delta*Math.PI/4096))<=1.01,true);
check(label+"/vy",Math.abs(vy-speed*Math.sin(delta*Math.PI/4096))<=1.01,true);
check(label+"/gravity",get(projectile,p,"${f('wl','H','Z')}"),age==128);
check(label+"/target",get(projectile,p,"${f('wl','nb','Lmb;')}")==target,targetMode!=0&&(targetMode!=2||age==128));
check(label+"/target-x",get(projectile,p,"${f('wl','K','I')}"),targetMode==1&&age==128?77:x);
check(label+"/target-y",get(projectile,p,"${f('wl','S','I')}"),targetMode==1&&age==128?88:y);
check(label+"/age",get(projectile,p,"${f('wl','Z','I')}"),age);
System.out.println(label+"/velocity:"+vx+","+vy);
}
}
${archiveIndexProbe({className,f,m},{
  index:{owner:'jl',fields:{groupCount:'b',groupIds:'h',groupCapacity:'u',revision:'k',indexCrc:'e',indexDigest:'l',groupNameHashes:'v',groupNameLookup:'n',groupCrcs:'a',groupDigests:'t',groupVersions:'m',fileCounts:'j',fileCapacities:'g',fileIds:'o',fileNameHashes:'q',fileNameLookups:'d'}},
  lookup:{owner:'jk',get:{identity:['a','(IB)I'],types:'int.class,byte.class',guard:'(byte)120'}},
  archive:{owner:'cm',fields:{index:'a',unpackedFiles:'i'},
    ensure:{identity:['a','(Z)Z'],types:'boolean.class',args:'true'},
    groupId:{identity:['a','(Ljava/lang/String;I)I'],types:'String.class,int.class',guard:'100'},
    fileId:{identity:['a','(IILjava/lang/String;)I'],types:'int.class,int.class,String.class',arguments:(group,name)=>`${group},-32759,${name}`},
    getFile:{identity:['a','(IBI)[B'],types:'int.class,byte.class,int.class',arguments:(group,file)=>`${group},(byte)100,${file}`}},
  provider:'fa',context:{owner:'od',cause:'l'},packet:{owner:'gi',position:'p',largeSmart:{identity:['c','(Z)I'],types:'boolean.class',guard:'true'}}
})}
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
// Independent MSB-first reference: a bit at a time, across every alignment
// and width. Byte reads resume only after rounding up the consumed bit count.
Class<?> packet=Class.forName("${className('gi')}"),cipher=Class.forName("${className('kj')}"),isaac=Class.forName("${className('ie')}");
Random wireRandom=new Random(884422);
for(int offset=0;offset<8;offset++)for(int width=0;width<=32;width++){
byte[] bytes=new byte[16];wireRandom.nextBytes(bytes);byte[] original=bytes.clone();Object reader=make(cipher,new Class<?>[]{byte[].class},(Object)bytes);
set(packet,reader,"${f('gi','p','I')}",2);call(cipher,reader,"${m('kj','d','(Z)V')}",new Class<?>[]{boolean.class},false);
call(cipher,reader,"${m('kj','g','(II)I')}",new Class<?>[]{int.class,int.class},100,offset);
int expectedBits=0;for(int bit=16+offset;bit<16+offset+width;bit++)expectedBits=(expectedBits<<1)|((bytes[bit/8]>>(7-bit%8))&1);
String label="bits/"+offset+"/"+width;
check(label,call(cipher,reader,"${m('kj','g','(II)I')}",new Class<?>[]{int.class,int.class},100,width),expectedBits);
check(label+"/bit-cursor",get(cipher,reader,"${f('kj','F','I')}"),16+offset+width);
check(label+"/byte-cursor",get(packet,reader,"${f('gi','p','I')}"),2);
call(cipher,reader,"${m('kj','i','(B)V')}",new Class<?>[]{byte.class},(byte)-3);
check(label+"/aligned",get(packet,reader,"${f('gi','p','I')}"),(16+offset+width+7)/8);
check(label+"/payload",Arrays.equals(bytes,original),true);
}
// Primitive writes are checked against literal network-order bytes, then read
// through the independently selected unsigned/signed reader entry points.
for(int value:new int[]{0,1,127,128,255,256,65535,Integer.MIN_VALUE,Integer.MAX_VALUE,-1}){
byte[] bytes=new byte[12];Arrays.fill(bytes,(byte)85);Object p=make(packet,new Class<?>[]{byte[].class},(Object)bytes);set(packet,p,"${f('gi','p','I')}",1);
call(packet,p,"${m('gi','b','(ZI)V')}",new Class<?>[]{boolean.class,int.class},true,value);
call(packet,p,"${m('gi','d','(II)V')}",new Class<?>[]{int.class,int.class},value,43);
call(packet,p,"${m('gi','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)124,value);
check("primitive-bytes/"+value,Arrays.toString(bytes),Arrays.toString(new byte[]{85,(byte)(value>>>24),(byte)(value>>>16),(byte)(value>>>8),(byte)value,(byte)(value>>>8),(byte)value,(byte)value,85,85,85,85}));
check("primitive-write-position/"+value,get(packet,p,"${f('gi','p','I')}"),8);set(packet,p,"${f('gi','p','I')}",1);
check("read-int/"+value,call(packet,p,"${m('gi','i','(I)I')}",new Class<?>[]{int.class},0),value);
check("read-short/"+value,call(packet,p,"${m('gi','c','(B)I')}",new Class<?>[]{byte.class},(byte)-60),value&65535);
check("read-unsigned-byte/"+value,call(packet,p,"${m('gi','f','(B)I')}",new Class<?>[]{byte.class},(byte)-120),value&255);
set(packet,p,"${f('gi','p','I')}",7);check("read-signed-byte/"+value,call(packet,p,"${m('gi','d','(B)B')}",new Class<?>[]{byte.class},(byte)-2),(byte)value);
}
byte[] sliceSource={9,8,7,6,5,4},sliceWire=new byte[12],sliceDestination=new byte[10];Arrays.fill(sliceWire,(byte)33);Arrays.fill(sliceDestination,(byte)44);
Object slicePacket=make(packet,new Class<?>[]{byte[].class},(Object)sliceWire);set(packet,slicePacket,"${f('gi','p','I')}",3);
call(packet,slicePacket,"${m('gi','a','(IBI[B)V')}",new Class<?>[]{int.class,byte.class,int.class,byte[].class},4,(byte)-122,1,sliceSource);
check("slice-write",Arrays.toString(sliceWire),Arrays.toString(new byte[]{33,33,33,8,7,6,5,33,33,33,33,33}));
set(packet,slicePacket,"${f('gi','p','I')}",3);
call(packet,slicePacket,"${m('gi','a','(I[BII)V')}",new Class<?>[]{int.class,byte[].class,int.class,int.class},2,sliceDestination,28,4);
check("slice-read",Arrays.toString(sliceDestination),Arrays.toString(new byte[]{44,44,8,7,6,5,44,44,44,44}));
check("slice-position",get(packet,slicePacket,"${f('gi','p','I')}"),7);
// More than two ISAAC blocks: compare ciphertext traces as well as round trips
// so an identically changed encrypt/decrypt pair cannot hide a wire change.
int[][] cipherSeeds={{},{1,2,3,4},{Integer.MIN_VALUE,-1,0,Integer.MAX_VALUE}};
for(int seedIndex=0;seedIndex<cipherSeeds.length;seedIndex++){
byte[] bytes=new byte[610];Arrays.fill(bytes,(byte)66);Object writer=make(cipher,new Class<?>[]{byte[].class},(Object)bytes);
call(cipher,writer,"${m('kj','a','(I[I)V')}",new Class<?>[]{int.class,int[].class},-1833430685,cipherSeeds[seedIndex]);set(packet,writer,"${f('gi','p','I')}",3);
for(int i=0;i<600;i++)call(cipher,writer,"${m('kj','a','(IB)V')}",new Class<?>[]{int.class,byte.class},i*73+19,(byte)-117);
check("cipher-write-position/"+seedIndex,get(packet,writer,"${f('gi','p','I')}"),603);
check("cipher-prefix/"+seedIndex,bytes[2],(byte)66);check("cipher-suffix/"+seedIndex,bytes[603],(byte)66);
System.out.println("cipher-bytes/"+seedIndex+":"+Arrays.toString(bytes));
Object reader=make(cipher,new Class<?>[]{byte[].class},(Object)bytes);
call(cipher,reader,"${m('kj','a','(I[I)V')}",new Class<?>[]{int.class,int[].class},-1833430685,cipherSeeds[seedIndex]);set(packet,reader,"${f('gi','p','I')}",3);
check("cipher-guard/"+seedIndex,call(cipher,reader,"${m('kj','f','(Z)I')}",new Class<?>[]{boolean.class},true),-93);
check("cipher-guard-position/"+seedIndex,get(packet,reader,"${f('gi','p','I')}"),3);
for(int i=0;i<600;i++)check("opcode/"+seedIndex+"/"+i,call(cipher,reader,"${m('kj','f','(Z)I')}",new Class<?>[]{boolean.class},false),(i*73+19)&255);
Object bulkReader=make(cipher,new Class<?>[]{byte[].class},(Object)bytes);
call(cipher,bulkReader,"${m('kj','a','(I[I)V')}",new Class<?>[]{int.class,int[].class},-1833430685,cipherSeeds[seedIndex]);set(packet,bulkReader,"${f('gi','p','I')}",3);
byte[] destination=new byte[608];Arrays.fill(destination,(byte)22);
call(cipher,bulkReader,"${m('kj','a','(II[BI)V')}",new Class<?>[]{int.class,int.class,byte[].class,int.class},4,600,destination,49);
for(int i=0;i<600;i++)check("cipher-slice/"+seedIndex+"/"+i,destination[i+4],(byte)(i*73+19));
check("cipher-slice-prefix/"+seedIndex,destination[3],(byte)22);check("cipher-slice-suffix/"+seedIndex,destination[604],(byte)22);
check("cipher-slice-position/"+seedIndex,get(packet,bulkReader,"${f('gi','p','I')}"),603);
}
// The accepted sample population must be divisible by the bound. Express it
// as an interval in the unsigned 32-bit population, then use Math.floorMod.
int rejectedSamples=0;for(int seedIndex=0;seedIndex<cipherSeeds.length;seedIndex++)for(int bound:new int[]{1,2,3,7,256,65537,1073741825,Integer.MAX_VALUE}){
Object bounded=make(isaac,new Class<?>[]{int[].class},(Object)cipherSeeds[seedIndex]),reference=make(isaac,new Class<?>[]{int[].class},(Object)cipherSeeds[seedIndex]);
long population=1L<<32,acceptedPopulation=population-population%bound;
for(int i=0;i<300;i++){int sample;long slot;do{sample=(Integer)call(isaac,reference,"${m('ie','c','(I)I')}",new Class<?>[]{int.class},-104);slot=(long)sample-Integer.MIN_VALUE;if(slot>=acceptedPopulation)rejectedSamples++;}while(slot>=acceptedPopulation);
check("bounded/"+seedIndex+"/"+bound+"/"+i,call(isaac,bounded,"${m('ie','a','(II)I')}",new Class<?>[]{int.class,int.class},-104,bound),Math.floorMod(sample,bound));}
check("bounded-next/"+seedIndex+"/"+bound,call(isaac,bounded,"${m('ie','c','(I)I')}",new Class<?>[]{int.class},-104),call(isaac,reference,"${m('ie','c','(I)I')}",new Class<?>[]{int.class},-104));
for(int invalid:new int[]{0,-1,Integer.MIN_VALUE}){try{call(isaac,bounded,"${m('ie','a','(II)I')}",new Class<?>[]{int.class,int.class},-104,invalid);throw new AssertionError("invalid bound accepted");}catch(InvocationTargetException failure){check("invalid-bound/"+seedIndex+"/"+bound+"/"+invalid,failure.getCause() instanceof IllegalArgumentException,true);}}
}
check("bounded-rejection-exercised",rejectedSamples>0,true);
Class<?> table=Class.forName("${className('uh')}");
for(int value:new int[]{Integer.MIN_VALUE,-100000,-7,-1,0,1,7,100000,Integer.MAX_VALUE})for(int divisor:new int[]{1,2,3,65537,Integer.MAX_VALUE})
check("remainder/"+value+"/"+divisor,call(table,null,"${m('uh','a','(ZII)I')}",new Class<?>[]{boolean.class,int.class,int.class},false,value,divisor),Math.floorMod(value,divisor));
// Collisions and duplicate keys preserve insertion order; reinserting one
// node moves it between buckets without leaving its old links behind.
for(int bucketCount:new int[]{2,8,32}){
Object hash=make(table,new Class<?>[]{int.class},bucketCount);long[] keys={0,32,0,-1,Long.MIN_VALUE,Long.MAX_VALUE,1};Object[] nodes=new Object[keys.length];
for(int i=0;i<keys.length;i++){nodes[i]=make(node,new Class<?>[]{});call(table,hash,"${m('uh','a','(JLck;I)V')}",new Class<?>[]{long.class,node,int.class},keys[i],nodes[i],-1816);}
keys[1]=3;call(table,hash,"${m('uh','a','(JLck;I)V')}",new Class<?>[]{long.class,node,int.class},keys[1],nodes[1],-1816);
int[] insertionOrder={0,2,3,4,5,6,1};
for(long key:new long[]{0,32,-1,Long.MIN_VALUE,Long.MAX_VALUE,1,3,99}){Object expectedNode=null;for(int i:insertionOrder)if(keys[i]==key){expectedNode=nodes[i];break;}
check("hash-get/"+bucketCount+"/"+key,call(table,hash,"${m('uh','a','(JI)Lck;')}",new Class<?>[]{long.class,int.class},key,122)==expectedNode,true);}
Object item=call(table,hash,"${m('uh','b','(I)Lck;')}",new Class<?>[]{int.class},0);
for(int bucket=0;bucket<bucketCount;bucket++)for(int i:insertionOrder)if((keys[i]&(bucketCount-1))==bucket){check("hash-order/"+bucketCount+"/"+i,item==nodes[i],true);item=call(table,hash,"${m('uh','a','(B)Lck;')}",new Class<?>[]{byte.class},(byte)113);}
check("hash-end/"+bucketCount,item==null,true);
call(node,nodes[0],"${m('ck','b','(I)V')}",new Class<?>[]{int.class},4);
check("hash-duplicate-survives/"+bucketCount,call(table,hash,"${m('uh','a','(JI)Lck;')}",new Class<?>[]{long.class,int.class},0L,122)==nodes[2],true);
}
verifyArchiveIndexes(packet);
verifyParticleMotion();verifyGuidedLaunch();verifySteering();
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
  return {checks,rawNamedIdentical:true,independentExpectations:true,headlessClientBoundary:true,gameConstructorsBypassed:true,particleMotionFixtures:true,cyclicParticleReuseFixtures:true,guidedLaunchFixtures:true,guidedSteeringFixtures:true,trigonometricFixtures:true,traceSha256:digest(outputs[0])};
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
