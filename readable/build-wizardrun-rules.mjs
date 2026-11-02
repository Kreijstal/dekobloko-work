import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Wizard Run export. Similar roles in
// other FunOrb games are corroborating evidence only.
const classes = {
  wl: ['IntrusiveNode', 'Long key plus two links with a null-guarded unlink; base of most runtime objects.'],
  rk: ['DualLinkNode', 'IntrusiveNode subclass with an independent second link pair and long key.'],
  da: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  tf: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  oj: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  eb: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  cg: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  va: ['PacketBuffer', 'IntrusiveNode with a byte payload and cursor, big-endian reads, writes and strings.'],
  ti: ['IsaacRandom', 'Seeds with the golden-ratio constant -1640531527 over 256-entry int arrays.'],
  oi: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with forward and backward traversal.'],
  pf: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque that walks node.next until the sentinel.'],
  gj: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  wh: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  de: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
  kg: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  ib: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  ea: ['ProxySocketConnector', 'SocketConnector that consults the ProxySelector and issues the CONNECT request.'],
  hi: ['BufferedSocket', 'Runnable owning a Socket with input and output streams and a byte buffer.'],
  vh: ['PlatformTaskDispatcher', 'Runnable owning a Thread, reflection Method and EventQueue for platform tasks.'],
  gd: ['DelegatingCanvas', 'Canvas whose update and paint delegate to a wrapped Component.'],
  ta: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  nd: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
const node = 'unlink nulls the previous link and the isLinked test reads it.';
field('wl', 'b', 'Lwl;', 'next', node);
field('wl', 'c', 'Lwl;', 'previous', node);
field('wl', 'e', 'J', 'key', 'Long key of the intrusive node.');
method('wl', 'c', '(B)Z', 'isLinked', 'Returns whether the previous link is non-null.');
field('rk', 'i', 'Lrk;', 'secondaryNext', 'unlink rewires this link on the neighbour.');
field('rk', 'l', 'Lrk;', 'secondaryPrevious', 'unlink null-checks and rewires this link.');
field('rk', 'o', 'J', 'secondaryKey', 'Long key of the second node level.');
field('va', 'k', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('va', 'm', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
method('rk', 'b', '(Z)V', 'unlink', 'Splices the node out of its neighbours and nulls both links.');

export const config = {
  game: 'wizardrun', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-wizardrun-rules.mjs', 'reproduce-wizardrun.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Wizard Run', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `wizardrun`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'wizardrun-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Wizard Run rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
