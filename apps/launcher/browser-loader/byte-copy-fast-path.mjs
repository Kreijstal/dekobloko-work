// Use the generic JRE bulk-copy implementation for valid byte ranges. Keep the
// original loop for unusual inputs so partial writes and exceptions are retained.
export function patchByteCopyFastPath(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/sf.java' || source.includes('deko-byte-copy-fast-path')) return source;
  const signature = '    final static void a(byte[] param0, int param1, byte[] param2, int param3, int param4) {';
  if (source.split(signature).length !== 2) return source;
  return source.replace(signature, `${signature}
        // deko-byte-copy-fast-path
        if (param0 != null && param2 != null && param1 >= 0 && param3 >= 0 && param4 >= 0 &&
            param1 <= param0.length - param4 && param3 <= param2.length - param4) {
            System.arraycopy(param0, param1, param2, param3, param4);
            return;
        }`);
}
