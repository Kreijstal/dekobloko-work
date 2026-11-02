import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Zombie Dawn export. Similar names in
// other FunOrb games are corroborating role evidence only.
const classes = {};
const members = {};
const cls = (original, name, evidence) => classes[original] = [name, evidence];
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};

cls('le', 'IntrusiveNode', 'Long key plus two reciprocal links; its unlink method splices neighbours together.');
cls('nb', 'DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.');
cls('ke', 'GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.');
cls('aj', 'ClientException', 'RuntimeException retaining a cause and context text.');
cls('h', 'MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.');
cls('tg', 'GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.');
cls('uc', 'MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.');
cls('ol', 'MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.');
cls('rm', 'DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.');
cls('wm', 'IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.');
cls('hl', 'NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.');
cls('ii', 'SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links.');
cls('ag', 'SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.');
cls('gm', 'BufferedSocket', 'Runnable owning a Socket with input/output streams and a byte buffer.');
cls('ec', 'PlatformTaskDispatcher', 'Runnable owning a Thread and queued tasks for sockets, reflection, frames and URLs.');

const node = 'IntrusiveNode unlink reciprocally patches field_d and field_b of its neighbours.';
field('le', 'd', 'Lle;', 'next', node);
field('le', 'b', 'Lle;', 'previous', node);
field('le', 'f', 'J', 'key', node);
method('le', 'b', '(I)V', 'unlink', node);

cls('vo', 'IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with add at both ends, count, isEmpty and clear.');
const deque = 'IntrusiveDeque splices nodes before or after its sentinel field_b.';
field('vo', 'b', 'Lle;', 'sentinel', deque);
method('vo', 'a', '(Lle;I)V', 'addLast', 'Links the node just before the sentinel.');
method('vo', 'a', '(ILle;)V', 'addFirst', 'Links the node just after the sentinel.');
method('vo', 'f', '(I)Lle;', 'removeLast', 'Unlinks and returns the node before the sentinel, or null when empty.');
method('vo', 'd', '(I)I', 'size', 'Walks previous links from the sentinel and counts the nodes.');
method('vo', 'a', '(B)Z', 'isEmpty', 'Compares the sentinel previous link with the sentinel itself.');
method('vo', 'b', '(I)V', 'clear', 'Unlinks every node until the sentinel is alone.');

cls('ik', 'AbstractAudioSample', 'IntrusiveNode base of PcmSample holding one int.');
cls('gi', 'PcmSample', 'AbstractAudioSample with a byte data array, three ints and a flag, constructed from data and loop bounds.');
cls('sp', 'PcmStream', 'Abstract IntrusiveNode defining fill, skip and a sibling substream link.');
cls('fn', 'PcmSampleStream', 'PcmStream stepping through sample bytes with interpolation kernels and loop handling.');
cls('fi', 'PcmMixer', 'PcmStream that mixes queued child streams into the output int buffer.');
cls('bi', 'Rasterizer', 'Final class of static pixel-buffer fill, line and blit kernels.');
cls('sh', 'ExceptionWrapper', 'Static wrapper that appends call signatures to a ClientException; also owns a worker thread.');
method('sh', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Laj;', 'wrapException',
  'Returns the existing ClientException with the context appended, or a new one.');

cls('kk', 'Point', 'Two ints constructed from (x, y); used for path nodes and camera targets.');
field('kk', 'l', 'I', 'x', 'First constructor argument is the horizontal grid coordinate.');
field('kk', 'h', 'I', 'y', 'Second constructor argument is the vertical grid coordinate.');
cls('wk', 'Camera', 'Holds the scroll origin printed as cam=(x, y) and maps world to screen coordinates.');
field('wk', 'u', 'I', 'x', 'The cheat overlay prints this as the first camera coordinate.');
field('wk', 'c', 'I', 'y', 'The cheat overlay prints this as the second camera coordinate.');
method('wk', 'a', '(IB)I', 'worldToScreenX', 'Renderers pass an entity x through it before subtracting the sprite offset.');
method('wk', 'a', '(II)I', 'worldToScreenY', 'Renderers pass an entity y through it before subtracting the sprite offset.');
cls('fb', 'WorldObject', 'Abstract positioned world object with extent fields and abstract render and update hooks.');
method('fb', 'a', '(Z)I', 'getX', 'Entity renderers pass this through the camera as the screen x.');
method('fb', 'f', '(I)I', 'getY', 'Entity renderers pass this through the camera as the screen y.');
cls('g', 'Mover', 'WorldObject subclass adding a state int and many per-entity int fields; ah and kd extend it.');
field('g', 'F', 'I', 'state', 'ah.k maps this value to IDLE, RUNNING, COWERING, AIMING and other state names.');
cls('ah', 'Human', 'Mover whose state names are IDLE, RUNNING, COWERING, SCREECHCOWER, AIMING, SHOOTING and KNOCKBACK.');
method('ah', 'k', '(B)Ljava/lang/String;', 'stateName', 'Switches over the state and returns IDLE, RUNNING, COWERING, AIMING or KNOCKBACK.');
cls('kd', 'Zombie', 'Mover spawned by the world, drawn with a selection ring and an infection target.');
cls('eo', 'HumanFactory', 'Chooses among Human subclasses wo, po and qk by a type index.');
method('eo', 'a', '(IIII)Lah;', 'createHuman', 'Returns new wo, po or qk instances depending on the type argument.');
cls('hi', 'GameWorld', 'Largest game class: owns the camera, the zombie list, the level map and the cheat overlay.');
method('hi', 'a', '(IBIII)Lkd;', 'spawnZombie', 'Creates a kd at a randomly offset position and adds it to the zombie list.');
cls('on', 'TileMap', 'Final class constructed from tile int arrays and queried per cell by the level map.');
cls('ej', 'LevelNavigation', 'Grid class of 24-pixel tiles building Point paths over a TileMap.');

export const config = {
  game: 'zombiedawn', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-zombiedawn-rules.mjs', 'reproduce-zombiedawn.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Zombie Dawn', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `ZombieDawn`; the shared engine (nodes, hash tables, sockets, input handlers) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'zombiedawn-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Zombie Dawn rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
