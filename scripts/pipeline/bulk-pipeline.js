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
const { convertJson } = require(path.join(JT, 'src/convert_tree'));
const { writeClassAstToClassFile } = require(path.join(JT, 'src/classAstToClassFile'));
const { runPeepholeClean } = require(path.join(JT, 'src/peepholeClean'));
const { removeTrivialRethrowHandlers } = require(path.join(JT, 'src/removeTrivialRethrowHandlers'));
const { runRemoveShadowingTrivialRethrowHandlers } = require(path.join(JT, 'src/removeShadowingTrivialRethrowHandlers'));
const { runMultiEntryLoopNormalizer } = require(path.join(JT, 'src/multiEntryLoopNormalizer'));
const { runCoalesceLoopLoad } = require(path.join(JT, 'src/coalesceLoopLoad'));
const { runDeadStaticBoolFlag } = require(path.join(JT, 'src/deadStaticBoolFlag'));
const { runConstructorPreSuperCleanup } = require(path.join(JT, 'src/constructorPreSuperCleanup'));
const { runInlineSharedExitGoto } = require(path.join(JT, 'src/inlineSharedExitGoto'));
const { runInlineSharedReturn } = require(path.join(JT, 'src/inlineSharedReturn'));
const { runRemoveShadowedExceptionHandlers } = require(path.join(JT, 'src/removeShadowedExceptionHandlers'));
const { runSimplifyNotCompare } = require(path.join(JT, 'src/simplifyNotCompare'));
const { runNarrowCharArrayStores } = require(path.join(JT, 'src/narrowCharArrayStores'));
const { runNarrowByteArrayStores } = require(path.join(JT, 'src/narrowByteArrayStores'));
const { runCastObjectFieldStores } = require(path.join(JT, 'src/castObjectFieldStores'));
const { runPrimitiveArrayCopyLoops } = require(path.join(JT, 'src/primitiveArrayCopyLoops'));
const { runInlineGotoReturnIsland } = require(path.join(JT, 'src/inlineGotoReturnIsland'));
const { runSplitArrayReachingLocal } = require(path.join(JT, 'src/splitArrayReachingLocal'));

const { runEiTailClone } = require('./eiTailClone');
const { runQcDoLoopTailClone } = require('./qcDoLoopTailClone');
const { runCkClipFlag } = require('./ckClipFlag');
const { runQkExceptionSplit } = require('./qkExceptionSplit');
const { FIELD_RENAMES, runCompileConflictRenames } = require('./compileConflictRenames');
const { runDekoblokoExceptionHandlerDrops } = require('./removeShadowedExceptionHandlers');

const inDir = process.argv[2];
const outDir = process.argv[3];
const skipInline = process.argv.includes('--skip-inline');

if (!inDir || !outDir) {
  console.error('Usage: bulk-pipeline.js <input-class-dir> <output-class-dir> [--skip-inline]');
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(inDir).filter((f) => f.endsWith('.class'));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dekob-bulkpipe-'));
const tmpFile = path.join(tmpDir, 'tmp.class');

function loadAst(filePath) {
  const buf = fs.readFileSync(filePath);
  const parsed = getAST(new Uint8Array(buf));
  return { ast: convertJson(parsed.ast, parsed.constantPool), cp: parsed.constantPool };
}

function saveAndReload(ast, cp) {
  writeClassAstToClassFile(ast, tmpFile, cp);
  return loadAst(tmpFile);
}

function collectClassShadowFieldRenames() {
  const classNames = new Set(files.map((f) => path.basename(f, '.class')));
  const byKey = new Map();
  const parents = new Map();
  for (const rename of FIELD_RENAMES) {
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

const fieldRenames = collectClassShadowFieldRenames();
const deadFlagFields = [
  'jn.u', 'ta.f',
  'client.A', 'fa.n', 'hn.j', 'ii.q', 'jd.Qb', 'la.d',
  'of.c', 'on.d', 'sh.j', 'uh.b', 've.ac', 'wg.f',
].join(',');

const passes = [
  { name: 'ei-tail-clone', fn: (a) => runEiTailClone(a) },
  { name: 'peephole', fn: (a) => runPeepholeClean(a) },
  { name: 'remove-shadowed-exception-handlers', fn: (a) => runRemoveShadowedExceptionHandlers(a) },
  { name: 'remove-shadowing-trivial-rethrow-handlers', fn: (a) => runRemoveShadowingTrivialRethrowHandlers(a) },
  { name: 'dekobloko-exception-handler-drops', fn: (a) => runDekoblokoExceptionHandlerDrops(a) },
  { name: 'strip-rethrow', fn: (a) => removeTrivialRethrowHandlers(a, { keepHandlerCode: true }) },
  { name: 'normalizer', fn: (a) => runMultiEntryLoopNormalizer(a) },
  { name: 'coalesce', fn: (a) => runCoalesceLoopLoad(a) },
  { name: 'dead-flag', fn: (a) => runDeadStaticBoolFlag(a, { flags: deadFlagFields }) },
  { name: 'constructor-pre-super-cleanup', fn: (a) => runConstructorPreSuperCleanup(a, { deleteUnusedSnapshots: true }) },
  { name: 'simplify-not-compare', fn: (a) => runSimplifyNotCompare(a, { charLocalsOnly: true }) },
  { name: 'narrow-char-array-stores', fn: (a) => runNarrowCharArrayStores(a) },
  { name: 'narrow-byte-array-stores', fn: (a) => runNarrowByteArrayStores(a) },
  { name: 'cast-object-field-stores', fn: (a) => runCastObjectFieldStores(a) },
  { name: 'primitive-array-copy-loops', fn: (a) => runPrimitiveArrayCopyLoops(a) },
  { name: 'split-array-reaching-local', fn: (a) => runSplitArrayReachingLocal(a) },
  { name: 'inline-goto-return-island', fn: (a) => runInlineGotoReturnIsland(a) },
  ...(skipInline ? [] : [{ name: 'inline-exit', fn: (a) => runInlineSharedExitGoto(a, { maxBodyInsns: 50 }) }]),
  { name: 'inline-return', fn: (a) => runInlineSharedReturn(a, { oncePerMethod: false }) },
  { name: 'ck-clip-flag', fn: (a) => runCkClipFlag(a) },
  { name: 'qk-exception-split', fn: (a) => runQkExceptionSplit(a) },
  { name: 'remove-shadowing-trivial-rethrow-handlers2', fn: (a) => runRemoveShadowingTrivialRethrowHandlers(a) },
  { name: 'peephole2', fn: (a) => runPeepholeClean(a) },
  { name: 'qc-doloop-tail-clone', fn: (a) => runQcDoLoopTailClone(a) },
  { name: 'compile-conflict-renames', fn: (a) => runCompileConflictRenames(a, { fieldRenames }) },
];

let processed = 0;
let failed = 0;
for (const f of files) {
  const inPath = path.join(inDir, f);
  const outPath = path.join(outDir, f);
  try {
    let { ast, cp } = loadAst(inPath);
    for (const p of passes) {
      p.fn(ast);
      ({ ast, cp } = saveAndReload(ast, cp));
    }
    writeClassAstToClassFile(ast, outPath, cp);
    processed += 1;
  } catch (err) {
    failed += 1;
    fs.copyFileSync(inPath, outPath);
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`Done: ${processed}/${files.length} processed, ${failed} failed (passthrough)`);
