import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchLayerDirtyBounds, layerTrackerJava} from '../apps/launcher/browser-loader/layer-dirty-bounds.mjs';
const root = new URL('../../funorb-decompiled/games/geoblox/', import.meta.url);
const sources = new Map(fs.readdirSync(root).filter(x => x.endsWith('.java')).map(name =>
  ['games/geoblox/' + name, fs.readFileSync(new URL(name, root), 'utf8')]));
const result = await patchLayerDirtyBounds(sources);
assert.equal(result.applied, true);
assert.notEqual(result.sources, sources);
const changed = new Map(sources);
changed.set('games/geoblox/dm.java', changed.get('games/geoblox/dm.java') + '\n');
assert.equal((await patchLayerDirtyBounds(changed)).applied, false);
assert.equal((await patchLayerDirtyBounds(result.sources)).applied, false);
const missing = new Map(sources); missing.delete('games/geoblox/tl.java');
assert.equal((await patchLayerDirtyBounds(missing)).sources, missing);
for (const file of ['oc','gh','w','vb','dm']) assert.notEqual(result.sources.get(`games/geoblox/${file}.java`),sources.get(`games/geoblox/${file}.java`));
assert.equal(result.sources.get('games/geoblox/ld.java'), sources.get('games/geoblox/ld.java'));
const signature = '    private final static void b(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';
function method(source, anchor) {
 const start=source.indexOf(anchor); assert.ok(start>=0);
 let end=source.indexOf('{',start)+1,depth=1;
 for(;depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
 return source.slice(start,end).replace('private final static','static');
}
const original=method(sources.get('games/geoblox/dm.java'),signature);
const patched=method(result.sources.get('games/geoblox/dm.java'),signature);
const rotationSignature = '    void b(int param0, int param1, int param2, int param3, int param4, int param5) {';
const rotationOriginal = method(sources.get('games/geoblox/dm.java'), rotationSignature);
const rotationChanged = method(result.sources.get('games/geoblox/dm.java'), rotationSignature) + '\n' + method(result.sources.get('games/geoblox/dm.java'), '    private static void dekoRotate(');
const outlineSignature = '    final static void a(int[] param0, int param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';
const outlineOriginal = method(sources.get('games/geoblox/w.java'), outlineSignature);
const outlineChanged = method(result.sources.get('games/geoblox/w.java'), outlineSignature);
const smoothSignature = '    final void a(int param0, int param1, int param2, int param3, int param4, int param5) {';
const samplerSignature = '    private final void c(int param0, int param1, int param2, int param3, int param4) {';
const smoothOriginal = method(sources.get('games/geoblox/dm.java'), smoothSignature) + '\n' + method(sources.get('games/geoblox/dm.java'), samplerSignature);
const smoothChanged = method(result.sources.get('games/geoblox/dm.java'), smoothSignature) + '\n' + method(result.sources.get('games/geoblox/dm.java'), '    private static void dekoSmoothRotate(') + '\n' + method(result.sources.get('games/geoblox/dm.java'), '    private static void dekoBilinearSample(');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'layer-dirty-'));
try {
 fs.writeFileSync(path.join(dir,'Check.java'), `import java.util.*;
class vb { static int field_f=640,field_e=0,field_i=0,field_k=640,field_d=640; static int[] field_c; ${layerTrackerJava} }
class Original { ${original} }
class Changed { ${patched} }
class Sprite { int[] field_v; int field_r=16,field_m=16,field_u=0,field_p=0; }
class OriginalRotation extends Sprite { ${rotationOriginal} }
class ChangedRotation extends Sprite { ${rotationChanged} }
class OriginalOutline { ${outlineOriginal} }
class ChangedOutline { ${outlineChanged} }
class OriginalSmooth extends Sprite { ${smoothOriginal} }
class ChangedSmooth extends Sprite { ${smoothChanged} }
class Check {
 static Random r=new Random(717);
 static void compare(int[] layer,int x,int y,int width,int height,int ss,int ds,boolean alias){
  int[] source=layer.clone(),actualSource=layer.clone();
  int[] expected=alias?source:new int[307200],actual=alias?actualSource:new int[307200];
  if(!alias)for(int i=0;i<actual.length;i++)actual[i]=expected[i]=r.nextInt();
  int[] tracked=vb.dekoLayer;vb.dekoLayer=actualSource;
  Class<?> a=null,b=null;
  try{Original.b(expected,source,0,x,y,width,height,ds,ss);}catch(RuntimeException e){a=e.getClass();}
  try{Changed.b(actual,actualSource,0,x,y,width,height,ds,ss);}catch(RuntimeException e){b=e.getClass();}
  vb.dekoLayer=tracked;
  if(a!=b||!Arrays.equals(actual,expected))throw new AssertionError("blit mismatch");
 }
 public static void main(String[] args){
  int[] layer=new int[409600];vb.dekoLayerRegister(layer);
  if(vb.dekoLayerKnown)throw new AssertionError("registration trusts old contents");
  int checks=0;
  for(int round=0;round<300;round++){
   Arrays.fill(layer,0);vb.dekoLayerCleared(layer,layer.length);
   for(int n=0;n<8;n++){
    int x=r.nextInt(620),y=r.nextInt(620),w=r.nextInt(20),h=r.nextInt(20);
    vb.dekoLayerMark(layer,640,x,y,x+w,y+h);
    for(int yy=y;yy<y+h;yy++)for(int xx=x;xx<x+w;xx++)layer[yy*640+xx]=r.nextInt();
   }
   compare(layer,0,0,640,480,0,0,false);checks++;
   compare(layer,0,0,640,480,0,0,true);checks++;
   compare(layer,3,5,100,80,540,540,false);checks++;
   vb.dekoLayerInvalidate(layer);layer[0]=5;compare(layer,0,0,640,480,0,0,false);checks++;
   vb.dekoLayerCleared(layer,10);if(vb.dekoLayerKnown)throw new AssertionError("partial clear");
  }
  Arrays.fill(layer,0);vb.dekoLayerCleared(layer,layer.length);
  vb.dekoLayerMark(layer,640,0,0,1,1);vb.dekoLayerOutline(layer,640);
  if(vb.dekoLayerLeft!=0||vb.dekoLayerRight!=640||vb.dekoLayerBottom!=3)throw new AssertionError("outline wrapping");
  vb.dekoLayerMark(layer,320,0,0,1,1);if(vb.dekoLayerKnown)throw new AssertionError("bad stride");
  for(int n=0;n<120;n++){
   OriginalRotation a=new OriginalRotation();ChangedRotation b=new ChangedRotation();
   a.field_v=new int[256];for(int i=0;i<256;i++)a.field_v[i]=r.nextBoolean()?r.nextInt():0;b.field_v=a.field_v.clone();
   int x=(n%6==0?0:n%6==1?639:r.nextInt(640))*16,y=r.nextInt(640)*16;
   int angle=r.nextInt(65536),scale=n%3==0?-4096:n%3==1?2048:8192;
   int[] expected=new int[409600],actual=new int[409600];
   OriginalSmooth sa=new OriginalSmooth();ChangedSmooth sb=new ChangedSmooth();sa.field_v=a.field_v;sb.field_v=b.field_v;
   vb.field_c=expected;if(n%2==0)a.b(128,128,x,y,angle,scale);else sa.a(128,128,x,y,angle,scale);
   vb.field_c=actual;vb.dekoLayerRegister(actual);vb.dekoLayerCleared(actual,actual.length);
   if(n%2==0)b.b(128,128,x,y,angle,scale);else sb.a(128,128,x,y,angle,scale);
   if(!Arrays.equals(expected,actual))throw new AssertionError("rotation pixels");
   OriginalOutline.a(expected,2*640+2,0,0,0,0,636,636,4);
   ChangedOutline.a(actual,2*640+2,0,0,0,0,636,636,4);
   if(!Arrays.equals(expected,actual))throw new AssertionError("outline pixels");
   if(vb.dekoLayerKnown)for(int i=0;i<actual.length;i++)if(actual[i]!=0 &&
    (i%640<vb.dekoLayerLeft||i%640>=vb.dekoLayerRight||i/640<vb.dekoLayerTop||i/640>=vb.dekoLayerBottom))throw new AssertionError("untracked pixel");
   compare(actual,0,0,640,480,0,0,false);checks++;
  }
  vb.dekoLayerRegister(null);if(vb.dekoLayer!=null||vb.dekoLayerKnown)throw new AssertionError("release");
  System.out.println("PASS "+checks+" pixel/alias/fallback comparisons; lifecycle and source guards");
 }
}`);
 execFileSync('javac',[path.join(dir,'Check.java')],{stdio:'pipe'});
 process.stdout.write(execFileSync('java',['-cp',dir,'Check'],{encoding:'utf8'}));
} finally {fs.rmSync(dir,{recursive:true,force:true});}
