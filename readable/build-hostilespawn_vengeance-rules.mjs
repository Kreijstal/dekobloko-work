import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Hostile Spawn: Vengeance export.
// Similar names in other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  se: ['GameAppletShell', 'Applet/Runnable/focus/window listener base of the game applet; abstract client lifecycle hooks.'],
  d: ['NetworkGameClient', 'GameAppletShell subclass reading server, port, js5 and member applet parameters and owning login state.'],
  am: ['IntrusiveNode', 'Long key, previous/next links and unlink; same shared role as other FunOrb games.'],
  tj: ['PcmStream', 'Abstract IntrusiveNode with sub-stream link and abstract sample-mixing and skip contract.'],
  dk: ['DualLinkNode', 'IntrusiveNode with an independent secondary key and link; same shared role as other FunOrb games.'],
  ui: ['DualLinkDeque', 'Iterable deque anchored on a DualLinkNode sentinel.'],
  ed: ['IntrusiveNodeHashTable', 'Bucket array of IntrusiveNode sentinels with key lookup and insertion.'],
  vi: ['PacketBuffer', 'IntrusiveNode holding a byte array and cursor with big-endian primitives and BigInteger RSA block encoding.'],
  en: ['CipherPacketBuffer', 'PacketBuffer subclass holding an Isaac generator for opcode encryption.'],
  gi: ['IsaacGenerator', 'ISAAC state arrays seeded with the 0x9e3779b9 golden-ratio constant.'],
  gb: ['ResourceArchive', 'Synchronized archive reading groups and files through an ArchiveProvider and cached byte arrays.'],
  uk: ['ArchiveProvider', 'Abstract source of encoded archive groups, index and progress.'],
  wc: ['ArchiveIndex', 'Per-group and per-file id, size and digest arrays describing an archive.'],
  jg: ['KeyboardInput', 'AWT key and focus listener class feeding held-key and key-event state.'],
  ci: ['MouseInput', 'AWT mouse and motion listener class retaining pointer position and button state.'],
  vc: ['GameCanvas', 'Canvas retaining a Component for painting.'],
};
const members = {};

export const hostileConfig = {
  game: 'hostilespawn_vengeance', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-hostilespawn_vengeance-rules.mjs', 'reproduce-hostilespawn_vengeance.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs', 'coverage-hostilespawn_vengeance.mjs'],
  // The shared workflow always calls verifyCore; this wave has no game-specific executable fixtures.
  verifyCore: async () => ({gameSpecificFixtures: 'none'}),
  readingGuide(rules, mapping) {
    return ['# Reading Hostile Spawn: Vengeance', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Names are class-level only; no algorithms were changed. Shared engine roles follow the Ace of Skies, GeoBlox and Escape Vector manifests where behavior matched.', ''].join('\n');
  },
};

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(hostileConfig), file = path.join(workflowRoot, 'hostilespawn_vengeance-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Hostile Spawn rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
