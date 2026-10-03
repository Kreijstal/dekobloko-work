import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchSpriteByteReads as patch} from '../apps/launcher/browser-loader/sprite-byte-reads.mjs';
const root=path.resolve('../funorb-decompiled/games/geoblox');
function method(source,signature){
 const start=source.indexOf(signature);assert(start>=0);let depth=0;
 for(let i=source.indexOf('{',start);i<source.length;i++){
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw Error('Unclosed method');
}
test('direct sprite byte reads preserve decoded data and malformed-input state',()=>{
 const source=fs.readFileSync(path.join(root,'hf.java'),'utf8'),qc=fs.readFileSync(path.join(root,'qc.java'),'utf8');
 const patched=patch(source,'games/geoblox/hf.java');assert.notEqual(patched,source);
 assert.equal(patch(patched,'games/geoblox/hf.java'),patched);
 assert.equal(patch(source,'games/other/hf.java'),source);
 assert.equal(patch('unknown','games/geoblox/hf.java'),'unknown');
 const signature='final static void a(boolean param0, byte[] param1)';
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sprite-byte-reads-'));
 try{
 fs.writeFileSync(path.join(dir,'Check.java'),`
import java.util.*;import java.io.*;
class Original {${method(source,signature)}}
class Patched {${method(patched,signature)}}
class sb{static int field_a;}class rc{static int[] field_j;}class hl{static int[] field_K;}
class ng{static boolean[] field_E;}class vf{static byte[][] field_E;}class gh{static int[] field_m;}
class mj{static byte[][] field_a;}class md{static int[] field_e;}class pg{static int field_b;}
class dd{static int field_C;}class cm{static int[] field_j;}
class t{static RuntimeException a(Throwable e,String s){return new RuntimeException(s,e);}}
class qc{
 byte[] field_j;int field_f;static qc last;static int reads;
 qc(byte[] data){field_j=data;last=this;}
 void f(int a,int b){throw new AssertionError("unexpected sentinel");}
 ${method(qc,'final byte f(byte param0)').replace('{','{reads++;')}
 int c(byte b){return field_j[field_f++]&255;}
 int b(boolean b){return c((byte)34)*256+c((byte)34);}
 int e(int b){return c((byte)34)*65536+c((byte)34)*256+c((byte)34);}
}
public class Check{
 static void reset(){sb.field_a=pg.field_b=dd.field_C=0;rc.field_j=hl.field_K=gh.field_m=md.field_e=cm.field_j=null;ng.field_E=null;vf.field_E=mj.field_a=null;qc.last=null;qc.reads=0;}
 static String snapshot(){return Arrays.deepToString(new Object[]{sb.field_a,pg.field_b,dd.field_C,rc.field_j,hl.field_K,gh.field_m,md.field_e,cm.field_j,ng.field_E,vf.field_E,mj.field_a,qc.last==null?-1:qc.last.field_f});}
 static String run(boolean patched,byte[] bytes){reset();String error="";try{if(patched)Patched.a(true,bytes);else Original.a(true,bytes);}catch(RuntimeException e){while(e.getCause()!=null)e=(RuntimeException)e.getCause();error=e.getClass().getName();}return error+snapshot();}
 static byte[] sprite(int flags,int w,int h,int palette,int seed)throws Exception{
  Random r=new Random(seed);ByteArrayOutputStream buffer=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(buffer);
  for(int sprite=0;sprite<2;sprite++){out.writeByte(flags);for(int i=0;i<w*h;i++)out.writeByte(r.nextInt(palette));if((flags&2)!=0)for(int i=0;i<w*h;i++)out.writeByte(seed%2==0?255:r.nextInt(256));}
  for(int i=1;i<palette;i++){out.writeByte(i);out.writeByte(i*37);out.writeByte(i*79);}
  out.writeShort(w+3);out.writeShort(h+4);out.writeByte(palette-1);
  for(int i=0;i<2;i++)out.writeShort(i);for(int i=0;i<2;i++)out.writeShort(i+1);
  for(int i=0;i<2;i++)out.writeShort(w);for(int i=0;i<2;i++)out.writeShort(h);out.writeShort(2);return buffer.toByteArray();
 }
 public static void main(String[]args)throws Exception{
  int cases=0,avoided=0;
  for(int flags=0;flags<4;flags++)for(int w:new int[]{0,1,3,15})for(int h:new int[]{0,1,7})for(int palette:new int[]{2,16,256})for(int seed=0;seed<4;seed++){
   byte[] data=sprite(flags,w,h,palette,seed);
   String expected=run(false,data);avoided+=qc.reads;if(!expected.equals(run(true,data)))throw new AssertionError("decoded mismatch");if(qc.reads!=0)throw new AssertionError("byte call retained");cases++;
   for(int cut:new int[]{0,1,data.length/2,data.length-1}){byte[] truncated=Arrays.copyOf(data,cut);expected=run(false,truncated);if(!expected.equals(run(true,truncated)))throw new AssertionError("truncated mismatch");cases++;}
  }
  if(avoided==0)throw new AssertionError("no reads eliminated");System.out.println(cases+" equivalent decode cases; "+avoided+" byte calls eliminated");
 }
}`);
 execFileSync('javac',['Check.java'],{cwd:dir});const out=execFileSync('java',['Check'],{cwd:dir,encoding:'utf8'});console.log(out.trim());assert.match(out,/2880 equivalent decode cases/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
