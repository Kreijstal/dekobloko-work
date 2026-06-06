#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const DEKOB = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const DEFAULT_DB = path.join(DEKOB, '.work', 'cfr-goto-casebook', 'records.jsonl');
const DEFAULT_SCAN = path.join(DEKOB, '.work', 'games');

function usage() {
  console.error(`usage:
  node scripts/cfr-goto-topology.js collect [--db <records.jsonl>] [--scan .work/games] [--tag <tag>] [--out <jsonl>] [--limit N]
  node scripts/cfr-goto-topology.js clusters [--in <jsonl>] [--limit N]
  node scripts/cfr-goto-topology.js loop-entry-scan [--scan .work/games] [--out <jsonl>] [--limit N]
  node scripts/cfr-goto-topology.js loop-entry-candidates --class-file <file.class> [--method <name>] [--summary] [--limit N]

collect builds method-level bytecode topology records for CFR GOTO markers.
clusters groups those method records by topology features.
loop-entry-scan scans the corpus for accepted strict loop-entry candidates.
loop-entry-candidates reports forward-to-loop-body clone candidates and rejection reasons.`);
}

function main(argv) {
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));
  if (cmd === 'collect') return collect(args);
  if (cmd === 'clusters') return clusters(args);
  if (cmd === 'loop-entry-scan') return loopEntryScan(args);
  if (cmd === 'loop-entry-candidates') return loopEntryCandidates(args);
  usage();
  process.exit(2);
}

function parseArgs(argv) {
  const out = {
    db: DEFAULT_DB,
    scan: DEFAULT_SCAN,
    out: path.join(DEKOB, '.work', 'cfr-goto-topology', 'methods.jsonl'),
    input: path.join(DEKOB, '.work', 'cfr-goto-topology', 'methods.jsonl'),
    limit: 30,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--db') out.db = argv[++i];
    else if (arg === '--class-file') out.classFile = argv[++i];
    else if (arg === '--method') out.method = argv[++i];
    else if (arg === '--summary') out.summary = true;
    else if (arg === '--scan') out.scan = argv[++i];
    else if (arg === '--tag') out.tag = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--in') out.input = argv[++i];
    else if (arg === '--limit') out.limit = Number(argv[++i]);
    else if (arg.startsWith('--db=')) out.db = arg.slice('--db='.length);
    else if (arg.startsWith('--class-file=')) out.classFile = arg.slice('--class-file='.length);
    else if (arg.startsWith('--method=')) out.method = arg.slice('--method='.length);
    else if (arg.startsWith('--scan=')) out.scan = arg.slice('--scan='.length);
    else if (arg.startsWith('--tag=')) out.tag = arg.slice('--tag='.length);
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg.startsWith('--in=')) out.input = arg.slice('--in='.length);
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice('--limit='.length));
    else throw new Error(`unknown argument: ${arg}`);
  }
  out.db = path.resolve(out.db);
  out.scan = path.resolve(out.scan);
  out.out = path.resolve(out.out);
  out.input = path.resolve(out.input);
  if (out.classFile) out.classFile = path.resolve(out.classFile);
  out.limit = Number.isFinite(out.limit) && out.limit > 0 ? out.limit : 30;
  return out;
}

function collect(args) {
  const records = loadMarkerRecords(args);
  const grouped = groupByMethodSite(records);
  const classCache = new Map();
  const out = [];
  for (const site of grouped.values()) {
    const classFile = path.join(args.scan, site.game, 'deob-safe', 'out', `${site.className}.class`);
    const methodFacts = methodFactsForSite(classCache, classFile, site);
    out.push({
      schema: 1,
      kind: 'cfr-goto-method-topology',
      game: site.game,
      className: site.className,
      method: site.method,
      markerCount: site.records.length,
      markerTypes: countBy(site.records.map((record) => record.marker.type)),
      sourceShapes: countBy(site.records.map((record) => record.marker.sourceShape)),
      sampleMarkers: site.records.slice(0, 5).map((record) => ({
        line: record.marker.line,
        type: record.marker.type,
        text: record.marker.text,
      })),
      classFile: fs.existsSync(classFile) ? classFile : null,
      facts: methodFacts,
      clusterKey: clusterKey(methodFacts, site.records),
    });
  }
  out.sort((a, b) => b.markerCount - a.markerCount || a.game.localeCompare(b.game) || a.className.localeCompare(b.className));
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${out.map((record) => JSON.stringify(record)).join('\n')}\n`);
  console.log(`methods=${out.length} markers=${records.length} out=${args.out}`);
  printTop(out.slice(0, args.limit));
}

function loadMarkerRecords(args) {
  if (!fs.existsSync(args.db)) throw new Error(`missing db: ${args.db}`);
  let records = fs.readFileSync(args.db, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.kind === 'cfr-goto-marker');
  if (args.tag) records = records.filter((record) => record.tag === args.tag);
  if (!args.tag) {
    const tags = countBy(records.map((record) => record.tag || ''));
    const best = Object.entries(tags).sort((a, b) => b[1] - a[1] || String(b[0]).localeCompare(String(a[0])))[0];
    if (best) records = records.filter((record) => (record.tag || '') === best[0]);
  }
  return records;
}

function groupByMethodSite(records) {
  const grouped = new Map();
  for (const record of records) {
    const method = record.marker && record.marker.nearestMethod
      ? {
        name: record.marker.nearestMethod.name,
        declaration: record.marker.nearestMethod.declaration,
        sourceLine: record.marker.nearestMethod.line,
      }
      : { name: '<unknown>', declaration: null, sourceLine: null };
    const key = `${record.game}/${record.className}/${method.name}/${method.sourceLine || 0}`;
    let site = grouped.get(key);
    if (!site) {
      site = { game: record.game, className: record.className, method, records: [] };
      grouped.set(key, site);
    }
    site.records.push(record);
  }
  return grouped;
}

function methodFactsForSite(cache, classFile, site) {
  if (!fs.existsSync(classFile)) return { available: false, reason: 'missing-class-file' };
  let methods = cache.get(classFile);
  if (!methods) {
    methods = readMethodFacts(classFile);
    cache.set(classFile, methods);
  }
  if (!methods.available) return methods;
  const wantedName = bytecodeMethodNameForSite(classFile, site);
  const candidates = methods.methods.filter((method) => method.name === wantedName);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return {
      ...candidates.sort((a, b) => b.riskScore - a.riskScore || b.instructions - a.instructions)[0],
      overloadAmbiguous: true,
      overloadCount: candidates.length,
    };
  }
  const fallback = fallbackMethodFacts(methods.methods, site);
  if (fallback) return fallback;
  return { available: false, reason: 'method-not-found', requestedName: site.method.name };
}

function bytecodeMethodNameForSite(classFile, site) {
  const name = site.method && site.method.name;
  if (name && name !== path.basename(classFile, '.class')) return name;
  const declaration = String(site.method && site.method.declaration || '').trim();
  if (declaration.startsWith('static {')) return '<clinit>';
  return '<init>';
}

function fallbackMethodFacts(methods, site) {
  const declaration = site.method && site.method.declaration || '';
  if (site.method && site.method.name === '<unknown>') return null;
  if (looksLikeInvocationSite(declaration)) {
    const scored = methods
      .filter((method) => method.instructions > 0)
      .sort((a, b) => b.riskScore - a.riskScore || b.instructions - a.instructions);
    if (!scored.length) return null;
    return {
      ...scored[0],
      fallbackMatch: true,
      fallbackReason: 'source-nearest-method-was-invocation',
      requestedName: site.method.name,
    };
  }
  return null;
}

function looksLikeInvocationSite(declaration) {
  const line = String(declaration || '').trim();
  if (!line) return false;
  if (line.endsWith('{')) return false;
  return /[=;]\s*$/.test(line) && /\(/.test(line);
}

function readMethodFacts(classFile) {
  try {
    const { getAST, convertJson } = loadJavaToolsParsers();
    const parsed = getAST(new Uint8Array(fs.readFileSync(classFile)));
    const ast = convertJson(parsed.ast, parsed.constantPool);
    const methods = [];
    for (const cls of ast.classes || []) {
      for (const item of cls.items || []) {
        if (!item || item.type !== 'method' || !item.method) continue;
        const code = codeOfMethod(item.method);
        if (!code) continue;
        methods.push(scoreMethod(item.method, code));
      }
    }
    return { available: true, methods };
  } catch (err) {
    return { available: false, reason: err && err.message ? err.message : String(err) };
  }
}

function loadJavaToolsParsers() {
  const jtRequire = Module.createRequire(path.join(JAVA_TOOLS_DIR, 'package.json'));
  return {
    getAST: jtRequire('jvm_parser').getAST,
    convertJson: require(path.join(JAVA_TOOLS_DIR, 'src/parsing/convert_tree')).convertJson,
  };
}

function codeOfMethod(method) {
  const attr = (method.attributes || []).find((entry) => entry && entry.type === 'code');
  return attr && attr.code && Array.isArray(attr.code.codeItems) ? attr.code : null;
}

function scoreMethod(method, code) {
  const items = code.codeItems || [];
  const labelIndex = buildLabelIndex(items);
  const branchRefs = collectBranchRefs(items);
  const cfg = buildCfg(items, labelIndex);
  const sccs = tarjan(cfg.successors);
  const sccFacts = scoreSccs(sccs, cfg.predecessors, items);
  const labelFacts = scoreLabels(items, labelIndex, branchRefs);
  const localFacts = scoreLocals(items);
  const switchCount = items.filter((item) => ['lookupswitch', 'tableswitch'].includes(opcodeOf(item && item.instruction))).length;
  const exceptionHandlers = (code.exceptionTable || []).length;
  const instructions = items.filter((item) => item && item.instruction).length;
  const riskScore =
    labelFacts.sharedLabels * 8 +
    labelFacts.fallthroughSharedLabels * 15 +
    labelFacts.maxIncoming * 4 +
    sccFacts.multiEntryLoops * 30 +
    sccFacts.irreducibleSccs * 40 +
    sccFacts.backedgeEntries * 8 +
    switchCount * 12 +
    exceptionHandlers * 10 +
    localFacts.mixedFamilyLocals * 12;
  return {
    available: true,
    name: method.name,
    descriptor: method.descriptor,
    instructions,
    exceptionHandlers,
    switches: switchCount,
    riskScore,
    ...labelFacts,
    ...sccFacts,
    ...localFacts,
  };
}

function buildCfg(items, labelIndex) {
  const instructionIndexes = items.map((item, idx) => item && item.instruction ? idx : -1).filter((idx) => idx >= 0);
  const instructionSet = new Set(instructionIndexes);
  const successors = new Map();
  const predecessors = new Map();
  for (const idx of instructionIndexes) {
    const succ = successorsOf(items, idx, labelIndex).filter((target) => instructionSet.has(target));
    successors.set(idx, succ);
    for (const target of succ) {
      const incoming = predecessors.get(target) || [];
      incoming.push(idx);
      predecessors.set(target, incoming);
    }
  }
  return { successors, predecessors };
}

function successorsOf(items, idx, labelIndex) {
  const insn = items[idx] && items[idx].instruction;
  const op = opcodeOf(insn);
  const labels = branchLabelsOf(insn)
    .map((label) => labelIndex.get(trimLabel(label)))
    .filter((target) => target != null);
  const next = nextInstructionIndex(items, idx + 1);
  if (op === 'goto' || op === 'goto_w') return labels;
  if (isReturnOrThrow(op)) return [];
  if (op === 'lookupswitch' || op === 'tableswitch') return labels;
  if (/^if/.test(op || '')) return next >= 0 ? [...labels, next] : labels;
  return next >= 0 ? [next] : [];
}

function scoreSccs(sccs, predecessors, items) {
  let loops = 0;
  let multiEntryLoops = 0;
  let irreducibleSccs = 0;
  let maxLoopEntries = 0;
  let backedgeEntries = 0;
  for (const scc of sccs) {
    const members = new Set(scc);
    const hasLoop = scc.length > 1 || scc.some((idx) => (predecessors.get(idx) || []).includes(idx));
    if (!hasLoop) continue;
    loops += 1;
    const entries = [];
    for (const idx of scc) {
      const incomingOutside = (predecessors.get(idx) || []).filter((pred) => !members.has(pred));
      if (incomingOutside.length > 0) entries.push(idx);
      const incomingBack = (predecessors.get(idx) || []).filter((pred) => members.has(pred) && pred > idx);
      if (incomingBack.length > 0) backedgeEntries += 1;
    }
    maxLoopEntries = Math.max(maxLoopEntries, entries.length);
    if (entries.length > 1) {
      multiEntryLoops += 1;
      irreducibleSccs += 1;
    }
  }
  return { loops, multiEntryLoops, irreducibleSccs, maxLoopEntries, backedgeEntries };
}

function scoreLabels(items, labelIndex, refs) {
  let sharedLabels = 0;
  let fallthroughSharedLabels = 0;
  let maxIncoming = 0;
  let forwardBranches = 0;
  let backwardBranches = 0;
  let forwardIntoBackedgeHeader = 0;
  for (const [label, incoming] of refs.entries()) {
    const target = labelIndex.get(label);
    if (target == null) continue;
    maxIncoming = Math.max(maxIncoming, incoming.length);
    if (incoming.length > 1) {
      sharedLabels += 1;
      if (hasFallthroughPredecessor(items, target)) fallthroughSharedLabels += 1;
    }
    const hasBackedge = incoming.some((idx) => idx > target);
    const hasForward = incoming.some((idx) => idx < target);
    if (hasBackedge && hasForward) forwardIntoBackedgeHeader += 1;
    for (const idx of incoming) {
      if (idx < target) forwardBranches += 1;
      else if (idx > target) backwardBranches += 1;
    }
  }
  return {
    sharedLabels,
    fallthroughSharedLabels,
    maxIncoming,
    forwardBranches,
    backwardBranches,
    forwardIntoBackedgeHeader,
  };
}

function scoreLocals(items) {
  const locals = new Map();
  for (const item of items) {
    const insn = item && item.instruction;
    const op = opcodeOf(insn);
    const local = localIndex(insn);
    if (local == null) continue;
    const family = localFamily(op);
    if (!family) continue;
    const facts = locals.get(local) || { families: new Set(), reads: 0, writes: 0 };
    facts.families.add(family);
    if (/store$/.test(op) || op === 'iinc') facts.writes += 1;
    else facts.reads += 1;
    locals.set(local, facts);
  }
  let mixedFamilyLocals = 0;
  let writeOnlyLocals = 0;
  let maxLocalFamilies = 0;
  for (const facts of locals.values()) {
    maxLocalFamilies = Math.max(maxLocalFamilies, facts.families.size);
    if (facts.families.size > 1) mixedFamilyLocals += 1;
    if (facts.writes > 0 && facts.reads === 0) writeOnlyLocals += 1;
  }
  return { locals: locals.size, mixedFamilyLocals, maxLocalFamilies, writeOnlyLocals };
}

function clusters(args) {
  if (!fs.existsSync(args.input)) throw new Error(`missing topology input: ${args.input}`);
  const records = fs.readFileSync(args.input, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const grouped = new Map();
  for (const record of records) {
    const key = record.clusterKey;
    const cluster = grouped.get(key) || { key, records: [], markers: 0, games: new Set(), classes: new Set() };
    cluster.records.push(record);
    cluster.markers += record.markerCount;
    cluster.games.add(record.game);
    cluster.classes.add(`${record.game}/${record.className}`);
    grouped.set(key, cluster);
  }
  const sorted = [...grouped.values()].sort((a, b) => b.markers - a.markers || b.records.length - a.records.length || a.key.localeCompare(b.key));
  console.log(`method_records=${records.length} clusters=${sorted.length} in=${args.input}`);
  for (const cluster of sorted.slice(0, args.limit)) {
    const sample = cluster.records[0];
    console.log(`\n${String(cluster.markers).padStart(5)} markers ${String(cluster.records.length).padStart(4)} methods ${String(cluster.classes.size).padStart(4)} classes ${String(cluster.games.size).padStart(3)} games`);
    console.log(`  key: ${cluster.key}`);
    console.log(`  sample: ${sample.game}/${sample.className}.${sample.method.name} ${sample.method.declaration || ''}`);
    console.log(`  facts: ${factLine(sample.facts)}`);
  }
}

function loopEntryCandidates(args) {
  if (!args.classFile) throw new Error('--class-file is required');
  if (!fs.existsSync(args.classFile)) throw new Error(`missing class file: ${args.classFile}`);
  const { getAST, convertJson } = loadJavaToolsParsers();
  const parsed = getAST(new Uint8Array(fs.readFileSync(args.classFile)));
  const ast = convertJson(parsed.ast, parsed.constantPool);
  const rows = [];
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (args.method && item.method.name !== args.method) continue;
      const code = codeOfMethod(item.method);
      if (!code) continue;
      rows.push(...methodLoopEntryCandidates(item.method, code));
    }
  }
  rows.sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;
    return b.score - a.score || a.method.localeCompare(b.method) || a.sourcePc - b.sourcePc;
  });
  const accepted = rows.filter((row) => row.accepted).length;
  const rejected = rows.length - accepted;
  console.log(`loop_entry_candidates=${rows.length} accepted=${accepted} rejected=${rejected} class=${args.classFile}`);
  if (args.summary) {
    const reasons = countBy(rows.map((row) => row.reason));
    for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      console.log(`${String(count).padStart(5)} ${reason}`);
    }
    return;
  }
  for (const row of rows.slice(0, args.limit)) {
    console.log(`\n${row.accepted ? 'ACCEPT' : 'REJECT'} score=${row.score} reason=${row.reason}`);
    console.log(`  method: ${row.method}${row.descriptor}`);
    console.log(`  source: #${row.sourceIndex} pc=${row.sourcePc} ${row.sourceOp} -> ${row.label} (#${row.targetIndex} pc=${row.targetPc})`);
    console.log(`  target: first=${row.firstOp} refs=${row.incoming} forward=${row.forwardIncoming} backward=${row.backwardIncoming} fallthrough=${row.fallthrough ? 1 : 0}`);
    if (row.tail) console.log(`  tail: end=#${row.tail.end} pc=${row.tail.endPc} op=${row.tail.endOp} loopHeader=#${row.tail.loopHeader} storesOrSideEffects=${row.tail.storesOrSideEffects}`);
    for (const line of row.window) console.log(`  ${line}`);
  }
}

function loopEntryScan(args) {
  const classFiles = findClassFiles(args.scan);
  const { getAST, convertJson } = loadJavaToolsParsers();
  const accepted = [];
  let parsed = 0;
  let failed = 0;
  for (const classFile of classFiles) {
    let ast;
    try {
      const raw = getAST(new Uint8Array(fs.readFileSync(classFile)));
      ast = convertJson(raw.ast, raw.constantPool);
      parsed += 1;
    } catch (err) {
      failed += 1;
      continue;
    }
    const rel = path.relative(args.scan, classFile).split(path.sep);
    const game = rel.length > 2 ? rel[0] : null;
    const className = path.basename(classFile, '.class');
    for (const cls of ast.classes || []) {
      for (const item of cls.items || []) {
        if (!item || item.type !== 'method' || !item.method) continue;
        const code = codeOfMethod(item.method);
        if (!code) continue;
        for (const row of methodLoopEntryCandidates(item.method, code)) {
          if (!row.accepted) continue;
          accepted.push({
            schema: 1,
            kind: 'cfr-loop-entry-candidate',
            game,
            className,
            classFile,
            method: row.method,
            descriptor: row.descriptor,
            reason: row.reason,
            score: row.score,
            sourcePc: row.sourcePc,
            targetPc: row.targetPc,
            label: row.label,
            incoming: row.incoming,
            forwardIncoming: row.forwardIncoming,
            backwardIncoming: row.backwardIncoming,
            fallthrough: row.fallthrough,
            firstOp: row.firstOp,
            tail: row.tail,
          });
        }
      }
    }
  }
  accepted.sort((a, b) =>
    b.score - a.score ||
    String(a.game).localeCompare(String(b.game)) ||
    a.className.localeCompare(b.className) ||
    a.method.localeCompare(b.method) ||
    a.sourcePc - b.sourcePc);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${accepted.map((row) => JSON.stringify(row)).join('\n')}${accepted.length ? '\n' : ''}`);
  console.log(`loop_entry_scan classes=${classFiles.length} parsed=${parsed} failed=${failed} accepted=${accepted.length} out=${args.out}`);
  const reasons = countBy(accepted.map((row) => row.reason));
  for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`${String(count).padStart(5)} ${reason}`);
  }
  for (const row of accepted.slice(0, args.limit)) {
    console.log(`  ${row.game}/${row.className}.${row.method}${row.descriptor} pc=${row.sourcePc}->${row.targetPc} ${row.reason} score=${row.score}`);
  }
}

function findClassFiles(scanDir) {
  const out = [];
  const stack = [scanDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_err) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.class') && path.basename(path.dirname(full)) === 'out') {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function methodLoopEntryCandidates(method, code) {
  const items = code.codeItems || [];
  const labelIndex = buildLabelIndex(items);
  const refs = collectBranchRefsDetailed(items);
  const rows = [];
  for (let source = 0; source < items.length; source += 1) {
    const insn = items[source] && items[source].instruction;
    const sourceOp = opcodeOf(insn);
    if (sourceOp !== 'goto' && !isConditionalBranch(sourceOp)) continue;
    const label = trimLabel(branchLabelsOf(insn)[0]);
    const target = labelIndex.get(label);
    if (target == null || target <= source) continue;
    const row = classifyLoopEntryCandidate(method, items, refs, source, target, label);
    rows.push(row);
  }
  return rows;
}

function classifyLoopEntryCandidate(method, items, refs, source, target, label) {
  const incomingRefs = refs.get(label) || [];
  const firstOp = opcodeOf(items[target] && items[target].instruction);
  const fallthrough = hasFallthroughPredecessor(items, target);
  const forwardIncoming = incomingRefs.filter((ref) => ref.idx < target).length;
  const backwardIncoming = incomingRefs.filter((ref) => ref.idx > target).length;
  const sourceOp = opcodeOf(items[source] && items[source].instruction);
  const reject = (reason, tail = null) => candidateRow(method, items, source, target, label, {
    accepted: false,
    reason,
    tail,
    firstOp,
    fallthrough,
    incomingRefs,
    forwardIncoming,
    backwardIncoming,
    sourceOp,
  });

  if (incomingRefs.length < 2) return reject('label-not-shared');
  if (incomingRefs.length > 4) return reject('too-many-incoming');
  if (forwardIncoming === 0 || backwardIncoming === 0) return reject('not-forward-and-backedge');
  if (isStackConsumingBranch(firstOp)) return reject('target-starts-stack-consuming-branch');
  if (firstOp === 'iinc') return reject('target-starts-update-tail');

  const tail = readLoopBodyEntryTail(items, source, target);
  if (!tail.ok) {
    if (forwardIncoming !== 1 || backwardIncoming !== 1 || !fallthrough) {
      return reject(`${tail.reason};not-single-fallthrough-header-entry`, tail.tail || null);
    }
    const header = readLoopHeaderEntry(method, items, source, target);
    if (!header.ok) return reject(`${tail.reason};${header.reason}`, tail.tail || header.tail || null);
    return candidateRow(method, items, source, target, label, {
      accepted: true,
      reason: 'bounded-local-clean-loop-header-entry',
      tail: header.tail,
      firstOp,
      fallthrough,
      incomingRefs,
      forwardIncoming,
      backwardIncoming,
      sourceOp,
    });
  }
  return candidateRow(method, items, source, target, label, {
    accepted: true,
    reason: 'bounded-local-clean-loop-body-entry',
    tail: tail.tail,
    firstOp,
    fallthrough,
    incomingRefs,
    forwardIncoming,
    backwardIncoming,
    sourceOp,
  });
}

function readLoopHeaderEntry(method, items, source, target) {
  const guard = findFirstConditionalBranch(items, target, target + 14);
  if (guard < 0) return { ok: false, reason: 'no-short-loop-guard' };
  const exitTarget = firstBranchTargetIndex(items, guard);
  if (exitTarget == null || exitTarget <= guard) return { ok: false, reason: 'loop-guard-has-no-forward-exit' };
  const bodyStart = nextInstructionIndex(items, guard + 1);
  if (bodyStart < 0 || bodyStart >= exitTarget) return { ok: false, reason: 'loop-guard-has-empty-body' };
  const update = findBackedgeToTarget(items, bodyStart, Math.min(exitTarget + 3, items.length), target);
  if (update < 0) return { ok: false, reason: 'no-local-backedge-to-header' };
  if (!hasKnownLocalInputsAtSource(items, source, target, update, methodInitialLocals(method))) return { ok: false, reason: 'unknown-local-input-at-source' };
  const branchCount = countBranches(items, target, update);
  if (branchCount > 8) return { ok: false, reason: 'header-range-too-branchy' };
  const externalInternalLabelRefs = countLabelsReferencedFromOutsideRange(items, target + 1, update, target, update, source);
  return {
    ok: true,
    tail: {
      end: update,
      endPc: pcOf(items[update]),
      endOp: opcodeOf(items[update] && items[update].instruction),
      loopHeader: target,
      guard,
      exitTarget,
      storesOrSideEffects: countStoresOrSideEffects(items, bodyStart, update),
      externalInternalLabelRefs,
    },
  };
}

function findFirstConditionalBranch(items, start, end) {
  for (let i = start; i < Math.min(items.length, end); i += 1) {
    if (isConditionalBranch(opcodeOf(items[i] && items[i].instruction))) return i;
  }
  return -1;
}

function firstBranchTargetIndex(items, branchIndex) {
  const label = trimLabel(branchLabelsOf(items[branchIndex] && items[branchIndex].instruction)[0]);
  if (!label) return null;
  return buildLabelIndex(items).get(label);
}

function findBackedgeToTarget(items, start, end, target) {
  const targetLabel = trimLabel(items[target] && items[target].labelDef);
  if (!targetLabel) return -1;
  for (let i = Math.max(start, target + 1); i < Math.min(items.length, end); i += 1) {
    if (trimLabel(branchLabelsOf(items[i] && items[i].instruction)[0]) === targetLabel && i > target) return i;
  }
  return -1;
}

function countBranches(items, start, end) {
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    const cur = opcodeOf(items[i] && items[i].instruction);
    if (cur === 'goto' || isConditionalBranch(cur)) count += 1;
  }
  return count;
}

function countStoresOrSideEffects(items, start, end) {
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    if (isStoreOrSideEffect(opcodeOf(items[i] && items[i].instruction))) count += 1;
  }
  return count;
}

function candidateRow(method, items, source, target, label, facts) {
  const sourcePc = pcOf(items[source]);
  const targetPc = pcOf(items[target]);
  const tailScore = facts.tail && facts.tail.end != null ? Math.max(1, 20 - (facts.tail.end - target)) : 0;
  const score =
    facts.incomingRefs.length * 10 +
    facts.forwardIncoming * 6 +
    facts.backwardIncoming * 8 +
    (facts.fallthrough ? 4 : 0) +
    tailScore;
  return {
    method: method.name,
    descriptor: method.descriptor,
    accepted: facts.accepted,
    reason: facts.reason,
    score,
    label,
    sourceIndex: source,
    sourcePc,
    sourceOp: facts.sourceOp,
    targetIndex: target,
    targetPc,
    firstOp: facts.firstOp,
    incoming: facts.incomingRefs.length,
    forwardIncoming: facts.forwardIncoming,
    backwardIncoming: facts.backwardIncoming,
    fallthrough: facts.fallthrough,
    tail: facts.tail,
    window: renderCodeWindow(items, Math.max(0, Math.min(source, target) - 5), Math.min(items.length, Math.max(source, target) + 16), target, source),
  };
}

function readLoopBodyEntryTail(items, source, target) {
  const maxTail = Math.min(items.length, target + 12);
  let storesOrSideEffects = 0;
  for (let i = target; i < maxTail; i += 1) {
    const cur = opcodeOf(items[i] && items[i].instruction);
    if (!cur) continue;
    if (cur === 'goto') {
      const label = trimLabel(items[i].instruction && items[i].instruction.arg);
      const loopHeader = label ? buildLabelIndex(items).get(label) : null;
      const tail = {
        end: i,
        endPc: pcOf(items[i]),
        endOp: cur,
        loopHeader: loopHeader == null ? -1 : loopHeader,
        storesOrSideEffects,
      };
      if (loopHeader == null || loopHeader >= target) return { ok: false, reason: 'tail-goto-not-backedge', tail };
      if (storesOrSideEffects === 0) return { ok: false, reason: 'tail-has-no-materialized-work', tail };
      if (!hasKnownLocalInputsAtSource(items, source, target, i)) return { ok: false, reason: 'unknown-local-input-at-source', tail };
      if (hasLabelsReferencedFromOutsideRange(items, target + 1, i, target, i)) return { ok: false, reason: 'tail-has-externally-referenced-label', tail };
      return { ok: true, tail };
    }
    if (isConditionalBranch(cur)) return { ok: false, reason: 'tail-contains-branch' };
    if (isReturnOrThrow(cur)) return { ok: false, reason: 'tail-contains-terminal' };
    if (isStoreOrSideEffect(cur)) storesOrSideEffects += 1;
  }
  return { ok: false, reason: 'no-short-backedge-tail' };
}

function clusterKey(facts, records) {
  const markerTypes = Object.keys(countBy(records.map((record) => record.marker.type))).sort().join('+');
  if (!facts || !facts.available) return `markers=${markerTypes} | no-bytecode-facts`;
  const shape = [];
  shape.push(`markers=${markerTypes}`);
  shape.push(`insns=${bucket(facts.instructions)}`);
  shape.push(`scc=${facts.irreducibleSccs > 0 ? 'irreducible' : facts.loops > 0 ? 'loops' : 'acyclic'}`);
  shape.push(`entries=${bucket(facts.maxLoopEntries)}`);
  shape.push(`shared=${bucket(facts.sharedLabels)}`);
  shape.push(`fall=${bucket(facts.fallthroughSharedLabels)}`);
  shape.push(`fwdBack=${bucket(facts.forwardIntoBackedgeHeader)}`);
  shape.push(`handlers=${bucket(facts.exceptionHandlers)}`);
  shape.push(`switch=${bucket(facts.switches)}`);
  shape.push(`locals=${facts.mixedFamilyLocals > 0 ? 'mixed' : 'plain'}`);
  return shape.join(' | ');
}

function factLine(facts) {
  if (!facts || !facts.available) return facts ? facts.reason : 'unavailable';
  return `insns=${facts.instructions} loops=${facts.loops} multiEntry=${facts.multiEntryLoops} shared=${facts.sharedLabels} fall=${facts.fallthroughSharedLabels} fwdBack=${facts.forwardIntoBackedgeHeader} handlers=${facts.exceptionHandlers} switches=${facts.switches} mixedLocals=${facts.mixedFamilyLocals}`;
}

function printTop(records) {
  for (const record of records) {
    console.log(`${String(record.markerCount).padStart(4)} ${record.game}/${record.className}.${record.method.name} ${record.clusterKey}`);
  }
}

function tarjan(successors) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowlinks = new Map();
  const components = [];
  for (const node of successors.keys()) {
    if (!indexes.has(node)) strongConnect(node);
  }
  return components;

  function strongConnect(node) {
    indexes.set(node, index);
    lowlinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of successors.get(node) || []) {
      if (!indexes.has(next)) {
        strongConnect(next);
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(next)));
      } else if (onStack.has(next)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indexes.get(next)));
      }
    }
    if (lowlinks.get(node) === indexes.get(node)) {
      const component = [];
      let cur;
      do {
        cur = stack.pop();
        onStack.delete(cur);
        component.push(cur);
      } while (cur !== node);
      components.push(component);
    }
  }
}

function buildLabelIndex(items) {
  const out = new Map();
  items.forEach((item, idx) => {
    if (item && item.labelDef) out.set(trimLabel(item.labelDef), idx);
  });
  return out;
}

function collectBranchRefs(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 1) {
    for (const label of branchLabelsOf(items[i] && items[i].instruction)) {
      const normalized = trimLabel(label);
      if (!normalized) continue;
      const refs = out.get(normalized) || [];
      refs.push(i);
      out.set(normalized, refs);
    }
  }
  return out;
}

function collectBranchRefsDetailed(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 1) {
    for (const label of branchLabelsOf(items[i] && items[i].instruction)) {
      const normalized = trimLabel(label);
      if (!normalized) continue;
      const refs = out.get(normalized) || [];
      refs.push({ idx: i, pc: pcOf(items[i]), op: opcodeOf(items[i] && items[i].instruction) });
      out.set(normalized, refs);
    }
  }
  return out;
}

function branchLabelsOf(instruction) {
  if (!instruction) return [];
  const op = opcodeOf(instruction);
  const arg = typeof instruction === 'object' ? instruction.arg : null;
  if (op === 'goto' || op === 'goto_w' || /^if/.test(op || '')) return typeof arg === 'string' ? [arg] : [];
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
  const prev = previousInstructionIndex(items, target - 1);
  return prev >= 0 && !isUnconditionalTerminal(opcodeOf(items[prev] && items[prev].instruction));
}

function nextInstructionIndex(items, start) {
  for (let i = start; i < items.length; i += 1) {
    if (items[i] && items[i].instruction) return i;
  }
  return -1;
}

function previousInstructionIndex(items, start) {
  for (let i = start; i >= 0; i -= 1) {
    if (items[i] && items[i].instruction) return i;
  }
  return -1;
}

function isUnconditionalTerminal(op) {
  return op === 'goto' || op === 'goto_w' || isReturnOrThrow(op);
}

function isReturnOrThrow(op) {
  return op === 'return' || op === 'ireturn' || op === 'lreturn' || op === 'freturn' ||
    op === 'dreturn' || op === 'areturn' || op === 'athrow';
}

function isConditionalBranch(op) {
  return typeof op === 'string' && op.startsWith('if');
}

function isStackConsumingBranch(op) {
  return /^if_(?:icmp|acmp)/.test(op || '');
}

function isStoreOrSideEffect(op) {
  return typeof op === 'string' && (
    op.endsWith('store') ||
    /store_\d$/.test(op) ||
    op === 'iinc' ||
    op.endsWith('astore') ||
    op === 'putfield' ||
    op === 'putstatic' ||
    op.startsWith('invoke') ||
    op === 'athrow'
  );
}

function hasKnownLocalInputsAtSource(items, source, start, end, initiallyAssigned = []) {
  const needed = new Set();
  const definedInTail = new Set();
  for (let i = start; i <= end; i += 1) {
    for (const local of readLocalIndexes(items[i] && items[i].instruction)) {
      if (!definedInTail.has(local)) needed.add(local);
    }
    for (const local of writtenLocalIndexes(items[i] && items[i].instruction)) {
      definedInTail.add(local);
    }
  }
  if (needed.size === 0) return true;
  const assigned = new Set(initiallyAssigned);
  for (let i = 0; i < source; i += 1) {
    for (const local of writtenLocalIndexes(items[i] && items[i].instruction)) assigned.add(local);
  }
  for (const local of needed) {
    if (!assigned.has(local)) return false;
  }
  return true;
}

function methodInitialLocals(method) {
  const locals = new Set();
  const access = Array.isArray(method.access) ? method.access : [];
  let slot = access.includes('static') ? 0 : 1;
  if (!access.includes('static')) locals.add(0);
  const descriptor = method.descriptor || '';
  const params = descriptor.slice(descriptor.indexOf('(') + 1, descriptor.indexOf(')'));
  for (let i = 0; i < params.length; i += 1) {
    let cur = params[i];
    while (cur === '[') cur = params[++i];
    if (cur === 'L') {
      while (i < params.length && params[i] !== ';') i += 1;
    }
    locals.add(slot);
    slot += cur === 'J' || cur === 'D' ? 2 : 1;
  }
  return locals;
}

function hasReferencedLabelsInside(items, start, end) {
  const refs = collectBranchRefs(items);
  for (let i = start; i < end; i += 1) {
    const label = trimLabel(items[i] && items[i].labelDef);
    if (label && (refs.get(label) || []).length > 0) return true;
  }
  return false;
}

function hasLabelsReferencedFromOutsideRange(items, labelStart, labelEnd, rangeStart, rangeEnd, allowedExternalSource = null) {
  return countLabelsReferencedFromOutsideRange(items, labelStart, labelEnd, rangeStart, rangeEnd, allowedExternalSource) > 0;
}

function countLabelsReferencedFromOutsideRange(items, labelStart, labelEnd, rangeStart, rangeEnd, allowedExternalSource = null) {
  const refs = collectBranchRefs(items);
  let count = 0;
  for (let i = labelStart; i < labelEnd; i += 1) {
    const label = trimLabel(items[i] && items[i].labelDef);
    if (!label) continue;
    for (const ref of refs.get(label) || []) {
      if (ref === allowedExternalSource) continue;
      if (ref < rangeStart || ref > rangeEnd) count += 1;
    }
  }
  return count;
}

function readLocalIndexes(instruction) {
  const out = [];
  const local = localIndex(instruction);
  const op = opcodeOf(instruction);
  if (local != null && /load/.test(op || '')) out.push(local);
  return out;
}

function writtenLocalIndexes(instruction) {
  const out = [];
  const local = localIndex(instruction);
  const op = opcodeOf(instruction);
  if (local != null && (/store/.test(op || '') || op === 'iinc')) out.push(local);
  return out;
}

function opcodeOf(instruction) {
  return typeof instruction === 'string' ? instruction.trim().split(/\s+/)[0] : instruction && instruction.op;
}

function localIndex(instruction) {
  const op = opcodeOf(instruction);
  if (!op) return null;
  const suffixed = /^(?:[a-z])(?:load|store)_(\d)$/.exec(op);
  if (suffixed) return Number(suffixed[1]);
  if (op === 'iinc') return Number(instruction && instruction.arg && String(instruction.arg).split(/\s+/)[0]);
  if (/^[a-z](?:load|store)$/.test(op)) return Number(instruction && instruction.arg);
  return null;
}

function localFamily(op) {
  const match = /^([a-z])(?:load|store)(?:_\d)?$/.exec(op || '');
  if (match) return match[1];
  if (op === 'iinc') return 'i';
  return null;
}

function trimLabel(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : null;
}

function renderCodeWindow(items, start, end, focusIdx, sourceIdx) {
  const lines = [];
  for (let i = start; i < end; i += 1) {
    const item = items[i] || {};
    const mark = i === focusIdx ? '>' : i === sourceIdx ? '*' : ' ';
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
  const arg = instruction.arg == null ? '' : ` ${JSON.stringify(instruction.arg, (_key, value) => typeof value === 'bigint' ? value.toString() : value)}`;
  return `${op}${arg}`;
}

function pcOf(item) {
  return item && typeof item.pc === 'number' ? item.pc : -1;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] || 0) + 1;
  return out;
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

main(process.argv.slice(2));
