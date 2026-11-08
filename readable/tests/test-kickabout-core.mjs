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
  public static void main(String[] args) {sprites();requests();dates();categories();System.out.println("checks:"+checks);}
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
  assert.ok(checks>=600,'the complete independent probe must execute');
  return {status:'passed',variants:['raw','named'],assertionsPerVariant:checks,
    coverage:['rectangular sprite reflections','copy versus in-place mutation','clockwise rotation and trim offsets',
      'availability request completion, result and query retention',
      'Gregorian calendar boundaries including century leap years',
      'Quick Chat tagged decoding, record boundaries and global ID marking'],fullGameplayVerified:false};
}
