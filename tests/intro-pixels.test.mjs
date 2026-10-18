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

test('framebuffer conversion respects offsets, alignment and destination bounds', () => {
  const pixels = new Int32Array(1024);
  let state = 0x12345678;
  const expected = [];
  for (let i = 0; i < pixels.length; i++) {
    state ^= state << 13;state ^= state >>> 17;state ^= state << 5;
    pixels[i] = state;
    expected.push((state >>> 16) & 255, (state >>> 8) & 255, state & 255, 255);
  }
  for (const offset of [0, 1, 4, 7, 16]) {
    const storage = new Uint8Array(offset + pixels.length * 4 + 9).fill(73);
    const output = new Uint8ClampedArray(storage.buffer, offset, pixels.length * 4);
    copyRgbToRgba(pixels, output);
    assert.deepEqual([...output], expected);
    assert.ok(storage.subarray(0, offset).every(value => value === 73));
    assert.ok(storage.subarray(offset + output.length).every(value => value === 73));
  }
  const plain = new Array(pixels.length * 4);
  copyRgbToRgba(pixels, plain);
  assert.deepEqual(plain, expected);
  copyRgbToRgba(new Int32Array(), new Uint8ClampedArray());
});
