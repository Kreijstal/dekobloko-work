import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {archivedInput,funorbRepository,workflowRoot} from '../game-export.mjs';
import {buildCompilationStubs} from '../compilation-stubs.mjs';
export function verifyBrickCore(input,named,mapping,classpath,temporary){
const aliases=new Map(mapping.rules.map(r=>[r.symbol,r.to])),symbols=new Set(mapping.symbols.map(s=>s.symbol)),outputs=[];
for(const readable of [false,true]){
const className=o=>readable?aliases.get('C:'+o)||o:o;
const member=(kind,o,n,d)=>{const key=kind+':'+o+'.'+(kind==='F'?'field_':'')+n+(kind==='F'?':':'')+d;assert.ok(symbols.has(key),'Missing probe identity: '+key);return readable?aliases.get(key)||((kind==='F'?'field_':'')+n):(kind==='F'?'field_':'')+n;};const f=(o,n,d)=>member('F',o,n,d),m=(o,n,d)=>member('M',o,n,d);
const dir=path.join(temporary,readable?'named-core':'raw-core'),compiled=path.join(dir,'classes'),shims=path.join(dir,'shims');fs.mkdirSync(compiled,{recursive:true});fs.mkdirSync(shims);
const shim=path.join(dir,'BrickABrac.java');fs.writeFileSync(shim,`public final class BrickABrac extends java.applet.Applet {public static boolean ${f('BrickABrac','J','Z')}=false;}`);captureProcess('javac',['--release','8','-d',shims,shim]);
const harness=path.join(dir,'BrickCoreProbe.java');fs.writeFileSync(harness,`import java.lang.reflect.*;import java.util.*;import sun.misc.Unsafe;
public class BrickCoreProbe{
static int checks;static java.security.MessageDigest trace;static Unsafe unsafe;
static Field field(Class<?> c,String n)throws Exception{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}static Object get(Class<?> c,Object o,String n)throws Exception{return field(c,n).get(o);}static void set(Class<?> c,Object o,String n,Object v)throws Exception{field(c,n).set(o,v);}static Object make(Class<?> c,Class<?>[] types,Object...args)throws Exception{Constructor<?> ctor=c.getDeclaredConstructor(types);ctor.setAccessible(true);return ctor.newInstance(args);}static Object call(Class<?> c,Object o,String n,Class<?>[] types,Object...args)throws Exception{Method m=c.getDeclaredMethod(n,types);m.setAccessible(true);return m.invoke(o,args);}static void check(String n,Object actual,Object expected){if(!Objects.equals(actual,expected))throw new AssertionError(n+": "+actual+" != "+expected);checks++;trace.update((n+":"+actual+"\\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));}
static final class BodyProbe extends ${className('vi')}{BodyProbe(int x,int y,int vx,int vy,int type){super(x,y,vx,vy,type);}}
static int bodyChecksum(int x,int y,int vx,int vy,int type,int state){int header=((11*state+666)<<23)|((3*(type+5))<<7);int position=((y*17+10855845)<<3)^(x*31+15790320);int velocity=(58339+11*vx)|((29*vy)<<13);return header^(position+velocity);}
static void rejected(String name,Class<?> owner,Object value,String method,Class<?>[] types,String message,Object...args)throws Exception{
 try{call(owner,value,method,types,args);throw new AssertionError(name+": read accepted");}
 catch(InvocationTargetException failure){check(name+"/type",failure.getCause().getClass()==RuntimeException.class,true);check(name+"/message",failure.getCause().getMessage(),message);}
}
static void verifyHistories()throws Exception{
 Class<?> ints=Class.forName("${className('hp')}"),objects=Class.forName("${className('ao')}");
 for(int capacity:new int[]{1,2,7,50}){
  Object numbers=make(ints,new Class<?>[]{int.class},capacity),references=make(objects,new Class<?>[]{int.class},capacity);
  ArrayList<Integer> numericModel=new ArrayList<>();ArrayList<Object> objectModel=new ArrayList<>();
  check("history/"+capacity+"/int/empty",get(ints,numbers,"${f('hp','j','I')}"),-1);
  check("history/"+capacity+"/object/empty",get(objects,references,"${f('ao','n','I')}"),-1);
  rejected("history/"+capacity+"/int/empty-future",ints,numbers,"${m('hp','b','(II)I')}",new Class<?>[]{int.class,int.class},"State in future -1 0",0,1);
  rejected("history/"+capacity+"/object/empty-future",objects,references,"${m('ao','a','(II)Ljava/lang/Object;')}",new Class<?>[]{int.class,int.class},"State in future -1 0",0,67);
  for(int latest=0;latest<capacity*4+3;latest++){
   int number=latest%3==0?Integer.MIN_VALUE:latest%3==1?Integer.MAX_VALUE:latest*-173;
   Object reference=latest%3==0?null:new int[]{latest};numericModel.add(number);objectModel.add(reference);
   call(ints,numbers,"${m('hp','a','(II)V')}",new Class<?>[]{int.class,int.class},-7255,number);
   call(objects,references,"${m('ao','a','(Ljava/lang/Object;B)V')}",new Class<?>[]{Object.class,byte.class},reference,(byte)-39);
   check("history/"+capacity+"/"+latest+"/int-index",get(ints,numbers,"${f('hp','j','I')}"),latest);
   check("history/"+capacity+"/"+latest+"/object-index",get(objects,references,"${f('ao','n','I')}"),latest);
   for(int index=Math.max(0,latest-capacity+1);index<=latest;index++){
    check("history/"+capacity+"/"+latest+"/int/"+index,call(ints,numbers,"${m('hp','b','(II)I')}",new Class<?>[]{int.class,int.class},index,1),numericModel.get(index));
    Object actual=call(objects,references,"${m('ao','a','(II)Ljava/lang/Object;')}",new Class<?>[]{int.class,int.class},index,67);
    check("history/"+capacity+"/"+latest+"/object-identity/"+index,actual==objectModel.get(index),true);
   }
   rejected("history/"+capacity+"/"+latest+"/int-future",ints,numbers,"${m('hp','b','(II)I')}",new Class<?>[]{int.class,int.class},"State in future "+latest+" "+(latest+1),latest+1,1);
   rejected("history/"+capacity+"/"+latest+"/object-future",objects,references,"${m('ao','a','(II)Ljava/lang/Object;')}",new Class<?>[]{int.class,int.class},"State in future "+latest+" "+(latest+1),latest+1,67);
   if(latest>=capacity){int erased=latest-capacity;String message="State erased "+erased+". Lastest entry: "+latest;
    rejected("history/"+capacity+"/"+latest+"/int-erased",ints,numbers,"${m('hp','b','(II)I')}",new Class<?>[]{int.class,int.class},message,erased,1);
    rejected("history/"+capacity+"/"+latest+"/object-erased",objects,references,"${m('ao','a','(II)Ljava/lang/Object;')}",new Class<?>[]{int.class,int.class},message,erased,67);
    check("history/"+capacity+"/"+latest+"/int-adjustment-zero",call(ints,numbers,"${m('hp','b','(II)I')}",new Class<?>[]{int.class,int.class},erased,0),number);
   }
  }
 }
 Class<?> ball=Class.forName("${className('vn')}");Object value=make(ball,new Class<?>[]{int.class,int.class,int.class,int.class},0,0,0,0);
 Object x=get(ball,value,"${f('vn','E','Lhp;')}"),y=get(ball,value,"${f('vn','y','Lhp;')}");check("ball/history/separate",x!=y,true);
 check("ball/history/x-capacity",get(ints,x,"${f('hp','n','I')}"),50);check("ball/history/y-capacity",get(ints,y,"${f('hp','n','I')}"),50);
}
static void verifyScorePopups()throws Exception{
 Class<?> popup=Class.forName("${className('ul')}");
 for(int points:new int[]{0,1,-1,Integer.MIN_VALUE,Integer.MAX_VALUE}){
  Object value=make(popup,new Class<?>[]{int.class,int.class,int.class},points,123456,654321);
  check("popup/"+points+"/text",get(popup,value,"${f('ul','o','Ljava/lang/String;')}"),Integer.toString(points));
  for(int age=1;age<=50;age++){
   check("popup/"+points+"/"+age+"/alive",call(popup,value,"${m('ul','b','(Z)Z')}",new Class<?>[]{boolean.class},false),age<50);
   check("popup/"+points+"/"+age+"/remaining",get(popup,value,"${f('ul','q','I')}"),50-age);
   check("popup/"+points+"/"+age+"/y",get(popup,value,"${f('ul','n','I')}"),654321-age*256);
   check("popup/"+points+"/"+age+"/x",get(popup,value,"${f('ul','i','I')}"),123456);
  }
 }
 Object guarded=make(popup,new Class<?>[]{int.class,int.class,int.class},9,0,256);
 check("popup/true-guard/return",call(popup,guarded,"${m('ul','b','(Z)Z')}",new Class<?>[]{boolean.class},true),false);
 check("popup/true-guard/y",get(popup,guarded,"${f('ul','n','I')}"),0);check("popup/true-guard/remaining",get(popup,guarded,"${f('ul','q','I')}"),50);
}
static void verifyPowerUps()throws Exception{
 Class<?> power=Class.forName("${className('ge')}"),body=Class.forName("${className('vi')}"),circle=Class.forName("${className('no')}"),history=Class.forName("${className('ao')}"),board=Class.forName("${className('j')}"),match=Class.forName("${className('ak')}"),deque=Class.forName("${className('vl')}"),node=Class.forName("${className('nm')}");
 Set<Integer> selfTypes=new HashSet<>(Arrays.asList(4,5,10,12,14,17,18));
 for(int type=0;type<29;type++){
  Object source=make(power,new Class<?>[]{int.class,int.class,int.class},123456,-789,type);
  check("power/"+type+"/self",call(power,source,"${m('ge','b','(Z)Z')}",new Class<?>[]{boolean.class},false),selfTypes.contains(type));
  set(body,source,"${f('vi','k','I')}",333);set(body,source,"${f('vi','o','I')}",-444);set(body,source,"${f('vi','l','I')}",123);
  Object copy=make(power,new Class<?>[]{power,int.class},source,170);
  check("power/"+type+"/copy/distinct",source!=copy,true);check("power/"+type+"/copy/x",get(body,copy,"${f('vi','j','I')}"),123456);check("power/"+type+"/copy/y",get(body,copy,"${f('vi','m','I')}"),-789);
  check("power/"+type+"/copy/type",get(body,copy,"${f('vi','i','I')}"),type);check("power/"+type+"/copy/radius",get(circle,copy,"${f('no','u','I')}"),2048);
  check("power/"+type+"/copy/vx",get(body,copy,"${f('vi','k','I')}"),0);check("power/"+type+"/copy/vy",get(body,copy,"${f('vi','o','I')}"),1024);check("power/"+type+"/copy/state",get(body,copy,"${f('vi','l','I')}"),0);check("power/"+type+"/copy/tick",get(power,copy,"${f('ge','y','I')}"),170);
 }
 for(int count:new int[]{1,2,5})for(int selected=0;selected<count;selected++)for(int mask=0;mask<(1<<count);mask++){
  Object value=unsafe.allocateInstance(match),boards=Array.newInstance(board,count),attacks=make(deque,new Class<?>[]{});
  int maskTwo=((mask<<1)|(mask>>(count-1)))&((1<<count)-1),maskThree=(mask*3)&((1<<count)-1),combined=mask|maskTwo|maskThree;
  set(match,value,"${f('ak','l','[Lj;')}",boards);set(match,value,"${f('ak','k','I')}",count);set(match,value,"${f('ak','i','I')}",mask);set(match,value,"${f('ak','g','I')}",maskTwo);set(match,value,"${f('ak','a','I')}",maskThree);
  for(int i=0;i<count;i++){Object b=unsafe.allocateInstance(board);set(board,b,"${f('j','F','I')}",i*100+7);set(board,b,"${f('j','kb','Lao;')}",make(history,new Class<?>[]{int.class},50));Array.set(boards,i,b);}
  int[] types={7,5,13,18};ArrayList<Object> sources=new ArrayList<>();
  for(int i=0;i<types.length;i++){Object p=make(power,new Class<?>[]{int.class,int.class,int.class},i*256,-i*512,types[i]);sources.add(p);call(deque,attacks,"${m('vl','a','(Lnm;B)V')}",new Class<?>[]{node,byte.class},p,(byte)3);}
  call(match,value,"${m('ak','a','(IILvl;B)V')}",new Class<?>[]{int.class,int.class,deque,byte.class},selected,23,attacks,(byte)-39);
  String label="routing/"+count+"/"+selected+"/"+mask;
  check(label+"/sources-retained",call(deque,attacks,"${m('vl','e','(I)I')}",new Class<?>[]{int.class},117),4);
  for(int i=0;i<count;i++){
   Object entries=get(board,Array.get(boards,i),"${f('j','kb','Lao;')}");int index=0;
   for(int k=0;k<types.length;k++)if((count==1||selfTypes.contains(types[k]))?i==selected:i!=selected&&(combined&(1<<i))==0){
    Object actual=call(history,entries,"${m('ao','a','(II)Ljava/lang/Object;')}",new Class<?>[]{int.class,int.class},index++,67);
    check(label+"/"+i+"/"+k+"/copy",actual!=sources.get(k),true);check(label+"/"+i+"/"+k+"/type",get(body,actual,"${f('vi','i','I')}"),types[k]);
    check(label+"/"+i+"/"+k+"/x",get(body,actual,"${f('vi','j','I')}"),k*256);check(label+"/"+i+"/"+k+"/y",get(body,actual,"${f('vi','m','I')}"),-k*512);check(label+"/"+i+"/"+k+"/tick",get(power,actual,"${f('ge','y','I')}"),i*100+30);
   }
   check(label+"/"+i+"/count",get(history,entries,"${f('ao','n','I')}"),index-1);
  }
 }
 Object value=unsafe.allocateInstance(match),b=unsafe.allocateInstance(board),boards=Array.newInstance(board,1),entries=make(history,new Class<?>[]{int.class},10);
 Array.set(boards,0,b);set(match,value,"${f('ak','l','[Lj;')}",boards);set(board,b,"${f('j','kb','Lao;')}",entries);set(board,b,"${f('j','rb','I')}",4);
 Class<?> paddle=Class.forName("${className('vo')}");Object p=make(paddle,new Class<?>[]{int.class,int.class,int.class,int.class},50000,1024,2,100000);set(board,b,"${f('j','yb','Lvo;')}",p);
 int[] types={7,5,5},ticks={10,2,12};for(int i=0;i<types.length;i++){Object effect=make(power,new Class<?>[]{int.class,int.class,int.class,int.class},0,0,types[i],ticks[i]);call(history,entries,"${m('ao','a','(Ljava/lang/Object;B)V')}",new Class<?>[]{Object.class,byte.class},effect,(byte)-39);}
 set(board,b,"${f('j','F','I')}",9);call(match,value,"${m('ak','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)81,0);
 check("pending/future-prefix/index",get(board,b,"${f('j','X','I')}"),0);check("pending/future-prefix/later-due-not-applied",get(board,b,"${f('j','rb','I')}"),4);
 check("pending/lookahead/before-prefix",call(board,b,"${m('j','a','(III)I')}",new Class<?>[]{int.class,int.class,int.class},5,9,0),-1);
 check("pending/lookahead/type-delay",call(board,b,"${m('j','a','(III)I')}",new Class<?>[]{int.class,int.class,int.class},7,9,1),1);
 set(board,b,"${f('j','F','I')}",10);call(match,value,"${m('ak','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)81,0);
 check("pending/due-prefix/index",get(board,b,"${f('j','X','I')}"),2);check("pending/due-prefix/paddle-stage",get(paddle,p,"${f('vo','F','I')}"),6);check("pending/due-prefix/board-counter",get(board,b,"${f('j','rb','I')}"),5);
 call(match,value,"${m('ak','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)81,0);check("pending/not-applied-twice",get(board,b,"${f('j','rb','I')}"),5);
 set(board,b,"${f('j','F','I')}",12);set(board,b,"${f('j','Z','I')}",3);call(match,value,"${m('ak','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)81,0);
 check("pending/state-three/consumed",get(board,b,"${f('j','X','I')}"),3);check("pending/state-three/suppressed",get(board,b,"${f('j','rb','I')}"),5);
}
static void verifyBodies()throws Exception{Class<?> body=Class.forName("${className('vi')}"),rectangle=Class.forName("${className('bn')}"),circle=Class.forName("${className('no')}"),ball=Class.forName("${className('vn')}"),brick=Class.forName("${className('on')}");
for(int x:new int[]{0,1,-1,256,65536,Integer.MIN_VALUE,Integer.MAX_VALUE})for(int y:new int[]{0,17,-100,Integer.MIN_VALUE,Integer.MAX_VALUE}){int vx=x*31,vy=y*-13,type=(x^y)&255,state=(x+y)&127;Object plain=new BodyProbe(x,y,vx,vy,type);set(body,plain,"${f('vi','l','I')}",state);check("body/checksum/"+x+"/"+y,call(body,plain,"${m('vi','a','(ILjava/lang/StringBuilder;)I')}",new Class<?>[]{int.class,StringBuilder.class},89,null),bodyChecksum(x,y,vx,vy,type,state));Object rect=make(rectangle,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class,int.class},x,y,vx,vy,8704,4096,type);check("rectangle/x/"+x+"/"+y,get(body,rect,"${f('vi','j','I')}"),x);check("rectangle/y/"+x+"/"+y,get(body,rect,"${f('vi','m','I')}"),y);check("rectangle/vx/"+x+"/"+y,get(body,rect,"${f('vi','k','I')}"),vx);check("rectangle/vy/"+x+"/"+y,get(body,rect,"${f('vi','o','I')}"),vy);int expected=(((33029+4096*37)<<13)+((41*8704+29813)<<2))^bodyChecksum(x,y,vx,vy,type,0);check("rectangle/checksum/"+x+"/"+y,call(rectangle,rect,"${m('bn','a','(ILjava/lang/StringBuilder;)I')}",new Class<?>[]{int.class,StringBuilder.class},89,null),expected);Object disk=make(circle,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class},x,y,vx,vy,1536,type);check("circle/checksum/"+x+"/"+y,call(circle,disk,"${m('no','a','(ILjava/lang/StringBuilder;)I')}",new Class<?>[]{int.class,StringBuilder.class},89,null),((1536+1365)<<6)^bodyChecksum(x,y,vx,vy,type,0));}
Object rect=make(rectangle,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class,int.class},4,6,0,0,16,12,0);for(int radius:new int[]{0,1,2,5})for(int y=-1;y<=25;y++)for(int x=-3;x<=27;x++){Object disk=make(circle,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class},x,y,0,0,radius,0);long dx=x-Math.max(4,Math.min(20,x)),dy=y-Math.max(6,Math.min(18,y));boolean expected=Math.abs(y-12)<6+radius&&Math.abs(x-12)<8+radius&&dx*dx+dy*dy<=(long)radius*radius;check("overlap/"+x+"/"+y+"/"+radius,call(rectangle,rect,"${m('bn','a','(Lno;Z)Z')}",new Class<?>[]{circle,boolean.class},disk,false),expected);}
Object actualBall=make(ball,new Class<?>[]{int.class,int.class,int.class,int.class},256,512,-73,81);check("ball/radius",get(circle,actualBall,"${f('no','u','I')}"),1536);check("ball/velocity",get(body,actualBall,"${f('vi','k','I')}"),-73);Object actualBrick=make(brick,new Class<?>[]{int.class,int.class,int.class,int.class,int.class,int.class,int.class,int.class},256,512,0,0,7,1,2,3);check("brick/width",get(rectangle,actualBrick,"${f('bn','u','I')}"),8704);check("brick/height",get(rectangle,actualBrick,"${f('bn','s','I')}"),4096);check("brick/type",get(body,actualBrick,"${f('vi','i','I')}"),7);}
static void verifyPaddle()throws Exception{Class<?> paddle=Class.forName("${className('vo')}"),body=Class.forName("${className('vi')}"),rect=Class.forName("${className('bn')}");Object p=make(paddle,new Class<?>[]{int.class,int.class,int.class,int.class},50000,1024,2,100000);check("paddle/default/height",get(rect,p,"${f('bn','s','I')}"),3840);for(int i=0;i<5;i++){call(paddle,p,"${m('vo','d','(I)V')}",new Class<?>[]{int.class},6);int stage=Math.min(14,10+i*2),width=22528+(stage-8)*1536;check("paddle/grow/"+i+"/stage",get(paddle,p,"${f('vo','F','I')}"),stage);check("paddle/grow/"+i+"/width",get(rect,p,"${f('bn','u','I')}"),width);check("paddle/grow/"+i+"/center",(Integer)get(body,p,"${f('vi','j','I')}")+width/2,50000);}for(int i=0;i<9;i++){call(paddle,p,"${m('vo','e','(B)V')}",new Class<?>[]{byte.class},(byte)0);int stage=Math.max(0,12-i*2),width=22528+(stage-8)*1536;check("paddle/shrink/"+i+"/stage",get(paddle,p,"${f('vo','F','I')}"),stage);check("paddle/shrink/"+i+"/width",get(rect,p,"${f('bn','u','I')}"),width);check("paddle/shrink/"+i+"/center",(Integer)get(body,p,"${f('vi','j','I')}")+width/2,50000);}call(paddle,p,"${m('vo','f','(I)V')}",new Class<?>[]{int.class},17);check("paddle/reset/stage",get(paddle,p,"${f('vo','F','I')}"),8);check("paddle/reset/width",get(rect,p,"${f('bn','u','I')}"),22528);check("paddle/reset/state",get(paddle,p,"${f('vo','H','I')}"),17);}
static void verifyMasks()throws Exception{Class<?> match=Class.forName("${className('ak')}"),board=Class.forName("${className('j')}");Object value=unsafe.allocateInstance(match),boards=Array.newInstance(board,5);for(int i=0;i<5;i++){Object p=unsafe.allocateInstance(board);set(board,p,"${f('j','M','I')}",i%2);set(board,p,"${f('j','Z','I')}",i<3?7:0);Array.set(boards,i,p);}set(match,value,"${f('ak','l','[Lj;')}",boards);set(match,value,"${f('ak','k','I')}",5);for(int a=0;a<32;a++)for(int b=0;b<32;b++){int c=(a*3+b*7)&31;set(match,value,"${f('ak','i','I')}",a);set(match,value,"${f('ak','g','I')}",b);set(match,value,"${f('ak','a','I')}",c);check("match/state-zero/"+a+"/"+b,call(match,value,"${m('ak','a','(B)I')}",new Class<?>[]{byte.class},(byte)-92),21&~(a|b|c));check("match/state-seven/"+a+"/"+b,call(match,value,"${m('ak','c','(I)I')}",new Class<?>[]{int.class},-17566),7&~c);}}
static void verifyDeques()throws Exception{Class<?> deque=Class.forName("${className('vl')}"),node=Class.forName("${className('nm')}");Object[] lists={make(deque,new Class<?>[]{}),make(deque,new Class<?>[]{})};ArrayList<Object> nodes=new ArrayList<>();for(int i=0;i<20;i++)nodes.add(make(node,new Class<?>[]{}));ArrayList<Integer>[] models=new ArrayList[]{new ArrayList<>(),new ArrayList<>()};Random random=new Random(123456);for(int step=0;step<500;step++){int which=random.nextInt(2),operation=random.nextInt(5),id=random.nextInt(nodes.size());Object list=lists[which];if(operation<2){for(ArrayList<Integer> model:models)model.remove((Integer)id);if(operation==0){models[which].add(0,id);call(deque,list,"${m('vl','a','(ZLnm;)V')}",new Class<?>[]{boolean.class,node},true,nodes.get(id));}else{models[which].add(id);call(deque,list,"${m('vl','a','(Lnm;B)V')}",new Class<?>[]{node,byte.class},nodes.get(id),(byte)3);}}else if(operation==2){Integer expected=models[which].isEmpty()?null:models[which].remove(0);Object actual=call(deque,list,"${m('vl','c','(I)Lnm;')}",new Class<?>[]{int.class},3);check("deque/remove/"+step,actual==null?-1:nodes.indexOf(actual),expected==null?-1:expected);}else if(operation==3){for(ArrayList<Integer> model:models)model.remove((Integer)id);call(node,nodes.get(id),"${m('nm','b','(B)V')}",new Class<?>[]{byte.class},(byte)111);}else{models[which].clear();call(deque,list,"${m('vl','c','(B)V')}",new Class<?>[]{byte.class},(byte)-79);}for(int d=0;d<2;d++){check("deque/"+step+"/"+d+"/size",call(deque,lists[d],"${m('vl','e','(I)I')}",new Class<?>[]{int.class},117),models[d].size());check("deque/"+step+"/"+d+"/empty",call(deque,lists[d],"${m('vl','a','(Z)Z')}",new Class<?>[]{boolean.class},false),models[d].isEmpty());ArrayList<Integer> observed=new ArrayList<>();Object cursor=call(deque,lists[d],"${m('vl','d','(I)Lnm;')}",new Class<?>[]{int.class},-100);while(cursor!=null){observed.add(nodes.indexOf(cursor));cursor=call(deque,lists[d],"${m('vl','a','(B)Lnm;')}",new Class<?>[]{byte.class},(byte)116);}check("deque/"+step+"/"+d+"/forward",observed.toString(),models[d].toString());observed.clear();cursor=call(deque,lists[d],"${m('vl','f','(I)Lnm;')}",new Class<?>[]{int.class},0);while(cursor!=null){observed.add(nodes.indexOf(cursor));cursor=call(deque,lists[d],"${m('vl','b','(I)Lnm;')}",new Class<?>[]{int.class},-20);}ArrayList<Integer> reverse=new ArrayList<>(models[d]);Collections.reverse(reverse);check("deque/"+step+"/"+d+"/reverse",observed.toString(),reverse.toString());}}}
public static void main(String[] args)throws Exception{trace=java.security.MessageDigest.getInstance("SHA-256");Field f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);unsafe=(Unsafe)f.get(null);verifyBodies();verifyPaddle();verifyMasks();verifyDeques();verifyHistories();verifyScorePopups();verifyPowerUps();StringBuilder hex=new StringBuilder();for(byte b:trace.digest())hex.append(String.format(java.util.Locale.ROOT,"%02x",b&255));System.out.println("traceSha256:"+hex);System.out.println("checks:"+checks);}}
`);
const files=sourceInventory(readable?named:input).map(x=>path.join(readable?named:input,x.path));const argsFile=path.join(dir,'sources.args');fs.writeFileSync(argsFile,files.map(f=>JSON.stringify(f)).join('\n')+'\n');captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-sourcepath','','-classpath',classpath,'-d',compiled,'@'+argsFile]);captureProcess('javac',['-encoding','UTF-8','-classpath',compiled,'-d',compiled,harness]);outputs.push(captureProcess('java',['-Djava.awt.headless=true','-cp',[shims,compiled,classpath].join(path.delimiter),'BrickCoreProbe']).stdout);}
assert.equal(outputs[0].toString(),outputs[1].toString(),'Raw/named native traces differ');const summary=/^traceSha256:([a-f0-9]{64})\nchecks:(\d+)\n$/.exec(outputs[0].toString());assert.ok(summary);return {checks:Number(summary[2]),traceSha256:summary[1],rawNamedIdentical:true,independentExpectations:true,headlessClientBoundary:true,bodyChecksumFixtures:true,circleOverlapFixtures:true,paddleSizeFixtures:true,playerMaskFixtures:true,dequeTransferFixtures:true,historyRetentionFixtures:true,scorePopupFixtures:true,powerUpRoutingFixtures:true,pendingPowerUpFixtures:true};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'brick-core-check-'));try{const rules=JSON.parse(fs.readFileSync(path.join(workflowRoot,'brickabrac-rules.json'))),mapping=JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/brickabrac-naming.json'))),input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);console.log(JSON.stringify(verifyBrickCore(input,path.join(funorbRepository,'games/brickabrac'),mapping,stubs.jar,temporary)));}catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}finally{fs.rmSync(temporary,{recursive:true,force:true});}}
