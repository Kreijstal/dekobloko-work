// Disabled experiment. Preserve allocation and publication semantics while
// exposing both arrays as parameters to the hot pixel loop.
export function patchOutlineOutputParameters(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/dm.java' || source.includes('dekoOutlineInto')) return source;
  const signature = '    private static int[] dekoOutline(int[] dekoSource, int dekoWidth, int dekoHeight, int param0) {';
  const start = source.indexOf(signature);
  if (start < 0 || source.indexOf(signature, start + 1) >= 0) return source;
  let end = start + signature.length, depth = 1;
  for (; end < source.length && depth; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  if (depth) return source;
  let body = source.slice(start + signature.length, end - 1);
  for (const anchor of ['int[] var2;', 'var2 = new int[dekoWidth * dekoHeight];', 'return var2;']) {
    if (body.split(anchor).length !== 2) return source;
  }
  body = body.replace('int[] var2;', '').replace('var2 = new int[dekoWidth * dekoHeight];', '').replace('return var2;', 'return;');
  return source.slice(0, start) + signature + `
        int[] target = new int[dekoWidth * dekoHeight];
        dekoOutlineInto(dekoSource, target, dekoWidth, dekoHeight, param0);
        return target;
    }

    private static void dekoOutlineInto(int[] dekoSource, int[] var2, int dekoWidth, int dekoHeight, int param0) {${body}}
` + source.slice(end);
}
