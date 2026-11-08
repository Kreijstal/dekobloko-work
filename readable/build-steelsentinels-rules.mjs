import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {archivedInput, digest, funorbRepository, verifyToolPin, workflowRoot} from './game-export.mjs';

const SOURCE_COMMIT = '56c18e5fa3eda13b7324b0df50a3746fc39e3242';
// Evidence below refers to this immutable Java input, not to another game's map.
const classes = {
  jl:['ArchiveIndex','Versions 5–7 decode group/file IDs, revisions, CRCs, optional names and 64-byte digests.'],
  jk:['IntKeyLookup','Open-addressed integer key table returning original input indices, with linear probing.'],
  cm:['ResourceArchive','Lazy archive index, packed group storage, unpacked file storage and named resource lookup.'],
  fa:['ArchiveProvider','Abstract archive-index, encoded-group and group-progress contract.'],
  fi:['CachedArchiveProvider','Validates archive indexes and group responses from disk caches and the resource protocol client.'],
  ee:['CombatWorld','Owns terrain, sentinel/projectile/effect collections, simulation ticks and synchronization checksum.'],
  mb:['Sentinel','Player/team IDs, fixed-point position, velocity, chassis, modules, armour, charge and combat controls.'],
  nb:['GameplayController','Owns CombatWorld, player selection, trajectories, input and game rendering.'],
  ji:['SentinelDesigner','Engineering and construction UI, option tables and part configuration editing.'],
  hd:['BattleTerrain','Seed-derived terrain profiles, clamped profile accessors and spawn positions.'],
  wl:['Projectile','Position, velocities, source sentinel, affected sentinels and projectile collision/update paths.'],
  jb:['Explosion','Created by projectile/ability paths with radius, force and affected sentinel state.'],
  qb:['ParticleEffect','Short-lived visual effects with world position, velocity and age.'],
  je:['SentinelCommand','Action type, subtype, start/end ticks and activation state consumed by Sentinel control paths.'],
  nk:['ArticulatedPart','Sprite-backed component with attached part instructions, rotation, component ID and recursive property aggregation.'],
  qd:['PartInstruction','Part attachment, instruction metadata, optional part name and recursive copy.'],
  ck:['IntrusiveNode','Two neighbour links, collection key and unlink.'],
  kd:['DualNode','Second pair of intrusive links and unlink, in addition to IntrusiveNode.'],
  ul:['NodeDeque','Sentinel, prepend/append, traversal and size.'],
  ra:['DualNodeDeque','Sentinel and traversal over the second intrusive links.'],
  jc:['NodeIterator','Independent traversal cursor over NodeDeque.'],
  uh:['NodeHashTable','Power-of-two bucket sentinels, long-key lookup, intrusive insertion and bucket traversal.'],
  gi:['PacketBuffer','Byte payload, position and primitive reads/writes.'],
  kj:['CipherPacketBuffer','Ciphered opcodes and bit-position reads on PacketBuffer.'],
  ie:['IsaacRandom','256-word ISAAC generator; used for opcode encryption and seeded world generation.'],
  ea:['Sprite','Sprite dimensions/offsets and abstract drawing operation.'],
  wk:['RgbSprite','Integer pixel array and clipped blits to SoftwareRaster.'],
  gk:['IndexedSprite','Palette, byte pixel indices and conversion to RgbSprite.'],
  pb:['SoftwareRaster','Global pixel target, dimensions, clip bounds and drawing operations.'],
  mi:['BitmapFont','Glyph metrics, markup-aware text widths and rendering.'],
  lg:['GameApplet','Applet lifecycle, game loop and AWT listeners.'],
  n:['FunOrbClient','Common client lifecycle and connection/UI coordination beneath SteelSentinels.'],
  gh:['SceneWidget','Widget dimensions, position, parent/child links and UI dispatch.'],
};
// Shared FunOrb engine classes. Each entry was matched by token shape against
// the reviewed Escape Vector / GeoBlox class and then read in this game.
function engine(entries) {
  for(const [owner,to,evidence] of entries) {
    if(classes[owner]) throw new Error('Duplicate class rule: '+owner);
    classes[owner]=[to,evidence];
  }
}
// Audio, codecs and platform bridges.
engine([
  ['md','AbstractPcmSample','Empty node base for PCM samples carrying only an integer tag.'],
  ['sk','PcmSample','Mono byte sample with sample rate, loop start/end and loop flag.'],
  ['we','PcmStream','Abstract mixable stream: active flag, next stream, mix/skip callbacks.'],
  ['em','PcmSampleStream','Resampling sample-playback stream with loops, pitch and volume ramps.'],
  ['wg','PcmStreamMixer','Mixes a chain of PcmStream children into an int buffer.'],
  ['tb','AudioOutput','Abstract PCM output device buffering mixed int samples.'],
  ['sc','JavaSoundAudioOutput','AudioOutput backed by javax.sound.sampled SourceDataLine.'],
  ['bo','NativeAudioBackend','Empty marker interface for the legacy DirectSound backend.'],
  ['gg','LegacyDirectSoundBackend','Microsoft-JVM DirectSound initialiser implementing NativeAudioBackend.'],
  ['mf','AudioFilter','Sound-effect filter coefficients with pole/zero evaluation and interpolation.'],
  ['kl','SoundEnvelope','Segmented amplitude/frequency envelope read from a PacketBuffer.'],
  ['p','SynthInstrument','Synthesised instrument voice built from envelopes, filters and oscillators.'],
  ['mh','SoundEffect','Loads a bundle of SynthInstrument voices and renders them to a PcmSample.'],
  ['uk','VorbisSample','Ogg Vorbis stream decoder producing PCM samples.'],
  ['sd','VorbisCodebook','Vorbis codebook: lengths, VQ lookup and Huffman-style decode.'],
  ['pj','VorbisFloor','Vorbis floor type 1 curve decoder.'],
  ['rk','VorbisResidue','Vorbis residue partition decoder.'],
  ['wf','VorbisMapping','Vorbis channel-to-submap mapping record.'],
  ['oi','Bzip2Decoder','Bzip2 block decompressor with Huffman tables and inverse BWT.'],
  ['m','HuffmanDecoder','Canonical Huffman code table builder and bit decoder.'],
  ['ig','WhirlpoolHasher','Whirlpool digest state and block transform.'],
  ['ii','ArraySupport','Static array copy, fill and conversion helpers.'],
  ['fh','BinaryBitmapFont','BitmapFont whose glyphs are one-bit masks.'],
  ['ld','PaletteBitmapFont','BitmapFont whose glyph pixels are palette indices.'],
  ['u','CoverageBitmapFont','BitmapFont whose glyphs are antialiasing coverage bytes.'],
  ['ek','ArgbSprite','RgbSprite subclass with per-pixel alpha channel and alpha blits.'],
  ['th','CursorController','AWT cursor creation and visibility bridge.'],
  ['vj','MicrosoftCursorController','Microsoft-JVM com.ms.dll cursor callback.'],
  ['pk','MicrosoftDisplayController','Microsoft-JVM DirectDraw display-mode enumerator and switcher.'],
  ['ga','FullscreenDisplayController','GraphicsDevice fullscreen window and display-mode list/restore.'],
  ['hn','JavaScriptBridge','netscape.javascript.JSObject call/eval wrappers.'],
  ['wj','SystemTask','Request record with result/status/argument written by the SystemTaskService thread.'],
  ['pn','SystemTaskService','Background thread executing queued system tasks (sockets, URLs, files, window).'],
  ['db','SocketConnector','Holds host/port and opens a java.net.Socket.'],
  ['r','ProxySocketConnector','SocketConnector tunnelling through HTTP/SOCKS proxies with authentication.'],
  ['vg','ProxyAuthenticationException','IOException raised for proxy authentication failures.'],
  ['fk','BoundedUrlRequest','Runnable URL download capped to a byte limit.'],
  ['sn','BoundedRandomAccessFile','RandomAccessFile wrapper that enforces a length limit.'],
  ['wm','CacheFileLocator','Resolves cache file paths for the installed client.'],
  ['he','RasterBuffer','Abstract int pixel buffer shared with an AWT image.'],
  ['kn','BufferedImageRasterBuffer','RasterBuffer drawing through a BufferedImage with DirectColorModel.'],
  ['ti','ImageProducerRasterBuffer','RasterBuffer exposed as a java.awt.image.ImageProducer.'],
]);
// Widget toolkit, listeners, painters, validators, account forms and
// JS5/disk-cache plumbing. Identified by hierarchy and field-type agreement
// with the reviewed Escape Vector classes, then checked against this code.
engine([
  ['tn','UiListener','Empty root of the widget listener interfaces.'],
  ['ae','ButtonListener','Listener receiving a TextButton action with button code and local coordinates.'],
  ['gn','ButtonPointerListener','ButtonListener extension with pointer press and release callbacks.'],
  ['fd','TextInputListener','Listener for EditableTextWidget text changes and submissions.'],
  ['bn','WidgetDragListener','Listener notified while a DraggableWidget is dragged.'],
  ['hi','WidgetDropListener','Listener notified when a DraggableWidget is dropped on a DropTargetWidget.'],
  ['cg','TextHotspotListener','Listener for hotspot activation inside a TextHotspotWidget.'],
  ['oj','NameSuggestionListener','Callbacks for choosing a suggested name and requesting more suggestions.'],
  ['qn','ValidationProvider','Exposes the ValidationSource behind a text widget.'],
  ['tl','ValidationSource','Validation state, message and refresh contract for a text field.'],
  ['qk','WidgetPainter','Painter contract invoked by UiComponent for a widget.'],
  ['eg','WidgetTextLayout','Text measurement and placement contract used by WidgetPainter implementations.'],
  ['lm','UiContainerMarker','Empty marker interface for widgets that contain other widgets.'],
  ['sm','ViewportResizeListener','Resize callback with windowed flag, width and height.'],
  ['lh','UiComponent','Widget base: bounds, text, tooltip, hover, listener, painter, focus and pointer/key dispatch.'],
  ['ug','SingleChildContainer','UiComponent wrapper that forwards layout, input and drawing to one child.'],
  ['dl','UiContainer','UiComponent holding a NodeDeque of children with focus traversal and drawing layers.'],
  ['oa','TextButton','Focusable UiComponent with enabled, selected and tab-stop flags and action notification.'],
  ['jf','EditableTextWidget','TextButton with caret, selection, clipboard and text-changed/submit notification.'],
  ['bc','ValidatedTextWidget','EditableTextWidget exposing a ValidationSource.'],
  ['ma','TextHotspotWidget','TextButton that tracks hotspot regions in laid-out text.'],
  ['vl','TextHotspotRegion','Rectangle with hotspot ID linked into a TextHotspotWidget fragment list.'],
  ['h','DraggableWidget','SingleChildContainer that follows the pointer and notifies drag listeners.'],
  ['d','DropTargetWidget','SingleChildContainer that accepts drops from DraggableWidget.'],
  ['hc','LabeledField','SingleChildContainer drawing a coloured label beside its child.'],
  ['ka','ModalStack','SingleChildContainer maintaining the stack of open modal panels.'],
  ['ui','AlphaContainer','SingleChildContainer drawing its child at a fixed alpha.'],
  ['bb','ModalPanel','UiContainer panel with alpha fade and a ModalStack owner.'],
  ['ac','ResizableModalPanel','ModalPanel that animates between initial and target sizes.'],
  ['gd','ContentTransitionDialog','ResizableModalPanel that fades pending content in and out between sizes.'],
  ['k','AccountRequestDialog','Dialog showing account request progress and server response.'],
  ['fg','RegistrationRequestDialog','AccountRequestDialog that owns the AccountRegistrationPanel.'],
  ['jd','AccountNoticeDialog','ResizableModalPanel with a message and close TextButton.'],
  ['ki','LoadingProgressDialog','ResizableModalPanel with description, status text and StripedProgressBar.'],
  ['bf','LoginDialog','ContentTransitionDialog subclass used for the login form.'],
  ['nj','AccountTermsPanel','Terms text hotspots with continue button that opens the RegistrationRequestDialog.'],
  ['pm','LoginForm','Identifier and password EditableTextWidgets with submit, create and secondary buttons.'],
  ['qc','DisplayNameForm','ValidatedTextWidget name field with NameSuggestionsPanel and submit/cancel buttons.'],
  ['ij','NameSuggestionsPanel','Row of suggestion buttons that notifies a NameSuggestionListener.'],
  ['pd','AccountChoicePanel','Three-button panel for guest, back and create-account choices.'],
  ['bm','AccountMessagePanel','Message text with a configurable button array and AccountRequestDialog owner.'],
  ['vi','AccountRegistrationPanel','Registration form with validated email and name fields, terms hotspot and suggestions.'],
  ['v','DebouncedValidator','ValidationSource that waits for a quiet period before re-validating.'],
  ['ia','TextFieldValidator','DebouncedValidator bound to an EditableTextWidget.'],
  ['tk','MatchingTextValidator','TextFieldValidator comparing its field to another EditableTextWidget.'],
  ['vm','PasswordValidator','TextFieldValidator holding the identifier and email fields for password checks.'],
  ['ei','NameAvailabilityValidator','TextFieldValidator caching the last checked name and request state.'],
  ['nm','EmailAvailabilityValidator','TextFieldValidator with a MatchingTextValidator, cached email and request state.'],
  ['cn','TextWidgetPainter','WidgetPainter and WidgetTextLayout with font, insets, colours and alignment.'],
  ['ag','GradientOutlineTextPainter','TextWidgetPainter that draws outlined gradient text.'],
  ['li','PasswordFieldPainter','Outlined text painter for masked password entry.'],
  ['wa','StatefulTextPainter','TextWidgetPainter choosing WidgetStyleLayer sets per widget state.'],
  ['kh','ThreeSliceButtonPainter','TextWidgetPainter drawing a left/middle/right sprite button.'],
  ['ke','WidgetStyleLayer','Sprite and frame-sprite layer with offsets, alpha and text colours.'],
  ['b','DialWidgetPainter','WidgetPainter for the circular dial widget.'],
  ['bl','LinkButtonPainter','WidgetPainter drawing underlined link text.'],
  ['pf','CheckboxPainter','WidgetPainter with box, tick and label colours.'],
  ['qg','MarkerSliderPainter','WidgetPainter for the slider track and markers.'],
  ['s','SpriteCheckboxPainter','Stateless sprite-based checkbox WidgetPainter.'],
  ['ff','ValidationHelpWidget','TextHotspotWidget showing animated validation help for a ValidationSource.'],
  ['lk','ValidationIndicator','TextButton showing the state of a ValidationSource.'],
  ['um','MarkerSlider','TextButton slider with a GrowableIntList of markers.'],
  ['nl','DialWidget','TextButton circular dial with radius, centre, step count and value.'],
  ['sb','Checkbox','TextButton subclass with no extra state.'],
  ['bk','StripedProgressBar','UiComponent drawing an animated striped bar with cap masks.'],
  ['g','GrowableIntList','Growable int array with append and indexed access.'],
  ['a','MouseWheelInput','Abstract mouse-wheel polling contract.'],
  ['mk','MouseWheelHandler','MouseWheelListener accumulating rotation for polling.'],
  ['wc','MouseInputHandler','AWT mouse listener recording position and button state.'],
  ['i','GameKeyHandler','AWT key and focus listener queueing key events.'],
  ['nn','FullscreenFocusCanvas','AWT Canvas that restores focus for fullscreen mode.'],
  ['pi','DelegatingCanvas','AWT Canvas delegating painting to the owning applet.'],
  ['od','ClientException','RuntimeException carrying the wrapped throwable and context text.'],
  ['q','IterableNodeHashTable','Intrusive hash buckets with long keys and Iterable traversal.'],
  ['l','NodeHashTableIterator','Iterator over IterableNodeHashTable buckets.'],
  ['hb','IterableDualNodeDeque','Iterable deque over secondary DualNode links.'],
  ['wh','DualNodeDequeIterator','Iterator over IterableDualNodeDeque.'],
  ['gb','ByteStorage','Abstract byte-array storage contract.'],
  ['ge','DirectByteStorage','ByteStorage backed by a plain byte array.'],
  ['al','TickClock','Abstract game tick clock.'],
  ['gl','NanoTickClock','TickClock driven by System.nanoTime.'],
  ['bg','WeightedCacheEntry','DualNode cache entry with weight accounting.'],
  ['le','StrongCacheEntry','WeightedCacheEntry holding a strong value reference.'],
  ['kc','DelayedServerPacket','Packet payload, opcode and ready time queued for delayed handling.'],
  ['ua','ReflectionCheck','Queued reflection probe with field/method tasks, operations and recorded errors.'],
  ['aj','RasterSnapshot','Saved pixel array with clip bounds and size.'],
  ['vb','GzipDecoder','Inflater-based gzip decompressor.'],
  ['nh','Bzip2State','Mutable Bzip2 block state referenced by Bzip2Decoder.'],
  ['an','AudioService','Runnable thread that drives AudioOutput devices via SystemTaskService.'],
  ['ll','UiTheme','Shared painters, tooltip metrics and fonts for widgets.'],
  ['jg','ViewportController','Window/viewport size limits, resize listener and auto-resize state.'],
  ['de','LoginMethod','Login method record with display name and credential handling.'],
  ['ng','MembershipPromotionScreen','Members expansion screen with screenshots, price sprites and transitions.'],
  ['rm','MenuInputState','Keyboard/pointer menu selection state.'],
  ['ab','MidiFileReader','Reads MIDI track chunks with delta times and running status.'],
  ['tg','MusicTrack','Raw MIDI bytes with a NodeHashTable of patch usage.'],
  ['bj','MusicPatchEnvelope','Envelope table referenced by MusicPatch.envelopes.'],
  ['hj','MusicPatchNode','Per-note voice node of MidiPcmStream: IntrusiveNode referenced by the channel note tables.'],
  ['ca','MusicPatch','Instrument patch holding note-to-sample mappings and envelopes.'],
  ['ic','MidiPcmStream','PcmStream that sequences MIDI tracks through patch voices.'],
  ['ej','MusicPatchPcmStream','PcmStream rendering the voices of one MusicPatch.'],
  ['fe','ArchiveRequest','DualNode archive request with completion flag, progress and data accessors.'],
  ['df','DiskCacheRequest','ArchiveRequest backed by the SectorCacheStore.'],
  ['qa','Js5NetworkRequest','ArchiveRequest awaiting a JS5 response buffer.'],
  ['vk','Js5Transport','Abstract JS5 request queues and response buffers.'],
  ['f','SocketJs5Transport','Js5Transport over a BufferedSocket.'],
  ['sg','BufferedSocket','Threaded buffered socket reader/writer.'],
  ['ta','Js5ArchiveManager','Owns transports, caches and RSA keys for archive access.'],
  ['rc','SectorCacheStore','Sector-based cache file store with index and data files.'],
  ['rj','BufferedRandomAccessFile','Read/write buffered wrapper over BoundedRandomAccessFile.'],
  ['cb','DiskCacheWorker','Thread servicing queued DiskCacheRequests.'],
  ['ub','SoundCache','Loads and caches PcmSamples and SoundEffects from archives.'],
]);
// Lobby widget toolkit (SceneWidget subclasses), matched to Armies of Gielinor
// ClientUiComponent subclasses by field types and cross-references.
engine([
  ['dh','SceneWidgetNode','DualNode base of SceneWidget; no state of its own.'],
  ['lb','VerticalScrollbar','SceneWidget with thumb, track, up/down buttons and page areas plus a repeat counter.'],
  ['kg','ScrollContainer','SceneWidget pairing content and viewport widgets with a VerticalScrollbar.'],
  ['td','ReportAbuseDialog','SceneWidget dialog with offence buttons, a mute IconLabelControl and target-name buffer.'],
  ['id','IconLabelControl','SceneWidget combining an icon widget and a label widget.'],
  ['qh','IconTextComponent','SceneWidget combining an icon widget and a text widget; QuickChatMenu items.'],
  ['mg','QuickChatMenu','SceneWidget menu holding IconTextComponent items and nested QuickChatMenu submenus.'],
  ['ol','QuickChatHelpDialog','SceneWidget dialog with a single close widget.'],
  ['el','AccountNamePrompt','SceneWidget prompt with instruction text, name input widget and name buffer.'],
  ['mj','TabbedPanel','SceneWidget with tab buttons, panels array and active tab index.'],
  ['ql','SocialListPanel','SceneWidget with add/remove buttons, list content and a ScrollContainer.'],
  ['ah','SocialListEntry','SceneWidget row with account/display names, locations and order index.'],
  ['ao','QuickChatPhraseDefinition','DualNode phrase with text fragments, command ids/arguments and linked phrase ids.'],
  ['mn','QuickChatCategory','DualNode category with title, shortcuts, subcategory and phrase ids.'],
]);
// Remaining shared engine classes plus two gameplay tools.
engine([
  ['sj','MusicCrossfadeStream','PcmStream holding two MidiPcmStream sequencers and cross-fading between tracks.'],
  ['nc','WeightedLruCache','Weighted LRU cache of WeightedCacheEntry values keyed by long.'],
  ['oe','QuickChatPhraseCache','Loads QuickChatPhraseDefinition records from local/global archives into a WeightedLruCache.'],
  ['co','QuickChatCategoryCache','Loads QuickChatCategory records from local/global archives into a WeightedLruCache.'],
  ['ha','DateInputWidget','Abstract UiContainer date entry exposing a DateOfBirthValidator.'],
  ['re','NumericDateInputWidget','DateInputWidget made of day, month and year EditableTextWidgets.'],
  ['vn','DateOfBirthValidator','DebouncedValidator checking the year range 1890..current against a DateInputWidget.'],
  ['da','TextLayout','Abstract text layout holding an array of TextLayoutLine.'],
  ['si','CachedTextLayout','TextLayout caching wrapped text for a font and width.'],
  ['il','TextLayoutLine','Line extent record with top, bottom and per-character insertion x positions.'],
  ['me','LoginCredentials','Abstract login credential base.'],
  ['fb','UsernameCredentials','LoginCredentials with encoded username and password.'],
  ['pg','AlternateUsernameCredentials','UsernameCredentials variant with no extra state.'],
  ['on','EmailCredentials','LoginCredentials with email and password strings.'],
  ['qj','SentinelAnimationEditor','Developer tool editing and printing per-frame Sentinel animation data (idle, walk, jump, air, climb).'],
  ['bh','SentinelCommandSimulator','Snapshot copied from a Sentinel that replays SentinelCommands ahead of the live world and draws the predicted path.'],
]);
// Gameplay classes read from their only construction/use sites.
engine([
  ['ne','FallingPickup','DualNode created by CombatWorld above the arena (y=-180000) at a random x; collecting it adds score, lives, speed or armour bonuses to a Sentinel by pickup type.'],
  ['fl','TeamColourTinter','Static helper that recolours grey pixels of a raster region using Sentinel.getTeamColour.'],
]);
const members={};
function field(owner,original,descriptor,to,evidence) {
  members[`F:${owner}.field_${original}:${descriptor}`]={to,evidence};
}
function method(owner,original,descriptor,to,evidence,parameters) {
  const key=`${owner}.${original}${descriptor}`;
  // Constructor names follow their owning class; only their parameters have
  // independent identities to rename.
  if(original!=='<init>')members['M:'+key]={to,evidence};
  for(const [ordinal,name] of Object.entries(parameters||{}))members[`P:${key}#${ordinal}`]={to:name,evidence};
}
for(const [original,to,type] of [
  ['xc','world','Lee;'],['hc','worldX','I'],['Gb','worldY','I'],
  ['K','velocityX','I'],['ab','velocityY','I'],['Bb','playerId','I'],['jc','teamId','I'],
  ['Zb','chassis','Lnk;'],['gb','weaponParts','[Lnk;'],['Z','animatedParts','[Lnk;'],
  ['nb','moduleTypes','[I'],['s','moduleCount','I'],['rc','activeModuleType','I'],
  ['Eb','maximumArmour','I'],['rb','armour','I'],['Tb','charge','I'],['x','maximumCharge','I'],
  ['B','pendingCommands','Lul;'],['Ec','secondaryCommands','Lul;'],
]) field('mb',original,type,to,'Sentinel constructor, configure-design path, physics, module checks, armour/charge changes and world checksum.');
for(const [original,to,type] of [
  ['ab','terrain','Lhd;'],['K','sentinels','Lul;'],['r','simulationTick','I'],
  ['D','random','Lie;'],['bb','playerNames','[Ljava/lang/String;'],['kb','playerCount','I'],
  ['Q','computerPlayerCount','I'],['Y','mapSeed','I'],['y','spawnedSpecialSentinel','Lmb;'],
  ['T','projectiles','Lul;'],['u','explosions','Lul;'],
]) field('ee',original,type,to,'CombatWorld constructor and per-tick sentinel/projectile/explosion iteration.');
members['F:ee.field_y:Lmb;'].evidence='World update spawns the special oh.field_h design, stores it here and checks its score for progression. This is not the local controlled sentinel.';
field('nb','X','Lee;','world','GameplayController coordinates this CombatWorld.');
field('nb','C','Lmb;','controlledSentinel','GameplayController applies player controls and draws overlays for this sentinel.');
field('hd','n','I','profileLength','Clamped profile accessors and terrain construction.');
field('hd','m','[I','groundHeightProfile','Sentinel spawn/ground contact uses this height profile with inverted world Y.');
field('hd','e','[I','secondaryHeightProfile','Parallel terrain height profile; finer geometry role unresolved.');
field('hd','f','[I','surfaceProfile','Third parallel terrain profile; finer surface encoding unresolved.');
field('hd','b','I','terrainType','Map seed modulo-eight layout choice and getTerrainType accessor.');
field('hd','o','[I','spawnPositions','World creates boundary/spawn effects from this coordinate table.');
for(const [original,to,type] of [
  ['B','world','Lee;'],['U','worldX','I'],['A','worldY','I'],
  ['X','sourceSentinel','Lmb;'],['fb','affectedSentinels','[Lmb;'],['Z','ageTicks','I'],
  ['y','sourceWeaponType','I'],['C','effectType','I'],
]) field('wl',original,type,to,'Projectile constructor and update/collision paths.');
members['F:wl.field_y:I'].evidence='Sentinel firing passes ArticulatedPart.componentId - 17; special effects use negative markers. Preserves the original encoding.';
field('jb','Z','Lee;','world','Explosion constructor stores its CombatWorld.');
field('jb','I','Lwl;','projectile','Explosion constructor links the originating projectile.');
field('qb','z','Lee;','world','Particle effect factory stores its CombatWorld.');
for(const [original,to,type] of [
  ['s','actionType','I'],['A','actionVariant','I'],['x','startTick','I'],
  ['r','endTick','I'],['z','activated','Z'],
]) field('je',original,type,to,'SentinelCommand constructor derives end tick and activation by action type/variant.');
field('nk','I','[Lqd;','instructions','Articulated part constructors, recursive copy, property sums and rendering.');
field('nk','R','Lgk;','sprite','Articulated part constructors store its indexed sprite.');
field('nk','N','I','componentId','Used by component name/ID lookup and design editing.');
field('nk','y','I','rotation','Interpolated animation writes angles into this field.');
field('qd','d','Lnk;','attachedPart','Recursive instruction copies clone this attached part.');
field('qd','v','Ljava/lang/String;','partName','String constructor and recursive component name lookup.');
field('qd','e','I','armourContribution','ArticulatedPart sums this property recursively to obtain maximum armour.');
field('ck','k','Lck;','next','Deque forward traversal follows this link.');
field('ck','i','Lck;','previous','Unlink updates both neighbouring links.');
field('ck','j','J','key','Intrusive collection key.');
field('kd','o','Lkd;','dualNext','Dual-node traversal link.');
field('kd','v','Lkd;','dualPrevious','Dual unlink updates both neighbouring secondary links.');
field('ul','e','Lck;','sentinel','Deque constructor and end-of-traversal checks.');
field('ul','i','Lck;','traversalCursor','Deque first/next cursor.');
field('gi','t','[B','payload','Primitive packet serialization uses this byte array.');
field('gi','p','I','position','Primitive packet reads/writes advance this cursor.');
field('SteelSentinels','G','I','obfuscationControl','Shared opaque branch-control integer.');

method('ee','b','(B)V','advanceSimulation','Updates sentinel/projectile state and advances simulationTick.',{0:'obfuscationGuard'});
method('ee','b','(Z)I','computeSyncChecksum','Aggregates sentinel positions, velocities, armour, charge, score and world state.',{0:'obfuscationGuard'});
method('ee','f','(II)Lmb;','findSentinelForPlayer','Traverses sentinels to find a matching player ID.',{0:'playerId',1:'obfuscationGuard'});
method('ee','e','(I)V','checkMatchCompletion','Builds surviving player/team masks and checks match completion.',{0:'obfuscationGuard'});
method('mb','a','([IZZII)V','configureDesign','Builds chassis/modules and initializes player/team and design-derived properties.',{0:'design',1:'obfuscationGuard',2:'alternateConfiguration',3:'playerId',4:'teamId'});
method('mb','c','(II)V','advanceCombatState','Updates timers, armour/charge state, effects and combat physics; receives the world simulation tick.',{0:'obfuscationGuard',1:'simulationTick'});
method('mb','i','(II)Z','hasModuleType','Checks active/installed module IDs, including original special aliases.',{0:'moduleType',1:'obfuscationGuard'});
method('mb','h','(II)I','addModuleBonuses','Adds active and installed module bonuses to an incoming count.',{0:'baseCount',1:'moduleType'});
method('mb','e','(II)V','reduceArmour','Subtracts armour and updates the local player world accumulator.',{0:'obfuscationGuard',1:'amount'});
method('mb','e','(I)V','restoreArmour','Restores maximum armour and updates local world accumulators.',{0:'obfuscationGuard'});
method('mb','f','(I)V','clearArmour','Clears armour and updates the local world accumulator.',{0:'obfuscationGuard'});
method('mb','a','(ZI)V','consumeCharge','Subtracts charge with the original cap and module-37 override; no new clamping.',{0:'obfuscationGuard',1:'amount'});
method('mb','g','(I)V','refillCharge','Restores charge to maximum and updates the local world accumulators.',{0:'obfuscationGuard'});
method('mb','b','(ZI)I','getStatistic','Reads a selected match statistic using its original numeric index.',{0:'obfuscationGuard',1:'statisticId'});
method('mb','d','(B)I','getTeamColour','Returns the team palette colour with special/fallback colours.',{0:'obfuscationGuard'});
method('hd','a','(I)I','getProfileLength','Returns the shared terrain profile length.',{0:'obfuscationGuard'});
method('hd','b','(I)I','getTerrainType','Returns the seed-derived terrain layout type.',{0:'obfuscationGuard'});
method('hd','a','(BI)I','getGroundHeightAt','Clamps the index and reads groundHeightProfile.',{0:'obfuscationGuard',1:'profileIndex'});
method('hd','a','(ZI)I','getSecondaryHeightAt','Clamps the index and reads secondaryHeightProfile.',{0:'obfuscationGuard',1:'profileIndex'});
method('hd','b','(BI)I','getSurfaceProfileAt','Clamps the index and reads surfaceProfile.',{0:'obfuscationGuard',1:'profileIndex'});
method('wl','i','(I)V','advanceProjectile','Updates projectile state, collision checks and associated effects.',{0:'obfuscationGuard'});
method('nk','g','(I)I','getTotalArmour','Recursively sums armour contributions on attached parts.',{0:'obfuscationGuard'});
method('nk','l','(I)Ljava/lang/String;','getPartName','Returns a component-table name or an instruction-supplied part name.',{0:'obfuscationGuard'});
method('ck','b','(I)V','unlink','Unlinks the node from its neighbours.',{0:'obfuscationGuard'});
method('kd','e','(I)V','unlinkDual','Unlinks the secondary intrusive links.',{0:'obfuscationGuard'});
method('ul','a','(ILck;)V','addLast','Adds before the sentinel while preserving original guard effects.',{0:'obfuscationGuard',1:'node'});
method('ul','e','(I)Lck;','first','Returns first node and primes forward traversal.',{0:'obfuscationGuard'});
method('ul','a','(B)Lck;','next','Continues forward traversal.',{0:'obfuscationGuard'});
method('ul','g','(I)V','clear','Unlinks every node and resets the cursor.',{0:'obfuscationGuard'});
method('ul','b','(B)I','size','Counts nodes with the original dummy-guard branch.',{0:'obfuscationGuard'});
method('gk','a','()Lwk;','toRgbSprite','Expands unsigned byte indices through the palette.');
// Command scheduling is distinct from command activation: insertion marks a
// command scheduled, whereas activation is consumed by individual abilities.
field('je','p','Z','scheduled','Sentinel.scheduleCommand sets this on insertion; executeCommand checks it before dispatch.');
field('je','u','I','targetWorldX','Gameplay input and projectile interception copy the target X coordinate here.');
field('je','y','I','targetWorldY','Gameplay input and projectile interception copy the target Y coordinate here.');
field('je','B','I','aimAngle','atan2 target offset converted to 65536 units per turn, adjusted for sentinel facing.');
for(const [original,to] of [['eb','velocityX'],['F','velocityY']])
  field('wl',original,'I',to,'Projectile constructor records motion; update adds velocity to world coordinates.');
for(const [original,to,type] of [
  ['H','worldX','I'],['M','worldY','I'],['V','velocityX','I'],['T','velocityY','I'],
  ['Y','ageTicks','I'],['z','durationTicks','I'],['X','affectedSentinels','[Lmb;'],
])field('jb',original,type,to,'Explosion constructor bindings, position advancement, age increment and duration termination.');
for(const [original,to] of [['F','worldX'],['B','worldY'],['A','velocityX'],['O','velocityY']])
  field('qb',original,'I',to,'Particle update adds these velocities to the corresponding world coordinates before terrain contact.');
method('mb','d','(BLje;)V','scheduleCommand','Routes types 3/4/6 to the secondary queue; inserts by tick, replaces equal ticks and removes older unscheduled commands.',{0:'obfuscationGuard',1:'command'});
method('mb','a','(BI)V','advanceCommandQueues','Clears queues when requested and executes the first command from each queue.',{0:'obfuscationGuard',1:'simulationTick'});
method('mb','a','(ZLje;I)V','executeCommand','Checks scheduled/activated state and dispatches the action at its simulation tick.',{0:'obfuscationGuard',1:'command',2:'simulationTick'});
method('ie','a','(Lck;ILck;)V','insertNodeBefore','Splices a node before an existing intrusive node; command scheduling uses guard 30.',{0:'existingNode',1:'obfuscationGuard',2:'node'});
method('qb','c','(B)V','advanceParticle','Integrates world coordinates, applies terrain contact and updates particle motion.',{0:'obfuscationGuard'});
method('jb','a','(Z)V','advanceExplosion','Advances explosion position/age and applies its effects to world entities.',{0:'obfuscationGuard'});
for(const [owner,descriptor,names] of [
  ['je','(III)V',['actionType','actionVariant','startTick']],
  ['jb','(IIIIILee;[Lmb;Lwl;)V',['worldX','worldY','velocityX','velocityY','durationTicks','world','affectedSentinels','projectile']],
])for(const [ordinal,to] of names.entries())members[`P:${owner}.<init>${descriptor}#${ordinal}`]={to,evidence:'Constructor assignments and callers establish these parameter roles.'};

for(const [owner,signature,ordinal,originalName,to] of [
  ['je','<init>(III)V',0,'var4','durationTicks'],
  ['mb','a(BI)V',0,'var3','primaryCommand'],
  ['mb','a(BI)V',1,'var4','secondaryCommand'],
  ['mb','d(BLje;)V',0,'var3','commandQueue'],
  ['mb','d(BLje;)V',1,'var4','queuedCommand'],
])members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName:originalName,
  evidence:'Reviewed lexical declaration ordinal and command duration/queue traversal data flow.'};

// Packet operations keep their original guard parameters and arithmetic.
// ISAAC also supplies deterministic terrain/world randomness, not only opcodes.
field('kj','A','Lie;','opcodeCipher','Ciphered reads subtract and writes add the next ISAAC word modulo 256.');
field('kj','F','I','readBitPosition','beginBitReading derives this from position; readBits advances it; endBitReading rounds up to bytes.');
field('kd','r','[I','bitMasks','Constant masks for widths 0 through 32, used by the packet bit reader.');
for(const [original,to,type] of [
  ['h','results','[I'],['b','memory','[I'],['i','remainingResults','I'],
  ['e','accumulator','I'],['j','lastResult','I'],['g','generationCounter','I'],
])field('ie',original,type,to,'ISAAC initialization/generation and reverse-order consumption of each 256-word result block.');
method('kj','a','(IB)V','writeCipheredOpcode','Adds an ISAAC word and writes the low byte.',{0:'opcode',1:'obfuscationGuard'});
method('kj','f','(Z)I','readCipheredOpcode','Subtracts an ISAAC word and masks to an unsigned opcode; true guard returns -93 without consuming data.',{0:'obfuscationGuard'});
method('kj','a','(II[BI)V','readCipheredBytes','Decrypts each byte into the destination slice using successive ISAAC words.',{0:'destinationOffset',1:'length',2:'destination',3:'obfuscationGuard'});
method('kj','a','(I[I)V','initializeOpcodeCipher','Constructs the packet ISAAC generator with this seed.',{0:'obfuscationGuard',1:'seed'});
method('kj','d','(Z)V','beginBitReading','Sets readBitPosition to the byte cursor times eight.',{0:'obfuscationGuard'});
method('kj','i','(B)V','endBitReading','Rounds readBitPosition up to the next byte for subsequent byte reads.',{0:'obfuscationGuard'});
method('kj','g','(II)I','readBits','Reads an MSB-first unsigned bit field, retaining Java int representation for width 32.',{0:'obfuscationGuard',1:'bitCount'});
method('ie','c','(I)I','nextInt','Consumes results backwards; regenerates after 256 words. Noncanonical guards retain their extra generation.',{0:'obfuscationGuard'});
method('ie','a','(II)I','nextIntBounded','Rejects the signed high tail to make the 32-bit population divisible by a positive bound, then returns a nonnegative remainder.',{0:'obfuscationGuard',1:'bound'});
method('ie','a','(I)V','generateResults','Generates the next ISAAC result block, advancing the counter and accumulator.',{0:'obfuscationGuard'});
method('ie','b','(I)V','initializeState','Mixes the seed into both ISAAC arrays and generates the first result block.',{0:'obfuscationGuard'});
method('ie','<init>','([I)V','<init>','Copies the seed into results before ISAAC initialization.',{0:'seed'});
method('uh','a','(ZII)I','nonnegativeRemainder','Produces the floor-modulo result for a positive divisor, including negative integers.',{0:'obfuscationGuard',1:'value',2:'divisor'});
// Round: engine classes whose bodies were read in full.
method('ul','a','(BLck;)Lck;','traverseFrom','Returns the given node (or the first node when null) and primes forward traversal at its successor.');
method('ul','a','(I)Lck;','previous','Continues backward traversal using the cursor and each node previous link.');
method('ul','b','(I)Lck;','last','Returns the node before the sentinel and primes backward traversal.');
method('ul','a','(Z)Lck;','removeFirst','Takes the node after the sentinel, unlinks it and returns it.');
method('ul','c','(I)Lck;','removeLast','Takes the node before the sentinel, unlinks it and returns it.');
method('ul','f','(I)Z','isEmpty','Compares the sentinel next link with the sentinel itself.');
method('ul','a','(ILul;)V','moveAllTo','Moves every node of this deque to another via moveTailTo, starting at the first node.');
method('ul','a','(Lul;ILck;)V','moveTailTo','Cuts this deque before the given node and appends the cut tail to the target deque.');
method('gi','a','(Z)I','readUnsignedMedium','Combines three consecutive bytes big-endian and advances the cursor by three.');
method('gi','g','(B)J','readLong','Reads two unsigned ints and composes them high word first.');
method('gi','e','(I)I','readVarInt','Reads 7-bit groups while the high bit is set, shifting each group left by seven.');
method('gi','f','(I)I','readSignedSmart','Reads a one-byte value minus 64 or a two-byte value minus 49152 depending on the first byte.');
method('gi','h','(I)Ljava/lang/String;','readString','Reads bytes up to a zero terminator and decodes them, returning an empty string when empty.');
method('gi','g','(I)Ljava/lang/String;','readNullableString','Returns null when the next byte is zero (consumed), otherwise reads a terminated string.');
method('gi','e','(B)Ljava/lang/String;','readPrefixedString','Requires a leading zero byte, then reads a zero-terminated string.');
method('gi','a','(Ljava/lang/String;I)V','writeString','Rejects embedded NUL, encodes the string and appends a zero terminator.');
method('gi','a','(ILjava/lang/String;)V','writePrefixedString','Writes a zero prefix byte, then the encoded string and a zero terminator.');
method('gi','b','(II)V','padToPosition','Writes zero bytes until the cursor reaches the given position.');
method('gi','c','(II)V','writeShortLengthPrefix','Stores the given length big-endian in the two bytes before the payload.');
method('gi','a','(ZI)V','writeIntLengthPrefix','Stores the given length big-endian in the four bytes before the payload.');
method('gi','a','(B)Z','verifyTrailingChecksum','Moves back four bytes, checksums the preceding data and compares it with the stored int.');
method('gi','a','(III[I)V','xteaDecryptRange','Reverse XTEA rounds (start sum 0xC6EF3720) on 8-byte blocks of the byte range with a four-word key.');
method('gi','a','([II)V','xteaEncryptAll','Forward XTEA rounds (delta 0x9E3779B9) on every 8-byte block up to the cursor with a four-word key.');
method('gi','a','(Ljava/math/BigInteger;Ljava/math/BigInteger;I)V','rsaEncryptContents','Reads the buffer as a BigInteger, applies modPow with the supplied exponent and modulus and rewrites the result.');
method('pb','a','(III)V','plotAdditive','Adds a colour to the clipped pixel with per-channel saturation.');
method('pb','b','(III)V','plotPixel','Writes a colour to one pixel after clip-bounds checks.');
method('pb','a','(IIIII)V','fillRectangle','Clips x,y,width,height to the clip bounds and stores a solid colour in each pixel.');
method('pb','b','(IIII)V','desaturateRectangle','Replaces each clipped pixel with a grey from its channels.');
method('pb','f','(IIII)V','halveBrightnessRectangle','Clips the rectangle and halves every pixel channel via halveBrightnessRows.');
method('pb','a','(I[IIIII)V','halveBrightnessRows','Masks the low bit per channel and shifts right one for each row pixel.');
method('pb','c','(IIII)V','drawCircleOutline','Midpoint circle with radius squared error terms; plots symmetric points.');
method('pb','g','(IIII)V','drawHorizontalLine','Clips x extent and y, then stores the colour along a row.');
method('pb','d','(IIII)V','drawVerticalLine','Clips y extent and x, then stores the colour down a column.');
method('pb','c','(IIIII)V','drawHorizontalLineAlpha','Row blend of the colour with the existing pixels using alpha out of 256.');
method('pb','f','(IIIII)V','drawVerticalLineAlpha','Column counterpart of drawHorizontalLineAlpha.');
method('pb','e','(IIIII)V','drawDropShadow','Draws four bottom and right alpha lines with alpha dropping by 32 for each offset.');
method('pb','h','(IIIII)V','drawRectangleOutline','Draws two horizontal and two vertical solid lines.');
method('pb','h','(IIIIII)V','drawRectangleOutlineAlpha','Draws the outline with the alpha line primitives.');
method('pb','d','(IIIII)V','drawLine','Delegates horizontal runs and otherwise steps along a line between two points.');
method('pb','a','([I)V','setClip','Copies left, top, right, bottom into the clip fields and refreshes the clip cache.');
method('pb','b','([I)V','getClip','Writes left, top, right, bottom into the array.');
method('pb','c','()V','resetClip','Sets the clip bounds to the whole target.');
method('pb','h','(IIII)V','intersectClip','Narrows each clip bound to the given rectangle.');
method('pb','b','()V','clear','Zeroes every pixel of the target.');
method('wk','a','(IIII)V','drawTiled','Calls the plain blit once per tile with spacing equal to the sprite size.');
method('wk','a','([I[IIIIIII)V','copyOpaqueRows','Copies unconditional pixel runs row by row.');
method('ne','a','(Lmb;B)V','applyToSentinel','Assigns pickup type to the Sentinel and applies score, bonus-count, armour and world effects by type.');
method('fl','a','(ILmb;BIII)V','tintGreyPixels','Recolours pixels whose red equals green using the Sentinel team colour.');
method('ee','a','(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)Ljava/lang/String;','replaceAll','Repeatedly replaces the needle inside the haystack by the replacement.',{0:'needle',1:'haystack',2:'replacement',3:'obfuscationGuard'});
for(const [original,descriptor,to,parameters] of [
  ['i','(I)I','readInt',{0:'obfuscationGuard'}],
  ['c','(B)I','readUnsignedShort',{0:'obfuscationGuard'}],
  ['f','(B)I','readUnsignedByte',{0:'obfuscationGuard'}],
  ['d','(B)B','readByte',{0:'obfuscationGuard'}],
  ['b','(ZI)V','writeInt',{0:'obfuscationGuard',1:'value'}],
  ['d','(II)V','writeShort',{0:'value',1:'obfuscationGuard'}],
  ['a','(BI)V','writeByte',{0:'obfuscationGuard',1:'value'}],
  ['a','(IBI[B)V','writeBytes',{0:'length',1:'obfuscationGuard',2:'sourceOffset',3:'source'}],
  ['a','(I[BII)V','readBytes',{0:'destinationOffset',1:'destination',2:'obfuscationGuard',3:'length'}],
])method('gi',original,descriptor,to,'Packet cursor progression and big-endian primitive/slice byte assignments.',parameters);
for(const [original,to,type] of [
  ['d','buckets','[Lck;'],['b','bucketCount','I'],['g','nextBucketIndex','I'],
  ['a','iterationCursor','Lck;'],['c','lookupCursor','Lck;'],
])field('uh',original,type,to,'NodeHashTable constructor, key-mask lookup and bucket-sentinel iteration.');
method('uh','a','(JLck;I)V','put','Unlinks an already linked node and appends it to the key-masked bucket; duplicate keys remain distinct nodes.',{0:'key',1:'node',2:'obfuscationGuard'});
method('uh','a','(JI)Lck;','get','Traverses the key-masked bucket and returns the first matching node.',{0:'key',1:'obfuscationGuard'});
method('uh','b','(I)Lck;','first','Resets the bucket index to the argument before starting traversal; canonical value is zero.',{0:'startBucketIndex'});
method('uh','a','(B)Lck;','next','Traverses each bucket in ascending order and follows next links within it.',{0:'obfuscationGuard'});
method('uh','<init>','(I)V','<init>','Allocates a sentinel for every bucket; key masking requires a power-of-two count.',{0:'bucketCount'});
for(const [owner,signature,ordinal,originalName,to] of [
  ['kj','g(II)I',0,'incrementValue$0','consumedByteIndex'],
  ['kj','g(II)I',2,'var3','byteIndex'],
  ['kj','g(II)I',3,'var4','bitsAvailable'],
  ['kj','g(II)I',4,'var5','value'],
  ['kj','g(II)I',5,'var6','guardArithmetic'],
  ['kj','a(II[BI)V',0,'var5_int','byteIndex'],
  ['ie','a(II)I',0,'var4','sample'],
  ['ie','a(II)I',2,'var5','guardArithmetic'],
  ['ie','a(II)I',3,'var3','maximumAcceptedSample'],
])members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName:originalName,
  evidence:'Reviewed lexical declaration ordinal and packet bit assembly, destination indexing or bounded-sample data flow.'};


// Independent Steel identities: equivalent formats do not imply identical descriptors or guards.
for(const [original,to,type] of [
 ['b','groupCount','I'],['h','groupIds','[I'],['u','groupCapacity','I'],['k','revision','I'],
 ['e','indexCrc','I'],['l','indexDigest','[B'],['v','groupNameHashes','[I'],['n','groupNameLookup','Ljk;'],
 ['a','groupCrcs','[I'],['t','groupDigests','[[B'],['m','groupVersions','[I'],
 ['j','fileCounts','[I'],['g','fileCapacities','[I'],['o','fileIds','[[I'],
 ['q','fileNameHashes','[[I'],['d','fileNameLookups','[Ljk;'],
])field('jl',original,type,to,'Index constructor checksum/digest validation, versioned decode and ResourceArchive group/file access. Sparse arrays are indexed by actual IDs; null fileIds rows encode contiguous IDs.');
method('jl','a','([BI)V','decode','Decompresses the index container; reads versions 5–7, flags, delta-coded IDs and optional name/digest tables.',{0:'encodedIndex',1:'obfuscationGuard'});
method('jl','<init>','([BI[B)V','<init>','Checks the entire encoded container CRC and optional 64-byte digest before decoding.',{0:'encodedIndex',1:'expectedCrc',2:'expectedDigest'});
field('jk','c','[I','keyIndexSlots','Interleaved key and original-input-index slots; -1 in the index slot denotes empty, including when the key itself is -1.');
method('jk','a','(IB)I','get','Linear probes and returns the first matching original input index, or -1; duplicate keys preserve the first match.',{0:'key',1:'obfuscationGuard'});
method('jk','<init>','([I)V','<init>','Copies integer keys into a power-of-two table sized above 1.5 times the input count; does not retain the input array.',{0:'keys'});
for(const [original,to,type] of [['o','provider','Lfa;'],['a','index','Ljl;'],['k','packedGroups','[Ljava/lang/Object;'],['i','unpackedFiles','[[Ljava/lang/Object;'],['f','discardPackedGroups','Z'],['d','fileRetentionMode','I']])field('cm',original,type,to,'Archive constructor and unpack/get paths: discard packed groups after decompression; file retention modes 0 retain, 1 discard the returned file, 2 discard its group row.');
method('fa','b','(B)Ljl;','getIndex','Returns the validated archive index when available, otherwise null.',{0:'obfuscationGuard'});
method('fa','a','(II)[B','getEncodedGroup','Returns the encoded group response when available, otherwise null.',{0:'groupId',1:'obfuscationGuard'});
method('fa','a','(ZI)I','getGroupProgress','Reports the request progress for the group.',{0:'obfuscationGuard',1:'groupId'});
field('fi','A','Ljl;','index','Retained validated index returned by getIndex; constructed from disk or network response bytes.');
for(const [original,descriptor,to,parameters] of [
 ['a','(Z)Z','ensureIndex',{0:'obfuscationGuard'}],
 ['b','(IZ)Z','isValidGroup',{0:'groupId',1:'obfuscationGuard'}],
 ['b','(III)Z','isValidFile',{0:'groupId',1:'fileId',2:'obfuscationGuard'}],
 ['a','(Ljava/lang/String;I)I','getGroupId',{0:'groupName',1:'obfuscationGuard'}],
 ['a','(IILjava/lang/String;)I','getFileId',{0:'groupId',1:'obfuscationGuard',2:'fileName'}],
 ['b','(B)I','getGroupCapacity',{0:'obfuscationGuard'}],
 ['a','(ZI)I','getFileCapacity',{0:'obfuscationGuard',1:'groupId'}],
 ['b','(II)I','getGroupProgress',{0:'obfuscationGuard',1:'groupId'}],
 ['a','(II)V','loadPackedGroup',{0:'obfuscationGuard',1:'groupId'}],
 ['a','(IBI)[B','getFile',{0:'groupId',1:'obfuscationGuard',2:'fileId'}],
])method('cm',original,descriptor,to,'Reviewed archive index access, case-folded name lookup, group progress or file storage data flow.',parameters);
method('cm','<init>','(Lfa;ZI)V','<init>','Stores the provider and validates fileRetentionMode in 0..2.',{0:'provider',1:'discardPackedGroups',2:'fileRetentionMode'});
method('gi','c','(Z)I','readLargeSmart','Reads an unsigned short when the next byte is nonnegative, otherwise an int with the high bit cleared.',{0:'obfuscationGuard'});
method('ln','a','([BB)[B','decompressContainer','Reads container type and lengths; type zero copies payload, type one dispatches the block decompressor, other types dispatch the stream decompressor.',{0:'encodedContainer',1:'obfuscationGuard'});
// Particle integration, its cyclic reuse buffer and deferred removal are
// separate mechanisms. Do not describe the reuse buffer as a free list.
for(const [original,to,type] of [['D','durationTicks','I'],['I','ageTicks','I'],['M','effectType','I'],['G','usesSurfaceProfile','Z']])
  field('qb',original,type,to,'Particle factory initializes these fields; drawing scales age by duration; integration chooses the surface or secondary terrain profile and expires strictly after duration. Age also receives a random 0..3 increment below 200.');
for(const [original,to,type] of [['O','pendingParticles','Lul;'],['o','particles','Lul;'],['J','pendingRemovals','Lra;'],['z','gravityAcceleration','I']])
  field('ee',original,type,to,'Simulation merges pending particles before updating them, then unlinks pending removals through their primary links. Projectile/particle gravity adds the acceleration to vertical velocity.');
field('mg','hc','I','particleReuseCursor','ol.d decrements this cursor and wraps from -1 to 9999; no liveness check is performed.');
field('k','Cb','[Lqb;','particleReuseBuffer','Preallocated 10000-object circular buffer returned by ol.d; reused particle fields are initialized by nk.a.');
method('ol','d','(B)Lqb;','acquireCyclicParticle','Decrements and wraps the reuse cursor before returning the existing buffer entry; does not unlink or clear it.',{0:'obfuscationGuard'});
method('nk','a','(IILee;IIZIIII)Lqb;','createParticle','Initializes a cyclically reused particle. The final integer is passed through to child particles; its meaning remains unresolved.',{0:'effectType',1:'velocityX',2:'world',3:'obfuscationGuard',4:'worldY',5:'usesSurfaceProfile',6:'durationTicks',7:'velocityY',8:'worldX',9:'inheritedEffectValue'});
method('qb','i','(I)V','detachWorld','Clears the particle world; subsequent integration returns immediately.',{0:'obfuscationGuard'});
method('qb','a','(IIZB)V','drawParticle','Selects age-scaled particle sprites and render passes, using world coordinates shifted by eight.',{0:'screenOffsetX',1:'screenOffsetY',2:'alternateRenderPass',3:'obfuscationGuard'});
field('ra','d','Lkd;','sentinel','Circular secondary-link sentinel; nodes remain independently linked in their primary collections.');
field('ra','e','Lkd;','traversalCursor','Secondary-link iteration cursor.');
for(const [original,descriptor,to,parameters] of [
 ['a','(BLkd;)V','addLast',{0:'obfuscationGuard',1:'node'}],
 ['b','(I)Lkd;','first',{0:'obfuscationGuard'}],
 ['a','(Z)Lkd;','next',{0:'obfuscationGuard'}],
 ['a','(I)V','clear',{0:'obfuscationGuard'}],
 ['c','(I)Lkd;','removeFirst',{0:'obfuscationGuard'}],
 ['a','(B)I','size',{0:'obfuscationGuard'}],
])method('ra',original,descriptor,to,'Reviewed secondary-link insertion, iteration or unlinking. Clearing these links does not remove primary collection membership.',parameters);
for(const [original,to,type] of [['nb','targetSentinel','Lmb;'],['K','targetWorldX','I'],['S','targetWorldY','I'],['cb','initialDirectionX','I'],['Q','initialDirectionY','I'],['H','applyGravity','Z']])
  field('wl',original,type,to,'Guided projectile acceleration/steering and advanceProjectile: tracks target position, uses constructor-derived velocity signs to resolve turn direction, and controls gravity application.');
method('wl','a','(BI)Z','advanceGuidedMotion','Accelerates along the current vector before age 20; tracks the target and limits turning through age 127, then retains its velocity. Returns false; visual emission remains separately gated.',{0:'obfuscationGuard',1:'substepIndex'});
for(const [owner,signature,items] of [
 ['qb','c(B)V',[[0,'var2','spawnedParticle'],[1,'var3','obfuscationControl'],[2,'var4','unusedString']]],
 ['nk','a(IILee;IIZIIII)Lqb;',[[0,'var10','particle'],[1,'var10_ref','failure'],[2,'var11','unusedWorld']]],
 ['wl','a(BI)Z',[[0,'var3','maximumSpeed'],[1,'var4','velocityOrTargetDeltaX'],[2,'var4_ref_qb','coastingTrail'],[3,'var5','velocityOrTargetDeltaY'],[4,'var6','speedOrTargetAngle'],[5,'var7','launchTrail'],[6,'var7_int','heading'],[7,'var8','headingDelta'],[8,'var9','speed'],[9,'var10','guidedTrail'],[10,'var11','obfuscationControl'],[11,'var7Lifetime1','secondaryLaunchTrail'],[12,'var10Lifetime1','secondaryGuidedTrail']]],
])for(const [ordinal,originalName,to] of items)members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName:originalName,evidence:'Reviewed lexical identity in particle initialization/integration or guided projectile motion; shared locals retain qualified names for both phases.'};
for(const [owner,signature,items] of [
 ['jl','a([BI)V',[[16,'var4','formatVersion'],[17,'var5','flags'],[18,'var6','hasNames'],[19,'var7','hasGroupDigests'],[20,'var8','cumulativeGroupId'],[21,'var9','maximumGroupId'],[22,'var10','groupOrdinal'],[23,'var11','groupId'],[24,'var12','fileCount'],[25,'var13','maximumFileId'],[26,'var14','fileOrdinal'],[27,'var15','fileId'],[29,'var17','packet'],[30,'var21','groupDigest'],[31,'var8Lifetime1','cumulativeFileId'],[32,'var10Lifetime1','groupNameSlot'],[33,'var10Lifetime2','crcGroupOrdinal'],[34,'var10Lifetime3','digestGroupOrdinal'],[35,'var10Lifetime4','versionGroupOrdinal'],[36,'var10Lifetime5','fileGroupOrdinal'],[37,'var10Lifetime6','namedGroupOrdinal'],[38,'var13Lifetime1','fileNameSlot'],[39,'var14Lifetime1','namedFileId'],[40,'var11Lifetime1','namedGroupId'],[41,'var12Lifetime1','namedFileCount'],[42,'var10Lifetime1Lifetime1','groupNameOrdinal'],[43,'var13Lifetime1Lifetime1','namedFileOrdinal']]],
 ['jk','<init>([I)V',[[0,'var2_int','capacity'],[1,'var3','slotIndex'],[2,'var4','bucket'],[8,'var3Lifetime1','inputIndex']]],
 ['jk','a(IB)I',[[0,'var3','bucketMask'],[1,'var4','bucket'],[3,'var6','inputIndex']]],
])for(const [ordinal,originalName,to] of items)members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName:originalName,evidence:'Reviewed lexical declaration ordinal and index delta decoding, table allocation, name/digest slots or open-address probing.'};

// Steering arithmetic helpers retain their original mixed-purpose owners.
field('hk','Zb','[I','quarterSine16','Literal quarter-wave sine values at 8192 angle units per turn, scaled by 65536.');
method('cm','a','(III)I','atan2Angle8192','Combines axis/quadrant cases with first-quadrant atan lookup to produce signed 8192-unit angles.',{0:'deltaY',1:'obfuscationGuard',2:'deltaX'});
method('kg','a','(IB)I','cosine16','Wraps angles modulo 8192 and mirrors the quarter-sine lookup to return 16.16 cosine.',{0:'angle',1:'obfuscationGuard'});
method('jh','a','(II)I','sine16','Wraps angles modulo 8192 and mirrors quarter-sine values; callers pass the half-turn boundary 4096.',{0:'angle',1:'halfTurnBoundary'});
method('kk','a','(III)I','approximateVectorLength','Computes a table-based approximate vector magnitude with scaling, integer truncation and original overflow behavior.',{0:'deltaY',1:'deltaX',2:'obfuscationGuard'});
method('rb','a','(III)I','firstQuadrantAngle8192','Reduces nonnegative X/Y by their ratio and mirrors around the quarter-turn angle.',{0:'deltaX',1:'obfuscationGuard',2:'deltaY'});
method('df','a','(II)I','atanFixed16ToAngle8192','Maps signed 16.16 tangent ratios through the existing quantized atan lookup.',{0:'obfuscationGuard',1:'tangent16'});

// Methods whose normalised bodies match reviewed reference-game methods of identical owner role.
for(const [owner,original,descriptor,to,evidence] of [
  ['an','$cfr$sneakyThrow','(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;','rethrowUnchecked','Same normalised body as Escape Vector AudioService.rethrowUnchecked (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','e','([I[IIIIIIII)V','blendArgbRows','Same normalised body as Armies of Gielinor ArgbSprite.blendArgbRows (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','d','([I[IIIIIIIII)V','blendShadedGrayscaleRows','Same normalised body as Armies of Gielinor ArgbSprite.blendShadedGrayscaleRows (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','d','([I[IIIIIIIIIII)V','blendTintedGrayscaleRows','Same normalised body as Armies of Gielinor ArgbSprite.blendTintedGrayscaleRows (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','b','(III[I[IIIIIIIIII)V','addArgbRows','Same normalised body as Armies of Gielinor ArgbSprite.addArgbRows (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','c','([I[IIIIIIIIIII)V','blitArgbScaled','Same normalised body as GeoBlox ArgbSprite.blitArgbScaled (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','d','([I[IIIIIIII)V','blendArgbReversedRows','Same normalised body as Armies of Gielinor ArgbSprite.blendArgbReversedRows (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','c','([I[IIIIIIIII)V','blitArgbAlpha','Same normalised body as GeoBlox ArgbSprite.blitArgbAlpha (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','c','([I[IIIIIIIIIIII)V','blitArgbScaledAlpha','Same normalised body as GeoBlox ArgbSprite.blitArgbScaledAlpha (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','()I','activity','Same normalised body as Escape Vector PcmSampleStream.activity (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','(II)I','rightGain','Same normalised body as Escape Vector PcmSampleStream.rightGain (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','(Lsk;III)Lem;','createAtStepQ8','Same normalised body as Escape Vector PcmSampleStream.createAtStepQ8 (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','()Lwe;','nextSubstream','Same normalised body as Escape Vector PcmSampleStream.nextSubstream (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','(II)V','rampVolumeQ6','Same normalised body as Escape Vector PcmSampleStream.rampVolumeQ6 (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','d','()Lwe;','firstSubstream','Same normalised body as Escape Vector PcmSampleStream.firstSubstream (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','d','(II)I','leftGain','Same normalised body as Escape Vector PcmSampleStream.leftGain (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','e','()V','refreshGains','Same normalised body as Escape Vector PcmSampleStream.refreshGains (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','e','(I)V','setVolumeQ6','Same normalised body as Escape Vector PcmSampleStream.setVolumeQ6 (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','h','(I)V','setLoopCount','Same normalised body as Escape Vector PcmSampleStream.setLoopCount (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','i','()I','panQ14','Same normalised body as Escape Vector PcmSampleStream.panQ14 (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','k','()V','cancelRamp','Same normalised body as Escape Vector PcmSampleStream.cancelRamp (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','f','(I)V','setSampleStepMagnitude','Same normalised body as GeoBlox PcmSampleStream.setSampleStepMagnitude (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','c','(II)V','setVolumeAndPan','Same normalised body as GeoBlox PcmSampleStream.setVolumeAndPan (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','(II[B[IIIIIIIIIILem;II)I','mixForwardStereoInterpolatedRamp','Same normalised body as GeoBlox PcmSampleStream.mixForwardStereoInterpolatedRamp (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','([B[IIIIIIILem;)I','mixReverseMonoAligned','Same normalised body as GeoBlox PcmSampleStream.mixReverseMonoAligned (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','(I[B[IIIIIIIILem;)I','mixReverseStereoAligned','Same normalised body as GeoBlox PcmSampleStream.mixReverseStereoAligned (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','([B[IIIIIIILem;)I','mixForwardMonoAligned','Same normalised body as GeoBlox PcmSampleStream.mixForwardMonoAligned (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','(I[B[IIIIIIIILem;)I','mixForwardStereoAligned','Same normalised body as GeoBlox PcmSampleStream.mixForwardStereoAligned (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','(I[B[IIIIIIIIIILem;)I','mixReverseStereoAlignedRamp','Same normalised body as GeoBlox PcmSampleStream.mixReverseStereoAlignedRamp (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','(I[B[IIIIIIIIIILem;)I','mixForwardStereoAlignedRamp','Same normalised body as GeoBlox PcmSampleStream.mixForwardStereoAlignedRamp (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','b','([B[IIIIIIIILem;)I','mixReverseMonoAlignedRamp','Same normalised body as GeoBlox PcmSampleStream.mixReverseMonoAlignedRamp (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','([B[IIIIIIIILem;)I','mixForwardMonoAlignedRamp','Same normalised body as GeoBlox PcmSampleStream.mixForwardMonoAlignedRamp (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','a','(Z)V','setReversePlayback','Same normalised body as GeoBlox PcmSampleStream.setReversePlayback (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['fh','a','([I[BIIIIIII)V','blitBinaryGlyph','Same normalised body as Armies of Gielinor BinaryBitmapFont.blitBinaryGlyph (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['fh','a','([I[BIIIIIIII)V','blitBinaryGlyphWithAlpha','Same normalised body as Armies of Gielinor BinaryBitmapFont.blitBinaryGlyphWithAlpha (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['fh','a','([I[BIIIIIIIII[I[I)V','blitMaskedGlyph','Same normalised body as Armies of Gielinor BinaryBitmapFont.blitMaskedGlyph (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['fk','$cfr$sneakyThrow','(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;','rethrowUnchecked','Same normalised body as Escape Vector BoundedUrlRequest.rethrowUnchecked (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ga','$cfr$sneakyThrow','(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;','rethrowUnchecked','Same normalised body as Escape Vector FullscreenDisplayController.rethrowUnchecked (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ii','a','([BI[BII)V','copy','Same normalised body as Escape Vector ArraySupport.copy (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ii','a','([III)V','clear','Same normalised body as Escape Vector ArraySupport.clear (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ii','a','([II[III)V','copy','Same normalised body as Escape Vector ArraySupport.copy (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ii','a','([Ljava/lang/Object;I[Ljava/lang/Object;II)V','copy','Same normalised body as Escape Vector ArraySupport.copy (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['kl','a','()V','reset','Same normalised body as Escape Vector SoundEnvelope.reset (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['kl','a','(I)I','advance','Same normalised body as GeoBlox SoundEnvelope.advance (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mf','a','()V','releaseStatics','Same normalised body as Escape Vector AudioFilter.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mf','a','(F)F','normalizeFrequency','Same normalised body as Escape Vector AudioFilter.normalizeFrequency (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mf','a','(IIF)F','interpolateMagnitude','Same normalised body as Escape Vector AudioFilter.interpolateMagnitude (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mf','b','(IIF)F','interpolateFrequency','Same normalised body as Escape Vector AudioFilter.interpolateFrequency (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mf','a','(IF)I','computeCoefficients','Same normalised body as Brick-a-Brac AudioFilter.computeCoefficients (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mh','b','()Lsk;','toPcmSample','Same normalised body as Escape Vector SoundEffect.toPcmSample (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','a','()V','releaseStatics','Same normalised body as Escape Vector BitmapFont.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','a','(II)V','resetOpaqueStyle','Same normalised body as Escape Vector BitmapFont.resetOpaqueStyle (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','a','(Ljava/lang/String;II)I','paragraphHeight','Same normalised body as Escape Vector BitmapFont.paragraphHeight (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','a','(Ljava/lang/String;IIII)V','drawCentered','Same normalised body as Escape Vector BitmapFont.drawCentered (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','a','(Ljava/lang/String;IIIII)V','drawLeftAlpha','Same normalised body as Escape Vector BitmapFont.drawLeftAlpha (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','b','(Ljava/lang/String;I)I','wrappedLineCount','Same normalised body as Escape Vector BitmapFont.wrappedLineCount (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','b','(Ljava/lang/String;IIII)V','drawLeft','Same normalised body as Escape Vector BitmapFont.drawLeft (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['oi','a','()V','releaseStatics','Same normalised body as Escape Vector Bzip2Decoder.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['oi','d','(Lnh;)B','readByte','Same normalised body as Escape Vector Bzip2Decoder.readByte (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['oi','e','(Lnh;)B','readBit','Same normalised body as Escape Vector Bzip2Decoder.readBit (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['oi','b','(Lnh;)V','buildSymbolMap','Same normalised body as Armies of Gielinor Bzip2Decoder.buildSymbolMap (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['oi','a','([I[I[I[BIII)V','buildHuffmanTables','Same normalised body as GeoBlox Bzip2Decoder.buildHuffmanTables (similarity 0.98); class identity checked by fields and hierarchy.'],
  ['oi','a','(ILnh;)I','readBits','Same normalised body as GeoBlox Bzip2Decoder.readBits (similarity 0.90); class identity checked by fields and hierarchy.'],
  ['p','a','()V','releaseStatics','Same normalised body as Escape Vector SynthInstrument.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['p','a','(III)I','evaluateWave','Same normalised body as Escape Vector SynthInstrument.evaluateWave (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pj','a','()V','releaseStatics','Same normalised body as Escape Vector VorbisFloor.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pj','a','(IIIII)I','interpolatePoint','Same normalised body as Escape Vector VorbisFloor.interpolatePoint (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pj','a','(IIII[FI)V','applyLine','Same normalised body as Armies of Gielinor VorbisFloor.applyLine (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pj','b','([II)I','lowNeighbour','Same normalised body as Armies of Gielinor VorbisFloor.lowNeighbour (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pj','a','([II)I','highNeighbour','Same normalised body as Armies of Gielinor VorbisFloor.highNeighbour (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pj','a','(II)V','sortPoints','Same normalised body as Armies of Gielinor VorbisFloor.sortPoints (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pn','$cfr$sneakyThrow','(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;','rethrowUnchecked','Same normalised body as Escape Vector SystemTaskService.rethrowUnchecked (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['r','$cfr$sneakyThrow','(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;','rethrowUnchecked','Same normalised body as Escape Vector ProxySocketConnector.rethrowUnchecked (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sc','g','()I','bufferedSamples','Same normalised body as Escape Vector JavaSoundAudioOutput.bufferedSamples (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sc','h','()V','closeDevice','Same normalised body as Escape Vector JavaSoundAudioOutput.closeDevice (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sc','e','()V','writeMixBlock','Same normalised body as GeoBlox JavaSoundAudioOutput.writeMixBlock (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sc','d','()V','flushDevice','Same normalised body as GeoBlox JavaSoundAudioOutput.flushDevice (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sd','b','()[F','decodeVector','Same normalised body as Escape Vector VorbisCodebook.decodeVector (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sd','c','()I','decodeScalar','Same normalised body as Escape Vector VorbisCodebook.decodeScalar (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['sd','a','()V','buildHuffmanTree','Same normalised body as GeoBlox VorbisCodebook.buildHuffmanTree (similarity 0.93); class identity checked by fields and hierarchy.'],
  ['tb','a','(I)V','skipSamples','Same normalised body as Escape Vector AudioOutput.skipSamples (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['tb','a','(IZI)V','configure','Same normalised body as Escape Vector AudioOutput.configure (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['tb','a','(Lwe;)V','setStream','Same normalised body as Escape Vector AudioOutput.setStream (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['tb','a','(Lwe;I)V','enqueueByPriority','Same normalised body as Escape Vector AudioOutput.enqueueByPriority (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['tb','f','()V','releaseStatics','Same normalised body as Escape Vector AudioOutput.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['tb','g','()I','bufferedSamples','Same normalised body as Escape Vector AudioOutput.bufferedSamples (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','a','([BI)V','setBitstream','Same normalised body as Escape Vector VorbisSample.setBitstream (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','b','()I','readBit','Same normalised body as Escape Vector VorbisSample.readBit (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','c','()V','releaseStatics','Same normalised body as Escape Vector VorbisSample.releaseStatics (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','f','(I)F','unpackFloat','Same normalised body as Escape Vector VorbisSample.unpackFloat (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','a','([I)Lsk;','decodeToPcm','Same normalised body as Armies of Gielinor VorbisSample.decodeToPcm (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','a','()Lsk;','decodeAllToPcm','Same normalised body as Armies of Gielinor VorbisSample.decodeAllToPcm (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['uk','e','(I)I','readBits','Same normalised body as Armies of Gielinor VorbisSample.readBits (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['we','b','([III)V','process','Same normalised body as Escape Vector PcmStream.process (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['we','c','()I','priority','Same normalised body as Escape Vector PcmStream.priority (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wg','a','()I','activity','Same normalised body as Escape Vector PcmStreamMixer.activity (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','f','()I','getTargetVolume','Same normalised body as GeoBlox PcmSampleStream.getTargetVolume (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','j','()I','getSampleStepMagnitude','Same normalised body as GeoBlox PcmSampleStream.getSampleStepMagnitude (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['em','l','()Z','hasRemainingRampFrames','Same normalised body as GeoBlox PcmSampleStream.hasRemainingRampFrames (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['lg','$cfr$lcmp','(JJ)I','compareSignedLongs','Same normalised body as GeoBlox GameApplet.compareSignedLongs (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','a','()V','releaseMessageTable','Same normalised body as Armies of Gielinor MidiFileReader.releaseMessageTable (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','b','()I','trackCount','Same normalised body as Armies of Gielinor MidiFileReader.trackCount (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','b','(I)J','tickTime','Same normalised body as Armies of Gielinor MidiFileReader.tickTime (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','c','()Z','isDone','Same normalised body as Armies of Gielinor MidiFileReader.isDone (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','d','()Z','isReady','Same normalised body as Armies of Gielinor MidiFileReader.isReady (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','d','(I)V','seekTrack','Same normalised body as Armies of Gielinor MidiFileReader.seekTrack (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','e','()V','markTrackDone','Same normalised body as Armies of Gielinor MidiFileReader.markTrackDone (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','e','(I)V','saveTrackPosition','Same normalised body as Armies of Gielinor MidiFileReader.saveTrackPosition (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','f','()I','nextTrack','Same normalised body as Armies of Gielinor MidiFileReader.nextTrack (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','f','(I)I','readMessage','Same normalised body as Armies of Gielinor MidiFileReader.readMessage (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','g','()V','release','Same normalised body as Armies of Gielinor MidiFileReader.release (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ab','a','(J)V','reset','Same normalised body as Brick-a-Brac MidiFileReader.reset (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['mi','a','(Ljava/lang/String;)Ljava/lang/String;','escapeMarkup','Same normalised body as Armies of Gielinor BitmapFont.escapeMarkup (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pb','a','(IIII)V','setClip','Same normalised body as Armies of Gielinor SoftwareRaster.setClip (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['pb','a','([III)V','setTarget','Same normalised body as Armies of Gielinor SoftwareRaster.setTarget (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['tg','a','()V','releasePatchUsage','Same normalised body as Armies of Gielinor MusicTrack.releasePatchUsage (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wk','b','(II)V','drawHalfSize','Same normalised body as Armies of Gielinor RgbSprite.drawHalfSize (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wk','e','()V','normalizeCanvas','Same normalised body as Armies of Gielinor RgbSprite.normalizeCanvas (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wk','g','()Lwk;','copySprite','Same normalised body as Armies of Gielinor RgbSprite.copySprite (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wk','c','()V','rotateCounterClockwise','Same normalised body as Armies of Gielinor RgbSprite.rotateCounterClockwise (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['wk','a','()Lwk;','copyFlippedHorizontal','Same normalised body as Brick-a-Brac RgbSprite.copyFlippedHorizontal (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wk','b','()V','flipHorizontal','Same normalised body as Brick-a-Brac RgbSprite.flipHorizontal (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['wk','f','()V','trimTransparentBorders','Same normalised body as Brick-a-Brac RgbSprite.trimTransparentBorders (similarity 1.00); class identity checked by fields and hierarchy.'],
  ['ek','b','(II)V','drawHalfSize','Same normalised body as Armies of Gielinor ArgbSprite.drawHalfSize (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','c','(III)V','drawTintedGrayscale','Same normalised body as Armies of Gielinor ArgbSprite.drawTintedGrayscale (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','a','(III)V','drawAdditive','Same normalised body as Armies of Gielinor ArgbSprite.drawAdditive (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','b','(III)V','drawShadedGrayscale','Same normalised body as Armies of Gielinor ArgbSprite.drawShadedGrayscale (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','d','(III)V','drawWithOpacity','Same normalised body as Armies of Gielinor ArgbSprite.drawWithOpacity (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','g','(II)V','drawHorizontalFlip','Same normalised body as Armies of Gielinor ArgbSprite.drawHorizontalFlip (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','e','(II)V','drawVerticalFlip','Same normalised body as Armies of Gielinor ArgbSprite.drawVerticalFlip (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','g','(I)V','fadeOutAndUnlink','Same normalised body as GeoBlox PcmSampleStream.fadeOutAndUnlink (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','a','(II[B[IIIIIIIILem;II)I','mixReverseStereoInterpolated','Same normalised body as GeoBlox PcmSampleStream.mixReverseStereoInterpolated (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','d','(II[B[IIIIIIIILem;II)I','mixForwardStereoInterpolated','Same normalised body as GeoBlox PcmSampleStream.mixForwardStereoInterpolated (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','b','(II[B[IIIIIIILem;II)I','mixForwardMonoInterpolated','Same normalised body as GeoBlox PcmSampleStream.mixForwardMonoInterpolated (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','a','(II[B[IIIIIIILem;II)I','mixReverseMonoInterpolated','Same normalised body as GeoBlox PcmSampleStream.mixReverseMonoInterpolated (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','b','(II[B[IIIIIIIILem;II)I','mixForwardMonoInterpolatedRamp','Same normalised body as GeoBlox PcmSampleStream.mixForwardMonoInterpolatedRamp (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','c','(II[B[IIIIIIIILem;II)I','mixReverseMonoInterpolatedRamp','Same normalised body as GeoBlox PcmSampleStream.mixReverseMonoInterpolatedRamp (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','a','(II[B[IIIIIIIIIILem;II)I','mixReverseStereoInterpolatedRamp','Same normalised body as GeoBlox PcmSampleStream.mixReverseStereoInterpolatedRamp (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['uk','b','([B)V','decodeSetup','Same normalised body as Armies of Gielinor VorbisSample.decodeSetup (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ek','d','(II)V','drawQuarterSize','Same normalised body as Armies of Gielinor ArgbSprite.drawQuarterSize (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['ab','a','(I)I','readNextMessage','Same normalised body as Armies of Gielinor MidiFileReader.readNextMessage (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','e','(II)V','drawVerticalFlip','Same normalised body as Armies of Gielinor RgbSprite.drawVerticalFlip (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','g','(II)V','drawHorizontalFlip','Same normalised body as Armies of Gielinor RgbSprite.drawHorizontalFlip (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','d','(II)V','drawQuarterSize','Same normalised body as Armies of Gielinor RgbSprite.drawQuarterSize (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','a','(III)V','drawAdditive','Same normalised body as Armies of Gielinor RgbSprite.drawAdditive (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','c','(III)V','drawTintedGrayscale','Same normalised body as Armies of Gielinor RgbSprite.drawTintedGrayscale (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','b','(III)V','drawShadedGrayscale','Same normalised body as Armies of Gielinor RgbSprite.drawShadedGrayscale (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['wk','d','(III)V','drawWithOpacity','Same normalised body as Armies of Gielinor RgbSprite.drawWithOpacity (similarity 0.99); class identity checked by fields and hierarchy.'],
  ['em','d','(I)V','skipFrames','Same normalised body as GeoBlox PcmSampleStream.skipFrames (similarity 0.98); class identity checked by fields and hierarchy.'],
  ['uk','d','(I)[F','decodePacket','Same normalised body as Armies of Gielinor VorbisSample.decodePacket (similarity 0.98); class identity checked by fields and hierarchy.'],
  ['ab','a','([B)V','parse','Same normalised body as Armies of Gielinor MidiFileReader.parse (similarity 0.98); class identity checked by fields and hierarchy.'],
  ['wk','a','([IIIIIIII)V','drawHalfSizePixels','Same normalised body as Brick-a-Brac RgbSprite.drawHalfSizePixels (similarity 0.98); class identity checked by fields and hierarchy.'],
  ['em','a','(III)V','rampVolumeAndPan','Same normalised body as GeoBlox PcmSampleStream.rampVolumeAndPan (similarity 0.97); class identity checked by fields and hierarchy.'],
  ['u','a','([I[[B)[[B','convertPaletteGlyphsToCoverageInPlace','Same normalised body as GeoBlox CoverageBitmapFont.convertPaletteGlyphsToCoverageInPlace (similarity 0.97); class identity checked by fields and hierarchy.'],
  ['ab','a','(II)I','decodeMessagePayload','Same normalised body as Armies of Gielinor MidiFileReader.decodeMessagePayload (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['em','a','([III)V','mixInto','Same normalised body as GeoBlox PcmSampleStream.mixInto (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['kl','a','(Lgi;)V','decodeSegments','Same normalised body as Armies of Gielinor SoundEnvelope.decodeSegments (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['mh','a','(Lcm;II)Lmh;','load','Same normalised body as Escape Vector SoundEffect.load (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['mh','a','()[B','mix','Same normalised body as Brick-a-Brac SoundEffect.mix (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['oi','a','([BI[BII)I','decompressInto','Same normalised body as GeoBlox Bzip2Decoder.decompressInto (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['tb','b','(Lwe;)V','deactivateTree','Same normalised body as Escape Vector AudioOutput.deactivateTree (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['wk','c','(IIII)V','drawScaled','Same normalised body as Armies of Gielinor RgbSprite.drawScaled (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['wk','a','(IIIII)V','drawScaledWithOpacity','Same normalised body as Armies of Gielinor RgbSprite.drawScaledWithOpacity (similarity 0.96); class identity checked by fields and hierarchy.'],
  ['gi','b','(IJ)V','writeLong','Same normalised body as Escape Vector PacketBuffer.writeLong (similarity 0.87); class identity checked by fields and hierarchy.'],
  ['mi','a','([B)V','decodeFontMetrics','Same normalised body as GeoBlox BitmapFont.decodeFontMetrics (similarity 0.95); class identity checked by fields and hierarchy.'],
  ['mi','c','(Ljava/lang/String;)I','textWidth','Same normalised body as Armies of Gielinor BitmapFont.textWidth (similarity 0.95); class identity checked by fields and hierarchy.'],
  ['oi','c','(Lnh;)V','decodeBlocks','Same normalised body as Armies of Gielinor Bzip2Decoder.decodeBlocks (similarity 0.95); class identity checked by fields and hierarchy.'],
  ['uk','a','(Lcm;)Z','ensureSetup','Same normalised body as Armies of Gielinor VorbisSample.ensureSetup (similarity 0.95); class identity checked by fields and hierarchy.'],
  ['wm','a','(Ljava/lang/String;IBLjava/lang/String;)Ljava/io/File;','resolveFile','Same normalised body as Escape Vector CacheFileLocator.resolveFile (similarity 0.95); class identity checked by fields and hierarchy.'],
  ['tg','a','(Lcm;Ljava/lang/String;Ljava/lang/String;)Ltg;','load','Same normalised body as Armies of Gielinor MusicTrack.load (similarity 0.95); class identity checked by fields and hierarchy.'],
  ['em','a','(Lsk;II)Lem;','createAtRatePercent','Same normalised body as Escape Vector PcmSampleStream.createAtRatePercent (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['gi','a','(IJ)V','writeLong56','Same normalised body as Escape Vector PacketBuffer.writeLong56 (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['gi','a','(JB)V','writeLong40','Same normalised body as Brick-a-Brac PacketBuffer.writeLong40 (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['mf','a','(Lgi;Lkl;)V','decode','Same normalised body as Brick-a-Brac AudioFilter.decode (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['pj','a','([FI)V','applyFloor','Same normalised body as Armies of Gielinor VorbisFloor.applyFloor (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['sc','b','(I)V','openDevice','Same normalised body as Escape Vector JavaSoundAudioOutput.openDevice (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['uk','a','([B)V','decodePacketContainer','Same normalised body as Armies of Gielinor VorbisSample.decodePacketContainer (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['gk','b','(II)V','drawQuarter','Same normalised body as Brick-a-Brac IndexedSprite.drawQuarter (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['ab','c','(I)V','readDelta','Same normalised body as Armies of Gielinor MidiFileReader.readDelta (similarity 0.94); class identity checked by fields and hierarchy.'],
  ['gk','a','(II)V','draw','Same normalised body as GeoBlox IndexedSprite.draw (similarity 0.87); class identity checked by fields and hierarchy.'],
  ['hn','a','(Ljava/applet/Applet;BLjava/lang/String;)Ljava/lang/Object;','callWindowFunction','Same normalised body as Escape Vector JavaScriptBridge.callWindowFunction (similarity 0.93); class identity checked by fields and hierarchy.'],
  ['rk','a','([FIZ)V','decodeResidue','Same normalised body as GeoBlox VorbisResidue.decodeResidue (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['rm','b','(I)Z','isHomePressed','Corrected: tests polled key code 102, which Escape Vector MenuInputState.isHomePressed tests (the earlier name isLeftPressed was swapped).'],
  ['vm','b','(ILjava/lang/String;)Z','containsEmailPart','Same normalised body as Brick-a-Brac PasswordValidator.containsEmailPart (similarity 0.93); class identity checked by fields and hierarchy.'],
  ['wg','c','([III)V','mixSubstreams','Same normalised body as Escape Vector PcmStreamMixer.mixSubstreams (similarity 0.93); class identity checked by fields and hierarchy.'],
  ['em','c','()I','priority','Same normalised body as Escape Vector PcmSampleStream.priority (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['gk','a','(III)V','drawAlpha','Same normalised body as GeoBlox IndexedSprite.drawAlpha (similarity 0.86); class identity checked by fields and hierarchy.'],
  ['hn','a','(Ljava/lang/String;BLjava/applet/Applet;[Ljava/lang/Object;)Ljava/lang/Object;','callWindowFunctionWithArguments','Same normalised body as Escape Vector JavaScriptBridge.callWindowFunctionWithArguments (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['tb','b','()V','serviceOutput','Same normalised body as GeoBlox AudioOutput.serviceOutput (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['tb','a','([II)V','mixBlock','Same normalised body as GeoBlox AudioOutput.mixBlock (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['wg','e','(I)V','skipSubstreams','Same normalised body as Escape Vector PcmStreamMixer.skipSubstreams (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['gk','b','(IIII)V','drawScaled','Same normalised body as Armies of Gielinor IndexedSprite.drawScaled (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['jc','d','(I)Lck;','next','Same normalised body as Armies of Gielinor NodeIterator.next (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['wk','d','()V','bindRasterTarget','Same normalised body as Brick-a-Brac RgbSprite.bindRasterTarget (similarity 0.92); class identity checked by fields and hierarchy.'],
  ['rm','d','(I)Z','isLeftPressed','Corrected: tests polled key code 96, which Escape Vector MenuInputState.isLeftPressed tests (the earlier name isHomePressed was swapped).'],
  ['em','b','(Lsk;III)Lem;','createAtRatePercentQ6','Same normalised body as Escape Vector PcmSampleStream.createAtRatePercentQ6 (similarity 0.90); class identity checked by fields and hierarchy.'],
  ['ia','a','(ZLjf;)V','onSubmit','Same normalised body as Escape Vector TextFieldValidator.onSubmit (similarity 0.90); class identity checked by fields and hierarchy.'],
  ['mi','a','(C)I','measureCharacterAdvance','Same normalised body as Ace of Skies BitmapFont.measureCharacterAdvance (similarity 0.90); class identity checked by fields and hierarchy.'],
  ['pj','b','()Z','decodeFloor','Same normalised body as Armies of Gielinor VorbisFloor.decodeFloor (similarity 0.90); class identity checked by fields and hierarchy.'],
  ['wg','b','()Lwe;','nextSubstream','Same normalised body as Escape Vector PcmStreamMixer.nextSubstream (similarity 0.90); class identity checked by fields and hierarchy.'],
  ['em','h','()Z','adjustRampOrStop','Same normalised body as Escape Vector PcmSampleStream.adjustRampOrStop (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['mi','a','(Ljava/lang/String;[I[Ljava/lang/String;)I','wrapText','Same normalised body as GeoBlox BitmapFont.wrapText (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['mk','a','(Ljava/awt/Component;Z)V','attach','Same normalised body as Escape Vector MouseWheelHandler.attach (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['oi','a','(Lnh;)V','emitBlock','Same normalised body as Armies of Gielinor Bzip2Decoder.emitBlock (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['sd','a','(II)I','lookup1ValueCount','Same normalised body as Escape Vector VorbisCodebook.lookup1ValueCount (similarity 0.83); class identity checked by fields and hierarchy.'],
  ['u','a','(IIIIIIZ)V','drawGlyph','Same normalised body as GeoBlox CoverageBitmapFont.drawGlyph (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['u','a','(IIIIIIIZ)V','drawGlyphAlpha','Same normalised body as GeoBlox CoverageBitmapFont.drawGlyphAlpha (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['ld','a','(IIIIIIIZ)V','drawGlyphAlpha','Same normalised body as GeoBlox PaletteBitmapFont.drawGlyphAlpha (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['ld','a','(IIIIIIZ)V','drawGlyph','Same normalised body as GeoBlox PaletteBitmapFont.drawGlyph (similarity 0.89); class identity checked by fields and hierarchy.'],
  ['q','a','(Lck;JZ)V','put','Same normalised body as Armies of Gielinor IterableNodeHashTable.put (similarity 0.88); class identity checked by fields and hierarchy.'],
  ['sg','a','(I)I','readUnsignedByte','Same normalised body as Escape Vector BufferedSocket.readUnsignedByte (similarity 0.85); class identity checked by fields and hierarchy.'],
  ['ca','a','([BILub;[I)Z','prepareSamples','Same normalised body as Armies of Gielinor MusicPatch.prepareSamples (similarity 0.88); class identity checked by fields and hierarchy.'],
  ['ge','a','(I)[B','toByteArray','Same normalised body as Brick-a-Brac DirectByteStorage.toByteArray (similarity 0.87); class identity checked by fields and hierarchy.'],
  ['kl','b','(Lgi;)V','decode','Same normalised body as Escape Vector SoundEnvelope.decode (similarity 0.87); class identity checked by fields and hierarchy.'],
  ['em','g','()Z','isSamplePositionOutOfRange','Same normalised body as GeoBlox PcmSampleStream.isSamplePositionOutOfRange (similarity 0.87); class identity checked by fields and hierarchy.'],
  ['jf','j','(I)Ljava/lang/String;','selectedText','Same normalised body as Escape Vector EditableTextWidget.selectedText (similarity 0.86); class identity checked by fields and hierarchy.'],
  ['jf','a','(Ljava/lang/String;IZ)V','setText','Same normalised body as Armies of Gielinor EditableTextWidget.setText (similarity 0.86); class identity checked by fields and hierarchy.'],
  ['jf','g','(I)I','nextWordBoundary','Same normalised body as Armies of Gielinor EditableTextWidget.nextWordBoundary (similarity 0.86); class identity checked by fields and hierarchy.'],
  ['ke','b','(II)Lke;','setShadowColor','Same normalised body as Escape Vector WidgetStyleLayer.setShadowColor (similarity 0.86); class identity checked by fields and hierarchy.'],
  ['wg','d','()Lwe;','firstSubstream','Same normalised body as Escape Vector PcmStreamMixer.firstSubstream (similarity 0.86); class identity checked by fields and hierarchy.'],
  ['jg','b','(IBI)V','setDesiredSize','Same normalised body as Escape Vector ViewportController.setDesiredSize (similarity 0.85); class identity checked by fields and hierarchy.'],
  ['wk','b','(IIIII)V','drawScaledWithBrightness','Same normalised body as Armies of Gielinor RgbSprite.drawScaledWithBrightness (similarity 0.85); class identity checked by fields and hierarchy.'],
  ['tb','a','()V','flush','Same normalised body as Escape Vector AudioOutput.flush (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['wg','b','(Lwe;)V','addSubstream','Same normalised body as Escape Vector PcmStreamMixer.addSubstream (similarity 0.84); class identity checked by fields and hierarchy.'],
  ['ug','f','(I)V','layoutChild','Same normalised body as Escape Vector SingleChildContainer.layoutChild (similarity 0.83); class identity checked by fields and hierarchy.'],
  ['cm','a','(I)Z','ensureAllGroupsAvailable','Same normalised body as Armies of Gielinor ResourceArchive.ensureAllGroupsAvailable (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['gi','e','(II)V','writeMedium','Same normalised body as Brick-a-Brac PacketBuffer.writeMedium (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['r','a','(I)Ljava/net/Socket;','connect','Same normalised body as Brick-a-Brac ProxySocketConnector.connect (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['rm','c','(I)Z','isForwardAction','Same normalised body as Escape Vector MenuInputState.isForwardAction (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['jc','a','(ZLck;)Lck;','startReverseAt','Same normalised body as Armies of Gielinor NodeIterator.startReverseAt (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['tg','b','()V','buildPatchUsage','Same normalised body as Armies of Gielinor MusicTrack.buildPatchUsage (similarity 0.82); class identity checked by fields and hierarchy.'],
  ['ge','a','(B[B)V','setBytes','Same normalised body as Escape Vector DirectByteStorage.setBytes (similarity 0.74); class identity checked by fields and hierarchy.'],
  ['nj','i','(I)Ljava/lang/String;','linkOpenMarkup','Same normalised body as Escape Vector AccountTermsPanel.linkOpenMarkup (similarity 0.81); class identity checked by fields and hierarchy.'],
  ['tb','a','(Lpn;Ljava/awt/Component;II)Ltb;','createOutput','Same normalised body as GeoBlox AudioOutput.createOutput (similarity 0.81); class identity checked by fields and hierarchy.'],
  ['tb','c','()V','dispose','Same normalised body as GeoBlox AudioOutput.dispose (similarity 0.81); class identity checked by fields and hierarchy.'],
  ['ub','a','(Ljava/lang/String;Ljava/lang/String;I)Lsk;','getSoundEffectByName','Same normalised body as Armies of Gielinor SoundCache.getSoundEffectByName (similarity 0.81); class identity checked by fields and hierarchy.'],
  ['dl','a','(Llh;I)V','addChild','Same normalised body as Escape Vector UiContainer.addChild (similarity 0.80); class identity checked by fields and hierarchy.'],
  ['h','a','(ILlh;IIIZI)Z','handlePointerPress','Same normalised body as Brick-a-Brac DraggableWidget.handlePointerPress (similarity 0.80); class identity checked by fields and hierarchy.'],
  ['hc','e','(I)Ljava/lang/String;','getTooltip','Same normalised body as Escape Vector LabeledField.getTooltip (similarity 0.80); class identity checked by fields and hierarchy.'],
  ['sg','a','(II[BI)V','readFully','Same normalised body as Armies of Gielinor BufferedSocket.readFully (similarity 0.80); class identity checked by fields and hierarchy.'],
  ['ek','c','(IIII)V','drawScaled','Same normalised body as Armies of Gielinor ArgbSprite.drawScaled (similarity 0.78); class identity checked by fields and hierarchy.'],
  ['gl','a','(JB)I','advanceTicks','Same normalised body as Escape Vector NanoTickClock.advanceTicks (similarity 0.78); class identity checked by fields and hierarchy.'],
  ['fh','a','(IIIIIIZ)V','drawGlyph','Same normalised body as Armies of Gielinor BinaryBitmapFont.drawGlyph (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['ia','a','(Ljf;B)V','onTextChanged','Same normalised body as Escape Vector TextFieldValidator.onTextChanged (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['pk','a','(ILjava/awt/Frame;IIBI)V','enterFullscreen','Same normalised body as Escape Vector MicrosoftDisplayController.enterFullscreen (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['pm','a','(Ljf;B)V','onTextChanged','Same normalised body as Escape Vector LoginForm.onTextChanged (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['sc','a','(Ljava/awt/Component;)V','initializeDevice','Same normalised body as GeoBlox JavaSoundAudioOutput.initializeDevice (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['sn','d','(I)J','length','Same normalised body as Escape Vector BoundedRandomAccessFile.length (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['ug','e','(I)Ljava/lang/String;','getTooltip','Same normalised body as Escape Vector SingleChildContainer.getTooltip (similarity 0.77); class identity checked by fields and hierarchy.'],
  ['gi','f','(II)I','appendCrc32','Same normalised body as Ace of Skies PacketBuffer.appendCrc32 (similarity 0.76); class identity checked by fields and hierarchy.'],
  ['ig','a','([BZI)V','finishDigest','Same normalised body as Armies of Gielinor WhirlpoolHasher.finishDigest (similarity 0.76); class identity checked by fields and hierarchy.'],
  ['wg','a','(Lwe;)V','removeSubstream','Same normalised body as Escape Vector PcmStreamMixer.removeSubstream (similarity 0.66); class identity checked by fields and hierarchy.'],
  ['cb','a','(I)V','shutdown','Same normalised body as Escape Vector DiskCacheWorker.shutdown (similarity 0.75); class identity checked by fields and hierarchy.'],
  ['ke','a','(II)Lke;','setOffsetY','Corrected: stores the vertical content offset that paint adds to the component y (the earlier name setTextColor was wrong; the colour setter is setFontColor).'],
  ['r','a','(ILjava/net/Proxy;)Ljava/net/Socket;','connectViaProxy','Same normalised body as Brick-a-Brac ProxySocketConnector.connectViaProxy (similarity 0.75); class identity checked by fields and hierarchy.'],
  ['ti','a','(BLjava/awt/Graphics;II)V','drawImage','Same normalised body as Escape Vector ImageProducerRasterBuffer.drawImage (similarity 0.75); class identity checked by fields and hierarchy.'],
  ['gi','a','(II)V','writeUnsignedSmart','Same normalised body as Brick-a-Brac PacketBuffer.writeUnsignedSmart (similarity 0.74); class identity checked by fields and hierarchy.'],
  ['lh','a','(BIIILlh;I)V','onPointerReleased','Same normalised body as Escape Vector UiComponent.onPointerReleased (similarity 0.74); class identity checked by fields and hierarchy.'],
  ['sg','b','(B)I','available','Same normalised body as GeoBlox BufferedSocket.available (similarity 0.74); class identity checked by fields and hierarchy.'],
  ['h','a','(BIIILlh;I)V','onPointerReleased','Same normalised body as Escape Vector DraggableWidget.onPointerReleased (similarity 0.73); class identity checked by fields and hierarchy.'],
  ['ke','a','(BLke;)V','copyTo','Same normalised body as Escape Vector WidgetStyleLayer.copyTo (similarity 0.73); class identity checked by fields and hierarchy.'],
  ['ki','a','(IZLjava/lang/String;F)V','setProgress','Same normalised body as Escape Vector LoadingProgressDialog.setProgress (similarity 0.73); class identity checked by fields and hierarchy.'],
  ['ma','e','(I)Ljava/lang/String;','getTooltip','Same normalised body as Escape Vector TextHotspotWidget.getTooltip (similarity 0.73); class identity checked by fields and hierarchy.'],
  ['uk','a','(Lcm;II)Luk;','load','Same normalised body as Escape Vector VorbisSample.load (similarity 0.72); class identity checked by fields and hierarchy.'],
  ['vi','m','(I)Ljava/lang/String;','linkEndMarkup','Same normalised body as Escape Vector AccountRegistrationPanel.linkEndMarkup (similarity 0.73); class identity checked by fields and hierarchy.'],
  ['de','a','(ILjava/applet/Applet;)V','rememberLoginMethod','Same normalised body as Escape Vector LoginMethod.rememberLoginMethod (similarity 0.72); class identity checked by fields and hierarchy.'],
  ['uk','a','(Lcm;Ljava/lang/String;Ljava/lang/String;)Luk;','loadNamed','Same normalised body as Escape Vector VorbisSample.loadNamed (similarity 0.72); class identity checked by fields and hierarchy.'],
  ['bf','c','(Llh;I)V','transitionToContent','Same normalised body as Escape Vector LoginDialog.transitionToContent (similarity 0.70); class identity checked by fields and hierarchy.'],
  ['bk','f','(I)V','rebuildSprites','Same normalised body as Escape Vector StripedProgressBar.rebuildSprites (similarity 0.70); class identity checked by fields and hierarchy.'],
  ['ul','a','(Lck;I)V','addLast','Same normalised body as Brick-a-Brac NodeDeque.addLast (similarity 0.70); class identity checked by fields and hierarchy.'],
  ['cm','a','(ILjava/lang/String;)Z','ensureGroupAvailableByName','Same normalised body as Armies of Gielinor ResourceArchive.ensureGroupAvailableByName (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['dl','d','(I)Z','isFocused','Same normalised body as Escape Vector UiContainer.isFocused (similarity 0.69); class identity checked by fields and hierarchy.'],
  ['kn','a','(IBLjava/awt/Component;I)V','initialize','Same normalised body as GeoBlox BufferedImageRasterBuffer.initialize (similarity 0.69); class identity checked by fields and hierarchy.'],
  ['wg','a','(Lck;Lw;)V','insertListener','Same normalised body as Escape Vector PcmStreamMixer.insertListener (similarity 0.60); class identity checked by fields and hierarchy.'],
  ['ck','b','(B)Z','isLinked','Same normalised body as Escape Vector IntrusiveNode.isLinked (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['cm','a','(III[I)Z','unpackGroup','Same normalised body as Armies of Gielinor ResourceArchive.unpackGroup (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['g','a','(II)V','growToIndex','Same normalised body as Escape Vector GrowableIntList.growToIndex (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['lk','a','(IILlh;I)V','updateHover','Same normalised body as Escape Vector ValidationIndicator.updateHover (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['oa','a','(BIIILlh;I)V','onPointerReleased','Same normalised body as Escape Vector TextButton.onPointerReleased (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['rc','a','(III[B)Z','write','Same normalised body as Armies of Gielinor SectorCacheStore.write (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['ti','c','(I)V','pushPixels','Same normalised body as Escape Vector ImageProducerRasterBuffer.pushPixels (similarity 0.68); class identity checked by fields and hierarchy.'],
  ['k','m','(I)V','closeDialog','Same normalised body as Escape Vector AccountRequestDialog.closeDialog (similarity 0.67); class identity checked by fields and hierarchy.'],
  ['ka','h','(I)V','refreshPanelVisibility','Same normalised body as Escape Vector ModalStack.refreshPanelVisibility (similarity 0.67); class identity checked by fields and hierarchy.'],
  ['bk','b','(III)V','setColors','Same normalised body as Escape Vector StripedProgressBar.setColors (similarity 0.66); class identity checked by fields and hierarchy.'],
  ['cb','a','(BLdf;)V','enqueue','Same normalised body as Armies of Gielinor DiskCacheWorker.enqueue (similarity 0.66); class identity checked by fields and hierarchy.'],
  ['jf','a','(Ljava/lang/String;Z)V','insertText','Same normalised body as Armies of Gielinor EditableTextWidget.insertText (similarity 0.66); class identity checked by fields and hierarchy.'],
  ['ka','a','(IBII)V','drawLayer','Same normalised body as Escape Vector ModalStack.drawLayer (similarity 0.66); class identity checked by fields and hierarchy.'],
  ['g','a','(Z)I','size','Same normalised body as Brick-a-Brac GrowableIntList.size (similarity 0.65); class identity checked by fields and hierarchy.'],
  ['hc','a','(IBII)V','drawLayer','Same normalised body as Escape Vector LabeledField.drawLayer (similarity 0.65); class identity checked by fields and hierarchy.'],
  ['jf','a','(II)V','moveCaret','Same normalised body as Armies of Gielinor EditableTextWidget.moveCaret (similarity 0.65); class identity checked by fields and hierarchy.'],
  ['lh','a','(ILlh;)Z','focusNext','Same normalised body as Escape Vector UiComponent.focusNext (similarity 0.65); class identity checked by fields and hierarchy.'],
  ['lk','a','(ILlh;)Z','focusNext','Same normalised body as Escape Vector ValidationIndicator.focusNext (similarity 0.65); class identity checked by fields and hierarchy.'],
  ['cm','a','(BLjava/lang/String;)I','getGroupProgressByName','Same normalised body as GeoBlox ResourceArchive.getGroupProgressByName (similarity 0.64); class identity checked by fields and hierarchy.'],
  ['dl','d','(B)V','refreshChildLayouts','Same normalised body as Escape Vector UiContainer.refreshChildLayouts (similarity 0.64); class identity checked by fields and hierarchy.'],
  ['fi','d','(B)V','startPrefetch','Same normalised body as Escape Vector CachedArchiveProvider.startPrefetch (similarity 0.64); class identity checked by fields and hierarchy.'],
  ['gi','b','(Z)I','readUnsignedSmart','Same normalised body as Escape Vector PacketBuffer.readUnsignedSmart (similarity 0.64); class identity checked by fields and hierarchy.'],
  ['jd','a','(IBILoa;I)V','onAction','Same normalised body as Escape Vector AccountNoticeDialog.onAction (similarity 0.64); class identity checked by fields and hierarchy.'],
  ['ui','a','(IBII)V','drawLayer','Same normalised body as Escape Vector AlphaContainer.drawLayer (similarity 0.64); class identity checked by fields and hierarchy.'],
  ['gi','b','(BI)V','backpatchByteLength','Same normalised body as Escape Vector PacketBuffer.backpatchByteLength (similarity 0.63); class identity checked by fields and hierarchy.'],
  ['ll','a','(ILmi;)V','initializePainters','Same normalised body as Escape Vector UiTheme.initializePainters (similarity 0.63); class identity checked by fields and hierarchy.'],
  ['vi','a','(IILma;I)V','onHotspotAction','Same normalised body as Escape Vector AccountRegistrationPanel.onHotspotAction (similarity 0.60); class identity checked by fields and hierarchy.'],
  ['aj','a','(IIII[IIIB)V','setRasterState','Same normalised body as Escape Vector RasterSnapshot.setRasterState (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['k','a','(IICLlh;)Z','onFocusedKey','Same normalised body as Escape Vector AccountRequestDialog.onFocusedKey (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['ka','a','(Llh;I)V','pushPanel','Same normalised body as Escape Vector ModalStack.pushPanel (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['ke','a','(Lke;Lwa;BILlh;I)V','applyTo','Same normalised body as Escape Vector WidgetStyleLayer.applyTo (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['oa','a','(IICLlh;)Z','onFocusedKey','Same normalised body as Escape Vector TextButton.onFocusedKey (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['oa','a','(IILlh;I)V','updateHover','Same normalised body as Escape Vector TextButton.updateHover (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['rm','a','(III)V','updatePointer','Same normalised body as Ace of Skies MenuInputState.updatePointer (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['sg','b','(I)V','close','Same normalised body as Escape Vector BufferedSocket.close (similarity 0.62); class identity checked by fields and hierarchy.'],
  ['gi','c','(BI)V','writeVarInt','Same normalised body as Brick-a-Brac PacketBuffer.writeVarInt (similarity 0.62); class identity checked by fields and hierarchy.'],
])method(owner,original,descriptor,to,evidence);

for(const [owner,original,descriptor,to,evidence] of [
  ['sj','a','(ILtg;IIZI)V','selectTrack','Same normalised body as Armies of Gielinor MusicCrossfadeStream.selectTrack (similarity 0.75); class identity checked by fields and hierarchy.'],
  ['si','a','(Ljava/lang/String;BLmi;I)Lil;','createSingleLine','Same normalised body as GeoBlox CachedTextLayout.createSingleLine (similarity 0.71); class identity checked by fields and hierarchy.'],
  ['nc','a','(JLjava/lang/Object;I)V','put','Same normalised body as Escape Vector WeightedLruCache.put (similarity 0.59); class identity checked by fields and hierarchy.'],
  ['il','b','(I)I','width','Same normalised body as Escape Vector TextLayoutLine.width (similarity 0.67); class identity checked by fields and hierarchy.'],
])method(owner,original,descriptor,to,evidence);

// Reviewed names added in later rounds live in steelsentinels-names.json:
// classes [owner, name, evidence], methods and fields [owner, original, descriptor, name, evidence].
const reviewedNames=JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'steelsentinels-names.json'),'utf8'));
for(const [owner,to,evidence] of reviewedNames.classes) {
  if(classes[owner]) throw new Error('Class already reviewed: '+owner);
  classes[owner]=[to,evidence];
}
for(const [owner,original,descriptor,to,evidence] of reviewedNames.methods) {
  const symbol=`M:${owner}.${original}${descriptor}`;
  if(members[symbol]) throw new Error('Method already reviewed: '+symbol);
  members[symbol]={to,evidence};
}
for(const [owner,original,descriptor,to,evidence] of reviewedNames.fields) {
  const symbol=`F:${owner}.${original}:${descriptor}`;
  if(members[symbol]) throw new Error('Field already reviewed: '+symbol);
  members[symbol]={to,evidence};
}

export function buildSteelRules(input, rows) {
  const declarations = rows.filter(row=>row[0]==='D');
  const declared = new Map(declarations.map(row=>[row[4],row]));
  const rules = new Map();
  const add = (symbol,to,evidence,confidence='reviewed') => {
    const row=declared.get(symbol);
    if(!row) throw new Error('Reviewed identity missing: '+symbol);
    if(row[5]!==to) rules.set(symbol,{symbol,originalName:row[5],to,evidence,confidence});
  };
  for(const [owner,[to,evidence]] of Object.entries(classes)) add('C:'+owner,to,`${owner}.java: ${evidence}`);
  for(const [symbol,{to,evidence,expectedOriginalName}] of Object.entries(members)) {
    if(expectedOriginalName&&declared.get(symbol)?.[5]!==expectedOriginalName)throw new Error('Reviewed local identity differs: '+symbol);
    add(symbol,to,`${symbol.slice(2).split('.')[0]}.java: ${evidence}`);
  }
  // Follow resolved override edges in both directions. A name never crosses an
  // unresolved or external contract, and contradictory reviewed names fail.
  const edges=rows.filter(row=>row[0]==='O').map(row=>[row[1],row[2]]);
  let changed=true;
  while(changed) {
    changed=false;
    for(const [a,b] of edges) {
      const left=rules.get(a),right=rules.get(b),known=left||right;
      if(!known) continue;
      if(left&&right&&left.to!==right.to) throw new Error('Conflicting override family: '+a);
      for(const symbol of [a,b]) {
        if(!declared.has(symbol)) throw new Error('Reviewed method overrides external contract: '+symbol);
        if(!rules.has(symbol)) {add(symbol,known.to,known.evidence+' Resolved override family.');changed=true;}
        const key=symbol.slice(2);
        for(const row of declarations.filter(row=>row[4].startsWith('P:'+key+'#'))) {
          const ordinal=row[4].slice(row[4].lastIndexOf('#'));
          const origin=rules.get('P:'+known.symbol.slice(2)+ordinal);
          if(origin&&!rules.has(row[4])) add(row[4],origin.to,origin.evidence+' Resolved override parameter.');
        }
      }
    }
  }
  for(const row of declarations) {
    if(/^M:[^.]+\.\$cfr\$sneakyThrow\(Ljava\/lang\/Throwable;\)Ljava\/lang\/RuntimeException;$/.test(row[4]))
      add(row[4],'rethrowUnchecked','Decompiler helper that rethrows its Throwable argument unchecked.');
    if(/^M:[^.]+\.\$cfr\$lcmp\(JJ\)I$/.test(row[4]))
      add(row[4],'compareLongs','Decompiler helper returning -1, 0 or 1 with JVM long comparison semantics.');
  }
  const sources=new Map(sourceInventory(input).map(file=>[file.path,fs.readFileSync(path.join(input,file.path),'utf8')]));
  for(const row of rows.filter(row=>row[0]==='T')) {
    const suffix=sources.get(row[1]).slice(Number(row[3]));
    const loop=/^\s*:\s*(?:while|for|do)\b/.test(suffix);
    const ordinal=Number(row[4].slice(row[4].lastIndexOf('#')+1))+1;
    rules.set(row[4],{symbol:row[4],originalName:row[5],to:(loop?'scanLoop':'regionExit')+ordinal,
      evidence:'Resolved lexical target and declaration ordinal; transfers are unchanged.',confidence:'structural'});
  }
  return [...rules.values()].sort((a,b)=>a.symbol<b.symbol?-1:1);
}

const workflowFiles=['build-steelsentinels-rules.mjs','steelsentinels-names.json','reproduce-steelsentinels.mjs','reconstruct-steel-explosion.mjs',
  'tests/test-steelsentinels-core.mjs','tests/archive-index-probe.mjs','game-export.mjs','compilation-stubs.mjs'];
export function validateSteelManifest(rules) {
  if(rules.schema!==1||rules.game!=='steelsentinels'||rules.source.commit!==SOURCE_COMMIT) throw new Error('Invalid Steel naming manifest');
  for(const [file,sha] of Object.entries(rules.readabilityWorkflow.files))
    if(digest(fs.readFileSync(path.join(workflowRoot,file)))!==sha) throw new Error('Naming workflow changed: '+file);
  if(JSON.stringify(rules.generators.namingTool)!==JSON.stringify(verifyToolPin())) throw new Error('Naming tool identity changed');
}
export function buildSteelGuide(rules,mapping) {
  const link=owner=>`[${classes[owner][0]}](${classes[owner][0]}.java)`;
  return ['# Reading Steel Sentinels','',
    'Java here is the single published version. Rebuild from pinned raw Git input with Deko’s `readable/reproduce-steelsentinels.mjs`. The current reverse dictionary is `../../decompilation/steelsentinels-naming.json`.','',
    `This gameplay naming pass names ${Object.keys(classes).length} reviewed classes across ${mapping.files.length} compiled classes. Unknown class/member purposes remain unresolved. Profile and charge names describe observed roles; finer encodings remain open. Renamed identifiers have no opaque suffixes; the dictionary preserves original identities.`, '',
    '| Start here | Follow |','| --- | --- |',
    `| ${link('nb')} → ${link('ee')} | Player control, game display, world updates and synchronization checksum. |`,
    `| ${link('mb')} | Sentinel position/velocity, player/team, chassis, modules, armour, charge, command queues and combat updates. |`,
    `| ${link('je')} | Action type/variant, scheduling, activation, target coordinates, aiming and start/end simulation ticks. |`,
    `| ${link('wl')} / ${link('jb')} / ${link('qb')} | Projectiles, explosions and visual effects. |`,
    `| ${link('hd')} | Terrain layout, ground/secondary/surface profiles and spawn positions. |`,
    `| ${link('ji')} → ${link('nk')} / ${link('qd')} | Engineering UI and sprite-backed articulated part configuration. |`,
    `| ${link('gi')} / ${link('kj')} / ${link('ie')} | Big-endian primitive/slice data, MSB-first bit fields, ciphered opcodes and deterministic seeded random generation. |`,
    `| ${link('uh')} | Long-key intrusive buckets, collision lookup and traversal. |`,
    `| ${link('cm')} → ${link('fa')} / ${link('fi')} / ${link('jl')} / ${link('jk')} | Resource loading, versioned archive indexes and group/file name lookup. |`, '',
    'Start with `Sentinel.scheduleCommand`, `advanceCommandQueues`, `executeCommand`, `CombatWorld.advanceSimulation`, `Sentinel.advanceCombatState`, `configureDesign`, `hasModuleType`, `reduceArmour` and `consumeCharge`. Positions retain their fixed-point scale: ground contacts index `worldX >> 4`, and terrain heights convert to inverted world Y with `-(height << 4)`. Physics velocities are distinct from armour; the sentinel constructor starts vertical velocity at 1000.','',
    '`computeSyncChecksum` retains Java integer wrapping and the original state fields. Module aliases, noncanonical dummy-guard behaviour, negative armour and unusual charge values are preserved. `ArticulatedPart.getTotalArmour` recursively aggregates attachment contributions.','',
    '`CipherPacketBuffer.beginBitReading`, `readBits` and `endBitReading` use a separate read bit cursor: bits are consumed most-significant first, then the byte cursor rounds up. `writeCipheredOpcode`, `readCipheredOpcode` and `readCipheredBytes` add/subtract successive ISAAC words modulo 256. `IsaacRandom.nextInt` consumes each 256-word block backwards; `nextIntBounded` rejects a tail of the 32-bit population before returning a nonnegative remainder. These names expose the existing wire/random behaviour without changing it. Dummy guards remain part of the original signatures.','',
    '`NodeHashTable` uses power-of-two bucket counts and intrusive nodes. `put` moves an already linked node; it does not replace a distinct node with the same key. `get` returns the first matching node and iteration visits buckets in ascending order. The packet/random/table classes retain unrelated static UI helpers from the original class layout.','',
    'ArchiveIndex decodes formats 5–7: versions 6/7 carry a revision, version 7 uses large-smart integers, and IDs are delta-coded. Names and 64-byte group digests are separate flag-controlled tables. Arrays are indexed by actual group/file IDs, with null fileIds rows representing contiguous IDs. IntKeyLookup linear-probes interleaved key/index slots and returns the first matching input index, including negative and duplicate keys. ResourceArchive lowercases names, exposes index availability, separates packed groups from unpacked files and retains the three existing file-retention modes. CachedArchiveProvider supplies validated indexes and encoded groups from cache/network requests. Independent fixtures cover raw and gzip containers, every version/flag combination, sparse/contiguous/large IDs, checksum and digest-length rejection, name lookup and returned-file retention. This does not establish cache/network end-to-end loading or server compatibility.','',
    'Compilation and symbol/override checks cover the complete game. The raw/named core probe independently checks module aliases/bonuses, armour and charge mutations, terrain boundaries, part aggregation, synchronization checksums, command timing, queue routing, ordering and equal-tick replacement. Packet fixtures cover every bit alignment/width, primitive byte order, slice offsets, cipher consumption across block boundaries, bounded-random rejection and hash collisions/duplicate keys. Ciphertext traces must also match the raw export; round trips alone are insufficient. It allocates controlled world/sentinel/terrain fixtures without game construction and replaces only the client branch-control flag at runtime. It does not prove whole-game playability, projectile simulation, rendering or live server compatibility. Dictionary reversal recovers every original source byte.','',
    'ParticleEffect now names duration, age, effect type and its choice of terrain profile. Age gains a random 0–3 increment below 200, followed by the ordinary increment; duration is not a guaranteed count of updates. Fixtures check damping with Java truncation, terrain contact/exceptions, gravity and strict age > duration expiry. Type 10 emits a type-9 child. createParticle initializes an object from a 10,000-entry cyclic reuse buffer, not a free list: acquisition neither checks liveness nor unlinks existing membership. pendingRemovals uses DualNodeDeque secondary links until world simulation unlinks the primary links. Probes preserve those boundaries and restore the global buffer/cursor afterward.','',
    'Projectile.advanceGuidedMotion exposes launch acceleration, target steering and the gravity gate. Its target and initial-direction fields and phase-dependent locals now have reviewed names. Independent launch/coasting fixtures cover zero vectors, signed motion and ages 0, 1, 19, 128 and 129 with transient visual emission suppressed. Steering helpers now expose 8192-unit angles and 16.16 sine/cosine. Fixtures cover full-turn trig values, axis/quadrant angles, bounded turning at ages 20–127, target updates/removal and the coasting boundary. The initial-direction reversal branch, rendered effects and complete projectile collisions remain unverified.','',
    'The pinned raw input reconstructs Explosion.advanceExplosion with the generic compiler’s bounded node splitting, copy certificate and original-edge proof. Native bytecode/old/new Java fixtures cover 790 scenarios and 2,288 checks with visual emission suppressed. BattleTerrain.java and rl.java retain dispatcher fallbacks; large methods and full collision/rendering work remain.',''].join('\n');
}
export function buildSteelManifest() {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'steel-naming-rules-'));
  try {
    const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout);
    const record=catalog.publication.games.steelsentinels;
    const rules={schema:1,game:'steelsentinels',version:7,
      source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/steelsentinels'},inputTreeSha256:record.sources.sha256};
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    const helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
    captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
    const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');
    fs.writeFileSync(files,sourceInventory(input).map(file=>file.path).join('\n')+'\n');
    captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);
    const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(line=>line.split('\t'));
    rules.renames=buildSteelRules(input,rows);
    const symbols=new Set(rules.renames.map(rule=>rule.symbol));
    rules.classNameLiterals={policy:'direct-owned-class-for-name',expectedEdits:rows.filter(row=>row[0]==='S'&&symbols.has(row[4])).length};
    rules.labels={policy:'lexical-targets',expectedEdits:rows.filter(row=>['T','B','N'].includes(row[0])&&symbols.has(row[4])).length};
    if(rows.some(row=>row[0]==='U'&&symbols.has(row[4]))) throw new Error('Unsupported escaped class-name literal');
    rules.publication={stubSourceTreeSha256:stubs.sourceTreeSha256,stubJarSha256:digest(fs.readFileSync(stubs.jar))};
    rules.readabilityWorkflow={repository:'Kreijstal/dekobloko-work',files:Object.fromEntries(workflowFiles.map(file=>[file,digest(fs.readFileSync(path.join(workflowRoot,file)))]))};
    rules.generators={javaTools:record.sourceGenerator,namingTool:verifyToolPin()};
    return rules;
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const rules=buildSteelManifest(),file=path.join(workflowRoot,'steelsentinels-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';
    if(process.argv.includes('--check')) {if(fs.readFileSync(file,'utf8')!==bytes) throw new Error('Steel rules differ from regeneration');}
    else fs.writeFileSync(file,bytes);
    console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));
  } catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
}
