import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {sourceIdentity} from './readable-java.mjs';

const [inputArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument || !outputArgument || process.argv.length !== 4)
  throw new Error('Usage: node scripts/restore-original.mjs READABLE_EXPORT OUTPUT');
const input = path.resolve(inputArgument), output = path.resolve(outputArgument);
if (fs.existsSync(output)) throw new Error('Restore output already exists');
const mapping = JSON.parse(fs.readFileSync(path.join(input, 'mapping.json')));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = mapping.files.map(file => {
  const bytes = fs.readFileSync(path.join(input, 'src', file.renamed));
  if (digest(bytes) !== file.outputSha256) throw new Error(`Modified readable source: ${file.renamed}`);
  let source = bytes.toString('utf8'), shift = 0;
  const edits = file.edits.map(edit => {
    const start = edit.start + shift;
    shift += edit.renamed.length - (edit.end - edit.start);
    return {...edit, start};
  });
  for (const edit of edits.reverse()) {
    if (source.slice(edit.start, edit.start + edit.renamed.length) !== edit.renamed)
      throw new Error(`Stale reverse edit: ${file.renamed}:${edit.start}`);
    source = source.slice(0, edit.start) + edit.original + source.slice(edit.start + edit.renamed.length);
  }
  if (digest(Buffer.from(source, 'utf8')) !== file.inputSha256)
    throw new Error(`Original bytes were not recovered: ${file.original}`);
  return {path: file.original, sha256: file.inputSha256, source};
});
if (sourceIdentity(files) !== mapping.inputTreeSha256) throw new Error('Original tree identity differs');
for (const file of files) {
  const destination = path.resolve(output, file.path);
  if (!destination.startsWith(output + path.sep)) throw new Error('Invalid restored filename');
}
for (const file of files) {
  const destination = path.join(output, file.path);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, file.source);
}
console.log(JSON.stringify({restored: files.length, inputTreeSha256: mapping.inputTreeSha256,
  originalSourceRequired: false, originalBytesRecovered: true}));
