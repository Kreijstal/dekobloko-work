// Reusable binding-checked naming/export workflow, including packaged Java.
// Earlier games retain their pinned workflow; new games share this implementation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {generateReadable, sourceInventory, sourceIdentity} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {archivedInput, digest, funorbRepository, namedReceipt, verifyToolPin, workflowRoot} from './game-export.mjs';

export function reviewedRules(input, rows, classes, members) {
  const declarations = new Map(rows.filter(r => r[0] === 'D' || r[0] === 'T').map(r => [r[4], r]));
  const result = new Map(), assignments = new Map();
  const add = (symbol, to, evidence, confidence = 'reviewed') => {
    const row = declarations.get(symbol);
    if (!row) throw new Error('Reviewed declaration missing: ' + symbol);
    const previous = assignments.get(symbol);
    if (previous && previous.to !== to) throw new Error('Conflicting reviewed names: ' + symbol);
    if (previous) return false;
    const rule = {symbol, originalName: row[5], to, evidence, confidence};
    assignments.set(symbol, rule);
    if (row[5] !== to) result.set(symbol, rule);
    return true;
  };
  for (const [owner, [name, evidence]] of Object.entries(classes)) add('C:' + owner, name, evidence);
  for (const [symbol, {to, evidence, expectedOriginalName}] of Object.entries(members)) {
    if (expectedOriginalName && declarations.get(symbol)?.[5] !== expectedOriginalName)
      throw new Error('Reviewed lexical identity differs: ' + symbol);
    add(symbol, to, evidence);
  }
  const edges = rows.filter(r => r[0] === 'O').map(r => [r[1], r[2]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of edges) {
      const left = assignments.get(a), right = assignments.get(b), known = left || right;
      if (!known) continue;
      if (left && right && left.to !== right.to) throw new Error('Conflicting override family: ' + a);
      for (const symbol of [a, b]) {
        if (!declarations.has(symbol)) throw new Error('Cannot rename external override contract: ' + symbol);
        if (!assignments.has(symbol)) changed = add(symbol, known.to, known.evidence + ' Resolved override family.') || changed;
        for (const [key] of declarations) if (key.startsWith('P:' + symbol.slice(2) + '#')) {
          const ordinal = key.slice(key.lastIndexOf('#'));
          const origin = assignments.get('P:' + known.symbol.slice(2) + ordinal);
          if (origin && !assignments.has(key)) changed = add(key, origin.to, origin.evidence + ' Resolved override parameter.') || changed;
        }
      }
    }
  }
  const sources = new Map(sourceInventory(input).map(f => [f.path, fs.readFileSync(path.join(input, f.path), 'utf8')]));
  for (const row of rows.filter(r => r[0] === 'T')) {
    const isLoop = /^\s*:\s*(?:while|for|do)\b/.test(sources.get(row[1]).slice(Number(row[3])));
    const ordinal = Number(row[4].slice(row[4].lastIndexOf('#') + 1)) + 1;
    add(row[4], (isLoop ? 'scanLoop' : 'regionExit') + ordinal,
      'Resolved lexical target and declaration ordinal; transfers are unchanged.', 'structural');
  }
  return [...result.values()].sort((a, b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
}

export function buildReviewedManifest(config) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-rules-'));
  try {
    verifyToolPin();
    const catalog = JSON.parse(captureProcess('git', ['-C', funorbRepository, 'show',
      config.sourceCommit + ':decompilation-provenance.json']).stdout);
    const record = catalog.publication.games[config.game];
    const rules = {schema: 1, game: config.game, version: config.version,
      source: {repository: 'Kreijstal/funorb-decompiled', commit: config.sourceCommit, subdirectory: 'games/' + config.game},
      inputTreeSha256: record.sources.sha256};
    const input = archivedInput(rules, temporary), stubs = buildCompilationStubs(funorbRepository, temporary);
    const helper = path.join(temporary, 'helper'), compiled = path.join(temporary, 'classes');
    fs.mkdirSync(helper); fs.mkdirSync(compiled);
    captureProcess('javac', ['-encoding', 'UTF-8', '-d', helper, path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
    const files = path.join(temporary, 'files'), audit = path.join(temporary, 'audit.tsv');
    fs.writeFileSync(files, sourceInventory(input).map(f => f.path).join('\n') + '\n');
    captureProcess('java', ['-Xmx1024m', '-cp', helper, 'ReadableJava', input, files, audit, compiled, stubs.jar,
      '--class-name-literals', '--labels']);
    const rows = fs.readFileSync(audit, 'utf8').trimEnd().split('\n').map(r => r.split('\t'));
    rules.renames = reviewedRules(input, rows, config.classes, config.members);
    const symbols = new Set(rules.renames.map(r => r.symbol));
    rules.classNameLiterals = {policy: 'direct-owned-class-for-name', expectedEdits: rows.filter(r => r[0] === 'S' && symbols.has(r[4])).length};
    rules.labels = {policy: 'lexical-targets', expectedEdits: rows.filter(r => ['T', 'B', 'N'].includes(r[0]) && symbols.has(r[4])).length};
    if (rows.some(r => r[0] === 'U' && symbols.has(r[4]))) throw new Error('Unsupported escaped class-name literal');
    rules.publication = {stubSourceTreeSha256: stubs.sourceTreeSha256, stubJarSha256: digest(fs.readFileSync(stubs.jar))};
    rules.readabilityWorkflow = {repository: 'Kreijstal/dekobloko-work',
      files: Object.fromEntries(config.workflowFiles.map(f => [f, digest(fs.readFileSync(path.join(workflowRoot, f)))]))};
    rules.generators = {javaTools: record.sourceGenerator, namingTool: verifyToolPin()};
    return rules;
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
}

export function validateReviewedManifest(config, rules) {
  if (rules.schema !== 1 || rules.game !== config.game || rules.version !== config.version ||
      rules.source?.commit !== config.sourceCommit) throw new Error('Invalid reviewed naming manifest');
  if (JSON.stringify(Object.keys(rules.readabilityWorkflow.files)) !== JSON.stringify(config.workflowFiles))
    throw new Error('Naming workflow inventory changed');
  for (const [file, hash] of Object.entries(rules.readabilityWorkflow.files))
    if (digest(fs.readFileSync(path.join(workflowRoot, file))) !== hash) throw new Error('Naming workflow changed: ' + file);
  if (JSON.stringify(rules.generators.namingTool) !== JSON.stringify(verifyToolPin())) throw new Error('Naming tool identity changed');
}

// The published game may include owned package subdirectories. Refuse extra
// assets, binaries and symlinks instead of silently deleting unmanaged work.
export function checkJavaPublication(directory, root = directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkJavaPublication(file, root);
    else if (!entry.isFile() || !(entry.name.endsWith('.java') || directory === root && entry.name === 'README.md'))
      throw new Error('Unmanaged entry in game publication: ' + path.relative(root, file));
  }
}

export function installReviewedGame(repository, game, generated, dictionary, guide, check) {
  if (!/^[a-z0-9]+$/.test(game)) throw new Error('Invalid game identity');
  const directory = path.join(repository, 'games', game);
  const dictionaryFile = path.join(repository, 'decompilation', game + '-naming.json');
  const manifestFile = path.join(repository, 'decompilation-provenance.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile)), bytes = JSON.stringify(dictionary, null, 2) + '\n';
  const receipt = namedReceipt(game, dictionary, bytes, guide);
  checkJavaPublication(directory); checkJavaPublication(path.join(generated, 'src'));
  if (check) {
    if (sourceIdentity(sourceInventory(directory)) !== receipt.sources.sha256 ||
        fs.readFileSync(dictionaryFile, 'utf8') !== bytes || fs.readFileSync(path.join(directory, 'README.md'), 'utf8') !== guide ||
        JSON.stringify(manifest.namedExports?.[game]) !== JSON.stringify(receipt)) throw new Error('Published named game differs: ' + game);
    return;
  }
  const refresh = fs.mkdtempSync(path.join(repository, '.named-refresh-')), previous = path.join(refresh, 'previous');
  const originals = new Map([dictionaryFile, manifestFile].map(f => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
  try {
    const candidate = path.join(refresh, 'game');
    fs.cpSync(path.join(generated, 'src'), candidate, {recursive: true});
    fs.writeFileSync(path.join(candidate, 'README.md'), guide);
    manifest.namedExports = {...manifest.namedExports, [game]: receipt};
    manifest.publication.readableExports = 'Named Java is published directly in games/; pinned input and reverse dictionaries are recorded in namedExports.';
    if (manifest.publication.games?.[game]) manifest.publication.games[game].publishedSources = receipt.sources;
    fs.writeFileSync(path.join(refresh, 'dictionary.json'), bytes);
    fs.writeFileSync(path.join(refresh, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.renameSync(directory, previous);
    try {
      fs.renameSync(candidate, directory);
      fs.renameSync(path.join(refresh, 'dictionary.json'), dictionaryFile);
      fs.renameSync(path.join(refresh, 'manifest.json'), manifestFile);
    } catch (error) {
      fs.rmSync(directory, {recursive: true, force: true}); fs.renameSync(previous, directory);
      for (const [file, original] of originals) original === null ? fs.rmSync(file, {force: true}) : fs.writeFileSync(file, original);
      throw error;
    }
    fs.rmSync(previous, {recursive: true});
  } finally {if (!fs.existsSync(previous)) fs.rmSync(refresh, {recursive: true, force: true});}
}

export async function reproduceReviewedGame(config, args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--update', '--check'].includes(args[0]))
    throw new Error(`Usage: node readable/reproduce-${config.game}.mjs --update|--check`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-export-'));
  try {
    const rulesFile = path.join(workflowRoot, config.game + '-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesFile)); validateReviewedManifest(config, rules);
    const input = archivedInput(rules, temporary), stubs = buildCompilationStubs(funorbRepository, temporary);
    if (stubs.sourceTreeSha256 !== rules.publication.stubSourceTreeSha256 || digest(fs.readFileSync(stubs.jar)) !== rules.publication.stubJarSha256)
      throw new Error('Compilation stub source/dependency changed');
    const generated = path.join(temporary, 'generated');
    const result = generateReadable({input, output: generated, rulesFile, classpath: stubs.jar});
    const mapping = JSON.parse(fs.readFileSync(path.join(generated, 'mapping.json')));
    const dictionary = {...mapping, provenance: JSON.parse(fs.readFileSync(path.join(generated, 'provenance.json'))), generators: rules.generators};
    dictionary.provenance.verification.gameplayCore = await config.verifyCore(input, path.join(generated, 'src'), mapping, stubs.jar, temporary);
    installReviewedGame(funorbRepository, config.game, generated, dictionary, config.readingGuide(rules, mapping), args[0] === '--check');
    return {...result, gameplayCore: dictionary.provenance.verification.gameplayCore, check: args[0] === '--check', publishedDirectory: 'games/' + config.game};
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
}
