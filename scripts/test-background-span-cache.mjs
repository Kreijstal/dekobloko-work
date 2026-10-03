import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchBackgroundSpanCache as patch} from '../apps/launcher/browser-loader/background-span-cache.mjs';

test('bounded background cache preserves pixels, mutations and fallback exceptions', () => {
  const source = fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/na.java', import.meta.url), 'utf8');
  const patched = patch(source, 'games/geoblox/na.java');
  assert.notEqual(patched, source);
  assert.equal(patch(patched, 'games/geoblox/na.java'), patched);
  assert.equal(patch(source, 'games/other/na.java'), source);
  assert.equal(patch(source.replace('private final static void a(int param0, byte[]', 'private static void renamed(int param0, byte[]'), 'games/geoblox/na.java'), source.replace('private final static void a(int param0, byte[]', 'private static void renamed(int param0, byte[]'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'background-span-cache-'));
  try {
    for (const [name, text] of [['Original', source], ['Changed', patched]]) {
      fs.writeFileSync(path.join(dir, name + '.java'), text.replace(/\bna\b/g, name).replaceAll('private final static void a(', 'static void a('));
    }
    fs.writeFileSync(path.join(dir, 'Check.java'), `
import java.util.*;
import java.lang.reflect.*;
abstract class ha { int field_a, field_b, field_c, field_d, field_e, field_f; }
class vb { static int field_f,field_i,field_d,field_e,field_k; static int[] field_c; }
class Check {
 static Random random=new Random(82153);
 static int cases;
 static void compare(byte[] source,int[] palette,int length,int from,int to,int width,int height,int ds,int ss){
  int[] expected=length<0?null:new int[length];
  if(expected!=null)for(int i=0;i<length;i++)expected[i]=random.nextInt();
  int[] actual=expected==null?null:expected.clone();
  Class<?> a=null,b=null;
  try{Original.a(99,source,from,to,17,expected,palette,width,ds,ss,9,height);}catch(RuntimeException e){a=e.getClass();}
  try{Changed.a(99,source,from,to,17,actual,palette,width,ds,ss,9,height);}catch(RuntimeException e){b=e.getClass();}
  if(a!=b||!Arrays.equals(expected,actual))throw new AssertionError("case "+cases+" errors "+a+" "+b);
  cases++;
 }
 static Object field(String name)throws Exception{Field f=Changed.class.getDeclaredField(name);f.setAccessible(true);return f.get(null);}
 public static void main(String[]args)throws Exception{
  byte[] source=new byte[307200];int[] palette=new int[255];
  for(int i=0;i<palette.length;i++)palette[i]=random.nextInt();
  for(int i=0;i<source.length;i++)source[i]=i%640<300?(byte)(1+i%254):0;
  compare(source,palette,307200,0,0,640,480,0,0);
  Object cachedSource=field("dekoBackgroundSource"),pixels=field("dekoBackgroundPixels"),spans=field("dekoBackgroundSpans");
  if(cachedSource==source||field("dekoBackgroundPalette")==palette)throw new AssertionError("retained mutable input");
  for(int n=0;n<50;n++){
   // Mutate, replace and restore both content and transparency. Include opaque
   // palette entries whose actual color is zero, which must still overwrite.
   source[n*6101]=(byte)(n%3==0?0:1+n);source[n*6101+1]=(byte)(n%3==0?20:0);
   palette[n]=n%2==0?0:random.nextInt();
   if(n%7==0){source=source.clone();palette=palette.clone();}
   compare(source,palette,307201,0,0,640,480,0,0);
  }
  if(field("dekoBackgroundSource")!=cachedSource||field("dekoBackgroundPixels")!=pixels||field("dekoBackgroundSpans")!=spans)throw new AssertionError("cache storage grew");
  // Refusal cases must retain the old cache and exactly match original partial
  // writes or errors, including the RLE marker and a fragmented valid image.
  source[1200]=-1;source[1201]=0;compare(source,palette,307200,0,0,640,480,0,0);source[1200]=1;
  for(int i=0;i<source.length;i++)source[i]=(byte)(i%2);
  compare(source,palette,307200,0,0,640,480,0,0);
  Arrays.fill(source,(byte)0);compare(source,palette,307200,0,0,640,480,0,0);
  Arrays.fill(source,(byte)254);compare(source,palette,307200,0,0,640,480,0,0);
  for(int n=0;n<2000;n++){
   byte[] bytes=n%17==0?null:new byte[700];if(bytes!=null)random.nextBytes(bytes);
   int[] colors=n%19==0?null:new int[random.nextInt(257)];if(colors!=null)for(int i=0;i<colors.length;i++)colors[i]=random.nextInt();
   compare(bytes,colors,n%23==0?-1:800,random.nextInt(20)-3,random.nextInt(20)-3,random.nextInt(90)-2,random.nextInt(8)-2,random.nextInt(10)-2,random.nextInt(10)-2);
  }
  compare(source,palette,307199,0,0,640,480,0,0);
  compare(source,palette,307200,0,0,639,480,1,1);
  compare(source,palette,307200,1,0,640,479,0,0);
  System.out.println(cases+" differential cases; fixed storage and mutation invalidation passed");
 }
}`);
    execFileSync('javac', ['Original.java', 'Changed.java', 'Check.java'], {cwd:dir, timeout:30000});
    const output = execFileSync('java', ['Check'], {cwd:dir, encoding:'utf8', timeout:30000});
    console.log(output.trim());
    assert.match(output, /2058 differential cases; fixed storage and mutation invalidation passed/);
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
});
