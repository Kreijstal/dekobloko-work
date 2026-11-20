import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {namingCoverage} from './naming-coverage.mjs';
import {funorbRepository} from './game-export.mjs';

// This export also uses three lowercase letters for obfuscated classes and
// generated runPartition methods. Keep short contracts such as run/get/put.
export function voidHuntersCoverage(mapping) {
  const coverage = namingCoverage(mapping);
  const files = new Map(mapping.files.map(file => [file.original, file.renamed]));
  for (const row of mapping.symbols) {
    const unresolved = row.symbol.startsWith('C:') && /^[a-z]{3}$/.test(row.renamedName)
      ? coverage.unresolvedClasses
      : row.symbol.startsWith('M:') && /^runPartition\d+$/.test(row.renamedName)
        ? coverage.unresolvedMethods : null;
    if (!unresolved) continue;
    unresolved.push({symbol: row.symbol, name: row.renamedName,
      file: files.get(row.declaration?.file) || row.declaration?.file});
  }
  coverage.namedClasses = coverage.classes - coverage.unresolvedClasses.length;
  coverage.namedMethods = coverage.methods - coverage.unresolvedMethods.length;
  coverage.complete = !coverage.unresolvedClasses.length && !coverage.unresolvedMethods.length;
  return coverage;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = voidHuntersCoverage(JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/voidhunters-naming.json'))));
  console.log(JSON.stringify({...result, unresolvedClasses: result.unresolvedClasses.length,
    unresolvedMethods: result.unresolvedMethods.length,
    nextClasses: result.unresolvedClasses.slice(0, 8), nextMethods: result.unresolvedMethods.slice(0, 8)}));
  if (!result.complete) process.exitCode = 1;
}
