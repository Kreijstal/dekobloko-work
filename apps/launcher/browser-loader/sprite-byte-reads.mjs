// Experimental: qc is allocated locally and these constant sentinels select
// only its cursor-incrementing byte read. Preserve signed byte values.
export function patchSpriteByteReads(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/hf.java' || source.includes('deko-sprite-byte-reads')) return source;
  const reads = /var15\.f\(\(byte\) (78|90|95)\)/g;
  if (!source.includes('var15 = new qc(param1);') || [...source.matchAll(reads)].length !== 4) return source;
  return source.replace('var15 = new qc(param1);', '// deko-sprite-byte-reads\n            var15 = new qc(param1);')
    .replace(/^(\s*)([^\n]*?)var15\.f\(\(byte\) (78|90|95)\)([^\n]*)$/gm,
      (_, indent, before, sentinel, after) => `${indent}var14 = var15.field_f;
${indent}var15.field_f = var14 + 1;
${indent}${before}var15.field_j[var14]${after}`);
}
