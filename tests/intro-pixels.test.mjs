import test from 'node:test';
import assert from 'node:assert/strict';
import {copyRgbToRgba} from '../apps/intro/pixels.mjs';

test('packed raster colours survive clamped ImageData conversion', () => {
  const colours = new Int32Array([0, 0xff0000, 0x00ff00, 0x0000ff, 0x123456, 0xffffff, 0xff19ac5f]);
  const rgba = new Uint8ClampedArray(colours.length * 4);
  copyRgbToRgba(colours, rgba);
  assert.deepEqual([...rgba], [
    0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    0x12, 0x34, 0x56, 255, 255, 255, 255, 255, 0x19, 0xac, 0x5f, 255,
  ]);
  assert.throws(() => copyRgbToRgba(colours, new Uint8ClampedArray(4)), RangeError);
});
