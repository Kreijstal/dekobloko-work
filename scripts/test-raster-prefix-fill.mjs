import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchRasterPrefixFill} from '../apps/launcher/browser-loader/game-source-patches.mjs';
const source=fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/vb.java',import.meta.url),'utf8');
const patched=patchRasterPrefixFill(source,'games/geoblox/vb.java');
assert.notEqual(patched,source);
assert.equal(patchRasterPrefixFill(patched,'games/geoblox/vb.java'),patched);
assert.equal(patchRasterPrefixFill(source,'games/other/vb.java'),source);
function method(s){
 const start=s.indexOf('    final static void c() {');
 let i=s.indexOf('{',start)+1,depth=1;
 for(;depth;i++){if(s[i]==='{')depth++;else if(s[i]==='}')depth--;}
 return s.slice(start,i);
}
const changed=method(patched).replace('java.util.Arrays.fill(field_c, 0, dekoFillCount, 0);','hits++; java.util.Arrays.fill(field_c, 0, dekoFillCount, 0);');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'raster-prefix-fill-'));
try{
 fs.writeFileSync(path.join(root,'RasterPrefixTest.java'),`import java.util.*;
class Original {static int[] field_c;static int field_f,field_b;${method(source)}}
class Changed {static int[] field_c;static int field_f,field_b,hits;${changed}}
public class RasterPrefixTest {public static void main(String[] args){int cases=0,sentinelCases=0;
 for(int w:new int[]{0,1,2,7,8,9,53,640,-1,Integer.MIN_VALUE,Integer.MAX_VALUE})
 for(int h:new int[]{0,1,2,53,480,-1})
 for(int n:new int[]{-1,0,1,7,8,9,2809,307200,307201}){
  Original.field_f=Changed.field_f=w;Original.field_b=Changed.field_b=h;
  Original.field_c=n<0?null:new int[n];if(n>=0)Arrays.fill(Original.field_c,0xabcdef);
  Changed.field_c=n<0?null:Original.field_c.clone();Changed.hits=0;
  Class<?> a=null,b=null;try{Original.c();}catch(Throwable t){a=t.getClass();}
  try{Changed.c();}catch(Throwable t){b=t.getClass();}
  if(a!=b||!Arrays.equals(Original.field_c,Changed.field_c))throw new AssertionError("w="+w+" h="+h+" n="+n);
  if(w==640&&h==480&&n==307201){
   if(Changed.hits!=1||Changed.field_c[n-1]!=0xabcdef)throw new AssertionError("sentinel fast path missing");sentinelCases++;
  }
  cases++;
 }
 System.out.println("PASS "+cases+" raster/exception cases; "+sentinelCases+" admitted framebuffer-tail case");
}}
`);
 execFileSync('javac',[path.join(root,'RasterPrefixTest.java')],{timeout:30000});
 process.stdout.write(execFileSync('java',['-cp',root,'RasterPrefixTest'],{timeout:30000}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
