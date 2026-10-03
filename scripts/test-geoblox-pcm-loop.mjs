import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchGeobloxPcmLoop} from '../apps/launcher/browser-loader/game-source-patches.mjs';

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

test('PCM loop extraction preserves budgets, samples, state and exceptions', () => {
  const source = fs.readFileSync(path.resolve(process.env.GEOBLOX_SOURCE_DIR || '../funorb-decompiled/games/geoblox', 'ua.java'), 'utf8');
  const patched = patchGeobloxPcmLoop(source, 'games/geoblox/ua.java');
  assert.notEqual(patched, source);
  assert.equal(patchGeobloxPcmLoop(patched, 'games/geoblox/ua.java'), patched);
  assert.equal(patchGeobloxPcmLoop(source, 'games/other/ua.java'), source);
  const changed = source.replace('return new gd(this.field_q, var12,', 'return new gd(123, var12,');
  assert.equal(patchGeobloxPcmLoop(changed, 'games/geoblox/ua.java'), changed);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pcm-loop-test-'));
  try {
    fs.writeFileSync(path.join(directory, 'PcmCheck.java'), `
import java.util.Arrays;
class Original extends State { ${method(source, 'final gd a(int[] param0)')} }
class Patched extends State {
 ${method(patched, 'final gd a(int[] param0)')}
 ${method(patched, 'final boolean dekoDecodePackets(int[] param0)')}
}
class gd {
 static boolean fail;
 byte[] samples; int rate,start,end; boolean loop;
 gd(int r,byte[] s,int a,int b,boolean l) {
  if(fail)throw new IllegalStateException("result");
  samples=s;rate=r;start=a;end=b;loop=l;
 }
 public String toString(){return rate+":"+start+":"+end+":"+loop+":"+Arrays.toString(samples);}
}
abstract class State {
 int field_M,field_J,field_x,field_H,field_q=22050,field_I=2,field_n=4;
 static int field_t=8;
 boolean field_A=true;
 byte[] field_E; float[] field_C;
 byte[][] field_p=new byte[3][];
 int calls,failPacket=-1;
 float[][] packets={null,{-2f,-1f,-0.25f,0f,0.5f,1f,2f},
   {Float.NaN,Float.POSITIVE_INFINITY,Float.NEGATIVE_INFINITY}};
 float[] c(int i){calls++;if(i==failPacket)throw new IllegalStateException("packet");return packets[i];}
 abstract gd a(int[] budget);
 String snapshot(){return field_M+":"+field_J+":"+field_x+":"+calls+":"+Arrays.toString(field_E)+":"+Arrays.toString(field_C);}
}
public class PcmCheck {
 static String step(State s,int budget,boolean failResult){
  int[] b=budget<0?null:new int[]{budget};
  gd.fail=failResult;
  String result;
  try{result=String.valueOf(s.a(b));}catch(RuntimeException e){result=e.getClass().getName()+":"+e.getMessage();}
  return result+"|"+Arrays.toString(b)+"|"+s.snapshot();
 }
 public static void main(String[] args){
  int cases=0;
  for(int size:new int[]{0,1,5,10,20})for(int budget:new int[]{-1,0,1,3,100})
  for(int failure:new int[]{-1,1,3}){
   State a=new Original(),b=new Patched();a.field_H=b.field_H=size;
   if(failure==1)a.failPacket=b.failPacket=1;
   for(int i=0;i<6;i++){
    String x=step(a,i==5?-1:budget,failure==3),y=step(b,i==5?-1:budget,failure==3);
    if(!x.equals(y))throw new AssertionError(size+"/"+budget+"/"+failure+": "+x+" != "+y);
    cases++;
   }
  }
  System.out.println("PASS "+cases+" differential steps");
 }
}
`);
    execFileSync('javac', ['PcmCheck.java'], {cwd:directory});
    const result = execFileSync('java', ['-cp', directory, 'PcmCheck'], {encoding:'utf8'});
    assert.match(result, /PASS 450 differential steps/);
  } finally {
    fs.rmSync(directory, {recursive:true, force:true});
  }
});
