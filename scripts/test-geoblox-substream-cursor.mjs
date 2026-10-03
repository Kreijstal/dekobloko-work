import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchGeobloxSubstreamCursor as patch, patchGeobloxSource} from '../apps/launcher/browser-loader/game-source-patches.mjs';
test('audio enumeration cannot invalidate the synth reset cursor',()=>{
 const original=fs.readFileSync('../funorb-decompiled/games/geoblox/ad.java','utf8');
 const patched=patch(original,'games/geoblox/ad.java');
 assert.notEqual(patched,original);
 assert.equal(patchGeobloxSource(original,'games/geoblox/ad.java','unused'),patched);
 assert.equal(patch(patched,'games/geoblox/ad.java'),patched);
 assert.equal(patch(original,'games/other/ad.java'),original);
 const end='    private final void a(int param0, byte param1, int param2, int[] param3, pc param4, int param5) {';
 const body=patched.slice(patched.indexOf('    // deko-substream-cursor'),patched.indexOf(end));
 const old=original.slice(original.indexOf('    final ia c() {'),original.indexOf(end));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'substream-cursor-'));
 try {
  fs.writeFileSync(path.join(dir,'Probe.java'),`
class hf {hf field_b;}
class ia {int id;ia(){}ia(int n){id=n;}}
class pc extends hf {ia field_u;pc(int id){if(id!=0)field_u=new ia(id);}}
class kj {}
class Geoblox {static int field_C;}
class tf {hf field_a=new hf(),cursor;tf(){field_a.field_b=field_a;}
 hf g(int n){hf x=field_a.field_b;cursor=x==field_a?null:x.field_b;return x==field_a?null:x;}
 hf d(int n){hf x=cursor;if(x==field_a){cursor=null;return null;}cursor=x.field_b;return x;}
 void init(){pc a=new pc(1),b=new pc(0),c=new pc(3);field_a.field_b=a;a.field_b=b;b.field_b=c;c.field_b=field_a;}}
class ad extends ia {kj field_k=new kj();tf field_l=new tf();ad(){field_l.init();}${body}}
class Old extends ia {tf field_l=new tf();Old(){field_l.init();}${old}}
public class Probe {public static void main(String[] args){
 Old old=new Old();old.field_l.g(0);while(old.b()!=null){while(old.c()!=null){}break;}
 boolean failed=false;try{old.field_l.d(1);}catch(NullPointerException expected){failed=true;}
 if(!failed)throw new AssertionError("baseline must reproduce the cursor race");
 ad a=new ad();hf first=a.field_l.g(0);
 if(a.b().id!=1||a.c().id!=3||a.c()!=null)throw new AssertionError("stream order");
 if(a.field_l.d(1)!=first.field_b)throw new AssertionError("reset cursor changed");
 a=new ad();if(a.b().id!=1)throw new AssertionError();
 for(hf n=a.field_l.g(0);n!=null;n=a.field_l.d(1)){}
 if(a.c().id!=3||a.c()!=null)throw new AssertionError("enumeration cursor changed");
 a=new ad();a.b();hf removed=a.field_l.field_a.field_b.field_b;removed.field_b=null;
 if(a.c()!=null)throw new AssertionError("removed pending voice");
 a.field_l.field_a.field_b=a.field_l.field_a;
 if(a.b()!=null||a.c()!=null)throw new AssertionError("empty list");
 System.out.println("PASS");}}
`);
  execFileSync('javac',[path.join(dir,'Probe.java')]);
  assert.equal(execFileSync('java',['-cp',dir,'Probe'],{encoding:'utf8'}).trim(),'PASS');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
