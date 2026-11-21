import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {funorbRepository} from './game-export.mjs';
import {namingCoverage} from './naming-coverage.mjs';

// Keep this stricter catalog audit separate from the frozen per-game workflows.
// A numbered category or return-type label still leaves the operation unnamed.
export function gameNamingCoverage(mapping) {
  const coverage = namingCoverage(mapping);
  const unresolvedClasses = new Map(coverage.unresolvedClasses.map(row => [row.symbol, row]));
  const unresolvedMethods = new Map(coverage.unresolvedMethods.map(row => [row.symbol, row]));
  const rules = new Map(mapping.rules.map(row => [row.symbol, row]));
  const files = new Map(mapping.files.map(row => [row.original, row.renamed]));
  for (const row of mapping.symbols) {
    const isClass = row.symbol.startsWith('C:');
    if (!isClass && (!row.symbol.startsWith('M:') || row.symbol.includes('.<init>('))) continue;
    const rule = rules.get(row.symbol);
    const reason = isClass && /^[a-z]{3,4}$/.test(row.renamedName) && row.renamedName === row.originalName
      ? 'unchanged short obfuscated class'
      : !isClass && /^runPartition\d+$/.test(row.renamedName)
        ? 'generated method partition'
        : isClass && rule?.confidence === 'category'
          ? 'numbered structural category'
          : /(?:type-based operation label|numbered category label), finer purpose unresolved/.test(rule?.evidence || '')
            ? 'purpose explicitly unresolved in naming rule' : null;
    if (reason) (isClass ? unresolvedClasses : unresolvedMethods).set(row.symbol, {
      symbol: row.symbol, name: row.renamedName,
      file: files.get(row.declaration?.file) || row.declaration?.file, reason,
    });
  }
  return {...coverage, unresolvedClasses: [...unresolvedClasses.values()], unresolvedMethods: [...unresolvedMethods.values()],
    namedClasses: coverage.classes - unresolvedClasses.size, namedMethods: coverage.methods - unresolvedMethods.size,
    complete: !unresolvedClasses.size && !unresolvedMethods.size};
}

export function catalogGames(file) {
  const games = fs.readFileSync(file, 'utf8').split('\n').filter(line => line && !line.startsWith('#'))
    .map(line => line.split('\t')[0]).sort();
  if (!games.length || games.some(game => !/^[a-z0-9_]+$/.test(game)) || new Set(games).size !== games.length)
    throw new Error('Invalid canonical game catalog');
  return games;
}

function verifySources(directory, mapping) {
  const actual = [];
  const visit = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) visit(path.join(dir, entry.name), relative + '/');
      else if (entry.isFile() && relative.endsWith('.java')) actual.push(relative);
      else if (!entry.isFile() || relative !== 'README.md') throw new Error('Unexpected publication entry: ' + relative);
    }
  };
  visit(directory);
  const expected = mapping.files.map(row => row.renamed).sort();
  if (new Set(expected).size !== expected.length || JSON.stringify(actual.sort()) !== JSON.stringify(expected))
    throw new Error('Published source roster differs: ' + directory);
  for (const row of mapping.files) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, row.renamed))).digest('hex');
    if (hash !== row.outputSha256) throw new Error('Published source differs from dictionary: ' + directory + '/' + row.renamed);
  }
}

export function catalogNamingCoverage({repository = funorbRepository,
  catalogFile = fileURLToPath(new URL('../scripts/EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv', import.meta.url))} = {}) {
  const games = catalogGames(catalogFile);
  const published = fs.readdirSync(path.join(repository, 'games'), {withFileTypes: true})
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  if (JSON.stringify(games) !== JSON.stringify(published)) throw new Error('Published games differ from canonical catalog');
  const results = [];
  for (const game of games) {
    const mapping = JSON.parse(fs.readFileSync(path.join(repository, 'decompilation', game + '-naming.json')));
    verifySources(path.join(repository, 'games', game), mapping);
    results.push({game, ...gameNamingCoverage(mapping)});
  }
  const totals = {games: games.length, completeGames: results.filter(row => row.complete).length,
    classes: 0, methods: 0, namedClasses: 0, namedMethods: 0, remainingClasses: 0, remainingMethods: 0};
  for (const row of results) {
    for (const key of ['classes', 'methods', 'namedClasses', 'namedMethods']) totals[key] += row[key];
    totals.remainingClasses += row.unresolvedClasses.length;
    totals.remainingMethods += row.unresolvedMethods.length;
  }
  return {totals, complete: results.every(row => row.complete), games: results};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node readable/catalog-naming-coverage.mjs');
    const report = catalogNamingCoverage();
    console.log(JSON.stringify({...report, games: report.games.map(({unresolvedClasses, unresolvedMethods, ...row}) => ({
      ...row, remainingClasses: unresolvedClasses.length, remainingMethods: unresolvedMethods.length,
    }))}, null, 2));
    if (!report.complete) process.exitCode = 1;
  } catch (error) {console.error(error.stack); process.exitCode = 1;}
}
