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
// Equipment identifiers and spell status occupy different fields. Check range
// baselines with no equipment, including the deployed dwarf cannon override.
for(int descriptor:new int[]{-1,0,1,31,32,63,64,255,1023}){
set(unit,v,"${f('jd','r','I')}",descriptor);
check("equipment-category/"+descriptor,call(unit,v,"${m('jd','j','(I)I')}",new Class<?>[]{int.class},20640),descriptor<0?-1:descriptor>>5);
check("equipment-id/"+descriptor,call(unit,v,"${m('jd','c','(B)I')}",new Class<?>[]{byte.class},(byte)81),descriptor<0?0:descriptor&31);}
set(unit,v,"${f('jd','r','I')}",-1);set(unit,v,"${f('jd','W','Z')}",false);
for(int[] typeRange:new int[][]{{0,1,1},{3,2,3},{11,3,5},{16,2,3},{39,0,0},{81,1,2}}){
set(unit,v,"${f('jd','N','I')}",typeRange[0]);
check("minimum-range/"+typeRange[0],call(unit,v,"${m('jd','l','(B)I')}",new Class<?>[]{byte.class},(byte)-79),typeRange[1]);
check("maximum-range/"+typeRange[0],call(unit,v,"${m('jd','B','(I)I')}",new Class<?>[]{int.class},3257),typeRange[2]);}
set(unit,v,"${f('jd','N','I')}",34);set(unit,v,"${f('jd','W','Z')}",true);
check("deployed-cannon-minimum",call(unit,v,"${m('jd','l','(B)I')}",new Class<?>[]{byte.class},(byte)-79),2);
check("deployed-cannon-maximum",call(unit,v,"${m('jd','B','(I)I')}",new Class<?>[]{int.class},3257),7);
for(int bonus:new int[]{-5,0,3,20}){set(unit,v,"${f('jd','Y','I')}",10);set(unit,v,"${f('jd','A','I')}",bonus);
check("effective-strength/"+bonus,call(unit,v,"${m('jd','g','(B)I')}",new Class<?>[]{byte.class},(byte)122),10+bonus);}
Class<?> combat=Class.forName("${className('ag')}");Class<?>[] combatTypes=new Class<?>[14];Arrays.fill(combatTypes,int.class);for(int i:new int[]{7,8,11,12})combatTypes[i]=boolean.class;
String[] combatFields={"${f('ag','z','I')}","${f('ag','Q','I')}","${f('ag','G','I')}","${f('ag','F','I')}","${f('ag','B','I')}","${f('ag','K','I')}","${f('ag','R','I')}","${f('ag','N','Z')}","${f('ag','M','Z')}","${f('ag','H','I')}","${f('ag','y','I')}","${f('ag','J','Z')}","${f('ag','E','Z')}","${f('ag','D','I')}"};
for(int seed=0;seed<16;seed++){Object[] payload={27,seed,seed+1,1,-1,seed*2,seed*3,(seed&1)!=0,(seed&2)!=0,4,5,(seed&4)!=0,(seed&8)!=0,100+seed};Object event=make(combat,combatTypes,payload);
for(int i=0;i<14;i++)check("combat-payload/"+seed+"/"+i,get(combat,event,combatFields[i]),payload[i]);
String expected="EventCombat: creature: 27, com:("+seed+","+(seed+1)+"), att:(1,-1), dam:("+(seed*2)+","+(seed*3)+")\\ndie:("+payload[7]+","+payload[8]+"), count:(4,5), deployed:("+payload[11]+","+payload[12]+"), battleid:"+(100+seed);
check("combat-description/"+seed,call(combat,event,"${m('ag','a','(BZ)Ljava/lang/String;')}",new Class<?>[]{byte.class,boolean.class},(byte)0,false),expected);}
// Check independently specified wire bytes, lengths and cursor movement.
Class<?> packet=Class.forName("${className('vh')}"),spell=Class.forName("${className('ik')}");
for(String owner:new String[]{"al","ra","wa"}){Class<?> concrete=Class.forName(owner.equals("al")?"${className('al')}":owner.equals("ra")?"${className('ra')}":"${className('wa')}");
String writer=owner.equals("al")?"${m('al','a','(ILvh;)V')}":owner.equals("ra")?"${m('ra','a','(ILvh;)V')}":"${m('wa','a','(ILvh;)V')}";
String length=owner.equals("al")?"${m('al','a','(I)I')}":owner.equals("ra")?"${m('ra','a','(I)I')}":"${m('wa','a','(I)I')}";
for(int id:new int[]{0,1,120,133,255,65535})for(int coordinate:new int[]{0,31,255}){Object effect=unsafe.allocateInstance(concrete);set(spell,effect,"${f('ik','c','I')}",id);
if(owner.equals("wa")){set(concrete,effect,"${f('wa','g','I')}",coordinate);set(concrete,effect,"${f('wa','f','I')}",255-coordinate);}
byte[] bytes=new byte[10];Arrays.fill(bytes,(byte)77);Object out=make(packet,new Class<?>[]{byte[].class},(Object)bytes);set(packet,out,"${f('vh','q','I')}",1);
call(concrete,effect,writer,new Class<?>[]{int.class,packet},-11637,out);int size=owner.equals("wa")?4:2;
byte[] expected=new byte[10];Arrays.fill(expected,(byte)77);expected[1]=(byte)(id>>8);expected[2]=(byte)id;if(size==4){expected[3]=(byte)coordinate;expected[4]=(byte)(255-coordinate);}
check("spell-bytes/"+owner+"/"+id+"/"+coordinate,Arrays.toString(bytes),Arrays.toString(expected));
check("spell-cursor/"+owner+"/"+id+"/"+coordinate,get(packet,out,"${f('vh','q','I')}"),1+size);
check("spell-length/"+owner+"/"+id+"/"+coordinate,call(concrete,effect,length,new Class<?>[]{int.class},25365),size);}}
// Execute the central combat consequence routine and inspect queued events;
// presentation and later event application are outside this fixture boundary.
Class<?> deque=Class.forName("${className('at')}"),gameEvent=Class.forName("${className('oj')}"),damageEvent=Class.forName("${className('nw')}"),turnEvent=Class.forName("${className('st')}");
for(int mask=0;mask<16;mask++){Object battle=unsafe.allocateInstance(board),queue=make(deque,new Class<?>[]{});Object tiles=Array.newInstance(tile,2);
set(board,battle,"${f('ha','v','I')}",2);set(board,battle,"${f('ha','db','I')}",1);set(board,battle,"${f('ha','Eb','[Lne;')}",tiles);set(board,battle,"${f('ha','l','Lat;')}",queue);
Object attacker=make(unit,new Class<?>[]{int.class,int.class,int.class},0,0,0),defender=make(unit,new Class<?>[]{int.class,int.class,int.class},1,0,0);
for(int i=0;i<2;i++){Object fighter=i==0?attacker:defender,tileState=make(tile,new Class<?>[]{});set(tile,tileState,"${f('ne','c','Ljd;')}",fighter);Array.set(tiles,i,tileState);set(unit,fighter,"${f('jd','l','Lha;')}",battle);set(unit,fighter,"${f('jd','Y','I')}",10);set(unit,fighter,"${f('jd','t','I')}",20);set(unit,fighter,"${f('jd','r','I')}",-1);set(unit,fighter,"${f('jd','B','I')}",1);set(unit,fighter,"${f('jd','C','Z')}",(mask&(i==0?1:2))!=0);}
call(board,battle,"${m('ha','a','(IIZIIIZIII)V')}",new Class<?>[]{int.class,int.class,boolean.class,int.class,int.class,int.class,boolean.class,int.class,int.class,int.class},0,1,(mask&4)!=0,0,0,111,(mask&8)!=0,3,2,0);
int damageCount=0,attackerHealing=0,defenderHealing=0,attackerGrowth=0,defenderGrowth=0;
Object event=call(deque,queue,"${m('at','e','(B)Ltc;')}",new Class<?>[]{byte.class},(byte)96);
while(event!=null){Object affected=get(gameEvent,event,"${f('oj','w','Ljd;')}");if(damageEvent.isInstance(event)){damageCount++;check("queued-damage/"+mask+"/"+damageCount,get(damageEvent,event,"${f('nw','D','I')}"),affected==attacker?2:3);check("queued-poison/"+mask+"/"+damageCount,get(damageEvent,event,"${f('nw','A','Z')}"),false);}else if(turnEvent.isInstance(event)){int kind=(Integer)get(turnEvent,event,"${f('st','D','I')}");if(kind==1){if(affected==attacker)attackerHealing++;else defenderHealing++;}else if(kind==4){if(affected==attacker)attackerGrowth++;else defenderGrowth++;}else throw new AssertionError("Unexpected turn effect "+kind);}else throw new AssertionError("Unexpected queued event");event=call(deque,queue,"${m('at','a','(B)Ltc;')}",new Class<?>[]{byte.class},(byte)123);}
check("combat-count/"+mask,damageCount,2);check("attacker-healing/"+mask,attackerHealing,(mask&1)!=0?3:0);check("defender-healing/"+mask,defenderHealing,(mask&2)!=0?2:0);check("attacker-growth/"+mask,attackerGrowth,(mask&8)!=0?1:0);check("defender-growth/"+mask,defenderGrowth,(mask&4)!=0?1:0);check("attacks-consumed/"+mask,get(unit,attacker,"${f('jd','B','I')}"),0);}
Class<?> planner=Class.forName("${className('nn')}");
for(int[] dimensions:new int[][]{{2,3},{5,2},{1,7}}){Object battle=unsafe.allocateInstance(board);set(board,battle,"${f('ha','v','I')}",dimensions[0]);set(board,battle,"${f('ha','db','I')}",dimensions[1]);Object plan=make(planner,new Class<?>[]{board},battle);
check("planner-width/"+dimensions[0],get(planner,plan,"${f('nn','x','I')}"),dimensions[0]);check("planner-height/"+dimensions[0],get(planner,plan,"${f('nn','A','I')}"),dimensions[1]);
for(String grid:new String[]{"${f('nn','q','[I')}","${f('nn','k','[I')}","${f('nn','e','[I')}"}){int[] cells=(int[])get(planner,plan,grid);check("planner-grid-size/"+dimensions[0]+"/"+grid.equals("${f('nn','q','[I')}"),cells.length,dimensions[0]*dimensions[1]);for(int i=0;i<cells.length;i++)if(cells[i]!=(grid.equals("${f('nn','e','[I')}")?0:1000000))throw new AssertionError("Uninitialized cost grid");}
set(planner,plan,"${f('nn','i','Ljd;')}",v);set(planner,plan,"${f('nn','p','I')}",120);set(planner,plan,"${f('nn','h','[I')}",new int[]{0,1});
call(planner,plan,"${m('nn','d','(I)V')}",new Class<?>[]{int.class},-20);check("planner-unit-cleared/"+dimensions[0],get(planner,plan,"${f('nn','i','Ljd;')}")==null,true);check("planner-spell-cleared/"+dimensions[0],get(planner,plan,"${f('nn','p','I')}"),-1);check("planner-path-cleared/"+dimensions[0],get(planner,plan,"${f('nn','h','[I')}")==null,true);}
// Highest-score selection and recycling have independently specified results.
Class<?> ai=Class.forName("${className('ej')}"),candidate=Class.forName("${className('jb')}"),strategy=Class.forName("${className('sm')}"),best=Class.forName("${className('aw')}"),weighted=Class.forName("${className('ge')}");
Object bestStrategy=make(best,new Class<?>[]{ai},(Object)null);
check("best-empty",call(best,bestStrategy,"${m('aw','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40)==null,true);
for(float[] scores:new float[][]{{-10,-20,-1},{5,5,4},{-1,0,8,3}}){Object winner=null;float maximum=-Float.MAX_VALUE;
for(float score:scores){Object choice=make(candidate,new Class<?>[]{});set(candidate,choice,"${f('jb','t','F')}",score);if(score>maximum){maximum=score;winner=choice;}
call(best,bestStrategy,"${m('aw','a','(ILjb;)V')}",new Class<?>[]{int.class,candidate},16777062,choice);}
check("best-selected/"+Arrays.toString(scores),call(best,bestStrategy,"${m('aw','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40)==winner,true);
check("best-drained/"+Arrays.toString(scores),call(best,bestStrategy,"${m('aw','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40)==null,true);}
Object recycled=make(candidate,new Class<?>[]{});set(candidate,recycled,"${f('jb','t','F')}",9.0f);
call(best,bestStrategy,"${m('aw','a','(ILjb;)V')}",new Class<?>[]{int.class,candidate},16777062,recycled);
call(strategy,bestStrategy,"${m('sm','b','(B)V')}",new Class<?>[]{byte.class},(byte)111);
check("reset-empty",call(best,bestStrategy,"${m('aw','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40)==null,true);
Object reused=call(strategy,bestStrategy,"${m('sm','b','(I)Ljb;')}",new Class<?>[]{int.class},640);check("recycled-identity",reused==recycled,true);
for(String sentinelField:new String[]{"${f('jb','s','I')}","${f('jb','q','I')}","${f('jb','k','I')}","${f('jb','o','I')}","${f('jb','m','I')}","${f('jb','l','I')}","${f('jb','r','I')}"})check("candidate-reset/"+cases,get(candidate,reused,sentinelField),-1);
check("candidate-reset-score",get(candidate,reused,"${f('jb','t','F')}"),Float.MIN_VALUE);
for(int coordinate:new int[]{-1,0,7}){set(candidate,reused,"${f('jb','k','I')}",coordinate);set(candidate,reused,"${f('jb','s','I')}",coordinate);
check("candidate-target/"+coordinate,call(candidate,reused,"${m('jb','g','(I)Z')}",new Class<?>[]{int.class},81),coordinate!=-1);
check("candidate-destination/"+coordinate,call(candidate,reused,"${m('jb','a','(I)Z')}",new Class<?>[]{int.class},0),coordinate!=-1);}
Object weightedStrategy=make(weighted,new Class<?>[]{ai},(Object)null);
check("weighted-empty",call(weighted,weightedStrategy,"${m('ge','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40)==null,true);
// One candidate yields deterministic selection despite the random threshold.
set(candidate,reused,"${f('jb','t','F')}",-3.0f);
call(weighted,weightedStrategy,"${m('ge','a','(ILjb;)V')}",new Class<?>[]{int.class,candidate},16777062,reused);
check("weighted-single",call(weighted,weightedStrategy,"${m('ge','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40)==reused,true);
check("weighted-normalized",get(candidate,reused,"${f('jb','t','F')}"),1.0f);
// Presentation lifecycle uses a controlled interface implementation, without rendering.
Class<?> presenter=Class.forName("${className('vb')}"),presentation=Class.forName("${className('pa')}"),manaEvent=Class.forName("${className('vp')}");
for(int pending:new int[]{1,3}){Object event=unsafe.allocateInstance(manaEvent),runner=unsafe.allocateInstance(presenter);final boolean[] finished={false};final int[] advanced={0};
Object visual=Proxy.newProxyInstance(presentation.getClassLoader(),new Class<?>[]{presentation},(proxy,method,args0)->{
if(method.getReturnType()==boolean.class&&method.getName().equals("${m('pa','b','(I)Z')}"))return finished[0];
if(method.getName().equals("${m('pa','b','(Loj;B)V')}")){advanced[0]++;return null;}throw new AssertionError("Unexpected presentation call");});
set(gameEvent,event,"${f('oj','m','I')}",11);set(gameEvent,event,"${f('oj','s','I')}",pending);
set(presenter,runner,"${f('vb','r','Loj;')}",event);set(presenter,runner,"${f('vb','B','Lpa;')}",visual);
call(presenter,runner,"${m('vb','a','(I)V')}",new Class<?>[]{int.class},0);check("presentation-advance/"+pending,advanced[0],1);
check("presentation-pending/"+pending,get(gameEvent,event,"${f('oj','s','I')}"),pending);
finished[0]=true;call(presenter,runner,"${m('vb','a','(I)V')}",new Class<?>[]{int.class},0);
check("presentation-ack/"+pending,get(gameEvent,event,"${f('oj','s','I')}"),pending-1);
check("presentation-complete/"+pending,get(gameEvent,event,"${f('oj','o','Z')}"),pending==1);
check("presentation-released/"+pending,get(presenter,runner,"${f('vb','B','Lpa;')}")==null,true);
call(presenter,runner,"${m('vb','a','(I)V')}",new Class<?>[]{int.class},0);
check("presentation-ack-once/"+pending,get(gameEvent,event,"${f('oj','s','I')}"),pending-1);}
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
