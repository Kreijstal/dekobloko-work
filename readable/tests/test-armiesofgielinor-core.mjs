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
// Independently encoded packed movement requests: partial groups and signed deltas.
Class<?> request=Class.forName("${className('mn')}"),moveRequest=Class.forName("${className('am')}"),prepared=Class.forName("${className('bd')}");
for(int length:new int[]{0,1,3,4,5,8,9,17})for(int dx:new int[]{-128,-1,0,1,127})for(int dy:new int[]{-128,-1,0,1,127}){
int groups=(length+3)/4;byte[] encoded=new byte[6+groups];int header=length|0xe000;encoded[0]=(byte)(header>>>8);encoded[1]=(byte)header;encoded[2]=(byte)255;encoded[3]=(byte)31;
int[] directions=new int[length];for(int i=0;i<length;i++){directions[i]=(i+length)%4;encoded[4+i/4]|=(byte)(directions[i]<<(2*(i%4)));}
encoded[4+groups]=(byte)dx;encoded[5+groups]=(byte)dy;Object wire=make(packet,new Class<?>[]{byte[].class},(Object)encoded);
Object action=make(moveRequest,new Class<?>[]{packet,int.class},wire,3);String label="request-wire/"+length+"/"+dx+"/"+dy;
check(label+"/directions",Arrays.toString((int[])get(moveRequest,action,"${f('am','H','[I')}")),Arrays.toString(directions));
check(label+"/x",get(moveRequest,action,"${f('am','J','I')}"),255);check(label+"/y",get(moveRequest,action,"${f('am','G','I')}"),31);
check(label+"/dx",get(moveRequest,action,"${f('am','w','I')}"),dx);check(label+"/dy",get(moveRequest,action,"${f('am','E','I')}"),dy);
check(label+"/player",get(request,action,"${f('mn','p','I')}"),3);check(label+"/cursor",get(packet,wire,"${f('vh','q','I')}"),encoded.length);}
// The array constructor intentionally ignores the separate length argument.
int[] originalPath={0,1,2};Object copiedRequest=make(moveRequest,new Class<?>[]{int.class,int.class,int[].class,int.class,int.class,int.class,int.class},2,999,originalPath,4,5,-1,2);
check("request-array-identity",get(moveRequest,copiedRequest,"${f('am','H','[I')}")==originalPath,true);
Class<?> sphinxRequest=Class.forName("${className('ee')}");make(sphinxRequest,new Class<?>[]{int.class,int.class,int.class,request},0,1,2,copiedRequest);
check("sphinx-owner-bypass",get(request,copiedRequest,"${f('mn','u','Z')}"),true);
// Prepared actions queue event payloads, without applying those later events.
Class<?> movementAction=Class.forName("${className('ld')}"),moveEvent=Class.forName("${className('kr')}"),attackEvent=Class.forName("${className('ns')}");
Object actionBattle=unsafe.allocateInstance(board),actionQueue=make(deque,new Class<?>[]{});set(board,actionBattle,"${f('ha','l','Lat;')}",actionQueue);
Object mover=make(unit,new Class<?>[]{int.class,int.class,int.class},5,7,0);
for(int[] steps:new int[][]{{},{0},{1},{2},{3},{0,0,2,1,3}})for(boolean attack:new boolean[]{false,true}){
Object action=unsafe.allocateInstance(movementAction);set(movementAction,action,"${f('ld','u','I')}",5);set(movementAction,action,"${f('ld','v','I')}",7);
set(movementAction,action,"${f('ld','C','[I')}",steps);set(movementAction,action,"${f('ld','D','I')}",steps.length);set(movementAction,action,"${f('ld','y','Ljd;')}",mover);
set(movementAction,action,"${f('ld','w','I')}",attack?-2:0);set(movementAction,action,"${f('ld','t','I')}",attack?1:0);
int endX=5,endY=7;for(int direction:steps){switch(direction){case 0:endX++;break;case 1:endY--;break;case 2:endY++;break;case 3:endX--;break;}}
call(movementAction,action,"${m('ld','a','(ILha;)V')}",new Class<?>[]{int.class,board},64,actionBattle);
Object event=call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);
String label="prepared-move/"+Arrays.toString(steps)+"/"+attack;check(label+"/event",moveEvent.isInstance(event),true);
check(label+"/path",Arrays.toString((int[])get(moveEvent,event,"${f('kr','B','[I')}")),Arrays.toString(steps));
check(label+"/path-copy",get(moveEvent,event,"${f('kr','B','[I')}")!=steps,true);
check(label+"/origin-x",get(movementAction,action,"${f('ld','E','I')}"),endX);check(label+"/origin-y",get(movementAction,action,"${f('ld','F','I')}"),endY);
if(attack){event=call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);check(label+"/attack",attackEvent.isInstance(event),true);
check(label+"/attack-dx",get(attackEvent,event,"${f('ns','z','I')}"),-2);check(label+"/attack-dy",get(attackEvent,event,"${f('ns','H','I')}"),1);}
check(label+"/end",call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);}
Class<?> teleportAction=Class.forName("${className('ur')}"),teleportEvent=Class.forName("${className('ec')}");
for(int dx:new int[]{-128,-1,0,127})for(int dy:new int[]{-128,-1,0,127})for(boolean skip:new boolean[]{false,true}){
Object action=make(teleportAction,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,unit,boolean.class},99,88,dx,dy,2,mover,skip);
call(teleportAction,action,"${m('ur','a','(ILha;)V')}",new Class<?>[]{int.class,board},64,actionBattle);
Object event=call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);String label="prepared-teleport/"+dx+"/"+dy+"/"+skip;
check(label+"/source-x",get(teleportEvent,event,"${f('ec','A','I')}"),5);check(label+"/source-y",get(teleportEvent,event,"${f('ec','B','I')}"),7);
check(label+"/dx",get(teleportEvent,event,"${f('ec','z','I')}"),dx);check(label+"/dy",get(teleportEvent,event,"${f('ec','y','I')}"),dy);check(label+"/skip",get(teleportEvent,event,"${f('ec','D','Z')}"),skip);}
Class<?> growthAction=Class.forName("${className('pe')}"),growthEvent=Class.forName("${className('kf')}");
Object growth=make(growthAction,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class},4,5,1,2,19,3);
call(growthAction,growth,"${m('pe','a','(ILha;)V')}",new Class<?>[]{int.class,board},64,actionBattle);
Object growthPayload=call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);
String[] growthFields={"${f('kf','H','I')}","${f('kf','F','I')}","${f('kf','J','I')}","${f('kf','y','I')}","${f('kf','z','I')}","${f('kf','C','I')}"};int[] growthExpected={4,5,1,2,19,3};
for(int i=0;i<growthFields.length;i++)check("prepared-growth/"+i,get(growthEvent,growthPayload,growthFields[i]),growthExpected[i]);
Class<?> deployment=Class.forName("${className('pl')}"),deployEvent=Class.forName("${className('tr')}"),deathEvent=Class.forName("${className('hp')}");
for(int type:new int[]{0,7,17,34,39}){set(unit,mover,"${f('jd','N','I')}",type);Object action=make(deployment,new Class<?>[]{int.class,unit,int.class},2,mover,13);
call(deployment,action,"${m('pl','a','(ILha;)V')}",new Class<?>[]{int.class,board},64,actionBattle);
Object event=call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);
if(type==0)check("prepared-deploy/0",event==null,true);else if(type==39)check("prepared-deploy/death",deathEvent.isInstance(event),true);
else{check("prepared-deploy/"+type,deployEvent.isInstance(event),true);check("prepared-deploy/modifier/"+type,get(deployEvent,event,"${f('tr','B','I')}"),13);}
check("prepared-deploy/end/"+type,call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);}
// Turn markers keep their player-sized arrays and canonical no-op application.
for(String owner:new String[]{"dk","kj"}){Class<?> marker=Class.forName(owner.equals("dk")?"${className('dk')}":"${className('kj')}");String apply=owner.equals("dk")?"${m('dk','a','(ILha;)V')}":"${m('kj','a','(ILha;)V')}";
for(int player=0;player<4;player++){Object action=make(marker,new Class<?>[]{int.class,int.class},player,4);int[] expected=new int[4];expected[player]=owner.equals("dk")?1024:8192;
check("marker-flags/"+owner+"/"+player,Arrays.toString((int[])get(prepared,action,"${f('bd','n','[I')}")),Arrays.toString(expected));
call(marker,action,apply,new Class<?>[]{int.class,board},64,actionBattle);check("marker-no-event/"+owner+"/"+player,call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);}}
call(strategy,bestStrategy,"${m('sm','a','(IIFIIZ)V')}",new Class<?>[]{int.class,int.class,float.class,int.class,int.class,boolean.class},7,74,2.5f,3,5,true);
Object summonChoice=call(best,bestStrategy,"${m('aw','a','(B)Ljb;')}",new Class<?>[]{byte.class},(byte)-40);
check("summon-candidate/player",get(candidate,summonChoice,"${f('jb','m','I')}"),3);check("summon-candidate/type",get(candidate,summonChoice,"${f('jb','l','I')}"),74);
check("summon-candidate/x",get(candidate,summonChoice,"${f('jb','s','I')}"),5);check("summon-candidate/y",get(candidate,summonChoice,"${f('jb','q','I')}"),7);
Class<?> spellRequest=Class.forName("${className('to')}"),castAction=Class.forName("${className('ua')}"),castEvent=Class.forName("${className('pj')}"),globalSpell=Class.forName("${className('al')}");
Object spellObject=make(globalSpell,new Class<?>[]{int.class},9),spellOrder=make(spellRequest,new Class<?>[]{spell,int.class,int.class},spellObject,17,2);
Object preparedCast=call(spellRequest,spellOrder,"${m('to','a','(ILha;)Lbd;')}",new Class<?>[]{int.class,board},100,actionBattle);
check("spell-request/action",castAction.isInstance(preparedCast),true);
call(castAction,preparedCast,"${m('ua','a','(ILha;)V')}",new Class<?>[]{int.class,board},64,actionBattle);
Object castPayload=call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);
check("prepared-cast/spell",get(castEvent,castPayload,"${f('pj','B','Lik;')}")==spellObject,true);
check("prepared-cast/player",get(castEvent,castPayload,"${f('pj','z','I')}"),2);
check("prepared-cast/mode",get(castEvent,castPayload,"${f('pj','y','I')}"),17);
for(String owner:new String[]{"il","ss"}){Class<?> marker=Class.forName(owner.equals("il")?"${className('il')}":"${className('ss')}");
Object action=owner.equals("il")?make(marker,new Class<?>[]{int.class,int.class,unit,tile},1,2,mover,make(tile,new Class<?>[]{})):make(marker,new Class<?>[]{int.class,int.class,int.class,int.class},1,2,0,3);
String apply=owner.equals("il")?"${m('il','a','(ILha;)V')}":"${m('ss','a','(ILha;)V')}";
call(marker,action,apply,new Class<?>[]{int.class,board},64,actionBattle);check("marker-no-event/"+owner,call(deque,actionQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);}
check("illegal-action/player",call(request,copiedRequest,"${m('mn','a','(I[Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;')}",new Class<?>[]{int.class,String[].class,String.class},118,new String[]{"bad tile"},"move"),"Illegal move (move); player 2: bad tile.");
// Projection of effects distinguishes one's own team from other teams.
Object effectsTile=make(tile,new Class<?>[]{});
for(int own=0;own<32;own++)for(int other=0;other<32;other++){
set(tile,effectsTile,"${f('ne','k','[I')}",new int[]{own,other});
check("team-effects/"+own+"/"+other,call(tile,effectsTile,"${m('ne','a','(BII)I')}",new Class<?>[]{byte.class,int.class,int.class},(byte)97,0,0),(own&16)|(other&15));
check("all-effects/"+own+"/"+other,call(tile,effectsTile,"${m('ne','a','(BII)I')}",new Class<?>[]{byte.class,int.class,int.class},(byte)97,-1,-1),own|other);}
Object combatBattle=unsafe.allocateInstance(board);Object combatTiles=Array.newInstance(tile,64);
for(int i=0;i<64;i++)Array.set(combatTiles,i,make(tile,new Class<?>[]{}));
set(board,combatBattle,"${f('ha','v','I')}",8);set(board,combatBattle,"${f('ha','db','I')}",8);set(board,combatBattle,"${f('ha','Eb','[Lne;')}",combatTiles);
set(board,combatBattle,"${f('ha','yb','[I')}",new int[]{0,1});
Object striking=make(unit,new Class<?>[]{int.class,int.class,int.class},1,1,0),receiving=make(unit,new Class<?>[]{int.class,int.class,int.class},2,1,0);
for(Object fighter:new Object[]{striking,receiving}){set(unit,fighter,"${f('jd','l','Lha;')}",combatBattle);set(unit,fighter,"${f('jd','r','I')}",-1);}
set(unit,striking,"${f('jd','O','I')}",0);set(unit,receiving,"${f('jd','O','I')}",1);
// Fixed arithmetic examples specify the complete result without reimplementing prediction.
// attacker type/strength, defender type/strength, distance, attacker/defender status, expected tuple.
// A protected attacking unit resets the counterattack prior-damage input;
// a protected defending unit does not reset that input (the target is different).
int[][] examples={{0,12,0,10,1,0,0,6,2,0},{0,1,0,100,1,0,0,1,49,1},{0,1,0,1,1,0,0,1,0,2},
{0,10,2,10,1,0,0,2,7,0},{2,20,0,10,1,0,0,18,0,2},
{11,30,0,10,1,0,0,0,5,0},{11,30,0,10,2,0,0,0,0,0},{11,30,0,10,3,0,0,27,0,2},{11,30,0,10,6,0,0,0,0,0},
{0,12,0,10,1,7,0,6,5,0},{0,12,0,10,1,0,7,6,2,0},{0,12,1,10,1,0,0,0,0,0},
{0,1000,0,10,1,0,0,255,0,2}};
for(int index=0;index<examples.length;index++){int[] ex=examples[index];
set(unit,striking,"${f('jd','N','I')}",ex[0]);set(unit,striking,"${f('jd','Y','I')}",ex[1]);set(unit,receiving,"${f('jd','N','I')}",ex[2]);set(unit,receiving,"${f('jd','Y','I')}",ex[3]);
set(unit,striking,"${f('jd','P','I')}",ex[5]);set(unit,receiving,"${f('jd','P','I')}",ex[6]);
int[] prediction=(int[])call(board,combatBattle,"${m('ha','a','(Ljd;IBILjd;II)[I')}",new Class<?>[]{unit,int.class,byte.class,int.class,unit,int.class,int.class},receiving,1,(byte)-128,0,striking,ex[4],1);
check("combat-prediction/"+index,Arrays.toString(prediction),Arrays.toString(new int[]{ex[7],ex[8],ex[9]}));}
// Cover percentages, protective masks and original integer truncation.
Object coveredTile=Array.get(combatTiles,10);int[] terrainPercent={100,100,60,80,90,90,100,100,80,70,100,100,90,100,70,90};
set(unit,receiving,"${f('jd','N','I')}",0);set(unit,receiving,"${f('jd','P','I')}",0);
for(int terrainType=0;terrainType<16;terrainType++){set(tile,coveredTile,"${f('ne','h','I')}",terrainType);
check("cover-percent/"+terrainType,call(board,combatBattle,"${m('ha','a','(IILjd;)I')}",new Class<?>[]{int.class,int.class,unit},10,-4,receiving),terrainPercent[terrainType]);}
set(tile,coveredTile,"${f('ne','h','I')}",0);
int[] protectionMasks={0,1,2,4,8,31,16,0,0};
for(int status=0;status<9;status++)for(int mask:new int[]{1,2,4,8,16,32})for(int charges:new int[]{0,1,4}){
set(unit,receiving,"${f('jd','P','I')}",status);set(unit,receiving,"${f('jd','o','I')}",charges);
int percent=100;if((mask&~protectionMasks[status])==0)percent-=charges*10;
check("damage-scale/"+status+"/"+mask+"/"+charges,call(board,combatBattle,"${m('ha','a','(Ljd;BII)I')}",new Class<?>[]{unit,byte.class,int.class,int.class},receiving,(byte)-123,mask,37),percent*37/100);}
Object ownership=make(meta,new Class<?>[]{});set(meta,ownership,"${f('ca','c','I')}",16);set(meta,ownership,"${f('ca','b','I')}",1);set(tile,coveredTile,"${f('ne','n','Lca;')}",ownership);
check("cover-allied-owner",call(board,combatBattle,"${m('ha','a','(IILjd;)I')}",new Class<?>[]{int.class,int.class,unit},10,-4,receiving),60);
set(meta,ownership,"${f('ca','b','I')}",0);set(tile,coveredTile,"${f('ne','h','I')}",3);
check("cover-enemy-owner",call(board,combatBattle,"${m('ha','a','(IILjd;)I')}",new Class<?>[]{int.class,int.class,unit},10,-4,receiving),80);
set(tile,coveredTile,"${f('ne','k','[I')}",new int[]{8,0});
check("cover-negated",call(board,combatBattle,"${m('ha','a','(IILjd;)I')}",new Class<?>[]{int.class,int.class,unit},10,-4,receiving),100);
set(tile,coveredTile,"${f('ne','k','[I')}",null);set(tile,coveredTile,"${f('ne','n','Lca;')}",null);set(tile,coveredTile,"${f('ne','h','I')}",0);
// Structure summoning permissions and local favour are separate mechanisms.
Object permissionBattle=unsafe.allocateInstance(board);Object permissionTiles=Array.newInstance(tile,6);
for(int i=0;i<6;i++)Array.set(permissionTiles,i,make(tile,new Class<?>[]{}));
set(board,permissionBattle,"${f('ha','v','I')}",3);set(board,permissionBattle,"${f('ha','db','I')}",2);set(board,permissionBattle,"${f('ha','Eb','[Lne;')}",permissionTiles);
set(board,permissionBattle,"${f('ha','yb','[I')}",new int[]{0,1,0});set(board,permissionBattle,"${f('ha','E','[[I')}",new int[][]{{1,2,3,4,5,6,7},{7,6,5,4,3,2,1},{0,0,0,0,0,0,0}});
Object portal=Array.get(permissionTiles,4);set(tile,portal,"${f('ne','a','I')}",0);
for(int terrainType:new int[]{0,7,11})for(int ownerPlayer:new int[]{0,1,2})for(boolean occupied:new boolean[]{false,true}){
set(tile,portal,"${f('ne','h','I')}",terrainType);set(tile,portal,"${f('ne','a','I')}",ownerPlayer);set(tile,portal,"${f('ne','c','Ljd;')}",occupied?receiving:null);set(tile,portal,"${f('ne','g','I')}",3);
int expected=occupied||ownerPlayer==1?0:terrainType==7?65535:terrainType==11?8:0;
check("summoning-mask/"+terrainType+"/"+ownerPlayer+"/"+occupied,call(board,permissionBattle,"${m('ha','c','(IIII)I')}",new Class<?>[]{int.class,int.class,int.class,int.class},1,-27300,1,0),expected);}
for(int[] xy:new int[][]{{-1,0},{0,-1},{3,0},{0,2}})check("summoning-bounds/"+Arrays.toString(xy),call(board,permissionBattle,"${m('ha','c','(IIII)I')}",new Class<?>[]{int.class,int.class,int.class,int.class},xy[0],-27300,xy[1],0),0);
set(tile,portal,"${f('ne','c','Ljd;')}",null);set(tile,portal,"${f('ne','a','I')}",0);set(tile,portal,"${f('ne','h','I')}",7);
check("summoning-favour/all",Arrays.toString((int[])call(board,permissionBattle,"${m('ha','a','(IBII)[I')}",new Class<?>[]{int.class,byte.class,int.class,int.class},1,(byte)118,1,0)),"[1, 2, 3, 4, 5, 6, 7]");
set(tile,portal,"${f('ne','h','I')}",11);set(tile,portal,"${f('ne','j','I')}",9);
check("summoning-favour/portal",Arrays.toString((int[])call(board,permissionBattle,"${m('ha','a','(IBII)[I')}",new Class<?>[]{int.class,byte.class,int.class,int.class},1,(byte)118,1,0)),"[0, 0, 0, 9, 0, 0, 0]");
// Sea Slug parasitism permits only sufficiently weak, undeployed targets.
set(unit,striking,"${f('jd','N','I')}",27);set(unit,striking,"${f('jd','Y','I')}",10);set(unit,receiving,"${f('jd','N','I')}",2);set(unit,receiving,"${f('jd','Y','I')}",10);
check("parasite/equal",call(unit,striking,"${m('jd','a','(Ljd;B)Z')}",new Class<?>[]{unit,byte.class},receiving,(byte)119),true);
set(unit,receiving,"${f('jd','Y','I')}",11);check("parasite/stronger",call(unit,striking,"${m('jd','a','(Ljd;B)Z')}",new Class<?>[]{unit,byte.class},receiving,(byte)119),false);
set(unit,receiving,"${f('jd','Y','I')}",1);set(unit,receiving,"${f('jd','W','Z')}",true);check("parasite/deployed",call(unit,striking,"${m('jd','a','(Ljd;B)Z')}",new Class<?>[]{unit,byte.class},receiving,(byte)119),false);
set(unit,receiving,"${f('jd','N','I')}",0);check("parasite/type-zero",call(unit,striking,"${m('jd','a','(Ljd;B)Z')}",new Class<?>[]{unit,byte.class},receiving,(byte)119),true);
// Popup fade animation can be checked independently of assets and font rendering.
Class<?> popup=Class.forName("${className('fi')}");Object popupFixture=unsafe.allocateInstance(popup);set(popup,popupFixture,"${f('fi','m','I')}",32);
Object popupQueue=make(deque,new Class<?>[]{});call(deque,popupQueue,"${m('at','a','(BLtc;)V')}",new Class<?>[]{byte.class,Class.forName("${className('tc')}")},(byte)-119,popupFixture);
for(int frame=1;frame<=8;frame++){call(popup,popupFixture,"${m('fi','a','(BZ)V')}",new Class<?>[]{byte.class,boolean.class},(byte)-110,true);check("popup-show/"+frame,get(popup,popupFixture,"${f('fi','m','I')}"),32-frame*4);}
for(int frame=1;frame<=8;frame++){call(popup,popupFixture,"${m('fi','a','(BZ)V')}",new Class<?>[]{byte.class,boolean.class},(byte)-110,false);check("popup-hide/"+frame,get(popup,popupFixture,"${f('fi','m','I')}"),frame*4);}
check("popup-hidden-unlinked",call(deque,popupQueue,"${m('at','e','(B)Ltc;')}",new Class<?>[]{byte.class},(byte)96)==null,true);
// Survivor queries use the declared player count, not all Java integer bits.
for(int count=1;count<=8;count++)for(int eliminated=0;eliminated<(1<<count);eliminated++){
Object state=unsafe.allocateInstance(board);set(board,state,"${f('ha','W','I')}",count);set(board,state,"${f('ha','e','I')}",eliminated);
int surviving=((1<<count)-1)^eliminated;
check("survivor-mask/"+count+"/"+eliminated,call(board,state,"${m('ha','a','(B)I')}",new Class<?>[]{byte.class},(byte)78),surviving);
check("single-player/"+count+"/"+eliminated,call(board,state,"${m('ha','e','(B)Z')}",new Class<?>[]{byte.class},(byte)-42),Integer.bitCount(surviving)==1);}
Class<?> rosterClass=Class.forName("${className('go')}");Object teamArray=Array.newInstance(rosterClass,2);
Array.set(teamArray,0,make(rosterClass,new Class<?>[]{String.class,int[].class},"a",new int[]{0,2}));Array.set(teamArray,1,make(rosterClass,new Class<?>[]{String.class,int[].class},"b",new int[]{1,3}));
for(int eliminated=0;eliminated<16;eliminated++){Object state=unsafe.allocateInstance(board);set(board,state,"${f('ha','W','I')}",4);set(board,state,"${f('ha','e','I')}",eliminated);set(board,state,"${f('ha','wb','Z')}",true);set(board,state,"${f('ha','w','[Lgo;')}",teamArray);
int remaining=15^eliminated;int teamsLeft=((remaining&5)!=0?1:0)+((remaining&10)!=0?1:0);
check("single-team/"+eliminated,call(board,state,"${m('ha','e','(B)Z')}",new Class<?>[]{byte.class},(byte)-42),teamsLeft==1);}
// Execute the canonical elimination dispatcher with an ordinary non-team fixture.
Object elimination=unsafe.allocateInstance(board),eliminationTiles=Array.newInstance(tile,6);int[] tileOwners={0,1,2,3,0,2},tileTypes={7,11,0,11,9,8};
for(int i=0;i<6;i++){Object cell=make(tile,new Class<?>[]{});set(tile,cell,"${f('ne','a','I')}",tileOwners[i]);set(tile,cell,"${f('ne','h','I')}",tileTypes[i]);Array.set(eliminationTiles,i,cell);}
set(board,elimination,"${f('ha','W','I')}",4);set(board,elimination,"${f('ha','v','I')}",3);set(board,elimination,"${f('ha','db','I')}",2);set(board,elimination,"${f('ha','Eb','[Lne;')}",eliminationTiles);set(board,elimination,"${f('ha','n','[I')}",new int[]{-1,-1,-1,-1});
int[] order={2,0,3,1};int mask=0;for(int index=0;index<order.length;index++){int player=order[index];mask|=1<<player;
call(board,elimination,"${m('ha','b','(IIZ)V')}",new Class<?>[]{int.class,int.class,boolean.class},10001,player,false);
check("eliminated-bits/"+index,get(board,elimination,"${f('ha','e','I')}"),mask);
int[] expectedOrder={-1,-1,-1,-1};System.arraycopy(order,0,expectedOrder,0,index+1);check("elimination-order/"+index,Arrays.toString((int[])get(board,elimination,"${f('ha','n','[I')}")),Arrays.toString(expectedOrder));
for(int i=0;i<6;i++){Object cell=Array.get(eliminationTiles,i);boolean removed=(mask&(1<<tileOwners[i]))!=0;check("elimination-owner/"+index+"/"+i,get(tile,cell,"${f('ne','a','I')}"),removed?-1:tileOwners[i]);check("elimination-terrain/"+index+"/"+i,get(tile,cell,"${f('ne','h','I')}"),removed&&tileTypes[i]==11?0:tileTypes[i]);}}
check("elimination-ranks",Arrays.toString((int[])call(board,elimination,"${m('ha','d','(I)[I')}",new Class<?>[]{int.class},10326)),"[1, 3, 0, 2]");
call(board,elimination,"${m('ha','b','(IIZ)V')}",new Class<?>[]{int.class,int.class,boolean.class},10001,2,false);
check("elimination-repeat",Arrays.toString((int[])get(board,elimination,"${f('ha','n','[I')}")),"[2, 0, 3, 1]");
for(int secondary=0;secondary<16;secondary++){set(board,elimination,"${f('ha','e','I')}",5);set(board,elimination,"${f('ha','u','I')}",secondary);
for(int player=0;player<4;player++)check("inactive/"+secondary+"/"+player,call(board,elimination,"${m('ha','b','(II)Z')}",new Class<?>[]{int.class,int.class},-1,player),((5|secondary)&(1<<player))!=0);}
// Recorded outcomes and per-turn structure income preserve the original numeric rules.
Object recorded=unsafe.allocateInstance(board);int[] ranks={3,1,0,2};
for(int winners:new int[]{0,1,2,4}){call(board,recorded,"${m('ha','a','(IZ[I)V')}",new Class<?>[]{int.class,boolean.class,int[].class},winners,true,ranks);
check("outcome-winners/"+winners,get(board,recorded,"${f('ha','R','I')}"),winners);check("outcome-current/"+winners,get(board,recorded,"${f('ha','gb','I')}"),winners==1?3:-1);check("outcome-ranks/"+winners,get(board,recorded,"${f('ha','p','[I')}")==ranks,true);}
set(board,recorded,"${f('ha','yb','[I')}",new int[]{0,1,0});set(board,recorded,"${f('ha','z','[[I')}",new int[][]{{2,3,4},{1,0,2}});
for(int player=0;player<3;player++)check("structure-income/"+player,call(board,recorded,"${m('ha','k','(II)I')}",new Class<?>[]{int.class,int.class},-100,player),player==1?100:425);
// Concrete match predicates and any-condition registry aggregation.
Class<?> conditionType=Class.forName("${className('lv')}"),registryType=Class.forName("${className('tt')}"),unitLoss=Class.forName("${className('mc')}"),portalLoss=Class.forName("${className('up')}"),escort=Class.forName("${className('gm')}");
Object match=unsafe.allocateInstance(board),matchTiles=Array.newInstance(tile,2),playerLists=Array.newInstance(deque,4);
for(int i=0;i<2;i++)Array.set(matchTiles,i,make(tile,new Class<?>[]{}));for(int i=0;i<4;i++)Array.set(playerLists,i,make(deque,new Class<?>[]{}));
set(board,match,"${f('ha','W','I')}",4);set(board,match,"${f('ha','v','I')}",2);set(board,match,"${f('ha','db','I')}",1);set(board,match,"${f('ha','Eb','[Lne;')}",matchTiles);set(board,match,"${f('ha','t','[Lat;')}",playerLists);set(board,match,"${f('ha','yb','[I')}",new int[]{0,1,0,1});set(board,match,"${f('ha','wb','Z')}",true);
Object unitCondition=make(unitLoss,new Class<?>[]{int.class,board},0,match),portalCondition=make(portalLoss,new Class<?>[]{int.class,board},0,match);
check("unit-loss/empty",call(unitLoss,unitCondition,"${m('mc','c','(I)Z')}",new Class<?>[]{int.class},-128),true);
check("portal-loss/empty",call(portalLoss,portalCondition,"${m('up','c','(I)Z')}",new Class<?>[]{int.class},-128),true);
Object ally=make(unit,new Class<?>[]{int.class,int.class,int.class},0,0,0);set(unit,ally,"${f('jd','O','I')}",2);
call(deque,Array.get(playerLists,2),"${m('at','a','(BLtc;)V')}",new Class<?>[]{byte.class,Class.forName("${className('tc')}")},(byte)-119,ally);
check("unit-loss/allied-unit",call(unitLoss,unitCondition,"${m('mc','c','(I)Z')}",new Class<?>[]{int.class},-128),false);
check("portal-loss/allied-capturer",call(portalLoss,portalCondition,"${m('up','c','(I)Z')}",new Class<?>[]{int.class},-128),false);
Class<?> mission=Class.forName("${className('om')}");Object missionFixture=make(mission,new Class<?>[]{});set(board,match,"${f('ha','K','Lom;')}",missionFixture);
check("unit-loss/campaign",call(unitLoss,unitCondition,"${m('mc','c','(I)Z')}",new Class<?>[]{int.class},-128),true);
check("portal-loss/campaign",call(portalLoss,portalCondition,"${m('up','c','(I)Z')}",new Class<?>[]{int.class},-128),true);set(board,match,"${f('ha','K','Lom;')}",null);
Object ownPortal=Array.get(matchTiles,1);set(tile,ownPortal,"${f('ne','a','I')}",0);set(tile,ownPortal,"${f('ne','h','I')}",7);
check("portal-loss/portal",call(portalLoss,portalCondition,"${m('up','c','(I)Z')}",new Class<?>[]{int.class},-128),false);
Object leaderA=make(unit,new Class<?>[]{int.class,int.class,int.class},0,0,0),leaderB=make(unit,new Class<?>[]{int.class,int.class,int.class},0,0,0);Object leaders=Array.newInstance(unit,2);Array.set(leaders,0,leaderA);Array.set(leaders,1,leaderB);
Object escortCondition=make(escort,new Class<?>[]{int.class,leaders.getClass()},0,leaders),emptyEscort=make(escort,new Class<?>[]{int.class,leaders.getClass()},0,Array.newInstance(unit,0));
check("escort/empty",call(escort,emptyEscort,"${m('gm','b','(I)Z')}",new Class<?>[]{int.class},0),true);
for(int completed=0;completed<4;completed++){set(unit,leaderA,"${f('jd','G','Z')}",(completed&1)!=0);set(unit,leaderB,"${f('jd','G','Z')}",(completed&2)!=0);check("escort/"+completed,call(escort,escortCondition,"${m('gm','b','(I)Z')}",new Class<?>[]{int.class},0),completed==3);}
Object registry=make(registryType,new Class<?>[]{int.class},2);
check("registry/no-victory",call(registryType,registry,"${m('tt','a','(II)Z')}",new Class<?>[]{int.class,int.class},0,-96),false);
for(Object condition:new Object[]{unitCondition,portalCondition,escortCondition})call(registryType,registry,"${m('tt','a','(Llv;BI)V')}",new Class<?>[]{conditionType,byte.class,int.class},condition,(byte)99,0);
check("registry/victory",call(registryType,registry,"${m('tt','a','(II)Z')}",new Class<?>[]{int.class,int.class},0,-96),true);
check("registry/no-defeat",call(registryType,registry,"${m('tt','a','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-96,0),false);
String[] descriptions=(String[])call(registryType,registry,"${m('tt','a','(I)[Ljava/lang/String;')}",new Class<?>[]{int.class},0);
check("registry/descriptions",Arrays.toString(descriptions),"[player [0], Win: Leader Escort, Defeat: Total Portal Loss, Defeat: Total Unit Loss, player [1]]");
Object otherPortalCondition=make(portalLoss,new Class<?>[]{int.class,board},1,match);
call(registryType,registry,"${m('tt','a','(Llv;BI)V')}",new Class<?>[]{conditionType,byte.class,int.class},otherPortalCondition,(byte)99,1);
check("registry/other-defeat",call(registryType,registry,"${m('tt','a','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-96,1),true);
call(registryType,registry,"${m('tt','b','(II)V')}",new Class<?>[]{int.class,int.class},244,0);
check("registry/remove-portal",Arrays.toString((String[])call(registryType,registry,"${m('tt','a','(I)[Ljava/lang/String;')}",new Class<?>[]{int.class},0)),"[player [0], Win: Leader Escort, Defeat: Total Unit Loss, player [1], Defeat: Total Portal Loss]");
check("registry/other-defeat-preserved",call(registryType,registry,"${m('tt','a','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-96,1),true);
call(registryType,registry,"${m('tt','a','(B)V')}",new Class<?>[]{byte.class},(byte)43);
check("registry/global-removal",Arrays.toString((String[])call(registryType,registry,"${m('tt','a','(I)[Ljava/lang/String;')}",new Class<?>[]{int.class},0)),"[player [0], Win: Leader Escort, Defeat: Total Unit Loss, player [1]]");
check("registry/global-no-defeat",call(registryType,registry,"${m('tt','a','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-96,1),false);
check("registry/escort-preserved",call(registryType,registry,"${m('tt','a','(II)Z')}",new Class<?>[]{int.class,int.class},0,-96),true);
// Cached map layouts expose row-major terrain without assets or map generation.
Class<?> layout=Class.forName("${className('lo')}");Object layoutFixture=unsafe.allocateInstance(layout);Object cachedTiles=Array.newInstance(tile,6);
for(int i=0;i<6;i++){Object cell=make(tile,new Class<?>[]{});set(tile,cell,"${f('ne','h','I')}",i+1);Array.set(cachedTiles,i,cell);}
set(layout,layoutFixture,"${f('lo','l','I')}",3);set(layout,layoutFixture,"${f('lo','n','I')}",2);set(layout,layoutFixture,"${f('lo','r','[Lne;')}",cachedTiles);
check("layout/terrain",Arrays.deepToString((int[][])call(layout,layoutFixture,"${m('lo','e','(I)[[I')}",new Class<?>[]{int.class},28554)),"[[1, 2, 3], [4, 5, 6]]");
check("mission/music-default",get(mission,missionFixture,"${f('om','q','I')}"),-1);check("mission/difficulty-default",get(mission,missionFixture,"${f('om','E','I')}"),1);
// Explicit map headers and row-major terrain payloads for three supported paths.
byte[][] mapBytes={{3,2,1,2,3,4,5,6,2},{65,79,71,0,3,2,2,1,2,3,4,5,6},{65,79,71,1,3,2,0,2,1,2,3,4,5,6}};
for(int index=0;index<mapBytes.length;index++){Object parsed=make(layout,new Class<?>[]{int.class,byte[].class},999,mapBytes[index]);
check("layout-header/"+index+"/width",get(layout,parsed,"${f('lo','l','I')}"),3);check("layout-header/"+index+"/height",get(layout,parsed,"${f('lo','n','I')}"),2);
check("layout-header/"+index+"/version",get(layout,parsed,"${f('lo','t','I')}"),index-1);
check("layout-header/"+index+"/terrain",Arrays.deepToString((int[][])call(layout,parsed,"${m('lo','e','(I)[[I')}",new Class<?>[]{int.class},28554)),"[[1, 2, 3], [4, 5, 6]]");}
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
