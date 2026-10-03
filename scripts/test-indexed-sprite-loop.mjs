import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchIndexedSpriteLoop} from '../apps/launcher/browser-loader/indexed-sprite-loop.mjs';
const source=fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/na.java',import.meta.url),'utf8');
const patched=patchIndexedSpriteLoop(source,'games/geoblox/na.java');
assert.notEqual(patched,source);
assert.equal(patchIndexedSpriteLoop(patched,'games/geoblox/na.java'),patched);
assert.equal(patchIndexedSpriteLoop(source,'games/other/na.java'),source);
assert.equal(patchIndexedSpriteLoop(source.replace('param4 = param7;', 'param4 = param7 + 1;'),'games/geoblox/na.java'),source.replace('param4 = param7;', 'param4 = param7 + 1;'));
function method(s,anchor){
 const start=s.indexOf(anchor);assert.ok(start>=0);
 let end=s.indexOf('{',start)+1,depth=1;
 for(;depth;end++){if(s[end]==='{')depth++;else if(s[end]==='}')depth--;}
 return s.slice(start,end).replace('private final static','static');
}
const original=method(source,'    private final static void a(int param0, byte[]');
const changed=method(patched,'    private final static void a(int ignoredColor, byte[]');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'indexed-sprite-loop-'));
try{
 fs.writeFileSync(path.join(root,'SpriteLoopTest.java'),`import java.util.*;
class Original {${original}}
class Changed {${changed}}
public class SpriteLoopTest {
 public static void main(String[] args) {
  Random r=new Random(4182);int cases=0;
  for(int k=0;k<20000;k++) {
   byte[] source=k%19==0?null:new byte[r.nextInt(600)];
   if(source!=null)r.nextBytes(source);
   int[] target=k%23==0?null:new int[512];
   if(target!=null)for(int i=0;i<target.length;i++)target[i]=r.nextInt();
   int[] palette=k%29==0?null:k%7==0?target:new int[r.nextInt(257)];
   if(palette!=null&&palette!=target)for(int i=0;i<palette.length;i++)palette[i]=r.nextInt();
   int[] copy=target==null?null:target.clone(), colors=palette==target?copy:palette==null?null:palette.clone();
   int src=r.nextInt(100)-5,dst=r.nextInt(100)-5,w=r.nextInt(90)-3,h=r.nextInt(9)-2,ss=r.nextInt(20)-4,ds=r.nextInt(20)-4;
   if(k%31==0)src=Integer.MAX_VALUE;if(k%37==0)dst=Integer.MIN_VALUE;
   Class<?> a=null,b=null;
   try{Original.a(37,source,src,dst,-99,target,palette,w,ds,ss,72,h);}catch(Throwable t){a=t.getClass();}
   try{Changed.a(37,source,src,dst,-99,copy,colors,w,ds,ss,72,h);}catch(Throwable t){b=t.getClass();}
   if(a!=b||!Arrays.equals(target,copy)||!Arrays.equals(palette,colors))throw new AssertionError("case "+k+" original="+a+" changed="+b);
   cases++;
  }
  System.out.println("PASS "+cases+" pixel/exception/alias cases");
 }
}`);
 execFileSync('javac',[path.join(root,'SpriteLoopTest.java')],{timeout:30000});
 process.stdout.write(execFileSync('java',['-cp',root,'SpriteLoopTest'],{timeout:30000}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
