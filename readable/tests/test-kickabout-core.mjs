import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';

// Independent rectangular pixel grids distinguish copying from mutation and
// horizontal reflection from vertical reflection and clockwise rotation.
export function verifyKickaboutCore(input, named, mapping, classpath, temporary) {
  const aliases=new Map(mapping.rules.map(r=>[r.symbol,r.to]));
  const symbols=new Set(mapping.symbols.map(r=>r.symbol));
  const outputs=[];
  for(const readable of [false,true]) {
    const c=owner=>readable?(aliases.get('C:'+owner)||owner):owner;
    const member=(kind,owner,original,descriptor)=>{
      const originalName=(kind==='F'?'field_':'')+original;
      const key=`${kind}:${owner}.${originalName}${kind==='F'?':':''}${descriptor}`;
      assert.ok(symbols.has(key),'Missing probe identity: '+key);
      return readable?(aliases.get(key)||originalName):originalName;
    };
    const m=(owner,name,descriptor)=>member('M',owner,name,descriptor);
    const f=(owner,name,descriptor)=>member('F',owner,name,descriptor);
    const sprite=c('ut'),request=c('kw'),category=c('tc'),buffer=c('iw');
    const pixels=f('ut','y','[I'),width=f('lu','q','I'),height=f('lu','w','I');
    const offsetX=f('lu','s','I'),offsetY=f('lu','n','I');
    const directory=path.join(temporary,readable?'kickabout-named-core':'kickabout-raw-core');
    fs.mkdirSync(directory);
    const harness=path.join(directory,'KickaboutCoreProbe.java');
    fs.writeFileSync(harness,`import java.util.*;
import java.time.YearMonth;
import java.lang.reflect.*;
public class KickaboutCoreProbe {
  static int checks;
  static void check(String label,Object actual,Object expected) {
    if(!Objects.deepEquals(actual,expected))throw new AssertionError(label+": "+actual+" != "+expected);
    checks++;
  }
  static ${sprite} grid(int w,int h) {
    ${sprite} s=new ${sprite}(w,h);
    for(int i=0;i<s.${pixels}.length;i++)s.${pixels}[i]=i+1;
    return s;
  }
  static int[] horizontal(int w,int h) {
    int[] result=new int[w*h];
    for(int y=0;y<h;y++)for(int x=0;x<w;x++)result[y*w+x]=y*w+(w-1-x)+1;
    return result;
  }
  static int[] vertical(int w,int h) {
    int[] result=new int[w*h];
    for(int y=0;y<h;y++)for(int x=0;x<w;x++)result[y*w+x]=(h-1-y)*w+x+1;
    return result;
  }
  static int[] clockwise(int w,int h) {
    int[] result=new int[w*h];
    for(int y=0;y<h;y++)for(int x=0;x<w;x++)result[x*h+(h-1-y)]=y*w+x+1;
    return result;
  }
  static void sprites() {
    for(int[] size:new int[][]{{2,3},{3,2},{1,4},{1,1},{0,0}}) {
      int w=size[0],h=size[1];${sprite} s=grid(w,h);int[] original=s.${pixels}.clone();
      ${sprite} copy=s.${m('ut','f','()Lut;')}();
      check("copy pixels",copy.${pixels},horizontal(w,h));
      check("copy leaves original",s.${pixels},original);
      check("copy owns pixels",copy.${pixels}!=s.${pixels},true);
      s.${m('ut','g','()V')}();check("in-place horizontal",s.${pixels},horizontal(w,h));
      s.${m('ut','g','()V')}();check("horizontal involution",s.${pixels},original);
      s=grid(w,h);s.${m('ut','a','()V')}();check("vertical",s.${pixels},vertical(w,h));
      s.${m('ut','a','()V')}();check("vertical involution",s.${pixels},original);
      s=grid(w,h);s.${m('ut','d','()V')}();check("clockwise",s.${pixels},clockwise(w,h));
      check("rotated width",s.${width},h);check("rotated height",s.${height},w);
    }
    ${sprite} trimmed=new ${sprite}(8,9,1,2,2,3,new int[]{1,2,3,4,5,6});
    ${sprite} copy=trimmed.${m('ut','f','()Lut;')}();
    check("copy mirrored offset",copy.${offsetX},5);check("copy original offset",trimmed.${offsetX},1);
    trimmed.${m('ut','g','()V')}();check("mirrored offset",trimmed.${offsetX},5);
    trimmed.${m('ut','a','()V')}();check("vertical offset",trimmed.${offsetY},4);
    trimmed=new ${sprite}(8,9,1,2,2,3,new int[]{1,2,3,4,5,6});
    trimmed.${m('ut','d','()V')}();check("rotated offset x",trimmed.${offsetX},4);
    check("rotated offset y",trimmed.${offsetY},1);
    check("rotated trim width",trimmed.${width},3);check("rotated trim height",trimmed.${height},2);
    check("rotated canvas width",trimmed.${f('lu','o','I')},9);
    check("rotated canvas height",trimmed.${f('lu','v','I')},8);
  }
  static void requests() {
    for(String query:new String[]{null,"","member@example.invalid","a\\u00e9"}) {
      ${request} r=new ${request}(query);
      check("query",r.${m('kw','a','(I)Ljava/lang/String;')}(3),query);
      check("initial completion",r.${m('kw','a','(B)Z')}((byte)-80),false);
      check("initial result",r.${m('kw','b','(B)Z')}((byte)-90),false);
      r.${m('kw','a','(ZB)V')}(true,(byte)-90);
      check("completion",r.${m('kw','a','(B)Z')}((byte)-80),true);
      check("true result",r.${m('kw','b','(B)Z')}((byte)-90),true);
      r.${m('kw','a','(ZB)V')}(false,(byte)-90);
      check("false result",r.${m('kw','b','(B)Z')}((byte)-90),false);
      check("query retained",r.${m('kw','a','(I)Ljava/lang/String;')}(3),query);
    }
  }
  static void dates() {
    for(int year:new int[]{1899,1900,1999,2000,2024,2100}) {
      for(int month=0;month<12;month++) {
        int length=YearMonth.of(year,month+1).lengthOfMonth();
        for(int day:new int[]{0,1,28,29,30,31,32}) {
          check("calendar "+year+"/"+month+"/"+day,
            ${c('cl')}.${m('cl','a','(ZIII)Z')}(true,year,day,month),day>=1&&day<=length);
        }
      }
    }
    for(int month:new int[]{-1,12,99})
      check("invalid month",${c('cl')}.${m('cl','a','(ZIII)Z')}(true,2024,1,month),false);
  }
  static void categories() {
    ${category} empty=new ${category}();
    empty.${m('tc','a','(Liw;I)V')}(new ${buffer}(new byte[]{0}),0);
    check("empty category text",empty.${f('tc','r','Ljava/lang/String;')},null);
    check("empty category children",empty.${f('tc','o','[I')},null);
    empty.${m('tc','a','(I)V')}(-104);
    // A nonzero byte after the terminator checks that decode consumes one record.
    ${buffer} input=new ${buffer}(new byte[]{1,72,105,0,2,2,0,7,65,1,2,0,3,1,1,44,66,4,0,99});
    ${category} value=new ${category}();
    value.${m('tc','a','(Liw;I)V')}(input,0);
    check("category description",value.${f('tc','r','Ljava/lang/String;')},"Hi");
    check("child IDs",value.${f('tc','o','[I')},new int[]{7,258});
    check("child shortcuts",value.${f('tc','q','[C')},new char[]{'A',0});
    check("phrase IDs",value.${f('tc','n','[I')},new int[]{300});
    check("phrase shortcuts",value.${f('tc','p','[C')},new char[]{'B'});
    check("tag 4",value.${f('tc','t','Z')},true);
    check("record boundary",input.${m('iw','h','(B)I')}((byte)-120),99);
    value.${m('tc','a','(I)V')}(-104);
    check("global child IDs",value.${f('tc','o','[I')},new int[]{32775,33026});
    check("global phrase IDs",value.${f('tc','n','[I')},new int[]{33068});
    value.${m('tc','a','(I)V')}(-104);
    check("global IDs idempotent",value.${f('tc','o','[I')},new int[]{32775,33026});
    ${category} onlyChildren=new ${category}();
    onlyChildren.${m('tc','a','(Liw;I)V')}(new ${buffer}(new byte[]{2,1,0,9,0,0}),0);
    onlyChildren.${m('tc','a','(I)V')}(-104);
    check("children without phrases",onlyChildren.${f('tc','o','[I')},new int[]{32777});
  }
  static ${c('vm')} sampleStream(int step,int pan) {
    ${c('to')} sample=new ${c('to')}(22050,new byte[]{1,-2,3,-4},0,4);
    return ${c('vm')}.${m('vm','b','(Lto;III)Lvm;')}(sample,step,64,pan);
  }
  static void audio() throws Exception {
    for(int rate:new int[]{7999,48001}) {
      boolean rejected=false;
      try {${c('uh')}.${m('uh','a','(IZI)V')}(rate,false,0);}
      catch(IllegalArgumentException expected) {rejected=true;}
      check("invalid sample rate",rejected,true);
    }
    ${c('uh')}.${m('uh','a','(IZI)V')}(22050,false,0);
    ${c('vm')} forward=sampleStream(256,8192);
    int[] mono=new int[6];mono[0]=17;mono[5]=19;
    forward.${m('vm','a','([III)V')}(mono,1,4);
    check("mono PCM and untouched bounds",mono,new int[]{17,256,-512,768,-1024,19});
    check("sample position",forward.${m('vm','g','()I')}(),4);
    ${c('vm')} reverse=sampleStream(256,8192);
    reverse.${m('vm','i','(I)V')}(3<<8);
    reverse.${m('vm','a','(Z)V')}(true);
    int[] backwards=new int[4];reverse.${m('vm','a','([III)V')}(backwards,0,4);
    check("reverse PCM",backwards,new int[]{-1024,768,-512,256});
    ${c('vm')} inactive=sampleStream(256,8192);
    inactive.${f('lq','e','Z')}=false;
    int[] silent={7,9};inactive.${m('lq','b','([III)V')}(silent,0,2);
    check("inactive stream preserves destination",silent,new int[]{7,9});
    check("inactive stream advances",inactive.${m('vm','g','()I')}(),2);
    inactive.${f('lq','e','Z')}=true;
    int[] tail=new int[2];inactive.${m('lq','b','([III)V')}(tail,0,2);
    check("resumed stream position",tail,new int[]{768,-1024});
    ${c('vm')} controls=sampleStream(256,8192);
    controls.${m('vm','b','(I)V')}(96);
    check("internal volume",controls.${m('vm','m','()I')}(),96);
    check("volume preserves pan",controls.${m('vm','k','()I')}(),8192);
    controls.${m('vm','c','(II)V')}(8,128);
    check("gain ramp pending",controls.${m('vm','n','()Z')}(),true);
    Method cancelRamp=${c('vm')}.class.getDeclaredMethod("${m('vm','l','()V')}");
    cancelRamp.setAccessible(true);cancelRamp.invoke(controls);
    check("ramp cancelled",controls.${m('vm','n','()Z')}(),false);
    check("cancel snaps to target",controls.${m('vm','m','()I')}(),128);
    ${c('gq')} mixer=new ${c('gq')}();
    mixer.${m('gq','a','(Llq;)V')}(sampleStream(256,8192));
    mixer.${m('gq','a','(Llq;)V')}(sampleStream(256,8192));
    int[] mixed=new int[4];mixer.${m('gq','a','([III)V')}(mixed,0,4);
    check("two stream sum",mixed,new int[]{512,-1024,1536,-2048});
    ${c('to')} empty=new ${c('to')}(22050,new byte[0],0,0);
    check("empty sample",${c('vm')}.${m('vm','b','(Lto;III)Lvm;')}(empty,256,64,8192),null);
    ${c('uh')}.${m('uh','a','(IZI)V')}(22050,true,0);
    for(int pan:new int[]{8192,0,-1}) {
      ${c('vm')} stereo=sampleStream(256,pan);
      int[] actual=new int[8];stereo.${m('vm','a','([III)V')}(actual,0,4);
      int[] expected=pan==8192?new int[]{256,256,-512,-512,768,768,-1024,-1024}:
        pan==0?new int[]{364,0,-728,0,1092,0,-1456,0}:
        new int[]{256,-256,-512,512,768,-768,-1024,1024};
      check("stereo pan "+pan,actual,expected);
      check("stored pan "+pan,stereo.${m('vm','k','()I')}(),pan<0?-1:pan);
    }
    ${c('uh')}.${m('uh','a','(IZI)V')}(22050,false,0);
  }
  static int[] midiValues(${c('ru')} midi,String name) throws Exception {
    Field field=${c('ru')}.class.getDeclaredField(name);field.setAccessible(true);
    return (int[])field.get(midi);
  }
  static void midi() throws Exception {
    ${c('ru')} midi=new ${c('ru')}();
    Method dispatch=${c('ru')}.class.getDeclaredMethod("${m('ru','d','(II)V')}",int.class,int.class);
    dispatch.setAccessible(true);
    check("initial channel volume",midiValues(midi,"${f('ru','y','[I')}")[2],12800);
    check("initial channel pan",midiValues(midi,"${f('ru','E','[I')}")[2],8192);
    check("initial pitch bend",midiValues(midi,"${f('ru','v','[I')}")[2],8192);
    dispatch.invoke(midi,5,0xB2|(7<<8)|(64<<16));
    dispatch.invoke(midi,5,0xB2|(39<<8)|(3<<16));
    check("14-bit channel volume",midiValues(midi,"${f('ru','y','[I')}")[2],8195);
    check("other channel unchanged",midiValues(midi,"${f('ru','y','[I')}")[1],12800);
    dispatch.invoke(midi,5,0xB2|(10<<8)|(32<<16));
    dispatch.invoke(midi,5,0xB2|(42<<8)|(1<<16));
    check("14-bit channel pan",midiValues(midi,"${f('ru','E','[I')}")[2],4097);
    dispatch.invoke(midi,5,0xE2|(96<<16));
    check("pitch bend",midiValues(midi,"${f('ru','v','[I')}")[2],12288);
    dispatch.invoke(midi,5,0xB2|(32<<8)|(1<<16));
    dispatch.invoke(midi,5,0xC2|(9<<8));
    check("bank and program",midiValues(midi,"${f('ru','n','[I')}")[2],137);
    dispatch.invoke(midi,5,0xB2|(121<<8));
    check("controller reset volume",midiValues(midi,"${f('ru','y','[I')}")[2],12800);
    check("controller reset pan",midiValues(midi,"${f('ru','E','[I')}")[2],8192);
    check("controller reset bend",midiValues(midi,"${f('ru','v','[I')}")[2],8192);
  }
  static void textAndNumbers() {
    // Explicit boundary fixtures: character, ASCII alphanumeric, name separator,
    // client-printable. Include characters Java classifies more broadly.
    for(int[] row:new int[][]{{0,0,0,0},{31,0,0,0},{32,0,1,1},{45,0,1,1},
      {47,0,0,1},{48,1,0,1},{57,1,0,1},{58,0,0,1},{64,0,0,1},{65,1,0,1},
      {90,1,0,1},{91,0,0,1},{95,0,1,1},{96,0,0,1},{97,1,0,1},{122,1,0,1},
      {123,0,0,1},{127,0,0,0},{160,0,1,1},{255,0,0,1},{256,0,0,0},
      {338,0,0,1},{339,0,0,1},{376,0,0,1},{8212,0,0,1},{8364,0,0,1},{0xffff,0,0,0}}) {
      char ch=(char)row[0];
      check("ASCII boundary "+row[0],${c('vt')}.${m('vt','a','(CZ)Z')}(ch,true),row[1]!=0);
      check("separator "+row[0],${c('ca')}.${m('ca','a','(ZC)Z')}(false,ch),row[2]!=0);
      check("display character "+row[0],${c('rr')}.${m('rr','a','(IC)Z')}(-110,ch),row[3]!=0);
    }
    for(int[] row:new int[][]{{0,0},{1,1},{2,2},{3,4},{7,8},{15,16},{16,16},
      {17,32},{1025,2048},{0x40000000,0x40000000},{0x40000001,Integer.MIN_VALUE}})
      check("power of two "+row[0],${c('ig')}.${m('ig','a','(BI)I')}((byte)6,row[0]),row[1]);
    check("short class",${c('dr')}.${m('dr','a','(ILjava/lang/Class;)Ljava/lang/String;')}(-126,String.class),"String");
    check("array class",${c('dr')}.${m('dr','a','(ILjava/lang/Class;)Ljava/lang/String;')}(-126,int[][].class),"int[][]");
  }
  static void colorMoments() {
    int[][][] count=new int[33][33][33],red=new int[33][33][33];
    int[][][] green=new int[33][33][33],blue=new int[33][33][33];
    double[][][] squares=new double[33][33][33];
    for(int r=1;r<=3;r++)for(int g=1;g<=4;g++)for(int b=1;b<=2;b++) {
      count[r][g][b]=1;red[r][g][b]=r;green[r][g][b]=g;blue[r][g][b]=b;
      squares[r][g][b]=r*r+g*g+b*b;
    }
    ${c('ld')}.${m('ld','a','([[[I[[[I[[[D[[[I[[[IZ)V')}(count,red,squares,green,blue,false);
    // Compare the optimized prefix tables with direct sums over the input cells.
    for(int[] point:new int[][]{{1,1,1},{2,3,1},{32,32,32}}) {
      int n=0,rs=0,gs=0,bs=0,ss=0;
      for(int r=1;r<=Math.min(3,point[0]);r++)for(int g=1;g<=Math.min(4,point[1]);g++)
        for(int b=1;b<=Math.min(2,point[2]);b++) {n++;rs+=r;gs+=g;bs+=b;ss+=r*r+g*g+b*b;}
      int r=point[0],g=point[1],b=point[2];
      check("prefix weight",count[r][g][b],n);check("prefix red",red[r][g][b],rs);
      check("prefix green",green[r][g][b],gs);check("prefix blue",blue[r][g][b],bs);
      check("prefix squares",squares[r][g][b],(double)ss);
    }
  }
  public static void main(String[] args) throws Exception {sprites();requests();dates();categories();audio();midi();textAndNumbers();colorMoments();System.out.println("checks:"+checks);}
}
`);
    const sources=sourceInventory(readable?named:input);
    const args=path.join(directory,'sources.args');
    fs.writeFileSync(args,[...sources.map(s=>JSON.stringify(path.join(readable?named:input,s.path))),JSON.stringify(harness)].join('\n'));
    captureProcess('javac',['--release','8','-encoding','UTF-8','-cp',classpath,'-d',directory,'@'+args]);
    outputs.push(captureProcess('java',['-Djava.awt.headless=true','-Xverify:all','-cp',directory+path.delimiter+classpath,'KickaboutCoreProbe']).stdout.toString().trim());
  }
  assert.equal(outputs[0],outputs[1],'raw and named probe outcomes differ');
  const checks=Number(/^checks:(\d+)$/.exec(outputs[0])?.[1]);
  assert.ok(checks>=740,'the complete independent probe must execute');
  return {status:'passed',variants:['raw','named'],assertionsPerVariant:checks,
    coverage:['rectangular sprite reflections','copy versus in-place mutation','clockwise rotation and trim offsets',
      'availability request completion, result and query retention',
      'Gregorian calendar boundaries including century leap years',
      'Quick Chat tagged decoding, record boundaries and global ID marking',
      'PCM forward/reverse mixing, mono/stereo pan, inactive skipping, gain ramps and summing',
      'MIDI controller, program/bank and pitch-bend dispatch',
      'text character boundaries, power-of-two rounding and reflective type names',
      'summed color moments versus direct input-cell sums'],fullGameplayVerified:false};
}
