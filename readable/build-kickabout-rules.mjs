import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Kickabout export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  gn: ['IntrusiveNode', 'Same shared role as GeoBlox IntrusiveNode: long key plus two node links; base of most Kickabout objects.'],
  ah: ['GameAppletShell', 'Abstract Applet/Runnable with focus and window listeners; root of the Kickabout applet chain.'],
  iw: ['PacketBuffer', 'Same shared role as GeoBlox PacketBuffer: node subclass with byte payload, cursor and big-endian primitive/string/slice encodings.'],
  ml: ['CipherPacketBuffer', 'iw subclass owning the aq ISAAC generator for opcode encryption, matching the shared cipher buffer role.'],
  aq: ['IsaacRandom', 'Result and memory int arrays refilled in 256-word batches, and contains the golden-ratio seed constant; same role as shared IsaacRandom.'],
  ht: ['IterableNodeHashTable', 'Power-of-two array of circular IntrusiveNode buckets keyed by long, implementing Iterable.'],
  kc: ['IntrusiveNodeHashTable', 'Power-of-two circular IntrusiveNode buckets keyed by long with insert, lookup and bucket-order traversal.'],
  bs: ['ClientException', 'RuntimeException wrapper retaining the original cause and appended client context string.'],
};
const members = {};

export const kickConfig = {
  game: 'kickabout', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-kickabout-rules.mjs', 'reproduce-kickabout.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-applicable', note: 'No game-specific reconstruction or core fixture in this naming wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading Kickabout', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/kickabout-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      `Decompiler source commit: ${rules.generators.javaTools.commit}.`, ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(kickConfig), file = path.join(workflowRoot, 'kickabout-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Kickabout rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
