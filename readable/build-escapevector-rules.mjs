import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {prepareEscapeVector} from './prepare-escapevector.mjs';
import {verifyEscapeCore} from './tests/test-escapevector-core.mjs';

// IDs are local to the pinned Escape Vector export. Similar engine roles in
// other games corroborate behavior, never the spelling of an obfuscated ID.
const classes = {
  oe: ['GameplaySession', 'Owns level loading, mutable terrain, ship physics, mission progress, effects, minimap, update and rendering.'],
  vc: ['TerrainMap', 'Reads versioned dimensions/themes and packed empty, full or quadtree-decoded 32x32 collision tiles.'],
  na: ['DynamicTerrainRenderer', 'Caches terrain neighborhoods and contours, tracks dirty tiles and renders style-four terrain.'],
  li: ['Minimap', 'Owns the session, tile scale, terrain miniature, map objects and player/object markers.'],
  sa: ['LevelObject', 'Owns an object ID/type, pixel coordinates, sprite frame and collision mask; stamps/removes sprite coverage in the level.'],
  oc: ['PointCloudEffect', 'Sprite/point-backed effect with fixed-point coordinates, velocity, active masks, integration, drag and rasterization.'],
  tj: ['DialogueScreen', 'Owns scene images, dialogue lines, typewriter progress, transitions and input for mission narratives.'],
  hg: ['IntrusiveNode', 'Long key and circular previous/next links with independent unlink and linked-state methods.'],
  cn: ['IntrusiveDeque', 'Circular sentinel, front/back insertion/removal and cursor-based traversal of IntrusiveNode objects.'],
  fl: ['DualLinkNode', 'IntrusiveNode with a second independent key/link pair and secondary unlink.'],
  ma: ['BoundedRandomAccessFile', 'Wraps RandomAccessFile with a tracked position and maximum length; unrelated static globals include the active session.'],
  n: ['PacketBuffer', 'Byte payload and cursor with big-endian reads, writes, strings and smart integers.'],
  ed: ['Sprite', 'Software RGB pixel sprite with transparent-zero drawing, copies, mirroring, scaling and raster binding.'],
  nf: ['SpriteState', 'Base sprite with full/trimmed dimensions and trim offsets, plus abstract draw operations.'],
  em: ['SoftwareRasterizer', 'Global integer framebuffer, dimensions, clip rectangle and software drawing kernels.'],
  eh: ['GameAppletShell', 'Applet/Runnable lifecycle, focus/window listeners and abstract client hooks.'],
  g: ['NetworkGameClient', 'GameAppletShell subclass owning shared account, connection and client initialization.'],
  ka: ['TerrainMaskSupport', 'Holds recursive terrain-quadrant decoding alongside unrelated shared static helpers.'],
  bf: ['AccountRegistrationPanel', 'Account-form controls, password/name validation and registration callbacks; also houses terrain recursion.'],
  ga: ['IntPoint', 'Two integer coordinates initialized and assigned together.'],
  wj: ['SoundEnvelope', 'Decoded time/value envelope segments with reset and fixed-point interpolation.'],
  si: ['QuickChatPhraseDefinition', 'Decodes phrase fragments, command IDs/parameters and responses; builds a preview with ellipsis between fragments. Unrelated static fields include the terrain sentinel.'],
  de: ['IntValueNode', 'Intrusive node retaining one integer value; unrelated static helpers include selected-level launch.'],
  ic: ['SeekerMine', 'Loaded as a Q16 position pair; update steers it toward the ship, limits speed and detonates it on sprite or terrain contact.'],
  pi: ['RockBuster', 'Spawned by the rock-buster input while decrementing ammunition; accelerates along its launch angle and retains an exhaust cloud and flight sound.'],
  am: ['LaserGateSpan', 'Linked horizontal beam endpoints and a shared pixel y; gate creation, drawing and destruction retain this span.'],
  va: ['SecondaryIntrusiveDeque', 'Circular DualLinkNode sentinel with secondary-link insertion, removal, traversal and emptiness checks.'],
  rb: ['HudMessage', 'Text and display duration queued by GameplaySession and consumed when the current HUD message expires.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = `${owner}.${original}${descriptor}`;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to:name,evidence};
}
function fields(owner, rows, evidence) {for (const [original,descriptor,to] of rows) field(owner,original,descriptor,to,evidence);}
function locals(signature, rows, evidence) {
  for (const [ordinal, expectedOriginalName, to] of rows)
    members[`L:${signature}#${ordinal}`] = {to, expectedOriginalName, evidence};
}

fields('vc', [['a','I','tilesWide'],['f','I','tilesHigh'],['h','I','pixelWidth'],['g','I','pixelHeight'],
  ['c','I','terrainTheme'],['b','I','secondaryTheme'],['d','[[I','tileMasks']],
  'Constructor reads byte dimensions, shifts by five for pixels, defaults the secondary theme before version ten and fills the retained tile array.');
method('vc','<init>','(Ljava/io/DataInputStream;I)V',null,['input','formatVersion'],
  'Versioned terrain header followed by four two-bit tile codes per byte and recursive partial masks.');
method('bf','a','(IILjava/io/DataInputStream;II[II)V','decodeTerrainQuadrants',
  ['top','bottom','input','left','right','rows','guard'],
  'Splits the rectangle at its midpoint; consumes one byte containing four two-bit quadrant codes in top-left/top-right/bottom-left/bottom-right order.');
method('ka','a','(IIIILjava/io/DataInputStream;[IBI)V','decodeTerrainQuadrant',
  ['left','quadrantCode','bottom','right','input','rows','guard','top'],
  'Code zero retains empty bits; code one ORs a horizontal bit span into each row; other codes recursively decode subquadrants.');
field('si','v','[I','fullTileMask','Shared full-tile identity sentinel in terrain decode, collision edits and snapshots. The sentinel itself is an empty array, not a row mask.');
field('de','g','I','value','Constructor retains its integer argument in this intrusive node.');
fields('oe', [
  ['V','[[I','terrainMasks'],['Vb','[[I','initialTerrainMasks'],['Mb','I','tilesWide'],['D','I','tilesHigh'],
  ['n','I','worldWidth'],['Fb','I','worldHeight'],['P','I','terrainTheme'],['Yb','I','secondaryTheme'],
  ['Nb','[[B','levelData'],['Pb','I','levelIndex'],['fc','I','gameMode'],['kb','Ljava/util/Vector;','levelObjects'],
  ['H','I','shipXQ16'],['p','I','shipYQ16'],['mc','I','shipVelocityXQ16'],['hc','I','shipVelocityYQ16'],
  ['t','I','spawnXQ16'],['bb','I','spawnYQ16'],['B','Lli;','minimap'],['eb','Lna;','dynamicTerrain'],
  ['cb','I','elapsedTicks'],['ob','I','score'],['F','Z','easyMode'],['gb','Z','timeHackMode'],
], 'Reviewed GameplaySession load/reset/update/render data flow; positions and velocities use 16 fractional bits.');
method('oe','a','(ZIILjava/io/DataInputStream;)V','loadTerrain',
  ['headerOnly','formatVersion','guard','input'],'Installs TerrainMap dimensions, themes and masks, then snapshots mutable terrain.');
method('oe','l','(B)V','snapshotTerrain',['guard'],
  'Copies every partial tile row, retaining shared null/full sentinels, and records the initial tile height.');
method('oe','G','(I)V','renderSession',['guard'],
  'Draws terrain/background/effects around the fixed-point ship, then HUD and minimap.');
method('oe','h','(I)V','updateSession',['guard'],
  'Main tick advances input, ship motion/collision, enemies, effects, audio and mission state.');
method('oe','y','(B)V','startSession',['guard'],
  'Initializes mission/session values then installs the current level.');
method('oe','s','(B)V','stopSessionAudio',['guard'],
  'Stops owned sound streams, removes enemy/projectile streams from the mixer and clears their handles.');
method('oe','a','(ZI)V','initializeLevelObjects',['buildTerrainRenderer','guard'],
  'Stamps objects, links gates, resets ship state, conditionally creates the style-four renderer and constructs the minimap.');
method('oe','i','(B)V','buildTutorialTerrain',['guard'],
  'Builds the literal 32x32 tutorial arena, its container/landing objects and spawn rather than reading a mission stream.');
method('oe','n','(I)Z','usesDynamicTerrain',['guard'],
  'Returns terrainTheme == 4 for the supported guard 8192.');
method('oe','a','(Ljava/io/InputStream;Z)V','loadLevelStream',['input','option'],
  'Delegates to the versioned level-stream loader and retains exception diagnostics.');
field('ma','a','Loe;','activeSession','Read by the applet update/render paths and set by level launch.');
method('de','a','(III)V','startSelectedLevel',['gameMode','levelIndex','guard'],
  'Resolves mode/level selection, constructs the active GameplaySession and calls startSession.');
method('EscapeVector','c','(I)V','updateClient',['guard'],'Applet update hook services audio, input, loading, menus and current session.');
method('EscapeVector','e','(B)V','renderClient',['guard'],'Applet rendering hook calls renderFrame then presentation.');
method('EscapeVector','m','(I)V','renderFrame',['guard'],'Dispatches dialogue, current session and other screens, then draws debug overlays.');
method('EscapeVector','q','(I)V','updateSessionMusic',['guard'],'Selects dialogue/menu/session music and tells the current session when the music context changes.');
method('EscapeVector','b','(B)V','initializeClient',['guard'],'Initializes audio outputs/mixers and shared client/game state.');
method('EscapeVector','a','(B)V','releaseClientStatics',['guard'],'Clears the game and engine static resources during shutdown.');
field('EscapeVector','A','I','obfuscationControl','Existing mutable branch-control variable; preserved without assuming that it is always zero.');

fields('sa', [['j','I','objectId'],['n','I','objectType'],['k','I','x'],['g','I','y'],['l','I','spriteFrame'],
  ['i','Led;','collisionSprite'],['t','Led;','displaySprite'],['s','I','displayOffsetX'],['m','I','displayOffsetY']],
  'LevelObject construction, sprite refresh and collision stamping establish IDs, pixel coordinates and per-frame geometry.');
method('sa','a','(ZLoe;)V','stampTerrain',['guard','session'],'ORs each nontransparent sprite pixel into the mutable 32-row terrain mask, wrapping horizontal tile indices.');
method('sa','a','(Loe;B)V','removeFromTerrain',['session','guard'],'Clears sprite-covered terrain bits, copies full sentinels before mutation and invalidates dynamic terrain neighborhoods.');
method('sa','e','(I)V','refreshSprites',['guard'],'Refreshes collision/display sprites and display alignment offsets from object type and frame.');
method('sa','<init>','(IIII)V',null,['objectId','objectType','x','y'],'Stores ID, type and pixel coordinates before initializing object sprites.');
fields('na', [['v','[[I','terrainMasks'],['x','[I','fullTileMask'],['g','I','tilesWide'],['d','I','tilesHigh'],
  ['r','[Z','dirtyTiles'],['h','I','tileWidth'],['f','I','tileHeight']],
  'Renderer constructor retains terrain/sentinel/dimensions, and invalidation marks the 3x3 neighboring tile region dirty.');
method('na','a','(IIZ)V','invalidateTileNeighborhood',['tileX','tileY','guard'],'Marks in-bounds neighbors in a 3x3 region dirty after collision-mask edits.');
method('na','e','(III)V','renderTerrain',['viewportWidth','cameraX','cameraY'],'Wraps horizontal world coordinates and renders visible dirty/cached terrain tiles.');
method('na','<init>','([[I[I[III)V',null,['terrainMasks','fullTileMask','options','tilesWide','tilesHigh'],'Owns renderer caches for the supplied mutable terrain and full sentinel.');
field('li','n','Loe;','session','Minimap reads dimensions, terrain masks, ship coordinates and level objects from this owner.');
field('li','v','I','pixelsPerTile','Minimap scale multiplies each tile coordinate to obtain screen position and extent.');
method('li','f','(III)V','drawTerrainTiles',['guard','screenY','screenX'],'Centers the scaled terrain and draws each tile in row-major order.');
method('li','<init>','(Loe;Lsa;Z)V',null,['session','focusObject','option'],'Retains current gameplay and optional object while initializing minimap controls and terrain.');
method('tj','j','(I)V','drawDialogue',['guard'],'Draws scene image, panel and current typewriter text.');
method('tj','e','(B)V','advanceDialogue',['guard'],'Handles mouse/key progress, reveal timing, scene transitions and completion.');
fields('tj', [['g','[Ljava/lang/String;','dialogueLines'],['E','I','dialogueIndex'],['B','I','revealedLine'],
  ['j','I','revealedCharacters'],['l','Z','fullWidthScene']], 'Dialogue constructors and draw/update paths establish scene layout, current line and typewriter cursor.');

fields('hg', [['d','Lhg;','previous'],['b','Lhg;','next'],['e','J','key']], 'Primary circular intrusive link pair and lookup key.');
method('hg','c','(B)V','unlink',['guard'],'Reconnects primary neighbors, then nulls both owned links.');
method('hg','b','(B)Z','isLinked',['guard'],'Checks the primary previous link.');
fields('fl', [['i','Lfl;','secondaryPrevious'],['j','Lfl;','secondaryNext'],['p','J','secondaryKey']], 'Separate second intrusive link pair; unlinking does not affect primary ownership.');
method('fl','d','(I)V','unlinkSecondary',['guard'],'Reconnects secondary neighbors and nulls only secondary links.');
fields('cn', [['d','Lhg;','sentinel'],['g','Lhg;','cursor']], 'Deque owns a circular sentinel and a next-node traversal cursor.');
for (const [name,descriptor,to,parameters] of [
  ['a','(I)Z','isEmpty',['guard']],['a','(B)V','clear',['guard']],
  ['a','(ILhg;)V','addLast',['guard','node']],['a','(Lhg;I)V','addFirst',['node','guard']],
  ['a','(Z)Lhg;','first',['guard']],['b','(B)Lhg;','next',['guard']],
  ['c','(I)Lhg;','removeFirst',['guard']],['b','(I)Lhg;','removeLast',['guard']],['c','(B)I','size',['guard']],
]) method('cn',name,descriptor,to,parameters,'Reviewed circular-sentinel ownership and cursor traversal; transfers unlink the node from its previous owner.');

fields('nf', [['A','I','fullWidth'],['z','I','fullHeight'],['s','I','width'],['x','I','height'],['q','I','offsetX'],['v','I','offsetY']],
  'Sprite constructors/drawing distinguish full dimensions, trimmed storage and trim offsets.');
field('ed','B','[I','pixels','RGB framebuffer contents; zero pixels are transparent in collision stamping and standard blits.');
fields('em', [['i','[I','pixels'],['l','I','width'],['d','I','height'],['a','I','clipLeft'],['k','I','clipTop'],['b','I','clipRight'],['j','I','clipBottom']],
  'Raster binding, clip save/restore and draw bounds establish framebuffer geometry.');
fields('n', [['g','[B','payload'],['m','I','position']], 'All reads/writes advance this byte-array cursor.');
for (const [name,descriptor,to,parameters] of [
  ['e','(I)I','readUnsignedByte',['guard']],['f','(I)I','readUnsignedShort',['guard']],
  ['g','(I)I','readInt',['guard']],['d','(B)I','readUnsignedMedium',['guard']],
  ['b','(Z)I','readUnsignedSmart',['guard']],
]) method('n',name,descriptor,to,parameters,'Reviewed big-endian byte shifts, unsigned masks and cursor increments in PacketBuffer.');
fields('ma', [['e','Ljava/io/RandomAccessFile;','file'],['d','J','position'],['f','J','maximumLength']],
  'Bounded file constructor, seek/read/write and overflow checks establish file handle, cursor and maximum extent.');
fields('ga', [['a','I','x'],['c','I','y']], 'IntPoint constructor/set retain the same first/second coordinate ordering.');
method('ga','a','(III)V','set',['x','guard','y'],'Sets both integer coordinates for guards greater than 107.');
method('ga','<init>','(II)V',null,['x','y'],'Retains the supplied integer pair.');
fields('wj', [['g','I','segmentCount'],['k','[I','segmentTimes'],['h','[I','segmentValues'],['a','I','segmentIndex'],
  ['f','I','nextSegmentTick'],['c','I','elapsedTicks'],['i','I','valueQ15'],['d','I','stepQ15'],['e','I','form'],['j','I','start'],['b','I','end']],
  'Envelope decoder loads segment times/values and header; advance linearly interpolates Q15 values across scaled time boundaries.');
method('wj','a','()V','reset',[],'Resets segment index, current/next ticks, value and step.');
method('wj','a','(I)I','advance',['duration'],'Returns the current envelope sample and advances its fixed-point interpolation.');
method('wj','a','(Ln;)V','decode',['input'],'Reads form/start/end and delegates to segment decoding.');
method('wj','b','(Ln;)V','decodeSegments',['input'],'Reads segment count followed by unsigned-short time/value pairs.');

// Follow the actual stream readers and their consumers. These names do not
// infer missing member layouts from screenshots or assign names to unknown IDs.
fields('oe', [
  ['Q','I','objectiveType'], ['l','I','countdownTrigger'], ['X','I','countdownTicks'], ['a','Z','countdownActive'],
  ['U','I','initialFuel'], ['ac','I','fuel'], ['gc','I','initialShieldEnergy'], ['Tb','I','shieldEnergy'],
  ['qb','I','gravityQ16'], ['I','I','shipAngle256'], ['ib','I','thrustAccelerationQ16'],
  ['lb','Z','triShotEnabled'], ['tb','I','rockBusterAmmo'], ['Bb','Z','shieldActive'],
  ['Gb','Z','shipDestroyed'], ['rb','Z','shipLanded'], ['A','I','livesRemaining'],
  ['Ub','I','tetheredObjectType'], ['e','I','pickupAnimationTicks'], ['mb','I','tetheredXQ16'],
  ['L','I','initialInfrastructureCount'], ['S','I','destroyedInfrastructureCount'],
  ['k','Lcn;','missionTargets'], ['Ab','Lva;','pendingTargetEffects'],
  ['N','Lcn;','seekerMines'], ['hb','Lcn;','rockBusters'], ['C','Lcn;','laserGateSpans'],
  ['ub','I','laserGateCount'], ['b','Z','laserGateDestroyed'], ['s','Lcn;','initialPowerups'],
  ['nc','I','initialTilesHigh'], ['Rb','I','firstLevelIndex'], ['T','I','levelStartTicks'],
  ['h','Ljava/lang/String;','hudMessageText'], ['ab','I','hudMessageTicks'], ['tc','Lcn;','hudMessageQueue'],
  ['vb','Lcn;','pointCloudEffects'],
  ['m','I','shotCooldownTicks'], ['yb','I','rockBusterCooldownTicks'], ['db','Z','shieldUsedThisLevel'],
  ['Zb','I','shieldPulsePhase'], ['J','I','levelScore'], ['G','Lcn;','bullets'],
  ['Xb','Loc;','exhaustParticles'], ['Sb','I','exhaustWriteIndex'], ['qc','I','activeExhaustParticles'],
], 'Reviewed level readers, resetShipState and update/render consumers: fuel decrements on thrust, shield pickup adds 150 capped at 500, angle wraps at 256, projectiles and mission targets retain independent queues.');
fields('sa', [['r','Z','missionTarget'],['p','Z','triggersCountdown'],['h','Z','glowActive'],['o','I','shotCooldownTicks']],
  'Version-five target flag enters missionTargets; version-six countdown flag calls countdown trigger two on destruction. Glow gates sprite overlays; type-two firing sets a 49-tick cooldown.');
fields('ic', [['p','I','xQ16'],['q','I','yQ16'],['j','I','homeXQ16'],['l','I','homeYQ16'],
  ['i','I','velocityXQ16'],['h','I','velocityYQ16'],['o','I','soundPlaybackRate'],['g','Lhl;','flightSound'],['m','Ltl;','proximitySound']],
  'Seeker loading sets home/current positions together; integration adds velocity to position; distance selects pursuit and audio playback/volume.');
fields('pi', [['n','I','xQ16'],['g','I','yQ16'],['k','I','velocityXQ16'],['p','I','velocityYQ16'],
  ['m','I','angle256'],['r','I','remainingFlightTicks'],['i','Loc;','exhaustParticles'],['o','Lhl;','flightSound'],
  ['l','I','activeExhaustParticles'],['q','I','exhaustWriteIndex']],
  'Rock-buster launch assigns ship position/velocity and angle, 100 flight ticks, 256 exhaust slots and a looping sound; update integrates and decrements these independently.');
fields('am', [['i','I','leftX'],['h','I','rightX'],['j','I','y']],
  'Constructor stores the two beam endpoints and shared y; drawing wraps both endpoints horizontally.');
method('am','<init>','(III)V',null,['leftX','rightX','y'],'Retains the beam endpoint coordinates without reordering.');
fields('rb', [['g','Ljava/lang/String;','text'],['i','I','durationTicks']],
  'HUD queue construction stores text/duration, then the session copies both into current message state.');
method('rb','<init>','(Ljava/lang/String;I)V',null,['text','durationTicks'],'Retains text and display duration.');
fields('va', [['c','Lfl;','sentinel'],['a','Lfl;','cursor']], 'Secondary circular sentinel and iteration cursor.');
for (const [name, descriptor, to, parameters] of [
  ['a','(ILfl;)V','addLast',['guard','node']], ['b','(B)Lfl;','removeFirst',['guard']],
  ['b','(I)Z','isEmpty',['guard']], ['a','(I)Lfl;','first',['guard']], ['a','(B)Lfl;','next',['guard']],
]) method('va',name,descriptor,to,parameters,'Reviewed secondary-link deque ownership; primary node links are independent.');

for (const [name, descriptor, to, parameters] of [
  ['a','(ZILjava/io/InputStream;)V','decodeLevelStream',['headerOnly','guard','input']],
  ['a','(ILjava/io/DataInputStream;B)V','readObjectiveType',['formatVersion','input','guard']],
  ['a','(IILjava/io/DataInputStream;)V','readCountdown',['formatVersion','guard','input']],
  ['a','(ILjava/io/DataInputStream;Z)V','readLevelObjects',['formatVersion','input','guard']],
  ['a','(Ljava/io/DataInputStream;BII)Lsa;','readLevelObject',['input','guard','objectId','formatVersion']],
  ['a','(Ljava/io/DataInputStream;IIZIII)Lsa;','readLevelObjectFlags',['input','x','formatVersion','guard','objectType','y','objectId']],
  ['b','(ILjava/io/DataInputStream;B)V','readSeekerMines',['formatVersion','input','guard']],
  ['a','(BLjava/io/DataInputStream;I)V','readSpawnAndFuel',['guard','input','formatVersion']],
  ['b','(ILjava/io/DataInputStream;I)V','readShieldEnergy',['guard','input','formatVersion']],
  ['a','(Ljava/io/DataInputStream;IB)V','readInitialPowerups',['input','formatVersion','guard']],
  ['a','(ILjava/io/DataInputStream;I)V','readGravity',['defaultGravityQ16','input','formatVersion']],
  ['a','([BI)V','decodeLevelBytes',['bytes','guard']],
  ['a','(Z[BZ)V','installLevelBytes',['buildTerrainRenderer','bytes','guard']],
  ['k','(I)V','loadCurrentLevel',['guard']], ['j','(B)V','initializeCurrentLevel',['guard']],
  ['e','(II)V','selectLevel',['levelIndex','guard']],
  ['b','(B)V','resetShipState',['guard']], ['h','(B)V','destroyShip',['guard']],
  ['b','(Z)Lsa;','findCargoContainer',['guard']], ['g','(B)Z','isMissionComplete',['guard']],
  ['e','(I)Z','areMissionTargetsDestroyed',['guard']], ['e','(Z)Z','hasShipReachedExit',['guard']],
  ['i','(I)Z','requiresExitBeforeCountdownEnds',['guard']],
  ['f','(II)V','activateCountdown',['guard','trigger']], ['B','(B)V','updateCountdown',['guard']],
  ['z','(B)V','applyInitialPowerups',['guard']],
  ['a','(Lic;I)V','destroySeekerMine',['mine','guard']], ['a','(Lpi;I)V','detonateRockBuster',['projectile','guard']],
  ['a','(Lam;B)V','removeLaserGateSpan',['gate','guard']],
  ['a','(IIII)V','addLaserGateSpan',['rightX','y','leftX','guard']],
  ['a','(Lsa;II)V','destroyLevelObject',['object','guard','objectIndex']],
  ['a','(BLsa;)V','recordInfrastructureDestroyed',['guard','object']],
  ['a','(Lsa;Loc;I)V','recordMissionTargetDestroyed',['object','effect','guard']],
  ['D','(I)V','ensureTerrainRow',['tileY']],
  ['c','(I)V','updateHudMessage',['minimumTicks']],
  ['a','(IBLjava/lang/String;)V','queueHudMessage',['durationTicks','guard','text']],
  ['B','(I)Lrb;','pollHudMessage',['guard']],
]) method('oe',name,descriptor,to,parameters,
  'Source-reviewed GameplaySession stream order and its reset/update/render call sites; version gates, guard side effects, queue ordering and numeric object IDs are preserved.');
for (const [name, descriptor, to, parameters] of [
  ['a','(IBI)V','drawObject',['cameraY','guard','cameraX']],
  ['a','(ZII)V','drawTargetHighlight',['guard','cameraX','cameraY']],
  ['a','(B)I','glowAlpha',['guard']], ['e','(B)Z','countsAsInfrastructure',['guard']],
  ['d','(I)Led;','getDisplaySprite',['guard']], ['b','(Z)Lfn;','getDisplayOffset',['guard']],
]) method('sa',name,descriptor,to,parameters,
  'Reviewed object drawing, sprite lookup, glow and destruction counters; static unrelated helpers stay separate.');
for (const descriptor of ['(IIIIZZ)V','(IIIIZZI)V'])
  method('sa','<init>',descriptor,null,
    ['objectId','objectType','x','y','missionTarget','triggersCountdown',...(descriptor==='(IIIIZZI)V'?['spriteFrame']:[])],
    'Versioned object metadata delegates to the basic constructor, then sets target/countdown flags and the optional frame.');
method('oe','<init>','([[BIII)V',null,['levelData','option','gameMode','levelIndex'],'Retains the supplied campaign, mode, selected level and initial level index; the option is passed to the original setup hook.');
method('oe','<init>','([[B)V',null,['levelData'],'Retains the supplied level data in the tutorial constructor.');

for (const [signature, rows] of [
  ['oe.a(ZILjava/io/InputStream;)V', [[0,'var4','levelInput'],[1,'var5','formatVersion']]],
  ['oe.a(ZIILjava/io/DataInputStream;)V', [[0,'var5','terrain']]],
  ['oe.a(Ljava/io/DataInputStream;BII)Lsa;', [[0,'var5','object'],[2,'var6','objectType'],[3,'var7','x'],[4,'var8','guardQuotient'],[5,'var9','y'],[6,'stackIn_11_0','decodedObject']]],
  ['oe.a(Ljava/io/DataInputStream;IIZIII)Lsa;', [[1,'var8','object'],[2,'var9','targetFlag'],[3,'stackIn_3_0','targetFlagPresent'],[4,'var10','missionTarget'],[5,'var11','triggersCountdown'],[6,'var12','countdownFlag'],[7,'stackIn_9_0','countdownFlagPresent'],[8,'var12Lifetime1','spriteFrame'],[9,'stackIn_19_0','decodedObject']]],
  ['oe.a(ILjava/io/DataInputStream;Z)V', [[1,'var7','obfuscationControl'],[2,'var4_int','objectCount'],[3,'var5','objectIndex'],[4,'var6','object']]],
  ['oe.b(ILjava/io/DataInputStream;B)V', [[1,'var7','obfuscationControl'],[2,'var4_int','mineCount'],[3,'var5','mineIndex'],[4,'var6','mine'],[5,'dupTemp$0','homeXQ16'],[6,'dupTemp$1','homeYQ16']]],
  ['oe.a(Ljava/io/DataInputStream;IB)V', [[1,'var9','obfuscationControl'],[2,'var4_int','guardRemainder'],[3,'var5','powerupCount'],[4,'var6','powerupIndex'],[5,'var7','objectType'],[6,'var8','powerup']]],
  ['oe.a(ILjava/io/DataInputStream;I)V', [[1,'var4_int','encodedGravityQ16']]],
  ['oe.b(ILjava/io/DataInputStream;I)V', [[1,'var4_int','guardRemainder']]],
  ['oe.a(BLjava/io/DataInputStream;I)V', [[0,'var4_int','guardQuotient']]],
  ['oe.D(I)V', [[0,'var2','requiredTilesHigh'],[1,'var3','expandedTerrain'],[2,'var4','tileIndex'],[3,'var5','fillIndex'],[4,'var4Lifetime1','initialFillIndex']]],
  ['oe.h(I)V', [[34,'var30','obfuscationControl'],[58,'var32_ref','forceFieldObject'],[75,'var33_ref','laserGate'],[82,'var3_ref_ic','seekerMine'],[92,'var18_ref_ed','tetheredSprite'],[131,'var40_ref','bullet'],[139,'var11_ref_ic','hitMine'],[152,'var6_ref_pi','rockBuster'],[172,'var21_ref_ic','collidedMine'],[181,'var22_ref','hitObject'],[187,'var29_ref','hitGate'],[194,'var43','launchedRockBuster'],[195,'var44_ref','turret'],[198,'var45','muzzleOffset']]],
  ['sa.a(ZLoe;)V', [[2,'var11','obfuscationControl'],[3,'var3_int','sourcePixelIndex'],[4,'var4','sourceRow'],[7,'var5','rowY'],[8,'var6','tileY'],[9,'var7','sourceColumn'],[10,'var8','pixelX'],[11,'var9','tileX'],[12,'var8Lifetime1','bitColumn'],[13,'var10','tileRows'],[14,'array$0','newTileRows']]],
  ['sa.a(Loe;B)V', [[1,'var12','obfuscationControl'],[2,'var3_int','sourcePixelIndex'],[3,'var4','sourceRow'],[5,'var5','rowY'],[6,'var6','tileY'],[7,'var7','sourceColumn'],[8,'var8','pixelX'],[9,'var9','tileX'],[10,'var8Lifetime1','bitColumn'],[11,'var10','tileRows'],[12,'array$0','newTileRows'],[13,'var11','fillRow']]],
  ['sa.a(IBI)V', [[1,'var13','obfuscationControl'],[2,'var5','glowOffsetX'],[3,'var6','glowOffsetY'],[4,'var7','leftPadding'],[5,'var8','topPadding'],[7,'var9Lifetime1','glowAlpha'],[8,'var10','screenY'],[9,'var11','screenX'],[10,'var12','drawWidth']]],
  ['sa.a(ZII)V', [[0,'var4_int','pulsePeriod'],[1,'var5','pulseTick'],[2,'var6','spriteWidth'],[3,'var7','spriteHeight'],[4,'var8','highlightWidth'],[5,'var9','highlightHeight'],[6,'var10','alpha'],[7,'var11','color'],[8,'var12','screenTop'],[9,'var13','screenBottom'],[10,'var14','viewportHeight'],[11,'var15','screenLeft'],[12,'var16','screenRight'],[13,'var17','worldWidth']]],
]) locals(signature, rows,
  'Reviewed exact prepared declaration ordinal and original spelling in the pinned loading, terrain, object drawing or gameplay method; names describe decoded values, owned objects, coordinates, loop roles or retained guard arithmetic.');

export const escapeConfig = {
  game:'escapevector',version:1,sourceCommit:'5bf6bf34923dd6ca1094e2e2c652ac9f1e608d35',classes,members,
  workflowFiles:['build-escapevector-rules.mjs','reproduce-escapevector.mjs','prepare-escapevector.mjs',
    'tests/test-escapevector-core.mjs','reviewed-game.mjs','pinned-compiler.mjs','game-export.mjs','compilation-stubs.mjs'],
  prepareInput:prepareEscapeVector,verifyCore:verifyEscapeCore,
  readingGuide(rules,mapping) {
    return ['# Reading Escape Vector','',
      'This is the only published Java tree. Reviewed rules and the reproducer live in dekobloko-work/readable. The current reverse dictionary is ../../decompilation/escapevector-naming.json.','',
      `This pass names ${Object.keys(classes).length} reviewed classes and ${rules.renames.length} symbols across all ${mapping.files.length} sources. Unresolved roles keep their existing names; reviewed names have no opaque suffix.`,'',
      '## Entry points','',
      '`EscapeVector.updateClient` services input, audio, menus and the active session. `renderClient` calls `renderFrame`, which chooses dialogue, gameplay or another screen. `IntValueNode.startSelectedLevel` constructs `BoundedRandomAccessFile.activeSession` and calls `GameplaySession.startSession`. These unrelated static helpers remain on their original owners because the original client scatters globals across classes.','',
      '`GameplaySession.updateSession` contains ship physics, terrain collision, object interactions, mission state and effects. `renderSession` draws the world, HUD and `Minimap`. Ship position/velocity and spawn coordinates have Q16 names: divide by 65536 for pixels. The world wraps horizontally. `levelIndex < 0` selects tutorial behavior. Mission IDs and type codes remain their original integers.','',
      '## Level format and mission state','',
      '`decodeLevelStream` reads formatVersion, then calls `readObjectiveType`, `readCountdown`, `loadTerrain`, `readLevelObjects`, `readSeekerMines`, `readSpawnAndFuel`, `readShieldEnergy`, `readInitialPowerups` and `readGravity` in that exact order. `decodeLevelBytes`, `installLevelBytes`, `loadCurrentLevel` and `selectLevel` distinguish decoding from installing render/ship state. The original handling of IOException and guard side effects remains.','',
      'Objective type is present from version five (zero retrieves cargo; one destroys targets). Version six adds countdown trigger/ticks; `activateCountdown` and `updateCountdown` retain the trigger conditions and fatal expiry. Version three adds Q16 spawn coordinates and initial fuel; version four adds shield energy; version seven adds initial powerup IDs; version eight adds whitelisted Q16 gravity. Default fuel is 2500, shield energy 150 and gravity 512. Unrecognized gravity values retain the supplied default.','',
      '`readLevelObject` reads type and unsigned-short pixel coordinates, including the pre-version-two type migration. Version five adds missionTarget, version six adds triggersCountdown and version nine adds an integer spriteFrame. missionTargets and pendingTargetEffects must both empty before a destruction objective is complete; finishing a target also waits for its effect. `recordInfrastructureDestroyed` tracks a separate completion count.','',
      '`resetShipState` restores fuel/shield, position and velocity, clears cargo and combat state, and creates fresh projectile queues. shipAngle256 wraps at 256; thrustAccelerationQ16 uses fixed-point acceleration. tetheredObjectType, tetheredXQ16 and pickupAnimationTicks describe cargo/powerup handling. `destroyShip`, `hasShipReachedExit` and `isMissionComplete` distinguish death, leaving the world and meeting the objective.','',
      '## Terrain and level objects','',
      '`loadTerrain` reads `TerrainMap`, installs dimensions/themes/masks and calls `snapshotTerrain`. Each tile is 32 by 32 pixels. Null is empty; `QuickChatPhraseDefinition.fullTileMask` is the shared all-solid identity sentinel, whose array is empty. Partial masks are independently mutable arrays of 32 integer row masks. Four two-bit tile codes occupy each packed byte. `AccountRegistrationPanel.decodeTerrainQuadrants` and `TerrainMaskSupport.decodeTerrainQuadrant` recursively decode partial tiles; their unrelated account/UI globals are retained. Version ten adds a separate secondary theme byte.','',
      '`LevelObject` identifies a placed object by objectId/objectType and pixel x/y. Its collision sprite, display sprite and animation frame are distinct. `stampTerrain` ORs nontransparent sprite pixels into collision masks; `removeFromTerrain` clears them, copying a full sentinel before mutation. `initializeLevelObjects` stamps these objects, links gates and constructs the minimap. `buildTutorialTerrain` constructs the tutorial arena directly.','',
      '`SeekerMine` owns current/home positions, velocity and two sound handles. `RockBuster` owns Q16 motion, angle, remaining flight ticks, exhaust and flight sound. `LaserGateSpan` stores pixel leftX/rightX/y; rendering wraps the horizontal span. Destroying a LevelObject, SeekerMine, RockBuster or laser span has a distinct session method. HudMessage/hudMessageQueue retain text and display duration; pointCloudEffects is a separate effect queue.','',
      '`DynamicTerrainRenderer` is selected for terrain theme four; other themes use the session terrain path. `invalidateTileNeighborhood` marks a 3x3 region dirty following edits. `PointCloudEffect` owns per-point fixed-point motion, masks and drawing. These names do not claim that every effect or object type has been identified.','',
      '## Dialogue and shared engine','',
      '`DialogueScreen.advanceDialogue` handles reveal timing, input and scene changes; `drawDialogue` draws the current image/text. IntrusiveNode/IntrusiveDeque expose primary ownership and traversal; DualLinkNode has independent secondary links. Sprite/SpriteState separate RGB pixels, trimmed dimensions and offsets. SoftwareRasterizer holds the shared framebuffer and clipping. PacketBuffer and SoundEnvelope expose byte decoding and envelope interpolation.','',
      '## Reproduce and verify','',
      'From dekobloko-work:','',
      '```sh','node readable/build-escapevector-rules.mjs --check','node readable/reproduce-escapevector.mjs --update',
      'node readable/reproduce-escapevector.mjs --check','node scripts/check-source-catalog.mjs ../funorb-decompiled',
      'node readable/tests/test-escapevector-core.mjs /path/to/original/escapevector.jar','```','',
      'The exact raw input is pinned to Git. Existing generic java-tools declaration and decision proofs run across every file from a verified compiler-source archive, without game assumptions or compiler flags. Each stage is checked for determinism and idempotence, and its hashes/counts are retained in the current dictionary. Naming binds declarations/references/overrides, compiles the complete raw/named corpus and retains reversible edits. No generated sources or binary dependencies are stored in Deko.','',
      'Native fixtures compare historical, prepared and named implementations against independent expectations for versioned terrain headers, empty/full/partial masks, sprite collision stamping/removal and deque transfers. Independently authored complete level streams cover versions zero through eleven, exact byte consumption, target/countdown/frame boundaries, seeker positions, powerup filtering, fuel/shield defaults and objective/gravity whitelists. The fixed original gamepack passes these fixtures too. These focused checks do not prove whole-game behavior, multiplayer compatibility or frame rate. The original mutable obfuscationControl and guard branches remain; unsupported structural recovery and unresolved local names still need review.',''].join('\n');
  },
};

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.slice(2).some(arg=>arg!=='--check'))throw new Error('Usage: node readable/build-escapevector-rules.mjs [--check]');
    const rules=buildReviewedManifest(escapeConfig),file=path.join(workflowRoot,'escapevector-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';
    if(process.argv.includes('--check')) {if(fs.readFileSync(file,'utf8')!==bytes)throw new Error('Escape Vector rules differ from regeneration');}
    else fs.writeFileSync(file,bytes);
    console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));
  }catch(error){console.error(error.stderr?.toString()||error.stack);process.exitCode=1;}
}
