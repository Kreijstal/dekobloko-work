import {extractMethod as method, compareRendererParameters} from './lib/renderer-parameter-fixture.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { patchSmoothRotationParameters, patchRotationParameters, patchOutlineParameters } from '../apps/launcher/browser-loader/game-source-patches.mjs';
const sourcePath = 'games/geoblox/dm.java';
const source = fs.readFileSync(new URL('../../funorb-decompiled/' + sourcePath, import.meta.url), 'utf8');
const patched = patchSmoothRotationParameters(source, sourcePath);
assert.notEqual(patched, source);
assert.equal(patchSmoothRotationParameters(patched, sourcePath), patched);
assert.equal(patchSmoothRotationParameters(source, 'games/other/dm.java'), source);
const changedShape = source.replaceAll('this.field_v', 'this.otherPixels');
assert.equal(patchSmoothRotationParameters(changedShape, sourcePath), changedShape);
for (const changed of [source.replaceAll('this.field_r', 'this.field_r++'),
  source.replaceAll('this.field_r', '(this.field_r <<= 1)'),
  source.replaceAll('Math.sin(', 'callback.sin(')]) {
  assert.equal(patchSmoothRotationParameters(changed, sourcePath), changed);
}

const anchor = '    final void a(int param0, int param1, int param2, int param3, int param4, int param5) {';

const sampleAnchor = '    private final void c(int param0, int param1, int param2, int param3, int param4) {';
for (const invalid of [
  source.replace(anchor, anchor + '\nint dekoSource = 0;'),
  source.replace(sampleAnchor, sampleAnchor + '\ncallback();'),
  source.replace(sampleAnchor, sampleAnchor + '\nthis.field_r >>= 1;'),
]) assert.ok(patchSmoothRotationParameters(invalid, sourcePath) === invalid);
const combined = patchSmoothRotationParameters(patchOutlineParameters(
  patchRotationParameters(source, sourcePath), sourcePath), sourcePath);
for (const helper of ['dekoSmoothRotate', 'dekoBilinearSample', 'dekoRotate', 'dekoOutline']) {
  assert.ok(combined.includes(helper), 'helper patches compose: ' + helper);
}
const sampleAdapter = 'void sample(int dst, int x, int y, int fx, int fy) { c(dst, x, y, fx, fy); }';
const a = method(source, anchor) + '\n' + method(source, sampleAnchor) + '\n' + sampleAdapter;
const b = method(patched, anchor) + '\n' + method(patched, sampleAnchor) + '\n' + sampleAdapter + '\n' +
  method(patched, '    private static void dekoSmoothRotate(') + '\n' +
  method(patched, '    private static void dekoBilinearSample(');
compareRendererParameters({originalJava: a, changedJava: b, methodName: 'a', sampleMode: true});
