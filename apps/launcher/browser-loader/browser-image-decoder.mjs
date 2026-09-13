// Old JVM bundles decode PNGs through Node's zlib. Use browser image codecs
// and return the same ARGB pixel representation consumed by PixelGrabber.
export function installBrowserImageDecoder(jvm) {
  const methods = jvm.jre['java/awt/Toolkit']?.methods;
  if (!methods) throw new Error('JVM Toolkit natives unavailable');
  const createImage = async (_jvm, _object, args) => {
    const source = args[0]?.array ?? args[0];
    if (source == null) throw {type: 'java/lang/NullPointerException', message: 'Image bytes are null'};
    const offset = args.length > 1 ? args[1] : 0;
    const length = args.length > 2 ? args[2] : source.length;
    if (offset < 0 || length < 0 || offset + length > source.length)
      throw {type: 'java/lang/ArrayIndexOutOfBoundsException', message: 'Invalid image buffer range'};
    let bitmap;
    try {
      bitmap = await createImageBitmap(new Blob([Uint8Array.from(source.slice(offset, offset + length))]),
        {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d', {willReadFrequently: true});
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const pixels = new Int32Array(bitmap.width * bitmap.height);
      for (let i = 0; i < pixels.length; i++) {
        const p = i * 4;
        pixels[i] = (rgba[p + 3] << 24) | (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2];
      }
      return {type: 'java/awt/Image', _width: bitmap.width, _height: bitmap.height, _pixels: pixels};
    } catch (error) {
      throw {type: 'java/lang/IllegalArgumentException', message: `Cannot decode image: ${error.message || error}`};
    } finally { bitmap?.close(); }
  };
  createImage.__throws = ['java/lang/IllegalArgumentException', 'java/lang/NullPointerException'];
  methods['createImage([B)Ljava/awt/Image;'] = createImage;
  methods['createImage([BII)Ljava/awt/Image;'] = createImage;
}
