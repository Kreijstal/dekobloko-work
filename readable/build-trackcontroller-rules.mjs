import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Track Controller export. Similar names
// in other FunOrb games are corroborating role evidence only.
const classes = {
  fc: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, streams and widgets.'],
  gb: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  be: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive, string and RSA operations.'],
  bc: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a byte buffer.'],
  uf: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for reflection, EventQueue and frames.'],
  hk: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  qc: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request through the proxy.'],
  re: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  cb: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  lj: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  bi: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  h: ['MouseWheelInput', 'Abstract wheel-input hook with component registration.'],
  te: ['DelegatingCanvas', 'Canvas whose paint forwards to another Component.'],
  ih: ['FullscreenFocusCanvas', 'Canvas with a Frame that records focus loss.'],
  nl: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  ga: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  ee: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  rj: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.'],
};
const members = {};

export const config = {
  game: 'trackcontroller', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-trackcontroller-rules.mjs', 'reproduce-trackcontroller.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Track Controller', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `TrackController`; the shared engine (nodes, hash tables, packet buffer, sockets, input) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'trackcontroller-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Track Controller rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
