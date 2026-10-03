import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchMusicBudgetExit as patch} from '../apps/launcher/browser-loader/music-budget-exit.mjs';

test('bounded music requests stop scanning and preserve eventual completion',()=>{
 const source=fs.readFileSync(path.resolve('../funorb-decompiled/games/geoblox/kj.java'),'utf8');
 const patched=patch(source,'games/geoblox/kj.java');
 assert.notEqual(patched,source);
 assert.equal(patch(patched,'games/geoblox/kj.java'),patched);
 assert.equal(patch(source,'games/other/kj.java'),source);
 assert.equal(patch('unknown','games/geoblox/kj.java'),'unknown');
 const signature='final synchronized boolean a(ci param0, int param1, int param2, rf param3, rh param4)';
 const extract=s=>{const start=s.indexOf(signature),end=s.indexOf('\n    private final void b(byte',start);assert(start>=0&&end>start);return s.slice(start,end);};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'music-budget-'));
 try {
 fs.writeFileSync(path.join(dir,'Check.java'),`
import java.util.*;
class Geoblox {static int field_C;}
class t {static RuntimeException a(Throwable e,String s){return new RuntimeException(s,e);}}
class ci {} class rh {int unavailable=-1;}
class pj {long field_a;byte[] field_h=new byte[1];pj(int n){field_a=n;}}
class Entries {pj[] all;int next;Entries(int n){all=new pj[n];for(int i=0;i<n;i++)all[i]=new pj(i);}
 Object a(byte b){next=0;return b(0);} Object b(int b){return next<all.length?all[next++]:null;}}
class rf {Entries field_g;int completed;rf(int n){field_g=new Entries(n);}void b(){}void a(){completed++;}}
class fi {Map<Long,vl> cache=new HashMap<>();Object a(long k,byte b){return cache.get(k);}void a(byte b,vl v,long k){cache.put(k,v);}}
class vl {static int attempts,scans;int remaining;vl(int id){remaining=3+id%3;}
 static vl a(int id,byte b,rh archive){attempts++;return id==archive.unavailable?null:new vl(id);}
 boolean a(int[] budget,byte[] mask,int sentinel,ci archive){scans++;int used=budget==null?remaining:Math.min(remaining,Math.max(0,budget[0]));remaining-=used;if(budget!=null)budget[0]-=used;return remaining==0;}}
class Original {fi field_q=new fi();${extract(source)}}
class Patched {fi field_q=new fi();${extract(patched)}}
public class Check {
 static void require(boolean value,String detail){if(!value)throw new AssertionError(detail);}
 public static void main(String[] args){
  int cases=0;
  for(int count:new int[]{0,1,2,9})for(int budget:new int[]{0,-1,1,3,8,100}){
   Original original=new Original();Patched patched=new Patched();rf a=new rf(count),b=new rf(count);rh archive=new rh();
   boolean oldDone=false,newDone=false;int oldScans=0,newScans=0;
   for(int i=0;i<100&&!oldDone;i++){vl.scans=0;oldDone=original.a(new ci(),budget,-1,a,archive);oldScans+=vl.scans;}
   for(int i=0;i<100&&!newDone;i++){vl.scans=0;newDone=patched.a(new ci(),budget,-1,b,archive);newScans+=vl.scans;}
   require(oldDone&&newDone,"eventual completion");require(a.completed==1&&b.completed==1,"cleanup exactly once");
   require(original.field_q.cache.size()==patched.field_q.cache.size(),"instrument cache");
   for(long key:original.field_q.cache.keySet())require(original.field_q.cache.get(key).remaining==patched.field_q.cache.get(key).remaining,"decoded samples");
   if(budget<=0)require(oldScans==newScans,"unlimited path unchanged");cases++;
  }
  Patched p=new Patched();rf track=new rf(9);vl.attempts=vl.scans=0;
  require(!p.a(new ci(),1,-1,track,new rh()),"incomplete request");
  require(vl.attempts==1&&vl.scans==1,"stop scanning exhausted request");
  rh missing=new rh();missing.unavailable=1;p=new Patched();track=new rf(3);
  for(int i=0;i<20;i++)require(!p.a(new ci(),2,-1,track,missing),"missing instrument must not complete");
  require(track.completed==0,"no premature cleanup");missing.unavailable=-1;
  boolean done=false;for(int i=0;i<20&&!done;i++)done=p.a(new ci(),2,-1,track,missing);
  require(done&&track.completed==1,"retry unavailable instrument");
  System.out.println(cases+" completion comparisons; exhausted budget and missing instrument checks passed");
 }
}`);
 execFileSync('javac',['Check.java'],{cwd:dir});
 const output=execFileSync('java',['Check'],{cwd:dir,encoding:'utf8'});
 assert.match(output,/24 completion comparisons/);console.log(output.trim());
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
