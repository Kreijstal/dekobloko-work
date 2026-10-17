#!/usr/bin/env node
// Compile the existing intro renderer with TeaVM; generated files stay in cache.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sha256} from './manifest.mjs';

const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-intro');
const receipt=JSON.parse(fs.readFileSync(path.join(player,'provenance.json')));
if(receipt.generatedBy!=='dekobloko-geoblox-intro')throw new Error('Build the intro player first');
const version='0.16.0';
const builderSha256=sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'intro-teavm-'));
const java=String.raw`
import java.nio.*;
import java.util.zip.CRC32;
import org.teavm.jso.JSBody;
import org.teavm.jso.JSExport;

public final class TeaVmIntro {
  static final int WIDTH=640,HEIGHT=480;
  static final int[] pixels=new int[WIDTH*HEIGHT];
  static final IntBuffer output=ByteBuffer.allocateDirect(WIDTH*HEIGHT*4).order(ByteOrder.LITTLE_ENDIAN).asIntBuffer();
  static int frames;
  @JSBody(params="name",script="return globalThis.teavmAssets[name];")
  static native byte[] asset(String name);
  @JSBody(params="bytes",script="return globalThis.teavmDecodeImage(bytes);")
  static native int[] decodeImage(byte[] bytes);
  @JSBody(params="buffer",script="globalThis.teavmPresent(buffer);")
  static native void present(IntBuffer buffer);

  static final class LocalArchive extends ArchiveSource {
    final ArchiveIndex index;
    LocalArchive() {
      byte[] bytes=asset("255-10.bin");CRC32 crc=new CRC32();crc.update(bytes,0,bytes.length);
      index=new ArchiveIndex(bytes,(int)crc.getValue(),null);
    }
    int getGroupProgress(int guard,int group){return 100;}
    ArchiveIndex getIndex(byte guard){return index;}
    byte[] getPackedGroup(int guard,int group){
      if(group!=2&&group!=3)throw new AssertionError("Non-intro group: "+group);
      return asset("10-"+group+".bin");
    }
  }
  // This is the browser image-codec boundary, replacing AWT's PixelGrabber.
  public static void decodeSprite(Sprite sprite,byte[] encoded) {
    int[] decoded=decodeImage(encoded);
    sprite.width=sprite.fullWidth=decoded[0];sprite.height=sprite.fullHeight=decoded[1];
    sprite.trimX=sprite.trimY=0;sprite.pixels=new int[sprite.width*sprite.height];
    System.arraycopy(decoded,2,sprite.pixels,0,sprite.pixels.length);
  }
  public static void main(String[] args) {
    Geoblox.clientControlFlowFlag=0;
    MessageDialog.gameCanvas=new java.awt.Canvas();
    SoftwareRasterizer.setRasterTarget(pixels,WIDTH,HEIGHT);
    ResourceArchive archive=new ResourceArchive(new LocalArchive(),false,0);
    MessageDialogContent.loadLogoMeshesAndMaterials(archive,0);
    MatchCandidateSupport.prepareFinalFrameSlices(-21541,archive);
    FullscreenSupport.prepareMeshSpecularResponse((byte)-91);
    MidiNoteMixer.prepareLogoGlowRaster((byte)-32);
  }
  @JSExport
  public static int render(int tick) {
    if(tick!=frames||tick>250)throw new AssertionError("Skipped/repeated tick");
    SoftwareRasterizer.setRasterTarget(pixels,WIDTH,HEIGHT);SoftwareRasterizer.clearFramebuffer();
    PrefixCodeDecoder.pointerXSnapshot=-1;PcmResampler.pointerYSnapshot=-1;
    DequeCursor.logoAnimationTick=tick;LogoCompositor.drawLogoAnimation(HEIGHT/2,WIDTH/2,-51);
    if(!MatchingTextValidator.rasterTargetStack.isEmpty(13519))throw new AssertionError("Raster target leaked");
    for(int i=0;i<pixels.length;i++) {
      int p=pixels[i];output.put(i,0xff000000|((p>>>16)&255)|(p&0xff00)|((p&255)<<16));
    }
    present(output);return ++frames;
  }
}
`;
const transformer=String.raw`
import org.teavm.model.*;
import org.teavm.model.instructions.*;

public final class IntroPlatformBridge implements ClassHolderTransformer {
  public void transformClass(ClassHolder cls,ClassHolderTransformerContext context) {
    String name=cls.getName();
    if(name.equals("Sprite")) {
      MethodHolder method=cls.getMethod(new MethodDescriptor("<init>",ValueType.arrayOf(ValueType.BYTE),
        ValueType.object("java.awt.Component"),ValueType.VOID));
      if(method!=null) {
        Program p=new Program();Variable self=p.createVariable(),bytes=p.createVariable();p.createVariable();
        BasicBlock b=p.createBasicBlock();InvokeInstruction call=new InvokeInstruction();
        call.setType(InvocationType.SPECIAL);
        call.setMethod(new MethodReference("TeaVmIntro","decodeSprite",ValueType.object("Sprite"),ValueType.arrayOf(ValueType.BYTE),ValueType.VOID));
        call.setArguments(self,bytes);b.add(call);b.add(new ExitInstruction());method.setProgram(p);
      }
    }
    // Desktop services are outside this intro. Fail if one is accidentally
    // called; constructors/class initializers merely provide inert host types.
    if(!(name.startsWith("java.awt.")||name.startsWith("java.applet.")||
         name.startsWith("javax.swing.")||name.startsWith("javax.sound.")||name.startsWith("javax.accessibility.")||
         name.startsWith("java.net.Socket")||name.startsWith("java.io.ObjectInputStream")))return;
    for(MethodHolder method:cls.getMethods()) {
      if(method.getModifiers().contains(ElementModifier.ABSTRACT))continue;
      Program p=new Program();p.createVariable();
      for(int i=0;i<method.parameterCount();i++)p.createVariable();
      BasicBlock b=p.createBasicBlock();
      if(method.getName().equals("<init>")||method.getName().equals("<clinit>"))b.add(new ExitInstruction());
      else {
        Variable failure=p.createVariable();ConstructInstruction make=new ConstructInstruction();
        make.setType("java.lang.UnsupportedOperationException");make.setReceiver(failure);b.add(make);
        InvokeInstruction init=new InvokeInstruction();init.setType(InvocationType.SPECIAL);init.setInstance(failure);
        init.setMethod(new MethodReference(UnsupportedOperationException.class,"<init>",void.class));b.add(init);
        RaiseInstruction raise=new RaiseInstruction();raise.setException(failure);b.add(raise);
      }
      method.getModifiers().remove(ElementModifier.NATIVE);method.setProgram(p);
    }
  }
}
`;
try {
  const src=path.join(temporary,'src/main/java');fs.mkdirSync(src,{recursive:true});
  fs.writeFileSync(path.join(src,'TeaVmIntro.java'),java);
  fs.writeFileSync(path.join(src,'IntroPlatformBridge.java'),transformer);
  fs.cpSync(path.join(player,'classes'),path.join(temporary,'target/classes'),{recursive:true});
  // TeaVM excludes the desktop JRE. Supply its type declarations from the
  // installed JDK; IntroPlatformBridge makes these inert/fail-fast, never GUI.
  const platform=spawnSync('python3',['-c',String.raw`import pathlib,sys,zipfile
root=pathlib.Path('/usr/lib/jvm/java-21-openjdk/jmods')
out=pathlib.Path(sys.argv[1])
for module in ['java.desktop','java.datatransfer','java.base']:
 with zipfile.ZipFile(root/(module+'.jmod')) as archive:
  for name in archive.namelist():
   relative=name.removeprefix('classes/')
   if not name.startswith('classes/') or not name.endswith('.class'):continue
   if not (relative.startswith('java/io/') and relative.endswith('Exception.class')) and not relative.startswith(('java/awt/','java/applet/','javax/swing/','javax/sound/','java/net/Socket','javax/accessibility/','java/io/ObjectInputStream','java/io/ObjectStreamConstants','java/io/ObjectInput.class')):continue
   target=out/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(name))
`,path.join(temporary,'target/classes')],{stdio:'inherit'});
  if(platform.status!==0)throw new Error('Cannot provide desktop host type declarations');
  fs.writeFileSync(path.join(temporary,'pom.xml'),`<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion><groupId>local.intro</groupId><artifactId>intro</artifactId><version>1</version>
  <properties><maven.compiler.release>11</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties>
  <dependencies>${['teavm-classlib','teavm-jso','teavm-core'].map(name=>`<dependency><groupId>org.teavm</groupId><artifactId>${name}</artifactId><version>${version}</version></dependency>`).join('')}</dependencies>
  <build><plugins>
    <plugin><artifactId>maven-resources-plugin</artifactId><version>3.4.0</version></plugin>
    <plugin><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin>
    <plugin><groupId>org.teavm</groupId><artifactId>teavm-maven-plugin</artifactId><version>${version}</version>
      <configuration><mainClass>TeaVmIntro</mainClass><targetType>WEBASSEMBLY_GC</targetType>
        <targetDirectory>\${project.build.directory}/wasm</targetDirectory><targetFileName>intro.wasm</targetFileName>
        <optimizationLevel>FULL</optimizationLevel><minifying>true</minifying>
        <runtimeFileName>intro.wasm-runtime.js</runtimeFileName>
        <transformers><transformer>IntroPlatformBridge</transformer></transformers>
      </configuration></plugin>
  </plugins></build></project>`);
  const started=performance.now();
  const result=spawnSync('mvn',['-B','-ntp','compile',`org.teavm:teavm-maven-plugin:${version}:compile`,
    `org.teavm:teavm-maven-plugin:${version}:copy-webassembly-gc-runtime`],{
    cwd:temporary,env:{...process.env,JAVA_HOME:'/usr/lib/jvm/java-21-openjdk',MAVEN_OPTS:'-Xmx4g'},stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('TeaVM build failed');
  const validation=spawnSync(process.execPath,['-e',"WebAssembly.compile(require('fs').readFileSync(process.argv[1]),{builtins:['js-string']}).then(()=>console.log('Wasm validation passed'),error=>{console.error(String(error));process.exitCode=1})",path.join(temporary,'target/wasm/intro.wasm')],{stdio:'inherit'});
  if(validation.status!==0)throw new Error('TeaVM emitted invalid Wasm');
  const output=path.join(player,'teavm');fs.rmSync(output,{recursive:true,force:true});
  fs.cpSync(path.join(temporary,'target/wasm'),output,{recursive:true});
  fs.writeFileSync(path.join(output,'build.json'),JSON.stringify({version,target:'WEBASSEMBLY_GC',optimization:'FULL',buildMs:performance.now()-started,
    readableSourceSha256:receipt.readableSourceSha256,builderSha256,
    wasmSha256:sha256(fs.readFileSync(path.join(output,'intro.wasm')))},null,2)+'\n');
  console.log('TeaVM output: '+output);
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
