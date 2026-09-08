import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [specFile, classesArg, inputArg, outArg]=process.argv.slice(2);
if(!outArg)throw Error('node build.mjs SPEC_JSON GAME_CLASSES INPUT_DIR OUT_DIR');
const spec=JSON.parse(fs.readFileSync(specFile)), classes=path.resolve(classesArg), input=path.resolve(inputArg), out=path.resolve(outArg);
if(!/^[A-Za-z][A-Za-z0-9]*$/.test(spec.class))throw Error('Invalid driver class');
fs.mkdirSync(out,{recursive:true});
const source=`public class ${spec.class} {
  ${spec.members}
  public static volatile int done, checksum, completed;
  public static long[] nanos=new long[${spec.samples}];
  public static int[] outputs=new int[${spec.samples}];
  static void setup() throws Exception { ${spec.setup} }
  static void reset() { ${spec.reset} }
  static void operation() { ${spec.call} }
  static int verify() { ${spec.oracle} }
  static void sample(int i) {
    reset(); long start=System.nanoTime(); operation(); nanos[i]=System.nanoTime()-start;
    outputs[i]=verify(); checksum=outputs[i]; completed=i+1;
  }
  public static void main(String[] args) throws Exception {
    setup(); sample(0);
    for(int i=0;i<${spec.warmup};i++) {reset();operation();checksum=verify();}
    for(int i=1;i<nanos.length;i++)sample(i);
    for(int i=0;i<nanos.length;i++)System.out.println("DIFF "+i+" "+nanos[i]+" "+outputs[i]);
    done=1;
  }
}
`;
fs.writeFileSync(path.join(out,spec.class+'.java'),source);
// Transport actual input bytes without depending on unimplemented resource APIs.
// Decoding this hexadecimal literal happens in setup, outside all target timers.
const inputFile=spec.inputFile||'candy.bin';
const bytes=fs.readFileSync(path.join(input,inputFile));
const chunks=bytes.toString('hex').match(/.{1,16000}/g);
fs.writeFileSync(path.join(out,'FixtureInput.java'),`final class FixtureInput {
 static byte[] load() {
  String[] chunks={${chunks.map(s=>JSON.stringify(s)).join(',')}};
  byte[] bytes=new byte[${bytes.length}]; int p=0;
  for(String s:chunks)for(int i=0;i<s.length();i+=2){int a=s.charAt(i),b=s.charAt(i+1);a=a<=57?a-48:a-87;b=b<=57?b-48:b-87;bytes[p++]=(byte)((a<<4)|b);}
  if(p!=bytes.length)throw new IllegalStateException("input length");return bytes;
 }
}`);
// Discovery uses classfile metadata, not reflective invocation in the timed body.
const owners=[...new Set(spec.targets.map(t=>t.slice(0,t.indexOf('.'))))];
const discovery=execFileSync('javap',['-p','-s','-classpath',classes,...owners],{encoding:'utf8'});
fs.writeFileSync(path.join(out,'discovery.txt'),discovery);
execFileSync(process.env.JAVAC||'/usr/lib/jvm/java-8-openjdk/bin/javac',['-cp',classes,'-d',out,path.join(out,spec.class+'.java'),path.join(out,'FixtureInput.java')],{stdio:'inherit'});
const disassembly=execFileSync('javap',['-c','-p','-classpath',out,spec.class],{encoding:'utf8'});
fs.writeFileSync(path.join(out,'driver-bytecode.txt'),disassembly);
for(const target of spec.targets){const p=target.indexOf('(');if(!disassembly.includes(target.slice(0,p)+':'+target.slice(p)))throw Error('Selected ordinary call absent from driver bytecode: '+target);}
const jar=path.join(out,'fixture.jar');
execFileSync('jar',['cf',jar,'-C',classes,'.','-C',out,spec.class+'.class','-C',out,'FixtureInput.class','-C',input,inputFile]);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({spec,jarSha256:hash(jar),inputSha256:hash(path.join(input,inputFile)),sourceSha256:hash(path.join(out,spec.class+'.java')),gameClasses:JSON.parse(fs.readFileSync(path.join(classes,'class-hashes.json'))),contract:{cold:'First invocation, includes target class initialization; fixture loading excluded',warm:`${spec.warmup} untimed calls then ${spec.samples-1} individually timed operations; not a claim of tier stability`,timed:'operation only; reset and output traversal excluded',clock:'guest System.nanoTime',reflection:'No reflective invocation in timed operation; see setup for fixture construction'}},null,2));
if(fs.existsSync(path.join(input,'oracle.json')))fs.copyFileSync(path.join(input,'oracle.json'),path.join(out,'oracle.json'));
else if(Number.isInteger(spec.expectedChecksum))fs.writeFileSync(path.join(out,'oracle.json'),JSON.stringify({checksum:spec.expectedChecksum,source:spec.oracleSource},null,2));
console.log(jar);
