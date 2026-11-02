import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities belong to the pinned Confined export. Similar names in other games
// are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  ec: ['ClientException', 'RuntimeException wrapper retaining the original Throwable and appended client context string.'],
  rk: ['IntrusiveNode', 'Same shared role as Ace IntrusiveNode: long key, two links and unlink.'],
  jl: ['DualLinkNode', 'Same shared role as Ace DualLinkNode: IntrusiveNode with an independent secondary key/link pair and secondary-only unlink.'],
  gj: ['GameCanvas', 'Canvas retaining the owning Frame and a focus-lost flag, with empty paint/update callbacks.'],
  te: ['GameAppletShell', 'Applet/Runnable with window and focus listeners, loader-applet hooks and abstract init/update/render client callbacks.'],
  bg: ['KeyboardInput', 'Synchronized KeyListener/FocusListener recording key presses, releases and focus loss.'],
  bh: ['MouseInput', 'Synchronized mouse and motion listener recording button, position and drag state, cleared on focus loss.'],
  fc: ['IsaacRandom', 'Seeded int[] state with a 256-style mix pass and next-value method, the shared ISAAC generator.'],
  gh: ['IntrusiveNodeHashTable', 'Iterable bucket array of IntrusiveNode with key lookup and insertion; same shared role as Ace IntrusiveNodeHashTable.'],
  o: ['IntrusiveNodeHashTableIterator', 'Iterator walking the bucket array and chains of an IntrusiveNodeHashTable.'],
  kg: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive/string writers and RSA block encryption; same shared role as Ace PacketBuffer.'],
  hb: ['CipherPacketBuffer', 'PacketBuffer retaining an IsaacRandom used to offset outgoing opcodes; same shared role as Ace CipherPacketBuffer.'],
  lm: ['IntrusiveDeque', 'Iterable sentinel list of DualLinkNode with insertion and removal; same shared role as Ace IntrusiveDeque.'],
};
const members = {};

export const confinedConfig = {
  game: 'confined', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-confined-rules.mjs', 'reproduce-confined.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({scope: 'naming only; no gameplay reconstruction in this pass'}),
  readingGuide(rules, mapping) {
    return ['# Reading Confined', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Shared engine roles match other games by reviewed behavior, not by short obfuscated spelling.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(confinedConfig), file = path.join(workflowRoot, 'confined-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Confined rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
