import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchByteCopyFastPath as patch} from '../apps/launcher/browser-loader/byte-copy-fast-path.mjs';
test('byte-copy fast path preserves overlap, bounds failures and partial writes',()=>{
 const source=fs.readFileSync(path.resolve('../funorb-decompiled/games/geoblox/sf.java'),'utf8');
 const patched=patch(source,'games/geoblox/sf.java');assert.notEqual(patched,source);
 assert.equal(patch(patched,'games/geoblox/sf.java'),patched);
 assert.equal(patch(source,'games/other/sf.java'),source);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'byte-copy-fast-path-'));
 try{
 fs.writeFileSync(path.join(dir,'Original.java'),source.replace('final class sf','final class Original'));
 fs.writeFileSync(path.join(dir,'Patched.java'),patched.replace('final class sf','final class Patched'));
 fs.writeFileSync(path.join(dir,'Check.java'),`
import java.util.*;
class Check {
 static String run(boolean patched,byte[] src,int from,byte[] dst,int to,int length){
  String error="";try{if(patched)Patched.a(src,from,dst,to,length);else Original.a(src,from,dst,to,length);}catch(RuntimeException e){error=e.getClass().getName();}
  return error+Arrays.toString(src)+Arrays.toString(dst);
 }
 public static void main(String[]args){int cases=0;
  for(int mode=0;mode<5;mode++)for(int from:new int[]{-2,0,1,7,15,31,32,35})for(int to:new int[]{-1,0,1,8,16,31,32,36})for(int length:new int[]{-1,0,1,7,8,9,16,32,40}){
   byte[] src=mode==2||mode==4?null:new byte[32],dst=mode==1?src:mode==3||mode==4?null:new byte[32];
   if(src!=null)for(int i=0;i<src.length;i++)src[i]=(byte)(i*79+128);
   byte[] otherSrc=src==null?null:src.clone(),otherDst=dst==src?otherSrc:dst==null?null:dst.clone();
   String expected=run(false,src,from,dst,to,length),actual=run(true,otherSrc,from,otherDst,to,length);
   if(!expected.equals(actual))throw new AssertionError(mode+" "+from+" "+to+" "+length+"\\n"+expected+"\\n"+actual);cases++;
  }
  System.out.println(cases+" equivalent byte-copy cases");
 }
}`);
 execFileSync('javac',['Original.java','Patched.java','Check.java'],{cwd:dir});const out=execFileSync('java',['Check'],{cwd:dir,encoding:'utf8'});console.log(out.trim());assert.match(out,/2880 equivalent byte-copy cases/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
