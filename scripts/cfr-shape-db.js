#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const { execFileSync, spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const DEFAULT_DB = path.join(DEKOB, '.work', 'cfr-shape-db', 'records.jsonl');
const DEFAULT_CLASSES = path.join(DEKOB, '.work', 'games', 'voidhunters', 'classes');
const DEFAULT_STUBS = path.join(DEKOB, 'lib', 'dekobloko-stubs.jar');
const DEFAULT_CFR = path.join(DEKOB, 'lib', 'cfr.jar');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const DEFAULT_GOTO_DB = path.join(DEKOB, '.work', 'cfr-goto-casebook', 'records.jsonl');

function usage() {
  console.error(`Usage:
  node scripts/cfr-shape-db.js ingest --work <work-dir> [--game voidhunters] [--class a,b] [--db <records.jsonl>] [--tag name]
  node scripts/cfr-shape-db.js collect [--classes-dir <dir>] [--game voidhunters] [--class a,b] [--work <dir>] [--db <records.jsonl>] [--tag name]
  node scripts/cfr-shape-db.js summarize [--db <records.jsonl>] [--game voidhunters] [--latest]
  node scripts/cfr-shape-db.js clusters --kind missing-variable [--db <records.jsonl>] [--game voidhunters] [--latest] [--limit 20]
  node scripts/cfr-shape-db.js examples --kind missing-variable [--db <records.jsonl>] [--game voidhunters] [--latest] [--limit 20]
  node scripts/cfr-shape-db.js goto-ingest --scan .work/current-goto-scan [--game steelsentinels] [--db <records.jsonl>] [--tag name]
  node scripts/cfr-shape-db.js goto-clusters [--db <records.jsonl>] [--game steelsentinels] [--type goto] [--latest] [--limit 20]
  node scripts/cfr-shape-db.js goto-examples [--db <records.jsonl>] [--game steelsentinels] [--type goto] [--latest] [--limit 20]
  node scripts/cfr-shape-db.js bytecode-windows --class-file .work/current-goto-scan/steelsentinels/out/se.class [--limit 20]

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
  if (cmd === 'clusters') {
    clusters(args);
    return;
  }
  if (cmd === 'examples') {
    examples(args);
    return;
  }
  if (cmd === 'goto-ingest') {
    gotoIngest(args);
    return;
  }
  if (cmd === 'goto-clusters') {
    gotoClusters(args);
    return;
  }
  if (cmd === 'goto-examples') {
    gotoExamples(args);
    return;
  }
  if (cmd === 'bytecode-windows') {
    bytecodeWindows(args);
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
    else if (arg === '--scan') out.scan = argv[++i];
    else if (arg === '--kind') out.kind = argv[++i];
    else if (arg === '--type') out.type = argv[++i];
    else if (arg === '--limit') out.limit = Number(argv[++i]);
    else if (arg === '--classes-dir') out.classesDir = argv[++i];
    else if (arg === '--class-file') out.classFile = argv[++i];
    else if (arg === '--class' || arg === '--classes') out.classes.push(...splitList(argv[++i]));
    else if (arg.startsWith('--work=')) out.work = arg.slice('--work='.length);
    else if (arg.startsWith('--db=')) out.db = arg.slice('--db='.length);
    else if (arg.startsWith('--game=')) out.game = arg.slice('--game='.length);
    else if (arg.startsWith('--tag=')) out.tag = arg.slice('--tag='.length);
    else if (arg.startsWith('--scan=')) out.scan = arg.slice('--scan='.length);
    else if (arg.startsWith('--kind=')) out.kind = arg.slice('--kind='.length);
    else if (arg.startsWith('--type=')) out.type = arg.slice('--type='.length);
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--classes-dir=')) out.classesDir = arg.slice('--classes-dir='.length);
    else if (arg.startsWith('--class-file=')) out.classFile = arg.slice('--class-file='.length);
    else if (arg.startsWith('--class=')) out.classes.push(...splitList(arg.slice('--class='.length)));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  out.db = path.resolve(out.db || DEFAULT_DB);
  if (process.argv[2] && process.argv[2].startsWith('goto-') && !argv.some((arg) => arg === '--db' || arg.startsWith('--db='))) {
    out.db = DEFAULT_GOTO_DB;
  }
  out.classesDir = path.resolve(out.classesDir || DEFAULT_CLASSES);
  out.work = out.work ? path.resolve(out.work) : out.work;
  out.scan = out.scan ? path.resolve(out.scan) : path.join(DEKOB, '.work', 'current-goto-scan');
  out.classes = [...new Set(out.classes.filter(Boolean))].sort();
  out.limit = Number.isFinite(out.limit) && out.limit > 0 ? out.limit : 20;
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
  const records = loadRecords(args);
  console.log(`records=${records.length} db=${args.db}`);
  printCategorySummary(records);
  const classCounts = countBy(records.map((record) => record.className));
  const repeated = Object.entries(classCounts).filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
  if (repeated.length) {
    console.log('\nRepeated classes:');
    for (const [cls, count] of repeated.slice(0, 20)) console.log(`${String(count).padStart(5)} ${cls}`);
  }
}

function clusters(args) {
  const rows = errorRows(loadRecords(args), args.kind);
  const byKey = new Map();
  for (const row of rows) {
    const key = clusterKey(row.error);
    let cluster = byKey.get(key);
    if (!cluster) {
      cluster = { key, rows: [], games: new Set(), classes: new Set() };
      byKey.set(key, cluster);
    }
    cluster.rows.push(row);
    cluster.games.add(row.record.game);
    cluster.classes.add(`${row.record.game}:${row.record.className}`);
  }
  const sorted = [...byKey.values()].sort((a, b) =>
    b.rows.length - a.rows.length || b.games.size - a.games.size || a.key.localeCompare(b.key));
  console.log(`errors=${rows.length} clusters=${sorted.length} kind=${args.kind || 'all'} db=${args.db}`);
  for (const cluster of sorted.slice(0, args.limit)) {
    const sample = cluster.rows[0];
    console.log(`\n${String(cluster.rows.length).padStart(5)} errors ${String(cluster.classes.size).padStart(4)} classes ${String(cluster.games.size).padStart(3)} games`);
    console.log(`  key: ${cluster.key}`);
    console.log(`  sample: ${sample.record.game}/${sample.record.className}:L${sample.error.line} ${sample.error.message}`);
    console.log(`  source: ${sample.error.sourceLine.trim()}`);
    const detail = usefulDetails(sample.error).join(' | ');
    if (detail) console.log(`  detail: ${detail}`);
  }
}

function examples(args) {
  const rows = errorRows(loadRecords(args), args.kind);
  console.log(`errors=${rows.length} kind=${args.kind || 'all'} db=${args.db}`);
  for (const row of rows.slice(0, args.limit)) {
    const err = row.error;
    console.log(`\n${row.record.game}/${row.record.className}:L${err.line} ${err.kind}`);
    console.log(`  ${err.message}`);
    const detail = usefulDetails(err).join(' | ');
    if (detail) console.log(`  ${detail}`);
    for (const line of err.snippet || []) {
      const marker = line.line === err.line ? '>' : ' ';
      console.log(`${marker}${String(line.line).padStart(5)} ${line.text}`);
    }
  }
}

function loadRecords(args) {
  if (!fs.existsSync(args.db)) return [];
  let records = fs.readFileSync(args.db, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (args.game) records = records.filter((record) => record.game === args.game);
  if (args.classes.length) {
    const classes = new Set(args.classes);
    records = records.filter((record) => classes.has(record.className));
  }
  if (args.latest) {
    const byClass = new Map();
    for (const record of records) byClass.set(`${record.game}:${record.className}`, record);
    records = [...byClass.values()];
  }
  return records;
}

function errorRows(records, kind) {
  const rows = [];
  for (const record of records) {
    for (const error of record.errors || []) {
      if (kind && error.kind !== kind && !record.categories[kind]) continue;
      if (kind && error.kind !== kind) continue;
      rows.push({ record, error });
    }
  }
  return rows.sort((a, b) =>
    a.record.game.localeCompare(b.record.game) ||
    a.record.className.localeCompare(b.record.className) ||
    Number(a.error.line || 0) - Number(b.error.line || 0));
}

function clusterKey(error) {
  const kind = error.kind || 'unknown';
  if (kind === 'missing-variable' || kind === 'missing-symbol') {
    return `${kind}:${symbolKind(error)}:${sourceShape(error.sourceLine)}:${detailShape(error)}`;
  }
  if (kind === 'syntax-break') {
    return `${kind}:${error.message}:${sourceShape(error.sourceLine)}`;
  }
  if (kind === 'definite-assignment') {
    return `${kind}:${definiteAssignmentType(error)}:${sourceShape(error.sourceLine)}`;
  }
  if (kind === 'incompatible-types') {
    return `${kind}:${normalizeIncompatibleMessage(error.message)}:${sourceShape(error.sourceLine)}`;
  }
  return `${kind}:${normalizeMessage(error.message)}:${sourceShape(error.sourceLine)}`;
}

function sourceShape(line) {
  return String(line || '')
    .trim()
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/\b\d+\b/g, '#')
    .replace(/\b[A-Za-z_$][\w$]*\b/g, (word) => reservedShapeWords.has(word) ? word : idShape(word))
    .replace(/\s+/g, ' ')
    .slice(0, 220);
}

function idShape(word) {
  if (/^(?:n|i|j|k)\d*$/.test(word)) return 'n';
  if (/^(?:bl|bool)\d*$/.test(word)) return 'bl';
  if (/.*Array\d*$/.test(word)) return 'array';
  if (/.*String.*\d*$/.test(word)) return 'string';
  if (/object\d*$/i.test(word)) return 'object';
  return 'id';
}

const reservedShapeWords = new Set([
  'new', 'return', 'throw', 'if', 'else', 'while', 'for', 'do', 'try', 'catch', 'finally',
  'switch', 'case', 'default', 'break', 'continue', 'this', 'super', 'null', 'true', 'false',
  'int', 'long', 'float', 'double', 'boolean', 'byte', 'char', 'short', 'void', 'Object',
]);

function symbolKind(error) {
  const detail = (error.details || []).find((line) => line.includes('symbol:'));
  if (!detail) return 'unknown';
  const match = /symbol:\s+(class|variable|method|constructor)\s+(.+)$/.exec(detail.trim());
  return match ? match[1] : detail.trim().replace(/\s+/g, ' ');
}

function detailShape(error) {
  return usefulDetails(error)
    .join(' ')
    .replace(/\b[A-Za-z_$][\w$]*\b/g, (word) => reservedShapeWords.has(word) ? word : idShape(word))
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

function usefulDetails(error) {
  return (error.details || [])
    .map((line) => line.trim())
    .filter((line) => /^(symbol:|location:|both method|method .* is not applicable|class file|bad class file)/.test(line));
}

function definiteAssignmentType(error) {
  const match = /^variable\s+([A-Za-z_$][\w$]*)\s+might not have been initialized$/.exec(error.message || '');
  return match ? idShape(match[1]) : normalizeMessage(error.message);
}

function normalizeIncompatibleMessage(message) {
  return String(message || '')
    .replace(/\b[A-Za-z_$][\w$]*\b/g, (word) => reservedShapeWords.has(word) ? word : idShape(word))
    .replace(/\s+/g, ' ');
}

function normalizeMessage(message) {
  return String(message || '')
    .replace(/\b\d+\b/g, '#')
    .replace(/\s+/g, ' ');
}

function gotoIngest(args) {
  if (!fs.existsSync(args.scan)) {
    throw new Error(`Missing GOTO scan directory: ${args.scan}`);
  }
  fs.mkdirSync(path.dirname(args.db), { recursive: true });
  const games = args.game ? [args.game] : fs.readdirSync(args.scan)
    .filter((name) => fs.existsSync(path.join(args.scan, name, 'markers.txt')))
    .sort();
  const records = [];
  for (const game of games) {
    const gameDir = path.join(args.scan, game);
    const markerPath = path.join(gameDir, 'markers.txt');
    if (!fs.existsSync(markerPath)) continue;
    const markerLines = fs.readFileSync(markerPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const factsByClass = new Map();
    for (const line of markerLines) {
      const marker = parseGotoMarkerLine(line, gameDir);
      if (!marker) continue;
      const className = path.basename(marker.sourcePath, '.java');
      let facts = factsByClass.get(className);
      if (!facts) {
        facts = readClassFacts(path.join(gameDir, 'out', `${className}.class`));
        factsByClass.set(className, facts);
      }
      const sourceInfo = readGotoSourceSnippet(marker.sourcePath, marker.line);
      const record = {
        schema: 1,
        kind: 'cfr-goto-marker',
        id: stableGotoId(args, game, className, marker, sourceInfo),
        createdAt: new Date().toISOString(),
        game,
        className,
        tag: args.tag || null,
        marker: {
          type: classifyGotoMarker(marker.text),
          line: marker.line,
          text: marker.text.trim(),
          normalizedShape: gotoSourceShape(marker.text),
          sourceLine: sourceInfo.sourceLine,
          sourceShape: gotoSourceShape(sourceInfo.sourceLine || marker.text),
          nearestMethod: sourceInfo.nearestMethod,
          snippet: sourceInfo.snippet,
        },
        facts,
        artifacts: {
          markerFile: markerPath,
          cfrSource: marker.sourcePath,
          classFile: fs.existsSync(path.join(gameDir, 'out', `${className}.class`))
            ? path.join(gameDir, 'out', `${className}.class`)
            : null,
        },
      };
      records.push(record);
    }
  }
  if (records.length) {
    fs.appendFileSync(args.db, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  }
  console.log(`goto_ingested=${records.length} db=${args.db}`);
  printGotoSummary(records);
}

function parseGotoMarkerLine(line, gameDir) {
  const match = /^(.+\.java):(\d+):(.*)$/.exec(line);
  if (!match) return null;
  const rawPath = match[1];
  const sourcePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(DEKOB, rawPath);
  return {
    sourcePath,
    line: Number(match[2]),
    text: match[3] || '',
    gameDir,
  };
}

function classifyGotoMarker(text) {
  if (/\*\* GOTO/.test(text)) return /lbl-1000/.test(text) ? 'goto-lbl-1000' : 'goto';
  if (/lbl-1000/.test(text)) return 'lbl-1000';
  if (/Unable to fully structure code/.test(text)) return 'unable';
  return 'other';
}

function readGotoSourceSnippet(sourcePath, line) {
  if (!fs.existsSync(sourcePath)) {
    return { sourceLine: '', nearestMethod: null, snippet: [] };
  }
  const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);
  const sourceLine = lines[line - 1] || '';
  const snippetRows = snippet(lines, line, 4);
  let nearestMethod = null;
  for (let i = Math.min(line - 1, lines.length - 1); i >= 0; i -= 1) {
    const text = lines[i];
    const method = parseJavaMethodDeclaration(text);
    if (method) {
      nearestMethod = { line: i + 1, name: method[1], declaration: text.trim().slice(0, 240) };
      break;
    }
  }
  if (!nearestMethod && /Unable to fully structure code/.test(sourceLine)) {
    for (let i = line; i < Math.min(lines.length, line + 32); i += 1) {
      const text = lines[i];
      const method = parseJavaMethodDeclaration(text);
      if (method) {
        nearestMethod = { line: i + 1, name: method[1], declaration: text.trim().slice(0, 240) };
        break;
      }
    }
  }
  return { sourceLine, nearestMethod, snippet: snippetRows };
}

function parseJavaMethodDeclaration(text) {
  const line = String(text || '').trim();
  if (!line || !line.endsWith('{')) return null;
  if (/^(?:if|for|while|switch|catch|do|else|return|throw|new)\b/.test(line)) return null;
  const open = line.indexOf('(');
  const close = line.indexOf(')', open + 1);
  if (open < 0 || close < 0) return null;
  const before = line.slice(0, open).trim();
  if (!before || /[=?:+\-*/%&|^!<>]\s*$/.test(before) || /\bnew\s+[A-Za-z_$][\w$.]*$/.test(before)) return null;
  const name = before.split(/\s+/).pop();
  if (!name || javaControlWords.has(name)) return null;
  if (!/^[A-Za-z_$][\w$]*$|^<init>$|^<clinit>$/.test(name)) return null;
  if (!/\b(?:public|private|protected|static|final|synchronized|native|abstract|strictfp|void|boolean|byte|char|short|int|long|float|double|[A-Za-z_$][\w$<>\[\].?,]*)\b/.test(before)) return null;
  return [line, name];
}

const javaControlWords = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'do', 'else', 'return', 'throw', 'new',
]);

function stableGotoId(args, game, className, marker, sourceInfo) {
  return sha256Text(JSON.stringify({
    game,
    className,
    tag: args.tag || null,
    line: marker.line,
    type: classifyGotoMarker(marker.text),
    shape: gotoSourceShape(sourceInfo.sourceLine || marker.text),
    source: sourceInfo.sourceLine || marker.text,
  })).slice(0, 24);
}

function readClassFacts(classPath) {
  if (!fs.existsSync(classPath)) return { available: false };
  try {
    const { getAST, convertJson } = loadJavaToolsParsers();
    const parsed = getAST(new Uint8Array(fs.readFileSync(classPath)));
    const ast = convertJson(parsed.ast, parsed.constantPool);
    return scoreGotoAst(ast);
  } catch (err) {
    return { available: false, error: err && err.message ? err.message : String(err) };
  }
}

function loadJavaToolsParsers() {
  const jtRequire = Module.createRequire(path.join(JAVA_TOOLS_DIR, 'package.json'));
  return {
    getAST: jtRequire('jvm_parser').getAST,
    convertJson: require(path.join(JAVA_TOOLS_DIR, 'src/parsing/convert_tree')).convertJson,
  };
}

function scoreGotoAst(ast) {
  const out = {
    available: true,
    methods: 0,
    instructions: 0,
    maxMethodInsns: 0,
    switches: 0,
    exceptionHandlers: 0,
    forwardBranches: 0,
    backwardBranches: 0,
    sharedLabels: 0,
    fallthroughSharedLabels: 0,
    maxLabelRefs: 0,
    methodsWithSharedLabels: 0,
    topMethods: [],
  };
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const code = codeOfMethod(item.method);
      if (!code) continue;
      const facts = scoreGotoMethod(item.method, code);
      out.methods += 1;
      out.instructions += facts.instructions;
      out.maxMethodInsns = Math.max(out.maxMethodInsns, facts.instructions);
      out.switches += facts.switches;
      out.exceptionHandlers += facts.exceptionHandlers;
      out.forwardBranches += facts.forwardBranches;
      out.backwardBranches += facts.backwardBranches;
      out.sharedLabels += facts.sharedLabels;
      out.fallthroughSharedLabels += facts.fallthroughSharedLabels;
      out.maxLabelRefs = Math.max(out.maxLabelRefs, facts.maxLabelRefs);
      if (facts.sharedLabels > 0) out.methodsWithSharedLabels += 1;
      out.topMethods.push(facts);
    }
  }
  out.topMethods = out.topMethods
    .sort((a, b) => b.riskScore - a.riskScore || b.instructions - a.instructions)
    .slice(0, 8);
  return out;
}

function codeOfMethod(method) {
  const attr = (method.attributes || []).find((entry) => entry && entry.type === 'code');
  return attr && attr.code && Array.isArray(attr.code.codeItems) ? attr.code : null;
}

function scoreGotoMethod(method, code) {
  const items = code.codeItems || [];
  const labelIndex = buildGotoLabelIndex(items);
  const refs = collectGotoBranchRefs(items);
  let instructions = 0;
  let switches = 0;
  let forwardBranches = 0;
  let backwardBranches = 0;
  let sharedLabels = 0;
  let fallthroughSharedLabels = 0;
  let maxLabelRefs = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || !item.instruction) continue;
    instructions += 1;
    const op = opcodeOf(item.instruction);
    if (op === 'lookupswitch' || op === 'tableswitch') switches += 1;
  }
  for (const [label, incoming] of refs.entries()) {
    const target = labelIndex.get(label);
    if (target == null) continue;
    maxLabelRefs = Math.max(maxLabelRefs, incoming.length);
    if (incoming.length > 1) {
      sharedLabels += 1;
      if (hasFallthroughPredecessor(items, target)) fallthroughSharedLabels += 1;
    }
    for (const idx of incoming) {
      if (idx < target) forwardBranches += 1;
      else if (idx > target) backwardBranches += 1;
    }
  }
  const exceptionHandlers = (code.exceptionTable || []).length;
  const riskScore =
    forwardBranches * 2 +
    backwardBranches * 3 +
    sharedLabels * 8 +
    fallthroughSharedLabels * 15 +
    switches * 20 +
    exceptionHandlers;
  return {
    name: method.name,
    descriptor: method.descriptor,
    instructions,
    switches,
    exceptionHandlers,
    forwardBranches,
    backwardBranches,
    sharedLabels,
    fallthroughSharedLabels,
    maxLabelRefs,
    riskScore,
  };
}

function buildGotoLabelIndex(items) {
  const out = new Map();
  items.forEach((item, idx) => {
    if (item && item.labelDef) out.set(trimGotoLabel(item.labelDef), idx);
  });
  return out;
}

function collectGotoBranchRefs(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const labels = branchLabelsOf(items[i] && items[i].instruction);
    for (const label of labels) {
      const normalized = trimGotoLabel(label);
      if (!normalized) continue;
      let refs = out.get(normalized);
      if (!refs) {
        refs = [];
        out.set(normalized, refs);
      }
      refs.push(i);
    }
  }
  return out;
}

function branchLabelsOf(instruction) {
  if (!instruction) return [];
  const op = opcodeOf(instruction);
  const arg = typeof instruction === 'object' ? instruction.arg : null;
  if (op === 'goto' || op === 'goto_w' || /^if/.test(op || '')) {
    return typeof arg === 'string' ? [arg] : [];
  }
  if ((op === 'lookupswitch' || op === 'tableswitch') && arg && typeof arg === 'object') {
    const labels = [];
    for (const value of Object.values(arg)) {
      if (typeof value === 'string') labels.push(value);
      else if (Array.isArray(value)) labels.push(...value.filter((entry) => typeof entry === 'string'));
    }
    return labels;
  }
  return [];
}

function hasFallthroughPredecessor(items, target) {
  for (let i = target - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (!item) continue;
    if (item.labelDef && !item.instruction) continue;
    if (!item.instruction) continue;
    return !isTerminalGotoOpcode(opcodeOf(item.instruction));
  }
  return false;
}

function isTerminalGotoOpcode(op) {
  return op === 'goto' || op === 'goto_w' || op === 'return' || op === 'ireturn' ||
    op === 'lreturn' || op === 'freturn' || op === 'dreturn' || op === 'areturn' || op === 'athrow';
}

function opcodeOf(instruction) {
  return typeof instruction === 'string' ? instruction.trim().split(/\s+/)[0] : instruction && instruction.op;
}

function trimGotoLabel(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : null;
}

function gotoSourceShape(line) {
  return String(line || '')
    .trim()
    .replace(/\*\* GOTO lbl-?\d+/g, '** GOTO lbl#')
    .replace(/\blbl-?\d+\b/g, 'lbl#')
    .replace(/\bvar\d+(?:_\d+)?\b/g, 'var#')
    .replace(/\bv\d+\b/g, 'v#')
    .replace(/\b\d+\b/g, '#')
    .replace(/\b[A-Za-z_$][\w$]*\b/g, (word) => gotoShapeReserved.has(word) ? word : 'id')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

const gotoShapeReserved = new Set([
  'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'return', 'throw', 'new', 'this', 'super', 'null', 'true', 'false', 'int', 'long',
  'float', 'double', 'boolean', 'byte', 'char', 'short', 'void', 'Object', 'String',
  'GOTO', 'Unable', 'to', 'fully', 'structure', 'code',
]);

function printGotoSummary(records) {
  const byType = countBy(records.map((record) => record.marker.type));
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`${String(count).padStart(5)} ${type}`);
  }
  const byClass = countBy(records.map((record) => `${record.game}/${record.className}`));
  const top = Object.entries(byClass).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  if (top.length) {
    console.log('\nTop marker classes:');
    for (const [cls, count] of top) console.log(`${String(count).padStart(5)} ${cls}`);
  }
}

function loadGotoRecords(args) {
  if (!fs.existsSync(args.db)) return [];
  let records = fs.readFileSync(args.db, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.kind === 'cfr-goto-marker');
  if (args.game) records = records.filter((record) => record.game === args.game);
  if (args.type) records = records.filter((record) => record.marker && record.marker.type === args.type);
  if (args.classes.length) {
    const classes = new Set(args.classes);
    records = records.filter((record) => classes.has(record.className));
  }
  if (args.latest) {
    const bySite = new Map();
    for (const record of records) {
      bySite.set(`${record.game}:${record.className}:${record.marker.type}:${record.marker.line}:${record.marker.sourceShape}`, record);
    }
    records = [...bySite.values()];
  }
  return records;
}

function gotoClusters(args) {
  const records = loadGotoRecords(args);
  const clusters = new Map();
  for (const record of records) {
    const key = [
      record.marker.type,
      record.marker.sourceShape,
      topMethodRiskShape(record.facts),
    ].join(' | ');
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { key, records: [], games: new Set(), classes: new Set() };
      clusters.set(key, cluster);
    }
    cluster.records.push(record);
    cluster.games.add(record.game);
    cluster.classes.add(`${record.game}/${record.className}`);
  }
  const sorted = [...clusters.values()].sort((a, b) =>
    b.records.length - a.records.length || b.classes.size - a.classes.size || a.key.localeCompare(b.key));
  console.log(`goto_records=${records.length} clusters=${sorted.length} db=${args.db}`);
  for (const cluster of sorted.slice(0, args.limit)) {
    const sample = cluster.records[0];
    console.log(`\n${String(cluster.records.length).padStart(5)} markers ${String(cluster.classes.size).padStart(4)} classes ${String(cluster.games.size).padStart(3)} games`);
    console.log(`  key: ${cluster.key}`);
    console.log(`  sample: ${sample.game}/${sample.className}:L${sample.marker.line} ${sample.marker.text}`);
    if (sample.marker.nearestMethod) {
      console.log(`  method: ${sample.marker.nearestMethod.declaration}`);
    }
  }
}

function topMethodRiskShape(facts) {
  if (!facts || !facts.available || !facts.topMethods || !facts.topMethods.length) return 'no-bytecode-facts';
  const top = facts.topMethods[0];
  return `risk=${bucket(top.riskScore)} insns=${bucket(top.instructions)} shared=${bucket(top.sharedLabels)} fallthroughShared=${bucket(top.fallthroughSharedLabels)} handlers=${bucket(top.exceptionHandlers)}`;
}

function bucket(value) {
  const n = Number(value || 0);
  if (n === 0) return '0';
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  if (n <= 10) return '6-10';
  if (n <= 25) return '11-25';
  if (n <= 100) return '26-100';
  if (n <= 500) return '101-500';
  return '500+';
}

function gotoExamples(args) {
  const records = loadGotoRecords(args)
    .sort((a, b) => b.marker.type.localeCompare(a.marker.type) ||
      a.game.localeCompare(b.game) ||
      a.className.localeCompare(b.className) ||
      a.marker.line - b.marker.line);
  console.log(`goto_records=${records.length} db=${args.db}`);
  for (const record of records.slice(0, args.limit)) {
    console.log(`\n${record.game}/${record.className}:L${record.marker.line} ${record.marker.type}`);
    console.log(`  ${record.marker.text}`);
    if (record.marker.nearestMethod) console.log(`  method: ${record.marker.nearestMethod.declaration}`);
    for (const line of record.marker.snippet || []) {
      const mark = line.line === record.marker.line ? '>' : ' ';
      console.log(`${mark}${String(line.line).padStart(5)} ${line.text}`);
    }
  }
}

function bytecodeWindows(args) {
  if (!args.classFile) throw new Error('--class-file is required');
  const classPath = path.resolve(args.classFile);
  const facts = readClassFacts(classPath);
  if (!facts.available) throw new Error(`Unable to parse ${classPath}: ${facts.error || 'unknown error'}`);
  const { getAST, convertJson } = loadJavaToolsParsers();
  const parsed = getAST(new Uint8Array(fs.readFileSync(classPath)));
  const ast = convertJson(parsed.ast, parsed.constantPool);
  const rows = [];
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const code = codeOfMethod(item.method);
      if (!code) continue;
      rows.push(...methodBytecodeWindows(item.method, code));
    }
  }
  rows.sort((a, b) => b.score - a.score || b.incoming - a.incoming || b.pc - a.pc);
  console.log(`windows=${rows.length} class=${classPath}`);
  for (const row of rows.slice(0, args.limit)) {
    console.log(`\nscore=${row.score} incoming=${row.incoming} fallthrough=${row.fallthrough ? 1 : 0} pc=${row.pc} label=${row.label}`);
    console.log(`  method: ${row.method}${row.descriptor}`);
    console.log(`  refs: ${row.refs.map((ref) => `${ref.kind}@${ref.pc}`).join(', ')}`);
    for (const line of row.window) console.log(`  ${line}`);
  }
}

function methodBytecodeWindows(method, code) {
  const items = code.codeItems || [];
  const labelIndex = buildGotoLabelIndex(items);
  const refs = collectGotoBranchRefsDetailed(items);
  const rows = [];
  for (const [label, incoming] of refs.entries()) {
    const idx = labelIndex.get(label);
    if (idx == null || incoming.length < 2) continue;
    const fallthrough = hasFallthroughPredecessor(items, idx);
    const score = incoming.length * 10 + (fallthrough ? 25 : 0) + incoming.filter((ref) => ref.idx < idx).length * 4 + incoming.filter((ref) => ref.idx > idx).length * 6;
    rows.push({
      method: method.name,
      descriptor: method.descriptor,
      label,
      pc: pcOf(items[idx]),
      incoming: incoming.length,
      fallthrough,
      refs: incoming.map((ref) => ({ kind: ref.idx < idx ? 'forward' : ref.idx > idx ? 'backward' : 'self', pc: pcOf(items[ref.idx]) })),
      score,
      window: renderCodeWindow(items, Math.max(0, idx - 8), Math.min(items.length, idx + 14), idx),
    });
  }
  return rows;
}

function collectGotoBranchRefsDetailed(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const labels = branchLabelsOf(items[i] && items[i].instruction);
    for (const label of labels) {
      const normalized = trimGotoLabel(label);
      if (!normalized) continue;
      let refs = out.get(normalized);
      if (!refs) {
        refs = [];
        out.set(normalized, refs);
      }
      refs.push({ idx: i });
    }
  }
  return out;
}

function renderCodeWindow(items, start, end, focusIdx) {
  const lines = [];
  for (let i = start; i < end; i += 1) {
    const item = items[i] || {};
    const mark = i === focusIdx ? '>' : ' ';
    const pc = pcOf(item);
    const label = item.labelDef ? `${item.labelDef} ` : '';
    const insn = item.instruction ? instructionText(item.instruction) : '';
    lines.push(`${mark}#${String(i).padStart(5)} pc=${String(pc).padStart(5)} ${label}${insn}`.trimEnd());
  }
  return lines;
}

function instructionText(instruction) {
  if (!instruction) return '';
  if (typeof instruction === 'string') return instruction;
  const op = instruction.op || instruction.opcode || '';
  const arg = instruction.arg == null ? '' : ` ${stringifyInstructionArg(instruction.arg)}`;
  return `${op}${arg}`;
}

function stringifyInstructionArg(arg) {
  return JSON.stringify(arg, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
}

function pcOf(item) {
  return item && typeof item.pc === 'number' ? item.pc : -1;
}

main(process.argv.slice(2));
