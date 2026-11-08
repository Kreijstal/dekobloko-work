import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {namingCoverage} from './naming-coverage.mjs';
import {verifyKickaboutCore} from './tests/test-kickabout-core.mjs';
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
  la: ['PlayArea', 'Box with x, y and height ranges; pe.a treats a point as valid only when it lies inside one of the CommonGame play areas.'],
  p: ['LoggedPossession', 'toString prints "LoggedPosession{" with ball-possession counters per footballer, per player and per pitch end.'],
  ki: ['PlayerInputEvent', 'toString prints Keyheld, Keypress, Mouse, Team, LineUp, Cheat and match-control events with participant and value.'],
  cq: ['AuctionLogEntry', 'toString prints "Auction Log [Bid/Buy/Own/Outbid], [INDEX], [ID]"; gr keeps a list of them and copies them.'],
  pt: ['AuctionListing', 'toString prints "Auction ID: .. Type: .. Index: .."; holds a long id, slot index, a value and a PlayerStats (up); read from and written to packets.'],
  hn: ['ManagerAction', 'toString renders actions ("Bought Player from shop", "Sold Player", "Bought a trinket", "Levelled up player"); queued actions are sent to the server by jm via a(1, packet).'],
  gr: ['ClubState', 'Holds the 9 squad PlayerStats (up[]), the auction listings (pt), auction log (cq), applies ManagerAction objects and has a packet reader.'],
  up: ['PlayerStats', 'toString returns "Empty PlayerStats" or Type/Name/Stats POW TCK SPD EXP/Num Trinkets/Appearance/Trinkets; has packet read/write.'],
  jm: ['DelayedServerPacket', 'Built in dr with a due time plus gaussian lag and a copy of the received bytes, queued until due (same shape as steelsentinels DelayedServerPacket).'],
  hw: ['InstrumentNoteMask', 'Holds only a byte[128] notes-used mask and is created in the MIDI reader on note-on events (same shape as geoblox InstrumentNoteMask).'],
  jk: ['MusicPatch', 'Parses an instrument patch from a byte[] with envelope (gl[]) and sample (to[]) arrays; a(rj,int[],byte,byte[]) prepares samples like steelsentinels MusicPatch.prepareSamples.'],
  je: ['AnimationSkeleton', 'Constructor reads transform count, types and per-transform group index lists from byte[] exactly like armiesofgielinor AnimationSkeleton; used by animation frames (db).'],
  da: ['MusicPatchNode', 'Active note node holding MusicPatch (jk), envelope (gl), sample stream (vm) and sample (to); a(boolean) nulls them like steelsentinels MusicPatchNode.'],
  si: ['ReflectionCheck', 'qv decodes a server request into operation types, method/field lookup tasks, serialised arguments, write values and errors (same fields as steelsentinels ReflectionCheck).'],
  jd: ['TextFieldValidator', 'Abstract validator over a text widget: a(String) validates, a(byte,String) describes, plus empty check on widget text; subclasses are the account-form validators.'],
  lg: ['DebouncedValidationProvider', 'Abstract ValidationSource that returns the pending state for 350 ms after the last change (nj.a() >= field_b + 350), like geoblox DebouncedValidationProvider.'],
  rv: ['ValidationState', 'Return type of every validator\'s validate method; singletons compared with jt.field_Bb (valid) and he.field_yb (invalid).'],
  bv: ['AccountNameAvailabilityValidator', 'Validates a name via cp.a lookup and caches the last checked name and result (same shape as armiesofgielinor AccountNameAvailabilityValidator).'],
  fo: ['AgeValidator', 'Validate returns valid when the parsed number is between 1 and 130, same logic as armiesofgielinor AgeValidator.'],
  ge: ['MatchingTextValidator', 'Compares its text with another widget\'s text (confirm password/email) and fails when they differ; constructor takes two widgets.'],
  lo: ['PasswordValidator', 'Takes three widgets and its private b(String) rejects passwords containing the part of the email before the @, like armiesofgielinor PasswordValidator.'],
  mh: ['EmailAvailabilityValidator', 'Wraps a MatchingTextValidator (ge), then looks the email up with kt.a and caches the last checked address; two-widget constructor.'],
  qo: ['EmailSyntaxValidator', 'Validate returns valid when gf.a(text) is null; message is "Email is valid" otherwise a syntax error string.'],
  an: ['QuickChatPhraseCache', 'Caches decoded phrases (eq of 64) per id, loading from one of two archives depending on id >= 32768, like escapevector QuickChatPhraseCache.'],
  bg: ['QuickChatPhraseDefinition', 'Decodes a phrase text split on \'<\' plus parameter type ids and resolved argument arrays from an archive entry.'],
  ps: ['LoginCredentials', 'Abstract base with a(iw,int) writing credentials to a packet and a(byte) returning the login kind; subclasses aa and gp.'],
  aa: ['KeyedLoginCredentials', 'Writes a long key and a string to the packet, like armiesofgielinor KeyedLoginCredentials.'],
  gp: ['PasswordLoginCredentials', 'Constructor takes two strings (account name, password), same as armiesofgielinor PasswordLoginCredentials.'],
  es: ['RowRangeRequest', 're creates it for each run of uncached list rows (category, start, count) and a(ml) writes the three values to the outgoing packet.'],
  bc: ['ListingRow', 'Decoded from a packet (two strings, three ints, category byte, three flags) and cached per category by gd for list rows drawn in qh.'],
  iu: ['CachedListingRow', 'gd stores it per (category,id) with a timestamp next to the ListingRow field and evicts old entries.'],
  lj: ['TextLine', 'Created by the text wrapper in be for each wrapped line; holds only the line string.'],
  gv: ['FadingChatMessage', 'Holds text, alpha 256->0 over 500-600 ticks, a tick method and a draw method; ge inserts new ones at the front of bk.field_c.'],
  wh: ['FadingSoundPlayer', 'Wraps a PcmSampleStream (vm) and fades its volume in over field_u ticks and out over field_s ticks, with start delay and loop flag.'],
  qg: ['RasterStateSnapshot', 'tr.d reuses a pooled qg and fills it with the current rasterizer fields (on.field_e..field_c incl. pixel array) and pushes it onto a stack.'],
  fp: ['AuctionItem', 'toString prints "<id>: <player name>, <value>"; holds a PlayerStats (up) and flags; its only subclass vc is decoded from packets and matched with auction log entries.'],
  vc: ['ReceivedAuctionItem', 'Static factory reads a long id, a flag byte, three ints and a PlayerStats from the packet; wh.a(vc[]) links items to auction log entries by id.'],
  nr: ['PlayerModelPreview', 'Constructor picks a random facing and animation and builds a model; a(int,int) draws the rotating model in a 320 wide preview card.'],
  js: ['AppScreen', 'Abstract base of every screen (id in field_c): subclasses implement draw, update, key and transition hooks; Kickabout holds the current and pending one in cq.field_h/ra.field_G.'],
  qt: ['ButtonMenuScreen', 'Screen built from an io[] button list plus a selection cursor; configured per id in iv.a and instantiated plain for the 9 menu-only ids.'],
  dj: ['PagedHelpScreen', 'Shows one of several titled help pages (ids 19-22) with previous/next buttons (kinds 21/22) and an "n / total" counter.'],
  ta: ['TeamManagementScreen', 'Base of My Squad, My Pitch, My Kit and Player Shop: enterScreen applies the local team gr, and update calls tc.a on its changes.'],
  ap: ['MatchScreen', 'Screen id -1: owns the match state nu, creates the phase controller (wb/fk/lr/bf/va/ol) and shows "Waiting to receive the game state...".'],
  e: ['SplashScreen', 'Screen id -5: draws image iu.field_k, counts field_l down from 40 or any key, then goes to screen 0.'],
  hj: ['BlankScreen', 'First screen (cq.java: field_h = new hj()): fills 640x480 with colour 65793 and ignores all input.'],
  kt: ['BlackFadeScreen', 'Screen id -3: fills the whole screen black with alpha field_h (256 = opaque); no input handling.'],
  lm: ['TournamentLobbyScreen', 'Screen id -2 built from the lobby packet (op 87): tournament round stats tabs (kicks, tackles, goals and possession), "Tournament starts in <%0> seconds".'],
  bd: ['UnreadMessagesScreen', 'Screen id 11 shown after login: bd.e builds "You have <%0> unread messages!" and buttons go to the main menu or the account page.'],
  rq: ['ServerMessageScreen', 'Screen id 10: draws the text stored by ka.a (vp.field_p) in a panel; Kickabout packet 9 calls ka.a then jm.a(10) to show a server message.'],
  sc: ['FindingOpponentScreen', 'Screen id 26: draws "Please wait while we find you an opponent" with dots and a "leave" button that calls vj.a to go back.'],
  sf: ['MainMenuScreen', 'Screen id 0: Quick Play box ("to go straight into a multiplayer Exhibition Game") and the main button column; jm.a(0) is the return-to-menu call.'],
  ud: ['MatchTransitionScreen', 'Screen id 18: update waits for the transition, then enters the match (jm.a(-1)) when um.field_b is set or goes to destination ig.field_d.'],
  wf: ['AuctionsScreen', 'Screen id 16: new/refresh/filter buttons, sort tabs, "There are no auctions in progress.", auction list from vc entries requested by packet 83/55.'],
  bn: ['LeaguesScreen', 'Screen id 15: seven division tabs, team search box ("search for a user"), "view all <%0> teams", "There are no teams in this league".'],
  fm: ['AchievementsScreen', 'Screen id 9: scrollable achievement list with "(not yet achieved)", Orb points and Orb coins totals, scroll arrow buttons.'],
  rm: ['RankingsScreen', 'Screen id 7: top-ten table with Rating, Played, Won, Drawn, Lost columns and two toggle buttons (kinds 13/14) switching wv.field_ib.'],
  ne: ['GameplayHelpScreen', 'Help pages 0-5 titled How To Move, Using Your Feet, The Players, Player Stats, Trinkets, What You Need To Know (iq.field_a).'],
  ra: ['GameModesHelpScreen', 'Help pages Exhibition Mode, Facebook, Tournament Mode, Rewards (uv.field_d), with the 1 vs 1 tournament text.'],
  qa: ['LeaguesHelpScreen', 'Help pages "The Leagues" and "The Diamond Division" (ue.field_g) with the league point thresholds.'],
  df: ['AuctionsHelpScreen', 'Help pages "Online Auctions" (pt.field_l) explaining the online auction marketplace and Auction Settings.'],
  b: ['MySquadScreen', 'Screen id 25: "My Squad" list with Profile/Stats/Trinkets/Auction Info tabs, "Spend EXP", trinket slots and auction state of a player.'],
  fw: ['MyPitchScreen', 'Screen id 14: "Select the pitch you\'d like to play on." with park/beach/street rows of jt tiles; locked rows show "Orb Coins" text.'],
  ja: ['MyKitScreen', 'Screen id 24: previews a rotating player model, kit style list and two 32-colour swatch palettes; locked kits show the hidden achievement text.'],
  qs: ['PlayerShopScreen', 'Screen id 23 ("Player Shop"): My Squad grid, Sell Player panel and a buy table with Character, Class, Stats, Trinkets, Price columns.'],
  io: ['MenuButton', 'Menu button with kind in field_m; a(int,boolean) is its click switch (kind 6 to menu 0, 33-36 to help pages) and iv.a creates them per screen.'],
  ko: ['MenuSelection', 'Selection cursor over N menu items (field_a count, field_e index): moves with arrow keys 96/97 and with the mouse.'],
  jt: ['PitchOptionTile', 'fw builds 3x4 of them: "buy this pitch for <%0>", "select this pitch", "This pitch is locked" and "my current pitch".'],
  nt: ['KitStyleTile', 'ja builds one per kit style rd: "This kit was unlocked by the achievement" and "Buy this kit for 10 coins" lock texts.'],
  gi: ['ColourSwatchTile', 'ja builds 2x32 of them with new gi(team, palette, index) as the primary and secondary kit colour swatches.'],
  sp: ['ShopPlayerSlot', 'qs builds one per shop tier/column from new sp(player, ..., level, column, owned); clicking it queues the buy dialog ce.'],
  kq: ['SquadSlotWidget', 'Cell of mf (the squad grid) holding a player up; b and qs read its field_Eb player and click state.'],
  mf: ['SquadGridWidget', 'new mf(ic.field_h) in b and qs: grid of kq slots for the local team, j(21) returns the selected slot.'],
  bp: ['ColumnTableWidget', 'qs builds it with column titles Character/Class/Stats/Trinkets/Price and sort icons; jh extends it for the auction table.'],
  jh: ['AuctionTableWidget', 'bp subclass built in wf.b with the gr.field_l auction column titles and filled with jr rows.'],
  jw: ['CheckboxLabelWidget', 'wf creates four with the filter names uf.field_e and toggles bits of the filter mask on click.'],
  hs: ['MatchPhaseView', 'Abstract view holding the CommonGame, the local seat, an io button array and a ko selection; ap.createPhaseController instantiates one subclass per phase.'],
  wb: ['TeamSelectionView', 'Created by MatchScreen for phase 0 (TeamSelection).'],
  fk: ['WaitForPlayersView', 'Created by MatchScreen for phase 1 (WaitForPlayers).'],
  lr: ['FormationView', 'Created by MatchScreen for phase 2 (Formation).'],
  bf: ['LineupView', 'Created by MatchScreen for phase 3 (LineUp) with the club state as extra argument.'],
  va: ['PlayingView', 'Created by MatchScreen for phase 4 (Playing) with the extra scene arguments.'],
  ol: ['GameOverView', 'Created by MatchScreen for phase 5 (GameOver).'],
  gm: ['RenderedFootballer', 'FootballerAgent subclass that adds the animation, model and shadow fields and overrides stepMovement and the state sync.'],
  ob: ['RenderedBall', 'BallAgent subclass that adds the model, spin and shadow fields and overrides stepPhysics and the state sync.'],
  hd: ['UiLayoutNode', 'Tree node with a parent, a tf child list, text, font and sprite slots, offsets and a large draw/layout method; about 30 screens subclass it.'],
  fn: ['Trinket', 'Holds a trinket type id indexed into the trinket name table rv.field_b, a slot kind and a price; toString prints "name [type]" and many isX methods test the type id.'],
  at: ['TrinketTile', 'UiLayoutNode built from a Trinket: draws its lowercase name and its price in red when the player lacks the experience.'],
  gu: ['ContextMenu', 'Holds up to 256 vu items with action ids, addItem methods and a getter that returns the id of the item the pointer released on.'],
  vu: ['ContextMenuItem', 'UiLayoutNode with an optional icon and a text label whose layout is computed from the icon width; created by ContextMenu and CascadingMenu.'],
  bb: ['CascadingMenu', 'Menu of vu items with per-item child bb menus, hotkey characters and a hover slide-in offset; clicking an item either opens its child or sends its id.'],
  ej: ['SelectableTrinketIcon', 'Tile for one trinket type id; clicking toggles pt.field_e and the draw method outlines it using the qe.field_i trinket sprites.'],
  dn: ['TrinketIcon', 'UiLayoutNode that renders the quarter-size trinket sprite qe.field_i for the given type id.'],
  he: ['LobbyPlayerRow', 'Constructed from a name, a text and a long id with two boolean flags used by its comparator; rows of the lobby player lists.'],
  kf: ['TabStrip', 'Takes label strings and one content node per label, lays the labels out evenly and switches the visible content on click.'],
  na: ['VerticalScrollbar', 'Builds two arrow buttons, a track and a thumb, repeats arrow presses with a 20 then 3 tick delay and maps thumb position to a scroll value.'],
  np: ['ScrollPane', 'Holds a content node and a na scrollbar, moves the content by the arrow, page and thumb amounts and keeps the bar sized to the viewport.'],
  om: ['IconLabel', 'Two child nodes, an icon with sprite fields and a text label, laid out side by side with the label width fitted to the remaining space.'],
  pu: ['TrinketSlot', 'Fixed 32x32 node showing the icon of one Trinket, half size when the boolean argument is set, and drawing a tooltip with its name.'],
  ji: ['ScrollBar', 'Built from a "scrollbar" skin with arrow, track and thumb nodes and a horizontal flag; copy constructor makes instances, thumb position maps to scroll value.'],
  tk: ['ScrollContainer', 'Creates a horizontal and a vertical ji bar around a content node and scrolls the content with arrows, pages and thumbs.'],
  rb: ['TextPromptDialog', 'Modal layout with title, om line, StringBuilder text entry and buttons; a(int) returns the typed text and h() watches for the enter key.'],
  sl: ['HoverTooltip', 'Created at the rectangle of an existing node with a title and body node; a singleton k.field_m holds the active one.'],
  vg: ['TextFieldNode', 'hd-toolkit text field with a StringBuilder, selection start and end, clipboard copy and paste and an optional maximum length.'],
  qb: ['GameSetupPanel', 'hd-toolkit panel holding a byte[] of option selections sized by the option count ss.field_j, restriction arrays tested against them and many option label nodes.'],
  cf: ['RankingRowNode', 'Row drawn as three columns 40, 196 and 70 wide showing the rank (or = for ties), name and rating copied from a bc entry.'],
  jb: ['PopupDialog', 'IntrusiveNode queued in np.field_Jb with a slide-in counter, option strings, a selection ko and key handling; subclassed by every dialog.'],
  i: ['MessageDialog', 'PopupDialog built from a dialog id: title, text from the gd.field_e table, icon and buttons, with a close handler per id.'],
  aw: ['TutorialChoiceDialog', 'MessageDialog id 8, whose text asks whether to play the Tutorial or practise in Sandbox mode.'],
  bm: ['AuctionListingDialog', 'MessageDialog id 21 built from a pt auction listing; on close it can write the listing to the outgoing packet.'],
  ce: ['BuyPlayerDialog', 'MessageDialog id 30 built from a shop slot sp: "Buy <%0> for <%1>?" with the player name and price.'],
  ha: ['WelcomeDialog', 'MessageDialog id 23, the "Welcome to Kickabout League" text shown to a not-logged-in player with a temporary team.'],
  hg: ['PromotionDialog', 'MessageDialog id 10, "promoted to the <%1>", showing the division sprite kb.field_E[index].'],
  hk: ['AuctionBidDialog', 'MessageDialog built from a vc auction item with ids 19, 32 or 37 (bid or buyout confirmation) that sends the bid packet on accept.'],
  ie: ['SellPlayerDialog', 'MessageDialog id 34, "Do you want to sell <%0> for <%1>?", built from a PlayerStats.'],
  kn: ['TrinketPickerDialog', 'MessageDialog id 27 with a grid of dn trinket icons ("Mouse over an icon for details").'],
  no: ['LeagueWinnerDialog', 'MessageDialog id 9, the congratulations text for winning the league.'],
  nq: ['TournamentChampionDialog', 'MessageDialog id 42, "Congratulations to <%0>! They are the tournament champion."'],
  pq: ['SquadPickerDialog', 'MessageDialog id 11 embedding an mf squad grid; accepting a selected slot calls oj.b with that player.'],
  pv: ['HelpTipDialog', 'MessageDialog whose id selects help text 12-17 and which marks the matching tu.field_E.field_J help flag as seen.'],
  pw: ['AuctionSettingsDialog', 'Large MessageDialog id 18 with price entry, character filter ia.field_e and an offer button for creating an auction.'],
  qq: ['LoginRequiredDialog', 'MessageDialog id 25, "To access the Multiplayer Lobby, log in or create a free account."'],
  rt: ['StatChoiceDialog', 'MessageDialog id 20, "EXP at max! Choose a stat to increase by 1%".'],
  sq: ['SaveChangesDialog', 'MessageDialog id 1, "You have made changes to your team. Would you like to save these changes?"'],
  vf: ['BuyPitchDialog', 'MessageDialog id 29 built from a jt pitch tile: "Buy <%0> for <%1>?" with the surface name.'],
  pk: ['LoadingSequence', 'Interface held in NetworkGameClient.field_t whose four methods tu polls: bind archives, poll archives, build assets and poll completion.'],
  eh: ['GameResourceLoader', 'Implements LoadingSequence: binds the cache archives, decodes sprites and fonts, builds the lobby assets and starts the message-of-the-day request.'],
  ci: ['IterableDualLinkDeque', 'Iterable circular deque of DualLinkNode with a sentinel; iterator returns a DualLinkDequeIterator and nodes are added before the sentinel.'],
  eb: ['DiskCacheWorker', 'Runnable thread with a deque of hi requests guarded by a monitor; shutdown joins the thread, as Escape Vector DiskCacheWorker.'],
  hi: ['DiskCacheRequest', 'Request object with operation code, data bytes and a SectorCacheStore, with progress and getBytes methods, as Escape Vector DiskCacheRequest.'],
  eq: ['WeightedLruCache', 'Cache with a capacity, an ij entry list and an ht hash table; get, put and weighted eviction, as Escape Vector WeightedLruCache.'],
  ij: ['WeightedCacheEntry', 'DualLinkNode entry of WeightedLruCache holding the cached object and its weight.'],
  em: ['DualLinkHashTable', 'Power-of-two array of DualLinkNode sentinels keyed by long with get, put and bucket iteration.'],
  fu: ['GrowableIntList', 'Int array with a size, growth step and get, set, add and remove-at methods, as GeoBlox GrowableIntList.'],
  gd: ['ListingRowCache', 'Seven per-category tables of iu cached rows keyed by id with timestamps; add, evict-by-age and get by category and id.'],
  iq: ['TextLayout', 'Abstract holder of qj lines with character position tables; measures line count, total height and the character index at a pixel position.'],
  qj: ['TextLayoutLine', 'Stores a line\'s top, bottom and per-character x positions in an int array one longer than the text.'],
  st: ['CachedTextLayout', 'TextLayout that re-lays out only when the font, text or wrap mode (single, centred, wrapped) differs from the previous call.'],
  hf: ['PainterStyle', 'Chain-setter style object with colour, font, sprite and alignment fields that are copied into another style when set, used by the widget painters.'],
  kk: ['TriangleMesh', 'Vertex short arrays with a vertex count, scale and translate methods and a lazy bounds computation, as Escape Vector TriangleMesh.'],
  ks: ['HuffmanCodec', 'Built from the "huffman" archive file as a code table and encodes and decodes text byte arrays.'],
  ll: ['DirectByteStorage', 'ByteStorage backed by a direct ByteBuffer, as GeoBlox DirectByteStorage.'],
  lf: ['IntKeyLookup', 'Open-addressed table built from an int array whose lookup masks the key, as GeoBlox IntKeyLookup.'],
  pf: ['ByteStorage', 'Abstract base with a byte[] store and retrieve pair that DirectByteStorage implements, as GeoBlox ByteStorage.'],
  hc: ['OverlayLayer', 'Interface for per-frame layers registered with oa.a: key typed, paint, update and an input-capture query; implemented by the console, cheat listener and overlays.'],
  md: ['CheatCodeListener', 'OverlayLayer that shifts typed letters into a four-character buffer and reacts to the cheat words.'],
  nb: ['GameSoundEffect', 'Table entry created with a KaB_ asset name and archive group or from a PcmSample, loaded lazily through b(int).'],
  n: ['ArchiveManager', 'Holds the network archive client, the disk cache worker and optional RSA keys, opens archives and checks the master index.'],
  sr: ['SortCriterion', 'Abstract comparator over shop slots with a current direction index; subclasses compare slots by different stats and the base cycles the direction.'],
  os: ['Bzip2State', 'Decoder state with an 18002-byte block, 256 used flags and 6x258 code tables, as Bzip2State in other games.'],
  pp: ['MusicPatchPcmStream', 'PcmStream holding a tf of da note nodes and a gq mixer; its mix methods walk the notes, as Steel Sentinels MusicPatchPcmStream.'],
  pn: ['StrongCacheEntry', 'WeightedCacheEntry subclass that holds the cached object in a strong reference and returns it from a(int).'],
  q: ['ConsoleTokenCursor', 'Built from a tf of lk tokens into an array; a(byte) returns the next ConsoleExpression and a(int) tests for the end, as Armies of Gielinor ConsoleTokenCursor.'],
  qe: ['ArchivePreloader', 'Queue of up to 16 oc preload tasks over named archive groups that reports "<name> - n%" progress text while polling.'],
  rc: ['GzipDecoder', 'Checks the 31,-117 gzip magic in the buffer and inflates the payload into the byte array, as GeoBlox GzipInflater.'],
  rd: ['GameModeDefinition', 'Constructed with ids, a member flag, a long key and a hex mask string; matches a mode by key and tests the option masks.'],
  rj: ['SoundCache', 'Loads PcmSample objects from two archives by name or id into kc caches of 256 entries, as Steel Sentinels SoundCache.'],
  sb: ['StringCursor', 'Wraps a string with a position and length; reads one character at a time and toString shows the caret as a bar.'],
  sn: ['UrlRequest', 'Built from the applet code base, polls an asynchronous fetch and returns the downloaded bytes as a PacketBuffer; used for the message of the day.'],
  td: ['TrinketCatalog', 'Static builder that fills pa.field_g with 111 Trinket entries in type id order.'],
  ti: ['NamedValueContainer', 'Parsed from a PacketBuffer into a list of ue entries and answers lookups by entry name such as motd_message.'],
  ue: ['NamedValueEntry', 'IntrusiveNode entry of NamedValueContainer holding a name, a type and its payload offset.'],
  tv: ['ChatMessage', 'Record with sender, text, type and timestamp fields built from a chat packet or from the five default strings, with a b(int) kind query.'],
  vl: ['LoginMethod', 'Three constant instances created with the texts usename, email and an empty string; saved in the jagex-last-login-method cookie, as GeoBlox LoginMethod.'],
  w: ['DialogOverlay', 'OverlayLayer that walks the np.field_Jb dialog deque, forwards key and update calls to the active su.field_c dialog and draws it.'],
  uv: ['PlayerContextMenu', 'Built for a player name and id; owns a ContextMenu, builds its items per relationship and dispatches the chosen action to friend, ignore, invite, report and match handlers.'],
  nm: ['AnimationClip', 'Loads a named clip such as ka_tank_aggressive_tackle from the characters archive into an array of db frames and a timing table.'],
  db: ['AnimationFrame', 'Parsed from a byte[] with a je skeleton into per-group transforms, as Armies of Gielinor AnimationFrame.'],
  dd: ['AnimationPlayer', 'Tracks the current AnimationClip, frame index and blend counters and applies the frame to a qc mesh.'],
  cp: ['AudioService', 'Runnable thread that loops over two uh player services and keeps their mixers filled, as GeoBlox AudioService.'],
  tp: ['ReverbCombFilter', 'Delay-line int array with an index and a filter state; ReverbPcmStream creates eight with delays 1139..1640 samples at 44.1 kHz.'],
  mq: ['ReverbAllPassFilter', 'Delay-line int array with a clear method; ReverbPcmStream creates two with delays 579 and 464 samples at 44.1 kHz.'],
  ek: ['TrinketShopDialog', 'MessageDialog id 24 containing a ScrollContainer of at trinket tiles built from the pa.field_g table and an accept path through ge.a.'],
  ib: ['DateOfBirthPanel', 'wt container with a numeric date input fb, a debounced validator hl and a button, drawn with a caption.'],
  id: ['StatefulTextPainter', 'TextWidgetPainter subclass holding six hf styles, one per widget state, with a copy constructor.'],
  wt: ['ArrayWidgetContainer', 'Abstract UiWidget implementing the container marker with an fd[] of children that routes drawing, key, hover and pointer events to them, as Armies of Gielinor ArrayWidgetContainer.'],
  ou: ['StripedProgressBar', 'UiWidget that pre-renders two stripe sprites and scrolls them with a counter to draw an animated progress bar, as Steel Sentinels StripedProgressBar.'],
  ju: ['ValidationHelpWidget', 'TextHotspotWidget subclass built from a ValidationSource that draws a help balloon with the validation message, as Steel Sentinels ValidationHelpWidget.'],
  gb: ['ValidationIndicator', 'TextButton subclass built from a ValidationSource that draws the valid or invalid marker and its tooltip text, as Steel Sentinels ValidationIndicator.'],
  mc: ['TickClock', 'Abstract frame clock base of NanoTickClock, as Steel Sentinels TickClock.'],
  vi: ['NanoTickClock', 'TickClock using System.nanoTime with a ring of ten recent deltas, as Steel Sentinels NanoTickClock.'],
  vo: ['LoginDialog', 'ContentTransitionDialog constructed from the modal stack and a child widget with the login form sizes 33, 20 and 30, as Steel Sentinels LoginDialog.'],
  m: ['WhirlpoolHasher', 'Digest state with a 64-byte block, eight long words, a 32-byte bit counter and process, update and reset methods, as Escape Vector WhirlpoolHasher.'],
  jj: ['MusicTrackMixer', 'PcmStream with an array of qm MusicTrack slots, a volume per slot and mix, fade and release methods; created with three slots.'],
  lw: ['ProxyAuthenticationRequiredException', 'IOException thrown by the proxy socket connector with the status line of a failed CONNECT.'],
  kp: ['LobbyGameRecord', 'Lobby game entry with two player id slots, a 2x5x2 lineup array, option fields and pitch coordinates; read from a packet and copied between instances.'],
  oi: ['IntValueNode', 'IntrusiveNode holding one int, queued in tf lists such as ec.field_f, as Escape Vector IntValueNode.'],
  ac: ['TrinketUnlockNotice', 'OverlayLayer that takes queued IntValueNode trinket ids from ec.field_f, slides a panel in from the right and draws the qe.field_i trinket icon.'],
  cc: ['FixedQuaternion', 'Four 16.16 fixed-point components starting at identity (65536), with axis-angle setup, product and rotation-matrix output, as Armies of Gielinor FixedQuaternion.'],
  dt: ['OffscreenPlayerArrow', 'Built from a RenderedFootballer and a slot index; places an arrow on the screen edge by sine and cosine of the bearing to the player and draws it with a fade.'],
  ec: ['LoginText', 'Holds a login text string and a boolean flag that is forced false for empty text; constructed from the stored account name, as Escape Vector LoginText.'],
  al: ['FriendsListPanel', 'Scroll pane of friend rows plus Add friend and Remove friend buttons, built in the lobby setup.'],
  bo: ['QuickChatKeysHelpPanel', 'Title plus rows pairing [BACKSPACE]/[HOME]/[F9]/[F10]/[F11]/[ESC] with Quick Chat key descriptions.'],
  im: ['ListRow', 'Abstract hd row with abstract draw b(II) and click handler c(IZ), subclassed by auction and shop rows.'],
  jr: ['ReceivedAuctionItemRow', 'ListRow drawing a ReceivedAuctionItem with take-up and withdraw buttons and the bid/buyout text.'],
  vn: ['MeshData', 'Final cv subclass with the same constructors and decode, normal, skin-group and model-factory methods as Armies of Gielinor MeshData.'],
  cv: ['MeshObject', 'Abstract empty-instance root of MeshData and ModelMeshBase, same as Armies of Gielinor MeshObject.'],
  ba: ['TrinketCountSortCriterion', 'Compares two shop slots by their trinket count plus the summed bonuses of those trinkets.'],
  od: ['PlayerValueSortCriterion', 'Compares two shop slots by their cached player value field.'],
  qi: ['PlayerStatSortCriterion', 'Compares shop slots by power, speed or tackle depending on the direction index modulo three.'],
  lv: ['PopupCard', 'Interface implemented by tooltip-like cards that report a width and height and draw themselves centred on a point.'],
  wc: ['WidgetTheme', 'Its renderer setup, line, alpha rectangle and tooltip box methods match GeoBlox WidgetTheme.'],
  tb: ['SocketArchiveNetworkClient', 'Socket-based ArchiveNetworkClient subclass with the same attach, close, poll and control packet methods as GeoBlox SocketArchiveNetworkClient.'],
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
method('tj', 'a', '(Z)I', 'pixelX', 'Returns field_t >> 16 and es.a subtracts it from the footballer\'s x.');
method('tj', 'c', '(I)I', 'pixelY', 'Returns field_p >> 16, the pitch-length coordinate compared against 0 and 1344 in g().');
method('tj', 'b', '(Z)I', 'pixelHeight', 'Returns field_v >> 16; g() requires it to be under 30 before the ball can be caught.');
method('tj', 'e', '(I)I', 'horizontalSpeedSquared', 'Returns vx*vx + vy*vy of the shifted velocity fields.');
method('tj', 'd', '(I)I', 'computeChecksum', 'XORs every state field through fj.a, matching the checksum compared in Kickabout.');
method('tj', 'g', '(I)Z', 'canBeCaught', 'True only when uncatchable is zero, height is under 30 and the ball is on the pitch.');
method('tj', 'a', '(BI[Lla;)V', 'stepPhysics', 'Counts down uncatchable and highFriction, runs lt.a collision and applies friction and gravity.');
field('tj', 't', 'I', 'positionX', 'Printed first under p=[..] in toString and copied from the carrier\'s x each tick.');
field('tj', 'p', 'I', 'positionY', 'Printed second under p=[..]; the pitch bounds 0..88080384 are tested on it.');
field('tj', 'v', 'I', 'height', 'Printed third under p=[..]; below 30 pixels the ball may be caught.');
field('tj', 'q', 'I', 'velocityX', 'First entry of v=[..] in toString.');
field('tj', 'h', 'I', 'velocityY', 'Second entry of v=[..] in toString.');
field('tj', 'n', 'I', 'verticalVelocity', 'Third entry of v=[..]; decreased by 16384 while the ball is airborne.');
field('tj', 'm', 'I', 'possessorTeam', 'Printed before the slash in posessor=m/s and used to index the team array.');
field('tj', 's', 'I', 'possessorSlot', 'Printed after the slash in posessor=m/s and used to index the team slot.');
method('nl', 'f', '(I)I', 'pixelX', 'Returns field_M >> 16 and is compared with the ball\'s pixelX.');
method('nl', 'a', '(Z)I', 'pixelY', 'Returns field_w >> 16 and is compared with the ball\'s pixelY.');
method('nl', 'b', '(B)I', 'computeChecksum', 'XORs every state field through fj.a, as the ball and goal state do.');
method('nl', 'b', '(Z)Z', 'isMovingDiagonally', 'True when the direction mask has one horizontal and one vertical bit set.');
method('nl', 'a', '(BI)V', 'setAction', 'Stores the action code and loads its duration from the vf.field_I table.');
method('nl', 'a', '(II)V', 'setDirectionFromMask', 'Decodes the 1/2/4/8 direction bits into the x and y direction components.');
method('nl', 'd', '(I)I', 'directionMask', 'Re-encodes the x and y direction components as the 1/2/4/8 mask.');
method('nl', 'b', '(II)V', 'startTackle', 'Sets action 3 (ACTION_TACKLE), derives slide velocity from the angle and records the initiator.');
method('nl', 'c', '(B)I', 'chargeKickDuration', 'Result is stored as the action time when action 1 (ACTION_CHARGE_KICK) starts.');
method('nl', 'a', '(B)I', 'dashCooldown', 'Result is stored in the cooldown counter when action 4 (ACTION_DASH) starts.');
method('nl', 'a', '(ZLup;I)V', 'applyPlayerStats', 'Stores the stats object and derives the speed and acceleration fields from it.');
method('nl', 'a', '(I[Lla;ZZ)V', 'stepMovement', 'Per-tick update: cooldown and action timers, target velocity per action, lt.a collision and gravity.');
method('nl', 'a', '(ILml;)V', 'readFullState', 'Reads every simulation field from the packet buffer unconditionally.');
method('nl', 'b', '(ILml;)V', 'readDeltaState', 'Reads each field group only when a leading flag bit is set.');
field('nl', 'M', 'I', 'positionX', 'Printed first under loc=[..] and used as the ball\'s x when carried.');
field('nl', 'w', 'I', 'positionY', 'Printed second under loc=[..] and used as the ball\'s y when carried.');
field('nl', 'v', 'I', 'height', 'Printed third under loc=[..]; non-zero height triggers gravity.');
field('nl', 'K', 'I', 'verticalVelocity', 'Fourth loc entry; reduced by 26214 each tick while airborne.');
field('nl', 'L', 'I', 'actionTime', 'Printed as the first act=[..] entry and counted down while an action runs.');
field('nl', 'G', 'I', 'directionMask', 'Bit mask 1/2/4/8 for the four movement directions, clamped to the pitch bounds.');
field('nl', 'j', 'I', 'directionX', 'Set to -1/0/1 from bits 8 and 2 of the direction mask.');
field('nl', 'n', 'I', 'directionY', 'Set to -1/0/1 from bits 1 and 4 of the direction mask.');
field('nl', 'N', 'Lup;', 'stats', 'Assigned by applyPlayerStats and queried for speed, strength and trinkets.');
field('nl', 'F', 'I', 'controllingParticipant', 'Index into the per-participant LoggedPlayer counters for header and cross stats.');
field('nl', 'C', 'I', 'dashCooldown', 'Counted down every tick and set from dashCooldown() when a dash starts.');
method('nu', 'd', '(I)V', 'tick', 'Counts down the phase timer, bumps agent version counters, runs b(I) and applies queued player switches.');
method('nu', 'b', '(I)V', 'stepMatch', 'Per-tick game logic: AI updates, ball physics, possession, tackles, headers and goal detection.');
method('nu', 'c', '(I)I', 'computeChecksum', 'XORs the checksums of every footballer, the ball and the goal state.');
method('nu', 'a', '(Lnu;B)V', 'copyStateFrom', 'Copies every participant, agent, phase object and log from another CommonGame.');
method('nu', 'b', '(B)Lnl;', 'getBallCarrier', 'Returns the footballer indexed by the ball\'s possessor team and slot, or null.');
method('nu', 'a', '(BI)Lnl;', 'getControlledFootballer', 'Returns the footballer controlled by the given participant.');
method('nu', 'a', '(BII)I', 'findControllingParticipant', 'Finds the participant on the given team whose controlled slot equals the argument.');
method('nu', 'b', '(BLki;)V', 'applyPlayingCommand', 'Handles commands 0..7 (kick, dash, slide, switch player) from a ki event in phase 4.');
method('nu', 'a', '(ILki;)V', 'applyTeamSelectionCommand', 'Phase 0 only: forwards the ki event to the TeamSelectionAgent.');
method('nu', 'b', '(ZLki;)V', 'applyMoveInput', 'Phase 4 only: stores the event\'s direction mask on the participant\'s footballer.');
method('gt', 'd', '(I)Z', 'isActive', 'Returns true while the participant has neither resigned nor departed.');
field('gt', 'g', 'I', 'controlledSlot', 'Read as three bits minus one and compared with the footballer slot in findControllingParticipant.');
method('hv', 'a', '(ZLnu;I)V', 'updateKeeperAI', 'CommonGame.stepMatch calls it for slot 0 of each team, the keeper with the keeperstate fields.');
method('hf', 'a', '(ILnu;I)I', 'findClosestOutfielder', 'Loops slots 1..4 and returns the index with the smallest (or largest) ball distance.');
method('jt', 'a', '(Lnu;BII)Z', 'updateOutfielderAI', 'For an idle slot calls ri.a, otherwise go.a to move towards a target.');
method('go', 'a', '(ILnu;IIII)V', 'moveToTarget', 'Sets action 11 (ACTION_RUN_HOME) and steers the footballer towards the target coordinates.');
method('ri', 'a', '(BILnu;I)V', 'updateIdleMovement', 'Only acts while the action is 0: flips direction bits at the pitch limits and re-aims at the ball every tenth tick.');
method('nb', 'a', '(Lnl;I)I', 'keeperReach', 'Returns 170 minus eight times the keeper state field.');
method('ue', 'a', '(IILnl;I)V', 'steerTowardsPoint', 'Sets direction bits towards the target coordinates and clears them once within 10 pixels.');
method('oe', 'e', '(I)I', 'countTeamZero', 'Private loop counting selection entries equal to 0.');
method('oe', 'd', '(I)I', 'countTeamOne', 'Private loop counting selection entries equal to 1.');
method('oe', 'a', '(II)Z', 'isReadyOrInactive', 'True when the participant has left or has its ready bit set.');
method('oe', 'a', '(BI)Z', 'canJoinTeamZero', 'Checks the size limits of both teams before a participant may pick team 0.');
method('oe', 'b', '(BI)Z', 'canJoinTeamOne', 'Checks the size limits of both teams before a participant may pick team 1.');
method('oe', 'a', '(III)V', 'applyCommand', 'Command 0 picks team 0, 1 picks team 1 and 2 toggles the ready bit for the participant.');
field('oe', 'o', 'I', 'readyMask', 'Printed as ready= in toString and toggled per participant by applyCommand command 2.');
field('oe', 'k', '[I', 'selection', 'Printed as selection=[..]; holds -1, 0 or 1 per participant and indexes the two team counters.');
method('wr', 'a', '(III)V', 'applyCommand', 'Command 0 selects the previous formation, 1 the next and 2 confirms the team\'s choice.');
method('wr', 'a', '(B)Z', 'allFormationsConfirmed', 'Returns true when both teams\' confirmed flags are set.');
field('wr', 'k', '[I', 'formationChoice', 'Printed after team0= and team1= in toString and clamped to the formation table length.');
field('wr', 'i', '[Z', 'formationConfirmed', 'Printed after the slash in toString and set by command 2.');
method('ua', 'a', '(Ltj;I)V', 'detectGoal', 'When the free ball is between x 370 and 525 and beyond either goal line it starts the goal counter and records the scorer.');
method('ua', 'c', '(I)I', 'computeChecksum', 'Returns the checksum of the score, goal counter and scorer.');
method('ua', 'a', '(Lml;B)V', 'readState', 'Reads the two scores, goal counter and scorer from the buffer when the leading flag is set.');
method('la', 'a', '(IIII)Z', 'containsPoint', 'Compares x, y and height against the box extents and returns whether the point lies inside.');
method('pe', 'a', '([Lla;B[I)Z', 'isInsideAnyArea', 'Returns true when the area array is null or any PlayArea contains the x, y, height triple.');
method('lt', 'a', '(II[Lla;IIIII)[I', 'moveWithinAreas', 'Advances x, y and height separately and reverts and negates a velocity component when the new point leaves every PlayArea.');
method('p', 'a', '(ILnu;)V', 'recordTick', 'Adds one to the carrier\'s per-footballer counter, the nobody counter or the pitch-end counter for the ball\'s side.');
method('p', 'a', '(ILp;)V', 'copyFrom', 'Copies the pitch-end, per-footballer, per-player and nobody counters from another log.');
field('p', 'c', '[I', 'pitchEnds', 'Printed as pitchEnds= in toString and incremented by recordTick for the ball\'s side.');
field('p', 'b', '[[I', 'perFootballer', 'Printed as perFootballerHome and perFootballerAway; indexed by possessor team and slot.');
field('p', 'f', '[I', 'perPlayer', 'Printed as perPlayer= as a dot-separated list sized by the constructor argument.');
field('p', 'd', 'I', 'nobody', 'Printed as nobody= and incremented while the ball has no possessor.');
method('ch', 'a', '(Liw;B)V', 'readFromBuffer', 'Reads the scorer, ball, goal type, keeper and time fields from a PacketBuffer in order.');
method('ch', 'a', '(ILch;)V', 'copyFrom', 'Copies all sixteen fields from another LoggedGoal.');
method('ch', 'a', '(IIIIILnu;II)V', 'captureGoal', 'Fills scorer, kick, keeper and time fields from the CommonGame footballers for a goal of the given type.');
field('ch', 'q', 'I', 'scorerX', 'First value of p=(..) in toString, taken from the scorer\'s pixelX.');
field('ch', 'r', 'I', 'scorerY', 'Second value of p=(..) in toString, taken from the scorer\'s pixelY.');
field('ch', 'k', 'I', 'scorerTeam', 'Set from the team argument and printed after p=(..).');
field('ch', 'g', 'I', 'scorerSlot', 'Set from the slot argument and printed after the team.');
field('ch', 's', 'I', 'scorerParticipant', 'First argument of captureGoal, stored before the team and slot.');
field('ch', 'h', 'I', 'kickVelocityX', 'First value of b=(..) in toString, halved until it fits within 127.');
field('ch', 'j', 'I', 'kickVelocityY', 'Second value of b=(..) in toString, halved until it fits within 127.');
field('ch', 'm', 'I', 'keeperX', 'First value of g=(..) in toString, taken from the defending slot-0 footballer.');
field('ch', 'p', 'I', 'keeperY', 'Second value of g=(..) in toString, taken from the defending slot-0 footballer.');
field('ch', 'e', 'I', 'keeperState', 'Printed after g=(..) and copied from the defending keeper\'s keeper-state field.');
field('ch', 'i', 'I', 'kickCharge', 'Printed after "kick/" in toString.');
field('ch', 'n', 'Z', 'highKick', 'Printed after the kick charge and copied from the footballer\'s boolean kick flag.');
method('jc', 'a', '(ZLjc;)V', 'copyFrom', 'Copies the home flag, reward, member flag and all counters from another LoggedPlayer.');
field('jc', 'd', 'Z', 'reward', 'Printed as reward= in toString.');
field('jc', 'b', 'Z', 'member', 'Printed as member= in toString.');
field('jc', 's', 'I', 'totalGoals', 'Printed as tot_goals= in toString.');
method('nu', 'c', '(ILki;)V', 'applyParticipantEvent', 'Switches on the event value to mark the participant departed, resigned or finished loading.');
method('nu', 'a', '(II)V', 'placeKickoffPositions', 'Moves every footballer to its formation position and the ball to the pitch centre with no possessor.');
method('nu', 'b', '(II)V', 'handleParticipantLeft', 'In phase 0 updates the team selection agent, in phase 4 frees the ball if the participant held it.');
method('nu', 'a', '(BLki;)V', 'applyKickCommand', 'Starts a kick with the event\'s aim and charge, or a slide tackle when no kick is being charged.');
method('nu', 'a', '(ILmo;II)V', 'switchControlledFootballer', 'Hands a participant\'s control to another footballer slot and copies the direction mask across.');
method('nu', 'a', '(Lki;B)V', 'applyLineupCommand', 'Phase 3 only: forwards the event to the LineupAgent and syncs the participant snapshot.');
method('nu', 'b', '(IB)V', 'passToTeammate', 'Aims at a teammate of the possessing team and launches the ball with velocity and uncatchable 10.');
method('nu', 'a', '(IZZIBI)V', 'kickBall', 'Converts kick power, aim and the high-kick flag into ball velocity and clears the possessor.');
method('nu', 'a', '(B)V', 'processEventQueue', 'Walks the queued PlayerInputEvents and dispatches each by event type to the apply methods.');
method('nu', 'b', '(ILki;)V', 'applyFormationCommand', 'Phase 2 only: forwards the event to the FormationAgent.');
method('nu', 'a', '(Lki;I)V', 'enqueueEvent', 'Appends a PlayerInputEvent to the queue walked by processEventQueue.');
method('nu', 'a', '(IB)V', 'enterPhase', 'Stores the phase, resets the timer and creates the TeamSelection, Formation, LineUp or match agents.');
field('ki', 'r', 'I', 'eventType', 'Compared with 0..7 in toString and in processEventQueue to pick the handler.');
field('ki', 'u', 'I', 'participant', 'Index into CommonGame participantStatus and input arrays.');
field('ki', 'v', 'I', 'value', 'Command code or key mask printed after the event name in toString.');
method('iw', 'a', '(III[B)V', 'writeBytes', 'Copies a byte array range into the buffer and advances the cursor, as Escape Vector PacketBuffer.writeBytes.');
method('iw', 'j', '(I)Ljava/lang/String;', 'readCircumfixedString', 'Throws unless the first byte is zero, then reads a zero-terminated string, as Escape Vector readCircumfixedString.');
method('iw', 'a', '(IB)V', 'writeMedium', 'Writes value >> 16, >> 8 and the low byte, as Escape Vector PacketBuffer.writeMedium.');
method('iw', 'j', '(B)B', 'readByte', 'Returns the signed byte at the cursor and advances it, as Escape Vector readByte.');
method('iw', 'k', '(I)I', 'readInt', 'Advances four bytes and combines them big-endian, as Escape Vector readInt.');
method('iw', 'a', '(Ljava/lang/String;B)V', 'writeCircumfixedString', 'Writes a zero byte, the Cp1252 text and a closing zero byte, as Escape Vector writeCircumfixedString.');
method('iw', 'j', '(II)V', 'backpatchIntLength', 'Stores the four-byte length at the position before the payload it measures.');
method('iw', 'f', '(B)I', 'readUnsignedShortOrInt', 'Reads a short when the next byte is non-negative, otherwise an int with the top bit cleared.');
method('iw', 'a', '(BI)V', 'padToPosition', 'Writes zero bytes until the cursor reaches the given position, as Escape Vector padToPosition.');
method('iw', 'h', '(B)I', 'readUnsignedByte', 'Returns the byte at the cursor masked with 255 and advances, as Escape Vector readUnsignedByte.');
method('iw', 'a', '(II)V', 'writeByte', 'Stores one byte at the cursor and advances it, as Escape Vector writeByte.');
method('iw', 'a', '(JI)V', 'writeLong', 'Writes the eight bytes of a long from the top down, as Escape Vector writeLong.');
method('iw', 'a', '([BIBI)V', 'readBytes', 'Copies buffer bytes into the destination array range, as Escape Vector readBytes.');
method('iw', 'g', '(II)V', 'writeShort', 'Writes value >> 8 then the low byte, as Escape Vector writeShort.');
method('iw', 'b', '(I)I', 'readSignedMedium', 'Reads three bytes and subtracts 16777216 when the value exceeds 8388607.');
method('iw', 'h', '(I)Z', 'verifyCrc32', 'Steps back four bytes and compares the stored checksum with the computed one, as Escape Vector verifyCrc32.');
method('iw', 'i', '(II)V', 'writeVarInt', 'Writes one to five bytes with 7 bits each and a continuation bit.');
method('iw', 'd', '(II)V', 'backpatchShortLength', 'Stores the two-byte length before the payload it measures, as Escape Vector backpatchShortLength.');
method('iw', 'i', '(B)J', 'readLong', 'Reads two ints and joins them into a long.');
method('iw', 'a', '(BJ)V', 'writeLong56', 'Writes seven bytes of a long from bit 48 down, as Escape Vector writeLong56.');
method('iw', 'i', '(I)I', 'readUnsignedMedium', 'Advances three bytes and combines them big-endian, as Escape Vector readUnsignedMedium.');
method('iw', 'a', '(I)Ljava/lang/String;', 'readString', 'Reads bytes up to the zero terminator, as Escape Vector readString.');
method('iw', 'c', '(II)V', 'backpatchByteLength', 'Stores the one-byte length before the payload it measures, as Escape Vector backpatchByteLength.');
method('iw', 'f', '(II)V', 'writeUnsignedSmart', 'Writes one byte below 128 or a short offset by 32768, as Escape Vector writeSignedSmart\'s unsigned twin.');
method('iw', 'e', '(I)I', 'readSignedSmart', 'Reads a byte minus 64 or a short minus 49152, as Escape Vector readSignedSmart.');
method('iw', 'a', '(BLjava/lang/String;)V', 'writeBase38Password', 'Multiplies a long by 38 per character over 20 characters, as Escape Vector writeBase38Password.');
method('iw', 'a', '(IZ)I', 'appendCrc32', 'Computes the checksum, writes it as an int and returns it, as Escape Vector appendCrc32.');
method('iw', 'a', '(ILjava/lang/String;)V', 'writeString', 'Writes the Cp1252 text and a closing zero byte, as Escape Vector writeString.');
method('iw', 'a', '(Ljava/math/BigInteger;Ljava/math/BigInteger;I)V', 'rsaEncrypt', 'Encrypts the buffer contents with the supplied modulus and exponent, as Escape Vector rsaEncrypt.');
method('iw', 'e', '(II)V', 'writeSignedSmart', 'Writes a byte for -64..63 or a short offset by 49152, as Escape Vector writeSignedSmart.');
method('iw', 'f', '(I)I', 'readUnsignedSmart', 'Reads one byte or a short minus 32768, as Escape Vector readUnsignedSmart.');
method('iw', 'a', '([IB)V', 'xteaEncrypt', 'Encrypts the whole buffer from position 0 in eight-byte blocks with the key.');
method('hs', 'a', '(B)Z', 'isLocalParticipantActive', 'Returns true when the local seat is not -2 and that participant is still active.');
method('hs', 'd', '(I)V', 'positionButtons', 'Places each io button using the overridable x and y hooks when e() allows it.');
method('hs', 'c', '(I)V', 'drawPanelBackground', 'Fills the 10,50 620x320 translucent panel with colour 65793.');
method('hs', 'b', '(II)V', 'drawCountdown', 'Draws the seconds value param1/50 in a box at the top of the view.');
method('hs', 'a', '(ZLjava/lang/String;)V', 'drawTitle', 'Fills a title bar and draws the upper-cased text centred at x 320.');
method('hs', 'e', '(I)V', 'drawContent', 'Abstract per-frame draw hook; TeamSelection, WaitForPlayers and Formation views each implement a full panel draw.');
method('hs', 'f', '(II)V', 'onButtonClick', 'Abstract click hook; FormationView submits the formation when the button kind is 41.');
method('hs', 'a', '(IZ)V', 'update', 'Per-frame update: builds the ko selection from the button positions and, in subclasses, refreshes button states.');
method('hs', 'a', '(CII)Z', 'handleKey', 'Moves the ko selection with the arrow keys and activates the focused button on enter.');
method('hs', 'c', '(II)I', 'buttonY', 'Default y of button n is 342 - 29*n; FormationView overrides it with a constant.');
method('hs', 'd', '(II)I', 'buttonX', 'Default x of every button is 544; FormationView overrides it with 493.');
method('hs', 'e', '(II)Z', 'isButtonEnabled', 'Default returns true; FormationView disables buttons depending on the participant\'s team.');
method('va', 'a', '(ZLki;)V', 'queueInputEvent', 'Starts with CommonGame.enqueueEvent for the event and then forwards key and mouse events to the footballer.');
method('ol', 'a', '(BI)Ljava/lang/String;', 'formatMatchTime', 'Converts the tick difference to seconds and returns minutes and seconds as two-digit text.');
method('wl', 'a', '(II)Z', 'isReadyOrInactive', 'True when the participant has left or has its ready bit set.');
method('wl', 'a', '(ZI)Z', 'hasChosenAllSlots', 'Returns false while any of the participant\'s team slots it owns still has choice -1.');
method('wl', 'a', '(Lml;Z)V', 'readState', 'Reads the 2x4 slot choices, the ready mask and the chosen player stats from the buffer.');
method('wl', 'a', '(ILgr;II)Z', 'canSelectPlayer', 'Rejects squad entries that are empty, already used or already picked in another slot of the team.');
method('wl', 'a', '(Lgr;[Lup;BII)V', 'autoSelectPlayer', 'Scans squad entries 0..8 and applies the first one canSelectPlayer allows.');
method('wl', 'a', '(IILgr;[Lup;I)V', 'applyCommand', 'Command -1 toggles the ready bit; other values pick or clear a squad entry for a slot.');
field('wl', 'j', '[[I', 'slotChoice', 'Per team and slot squad index, -1 when unchosen; read as four bits minus one.');
field('wl', 'm', '[[I', 'slotOwner', 'Participant that owns each team slot; compared with the acting participant.');
field('wl', 'h', 'I', 'readyMask', 'Bit per participant; toggled by command -1 and tested by isReadyOrInactive.');
field('wl', 'i', '[[Lup;', 'slotStats', 'PlayerStats chosen for each team slot, copied and read alongside the choices.');
method('nl', 'c', '(II)V', 'startDive', 'Faces the target x, stores it and sets action 5 (ACTION_DIVE) with extra duration from the keeper stat.');
method('wt', 'a', '(Ltj;Lnl;BI)Z', 'tryKeeperDive', 'Projects the free ball to the footballer\'s line and calls startDive when it will cross inside the goal mouth.');
method('es', 'a', '(ILnl;ILnl;Ltj;)V', 'tryKeeperTackle', 'When the ball is possessed and within nb.a reach of the keeper it starts a tackle with action time 200.');
method('vl', 'a', '(Lnu;B)V', 'computeCameraFocus', 'Clamps the ball position to a 450 pixel radius around the pitch centre (448,672) and stores it.');
method('tc', 'a', '(IBILnl;I)Z', 'advanceToPoint', 'Clamps the footballer\'s position along its direction bits to the target and stops with a direction reset on arrival.');
method('hd', 'a', '(BLhd;)V', 'addChild', 'Creates the child tf on first use and appends the node.');
method('hd', 'b', '(Z)V', 'invalidateChildren', 'Marks every child dirty and recurses into its children.');
method('hd', 'a', '(ILhd;)V', 'setFocusedNode', 'Recurses into the children and sets the focus flag on the node equal to the argument.');
method('hd', 'a', '(II)I', 'computeContentWidth', 'Returns the widest of the text, sprite and child extents, starting from the argument.');
method('fn', 'k', '(I)Z', 'isShinPads', 'Tests type id 56, SHIN PADS in the trinket name table.');
method('fn', 'c', '(B)Z', 'isTramline', 'Tests type id 68, CHEAT: TRAMLINE in the trinket name table.');
method('fn', 'e', '(I)Z', 'isMoonball', 'Tests type id 70, CHEAT: MOONBALL in the trinket name table.');
method('fn', 'c', '(I)Z', 'hasTackleProtection', 'True for type id 55 IMMUNITY or 56 SHIN PADS.');
method('fn', 'j', '(I)Z', 'isEmpty', 'Tests type id 0, the Empty entry of the trinket name table.');
method('fn', 'm', '(I)Z', 'isAtomBall', 'Tests type id 67, CHEAT: ATOMBALL in the trinket name table.');
method('fn', 'l', '(I)Z', 'isPumpkins', 'Tests type id 72, CHEAT: PUMPKINS in the trinket name table.');
method('fn', 'f', '(Z)Z', 'isTorquing', 'Tests type id 69, CHEAT: TORQUING in the trinket name table.');
method('fn', 'b', '(Z)Z', 'isSafeTacklerOrShinPads', 'True for type id 54 SAFE TACKLER or 56 SHIN PADS.');
method('fn', 'n', '(I)Z', 'isMushroom', 'Tests type id 64, CHEAT: MUSHROOM in the trinket name table.');
method('fn', 'g', '(I)Z', 'isMoonwalk', 'Tests type id 65, CHEAT: MOONWALK in the trinket name table.');
method('fn', 'a', '(I)Z', 'isActiveHorrorCostume', 'Tests type id 73, COSTUME: HORROR, together with a be.e check.');
method('fn', 'e', '(Z)Z', 'isWhereAmI', 'Tests type id 63, CHEAT: WHEREAMI in the trinket name table.');
method('fn', 'c', '(Z)Z', 'isAsteroid', 'Tests type id 71, CHEAT: ASTEROID in the trinket name table.');
method('fn', 'd', '(I)Z', 'isTankClone', 'Tests type id 59, TANK CLONE in the trinket name table.');
method('fn', 'h', '(I)Z', 'isHotshotClone', 'Tests type id 60, HOTSHOT CLONE in the trinket name table.');
method('fn', 'a', '(Z)Z', 'isSlalom', 'Tests type id 62, SLALOM in the trinket name table.');
method('fn', 'e', '(B)Z', 'isAirplane', 'Tests type id 66, CHEAT: AIRPLANE in the trinket name table.');
method('fn', 'p', '(I)Z', 'isRangerClone', 'Tests type id 61, RANGER CLONE in the trinket name table.');
method('fn', 'f', '(B)Ljava/lang/String;', 'getName', 'Returns the rv.field_b name for the trinket type id.');
method('gu', 'a', '(IILjava/lang/String;)V', 'addItem', 'Creates a vu item with the given id and text, links it into the menu and records its action id.');
method('gu', 'a', '(Ljava/lang/String;ZILut;)V', 'addItemWithIcon', 'Creates a vu item with an icon sprite and text and records its action id.');
method('gu', 'a', '(BZ)I', 'getSelectedActionId', 'Returns the action id of the item whose pointer state is set, the default id, or -1 or -2.');
method('i', 'a', '(II)V', 'handleResult', 'Called with the pressed button result; the base class plays a sound, closes the dialog and subclasses add their action.');
method('i', 'a', '(B)I', 'dialogHeight', 'Computed from the text and icon heights in the base class; subclasses override it with constants such as 320, 346 or 400.');
method('i', 'b', '(I)I', 'dialogWidth', 'Base class width from the text and icon; subclasses return constants such as 400, 470 or 545.');
method('pk', 'a', '(Z)Z', 'pollArchives', 'tu polls it until true before calling buildAssets; GameResourceLoader checks archive downloads in it.');
method('pk', 'b', '(I)V', 'buildAssets', 'Called once after pollArchives returns true; GameResourceLoader builds sprites, fonts and lobby assets with progress steps.');
method('pk', 'c', '(I)Z', 'pollReady', 'tu polls it after buildAssets to set the loaded flag; GameResourceLoader also waits for the message of the day.');
method('pk', 'a', '(I)V', 'bindArchives', 'Called on tu with 7312 when the reload flag is set; GameResourceLoader assigns each archive group to its static field.');
method('eh', 'b', '(B)V', 'requestMessageOfTheDay', 'Creates the request object for the motd resource.');
method('eh', 'e', '(I)Z', 'pollMessageOfTheDay', 'Waits for the request then reads the motd_message and motd_image entries.');
method('vg', 'l', '(I)V', 'deleteSelection', 'Removes the characters between the selection ends from the StringBuilder and collapses the caret.');
method('vg', 'c', '(Z)V', 'copySelectionToClipboard', 'Puts the selected text into a StringSelection and hands it to the platform dispatcher.');
method('vg', 'k', '(I)V', 'clear', 'Empties the StringBuilder, resets caret and selection and clears the label text.');
method('vg', 'a', '(Lbu;I)V', 'setPlatformDispatcher', 'Stores the PlatformTaskDispatcher used for clipboard access.');
method('vg', 'b', '(IB)V', 'setTextColour', 'Stores the colour on the label node.');
method('vg', 'j', '(I)I', 'getCaretPosition', 'Returns the caret index field.');
method('vg', 'b', '(Ljava/lang/String;I)V', 'setText', 'Replaces the text, truncated to the maximum length, and moves the caret to the end.');
method('vg', 'h', '(B)V', 'cutSelection', 'Copies the selection to the clipboard and then deletes it.');
method('vg', 'k', '(B)V', 'requestPaste', 'Asks the platform dispatcher for the clipboard contents.');
method('vg', 'd', '(II)I', 'characterIndexAtWidth', 'Accumulates glyph widths from a start index until the pixel width is reached.');
method('vg', 'a', '(ICI)Z', 'handleKey', 'Inserts printable characters 32..126 with the maximum length check and handles editing keys.');
method('vg', 'j', '(B)Ljava/lang/String;', 'getText', 'Returns the StringBuilder as a string.');
method('vg', 'i', '(B)Ljava/lang/String;', 'getSelectedText', 'Returns the substring between the selection ends.');
method('vg', 'i', '(I)I', 'nextWordBoundary', 'Scans right from the caret for a character rejected by pi.a.');
method('vg', 'f', '(II)V', 'setCaret', 'Moves caret and selection anchor to the same index.');
method('vg', 'h', '(I)I', 'previousWordBoundary', 'Scans left from the caret for a character rejected by pi.a.');
method('vg', 'a', '(Ljava/lang/String;I)V', 'insertText', 'Truncates to the remaining length and inserts at the caret.');
method('vg', 'a', '(IBI)V', 'setSelection', 'Clamps both indices to the text length and stores them as caret and anchor.');
method('vg', 'b', '(I)V', 'updatePointer', 'Maps the pointer x to a character index and handles click, double click and drag selection.');
method('eo', 'a', '(IIIIII)V', 'drawRectangleOutline', 'Draws the four edges with the horizontal and vertical line helpers.');
method('eo', 'a', '(ZI)Lhd;', 'createButtonNode', 'Builds an hd with four state sprites copied from the field_c or field_r sprite sets and sized to the first.');
method('eo', 'b', '()Lhd;', 'createDefaultButtonNode', 'Builds an hd with four state sprites from the field_n set and sized to the first.');
method('eo', 'a', '(Lut;)Lkg;', 'toIndexedSprite', 'Builds a 256-entry palette from the distinct pixel colours and stores each pixel as a palette index.');
method('eo', 'a', '(Lut;Lot;)V', 'downscaleByHalf', 'Averages each 2x2 pixel block of the source sprite into one pixel of the destination.');
method('eo', 'd', '(IIII)V', 'darkenRectangle', 'Clips the rectangle to the raster bounds and darkens its pixels by a fixed factor.');
method('eo', 'a', '(Lut;IIIIII)V', 'drawSpriteClipped', 'Clamps the size to 640x480 and picks the opaque, 240 or generic alpha blit by the alpha argument.');
method('eo', 'a', '(III)Z', 'isAngleInRange', 'Masks angles to 13 bits and tests whether the first lies in the arc starting at the second with the given length.');
method('ci', 'a', '(B)Lam;', 'pollFirst', 'Unlinks and returns the node after the sentinel, or null when the deque is empty.');
method('ci', 'a', '(ILam;)V', 'addLast', 'Unlinks the node if already linked and inserts it before the sentinel.');
method('aj', 'a', '(ILjava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;', 'replaceAll', 'Loops indexOf and substring to replace every occurrence of the first string in the third with the second.');
method('dc', 'a', '(IB)V', 'moveToFront', 'Shifts the earlier entries of ue.field_f one place up and stores the selected entry at index 0.');
method('eb', 'b', '(I)V', 'shutdown', 'Sets the stop flag, notifies the monitor and joins the worker thread.');
method('eb', 'a', '(IILqh;)Lhi;', 'enqueueRead', 'Creates an operation 3 request for the group and queues it, as Escape Vector enqueueRead.');
method('eb', 'a', '(ILqh;I)Lhi;', 'readImmediate', 'Creates an operation 1 request and waits for the worker to finish it, as Escape Vector readImmediate.');
method('eb', 'a', '(ILqh;[BB)Lhi;', 'enqueueOperation', 'Creates a request carrying the data array and operation code and queues it, as Escape Vector enqueueOperation.');
method('eb', 'a', '(Lhi;Z)V', 'enqueue', 'Adds the request to the deque under the monitor, bumps the pending count and notifies the worker.');
method('hi', 'a', '(I)I', 'progress', 'Returns 0 while the request is pending, otherwise 100.');
method('hi', 'b', '(I)[B', 'getBytes', 'Throws while the request is pending, otherwise returns the data array.');
method('eq', 'a', '(JB)Ljava/lang/Object;', 'get', 'Looks the key up in the hash table and returns the cached object, or null.');
method('eq', 'a', '(JLjava/lang/Object;B)V', 'put', 'Stores the object with weight 1 under the key.');
method('eq', 'a', '(ILjava/lang/Object;IJ)V', 'putWeighted', 'Throws if the weight exceeds the capacity, removes any old entry and evicts until the weight fits.');
method('eq', 'a', '(BJ)V', 'remove', 'Looks up the entry for the key and removes it.');
method('eq', 'a', '(Lij;I)V', 'removeEntry', 'Unlinks the entry from both lists and returns its weight to the remaining capacity.');
method('fb', 'l', '(I)I', 'getDay', 'Parses the first two-digit text field as an integer.');
method('fb', 'h', '(B)I', 'getMonthIndex', 'Parses the second two-digit text field and subtracts one.');
method('fb', 'm', '(I)I', 'getYear', 'Parses the four-digit text field as an integer.');
method('fu', 'a', '(IB)I', 'get', 'Throws ArrayIndexOutOfBoundsException past the size and otherwise returns the element.');
method('fu', 'a', '(I)I', 'size', 'Returns the last index plus one.');
method('fu', 'c', '(II)V', 'add', 'Stores the value at the next index through the private set method.');
method('fu', 'a', '(II)V', 'removeAt', 'Shifts later elements down by one and decrements the last index.');
method('fu', 'a', '(ZII)V', 'set', 'Raises the size if needed, grows the array if the index is past its end and stores the value.');
method('fu', 'b', '(II)I', 'nextCapacity', 'Doubles or steps the current array length until the requested index fits.');
method('fu', 'a', '(IZ)V', 'grow', 'Allocates an array of the computed capacity and copies the old contents.');
method('gd', 'a', '(I[Lbc;J)V', 'addAll', 'Adds every bc row to its category table with the given timestamp.');
method('gd', 'a', '(BLbc;J)V', 'add', 'Wraps the row in an iu with the timestamp and stores it in its category table by id.');
method('gd', 'b', '(I)V', 'clear', 'Clears all seven tables and zeroes their counters.');
method('gd', 'a', '(III)V', 'evictExpired', 'Walks each category table and removes rows outside the id range or past their age.');
method('gd', 'a', '(IBI)Lbc;', 'get', 'Returns the cached row for the id in the category, or null for an out-of-range category.');
method('fv', 'a', '(BLjava/lang/String;)Z', 'openUrlWithShell', 'On Windows runs cmd /c start with an http or https address and reports success.');
method('kk', 'a', '(IIIII)V', 'scale', 'Multiplies each vertex coordinate by a ratio of the arguments.');
method('kk', 'a', '(IIII)V', 'translate', 'Adds an offset to every vertex from the start index.');
method('kk', 'a', '(Z)V', 'computeBounds', 'Computes the minimum and maximum vertex extents once and caches them.');
method('nb', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Lbs;', 'wrapException', 'Appends the context text to an existing ClientException or wraps the throwable in a new one; called from every catch block.');
method('nb', 'b', '(I)Z', 'loadSound', 'Loads the named sound from the archive and stores the decoded PcmSample when it is available.');
method('nj', 'a', '(I)J', 'monotonicMillis', 'Adds the amount the system clock went backwards to a running offset so the returned time never decreases.');
method('n', 'a', '(B)Z', 'pollMasterIndex', 'Reads the archive master index and verifies it against the configured RSA keys.');
method('sr', 'a', '(ILjava/lang/Object;Ljava/lang/Object;)I', 'compare', 'Abstract comparison of two sp shop slots implemented by each sort criterion.');
method('sr', 'a', '(I)I', 'directionCount', 'Abstract; subclasses return the number of sort directions, 2 in the ones read.');
method('sr', 'a', '(ZI)V', 'cycleDirection', 'Advances the direction index modulo directionCount when the flag is set, otherwise resets it to 0.');
method('oa', 'a', '(ZLhc;)V', 'registerOverlay', 'Inserts the OverlayLayer at the front of the sn.field_g vector.');
method('or', 'a', '(Ljava/lang/String;I)V', 'printError', 'Prints "Error: " followed by the text with %0a replaced by newlines.');
method('q', 'a', '(B)Llk;', 'readToken', 'Returns the next token and advances the cursor.');
method('q', 'a', '(I)Z', 'isAtEnd', 'True when the cursor is past the last token.');
method('rc', 'a', '(ILiw;[B)V', 'decompress', 'Checks the gzip magic bytes at the cursor and inflates into the output array.');
method('rd', 'a', '(II)Z', 'isLeapYear', 'Tests the Julian rule before year 1582 and the Gregorian rule after it.');
method('sb', 'b', '(I)C', 'nextChar', 'Returns the character at the position and advances it.');
method('sb', 'a', '(B)Z', 'isAtEnd', 'True when the position has reached the length.');
method('sn', 'a', '(B)Z', 'isDone', 'True when there is no pending fetch or the fetch has completed.');
method('sn', 'a', '(Z)Liw;', 'getResult', 'Returns the downloaded data as a PacketBuffer.');
method('su', 'a', '(IJ)Ljava/lang/String;', 'decodeBase37Name', 'Converts a base-37 long into a name, rejecting values at or above 6582952005840035281.');
method('td', 'b', '(I)V', 'buildTrinketTable', 'Allocates 111 Trinket slots and fills them in type id order.');
method('ti', 'a', '(ILjava/lang/String;)Lue;', 'findEntry', 'Walks the entry list and returns the entry with the given name.');
method('vl', 'a', '(ILjava/applet/Applet;)V', 'saveLastLoginMethod', 'Writes the method text to the jagex-last-login-method cookie for 31536000 seconds.');
method('vl', 'a', '(Ljava/lang/String;I)Z', 'matchesName', 'Compares the stored text with the argument, ignoring case.');
method('nh', 'b', '(I)I', 'rgbToHsv', 'Finds the largest and smallest RGB components and packs a hue in sixths, saturation and value into one int.');
method('nh', 'a', '(I)I', 'hsvToRgb', 'Private converter that selects one of six hue sectors and rebuilds the packed RGB colour from hue, saturation and value.');
method('nh', 'a', '([IDDD)V', 'adjustHsv', 'Converts each pixel to HSV, rotates the hue and scales saturation and value, converts back and keeps non-black pixels non-zero.');
method('nh', 'a', '(Lut;DDD)V', 'adjustSpriteHsv', 'Applies adjustHsv to the sprite\'s pixel array.');
method('nh', 'a', '(Lot;)Lut;', 'toMaskedSprite', 'Copies an ArgbSprite into a Sprite, writing 0 where the alpha bit is clear and the colour otherwise.');
method('nh', 'b', '(Lot;)Lot;', 'downscaleArgbByHalf', 'Averages each 2x2 block of ARGB pixels into one pixel of a half-size ArgbSprite.');
method('kp', 'a', '(BLml;)V', 'readFromPacket', 'Reads two player ids and the option and lineup fields from the packet buffer.');
method('kp', 'a', '(ZLkp;)V', 'copyFrom', 'Copies the option fields and clones the per-slot arrays from another record.');
method('jb', 'e', '(I)V', 'beginClose', 'Sets the state field to 2 so the slide-out animation runs and the dialog is removed.');
method('jb', 'a', '(I)Z', 'isClosed', 'True when the state is 2 and the slide counter has reached zero.');
method('jb', 'a', '([Ljava/lang/String;B)V', 'setOptionLabels', 'Stores the option label strings used for the buttons.');
method('jb', 'a', '(IBC)Z', 'handleKey', 'Does nothing outside state 1; enter closes the dialog, other keys move the ko selection and activate the focused option.');
method('jb', 'a', '(I[Ljava/lang/String;I)V', 'open', 'Resets state and counters, measures the dialog from its option labels and centres it on the 480 pixel height.');
method('ei', 'a', '(IB)I', 'sine', 'Masks the angle to 13 bits and reads the mg.field_b quarter table with sign handling; the result multiplies the y component of slide velocity.');
method('we', 'a', '(IZ)I', 'cosine', 'Masks the angle to 13 bits and reads the mg.field_b quarter table, shifted a quarter turn from sine; the result multiplies the x component of slide velocity.');
method('cc', 'a', '(IZIII)V', 'setFromAxisAngle', 'Halves the angle, stores its cosine in the first component and scales the axis arguments by its sine for the other three.');
method('cc', 'a', '(I[I)V', 'toRotationMatrix', 'Squares and cross-multiplies the four components to fill the int array with nine rotation matrix entries.');
method('ec', 'b', '(I)Ljava/lang/String;', 'getText', 'Returns the stored text, never null.');
method('ec', 'c', '(I)Z', 'getFlag', 'Returns the boolean flag set by the constructor.');
method('ec', 'a', '(IIIBIII)Z', 'rectangleContains', 'True when the point x and y lies inside the rectangle given by origin and size.');
method('sj', 'a', '(BI)Z', 'isValidGroup', 'Tests the group id against the table bounds and the archive\'s present flags, as Steel Sentinels ResourceArchive.isValidGroup.');
method('sj', 'a', '(BLjava/lang/String;I)I', 'getFileId', 'Looks up the file name hash within a group and returns its id, as Armies of Gielinor getFileId.');
method('sj', 'a', '(I)I', 'getGroupCapacity', 'Returns the number of group slots, as Steel Sentinels getGroupCapacity.');
method('sj', 'a', '(IB)V', 'loadPackedGroup', 'Decodes a group stored as one packed block, as Steel Sentinels loadPackedGroup.');
method('sj', 'a', '(III)Z', 'ensureFileAvailable', 'Returns whether the file\'s group is loaded and requests it when missing, as Armies of Gielinor ensureFileAvailable.');
method('sj', 'a', '(I[III)Z', 'unpackGroup', 'Splits a decompressed group into its files using the stripe table, as Steel Sentinels unpackGroup.');
method('sj', 'a', '(I[IZI)[B', 'takeFile', 'Returns the file bytes, decrypting with the key when given and releasing the cached copy, as Brick-a-Brac takeFile.');
method('sj', 'a', '(Ljava/lang/String;I)I', 'getGroupProgressByName', 'Finds the group by name and returns its download percentage, as in three other games.');
method('sj', 'a', '(Ljava/lang/String;Ljava/lang/String;B)Z', 'ensureFileAvailableByName', 'Looks up group and file by name and calls ensureFileAvailable, as Brick-a-Brac ensureFileAvailableByName.');
method('sj', 'a', '(Ljava/lang/String;Ljava/lang/String;I)[B', 'takeFileByName', 'Looks up group and file by name and calls takeFile, as Brick-a-Brac takeFileByName.');
method('sj', 'a', '(Z)Z', 'ensureAllGroupsAvailable', 'Loops all groups and returns true only when each is available, as Steel Sentinels ensureAllGroupsAvailable.');
method('sj', 'b', '(IB)I', 'getGroupProgress', 'Returns the download percentage of a group id, as in three other games.');
method('sj', 'b', '(Ljava/lang/String;I)I', 'getGroupId', 'Hashes the group name and returns its id, as Armies of Gielinor getGroupId.');
method('sj', 'd', '(I)Z', 'ensureIndex', 'Requests the archive index until it is loaded, as Armies of Gielinor ensureIndex.');
method('ma', 'h', '(B)V', 'enableHandlerGroup1', 'Sets hr.field_h[1], enabling the first built-in server packet handler that ma.i dispatches.');
method('ma', 'l', '(I)V', 'enableHandlerGroup2', 'Sets hr.field_h[2], enabling the second built-in server packet handler.');
method('ma', 'g', '(I)V', 'enableHandlerGroup4', 'Sets hr.field_h[4], enabling the fourth built-in server packet handler.');
method('ma', 'm', '(I)V', 'enableHandlerGroup5', 'Sets hr.field_h[5], enabling the fifth built-in server packet handler.');
method('ma', 'e', '(I)V', 'enableHandlerGroup', 'Sets the hr.field_h entry at the given index.');
method('ma', 'a', '(BLjava/lang/CharSequence;Z)Ljava/lang/String;', 'validateAccountName', 'Returns the iv.a error text for the name, or a character-set error, or null when the name is acceptable.');
method('ma', 'a', '(Ljava/lang/String;IIII)V', 'readAppletParameters', 'Reads the code base host and the gameport1, gameport2 and related applet parameters into the client fields.');
method('tu', 'a', '(III)I', 'fixedPointDistance', 'Shifts both deltas right by eight and returns the square root of the sum of their squares through pc.a.');
method('tu', 'a', '(ILpk;)V', 'startWithLoader', 'Stores the LoadingSequence in ma.field_t, enables the packet handler groups and registers the applet as an OverlayLayer.');
method('ae', 'k', '(I)Z', 'allFieldsValid', 'True when each of the six ValidatedTextWidget fields reports a valid state.');
method('ae', 'h', '(B)Z', 'submitRegistration', 'Checks allFieldsValid, parses the date fields and sends the registration request.');
method('ae', 'l', '(I)Ljava/lang/String;', 'closeLinkMarkup', 'Returns the closing colour and underline tags "</col></u>".');
method('ae', 'b', '(Z)Ljava/lang/String;', 'openLinkMarkup', 'Returns the opening link tags "<u=2164A2><col=2164A2>".');
method('ae', 'a', '(Lcw;I)Z', 'isFieldValid', 'Reads the field\'s ValidationSource and reports whether its state is the valid constant.');
method('mb', 'k', '(I)V', 'submit', 'Does nothing unless the name is valid, then sends the chosen display name.');
method('mb', 'l', '(I)Z', 'isNameValid', 'Delegates to the validation check of the display name field.');
method('mb', 'a', '(ILcw;)Z', 'isFieldValid', 'Reads the field\'s ValidationSource and compares its state with the valid constant.');
method('pd', 'l', '(I)V', 'submitLogin', 'Sends the username and password when both are filled in or the guest flag is set.');
method('pd', 'a', '(Ljava/lang/String;B)V', 'setUsername', 'Fills the username field with the text and focuses the password field.');
method('pd', 'a', '(I)Ljava/lang/String;', 'getUsername', 'Returns the text of the username field, or an empty string.');
method('pd', 'h', '(B)V', 'focusFields', 'Gives the focus to the username and password fields.');
method('fn', 'b', '(I)I', 'speedBonus', 'Returns de.field_b[type]; its entries are +2, +4 and +7 for the SPD trinket types 7..9 and their combinations.');
method('fn', 'b', '(B)I', 'powerBonus', 'Returns jh.field_Ib[type]; its entries are non-zero for the POW trinket types.');
method('fn', 'o', '(I)I', 'tackleBonus', 'Returns wb.field_r[type]; its entries are non-zero for the TCK trinket types.');
method('up', 'a', '(IZ)I', 'trinketSpeedBonus', 'Sums Trinket.speedBonus over the player\'s trinket ids.');
method('up', 'c', '(ZZ)I', 'trinketPowerBonus', 'Sums Trinket.powerBonus over the player\'s trinket ids.');
method('up', 'b', '(BZ)I', 'trinketTackleBonus', 'Sums Trinket.tackleBonus over the player\'s trinket ids.');
method('up', 'd', '(ZI)I', 'effectivePower', 'Adds base power to the trinket power bonus and scales by 8/10 for one trinket condition.');
method('up', 'a', '(ZI)I', 'effectiveTackle', 'Adds base tackle to the trinket tackle bonus.');
method('up', 'd', '(ZB)I', 'effectiveSpeed', 'Adds base speed to the trinket speed bonus.');
field('up', 'q', 'I', 'archetype', 'Indexes the type names in toString (Type:) and the surname table ce.field_G.');
field('up', 'e', 'I', 'initialIndex', 'Indexes td.field_a for the first-name initial printed by toString.');
field('up', 'l', 'I', 'surnameIndex', 'Indexes ce.field_G[archetype] for the surname printed by toString.');
field('up', 'n', 'I', 'power', 'Printed as POW: in toString.');
field('up', 'o', 'I', 'tackle', 'Printed as TCK: in toString.');
field('up', 'g', 'I', 'speed', 'Printed as SPD: in toString.');
field('up', 'r', 'I', 'experience', 'Printed as EXP: in toString.');
field('up', 'j', 'I', 'appearance', 'Printed as Appearance: in toString.');
field('up', 'h', '[I', 'trinketIds', 'Printed as the Trinkets list; indexes the pa.field_g trinket table.');
method('va', 'b', '(III)V', 'switchToNearestTeammate', 'Scans the team\'s outfield slots for the smallest squared distance to the point, doubling it for controlled slots, and queues a switch to that slot.');
method('va', 'a', '(ZII)V', 'playCrowdReaction', 'Picks a crowd sound id from the tier and whether the home or away side scored or missed, and plays it unless the match is over.');
method('va', 'h', '(I)I', 'getFocusedParticipant', 'Returns the local seat when it is active, otherwise the participant controlling the ball carrier.');
method('va', 'i', '(I)V', 'pollLocalInput', 'Turns the pointer position and button state into movement targets and kick events for the controlled footballer.');
method('va', 'g', '(II)V', 'queueKeypress', 'Creates a type 1 keypress PlayerInputEvent for the local seat and queues it.');
method('va', 'a', '(Lnu;ZI)V', 'wrapAgentsForRendering', 'Replaces the ball with a RenderedBall and every footballer with a RenderedFootballer built from its team colours and PlayerStats.');
method('va', 'a', '(Z)V', 'updateCamera', 'Targets the camera at the focused footballer, the ball midpoint or the pitch centre with a distance limit of 340.');
method('va', 'e', '(B)V', 'updateAimIndicator', 'Draws the kick or tackle aim indicator at the focused footballer from the pending aim and the action timer.');
method('va', 'a', '(Lki;I)V', 'switchToPredictedReceiver', 'Clones the game, steps it until the ball is free, extrapolates the landing point and queues a switch to the closest teammate.');
method('gm', 'b', '(IB)V', 'setFacingAngle', 'Stores the angle, adds 1700 modulo 2048 and rebuilds the model view with the matching sprite set.');
method('gm', 'a', '(IZII)V', 'setPosition', 'Stores the x, y and height fields and, when the flag is clear, also resets the smoothed render position.');
method('gm', 'a', '(IIIIB)V', 'renderModel', 'Sets the viewport centre, applies facing and animation, draws the mesh and shadow for the footballer.');
method('gm', 'h', '(B)V', 'drawPlayerLabel', 'Draws the participant name tag above the footballer when a game is attached.');
method('gm', 'g', '(I)I', 'getRenderedX', 'Returns the smoothed x field shifted right by 16.');
method('gm', 'b', '(BI)V', 'setAnimationClip', 'Switches the AnimationPlayer to the clip for the given index of the archetype\'s clip table.');
method('gm', 'a', '(Lvn;B)V', 'setModel', 'Stores the mesh and reapplies the facing angle.');
method('gm', 'g', '(B)V', 'resetPose', 'Calls the animation flag update with no flags set.');
method('gm', 'a', '(ZZI)V', 'updateAnimationFlags', 'Splits the bit flags of the argument into the walking, running, diving and tackling animation booleans.');
method('gm', 'f', '(B)I', 'computeFacingAngle', 'Derives the facing angle from the slide velocity during tackles and headers, otherwise from the direction fields.');
method('ob', 'k', '(I)I', 'getRenderedX', 'Returns the smoothed x field shifted right by 16.');
method('uv', 'c', '(III)Z', 'openFriendPrompt', 'With argument 17 creates the TextPromptDialog rb for entering a friend name and stores it in ck.field_b.');
method('uv', 'a', '(I)Ljava/lang/String;', 'getDisplayName', 'Returns field_a when set, otherwise the player name field_k.');
method('uv', 'a', '(ZZ)V', 'hideMenu', 'Hides the ContextMenu and optionally rebuilds the pending state.');
method('uv', 'b', '(I)V', 'showMenu', 'Adds the title item with the player name unless this is the local player, then opens the menu.');
method('uv', 'a', '(III)Z', 'handlePrimaryAction', 'Handles menu ids 8, 18, 11-14, 19 and 20 by calling static helpers with the player name and id.');
method('uv', 'a', '(IIB)Z', 'handleSocialAction', 'Handles menu ids 4, 5 and 6 by calling the friend-list add, remove and ignore helpers with the player name.');
method('uv', 'b', '(III)Z', 'handleSecondaryAction', 'Handles menu ids 0, 1, 2, 3, 10, 15 and 16 by calling static helpers with the stored id and the argument.');
method('uv', 'd', '(I)V', 'buildMenuItems', 'Adds menu items depending on whether the player is a friend, ignored, in a game or the local user.');
method('mf', 'j', '(B)Lkq;', 'getSelectedSlot', 'Returns the kq slot at the selected index, or null when none is selected.');
method('mf', 'a', '(BI)I', 'slotX', 'Column position 52 times the index modulo 3.');
method('mf', 'b', '(II)I', 'slotY', 'Row position 75 times the index divided by 3.');
method('mf', 'c', '(Z)V', 'sendSquadOrder', 'Writes packet 81 with the squad order and the club state to the outgoing buffer unless a dialog is open.');
method('mf', 'a', '(I)V', 'update', 'Counts down the hover timer and updates the hover, selection and drag state of the nine slots.');
method('mf', 'a', '(BLml;Z)V', 'readListingRows', 'Reads a count of bc rows from the packet and adds them to the ListingRowCache.');
method('ap', 'f', '(I)V', 'offerDraw', 'Throws unless online, then sends match control code 2 when the local seat has not resigned.');
method('ap', 'c', '(I)V', 'resign', 'Throws unless online, then sends match control code 1 when the local seat has not resigned.');
method('ap', 'a', '(II)V', 'sendMatchControl', 'Writes packet 75 with the control code (1 resign, 2 offer draw) when the match is online.');
method('ap', 'd', '(B)Z', 'isGameOverViewShown', 'True when the phase controller is the GameOverView.');
method('ap', 'e', '(B)Ltf;', 'getGameOverEntries', 'Returns the GameOverView entry list, or null in other phases.');
method('fu', 'a', '(IBI)Lki;', 'createCheatEvent', 'Returns new ki(7, ...), the Cheat event type printed by PlayerInputEvent.toString.');
method('mf', 'a', '(IIB)Lki;', 'createFormationEvent', 'Returns new ki(3, ...), the event type handled by applyFormationCommand.');
method('mg', 'a', '(IBI)Lki;', 'createTeamEvent', 'Returns new ki(4, ...), the Team event type printed by PlayerInputEvent.toString.');
method('mg', 'a', '(ZII)Lki;', 'createKeyheldEvent', 'Returns new ki(0, ...), the Keyheld event type printed by PlayerInputEvent.toString.');
method('ha', 'b', '(III)Lki;', 'createKeypressEvent', 'Returns new ki(1, ...), the Keypress event type printed by PlayerInputEvent.toString.');
method('hw', 'a', '(IIIBB)Lki;', 'createMouseEvent', 'Returns new ki(2, ...), the Mouse event type printed by PlayerInputEvent.toString, carrying the click coordinates.');
method('wd', 'a', '(I[Lup;Lgr;II)Lki;', 'createLineupEvent', 'Creates new ki(5, ...) and attaches the PlayerStats array, the LineUp event type.');
method('im', 'a', '(Ljava/applet/Applet;ILjava/lang/String;)V', 'openUrlInBrowser', 'Builds a URL against the code base and hands it to bv.a, which calls showDocument.');
method('bo', 'a', '(ILjava/lang/String;)Ljava/lang/String;', 'reverseString', 'Fills a char array backwards from the input and returns it as a new String.');
method('ji', 'b', '(I)Z', 'pollScrollBackward', 'Reports a press or held-repeat of the first arrow button using the shared 20/3 tick countdown.');
method('ji', 'h', '(I)Z', 'pollScrollForward', 'Reports a press or held-repeat of the second arrow button using the shared 20/3 tick countdown.');
method('ji', 'c', '(Z)Z', 'pollPageBackward', 'Reports a press or held-repeat on the track area before the thumb while the mouse is before it.');
method('ji', 'i', '(I)Z', 'pollPageForward', 'Reports a press or held-repeat on the track area after the thumb while the mouse is past it.');
method('ji', 'j', '(I)Z', 'isThumbHeld', 'Returns whether the thumb component is currently held by the pointer.');
method('ji', 'a', '(IIZI)I', 'getDraggedOffsetHorizontal', 'Converts thumb travel along the x axis into a clamped scroll offset.');
method('ji', 'a', '(IZBI)I', 'getDraggedOffsetVertical', 'Converts thumb travel along the y axis into a clamped scroll offset.');
method('ji', 'b', '(IIII)V', 'layoutThumb', 'Dispatches to the vertical or horizontal thumb layout depending on the orientation flag.');
method('ji', 'c', '(IIII)V', 'layoutHorizontal', 'Lays out arrow buttons, track halves and thumb along the x axis.');
method('ji', 'a', '(ZIII)V', 'layoutVertical', 'Lays out arrow buttons, track halves and thumb along the y axis.');
method('na', 'j', '(I)Z', 'pollScrollUp', 'Reports a press or held-repeat of the up button using the shared 20/3 tick countdown.');
method('na', 'h', '(B)Z', 'pollScrollDown', 'Reports a press or held-repeat of the down button using the shared 20/3 tick countdown.');
method('na', 'b', '(I)Z', 'pollPageUp', 'Reports a press or held-repeat on the track area above the thumb while the mouse is above it.');
method('na', 'm', '(I)Z', 'pollPageDown', 'Reports a press or held-repeat on the track area below the thumb while the mouse is below it.');
method('na', 'l', '(I)Z', 'isThumbHeld', 'Returns whether the thumb component is currently held by the pointer.');
method('na', 'a', '(IZII)I', 'getDraggedScrollOffset', 'Converts thumb travel into a rounded scroll offset clamped to content minus viewport.');
method('na', 'a', '(IIBI)V', 'layoutThumb', 'Sizes buttons, track halves and thumb proportionally to content and viewport extents.');
method('na', 'a', '(IZIIIIII)V', 'setLayout', 'Stores x, y, width and height then lays out the thumb.');
method('tk', 'a', '(IIIBIII)V', 'setLayout', 'Stores width, height, x and y then lays out the two scrollbars around the viewport.');
method('tk', 'a', '(III)V', 'layoutScrollbars', 'Shows the horizontal and vertical scrollbars only when needed and shrinks the viewport to leave room.');
method('tk', 'a', '(IZBI)V', 'advanceScroll', 'Runs the scroll input step with the viewport size as the page distance.');
method('tk', 'a', '(ZIIIII)V', 'applyScrollInput', 'Applies arrow, page, wheel and thumb input to the content offsets and clamps them to the viewport.');
method('np', 'a', '(IIIIIII)V', 'setLayout', 'Stores x, y, width and height then lays out the viewport and scrollbar.');
method('np', 'a', '(IBI)V', 'layoutViewport', 'Reserves the scrollbar width and a gap on the right and sizes the scrollbar to the content.');
method('np', 'a', '(ZIIIZ)V', 'advanceScroll', 'Applies arrow, page and wheel steps to the content offset, clamps it, then syncs the scrollbar thumb.');
method('np', 'a', '(IIZI)V', 'updateScroll', 'Runs advanceScroll with the viewport height as the page distance.');
method('bb', 'h', '(B)I', 'getTotalWidth', 'Returns this menu\'s width plus the width of any open submenu.');
method('bb', 'b', '(IIB)V', 'processClicks', 'Activates each item whose click flag is 1, forwards to the open submenu and advances the slide-in animation.');
method('bb', 'a', '(I)V', 'resetSelection', 'Clears every item\'s press and highlight state, closes the open submenu and restarts the slide animation.');
method('bb', 'b', '(II)V', 'setSlideProgress', 'Stores the animation step and interpolates each row\'s y position from stacked to final using its square.');
method('bb', 'a', '(IBII)V', 'selectItem', 'Closes the item if it is already open, opens its submenu, or runs the item\'s menu action.');
method('bb', 'a', '(IIB)Z', 'handleKeyShortcut', 'Routes the pressed key to the submenu or to the item whose shortcut character matches.');
method('bb', 'a', '(ZIIIII)V', 'setLayout', 'Computes the menu width, positions the rows and places the open submenu beside the selected row.');
method('gu', 'a', '(IIIII)V', 'layoutItems', 'Adds a placeholder item when empty, measures the widest row and positions each row.');
method('gu', 'a', '(I)Z', 'consumeSelection', 'Returns whether the given action id is the selected one and clears it when Enter was pressed.');
method('he', 'a', '(BLjava/lang/String;Ljava/lang/String;)V', 'setNames', 'Stores both name strings and refreshes the cached text from the name.');
method('he', 'a', '(B[I)I', 'sumInts', 'Adds up all elements of an int array.');
method('eo', 'a', '(Lot;)Lot;', 'mirrorHorizontally', 'Copies an ot image with each row\'s pixels in reverse x order.');
method('eo', 'b', '(Lot;)Lot;', 'mirrorVertically', 'Copies an ot image with the rows in reverse y order.');
method('eo', 'a', '(Ljava/lang/String;ILhu;IZ)Lhd;', 'createRenderedButton', 'Renders the lower-cased label into four state images and builds a button hd sized to the first image.');
method('vn', 'a', '([B)V', 'decodeExtendedFormat', 'Decodes the extended mesh format with the dup-temp opcode layout, matching Armies MeshData.decodeExtendedFormat.');
method('vn', 'b', '([B)V', 'decodeLegacyFormat', 'Decodes the legacy mesh format from several packet buffers, matching Armies MeshData.decodeLegacyFormat.');
method('vn', 'b', '()V', 'calculateNormals', 'Accumulates face normals from cross products of edge vectors per vertex.');
method('vn', 'a', '()V', 'buildSkinGroups', 'Groups vertex and face indices by their skin ids into per-group arrays.');
method('vn', 'a', '(Lsj;Ljava/lang/String;Ljava/lang/String;)Lvn;', 'load', 'Loads the named mesh file from an archive group into a new MeshData.');
method('vn', 'a', '(IIIII)Lqc;', 'createModel', 'Returns a new ModelMesh built from this mesh as a ModelMeshBase.');
method('vn', 'b', '(IIIII)Leg;', 'createModelMesh', 'Returns a new ModelMesh built from this mesh with the given lighting parameters.');
method('lv', 'a', '(I)I', 'getHeight', 'Implementations return the card height, used to centre the card vertically before drawing.');
method('lv', 'b', '(I)I', 'getWidth', 'Implementations return the card width, used to centre the card horizontally before drawing.');
method('lv', 'a', '(III)V', 'drawCentered', 'Draws the card centred on the given x and y coordinates.');
method('ja', 'c', '(II)V', 'stepSelection', 'Adds the delta to the selected index and wraps it around the item count, refreshing when it changed.');
method('bn', 'a', '(CB)Ljava/lang/String;', 'charToString', 'Returns String.valueOf of the character.');
method('qv', 'a', '(ILfd;II)V', 'drawText', 'Draws the widget text with the painter\'s own text and shadow colours via drawStyledText, matching Escape Vector drawText.');
method('qv', 'a', '(Lqv;B)V', 'copyStyleTo', 'Copies the font, colours, insets and alignment fields into the destination painter.');
method('qv', 'd', '(BLfd;)V', 'layoutSingleLine', 'Creates the cached text layout if missing and lays the widget text out on a single line.');
method('qv', 'a', '(ILfd;IIII)I', 'characterIndexAtPosition', 'Ensures the text layout then asks it for the character index nearest the pointer.');
method('qv', 'a', '(IIIZLfd;)V', 'drawCaret', 'Draws the caret at a character index when the widget has focus, matching Escape Vector drawCaret.');
method('qv', 'a', '(B)I', 'lineHeight', 'Returns the font\'s maximum ascent plus maximum descent.');
method('qv', 'a', '(IIIILfd;III)V', 'drawStyledText', 'Clips to the widget and draws its text with the given colour and shadow at the given offsets.');
method('qv', 'b', '(ILfd;II)I', 'textXForOffset', 'Returns the x position of a text offset including the widget x, left inset and origin.');
method('qv', 'a', '(Lfd;II)I', 'textOriginX', 'Returns the x position of the text start for the widget.');
method('qv', 'a', '(ZLfd;I)I', 'textOriginY', 'Returns the y position of the text start using textYForOffset with a zero offset.');
method('qv', 'a', '(BLfd;)I', 'contentWidth', 'Returns the widget width minus the left and right insets.');
method('qv', 'b', '(ILfd;)I', 'preferredHeight', 'Ensures the text layout then returns its height plus the top and bottom insets.');
method('qv', 'a', '(Lfd;I)I', 'preferredWidth', 'Ensures the text layout then returns its maximum line width plus the left and right insets.');
method('qv', 'a', '(IBLfd;I)I', 'textYForOffset', 'Returns the y position for a text offset including the widget y, top inset and origin.');
method('qv', 'b', '(BLfd;)Ljava/lang/String;', 'displayText', 'Returns the widget\'s text string.');
method('qv', 'c', '(BLfd;)I', 'contentHeight', 'Returns the widget height minus the top and bottom insets.');
method('qv', 'a', '(IIILfd;II)V', 'drawSelection', 'Draws the highlight between two character indices of the widget text.');
method('qv', 'a', '(ILfd;)Liq;', 'ensureTextLayout', 'Creates the widget\'s cached text layout on first use and (re)wraps it to the widget width.');
method('qv', 'a', '(IZILfd;I)V', 'drawWidget', 'Draws the widget\'s text, caret and selection with this painter\'s colours.');
method('am', 'f', '(B)J', 'getSecondaryKey', 'Matches tombracer DualLinkNode.getSecondaryKey by signature and body shape.');
method('aq', 'b', '(B)I', 'nextInt', 'Matches armiesofgielinor/escapevector/steelsentinels IsaacRandom.nextInt by signature and body shape.');
method('as', 'a', '(IF)I', 'computeCoefficients', 'Matches armiesofgielinor/geoblox SoundFilter.computeCoefficients by signature and body shape.');
method('bh', 'a', '(I)V', 'close', 'Matches armiesofgielinor/brickabrac/escapevector BufferedSocket.close by signature and body shape.');
method('bh', 'a', '(IBI[B)V', 'write', 'Matches armiesofgielinor/brickabrac/escapevector BufferedSocket.write by signature and body shape.');
method('bh', 'a', '([BIII)V', 'readFully', 'Matches armiesofgielinor/steelsentinels/zombiedawn BufferedSocket.readFully by signature and body shape.');
method('bj', 'a', '(Ljava/lang/String;BI)V', 'initializeCacheEnvironment', 'Matches geoblox CacheFileLocator.initializeCacheEnvironment by signature and body shape.');
method('bu', 'a', '(Ljava/net/URL;B)Lwu;', 'requestUrl', 'Matches torchallenge PlatformTaskDispatcher.requestUrl by signature and body shape.');
method('bu', 'b', '(I)Z', 'hasFullscreenSupport', 'Matches geoblox PlatformTaskDispatcher.hasFullscreenSupport by signature and body shape.');
method('dd', 'a', '(Lqc;ZZZ)Lqc;', 'applyCurrentFrame', 'Matches armiesofgielinor AnimationPlayer.applyCurrentFrame by signature and body shape.');
method('dv', 'a', '([BI[BII)V', 'copyBytes', 'Matches geoblox ArrayOperations.copyBytes by signature and body shape.');
method('dv', 'a', '([II[III)V', 'copyInts', 'Matches geoblox ArrayOperations.copyInts by signature and body shape.');
method('dv', 'a', '([Ljava/lang/Object;I[Ljava/lang/Object;II)V', 'copyReferences', 'Matches geoblox ArrayOperations.copyReferences by signature and body shape.');
method('ed', 'a', '()Lto;', 'toPcmSample', 'Matches escapevector/steelsentinels SoundEffect.toPcmSample by signature and body shape.');
method('fb', 'f', '(I)Ljava/lang/String;', 'getTooltip', 'Matches steelsentinels NumericDateInputWidget.getTooltip by signature and body shape.');
method('fd', 'b', '(ILjava/lang/StringBuilder;Ljava/util/Hashtable;I)V', 'appendWidgetDiagnosticProperties', 'Matches geoblox UiWidget.appendWidgetDiagnosticProperties by signature and body shape.');
method('fr', 'a', '(IIII)V', 'drawLayer', 'Matches escapevector/steelsentinels NameSuggestionsPanel.drawLayer by signature and body shape.');
method('gb', 'f', '(I)Ljava/lang/String;', 'getTooltip', 'Matches escapevector/steelsentinels ValidationIndicator.getTooltip by signature and body shape.');
method('gh', 'a', '(IIILjava/awt/Frame;II)V', 'enterFullscreen', 'Matches armiesofgielinor/escapevector/steelsentinels MicrosoftDisplayController.enterFullscreen by signature and body shape.');
method('ho', 'a', '(II)I', 'lookup1ValueCount', 'Matches escapevector/steelsentinels VorbisCodebook.lookup1ValueCount by signature and body shape.');
method('ht', 'a', '(JB)Lgn;', 'get', 'Matches escapevector/terraphoenix/tetralink IterableNodeHashTable.get by signature and body shape.');
method('ht', 'a', '(Lgn;IJ)V', 'put', 'Matches armiesofgielinor/steelsentinels/tetralink IterableNodeHashTable.put by signature and body shape.');
method('hu', 'a', '([Lqd;[I)V', 'setInlineImages', 'Matches geoblox BitmapFont.setInlineImages by signature and body shape.');
method('iw', 'a', '(B)I', 'readUnsignedShort', 'Matches brickabrac/escapevector/solknight PacketBuffer.readUnsignedShort by signature and body shape.');
method('iw', 'l', '(I)I', 'readVarInt', 'Matches arcanistsmulti/brickabrac/steelsentinels PacketBuffer.readVarInt by signature and body shape.');
method('jg', 'a', '(IILjava/util/Hashtable;Ljava/lang/StringBuilder;)Ljava/lang/StringBuilder;', 'appendDebugTree', 'Matches brickabrac/escapevector DraggableWidget.appendDebugTree by signature and body shape.');
method('jn', 'a', '(ILwi;IBI)V', 'onAction', 'Matches escapevector/steelsentinels RegistrationRequestDialog.onAction by signature and body shape.');
method('kc', 'a', '(Lgn;IJ)V', 'put', 'Matches escapevector/geoblox IntrusiveNodeHashTable.put by signature and body shape.');
method('kl', 'a', '(I[B)V', 'decode', 'Matches escapevector ArchiveIndex.decode by signature and body shape.');
method('ks', 'a', '(I[BI[BIZ)I', 'decompress', 'Matches armiesofgielinor/brickabrac HuffmanCodec.decompress by signature and body shape.');
method('lb', 'f', '(I)Ljava/lang/String;', 'getTooltip', 'Matches escapevector/steelsentinels TextHotspotWidget.getTooltip by signature and body shape.');
method('li', 'a', '(Z)J', 'asLong', 'Matches armiesofgielinor ConsoleValue.asLong by signature and body shape.');
method('ll', 'a', '([BI)V', 'setBytes', 'Matches armiesofgielinor/escapevector/steelsentinels DirectByteStorage.setBytes by signature and body shape.');
method('ln', 'a', '(IIILfd;II)V', 'handlePointerRelease', 'Matches geoblox DropTargetWidget.handlePointerRelease by signature and body shape.');
method('lo', 'b', '(Ljava/lang/String;B)Z', 'containsEmailPart', 'Matches steelsentinels PasswordValidator.containsEmailPart by signature and body shape.');
method('m', 'a', '(B)V', 'compressBlock', 'Matches armiesofgielinor/brickabrac/escapevector WhirlpoolHasher.compressBlock by signature and body shape.');
method('m', 'a', '(Z)V', 'reset', 'Matches brickabrac/escapevector WhirlpoolHasher.reset by signature and body shape.');
method('m', 'a', '([BII)V', 'finishDigest', 'Matches armiesofgielinor/brickabrac/steelsentinels WhirlpoolHasher.finishDigest by signature and body shape.');
method('m', 'a', '(BJ[B)V', 'updateBits', 'Matches armiesofgielinor/brickabrac/escapevector WhirlpoolHasher.updateBits by signature and body shape.');
method('mb', 'a', '(ILwi;IBI)V', 'onAction', 'Matches escapevector DisplayNameForm.onAction by signature and body shape.');
method('ml', 'a', '(B[I)V', 'installCipher', 'Matches arcanistsmulti CipherPacketBuffer.installCipher by signature and body shape.');
method('ml', 'l', '(II)I', 'readBits', 'Matches arcanistsmulti/armiesofgielinor/escapevector CipherPacketBuffer.readBits by signature and body shape.');
method('mu', 'k', '(I)Z', 'advanceDialogAnimation', 'Matches armiesofgielinor/geoblox ContentTransitionDialog.advanceDialogAnimation by signature and body shape.');
method('mu', 'm', '(I)V', 'finishTransition', 'Matches escapevector/geoblox ContentTransitionDialog.finishTransition by signature and body shape.');
method('o', 'b', '(B)Lam;', 'removeFirst', 'Matches brickabrac/tetralink/zombiedawn DualLinkDeque.removeFirst by signature and body shape.');
method('o', 'a', '(ILam;)V', 'addLast', 'Matches brickabrac/tetralink/zombiedawn DualLinkDeque.addLast by signature and body shape.');
method('oj', 'a', '(Ljava/lang/String;FIZ)V', 'setProgress', 'Matches escapevector/steelsentinels LoadingProgressDialog.setProgress by signature and body shape.');
method('on', 'b', '()V', 'clearFramebuffer', 'Matches aceofskies/escapevector SoftwareRasterizer.clearFramebuffer by signature and body shape.');
method('on', 'b', '(IIIII)V', 'drawLine', 'Matches escapevector/geoblox SoftwareRasterizer.drawLine by signature and body shape.');
method('on', 'c', '(IIII)V', 'drawCircle', 'Matches escapevector/geoblox SoftwareRasterizer.drawCircle by signature and body shape.');
method('ou', 'a', '(B)V', 'rebuildSprites', 'Matches escapevector/steelsentinels StripedProgressBar.rebuildSprites by signature and body shape.');
method('ou', 'a', '(IIII)V', 'drawLayer', 'Matches escapevector/steelsentinels StripedProgressBar.drawLayer by signature and body shape.');
method('ou', 'a', '(BII)V', 'setColors', 'Matches escapevector/steelsentinels StripedProgressBar.setColors by signature and body shape.');
method('ou', 'a', '(Lut;IBI)V', 'drawStripedBar', 'Matches escapevector StripedProgressBar.drawStripedBar by signature and body shape.');
method('pd', 'a', '(ILwi;IBI)V', 'onAction', 'Matches escapevector/steelsentinels LoginForm.onAction by signature and body shape.');
method('qh', 'a', '(BII[B)Z', 'write', 'Matches armiesofgielinor/steelsentinels SectorCacheStore.write by signature and body shape.');
method('qj', 'a', '(B)I', 'width', 'Matches escapevector/steelsentinels TextLayoutLine.width by signature and body shape.');
method('qm', 'a', '(Lsj;Ljava/lang/String;Ljava/lang/String;)Lqm;', 'load', 'Matches armiesofgielinor/brickabrac/steelsentinels MusicTrack.load by signature and body shape.');
method('qp', 'a', '(IIII)V', 'drawLayer', 'Matches escapevector/steelsentinels AccountMessagePanel.drawLayer by signature and body shape.');
method('ru', 'a', '(IIILda;[I)Z', 'updateNote', 'Matches armiesofgielinor MidiPcmStream.updateNote by signature and body shape.');
method('ru', 'd', '()I', 'getSchedulingCost', 'Matches armiesofgielinor/geoblox MidiPcmStream.getSchedulingCost by signature and body shape.');
method('st', 'a', '(IZLhu;Ljava/lang/String;)Lqj;', 'createSingleLine', 'Matches steelsentinels CachedTextLayout.createSingleLine by signature and body shape.');
method('tf', 'a', '(B)Z', 'isEmpty', 'Matches geoblox/stellarshard/terraphoenix IntrusiveDeque.isEmpty by signature and body shape.');
method('tf', 'a', '(Lgn;I)V', 'addLast', 'Matches arcanistsmulti/geoblox/stellarshard IntrusiveDeque.addLast by signature and body shape.');
method('tf', 'b', '(B)Lgn;', 'removeFirst', 'The first element after the sentinel is unlinked and returned, as in the head-removal pattern of DualLinkDeque.');
method('tf', 'h', '(I)Lgn;', 'removeLast', 'Matches arcanistsmulti/escapevector/zombiedawn IntrusiveDeque.removeLast by signature and body shape.');
method('tf', 'b', '(I)V', 'clear', 'Matches escapevector/stellarshard/tetralink IntrusiveDeque.clear by signature and body shape.');
method('tg', 'a', '(Lsj;)Z', 'ensureSetup', 'Matches armiesofgielinor/brickabrac/escapevector VorbisSample.ensureSetup by signature and body shape.');
method('tg', 'a', '(Lsj;Ljava/lang/String;Ljava/lang/String;)Ltg;', 'loadNamed', 'Matches escapevector/steelsentinels VorbisSample.loadNamed by signature and body shape.');
method('uo', 'a', '([I[BIIIIIIII)V', 'blitBinaryGlyph', 'Matches armiesofgielinor/steelsentinels BinaryBitmapFont.blitBinaryGlyph by signature and body shape.');
method('ut', 'a', '(I)V', 'addOutline', 'Matches escapevector/geoblox Sprite.addOutline by signature and body shape.');
method('ut', 'b', '([I[IIIIIIII)V', 'blitSilhouette', 'Matches escapevector/geoblox Sprite.blitSilhouette by signature and body shape.');
method('vi', 'a', '(IJ)I', 'advanceTicks', 'Matches escapevector/steelsentinels NanoTickClock.advanceTicks by signature and body shape.');
method('vm', 'g', '(I)V', 'setLoopCount', 'Matches escapevector/geoblox/steelsentinels PcmSampleStream.setLoopCount by signature and body shape.');
method('vm', 'n', '()Z', 'hasRemainingRampFrames', 'Matches geoblox/steelsentinels PcmSampleStream.hasRemainingRampFrames by signature and body shape.');
method('wi', 'b', '(I)Z', 'isFocused', 'Matches steelsentinels TextButton.isFocused by signature and body shape.');
method('wt', 'f', '(I)Ljava/lang/String;', 'getTooltip', 'Matches armiesofgielinor ArrayWidgetContainer.getTooltipText by signature and body shape.');
method('wv', 'a', '(ILwi;IBI)V', 'onAction', 'Matches escapevector/steelsentinels AccountRequestDialog.onAction by signature and body shape.');
method('wv', 'q', '(I)V', 'closeDialog', 'Matches escapevector/steelsentinels AccountRequestDialog.closeDialog by signature and body shape.');
method('ah', 'a', '(IIIBILjava/lang/String;I)V', 'startAppletShell', 'Matches armiesofgielinor GameAppletShell.startAppletShell by signature and body shape.');
method('ah', 'd', '(B)Z', 'isHostAllowed', 'Matches escapevector GameAppletShell.isHostAllowed by signature and body shape.');
method('aq', 'a', '(I)V', 'generateResults', 'Matches steelsentinels IsaacRandom.generateResults by signature and body shape.');
method('be', 'a', '(I)V', 'paint', 'Draws this overlay layer each frame from the OverlayLayer list.');
method('bu', 'a', '(IIZII)Lwu;', 'requestEnterFullscreen', 'Matches geoblox PlatformTaskDispatcher.requestEnterFullscreen by signature and body shape.');
method('ct', 'a', '(IIIII)V', 'setBounds', 'Matches escapevector SingleChildContainer.setBounds by signature and body shape.');
method('dd', 'c', '(I)Z', 'advanceFrame', 'Matches armiesofgielinor AnimationPlayer.advanceFrame by signature and body shape.');
method('dp', 'b', '()Llq;', 'nextSubstream', 'Matches escapevector ReverbPcmStream.nextSubstream by signature and body shape.');
method('dp', 'c', '()Llq;', 'firstSubstream', 'Matches escapevector ReverbPcmStream.firstSubstream by signature and body shape.');
method('eg', 'd', '(I)I', 'clampHslLightness', 'Matches armiesofgielinor ModelMesh.clampHslLightness by signature and body shape.');
method('fd', 'e', '(I)V', 'refreshLayout', 'Matches geoblox UiWidget.refreshLayout by signature and body shape.');
method('fd', 'a', '(IIIII)V', 'setBounds', 'Matches vertigo2 UiWidget.setBounds by signature and body shape.');
method('ga', 'k', '(B)V', 'copySelectedTextToClipboard', 'Matches geoblox TextInputWidget.copySelectedTextToClipboard by signature and body shape.');
method('ga', 'i', '(B)V', 'clearInputText', 'Matches geoblox TextInputWidget.clearInputText by signature and body shape.');
method('iw', 'a', '(I[IZI)V', 'xteaDecryptRange', 'Matches steelsentinels PacketBuffer.xteaDecryptRange by signature and body shape.');
method('kd', 'a', '(I)V', 'paint', 'Draws this overlay layer each frame from the OverlayLayer list.');
method('kg', 'a', '(III)V', 'drawAlpha', 'Matches steelsentinels IndexedSprite.drawAlpha by signature and body shape.');
method('ou', 'a', '(IIIII)V', 'setBounds', 'Matches escapevector StripedProgressBar.setBounds by signature and body shape.');
method('pp', 'c', '()Llq;', 'firstSubstream', 'Matches steelsentinels MusicPatchPcmStream.firstSubstream by signature and body shape.');
method('pp', 'b', '()Llq;', 'nextSubstream', 'Matches steelsentinels MusicPatchPcmStream.nextSubstream by signature and body shape.');
method('sj', 'a', '(II)[B', 'getSingleFile', 'Matches geoblox ResourceArchive.getSingleFile by signature and body shape.');
method('sj', 'b', '(II)Z', 'ensureFlatFileAvailable', 'Matches armiesofgielinor ResourceArchive.ensureFlatFileAvailable by signature and body shape.');
method('ut', 'b', '(IIIII)V', 'drawBilinearPixel', 'Matches escapevector Sprite.drawBilinearPixel by signature and body shape.');
method('vi', 'b', '(I)V', 'resetTiming', 'Matches escapevector NanoTickClock.resetTiming by signature and body shape.');
method('vm', 'i', '(I)V', 'setSamplePositionFixed', 'Matches geoblox PcmSampleStream.setSamplePositionFixed by signature and body shape.');
method('wj', 'a', '(IIIII)V', 'setBounds', 'Matches vertigo2 WidgetContainer.setBounds by signature and body shape.');
method('wt', 'a', '(IIIII)V', 'setBounds', 'Matches armiesofgielinor ArrayWidgetContainer.setBounds by signature and body shape.');
method('wc', 'a', '(IIBLjava/lang/String;)V', 'drawSingleLineTooltip', 'Measures the text with the theme font, clamps the box to the screen and draws a one-line tooltip.');
method('wc', 'a', '(IIIIIZ)V', 'drawWidgetLine', 'Draws a line between two points in the given colour through the rasterizer.');
method('wc', 'a', '(IBILjava/lang/String;)V', 'drawTooltip', 'Draws the tooltip wrapped or on a single line depending on the wrapping flag.');
method('wc', 'a', '(IIIIIIB)V', 'fillWidgetRectangleAlpha', 'Fills a rectangle with a colour at the given alpha through the rasterizer.');
method('wc', 'a', '(Lhu;I)V', 'initializeRenderers', 'Builds the default widget painters, colours and metrics for the supplied font.');
method('wc', 'a', '(ILjava/lang/String;II)V', 'drawWrappedTooltip', 'Wraps the text to a quarter of the screen width and draws a multi-line tooltip box.');
method('hc', 'a', '(IIC)Z', 'handleKeyTyped', 'Called with the key code and typed character for each overlay layer until one returns true.');
method('hc', 'a', '(IZ)V', 'update', 'Called once per frame for every overlay layer with a flag telling whether input is still available.');
method('hc', 'a', '(B)Z', 'capturesInput', 'Returns whether this layer is active and should stop lower layers from receiving input.');
method('hd', 'a', '(IIIZ)V', 'layoutVerticalContent', 'Stacks the child nodes using their pending heights and spacing and clamps the scroll offsets, matching Armies ClientUiComponent.');
method('hd', 'a', '(IZ)V', 'draw', 'Draws the whole tree from the screen origin through drawTree with the blink flag.');
method('hd', 'b', '(IZ)V', 'updateInput', 'Sets the capture flags from the argument and runs the input pass over the whole tree.');
method('hd', 'a', '(Lhd;B)V', 'applyStyle', 'Copies the sprites, font, colours and flags set on the style node into this node.');
method('hd', 'g', '(B)I', 'getPreferredWidth', 'Returns computeContentWidth with an unlimited maximum text width.');
method('hd', 'a', '(ZIIII)V', 'setBounds', 'Clears the pending offsets and stores the x, y, width and height of the node.');
method('hd', 'a', '(ZILhd;Lhd;)V', 'positionAfter', 'Places a child after the previous sibling plus the given spacing, or at the origin when there is none.');
method('hd', 'a', '(IIZIII)V', 'updateInputTree', 'Eases the pending offsets then walks the child nodes handling clipped pointer presses and releases.');
method('hd', 'a', '(ZIZIZIZIZZI)V', 'drawTree', 'Draws this node\'s background, sprites and text then its children, inheriting held and focus state.');
method('va', 'k', '(I)V', 'drawStartCountdown', 'Draws one of three sprites for 40 ticks each with a scale-and-fade, the 3-2-1 countdown at match start.');
method('va', 'j', '(I)V', 'refreshFootballerSprites', 'Rebuilds each team member\'s sprite from the team colours, archetype and appearance fields.');
method('va', 'c', '(III)V', 'queueMouseMove', 'Halves the offsets until they fit a byte then queues a mouse event for the controlled footballer and sends it online.');
method('va', 'n', '(I)V', 'pollMovementKeys', 'Reads the arrow and WASD key states, swaps them when the pitch is flipped and builds the direction bitmask.');
method('ga', 'a', '(CBLfd;I)Z', 'handleKeyInput', 'Inserts printable characters, skips < and >, and replaces the selection when the caret and anchor differ.');
method('ga', 'a', '(II)V', 'moveCaret', 'Sets the caret index and collapses the selection anchor unless shift is held.');
method('ga', 'a', '(Ljava/lang/String;BZ)V', 'setInputText', 'Replaces the text with the argument truncated to the maximum length and moves the caret to the end.');
method('ga', 'a', '(Ljava/lang/String;Z)V', 'insertTextAtCaret', 'Inserts the string at the caret within the maximum length and advances the caret.');
method('ga', 'a', '(Z)V', 'pasteFromClipboard', 'Reads the system clipboard string and inserts it at the caret.');
method('ga', 'h', '(B)I', 'nextWordBoundary', 'Returns the caret index after skipping to the next space-delimited word.');
method('ga', 'l', '(B)I', 'previousWordBoundary', 'Returns the index of the start of the previous space-delimited word.');
method('ga', 'i', '(I)V', 'deleteSelectedText', 'Removes the text between the caret and anchor and collapses both to the start.');
method('ga', 'j', '(B)V', 'scrollCaretIntoView', 'Adjusts the horizontal and vertical scroll offsets so the caret stays within the visible layout.');
method('ob', 'c', '(Z)I', 'getRenderedY', 'Returns the ball\'s y in pixels, offset by a perspective term that grows with the ball height.');
method('ob', 'j', '(I)I', 'getRenderedScale', 'Returns the ball draw size, 1200 or 4300 for action 7, divided by the height scale.');
method('ob', 'h', '(I)V', 'render', 'Projects the ball position and draws it directly or into the offscreen buffer at the current scale.');
method('ob', 'a', '(IIIII)V', 'drawBall', 'Updates the ball sprite rotation to the requested size and draws the rotated model at the given position.');
method('ob', 'a', '(BII)V', 'setRotationMatrix', 'Fills the 3x4 rotation matrix from the sine and cosine of the angle and the scale.');
method('ob', 'l', '(I)V', 'drawShadow', 'Builds a 32-level grey palette and draws the ball\'s shadow ellipse sized and shaded by its height.');
method('fd', 'a', '(BLfd;II)V', 'updatePointerState', 'Computes whether the pointer is inside the widget and updates the hover state, matching GeoBlox UiWidget.');
method('fd', 'a', '(CBLfd;I)Z', 'handleKeyInput', 'Virtual key hook that the base widget leaves unhandled, matching GeoBlox UiWidget.handleKeyInput.');
method('fd', 'a', '(Lfd;I)Z', 'requestKeyboardFocus', 'Virtual focus request that the base widget declines.');
method('fd', 'a', '(CBI)Z', 'dispatchKeyInput', 'Passes the typed character to this widget when focused, and moves focus when the key code is 80.');
method('fd', 'a', '(ILfd;IIIII)Z', 'handlePointerWheel', 'Virtual wheel hook that the base widget leaves unhandled.');
method('fd', 'a', '(IIB)V', 'renderWidgetPassesAndTooltip', 'Renders every pass up to the last render pass then shows the hover text through the tooltip theme.');
method('fd', 'f', '(B)I', 'getLastRenderPass', 'Returns the last render pass index, zero for the base widget.');
method('fd', 'g', '(I)V', 'clearKeyboardFocus', 'Virtual hook that the base widget leaves empty.');
method('fd', 'a', '(IIIZ)Z', 'processPointerFrame', 'Updates hover state and dispatches this frame\'s press, release and wheel events to the widget.');
method('fd', 'a', '(BIIII)Z', 'containsPointer', 'Tests whether a point lies inside the widget rectangle offset by the parent position.');
method('fd', 'a', '(ILjava/lang/StringBuilder;Ljava/util/Hashtable;I)Z', 'beginWidgetDiagnosticVisit', 'Records the widget in the visited table or appends a circular-reference marker to the output.');
method('mo', 'a', '(BLmo;)V', 'copyStateFrom', 'Abstract hook that each agent subclass implements by copying the other agent\'s fields into itself.');
method('tm', 'a', '(B[Lli;)Lli;', 'execute', 'Abstract command body that takes the parsed argument values and returns a result value.');
method('sv', 'a', '(BLga;)V', 'onTextChanged', 'Called by the text input widget after its text or caret changed.');
method('sv', 'a', '(ILga;)V', 'onEnterPressed', 'Called by the text input widget when the Enter key code 84 is pressed.');
method('ur', 'a', '(I)V', 'onRefreshSuggestions', 'Called when the user asks for a fresh set of name suggestions.');
method('ur', 'a', '(Ljava/lang/String;I)V', 'onSuggestionChosen', 'Called with the suggested name the user picked.');
method('qu', 'a', '(Llb;III)V', 'onHotspotClicked', 'Called with the clicked text hotspot, for example opening the conduct page.');
method('im', 'b', '(II)V', 'drawRow', 'Draws the list row at its current position.');
method('im', 'c', '(IZ)V', 'updateRow', 'Handles the row\'s button presses for this frame.');
method('jb', 'a', '(BII)V', 'drawBody', 'Draws the dialog content at the given offset: frame, title, text and optional icon.');
method('jb', 'b', '(I)I', 'dialogWidth', 'Returns the dialog content width.');
method('jb', 'a', '(B)I', 'dialogHeight', 'Returns the dialog content height.');
method('jb', 'a', '(Z)I', 'getOpenSoundId', 'Returns the sound id that plays when the dialog opens, 46 for most dialog types.');
method('jb', 'a', '(II)V', 'handleResult', 'Called with the index of the dialog button that was pressed.');
method('jb', 'a', '(IZ)V', 'onUpdate', 'Per-frame hook that dialog subclasses may override; the base does nothing.');
method('mc', 'b', '(B)J', 'delayMillis', 'Returns how many milliseconds remain before the next tick is due, or zero when it is overdue.');
method('vi', 'a', '(Z)J', 'averageFrameNanos', 'Records the nanoTime delta since the last call in a ring buffer and returns the frame time used for pacing.');
method('bi', 'e', '(I)I', 'countPriorityRequests', 'Returns the number of pending plus sent priority archive requests.');
method('bi', 'b', '(I)I', 'countBackgroundRequests', 'Returns the number of pending plus sent background archive requests.');
method('bi', 'a', '(I)Z', 'isPriorityQueueFull', 'True when twenty or more priority requests are outstanding.');
method('bi', 'd', '(I)Z', 'isBackgroundQueueFull', 'True when twenty or more background requests are outstanding.');
method('bi', 'a', '(IIBBZ)Lui;', 'queueRequest', 'Creates a request keyed by archive and group id and queues it as priority or background, throwing past twenty.');
method('bi', 'a', '(B)Z', 'pollResponses', 'Abstract poll that reads available archive responses from the connection.');
method('bi', 'b', '(B)V', 'closeSocket', 'Abstract close of the underlying connection.');
method('bi', 'a', '(Ljava/lang/Object;IZ)V', 'attachSocket', 'Abstract attach of a freshly opened socket object to the client.');
method('bi', 'c', '(I)V', 'resetAfterValidationFailure', 'Abstract reset after the server rejected the handshake validation.');
method('tb', 'a', '(ZZ)V', 'sendControlPacket', 'Writes a control packet whose second byte is 2 or 3 to the socket.');
method('tb', 'g', '(I)V', 'sendSetupPacket', 'Writes the setup packet to the socket right after connecting.');
method('a', 'e', '()V', 'writeMixBlock', 'Body is identical to steelsentinels JavaSoundAudioOutput.writeMixBlock.');
method('a', 'f', '()V', 'closeDevice', 'Body is identical to escapevector/geoblox JavaSoundAudioOutput.closeDevice.');
method('ah', '$cfr$lcmp', '(JJ)I', 'compareLongs', 'Body is identical to escapevector GameAppletShell.compareLongs.');
method('am', 'a', '(B)Z', 'isSecondaryLinked', 'Body is identical to tombracer DualLinkNode.isSecondaryLinked.');
method('am', 'f', '(I)V', 'unlinkSecondary', 'Body is identical to tetralink/zombiedawn DualLinkNode.unlinkSecondary.');
method('as', 'b', '(IIF)F', 'interpolateRadius', 'Body is identical to armiesofgielinor/geoblox SoundFilter.interpolateRadius.');
method('au', 'a', '(ILos;)I', 'readBits', 'Body is identical to steelsentinels Bzip2Decoder.readBits.');
method('au', 'a', '(Los;)V', 'buildSymbolMap', 'Body is identical to steelsentinels Bzip2Decoder.buildSymbolMap.');
method('au', 'a', '([BI[BII)I', 'decompressInto', 'Body is identical to steelsentinels Bzip2Decoder.decompressInto.');
method('au', 'a', '([I[I[I[BIII)V', 'buildHuffmanTables', 'Body is identical to steelsentinels Bzip2Decoder.buildHuffmanTables.');
method('au', 'c', '(Los;)V', 'emitBlock', 'Body is identical to steelsentinels Bzip2Decoder.emitBlock.');
method('au', 'd', '(Los;)V', 'decodeBlocks', 'Body is identical to steelsentinels Bzip2Decoder.decodeBlocks.');
method('av', 'c', '(I)Ljava/net/Socket;', 'connectDirect', 'Body is identical to aceofskies SocketConnector.connectDirect.');
method('bh', 'b', '(B)V', 'checkWriteError', 'Body is identical to tetralink BufferedSocket.checkWriteError.');
method('bu', 'a', '(I)Lwu;', 'requestDisplayModes', 'Body is identical to vertigo2 PlatformTaskDispatcher.requestDisplayModes.');
method('bu', 'a', '(I[Ljava/lang/Class;Ljava/lang/Class;Ljava/lang/String;)Lwu;', 'requestDeclaredMethod', 'Body is identical to vertigo2 PlatformTaskDispatcher.requestDeclaredMethod.');
method('bu', 'a', '(Ljava/lang/String;Ljava/lang/Class;I)Lwu;', 'requestDeclaredField', 'Body is identical to vertigo2 PlatformTaskDispatcher.requestDeclaredField.');
method('cn', 'a', '(IIIIIIZ)V', 'drawGlyph', 'Body is identical to steelsentinels CoverageBitmapFont.drawGlyph.');
method('cn', 'a', '([I[[B)[[B', 'convertPaletteGlyphsToCoverageInPlace', 'Body is identical to steelsentinels CoverageBitmapFont.convertPaletteGlyphsToCoverageInPlace.');
method('cn', 'b', '(IIIIIIIZ)V', 'drawGlyphAlpha', 'Body is identical to steelsentinels CoverageBitmapFont.drawGlyphAlpha.');
method('dp', 'c', '(F)V', 'setDampingTimeMicros', 'Body is identical to escapevector ReverbPcmStream.setDampingTimeMicros.');
method('dv', 'a', '([III)V', 'clearInts', 'Body is identical to geoblox ArrayOperations.clearInts.');
method('ed', 'b', '()[B', 'mix', 'Body is identical to steelsentinels SoundEffect.mix.');
method('eg', 'a', '()V', 'finishAnimation', 'Body is identical to armiesofgielinor ModelMesh.finishAnimation.');
method('eg', 'a', '(II)I', 'scaleHslLightness', 'Body is identical to armiesofgielinor ModelMesh.scaleHslLightness.');
method('eg', 'b', '()Z', 'beginAnimation', 'Body is identical to armiesofgielinor ModelMesh.beginAnimation.');
method('eg', 'c', '()V', 'refreshFaceLighting', 'Body is identical to armiesofgielinor ModelMesh.refreshFaceLighting.');
method('eg', 'd', '()V', 'releaseStatics', 'Body is identical to armiesofgielinor ModelMesh.releaseStatics.');
method('eg', 'e', '()V', 'calculateBounds', 'Body is identical to armiesofgielinor ModelMesh.calculateBounds.');
method('fq', 'a', '()V', 'reset', 'Body is identical to armiesofgielinor/brickabrac SoundEnvelope.reset.');
method('fq', 'a', '(I)I', 'advance', 'Body is identical to steelsentinels SoundEnvelope.advance.');
method('fq', 'a', '(Liw;)V', 'decode', 'Body is identical to steelsentinels SoundEnvelope.decode.');
method('gh', 'a', '(ILjava/awt/Frame;)V', 'exitFullscreen', 'Body is identical to armiesofgielinor MicrosoftDisplayController.exitFullscreen.');
method('gn', 'e', '(B)Z', 'isLinked', 'Body is identical to tetralink/trackcontroller IntrusiveNode.isLinked.');
method('gq', 'a', '(Lgn;Lme;)V', 'insertListenerByFrameOffset', 'Body is identical to geoblox PcmStreamMixer.insertListenerByFrameOffset.');
method('gq', 'a', '(Llq;)V', 'addSubStream', 'Body is identical to armiesofgielinor PcmStreamMixer.addSubStream.');
method('gq', 'b', '(I)V', 'skipChildStreams', 'Body is identical to geoblox PcmStreamMixer.skipChildStreams.');
method('gq', 'b', '(Llq;)V', 'removeSubstream', 'Body is identical to escapevector PcmStreamMixer.removeSubstream.');
method('gq', 'c', '([III)V', 'mixChildStreams', 'Body is identical to geoblox PcmStreamMixer.mixChildStreams.');
method('hb', 'a', '([FIZ)V', 'decodeResidue', 'Body is identical to steelsentinels VorbisResidue.decodeResidue.');
method('ho', 'a', '()V', 'buildHuffmanTree', 'Body is identical to steelsentinels VorbisCodebook.buildHuffmanTree.');
method('ho', 'b', '()I', 'decodeScalar', 'Body is identical to escapevector/steelsentinels VorbisCodebook.decodeScalar.');
method('hu', 'a', '(C)I', 'charWidth', 'Body is identical to trackcontroller BitmapFont.charWidth.');
method('hu', 'a', '(Ljava/lang/String;I)I', 'maxLineWidth', 'Body is identical to wizardrun BitmapFont.maxLineWidth.');
method('hu', 'a', '([B)V', 'decodeFontMetrics', 'Body is identical to steelsentinels BitmapFont.decodeFontMetrics.');
method('hu', 'c', '(Ljava/lang/String;)Ljava/lang/String;', 'escapeMarkup', 'Body is identical to steelsentinels BitmapFont.escapeMarkup.');
method('hu', 'c', '(Ljava/lang/String;II)I', 'paragraphHeight', 'Body is identical to steelsentinels BitmapFont.paragraphHeight.');
method('iw', 'b', '(II)V', 'writeInt', 'Body is identical to stellarshard/vertigo2 PacketBuffer.writeInt.');
method('kg', 'a', '()Lut;', 'toRgbSprite', 'Body is identical to armiesofgielinor/brickabrac IndexedSprite.toRgbSprite.');
method('kg', 'a', '(IIII)V', 'drawScaled', 'Body is identical to steelsentinels IndexedSprite.drawScaled.');
method('kg', 'a', '([I[B[IIIIIIII)V', 'copyNonzeroPaletteRows', 'Body is identical to brickabrac IndexedSprite.copyNonzeroPaletteRows.');
method('kg', 'b', '([I[B[IIIIIIII)V', 'blendPaletteRowsWithAlpha', 'Body is identical to brickabrac IndexedSprite.blendPaletteRowsWithAlpha.');
method('km', 'a', '(II)V', 'sortPoints', 'Body is identical to steelsentinels VorbisFloor.sortPoints.');
method('km', 'a', '(IIIII)I', 'interpolatePoint', 'Body is identical to armiesofgielinor/escapevector VorbisFloor.interpolatePoint.');
method('km', 'a', '(IIII[FI)V', 'applyLine', 'Body is identical to steelsentinels VorbisFloor.applyLine.');
method('km', 'a', '([FI)V', 'applyFloor', 'Body is identical to steelsentinels VorbisFloor.applyFloor.');
method('km', 'a', '([II)I', 'highNeighbour', 'Body is identical to steelsentinels VorbisFloor.highNeighbour.');
method('km', 'b', '([II)I', 'lowNeighbour', 'Body is identical to steelsentinels VorbisFloor.lowNeighbour.');
method('kv', 'a', '()V', 'releaseSynthesisBuffers', 'Body is identical to geoblox SynthesizedSoundInstrument.releaseSynthesisBuffers.');
method('ma', 'a', '(ZI)V', 'enableBaseResponses', 'Body is identical to escapevector NetworkGameClient.enableBaseResponses.');
method('mm', 'a', '(Ljava/lang/String;Ljava/applet/Applet;B)V', 'evaluateScript', 'Body is identical to geoblox AppletJavaScriptBridge.evaluateScript.');
method('og', 'b', '(I)V', 'bindAsTarget', 'Body is identical to torchallenge RasterBuffer.bindAsTarget.');
method('on', 'a', '(III)V', 'setPixel', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.setPixel.');
method('on', 'a', '(IIII)V', 'drawVerticalLine', 'Body is identical to wizardrun SoftwareRasterizer.drawVerticalLine.');
method('on', 'a', '(IIIII)V', 'fillRect', 'Body is identical to wizardrun SoftwareRasterizer.fillRect.');
method('on', 'a', '(I[IIIII)V', 'darkenRows', 'Body is identical to escapevector SoftwareRasterizer.darkenRows.');
method('on', 'a', '([I)V', 'saveClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.saveClip.');
method('on', 'b', '(IIII)V', 'desaturateRect', 'Body is identical to wizardrun SoftwareRasterizer.desaturateRect.');
method('on', 'b', '([I)V', 'restoreClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.restoreClip.');
method('on', 'e', '(IIII)V', 'setClip', 'Body is identical to wizardrun SoftwareRasterizer.setClip.');
method('on', 'f', '(IIII)V', 'drawHorizontalLine', 'Body is identical to wizardrun SoftwareRasterizer.drawHorizontalLine.');
method('on', 'g', '(IIII)V', 'darkenRectangle', 'Body is identical to escapevector SoftwareRasterizer.darkenRectangle.');
method('on', 'h', '(IIII)V', 'intersectClip', 'Body is identical to aceofskies/escapevector SoftwareRasterizer.intersectClip.');
method('ot', 'f', '(II)V', 'drawHalfSize', 'Body is identical to brickabrac/steelsentinels ArgbSprite.drawHalfSize.');
method('ot', 'g', '(II)V', 'drawQuarterSize', 'Body is identical to brickabrac/steelsentinels ArgbSprite.drawQuarterSize.');
method('pm', 'a', '(IIILjava/awt/Graphics;)V', 'drawImage', 'Body is identical to steelsentinels BufferedImageRasterBuffer.drawImage.');
method('rs', 'a', '()Z', 'isDone', 'Body is identical to brickabrac/steelsentinels MidiFileReader.isDone.');
method('rs', 'a', '(II)I', 'decodeMessagePayload', 'Body is identical to steelsentinels MidiFileReader.decodeMessagePayload.');
method('rs', 'a', '(J)V', 'reset', 'Body is identical to brickabrac/steelsentinels MidiFileReader.reset.');
method('rs', 'b', '(I)V', 'saveTrackPosition', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.saveTrackPosition.');
method('rs', 'c', '(I)V', 'seekTrack', 'Body is identical to armiesofgielinor/brickabrac MidiFileReader.seekTrack.');
method('rs', 'd', '(I)V', 'readDelta', 'Body is identical to steelsentinels MidiFileReader.readDelta.');
method('rs', 'f', '(I)I', 'readMessage', 'Body is identical to brickabrac/steelsentinels MidiFileReader.readMessage.');
method('rs', 'g', '()I', 'nextTrack', 'Body is identical to brickabrac/steelsentinels MidiFileReader.nextTrack.');
method('t', 'a', '()V', 'releaseStatics', 'Body is identical to armiesofgielinor TriangleRasterizer.releaseStatics.');
method('t', 'a', '(IIII)V', 'setClip', 'Body is identical to armiesofgielinor TriangleRasterizer.setClip.');
method('t', 'b', '()V', 'centerProjection', 'Body is identical to armiesofgielinor TriangleRasterizer.centerProjection.');
method('t', 'b', '(II)V', 'setProjectionCenter', 'Body is identical to armiesofgielinor TriangleRasterizer.setProjectionCenter.');
method('t', 'c', '()V', 'useRasterClip', 'Body is identical to armiesofgielinor TriangleRasterizer.useRasterClip.');
method('tf', 'd', '(I)Lgn;', 'last', 'Body is identical to trackcontroller IntrusiveDeque.last.');
method('tg', 'a', '([I)Lto;', 'decodeToPcm', 'Body is identical to steelsentinels VorbisSample.decodeToPcm.');
method('tg', 'b', '()I', 'readBit', 'Body is identical to escapevector/steelsentinels VorbisSample.readBit.');
method('tg', 'c', '()Lto;', 'decodeAllToPcm', 'Body is identical to steelsentinels VorbisSample.decodeAllToPcm.');
method('tg', 'e', '(I)I', 'readBits', 'Body is identical to steelsentinels VorbisSample.readBits.');
method('ub', 'a', '(Z)Lfd;', 'findFocusedChild', 'Body is identical to escapevector ModalPanel.findFocusedChild.');
method('uo', 'a', '(IIIIIIZ)V', 'drawGlyph', 'Body is identical to steelsentinels BinaryBitmapFont.drawGlyph.');
method('uo', 'a', '([I[BIIIIIII)V', 'blitBinaryGlyph', 'Body is identical to steelsentinels BinaryBitmapFont.blitBinaryGlyph.');
method('uo', 'a', '([I[BIIIIIIIII[I[I)V', 'blitMaskedGlyph', 'Body is identical to steelsentinels BinaryBitmapFont.blitMaskedGlyph.');
method('uo', 'b', '(IIIIIIIZ)V', 'drawGlyphAlpha', 'Body is identical to steelsentinels BinaryBitmapFont.drawGlyphAlpha.');
method('uo', 'b', '([I[BIIIIIIII)V', 'blitBinaryGlyphWithAlpha', 'Body is identical to steelsentinels BinaryBitmapFont.blitBinaryGlyphWithAlpha.');
method('ut', 'b', '()Lut;', 'copy', 'Body is identical to wizardrun Sprite.copy.');
method('ut', 'f', '()Lut;', 'copyFlippedHorizontally', 'Creates a separate sprite with each pixel row reversed and a mirrored X offset; the original remains unchanged.');
method('ut', 'f', '(II)V', 'drawHalfSize', 'Body is identical to escapevector/geoblox Sprite.drawHalfSize.');
method('vm', 'a', '(III)V', 'rampVolumeAndPan', 'Body is identical to steelsentinels PcmSampleStream.rampVolumeAndPan.');
method('vm', 'a', '(II[B[IIIIIIIIIILvm;II)I', 'mixReverseStereoInterpolatedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixReverseStereoInterpolatedRamp.');
method('vm', 'a', '(II[B[IIIIIIIILvm;II)I', 'mixReverseStereoInterpolated', 'Body is identical to steelsentinels PcmSampleStream.mixReverseStereoInterpolated.');
method('vm', 'a', '(II[B[IIIIIIILvm;II)I', 'mixReverseMonoInterpolated', 'Body is identical to steelsentinels PcmSampleStream.mixReverseMonoInterpolated.');
method('vm', 'a', '(I[B[IIIIIIIIIILvm;)I', 'mixForwardStereoAlignedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixForwardStereoAlignedRamp.');
method('vm', 'a', '(I[B[IIIIIIIILvm;)I', 'mixReverseStereoAligned', 'Body is identical to steelsentinels PcmSampleStream.mixReverseStereoAligned.');
method('vm', 'a', '(Lto;III)Lvm;', 'createAtRatePercentQ6', 'Body is identical to steelsentinels PcmSampleStream.createAtRatePercentQ6.');
method('vm', 'a', '(Z)V', 'setReversePlayback', 'Body is identical to geoblox/steelsentinels PcmSampleStream.setReversePlayback.');
method('vm', 'a', '([B[IIIIIIIILvm;)I', 'mixForwardMonoAlignedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixForwardMonoAlignedRamp.');
method('vm', 'a', '([B[IIIIIIILvm;)I', 'mixReverseMonoAligned', 'Body is identical to steelsentinels PcmSampleStream.mixReverseMonoAligned.');
method('vm', 'b', '(II)V', 'setVolumeAndPan', 'Body is identical to geoblox/steelsentinels PcmSampleStream.setVolumeAndPan.');
method('vm', 'b', '(II[B[IIIIIIIIIILvm;II)I', 'mixForwardStereoInterpolatedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixForwardStereoInterpolatedRamp.');
method('vm', 'b', '(II[B[IIIIIIIILvm;II)I', 'mixForwardStereoInterpolated', 'Body is identical to steelsentinels PcmSampleStream.mixForwardStereoInterpolated.');
method('vm', 'b', '(II[B[IIIIIIILvm;II)I', 'mixForwardMonoInterpolated', 'Body is identical to steelsentinels PcmSampleStream.mixForwardMonoInterpolated.');
method('vm', 'b', '(I[B[IIIIIIIIIILvm;)I', 'mixReverseStereoAlignedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixReverseStereoAlignedRamp.');
method('vm', 'b', '(I[B[IIIIIIIILvm;)I', 'mixForwardStereoAligned', 'Body is identical to steelsentinels PcmSampleStream.mixForwardStereoAligned.');
method('vm', 'b', '([B[IIIIIIIILvm;)I', 'mixReverseMonoAlignedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixReverseMonoAlignedRamp.');
method('vm', 'b', '([B[IIIIIIILvm;)I', 'mixForwardMonoAligned', 'Body is identical to steelsentinels PcmSampleStream.mixForwardMonoAligned.');
method('vm', 'c', '(II[B[IIIIIIIILvm;II)I', 'mixReverseMonoInterpolatedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixReverseMonoInterpolatedRamp.');
method('vm', 'd', '(II[B[IIIIIIIILvm;II)I', 'mixForwardMonoInterpolatedRamp', 'Body is identical to steelsentinels PcmSampleStream.mixForwardMonoInterpolatedRamp.');
method('vm', 'e', '()I', 'getSampleStepMagnitude', 'Body is identical to geoblox/steelsentinels PcmSampleStream.getSampleStepMagnitude.');
method('vm', 'f', '()Z', 'isSamplePositionOutOfRange', 'Body is identical to geoblox/steelsentinels PcmSampleStream.isSamplePositionOutOfRange.');
method('vm', 'f', '(I)V', 'setVolume', 'Body is identical to escapevector PcmSampleStream.setVolume.');
method('vm', 'h', '(I)V', 'setSampleStepMagnitude', 'Body is identical to geoblox/steelsentinels PcmSampleStream.setSampleStepMagnitude.');
method('vm', 'i', '()V', 'playBackwardFromEnd', 'Body is identical to escapevector PcmSampleStream.playBackwardFromEnd.');
method('vm', 'm', '()I', 'getTargetVolume', 'Body is identical to geoblox/steelsentinels PcmSampleStream.getTargetVolume.');
method('tg', 'b', '(I)[F', 'decodePacket', 'Body closely matches steelsentinels VorbisSample.decodePacket.');
method('tg', 'b', '([B)V', 'decodeSetup', 'Body closely matches steelsentinels VorbisSample.decodeSetup.');
method('vm', 'j', '()Z', 'adjustRampOrStop', 'Body closely matches steelsentinels PcmSampleStream.adjustRampOrStop.');
method('vm', 'e', '(I)V', 'fadeOutAndUnlink', 'Body closely matches steelsentinels PcmSampleStream.fadeOutAndUnlink.');
method('km', 'b', '()Z', 'decodeFloor', 'Body closely matches steelsentinels VorbisFloor.decodeFloor.');
method('hu', 'a', '(Ljava/lang/String;[I[Ljava/lang/String;)I', 'wrapText', 'Body closely matches steelsentinels BitmapFont.wrapText.');
method('gq', 'a', '([III)V', 'mixInto', 'Body closely matches steelsentinels PcmStreamMixer.mixInto.');
method('gq', 'a', '(I)V', 'skipFrames', 'Body closely matches steelsentinels PcmStreamMixer.skipFrames.');
method('a', 'a', '(Ljava/awt/Component;)V', 'initializeDevice', 'Body closely matches steelsentinels JavaSoundAudioOutput.initializeDevice.');
method('rs', 'a', '([B)V', 'parse', 'Body closely matches steelsentinels MidiFileReader.parse.');
method('tg', 'a', '([B)V', 'decodePacketContainer', 'Body closely matches steelsentinels VorbisSample.decodePacketContainer.');
method('a', 'b', '(I)V', 'openDevice', 'Body closely matches escapevector/steelsentinels JavaSoundAudioOutput.openDevice.');
method('ot', 'c', '(III)V', 'drawAdditive', 'Body closely matches brickabrac/steelsentinels ArgbSprite.drawAdditive.');
method('aq', 'a', '(B)V', 'initializeState', 'Body closely matches steelsentinels IsaacRandom.initializeState.');
method('dp', 'e', '()V', 'synchronizeChannelMode', 'Body closely matches escapevector ReverbPcmStream.synchronizeChannelMode.');
method('jn', 's', '(I)V', 'releaseStatics', 'Body closely matches escapevector RegistrationRequestDialog.releaseStatics.');
method('ga', 'k', '(I)Ljava/lang/String;', 'getSelectedText', 'Body closely matches geoblox TextInputWidget.getSelectedText.');
method('dq', 'a', '(ZLjava/net/Proxy;)Ljava/net/Socket;', 'connectViaProxy', 'Body closely matches steelsentinels ProxySocketConnector.connectViaProxy.');
method('fq', 'b', '(Liw;)V', 'decodeSegments', 'Body closely matches steelsentinels SoundEnvelope.decodeSegments.');
method('dh', 'b', '(B)V', 'pushPixels', 'Body closely matches steelsentinels ImageProducerRasterBuffer.pushPixels.');
method('gh', 'a', '(I)[I', 'enumerateDisplayModes', 'Body closely matches armiesofgielinor MicrosoftDisplayController.enumerateDisplayModes.');
method('ma', 'h', '(I)V', 'initializeAccountPacketLengths', 'Body closely matches escapevector NetworkGameClient.initializeAccountPacketLengths.');
method('ah', 'a', '(ZB)V', 'shutdownShell', 'Body closely matches armiesofgielinor GameAppletShell.shutdownShell.');
method('dh', 'a', '(IIILjava/awt/Component;)V', 'initialize', 'Body closely matches steelsentinels ImageProducerRasterBuffer.initialize.');
method('wg', 'a', '(Ljava/awt/Component;ZI)V', 'setCursorVisible', 'Body closely matches armiesofgielinor MicrosoftCursorController.setCursorVisible.');
method('uo', 'a', '([I[BIIIIIIIII)V', 'blitBinaryGlyphWithAlpha', 'Body closely matches steelsentinels BinaryBitmapFont.blitBinaryGlyphWithAlpha.');
method('tg', 'a', '(Lsj;II)Ltg;', 'loadNamed', 'Body closely matches steelsentinels VorbisSample.loadNamed.');
method('wi', 'a', '(ZIILfd;III)Z', 'handlePointerPress', 'Body closely matches steelsentinels TextButton.handlePointerPress.');
method('bu', 'a', '(IIILjava/lang/Object;I)Lwu;', 'enqueueTask', 'Body closely matches tetralink/vertigo2 PlatformTaskDispatcher.enqueueTask.');
method('l', 'a', '(B)Z', 'isInputEmpty', 'Implemented by jd as "widget text is null or has length 0".');
method('l', 'a', '(I)V', 'validationChanged', 'lg implements it by storing the current time so the 350 ms debounce restarts.');
method('l', 'b', '(I)Ljava/lang/String;', 'getValidationMessage', 'lg returns null while empty or inside the 350 ms debounce, otherwise the abstract message.');
method('l', 'c', '(I)Lrv;', 'getValidationState', 'lg returns the empty/pending state while empty or debouncing, otherwise the abstract state.');
method('lg', 'a', '(Z)Lrv;', 'evaluateValidationState', 'Abstract state evaluation that c(int) calls once the 350 ms debounce has passed; jd implements it by validating the widget text.');
method('lg', 'e', '(I)Ljava/lang/String;', 'evaluateValidationMessage', 'Abstract message evaluation called by b(int) after the debounce; jd implements it with the describe method on the widget text.');
method('jd', 'a', '(Ljava/lang/String;I)Lrv;', 'validateText', 'Abstract validation of a text; each subclass (name, age, email, password) returns valid or invalid state.');
method('jd', 'a', '(BLjava/lang/String;)Ljava/lang/String;', 'describeText', 'Abstract message for a text; subclasses return a message or null depending on the validation state.');
method('ps', 'a', '(Liw;I)V', 'writeCredentials', 'aa writes a long key and a string to the packet, gp writes the two strings.');
method('ps', 'a', '(B)Lkj;', 'getLoginKind', 'aa and gp each return a different static kj constant.');
method('up', 'c', '(I)Z', 'isEmpty', 'Returns field_q == -1 and toString prints "Empty PlayerStats" when true.');
method('up', 'a', '(ILiw;)V', 'readFromPacket', 'Reads type, appearance, name indices, stats, experience and three trinket ids from the packet.');
method('up', 'a', '(BLiw;)V', 'writeToPacket', 'Writes the same fields as the reader back out, padding trinkets to three with zeros.');
method('up', 'd', '(I)Ljava/lang/String;', 'getDisplayName', 'Returns "Empty", "Error" or the upper-cased initial plus ". " plus the surname from ce.field_G.');
method('up', 'b', '(B)V', 'clear', 'Sets type to -1 and zeroes name, stats, appearance and replaces trinkets with an empty array.');
method('up', 'a', '(BLup;)V', 'copyFrom', 'Copies type, stats, names, trinkets, appearance and flag from another PlayerStats (or clears if the source is empty).');
method('up', 'b', '(BLup;)Z', 'isSameAs', 'Compares type, names, stats, trinket list, appearance and flag; two empty players are equal.');
method('up', 'h', '(I)I', 'computeChecksum', 'Chains ia.a hashing over type, stats, experience, names, trinket ids, appearance and the flag.');
method('up', 'c', '(B)I', 'getHighestBaseStat', 'Returns the maximum of power, speed and tackle fields.');
field('cq', 'k', 'I', 'logType', 'toString maps 0/1/2/3 to Bid/Buy/Own/Outbid.');
field('cq', 'l', 'I', 'slotIndex', 'toString prints it as "INDEX".');
field('cq', 'i', 'J', 'auctionId', 'toString prints it as "ID".');
field('pt', 'j', 'J', 'auctionId', 'toString prints it as "Auction ID".');
field('pt', 'f', 'I', 'listingType', 'toString prints it as "Type".');
field('pt', 'h', 'I', 'slotIndex', 'toString prints it as "Index".');
field('pt', 'k', 'Lup;', 'playerStats', 'Lazily created PlayerStats read and written after the header fields.');
method('pt', 'a', '(Lpt;I)Z', 'isSameListing', 'Compares auction id, type and index of two listings.');
method('pt', 'f', '(B)I', 'getListingType', 'Returns the type nibble stored in field_f.');
method('pt', 'f', '(I)I', 'getSlotIndex', 'Returns the index nibble stored in field_h.');
method('pt', 'a', '(I)J', 'getAuctionId', 'Returns the long auction id.');
method('pt', 'e', '(I)Lup;', 'getPlayerStats', 'Returns the PlayerStats for the listing.');
method('pt', 'a', '(Liw;I)V', 'writeToPacket', 'Writes type/index nibbles, value, id and the PlayerStats.');
method('pt', 'a', '(Liw;B)V', 'readFromPacket', 'Reads type/index nibbles, value, id and the PlayerStats; called by the packet constructor.');
field('hn', 'i', 'I', 'actionType', 'toString switches on 0..9: shop player, sold, trinket, level up, kit, colours, stadium surface, render order.');
field('hn', 'g', '[I', 'arguments', 'toString prints entries such as player index, slot and trinket id.');
method('hn', 'a', '(ILiw;)V', 'writeToPacket', 'Writes the action type and each argument to the packet.');
method('hn', 'a', '(Lhn;I)Z', 'isSameAction', 'Compares action type and argument arrays element by element.');
method('gr', 'a', '(Lhn;ZI)V', 'applyAction', 'Applies a ManagerAction to the club state (players, trinkets, kits, stadium surface).');
method('gr', 'a', '(ILiw;I)V', 'readFromPacket', 'Large packet reader filling the club state fields, squad, auctions and log.');
method('gr', 'a', '(Lgr;B)V', 'copyFrom', 'Deep copies squad, flags, auction log (cq) and auction listings (pt) from another instance.');
method('gr', 'a', '(III)Lhn;', 'createOrderSwapAction', 'Copies the 9-entry order array, swaps two slots and returns new hn(9, order).');
method('gr', 'b', '(I)V', 'generateDefaultSquad', 'Seeds a Random with field_e and creates the starting up players.');
method('gr', 'b', '(BI)Lcq;', 'findLogEntryBySlot', 'Returns the first non-outbid log entry whose slot index equals the argument.');
method('gr', 'a', '(JB)Z', 'hasBidOrBuyEntry', 'Scans the auction log for type 0 or 1 entries with the given auction id.');
method('gr', 'a', '(IJ)Z', 'hasOwnEntry', 'Scans the auction log for a type 2 entry with the given auction id.');
method('gr', 'b', '(IJ)Z', 'hasOutbidEntry', 'Scans the auction log for a type 3 entry with the given auction id.');
method('gr', 'c', '(I)Z', 'canStartAuction', 'Counts non-outbid log entries and returns true when fewer than five.');
method('gr', 'c', '(B)Z', 'hasEmptySquadSlot', 'Returns true if any squad PlayerStats is empty.');
field('gr', 'O', 'Ltf;', 'auctionLog', 'List of AuctionLogEntry copied in copyFrom.');
field('gr', 'g', 'Ltf;', 'auctionListings', 'List of AuctionListing copied in copyFrom.');
field('gr', 'i', '[Lup;', 'squad', 'Nine PlayerStats copied in copyFrom.');
method('jk', 'a', '(Lrj;[IB[B)Z', 'prepareSamples', 'Resolves each of 128 notes to a sample, same loop as steelsentinels MusicPatch.prepareSamples.');
method('da', 'a', '(Z)V', 'clearReferences', 'Nulls the stream, patch, envelope and sample fields.');
method('mp', 'a', '(Ljava/applet/Applet;ZLjava/lang/String;)V', 'writeSettingsCookie', 'Builds "settings=..; version=1; path=/; domain=.." with expiry and writes it through document.cookie.');
method('bv', 'a', '(Ljava/applet/Applet;Ljava/lang/String;B)V', 'writeSessionCookie', 'Builds "session=..; version=1; path=/; domain=.." and sets it through document.cookie, expiring it when empty.');
method('bv', 'a', '(ILjava/lang/String;ZLjava/applet/Applet;)V', 'openExternalUrl', 'Opens the URL with showDocument "_blank", logging "MGR1:" on a malformed URL.');
method('cq', 'a', '(Ljava/applet/Applet;B)V', 'openSubscribePage', 'Builds a URL for "subscribe.ws" from the code base and shows it in "_top".');
method('ad', 'a', '(Lsj;I)V', 'loadLocalizedStrings', 'Single huge method that loads every named text entry such as "returntotournament" from an archive.');
method('ad', 'a', '(II)Ljava/lang/String;', 'formatCurrencyAmount', 'Returns the currency prefix hs.field_b plus the number formatted by dg.a.');
method('hw', 'a', '(Ljava/lang/CharSequence;IZ)Z', 'isValidDisplayName', 'Accepts 1..12 characters, rejects leading and trailing separator characters and consecutive separators.');
method('iu', 'a', '(III)Z', 'loadGoalScenery', 'Picks a goal sprite name (goal_park, goal_beach, goal_street, goal_rusty, goal_pipe) and loads it from the scenery archive.');
method('iu', 'a', '(ILjava/lang/CharSequence;I[BII)I', 'encodeCp1252', 'Writes each char as a byte with a switch mapping Unicode points like 8364 to cp1252 bytes.');
method('k', 'b', '(I)I', 'loadStreetScenery', 'Loads "cars", "signs" and "cracks" from the street archive and returns download progress.');
method('us', 'g', '(B)V', 'drawTutorialCaption', 'Types out the current tutorial step text with <col=ffff00> highlighting and draws it in a wrapped box.');
method('es', 'a', '(Lml;B)V', 'writeToPacket', 'Writes the category, start and count ints to the outgoing packet.');
method('wh', 'a', '(IZ)V', 'startFadeIn', 'Stores fade-in length and loop flag, resets the counter and sets the stream volume to 0.');
method('wh', 'a', '(IB)V', 'startFadeOut', 'Stores the fade-out length, zeroes its counter and enables fading out.');
method('wh', 'g', '(B)V', 'stepFadeIn', 'Raises the stream volume each tick until the fade-in counter reaches its length.');
method('wh', 'e', '(I)V', 'stepFadeOut', 'Lowers the stream volume each tick once the stream is near its end.');
method('wh', 'f', '(B)V', 'update', 'Restarts finished streams after the delay and runs fade-in and fade-out steps.');
method('wh', 'a', '(Z)I', 'getSoundId', 'Returns the sound id stored in field_n.');
method('wh', 'a', '(II)V', 'setStartDelay', 'Stores the start delay counter field_k.');
method('gv', 'a', '(I)V', 'tickFade', 'Advances age and computes alpha 256 down to 0 between ticks 500 and 600.');
method('gv', 'a', '(II)V', 'draw', 'Draws the background box and the text with the current alpha.');
method('bg', 'a', '(BLiw;)V', 'decode', 'Decodes opcode-tagged fields (text, phrase ids, parameters) from a packet buffer.');
method('bg', 'g', '(B)Ljava/lang/String;', 'getDisplayText', 'Joins the text parts split on \'<\' with "..." between them.');
method('bg', 'a', '(BJ)Ljava/lang/String;', 'decodeBase37Name', 'Converts a base-37 long to a name, capitalising after underscores.');
method('an', 'a', '(II)Lbg;', 'getPhrase', 'Returns a cached phrase by id or loads and decodes it from one of two archives.');
method('ma', 'j', '(I)V', 'dispatchServerPacket', 'Switches on packet opcode so.field_b to the static handlers (gf, sm, ki, tt, gs, qv, ...), logging "MGS1/MGS2" for unknown ones.');
method('ma', 'c', '(Z)V', 'saveSessionCookie', 'Takes fj.a() and passes it to bv.a, which writes the session cookie.');
method('qg', 'a', '(BII[IIIII)V', 'captureRasterState', 'Stores clip bounds, the pixel array and extra ints into the snapshot fields.');
field('wh', 'm', 'Lvm;', 'stream', 'The PcmSampleStream whose volume is faded and restarted.');
field('wh', 'n', 'I', 'soundId', 'Index into vg.field_Db used to create the sample stream.');
field('wh', 'k', 'I', 'startDelay', 'Decremented each restart before the stream is recreated.');
field('gv', 'f', 'Ljava/lang/String;', 'text', 'Drawn by the draw method with the alpha computed in tickFade.');
field('gv', 'g', 'I', 'alpha', '256 when sticky, fades from 256 to 0 between ticks 500 and 600.');
field('gv', 'i', 'I', 'age', 'Incremented every tick up to 600.');
field('lj', 'i', 'Ljava/lang/String;', 'text', 'The only instance field, set by the constructor.');
field('es', 'j', 'I', 'category', 'Written first by writeToPacket and set from the first constructor argument.');
field('es', 'l', 'I', 'startIndex', 'Second constructor value, the first uncached row index.');
field('es', 'i', 'I', 'count', 'Third constructor value, number of consecutive uncached rows.');
field('bc', 'j', 'I', 'category', 'gd uses it to select the per-category row table.');
field('bc', 'g', 'I', 'rowId', 'gd uses it as the hash key within the category table.');
field('jm', 'k', '[B', 'data', 'Copy of the received bytes filled in dr.');
field('jm', 'f', 'J', 'dueTime', 'Current time plus latency plus gaussian jitter.');
field('jm', 'j', 'I', 'opcode', 'Packet id captured with ll.field_i.');
field('si', 'n', 'I', 'operationCount', 'Read first in the decoder and sizes all per-operation arrays.');
field('si', 'p', 'I', 'requestId', 'Read as a 4-byte int after the count.');
field('si', 'h', '[I', 'operationTypes', 'Set to 0..4 per operation in the decoder.');
field('si', 'e', '[Lwu;', 'methodTasks', 'Method lookup tasks stored for types 3 and 4.');
field('si', 'f', '[Lwu;', 'fieldTasks', 'Field lookup tasks stored for types 0..2.');
field('si', 'l', '[[[B', 'serializedArguments', 'Argument byte arrays read for method operations.');
field('si', 'o', '[I', 'fieldSetValues', 'Value read for operation type 1.');
field('si', 'm', '[I', 'operationErrors', 'Set to -1..-5 on lookup failures.');
method('wh', 'a', '(B[Lvc;)V', 'linkAuctionItemsToLog', 'For each received vc finds the cq in ic.field_h.field_O with the same id and stores the item in i.field_A[slot].');
field('fp', 'm', 'Lup;', 'playerStats', 'toString prints field_m.d() as the player name.');
method('vc', 'a', '(ILiw;)Lvc;', 'readAuctionItem', 'Static factory that builds a vc from a packet: id, flag bits, three ints and PlayerStats.');
method('js', 'a', '(BZ)V', 'updateScreen', 'Abstract; Kickabout.a(int,boolean) calls it each frame on the current and pending screen to handle input.');
method('js', 'a', '(IZ)V', 'drawScreen', 'Abstract; Kickabout.a(int) calls it with -5 to draw each non-qt screen (qt subclasses draw buttons and panels).');
method('js', 'a', '(IIC)Z', 'handleKey', 'Abstract key hook: qt version treats 13 as enter, 96/97/98/99 as arrow keys, returns true when consumed.');
method('js', 'a', '(IZILjs;)V', 'setTransitionProgress', 'Kickabout passes progress 0-256, whether this screen is entering and the other screen; qt turns it into a horizontal slide offset.');
method('js', 'a', '(Leg;ILut;I)Lut;', 'renderModelToSprite', 'Sets the sprite as render target, clears it, draws the eg model with rotation and restores the target.');
method('js', 'a', '(Ljava/lang/String;ILbu;IIIIIZ)V', 'setServerConnectionParameters', 'Stores host name and ports in static fields and creates the tb/eb/n network objects.');
method('js', 'a', '(ILjava/lang/String;ZZLjava/lang/String;I)I', 'stepLoginHandshake', 'State machine writing the login block, reading the reply codes and the player profile fields; polled by ma.l.');
method('js', 'a', '(ILjava/applet/Applet;)V', 'openQuitPage', 'Opens "quit.ws" in the "_top" frame of the applet context.');
field('js', 'c', 'I', 'screenId', 'Set from the constructor argument (-5, -3, -2, -1, 0-26); compared against ids in jm and io.');
field('js', 'b', 'I', 'previousScreenId', 'jm.a stores the leaving screen id here and vj.a navigates back with cq.field_h.field_b.');
method('qt', 'b', '(I)V', 'buildWidgets', 'Called once per screen right after configuration in iv.a; subclasses create their hd widgets there.');
method('qt', 'b', '(B)V', 'restoreDefaultButtons', 'Re-installs the saved alternate io[] set (field_v) via setButtons if one was stored by configureMenu.');
method('qt', 'e', '(B)Z', 'hasBackButton', 'Returns true if any button has kind 7, the Back button handled by vj.a.');
method('qt', 'a', '(Lqt;I)Z', 'isShallowerThan', 'Returns other.field_q > this.field_q; jm.a and slide direction use it to compare menu depth.');
method('qt', 'd', '(B)V', 'showTutorialTip', 'Maps screen ids 14,15,16,23,24,25 to tip index 12-17 and queues a pv tutorial-tip dialog; called by button kind 37.');
method('qt', 'a', '(IB)Z', 'isButtonVisible', 'Called from draw and hit test before using a button; dj overrides it to hide previous/next on the first/last page.');
method('qt', 'a', '(II)I', 'buttonCenterY', 'Per-button y: fixed 469 for bottom buttons (kinds 7,42,43,19,37) otherwise a stacked column from 190.');
method('qt', 'b', '(II)I', 'buttonCenterX', 'Per-button x: bottom buttons at wr.field_f-50 for kind 37, others 190; subclasses override to place columns.');
method('qt', 'a', '(IIB)I', 'buttonIndexAt', 'Loops all buttons with their x/y/size and returns the index under the point, or -1.');
method('qt', 'a', '(IIZ)V', 'enterScreen', 'Resets the selection and every button state; jm.a calls it on the screen being entered with (0,-1/0,flag).');
method('qt', 'a', '(ZI)V', 'drawOverlay', 'Second draw pass in Kickabout after ta.e; wf, qs and fw draw ig.b(slide offset) here.');
method('qt', 'c', '(I)V', 'goBackUnlessHome', 'Enter key handler: leaves via vj.a unless the screen id is 0 or 18.');
method('qt', 'a', '(Z[Lio;)V', 'setButtons', 'Stores the button array and creates a fresh ko selection for its length.');
method('qt', 'a', '(Ljava/lang/String;IIILjava/lang/String;[Lio;[Lio;IZIII)V', 'configureMenu', 'Called per screen in iv.a with title text, ribbon style, button arrays, depth and id.');
field('qt', 'i', '[Lio;', 'buttons', 'Array of io set by setButtons; drawn, hit tested and clicked by index.');
field('qt', 'x', 'Lko;', 'buttonSelection', 'ko created for the buttons; field_e is the focused index.');
field('qt', 'j', 'I', 'slideOffsetX', 'Horizontal offset set in setTransitionProgress and added to every button x while sliding.');
field('qt', 'q', 'I', 'menuDepth', 'Compared by isShallowerThan; set from configureMenu parameter 11.');
method('dj', 'h', '(B)V', 'showPreviousPage', 'Decrements field_C (floor 0) and plays a sound; button kind 21 calls it from io.a.');
method('dj', 'f', '(I)V', 'showNextPage', 'Increments field_C up to the last page and plays a sound; button kind 22 calls it from io.a.');
method('dj', 'g', '(B)Z', 'hasPreviousPage', 'Returns field_C != 0; used to hide button 0.');
method('dj', 'b', '(Z)Z', 'hasNextPage', 'Returns false on the last page of a(true); used to hide button 2.');
method('dj', 'a', '(Z)[Ljava/lang/String;', 'getPageTitles', 'Returns iq/uv/ue/pt title arrays chosen by screen id 19/20/21/22.');
field('dj', 'C', 'I', 'pageIndex', 'Current help page, drawn as "n+1 / total" and reset to 0 in enterScreen.');
method('ta', 'a', '(Liw;Ljava/math/BigInteger;II[BILjava/math/BigInteger;)V', 'writeEncryptedLoginBlock', 'Uses SecureRandom for four key ints, enciphers the payload and RSA-encrypts the key block into the buffer.');
method('ap', 'a', '(BLsj;)V', 'loadMatchSprites', 'Static: loads Characters/*_body and head sprites, balls/skin_* and fans/fan_* from the archive.');
method('ap', 'a', '(Ljava/applet/Applet;I)V', 'openSupportPage', 'Opens "tosupport.ws" in the "_top" frame.');
method('ap', 'd', '(I)V', 'createPhaseController', 'Chooses wb/fk/lr/bf/va/ol as the hs phase object from nu.field_u 0-5.');
method('ap', 'b', '(II)V', 'beginPhase', 'Sets the phase via nu.a, then rebuilds the controller and clears the selected seat state.');
method('ap', 'a', '(BLml;)V', 'readMatchState', 'Reads the server match state from the packet into the nu copies, then rebuilds the controller.');
method('ap', 'e', '(I)Z', 'isSpectator', 'Returns field_h == -2; guards the resign/draw sends in f and c.');
method('ap', 'a', '(ZI)V', 'leaveMatch', 'Calls ji.k, and for offline matches sets the exit target (ng.a) and goes to transition screen 18; used by button kind 8.');
method('ap', 'h', '(I)V', 'captureFadeSnapshot', 'Renders the scene into sprite rk.field_h and sets field_E=256 so the next phase can fade it out.');
field('ap', 'o', 'Lnu;', 'matchState', 'The nu game state; its field_u is the phase 0-5 and field_R the per-player records.');
field('ap', 'r', 'Lhs;', 'phaseController', 'Active hs phase object drawn and updated by the screen.');
field('ap', 'h', 'I', 'localSeat', 'Player index of the local user (-2 means spectator).');
field('ap', 't', 'Z', 'isOnlineMatch', 'Cloned states and packet sends are only done when true.');
field('ap', 'u', 'Z', 'stateReceived', 'False draws "Waiting to receive the game state..."; set true in beginPhase/readMatchState.');
method('e', 'b', '(I)V', 'leaveSplash', 'Resets timer, runs mg.a and mv, and goes to screen 0 via jm.a; called on timeout or key.');
method('e', 'a', '(Lnp;IZII)V', 'layoutPlayerRows', 'Static: builds name/rating/kick/accept/reject label cells for each he row ("wants to join", "Inviting <%0>").');
method('lm', 'a', '(I)V', 'drawTabButtons', 'Draws the io tab buttons (kinds 54,53,52,12) at x=120+135*i.');
method('lm', 'b', '(IZ)V', 'selectStatTab', 'Maps button kind 54/53/52 to ph.field_a 0/1/2 (kicks, tackles, goals/possession).');
method('lm', 'a', '(III)I', 'tabIndexAt', 'Hit test over tab buttons returning the index or -1.');
method('lm', 'c', '(II)I', 'tabCenterX', 'Returns 120 + index*135.');
method('lm', 'b', '(I)V', 'drawStatsPanel', 'Draws the tournament panel with the three stats sections and the scroll bars (qt.field_h/gu.field_Ib).');
method('lm', 'a', '(Lml;Z)V', 'readPlayerNames', 'Reads a count then name/int pairs into field_Q and field_H plus field_R from the packet.');
method('sf', 'e', '(I)V', 'layoutQuickPlayWidget', 'Positions the quick play hd widget relative to the screen width f.field_d.');
method('sf', 'c', '(II)Z', 'isScreenShown', 'Static: true if screen id is current (and not leaving) or the pending screen.');
method('bd', 'e', '(I)V', 'buildUnreadMessagesNotice', 'Static: sets st.field_m to the unread count message plus the account page hint, or 1 message text.');
method('rm', 'g', '(B)V', 'drawLoginRequiredText', 'Draws "Create a free account to start using this feature" under the table.');
method('rm', 'e', '(I)V', 'queueNewAuctionDialog', 'Static: queues a pq dialog event; wf calls it when the "create new auction" button is clicked.');
method('wf', 'b', '(IIB)V', 'sendAuctionAction', 'Static: writes packet id 8 with value param0 to the outgoing buffer or.field_d.');
method('wf', 'b', '(IZ)V', 'startComputerMatch', 'Static: creates ap with players "You"/"Computer" and starts it; used by the main menu for the tutorial.');
method('wf', 'a', '(Lvc;I)V', 'replaceAuctionEntry', 'Replaces the list entry with the same field_a id by the new listing.');
method('wf', 'a', '(Lvc;B)Z', 'containsAuction', 'Returns true if a listing with the same id is in field_T.');
method('wf', 'a', '(Z[Lvc;)V', 'setAuctionList', 'Rebuilds field_T from the given listings.');
method('wf', 'a', '(Z[Lvc;II)V', 'updateAuctionRows', 'Builds the "Search Results"/"My Auctions" header rows and fills the jr array shown by the table.');
method('wf', 'e', '(I)V', 'requestAuctionRefresh', 'Sends packet 84, remembers the time in field_H and disables the refresh button.');
method('wf', 'a', '(ZB)V', 'requestAuctionPage', 'Sends packet 83/55 with filter mask, sort field and scroll position.');
method('wf', 'a', '(ZZ)V', 'handleButtons', 'Reads clicks of New Auction, Refresh, filter checkboxes and sort tabs; queues dialogs or requests.');
method('wf', 'g', '(B)I', 'headerRowCount', 'Returns 2 + list size or 0; offset of the visible rows.');
method('fm', 'e', '(I)V', 'handleScrollButtons', 'Scrolls the achievement list by 16 pixels every other frame while an arrow button is held.');
method('ne', 'i', '(B)V', 'drawMovePage', 'Page 0 "How To Move".');
method('ne', 'l', '(B)V', 'drawFeetPage', 'Page 1 "Using Your Feet".');
method('ne', 'j', '(I)V', 'drawPlayersPage', 'Page 2 "The Players".');
method('ne', 'h', '(I)V', 'drawPlayerStatsPage', 'Page 3 "Player Stats".');
method('ne', 'k', '(I)V', 'drawTrinketsPage', 'Page 4 "Trinkets", with the Trinkets Expansion Pack member text.');
method('ne', 'i', '(I)V', 'drawKeyFactsPage', 'Page 5 "What You Need To Know".');
method('b', 'h', '(B)V', 'refreshSelectedPlayer', 'Called after a trait change (ge.a); clears a stale selection and rebuilds the info panel.');
method('b', 'g', '(I)V', 'rebuildPlayerPanel', 'Builds the stats and trinket slot widgets for the selected squad player.');
method('ja', 'g', '(I)V', 'handleScrollButtons', 'Scrolls the kit style list every other frame while an arrow is held and plays sounds.');
method('ja', 'f', '(I)V', 'refreshPlayerPreview', 'Picks the player at index field_U in the squad, sets the kit label text and the model preview.');
method('ja', 'd', '(II)Z', 'ensureSoundLoaded', 'Static: lazily loads sound effect index and caches it in rj.field_a.');
method('qs', 'b', '(Z)V', 'refreshSellButton', 'Hides or shows the Sell button depending on the selected squad slot.');
method('qs', 'c', '(Z)V', 'rebuildShopRows', 'Creates the sp shop slots for each tier up to the team level and marks owned ones.');
method('fw', 'h', '(B)I', 'pollServerConnection', 'Static: connect state machine returning 3, 4 or 1 while opening the socket and sending the handshake.');
method('io', 'a', '(IZ)V', 'activate', 'Click handler: switches on field_m (button kind) to navigate screens, show dialogs or leave the match.');
field('io', 'm', 'I', 'kind', 'Button kind constant (0-56) tested everywhere in qt/io/iv; selects label text ge.field_o[kind].');
field('io', 'd', 'I', 'width', 'Used as half-width offset in qt hit tests and drawing.');
field('io', 'h', 'I', 'height', 'Used as half-height offset in qt hit tests and drawing.');
method('ko', 'a', '(BI)V', 'selectIndex', 'Sets the focus index to param1 when no mouse button is held.');
method('ko', 'a', '(IZ)V', 'handleArrowKeys', 'Moves the index with keys 96/97 wrapping at the ends and clears the mouse flag on 98/99.');
field('ko', 'e', 'I', 'selectedIndex', 'Focused item, -1 for none.');
field('ko', 'a', 'I', 'itemCount', 'Constructor argument; bounds checked in the mouse update.');
method('Kickabout', 'v', '(I)V', 'drawLoadingBar', 'Draws "LOADING <%0>" and the rounded progress bar from TextInputWidget.field_R.');
method('Kickabout', 'w', '(I)V', 'drawLogoBanner', 'Draws the logo sprite at y=10 with alpha interpolated between the current and next screen via ak.a.');
method('Kickabout', 'u', '(I)V', 'updateLogoHover', 'If the mouse is over the logo rectangle, shows the lf.field_b tooltip.');
method('Kickabout', 'o', '(I)V', 'applyPendingNavigation', 'Goes to op.field_v unless it is MAX or -3 (which triggers MouseWheelInput.a).');
method('Kickabout', 'b', '(I)V', 'releaseStatics', 'Calls the static clear method of dozens of classes at shutdown.');
method('Kickabout', 'g', '(B)V', 'onStartup', 'Called once before the main loop: initialises the client, creates eh and the fullscreen controller.');
method('Kickabout', 'c', '(B)V', 'onShutdown', 'Called when the applet stops: stops sound and music (ph.a, r.a).');
method('Kickabout', 'a', '(IB)V', 'onConnectionResult', 'Result 1 sets reconnect flags; 0 resets screens and goes to 0 or 18 with the removed-from-game message.');
method('Kickabout', 'm', '(B)Z', 'isConnectionBusy', 'Returns od.field_n || ec.field_e || an.field_d, the reconnect/connect flags; tu.e uses it before ws.a.');
method('Kickabout', 'a', '(ILml;I)Z', 'handlePacket', 'Giant switch over the packet opcode (9 message, 14 init, 15 leave, 87 lobby init, ...) returning true when handled.');
method('tu', 's', '(I)V', 'processIncomingPackets', 'Loops dr.a over the packet stream, calling handlePacket then ma.j if the opcode is not handled.');
method('tu', 'p', '(I)V', 'dispatchInputEvents', 'Polls login/connection states and feeds queued key events to the registered hc listeners.');
method('tu', 'b', '(B)V', 'paintFrame', 'Draws loading screens or calls the hc paint hooks and presents the frame via su.a.');
method('tu', 'e', '(B)V', 'runFrameStep', 'Per-frame step: connection poll, input, packet processing, login result and listener updates.');
method('ma', 'l', '(B)I', 'pollLogin', 'Calls js.a (login handshake), handles the reconnect message and returns the result code or -1.');
method('ma', 'i', '(B)I', 'pollLoginResult', 'Calls l, and on success runs the per-opcode setup handlers for the enabled flags; returns the code.');
method('ma', 'a', '(IIIIIBIZ)V', 'initialiseClient', 'Creates the AWT frame, applies the screen settings, calls uv.a and js.a with the connection data and lm.d.');
method('Kickabout', 'o', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('aa', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ac', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ad', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('af', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ag', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('aj', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ao', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('aq', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ar', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('as', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('at', 'h', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('au', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('av', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('b', 'f', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bd', 'f', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('be', 'd', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bf', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bh', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bi', 'f', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bk', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bl', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bn', 'e', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bq', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('bs', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('c', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ca', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cb', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cd', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ch', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ci', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cl', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cp', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cr', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cu', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('cv', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('d', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('da', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('db', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('dc', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('dh', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('di', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('dl', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('dr', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ds', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('dt', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('du', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('dw', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ea', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ec', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ee', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ef', 'h', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('eh', 'd', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ej', 'h', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('em', 'c', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('eo', 'c', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ep', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('eq', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('er', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('es', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('et', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ew', 'd', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('fc', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ff', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('fh', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('fi', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('fs', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('fv', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('fw', 'f', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gd', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gf', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gk', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gl', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('go', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gr', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gs', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gu', 'h', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('gw', 'd', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('hh', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('hj', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('hn', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('hq', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('hu', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('hv', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ic', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('id', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ig', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ih', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ij', 'g', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('il', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('in', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('io', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ip', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('iu', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('iw', 'g', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ja', 'h', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('jc', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('jh', 'k', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('jj', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('jk', 'f', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('jl', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('jt', 'h', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ka', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kc', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kd', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kh', 'd', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kj', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kk', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kl', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('km', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ko', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kp', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kq', 'i', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kr', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ks', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kt', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ku', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('kw', 'd', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('la', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('lc', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ld', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('lf', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('lh', 'g', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('li', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('lt', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('lu', 'g', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('lw', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('m', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mc', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('md', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mf', 'i', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mg', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mi', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mk', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mn', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ms', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('mt', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('n', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nc', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nd', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ng', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nh', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nj', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nm', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('np', 'i', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nr', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ns', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('nw', 'c', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('oa', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('oc', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('od', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('oe', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('oh', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ok', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('oo', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('op', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('or', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ov', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('p', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pe', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pg', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ph', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pi', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pl', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('po', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pr', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pt', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('pu', 'i', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('q', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('qh', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('qj', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ql', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('qn', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('r', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rc', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('re', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rf', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rg', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rj', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rk', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rl', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rn', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rp', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rr', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rs', 'b', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ru', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('rv', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sa', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sb', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sc', 'e', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sd', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sf', 'f', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sh', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sj', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sk', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sl', 'i', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('sn', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('so', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ss', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('st', 'b', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('su', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('tb', 'c', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('tf', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('tg', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ti', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('tl', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ts', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('tv', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('u', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ua', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ud', 'e', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('uf', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ug', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('uh', 'a', '()V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('uk', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ul', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('um', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('un', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('up', 'g', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('uq', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('us', 'f', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('uv', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('v', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('va', 'c', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vc', 'g', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vi', 'd', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vj', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vk', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vl', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vq', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vr', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vs', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vt', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('vv', 'g', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('w', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wa', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wc', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wd', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('we', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wk', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wm', 'a', '(B)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wm', 'c', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wn', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wp', 'b', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('wq', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
method('ws', 'a', '(I)V', 'releaseStatics', 'Static method whose body only assigns null to static fields of this class.');
// END-R2MEMBERS

// Completion work: roles checked against the pinned bodies and their call sites.
Object.assign(classes, {
  ab: ["WidgetFocusListener", "TextButton invokes this listener when requesting or clearing keyboard focus, passing its new focus boolean."],
  co: ["WidgetDropListener", "DropTargetWidget calls this listener with the dragged widget and target; UiWidget passes a null target for a cancelled drop."],
  eu: ["WidgetDragListener", "DraggableWidget invokes this listener after its drag coordinates change."],
  uu: ["WidgetHoverListener", "UiWidget invokes this listener when containsPointer changes the stored hover flag."],
  nf: ["ButtonPointerListener", "TextButton dispatches its pointer press and pointer release hooks to this ButtonListener subinterface."],
  gl: ["InstrumentEnvelope", "MusicPatch constructs instances into its per-note envelope array; the instance stores two byte-envelope curves and envelope/vibrato integer settings."],
  it: ["ParticipantAgent", "CommonGame constructs one of these MatchAgents per participant; LineupAgent indexes the two-team slot table using its team field."],
  kw: ["AvailabilityCheckRequest", "The email availability validator polls completion and a boolean result for the stored queried text; the request cache keys it by that text."],
  lp: ["CanvasInputBindings", "Its only method attaches the keyboard, mouse/focus and optional wheel handlers to the supplied Canvas."],
  v: ["EntityAfterimage", "Captures a rendered footballer or ball into a 128x128 sprite and fades it over a 17-tick lifetime at the stored world position."],
  vv: ["ArchiveRequest", "Abstract DualLinkNode request exposes getBytes/progress and a volatile pending flag; disk-cache and network request subclasses implement it."],
  ui: ["NetworkArchiveRequest", "ArchiveRequest whose progress and completion depend on the received PacketBuffer position and padding length."],
  k: ["StreetSceneryLoader", "Static street archive loader installs cars, signs and crack sprite arrays once; the class has no live instance constructor."],
});

method("cn", "a", "([I[BIIIIIII)V", "blitCoverage", "Shared CoverageBitmapFont implementation: identical normalized operators, constants and identifier-reuse pattern (190 tokens), matching pixelate:M:ld.a([I[BIIIIIII)V. Reviewed against that engine role.");
method("cn", "a", "([I[BIIIIIIII)V", "blitCoverageAlpha", "Shared CoverageBitmapFont implementation: identical normalized operators, constants and identifier-reuse pattern (196 tokens), matching pixelate:M:ld.a([I[BIIIIIIII)V. Reviewed against that engine role.");
method("dp", "b", "(F)V", "setWetGain", "Shared ReverbPcmStream implementation: identical normalized operators, constants and identifier-reuse pattern (76 tokens), matching escapevector:M:wb.f(F)V,pool:M:gl.e(F)V. Reviewed against that engine role.");
method("dp", "d", "(F)V", "setStereoWidth", "Shared ReverbPcmStream implementation: identical normalized operators, constants and identifier-reuse pattern (76 tokens), matching escapevector:M:wb.a(F)V,pool:M:gl.c(F)V. Reviewed against that engine role.");
method("eg", "a", "(I[IIIIZ)V", "applyGroupTransform", "Shared ModelMesh implementation: identical normalized operators, constants and identifier-reuse pattern (1490 tokens), matching armiesofgielinor:M:gd.a(I[IIIIZ)V. Reviewed against that engine role.");
method("eg", "a", "(I[IIIIZI[I)V", "applyMaskedGroupTransform", "Shared ModelMesh implementation: identical normalized operators, constants and identifier-reuse pattern (3935 tokens), matching armiesofgielinor:M:gd.a(I[IIIIZI[I)V. Reviewed against that engine role.");
method("kv", "a", "(III)I", "evaluateWaveform", "Shared SynthesizedSoundInstrument implementation: identical normalized operators, constants and identifier-reuse pattern (95 tokens), matching geoblox:M:ed.a(III)I. Reviewed against that engine role.");
method("on", "a", "(IIIIII)V", "fillRectangleAlpha", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (245 tokens), matching geoblox:M:vb.b(IIIIII)V,pixelate:M:t.a(IIIIII)V,pool:M:qh.c(IIIIII)V,bachelorfridge:M:dg.f(IIIIII)V. Reviewed against that engine role.");
method("on", "a", "(IIIIIII)V", "fillRoundedRectangleBlended", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (941 tokens), matching pixelate:M:t.a(IIIIIII)V,pool:M:qh.a(IIIIIII)V. Reviewed against that engine role.");
method("on", "a", "(IIIIIIII[II[IIIIIIII)V", "addRadialGlowScanlines", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (157 tokens), matching pixelate:M:t.a(IIIIIIII[II[IIIIIIII)V,pool:M:qh.a(IIIIIIII[II[IIIIIIII)V,bachelorfridge:M:dg.a(IIIIIIII[II[IIIIIIII)V. Reviewed against that engine role.");
method("on", "c", "(IIIII)V", "drawHorizontalLineAlpha", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (265 tokens), matching geoblox:M:vb.b(IIIII)V,pixelate:M:t.e(IIIII)V,pool:M:qh.e(IIIII)V,bachelorfridge:M:dg.g(IIIII)V. Reviewed against that engine role.");
method("on", "d", "(IIII)V", "fillCircle", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (562 tokens), matching geoblox:M:vb.d(IIII)V,pixelate:M:t.c(IIII)V,pool:M:qh.a(IIII)V,bachelorfridge:M:dg.b(IIII)V. Reviewed against that engine role.");
method("on", "d", "(IIIIII)V", "fillVerticalGradientAdditive", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (336 tokens), matching pixelate:M:t.f(IIIIII)V. Reviewed against that engine role.");
method("on", "e", "(IIIIII)V", "drawLineBlendedInclusive", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (682 tokens), matching pixelate:M:t.h(IIIIII)V,pool:M:qh.b(IIIIII)V. Reviewed against that engine role.");
method("on", "f", "(IIIII)V", "drawVerticalLineAlpha", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (259 tokens), matching geoblox:M:vb.c(IIIII)V,pixelate:M:t.f(IIIII)V,pool:M:qh.g(IIIII)V,bachelorfridge:M:dg.b(IIIII)V. Reviewed against that engine role.");
method("on", "f", "(IIIIII)V", "drawRoundedRectangle", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (1054 tokens), matching geoblox:M:vb.a(IIIIII)V,pixelate:M:t.e(IIIIII)V. Reviewed against that engine role.");
method("on", "g", "(IIIIII)V", "fillVerticalGradient", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (267 tokens), matching geoblox:M:vb.d(IIIIII)V,pixelate:M:t.g(IIIIII)V,pool:M:qh.d(IIIIII)V,bachelorfridge:M:dg.b(IIIIII)V. Reviewed against that engine role.");
method("on", "h", "(IIIIII)V", "drawRectangleAlpha", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (88 tokens), matching escapevector:M:em.b(IIIIII)V,pixelate:M:t.b(IIIIII)V. Reviewed against that engine role.");
method("on", "i", "(IIIIII)V", "fillRoundedRectangle", "Shared SoftwareRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (747 tokens), matching geoblox:M:vb.c(IIIIII)V,pixelate:M:t.d(IIIIII)V,pool:M:qh.a(IIIIII)V,bachelorfridge:M:dg.e(IIIIII)V. Reviewed against that engine role.");
method("ot", "a", "(IIII)V", "drawScaled", "Shared ArgbSprite implementation: identical normalized operators, constants and identifier-reuse pattern (494 tokens), matching geoblox:M:il.a(IIII)V,pixelate:M:sa.d(IIII)V,pool:M:lp.c(IIII)V,bachelorfridge:M:pa.c(IIII)V. Reviewed against that engine role.");
method("ot", "a", "(IIIIII)V", "rotateNearest", "Shared ArgbSprite implementation: identical normalized operators, constants and identifier-reuse pattern (4050 tokens), matching geoblox:M:il.b(IIIIII)V,pixelate:M:sa.b(IIIIII)V,pool:M:lp.a(IIIIII)V,bachelorfridge:M:pa.a(IIIIII)V. Reviewed against that engine role.");
method("ot", "b", "(II)V", "drawVerticalFlip", "Shared ArgbSprite implementation: identical normalized operators, constants and identifier-reuse pattern (307 tokens), matching pixelate:M:sa.c(II)V,bachelorfridge:M:pa.b(II)V. Reviewed against that engine role.");
method("ot", "d", "(IIIII)V", "drawScaledAlpha", "Shared ArgbSprite implementation: identical normalized operators, constants and identifier-reuse pattern (496 tokens), matching geoblox:M:il.b(IIIII)V,pixelate:M:sa.c(IIIII)V,pool:M:lp.b(IIIII)V,bachelorfridge:M:pa.c(IIIII)V. Reviewed against that engine role.");
method("ot", "h", "()Lot;", "copyArgb", "Shared ArgbSprite implementation: identical normalized operators, constants and identifier-reuse pattern (95 tokens), matching bachelorfridge:M:pa.i()Lpa;. Reviewed against that engine role.");
method("t", "a", "(II)V", "buildColorPalette", "Shared TriangleRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (627 tokens), matching pool:M:fb.c(II)V. Reviewed against that engine role.");
method("t", "a", "(IIIIIII)V", "drawFlatTriangle", "Shared TriangleRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (2479 tokens), matching pool:M:fb.a(IIIIIII)V,bachelorfridge:M:jb.a(IIIIIII)V. Reviewed against that engine role.");
method("t", "a", "(IIIIIIIII)V", "drawShadedTriangle", "Shared TriangleRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (2921 tokens), matching pool:M:fb.a(IIIIIIIII)V,bachelorfridge:M:jb.a(IIIIIIIII)V. Reviewed against that engine role.");
method("t", "a", "([IIIIII)V", "drawFlatSpan", "Shared TriangleRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (691 tokens), matching pool:M:fb.a([IIIIII)V. Reviewed against that engine role.");
method("t", "a", "([IIIIIIII)V", "drawShadedSpan", "Shared TriangleRasterizer implementation: identical normalized operators, constants and identifier-reuse pattern (825 tokens), matching pool:M:fb.a([IIIIIIII)V. Reviewed against that engine role.");
method("ut", "a", "()V", "flipVertically", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (147 tokens), matching bachelorfridge:M:kv.c()V. Reviewed against that engine role.");
method("ut", "a", "(III)V", "drawSilhouette", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (288 tokens), matching geoblox:M:dm.a(III)V,pixelate:M:tf.e(III)V,pool:M:dd.f(III)V,bachelorfridge:M:kv.c(III)V. Reviewed against that engine role.");
method("ut", "a", "(IIII)V", "drawScaled", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (494 tokens), matching geoblox:M:dm.a(IIII)V,pixelate:M:tf.d(IIII)V,pool:M:dd.c(IIII)V,bachelorfridge:M:kv.c(IIII)V. Reviewed against that engine role.");
method("ut", "a", "(IIIIII)V", "rotateNearest", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (3577 tokens), matching pixelate:M:tf.b(IIIIII)V,pool:M:dd.a(IIIIII)V,bachelorfridge:M:kv.a(IIIIII)V. Reviewed against that engine role.");
method("ut", "a", "(IIII[I[IIIIIIIIIII)V", "blitScaledAdditiveRows", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (165 tokens), matching pixelate:M:tf.a(IIII[I[IIIIIIIIIII)V. Reviewed against that engine role.");
method("ut", "a", "(IIII[I[IIIIIIIIIIII)V", "blitScaledAdditiveIntensityRows", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (196 tokens), matching pixelate:M:tf.a(IIII[I[IIIIIIIIIIII)V. Reviewed against that engine role.");
method("ut", "a", "([I[IIIIIIII)V", "copyNonzeroPixels", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (242 tokens), matching pixelate:M:tf.b([I[IIIIIIII)V,pool:M:dd.b([I[IIIIIIII)V,bachelorfridge:M:kv.a([I[IIIIIIII)V. Reviewed against that engine role.");
method("ut", "a", "([I[IIIIIIIIIIII)V", "blitScaledSilhouette", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (121 tokens), matching geoblox:M:dm.b([I[IIIIIIIIIIII)V,bachelorfridge:M:kv.b([I[IIIIIIIIIIII)V. Reviewed against that engine role.");
method("ut", "b", "(II)V", "drawVerticalFlip", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (307 tokens), matching pixelate:M:tf.c(II)V,bachelorfridge:M:kv.b(II)V. Reviewed against that engine role.");
method("ut", "b", "(IIII)V", "drawScaledAveraged", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (840 tokens), matching pixelate:M:tf.a(IIII)V,pool:M:dd.a(IIII)V. Reviewed against that engine role.");
method("ut", "b", "([I[IIIIIIIII)V", "recolorNeutralPixels", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (344 tokens), matching pixelate:M:tf.a([I[IIIIIIIII)V,pool:M:dd.a([I[IIIIIIIII)V,bachelorfridge:M:kv.c([I[IIIIIIIII)V. Reviewed against that engine role.");
method("ut", "d", "()V", "rotateClockwise", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (183 tokens), matching geoblox:M:dm.a()V,pixelate:M:tf.b()V,pool:M:dd.f()V,bachelorfridge:M:kv.f()V. Reviewed against that engine role.");
method("ut", "d", "(IIIII)V", "drawScaledAlpha", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (496 tokens), matching geoblox:M:dm.b(IIIII)V,pixelate:M:tf.c(IIIII)V,pool:M:dd.b(IIIII)V,bachelorfridge:M:kv.c(IIIII)V. Reviewed against that engine role.");
method("ut", "e", "(II)V", "drawMultiply", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (290 tokens), matching geoblox:M:dm.e(II)V,pixelate:M:tf.g(II)V,pool:M:dd.d(II)V,bachelorfridge:M:kv.a(II)V. Reviewed against that engine role.");
method("ut", "g", "()V", "flipHorizontalInPlace", "Shared Sprite implementation: identical normalized operators, constants and identifier-reuse pattern (124 tokens), matching bachelorfridge:M:kv.e()V. Reviewed against that engine role.");
method("ab", "a", "(ZLfd;I)V", "focusChanged", "Invoked by TextButton.requestKeyboardFocus and clearKeyboardFocus with the current focus flag.");
method("co", "a", "(Ljg;Lln;I)V", "dropped", "Invoked with a target on drop, or a null target when UiWidget cancels the drag.");
method("eu", "a", "(ILjg;II)V", "dragged", "Invoked after DraggableWidget updates its drag coordinates.");
method("uu", "a", "(ZBLfd;)V", "hoverChanged", "Invoked when UiWidget.containsPointer changes its hover state.");
method("nf", "a", "(IIIILwi;BI)V", "pointerPressed", "TextButton.handlePointerPress passes its widget and press coordinates to this hook.");
method("nf", "a", "(Lwi;IIIII)V", "pointerReleased", "TextButton.handlePointerRelease invokes this hook before clearing its pressed-button state.");
method("lp", "a", "(Ljava/awt/Canvas;B)V", "attachInputHandlers", "Attaches keyboard and mouse/focus handlers, then the optional mouse-wheel handler, to a Canvas.");
method("ej", "a", "(Ljava/awt/Component;I)V", "attachKeyboardInput", "Disables traversal keys and registers PlayerModelPreview.field_q as KeyListener and FocusListener.");
method("se", "a", "(ILjava/awt/Component;)V", "attachMouseInput", "Registers ProxyAuthenticationRequiredException.field_e as MouseListener, MouseMotionListener and FocusListener.");
method("kw", "a", "(B)Z", "isComplete", "Returns the completion flag set by complete; validators wait until this becomes true.");
method("kw", "b", "(B)Z", "getResult", "Returns the boolean result stored by complete after the asynchronous availability check.");
method("kw", "a", "(I)Ljava/lang/String;", "getQuery", "Returns the immutable query text supplied to the constructor.");
method("kw", "a", "(ZB)V", "complete", "Marks the request complete and stores the supplied boolean result.");
method("kw", "c", "(B)I", "loadStadiumScenery", "Loads stadium seats, seat masks and advertising sprites once; otherwise returns archive group progress.");
method("gl", "a", "(IBIILml;IIIII)I", "readFourRangeUnsigned", "Reads a two-bit selector, then the selected bit-width and cumulative range offsets.");
method("gl", "a", "(ILnu;)V", "buildBoundaryCameraLookup", "Samples 10 points along each of four pitch edges for both teams and all four player slots, preserving the original ball position.");
method("gl", "a", "(IBIII)[Lut;", "createPanelSpriteSlices", "Delegates to the nine-sprite beveled panel generator using fixed one-pixel border widths.");
method("it", "a", "(Lrj;Lsj;B)V", "initializeGameSoundEffects", "Initializes the indexed game sound table with named menu, crowd, ball and footballer sound resources.");
method("it", "c", "(I)V", "releaseStatics", "Drops the class scroll-bar reference and preserves the original guard-dependent boolean assignment.");
method("k", "a", "(ZI)V", "enqueuePromotionDialog", "Appends a new PromotionDialog for the supplied division value to the pending-dialog deque.");
method("k", "a", "(I)V", "releaseStatics", "Clears this class static sprite, layout and localized-text references under the original guard.");
method("v", "a", "(I)V", "tick", "Decrements the afterimage remaining lifetime when it is positive.");
method("v", "a", "(Lgm;IZ)V", "captureFootballer", "Renders a footballer into the private 128x128 sprite and records its position and 17-tick fade lifetime.");
method("v", "a", "(IBLob;)V", "captureBall", "Renders a ball into the private sprite at its stored world position and resets the 17-tick fade lifetime.");
method("v", "c", "(I)V", "draw", "Projects the stored world position and draws the sprite with opacity scaled by remaining lifetime.");
method("v", "d", "(I)Ljava/lang/Boolean;", "takePendingBooleanResult", "Returns ep.field_f once and clears that static result slot.");
method("rg", "a", "(BLjava/awt/Component;)V", "detach", "AwtMouseWheelInput implementation calls removeMouseWheelListener.");
method("rg", "b", "(BLjava/awt/Component;)V", "attach", "AwtMouseWheelInput implementation calls addMouseWheelListener.");
method("rg", "b", "(B)I", "pollRotation", "AwtMouseWheelInput returns its accumulated wheel rotations and resets the counter.");
field("kw", "d", "Ljava/lang/String;", "query", "Constructor argument returned by getQuery.");
field("kw", "j", "Z", "complete", "Set before the result is stored by complete and polled by validators.");
field("kw", "e", "Z", "result", "Boolean payload returned by getResult.");
field("it", "p", "I", "team", "LineupAgent uses this field as the first index of its two-team slot arrays.");
field("it", "j", "I", "participantIndex", "Constructor receives the CommonGame participant-loop index and stores it here.");
field("vv", "p", "Z", "pending", "Volatile flag tested by both network and disk requests before returning completed bytes.");

// Archive/configuration records and the canvas policy are identified by their
// instance state and callers, independently of unrelated moved static helpers.
Object.assign(classes, {
  ag: ['SoundStreamHandle', 'Node retains a PCM sample stream, its unscaled target volume and the owning node; sound-volume changes rescale these registered streams.'],
  bt: ['QuickChatCategoryCache', 'Loads and caches tc category definitions from the local or global Quick Chat archive, setting the global ID bit for IDs >= 32768.'],
  tc: ['QuickChatCategory', 'Tagged definition contains a description, child category IDs and phrase IDs with keyboard shortcuts, with optional global-ID marking.'],
  cl: ['FullscreenDisplayMode', 'Fullscreen mode enumeration stores four integers from the platform result: width, height, bit depth and refresh rate.'],
  ef: ['AnimationFrameset', 'Loads all animation frame files in a group, reuses skeletons by ID and releases pending bytes after constructing AnimationFrame entries.'],
  hl: ['DateInputValidator', 'Evaluates the day, zero-based month and year of a DateInputWidget, rejecting invalid calendar dates and implausible birth years.'],
  kh: ['CanvasResizePolicy', 'Clamps requested canvas dimensions to minimum/maximum sizes and an optional aspect ratio, notifies ro and restores the saved size after fullscreen.'],
  ro: ['CanvasResizeListener', 'Canvas policy invokes this callback with a guard plus the new width and height whenever it changes the canvas size.'],
  kj: ['LoginKind', 'Small integer-valued token returned by the getLoginKind contract on LoginCredentials and its subclasses.'],
  mw: ['DirectSoundBackend', 'Legacy audio backend allocates Microsoft DirectSound descriptors and cursors for two output buffers.'],
  cs: ['LegacySoundBackend', 'Empty marker interface implemented by the Microsoft DirectSound backend; it defines no operations in this export.'],
  oc: ['ArchivePreloadEntry', 'ArchivePreloader constructs entries holding an archive, group/file names, optional whole-archive name and numeric group ID for progress polling.'],
  oq: ['VorbisMapping', 'Vorbis setup mapping reads the submap count and mux, then floor and residue IDs for each submap.'],
  qf: ['TextureProvider', 'TriangleRasterizer requests brightness-adjusted texels, average colors, texture size flags and transparency mode from this interface.'],
  vs: ['PlayerPortraitCacheEntry', 'Cached rendered footballer portrait plus a copied PlayerStats and appearance key; a 64-entry move-to-front cache reuses the image.'],
  wn: ['AccountRegistrationResponse', 'RegistrationRequestDialog consumes its success/terms flags, response code, message and alternative-name suggestions.'],
});
method('bt', 'a', '(II)Ltc;', 'getCategory', 'Looks up the category ID in a weighted cache, loads the appropriate archive file, decodes it and marks global IDs when needed.');
method('bt', 'a', '(IZI)Lut;', 'buildStadiumSeatColumn', 'Builds a sprite from a stadium-seat top cap, the requested number of repeated middle pieces and a bottom cap.');
method('bt', 'a', '(Z)V', 'releaseStatics', 'Clears this class static image, text, layout and integer-array references, preserving the original guard.');
method('bt', 'b', '(I)Z', 'advanceScriptedTutorialPlayers', 'Branches on the tutorial step and advances its footballers to scripted pitch coordinates, reporting whether they have arrived.');
method('tc', 'a', '(I)V', 'markGlobalIds', 'Sets bit 32768 in every child-category and phrase ID.');
method('tc', 'a', '(IZLiw;)V', 'decodeOpcode', 'Decodes category description, child-category shortcuts, phrase shortcuts and the tag-4 flag.');
method('tc', 'a', '(Liw;I)V', 'decode', 'Reads tagged category fields until the zero terminator.');
method('ef', 'g', '(B)Z', 'ensureLoaded', 'Returns true once all frames and skeletons are available, constructs the frameset and releases its buffered file bytes.');
method('ef', 'a', '(Ljava/lang/CharSequence;I)Z', 'isAllowedDisplayName', 'Combines the display-name validity check with the per-character account-name whitelist.');
method('cl', 'a', '(ZIII)Z', 'isValidCalendarDate', 'Checks the zero-based month range and that the day is between one and the month length for the supplied year.');
method('kh', 'a', '(B)V', 'applySizeConstraints', 'Clamps width/height to the configured range and aspect ratio, calls the resize listener on changes and updates horizontal centering.');
method('kh', 'a', '(BLut;)[Lut;', 'centerOnlyPanelSlices', 'Creates a nine-slice array with the supplied sprite in the center and null border slices.');
method('kh', 'a', '(I)V', 'restoreSavedSize', 'Notifies the resize listener with the width/height remembered before entering fullscreen.');
method('kh', 'a', '(III)V', 'setAvailableSize', 'Stores the available width and height used by the constraint calculation.');
method('kh', 'b', '(I)Lvq;', 'enterFullscreen', 'Saves the current canvas size, notifies the listener of the fullscreen dimensions and restores the size if fullscreen creation fails.');
method('kh', 'c', '(I)V', 'updateCanvasSize', 'Ticks the automatic-resize interval or reapplies the fixed size, preserving the splash-screen and platform capability checks.');
method('kh', 'e', '(I)Z', 'canAutoResize', 'Tests the platform capability/version thresholds required by the automatic size policy.');
method('ro', 'a', '(III)V', 'resizeCanvas', 'Callback receives an obfuscation guard, target width and target height from CanvasResizePolicy.');
method('kj', 'a', '(II)V', 'enqueueHelpTipDialog', 'Appends a new HelpTipDialog for the supplied tip to the pending modal deque.');
method('kj', 'a', '(IIIII)V', 'drawBeveledFrame', 'Draws top and bottom horizontal borders plus grayscale side borders with a vertical shade ramp.');
method('kj', 'a', '(IILup;IIZ)Lot;', 'getPlayerPortrait', 'Searches the portrait cache by stats and appearance; renders the least-recent entry subject to the 80 ms throttle when missing.');
method('oc', 'c', '(B)Lut;', 'buildFirstDecodedSprite', 'Expands palette indices and optional alpha of the first decoded sprite into Sprite or ArgbSprite, then releases the sheet buffers.');
method('oc', 'a', '(B)V', 'clearAccountChoiceResources', 'Resets the account-choice flag and clears the related layout references.');
method('hl', 'f', '(I)V', 'releaseStatics', 'Clears this class static layout and indexed-sprite references under the original guard.');
method('wn', 'a', '(CILjava/lang/CharSequence;)I', 'countCharacterFrom', 'Counts occurrences of the supplied character from the given starting index to the end of a character sequence.');
method('vs', 'a', '(IIILup;ZI)V', 'renderPortrait', 'Copies player stats and appearance into the cache key, renders the footballer into a scratch surface and downsamples to the portrait.');
method('vs', 'a', '(II)Z', 'isFadingSoundActive', 'Scans the active fading-sound deque and compares each entry sound ID.');
method('vs', 'a', '(IJ)I', 'millisToMinutes', 'Divides the supplied millisecond count by 60000 and converts the result to int.');
method('vs', 'a', '(Ljava/lang/String;[Ljava/lang/String;BI)V', 'completeAccountRegistration', 'Converts the server result code into a successful registration response, name suggestions or a failure message.');
method('qf', 'a', '(FBI)[I', 'getTexturePixels', 'TriangleRasterizer passes the brightness and texture ID and uses the returned int array as texels.');
method('qf', 'a', '(BI)I', 'getAverageTextureColor', 'TriangleRasterizer uses the result as the base color for shaded triangles when texture pixels are unavailable.');
method('qf', 'a', '(ZI)Z', 'isLowDetailTexture', 'Controls the raster span branch using 64-by-64 texel addressing instead of the 128-by-128 branch.');
field('ag', 'i', 'Lvm;', 'stream', 'PCM sample stream retained for later volume updates.');
field('ag', 'j', 'I', 'baseVolume', 'Unscaled target volume captured before applying the global volume factor.');
field('ag', 'k', 'Lgn;', 'owner', 'Owning intrusive node; sound registry cleanup removes handles once it is no longer linked.');
field('bt', 'f', 'Leq;', 'cache', 'Weighted category cache keyed by category ID.');
field('bt', 'g', 'Lsj;', 'globalArchive', 'Archive read for category IDs with bit 32768 set.');
field('bt', 'h', 'Lsj;', 'localArchive', 'Archive read for category IDs below 32768.');
field('cl', 'f', 'I', 'width', 'First integer of each four-integer platform display mode.');
field('cl', 'b', 'I', 'height', 'Second integer of each platform display mode.');
field('cl', 'e', 'I', 'bitDepth', 'Third integer of each platform display mode.');
field('cl', 'a', 'I', 'refreshRate', 'Fourth integer of each platform display mode.');
field('ef', 'o', 'I', 'groupId', 'Archive group requested by ensureLoaded.');
field('ef', 'r', '[[B', 'pendingFrameBytes', 'Raw frame bytes held until all required skeletons become available, then cleared.');
field('ef', 'q', '[Ldb;', 'frames', 'Decoded frames indexed by archive file ID.');
field('hl', 'g', 'Lcj;', 'dateInput', 'Date widget read by the validator for day, month and year.');
field('kh', 'j', 'Lro;', 'resizeListener', 'Callback receiving all canvas-size changes.');
field('oq', 'b', 'I', 'submapCount', 'Mapping count read from the Vorbis setup bitstream.');
field('oq', 'c', 'I', 'mux', 'Submap selector read when the mapping has multiple submaps.');
field('oq', 'a', '[I', 'floorIds', 'One floor index read for each submap.');
field('oq', 'd', '[I', 'residueIds', 'One residue index read for each submap.');
field('wn', 'g', 'Z', 'success', 'Constructor flag checked by RegistrationRequestDialog before showing account-created text.');
field('wn', 'c', 'Z', 'needsTerms', 'Success path opens AccountTermsPanel when this flag is set.');
field('wn', 'd', 'Ljava/lang/String;', 'message', 'Server-provided failure message shown by the registration dialog.');
field('wn', 'e', 'I', 'responseCode', 'Numeric response code used by registration error handling.');
field('wn', 'f', '[Ljava/lang/String;', 'nameSuggestions', 'Alternative account names offered after a name rejection.');
field('vs', 'd', 'Lup;', 'playerStats', 'Copied player statistics used to validate portrait-cache hits.');
field('vs', 'h', 'Lot;', 'portrait', 'Rendered and downsampled portrait returned by the cache.');
field('tc', 'r', 'Ljava/lang/String;', 'description', 'Tag 1 supplies the category display text.');
field('tc', 'o', '[I', 'subcategoryIds', 'Tag 2 supplies child-category IDs and their keyboard shortcuts.');
field('tc', 'q', '[C', 'subcategoryShortcuts', 'Shortcut characters parallel to the tag-2 child-category IDs.');
field('tc', 'n', '[I', 'phraseIds', 'Tag 3 supplies phrase IDs and their keyboard shortcuts.');
field('tc', 'p', '[C', 'phraseShortcuts', 'Shortcut characters parallel to the tag-3 phrase IDs.');
field('tc', 't', 'Z', 'tagFourEnabled', 'Flag set by category opcode 4; its further behavior is not present in this export.');

Object.assign(classes, {
  dg: ['NineSlicePanelPainter', 'Base panel painter delegates its bounds and sprite array to the nine-slice rendering routine; two subclasses provide alternative panel backgrounds.'],
  nk: ['TexturedPanelPainter', 'Panel painter draws a clipped backdrop sprite with an additive highlight and two inset borders.'],
  pa: ['GeneratedPanelPainter', 'Panel painter requests a width-specific generated panel sprite from AccountRegistrationPanel using its constructor-selected style.'],
  cr: ['LinkTextPainter', 'Draws underlined widget text with hover/focus colors and a focus rectangle aligned to the text.'],
  du: ['MarkerSliderPainter', 'Draws the nv slider track and one circular marker for each stored value, plus its optional caption.'],
  nv: ['MarkerSliderWidget', 'TextButton holding a growable list of marker positions and a maximum value; its painter maps these positions onto a horizontal track.'],
  ei: ['RotaryDialPainter', 'Draws the circular s control, an angle-dependent pointer, optional reference marker and caption.'],
  s: ['RotaryDialWidget', 'TextButton stores the current dial position, reference position, angular range, center and radius; pointer presses update its angle.'],
  re: ['CheckboxPainter', 'Draws a checkbox square, crossed checked state and configurable text alignment/colors.'],
  cg: ['CaptionedContainer', 'Single-child container paints a left- or right-side caption using its stored font, width, padding and color.'],
  oh: ['WorldSpriteDecoration', 'Retains a sprite and world coordinates and draws it through the world-to-screen projection with viewport scaling.'],
  bl: ['LobbyMatchPreview', 'Holds a lobby game record and participant names, renders a miniature pitch/score panel and sends its selection when clicked.'],
  rl: ['PlayerArchetypeSortCriterion', 'Compares ShopPlayerSlot entries by the localized archetype name of each PlayerStats.'],
  j: ['FootballerPreview', 'Owns one rendered footballer, advances its movement/pose and renders a half-size preview sprite.'],
  ak: ['WorldDrawEntry', 'Depth-ordered scene entry can represent a footballer, ball, team goal or positioned sprite; it supplies a sort Y coordinate and dispatches rendering by kind.'],
  rk: ['WorldSpriteSequence', 'Holds an indexed sprite sequence at fixed world coordinates and renders the requested frame at the viewport scale.'],
  ng: ['ServerTextTemplate', 'Decodes a template ID and typed arguments from the network, then resolves literals or lookup-table values into a localized message.'],
});
method('dg', 'a', '(IIIII)V', 'drawPanel', 'Draws the stored nine-slice sprites in the supplied panel bounds; subclass overrides draw their custom backgrounds.');
method('dg', 'a', '(B)V', 'releaseStatics', 'Clears this class static localized-text references under the original guard.');
method('nv', 'a', '(B)I', 'getMarkerCount', 'Returns the size of the growable marker-position list.');
method('nv', 'a', '(BI)I', 'getMarkerPosition', 'Returns the marker position at the requested index, or -1 when out of range.');
method('nv', 'h', '(B)I', 'getMaximumValue', 'Returns the maximum used by MarkerSliderPainter to scale positions along its track.');
method('nv', 'j', '(I)V', 'releaseStatics', 'Clears static layouts, sprites and lookup arrays while preserving the guard-dependent call.');
method('ei', 'a', '(I)V', 'releaseStatics', 'Clears static sprite and lookup-table references under the original guard.');
method('cg', 'k', '(I)V', 'releaseStatics', 'Clears static account layout and localized-text references.');
method('oh', 'a', '(B)V', 'draw', 'Projects the stored world position and draws the sprite at the current viewport scale.');
method('bl', 'a', '(I)V', 'draw', 'Draws the match preview background, pitch/player/ball markers or phase message and participant score strip.');
method('bl', 'a', '(Lkp;ZI)V', 'update', 'Stores the current lobby record, computes hover/click state and sends the selected match slot to the server.');
method('bl', 'a', '(B)Z', 'ensureBleachersLoaded', 'Requests the scenery/bleachers sprite sheet and returns true after it is available and decoded.');
method('j', 'a', '(II)V', 'updatePose', 'Sets preview movement direction, advances movement and refreshes the footballer pose.');
method('j', 'a', '(III)V', 'draw', 'Renders the owned footballer into a scratch surface and draws a half-size image, temporarily reversing facing for the opposite team.');
method('j', 'a', '(BLjava/lang/String;Ljava/lang/String;)Z', 'containsForwardOrReversed', 'Checks whether the text contains either the supplied string or its reversal.');
method('j', 'a', '(Z)V', 'releaseStatics', 'Clears the static string array, preserving the original guard-dependent sprite lookup.');
method('ak', 'a', '(B)I', 'getSortY', 'Returns the world Y coordinate of the represented footballer, ball, goal or sprite for scene draw ordering.');
method('ak', 'a', '(III)V', 'setSpritePosition', 'Stores sprite world X and its Y adjusted by half the sprite height.');
method('ak', 'b', '(I)V', 'draw', 'Dispatches by entry kind to sprite drawing, rotating sprite drawing, footballer, ball or goal rendering.');
method('ak', 'a', '(I)V', 'releaseStatics', 'Clears the static text/sprite references when the original guard matches.');
method('rk', 'a', '(IZ)V', 'drawFrame', 'Projects the stored world coordinates and draws the selected sequence sprite at the current viewport scale.');
method('ng', 'a', '(Lml;I)V', 'decode', 'Reads a template ID, argument count and typed literal-string or indexed arguments from the cipher packet buffer.');
method('ng', 'a', '(B)Ljava/lang/String;', 'format', 'Resolves typed argument values from their lookup tables and substitutes them into the localized template.');
method('rp', 'a', '(III)I', 'getDaysInMonth', 'Returns the month-length table value, with February adjusted by the Gregorian leap-year test.');

Object.assign(classes, {
  ff: ['QuickChatCommandType', 'Quick Chat phrase tag 3 looks up this integer command ID and reads the command-specific number of configuration parameters stored in field_d.'],
  rn: ['VertexNormal', 'MeshData accumulates adjacent triangle normal vectors and a contribution count per vertex; ModelMesh divides the lighting dot product by that count.'],
  ia: ['FaceNormal', 'MeshData stores one normalized cross-product vector for each flat-shaded triangle; ModelMesh uses it directly for lighting.'],
  wp: ['LeaderboardParticipant', 'The high-score response parser fills a table of participant names and optional secondary names, marking each entry when included in the unique-participant view.'],
  en: ['PlayerSurnameSortCriterion', 'Compares ShopPlayerSlot entries using the surname lookup indexed by player archetype and surname index.'],
  tr: ['ClientUiOverlay', 'Registered with the common overlay stack; updates shared client UI, animates its viewport height, paints overlays and forwards captured keyboard input.'],
});
method('bb', 'a', '(BI)Lff;', 'getQuickChatCommandType', 'Looks up a command type by its numeric ID in the registered command-type array.');
method('rp', 'b', '(I)[Lff;', 'getQuickChatCommandTypes', 'Returns the array of command-type singleton tokens consulted by Quick Chat phrase decoding.');
method('rn', 'a', '(II)Lqt;', 'getMenuScreen', 'Returns the registered ButtonMenuScreen at the supplied screen index.');
method('rn', 'b', '(II)I', 'sine', 'Looks up the angle masked to 2047 in the sine table used by model rotations.');
method('ia', 'a', '(II)I', 'rotateLeftFourBits', 'Returns the 32-bit input rotated left by four bits.');
method('ia', 'a', '(I)Lgq;', 'getSoundMixer', 'Returns the shared PCM stream mixer.');
method('ia', 'a', '(ZI)V', 'completePendingAvailabilityCheck', 'Completes the pending AvailabilityCheckRequest with the supplied boolean result.');
method('ia', 'a', '(B)V', 'releaseStatics', 'Clears static strings, digit characters and the request deque while preserving the original guard assignment.');
method('en', 'b', '(B)V', 'releaseStatics', 'Clears static validation, integer-array and long-array references under the original guard.');
method('tr', 'a', '(Z)V', 'releaseStatics', 'Clears static text and array references under the original guard.');
method('tr', 'd', '(I)V', 'pushRasterState', 'Takes or allocates a RasterStateSnapshot, captures the current raster dimensions/pixels/clip and pushes it onto the active stack.');
method('tr', 'b', '(I)Ljava/lang/String;', 'describeCurrentPacket', 'Formats current protocol-state values and packet bytes as a hexadecimal string for network error reports.');
field('ff', 'a', 'I', 'id', 'Numeric command ID searched by getQuickChatCommandType.');
field('ff', 'd', 'I', 'parameterCount', 'Number of unsigned-short configuration parameters decoded for each Quick Chat command.');
field('rn', 'a', 'I', 'x', 'Accumulated X component of adjacent face normals.');
field('rn', 'b', 'I', 'y', 'Accumulated Y component of adjacent face normals.');
field('rn', 'f', 'I', 'z', 'Accumulated Z component of adjacent face normals.');
field('rn', 'g', 'I', 'contributions', 'Count incremented once for each contributing triangle, used to normalize vertex lighting.');
field('ia', 'f', 'I', 'x', 'Normalized X component of the triangle cross product.');
field('ia', 'a', 'I', 'y', 'Normalized Y component of the triangle cross product.');
field('ia', 'g', 'I', 'z', 'Normalized Z component of the triangle cross product.');
field('wp', 'b', 'Ljava/lang/String;', 'name', 'Primary participant name decoded by the high-score response parser.');
field('wp', 'd', 'Ljava/lang/String;', 'secondaryName', 'Optional secondary name associated with the participant.');
field('wp', 'g', 'Z', 'includedInUniqueView', 'Set after the parser emits this participant into the unique-participant result group.');

// Shared raster candidates were checked against the actual arithmetic. In
// particular, Sprite.e scales additive intensity, rather than alpha opacity.
method('ot', 'b', '(III[I[IIIIIIIIII)V', 'addArgbRows', 'Scales source pixels by their alpha and the supplied intensity, then adds them to destination pixels with saturated RGB carries; shared body shape agrees in Armies of Gielinor, Steel Sentinels, Pool, Pixelate and Bachelor Fridge.');
method('ot', 'c', '([I[IIIIIIII)V', 'blendArgbRows', 'Uses source alpha and its 256 complement to blend source and destination RGB rows, skipping transparent pixels; shared body shape agrees in five other reviewed games.');
method('ot', 'c', '([I[IIIIIIIII)V', 'blendShadedGrayscaleRows', 'Recolors grayscale source pixels around the supplied shade color, retains colored pixels and alpha-blends the resulting rows; shared body shape agrees in five other reviewed games.');
method('ut', 'c', '(IIIII)V', 'drawScaledSilhouette', 'Clips a nearest-scaled sprite and draws its nonzero mask in one supplied color through blitScaledSilhouette; shared body shape agrees in GeoBlox and Bachelor Fridge.');
method('ut', 'e', '(IIIII)V', 'drawScaledAdditive', 'Clips a nearest-scaled sprite and selects saturated additive blitting with full or scaled intensity; the fifth argument controls additive intensity.');

export const kickConfig = {
  game: 'kickabout', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-kickabout-rules.mjs', 'reproduce-kickabout.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs', 'naming-coverage.mjs', 'tests/test-kickabout-core.mjs'],
  verifyCore: verifyKickaboutCore,
  readingGuide(rules, mapping) {
    const coverage = namingCoverage(mapping);
    return ['# Reading Kickabout', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/kickabout-naming.json.', '',
      `Resolved declarations: ${coverage.namedClasses}/${coverage.classes} classes and ${coverage.namedMethods}/${coverage.methods} methods have readable names; ${coverage.constructors} constructors follow their class names.`,
      `Remaining: ${coverage.unresolvedClasses.length} opaque class names and ${coverage.unresolvedMethods.length} opaque method names. The complete naming goal is still in progress.`,
      'Audit with `node readable/naming-coverage.mjs kickabout` in dekobloko-work; it exits unsuccessfully while opaque names remain.', '',
      'Start with `CommonGame` for match phases and agents; `ParticipantAgent`, `TeamSelectionAgent`, `FormationAgent` and `LineupAgent` handle participant/team choices. `FootballerAgent`, `BallAgent` and `GoalStateAgent` hold play state.', '',
      '`LobbyMatchPreview`, `FootballerPreview` and `WorldDrawEntry` cover lobby previews and scene ordering. `MarkerSliderWidget`, `RotaryDialWidget` and their painters expose the custom controls. `QuickChatCategoryCache` / `QuickChatCategory` and `AnimationFrameset` describe shared definition loading.', '',
      '`ClubState`, `PlayerStats`, `ManagerAction` and auction classes describe manager mode. `ArchiveRequest` / `NetworkArchiveRequest`, `PacketBuffer`, `CipherPacketBuffer` and the applet hierarchy cover transport and loading. UI focus, hover, drag and drop have explicit listener contracts.', '',
      'Sprite copy/reflection/rotation, availability-request completion, Gregorian calendar boundaries and Quick Chat category decoding are checked against independent native Java expectations in both raw and named corpora. These focused checks do not establish full gameplay or multiplayer equivalence.', '',
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
