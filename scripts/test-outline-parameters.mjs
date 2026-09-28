import assert from 'node:assert/strict';
import {patchOutlineOutputParameters} from '../apps/launcher/browser-loader/outline-output-parameters.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {patchOutlineParameters, patchRotationParameters} from '../apps/launcher/browser-loader/game-source-patches.mjs';

const sourcePath = 'games/geoblox/dm.java';
const source = fs.readFileSync('../funorb-decompiled/' + sourcePath, 'utf8');
const parameterized = patchOutlineParameters(source, sourcePath);
const outputParameters = process.env.OUTLINE_OUTPUT_PARAMETERS === '1';
const changed = outputParameters ? patchOutlineOutputParameters(parameterized, sourcePath) : parameterized;
if (outputParameters) {
  assert.notEqual(changed, parameterized);
  assert.equal(patchOutlineOutputParameters(changed, sourcePath), changed);
  assert.equal(patchOutlineOutputParameters(parameterized, 'games/other/dm.java'), parameterized);
}
assert.notEqual(changed, source);
assert.equal(patchOutlineParameters(changed, sourcePath), changed);
assert.equal(patchOutlineParameters(source, 'games/other/dm.java'), source);
assert.notEqual(patchOutlineParameters(patchRotationParameters(source, sourcePath), sourcePath),
  patchRotationParameters(source, sourcePath));
const signature = '    final void g(int param0) {';
for (const invalid of [
  source.replace(signature, signature + '\ncallback();'),
  source.replace(signature, signature + '\nthis.field_r++;'),
  source.replace(signature, signature + '\nthis.field_r <<= 1;'),
  source.replace(signature, signature + '\nint other = this.other;'),
  'volatile int diagnostic;\n' + source,
]) assert.ok(patchOutlineParameters(invalid, sourcePath) === invalid, 'reject changed state or calls');

function method(text, signature) {
  const start = text.indexOf(signature);
  assert.ok(start >= 0);
  let end = text.indexOf('{', start), depth = 1;
  for (end++; depth; end++) {
    assert.ok(end < text.length);
    if (text[end] === '{') depth++;
    else if (text[end] === '}') depth--;
  }
  return text.slice(start, end);
}
const originalBody = method(source, 'final void g(int param0)');
const changedBody = method(changed, 'final void g(int param0)') + '\n' +
  method(changed, 'private static int[] dekoOutline(') + (outputParameters ? '\n' +
  method(changed, 'private static void dekoOutlineInto(') : '');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-parameters-'));
try {
  fs.writeFileSync(path.join(directory, 'OutlineTest.java'), `
import java.util.*;
class Original { int field_r, field_m; int[] field_v; ${originalBody} }
class Changed { int field_r, field_m; int[] field_v; ${changedBody} }
public class OutlineTest {
  public static void main(String[] args) {
    Random random = new Random(47012); int cases = 0;
    for (int width : new int[]{-3,-1,0,1,2,9,53})
    for (int height : new int[]{-3,-1,0,1,2,9,53})
    for (int color : new int[]{0,1,-1,Integer.MAX_VALUE})
    for (int shape = 0; shape < 5; shape++)
    for (int trial = 0; trial < 20; trial++) {
      int length = Math.max(0,width*height);
      int[] input = shape == 0 ? null : new int[shape == 1 ? 0 :
        shape == 2 ? Math.max(0,length-1) : shape == 3 ? length : length+1];
      if (input != null) for (int i=0;i<input.length;i++) input[i] = random.nextInt(4)==0 ? random.nextInt() : 0;
      Original a = new Original(); Changed b = new Changed();
      a.field_r=b.field_r=width; a.field_m=b.field_m=height;
      a.field_v=input==null?null:input.clone(); b.field_v=input==null?null:input.clone();
      int[] oldA=a.field_v, oldB=b.field_v;
      Class<?> errorA=null,errorB=null;
      try { a.g(color); } catch (RuntimeException e) { errorA=e.getClass(); }
      try { b.g(color); } catch (RuntimeException e) { errorB=e.getClass(); }
      if (errorA!=errorB || !Arrays.equals(a.field_v,b.field_v) ||
          !Arrays.equals(oldA,input) || !Arrays.equals(oldB,input) ||
          (a.field_v==oldA)!=(b.field_v==oldB) ||
          (errorA!=null && (a.field_v!=oldA || b.field_v!=oldB)))
        throw new AssertionError("Mismatch " + width + "x" + height + " shape=" + shape);
      cases++;
    }
    System.out.println("PASS: " + cases + " exact rasters, exceptions, source preservation and publication checks");
  }
}
`);
  execFileSync('javac', [path.join(directory, 'OutlineTest.java')]);
  process.stdout.write(execFileSync('java', ['-cp', directory, 'OutlineTest']));
} finally {
  fs.rmSync(directory, {recursive: true, force: true});
}
