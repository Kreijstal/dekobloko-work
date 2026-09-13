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
