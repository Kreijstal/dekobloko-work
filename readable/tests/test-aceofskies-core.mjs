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
static void sharedCollectionsAndSoundCache()throws Exception{
for(int buckets:new int[]{1,2,4,8,64}){
${c('ph')} table=new ${c('ph')}(buckets),destination=new ${c('ph')}(buckets);
long[] keys={0,Long.MIN_VALUE,1,-1,7,7,Long.MAX_VALUE,64};${c('wf')}[] nodes=new ${c('wf')}[keys.length];
for(int i=0;i<keys.length;i++){nodes[i]=new ${c('wf')}();table.${m('ph','a','(IJLwf;)V')}(105,keys[i],nodes[i]);}
for(int i=0;i<keys.length;i++){int first=i;for(int j=0;j<i;j++)if(keys[j]==keys[i]){first=j;break;}check("hash/lookup",table.${m('ph','a','(BJ)Lwf;')}((byte)106,keys[i])==nodes[first],true);}
check("hash/missing",table.${m('ph','a','(BJ)Lwf;')}((byte)106,123456789L)==null,true);
List<${c('wf')}> order=new ArrayList<>();for(int bucket=0;bucket<buckets;bucket++)for(int i=0;i<keys.length;i++)if((keys[i]&(buckets-1))==bucket)order.add(nodes[i]);
${c('wf')} entry=table.${m('ph','a','(Z)Lwf;')}(false);for(${c('wf')} expected:order){check("hash/iteration",entry==expected,true);entry=table.${m('ph','a','(I)Lwf;')}(0);}check("hash/iteration-end",entry==null,true);
nodes[4].${m('wf','c','(I)V')}(-123);check("hash/duplicate-next",table.${m('ph','a','(BJ)Lwf;')}((byte)106,7)==nodes[5],true);
destination.${m('ph','a','(IJLwf;)V')}(105,42,nodes[5]);check("hash/transferred-from",table.${m('ph','a','(BJ)Lwf;')}((byte)106,7)==null,true);check("hash/transferred-to",destination.${m('ph','a','(BJ)Lwf;')}((byte)106,42)==nodes[5],true);check("hash/new-key",nodes[5].${f('wf','b','J')},42L);
table.${m('ph','b','(I)V')}(0);check("hash/cleared",table.${m('ph','a','(Z)Lwf;')}(false)==null,true);for(int i=0;i<nodes.length;i++)check("hash/clear-ownership",nodes[i].${m('wf','b','(B)Z')}((byte)100),i==5);
destination.${m('ph','b','(I)V')}(0);check("hash/destination-cleared",nodes[5].${m('wf','b','(B)Z')}((byte)100),false);
}
${c('wt')} sentinel=new ${c('wt')}(),first=new ${c('wt')}(),second=new ${c('wt')}();
sentinel.${f('wt','j','Lwt;')}=first;first.${f('wt','j','Lwt;')}=second;second.${f('wt','j','Lwt;')}=sentinel;
sentinel.${f('wt','f','Lwt;')}=second;second.${f('wt','f','Lwt;')}=first;first.${f('wt','f','Lwt;')}=sentinel;
${c('kp')} primary=new ${c('kp')}();primary.${m('kp','a','(ILwf;)V')}(100,first);primary.${m('kp','a','(ILwf;)V')}(100,second);
first.${m('wt','d','(I)V')}(-128);check("dual/unlink-forward",sentinel.${f('wt','j','Lwt;')}==second,true);check("dual/unlink-backward",second.${f('wt','f','Lwt;')}==sentinel,true);check("dual/secondary-cleared",first.${f('wt','j','Lwt;')}==null&&first.${f('wt','f','Lwt;')}==null,true);check("dual/primary-retained",first.${m('wf','b','(B)Z')}((byte)100),true);
first.${m('wt','d','(I)V')}(-128);check("dual/repeated-unlink",sentinel.${f('wt','j','Lwt;')}==second,true);
primary.${m('kp','c','(I)V')}(268435455);check("dual/primary-cleared",second.${m('wf','b','(B)Z')}((byte)100),false);check("dual/secondary-retained",second.${f('wt','j','Lwt;')}==sentinel&&second.${f('wt','f','Lwt;')}==sentinel,true);
second.${m('wt','d','(I)V')}(-128);check("dual/empty-secondary-ring",sentinel.${f('wt','j','Lwt;')}==sentinel&&sentinel.${f('wt','f','Lwt;')}==sentinel,true);
${c('ob')} cache=new ${c('ob')}(null,null);${c('ph')} pcm=(${c('ph')})field(${c('ob')}.class,"${f('ob','b','Lph;')}").get(cache);
${c('al')} synthesized=new ${c('al')}(22050,new byte[]{1,2},0,2),vorbis=new ${c('al')}(44100,new byte[]{3,4,5},0,3);
// The two decoders use separate key namespaces for the same group/file pair.
pcm.${m('ph','a','(IJLwf;)V')}(105,0L,synthesized);pcm.${m('ph','a','(IJLwf;)V')}(105,4294967296L,vorbis);
for(int remaining:new int[]{-1,0,1,100}){int[] budget={remaining};
check("cache/synthesized-identity",call(cache,"${m('ob','a','(I[III)Lal;')}",new Class<?>[]{int.class,int[].class,int.class,int.class},0,budget,0,-58)==synthesized,true);
check("cache/vorbis-identity",call(cache,"${m('ob','a','(II[II)Lal;')}",new Class<?>[]{int.class,int.class,int[].class,int.class},0,0,budget,1452176260)==vorbis,true);check("cache/hit-retains-budget",budget[0],remaining);
}
for(int remaining:new int[]{-1,0}){int[] budget={remaining};
check("cache/synthesized-exhausted-miss",call(cache,"${m('ob','a','(I[III)Lal;')}",new Class<?>[]{int.class,int[].class,int.class,int.class},1,budget,0,-58)==null,true);
check("cache/vorbis-exhausted-miss",call(cache,"${m('ob','a','(II[II)Lal;')}",new Class<?>[]{int.class,int.class,int[].class,int.class},0,1,budget,1452176260)==null,true);check("cache/miss-retains-budget",budget[0],remaining);
}
}
static ${c('hc')} fontFixture(boolean coverage,boolean kern){
byte[] metrics=new byte[kern?1280:257];for(int i=0;i<256;i++)metrics[i]=(byte)(3+i%5);
if(kern){Arrays.fill(metrics,256,512,(byte)1);Arrays.fill(metrics,512,768,(byte)6);Arrays.fill(metrics,768,1280,(byte)1);}else metrics[256]=7;
int[] x=new int[256],y=new int[256],widths=new int[256],heights=new int[256];Arrays.fill(widths,3);Arrays.fill(heights,3);byte[][] masks=new byte[256][];
for(int i=0;i<256;i++)masks[i]=new byte[]{0,1,2,3,0,3,2,1,3};
return coverage?new ${c('cp')}(metrics,x,y,widths,heights,new int[]{0,0x404040,0x808080,0xffffff},masks):new ${c('vt')}(metrics,x,y,widths,heights,masks);
}
static int fontBlend(int foreground,int background,int alpha){int result=0;for(int shift:new int[]{0,8,16}){int source=(foreground>>>shift)&255,target=(background>>>shift)&255;result|=((source*alpha/256)+(target*(256-alpha)/256))<<shift;}return result;}
static void fontMetricsAndPixels()throws Exception{
byte[] encoded=new byte[263];for(int i=0;i<256;i++)encoded[2+i]=(byte)(3+i%5);encoded[258]=7;encoded[261]=6;encoded[262]=2;
${c('vs')} modern=new ${c('vs')}(encoded);
for(int i=0;i<256;i++){check("font/renderer-advance",modern.${m('vs','a','(BI)I')}((byte)109,i),3+i%5);check("font/renderer-no-kerning",modern.${m('vs','a','(ICI)I')}(0,(char)i,65),0);}
check("font/renderer-line-advance",modern.${f('vs','e','I')},7);check("font/renderer-ascent",modern.${f('vs','j','I')},6);check("font/renderer-descent",modern.${f('vs','i','I')},2);
String[] texts={null,"","A","AB","A B","<col=ff0000>A</col>B","<lt><gt>","<euro>","<unknown>A","<img=0>A","<unclosed"};int[] expectedWidths={0,0,3,7,12,7,8,6,3,3,0};
for(boolean coverage:new boolean[]{false,true})for(boolean kern:new boolean[]{false,true}){
${c('hc')} font=fontFixture(coverage,kern);check("font/software-line-advance",font.${f('hc','w','I')},7);check("font/software-ascent",font.${f('hc','I','I')},7);check("font/software-descent",font.${f('hc','D','I')},-4);check("font/software-capital-x",font.${f('hc','C','I')},7);
char[] characters={0,1,32,65,66,255,8364,1024};int[] codes={63,1,32,65,66,255,128,63};for(int i=0;i<characters.length;i++)check("font/software-advance",font.${m('hc','a','(C)I')}(characters[i]),3+codes[i]%5);
for(int i=0;i<texts.length;i++){int wanted=expectedWidths[i];if(kern&&(i==3||i==5||i==6))wanted-=2;check("font/software-width",font.${m('hc','a','(Ljava/lang/String;)I')}(texts[i]),wanted);if(!kern)check("font/renderer-width",modern.${m('vs','a','(BLjava/lang/String;)I')}((byte)94,texts[i]),expectedWidths[i]);}
String[] lines=new String[8];check("font/wrap-count",font.${m('hc','a','(Ljava/lang/String;[I[Ljava/lang/String;)I')}("AA AA AA",new int[]{6},lines),3);check("font/wrap-lines",Arrays.toString(Arrays.copyOf(lines,3)),"[AA, AA, AA]");check("font/explicit-break",font.${m('hc','a','(Ljava/lang/String;[I[Ljava/lang/String;)I')}("A<br>B",null,lines),2);check("font/explicit-break-lines",Arrays.toString(Arrays.copyOf(lines,2)),"[A<br>, B]");
check("font/wrapped-height",font.${m('hc','a','(Ljava/lang/String;II)I')}("AA AA AA",6,10),23);
}
for(boolean coverage:new boolean[]{false,true}){
${c('hc')} font=fontFixture(coverage,false);int[] sampleCoverage={0,64,128,255,0,255,128,64,255};
for(boolean shadow:new boolean[]{false,true})for(int alpha:new int[]{-1,0,1,128,255,256})for(int[] position:new int[][]{{-2,-1},{0,0},{2,2},{6,5},{8,7}})for(int[] clip:new int[][]{{0,0,8,7},{1,2,6,6}}){
int[] pixels=new int[56],expected=new int[56];Arrays.fill(pixels,0x193453);Arrays.fill(expected,0x193453);${c('vp')}.${m('vp','a','([III)V')}(pixels,8,7);${c('vp')}.${m('vp','e','(IIII)V')}(clip[0],clip[1],clip[2],clip[3]);
if(alpha<0)font.${m('hc','a','(IIIIIIZ)V')}(65,position[0],position[1],3,3,0x70b9d2,shadow);else font.${m('hc','a','(IIIIIIIZ)V')}(65,position[0],position[1],3,3,0x70b9d2,alpha,shadow);
for(int gy=0;gy<3;gy++)for(int gx=0;gx<3;gx++){int x=position[0]+gx,y=position[1]+gy,index=gy*3+gx;if(x<clip[0]||x>=clip[2]||y<clip[1]||y>=clip[3]||sampleCoverage[index]==0)continue;int opacity=alpha<0?256:alpha;if(coverage&&!shadow)opacity=sampleCoverage[index]*opacity/256;expected[y*8+x]=opacity==256?0x70b9d2:fontBlend(0x70b9d2,0x193453,opacity);}
check("font/clipped-glyph-pixels",Arrays.toString(pixels),Arrays.toString(expected));
}
}
// Styled text exercises baseline placement, markup and pen advances through
// the actual software font, rather than only calling the glyph primitives.
${c('hc')} font=fontFixture(false,false);int[] pixels=new int[100];${c('vp')}.${m('vp','a','([III)V')}(pixels,10,10);font.${m('hc','b','(Ljava/lang/String;IIII)V')}("<col=112233>A</col>B",1,8,0xabcdef,-1);int[] expected=new int[100];for(int gy=0;gy<3;gy++)for(int gx=0;gx<3;gx++)if(new int[]{0,1,2,3,0,3,2,1,3}[gy*3+gx]!=0){expected[(gy+1)*10+gx+1]=0x112233;expected[(gy+1)*10+gx+4]=0xabcdef;}check("font/styled-text-pixels",Arrays.toString(pixels),Arrays.toString(expected));
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

static ${c('pk')} flightFixture(${c('gb')} definition)throws Exception{
${c('pk')} session=(${c('pk')})unsafe.allocateInstance(${c('pk')}.class);${c('md')} player=new ${c('md')}(new ${c('kc')}(10,20),definition);
field(${c('pk')}.class,"${f('pk','X','Lmd;')}").set(session,player);field(${c('pk')}.class,"${f('pk','A','[Lmd;')}").set(session,new ${c('md')}[]{player,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null});
field(${c('pk')}.class,"${f('pk','Cb','Z')}").setBoolean(session,true);field(${c('pk')}.class,"${f('pk','r','[I')}").set(session,new int[]{-1,-1,-1,-1,-1,-1,-1});
return session;
}
static void flightControls()throws Exception{
Class<?> type=${c('pk')}.class;${c('lp')}.${f('lp','a','[Z')}=new boolean[128];
for(boolean left:new boolean[]{false,true})for(boolean right:new boolean[]{false,true})for(boolean wasLeft:new boolean[]{false,true})for(boolean wasRight:new boolean[]{false,true})for(int gap:new int[]{0,48,49,100})for(int direction:new int[]{-1,0,1})for(int bank:new int[]{-16,0,16}){
${c('pk')} session=flightFixture(new ${c('gb')}(0.75,15,0,100,6,8,16,12,0));${c('md')} plane=(${c('md')})field(type,"${f('pk','X','Lmd;')}").get(session);plane.${f('o','e','D')}=32;plane.${f('md','i','I')}=bank;
field(type,"${f('pk','M','I')}").setInt(session,100);field(type,"${f('pk','T','I')}").setInt(session,100-gap);field(type,"${f('pk','ib','I')}").setInt(session,100-gap);
field(type,"${f('pk','U','Z')}").setBoolean(session,wasLeft);field(type,"${f('pk','rb','Z')}").setBoolean(session,wasRight);field(type,"${f('pk','mb','I')}").setInt(session,direction);
${c('lp')}.${f('lp','a','[Z')}[96]=left;${c('lp')}.${f('lp','a','[Z')}[97]=right;
call(session,"${m('pk','b','(B)V')}",new Class<?>[]{byte.class},(byte)-13);
boolean activeLeft=left&&!right,activeRight=right&&!left;int wantedDirection=direction;
if(activeLeft){if(!wasLeft&&gap+1<50)wantedDirection=-1;}else if(wantedDirection==-1)wantedDirection=0;
if(activeRight){if(!wasRight&&gap+1<50)wantedDirection=1;}else if(wantedDirection==1)wantedDirection=0;
int wantedBank=activeLeft?Math.min(16,bank+2):activeRight?Math.max(-16,bank-2):bank;
check("controls/tick",field(type,"${f('pk','M','I')}").getInt(session),101);close("controls/heading",plane.${f('o','e','D')},32+(activeLeft?0.75:activeRight?-0.75:0));check("controls/bank",plane.${f('md','i','I')},wantedBank);
check("controls/left-held",field(type,"${f('pk','U','Z')}").getBoolean(session),activeLeft);check("controls/right-held",field(type,"${f('pk','rb','Z')}").getBoolean(session),activeRight);
check("controls/left-press",field(type,"${f('pk','T','I')}").getInt(session),activeLeft&&!wasLeft?101:100-gap);check("controls/right-press",field(type,"${f('pk','ib','I')}").getInt(session),activeRight&&!wasRight?101:100-gap);
check("controls/double-tap",field(type,"${f('pk','mb','I')}").getInt(session),wantedDirection);check("controls/braking",plane.${f('md','p','Z')},wantedDirection!=0);
}
Arrays.fill(${c('lp')}.${f('lp','a','[Z')},false);
for(int key:new int[]{0,82,83,84})for(boolean latched:new boolean[]{false,true})for(int heat:new int[]{0,100,101,200})for(boolean priorFire:new boolean[]{false,true}){
${c('pk')} session=flightFixture(new ${c('gb')}(1,15,0,100,6,8,16,12,0));${c('md')} plane=(${c('md')})field(type,"${f('pk','X','Lmd;')}").get(session);
${c('lp')}.${f('lp','a','[Z')}[82]=key==82||key==84;${c('lp')}.${f('lp','a','[Z')}[83]=key==83||key==84;
field(type,"${f('pk','B','Z')}").setBoolean(session,latched);plane.${f('md','j','I')}=heat;plane.${f('md','l','Z')}=priorFire;
call(session,"${m('pk','b','(B)V')}",new Class<?>[]{byte.class},(byte)-13);boolean wantedLatch=key!=0&&(latched||heat>100);
check("controls/fire-latch",field(type,"${f('pk','B','Z')}").getBoolean(session),wantedLatch);check("controls/fire-request",plane.${f('md','l','Z')},key==0?priorFire:!wantedLatch);
}
${c('pk')} attract=flightFixture(new ${c('gb')}(1,15,0,100,6,8,16,12,0));field(type,"${f('pk','yb','Z')}").setBoolean(attract,true);field(type,"${f('pk','M','I')}").setInt(attract,10);call(attract,"${m('pk','b','(B)V')}",new Class<?>[]{byte.class},(byte)-13);check("controls/attract-tick",field(type,"${f('pk','M','I')}").getInt(attract),11);
Arrays.fill(${c('lp')}.${f('lp','a','[Z')},false);
}
static void silentFlightAudio(){
${c('tk')}.${f('tk','f','I')}=22050;${c('qn')}.${f('qn','b','Ltp;')}=new ${c('tp')}();${c('di')}.${f('di','M','Lkp;')}=new ${c('kp')}();
${c('al')} silent=new ${c('al')}(22050,new byte[8],0,8);${c('lj')}.${f('lj','c','[Lal;')}=new ${c('al')}[8];Arrays.fill(${c('lj')}.${f('lj','c','[Lal;')},silent);${c('uh')}.${f('uh','g','[Lal;')}=new ${c('al')}[7];Arrays.fill(${c('uh')}.${f('uh','g','[Lal;')},silent);${c('wd')}.${f('wd','t','Lkp;')}=new ${c('kp')}();
${c('ci')}.${f('ci','i','Ljava/util/Random;')}=new java.util.Random(12345);
}
static void flightUpgrades()throws Exception{
Class<?> type=${c('pk')}.class;silentFlightAudio();
for(int code:new int[]{0,1,2,3,4,6})for(int level:new int[]{0,11,12})for(int interval:new int[]{1,15})for(int hp:new int[]{0,4}){
${c('gb')} definition=new ${c('gb')}(0.75,interval,4,3,6,8,16,12,0);${c('pk')} session=flightFixture(definition);${c('md')} plane=(${c('md')})field(type,"${f('pk','X','Lmd;')}").get(session);plane.${f('md','k','I')}=hp;
String levelField=code==0?"${f('pk','d','I')}":code==1?"${f('pk','J','I')}":code==2?"${f('pk','x','I')}":"${f('pk','H','I')}";field(type,levelField).setInt(session,level);
field(type,"${f('pk','F','I')}").setInt(session,level==12?6:5);field(type,"${f('pk','V','I')}").setInt(session,level==12?99:98);
boolean accepted=code<4?level!=12&&(code!=1||interval>1):level!=12;
check("upgrade/accepted",call(session,"${m('pk','c','(BI)Z')}",new Class<?>[]{byte.class,int.class},(byte)-14,code),accepted);
if(code<4)check("upgrade/level",field(type,levelField).getInt(session),level+(level==12?0:1));
close("upgrade/max-speed",definition.${f('gb','i','D')},8+(code==0&&accepted?0.4:0));close("upgrade/turn-rate",definition.${f('gb','g','D')},0.75+(code==2&&accepted?0.1:0));
check("upgrade/fire-interval",definition.${f('gb','d','I')},interval-(code==1&&accepted?1:0));check("upgrade/heat-reduction",definition.${f('gb','f','I')},4+(code==1&&accepted?1:0));
check("upgrade/max-hp",definition.${f('gb','e','I')},6+(code==3&&accepted?1:0));check("upgrade/player-hp",plane.${f('md','k','I')},hp+(code==3&&accepted&&hp>0?1:0));
check("upgrade/lives",field(type,"${f('pk','F','I')}").getInt(session),level==12?6:5+(code==4&&accepted?1:0));check("upgrade/multiplier",field(type,"${f('pk','V','I')}").getInt(session),level==12?99:98+(code==6&&accepted?1:0));
}
for(int code:new int[]{0,1,2,3,4,6})for(int credits:new int[]{0,1,10})for(int animation:new int[]{-1,65,500}){
${c('pk')} session=flightFixture(new ${c('gb')}(1,15,0,100,6,8,16,12,0));field(type,"${f('pk','p','I')}").setInt(session,credits);int[] animations=(int[])field(type,"${f('pk','r','[I')}").get(session);animations[code]=animation;
call(session,"${m('pk','a','(II)V')}",new Class<?>[]{int.class,int.class},1,code);check("upgrade/purchase-credit",field(type,"${f('pk','p','I')}").getInt(session),credits>=code+1?credits-code-1:credits);check("upgrade/purchase-animation",animations[code],animation>448?512-animation:animation>64?64:animation);
}
}
static void flightWaves()throws Exception{
Class<?> type=${c('pk')}.class;silentFlightAudio();
${c('gb')}[] classicTypes={${c('kk')}.${f('kk','N','Lgb;')},${c('sl')}.${f('sl','p','Lgb;')},${c('gm')}.${f('gm','y','Lgb;')},${c('qq')}.${f('qq','g','Lgb;')},${c('ju')}.${f('ju','k','Lgb;')},${c('ro')}.${f('ro','u','Lgb;')}};
int[][] compositions={{3,0,0,0,0,0,0},{0,5,2,0,0,0,3},{0,6,0,1,0,0,3},{0,0,0,3,0,0,1},{6,2,0,0,1,0,3},{0,0,0,0,4,1,2}};int[] indices={0,9,10,11,13,20};
for(int fixture=0;fixture<indices.length;fixture++){
${c('pk')} session=flightFixture(${c('gh')}.${f('gh','j','Lgb;')});field(type,"${f('pk','Cb','Z')}").setBoolean(session,false);field(type,"${f('pk','s','I')}").setInt(session,indices[fixture]);
call(session,"${m('pk','f','(I)V')}",new Class<?>[]{int.class},-20416);${c('md')}[] planes=(${c('md')}[])field(type,"${f('pk','A','[Lmd;')}").get(session);int[] counts=new int[6];int carriers=0,total=0;
for(int index=1;index<planes.length;index++)if(planes[index]!=null){${c('md')} plane=planes[index];total++;boolean found=false;
System.out.println("wave/classic-spawn:"+index+":"+plane.${f('o','d','Lkc;')}.${f('kc','a','D')}+":"+plane.${f('o','d','Lkc;')}.${f('kc','b','D')}+":"+plane.${f('o','e','D')}+":"+plane.${f('md','v','I')});
for(int kind=0;kind<6;kind++)if(plane.${f('md','r','Lgb;')}==(kind==3&&indices[fixture]<=10?${c('id')}.${f('id','f','Lgb;')}:classicTypes[kind])){counts[kind]++;found=true;}check("wave/known-definition",found,true);
if(plane.${f('md','v','I')}>=0){carriers++;check("wave/classic-drop-range",plane.${f('md','v','I')}<4,true);}check("wave/x-spawn-range",plane.${f('o','d','Lkc;')}.${f('kc','a','D')}>=1610&&plane.${f('o','d','Lkc;')}.${f('kc','a','D')}<4810,true);check("wave/y-spawn-range",plane.${f('o','d','Lkc;')}.${f('kc','b','D')}>=1220&&plane.${f('o','d','Lkc;')}.${f('kc','b','D')}<3620,true);
}
for(int kind=0;kind<6;kind++)check("wave/classic-count",counts[kind],compositions[fixture][kind]);check("wave/classic-carriers",carriers,Math.min(total,compositions[fixture][6]));
}
${c('gb')}[] arcadeTypes={classicTypes[0],classicTypes[1],classicTypes[3],classicTypes[2],classicTypes[4],classicTypes[5]};int[][] arcadeCounts={{2,0,0,0,0,0},{4,0,0,0,0,0},{3,1,1,0,0,0},{3,1,0,1,1,0}};int[] waveNumbers={1,2,5,10};
for(int fixture=0;fixture<waveNumbers.length;fixture++){
${c('pk')} session=flightFixture(${c('gh')}.${f('gh','j','Lgb;')});call(session,"${m('pk','a','(BI)V')}",new Class<?>[]{byte.class,int.class},(byte)28,waveNumbers[fixture]);int[] counts=new int[6];int carriers=0;
for(${c('md')} plane:(${c('md')}[])field(type,"${f('pk','A','[Lmd;')}").get(session))if(plane!=null&&plane.${f('md','r','Lgb;')}!=${c('gh')}.${f('gh','j','Lgb;')}){
System.out.println("wave/arcade-spawn:"+plane.${f('o','d','Lkc;')}.${f('kc','a','D')}+":"+plane.${f('o','d','Lkc;')}.${f('kc','b','D')}+":"+plane.${f('o','e','D')}+":"+plane.${f('md','v','I')});
for(int kind=0;kind<6;kind++)if(plane.${f('md','r','Lgb;')}==arcadeTypes[kind])counts[kind]++;
if(plane.${f('md','v','I')}>=0){carriers++;check("wave/arcade-drop-range",plane.${f('md','v','I')}<9,true);}
}
for(int kind=0;kind<6;kind++)check("wave/arcade-count",counts[kind],arcadeCounts[fixture][kind]);check("wave/arcade-carriers",carriers,2);
}
for(int value:new int[]{-1,0,1,2,3,4,5,6,99}){
${c('pk')} session=flightFixture(${c('gh')}.${f('gh','j','Lgb;')});check("wave/arcade-definition",call(session,"${m('pk','b','(BI)Lgb;')}",new Class<?>[]{byte.class,int.class},(byte)108,value)==arcadeTypes[value>=0&&value<6?value:0],true);
}
${c('pk')} session=flightFixture(${c('gh')}.${f('gh','j','Lgb;')});check("wave/negative-remaining-drop-budget",call(session,"${m('pk','a','(BLgb;II)I')}",new Class<?>[]{byte.class,${c('gb')}.class,int.class,int.class},(byte)-120,classicTypes[0],2,0),-2);
System.out.println("wave/random-state:"+${c('ci')}.${f('ci','i','Ljava/util/Random;')}.nextLong());
}
static void hudMessageTiming()throws Exception{
for(int hold:new int[]{0,1,150,300}){
${c('tb')} message=new ${c('tb')}("message",0x123456,hold);
check("message/fade-in",field(${c('tb')}.class,"${f('tb','f','I')}").getInt(message),20);check("message/fade-out",field(${c('tb')}.class,"${f('tb','l','I')}").getInt(message),80);check("message/hold",field(${c('tb')}.class,"${f('tb','h','I')}").getInt(message),hold);
for(int tick=1;tick<=hold+102;tick++)check("message/expiry",message.${m('tb','a','(I)Z')}(100),tick>hold+100);
}
}


static ${c('pk')} visualFixture()throws Exception{
${c('pk')} session=flightFixture(${c('gh')}.${f('gh','j','Lgb;')});field(${c('pk')}.class,"${f('pk','R','I')}").setInt(session,200);field(${c('pk')}.class,"${f('pk','C','[Lok;')}").set(session,new ${c('ok')}[0]);${c('or')}.${f('or','a','I')}=0;${c('wd')}.${f('wd','t','Lkp;')}=new ${c('kp')}();return session;
}
static void visualParticles()throws Exception{
Class<?> sessionType=${c('pk')}.class;${c('gb')} originalDefinition=${c('gh')}.${f('gh','j','Lgb;')};${c('gh')}.${f('gh','j','Lgb;')}=new ${c('gb')}(1,15,0,100,6,8,16,12,0);
try{
${c('ok')} particle=new ${c('ok')}();particle.${f('ok','c','I')}=-11;particle.${f('ok','g','I')}=-22;
Class<?>[] ints=new Class<?>[13];Arrays.fill(ints,int.class);
call(particle,"${m('ok','a','(IIIIIIIIIIIII)V')}",ints,3,-2,13,256,-5,17,512,0,1024,4,0,-7,255);
check("particle/initializer-x",particle.${f('ok','k','I')},512);check("particle/initializer-y",particle.${f('ok','n','I')},1024);check("particle/initializer-radius",particle.${f('ok','m','I')},256);check("particle/initializer-mode",particle.${f('ok','e','I')},0);check("particle/initializer-alpha",particle.${f('ok','p','I')},255);check("particle/initializer-keeps-previous",particle.${f('ok','c','I')},-11);
${c('pk')} session=visualFixture();field(sessionType,"${f('pk','C','[Lok;')}").set(session,new ${c('ok')}[]{particle});field(sessionType,"${f('pk','K','I')}").setInt(session,1);
for(int tick=1;tick<=6;tick++){call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);int steps=Math.min(tick,5),prior=steps-1;
check("particle/age",particle.${f('ok','h','I')},steps);check("particle/count",field(sessionType,"${f('pk','K','I')}").getInt(session),tick<=4?1:0);
check("particle/x",particle.${f('ok','k','I')},512+17*steps-7*steps*(steps-1)/2);check("particle/y",particle.${f('ok','n','I')},1024+13*steps+3*steps*(steps-1)/2);check("particle/radius",particle.${f('ok','m','I')},256-5*steps-2*steps*(steps-1)/2);
check("particle/previous-x",particle.${f('ok','c','I')},512+17*prior-7*prior*(prior-1)/2);check("particle/previous-y",particle.${f('ok','g','I')},1024+13*prior+3*prior*(prior-1)/2);
check("particle/x-velocity",particle.${f('ok','b','I')},17-7*steps);check("particle/y-velocity",particle.${f('ok','i','I')},13+3*steps);check("particle/radius-velocity",particle.${f('ok','l','I')},-5-2*steps);
}
for(int seed:new int[]{0,1,12345})for(int spread:new int[]{8,16}){
${c('ci')}.${f('ci','i','Ljava/util/Random;')}=new java.util.Random(seed);particle=new ${c('ok')}();particle.${m('ok','a','(IIIIIII)V')}(3,512,spread,20,1024,256,-1588713311);
check("burst/x",particle.${f('ok','k','I')},512);check("burst/y",particle.${f('ok','n','I')},1024);check("burst/radius",particle.${f('ok','m','I')},256);check("burst/previous-x",particle.${f('ok','c','I')},512);check("burst/previous-y",particle.${f('ok','g','I')},1024);check("burst/age",particle.${f('ok','h','I')},0);check("burst/duration",particle.${f('ok','d','I')},20);check("burst/alpha",particle.${f('ok','p','I')},255);
check("burst/y-velocity-range",particle.${f('ok','i','I')}>=-2*spread&&particle.${f('ok','i','I')}<spread/2,true);check("burst/x-velocity-range",particle.${f('ok','b','I')}>=-spread&&particle.${f('ok','b','I')}<spread,true);
System.out.println("burst/seeded-velocity:"+particle.${f('ok','b','I')}+":"+particle.${f('ok','i','I')}+":"+${c('ci')}.${f('ci','i','Ljava/util/Random;')}.nextLong());
}
particle.${m('ok','a','(IZIIIII)V')}(2048,false,3,5,256,128,4096);
check("growing/initial-age",particle.${f('ok','h','I')},-3);check("growing/mode",particle.${f('ok','e','I')},1);check("growing/retained-previous-x",particle.${f('ok','c','I')},512);check("growing/retained-previous-y",particle.${f('ok','g','I')},1024);
session=visualFixture();field(sessionType,"${f('pk','C','[Lok;')}").set(session,new ${c('ok')}[]{particle});field(sessionType,"${f('pk','K','I')}").setInt(session,1);
for(int tick=1;tick<=7;tick++){call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);check("growing/age",particle.${f('ok','h','I')},-3+tick);check("growing/count",field(sessionType,"${f('pk','K','I')}").getInt(session),tick<7?1:0);check("growing/y",particle.${f('ok','n','I')},4096-40*tick);check("growing/radius",particle.${f('ok','m','I')},256+5*tick);}
${c('ok')}[] particles={new ${c('ok')}(),new ${c('ok')}(),new ${c('ok')}()};for(int i=0;i<3;i++){particles[i].${f('ok','d','I')}=i==1?2:0;particles[i].${f('ok','b','I')}=1;}
session=visualFixture();field(sessionType,"${f('pk','C','[Lok;')}").set(session,particles);field(sessionType,"${f('pk','K','I')}").setInt(session,3);${c('ok')} first=particles[0],middle=particles[1],last=particles[2];call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);
check("particle/swap-count",field(sessionType,"${f('pk','K','I')}").getInt(session),1);check("particle/swap-active",particles[0]==middle,true);check("particle/swap-retains-last",particles[1]==last,true);check("particle/swap-retains-first",particles[2]==first,true);for(${c('ok')} p:particles)check("particle/removed-still-integrates",p.${f('ok','k','I')},1);
session=visualFixture();field(sessionType,"${f('pk','C','[Lok;')}").set(session,new ${c('ok')}[1]);field(sessionType,"${f('pk','K','I')}").setInt(session,1);
try{call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);throw new AssertionError("null particle");}catch(InvocationTargetException error){check("particle/null-wrap",error.getCause() instanceof ${c('ak')},true);Object cause=field(${c('ak')}.class,"${f('ak','c','Ljava/lang/Throwable;')}").get(error.getCause());check("particle/null-cause",cause instanceof NullPointerException,true);check("particle/null-count-before-failure",field(sessionType,"${f('pk','K','I')}").getInt(session),0);}
${c('es')}.${f('es','b','[Lpa;')}=new ${c('pa')}[4];${c('co')}.${f('co','i','[Lpa;')}=new ${c('pa')}[4];${c('ci')}.${f('ci','i','Ljava/util/Random;')}=new java.util.Random(345);java.util.Random reference=new java.util.Random(345);
${c('qf')} smoke=new ${c('qf')}();${c('kc')} position=new ${c('kc')}(-9,12.5);smoke.${m('qf','a','(ILkc;II)V')}(-32,position,0x445566,20);position.${m('kc','a','(DDZ)V')}(99,99,true);
check("smoke/initial-age",smoke.${f('qf','i','I')},10);check("smoke/lifetime",smoke.${f('qf','g','I')},20);check("smoke/normal-depth",smoke.${f('qf','j','I')},92);check("smoke/colour",smoke.${f('qf','l','I')},0x445566);check("smoke/sprite",smoke.${f('qf','h','I')},(int)(Integer.toUnsignedLong(reference.nextInt())*4>>>32));close("smoke/copied-x",smoke.${f('o','d','Lkc;')}.${f('kc','a','D')},-9);
smoke.${m('qf','a','(IIIILkc;)V')}(30,122,-48,12,position);check("smoke/depth-age",smoke.${f('qf','i','I')},10);check("smoke/depth",smoke.${f('qf','j','I')},12);check("smoke/blast-code",smoke.${f('qf','l','I')},-48);reference.nextInt();check("smoke/rng",${c('ci')}.${f('ci','i','Ljava/util/Random;')}.nextLong(),reference.nextLong());
${c('qf')}[] clouds=new ${c('qf')}[3];for(int i=0;i<3;i++){clouds[i]=new ${c('qf')}();clouds[i].${m('qf','a','(ILkc;II)V')}(-32,new ${c('kc')}(10,20),0x777777,15+5*i);}
session=visualFixture();field(sessionType,"${f('pk','n','[Lqf;')}").set(session,clouds.clone());field(sessionType,"${f('pk','w','I')}").setInt(session,3);
for(int tick=1;tick<=4;tick++){call(session,"${m('pk','a','(Lkc;I)V')}",new Class<?>[]{${c('kc')}.class,int.class},new ${c('kc')}(1,2),4473924);check("smoke/expiry-count",field(sessionType,"${f('pk','w','I')}").getInt(session),Math.max(0,3-tick));for(int i=0;i<3;i++){int steps=Math.min(tick,i+1);check("smoke/advancing-age",clouds[i].${f('qf','i','I')},10+5*steps);close("smoke/camera-x",clouds[i].${f('o','d','Lkc;')}.${f('kc','a','D')},10-steps);close("smoke/camera-y",clouds[i].${f('o','d','Lkc;')}.${f('kc','b','D')},20-2*steps);}}
session=visualFixture();${c('vc')}[] marks=new ${c('vc')}[2];field(sessionType,"${f('pk','z','[Lvc;')}").set(session,marks);${c('ci')}.${f('ci','i','Ljava/util/Random;')}=new java.util.Random(123);reference=new java.util.Random(123);
for(int i=0;i<2;i++){call(session,"${m('pk','a','(IIII)V')}",new Class<?>[]{int.class,int.class,int.class,int.class},20+i,-14630,10+i,48+i);check("scorch/x",marks[i].${f('vc','b','I')},10+i);check("scorch/y",marks[i].${f('vc','d','I')},20+i);check("scorch/diameter",marks[i].${f('vc','e','I')},48+i);check("scorch/sprite",marks[i].${f('vc','c','I')},(int)(Integer.toUnsignedLong(reference.nextInt())*4>>>32));}
call(session,"${m('pk','a','(IIII)V')}",new Class<?>[]{int.class,int.class,int.class,int.class},999,-14630,999,999);check("scorch/full-count",field(sessionType,"${f('pk','l','I')}").getInt(session),2);check("scorch/full-preserves-rng",${c('ci')}.${f('ci','i','Ljava/util/Random;')}.nextLong(),reference.nextLong());
${c('vc')} removed=marks[0],tail=marks[1];call(session,"${m('pk','f','(II)V')}",new Class<?>[]{int.class,int.class},0,10355);check("scorch/swapped",marks[0]==tail&&marks[1]==removed,true);
field(sessionType,"${f('pk','t','D')}").setDouble(session,20);field(sessionType,"${f('pk','Y','D')}").setDouble(session,30);field(sessionType,"${f('pk','fb','I')}").setInt(session,2);field(sessionType,"${f('pk','O','I')}").setInt(session,-1);${c('md')} plane=(${c('md')})field(sessionType,"${f('pk','X','Lmd;')}").get(session);
call(session,"${m('pk','a','(Lmd;I)V')}",new Class<?>[]{${c('md')}.class,int.class},plane,8073);check("scorch/reuses-mark",marks[1]==removed,true);check("scorch/aircraft-ground-x",marks[1].${f('vc','b','I')},3423);check("scorch/aircraft-ground-y",marks[1].${f('vc','d','I')},-1304);check("scorch/aircraft-diameter",marks[1].${f('vc','e','I')},48);
}finally{${c('gh')}.${f('gh','j','Lgb;')}=originalDefinition;}
}
static void hudAndSpatialState()throws Exception{
Class<?> type=${c('pk')}.class;${c('gb')} originalDefinition=${c('gh')}.${f('gh','j','Lgb;')};${c('gh')}.${f('gh','j','Lgb;')}=new ${c('gb')}(1,15,0,100,6,8,16,12,0);
try{
for(int heat:new int[]{0,99,100,101,200})for(int displayed:new int[]{0,25,200})for(int weapon:new int[]{0,1})for(int alpha:new int[]{0,8,247,255}){
${c('pk')} session=visualFixture();${c('md')} plane=(${c('md')})field(type,"${f('pk','X','Lmd;')}").get(session);plane.${f('md','j','I')}=heat;plane.${f('md','m','I')}=weapon;field(type,"${f('pk','a','I')}").setInt(session,displayed);field(type,"${f('pk','bb','I')}").setInt(session,alpha);call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);
check("hud/smoothed-heat",field(type,"${f('pk','a','I')}").getInt(session),(heat+displayed-(heat>=100?100:0))>>1);check("hud/weapon-opacity",field(type,"${f('pk','bb','I')}").getInt(session),weapon>0?Math.min(255,alpha+8):Math.max(0,alpha-8));
}
for(int hp:new int[]{0,3,6,8})for(int displayed:new int[]{0,50,100}){
${c('pk')} session=visualFixture();${c('md')} plane=(${c('md')})field(type,"${f('pk','X','Lmd;')}").get(session);plane.${f('md','k','I')}=hp;field(type,"${f('pk','eb','I')}").setInt(session,displayed);call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);int difference=displayed-hp*100/6,wanted=difference>0?displayed-1-(difference>>4):difference<0?displayed-((difference>>4)-1):displayed;check("hud/smoothed-health",field(type,"${f('pk','eb','I')}").getInt(session),wanted);
}
for(int current:new int[]{0,1,100})for(int displayed:new int[]{0,37,200}){
${c('pk')} session=visualFixture();${c('md')} plane=(${c('md')})field(type,"${f('pk','X','Lmd;')}").get(session);plane.${f('md','x','I')}=current;field(type,"${f('pk','qb','I')}").setInt(session,displayed);call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);check("hud/smoothed-weapon-time",field(type,"${f('pk','qb','I')}").getInt(session),(current+displayed)>>1);
}
for(int phase:new int[]{0,1,2,20}){
${c('pk')} session=visualFixture();${c('or')}.${f('or','a','I')}=50;field(type,"${f('pk','N','I')}").setInt(session,10);field(type,"${f('pk','nb','I')}").setInt(session,30);field(type,"${f('pk','cb','I')}").setInt(session,phase);field(type,"${f('pk','v','I')}").setInt(session,10);field(type,"${f('pk','f','I')}").setInt(session,30);field(type,"${f('pk','p','I')}").setInt(session,50);field(type,"${f('pk','Db','I')}").setInt(session,phase);field(type,"${f('pk','P','I')}").setInt(session,10);field(type,"${f('pk','tb','I')}").setInt(session,30);field(type,"${f('pk','V','I')}").setInt(session,50);field(type,"${f('pk','Q','I')}").setInt(session,phase);
call(session,"${m('pk','c','(I)V')}",new Class<?>[]{int.class},-115);int wantedPhase=phase==0?20:phase-1,wantedValue=phase==1?30:10,wantedTarget=phase==0?50:30;
for(String name:new String[]{"${f('pk','cb','I')}","${f('pk','Db','I')}","${f('pk','Q','I')}"})check("hud/animation-phase",field(type,name).getInt(session),wantedPhase);
for(String name:new String[]{"${f('pk','N','I')}","${f('pk','v','I')}","${f('pk','P','I')}"})check("hud/settled-value",field(type,name).getInt(session),wantedValue);
for(String name:new String[]{"${f('pk','nb','I')}","${f('pk','f','I')}","${f('pk','tb','I')}"})check("hud/target-snapshot",field(type,name).getInt(session),wantedTarget);
check("hud/affordability-snapshot",field(type,"${f('pk','y','I')}").getInt(session),50);
}
${c('pk')} session=visualFixture();${c('kc')} listener=new ${c('kc')}(0,0);
for(double scale:new double[]{0,599,600,601,800,999,1000,1600})for(double distance:new double[]{0,5,10,10.9,11,999,1000,1001}){
field(type,"${f('pk','kb','D')}").setDouble(session,scale);int base=scale<=600?0:scale<1000?(int)(200*(scale-600)/400):200,whole=(int)distance;int wanted=whole>1000?0:whole>10?base*(1000-whole)/990:base;
check("audio/spatial-volume",call(session,"${m('pk','a','(Lkc;ILkc;)I')}",new Class<?>[]{${c('kc')}.class,int.class,${c('kc')}.class},listener,200,new ${c('kc')}(distance,0)),wanted);
check("audio/identity-volume",call(session,"${m('pk','a','(Lkc;ILkc;)I')}",new Class<?>[]{${c('kc')}.class,int.class,${c('kc')}.class},null,200,null),base);
}
${c('ek')}.${f('ek','u','Lkc;')}=new ${c('kc')}();${c('kp')}.${f('kp','d','Lkc;')}=new ${c('kc')}();${c('md')} source=new ${c('md')}(new ${c('kc')}(),${c('gh')}.${f('gh','j','Lgb;')}),target=new ${c('md')}(new ${c('kc')}(),${c('gh')}.${f('gh','j','Lgb;')});
for(double distance:new double[]{0,10,100,1000})for(int heading:new int[]{0,64,128,192})for(int otherHeading:new int[]{0,64,128,192})for(double speed:new double[]{0,4,12}){
source.${f('o','e','D')}=heading;target.${f('o','e','D')}=otherHeading;source.${f('o','b','D')}=speed;target.${f('o','b','D')}=4;target.${f('o','d','Lkc;')}.${m('kc','a','(DDZ)V')}(distance,0,true);double radial=distance*(speed*Math.sin(heading*Math.PI/128)-4*Math.sin(otherHeading*Math.PI/128));int shift=(int)(500*radial/(distance*distance)),wanted=256-Math.max(-100,Math.min(100,shift));
check("audio/doppler-step",call(session,"${m('pk','a','(Lmd;ILmd;)I')}",new Class<?>[]{${c('md')}.class,int.class,${c('md')}.class},source,5000,target),wanted);
}
check("audio/doppler-identity",call(session,"${m('pk','a','(Lmd;ILmd;)I')}",new Class<?>[]{${c('md')}.class,int.class,${c('md')}.class},null,5000,null),256);
for(double scale:new double[]{0.1,0.5,1,2,4})for(int phase:new int[]{-1,0,1,30,91,92,93}){double wanted=phase==92?scale:1/(3-(3-1/scale)*phase/92);close("render/phase-scale",(Double)call(session,"${m('pk','a','(BID)D')}",new Class<?>[]{byte.class,int.class,double.class},(byte)-125,phase,scale),wanted);}
for(int front:new int[]{0,-1,0x12345678,0xff00ff00,0x80ff00ff})for(int back:new int[]{0,-1,0x12345678,0xff00ff00,0x80ff00ff})for(int weight:new int[]{-1,0,1,64,128,255,256,300})for(int mask:new int[]{0xff00ff,0xddff00ff,0}){
int wanted=weight<=0?back:weight>=256?front:0;if(weight>0&&weight<256){int[] widths={24,16,8,0};for(int shift:widths){int channel=(((front>>>shift)&255)*weight+((back>>>shift)&255)*(256-weight))>>>8;int bits=channel<<shift;if(shift==16||shift==0)bits&=mask;wanted|=bits;}}
check("render/argb-blend",call(session,"${m('pk','b','(IIII)I')}",new Class<?>[]{int.class,int.class,int.class,int.class},weight,front,mask,back),wanted);
}
}finally{${c('gh')}.${f('gh','j','Lgb;')}=originalDefinition;}
}

${highscoreProbe(c, f, m)}
public static void main(String[] args)throws Exception{Field u=Unsafe.class.getDeclaredField("theUnsafe");u.setAccessible(true);unsafe=(Unsafe)u.get(null);vectors();flight();packets();deques();aircraft();sharedCollectionsAndSoundCache();fontMetricsAndPixels();pools();menus();highscores();flightControls();flightUpgrades();flightWaves();hudMessageTiming();visualParticles();hudAndSpatialState();System.out.println("checks:"+checks);}
}
`);
    const root = readable ? named : input, argsFile = path.join(directory, 'sources.args');
    fs.writeFileSync(argsFile, sourceInventory(root).map(file => JSON.stringify(path.join(root, file.path))).join('\n') + '\n');
    captureProcess('javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-sourcepath', '', '-classpath', classpath, '-d', compiled, '@' + argsFile]);
    captureProcess('javac', ['-encoding', 'UTF-8', '-classpath', compiled, '-d', compiled, harness]);
    const trace = captureProcess('java', ['-Djava.awt.headless=true', '-cp', [shims, compiled, classpath].join(path.delimiter), 'AceCoreProbe']).stdout;
    if (!readable) {
      const historical = path.join(directory, 'historical'); fs.mkdirSync(historical);
      captureProcess('javac', ['--release', '8', '-proc:none', '-sourcepath', '', '-classpath', [compiled, classpath].join(path.delimiter),
        '-d', historical, path.join(temporary, 'original-pk.java')]);
      const priorTrace = captureProcess('java', ['-Djava.awt.headless=true', '-cp', [shims, historical, compiled, classpath].join(path.delimiter), 'AceCoreProbe']).stdout;
      assert.deepEqual(trace, priorTrace, 'Reconstructed Ace core differs from the historical pinned Java');
    }
    outputs.push(trace);
  }
  assert.deepEqual(outputs[1], outputs[0], 'Named Ace core differs from pinned raw Java');
  const checks = Number(outputs[0].toString().trimEnd().split('\n').at(-1).split(':')[1]);
  assert.ok(checks > 1500);
  return {checks, rawNamedIdentical: true, historicalSourceCoreIdentical: true, independentExpectations: true,
    headlessClientBoundary: true, vectorAndFlightFixtures: true, packetAndDequeFixtures: true,
    aircraftAndBulletSpawnFixtures: true, poolReplacementFixtures: true, menuInputAndGeometryFixtures: true, highscoreProtocolFixtures: true, flightControlsUpgradesAndWavesFixtures: true, hudMessageTimingFixtures: true, exactSeededWaveTrace: true, visualParticleHudAndSpatialFixtures: true,
    sharedHashTableDualLinksAndSoundCacheFixtures: true, softwareFontMetricsWrappingAndPixelFixtures: true, traceSha256: digest(outputs[0]),
    ...(extraVerification ? extraVerification(path.join(temporary, 'raw-core/classes')) : {})};
}
