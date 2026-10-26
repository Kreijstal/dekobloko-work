import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {verifyAceCore} from './tests/test-aceofskies-core.mjs';

// Every identity below belongs to the pinned Ace export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  pk: ['FlightSession', 'Owns the player, aircraft array, bullets, pickups and effects; initializes, advances and draws a session.'],
  md: ['Aircraft', 'FlightBody subclass with aircraft definition, hit points, targeting, firing and steering state.'],
  gb: ['AircraftDefinition', 'Constructor retains aircraft speed/turn/health/weapon dimensions; instances select aircraft sprites and engine samples.'],
  kc: ['Vector2', 'Two double coordinates, copy/set/add/subtract, dot product, squared length and polar conversion.'],
  o: ['FlightBody', 'Owns position, heading, heading offset and speed; forward/sideways movement and world boundary wrapping.'],
  jd: ['SteeringMode', 'Identity token selected by Aircraft steering between inactive, attack and evade states. Static UI data is unrelated.'],
  eu: ['Bullet', 'FlightBody retaining source aircraft and 64-tick lifetime; spawn offsets position and heading before advancing.'],
  wm: ['Pickup', 'FlightBody initialized with a pickup code and 400-tick life; session collects its upgrade or temporary weapon.'],
  qf: ['SmokeParticle', 'FlightBody with ten-tick life, random smoke sprite, radius/colour fields; session updates and draws it.'],
  ok: ['ScreenParticle', 'Integer/fixed-point screen effect initialized in two modes; session updates and renders its pooled instances.'],
  vc: ['TimedSpriteEffect', 'Retains screen coordinates, duration and a random sprite index; session owns and expires these effects.'],
  nk: ['MenuScreen', 'One of eight indexed screens, retaining selection, animation/input and menu text/rendering state.'],
  l: ['RendererManager', 'Owns renderer selection, canvas binding, recreation and current GraphicsRenderer.'],
  ha: ['GraphicsRenderer', 'Abstract canvas/render-target/sprite/line/image drawing API; supports software and hardware implementations.'],
  pa: ['RenderSprite', 'Abstract sprite blits, scaling and transformed rendering operations.'],
  da: ['BitmapFont', 'Markup-aware text layout and drawing through a GraphicsRenderer.'],
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
  ['z', '[Lvc;', 'timedSpriteEffects'], ['E', '[Lo;', 'backgroundBodies'],
  ['w', 'I', 'smokeParticleCount'], ['K', 'I', 'screenParticleCount'],
  ['c', 'I', 'simulationTick'], ['yb', 'Z', 'attractMode'], ['Cb', 'Z', 'alternateGameMode'],
  ['g', 'Z', 'paused'], ['Ab', 'I', 'shotsFired'], ['pb', 'I', 'shotsHit'],
  ['d', 'I', 'speedUpgradeLevel'], ['J', 'I', 'fireRateUpgradeLevel'],
  ['x', 'I', 'turnRateUpgradeLevel'], ['H', 'I', 'healthUpgradeLevel'],
  ['vb', 'Lhk;', 'gameMusic'], ['Z', '[I', 'musicChannelVolumes'],
  ['ab', 'I', 'bulletCount'], ['Bb', 'I', 'pickupCount'], ['F', 'I', 'lives'],
  ['kb', 'D', 'cameraScale'], ['t', 'D', 'backgroundPanX'], ['Y', 'D', 'backgroundPanY'],
]) field('pk', original, descriptor, to, evidence.session);
for (const [original, descriptor, to, names] of [
  ['a', '(IZ)V', 'startGame', ['obfuscationGuard', 'alternateGameMode']],
  ['a', '(ZZ)V', 'advanceSession', ['obfuscationGuard', 'processInput']],
  ['a', '(IZLha;)V', 'renderSession', ['obfuscationGuard', 'unusedFlag', 'renderer']],
  ['a', '(ILmd;Lkc;)V', 'advanceAircraft', ['obfuscationGuard', 'aircraft', 'cameraMovement']],
  ['b', '(Lmd;I)V', 'selectAircraftTarget', ['aircraft', 'obfuscationGuard']],
  ['b', '(BLmd;)V', 'installAircraft', ['obfuscationGuard', 'aircraft']],
  ['a', '(BLgb;II)I', 'spawnAircraft', ['obfuscationGuard', 'definition', 'count', 'pickupCount']],
  ['a', '(ZZI)V', 'finishGame', ['screenFlag', 'awardFlag', 'accuracyTarget']],
  ['c', '(BI)Z', 'applyUpgrade', ['obfuscationGuard', 'upgradeCode']],
  ['a', '(ILkc;BI)V', 'emitSmoke', ['size', 'position', 'obfuscationGuard', 'colour']],
  ['a', '(BLmd;)V', 'fireBullets', ['obfuscationGuard', 'aircraft']],
  ['a', '(Lkc;B)V', 'advanceBullets', ['cameraMovement', 'obfuscationGuard']],
  ['a', '(Lkc;Z)V', 'advancePickups', ['cameraMovement', 'obfuscationGuard']],
  ['a', '(Lkc;I)V', 'advanceSmokeParticles', ['cameraMovement', 'obfuscationGuard']],
  ['c', '(I)V', 'advanceScreenParticles', ['obfuscationGuard']],
  ['c', '(II)V', 'removeSmokeParticle', ['index', 'obfuscationGuard']],
  ['d', '(BI)V', 'removeScreenParticle', ['obfuscationGuard', 'index']],
]) method('pk', original, descriptor, to, names, evidence.session);
field('eu', 'i', 'Lmd;', 'sourceAircraft', 'Bullet spawn retains its firing aircraft for hit routing and attribution.');
field('eu', 'h', 'I', 'remainingTicks', 'Spawn sets 64; the bullet update decrements and expires this lifetime.');
method('eu', 'a', '(IIDLmd;)V', 'spawn', ['sideOffset', 'headingOffset', 'turnOffset', 'sourceAircraft'], 'Copies source position/heading, sets lifetime and speed, offsets sideways then forward.');
field('wm', 'k', 'I', 'pickupCode', 'Pickup initialization, weapon/upgrade dispatch in collection path.');
field('wm', 'g', 'I', 'remainingTicks', 'Pickup starts at 400, decays, fades and is removed after the retained tail.');
method('wm', 'a', '(IILkc;)V', 'spawn', ['pickupCode', 'obfuscationGuard', 'position'], 'Sets the pickup code, copies position and resets lifetime to 400.');
field('qf', 'i', 'I', 'remainingTicks', 'Smoke spawn sets ten, session decrements and removes inactive particles.');
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

// Lexical ordinals bind each reviewed local to the exact pinned declaration.
// Shared compiler temporaries stay unresolved instead of receiving false roles.
for (const [owner, signature, locals] of [
  ['pk', 'a(ZZ)V', [
    [19, 'var3', 'cameraMovement'], [20, 'var3_ref', 'failure'],
    [21, 'var4_ref_md__', 'aircraftToAdvance'], [24, 'var6_ref_md', 'advancingAircraft'],
    [27, 'var6_ref_o__', 'backgroundToRecenter'], [28, 'var6_ref_wm__', 'pickupsToRecenter'],
    [29, 'var6_ref_eu__', 'bulletsToRecenter'], [30, 'var6_ref_qf__', 'smokeParticlesToRecenter'],
    [31, 'var6', 'viewportMinimumExtent'], [34, 'var8_ref_md', 'populationAircraft'],
    [35, 'var8_ref_md__', 'aircraftForSpawnCheck'], [36, 'var8_ref_o', 'backgroundBody'],
    [37, 'var8_ref_wm', 'pickupToRecenter'], [38, 'var8_ref_eu', 'bulletToRecenter'],
    [39, 'var8_ref_qf', 'smokeToRecenter'], [40, 'var8', 'minimumCameraScale'],
    [42, 'var10_ref_md__', 'aircraftForWaveCount'], [44, 'var10_ref_md', 'spawnObstacle'],
    [45, 'var10', 'attractCameraScale'], [47, 'var12_ref_md', 'waveAircraft'],
    [48, 'var12', 'maximumCameraScale'], [49, 'var14', 'playerPosition'],
    [50, 'var15', 'scaledPlayerOffsetX'], [51, 'var17', 'scaledPlayerOffsetY'],
    [52, 'var19', 'obfuscationControl'], [53, 'var4_ref_md__Lifetime1', 'aircraftForAttractPlayer'],
    [54, 'var6_ref_mdLifetime1', 'attractPlayerCandidate'], [55, 'var6_ref_md__Lifetime1', 'aircraftToRecenter'],
    [56, 'var8_ref_mdLifetime1', 'aircraftToShift'],
  ]],
  ['pk', 'b(Lmd;I)V', [[12, 'var3', 'aircraftCandidates'], [15, 'var5', 'candidateAircraft'], [16, 'var6', 'obfuscationControl']]],
  ['md', 'a(IBLmd;)V', [[11, 'var4_int', 'targetLeadDistance'], [12, 'var4', 'failure'],
    [13, 'var5', 'forwardDistanceSquared'], [14, 'var7', 'leftDistanceSquared'],
    [15, 'var9', 'rightDistanceSquared'], [16, 'var11', 'turnRate'],
    [19, 'var14', 'targetAlignment'], [20, 'var16', 'obfuscationControl'], [21, 'var13Lifetime1', 'turnDirection']]],
]) for (const [ordinal, originalName, to] of locals)
  members[`L:${owner}.${signature}#${ordinal}`] = {to, expectedOriginalName: originalName,
    evidence: 'Reviewed lexical declaration and flight update, targeting, steering or camera data flow in the pinned Ace source.'};

export const aceConfig = {
  game: 'aceofskies', version: 1, sourceCommit: 'b168d7edeb104599156b5f908df62dfdc9f3b250', classes, members,
  workflowFiles: ['build-aceofskies-rules.mjs', 'reproduce-aceofskies.mjs', 'reviewed-game.mjs',
    'tests/test-aceofskies-core.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: verifyAceCore,
  readingGuide(rules, mapping) {
    return ['# Reading Ace of Skies', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/aceofskies-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names; renamed names have no opaque suffix.`, '',
      'Start at `AceOfSkies.advanceGame` → `FlightSession.advanceSession`. `startGame` creates the player and pools; `renderSession` draws through `GraphicsRenderer`. `Aircraft` retains its definition, target, pursuing aircraft, firing request and temporary weapon. `FlightBody` and `Vector2` expose the flight arithmetic. `Bullet`, `Pickup`, `SmokeParticle` and `ScreenParticle` are distinct pools. `MenuScreen` handles the indexed screens.', '',
      'Angles in forward/polar motion use 256 units per full turn. `Vector2.angle255` preserves the separate original atan2 scaling by 255 / pi and its zero-vector value 255. `FlightBody.moveForward` subtracts sine/cosine motion and also decays headingOffset. `wrapWorld` retains its single-period boundary adjustments, including out-of-range results for positions multiple periods away. All guard parameters and unusual edge behavior remain.', '',
      'The shared engine roles match other games by reviewed behavior, not by short obfuscated spelling:', '',
      '| Ace | Existing counterpart | Evidence |', '| --- | --- | --- |',
      '| IntrusiveNode / IntrusiveDeque | GeoBlox IntrusiveNode / IntrusiveDeque | Independent node ownership, circular sentinel and forward/reverse links. |',
      '| PacketBuffer / CipherPacketBuffer | Steel Sentinels PacketBuffer / CipherPacketBuffer | Byte payload/cursor, big-endian widths, ISAAC and bit cursor. |',
      '| ResourceArchive / ArchiveIndex / ArchiveProvider | Steel Sentinels equivalents | Packed/unpacked groups, versioned indexes, names/digests and provider progress. |',
      '| PcmSample / PcmSampleStream / MidiPcmStream | GeoBlox equivalents | Signed PCM storage, loop bounds, interpolation and MIDI channel/voice state. |', '',
      'Shared role names do not assert byte-for-byte implementation equality. Different guards, signatures, static helper placement and graphics generations remain. Core fixtures exercise actual raw and named flight/vector, packet and collection implementations, compare their traces and check independent expected results. Complete source compilation and resolved declaration/reference/override comparison cover every file. Reversal recovers all original source bytes.', '',
      'One dispatcher remains in FlightSession, in the animated HUD number rendering path. Other unresolved control flow also remains; this naming pass does not replace branches with guessed game logic. Whole-game playability, pixel output and server compatibility are not established by the focused fixtures.', '',
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
