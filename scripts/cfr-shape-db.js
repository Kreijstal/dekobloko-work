#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const DEFAULT_DB = path.join(DEKOB, '.work', 'cfr-shape-db', 'records.jsonl');
const DEFAULT_CLASSES = path.join(DEKOB, '.work', 'games', 'voidhunters', 'classes');
const DEFAULT_STUBS = path.join(DEKOB, 'lib', 'dekobloko-stubs.jar');
const DEFAULT_CFR = path.join(DEKOB, 'lib', 'cfr.jar');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');

function usage() {
  console.error(`Usage:
  node scripts/cfr-shape-db.js ingest --work <work-dir> [--game voidhunters] [--class a,b] [--db <records.jsonl>] [--tag name]
  node scripts/cfr-shape-db.js collect [--classes-dir <dir>] [--game voidhunters] [--class a,b] [--work <dir>] [--db <records.jsonl>] [--tag name]
  node scripts/cfr-shape-db.js summarize [--db <records.jsonl>] [--game voidhunters] [--latest]

Work dirs must have cfr/*.java, logs/*.log, and ideally out/*.class.
collect runs the full pipeline/CFR/Javac once, then ingests failures.`);
}

function main(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    usage();
    process.exit(0);
  }
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));
  if (!cmd || args.help) {
    usage();
    process.exit(cmd ? 0 : 2);
  }
  if (cmd === 'collect') {
    const work = args.work || fs.mkdtempSync(path.join('/tmp', 'cfr-shape-db-'));
    runCollection(work, args);
    ingest(work, args);
    return;
  }
  if (cmd === 'ingest') {
    if (!args.work) {
      usage();
      process.exit(2);
    }
    ingest(args.work, args);
    return;
  }
  if (cmd === 'summarize') {
    summarize(args);
    return;
  }
  usage();
  process.exit(2);
}

function parseArgs(argv) {
  const out = { classes: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--latest') out.latest = true;
    else if (arg === '--work') out.work = argv[++i];
    else if (arg === '--db') out.db = argv[++i];
    else if (arg === '--game') out.game = argv[++i];
    else if (arg === '--tag') out.tag = argv[++i];
    else if (arg === '--classes-dir') out.classesDir = argv[++i];
    else if (arg === '--class' || arg === '--classes') out.classes.push(...splitList(argv[++i]));
    else if (arg.startsWith('--work=')) out.work = arg.slice('--work='.length);
    else if (arg.startsWith('--db=')) out.db = arg.slice('--db='.length);
    else if (arg.startsWith('--game=')) out.game = arg.slice('--game='.length);
    else if (arg.startsWith('--tag=')) out.tag = arg.slice('--tag='.length);
    else if (arg.startsWith('--classes-dir=')) out.classesDir = arg.slice('--classes-dir='.length);
    else if (arg.startsWith('--class=')) out.classes.push(...splitList(arg.slice('--class='.length)));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  out.db = path.resolve(out.db || DEFAULT_DB);
  out.classesDir = path.resolve(out.classesDir || DEFAULT_CLASSES);
  out.work = out.work ? path.resolve(out.work) : out.work;
  out.classes = [...new Set(out.classes.filter(Boolean))].sort();
  return out;
}

function splitList(value) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function runCollection(work, args) {
  const outDir = path.join(work, 'out');
  const cfrDir = path.join(work, 'cfr');
  const logDir = path.join(work, 'logs');
  const javacDir = path.join(work, 'javac');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(cfrDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(javacDir, { recursive: true });

  const pipelineLog = path.join(work, 'pipeline.log');
  const pipeline = spawnSync(process.execPath, [
    path.join(DEKOB, 'scripts', 'pipeline', 'bulk-pipeline.js'),
    args.classesDir,
    outDir,
    '--safe-bytecode',
    '--profile',
    'none',
  ], {
    cwd: DEKOB,
    env: { ...process.env, JAVA_TOOLS_DIR },
    encoding: 'utf8',
  });
  fs.writeFileSync(pipelineLog, `${pipeline.stdout || ''}${pipeline.stderr || ''}`);
  if (pipeline.status !== 0) throw new Error(`Pipeline failed; see ${pipelineLog}`);

  const selectedClassFiles = selectedClasses(args, outDir).map((cls) => path.join(outDir, `${cls}.class`));
  const classFiles = selectedClassFiles.length ? selectedClassFiles : fs.readdirSync(outDir)
    .filter((name) => name.endsWith('.class'))
    .map((name) => path.join(outDir, name));
  const cfr = spawnSync('java', ['-jar', DEFAULT_CFR, ...classFiles, '--outputdir', cfrDir], {
    cwd: DEKOB,
    encoding: 'utf8',
  });
  fs.writeFileSync(path.join(work, 'cfr.log'), `${cfr.stdout || ''}${cfr.stderr || ''}`);
  if (cfr.status !== 0) throw new Error(`CFR failed; see ${path.join(work, 'cfr.log')}`);

  for (const src of fs.readdirSync(cfrDir).filter((name) => name.endsWith('.java')).sort()) {
    const cls = path.basename(src, '.java');
    const out = path.join(javacDir, cls);
    fs.mkdirSync(out, { recursive: true });
    const javac = spawnSync('javac', [
      '-source', '7',
      '-target', '7',
      `-Xbootclasspath/p:${DEFAULT_STUBS}`,
      '-proc:none',
      '-cp', `${outDir}:${DEFAULT_STUBS}`,
      '-sourcepath', '',
      '-d', out,
      path.join(cfrDir, src),
    ], {
      cwd: DEKOB,
      encoding: 'utf8',
    });
    fs.writeFileSync(path.join(logDir, `${cls}.log`), `${javac.stdout || ''}${javac.stderr || ''}`);
  }
}

function selectedClasses(args, outDir) {
  return args.classes.filter((cls) => fs.existsSync(path.join(outDir, `${cls}.class`)));
}

function ingest(work, args) {
  const cfrDir = path.join(work, 'cfr');
  const logDir = path.join(work, 'logs');
  if (!fs.existsSync(cfrDir) || !fs.existsSync(logDir)) {
    throw new Error(`Missing cfr/ or logs/ under ${work}`);
  }
  fs.mkdirSync(path.dirname(args.db), { recursive: true });
  const names = args.classes.length ? args.classes : fs.readdirSync(logDir)
    .filter((name) => name.endsWith('.log'))
    .map((name) => path.basename(name, '.log'))
    .sort();
  const context = buildContext(args, work);
  const records = [];
  for (const cls of names) {
    const sourcePath = path.join(cfrDir, `${cls}.java`);
    const logPath = path.join(logDir, `${cls}.log`);
    if (!fs.existsSync(sourcePath) || !fs.existsSync(logPath)) continue;
    const log = fs.readFileSync(logPath, 'utf8');
    const errors = parseJavacErrors(log);
    if (errors.length === 0) continue;
    const source = fs.readFileSync(sourcePath, 'utf8');
    const sourceLines = source.split(/\r?\n/);
    const enriched = errors.map((err) => ({
      ...err,
      kind: classify(err),
      snippet: snippet(sourceLines, err.line, 3),
    }));
    const classPath = path.join(work, 'out', `${cls}.class`);
    const record = {
      schema: 1,
      id: stableId(context, cls, enriched),
      createdAt: new Date().toISOString(),
      game: args.game || 'voidhunters',
      className: cls,
      tag: args.tag || null,
      workDir: work,
      context,
      status: 'javac-fail',
      errorCount: enriched.length,
      categories: countBy(enriched.map((err) => err.kind)),
      errors: enriched,
      hashes: {
        sourceSha256: sha256Text(source),
        classSha256: fs.existsSync(classPath) ? sha256File(classPath) : null,
      },
      artifacts: {
        cfrSource: sourcePath,
        javacLog: logPath,
        classFile: fs.existsSync(classPath) ? classPath : null,
      },
    };
    records.push(record);
  }
  if (records.length) {
    fs.appendFileSync(args.db, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  }
  console.log(`ingested=${records.length} db=${args.db}`);
  printCategorySummary(records);
}

function buildContext(args, work) {
  return {
    dekoblokoCommit: gitCommit(DEKOB),
    javaToolsCommit: gitCommit(JAVA_TOOLS_DIR),
    cfrJar: DEFAULT_CFR,
    cfrJarSha256: fs.existsSync(DEFAULT_CFR) ? sha256File(DEFAULT_CFR) : null,
    classesDir: args.classesDir,
    javaToolsDir: JAVA_TOOLS_DIR,
    pipelineArgs: ['--safe-bytecode', '--profile', 'none'],
    collectorWorkDir: work,
  };
}

function gitCommit(dir) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function stableId(context, cls, errors) {
  return sha256Text(JSON.stringify({
    dekoblokoCommit: context.dekoblokoCommit,
    javaToolsCommit: context.javaToolsCommit,
    cls,
    errors: errors.map((err) => [err.line, err.kind, err.message, err.sourceLine]),
  })).slice(0, 24);
}

function parseJavacErrors(log) {
  const lines = log.split(/\r?\n/);
  const errors = [];
  for (let i = 0; i < lines.length; i += 1) {
    const header = /^(.+\.java):(\d+): error: (.+)$/.exec(lines[i]);
    if (!header) continue;
    const err = {
      line: Number(header[2]),
      message: header[3],
      sourceLine: lines[i + 1] || '',
      details: [],
    };
    for (let j = i + 2; j < Math.min(lines.length, i + 9); j += 1) {
      if (/^.+\.java:\d+: error: /.test(lines[j])) break;
      if (lines[j].trim()) err.details.push(lines[j]);
    }
    errors.push(err);
  }
  return errors;
}

function classify(err) {
  if (err.message === 'cannot find symbol') {
    const symbol = err.details.find((line) => line.includes('symbol:'));
    if (symbol && symbol.includes('variable')) return 'missing-variable';
    return 'missing-symbol';
  }
  if (/array required, but Object found/.test(err.message)) return 'object-used-as-array';
  if (/array required, but int found/.test(err.message)) return 'int-used-as-array';
  if (/Object cannot be converted to int\[\]/.test(err.message)) return 'object-as-int-array';
  if (/Object cannot be converted to int\[\]\[\]/.test(err.message)) return 'object-as-int-array2';
  if (/boolean cannot be converted to int|incomparable types: boolean and int/.test(err.message)) return 'boolean-int-confusion';
  if (/non-static method .* cannot be referenced from a static context|'void' type not allowed here/.test(err.message)) return 'static-or-void-call';
  if (/call to super must be first statement|call to this must be first statement|constructor .* cannot be applied/.test(err.message)) return 'constructor-shape';
  if (/reference to .* is ambiguous/.test(err.message)) return 'overload-ambiguity';
  if (/might not have been initialized/.test(err.message)) return 'definite-assignment';
  if (/';' expected|illegal start of expression|not a statement|unclosed character literal|illegal parenthesized expression/.test(err.message)) return 'syntax-break';
  if (/incompatible types:/.test(err.message)) return 'incompatible-types';
  return err.message;
}

function snippet(lines, line, radius) {
  const start = Math.max(1, line - radius);
  const end = Math.min(lines.length, line + radius);
  const out = [];
  for (let n = start; n <= end; n += 1) {
    out.push({ line: n, text: lines[n - 1] || '' });
  }
  return out;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] || 0) + 1;
  return out;
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function printCategorySummary(records) {
  const categories = {};
  for (const record of records) {
    for (const [kind, count] of Object.entries(record.categories)) {
      categories[kind] = (categories[kind] || 0) + count;
    }
  }
  for (const [kind, count] of Object.entries(categories).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`${String(count).padStart(5)} ${kind}`);
  }
}

function summarize(args) {
  if (!fs.existsSync(args.db)) {
    console.log(`No database at ${args.db}`);
    return;
  }
  let records = fs.readFileSync(args.db, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (args.game) records = records.filter((record) => record.game === args.game);
  if (args.latest) {
    const byClass = new Map();
    for (const record of records) byClass.set(`${record.game}:${record.className}`, record);
    records = [...byClass.values()];
  }
  console.log(`records=${records.length} db=${args.db}`);
  printCategorySummary(records);
  const classCounts = countBy(records.map((record) => record.className));
  const repeated = Object.entries(classCounts).filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
  if (repeated.length) {
    console.log('\nRepeated classes:');
    for (const [cls, count] of repeated.slice(0, 20)) console.log(`${String(count).padStart(5)} ${cls}`);
  }
}

main(process.argv.slice(2));
