#!/usr/bin/env node
'use strict';

// Dekobloko bulk pipeline runner. The generic bytecode passes live in
// java-tools; gamepack-specific ordering, target fixes, and hardcoded symbol
// renames live here so java-tools remains reusable.
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');
const { createRequire } = Module;

const DEKOB = path.resolve(__dirname, '..', '..');
const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const NODE_DEPS_DIR = path.resolve(process.env.JAVA_TOOLS_NODE_DEPS_DIR || '/home/kreijstal/git/java-tools');
process.env.NODE_PATH = [
  path.join(JT, 'node_modules'),
  path.join(NODE_DEPS_DIR, 'node_modules'),
  process.env.NODE_PATH || '',
].filter(Boolean).join(path.delimiter);
Module._initPaths();
const jtRequire = createRequire(path.join(JT, 'package.json'));
const nodeDepsRequire = createRequire(path.join(NODE_DEPS_DIR, 'package.json'));

function requireToolModule(name) {
  try {
    return jtRequire(name);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') return nodeDepsRequire(name);
    throw err;
  }
}

const { getAST } = requireToolModule('jvm_parser');

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

const { convertJson } = requireJavaTools('src/parsing/convert_tree', 'src/convert_tree');
const { writeClassAstToClassFile } = requireJavaTools('src/parsing/classAstToClassFile', 'src/classAstToClassFile');
const {
  runPeepholeClean,
  threadBranchesThroughGoto,
} = requireJavaTools('src/passes/peepholeClean', 'src/peepholeClean');
const { removeTrivialRethrowHandlers } = requireJavaTools('src/passes/removeTrivialRethrowHandlers', 'src/removeTrivialRethrowHandlers');
const { removeRuntimeExceptionHandlers } = requireJavaTools('src/passes/removeRuntimeExceptionHandlers', 'src/removeRuntimeExceptionHandlers');
const { runRemoveShadowingTrivialRethrowHandlers } = requireJavaTools('src/passes/removeShadowingTrivialRethrowHandlers', 'src/removeShadowingTrivialRethrowHandlers');
const { runMultiEntryLoopNormalizer } = requireJavaTools('src/passes/multiEntryLoopNormalizer', 'src/multiEntryLoopNormalizer');
const { runCoalesceLoopLoad } = requireJavaTools('src/passes/coalesceLoopLoad', 'src/coalesceLoopLoad');
const { runDeadStaticBoolFlag, discoverDeadStaticFlags } = requireJavaTools('src/passes/deadStaticBoolFlag', 'src/deadStaticBoolFlag');
const { runConstructorPreSuperCleanup } = requireJavaTools('src/passes/constructorPreSuperCleanup', 'src/constructorPreSuperCleanup');
const {
  runAddDefaultConstructorsForImplicitSupers,
  discoverAddableConstructorSupers,
} = requireJavaTools('src/passes/addDefaultConstructorsForImplicitSupers', 'src/addDefaultConstructorsForImplicitSupers');
const { runInlineSharedExitGoto } = requireJavaTools('src/passes/inlineSharedExitGoto', 'src/inlineSharedExitGoto');
const { runInlineSharedReturn } = requireJavaTools('src/passes/inlineSharedReturn', 'src/inlineSharedReturn');
const { runRemoveShadowedExceptionHandlers } = requireJavaTools('src/passes/removeShadowedExceptionHandlers', 'src/removeShadowedExceptionHandlers');
const { runControlFlowDce } = requireJavaTools('src/passes/controlFlowDce', 'src/controlFlowDce');
const { runSimplifyNotCompare } = requireJavaTools('src/passes/simplifyNotCompare', 'src/simplifyNotCompare');
const { runSimplifyStringLengthNotCompare } = requireJavaTools('src/passes/simplifyStringLengthNotCompare', 'src/simplifyStringLengthNotCompare');
const { runNarrowCharArrayStores } = requireJavaTools('src/passes/narrowCharArrayStores', 'src/narrowCharArrayStores');
const { runNarrowByteArrayStores } = requireJavaTools('src/passes/narrowByteArrayStores', 'src/narrowByteArrayStores');
const { runNarrowShortArrayStores } = requireJavaTools('src/passes/narrowShortArrayStores', 'src/narrowShortArrayStores');
const { runCastObjectFieldStores } = requireJavaTools('src/passes/castObjectFieldStores', 'src/castObjectFieldStores');
const { runCastPrivateFieldReceivers } = requireJavaTools('src/passes/castPrivateFieldReceivers', 'src/castPrivateFieldReceivers');
const { runCastInvokeReceiversToOwners } = requireJavaTools('src/passes/castInvokeReceiversToOwners', 'src/castInvokeReceiversToOwners');
const { runCastFieldReceiversToOwners } = requireJavaTools('src/passes/castFieldReceiversToOwners', 'src/castFieldReceiversToOwners');
const { runCastStaticInvokeArgsToDeclaredTypes } = requireJavaTools('src/passes/castStaticInvokeArgsToDeclaredTypes', 'src/castStaticInvokeArgsToDeclaredTypes');
const { runCastObjectLocalStoreFromUses } = requireJavaTools('src/passes/castObjectLocalStoreFromUses', 'src/castObjectLocalStoreFromUses');
const { runMaterializeTypedNullArgs } = requireJavaTools('src/passes/materializeTypedNullArgs', 'src/materializeTypedNullArgs');
const { runStripArrayNullLocalCheckcasts } = requireJavaTools('src/passes/stripArrayNullLocalCheckcasts', 'src/stripArrayNullLocalCheckcasts');
const { runMaterializeCheckedFieldInitializers } = requireJavaTools('src/passes/materializeCheckedFieldInitializers', 'src/materializeCheckedFieldInitializers');
const { runMaterializeStackJoinStores } = requireJavaTools('src/passes/materializeStackJoinStores', 'src/materializeStackJoinStores');
const { runMaterializeBooleanInvokeArgs } = requireJavaTools('src/passes/materializeBooleanInvokeArgs', 'src/materializeBooleanInvokeArgs');
const { runMaterializeSkippedStringLocals } = requireJavaTools('src/passes/materializeSkippedStringLocals', 'src/materializeSkippedStringLocals');
const { runMaterializeBranchJoinReferenceLocals } = requireJavaTools('src/passes/materializeBranchJoinReferenceLocals', 'src/materializeBranchJoinReferenceLocals');
const { runCastReferenceArrayAssignmentsToDeclaredTypes } = requireJavaTools('src/passes/castReferenceArrayAssignmentsToDeclaredTypes', 'src/castReferenceArrayAssignmentsToDeclaredTypes');
const { runInitializeUnassignedReferenceLocalsFromParameters } = requireJavaTools('src/passes/initializeUnassignedReferenceLocalsFromParameters', 'src/initializeUnassignedReferenceLocalsFromParameters');
const { runNormalizeBooleanFieldOr } = requireJavaTools('src/passes/normalizeBooleanFieldOr', 'src/normalizeBooleanFieldOr');
const { runNormalizeBooleanSinks } = requireJavaTools('src/passes/normalizeBooleanSinks', 'src/normalizeBooleanSinks');
const { runNormalizeDupStoreLoad } = requireJavaTools('src/passes/normalizeDupStoreLoad', 'src/normalizeDupStoreLoad');
const { runPrimitiveArrayCopyLoops } = requireJavaTools('src/passes/primitiveArrayCopyLoops', 'src/primitiveArrayCopyLoops');
const { runRemoveDeadDupStore } = requireJavaTools('src/passes/removeDeadDupStore', 'src/removeDeadDupStore');
const { runInlineGotoReturnIsland } = requireJavaTools('src/passes/inlineGotoReturnIsland', 'src/inlineGotoReturnIsland');
const { runSplitArrayReachingLocal } = requireJavaTools('src/passes/splitArrayReachingLocal', 'src/splitArrayReachingLocal');
const { runSplitArrayStoreLocalAssignment } = requireJavaTools('src/passes/splitArrayStoreLocalAssignment', 'src/splitArrayStoreLocalAssignment');
const { runSplitCastedLocalRange } = requireJavaTools('src/passes/splitCastedLocalRange', 'src/splitCastedLocalRange');
const { runSplitReferenceArrayReachingLocal } = requireJavaTools('src/passes/splitReferenceArrayReachingLocal', 'src/splitReferenceArrayReachingLocal');
const { runSplitConcreteObjectReachingLocal } = requireJavaTools('src/passes/splitConcreteObjectReachingLocal', 'src/splitConcreteObjectReachingLocal');
const { runSplitTypedAliasCopyLocals } = requireJavaTools('src/passes/splitTypedAliasCopyLocals', 'src/splitTypedAliasCopyLocals');
const { runSplitPrimitiveIntBranchLocal } = requireJavaTools('src/passes/splitPrimitiveIntBranchLocal', 'src/splitPrimitiveIntBranchLocal');
const { runInlineSingleUseBooleanBranch } = requireJavaTools('src/passes/inlineSingleUseBooleanBranch', 'src/inlineSingleUseBooleanBranch');
const { runIntizeBooleanParameters } = requireJavaTools('src/passes/intizeBooleanParameters', 'src/intizeBooleanParameters');
const { runLiftSourceScopeLocals } = requireJavaTools('src/passes/liftSourceScopeLocals', 'src/liftSourceScopeLocals');
const { runSplitTypedReusedLocals } = requireJavaTools('src/passes/splitTypedReusedLocals', 'src/splitTypedReusedLocals');
const { runRetargetUndefinedTypedAliasLoads } = requireJavaTools('src/passes/retargetUndefinedTypedAliasLoads', 'src/retargetUndefinedTypedAliasLoads');

const { runEiTailClone } = require('./eiTailClone');
const { runQcDoLoopTailClone } = require('./qcDoLoopTailClone');
const { runRasterClipContinuation } = require('./ckClipFlag');
const { runQkExceptionSplit } = require('./qkExceptionSplit');
const { runVlCacheJoin } = require('./vlCacheJoin');
const { runBParserLoopHeader } = require('./bParserLoopHeader');
const { runRasterScanlineEntryClone } = require('./rasterScanlineEntryClone');
const { runSourceScopeLocalInit } = require('./sourceScopeLocalInit');
const { runStackReceiverTailClone } = require('./stackReceiverTailClone');
const { runRetargetBranches } = require('./retargetBranches');
const { expandMethodRenames, runCompileConflictRenames } = require('./compileConflictRenames');
const { runDekoblokoExceptionHandlerDrops } = require('./removeShadowedExceptionHandlers');

const inDir = process.argv[2];
const outDir = process.argv[3];
const skipInline = process.argv.includes('--skip-inline');
const skipControlFlowDce = process.argv.includes('--skip-cfdce');
const keepRuntimeHandlers = process.argv.includes('--keep-runtime-handlers');
const runtimeSafe = process.argv.includes('--runtime-safe');
const safeBytecode = process.argv.includes('--safe-bytecode');
const profileArg = readOptionValue('--profile') || readOptionValue('--profiles') || process.env.PIPELINE_PROFILES || '';
const selectedProfiles = (profileArg || 'dekobloko')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const skipPassNames = new Set((process.env.SKIP_PIPELINE_PASSES || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean));
if (skipPassNames.has('ck-clip-flag')) {
  skipPassNames.add('raster-clip-continuation');
}

if (!inDir || !outDir) {
  console.error('Usage: bulk-pipeline.js <input-class-dir> <output-class-dir> [--profile dekobloko|none|all|name[,name...]] [--skip-inline] [--safe-bytecode]');
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(inDir).filter((f) => f.endsWith('.class'));
const profiles = loadProfiles(path.join(__dirname, 'profiles'), selectedProfiles);
for (const passName of profiles.skipPasses) {
  skipPassNames.add(passName);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dekob-bulkpipe-'));
const tmpFile = path.join(tmpDir, 'tmp.class');

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
      if (typeof value === 'string' && !out.has(value)) {
        out.set(value, raw);
      }
      continue;
    }
    if (tag === 3 || tag === 4 || tag === 9 || tag === 10 || tag === 11 || tag === 12 || tag === 18) {
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

function saveAndReload(ast, cp) {
  writeClassAstToClassFile(ast, tmpFile, cp);
  return loadAst(tmpFile);
}

function readOptionValue(name) {
  const prefixed = `${name}=`;
  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === name) return process.argv[i + 1] || '';
    if (arg && arg.startsWith(prefixed)) return arg.slice(prefixed.length);
  }
  return '';
}

function loadProfiles(dir, selected = []) {
  const merged = {
    deadFlagFields: [],
    compileConflictRenames: { fields: [], methods: [] },
    exceptionHandlerDrops: { handlers: [], ranges: [] },
    eiTailClone: [],
    qkExceptionSplit: [],
    qcDoLoopTailClone: [],
    ckClipFlag: [],
    ckClipFlagQuadrants: [],
    vlCacheJoin: [],
    bParserLoopHeader: [],
    rasterScanlineEntryClone: [],
    sourceScopeLocalInit: [],
    stackReceiverTailClone: [],
    retargetBranches: [],
    materializeBooleanInvokeArgs: [],
    splitArrayReachingLocalOptions: {},
    controlFlowDceOptions: {},
    skipPasses: [],
  };
  if (!fs.existsSync(dir)) return merged;
  if (selected.some((name) => name === 'none' || name === 'none.json')) return merged;
  const loadAll = selected.some((name) => name === 'all' || name === 'all.json');
  const selectedSet = new Set(selected.map((name) => name.endsWith('.json') ? name : `${name}.json`));
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => loadAll || selectedSet.has(f))
    .sort();
  for (const file of files) {
    const profile = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const key of Object.keys(merged)) {
      if (!profile[key]) continue;
      if (Array.isArray(merged[key])) {
        merged[key].push(...profile[key]);
      } else if (key === 'splitArrayReachingLocalOptions' || key === 'controlFlowDceOptions') {
        Object.assign(merged[key], profile[key]);
      } else if (key === 'compileConflictRenames') {
        merged[key].fields.push(...(profile[key].fields || []));
        merged[key].methods.push(...(profile[key].methods || []));
      } else if (key === 'exceptionHandlerDrops') {
        merged[key].handlers.push(...(profile[key].handlers || []));
        merged[key].ranges.push(...(profile[key].ranges || []));
      }
    }
  }
  for (const key of ['ckClipFlagQuadrants']) {
    const seen = new Set();
    merged[key] = merged[key].filter((entry) => {
      const text = JSON.stringify(entry);
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
  }
  return merged;
}

function raiseMaxStackFloor(ast, floor = 64) {
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      for (const attr of item.method.attributes || []) {
        const code = attr && attr.type === 'code' && attr.code;
        if (!code) continue;
        const current = Number(code.stackSize || 0);
        if (!Number.isFinite(current) || current < floor) {
          code.stackSize = String(floor);
        }
      }
    }
  }
}

function runConstructorBranchThreading(ast) {
  let rewrites = 0;
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method || item.method.name !== '<init>') continue;
      for (const attr of item.method.attributes || []) {
        const code = attr && attr.type === 'code' && attr.code;
        if (!code || !Array.isArray(code.codeItems)) continue;
        rewrites += threadBranchesThroughGoto(code.codeItems);
        rewrites += removeUnreferencedExceptionEndGotoReturns(code);
      }
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function removeUnreferencedExceptionEndGotoReturns(code) {
  const codeItems = code.codeItems || [];
  const endLabels = new Set((code.exceptionTable || [])
    .map((entry) => trimLabel(entry.endLbl || entry.endLabel || entry.end))
    .filter(Boolean));
  if (endLabels.size === 0) return 0;
  const referenced = collectInstructionReferencedLabels(codeItems);
  let removed = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    const item = codeItems[i];
    const label = trimLabel(item && item.labelDef);
    if (!label || !endLabels.has(label) || referenced.has(label)) continue;
    const insn = item && item.instruction;
    if (!insn || instructionOp(insn) !== 'goto') continue;
    const previous = previousInstruction(codeItems, i - 1);
    if (!previous || !isTerminalInstruction(previous.instruction)) continue;
    const targetIndex = findLabelIndex(codeItems, instructionArg(insn));
    const targetInstruction = targetIndex >= 0 ? nextInstruction(codeItems, targetIndex) : null;
    if (!targetInstruction || instructionOp(targetInstruction.instruction) !== 'return') continue;
    item.instruction = 'nop';
    delete item.pc;
    removed += 1;
  }
  return removed;
}

function collectInstructionReferencedLabels(codeItems) {
  const out = new Set();
  for (const item of codeItems) collectLabelsFromValue(item && item.instruction, out);
  return out;
}

function collectLabelsFromValue(value, out) {
  if (!value) return;
  if (typeof value === 'string') return;
  if (Array.isArray(value)) {
    for (const entry of value) collectLabelsFromValue(entry, out);
    return;
  }
  if (typeof value !== 'object') return;
  if (typeof value.arg === 'string' && /^L\\d+/.test(trimLabel(value.arg))) out.add(trimLabel(value.arg));
  collectLabelsFromValue(value.arg, out);
}

function previousInstruction(codeItems, start) {
  for (let i = start; i >= 0; i -= 1) {
    if (codeItems[i] && codeItems[i].instruction) return codeItems[i];
  }
  return null;
}

function nextInstruction(codeItems, start) {
  for (let i = start; i < codeItems.length; i += 1) {
    if (codeItems[i] && codeItems[i].instruction) return codeItems[i];
  }
  return null;
}

function findLabelIndex(codeItems, label) {
  const target = trimLabel(label);
  return codeItems.findIndex((item) => trimLabel(item && item.labelDef) === target);
}

function isTerminalInstruction(insn) {
  const op = instructionOp(insn);
  return op === 'athrow' || op === 'return' || op === 'areturn' || op === 'ireturn' ||
    op === 'lreturn' || op === 'freturn' || op === 'dreturn';
}

function instructionOp(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function instructionArg(insn) {
  return insn && typeof insn === 'object' ? insn.arg : null;
}

function trimLabel(label) {
  return typeof label === 'string' && label.endsWith(':') ? label.slice(0, -1) : label;
}

function collectClassShadowFieldRenames() {
  const classNames = new Set(files.map((f) => path.basename(f, '.class')));
  const byKey = new Map();
  const parents = new Map();
  for (const rename of profiles.compileConflictRenames.fields) {
    byKey.set(`${rename.owner}.${rename.name}:${rename.descriptor}`, rename);
  }
  for (const f of files) {
    const { ast } = loadAst(path.join(inDir, f));
    for (const cls of ast.classes || []) {
      parents.set(cls.className, cls.superClassName);
      for (const item of cls.items || []) {
        if (!item || item.type !== 'field' || !item.field) continue;
        const field = item.field;
        if (!classNames.has(field.name)) continue;
        const key = `${cls.className}.${field.name}:${field.descriptor}`;
        if (byKey.has(key)) continue;
        byKey.set(key, {
          owner: cls.className,
          name: field.name,
          descriptor: field.descriptor,
          to: `${cls.className}_${field.name}`,
        });
      }
    }
  }
  for (const rename of [...byKey.values()]) {
    for (const cls of classNames) {
      let cur = cls;
      while (parents.has(cur)) {
        cur = parents.get(cur);
        if (cur !== rename.owner) continue;
        const key = `${cls}.${rename.name}:${rename.descriptor}`;
        if (!byKey.has(key)) {
          byKey.set(key, { ...rename, owner: cls });
        }
        break;
      }
    }
  }
  return [...byKey.values()];
}

function collectMethodOverrideRenames() {
  const classes = [];
  for (const f of files) {
    const { ast } = loadAst(path.join(inDir, f));
    classes.push(...(ast.classes || []));
  }
  return expandMethodRenames({ classes }, profiles.compileConflictRenames.methods);
}

function collectAutoDeadFlagFields() {
  const classes = [];
  for (const f of files) {
    const { ast } = loadAst(path.join(inDir, f));
    classes.push(...(ast.classes || []));
  }
  return discoverDeadStaticFlags({ classes }, {
    allowIntFlags: true,
    allowTerminalSelfIncrementFlags: true,
  }).fields;
}

function collectImplicitSuperCtorClasses() {
  const classes = [];
  for (const f of files) {
    const { ast } = loadAst(path.join(inDir, f));
    classes.push(...(ast.classes || []));
  }
  const byName = new Map(classes.map((cls) => [cls.className, cls]));
  return discoverAddableConstructorSupers(classes, byName);
}

const fieldRenames = collectClassShadowFieldRenames();
const methodRenames = collectMethodOverrideRenames();
const autoDeadFlagFields = collectAutoDeadFlagFields();
const deadFlagFields = [
  ...profiles.deadFlagFields,
  ...autoDeadFlagFields,
].join(',');
const implicitSuperCtorClasses = collectImplicitSuperCtorClasses();

const passes = [
  { name: 'add-default-constructors-for-implicit-supers', fn: (a) => runAddDefaultConstructorsForImplicitSupers(a, { classesToAdd: implicitSuperCtorClasses }) },
  { name: 'ei-tail-clone', fn: (a) => runEiTailClone(a, { targets: profiles.eiTailClone }) },
  { name: 'peephole', fn: (a) => runPeepholeClean(a, {
    ...(runtimeSafe ? { removeRethrowHandlers: false } : {}),
    ...(safeBytecode ? {
      invertConditionalsOverGoto: true,
      invertConditionalsOverGotoClasses: ['emb', 'vaa'],
      cloneSharedFallthroughJoins: true,
      cloneSharedFallthroughJoinClasses: ['hbb'],
      cloneConditionalSharedJoins: true,
      cloneLongCompareSharedJoins: true,
      cloneConditionalSharedJoinClasses: [],
      cloneConditionalSharedJoinMinMethodInsns: 400,
      cloneConditionalSharedJoinMinArrayStores: 0,
      cloneConditionalSharedJoinRequireNoExceptions: true,
      cloneConditionalSharedJoinRequireStatic: true,
      cloneConditionalSharedJoinMaxLocalIndex: 200,
      cloneConditionalSharedJoinRequireIntArrayParameter: true,
      removeConditionalFallthroughGotoBridges: true,
      materializeDupStoreCompareBranches: true,
      materializeNullableSharedJoinGuards: true,
      nullableSharedJoinGuardMinMethodInsns: 80,
      nullableSharedJoinGuardRequireNoExceptions: false,
      nullableSharedJoinGuardMaxLocalIndex: 200,
      stripMonitorWaitExceptionRegions: true,
      cloneConditionalSharedLoopTails: true,
      cloneConditionalSharedLoopTailClasses: ['roa'],
    } : {}),
  }) },
  ...(keepRuntimeHandlers || runtimeSafe ? [] : [{ name: 'runtime-exception-handlers', fn: (a) => removeRuntimeExceptionHandlers(a, { keepHandlerCode: true }) }]),
  ...(runtimeSafe ? [] : [
    { name: 'remove-shadowed-exception-handlers', fn: (a) => runRemoveShadowedExceptionHandlers(a) },
    { name: 'remove-shadowing-trivial-rethrow-handlers', fn: (a) => runRemoveShadowingTrivialRethrowHandlers(a) },
    { name: 'dekobloko-exception-handler-drops', fn: (a) => runDekoblokoExceptionHandlerDrops(a, profiles.exceptionHandlerDrops) },
    { name: 'strip-rethrow', fn: (a) => removeTrivialRethrowHandlers(a, { keepHandlerCode: true }) },
  ]),
  { name: 'normalizer', fn: (a) => runMultiEntryLoopNormalizer(a) },
  { name: 'coalesce', fn: (a) => runCoalesceLoopLoad(a) },
  { name: 'dead-flag', fn: (a) => runDeadStaticBoolFlag(a, {
    flags: deadFlagFields,
    allowIntFlags: true,
    preserveBranchShape: safeBytecode,
    preserveBranchShapeMinMethodInsns: 400,
    preserveBranchShapeRequireNoExceptions: true,
    preserveBranchShapeRequireStatic: true,
    preserveBranchShapeMaxLocalIndex: 200,
    preserveBranchShapeRequireIntArrayParameter: true,
  }) },
  { name: 'constructor-pre-super-cleanup', fn: (a) => runConstructorPreSuperCleanup(a, { deleteUnusedSnapshots: true }) },
  { name: 'simplify-not-compare', fn: (a) => runSimplifyNotCompare(a, {
    charLocalsOnly: true,
    generalIntNotCompare: safeBytecode,
    generalIntNotCompareMinMethodInsns: 400,
    generalIntNotCompareRequireNoExceptions: true,
    generalIntNotCompareRequireStatic: true,
    generalIntNotCompareMaxLocalIndex: 200,
    generalIntNotCompareRequireIntArrayParameter: true,
  }) },
  { name: 'simplify-string-length-not-compare', fn: (a) => runSimplifyStringLengthNotCompare(a) },
  { name: 'narrow-char-array-stores', fn: (a) => runNarrowCharArrayStores(a) },
  { name: 'narrow-byte-array-stores', fn: (a) => runNarrowByteArrayStores(a) },
  { name: 'narrow-short-array-stores', fn: (a) => runNarrowShortArrayStores(a) },
  { name: 'cast-object-field-stores', fn: (a) => runCastObjectFieldStores(a) },
  { name: 'cast-private-field-receivers', fn: (a) => runCastPrivateFieldReceivers(a) },
  { name: 'cast-invoke-receivers-to-owners', fn: (a) => safeBytecode
    ? runCastInvokeReceiversToOwners(a)
    : { changed: false, rewrites: 0 } },
  { name: 'cast-field-receivers-to-owners', fn: (a) => safeBytecode
    ? runCastFieldReceiversToOwners(a, { classes: ['roa'], maxCasts: 512 })
    : { changed: false, rewrites: 0 } },
  { name: 'materialize-typed-null-args', fn: (a) => runMaterializeTypedNullArgs(a) },
  { name: 'strip-array-null-local-checkcasts', fn: (a) => safeBytecode
    ? runStripArrayNullLocalCheckcasts(a)
    : { changed: false, rewrites: 0 } },
  { name: 'materialize-checked-field-initializers', fn: (a) => runMaterializeCheckedFieldInitializers(a) },
  { name: 'materialize-stack-join-stores', fn: (a) => runMaterializeStackJoinStores(a) },
  { name: 'normalize-boolean-field-or', fn: (a) => runNormalizeBooleanFieldOr(a) },
  { name: 'normalize-boolean-sinks', fn: (a) => safeBytecode ? runNormalizeBooleanSinks(a) : { changed: false, rewrites: 0 } },
  { name: 'intize-boolean-parameters', fn: (a) => safeBytecode ? runIntizeBooleanParameters(a) : { changed: false, rewrites: 0 } },
  { name: 'normalize-dup-store-load', fn: (a) => runNormalizeDupStoreLoad(a) },
  { name: 'primitive-array-copy-loops', fn: (a) => runPrimitiveArrayCopyLoops(a) },
  { name: 'split-array-reaching-local', fn: (a) => runSplitArrayReachingLocal(a, {
    ...(safeBytecode ? { requireDominance: true, preserveOriginalLocals: true } : {}),
    ...profiles.splitArrayReachingLocalOptions,
  }) },
  { name: 'split-reference-array-reaching-local', fn: (a) => runSplitReferenceArrayReachingLocal(a) },
  { name: 'split-array-store-local-assignment', fn: (a) => runSplitArrayStoreLocalAssignment(a) },
  { name: 'split-primitive-int-branch-local', fn: (a) => runSplitPrimitiveIntBranchLocal(a) },
  { name: 'split-casted-local-range', fn: (a) => runSplitCastedLocalRange(a) },
  { name: 'split-concrete-object-reaching-local', fn: (a) => runSplitConcreteObjectReachingLocal(a, safeBytecode ? { requireDominance: true, preserveOriginalLocals: true } : {}) },
  { name: 'cast-object-local-store-from-uses', fn: (a) => runCastObjectLocalStoreFromUses(a) },
  { name: 'split-concrete-object-reaching-local2', fn: (a) => runSplitConcreteObjectReachingLocal(a, safeBytecode ? { requireDominance: true, preserveOriginalLocals: true } : {}) },
  { name: 'split-typed-alias-copy-locals', fn: (a) => safeBytecode
    ? runSplitTypedAliasCopyLocals(a)
    : { changed: false, rewrites: 0 } },
  { name: 'split-typed-reused-locals', fn: (a) => safeBytecode
    ? runSplitTypedReusedLocals(a, { preserveOriginalLocals: true, minMethodItems: 100, maxIterations: 2 })
    : { changed: false, rewrites: 0 } },
  { name: 'remove-dead-dup-store', fn: (a) => runRemoveDeadDupStore(a) },
  { name: 'inline-single-use-boolean-branch', fn: (a) => runInlineSingleUseBooleanBranch(a) },
  { name: 'inline-goto-return-island', fn: (a) => runInlineGotoReturnIsland(a) },
  ...(skipInline ? [] : [{ name: 'inline-exit', fn: (a) => runInlineSharedExitGoto(a, { maxBodyInsns: 50 }) }]),
  { name: 'inline-return', fn: (a) => runInlineSharedReturn(a, { oncePerMethod: false }) },
  { name: 'raster-clip-continuation', fn: (a) => runRasterClipContinuation(a, { targets: profiles.ckClipFlag, quadrants: profiles.ckClipFlagQuadrants }) },
  ...(runtimeSafe ? [] : [{ name: 'qk-exception-split', fn: (a) => runQkExceptionSplit(a, { targets: profiles.qkExceptionSplit }) }]),
  { name: 'vl-cache-join', fn: (a) => runVlCacheJoin(a, { targets: profiles.vlCacheJoin }) },
  { name: 'b-parser-loop-header', fn: (a) => runBParserLoopHeader(a, { targets: profiles.bParserLoopHeader }) },
  { name: 'raster-scanline-entry-clone', fn: (a) => runRasterScanlineEntryClone(a, { targets: profiles.rasterScanlineEntryClone }) },
  { name: 'source-scope-local-init', fn: (a) => runSourceScopeLocalInit(a, { targets: profiles.sourceScopeLocalInit }) },
  { name: 'stack-receiver-tail-clone', fn: (a) => runStackReceiverTailClone(a, { targets: profiles.stackReceiverTailClone }) },
  ...(runtimeSafe ? [] : [{ name: 'remove-shadowing-trivial-rethrow-handlers2', fn: (a) => runRemoveShadowingTrivialRethrowHandlers(a) }]),
  { name: 'peephole2', fn: (a) => runPeepholeClean(a, {
    ...(runtimeSafe ? { removeRethrowHandlers: false } : {}),
    ...(safeBytecode ? {
      invertConditionalsOverGoto: true,
      invertConditionalsOverGotoClasses: ['emb', 'vaa'],
      cloneSharedFallthroughJoins: true,
      cloneSharedFallthroughJoinClasses: ['hbb'],
      cloneConditionalSharedJoins: true,
      cloneLongCompareSharedJoins: true,
      cloneConditionalSharedJoinClasses: [],
      cloneConditionalSharedJoinMinMethodInsns: 400,
      cloneConditionalSharedJoinMinArrayStores: 0,
      cloneConditionalSharedJoinRequireNoExceptions: true,
      cloneConditionalSharedJoinRequireStatic: true,
      cloneConditionalSharedJoinMaxLocalIndex: 200,
      cloneConditionalSharedJoinRequireIntArrayParameter: true,
      removeConditionalFallthroughGotoBridges: true,
      materializeDupStoreCompareBranches: true,
      materializeNullableSharedJoinGuards: true,
      nullableSharedJoinGuardMinMethodInsns: 80,
      nullableSharedJoinGuardRequireNoExceptions: false,
      nullableSharedJoinGuardMaxLocalIndex: 200,
      stripMonitorWaitExceptionRegions: true,
      cloneConditionalSharedLoopTails: true,
      cloneConditionalSharedLoopTailClasses: ['roa'],
    } : {}),
  }) },
  ...(skipControlFlowDce ? [] : [{ name: 'control-flow-dce', fn: (a) => runControlFlowDce(a, {
    ...(safeBytecode ? { requireIsolatedMergeTarget: true, guardStackGotos: true } : {}),
    ...profiles.controlFlowDceOptions,
  }) }]),
  { name: 'qc-doloop-tail-clone', fn: (a) => runQcDoLoopTailClone(a, { targets: profiles.qcDoLoopTailClone }) },
  ...(runtimeSafe ? [] : [{ name: 'compile-conflict-renames', fn: (a) => runCompileConflictRenames(a, { fieldRenames, methodRenames }) }]),
  { name: 'materialize-boolean-invoke-args', fn: (a) => runMaterializeBooleanInvokeArgs(a, { targets: profiles.materializeBooleanInvokeArgs }) },
  { name: 'inline-single-use-boolean-branch2', fn: (a) => runInlineSingleUseBooleanBranch(a) },
  { name: 'retarget-branches', fn: (a) => runRetargetBranches(a, { targets: profiles.retargetBranches }) },
  { name: 'split-typed-reused-locals-late', fn: (a) => safeBytecode
    ? runSplitTypedReusedLocals(a, { preserveOriginalLocals: true, minMethodItems: 100, maxIterations: 2 })
    : { changed: false, rewrites: 0 } },
  { name: 'retarget-undefined-typed-alias-loads', fn: (a) => safeBytecode
    ? runRetargetUndefinedTypedAliasLoads(a)
    : { changed: false, rewrites: 0 } },
  { name: 'split-reference-array-reaching-local-late', fn: (a) => safeBytecode
    ? runSplitReferenceArrayReachingLocal(a)
    : { changed: false, rewrites: 0 } },
  { name: 'materialize-skipped-string-locals', fn: (a) => safeBytecode
    ? runMaterializeSkippedStringLocals(a)
    : { changed: false, rewrites: 0 } },
  { name: 'cast-static-invoke-args-to-declared-types', fn: (a) => safeBytecode
    ? runCastStaticInvokeArgsToDeclaredTypes(a)
    : { changed: false, rewrites: 0 } },
  { name: 'materialize-branch-join-reference-locals', fn: (a) => safeBytecode
    ? runMaterializeBranchJoinReferenceLocals(a)
    : { changed: false, rewrites: 0 } },
  { name: 'cast-reference-array-assignments-to-declared-types', fn: (a) => safeBytecode
    ? runCastReferenceArrayAssignmentsToDeclaredTypes(a)
    : { changed: false, rewrites: 0 } },
  { name: 'lift-source-scope-locals', fn: (a) => safeBytecode ? runLiftSourceScopeLocals(a) : { changed: false, rewrites: 0 } },
  { name: 'cast-reference-array-assignments-to-declared-types-late', fn: (a) => safeBytecode
    ? runCastReferenceArrayAssignmentsToDeclaredTypes(a)
    : { changed: false, rewrites: 0 } },
  { name: 'initialize-unassigned-reference-locals-from-parameters', fn: (a) => safeBytecode
    ? runInitializeUnassignedReferenceLocalsFromParameters(a)
    : { changed: false, rewrites: 0 } },
  { name: 'materialize-skipped-string-locals-final', fn: (a) => safeBytecode
    ? runMaterializeSkippedStringLocals(a)
    : { changed: false, rewrites: 0 } },
  { name: 'retarget-undefined-typed-alias-loads-final', fn: (a) => safeBytecode
    ? runRetargetUndefinedTypedAliasLoads(a)
    : { changed: false, rewrites: 0 } },
  { name: 'constructor-pre-super-cleanup-final', fn: (a) => safeBytecode
    ? runConstructorPreSuperCleanup(a, { deleteUnusedSnapshots: true })
    : { changed: false, rewrites: 0 } },
  { name: 'constructor-branch-threading-final', fn: (a) => safeBytecode
    ? runConstructorBranchThreading(a)
    : { changed: false, rewrites: 0 } },
];

let processed = 0;
let failed = 0;
for (const f of files) {
  const inPath = path.join(inDir, f);
  const outPath = path.join(outDir, f);
  try {
    let { ast, cp } = loadAst(inPath);
    for (const p of passes) {
      if (skipPassNames.has(p.name)) continue;
      try {
        p.fn(ast);
        ({ ast, cp } = saveAndReload(ast, cp));
      } catch (err) {
        err.pipelinePass = p.name;
        throw err;
      }
    }
    runInlineSingleUseBooleanBranch(ast);
    raiseMaxStackFloor(ast);
    writeClassAstToClassFile(ast, outPath, cp);
    processed += 1;
  } catch (err) {
    failed += 1;
    if (process.env.BULK_PIPELINE_LOG_FAILURES) {
      const pass = err && err.pipelinePass ? ` pass=${err.pipelinePass}` : '';
      console.error(`Failed ${f}${pass}: ${err && err.stack ? err.stack : err}`);
    }
    fs.copyFileSync(inPath, outPath);
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Done: ${processed}/${files.length} processed, ${failed} failed (passthrough)`);
