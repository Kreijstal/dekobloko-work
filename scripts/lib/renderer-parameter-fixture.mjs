import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// The guarded renderer bodies contain no string/comment braces. Fail loudly
// on absent or ambiguous signatures instead of compiling an accidental slice.
export function extractMethod(text, signature) {
  const start = text.indexOf(signature);
  assert.ok(start >= 0 && text.indexOf(signature, start + 1) < 0, 'unique method: ' + signature);
  const body = text.indexOf('{', start);
  assert.ok(body >= 0);
  let depth = 1, end = body + 1;
  for (; depth && end < text.length; end++) {
    if (text[end] === '{') depth++;
    if (text[end] === '}') depth--;
  }
  assert.equal(depth, 0, 'balanced method: ' + signature);
  return text.slice(start, end);
}

// Both rotation variants use the same raster/alias/error matrix. The smooth
// variant additionally exercises its private sampler through a test adapter.
export function compareRendererParameters({originalJava, changedJava, methodName,
  sampleMode = false, label = 'exact renderer raster/exception cases'}) {
  assert.ok(['a', 'b'].includes(methodName));
  assert.match(label, /^[a-zA-Z /]+$/);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-parameters-'));
try {
  fs.writeFileSync(path.join(root, 'RendererTest.java'), `
import java.util.*;
abstract class DrawingState {
  int field_r, field_m, field_u, field_p;
  int[] field_v;
  abstract void ${methodName}(int x, int y, int px, int py, int angle, int scale);
}
class Original extends DrawingState { ${originalJava} }
class Changed extends DrawingState { ${changedJava} }
class vb {
  static int field_e, field_k, field_i, field_d, field_f;
  static int[] field_c;
}
public class RendererTest {
  static boolean sampling;
  static void verify(Original original, int[] input, boolean alias,
                     int x, int y, int px, int py, int angle, int scale) {
    Changed changed = new Changed();
    changed.field_r = original.field_r;
    changed.field_m = original.field_m;
    changed.field_u = original.field_u;
    changed.field_p = original.field_p;
    changed.field_v = original.field_v == null ? null : original.field_v.clone();
    vb.field_c = input == null ? null : input.clone();
    if (alias) original.field_v = vb.field_c;
    Class<?> expectedError = null;
    Class<?> actualError = null;
    try { ${sampleMode ? 'if (sampling) original.sample(x, y, px, py, angle); else ' : ''}original.${methodName}(x, y, px, py, angle, scale); }
    catch (RuntimeException error) { expectedError = error.getClass(); }
    int[] expected = vb.field_c;
    int[] expectedSource = original.field_v;
    vb.field_c = input == null ? null : input.clone();
    if (alias) changed.field_v = vb.field_c;
    try { ${sampleMode ? 'if (sampling) changed.sample(x, y, px, py, angle); else ' : ''}changed.${methodName}(x, y, px, py, angle, scale); }
    catch (RuntimeException error) { actualError = error.getClass(); }
    if (expectedError != actualError || !Arrays.equals(expected, vb.field_c)
        || !Arrays.equals(expectedSource, changed.field_v)) {
      throw new AssertionError("raster/exception mismatch: " + original.field_r
          + "x" + original.field_m + " angle=" + angle + " scale=" + scale);
    }
  }

  public static void main(String[] args) {
    Random random = new Random(487);
    int cases = 0;
    int[] boundaryAngles = {1,16383,16384,16385,32767,32768,
                            32769,49151,49152,49153,65534,65535};
    for (int width : new int[]{1,8,36,53})
    for (int height : new int[]{1,8,36,53})
    for (int mode = 0; mode < 4; mode++)
    for (int scale : new int[]{0,2048,4096,8192,-4096})
    for (int angleIndex = 0; angleIndex < 529; angleIndex++) {
      int angle = angleIndex < 517 ? angleIndex * 127 : boundaryAngles[angleIndex - 517];
      Original original = new Original();
      original.field_r = width;
      original.field_m = height;
      original.field_u = mode == 3 ? 2 : 0;
      original.field_p = mode == 3 ? 3 : 0;
      original.field_v = new int[width * height];
      for (int i = 0; i < original.field_v.length; i++) {
        original.field_v[i] = random.nextBoolean() ? random.nextInt() : 0;
      }
      vb.field_f = 80;
      vb.field_e = mode == 1 ? 10 : 0;
      vb.field_i = mode == 1 ? 13 : 0;
      vb.field_k = mode == 1 ? 39 : 80;
      vb.field_d = mode == 1 ? 40 : 80;
      int[] input = new int[6400];
      Arrays.fill(input, 0x998877);
      verify(original, input, false, width * 8, height * 8,
             mode == 2 ? -80 : 640, mode == 2 ? 50 : 640, angle, scale);
      cases++;
    }

    for (int mode = 0; mode < 5; mode++)
    for (int scale : new int[]{0,2048,4096,-4096})
    for (int angle : new int[]{0,1,16384,32768,65535}) {
      Original original = new Original();
      original.field_r = original.field_m = 8;
      original.field_v = mode == 0 ? null : new int[mode == 1 ? 2 : 64];
      if (original.field_v != null) Arrays.fill(original.field_v, 0x998877);
      int[] input = mode == 2 ? null : new int[mode == 3 ? 4 : 6400];
      if (input != null) Arrays.fill(input, 0x334455);
      vb.field_f = 80;
      vb.field_e = vb.field_i = 0;
      vb.field_k = vb.field_d = 80;
      verify(original, input, mode == 4, 64, 64, 640, 640, angle, scale);
      cases++;
    }
    ${sampleMode ? `    sampling = true;
    for (int mode = 0; mode < 5; mode++)
    for (int dst : new int[]{-1,0,3,63,64})
    for (int x : new int[]{-1,0,3,7,8})
    for (int y : new int[]{-1,0,3,7,8})
    for (int fx : new int[]{-1,0,1,2048,4095,8192})
    for (int fy : new int[]{-1,0,1,2048,4095,8192}) {
      Original original = new Original();
      original.field_r = original.field_m = 8;
      original.field_v = mode == 0 ? null : new int[mode == 1 ? 2 : 64];
      if (original.field_v != null) for (int i=0;i<original.field_v.length;i++)
        original.field_v[i] = random.nextBoolean() ? random.nextInt() : 0;
      int[] input = mode == 2 ? null : new int[mode == 3 ? 4 : 64];
      if (input != null) Arrays.fill(input, 0x334455);
      verify(original, input, mode == 4, dst, x, y, fx, fy, 0);
      cases++;
    }
` : ''}
    System.out.println("PASS " + cases + " ${label}");
  }
}
`);
  execFileSync('javac', [path.join(root, 'RendererTest.java')], { timeout: 30000 });
  process.stdout.write(execFileSync('java', ['-Xmx128m', '-cp', root, 'RendererTest'],
    { timeout: 60000 }));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

}
