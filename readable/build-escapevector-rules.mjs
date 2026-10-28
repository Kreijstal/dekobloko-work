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
  vl: ['TextLayoutLine', 'One laid-out text line with top/bottom extents and an insertion-point x coordinate per character boundary.'],
  wh: ['CachedTextLayout', 'TextLayout implementation caching font/text/alignment settings and rebuilding single or wrapped line geometry.'],
  r: ['SingleChildContainer', 'Abstract component forwarding focus, input, layout and drawing to one retained child.'],
  ni: ['DraggableWidget', 'Single-child wrapper retaining drag pointer offsets, original position and optional spring-back motion.'],
  qa: ['DropTargetWidget', 'Single-child wrapper hit-testing pointer release and notifying a listener with the active dragged widget.'],
  nd: ['WidgetDragListener', 'Notified when the active dragged wrapper changes position.'],
  mk: ['WidgetDropListener', 'Receives a released draggable wrapper and its drop target, including a null target outside drop zones.'],
  og: ['ValidationProvider', 'Exposes the retained ValidationSource belonging to an editable widget.'],
  gd: ['ValidatedTextWidget', 'EditableTextWidget with a retained validator, change notification and pointer-relative tooltip placement.'],
  ue: ['TextHotspotWidget', 'TextButton parsing hotspot markup into per-line hit regions, hover underlines, tooltips and click IDs.'],
  sg: ['TextHotspotListener', 'Receives the clicked hotspot ID and button code from a TextHotspotWidget.'],
  bl: ['TextHotspotRegion', 'Intrusive hit rectangle with hotspot ID and a link to the next line fragment of the same hotspot.'],
  qn: ['NameSuggestionListener', 'Name suggestions panel notifies selection of a proposed name or a request for more suggestions.'],
  rh: ['NameSuggestionsPanel', 'Builds selectable normalized name suggestions and a More suggestions button, then routes their actions.'],
  lb: ['MatchingTextValidator', 'Validates confirmation text against another editable field, respecting that field\'s own validation state.'],
  hi: ['EmailSyntaxValidator', 'Validates email address syntax and reports the retained check-address diagnostic.'],
  dg: ['EmailAvailabilityValidator', 'Checks matching email fields before polling a cached asynchronous email-availability request.'],
  nk: ['PasswordValidator', 'Checks password characters, length and similarity to the associated name/email fields.'],
  kl: ['AgeValidator', 'Accepts numeric input only for ages greater than zero and at most 130.'],
  kf: ['NameAvailabilityValidator', 'Checks name syntax then polls remote availability and exposes cached suggested alternatives.'],
  oj: ['ValidationIndicator', 'Non-focusable button rendering pending/valid/invalid status sprites and the validator diagnostic tooltip.'],
  d: ['EmailAvailabilityRequest', 'Retains an email address and independently tracks request completion and availability.'],
  lm: ['NameAvailabilityResult', 'Retains name availability, error text, suggested names and account-response status.'],
  tn: ['ViewportResizeListener', 'Receives viewport width/height and the windowed/fullscreen resize mode from the viewport controller.'],
  pk: ['ViewportController', 'Tracks desired/minimum/maximum dimensions, aspect ratio, fullscreen entry and deferred resize notifications.'],
  ub: ['NativeAudioBackend', 'Marker implemented by the legacy Microsoft DirectSound backend.'],
  wm: ['LegacyDirectSoundBackend', 'Constructs Microsoft DirectSound descriptors, cursors and audio format objects for two output buffers.'],
  in: ['VorbisSample', 'Packed Vorbis sample packets, shared setup/bit reader and inverse-transform/window/overlap decoder producing signed PCM.'],
  fm: ['VorbisCodebook', 'Vorbis codeword lengths, canonical Huffman decode tree and scalar/vector lookup values.'],
  u: ['VorbisFloor', 'Type-one Vorbis floor partitions, class/subclass books, predicted control points and inverse-decibel curve application.'],
  ud: ['VorbisResidue', 'Vorbis residue partitions, classification/pass codebooks and interleaved or sequential vector accumulation.'],
  pm: ['VorbisMapping', 'Vorbis submap count, selected mux and floor/residue indices consumed by packet decoding.'],
  we: ['SynthInstrument', 'Envelope-controlled oscillators, modulation, gating, echo and filter synthesis into a shared signed sample buffer.'],
  cl: ['AudioFilter', 'Feedforward and feedback filter sections with interpolated frequency/attenuation pairs and Q16 coefficients.'],
  kj: ['SoundEffect', 'Up to ten delayed synthesized instruments mixed to 22050 Hz signed PCM with loop endpoints.'],
  vh: ['Bullet', 'Pooled player/turret projectile with Q16 position/velocity, remaining lifetime, kind and inactive flag; GameplaySession updates, collides and recycles its active prefix.'],
  uk: ['ShipHullGeometry', 'Retains camera origin, nose, center notch, two wings and raster bounds consumed by the session hull rasterizer; static mesh/network helpers are unrelated.'],
  ia: ['TriangleMesh', 'Retains indexed triangle vertices, per-corner normals and material/priority groups consumed by depth bucketing and lit triangle rendering.'],
  om: ['QuickChatDynamicCommand', 'ID and parameter count looked up by the quick-chat phrase decoder before reading each dynamic command parameter list; static network/mouse globals are unrelated.'],
  mn: ['ReflectionCheck', 'Queued reflection operation codes, field/method lookup tasks, serialized invocation arguments, replacement integers and per-operation errors consumed by the reflection-check result writer.'],
  qm: ['IterableNodeHashTable', 'Power-of-two long-key bucket sentinels using primary node links and exposing NodeHashTableIterator through Iterable.'],
  vb: ['IterableDualLinkDeque', 'Circular secondary-link deque exposing Java Iterator traversal separately from primary node ownership.'],
  rm: ['DualLinkDequeIterator', 'Iterator over IterableDualLinkDeque secondary links with last-returned removal; also owns an unrelated mouse-listener attachment helper.'],
  hb: ['NodeHashTableIterator', 'Iterator traversing IterableNodeHashTable buckets and primary links, retaining the last returned node for removal.'],
  wf: ['IntrusiveDequeCursor', 'Independent bidirectional primary-link cursor with first/last, inclusive start-node and next/previous operations.'],
  sh: ['WeightedCacheEntry', 'Dual-linked cache entry retaining a weight, an abstract value accessor and an abstract soft-reference predicate consumed by the weighted LRU cache.'],
  vk: ['StrongCacheEntry', 'WeightedCacheEntry retaining a strong Object value and returning false from the soft-reference predicate.'],
  fa: ['WeightedLruCache', 'Combines a key hash table and secondary-link recency queue with capacity/remaining weight, replacement and least-recent eviction.'],
  eg: ['MouseInputHandler', 'AWT mouse/motion/focus listener updating shared pending coordinates, held/clicked buttons, idle ticks and input-change state.'],
  hd: ['DelegatingCanvas', 'Canvas forwarding paint and update to its retained Component; its static password-policy helper is unrelated.'],
  kb: ['SocketConnector', 'Host/port endpoint with an abstract connection operation and a direct Socket connection helper.'],
  jb: ['ProxySocketConnector', 'SocketConnector consulting system ProxySelector and attempting DIRECT, SOCKS and HTTP CONNECT transports with proxy authentication diagnostics.'],
  im: ['ProxyAuthenticationException', 'IOException raised for HTTP 407 with the proxy authentication scheme, then retained while alternative proxies are tried.'],
  tc: ['SpriteStrip', 'Retains sprites and spacing, sums their full widths and draws each non-null sprite in horizontal sequence.'],
  bd: ['SavedDataWrite', 'Queued saved-data payload whose serialized request CRC is retained for matching the server acknowledgement.'],
  ij: ['HighscoreQuery', 'Pending board query retaining completion state and decoded string, integer and long column arrays.'],
  ik: ['ScoreSubmission', 'Queued score submission with a sequence ID, board/complement, four encoded words, extra values and a server response value.'],
  jh: ['AchievementQuery', 'Queued achievement bitmap query retaining completion, unavailable-service state and returned integer bitmap words.'],
  rl: ['RatingQuery', 'Framework rating-table request retaining the request ID and row count used by response decoding.'],
  ll: ['ArchiveKeyRequest', 'Queued archive/group key request completed by four returned XTEA words; unrelated helpers handle packet length, account name and menu animation.'],
  dm: ['DelayedServerPacket', 'Incoming opcode/payload queued with an absolute delivery time by the simulated-latency receive path.'],
  cc: ['ProgressRecord', 'Queued campaign/level progress record carrying four encoded words, serialized with a CRC and removed on a matching campaign/level acknowledgement.'],
  dc: ['ProgressQuery', 'Queued campaign progress query completed with integer progress words by the subtype-zero response.'],
  qd: ['AchievementRecord', 'Queued achievement record carrying category/achievement identifiers and four encoded words; removed by the record acknowledgement.'],
  ih: ['BinaryBitmapFont', 'BitmapFont drawing each nonzero glyph-mask byte as a solid color, with alpha and scanline-mask variants.'],
  jl: ['LegacyTextBlock', 'Legacy fixed-640-pixel text layout retaining an uppercase title, wrapped paragraphs, font/colors and measured block geometry.'],
  gl: ['PairedTextColumns', 'LegacyTextBlock laying out two text columns around a measured split, with independently colored left/right rows.'],
  wd: ['SpriteLabelColumns', 'LegacyTextBlock pairing right-aligned SpriteStrip rows with left-aligned text labels.'],
  dk: ['LegacyButton', 'Legacy styled button retaining bounds, action ID, label/font, sprite/state palettes and reveal timing; separate helpers decode progress responses and CP1252.'],
  me: ['LegacyMenuColumn', 'Header and selectable rows with numbered, fixed-text, free-text or integer width modes, font metrics, position and selected/normal colors.'],
  fd: ['NineSliceFrame', 'Retains the nine corner/edge/center sprites passed to the nine-slice frame renderer; unrelated static helpers handle account-name separators.'],
  tk: ['EmailValidationError', 'Identity error tokens returned by email local-part/domain validation, with null representing acceptance; unrelated static asset/account helpers remain.'],
  ee: ['LoginMethod', 'Retains the login-method name matched against the last-login-method cookie; static animation/rendering helpers are unrelated.'],
  re: ['GradientOutlineTextPainter', 'TextWidgetPainter drawing an enabled widget gradient outline before delegating text rendering.'],
  ck: ['ThreeSliceButtonPainter', 'Text painter drawing a three-sprite horizontal button with normal/hover/disabled tints and centered text.'],
  ve: ['MarkerSliderPainter', 'Draws a slider track and each retained marker at its scaled position, then the optional centered label.'],
  sc: ['DialWidgetPainter', 'Draws a circular selector, optional marked step, selected radial line and adjacent label.'],
  ae: ['SpriteCheckboxPainter', 'WidgetPainter drawing a gradient outline, optional checked-state sprite and keyboard focus decoration.'],
  q: ['MarkerSlider', 'TextButton mapping pointer position to a bounded marker value; left press appends a marker and right press removes the nearest.'],
  eb: ['DialWidget', 'TextButton mapping an inside-circle pointer angle to a wrapped discrete step; also owns the shared sprite-sheet decoder.'],
  kn: ['GrowableIntList', 'Integer array with last-index size tracking, append/indexed assignment/removal and additive or multiplicative capacity growth.'],
  uh: ['ArgbSprite', 'Sprite subclass whose drawing kernels use the high byte of each pixel as coverage, including scaled, tinted, additive and rotated paths.'],
  uf: ['UiTheme', 'Retains default component/button/checkbox/editable painters and tooltip font, padding, colors and wrapping policy; provides shared line and alpha-rectangle drawing wrappers.'],
  ef: ['WidgetStyleLayer', 'Optional text/shadow/alpha/offset/sprite/nine-slice overrides accumulated or flushed by the stateful text painter.'],
  he: ['StatefulTextPainter', 'Text painter combining base, selected, hovered, pressed, disabled and focused style layers before drawing.'],
  bo: ['Checkbox', 'TextButton toggling its selected flag on activation and using the theme checkbox painter.'],
  bb: ['ModalPanel', 'Centered panel whose opacity follows whether it is open and first in its owning modal stack; closed faded panels are removed.'],
  vg: ['ResizableModalPanel', 'ModalPanel with framed background, eased width/height interpolation and a resize-completion hook.'],
  fj: ['ContentTransitionDialog', 'Resizable modal fading its old content out, resizing, installing new content and fading it in through an alpha wrapper.'],
  ng: ['LoginDialog', 'ContentTransitionDialog used to host LoginForm with the fixed header, fade and resize timings.'],
  tb: ['ModalStack', 'Owns ordered ModalPanel instances, returns the first open panel for focus, updates/removes closed panels and draws back-to-front.'],
  md: ['AlphaContainer', 'Single-child wrapper drawing directly at full alpha or via a temporary sprite at intermediate alpha.'],
  ki: ['LabeledField', 'Single-child row with a wrapped font label on either side, measured label width, padding and delegated tooltip hover.'],
  jm: ['StripedProgressBar', 'UI progress bar with Q16 completion, scrolling stripe sprites, shaded rounded caps and clipped filled/unfilled rendering.'],
  w: ['LoadingProgressDialog', 'Resizable modal with a striped progress bar, status text, optional explanatory paragraph and alternate progress colors.'],
  pn: ['AccountRequestDialog', 'Content-transition modal displaying account request progress, server response messages and response-specific action buttons.'],
  qc: ['RegistrationRequestDialog', 'AccountRequestDialog retaining the registration form, handling registration responses and account continuation/terms actions.'],
  qi: ['AccountMessagePanel', 'Wrapped account message with appended buttons routed to numeric account actions or its owning request dialog close operation.'],
  tm: ['AccountNoticeDialog', 'Resizable modal choosing an account notice by identity token and appending a button that closes the notice.'],
  h: ['LoginForm', 'Editable account identifier and masked password fields with login, account creation, recovery/cancel/guest actions and keyboard submission.'],
  oi: ['DisplayNameForm', 'Validated display-name field with name suggestions, submission, cancel and validation-help layout.'],
  jf: ['AccountTermsPanel', 'Registration continuation panel with terms/privacy/conduct hotspots and a button notifying and closing the registration request.'],
  l: ['AccountChoicePanel', 'Account choice buttons for returning to the previous screen, account creation and playing without logging in.'],
  lf: ['ValidationHelpWidget', 'Non-focusable hotspot text switching between validation diagnostics and help text, with animated pending/invalid indicators.'],
  ha: ['LinkButtonPainter', 'Underlined blue text painter with hover/focus colors and a keyboard focus decoration.'],
  un: ['PasswordFieldPainter', 'Gradient-outline text painter replacing each source character with an asterisk for display.'],
  fh: ['ByteStorage', 'Abstract byte-array storage contract implemented by direct-buffer storage; unrelated globals retain game fonts, logo meshes and level-file names.'],
  km: ['DirectByteStorage', 'ByteStorage copying input bytes into a direct ByteBuffer and returning a fresh byte array from its capacity.'],
  eo: ['TickClock', 'Abstract reset, delay calculation and tick advancement contract with a shared wait-and-advance wrapper.'],
  qf: ['NanoTickClock', 'TickClock sampling System.nanoTime deltas, tracking the next tick deadline and bounding catch-up to ten ticks.'],
  pj: ['BufferedSocket', 'Socket wrapper reading synchronously and writing through a bounded circular buffer serviced by a system-task thread.'],
  bk: ['SocketJs5Transport', 'Js5Transport sending queued archive requests over BufferedSocket, parsing chunked responses and retrying after connection/integrity failures.'],
  vj: ['LoginCredentials', 'Abstract credential payload writer and credential-type identity contract used by login framing.'],
  ld: ['UsernameCredentials', 'LoginCredentials writing an encoded account-name long and base-38 password; unrelated static helpers draw nine-slice frames and locate score rows.'],
  bh: ['EmailCredentials', 'LoginCredentials writing a circumfixed email string and base-38 password with its own credential-type identity.'],
  pl: ['AlternateUsernameCredentials', 'UsernameCredentials variant retaining exactly the same payload writer and returning the alternate type selected by the credential factory Boolean; the reason for that protocol distinction remains unresolved.'],
  fk: ['LoginCredentialType', 'Retains the integer credential tag written after the login opcode; unrelated static helpers include byte-storage extraction and contact lookup.'],
  ei: ['SavedDataQuery', 'Queued saved-data query node with completion state and returned byte payload, created before the saved-data query request is sent.'],
  bi: ['MeshRasterState', 'Mesh raster clip dimensions/center and row offsets, with reciprocal and Q16 sine/cosine tables.'],
  nn: ['SecondaryNodeHashTable', 'Power-of-two long-key buckets using DualLinkNode secondary links and a retained equal-key continuation cursor.'],
  tg: ['ContactEntry', 'Contact update record retaining display name, interned online location and insertion sequence for location-aware ordering.'],
  cd: ['LegacyStyleNode', 'DualLinkNode base of the legacy widget style/contact hierarchy; its unrelated static helper validates email addresses.'],
  ol: ['LegacyWidgetStyle', 'Keyed style object inheriting non-sentinel font/sprite/scalar overrides from an optional template; also the original base of ContactEntry.'],
  pe: ['MinimapPoint', 'Integer x/y pair delimiting the minimap terrain rectangle; unrelated static factory creates the client tick clock.'],
  an: ['BrowserSessionMarkerState', 'Retains the in-memory marker set by browser-session cookie writing and consulted before checking cookies; other globals remain separate.'],
  aa: ['RepeatedCharacterSupport', 'Checks whether the remainder of a password repeats its first character; unrelated helper checks client-version boundaries.'],
  b: ['AccountOverlayController', 'Services the account overlay panel stack, pointer input and queued key events, or shows a connection notice when account service is unavailable.'],
  bc: ['SavedDataQuerySupport', 'Creates/enqueues SavedDataQuery before writing its account request; unrelated globals include sprite-sheet heights and game audio.'],
  wa: ['TrackerGainSupport', 'Limits the retained tracker gain to a supplied ceiling and updates the active tracker player when lowered.'],
  j: ['NameAvailabilityResponseSupport', 'Installs completed name availability/suggestion/error results according to the account response code.'],
  ac: ['KeyboardStateSupport', 'Copies queued keyboard transitions into held-key state under the input monitor; unrelated helpers load fonts and close cache services.'],
  hf: ['LoginStage', 'Identity tokens used by login request/reply state transitions; unrelated static helpers save raster state, load levels, decode sprites and encode text.'],
  dl: ['RasterRestoreSupport', 'Restores framebuffer/clip state from the raster snapshot stack and returns snapshots to its reuse deque; unrelated helpers manage tooltips and URL opening.'],
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
// Text geometry and UI roles were reviewed against this game's bodies and callers.
for (const [owner, original, descriptor, to, parameters, evidence] of [
  ['ao','a','(Lhm;I)I','contentWidth',['component','guard'],'Returns component width minus the painter left/right insets.'],
  ['ao','a','(I)I','lineHeight',['guard'],'Returns font ascent plus descent.'],
  ['ao','a','(IIIIILhm;)I','characterIndexAtPosition',['originX','originY','pointerY','pointerX','guard','component'],'Converts pointer coordinates to text-local coordinates and hit-tests the current text layout.'],
  ['ao','a','(ILhm;)I','preferredHeight',['guard','component'],'Returns laid-out text height plus top/bottom insets.'],
  ['ao','b','(Lhm;I)Lpg;','ensureTextLayout',['component','guard'],'Creates and updates the retained layout according to text, font, wrapping and alignment settings.'],
  ['ao','a','(Lhm;II)I','textOriginY',['component','originY','guard'],'Combines component y, vertical text offset, top inset and supplied origin.'],
  ['ao','a','(BLhm;I)I','textOriginX',['guard','component','originX'],'Combines component x, horizontal text offset, left inset and supplied origin.'],
  ['ao','a','(BLhm;)I','preferredWidth',['guard','component'],'Returns the widest laid-out line plus horizontal insets.'],
  ['ao','a','(IILhm;III)V','drawSelection',['originX','selectionStart','component','selectionEnd','guard','originY'],'Sorts selection endpoints and draws the selected spans across their laid-out lines.'],
  ['ao','a','(Lhm;IIIZ)V','drawCaret',['component','characterIndex','originX','originY','guard'],'Draws the focused insertion caret at a character boundary, clipped to the component.'],
  ['k','a','(Lhm;III)V','drawText',['component','originY','originX','guard'],'Draws the component text with the retained normal text and shadow colors.'],
  ['k','b','(Lhm;III)I','textYForOffset',['component','guard','textOffset','originY'],'Adds one text-local y offset to the component/painter text origin.'],
  ['k','a','(IIIIIIZLhm;)V','drawStyledText',['originY','textColor','shadowColor','originX','offsetY','offsetX','guard','component'],'Clips and draws wrapped or aligned text using explicit colors and text offsets.'],
  ['k','a','(ILhm;II)I','textXForOffset',['textOffset','component','guard','originX'],'Adds one text-local x offset to the component/painter text origin.'],
  ['k','b','(ILhm;)I','contentHeight',['guard','component'],'Returns component height minus the painter top/bottom insets.'],
  ['k','a','(Lk;I)V','copyStyleTo',['destination','guard'],'Copies font, insets, alignment, wrapping and colors into another painter.'],
  ['k','a','(ZC)Z','isAsciiAlphanumeric',['guard','character'],'Accepts only ASCII digits and upper/lowercase Latin letters.'],
  ['k','b','(BLhm;)Ljava/lang/String;','displayText',['guard','component'],'Provides the text consumed by drawing/layout; specialized painters override it.'],
  ['k','c','(Lhm;I)V','layoutSingleLine',['component','guard'],'Selects left, centered or right single-line layout and the font-relative baseline.'],
  ['pg','a','(II)I','lineForCharacter',['characterIndex','firstLine'],'Finds the containing line while accounting for shared insertion boundaries.'],
  ['pg','c','(I)I','height',['guard'],'Returns the distance from the first line top to the last line bottom, or zero for no lines.'],
  ['pg','a','(B)I','maximumLineWidth',['guard'],'Returns the greatest terminal line x coordinate, retaining minus one for no lines.'],
  ['pg','a','(IILjava/lang/String;I)I','justificationSpacingQ8',['guard','textWidth','text','targetWidth'],'Counts spaces outside markup and computes the extra fixed-point spacing per space.'],
  ['pg','a','(BI)I','characterX',['guard','characterIndex'],'Maps a global insertion boundary to its line-local x coordinate.'],
  ['pg','a','(BII)I','characterIndexAt',['guard','x','y'],'Finds a line covering y and its nearest insertion boundary; rejects positions outside line extents.'],
  ['pg','a','(I)Ljava/awt/Container;','gameContainer',['guard'],'Returns the retained fullscreen frame or applet container.'],
  ['vl','b','(I)I','width',['guard'],'Returns the terminal insertion x coordinate, or zero for absent/empty boundaries.'],
  ['vl','a','(BI)I','characterIndexAtX',['guard','x'],'Uses adjacent insertion-point midpoints to find the nearest character boundary.'],
  ['vl','a','(II)I','sineQ16',['angle','guard'],'Reads the 2048-entry Q16 sine table with an 11-bit wrapped angle.'],
  ['wh','a','(Lwl;Ljava/lang/String;IIB)V','layoutRightAligned',['font','text','rightX','baselineY','guard'],'Builds one cached line ending at the supplied right edge.'],
  ['wh','a','(Ljava/lang/String;IILwl;)Lvl;','createSingleLine',['text','baselineY','guard','font'],'Installs a line with font-derived vertical extents and one x slot per insertion boundary.'],
  ['wh','a','(ILjava/lang/String;Lwl;IIIIB)V','layoutWrapped',['height','text','font','width','horizontalAlignment','verticalAlignment','lineSpacing','guard'],'Wraps text, creates line extents and populates aligned/justified insertion coordinates.'],
  ['wh','a','(Ljava/lang/String;IIILwl;)V','layoutLeftAligned',['text','guard','leftX','baselineY','font'],'Builds one cached line starting at the supplied left edge.'],
  ['wh','a','(Ljava/lang/String;ILwl;IZ)V','layoutCentered',['text','centerX','font','baselineY','guard'],'Builds one cached line centered on the supplied x coordinate.'],
  ['hc','a','(IIII)V','notifyAction',['guard','localY','localX','buttonCode'],'Notifies the retained ButtonListener; hotspot widgets extend this with hotspot IDs.'],
  ['ul','a','(Z)V','notifyTextChanged',['guard'],'Notifies TextInputListener; validated text widgets additionally mark their validator changed.'],
  ['ul','n','(I)V','notifySubmit',['guard'],'Calls the retained text-input submit callback.'],
  ['ul','l','(I)Ljava/lang/String;','selectedText',['guard'],'Returns the substring between the two selection endpoints in sorted order.'],
  ['ul','a','(Ljava/lang/String;ZI)V','setText',['text','suppressNotification','guard'],'Normalizes null, truncates to the maximum length, moves both endpoints to the end and optionally notifies.'],
  ['og','a','(B)Lel;','validator',['guard'],'Returns the ValidationSource retained by a validated text widget.'],
  ['gd','a','(Lel;B)V','setValidator',['validator','guard'],'Assigns the retained input validator.'],
  ['nd','a','(Lni;III)V','onDragged',['widget','originY','originX','guard'],'Called after the draggable wrapper updates its position from the pointer offsets.'],
  ['mk','a','(Lqa;Lni;B)V','onDropped',['target','widget','guard'],'Called on pointer release with the active dragged wrapper and the target, if any.'],
  ['sg','a','(ILue;II)V','onHotspotAction',['guard','widget','hotspotId','buttonCode'],'Called when a hotspot hit region is clicked.'],
  ['ue','a','(Ljava/lang/String;BI)V','setHotspotTooltip',['tooltip','guard','hotspotId'],'Grows and assigns the tooltip table indexed by hotspot ID.'],
  ['ue','k','(I)V','rebuildHotspots',['searchStart'],'Parses hotspot markup and creates a hit rectangle for each covered line fragment.'],
  ['ue','a','(IBI)Lbl;','hotspotAt',['textY','guard','textX'],'Traverses hotspot chains and returns the owning hotspot for a hit line fragment.'],
  ['ue','b','(IIII)V','setBoundsToTextHeight',['guard','x','width','y'],'Assigns bounds with the painter preferred text height.'],
  ['qn','a','(B)V','onMoreSuggestions',['guard'],'Called by the More suggestions button.'],
  ['qn','a','(BLjava/lang/String;)V','onNameSelected',['guard','name'],'Called with the normalized suggestion selected by the user.'],
  ['rh','a','([Ljava/lang/String;B)V','setSuggestions',['suggestions','guard'],'Rebuilds suggestion buttons, labels and the More suggestions action.'],
  ['r','a','(Lhm;I)Z','focusChildIfUnfocused',['root','guard'],'Attempts child focus only when a retained child is not already focused.'],
  ['r','b','(ILhm;)Z','focusChildIfUnfocused',['guard','root'],'Alternate argument-order helper for the same child focus traversal.'],
  ['r','a','(IBLjava/util/Hashtable;Ljava/lang/StringBuilder;)V','appendChildDebugTree',['depth','guard','visited','output'],'Adds indentation and the retained child debug tree or null marker.'],
  ['r','k','(I)V','layoutChild',['guard'],'Refreshes the retained child bounds; draggable widgets extend this to save the return position.'],
  ['r','j','(I)Lhm;','focusedChild',['guard'],'Returns the retained child only when it owns keyboard focus.'],
  ['d','a','(BZ)V','complete',['guard','available'],'Stores the availability result and marks the asynchronous request complete.'],
  ['d','b','(I)Z','isComplete',['guard'],'Returns whether an availability response has been installed.'],
  ['d','a','(I)Ljava/lang/String;','email',['guard'],'Returns the request email address.'],
  ['d','c','(I)Z','isAvailable',['guard'],'Returns the retained availability result.'],
  ['tn','a','(ZII)V','onResize',['windowed','width','height'],'Viewport resize notification with desired pixel dimensions and mode.'],
  ['pk','a','(I)V','restoreWindowedSize',['guard'],'Notifies the saved windowed dimensions after fullscreen entry fails.'],
  ['pk','a','(Z)Laf;','enterFullscreen',['windowed'],'Saves windowed dimensions, notifies fullscreen size and attempts to create the fullscreen canvas.'],
  ['pk','b','(I)V','updateViewport',['guard'],'Applies immediate or delayed size changes through the resize listener.'],
  ['pk','a','(III)V','setDesiredSize',['width','height','guard'],'Stores the requested viewport dimensions.'],
]) method(owner,original,descriptor,to,parameters,evidence);
fields('pg',[['a','[Lvl;','lines']],'Ordered text lines retain extents and insertion-point coordinates.');
fields('vl',[['d','I','top'],['a','I','bottom'],['b','[I','insertionX']],'Constructor and text hit-testing distinguish line extents from character insertion coordinates.');
fields('k',[['l','Lwl;','font'],['n','I','leftInset'],['b','I','rightInset'],['f','I','topInset'],['o','I','bottomInset'],
  ['h','I','textColor'],['e','I','shadowColor'],['i','I','selectionColor'],['g','I','caretColor'],
  ['m','I','horizontalAlignment'],['c','I','verticalAlignment'],['k','I','lineSpacing'],['a','Z','wrapText']],
  'Drawing, layout and style-copy bodies establish each font, inset, alignment and color role.');
fields('r',[['C','Lhm;','child']],'Retained single child receives forwarded input, focus, layout and drawing.');
fields('gd',[['T','Lel;','validator']],'Validator accessor, assignment and change hook share this retained source.');
fields('bl',[['m','I','hotspotId'],['i','I','x'],['g','I','y'],['j','I','width'],['n','I','height'],['k','Lbl;','nextFragment']],
  'Hotspot constructor, parser and hit-testing distinguish the owning ID and each line-fragment rectangle.');
fields('d',[['a','Ljava/lang/String;','email'],['b','Z','complete'],['e','Z','available']],'Availability request constructor, completion callback and queries establish independent state.');

// Audio format, synthesis and sample ownership are established by the retained
// decoder bodies and their actual callers in SoundCache and the stream graph.
for (const [owner, original, descriptor, to, parameters, evidence] of [
  ['in','a','([I)Lhh;','decodeToPcm',['budget'],'Decodes packets until completion or the shared byte budget is exhausted, retaining partial output for resumption.'],
  ['in','b','()Lhh;','decodeToPcm',[],'Decodes every packet into signed PCM without a budget and releases the overlap buffer.'],
  ['in','a','([BI)V','setBitstream',['bytes','offset'],'Sets the shared encoded byte array/cursor and resets its LSB-first bit offset.'],
  ['in','a','(Lmf;II)Lin;','load',['archive','groupId','fileId'],'Ensures shared setup is ready, requests missing data and constructs a sample from packed archive bytes.'],
  ['in','a','(Lmf;Ljava/lang/String;Ljava/lang/String;)Lin;','loadNamed',['archive','groupName','fileName'],'Named group/file version of the same setup-aware sample loader; traced through archive group-name and per-group file-name lookups.'],
  ['in','c','()I','readBit',[],'Consumes one least-significant-first bit and advances the byte cursor at the eight-bit boundary.'],
  ['in','d','(I)F','unpackFloat',['packed'],'Expands the Vorbis signed 21-bit mantissa and biased exponent into a float.'],
  ['in','a','(Lmf;)Z','ensureSetup',['archive'],'Loads and decodes archive group zero/file zero once before sample packet decoding.'],
  ['in','b','([B)V','decodeHeader',['bytes'],'Reads sample rate/count, loop endpoints, ping-pong flag and length-prefixed encoded packets.'],
  ['in','a','([B)V','decodeSetup',['bytes'],'Decodes block sizes, transform/bit-reversal tables, codebooks, floors, residues, mappings and modes.'],
  ['in','e','(I)I','readBits',['count'],'Consumes an LSB-first integer across encoded byte boundaries.'],
  ['in','f','(I)[F','decodePacket',['packetIndex'],'Decodes mapping/floor/residue data, inverse transform, windowing and previous-block overlap.'],
  ['fm','a','()[F','decodeVector',[],'Decodes a Huffman scalar and returns its retained lookup vector.'],
  ['fm','a','(II)I','lookup1ValueCount',['entries','dimensions'],'Finds the largest integer whose dimension power does not exceed the entry count.'],
  ['fm','b','()V','buildHuffmanTree',[],'Builds canonical codewords from lengths and a dynamically grown binary decode tree.'],
  ['fm','c','()I','decodeScalar',[],'Walks the retained Huffman tree with shared Vorbis bits to a complemented entry index.'],
  ['u','a','([FI)V','applyCurve',['spectrum','length'],'Predicts/unfolds floor points, sorts active points and multiplies the inverse-decibel floor into spectral bins.'],
  ['u','a','(II)V','sortPoints',['left','right'],'Sorts shared x coordinates while moving their decoded y values and active flags together.'],
  ['u','a','(IIII[FI)V','renderLine',['x0','y0','x1','y1','spectrum','length'],'Rasterizes a floor segment through the inverse-decibel lookup, clipped to spectral length.'],
  ['u','b','([II)I','lowNeighbor',['points','index'],'Finds the closest earlier x coordinate strictly below the selected control point.'],
  ['u','a','([II)I','highNeighbor',['points','index'],'Finds the closest earlier x coordinate strictly above the selected control point.'],
  ['u','a','(IIIII)I','interpolatePoint',['x0','y0','x1','y1','x'],'Integer interpolation between two control points, with the original signed truncation behavior.'],
  ['u','b','()Z','decodeFloor',[],'Consumes the floor-present flag and decodes control point values using class/subclass codebooks.'],
  ['ud','a','([FIZ)V','decode',['spectrum','length','skip'],'Clears the output span and accumulates residue vectors across eight classification passes unless the floor is absent.'],
  ['we','a','(III)I','evaluateWave',['phase','amplitude','form'],'Evaluates square, sine-table, sawtooth or seeded-noise oscillators.'],
  ['we','a','(Ln;)V','decode',['input'],'Reads envelopes, optional modulation/gating, oscillators, echo, timing and filter definitions.'],
  ['we','a','(II)[I','synthesize',['sampleCount','durationMillis'],'Synthesizes oscillators and envelopes, applies gate/echo/filter stages and saturates signed 16-bit samples.'],
  ['cl','a','(Ln;Lwj;)V','decode',['input','envelope'],'Decodes filter pair counts and start/end frequency/attenuation tables and optional interpolation envelope.'],
  ['cl','b','(IIF)F','interpolateFrequency',['section','pair','fraction'],'Interpolates a filter-section pair frequency parameter and converts it to an angular frequency.'],
  ['cl','a','(IF)I','computeCoefficients',['section','fraction'],'Builds feedforward (zero) or feedback (one) coefficients, applies the forward gain and publishes Q16 integer coefficients.'],
  ['cl','a','(F)F','normalizeFrequency',['octaves'],'Converts octave-relative frequency to the angular scale for a 22050 Hz output.'],
  ['cl','a','(IIF)F','interpolateMagnitude',['section','pair','fraction'],'Interpolates a filter-section pair attenuation and converts it from decibels to a filter radius.'],
  ['kj','b','()[B','mixSamples',[],'Mixes delayed instrument outputs into a saturated signed-byte buffer at 22050 Hz.'],
  ['kj','a','(Lmf;Ljava/lang/String;Ljava/lang/String;)Lkj;','loadNamed',['archive','groupName','fileName'],'Loads and decodes a named synthesized sound effect; traced through archive group-name and per-group file-name lookups.'],
  ['kj','a','(Lmf;II)Lkj;','load',['archive','groupId','fileId'],'Loads and decodes a synthesized sound effect by numeric archive IDs.'],
  ['kj','a','()Lhh;','toPcmSample',[],'Wraps mixed bytes and millisecond-scaled loop endpoints in a 22050 Hz PCM sample.'],
  ['ec','a','([IBII)Lhh;','getVorbisSample',['budget','guard','groupId','fileId'],'Caches resumable Vorbis decoders separately from their completed PCM output and consumes the supplied budget.'],
  ['ec','a','(II[II)Lhh;','getSynthesizedSample',['guard','groupId','budget','fileId'],'Loads a synthesized effect, caches its PCM output and charges its byte count to the optional budget.'],
  ['ec','a','(IBI)Lhh;','getVorbisSample',['groupId','guard','fileId'],'Unbudgeted compressed-sample lookup.'],
  ['ec','a','(BII)Lhh;','getSynthesizedSample',['guard','fileId','groupId'],'Unbudgeted synthesized-sample lookup.'],
  ['wb','a','(F)V','setStereoWidth',['width'],'Updates equal-power same/cross-channel wet gains from the retained wet level.'],
  ['wb','b','(F)V','setDampingTimeMicros',['halfLifeMicros'],'Converts a damping half-life in microseconds into the per-sample low-pass update coefficient.'],
  ['wb','c','(F)V','setDryGain',['gain'],'Sets the gain of the unprocessed input added to output.'],
  ['wb','d','(F)V','setFeedback',['feedback'],'Sets the comb-delay feedback coefficient.'],
  ['wb','e','(F)V','setInputGain',['gain'],'Sets the input excitation gain before comb/all-pass processing.'],
  ['wb','f','(F)V','setWetGain',['gain'],'Sets mono wet gain and recalculates the stereo same/cross-channel gains.'],
  ['wb','e','()V','synchronizeChannelMode',[],'Creates or releases right-channel delay arrays when AudioOutput changes stereo mode.'],
  ['wb','a','(I[III)I','scanNegativePeak',['peak','samples','offset','length'],'Scans a bounded wrapped span for the most negative signed magnitude used to choose arithmetic headroom.'],
]) method(owner,original,descriptor,to,parameters,evidence);
fields('in',[['j','[B','bitstream'],['o','I','byteOffset'],['C','I','bitOffset'],['q','I','shortBlockSize'],['m','I','longBlockSize'],
  ['k','[Lfm;','codebooks'],['M','[Lu;','floors'],['N','[Lud;','residues'],['H','[Lpm;','mappings'],
  ['n','Z','setupLoaded'],['t','[Z','longBlockModes'],['w','[I','modeMappings'],['u','[F','transformBuffer'],
  ['E','[F','shortTrigA'],['z','[F','shortTrigB'],['i','[F','shortTrigC'],['p','[I','shortBitReverse'],
  ['I','[F','longTrigA'],['x','[F','longTrigB'],['B','[F','longTrigC'],['D','[I','longBitReverse'],
  ['v','I','sampleRate'],['y','I','sampleCount'],['L','I','loopStart'],['F','I','loopEnd'],['A','Z','pingPongLoop'],
  ['h','[[B','packets'],['s','[F','previousBlock'],['J','I','previousBlockSize'],['r','I','previousTailSamples'],
  ['g','Z','previousSilent'],['K','[B','pcmBytes'],['G','I','outputPosition'],['l','I','packetPosition']],
  'Setup, packet header and incremental PCM bodies distinguish shared decode tables from per-sample packets, overlap and output state.');
fields('fm',[['d','[I','codewordLengths'],['a','[[F','valueVectors'],['f','I','dimensions'],['c','I','entries'],
  ['b','[I','quantizedValues'],['e','[I','huffmanTree']],'Constructor and scalar/vector decoding establish the codebook representation.');
fields('u',[['a','I','multiplier'],['l','[I','rangeTable'],['j','[F','inverseDbTable'],['i','[I','controlPointX'],
  ['e','[I','classMasterbooks'],['d','[I','classDimensions'],['f','[I','subclassBits'],['h','[[I','subclassBooks'],
  ['k','[I','partitionClasses'],['c','[I','workX'],['b','[I','workY'],['g','[Z','workActive']],
  'Floor setup, packet decode, prediction and curve application distinguish immutable setup from shared work arrays.');
fields('ud',[['d','I','type'],['a','I','begin'],['e','I','end'],['f','I','partitionSize'],['c','I','classifications'],
  ['g','I','classbook'],['b','[I','passBooks']],'Residue constructor and eight-pass vector decoder establish bounds and book selection.');
fields('pm',[['a','I','submaps'],['b','I','mux'],['d','[I','submapFloors'],['c','[I','submapResidues']],
  'Mapping setup and packet decoding distinguish the selected floor from each residue submap.');
fields('we',[['u','Lwj;','pitchEnvelope'],['x','Lwj;','volumeEnvelope'],['a','Lwj;','pitchModulation'],
  ['d','Lwj;','pitchModulationAmplitude'],['p','Lwj;','volumeModulation'],['k','Lwj;','volumeModulationAmplitude'],
  ['e','Lwj;','releaseEnvelope'],['r','Lwj;','attackEnvelope'],['q','Lwj;','filterEnvelope'],['n','Lcl;','filter'],
  ['t','[I','oscillatorVolume'],['v','[I','oscillatorPitch'],['i','[I','oscillatorDelay'],['b','I','echoDelayMillis'],
  ['w','I','echoPercent'],['l','I','durationMillis'],['s','I','offsetMillis'],['y','[I','samples'],
  ['m','[I','sineTable'],['h','[I','noiseTable'],['c','[I','oscillatorPhase'],['j','[I','delaySamples'],
  ['g','[I','volumeScale'],['o','[I','pitchScale'],['f','[I','pitchBase']],
  'Instrument decode, modulation loops, gate, echo and filter stages establish envelope and oscillator scratch roles.');
fields('cl',[['a','[[[I','frequencies'],['h','[[[I','attenuations'],['d','[I','unity'],['g','[I','pairs'],
  ['f','F','forwardGain'],['c','I','forwardMultiplierQ16'],['b','[[I','coefficientsQ16'],['e','[[F','coefficients']],
  'Filter decoding and coefficient recurrence distinguish frequency/attenuation endpoints and floating/Q16 output.');
fields('kj',[['a','[Lwe;','instruments'],['c','I','loopStartMillis'],['b','I','loopEndMillis']],
  'Sound effect decode/mix and PCM construction distinguish instrument offsets from loop endpoints.');
fields('ec',[['d','Lmf;','synthesizedArchive'],['e','Lmf;','vorbisArchive'],['b','Lib;','pendingVorbis'],['g','Lib;','pcmCache']],
  'Constructor and both sample loading paths retain separate sources, pending compressed decoders and completed PCM results.');
fields('wb',[['r','Lwg;','inputStream'],['s','[Lnc;','leftCombs'],['y','[Lnc;','rightCombs'],
  ['l','[Llc;','leftAllPasses'],['v','[Llc;','rightAllPasses'],['t','[I','inputBuffer'],
  ['u','F','stereoWidth'],['n','F','wetGain'],['w','F','sameChannelGain'],['q','F','crossChannelGain'],
  ['m','F','dampingTimeMicros'],['p','F','dampingStep'],['k','F','feedback'],['o','F','dryGain'],['x','F','inputGain']],
  'Reverb mixing and setters establish separate channel delay networks, damping and wet/dry/excitation gains.');

for (const [owner, original, descriptor, to, parameters, evidence] of [
  ['hl','a','(II)I','rightGain',['volumeQ6','panQ14'],'Equal-power right gain, preserving the negative-pan phase-inversion convention.'],
  ['hl','d','(II)I','leftGain',['volumeQ6','panQ14'],'Equal-power left gain, preserving the negative-pan convention.'],
  ['hl','a','(III)V','rampVolumeAndPanQ6',['duration','volumeQ6','panQ14'],'Starts a bounded gain ramp with independent mono/left/right increments.'],
  ['hl','b','(III)V','rampVolumeAndPan',['duration','volume','panQ8'],'Scales volume and pan by six bits before starting a gain ramp.'],
  ['hl','c','(II)V','rampVolumeQ6',['duration','volumeQ6'],'Ramps raw gain while retaining the current pan.'],
  ['hl','e','(II)V','rampVolume',['duration','volume'],'Scales volume by six bits before ramping while retaining pan.'],
  ['hl','a','(Lhh;II)Lhl;','createAtRatePercent',['sample','ratePercent','volume'],'Computes a Q8 playback step from sample/output rates and scales volume by six bits.'],
  ['hl','c','(Lhh;III)Lhl;','createAtRatePercentQ6',['sample','ratePercent','volumeQ6','panQ14'],'Computes the percentage-rate step while retaining explicit raw gain and pan.'],
  ['hl','a','(Lhh;III)Lhl;','createAtStepQ8',['sample','stepQ8','volumeQ6','panQ14'],'Creates a stream with explicit Q8 playback step, raw gain and pan.'],
  ['hl','b','(Lhh;III)Lhl;','createAtStepScaled',['sample','stepQ8','volume','panQ8'],'Creates a stream after scaling volume and pan by six bits.'],
  ['hl','a','(Z)V','setPingPongLoop',['enabled'],'Assigns whether loop boundaries reverse playback direction.'],
  ['hl','b','(II)V','setLoopRange',['start','end'],'Assigns loop endpoints in sample indices.'],
  ['hl','h','(I)V','setLoopCount',['count'],'Assigns finite repeats or the negative infinite-loop sentinel.'],
  ['hl','e','()V','playBackwardFromEnd',[],'Makes the playback step nonpositive and positions at the final sample boundary.'],
  ['hl','e','(I)V','setPosition',['sampleIndex'],'Converts a sample index to Q8 and clamps it to the before-start/end sentinels.'],
  ['hl','f','()I','panQ14',[],'Returns retained pan, normalizing negative phase-inversion values to minus one.'],
  ['hl','f','(I)V','setVolumeQ6',['volumeQ6'],'Sets raw gain immediately while retaining current pan.'],
  ['hl','j','(I)V','setVolume',['volume'],'Scales volume by six bits then assigns gain immediately.'],
  ['hl','f','(II)V','setVolumeAndPanQ6',['volumeQ6','panQ14'],'Assigns target gain/pan, cancels the ramp and recomputes channel gains.'],
  ['hl','i','(I)V','setSpeed',['stepQ8'],'Changes playback speed while retaining the current forward/reverse direction.'],
  ['hl','g','(I)V','fadeOut',['duration'],'Ramps all gains to zero and unlinks the stream after reaching the stop sentinel.'],
  ['hl','g','()V','refreshGains',[],'Copies target mono gain and computes current left/right gains from pan.'],
  ['hl','h','()V','cancelRamp',[],'Clears a pending ramp, normalizes the stop sentinel and refreshes immediate gains.'],
  ['hl','i','()Z','adjustRampOrStop',[],'Finishes a gain ramp or schedules unit corrections; the zero stop target unlinks the stream.'],
  ['hl','a','([IIIII)I','mixForward',['output','offset','boundaryQ8','limit','boundarySample'],'Dispatches forward aligned/interpolated mono/stereo kernels with optional gain ramp.'],
  ['hl','b','([IIIII)I','mixReverse',['output','offset','boundaryQ8','limit','boundarySample'],'Dispatches reverse aligned/interpolated mono/stereo kernels with optional gain ramp.'],
  ['ie','a','(I)V','skipSamples',['length'],'Advances the root stream and decreases/clamps the scheduler countdown.'],
  ['ie','a','(IZI)V','configure',['newSampleRate','newStereo','newThreadPriority'],'Validates the shared sample rate and stores channel mode and service-thread priority. Parameter names keep unqualified static field assignments unambiguous.'],
  ['ie','a','(Llk;Ljava/awt/Component;II)Lie;','create',['tasks','component','slot','bufferedSamples'],'Creates a Java Sound device and registers one of two service slots, retaining the original silent-device fallback.'],
  ['ie','a','(Lwg;)V','deactivateTree',['stream'],'Recursively clears stream activity and sample scheduling positions before prioritization.'],
  ['ie','a','(Lwg;I)V','enqueueByPriority',['stream','priority'],'Appends a stream to one of eight scheduler buckets and retains its exact priority.'],
  ['ie','a','([II)V','mixBlock',['samples','length'],'Clears output, schedules the active stream tree, mixes the root and records the latest mix time.'],
  ['ie','b','()V','flush',[],'Marks the device reset and flushes, retaining delayed reopen after a device exception.'],
  ['ie','b','(Lwg;)V','setStream',['stream'],'Assigns the root PCM stream serviced by this output.'],
  ['ie','c','()V','shutdown',[],'Removes its service slot, stops an unused shared service, closes the device and releases the mix buffer.'],
  ['ie','d','()V','serviceOutput',[],'Catches up stream time, reopens failed devices, mixes/writes blocks and adjusts buffered latency.'],
]) method(owner,original,descriptor,to,parameters,evidence);
for (const [original,descriptor,to] of [
  ['a','(II[B[IIIIIIIIIILhl;II)I','mixForwardInterpolatedStereoRamp'],
  ['a','(II[B[IIIIIIIILhl;II)I','mixReverseInterpolatedStereo'],
  ['a','(II[B[IIIIIIILhl;II)I','mixForwardInterpolatedMono'],
  ['a','(I[B[IIIIIIIIIILhl;)I','mixReverseStereoRamp'],
  ['a','(I[B[IIIIIIIILhl;)I','mixReverseStereo'],
  ['a','([B[IIIIIIIILhl;)I','mixReverseMonoRamp'],
  ['a','([B[IIIIIIILhl;)I','mixForwardMono'],
  ['b','(II[B[IIIIIIIIIILhl;II)I','mixReverseInterpolatedStereoRamp'],
  ['b','(II[B[IIIIIIIILhl;II)I','mixForwardInterpolatedMonoRamp'],
  ['b','(II[B[IIIIIIILhl;II)I','mixReverseInterpolatedMono'],
  ['b','(I[B[IIIIIIIIIILhl;)I','mixForwardStereoRamp'],
  ['b','(I[B[IIIIIIIILhl;)I','mixForwardStereo'],
  ['b','([B[IIIIIIIILhl;)I','mixForwardMonoRamp'],
  ['b','([B[IIIIIIILhl;)I','mixReverseMono'],
  ['c','(II[B[IIIIIIIILhl;II)I','mixReverseInterpolatedMonoRamp'],
  ['d','(II[B[IIIIIIIILhl;II)I','mixForwardInterpolatedStereo'],
]) method('hl',original,descriptor,to,[],
  'Reviewed sample-index direction and adjacent-byte interpolation, output channel stride, gain increments and retained stream writeback identify this specialized mixing kernel.');
fields('hl',[['u','I','positionQ8'],['y','I','stepQ8'],['q','I','loopStart'],['l','I','loopEnd'],['w','Z','pingPongLoop'],
  ['r','I','loopCount'],['o','I','targetVolumeQ6'],['n','I','panQ14'],['m','I','volumeQ6'],['x','I','leftVolumeQ6'],
  ['s','I','rightVolumeQ6'],['v','I','rampSamples'],['k','I','volumeStep'],['t','I','leftVolumeStep'],['p','I','rightVolumeStep']],
  'Sample-stream constructors, boundary handling, equal-power pan and gain-ramp dispatch establish playback and channel state.');
fields('ie',[['q','I','sampleRate'],['o','Z','stereo'],['g','I','threadPriority'],['j','Lge;','service'],
  ['f','[I','mixBuffer'],['u','Lwg;','rootStream'],['a','I','activityLimit'],['b','I','schedulerCountdown'],
  ['c','[Lwg;','priorityHeads'],['l','[Lwg;','priorityTails'],['i','Z','closed'],['e','Z','deviceRecentlyReset'],
  ['s','J','lastMixTimeMillis'],['t','J','nextAdjustmentMillis'],['n','J','reopenAtMillis'],['d','I','capacity'],
  ['p','I','desiredBufferedSamples'],['m','I','latencyCorrection'],['k','I','lastBufferedSamples'],
  ['r','I','maxBufferDrain'],['h','I','previousBufferDrain']],
  'Output creation, stream prioritization and device service distinguish shared audio format from per-output buffers, deadlines and latency estimates.');
fields('vm',[['z','Z','reopenOnFlush'],['v','I','deviceCapacity'],['y','Ljavax/sound/sampled/AudioFormat;','audioFormat'],
  ['w','[B','deviceBytes'],['x','Ljavax/sound/sampled/SourceDataLine;','line'],['A','Ljava/lang/String;','affectedMixerName']],
  'Java Sound setup, write, close and flush establish device state and the retained mixer workaround.');
fields('ge',[['g','Z','running'],['c','Z','stopRequested'],['f','[Lie;','outputs'],['e','Llk;','tasks']],
  'Audio service run/shutdown protocol retains two output slots and explicit running/stop flags.');

// Reviewed cleanup bodies release shared static references. This is an explicit
// declaration inventory, never a pattern fallback for unresolved methods. Guard
// side effects, conditional early returns and original call targets are retained.
for (const [owner, original, descriptor] of [
  ['EscapeVector','l','(B)V'],
  ['aa','b','(B)V'],
  ['ac','c','(I)V'],
  ['ad','b','(I)V'],
  ['ae','a','(I)V'],
  ['af','a','(B)V'],
  ['ag','a','(I)V'],
  ['ah','f','(I)V'],
  ['aj','a','(I)V'],
  ['ak','c','(B)V'],
  ['al','a','(I)V'],
  ['am','a','(B)V'],
  ['an','a','(I)V'],
  ['b','a','(B)V'],
  ['bb','h','(B)V'],
  ['bc','a','(I)V'],
  ['bd','d','(I)V'],
  ['be','a','(B)V'],
  ['bf','l','(I)V'],
  ['bg','a','(I)V'],
  ['bh','d','(I)V'],
  ['bi','c','()V'],
  ['bj','g','(B)V'],
  ['bk','h','(I)V'],
  ['bl','d','(I)V'],
  ['bm','a','(B)V'],
  ['bn','a','(Z)V'],
  ['bo','a','(B)V'],
  ['ca','a','(B)V'],
  ['cb','a','(I)V'],
  ['cc','d','(I)V'],
  ['cd','f','(I)V'],
  ['ce','b','(I)V'],
  ['cf','a','(I)V'],
  ['cg','f','(I)V'],
  ['ch','a','(I)V'],
  ['ci','b','(I)V'],
  ['cj','a','(I)V'],
  ['ck','a','(B)V'],
  ['cl','a','()V'],
  ['cn','b','(Z)V'],
  ['co','a','(B)V'],
  ['d','a','(B)V'],
  ['da','a','(I)V'],
  ['dc','a','(Z)V'],
  ['de','a','(Z)V'],
  ['dg','g','(I)V'],
  ['dh','a','(B)V'],
  ['di','b','(I)V'],
  ['dj','a','(B)V'],
  ['dk','g','(I)V'],
  ['dl','b','(B)V'],
  ['dn','h','(I)V'],
  ['e','b','(I)V'],
  ['ea','b','(B)V'],
  ['eb','a','(Z)V'],
  ['ec','a','(B)V'],
  ['ee','a','(Z)V'],
  ['ef','a','(I)V'],
  ['eg','a','(I)V'],
  ['eh','d','(B)V'],
  ['ei','e','(I)V'],
  ['ej','a','(I)V'],
  ['ek','a','(I)V'],
  ['em','a','()V'],
  ['en','a','(I)V'],
  ['eo','b','(B)V'],
  ['f','a','(B)V'],
  ['fa','a','(Z)V'],
  ['fd','a','(B)V'],
  ['ff','a','(I)V'],
  ['fg','a','(B)V'],
  ['fh','a','(B)V'],
  ['fi','b','(I)V'],
  ['fj','n','(I)V'],
  ['fk','a','(I)V'],
  ['fl','a','(B)V'],
  ['fn','a','(I)V'],
  ['g','i','(B)V'],
  ['ga','a','(I)V'],
  ['gb','b','(I)V'],
  ['gd','i','(B)V'],
  ['ge','b','(B)V'],
  ['gf','b','(I)V'],
  ['gi','c','(I)V'],
  ['gj','b','(I)V'],
  ['gk','a','(B)V'],
  ['gl','b','(Z)V'],
  ['gm','a','(I)V'],
  ['gn','b','(Z)V'],
  ['h','k','(I)V'],
  ['ha','a','(B)V'],
  ['hb','a','(Z)V'],
  ['hc','j','(I)V'],
  ['hd','a','(I)V'],
  ['he','a','(Z)V'],
  ['hg','c','(I)V'],
  ['hi','g','(I)V'],
  ['hk','c','(B)V'],
  ['hn','a','(B)V'],
  ['i','a','()V'],
  ['ia','a','(Z)V'],
  ['ic','a','(Z)V'],
  ['id','b','(I)V'],
  ['ie','e','()V'],
  ['ig','h','(I)V'],
  ['ii','a','(I)V'],
  ['ij','d','(I)V'],
  ['ik','d','(I)V'],
  ['in','a','()V'],
  ['j','a','(I)V'],
  ['ja','a','(I)V'],
  ['jb','c','(Z)V'],
  ['jc','b','(I)V'],
  ['jd','b','(B)V'],
  ['je','a','(I)V'],
  ['jf','j','(I)V'],
  ['jg','a','(Z)V'],
  ['jh','a','(Z)V'],
  ['ji','a','(I)V'],
  ['jj','b','(I)V'],
  ['jl','a','(I)V'],
  ['jm','a','(B)V'],
  ['k','b','(I)V'],
  ['ka','a','(B)V'],
  ['kb','a','(Z)V'],
  ['kc','a','(I)V'],
  ['ke','a','(I)V'],
  ['kf','c','(B)V'],
  ['kg','f','(I)V'],
  ['kh','a','(B)V'],
  ['ki','l','(I)V'],
  ['kk','b','(I)V'],
  ['kl','g','(I)V'],
  ['km','c','(I)V'],
  ['kn','c','(Z)V'],
  ['lb','g','(I)V'],
  ['ld','b','(B)V'],
  ['le','a','(I)V'],
  ['lf','a','(B)V'],
  ['lh','a','(B)V'],
  ['li','a','(I)V'],
  ['ll','a','(B)V'],
  ['lm','b','(B)V'],
  ['m','e','(I)V'],
  ['ma','b','(I)V'],
  ['mb','a','(I)V'],
  ['mc','a','(I)V'],
  ['md','l','(I)V'],
  ['me','k','(I)V'],
  ['mf','c','(I)V'],
  ['mg','a','(Z)V'],
  ['mh','a','(Z)V'],
  ['mi','a','(B)V'],
  ['mj','a','(Z)V'],
  ['ml','a','(I)V'],
  ['mm','b','(I)V'],
  ['mn','a','(B)V'],
  ['n','a','(B)V'],
  ['na','d','(I)V'],
  ['nb','a','(I)V'],
  ['nf','f','(I)V'],
  ['ng','j','(B)V'],
  ['ni','l','(I)V'],
  ['nk','g','(I)V'],
  ['nl','a','(I)V'],
  ['nm','a','(Z)V'],
  ['nn','b','(B)V'],
  ['o','d','()V'],
  ['oc','h','(I)V'],
  ['od','d','(I)V'],
  ['oe','f','(B)V'],
  ['of','a','(I)V'],
  ['oh','a','(B)V'],
  ['oi','h','(B)V'],
  ['oj','e','(B)V'],
  ['ok','a','(Z)V'],
  ['ol','g','(I)V'],
  ['om','a','(I)V'],
  ['on','a','(I)V'],
  ['p','b','(I)V'],
  ['pa','a','(B)V'],
  ['pb','a','(Z)V'],
  ['pc','a','(Z)V'],
  ['pf','a','(I)V'],
  ['pg','b','(I)V'],
  ['ph','a','(B)V'],
  ['pi','a','(B)V'],
  ['pj','b','(B)V'],
  ['pk','b','(Z)V'],
  ['pl','c','(I)V'],
  ['pn','q','(I)V'],
  ['q','a','(B)V'],
  ['qa','e','(B)V'],
  ['qc','t','(I)V'],
  ['qd','b','(Z)V'],
  ['qe','b','(I)V'],
  ['qf','b','(I)V'],
  ['qh','a','(I)V'],
  ['qi','j','(I)V'],
  ['qj','b','(I)V'],
  ['qk','a','(B)V'],
  ['qm','a','(B)V'],
  ['r','a','(B)V'],
  ['rb','a','(B)V'],
  ['rc','a','(I)V'],
  ['rd','a','(I)V'],
  ['re','c','(I)V'],
  ['rg','b','(B)V'],
  ['rh','j','(I)V'],
  ['ri','b','(I)V'],
  ['rk','a','(I)V'],
  ['rl','d','(I)V'],
  ['rm','a','(Z)V'],
  ['rn','a','(Z)V'],
  ['s','d','(B)V'],
  ['sa','a','(Z)V'],
  ['sb','e','(I)V'],
  ['sc','a','(B)V'],
  ['se','a','(B)V'],
  ['sf','a','(Z)V'],
  ['sh','f','(I)V'],
  ['si','f','(I)V'],
  ['sj','a','(B)V'],
  ['sk','b','(Z)V'],
  ['sl','a','(I)V'],
  ['sm','b','(Z)V'],
  ['sn','a','(B)V'],
  ['t','b','(B)V'],
  ['ta','f','(I)V'],
  ['tb','o','(I)V'],
  ['tc','e','(I)V'],
  ['td','a','(I)V'],
  ['tf','a','(I)V'],
  ['tg','h','(I)V'],
  ['th','a','(I)V'],
  ['ti','a','(B)V'],
  ['tj','a','(Z)V'],
  ['tk','b','(I)V'],
  ['tl','a','(B)V'],
  ['tm','n','(I)V'],
  ['u','a','()V'],
  ['ua','a','(I)V'],
  ['uc','a','(B)V'],
  ['uf','b','(I)V'],
  ['ug','a','(Z)V'],
  ['ui','a','(Z)V'],
  ['uj','a','(B)V'],
  ['uk','a','(I)V'],
  ['ul','f','(B)V'],
  ['um','a','(Z)V'],
  ['un','a','(B)V'],
  ['v','a','(B)V'],
  ['vb','b','(B)V'],
  ['vc','a','(I)V'],
  ['vd','c','(B)V'],
  ['ve','a','(I)V'],
  ['vg','i','(B)V'],
  ['vi','a','(I)V'],
  ['vj','a','(I)V'],
  ['vk','g','(I)V'],
  ['vl','a','(I)V'],
  ['vn','a','(B)V'],
  ['w','n','(I)V'],
  ['wa','a','(Z)V'],
  ['wc','a','(B)V'],
  ['wd','d','(I)V'],
  ['we','a','()V'],
  ['wf','a','(Z)V'],
  ['wh','a','(Z)V'],
  ['wi','a','(I)V'],
  ['wk','a','(Z)V'],
  ['wl','a','()V'],
]) {
  if (members[`M:${owner}.${original}${descriptor}`]) throw new Error("Duplicate reviewed cleanup");
  method(owner,original,descriptor,'releaseStatics',descriptor==='()V'?[]:['guard'],
    'Reviewed full body clears retained shared static references; guard branches/arithmetic and instance ownership remain unchanged.');
}

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

// Complete the session from bodies and callers, rather than assigning roles
// from obfuscated spelling. Collision predicates with destructive side effects
// deliberately say hit; bullet recycling is distinct from allocation/spawning.
fields('oe', [
  ['O','I','bulletCapacity'],['x','I','activeBulletCount'],['nb','Lhg;','lastActiveBullet'],
  ['E','I','tetheredYQ16'],['Ob','I','tetheredVelocityXQ16'],['o','I','tetheredVelocityYQ16'],
  ['rc','Z','scoringEnabled'],['ec','Z','cargoLost'],['Ib','Z','levelEnded'],
  ['Jb','Z','quitRequested'],['Cb','Z','advanceLevelRequested'],['c','I','transitionTicks'],
  ['Hb','I','collisionNormalX'],['pb','I','collisionNormalY'],['q','Z','fatalHullContact'],
  ['kc','Z','rightLandingContact'],['jc','Z','leftLandingContact'],['oc','I','laserCycleTicks'],
  ['Db','Lod;','selfDestructEffects'],['Y','Lce;','currentMusic'],['sc','I','currentMusicVolume'],
  ['i','Led;','noticeSprite'],['Qb','I','noticeTicks'],['y','I','tutorialStep'],['dc','I','displayedTutorialStep'],
  ['zb','Z','showingAchievementNotice'],['Lb','[I','pendingAchievementIds'],['z','I','pendingAchievementCount'],
  ['g','[I','displayedAchievementIds'],['d','I','displayedAchievementCount'],['sb','I','activeSessionTicks'],
  ['pc','I','tutorialBackgroundPhase'],['j','I','levelTitleTicks'],
  ['bc','I','destructionAchievementCount'],['w','I','previousLevelDestructionCount'],
  ['u','I','collectedPowerupCount'],['ic','I','previousLevelPowerupCount'],
], 'Reviewed assignments and consumers in reset, update, collision, rendering, end-of-level reporting and menu actions. Destruction counts increment on object/seeker/gate destruction, not on time passing; levelEnded also covers an unsuccessful exit.');
fields('vh', [['j','I','xQ16'],['l','I','yQ16'],['n','I','velocityXQ16'],['g','I','velocityYQ16'],
  ['m','I','remainingTicks'],['h','Z','inactive'],['k','I','kind'],['i','I','collisionLaserCount']],
  'Constructor/reset assign projectile state; the session integrates Q16 position, decrements lifetime and marks collisions inactive. The static count belongs to the shared nearby-laser scratch list.');
fields('uk', [['e','Lga;','cameraOrigin'],['k','Lga;','nose'],['d','Lga;','centerNotch'],
  ['g','Lga;','leftWing'],['c','Lga;','rightWing'],['f','Lga;','boundsMin'],['i','Lga;','boundsMax']],
  'Hull rendering constructs the rotated triangle/notch in Q11 and its raster bounds, then classifies left/right pixels; at angle zero the wings lie eight pixels left/right of center.');

for (const [name, descriptor, to, parameters, evidence] of [
  ['a','(IZIIBIII)V','reset',['xQ16','inactive','velocityXQ16','velocityYQ16','guard','kind','yQ16','remainingTicks'],'Assigns every retained projectile state field, including the inactive flag.'],
  ['d','(I)V','deactivate',['guard'],'Resets position, velocity, kind and lifetime to zero and marks the projectile inactive before moving it to the pool tail.'],
  ['a','(IZI)V','draw',['cameraX','guard','cameraY'],'Draws a wrapped three-by-three glow with colors selected by kind and faded during the last 64 ticks.'],
  ['a','(Lia;IIZI)V','bucketMeshFacesByDepth',['mesh','nearDepth','farDepth','cullBackfaces','guard'],'Uses triangle vertex indices, projected cross products, depth sums and material groups to populate depth buckets; does not draw the faces.'],
  ['a','(Ljava/lang/String;Lmf;Ljava/lang/String;I)Ljava/lang/String;','formatArchiveProgress',['fallback','archive','label','guard'],'Returns fallback until the archive index is ready, then formats its progress percentage.'],
  ['f','(I)I','accountStateIndex',['guard'],'Distinguishes the logged-in predicate, the positive account-state value and the remaining state without assigning unproven meanings to codes one/two.'],
  ['a','(B)V','removeFirstDialogue',['guard'],'Removes the first queued dialogue if present.'],
]) method('vh',name,descriptor,to,parameters,evidence);
method('vh','<init>','(IIIIII)V',null,['xQ16','yQ16','velocityXQ16','velocityYQ16','kind','remainingTicks'],
  'Delegates to reset with inactive false and preserves the argument order.');

for (const [name, descriptor, to, parameters] of [
  ['A','(B)V','scanShipHullContacts',[]],['A','(I)V','resolveShieldImpact',[]],
  ['a','(BII)Z','hitShipAtPoint',['guard','y','x']],['d','(III)Z','pointInsideShield',['x','guard','y']],
  ['a','(IIIIII)Z','isTerrainRayClear',['count','stepYQ16','yQ16','xQ16','stepXQ16','guard']],
  ['a','(IIIII)V','collectCollisionLaserSpans',['guard','bottomY','topY','leftX','rightX']],
  ['a','(Lhg;IIZI)Lhg;','appendCollisionLaserSpan',['last','rightX','leftX','guard','y']],
  ['a','(IIIIIIIIIIIIII)V','scanShipHullTileRows',[]],['a','(IIIIIIIIIIIIIII)V','scanShipHullTile',[]],
  ['a','(IIIIIIBII)V','scanShieldContactTile',[]],['a','(IIIIIZII)V','scanShieldTileRows',[]],
  ['v','(B)V','scanShieldTerrainContacts',[]],
  ['a','(Led;IIB)V','accumulateShieldSpriteContacts',['sprite','y','x','guard']],
  ['a','(ZIILed;)Z','spriteOverlapsShipHull',['guard','y','x','sprite']],
  ['b','(ILed;II)Z','spriteOverlapsTerrainOrLasers',['x','sprite','y','lastColumnAdjustment']],
  ['a','(Led;IIIIIII)Z','spriteOverlapsTerrainColumns',[]],['a','(ILed;IIIIIIII)Z','spriteOverlapsTerrainTile',[]],
  ['a','([IIBI)Z','maskPixelIsSolid',['rows','bitX','guard','rowY']],
  ['a','(III)[I','terrainTile',['tileY','guard','tileX']],['a','(IBI)[I','initialTerrainTile',['tileX','guard','tileY']],
  ['a','(ILed;II)V','renderShipHull',['cameraY','targetSprite','color','cameraX']],
  ['a','(I[IBIILuk;)V','rasterizeShipHull',['leftColor','pixels','guard','stride','rightColor','geometry']],
  ['a','(Luk;BII)I','classifyShipPixel',['geometry','guard','pixelY','pixelX']],
]) method('oe',name,descriptor,to,parameters,
  'Reviewed hull/shield triangle-circle geometry, wrapped sprite and terrain masks, nearby laser scratch spans, and their update/render callers. hitShipAtPoint destroys on contact; pure overlap tests do not. Shared full masks remain identity sentinels.');

for (const [name, descriptor, to, parameters] of [
  ['a','(IIB)V','drawTerrainBase',['cameraY','cameraX','guard']],['c','(IIIIIIII)V','drawTerrainBaseColumn',[]],
  ['b','(IIIIIIII)I','drawTerrainBaseTile',[]],['e','(III)V','drawTerrainEdges',['cameraY','guard','cameraX']],
  ['a','(IIIIIIII)V','drawTerrainEdgeColumn',[]],['a','(IIIZIIII[I)I','drawTerrainEdgeTile',[]],
  ['a','(ZZILed;II)V','tileParallaxLayer',['repeatVertically','fillBottom','guard','sprite','y','x']],
  ['i','(III)V','drawParallaxBackground',['guard','cameraX','cameraY']],
  ['g','(III)V','drawTutorialCavernBackground',['cameraY','guard','cameraX']],
  ['b','(IIB)V','drawTutorialForeground',['cameraX','cameraY','guard']],
  ['c','(III)V','drawThemeBottomBackground',['x','y','guard']],
  ['h','(III)V','drawLevelObjects',['guard','cameraX','cameraY']],
  ['f','(III)V','drawSeekerMines',['cameraX','cameraY','guard']],
  ['b','(III)V','drawBullets',['cameraX','cameraY','firstIndex']],
  ['b','(IBI)V','drawLaserGates',['cameraX','guard','cameraY']],
  ['o','(B)V','drawShieldGlow',['guard']],['a','(B)V','drawGameOverOverlay',['guard']],
  ['h','(II)V','drawLevelTitle',['guard','cameraY']],['y','(I)V','drawNotice',['guard']],['q','(I)V','drawHudPanels',['guard']],
]) method('oe',name,descriptor,to,parameters,
  'Reviewed renderSession call order and drawing bodies: base texture and mutable terrain edges, parallax/tutorial layers, placed objects, seekers, bullets, laser gates, hull/shield, notices and HUD. Title and tutorial/achievement notice sprites have separate timing.');

for (const [name, descriptor, to, parameters] of [
  ['a','(II)I','blueComponent',['guard','packed']],['b','(II)I','greenComponent',['packed','guard']],
  ['d','(II)I','redComponent',['packed','guard']],['a','(IIZI)I','packRgb',['blue','red','guard','green']],
  ['a','(BIII)I','countdownColor',['guard','period','normalColor','expiredColor']],
  ['g','(Z)Ljava/lang/String;','formatSessionTime',['guard']],['c','(Z)I','musicThemeIndex',['guard']],
  ['w','(B)Lce;','selectMusic',['guard']],['s','(I)I','selectMusicVolume',['guard']],['t','(B)Z','shouldLoopMusic',['guard']],
  ['e','(ZI)V','updateMusic',['force','guard']],['z','(I)V','updateMusicFade',['guard']],
  ['a','(ILhl;)V','silenceSampleStream',['guard','stream']],['a','(I)V','detachSessionAudio',['guard']],
  ['a','(IZ)V','resetSessionEffects',['guard','option']],
  ['b','(IIII)I','spatialVolume',['radiusQ16','xQ16','guard','yQ16']],['c','(II)I','spatialPan',['xQ16','guard']],
]) method('oe',name,descriptor,to,parameters,
  'Reviewed byte-channel packing/interpolation, 50-tick clock, wrapped distance/pan attenuation and session-owned music/sample lifecycles. Countdown music overrides theme music; detaching from the mixer differs from stopping stream gain.');

for (const [name, descriptor, to, parameters] of [
  ['b','(IIIIII)V','spawnBullet',['yQ16','xQ16','velocityYQ16','guard','kind','velocityXQ16']],
  ['F','(I)V','recycleInactiveBullets',['guard']],['a','(Z)V','updatePickupAnimation',['guard']],
  ['k','(II)V','applyPowerup',['guard','objectType']],['c','(IB)V','applyShieldPickup',['objectType','guard']],
  ['b','(IB)V','applyTriShotPickup',['objectType','guard']],['b','(ZI)V','applyEngineBoostPickup',['guard','objectType']],
  ['g','(II)V','applyRockBusterPickup',['guard','objectType']],['d','(ZI)Ljava/lang/String;','rockBusterPickupMessage',['guard','count']],
  ['a','(IB)V','showTntPickupMessage',['objectType','guard']],['k','(B)V','destroyTetheredObject',['guard']],
  ['b','(I)V','markCargoLost',['objectiveType']],['k','(III)Z','hitTetheredObjectAtPoint',['guard','x','y']],
  ['j','(III)V','destroyLevelObjectAtPoint',['guard','y','x']],['d','(Z)V','updatePointCloudEffects',['guard']],
  ['f','(I)V','removeFinishedTargetEffect',['guard']],['a','(Lsa;B)Loc;','spawnObjectDebris',['object','guard']],
  ['a','(IILed;ILhh;)V','spawnSpriteDebris',['x','guard','sprite','y','sound']],
  ['a','(IILhh;I)V','spawnExplosion',['guard','y','sound','x']],['i','(II)Loc;','createExhaustCloud',['count','guard']],
]) method('oe',name,descriptor,to,parameters,
  'Reviewed projectile active-prefix reuse/recycling and pickup, tether, debris and target-effect callers. Type-five text explicitly says TNT; types nine through thirteen route to shield, tri-shot, engine and rock-buster handlers.');

for (const [name, descriptor, to, parameters] of [
  ['w','(I)V','updateMissionOutcome',['objectiveType']],['b','(BII)V','submitCampaignScore',['guard','score','levelIndex']],
  ['b','(BI)V','recordLevelResult',['guard','outcome']],['f','(Z)V','updateCampaignBestScore',['guard']],
  ['t','(I)V','recordLevelCompletion',['guard']],['o','(I)V','checkCampaignAchievements',['guard']],
  ['u','(B)V','checkSimulatorCampaignAchievement',['guard']],['v','(I)V','checkRetributionCampaignAchievement',['guard']],
  ['q','(B)V','recordDestructionForAchievement',['guard']],['x','(I)V','saveLevelProgress',['guard']],
  ['x','(B)V','finishPendingBonuses',['guard']],['a','(IZII)V','awardAchievement',['gameMode','guard','achievementId','checksum']],
  ['p','(B)V','updateNotices',['guard']],['g','(I)I','flatLevelIndex',['guard']],['m','(B)I','missionDialogueTier',['guard']],
  ['n','(B)Z','areTerrainAssetsReady',['guard']],['r','(I)Ljava/lang/String;','terrainLoadingMessage',['guard']],
  ['r','(B)Z','repeatSkyLayerVertically',['guard']],['h','(Z)V','showObjectiveMessage',['guard']],
  ['j','(I)V','replayMissionBriefing',['guard']],['e','(B)V','queueRetrievalBriefing',['guard']],
  ['l','(I)V','queueRetributionBriefing',['guard']],['m','(I)V','queueRetrievalChapterIntro',['guard']],
  ['C','(I)V','queueRetributionChapterIntro',['guard']],['E','(I)V','queueCampaignConclusion',['guard']],
  ['p','(I)V','leaveSession',['guard']],['c','(B)V','resetSessionMenuState',['guard']],['c','(ZI)V','openSessionScreen',['option','guard']],
  ['d','(B)Z','isRockBusterKeyDown',['guard']],['a','(BI)V','initializeSessionOption',['guard','option']],
  ['d','(I)V','sessionGuardNoOp',['guard']],['u','(I)V','objectiveTypeReadHook',['guard']],
  ['j','(II)V','initialPowerupReadHook',['objectType','guard']],
  ['a','(ILjava/lang/String;)V','showHudMessage',['guard','text']],
]) method('oe',name,descriptor,to,parameters,
  'Reviewed mission/end-state branches, progress writers, destruction and completion achievement call sites, tutorial notice batching, dialogue chapter selection, session-menu callers and reader guard hooks. Guard-only hooks keep their arithmetic/invalid-guard side effects. showHudMessage queues the standard 100-tick duration.');

// Archive and packet contracts follow the actual byte order and retention
// behavior, including sparse file IDs and different named-lookup argument order.
fields('mf', [['i','Lob;','provider'],['c','Z','discardPackedGroups'],['h','I','fileRetentionPolicy'],
  ['e','[[Ljava/lang/Object;','unpackedFiles'],['g','Lf;','index'],['j','[Ljava/lang/Object;','packedGroups']],
  'Index initialization allocates packed/unpacked slots; group unpacking conditionally discards packed data. File policy zero retains files, one discards the returned slot and two builds only the requested file then discards its file group.');
fields('f', [['d','[I','groupIds'],['h','[[B','groupDigests'],['c','I','groupCount'],['r','[[I','fileNameHashes'],
  ['i','[I','groupFileCounts'],['l','[I','groupCrc32s'],['k','I','groupCapacity'],['e','[I','groupFileCapacities'],
  ['g','[I','groupNameHashes'],['p','Ljn;','groupNameLookup'],['n','I','revision'],['b','I','encodedCrc32'],
  ['s','[Ljn;','fileNameLookups'],['q','[I','groupVersions'],['a','[[I','fileIds'],['f','[B','encodedDigest']],
  'Version-five through seven index decoder distinguishes declared group/file counts from maximum-ID slot capacities, delta-coded sparse IDs, optional name hashes/digests, group CRCs/versions and the encoded index identity.');
method('f','a','(B[B)V','decode',['guard','encoded'],
  'Decompresses the reference table and reads versioned group/file metadata, names and optional digests.');
method('f','<init>','([BI[B)V',null,['encoded','expectedCrc32','expectedDigest'],
  'Checks the encoded reference table CRC and optional 64-byte Whirlpool digest before decoding.');
for (const [name,descriptor,to,parameters] of [
  ['b','(I)Z','ensureIndex',['guard']],['a','(B)Z','tryLoadAllGroups',['guard']],
  ['a','(I)I','overallProgress',['guard']],['b','(II)I','groupProgress',['guard','groupId']],
  ['a','(Ljava/lang/String;I)I','namedGroupProgress',['groupName','guard']],
  ['a','(IB)Z','isValidGroup',['groupId','guard']],['a','(III)Z','isValidFileSlot',['fileId','guard','groupId']],
  ['c','(II)V','fetchGroup',['groupId','guard']],['d','(II)Z','tryLoadGroup',['guard','groupId']],
  ['a','(ZII)Z','tryLoadFile',['guard','groupId','fileId']],
  ['a','([IIII)Z','unpackGroup',['key','guard','requestedFileId','groupId']],
  ['a','(B[III)[B','getFileWithKey',['guard','key','fileId','groupId']],
  ['a','(IBI)[B','getFile',['groupId','guard','fileId']],
  ['b','(ILjava/lang/String;)I','findGroupId',['guard','groupName']],
  ['a','(ILjava/lang/String;Z)I','findFileId',['groupId','fileName','guard']],
  ['a','(Ljava/lang/String;B)Z','hasGroupName',['groupName','guard']],
  ['a','(ILjava/lang/String;)Z','tryLoadNamedGroup',['guard','groupName']],
  ['a','(Ljava/lang/String;Ljava/lang/String;B)Z','tryLoadNamedFile',['fileName','groupName','guard']],
  ['a','(ILjava/lang/String;Ljava/lang/String;)[B','getNamedFile',['guard','fileName','groupName']],
  ['a','(BLjava/lang/String;Ljava/lang/String;[I)[B','getNamedFileWithKey',['guard','groupName','fileName','key']],
]) method('mf',name,descriptor,to,parameters,
  'Reviewed archive provider/index/loading callers, lowercase name hashes and unpacking code. Multi-file chunks use delta lengths and sparse IDs; key-based reads decrypt a copy; all three retention policies and synchronized boundaries remain intact.');
method('mf','a','(ILc;)V','writeReflectionCheckResults',['guard','output'],
  'Waits for queued field/method tasks, performs requested reads/writes/invocations, serializes success/error codes, appends CRC and unlinks the completed check.');
method('mf','a','(IIILed;I)V','drawSpriteWithRowJitter',['y','x','amplitude','sprite','guard'],
  'Applies an independent Gaussian horizontal displacement per sprite row, retaining transparent pixels and the original 640-pixel clip behavior.');
method('mf','a','(II)Z','isPowerupType',['objectType','guard'],'Accepts object types nine through thirteen, matching the initial-powerup reader and pickup handlers.');
method('mf','b','(III)I','objectScore',['gameMode','objectType','guard'],
  'Looks up object-type score and applies campaign-mode scaling; used when destroying placed objects and tethered objects.');
method('mf','a','(ZZLjava/lang/CharSequence;)Ljava/lang/String;','accountNameValidationMessage',['restrictCharacters','allowRepeatedSeparators','text'],
  'Reports shape/separator errors first, then optional account-name character restrictions, returning null when accepted.');

for (const [name,descriptor,to,parameters] of [
  ['a','(BI)V','writeInt',['guard','value']],['b','(II)V','writeMedium',['guard','value']],
  ['h','(II)V','writeShort',['guard','value']],['f','(II)V','writeByte',['value','guard']],
  ['a','(JB)V','writeLong',['value','guard']],['a','(IJ)V','writeLong56',['guard','value']],['a','(JI)V','writeLong40',['value','guard']],
  ['i','(I)J','readLong',['guard']],['a','(Z)B','readByte',['guard']],['j','(I)I','readUnsignedShortOrInt',['guard']],
  ['d','(II)V','writeSignedSmart',['guard','value']],['e','(B)I','readSignedSmart',['guard']],
  ['a','(IBI[B)V','writeBytes',['length','guard','offset','source']],['a','([BBII)V','readBytes',['destination','guard','offset','length']],
  ['a','(Ljava/lang/String;I)V','writeString',['text','guard']],['c','(Z)Ljava/lang/String;','readString',['guard']],
  ['a','(BLjava/lang/String;)V','writeCircumfixedString',['guard','text']],['f','(B)Ljava/lang/String;','readCircumfixedString',['guard']],
  ['d','(I)Ljava/lang/String;','readNullableString',['guard']],['a','(Ljava/lang/String;B)V','writeBase38Password',['password','guard']],
  ['g','(II)V','padToPosition',['guard','endPosition']],['e','(II)V','backpatchByteLength',['guard','length']],
  ['i','(II)V','backpatchShortLength',['length','guard']],['c','(II)I','appendCrc32',['start','guard']],['h','(I)Z','verifyCrc32',['start']],
  ['a','(I[I)V','xteaEncrypt',['guard','key']],['a','(I[III)V','xteaDecrypt',['start','key','end','guard']],
  ['a','(BLjava/math/BigInteger;Ljava/math/BigInteger;)V','rsaEncrypt',['guard','modulus','exponent']],
  ['a','(II)I','xor',['left','right']],
  ['b','(ZLjava/lang/CharSequence;I)Z','hasValidAccountNameShape',['allowRepeatedSeparators','text','guard']],
  ['a','(ZLjava/lang/CharSequence;I)Z','isValidAccountName',['allowRepeatedSeparators','text','guard']],
]) method('n',name,descriptor,to,parameters,
  'Reviewed byte shifts, cursor movement, smart ranges, CP1252 zero delimiters, backpatch offsets, CRC32, XTEA rounds/range handling, BigInteger RSA and login password packing. Names preserve original guard branches and do not imply changed validation/security policy.');

fields('ia', [['L','[S','vertexX'],['r','[S','vertexY'],['J','[S','vertexZ'],['K','S','vertexCount'],
  ['e','[S','faceVertexA'],['o','[S','faceVertexB'],['f','[S','faceVertexC'],['D','S','faceCount'],
  ['h','[S','faceNormalA'],['u','[S','faceNormalB'],['j','[S','faceNormalC'],['M','S','normalCount'],
  ['b','I','minX'],['a','I','maxX'],['i','I','minY'],['R','I','maxY'],['g','I','minZ'],['O','I','maxZ'],['B','Z','boundsValid']],
  'Vertex transform/bounds methods and depth-bucket/render consumers distinguish xyz coordinate arrays, indexed triangle corners, per-corner normal indices and lazy axis bounds.');
for (const [name,descriptor,to,parameters] of [
  ['a','(IIIII)V','scaleVertices',['scaleZ','divisor','scaleY','scaleX','guard']],
  ['a','(IIII)V','translateVertices',['offsetZ','firstVertex','offsetX','offsetY']],
  ['a','(B)V','updateBounds',['guard']],['b','(B)V','invalidateBounds',['guard']],
]) method('ia',name,descriptor,to,parameters,
  'Reviewed coordinate-wise short transforms and lazily recomputed min/max bounds; both transforms invalidate bounds and preserve short narrowing and guard behavior.');

fields('om', [['f','I','id'],['d','I','parameterCount']],
  'Dynamic command lookup compares the ID; the phrase decoder allocates this many unsigned-short configuration parameters.');
method('om','<init>','(IIII)V',null,['id','unusedArgumentOne','unusedArgumentTwo','parameterCount'],
  'Only ID and parameter count are retained; the two middle arguments are unused in this client and their roles are not inferred.');
method('vh','e','(I)[Lom;','quickChatDynamicCommands',['guard'],
  'Returns the fourteen command descriptors searched by ID before phrase decoding; these are not network packet types.');
method('kf','a','(BI)Lom;','findQuickChatDynamicCommand',['guard','id'],
  'Searches quickChatDynamicCommands by retained ID, returning null for an unknown command.');
method('kf','g','(I)V','clearCachedName',['guard'],'Clears the last completed name-availability result cache.');
method('kf','a','(III)I','scaleCampaignBonus',['guard','gameMode','value'],
  'Modes two/three multiply by one hundred; zero/one preserve the value, as used by the session score bonus helper.');
fields('si', [['q','[[I','commandParameters'],['z','[I','responseIds'],['x','[I','commandIds'],['s','[Ljava/lang/String;','textFragments']],
  'Phrase opcodes decode delimiter-separated text, response IDs and dynamic command IDs with their configuration parameters; preview joins text fragments with ellipses.');
for (const [name,descriptor,to,parameters] of [
  ['a','(ILn;I)V','decodeOpcode',['guard','input','opcode']],['a','(Ln;I)V','decode',['input','guard']],
  ['d','(B)V','markGlobalResponses',['guard']],['g','(I)Ljava/lang/String;','previewText',['guard']],
  ['a','(FLjava/lang/String;ZB)V','showLoadingProgress',['percent','text','alternateStyle','guard']],
  ['a','(ILjava/applet/Applet;)V','inspectAppletUsername',['guard','applet']],
  ['a','(ILdk;)V','applyGrayButtonPalette',['guard','button']],
]) method('si',name,descriptor,to,parameters,
  'Reviewed phrase opcodes/preview and unrelated static helpers. Global response marking ORs bit 15; loading progress creates/updates the progress screen; username inspection retains its discarded result; palette helper installs three gray/background and text colors.');
fields('mn', [['r','[Lla;','fieldTasks'],['g','I','id'],['i','I','operationCount'],['l','[[[B','serializedArguments'],
  ['o','[I','errors'],['p','[Lla;','methodTasks'],['m','[I','operations'],['j','[I','replacementValues']],
  'Reflection result writer interprets operations zero through four, lookup task status/results, serialized invocation arguments and per-operation errors.');
method('mn','a','(ICI)Ljava/lang/String;','repeatChar',['guard','character','count'],'Allocates a char array, fills each element with the supplied character and constructs a string.');
method('mn','a','(IIIII)V','drawGradientOutline',['guard','x','y','width','height'],
  'Draws fixed top/bottom border colors and a clipped grayscale gradient down the two vertical edges.');

// Collection ownership and request records are derived from their actual link
// operations and wire consumers. Constructor stubs that throw stay untouched.
fields('qm', [['e','Lhg;','lookupCursor'],['g','I','bucketCount'],['b','[Lhg;','buckets']],
  'Bucket lookup and insertion use key & (bucketCount - 1); Java iteration walks the same primary-link sentinels.');
fields('vb', [['c','Lfl;','sentinel']], 'Circular sentinel belongs to the secondary link chain.');
fields('rm', [['b','Lfl;','nextNode'],['f','Lvb;','deque'],['d','Lfl;','lastReturned']],
  'next follows secondary links; remove unlinks the retained last-returned node and rejects a second removal.');
fields('hb', [['g','Lhg;','nextNode'],['f','I','bucketIndex'],['e','Lqm;','table'],['c','Lhg;','lastReturned']],
  'Reset starts at bucket zero; iteration advances primary links then successive buckets; remove affects only the last returned node.');
fields('wf', [['a','Lcn;','deque'],['d','Lhg;','cursor']],
  'The independent cursor follows next or previous links without mutating the deque-owned traversal cursor.');
fields('sh', [['q','I','weight']], 'Eviction/replacement adds this entry weight back to available capacity.');
fields('vk', [['u','Ljava/lang/Object;','value']], 'Value accessor returns the retained strong reference.');
fields('fa', [['d','Lvb;','recency'],['g','I','remainingWeight'],['a','I','capacity'],['b','Lqm;','entries']],
  'Insertion subtracts weight, evicts from the recency front until nonnegative, and appends the new entry; reads move retained entries to the tail.');
for (const [owner,name,descriptor,to,parameters,evidence] of [
  ['qm','a','(IJ)Lhg;','get',['guard','key'],'Searches the selected bucket by long key.'],
  ['qm','a','(JBLhg;)V','put',['key','guard','node'],'Transfers primary-link ownership into the selected bucket and assigns the key.'],
  ['qm','a','([Ldk;B)I','minimumButtonX',['buttons','guard'],'Returns the minimum retained button x coordinate or zero for an empty array.'],
  ['vb','a','(B)Lfl;','removeFirst',['guard'],'Unlinks and returns the first secondary-linked node, or null at the sentinel.'],
  ['vb','a','(ZLfl;)V','addLast',['guard','node'],'Transfers secondary-link ownership to the deque tail without changing primary links.'],
  ['rm','a','(Ljava/awt/Component;B)V','attachMouseInput',['component','guard'],'Attaches the shared mouse handler as mouse, motion and focus listener.'],
  ['hb','a','(B)V','reset',['guard'],'Restarts bucket iteration and clears last-returned state.'],
  ['wf','c','(I)Lhg;','first',['guard'],'Returns the first primary node and retains its successor.'],
  ['wf','b','(I)Lhg;','last',['guard'],'Returns the last primary node and retains its predecessor.'],
  ['wf','a','(ILhg;)Lhg;','firstFrom',['guard','start'],'Starts forward traversal inclusively at start, or at the deque front for null.'],
  ['wf','a','(BLhg;)Lhg;','lastFrom',['guard','start'],'Starts backward traversal inclusively at start, or at the deque back for null.'],
  ['wf','a','(I)Lhg;','next',['guard'],'Returns the retained forward cursor and advances, returning null at the sentinel.'],
  ['wf','a','(B)Lhg;','previous',['guard'],'Returns the retained backward cursor and retreats, returning null at the sentinel.'],
  ['wf','a','(II)I','integerBitLength',['value','guard'],'Counts positive value bits; negative values retain the original signed-width calculation with a minimum of two.'],
  ['sh','d','(B)Z','isSoft',['guard'],'Cache tests this before promoting a surviving soft entry to a strong one.'],
  ['sh','e','(B)Ljava/lang/Object;','getValue',['guard'],'Cache reads this value and removes an entry whose value is null.'],
  ['sh','a','(BLjava/applet/Applet;)Lee;','readLastLoginMethod',['guard','applet'],'Matches the last-login-method cookie against known login method tokens, with the retained default.'],
  ['sh','a','(BLjava/applet/Applet;Ljava/net/URL;)Ljava/net/URL;','withSessionParameters',['guard','applet','url'],'Adds changed settings/session values through the URL helper, preserving the original argument flow.'],
  ['vk','a','(BILih;I)C','widestAllowedGlyph',['guard','firstCharacter','font','lastCharacter'],'Scans an inclusive character range using the allowed-character predicate and font glyph widths.'],
  ['vk','a','(Ljava/lang/String;I)Ltk;','validateDomainLabel',['label','guard'],'Checks nonempty length at most 63, allowed domain-label characters and no leading/trailing hyphen.'],
  ['fa','a','(JI)V','remove',['key','guard'],'Looks up the key and unlinks/refunds the entry when present.'],
  ['fa','a','(JLjava/lang/Object;II)V','putWeighted',['key','value','weight','guard'],'Replaces an existing key, reserves weight and evicts least-recent entries before inserting a strong entry.'],
  ['fa','a','(Ljava/lang/Object;JB)V','put',['value','key','guard'],'Inserts with unit weight.'],
  ['fa','a','(Lsh;B)V','removeEntry',['entry','guard'],'Unlinks both chains and returns the weight to remaining capacity; null is accepted.'],
  ['fa','a','(JB)Ljava/lang/Object;','get',['key','guard'],'Returns a live value, refreshes recency, removes a lost value or promotes a soft value to a strong entry.'],
  ['fa','a','(ILmf;ILmf;I)Lih;','loadBitmapFont',['guard','metricsArchive','groupId','glyphArchive','fileId'],'Loads glyph data first and then constructs the font using the separate metrics archive file.'],
]) method(owner,name,descriptor,to,parameters,evidence);
for (const [owner,descriptor,parameters] of [
  ['rm','(Lvb;)V',['deque']],['hb','(Lqm;)V',['table']],['wf','(Lcn;)V',['deque']],
  ['sh','(I)V',['weight']],['vk','(Ljava/lang/Object;I)V',['value','weight']],
]) method(owner,'<init>',descriptor,null,parameters,'Retains the supplied owner/value/weight and initializes the reviewed traversal or cache state.');

fields('om', [['b','Leg;','mouseHandler'],['c','Lc;','outgoingPackets'],['g','Lc;','incomingPackets']],
  'AWT input checks the shared handler; protocol writers use the outgoing buffer and server packet decoders use the incoming buffer.');
fields('vb', [['b','I','pendingMouseX']], 'AWT enter/move/drag updates this coordinate and exit sets minus one.');
fields('jk', [['b','I','pendingMouseY']], 'AWT enter/move/drag updates this coordinate and exit sets minus one.');
fields('ke', [['a','Z','mouseInputChanged']], 'Mouse activity sets the pending-input-change flag.');
fields('md', [['G','I','mouseIdleTicks']], 'Mouse events reset the shared idle tick counter.');
fields('vj', [['b','I','heldMouseButton']], 'Press selects left/right button one/two; release and focus loss clear it.');
fields('kb', [['f','I','pendingClickButton'],['a','Ljava/lang/String;','host'],['b','I','port']],
  'Socket connection uses instance host/port; unrelated static click state captures the last pressed button.');
fields('fk', [['b','I','pendingClickX']], 'Mouse press captures its x coordinate.');
fields('dd', [['c','I','pendingClickY']], 'Mouse press captures its y coordinate.');
fields('hd', [['b','Ljava/awt/Component;','delegate']], 'Canvas paint/update forward to the retained component.');
fields('jb', [['n','Ljava/net/ProxySelector;','proxySelector']], 'Constructor captures the default selector used by connection attempts.');
method('eg','a','(IIZZLhh;)Loc;','createExplosionCloud',['yQ16','xQ16','indexedRendering','guard','sound'],
  'Constructs the 4096-point explosion at the swapped x/y constructor arguments, plays spatial audio and selects the indexed-rendering flag.');
method('hd','<init>','(Ljava/awt/Component;)V',null,['delegate'],'Retains the component used by Canvas paint/update.');
method('hd','a','(Ljava/lang/String;ZLjava/lang/String;)Z','isPasswordAcceptable',['password','guard','accountName'],
  'PasswordValidator uses this combined length, character, repetition and account-name similarity policy on normalized text.');
method('kb','a','(I)Ljava/net/Socket;','connect',['firstProxyIndex'],'Abstract socket-connection operation; the proxy implementation starts its candidate scan at this index.');
method('kb','b','(Z)Ljava/net/Socket;','connectDirect',['guard'],'Opens a Socket using the retained host and port.');
method('jb','a','(Ljava/net/Proxy;I)Ljava/net/Socket;','connectViaProxy',['proxy','guard'],
  'Handles DIRECT, SOCKS and HTTP proxy types, optionally obtaining a cached HTTP authentication header.');
method('jb','a','(ILjava/lang/String;ILjava/lang/String;)Ljava/net/Socket;','openHttpTunnel',['proxyPort','authorizationHeader','guard','proxyHost'],
  'Writes HTTP CONNECT, accepts success responses and reports HTTP 407 authentication schemes with ProxyAuthenticationException.');
method('jb','a','(JB)Ljava/lang/String;','decodeBase37Name',['encodedName','guard'],
  'Decodes the bounded nonzero base-37 value, changes underscores to nonbreaking spaces and capitalizes word initials.');
method('im','<init>','(Ljava/lang/String;)V',null,['scheme'],'Retains the HTTP proxy authentication scheme as the IOException message.');
method('im','a','(III)I','greatestCommonDivisor',['left','right','guard'],'Euclidean remainder loop after ordering the supplied integers.');
method('im','a','(BI)V','resendProgressRequests',['guard','opcode'],
  'Replays pending progress records and queries through their independent protocol writers.');

fields('tc', [['l','[Led;','sprites'],['q','I','spacing'],['m','I','width']],
  'Strip measurement/drawing adds each non-null sprite full width and spacing, including spacing after the final sprite.');
for (const [name,descriptor,to,parameters] of [
  ['a','(B)V','updateWidth',['guard']],['a','(III)V','draw',['guard','x','y']],['d','(I)I','width',['guard']],
]) method('tc',name,descriptor,to,parameters,'Reviewed horizontal strip measurement and drawing; null sprites contribute neither width nor spacing.');
method('tc','<init>','([Led;I)V',null,['sprites','spacing'],'Retains the strip contents/spacing and measures its full width.');
fields('bd', [['j','[B','payload'],['i','I','crc32']], 'Saved-data writer serializes payload bytes and retains the appended CRC for acknowledgement matching.');
method('bd','<init>','([B)V',null,['payload'],'Retains the supplied saved-data bytes.');
fields('ij', [['l','Z','complete'],['n','I','boardId'],['m','[[Ljava/lang/String;','stringColumns'],['o','[[I','intColumns'],['k','[[J','longColumns']],
  'Highscore query writer sends the board ID; response decoding allocates typed columns and marks the pending query complete.');
fields('ik', [['j','I','boardId'],['k','I','boardIdComplement'],['i','I','requestId']],
  'The gameplay submission supplies board/complement, and construction allocates a wrapping 16-bit request ID for acknowledgement lookup.');
fields('jh', [['h','Z','complete'],['g','Z','unavailable'],['i','[I','achievementWords']],
  'Subtype-zero response installs bitmap words with unavailable false; subtype two installs defaults with unavailable true; both complete and unlink the query.');
fields('rl', [['i','I','requestId'],['g','I','rowCount']], 'Rating writer sends both bytes; the decoder matches request ID and sizes table rows by the retained count.');
fields('ll', [['g','I','archiveId'],['i','I','groupId'],['j','[I','key']], 'Key writer sends archive byte/group short; response installs four integer XTEA words and unlinks the pending request.');
fields('dm', [['g','J','readyAtMillis'],['i','I','opcode'],['j','[B','payload']], 'Receive path queues payload/opcode at current time plus simulated latency and delivers it once the retained time has passed.');
method('dm','<init>','(JI[B)V',null,['readyAtMillis','opcode','payload'],'Retains the queued incoming packet delivery time and contents.');
fields('cc', [['i','I','campaignId'],['m','I','levelIndex']], 'Record writer sends campaign and signed-smart level index; acknowledgement finds the matching queued pair.');
fields('dc', [['j','I','campaignId'],['h','[I','progressWords'],['g','Z','complete']], 'Query writer sends campaign ID; decoder fills the integer words, marks completion and unlinks the query.');
for (const [owner,name,descriptor,to,parameters] of [
  ['ma','a','(IILll;)V','writeArchiveKeyRequest',['guard','opcode','request']],
  ['hg','a','(IILcc;)V','writeProgressRecord',['guard','opcode','record']],
  ['oa','a','(ILdc;I)V','writeProgressQuery',['opcode','query','guard']],
  ['sm','a','(Lqd;IZ)V','writeAchievementRecord',['record','opcode','guard']],
  ['aj','a','(IILij;)V','writeHighscoreQuery',['guard','opcode','query']],
  ['ig','a','(IILik;)V','writeScoreSubmission',['guard','opcode','submission']],
  ['qh','a','(Lrl;ZI)V','writeRatingQuery',['query','guard','opcode']],
  ['r','a','(ILbd;I)V','writeSavedData',['guard','write','opcode']],
  ['ca','a','(IILbd;)V','enqueueSavedDataWrite',['guard','opcode','write']],
  ['ci','a','(IIII)Lll;','requestArchiveKey',['archiveId','groupId','guard','opcode']],
  ['di','a','(II)V','resendArchiveKeyRequests',['guard','opcode']],
  ['ll','b','(Z)V','decodeArchiveKeyResponse',['guard']],['ll','a','(Z)V','decodeAccountName',['guard']],
  ['ll','d','(I)Z','hasCompletePacket',['guard']],
  ['dm','a','(B)V','detectMaximumHeap',['guard']],['dm','a','(Lmf;IZ)V','loadSkyLayers',['archive','theme','guard']],
  ['dm','a','(ILjava/applet/Applet;)V','openSupportPage',['guard','applet']],
  ['cc','a','(ILmf;IB)[Led;','loadSprites',['groupId','archive','fileId','guard']],
  ['dc','a','(BLjava/lang/String;Ljava/applet/Applet;)Ljava/lang/String;','readCookie',['guard','name','applet']],
  ['dc','a','(III)I','ceilDivide',['guard','divisor','value']],
]) method(owner,name,descriptor,to,parameters,
  'Reviewed request constructor/writer/decoder and helper bodies. Packet layouts, CRC boundaries, acknowledgement ownership, guard side effects and optional URL/cookie operations remain unchanged. Encoded payload words retain their unresolved fields.');

// Fonts and legacy menu geometry retain their original raster/layout behavior.
fields('wl', [['w','[I','imageBaselines'],['x','I','maxDescent'],['H','Ljava/lang/StringBuilder;','wrapBuffer'],
  ['v','[B','kerning'],['r','I','maxAscent'],['B','[I','glyphOffsetY'],['y','I','lineHeight'],['G','[I','glyphWidth'],
  ['t','[I','advances'],['M','[I','glyphHeight'],['D','[I','glyphOffsetX'],['q','[Lfi;','images'],['N','I','capHeight'],
  ['C','I','currentShadowColor'],['A','I','currentAlpha'],['K','I','underlineColor'],['s','I','defaultColor'],
  ['I','I','defaultShadowColor'],['F','I','justificationRemainder'],['J','I','defaultAlpha'],['u','I','strikeColor'],
  ['L','I','justificationSpacingQ8'],['z','[Ljava/lang/String;','wrappedLines'],['E','I','currentColor']],
  'Metrics decoder/constructor and markup renderer distinguish glyph offsets/extents/advances, baseline/line metrics, pair kerning, embedded images and shared resettable style/justification state.');
fields('ih', [['O','[[B','glyphMasks']], 'Every nonzero byte draws a solid glyph pixel regardless of its magnitude.');
fields('ab', [['O','[[B','glyphCoverage']], 'Palette conversion produces per-pixel coverage; ordinary drawing multiplies it by the requested alpha.');
fields('em', [['c','[I','maskStarts'],['f','[I','maskWidths']], 'Binary glyph masking clips each raster-relative scanline to this start/width pair.');
for (const [name,descriptor,to,parameters] of [
  ['a','(C)I','charAdvance',['character']],['b','(Ljava/lang/String;)I','stringWidth',['text']],
  ['a','(Ljava/lang/String;I)I','wrappedLineCount',['text','width']],['b','(Ljava/lang/String;II)I','paragraphHeight',['text','width','lineSpacing']],
  ['a','(Ljava/lang/String;[I[Ljava/lang/String;)I','wrapLines',['text','widths','lines']],
  ['a','(III)V','resetStyle',['color','shadow','alpha']],['b','(II)V','resetOpaqueStyle',['color','shadow']],
  ['a','(Ljava/lang/String;)V','applyTag',['tag']],['a','(Ljava/lang/String;II)V','renderLine',['text','x','baselineY']],
  ['a','(Ljava/lang/String;IIII)V','drawLeft',['text','x','baselineY','color','shadow']],
  ['b','(Ljava/lang/String;IIII)V','drawRight',['text','x','baselineY','color','shadow']],
  ['c','(Ljava/lang/String;IIII)V','drawCentered',['text','x','baselineY','color','shadow']],
  ['c','(Ljava/lang/String;IIIII)V','drawLeftAlpha',['text','x','baselineY','color','shadow','alpha']],
  ['a','(Ljava/lang/String;IIIII)V','drawRightAlpha',['text','x','baselineY','color','shadow','alpha']],
  ['b','(Ljava/lang/String;IIIII)V','drawCenteredAlpha',['text','x','baselineY','color','shadow','alpha']],
  ['a','(Ljava/lang/String;IIIIIIIII)I','drawParagraph',['text','x','y','width','height','color','shadow','horizontalAlignment','verticalAlignment','lineSpacing']],
  ['a','(Ljava/lang/String;IIIIIIIIII)I','drawParagraphAlpha',['text','x','y','width','height','color','shadow','alpha','horizontalAlignment','verticalAlignment','lineSpacing']],
  ['a','(IIIIIIZ)V','drawGlyph',['glyph','x','y','width','height','color','shadow']],
  ['a','(IIIIIIIZ)V','drawGlyphAlpha',['glyph','x','y','width','height','color','alpha','shadow']],
]) method('wl',name,descriptor,to,parameters,
  'Reviewed metrics, markup entities/style tags, line breaking/kerning, alignment wrappers and abstract glyph calls. Shadow glyph calls carry true; coverage rendering uses its binary mask path for shadows.');
for (const owner of ['ih','ab']) {
  method(owner,'a','([I[BIIIIIII)V',owner==='ih'?'blitMask':'blitCoverage',
    ['pixels','mask','color','sourceIndex','destinationIndex','width','height','destinationSkip','sourceSkip'],
    'Reviewed row-major raster kernel: zero is transparent; binary masks replace color, while coverage masks blend with the destination.');
  method(owner,'a','([I[BIIIIIIII)V',owner==='ih'?'blitMaskAlpha':'blitCoverageAlpha',
    ['pixels','mask','color','sourceIndex','destinationIndex','width','height','destinationSkip','sourceSkip','alpha'],
    'Reviewed alpha raster kernel; binary masks use one alpha, coverage masks multiply per-pixel coverage by that alpha.');
}
method('ih','a','([I[BIIIIIIIII[I[I)V','blitMaskedGlyph',
  ['pixels','mask','x','y','width','height','color','sourceIndex','destinationIndex','destinationSkip','sourceSkip','starts','widths'],
  'Clips each glyph row to raster-relative mask start/width intervals and writes the shared raster target, retaining the original skip arithmetic.');
method('wl','<init>','([B[I[I[I[I)V',null,['metrics','offsetX','offsetY','widths','heights'],'Decodes advances/kerning and computes ascent, descent and capital height from glyph extents.');
method('ih','<init>','([B[I[I[I[I[[B)V',null,['metrics','offsetX','offsetY','widths','heights','masks'],'Retains binary glyph masks after base metric initialization.');
method('ab','<init>','([B[I[I[I[I[I[[B)V',null,['metrics','offsetX','offsetY','widths','heights','palette','glyphPixels'],'Converts palette-index glyph pixels into coverage after base metric initialization.');

fields('jl', [['o','I','contentWidth'],['i','I','titleGap'],['h','Lih;','font'],['g','I','titleCenterX'],
  ['b','[Ljava/lang/String;','paragraphs'],['m','Ljava/lang/String;','title'],['j','I','bodyColor'],['e','I','height'],
  ['k','I','titleColor'],['d','I','columnSplitX'],['f','I','lineSpacing']],
  'Legacy text configuration centers a 480-pixel content area in the fixed 640-pixel viewport, measures paragraphs and retains separate title/column anchors.');
for (const [name,descriptor,to,parameters] of [
  ['a','(ILih;II)V','configure',['bodyColor','font','titleColor','guard']],
  ['a','([Ljava/lang/String;I)I','maximumTextWidth',['lines','firstLine']],['a','(B)V','updateLayout',['guard']],
  ['b','(II)I','drawTitle',['baselineY','guard']],['a','(Z)I','contentWidth',['guard']],
  ['a','(ZI)V','drawParagraphs',['guard','baselineY']],['a','(BI)V','translateX',['guard','offset']],
  ['b','(B)I','height',['guard']],['a','([Ljava/lang/String;B)I','paragraphsHeight',['paragraphs','guard']],
  ['c','(B)I','fontHeight',['guard']],['a','(II)V','draw',['y','guard']],
  ['b','(I)V','writeBrowserSessionMarker',['guard']],
]) method('jl',name,descriptor,to,parameters,
  'Reviewed legacy heading/paragraph measurement and draw consumers, including null-font exits and original title advance behavior. The unrelated static helper delegates the fixed browser-session marker cookie.');
method('jl','<init>','(Ljava/lang/String;[Ljava/lang/String;)V',null,['title','paragraphs'],'Uppercases a non-null heading and retains paragraph strings.');
fields('gl', [['v','I','rightColor'],['u','[Ljava/lang/String;','leftRows'],['q','I','leftColor'],['t','[Ljava/lang/String;','rightRows']],
  'Right-aligned left rows end at the split; left-aligned right rows begin there, with independent colors.');
for (const [name,descriptor,to,parameters] of [
  ['d','(B)V','updateColumns',['guard']],['a','(IIIBLih;)V','configureColumns',['rightColor','leftColor','titleColor','guard','font']],
  ['a','(III[Ljava/lang/String;I)V','drawColumn',['guard','baselineY','alignment','rows','color']],
  ['a','(BLjava/applet/Applet;)V','updateBrowserLinks',['guard','applet']],['c','(Z)Lk;','defaultTextPainter',['guard']],
]) method('gl',name,descriptor,to,parameters,'Reviewed two-column width/split calculation, aligned row drawing, cached gray text painter and fixed browser navigation link updates.');
method('gl','<init>','(Ljava/lang/String;[Ljava/lang/String;[Ljava/lang/String;)V',null,['title','leftRows','rightRows'],'Retains the paired text rows and heading.');
fields('wd', [['t','[Ljava/lang/String;','labels'],['s','I','labelColor'],['r','[Ltc;','spriteRows']],
  'Sprite-strip rows end at the split and their corresponding text labels start there.');
for (const [name,descriptor,to,parameters] of [
  ['a','(B[Ljava/lang/String;III)V','drawLabels',['guard','labels','baselineY','color','alignment']],
  ['c','(I)V','updateColumns',['guard']],['a','(I[Ltc;B)V','drawSpriteRows',['baselineY','rows','guard']],
  ['a','([Ltc;I)I','maximumSpriteWidth',['rows','minimumWidth']],
]) method('wd',name,descriptor,to,parameters,'Reviewed sprite-label column measurement and drawing; null rows retain the original spacing. Base configure/draw override families are resolved automatically.');
method('wd','<init>','(Ljava/lang/String;[Ltc;[Ljava/lang/String;)V',null,['title','spriteRows','labels'],'Retains sprite strips, labels and heading.');

fields('dk', [['j','I','textOffsetX'],['l','I','y'],['i','I','height'],['q','I','revealUntilTick'],['f','I','x'],
  ['k','[I','scaledWidths'],['e','[I','foregroundColors'],['d','I','style'],['o','Ljava/lang/String;','text'],
  ['m','[I','backgroundColors'],['b','I','prefixNumber'],['r','[I','textColors'],['a','[I','scaledHeights'],
  ['n','Led;','sprite'],['p','I','width'],['c','I','actionId'],['s','Lih;','font']],
  'Reviewed constructors, half-open hit test, measured/styled drawing, scaled sprite state, text truncation and palette setters. Encoded unrelated values retain their existing fields.');
for (const [name,descriptor,to,parameters] of [
  ['a','(B)I','preferredHeight',['guard']],['a','(BII)Z','hitTest',['guard','x','y']],
  ['a','(BLjava/lang/CharSequence;)[B','encodeCp1252',['guard','text']],['a','(I)I','spriteHeight',['guard']],
  ['a','(III)V','setSize',['height','guard','width']],['a','(IZ)V','draw',['guard','highlighted']],
  ['a','(Z)I','spriteWidth',['guard']],['a','(ZZB)V','drawState',['highlighted','alternateState','guard']],
  ['a','([I[IB[I)V','setColors',['foregroundColors','backgroundColors','guard','textColors']],
  ['a','([I[II)V','setBackgroundColors',['backgroundColors','foregroundColors','guard']],
  ['b','(B)I','revealOffset',['guard']],['b','(BII)V','setPosition',['guard','x','y']],
  ['b','(I)I','textWidthWithPadding',['guard']],['c','(I)I','labelBaseline',['guard']],['d','(I)I','preferredWidth',['guard']],
  ['e','(I)V','decodeProgressResponse',['guard']],['f','(I)I','textHeightWithPadding',['guard']],['h','(I)V','truncateLabel',['guard']],
]) method('dk',name,descriptor,to,parameters,
  'Reviewed five style branches, metric queries, palette argument order and subtype-zero query/subtype-one progress acknowledgements. All original guard and truncation behavior remains.');

fields('me', [['i','[Ljava/lang/String;','rows'],['q','I','widthMode'],['s','I','rowCount'],['l','Lih;','font'],
  ['j','I','y'],['r','I','selectedColor'],['m','I','textColor'],['h','Ljava/lang/String;','header'],['k','I','x']],
  'Constructors select numbered/fixed-text/free-text/integer width modes; drawing retains header, selected/normal row colors and position.');
for (const [name,descriptor,to,parameters] of [
  ['a','(BI)I','paddedWidth',['guard','contentWidth']],['a','(B)I','numberedWidth',['guard']],
  ['f','(I)I','rowHeight',['guard']],['a','(Lih;IBI)V','configure',['font','selectedColor','guard','textColor']],
  ['a','(IIIIII)I','drawRow',['selectedRow','rowHeight','x','baselineY','rowIndex','guard']],
  ['i','(I)I','fixedTextWidth',['guard']],['g','(I)I','headerAreaHeight',['topPadding']],
  ['a','(IZ[Z)V','drawVisibleRowsInternal',['selectedRow','guard','visibleRows']],
  ['a','(II)V','draw',['guard','selectedRow']],['a','(I[ZB)V','drawVisibleRows',['selectedRow','visibleRows','guard']],
  ['e','(B)I','width',['guard']],['f','(B)I','height',['guard']],['j','(I)V','drawHeader',['guard']],
  ['g','(B)I','textWidth',['guard']],['d','(B)I','widestDigit',['guard']],['e','(I)I','twoDigitWidth',['guard']],
  ['b','(II)V','drawRows',['guard','selectedRow']],['d','(I)I','doubleSpaceWidth',['guard']],
  ['a','(III)V','setPosition',['x','y','guard']],['h','(I)I','headerWidth',['guard']],
]) method('me',name,descriptor,to,parameters,
  'Reviewed row/header layout, font metrics, mode-specific width formulas, selected-row drawing and optional visibility masks. Fixed-text width uses twenty copies of the widest allowed character; no password semantics are inferred.');
method('me','<init>','(I)V',null,['rowCount'],'Builds one-based numbered row labels.');
method('me','<init>','(Ljava/lang/String;[Ljava/lang/String;I)V',null,['header','rows','widthMode'],'Retains rows/header and chooses fixed-text or free-text width mode.');
method('me','<init>','(Ljava/lang/String;[I)V',null,['header','values'],'Builds integer row labels and maps negative values to null rows.');

fields('fd', [['c','[Led;','sprites']], 'Nine-slice renderer reads corners, edges and center from this retained array.');
method('fd','a','(IIIII)V','draw',['x','y','guard','width','height'],'Delegates bounds and retained sprites to the nine-slice renderer.');
method('fd','a','(ZC)Z','isNameSeparator',['guard','character'],'Recognizes space, nonbreaking space, underscore and hyphen.');
method('fd','<init>','([Led;)V',null,['sprites'],'Retains the nine-slice sprite array.');
method('ld','a','(I[Led;IIII)V','drawNineSlice',['height','sprites','guard','y','x','width'],
  'Clips corners and tiled edges/center to the target rectangle and restores the previous raster clip.');
fields('ee', [['b','Ljava/lang/String;','name']], 'Cookie matching compares the retained login-method name exactly.');
method('ee','a','(Ljava/lang/String;B)Z','matchesName',['name','guard'],'Compares the supplied cookie value against this login method.');
method('ee','<init>','(Ljava/lang/String;)V',null,['name'],'Retains the login-method name.');
method('ee','a','(IIZ[Led;I)V','drawThreeSlice',['x','width','guard','sprites','y'],
  'Draws fixed end caps and tiles the middle sprite between them while saving/restoring the raster clip.');
method('tk','a','(II)V','resendAchievementRequests',['guard','opcode'],
  'Replays queued achievement records and pending achievement bitmap queries through their writers.');
method('re','d','(I)V','clearSharedKeyHandler',['guard'],'Clears the retained shared GameKeyHandler while holding its monitor.');
method('re','a','(ILtj;)V','enqueueDialogue',['guard','dialogue'],'Appends the supplied dialogue to the shared dialogue queue.');
method('ck','a','(IB)V','resendScoreRequests',['opcode','guard'],'Replays queued score submissions and pending highscore queries.');
method('ae','a','([BBII)I','crc32',['bytes','guard','end','start'],'Computes standard reflected CRC32 over the supplied byte range.');
method('ae','a','(JB)V','sleepMillis',['milliseconds','guard'],'Sleeps for the supplied duration and retains the original interrupted-exception handling.');
method('ae','a','(Ljava/lang/String;Ljava/lang/String;BLmf;)[Lte;','loadIndexedSprites',['groupName','fileName','guard','archive'],'Resolves the named group/file and delegates indexed sprite-sheet loading.');
method('ae','a','(II)I','bitwiseAnd',['left','right'],'Returns the integer bitwise AND.');
method('sc','a','(Lqd;II)V','enqueueAchievementRecord',['record','opcode','guard'],'Queues an achievement record and sends its first request.');
method('sc','a','(BLjava/awt/Component;)V','detachKeyboardInput',['guard','component'],'Removes key/focus listeners and invalidates pending key state.');
method('ve','a','(BLjava/lang/String;)V','updateHoverText',['guard','text'],'Tracks hover text, pointer origin and delayed visibility state across frames.');
method('ve','a','(IIZIZ)Lmf;','createArchive',[],'Delegates creation of a ResourceArchive to the shared archive factory.');
method('tj','a','(BLjava/applet/Applet;Ljava/lang/String;Ljava/lang/String;J)V','writeCookie',['guard','applet','name','value','lifetimeSeconds'],
  'Builds the cookiehost-scoped document.cookie assignment with either expiry/max-age or session discard semantics.');
method('se','a','(BLjava/applet/Applet;)V','writeBrowserSessionMarker',['guard','applet'],'Sets the fixed browser-session marker and retains its shared notification flag.');

fields('q', [['M','I','horizontalInset'],['D','I','maximumValue'],['J','I','trackY'],['K','Lkn;','markers']],
  'Painter scales each retained marker into the track; pointer input clamps to the maximum and appends/removes values.');
for (const [name,descriptor,to,parameters] of [
  ['e','(B)I','markerCount',['guard']],['b','(IB)I','markerValue',['index','guard']],['k','(I)I','maximumValue',['guard']],
  ['c','(IB)V','writeSavedDataQuery',['opcode','guard']],
]) method('q',name,descriptor,to,parameters,'Reviewed marker-list access and the unrelated length-one/subtype-zero saved-data query writer.');
fields('eb', [['N','I','radius'],['I','I','centerY'],['M','I','stepCount'],['F','I','value'],['D','I','centerX'],['G','I','markerValue']],
  'Circular painter/input share center/radius and quantized wrapped angle steps; marker minus one suppresses the extra dot.');
method('eb','a','([BZ)V','decodeSpriteSheet',['encoded','guard'],'Reads sheet dimensions, offsets/extents, palette and row/column-major indices with optional per-pixel alpha.');
fields('kn', [['e','I','growth'],['a','[I','values'],['d','Z','multiplicativeGrowth'],['g','I','lastIndex']],
  'Size is lastIndex plus one; capacity calculation either adds or multiplies by growth until the requested index fits.');
for (const [name,descriptor,to,parameters] of [
  ['a','(IIZ)V','set',['index','value','guard']],['c','(II)V','removeAt',['minimumIndex','index']],
  ['a','(IB)V','add',['value','guard']],['b','(II)V','growToIndex',['guard','index']],
  ['a','(II)I','get',['guard','index']],['d','(II)I','capacityForIndex',['guard','index']],['a','(Z)I','size',['guard']],
]) method('kn',name,descriptor,to,parameters,'Reviewed integer-list indexing, left-shift removal, append and capacity growth; throwing constructor stubs remain unchanged.');
fields('eb', [['L','Lom;','quickChatCommand']], 'Unrelated static command descriptor retains its original ID/parameter count.');
fields('qk', [['j','I','spriteCount'],['f','[I','spritePalette']], 'Sprite-sheet footer supplies count; palette entries use RGB with zero reserved for transparency.');
fields('gn', [['k','[I','spriteOffsetXs']], 'Sheet decoder reads one unsigned-short x offset per sprite.');
fields('gi', [['e','[I','spriteOffsetYs']], 'Sheet decoder reads one unsigned-short y offset per sprite.');
fields('qh', [['k','[I','spriteWidths']], 'Sheet decoder reads each trimmed width.');
fields('bc', [['a','[I','spriteHeights']], 'Sheet decoder reads each trimmed height.');
fields('qe', [['a','[[B','spriteIndices']], 'Sheet decoder retains palette-index byte arrays in row-major order.');
fields('hn', [['b','[[B','spriteAlphas']], 'Sheet decoder retains optional per-pixel alpha bytes separately from indices.');
fields('bj', [['E','[Z','spriteHasAlpha']], 'True only when an alpha plane contains a byte other than fully opaque minus one.');
fields('on', [['e','I','spriteSheetWidth']], 'Sheet footer supplies the full untrimmed width.');
fields('hd', [['c','I','spriteSheetHeight']], 'Sheet footer supplies the full untrimmed height.');

// Framebuffer operations and sprite kernels are distinguished by the actual
// pixel equation: brightness scales source RGB, alpha blends destination RGB,
// additive drawing saturates channels, and tinting changes grayscale pixels.
fields('uf', [['f','I','tooltipLeftPadding'],['j','I','tooltipRightPadding'],
  ['l','I','tooltipTopPadding'],['r','I','tooltipBottomPadding'],
  ['d','Lwl;','tooltipFont'],['q','I','tooltipLineSpacing'],
  ['c','I','tooltipTextColor'],['a','I','tooltipBackgroundColor'],
  ['h','I','tooltipBorderColor'],['m','Z','wrapTooltips'],
  ['i','Ldb;','componentPainter'],['o','Ldb;','buttonPainter'],
  ['k','Ldb;','checkboxPainter'],['p','Ldb;','editableTextPainter']],
  'Reviewed tooltip extent/border/text calculations, default style setup and component constructors selecting each retained painter. Unassigned or unused painter slots retain their original names.');
for (const [original,descriptor,to,parameters] of [
  ['a','(IIILjava/lang/String;)V','drawWrappedTooltip',['x','guard','y','text']],
  ['a','(Ljava/lang/String;III)V','drawSingleLineTooltip',['text','y','x','guard']],
  ['a','(BLjava/lang/String;II)V','drawTooltip',['guard','text','x','y']],
  ['a','(ILwl;)V','initializePainters',['guard','font']],
  ['a','(IIIIII)V','drawLine',['endX','endY','guard','startX','startY','color']],
  ['a','(IIIIIII)V','fillRectangleAlpha',['rectangleHeight','guard','alpha','y','rectangleWidth','color','x']],
]) method('uf',original,descriptor,to,parameters,
  'Reviewed tooltip routing/clamping/wrapping, default painter construction and exact raster-wrapper argument order; unrelated account helpers remain separate.');
for (const [original, descriptor, to, parameters] of [
  ['a','(III)V','addPixel',['x','y','color']],
  ['a','(IIII)V','drawCircle',['centerX','centerY','radius','color']],
  ['a','(IIIII)V','fillRectangle',['x','y','rectangleWidth','rectangleHeight','color']],
  ['a','(IIIIII)V','fillRectangleAlpha',['x','y','rectangleWidth','rectangleHeight','color','alpha']],
  ['a','(I[IIIII)V','darkenRows',['destinationIndex','destination','rowEnd','rowWidth','negativeHeight','rowSkip']],
  ['a','([I)V','saveClip',['bounds']],
  ['a','([III)V','bind',['framebuffer','framebufferWidth','framebufferHeight']],
  ['a','([IIIIIIII)V','blurHorizontal',[]],
  ['a','([IIIIIIIII)V','blurVertical',[]],
  ['b','()V','clearMask',[]],
  ['b','(III)V','setPixel',['x','y','color']],
  ['b','(IIII)V','darkenRectangle',['x','y','rectangleWidth','rectangleHeight']],
  ['b','(IIIII)V','drawRectangle',['x','y','rectangleWidth','rectangleHeight','color']],
  ['b','(IIIIII)V','drawRectangleAlpha',['x','y','rectangleWidth','rectangleHeight','color','alpha']],
  ['b','([I)V','restoreClip',['bounds']],
  ['c','()V','resetClip',[]],
  ['c','(IIII)V','grayscaleRectangle',['x','y','rectangleWidth','rectangleHeight']],
  ['c','(IIIII)V','drawHorizontalLineAlpha',['x','y','length','color','alpha']],
  ['c','(IIIIII)V','fillVerticalGradient',['x','y','rectangleWidth','rectangleHeight','topColor','bottomColor']],
  ['d','(IIII)V','fillCircle',['centerX','centerY','radius','color']],
  ['d','(IIIII)V','drawLine',['startX','startY','endX','endY','color']],
  ['d','(IIIIII)V','blurRectangle',['horizontalRadius','verticalRadius','x','y','rectangleWidth','rectangleHeight']],
  ['e','(IIIII)V','drawDropShadow',['x','y','rectangleWidth','rectangleHeight','color']],
  ['f','(IIIII)V','drawVerticalLineAlpha',['x','y','length','color','alpha']],
  ['g','(IIII)V','drawVerticalLine',['x','y','length','color']],
  ['g','(IIIII)V','fillCircleAlpha',['centerX','centerY','radius','color','alpha']],
  ['h','(IIII)V','intersectClip',['left','top','right','bottom']],
]) method('em',original,descriptor,to,parameters,
  'Reviewed framebuffer assignment/blending equations, line/circle span geometry, clip updates and separable rolling RGB sums; existing integer arithmetic and edge handling remain unchanged.');
method('nf','a','(IIIIII)V','drawRotatedScaled',
  ['pivotXQ4','pivotYQ4','destinationXQ4','destinationYQ4','angle65536','scaleQ12'],
  'Abstract sprite transform implemented by RGB and ARGB paths: source pivot and destination are sixteenth-pixel coordinates, angle wraps at 65536, and corner products shift by twelve.');
method('nf','a','(IBIII)V','drawCenteredRotatedScaled',
  ['centerX','guard','scaleQ12','angle65536','centerY'],
  'Uses half the full sprite dimensions as the Q4 source pivot and forwards the destination center, angle and scale to the virtual transform.');
method('nf','g','(I)V','pollMouseState',['guard'],
  'Under the shared mouse-handler monitor, copies pending movement/button/click state into the tick snapshot and clears pending click/change flags.');
for (const [original,descriptor,to,parameters] of [
  ['a','(III)V','drawTinted',['x','y','tint']],
  ['a','(IIII)V','drawDownscaled',['x','y','targetWidth','targetHeight']],
  ['a','(IIIII)V','drawScaledAlpha',['x','y','targetWidth','targetHeight','alpha']],
  ['b','(III)V','drawWithBrightness',['x','y','brightness']],
  ['b','(IIII)V','drawScaled',['x','y','targetWidth','targetHeight']],
  ['b','(IIIII)V','drawBilinearPixel',['destinationIndex','sourceX','sourceY','sourceXQ12','sourceYQ12']],
  ['b','(IIIIII)V','drawRotatedScaledBilinear',
    ['pivotXQ4','pivotYQ4','destinationXQ4','destinationYQ4','angle65536','scaleQ12']],
  ['c','()V','expandToFullSize',[]],
  ['c','(II)V','drawMirrored',['x','y']],
  ['c','(III)V','drawAdditive',['x','y','intensity']],
  ['c','(IIII)V','drawCenteredRotatedScaledBilinear',['centerX','centerY','angle65536','scaleQ12']],
  ['d','(II)V','drawOpaque',['x','y']],
  ['d','(III)V','drawAlpha',['x','y','alpha']],
  ['e','()V','flipHorizontally',[]],
  ['e','(II)V','drawTransparent',['x','y']],
  ['e','(III)V','drawSilhouette',['x','y','color']],
  ['f','()V','trimTransparentEdges',[]],
  ['f','(II)V','drawMultiply',['x','y']],
  ['f','(III)V','drawShadedTint',['x','y','tint']],
  ['g','()V','bindAsFramebuffer',[]],
  ['g','(II)V','drawHalfSize',['x','y']],
  ['h','(I)V','addOutline',['color']],
]) method('ed',original,descriptor,to,parameters,
  'Reviewed trimmed/full dimensions, clip adjustments, source sampling and called pixel kernel. Transparent-zero, source brightness, destination alpha, additive, silhouette, multiplication and grayscale tint paths stay distinct.');
for (const [original,descriptor,to,parameters] of [
  ['a','(III[I[IIIIIIIII)V','blitAdditive',
    ['sourceColor','destinationColor','sum','destination','source','sourceIndex','column','destinationIndex','row','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['a','(III[I[IIIIIIIIII)V','blitAdditiveIntensity',
    ['sourceColor','destinationColor','sum','destination','source','sourceIndex','column','destinationIndex','row','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','intensity']],
  ['a','(I[I[IIIIIIII)V','blitMultiply',
    ['destinationColor','destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['a','([IIIIIIII)V','blitHalfSize',
    ['source','sourceIndex','destinationIndex','sourceRowSkip','destinationRowSkip','sourceWidth','rowWidth','rowCount']],
  ['a','([I[IIIIIII)V','blitOpaque',
    ['destination','source','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['a','([I[IIIIIIII)V','blitSilhouette',
    ['destination','source','color','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['a','([I[IIIIIIIII)V','blitBrightness',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','brightness']],
  ['a','([I[IIIIIIIIIII)V','blitTinted',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','column','row','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','tint']],
  ['a','([I[IIIIIIIIIIII)V','blitScaledAlpha',
    ['destination','source','sourceColor','sourceXQ16','sourceYQ16','destinationIndex','destinationRowSkip','rowWidth','rowCount','stepXQ16','stepYQ16','sourceWidth','alpha']],
  ['b','([I[IIIIIIII)V','blitMirrored',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['b','([I[IIIIIIIII)V','blitAlpha',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','alpha']],
  ['b','([I[IIIIIIIIIII)V','blitScaled',
    ['destination','source','sourceColor','sourceXQ16','sourceYQ16','destinationIndex','destinationRowSkip','rowWidth','rowCount','stepXQ16','stepYQ16','sourceWidth']],
  ['c','([I[IIIIIIII)V','blitTransparent',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['c','([I[IIIIIIIII)V','blitShadedTint',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','tint']],
]) method('ed',original,descriptor,to,parameters,
  'Reviewed full pixel loop, transparent-zero branch, channel arithmetic, index direction, row skips and optional Q16 nearest-neighbor coordinates; names describe the implemented blend rather than a guessed caller purpose.');
for (const [original,descriptor,to,parameters] of [
  ['b','(III[I[IIIIIIIIII)V','blitArgbAdditive',
    ['sourceColor','destinationColor','sum','destination','source','sourceIndex','column','destinationIndex','row','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','intensity']],
  ['b','([I[IIIIIIIIIIII)V','blitArgbScaledAlpha',
    ['destination','source','sourceColor','sourceXQ16','sourceYQ16','destinationIndex','destinationRowSkip','rowWidth','rowCount','stepXQ16','stepYQ16','sourceWidth','alpha']],
  ['c','([I[IIIIIIIIIII)V','blitArgbScaled',
    ['destination','source','sourceColor','sourceXQ16','sourceYQ16','destinationIndex','destinationRowSkip','rowWidth','rowCount','stepXQ16','stepYQ16','sourceWidth']],
  ['d','([I[IIIIIIII)V','blitArgb',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['d','([I[IIIIIIIII)V','blitArgbBrightness',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','brightness']],
  ['d','([I[IIIIIIIIIII)V','blitArgbTinted',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','column','row','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','tint']],
  ['e','([I[IIIIIIII)V','blitArgbMirrored',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip']],
  ['e','([I[IIIIIIIII)V','blitArgbAlpha',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','alpha']],
  ['f','([I[IIIIIIIII)V','blitArgbShadedTint',
    ['destination','source','sourceColor','sourceIndex','destinationIndex','rowWidth','rowCount','destinationRowSkip','sourceRowSkip','tint']],
]) method('uh',original,descriptor,to,parameters,
  'Reviewed per-pixel unsigned high-byte coverage, its composition with optional global alpha/brightness/intensity, source sampling and channel blend equations; ARGB kernels remain distinct from inherited RGB statics.');

// Menu composition, modal lifetime and account form roles are inferred from
// their own retained data and callers, including the complete transition paths.
fields('ef', [['g','Led;','sprite'],['j','Z','flushBeforeApply'],['f','I','offsetY'],
  ['e','I','alpha'],['i','[Led;','frameSprites'],['a','I','textColor'],
  ['b','I','shadowColor'],['h','I','offsetX']],
  'Apply copies only non-sentinel overrides; draw consumes frame sprites, aligned sprite/text offsets, colors and alpha; the flush flag draws and resets the previously accumulated layer first.');
fields('he', [['w','[Lef;','stateLayers'],['t','Lef;','workingLayer']],
  'Six retained layers are selected by base/selected/hover/pressed/disabled/focus state, composed into the reusable working layer and drawn.');
fields('bb', [['N','I','alpha'],['Q','Ltb;','modalStack'],['G','Z','open']],
  'Target alpha is 256 only for the first open panel in the owning stack; closed panels are removed only once their opacity reaches zero.');
fields('vg', [['X','I','targetHeight'],['Y','I','resizeTick'],['W','I','initialHeight'],
  ['V','I','resizeDuration'],['M','I','targetWidth'],['S','I','initialWidth']],
  'Resize starts from current dimensions and interpolates toward the retained targets with tick*(2*duration-tick)/duration squared.');
fields('fj', [['cb','Lmd;','contentWrapper'],['ib','I','resizeTicks'],['gb','I','fadeOutTicks'],
  ['Z','Lka;','transitionPhase'],['ab','I','transitionTick'],['fb','I','headerInset'],
  ['db','I','fadeInTicks'],['hb','Lhm;','pendingContent']],
  'The three identity phases fade the current wrapper, resize around pending content, then replace the child and fade it in.');
fields('tb', [['H','Lcn;','panels']], 'Primary-link deque stores panels in focus order and is drawn in reverse order.');
fields('md', [['F','I','alpha']], 'Zero skips drawing, 256 draws the child directly and other values blend a temporary child raster.');
fields('ki', [['F','I','labelColor'],['G','Ljava/lang/String;','label'],['K','I','padding'],
  ['D','I','labelWidth'],['E','Z','labelOnRight'],['L','Lwl;','labelFont']],
  'Constructor measures wrapped label height, reserves label width/padding and places the child on the opposite side.');
fields('jm', [['z','I','stripeWidth'],['C','I','stripeOffset'],['J','[Led;','stripeSprites'],
  ['B','I','progressQ16'],['N','Led;','rightCapMask'],['D','Led;','leftCapMask'],
  ['E','Led;','capScratch'],['G','Z','animateStripes']],
  'Progress chooses the Q16 fill boundary; animation wraps at twice stripe width; mirrored cap masks multiply the scrolling stripes before presentation.');
fields('w', [['Z','Ljava/lang/String;','description'],['db','Ljava/lang/String;','statusText'],
  ['cb','Ljm;','progressBar']], 'Constructor retains explanatory text; updates retain the status string and percentage in the owned progress bar.');
fields('pn', [['sb','Lwl;','messageFont'],['rb','Ljm;','progressBar'],['mb','Z','responseShown']],
  'A response is installed once and uses the retained font; progress colors change before replacing the message panel.');
fields('qc', [['ub','Lbf;','registrationForm']], 'Registration request retains the form supplied to its constructor.');
fields('qi', [['H','I','buttonCount'],['K','Lpn;','requestDialog'],['G','Ljava/lang/String;','message'],
  ['I','[Lhc;','buttons'],['O','[I','buttonActions'],['L','Lwl;','messageFont']],
  'Appended buttons grow parallel button/action arrays and extend panel height; action minus one closes the retained request dialog.');
fields('tm', [['eb','Lhc;','closeButton']], 'The sole retained button closes this notice when activated.');
fields('h', [['L','Lul;','identifierField'],['J','Lul;','passwordField'],
  ['G','Lhc;','submitButton'],['N','Lhc;','createAccountButton'],['I','Lhc;','secondaryButton'],
  ['H','Ljava/lang/String;','message']], 'Login submission reads identifier/password text; Enter advances to password then submits; optional account and secondary actions use distinct buttons.');
fields('oi', [['I','Lgd;','nameField'],['K','Lrh;','suggestions'],
  ['G','Lhc;','submitButton'],['H','Lhc;','cancelButton']],
  'Name validation enables submission, suggestions update the field, and the two buttons submit or return to the account screen.');
fields('jf', [['N','Lhc;','continueButton'],['G','Lqc;','registrationDialog'],['L','Lue;','termsText']],
  'Constructor creates linked terms text and one continuation button whose action notifies account state and closes the registration dialog.');
fields('l', [['J','Lhc;','guestButton'],['G','Lhc;','backButton'],['I','Lhc;','createAccountButton']],
  'Button labels/tooltips and handlers distinguish Go Back, free account creation and playing without logging in.');
fields('lf', [['M','Led;','indicatorScratch'],['O','I','animationTick'],['N','Lel;','validation'],
  ['L','Ljava/lang/String;','helpText']], 'Validation state selects diagnostics/help and animated status rendering; hover updates advance the indicator tick.');
fields('ha', [['f','Lwl;','font'],['b','I','horizontalAlignment'],['d','I','verticalAlignment']],
  'Underlined text and focus decoration use the retained font and the same horizontal/vertical alignment values.');
fields('bj', [['A','Lcn;','children']], 'All child insertion, traversal, layout, focus and drawing use this ordered deque.');
fields('hc', [['z','Z','selected']], 'Checkbox activation toggles this state and stateful/checkbox painters inspect it separately from hover, focus and held pointer buttons.');
fields('ul', [['H','I','maximumLength'],['L','I','caretIndex'],['P','I','selectionAnchor']],
  'Text insertion/set operations enforce the maximum and update caret/anchor; selection deletion removes the interval between them.');

for (const [owner,original,descriptor,to,parameters] of [
  ['ef','b','(II)Lef;','setShadowColor',['guard','color']],
  ['ef','a','(IB)Lef;','setOffsetY',['y','guard']],
  ['ef','a','(ILef;)V','copyTo',['guard','target']],
  ['ef','c','(II)Lef;','setOffsetX',['guard','x']],
  ['ef','a','(II)Lef;','setTextColor',['color','guard']],
  ['ef','a','(ILef;Lhm;IILhe;)V','applyTo',['originX','workingLayer','component','originY','guard','painter']],
  ['ef','a','(IZ)Lef;','setFlushBeforeApply',['guard','flush']],
  ['ef','a','(Lhe;Lhm;IIB)V','draw',['painter','component','originX','originY','guard']],
  ['ef','a','(I[Led;)Lef;','setFrameSprites',['guard','sprites']],
  ['ef','a','(Z)V','reset',['guard']],
  ['he','a','(IB)Lef;','createStateLayer',['state','guard']],
  ['he','a','([Led;I)V','setFrameSpritesForAllStates',['sprites','guard']],
  ['he','a','(Led;B)V','setSpriteForAllStates',['sprite','guard']],
  ['he','a','(ZILhe;)V','copyStatesTo',['deepCopy','guard','target']],
  ['he','a','([Led;IB)V','setStateFrameSprites',['sprites','state','guard']],
  ['he','a','(Lmf;III)Lte;','loadIndexedSprite',[]],
  ['he','a','(Ljava/lang/String;IB)Lkb;','createProxySocketConnector',['host','port','guard']],
  ['bj','a','(BLhm;)Z','focusPreviousChild',['guard','root']],
  ['bj','a','(Lhm;Z)Z','focusNextChild',['root','guard']],
  ['bj','a','(Z)Lhm;','findFocusedChild',['guard']],
  ['bj','b','(Lhm;Z)V','addChild',['component','guard']],
  ['bj','f','(B)V','refreshChildLayouts',['guard']],
  ['bj','a','(Ljava/lang/StringBuilder;ILjava/util/Hashtable;I)V','appendChildDebugTrees',['output','depth','visited','guard']],
  ['bb','j','(I)Z','updateAnimationsAndCheckClosed',['guard']],
  ['bb','a','(B)Z','refreshVisibilityAndCheckClosed',['guard']],
  ['bb','k','(I)I','targetAlpha',['guard']],
  ['bb','b','(III)V','resizeAndCenter',['guard','panelHeight','panelWidth']],
  ['bb','b','(IIB)V','drawPanelBackground',['screenY','screenX','guard']],
  ['bb','a','(IIII[I)V','halveAndAddPixels',['guard','offset','color','length','destination']],
  ['bb','a','(IIILte;II)V','drawIndexedSpriteAlphaGradient',['x','leftAlpha','guard','sprite','y','rightAlpha']],
  ['bb','a','(ILjava/lang/String;C)[Ljava/lang/String;','splitString',['guard','text','separator']],
  ['vg','b','(Z)V','finishTransition',['guard']],
  ['vg','m','(I)V','onResizeComplete',['guard']],
  ['vg','a','(ZIII)V','animateResize',['guard','duration','panelWidth','panelHeight']],
  ['vg','a','([Ldk;B)I','minimumButtonY',['buttons','guard']],
  ['vg','a','(Ljava/lang/String;Ljava/lang/String;BLjava/lang/String;)Ljava/lang/String;','replaceAllLiteral',['text','search','guard','replacement']],
  ['vg','l','(I)Ljava/lang/Boolean;','takeEmailAvailabilityResponse',['guard']],
  ['fj','a','(Lhm;I)V','transitionToContent',['content','guard']],
  ['fj','b','(BLhm;)V','installContent',['guard','content']],
  ['tb','n','(I)Lbb;','topOpenPanel',['guard']],
  ['tb','p','(I)V','refreshPanelVisibility',['guard']],
  ['tb','l','(I)V','closeAllPanels',['guard']],
  ['tb','b','(Lhm;I)V','pushPanel',['panel','guard']],
  ['tb','m','(I)V','updatePanels',['guard']],
  ['md','a','(BI)I','nextPowerOfTwo',['guard','value']],
  ['md','a','(Ljava/applet/Applet;BLjava/lang/String;)V','openRelativeUrl',['applet','guard','relativeUrl']],
  ['bo','a','(Ljava/awt/Canvas;B)V','detachCanvasInput',['canvas','guard']],
  ['bo','a','(Ljava/lang/String;ZILjava/lang/String;)Lvj;','createLoginCredentials',['identifier','alternateType','guard','password']],
  ['bo','a','(II)Z','readIncomingBytes',['guard','requiredBytes']],
  ['ki','a','(Ljava/lang/String;I)[B','loadNamedAsset',['name','guard']],
  ['jm','a','(III)V','setColors',['secondColor','firstColor','guard']],
  ['jm','e','(B)Led;','createCapMask',['guard']],
  ['jm','a','(IILed;I)V','drawStripedBar',['guard','y','stripes','x']],
  ['jm','k','(I)V','rebuildSprites',['guard']],
  ['jm','a','(ZII)Led;','createStripeSprite',['guard','firstColor','secondColor']],
  ['jm','a','(ILn;)V','writeInstallationSeed',['sourceOffset','buffer']],
  ['jm','a','(IILc;[B)[B','readPackedByteArray',['lengthBits','guard','buffer','destination']],
  ['w','a','(ILjava/lang/String;FZ)V','setProgress',['guard','status','percent','alternateColors']],
  ['w','d','(Z)V','setStopAnimatingWhenNormal',['stop']],
  ['w','c','(Z)[Lrk;','objectSpriteSets',['guard']],
  ['pn','a','(Ljava/lang/String;II)V','showResponseMessage',['message','guard','responseCode']],
  ['pn','r','(I)V','showConnectionRestoredMessage',['guard']],
  ['pn','o','(I)V','closeDialog',['guard']],
  ['pn','p','(I)Z','pollKeyEvent',['guard']],
  ['pn','a','(I[B)[B','copyByteArray',['sourceOffset','source']],
  ['qi','a','(II)V','ensureButtonCapacity',['capacity','guard']],
  ['qi','a','(Lwn;BLjava/lang/String;)Lhc;','appendButton',['listener','guard','label']],
  ['qi','a','(ZLjava/lang/String;I)V','appendActionButton',['guard','label','action']],
  ['qi','a','(IZ)V','setTickRate',['ticksPerSecond','guard']],
  ['qi','a','(II[BB)Ljava/lang/String;','decodeCp1252',['length','offset','bytes','guard']],
  ['qi','a','(IIIIIIIII)V','drawUnevenFrame',[]],
  ['tm','a','(ILjava/lang/String;Lwn;)Lhc;','appendButton',['guard','label','listener']],
  ['tm','o','(I)V','closeDialog',['guard']],
  ['tm','a','(JJ)J','bitwiseOr',['left','right']],
  ['h','a','(B)V','submitLogin',['guard']],
  ['h','j','(I)Ljava/lang/String;','identifier',['guard']],
  ['h','h','(B)V','clearCredentials',['guard']],
  ['h','a','(Ljava/lang/String;B)V','setIdentifier',['identifier','guard']],
  ['h','a','(Lmf;B)V','loadLogoMeshes',['archive','guard']],
  ['oi','j','(I)V','submitName',['guard']],
  ['oi','l','(I)Z','canSubmit',['guard']],
  ['oi','a','(Log;I)Z','isValidField',['field','guard']],
  ['oi','a','(ILjava/lang/String;IILhm;Ljava/lang/String;I)I','appendValidatedField',['guard','label','helpHeight','y','field','helpText','fieldWidth']],
  ['oi','a','(ILjava/lang/String;Lhm;IBLjava/lang/String;)I','appendStandardValidatedField',['fieldWidth','label','field','y','guard','helpText']],
  ['oi','a','(ILmf;Ljava/lang/String;Ljava/lang/String;Lmf;)Lih;','loadBinaryFont',[]],
  ['jf','a','(B)Ljava/lang/String;','linkCloseMarkup',['guard']],
  ['jf','k','(I)Ljava/lang/String;','linkOpenMarkup',['guard']],
  ['lf','a','(Ljava/lang/String;BLjava/lang/String;)Z','containsIdentifierVariant',['identifier','guard','text']],
  ['un','a','(Ljava/lang/CharSequence;IC)I','countCharacter',['text','guard','character']],
  ['un','a','(Lih;I)I','fontLineHeight',['font','guard']],
  ['un','e','(I)J','millisecondsSinceLastReceive',['guard']],
  ['ul','a','(BLjava/lang/String;)V','insertText',['guard','insertedText']],
  ['ul','b','(II)V','moveCaret',['index','guard']],
  ['ul','e','(B)V','copySelection',['guard']],
  ['ul','g','(B)V','cutSelection',['guard']],
  ['ul','h','(B)V','clearText',['guard']],
  ['ul','k','(I)V','deleteSelection',['guard']],
  ['ul','o','(I)I','nextWordBoundary',['offset']],
  ['ul','p','(I)I','previousWordBoundary',['guard']],
  ['ul','q','(I)V','pasteClipboard',['guard']],
]) method(owner,original,descriptor,to,parameters,
  'Reviewed retained fields, full primary method path, corresponding caller and virtual family. Names preserve guard branches, exception wrapping, numeric protocol actions, integer sentinel values and rendering equations.');

// Transport, scheduling, credential payloads and the remaining client helpers.
// Runtime behavior is unchanged; identifiers describe the observed wire/layout
// operations, including alternate identities whose higher-level purpose is not
// established by this fixed client alone.
fields('pj', [['f','Z','closed'],['i','Ljava/net/Socket;','socket'],['j','I','bufferCapacity'],
  ['d','I','writeIndex'],['c','Z','writeFailed'],['m','Lla;','writerTask'],
  ['l','[B','writeBuffer'],['e','Llk;','taskService'],['h','Ljava/io/InputStream;','input'],
  ['b','Ljava/io/OutputStream;','output'],['a','I','readIndex']],
  'The writer thread drains readIndex toward writeIndex, flushes when empty, reports deferred failures, and closes streams/socket once shutdown drains the queue.');
fields('qf', [['i','I','sampleIndex'],['e','J','lastSampleNanos'],['f','[J','sampleDeltas'],
  ['k','I','sampleCount'],['g','J','nextTickNanos'],['c','J','currentNanos']],
  'Nano-time sampling updates the delta ring/current time; delay and catch-up compare current time with the next scheduled tick deadline. Original sample-count behavior is retained.');
fields('km', [['m','Ljava/nio/ByteBuffer;','buffer']], 'Direct storage setter allocates this buffer and getter copies its full capacity after resetting position.');
fields('ld', [['e','Ljava/lang/String;','password'],['f','J','encodedUsername']], 'Credential writer emits the retained account-name long followed by the retained password.');
fields('bh', [['f','Ljava/lang/String;','password'],['g','Ljava/lang/String;','email']], 'Credential writer emits the retained email string followed by the retained password.');
fields('fk', [['d','I','wireId']], 'Login framing writes this tag immediately after opcode fourteen.');
fields('ei', [['g','Z','complete'],['h','[B','payload']], 'Saved-data response handling fills the queued query payload and marks completion.');
fields('sb', [['p','Lva;','urgentPending'],['l','Lva;','urgentInFlight'],
  ['j','Lva;','prefetchPending'],['n','Lva;','prefetchInFlight'],
  ['k','J','lastServiceMillis'],['e','Ln;','outgoingControl'],['f','I','idleMillis'],
  ['d','I','lastErrorCode'],['m','B','xorKey'],['g','I','failureCount'],
  ['o','Ln;','incomingHeader'],['c','Ls;','currentRequest']],
  'Urgent/prefetch capacity counts pending plus in-flight requests; socket service moves queues, accumulates idle time, parses headers and records retry error/key state.');
fields('bk', [['t','Lpj;','socket']], 'All request/control writes and response reads use this attached buffered socket.');
fields('s', [['y','B','paddingBytes'],['F','I','blockOffset'],['A','Ln;','responseBuffer']],
  'Progress excludes trailing padding bytes; response processing tracks the current 512-byte block offset and payload cursor.');
fields('nn', [['f','[Lfl;','buckets'],['d','I','bucketCount'],['b','Lfl;','lookupCursor'],['h','J','lookupKey']],
  'Lookup selects a secondary-link bucket by key mask and retains cursor/key for subsequent matches.');
fields('tg', [['ob','Ljava/lang/String;','displayName'],['lb','Ljava/lang/String;','location'],['pb','I','insertionOrder']],
  'Contact update decoding sets display name, interns nonempty location strings and assigns a monotonic insertion sequence; ordering prioritizes the current location and online entries.');
fields('bi', [['f','I','clipHeight'],['c','I','clipWidth'],['i','I','centerY'],['b','I','centerX'],
  ['a','[I','rowOffsets'],['e','[I','reciprocalQ15'],['h','[I','reciprocalQ16'],['d','[I','sineQ16'],['g','[I','cosineQ16']],
  'Clip setup derives dimensions/centers and row starts; static loops fill reciprocal and 2048-angle Q16 trig tables.');
fields('pe', [['b','I','x'],['a','I','y']], 'Minimap clipping compares horizontal/vertical raster coordinates against these pair members.');
fields('an', [['a','Z','markerSet']], 'Browser marker writer sets this in-memory flag and the cookie presence predicate checks it first.');
fields('fh', [['f','[Ljava/lang/String;','retributionLevelNames'],['h','[Ljava/lang/String;','retrievalLevelNames'],
  ['b','[Ljava/lang/String;','normalRetrievalLevelNames'],['i','[Ljava/lang/String;','simulatorLevelNames'],
  ['c','[[Ljava/lang/String;','levelNamesByMode'],['g','Lih;','gameFont'],['e','[Lia;','logoMeshes']],
  'Static level arrays are indexed by game mode to form resource names; client loading installs the game font and logo meshes. These globals are unrelated to byte-storage instances.');
fields('sf', [['e','[Lhh;','objectExplosionSamples']], 'Object sound setup assigns samples by object type, with shared samples for related infrastructure/powerups.');
fields('mb', [['f','[Led;','objectSprites']], 'Object asset loader fills this array with the fuel/crate/turret/force/TNT/gate/barrier/powerup sprites.');
fields('jm', [['K','[Led;','objectGlowSprites']], 'Object asset loader and level-object drawing use this shared per-type glow array; it is unrelated to progress-bar instances.');

for (const [owner,original,descriptor,to,parameters] of [
  ['fh','a','(I)[B','toByteArray',['guard']],
  ['fh','a','(Z[B)V','setBytes',['guard','bytes']],
  ['eo','a','(I)V','resetTiming',['guard']],
  ['eo','c','(B)J','delayMillis',['guard']],
  ['eo','a','(BJ)I','advanceTicks',['guard','tickNanos']],
  ['eo','a','(JI)I','waitAndAdvance',['tickNanos','guard']],
  ['eo','a','(Led;B)V','pushSpriteRaster',['sprite','guard']],
  ['eo','a','(IC)C','normalizeAccountCharacter',['guard','character']],
  ['qf','c','(I)J','sampleInterval',['firstSample']],
  ['vj','a','(Ln;B)V','writeTo',['buffer','guard']],
  ['vj','a','(B)Lfk;','type',['guard']],
  ['pj','c','(I)V','close',['guard']],
  ['pj','a','(B)V','checkWriteError',['guard']],
  ['pj','a','(II[BI)V','write',['length','offset','bytes','guard']],
  ['pj','b','(I)I','available',['guard']],
  ['pj','a','(I)I','readUnsignedByte',['guard']],
  ['pj','a','(II[BB)V','readFully',['offset','length','destination','guard']],
  ['sb','a','(I)V','close',['guard']],
  ['sb','a','(Z)I','urgentCount',['guard']],
  ['sb','a','(B)I','prefetchCount',['guard']],
  ['sb','c','(I)Z','isUrgentCapacityReached',['guard']],
  ['sb','b','(I)Z','isPrefetchCapacityReached',['guard']],
  ['sb','b','(B)V','resetAfterIntegrityFailure',['guard']],
  ['sb','a','(Ljava/lang/Object;ZB)V','attachConnection',['connection','loggedIn','guard']],
  ['sb','d','(I)Z','processNetwork',['guard']],
  ['sb','a','(IZBIB)Ls;','requestGroup',['archiveId','urgent','guard','groupId','padding']],
  ['bk','a','(ZZ)V','sendLoginState',['loggedIn','guard']],
  ['bk','f','(I)V','sendControlHandshake',['guard']],
  ['bk','a','(Z[BI)Ljava/lang/Object;','storeBytes',['copy','bytes','guard']],
  ['bk','a','(IZI)I','floorDivideByPositive',['divisor','guard','value']],
  ['bk','a','(IZIII)Lij;','requestHighscores',['boardId','guard','queryKind','opcode','rowLimit']],
  ['bk','g','(I)V','readContactUpdate',['guard']],
  ['fk','a','(Ljava/lang/Object;BZ)[B','extractBytes',['storage','guard','copy']],
  ['fk','a','(ILjava/lang/String;)Ltg;','findFriendByName',['guard','name']],
  ['fk','a','(ZLjava/lang/CharSequence;)Z','isDecimalText',['guard','text']],
  ['bh','a','(ZI)V','completeEmailAvailability',['available','guard']],
  ['bh','a','(IJ)Ljava/lang/String;','formatGmtTimestamp',['guard','epochMillis']],
  ['ei','a','(IZJLjava/lang/String;Ljava/lang/String;)Lvj;','createCredentials',['emailUsernameSentinel','alternateType','encodedUsername','email','password']],
  ['ld','a','(IB)V','cacheCompletionHook',['value','guard']],
  ['ld','c','(B)Lhj;','sharedPcmMixer',['guard']],
  ['ld','a','(Lik;IILij;)I','findSubmittedScoreRow',['submission','column','startRow','highscores']],
  ['km','a','(II)V','writeAchievementQuery',['opcode','guard']],
  ['km','a','(Ln;Llk;II)V','readReflectionCheck',['buffer','taskService','unused','guard']],
  ['nn','a','(JLfl;I)V','put',['key','node','guard']],
  ['nn','a','(IJ)Lfl;','get',['guard','key']],
  ['nn','a','(B)Lfl;','nextMatch',['guard']],
  ['nn','a','(Ljava/awt/Canvas;III)V','presentRaster',['canvas','y','guard','x']],
  ['bi','a','()V','updateCenter',[]],
  ['bi','b','()V','useRasterClip',[]],
  ['bi','a','(IIII)V','setClip',['left','top','right','bottom']],
  ['tg','b','(II)Ljh;','requestAchievements',['opcode','guard']],
  ['tg','a','(ILjava/lang/CharSequence;)Z','isValidAccountName',['guard','name']],
  ['ol','a','(ILol;)V','inheritOverrides',['guard','template']],
  ['ol','a','(BLjava/lang/String;)Z','isOutsidePasswordLength',['guard','password']],
  ['ol','a','(ILmf;[IILmf;)[[B','loadCampaignLevels',['guard','archive','key','mode','memberArchive']],
  ['cd','a','(ILjava/lang/String;)Ltk;','validateEmail',['missingSeparator','email']],
  ['pe','a','(I)Leo;','createTickClock',['guard']],
  ['aa','a','(ILjava/lang/String;)Z','isRepeatedCharacter',['start','text']],
  ['b','a','(I)V','updateAccountOverlay',['guard']],
  ['bc','a','(II)Lei;','requestSavedData',['opcode','guard']],
  ['wa','a','(II)V','limitTrackerGain',['maximumGain','guard']],
  ['j','a','([Ljava/lang/String;Ljava/lang/String;BI)V','completeNameAvailability',['suggestions','message','guard','responseCode']],
  ['ac','a','(I)V','pollKeyboardState',['guard']],
  ['ac','d','(I)V','closeCacheServices',['guard']],
  ['ac','a','(Ljava/lang/String;ILmf;Ljava/lang/String;Lmf;)Lab;','loadCoverageFont',['fileName','guard','spriteArchive','groupName','fontArchive']],
  ['hf','a','(I)V','pushRasterState',['guard']],
  ['hf','b','(B)Ljava/lang/String;','formatPacketDiagnostic',['guard']],
  ['hf','a','(B)Z','isResponseStage',['guard']],
  ['hf','a','(Lmf;[IIILmf;B)[B','loadLevelBytes',['archive','key','level','mode','memberArchive','guard']],
  ['hf','b','(I)[Led;','buildRgbSpritesFromSheet',['guard']],
  ['hf','a','(IC)B','encodeCp1252Character',['guard','character']],
  ['dl','a','(B)V','popRasterState',['guard']],
  ['dl','a','(Z)V','resetTooltipState',['disabled']],
  ['dl','a','(BLjava/lang/String;)Z','openWindowsUrl',['guard','url']],
  ['s','a','(B[B)[B','decompressGroup',['guard','bytes']],
  ['s','a','(B[Ljava/lang/CharSequence;)Ljava/lang/String;','joinText',['guard','parts']],
  ['EscapeVector','a','(BLhh;)V','setExtraObjectExplosionSamples',['guard','sample']],
  ['EscapeVector','a','(ILdd;)V','loadObjectExplosionSamples',['crateIndex','resampler']],
  ['EscapeVector','a','(Ljava/lang/String;IIB)V','drawOutlinedText',['text','x','baselineY','guard']],
  ['EscapeVector','a','(Ltg;Ltg;I)Z','isContactAfter',['left','right','guard']],
  ['EscapeVector','b','(Z)V','shutdownClientServices',['guard']],
  ['EscapeVector','e','(Z)V','drawLoginOrDiscardPrompt',['doubleBorder']],
  ['EscapeVector','f','(Z)V','initializeGameArchives',['guard']],
  ['EscapeVector','g','(Z)V','loadLevelSelectBackgrounds',['guard']],
  ['EscapeVector','l','(I)V','initializeMembershipPromotion',['guard']],
  ['EscapeVector','m','(B)V','loadLevelObjectAssets',['guard']],
  ['EscapeVector','n','(B)V','advanceAssetLoading',['guard']],
  ['EscapeVector','n','(I)Lca;','createMouseWheelInput',['guard']],
  ['EscapeVector','o','(I)V','loadObjectGlowSprites',['fuelIndex']],
  ['EscapeVector','p','(I)V','loadObjectSprites',['guard']],
]) method(owner,original,descriptor,to,parameters,
  'Reviewed complete implementation, argument/wire order, primary callers and virtual-family behavior in the pinned client. Names retain original guards, fallback/null/EOF behavior, queue bounds, byte encodings, deadlines and source-side effects.');

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
      'Every GameplaySession method has a reviewed name. `updateMissionOutcome`, `recordLevelResult`, `recordLevelCompletion` and `submitCampaignScore` separate mission resolution from account reporting. `levelEnded` also covers leaving without cargo; `quitRequested` and `advanceLevelRequested` drive distinct menu transitions. `recordDestructionForAchievement` counts destroyed objects, seekers and gates, rather than elapsed flight time. `updateNotices` batches tutorial and achievement messages, while `drawLevelTitle` uses a separate timer. Guard-only reader hooks retain their original no-op/arithmetic behavior.','',
      '## Terrain and level objects','',
      '`loadTerrain` reads `TerrainMap`, installs dimensions/themes/masks and calls `snapshotTerrain`. Each tile is 32 by 32 pixels. Null is empty; `QuickChatPhraseDefinition.fullTileMask` is the shared all-solid identity sentinel, whose array is empty. Partial masks are independently mutable arrays of 32 integer row masks. Four two-bit tile codes occupy each packed byte. `AccountRegistrationPanel.decodeTerrainQuadrants` and `TerrainMaskSupport.decodeTerrainQuadrant` recursively decode partial tiles; their unrelated account/UI globals are retained. Version ten adds a separate secondary theme byte.','',
      '`LevelObject` identifies a placed object by objectId/objectType and pixel x/y. Its collision sprite, display sprite and animation frame are distinct. `stampTerrain` ORs nontransparent sprite pixels into collision masks; `removeFromTerrain` clears them, copying a full sentinel before mutation. `initializeLevelObjects` stamps these objects, links gates and constructs the minimap. `buildTutorialTerrain` constructs the tutorial arena directly.','',
      '`SeekerMine` owns current/home positions, velocity and two sound handles. `RockBuster` owns Q16 motion, angle, remaining flight ticks, exhaust and flight sound. `LaserGateSpan` stores pixel leftX/rightX/y; rendering wraps the horizontal span. Destroying a LevelObject, SeekerMine, RockBuster or laser span has a distinct session method. HudMessage/hudMessageQueue retain text and display duration; pointCloudEffects is a separate effect queue.','',
      '`Bullet` retains Q16 position/velocity, kind, remaining ticks and an inactive flag. `spawnBullet` reuses the first pooled object after the active prefix before allocating; `recycleInactiveBullets` deactivates retired objects and moves them to the tail without discarding capacity. `ShipHullGeometry` retains the Q11 nose, notch and wings plus raster bounds. `hitShipAtPoint` can destroy the ship; `spriteOverlapsShipHull` is only an overlap test. `isTerrainRayClear`, `terrainTile`, `initialTerrainTile` and `maskPixelIsSolid` expose collision lookup independently of rendering.','',
      '`DynamicTerrainRenderer` is selected for terrain theme four; other themes use the session terrain path. `invalidateTileNeighborhood` marks a 3x3 region dirty following edits. `PointCloudEffect` owns per-point fixed-point motion, masks and drawing. These names do not claim that every effect or object type has been identified.','',
      '## Dialogue and shared engine','',
      '`PcmStream` defines process/mixInto/skip, firstSubstream/nextSubstream, activity and priority for all concrete audio streams. PcmStreamMixer owns its substreams and timed PcmMixerListener queue. PcmSample/PcmSampleStream/PcmResampler expose PCM bytes, loops, interpolation and resampling. AudioOutput and JavaSoundAudioOutput distinguish device lifecycle hooks from stream mixing. ReverbPcmStream uses separate ReverbCombFilter and ReverbAllPassFilter rings.','',
      '`VorbisSample` separates shared setup/bitstream tables from per-sample packets, overlap and resumable PCM output. VorbisCodebook, VorbisFloor, VorbisResidue and VorbisMapping expose the compressed-audio stages. SynthInstrument and AudioFilter synthesize envelope-controlled oscillators; SoundEffect mixes up to ten delayed instruments. SoundCache separates completed PCM from pending Vorbis decoders. PcmSampleStream names every control and all sixteen specialized mixing kernels by direction, channel count, interpolation and gain ramp. AudioOutput names scheduling, device service and shutdown; ReverbPcmStream separates wet/dry/input gains, feedback, damping and stereo width.','',
      '`ResourceArchive` consumes ArchiveProvider; CachedArchiveProvider combines Js5Transport with SectorCacheStore, BufferedRandomAccessFile and DiskCacheWorker. ArchiveIndex holds reference metadata; ArchiveRequest has separate network/disk implementations. SystemTaskService owns operating-system work represented by SystemTask. CipherPacketBuffer/IsaacRandom distinguish opcode encryption from ordinary PacketBuffer byte encodings; WhirlpoolHasher and Bzip2Decoder/Bzip2State identify archive digest and decompression work.','',
      'Every PacketBuffer, ResourceArchive and TriangleMesh method has a reviewed name. Buffer methods distinguish fixed widths, signed smarts, CP1252 string delimiters, length backpatches, CRC32, XTEA ranges, RSA and base-38 password packing. ArchiveIndex distinguishes group/file counts from sparse slot capacities; ResourceArchive separates loading, validity, named lookup and unpacking. File retention policy zero retains files, one discards the returned slot and two builds only the requested file before discarding its unpacked group. Packed-group retention is independent. TriangleMesh transforms invalidate lazy axis bounds.','',
      '`QuickChatDynamicCommand` contains a command ID and configuration parameter count, not a network opcode. `QuickChatPhraseDefinition.decode` reads text fragments, response IDs and dynamic command parameters; `previewText` joins fragments with ellipses and `markGlobalResponses` sets response bit 15. `ReflectionCheck` retains queued reflection lookup tasks and operation metadata; `writeReflectionCheckResults` waits for pending tasks, writes result/error codes plus CRC and unlinks a completed check. Unrelated static UI helpers stay on their original owners.','',
      '`DialogueScreen.advanceDialogue` handles reveal timing, input and scene changes; `drawDialogue` draws the current image/text. IntrusiveNode/IntrusiveDeque expose primary ownership and traversal; DualLinkNode has independent secondary links. Sprite/SpriteState separate RGB pixels, trimmed dimensions and offsets. SoftwareRasterizer holds the shared framebuffer and clipping. PacketBuffer and SoundEnvelope expose byte decoding and envelope interpolation.','',
      '`IterableNodeHashTable` and `NodeHashTableIterator` own primary-link buckets; `IterableDualLinkDeque` and `DualLinkDequeIterator` traverse secondary links independently. `IntrusiveDequeCursor` supports independent forward/backward scans. `WeightedLruCache` combines hash lookup, secondary recency links and entry weights; `StrongCacheEntry` is the concrete retained-value implementation. Original null-at-exhaustion behavior and throwing constructor stubs remain.','',
      '`MouseInputHandler` updates shared pending movement/click state and clears held buttons on focus loss; `DelegatingCanvas` forwards painting to its component. `SocketConnector`, `ProxySocketConnector` and `ProxyAuthenticationException` distinguish direct/proxied socket creation and HTTP 407 diagnostics. `SpriteStrip` measures/draws non-null sprites with spacing after each sprite.','',
      '`ArchiveKeyRequest`, `ProgressQuery`, `ProgressRecord`, `AchievementQuery`, `AchievementRecord`, `HighscoreQuery`, `ScoreSubmission`, `RatingQuery` and `SavedDataWrite` identify the queued protocol records. Their named writers preserve subtype/length/CRC layouts and acknowledgement ownership. Unknown encoded-word meanings remain unresolved. `DelayedServerPacket` belongs to the simulated-latency receive path.','',
      '`UiComponent` separates hitTest, hover updates, keyboard focus, pointer routing, rendering and layout. UiContainer owns children; SingleChildContainer forwards to one child; DraggableWidget and DropTargetWidget expose drag/drop roles. TextButton adds focus and actions; EditableTextWidget adds caret/selection and edit/submit notifications. TextHotspotWidget parses clickable spans into TextHotspotRegion line fragments. WidgetPainter and WidgetTextLayout retain separate drawing/layout contracts; TextLayoutLine and CachedTextLayout expose character insertion coordinates, wrapping and alignment. ButtonListener, ButtonPointerListener, WidgetHoverListener, WidgetFocusListener and TextInputListener expose callback families. The debounced validators distinguish matching text, email syntax/availability, name availability, password and age checks.','',
      '`BitmapFont` names glyph advances, string widths, markup/style state, wrapping, paragraph alignment and glyph dispatch. `BinaryBitmapFont` treats any nonzero mask byte as solid; `CoverageBitmapFont` blends byte coverage and uses binary masks for shadows. Native probes retain exact signed pixel integers, including high-byte differences between solid and alpha paths. `DialWidget.decodeSpriteSheet` names the shared footer/palette/index/alpha decoder and its global decode arrays.','',
      'Every SoftwareRasterizer, Sprite and ArgbSprite method has a reviewed name. Raster operations distinguish outlines/fills, alpha, gradients, clipping, darkening, grayscale and separable blur. Sprite paths distinguish transparent-zero copies, brightness, destination alpha, additive blending, silhouette, multiplication and two grayscale tint modes. Scaling distinguishes nearest-neighbor, area downsampling and bilinear rotation; Q4 pivots/destinations, the 65536-angle cycle and Q12 scale are explicit in transform parameters. ArgbSprite retains per-pixel high-byte coverage. UiTheme identifies default widget painters and single-line/wrapped tooltip layout. These names preserve the original equations and guard paths; they do not claim whole-renderer pixel equivalence beyond the existing focused probes.','',
      '`ModalStack` keeps open panels in focus order and draws them back-to-front. `ModalPanel` fades the first open panel in and other panels out, retaining closed panels until their alpha reaches zero. `ResizableModalPanel` adds eased resizing; `ContentTransitionDialog` fades old content out, resizes, installs pending content and fades it in through `AlphaContainer`. `LoginDialog`, `LoadingProgressDialog`, `AccountRequestDialog`, `RegistrationRequestDialog` and `AccountNoticeDialog` identify the concrete flows. `StripedProgressBar` retains Q16 completion and scrolling shaded stripe/cap sprites.','',
      '`StatefulTextPainter` combines six `WidgetStyleLayer` slots: base, selected, hovered, pressed, disabled and focused. A layer can flush the accumulated drawing before applying its own overrides; unset sentinel values are preserved. `Checkbox` toggles the selected flag; `LinkButtonPainter` and `PasswordFieldPainter` provide underlined links and masked password display. `LabeledField` reserves space for wrapped labels. `LoginForm`, `DisplayNameForm`, `AccountChoicePanel`, `AccountMessagePanel`, `AccountTermsPanel` and `ValidationHelpWidget` identify account UI roles. Shared container focus/add/layout/debug traversal and text insertion, caret, selection and clipboard operations now have reviewed names. Unrelated static helpers and unresolved fields are still tracked separately.','',
      'Every EscapeVector method now has a reviewed name. `advanceAssetLoading` steps through fonts/sprites, sound effects, tracker music, level data and menu/controller setup. `initializeGameArchives`, `loadLevelObjectAssets`, `loadObjectSprites`, `loadObjectGlowSprites` and `loadObjectExplosionSamples` identify separate loading operations. `drawLoginOrDiscardPrompt` draws the unauthenticated progress choice. The original archive release points and loading side effects are retained.','',
      '`BufferedSocket` reads synchronously and queues writes for its worker thread; closed/EOF/deferred-error behavior and the original ring-buffer reserve are unchanged. `SocketJs5Transport` separates urgent/prefetch pending and in-flight queues, connection/control frames, chunk decoding, idle timeout and integrity retries. `TickClock` and `NanoTickClock` distinguish waiting, time sampling and bounded tick catch-up. `ByteStorage`/`DirectByteStorage` distinguish heap arrays from copied direct-buffer contents. `LoginCredentials`, `UsernameCredentials`, `EmailCredentials`, `AlternateUsernameCredentials` and `LoginCredentialType` expose payload encodings and the wire tag; the alternate username type has the same payload and an unresolved higher-level purpose.','',
      '`SavedDataQuery`, `SecondaryNodeHashTable` and `ContactEntry` identify queued account data, secondary-link lookup and location-aware contact ordering. `LegacyStyleNode` and `LegacyWidgetStyle` retain the original contact inheritance and unused style slots; no hierarchy is rewritten. `MeshRasterState` and `MinimapPoint` expose raster row offsets, trig/reciprocal tables and clipping coordinates. `LoginStage` retains the original identity-based login transitions alongside unrelated helpers. Raster push/pop, CP1252 encoding, browser marker state, keyboard polling, cache-service closure and account-overlay updates now have reviewed names. Unsupported/unknown static helpers remain tracked by the coverage audit.','',
      '`LegacyTextBlock`, `PairedTextColumns`, `SpriteLabelColumns`, `LegacyMenuColumn` and `LegacyButton` expose the older fixed-viewport layout path. They retain original spacing, width-mode, truncation and guard behavior. `NineSliceFrame`, `ThreeSliceButtonPainter`, `GradientOutlineTextPainter`, `SpriteCheckboxPainter`, `MarkerSliderPainter` and `DialWidgetPainter` identify distinct drawing roles. `MarkerSlider` edits values in `GrowableIntList`; `DialWidget` quantizes pointer angles. `LoginMethod` and `EmailValidationError` distinguish cookie identity from validation error tokens.','',
      '`releaseStatics` names explicitly reviewed cleanup declarations throughout the client; it releases shared references rather than instance state. Original conditional exits, guard arithmetic, calls and exception handling remain unchanged. These scattered cleanup routines do not establish the roles of their still-opaque containing classes.','',
      '## Reproduce and verify','',
      'From dekobloko-work:','',
      '```sh','node readable/build-escapevector-rules.mjs --check','node readable/reproduce-escapevector.mjs --update',
      'node readable/reproduce-escapevector.mjs --check','node scripts/check-source-catalog.mjs ../funorb-decompiled',
      'node readable/naming-coverage.mjs escapevector',
      'node readable/tests/test-escapevector-core.mjs /path/to/original/escapevector.jar','```','',
      'The exact raw input is pinned to Git. Existing generic java-tools declaration and decision proofs run across every file from a verified compiler-source archive, without game assumptions or compiler flags. Each stage is checked for determinism and idempotence, and its hashes/counts are retained in the current dictionary. Naming binds declarations/references/overrides, compiles the complete raw/named corpus and retains reversible edits. No generated sources or binary dependencies are stored in Deko.','',
      'Native fixtures compare historical, prepared and named implementations against independent expectations for versioned terrain headers, empty/full/partial masks, sprite collision stamping/removal and deque transfers. Independently authored complete level streams cover versions zero through eleven, exact byte consumption, target/countdown/frame boundaries, seeker positions, powerup filtering, fuel/shield defaults and objective/gravity whitelists. Widget fixtures check hit-test boundaries/origins, hover versus keyboard focus, virtual focus traversal and the Enter action callback. Text geometry fixtures check insertion indices across lines, midpoint ties, vertical hit-test gaps, markup-aware justification and empty/null layouts. Audio fixtures check LSB-first bits/cursors, packed floats, canonical codebooks, floor interpolation, mapping mux, packet length extensions/loop flags, oscillator boundaries, empty effects and filter unity. PCM fixtures exercise all sixteen direction/channel/interpolation/ramp kernel combinations and pan endpoints. Session fixtures verify bullet state, active-prefix recycling/reuse, wrapped current/initial terrain, ray/mask boundaries, hull half/notch geometry, RGB/countdown interpolation and 50-tick clocks. Packet/metadata fixtures check wire widths, smart boundaries, backpatches, CP1252 strings, CRC32 corruption, XTEA/RSA/password vectors, account-name policy, mesh bounds, quick-chat parameters and pending/completed reflection framing. Archive fixtures cover versions five through seven, sparse named multi-file chunks and every packed/unpacked retention policy. Collection fixtures check collision buckets, iterator removal, independent link ownership/cursors, weighted eviction/replacement and null-value refunds. Input fixtures check mouse/button/focus/popup/detached state and Canvas delegation. Request fixtures specify bytes after the ISAAC opcode, including lengths/subtypes/CRCs, enqueue ownership and wrapping submission IDs. Exception rejection probes compare underlying causes because native diagnostics may wrap the same IllegalStateException. Font/legacy UI fixtures cover binary and coverage kernels, alpha endpoints/signed pixel bits, clipping and masks, markup metrics and style resets, column/button geometry, all menu width modes, list growth, nine-slice rasterization and row/column-major sprite sheets with optional alpha. The fixed original gamepack passes all 3,232 assertions too. These focused checks do not prove whole-game behavior, multiplayer compatibility or frame rate. The original mutable obfuscationControl and guard branches remain; unsupported structural recovery and unresolved local names still need review.',''].join('\n');
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
