import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {prepareEscapeVector} from './prepare-escapevector.mjs';
import {verifyEscapeCore} from './tests/test-escapevector-core.mjs';
import {namingCoverage} from './naming-coverage.mjs';

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
  a: ['MouseWheelHandler', 'AWT MouseWheelListener implementation accumulating rotations and returning/resetting the pending wheel count.'],
  ca: ['MouseWheelInput', 'Abstract attach, detach and poll contract for the mouse wheel; unrelated static text/event helpers remain separate.'],
  c: ['CipherPacketBuffer', 'PacketBuffer with an ISAAC cipher, ciphered opcode/byte reads and a separate MSB-first bit cursor.'],
  df: ['IsaacRandom', '256-word state/results and golden-ratio seed mixing feeding opcode encryption.'],
  hh: ['PcmSample', 'Signed PCM bytes, sample rate, loop start/end and ping-pong flag; resampling adjusts both rate and loop positions.'],
  nh: ['AbstractPcmSample', 'Intrusive sample base retaining the scheduler playback position used by the PCM stream graph.'],
  wg: ['PcmStream', 'Intrusive audio graph contract with active/skip routing, substream traversal, mixing, activity and scheduler priority.'],
  il: ['PcmMixerListener', 'Intrusive scheduled mixer listener with delay and owner, a due-event callback, cleanup and rescheduling interval.'],
  hj: ['PcmStreamMixer', 'Synchronized stream/listener deques, sample mixing/skipping and scheduling across listener deadlines.'],
  hl: ['PcmSampleStream', 'Signed sample interpolation, forward/reverse playback, loop boundaries, stereo panning and gain ramps.'],
  dd: ['PcmResampler', 'Fourteen-tap windowed-sinc polyphase resampler; scales sample rate and loop positions separately.'],
  m: ['TetherHumStream', 'PCM waveform generator driven by the cargo tether tension and gain assigned by GameplaySession.'],
  tl: ['SeekerPulseStream', 'Two sample streams with a shared phase accumulator controlling periodic gain and spatial panning.'],
  wb: ['ReverbPcmStream', 'PCM wrapper processing eight damped comb delays and four all-pass delays per channel with wet/dry and width settings.'],
  nc: ['ReverbCombFilter', 'Reverb delay ring with an index and retained damping/filter value; clear resets delay contents and damping state.'],
  lc: ['ReverbAllPassFilter', 'Reverb all-pass delay ring and cursor; clear resets delay contents.'],
  ie: ['AudioOutput', 'PCM device scheduler, stream prioritization, block mixing, buffered-capacity management and device lifecycle hooks.'],
  vm: ['JavaSoundAudioOutput', 'AudioOutput implementation using AudioFormat, SourceDataLine and signed little-endian 16-bit samples.'],
  ge: ['AudioService', 'Runnable servicing both retained AudioOutput slots until shutdown; unrelated static sprite/account helpers remain separate.'],
  ec: ['SoundCache', 'Separate synthesized/compressed sample archives with intrusive caches and resumable byte-budgeted sample decoding.'],
  f: ['ArchiveIndex', 'Versioned JS5 group CRC/revision/name/digest and file-ID tables, including archive name lookups.'],
  mf: ['ResourceArchive', 'ArchiveProvider-backed packed groups/unpacked files with retention policies, named lookup, XTEA and decompression.'],
  ob: ['ArchiveProvider', 'Abstract reference-index, encoded-group and per-group progress provider used by ResourceArchive.'],
  hk: ['CachedArchiveProvider', 'ArchiveProvider combining network requests, reference validation, local sector stores and asynchronous disk queues.'],
  oa: ['ArchiveRequest', 'Dual-linked pending archive request with completion/progress and retained encoded bytes.'],
  s: ['Js5NetworkRequest', 'ArchiveRequest retaining packet payload, expected length and transport header/trailer accounting.'],
  cm: ['DiskCacheRequest', 'ArchiveRequest retaining disk operation, sector store and byte payload; completion exposes bytes and 100 percent progress.'],
  sb: ['Js5Transport', 'Abstract JS5 connection with independent urgent/prefetch pending and in-flight queues, current response and connection state.'],
  jg: ['SectorCacheStore', 'Six-byte index records and linked 520-byte data sectors with group/archive validation and bounded group lengths.'],
  rg: ['BufferedRandomAccessFile', 'Bounded file wrapper retaining read/write buffers, logical position and lengths and reconciling overlapping reads/writes.'],
  kk: ['DiskCacheWorker', 'Runnable draining secondary-linked disk read/write requests and publishing results and pending-operation counts.'],
  lk: ['SystemTaskService', 'Runnable system-task queue for sockets, threads, URL streams, reflection, display modes and cache-file handles.'],
  la: ['SystemTask', 'Queued system-service operation retaining arguments, link, volatile result and completion status.'],
  jn: ['IntKeyLookup', 'Power-of-two open-address integer key/index pairs used for archive name hashes.'],
  ib: ['IntrusiveNodeHashTable', 'Power-of-two circular bucket sentinels, long-key lookup/insertion and bucket-order traversal.'],
  i: ['Bzip2Decoder', 'Legacy headerless bzip2 bit/Huffman decoding, move-to-front, inverse BWT and run expansion in shared state.'],
  th: ['Bzip2State', 'Bzip2 byte/bit cursors, in-use flags, selectors, Huffman tables and inverse-BWT/run-expansion state.'],
  lj: ['WhirlpoolHasher', '512-bit digest state, ten-round key/cipher workspaces, 256-bit input length and 64-byte block padding.'],
  rn: ['ClientException', 'RuntimeException wrapper retaining an original Throwable and appended client diagnostic context.'],
  wl: ['BitmapFont', 'Software text layout, markup, wrapping, glyph metrics and abstract clipped glyph drawing.'],
  ab: ['CoverageBitmapFont', 'BitmapFont converting indexed glyph pixels to coverage bytes and alpha blending them into the software raster.'],
  fi: ['IndexedSpriteState', 'Base indexed sprite full/trimmed dimensions, offsets and abstract indexed draw operations.'],
  te: ['IndexedSprite', 'Byte palette indices and RGB palette with clipped drawing and alpha blending.'],
  vn: ['RasterBuffer', 'Integer framebuffer, dimensions and backing AWT Image with raster binding and abstract image initialization/presentation.'],
  kd: ['BufferedImageRasterBuffer', 'RasterBuffer binding its integer array through DataBufferInt and a DirectColorModel to BufferedImage.'],
  cg: ['ImageProducerRasterBuffer', 'RasterBuffer using AWT ImageProducer/ImageConsumer with explicit pixel delivery and Graphics presentation.'],
  mi: ['RasterSnapshot', 'Intrusive snapshot of framebuffer pixels, dimensions and clip rectangle for restoring raster state.'],
  ln: ['SpriteCollisionSupport', 'Tests clipped nontransparent overlap between two sprites, including their trim offsets.'],
  hm: ['UiComponent', 'Intrusive widget retaining bounds, text, painter/listener and hover state, with rendering, focus and event hooks.'],
  bj: ['UiContainer', 'UiComponent owning ordered children, container bounds, focus traversal, pointer routing and multi-layer drawing.'],
  hc: ['TextButton', 'Focusable text component invoking a ButtonListener from pointer/keyboard actions and retaining enabled/tab-stop state.'],
  ul: ['EditableTextWidget', 'TextButton with caret/selection, editing, clipboard, word navigation, length limits and text/submit notifications.'],
  wn: ['UiListener', 'Common marker interface for widget action, focus, hover and text-input callbacks.'],
  ba: ['UiContainerMarker', 'Marker interface shared by the child-owning and child-delegating component bases.'],
  db: ['WidgetPainter', 'Widget drawing callback with origin, guard, component and enabled/style state.'],
  ao: ['WidgetTextLayout', 'Painter-side text layout, preferred extents, coordinate lookup, caret and selection drawing contract.'],
  k: ['TextWidgetPainter', 'Font-backed component painter implementing WidgetTextLayout, text alignment, selection/caret and colour settings.'],
  qb: ['ButtonListener', 'Callback receiving an activated TextButton, button code and local pointer coordinates.'],
  ne: ['ButtonPointerListener', 'ButtonListener extension notified of pointer press and release with component origins and pointer coordinates.'],
  nj: ['WidgetHoverListener', 'Receives a widget and its new hit-tested hover state.'],
  ql: ['WidgetFocusListener', 'Receives a widget and its acquired/lost keyboard focus state.'],
  rj: ['TextInputListener', 'Editable field change and Enter-submit callback contract.'],
  el: ['ValidationSource', 'Change notification, empty-input query, current validation state and diagnostic message contract.'],
  sm: ['DebouncedValidator', 'ValidationSource delaying state/message evaluation for 350 milliseconds after the last change.'],
  ah: ['TextFieldValidator', 'DebouncedValidator attached to an EditableTextWidget and delegating text-specific validation and diagnostics.'],
  rf: ['ValidationState', 'Identity token returned by validation sources for empty, waiting, valid and invalid states; static helpers are unrelated.'],
  pg: ['TextLayout', 'Retained line layouts supporting character-to-line lookup, hit testing and text width/height measurement.'],
  hn: ['CheckboxPainter', 'WidgetPainter drawing checkbox background, cross mark, border and an optional font label.'],
  sd: ['JavaScriptBridge', 'Three thin JSObject bridge entry points for calling named window functions and evaluating scripts.'],
  ai: ['CacheFileLocator', 'Bootstrap cache-file lookup using configured game/cache roots, user home and retained filename handles.'],
  ad: ['BoundedUrlRequest', 'Runnable URL/JAGGRAB request state machine reading into a bounded packet payload and closing request/stream handles.'],
  af: ['FullscreenFocusCanvas', 'Fullscreen frame/canvas wrapper retaining focus-loss state and handling fullscreen exit.'],
  ag: ['GameKeyHandler', 'AWT keyboard/focus listener updating the shared pressed-key state and queued input events.'],
  gg: ['FullscreenDisplayController', 'AWT GraphicsDevice fullscreen entry/exit and display-mode enumeration/restoration.'],
  fn: ['SpriteOffset', 'Retained integer x/y pair used for object sprite display alignment and muzzle offsets; static helpers are unrelated.'],
  rk: ['ObjectSpriteSet', 'Retains collision/display sprites and display offsets for four quarter-turn object orientations.'],
  od: ['SelfDestructEffects', 'Session countdown-driven explosion clouds, terminal white flash, countdown audio and replacement music.'],
  o: ['TrackerMusicPlayer', 'Scheduled mixer listener processing a packed multichannel pattern definition, sample voices, tempo and per-channel effects.'],
  ce: ['TrackerMusicDefinition', 'Packed channel/pattern/order and instrument/sample tables consumed by the tracker player.'],
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

// Shared engine names are anchored to this game's declarations and bodies.
// Resolved override propagation names every implementation of each contract.
for (const [owner, original, descriptor, to, parameters, evidence] of [
  ['ca','a','(Ljava/awt/Component;Z)V','attach',['component','guard'],'Adds the mouse-wheel listener to the supplied component.'],
  ['ca','a','(ILjava/awt/Component;)V','detach',['guard','component'],'Removes the mouse-wheel listener from the supplied component.'],
  ['ca','a','(I)I','pollRotation',['guard'],'Returns the accumulated wheel rotation and resets it to zero.'],
  ['ca','a','(ICLjava/lang/String;Ljava/lang/String;)Ljava/lang/String;','replaceCharacter',['lengthAdjustment','character','input','replacement'],'Scans occurrences of one character and appends replacement text between unchanged substrings.'],
  ['c','a','(IZ)V','writeCipheredOpcode',['opcode','guard'],'Adds the next ISAAC word and stores its low byte.'],
  ['c','k','(I)I','readCipheredOpcode',['guard'],'Subtracts the next ISAAC word from an unsigned payload byte.'],
  ['c','a','([BIII)V','readCipheredBytes',['destination','guard','length','offset'],'Subtracts one ISAAC result per copied payload byte.'],
  ['c','a','([IB)V','initializeCipher',['seed','guard'],'Constructs the opcode cipher from the supplied integer seed.'],
  ['c','l','(I)V','beginBitReading',['guard'],'Copies the byte cursor multiplied by eight into the independent bit cursor.'],
  ['c','j','(II)I','readBits',['count','byteBitWidth'],'Reads MSB-first bits across byte boundaries using the retained bit-mask table.'],
  ['c','o','(I)V','endBitReading',['guard'],'Rounds the bit cursor upward to a byte position.'],
  ['c','n','(I)V','releaseStatics',['guard'],'Clears static sprite, text and long-table references.'],
  ['df','a','(I)I','nextInt',['guard'],'Consumes a 256-word ISAAC result block backwards and generates another block when exhausted.'],
  ['df','a','(Z)V','initialize',['guard'],'Golden-ratio seed mixing in groups of eight words initializes the ISAAC state and first result block.'],
  ['df','b','(I)V','generateBlock',['guard'],'Updates ISAAC accumulator/counter/state and fills the next 256 result words.'],
  ['df','a','(B)V','releaseStatics',['guard'],'Clears retained static helpers and tables independently of an instance generator.'],
  ['hh','a','(Ldd;)Lhh;','resample',['resampler'],'Replaces PCM bytes and scales sample rate and loop endpoints, preserving unequal loop bounds.'],
  ['dd','a','(I[B)[B','resample',['guard','samples'],'Fourteen-tap fixed-point convolution, phase advancement and signed-byte saturation.'],
  ['dd','a','(IB)I','scaleSampleRate',['sampleRate','guard'],'Scales a sample rate by the retained reduced output/input ratio.'],
  ['dd','a','(ZI)I','scalePosition',['guard','position'],'Scales a sample position by the reduced ratio and adds six filter-delay samples.'],
  ['dd','a','(Ljava/awt/Component;IBI)Lvn;','createRasterBuffer',['component','height','guard','width'],'Attempts a BufferedImage raster by reflection, then falls back to the ImageProducer raster implementation.'],
  ['dd','a','(I)V','releaseStatics',['guard'],'Clears only static asset/UI/text references; instance resampling coefficients remain owned.'],
  ['wg','a','([III)V','process',['samples','offset','length'],'Active streams mix; inactive streams advance by skipping the same sample count.'],
  ['wg','b','([III)V','mixInto',['samples','offset','length'],'PCM stream mixing contract used by all concrete stream implementations.'],
  ['wg','d','(I)V','skip',['length'],'Advances stream time without writing an output buffer.'],
  ['wg','c','()Lwg;','firstSubstream',[],'Starts child traversal for audio scheduling.'],
  ['wg','b','()Lwg;','nextSubstream',[],'Continues child traversal for audio scheduling.'],
  ['wg','a','()I','activity',[],'Returns a stream activity contribution used by AudioOutput scheduling.'],
  ['wg','d','()I','priority',[],'Returns scheduler priority; the base stream uses 255.'],
  ['il','a','()V','onScheduled',[],'Mixer invokes this after assigning the listener owner and before queueing its deadline.'],
  ['il','b','()V','onRemoved',[],'Mixer invokes this after unlinking a listener and before clearing its owner.'],
  ['il','a','(Lhj;)I','onDeadline',['mixer'],'Due-listener callback returns the next sample delay or a negative removal result.'],
  ['hj','a','(Lwg;)V','addSubstream',['stream'],'Adds a stream to the mixer primary deque.'],
  ['hj','b','(Lwg;)V','removeSubstream',['stream'],'Unlinks a stream from the mixer primary deque.'],
  ['hj','c','(Lil;)V','scheduleListener',['listener'],'Assigns listener ownership, initializes it and inserts by ascending deadline.'],
  ['hj','b','(Lil;)V','removeListener',['listener'],'Checks listener ownership before normalizing deadlines and removing it.'],
  ['hj','a','(Lil;)V','unlinkListener',['listener'],'Unlinks, calls removal callback, clears owner and updates the next deadline.'],
  ['hj','a','(Lhg;Lil;)V','insertListener',['before','listener'],'Walks the sorted listener deque and inserts using the retained deadline.'],
  ['hj','e','()V','normalizeListenerDeadlines',[],'Subtracts processed samples from every listener delay and resets the processed count.'],
  ['hj','c','([III)V','mixSubstreams',['samples','offset','length'],'Processes each retained child stream over one output span.'],
  ['hj','e','(I)V','skipSubstreams',['length'],'Skips the same number of samples in each retained child stream.'],
  ['hj','a','(Lhh;II)V','playSample',['sample','ratePercent','volume'],'Creates a sample stream with the percentage-rate factory and adds it.'],
  ['hj','a','(Lhh;III)V','playSampleWithPan',['sample','ratePercent','volume','pan'],'Creates a panned sample stream and adds it.'],
  ['ie','f','()V','closeDevice',[],'Audio device close hook; Java Sound closes and clears SourceDataLine.'],
  ['ie','a','()I','bufferedSamples',[],'Device occupancy hook; Java Sound subtracts available frames from device capacity.'],
  ['ie','h','()V','writeDeviceBlock',[],'Device write hook; Java Sound saturates 24-bit samples into a little-endian 16-bit block.'],
  ['ie','a','(Ljava/awt/Component;)V','initializeDevice',['component'],'Device setup hook; Java Sound selects sample rate/channel count and creates its byte buffer.'],
  ['ie','b','(I)V','openDevice',['capacity'],'Opens/starts a device with the requested frame capacity.'],
  ['ie','g','()V','flushDevice',[],'Flushes pending device output; Java Sound applies its retained SoundMAX reopen workaround.'],
  ['ob','a','(BI)[B','getEncodedGroup',['guard','groupId'],'Provider contract returning retained/networked encoded JS5 group bytes.'],
  ['ob','a','(I)Lf;','getIndex',['guard'],'Provider contract returning its validated archive reference index.'],
  ['ob','a','(II)I','groupProgress',['guard','groupId'],'Provider progress for the requested encoded group.'],
  ['ob','a','(B)V','releaseStatics',['guard'],'Clears unrelated static assets while provider instances retain their own state.'],
  ['oa','g','(I)I','progress',['guard'],'Request completion percentage; disk requests return zero while pending and 100 when complete.'],
  ['oa','a','(Z)[B','getBytes',['guard'],'Returns completed encoded request bytes, rejecting pending reads.'],
  ['oa','f','(I)V','releaseStatics',['guard'],'Clears shared static sample/text state independently of retained requests.'],
  ['jn','a','(II)I','find',['key','guard'],'Probes alternating key/index slots until a key matches or an empty slot terminates lookup.'],
  ['ib','a','(JI)Lhg;','get',['key','guard'],'Traverses the selected power-of-two bucket for a matching long key.'],
  ['ib','a','(Lhg;IJ)V','put',['node','guard','key'],'Unlinks previous primary ownership and inserts the node at its selected bucket sentinel.'],
  ['ib','a','(Z)Lhg;','first',['guard'],'Resets the bucket cursor and returns the first retained node.'],
  ['ib','a','(B)Lhg;','next',['guard'],'Traverses the current bucket then subsequent nonempty buckets.'],
  ['ib','a','(I)V','releaseStatics',['guard'],'Clears unrelated shared sample/configuration references.'],
  ['nc','a','()V','clear',[],'Zeros every comb-delay sample and its damping accumulator.'],
  ['lc','a','()V','clear',[],'Zeros every all-pass delay sample.'],
  ['lj','a','(J[BI)V','updateBits',['bitCount','input','guard'],'Adds the supplied bit length and packs input bits into 64-byte Whirlpool blocks.'],
  ['lj','b','(Z)V','reset',['guard'],'Zeros input length, buffered bit count and all eight digest words.'],
  ['lj','a','(I[BZ)V','finish',['offset','output','guard'],'Pads the final block, appends the 256-bit bit length and writes the eight-word digest.'],
  ['lj','a','(B)V','compressBlock',['guard'],'Runs Whirlpool key expansion and ten cipher rounds before digest feed-forward.'],
  ['lj','a','(Z)V','releaseStatics',['guard'],'Clears the unrelated static text reference.'],
  ['hm','a','(IIIBI)Z','hitTest',['pointerX','pointerY','offsetX','guard','offsetY'],'Bounds are left/top inclusive and right/bottom exclusive after adding the supplied component origin.'],
  ['hm','a','(CIB)Z','handleKey',['character','keyCode','guard'],'Routes a focused key event, then attempts focus traversal for the Tab code.'],
  ['hm','a','(ZBII)Z','handlePointerFrame',['inputAvailable','guard','offsetY','offsetX'],'Updates hover, routes wheel/press/release events and publishes the current tooltip.'],
  ['hm','i','(I)V','refreshLayout',['guard'],'Reapplies the current bounds through the virtual layout hook.'],
  ['hm','a','(IIB)V','render',['screenX','screenY','guard'],'Draws each retained render layer then the shared tooltip overlay.'],
  ['hm','a','(IBII)V','drawLayer',['screenY','guard','layer','screenX'],'Invokes the component painter on layer zero.'],
  ['hm','b','(IIBIILhm;I)Z','onMouseWheel',['offsetX','rotation','guard','pointerY','pointerX','root','offsetY'],'Wheel event hook; containers and scrollable widgets override the base no-op.'],
  ['hm','a','(IIIILhm;B)V','onPointerReleased',['pointerY','offsetY','pointerX','offsetX','root','guard'],'Clears the retained press code and notifies extended button listeners.'],
  ['hm','a','(IIBIILhm;I)Z','onPointerPressed',['offsetY','pointerX','guard','pointerY','offsetX','root','button'],'Hit-tests and retains the pressed button; buttons additionally acquire focus and notify pointer listeners.'],
  ['hm','a','(IIILhm;)V','updateHover',['guard','offsetY','offsetX','root'],'Updates the retained hit-test result and notifies WidgetHoverListener when it changes.'],
  ['hm','a','(Lhm;CII)Z','onFocusedKey',['root','character','keyCode','guard'],'Focused-key virtual hook; buttons handle Enter/Space and editable fields handle text/navigation.'],
  ['hm','a','(ILhm;)Z','focusNext',['guard','root'],'Focus traversal hook; eligible buttons clear root focus before acquiring focus.'],
  ['hm','f','(I)V','clearFocus',['guard'],'Clears owned keyboard focus and propagates through containers.'],
  ['hm','h','(I)Z','isFocused',['guard'],'Queries keyboard focus; the base component is unfocused and TextButton retains a separate focus flag.'],
  ['hm','e','(I)I','maximumRenderLayer',['guard'],'Returns the last layer needed by this component or its children.'],
  ['hm','d','(I)Ljava/lang/String;','getTooltip',['guard'],'Returns the retained tooltip only while the component is hovered.'],
  ['hm','a','(IIIZI)V','setBounds',['width','y','x','guard','height'],'Assigns all four component bounds through the virtual layout hook.'],
  ['hm','a','(ILjava/util/Hashtable;Ljava/lang/StringBuilder;I)Ljava/lang/StringBuilder;','appendDebugTree',['guard','visited','output','depth'],'Appends widget debug state while preserving circular-reference detection.'],
  ['hm','a','(Ljava/util/Hashtable;Ljava/lang/StringBuilder;II)V','appendDebugBody',['visited','output','depth','guard'],'Appends bounds, text, focus, hover, painter and listener details.'],
  ['hm','a','(ILjava/util/Hashtable;Ljava/lang/StringBuilder;Z)Z','beginDebugDescription',['depth','visited','output','guard'],'Records first visits and emits a circular-reference marker on repeated visits.'],
  ['hm','d','(B)V','releaseStatics',['guard'],'Clears static font/text/table references independently of component instances.'],
  ['db','a','(IIILhm;Z)V','drawWidget',['originX','originY','guard','component','enabled'],'Shared widget painter contract used by text, checkbox and sprite painters.'],
  ['qb','a','(Lhc;IIII)V','onAction',['button','buttonCode','localY','guard','localX'],'Action callback used by keyboard activation and pointer clicks.'],
  ['ne','a','(ILhc;IBII)V','onPointerReleased',[],'TextButton calls this on release with the actual pointer/origin coordinates.'],
  ['ne','a','(ILhc;IIIBI)V','onPointerPressed',[],'TextButton calls this after acquiring focus and retaining the pressed button code.'],
  ['nj','a','(Lhm;IZ)V','onHoverChanged',['component','guard','hovered'],'Emitted when the component hit-test result changes.'],
  ['ql','a','(ZILhm;)V','onFocusChanged',['focused','guard','component'],'Emitted when a button acquires or clears keyboard focus.'],
  ['rj','a','(Lul;I)V','onTextChanged',['field','guard'],'EditableTextWidget calls this after text edits or an explicit notified assignment.'],
  ['rj','a','(ZLul;)V','onSubmit',['guard','field'],'EditableTextWidget calls this for its Enter-submit key.'],
  ['el','a','(I)Lrf;','validationState',['guard'],'Returns the current validator state, respecting empty/debounce conditions.'],
  ['el','a','(Z)V','markChanged',['guard'],'Records the latest input change time.'],
  ['el','b','(I)Ljava/lang/String;','validationMessage',['guard'],'Returns validation diagnostics after empty/debounce checks.'],
  ['el','c','(I)Z','isEmpty',['guard'],'Queries whether the validator has any input text.'],
  ['sm','a','(B)Ljava/lang/String;','evaluateMessage',['guard'],'Nonempty, debounced message evaluation hook.'],
  ['sm','d','(I)Lrf;','evaluateState',['guard'],'Nonempty, debounced validation-state hook.'],
  ['ah','a','(ILjava/lang/String;)Lrf;','validateText',['guard','text'],'Text-specific validation hook used by email, password, name and age validators.'],
  ['ah','a','(BLjava/lang/String;)Ljava/lang/String;','messageForText',['guard','text'],'Text-specific validation diagnostic hook.'],
  ['sd','a','(Ljava/applet/Applet;Ljava/lang/String;I)Ljava/lang/Object;','callWindowFunction',['applet','function','guard'],'Calls a named window function without arguments through JSObject.'],
  ['sd','a','(BLjava/applet/Applet;[Ljava/lang/Object;Ljava/lang/String;)Ljava/lang/Object;','callWindowFunctionWithArguments',['guard','applet','arguments','function'],'Calls a named window function with the supplied argument array.'],
  ['sd','a','(BLjava/applet/Applet;Ljava/lang/String;)V','evaluateScript',['guard','applet','script'],'Evaluates JavaScript in the applet window.'],
  ['EscapeVector','a','(Lhg;Lhg;B)V','insertNodeBefore',['node','before','guard'],'Unlinks a primary-linked node and inserts it immediately before another node.'],
  ['EscapeVector','$cfr$intArgs$a$aafaec74e55e','(Lhg;Lhg;I)V','insertNodeBeforeWithIntGuard',['node','before','guard'],'Same primary insertion with the compiler-recovered full JVM integer guard parameter.'],
  ['qd','$cfr$intArgs$a$3214d41809e1','(ZZIZ)Ljava/lang/String;','chooseAlternateClickPromptWithIntGuard',['firstFlag','secondFlag','guard','thirdFlag'],'Selects the retained alternate-click prompt from the original three-flag index, preserving the full integer guard.'],
  ['bk','$cfr$lcmp','(JJ)I','compareLongs',['left','right'],'Returns minus one, zero or one with JVM long comparison semantics.'],
  ['eh','$cfr$lcmp','(JJ)I','compareLongs',['left','right'],'Returns minus one, zero or one with JVM long comparison semantics.'],
  ['ab','a','([I[[B)[[B','convertPaletteToCoverage',['palette','glyphPixels'],'Reviewed indexed glyph replacement by palette coverage; matching Ace CoverageBitmapFont implementation corroborates the role.'],
  ['ed','a','()V','rotateClockwise',[],'Column-first bottom-to-top pixel copy and swapped trim/full dimensions implement a clockwise quarter turn.'],
  ['ed','b','()Led;','copy',[],'Copies dimensions, trim offsets and every pixel into an independent sprite.'],
  ['ed','d','()Led;','copyMirroredHorizontally',[],'Reverses each row and adjusts the horizontal trim offset in the copied sprite.'],
  ['em','d','()V','clearFramebuffer',[],'Zeros the complete integer framebuffer using an unrolled loop and remainder.'],
  ['em','e','(IIII)V','drawHorizontalLine',['x','y','length','color'],'Clips a horizontal pixel run and writes the same RGB value across it.'],
  ['em','f','(IIII)V','setClip',['left','top','right','bottom'],'Clamps all four clip bounds to framebuffer dimensions and refreshes raster clip state.'],
  ['te','a','(II)V','draw',['x','y'],'Clips and blits nonzero palette-index pixels; matching shared indexed-sprite implementation corroborates the role.'],
  ['te','a','(III)V','drawAlpha',['x','y','alpha'],'Clips palette-index pixels then blends them with the supplied alpha.'],
  ['wl','a','([B)V','decodeFontMetrics',['data'],'Decodes compact/full glyph metrics and builds pair-kerning data from glyph edge profiles.'],
  ['wl','a','([[B[[B[I[I[III)I','computePairKerning',[],'Finds the minimum sum of overlapping edge profiles for a glyph pair; source shape matches the reviewed shared font routine.'],
  ['wl','b','(Ljava/lang/String;I)V','prepareJustification',['text','targetWidth'],'Counts spaces outside markup and stores fixed-point spacing to distribute the requested width.'],
]) method(owner,original,descriptor,to,parameters,evidence);
for (const owner of ['ad','ge','gg','jb','lk'])
  method(owner,'$cfr$sneakyThrow','(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;','rethrowUnchecked',['throwable'],
    'Compiler-recovered generic unchecked rethrow helper; retains the same Throwable identity and does not wrap it.');
fields('a',[['e','I','pendingRotation']],'Mouse wheel events accumulate this count; poll returns it and resets it.');
fields('c',[['r','I','bitPosition'],['s','Ldf;','opcodeCipher']],'Bit reads retain a separate cursor; opcode reads/writes consume ISAAC results.');
fields('hh',[['h','[B','samples'],['j','I','sampleRate'],['k','I','loopStart'],['l','I','loopEnd'],['i','Z','pingPongLoop']],
  'Sample constructors, resampling and sample-stream loop setup establish the retained PCM header.');
fields('wg',[['i','Z','active'],['g','Lnh;','sample'],['h','Lwg;','schedulerNext'],['j','I','schedulerPriority']],
  'PCM processing routes inactive streams to skip; AudioOutput retains scheduler links and priority values.');
fields('nh',[['g','I','schedulerPosition']],'AudioOutput compares and advances the sample scheduling position.');
fields('il',[['g','I','remainingSamples'],['h','Lhj;','owner']], 'Mixer retains a sample deadline and enforces unique listener ownership.');
fields('hj',[['k','Lcn;','substreams'],['n','Lcn;','listeners'],['l','I','nextListenerDeadline'],['m','I','processedSamples']],
  'Mixer splits output spans at the next listener deadline and normalizes all remaining sample delays.');
fields('nc',[['a','[I','delayBuffer'],['b','I','delayIndex'],['c','I','filteredSample']], 'Reverb comb processing retains its delay ring and low-pass damping value.');
fields('lc',[['b','[I','delayBuffer'],['a','I','delayIndex']], 'Reverb all-pass processing retains a delay ring and wrap cursor.');
fields('rn',[['a','Ljava/lang/Throwable;','cause'],['g','Ljava/lang/String;','context']], 'Client exception constructor retains its original cause and diagnostic context.');
fields('hm',[['k','I','x'],['j','I','y'],['g','I','width'],['x','I','height'],['l','Ljava/lang/String;','text'],
  ['i','Ljava/lang/String;','tooltip'],['u','Z','hovered'],['q','Lwn;','listener'],['s','Ldb;','painter'],['p','Lpg;','textLayout']],
  'Bounds, debug output and painter/event consumers distinguish text, tooltip, hover, dimensions, listener and layout.');
fields('hc',[['B','Z','focused'],['A','Z','tabStop'],['y','Z','enabled']],
  'Focus traversal requires enabled and tab-stop state; keyboard-focus query reads the independent focused flag.');
fields('ah',[['f','Lul;','field']], 'TextFieldValidator reads text and emptiness from the attached editable field.');
fields('sm',[['c','J','lastChangeMillis']], 'Debounce tests compare the retained change time plus 350 milliseconds with the current clock.');
fields('fn',[['c','I','x'],['b','I','y']], 'SpriteOffset constructor and object sprite alignment use the retained x/y ordering.');

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
    'tests/test-escapevector-core.mjs','naming-coverage.mjs','reviewed-game.mjs','pinned-compiler.mjs','game-export.mjs','compilation-stubs.mjs'],
  prepareInput:prepareEscapeVector,verifyCore:verifyEscapeCore,
  readingGuide(rules,mapping) {
    const coverage = namingCoverage(mapping);
    return ['# Reading Escape Vector','',
      'This is the only published Java tree. Reviewed rules and the reproducer live in dekobloko-work/readable. The current reverse dictionary is ../../decompilation/escapevector-naming.json.','',
      `This pass names ${Object.keys(classes).length} reviewed classes and ${rules.renames.length} symbols across all ${mapping.files.length} sources. Unresolved roles keep their existing names; reviewed names have no opaque suffix.`,'',
      `Coverage: ${coverage.namedClasses}/${coverage.classes} class declarations and ${coverage.namedMethods}/${coverage.methods} methods have readable names; ${coverage.constructors} constructors follow their owning class. ${coverage.unresolvedClasses.length} classes and ${coverage.unresolvedMethods.length} methods remain opaque. Full naming is ${coverage.complete?'complete':'incomplete'}. The coverage command exits nonzero until every owned class and method is named; constructors and existing Java callbacks retain their required spellings.`,'',
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
      '`PcmStream` defines process/mixInto/skip, firstSubstream/nextSubstream, activity and priority for all concrete audio streams. PcmStreamMixer owns its substreams and timed PcmMixerListener queue. PcmSample/PcmSampleStream/PcmResampler expose PCM bytes, loops, interpolation and resampling. AudioOutput and JavaSoundAudioOutput distinguish device lifecycle hooks from stream mixing. ReverbPcmStream uses separate ReverbCombFilter and ReverbAllPassFilter rings.','',
      '`ResourceArchive` consumes ArchiveProvider; CachedArchiveProvider combines Js5Transport with SectorCacheStore, BufferedRandomAccessFile and DiskCacheWorker. ArchiveIndex holds reference metadata; ArchiveRequest has separate network/disk implementations. SystemTaskService owns operating-system work represented by SystemTask. CipherPacketBuffer/IsaacRandom distinguish opcode encryption from ordinary PacketBuffer byte encodings; WhirlpoolHasher and Bzip2Decoder/Bzip2State identify archive digest and decompression work.','',
      '`DialogueScreen.advanceDialogue` handles reveal timing, input and scene changes; `drawDialogue` draws the current image/text. IntrusiveNode/IntrusiveDeque expose primary ownership and traversal; DualLinkNode has independent secondary links. Sprite/SpriteState separate RGB pixels, trimmed dimensions and offsets. SoftwareRasterizer holds the shared framebuffer and clipping. PacketBuffer and SoundEnvelope expose byte decoding and envelope interpolation.','',
      '`UiComponent` separates hitTest, hover updates, keyboard focus, pointer routing, rendering and layout. UiContainer owns children; TextButton adds focus and actions; EditableTextWidget adds caret/selection and edit/submit notifications. WidgetPainter and WidgetTextLayout retain separate drawing/layout contracts. ButtonListener, ButtonPointerListener, WidgetHoverListener, WidgetFocusListener and TextInputListener expose the corresponding callback families. The debounced validation hierarchy distinguishes state/message evaluation from change notification.','',
      '## Reproduce and verify','',
      'From dekobloko-work:','',
      '```sh','node readable/build-escapevector-rules.mjs --check','node readable/reproduce-escapevector.mjs --update',
      'node readable/reproduce-escapevector.mjs --check','node scripts/check-source-catalog.mjs ../funorb-decompiled',
      'node readable/naming-coverage.mjs escapevector',
      'node readable/tests/test-escapevector-core.mjs /path/to/original/escapevector.jar','```','',
      'The exact raw input is pinned to Git. Existing generic java-tools declaration and decision proofs run across every file from a verified compiler-source archive, without game assumptions or compiler flags. Each stage is checked for determinism and idempotence, and its hashes/counts are retained in the current dictionary. Naming binds declarations/references/overrides, compiles the complete raw/named corpus and retains reversible edits. No generated sources or binary dependencies are stored in Deko.','',
      'Native fixtures compare historical, prepared and named implementations against independent expectations for versioned terrain headers, empty/full/partial masks, sprite collision stamping/removal and deque transfers. Independently authored complete level streams cover versions zero through eleven, exact byte consumption, target/countdown/frame boundaries, seeker positions, powerup filtering, fuel/shield defaults and objective/gravity whitelists. Widget fixtures check hit-test boundaries/origins, hover versus keyboard focus, virtual focus traversal and the Enter action callback. The fixed original gamepack passes all 1,322 assertions too. These focused checks do not prove whole-game behavior, multiplayer compatibility or frame rate. The original mutable obfuscationControl and guard branches remain; unsupported structural recovery and unresolved local names still need review.',''].join('\n');
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
