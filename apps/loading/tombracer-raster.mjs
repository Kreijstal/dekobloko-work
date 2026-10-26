// Isolate the scanline identified by the Tomb Racer CPU profile. Copy its body
// unchanged from the canonical source export; no game sources are committed here.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export function tombRasterProbe(source) {
  const signature = 'private final void a(int[] param0, int[] param1, int param2,';
  const start = source.indexOf(signature);
  if (start < 0 || source.indexOf(signature, start + 1) >= 0) throw Error('Expected one textured scanline');
  const open = source.indexOf('{', start);
  let end = open + 1, depth = 1;
  for (; end < source.length && depth; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  if (depth) throw Error('Unterminated scanline');
  const method = source.slice(start, end).replace('private final void a(', 'final void span(');
  const fields = [...new Set([...method.matchAll(/this\.(field_\w+)/g)].map(match => match[1]))];
  const declarations = fields.map(name => {
    const declaration = source.match(new RegExp(`^\\s*(?:private )?(int\\[\\]|float\\[\\]|int|boolean) ${name};$`, 'm'));
    if (!declaration) throw Error('Unsupported scanline field: ' + name);
    return `  ${declaration[1]} ${name};`;
  }).join('\n');
  const bodyHash = createHash('sha256').update(source.slice(open, end)).digest('hex');
  return `// Original scanline body SHA-256: ${bodyHash}
public class TombRasterProbe {
${declarations}
${method}
  static TombRasterProbe raster;
  static int[] pixels;
  public static int bench(int repetitions) {
    for (int n=0;n<repetitions;n++) {
      for(int i=0;i<pixels.length;i++) raster.field_u[i]=20.0f;
      raster.span(pixels,raster.field_w,0,-8,520,
        0.5f,0.8f,0.1f,0.4f,0.2f,0.5f,32f,80f,255f,128f,200f,220f,160f,195f,100f,180f);
    }
    int hash=1;
    for(int i=0;i<pixels.length;i++) hash=hash*31+pixels[i];
    return hash;
  }
  public static void main(String[] args) {
    raster=new TombRasterProbe();pixels=new int[512];
    raster.field_u=new float[512];raster.field_w=new int[4096];
    raster.field_q=true;raster.field_h=512;raster.field_i=64;raster.field_r=63;
    raster.field_d=true;raster.field_f=2;raster.field_l=0x263a5b;
    for(int i=0;i<raster.field_w.length;i++) raster.field_w[i]=0xff000000|(i*0x010305&0xffffff);
    System.out.println(bench(1));
  }
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = path.resolve(process.argv[2] || '../funorb-decompiled/games/tombracer/iua.java');
  process.stdout.write(tombRasterProbe(fs.readFileSync(source, 'utf8')));
}
