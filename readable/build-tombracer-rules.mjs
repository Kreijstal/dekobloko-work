import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Tomb Racer export; names from other games are corroborating role evidence only.
const classes = {
  vg: ['IntrusiveNode', 'Long key plus two reciprocal links and an unlink method, subclassed by widgets and buffers.'],
  be: ['SocketConnector', 'Abstract holder of host and port whose abstract method creates a Socket.'],
  qb: ['ProxySocketConnector', 'SocketConnector that consults a ProxySelector.'],
  jna: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners; base of the applet shell.'],
  hua: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  qaa: ['MouseWheelInput', 'Abstract wheel-input hook subclassed by the MouseWheelListener implementation.'],
  hfa: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  he: ['DelegatingCanvas', 'Canvas that forwards paint to a wrapped Component.'],
  od: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key that hma splices.'],
  sk: ['IterableNodeHashTable', 'Power-of-two bucket array of IntrusiveNode sentinels keyed by long with an iterator.'],
  nd: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  hma: ['SecondaryNodeDeque', 'Iterable sentinel deque of DualLinkNode secondary links with poll and clear.'],
  rba: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  uia: ['PacketBuffer', 'IntrusiveNode with a byte payload and cursor, big-endian reads and writes and BigInteger RSA.'],
  kh: ['BitPacketBuffer', 'PacketBuffer subclass adding a bit cursor writer and ISAAC-offset byte reads.'],
  gt: ['GameKeyHandler', 'Implements KeyListener and FocusListener with synchronized callbacks.'],
  ml: ['RandomAccessFileHandle', 'Wraps a RandomAccessFile with long read and write positions.'],
  kta: ['AudioOutput', 'Owns an int mix buffer and output stream; extended by the SourceDataLine implementation.'],
  bu: ['JavaSoundAudioOutput', 'AudioOutput backed by a javax.sound SourceDataLine and AudioFormat.'],
  fia: ['PlatformTaskDispatcher', 'Runnable owning a Thread that runs reflection, URL and cursor requests for the applet.'],
  jqa: ['BufferedSocket', 'Runnable owning a Socket with input and output streams.'],
  naa: ['AsyncRequest', 'Request handle with volatile status and result completed by the dispatcher thread.'],
  lr: ['ClientException', 'RuntimeException keeping a cause and context text that tba.a builds for every wrapped call.'],
  ug: ['AppletGameShell', 'GameApplet subclass reading servernum, gamecrc, instanceid, member and lang parameters and reporting js5 errors.'],
  la: ['Room', 'toString prints "Room(courseIndex:...,id:...)"; owns the projectile list printed by its debug dump.'],
  hca: ['Player', 'toString prints "(Player x= y= vx= vy=)".'],
  fsa: ['Trap', 'Label logic picks "Compound Trap", "Empty Trap" or "Regular Trap".'],
  ep: ['Projectile', 'toString prints "Projectile (x=, y=, vx=, vy=, angle=, endSize=)".'],
  lka: ['EventFactory', 'Single static method reading an event from a stream; "Event type unrecognised" on a bad id.'],
  dt: ['PlayerSimulation', 'Holds the tick counter, Player and rooms; prints "DUMPING STATE on tick" and "Player:".'],
  ff: ['MatchState', 'Holds per-player dt simulations and the Player array; throws "Could not resync player to room".'],
  bs: ['GameEvent', 'Abstract event written to a kh with a type id and applied to a dt; lka reads it by type.'],
  pi: ['PendingEvent', 'toString prints PendingEvent(instigator, course, room, start, duration).'],
  wca: ['SpriteState', 'DualLinkNode subclass holding six int dimension and offset fields.'],
  iu: ['Sprite', 'SpriteState subclass owning an int pixel array with static blit kernels.'],
  ha: ['GraphicsToolkit', 'Abstract base of the graphics backends; extended by the OpenGL, Direct3D and software toolkits.'],
  cka: ['OpenGlToolkit', 'ha subclass issuing jaggl.OpenGL calls throughout.'],
  cta: ['Direct3DToolkit', 'eo subclass issuing jagdx calls throughout.'],
  da: ['GameFont', 'Abstract font drawing chars and strings, subclassed per backend.'],
  eg: ['OpenGlFont', 'GameFont subclass constructed from the OpenGL toolkit cka.'],
  jga: ['TextResourceLoader', 'Static loader resolving keys such as playtutorial into string fields.'],
  vna: ['IntrusiveDeque', 'Sentinel deque of IntrusiveNode splicing next and previous links.'],
  nv: ['Behaviour', 'Base class bda instantiates per type id, throwing "Unrecognised behaviour type".'],
  wda: ['Locomotor', 'Base class ki instantiates per type id, throwing "Unrecognised locomotor type".'],
  ib: ['Spawner', 'Abstract class pha reads per type id, throwing "Unrecognised spawner type".'],
  csa: ['RoomComponent', 'Abstract node rn instantiates per type id, throwing "Unrecognised component type".'],
  loa: ['MazeGenerator', 'Abstract class lba instantiates per type id, throwing "Unrecognised maze gen type".'],
  qea: ['IsaacCipher', 'Two int arrays and counters, the ISAAC generator seeded with the golden-ratio constant.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const node = 'IntrusiveNode unlink body splices field_e and field_a of its neighbours.';
field('vg', 'a', 'Lvg;', 'next', node);
field('vg', 'e', 'Lvg;', 'previous', node);
field('vg', 'd', 'J', 'key', node);
field('be', 'a', 'Ljava/lang/String;', 'host', 'SocketConnector holds the host string handed to the Socket factory.');
field('be', 'b', 'I', 'port', 'SocketConnector holds the port handed to the Socket factory.');
field('uia', 'g', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('uia', 'h', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');
field('od', 'f', 'Lod;', 'secondaryPrevious', 'DualLinkNode unlink body sets field_f.field_g = field_g.');
field('od', 'g', 'Lod;', 'secondaryNext', 'DualLinkNode unlink body sets field_g.field_f = field_f.');
field('od', 'j', 'J', 'secondaryKey', 'DualLinkNode getKey returns it and setKey throws while linked.');
field('sk', 'e', '[Lvg;', 'buckets', 'IterableNodeHashTable indexes this array by key & (size-1).');
field('sk', 'g', 'I', 'bucketCount', 'IterableNodeHashTable bucket count used as the key mask.');
field('hma', 'd', 'Lod;', 'sentinel', 'SecondaryNodeDeque poll takes sentinel.field_g.');
field('lr', 'd', 'Ljava/lang/String;', 'context', 'ClientException keeps the context text passed to its constructor.');
field('lr', 'a', 'Ljava/lang/Throwable;', 'cause', 'ClientException keeps the wrapped Throwable passed to its constructor.');
const player = 'Player.toString prints x, y, vx and vy in that order.';
for (const [original, to] of [['mb', 'x'], ['z', 'y'], ['H', 'velocityX'], ['d', 'velocityY']]) field('hca', original, 'I', to, player);
const projectile = 'Projectile.toString prints x, y, vx, vy, angle and endSize in that order.';
for (const [original, to] of [['u', 'x'], ['K', 'y'], ['s', 'velocityX'], ['y', 'velocityY'], ['H', 'angle'], ['v', 'endSize']])
  field('ep', original, 'I', to, projectile);
field('la', 'N', 'I', 'courseIndex', 'Room.toString prints it as courseIndex.');
field('la', 'x', 'I', 'id', 'Room.toString and the debug dump print it as the room id.');
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
method('vg', 'p', '(I)V', 'unlink', ['obfuscationGuard'], node);
method('vg', 'l', '(B)Z', 'isLinked', ['obfuscationGuard'], node);
method('od', 'c', '(I)V', 'unlinkSecondary', [], 'Unlinks the secondary pair field_f and field_g.');
method('od', 'd', '(I)Z', 'isSecondaryLinked', [], 'Returns whether field_f is non-null.');
method('od', 'a', '(ZJ)V', 'setSecondaryKey', [], 'Stores the key or throws RuntimeException while linked.');
method('od', 'e', '(I)J', 'getSecondaryKey', [], 'Returns field_j.');
const table = 'IterableNodeHashTable bodies index buckets by key & (size-1) and splice nodes before the bucket sentinel.';
method('sk', 'a', '(Lvg;BJ)V', 'put', [], table);
method('sk', 'a', '(I)V', 'clear', [], 'Unlinks every node from every bucket.');
method('sk', 'b', '(B)Lvg;', 'first', [], 'Resets the bucket cursor then returns the next node.');
method('sk', 'a', '(B)Lvg;', 'next', [], 'Advances the bucket cursor and returns the next node or null.');
method('sk', 'a', '(JZ)Lvg;', 'get', [], 'Walks the bucket for the key and returns the matching node.');
method('hma', 'a', '(B)V', 'clear', [], 'Unlinks every node after the sentinel.');
method('hma', 'b', '(B)Lod;', 'poll', [], 'Unlinks and returns sentinel.field_g or null when empty.');
method('ki', 'a', '(Lkh;BLla;Z)Lwda;', 'readLocomotor', [], 'Chain of type ids that throws "Unrecognised locomotor type".');
method('pha', 'a', '(Lkh;Lla;I)Lib;', 'readSpawner', [], 'Throws "Unrecognised spawner type" for a bad id.');
method('bda', 'a', '(ZBLla;Lkh;)Lnv;', 'readBehaviour', [], 'Throws "Unrecognised behaviour type" for a bad id.');
method('lka', 'a', '(ILkh;I)Lbs;', 'readEvent', [], 'Reads an event from the stream; "Event type unrecognised" on a bad id.');
field('dt', 'c', 'I', 'tick', 'PlayerSimulation prints it as the tick in its state dump.');
field('dt', 'g', 'Lhca;', 'player', 'PlayerSimulation prints this Player in its state dump.');
field('dt', 'b', '[Lla;', 'rooms', 'PlayerSimulation owns the Room array.');
field('ff', 'G', '[Ldt;', 'simulations', 'MatchState resync indexes this array then looks up a Room.');
field('ff', 'H', '[Lhca;', 'players', 'MatchState keeps one Player per participant.');
field('iu', 'r', '[I', 'pixels', 'Sprite blit kernels read and write this int array.');
field('loa', 'a', 'Lqea;', 'random', 'MazeGenerator keeps an IsaacCipher used as its random source.');
field('vna', 'e', 'Lvg;', 'sentinel', 'IntrusiveDeque splices nodes next to this node.');
field('vna', 'b', 'Lvg;', 'cursor', 'IntrusiveDeque iteration remembers the next node here.');
for (const [original, to] of [['f', 'instigator'], ['i', 'course'], ['h', 'room'], ['j', 'start'], ['k', 'duration']])
  field('pi', original, 'I', to, 'PendingEvent.toString prints instigator, course, room, start and duration.');
method('dt', 'b', '(B)V', 'dumpState', [], 'Prints "DUMPING STATE on tick" and the Player.');
method('la', 'd', '(Z)V', 'dumpDebug', [], 'Prints "Rooms ID:" and the projectile list.');
method('ff', 'a', '(IIIII)V', 'resyncPlayerToRoom', [], 'Throws "Could not resync player to room" when the room is missing.');
method('vna', 'a', '(BLvg;)V', 'addFirst', [], 'Inserts the node directly after the sentinel.');
method('vna', 'c', '(B)Lvg;', 'pollLast', [], 'Unlinks and returns sentinel.previous or null.');
method('lba', 'a', '(BLqea;I)Lloa;', 'createMazeGenerator', [], 'Throws "Unrecognised maze gen type" for a bad id.');
method('jga', 'a', '(BLcn;)V', 'loadStrings', [], 'Loads keyed strings such as playtutorial into static fields.');

// Reviewed names added in later rounds live in tombracer-names.json:
// classes [owner, name, evidence], methods and fields [owner, original, descriptor, name, evidence].
const names = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'tombracer-names.json'), 'utf8'));
for (const [owner, to, evidence] of names.classes) {
  if (classes[owner]) throw new Error('Class already reviewed: ' + owner);
  classes[owner] = [to, evidence];
}
for (const [owner, original, descriptor, to, evidence] of names.methods) {
  const symbol = `M:${owner}.${original}${descriptor}`;
  if (members[symbol]) throw new Error('Method already reviewed: ' + symbol);
  members[symbol] = {to, evidence};
}
for (const [owner, original, descriptor, to, evidence] of names.fields) {
  const symbol = `F:${owner}.${original}:${descriptor}`;
  if (members[symbol]) throw new Error('Field already reviewed: ' + symbol);
  members[symbol] = {to, evidence};
}

export const config = {
  game: 'tombracer', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-tombracer-rules.mjs', 'tombracer-names.json', 'reproduce-tombracer.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Tomb Racer', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `TombRacer`; the shared engine (nodes, sockets, applet shell, input) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'tombracer-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Tomb Racer rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
