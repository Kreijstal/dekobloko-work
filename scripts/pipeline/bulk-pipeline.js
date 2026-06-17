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
const { runTerminalIteratorExtract } = require('./terminalIteratorExtract');
const { runTerminalActionExtract } = require('./terminalActionExtract');
const { runTerminalCleanupExtract } = require('./terminalCleanupExtract');
const { runStructuredGotoClone } = require('./structuredGotoClone');
const { runPollLoopReturnNormalize } = require('./pollLoopReturnNormalize');
const { FIELD_RENAMES, METHOD_RENAMES, expandMethodRenames, runCompileConflictRenames } = require('./compileConflictRenames');
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
const experimentalPeepholeOptions = readJsonEnv('PIPELINE_EXPERIMENTAL_PEEPHOLE_OPTIONS');
const structuredGotoDefaultEnv = {
  STRUCTURED_GOTO_ONESHOT_PREHEADER: '1',
  STRUCTURED_GOTO_ITERATIVE: '1',
  STRUCTURED_GOTO_MAX_ITERATIONS: '8',
  STRUCTURED_GOTO_CLONE_SHORT: '0',
  STRUCTURED_GOTO_CLONE_ZERO: '0',
  STRUCTURED_GOTO_CLONE_RETURN: '0',
  STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
  STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '1',
  STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_REWRITES: '8',
  STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_INSNS: '220',
  STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
  STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGE_MAX_REWRITES: '128',
  STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
  STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAIL_MAX_REWRITES: '48',
  STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAIL_MAX_INSNS: '4',
  STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAIL_MAX_REFS: '12',
  STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
  STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATION_MAX_REWRITES: '12',
  STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATION_MAX_INSNS: '180',
  STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATION_MAX_REFS: '8',
  STRUCTURED_GOTO_HBB_CACHED_LOOKUP_CONTINUATION: '1',
  STRUCTURED_GOTO_UCA_SHARED_LOOP_INCREMENT_TAIL: '1',
  STRUCTURED_GOTO_VH_UCA_SHARED_RETURN_TAIL: '1',
  STRUCTURED_GOTO_VH_UCA_ENTITY_LOOP_CONTINUATION: '1',
  STRUCTURED_GOTO_VH_UCA_MENU_LOOP_CONTINUATION: '1',
  STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAILS: '1',
  STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL: '1',
  STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION: '1',
  STRUCTURED_GOTO_PREFIX_CONTINUATION: '1',
  STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL: '1',
  STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL: '1',
  STRUCTURED_GOTO_MESSAGE_EXIT_TAIL: '1',
  STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE: '1',
  STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE: '1',
  STRUCTURED_GOTO_STACK_SHIFT_STORE_TAIL: '1',
  STRUCTURED_GOTO_DUPLICATE_CARD_LOOP_CLEANUP: '1',
  STRUCTURED_GOTO_STACK_COMPARE_TAILS: '1',
  STRUCTURED_GOTO_CARD_SECOND_HAND_LOOP: '1',
  STRUCTURED_GOTO_CARD_LOOP_FALLBACK: '1',
  STRUCTURED_GOTO_SHARED_ICON_LOOP: '1',
  STRUCTURED_GOTO_EARLY_FINAL_LOOP_EXIT: '1',
  STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE: '1',
  STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS: '1',
  STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER: '1',
  STRUCTURED_GOTO_EVENT_DRAIN_LOOP: '1',
  STRUCTURED_GOTO_STACK_FLAG_COMPARE_MATERIALIZE: '1',
  STRUCTURED_GOTO_QUEUE_BODY_ENTRY_CLONE: '1',
  STRUCTURED_GOTO_QUEUE_FLAG_TRUE_ENTRY: '1',
  STRUCTURED_GOTO_BACKWARD_CONTINUE_TAILS: '1',
  STRUCTURED_GOTO_PHASE_CONTINUATION_TAIL: '1',
  STRUCTURED_GOTO_MENU_CONTINUATION_TAIL: '1',
  STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION: '1',
  STRUCTURED_GOTO_NESTED_ARRAY_SCAN_OUTER_CONTINUE: '1',
  STRUCTURED_GOTO_SHARED_TOOLTIP_RENDER_TAIL: '1',
};

const noSafeStructuredGotoDefaultEnv = {
  ...structuredGotoDefaultEnv,
  STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
  STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
  STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
  STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
  STRUCTURED_GOTO_MAX_ITERATIONS: '3',
};

const tracePassTimes = process.env.BULK_PIPELINE_TRACE_PASS_TIMES === '1';
const tracePassGating = process.env.BULK_PIPELINE_TRACE_PASS_GATING === '1';
if (skipPassNames.has('ck-clip-flag')) {
  skipPassNames.add('raster-clip-continuation');
}

if (!inDir || !outDir) {
  console.error('Usage: bulk-pipeline.js <input-class-dir> <output-class-dir> [--profile dekobloko|none|all|name[,name...]] [--skip-inline] [--safe-bytecode]');
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });

function listClassFiles(dir, root = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(root, absPath);
    if (entry.isDirectory()) {
      out.push(...listClassFiles(absPath, root));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.class')) {
      out.push(relPath);
    }
  }
  return out;
}

const files = listClassFiles(inDir);
const processFiles = selectProcessFiles(files);
const processFileSet = new Set(processFiles);
const profiles = loadProfiles(path.join(__dirname, 'profiles'), selectedProfiles);
for (const passName of profiles.skipPasses) {
  skipPassNames.add(passName);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dekob-bulkpipe-'));
const tmpFile = path.join(tmpDir, 'tmp.class');

function selectProcessFiles(allFiles) {
  const listPath = process.env.BULK_PIPELINE_CLASS_LIST || '';
  const filterRe = process.env.BULK_PIPELINE_CLASS_FILTER || '';
  if (!listPath && !filterRe) return allFiles;
  let selected = new Set(allFiles);
  if (listPath) {
    const wanted = new Set(fs.readFileSync(listPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.endsWith('.class') ? line : `${line}.class`));
    selected = new Set([...selected].filter((file) => wanted.has(file) || wanted.has(path.basename(file))));
  }
  if (filterRe) {
    const re = new RegExp(filterRe);
    selected = new Set([...selected].filter((file) => re.test(file)));
  }
  return allFiles.filter((file) => selected.has(file));
}

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


function classBasename(classFile) {
  return path.basename(classFile || '', '.class');
}

function configuredList(envName, defaults) {
  const value = Object.prototype.hasOwnProperty.call(process.env, envName) ? process.env[envName] : defaults;
  return String(value || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function configuredClassSet(envName, defaults) {
  return new Set(configuredList(envName, defaults));
}

function shouldRunNoSafeStructuredGoto(astRoot) {
  if (process.env.STRUCTURED_GOTO_NOSAFE_ALL === '1') return true;
  if (process.env.STRUCTURED_GOTO_NOSAFE_ALL === '0') return false;
  return hasTargetedCfrCloneCandidate(astRoot);
}

function shouldRunNoSafeTargetedPeephole(astRoot) {
  if (process.env.PIPELINE_NOSAFE_TARGETED_PEEPHOLE_ALL === '1') return true;
  if (process.env.PIPELINE_NOSAFE_TARGETED_PEEPHOLE_ALL === '0') return false;
  return hasLateStackConditionalTargetCandidate(astRoot);
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

function readJsonEnv(name) {
  const value = process.env[name];
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected a JSON object');
    }
    return parsed;
  } catch (err) {
    console.error(`Invalid ${name}: ${err && err.message ? err.message : err}`);
    process.exit(2);
  }
}

function tracePassTime(classFile, passName, startMs) {
  if (!tracePassTimes) return;
  const elapsed = Date.now() - startMs;
  console.error(`TRACE ${classFile} ${passName} ${elapsed}ms`);
}

function passChanged(result) {
  if (result == null) return true;
  if (typeof result !== 'object') return true;
  if (Object.prototype.hasOwnProperty.call(result, 'changed')) return !!result.changed;
  if (Object.prototype.hasOwnProperty.call(result, 'changes')) return Number(result.changes) > 0;
  if (Object.prototype.hasOwnProperty.call(result, 'rewrites')) return Number(result.rewrites) > 0;
  return true;
}

function withEnvDefaults(defaults, fn) {
  const changedKeys = [];
  for (const [key, value] of Object.entries(defaults)) {
    if (process.env[key] !== undefined) continue;
    changedKeys.push(key);
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const key of changedKeys) delete process.env[key];
  }
}

function structuredGotoIterationCount() {
  if (process.env.STRUCTURED_GOTO_ITERATIVE !== '1') return 1;
  const count = Number(process.env.STRUCTURED_GOTO_MAX_ITERATIONS || 8);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

const terminalTailCloneMaxMethodInsns = Number(process.env.TERMINAL_TAIL_CLONE_MAX_METHOD_INSNS || 2500);
const smartPassGating = process.env.BULK_PIPELINE_SMART_PASS_GATING !== '0';

function passAllowsRun(passName) {
  const key = `PIPELINE_ALLOW_${passName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  return process.env[key] === '1';
}

function shouldRunPass(pass, astRoot, classFile) {
  if (!smartPassGating) return true;
  if (!pass || !pass.canRun) return true;
  if (passAllowsRun(pass.name)) return true;
  const allowed = !!pass.canRun(astRoot);
  if (!allowed && tracePassGating) {
    const label = `${classFile || 'class'}:${pass.name}`;
    console.error(`SKIP PASS ${label} (gated)`);
  }
  return allowed;
}

function shouldSkipPassForAst(passName, astRoot, classFile) {
  const envName = `PIPELINE_SKIP_${passName.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_CLASSES`;
  const explicit = configuredClassSet(envName, '');
  if (explicit.has(classBasename(classFile))) return true;
  return passName === 'control-flow-dce' && hasControlFlowDceHostileCandidate(astRoot);
}

function catchTypeFromEntry(entry) {
  const value = entry && (entry.catch_type || entry.catchType || entry.type || entry.catchClass);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[value.length - 1];
  if (value && typeof value === 'object') return value.name || value.className || null;
  return null;
}

function hasLikelyObfuscatedRuntimeExceptionHandlers(astRoot) {
  let totalRuntimeHandlers = 0;
  let runtimeOnlyMethods = 0;
  let runtimeMethodsWithSmallHandlers = 0;

  for (const classItem of astRoot.classes || []) {
    for (const item of classItem.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const code = codeAttr && codeAttr.code;
      if (!code || !Array.isArray(code.exceptionTable) || code.exceptionTable.length === 0) continue;

      let runtimeHandlers = 0;
      let totalHandlers = 0;
      let minSpan = Infinity;

      for (const entry of code.exceptionTable) {
        if (catchTypeFromEntry(entry) === 'java/lang/RuntimeException') {
          runtimeHandlers += 1;
          totalRuntimeHandlers += 1;
          const span = (code.codeItems || []).length;
          if (span < minSpan) minSpan = span;
        }
        totalHandlers += 1;
      }

      if (runtimeHandlers === 0) continue;
      if (totalHandlers > 0 && runtimeHandlers === totalHandlers) {
        runtimeOnlyMethods += 1;
        if (minSpan <= 220) {
          runtimeMethodsWithSmallHandlers += 1;
        }
      }
    }
  }

  if (totalRuntimeHandlers === 0) return false;
  return runtimeMethodsWithSmallHandlers > 0 || runtimeOnlyMethods >= 3;
}

function hasLikelyRuntimeExceptionHandlerCandidates(astRoot) {
  return hasLikelyObfuscatedRuntimeExceptionHandlers(astRoot);
}

const NORMALIZER_JUMP_OPS = new Set([
  'goto', 'jsr', 'goto_w',
  'ifeq', 'ifne', 'iflt', 'ifge', 'ifgt', 'ifle',
  'if_icmpeq', 'if_icmpne', 'if_icmplt', 'if_icmpge', 'if_icmpgt', 'if_icmple',
  'if_acmpeq', 'if_acmpne',
  'ifnull', 'ifnonnull',
]);
const NORMALIZER_TERMINALS = new Set([
  'ret', 'return', 'ireturn', 'lreturn', 'freturn', 'dreturn', 'areturn', 'athrow',
  'goto', 'tableswitch', 'lookupswitch',
]);

function normalizeCandidateCountForCode(codeItems, exceptionTable, opts) {
  const maxCloneInsns = opts.maxCloneInsns || 64;
  const minIncoming = opts.minIncoming || 2;

  if (!Array.isArray(codeItems) || codeItems.length === 0) {
    return 0;
  }

  const handlerLabels = new Set();
  for (const entry of exceptionTable || []) {
    const handler = trimLabel(entry.handlerLbl || entry.handlerLabel || entry.handler);
    if (handler) handlerLabels.add(handler);
  }

  const labelIndex = new Map();
  codeItems.forEach((entry, idx) => {
    const label = trimLabel(entry && entry.labelDef);
    if (label) labelIndex.set(label, idx);
  });

  const incoming = new Map();
  for (let idx = 0; idx < codeItems.length; idx += 1) {
    const item = codeItems[idx];
    const insn = item && item.instruction;
    const op = instructionOp(insn);
    if (!op) continue;

    const targets = [];
    if (op === 'tableswitch' || op === 'lookupswitch') {
      const value = instructionArg(insn);
      if (value && typeof value === 'string') {
        targets.push(value);
      }
      if (insn && Array.isArray(insn.labels)) {
        for (const label of insn.labels) {
          targets.push(label);
        }
      }
      if (insn && typeof insn.defaultLbl === 'string') {
        targets.push(insn.defaultLbl);
      }
    } else if (NORMALIZER_JUMP_OPS.has(op) || op === 'invokedynamic') {
      const arg = instructionArg(insn);
      if (arg) targets.push(arg);
    }

    for (const rawTarget of targets) {
      const target = trimLabel(rawTarget);
      if (!target) continue;
      if (!labelIndex.has(target)) continue;
      const list = incoming.get(target) || [];
      list.push(idx);
      incoming.set(target, list);
    }
  }

  let candidateCount = 0;
  for (const [target, jumps] of incoming.entries()) {
    if (!target || handlerLabels.has(target) || jumps.length < minIncoming) continue;
    const targetIdx = labelIndex.get(target);
    if (targetIdx == null) continue;

    let forward = 0;
    let back = 0;
    for (const srcIdx of jumps) {
      if (srcIdx >= targetIdx) back += 1;
      else forward += 1;
    }
    if (forward === 0 || back === 0) continue;

    let blockInsns = 0;
    let terminal = false;
    for (let i = targetIdx; i < codeItems.length && blockInsns <= maxCloneInsns + 1; i += 1) {
      const insn = codeItems[i] && codeItems[i].instruction;
      if (!insn) continue;
      blockInsns += 1;
      const opCode = instructionOp(insn);
      if (NORMALIZER_TERMINALS.has(opCode)) {
        terminal = true;
        break;
      }
    }
    if (terminal && blockInsns <= maxCloneInsns + 1) {
      candidateCount += 1;
    }
  }
  return candidateCount;
}

function hasLikelyLoopNormalizationCandidates(astRoot, options = {}) {
  let candidates = 0;
  for (const classItem of astRoot.classes || []) {
    for (const item of classItem.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const code = codeAttr && codeAttr.code;
      if (!code || !Array.isArray(code.codeItems) || code.codeItems.length === 0) continue;
      candidates += normalizeCandidateCountForCode(code.codeItems, code.exceptionTable || [], options);
      if (candidates > 32) {
        return true;
      }
    }
  }
  return candidates >= 1;
}

function safePeepholeOptions(options) {
  return {
    ...options,
    ...experimentalPeepholeOptions,
  };
}

function safePeepholeOptionsForClass(astRoot, classFile, options) {
  const merged = safePeepholeOptions(options);
  const disableHeavy = safeBytecode && shouldDisableHeavyPeepholeClonesForAst(astRoot, classFile);
  if (safeBytecode && shouldDisableTerminalTailClonesForAst(astRoot, classFile)) {
    merged.cloneForwardTerminalGotoTails = false;
    merged.cloneConditionalTerminalTails = false;
    merged.cloneBoundedTerminalGotoTails = false;
  }
  if (disableHeavy) {
    disableHeavyPeepholeCloneOptions(merged);
  } else if (safeBytecode && shouldEnableLateStackConditionalTargetClones(astRoot, classFile)) {
    merged.cloneStackConditionalTargets = true;
  }
  return merged;
}

function structuredGotoDefaultEnvForClass(astRoot, classFile) {
  const merged = { ...structuredGotoDefaultEnv };
  if (safeBytecode && shouldDisableBroadStructuredGotoClonesForAst(astRoot, classFile)) {
    merged.STRUCTURED_GOTO_ONESHOT_PREHEADER = '0';
    merged.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS = '0';
    merged.STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS = '0';
    merged.STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS = '0';
    merged.STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES = '0';
  }
  return merged;
}


function shouldEnableLateStackConditionalTargetClones(astRoot, classFile) {
  const explicit = configuredClassSet('PIPELINE_LATE_STACK_CONDITIONAL_TARGET_CLASSES', '');
  if (explicit.has(classBasename(classFile))) return true;
  return hasLateStackConditionalTargetCandidate(astRoot);
}

function disableHeavyPeepholeCloneOptions(options) {
  options.cloneSharedFallthroughJoins = false;
  options.cloneSmallTerminalSharedForwardBlocks = false;
  options.cloneConditionalSharedJoins = false;
  options.cloneSharedPureForwardJoins = false;
  options.cloneLongCompareSharedJoins = false;
  options.cloneForwardTerminalGotoTails = false;
  options.cloneSharedLoopIncrementTails = false;
  options.cloneSharedSideEffectJoins = false;
  options.cloneBoundedTerminalGotoTails = false;
  options.cloneLoopValueContinuations = false;
  options.cloneConditionalTerminalTails = false;
  options.cloneConditionalSharedLoopTails = false;
  options.cloneStackConditionalTargets = false;
}

function shouldDisableTerminalTailClonesForAst(astRoot, classFile) {
  const explicit = configuredClassSet('PIPELINE_DISABLE_TERMINAL_TAIL_CLONE_CLASSES', '');
  if (explicit.has(classBasename(classFile))) return true;
  return hasBroadCloneSensitiveCandidate(astRoot);
}

function shouldDisableHeavyPeepholeClonesForAst(astRoot, classFile) {
  const explicit = configuredClassSet('PIPELINE_DISABLE_HEAVY_PEEPHOLE_CLONE_CLASSES', '');
  if (explicit.has(classBasename(classFile))) return true;
  return hasBroadCloneSensitiveCandidate(astRoot) || hasLargeControlFlowMethod(astRoot);
}

function shouldDisableBroadStructuredGotoClonesForAst(astRoot, classFile) {
  const explicit = configuredClassSet('PIPELINE_DISABLE_BROAD_STRUCTURED_GOTO_CLONE_CLASSES', '');
  if (explicit.has(classBasename(classFile))) return true;
  return hasBroadCloneSensitiveCandidate(astRoot);
}

function hasMethodSignature(astRoot, owner, name, descriptor) {
  for (const cls of astRoot.classes || []) {
    if (!cls || cls.className !== owner || !Array.isArray(cls.items)) continue;
    for (const item of cls.items) {
      const method = item && item.type === 'method' && item.method;
      if (method && method.name === name && method.descriptor === descriptor) return true;
    }
  }
  return false;
}


function hasTargetedCfrCloneCandidate(astRoot) {
  return anyCodeItems(astRoot, (codeItems) =>
    hasRasterBlurDetachedHeaderCandidate(codeItems) ||
    hasStackShiftStoreTailCandidate(codeItems) ||
    hasCardLoopCandidate(codeItems) ||
    hasStaticStringMenuContinuationCandidate(codeItems) ||
    hasPhaseContinuationCandidate(codeItems) ||
    hasUcaLikeSharedReturnTailCandidate(codeItems) ||
    hasUcaLikeSharedLoopIncrementCandidate(codeItems) ||
    hasSharedRenderContinuationCandidateBulk(codeItems) ||
    hasBucketArrayInitCandidate(codeItems) ||
    hasIteratorAdvanceTailCandidate(codeItems) ||
    hasMessageExitTailCandidate(codeItems) ||
    hasSharedBooleanLoopTailCandidate(codeItems) ||
    hasVectorFinalLoopCandidate(codeItems) ||
    hasArrayMembershipOuterContinueCandidate(codeItems) ||
    hasDuplicateArrayLoopHeaderAliasCandidateBulk(codeItems) ||
    hasEventDrainQueueCandidate(codeItems) ||
    hasBackwardContinueTailCandidate(codeItems) ||
    hasNestedArrayScanOuterContinueCandidate(codeItems) ||
    hasSharedTooltipRenderTailCandidate(codeItems)
  );
}

function hasBroadCloneSensitiveCandidate(astRoot) {
  return anyCodeItems(astRoot, (codeItems) =>
    hasStackShiftStoreTailCandidate(codeItems) ||
    hasCardLoopCandidate(codeItems) ||
    hasUcaLikeSharedReturnTailCandidate(codeItems) ||
    hasUcaLikeSharedLoopIncrementCandidate(codeItems) ||
    hasUcaLikeMenuContinuationCandidate(codeItems) ||
    hasSharedRenderContinuationCandidateBulk(codeItems) ||
    hasBucketArrayInitCandidate(codeItems) ||
    hasIteratorAdvanceTailCandidate(codeItems) ||
    hasMessageExitTailCandidate(codeItems) ||
    hasSharedBooleanLoopTailCandidate(codeItems) ||
    hasVectorFinalLoopCandidate(codeItems) ||
    hasArrayMembershipOuterContinueCandidate(codeItems) ||
    hasDuplicateArrayLoopHeaderAliasCandidateBulk(codeItems) ||
    hasEventDrainQueueCandidate(codeItems) ||
    hasBackwardContinueTailCandidate(codeItems) ||
    hasNestedArrayScanOuterContinueCandidate(codeItems) ||
    hasSharedTooltipRenderTailCandidate(codeItems)
  );
}

function hasLateStackConditionalTargetCandidate(astRoot) {
  return anyCodeItems(astRoot, (codeItems) =>
    hasStackShiftStoreTailCandidate(codeItems) ||
    hasCardLoopCandidate(codeItems) ||
    hasVectorFinalLoopCandidate(codeItems) ||
    hasStaticStringMenuContinuationCandidate(codeItems)
  );
}

function hasControlFlowDceHostileCandidate(astRoot) {
  return anyCodeItems(astRoot, (codeItems) =>
    hasUcaLikeSharedReturnTailCandidate(codeItems) ||
    hasUcaLikeMenuContinuationCandidate(codeItems)
  );
}

function anyCodeItems(astRoot, predicate) {
  for (const cls of astRoot.classes || []) {
    for (const item of cls.items || []) {
      const method = item && item.type === 'method' && item.method;
      const codeAttr = method && (method.attributes || []).find((attr) => attr && attr.type === 'code');
      const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
      if (Array.isArray(codeItems) && predicate(codeItems, method, cls)) return true;
    }
  }
  return false;
}

function hasLargeControlFlowMethod(astRoot) {
  return anyCodeItems(astRoot, (codeItems) => {
    let insns = 0;
    let branches = 0;
    for (const item of codeItems) {
      const cur = instructionOp(item && item.instruction);
      if (!cur) continue;
      insns += 1;
      if (cur === 'goto' || cur === 'goto_w' || (typeof cur === 'string' && cur.startsWith('if'))) branches += 1;
    }
    return insns >= 400 && branches >= 24;
  });
}

function hasRasterBlurDetachedHeaderCandidate(codeItems) {
  for (let header = 1; header + 8 < codeItems.length; header += 1) {
    if (instructionOp(itemInsn(codeItems, header - 1)) !== 'return') continue;
    if (intLoadLocalBulk(itemInsn(codeItems, header)) == null) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, header + 1)) == null) continue;
    const branch = itemInsn(codeItems, header + 2);
    if (instructionOp(branch) !== 'if_icmplt') continue;
    const duplicateBody = findLabelIndex(codeItems, instructionArg(branch));
    if (duplicateBody <= header + 2) continue;
    if (!readZeroStoreGotoShapeBulk(codeItems, duplicateBody)) continue;
    if (readZeroStoreGotoShapeBulk(codeItems, duplicateBody - 3)) return true;
  }
  return false;
}

function hasStackShiftStoreTailCandidate(codeItems) {
  for (let i = 0; i + 10 < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'ishr') continue;
    if (instructionOp(itemInsn(codeItems, i + 1)) !== 'goto') continue;
    if (instructionOp(itemInsn(codeItems, i + 2)) !== 'ishr') continue;
    if (instructionOp(itemInsn(codeItems, i + 3)) !== 'dup_x2') continue;
    if (instructionOp(itemInsn(codeItems, i + 4)) !== 'iastore') continue;
    if (instructionOp(itemInsn(codeItems, i + 5)) !== 'iastore') continue;
    return true;
  }
  return false;
}

function hasCardLoopCandidate(codeItems) {
  for (let i = 0; i + 8 < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'iconst_0') continue;
    if (intStoreLocalBulk(itemInsn(codeItems, i + 1)) == null) continue;
    if (!isBipushBulk(itemInsn(codeItems, i + 2), 7)) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i + 3)) == null) continue;
    if (instructionOp(itemInsn(codeItems, i + 4)) !== 'if_icmple') continue;
    if (refLoadLocalBulk(itemInsn(codeItems, i + 5)) !== 0) continue;
    if (!isGetFieldReferenceBulk(itemInsn(codeItems, i + 6))) continue;
    if (!isGetFieldObjectArrayBulk(itemInsn(codeItems, i + 7))) continue;
    return true;
  }
  return false;
}

function hasStaticStringMenuContinuationCandidate(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'goto') continue;
    if (!isPutStaticDescriptorBulk(itemInsn(codeItems, i - 1), 'Ljava/lang/String;')) continue;
    const target = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i)));
    if (target >= 0 && isGetStaticDescriptorBulk(itemInsn(codeItems, target), 'J')) return true;
  }
  return false;
}

function hasPhaseContinuationCandidate(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'goto') continue;
    if (!isInvokeDescriptorBulk(itemInsn(codeItems, i - 1), '(IIII)V')) continue;
    const target = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i)));
    if (target < 0 || target + 5 >= codeItems.length) continue;
    if (instructionOp(itemInsn(codeItems, target)) === 'iconst_0' &&
      intStoreLocalBulk(itemInsn(codeItems, target + 1)) != null &&
      instructionOp(itemInsn(codeItems, target + 2)) === 'iconst_0' &&
      intStoreLocalBulk(itemInsn(codeItems, target + 3)) != null) return true;
  }
  return false;
}

function hasUcaLikeSharedReturnTailCandidate(codeItems) {
  for (let i = 0; i + 5 < codeItems.length; i += 1) {
    if (intLoadLocalBulk(itemInsn(codeItems, i)) !== 3) continue;
    if (!isBipushBulk(itemInsn(codeItems, i + 1), -11)) continue;
    if (instructionOp(itemInsn(codeItems, i + 2)) !== 'if_icmpeq') continue;
    if (refLoadLocalBulk(itemInsn(codeItems, i + 3)) !== 0) continue;
    if (instructionOp(itemInsn(codeItems, i + 4)) !== 'aconst_null') continue;
    if (instructionOp(itemInsn(codeItems, i + 5)) === 'checkcast') return true;
  }
  return false;
}

function hasUcaLikeSharedLoopIncrementCandidate(codeItems) {
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const inc = readIincBulk(itemInsn(codeItems, i));
    if (!inc || inc.incr !== 1) continue;
    const jump = itemInsn(codeItems, i + 1);
    if (instructionOp(jump) !== 'goto') continue;
    const header = findLabelIndex(codeItems, instructionArg(jump));
    if (header >= 0 && header < i && intLoadLocalBulk(itemInsn(codeItems, header)) === inc.local) return true;
  }
  return false;
}


function hasSharedRenderContinuationCandidateBulk(codeItems) {
  for (let i = 0; i + 11 < codeItems.length; i += 1) {
    if (refLoadLocalBulk(itemInsn(codeItems, i)) == null) continue;
    if (instructionOp(itemInsn(codeItems, i + 1)) !== 'ifnull') continue;
    const flagLocal = intLoadLocalBulk(itemInsn(codeItems, i + 2));
    if (flagLocal == null || instructionOp(itemInsn(codeItems, i + 3)) !== 'ifeq') continue;
    const zeroTail = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i + 3)));
    if (zeroTail <= i) continue;
    if (!isGetStaticDescriptorBulk(itemInsn(codeItems, i + 4), 'Z')) continue;
    if (instructionOp(itemInsn(codeItems, i + 5)) !== 'ifne') continue;
    if (instructionOp(itemInsn(codeItems, i + 6)) !== 'bipush') continue;
    if (!isInvokeDescriptorBulk(itemInsn(codeItems, i + 7), '(B)V')) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i + 8)) !== flagLocal) continue;
    if (instructionOp(itemInsn(codeItems, i + 9)) !== 'ifne') continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i + 10)) == null) continue;
    if (instructionOp(itemInsn(codeItems, i + 11)) !== 'ifne') continue;
    if (findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i + 11))) !== zeroTail) continue;
    return true;
  }
  return false;
}

function hasBucketArrayInitCandidate(codeItems) {
  for (let i = 0; i + 7 < codeItems.length; i += 1) {
    if (refLoadLocalBulk(itemInsn(codeItems, i)) !== 0) continue;
    if (!isGetFieldDescriptorBulk(itemInsn(codeItems, i + 1), '[[I')) continue;
    if (instructionOp(itemInsn(codeItems, i + 6)) !== 'newarray') continue;
    if (instructionOp(itemInsn(codeItems, i + 7)) === 'aastore') return true;
  }
  return false;
}

function hasIteratorAdvanceTailCandidate(codeItems) {
  for (let i = 0; i + 5 < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'aload') continue;
    if (!isInvokeInstruction(itemInsn(codeItems, i + 2))) continue;
    if (instructionOp(itemInsn(codeItems, i + 3)) !== 'checkcast') continue;
    if (refStoreLocalBulk(itemInsn(codeItems, i + 4)) != null && instructionOp(itemInsn(codeItems, i + 5)) === 'goto') return true;
  }
  return false;
}

function hasMessageExitTailCandidate(codeItems) {
  for (let i = 1; i + 4 < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'goto') continue;
    const target = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i)));
    if (target > i && isGetStaticDescriptorBulk(itemInsn(codeItems, target), 'J')) return true;
  }
  return false;
}

function hasSharedBooleanLoopTailCandidate(codeItems) {
  for (let i = 0; i + 5 < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'dup') continue;
    if (!isGetFieldDescriptorBulk(itemInsn(codeItems, i + 1), 'Z')) continue;
    if (instructionOp(itemInsn(codeItems, i + 2)) === 'iconst_m1' && instructionOp(itemInsn(codeItems, i + 3)) === 'ixor') return true;
  }
  return false;
}

function hasVectorFinalLoopCandidate(codeItems) {
  for (let i = 0; i + 2 < codeItems.length; i += 1) {
    if (!isGetStaticDescriptorBulk(itemInsn(codeItems, i), 'Ljava/util/Vector;')) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i + 1)) == null) continue;
    if (isInvokeDescriptorBulk(itemInsn(codeItems, i + 2), '(I)Ljava/lang/Object;')) return true;
  }
  return false;
}


function hasArrayMembershipOuterContinueCandidate(codeItems) {
  for (let i = 0; i + 18 < codeItems.length; i += 1) {
    if (refLoadLocalBulk(itemInsn(codeItems, i)) == null) continue;
    const indexLocal = intLoadLocalBulk(itemInsn(codeItems, i + 1));
    if (indexLocal == null) continue;
    if (instructionOp(itemInsn(codeItems, i + 2)) !== 'aaload') continue;
    const elementLocal = refStoreLocalBulk(itemInsn(codeItems, i + 3));
    if (elementLocal == null) continue;
    if (refLoadLocalBulk(itemInsn(codeItems, i + 4)) !== elementLocal) continue;
    if (instructionOp(itemInsn(codeItems, i + 5)) !== 'iconst_0') continue;
    if (instructionOp(itemInsn(codeItems, i + 6)) !== 'iaload') continue;
    const valueLocal = intLoadLocalBulk(itemInsn(codeItems, i + 7));
    if (valueLocal == null) continue;
    if (instructionOp(itemInsn(codeItems, i + 8)) !== 'if_icmpgt') continue;
    const increment = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i + 8)));
    if (increment <= i + 13) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i + 9)) !== valueLocal) continue;
    if (refLoadLocalBulk(itemInsn(codeItems, i + 10)) !== elementLocal) continue;
    if (instructionOp(itemInsn(codeItems, i + 11)) !== 'iconst_1') continue;
    if (instructionOp(itemInsn(codeItems, i + 12)) !== 'iaload') continue;
    if (instructionOp(itemInsn(codeItems, i + 13)) !== 'if_icmpgt') continue;
    if (findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i + 13))) !== increment) continue;
    if (instructionOp(itemInsn(codeItems, i + 14)) !== 'goto') continue;
    const outer = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i + 14)));
    if (outer >= 0 && outer < i) return true;
  }
  return false;
}


function hasDuplicateArrayLoopHeaderAliasCandidateBulk(codeItems) {
  for (let header = 0; header + 24 < codeItems.length; header += 1) {
    const first = readArrayBitsetLoopHeaderShapeBulk(codeItems, header);
    if (!first || first.hasElementAlias) continue;
    const sharedHeader = findLabelIndex(codeItems, first.continueTargetLabel);
    if (sharedHeader <= header || sharedHeader - header > 520) continue;
    const second = readArrayBitsetLoopHeaderShapeBulk(codeItems, sharedHeader);
    if (!second || !second.hasElementAlias) continue;
    if (second.indexLocal !== first.indexLocal) continue;
    if (trimLabel(second.exitLabel) !== trimLabel(first.exitLabel)) continue;
    if (trimLabel(second.continueTargetLabel) !== trimLabel(codeItems[sharedHeader] && codeItems[sharedHeader].labelDef)) continue;
    if (first.arrayLocal === second.arrayLocal) continue;
    if (!hasBoundedWeightedChoiceAfterHeaderBulk(codeItems, second.bodyTarget, second.indexLocal, 560)) continue;
    return true;
  }
  return false;
}

function readArrayBitsetLoopHeaderShapeBulk(codeItems, start) {
  const arrayLocal = refLoadLocalBulk(itemInsn(codeItems, start));
  if (arrayLocal == null) return null;
  if (instructionOp(itemInsn(codeItems, start + 1)) !== 'arraylength') return null;
  const indexLocal = intLoadLocalBulk(itemInsn(codeItems, start + 2));
  if (indexLocal == null) return null;
  const exitBranch = itemInsn(codeItems, start + 3);
  if (!String(instructionOp(exitBranch) || '').startsWith('if')) return null;
  const exitLabel = trimLabel(instructionArg(exitBranch));
  if (!exitLabel) return null;
  if (refLoadLocalBulk(itemInsn(codeItems, start + 4)) !== arrayLocal) return null;
  if (intLoadLocalBulk(itemInsn(codeItems, start + 5)) !== indexLocal) return null;
  if (instructionOp(itemInsn(codeItems, start + 6)) !== 'aaload') return null;
  const elementLocal = refStoreLocalBulk(itemInsn(codeItems, start + 7));
  if (elementLocal == null) return null;
  let p = start + 8;
  let aliasLocal = null;
  let hasElementAlias = false;
  if (refLoadLocalBulk(itemInsn(codeItems, p)) === elementLocal) {
    aliasLocal = refStoreLocalBulk(itemInsn(codeItems, p + 1));
    if (aliasLocal != null) {
      hasElementAlias = true;
      p += 2;
    }
  }
  if (instructionOp(itemInsn(codeItems, p)) !== 'iconst_1') return null;
  const valueLocal = refLoadLocalBulk(itemInsn(codeItems, p + 1));
  if (valueLocal !== elementLocal && valueLocal !== aliasLocal) return null;
  if (instructionOp(itemInsn(codeItems, p + 2)) !== 'checkcast') return null;
  if (!isGetFieldDescriptorBulk(itemInsn(codeItems, p + 3), 'I')) return null;
  if (instructionOp(itemInsn(codeItems, p + 4)) !== 'ishl') return null;
  if (refLoadLocalBulk(itemInsn(codeItems, p + 5)) == null) return null;
  if (!isGetFieldDescriptorBulk(itemInsn(codeItems, p + 6), 'I')) return null;
  if (instructionOp(itemInsn(codeItems, p + 7)) !== 'iand') return null;
  if (instructionOp(itemInsn(codeItems, p + 8)) !== 'iconst_m1') return null;
  if (instructionOp(itemInsn(codeItems, p + 9)) !== 'ixor') return null;
  if (instructionOp(itemInsn(codeItems, p + 10)) !== 'iconst_m1') return null;
  const bodyBranch = itemInsn(codeItems, p + 11);
  if (instructionOp(bodyBranch) !== 'if_icmpeq') return null;
  const bodyTarget = findLabelIndex(codeItems, instructionArg(bodyBranch));
  if (bodyTarget <= start) return null;
  const inc = readIincBulk(itemInsn(codeItems, p + 12));
  if (!inc || inc.local !== indexLocal || inc.incr !== 1) return null;
  const jump = itemInsn(codeItems, p + 13);
  if (instructionOp(jump) !== 'goto') return null;
  const continueTargetLabel = trimLabel(instructionArg(jump));
  if (!continueTargetLabel) return null;
  return { arrayLocal, indexLocal, hasElementAlias, exitLabel, bodyTarget, continueTargetLabel };
}

function hasBoundedWeightedChoiceAfterHeaderBulk(codeItems, start, indexLocal, maxDistance) {
  const end = Math.min(codeItems.length, Math.max(0, start) + maxDistance);
  let sawSeed = false;
  let sawChoice = false;
  let sawFourBound = false;
  let sawBackedge = false;
  for (let i = Math.max(0, start); i < end; i += 1) {
    if (isInvokeDescriptorBulk(itemInsn(codeItems, i), '(J)V')) sawSeed = true;
    if (isInvokeDescriptorBulk(itemInsn(codeItems, i), '(BILjava/util/Random;)I')) sawChoice = true;
    if ((instructionOp(itemInsn(codeItems, i)) === 'iconst_4' || isBipushBulk(itemInsn(codeItems, i), 4)) &&
      intLoadLocalBulk(itemInsn(codeItems, i + 1)) != null &&
      String(instructionOp(itemInsn(codeItems, i + 2)) || '').startsWith('if')) sawFourBound = true;
    const inc = readIincBulk(itemInsn(codeItems, i));
    if (inc && inc.local === indexLocal && inc.incr === 1 && instructionOp(itemInsn(codeItems, i + 1)) === 'goto') sawBackedge = true;
  }
  return sawSeed && sawChoice && sawFourBound && sawBackedge;
}

function hasEventDrainQueueCandidate(codeItems) {
  let boolStatics = 0;
  let queueShape = false;
  for (let i = 0; i < codeItems.length; i += 1) {
    if (isGetStaticDescriptorBulk(itemInsn(codeItems, i), 'Z')) boolStatics += 1;
    if (refLoadLocalBulk(itemInsn(codeItems, i)) === 0 &&
      isGetFieldReferenceBulk(itemInsn(codeItems, i + 1)) &&
      isGetFieldDescriptorBulk(itemInsn(codeItems, i + 2), '[I') &&
      refLoadLocalBulk(itemInsn(codeItems, i + 3)) === 0 &&
      isGetFieldDescriptorBulk(itemInsn(codeItems, i + 4), 'I') &&
      instructionOp(itemInsn(codeItems, i + 5)) === 'iaload') queueShape = true;
  }
  return boolStatics > 0 && queueShape;
}


function hasNestedArrayScanOuterContinueCandidate(codeItems) {
  for (let i = 1; i + 1 < codeItems.length; i += 1) {
    const inc = readIincBulk(itemInsn(codeItems, i));
    if (!inc || inc.incr !== 1) continue;
    if (instructionOp(itemInsn(codeItems, i + 1)) !== 'goto') continue;
    const header = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i + 1)));
    if (header < 0 || header >= i) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, header)) !== inc.local) continue;
    const label = trimLabel(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    let conditionalRefs = 0;
    for (let r = Math.max(header + 1, i - 120); r < i; r += 1) {
      const insn = itemInsn(codeItems, r);
      if (!String(instructionOp(insn) || '').startsWith('if')) continue;
      if (trimLabel(instructionArg(insn)) === label) conditionalRefs += 1;
    }
    if (conditionalRefs >= 1) return true;
  }
  return false;
}

function hasSharedTooltipRenderTailCandidate(codeItems) {
  for (let i = 0; i + 14 < codeItems.length; i += 1) {
    if (!isBipushBulk(itemInsn(codeItems, i), 10)) continue;
    if (!isGetStaticDescriptorBulk(itemInsn(codeItems, i + 1), 'I')) continue;
    if (instructionOp(itemInsn(codeItems, i + 2)) !== 'iadd') continue;
    const xLocal = intStoreLocalBulk(itemInsn(codeItems, i + 3));
    if (xLocal == null) continue;
    if (!isGetStaticDescriptorBulk(itemInsn(codeItems, i + 4), 'I')) continue;
    if (!isBipushBulk(itemInsn(codeItems, i + 5), -30) && !isBipushBulk(itemInsn(codeItems, i + 5), 30)) continue;
    if (instructionOp(itemInsn(codeItems, i + 6)) !== 'isub') continue;
    const yLocal = intStoreLocalBulk(itemInsn(codeItems, i + 7));
    if (yLocal == null) continue;
    if (instructionOp(itemInsn(codeItems, i + 8)) !== 'getstatic') continue;
    if (refLoadLocalBulk(itemInsn(codeItems, i + 9)) == null) continue;
    if (!isInvokeDescriptorBulk(itemInsn(codeItems, i + 10), '(Ljava/lang/String;)I')) continue;
    const widthLocal = intStoreLocalBulk(itemInsn(codeItems, i + 11));
    if (widthLocal == null) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i + 12)) == null) continue;
    const branch = itemInsn(codeItems, i + 13);
    if (!branch || instructionOp(branch) !== 'ifeq') continue;
    const target = findLabelIndex(codeItems, instructionArg(branch));
    if (target <= i + 13 || target - i < 48) continue;
    if (looksLikeTooltipRightEdgeTailBulk(codeItems, target, xLocal, widthLocal)) return true;
  }
  return false;
}

function looksLikeTooltipRightEdgeTailBulk(codeItems, start, xLocal, widthLocal) {
  let p = start;
  if (isGetStaticDescriptorBulk(itemInsn(codeItems, p), 'I')) {
    p += 1;
  } else if (instructionOp(itemInsn(codeItems, p)) === 'getstatic' && isGetFieldDescriptorBulk(itemInsn(codeItems, p + 1), 'I')) {
    p += 2;
  } else {
    return false;
  }
  if (!isBipushBulk(itemInsn(codeItems, p), 20)) return false;
  if (instructionOp(itemInsn(codeItems, p + 1)) !== 'isub') return false;
  if (intLoadLocalBulk(itemInsn(codeItems, p + 2)) !== widthLocal) return false;
  if (intLoadLocalBulk(itemInsn(codeItems, p + 3)) !== xLocal) return false;
  if (instructionOp(itemInsn(codeItems, p + 4)) !== 'ineg') return false;
  if (instructionOp(itemInsn(codeItems, p + 5)) !== 'isub') return false;
  if (instructionOp(itemInsn(codeItems, p + 6)) !== 'if_icmplt') return false;
  return instructionOp(itemInsn(codeItems, p + 7)) === 'goto';
}

function hasBackwardContinueTailCandidate(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    const cur = instructionOp(itemInsn(codeItems, i));
    if (cur !== 'ifnull' && cur !== 'ifeq') continue;
    const target = findLabelIndex(codeItems, instructionArg(itemInsn(codeItems, i)));
    if (target < 0 || target >= i) continue;
    if (intLoadLocalBulk(itemInsn(codeItems, target)) != null &&
      intStoreLocalBulk(itemInsn(codeItems, target + 1)) != null &&
      instructionOp(itemInsn(codeItems, target + 2)) === 'goto') return true;
  }
  return false;
}

function hasUcaLikeMenuContinuationCandidate(codeItems) {
  for (let i = 3; i + 1 < codeItems.length; i += 1) {
    if (instructionOp(itemInsn(codeItems, i)) !== 'ifne') continue;
    if (intLoadLocalBulk(itemInsn(codeItems, i - 1)) === 26 && refLoadLocalBulk(itemInsn(codeItems, i - 2)) === 14) return true;
  }
  return false;
}

function readZeroStoreGotoShapeBulk(codeItems, start) {
  if (start < 0 || start + 2 >= codeItems.length) return null;
  if (instructionOp(itemInsn(codeItems, start)) !== 'iconst_0') return null;
  const local = intStoreLocalBulk(itemInsn(codeItems, start + 1));
  if (local == null || instructionOp(itemInsn(codeItems, start + 2)) !== 'goto') return null;
  return { local };
}

function itemInsn(codeItems, index) {
  return codeItems[index] && codeItems[index].instruction;
}

function intLoadLocalBulk(insn) {
  const cur = instructionOp(insn);
  if (cur === 'iload_0') return 0;
  if (cur === 'iload_1') return 1;
  if (cur === 'iload_2') return 2;
  if (cur === 'iload_3') return 3;
  if (cur === 'iload') return Number(instructionArg(insn));
  return null;
}

function intStoreLocalBulk(insn) {
  const cur = instructionOp(insn);
  if (cur === 'istore_0') return 0;
  if (cur === 'istore_1') return 1;
  if (cur === 'istore_2') return 2;
  if (cur === 'istore_3') return 3;
  if (cur === 'istore') return Number(instructionArg(insn));
  return null;
}

function refLoadLocalBulk(insn) {
  const cur = instructionOp(insn);
  if (cur === 'aload_0') return 0;
  if (cur === 'aload_1') return 1;
  if (cur === 'aload_2') return 2;
  if (cur === 'aload_3') return 3;
  if (cur === 'aload') return Number(instructionArg(insn));
  return null;
}

function refStoreLocalBulk(insn) {
  const cur = instructionOp(insn);
  if (cur === 'astore_0') return 0;
  if (cur === 'astore_1') return 1;
  if (cur === 'astore_2') return 2;
  if (cur === 'astore_3') return 3;
  if (cur === 'astore') return Number(instructionArg(insn));
  return null;
}

function readIincBulk(insn) {
  if (instructionOp(insn) !== 'iinc') return null;
  const arg = instructionArg(insn);
  if (!Array.isArray(arg) || arg.length < 2) return null;
  return { local: Number(arg[0]), incr: Number(arg[1]) };
}

function isBipushBulk(insn, value) {
  return instructionOp(insn) === 'bipush' && Number(instructionArg(insn)) === value;
}

function fieldDescriptorBulk(insn) {
  const arg = instructionArg(insn);
  return Array.isArray(arg) && arg[0] === 'Field' && Array.isArray(arg[2]) ? arg[2][1] : null;
}

function isFieldDescriptorBulk(insn, opcode, descriptor) {
  return instructionOp(insn) === opcode && fieldDescriptorBulk(insn) === descriptor;
}

function isGetFieldDescriptorBulk(insn, descriptor) {
  return isFieldDescriptorBulk(insn, 'getfield', descriptor);
}

function isGetStaticDescriptorBulk(insn, descriptor) {
  return isFieldDescriptorBulk(insn, 'getstatic', descriptor);
}

function isPutStaticDescriptorBulk(insn, descriptor) {
  return isFieldDescriptorBulk(insn, 'putstatic', descriptor);
}

function isGetFieldReferenceBulk(insn) {
  const desc = fieldDescriptorBulk(insn);
  return instructionOp(insn) === 'getfield' && typeof desc === 'string' && (desc.startsWith('L') || desc.startsWith('['));
}

function isGetFieldObjectArrayBulk(insn) {
  const desc = fieldDescriptorBulk(insn);
  return instructionOp(insn) === 'getfield' && typeof desc === 'string' && desc.startsWith('[L');
}

function methodDescriptorBulk(insn) {
  const arg = instructionArg(insn);
  return Array.isArray(arg) && (arg[0] === 'Method' || arg[0] === 'InterfaceMethod') && Array.isArray(arg[2]) ? arg[2][1] : null;
}

function isInvokeDescriptorBulk(insn, descriptor) {
  return isInvokeInstruction(insn) && methodDescriptorBulk(insn) === descriptor;
}

function isInvokeInstruction(insn) {
  const cur = instructionOp(insn);
  return typeof cur === 'string' && cur.startsWith('invoke');
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
  for (const rename of [...FIELD_RENAMES, ...profiles.compileConflictRenames.fields]) {
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
  return expandMethodRenames({ classes }, [...METHOD_RENAMES, ...profiles.compileConflictRenames.methods]);
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
const builtInDeadFlagFields = configuredList('PIPELINE_BUILTIN_DEAD_FLAG_FIELDS', '');
function deadFlagFieldsForClass(classFile) {
  let fields = [
    ...profiles.deadFlagFields,
    ...builtInDeadFlagFields,
    ...autoDeadFlagFields,
  ];
  const skipBuiltInTargets = configuredClassSet('PIPELINE_SKIP_BUILTIN_DEAD_FLAG_CLASSES', '');
  if (skipBuiltInTargets.has(classBasename(classFile))) {
    const builtIns = new Set(builtInDeadFlagFields);
    fields = fields.filter((field) => !builtIns.has(field));
  }
  return fields.join(',');
}
const implicitSuperCtorClasses = collectImplicitSuperCtorClasses();

const passes = [
  { name: 'add-default-constructors-for-implicit-supers', fn: (a) => runAddDefaultConstructorsForImplicitSupers(a, { classesToAdd: implicitSuperCtorClasses }) },
  { name: 'ei-tail-clone', fn: (a) => runEiTailClone(a, { targets: profiles.eiTailClone }) },
  { name: 'peephole', fn: (a, f) => runPeepholeClean(a, safePeepholeOptionsForClass(a, f, {
    ...(runtimeSafe ? { removeRethrowHandlers: false } : {}),
    ...(safeBytecode ? {
      invertConditionalsOverGoto: false,
      invertConditionalsOverGotoClasses: [],
      cloneSharedFallthroughJoins: false,
      cloneSharedFallthroughJoinClasses: [],
      cloneSmallTerminalSharedForwardBlocks: true,
      cloneSmallTerminalSharedForwardBlockMinMethodInsns: 80,
      cloneSmallTerminalSharedForwardBlockMaxLocalIndex: 200,
      cloneConditionalSharedJoins: true,
      cloneSharedPureForwardJoins: true,
      cloneSharedPureForwardJoinMinMethodInsns: 400,
      cloneSharedPureForwardJoinMaxInsns: 6,
      cloneSharedPureForwardJoinMaxRefs: 8,
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
      simplifyNullCompareBranches: true,
      materializeNullableSharedJoinGuards: true,
      removeDeadGotoIslands: true,
      coalesceProtectedLoopProducerBridges: true,
      cloneStackConditionalTargets: true,
      removeUnreachableUntilUsedLabels: true,
      cloneForwardTerminalGotoTails: true,
      cloneForwardTerminalGotoTailMaxInsns: 520,
      cloneForwardTerminalGotoTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
      cloneForwardTerminalGotoTailMaxClones: 6,
      cloneSharedLoopIncrementTails: true,
      cloneSharedLoopIncrementTailMaxInsns: 4,
      cloneSharedLoopIncrementTailMaxRefs: 8,
      cloneSharedSideEffectJoins: true,
      cloneSharedSideEffectJoinMaxInsns: 32,
      cloneSharedSideEffectJoinMaxRefs: 4,
      cloneBoundedTerminalGotoTails: true,
      cloneBoundedTerminalGotoTailMaxInsns: 260,
      cloneBoundedTerminalGotoTailMaxClones: 2,
      cloneLoopValueContinuations: true,
      cloneLoopValueContinuationMaxClones: 4,
      cloneConditionalTerminalTails: true,
      cloneConditionalTerminalTailMaxInsns: 520,
      cloneConditionalTerminalTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
      cloneConditionalTerminalTailMaxClones: 2,
      nullableSharedJoinGuardMinMethodInsns: 80,
      nullableSharedJoinGuardRequireNoExceptions: false,
      nullableSharedJoinGuardMaxLocalIndex: 200,
      stripMonitorWaitExceptionRegions: true,
      cloneConditionalSharedLoopTails: false,
      cloneConditionalSharedLoopTailClasses: [],
    } : {}),
  })) },
  ...(keepRuntimeHandlers || runtimeSafe ? [] : [{
    name: 'runtime-exception-handlers',
    canRun: hasLikelyRuntimeExceptionHandlerCandidates,
    fn: (a) => removeRuntimeExceptionHandlers(a, { keepHandlerCode: true }),
  }]),
  ...(runtimeSafe ? [] : [
    { name: 'remove-shadowed-exception-handlers', fn: (a) => runRemoveShadowedExceptionHandlers(a) },
    { name: 'remove-shadowing-trivial-rethrow-handlers', fn: (a) => runRemoveShadowingTrivialRethrowHandlers(a) },
    { name: 'dekobloko-exception-handler-drops', fn: (a) => runDekoblokoExceptionHandlerDrops(a, profiles.exceptionHandlerDrops) },
    { name: 'strip-rethrow', fn: (a) => removeTrivialRethrowHandlers(a, { keepHandlerCode: true }) },
  ]),
  {
    name: 'normalizer',
    canRun: (astRoot) => hasLikelyLoopNormalizationCandidates(astRoot),
    fn: (a) => runMultiEntryLoopNormalizer(a),
  },
  { name: 'coalesce', fn: (a) => runCoalesceLoopLoad(a) },
  { name: 'dead-flag', fn: (a, f) => runDeadStaticBoolFlag(a, {
    flags: deadFlagFieldsForClass(f),
    rangeLimitedFields: builtInDeadFlagFields,
    allowIntFlags: true,
    preserveBranchShape: safeBytecode,
    preserveBranchShapeMinMethodInsns: 400,
    preserveBranchShapeRequireNoExceptions: true,
    preserveBranchShapeRequireStatic: true,
    preserveBranchShapeMaxLocalIndex: 200,
    preserveBranchShapeRequireArrayParameter: true,
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
  { name: 'poll-loop-return-normalize', fn: (a) => safeBytecode
    ? runPollLoopReturnNormalize(a)
    : { changed: false, rewrites: 0 } },
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
    ? runCastFieldReceiversToOwners(a, { maxCasts: 512 })
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
  { name: 'peephole2', fn: (a, f) => runPeepholeClean(a, safePeepholeOptionsForClass(a, f, {
    ...(runtimeSafe ? { removeRethrowHandlers: false } : {}),
    ...(safeBytecode ? {
      invertConditionalsOverGoto: false,
      invertConditionalsOverGotoClasses: [],
      cloneSharedFallthroughJoins: false,
      cloneSharedFallthroughJoinClasses: [],
      cloneSmallTerminalSharedForwardBlocks: true,
      cloneSmallTerminalSharedForwardBlockMinMethodInsns: 80,
      cloneSmallTerminalSharedForwardBlockMaxLocalIndex: 200,
      cloneConditionalSharedJoins: true,
      cloneSharedPureForwardJoins: true,
      cloneSharedPureForwardJoinMinMethodInsns: 400,
      cloneSharedPureForwardJoinMaxInsns: 6,
      cloneSharedPureForwardJoinMaxRefs: 8,
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
      simplifyNullCompareBranches: true,
      materializeNullableSharedJoinGuards: true,
      removeDeadGotoIslands: true,
      coalesceProtectedLoopProducerBridges: true,
      cloneStackConditionalTargets: true,
      removeUnreachableUntilUsedLabels: true,
      cloneSharedPureForwardJoins: true,
      cloneSharedPureForwardJoinMinMethodInsns: 400,
      cloneSharedPureForwardJoinMaxInsns: 6,
      cloneSharedPureForwardJoinMaxRefs: 8,
      cloneForwardTerminalGotoTails: true,
      cloneForwardTerminalGotoTailMaxInsns: 520,
      cloneForwardTerminalGotoTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
      cloneForwardTerminalGotoTailMaxClones: 6,
      cloneSharedLoopIncrementTails: true,
      cloneSharedLoopIncrementTailMaxInsns: 4,
      cloneSharedLoopIncrementTailMaxRefs: 8,
      cloneSharedSideEffectJoins: true,
      cloneSharedSideEffectJoinMaxInsns: 32,
      cloneSharedSideEffectJoinMaxRefs: 4,
      cloneBoundedTerminalGotoTails: true,
      cloneBoundedTerminalGotoTailMaxInsns: 260,
      cloneBoundedTerminalGotoTailMaxClones: 2,
      cloneLoopValueContinuations: true,
      cloneLoopValueContinuationMaxClones: 4,
      cloneConditionalTerminalTails: true,
      cloneConditionalTerminalTailMaxInsns: 520,
      cloneConditionalTerminalTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
      cloneConditionalTerminalTailMaxClones: 2,
      nullableSharedJoinGuardMinMethodInsns: 80,
      nullableSharedJoinGuardRequireNoExceptions: false,
      nullableSharedJoinGuardMaxLocalIndex: 200,
      stripMonitorWaitExceptionRegions: true,
      cloneConditionalSharedLoopTails: false,
      cloneConditionalSharedLoopTailClasses: [],
    } : {}),
  })) },
  ...(skipControlFlowDce ? [] : [{ name: 'control-flow-dce', fn: (a) => runControlFlowDce(a, {
    ...(safeBytecode ? { requireIsolatedMergeTarget: true, guardStackGotos: true } : {}),
    ...profiles.controlFlowDceOptions,
  }) }]),
  { name: 'qc-doloop-tail-clone', fn: (a) => runQcDoLoopTailClone(a, { targets: profiles.qcDoLoopTailClone }) },
  ...(runtimeSafe ? [] : [{ name: 'compile-conflict-renames', fn: (a) => runCompileConflictRenames(a, { fieldRenames, methodRenames }) }]),
  { name: 'materialize-boolean-invoke-args', fn: (a) => runMaterializeBooleanInvokeArgs(a, { targets: profiles.materializeBooleanInvokeArgs }) },
  { name: 'inline-single-use-boolean-branch2', fn: (a) => runInlineSingleUseBooleanBranch(a) },
  { name: 'retarget-branches', fn: (a) => runRetargetBranches(a, { targets: profiles.retargetBranches }) },
  { name: 'split-concrete-object-reaching-local-late', fn: (a) => runSplitConcreteObjectReachingLocal(a, safeBytecode ? { requireDominance: true, preserveOriginalLocals: true } : {}) },
  { name: 'split-typed-reused-locals-late', fn: (a) => runSplitTypedReusedLocals(a, {
    preserveOriginalLocals: true,
    minMethodItems: 100,
    maxIterations: 2,
  }) },
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
  { name: 'peephole-final', fn: (a, f) => safeBytecode
    ? runPeepholeClean(a, safePeepholeOptionsForClass(a, f, {
      removeRethrowHandlers: false,
      removeDeadGotoIslands: true,
      removeUnreachableUntilUsedLabels: true,
      cloneForwardTerminalGotoTails: true,
      cloneForwardTerminalGotoTailMaxInsns: 520,
      cloneForwardTerminalGotoTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
      cloneForwardTerminalGotoTailMaxClones: 6,
      cloneSharedLoopIncrementTails: true,
      cloneSharedLoopIncrementTailMaxInsns: 4,
      cloneSharedLoopIncrementTailMaxRefs: 8,
      cloneSharedSideEffectJoins: true,
      cloneSharedSideEffectJoinMaxInsns: 32,
      cloneSharedSideEffectJoinMaxRefs: 4,
      cloneBoundedTerminalGotoTails: true,
      cloneBoundedTerminalGotoTailMaxInsns: 260,
      cloneBoundedTerminalGotoTailMaxClones: 2,
      cloneLoopValueContinuations: true,
      cloneLoopValueContinuationMaxClones: 4,
      cloneConditionalTerminalTails: true,
      cloneConditionalTerminalTailMaxInsns: 520,
      cloneConditionalTerminalTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
      cloneConditionalTerminalTailMaxClones: 2,
    }))
    : { changed: false, rewrites: 0 } },
];

let processed = 0;
let failed = 0;
let copied = 0;
for (const f of files) {
  if (processFileSet.has(f)) continue;
  const inPath = path.join(inDir, f);
  const outPath = path.join(outDir, f);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.copyFileSync(inPath, outPath);
  copied += 1;
}
for (const f of processFiles) {
  const inPath = path.join(inDir, f);
  const outPath = path.join(outDir, f);
  try {
    let { ast, cp } = loadAst(inPath);
    for (const p of passes) {
      if (skipPassNames.has(p.name) || shouldSkipPassForAst(p.name, ast, f)) continue;
      if (!shouldRunPass(p, ast, f)) continue;
      try {
        const passStart = Date.now();
        const result = p.fn(ast, f);
        tracePassTime(f, p.name, passStart);
        if (passChanged(result)) {
          const saveStart = Date.now();
          ({ ast, cp } = saveAndReload(ast, cp));
          tracePassTime(f, `${p.name}:save`, saveStart);
        }
      } catch (err) {
        err.pipelinePass = p.name;
        throw err;
      }
    }
    const inlineStart = Date.now();
    const inlineResult = runInlineSingleUseBooleanBranch(ast);
    tracePassTime(f, 'inline-single-use-boolean-branch-post', inlineStart);
    if (safeBytecode) {
      if (passChanged(inlineResult)) {
        const saveBeforeFinalStart = Date.now();
        ({ ast, cp } = saveAndReload(ast, cp));
        tracePassTime(f, 'post-final:save-before-peephole', saveBeforeFinalStart);
      }
      const peepholePostStart = Date.now();
      const peepholePostResult = runPeepholeClean(ast, safePeepholeOptionsForClass(ast, f, {
        removeRethrowHandlers: false,
        removeDeadGotoIslands: true,
        removeUnreachableUntilUsedLabels: true,
        simplifyNullCompareBranches: true,
        cloneSharedPureForwardJoins: true,
        cloneSharedPureForwardJoinMinMethodInsns: 400,
        cloneSharedPureForwardJoinMaxInsns: 6,
        cloneSharedPureForwardJoinMaxRefs: 8,
        cloneForwardTerminalGotoTails: true,
        cloneForwardTerminalGotoTailMaxInsns: 520,
        cloneForwardTerminalGotoTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
        cloneForwardTerminalGotoTailMaxClones: 6,
        cloneSharedLoopIncrementTails: true,
        cloneSharedLoopIncrementTailMaxInsns: 4,
        cloneSharedLoopIncrementTailMaxRefs: 8,
        cloneSharedSideEffectJoins: true,
        cloneSharedSideEffectJoinMaxInsns: 32,
        cloneSharedSideEffectJoinMaxRefs: 4,
        cloneBoundedTerminalGotoTails: true,
        cloneBoundedTerminalGotoTailMaxInsns: 260,
        cloneBoundedTerminalGotoTailMaxClones: 2,
        cloneLoopValueContinuations: true,
        cloneLoopValueContinuationMaxClones: 4,
        cloneConditionalTerminalTails: true,
        cloneConditionalTerminalTailMaxInsns: 520,
        cloneConditionalTerminalTailMaxMethodInsns: terminalTailCloneMaxMethodInsns,
        cloneConditionalTerminalTailMaxClones: 2,
      }));
      tracePassTime(f, 'post-final:peephole', peepholePostStart);
      if (passChanged(peepholePostResult)) {
        const saveAfterPeepholeStart = Date.now();
        ({ ast, cp } = saveAndReload(ast, cp));
        tracePassTime(f, 'post-final:save-after-peephole', saveAfterPeepholeStart);
      }
      if (!skipPassNames.has('terminal-iterator-extract')) {
        const terminalStart = Date.now();
        const terminalResult = runTerminalIteratorExtract(ast);
        tracePassTime(f, 'post-final:terminal-iterator-extract', terminalStart);
        if (passChanged(terminalResult)) {
          const terminalSaveStart = Date.now();
          ({ ast, cp } = saveAndReload(ast, cp));
          tracePassTime(f, 'post-final:save-after-terminal-iterator-extract', terminalSaveStart);
        }
      }
      if (!skipPassNames.has('terminal-action-extract')) {
        const terminalActionStart = Date.now();
        const terminalActionResult = runTerminalActionExtract(ast);
        tracePassTime(f, 'post-final:terminal-action-extract', terminalActionStart);
        if (terminalActionResult && terminalActionResult.changed) {
          const terminalActionSaveStart = Date.now();
          ({ ast, cp } = saveAndReload(ast, cp));
          tracePassTime(f, 'post-final:save-after-terminal-action-extract', terminalActionSaveStart);
        }
      }
      if (!skipPassNames.has('terminal-cleanup-extract')) {
        const terminalCleanupStart = Date.now();
        const terminalCleanupResult = runTerminalCleanupExtract(ast);
        tracePassTime(f, 'post-final:terminal-cleanup-extract', terminalCleanupStart);
        if (terminalCleanupResult && terminalCleanupResult.changed) {
          const terminalCleanupSaveStart = Date.now();
          ({ ast, cp } = saveAndReload(ast, cp));
          tracePassTime(f, 'post-final:save-after-terminal-cleanup-extract', terminalCleanupSaveStart);
        }
      }
      if (!skipPassNames.has('structured-goto-clone')) {
        withEnvDefaults(structuredGotoDefaultEnvForClass(ast, f), () => {
          const structuredGotoIterations = structuredGotoIterationCount();
          for (let structuredGotoIteration = 0; structuredGotoIteration < structuredGotoIterations; structuredGotoIteration += 1) {
            const structuredGotoStart = Date.now();
            const structuredGotoResult = runStructuredGotoClone(ast);
            tracePassTime(f, `post-final:structured-goto-clone:${structuredGotoIteration}`, structuredGotoStart);
            if (!structuredGotoResult || !structuredGotoResult.changed) break;
            const structuredGotoSaveStart = Date.now();
            ({ ast, cp } = saveAndReload(ast, cp));
            tracePassTime(f, `post-final:save-after-structured-goto-clone:${structuredGotoIteration}`, structuredGotoSaveStart);
          }
        });
      }
      if (process.env.STRUCTURED_GOTO_POST_SPLIT_CONCRETE_OBJECT_LOCALS !== '0') {
        const splitConcreteStart = Date.now();
        const splitConcreteResult = runSplitConcreteObjectReachingLocal(ast, { requireDominance: true, preserveOriginalLocals: true });
        tracePassTime(f, 'post-final:split-concrete-object-reaching-local', splitConcreteStart);
        if (passChanged(splitConcreteResult)) {
          const splitConcreteSaveStart = Date.now();
          ({ ast, cp } = saveAndReload(ast, cp));
          tracePassTime(f, 'post-final:save-after-split-concrete-object-reaching-local', splitConcreteSaveStart);
        }
      }
    }
    if (!safeBytecode && shouldRunNoSafeTargetedPeephole(ast)) {
      const peepholePostStart = Date.now();
      const peepholePostResult = runPeepholeClean(ast, safePeepholeOptions({
        removeRethrowHandlers: false,
        cloneSharedLoopIncrementTails: true,
        cloneSharedLoopIncrementTailMaxInsns: 4,
        cloneSharedLoopIncrementTailMaxRefs: 20,
        invertConditionalsOverGoto: true,
        invertConditionalsOverGotoClasses: [classBasename(f)],
        removeDeadGotoIslands: true,
        removeUnreachableUntilUsedLabels: true,
      }));
      tracePassTime(f, 'post-final:nosafe-targeted-peephole', peepholePostStart);
      if (passChanged(peepholePostResult)) {
        const saveAfterPeepholeStart = Date.now();
        ({ ast, cp } = saveAndReload(ast, cp));
        tracePassTime(f, 'post-final:save-after-nosafe-targeted-peephole', saveAfterPeepholeStart);
      }
    }
    if (!safeBytecode && shouldRunNoSafeStructuredGoto(ast) && !skipPassNames.has('structured-goto-clone')) {
      withEnvDefaults(noSafeStructuredGotoDefaultEnv, () => {
        const structuredGotoIterations = structuredGotoIterationCount();
        for (let structuredGotoIteration = 0; structuredGotoIteration < structuredGotoIterations; structuredGotoIteration += 1) {
          const structuredGotoStart = Date.now();
          const structuredGotoResult = runStructuredGotoClone(ast);
          tracePassTime(f, `post-final:structured-goto-clone:${structuredGotoIteration}`, structuredGotoStart);
          if (!structuredGotoResult || !structuredGotoResult.changed) break;
          const structuredGotoSaveStart = Date.now();
          ({ ast, cp } = saveAndReload(ast, cp));
          tracePassTime(f, `post-final:save-after-structured-goto-clone:${structuredGotoIteration}`, structuredGotoSaveStart);
        }
      });
    }
    raiseMaxStackFloor(ast);
    writeClassAstToClassFile(ast, outPath, cp);
    processed += 1;
  } catch (err) {
    failed += 1;
    if (process.env.BULK_PIPELINE_LOG_FAILURES) {
      const pass = err && err.pipelinePass ? ` pass=${err.pipelinePass}` : '';
      console.error(`Failed ${f}${pass}: ${err && err.stack ? err.stack : err}`);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.copyFileSync(inPath, outPath);
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Done: ${processed}/${processFiles.length} processed, ${failed} failed (passthrough), ${copied} copied`);
