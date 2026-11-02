import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Flea Circus export. Similar names
// in other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  lh: ['IntrusiveNode', 'Base of nearly every pooled object; retains a long key and previous/next links, and a hash table chains it.'],
  li: ['IterableNodeHashTable', 'Array of IntrusiveNode bucket chains keyed by long, with Iterable support; same role as GeoBlox IterableNodeHashTable.'],
  na: ['NodeHashTableIterator', 'Iterator walking each bucket chain of the node hash table in turn.'],
  h: ['ContextualRuntimeException', 'RuntimeException subclass retaining a context string and the wrapped Throwable.'],
  cd: ['GameAppletShell', 'Abstract Applet with Runnable, focus and window listeners; resolves code base and applet context.'],
  wb: ['NetworkGameClient', 'Abstract GameAppletShell subclass retaining client connection and timing state; extended by the game applet.'],
  fleas: ['FleaCircusApplet', 'Public final applet class extending the client shell; owns the game loop, init and the large gameplay logic.'],
  rh: ['ResourceArchive', 'Holds packed groups and unpacked files over an index and a node hash table; same role as GeoBlox ResourceArchive.'],
  pa: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary key and previous/next link pair, unlinked separately by e().'],
  wf: ['SecondaryNodeDeque', 'Iterable sentinel deque that splices DualLinkNode instances through their secondary links.'],
  qa: ['UiComponent', 'Laid-out UI component retaining name, bounds, a layout object and a listener, sized by the layout at construction.'],
  ch: ['ComponentLayout', 'Interface implemented by layout classes; places a UiComponent given geometry arguments.'],
  td: ['BufferedSocket', 'Runnable with socket, input/output streams and a byte buffer; same role as GeoBlox BufferedSocket.'],
};
const members = {};

export const fleaConfig = {
  game: 'fleacircus', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-fleacircus-rules.mjs', 'reproduce-fleacircus.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({policy: 'none', note: 'No game-specific reconstruction or tests in this naming wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading Flea Circus', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/fleacircus-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `FleaCircusApplet`, which extends `NetworkGameClient` and `GameAppletShell`. Shared engine roles are matched to other games by reviewed behavior, not by obfuscated spelling.', '',
      'Reproduce with `node readable/build-fleacircus-rules.mjs --check`, `node readable/reproduce-fleacircus.mjs --update`, and `node readable/reproduce-fleacircus.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(fleaConfig), file = path.join(workflowRoot, 'fleacircus-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Flea Circus rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
