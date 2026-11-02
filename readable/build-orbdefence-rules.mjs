import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities belong to the pinned Orb Defence export; other games' names are
// corroborating role evidence only, never copied obfuscated identifiers.
const classes = {
  tf: ['GameAppletShell', 'Abstract Applet implementing Runnable and focus/window listeners; owns the run loop and abstract init/update/shutdown hooks.'],
  ca: ['IntrusiveNode', 'Base node with two reciprocal links and a long key; most runtime containers and widgets extend it.'],
  o: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and key, with its own unlink.'],
  al: ['DelegatingCanvas', 'Canvas that stores a Component and forwards paint and update callbacks.'],
  ea: ['FullscreenFocusCanvas', 'Canvas with a FocusListener that owns a Frame and a volatile focus-loss flag.'],
  qh: ['KeyboardListener', 'KeyListener and FocusListener with synchronized key press, release and focus-lost handlers.'],
  gk: ['MouseInputListener', 'Synchronized mouse, motion and focus listener for the game canvas.'],
  ij: ['ImageProducerRasterBuffer', 'RasterBuffer subclass implementing ImageProducer that hands its pixels to an ImageConsumer.'],
  fh: ['RasterBuffer', 'Owns width, height, an int pixel array and a java.awt.Image; base of the ImageProducer buffer.'],
  qe: ['DualLinkDeque', 'Iterable circular deque of DualLinkNode with sentinel, add and iterator.'],
  ol: ['DualLinkDequeIterator', 'Iterator that walks a DualLinkDeque through its secondary links.'],
  ek: ['IterableNodeHashTable', 'Iterable table of IntrusiveNode buckets with long-key put and lookup.'],
  pl: ['NodeHashTableIterator', 'Iterator over the bucket chains of an IterableNodeHashTable.'],
  ph: ['NetworkGameClient', 'Abstract subclass of GameAppletShell holding shared client and connection state.'],
};
const members = {};
export const orbDefenceConfig = {
  game: 'orbdefence', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-orbdefence-rules.mjs', 'reproduce-orbdefence.mjs', 'reviewed-game.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-applicable', reason: 'naming-only pass; no gameplay reconstruction'}),
  readingGuide(rules, mapping) {
    return ['# Reading Orb Defence', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the reverse dictionary is ../../decompilation/orbdefence-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes and ${Object.keys(members).length} members in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Reproduce with `node readable/build-orbdefence-rules.mjs --check`, `node readable/reproduce-orbdefence.mjs --update`, and `node readable/reproduce-orbdefence.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(orbDefenceConfig), file = path.join(workflowRoot, 'orbdefence-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Orb Defence rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
