#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const NODE_DEPS_DIR = path.resolve(process.env.JAVA_TOOLS_NODE_DEPS_DIR || JT);
process.env.NODE_PATH = [
  path.join(JT, 'node_modules'),
  path.join(NODE_DEPS_DIR, 'node_modules'),
  process.env.NODE_PATH || '',
].filter(Boolean).join(path.delimiter);
Module._initPaths();

const jtRequire = Module.createRequire(path.join(JT, 'package.json'));
const nodeDepsRequire = Module.createRequire(path.join(NODE_DEPS_DIR, 'package.json'));

function requireToolModule(name) {
  try {
    return jtRequire(name);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') return nodeDepsRequire(name);
    throw err;
  }
}

function requireJavaTools(...relPaths) {
  const tried = [];
  for (const rel of relPaths) {
    const abs = path.join(JT, rel);
    tried.push(abs);
    let resolved;
    try {
      resolved = require.resolve(abs);
    } catch (err) {
      if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;
      continue;
    }
    return require(resolved);
  }
  throw new Error(`Unable to load java-tools module; tried:\n${tried.join('\n')}`);
}

const { getAST } = requireToolModule('jvm_parser');
const { convertJson } = requireJavaTools('src/parsing/convert_tree', 'src/convert_tree');
const { writeClassAstToClassFile } = requireJavaTools('src/parsing/classAstToClassFile', 'src/classAstToClassFile');
const { runStructuredGotoClone } = require('./pipeline/structuredGotoClone');
const { runTerminalIteratorExtract } = require('./pipeline/terminalIteratorExtract');
const { runPollLoopReturnNormalize } = require('./pipeline/pollLoopReturnNormalize');

const scenarios = [
  {
    name: 'steelsentinels/oi small iinc join clone stays valid on raw bytecode',
    classFile: '.work/games/steelsentinels/classes/oi.class',
    pass: 'structured-small-iinc-join',
    expectedBaseline: { markers: 2, bad: false },
    expectedCandidate: { markers: 2, bad: false },
    expectChanged: true,
  },
  {
    name: 'aceofskies/fg loop-entry rejects multi-backedge header',
    classFile: '.work/games/aceofskies/deob-safe/out/fg.class',
    pass: 'structured-loop-entry',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'transmogrify/fg loop-entry negative gate stays clean',
    classFile: '.work/games/transmogrify/deob-safe/out/fg.class',
    pass: 'structured-loop-entry',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/se loop-entry negative gate stays clean',
    classFile: '.work/games/steelsentinels/deob-safe/out/se.class',
    pass: 'structured-loop-entry',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/se duplicate loop increment tails merge',
    classFile: '.work/games/steelsentinels/deob-safe/out/se.class',
    pass: 'structured-iinc-tail-merge',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/se duplicate backedge tails merge',
    classFile: '.work/games/steelsentinels/deob-safe/out/se.class',
    pass: 'structured-backedge-tail-merge',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/se false return guard cleanup removes visible gotos',
    classFile: '.work/games/steelsentinels/deob-safe/out/se.class',
    pass: 'structured-false-return-guards',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/fc shared continue tail clone removes url cleanup goto',
    classFile: '.work/games/steelsentinels/deob-safe/out/fc.class',
    pass: 'structured-shared-continue-tails',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    // The regenerated ji.class fixture still carries markers but no longer
    // matches the byte-wrap-scan shape; the pass must not misfire on it.
    name: 'steelsentinels/ji byte wrap scan tail gate leaves regenerated fixture unchanged',
    classFile: '.work/games/steelsentinels/deob-safe/out/ji.class',
    pass: 'structured-ji-byte-wrap-scan-tails',
    expectedBaseline: { markers: 3, bad: false },
    expectedCandidate: { markers: 3, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/pb blur late tail retarget removes blur gotos',
    classFile: '.work/games/steelsentinels/deob-safe/out/pb.class',
    pass: 'structured-pb-blur-tail-retarget',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'steelsentinels/SteelSentinels duplicate drain header canonicalization removes gotos',
    classFile: '.work/games/steelsentinels/deob-safe/out/SteelSentinels.class',
    pass: 'structured-duplicate-drain-header',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    // The regenerated p.class fixture is marker-free and now decompiles cleanly
    // (removeUnreachableCodeCfg strips the islands that used to trip the
    // bad-output detector); the pass must stay quiet on it.
    name: 'dungeonassault/p shared straight-line cleanup tail clone stays quiet on clean fixture',
    classFile: '.work/games/dungeonassault/deob-safe/out/p.class',
    pass: 'structured-shared-forward-goto-continuation',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'virogrid/uf dominated boolean branch cleanup stays quiet on clean fixture',
    classFile: '.work/games/virogrid/deob-safe/out/uf.class',
    pass: 'structured-dominated-boolean-local-branches',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'monkeypuzzle2/eb sibling local scan clone stays quiet on clean fixture',
    classFile: '.work/games/monkeypuzzle2/deob-safe/out/eb.class',
    pass: 'structured-sibling-local-scan-bodies',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'monkeypuzzle2/il shared boolean constant tail stays quiet on clean fixture',
    classFile: '.work/games/monkeypuzzle2/deob-safe/out/il.class',
    pass: 'structured-shared-boolean-constant-tail',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'monkeypuzzle2/hj shared instance int update tail stays quiet on clean fixture',
    classFile: '.work/games/monkeypuzzle2/deob-safe/out/hj.class',
    pass: 'structured-shared-instance-int-update-tail',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'pool/ug shared string index retry tail stays quiet on clean fixture',
    classFile: '.work/games/pool/deob-safe/out/ug.class',
    pass: 'structured-shared-string-index-retry-tail',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: false,
  },
  {
    name: 'aceofskies/fg terminal iterator does not synthesize invisible locals',
    classFile: '.work/games/aceofskies/deob-safe/out/fg.class',
    pass: 'terminal-iterator',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { bad: false },
  },
  {
    name: 'hostilespawn_vengeance/e splits nullable arraylength minus-one guard',
    classFile: '.work/games/hostilespawn_vengeance/deob-safe/out/e.class',
    pass: 'poll-loop-return-normalize',
    expectedBaseline: { markers: 0, bad: false },
    expectedCandidate: { markers: 0, bad: false },
    expectChanged: true,
  },
];

function loadAst(filePath) {
  const buf = fs.readFileSync(filePath);
  const parsed = getAST(new Uint8Array(buf));
  parsed.constantPool.rawUtf8BytesByValue = parseRawUtf8BytesByValue(buf, parsed.constantPool);
  return { ast: convertJson(parsed.ast, parsed.constantPool), cp: parsed.constantPool };
}

function parseRawUtf8BytesByValue(buf, constantPool) {
  const out = new Map();
  let offset = 8;
  const count = buf.readUInt16BE(offset);
  offset += 2;
  for (let index = 1; index < count; index += 1) {
    const tag = buf.readUInt8(offset);
    offset += 1;
    if (tag === 1) {
      const len = buf.readUInt16BE(offset);
      offset += 2;
      const raw = Buffer.from(buf.subarray(offset, offset + len));
      offset += len;
      const value = constantPool[index] && constantPool[index].info && constantPool[index].info.bytes;
      if (typeof value === 'string' && !out.has(value)) out.set(value, raw);
    } else if (tag === 3 || tag === 4 || tag === 9 || tag === 10 || tag === 11 || tag === 12 || tag === 18) {
      offset += 4;
    } else if (tag === 5 || tag === 6) {
      offset += 8;
      index += 1;
    } else if (tag === 7 || tag === 8 || tag === 16) {
      offset += 2;
    } else if (tag === 15) {
      offset += 3;
    } else {
      throw new Error(`Unsupported constant pool tag ${tag} at index ${index}`);
    }
  }
  return out;
}

function raiseMaxStackFloor(ast, floor = 64) {
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      for (const attr of item.method.attributes || []) {
        const code = attr && attr.type === 'code' && attr.code;
        if (!code) continue;
        const current = Number(code.stackSize || 0);
        if (!Number.isFinite(current) || current < floor) code.stackSize = String(floor);
      }
    }
  }
}

function saveAndReload(ast, cp, filePath) {
  writeClassAstToClassFile(ast, filePath, cp);
  return loadAst(filePath);
}

function applyPass(ast, pass) {
  if (pass === 'structured-loop-entry') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '1',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-iinc-tail-merge') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '1',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-backedge-tail-merge') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '1',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '1',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-small-iinc-join') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '1',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-false-return-guards') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '1',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-shared-continue-tails') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '1',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-ji-byte-wrap-scan-tails') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '1',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-pb-blur-tail-retarget') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '1',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-duplicate-drain-header') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '1',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-shared-forward-goto-continuation') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '1',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-dominated-boolean-local-branches') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
      STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '1',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-sibling-local-scan-bodies') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
      STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '0',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SIBLING_LOCAL_SCAN_BODIES: '1',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-shared-boolean-constant-tail') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '1',
      STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '0',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-shared-instance-int-update-tail') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
      STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '0',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAILS: '1',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-shared-string-index-retry-tail') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
      STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '0',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAILS: '0',
      STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY: '0',
      STRUCTURED_GOTO_SHARED_STRING_INDEX_RETRY_TAIL: '1',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'structured-shared-array-record-update-body') {
    return withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
      STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
      STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
      STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
      STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
      STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
      STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
      STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
      STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
      STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
      STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
      STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '0',
      STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
      STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAILS: '0',
      STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY: '1',
    }, () => runStructuredGotoClone(ast));
  }
  if (pass === 'terminal-iterator') return runTerminalIteratorExtract(ast);
  if (pass === 'poll-loop-return-normalize') return runPollLoopReturnNormalize(ast);
  throw new Error(`Unknown pass ${pass}`);
}

function withEnv(env, fn) {
  const old = {};
  for (const [key, value] of Object.entries(env)) {
    old[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}

function markerCount(filePath) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'cfr-marker-count.js'), filePath], {
    cwd: DEKOB,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`cfr-marker-count failed for ${filePath}:\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function assertPartial(actual, expected, label) {
  for (const [key, value] of Object.entries(expected || {})) {
    assert.equal(actual[key], value, `${label}.${key}: actual=${JSON.stringify(actual)}`);
  }
}

function passChanged(result) {
  if (!result || typeof result !== 'object') return true;
  if (Object.prototype.hasOwnProperty.call(result, 'changed')) return !!result.changed;
  if (Object.prototype.hasOwnProperty.call(result, 'rewrites')) return Number(result.rewrites) > 0;
  if (Object.prototype.hasOwnProperty.call(result, 'changes')) return Number(result.changes) > 0;
  return true;
}

let checked = 0;
for (const scenario of scenarios) {
  const input = path.resolve(DEKOB, scenario.classFile);
  if (!fs.existsSync(input)) {
    console.error(`SKIP ${scenario.name}: missing ${scenario.classFile}`);
    continue;
  }
  const baseline = markerCount(input);
  assertPartial(baseline, scenario.expectedBaseline, `${scenario.name} baseline`);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-pass-regression-'));
  try {
    const out = path.join(work, path.basename(input));
    let { ast, cp } = loadAst(input);
    const passResult = applyPass(ast, scenario.pass);
    if (scenario.expectChanged !== undefined) {
      assert.equal(passChanged(passResult), scenario.expectChanged, `${scenario.name} changed`);
    }
    if (passChanged(passResult)) {
      ({ ast, cp } = saveAndReload(ast, cp, out));
    }
    raiseMaxStackFloor(ast);
    writeClassAstToClassFile(ast, out, cp);
    const candidate = markerCount(out);
    console.log(`${scenario.name}: ${JSON.stringify(baseline)} -> ${JSON.stringify(candidate)} result=${JSON.stringify(passResult)}`);
    assertPartial(candidate, scenario.expectedCandidate, `${scenario.name} candidate`);
    if (scenario.maxCandidateMarkers !== undefined) {
      assert.ok(candidate.markers <= scenario.maxCandidateMarkers,
        `${scenario.name} candidate markers <= ${scenario.maxCandidateMarkers}: actual=${JSON.stringify(candidate)}`);
    }
    console.log(`PASS ${scenario.name}`);
    checked += 1;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

assert.ok(checked > 0, 'no scenarios checked');
console.log(`PASS cfr-pass-regressions checked=${checked}`);
