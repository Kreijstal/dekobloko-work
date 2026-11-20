import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {diffClasses, scriptClasses, getters, diffFields} from './voidhunters-diff-names.mjs';
import {voidHuntersCoverage} from './voidhunters-coverage.mjs';

const classes = {
  ksa: ['IntrusiveNode', 'Long key plus two reciprocal links; base of buffers, widgets and sprites.'],
  fh: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and long key.'],
  vh: ['IterableNodeHashTable', 'Bucket array of DualLinkNode implementing Iterable.'],
  jn: ['NodeHashTableIterator', 'Iterator constructed from an IterableNodeHashTable.'],
  ds: ['PacketBuffer', 'IntrusiveNode with byte payload and cursor, big-endian primitive and BigInteger RSA operations.'],
  hva: ['ClientException', 'RuntimeException retaining a cause and context text.'],
  rb: ['SocketConnector', 'Abstract holder of port and host that creates a Socket.'],
  aqb: ['ProxySocketConnector', 'SocketConnector writing an HTTP CONNECT request and consulting the ProxySelector.'],
  wi: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  pc: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  gpb: ['RasterBuffer', 'Abstract int pixel array with width and height handed to the rasterizer.'],
  hq: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  swa: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  rrb: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  an: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  fg: ['MouseWheelInput', 'Abstract wheel-input hook that an implements for MouseWheelListener.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
field('ds', 'h', '[B', 'payload', 'PacketBuffer byte array indexed by the cursor in every read and write.');
field('ds', 'e', 'I', 'position', 'PacketBuffer cursor advanced by reads and writes.');

for (const [original, to] of Object.entries(diffClasses))
  classes[original] ||= [to, 'Void Hunters state-diff messages name this type: "' + to + ' has changed".'];
for (const [original, to, text] of [
  ['ha', 'GraphicsToolkit', 'Abstract base of the OpenGL and software toolkits that VoidHunters selects at startup.'],
  ['qfa', 'OpenGlToolkit', 'GraphicsToolkit subclass whose source lists GL_ARB extension strings.'],
  ['dab', 'TickCondition', 'Mission condition whose label reads "Is at tick" and keeps a tick field.'],
  ['cc', 'BodyCondition', 'Mission condition whose label starts with "Body " and keeps a body id.'],
  ['iia', 'BodyInZoneCondition', 'Mission condition labelled "Any ship" or "Body " that stores a body id and a zone id.'],
  ['ih', 'ShipCondition', 'Mission condition labelled "Any ship" or "Ship " that stores ship and team ids.'],
  ['jsb', 'ShipSpawnedCondition', 'Mission condition labelled "Any ship just spawned" with a team id.'],
  ['om', 'TeamNodeCondition', 'Mission condition labelled "Any node on team " with a team id.'],
  ['vp', 'TeamShipComponentCondition', 'Mission condition labelled "Any ship ... on team " with team and component type ids.'],
  ['cqb', 'VariableCondition', 'Mission condition whose label starts with "Variable " and stores an index and value.'],
  ['cf', 'SetVariableLabelAction', 'Mission action labelled "Set label of custom variable ".'],
  ['ika', 'AwardVictoryToTeamAction', 'Mission action labelled "Award victory to team " using "wins_for_team_".'],
  ['jpa', 'AdjustVariableAction', 'Mission action labelled "Add 1 to" or "Subtract 1 from" with an index and mode.'],
  ['lrb', 'SetShipTeamAction', 'Mission action labelled "Set team of ship ".'],
  ['oca', 'RemoveEventAction', 'Mission action labelled "Remove this event".'],
  ['pob', 'SetVariableAction', 'Mission action labelled "Set custom variable ".'],
  ['tt', 'AdjustBodyComponentsAction', 'Mission action labelled "Add body components to" or "Subtract body components from".'],
  ['uoa', 'IncrementVariableAction', 'Mission action labelled "Increment custom variable ".'],
  ['via', 'AwardVictoryToWinnerAction', 'Mission action labelled "Award victory to the winning player".'],
]) classes[original] ||= [to, text];
for (const [original, to] of Object.entries(scriptClasses))
  classes[original] ||= [to, 'Developer console command registered by name "' + to + '" in ConsoleCommandRegistry.'];
for (const [owner, original, descriptor, to] of diffFields)
  field(owner, original, descriptor, to, 'The state-diff method prints "' + to + ' has changed" for this field.');
for (const [owner, original, descriptor, to] of getters)
  method(owner, original, descriptor, to, [], 'Body is a single return of the field the state-diff names "' + to.slice(3) + '".');
method('ntb', 'a', '(Ltv;I)V', 'reportDifferences', ['other', 'obfuscationGuard'], 'Implemented by World, Ship and Component; prints each field that differs from the other state.');
method('rqa', 'a', '([Lnc;I)Lnc;', 'execute', ['arguments', 'obfuscationGuard'], 'Every console command subclass returns an nc result from an nc argument array.');
method('VoidHunters', 'f', '(Z)V', 'applyShipCookie', ['logGuard'], 'Reads the fog_voidhunters_ship cookie, logs "Ship cookie=" and applies it.');

// Supplemental reviews use immutable original declaration identities.
const names = JSON.parse(fs.readFileSync(new URL('./voidhunters-names.json', import.meta.url), 'utf8'));
for (const [owner, to, evidence] of names.classes) classes[owner] = [to, evidence];
for (const [owner, original, descriptor, to, evidence] of names.methods)
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
for (const [owner, original, descriptor, to, evidence] of names.fields)
  members[`F:${owner}.${original}:${descriptor}`] = {to, evidence};

export const config = {
  game: 'voidhunters', version: 2, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-voidhunters-rules.mjs', 'reproduce-voidhunters.mjs', 'voidhunters-diff-names.mjs', 'voidhunters-names.json',
    'voidhunters-coverage.mjs', 'naming-coverage.mjs', 'reviewed-game.mjs', 'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    const coverage = voidHuntersCoverage(mapping);
    return ['# Reading Void Hunters', '',
      `Resolved declarations: ${coverage.namedClasses}/${coverage.classes} classes and ${coverage.namedMethods}/${coverage.methods} methods have readable names; ${coverage.constructors} constructors follow their class names.`,
      `Remaining: ${coverage.unresolvedClasses.length} opaque classes and ${coverage.unresolvedMethods.length} opaque methods. ${coverage.complete ? 'All class and method declarations have readable names.' : 'The complete naming goal is still in progress.'}`, '',
      'Start at `VoidHunters`; `World`, `Ship`, `ShipBody`, `ShipComponent`, `MissionControl` and `GameSnapshot` expose the simulation and mission state. The console command classes retain the names of their registered commands.', '',
      '`GameApplet` drives `initializeGame`, `updateGameTick`, `renderGameFrame`, `shutdownGame` and `clearClientResources`. `NetworkGameClient` parses launch parameters and coordinates shared login/reconnection work; `VoidHunters.handleServerPacket` dispatches the game-specific replies.', '',
      '`GameSession.updateSession` processes input and advances the current state; `renderSession` draws the world and HUD. Radial-menu geometry, objective markers, player names/chat, scoreboard and debug overlays have separate entrypoints. `MissionState` exposes phase changes, next-round data, custom variables and round results; `MissionBuilder` passes the voted objective through to `World.objectiveType`.', '',
      '`Widget` owns clipped mouse processing, styled sprite/text drawing, child layout and selection. `IntrusiveDequeIterator` provides independent forward/backward traversal. `NativeSoftwareRenderContext` binds rendering to a thread; `NativeSoftwareSurface` separates canvas resizing and presentation. Native toolkit wrappers name texture uploads, render targets, heaps and context selection.', '',
      '`SerializableGameState` names `readState`, `writeState`, `copyTo` and `differsFrom` across the simulation. `CompactGameState` exposes its additional packed representation. `PacketBuffer`, `IsaacPacketBuffer` and `IsaacCipher` separate byte codecs, bit codecs and encoded protocol bytes.', '',
      '`CarouselCommongameInfo` retains the history ring and event deque, names replay/catch-up and current/history serialization, and selects recorded client states for diagnostics. `CarouselEvent.applyTo` dispatches system events or custom player actions; slots expose `prepareTick` and `advanceSimulation`. `SoftLruCache` separates weighted capacity, strong/soft references, aging and hit promotion from its `IntrusiveNodeHashTable` index.', '',
      '`QuickChatPhraseLoader` caches `QuickChatPhraseDefinition` records from primary and alternate archives. Definitions expose text previews, placeholder segments, linked phrases and `QuickChatDynamicCommand` configuration. `QuickChatMenuWidget` separates layout, shortcut handling, submenu activation and click updates. The standalone `OpenGlToolkit` vertex path uses `OpenGlVertexBufferBinding` with buffer-object and client-memory implementations.', '',
      '`ScrollBarWidget` names thumb geometry, position conversion, dragging and repeated arrow/page input. `ScrollPaneWidget` coordinates content layout, clipping and scrolling; `SelectableIconLabelWidget` and `ScrollableActionPanel` expose their child layout. `OpenGlFramebufferBinding` separates combined/read/draw targets, while `OpenGlFramebufferAttachment` names image detachment. `OpenGlTexture` exposes filtering, mipmap generation and allocation accounting; `OpenGlToolkit` names native state application, framebuffer stacks and deferred disposal queues.', '',
      '`CarouselGameClient` names readiness, incoming/outgoing event buffering, server ticks/checksums and black-box replay requests. `ChunkedDataReceiver` and `ChunkedDataSender` expose transfer progress and throttled packet chunks. `ServerInfo` separates option visibility, availability, membership and new/coming-soon/limited-time badges. The legacy OpenGL texture classes distinguish one-, two- and three-dimensional storage from `OpenGlRenderbuffer`, with explicit upload, wrapping, attachment and disposal operations.', '',
      '`UiComponent` names pointer/key dispatch, focus, bounds, layered drawing and diagnostic trees across its overrides. `UiContainer`, `UiSingleChildContainer` and `UiArrayContainer` expose child traversal; `UiFocusableComponent` supplies action, pointer and focus callbacks. `SoftwareRasterState` supports pooled target/clip save and restore. `NineSliceSprite` draws tiled corners, edges and center; `NanosecondClock` and `SystemNanoClock` identify the profiling time source.', '',
      '`WeaponDefinition` and its twelve concrete weapon definitions name projectile, aiming, energy, reload, pulse, spin and recoil parameters. Their identities follow the registered setting indices consumed by each definition. `WeaponBehaviour` separates firing, projectile creation, reload updates and target locks. `UiArrayContainer` exposes forward/backward focus traversal and child layout.', '',
      '`UiScrollBar`, `UiScrollPane`, `UiViewport` and `UiDraggableContainer` expose thumb geometry, normalized positions, clipping, dragging and scroll offsets. `UiComboBox` names prefix selection and dropdown layout; `UiComboBoxList`, `UiFocusProxy` and `UiComboBoxRenderer` separate its list, focus ownership and selected-text rendering. `QuickChatCategoryLoader` caches group-zero `QuickChatCategoryDefinition` records and recursive category menu construction names their linked categories, phrases and shortcuts.', '',
      '`UiTextField` and `TextInputWidget` name caret/selection editing, word boundaries and direct/asynchronous clipboard operations. `UiTextRenderer` and `UiTextStyle` expose layout metrics, hit-testing, caret and selection drawing. `TextLayout`, `BitmapTextLayout` and `TextLayoutLine` retain line bounds and character-boundary positions; their names preserve the original alignment, caching, markup and spacing behavior.', '',
      '`PlatformService` queues `PlatformRequest` operations for sockets, threads, reflection, clipboard and display/cursor access. The Microsoft-JVM fullscreen and cursor controllers retain their native contracts. `ArrayOperations`, `Cp1252CharacterEncoder`, `SoftwareSprite2D` and `SoftwareIndexedSprite2D` name array, encoding and indexed raster helpers. `DeveloperConsole` and `CommandConsole` expose animated output, command history, expression execution and completion through `TextNode` records.', '',
      'Named texture operations identify constants, coordinate gradients, box blur, clamping, curves, colorization, flipping, waveforms, hash noise, weave and brick patterns, polar displacement, tiling, blending, inversion, kaleidoscope sampling, grayscale, color-key scaling, thresholds, range mapping, Mandelbrot iteration, normal maps, edge magnitude and sprite/texture sources. Their factory ids, fixed-point arithmetic and cache behavior are preserved. `UiStatefulStyle` combines `UiVisualStyle` layers for interaction states; `ScreenSizeController`, `CanvasResizeListener`, `FullscreenCanvas` and `DisplayMode` name resize and fullscreen contracts. Small `World` helpers identify mission events, map-zone lookup, escape pods, body overlap and projectile tests.', '',
      'All forty texture-operation factory products have descriptive class names, including blend modes, HSL adjustment, color gradients, cellular/Perlin noise, stripes, crossed waves, random lines, irregular bricks, directional lighting and raster shapes. `TextureRasterShape` distinguishes line, cubic Bezier, rectangle and ellipse drawing contracts. `ConsoleCharacterStream`, `ConsoleTokenStream` and `ConsoleExpressionToken` expose tokenization, recursive method-call parsing and evaluation; syntax/evaluation exception records retain their original offsets and message payloads. Unrelated static helpers remain in the overall naming audit.', '',
      '`ShipAI` exposes target seeking, obstacle/friendly avoidance, combat controls and desired motion. `FixedPointTrigonometry` names the original quarter-wave lookup and sine/cosine wrappers. `NetworkGameClient` identifies initialization, staged resource updates, login actions, packet dispatch and reconnection; `ReflectionCheck` retains queued lookup requests and protocol response data. Their original guards, timing, reflection behavior and wire formats are preserved.', '',
      '`ClientDataReadRequest` and `ClientDataWriteRequest` expose saved player-data loading, submission and CRC-matched acknowledgements. Integer-array reads, integer-record writes and highscore table/value requests identify their distinct queues and reply handlers. `UiToggleButton` toggles its active state before dispatching actions. The original retry order, byte packing, discarded highscore results and player-data limits remain intact.', '',
      '`SoundPlayback`, `OneShotSound` and `LoopingSound` expose stream lifetime, gain, panning, repeat suppression and refreshed looping playback. `Model3D` supplies X/Z bounds, translation and scaling for `SoftwareModel`, `OpenGlModel`, `GpuModel` and `NativeSoftwareModel`; `ModelData` retains their shared input arrays. Vertex/face normal records, label groups and `ModelFaceAttachment` definitions identify model preparation. Buffer owners identify vertex/index releases. `Camera2D` names world/screen projection and inverse transforms; `TickClock` and `SmoothedNanoTickClock` expose scheduling, delay and bounded catch-up. Original cache behavior and guards remain; source binding checks do not establish native-runtime equivalence.', '',
      '`AccountRequestResult` retains success, age, response codes, messages and suggested names used by name checks and account creation. `AccountCreationForm`, `AccountCreationDialog`, `Under13AccountNoticePanel` and `DialogMessagePanel` identify the account UI. `ModalStack`, `ModalPanel`, `ResizableModalPanel` and `ContentTransitionDialog` expose panel lifetime, fades, resizing and child replacement; `HotspotTextWidget` and `UiHotspotListener` name clickable text regions. Logo helpers name mesh loading, rotation, rendering and glow generation. These are source naming changes; original guards, wire bytes, layout, animation and performance settings remain.', '',
      '`InputValidator`, `DebouncedInputValidator`, `TextFieldValidator` and `ValidatedTextField` expose empty input, the original 350 ms delay, pending checks and value-specific validation. Username, email, confirmation, password and age validators retain the original messages and limits. `GameMenuScreen` and `MenuInputState` name item geometry, hit tests, pointer/key navigation, help pages and action handling; the original AWT key translation table establishes directional and activation keys. Settings changes, protocol writes, clipboard actions and guards remain intact.', '',
      '`ShipBody` names force accumulation, motion integration, mass properties, bounds and controls. `ShipComponent` exposes its tree, transforms, aiming, health, attachment and collision operations. `ComponentAttachmentPlan` records the chosen `HardpointMatch` and obstructions; `ComponentCollision` and `ComponentContact` separate polygon overlaps from contact points. `ProjectileHit` resolves impact effects and damage, while `ProjectileTraceResult` retains the nearest intersection.', '',
      '`MissionEvent.evaluateAndExecute` evaluates each condition, applies its negation flag, collects target body ids and executes actions. Conditions and actions expose descriptions, editable parameters and world marker positions. `GameStateFactory` names default-instance and typed-array creation; each named concrete factory identifies its product type.', '',
      '`GraphicsToolkit` has software, native software, OpenGL and Direct3D implementations. `GpuToolkit` shares the hardware path between `OpenGlGpuToolkit` and `Direct3DToolkit`. `ProceduralTexture` connects `TextureOperation` inputs; `ColorRowCache` and `MonochromeRowCache` retain their computed rows. The native-memory and Direct3D Java wrappers have names matching the operations they dispatch.', '',
      '`GraphicsToolkit` names clipping, projection, drawing, pixel transfer, sprite/font creation, framebuffer selection and heap management. `ToolkitSprite` exposes dimensions, padding, scaled/rotated/affine drawing and tiling across backends; `SoftwareRenderContext` owns the software triangle rasterizer. `Transform3D` names camera setup; the OpenGL and GPU transforms expose matrix export and rigid inversion. `NativeDisposalQueue` manages deferred `NativeResource` cleanup. `OpenGlPostProcessor` runs `OpenGlPostEffect` passes; `OpenGlBloomEffect` implements luminance thresholding, blur and compositing.', '',
      '`ToolkitFont` exposes ordinary and masked glyph drawing. Its software palette, monochrome and alpha variants name their pixel blitters; `GlyphMask` names the software span mask and OpenGL texture mask. Renderer capability names follow the original diagnostic messages for memory pools, backbuffers, shadows, bloom, environment maps, anti-aliasing, threads, particles, underwater effects, clipping and point lights.', '',
      '`GpuVertexBuffer` and `GpuIndexBuffer` expose allocation, locking, unlocking and disposal in the OpenGL and Direct3D backends. `VertexStreamLayout`, `VertexAttribute`, `GpuDataType` and `GpuVertexDeclaration` describe the input streams bound by `GpuToolkit`. The separate legacy 2D path uses `BitmapFont`, `SoftwareMonochromeBitmapFont`, `SoftwareAlphaBitmapFont`, `Sprite`, `ArgbSprite` and `SoftwareRasterizer2D` for markup, kerning, wrapping, glyphs, pixel operations and sprite transforms.', '',
      '`GpuTexture` has 2D, rectangle, 3D and cube implementations for OpenGL and Direct3D. Texture APIs name coordinate conversion, repeat/filter settings, pixel uploads, mipmap generation, format conversion and binding. `GpuToolkit` names render-state application, shared quad/line/circle geometry, perspective/orthographic/screen projections, model-view transforms and `PointLight` uploads. `GpuMaterialEffect` names material activation, parameters and callbacks for matrix and depth-range changes; `TextureCombineSource`, `TextureCombineOperation`, `TextureTransformMode` and `TextureCoordinateMode` describe the shared fixed-function texture state.', '',
      '`AudioPump` services `AudioOutput`; `JavaSoundAudioOutput` submits mixed PCM through Java Sound. `PcmStreamMixer` combines child streams and scheduled listeners. `MidiPcmStream` reads `MusicTrack` events with `MidiFileReader`, manages patch notes and controllers, and mixes them through `MusicPatchPcmStream`. `PcmSampleStream` names its forward/reverse, mono/stereo, interpolated/aligned and gain-ramped mixing kernels. `SoundCache` loads music samples and synthesized `SoundEffect` samples. `SoundInstrument`, `SoundEnvelope` and `SoundFilter` expose synthesis; `VorbisSample` decodes compressed music through its codebooks, floors, residues and mappings.', '',
      '`TextureProvider` supplies RGB, ARGB and floating-point RGBA generation through `ArchiveTextureProvider` and `ProceduralTexture`. `ArchiveIndexLoader` verifies the master archive index and creates cached archive providers. `ResourceArchive` resolves named groups/files and unpacks optional XTEA-encrypted containers; `ArchiveIndex` describes their ids, checksums, versions and name lookups. `CachedArchiveProvider` validates disk/network requests and schedules prefetches. `NetworkArchiveClient` separates queued and in-flight priority/background requests; `SocketNetworkArchiveClient` handles framed responses over `BufferedSocket`. `ArchiveDiskWorker`, `ArchiveDisk`, `BufferedFile` and `BoundedRandomAccessFile` expose queued IO, sector chains, buffering and file-size bounds. `ByteStorage` separates heap arrays from `DirectByteStorage`.', '',
      'Names and review evidence are keyed by original declarations in `voidhunters-names.json` and `voidhunters-diff-names.mjs`. Reproduction verifies compilation, symbol bindings, inheritance relationships and exact source restoration. Fields and locals are outside the complete class/method naming claim. Full gameplay has not been runtime-tested.', '',
      'Reproduce in dekobloko-work:', '', '```sh',
      'env -u JAVA_TOOL_OPTIONS node readable/build-voidhunters-rules.mjs --check',
      'env -u JAVA_TOOL_OPTIONS node readable/reproduce-voidhunters.mjs --check',
      'node readable/voidhunters-coverage.mjs', '```', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'voidhunters-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Void Hunters rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
