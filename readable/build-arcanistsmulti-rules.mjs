import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity belongs to the pinned Arcanists Multi export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  pg: ['IntrusiveNode', 'Same shared role as Ace IntrusiveNode: long key, two links and unlink; vn and the game lists link it.'],
  tf: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary key/link pair, used by the hash table mo and list tg.'],
  vn: ['IntrusiveDeque', 'Circular sentinel list of IntrusiveNode with directional traversal, insertion, removal and clear.'],
  mo: ['IntrusiveNodeHashTable', 'Power-of-two bucket array of DualLinkNode sentinels with key put, lookup and duplicate-key traversal.'],
  dc: ['GameAppletShell', 'Applet/Runnable lifecycle with focus, key and window listeners and abstract client hooks.'],
  wk: ['PacketBuffer', 'Byte payload and cursor with big-endian primitive reads and writes, strings and RSA block encryption.'],
  ab: ['CipherPacketBuffer', 'PacketBuffer with an ISAAC opcode cipher and a separate bit-position cursor.'],
  ug: ['IsaacCipher', 'ISAAC generator: 256-word state, xorshift mixing and a countdown of buffered results.'],
  p: ['ClientException', 'RuntimeException wrapper retaining the original cause and appended client context.'],
  qb: ['Sprite', 'Software RGB pixel array sprite with trim offsets and clipped blits.'],
  jb: ['SpriteState', 'Abstract linked sprite base holding full and trimmed dimensions plus trim offsets.'],
  ll: ['IndexedSprite', 'Indexed byte pixels with an RGB palette; extends the indexed sprite state.'],
  s: ['IndexedSpriteState', 'Abstract dimensions and trim offsets shared by indexed sprites.'],
  eg: ['ResourceArchive', 'Packed and unpacked group storage with an archive provider, index and retention mode 0..2.'],
  tl: ['ArchiveProvider', 'Abstract provider consumed by the ResourceArchive constructor.'],
  jk: ['ArchiveIndex', 'Archive metadata with per-group byte tables and name lookup.'],
  sg: ['PcmStream', 'Linked abstract PCM stream with a volatile active flag and int-buffer mixing hooks.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const nodeEvidence = 'Reviewed shared intrusive node link ownership and unlink; deque insertion and traversal confirm direction.';
field('pg', 'b', 'Lpg;', 'next', nodeEvidence); field('pg', 'a', 'Lpg;', 'previous', nodeEvidence); field('pg', 'e', 'J', 'key', nodeEvidence);
method('pg', 'a', '(Z)V', 'unlink', ['obfuscationGuard'], nodeEvidence);
method('pg', 'b', '(B)Z', 'isLinked', ['obfuscationGuard'], nodeEvidence);
const dualEvidence = 'DualLinkNode links are independent of IntrusiveNode links; the hash table and list traverse them.';
field('tf', 'k', 'J', 'secondaryKey', dualEvidence); field('tf', 'l', 'Ltf;', 'secondaryNext', dualEvidence); field('tf', 'i', 'Ltf;', 'secondaryPrevious', dualEvidence);
method('tf', 'a', '(B)V', 'unlinkSecondary', ['obfuscationGuard'], dualEvidence);
method('tf', 'd', '(B)Z', 'isSecondaryLinked', ['obfuscationGuard'], dualEvidence);
const dequeEvidence = 'IntrusiveDeque constructor builds a self-linked sentinel; insertion and traversal use next and previous.';
field('vn', 'e', 'Lpg;', 'sentinel', dequeEvidence); field('vn', 'h', 'Lpg;', 'traversalCursor', dequeEvidence);
for (const [original, descriptor, to, names] of [
  ['a', '(Lpg;B)V', 'addFirst', ['node', 'obfuscationGuard']], ['b', '(Lpg;I)V', 'addLast', ['node', 'obfuscationGuard']],
  ['b', '(I)Lpg;', 'first', ['obfuscationGuard']], ['a', '(Z)Lpg;', 'last', ['obfuscationGuard']],
  ['a', '(I)Lpg;', 'next', ['obfuscationGuard']], ['b', '(B)Lpg;', 'previous', ['obfuscationGuard']],
  ['c', '(Z)Lpg;', 'removeFirst', ['obfuscationGuard']], ['d', '(Z)Lpg;', 'removeLast', ['obfuscationGuard']],
  ['b', '(Z)Z', 'isEmpty', ['obfuscationGuard']], ['c', '(I)V', 'clear', ['obfuscationGuard']],
]) method('vn', original, descriptor, to, names, dequeEvidence);
const tableEvidence = 'Hash table masks the key with bucket count minus one, inserts before the bucket sentinel and walks equal keys.';
field('mo', 'n', '[Ltf;', 'buckets', tableEvidence); field('mo', 'e', 'I', 'bucketCount', tableEvidence); field('mo', 'i', 'I', 'traversalIndex', tableEvidence);
method('mo', 'a', '(Ltf;JB)V', 'put', ['node', 'key', 'obfuscationGuard'], tableEvidence);
method('mo', 'a', '(JB)Ltf;', 'get', ['key', 'obfuscationGuard'], tableEvidence);
method('mo', 'd', '(I)Ltf;', 'getNextWithSameKey', ['obfuscationGuard'], tableEvidence);
const shellEvidence = 'dc.run calls e once after setup, c each timing-loop tick, d at shutdown and f in static release.';
method('dc', 'e', '(B)V', 'initializeClient', ['obfuscationGuard'], shellEvidence);
method('dc', 'c', '(B)V', 'updateClient', ['obfuscationGuard'], shellEvidence);
method('dc', 'd', '(B)V', 'shutdownClient', ['obfuscationGuard'], shellEvidence);
method('dc', 'f', '(B)V', 'releaseClientStatics', ['obfuscationGuard'], shellEvidence);
const packet = 'Reviewed byte shifts, masks, cursor updates and big-endian order in the packet buffer.';
field('wk', 'j', '[B', 'payload', packet); field('wk', 'g', 'I', 'position', packet);
for (const [original, descriptor, to, names] of [
  ['f', '(IB)V', 'writeByte', ['value', 'obfuscationGuard']], ['c', '(IB)V', 'writeShort', ['value', 'obfuscationGuard']],
  ['a', '(BI)V', 'writeMedium', ['obfuscationGuard', 'value']], ['a', '(IB)V', 'writeInt', ['value', 'obfuscationGuard']],
  ['a', '(BJ)V', 'writeFiveByteValue', ['obfuscationGuard', 'value']], ['b', '(II)V', 'writeVarInt', ['obfuscationGuard', 'value']],
  ['e', '(B)I', 'readUnsignedByte', ['obfuscationGuard']], ['o', '(I)B', 'readByte', ['obfuscationGuard']],
  ['n', '(I)I', 'readUnsignedShort', ['obfuscationGuard']], ['m', '(I)I', 'readSignedShort', ['obfuscationGuard']],
  ['h', '(I)I', 'readUnsignedMedium', ['obfuscationGuard']], ['d', '(I)I', 'readInt', ['obfuscationGuard']],
  ['c', '(I)J', 'readLong', ['obfuscationGuard']], ['a', '(I)I', 'readVarInt', ['obfuscationGuard']],
  ['l', '(I)Ljava/lang/String;', 'readString', ['obfuscationGuard']], ['g', '(I)Ljava/lang/String;', 'readOptionalString', ['obfuscationGuard']],
  ['a', '(II)V', 'writeShortLengthAtMark', ['length', 'obfuscationGuard']],
  ['c', '(II)V', 'writeIntLengthAtMark', ['obfuscationGuard', 'length']],
  ['b', '(IB)V', 'writeByteLengthAtMark', ['length', 'obfuscationGuard']],
  ['e', '(IB)V', 'padTo', ['endPosition', 'obfuscationGuard']],
]) method('wk', original, descriptor, to, names, packet);
const cipher = 'CipherPacketBuffer offsets each opcode byte by the next ISAAC value and tracks a bit cursor for packed reads.';
field('ab', 'o', 'Lug;', 'opcodeCipher', cipher); field('ab', 't', 'I', 'bitPosition', cipher);
method('ab', 'b', '(BI)V', 'writeOpcode', ['obfuscationGuard', 'opcode'], cipher);
method('ab', 'g', '(B)I', 'readOpcode', ['obfuscationGuard'], cipher);
method('ab', 'd', '(II)I', 'readBits', ['obfuscationGuard', 'bitCount'], cipher);
method('ab', 'p', '(I)V', 'beginBitAccess', ['obfuscationGuard'], cipher);
method('ab', 'r', '(I)V', 'endBitAccess', ['obfuscationGuard'], cipher);
method('ab', 'b', '(I[I)V', 'installCipher', ['obfuscationGuard', 'seed'], cipher);
method('ug', 'a', '(Z)I', 'nextValue', ['obfuscationGuard'], 'Returns buffered results from the end, regenerating 256 words when the count reaches zero.');
field('p', 'g', 'Ljava/lang/Throwable;', 'cause', 'Constructor retains the wrapped throwable.');
field('p', 'i', 'Ljava/lang/String;', 'context', 'Constructor retains the appended context string.');

// Reviewed names added in later rounds live in arcanistsmulti-names.json:
// classes [owner, name, evidence], methods and fields [owner, original, descriptor, name, evidence].
const reviewedNames = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'arcanistsmulti-names.json'), 'utf8'));
for (const [owner, to, evidence] of reviewedNames.classes) {
  if (classes[owner]) throw new Error('Class already reviewed: ' + owner);
  classes[owner] = [to, evidence];
}
for (const [owner, original, descriptor, to, evidence] of reviewedNames.methods) {
  const symbol = `M:${owner}.${original}${descriptor}`;
  if (members[symbol]) throw new Error('Method already reviewed: ' + symbol);
  members[symbol] = {to, evidence};
}
for (const [owner, original, descriptor, to, evidence] of reviewedNames.fields) members[`F:${owner}.${original}:${descriptor}`] = {to, evidence};
// parameters [owner, original, descriptor, [name per ordinal or null to keep], evidence].
for (const [owner, original, descriptor, names, evidence] of reviewedNames.parameters ?? []) {
  for (const [ordinal, to] of names.entries()) if (to) members[`P:${owner}.${original}${descriptor}#${ordinal}`] = {to, evidence};
}

export const arcanistsConfig = {
  game: 'arcanistsmulti', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-arcanistsmulti-rules.mjs', 'arcanistsmulti-names.json', 'reproduce-arcanistsmulti.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-applicable', reason: 'naming-only pass without game-specific reconstructions'}),
  readingGuide(rules, mapping) {
    return ['# Reading Arcanists Multi', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Reproduce with `node readable/build-arcanistsmulti-rules.mjs --check` and `node readable/reproduce-arcanistsmulti.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(arcanistsConfig), file = workflowRoot + '/arcanistsmulti-rules.json';
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Arcanists rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
