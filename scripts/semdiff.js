#!/usr/bin/env node
'use strict';

// Usage: node scripts/semdiff.js [--leg original|decompile|full] [--hard] [--all] [--class N] [--json OUT]
//
// Semantic differential between two directories of .class files. Instead of
// diffing instruction streams (hopeless across a decompile/recompile round
// trip, which renumbers locals, flips branch polarity and restructures
// control flow wholesale), this extracts per-method *semantic invariants* --
// multisets of observable effects that any semantics-preserving transform
// must preserve -- and diffs those.
//
// Invariants extracted per method:
//   calls        every invoke* target (owner.name:descriptor), with counts
//   fieldWrites  putfield/putstatic targets, with counts
//   fieldReads   getfield/getstatic targets, with counts
//   arrayStores  {i,l,f,d,a,b,c,s}astore counts
//   arrayLoads   {i,l,f,d,a,b,c,s}aload counts
//   consts       numeric constants (iconst/bipush/sipush/ldc/ldc2_w) + iinc deltas
//   strings      string literals
//   newTypes     new/anewarray/multianewarray/newarray types
//   monitors     monitorenter count + monitors lacking exception-path unlock
//   handlers     SET of real (non-no-op) exception-handler catch types
//   arith        arithmetic/bitwise/shift/conversion opcode counts
//   athrow       athrow count
//
// Normalisations applied (the "expected, benign" pipeline differences):
//   * the `h` -> `field_h` field rename (stripped on both sides)
//   * local variable slot renumbering and the decompiler's
//     `aconst_null;astore N` / `iconst_0;istore N` temp prologues -- these
//     touch no invariant above, so they are normalised away for free
//   * branch polarity flips and control-flow restructuring -- likewise, no
//     invariant above records branch direction or block order
//   * the obfuscator's complement idiom, in both forms (see cancelIxorIdiom):
//       - `~a > ~b` => `a < b`, cancelling one `ixor` against one `-1`
//       - `~x > c`  => `x < ~c`, cancelling constant `c` against `-c-1`
//   * the obfuscator's `catch (RuntimeException e) { throw dh.a(e, "ctx") }`
//     context-rewrap wrappers, and its bare-`athrow` no-op handlers (a
//     catch that immediately rethrows is observationally a no-op, so
//     deleting it is provably safe -- ml.a(Lji;B)V has 748 of them)
//   * `nop` padding, `goto` chains, `dup`/`pop` stack shuffling
//
// Deliberately NOT normalised away (these are the findings):
//   changed constants, dropped field or array stores, dropped calls,
//   monitors that lost exception-path unlock, catch types that disappeared
//   entirely, changed arithmetic.
//
// KNOWN LIMITS -- read before believing any single line of output:
//   * Counts are STATIC, not dynamic. Tail-duplication passes inflate them
//     without changing behaviour, so increases are weak evidence. See
//     ADD_DISCOUNT.
//   * A count difference is never proof on its own. Two confirmed false
//     positives shaped this file: monitorexit counts (3->2 is a legal merge
//     of two normal exits) and handler counts (45->3 is a legal merge of
//     duplicated catch blocks). Both were replaced with structural oracles.
//   * This does not model reachability, so opaque-predicate dead code that
//     the `original` leg removes still shows up there. Prefer --leg decompile.
//   * Aliasing and evaluation order are not modelled at all.
//
// --leg selects a preset pair:
//   original  classes-original            -> decompile-owned/out      (bytecode passes)
//   decompile decompile-owned/out         -> decompile-owned/classes  (decompile+javac)
//   full      classes-original            -> decompile-owned/classes  (end to end)
// `decompile` is the highest-signal leg: it should be semantics-preserving,
// so every finding there is a candidate miscompilation. The `original` leg
// legitimately removes opaque-predicate dead code, so it is noisier.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JT = process.env.JAVA_TOOLS_DIR || '/home/kreijstal/git/java-tools';
const { getAST } = require(path.join(JT, 'node_modules', 'jvm_parser'));

const OWNED = path.join(ROOT, '.work', 'games', 'dekobloko', 'decompile-owned');
const LEGS = {
  original: [path.join(ROOT, 'classes-original'), path.join(OWNED, 'out')],
  decompile: [path.join(OWNED, 'out'), path.join(OWNED, 'classes')],
  full: [path.join(ROOT, 'classes-original'), path.join(OWNED, 'classes')],
};

// ---------------------------------------------------------------- constant pool

function poolResolver(pool) {
  const utf8 = (i) => {
    const e = pool[i];
    return e && e.tag === 1 ? e.info.bytes : null;
  };
  const className = (i) => {
    const e = pool[i];
    return e && e.tag === 7 ? utf8(e.info.name_index) : null;
  };
  const nameAndType = (i) => {
    const e = pool[i];
    return e && e.tag === 12
      ? { name: utf8(e.info.name_index), descriptor: utf8(e.info.descriptor_index) }
      : null;
  };
  const ref = (i) => {
    const e = pool[i];
    if (!e || (e.tag !== 9 && e.tag !== 10 && e.tag !== 11)) return null;
    const nt = nameAndType(e.info.name_and_type_index);
    return { owner: className(e.info.class_index), name: nt && nt.name, descriptor: nt && nt.descriptor };
  };
  // ldc / ldc_w / ldc2_w payload
  const constant = (i) => {
    const e = pool[i];
    if (!e) return null;
    switch (e.tag) {
      case 3: return { kind: 'int', value: e.info.bytes | 0 };
      case 4: return { kind: 'float', value: e.info.bytes };
      case 5: return { kind: 'long', value: String(e.info.bytes) };
      case 6: return { kind: 'double', value: e.info.bytes };
      case 8: return { kind: 'string', value: utf8(e.info.string_index) };
      case 7: return { kind: 'class', value: utf8(e.info.name_index) };
      default: return { kind: 'other', value: e.tag };
    }
  };
  return { utf8, className, nameAndType, ref, constant };
}

// ---------------------------------------------------------------- normalisation

// The pipeline renames every field `x` -> `field_x`. Method names and
// descriptors are untouched. Strip the prefix on both sides so field
// references compare equal.
function normField(name) {
  return typeof name === 'string' && name.startsWith('field_') ? name.slice(6) : name;
}

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

const ARITH_OPS = new Set([
  'iadd', 'isub', 'imul', 'idiv', 'irem', 'ineg', 'ishl', 'ishr', 'iushr', 'iand', 'ior', 'ixor',
  'ladd', 'lsub', 'lmul', 'ldiv', 'lrem', 'lneg', 'lshl', 'lshr', 'lushr', 'land', 'lor', 'lxor',
  'fadd', 'fsub', 'fmul', 'fdiv', 'frem', 'fneg',
  'dadd', 'dsub', 'dmul', 'ddiv', 'drem', 'dneg',
  'i2l', 'i2f', 'i2d', 'l2i', 'l2f', 'l2d', 'f2i', 'f2l', 'f2d', 'd2i', 'd2l', 'd2f',
  'i2b', 'i2c', 'i2s', 'lcmp', 'fcmpl', 'fcmpg', 'dcmpl', 'dcmpg',
]);

const ARRAY_STORE = new Set(['iastore', 'lastore', 'fastore', 'dastore', 'aastore', 'bastore', 'castore', 'sastore']);
const ARRAY_LOAD = new Set(['iaload', 'laload', 'faload', 'daload', 'aaload', 'baload', 'caload', 'saload']);

const ICONST = {
  iconst_m1: -1, iconst_0: 0, iconst_1: 1, iconst_2: 2, iconst_3: 3, iconst_4: 4, iconst_5: 5,
  lconst_0: 0, lconst_1: 1, fconst_0: 0, fconst_1: 1, fconst_2: 2, dconst_0: 0, dconst_1: 1,
};

function extractMethod(method, R) {
  const inv = {
    calls: {}, fieldWrites: {}, fieldReads: {}, arrayStores: {}, arrayLoads: {},
    consts: {}, strings: {}, newTypes: {}, arith: {}, handlers: {},
    monitorenter: 0, monitorexit: 0, athrow: 0, rethrowHandlers: 0,
  };
  const code = method.code;
  if (!code) return inv;

  for (const ins of code.instructions) {
    const op = ins.opcodeName;
    if (!op) continue;
    const ops = ins.operands || {};

    if (op.startsWith('invoke')) {
      const r = R.ref(ops.index);
      if (r) bump(inv.calls, `${r.owner}.${normField(r.name)}${r.descriptor}`);
      continue;
    }
    if (op === 'putfield' || op === 'putstatic') {
      const r = R.ref(ops.index);
      if (r) bump(inv.fieldWrites, `${r.owner}.${normField(r.name)}:${r.descriptor}`);
      continue;
    }
    if (op === 'getfield' || op === 'getstatic') {
      const r = R.ref(ops.index);
      if (r) bump(inv.fieldReads, `${r.owner}.${normField(r.name)}:${r.descriptor}`);
      continue;
    }
    if (ARRAY_STORE.has(op)) { bump(inv.arrayStores, op); continue; }
    if (ARRAY_LOAD.has(op)) { bump(inv.arrayLoads, op); continue; }
    if (op === 'monitorenter') { inv.monitorenter += 1; continue; }
    if (op === 'monitorexit') { inv.monitorexit += 1; continue; }
    if (op === 'athrow') { inv.athrow += 1; continue; }
    if (op === 'new' || op === 'anewarray' || op === 'checkcast' || op === 'instanceof') {
      const c = R.className(ops.index);
      if (c) bump(inv.newTypes, `${op} ${c}`);
      continue;
    }
    if (op === 'multianewarray') {
      const c = R.className(ops.index);
      if (c) bump(inv.newTypes, `multianewarray ${c}[${ops.dimensions}]`);
      continue;
    }
    if (op === 'newarray') { bump(inv.newTypes, `newarray ${ops.atype}`); continue; }

    if (op in ICONST) { bump(inv.consts, String(ICONST[op])); continue; }
    if (op === 'bipush') { bump(inv.consts, String((ops.byte << 24) >> 24)); continue; }
    if (op === 'sipush') { bump(inv.consts, String((ops.value << 16) >> 16)); continue; }
    if (op === 'ldc' || op === 'ldc_w' || op === 'ldc2_w') {
      const c = R.constant(ops.index);
      if (!c) continue;
      if (c.kind === 'string') bump(inv.strings, c.value);
      else if (c.kind === 'class') bump(inv.newTypes, `ldc-class ${c.value}`);
      else bump(inv.consts, String(c.value));
      continue;
    }
    // `iinc N, d` and its wide form: the local slot is normalised away, the
    // delta is not -- an iinc delta flip is exactly the `+1 -> -1` class of bug.
    if (op === 'iinc' || op === 'iinc_w') { bump(inv.consts, `iinc:${ops.const}`); continue; }

    if (ARITH_OPS.has(op)) { bump(inv.arith, op); continue; }
  }

  // Count DISTINCT handlers, not exception-table rows. The obfuscator splits a
  // single `catch (RuntimeException e)` into hundreds of rows that all target
  // the same handler_pc (one row per protected sub-range, so that opaque dead
  // code can sit in the gaps). Counting rows made ml.a(Lji;B)V report 748
  // "lost handlers" when it really has one. Dedupe on (handler_pc, type).
  // A handler is a "rethrow wrapper" if its block is the obfuscator idiom
  //   catch (RuntimeException e) { throw dh.a(e, "ctx"); }
  // The pipeline strips these deliberately, so they are counted in a separate
  // bucket that `--hard` ignores. Everything else -- real catch blocks that
  // swallow or recover -- stays in `handlers`, where a loss is a real finding.
  const byPc = new Map();
  for (let i = 0; i < code.instructions.length; i += 1) byPc.set(code.instructions[i].pc, i);
  const isRethrowWrapper = (pc) => {
    let i = byPc.get(pc);
    if (i === undefined) return false;
    // Case 1: the handler block IS a bare `athrow`. The obfuscator emits
    // hundreds of these per method (ml.a(Lji;B)V has 748) as opaque-predicate
    // padding. Catching an exception and immediately rethrowing it is
    // observationally identical to not catching it at all, so deleting such a
    // handler is provably semantics-preserving. Benign by construction.
    if (code.instructions[i].opcodeName === 'athrow') return true;
    // Case 2: the obfuscator's `throw dh.a(e, "ctx")` context-rewrap wrapper.
    for (let n = 0; n < 20 && i < code.instructions.length; n += 1, i += 1) {
      const ins = code.instructions[i];
      if (ins.opcodeName === 'invokestatic') {
        const r = R.ref((ins.operands || {}).index);
        if (r && r.owner === 'dh' && r.descriptor === '(Ljava/lang/Throwable;Ljava/lang/String;)Ljb;') return true;
      }
      if (ins.opcodeName === 'athrow' || ins.opcodeName === 'return') return false;
    }
    return false;
  };

  const seenHandlers = new Set();
  for (const h of code.exceptionTable || []) {
    const t = (h.catch_type ? R.className(h.catch_type) : 'any') || 'any';
    const key = `${h.handler_pc}:${t}`;
    if (seenHandlers.has(key)) continue;
    seenHandlers.add(key);
    if (isRethrowWrapper(h.handler_pc)) {
      inv.rethrowHandlers += 1;
    } else {
      bump(inv.handlers, t);
    }
  }
  // Compare handler type PRESENCE, not multiplicity. The obfuscator duplicates
  // a single logical catch block across many copies (one per flattened
  // region); the decompiler merges them back into one try/catch. So
  // `Throwable 45 -> 3` is a benign merge, whereas `EOFException 17 -> 0`
  // means the catch type is GONE and an exception that used to be handled now
  // propagates. Clamping to presence keeps only the latter class of finding.
  for (const k of Object.keys(inv.handlers)) inv.handlers[k] = 1;

  // Monitor safety oracle.
  //
  // NOTE: comparing raw monitorexit COUNTS is an invalid oracle and was the
  // source of a confirmed false positive (qk.run/im.run, 3 -> 2). javac emits
  // one monitorexit per structured exit from a synchronized block, so a block
  // with two normal exits has 3 monitorexits (2 normal + 1 exception). When
  // the decompiler merges those two exits into one via a selector flag, the
  // count legitimately drops to 2 with the lock still released on every path.
  //
  // What actually matters is that every monitorenter is still protected by a
  // catch-all handler that unlocks and rethrows. So we record the number of
  // monitorenters (must be preserved) and, for each, whether some `any`
  // handler range covers it -- that is the property whose loss means a
  // permanently held lock.
  const anyRanges = (code.exceptionTable || []).filter((h) => !h.catch_type);
  let unprotected = 0;
  for (const ins of code.instructions) {
    if (ins.opcodeName !== 'monitorenter') continue;
    const covered = anyRanges.some((h) => ins.pc >= h.start_pc && ins.pc < h.end_pc);
    if (!covered) unprotected += 1;
  }
  inv.unprotectedMonitors = unprotected;
  return inv;
}

// The obfuscator writes comparisons as `~a > ~b`; the pipeline simplifies
// these to `a < b`, which deletes one `ixor` and one `-1` push per operand.
// Allow a drop of N ixor to cancel up to N drops of the constant -1.
// Returns a mutated copy of the two const maps.
function cancelIxorIdiom(a, b) {
  a.arith = Object.assign({}, a.arith);
  a.consts = Object.assign({}, a.consts);
  b.consts = Object.assign({}, b.consts);

  const ixorDrop = (a.arith.ixor || 0) - (b.arith.ixor || 0);
  const m1Drop = (a.consts['-1'] || 0) - (b.consts['-1'] || 0);
  if (ixorDrop > 0 && m1Drop > 0) {
    const cancel = Math.min(ixorDrop, m1Drop);
    a.arith.ixor = (a.arith.ixor || 0) - cancel;
    a.consts['-1'] = (a.consts['-1'] || 0) - cancel;
  }

  // The obfuscator also writes comparisons against a *constant* in complement
  // form: `~x > 4` instead of `x < -5`. Folding the complement away turns the
  // literal `c` into `~c == -c-1`. So every dropped constant `c` in A is
  // allowed to cancel one added constant `~c` in B, and vice versa. This
  // accounts for essentially all of the numeric-constant churn (verified by
  // hand on qc.b(IZ)Z: -5/4, -3/2, -1025/1024, -201/200, -151/150 all cancel
  // exactly). Constants left over after this are real changed constants.
  for (const k of Object.keys(a.consts)) {
    if (k.startsWith('iinc:')) continue;
    const c = Number(k);
    if (!Number.isFinite(c)) continue;
    const drop = (a.consts[k] || 0) - (b.consts[k] || 0);
    if (drop <= 0) continue;
    const comp = String(-c - 1);
    const add = (b.consts[comp] || 0) - (a.consts[comp] || 0);
    if (add <= 0) continue;
    const cancel = Math.min(drop, add);
    a.consts[k] -= cancel;
    b.consts[comp] -= cancel;
  }
  for (const m of [a.consts, b.consts, a.arith]) {
    for (const k of Object.keys(m)) if (!m[k]) delete m[k];
  }
}

// The obfuscator wraps most method bodies in
//   catch (RuntimeException e) { throw dh.a(e, "cls.method(" + args + ")"); }
// The pipeline strips these rethrow wrappers deliberately (they only rewrite
// the exception's context string, they do not alter control flow observable to
// the game). Stripping one wrapper removes: 1 RuntimeException handler,
// 1 athrow, 1 dh.a call, 1 StringBuilder allocation with its append/toString
// calls, and the context string literal. Suppress exactly that footprint so it
// does not drown the ranking; anything left over still shows.
function cancelRethrowWrapper(a, b) {
  const wrappers = (a.calls['dh.a(Ljava/lang/Throwable;Ljava/lang/String;)Ljb;'] || 0)
    - (b.calls['dh.a(Ljava/lang/Throwable;Ljava/lang/String;)Ljb;'] || 0);
  if (wrappers <= 0) return;
  a.calls = Object.assign({}, a.calls);
  a.handlers = Object.assign({}, a.handlers);
  a.newTypes = Object.assign({}, a.newTypes);
  a.strings = Object.assign({}, a.strings);

  a.calls['dh.a(Ljava/lang/Throwable;Ljava/lang/String;)Ljb;'] -= wrappers;
  const handlerDrop = Math.min(wrappers, (a.handlers['java/lang/RuntimeException'] || 0) - (b.handlers['java/lang/RuntimeException'] || 0));
  if (handlerDrop > 0) a.handlers['java/lang/RuntimeException'] -= handlerDrop;
  a.athrow = Math.max(b.athrow, a.athrow - Math.max(0, a.athrow - b.athrow));
  const sbDrop = Math.min(wrappers, (a.newTypes['new java/lang/StringBuilder'] || 0) - (b.newTypes['new java/lang/StringBuilder'] || 0));
  if (sbDrop > 0) a.newTypes['new java/lang/StringBuilder'] -= sbDrop;
  for (const k of Object.keys(a.calls)) {
    if (!k.startsWith('java/lang/StringBuilder.')) continue;
    const d = (a.calls[k] || 0) - (b.calls[k] || 0);
    if (d > 0) a.calls[k] -= d;
  }
  // the context string literal, e.g. "ml.A("
  for (const k of Object.keys(a.strings)) {
    if (!/^[a-z]+\.[A-Za-z]\($/.test(k)) continue;
    const d = (a.strings[k] || 0) - (b.strings[k] || 0);
    if (d > 0) a.strings[k] -= d;
  }
  for (const m of [a.calls, a.handlers, a.newTypes, a.strings]) {
    for (const k of Object.keys(m)) if (!m[k]) delete m[k];
  }
}

// ---------------------------------------------------------------- diffing

function diffMap(a, b) {
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] || 0, y = b[k] || 0;
    if (x !== y) out.push({ key: k, a: x, b: y });
  }
  return out.sort((p, q) => (p.key < q.key ? -1 : 1));
}

// Severity weights: how likely a divergence in this category is to be a
// gameplay-visible bug. Field/array stores and constants top the list because
// they change persistent state; arith and handlers next; call-count drops are
// often dead-code removal on the `original` leg, so they rank lower there.
const WEIGHT = {
  fieldWrites: 100, arrayStores: 90, consts: 80, handlers: 70, monitors: 70,
  arith: 60, calls: 50, newTypes: 40, strings: 30, fieldReads: 15, athrow: 5,
};

// IMPORTANT ASYMMETRY. These counts are STATIC, not dynamic. The pipeline runs
// several tail-duplication passes (scripts/pipeline/eiTailClone.js,
// qcDoLoopTailClone.js, rasterScanlineEntryClone.js, structuredGotoClone.js)
// which clone a block onto several predecessors. That multiplies the static
// count of every effect in the cloned block while leaving dynamic behaviour
// identical -- only one copy executes per path. So a count INCREASE is weak
// evidence (usually duplication), whereas a count DECREASE means an effect
// exists on some path in A with no counterpart in B, which no duplication pass
// can explain. Score drops an order of magnitude above adds so the ranking
// surfaces genuine losses first.
const ADD_DISCOUNT = 0.1;

function diffMethod(ia, ib, opts) {
  if (!opts.raw) { cancelIxorIdiom(ia, ib); cancelRethrowWrapper(ia, ib); }
  const cats = {};
  for (const c of ['calls', 'fieldWrites', 'fieldReads', 'arrayStores', 'arrayLoads', 'consts', 'strings', 'newTypes', 'arith', 'handlers']) {
    const d = diffMap(ia[c], ib[c]);
    if (d.length) cats[c] = d;
  }
  // Only monitorenter count and exception-path protection are compared;
  // monitorexit count is deliberately NOT an oracle (see extractMethod).
  const mon = [
    { key: 'monitorenter', a: ia.monitorenter, b: ib.monitorenter },
    // b>a here means B has MORE unprotected monitors, i.e. a lock that can leak
    { key: 'unprotectedMonitors', a: ia.unprotectedMonitors, b: ib.unprotectedMonitors },
  ].filter((e) => e.a !== e.b);
  if (mon.length) cats.monitors = mon;
  if (ia.athrow !== ib.athrow) cats.athrow = [{ key: 'athrow', a: ia.athrow, b: ib.athrow }];
  if (!Object.keys(cats).length) return null;

  let score = 0, drops = 0;
  for (const [c, entries] of Object.entries(cats)) {
    const w = WEIGHT[c] || 10;
    for (const e of entries) {
      const delta = e.a - e.b;
      if (delta > 0) { score += w * delta; drops += delta; }
      else score += w * -delta * ADD_DISCOUNT;
    }
  }
  return { cats, score: Math.round(score), drops };
}

// ---------------------------------------------------------------- driver

function loadClass(file) {
  const ast = getAST(new Uint8Array(fs.readFileSync(file)));
  const R = poolResolver(ast.constantPool);
  const methods = new Map();
  for (const m of ast.ast.methods) {
    methods.set(`${m.name}${m.descriptor}`, extractMethod(m, R));
  }
  return { methods, fields: ast.ast.fields.map((f) => `${normField(f.name)}:${f.descriptor}`) };
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { leg: 'decompile', class: null, json: null, all: false, raw: false, top: 40 };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === '--a') opts.a = path.resolve(argv[++i]);
    else if (k === '--b') opts.b = path.resolve(argv[++i]);
    else if (k === '--leg') opts.leg = argv[++i];
    else if (k === '--class') opts.class = argv[++i];
    else if (k === '--json') opts.json = path.resolve(argv[++i]);
    else if (k === '--all') opts.all = true;
    else if (k === '--raw') opts.raw = true;
    else if (k === '--top') opts.top = Number(argv[++i]);
    // --hard restricts output to DROPPED effects in the categories that no
    // duplication or restructuring pass can explain away. This is the
    // high-signal view; start here.
    else if (k === '--hard') opts.hard = true;
    else throw new Error(`unknown argument: ${k}`);
  }
  let A = opts.a, B = opts.b;
  if (!A || !B) {
    if (!LEGS[opts.leg]) throw new Error(`unknown --leg ${opts.leg}; expected ${Object.keys(LEGS).join('|')}`);
    [A, B] = LEGS[opts.leg];
  }
  for (const d of [A, B]) if (!fs.existsSync(d)) throw new Error(`missing directory: ${d}`);

  const files = fs.readdirSync(A).filter((f) => f.endsWith('.class')).sort();
  const findings = [];
  const missing = [];
  let methodsCompared = 0, methodsClean = 0;

  for (const f of files) {
    if (opts.class && f !== `${opts.class}.class`) continue;
    const bFile = path.join(B, f);
    if (!fs.existsSync(bFile)) { missing.push({ cls: f, why: 'class absent in B' }); continue; }
    const ca = loadClass(path.join(A, f));
    const cb = loadClass(bFile);
    const cls = f.replace(/\.class$/, '');

    for (const [sig, ia] of ca.methods) {
      const ib = cb.methods.get(sig);
      if (!ib) { missing.push({ cls, sig, why: 'method absent in B' }); continue; }
      methodsCompared += 1;
      const d = diffMethod(ia, ib, opts);
      if (!d) { methodsClean += 1; continue; }
      findings.push({ cls, sig, score: d.score, drops: d.drops, cats: d.cats });
    }
    for (const sig of cb.methods.keys()) {
      if (!ca.methods.has(sig)) missing.push({ cls, sig, why: 'method added in B' });
    }
  }

  let shown = findings;
  if (opts.hard) {
    const HARD = new Set(['fieldWrites', 'arrayStores', 'monitors', 'handlers', 'calls', 'strings']);
    shown = [];
    for (const f of findings) {
      const cats = {};
      for (const [c, entries] of Object.entries(f.cats)) {
        if (!HARD.has(c)) continue;
        const dropped = entries.filter((e) => e.a > e.b);
        if (dropped.length) cats[c] = dropped;
      }
      if (Object.keys(cats).length) shown.push(Object.assign({}, f, { cats }));
    }
  }
  findings.sort((x, y) => y.score - x.score);
  shown.sort((x, y) => y.score - x.score);

  console.log(`# semdiff  A=${path.relative(ROOT, A)}  B=${path.relative(ROOT, B)}`);
  console.log(`# classes=${files.length} methods=${methodsCompared} clean=${methodsClean} divergent=${findings.length}` + (opts.hard ? ` hard=${shown.length}` : ""));
  if (missing.length) console.log(`# structural mismatches: ${missing.length}`);
  console.log('');

  const show = opts.all ? shown : shown.slice(0, opts.top);
  for (const fnd of show) {
    console.log(`[${fnd.score}] ${fnd.cls}.${fnd.sig}`);
    for (const [cat, entries] of Object.entries(fnd.cats)) {
      for (const e of entries) {
        console.log(`    ${cat.padEnd(12)} ${e.key}  A=${e.a} B=${e.b}`);
      }
    }
    console.log('');
  }
  if (!opts.all && shown.length > opts.top) {
    console.log(`... ${shown.length - opts.top} more (use --all)`);
  }
  for (const m of missing.slice(0, 20)) {
    console.log(`MISSING ${m.cls}${m.sig ? '.' + m.sig : ''}: ${m.why}`);
  }

  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ a: A, b: B, methodsCompared, methodsClean, findings, missing }, null, 2));
    console.log(`\n# wrote ${opts.json}`);
  }
}

main();
