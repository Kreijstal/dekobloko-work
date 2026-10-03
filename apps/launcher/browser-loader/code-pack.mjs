// Dev-only code pack: JIT output produced ahead of time on a fast machine and
// replayed by the browser's pre-main preparation pass. Nothing here runs unless
// the server was started with GAME_LIBRARY_CODE_PACK and the page carries
// ?codePack=1 (replay) or ?codePack=verify (compile locally and compare).
//
// What is cached: one entry per method that java-tools' PreparedCodeCache
// records during the ahead-of-main pass -- the serialized generated result
// (JS source text, symbolic captures, metadata, and the site-table entries the
// compile allocated). The entry is keyed by
//   identity  = bundle sha256, game jar sha256, pack format, and a hash of
//               every page option the JVM is built from (codePackConfiguration)
//   method    = Class.name(descriptor)
//   watermark = the JIT's site-id watermark when the compile starts,
// i.e. the position of the compile in a deterministic sequence that starts
// from a fresh JVM with nothing initialized (preparation runs before any
// <clinit>). PreparedCodeCache re-validates every entry against the live
// JIT (identity, site-table prefix, provenance) and stops replaying at the
// first refusal; every miss compiles locally. Linking, Wasm, and everything
// after main() stay live.
//
// Format: one header line of JSON, '\n', then the UTF-8 entry texts back to
// back. The header indexes them by byte offset, so the browser decodes only
// the entries it asks for.

export const CODE_PACK_FORMAT = 'jvmjs-code-pack/1';

const isAsync = fn => typeof fn === 'function' &&
  (fn.constructor?.name === 'AsyncFunction' ||
    Object.prototype.toString.call(fn) === '[object AsyncFunction]');

function stable(value) {
  if (value === undefined || typeof value === 'function') return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  if (value instanceof Set) return {__set: [...value].map(stable)};
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    out[key] = stable(value[key]);
  }
  return out;
}

// The page options the JVM is constructed from, as one canonical string.
// JRE overrides are closures; their identity for code generation is which
// methods exist and whether they are async, so that is what is fingerprinted.
// The applet instance id is a timestamp and does not reach the compiler.
export function codePackConfiguration(options) {
  const {jreOverrides = {}, appletParameters = {}, ...rest} = options || {};
  const overrides = {};
  for (const className of Object.keys(jreOverrides).sort()) {
    const spec = jreOverrides[className] || {};
    overrides[className] = {
      natives: stable(spec.natives || null),
      methods: Object.keys(spec.methods || {}).sort().map(key =>
        key + (isAsync(spec.methods[key]) ? ' async' : '')),
    };
  }
  return JSON.stringify(stable({
    ...rest,
    appletParameters: {...appletParameters, instanceid: null},
    jreOverrides: overrides,
  }));
}

// 64-bit FNV-1a over UTF-16 code units, as hex. Identity only; the page may
// not be a secure context, so crypto.subtle is not available everywhere.
export function codePackHash(text) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n, mask = (1n << 64n) - 1n;
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

export function codePackIdentity({runtimeVersion, jarVersion, options}) {
  return {
    runtime: String(runtimeVersion),
    source: String(jarVersion),
    patch: CODE_PACK_FORMAT,
    configuration: codePackHash(codePackConfiguration(options)),
  };
}

// entries: iterable of [key, text]. Returns a Uint8Array.
export function encodeCodePack({identity, entries, meta = {}}) {
  const encoder = new TextEncoder();
  const index = [];
  const chunks = [];
  let offset = 0;
  for (const [key, text] of entries) {
    const bytes = encoder.encode(text);
    index.push([key, offset, bytes.length]);
    chunks.push(bytes);
    offset += bytes.length;
  }
  const header = encoder.encode(JSON.stringify(
    {format: CODE_PACK_FORMAT, identity, meta, entries: index}) + '\n');
  const out = new Uint8Array(header.length + offset);
  out.set(header, 0);
  let at = header.length;
  for (const bytes of chunks) { out.set(bytes, at); at += bytes.length; }
  return out;
}

export function decodeCodePack(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const newline = bytes.indexOf(10);
  if (newline < 0) throw new Error('code pack has no header');
  const decoder = new TextDecoder();
  const header = JSON.parse(decoder.decode(bytes.subarray(0, newline)));
  if (header.format !== CODE_PACK_FORMAT) {
    throw new Error('unsupported code pack format ' + header.format);
  }
  const base = newline + 1;
  const index = new Map(header.entries.map(([key, offset, length]) =>
    [key, [base + offset, length]]));
  return {
    identity: header.identity,
    meta: header.meta || {},
    size: index.size,
    keys: () => index.keys(),
    has: key => index.has(key),
    get(key) {
      const at = index.get(key);
      return at ? decoder.decode(bytes.subarray(at[0], at[0] + at[1])) : null;
    },
  };
}

export function sameIdentity(a, b) {
  return Boolean(a && b) && ['runtime', 'source', 'patch', 'configuration']
    .every(key => a[key] === b[key]);
}

// The store PreparedCodeCache reads and writes (async get/put, one at a time).
//   record: never answers; collects what preparation writes.
//   replay: answers from the pack; a miss compiles locally (and is counted).
//   verify: never answers, so every method compiles locally; each written
//           entry is compared with the pack's entry for the same key.
export function createCodePackStore(mode, pack = null) {
  // Dropped by release() once preparation is over: a pack is hundreds of MB.
  const stats = {mode, gets: 0, served: 0, absent: 0, puts: 0,
    verified: 0, differed: 0, missingInPack: 0, firstDifference: null,
    servedBytes: 0, unrecorded: {}};
  const written = new Map();
  const store = {
    stats,
    written,
    release() { pack = null; },
    // A compile whose result cannot be stored (PreparedCodeCache says why).
    // Bounded: reasons are counted, the first method of each is kept.
    noteUnrecorded(method, reason) {
      const slug = String(reason).replace(/\d+/g, 'N').slice(0, 120);
      const row = stats.unrecorded[slug] ||= {count: 0, first: method};
      row.count++;
    },
    async get(key) {
      stats.gets++;
      if (mode !== 'replay' || !pack) return null;
      const text = pack.get(key);
      if (text == null) { stats.absent++; return null; }
      stats.served++;
      stats.servedBytes += text.length;
      return text;
    },
    async put(key, text) {
      stats.puts++;
      if (mode === 'record') { written.set(key, text); return; }
      if (mode !== 'verify' || !pack) return;
      const expected = pack.get(key);
      if (expected == null) {
        stats.missingInPack++;
        stats.firstDifference ??= {key: JSON.parse(key)[1], reason: 'not in pack'};
      } else if (expected === text) {
        stats.verified++;
      } else {
        stats.differed++;
        if (!stats.firstDifference) {
          let at = 0;
          while (at < text.length && text[at] === expected[at]) at++;
          stats.firstDifference = {key: JSON.parse(key)[1], at,
            local: text.slice(Math.max(0, at - 80), at + 160),
            pack: expected.slice(Math.max(0, at - 80), at + 160)};
        }
      }
    },
  };
  return store;
}

// Route the JVM's own ahead-of-main pass through the pack. `jvm` is the JVM
// BrowserJVMDebug.run() is about to enter (its beforeRun hook).
export function installCodePack(jvm, {identity, store, onReport = null}) {
  const own = Object.hasOwn(jvm, 'precompileInitializedClasses');
  const original = jvm.precompileInitializedClasses;
  const prepare = original.bind(jvm);
  jvm.precompileInitializedClasses = async (options = {}) => {
    // One ahead-of-main pass; later passes are the JVM's own again.
    if (own) jvm.precompileInitializedClasses = original;
    else delete jvm.precompileInitializedClasses;
    let result;
    try {
      result = await prepare({...options,
      preparedCodeCache: {identity, store, ignoreRetentionBudget: true,
        maxEntryBytes: 256 * 1024 * 1024, dropDiagnosticSource: true,
        requireCompleteResults: true,
        onUnrecorded: (method, reason) => store.noteUnrecorded(method, reason)}});
    } finally {
      store.release();
    }
    onReport?.(result, store.stats);
    return result;
  };
}
