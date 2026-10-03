// Experimental until constrained gameplay validation passes. Exact, untrimmed
// one-pixel-wide border tiles repeat a fixed stripe, not an arbitrary texture.
export function patchPanelStripTiles(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/ma.java' || source.includes('deko-panel-strip')) return source;
  const sites = [
    [1, 'var16, param0, var17, var18', 'var12', 'param0', 'var13 - var12', true, 'L12'],
    [7, 'var16, var19, var17, var11', 'var12', 'var15', 'var13 - var12', true, 'L14'],
    [3, 'param1, var18, var16, var19', 'param1', 'var14', 'var15 - var14', false, 'L16'],
    [5, 'var17, var18, var10, var19', 'var13', 'var14', 'var15 - var14', false, 'L18'],
  ];
  const replacements = sites.map(([tile, clip, x, y, length, horizontal, label]) => {
    const anchor = `                            vb.b(${clip});\n                            var20 = ${horizontal ? 'var12' : 'var14'};`;
    return [anchor, `                            vb.b(${clip});
                            if (dekoPanelStrip(param5[${tile}], ${x}, ${y}, ${length}, ${horizontal})) {
                              vb.b(hd.field_I);
                              break ${label};
                            }
                            var20 = ${horizontal ? 'var12' : 'var14'};`];
  });
  if (!/\n}\s*$/.test(source) || replacements.some(([anchor]) => source.split(anchor).length !== 2)) return source;
  for (const [anchor, replacement] of replacements) source = source.replace(anchor, replacement);
  return source.replace(/\n}\s*$/, `
    // deko-panel-strip: retain virtual drawing for subclasses and trimmed tiles.
    private static boolean dekoPanelStrip(dm tile, int x, int y, int length, boolean horizontal) {
        if (tile.getClass() != dm.class || length < 0 || x < 0 || y < 0 ||
            tile.field_u != 0 || tile.field_p != 0 ||
            tile.field_s != tile.field_r || tile.field_o != tile.field_m ||
            tile.field_r <= 0 || tile.field_m <= 0 || tile.field_v == null) return false;
        if (horizontal ? tile.field_r != 1 : tile.field_m != 1) return false;
        int stripes = horizontal ? tile.field_m : tile.field_r;
        if (tile.field_v.length != stripes ||
            x > Integer.MAX_VALUE - (horizontal ? length : stripes) ||
            y > Integer.MAX_VALUE - (horizontal ? stripes : length)) return false;
        for (int i = 0; i < stripes; i++) {
            int color = tile.field_v[i];
            if (color != 0) {
                if (horizontal) vb.a(x, y + i, length, 1, color);
                else vb.a(x + i, y, 1, length, color);
            }
        }
        return true;
    }
}
`);
}
