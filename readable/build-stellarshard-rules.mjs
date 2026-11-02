import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Stellar Shard export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {
  gg: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, audio streams and hash-table entries.'],
  ah: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  oj: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with removal of the head.'],
  ug: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque to traverse its nodes.'],
  ai: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  ga: ['NodeHashTableIterator', 'Iterator over an IterableNodeHashTable that removes through the node.'],
  bg: ['DualLinkDeque', 'Iterable sentinel deque over DualLinkNode secondary links.'],
  s: ['DualLinkDequeIterator', 'Iterator constructed from a DualLinkDeque.'],
  ka: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, variable-length and primitive reads.'],
  wg: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  nl: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  bc: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  ac: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  ie: ['SpriteState', 'DualLinkNode subclass holding the full/trimmed dimension and offset integers.'],
  pb: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  ej: ['PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.'],
  fh: ['BufferedSocket', 'Runnable owning a Socket with input stream and buffered writer.'],
  be: ['MouseHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  fe: ['MouseWheelInput', 'Abstract wheel-input hook with component registration.'],
  hb: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  eb: ['KeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  hi: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  vi: ['RasterBuffer', 'Abstract int pixel array with width, height and AWT image.'],
  mh: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  m: ['JavaSoundAudioOutput', 'Audio output writing mixed samples to a javax.sound SourceDataLine.'],
  kd: ['PcmStream', 'Abstract IntrusiveNode producing int samples through a mix method.'],
};
const members = {};

export const config = {
  game: 'stellarshard', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-stellarshard-rules.mjs', 'reproduce-stellarshard.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Stellar Shard', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `stellarshard`; the shared engine (nodes, deques, packet buffer, sockets, sprites, audio) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'stellarshard-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Stellar Shard rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
