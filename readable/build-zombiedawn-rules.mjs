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
cls('de', 'PacketBuffer', 'IntrusiveNode with a byte payload and cursor, big-endian primitive, string, CRC and RSA operations.');
const packet = 'PacketBuffer field_h payload and field_j cursor; every read and write indexes through them.';
field('de', 'h', '[B', 'payload', packet);
field('de', 'j', 'I', 'position', packet);
method('de', 'b', '(JI)V', 'writeLong40', 'Writes the low five bytes of the long with shifts 32, 24, 16, 8 and 0.');
method('de', 'd', '(I)Ljava/lang/String;', 'readString', 'Checks a leading zero byte, scans to the next zero and decodes the bytes.');
method('de', 'h', '(II)V', 'writeInt', 'Writes four bytes of the int with shifts 24, 16, 8 and 0.');
method('de', 'e', '(II)I', 'writeCrc32', 'Computes a checksum over the written bytes and appends it as an int.');
method('de', 'g', '(B)Z', 'verifyCrc32', 'Backs up four bytes, recomputes the checksum and compares it with the stored int.');
method('de', 'a', '(BLjava/lang/String;)V', 'writeTerminatedStringWithHeader', 'Writes a zero byte, the string bytes and a trailing zero byte.');
method('de', 'a', '(ILjava/lang/String;)V', 'writeTerminatedString', 'Writes the string bytes then a trailing zero byte; rejects embedded NUL.');
method('de', 'a', '(II[BI)V', 'readBytes', 'Copies a run of payload bytes into the supplied array advancing the cursor.');
method('de', 'a', '(IB)V', 'writeShort', 'Writes the value as two bytes, high byte first.');
method('de', 'i', '(II)V', 'writeByte', 'Writes one byte at the cursor and advances it.');
method('de', 'e', '(B)B', 'readByte', 'Returns the payload byte at the cursor and advances it.');
method('de', 'a', '(Ljava/math/BigInteger;ZLjava/math/BigInteger;)V', 'encryptRsa', 'Raises the written bytes to the exponent modulo the modulus and rewrites the result.');
method('de', 'b', '(II)V', 'padToPosition', 'Writes zero bytes until the cursor reaches the requested position.');
method('de', 'a', '(CLjava/lang/String;I)[Ljava/lang/String;', 'split', 'Splits a string at every occurrence of the separator character.');

cls('hd', 'SpriteState', 'DualLinkNode subclass holding the six full/trimmed dimension and offset ints.');
cls('vn', 'Sprite', 'SpriteState subclass owning an int pixel array with software blit kernels.');
cls('ra', 'DualLinkDeque', 'Circular deque of DualLinkNode with two cursors.');
cls('dj', 'Js5Archive', 'Caches Object[] groups by name and id and loads them from an underlying store.');
cls('rb', 'Font', 'DualLinkNode subclass with glyph arrays that draws strings and measures characters.');
cls('ga', 'UiWidget', 'IntrusiveNode base widget with text, listener and bounds fields whose toString prints <circular [0x...]>.');
method('hi', 'e', '(I)V', 'draw', 'Renders the world and prints the cam=(x, y) debug overlay and the Cheater! banner.');
method('hi', 'a', '(ICI)Z', 'handleKeyPress', 'Compares the key code against bound key constants and returns whether it was consumed.');
method('ZombieDawn', 'a', '(I)V', 'drawFrame', 'Draws the current screen, the progress bar and the Mem and FPS counters.');
method('ZombieDawn', 'a', '(ZZ)V', 'runTick', 'Increments the tick counter and recomputes screen metrics when the canvas size changes.');
method('hi', 'a', '(IZ)V', 'update', 'Advances the tick counter field_Z and runs the per-tick sub-updates when the game is active.');
field('hi', 'S', 'Lwk;', 'camera', 'The cheat overlay prints this object as cam=(x, y).');
field('hi', 'R', 'Lvo;', 'zombies', 'spawnZombie adds each new Zombie to this deque.');
field('hi', 'mb', 'Lon;', 'tileMap', 'Holds the TileMap passed to the LevelNavigation constructor.');
cls('fa', 'SpatialObject', 'DualLinkNode subclass with sibling fa links, stored in spatial grid buckets.');
cls('tf', 'SpatialBucket', 'Holds a head and tail fa and links or unlinks SpatialObject members.');
cls('mj', 'SpatialGrid', 'Array of SpatialBucket cells sized from the level extent shifted right by 7.');
cls('wb', 'FunOrbApplet', 'GameApplet subclass that reads the gameport, gamecrc, instanceid, member and lang applet parameters.');
const params = 'FunOrbApplet.a(String,IIII) parses this value from a named applet parameter.';
field('wb', 'q', 'I', 'gamePort1', params + ' Parameter gameport1.');
field('wb', 'w', 'I', 'gamePort2', params + ' Parameter gameport2.');
field('wb', 'n', 'I', 'serverNumber', params + ' Parameter servernum.');
field('wb', 'x', 'I', 'gameCrc', params + ' Parameter gamecrc.');
field('wb', 'p', 'J', 'instanceId', params + ' Parameter instanceid.');
field('wb', 'o', 'Z', 'isMember', params + ' Parameter member equals yes.');
field('wb', 'l', 'I', 'language', params + ' Parameter lang, reset to 0 when 5 or more.');
field('wb', 'v', 'I', 'affiliateId', params + ' Parameter affid.');
field('wb', 'u', 'Ljava/lang/String;', 'host', 'Set from getCodeBase().getHost().');
method('wb', 'a', '(Ljava/lang/String;IIII)V', 'readAppletParameters', 'Reads gameport1, gameport2, servernum, gamecrc, instanceid, member, lang and affid.');
cls('m', 'GameLoopApplet', 'Abstract FunOrbApplet implementing ib; owns the per-frame login, update and draw sequence and declares abstract game hooks.');
const move = 'Mover.c turns the target offset into a speed-scaled velocity.';
field('g', 'Y', 'I', 'targetX', 'Mover.c subtracts the own x from this field to get the horizontal offset.');
field('g', 'X', 'I', 'targetY', 'Mover.c subtracts the own y from this field to get the vertical offset.');
field('g', 'O', 'I', 'velocityX', move + ' Horizontal component.');
field('g', 'T', 'I', 'velocityY', move + ' Vertical component.');
field('g', 'W', 'I', 'speedScale', 'Mover.c multiplies the requested speed by this and divides by 4; the constructor sets it to 4.');
method('g', 'c', '(II)V', 'moveToward', 'Computes the normalized offset to the target and scales it into velocity fields.');
method('g', 'b', '(III)I', 'tileAtPixel', 'Divides both coordinates by 24 and indexes the tile int grid, returning 0 outside it.');
method('g', 'l', '(I)I', 'currentTile', 'Calls tileAtPixel with the own x and y.');
method('g', 'e', '(II)V', 'setState', 'Called with 0 for a Human and 4 otherwise, the values the constructor stores in state.');
cls('ib', 'GameLayer', 'Interface held in a Vector of layers; the game loop calls its tick, draw and key hooks on each one.');
method('ib', 'a', '(CII)Z', 'onKeyTyped', 'The game loop passes the typed character and key code to each layer until one returns true.');
method('m', 'o', '(I)V', 'onLoadingFinished', 'Called once after the preload completes; ZombieDawn then switches to the first menu screen.');

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
