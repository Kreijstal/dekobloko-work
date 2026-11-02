import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Chess export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  o: ['IntrusiveNode', 'Same shared role as GeoBlox IntrusiveNode: long key, next/previous links and unlink.'],
  fa: ['GameAppletShell', 'Applet/Runnable/Focus/Window listener lifecycle shell with paint, start and stop hooks.'],
  p: ['PacketBuffer', 'IntrusiveNode with payload and cursor, big-endian primitive/string codecs, ISAAC opcode and RSA block helpers; same role as GeoBlox PacketBuffer.'],
  ke: ['IsaacCipher', 'Constructed from an int[] seed; hands out 256 results per batch from a countdown index and regenerates when it is exhausted.'],
  pj: ['GzipInflater', 'Wraps a raw java.util.zip.Inflater and decompresses a gzip payload into a PacketBuffer.'],
  um: ['ResourceArchive', 'Holds an ArchiveProvider and ArchiveIndex plus per-group and per-file caches; same role as GeoBlox ResourceArchive.'],
  ua: ['ArchiveProvider', 'Abstract source of the archive index and encoded group bytes consumed by ResourceArchive.'],
  lj: ['ArchiveIndex', 'Decodes versioned group/file tables from a packed buffer: per-group sizes, ids and child file lists.'],
  nm: ['PcmStream', 'Intrusive node with a linked substream, mix and skip hooks; same role as GeoBlox PcmStream.'],
  na: ['PcmSampleStream', 'PcmStream playing a sample with interpolation, looping and volume ramps; same role as GeoBlox PcmSampleStream.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const nodeEvidence = 'IntrusiveNode link fields and unlink: the successor/predecessor are cleared after being spliced together.';
field('o', 'c', 'Lo;', 'next', nodeEvidence);
field('o', 'h', 'Lo;', 'previous', nodeEvidence);
field('o', 'e', 'J', 'key', 'Long key carried by the node for hash and queue lookups.');
method('o', 'c', '(I)V', 'unlink', ['obfuscationGuard'], nodeEvidence);
method('o', 'b', '(I)Z', 'isLinked', ['obfuscationGuard'], 'Returns whether the successor link is non-null.');
const packetEvidence = 'PacketBuffer cursor and payload use in the primitive readers: the cursor advances after each indexed byte read.';
field('p', 'l', 'I', 'position', packetEvidence);
field('p', 'o', '[B', 'data', packetEvidence);
method('p', 'g', '(I)B', 'readByte', ['obfuscationGuard'], 'Returns data[position] and advances the cursor by one.');
method('p', 'e', '(B)I', 'readInt', ['obfuscationGuard'], 'Advances the cursor by four and combines the bytes most significant first.');
method('ke', 'b', '(I)I', 'nextValue', ['obfuscationGuard'], 'Regenerates the batch when the countdown is exhausted, then returns the next stored result.');
method('nm', 'a', '(I)V', 'skip', ['sampleCount'], 'Abstract skip hook, called by b() instead of mixing when the stream is silenced.');
method('nm', 'b', '([III)V', 'mixOrSkip', ['buffer', 'offset', 'length'], 'Mixes into the buffer when enabled, otherwise skips the same length.');

export const chessConfig = {
  game: 'chess', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-chess-rules.mjs', 'reproduce-chess.mjs', 'reviewed-game.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Chess', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable.',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names; renames are naming only.`, '',
      'Reproduce with `node readable/build-chess-rules.mjs --check`, `node readable/reproduce-chess.mjs --update` and `--check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(chessConfig), file = path.join(workflowRoot, 'chess-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Chess rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
