import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {verifyAceCore} from './tests/test-aceofskies-core.mjs';
import {reconstructAceMethods} from './reconstruct-aceofskies.mjs';
import {verifyAceHud} from './tests/test-aceofskies-hud.mjs';

// Every identity below belongs to the pinned Ace export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  wt: ['DualLinkNode', 'Same shared role as GeoBlox DualLinkNode: an IntrusiveNode with an independent secondary key/link pair and secondary-only unlink.'],
  ph: ['IntrusiveNodeHashTable', 'Same shared role as GeoBlox IntrusiveNodeHashTable: power-of-two bucket sentinels, key lookup, node transfer, bucket-order traversal and clearing.'],
  tb: ['HudMessage', 'Intrusive queued text with age, fade-in/hold/fade-out phases, colour and font rendering.'],
  tp: ['PcmStreamMixer', 'Shared PCM substream mixer with intrusive stream/listener queues and scheduled listener boundaries; same role as GeoBlox PcmStreamMixer.'],
  pk: ['FlightSession', 'Owns the player, aircraft array, bullets, pickups and effects; initializes, advances and draws a session.'],
  md: ['Aircraft', 'FlightBody subclass with aircraft definition, hit points, targeting, firing and steering state.'],
  gb: ['AircraftDefinition', 'Constructor retains aircraft speed/turn/health/weapon dimensions; instances select aircraft sprites and engine samples.'],
  kc: ['Vector2', 'Two double coordinates, copy/set/add/subtract, dot product, squared length and polar conversion.'],
  o: ['FlightBody', 'Owns position, heading, heading offset and speed; forward/sideways movement and world boundary wrapping.'],
  jd: ['SteeringMode', 'Identity token selected by Aircraft steering between inactive, attack and evade states. Static UI data is unrelated.'],
  eu: ['Bullet', 'FlightBody retaining source aircraft and 64-tick lifetime; spawn offsets position and heading before advancing.'],
  wm: ['Pickup', 'FlightBody initialized with a pickup code and 400-tick life; session collects its upgrade or temporary weapon.'],
  qf: ['SmokeParticle', 'FlightBody with age initialized to ten and advanced by five, a lifetime limit, depth phase and colour/negative blast-radius code.'],
  ok: ['ScreenParticle', 'Integer/fixed-point screen effect initialized in two modes; session updates and renders its pooled instances.'],
  vc: ['ScorchMark', 'Persistent ground mark using the literal scorch sprite asset; retains ground coordinates, diameter and sprite index and is culled outside the view.'],
  nk: ['MenuScreen', 'One of eight indexed screens, retaining selection, animation/input and menu text/rendering state.'],
  gr: ['MenuInputState', 'Owns selected item, pointer/keyboard selection mode, held/pressed buttons, key code and repeat countdown.'],
  l: ['RendererManager', 'Owns renderer selection, canvas binding, recreation and current GraphicsRenderer.'],
  ha: ['GraphicsRenderer', 'Abstract canvas/render-target/sprite/line/image drawing API; supports software and hardware implementations.'],
  pa: ['RenderSprite', 'Abstract sprite blits, scaling and transformed rendering operations.'],
  da: ['RendererBitmapFont', 'Markup-aware text drawing through GraphicsRenderer, with separate BitmapFontMetrics; distinct from the shared software BitmapFont.'],
  hc: ['BitmapFont', 'Same shared role as GeoBlox BitmapFont: software text layout, tags, wrapping, glyph metrics and abstract coverage/mask drawing on the global raster.'],
  cp: ['CoverageBitmapFont', 'Same shared role as GeoBlox CoverageBitmapFont: palette-to-coverage conversion and clipped per-pixel glyph alpha blending.'],
  vt: ['MonochromeBitmapFont', 'Same shared role as GeoBlox MonochromeBitmapFont: clipped zero/nonzero glyph masks, opacity and scanline-mask support.'],
  vs: ['BitmapFontMetrics', 'Separate renderer-font metrics decoder retaining byte advances, optional pair kerning, line advance, ascent/descent and image-aware text measurement/wrapping.'],
  vp: ['SoftwareRasterizer', 'Same shared role as GeoBlox SoftwareRasterizer: global integer framebuffer, stride/height, clip bounds and software drawing primitives.'],
  vd: ['SpriteData', 'Decodes indexed sprite frames with shared palette, optional alpha plane and four padding extents; consumed when creating renderer-owned sprites and font glyphs.'],
  df: ['IndexedSpriteState', 'Same shared role as GeoBlox IndexedSpriteState: full/trimmed dimensions, trim offsets and abstract indexed draw/alpha operations.'],
  wp: ['IndexedSprite', 'Same shared role as GeoBlox IndexedSprite: indexed byte pixels, RGB palette and clipped software draw/alpha operations.'],
  nl: ['SpriteState', 'Same shared role as GeoBlox SpriteState: primary/secondary linked sprite with full/trimmed dimensions and trim offsets.'],
  ll: ['Sprite', 'Same shared role as GeoBlox Sprite: software RGB pixels with transparent-zero drawing, copies, mirroring, rotation and raster binding.'],
  rd: ['ArgbSprite', 'Same shared role as GeoBlox ArgbSprite: Sprite subclass whose software blits use per-pixel high-byte alpha.'],
  vb: ['GameAppletShell', 'Applet/Runnable lifecycle, canvas creation, focus/window listeners and abstract client hooks.'],
  ct: ['NetworkGameClient', 'GameAppletShell with account/connection initialization, login and shared client state.'],
  gj: ['GameCanvas', 'Canvas retaining a Component and forwarding its paint/update callbacks.'],
  gk: ['ResourceArchive', 'Same shared role as GeoBlox ResourceArchive and Steel cm: provider/index, packed groups, unpacked files and retention modes.'],
  ps: ['ArchiveIndex', 'Same shared role as GeoBlox ArchiveIndex and Steel jl: versioned CRC/revision/name/digest/group/file metadata.'],
  ip: ['ArchiveProvider', 'Abstract encoded-group/index/progress provider consumed by ResourceArchive; unrelated static text helpers remain.'],
  nm: ['IntKeyLookup', 'Power-of-two open-address integer key/index pairs, used by archive name lookup; unrelated globals remain.'],
  rb: ['PacketBuffer', 'Same shared role as GeoBlox PacketBuffer and Steel gi: payload/cursor and big-endian primitive/slice encodings.'],
  dl: ['CipherPacketBuffer', 'PacketBuffer with an ISAAC opcode cipher and separate bit position, matching the shared cipher/bit buffer role.'],
  wf: ['IntrusiveNode', 'Same shared role as GeoBlox IntrusiveNode and Steel ck: long key, two links and unlink.'],
  kp: ['IntrusiveDeque', 'Same shared role as GeoBlox IntrusiveDeque and Steel ul: sentinel, directional traversal, insertion/removal and clear.'],
  ak: ['ClientException', 'RuntimeException wrapper retaining original cause and appended client context.'],
  al: ['PcmSample', 'Same shared role as GeoBlox PcmSample: signed PCM bytes, sample rate, loop start/end and ping-pong flag.'],
  rf: ['PcmStream', 'Shared linked PCM stream contract: substreams, sample mixing and skipping.'],
  su: ['PcmSampleStream', 'Same shared role as GeoBlox PcmSampleStream: signed sample interpolation, position/step, looping and gain ramps.'],
  hk: ['MidiPcmStream', 'Same shared role as GeoBlox MidiPcmStream: channel/controller state, MIDI events, notes and sample mixing.'],
  ap: ['MusicTrack', 'Shared packed MIDI track decoder and instrument-use table; loads a named archive track.'],
  ob: ['SoundCache', 'Shared synthesized/Vorbis sound archive lookup and retained PCM caches.'],
  uc: ['HighscoreQuery', 'Same shared role as GeoBlox HighscoreQuery: query ID, row/value dimensions, completion and three decoded views; Ace also retains server submission tokens.'],
  ga: ['ScoreSubmission', 'Same shared role as GeoBlox ScoreSubmission: wrapping 16-bit request ID, two shorts, four context integers and scores; Ace retains the acknowledgement token.'],
  gl: ['HighscoreNameEntry', 'Same shared role as GeoBlox HighscoreNameEntry: primary/alternate names and a marker used to build the unique-player view.'],
  rh: ['SoundPlayback', 'Linked wrapper retaining a sample stream, scaled volume and linked playback owner.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const evidence = {
  vector: 'Vector2 assignments, arithmetic and call sites; retain original angle scale and dummy-guard behavior.',
  motion: 'FlightBody constructor, forward/sideways trigonometry, heading wrap and world-boundary data flow.',
  aircraft: 'Aircraft initialization, session damage/weapon paths and steering/target assignment.',
  session: 'FlightSession initialization, simulation, rendering and pool insertion/removal call sites.',
  deque: 'Reviewed shared intrusive sentinel/link ownership and directional traversal.',
  packet: 'Reviewed byte shifts/masks, cursor updates, callers and big-endian byte order.',
};
for (const [original, to] of [['a', 'x'], ['b', 'y']]) field('kc', original, 'D', to, evidence.vector);
for (const [original, descriptor, to, names] of [
  ['<init>', '(DD)V', '', ['x', 'y']], ['<init>', '(Lkc;)V', '', ['source']],
  ['a', '(DDZ)V', 'set', ['x', 'y', 'obfuscationGuard']],
  ['a', '(Lkc;Z)V', 'setFrom', ['source', 'obfuscationGuard']],
  ['a', '(BLkc;)V', 'add', ['obfuscationGuard', 'other']],
  ['a', '(Lkc;I)V', 'subtract', ['other', 'obfuscationGuard']],
  ['a', '(Lkc;B)D', 'dot', ['other', 'obfuscationGuard']],
  ['b', '(I)D', 'lengthSquared', ['obfuscationGuard']],
  ['a', '(B)D', 'length', ['obfuscationGuard']],
  ['a', '(DDI)V', 'setPolar256', ['magnitude', 'angle', 'obfuscationGuard']],
  ['c', '(I)I', 'angle255', ['obfuscationGuard']],
]) method('kc', original, descriptor, to, names, evidence.vector);
for (const [original, descriptor, to] of [['d', 'Lkc;', 'position'], ['e', 'D', 'heading'], ['f', 'I', 'headingOffset'], ['b', 'D', 'speed']])
  field('o', original, descriptor, to, evidence.motion);
for (const [original, descriptor, to, names] of [
  ['<init>', '(Lkc;)V', '', ['position']],
  ['a', '(I)V', 'advance', ['obfuscationGuard']],
  ['a', '(DB)V', 'turn', ['angleDelta', 'obfuscationGuard']],
  ['b', '(DI)V', 'moveForward', ['distance', 'angleDivisor']],
  ['a', '(BD)V', 'moveSideways', ['obfuscationGuard', 'distance']],
  ['a', '(DI)V', 'wrapSquare', ['halfExtent', 'obfuscationGuard']],
  ['a', '(DBD)V', 'wrapWorld', ['halfWidth', 'obfuscationGuard', 'halfHeight']],
]) method('o', original, descriptor, to, names, evidence.motion);
for (const [original, descriptor, to] of [
  ['r', 'Lgb;', 'definition'], ['k', 'I', 'hitPoints'], ['y', 'I', 'fireCooldown'],
  ['j', 'I', 'weaponHeat'], ['l', 'Z', 'fireRequested'], ['u', 'Ljd;', 'steeringMode'],
  ['g', 'Lmd;', 'pursuingAircraft'], ['n', 'Lmd;', 'targetAircraft'], ['h', 'Lrh;', 'engineSound'],
  ['i', 'I', 'bankOffset'], ['q', 'I', 'damageSmokeTicks'], ['m', 'I', 'temporaryWeapon'],
  ['x', 'I', 'temporaryWeaponTicks'], ['v', 'I', 'dropPickupCode'],
]) field('md', original, descriptor, to, evidence.aircraft);
method('md', '<init>', '(Lkc;Lgb;)V', '', ['position', 'definition'], evidence.aircraft);
method('md', 'a', '(BLkc;Lgb;)V', 'initializeAircraft', ['obfuscationGuard', 'position', 'definition'], evidence.aircraft);
method('md', 'a', '(IBLmd;)V', 'steerTowardsTarget', ['aimLead', 'obfuscationGuard', 'target'], evidence.aircraft);
for (const [original, descriptor, to] of [
  ['g', 'D', 'turnRate'], ['e', 'I', 'maximumHitPoints'], ['d', 'I', 'fireInterval'],
  ['h', 'D', 'minimumSpeed'], ['i', 'D', 'maximumSpeed'], ['a', 'I', 'collisionRadius'],
  ['b', 'I', 'gunPattern'], ['c', 'I', 'aimSpread'], ['f', 'I', 'heatReduction'],
]) field('gb', original, descriptor, to, 'Definition constructor assignments, upgrades, bullet collision radius and flight speed/turn/fire paths.');
method('gb', '<init>', '(DIIIIDDII)V', '', ['turnRate', 'fireInterval', 'heatReduction', 'aimSpread',
  'maximumHitPoints', 'nominalMinimumSpeed', 'nominalMaximumSpeed', 'collisionRadius', 'gunPattern'],
  'Constructor stores these definition values and halves both supplied nominal speeds.');
method('gb', 'a', '(B)Lal;', 'getEngineSample', ['obfuscationGuard'], 'Identity-based selection of the aircraft engine PCM sample.');
method('gb', 'b', '(I)[Lpa;', 'getSprites', ['obfuscationGuard'], 'Identity-based selection of the aircraft sprite frames.');
for (const [original, descriptor, to] of [
  ['A', '[Lmd;', 'aircraft'], ['X', 'Lmd;', 'playerAircraft'], ['S', '[Leu;', 'bullets'],
  ['i', '[Lwm;', 'pickups'], ['n', '[Lqf;', 'smokeParticles'], ['C', '[Lok;', 'screenParticles'],
  ['z', '[Lvc;', 'scorchMarks'], ['E', '[Lo;', 'backgroundBodies'],
  ['w', 'I', 'smokeParticleCount'], ['K', 'I', 'screenParticleCount'],
  ['c', 'I', 'simulationTick'], ['yb', 'Z', 'attractMode'], ['Cb', 'Z', 'arcadeMode'],
  ['g', 'Z', 'paused'], ['Ab', 'I', 'shotsFired'], ['pb', 'I', 'shotsHit'],
  ['d', 'I', 'speedUpgradeLevel'], ['J', 'I', 'fireRateUpgradeLevel'],
  ['x', 'I', 'turnRateUpgradeLevel'], ['H', 'I', 'healthUpgradeLevel'],
  ['vb', 'Lhk;', 'gameMusic'], ['Z', '[I', 'musicChannelVolumes'],
  ['ab', 'I', 'bulletCount'], ['Bb', 'I', 'pickupCount'], ['F', 'I', 'lives'],
  ['kb', 'D', 'cameraScale'], ['t', 'D', 'backgroundPanX'], ['Y', 'D', 'backgroundPanY'],
  ['V', 'I', 'scoreMultiplier'], ['P', 'I', 'displayedMultiplier'], ['tb', 'I', 'targetMultiplier'],
  ['Q', 'I', 'multiplierAnimationTicks'], ['N', 'I', 'displayedScore'], ['nb', 'I', 'targetScore'],
  ['cb', 'I', 'scoreAnimationTicks'], ['q', 'I', 'finalScore'], ['b', 'I', 'finalAccuracyPercent'],
]) field('pk', original, descriptor, to, evidence.session);
for (const [original, descriptor, to, names] of [
  ['a', '(IZ)V', 'startGame', ['obfuscationGuard', 'arcadeMode']],
  ['a', '(ZZ)V', 'advanceSession', ['obfuscationGuard', 'processInput']],
  ['a', '(IZLha;)V', 'renderSession', ['obfuscationGuard', 'unusedFlag', 'renderer']],
  ['a', '(ILmd;Lkc;)V', 'advanceAircraft', ['obfuscationGuard', 'aircraft', 'cameraMovement']],
  ['b', '(Lmd;I)V', 'selectAircraftTarget', ['aircraft', 'obfuscationGuard']],
  ['b', '(BLmd;)V', 'installAircraft', ['obfuscationGuard', 'aircraft']],
  ['a', '(BLgb;II)I', 'spawnAircraft', ['obfuscationGuard', 'definition', 'count', 'pickupCount']],
  ['a', '(ZZI)V', 'finishGame', ['screenFlag', 'awardFlag', 'accuracyTarget']],
  ['c', '(BI)Z', 'applyUpgrade', ['obfuscationGuard', 'upgradeCode']],
  ['a', '(ILkc;BI)V', 'emitSmoke', ['lifetimeTicks', 'position', 'obfuscationGuard', 'colourOrBlastRadius']],
  ['a', '(BLmd;)V', 'fireBullets', ['obfuscationGuard', 'aircraft']],
  ['a', '(Lkc;B)V', 'advanceBullets', ['cameraMovement', 'obfuscationGuard']],
  ['a', '(Lkc;Z)V', 'advancePickups', ['cameraMovement', 'obfuscationGuard']],
  ['a', '(Lkc;I)V', 'advanceSmokeParticles', ['cameraMovement', 'obfuscationGuard']],
  ['c', '(I)V', 'advanceScreenParticles', ['obfuscationGuard']],
  ['a', '(IIIZIIIZI)V', 'drawRollingDigits', ['settledValue', 'digitCount', 'top', 'suppressLeadingZeros',
    'remainingAnimationTicks', 'targetValue', 'right', 'alternateGlyphBank', 'obfuscationGuard']],
  ['c', '(II)V', 'removeSmokeParticle', ['index', 'obfuscationGuard']],
  ['d', '(BI)V', 'removeScreenParticle', ['obfuscationGuard', 'index']],
]) method('pk', original, descriptor, to, names, evidence.session);
field('eu', 'i', 'Lmd;', 'sourceAircraft', 'Bullet spawn retains its firing aircraft for hit routing and attribution.');
field('eu', 'h', 'I', 'remainingTicks', 'Spawn sets 64; the bullet update decrements and expires this lifetime.');
method('eu', 'a', '(IIDLmd;)V', 'spawn', ['sideOffset', 'headingOffset', 'turnOffset', 'sourceAircraft'], 'Copies source position/heading, sets lifetime and speed, offsets sideways then forward.');
field('wm', 'k', 'I', 'pickupCode', 'Pickup initialization, weapon/upgrade dispatch in collection path.');
field('wm', 'g', 'I', 'remainingTicks', 'Pickup starts at 400, decays, fades and is removed after the retained tail.');
method('wm', 'a', '(IILkc;)V', 'spawn', ['pickupCode', 'obfuscationGuard', 'position'], 'Sets the pickup code, copies position and resets lifetime to 400.');
field('qf', 'i', 'I', 'ageTicks', 'Smoke spawn starts age at ten; update adds five and removes at age >= lifetimeTicks, retaining updates of the removed object.');
field('qf', 'h', 'I', 'spriteIndex', 'Smoke spawn chooses an index in the smoke sprite array.');
for (const [original, descriptor, to] of [['f', '[B', 'payload'], ['g', 'I', 'position']]) field('rb', original, descriptor, to, evidence.packet);
for (const [original, descriptor, to, names] of [
  ['b', '(II)V', 'writeByte', ['obfuscationGuard', 'value']],
  ['a', '(II)V', 'writeShort', ['value', 'obfuscationGuard']],
  ['c', '(II)V', 'writeMedium', ['obfuscationGuard', 'value']],
  ['a', '(BI)V', 'writeInt', ['obfuscationGuard', 'value']],
  ['b', '(BJ)V', 'writeLong', ['obfuscationGuard', 'value']],
  ['g', '(I)I', 'readUnsignedByte', ['obfuscationGuard']],
  ['d', '(I)B', 'readByte', ['obfuscationGuard']],
  ['i', '(B)I', 'readUnsignedShort', ['obfuscationGuard']],
  ['g', '(B)I', 'readUnsignedMedium', ['obfuscationGuard']],
  ['a', '(B)I', 'readInt', ['obfuscationGuard']],
  ['h', '(B)J', 'readLong', ['obfuscationGuard']],
  ['f', '(I)I', 'readUnsignedSmart', ['obfuscationGuard']],
  ['f', '(B)I', 'readSignedSmart', ['obfuscationGuard']],
  ['<init>', '([B)V', '', ['payload']], ['<init>', '(I)V', '', ['capacity']],
]) method('rb', original, descriptor, to, names, evidence.packet);
for (const [original, descriptor, to] of [['a', 'Lwf;', 'next'], ['c', 'Lwf;', 'previous'], ['b', 'J', 'key']])
  field('wf', original, descriptor, to, evidence.deque);
method('wf', 'c', '(I)V', 'unlink', ['obfuscationGuard'], evidence.deque);
method('wf', 'b', '(B)Z', 'isLinked', ['obfuscationGuard'], evidence.deque);
field('kp', 'e', 'Lwf;', 'sentinel', evidence.deque); field('kp', 'c', 'Lwf;', 'traversalCursor', evidence.deque);
for (const [original, descriptor, to, names] of [
  ['a', '(ILwf;)V', 'addLast', ['obfuscationGuard', 'node']],
  ['a', '(Lwf;I)V', 'addFirst', ['node', 'obfuscationGuard']],
  ['d', '(I)Lwf;', 'first', ['obfuscationGuard']], ['b', '(B)Lwf;', 'next', ['obfuscationGuard']],
  ['a', '(B)Lwf;', 'last', ['obfuscationGuard']], ['a', '(I)Lwf;', 'previous', ['obfuscationGuard']],
  ['b', '(I)Lwf;', 'removeLast', ['obfuscationGuard']], ['e', '(I)Lwf;', 'removeFirst', ['obfuscationGuard']],
  ['a', '(Z)Z', 'isEmpty', ['obfuscationGuard']], ['c', '(I)V', 'clear', ['obfuscationGuard']],
]) method('kp', original, descriptor, to, names, evidence.deque);
for (const [original, descriptor, to] of [['e', 'Lps;', 'index'], ['h', 'Lip;', 'provider'], ['a', '[Ljava/lang/Object;', 'packedGroups'], ['d', '[[Ljava/lang/Object;', 'unpackedFiles'], ['b', 'I', 'fileRetentionMode'], ['f', 'Z', 'discardPackedGroups']])
  field('gk', original, descriptor, to, 'Reviewed shared archive constructor, packed/unpacked group storage and retention paths; same role as Steel ResourceArchive.');
for (const [original, descriptor, to] of [['g', '[B', 'samples'], ['i', 'I', 'sampleRate'], ['h', 'I', 'loopStart'], ['j', 'I', 'loopEnd'], ['f', 'Z', 'pingPongLoop']])
  field('al', original, descriptor, to, 'PCM constructors and sample-stream consumers; same shared sample container role as GeoBlox PcmSample.');
field('AceOfSkies', 'G', 'Z', 'obfuscationControl', 'Shared opaque branch-control flag read throughout the exported client.');
field('sg', 'c', 'Lpk;', 'flightSession', 'Client loading allocates this session; update and render dispatch to it.');
method('AceOfSkies', 'q', '(I)V', 'advanceGame', ['obfuscationGuard'], 'Dispatches session update and active menu transitions.');
method('AceOfSkies', 'e', '(I)V', 'renderGame', ['obfuscationGuard'], 'Obtains current renderer, draws session and menu layers, and presents the frame.');
const loadingEvidence = 'Reviewed applet run/shutdown callers, staged Ace resource loading, archive consumers, font/sprite asset literals and audio-cache construction; guards and stage ordering remain unchanged.';
for (const [owner, original, type, to] of [
  ['hg','x','Lgk;','sharedSpriteArchive'], ['fg','t','Lgk;','sharedFontMetricsArchive'],
  ['wi','a','Lgk;','gameSpriteArchive'], ['iq','e','Lgk;','gameFontMetricsArchive'],
  ['jk','b','Lgk;','synthesizedSoundArchive'], ['ub','f','Lgk;','vorbisSoundArchive'],
  ['ot','b','Lgk;','musicPatchArchive'], ['od','x','Lgk;','musicTrackArchive'],
  ['qn','c','Lob;','loadingSoundCache'], ['tg','a','[Lap;','musicTracks'],
  ['ct','I','F','loadingPercent'], ['dq','b','Ljava/lang/String;','loadingMessage'],
]) field(owner, original, type, to, loadingEvidence);
for (const [owner, original, descriptor, to, names] of [
  ['AceOfSkies','a','(BZ)Z','advanceResourceLoading',['obfuscationGuard','initializeAfterDownload']],
  ['AceOfSkies','g','(B)V','initializeGameResources',['obfuscationGuard']],
  ['AceOfSkies','a','(I)V','initializeClient',['obfuscationGuard']],
  ['AceOfSkies','c','(I)V','updateClient',['obfuscationGuard']],
  ['AceOfSkies','f','(I)V','shutdownClient',['obfuscationGuard']],
  ['AceOfSkies','d','(I)V','releaseClientStatics',['obfuscationGuard']],
  ['pe','a','(Lgk;BLgk;Lgk;)V','decodeGameImagesAndFonts',['fontMetricsArchive','obfuscationGuard','sharedSpriteArchive','gameSpriteArchive']],
  ['nk','a','(BLgk;Lgk;)V','decodeMenuResources',['obfuscationGuard','spriteArchive','fontMetricsArchive']],
  ['ga','a','(I)V','createRendererResources',['obfuscationGuard']],
  ['fh','a','(IFLjava/lang/String;)V','setLoadingProgress',['obfuscationGuard','percent','message']],
  ['te','a','(I)V','resetFrameTiming',['obfuscationGuard']],
]) method(owner, original, descriptor, to, names, loadingEvidence);

const sharedCollectionEvidence = 'Reviewed sentinel construction, bucket masking, insertion/unlink, lookup and traversal; secondary links are independent of IntrusiveNode links. Matching roles are also present in GeoBlox.';
for (const [owner, original, type, to] of [
  ['wt','f','Lwt;','previousSecondaryNode'], ['wt','j','Lwt;','nextSecondaryNode'], ['wt','i','J','secondaryKey'],
  ['ph','d','[Lwf;','bucketSentinels'], ['ph','b','I','bucketCount'], ['ph','a','Lwf;','lookupCursor'],
  ['ph','c','Lwf;','iterationCursor'], ['ph','e','I','nextIterationBucket'],
]) field(owner, original, type, to, sharedCollectionEvidence);
for (const [owner, original, descriptor, to, names] of [
  ['wt','d','(I)V','unlinkSecondaryNode',['obfuscationGuard']],
  ['ph','<init>','(I)V','',['bucketCount']],
  ['ph','a','(BJ)Lwf;','findByKey',['obfuscationGuard','key']],
  ['ph','a','(IJLwf;)V','put',['obfuscationGuard','key','node']],
  ['ph','a','(Z)Lwf;','firstForIteration',['obfuscationGuard']],
  ['ph','a','(I)Lwf;','nextForIteration',['obfuscationGuard']],
  ['ph','b','(I)V','clearFromBucket',['firstBucket']],
]) method(owner, original, descriptor, to, names, sharedCollectionEvidence);

const soundCacheEvidence = 'Reviewed SoundCache constructor, synthesized bj decoder versus incremental t Vorbis decoder, cache keys, PCM reuse and byte-budget consumption. The same shared audio roles occur in GeoBlox.';
for (const [original, type, to] of [
  ['h','Lgk;','synthesizedSoundArchive'], ['a','Lgk;','vorbisSoundArchive'],
  ['g','Lph;','vorbisSampleCache'], ['b','Lph;','pcmSampleCache'],
]) field('ob', original, type, to, soundCacheEvidence);
for (const [original, descriptor, to, names] of [
  ['<init>','(Lgk;Lgk;)V','',['synthesizedSoundArchive','vorbisSoundArchive']],
  ['a','(I[IB)Lal;','getVorbisSample',['sampleId','remainingByteBudget','obfuscationGuard']],
  ['a','(II[II)Lal;','getVorbisSampleByGroup',['groupId','fileId','remainingByteBudget','obfuscationGuard']],
  ['a','([IIB)Lal;','getSynthesizedSample',['remainingByteBudget','sampleId','obfuscationGuard']],
  ['a','(I[III)Lal;','getSynthesizedSampleByGroup',['fileId','remainingByteBudget','groupId','obfuscationGuard']],
]) method('ob', original, descriptor, to, names, soundCacheEvidence);

const fontEvidence = 'Reviewed glyph constructors, metric decoding, style tags, baseline placement, wrapping and clipped raster writes; software roles match GeoBlox, while renderer-backed fonts retain their separate metrics/renderer.';
for (const [original, type, to] of [
  ['p','[I','glyphAdvances'], ['B','[I','glyphXOffsets'], ['H','[I','glyphYOffsets'],
  ['t','[I','glyphWidths'], ['z','[I','glyphHeights'], ['L','[B','pairKerning'],
  ['w','I','lineAdvance'], ['I','I','maxAscent'], ['D','I','maxDescent'], ['C','I','capitalXAscent'],
  ['u','[Ldf;','inlineImages'], ['s','[I','inlineImageBaselineOffsets'],
  ['n','Ljava/lang/StringBuilder;','wrappingBuffer'], ['A','[Ljava/lang/String;','wrappedLines'],
  ['G','I','strikethroughColor'], ['q','I','underlineColor'], ['v','I','defaultTextColor'], ['y','I','currentTextColor'],
  ['J','I','defaultShadowColor'], ['F','I','currentShadowColor'], ['E','I','defaultAlpha256'], ['x','I','currentAlpha256'],
  ['r','I','spaceExpansionQ8'], ['o','I','justificationRemainderQ8'],
]) field('hc', original, type, to, fontEvidence);
for (const [owner, original, type, to] of [
  ['cp','K','[[B','glyphCoverage'], ['vt','K','[[B','glyphMasks'],
  ['da','d','Lha;','renderer'], ['da','c','Lvs;','metrics'],
  ['vs','d','[B','glyphAdvances'], ['vs','h','[[B','pairKerning'],
  ['vs','e','I','lineAdvance'], ['vs','j','I','maxAscent'], ['vs','i','I','maxDescent'],
  ['vp','j','[I','framebuffer'], ['vp','i','I','stride'], ['vp','c','I','framebufferHeight'],
  ['vp','b','I','clipLeft'], ['vp','f','I','clipTop'], ['vp','k','I','clipRight'], ['vp','d','I','clipBottom'],
  ['vp','h','[I','scanlineMaskStarts'], ['vp','a','[I','scanlineMaskWidths'],
  ['bo','a','Lhc;','menuBitmapFont'],
]) field(owner, original, type, to, fontEvidence);
for (const [owner, original, descriptor, to, names] of [
  ['hc','<init>','([B[I[I[I[I)V','',['encodedMetrics','glyphXOffsets','glyphYOffsets','glyphWidths','glyphHeights']],
  ['hc','a','([B)V','decodeFontMetrics',['encodedMetrics']],
  ['hc','a','([[B[[B[I[I[III)I','computePairKerning',['leadingProfiles','trailingProfiles','profileOffsets','advances','profileLengths','firstGlyph','secondGlyph']],
  ['hc','a','(C)I','measureCharacterAdvance',['character']],
  ['hc','a','(Ljava/lang/String;)I','measureTextWidth',['text']],
  ['hc','a','(Ljava/lang/String;[I[Ljava/lang/String;)I','wrapText',['text','lineWidthLimits','outputLines']],
  ['hc','a','(Ljava/lang/String;I)I','countWrappedLines',['text','wrapWidth']],
  ['hc','a','(Ljava/lang/String;II)I','measureWrappedHeight',['text','wrapWidth','lineSpacing']],
  ['hc','b','(Ljava/lang/String;IIII)V','drawText',['text','leftX','baselineY','textColor','shadowColor']],
  ['hc','a','(Ljava/lang/String;IIII)V','drawRightAlignedText',['text','rightX','baselineY','textColor','shadowColor']],
  ['hc','c','(Ljava/lang/String;IIII)V','drawCenteredText',['text','centerX','baselineY','textColor','shadowColor']],
  ['hc','a','(Ljava/lang/String;IIIIIIIII)I','drawParagraph',['text','left','top','width','height','textColor','shadowColor','horizontalAlignment','verticalAlignment','lineSpacing']],
  ['hc','a','(Ljava/lang/String;IIIIIIIIII)I','drawParagraphAlpha',['text','left','top','width','height','textColor','shadowColor','alpha256','horizontalAlignment','verticalAlignment','lineSpacing']],
  ['hc','a','(II)V','resetOpaqueTextStyle',['textColor','shadowColor']],
  ['hc','a','(III)V','resetTextStyle',['textColor','shadowColor','alpha256']],
  ['hc','b','(Ljava/lang/String;)V','applyStyleTag',['tag']],
  ['hc','b','(Ljava/lang/String;I)V','prepareJustification',['text','targetWidth']],
  ['hc','b','(Ljava/lang/String;II)V','drawStyledText',['text','penX','baselineY']],
  ['hc','a','()V','releaseTextScratchStorage',[]],
  ['hc','a','(IIIIIIZ)V','drawGlyph',['glyphIndex','x','y','width','height','color','shadowPass']],
  ['hc','a','(IIIIIIIZ)V','drawGlyphAlpha',['glyphIndex','x','y','width','height','color','alpha256','shadowPass']],
  ['cp','<init>','([B[I[I[I[I[I[[B)V','',['encodedMetrics','glyphXOffsets','glyphYOffsets','glyphWidths','glyphHeights','palette','glyphPaletteIndices']],
  ['cp','a','([I[[B)[[B','convertPaletteToCoverage',['palette','glyphPaletteIndices']],
  ['vt','<init>','([B[I[I[I[I[[B)V','',['encodedMetrics','glyphXOffsets','glyphYOffsets','glyphWidths','glyphHeights','glyphMasks']],
  ['da','<init>','(Lha;Lvs;)V','',['renderer','metrics']],
  ['vs','<init>','([B)V','',['encodedMetrics']],
  ['vs','a','(BI)I','measureCharacterAdvance',['obfuscationGuard','glyphIndex']],
  ['vs','a','(BLjava/lang/String;)I','measureTextWidth',['obfuscationGuard','text']],
  ['vs','a','(Ljava/lang/String;B[Lpa;)I','measureTextWidthWithImages',['text','obfuscationGuard','inlineImages']],
  ['vs','a','(ICI)I','getPairKerning',['obfuscationGuard','secondGlyph','firstGlyph']],
  ['vs','a','(I[Lpa;[I[Ljava/lang/String;Ljava/lang/String;)I','wrapText',['obfuscationGuard','inlineImages','lineWidthLimits','outputLines','text']],
  ['vp','a','([III)V','setRasterTarget',['targetPixels','targetWidth','targetHeight']],
  ['vp','e','(IIII)V','setClip',['left','top','right','bottom']],
  ['vp','a','(IIII)V','intersectClip',['left','top','right','bottom']],
  ['vp','b','([I)V','saveClip',['clipBounds']],
  ['vp','a','([I)V','restoreClip',['clipBounds']],
  ['vp','b','()V','clearScanlineMasks',[]],
  ['vp','a','()V','clearFramebuffer',[]],
  ['vp','a','(III)V','setPixel',['x','y','color']],
  ['vp','b','(IIII)V','drawHorizontalLine',['x','y','length','color']],
  ['vp','e','(IIIII)V','drawRectangle',['x','y','width','height','color']],
]) method(owner, original, descriptor, to, names, fontEvidence);

const spriteEvidence = 'Reviewed indexed frame encoding, palette/alpha planes, sprite constructors, software pixel addressing/transforms and literal asset loading followed by renderer resource creation.';
for (const [owner, original, type, to] of [
  ['vd','a','I','padLeft'], ['vd','i','I','padTop'], ['vd','g','I','padRight'], ['vd','b','I','padBottom'],
  ['vd','h','I','width'], ['vd','c','I','height'], ['vd','f','[I','palette'], ['vd','d','[B','indices'], ['vd','e','[B','alpha'],
  ['df','h','I','fullWidth'], ['df','a','I','fullHeight'], ['df','e','I','trimX'], ['df','c','I','trimY'], ['df','b','I','width'], ['df','d','I','height'],
  ['wp','i','[I','palette'], ['wp','j','[B','indices'],
  ['nl','v','I','fullWidth'], ['nl','q','I','fullHeight'], ['nl','u','I','trimX'], ['nl','p','I','trimY'], ['nl','r','I','width'], ['nl','n','I','height'], ['ll','x','[I','pixels'],
]) field(owner, original, type, to, spriteEvidence);
for (const [owner, original, descriptor, to, names] of [
  ['vd','a','([B)[Lvd;','decodeFrames',['encodedFrames']],
  ['vd','a','(Lgk;Ljava/lang/String;Ljava/lang/String;)[Lvd;','loadFrames',['archive','groupName','fileName']],
  ['vd','b','(Lgk;Ljava/lang/String;Ljava/lang/String;)Lvd;','loadFirstFrame',['archive','groupName','fileName']],
  ['df','a','(II)V','draw',['x','y']], ['df','a','(III)V','drawAlpha',['x','y','alpha256']],
  ['wp','<init>','(IIIIII[B[I)V','',['fullWidth','fullHeight','trimX','trimY','width','height','indices','palette']],
  ['wp','<init>','(III)V','',['width','height','paletteSize']],
  ['ll','<init>','(IIIIII[I)V','',['fullWidth','fullHeight','trimX','trimY','width','height','pixels']],
  ['ll','<init>','(II)V','',['width','height']],
  ['rd','<init>','(IIIIII[I)V','',['fullWidth','fullHeight','trimX','trimY','width','height','pixels']],
  ['rd','<init>','(II)V','',['width','height']],
  ['ll','d','()Lll;','copy',[]], ['ll','a','()Lll;','copyMirroredHorizontally',[]],
  ['ll','c','()V','rotateClockwise',[]], ['ll','b','()V','makeRasterTarget',[]],
  ['ha','a','(Lvd;Z)Lpa;','createSprite',['data','preferIndexed']],
]) method(owner, original, descriptor, to, names, spriteEvidence);
for (const [owner, original, type, to] of [
  ['jd','d','[[Lvd;','aircraftSpriteData'], ['hr','d','[[Lpa;','aircraftSprites'],
  ['oo','ab','[Lvd;','backgroundSpriteData'], ['na','c','[Lvd;','cloudSpriteData'],
  ['l','a','Lvd;','bulletSpriteData'], ['dc','g','Lpa;','bulletSprite'],
  ['tq','h','[Lvd;','smokeSpriteData'], ['ud','f','[Lvd;','explosionSpriteData'],
  ['fs','e','Lvd;','titleImageData'], ['mp','h','Lpa;','titleImage'],
  ['ps','f','[[Lvd;','gaugeSpriteData'], ['ii','k','[[Lpa;','gaugeSprites'],
  ['qq','e','[Lvd;','upgradeSpriteData'], ['bs','b','[Lpa;','upgradeSprites'],
  ['o','a','[Lvd;','radarSpriteData'], ['ec','e','[Lpa;','radarSprites'],
  ['eb','c','[Lvd;','counterPanelSpriteData'], ['ua','g','[Lpa;','counterPanelSprites'],
  ['kb','D','[Lvd;','scoreDigitSpriteData'], ['in','c','[Lpa;','scoreDigitSprites'],
  ['hq','a','[Lvd;','levelRingSpriteData'], ['jm','a','[Lpa;','levelRingSprites'],
  ['qa','a','[Lvd;','keySpriteData'], ['ac','f','[Lpa;','keySprites'],
  ['dl','m','[Lvd;','fontSpriteData'], ['hi','v','Lvs;','gameFontMetrics'], ['rb','j','Lda;','gameFont'],
  ['q','o','[Lvd;','bigFontSpriteData'], ['kn','b','Lvs;','bigFontMetrics'], ['se','c','Lda;','bigGameFont'],
  ['nc','a','[Lvd;','titleFontSpriteData'], ['dp','h','Lvs;','titleFontMetrics'], ['kn','a','Lda;','titleFont'],
  ['lt','v','Lvd;','woodenTileSpriteData'], ['qk','i','Lpa;','woodenTileSprite'],
  ['gu','a','[Lvd;','brassFrameSpriteData'], ['ko','g','[Lpa;','brassFrameSprites'],
  ['vl','b','[Lvd;','brassButtonSpriteData'], ['mb','u','[Lpa;','brassButtonSprites'],
  ['qk','a','[Lvd;','brassSliderSpriteData'], ['dl','n','[Lpa;','brassSliderSprites'],
  ['ol','e','[Lvd;','powerchuteSpriteData'], ['wm','i','[Lpa;','powerchuteSprites'],
  ['nu','b','[Lvd;','powerIconSpriteData'], ['po','e','[Lpa;','powerIconSprites'],
  ['tt','c','[Lvd;','powerBulbSpriteData'], ['uc','o','[Lpa;','powerBulbSprites'],
  ['la','g','[Lvd;','achievementSpriteData'], ['aa','a','[Lpa;','achievementSprites'],
  ['af','c','[Lvd;','medalSpriteData'], ['rs','u','[Lpa;','medalSprites'],
  ['vl','c','Lvd;','coinSpriteData'], ['lg','k','Lpa;','coinSprite'],
  ['es','i','Lvd;','lockedSpriteData'], ['ut','c','Lpa;','lockedSprite'],
  ['uc','g','Lvd;','unachievedSpriteData'], ['dh','k','Lpa;','unachievedSprite'],
]) field(owner, original, type, to, spriteEvidence);

const rendererTextEvidence = 'Reviewed renderer font reset/style routines, glyph calls, pen/baseline adjustment and public alignment wrappers; parameter order and all mask/image/guard behavior remain unchanged.';
for (const [owner, original, to] of [
  ['rs','t','rendererStrikethroughColor'], ['rb','h','rendererUnderlineColor'],
  ['tf','a','rendererDefaultTextColor'], ['qg','c','rendererCurrentTextColor'],
  ['em','d','rendererDefaultShadowColor'], ['es','c','rendererCurrentShadowColor'],
  ['tm','i','rendererSpaceExpansionQ8'], ['ed','i','rendererJustificationRemainderQ8'],
]) field(owner, original, 'I', to, rendererTextEvidence);
for (const [original, descriptor, to, names] of [
  ['a','(IIILjava/lang/String;II)V','drawText',['textColor','shadowColor','leftX','text','obfuscationGuard','baselineY']],
  ['a','(Ljava/lang/String;IIIIB)V','drawRightAlignedText',['text','textColor','shadowColor','rightX','baselineY','obfuscationGuard']],
  ['a','(IIIIILjava/lang/String;)V','drawCenteredText',['obfuscationGuard','textColor','shadowColor','baselineY','centerX','text']],
  ['a','(II[Lpa;IILjava/lang/String;I[I)V','drawTextWithImages',['textColor','shadowColor','inlineImages','leftX','maskY','text','baselineY','inlineImageBaselineOffsets']],
  ['a','(II[IBILjava/lang/String;I[Lpa;)V','drawRightAlignedTextWithImages',['shadowColor','textColor','inlineImageBaselineOffsets','obfuscationGuard','baselineY','text','rightX','inlineImages']],
  ['a','(III)V','resetTextStyle',['shadowColor','underlineColor','textColor']],
  ['a','(Ljava/lang/String;I)V','applyStyleTag',['tag','obfuscationGuard']],
  ['a','(IBLjava/lang/String;)V','prepareJustification',['targetWidth','obfuscationGuard','text']],
  ['a','(I[Lpa;ILjava/lang/String;B[IILaa;I)V','drawStyledText',['maskX','inlineImages','penX','text','obfuscationGuard','inlineImageBaselineOffsets','baselineY','mask','maskY']],
  ['fa','(CIIIZ)V','drawGlyph',['glyph','x','y','color','shadowPass']],
  ['a','(CIIIZLaa;II)V','drawGlyphWithMask',['glyph','x','y','color','shadowPass','mask','maskX','maskY']],
  ['a','(IIIZIIIII[Lpa;Laa;I[IIILjava/lang/String;)I','drawParagraph',['maskY','left','textColor','obfuscationGuard','shadowColor','horizontalAlignment','top','lineSpacing','maskX','inlineImages','mask','verticalAlignment','inlineImageBaselineOffsets','width','height','text']],
  ['a','(IIILaa;IILjava/lang/String;IIIII[Lpa;I[III)I','drawParagraphInternal',['height','shadowColor','maximumLines','mask','verticalAlignment','textColor','text','width','horizontalAlignment','top','maskY','lineSpacing','inlineImages','obfuscationGuard','inlineImageBaselineOffsets','left','maskX']],
]) method('da', original, descriptor, to, names, rendererTextEvidence);
for (const [original, type, to] of [['i','Lgr;','input'], ['d','I','screenId'], ['a','I','previousActionId'],
  ['c','I','pendingClickX'], ['b','I','pendingClickY'], ['e','I','selectedAchievementId'], ['h','I','soundPreviewCooldown']])
  field('nk', original, type, to, 'Reviewed menu construction, action/hover dispatch, click consumption and achievement/volume rendering.');
for (const [original, descriptor, to, names] of [
  ['<init>', '(I)V', '', ['screenId']],
  ['a', '(ZI)V', 'open', ['pointerSelection', 'obfuscationGuard']],
  ['b', '(I)V', 'advanceMenu', ['obfuscationGuard']],
  ['a', '(ILha;I)V', 'drawMenu', ['verticalOffset', 'renderer', 'obfuscationGuard']],
  ['a', '(ZII)V', 'handleAction', ['pointerSelection', 'obfuscationGuard', 'itemIndex']],
  ['a', '(I)V', 'handleNavigationKey', ['obfuscationGuard']],
  ['a', '(III)I', 'findItemAt', ['obfuscationGuard', 'pointerX', 'pointerY']],
  ['a', '(IB)Z', 'isItemEnabled', ['itemIndex', 'obfuscationGuard']],
  ['a', '(IZ)I', 'getItemTop', ['itemIndex', 'obfuscationGuard']],
  ['a', '(II)I', 'getItemLeft', ['itemIndex', 'obfuscationGuard']],
  ['c', '(II)I', 'getItemRight', ['obfuscationGuard', 'itemIndex']],
  ['b', '(ZI)I', 'getItemHeight', ['obfuscationGuard', 'itemIndex']],
  ['b', '(IZ)Ljava/lang/String;', 'formatGroupedInteger', ['value', 'obfuscationGuard']],
  ['b', '(II)V', 'drawInstructions', ['obfuscationGuard', 'verticalOffset']],
  ['d', '(II)V', 'drawHighscores', ['obfuscationGuard', 'verticalOffset']],
  ['b', '(ZII)V', 'drawAchievements', ['alternateView', 'verticalOffset', 'obfuscationGuard']],
  ['a', '(IIIZLha;)V', 'drawItem', ['verticalOffset', 'itemIndex', 'obfuscationGuard', 'selected', 'renderer']],
]) method('nk', original, descriptor, to, names, 'Reviewed menu layout, drawing, input and action dispatch in the pinned Ace source.');
for (const [original, type, to] of [['g','I','selectedIndex'], ['c','I','itemCount'], ['d','I','heldButton'],
  ['a','I','pressedButton'], ['e','I','keyCode'], ['j','I','repeatCountdown'], ['f','Z','pointerSelection']])
  field('gr', original, type, to, 'Reviewed menu keyboard, pointer ownership, selection and held-button repeat transitions.');
for (const [original, descriptor, to, names] of [
  ['<init>', '(I)V', '', ['itemCount']],
  ['a', '(Z)V', 'handleVerticalKey', ['obfuscationGuard']],
  ['c', '(B)V', 'handleHorizontalKey', ['obfuscationGuard']],
  ['d', '(B)V', 'captureKey', ['obfuscationGuard']],
  ['a', '(BI)V', 'setSelectedIndex', ['obfuscationGuard', 'itemIndex']],
  ['a', '(ZIII)V', 'resetSelection', ['pointerSelection', 'pointerItemIndex', 'heldButton', 'keyboardItemIndex']],
  ['a', '(III)V', 'updatePointer', ['pressedItemIndex', 'hoveredItemIndex', 'obfuscationGuard']],
  ['e', '(B)Z', 'isActivated', ['obfuscationGuard']],
  ['a', '(B)Z', 'isPointerHeld', ['obfuscationGuard']],
  ['a', '(I)Z', 'isLeftPressed', ['obfuscationGuard']],
  ['b', '(B)Z', 'isRightPressed', ['obfuscationGuard']],
  ['d', '(I)Z', 'isHomePressed', ['obfuscationGuard']],
  ['b', '(I)Z', 'isEndPressed', ['obfuscationGuard']],
]) method('gr', original, descriptor, to, names, 'Menu input data flow and the explicit AWT-to-client key table: arrows 96..99, Home 102, End 103, activation 83/84.');
for (const [owner, original, type, to] of [
  ['aa','b','[Lnk;','menuScreens'], ['ua','l','[[I','menuActions'], ['du','p','[Ljava/lang/String;','menuActionLabels'],
  ['bk','e','[I','menuTop'], ['oo','Y','[I','menuRowSpacing'], ['dt','a','[I','menuLeft'], ['ak','f','[I','menuRight'],
  ['bk','f','I','lastKeyCode'], ['vj','d','I','pressedMouseButton'], ['vu','f','I','heldMouseButton'],
  ['uu','e','Z','pointerMoved'], ['pn','d','I','menuInitialRepeatDelay'], ['wm','h','I','menuRepeatDelay'],
  ['po','h','I','activeMenuId'], ['ci','d','I','nextMenuId'], ['ec','t','I','menuTransitionTicks'],
  ['vq','w','I','instructionPage'], ['co','b','I','returnMenuId'], ['or','a','I','score'],
  ['kp','b','Ljava/lang/String;','thousandsSeparator'],
]) field(owner, original, type, to, 'Reviewed menu registration, key/pointer snapshots, transition dispatch, instructions and HUD score consumers.');
method('eu', 'a', '(BIZ)V', 'requestMenu', ['obfuscationGuard', 'screenId', 'pointerSelection'],
  'Resets transition ticks, stores nextMenuId and opens its MenuScreen when nonnegative.');
method('za', 'a', '(I[IIIIIB)V', 'registerMenuLayout', ['rowSpacing', 'actions', 'top', 'left', 'screenId', 'right', 'obfuscationGuard'],
  'Stores the action table and exact per-screen layout arrays.');

// Flight controls and wave/purchase state retain the original integer scales.
const flightEvidence = 'Reviewed player control, wave generation, death/respawn, upgrade purchase and rendering consumers in FlightSession; native fixtures retain boundary behavior.';
for (const [owner, original, type, to] of [
  ['md','p','Z','braking'], ['md','t','I','lifecyclePhase'], ['md','w','I','aimStallTicks'],
  ['pk','M','I','controlTick'], ['pk','T','I','lastLeftPressTick'], ['pk','ib','I','lastRightPressTick'],
  ['pk','U','Z','leftHeldLastTick'], ['pk','rb','Z','rightHeldLastTick'], ['pk','mb','I','doubleTapTurnDirection'],
  ['pk','B','Z','overheatFireLatch'], ['pk','D','Lkc;','scratchPosition'],
  ['pk','s','I','classicWaveIndex'], ['pk','xb','I','completedWaveCount'], ['pk','p','I','upgradeCredits'],
  ['pk','lb','I','victoryCountdown'], ['pk','jb','I','respawnInvulnerabilityTicks'], ['pk','ub','I','respawnDelayTicks'],
  ['pk','m','Z','noLivesLost'], ['pk','h','I','musicLayerPresetIndex'], ['pk','ob','Z','alternateMusicActive'],
  ['pk','l','I','scorchMarkCount'], ['pk','W','Z','manualMusicLayers'], ['pk','j','Z','debugControlsEnabled'],
  ['lp','a','[Z','heldKeys'], ['ci','i','Ljava/util/Random;','gameRandom'],
  ['gh','j','Lgb;','playerDefinition'], ['ub','h','Lgb;','basePlayerDefinition'],
  ['ip','a','[[I','classicWaveCompositions'], ['oe','f','[Ljava/lang/String;','classicWaveMessages'],
  ['sd','d','[[Z','musicLayerPresets'], ['wd','t','Lkp;','hudMessages'],
  ['uh','g','[Lal;','upgradeSounds'], ['ae','h','[Ljava/lang/String;','upgradeLabels'],
  ['qn','b','Ltp;','pcmMixer'], ['di','M','Lkp;','activeSoundPlaybacks'], ['lj','c','[Lal;','aircraftEngineSamples'],
]) field(owner, original, type, to, flightEvidence);
for (const [original, descriptor, to, names] of [
  ['b','(B)V','updatePlayerControls',['obfuscationGuard']],
  ['a','(B)V','handleKeyEvent',['obfuscationGuard']],
  ['f','(I)V','startClassicWave',['obfuscationGuard']],
  ['a','(BI)V','startArcadeWave',['obfuscationGuard','waveNumber']],
  ['b','(BI)Lgb;','getArcadeAircraftDefinition',['obfuscationGuard','typeIndex']],
  ['a','(II)V','purchaseUpgrade',['baseCost','upgradeCode']],
  ['a','(I)V','spawnWingman',['obfuscationGuard']],
  ['e','(II)V','addScore',['points','obfuscationGuard']],
  ['a','(ZLmd;)V','advanceDestroyedAircraft',['obfuscationGuard','aircraft']],
  ['a','(Z)V','stopAircraftEngineSounds',['obfuscationGuard']],
  ['c','(B)V','startAttractMode',['obfuscationGuard']],
  ['e','(I)V','resumeGame',['obfuscationGuard']],
  ['h','(I)V','drawWorld',['obfuscationGuard']],
  ['a','(Lha;I)V','drawHud',['renderer','obfuscationGuard']],
  ['a','(Lha;II)V','drawRadar',['renderer','insetOffset','obfuscationGuard']],
  ['a','(IBLjava/lang/String;)V','queueHudMessage',['colour','obfuscationGuard','text']],
  ['a','(IBILjava/lang/String;)V','queueTimedHudMessage',['holdTicks','obfuscationGuard','colour','text']],
  ['b','(I)V','setMusicLayersImmediately',['obfuscationGuard']],
  ['b','(II)V','fadeMusicLayers',['obfuscationGuard','volumeStep']],
  ['a','(ZI)V','removePickup',['obfuscationGuard','index']],
  ['d','(II)V','removeBullet',['obfuscationGuard','index']],
  ['f','(II)V','removeScorchMark',['index','obfuscationGuard']],
]) method('pk', original, descriptor, to, names, flightEvidence);
for (const [original, type, to] of [['i','I','ageTicks'], ['f','I','fadeInTicks'], ['h','I','holdTicks'],
  ['l','I','fadeOutTicks'], ['j','I','colour'], ['k','Ljava/lang/String;','text']])
  field('tb', original, type, to, 'HudMessage constructor, phase comparisons, alpha/vertical interpolation and queued message callers.');
method('tb','<init>','(Ljava/lang/String;I)V','',['text','colour'],flightEvidence);
method('tb','<init>','(Ljava/lang/String;II)V','',['text','colour','holdTicks'],flightEvidence);
method('tb','a','(I)Z','advanceAndIsExpired',['obfuscationGuard'], 'Increments message age, then compares with fade-in + hold + fade-out using strict greater-than.');
method('tb','d','(I)V','draw',['exitBottomOffset'], 'Three text drawing phases, preserving the original fixed entry/hold positions and caller-provided exit offset.');
method('tp','b','(Lrf;)V','addSubstream',['stream'],'Adds a PCM substream to the mixer intrusive list under synchronization.');
method('tp','a','(Lrf;)V','removeSubstream',['stream'],'Unlinks a mixer PCM substream under synchronization.');

// Visual state is named from storage/update/render data flow and asset literals.
const visualEvidence = 'Reviewed FlightSession HUD/world rendering, particle integration, asset loading and spawn/update consumers; native fixtures preserve arithmetic and pool behavior.';
for (const [owner, original, type, to] of [
  ['pk','a','I','displayedWeaponHeat'], ['pk','bb','I','temporaryWeaponOpacity'], ['pk','eb','I','displayedHealthPercent'],
  ['pk','qb','I','displayedTemporaryWeaponTicks'], ['pk','gb','I','displayedTemporaryWeaponType'],
  ['pk','v','I','displayedUpgradeCredits'], ['pk','f','I','targetUpgradeCredits'], ['pk','Db','I','creditAnimationTicks'],
  ['pk','y','I','sampledUpgradeCredits'], ['pk','G','I','multiplierPanelHidePhase'], ['pk','R','I','hudHidePhase'],
  ['pk','hb','D','cameraLookAheadX'], ['pk','u','D','cameraLookAheadY'], ['pk','fb','I','backgroundTileX'], ['pk','O','I','backgroundTileY'],
  ['pk','sb','I','backgroundTint'], ['pk','k','I','targetBackgroundTint'], ['pk','o','I','previousBackgroundTint'],
  ['pk','db','I','backgroundTintBlendTicks'], ['pk','zb','I','lightningCountdown'], ['pk','L','I','lightningRandomBound'],
  ['pk','Eb','Z','invulnerabilityCheat'], ['pk','r','[I','upgradeFlashTicks'], ['pk','wb','Ll;','rendererManager'],
  ['qf','g','I','lifetimeTicks'], ['qf','j','I','depthPhase'], ['qf','l','I','colourOrBlastRadius'],
  ['vc','b','I','worldX'], ['vc','d','I','worldY'], ['vc','e','I','diameter'], ['vc','c','I','spriteIndex'],
  ['ok','k','I','xQ8'], ['ok','n','I','yQ8'], ['ok','m','I','radiusQ8'],
  ['ok','c','I','previousXQ8'], ['ok','g','I','previousYQ8'], ['ok','b','I','xVelocityQ8'],
  ['ok','i','I','yVelocityQ8'], ['ok','l','I','radiusVelocityQ8'], ['ok','a','I','xAccelerationQ8'],
  ['ok','f','I','yAccelerationQ8'], ['ok','j','I','radiusAccelerationQ8'],
  ['ok','h','I','ageTicks'], ['ok','d','I','durationTicks'], ['ok','e','I','renderMode'], ['ok','p','I','alphaScale'],
  ['co','i','[Lpa;','scorchSprites'], ['gn','b','[Lvd;','scorchSpriteData'], ['es','b','[Lpa;','smokeSprites'],
  ['bl','b','[Lpa;','explosionSprites'], ['is','a','[Lpa;','backgroundSprites'], ['sd','k','[Lpa;','cloudSprites'],
]) field(owner, original, type, to, visualEvidence);
for (const [owner, original, descriptor, to, names] of [
  ['pk','a','(BLkc;)V','advanceBackground',['obfuscationGuard','cameraMovement']],
  ['pk','a','(Lkc;ILkc;)I','computeSpatialVolume',['listenerPosition','maximumVolumeAndGuard','sourcePosition']],
  ['pk','a','(Lmd;ILmd;)I','computeDopplerPitchStep',['sourceAircraft','obfuscationGuard','listenerAircraft']],
  ['pk','a','(Lmd;I)V','emitAircraftScorchMark',['aircraft','obfuscationGuard']],
  ['pk','a','(IIII)V','emitScorchMark',['worldY','obfuscationGuard','worldX','diameter']],
  ['pk','a','(Lkc;II)V','emitPickup',['position','obfuscationGuard','pickupCode']],
  ['pk','a','(Lkc;IIII)V','emitDepthSmoke',['position','colourOrBlastRadius','lifetimeTicks','obfuscationGuard','depthPhase']],
  ['pk','a','(IIIIIIB)V','emitBurstScreenParticle',['radiusQ8','xQ8','durationTicks','yAccelerationQ8','yQ8','spreadQ8','obfuscationGuard']],
  ['pk','a','(IIIBIII)V','emitGrowingScreenParticle',['growthStepQ8','xQ8','radiusQ8','obfuscationGuard','durationTicks','yQ8','alphaScale']],
  ['pk','a','(BID)D','computePhaseScale',['obfuscationGuard','depthPhase','normalScale']],
  ['pk','b','(IIII)I','blendArgb',['foregroundWeight','foreground','redBlueMask','background']],
  ['pk','i','(I)V','releaseStaticReferences',['obfuscationGuard']],
  ['qf','a','(IIIILkc;)V','spawnAtDepth',['lifetimeTicks','obfuscationGuard','colourOrBlastRadius','depthPhase','position']],
  ['qf','a','(ILkc;II)V','spawn',['obfuscationGuard','position','colourOrBlastRadius','lifetimeTicks']],
  ['vc','a','(IIIB)V','spawn',['diameter','worldX','worldY','obfuscationGuard']],
  ['ok','a','(IIIIIIIIIIIII)V','initializeMotion',['yAccelerationQ8','radiusAccelerationQ8','yVelocityQ8','radiusQ8','radiusVelocityQ8','xVelocityQ8','xQ8','renderMode','yQ8','durationTicks','ageTicks','xAccelerationQ8','alphaScale']],
  ['ok','a','(IIIIIII)V','spawnBurst',['yAccelerationQ8','xQ8','spreadQ8','durationTicks','yQ8','radiusQ8','obfuscationGuard']],
  ['ok','a','(IZIIIII)V','spawnGrowingSprite',['xQ8','obfuscationGuard','durationTicks','growthStepQ8','radiusQ8','alphaScale','yQ8']],
]) method(owner, original, descriptor, to, names, visualEvidence);

// Shared highscore transport, verified from encoding/decoding and UI consumers.
const highscoreEvidence = 'Reviewed query factory, client packet serialization/response decoder, acknowledgement routing and highscore result matching; same shared roles as GeoBlox.';
for (const [owner, original, type, to] of [
  ['uc','i','Z','completed'], ['uc','h','[[I','valuesByView'], ['uc','e','[[Ljava/lang/String;','namesByView'],
  ['uc','n','I','queryId'], ['uc','j','I','entryLimit'], ['uc','m','I','valuesPerEntry'], ['uc','f','[[J','submissionTokensByView'],
  ['ga','e','I','firstShortValue'], ['ga','k','I','secondShortValue'], ['ga','m','I','submissionId'],
  ['ga','i','I','firstContextValue'], ['ga','g','I','secondContextValue'], ['ga','n','I','thirdContextValue'],
  ['ga','f','I','fourthContextValue'], ['ga','h','[I','scores'], ['ga','j','J','submissionToken'],
  ['gl','e','Ljava/lang/String;','primaryName'], ['gl','f','Ljava/lang/String;','alternateName'], ['gl','g','Z','usedInUniqueView'],
  ['nh','g','Lkp;','pendingHighscoreQueries'], ['tq','d','Lkp;','pendingScoreSubmissions'], ['am','a','I','nextScoreSubmissionId'],
  ['ql','r','Luc;','activeHighscoreQuery'], ['to','r','Lga;','lastScoreSubmission'],
  ['cs','a','I','highscoreMode'], ['oc','e','I','highscoreView'], ['pe','b','[Lgl;','highscoreNameEntries'],
  ['cf','h','Ljava/lang/String;','normalizedPlayerName'], ['fj','a','Ljava/lang/String;','playerDisplayName'],
  ['q','p','Ldl;','outgoingPacket'], ['nm','c','Ldl;','incomingPacket'],
]) field(owner, original, type, to, highscoreEvidence);
for (const [owner, original, descriptor, to, names] of [
  ['ga','<init>','(IIIIII[I)V','', ['firstShortValue','secondShortValue','firstContextValue','secondContextValue','thirdContextValue','fourthContextValue','scores']],
  ['vo','a','(BIIII)Luc;','requestHighscores', ['obfuscationGuard','opcode','entryLimit','valuesPerEntry','queryId']],
  ['ag','a','(IILuc;)V','writeHighscoreQuery', ['opcode','payloadLength','query']],
  ['ac','a','(IILga;)V','writeScoreSubmission', ['firstScoreIndex','opcode','submission']],
  ['ak','a','(Lga;ZI)V','queueScoreSubmission', ['submission','obfuscationGuard','opcode']],
  ['ce','a','(B)V','decodeHighscoreResponse', ['obfuscationGuard']],
  ['ca','a','(Luc;BILga;)I','findSubmittedScoreRow', ['query','obfuscationGuard','viewIndex','submission']],
  ['pl','c','(II)V','resendPendingHighscores', ['opcode','obfuscationGuard']],
  ['pk','g','(I)V','submitFinalScore', ['obfuscationGuard']],
  ['fd','a','(Ljava/lang/String;B)Z','isCurrentPlayerName', ['displayName','obfuscationGuard']],
  ['vu','a','(ILjava/lang/CharSequence;)Ljava/lang/String;','normalizePlayerName', ['obfuscationGuard','displayName']],
  ['dl','g','(II)V','writeCipheredOpcode', ['obfuscationGuard','opcode']],
  ['dl','a','(Z[I)V','initializeOpcodeCipher', ['obfuscationGuard','seed']],
  ['rb','e','(II)I','appendCrc32', ['startPosition','obfuscationGuard']],
  ['rb','b','(IB)V','patchByteLength', ['payloadLength','obfuscationGuard']],
  ['rb','h','(I)Ljava/lang/String;','readNullTerminatedText', ['obfuscationGuard']],
]) method(owner, original, descriptor, to, names, highscoreEvidence);

// Lexical ordinals bind each reviewed local to the exact pinned declaration.
// Shared compiler temporaries stay unresolved instead of receiving false roles.
for (const [owner, signature, locals] of [
  ['vd', 'a([B)[Lvd;', [
    [23,'dupTemp$1','rowAlphaByte'], [31,'dupTemp$0','columnAlphaByte'], [25,'stackIn_49_0','previousRowAlphaMask'],
    [26,'stackIn_50_1','rowNonOpaqueBit'], [33,'stackIn_64_0','previousColumnAlphaMask'], [34,'stackIn_65_1','columnNonOpaqueBit'],
    [0,'var1','reader'], [1,'var2','frameCount'], [2,'var3','frames'],
    [3,'var4','allocationIndex'], [5,'var5','fullHeight'], [6,'var6','paletteSize'],
    [7,'var7_int','leftPaddingFrameIndex'], [13,'var7','palette'], [14,'var8','paletteIndex'],
    [12,'var8_ref_vd','frameForPadding'], [17,'var9','frame'], [18,'var10','pixelCount'],
    [19,'var11','storageFlags'], [35,'var12','indexOnlyPixel'], [37,'var13','indexOnlyY'],
    [24,'var14','rowAlphaValue'], [32,'var15','columnAlphaValue'], [4,'var4Lifetime1','fullWidth'],
    [8,'var7_intLifetime1','topPaddingFrameIndex'], [9,'var7_intLifetime2','widthFrameIndex'], [10,'var7_intLifetime3','heightFrameIndex'],
    [11,'var7_intLifetime4','paddingFrameIndex'], [15,'var8Lifetime1','paletteFrameIndex'], [16,'var8Lifetime2','frameIndex'],
    [36,'var12Lifetime1','indexOnlyX'], [20,'var12Lifetime2','nonOpaqueAlphaMask'], [21,'var13Lifetime1','alphaFrameIndexPixel'],
    [27,'var13Lifetime2','alphaFrameIndexX'], [28,'var14Lifetime1','alphaFrameIndexY'], [22,'var13Lifetime1Lifetime1','rowAlphaPixel'],
    [29,'var13Lifetime2Lifetime1','columnAlphaX'], [30,'var14Lifetime1Lifetime1','columnAlphaY'],
  ]],
  ['pk', 'b(B)V', [
    [11,'var2','failure'], [1,'var3','obfuscationControl'],
  ]],
  ['pk', 'f(I)V', [
    [1,'var2','waveComposition'], [5,'var2_ref','failure'], [2,'var3','remainingPickupBudget'],
  ]],
  ['pk', 'a(BI)V', [
    [7,'var6','aircraftCosts'], [8,'var7','remainingPickupCarriers'], [9,'var8','typeIndex'],
    [0,'var9','obfuscationControl'],
  ]],
  ['pk', 'c(BI)Z', [
    [9,'var3','failure'], [2,'var4','wingmanCount'], [3,'var5','aircraftToCount'],
    [4,'var6','aircraftIndex'], [5,'var7','candidate'], [0,'var8','obfuscationControl'],
    [7,'var4Lifetime1','particleIndex'],
  ]],
  ['pk', 'a(II)V', [
    [0,'var3_int','cost'], [2,'var3','failure'],
  ]],
  ['pk', 'b(BI)Lgb;', [
    [1,'var3_int','selectedType'], [10,'var3','failure'], [0,'var4','obfuscationControl'],
  ]],
  ['ce', 'a(B)V', [
    [0,'var8_int','nameEntryIndex'], [4,'var19','rowIndex'], [10,'var2','responseKind'],
    [11,'var3','queryId'], [12,'var4','query'], [13,'var4_long','acknowledgementToken'],
    [14,'var5','nameEntryCount'], [15,'var6','entryLimit'], [16,'var6_ref_ga','submission'],
    [17,'var7','valuesPerEntry'], [18,'var8','namesByView'], [19,'var9','alternateNamesByView'],
    [20,'var10','submissionTokensByView'], [21,'var11','valuesByView'], [22,'var12','allRowCount'],
    [23,'var13','ownRowCount'], [24,'var14','uniqueRowCount'], [25,'var15','allValueOffset'],
    [26,'var16','ownValueOffset'], [27,'var17','uniqueValueOffset'], [28,'var18','rowCount'],
    [29,'var20','nameIndex'], [30,'var21','displayName'], [31,'var22','submissionToken'],
    [32,'var24','valuesStartPosition'], [33,'var25','allValueIndex'], [34,'var26','obfuscationControl'],
    [35,'var28','packet'], [36,'var3Lifetime1','submissionId'], [37,'var25Lifetime1','ownValueIndex'],
    [38,'var25Lifetime2','uniqueValueIndex'],
  ]],
  ['ca', 'a(Luc;BILga;)I', [
    [0,'var6','rowIndex'], [1,'var7','valueIndex'], [12,'var4_int','valuesPerEntry'],
    [14,'var5','rowCount'], [15,'var8','obfuscationControl'], [16,'decompiledFrameCompleted0','allValuesMatch'],
  ]],
  ['vo', 'a(BIIII)Luc;', [
    [1,'var5_ref','existingQuery'], [2,'var6','obfuscationControl'], [3,'var5_refLifetime1','newQuery'],
  ]],
  ['ac', 'a(IILga;)V', [
    [0,'var7','packet'], [1,'var8','packetAlias'], [2,'var4','payloadStartPosition'],
    [3,'var5','scoreIndex'], [4,'var6','obfuscationControl'],
  ]],
  ['ag', 'a(IILuc;)V', [
    [0,'var3','packet'],
  ]],
  ['pl', 'c(II)V', [
    [0,'var3','obfuscationControl'], [1,'var4','submission'], [2,'var5','query'],
  ]],
  ['pk', 'a(IIIZIIIZI)V', [
    [1,'var10_int','foldHeight'], [12,'var10','failure'], [2,'var11','shadeAlpha'],
    [3,'var12','renderer'], [4,'var13','settledBankPending'], [5,'var14','targetBankPending'],
    [7,'var15','skipZeroSuppression'], [8,'var16','settledGlyphIndex'], [9,'var17','targetGlyphIndex'],
    [0,'var18','obfuscationControl'], [10,'decompiledSharedTail0','drawSettledFold'],
  ]],
  ['pk', 'a(ZZ)V', [
    [13,'var3','cameraMovement'], [80,'var3_ref','failure'], [14,'var4_ref_md__','aircraftToAdvance'],
    [17,'var6_ref_md','advancingAircraft'], [57,'var6_ref_o__','backgroundToRecenter'], [63,'var6_ref_wm__','pickupsToRecenter'],
    [65,'var6_ref_eu__','bulletsToRecenter'], [67,'var6_ref_qf__','smokeParticlesToRecenter'], [72,'var6','viewportMinimumExtent'],
    [37,'var8_ref_md','populationAircraft'], [54,'var8_ref_md__','aircraftForSpawnCheck'], [59,'var8_ref_o','backgroundBody'],
    [64,'var8_ref_wm','pickupToRecenter'], [66,'var8_ref_eu','bulletToRecenter'], [69,'var8_ref_qf','smokeToRecenter'],
    [73,'var8','minimumCameraScale'], [27,'var10_ref_md__','aircraftForWaveCount'], [56,'var10_ref_md','spawnObstacle'],
    [74,'var10','attractCameraScale'], [29,'var12_ref_md','waveAircraft'], [75,'var12','maximumCameraScale'],
    [76,'var14','playerPosition'], [77,'var15','scaledPlayerOffsetX'], [78,'var17','scaledPlayerOffsetY'],
    [10,'var19','obfuscationControl'], [48,'var4_ref_md__Lifetime1','aircraftForAttractPlayer'], [49,'var6_ref_mdLifetime1','attractPlayerCandidate'],
    [60,'var6_ref_md__Lifetime1','aircraftToRecenter'], [62,'var8_ref_mdLifetime1','aircraftToShift'],
  ]],
  ['pk', 'b(Lmd;I)V', [
    [6,'var3','aircraftCandidates'], [8,'var5','candidateAircraft'], [9,'var6','obfuscationControl'],
  ]],
  ['md', 'a(IBLmd;)V', [
    [11,'var4_int','targetLeadDistance'], [12,'var4','failure'], [13,'var5','forwardDistanceSquared'],
    [14,'var7','leftDistanceSquared'], [15,'var9','rightDistanceSquared'], [16,'var11','turnRate'],
    [19,'var14','targetAlignment'], [20,'var16','obfuscationControl'], [21,'var13Lifetime1','turnDirection'],
  ]],
]) for (const [ordinal, originalName, to] of locals)
  members[`L:${owner}.${signature}#${ordinal}`] = {to, expectedOriginalName: originalName,
    evidence: 'Reviewed lexical declaration and its data flow in the pinned Ace source.'};

export const aceConfig = {
  game: 'aceofskies', version: 11, sourceCommit: 'b168d7edeb104599156b5f908df62dfdc9f3b250', classes, members,
  workflowFiles: ['build-aceofskies-rules.mjs', 'reproduce-aceofskies.mjs', 'reviewed-game.mjs',
    'tests/test-aceofskies-core.mjs', 'tests/test-aceofskies-highscores.mjs', 'tests/test-aceofskies-hud.mjs', 'reconstruct-aceofskies.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  prepareInput: reconstructAceMethods,
  verifyCore: (input, named, mapping, classpath, temporary) => verifyAceCore(input, named, mapping, classpath, temporary,
    rawClasses => ({hud: verifyAceHud(rawClasses, classpath, temporary)})),
  readingGuide(rules, mapping) {
    return ['# Reading Ace of Skies', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/aceofskies-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names; renamed names have no opaque suffix.`, '',
      'Start at `AceOfSkies.advanceGame` → `FlightSession.advanceSession`. `startGame` creates the player and pools; its flag selects the literal arcade mode. `renderSession` draws through `GraphicsRenderer`. `Aircraft` retains its definition, target, pursuing aircraft, firing request and temporary weapon. `FlightBody` and `Vector2` expose the flight arithmetic. `Bullet`, `Pickup`, `SmokeParticle` and `ScreenParticle` are distinct pools.', '',
      '`GameAppletShell` calls `initializeClient`, `updateClient`, `renderGame`, `shutdownClient` and `releaseClientStatics`. Ace opens its game archives in `initializeGameResources`; `advanceResourceLoading` first waits for archives, builds sound caches, decodes the three music tracks, prepares patches, decodes image/font data, creates renderer resources and finally allocates the session. `initializeAfterDownload` controls whether the archive-ready poll proceeds into initialization. The inter-stage `resetFrameTiming` calls reset the clock/history and pending tick count, rather than requesting garbage collection. `loadingPercent` and `loadingMessage` expose reported progress.', '',
      '`MenuScreen.open`, `advanceMenu`, `handleNavigationKey`, `handleAction`, `findItemAt` and `drawMenu` expose menu flow. `MenuInputState` distinguishes keyboard selection, pointer selection, press edges, held buttons and countdown state. The registered slots are 0 main menu, 1 pause, 2 highscores, 3 instructions, 4 achievements, 5 achievements this game, 6 logged-out result notice, and 7 settings. Menu action codes remain their original integers; action 0 starts classic play, 19 starts arcade play, 1 resumes, 3 opens instructions, 14 opens achievements, 2 opens highscores, 22 opens settings and 7 ends the game.', '',
      '`updatePlayerControls` exposes left/right press edges, double-tap braking and the overheat fire latch. The tick counter advances even in attract mode; a second turn press must be strictly fewer than 50 control ticks after the previous press. Releasing fire clears the latch without setting a new fire request. `lifecyclePhase` rises to 92 on living aircraft and falls toward 2 while destroyed aircraft animate; it is distinct from weapon heat.', '',
      '`startClassicWave` uses `classicWaveIndex` and `classicWaveCompositions`; `startArcadeWave` partitions a doubled wave budget using aircraft costs. Their type order differs, and the early classic type-3 definition changes after wave 10. `purchaseUpgrade` spends baseCost + upgradeCode only after acceptance. A fire-rate upgrade can increment its level and still return false when its fire interval is already 1; that edge behavior remains. `HudMessage` owns the queued text fade/hold/expiry phases.', '',
      '`ScorchMark` replaces the earlier inaccurate TimedSpriteEffect name: the asset is literally scorch, the stored value is its diameter, and no timer advances it. Marks are removed by viewport culling. `SmokeParticle.ageTicks` starts at 10 and increases by five until its lifetime limit; a negative colourOrBlastRadius selects the explosion path. Screen particles expose Q8 position/radius, velocity, acceleration, previous endpoints, render mode, age, duration and opacity scale.', '',
      'HUD state separates displayed/target credits and countdowns, sampled affordability, smoothed health/heat/weapon ticks, and the last displayed weapon icon during opacity fades. Background tile coordinates, tint interpolation, lightning timing and camera look-ahead are independent from aircraft coordinates. Spatial volume and Doppler pitch helpers retain reference-identity shortcuts and the original distance/zoom clamps.', '',
      '`HighscoreQuery`, `ScoreSubmission` and `HighscoreNameEntry` share established roles with GeoBlox. `requestHighscores` deduplicates pending queries by queryId. `writeHighscoreQuery` and `writeScoreSubmission` preserve the original packet framing, context values and CRC32. `decodeHighscoreResponse` builds all/my/best-player views, completes and unlinks queries, and matches submission acknowledgements by a wrapping 16-bit ID. `findSubmittedScoreRow` checks the player name, server token and every score value. Ace packs its game score and accuracy as 100 * finalScore + finalAccuracyPercent; the four opaque context integers retain positional names rather than unsupported meanings.', '',
      '`drawRollingDigits` names settled/target values, animation countdown, leading-zero suppression and glyph banks. Displayed score/multiplier and their pending targets remain separate until their countdown reaches zero. The number formatter uses the retained separator and preserves ungrouped negative values.', '',
      'Angles in forward/polar motion use 256 units per full turn. `Vector2.angle255` preserves the separate original atan2 scaling by 255 / pi and its zero-vector value 255. `FlightBody.moveForward` subtracts sine/cosine motion and also decays headingOffset. `wrapWorld` retains its single-period boundary adjustments, including out-of-range results for positions multiple periods away. All guard parameters and unusual edge behavior remain.', '',
      'The shared engine roles match other games by reviewed behavior, not by short obfuscated spelling:', '',
      '| Ace | Existing counterpart | Evidence |', '| --- | --- | --- |',
      '| IntrusiveNode / IntrusiveDeque | GeoBlox IntrusiveNode / IntrusiveDeque | Independent node ownership, circular sentinel and forward/reverse links. |',
      '| DualLinkNode / IntrusiveNodeHashTable | GeoBlox equivalents | Secondary links detach independently; hash buckets have circular sentinels, masked keys, duplicate-key lookup and bucket-order traversal. |',
      '| PacketBuffer / CipherPacketBuffer | Steel Sentinels PacketBuffer / CipherPacketBuffer | Byte payload/cursor, big-endian widths, ISAAC and bit cursor. |',
      '| ResourceArchive / ArchiveIndex / ArchiveProvider | Steel Sentinels equivalents | Packed/unpacked groups, versioned indexes, names/digests and provider progress. |',
      '| HighscoreQuery / ScoreSubmission / HighscoreNameEntry | GeoBlox equivalents | Query dimensions, three views, wrapping submission IDs, context words and unique-player name markers; Ace adds acknowledgement tokens. |',
      '| PcmSample / PcmSampleStream / MidiPcmStream | GeoBlox equivalents | Signed PCM storage, loop bounds, interpolation and MIDI channel/voice state. |', '',
      '`SoundCache` separates synthesized and Vorbis archives, pending Vorbis samples and decoded PCM samples. Cache hits precede the byte-budget check; a completed sample remains reusable when the caller budget is exhausted. The shared collection fixtures check collisions, duplicate keys, bucket-order traversal, transfers and independence of primary versus secondary links.', '',
      'Ace retains two text pipelines. `BitmapFont`, `CoverageBitmapFont`, `MonochromeBitmapFont` and `SoftwareRasterizer` share the software engine roles found in GeoBlox: glyph metrics, tags, wrapping, coverage/mask drawing and a global clipped integer framebuffer. The previously generic BitmapFont name for the other pipeline is now `RendererBitmapFont`, which retains a `GraphicsRenderer` and separate `BitmapFontMetrics`. Software and renderer font encodings differ and remain distinct. Font probes check measured advances, tags, wrapping and pair kerning, and compare clipped software glyph pixels against an independent integer blend reference, including shadow masks and the original separate rounding of source/background contributions.', '',
      '`SpriteData.decodeFrames` exposes palette-indexed frame bytes, optional alpha and left/top/right/bottom padding. `loadFrames` and `loadFirstFrame` use archive group/file names. Decoded assets and renderer-owned images have paired names such as aircraftSpriteData/aircraftSprites, gaugeSpriteData/gaugeSprites and scoreDigitSpriteData/scoreDigitSprites. Game, large and title font data/metrics are separate. `GraphicsRenderer.createSprite` converts the decoded data, optionally preferring an indexed representation. The shared software `SpriteState`, `Sprite`, `ArgbSprite`, `IndexedSpriteState` and `IndexedSprite` roles remain distinct from `RenderSprite`.', '',
      '`RendererBitmapFont.drawText`, `drawCenteredText`, `drawRightAlignedText`, image-aware variants and `drawParagraph` expose alignment and baseline intent at HUD/menu call sites. `drawStyledText`, `applyStyleTag`, `prepareJustification`, `drawGlyph` and `drawGlyphWithMask` retain the original masks, image baselines, shadow passes and ARGB style state. The native sprite probes decode synthetic multi-frame resources in row/column order, check optional alpha/palette sharing, and verify trim-aware copies, mirroring, rotation and indexed framebuffer pixels. An isolated original-bytecode oracle checks indexed alpha blending; its arithmetic final shift sign-extends some RGB results into the high byte, and the source retains that behavior.', '',
      'Shared role names do not assert byte-for-byte implementation equality. Different guards, signatures, static helper placement and graphics generations remain. Core fixtures exercise actual raw and named flight/vector, packet, collection and menu implementations, compare their traces and check independent expected results. Complete source compilation and resolved declaration/reference/override comparison cover every file. Reversal recovers the reconstructed raw source bytes.', '',
      'The replay reconstructs all 51 region-proved ordinary FlightSession methods and the SpriteData decoder directly from the fixed original bytecode. It preserves session initialization and three methods handled by specialized emitters at the base source. The decoder has a separate plain-CFG original-edge proof; all 38 reconstructed decoder locals have reviewed names for frames, palette, indices, coordinates and alpha masks. Loop counters now declare their type in the owning for header when a generic proof establishes that every reference belongs to that loop, the initializer does not consume the old value and the earlier declaration is inert. The original header/body effects, jumps and enclosing protected/monitor scopes remain. Other inert declarations now merge with their first standalone assignment when every remaining use follows it inside that existing block. The original written type and RHS stay exact, including reference/array types, overload resolution, allocation order and exceptions. Reads from handlers, finally, headers or sibling blocks prevent narrowing. Generic primitive-value branch recovery folds same-type local-only decisions at their original position. These recoveries run by default, with no game-flag assumptions. Generic catch-copy cleanup preserves destination local types. The current dictionary records every selected body hash and original-edge certificate checks. Native traces also match the historical session and sprite source, and a separate original-bytecode decoder probe compares padding, dimensions, palette sharing, indices and optional alpha.', '',
      'The current generic compiler also removes unread typed reference stack snapshots. This drops null placeholders from final-score construction without discarding live references, moving allocations or suppressing argument effects. The full native core trace matches both the historical source and reconstructed source before naming.', '',
      'The animated HUD number renderer now uses structured loops. This comes from the pinned generic decompiler: it includes a proven nonthrowing boundary latch inside the protected loop, retains throwing-PC exception routing and checks original control-flow edges. The dictionary records base input, transformed input and both method-body hashes. Reversal recovers the reconstructed raw source; the base input remains available at its pinned Git commit.', '',
      'The HUD probe compares original bytecode, historical dispatcher Java and reconstructed Java drawing-call traces, including runtime-exception and Error injection. It uses controlled abstract renderer/sprite implementations with the same original final wrappers in every variant, isolating historical diagnostic-wrapper removal. Physical pixels, whole-game playability and server compatibility are not established by these focused fixtures. Account/network internals and unresolved engine names still need work. Local packet fixtures do not establish compatibility with a live server.', '',
      'Reproduce with `node readable/build-aceofskies-rules.mjs --check`, `node readable/reproduce-aceofskies.mjs --update`, and `node readable/reproduce-aceofskies.mjs --check` from dekobloko-work. Each command uses pinned raw Git input and temporary compilation only. No binary dependency or second readable tree is published.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(aceConfig), file = path.join(workflowRoot, 'aceofskies-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Ace rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
