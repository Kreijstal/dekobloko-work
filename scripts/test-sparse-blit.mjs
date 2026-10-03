import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchSparseBlit} from '../apps/launcher/browser-loader/sparse-blit.mjs';
const source=fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/dm.java',import.meta.url),'utf8');
const patched=patchSparseBlit(source,'games/geoblox/dm.java');
assert.notEqual(patched,source);
assert.equal(patchSparseBlit(patched,'games/geoblox/dm.java'),patched);
assert.equal(patchSparseBlit(source,'games/other/dm.java'),source);

function method(s,anchor){
 const start=s.indexOf(anchor);assert.ok(start>=0);
 let end=s.indexOf('{',start)+1,depth=1;
 for(;depth;end++){if(s[end]==='{')depth++;else if(s[end]==='}')depth--;}
 return s.slice(start,end).replace('private final static','static');
}
const anchor='    private final static void b(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';
const original=method(source,anchor);
const changed=method(patched,anchor)+'\n'+method(patched,'    private static boolean dekoSparseBlit(');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sparse-blit-'));
try{
 fs.writeFileSync(path.join(root,'SpriteLoopTest.java'),`import java.util.*;
class Original {${original}}
class Changed {${changed}}
public class SpriteLoopTest {
 public static void main(String[] args) {
  Random r=new Random(4182);int cases=0;
  for(int k=0;k<20000;k++) {
   int[] source=k%19==0?null:new int[2048];
   if(source!=null)for(int i=0;i<source.length;i++)source[i]=r.nextInt(100)<(k%2==0?99:30)?0:r.nextInt();
   int[] target=k%23==0?null:k%7==0?source:new int[2048];
   if(target!=null&&target!=source)for(int i=0;i<target.length;i++)target[i]=r.nextInt();
   int[] otherSource=source==null?null:source.clone(),copy=target==source?otherSource:target==null?null:target.clone();
   int src=r.nextInt(40)-3,dst=r.nextInt(40)-3,w=r.nextInt(90)-3,h=r.nextInt(18)-2,ss=r.nextInt(20)-4,ds=r.nextInt(20)-4;
   if(k%31==0)src=Integer.MAX_VALUE;if(k%37==0)dst=Integer.MIN_VALUE;
   if(k%41==0)ss=Integer.MAX_VALUE;if(k%43==0)ds=Integer.MAX_VALUE;
   Class<?> a=null,b=null;
   try{Original.b(target,source,37,src,dst,w,h,ds,ss);}catch(Throwable t){a=t.getClass();}
   try{Changed.b(copy,otherSource,37,src,dst,w,h,ds,ss);}catch(Throwable t){b=t.getClass();}
   if(a!=b||!Arrays.equals(target,copy)||!Arrays.equals(source,otherSource))throw new AssertionError("case "+k+" original="+a+" changed="+b);
   cases++;
  }
  System.out.println("PASS "+cases+" pixel/exception/alias cases");
 }
}`);
 execFileSync('javac',[path.join(root,'SpriteLoopTest.java')],{timeout:30000});
 process.stdout.write(execFileSync('java',['-cp',root,'SpriteLoopTest'],{timeout:30000}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
