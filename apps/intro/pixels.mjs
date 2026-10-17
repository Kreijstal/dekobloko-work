// Java's raster contains packed RGB ints; ImageData uses clamped RGBA bytes.
export function copyRgbToRgba(pixels, rgba) {
  if (rgba.length !== pixels.length * 4) throw new RangeError('Wrong framebuffer size');
  for (let i = 0, p = 0; i < pixels.length; i++, p += 4) {
    const value = pixels[i];
    rgba[p] = (value >>> 16) & 255;
    rgba[p + 1] = (value >>> 8) & 255;
    rgba[p + 2] = value & 255;
    rgba[p + 3] = 255;
  }
}
