import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Pixelate export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {
  fa: ['IntrusiveNode', 'Long key plus bucket/chain link fields; base of the hash-table and deque nodes.'],
  lm: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair.'],
  kl: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode chains keyed by long, implementing Iterable.'],
  sh: ['NodeHashTableIterator', 'Iterator walking the bucket chains of an IterableNodeHashTable.'],
  pg: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel head.'],
  nb: ['SecondaryNodeDequeIterator', 'Iterator walking the secondary links of a SecondaryNodeDeque.'],
  qa: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  uf: ['ProxyAuthenticationException', 'IOException subclass constructed with a message string.'],
  hk: ['DelegatingCanvas', 'Canvas forwarding paint and update to a wrapped component.'],
  mk: ['FullscreenFocusCanvas', 'Canvas with FocusListener that owns a frame for fullscreen switching.'],
  wj: ['MouseWheelInput', 'Accumulates MouseWheelEvent rotation and attaches/detaches the listener.'],
  tn: ['GameApplet', 'Abstract Applet implementing Runnable and focus listener; Pixelate extends it via lb.'],
};
const members = {};

export const config = {
  game: 'pixelate', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-pixelate-rules.mjs', 'reproduce-pixelate.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Pixelate', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Pixelate`; the shared engine (nodes, hash tables, canvases, applet shell) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'pixelate-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Pixelate rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
