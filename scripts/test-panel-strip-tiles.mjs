import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchPanelStripTiles} from '../apps/launcher/browser-loader/panel-strip-tiles.mjs';

const sourceDir = path.resolve(process.env.GEOBLOX_SOURCE_DIR || '../funorb-decompiled/games/geoblox');
function method(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, signature);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed method');
}

test('panel-strip patch preserves real Java raster output and clipping', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'ma.java'), 'utf8');
  const patched = patchPanelStripTiles(source, 'games/geoblox/ma.java');
  assert.notEqual(patched, source);
  assert.equal(patchPanelStripTiles(patched, 'games/geoblox/ma.java'), patched, 'idempotent');
  assert.equal(patchPanelStripTiles(source, 'games/other/ma.java'), source);
  assert.equal(patchPanelStripTiles('unrecognized source', 'games/geoblox/ma.java'), 'unrecognized source');
  const signature = 'final static void a(int param0, int param1, int param2, byte param3, int param4, dm[] param5)';
  const sprite = fs.readFileSync(path.join(sourceDir, 'dm.java'), 'utf8');
  const raster = fs.readFileSync(path.join(sourceDir, 'vb.java'), 'utf8');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'panel-strip-test-'));
  try {
    fs.writeFileSync(path.join(directory, 'PanelCheck.java'), `
import java.util.Arrays;
class Original { ${method(source, signature)} }
class Patched { ${method(patched, signature)} ${method(patched, 'private static boolean dekoPanelStrip(')} }
class Geoblox { static int field_C; }
class hd { static int[] field_I = new int[4]; }
class t { static RuntimeException a(Throwable error, String text) {return new RuntimeException(text,error);} }
class dm {
 int field_s=1,field_o=1,field_r=1,field_m=1,field_u=0,field_p=0;
 int[] field_v; static int draws;
 dm(int color) {field_v=new int[]{color};}
 ${method(sprite,'void b(int param0, int param1)').replace('{','{ draws++;')}
 ${method(sprite,'private final static void b(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8)')}
}
class Fancy extends dm {
 Fancy(){super(0x336699);}
 void b(int x,int y) {super.b(x,y);if(x>=vb.field_e&&x<vb.field_k&&y>=vb.field_i&&y<vb.field_d)vb.field_c[y*vb.field_f+x]^=0x010101;}
}
class vb {
 static int field_e,field_i,field_k,field_d,field_f=32; static int[] field_c,field_a,field_l;
 ${method(raster,'private final static void b()')}
 ${method(raster,'final static void a(int[] param0)')}
 ${method(raster,'final static void b(int[] param0)')}
 ${method(raster,'final static void b(int param0, int param1, int param2, int param3)')}
 ${method(raster,'final static void a(int param0, int param1, int param2, int param3, int param4)')}
}
public class PanelCheck {
 public static void main(String[] args) {
  int cases=0,saved=0;
  for(int shape=0;shape<8;shape++)for(int clip=0;clip<2;clip++)
  for(int x=-3;x<=12;x+=3)for(int y=-2;y<=10;y+=4)
  for(int w:new int[]{0,1,8,30})for(int h:new int[]{0,1,7,25}) {
   dm[] tiles=new dm[9];
   for(int edge:new int[]{1,3,5,7}) {
    boolean horizontal=edge==1||edge==7;
    dm tile=shape==4?new Fancy():new dm(0);
    int thickness=shape==5?15:3;
    tile.field_r=tile.field_s=horizontal?1:thickness;
    tile.field_m=tile.field_o=horizontal?thickness:1;
    if(shape==6){tile.field_r=tile.field_s=3;tile.field_m=tile.field_o=3;}
    tile.field_v=new int[tile.field_r*tile.field_m];
    for(int i=0;i<tile.field_v.length;i++)tile.field_v[i]=shape==1||shape==2&&i%2==0?0:0x336699+i*29+edge;
    if(shape==3){tile.field_s++;tile.field_o++;tile.field_u=tile.field_p=1;}
    if(shape==7){tile.field_v=Arrays.copyOf(tile.field_v,tile.field_v.length+1);}
    tiles[edge]=tile;
   }
   int[] bounds=clip==0?new int[]{0,0,32,24}:new int[]{4,3,22,18};
   vb.field_c=new int[32*24];Arrays.fill(vb.field_c,0x112233);vb.b(bounds);dm.draws=0;
   Original.a(y,x,h,(byte)-92,w,tiles);
   int[] expected=vb.field_c.clone(),expectedClip=new int[4];vb.a(expectedClip);int originalDraws=dm.draws;
   vb.field_c=new int[32*24];Arrays.fill(vb.field_c,0x112233);vb.b(bounds);dm.draws=0;
   Patched.a(y,x,h,(byte)-92,w,tiles);
   int[] actualClip=new int[4];vb.a(actualClip);
   if(!Arrays.equals(expected,vb.field_c)||!Arrays.equals(expectedClip,actualClip))throw new AssertionError("shape="+shape+" x="+x+" y="+y+" w="+w+" h="+h);
   saved+=originalDraws-dm.draws;cases++;
  }
  if(saved<=0)throw new AssertionError("No draws eliminated");
  System.out.println(cases+" pixel-equivalent cases; "+saved+" sprite calls eliminated");
 }
}`);
    execFileSync('javac', ['PanelCheck.java'], {cwd: directory});
    const output = execFileSync('java', ['PanelCheck'], {cwd: directory, encoding: 'utf8'});
    assert.match(output, /pixel-equivalent cases; [1-9][0-9]* sprite calls eliminated/);
    console.log(output.trim());
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});
