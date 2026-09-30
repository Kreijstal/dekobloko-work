import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const helper = fileURLToPath(new URL('./lib/ReadableJava.java', import.meta.url));
const script = fileURLToPath(import.meta.url);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function sourceInventory(root) {
  const files = [];
  function walk(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => order(a.name, b.name))) {
      const relative = prefix + entry.name;
      if (/[\t\r\n]/.test(relative)) throw new Error('Source paths cannot contain tabs or newlines');
      if (entry.isSymbolicLink()) throw new Error(`Refusing source symlink: ${relative}`);
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative + '/');
      else if (entry.isFile() && entry.name.endsWith('.java'))
        files.push({path: relative, sha256: sha256(fs.readFileSync(path.join(root, relative)))});
    }
  }
  walk(root);
  if (!files.length) throw new Error('No Java sources');
  return files.sort((a, b) => order(a.path, b.path));
}

export function sourceIdentity(files) {
  return sha256(JSON.stringify(files.map(file => [file.path, file.sha256])));
}

function readAudit(file) {
  const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => line.split('\t'));
  return {bindings: rows.filter(row => row[0] !== 'O').map(([kind, file, start, end, key, name]) =>
    ({kind, file, start: Number(start), end: Number(end), key, name})),
  overrides: rows.filter(row => row[0] === 'O').map(([, child, parent]) => ({child, parent}))};
}

function validateRules(rules, audit) {
  if (rules.schema !== 1 || !Array.isArray(rules.renames)) throw new Error('Expected rules schema 1');
  const declarations = new Map(audit.bindings.filter(row => row.kind === 'D').map(row => [row.key, row]));
  const renames = new Map();
  const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const keywords = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _').split(' '));
  for (const rule of rules.renames) {
    if (!/^[CMFP]:/.test(rule.symbol) || !identifier.test(rule.to) || keywords.has(rule.to))
      throw new Error(`Invalid rename rule: ${JSON.stringify(rule)}`);
    if (!rule.evidence || typeof rule.evidence !== 'string') throw new Error(`Missing evidence: ${rule.symbol}`);
    if (renames.has(rule.symbol)) throw new Error(`Duplicate rule: ${rule.symbol}`);
    if (!declarations.has(rule.symbol)) throw new Error(`Missing declaration: ${rule.symbol}`);
    if (rule.symbol.startsWith('C:') && rule.symbol.includes('$')) throw new Error('Nested/local class renaming is not supported');
    if (rule.symbol.includes('.<init>') || rule.symbol.includes('.<clinit>')) throw new Error('Use a class rule to rename constructors');
    renames.set(rule.symbol, rule.to);
  }
  const methodName = key => renames.get(key) ?? key.slice(2, key.indexOf('(')).split('.').at(-1);
  for (const {child, parent} of audit.overrides)
    if (methodName(child) !== methodName(parent))
      throw new Error(`Incomplete override family: ${child} / ${parent}`);
  return renames;
}

function identityMapper(renames) {
  const classes = [...renames].filter(([key]) => key.startsWith('C:')).map(([key, name]) => {
    const original = key.slice(2);
    return [original, original.slice(0, original.lastIndexOf('.') + 1) + name];
  }).sort((a, b) => b[0].length - a[0].length || order(a[0], b[0]));
  const owner = value => {
    const found = classes.find(([old]) => value === old || value.startsWith(old + '$'));
    return found ? found[1] + value.slice(found[0].length) : value;
  };
  const descriptor = value => value.replace(/L([^;]+);/g, (_, name) => `L${owner(name.replaceAll('/', '.')).replaceAll('.', '/')};`);
  return key => {
    if (key.startsWith('C:')) return 'C:' + owner(key.slice(2));
    const parameter = key.startsWith('P:') || key.startsWith('L:');
    const prefix = key.slice(0, 2);
    const hash = parameter ? key.lastIndexOf('#') : key.length;
    const member = key.slice(2, hash);
    const boundary = member.indexOf(key.startsWith('F:') ? ':' : '(');
    const dot = member.lastIndexOf('.', boundary);
    const originalOwner = member.slice(0, dot);
    const name = member.slice(dot + 1, boundary);
    const method = 'M:' + member;
    const renamed = renames.get(parameter ? method : key) ?? name;
    return prefix + owner(originalOwner) + '.' + renamed + descriptor(member.slice(boundary)) + (parameter ? key.slice(hash) : '');
  };
}

function renameSource(source, edits) {
  let result = '', cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor || source.slice(edit.start, edit.end) !== edit.original)
      throw new Error(`Overlapping or stale edit at ${edit.start}`);
    result += source.slice(cursor, edit.start) + edit.renamed;
    cursor = edit.end;
  }
  return result + source.slice(cursor);
}

// Javac binds again after rewriting. Compare all recorded declarations/references,
// including untouched external symbols, to catch silently changed overload/shadow lookup.
function verifyBindings(before, after, files, editsByFile, mapIdentity) {
  const expected = new Map();
  for (const binding of before.bindings) {
    const edits = editsByFile.get(binding.file) ?? [];
    let start = binding.start, end = binding.end;
    for (const edit of edits) {
      const delta = edit.renamed.length - (edit.end - edit.start);
      if (edit.end <= binding.start) start += delta;
      if (edit.end <= binding.end) end += delta;
    }
    const position = [binding.kind, files.get(binding.file), start, end].join(':');
    if (expected.has(position)) throw new Error(`Ambiguous original binding: ${position}`);
    expected.set(position, mapIdentity(binding.key));
  }
  for (const binding of after.bindings) {
    const position = [binding.kind, binding.file, binding.start, binding.end].join(':');
    if (expected.get(position) !== binding.key)
      throw new Error(`Binding changed: ${position}: expected ${expected.get(position)}, got ${binding.key}`);
    expected.delete(position);
  }
  if (expected.size) throw new Error(`Lost ${expected.size} source bindings`);
  const expectedOverrides = before.overrides.map(({child, parent}) => `${mapIdentity(child)} / ${mapIdentity(parent)}`).sort(order);
  const actualOverrides = after.overrides.map(({child, parent}) => `${child} / ${parent}`).sort(order);
  if (JSON.stringify(expectedOverrides) !== JSON.stringify(actualOverrides))
    throw new Error('Override relationships changed after renaming');
}

export function generateReadable({input, output, rulesFile, classpath = '', check = false}) {
  input = path.resolve(input);
  output = path.resolve(output);
  const contains = (parent, child) => child === parent || child.startsWith(parent + path.sep);
  if (contains(input, output) || contains(output, input)) throw new Error('Input and output trees must be separate');
  if (!check && fs.existsSync(output)) throw new Error('Output already exists; use --check or a new directory');
  const inventory = sourceInventory(input);
  const rulesBytes = fs.readFileSync(rulesFile);
  const rules = JSON.parse(rulesBytes);
  const inputIdentity = sourceIdentity(inventory);
  if (rules.inputTreeSha256 !== inputIdentity) throw new Error(`Source identity mismatch: expected ${rules.inputTreeSha256}, got ${inputIdentity}`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'readable-java-'));
  try {
    const compiledHelper = path.join(temporary, 'helper');
    fs.mkdirSync(compiledHelper);
    const javac = process.env.JAVAC ?? 'javac';
    const java = process.env.JAVA ?? 'java';
    execFileSync(javac, ['-encoding', 'UTF-8', '-d', compiledHelper, helper], {stdio: 'pipe'});
    function audit(root, files, name) {
      const list = path.join(temporary, name + '.files');
      const report = path.join(temporary, name + '.tsv');
      const classes = path.join(temporary, name + '-classes');
      fs.mkdirSync(classes);
      fs.writeFileSync(list, files.map(file => file.path).join('\n') + '\n');
      execFileSync(java, ['-Xmx1024m', '-cp', compiledHelper, 'ReadableJava', root, list, report, classes, classpath],
        {stdio: 'pipe', maxBuffer: 8 * 1024 * 1024});
      return readAudit(report);
    }
    const before = audit(input, inventory, 'original');
    const renames = validateRules(rules, before);
    const mapIdentity = identityMapper(renames);
    const editsByFile = new Map();
    for (const binding of before.bindings) {
      let renamed = renames.get(binding.key);
      if (binding.kind === 'D' && binding.key.startsWith('M:') && binding.key.includes('.<init>('))
        renamed = renames.get('C:' + binding.key.slice(2, binding.key.indexOf('.<init>(')));
      if (!renamed || renamed === binding.name) continue;
      const edits = editsByFile.get(binding.file) ?? [];
      if (edits.some(edit => edit.start === binding.start)) throw new Error(`Duplicate edit: ${binding.file}:${binding.start}`);
      edits.push({start: binding.start, end: binding.end, symbol: binding.key, original: binding.name, renamed});
      editsByFile.set(binding.file, edits);
    }
    for (const edits of editsByFile.values()) edits.sort((a, b) => a.start - b.start);
    const files = new Map();
    for (const file of inventory) {
      const classDecl = before.bindings.find(row => row.kind === 'D' && row.file === file.path &&
        row.key.startsWith('C:') && row.name + '.java' === path.basename(file.path));
      const name = classDecl && renames.get(classDecl.key);
      const target = name ? path.posix.join(path.posix.dirname(file.path), name + '.java') : file.path;
      if ([...files.values()].includes(target)) throw new Error(`Output file collision: ${target}`);
      files.set(file.path, target);
    }
    const generated = path.join(temporary, 'generated');
    const sources = path.join(generated, 'src');
    fs.mkdirSync(sources, {recursive: true});
    for (const file of inventory) {
      const target = path.join(sources, files.get(file.path));
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, renameSource(fs.readFileSync(path.join(input, file.path), 'utf8'), editsByFile.get(file.path) ?? []));
    }
    const after = audit(sources, sourceInventory(sources), 'renamed');
    verifyBindings(before, after, files, editsByFile, mapIdentity);
    const explicitRules = rules.renames.map(rule => ({...rule, renamedSymbol: mapIdentity(rule.symbol)})).sort((a, b) => order(a.symbol, b.symbol));
    const symbols = before.bindings.filter(row => row.kind === 'D').map(row => ({
      symbol: row.key, renamedSymbol: mapIdentity(row.key), originalName: row.name,
      renamedName: renames.get(row.key) ?? (row.key.startsWith('M:') && row.key.includes('.<init>(')
        ? renames.get('C:' + row.key.slice(2, row.key.indexOf('.<init>('))) : undefined) ?? row.name,
      declaration: {file: row.file, start: row.start, end: row.end},
    })).sort((a, b) => order(a.symbol, b.symbol));
    const mapping = {schema: 1, inputTreeSha256: inputIdentity, positionUnits: 'UTF-16 code units in original source',
      rules: explicitRules, symbols, files: inventory.map(file => ({
      original: file.path, renamed: files.get(file.path), inputSha256: file.sha256,
      outputSha256: sha256(fs.readFileSync(path.join(sources, files.get(file.path)))),
      edits: editsByFile.get(file.path) ?? [],
    }))};
    const provenance = {schema: 1, mode: 'readable-source-mirror', source: rules.source ?? null, rulesSha256: sha256(rulesBytes),
      generatorSha256: sha256(JSON.stringify([sha256(fs.readFileSync(script)), sha256(fs.readFileSync(helper))])),
      inputTreeSha256: inputIdentity, outputTreeSha256: sourceIdentity(sourceInventory(sources)),
      jdk: (() => {
        const result = spawnSync(java, ['-version'], {encoding: 'utf8'});
        if (result.status !== 0) throw new Error('Cannot record JDK identity');
        return (result.stdout + result.stderr).trim();
      })(),
      classpath: classpath.split(path.delimiter).filter(Boolean).map(file => {
        if (!fs.statSync(file).isFile()) throw new Error('Classpath entries must be regular files for hashing');
        return {name: path.basename(file), sha256: sha256(fs.readFileSync(file))};
      }),
      verification: {originalCompiles: true, renamedCompiles: true, bindingsCompared: before.bindings.length,
        overrideFamiliesChecked: before.overrides.length, overrideRelationshipsPreserved: true, runtimeEquivalenceVerified: false}};
    fs.writeFileSync(path.join(generated, 'mapping.json'), JSON.stringify(mapping, null, 2) + '\n');
    fs.writeFileSync(path.join(generated, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
    const table = ['# Readable Java symbol map', '', 'Generated from explicit rules; original names remain lookup identities.', '',
      '| Original identity | Readable name | Evidence |', '| --- | --- | --- |',
      ...explicitRules.map(rule => `| \`${rule.symbol}\` | \`${rule.to}\` | ${rule.evidence.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`), ''];
    fs.writeFileSync(path.join(generated, 'SYMBOLS.md'), table.join('\n'));
    if (check) {
      const compare = directory => {
        const entries = [];
        function walk(root, prefix = '') {
          for (const entry of fs.readdirSync(root, {withFileTypes: true}).sort((a, b) => order(a.name, b.name))) {
            if (entry.isDirectory()) walk(path.join(root, entry.name), prefix + entry.name + '/');
            else if (entry.isFile()) entries.push([prefix + entry.name, sha256(fs.readFileSync(path.join(root, entry.name)))]);
            else throw new Error('Unexpected generated symlink or special file');
          }
        }
        walk(directory);
        return JSON.stringify(entries);
      };
      if (compare(output) !== compare(generated)) throw new Error('Readable tree differs from deterministic regeneration');
    } else {
      fs.mkdirSync(path.dirname(output), {recursive: true});
      fs.cpSync(generated, output, {recursive: true, errorOnExist: true, force: false});
    }
    return {files: inventory.length, rules: explicitRules.length, edits: [...editsByFile.values()].reduce((n, edits) => n + edits.length, 0),
      bindingsCompared: before.bindings.length, inputTreeSha256: inputIdentity, outputTreeSha256: provenance.outputTreeSha256, check};
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  if (check) args.splice(args.indexOf('--check'), 1);
  if (args.length < 3 || args.length > 4) throw new Error('Usage: node scripts/readable-java.mjs INPUT OUTPUT RULES_JSON [CLASSPATH] [--check]');
  try { console.log(JSON.stringify(generateReadable({input: args[0], output: args[1], rulesFile: args[2], classpath: args[3], check}))); }
  catch (error) { console.error(error.stderr?.toString() || error.message); process.exitCode = 1; }
}
