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
      '## Terrain and level objects','',
      '`loadTerrain` reads `TerrainMap`, installs dimensions/themes/masks and calls `snapshotTerrain`. Each tile is 32 by 32 pixels. Null is empty; `QuickChatPhraseDefinition.fullTileMask` is the shared all-solid identity sentinel, whose array is empty. Partial masks are independently mutable arrays of 32 integer row masks. Four two-bit tile codes occupy each packed byte. `AccountRegistrationPanel.decodeTerrainQuadrants` and `TerrainMaskSupport.decodeTerrainQuadrant` recursively decode partial tiles; their unrelated account/UI globals are retained. Version ten adds a separate secondary theme byte.','',
      '`LevelObject` identifies a placed object by objectId/objectType and pixel x/y. Its collision sprite, display sprite and animation frame are distinct. `stampTerrain` ORs nontransparent sprite pixels into collision masks; `removeFromTerrain` clears them, copying a full sentinel before mutation. `initializeLevelObjects` stamps these objects, links gates and constructs the minimap. `buildTutorialTerrain` constructs the tutorial arena directly.','',
      '`DynamicTerrainRenderer` is selected for terrain theme four; other themes use the session terrain path. `invalidateTileNeighborhood` marks a 3x3 region dirty following edits. `PointCloudEffect` owns per-point fixed-point motion, masks and drawing. These names do not claim that every effect or object type has been identified.','',
      '## Dialogue and shared engine','',
      '`DialogueScreen.advanceDialogue` handles reveal timing, input and scene changes; `drawDialogue` draws the current image/text. IntrusiveNode/IntrusiveDeque expose primary ownership and traversal; DualLinkNode has independent secondary links. Sprite/SpriteState separate RGB pixels, trimmed dimensions and offsets. SoftwareRasterizer holds the shared framebuffer and clipping. PacketBuffer and SoundEnvelope expose byte decoding and envelope interpolation.','',
      '## Reproduce and verify','',
      'From dekobloko-work:','',
      '```sh','node readable/build-escapevector-rules.mjs --check','node readable/reproduce-escapevector.mjs --update',
      'node readable/reproduce-escapevector.mjs --check','node scripts/check-source-catalog.mjs ../funorb-decompiled','```','',
      'The exact raw input is pinned to Git. Existing generic java-tools declaration and decision proofs run across every file from a verified compiler-source archive, without game assumptions or compiler flags. Each stage is checked for determinism and idempotence, and its hashes/counts are retained in the current dictionary. Naming binds declarations/references/overrides, compiles the complete raw/named corpus and retains reversible edits. No generated sources or binary dependencies are stored in Deko.','',
      'Native fixtures compare historical, prepared and named implementations against independent expectations for versioned terrain headers, empty/full/partial masks, sprite collision stamping/removal and deque transfers. The fixed original gamepack also passes the same terrain harness. These focused checks do not prove whole-game behavior, multiplayer compatibility or frame rate. The original mutable obfuscationControl and guard branches remain; unsupported structural recovery and unresolved local names still need review.',''].join('\n');
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
