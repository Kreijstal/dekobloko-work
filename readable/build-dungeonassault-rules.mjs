import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Dungeon Assault export. Similar
// names in other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  ne: ['IntrusiveNode', 'Two sibling links, a long key, unlink and linked test; base of every queued object.'],
  ll: ['DualLinkNode', 'IntrusiveNode with an independent secondary link pair and key.'],
  md: ['IntrusiveDeque', 'Sentinel-based list of IntrusiveNode with insert, remove and directional traversal.'],
  ec: ['PacketBuffer', 'Byte payload and cursor with big-endian primitive, string and smart encodings.'],
  kg: ['GameAppletShell', 'Applet/Runnable with focus and window listeners and abstract lifecycle hooks.'],
  in: ['NetworkGameClient', 'GameAppletShell subclass reading gameport, servernum, gamecrc and js5 applet parameters and handling connect failures.'],
  qb: ['PcmStream', 'Linked PCM stream contract: substreams, sample mixing and skipping.'],
  b: ['ClientException', 'RuntimeException wrapper retaining the original cause and appended client context string.'],
  wj: ['CipherPacketBuffer', 'PacketBuffer subclass holding an opcode cipher and bit-level read/write operations.'],
  nh: ['ResourceArchive', 'Synchronized archive lookup of packed groups and files by id or name with byte[] retrieval and loading state.'],
  og: ['KeyboardInput', 'Implements KeyListener and FocusListener and records key events.'],
  mh: ['MouseInput', 'Implements MouseListener, MouseMotionListener and FocusListener and records pointer events.'],
  hb: ['Raider', 'The combat raider held by CombatState; its flag word marks incapacitated (2) and dead (4).'],
  va: ['PcmSample', 'Constructor retains signed byte data plus rate, loop bounds and a ping-pong flag; consumed by the sample stream.'],
  ni: ['PcmSampleStream', 'PcmStream over a PcmSample whose mixing loops interpolate signed bytes into an int buffer.'],
  ug: ['MidiPcmStream', 'PcmStream that splits MIDI status bytes into command (0xF0) and channel (0x0F) and mixes channel notes.'],
  pj: ['CombatState', 'Holds the combat raider and ability list; rejects null, incapacitated or dead raiders.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
field('ne', 'a', 'Lne;', 'next', 'Unlink joins field_a and field_e of the neighbours, so these are the two sibling links.');
field('ne', 'e', 'Lne;', 'previous', 'Unlink joins field_a and field_e of the neighbours, so these are the two sibling links.');
field('ne', 'h', 'J', 'key', 'Long node key carried by every intrusive node.');
method('ne', 'a', '(Z)V', 'unlink', ['obfuscationGuard'], 'Joins both neighbours then nulls own links.');
method('ne', 'c', '(I)Z', 'isLinked', ['obfuscationGuard'], 'Returns whether the forward link is non-null.');
field('ec', 'm', '[B', 'payload', 'Byte array indexed by the cursor in every read and write.');
field('ec', 'o', 'I', 'position', 'Cursor advanced by each primitive read and write.');
method('ec', 'a', '(II)V', 'writeByte', ['obfuscationGuard', 'value'], 'Stores one byte at the cursor and advances it.');
method('ec', 'i', '(II)V', 'writeShort', ['value', 'obfuscationGuard'], 'Stores high then low byte and advances the cursor by two.');
method('ec', 'a', '(JI)V', 'writeLong', ['value', 'obfuscationGuard'], 'Stores a long as consecutive big-endian bytes.');
method('ec', 'h', '(I)I', 'readInt', ['obfuscationGuard'], 'Advances four and assembles a big-endian int.');
method('ec', 'e', '(B)I', 'readSignedMedium', ['obfuscationGuard'], 'Reads three bytes and sign-extends values above 8388607.');
method('ec', 'b', '(B)J', 'readLong', ['obfuscationGuard'], 'Combines two unsigned ints into a long.');
method('ec', 'g', '(II)V', 'padWithZeros', ['obfuscationGuard', 'endPosition'], 'Writes zero bytes until the cursor reaches the end position.');
field('va', 'k', '[B', 'data', 'Sample stream indexes this byte array for length and interpolated reads.');
field('b', 'c', 'Ljava/lang/String;', 'context', 'Appended client context string.');
field('b', 'd', 'Ljava/lang/Throwable;', 'cause', 'Original throwable wrapped by the constructor.');

export const dungeonConfig = {
  game: 'dungeonassault', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-dungeonassault-rules.mjs', 'reproduce-dungeonassault.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({policy: 'names-only', gameplayTests: 'none in this wave'}),
  readingGuide(rules, mapping) {
    return ['# Reading Dungeon Assault', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/dungeonassault-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Reproduce with `node readable/build-dungeonassault-rules.mjs --check`, `node readable/reproduce-dungeonassault.mjs --update`, and `node readable/reproduce-dungeonassault.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(dungeonConfig), file = path.join(workflowRoot, 'dungeonassault-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Dungeon Assault rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
