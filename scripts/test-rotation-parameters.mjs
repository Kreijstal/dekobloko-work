import {extractMethod as method, compareRendererParameters} from './lib/renderer-parameter-fixture.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { patchRotationParameters } from '../apps/launcher/browser-loader/game-source-patches.mjs';
const sourcePath = 'games/geoblox/dm.java';
const source = fs.readFileSync(new URL('../../funorb-decompiled/' + sourcePath, import.meta.url), 'utf8');
const patched = patchRotationParameters(source, sourcePath);
assert.notEqual(patched, source);
assert.equal(patchRotationParameters(patched, sourcePath), patched);
assert.equal(patchRotationParameters(source, 'games/other/dm.java'), source);
const changedShape = source.replaceAll('this.field_v', 'this.otherPixels');
assert.equal(patchRotationParameters(changedShape, sourcePath), changedShape);
for (const changed of [source.replaceAll('this.field_r', 'this.field_r++'),
  source.replaceAll('this.field_r', '(this.field_r <<= 1)'),
  source.replaceAll('Math.sin(', 'callback.sin(')]) {
  assert.equal(patchRotationParameters(changed, sourcePath), changed);
}

const anchor = '    void b(int param0, int param1, int param2, int param3, int param4, int param5) {';

const a = method(source, anchor);
const b = method(patched, anchor) + '\n' + method(patched, '    private static void dekoRotate(');
compareRendererParameters({originalJava: a, changedJava: b, methodName: 'b', sampleMode: false});
