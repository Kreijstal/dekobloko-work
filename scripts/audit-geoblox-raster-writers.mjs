// Inventory for reviewing a future dirty-region patch, not an alias-safety proof.
// The decompiled corpus uses four-space class-member indentation. Refuse raster
// references outside recognized members rather than silently losing coverage.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function inspectRasterSource(source, filename) {
  const lines = source.split('\n');
  const raster = filename === 'vb.java' ? /\bfield_c\b/g : /\bvb\.field_c\b/g;
  const members = [];
  const covered = new Set();
  for (let start = 0; start < lines.length; start++) {
    if (!/^    (?! )(?:[\w.$\[\]]+ )*[\w$]+\([^;]*\) \{$/.test(lines[start])) continue;
    const end = lines.findIndex((line, i) => i > start && line === '    }');
    if (end < 0) throw new Error(`${filename}:${start + 1}: unterminated member`);
    const parameters = [...lines[start].matchAll(/\bint\[\] (param\d+)\b/g)].map(match => match[1]);
    const rasterReferences = [];
    const arrayReferenceUses = [];
    for (let i = start + 1; i < end; i++) {
      const matches = [...lines[i].matchAll(raster)];
      if (matches.length) {
        covered.add(i);
        rasterReferences.push({line: i + 1, occurrences: matches.length, text: lines[i].trim()});
      }
      for (const parameter of parameters) {
        // Keep null checks and local aliases in the report for manual review.
        if (new RegExp(`\\b${parameter}\\b(?!\\s*\\[)`).test(lines[i])) {
          arrayReferenceUses.push({line: i + 1, parameter, text: lines[i].trim()});
        }
      }
    }
    if (rasterReferences.length || parameters.length) members.push({
      line: start + 1, signature: lines[start].trim(), rasterReferences, arrayReferenceUses,
    });
    start = end;
  }
  const unclassified = [];
  for (let i = 0; i < lines.length; i++) {
    if (![...lines[i].matchAll(raster)].length || covered.has(i)) continue;
    if (filename === 'vb.java' && /^    static int\[\] field_c;$/.test(lines[i])) continue;
    unclassified.push({line: i + 1, text: lines[i].trim()});
  }
  return {filename, sha256: crypto.createHash('sha256').update(source).digest('hex'), members, unclassified};
}

export function auditRasterSources(directory) {
  return fs.readdirSync(directory).filter(name => name.endsWith('.java')).sort().map(name =>
    inspectRasterSource(fs.readFileSync(path.join(directory, name), 'utf8'), name));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node audit-geoblox-raster-writers.mjs SOURCE_DIRECTORY [OUTPUT_JSON]');
  const files = auditRasterSources(process.argv[2]);
  const unclassified = files.flatMap(file => file.unclassified.map(row => ({filename: file.filename, ...row})));
  const rasterMembers = files.flatMap(file => file.members.filter(member => member.rasterReferences.length));
  const report = {purpose: 'Review inventory only; does not prove alias safety',
    summary: {sourceFiles: files.length, rasterMembers: rasterMembers.length,
      rasterReferences: rasterMembers.reduce((sum, member) => sum + member.rasterReferences.reduce((n, ref) => n + ref.occurrences, 0), 0),
      unclassified: unclassified.length}, files};
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary));
  if (unclassified.length) { console.error(JSON.stringify(unclassified)); process.exitCode = 1; }
}
