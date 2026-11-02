import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities belong to the pinned Sol Knight export. Similar names in other
// FunOrb games are corroborating role evidence only.
const classes = {
  gg: ['IntrusiveNode', 'Long key plus two reciprocal links and unlink, the shared intrusive node role.'],
  gb: ['PacketBuffer', 'IntrusiveNode subclass with byte payload, cursor, big-endian primitives, strings and BigInteger RSA.'],
  ug: ['SocketConnector', 'Abstract holder of host and port that creates a java.net.Socket.'],
  ve: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  dh: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners; main class SolKnight extends it via ab.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const node = 'IntrusiveNode link fields and unlink body; callers splice nodes in deques and tables.';
for (const [original, descriptor, to] of [['a', 'Lgg;', 'next'], ['d', 'Lgg;', 'previous'], ['g', 'J', 'key']])
  field('gg', original, descriptor, to, node);
method('gg', 'c', '(I)V', 'unlink', ['obfuscationGuard'], node);
method('gg', 'a', '(Z)Z', 'isLinked', ['obfuscationGuard'], node);

const packet = 'PacketBuffer field_l payload and field_m cursor; reviewed big-endian shifts/masks and cursor increments.';
for (const [original, descriptor, to] of [['l', '[B', 'payload'], ['m', 'I', 'position']])
  field('gb', original, descriptor, to, packet);
for (const [original, descriptor, to, names] of [
  ['j', '(I)I', 'readUnsignedByte', ['obfuscationGuard']], ['a', '(B)B', 'readByte', ['obfuscationGuard']],
  ['i', '(I)I', 'readUnsignedShort', ['obfuscationGuard']], ['b', '(Z)I', 'readUnsignedMedium', ['obfuscationGuard']],
  ['e', '(Z)I', 'readInt', ['obfuscationGuard']], ['a', '(I)J', 'readLong', ['obfuscationGuard']],
  ['h', '(I)Ljava/lang/String;', 'readString', ['obfuscationGuard']],
  ['<init>', '([B)V', '', ['payload']], ['<init>', '(I)V', '', ['capacity']],
]) method('gb', original, descriptor, to, names, packet);

export const config = {
  game: 'solknight', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-solknight-rules.mjs', 'reproduce-solknight.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Sol Knight', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `SolKnight`; the shared engine (nodes, packet buffer, sockets, applet shell) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'solknight-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Sol Knight rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
