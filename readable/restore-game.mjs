import fs from 'node:fs';
import path from 'node:path';
import {sourceIdentity} from './tools/readable-java.mjs';
import {digest, funorbRepository} from './game-export.mjs';

const [game, destination] = process.argv.slice(2);
if (!/^[a-z0-9]+$/.test(game || '') || !destination || process.argv.length !== 4)
  throw new Error('Usage: node readable/restore-game.mjs GAME OUTPUT');
const output = path.resolve(destination);
if (fs.existsSync(output)) throw new Error('Restore output already exists');
const mapping = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation', game + '-naming.json')));
const files = mapping.files.map(file => {
  let source = fs.readFileSync(path.join(funorbRepository, 'games', game, file.renamed), 'utf8');
  if (digest(source) !== file.outputSha256) throw new Error('Modified named source: ' + file.renamed);
  let shift = 0;
  const edits = file.edits.map(edit => {const start = edit.start + shift;shift += edit.renamed.length - (edit.end - edit.start);return {...edit, start};});
  for (const edit of edits.reverse()) {
    if (source.slice(edit.start, edit.start + edit.renamed.length) !== edit.renamed) throw new Error('Stale reverse edit');
    source = source.slice(0, edit.start) + edit.original + source.slice(edit.start + edit.renamed.length);
  }
  if (digest(source) !== file.inputSha256) throw new Error('Original bytes were not recovered');
  return {path: file.original, sha256: file.inputSha256, source};
});
if (sourceIdentity(files) !== mapping.inputTreeSha256) throw new Error('Original tree identity differs');
for (const file of files) {
  const target = path.resolve(output, file.path);
  if (!target.startsWith(output + path.sep)) throw new Error('Unsafe original filename');
}
for (const file of files) {const target = path.join(output, file.path);fs.mkdirSync(path.dirname(target), {recursive: true});fs.writeFileSync(target, file.source);}
console.log(JSON.stringify({restored: files.length, originalBytesRecovered: true, inputTreeSha256: mapping.inputTreeSha256}));
