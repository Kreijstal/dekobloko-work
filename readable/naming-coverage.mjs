import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {funorbRepository} from './game-export.mjs';

// Audit resolved declarations, including nested classes and overloads. Source
// text searches alone miss declarations after a containing class is renamed.
export function isOpaqueName(name) {
  return /^[A-Za-z]{1,2}$/.test(name) ||
    /^(?:Class|Method|Helper|Unknown|Unresolved|Opaque)(?:\d+|_[A-Za-z0-9]+)$/i.test(name);
}

export function namingCoverage(mapping) {
  if (!Array.isArray(mapping.symbols) || !Array.isArray(mapping.files))
    throw new Error('Expected a resolved readable-source dictionary');
  const files = new Map(mapping.files.map(file => [file.original, file.renamed]));
  const unresolvedClasses = [], unresolvedMethods = [], seen = new Set();
  let classes = 0, methods = 0, constructors = 0;
  for (const row of mapping.symbols) {
    if (!/^[CM]:/.test(row.symbol)) continue;
    if (seen.has(row.symbol)) throw new Error('Duplicate declaration: ' + row.symbol);
    seen.add(row.symbol);
    if (row.symbol.startsWith('M:') && row.symbol.includes('.<init>(')) {constructors++; continue;}
    if (typeof row.renamedName !== 'string' || !row.renamedName)
      throw new Error('Missing published name: ' + row.symbol);
    const isClass = row.symbol.startsWith('C:');
    if (isClass) classes++; else methods++;
    if (isOpaqueName(row.renamedName)) (isClass ? unresolvedClasses : unresolvedMethods).push({
      symbol: row.symbol, name: row.renamedName,
      file: files.get(row.declaration?.file) || row.declaration?.file,
    });
  }
  if (!classes || !methods) throw new Error('Dictionary has no owned class/method inventory');
  return {classes, methods, constructors, namedClasses: classes - unresolvedClasses.length,
    namedMethods: methods - unresolvedMethods.length,
    unresolvedClasses, unresolvedMethods, complete: !unresolvedClasses.length && !unresolvedMethods.length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [game, ...extra] = process.argv.slice(2);
  if (!/^[a-z0-9]+$/.test(game || '') || extra.length)
    throw new Error('Usage: node readable/naming-coverage.mjs GAME');
  const result = namingCoverage(JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation', game + '-naming.json'))));
  console.log(JSON.stringify({...result, unresolvedClasses: result.unresolvedClasses.length,
    unresolvedMethods: result.unresolvedMethods.length,
    nextClasses: result.unresolvedClasses.slice(0, 8), nextMethods: result.unresolvedMethods.slice(0, 8)}));
  if (!result.complete) process.exitCode = 1;
}
