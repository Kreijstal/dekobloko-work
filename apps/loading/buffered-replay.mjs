// Record requests once outside timing. Both measured engines replay the
// unmodified input; instrumented classes exist only in this temporary capture.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const captureSource=String.raw`import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import org.objectweb.asm.*;
public class BufferedCapture {
 public static int kind,returns,readChecksum;
 public static ByteArrayOutputStream requests=new ByteArrayOutputStream();
 public static void request(int width){if(width<1||width>31)throw new AssertionError(width);requests.write(width|kind);}
 public static void result(int value){returns++;readChecksum=readChecksum*33+value;}
 static int field(Object state,String name)throws Exception{
  Field f=state.getClass().getDeclaredField(name);f.setAccessible(true);return f.getInt(state);
 }
 public static void main(String[] args)throws Exception{
  Path classes=Paths.get(args[0]),file=classes.resolve("Bzip2Decoder.class");
  ClassReader reader=new ClassReader(Files.readAllBytes(file));ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
  reader.accept(new ClassVisitor(Opcodes.ASM9,writer){
   public MethodVisitor visitMethod(int access,String name,String descriptor,String signature,String[] exceptions){
    MethodVisitor next=super.visitMethod(access,name,descriptor,signature,exceptions);
    final boolean bits=name.equals("readBits")&&descriptor.equals("(ILBzip2DecoderState;)I");
    final int wrapper=name.equals("readBit")?64:name.equals("readByte")?128:0;
    if(!bits&&wrapper==0)return next;
    return new MethodVisitor(Opcodes.ASM9,next){
     public void visitCode(){super.visitCode();
      if(bits){super.visitVarInsn(Opcodes.ILOAD,0);super.visitMethodInsn(Opcodes.INVOKESTATIC,"BufferedCapture","request","(I)V",false);}
      else{super.visitLdcInsn(wrapper);super.visitFieldInsn(Opcodes.PUTSTATIC,"BufferedCapture","kind","I");}
     }
     public void visitInsn(int op){
      if(op==Opcodes.IRETURN){
       if(bits){super.visitInsn(Opcodes.DUP);super.visitMethodInsn(Opcodes.INVOKESTATIC,"BufferedCapture","result","(I)V",false);}
       else{super.visitInsn(Opcodes.ICONST_0);super.visitFieldInsn(Opcodes.PUTSTATIC,"BufferedCapture","kind","I");}
      }
      super.visitInsn(op);
     }
    };
   }
  },0);Files.write(file,writer.toByteArray());
  try(URLClassLoader loader=new URLClassLoader(new URL[]{classes.toUri().toURL()},BufferedCapture.class.getClassLoader())){
   Class<?> decoder=Class.forName("Bzip2Decoder",true,loader);
   byte[] input=Files.readAllBytes(Paths.get(args[1])),output=new byte[ByteBuffer.wrap(input).getInt(5)];
   Method decode=decoder.getDeclaredMethod("decompressInto",byte[].class,int.class,byte[].class,int.class,int.class);decode.setAccessible(true);
   int decoded=(Integer)decode.invoke(null,output,output.length,input,input.length-9,9);
   Field owner=decoder.getDeclaredField("decoderState");owner.setAccessible(true);Object state=owner.get(null);
   int[] reference={0,field(state,"bufferedBitCount"),field(state,"bitBuffer"),field(state,"inputPosition"),field(state,"inputBytesRead")};
   for(int i=1;i<reference.length;i++)readChecksum=readChecksum*31+reference[i];reference[0]=readChecksum;
   if(returns!=requests.size()||kind!=0)throw new AssertionError("unbalanced reader capture");
   StringBuilder digest=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(output))digest.append(String.format("%02x",b&255));
   System.out.println("{\"encoded\":\""+Base64.getEncoder().encodeToString(requests.toByteArray())+"\",\"requests\":"+requests.size()+",\"readerReference\":"+Arrays.toString(reference)+",\"decodedBytes\":"+decoded+",\"decodedSha256\":\""+digest+"\"}");
  }
 }
}`;

export function validateBufferedWorkload(workload){
 const bytes=Buffer.from(workload.encoded,'base64');
 assert.equal(bytes.length,workload.requests,'Reader request count mismatch');
 assert.equal(hash(bytes),workload.traceSha256,'Reader request hash mismatch');
 const widths={},wrappers={direct:0,bit:0,byte:0};let bits=0;
 for(const code of bytes){
  const width=code&31,kind=code&224;
  assert.ok(width>0&&[0,64,128].includes(kind),'Invalid packed reader request');
  if(kind===64)assert.equal(width,1);if(kind===128)assert.equal(width,8);
  widths[width]=(widths[width]||0)+1;bits+=width;
  wrappers[kind===64?'bit':kind===128?'byte':'direct']++;
 }
 return {bytes,widths,wrappers,bits};
}
export function bufferedReplayArgs(workload){
 // Keep each argument below Linux's per-argument limit; no trace file is
 // created, and the timed Java method consumes each request exactly once.
 return validateBufferedWorkload(workload).bytes.toString('hex').match(/.{1,60000}/g)||[];
}
export function captureBufferedWorkload({player,asset,inputSha256,classes,previous}){
 const asm=path.join(os.homedir(),'.m2/repository/org/ow2/asm/asm/9.6/asm-9.6.jar');
 const sourceSha256=hash(captureSource),asmSha256=hash(fs.readFileSync(asm));
 if(previous?.inputSha256===inputSha256&&previous.captureSourceSha256===sourceSha256&&
    previous.asmSha256===asmSha256&&JSON.stringify(previous.classes)===JSON.stringify(classes)){
  validateBufferedWorkload(previous);return previous;
 }
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'buffered-capture-'));
 try{
  const traced=path.join(temporary,'traced');fs.mkdirSync(traced);
  for(const [name,expected]of Object.entries(classes)){
   const bytes=fs.readFileSync(path.join(player,'classes',name));assert.equal(hash(bytes),expected);
   fs.writeFileSync(path.join(traced,name),bytes);
  }
  const source=path.join(temporary,'BufferedCapture.java');fs.writeFileSync(source,captureSource);
  execFileSync('javac',['--release','8','-cp',asm,'-d',temporary,source]);
  const input=path.join(player,'assets',asset);assert.equal(hash(fs.readFileSync(input)),inputSha256);
  const captured=JSON.parse(execFileSync('java',['-Xmx1g','-cp',temporary+path.delimiter+asm,'BufferedCapture',traced,input],
   {encoding:'utf8',maxBuffer:16*1024*1024}));
  const reference=execFileSync('python3',['-c',`import bz2,sys
b=sys.stdin.buffer.read();sys.stdout.buffer.write(bz2.decompress(b'BZh1'+b[9:9+int.from_bytes(b[1:5],'big')]))`],
   {input:fs.readFileSync(input),maxBuffer:16*1024*1024});
  assert.equal(captured.decodedSha256,hash(reference),'Capture changed original decoded bytes');
  assert.equal(captured.decodedBytes,reference.length);
  const result={...captured,asset,inputSha256,classes,captureSourceSha256:sourceSha256,asmSha256,
   traceSha256:hash(Buffer.from(captured.encoded,'base64'))};
  const {widths,wrappers,bits}=validateBufferedWorkload(result);
  Object.assign(result,{widthHistogram:widths,wrapperHistogram:wrappers,bits});
  for(const [name,expected]of Object.entries(classes))assert.equal(hash(fs.readFileSync(path.join(player,'classes',name))),expected,'Original class was changed');
  return result;
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
