import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {extractMethod} from './lib/renderer-parameter-fixture.mjs';
import {patchEmptyRunCopy,emptyRunHelperJava} from '../apps/launcher/browser-loader/empty-run-copy.mjs';
const source = fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/w.java',import.meta.url),'utf8');
const patched = patchEmptyRunCopy(source,'games/geoblox/w.java');
assert.notEqual(source,patched);
assert.equal(patchEmptyRunCopy(patched,'games/geoblox/w.java'),patched);
assert.equal(patchEmptyRunCopy(source,'games/other/w.java'),source);
const signature='    private final static void a(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7) {';
const original=extractMethod(source,signature).replace('private final static','static');
const changed=extractMethod(patched,signature).replace('private final static','static');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'empty-run-copy-'));
try {
 fs.writeFileSync(path.join(dir,'Check.java'),`import java.util.*;
class Original { ${original} }
class Changed { ${emptyRunHelperJava} ${changed} }
class Check {
 public static void main(String[]args){
  Random r=new Random(189);int cases=0;
  for(int n=0;n<20000;n++){
   int[] source=n%23==0?null:new int[2048];
   if(source!=null)for(int i=0;i<source.length;i++)source[i]=r.nextInt();
   int[] target=n%29==0?null:n%7==0?source:new int[2048];
   if(target!=null&&target!=source)for(int i=0;i<target.length;i++)target[i]=r.nextInt(100)<n%101?0:r.nextInt();
   int[] source2=source==null?null:source.clone(),target2=target==source?source2:target==null?null:target.clone();
   int width=n%3==0?128:r.nextInt(150)-2,height=r.nextInt(20)-1,from=r.nextInt(70)-2,to=r.nextInt(70)-2;
   int ss=r.nextInt(8)-1,ts=r.nextInt(8)-1;
   Class<?> a=null,b=null;
   try{Original.a(target,source,from,to,width,height,ts,ss);}catch(RuntimeException e){a=e.getClass();}
   try{Changed.a(target2,source2,from,to,width,height,ts,ss);}catch(RuntimeException e){b=e.getClass();}
   if(a!=b||!Arrays.equals(target,target2))throw new AssertionError("case "+n+" "+a+" "+b);
   cases++;
  }
  System.out.println("PASS "+cases+" pixel/alias/exception comparisons");
 }
}`);
 execFileSync('javac',[path.join(dir,'Check.java')],{stdio:'pipe'});
 process.stdout.write(execFileSync('java',['-cp',dir,'Check'],{encoding:'utf8'}));
} finally {fs.rmSync(dir,{recursive:true,force:true});}
