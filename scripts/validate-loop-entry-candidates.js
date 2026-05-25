#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
process.env.NODE_PATH = [path.join(JT, 'node_modules'), process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
Module._initPaths();

const jtRequire = Module.createRequire(path.join(JT, 'package.json'));
const { getAST } = jtRequire('jvm_parser');
const { convertJson } = requireJavaTools('src/parsing/convert_tree', 'src/convert_tree');
const { writeClassAstToClassFile } = requireJavaTools('src/parsing/classAstToClassFile', 'src/classAstToClassFile');
const { runStructuredGotoClone } = require('./pipeline/structuredGotoClone');

const args = parseArgs(process.argv.slice(2));
const records = readJsonl(args.input);
const classes = uniqueClasses(records).slice(0, args.limit);
const results = [];

for (const entry of classes) {
  const baseline = markerCount(entry.classFile);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-entry-validate-'));
  try {
    const outFile = path.join(work, path.basename(entry.classFile));
    let { ast, cp } = loadAst(entry.classFile);
    const passResult = withEnv({
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '1',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    }, () => runStructuredGotoClone(ast));
    if (passChanged(passResult)) {
      raiseMaxStackFloor(ast);
      writeClassAstToClassFile(ast, outFile, cp);
      ({ ast, cp } = loadAst(outFile));
    }
    raiseMaxStackFloor(ast);
    writeClassAstToClassFile(ast, outFile, cp);
    const candidate = markerCount(outFile);
    const result = {
      schema: 1,
      kind: 'cfr-loop-entry-validation',
      game: entry.game,
      className: entry.className,
      classFile: entry.classFile,
      candidates: entry.candidates,
      passResult,
      baseline,
      candidate,
      verdict: verdict(baseline, candidate, passResult),
    };
    results.push(result);
    console.log(`${result.verdict.padEnd(14)} ${entry.game}/${entry.className} candidates=${entry.candidates} ${baseline.markers}/${baseline.bad ? 'bad' : 'ok'} -> ${candidate.markers}/${candidate.bad ? 'bad' : 'ok'} rewrites=${Number(passResult && passResult.rewrites || 0)}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, `${results.map((row) => JSON.stringify(row)).join('\n')}${results.length ? '\n' : ''}`);

const counts = countBy(results.map((row) => row.verdict));
console.log(`validated=${results.length} out=${args.output}`);
for (const [name, count] of Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`${String(count).padStart(5)} ${name}`);
}
if (counts.regressed || counts['new-bad']) process.exit(1);

function parseArgs(argv) {
  const out = {
    input: path.join(DEKOB, '.work', 'cfr-goto-topology', 'loop-entry-candidates.jsonl'),
    output: path.join(DEKOB, '.work', 'cfr-goto-topology', 'loop-entry-validation.jsonl'),
    limit: Infinity,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--in') out.input = argv[++i];
    else if (arg === '--out') out.output = argv[++i];
    else if (arg === '--limit') out.limit = Number(argv[++i]);
    else if (arg.startsWith('--in=')) out.input = arg.slice('--in='.length);
    else if (arg.startsWith('--out=')) out.output = arg.slice('--out='.length);
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice('--limit='.length));
    else throw new Error(`unknown argument: ${arg}`);
  }
  out.input = path.resolve(out.input);
  out.output = path.resolve(out.output);
  if (!Number.isFinite(out.limit) || out.limit <= 0) out.limit = Infinity;
  return out;
}

function requireJavaTools(...relPaths) {
  for (const rel of relPaths) {
    try {
      return require(require.resolve(path.join(JT, rel)));
    } catch (err) {
      if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error(`Unable to load java-tools module: ${relPaths.join(', ')}`);
}

function readJsonl(file) {
  if (!fs.existsSync(file)) throw new Error(`missing input: ${file}`);
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function uniqueClasses(rows) {
  const byClass = new Map();
  for (const row of rows) {
    const key = row.classFile;
    const current = byClass.get(key);
    if (current) {
      current.candidates += 1;
      current.score = Math.max(current.score, row.score || 0);
    } else {
      byClass.set(key, { ...row, candidates: 1, score: row.score || 0 });
    }
  }
  return [...byClass.values()].sort((a, b) =>
    b.score - a.score ||
    String(a.game).localeCompare(String(b.game)) ||
    String(a.className).localeCompare(String(b.className)));
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

function markerCount(filePath) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'cfr-marker-count.js'), filePath], {
    cwd: DEKOB,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`cfr-marker-count failed for ${filePath}:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
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

function passChanged(result) {
  if (!result || typeof result !== 'object') return true;
  if (Object.prototype.hasOwnProperty.call(result, 'changed')) return !!result.changed;
  if (Object.prototype.hasOwnProperty.call(result, 'rewrites')) return Number(result.rewrites) > 0;
  if (Object.prototype.hasOwnProperty.call(result, 'changes')) return Number(result.changes) > 0;
  return true;
}

function verdict(baseline, candidate, passResult) {
  if (!passChanged(passResult)) return 'unchanged';
  if (!baseline.bad && candidate.bad) return 'new-bad';
  if (candidate.markers > baseline.markers) return 'regressed';
  if (baseline.bad && !candidate.bad) return 'fixed-bad';
  if (candidate.markers < baseline.markers) return 'improved';
  return 'neutral';
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] || 0) + 1;
  return out;
}
