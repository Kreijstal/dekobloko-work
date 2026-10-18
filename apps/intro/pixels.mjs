// Java's raster contains packed RGB ints; ImageData uses clamped RGBA bytes.
const littleEndian = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;

export function copyRgbToRgba(pixels, rgba) {
  if (rgba.length !== pixels.length * 4) throw new RangeError('Wrong framebuffer size');
  if (littleEndian && ArrayBuffer.isView(rgba) && rgba.BYTES_PER_ELEMENT === 1 &&
      (rgba.byteOffset & 3) === 0) {
    const output = new Uint32Array(rgba.buffer, rgba.byteOffset, pixels.length);
    for (let i = 0; i < pixels.length; i++) {
      const value = pixels[i];
      output[i] = 0xff000000 | ((value >>> 16) & 255) |
        (value & 0xff00) | ((value & 255) << 16);
    }
    return;
  }
  for (let i = 0, p = 0; i < pixels.length; i++, p += 4) {
    const value = pixels[i];
    rgba[p] = (value >>> 16) & 255;
    rgba[p + 1] = (value >>> 8) & 255;
    rgba[p + 2] = value & 255;
    rgba[p + 3] = 255;
  }
}
