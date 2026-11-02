import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {stringFields} from './sumoblitz-string-fields.mjs';

// Identities below belong to the pinned Sumo Blitz export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  ms: ['IntrusiveNode', 'Long key plus two reciprocal links; unlink method splices neighbours.'],
  pj: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  hl: ['SecondaryNodeDeque', 'Iterable over DualLinkNode secondary links with a sentinel.'],
  vv: ['SecondaryNodeDequeIterator', 'Iterator constructed from a SecondaryNodeDeque.'],
  um: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  ia: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  g: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  nw: ['ProxySocketConnector', 'SocketConnector holding a ProxySelector and writing an HTTP CONNECT request.'],
  ns: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  gp: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  ov: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  fh: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  su: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  kc: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  fs: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, string and RSA operations.'],
  dt: ['BufferedSocket', 'Runnable owning an OutputStream and byte buffer for socket writes.'],
  wi: ['PlatformTaskDispatcher', 'Runnable owning an EventQueue and queued platform tasks.'],
  os: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  jn: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode walked by cursors.'],
  cb: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque that steps through next links.'],
  pk: ['UiWidget', 'IntrusiveNode base widget with text, bounds and listener fields; containers extend it.'],
  sp: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of child widgets walked with a cursor.'],
  mu: ['SpriteState', 'DualLinkNode subclass holding the six sprite dimension and offset integers.'],
  wb: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  ha: ['GraphicsToolkit', 'Abstract renderer whose factory picks among software, OpenGL and DirectX backends.'],
  aw: ['HardwareGraphicsToolkit', 'Abstract GraphicsToolkit base of the OpenGL and DirectX toolkits.'],
  on: ['OpenGlGraphicsToolkit', 'Toolkit constructed over jaggl.OpenGL by the OpenGL factory and probing GL extensions.'],
  ir: ['DirectXGraphicsToolkit', 'Toolkit located by reflection as ir.createToolkit after loading jagdx.'],
  rj: ['ResourceArchive', 'Holds a BigInteger key pair, a packet buffer and an entry array constructed from an index and a task.'],
  ee: ['UpgradeStatNames', 'Holder of the Speed, Traction, Bounce, Spikes and Armour upgrade names.'],
  hb: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const node = 'Unlink splices field_g and field_b neighbours of the node.';
field('ms', 'b', 'Lms;', 'next', node);
field('ms', 'g', 'Lms;', 'previous', node);
field('ms', 'h', 'J', 'key', 'Hash-table style long key on the intrusive node.');
field('pj', 'm', 'Lpj;', 'secondaryNext', 'Unlink splices field_o and field_m neighbours of the node.');
field('pj', 'o', 'Lpj;', 'secondaryPrevious', 'Unlink splices field_o and field_m neighbours of the node.');
field('pj', 'l', 'J', 'secondaryKey', 'Long key on the secondary-link node.');
field('wb', 'C', '[I', 'pixels', 'Sprite blit kernels read and write this int array.');
field('ee', 'a', '[Ljava/lang/String;', 'names', 'Static array of the five upgrade stat names.');
field('bq', 'a', '[Ljava/lang/String;', 'monthShortNames', 'Initialised to Jan through Dec.');
field('cj', 'c', '[Ljava/lang/String;', 'leaderboardSortLabels', 'Initialised to the By rating and By win percentage labels.');
field('dj', 'r', '[Ljava/lang/String;', 'scoreFilterLabels', 'Initialised to All scores, My scores and Best each.');
field('dk', 'b', '[Ljava/lang/String;', 'weekdayShortNames', 'Initialised to Sun through Sat.');
field('ge', 'k', '[Ljava/lang/String;', 'difficultyNames', 'Initialised to Normal and Hard.');
field('hf', 'L', '[Ljava/lang/String;', 'membershipPromoLines', 'Initialised to the turrets, levels and bosses promotion lines.');
field('ia', 'c', '[Ljava/lang/String;', 'leaderboardSortStatusLabels', 'Initialised to the Showing by rating and win percentage labels.');
field('jh', 'K', '[Ljava/lang/String;', 'achievementDescriptions', 'Initialised to the achievement condition sentences.');
field('lb', 'c', '[Ljava/lang/String;', 'yesNoLabels', 'Initialised to Yes and No.');
field('lf', 'd', '[Ljava/lang/String;', 'monthNames', 'Initialised to January through December.');
field('l', 'a', '[Ljava/lang/String;', 'enemyVariantNames', 'Initialised to None, Armoured, Spiked, Bomb, Small, Big and Boss.');
field('mb', 'g', '[Ljava/lang/String;', 'upgradesHelpLines', 'Initialised to the Upgrades instruction page text.');
field('mb', 'd', '[Ljava/lang/String;', 'dronesHelpLines', 'Initialised to the first Drones instruction page naming HyoujunBot, SuiminBot and KosokuBot.');
field('mb', 'j', '[Ljava/lang/String;', 'dronesHelpLinesPartTwo', 'Initialised to the second Drones page naming BunkatBot and SosakuBot.');
field('mb', 'i', '[Ljava/lang/String;', 'objectiveHelpLines', 'Initialised to the Objective instruction page text.');
field('mb', 'a', '[Ljava/lang/String;', 'controlsHelpLines', 'Initialised to the mouse and keyboard Controls instruction page.');
field('mo', 'o', '[Ljava/lang/String;', 'membershipBenefitLines', 'Initialised to the member expansion benefit lines.');
field('om', 'k', '[Ljava/lang/String;', 'droneNames', 'Initialised to Player and the five bot names.');
field('pp', 'e', '[Ljava/lang/String;', 'padTypeNames', 'Initialised to Accelerator pad, Ice pad, Teleporter pad and the other arena pieces.');
field('rb', 'd', '[Ljava/lang/String;', 'achievementNames', 'Initialised to Speed Demon, Get a Grip and the other achievement titles.');
field('sr', 'j', '[Ljava/lang/String;', 'droneDescriptions', 'Initialised to bot and arena piece names each followed by a description.');
field('vu', 'i', '[Ljava/lang/String;', 'powerupEffectNames', 'Initialised to None and the permanent and temporary speed, bounce and traction ups.');
field('vk', 'b', '[Ljava/lang/String;', 'levelLoadStepLabels', 'Initialised to Placing enemies and Placing terrain.');
field('nm', 'u', '[Ljava/lang/String;', 'waitingForTextTranslations', 'Initialised to the Waiting for text translations.');
field('qi', 'a', '[Ljava/lang/String;', 'loadingTextTranslations', 'Initialised to the Loading text translations.');
field('ms', 'f', '[Ljava/lang/String;', 'exclamationPhrases', 'Initialised to Zounds, Well I never and similar phrases.');
for (const [owner, original, to, evidence] of stringFields)
  field(owner, original, 'Ljava/lang/String;', to, evidence);
field('fs', 'n', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor.');
field('fs', 'p', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');

export const config = {
  game: 'sumoblitz', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-sumoblitz-rules.mjs', 'reproduce-sumoblitz.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs', 'sumoblitz-string-fields.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Sumo Blitz', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Sumoblitz`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'sumoblitz-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Sumo Blitz rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
