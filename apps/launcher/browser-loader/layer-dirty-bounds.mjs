// Disabled experiment. Apply to the complete ORIGINAL GeoBlox source map before
// other patches. Whole-corpus SHA256 validation makes application all-or-nothing.
import reviewedManifest from './layer-dirty-bounds-source-identity.mjs';
import {patchRotationParameters, patchSmoothRotationParameters, patchRasterPrefixFill} from './game-source-patches.mjs';

export const layerTrackerJava = `
    // deko-layer-dirty-bounds
    static int[] dekoLayer;
    static boolean dekoLayerKnown;
    static int dekoLayerLeft, dekoLayerTop, dekoLayerRight, dekoLayerBottom;

    static void dekoLayerRegister(int[] pixels) {
        dekoLayer = pixels;
        dekoLayerKnown = false;
    }
    static void dekoLayerInvalidate(int[] pixels) {
        if (pixels == dekoLayer) dekoLayerKnown = false;
    }
    static void dekoLayerCleared(int[] pixels, int count) {
        if (pixels == dekoLayer && pixels != null && pixels.length == 409600 && count == 409600) {
            dekoLayerLeft = 640; dekoLayerTop = 640;
            dekoLayerRight = 0; dekoLayerBottom = 0;
            dekoLayerKnown = true;
        }
    }
    static void dekoLayerMark(int[] pixels, int stride, int left, int top, int right, int bottom) {
        if (pixels != dekoLayer || !dekoLayerKnown) return;
        if (stride != 640 || left < 0 || top < 0 || right > 640 || bottom > 640 || right < left || bottom < top) {
            dekoLayerKnown = false;
            return;
        }
        if (left == right || top == bottom) return;
        if (left < dekoLayerLeft) dekoLayerLeft = left;
        if (top < dekoLayerTop) dekoLayerTop = top;
        if (right > dekoLayerRight) dekoLayerRight = right;
        if (bottom > dekoLayerBottom) dekoLayerBottom = bottom;
    }
    static void dekoLayerOutline(int[] pixels, int stride) {
        if (pixels != dekoLayer || !dekoLayerKnown) return;
        if (stride != 640) { dekoLayerKnown = false; return; }
        if (dekoLayerRight <= dekoLayerLeft) return;
        // Linear +/-1 and +/-2 neighbors may wrap across rows. Keep all
        // columns near an edge, even though normal game shapes stay inside.
        int left = dekoLayerLeft - 2, right = dekoLayerRight + 2;
        int top = dekoLayerTop - 2, bottom = dekoLayerBottom + 2;
        if (left < 0 || right > 640) { left = 0; right = 640; }
        if (top < 0) top = 0;
        if (bottom > 640) bottom = 640;
        dekoLayerMark(pixels, stride, left, top, right, bottom);
    }
`;

const blit = '    private final static void b(int[] param0, int[] param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';
const rotation = '    void b(int param0, int param1, int param2, int param3, int param4, int param5) {';
const smoothRotation = '    final void a(int param0, int param1, int param2, int param3, int param4, int param5) {';
const clear = '    final static void c() {';
const binder = '    final static void a(int[] param0, int param1, int param2) {';
const outline = '    final static void a(int[] param0, int param1, int param2, int param3, int param4, int param5, int param6, int param7, int param8) {';

function replaceOnce(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error('Dirty-layer patch shape mismatch: ' + anchor);
  return source.replace(anchor, replacement);
}

export function instrumentLayerSource(source, name) {
  // This function is exported for differential fixtures, not loader activation.
  // Only the corpus-validated entry point below is suitable for a source loader.
  // Extract both renderers before inserting tracking calls. Otherwise the
  // existing sampler purity guard correctly refuses parameter specialization.
  if (name === 'dm.java') {
    source = patchRotationParameters(source, 'games/geoblox/dm.java');
    source = patchSmoothRotationParameters(source, 'games/geoblox/dm.java');
  }
  const lines = source.split('\n');
  for (let start = 0; start < lines.length; start++) {
    if (!/^    (?! )(?:[\w.$\[\]]+ )*[\w$]+\([^;]*\) \{$/.test(lines[start])) continue;
    const end = lines.findIndex((line, i) => i > start && line === '    }');
    if (end < 0) throw new Error('Unterminated source member');
    const body = lines.slice(start + 1, end).join('\n');
    const references = name === 'vb.java' ? /\bfield_c\b/.test(body) : /\bvb\.field_c\b/.test(body);
    const preserve = name === 'ld.java' || name === 'oc.java' || name === 'k.java' ||
      name === 'vb.java' && (lines[start] === binder || lines[start] === clear) ||
      name === 'dm.java' && (lines[start] === rotation || lines[start] === smoothRotation);
    if (references && !preserve) lines[start] += '\n        vb.dekoLayerInvalidate(vb.field_c);';
    start = end;
  }
  source = lines.join('\n');
  if (name === 'vb.java') {
    source = patchRasterPrefixFill(source, 'games/geoblox/vb.java');
    source = replaceOnce(source, clear, clear + '\n        dekoLayerInvalidate(field_c);');
    source = replaceOnce(source, 'java.util.Arrays.fill(field_c, 0, dekoFillCount, 0);',
      'java.util.Arrays.fill(field_c, 0, dekoFillCount, 0);\n            dekoLayerCleared(field_c, dekoFillCount);');
    source = source.slice(0, source.lastIndexOf('}')) + layerTrackerJava + '}\n';
  }
  if (name === 'oc.java') {
    source = replaceOnce(source, 'field_d = new dm(640, 640);',
      'field_d = new dm(640, 640);\n        vb.dekoLayerRegister(field_d.field_v);');
    source = replaceOnce(source, 'field_d = null;', 'vb.dekoLayerRegister(null);\n        field_d = null;');
  }
  if (name === 'gh.java') {
    const copy = 'sf.a(sh.field_y.field_d, 0, oc.field_d.field_v, 0, sh.field_y.field_d.length);';
    source = replaceOnce(source, copy, 'vb.dekoLayerInvalidate(oc.field_d.field_v);\n            ' + copy);
  }
  if (name === 'w.java') source = replaceOnce(source, outline,
    outline + '\n        vb.dekoLayerOutline(param0, vb.field_f);');
  if (name === 'dm.java') {
    const clippedStart = 'var23 = var21 * dekoStride + var19;';
    if (source.split(clippedStart).length !== 3) throw new Error('Expected both clipped rotation kernels');
    source = source.replaceAll(clippedStart,
      'vb.dekoLayerMark(dekoTarget, dekoStride, var19, var21, var19 - var20, var21 - var22);\n                ' + clippedStart);
    source = replaceOnce(source, blit, blit + `
        if (param1 != null && param1 == vb.dekoLayer && vb.dekoLayerKnown &&
            param0 != null && param0 != param1 && param0.length >= 307200 && param1.length == 409600 &&
            param3 == 0 && param4 == 0 && param5 == 640 && param6 == 480 && param7 == 0 && param8 == 0) {
            int bottom = vb.dekoLayerBottom;
            if (bottom > 480) bottom = 480;
            if (vb.dekoLayerRight <= vb.dekoLayerLeft || bottom <= vb.dekoLayerTop) return;
            param3 = vb.dekoLayerTop * 640 + vb.dekoLayerLeft;
            param4 = param3;
            param5 = vb.dekoLayerRight - vb.dekoLayerLeft;
            param6 = bottom - vb.dekoLayerTop;
            param7 = 640 - param5;
            param8 = param7;
        }
`);
  }
  return source;
}

export async function patchLayerDirtyBounds(sources) {
  const names = Object.keys(reviewedManifest).sort();
  const actualNames = [...sources.keys()].filter(name => name.startsWith('games/geoblox/') && name.endsWith('.java')).sort();
  if (names.length !== 303 || JSON.stringify(names) !== JSON.stringify(actualNames)) return {applied: false, sources};
  for (const name of names) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sources.get(name)));
    const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (hex !== reviewedManifest[name]) return {applied: false, sources};
  }
  const result = new Map(sources);
  for (const name of names) result.set(name, instrumentLayerSource(sources.get(name), name.split('/').at(-1)));
  return {applied: true, sources: result};
}
