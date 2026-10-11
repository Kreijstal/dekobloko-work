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
// A deliberately simple bit-by-bit encoder provides independent wire fixtures.
static class Bits {
final ArrayList<Integer> data=new ArrayList<>();
Bits write(int value,int width){for(int bit=width-1;bit>=0;bit--)data.add((value>>>bit)&1);return this;}
Bits append(Bits other){data.addAll(other.data);return this;}
byte[] bytes(){byte[] result=new byte[(data.size()+7)/8];for(int i=0;i<data.size();i++)result[i/8]|=(byte)(data.get(i)<<(7-i%8));return result;}
Bits field(String name,Bits payload){write(name.length()-1,2);for(char c:name.toCharArray()){if(c<16){write(0,1);write(c,4);}else{write(1,1);write(c-16,8);}}
Bits length=compact(payload.data.size());append(length);
// Long fields store their leading header-width payload bits at the end.
if(payload.data.size()>length.data.size()){data.addAll(payload.data.subList(length.data.size(),payload.data.size()));data.addAll(payload.data.subList(0,length.data.size()));}else append(payload);
return this;}
}
static class Surface extends ${className('bi')} {
void ${m('bi','a','(ILjava/awt/Graphics;II)V')}(int guard,java.awt.Graphics graphics,int x,int y){}
void ${m('bi','a','(IILjava/awt/Component;I)V')}(int width,int height,java.awt.Component component,int guard){}
}
static Bits compact(int value){int[] widths={4,14,20,30};int[] offsets={0,8,8200,532488};
for(int tier=0;tier<4;tier++){long minimum=-(1L<<(widths[tier]-1))-offsets[tier],maximum=(1L<<(widths[tier]-1))-1+offsets[tier];
if(value>=minimum&&value<=maximum)return new Bits().write(tier,2).write(value<0?value+offsets[tier]:value-offsets[tier],widths[tier]);}
throw new IllegalArgumentException("Fixture value out of range");}
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
// MSB-first bit reads/writes across every start offset and width through 32 bits.
Class<?> bitsPacket=Class.forName("${className('bv')}");Random bitRandom=new Random(441122);
for(int offset=0;offset<8;offset++)for(int width=0;width<=32;width++){byte[] before=new byte[12];bitRandom.nextBytes(before);byte[] expectedBits=before.clone();int value=bitRandom.nextInt();
for(int bit=0;bit<width;bit++){int index=offset+bit,maskBit=1<<(7-index%8);if(((value>>>(width-1-bit))&1)!=0)expectedBits[index/8]|=(byte)maskBit;else expectedBits[index/8]&=(byte)~maskBit;}
Object out=make(bitsPacket,new Class<?>[]{byte[].class},(Object)before);call(bitsPacket,out,"${m('bv','c','(IB)V')}",new Class<?>[]{int.class,byte.class},offset,(byte)0);
call(bitsPacket,out,"${m('bv','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},-16807,width,value);
String label="bits/"+offset+"/"+width;check(label+"/bytes",Arrays.toString(before),Arrays.toString(expectedBits));
call(bitsPacket,out,"${m('bv','d','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)-83,offset);
int expectedValue=width==32?value:width==0?0:(int)(value&((1L<<width)-1));
check(label+"/read",call(bitsPacket,out,"${m('bv','g','(II)I')}",new Class<?>[]{int.class,int.class},-108,width),expectedValue);
check(label+"/cursor",get(bitsPacket,out,"${f('bv','v','I')}"),offset+width);
call(bitsPacket,out,"${m('bv','n','(I)V')}",new Class<?>[]{int.class},-2);check(label+"/alignment",get(packet,out,"${f('vh','q','I')}"),(offset+width+7)/8);}
// Tier boundaries have independent encodings, including both signed extremes.
Class<?> compactReader=Class.forName("${className('de')}"),compactWriter=Class.forName("${className('ir')}");
int[] values={-537403400,-537403399,-532489,-532488,-532487,-8201,-8200,-8199,-9,-8,-7,-1,0,1,6,7,8,9,8198,8199,8200,8201,532486,532487,532488,532489,537403398,537403399};
for(int offset=0;offset<8;offset++)for(int value:values){Bits encoded=new Bits().write(0,offset).append(compact(value));byte[] reference=Arrays.copyOf(encoded.bytes(),12);
Object read=make(bitsPacket,new Class<?>[]{byte[].class},(Object)reference);call(bitsPacket,read,"${m('bv','d','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)-83,offset);
check("compact/read/"+offset+"/"+value,call(compactReader,null,"${m('de','a','(ILbv;IIII)I')}",new Class<?>[]{int.class,bitsPacket,int.class,int.class,int.class,int.class},-111,read,4,14,30,20),value);
check("compact/cursor/"+offset+"/"+value,get(bitsPacket,read,"${f('bv','v','I')}"),encoded.data.size());
byte[] written=new byte[12];Object write=make(bitsPacket,new Class<?>[]{byte[].class},(Object)written);call(bitsPacket,write,"${m('bv','c','(IB)V')}",new Class<?>[]{int.class,byte.class},offset,(byte)0);
int size=(Integer)call(compactWriter,null,"${m('ir','a','(IIIIIILbv;)I')}",new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class,bitsPacket},14,20,value,30,1,4,write);
check("compact/write/"+offset+"/"+value,Arrays.toString(written),Arrays.toString(reference));check("compact/length/"+offset+"/"+value,size,compact(value).data.size());}
// Unknown and zero-length fields are skipped; relocated headers restore bytes.
Bits unitRecord=new Bits().field("c",compact(0)).field("o",compact(1)).field("str",compact(1000000)).field("max",compact(1500000)).field("x",compact(2)).field("zz",new Bits().write(0x12345678,32).write(5,3)).field("y",compact(1)).field("x",new Bits());
Class<?> unitReader=Class.forName("${className('a')}");
for(int offset=0;offset<8;offset++){Bits wire=new Bits().write(0,offset).append(unitRecord);byte[] payload=wire.bytes(),originalBytes=payload.clone();Object input=make(bitsPacket,new Class<?>[]{byte[].class},(Object)payload);
call(bitsPacket,input,"${m('bv','d','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)-83,offset);
Object decoded=call(unitReader,null,"${m('a','a','(IILbv;)Ljd;')}",new Class<?>[]{int.class,int.class,bitsPacket},unitRecord.data.size(),32,input);
check("tagged-unit/"+offset+"/strength",get(unit,decoded,"${f('jd','Y','I')}"),1000000);check("tagged-unit/"+offset+"/max",get(unit,decoded,"${f('jd','t','I')}"),1500000);
check("tagged-unit/"+offset+"/x",get(unit,decoded,"${f('jd','J','I')}"),2);check("tagged-unit/"+offset+"/y",get(unit,decoded,"${f('jd','w','I')}"),1);
check("tagged-unit/"+offset+"/owner",get(unit,decoded,"${f('jd','O','I')}"),1);
check("tagged-unit/"+offset+"/cursor",get(bitsPacket,input,"${f('bv','v','I')}"),wire.data.size());check("tagged-unit/"+offset+"/restored",Arrays.toString(payload),Arrays.toString(originalBytes));}
Bits tileList=compact(6);for(int i=0;i<6;i++)tileList.field("item",new Bits().field("type",compact(i)).field("own",compact(1)));
Bits mapRecord=new Bits().field("w",compact(3)).field("h",compact(2)).field("nump",compact(2)).field("them",compact(1)).field("map",tileList);
Class<?> taggedMap=Class.forName("${className('sc')}"),mapReader=Class.forName("${className('ut')}");
byte[] mapPayload=mapRecord.bytes(),mapOriginal=mapPayload.clone();Object mapInput=make(bitsPacket,new Class<?>[]{byte[].class},(Object)mapPayload);
Object mapData=call(mapReader,null,"${m('ut','a','(Lbv;BI)Lsc;')}",new Class<?>[]{bitsPacket,byte.class,int.class},mapInput,(byte)-85,mapRecord.data.size());
check("tagged-map/width",get(taggedMap,mapData,"${f('sc','k','I')}"),3);check("tagged-map/height",get(taggedMap,mapData,"${f('sc','e','I')}"),2);check("tagged-map/players",get(taggedMap,mapData,"${f('sc','j','I')}"),2);check("tagged-map/theme",get(taggedMap,mapData,"${f('sc','a','I')}"),1);
Object taggedTiles=get(taggedMap,mapData,"${f('sc','c','[Lne;')}");check("tagged-map/tile-count",Array.getLength(taggedTiles),6);
for(int i=0;i<6;i++){check("tagged-map/terrain/"+i,get(tile,Array.get(taggedTiles,i),"${f('ne','h','I')}"),i);check("tagged-map/owner/"+i,get(tile,Array.get(taggedTiles,i),"${f('ne','a','I')}"),1);}
check("tagged-map/restored",Arrays.toString(mapPayload),Arrays.toString(mapOriginal));check("tagged-map/cursor",get(bitsPacket,mapInput,"${f('bv','v','I')}"),mapRecord.data.size());
Bits layoutBytes=new Bits().write(65,8).write(79,8).write(71,8).write(2,8).write(mapRecord.data.size(),32).append(mapRecord);
Object v2Layout=make(layout,new Class<?>[]{int.class,byte[].class},999,layoutBytes.bytes());
check("layout-header/2/version",get(layout,v2Layout,"${f('lo','t','I')}"),2);
check("layout-header/2/terrain",Arrays.deepToString((int[][])call(layout,v2Layout,"${m('lo','e','(I)[[I')}",new Class<?>[]{int.class},28554)),"[[0, 1, 2], [3, 4, 5]]");
// Opcode cipher consumes the same ISAAC stream in each direction across blocks.
for(int[] seed:new int[][]{{},{1,2,3,4},{-1,Integer.MIN_VALUE,0,Integer.MAX_VALUE}}){byte[] opcodes=new byte[300];Object encode=make(bitsPacket,new Class<?>[]{byte[].class},(Object)opcodes);
call(bitsPacket,encode,"${m('bv','a','([II)V')}",new Class<?>[]{int[].class,int.class},seed,-100);
for(int i=0;i<300;i++)call(bitsPacket,encode,"${m('bv','h','(II)V')}",new Class<?>[]{int.class,int.class},32161,(i*37)&255);
System.out.println("cipher-bytes/"+Arrays.toString(seed)+":"+Arrays.toString(opcodes));
Object decode=make(bitsPacket,new Class<?>[]{byte[].class},(Object)opcodes);call(bitsPacket,decode,"${m('bv','a','([II)V')}",new Class<?>[]{int[].class,int.class},seed,-100);
for(int i=0;i<300;i++)check("cipher/"+Arrays.toString(seed)+"/"+i,call(bitsPacket,decode,"${m('bv','m','(I)I')}",new Class<?>[]{int.class},255),(i*37)&255);}
// Fixed combat packet layout: ten bytes, signed deltas, death and animation flags.
Class<?> parasiteEvent=Class.forName("${className('md')}");Object packetBattle=unsafe.allocateInstance(board),packetQueue=make(deque,new Class<?>[]{});set(board,packetBattle,"${f('ha','l','Lat;')}",packetQueue);
for(int combatFlags=0;combatFlags<8;combatFlags++)for(int animation:new int[]{0,7,8,15,112,127,128,255})for(int dx:new int[]{-128,-1,0,127}){
byte[] combatBytes={(byte)(96|combatFlags),27,31,12,(byte)dx,(byte)-1,13,17,(byte)animation,77};Object in=make(packet,new Class<?>[]{byte[].class},(Object)combatBytes);
call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},in,(byte)-100);
Object payload=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);String label="combat-wire/"+combatFlags+"/"+animation+"/"+dx;
check(label+"/cursor",get(packet,in,"${f('vh','q','I')}"),10);
if((combatFlags&4)!=0){check(label+"/parasite",parasiteEvent.isInstance(payload),true);
String[] names={"${f('md','D','I')}","${f('md','B','I')}","${f('md','E','I')}","${f('md','z','I')}","${f('md','C','I')}"};int[] expected={31,12,31+dx,11,13};for(int i=0;i<names.length;i++)check(label+"/parasite-field/"+i,get(parasiteEvent,payload,names[i]),expected[i]);}
else{check(label+"/combat",combat.isInstance(payload),true);
String[] names={"${f('ag','z','I')}","${f('ag','Q','I')}","${f('ag','G','I')}","${f('ag','F','I')}","${f('ag','B','I')}","${f('ag','K','I')}","${f('ag','R','I')}","${f('ag','H','I')}","${f('ag','y','I')}","${f('ag','D','I')}"};int[] expected={27,31,12,dx,-1,13,17,animation&7,(animation&127)>>4,77};
for(int i=0;i<names.length;i++)check(label+"/combat-field/"+i,get(combat,payload,names[i]),expected[i]);
check(label+"/attacker-death",get(combat,payload,"${f('ag','N','Z')}"),(combatFlags&1)!=0);check(label+"/defender-death",get(combat,payload,"${f('ag','M','Z')}"),(combatFlags&2)!=0);
check(label+"/attacker-deployed",get(combat,payload,"${f('ag','J','Z')}"),(animation&8)!=0);check(label+"/defender-deployed",get(combat,payload,"${f('ag','E','Z')}"),(animation&128)!=0);}
check(label+"/single-event",call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);}
// Exercise the actual dispatcher, including cursor ownership and concatenated
// messages. Movement directions are packed from the least-significant pair.
Class<?> wireEventClass=Class.forName("${className('oj')}"),wireMoveClass=Class.forName("${className('kr')}"),summonEvent=Class.forName("${className('mb')}"),stateEvent=Class.forName("${className('qq')}");
for(int steps:new int[]{0,1,2,3,4,5,7,8,9,15,16,31,32,255,256,8191}){
byte[] wire=new byte[4+(steps+3)/4];wire[0]=(byte)(steps>>>8);wire[1]=(byte)steps;wire[2]=(byte)255;wire[3]=7;int[] expectedDirections=new int[steps];
for(int i=0;i<steps;i++){expectedDirections[i]=(i*7+2)%4;wire[4+i/4]|=(byte)(expectedDirections[i]<<(2*(i%4)));}
Object input=make(packet,new Class<?>[]{byte[].class},(Object)wire);
call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},input,(byte)-100);
Object decoded=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);
check("move-wire/"+steps+"/class",wireMoveClass.isInstance(decoded),true);check("move-wire/"+steps+"/x",get(wireMoveClass,decoded,"${f('kr','H','I')}"),255);check("move-wire/"+steps+"/y",get(wireMoveClass,decoded,"${f('kr','I','I')}"),7);
check("move-wire/"+steps+"/directions",Arrays.toString((int[])get(wireMoveClass,decoded,"${f('kr','B','[I')}")),Arrays.toString(expectedDirections));check("move-wire/"+steps+"/cursor",get(packet,input,"${f('vh','q','I')}"),wire.length);
check("move-wire/"+steps+"/queue",call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);
}
for(int owner=0;owner<8;owner++)for(int bonus=-16;bonus<=15;bonus++){
byte[] wire={32,20,(byte)((owner<<5)|(bonus&31)),(byte)255,11};Object input=make(packet,new Class<?>[]{byte[].class},(Object)wire);
call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},input,(byte)-100);Object decoded=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);String label="summon-wire/"+owner+"/"+bonus;
check(label+"/class",summonEvent.isInstance(decoded),true);check(label+"/type",get(summonEvent,decoded,"${f('mb','A','I')}"),20);check(label+"/owner",get(summonEvent,decoded,"${f('mb','D','I')}"),owner);check(label+"/bonus",get(summonEvent,decoded,"${f('mb','I','I')}"),bonus);check(label+"/x",get(summonEvent,decoded,"${f('mb','z','I')}"),255);check(label+"/y",get(summonEvent,decoded,"${f('mb','H','I')}"),11);check(label+"/cursor",get(packet,input,"${f('vh','q','I')}"),5);
}
for(int effect=0;effect<4;effect++)for(int owner=0;owner<8;owner++){
byte[] wire={(byte)(160|(effect<<3)|owner),9,(byte)255};Object input=make(packet,new Class<?>[]{byte[].class},(Object)wire);
call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},input,(byte)-100);Object decoded=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);String label="state-wire/"+effect+"/"+owner;
check(label+"/class",stateEvent.isInstance(decoded),true);check(label+"/effect",get(stateEvent,decoded,"${f('qq','F','I')}"),effect);check(label+"/owner",get(stateEvent,decoded,"${f('qq','G','I')}"),owner);check(label+"/x",get(stateEvent,decoded,"${f('qq','I','I')}"),9);check(label+"/y",get(stateEvent,decoded,"${f('qq','J','I')}"),255);check(label+"/kind",get(wireEventClass,decoded,"${f('oj','m','I')}"),new int[]{3,16,12,14}[effect]);check(label+"/cursor",get(packet,input,"${f('vh','q','I')}"),3);
}
for(int header:new int[]{64,128,224}){Object input=make(packet,new Class<?>[]{byte[].class},(Object)new byte[]{(byte)header});call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},input,(byte)-100);check("unknown-category/"+header+"/cursor",get(packet,input,"${f('vh','q','I')}"),0);check("unknown-category/"+header+"/queue",call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0)==null,true);}
Class<?> telepop=Class.forName("${className('q')}"),death=Class.forName("${className('hp')}"),deploy=Class.forName("${className('tr')}"),wireGrowthClass=Class.forName("${className('kf')}"),dragon=Class.forName("${className('rl')}"),mana=Class.forName("${className('vp')}"),teleport=Class.forName("${className('ec')}");
int[] specialKinds={1,2,7,8,11,13,14,15,17,0,3,31};int[] specialLengths={3,3,3,4,5,2,2,7,5,3,3,3};Class<?>[] specialClasses={telepop,death,deploy,deploy,teleport,dragon,mana,wireGrowthClass,teleport,null,null,null};
set(board,packetBattle,"${f('ha','sb','I')}",3);
for(int i=0;i<specialKinds.length;i++){
byte[] wire={(byte)(192|specialKinds[i]),23,17,(byte)129,(byte)255,7,4};Object input=make(packet,new Class<?>[]{byte[].class},(Object)wire);
call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},input,(byte)-100);Object decoded=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);String label="special-wire/"+specialKinds[i];
check(label+"/cursor",get(packet,input,"${f('vh','q','I')}"),specialLengths[i]);check(label+"/class",specialClasses[i]==null?decoded==null:specialClasses[i].isInstance(decoded),true);
if(i==0||i==1){Class<?> c=i==0?telepop:death;String x=i==0?"${f('q','z','I')}":"${f('hp','y','I')}",y=i==0?"${f('q','E','I')}":"${f('hp','D','I')}";check(label+"/x",get(c,decoded,x),23);check(label+"/y",get(c,decoded,y),17);}
if(i==2||i==3){check(label+"/x",get(deploy,decoded,"${f('tr','E','I')}"),23);check(label+"/y",get(deploy,decoded,"${f('tr','D','I')}"),17);check(label+"/modifiers",get(deploy,decoded,"${f('tr','B','I')}"),i==2?0:129);}
if(i==4||i==8){check(label+"/x",get(teleport,decoded,"${f('ec','A','I')}"),23);check(label+"/y",get(teleport,decoded,"${f('ec','B','I')}"),17);check(label+"/dx",get(teleport,decoded,"${f('ec','z','I')}"),-127);check(label+"/dy",get(teleport,decoded,"${f('ec','y','I')}"),-1);check(label+"/skip-placement",get(teleport,decoded,"${f('ec','D','Z')}"),i==4);}
if(i==5)check(label+"/owner",get(dragon,decoded,"${f('rl','B','I')}"),23);
if(i==6){check(label+"/mana",get(mana,decoded,"${f('vp','E','I')}"),23);check(label+"/owner",get(mana,decoded,"${f('vp','C','I')}"),3);}
if(i==7){String[] names={"${f('kf','H','I')}","${f('kf','F','I')}","${f('kf','z','I')}","${f('kf','J','I')}","${f('kf','y','I')}","${f('kf','C','I')}"};int[] expected={23,17,7,129,255,4};for(int j=0;j<names.length;j++)check(label+"/field/"+j,get(wireGrowthClass,decoded,names[j]),expected[j]);}
}
byte[] combined={0,1,2,3,2,32,20,31,7,8,(byte)194,4,5};Object stream=make(packet,new Class<?>[]{byte[].class},(Object)combined);Class<?>[] eventOrder={wireMoveClass,summonEvent,death};int[] cursors={5,10,13};
for(int i=0;i<eventOrder.length;i++){call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},stream,(byte)-100);Object decoded=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);check("event-stream/"+i+"/class",eventOrder[i].isInstance(decoded),true);check("event-stream/"+i+"/cursor",get(packet,stream,"${f('vh','q','I')}"),cursors[i]);}
Object chunkBattle=unsafe.allocateInstance(board);byte[][] chunks={{0,6,10,20},{30,40,50,60},{}};int appended=0;
for(int i=0;i<chunks.length;i++){Object input=make(packet,new Class<?>[]{byte[].class},(Object)chunks[i]);call(board,chunkBattle,"${m('ha','a','(ILvh;B)V')}",new Class<?>[]{int.class,packet,byte.class},chunks[i].length,input,(byte)-100);Object accumulated=get(board,chunkBattle,"${f('ha','Z','Lvh;')}");appended+=i==0?chunks[i].length-2:chunks[i].length;check("snapshot-chunk/"+i+"/source-cursor",get(packet,input,"${f('vh','q','I')}"),chunks[i].length);check("snapshot-chunk/"+i+"/cursor",get(packet,accumulated,"${f('vh','q','I')}"),appended);check("snapshot-chunk/"+i+"/bytes",Arrays.toString((byte[])get(packet,accumulated,"${f('vh','o','[B')}")),i==0?"[10, 20, 0, 0, 0, 0]":"[10, 20, 30, 40, 50, 60]");}
// Stored-unit bytes explicitly distinguish detached placement from the flag
// used when a live unit is removed. Version 1 adds independent tag/objective bits.
for(int version:new int[]{0,1})for(int optionalFlags=0;optionalFlags<4;optionalFlags++)for(int strength:new int[]{-128,-1,0,127}){
Bits record=new Bits().write((3<<5)|5,8).write(0x31f,16).write(99,8).write(strength,8).write(0x42,8).write(6,8).write(255,8).write(7,8).write(4,8).write(0,8).write(65,8).write(0,8);
if(version>0){record.write(optionalFlags,8);if((optionalFlags&2)!=0)record.write(17,8);if((optionalFlags&1)!=0)record.write(19,8);}
Object input=make(packet,new Class<?>[]{byte[].class},(Object)record.bytes());Object stored=call(summonEvent,null,"${m('mb','a','(IIIILvh;Lha;IZ)Ljd;')}",new Class<?>[]{int.class,int.class,int.class,int.class,packet,board,int.class,boolean.class},20,version,2,1,input,packetBattle,-102,true);
String label="stored-unit/"+version+"/"+optionalFlags+"/"+strength;String[] names={"${f('jd','O','I')}","${f('jd','t','I')}","${f('jd','Y','I')}","${f('jd','A','I')}","${f('jd','P','I')}","${f('jd','o','I')}","${f('jd','ab','I')}","${f('jd','r','I')}","${f('jd','cb','I')}","${f('jd','J','I')}","${f('jd','w','I')}","${f('jd','E','I')}","${f('jd','H','I')}"};int[] expected={3,99,strength,5,2,4,6,-1,7,1,2,version>0&&(optionalFlags&2)!=0?17:0,version>0&&(optionalFlags&1)!=0?19:0};
for(int j=0;j<names.length;j++)check(label+"/field/"+j,get(unit,stored,names[j]),expected[j]);check(label+"/name",get(unit,stored,"${f('jd','K','Ljava/lang/String;')}"),"A");check(label+"/removed",get(unit,stored,"${f('jd','S','Z')}"),false);check(label+"/cursor",get(packet,input,"${f('vh','q','I')}"),record.bytes().length);
}
// Known global, target-unit and action-targeted spell IDs with no acting unit.
Class<?> spellFactory=Class.forName("${className('bo')}"),unitSpell=Class.forName("${className('wa')}"),wireGlobalSpellClass=Class.forName("${className('al')}");int[] spellIds={0,7,25,34};boolean[] targeted={true,false,true,false};
for(int i=0;i<spellIds.length;i++){int id=spellIds[i];Object input=make(packet,new Class<?>[]{byte[].class},(Object)new byte[]{(byte)(id>>>8),(byte)id,127,(byte)255});Object decoded=call(spellFactory,null,"${m('bo','a','(ILvh;I)Lik;')}",new Class<?>[]{int.class,packet,int.class},-1,input,4368051);check("spell-wire/"+id+"/class",(targeted[i]?unitSpell:wireGlobalSpellClass).isInstance(decoded),true);check("spell-wire/"+id+"/id",get(Class.forName("${className('ik')}"),decoded,"${f('ik','c','I')}"),id);check("spell-wire/"+id+"/cursor",get(packet,input,"${f('vh','q','I')}"),targeted[i]?4:2);if(targeted[i]){check("spell-wire/"+id+"/x",get(unitSpell,decoded,"${f('wa','g','I')}"),127);check("spell-wire/"+id+"/y",get(unitSpell,decoded,"${f('wa','f','I')}"),255);}}
Object actionInput=make(packet,new Class<?>[]{byte[].class},(Object)new byte[]{0,34,0,0,5,7,(byte)255,127});Object wrappedSpell=call(spellFactory,null,"${m('bo','a','(ILvh;I)Lik;')}",new Class<?>[]{int.class,packet,int.class},0,actionInput,4368051);Class<?> wrappedSpellClass=Class.forName("${className('ra')}");
check("spell-wire/action/class",wrappedSpellClass.isInstance(wrappedSpell),true);check("spell-wire/action/request",Class.forName("${className('am')}").isInstance(get(wrappedSpellClass,wrappedSpell,"${f('ra','g','Lmn;')}")),true);check("spell-wire/action/cursor",get(packet,actionInput,"${f('vh','q','I')}"),8);
// Preserve the raw decompiled subtype-5 continuation: after queuing its spell
// event it also consumes two coordinate bytes. This is not a server assertion.
Object specialSpellInput=make(packet,new Class<?>[]{byte[].class},(Object)new byte[]{(byte)197,31,0,7,(byte)254,(byte)253});call(board,packetBattle,"${m('ha','a','(Lvh;B)V')}",new Class<?>[]{packet,byte.class},specialSpellInput,(byte)-100);Object specialSpellEvent=call(deque,packetQueue,"${m('at','a','(I)Ltc;')}",new Class<?>[]{int.class},0);Class<?> castEventClass=Class.forName("${className('pj')}");
check("special-spell/class",castEventClass.isInstance(specialSpellEvent),true);check("special-spell/player",get(castEventClass,specialSpellEvent,"${f('pj','z','I')}"),1);check("special-spell/mode",get(castEventClass,specialSpellEvent,"${f('pj','y','I')}"),-1);check("special-spell/cursor",get(packet,specialSpellInput,"${f('vh','q','I')}"),6);
// A real abstract-surface subclass supplies dimensions without rendering.
Class<?> layoutTable=Class.forName("${className('bo')}"),surface=Class.forName("${className('bi')}");Surface frame=new Surface();set(Class.forName("${className('so')}"),null,"${f('so','b','Lbi;')}",frame);Object layoutState=make(layoutTable,new Class<?>[]{});
for(int[] size:new int[][]{{640,480},{641,481},{639,479},{800,600},{320,240}}){set(surface,frame,"${f('bi','a','I')}",size[0]);set(surface,frame,"${f('bi','g','I')}",size[1]);
for(int stage=0;stage<29;stage++){int left=stage*3,right=left+100,top=stage*2,bottom=top+50,spacing=stage+1,dx=(size[0]-640)>>1,dy=(size[1]-480)>>1;
call(layoutTable,layoutState,"${m('bo','a','(IIBIIII)V')}",new Class<?>[]{int.class,int.class,byte.class,int.class,int.class,int.class,int.class},right,bottom,(byte)18,top,left,spacing,stage);String label="tutorial-layout/"+size[0]+"/"+size[1]+"/"+stage;
check(label+"/right",call(layoutTable,layoutState,"${m('bo','a','(BI)I')}",new Class<?>[]{byte.class,int.class},(byte)-125,stage),right+dx);check(label+"/left",call(layoutTable,layoutState,"${m('bo','b','(II)I')}",new Class<?>[]{int.class,int.class},stage,29),left+dx);check(label+"/top",call(layoutTable,layoutState,"${m('bo','a','(IB)I')}",new Class<?>[]{int.class,byte.class},stage,(byte)-108),top+dy);check(label+"/bottom",call(layoutTable,layoutState,"${m('bo','a','(II)I')}",new Class<?>[]{int.class,int.class},-6,stage),bottom+dy);check(label+"/spacing",call(layoutTable,layoutState,"${m('bo','b','(IB)I')}",new Class<?>[]{int.class,byte.class},stage,(byte)-55),spacing);
call(layoutTable,layoutState,"${m('bo','b','(III)V')}",new Class<?>[]{int.class,int.class,int.class},0,321,stage);call(layoutTable,layoutState,"${m('bo','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},-1,400,stage);call(layoutTable,layoutState,"${m('bo','a','(IIB)V')}",new Class<?>[]{int.class,int.class,byte.class},222,stage,(byte)119);
check(label+"/set-right",call(layoutTable,layoutState,"${m('bo','a','(BI)I')}",new Class<?>[]{byte.class,int.class},(byte)-125,stage),321);check(label+"/set-left",call(layoutTable,layoutState,"${m('bo','b','(II)I')}",new Class<?>[]{int.class,int.class},stage,29),400);check(label+"/set-top",call(layoutTable,layoutState,"${m('bo','a','(IB)I')}",new Class<?>[]{int.class,byte.class},stage,(byte)-108),222);
}}
Class<?> tutorial=Class.forName("${className('ci')}");Object tutorialState=unsafe.allocateInstance(tutorial);
set(surface,frame,"${f('bi','a','I')}",640);set(surface,frame,"${f('bi','g','I')}",480);set(wireMoveClass,null,"${f('kr','D','Lbo;')}",layoutState);
for(int stage:new int[]{0,1,2,4}){set(tutorial,tutorialState,"${f('ci','a','I')}",stage);call(layoutTable,layoutState,"${m('bo','a','(IIBIIII)V')}",new Class<?>[]{int.class,int.class,byte.class,int.class,int.class,int.class,int.class},460,400,(byte)18,20,180,30,stage);
for(int item=0;item<4;item++){String label="tutorial-items/"+stage+"/"+item;check(label+"/left",call(tutorial,tutorialState,"${m('ci','a','(ZI)I')}",new Class<?>[]{boolean.class,int.class},true,item),180);check(label+"/right",call(tutorial,tutorialState,"${m('ci','a','(II)I')}",new Class<?>[]{int.class,int.class},item,-3858),460);check(label+"/top",call(tutorial,tutorialState,"${m('ci','a','(IZ)I')}",new Class<?>[]{int.class,boolean.class},item,true),20+item*30+(stage==0?5:0));check(label+"/height",call(tutorial,tutorialState,"${m('ci','d','(II)I')}",new Class<?>[]{int.class,int.class},12,item),30);}}
set(tutorial,tutorialState,"${f('ci','a','I')}",16);check("tutorial-items/16/height",call(tutorial,tutorialState,"${m('ci','d','(II)I')}",new Class<?>[]{int.class,int.class},12,0),20);
Class<?> selection=Class.forName("${className('dl')}"),keys=Class.forName("${className('rs')}");
for(int count:new int[]{1,2,5})for(int start=-1;start<count;start++)for(int key:new int[]{0,96,97,98,99,83,84,102,103})for(int button:new int[]{0,1}){
Object state=make(selection,new Class<?>[]{int.class},count);set(selection,state,"${f('dl','h','I')}",start);set(selection,state,"${f('dl','f','I')}",button);set(keys,null,"${f('rs','q','I')}",key);
call(selection,state,"${m('dl','b','(B)V')}",new Class<?>[]{byte.class},(byte)-120);int expected=start;if(button==0&&key==98)expected=start<=0?count-1:start-1;if(button==0&&key==99)expected=start+1>=count?0:start+1;
String label="ui-navigation/"+count+"/"+start+"/"+key+"/"+button;check(label+"/index",get(selection,state,"${f('dl','h','I')}"),expected);check(label+"/key",get(selection,state,"${f('dl','j','I')}"),button==0?key:0);check(label+"/pressed",call(selection,state,"${m('dl','a','(Z)Z')}",new Class<?>[]{boolean.class},false),button!=0);check(label+"/activation",call(selection,state,"${m('dl','d','(B)Z')}",new Class<?>[]{byte.class},(byte)40),button==0&&(key==83||key==84));
call(selection,state,"${m('dl','a','(IZ)V')}",new Class<?>[]{int.class,boolean.class},0,false);check(label+"/select",get(selection,state,"${f('dl','h','I')}"),button==0?0:expected);
}
for(boolean pointerDriven:new boolean[]{false,true})for(int button:new int[]{0,1,2}){Object state=make(selection,new Class<?>[]{int.class},5);call(selection,state,"${m('dl','a','(IZII)V')}",new Class<?>[]{int.class,boolean.class,int.class,int.class},1,pointerDriven,3,button);String label="ui-restore/"+pointerDriven+"/"+button;check(label+"/index",get(selection,state,"${f('dl','h','I')}"),pointerDriven?3:1);check(label+"/pointer",get(selection,state,"${f('dl','b','Z')}"),pointerDriven);check(label+"/button",get(selection,state,"${f('dl','f','I')}"),button);}
for(int start:new int[]{-1,0,4})for(int key:new int[]{0,96,97,98,99}){Object state=make(selection,new Class<?>[]{int.class},5);set(selection,state,"${f('dl','h','I')}",start);set(keys,null,"${f('rs','q','I')}",key);call(selection,state,"${m('dl','a','(IB)V')}",new Class<?>[]{int.class,byte.class},2,(byte)-30);int expected=start;if(key==96)expected=start<=0?4:start-1;if(key==97)expected=start+1>=5?0:start+1;if((key==98||key==99)&&start<0)expected=2;String label="ui-fallback/"+start+"/"+key;check(label+"/index",get(selection,state,"${f('dl','h','I')}"),expected);check(label+"/decrement",call(selection,state,"${m('dl','a','(B)Z')}",new Class<?>[]{byte.class},(byte)-100),key==96);check(label+"/increment",call(selection,state,"${m('dl','a','(I)Z')}",new Class<?>[]{int.class},-98),key==97);}
Object pointerState=make(selection,new Class<?>[]{int.class},5);Class<?> pointerInput=Class.forName("${className('tr')}"),heldInput=Class.forName("${className('ro')}");set(pointerInput,null,"${f('tr','A','I')}",1);set(heldInput,null,"${f('ro','ub','I')}",1);set(Class.forName("${className('eu')}"),null,"${f('eu','a','I')}",3);set(wireEventClass,null,"${f('oj','k','I')}",2);set(Class.forName("${className('lk')}"),null,"${f('lk','f','Z')}",true);
call(selection,pointerState,"${m('dl','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},0,2,3);check("ui-pointer/press/index",get(selection,pointerState,"${f('dl','h','I')}"),2);check("ui-pointer/press/button",get(selection,pointerState,"${f('dl','f','I')}"),1);check("ui-pointer/press/activation",call(selection,pointerState,"${m('dl','d','(B)Z')}",new Class<?>[]{byte.class},(byte)40),true);check("ui-pointer/press/repeat",get(selection,pointerState,"${f('dl','g','I')}"),2);
call(selection,pointerState,"${m('dl','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},1,2,3);check("ui-pointer/held/activation",call(selection,pointerState,"${m('dl','d','(B)Z')}",new Class<?>[]{byte.class},(byte)40),false);check("ui-pointer/held/repeat",get(selection,pointerState,"${f('dl','g','I')}"),1);
set(pointerInput,null,"${f('tr','A','I')}",0);set(heldInput,null,"${f('ro','ub','I')}",0);call(selection,pointerState,"${m('dl','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},0,2,3);check("ui-pointer/release/index",get(selection,pointerState,"${f('dl','h','I')}"),3);check("ui-pointer/release/button",get(selection,pointerState,"${f('dl','f','I')}"),0);
call(selection,pointerState,"${m('dl','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},0,2,-1);check("ui-pointer/leave/index",get(selection,pointerState,"${f('dl','h','I')}"),-1);
try{call(selection,pointerState,"${m('dl','a','(III)V')}",new Class<?>[]{int.class,int.class,int.class},0,5,0);throw new AssertionError("Out-of-range pointer index accepted");}catch(java.lang.reflect.InvocationTargetException failure){check("ui-pointer/index-bound",failure.getCause() instanceof IllegalArgumentException,true);}
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
