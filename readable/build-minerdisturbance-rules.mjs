import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Miner Disturbance export. Similar
// names in other games are corroborating role evidence, never copied IDs.
const classes = {
  pi: ['IntrusiveNode', 'Two node links and a long key, subclassed by most pooled objects; same shared role as Ace IntrusiveNode.'],
  al: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and key, unlinked separately.'],
  ta: ['IntrusiveDeque', 'Holds a sentinel pi and a traversal cursor; same shared role as Ace IntrusiveDeque.'],
  db: ['ClientException', 'RuntimeException retaining the original Throwable and an appended context string.'],
  dc: ['GameCanvas', 'Canvas retaining a Component and forwarding paint and update callbacks.'],
  m: ['GameAppletShell', 'Applet/Runnable with focus and window listeners and abstract init/render hooks; creates the GameCanvas.'],
  l: ['FullscreenFocusCanvas', 'Canvas with focus listener that owns a Frame for fullscreen presentation.'],
  eh: ['SoftwareRasterizer', 'Global integer framebuffer with static width, height, clip bounds and software drawing primitives.'],
  ea: ['Sprite', 'Software RGB pixel array with transparent-zero blits, scaling and rotation.'],
  og: ['ArgbSprite', 'Sprite subclass whose blits use per-pixel high-byte alpha.'],
  hi: ['SpriteState', 'Sprite base retaining full and trimmed dimensions and trim offsets.'],
  bj: ['ResourceArchive', 'Lazily loads groups from an ArchiveProvider using an ArchiveIndex, with packed and unpacked file caches.'],
  g: ['ArchiveIndex', 'Versioned group and file metadata: counts, ids, names and CRC/revision tables consumed by ResourceArchive.'],
  vb: ['ArchiveProvider', 'Abstract provider of the encoded index and groups consumed by ResourceArchive.'],
  sb: ['PacketBuffer', 'Byte array with cursor and big-endian primitive and slice encodings; same shared role as Ace PacketBuffer.'],
  ld: ['CipherPacketBuffer', 'PacketBuffer subclass with an IsaacRandom opcode cipher and bit cursor.'],
  mf: ['IsaacRandom', 'Result and state arrays seeded with the golden-ratio constant; ISAAC generator for packet opcodes.'],
  um: ['PcmStream', 'Abstract linked PCM stream contract: next stream, mixer owner and sample mixing.'],
};
const members = {};

export const config = {
  game: 'minerdisturbance', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-minerdisturbance-rules.mjs', 'reproduce-minerdisturbance.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Miner Disturbance', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the reverse dictionary is ../../decompilation/minerdisturbance-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed shared-engine classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'The applet chain is `GameAppletShell` (m) extended by an unnamed client class (ob) extended by `MinerDisturbance`. Roles follow behavior and match counterparts in other FunOrb games, not their obfuscated spelling.', '',
      'Reproduce with `node readable/build-minerdisturbance-rules.mjs --check`, `node readable/reproduce-minerdisturbance.mjs --update`, and `node readable/reproduce-minerdisturbance.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'minerdisturbance-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Miner Disturbance rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
