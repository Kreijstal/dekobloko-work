import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// IDs are local to the pinned Crazy Crystals export. Similar roles in other
// games corroborate behavior, never the spelling of an obfuscated ID.
const classes = {
  jb: ['IntrusiveNode', 'Long key with two links and a self-unlink; the base of every queue and hash-table entry here.'],
  ij: ['DualLinkNode', 'IntrusiveNode subclass with an independent second key/link pair and a secondary-only unlink.'],
  km: ['SecondaryIntrusiveDeque', 'Holds two ij sentinels and walks/inserts/removes DualLinkNode entries.'],
  ug: ['IntrusiveNodeHashTable', 'Bucket array of jb sentinels with long-key lookup and insertion.'],
  ii: ['NodeHashTableIterator', 'Iterator over an IntrusiveNodeHashTable bucket by bucket.'],
  ng: ['PacketBuffer', 'Byte payload with a cursor and big-endian primitive/string read and write helpers.'],
  md: ['CipherPacketBuffer', 'PacketBuffer subclass holding an ISAAC generator for ciphered opcodes and a bit cursor.'],
  bm: ['IsaacRandom', 'Private result and state int arrays with mixing used as the opcode cipher of md.'],
  wa: ['GameAppletShell', 'Applet and Runnable with focus/window listeners and abstract start, run and paint hooks.'],
  eb: ['NetworkGameClient', 'GameAppletShell subclass with connection and account state; parent of the CrazyCrystals applet.'],
  pg: ['GameCanvas', 'Canvas wrapping a Component and forwarding paint and update.'],
  a: ['MouseInputHandler', 'Mouse and focus listener recording pointer position and button events.'],
  vf: ['KeyboardInputHandler', 'Key and focus listener recording key presses and releases.'],
};
const members = {};

export const crazyConfig = {
  game: 'crazycrystals', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-crazycrystals-rules.mjs', 'reproduce-crazycrystals.mjs', 'reviewed-game.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures in this wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading Crazy Crystals', '',
      'This is the only published Java tree. Reviewed rules and the reproducer live in dekobloko-work/readable. The reverse dictionary is ../../decompilation/crazycrystals-naming.json.', '',
      `This pass reviews ${Object.keys(classes).length} class identities across ${mapping.files.length} compiled classes. Unreviewed names keep their original spelling. Naming only; no code was changed.`, '',
      'Reproduce with `node readable/build-crazycrystals-rules.mjs --check`, `node readable/reproduce-crazycrystals.mjs --update` and `--check`.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(crazyConfig), file = path.join(workflowRoot, 'crazycrystals-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Crazy Crystals rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
