// The corpus has one RSA encryption method per game. Its exponent and modulus
// are parameters, while JS5 verification uses instance fields. Keep signed
// cache verification untouched. This is an application adapter, not a JVM hook.
export function patchLoginEncryption(source, modulus) {
  if (!/^\d+$/.test(modulus)) throw new Error("Invalid browser login modulus");
  return source.replace(/\.modPow\((param\d+), (param\d+)\)/g,
    (_, exponent) => `.modPow(${exponent}, new java.math.BigInteger("${modulus}"))`);
}

// Buffered socket writers normally hand the buffer to a SignLink thread. The
// browser endpoint can accept it immediately. Select by the writer's byte-copy
// shape, deriving the argument order from that copy (it varies by game).
export function patchSocketWriter(source) {
  if (!/implements Runnable/.test(source)) return source;
  const output = /private (?:java\.io\.)?OutputStream (\w+);/.exec(source)?.[1];
  if (!output) return source;
  const headers = /    (?:final )?void \w+\([^\n]*byte\[\][^\n]*\) throws IOException \{/g;
  let result = "", cursor = 0, match;
  while ((match = headers.exec(source))) {
    const signature = match[0];
    const end = closingBrace(source, headers.lastIndex - 1);
    if (end < 0) return source;
    const body = source.slice(headers.lastIndex, end);
    headers.lastIndex = end + 1;
    const copy = /this\.\w+\[this\.\w+\] = (param\d+)\[((?:param|var)\w+) \+ ((?:param|var)\w+)\];/.exec(body);
    if (!copy) continue;
    const bytes = copy[1];
    const offset = copy[2].startsWith("param") ? copy[2] : copy[3];
    const counter = copy[2].startsWith("var") ? copy[2] : copy[3];
    const limit = new RegExp(`if \\(\\(?${counter} >= (param\\d+)\\)?\\)`).exec(body)?.[1] || new RegExp(`if \\((param\\d+) <= ${counter}\\)`).exec(body)?.[1];
    if (!limit) continue;
    result += source.slice(cursor, match.index) + `${signature}\n        this.${output}.write(${bytes}, ${offset}, ${limit});\n    }`;
    cursor = end + 1;
  }
  return result + source.slice(cursor);
}

function closingBrace(source, start) {
  let depth = 0, quote = null, comment = null;
  for (let i = start; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === "line") { if (c === "\n") comment = null; continue; }
    if (comment === "block") { if (c === "*" && next === "/") {comment = null; i++;} continue; }
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === "/" && next === "/") {comment = "line"; i++; continue;}
    if (c === "/" && next === "*") {comment = "block"; i++; continue;}
    if (c === '"' || c === "'") {quote = c; continue;}
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

// A game may ship typed native declarations also present as generic fallback
// stubs. Compiling both lets the fallback erase the game's method signatures.
export function selectGameSources(files, gameId) {
  const prefix = `games/${gameId}/`;
  const gameClasses = new Set(files.filter(file => file.startsWith(prefix) && file.endsWith(".java")).map(file => file.slice(prefix.length)));
  return files.filter(file => file.endsWith(".java") && (
    file.startsWith(prefix) ||
    (file.startsWith("stubs/src/") && !gameClasses.has(file.slice("stubs/src/".length)))
  ));
}

// Void Hunters trims transparent PNG borders before uploading sprites. Its
// software-renderer conversion uses the logical canvas size against the smaller
// cropped buffer. Upload the cropped rectangle and retain its four margins.
export function patchGameCompatibility(source, sourcePath) {
  if (sourcePath === 'games/armiesofgielinor/qv.java') {
    // Older cloned heaps incorrectly allocate primitive rows for a partially
    // dimensioned int[][][]. Explicit reference-array allocations preserve
    // the null leaf rows that the client subsequently fills with int[].
    return source.replace('aw.field_j = new int[var2][var3][];',
      `aw.field_j = new int[var2][][];
            for (int browserRow = 0; browserRow < var2; browserRow++) {
                aw.field_j[browserRow] = new int[var3][];
            }`);
  }
  if (sourcePath !== 'games/voidhunters/wba.java') return source;
  return source.replace(
    'var3 = param1.a(param2.field_m, param2.field_m, param2.field_r, 0, (byte) 64, param2.field_n);',
    `var3 = param1.a(param2.field_q, param2.field_q, param2.field_r, 0, (byte) 64, param2.field_p);
            var3.a(param2.field_k, param2.field_l,
                param2.field_m - param2.field_q - param2.field_k,
                param2.field_n - param2.field_p - param2.field_l);`,
  );
}

export function patchGeobloxSource(source, sourcePath, modulus) {
    source = patchSolidPanelTiles(source, sourcePath);
    source = patchGeobloxSubstreamCursor(source, sourcePath);
    if (sourcePath === "games/geoblox/ba.java") {
      source = source.replace(
        /    final void a\(int param0, int param1, int param2, byte\[\] param3\) throws IOException \{[\s\S]*?\n    final int c\(/,
        `    final void a(int param0, int param1, int param2, byte[] param3) throws IOException {
        if (!this.field_f) {
            this.field_a.write(param3, param1, param2);
        }
    }

    final int c(`,
      );
    }
    if (sourcePath === "games/geoblox/ge.java") {
      source = source.replace(
        "gj.field_s = ph.field_i.a(vg.field_a, gh.field_z, false);",
        `gj.field_s = new cb();
                      java.net.Socket embeddedSocket = new java.net.Socket(gh.field_z, vg.field_a);
                      gj.field_s.field_b = embeddedSocket;
                      gj.field_s.field_a = 1;`,
      );
    }
    // The stock modulus is shared by login encryption and JS5 signature
    // verification. Patch only the three login call sites: changing vl.field_l
    // globally would make the original signed cache master index unverifiable.
    if (
      sourcePath === "games/geoblox/uk.java" ||
      sourcePath === "games/geoblox/pf.java"
    ) {
      source = source.replaceAll(
        "el.a(false, fc.field_d, fj.field_q, ld.field_c, vl.field_l);",
        `el.a(false, fc.field_d, fj.field_q, ld.field_c, new java.math.BigInteger("${modulus}"));`,
      );
    }
  return source;
}

// A nine-slice center can be a single opaque pixel. Filling its clipped area
// preserves the tiled result without thousands of virtual sprite calls.
export function patchSolidPanelTiles(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/ma.java' || source.includes('deko-solid-panel-tile')) return source;
  const anchor = '                              vb.b(var16, var18, var17, var19);\n                              var20 = var14;';
  if (source.split(anchor).length !== 2) return source;
  return source.replace(anchor, `                              vb.b(var16, var18, var17, var19);
                              // deko-solid-panel-tile: retain the general path for subclasses and trimmed sprites.
                              if (param5[4].getClass() == dm.class &&
                                  param5[4].field_s == 1 && param5[4].field_o == 1 &&
                                  param5[4].field_r == 1 && param5[4].field_m == 1 &&
                                  param5[4].field_u == 0 && param5[4].field_p == 0 &&
                                  param5[4].field_v != null && param5[4].field_v.length == 1 &&
                                  var12 >= 0 && var14 >= 0 && var13 >= var12 && var15 >= var14) {
                                if (param5[4].field_v[0] != 0) {
                                  vb.a(var12, var14, var13 - var12, var15 - var14, param5[4].field_v[0]);
                                }
                                vb.b(hd.field_I);
                                break L20;
                              }
                              var20 = var14;`);
}

// Keep packet decoding independently compilable before the result class has
// initialized. The wrapper retains the original result-allocation boundary.
// Kept separate from the registered patch set until browser validation.
export function patchGeobloxPcmLoop(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/ua.java' || source.includes('dekoDecodePackets')) return source;
  const signature = '    final gd a(int[] param0) {';
  const start = source.indexOf(signature);
  if (start < 0 || source.indexOf(signature, start + 1) >= 0) return source;
  const end = closingBrace(source, start + signature.length - 1);
  if (end < 0) return source;
  const original = source.slice(start, end + 1);
  const completion = `            this.field_C = null;
            var12 = this.field_E;
            this.field_E = null;
            return new gd(this.field_q, var12, this.field_I, this.field_n, this.field_A);`;
  if (original.split(completion).length !== 2 || original.split('return null;').length !== 3) return source;
  const helper = original.replace(signature, '    final boolean dekoDecodePackets(int[] param0) {')
    .replace('        byte[] var12;\n', '')
    .replace(completion, '            return true;')
    .replaceAll('return null;', 'return false;');
  const wrapper = `${signature}
        if (!this.dekoDecodePackets(param0)) return null;
        this.field_C = null;
        byte[] var12 = this.field_E;
        this.field_E = null;
        return new gd(this.field_q, var12, this.field_I, this.field_n, this.field_A);
    }`;
  return source.slice(0, start) + wrapper + '\n\n' + helper + source.slice(end + 1);
}

// Experimental until constrained browser validation passes. Keep the existing
// decoder/cache and finish every track before advancing the loading stage.
export function patchGeobloxIncrementalMusic(source, sourcePath) {
  if (source.includes('deko-incremental-music')) return source;
  if (sourcePath === 'games/geoblox/Geoblox.java') {
    const call = '            jg.a(wj.field_F, (byte) 80, ah.field_c, fe.field_a, cd.field_m);';
    if (source.split(call).length !== 2) return source;
    return source.replace(call,
      '            // deko-incremental-music\n' +
      '            if (!jg.dekoLoadMusic(wj.field_F, ah.field_c, fe.field_a, cd.field_m)) return false;\n' + call);
  }
  if (sourcePath !== 'games/geoblox/jg.java') return source;
  const start = '              kf.field_c = param3;';
  const end = '              var5_int = 0;';
  const begin = source.indexOf(start), finish = source.indexOf(end, begin);
  if (begin < 0 || finish < 0 || source.indexOf(start, begin + 1) >= 0) return source;
  const original = source.slice(begin, finish);
  const tracks = ['hf.field_d', 'qf.field_bb', 'pi.field_S', 'll.field_d'];
  if (!tracks.every(track => original.includes(`uh.field_y.a(te.field_c, 0, -1, ${track}, sl.field_l);`))) return source;
  const init = original.slice(0, original.indexOf('              uh.field_y.a('));
  const helper = `
    // deko-incremental-music: one bounded decode request per loading update.
    private static int dekoMusicStage;
    static boolean dekoLoadMusic(rh param0, rh param2, rh param3, rh param4) {
        if (dekoMusicStage == 0) {
${init}            dekoMusicStage = 1;
        }
        rf track;
        if (dekoMusicStage == 1) track = hf.field_d;
        else if (dekoMusicStage == 2) track = qf.field_bb;
        else if (dekoMusicStage == 3) track = pi.field_S;
        else if (dekoMusicStage == 4) track = ll.field_d;
        else return true;
        if (uh.field_y.a(te.field_c, 8192, -1, track, sl.field_l)) {
            if (dekoMusicStage == 1) ag.field_j[1] = true;
            dekoMusicStage++;
        }
        return dekoMusicStage == 5;
    }
`;
  const cleanup = '    public static void c(int param0) {';
  if (source.split(cleanup).length !== 2) return source;
  return (source.slice(0, begin) + source.slice(finish))
    .replace(cleanup, cleanup + '\n        dekoMusicStage = 0;')
    .replace(/\n}\s*$/, helper + '\n}\n');
}

// The audio-output scheduler and synth reset hold different monitors. They
// must not borrow the same tf cursor while enumerating the synth's voices.
export function patchGeobloxSubstreamCursor(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/ad.java' || source.includes('deko-substream-cursor')) return source;
  const start = '    final ia c() {';
  const end = '    private final void a(int param0, byte param1, int param2, int[] param3, pc param4, int param5) {';
  const begin = source.indexOf(start), finish = source.indexOf(end, begin);
  if (begin < 0 || finish < 0 || source.indexOf(start, begin + 1) >= 0) return source;
  const original = source.slice(begin, finish);
  if (!original.includes('this.field_l.d(1)') || !original.includes('this.field_l.g(0)')) return source;
  return source.slice(0, begin) + `    // deko-substream-cursor: enumeration does not disturb the synth's iterator.
    private hf dekoSubstreamNext;

    final ia c() {
        synchronized (this.field_k) {
            while (this.dekoSubstreamNext != null && this.dekoSubstreamNext != this.field_l.field_a) {
                pc voice = (pc) this.dekoSubstreamNext;
                this.dekoSubstreamNext = voice.field_b;
                if (voice.field_u != null) return voice.field_u;
            }
            this.dekoSubstreamNext = null;
            return null;
        }
    }

    final ia b() {
        synchronized (this.field_k) {
            this.dekoSubstreamNext = this.field_l.field_a.field_b;
            return this.c();
        }
    }

` + source.slice(finish);
}

// Unregistered until constrained browser validation passes. Clear only the
// active raster prefix: the framebuffer may reserve trailing sentinel cells.
export function patchRasterPrefixFill(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/vb.java' || source.includes('deko-raster-prefix-fill')) return source;
  const anchor = '    final static void c() {';
  if (source.split(anchor).length !== 2) return source;
  return source.replace(anchor, anchor + `
        // deko-raster-prefix-fill: preserve overflow/error paths and the tail.
        int dekoFillCount = field_f * field_b;
        if (field_c != null && dekoFillCount >= 0 && dekoFillCount <= field_c.length) {
            java.util.Arrays.fill(field_c, 0, dekoFillCount, 0);
            return;
        }
`);
}

// Experimental, deliberately unregistered. This renderer has no field writes
// or guest callbacks: its drawing state is stable throughout an invocation.
// Pass that state as parameters so array addressing stays outside pixel loops.
export function patchRotationParameters(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/dm.java' || source.includes('deko-rotation-parameters')) return source;
  const signature = '    void b(int param0, int param1, int param2, int param3, int param4, int param5) {';
  const start = source.indexOf(signature);
  if (start < 0 || source.indexOf(signature, start + 1) >= 0) return source;
  const bodyStart = start + signature.length;
  let end = bodyStart, depth = 1;
  for (; end < source.length && depth; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  if (depth) return source;
  let body = source.slice(bodyStart, end - 1);
  // Refuse changed algorithms that could mutate the captured state or call
  // back into game code while drawing. Math intrinsics are the only calls in
  // the recognized renderer; field snapshots are not valid for arbitrary code.
  if (/\bvolatile\b/.test(source) ||
      /(?:\b(?:this|vb)\.field_\w+\s*(?:=(?!=)|(?:[-+*/%&|^]|<<|>>>?)=|\+\+|--)|(?:\+\+|--)\s*(?:this|vb)\.field_\w+)/.test(body)) return source;
  const withoutMath = body.replace(/\bMath\.(?:floor|sin|cos)\s*\(/g, '(');
  if ([...withoutMath.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
      .some(([, name]) => name !== 'if' && name !== 'while')) return source;
  const fields = [
    ['this.field_v', 'int[]', 'dekoSource', 9],
    ['vb.field_c', 'int[]', 'dekoTarget', 9],
    ['this.field_r', 'int', 'dekoWidth', 28],
    ['this.field_m', 'int', 'dekoHeight', 19],
    ['this.field_u', 'int', 'dekoOffsetX', 1],
    ['this.field_p', 'int', 'dekoOffsetY', 1],
    ['vb.field_e', 'int', 'dekoClipLeft', 2],
    ['vb.field_k', 'int', 'dekoClipRight', 2],
    ['vb.field_i', 'int', 'dekoClipTop', 2],
    ['vb.field_d', 'int', 'dekoClipBottom', 2],
    ['vb.field_f', 'int', 'dekoStride', 12],
  ];
  for (const [field, , name, count] of fields) {
    if (body.split(field).length !== count + 1) return source;
    body = body.replaceAll(field, name);
  }
  if (/\b(?:this|vb)\./.test(body)) return source;
  const inputs = Array.from({ length: 6 }, (_, i) => `param${i}`);
  const argumentsList = [...fields.map(([field]) => field), ...inputs].join(', ');
  const parameters = [...fields.map(([, type, name]) => `${type} ${name}`),
    ...inputs.map(name => `int ${name}`)].join(', ');
  return source.slice(0, start) + signature + `
        // deko-rotation-parameters: retain the no-op scale before state reads.
        if (param5 == 0) return;
        dekoRotate(${argumentsList});
    }

    private static void dekoRotate(${parameters}) {${body}}
` + source.slice(end);
}

// Experimental, deliberately unregistered. Preserve the original outline
// algorithm, while making its stable array and dimensions helper parameters.
export function patchOutlineParameters(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/dm.java' || source.includes('dekoOutline') ||
      /\bvolatile\b/.test(source)) return source;
  const signature = '    final void g(int param0) {';
  const start = source.indexOf(signature);
  if (start < 0 || source.indexOf(signature, start + 1) >= 0) return source;
  const bodyStart = start + signature.length;
  const end = closingBrace(source, bodyStart - 1);
  if (end < 0) return source;
  let body = source.slice(bodyStart, end);
  const publish = /this\.field_v = var2;\s*return;/g;
  if ([...body.matchAll(publish)].length !== 1) return source;
  body = body.replace(publish, 'return var2;');
  if (/\bthis\.field_\w+\s*(?:=(?!=)|(?:[-+*/%&|^]|<<|>>>?)=|\+\+|--)|(?:\+\+|--)\s*this\.field_\w+/.test(body)) return source;
  if ([...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
      .some(([, name]) => name !== 'if' && name !== 'while')) return source;
  for (const [field, replacement, count] of [
    ['this.field_v', 'dekoSource', 5],
    ['this.field_r', 'dekoWidth', 5],
    ['this.field_m', 'dekoHeight', 3],
  ]) {
    if (body.split(field).length !== count + 1) return source;
    body = body.replaceAll(field, replacement);
  }
  if (/\bthis\./.test(body)) return source;
  return source.slice(0, start) + signature + `
        // deko-outline-parameters: publish only after successful completion.
        this.field_v = dekoOutline(this.field_v, this.field_r, this.field_m, param0);
    }

    private static int[] dekoOutline(int[] dekoSource, int dekoWidth, int dekoHeight, int param0) {${body}}
` + source.slice(end + 1);
}

// Experimental, deliberately unregistered. The smooth renderer calls a
// bilinear sampler for each pixel. Snapshot their shared drawing state once
// and pass it through both helpers, retaining the original Java algorithms.
export function patchSmoothRotationParameters(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/dm.java' || /\bvolatile\b/.test(source) ||
      source.includes('dekoSmoothRotate') || source.includes('dekoBilinearSample')) return source;
  const signature = '    final void a(int param0, int param1, int param2, int param3, int param4, int param5) {';
  const sampleSignature = '    private final void c(int param0, int param1, int param2, int param3, int param4) {';
  const read = signature => {
    const start = source.indexOf(signature);
    if (start < 0 || source.indexOf(signature, start + 1) >= 0) return null;
    const end = closingBrace(source, start + signature.length - 1);
    return end < 0 ? null : {start, end, body: source.slice(start + signature.length, end)};
  };
  const renderer = read(signature), sampler = read(sampleSignature);
  if (!renderer || !sampler) return source;
  for (const body of [renderer.body, sampler.body]) {
    if (/(?:\b(?:this|vb)\.field_\w+\s*(?:=(?!=)|(?:[-+*/%&|^]|<<|>>>?)=|\+\+|--)|(?:\+\+|--)\s*(?:this|vb)\.field_\w+)/.test(body)) return source;
  }
  if ((renderer.body.match(/this\.c\(/g) || []).length !== 4) return source;
  const fields = [
    ['this.field_v', 'int[]', 'dekoSource', 0, 4],
    ['vb.field_c', 'int[]', 'dekoTarget', 0, 2],
    ['this.field_r', 'int', 'dekoWidth', 8, 5],
    ['this.field_m', 'int', 'dekoHeight', 8, 1],
    ['this.field_u', 'int', 'dekoOffsetX', 1, 0],
    ['this.field_p', 'int', 'dekoOffsetY', 1, 0],
    ['vb.field_e', 'int', 'dekoClipLeft', 2, 0],
    ['vb.field_k', 'int', 'dekoClipRight', 2, 0],
    ['vb.field_i', 'int', 'dekoClipTop', 2, 0],
    ['vb.field_d', 'int', 'dekoClipBottom', 2, 0],
    ['vb.field_f', 'int', 'dekoStride', 2, 0],
  ];
  if ([renderer.body, sampler.body].some(body =>
    fields.some(([, , name]) => body.includes(name)))) return source;
  for (const [field, , name, rendererCount, samplerCount] of fields) {
    if (renderer.body.split(field).length !== rendererCount + 1 ||
        sampler.body.split(field).length !== samplerCount + 1) return source;
    renderer.body = renderer.body.replaceAll(field, name);
    sampler.body = sampler.body.replaceAll(field, name);
  }
  renderer.body = renderer.body.replaceAll('this.c(',
    'dekoBilinearSample(dekoSource, dekoTarget, dekoWidth, dekoHeight, ');
  for (const body of [renderer.body, sampler.body]) {
    if (/\b(?:this|vb)\./.test(body)) return source;
    const withoutMath = body.replace(/\bMath\.(?:floor|sin|cos)\s*\(/g, '(');
    if ([...withoutMath.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
        .some(([, name]) => !['if', 'while', 'dekoBilinearSample'].includes(name))) return source;
  }
  const inputs = count => Array.from({length: count}, (_, i) => `param${i}`);
  const args = (state, count) => [...state.map(([field]) => field), ...inputs(count)].join(', ');
  const params = (state, count) => [...state.map(([, type, name]) => `${type} ${name}`),
    ...inputs(count).map(name => `int ${name}`)].join(', ');
  const replacements = [
    {...renderer, text: signature + `
        // deko-smooth-rotation-parameters: keep zero scale a no-op.
        if (param5 == 0) return;
        dekoSmoothRotate(${args(fields, 6)});
    }

    private static void dekoSmoothRotate(${params(fields, 6)}) {${renderer.body}}
`},
    {...sampler, text: sampleSignature + `
        dekoBilinearSample(${args(fields.slice(0, 4), 5)});
    }

    private static void dekoBilinearSample(${params(fields.slice(0, 4), 5)}) {${sampler.body}}
`},
  ];
  for (const {start, end, text} of replacements.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, start) + text + source.slice(end + 1);
  }
  return source;
}
