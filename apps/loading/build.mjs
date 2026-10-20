#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildCompilationStubs} from '../../readable/compilation-stubs.mjs';
import {sourceInventory, sourceIdentity} from '../../readable/tools/readable-java.mjs';
import {loadingWorkloadSource} from './workload.mjs';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const options={output:path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'),
  sources:path.resolve(repository,'../funorb-decompiled'),
  assets:path.resolve(repository,'../public/jvm-assets/geoblox-js5')};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(!['output','sources','assets','runtime'].includes(key)||!process.argv[i+1])throw Error('Expected --output, --sources, --assets or --runtime PATH');
  options[key]=path.resolve(process.argv[++i]);
}
if(!options.runtime)throw Error('Provide --runtime with the JVM source bundle to compare');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,stdio:'inherit',env:{...process.env,JAVA_HOME:'/usr/lib/jvm/java-21-openjdk',MAVEN_OPTS:'-Xmx4g'}});
const output=options.output;
if(fs.existsSync(output))throw Error('Output already exists; preserve its results or explicitly remove this benchmark cache before rebuilding');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(output);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'geoblox-loading-build-'));
try {
  const classes=path.join(output,'classes'),assets=path.join(output,'assets');
  fs.mkdirSync(classes);fs.mkdirSync(assets);
  const names=JSON.parse(fs.readFileSync(path.join(options.assets,'manifest.json')));
  const selected=names.filter(name=>/^(?:0|1|2|3|4|5|6|255)-\d+\.bin$/.test(name)).sort();
  const assetHashes={};
  for(const name of selected) {
    const data=fs.readFileSync(path.join(options.assets,name));
    fs.writeFileSync(path.join(assets,name),data);assetHashes[name]=hash(data);
  }
  const groups='new int[][]{'+[0,1,6].map(id=>'new int[]{'+selected.filter(n=>n.startsWith(id+'-')).map(n=>Number(n.split('-')[1].split('.')[0])).sort((a,b)=>a-b).join(',')+'}').join(',')+'}';
  const workload=loadingWorkloadSource(groups);
  fs.writeFileSync(path.join(temporary,'GeobloxLoading.java'),workload);
  const stubs=buildCompilationStubs(options.sources,temporary);
  fs.cpSync(path.join(temporary,'stub-classes'),classes,{recursive:true});
  const inventory=sourceInventory(path.join(options.sources,'games/geoblox'));
  const inputs=[...inventory.map(f=>path.join(options.sources,'games/geoblox',f.path)),
    path.join(temporary,'GeobloxLoading.java'),path.join(repository,'apps/launcher/src/net/alterorb/launcher/Hook.java'),path.join(repository,'apps/launcher/src/local/Trace.java')];
  fs.writeFileSync(path.join(temporary,'sources.args'),inputs.map(n=>JSON.stringify(n)).join('\n'));
  run('javac',['--release','8','-proc:none','-encoding','UTF-8','-classpath',stubs.jar,'-d',classes,'@'+path.join(temporary,'sources.args')]);

  const reference=execFileSync('java',['-Xmx1g','-Djava.awt.headless=true','-cp',classes,'GeobloxLoading',assets],{encoding:'utf8'});
  process.stdout.write(reference);
  const match=reference.match(/pcmSamples=(\d+) pcmBytes=(\d+) pcmCrc=(\d+) archiveFiles=(\d+) decodedBytes=(\d+) graphicsCrc=(\d+)/);
  if(!match)throw Error('HotSpot reference did not complete');
  const referenceCheck=match.slice(1).join(':');
  const src=path.join(temporary,'src/main/java');fs.mkdirSync(src,{recursive:true});
  fs.writeFileSync(path.join(src,'TeaVmLoading.java'),`import org.teavm.jso.*;
public class TeaVmLoading {
 @JSBody(params="name",script="return globalThis.loadingAssets[name];") public static native byte[] asset(String name);
 public static byte[] bridgeAsset(String name){return asset(name);}
 public static void main(String[] args)throws Exception {GeobloxLoading.main(new String[0]);}
 @JSExport public static double musicMs(){return GeobloxLoading.musicNanos/1e6;}
 @JSExport public static double graphicsMs(){return GeobloxLoading.graphicsNanos/1e6;}
 @JSExport public static String check(){return GeobloxLoading.pcmSamples+":"+GeobloxLoading.pcmBytes+":"+GeobloxLoading.pcmCrc+":"+GeobloxLoading.archiveFiles+":"+GeobloxLoading.decodedBytes+":"+GeobloxLoading.graphicsCrc;}
}`);
  fs.writeFileSync(path.join(src,'LoadingPlatformBridge.java'),`import org.teavm.model.*;import org.teavm.model.instructions.*;
public class LoadingPlatformBridge implements ClassHolderTransformer {
 public void transformClass(ClassHolder cls,ClassHolderTransformerContext context) {
  if(cls.getName().equals("GeobloxLoading")) {
   MethodHolder method=cls.getMethod(new MethodDescriptor("browserAsset",ValueType.object("java.lang.String"),ValueType.arrayOf(ValueType.BYTE)));
   Program p=new Program();p.createVariable();Variable name=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();
   InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("TeaVmLoading","bridgeAsset",ValueType.object("java.lang.String"),ValueType.arrayOf(ValueType.BYTE)));call.setArguments(name);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.getModifiers().remove(ElementModifier.NATIVE);method.setProgram(p);
  }
  String name=cls.getName();if(!(name.startsWith("java.awt.")||name.startsWith("java.applet.")||name.startsWith("javax.swing.")||name.startsWith("javax.sound.")||name.startsWith("javax.accessibility.")||name.startsWith("java.net.Socket")||name.startsWith("java.io.ObjectInputStream")))return;
  for(MethodHolder m:cls.getMethods()) {if(m.getModifiers().contains(ElementModifier.ABSTRACT))continue;
   Program p=new Program();p.createVariable();for(int i=0;i<m.parameterCount();i++)p.createVariable();BasicBlock b=p.createBasicBlock();
   if(m.getName().equals("<init>")||m.getName().equals("<clinit>"))b.add(new ExitInstruction());else {Variable failure=p.createVariable();ConstructInstruction make=new ConstructInstruction();make.setType("java.lang.UnsupportedOperationException");make.setReceiver(failure);b.add(make);InvokeInstruction init=new InvokeInstruction();init.setType(InvocationType.SPECIAL);init.setInstance(failure);init.setMethod(new MethodReference(UnsupportedOperationException.class,"<init>",void.class));b.add(init);RaiseInstruction raise=new RaiseInstruction();raise.setException(failure);b.add(raise);}
   m.getModifiers().remove(ElementModifier.NATIVE);m.setProgram(p);
  }
 }
}`);
  fs.cpSync(classes,path.join(temporary,'target/classes'),{recursive:true});
  // Declare desktop host types; any actual service call remains fail-fast.
  run('python3',['-c',`import pathlib,sys,zipfile
out=pathlib.Path(sys.argv[1])
for module in ['java.desktop','java.datatransfer','java.base']:
 with zipfile.ZipFile('/usr/lib/jvm/java-21-openjdk/jmods/'+module+'.jmod') as archive:
  for name in archive.namelist():
   rel=name.removeprefix('classes/')
   if not name.startswith('classes/') or not name.endswith('.class'):continue
   if not (rel.startswith('java/io/') and rel.endswith('Exception.class')) and not rel.startswith(('java/awt/','java/applet/','javax/swing/','javax/sound/','java/net/Socket','javax/accessibility/','java/io/ObjectInputStream','java/io/ObjectStreamConstants','java/io/ObjectInput.class')):continue
   target=out/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))`,path.join(temporary,'target/classes')]);
  const version='0.16.0';
  fs.writeFileSync(path.join(temporary,'pom.xml'),`<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>local.loading</groupId><artifactId>loading</artifactId><version>1</version><properties><maven.compiler.release>11</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties><dependencies>${['teavm-classlib','teavm-jso','teavm-core'].map(n=>`<dependency><groupId>org.teavm</groupId><artifactId>${n}</artifactId><version>${version}</version></dependency>`).join('')}</dependencies><build><plugins><plugin><artifactId>maven-resources-plugin</artifactId><version>3.4.0</version></plugin><plugin><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin><plugin><groupId>org.teavm</groupId><artifactId>teavm-maven-plugin</artifactId><version>${version}</version><configuration><mainClass>TeaVmLoading</mainClass><targetType>WEBASSEMBLY_GC</targetType><targetDirectory>\${project.build.directory}/wasm</targetDirectory><targetFileName>loading.wasm</targetFileName><optimizationLevel>FULL</optimizationLevel><minifying>true</minifying><runtimeFileName>loading.wasm-runtime.js</runtimeFileName><transformers><transformer>LoadingPlatformBridge</transformer></transformers></configuration></plugin></plugins></build></project>`);
  run('mvn',['-B','-ntp','compile',`org.teavm:teavm-maven-plugin:${version}:compile`,`org.teavm:teavm-maven-plugin:${version}:copy-webassembly-gc-runtime`],temporary);
  fs.cpSync(path.join(temporary,'target/wasm'),path.join(output,'teavm'),{recursive:true});
  fs.mkdirSync(path.join(output,'runtime'));
  const runtimeHashes={};
  for(const name of fs.readdirSync(options.runtime).filter(n=>n.endsWith('.js'))) {
    const bytes=fs.readFileSync(path.join(options.runtime,name));fs.writeFileSync(path.join(output,'runtime',name),bytes);runtimeHashes[name]=hash(bytes);
  }
  const classHashes={};
  const visit=(dir,prefix='')=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())visit(path.join(dir,entry.name),name+'/');else if(name.endsWith('.class'))classHashes[name]=hash(fs.readFileSync(path.join(dir,entry.name)));}};visit(classes);
  fs.writeFileSync(path.join(output,'benchmark.json'),JSON.stringify({schema:1,referenceCheck,jvmOptions:JSON.parse(fs.readFileSync(path.resolve(repository,'apps/launcher/browser-runtime.json'))).jvmOptions,workload:'Initial four music tracks and initial sound effects, then available graphics/UI/font archive files; excludes networking, drawing, device playback and menu transitions',sourceTreeSha256:sourceIdentity(inventory),workloadSha256:hash(workload),assets:assetHashes,classes:classHashes,runtime:runtimeHashes,teavm:{version,wasmSha256:hash(fs.readFileSync(path.join(output,'teavm/loading.wasm')))},results:[]},null,2)+'\n');
  console.log('Built loading benchmark: '+output);
} catch(error) {fs.rmSync(output,{recursive:true,force:true});throw error;}
finally {fs.rmSync(temporary,{recursive:true,force:true});}
