import fs from 'node:fs';
import {highscoreProbe} from './test-aceofskies-highscores.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {digest} from '../game-export.mjs';

export function verifyAceCore(input, named, mapping, classpath, temporary, extraVerification) {
  const aliases = new Map(mapping.rules.map(r => [r.symbol, r.to]));
  const symbols = new Set(mapping.symbols.map(s => s.symbol));
  const outputs = [];
  for (const readable of [false, true]) {
    const c = owner => readable ? aliases.get('C:' + owner) || owner : owner;
    const member = (kind, owner, original, descriptor) => {
      const key = `${kind}:${owner}.${kind === 'F' ? 'field_' : ''}${original}${kind === 'F' ? ':' : ''}${descriptor}`;
      assert.ok(symbols.has(key), 'Missing probe identity: ' + key);
      return readable ? aliases.get(key) || (kind === 'F' ? 'field_' : '') + original : (kind === 'F' ? 'field_' : '') + original;
    };
    const f = (owner, original, type) => member('F', owner, original, type);
    const m = (owner, original, type) => member('M', owner, original, type);
    const directory = path.join(temporary, readable ? 'named-core' : 'raw-core');
    const compiled = path.join(directory, 'classes'), shims = path.join(directory, 'shims');
    fs.mkdirSync(compiled, {recursive: true}); fs.mkdirSync(shims);
    // Both variants compile every actual source. Only the applet's opaque
    // branch-control holder is replaced at runtime to keep probes headless.
    const shim = path.join(directory, 'AceOfSkies.java');
    fs.writeFileSync(shim, `public class AceOfSkies {public static boolean ${f('AceOfSkies', 'G', 'Z')}=false;}`);
    captureProcess('javac', ['--release', '8', '-d', shims, shim]);
    const harness = path.join(directory, 'AceCoreProbe.java');
    fs.writeFileSync(harness, `import java.lang.reflect.*;import java.util.*;import sun.misc.Unsafe;
public class AceCoreProbe {
static int checks;static Unsafe unsafe;
static void check(String name,Object actual,Object expected){if(!Objects.equals(actual,expected))throw new AssertionError(name+": "+actual+" != "+expected);checks++;System.out.println(name+":"+actual);}
static void close(String name,double actual,double expected){if(Double.isNaN(actual)||Math.abs(actual-expected)>1e-9*Math.max(1,Math.abs(expected)))throw new AssertionError(name+": "+actual+" != "+expected);checks++;System.out.println(name+":"+actual);}
static Field field(Class<?> owner,String name)throws Exception{Field f=owner.getDeclaredField(name);f.setAccessible(true);return f;}
static Object call(Object receiver,String name,Class<?>[] types,Object...args)throws Exception{Method m=receiver.getClass().getDeclaredMethod(name,types);m.setAccessible(true);return m.invoke(receiver,args);}
static void vectors(){
double[] values={-1234.5,-10,-1,-0.0,0,0.25,1,10,1234.5};
for(double x:values)for(double y:values){
${c('kc')} v=new ${c('kc')}(x,y),copy=new ${c('kc')}(v),other=new ${c('kc')}(3,-4);
close("vector/x",v.${f('kc','a','D')},x);close("vector/y",v.${f('kc','b','D')},y);
v.${m('kc','a','(BLkc;)V')}((byte)103,other);close("vector/add-x",v.${f('kc','a','D')},x+3);close("vector/add-y",v.${f('kc','b','D')},y-4);
v.${m('kc','a','(Lkc;I)V')}(other,-30507);close("vector/sub-x",v.${f('kc','a','D')},x);close("vector/sub-y",v.${f('kc','b','D')},y);
close("vector/copy-x",copy.${f('kc','a','D')},x);close("vector/copy-y",copy.${f('kc','b','D')},y);
close("vector/squared",v.${m('kc','b','(I)D')}(127),x*x+y*y);close("vector/length",v.${m('kc','a','(B)D')}((byte)-74),Math.sqrt(x*x+y*y));
close("vector/dot",v.${m('kc','a','(Lkc;B)D')}(other,(byte)-100),x*3-y*4);
int angle=x==0&&y==0?255:(int)(Math.atan2(y,x)*255/Math.PI);
// The add/subtract checks above may canonicalize signed zero; angle belongs
// to the untouched copy, preserving atan2's signed-zero input behavior.
check("vector/angle",copy.${m('kc','c','(I)I')}(-113),angle);
}
for(double angle:new double[]{-512,-256,-128,-64,0,32,64,128,192,256,512})for(double radius:new double[]{-10,0,1,23.5}){
${c('kc')} v=new ${c('kc')}();v.${m('kc','a','(DDI)V')}(radius,angle,121);
close("polar/x",v.${f('kc','a','D')},radius*Math.sin(angle*Math.PI/128));close("polar/y",v.${f('kc','b','D')},radius*Math.cos(angle*Math.PI/128));
}}
static void flight(){
for(double heading:new double[]{0,32,64,128,192,256})for(int offset:new int[]{-7,-1,0,1,7})for(double distance:new double[]{-10,0,0.5,17}){
${c('kc')} p=new ${c('kc')}(13,-7);${c('o')} body=new ${c('o')}(p);
check("body/copy",body.${f('o','d','Lkc;')}!=p,true);
body.${f('o','e','D')}=heading;body.${f('o','f','I')}=offset;
body.${m('o','b','(DI)V')}(distance,128);
double angle=Math.PI*(heading+offset)/128;
close("forward/x",body.${f('o','d','Lkc;')}.${f('kc','a','D')},13-Math.sin(angle)*distance);
close("forward/y",body.${f('o','d','Lkc;')}.${f('kc','b','D')},-7-Math.cos(angle)*distance);
check("forward/offset",body.${f('o','f','I')},offset-Integer.signum(offset));
body.${f('o','d','Lkc;')}.${m('kc','a','(DDZ)V')}(13,-7,true);
body.${m('o','a','(BD)V')}((byte)111,distance);
close("side/x",body.${f('o','d','Lkc;')}.${f('kc','a','D')},13-Math.cos(Math.PI*heading/128)*distance);
close("side/y",body.${f('o','d','Lkc;')}.${f('kc','b','D')},-7+Math.sin(Math.PI*heading/128)*distance);
}
for(double angle:new double[]{-512,-256,-1,0,255,256,512})for(double delta:new double[]{-257,-1,0,1,257}){
${c('o')} body=new ${c('o')}(new ${c('kc')}());body.${f('o','e','D')}=angle;
body.${m('o','a','(DB)V')}(delta,(byte)25);double expected=angle+delta;if(expected<0)expected+=256;if(expected>256)expected-=256;
close("turn/single-wrap",body.${f('o','e','D')},expected);
}
for(double x:new double[]{-321,-161,-81,-80,0,80,81,161,321})for(double y:new double[]{-241,-121,-61,-60,0,60,61,121,241}){
${c('o')} body=new ${c('o')}(new ${c('kc')}(x,y));body.${m('o','a','(DBD)V')}(80,(byte)49,60);
double ex=x<-80?x+160:x>80?x-160:x,ey=y<-60?y+120:y>60?y-120:y;
close("boundary/x",body.${f('o','d','Lkc;')}.${f('kc','a','D')},ex);close("boundary/y",body.${f('o','d','Lkc;')}.${f('kc','b','D')},ey);
}}
static void packets(){
for(int value:new int[]{Integer.MIN_VALUE,-1,0,1,127,128,255,256,32767,32768,65535,65536,0x12345678,Integer.MAX_VALUE}){
byte[] bytes=new byte[32];${c('rb')} b=new ${c('rb')}(bytes);
b.${m('rb','b','(II)V')}(-1336879960,value);b.${m('rb','a','(II)V')}(value,23385);b.${m('rb','c','(II)V')}(0,value);b.${m('rb','a','(BI)V')}((byte)67,value);
check("packet/cursor",b.${f('rb','g','I')},10);
for(int i=0;i<10;i++){int[] shifts={0,8,0,16,8,0,24,16,8,0};check("packet/byte-"+i,bytes[i],(byte)(value>>>shifts[i]));}
b.${f('rb','g','I')}=0;
check("packet/u8",b.${m('rb','g','(I)I')}(-100),value&255);check("packet/u16",b.${m('rb','i','(B)I')}((byte)0),value&65535);
check("packet/u24",b.${m('rb','g','(B)I')}((byte)-100),value&0xffffff);check("packet/i32",b.${m('rb','a','(B)I')}((byte)110),value);
}
for(long value:new long[]{Long.MIN_VALUE,-1,0,1,0x0123456789abcdefL,Long.MAX_VALUE}){
byte[] bytes=new byte[8];${c('rb')} b=new ${c('rb')}(bytes);b.${m('rb','b','(BJ)V')}((byte)-102,value);
for(int i=0;i<8;i++)check("packet/long-byte",bytes[i],(byte)(value>>>(56-8*i)));
b.${f('rb','g','I')}=0;check("packet/long",b.${m('rb','h','(B)J')}((byte)100),value);
}}
static void deques(){
${c('kp')} first=new ${c('kp')}(),second=new ${c('kp')}();${c('wf')} a=new ${c('wf')}(),b=new ${c('wf')}(),c=new ${c('wf')}();
check("deque/empty",first.${m('kp','a','(Z)Z')}(true),true);
first.${m('kp','a','(ILwf;)V')}(100,a);first.${m('kp','a','(ILwf;)V')}(100,b);first.${m('kp','a','(Lwf;I)V')}(c,25611);
check("deque/first",first.${m('kp','d','(I)Lwf;')}(268435455)==c,true);check("deque/next",first.${m('kp','b','(B)Lwf;')}((byte)103)==a,true);
check("deque/last-next",first.${m('kp','b','(B)Lwf;')}((byte)103)==b,true);check("deque/end",first.${m('kp','b','(B)Lwf;')}((byte)103)==null,true);
check("deque/last",first.${m('kp','a','(B)Lwf;')}((byte)-100)==b,true);check("deque/previous",first.${m('kp','a','(I)Lwf;')}(100)==a,true);
second.${m('kp','a','(ILwf;)V')}(100,a);check("deque/transfer",second.${m('kp','d','(I)Lwf;')}(268435455)==a,true);
check("deque/pop-first",first.${m('kp','e','(I)Lwf;')}(127)==c,true);check("deque/pop-last",first.${m('kp','b','(I)Lwf;')}(4095)==b,true);
check("deque/now-empty",first.${m('kp','a','(Z)Z')}(true),true);check("deque/unlinked",a.${m('wf','b','(B)Z')}((byte)100),true);
second.${m('kp','c','(I)V')}(268435455);check("deque/clear",a.${m('wf','b','(B)Z')}((byte)100),false);
}
static void aircraft(){
${c('gb')} definition=new ${c('gb')}(0.75,8,4,3,6,8,16,12,2);
check("definition/health",definition.${f('gb','e','I')},6);check("definition/fire",definition.${f('gb','d','I')},8);
close("definition/min-speed",definition.${f('gb','h','D')},4);close("definition/max-speed",definition.${f('gb','i','D')},8);
${c('kc')} position=new ${c('kc')}(10,20);${c('md')} plane=new ${c('md')}(position,definition);
check("aircraft/definition",plane.${f('md','r','Lgb;')}==definition,true);check("aircraft/health",plane.${f('md','k','I')},6);
check("aircraft/cooldown",plane.${f('md','y','I')},8);check("aircraft/heat",plane.${f('md','j','I')},0);
check("aircraft/no-target",plane.${f('md','n','Lmd;')}==null,true);check("aircraft/no-pursuer",plane.${f('md','g','Lmd;')}==null,true);
check("aircraft/no-fire",plane.${f('md','l','Z')},false);check("aircraft/position-copy",plane.${f('o','d','Lkc;')}!=position,true);
for(int side:new int[]{-12,0,12})for(int offset:new int[]{-4,0,4})for(double turn:new double[]{-10,0,10}){
plane.${f('o','e','D')}=32;plane.${f('o','f','I')}=99;
${c('eu')} bullet=new ${c('eu')}();bullet.${m('eu','a','(IIDLmd;)V')}(side,offset,turn,plane);
double heading=32+turn;if(heading<0)heading+=256;if(heading>256)heading-=256;
double forward=Math.PI*(heading+offset)/128,sideAngle=Math.PI*32/128;
check("bullet/source",bullet.${f('eu','i','Lmd;')}==plane,true);check("bullet/life",bullet.${f('eu','h','I')},64);
close("bullet/speed",bullet.${f('o','b','D')},20);close("bullet/heading",bullet.${f('o','e','D')},heading);
check("bullet/offset-decay",bullet.${f('o','f','I')},offset-Integer.signum(offset));
close("bullet/x",bullet.${f('o','d','Lkc;')}.${f('kc','a','D')},10-Math.cos(sideAngle)*side-Math.sin(forward)*24);
close("bullet/y",bullet.${f('o','d','Lkc;')}.${f('kc','b','D')},20+Math.sin(sideAngle)*side-Math.cos(forward)*24);
check("bullet/source-position-x",plane.${f('o','d','Lkc;')}.${f('kc','a','D')},10.0);
}
}
static void pools()throws Exception{
Class<?> session=Class.forName("${c('pk')}"),smoke=Class.forName("${c('qf')}"),particle=Class.forName("${c('ok')}");Object game=unsafe.allocateInstance(session);
for(int count:new int[]{1,2,7})for(int index=0;index<count;index++){
Object array=Array.newInstance(smoke,count);for(int i=0;i<count;i++)Array.set(array,i,unsafe.allocateInstance(smoke));Object removed=Array.get(array,index),last=Array.get(array,count-1);
field(session,"${f('pk','n','[Lqf;')}").set(game,array);field(session,"${f('pk','w','I')}").setInt(game,count);
call(game,"${m('pk','c','(II)V')}",new Class<?>[]{int.class,int.class},index,-690800984);
check("smoke/count",field(session,"${f('pk','w','I')}").getInt(game),count-1);check("smoke/swap",Array.get(array,index)==last,true);check("smoke/retained",Array.get(array,count-1)==removed,true);
Object particles=Array.newInstance(particle,count);for(int i=0;i<count;i++)Array.set(particles,i,unsafe.allocateInstance(particle));removed=Array.get(particles,index);last=Array.get(particles,count-1);
field(session,"${f('pk','C','[Lok;')}").set(game,particles);field(session,"${f('pk','K','I')}").setInt(game,count);
call(game,"${m('pk','d','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)-94,index);
check("screen/count",field(session,"${f('pk','K','I')}").getInt(game),count-1);check("screen/swap",Array.get(particles,index)==last,true);check("screen/retained",Array.get(particles,count-1)==removed,true);
}}
static void menus()throws Exception{
Class<?> state=${c('gr')}.class,screen=${c('nk')}.class;
for(int count:new int[]{1,2,7})for(int start=0;start<count;start++)for(int key:new int[]{0,83,84,96,97,98,99,102,103}){
${c('gr')} input=new ${c('gr')}(count);input.${m('gr','a','(ZIII)V')}(false,-1,0,start);${c('bk')}.${f('bk','f','I')}=key;
input.${m('gr','a','(Z)V')}(true);int wanted=key==98?(start+count-1)%count:key==99?(start+1)%count:start;
check("menu/vertical",input.${f('gr','g','I')},wanted);check("menu/activate",input.${m('gr','e','(B)Z')}((byte)125),key==83||key==84);
check("menu/home",input.${m('gr','d','(I)Z')}(55),key==102);check("menu/end",input.${m('gr','b','(I)Z')}(-99),key==103);
check("menu/left",input.${m('gr','a','(I)Z')}(-78),key==96);check("menu/right",input.${m('gr','b','(B)Z')}((byte)-102),key==97);
input.${m('gr','a','(ZIII)V')}(false,-1,0,start);input.${m('gr','c','(B)V')}((byte)-74);
wanted=key==96?(start+count-1)%count:key==97?(start+1)%count:start;check("menu/horizontal",input.${f('gr','g','I')},wanted);
for(int held:new int[]{1,2,3}){input.${m('gr','a','(ZIII)V')}(true,start,held,-1);input.${m('gr','a','(Z)V')}(true);
check("menu/held-keeps-selection",input.${f('gr','g','I')},start);check("menu/held-blocks-key",input.${m('gr','e','(B)Z')}((byte)125),false);}
}
${c('pn')}.${f('pn','d','I')}=3;${c('wm')}.${f('wm','h','I')}=4;
for(boolean pointerMode:new boolean[]{false,true})for(boolean moved:new boolean[]{false,true})for(int hover:new int[]{-1,0,1,2}){
${c('gr')} input=new ${c('gr')}(3);input.${m('gr','a','(ZIII)V')}(pointerMode,1,0,1);
${c('vj')}.${f('vj','d','I')}=0;${c('vu')}.${f('vu','f','I')}=0;${c('uu')}.${f('uu','e','Z')}=moved;
input.${m('gr','a','(III)V')}(0,hover,-24702);
int wanted=hover>=0&&(pointerMode||moved)?hover:hover<0&&pointerMode?-1:1;
check("menu/pointer-selection",input.${f('gr','g','I')},wanted);
}
for(int button:new int[]{1,2,3}){
${c('gr')} input=new ${c('gr')}(3);input.${m('gr','a','(ZIII)V')}(false,-1,0,2);
${c('vj')}.${f('vj','d','I')}=button;${c('vu')}.${f('vu','f','I')}=button;${c('uu')}.${f('uu','e','Z')}=false;
input.${m('gr','a','(III)V')}(0,1,-24702);check("menu/press-selects",input.${f('gr','g','I')},0);check("menu/press-activates",input.${m('gr','e','(B)Z')}((byte)125),true);
// The initial delay includes the current press frame, which immediately
// consumes one countdown tick.
check("menu/press-delay",field(state,"${f('gr','j','I')}").getInt(input),2);
${c('vj')}.${f('vj','d','I')}=0;
for(int tick=0;tick<9;tick++){input.${m('gr','a','(III)V')}(0,1,-24702);check("menu/held-no-press-edge",input.${m('gr','e','(B)Z')}((byte)125),false);check("menu/held-owner",input.${m('gr','a','(B)Z')}((byte)98),true);}
${c('vu')}.${f('vu','f','I')}=0;input.${m('gr','a','(III)V')}(0,1,-24702);check("menu/released",input.${m('gr','a','(B)Z')}((byte)98),false);
try{input.${m('gr','a','(III)V')}(3,0,-24702);throw new AssertionError("pointer range");}catch(IllegalArgumentException expected){}
}
${c('ua')}.${f('ua','l','[[I')}=new int[8][];${c('dt')}.${f('dt','a','[I')}=new int[8];${c('bk')}.${f('bk','e','[I')}=new int[8];${c('oo')}.${f('oo','Y','[I')}=new int[8];${c('ak')}.${f('ak','f','[I')}=new int[8];
${c('io')}.${f('io','a','[Ljava/lang/String;')}=new String[]{"one","two","three"};${c('aa')}.${f('aa','b','[Lnk;')}=new ${c('nk')}[8];
${c('ln')}.${f('ln','d','I')}=2;${c('kh')}.${f('kh','a','Z')}=true;
for(int id=0;id<8;id++){
int[] actions=id==2?new int[]{8,9,10,21,5,20}:id==3?new int[]{18,6,17}:new int[]{5,5,5};
${c('za')}.${m('za','a','(I[IIIIIB)V')}(40,actions,30,20,id,460,(byte)-64);
${c('nk')} menu=new ${c('nk')}(id);${c('aa')}.${f('aa','b','[Lnk;')}[id]=menu;
check("menu/constructor-click",field(screen,"${f('nk','c','I')}").getInt(menu),-1);check("menu/constructor-achievement",field(screen,"${f('nk','e','I')}").getInt(menu),-1);
if(id==2||id==3||id==4||id==5)continue;
for(int index=0;index<3;index++)for(int dx:new int[]{-1,0,1,439,440})for(int dy:new int[]{-1,0,1,29,30}){
int x=20+dx,y=30+40*index+dy,wanted=-1;
for(int row=0;row<3;row++)if(x>=20&&x<460&&y>=30+40*row&&y<60+40*row){wanted=row;break;}
check("menu/hit-bounds",call(menu,"${m('nk','a','(III)I')}",new Class<?>[]{int.class,int.class,int.class},-76,x,y),wanted);
}
}
${c('nk')} instructions=${c('aa')}.${f('aa','b','[Lnk;')}[3];
for(int page=0;page<3;page++){${c('vq')}.${f('vq','w','I')}=page;
check("menu/previous-page",call(instructions,"${m('nk','a','(IB)Z')}",new Class<?>[]{int.class,byte.class},0,(byte)-17),page>0);
check("menu/next-page",call(instructions,"${m('nk','a','(IB)Z')}",new Class<?>[]{int.class,byte.class},2,(byte)-17),page<2);}
${c('nk')} highscores=${c('aa')}.${f('aa','b','[Lnk;')}[2];
for(boolean alternate:new boolean[]{false,true}){${c('ks')}.${f('ks','b','Z')}=alternate;
for(int index=0;index<6;index++){
int left=alternate?-80:20+200*(index%3),top=alternate?24+40*index:index<3?24:64;
check("menu/highscores-left",call(highscores,"${m('nk','a','(II)I')}",new Class<?>[]{int.class,int.class},index,200),left);
check("menu/highscores-top",call(highscores,"${m('nk','a','(IZ)I')}",new Class<?>[]{int.class,boolean.class},index,true),top);
check("menu/highscores-right",call(highscores,"${m('nk','c','(II)I')}",new Class<?>[]{int.class,int.class},123,index),alternate?560:left+180);
}}
${c('kp')}.${f('kp','b','Ljava/lang/String;')}=",";
for(int value:new int[]{Integer.MIN_VALUE,-10000,-1,0,1,999,1000,1001,1000000,Integer.MAX_VALUE}){
String wanted=value<0?Integer.toString(value):String.format(java.util.Locale.ROOT,"%,d",value);
check("menu/number-format",call(instructions,"${m('nk','b','(IZ)Ljava/lang/String;')}",new Class<?>[]{int.class,boolean.class},value,true),wanted);
}
for(int target:new int[]{-1,0,1,3,7}){${c('ec')}.${f('ec','t','I')}=123;
${c('eu')}.${m('eu','a','(BIZ)V')}((byte)-105,target,false);
check("menu/transition-target",${c('ci')}.${f('ci','d','I')},target);check("menu/transition-reset",${c('ec')}.${f('ec','t','I')},0);}
}
${highscoreProbe(c, f, m)}
public static void main(String[] args)throws Exception{Field u=Unsafe.class.getDeclaredField("theUnsafe");u.setAccessible(true);unsafe=(Unsafe)u.get(null);vectors();flight();packets();deques();aircraft();pools();menus();highscores();System.out.println("checks:"+checks);}
}
`);
    const root = readable ? named : input, argsFile = path.join(directory, 'sources.args');
    fs.writeFileSync(argsFile, sourceInventory(root).map(file => JSON.stringify(path.join(root, file.path))).join('\n') + '\n');
    captureProcess('javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-sourcepath', '', '-classpath', classpath, '-d', compiled, '@' + argsFile]);
    captureProcess('javac', ['-encoding', 'UTF-8', '-classpath', compiled, '-d', compiled, harness]);
    outputs.push(captureProcess('java', ['-Djava.awt.headless=true', '-cp', [shims, compiled, classpath].join(path.delimiter), 'AceCoreProbe']).stdout);
  }
  assert.deepEqual(outputs[1], outputs[0], 'Named Ace core differs from pinned raw Java');
  const checks = Number(outputs[0].toString().trimEnd().split('\n').at(-1).split(':')[1]);
  assert.ok(checks > 1500);
  return {checks, rawNamedIdentical: true, independentExpectations: true,
    headlessClientBoundary: true, vectorAndFlightFixtures: true, packetAndDequeFixtures: true,
    aircraftAndBulletSpawnFixtures: true, poolReplacementFixtures: true, menuInputAndGeometryFixtures: true, highscoreProtocolFixtures: true,
    traceSha256: digest(outputs[0]),
    ...(extraVerification ? extraVerification(path.join(temporary, 'raw-core/classes')) : {})};
}
