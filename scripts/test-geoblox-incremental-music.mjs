import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchGeobloxIncrementalMusic as patch} from '../apps/launcher/browser-loader/game-source-patches.mjs';
const root=path.resolve('../funorb-decompiled/games/geoblox');
test('incremental music preserves initialization, ordering and completion',()=>{
 const original=fs.readFileSync(path.join(root,'jg.java'),'utf8');
 const source=patch(original,'games/geoblox/jg.java');
 assert.notEqual(source,original);
 assert.equal(patch(source,'games/geoblox/jg.java'),source);
 assert.equal(patch(original,'games/other/jg.java'),original);
 assert.equal(source.includes('uh.field_y.a(te.field_c, 0, -1,'),false);
 assert.match(source,/public static void c\(int param0\) \{\n        dekoMusicStage = 0;/);
 const game=fs.readFileSync(path.join(root,'Geoblox.java'),'utf8');
 const patchedGame=patch(game,'games/geoblox/Geoblox.java');
 assert.match(patchedGame,/if \(!jg.dekoLoadMusic\([^\n]+\)\) return false;\n            jg.a/);
 assert.equal(patch(patchedGame,'games/geoblox/Geoblox.java'),patchedGame);
 const helper=source.slice(source.indexOf('    // deko-incremental-music'),source.lastIndexOf('}'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'incremental-music-'));
 try {
  fs.writeFileSync(path.join(dir,'Probe.java'),`class Probe {
${helper}
 public static void main(String[] args) {
  rh a=new rh(),b=new rh(),c=new rh(),d=new rh();
  for(int i=1;i<=12;i++) {
   boolean done=dekoLoadMusic(a,b,c,d);
   if(done!=(i==12)||uh.field_y.calls!=i) throw new AssertionError("completion");
   if(ag.field_j[1]!=(i>=3)) throw new AssertionError("sun readiness");
  }
  if(!dekoLoadMusic(a,b,c,d)||uh.field_y.calls!=12) throw new AssertionError("repeat");
  if(ci.created!=1||rf.created!=4) throw new AssertionError("reinitialization");
  System.out.println("PASS");
 }
}
class rh {}
class rf {static int created;String name;static rf a(rh x,String y,String n){rf r=new rf();r.name=n;created++;return r;}}
class kf {static rh field_c;} class sl {static rh field_l;}
class p {static ue field_i;} class ue {ue(int a,int b){}} class qk {static int field_j=22050;}
class ll {static rf field_d;} class pi {static rf field_S;} class hf {static rf field_d;} class qf {static rf field_bb;}
class te {static ci field_c;} class ci {static int created;ci(rh a,rh b){created++;}}
class ag {static boolean[] field_j=new boolean[7];}
class uh {static Mixer field_y=new Mixer();}
class Mixer {int calls;boolean a(ci c,int budget,int sentinel,rf track,rh archive){
 String[] order={"sun","bonus_bubble_jingle","game_over","title_music_loop"};
 if(budget!=8192||sentinel!=-1||!track.name.equals(order[calls/3])) throw new AssertionError("request");
 calls++;return calls%3==0;
}}
`);
  execFileSync('javac',[path.join(dir,'Probe.java')]);
  assert.equal(execFileSync('java',['-cp',dir,'Probe'],{encoding:'utf8'}).trim(),'PASS');
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
