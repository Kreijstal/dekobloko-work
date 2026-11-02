import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Kickabout export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  gn: ['IntrusiveNode', 'Same shared role as GeoBlox IntrusiveNode: long key plus two node links; base of most Kickabout objects.'],
  ah: ['GameAppletShell', 'Abstract Applet/Runnable with focus and window listeners; root of the Kickabout applet chain.'],
  iw: ['PacketBuffer', 'Same shared role as GeoBlox PacketBuffer: node subclass with byte payload, cursor and big-endian primitive/string/slice encodings.'],
  ml: ['CipherPacketBuffer', 'iw subclass owning the aq ISAAC generator for opcode encryption, matching the shared cipher buffer role.'],
  aq: ['IsaacRandom', 'Result and memory int arrays refilled in 256-word batches, and contains the golden-ratio seed constant; same role as shared IsaacRandom.'],
  ht: ['IterableNodeHashTable', 'Power-of-two array of circular IntrusiveNode buckets keyed by long, implementing Iterable.'],
  kc: ['IntrusiveNodeHashTable', 'Power-of-two circular IntrusiveNode buckets keyed by long with insert, lookup and bucket-order traversal.'],
  bs: ['ClientException', 'RuntimeException wrapper retaining the original cause and appended client context string.'],
  ma: ['NetworkGameClient', 'GameAppletShell subclass reading applet parameters (affid, gamecrc, gameport1/2, countrylist.ws) and owning shared account/connection client state; same role as Ace of Skies NetworkGameClient.'],
  mo: ['MatchAgent', 'Abstract synchronised match-state component with abstract copy-from and CipherPacketBuffer decode; every subclass toString is "Agent...".'],
  nu: ['CommonGame', 'Match state whose toString prints "CommonGame(players=..)", phase (TeamSelection..GameOver), surface, tier, winner, per-participant flags and queued moves.'],
  nl: ['FootballerAgent', 'MatchAgent whose toString prints "AgentFootballer[archetype]" with location, speed, action, direction, kick and tackle state.'],
  tj: ['BallAgent', 'MatchAgent whose toString prints "AgentBall" with position, velocity, possessor, uncatchable and high-friction flags.'],
  ua: ['GoalStateAgent', 'MatchAgent whose toString prints "AgentGoalState" with two team scores, goal count and goal scorer.'],
  oe: ['TeamSelectionAgent', 'MatchAgent whose toString prints "AgentTeamSelection" with ready flags and per-slot selection.'],
  wr: ['FormationAgent', 'MatchAgent whose toString prints "AgentFormation" with per-team formation choices.'],
  wl: ['LineupAgent', 'MatchAgent whose toString prints "AgentLineup" with per-participant lineup slots.'],
  gt: ['ParticipantStatus', 'Per-participant flags printed by CommonGame.toString: offer_draw, resigned, departed, loaded_pitch, reward and megamode; decoded from the network buffer. Unrelated static helpers remain.'],
  ch: ['LoggedGoal', 'toString returns "LoggedGoal{..}" with scorer/ball positions, goal type (kick, cross, header) and match time.'],
// BEGIN-R2CLASSES
  a: ['JavaSoundAudioOutput', 'Extends the shared audio player base and writes PCM through javax.sound; same shape as Pool JavaSoundAudioOutput.'],
  uh: ['PcmPlayerService', 'Base class for the audio output backends, same shape as Sol Knight PcmPlayerService.'],
  as: ['SoundFilter', 'Byte-identical shape to Ace of Skies SoundFilter (synth filter coefficients).'],
  au: ['Bzip2Decoder', 'Same decoder structure as the Bzip2Decoder in Steel Sentinels and Lexicominos.'],
  bj: ['CacheFileLocator', 'Same cache-file path resolver as Ace of Skies CacheFileLocator.'],
  ed: ['SoundEffect', 'Same synthesized sound effect container as Steel Sentinels SoundEffect.'],
  fe: ['AwtFullscreenController', 'Same AWT fullscreen switcher as Ace of Skies AwtFullscreenController.'],
  fl: ['AwtCursorBridge', 'Same cursor bridge as Ace of Skies AwtCursorBridge.'],
  fq: ['SoundEnvelope', 'Same synth envelope as Ace of Skies SoundEnvelope.'],
  gh: ['MicrosoftDisplayController', 'Implements IEnumModesCallback like Ace of Skies MicrosoftDisplayController.'],
  gq: ['PcmStreamMixer', 'Same mixer of PcmStream children as Ace of Skies PcmStreamMixer.'],
  hb: ['VorbisResidue', 'Same Vorbis residue decoder as Ace of Skies VorbisResidue.'],
  ho: ['VorbisCodebook', 'Same Vorbis codebook as Ace of Skies VorbisCodebook.'],
  km: ['VorbisFloor', 'Same Vorbis floor decoder as Ace of Skies VorbisFloor.'],
  kv: ['SynthesizedSoundInstrument', 'Same synth instrument as Ace of Skies SynthesizedSoundInstrument.'],
  lq: ['PcmStream', 'Abstract node that mixes int samples into a buffer, same as Sol Knight PcmStream.'],
  qm: ['MusicTrack', 'Same music track node as Ace of Skies MusicTrack.'],
  rs: ['MidiFileReader', 'Same MIDI parser as Steel Sentinels MidiFileReader.'],
  tg: ['VorbisSample', 'Same Vorbis sample node as Ace of Skies VorbisSample.'],
  wg: ['MicrosoftCursorController', 'Extends com.ms.dll.Callback like Ace of Skies MicrosoftCursorController.'],
  wu: ['PlatformTask', 'Request object with volatile status and result, same as GeoBlox PlatformTask.'],
  bu: ['PlatformTaskDispatcher', 'Runnable worker that runs queued platform tasks, same as Pool PlatformTaskDispatcher.'],
  on: ['SoftwareRasterizer', 'Same software rasterizer statics as Sol Knight SoftwareRasterizer.'],
  ut: ['Sprite', 'Int-pixel sprite with blit methods, same as Shattered Plans Sprite.'],
  ot: ['ArgbSprite', 'Sprite subclass with per-pixel alpha, same as Sol Knight ArgbSprite.'],
  vm: ['PcmSampleStream', 'Stream over a decoded PcmSample, same as Ace of Skies PcmSampleStream.'],
  ru: ['MidiPcmStream', 'Stream that sequences MIDI into PCM, same as Ace of Skies MidiPcmStream.'],
  hu: ['BitmapFont', 'Abstract glyph font with string drawing and measuring, same as Steel Sentinels BitmapFont.'],
  fd: ['UiWidget', 'Base widget with bounds, hover and key handling, same as Shattered Plans UiWidget.'],
  ke: ['WidgetTextLayout', 'Interface identical to Steel Sentinels WidgetTextLayout.'],
  ku: ['MouseInputHandler', 'Implements the AWT mouse and focus listeners and records pointer state.'],
  de: ['GameKeyHandler', 'Implements the AWT key and focus listeners and records key state.'],
  vq: ['FullscreenFocusCanvas', 'Canvas with a Frame field that forwards focus events, same role as GeoBlox FullscreenFocusCanvas.'],
  u: ['JaggrabDownloader', 'Runnable that opens JAGGRAB requests and reads the reply into a PacketBuffer.'],
  tu: ['GameLoopApplet', 'Abstract NetworkGameClient subclass that Kickabout extends and that declares the per-frame hooks.'],
  sj: ['ResourceArchive', 'Group and file store over an ArchiveIndex and ArchiveSource with load and unpack methods.'],
  kl: ['ArchiveIndex', 'Holds file counts, name hashes and offsets for a ResourceArchive.'],
  ow: ['ArchiveSource', 'Abstract provider of archive indexes and bytes, same as Sol Knight ArchiveSource.'],
  wm: ['CachedArchiveSource', 'ArchiveSource subclass that caches fetched groups, same as Sol Knight CachedArchiveSource.'],
  og: ['RasterBuffer', 'Abstract int-pixel frame buffer with paint hooks for Graphics and Component.'],
  dh: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer.'],
  dq: ['ProxySocketConnector', 'SocketConnector that issues CONNECT through the JVM proxy selector.'],
  av: ['SocketConnector', 'Abstract factory returning a Socket.'],
  bh: ['BufferedSocket', 'Runnable that buffers a Socket\'s input and output streams.'],
  ov: ['NodeHashTableIterator', 'Iterator over IterableNodeHashTable buckets.'],
  nw: ['IntrusiveDequeCursor', 'Cursor that walks an IntrusiveDeque with next and previous.'],
  tf: ['IntrusiveDeque', 'Circular deque of IntrusiveNode with head and tail operations.'],
  o: ['DualLinkDeque', 'Deque of DualLinkNode with head and tail operations.'],
  am: ['DualLinkNode', 'Node with two link fields plus a long key, same as Pixelate DualLinkNode.'],
  qh: ['SectorCacheStore', 'Reads and writes 520-byte sector chains in cache files, as Ace of Skies SectorCacheStore.'],
  bi: ['ArchiveNetworkClient', 'Abstract archive request client with request queues and PacketBuffers.'],
  rg: ['MouseWheelInput', 'Abstract wheel delta source subclassed by the AWT listener.'],
  rh: ['AwtMouseWheelInput', 'Registers a MouseWheelListener on the canvas and accumulates the delta.'],
  mm: ['AppletJavaScriptBridge', 'Calls JSObject.getWindow(applet).call and eval.'],
  ew: ['BufferedCacheFile', 'Buffers positional reads and writes over a RandomAccessCacheFile, as Sol Knight BufferedCacheFile.'],
  ao: ['RandomAccessCacheFile', 'Wraps a RandomAccessFile with seek, read and write used by the disk cache.'],
  lu: ['SpriteState', 'Abstract DualLinkNode subclass holding the clip bounds of a drawable, as Sol Knight SpriteState.'],
  ga: ['TextInputWidget', 'Editable text widget with cursor, selection and system clipboard copy and paste.'],
  wj: ['WidgetContainer', 'UiWidget that owns an IntrusiveDeque of child widgets and routes events to them.'],
  qc: ['ModelMeshBase', 'Abstract base of the 3D mesh classes; its method bodies match Armies of Gielinor ModelMeshBase.'],
  eg: ['ModelMesh', 'Fifteen of its 21 method bodies match Armies of Gielinor ModelMesh.'],
  t: ['TriangleRasterizer', 'Eleven of its 12 method bodies match Armies of Gielinor TriangleRasterizer.'],
  dp: ['ReverbPcmStream', 'PcmStream subclass whose literals and bodies match Escape Vector ReverbPcmStream.'],
  lc: ['DualLinkDequeIterator', 'Iterator over a DualLinkDeque, with bodies matching SecondaryNodeDequeIterator in other games.'],
  kg: ['IndexedSprite', 'All nine method bodies match IndexedSprite in other games.'],
  qd: ['IndexedSpriteState', 'Superclass of IndexedSprite holding palette and size state.'],
  cn: ['CoverageBitmapFont', 'BitmapFont subclass blending 8-bit glyph coverage with the draw colour, as Lexicominos CoverageBitmapFont.'],
  uo: ['BinaryBitmapFont', 'BitmapFont subclass drawing 1-bit glyph masks, as Lexicominos BinaryBitmapFont.'],
  dm: ['AbstractPcmSample', 'Abstract IntrusiveNode base of PcmSample, PcmStream and the output service.'],
  to: ['PcmSample', 'AbstractPcmSample holding a byte[] with start and end loop bounds.'],
  dv: ['ArrayOperations', 'Static array helpers whose four method bodies match ArrayOperations in GeoBlox.'],
  sa: ['DelegatingCanvas', 'Canvas subclass forwarding paint and update to its component, as GeoBlox DelegatingCanvas.'],
  pm: ['BufferedImageRasterBuffer', 'RasterBuffer subclass with no-argument constructor and Graphics paint, as GeoBlox BufferedImageRasterBuffer.'],
  ct: ['SingleChildContainer', 'UiWidget implementing the container marker that wraps one child, as Steel Sentinels SingleChildContainer.'],
  jg: ['DraggableWidget', 'SingleChildContainer subclass that tracks drags, as Steel Sentinels DraggableWidget.'],
  ln: ['DropTargetWidget', 'SingleChildContainer subclass that accepts drops, as Steel Sentinels DropTargetWidget.'],
  pj: ['AlphaContainer', 'SingleChildContainer subclass applying a translucency level to its child.'],
  se: ['ModalStack', 'SingleChildContainer that stacks ModalPanel instances, as Steel Sentinels ModalStack.'],
  ub: ['ModalPanel', 'Abstract WidgetContainer base of the modal dialogs, as Steel Sentinels ModalPanel.'],
  cm: ['ResizableModalPanel', 'ModalPanel subclass that resizes, as Steel Sentinels ResizableModalPanel.'],
  mu: ['ContentTransitionDialog', 'Abstract ResizableModalPanel that swaps its content, as Steel Sentinels ContentTransitionDialog.'],
  wv: ['AccountRequestDialog', 'ContentTransitionDialog subclass implementing the button listener, as Steel Sentinels AccountRequestDialog.'],
  jn: ['RegistrationRequestDialog', 'AccountRequestDialog subclass hosting the registration panels, as Steel Sentinels RegistrationRequestDialog.'],
  oj: ['LoadingProgressDialog', 'ResizableModalPanel whose constructor takes a message and shows progress, as Steel Sentinels LoadingProgressDialog.'],
  mb: ['DisplayNameForm', 'WidgetContainer implementing the name suggestion and button listeners, as Steel Sentinels DisplayNameForm.'],
  pd: ['LoginForm', 'WidgetContainer implementing the text input and button listeners with username and password fields, as Steel Sentinels LoginForm.'],
  qp: ['AccountMessagePanel', 'WidgetContainer showing a message with one button, as Steel Sentinels AccountMessagePanel.'],
  fr: ['NameSuggestionsPanel', 'WidgetContainer listing suggested names as buttons, as Steel Sentinels NameSuggestionsPanel.'],
  ae: ['AccountRegistrationPanel', 'Registration form linking terms, conduct and privacy pages, as Steel Sentinels AccountRegistrationPanel.'],
  ai: ['AccountTermsPanel', 'Terms panel with a hotspot link and a button, as Steel Sentinels AccountTermsPanel.'],
  nn: ['AccountChoicePanel', 'Panel with three buttons routing to the account flows, as Steel Sentinels AccountChoicePanel.'],
  cj: ['DateInputWidget', 'Abstract ValidationProvider container for date entry, as Steel Sentinels DateInputWidget.'],
  fb: ['NumericDateInputWidget', 'DateInputWidget subclass with numeric fields, as Steel Sentinels NumericDateInputWidget.'],
  wi: ['TextButton', 'UiWidget with label, painter and listener fields, as Steel Sentinels TextButton.'],
  lb: ['TextHotspotWidget', 'TextButton subclass parsing hotspot tags, as Steel Sentinels TextHotspotWidget.'],
  qk: ['Checkbox', 'TextButton subclass with a boolean toggle constructor, as Steel Sentinels Checkbox.'],
  mr: ['ValidatedTextWidget', 'TextInputWidget subclass implementing ValidationProvider, as Steel Sentinels ValidatedTextWidget.'],
  qv: ['TextWidgetPainter', 'WidgetPainter and WidgetTextLayout implementation, as Steel Sentinels TextWidgetPainter.'],
  jp: ['UiContainerMarker', 'Empty marker interface implemented by the container widgets.'],
  vh: ['ButtonListener', 'Callback invoked with the pressed TextButton, as Steel Sentinels ButtonListener.'],
  jv: ['UiListener', 'Empty base interface of the listener interfaces.'],
  sv: ['TextInputListener', 'Listener callback taking a TextInputWidget, as Steel Sentinels TextInputListener.'],
  ur: ['NameSuggestionListener', 'Listener taking the chosen suggested name, as Steel Sentinels NameSuggestionListener.'],
  qu: ['TextHotspotListener', 'Listener taking a TextHotspotWidget click, as Steel Sentinels TextHotspotListener.'],
  gj: ['WidgetPainter', 'Painter interface implemented by TextWidgetPainter, as Steel Sentinels WidgetPainter.'],
  cw: ['ValidationProvider', 'Interface returning a ValidationSource, as Steel Sentinels ValidationProvider.'],
  l: ['ValidationSource', 'Interface exposing validity state, as Steel Sentinels ValidationSource.'],
  tm: ['ConsoleCommand', 'Abstract named command with parameter classes and description, as Armies of Gielinor ConsoleCommand.'],
  li: ['ConsoleValue', 'Boxed console value with long, boolean, double, char and object constructors, as Armies of Gielinor ConsoleValue.'],
  lk: ['ConsoleExpression', 'Token node printing Method, Number, Boolean, Char, String, ArgStart, ArgEnd and ArgComma, as Armies of Gielinor ConsoleExpression.'],
  be: ['ConsolePanel', 'Abstract console base implementing the key handler, as Armies of Gielinor ConsolePanel.'],
  kd: ['DebugConsole', 'ConsolePanel holding the ConsoleCommand array and printing the FunOrbConsole banner.'],
  dw: ['ConsoleEvaluationException', 'Exception thrown by ConsoleExpression for invalid char and number values.'],
  fi: ['ConsoleParseException', 'Exception constructed from a token source offset, as Armies of Gielinor ConsoleParseException.'],
  hm: ['SumIntegersCommand', 'Registered under the console name sumIntegers.'],
  kb: ['WriteIntegersCommand', 'Registered under the console name writeIntegers.'],
  jo: ['DemoIntegersCommand', 'Registered under the console name demoIntegers.'],
  jf: ['DoSomethingCommand', 'Registered under the console name doSomething.'],
  ir: ['ThreeCommand', 'Registered under the console name three.'],
  pb: ['IsSixCommand', 'Registered under the console name isSix.'],
  tq: ['NotCommand', 'Registered under the console name not.'],
  ik: ['IntDoubleCommand', 'Registered under the console name intDouble.'],
  uc: ['IntTripleCommand', 'Registered under the console name intTriple.'],
  ev: ['LongPlusOneCommand', 'Registered under the console name LongPlusOne.'],
  el: ['BytePlusOneCommand', 'Registered under the console name BytePlusOne.'],
  ls: ['BigCommand', 'Registered under the console name big.'],
  uj: ['SetLagCommand', 'Registered under the console name set_lag.'],
  lh: ['BroadcastServerCommand', 'Registered under the console name broadcast_server.'],
// END-R2CLASSES
  jc: ['LoggedPlayer', 'toString returns "LoggedPlayer{..}" with home/away side, resign time, reward, membership, tackle, kick, cross, header and goal counters.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, evidence) {
  members['M:' + owner + '.' + original + descriptor] = {to, evidence};
}
const T = 'Printed under this label by toString.';
method('nu', 'c', '(B)Ljava/lang/String;', 'phaseName', 'Maps phase 0..5 to TeamSelection, WaitForPlayers, Formation, LineUp, Playing and GameOver.');
field('nu', 'u', 'I', 'phase', 'Compared with 0..5 by phaseName; toString prints it as phase.');
field('nu', 'v', 'I', 'phaseTime', T + ' (phase_time)');
field('nu', 'I', 'I', 'playerCount', T + ' (players)');
field('nu', 'O', 'I', 'timeLimit', T + ' (timelimit)');
field('nu', 't', 'I', 'surface', T);
field('nu', 'm', 'I', 'tier', T);
field('nu', 'Z', 'I', 'winner', T);
field('nu', 'J', 'I', 'aiTick', T + ' (ai_tick)');
field('nu', 'G', 'Z', 'bigHeadMode', T + ' (bigheadmode)');
field('nu', 's', 'Z', 'disableLocal', T + ' (disable_local)');
field('nu', 'p', 'Z', 'disableOpponent', T + ' (disable_opponent)');
field('nu', 'R', '[Lgt;', 'participantStatus', 'Indexed per participant; each element prints the status flags.');
field('gt', 'q', 'Z', 'offerDraw', 'CommonGame.toString prints offer_draw when set.');
field('gt', 's', 'Z', 'resigned', 'CommonGame.toString prints resigned when set.');
field('gt', 'v', 'Z', 'departed', 'CommonGame.toString prints departed when set.');
field('gt', 'i', 'Z', 'loadedPitch', 'CommonGame.toString prints !loaded_pitch when clear.');
field('gt', 'n', 'Z', 'rewardEligible', 'CommonGame.toString prints !reward when clear.');
field('gt', 'u', 'Z', 'megamode', 'CommonGame.toString prints megamode when set.');
method('nl', 'c', '(Z)Ljava/lang/String;', 'actionName', 'Maps action codes to Idle, ACTION_KICK, ACTION_TACKLE, ACTION_DASH, ACTION_DIVE, ACTION_HEADER and similar.');
method('nl', 'c', '(I)Ljava/lang/String;', 'archetypeName', 'Maps archetype codes 0..4 to Tank, Htshot, Elite, Ranger and Keeper.');
field('nl', 'u', 'I', 'action', 'Switched on by actionName.');
field('nl', 'J', 'I', 'archetype', 'Switched on by archetypeName; toString treats 4 as keeper.');
field('nl', 'I', 'I', 'aiWait', 'toString prints it as ai_wait.');
field('nl', 'l', 'Z', 'megamode', 'toString prints MEGAMODE when set.');
field('nl', 'y', 'Z', 'member', 'toString prints member/!member.');
field('tj', 'r', 'I', 'uncatchable', T);
field('tj', 'A', 'I', 'highFriction', T + ' (high_friction)');
field('tj', 'l', 'I', 'modelId', T + ' (model_id)');
field('ua', 'j', '[I', 'score', 'toString prints it as the two-element score.');
field('ua', 'm', 'I', 'goalCount', T + ' (goal_count)');
field('ua', 'n', 'I', 'goalScorer', T + ' (goal_scorer)');
field('ch', 't', 'I', 'goalType', 'toString prints null, kick, cross or header from values 0..3.');
field('ch', 'l', 'I', 'time', T);
field('jc', 'o', 'Z', 'home', 'toString prints home or away.');
field('jc', 'p', 'I', 'resignTime', T + ' (resigntime)');
field('jc', 'j', 'I', 'crosses', T);
field('jc', 'h', 'I', 'headers', T);

// BEGIN-R2MEMBERS
method('a', 'f', '()V', 'closeDevice', 'Body is identical to escapevector/geoblox JavaSoundAudioOutput.closeDevice.');
method('ah', '$cfr$lcmp', '(JJ)I', 'compareLongs', 'Body is identical to escapevector GameAppletShell.compareLongs.');
method('as', 'a', '(IF)I', 'computeCoefficients', 'Body is identical to armiesofgielinor/geoblox SoundFilter.computeCoefficients.');
method('as', 'b', '(IIF)F', 'interpolateRadius', 'Body is identical to armiesofgielinor/geoblox SoundFilter.interpolateRadius.');
method('au', 'a', '(ILos;)I', 'readBits', 'Body is identical to armiesofgielinor/brickabrac Bzip2Decoder.readBits.');
method('au', 'a', '(Los;)V', 'buildSymbolMap', 'Body is identical to armiesofgielinor/brickabrac Bzip2Decoder.buildSymbolMap.');
method('au', 'a', '([I[I[I[BIII)V', 'buildHuffmanTables', 'Body is identical to armiesofgielinor/brickabrac Bzip2Decoder.buildHuffmanTables.');
method('au', 'd', '(Los;)V', 'decodeBlocks', 'Body is identical to armiesofgielinor/brickabrac Bzip2Decoder.decodeBlocks.');
method('av', 'c', '(I)Ljava/net/Socket;', 'connectDirect', 'Body is identical to geoblox SocketConnector.connectDirect.');
method('fq', 'a', '(Liw;)V', 'decode', 'Body is identical to steelsentinels SoundEnvelope.decode.');
method('gq', 'a', '(Lgn;Lme;)V', 'insertListenerByFrameOffset', 'Body is identical to geoblox PcmStreamMixer.insertListenerByFrameOffset.');
method('gq', 'a', '(Llq;)V', 'addSubStream', 'Body is identical to armiesofgielinor PcmStreamMixer.addSubStream.');
method('gq', 'b', '(Llq;)V', 'removeSubstream', 'Body is identical to escapevector PcmStreamMixer.removeSubstream.');
method('gq', 'c', '([III)V', 'mixChildStreams', 'Body is identical to geoblox PcmStreamMixer.mixChildStreams.');
method('hu', 'a', '(C)I', 'charWidth', 'Body is identical to trackcontroller BitmapFont.charWidth.');
method('km', 'a', '(II)V', 'sortPoints', 'Body is identical to armiesofgielinor/steelsentinels VorbisFloor.sortPoints.');
method('km', 'a', '(IIIII)I', 'interpolatePoint', 'Body is identical to armiesofgielinor/escapevector VorbisFloor.interpolatePoint.');
method('km', 'a', '(IIII[FI)V', 'applyLine', 'Body is identical to armiesofgielinor/steelsentinels VorbisFloor.applyLine.');
method('km', 'a', '([FI)V', 'applyFloor', 'Body is identical to armiesofgielinor/steelsentinels VorbisFloor.applyFloor.');
method('km', 'a', '([II)I', 'highNeighbour', 'Body is identical to armiesofgielinor/steelsentinels VorbisFloor.highNeighbour.');
method('km', 'b', '([II)I', 'lowNeighbour', 'Body is identical to armiesofgielinor/steelsentinels VorbisFloor.lowNeighbour.');
method('kv', 'a', '(III)I', 'evaluateWaveform', 'Body is identical to geoblox SynthesizedSoundInstrument.evaluateWaveform.');
method('on', 'a', '(III)V', 'setPixel', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.setPixel.');
method('on', 'a', '(I[IIIII)V', 'darkenRows', 'Body is identical to escapevector SoftwareRasterizer.darkenRows.');
method('on', 'a', '([I)V', 'saveClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.saveClip.');
method('on', 'a', '([IIIIIIIII)V', 'blurColumnsInPlace', 'Body is identical to geoblox SoftwareRasterizer.blurColumnsInPlace.');
method('on', 'b', '(IIIII)V', 'drawLine', 'Body is identical to geoblox SoftwareRasterizer.drawLine.');
method('on', 'b', '([I)V', 'restoreClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.restoreClip.');
method('on', 'c', '(IIII)V', 'drawCircle', 'Body is identical to geoblox SoftwareRasterizer.drawCircle.');
method('on', 'd', '(IIII)V', 'fillCircle', 'Body is identical to geoblox SoftwareRasterizer.fillCircle.');
method('on', 'd', '(IIIII)V', 'drawRectangleDropShadow', 'Body is identical to geoblox SoftwareRasterizer.drawRectangleDropShadow.');
method('on', 'e', '(IIII)V', 'setClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.setClip.');
method('on', 'f', '(IIII)V', 'drawHorizontalLine', 'Body is identical to wizardrun SoftwareRasterizer.drawHorizontalLine.');
method('on', 'f', '(IIIIII)V', 'drawRoundedRectangle', 'Body is identical to geoblox SoftwareRasterizer.drawRoundedRectangle.');
method('on', 'g', '(IIII)V', 'darkenRectangle', 'Body is identical to escapevector SoftwareRasterizer.darkenRectangle.');
method('on', 'g', '(IIIIII)V', 'fillVerticalGradient', 'Body is identical to geoblox SoftwareRasterizer.fillVerticalGradient.');
method('on', 'h', '(IIII)V', 'intersectClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.intersectClip.');
method('on', 'h', '(IIIIII)V', 'drawRectangleAlpha', 'Body is identical to escapevector SoftwareRasterizer.drawRectangleAlpha.');
method('on', 'i', '(IIIIII)V', 'fillRoundedRectangle', 'Body is identical to geoblox SoftwareRasterizer.fillRoundedRectangle.');
method('ot', 'g', '(II)V', 'drawQuarterSize', 'Body is identical to armiesofgielinor/brickabrac ArgbSprite.drawQuarterSize.');
method('rs', 'a', '()Z', 'isDone', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.isDone.');
method('rs', 'a', '(J)V', 'reset', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.reset.');
method('rs', 'c', '(I)V', 'seekTrack', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.seekTrack.');
method('rs', 'd', '(I)V', 'readDelta', 'Body is identical to steelsentinels MidiFileReader.readDelta.');
method('rs', 'f', '(I)I', 'readMessage', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.readMessage.');
method('rs', 'g', '()I', 'nextTrack', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.nextTrack.');
method('ut', 'a', '(I)V', 'addOutline', 'Body is identical to geoblox Sprite.addOutline.');
method('ut', 'a', '([I[IIIIIII)V', 'blitUnmasked', 'Body is identical to geoblox Sprite.blitUnmasked.');
method('ut', 'b', '()Lut;', 'copy', 'Body is identical to geoblox/wizardrun Sprite.copy.');
method('ut', 'b', '(IIIIII)V', 'rotateSmooth', 'Body is identical to geoblox Sprite.rotateSmooth.');
method('ut', 'b', '([I[IIIIIIIIIIII)V', 'blitColorKeyScaledAlpha', 'Body is identical to geoblox Sprite.blitColorKeyScaledAlpha.');
method('ut', 'c', '(III)V', 'drawAdditive', 'Body is identical to geoblox Sprite.drawAdditive.');
method('ut', 'c', '(IIIII)V', 'drawScaledSilhouette', 'Body is identical to geoblox Sprite.drawScaledSilhouette.');
method('ut', 'f', '(II)V', 'drawHalfSize', 'Body is identical to escapevector/geoblox Sprite.drawHalfSize.');
method('vm', 'a', '(II[B[IIIIIIIIIILvm;II)I', 'mixReverseStereoInterpolatedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseStereoInterpolatedRamp.');
method('vm', 'a', '(II[B[IIIIIIIILvm;II)I', 'mixReverseStereoInterpolated', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseStereoInterpolated.');
method('vm', 'a', '(II[B[IIIIIIILvm;II)I', 'mixReverseMonoInterpolated', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseMonoInterpolated.');
method('vm', 'a', '(I[B[IIIIIIIIIILvm;)I', 'mixForwardStereoAlignedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardStereoAlignedRamp.');
method('vm', 'a', '(I[B[IIIIIIIILvm;)I', 'mixReverseStereoAligned', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseStereoAligned.');
method('vm', 'a', '(Lto;III)Lvm;', 'createAtRatePercentQ6', 'Body is identical to steelsentinels PcmSampleStream.createAtRatePercentQ6.');
method('vm', 'a', '(Z)V', 'setReversePlayback', 'Body is identical to geoblox/steelsentinels PcmSampleStream.setReversePlayback.');
method('vm', 'a', '([B[IIIIIIIILvm;)I', 'mixForwardMonoAlignedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardMonoAlignedRamp.');
method('vm', 'a', '([B[IIIIIIILvm;)I', 'mixReverseMonoAligned', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseMonoAligned.');
method('vm', 'b', '(II[B[IIIIIIIIIILvm;II)I', 'mixForwardStereoInterpolatedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardStereoInterpolatedRamp.');
method('vm', 'b', '(II[B[IIIIIIIILvm;II)I', 'mixForwardStereoInterpolated', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardStereoInterpolated.');
method('vm', 'b', '(II[B[IIIIIIILvm;II)I', 'mixForwardMonoInterpolated', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardMonoInterpolated.');
method('vm', 'b', '(I[B[IIIIIIIIIILvm;)I', 'mixReverseStereoAlignedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseStereoAlignedRamp.');
method('vm', 'b', '(I[B[IIIIIIIILvm;)I', 'mixForwardStereoAligned', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardStereoAligned.');
method('vm', 'b', '([B[IIIIIIIILvm;)I', 'mixReverseMonoAlignedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixReverseMonoAlignedRamp.');
method('vm', 'b', '([B[IIIIIIILvm;)I', 'mixForwardMonoAligned', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardMonoAligned.');
method('vm', 'd', '(II[B[IIIIIIIILvm;II)I', 'mixForwardMonoInterpolatedRamp', 'Body is identical to geoblox/steelsentinels PcmSampleStream.mixForwardMonoInterpolatedRamp.');
method('vm', 'e', '()I', 'getSampleStepMagnitude', 'Body is identical to geoblox/steelsentinels PcmSampleStream.getSampleStepMagnitude.');
method('vm', 'f', '()Z', 'isSamplePositionOutOfRange', 'Body is identical to geoblox/steelsentinels PcmSampleStream.isSamplePositionOutOfRange.');
method('vm', 'f', '(I)V', 'setVolume', 'Body is identical to escapevector PcmSampleStream.setVolume.');
method('vm', 'i', '()V', 'playBackwardFromEnd', 'Body is identical to escapevector PcmSampleStream.playBackwardFromEnd.');
method('vm', 'i', '(I)V', 'setSamplePositionFixed', 'Body is identical to geoblox PcmSampleStream.setSamplePositionFixed.');
method('vm', 'm', '()I', 'getTargetVolume', 'Body is identical to geoblox/steelsentinels PcmSampleStream.getTargetVolume.');
method('qc', 'a', '(Lef;ILef;IIIZ)V', 'applyAnimationFrame', 'Body is identical to armiesofgielinor ModelMeshBase.applyAnimationFrame.');
method('qc', 'a', '(Lje;Ldb;Ldb;II[ZZZI[I)V', 'blendAnimationFrames', 'Body is identical to armiesofgielinor ModelMeshBase.blendAnimationFrames.');
method('eg', 'a', '(I[IIIIZ)V', 'applyGroupTransform', 'Body is identical to armiesofgielinor ModelMesh.applyGroupTransform.');
method('eg', 'a', '(I[IIIIZI[I)V', 'applyMaskedGroupTransform', 'Body is identical to armiesofgielinor ModelMesh.applyMaskedGroupTransform.');
method('eg', 'd', '()V', 'releaseStatics', 'Body is identical to armiesofgielinor ModelMesh.releaseStatics.');
method('eg', 'd', '(I)I', 'clampHslLightness', 'Body is identical to armiesofgielinor ModelMesh.clampHslLightness.');
method('t', 'a', '(IIIIIII)V', 'drawFlatTriangle', 'Body is identical to armiesofgielinor TriangleRasterizer.drawFlatTriangle.');
method('t', 'a', '(IIIIIIIII)V', 'drawShadedTriangle', 'Body is identical to armiesofgielinor TriangleRasterizer.drawShadedTriangle.');
method('dp', 'c', '(F)V', 'setDampingTimeMicros', 'Body is identical to escapevector ReverbPcmStream.setDampingTimeMicros.');
method('kg', 'a', '()Lut;', 'toRgbSprite', 'Body is identical to armiesofgielinor/brickabrac IndexedSprite.toRgbSprite.');
method('cn', 'a', '([I[[B)[[B', 'convertPaletteGlyphsToCoverageInPlace', 'Body is identical to steelsentinels CoverageBitmapFont.convertPaletteGlyphsToCoverageInPlace.');
method('uo', 'a', '(IIIIIIZ)V', 'drawGlyph', 'Body is identical to armiesofgielinor/steelsentinels BinaryBitmapFont.drawGlyph.');
method('uo', 'a', '([I[BIIIIIII)V', 'blitBinaryGlyph', 'Body is identical to armiesofgielinor/steelsentinels BinaryBitmapFont.blitBinaryGlyph.');
method('uo', 'a', '([I[BIIIIIIIII[I[I)V', 'blitMaskedGlyph', 'Body is identical to armiesofgielinor/steelsentinels BinaryBitmapFont.blitMaskedGlyph.');
method('uo', 'b', '([I[BIIIIIIII)V', 'blitBinaryGlyphWithAlpha', 'Body is identical to armiesofgielinor/steelsentinels BinaryBitmapFont.blitBinaryGlyphWithAlpha.');
method('pm', 'a', '(IIILjava/awt/Graphics;)V', 'drawImage', 'Body is identical to escapevector BufferedImageRasterBuffer.drawImage.');
method('ub', 'a', '(Z)Lfd;', 'findFocusedChild', 'Body is identical to escapevector ModalPanel.findFocusedChild.');
method('a', 'a', '(Ljava/awt/Component;)V', 'initializeDevice', 'Body closely matches steelsentinels JavaSoundAudioOutput.initializeDevice.');
method('iw', 'b', '(BJ)V', 'writeFiveByteValue', 'Body closely matches arcanistsmulti PacketBuffer.writeFiveByteValue.');
method('tg', 'a', '(Lsj;Ljava/lang/String;Ljava/lang/String;)Ltg;', 'load', 'Body closely matches brickabrac VorbisSample.load.');
method('kv', 'a', '(II)[I', 'synthesize', 'Body closely matches geoblox SynthesizedSoundInstrument.synthesize.');
method('rs', 'a', '([B)V', 'parse', 'Body closely matches armiesofgielinor/steelsentinels MidiFileReader.parse.');
method('jg', 'a', '(IILjava/util/Hashtable;Ljava/lang/StringBuilder;)Ljava/lang/StringBuilder;', 'appendWidgetDiagnostics', 'Body closely matches geoblox DraggableWidget.appendWidgetDiagnostics.');
method('dq', 'a', '(BILjava/lang/String;Ljava/lang/String;)Ljava/net/Socket;', 'connectHttpTunnel', 'Body closely matches geoblox ProxySocketConnector.connectHttpTunnel.');
method('ut', 'a', '(III[I[IIIIIIIIII)V', 'blitAdditiveIntensity', 'Body closely matches escapevector Sprite.blitAdditiveIntensity.');
method('wi', 'a', '(ZIILfd;III)Z', 'handlePointerPress', 'Body closely matches steelsentinels TextButton.handlePointerPress.');
method('hu', 'b', '(Ljava/lang/String;)V', 'applyStyleTag', 'Body closely matches geoblox BitmapFont.applyStyleTag.');
method('lb', 'a', '(Lfd;I)Z', 'focusNext', 'Body closely matches steelsentinels TextHotspotWidget.focusNext.');
method('pm', 'a', '(IIILjava/awt/Component;)V', 'initialize', 'Body closely matches escapevector BufferedImageRasterBuffer.initialize.');
method('ut', 'a', '(III[I[IIIIIIIII)V', 'blitAdditive', 'Body closely matches escapevector Sprite.blitAdditive.');
method('as', 'a', '(Liw;Lfq;)V', 'decode', 'Body closely matches armiesofgielinor SoundFilter.decode.');
method('ae', 'a', '(Lcw;I)Z', 'passesSubmissionGate', 'Body closely matches brickabrac AccountRegistrationPanel.passesSubmissionGate.');
method('fd', 'a', '(IILjava/util/Hashtable;Ljava/lang/StringBuilder;)Ljava/lang/StringBuilder;', 'appendWidgetDiagnostics', 'Body closely matches geoblox UiWidget.appendWidgetDiagnostics.');
method('fd', 'a', '(ILjava/lang/StringBuilder;Ljava/util/Hashtable;I)Z', 'beginWidgetDiagnosticVisit', 'Body closely matches geoblox UiWidget.beginWidgetDiagnosticVisit.');
method('iw', 'a', '(III[B)V', 'readBytes', 'Body closely matches zombiedawn PacketBuffer.readBytes.');
method('fq', 'b', '(Liw;)V', 'decodeSegments', 'Body closely matches steelsentinels SoundEnvelope.decodeSegments.');
method('ma', 'h', '(I)V', 'initializeAccountPacketLengths', 'Body closely matches escapevector NetworkGameClient.initializeAccountPacketLengths.');
method('on', 'f', '(IIIII)V', 'drawVerticalLineAlpha', 'Body closely matches geoblox SoftwareRasterizer.drawVerticalLineAlpha.');
method('ut', 'a', '([I[IIIIIIII)V', 'blitTransparent', 'Body closely matches escapevector Sprite.blitTransparent.');
method('kv', 'a', '(Liw;)V', 'decode', 'Body closely matches geoblox SynthesizedSoundInstrument.decode.');
method('gh', 'a', '(I)[I', 'enumerateDisplayModes', 'Body closely matches armiesofgielinor MicrosoftDisplayController.enumerateDisplayModes.');
method('ut', 'b', '([I[IIIIIIII)V', 'blitSilhouette', 'Body closely matches escapevector Sprite.blitSilhouette.');
method('mm', 'a', '(ILjava/lang/String;Ljava/applet/Applet;)Ljava/lang/Object;', 'callWithoutArguments', 'Body closely matches geoblox AppletJavaScriptBridge.callWithoutArguments.');
method('kd', 'a', '(Ljava/lang/String;Z)Z', 'evaluateInput', 'Body closely matches armiesofgielinor DebugConsole.evaluateInput.');
method('ct', 'a', '(ZIILfd;III)Z', 'handlePointerPress', 'Body closely matches steelsentinels SingleChildContainer.handlePointerPress.');
method('ae', 'a', '(Lfd;Ljava/lang/String;IIILjava/lang/String;)I', 'addLabeledFieldWithDefaultMessageWidth', 'Body closely matches brickabrac AccountRegistrationPanel.addLabeledFieldWithDefaultMessageWidth.');
method('ah', 'a', '(IIIBILjava/lang/String;I)V', 'startAppletShell', 'Body closely matches armiesofgielinor GameAppletShell.startAppletShell.');
method('bh', 'b', '(I)I', 'readByte', 'Body closely matches tetralink BufferedSocket.readByte.');
method('ru', 'a', '(Lda;I)I', 'computeNoteSampleStep', 'Body closely matches geoblox MidiPcmStream.computeNoteSampleStep.');
method('qk', 'a', '(B)V', 'releaseStatics', 'Body closely matches escapevector Checkbox.releaseStatics.');
method('ct', 'b', '(BLfd;)Z', 'focusNext', 'Body closely matches steelsentinels SingleChildContainer.focusNext.');
method('ga', 'a', '(Ljava/lang/String;BZ)V', 'setInputText', 'Body closely matches geoblox TextInputWidget.setInputText.');
method('sj', 'a', '(BLjava/lang/String;I)I', 'findFileId', 'Body closely matches geoblox ResourceArchive.findFileId.');
method('mm', 'a', '([Ljava/lang/Object;Ljava/applet/Applet;Ljava/lang/String;I)Ljava/lang/Object;', 'callWithArguments', 'Body closely matches geoblox AppletJavaScriptBridge.callWithArguments.');
method('iw', 'a', '([IB)V', 'encryptXtea', 'Body closely matches armiesofgielinor PacketBuffer.encryptXtea.');
method('ah', 'a', '(ZB)V', 'shutdownShell', 'Body closely matches armiesofgielinor GameAppletShell.shutdownShell.');
method('uo', 'a', '([I[BIIIIIIIII)V', 'blitBinaryGlyphWithAlpha', 'Body closely matches armiesofgielinor/steelsentinels BinaryBitmapFont.blitBinaryGlyphWithAlpha.');
method('qv', 'a', '(Lqv;B)V', 'copyStyleTo', 'Body closely matches escapevector TextWidgetPainter.copyStyleTo.');
method('ah', 'f', '(B)V', 'recreateCanvas', 'Body closely matches armiesofgielinor GameAppletShell.recreateCanvas.');
method('wg', 'a', '(Ljava/awt/Component;ZI)V', 'setCursorVisible', 'Body closely matches armiesofgielinor MicrosoftCursorController.setCursorVisible.');
method('bu', 'a', '(I[Ljava/lang/Class;Ljava/lang/Class;Ljava/lang/String;)Lwu;', 'requestDeclaredField', 'Body closely matches geoblox PlatformTaskDispatcher.requestDeclaredField.');
// END-R2MEMBERS

export const kickConfig = {
  game: 'kickabout', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-kickabout-rules.mjs', 'reproduce-kickabout.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-applicable', note: 'No game-specific reconstruction or core fixture in this naming wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading Kickabout', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/kickabout-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      `Decompiler source commit: ${rules.generators.javaTools.commit}.`, ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(kickConfig), file = path.join(workflowRoot, 'kickabout-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Kickabout rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
