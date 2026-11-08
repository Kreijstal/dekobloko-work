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
  rd: ['KitStyleDefinition', 'KitStyleTile binds one definition per kit; its two boolean grids recolor the kit mesh, with achievement, unlock-mask and access restrictions.'],
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
method('uv', 'c', '(III)Z', 'openReportPrompt', 'For action seventeen creates the Report abuse TextPromptDialog using the selected player name and identity.');
method('uv', 'a', '(I)Ljava/lang/String;', 'getDisplayName', 'Returns field_a when set, otherwise the player name field_k.');
method('uv', 'a', '(ZZ)V', 'drawMenu', 'Draws the ContextMenu and optionally appends the report-abuse action through addReportAbuseItem.');
method('uv', 'b', '(I)V', 'addReportAbuseItem', 'Adds action seventeen with the localized Report player for abuse label when the selected identity belongs to another player.');
method('uv', 'a', '(III)Z', 'handlePrimaryAction', 'Handles menu ids 8, 18, 11-14, 19 and 20 by calling static helpers with the player name and id.');
method('uv', 'a', '(IIB)Z', 'handleSocialAction', 'Handles menu ids 4, 5 and 6 by calling the friend-list add, remove and ignore helpers with the player name.');
method('uv', 'b', '(III)Z', 'handleSecondaryAction', 'Handles menu ids 0, 1, 2, 3, 10, 15 and 16 by calling static helpers with the stored id and the argument.');
method('uv', 'd', '(I)V', 'buildMenuItems', 'Adds menu items depending on whether the player is a friend, ignored, in a game or the local user.');
method('mf', 'j', '(B)Lkq;', 'getSelectedSlot', 'Returns the kq slot at the selected index, or null when none is selected.');
method('mf', 'a', '(BI)I', 'slotX', 'Column position 52 times the index modulo 3.');
method('mf', 'b', '(II)I', 'slotY', 'Row position 75 times the index divided by 3.');
method('mf', 'c', '(Z)V', 'sendSquadOrder', 'Writes packet 81 with the squad order and the club state to the outgoing buffer unless a dialog is open.');
method('mf', 'a', '(I)V', 'update', 'Counts down the hover timer and updates the hover, selection and drag state of the nine slots.');
method('mf', 'a', '(BLml;Z)V', 'readLeagueRankingPage', 'Reads a league ranking page into ListingRowCache, updates the LeaguesScreen table and optionally scrolls to the flagged or local-player entry.');
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

// Audio scheduling and mixing: names follow the stream graph, sample arithmetic
// and hardware queue accounting, rather than unrelated moved static helpers.
Object.assign(classes, {
  me: ['PcmMixerListener', 'Mixer timer entry with a remaining frame offset; its callback returns the next offset or a negative value to remove it.'],
});
method('me', 'a', '(Lgq;)I', 'onTimer', 'Called when the listener frame offset is reached; a nonnegative return reschedules the listener, a negative return removes it.');
method('me', 'a', '()V', 'onRemoved', 'Invoked immediately after the mixer unlinks this listener.');
method('gq', 'a', '(Lme;)V', 'removeListener', 'Unlinks a timer listener, invokes its removal callback and updates the next scheduled frame offset.');
method('gq', 'e', '()V', 'normalizeListenerOffsets', 'Subtracts elapsed mixer frames from every listener offset and resets the elapsed-frame counter.');
method('lq', 'a', '()I', 'getSchedulingPriority', 'Returns the default priority 255; sample streams override it using current volume and playback progress.');
method('lq', 'b', '([III)V', 'processFrames', 'Mixes into the destination when the stream is active, otherwise advances it by skipping the same frame count.');
method('uh', 'b', '()I', 'getBufferedFrameCount', 'Device occupancy contract: the Java Sound override subtracts available output frames from device capacity; the silent base reports its capacity.');
method('uh', 'a', '(I)V', 'skipFrames', 'Decreases the scheduling countdown and skips frames on the root stream.');
method('uh', 'a', '(IZI)V', 'configureAudio', 'Validates the 8000..48000 sample rate, selects mono/stereo and stores the audio-service thread priority.');
method('uh', 'a', '(Lbu;Ljava/awt/Component;II)Luh;', 'createPlayer', 'Creates and opens a Java Sound output, registers it in one of two service slots and falls back to a silent base player if the backend fails.');
method('uh', 'a', '(Llq;)V', 'setRootStream', 'Stores the root stream mixed by this player.');
method('uh', 'a', '(Llq;I)V', 'enqueueByPriority', 'Appends the stream to one of eight scheduling buckets selected by priority shifted right five bits.');
method('uh', 'a', '([II)V', 'mixFrames', 'Clears the output block, schedules active streams within the cost limit and mixes the root stream.');
method('uh', 'b', '(Llq;)V', 'deactivateStreamTree', 'Recursively clears stream active flags and resets each associated sample scheduling counter.');
method('uh', 'c', '()V', 'shutdown', 'Unregisters this player, stops an unused service thread, closes the device and releases its sample buffer.');
method('uh', 'd', '()V', 'serviceOutput', 'Fills the device queue in 256-frame blocks, adjusts latency and reopens failed or inactive devices after the retry delay.');
method('vm', 'a', '(II)I', 'computeLeftGain', 'Computes the left-channel square-root pan gain from volume and the 0..16384 pan value.');
method('vm', 'd', '(II)I', 'computeRightGain', 'Computes the right-channel square-root pan gain, including the negative-pan phase-inversion mode.');
method('vm', 'a', '([IIIII)I', 'mixForwardSpan', 'Selects aligned or interpolated forward kernels and mono/stereo ramp variants, stopping at the supplied output/sample boundaries.');
method('vm', 'b', '([IIIII)I', 'mixReverseSpan', 'Selects aligned or interpolated reverse kernels and mono/stereo ramp variants, stopping at the supplied boundaries.');
method('vm', 'b', '(Lto;III)Lvm;', 'createAtFixedStep', 'Creates a stream with the supplied fixed-point sample step, internal volume and pan; returns null for empty samples.');
method('vm', 'b', '(I)V', 'setInternalVolume', 'Sets the internal volume while preserving the current pan.');
method('vm', 'c', '(II)V', 'rampInternalVolume', 'Ramps internal volume over the supplied frame count while preserving current pan.');
method('vm', 'g', '()I', 'getSamplePosition', 'Returns the integer sample index by shifting the fixed-point position right eight bits.');
method('vm', 'k', '()I', 'getPan', 'Returns the stored pan value or -1 for the special negative-pan mode.');
method('vm', 'h', '()V', 'refreshChannelGains', 'Copies target volume to current volume and recomputes left/right gains from the stored pan.');
method('vm', 'l', '()V', 'cancelRamp', 'Clears a pending gain ramp, converts the fade-stop sentinel to zero volume and refreshes current channel gains.');
method('dp', 'a', '(F)V', 'setInputGain', 'Controls the gain applied to input samples before feeding the reverb delay network.');
method('dp', 'e', '(F)V', 'setDryGain', 'Controls the unprocessed input contribution added to the reverberated output.');
method('dp', 'f', '(F)V', 'setFeedbackGain', 'Controls the damped delay sample fed back into each comb filter.');
method('dp', 'a', '(I[III)I', 'scanNegativePeak', 'Scans a circular buffer range and returns the minimum of the input accumulator and negative absolute sample values.');
method('ed', 'a', '(Lsj;II)Led;', 'load', 'Loads an archive file and decodes a SoundEffect from its PacketBuffer, returning null while unavailable.');
method('kv', 'a', '(II)[I', 'synthesize', 'Generates oscillator/envelope samples, applies modulation, gating, echo and filtering, and clamps the result to signed 16-bit range.');
method('kv', 'a', '(Liw;)V', 'decode', 'Decodes pitch/volume envelopes, optional modulation/gating envelopes, oscillator settings, echo and filter data.');
method('tg', 'a', '(I)F', 'unpackFloat', 'Unpacks the Vorbis 21-bit signed mantissa and biased exponent into a floating-point value.');
method('tg', 'a', '([BI)V', 'setBitInput', 'Selects the source byte array and byte offset for Vorbis bit reads, resetting the bit cursor.');
method('wh', 'a', '(B)V', 'startPlayback', 'Creates the sample stream at the current global volume, applies reverse playback if requested and attaches it to the selected mixer.');
method('wh', 'b', '(I)V', 'detachPlayback', 'Removes the sample stream from the mixer selected by this sound player.');
method('wh', 'a', '(I)V', 'releaseStatics', 'Clears static text and sprite-array references while preserving the original guard.');
method('jk', 'a', '(B)V', 'showAccountChoice', 'Replaces the active account panel with a new AccountChoicePanel.');
method('jk', 'a', '(I)V', 'drawMatchMinimap', 'Draws the pitch preview with projected footballers, team colors and ball/carrier position when the minimap is enabled.');
field('me', 'e', 'I', 'frameOffset', 'Remaining mixer frame offset used to order and reschedule timer callbacks.');
field('lq', 'e', 'Z', 'active', 'Scheduling selects mixInto when true and skipFrames when false.');
field('lq', 'f', 'Llq;', 'nextScheduledStream', 'Link used within the eight player priority buckets.');
field('lq', 'g', 'I', 'schedulingPriority', 'Priority assigned when the player enqueues this stream.');
field('uh', 'c', 'Llq;', 'rootStream', 'Stream graph mixed by the player.');
field('uh', 'i', 'I', 'sampleRate', 'Validated output sample rate, shared by sample-step and delay calculations.');
field('uh', 'o', 'Z', 'stereo', 'Selects two interleaved channels instead of mono.');
field('uh', 'k', '[I', 'mixBuffer', '256-frame mono or stereo buffer written to the output backend.');
field('dp', 'u', 'F', 'inputGain', 'Gain applied before feeding the reverb network.');
field('dp', 'w', 'F', 'dryGain', 'Gain of the unprocessed signal mixed into the output.');
field('dp', 'j', 'F', 'feedbackGain', 'Gain of comb-filter feedback samples.');

method('ru', 'a', '(BIII)V', 'noteOff', 'Clears the channel/key held-note slot and starts its release envelope, preserving portamento reuse behavior.');
method('ru', 'a', '(BZ)V', 'stopTrack', 'Clears the MIDI reader and pending track, then resets the synthesizer using the supplied stop mode.');
method('ru', 'a', '(II)V', 'releasePortamentoNotes', 'When portamento is enabled, starts release for unheld notes on the selected channel.');
method('ru', 'a', '(IIB)V', 'applyInitialProgram', 'Stores the initial program and bank for a channel and applies the program change.');
method('ru', 'a', '(IIBI)V', 'handlePolyphonicPressure', 'Dispatch target for MIDI status 0xA0; this export intentionally has no pressure-processing body on the valid guard path.');
method('ru', 'a', '(III)V', 'changeProgram', 'Changes a channel program and clears its exclusive-group note lookup when the program changes.');
method('ru', 'a', '(IIII)V', 'noteOn', 'Releases the previous key, reuses a portamento voice when possible or constructs a patch note/sample stream with velocity, pan, loop and exclusive-group state.');
method('ru', 'a', '(IILsj;Lrj;Lqm;)Z', 'prepareTrackSamples', 'Loads instrument patches and all required samples for the track note masks within the optional decoding budget.');
method('ru', 'a', '(ILda;)Z', 'removeNoteWithoutStream', 'Reports a note with no sample stream and unlinks released notes, clearing their exclusive-group slot if still owned.');
method('ru', 'a', '(Lda;I)I', 'computeNoteStep', 'Combines note pitch, portamento, pitch bend and vibrato, then converts the result to a fixed-point sample step at the output rate.');
method('ru', 'a', '(Lqm;ZBZ)V', 'startTrack', 'Stops the old track, parses the MIDI data, initializes every track cursor and schedules its first event, recording loop behavior.');
method('ru', 'a', '(ZILqm;)V', 'playTrack', 'Public wrapper that starts the supplied track with a full synthesizer reset and requested loop flag.');
method('ru', 'a', '(ZLda;)I', 'computeNotePan', 'Combines channel pan and the instrument note pan into the 0..16384 stream pan value.');
method('ru', 'a', '(ZLda;Z)V', 'applySampleOffset', 'Sets the note stream sample position from the channel sample-offset controller, reflecting the position for ping-pong loops when needed.');
method('ru', 'a', '(ZZ)V', 'resetSynthesizer', 'Stops or releases all notes, resets channel controllers and restores the configured initial programs and banks.');
method('ru', 'b', '(I)V', 'stop', 'Stops MIDI playback with the full note-stop reset mode.');
method('ru', 'b', '(II)V', 'resetControllers', 'Resets one or all channels to default volume, pan, expression, pitch bend, modulation, portamento and custom-controller values.');
method('ru', 'b', '(IIB)V', 'setChannelProgram', 'Public guarded wrapper for initial bank/program configuration.');
method('ru', 'b', '(III)V', 'setPitchBend', 'Stores the MIDI pitch-bend value for the selected channel.');
method('ru', 'b', '(ILda;)I', 'computeNoteVolume', 'Combines channel volume/expression, note velocity, master/channel gain and the instrument decay, main and release envelopes.');
method('ru', 'c', '(II)V', 'setPlaybackTimeScale', 'Sets the time multiplier used with MIDI division to advance event time per output frame; the default is 1000000.');
method('ru', 'c', '(III)V', 'setRetriggerRate', 'Stores the custom retrigger-rate controller and computes its exponential phase increment.');
method('ru', 'd', '(II)V', 'dispatchMidiEvent', 'Dispatches packed MIDI status/data bytes to note, program, pressure, controller, pitch-bend and reset handlers.');
method('ru', 'd', '(III)V', 'setChannelGain', 'Sets the additional gain for one channel or all sixteen channels according to the original channel-selector convention.');
method('ru', 'e', '(I)V', 'advanceMidiEvents', 'Consumes due events on the earliest MIDI track, handles end/loop/pending-track changes and schedules the next event time.');
method('ru', 'e', '(II)V', 'resetRetriggerPhase', 'When the custom retrigger mode is enabled, clears each note retrigger phase on the channel.');
method('ru', 'e', '(III)V', 'handleChannelPressure', 'Dispatch target for MIDI status 0xD0; no channel-pressure processing is implemented on the valid guard path.');
method('ru', 'f', '(II)V', 'allSoundOff', 'Fades and removes active notes on one or all channels, retaining still-fading streams in the auxiliary mixer.');
method('ru', 'g', '(II)V', 'allNotesOff', 'Clears held-note slots and starts release for all active notes on one or all channels.');
method('ru', 'a', '(ZB)V', 'drawGoalScenery', 'Draws the goal-end sprite and repeated surrounding scenery selected by pitch theme and team end.');
field('ru', 'q', '[I', 'channelBanks', 'Updated by MIDI bank-select controllers 0 and 32 and added to program numbers.');
field('ru', 'n', '[I', 'channelPrograms', 'Current patch/program identity per channel.');
field('ru', 'I', '[I', 'initialPrograms', 'Program identities restored by synthesizer reset.');
field('ru', 'v', '[I', 'pitchBend', 'MIDI 14-bit pitch-bend values, centered at 8192.');
field('ru', 'j', '[I', 'pitchBendSensitivity', 'Pitch-bend range set through the selected registered parameter.');
field('ru', 'y', '[I', 'channelVolume', 'Combined coarse/fine MIDI volume controllers 7 and 39.');
field('ru', 'E', '[I', 'channelPan', 'Combined coarse/fine MIDI pan controllers 10 and 42.');
field('ru', 'A', '[I', 'channelExpression', 'Combined coarse/fine MIDI expression controllers 11 and 43.');
field('ru', 'G', '[I', 'modulation', 'Combined coarse/fine modulation controllers 1 and 33, used by vibrato.');
field('ru', 'B', '[I', 'portamentoTime', 'Combined coarse/fine portamento-time controllers 5 and 37.');
field('ru', 's', '[I', 'sampleOffsets', 'Custom sample-position controllers 16 and 48.');
field('ru', 'L', '[I', 'retriggerRates', 'Custom retrigger-rate controllers 17 and 49.');
field('ru', 'J', '[I', 'channelGains', 'Additional per-channel gain applied to note volume.');
field('ru', 'p', 'I', 'playbackTimeScale', 'Default 1000000 time multiplier used to advance the MIDI reader per output frame.');

Object.assign(classes, {
  dk: ['AchievementQuery', 'Queued query completed with an integer result array by the A1 response handler; its factory sends the shared achievement-mask query form.'],
  ii: ['AchievementSubmission', 'Pending A1 submission serializes an achievement/check-byte pair and four tracking integers, and is removed when the acknowledgement arrives.'],
  dl: ['LookupQuery', 'Queued lookup read contains a byte-sized table ID and an integer result array filled by the LR1 response handler.'],
  hr: ['LookupRecordUpdate', 'Lookup write contains table and signed-smart record IDs plus four integer values; LR1 acknowledgements match both identifiers.'],
  sm: ['HighScoreSubmission', 'Pending high-score submission serializes its identifiers, four tracking integers and an optional integer vector; HS1 acknowledgement removes the matching entry.'],
  ni: ['HighScoreQuery', 'HS1 response matches this request ID and uses its row and value counts to decode high-score rows and unique participant views.'],
  wd: ['RankingsRequest', 'Queues a ranking-kind/row-limit query; the response fills participant-name/statistic tables, local player values and a completion flag.'],
  mp: ['BlobSubmission', 'Pending submission holds optional byte payload and the CRC of its serialized request for request/acknowledgement bookkeeping.'],
  ea: ['ColorQuantizationBox', 'RGB histogram quantizer stores three low/high cube bounds and a volume; it splits the box with greatest color variance into palette entries.'],
  er: ['TextHotspotRegion', 'TextHotspotWidget creates one rectangular region per line of hotspot markup, with a hotspot ID and link to the next line region.'],
  rf: ['SocialTabsPanel', 'Wraps a TabStrip whose pages are a caller-supplied primary page, Friends and Ignore, and lays out their controls.'],
  op: ['SpriteButtonPainter', 'Draws a three-sprite button strip with state-dependent tint and centered text.'],
  ri: ['BeveledTextPainter', 'TextWidgetPainter subclass adds a beveled frame for enabled widgets before drawing the inherited text.'],
  rp: ['PasswordFieldPainter', 'BeveledTextPainter subclass replaces displayed input text with one asterisk per character.'],
  mn: ['IconButtonPainter', 'Draws a beveled button, the shared pressed-state icon and a focus rectangle.'],
  ve: ['FullscreenErrorDialog', 'Dismissible modal selects a fullscreen unsupported/focus/timeout message from its reason token and adds a close button.'],
  hh: ['FullscreenFailureReason', 'Identity tokens selected by fullscreen failure handling and mapped to localized messages by FullscreenErrorDialog.'],
  fv: ['TooltipOverlay', 'Non-input-capturing overlay draws pointer-adjacent text, currency and rich-layout tooltips and clears stale tooltip state each tick.'],
  fg: ['QuickChatResolver', 'Empty resolver hook accepted by QuickChatPhraseCache; this export retains the type contract but no resolver operations.'],
  ka: ['GameQuickChatResolver', 'Resolver token passed when constructing the game Quick Chat phrase cache; no instance resolver operations survive in this export.'],
  ft: ['DateValidationMarker', 'Empty marker implemented by DateInputValidator; no methods are declared in this export.'],
  wo: ['AlternateKeyedLoginCredentials', 'Keyed credential variant selected by the credential factory alternate-mode flag and distinguished by its LoginKind token.'],
});
method('dk', 'a', '(I)V', 'releaseStatics', 'Clears this class static string and integer arrays under the original guard.');
method('dk', 'a', '(IIBLsj;)[Lut;', 'loadSpriteSheet', 'Ensures and decodes the archive sprite sheet and builds its Sprite array, returning null while unavailable.');
method('dk', 'a', '(IIIII)V', 'clipToGridCell', 'Computes the 52-by-75 cell rectangle with shared-border adjustments and applies its raster clip.');
method('mk', 'a', '(II)Ldk;', 'requestAchievementMask', 'Creates and queues an AchievementQuery, then sends the achievement-mask query packet.');
method('gf', 'a', '(B)V', 'readAchievementResponse', 'Decodes result arrays or acknowledgements for queued achievement queries/submissions, rejecting unmatched responses.');
method('te', 'a', '(ILii;B)V', 'writeAchievementSubmission', 'Writes the achievement/check-byte values and four tracking integers, appending CRC and backpatching packet length.');
method('wp', 'a', '(ILii;I)V', 'submitAchievement', 'Adds the submission to the outstanding deque and serializes it using the supplied opcode.');
method('pf', 'a', '(ILdl;B)V', 'writeLookupQuery', 'Writes the lookup-read discriminator and byte-sized table ID.');
method('rf', 'a', '(Lhr;IZ)V', 'writeLookupRecordUpdate', 'Writes the lookup-update discriminator, table ID, signed-smart record ID, four values, CRC and packet length.');
method('sm', 'a', '(B)V', 'readLookupResponse', 'Fills the next queued lookup query array or acknowledges the matching table/record update, rejecting unmatched responses.');
method('sm', 'a', '(I)V', 'releaseStatics', 'Clears this class static sprite/text and integer-table references.');
method('mp', 'a', '(IILsm;)V', 'writeHighScoreSubmission', 'Serializes the high-score record IDs, tracking integers and integer vector with CRC and byte length.');
method('pd', 'a', '(BILsm;)V', 'submitHighScore', 'Adds a high-score submission to its pending deque and writes its request packet.');
method('aa', 'a', '(BILmp;)V', 'writeBlobSubmission', 'Serializes optional blob bytes, appends CRC, stores that CRC on the pending submission and backpatches packet length.');
method('aa', 'c', '(I)J', 'millisSinceSessionStart', 'Subtracts the session start timestamp from the monotonic clock.');
method('ea', 'a', '(IIIB[Lut;I)V', 'drawNineSlicePanel', 'Draws clipped corners and tiled edges/center from a nine-sprite array, proportionally shrinking opposing borders when needed.');
method('ea', 'a', '(IIZIII)V', 'drawMatchTimer', 'Converts 50-Hz ticks to minutes/seconds and draws the countdown with its final-seconds pulse and blinking colon.');
method('ea', 'a', '(IB)V', 'showMessageDialog', 'Creates the shared MessageDialog for the supplied message index if no such dialog is already pending.');
method('er', 'a', '(BLea;)D', 'computeColorBoxVariance', 'Uses the RGB summed moments and squared moments to compute within-box color variance.');
method('er', 'a', '(BZ)V', 'drawContentTransition', 'Delegates to the shared ContentTransitionDialog draw hook with the supplied flag.');
method('rf', 'a', '(IIIIB)V', 'layout', 'Lays out the primary/friends/ignore tabs and their child controls within the supplied bounds.');
method('rf', 'a', '(II)Z', 'isPowerOfTwoOrZero', 'Tests (value & -value) == value, including zero according to the original predicate.');
method('rf', 'a', '(ILsj;Lsj;Lsj;)V', 'loadCharacterAnimations', 'Loads the player model variants, per-archetype action clips and cheering fan animations, then fills missing action slots from available archetypes.');
method('ve', 'a', '(BLjv;Ljava/lang/String;)Lwi;', 'addButton', 'Creates a sprite-backed text button, appends it below existing dialog content and refreshes layout.');
method('ve', 'p', '(I)V', 'dismiss', 'Clears the inherited open flag if the dialog is still open.');
method('ve', 'j', '(B)V', 'releaseStatics', 'Clears static text, layout and queue references under the original guard.');
method('fv', 'a', '(IB)I', 'loadSoundGroup', 'Loads all sound entries assigned to the group, returns percentage while incomplete and -1 after marking the group loaded.');
method('wo', 'a', '(Lot;Lgm;BI)V', 'drawFootballerOverlay', 'Projects a footballer position and draws an alpha sprite overlay at the current viewport scale and render mode.');
method('wo', 'a', '(Z)V', 'releaseStatics', 'Clears static strings and sprite references under the original guard.');
field('dk', 'e', '[I', 'resultValues', 'Integer array installed when the queued achievement query receives its response.');
field('dk', 'f', 'Z', 'complete', 'Initially false and set true before a completed query is unlinked.');
field('dl', 'e', 'I', 'tableId', 'Byte-sized lookup table identifier written by the lookup-read request.');
field('dl', 'f', '[I', 'resultValues', 'Destination array populated by the lookup response.');
field('hr', 'j', 'I', 'tableId', 'Lookup table identifier serialized as a byte and matched by the acknowledgement.');
field('hr', 'i', 'I', 'recordId', 'Lookup record identifier serialized as a signed smart and matched by the acknowledgement.');
field('mp', 'o', '[B', 'payload', 'Optional bytes serialized by the pending blob submission.');
field('mp', 'm', 'I', 'requestCrc', 'CRC extracted from the serialized blob request and retained for bookkeeping.');
field('er', 'i', 'I', 'hotspotId', 'Integer parsed from the hotspot markup and delivered to the click listener.');
field('er', 'g', 'I', 'x', 'Horizontal position of this line region within the text widget.');
field('er', 'm', 'I', 'y', 'Vertical position of this line region within the text widget.');
field('er', 'e', 'I', 'width', 'Width used for region hit testing and focus outlining.');
field('er', 'f', 'I', 'height', 'Height used for region hit testing and focus outlining.');
field('er', 'j', 'Ler;', 'nextLineRegion', 'Next text line belonging to the same hotspot.');
field('rf', 'b', 'Lkf;', 'tabs', 'The primary/Friends/Ignore TabStrip owned by this panel.');

Object.assign(classes, {
  aj: ['ThreadSleepSupport', 'Positive-duration sleep helper splits exact multiples of ten milliseconds into two sleeps, preserving the client timing workaround.'],
  dc: ['PortraitCacheOrder', 'Moves an entry of the 64-element PlayerPortraitCacheEntry array to the front without changing the relative order of earlier entries.'],
  h: ['QuickChatMenuBuilder', 'Recursively converts category definitions into CascadingMenu labels, shortcuts, nested categories and phrase actions.'],
  hv: ['GoalkeeperAiSupport', 'Owns the updateKeeperAI helper for keeper positioning and response decisions; unrelated static account/chat utilities remain in their original owner.'],
  kr: ['DisplayModeSupport', 'Enumerates the platform fullscreen modes into FullscreenDisplayMode records; unrelated moved UI/string helpers retain their original owner.'],
  nh: ['SpritePixelSupport', 'Static pixel operations cover HSV adjustment, sprite/ARGB conversion, downsampling and clipped/scaled blending.'],
  nj: ['MonotonicClock', 'Clock compensates for backward wall-clock changes and is used throughout the loop, networking and audio; unrelated moved static helpers remain.'],
});
method('aj', 'a', '(JI)V', 'sleepMillis', 'Sleeps for a positive duration, splitting multiples of ten into duration-1 and one millisecond sleeps.');
method('h', 'a', '(ILtc;Lhd;Lhd;Lhd;)Lbb;', 'buildCategoryMenu', 'Recursively creates category submenus and phrase items with descriptions and keyboard shortcuts, retaining special phrase IDs.');
method('h', 'a', '(I)Ltv;', 'getNewestChatMessage', 'Returns the last message in the active chat array, or null when there are no messages.');
method('h', 'a', '(Z)V', 'releaseStatics', 'Clears static strings, text tables and account/UI references under the original guard.');
method('hv', 'a', '(Lhu;I)V', 'initializeFadingChat', 'Sets the fading-chat font, remembers the newest message and creates its pending deque and six visible message slots.');
method('hv', 'a', '(ZLjava/lang/CharSequence;)Ljava/lang/String;', 'normalizeBase37Name', 'Encodes and decodes a name through the shared base-37 alphabet, returning an empty string if normalization fails.');
method('kr', 'a', '(BLbu;)[Lcl;', 'enumerateFullscreenModes', 'Waits for the platform display-mode task and converts each width/height/bit-depth/refresh-rate tuple into a mode record.');
method('kr', 'a', '([Ljava/lang/CharSequence;Z)Ljava/lang/String;', 'concatenate', 'Joins the complete character-sequence array through the shared slice-concatenation routine.');
method('nj', 'a', '(IIII)I', 'placePopupVertically', 'Places the popup below its anchor when it fits, otherwise above or against the bottom viewport edge.');
method('nj', 'a', '(ILjava/lang/String;Ljava/applet/Applet;)Ljava/lang/String;', 'readCookie', 'Calls the applet JavaScript cookie bridge and returns the trimmed value matching the requested cookie name.');
method('nj', 'a', '(ZI)V', 'drawActiveDialog', 'Draws the current shared dialog if one is present.');
method('ni', 'a', '(BLjava/lang/String;)[B', 'loadNamedResource', 'Reads the named file from the shared resource archive using an empty group name.');
method('ni', 'a', '(I)V', 'releaseStatics', 'Clears static text, sprite arrays, archive and social-panel references under the original guard.');
method('ni', 'a', '(IIII)Z', 'dispatchKeyInput', 'Routes key input to the active play area, debug console, save dialog or general UI in priority order.');
method('hr', 'a', '(I)V', 'releaseStatics', 'Clears static text, handler flags and multidimensional sprite-byte tables.');
method('ii', 'a', '(I)V', 'releaseStatics', 'Clears this class static text references under the original guard.');
method('ii', 'a', '(Lhn;I)V', 'applyAndQueueManagerAction', 'Applies the manager action to local club state and appends it to the pending action deque.');
method('ii', 'b', '(I)V', 'buildTrinketPreviewSprites', 'Creates a preview sprite for each trinket model and renders the model into it.');
method('mp', 'a', '(I)V', 'releaseStatics', 'Clears static sprite, text, archive-preloader, lookup-array and UI references under the original guard.');

method('as', 'a', '(F)F', 'pitchToAngularFrequency', 'Converts logarithmic pitch relative to 32.703197 Hz to angular frequency at the 22050-Hz synthesis rate.');
method('as', 'a', '(IIF)F', 'interpolateAngularFrequency', 'Interpolates filter-pole pitch between its two envelope endpoints and converts it to angular frequency.');
method('as', 'a', '(Liw;Lfq;)V', 'decode', 'Reads per-channel filter pairs, gain endpoints, alternate coefficient settings and optional envelope segments.');
method('mq', 'a', '()V', 'clear', 'Zeroes the all-pass delay buffer.');
method('tp', 'a', '()V', 'clear', 'Zeroes the comb delay buffer and its damped sample accumulator.');
method('qm', 'a', '()V', 'releaseNoteMasks', 'Drops the instrument-note mask table after sample preparation.');
method('qm', 'b', '()V', 'buildNoteMasks', 'Scans MIDI bank/program changes and positive-velocity note events to build a per-instrument 128-note use mask.');
method('rj', 'a', '(II[I)Lto;', 'getFlatVorbisSample', 'Resolves a flat archive ID to its unique group/file pair and delegates to budgeted Vorbis decoding.');
method('rj', 'a', '(I[IIB)Lto;', 'getSoundEffect', 'Returns a cached synthesized sound sample or loads/decodes it and deducts decoded bytes from the optional budget.');
method('rj', 'a', '(JI)Ljava/lang/String;', 'formatCookieExpiry', 'Formats the shared calendar date and time as the GMT timestamp used by settings cookies.');
method('rj', 'a', '(Ljava/lang/String;Ljava/lang/String;B[I)Lto;', 'getNamedSoundEffect', 'Resolves archive group/file names and retrieves the synthesized sound sample with an optional decoding budget.');
method('rj', 'a', '(Ljava/lang/String;ZLjava/lang/String;)Lto;', 'getNamedSoundEffect', 'Convenience named synthesized-sound lookup without a decoding budget.');
method('rj', 'a', '([IIII)Lto;', 'getVorbisSample', 'Uses a separate cache-key namespace for Vorbis samples, retains partial decoders across budget exhaustion and caches completed PCM samples.');
method('rj', 'b', '(II[I)Lto;', 'getFlatSoundEffect', 'Resolves a flat ID to its unique archive group/file pair and delegates to synthesized sound decoding.');
method('rs', 'a', '(I)I', 'readStatusMessage', 'Handles MIDI running status and system-exclusive lengths before decoding the event payload.');
method('rs', 'c', '()V', 'clear', 'Drops MIDI bytes and per-track offset, delta and running-status arrays.');
method('rs', 'd', '()V', 'markTrackDone', 'Sets the MIDI buffer cursor to -1 so saveTrackPosition marks the current track finished.');
method('rs', 'e', '()I', 'getTrackCount', 'Returns the per-track position-array length.');
method('rs', 'e', '(I)J', 'timeAtTick', 'Returns the tempo-adjusted time origin plus tick multiplied by current microseconds-per-quarter-note tempo.');
method('rs', 'f', '()Z', 'hasData', 'Reports whether MIDI source bytes are installed.');
method('pp', 'a', '(III[ILda;I)V', 'mixNoteFrames', 'Mixes a note span and handles periodic retrigger restarts, sample offsets and overlap fades when the custom mode is enabled.');
method('pp', 'a', '(ILda;B)V', 'skipNoteFrames', 'Advances a note span without output, recreating its sample stream when skipping crosses a retrigger boundary.');
method('cp', 'a', '(BIII)I', 'formationY', 'Selects the lineup slot base Y coordinate, applies the controlling-team slot adjustment and mirrors coordinates for the other pitch end.');
method('cp', 'a', '(I)I', 'pollResourceConnection', 'Pumps the archive manager and network responses, returning the resource connection handshake status while responses are not ready.');
method('cp', 'a', '(ILjava/lang/String;)Lwn;', 'pollAccountNameAvailability', 'Returns the completed name-availability response for the same query or starts a new pending query state.');
method('jk', 'b', '(I)Z', 'tryAcquireChatSendPermit', 'Applies the shared chat-send interval/backoff counter, resetting after thirty seconds and updating its timestamp on an allowed send.');

// The obfuscator moved independent static helpers between owners. A static
// owner's name describes its main retained role; each helper has its own name.
Object.assign(classes, {
  ad: ['LocalizedTextLoader', 'Loads the large indexed language pack into localized text fields; currency formatting and other moved static helpers remain.'],
  af: ['AuctionPriceLimits', 'Calculates the shared upper price bound used by AuctionSettingsDialog for reserve and buyout controls.'],
  ar: ['BrowserUiSupport', 'Notifies the browser resizing callback and paints the pointer-adjacent plain text tooltip.'],
  bk: ['CalendarSupport', 'Updates the shared calendar and returns Calendar.MONTH; unrelated shared chat/player references remain.'],
  bw: ['SceneSpriteFactory', 'Constructs positioned WorldDrawEntry sprites with optional mirroring and quarter-turn rotation.'],
  c: ['ClientPacketFlushSupport', 'Flushes the game packet buffer to its socket and sends idle keepalives, preserving connection-error handling.'],
  cb: ['PitchPurchaseSupport', 'Queues BuyPitchDialog for a selected pitch option; unrelated moved predicate and cached render state remain.'],
  cd: ['GuestLoginSupport', 'Exposes the guest-login flag used by LoginForm to decide whether populated credentials are required.'],
  di: ['SquadOrderSupport', 'Replaces queued squad-order swap actions with the current requested swap and applies it to local club state.'],
  ep: ['TutorialMessages', 'Holds the complete ordered tutorial narration string array and related localized text references.'],
  f: ['SpriteNumberPainter', 'Recursively draws decimal digits from the shared digit sprites and returns the following X position.'],
  g: ['GrayscalePaletteSupport', 'Initializes the sixteen-entry grayscale palette; unrelated shared layout references remain.'],
  gk: ['ChatComposeSupport', 'Stores the selected phrase, recipient name/key and chat type and enables the pending chat-send action.'],
  hp: ['ChatComposeMode', 'Sets the shared compose/input mode and refreshes the play-area input state.'],
  ic: ['RegistrationRequestState', 'Identity tokens used by the account-registration request state machine, distinct from name-check and transport states.'],
  ld: ['AccountInputValidationResult', 'Identity-valued result returned by account name, password and email validation helpers.'],
  r: ['ClientProtocolStage', 'Identity tokens used as the shared connection/login protocol stage, including the stages allowed to exchange session packets.'],
  vd: ['AccountNameCheckState', 'Identity tokens for the pending/completed account-name availability query; unrelated moved rendering helpers remain.'],
  vk: ['ArchiveReconnectSupport', 'Resets the archive handshake, swaps the current ports and chooses retry/error results from failure code and attempt count.'],
  vt: ['AsciiCharacterSupport', 'Tests membership in ASCII digit and upper/lower letter ranges.'],
  ws: ['AccountNameCharacterSupport', 'Rejects control characters and accepts ASCII alphanumerics plus the account-name whitelist tables.'],
  sd: ['SpriteBackgroundSupport', 'Fills transparent sprite background pixels while preserving transparent corners; unrelated protocol token and bit helper remain.'],
  eo: ['SoftwareDrawingSupport', 'Static sprite blits, palette/alpha conversion, raster effects, clipping and UI drawing helpers.'],
});
method('ad', 'a', '(IZI)I', 'approximateHypotenuse', 'Uses absolute components, dynamic scaling and a square-root lookup to approximate the vector length without overflowing the squared sum.');
method('ad', 'a', '(Lbb;B)V', 'showQuickChatMenu', 'Installs the supplied CascadingMenu into the active Quick Chat layout and enables its input state.');
method('af', 'a', '(Lup;I)I', 'maximumAuctionPrice', 'Returns five thirds of the player base price, with a minimum of thirty on the caller guard used by auction settings.');
method('ar', 'a', '(II)V', 'notifyBrowserResize', 'Invokes the applet JavaScript resizing callback, preserving the original swallowed bridge failure.');
method('ar', 'a', '(ILjava/lang/String;)V', 'drawPlainTooltip', 'Measures the tooltip, positions it within the viewport and draws its border, background and wrapped text.');
method('bk', 'a', '(I)I', 'currentMonthIndex', 'Updates the shared calendar from monotonic time and returns its zero-based month field.');
method('bw', 'a', '(IIZIIZ)Lak;', 'createSceneSprite', 'Copies the selected ARGB sprite, optionally reflects/rotates it and creates a positioned world draw entry of kind four.');
method('bw', 'a', '(JIJ)I', 'fixedRatio16', 'Divides the second long shifted left sixteen bits by the first long and converts the fixed-point ratio to int.');
method('bw', 'a', '(Z)V', 'releaseStatics', 'Clears static UI, text, sprite and array references under the original guard.');
method('c', 'a', '(II[I)Z', 'isBitSet', 'Tests the requested bit of an int-array bitset using a 32-bit word and bit offset.');
method('c', 'a', '(IZ)V', 'flushPackets', 'Sends queued bytes, emits an idle keepalive after ten seconds when requested and resets the outgoing cursor on completion or disconnection.');
method('ca', 'a', '(Lvc;I)V', 'enqueueAuctionBidDialog', 'Appends an AuctionBidDialog for the supplied auction item to the pending dialog deque.');
method('ca', 'a', '(ZC)Z', 'isNameSeparator', 'Recognizes ASCII space, nonbreaking space, underscore and hyphen.');
method('cb', 'a', '(Ljt;B)V', 'enqueueBuyPitchDialog', 'Appends a BuyPitchDialog for the supplied pitch option.');
method('cd', 'a', '(I)Z', 'isGuestLoginEnabled', 'Returns the flag checked by LoginForm before requiring username and password text.');
method('ck', 'a', '(Z)V', 'releaseStatics', 'Clears the shared prompt dialog, layout and text references under the original guard.');
method('cu', 'a', '(BLjava/lang/String;Liw;)I', 'writeHuffmanString', 'Encodes text to bytes, writes its uncompressed smart length, Huffman-compresses the data and returns bytes written.');
method('cu', 'a', '(ILsj;II)Z', 'decodeSpriteSheetFromArchive', 'Loads a group/file pair, decodes its sprite-sheet bytes and returns false while the file is unavailable.');
method('d', 'a', '(ZI)I', 'decelerateFixedVelocity', 'Moves the fixed-point value toward zero by 91750 and snaps magnitudes below 58982 to zero.');
method('di', 'a', '(IZI)V', 'swapSquadOrder', 'Removes trailing queued order-swap actions, creates the latest swap and applies/queues it.');
method('f', '$cfr$intArgs$a$8e2a9e3a0d15', '(IIIII)I', 'drawNumberDigits', 'Integer-guard bridge for recursive decimal sprite drawing; preserves the original overload and guard semantics.');
method('f', 'a', '(BIIII)I', 'drawNumberDigits', 'Draws the preceding decimal digits recursively, then the final digit with additive intensity, returning its right edge.');
method('f', 'a', '(Lsj;B)V', 'loadPitchMusicTracks', 'Loads the menu and park/beach/street/stadium ambience tracks and reports each loading step.');
method('f', 'a', '(B)V', 'releaseStatics', 'Clears the static text reference and preserves the original guard assignment.');
method('fa', 'a', '(I)V', 'releaseStatics', 'Clears static UI and text references under the original arithmetic guard.');
method('fa', 'b', '(I)V', 'closeQuickChat', 'Disables the Quick Chat overlay, resets its menu selection and updates related input state.');
method('fj', 'a', '(I)V', 'showLoadingProgressDialog', 'Clears the account modal stack, constructs the loading dialog when needed and displays it.');
method('fj', 'a', '(II)I', 'rotateLeftFourBits', 'Returns the input int rotated left by four bits.');
method('fj', 'a', '(Z)Ljava/lang/String;', 'readServerString', 'Reads a string from the incoming packet buffer on the valid guard path.');
method('fj', 'b', '(Z)V', 'releaseStatics', 'Clears static text under the original guard.');
method('g', 'a', '(Z)V', 'releaseStatics', 'Clears the static layout and integer-array references.');
method('g', 'b', '(Z)V', 'initializeGrayscalePalette', 'Builds sixteen packed RGB grayscale values at four-intensity-unit intervals.');
method('gk', 'a', '(Ljava/lang/String;IJIB)V', 'prepareChatSend', 'Stores the phrase ID, recipient name/key and message type and marks the chat action pending.');
method('hp', 'a', '(I)V', 'releaseStatics', 'Clears static strings under the original guard.');
method('hp', 'b', '(I)V', 'setComposeMode', 'Stores the requested input/compose mode and refreshes the play-area input state.');
method('ic', 'a', '(FFFFFBF)V', 'configureGameReverb', 'Creates the reverb wrapper if needed and sets its dry gain, stereo width, wet gain, input gain, damping and feedback.');
method('ic', 'a', '(ILjava/lang/String;ZLjava/lang/String;IZZI)V', 'drawCaptionedMessage', 'Measures a wrapped message, draws a rounded translucent panel and adds an optional centered or left-aligned caption.');
method('r', 'a', '(Z)V', 'disconnectAndLeaveFullscreen', 'Closes fullscreen/input resources, clears client UI state, sends a disconnect packet when connected and resets the connection.');
method('vd', 'a', '(I)V', 'releaseStatics', 'Clears the shared text and deque references under the original guard.');
method('vk', 'a', '(II)I', 'retryArchiveConnection', 'Resets archive handshake resources, swaps ports, updates the failure reason/attempt count and returns a terminal error or retry marker.');
method('vt', 'a', '(CZ)Z', 'isAsciiAlphanumeric', 'Accepts only ASCII digits, uppercase letters and lowercase letters, preserving the guard-dependent cleanup.');
method('ws', 'a', '(CB)Z', 'isAllowedAccountNameCharacter', 'Rejects ISO controls and accepts ASCII alphanumerics plus the two explicit whitelist arrays.');
method('sd', 'a', '(JJ)J', 'xor', 'Returns the bitwise XOR of two long values.');
method('sd', 'a', '(Lut;B)V', 'fillTransparentBackground', 'Changes zero pixels to the dark background color, then restores transparent corner pixels on the valid guard path.');
method('th', 'a', '(B)V', 'detachAllFadingSounds', 'Walks active fading sounds and detaches each retained sample stream from its mixer.');
method('th', 'b', '(B)I', 'currentYear', 'Returns the Date year adjusted from the legacy 1900 epoch.');
method('th', 'a', '(Z)V', 'releaseStatics', 'Clears static text, arrays and flags under the original guard.');
method('rr', 'a', '(IC)Z', 'isPrintableClientCharacter', 'Accepts printable ASCII, the upper Latin-1 range and the five extra supported display characters.');
method('rr', 'a', '(ILjava/lang/CharSequence;)I', 'parseDecimalInt', 'Delegates to the shared signed base-ten integer parser.');
method('rr', 'a', '([I[Lio;I)[Lio;', 'selectMenuButtons', 'Returns a new menu-button array by indexing the supplied button table with the requested indices.');

Object.assign(classes, {
  ck: ['TextPromptState', 'Holds the shared TextPromptDialog polled/drawn by the input overlay, together with related UI/text references.'],
  le: ['ExceptionTextSupport', 'Formats a Throwable and optional ClientException context into the compact stack-report string used by client error reporting.'],
  il: ['ClassDescriptorSupport', 'Resolves primitive descriptor letters or a class name through reflection; unrelated moved friend-list helpers retain their owner.'],
  of: ['FriendRemovalSupport', 'Validates a friend-removal request, removes the matching friend entry, updates display order and sends the name to the server.'],
  rr: ['TextEntrySupport', 'Printable-character checks, decimal parsing, recipient input and indexed menu-button selection helpers.'],
  ip: ['RasterGammaSupport', 'Initializes the shared high-exponent intensity lookup used by raster drawing.'],
  sk: ['LoadingProgressSupport', 'Throttles loading-stage progress updates, interpolates overall progress and paints the loading frame.'],
  so: ['AppletContextSupport', 'Returns the active applet or shell fallback used by browser/document/cookie bridges.'],
  ts: ['PitchCoordinateSupport', 'Selects and mirrors formation X positions; unrelated moved spinner and menu-hit-test helpers retain their owner.'],
  uq: ['ChatInputState', 'Enables shared text input and resets the compose mode used by the game input overlay.'],
  us: ['TutorialCaptionSupport', 'Draws the tutorial narration caption and exposes the shared caption/input counter.'],
  ph: ['AudioOutputSupport', 'Shuts down both PCM output services; unrelated moved panel drawing and state predicates remain.'],
  pi: ['PlayerMeshFactory', 'Extracts player archetype/appearance components and delegates to the player MeshData assembler.'],
  wk: ['ClubStateFactory', 'Creates a randomized five-player club roster for local modes and reapplies pending manager actions.'],
  wa: ['SpriteResourceSupport', 'Loads sprites by archive names, builds an ARGB ring sprite and manages related temporary raster state.'],
  vr: ['PitchSurfaceLoader', 'Loads the named park/beach/street surface sprite by tier and applies the special beach color adjustment.'],
  fh: ['SharedSpriteTables', 'Holds the optional per-category sprite tables consumed by layout drawing; text and a counter retain their original owner.'],
  nd: ['PitchBoundaryCacheState', 'Retains the last CommonGame identity used to avoid rebuilding the boundary camera lookup.'],
  jq: ['AuctionHelpResources', 'Holds the three reserve-price, buyout and duration help paragraphs; a private lookup and password message also retain this owner.'],
});
method('il', 'a', '(ILjava/lang/String;)Ljava/lang/Class;', 'resolveClassDescriptor', 'Returns primitive Class tokens for JVM descriptor letters and otherwise delegates to Class.forName.');
method('il', 'a', '(Ljava/lang/String;IB)Ljava/lang/String;', 'requestIgnore', 'Validates name/self/session/limit and existing-list constraints, then writes the ignore-list add packet or returns its localized error.');
method('le', 'a', '(ZLjava/lang/Throwable;)Ljava/lang/String;', 'formatCompactStackTrace', 'Unwraps ClientException context, prints the cause stack and condenses class/method/source-line entries into one report.');
method('le', 'a', '(Z)V', 'releaseStatics', 'Clears static text, pending blob deque and byte-table references.');
method('of', 'a', '(IBLjava/lang/String;)Ljava/lang/String;', 'requestFriendRemoval', 'Checks the session/name, removes a matching friend entry and updates ordering, then writes the removal request.');
method('of', 'a', '(Z)V', 'releaseStatics', 'Clears static text, layout-array and mesh references under the original guard.');
method('ip', 'a', '(Z)V', 'initializeIntensityLookup', 'Builds the 260-entry gamma/intensity table using exponent fifteen and fills the final four entries with 255.');
method('sk', 'a', '(II)V', 'drawActiveMatchTimer', 'Draws the current CommonGame phase timer with countdown pulsing enabled.');
method('sk', 'a', '(III)V', 'reportStageProgress', 'Limits updates to one per 25 ms, maps stage-local progress onto the overall range and paints the loading frame.');
method('sk', 'a', '(IILlv;)V', 'enqueueMessageDialog', 'Appends a message dialog for the supplied message index and optional popup card.');
method('sk', 'a', '(IIIILml;I)I', 'readFourRangeBits', 'Converts four bit widths to unsigned ranges and delegates to the two-bit-selector variable-width decoder.');
method('so', 'a', '(I)Ljava/applet/Applet;', 'getActiveApplet', 'Returns the stored applet when present, otherwise the game shell applet.');
method('ts', 'a', '(III)V', 'drawSpinnerSpokes', 'Draws opposing rotating spokes using fixed-point sine and cosine around the current raster center.');
method('ts', 'a', '(IIII)I', 'formationX', 'Selects the lineup-slot X coordinate, adjusts the controlling-team slot and mirrors for the opposite pitch end.');
method('ts', 'b', '(III)I', 'hitTestMenuRows', 'Walks the laid-out menu labels/spacers and returns the action ID of the row containing the pointer, or -1.');
method('uq', 'a', '(B)V', 'enableChatInput', 'Enables shared text input and resets compose mode to zero.');
method('ph', 'a', '(I)V', 'shutdownAudioOutputs', 'Shuts down both configured PCM player services if present.');
method('pi', 'a', '(IC)Z', 'isSpaceOrParenthesis', 'Recognizes the three formatting characters space, opening parenthesis and closing parenthesis.');
method('pi', 'a', '(IIILup;IZ)Lvn;', 'createPlayerMesh', 'Unpacks the archetype and three appearance components before delegating to the model-part assembler.');
method('pi', 'a', '(ILsp;)V', 'enqueueBuyPlayerDialog', 'Appends a BuyPlayerDialog for the selected shop slot.');
method('wk', 'a', '(I)V', 'applyPendingManagerActions', 'Applies every queued manager action to the live club state and clears the queue.');
method('wk', 'a', '(JI)V', 'setCalendarTime', 'Sets the shared calendar to the supplied millisecond timestamp.');
method('wk', 'a', '(ZZ)Lgr;', 'createLocalClub', 'Constructs five players with randomized names/appearance and the requested local-mode archetype/stat configuration.');
method('wa', 'a', '(BLjava/lang/String;)V', 'showTextTooltip', 'Stores tooltip text, selects the plain-text tooltip kind and marks it active for this tick.');
method('wa', 'a', '(BLjava/lang/String;Lsj;Ljava/lang/String;)Lut;', 'loadNamedSprite', 'Resolves the archive group/file names and delegates to the single-sprite decoder.');
method('wa', 'a', '(II)Lot;', 'createRingSprite', 'Draws a ring and radial spokes into a double-size scratch sprite, downsamples it and converts coverage into ARGB alpha.');
method('wa', 'b', '(B)V', 'clearTemporaryRaster', 'Zeroes the shared temporary raster buffer using the original eight-value loop.');
method('vr', 'a', '(IIB)I', 'loadPitchSurface', 'Loads a surface sprite by theme and tier, returning archive progress until ready and -1 once installed.');
method('vr', 'a', '(Ljava/applet/Applet;I)V', 'openServerList', 'Opens the applet code-base toserverlist.ws page in the top browser frame through the URL decorator.');
method('vr', 'b', '(B)V', 'enqueueTutorialChoice', 'Appends a TutorialChoiceDialog to the pending dialog queue.');
method('vb', 'a', '(ILjava/lang/CharSequence;)J', 'hashString31', 'Accumulates the text characters into a long hash using hash*31+character.');
method('vb', 'b', '(I)Z', 'hasSavedInputLayout', 'Reports whether the input UI has retained its prior layout while installing an alternate layout.');
method('vb', 'a', '(I)V', 'releaseStatics', 'Clears static string, sprite and byte-table references under the original guard.');
method('in', 'a', '(B)Z', 'hasInputPopup', 'Reports an active shared popup or Quick Chat overlay.');
method('in', 'a', '(ZI)V', 'buildSliderTrackSprites', 'Creates the four shared slider/progress track variants with the original colors and active-state flags.');
method('in', 'a', '(IIIZIII)Z', 'routePointerInput', 'Offers pointer input to the active menu/prompt/dialog layers, updating the consumed flag.');
method('ss', 'a', '(BIII)Z', 'routeKeyInput', 'Offers input to the active context menu, prompt, modal dialog and then the shared key dispatcher in that order.');

Object.assign(classes, {
  ds: ['ModelMaterialDecoder', 'Decodes the bit-packed material table at the start of the logo.fo3d model resource, including shared entries.'],
  gf: ['ModelMaterial', 'Material record from the packed FO3D table; retains the 24-bit color consumed when rasterizing model faces.'],
  gg: ['SocialPlayerRow', 'Shared named player row used by friend and ignore hash tables/deques, with list order and child text layouts.'],
  dr: ['ClassNameSupport', 'Shortens reflective class names and recursively formats array component types; unrelated moved input/UI helpers remain.'],
  mg: ['PlayerInputFactory', 'Constructs team-choice and held-key PlayerInputEvent objects; a rendered-footballer factory and other moved helpers retain this owner.'],
  ms: ['MusicVolumeSupport', 'Stores audio-volume settings and forwards the changed value to the active MusicTrackMixer.'],
  go: ['PitchProjectionSupport', 'Projects world Y into viewport Y and supports movement toward pitch targets; a moved color-box helper remains.'],
  in: ['UiInputRoutingSupport', 'Detects Quick Chat popups and routes pointer input through menus, prompts and dialogs.'],
  ss: ['UiKeyRoutingSupport', 'Routes keyboard input through active context menus, prompts, modal dialogs and general game UI.'],
  pc: ['DisplayNameUiSupport', 'Installs a new DisplayNameForm after closing any previous account request dialog.'],
  sh: ['LineupPositionSupport', 'Computes the fixed-point horizontal lineup slot coordinate used when staging players.'],
  qr: ['SessionUrlSupport', 'Decorates applet URLs with changed settings/session values and writes the client machine token; moved projection/raster helpers remain.'],
  th: ['FadingSoundSupport', 'Detaches active fading-sound playback streams; unrelated moved date and pixel helpers retain this owner.'],
  we: ['ClientUiUpdateSupport', 'Updates common client widgets and their input eligibility each tick; the fixed-angle cosine lookup retains this owner.'],
  wq: ['DiagnosticsOverlaySupport', 'Draws the optional memory/FPS/network/AI diagnostic panel and related debug state.'],
});
method('ds', 'a', '(Lml;B)[Lgf;', 'decodeMaterials', 'Reads the material-table version/count, decodes new entries or reuses prior entries by index.');
method('ds', 'a', '(II)I', 'messageButtonCount', 'Maps message/dialog IDs to their configured number of buttons.');
method('ds', 'a', '(ILbb;)V', 'attachQuickChatSubmenu', 'Adds the supplied cascading submenu to the shared Quick Chat container.');
method('gf', 'a', '(ILjava/lang/String;)Lld;', 'validateEmailParts', 'Rejects an empty address or missing separator, then validates the local and domain parts separately.');
method('gf', 'a', '(Lbu;IIIII)Lvq;', 'createFullscreenCanvas', 'Creates the fullscreen frame and installs a focus-listening canvas with the requested size.');
method('gf', 'a', '([BIII)Z', 'testUnlockMask', 'Kit-style and pitch selectors read an MSB-first unlock bit; access levels two or above bypass the mask.');
method('dr', 'a', '(ILjava/lang/Class;)Ljava/lang/String;', 'shortClassName', 'Formats array types recursively with [] suffixes and removes the package prefix from other reflective class names.');
method('dr', 'a', '(I)Lhd;', 'getActiveLayoutChild', 'Returns the active shared layout child on the valid guard path.');
method('mg', 'a', '(JJ)J', 'and', 'Returns the bitwise AND of two long values.');
method('mg', 'a', '(Lup;IIZIB)Lgm;', 'createRenderedPlayer', 'Builds a mesh from player appearance, wraps it in RenderedFootballer, selects its idle action and randomizes the animation position.');
method('ms', 'a', '(II)V', 'setMusicVolume', 'Stores the indexed volume setting and updates the active music mixer volume.');
method('ms', 'a', '(Ljava/lang/String;IIZII)V', 'drawMessagePanel', 'Draws the shared wrapped message panel without a caption.');
method('go', 'a', '(IB)I', 'worldToScreenY', 'Applies camera offsets and viewport scale to world Y, then adds the screen center.');
method('go', 'a', '(Lea;II[[[I)I', 'colorBoxLowerMoment', 'Returns the signed lower-face moment terms for the selected quantization-box axis.');
method('ig', 'a', '(BI)I', 'ceilPowerOfTwo', 'Rounds up by propagating the highest set bit; preserves the original zero and signed-overflow behavior.');
method('ig', 'a', '(II)I', 'screenToWorldY', 'Removes the screen center/viewport scale and applies camera Y offsets.');
method('ig', 'a', '(JLjava/lang/String;B)V', 'beginPrivateMessage', 'Sets recipient name/key, normalized lookup name and compose mode, then enables text input.');
method('ig', 'a', '(ZBII)V', 'moveTutorialPlayerToLineup', 'Moves the selected tutorial footballer toward the lineup staging edge and places it into its slot on arrival.');
method('pc', 'a', '(B)V', 'showDisplayNameForm', 'Closes any current account request dialog and installs a fresh DisplayNameForm.');
method('pc', 'b', '(I)V', 'releaseStatics', 'Clears static resource/text references while preserving the original guard assignment.');
method('ql', 'a', '(I)V', 'enqueueWelcomeDialog', 'Appends a WelcomeDialog to the pending dialog deque.');
method('ql', 'a', '(IB)I', 'alignToEight', 'Rounds the value up to the next multiple of eight, leaving aligned values unchanged.');
method('ql', 'a', '(Ljava/lang/String;II)Lav;', 'createSocketConnector', 'Constructs a ProxySocketConnector and installs its target host and port.');
method('ql', 'a', '([Ljava/lang/Object;Lsr;B)V', 'sortByCriterion', 'Sorts the full object array through the shared comparator-based range sorter.');
method('qr', 'a', '(I)V', 'clearSharedRaster', 'Zeroes the shared raster array using the original eight-value loop.');
method('qr', 'a', '(IB)I', 'screenToWorldX', 'Removes horizontal screen-center offset and viewport scale, then applies the camera X offset.');
method('qr', 'a', '(ILiw;)V', 'writeMachineToken', 'Writes the persisted 24-byte client token, using -1 bytes if reading an existing token fails validation.');
method('qr', 'a', '(Ljava/applet/Applet;Ljava/net/URL;I)Ljava/net/URL;', 'decorateSessionUrl', 'Adds changed settings/session values to the target applet URL through the shared URL decorator.');
method('qr', 'a', '(Z)V', 'releaseStatics', 'Clears static strings, arrays and layout references under the original guard.');
method('sh', 'a', '(II)I', 'lineupSlotX', 'Returns (320 + 70 * slot) shifted left sixteen bits.');
method('tn', 'a', '(Z)V', 'releaseStatics', 'Clears static text tables and social/UI references under the original guard.');
method('gg', 'a', '([Ljava/lang/String;B)V', 'setDivisionWinners', 'Copies the winner-name list and builds the singular/plural formatted division-winner announcement.');
method('gg', 'h', '(B)V', 'resetCameraToTarget', 'Copies the target camera position/scale, resets camera velocity and updates the fixed viewport scale.');
method('ld', 'a', '([[[I[[[I[[[D[[[I[[[IZ)V', 'buildSummedColorMoments', 'Converts the histogram weight, RGB and squared-moment cubes into three-dimensional summed-area tables.');
method('we', 'a', '(ZZBI)V', 'updateCommonClientUi', 'Updates common overlay/button input eligibility and handles their queued actions according to the current modal/input state.');
method('wq', 'a', '(B)V', 'drawDiagnostics', 'Draws enabled memory, FPS/loop-rate, participant latency and debug-mode diagnostics.');
method('wq', 'a', '(JI)J', 'increment', 'Returns the supplied long plus one, preserving the original arithmetic guard.');
field('gf', 'g', 'I', 'color', '24-bit material color retained by the FO3D decoder and read by model-face rendering.');
field('gg', 'Gb', 'Ljava/lang/String;', 'name', 'Current player name used to find the row in friend/ignore tables.');
field('gg', 'Cb', 'I', 'listIndex', 'Position assigned when inserting the row into the ordered social list.');

Object.assign(classes, {
  bq: ['MatchUiLayoutSupport', 'Lays out the shared match/chat controls, option rows and modal panel for the current viewport.'],
  br: ['KitUnlockNoticeSupport', 'Builds the locked-kit achievement requirement notice and inspects the shared dialog.'],
  ca: ['GradientRasterSupport', 'Blends a fixed-point RGB gradient span with the destination; unrelated moved auction and name helpers remain.'],
  cu: ['RankingRowFactory', 'Pools and initializes ranking rows with numeric or tied rank labels; moved codec and manager helpers remain.'],
  d: ['FixedVelocitySupport', 'Decelerates a fixed-point velocity; unrelated moved state-reset helper remains.'],
  ee: ['GameMediaSupport', 'Installs the shared Huffman codec, detaches the shared sound stream and draws a viewport-scaled sprite.'],
  et: ['ThumbnailStateFactory', 'Creates paired darkened/normal labeled thumbnail sprites from an input sprite.'],
  fa: ['PendingRequestAcknowledgement', 'Intrusive request record with a byte and short wire token; the response handler removes a pending record before consuming four response integers.'],
  fc: ['LoginResponseUiSupport', 'Updates login forms and messages for server response codes, including the display-name and guest paths.'],
  fj: ['ConsoleLexer', 'Tokenizes console text into quoted, punctuation and identifier/number expressions.'],
  fs: ['PanelSpriteFactory', 'Builds vertically shaded panel sprites; moved bit decoding, animation and footballer helpers remain.'],
  gs: ['SelectionMarkerSupport', 'Draws the four shared selection-marker sprites around the tracked position; unrelated moved UI helpers remain.'],
  gw: ['HuffmanTextSupport', 'Reads a bounded Huffman string from PacketBuffer; moved button drawing and UI/network helpers remain.'],
  hq: ['ClientInteractionSupport', 'Gates client interaction on the current state and modal conditions and dismisses Quick Chat.'],
  ig: ['MatchHudSupport', 'Draws match HUD information and handles pitch projections and player staging; unrelated arithmetic and chat helpers remain.'],
  ih: ['KitPatternMaskSupport', 'Decodes the two 13 by 10 kit-pattern grids consumed by the kit mesh recoloring helper; unrelated moved helpers remain.'],
  is: ['TextLineLayoutSupport', 'Computes character positions for a text layout line, including spacing and markup spans; moved auction/tick helpers remain.'],
  iv: ['SharedWidgetFactory', 'Constructs the shared scrollbars, menu panels and controls using a supplied bitmap font.'],
  jl: ['InputLayoutState', 'Retains the prior input layout while an alternate input layout is installed, along with moved resource state.'],
  lt: ['PlayAreaMovementSupport', 'Computes constrained movement within the supplied play areas.'],
  mi: ['ConsoleArgumentSupport', 'Finds an expression boundary by source position; moved Quick Chat composition and capability helpers remain.'],
  mt: ['GoalSpriteLoader', 'Checks and loads scenery/goal_top and scenery/goal_bottom into the shared goal sprites.'],
  mv: ['DefaultPlayerFactory', 'Constructs the default archetype-four player with balanced stats and trinket 110; moved context-menu helper remains.'],
  nc: ['LoginPacketSupport', 'Builds and sends the encrypted login packet with seed, machine token, flags and credentials.'],
  ns: ['NotificationPanelPositionSupport', 'Computes the shared vertical panel offset from the bottom of the 480-pixel viewport.'],
  oa: ['OverlayLayerSupport', 'Registers shared overlay layers and invokes shared widget painting and audio shutdown helpers.'],
  ok: ['Cp1252EncodingSupport', 'Encodes text into the client single-byte character set with explicit CP1252 extension mappings.'],
  oo: ['PlatformTaskState', 'Holds the shared PlatformTaskDispatcher and volatile repaint request flag alongside moved UI resources.'],
  pe: ['MeshPreviewSupport', 'Draws a model mesh into a sprite with the preview projection; moved loading, modal and area helpers remain.'],
  vp: ['MatchTextInputOverlay', 'Overlay active on match screens -1/-2 that draws blinking text input and routes keyboard interaction.'],
});
method('bq', 'a', '(BLjava/applet/Applet;)V', 'reloadAppletPage', 'Opens reload.ws in the current frame, preserving the document query and session URL decoration.');
method('bq', 'a', '(IZ)V', 'layoutMatchUi', 'Sizes and positions shared match controls, optional rows, chat area and modal panel from the viewport.');
method('br', 'a', '(BI)V', 'enqueueLockedKitNotice', 'Builds message 35 using the kit achievement name/requirement or the original default/member text.');
method('br', 'a', '(Z)V', 'releaseStatics', 'Clears static text references under the original guard.');
method('ca', 'a', '(IIIIIIIII[I)V', 'blendGradientSpanHalf', 'Adds fixed-point RGB gradient components to half of each masked destination pixel and advances the component accumulators.');
method('cu', 'a', '(ZIIIZZ)Lcf;', 'createRankingRow', 'Takes a row from the pool or allocates one, installs its rank fields and sets an equals label for a tied rank.');
method('ee', 'a', '(Lks;Z)V', 'installHuffmanCodec', 'Installs the supplied shared HuffmanCodec while preserving the original guard branch.');
method('ee', 'b', '(B)V', 'releaseSharedAudioStream', 'Detaches the shared stream from the PCM mixer and clears its associated references.');
method('ee', 'a', '(III)V', 'drawViewportScaledSprite', 'Projects the shared sprite through the viewport scale and offsets and selects its original blending path.');
method('et', 'a', '(ILjava/lang/String;Lut;I)[Lut;', 'createThumbnailStates', 'Creates two labeled thumbnail states, darkening the first and preserving the second at normal brightness.');
method('fa', 'a', '(IBILsj;)[Lut;', 'loadSpriteSheet', 'Decodes an archive sprite sheet and materializes the Sprite array, returning null while unavailable.');
method('fc', 'a', '(Ljava/lang/String;II)V', 'showLoginResponse', 'Updates account dialog status, guest retry text and display-name forms for the received login response.');
method('fj', 'a', '(ZLjava/lang/String;)Ltf;', 'tokenize', 'Splits console text into quoted tokens, parentheses, commas and identifier/number expressions.');
method('fs', 'a', '(ILgm;I)V', 'captureFootballer', 'Passes the rendered footballer to the active preview capture helper with the requested slot.');
method('gs', 'a', '(B)V', 'drawSelectionMarkers', 'Draws the four directional marker sprites around the tracked position when marker display is enabled.');
method('gs', 'b', '(I)V', 'drawWorldEntries', 'Draws each shared WorldDrawEntry in array order.');
method('gs', 'd', '(I)V', 'clearPlayerPreviewResource', 'Clears the shared player-preview resource while synchronized on its previous value.');
method('gw', 'a', '(I)V', 'createQuickChatKeysHelpPanel', 'Constructs the shared QuickChatKeysHelpPanel from its localized labels and style.');
method('gw', 'a', '(IBLiw;)Ljava/lang/String;', 'readHuffmanString', 'Reads a smart length bounded by the caller, decompresses and decodes the bytes, and preserves the Cabbage error result.');
method('gw', 'c', '(I)V', 'enqueueLeagueWinnerDialog', 'Adds a new LeagueWinnerDialog to the pending dialog queue.');
method('hq', 'b', '(B)V', 'dismissQuickChat', 'Closes Quick Chat if its shared active flag is set.');
method('ih', 'a', '(ILjava/lang/String;)[[[Z', 'decodeKitPatternMask', 'Expands hexadecimal nibbles least-significant bit first into two 13 by 10 boolean grids used to recolor the kit mesh.');
method('iv', 'a', '(IZLjava/lang/CharSequence;)Ljava/lang/String;', 'validateAccountName', 'Checks account-name length, normalization and separator runs, returning the original localized failure or null.');
method('iv', 'a', '(Lcn;B)V', 'createSharedWidgets', 'Builds shared menu panels, scrollbars and controls using the supplied font and sprite resources.');
method('iv', 'a', '(Z)V', 'releaseStatics', 'Clears the shared text and platform-task references under the original guard.');
method('lt', 'a', '(B)I', 'constantOne', 'Returns one on the valid guard path; used as the one-byte availability/read count in the login response handler.');
method('mi', 'a', '(I[Llk;I)I', 'findExpressionBoundary', 'Finds the first following expression whose source position exceeds the supplied character boundary.');
method('mi', 'a', '(JLjava/lang/String;BI[I)Z', 'beginPrivateQuickChat', 'Validates the recipient, stores its name/key and compose mode, builds and displays the appropriate Quick Chat menu.');
method('mi', 'a', '(Z)I', 'constantThree', 'Returns three for the ThreeCommand console result, retaining the original guard cleanup branch.');
method('mt', 'a', '(B)Z', 'ensureGoalSprites', 'Checks and loads the scenery goal_top and goal_bottom resources once both are available.');
method('mv', 'a', '(Z)V', 'releaseStatics', 'Clears the shared string on the original enabled guard.');
method('mv', 'b', '(Z)Lup;', 'createDefaultPlayer', 'Creates the archetype-four default player with power, speed and tackle 50 and trinket ID 110.');
method('nc', 'a', '(Lnu;BIZ)V', 'configureParticipantNamePanel', 'Stores the current game and panel mode, lowercases participant names and measures their font widths before laying out the panel.');
method('nc', 'a', '(ZZLps;II)V', 'sendLoginPacket', 'Writes the login seed, token, credentials, flags, applet value and encrypted blocks, backpatches length and flushes.');
method('ns', 'a', '(I)V', 'updateBottomPanelOffset', 'Sets the shared panel Y offset to 480 minus its height minus 21 under the valid guard.');
method('oa', 'a', '(BZ)V', 'drawSharedWidget', 'Draws the shared widget passes and tooltip at the origin.');
method('oa', 'b', '(I)V', 'shutdownSharedAudio', 'Runs the shared stream and audio cleanup helpers under the original guard.');
method('pe', 'a', '(B)I', 'getCommonUiLoadProgress', 'Reports staged completion of the commonui archive/index/font prerequisites, returning 100 when ready.');
method('pe', 'a', '(BLef;)V', 'setSharedAnimationFrameset', 'Installs the shared animation frameset on the valid guard path.');
method('pe', 'a', '(Leg;Lut;II)V', 'renderMeshPreview', 'Selects and clears the target sprite raster and draws the mesh at the preview projection before restoring drawing state.');

Object.assign(classes, {
  mj: ['PitchAppearanceSupport', 'Builds recolored pitch sprites and corner variants for the selected surface; moved projection and sound helpers remain.'],
  mk: ['TutorialScenerySupport', 'Builds the per-stage tutorial boundary polygons and scenery list; moved raster and bit-decoding helpers remain.'],
  or: ['FootballerAiOverlaySupport', 'Draws footballer AI bounds, target direction and wait timing; moved error and packing helpers remain.'],
  pg: ['SharedPanelFactory', 'Constructs shared social and modal panel trees; moved player-preview and prompt helpers remain.'],
  pl: ['GameOptionMenuSupport', 'Builds setup option menus while evaluating option dependencies and enabled choices.'],
  po: ['SocialRowOrderSupport', 'Orders social rows by list position and online/current-world status; moved screen and help helpers remain.'],
  pr: ['LeagueRatingRequirements', 'Holds league rating thresholds checked when describing promotion/rewards in GameOverView; unrelated moved UI state remains.'],
  ql: ['MatchHudRoutingSupport', 'Routes active match HUD drawing and welcome dialogs; unrelated moved sorting, socket and account helpers remain.'],
  qn: ['SharedChatLayoutSupport', 'Lays out the shared chat text/input area and its adjacent panel rows.'],
  sg: ['ByteArrayPoolState', 'Retains the 250-slot pool of 5000-byte arrays used by the shared byte allocator; unrelated moved layout/palette state remains.'],
  su: ['WidgetStyleFactory', 'Builds a widget with normal/hover/pressed style sprites and text properties; moved pricing, ranking and canvas helpers remain.'],
  te: ['QuickChatMenuFactory', 'Builds cascading Quick Chat menus from phrase IDs and display texts; moved sprite, protocol and configuration helpers remain.'],
  tl: ['ConsoleTokenParser', 'Parses identifier, boolean and numeric tokens from StringCursor; a moved high-score response handler remains.'],
  tn: ['SocialUiState', 'Holds the shared SocialTabsPanel and related layout/sprite state along with the localized social instructions.'],
  tt: ['SocialListProtocolSupport', 'Decodes friend/ignore list insertions, renames and connection state; a moved bitmap-font factory remains.'],
  uf: ['RegistrationUiSupport', 'Polls completed account registration responses and initializes shared UI resources; moved spinner/predicate helpers remain.'],
  ug: ['SocialListLayoutSupport', 'Lays out social player rows, name tooltips and context actions; moved projection and intrusive-node helpers remain.'],
  uk: ['SharedScrollbarState', 'Retains the shared VerticalScrollbar used by friend, squad and chat panels, alongside a protocol-stage sentinel.'],
  ul: ['TextInputUiSupport', 'Draws shared text/tutorial panels and forwards text-input updates; a moved indexed-sprite palette helper remains.'],
  um: ['MachineTokenStorageSupport', 'Persists the incoming 24-byte machine token and advances the packet offset even when storage fails.'],
  un: ['ByteArrayPool', 'Allocates bytes from the fixed 100/5000/30000-byte pools or configured extra pools before creating new arrays.'],
  vb: ['PitchDecorationSupport', 'Builds surface-specific world decoration sequences along the pitch; moved hashing and saved-layout helpers remain.'],
  vj: ['RasterGlowSupport', 'Adds a neighborhood-alpha glow to the software raster and blends constant-color spans; moved screen helpers remain.'],
});
method('fs', 'a', '(IIIIIB)[Lut;', 'createPanelSprites', 'Builds nine panel slices with fixed-color ends, vertical-gradient sides and optional center, restoring the previous raster.');
method('is', 'a', '(BLvc;)V', 'enqueueAuctionPurchaseDialog', 'Opens auction dialog mode 32 for the received item; its constructor formats the purchase price.');
method('is', 'a', '(I)V', 'tickWorldEntries', 'Ticks every shared WorldDrawEntry in array order.');
method('is', 'a', '(Lhu;Ljava/lang/String;Lqj;II)V', 'computeCharacterPositions', 'Measures each character prefix, adds fixed-point space justification and gives markup spans a shared position.');
method('is', 'b', '(I)V', 'releaseStatics', 'Clears the static layout, random and text references under the original guard.');
method('mj', 'a', '(BI)V', 'buildPitchSprites', 'Creates palette ranges and surface-tinted pitch sprites, including mirrored corners and clipped edge composites.');
method('mj', 'a', '(DIDD)V', 'setProjectionTarget', 'Stores the scaled projection target and reflects its coordinates across the pitch when the view is reversed.');
method('mj', 'a', '(I)V', 'releaseStatics', 'Clears the shared account-name-check state and preserves the invalid-guard assignment.');
method('mj', 'a', '(ZLvm;)V', 'detachSampleStream', 'Removes the supplied sample stream from the shared PCM mixer.');
method('mk', 'b', '(I)V', 'buildTutorialScenery', 'Builds boundary polygons and scenery sprites for the current tutorial stage, then installs the draw list.');
method('or', 'a', '(Lnu;IIB)V', 'drawFootballerAiOverlay', 'Draws the footballer movement region, target/route, allowed direction box and AI wait bar.');
method('or', 'a', '(Z)I', 'getKeyboardIdleTicks', 'Returns the volatile idle counter incremented by the client tick and reset by GameKeyHandler input.');
method('or', 'b', '(Z)V', 'compactFaceDepthBuckets', 'Compacts face-index buckets from their fixed stride of sixteen using each bucket recorded count before face rendering.');
method('pg', 'a', '(I)I', 'pollPromptAction', 'Processes prompt input and pointer selection, dismisses selected actions and handles the original timed default action.');
method('pg', 'a', '(IILup;II)Lgm;', 'createThrottledPlayerPreview', 'Limits preview creation to one per 80 milliseconds and builds the rendered player using the original eligibility predicate.');
method('pg', 'a', '(IZ)V', 'createSharedPanels', 'Builds social tabs and the shared modal panel hierarchy, then runs viewport layout.');
method('pg', 'a', '(ZI)[Ljava/lang/String;', 'getMessageButtonLabels', 'Selects the localized button-label array for the supplied message/dialog identifier.');
method('po', 'a', '(Lgg;BLgg;)Z', 'precedesSocialRow', 'Compares social list positions with the original current-world and offline weighting.');
method('po', '$cfr$intArgs$a$d1a766881558', '(Lgg;ILgg;)Z', 'precedesSocialRow', 'Full-integer guard bridge for the same social-row ordering predicate.');
method('po', 'a', '(IZ)V', 'updateQuickChatKeysHelp', 'Processes the active Quick Chat keys help panel and clears it when it completes.');
method('ql', 'a', '(BZ[I)V', 'drawMatchHud', 'Draws active match time and participant status, conditionally the score and the additional overlay.');
method('ql', 'a', '(ZLjava/lang/String;Ljava/lang/String;I)V', 'setAccountStatusText', 'Stores the two account status strings and enters their original client display state.');
method('qn', 'a', '(IIIIII)V', 'layoutChatAndSidePanels', 'Positions the chat input/text area and adjacent rows from the shared viewport and layout dimensions.');
method('sg', 'a', '(Z)V', 'releaseStatics', 'Clears the pool, palette, constants and layout references while preserving the recursive guard branch.');
method('su', 'a', '(BLup;)I', 'getReducedPlayerValue', 'Returns two thirds of the shared player value, with a minimum of ten.');
method('su', 'a', '(IBIIII)V', 'appendRankingStatistics', 'Appends ranking values and computes win share per thousand while updating the shared range values.');
method('su', 'a', '(IIILjava/awt/Canvas;)V', 'drawRasterToCanvas', 'Draws the shared raster onto Canvas Graphics, disposes the graphics and requests repaint on failure.');
method('su', 'a', '(IIIZILhu;IIIIIII)Lhd;', 'createStyledWidget', 'Builds a widget with five state sprite sets and the supplied font and text color.');
method('su', 'a', '(ILjava/lang/String;)Lkw;', 'createAvailabilityRequest', 'Constructs an AvailabilityCheckRequest for the supplied value.');
method('te', 'a', '(IIIZI)[Lut;', 'createSolidPanelSprites', 'Creates a nine-slice panel from shared solid-color edge sprites and an optional center sprite.');
method('te', 'a', '(ILhd;[ILhd;Lhd;)Lbb;', 'createPhraseMenu', 'Resolves phrase IDs to display text and numbered shortcuts and creates the cascading menu, returning null on lookup failure.');
method('te', 'a', '(Z)V', 'releaseStatics', 'Clears the static text and sprite references under the original guard.');
method('te', 'a', '(ZLjava/lang/String;)V', 'setLoginExtraText', 'Stores the optional text serialized into the login packet.');
method('tl', 'a', '(Lsb;Z)Llk;', 'readBareToken', 'Reads until whitespace or punctuation, classifies booleans/numbers/identifiers and retains the source position.');
method('tl', 'b', '(I)V', 'readHighScoreResponse', 'Matches the queued high-score query and decodes its ranked names and score tables into the response views.');
method('tt', 'a', '(B)V', 'readSocialListUpdate', 'Handles friend/ignore insertion, rename and connection-state packets, preserving lookup and list-order behavior.');
method('tt', 'a', '(I[B)Luo;', 'createBinaryFont', 'Builds a BinaryBitmapFont from font bytes and the shared decoded sprite metrics, then releases the temporary sprite data.');
method('tt', 'a', '(Z)V', 'releaseStatics', 'Clears static UI and sprite references under the original guard.');
method('uf', 'a', '(B)V', 'buildLoadingSpinnerSprites', 'Draws and rotates the six-segment spinner and downsamples each state into its shared ARGB sprite.');
method('uf', 'a', '(I)Lwn;', 'pollRegistrationResponse', 'Returns a completed registration response and resets its request state; rejects polling in the idle state.');
method('uf', 'a', '([[Lut;Lsj;[IZ[B[Lkg;Lsj;I[[Ljava/lang/String;[[Ljava/lang/String;Lsj;[B[Ljava/lang/String;I[Ljava/lang/String;[[Lut;[III[Ljava/lang/String;)V', 'initializeSharedUiResources', 'Passes loaded fonts, sprites, archives and localized tables to the shared UI construction helpers.');
method('ug', 'a', '(II)I', 'worldToScreenX', 'Reflects world X for a reversed view and applies the shared horizontal projection.');
method('ug', 'a', '(IIZ)V', 'layoutSocialRows', 'Updates the social list viewport and each named row, tooltip, context action and remove/add prompt.');
method('ug', 'a', '(Lgn;ILgn;)V', 'insertNodeBefore', 'Unlinks the supplied intrusive node if necessary and splices it between the given node and its previous node.');
method('ul', 'a', '(BLjava/lang/String;)V', 'drawTutorialCaptionPanel', 'Draws the tutorial caption background and active footballer portrait with the original clipping and style.');
method('ul', 'a', '(IIIZBIIIILjava/lang/String;)V', 'drawWrappedTextPanel', 'Measures and draws wrapped text with optional rounded translucent background and outline.');
method('ul', 'a', '(Lkg;B[I)Lkg;', 'copyWithPalette', 'Creates an indexed-sprite view sharing the original pixels and dimensions but using the supplied palette.');
method('ul', 'a', '(ZIIZ)V', 'updateTextInput', 'Forwards shared text-input geometry and enabled state to the text-entry handler.');
method('um', 'a', '(B)V', 'storeMachineToken', 'Writes the next 24 packet bytes to the token file when available and always consumes the token bytes.');
method('un', 'a', '(IZ)[B', 'allocateBytes', 'Reuses an exact-size array from the fixed or configured pools, clearing the consumed slot, or allocates a fresh array.');
method('un', 'a', '(Lnu;II)V', 'setActiveMatch', 'Installs the active match/player index and clears the four shared per-player counters.');
method('vb', 'a', '(Z)V', 'buildPitchDecorations', 'Builds world sprite sequences for the selected surface and decoration mode, retaining the original random placement.');
method('vj', 'a', '(I)V', 'applyRasterGlow', 'Adds an RGB glow derived from the mean center/neighbor alpha with the original saturated-add arithmetic.');
method('vj', 'a', '(IZ)V', 'returnToPreviousScreen', 'Closes the game modes help state if active and switches to the stored previous screen.');
method('vj', 'a', '([IIIII)V', 'blendConstantSpanHalf', 'Adds a constant color to half the masked source pixels over the supplied array span.');
method('br', 'a', '(I)Z', 'handleSharedPromptKey', 'Forwards the current typed key to the shared name-entry prompt when present, returning whether it handled input.');
method('gw', 'a', '(IIIII[Lut;)V', 'drawThreeSliceStrip', 'Draws the left and right caps and clips/tiles the center sprite across the remaining width with the supplied draw parameter.');
method('ig', 'a', '(ZII)V', 'drawControlLegend', 'Measures and draws the selected control-name and key-label columns with a translucent rounded background.');
method('ig', 'b', '(II)V', 'drawNumericRewardPanel', 'Draws the shared numeric total and signed change with digit sprites and localized positive/negative labels.');
method('mv', 'a', '(B)V', 'buildSharedContextActions', 'Adds the configured context actions with IDs one and two and their shared heading.');
method('mv', '$cfr$intArgs$a$6121ff5511c4', '(I)V', 'buildSharedContextActions', 'Full-integer guard bridge for the same configured context actions.');
method('po', 'a', '(Ljs;I)I', 'getScreenPanelWidth', 'Returns the configured panel width for each screen ID, including zero for match/tutorial screens.');
method('tl', 'a', '(I)I', 'getMouseIdleTicks', 'Returns the idle counter incremented by the client tick and reset by mouse interaction.');
method('ul', 'b', '(I)V', 'updateTutorialMarker', 'Positions the tutorial marker at the ball, relevant footballer or fixed stage target according to the current tutorial stage.');
method('vp', 'a', '(II)V', 'setRenderDetail', 'Changes the detail setting and builds or clears per-archetype, animation-frame and direction mask caches while reporting progress.');
method('vp', 'a', '(IIB)I', 'hitTestPairedControls', 'Returns zero or one when the pointer lies in either shared control rectangle, otherwise minus one.');
method('vp', 'b', '(B)V', 'releaseStatics', 'Clears the shared resource and localized text references under the original guard.');
method('vp', 'b', '(I)Z', 'isMatchInputActive', 'Reports the shared input-enabled flag while either match screen -1 or -2 is shown.');
method('vp', 'c', '(I)V', 'clearSharedMouseHandler', 'Clears the shared MouseInputHandler while synchronized on its previous instance.');

// Account controls and the shared helpers retained on their original owners.
method('Kickabout', 't', '(I)V', 'prepareAccountChoiceSprites', 'Adds the vertical tint to the account-choice sprite and creates its horizontal reveal mask and scratch sprite.');
method('ae', 'a', '(B)V', 'releaseStatics', 'Clears static registration text, sprite and login-method resources under the original arithmetic guard.');
method('ae', 'a', '(ILjava/lang/String;IILfd;)I', 'addCaptionedField', 'Adds a CaptionedContainer around the supplied widget and returns its laid-out height.');
method('ae', 'a', '(ILjava/lang/String;ILfd;B)I', 'addValidatedField', 'Adds a captioned field and an aligned ValidationIndicator bound to its validation provider.');
method('ae', 'a', '(IZLjava/lang/String;Lfd;ILjava/lang/String;I)I', 'addFieldWithValidationHelp', 'Adds a captioned field and validation-help widget, registers this panel as listener and returns their combined height.');
method('ae', 'a', '(Lfd;Ljava/lang/String;IIILjava/lang/String;)I', 'addFieldWithValidationHelp', 'Delegates to the enabled captioned-field/help builder while preserving the original guard.');
method('ae', 'm', '(I)V', 'tickSharedUiTimers', 'Decrements the pending shared UI timers in priority order and invokes their original layout/update helpers.');
method('bv', 'a', '(IIIIILhe;Lnp;)V', 'showLobbyPlayerContextMenu', 'Builds the player context actions for the supplied lobby row and opens and positions the resulting menu.');
method('bv', 'a', '(Lob;II)V', 'captureBallAfterimage', 'Selects the oldest afterimage entry and captures the rendered ball into it.');
method('bv', 'c', '(B)V', 'clearCachedName', 'Clears the name cached by this availability validator on the valid guard path.');
method('bv', 'g', '(I)V', 'releaseStatics', 'Clears the shared arrays and resource/text references under the original guard.');
method('gp', 'a', '(BLjava/lang/String;)Lld;', 'validateEmailLocalPart', 'Validates the email local part, including its 64-character limit, quoted form, escapes and non-repeated interior dots.');
method('gp', 'a', '(BLjava/lang/String;ZLjava/lang/String;Lae;ILjava/lang/String;)Z', 'beginAccountRegistration', 'Opens the request dialog and installs the registration fields/state only while the registration subsystem is idle.');
method('gp', 'a', '(IIIILjava/lang/String;Ljava/lang/String;)V', 'sendChatPacket', 'Writes the chat mode and optional recipient plus either Huffman text or a short phrase identifier, then backpatches packet length.');
method('gp', 'a', '(Lup;I)I', 'calculatePlayerValue', 'Calculates player value from the overall stat level, trinket prices and the original quadratic high-level formula.');
method('gp', 'a', '(ZB)V', 'drawSharedTextPanel', 'Draws the shared text panel and its optional date-of-birth widget passes/tooltip.');
method('gp', 'b', '(B)V', 'serviceAudioOutputs', 'Services both shared audio outputs and periodically unlinks sound handles whose owners are no longer linked.');
method('gp', 'c', '(I)V', 'releaseStatics', 'Clears the retained integer array under the original arithmetic guard.');
method('nn', 'a', '(I)V', 'showEmptyLoginForm', 'Opens the shared LoginForm with an empty initial name and no secondary value.');
method('nn', 'k', '(I)V', 'releaseStatics', 'Clears account-choice sprites and text tables under the original guard.');
method('pd', 'a', '(B)V', 'drawAnimatedPitchEdges', 'Draws the paired animated pitch-edge sprites along four positions using the current world projection.');
method('pd', 'a', '(Lut;I)V', 'tintSpriteForSurface', 'Applies the selected surface HSV adjustment to the supplied sprite unless the default surface is selected.');
method('pd', 'k', '(I)V', 'releaseStatics', 'Clears the static array, random, token-file and localized-label references.');
method('ps', 'a', '(BI)I', 'highestOneBit', 'Propagates the bits below the input highest set bit and masks them away, preserving zero and negative-input behavior.');
method('ps', 'a', '(I)Z', 'ensureLoginPayloadAvailable', 'Resolves the pending login payload length from one or two bytes and waits until its complete body is available.');
method('ps', 'a', '(IZZZZZZ)V', 'setTutorialRestrictions', 'Stores the inverse of six supplied action-permission booleans on the active tutorial CommonGame.');
method('ps', 'b', '(I)V', 'releaseStatics', 'Clears shared sprite, deque and text resources under the original guard.');
method('r', 'a', '(B)Z', 'isLoginResponseStage', 'Recognizes the three protocol stages for login result, login details and post-login completion.');
method('r', 'a', '(II)I', 'getChatFilterValue', 'Selects one of the three shared chat filter settings by chat category.');
method('vd', 'a', '(B)Z', 'canShowQueuedDialog', 'Allows queued dialogs at match game-over or outside match/help screens, excluding screen -5.');
method('vd', 'a', '(II)V', 'advanceLoadingStep', 'Advances the shared loading step, chooses a random loading tip and refreshes the progress display.');
method('wn', 'a', '(B)Z', 'isHalloweenAppearanceEnabled', 'Requires both the Halloween calendar window and the shared seasonal appearance option.');
method('ui', 'a', '(Ljava/lang/String;BLjava/lang/String;)V', 'showLoginForm', 'Closes the existing account request dialog, constructs LoginForm with the supplied initial fields and installs it.');
method('ui', 'a', '(Z)V', 'releaseStatics', 'Clears the received-auction-item array under the original guard.');
method('ui', 'g', '(I)Lv;', 'getOldestAfterimage', 'Returns the shared EntityAfterimage entry with the least remaining lifetime, using the original tie order.');

method('ae', 'a', '(ZBIII)Lut;', 'createButtonStateSprite', 'Builds a button from its cap/tile sprites or fixed template and applies the requested normal, bright, translucent or dark state.');
method('bv', 'a', '(Z[II)V', 'quantizeColors', 'Builds summed RGB moments, repeatedly splits the highest-variance color box and replaces input colors with their box means.');
method('ag', 'a', '(II)Lhd;', 'createSpriteBackedWidget', 'Constructs a layout node with the supplied long key and shared sprite-state background.');
method('ai', 'a', '(I)Z', 'canAutoResizeCanvas', 'Reports whether the shared canvas resize policy exists and supports automatic resizing.');
method('ai', 'a', '(II)I', 'screenToWorldX', 'Converts screen X to world X and reflects across the pitch when the view is reversed.');
method('ai', 'k', '(I)Ljava/lang/String;', 'linkStylePrefix', 'Returns the underlined blue markup prefix used for the account terms links.');
method('ai', 'm', '(I)Ljava/lang/String;', 'linkStyleSuffix', 'Returns the matching closing color/underline markup for the account terms links.');
method('ai', 'l', '(I)V', 'releaseStatics', 'Clears shared terms text, sprite, player and layout references under the original guard.');
method('al', 'a', '(I)V', 'releaseStatics', 'Clears the static text and surface-color table under the original guard.');
method('al', 'a', '(IIIIIIII)V', 'setBoundsAndUpdateRows', 'Installs the panel rectangle and forwards row/input geometry to its original update helper.');
method('al', 'a', '(ZB)I', 'getHudOpacity', 'Computes HUD opacity from viewport scale, using the original full-opacity override when requested.');
method('am', 'a', '(JB)V', 'setSecondaryKey', 'Stores the secondary key only while the node is absent from the secondary linked list.');
method('am', 'e', '(I)V', 'releaseStatics', 'Clears static arrays, sprites, text and deque references under the original guard.');
method('ao', 'a', '(I)V', 'close', 'Closes the backing RandomAccessFile if present and clears its reference.');
method('ao', 'a', '(IJ)V', 'seek', 'Seeks the backing RandomAccessFile and updates its tracked absolute position.');
method('ao', 'a', '(ZLjava/awt/Component;)V', 'detachMouseListeners', 'Removes the shared mouse, mouse-motion and focus listeners from the supplied component and resets button state.');
method('ao', 'c', '(I)J', 'length', 'Returns the backing RandomAccessFile length while retaining the original guard branch.');
method('ap', 'a', '(Z)V', 'releaseStatics', 'Clears the shared match sprites and login-kind reference under the original guard.');
method('aq', 'a', '(JJ)J', 'bitwiseOr', 'Returns the bitwise OR of two long values.');
method('aq', 'c', '(B)V', 'installMusicRootStream', 'Installs the shared MusicTrackMixer as the audio output root stream.');
method('au', 'b', '(Los;)B', 'readByte', 'Reads eight bits from the Bzip2 bitstream and narrows the result to a byte.');
method('au', 'e', '(Los;)B', 'readBit', 'Reads one bit from the Bzip2 bitstream.');
method('aw', 'g', '(B)Lrg;', 'createMouseWheelInput', 'Reflectively creates the AWT mouse-wheel implementation and preserves the null fallback when unavailable.');
method('aw', 'h', '(B)V', 'releaseStatics', 'Clears shared tutorial-choice text and sprite references under the original guard.');
method('b', 'c', '(II)I', 'worldToScreenX', 'Applies the current camera X offset and fixed viewport scale and adds the screen center.');
method('ba', 'a', '(IIIB)[Lut;', 'createPanelSprites', 'Delegates to the shared solid-color nine-slice panel factory using the original edge-width setting.');
method('ba', 'a', '(IZ)V', 'drawModalOverlay', 'Optionally darkens the full raster and draws the active modal widget and tooltip when modal input is available.');
method('ba', 'c', '(B)V', 'releaseStatics', 'Clears the shared mesh and text references under the original guard.');
method('bb', 'b', '(I)V', 'releaseStatics', 'Clears shared Quick Chat text, color-index and layout references under the original guard.');
method('bd', 'a', '(IZI)I', 'multiplyFixed16', 'Multiplies two signed 16.16 values using split high/low terms and preserves the original integer overflow behavior.');
method('be', 'a', '(II)Lhd;', 'createSpriteBackedWidget', 'Builds a layout node using the shared sprite-state set selected by the caller.');
method('be', 'a', '(III)Lhd;', 'createSizedSpriteWidget', 'Builds a layout node with the requested sprite-state dimensions.');
method('be', 'a', '(ILjava/lang/Object;)V', 'print', 'Converts the value to text, using the literal null for a null object, and forwards it to console output.');
method('be', 'a', '(Ljava/lang/String;B)V', 'print', 'Prints a console line in the original light-gray color.');
method('be', 'b', '(II)Lhd;', 'createDefaultSpriteWidget', 'Builds a layout node using the default-height sprite-state set.');
method('be', 'c', '(B)V', 'toggleConsole', 'Toggles the console visibility, resets its opening timer and updates keyboard focus.');
method('be', 'e', '(B)Z', 'isHalloweenPeriod', 'Tests the original October 28 through November 11 inclusive calendar window.');
method('bf', 'a', '(BI)I', 'getPlayerDisplayY', 'Returns the assigned player-slot screen Y or the reserve-grid row Y if the player is not assigned.');
method('bf', 'a', '(IIB)Lhd;', 'createLineupPositionWidget', 'Projects the configured lineup point into a 52 by 75 layout rectangle.');
method('bf', 'g', '(II)I', 'findPlayerSlot', 'Finds a participant-owned lineup slot matching the selected player, preserving the alternate ID/index paths.');
method('bf', 'h', '(II)I', 'getPlayerDisplayX', 'Returns the assigned player-slot screen X or the reserve-grid column X if the player is not assigned.');
method('bf', 'i', '(II)V', 'selectLineupPlayer', 'Enqueues the selected lineup event and sends the selected player ID for the original online path.');
method('bp', 'a', '(ZI)V', 'setScrollOffset', 'Sets the table content vertical offset on the enabled guard path.');
method('bp', 'a', '([Lim;I)V', 'setRows', 'Forwards the complete supplied row array to the table row installer.');
method('bp', 'b', '(I)I', 'getSortColumnIndex', 'Returns the current sorting column index.');
method('bp', 'b', '(II)V', 'cycleColumnSort', 'Cycles the selected column sort direction and applies that criterion.');
method('bp', 'c', '(Z)V', 'releaseStatics', 'Clears the shared localized text reference under the original guard.');
method('bp', 'h', '(B)I', 'getScrollOffset', 'Returns the content vertical offset under the original arithmetic guard.');
method('bp', 'i', '(B)I', 'getFirstVisibleRow', 'Converts the absolute content offset to a row index using row height plus spacing.');
method('bp', 'j', '(B)I', 'getSortDirection', 'Returns the active criterion direction, or zero when no sortable column is selected.');
method('bh', 'a', '(B)I', 'available', 'Returns the backing input-stream availability, or zero when the socket is closed.');
method('bh', 'b', '(I)I', 'readByte', 'Reads one byte from the backing input stream, preserving the original closed-socket result.');
method('bj', 'a', '(Ljava/lang/String;I)Ljava/io/File;', 'getCacheFile', 'Resolves the file with the shared cache namespace and version.');
method('bj', 'a', '(Ljava/lang/String;Ljava/lang/String;IZ)Ljava/io/File;', 'getCacheFile', 'Resolves the cache namespace/file through the launcher cacheRedirect hook.');
method('bm', 'd', '(Z)V', 'releaseStatics', 'Clears auction-listing text and protocol-stage references under the original guard.');
method('bo', 'a', '(BZ)Z', 'updateAndCheckDismissed', 'Updates help-panel input and reports its original outside-click or close-control dismissal condition.');
method('bo', 'a', '(I)V', 'releaseStatics', 'Clears the shared archive, sprite and text references under the original guard.');
method('ce', 'a', '(CBI)Ljava/lang/String;', 'repeatCharacter', 'Constructs a string containing the supplied character repeated the requested number of times.');
method('ce', 'g', '(I)V', 'releaseStatics', 'Clears static buy-player text and resource references under the original guard.');
method('cf', 'a', '(I)V', 'releaseStatics', 'Clears the shared label and UI references under the original arithmetic guard.');
method('cf', 'c', '(Z)V', 'recycle', 'Resets this ranking row and appends it to the shared row pool.');
method('cf', 'h', '(B)V', 'reset', 'Clears row readiness and the retained text/widget references under the original guard.');
method('cj', 'a', '(B)Ll;', 'getValidationSource', 'Returns this date input validation source on the valid guard path.');
method('cj', 'a', '(I)V', 'releaseStatics', 'Clears static date-input strings and sprites under the original guard.');
method('cj', 'a', '(Lhl;I)V', 'setValidator', 'Installs the date validator and links it back to this date input widget.');
method('cm', 'a', '(II)V', 'setTargetFrameRate', 'Converts the supplied frame rate into the shared nanosecond frame duration.');
method('cm', 'a', '(ZI)I', 'bitLength', 'Computes the unsigned bit length using successive shifts, returning zero for zero and 32 for negative integers.');
method('cm', 'b', '(IB)B', 'incrementByte', 'Adds one to the byte value using the original narrowing wraparound behavior.');
method('cm', 'o', '(I)V', 'releaseStatics', 'Clears the retained integer array on the valid guard path.');
method('ct', 'a', '(B)V', 'refreshChildLayout', 'Refreshes the current child layout when a child is installed.');
method('ct', 'a', '(I)Lfd;', 'findFocusedChild', 'Returns the wrapped child only when it has focus, retaining the original fallback guard behavior.');
method('ct', 'a', '(III)I', 'floorMod', 'Computes the original nonnegative-modulus remainder for positive and negative dividends.');
method('ct', 'j', '(I)V', 'releaseStatics', 'Clears static layout and text resources under the original guard.');
method('da', 'b', '(I)V', 'closePlayerContextMenu', 'Clears the shared player menu and scroll context, releasing its linked menu owner flag when present.');
method('dd', 'a', '(II)V', 'setFrame', 'Selects the clip frame and resets its elapsed interpolation time.');
method('dd', 'a', '(Lnm;B)V', 'setClip', 'Resets playback, installs the clip and initializes its frame, duration and sentinel state.');
method('dd', 'a', '(Z)I', 'frameCount', 'Returns the active clip frame count on the valid guard path.');
method('dd', 'b', '(Z)V', 'reset', 'Resets frame, elapsed time and playback counters under the original guard.');

method('bu', '$cfr$sneakyThrow', '(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;', 'rethrowUnchecked', 'Preserves the generated generic throwable-rethrow helper without wrapping or replacing the thrown object.');
method('bu', 'a', '(BIILjava/awt/Component;)Lwu;', 'requestMouseMove', 'Queues task 14 with coordinates translated from the supplied component to screen coordinates.');
method('bu', 'a', '(BLjava/awt/Frame;)Lwu;', 'requestExitFullscreen', 'Queues task 7 to restore the display mode and release fullscreen for the supplied frame.');
method('bu', 'a', '(BLjava/awt/datatransfer/Transferable;)Lwu;', 'requestClipboardWrite', 'Queues task 19 to install the supplied transferable into the system clipboard.');
method('bu', 'a', '(IBLjava/lang/Runnable;)Lwu;', 'requestThreadStart', 'Queues task 2 to start a daemon thread with the requested priority.');
method('bu', 'a', '(ILjava/awt/Component;Z)Lwu;', 'requestCursorVisibility', 'Queues task 15 with the supplied component and cursor-visibility boolean.');
method('bu', 'a', '(Ljava/lang/String;ZII)Lwu;', 'requestSocketOpen', 'Queues a direct or proxy-aware socket-open task for the supplied host and port.');
method('bu', 'a', '(ZLjava/lang/String;I)Lwu;', 'requestSocketOpen', 'Delegates to the direct socket-open request for the supplied host and port.');
method('bu', 'b', '(Z)Lwu;', 'requestDisplayModes', 'Queues task 5 to enumerate supported display modes.');
method('de', 'a', '(I)V', 'releaseStatics', 'Clears static keyboard text and resource references under the original guard.');
method('de', 'a', '(Lsj;Lsj;B)V', 'setSharedUiArchives', 'Installs the pair of shared UI archive references on the valid guard path.');
method('cm', 'a', '(BIII)V', 'animateResize', 'Resizes immediately for a nonpositive duration or records the initial and target dimensions for the animated resize.');
method('cm', 'n', '(I)V', 'onResizeFinished', 'Completion hook invoked by immediate transition completion and the final animated resize step.');
method('cm', 'a', '(I)Z', 'finishAnimationAndCheckClosed', 'Finishes the size transition before delegating to the modal fade/closed-state check.');
method('ub', 'a', '(I)Z', 'finishAnimationAndCheckClosed', 'Snaps opacity to its current target and reports whether the modal is inactive with zero opacity.');
method('ub', 'a', '(B)V', 'releaseStatics', 'Clears the shared indexed sprites and text reference under the original arithmetic guard.');
method('ub', 'a', '(BII)V', 'setCenteredSize', 'Sets the modal dimensions and centers it inside the shared available viewport.');
method('ub', 'a', '(IBJ)J', 'rotateLeftLong', 'Rotates the long value left by the supplied distance using Java shift-distance masking.');
method('ub', 'b', '(Z)I', 'targetOpacity', 'Returns full opacity only for the active topmost modal, otherwise zero.');
method('ub', 'h', '(B)Lkg;', 'takeDecodedIndexedSprite', 'Builds an IndexedSprite from the first decoded sprite record and releases the shared decode buffers.');
method('ub', 'i', '(B)[Lut;', 'takeDecodedSprites', 'Expands decoded indexed pixel bytes through the shared palette into Sprite objects, then releases the decode buffers.');
method('ew', 'a', '(BJ)V', 'seek', 'Sets the logical file offset after rejecting negative positions, without eagerly seeking the underlying file.');
method('ew', 'a', '(I)J', 'length', 'Returns the buffered file logical length under the original arithmetic guard.');
method('ew', 'c', '(I)V', 'close', 'Flushes the buffered writes and closes the backing random-access file.');
method('fe', '$cfr$sneakyThrow', '(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;', 'rethrowUnchecked', 'Preserves the generated generic throwable-rethrow helper without wrapping or replacing the thrown object.');
method('fe', 'a', '(Ljava/awt/Frame;I)V', 'setFullscreenWindow', 'Forwards the supplied frame to the graphics device fullscreen-window setter.');
method('fb', 'a', '(IZ)V', 'drawQuickChatKeysHelp', 'Darkens the current raster clip and draws the shared Quick Chat keys help panel when present.');
method('fb', 'n', '(I)V', 'releaseStatics', 'Clears numeric-date resources, localized text and the shared help panel under the original guard.');
method('ga', 'j', '(I)V', 'cutSelectedText', 'Copies the current selection to the clipboard and deletes it on the valid guard path.');
method('ga', 'l', '(I)V', 'releaseStatics', 'Clears static text-input colors and localized resource references under the original guard.');
method('ga', 'm', '(B)V', 'notifyTextChanged', 'Notifies the registered TextInputListener of a text change when the listener implements that contract.');
method('ga', 'm', '(I)V', 'notifyEnterPressed', 'Notifies the registered TextInputListener of an Enter press when the listener implements that contract.');
method('gb', 'a', '(B)V', 'releaseStatics', 'Clears the shared validation-indicator sprites under the original arithmetic guard.');
method('ge', 'c', '(B)V', 'releaseStatics', 'Clears static text, coordinate and Quick Chat command-type references under the original guard.');

// Applet presentation and the complete horizontal/rotated font drawing API.
method('ah', 'a', '(BLjava/lang/String;)V', 'showGameErrorPage', 'Reports error_game once, invokes the original loggedout bridge and opens the matching error page in the top frame.');
method('ah', 'a', '(Lsj;B)V', 'decodeLogoAudio', 'Loads the shared Vorbis setup and jagex logo2.packvorbis resource and decodes the complete PCM sample.');
method('ah', 'a', '(Z)V', 'runTimedFrameStep', 'Updates the rolling frame-step timing rate, snapshots focus state under synchronization and invokes runFrameStep.');
method('ah', 'c', '(I)V', 'releaseAppletResources', 'Clears shared applet resources and text under the original guard; distinct from the existing applet shutdown hook.');
method('ah', 'd', '(I)V', 'paintTimedFrame', 'Updates the rolling presentation rate, periodically refreshes canvas bounds/visibility and invokes paintFrame.');
method('ah', 'f', '(B)V', 'replaceCanvas', 'Detaches the prior canvas and creates, positions, focuses and installs a fresh DelegatingCanvas in the active host container.');
method('ak', 'a', '(Ljs;I)I', 'getScreenBackgroundOpacity', 'Returns full background opacity for the configured menu screens and the original conditional match-screen opacity.');
method('hu', 'a', '(CIII)V', 'drawCenteredCharacter', 'Draws a non-space character with its advance centered on the supplied X coordinate.');
method('hu', 'a', '(II)V', 'resetTextStyle', 'Resets current/default text and shadow colors, alpha, underline, strikethrough and justification state.');
method('hu', 'a', '(III)V', 'resetTextStyle', 'Resets text style with the supplied default/current alpha as well as colors.');
method('hu', 'a', '(Lhu;Ljava/lang/String;I)Ljava/lang/String;', 'truncateWithEllipsis', 'Returns text unchanged when it fits, otherwise preserves the original character-width truncation and ellipsis behavior.');
method('hu', 'a', '(Ljava/lang/String;)I', 'stringWidth', 'Measures glyph advances, pair kerning, supported markup entities and inline-image widths while ignoring style tags.');
method('hu', 'a', '(Ljava/lang/String;II)V', 'drawStyledText', 'Draws horizontal text with kerning, entities, inline images, style tags, alpha, shadow and decorations from the current text style.');
method('hu', 'a', '(Ljava/lang/String;IIII)V', 'drawText', 'Resets opaque text colors and draws the horizontal text at the supplied baseline.');
method('hu', 'a', '(Ljava/lang/String;IIIII)V', 'drawRightAlignedAlpha', 'Resets text style including alpha and subtracts the measured text width from the supplied right edge.');
method('hu', 'a', '(Ljava/lang/String;IIIIIIIII)I', 'drawParagraph', 'Delegates to paragraph drawing with full opacity and the supplied wrapping/alignment settings.');
method('hu', 'a', '(Ljava/lang/String;IIIIIIIIII)I', 'drawParagraph', 'Wraps the text and draws lines using the supplied rectangle, horizontal/vertical alignment, alpha and line spacing.');
method('hu', 'a', '([[B[[B[I[I[III)I', 'computePairKerning', 'Finds the minimum overlap of the glyph edge profiles and returns the negated pair spacing.');
method('hu', 'b', '(Ljava/lang/String;)V', 'applyStyleTag', 'Updates color, alpha, strikethrough, underline and shadow state from markup, resetting the defaults on br.');
method('hu', 'b', '(Ljava/lang/String;I)I', 'wrappedLineCount', 'Wraps the text to the supplied width and returns the number of resulting lines.');
method('hu', 'b', '(Ljava/lang/String;II)V', 'drawStyledTextVertical', 'Draws rotated glyphs advancing upward, with kerning, entities, text style, alpha and vertical decorations.');
method('hu', 'b', '(Ljava/lang/String;IIII)V', 'drawTextVertical', 'Resets opaque text colors and draws the rotated/upward text path.');
method('hu', 'b', '(Ljava/lang/String;IIIII)V', 'drawTextAlpha', 'Resets text style including alpha and draws horizontal text at the supplied baseline.');
method('hu', 'c', '(Ljava/lang/String;I)V', 'setJustification', 'Counts spaces outside markup and computes their fixed-point extra advance to fill the requested width.');
method('hu', 'c', '(Ljava/lang/String;IIII)V', 'drawRightAligned', 'Resets opaque text colors and draws with measured width subtracted from the supplied right edge.');
method('hu', 'c', '(Ljava/lang/String;IIIII)V', 'drawCenteredAlpha', 'Resets text style including alpha and draws with half the measured width subtracted from the center.');
method('hu', 'd', '(Ljava/lang/String;IIII)V', 'drawCentered', 'Resets opaque text colors and draws with half the measured width subtracted from the center.');
method('hu', 'a', '(IIIIIIIZ)V', 'drawGlyphVerticalAlpha', 'Rotated/upward glyph primitive with alpha, called by the styled vertical text renderer.');
method('hu', 'b', '(IIIIIIZ)V', 'drawGlyphVertical', 'Opaque rotated/upward glyph primitive called by the styled vertical text renderer.');
method('on', 'a', '([III)V', 'setRasterBuffer', 'Installs pixel storage and dimensions and resets the raster clip to the full buffer.');
method('on', 'c', '()V', 'clearRasterState', 'Clears the shared raster storage and temporary scanline/color arrays.');
method('on', 'c', '(IIIIII)V', 'drawThickRectangle', 'Draws nested rectangle outlines for the requested border thickness.');
method('on', 'd', '(IIIII)V', 'drawRectangleShadow', 'Draws the four progressively fainter right/bottom shadow edges.');
method('on', 'e', '(IIIII)V', 'drawRectangle', 'Draws the four solid edges of the rectangle.');
method('lj', 'a', '(BLjava/lang/String;Ljava/lang/String;)Z', 'containsNameOrReverse', 'Removes underscores from the candidate and checks both it and its reversal as substrings of the supplied text.');
method('lj', 'a', '(I)V', 'releaseStatics', 'Clears static gzip, resource and text references under the original guard.');
method('qj', 'a', '(BI)I', 'nearestCharacterIndex', 'Selects the nearest character position by the midpoint between adjacent layout offsets, preserving empty-line behavior.');
method('qj', 'a', '(II)I', 'screenToWorldY', 'Converts screen Y to world Y and reflects across the pitch when the view is reversed.');
method('qj', 'b', '(II)I', 'bitwiseAnd', 'Returns the bitwise AND of two integer values.');
method('t', 'a', '(F)V', 'setBrightnessAndRebuildPalette', 'Installs the randomized brightness exponent and rebuilds the complete packed-HSL palette.');
method('t', 'b', '(F)V', 'setRandomizedBrightness', 'Stores the brightness exponent with the original random perturbation in the range minus/plus 0.015.');
method('t', 'c', '(II)I', 'adjustPackedHslLightness', 'Scales the packed HSL lightness component and clamps it to the original two-through-126 range.');

method('eo', 'a', '()V', 'buildSharedControlSprites', 'Builds highlighted, mirrored and disabled control states, rendered buttons and the animated stat-bar sprite tables.');
method('eo', 'a', '(II)V', 'initializeAlphaNoise', 'Fills the shared noise table with randomized alpha bytes in the caller-specified range.');
method('eo', 'a', '(IIII)V', 'addRingAlphaNoise', 'Adds noise to the outer disk and clears alpha in the inner disk to leave an annulus.');
method('eo', 'a', '(IIIII)V', 'drawDashedHorizontalLineAlpha', 'Clips and blends alternating two-pixel spans along a horizontal line.');
method('eo', 'a', '(IIIIIII)V', 'drawStatBarStrip', 'Draws the 100 by 11 striped stat bar with its border shading and additive highlight.');
method('eo', 'a', '(IIIIZI)V', 'drawStatBar', 'Draws the time-animated stat bar, optional overflow glow and the optional labeled percentage/change overlay.');
method('eo', 'a', '(IIII[I[IIIIIIIIIII)V', 'multiplyScaledPixels', 'Samples source pixels with 16.16 coordinates and multiplies their RGB channels with destination pixels, skipping source zero.');
method('eo', 'a', '(IIIZ)V', 'setCircleAlphaNoise', 'Sets randomized alpha over the clipped disk when enabled, or clears its alpha while retaining RGB when disabled.');
method('eo', 'a', '(II[Ljava/lang/String;[[I[Ljava/lang/String;III[Ljava/lang/String;I)I', 'drawStatisticsTable', 'Draws angled column headings, row labels, integer statistics with optional suffixes and the selected row highlight.');
method('eo', 'a', '(Ljava/lang/String;I)Lhd;', 'createTextButton', 'Builds a rendered text button using the default shared font.');
method('eo', 'a', '(Ljava/lang/String;ILhu;)Lhd;', 'createTextButton', 'Measures text with the supplied font, adds padding and builds the rendered button.');
method('eo', 'a', '(Ljava/lang/String;Lhu;IIIIII)V', 'drawRotatedParagraph', 'Draws the centered paragraph to a temporary sprite, restores the raster and rotates that sprite into the destination.');
method('eo', 'a', '(Lkp;Ljava/lang/String;Ljava/lang/String;IIII)V', 'drawMatchScoreSummary', 'Draws two team names and scores, scrolls long names and marks the losing row according to the match record.');
method('eo', 'a', '(Lut;I)V', 'outlineSpriteInPlace', 'Colors transparent pixels adjacent to nonzero, non-outline pixels while retaining the original in-place scan order.');
method('eo', 'a', '(Lut;III)V', 'drawSpriteWithBrightness', 'Clips the sprite against the raster and scales nonzero RGB values, using normal sprite drawing at brightness 256.');
method('eo', 'a', '(Lut;IIII)V', 'drawScaledMultiplySprite', 'Projects trimmed sprite coordinates into the requested rectangle and invokes the clipped nearest-neighbor RGB multiply kernel.');
method('eo', 'a', '(Lut;Lut;I)V', 'captureRasterThroughSpriteMask', 'Copies the shared 640-stride raster into the target sprite where the mask is nonzero, clearing pixels outside the mask.');
method('eo', 'a', '(Z)Lhd;', 'createDefaultButtonNode', 'Builds a shared button node with the default style index.');
method('eo', 'a', '([BIII)V', 'drawWhiteAlphaMask', 'Clips a square byte-coverage mask and blends white through its nonzero alpha values.');
method('eo', 'a', '([BIIII)V', 'drawScaledWhiteAlphaMask', 'Scales the square byte-coverage mask to the requested size and clips it before blending white.');
method('eo', 'a', '([BIIIIII)V', 'drawScaledPackedShadowMask', 'Clips and scales a packed-bit mask before applying its seven-eighths destination darkening.');
method('eo', 'a', '([III)[B', 'createRotatingArcMask', 'Renders a radial palette and builds the 72-square byte mask from the original paired angular ranges and edge fade.');
method('eo', 'a', '([IIII)[B', 'createFadingRadialMask', 'Renders a radial palette and converts its pixels to a byte mask with the original progress-dependent power and gain.');
method('eo', 'a', '([I[BBBIIIIII)V', 'darkenPackedMaskPixels', 'Reads packed mask bits in row order and darkens selected destination RGB values to seven eighths.');
method('eo', 'a', '([I[BIIIIII)V', 'blendWhiteMaskPixels', 'Blends white into the destination using unsigned byte mask coverage and the supplied row strides.');
method('eo', 'a', '([I[BIIIIIIIII)V', 'blendScaledWhiteMaskPixels', 'Samples byte coverage with fixed-point coordinates and blends white over the destination.');
method('eo', 'a', '([I[BIIIIIIIIII)V', 'darkenScaledPackedMaskPixels', 'Samples the packed-bit mask with fixed-point coordinates and darkens selected destination pixels to seven eighths.');
method('eo', 'a', '([I[IIIIIII)V', 'fillRowsFromColorTable', 'Fills each destination row with the next color-table entry using the supplied width and row stride.');
method('eo', 'a', '([I[IIIIIIII)V', 'blendRowsFromColorTable', 'Blends each color-table row into the destination using the supplied alpha and row stride.');
method('eo', 'a', '([I[IIIIIIIII)V', 'blitBrightnessPixels', 'Scales nonzero source RGB values and preserves the original nonzero sentinel when scaled RGB would become zero.');
method('eo', 'b', '(IIII)V', 'drawCircleCrosshair', 'Draws a circle with horizontal and vertical lines through its center.');
method('eo', 'b', '(IIIII)V', 'addRectangleBorderAlphaNoise', 'Adds the shared alpha noise to the top, side and bottom border strips.');
method('eo', 'b', '(Lut;)Lot;', 'createHighlightedArgbCopy', 'Copies the ARGB sprite and additively redraws its pixels into the copy before restoring the raster.');
method('eo', 'b', '([BIIII)V', 'drawPackedShadowMask', 'Clips the packed-bit mask and applies its seven-eighths destination darkening kernel.');
method('eo', 'b', '([I[IIIIIII)V', 'blendRowsFifteenSixteenths', 'Blends each table color into its destination row with the original fifteen-to-one source/destination weighting.');
method('eo', 'c', '(IIII)V', 'addRectangleAlphaNoise', 'Adds the shared alpha noise to each pixel of the rectangle using the original noise cursor order.');
method('eo', 'c', '(IIIII)V', 'drawDashedVerticalLineAlpha', 'Clips and blends alternating two-pixel spans along a vertical line.');

method('nh', 'a', '(IIIIIIII[II[IIIIIIII)V', 'darkenRadialGradientPixels', 'Uses the radial recurrence to read low-byte coverage from the lookup table and darken the destination RGB.');
method('nh', 'a', '(IIIIII[I)V', 'drawGlowingLine', 'Clips a padded segment bounding box, sets up its normalized coordinate basis and invokes the additive glow kernel.');
method('nh', 'a', '(IIIIII[IIIIIIII)V', 'addGlowingLinePixels', 'Computes distance across and along the segment, samples its endpoint/width falloff and saturating-adds the lookup color.');
method('nh', 'a', '(IIII[I)V', 'drawRadialShadow', 'Clips the fixed-point circle bounds and initializes the squared-distance recurrence for the radial shadow lookup.');
method('nh', 'a', '(Lot;II)V', 'drawAlphaTestedArgb', 'Clips the ARGB sprite and copies pixels whose alpha byte is nonzero without blending partial alpha.');
method('nh', 'a', '(Lot;IIII)V', 'drawScaledAlphaTestedArgb', 'Scales and clips the trimmed ARGB sprite and copies nearest-neighbor samples with nonzero alpha.');
method('nh', 'a', '(Lut;)Lot;', 'downsampleSpriteHalfToArgb', 'Averages each two-by-two RGB block and derives alpha from opaque coverage, preserving the original offset calculations.');
method('nh', 'a', '(Lut;II)V', 'drawSpriteShadowMask', 'Clips the sprite and darkens the destination using its low-byte mask coverage.');
method('nh', 'a', '([I[IIIIIIII)V', 'blitAlphaTestedPixels', 'Copies source pixels with nonzero alpha using the original four-pixel unrolled loop and row strides.');
method('nh', 'a', '([I[IIIIIIIIIII)V', 'blitScaledAlphaTestedPixels', 'Samples source coordinates in 16.16 fixed point and copies only pixels with a nonzero alpha byte.');
method('nh', 'b', '([I[IIIIIIII)V', 'darkenSpriteMaskPixels', 'Darkens destination RGB by one minus the nonzero source pixel low-byte coverage.');
method('on', 'a', '()V', 'clearAuxiliaryBuffers', 'Clears the two retained auxiliary raster arrays.');
method('on', 'a', '(IIII[I)V', 'drawRadialGlow', 'Clips the fixed-point circle bounds and initializes the squared-distance recurrence for the additive radial glow.');
method('on', 'a', '([IIIIIIII)V', 'blurHorizontalPass', 'Runs the original in-place horizontal RGB box-filter pass with its variable edge sample counts and fixed-point interior reciprocal.');
method('on', 'a', '([IIIIIIIII)V', 'blurVerticalPass', 'Runs the vertical RGB box-filter pass using per-column channel sums and the original edge and clamping behavior.');
method('on', 'b', '(IIIIII)V', 'blurRectangle', 'Applies the horizontal and vertical box-filter passes to the requested rectangle with separate radii.');
method('lj', 'a', '(Z)Z', 'isAvailabilityCheckPending', 'Reports whether the shared availability request has not completed, retaining the original guard.');

method('hf', 'a', '(BI)Lhf;', 'withOffsetX', 'Sets the horizontal content offset and returns this style, retaining the original guard.');
method('hf', 'a', '(BII[B)Ljava/lang/String;', 'decodeCp1252', 'Decodes the byte range through the CP1252 extension table, skips zero bytes and replaces undefined extension characters with question marks.');
method('hf', 'a', '(I)V', 'reset', 'Resets offsets, colors and alpha to their original rendering defaults and clears retained sprite/panel resources.');
method('hf', 'a', '(II)I', 'bitwiseOr', 'Returns the bitwise OR of two integer values.');
method('hf', 'a', '(IILid;Lfd;ILhf;)V', 'mergeInto', 'Merges specified style values into the destination, first painting and resetting its prior layer when this style requests a flush.');
method('hf', 'a', '(IZ)Lhf;', 'withShadowColor', 'Sets the text shadow color and returns this style.');
method('hf', 'a', '(Lfd;Lid;III)V', 'paint', 'Draws the nine-slice panel, aligned sprite and styled paragraph using the resolved offsets, colors and alpha.');
method('hf', 'a', '(Lhf;I)V', 'copyTo', 'Copies the style values and shared resource references to the destination while retaining the original guard.');
method('hf', 'a', '(Ljava/lang/String;I)Z', 'containsNonAlphanumeric', 'Reports any character outside the ASCII letter and digit ranges.');
method('hf', 'a', '(Z)V', 'releaseStatics', 'Clears the static platform dispatcher and fullscreen-reason references under the original guard.');
method('hf', 'a', '(ZB)Lhf;', 'withFlushPreviousLayer', 'Sets whether merging this style first paints and resets the previously accumulated style.');
method('hf', 'a', '(Z[Lut;)Lhf;', 'withPanelSprites', 'Sets the shared nine-slice panel sprite array and returns this style.');
method('hf', 'b', '(BI)Lhf;', 'withOffsetY', 'Sets the vertical content offset and returns this style.');
method('hf', 'b', '(II)Lhf;', 'withTextColor', 'Sets the text color and returns this style on the valid guard path.');
method('gn', 'a', '(IC)Z', 'isAsciiDigit', 'Tests exactly the ASCII zero through nine character range.');
method('se', 'a', '(BC)Z', 'isAsciiLetter', 'Tests exactly the ASCII uppercase and lowercase letter ranges.');
method('ho', 'c', '()[F', 'decodeVector', 'Decodes one codebook scalar and returns its corresponding floating-point lookup vector.');
method('id', 'a', '(II)Lhf;', 'createStateStyle', 'Creates and installs a fresh PainterStyle at the selected widget-state index.');
method('id', 'a', '(I[Lut;I)V', 'setStatePanelSprites', 'Creates the state style if necessary and installs its nine-slice panel sprite array.');
method('iq', '$cfr$intArgs$a$8e2a9e3a0d15', '(IIIII)I', 'drawNumberDigits', 'Full-integer guard bridge for drawing additive decimal digits from right to left.');
method('iq', 'a', '(BIIII)I', 'drawNumberDigits', 'Recursively draws decimal digit sprites right to left and returns the next available X coordinate.');
method('iq', 'a', '(B)I', 'width', 'Returns the maximum measured line width, retaining the original minus-one result when no line is measured.');
method('iq', 'a', '(I)I', 'height', 'Returns the vertical distance from the first line top to the final line bottom, or zero for no lines.');
method('iq', 'a', '(II)I', 'lineIndexForCharacter', 'Finds the line containing a flattened character position, accounting for each line terminal caret position.');
method('iq', 'a', '(III)I', 'hitTestCharacter', 'Checks the text vertical bounds and returns the nearest flattened character position on the matching line.');
method('iq', 'a', '(IIILjava/lang/String;)I', 'justificationSpacing', 'Computes fixed-point extra spacing per space outside markup from the target and measured widths.');
method('iq', 'b', '(I)V', 'releaseStatics', 'Clears static text and resource references under the original guard.');
method('iq', 'b', '(II)I', 'characterX', 'Returns the measured X offset for a flattened character position, retaining the original missing-position result.');
method('kf', 'a', '(IB)V', 'selectTopRankingRows', 'Runs the two original ranking sorts, reindexes the retained rows and trims the shared row count to the requested limit.');
method('kf', 'a', '(ZIIIIII)V', 'setBoundsAndUpdateTabs', 'Installs the tab-strip bounds and forwards the original tab layout/input parameters.');
method('kf', 'c', '(Z)V', 'releaseStatics', 'Clears static tab-strip text references under the original guard.');
method('kf', 'h', '(B)V', 'processTabClicks', 'Activates clicked tabs, moves old/new content out of and into the visible layout and updates their selected flags.');
method('qv', 'a', '(Z)V', 'releaseStatics', 'Clears static text and painter references under the original guard.');
method('nm', 'a', '(BI)I', 'getPreparationProgress', 'Maps the shared staged progress percentage into the 55-through-100 preparation range.');
method('nm', 'a', '(IILut;)Lut;', 'tintGrayscaleSprite', 'Builds a sprite whose nonzero, non-sentinel pixels use their low-byte intensity to scale the supplied tint color.');
method('nm', 'a', '(ILiw;)V', 'decode', 'Reads tagged animation-clip records until the zero terminator and delegates each record to the tag decoder.');

method('t', 'a', '(IIIIIIIIIIIIIIIIIII)V', 'drawTexturedTriangle', 'Loads the texture and walks the triangle edges with perspective texture and lighting gradients, retaining the average-color fallback.');
method('t', 'a', '([I[IIIIIIIIIIIIII)V', 'drawTexturedScanline', 'Draws clipped perspective-correct texture spans in eight-pixel groups with lighting, low-detail sampling and the original transparent/opaque modes.');

// File transport, Quick Chat records, match presentation and table controls.
method('al', 'a', '(IIBI)V', 'layoutListAndButtons', 'Lays out the scrollable list above its two bottom controls using the supplied margins and control height.');
method('al', 'h', '(B)Ltc;', 'findMarkedQuickChatCategory', 'Scans categories for the first tag-four-marked category and preserves the null result when category lookup fails; the marker purpose is not established.');
method('an', 'a', '(I)V', 'releaseStatics', 'Clears the static resource reference and preserves the original invalid-guard assignment.');
method('ao', 'a', '(II[BI)I', 'read', 'Reads the requested byte range and advances the tracked file position only for a positive read count.');
method('ao', 'a', '(I[BII)V', 'write', 'Writes the byte range and advances the tracked position, preserving the original maximum-length overflow marker and EOFException.');
method('ap', 'a', '(BLtf;)V', 'rebuildWorldDrawList', 'Forwards optional extra world entries to the active PlayingView draw-list builder.');
method('ap', 'a', '(I)V', 'rebuildRenderedMatch', 'Rewraps the match agents and resets the active PlayingView draw list.');
method('ap', 'a', '(III)V', 'announceParticipantStatusChange', 'Compares participant status snapshots and emits the original departed, resigned or draw-offer announcement.');
method('ap', 'a', '(ILhn;BI)V', 'applyGameOverTrainingAction', 'Forwards the manager training action to the current GameOverView when that view is active.');
method('ap', 'a', '(ILml;)V', 'readParticipantPingTimes', 'Reads one unsigned-short latency value for each match participant.');
method('ap', 'f', '(B)Z', 'canUsePitchPointer', 'Requires active play, a locally controlled participant and an in-bounds pointer, retaining the existing input/viewport predicates.');
method('ap', 'g', '(I)I', 'getLocalInputDelay', 'Computes five plus the local participant latency divided by the 20-millisecond tick length.');
method('va', 'a', '(BI)I', 'nextSharedRandomInt', 'Returns a bounded random value using the shared game Random and original rejection-sampling helper.');
method('va', 'a', '(Ljava/awt/Canvas;ZI)V', 'drawClientToCanvas', 'Draws the startup progress, loading animation, login UI or running game into the supplied canvas according to client state.');
method('va', 'a', '(Ltf;B)V', 'rebuildWorldDrawList', 'Builds the footballer, ball and goal entries, transfers optional extra entries and sorts the resulting world draw list.');
method('va', 'a', '(ZLnu;)V', 'updateRenderedAgentFlags', 'Updates footballer goal/control animation flags and synchronizes the rendered ball with its current carrier.');
method('va', 'b', '(Z)V', 'queueHeldKeys', 'Enqueues the held-key input event and sends its bit mask on the original online path.');
method('va', 'd', '(B)Ljava/awt/Container;', 'getAppletHostContainer', 'Returns the standalone frame when present, otherwise the active applet container.');
method('va', 'g', '(I)V', 'updatePossessionSoundTeam', 'Tracks the ball possession team for the sound logic and clears it at the original goal-count limit.');
method('va', 'm', '(I)V', 'rebuildRenderedMatch', 'Wraps the current agents for rendering and rebuilds the default world draw list.');
method('va', 'o', '(I)V', 'scheduleAmbientCrowdSound', 'Schedules a randomized ambient crowd stream with fade-in, fade-out and delay when no competing crowd stream is active.');
method('bg', 'a', '(BILiw;)V', 'decodeTag', 'Decodes display-text fragments, automatic phrase IDs and dynamic Quick Chat command parameters by record tag.');
method('bg', 'a', '(I)V', 'releaseStatics', 'Clears shared Quick Chat text and resource references under the original guard.');
method('bg', 'a', '(Ljava/lang/String;Lsj;BLjava/lang/String;)Lut;', 'loadSpriteByName', 'Resolves archive group and file names and delegates to the sprite loader.');
method('bg', 'a', '(Z)V', 'markGlobalPhraseIds', 'Sets the global archive bit on all automatic phrase IDs, retaining null-array and guard behavior.');
method('bp', 'a', '(IBII)V', 'layoutTableViewport', 'Updates the table bounds, scroll-content area, scrollbar and thumb geometry.');
method('bp', 'a', '(IB[Lim;I)V', 'installRows', 'Installs the complete row array, positions the rows and sizes the scrollable content and viewport.');
method('bp', 'a', '(ILml;[BI)[B', 'readPackedByteArray', 'Reads the array length, shared byte base and per-entry bit width, reusing a matching array or returning null for length zero.');
method('bp', 'a', '(Lsr;I)V', 'sortRows', 'Sorts and repositions the row array and records the matching active sort-column index.');
method('bp', 'a', '(ZZ)V', 'updateTableInput', 'Applies wheel scrolling, handles sortable header clicks and updates each row.');
method('bu', 'a', '(IILjava/lang/String;Ljava/lang/String;)Lao;', 'openPreferencesFile', 'Tries the original platform cache locations for the versioned preferences filename and opens a bounded random-access file.');
method('bu', 'a', '(Z)V', 'shutdown', 'Signals and joins the task worker, then closes the shared cache files while preserving the original exception handling.');
method('ol', 'a', '(ILhn;II)V', 'applyTrainingAction', 'Deduplicates the training action, increases the selected player stat, consumes 100 experience and records the action.');
method('hs', 'a', '(II)V', 'drawTeamParticipantPanels', 'Draws team headings and per-participant rows in the local team order, including the loaded-pitch marker.');

method('bp', 'a', '(I)V', 'drawTable', 'Draws the table background, sortable column headers and direction icons, clipped rows, hover states and cell highlights.');
method('ct', 'a', '(BLfd;)Z', 'focusPreviousChild', 'Offers backward focus traversal to the wrapped child when it exists and is not already focused.');
method('ct', 'a', '(Ljava/util/Hashtable;ILjava/lang/StringBuilder;I)V', 'appendChildDebugTree', 'Appends the indented child debug tree or the original null marker.');
method('ct', 'b', '(BLfd;)Z', 'focusNextChild', 'Offers forward focus traversal to the wrapped child when it exists and is not already focused.');
method('ct', 'i', '(I)V', 'detectMaximumHeapSize', 'Reflectively queries Runtime.maxMemory and stores the original rounded-up MiB value when available.');
method('se', 'a', '(Lfd;Z)V', 'pushModal', 'Requires a ModalPanel, inserts it into the modal stack, activates it and requests keyboard focus.');
method('se', 'a', '(Lsj;ILjava/lang/String;Ljava/lang/String;)[Lut;', 'loadSpriteSheetByName', 'Resolves the archive group/file names and loads their decoded sprite sheet.');
method('se', 'h', '(B)Lub;', 'topActiveModal', 'Returns the first active modal in stack order, or null if none is active.');
method('se', 'k', '(I)V', 'deactivateAllModals', 'Marks all stacked modals inactive and clears the retained focused child.');
method('se', 'l', '(I)V', 'finishModalAnimations', 'Finishes each modal transition and unlinks modals that are closed.');
method('se', 'm', '(I)V', 'releaseStatics', 'Clears static animation and text references under the original guard.');
method('se', 'n', '(I)V', 'advanceModalAnimations', 'Advances each modal fade/resize animation, removes closed entries and updates the active child.');
method('wj', 'a', '(IILjava/lang/String;III)V', 'drawParticipantPanelBackground', 'Draws the team-heading panel and per-participant translucent rows with the selected local row highlighted.');
method('wj', 'a', '(ILfd;)V', 'addChild', 'Appends the supplied widget to this container child deque.');
method('wj', 'a', '(Lfd;B)Z', 'focusPreviousChild', 'Traverses children backward from the focused widget and requests focus from the preceding eligible child.');
method('wj', 'a', '(Ljava/lang/StringBuilder;Ljava/util/Hashtable;II)V', 'appendChildrenDebugTree', 'Appends every child debug tree with its original indentation and visited-widget table.');
method('wj', 'b', '(Lfd;B)Z', 'focusNextChild', 'Traverses children forward from the focused widget and requests focus from the next eligible child.');
method('wj', 'i', '(I)V', 'releaseStatics', 'Clears shared mesh and text resources on the valid guard path.');
method('wj', 'j', '(I)V', 'refreshChildrenLayout', 'Refreshes the layout of every widget in the child deque.');
method('li', 'a', '(I)B', 'asByte', 'Returns a stored Byte or narrows the value obtained through the existing long conversion.');
method('li', 'a', '(IB)V', 'setMusicVolume', 'Forwards the supplied value to music-volume setting zero under the original guard.');
method('li', 'a', '(ILjava/lang/String;)V', 'enqueueTournamentChampionDialog', 'Adds the named tournament champion dialog to the pending dialog deque.');
method('li', 'b', '(I)I', 'asInt', 'Returns a stored Integer or narrows the value obtained through the existing long conversion.');
method('li', 'c', '(I)Z', 'asBoolean', 'Returns the boxed Boolean value on the valid guard path.');
method('lk', 'a', '(I)V', 'releaseStatics', 'Clears static expression-type and text references under the original guard.');
method('sb', 'a', '(II)I', 'cosAngle', 'Returns the fixed-point cosine lookup at the angle masked to 2048 entries.');
method('tm', 'a', '(I)V', 'releaseStatics', 'Clears static console text, sprite and coordinate resources under the original guard.');
method('vg', 'a', '(I)Ljava/lang/String;', 'getSuggestedLoginName', 'Returns the login form name, remembered name or shared default name in that order.');
method('vg', 'a', '(IB)V', 'moveCaret', 'Moves the text caret and preserves its selection anchor only while Shift is held.');
method('vg', 'a', '(IIIII)V', 'layoutTextField', 'Sets the text-field rectangle, its text/selection child bounds and the available text height.');
method('vg', 'a', '(ZLwd;I)V', 'writeRankingsRequest', 'Writes the rankings request opcode and its two byte selector fields.');
method('vg', 'c', '(II)V', 'flushWithSimulatedLag', 'Queues outgoing bytes with the configured delay and Gaussian jitter, releases due packets and invokes the original packet flush.');
method('vg', 'm', '(I)V', 'releaseStatics', 'Clears shared text-field strings, sound tables and layout references under the original guard.');
method('cm', 'l', '(I)V', 'buildRotatedStarSprites', 'Builds the 100 evenly spaced rotations of the menu/star sprite and restores the raster after each draw.');
method('hs', 'a', '(IIBI)V', 'drawTeamParticipantRows', 'Draws the team heading, participant icons and names and crosses out inactive participants.');
method('hs', 'a', '(III)I', 'hitTestButton', 'Finds the enabled button whose centered sprite bounds contain the pointer, or returns minus one.');

method('va', 'a', '(ZIZ)V', 'playRandomCrowdShout', 'Chooses a shout from the enabled crowd categories with a randomized pan and cooldown while the match goal-count limit permits sound.');
method('va', 'b', '(B)Z', 'hasHeldMouseInput', 'Reports whether either of the retained mouse-button input flags is active.');
method('va', 'f', '(I)Lec;', 'createAccountNameStatus', 'Packages the current account-name text with the availability-request pending flag.');
method('va', 'l', '(I)V', 'updateMatchAudio', 'Updates start/end whistles, ball impacts, goal/miss reactions, random shouts and surface-dependent music/crowd state.');
method('he', 'a', '(I)Ljava/lang/String;', 'getCurrentAccountNameText', 'Selects the registration name, pending availability query or retained account status text according to request state.');
method('fd', 'a', '(ZZBZZ)I', 'chooseCrowdShoutId', 'Chooses uniformly among enabled shout categories and then selects a sound ID from that category.');
method('fd', 'g', '(B)V', 'releaseStatics', 'Clears static widget text and resource references under the original guard.');
method('fd', 'h', '(I)V', 'leaveFullscreen', 'Restores the saved display mode, releases the fullscreen window, restores canvas sizing and requests game-canvas focus.');
method('ga', 'a', '(Lvm;I)Lag;', 'attachSampleStream', 'Creates and tracks a handle for the supplied sample stream and adds it to the shared mixer.');
method('ga', 'a', '(ZLjava/lang/String;)Ljava/lang/String;', 'prefixAccountIcon', 'Prefixes the supplied text with the account-role icon selected by the shared privilege flags.');
method('sr', 'a', '(B)V', 'releaseStatics', 'Clears static sort and text resource references under the original guard.');
method('ct', 'a', '(ZI)I', 'latencyIndicatorHeight', 'Maps the latency in milliseconds into the original vertical indicator height, retaining its unbounded high-latency arithmetic.');
method('gt', '$cfr$intArgs$a$60f25194e713', '(ZIII)Lwh;', 'playFadingSound', 'Full-integer guard bridge for the shared fading-sound factory and stereo-side selection.');
method('gt', 'a', '(ZIBI)Lwh;', 'playFadingSound', 'Looks up the sound metadata, applies the shared stereo-side inversion and delegates to the fading-sound factory.');
method('gt', 'a', '(IIBI)V', 'updateFormationTargetPoint', 'Computes the selected point within the formation rectangle, reflects for team side and clamps it to the pitch bounds.');
method('gt', 'a', '(Z)V', 'releaseStatics', 'Clears shared participant text, mesh/color tables and resources under the original guard.');
method('gt', 'a', '(ZI)V', 'advanceSharedPanelTransition', 'Advances the prioritized shared panel animation counters and creates the relevant panel on its first visible step.');
method('gt', 'c', '(Lml;I)V', 'decodeDelta', 'Applies a flagged participant-state delta containing controlled slots, draw/resign/depart/load/reward flags, megamode and animation bits.');

method('df', 'c', '(Z)V', 'releaseStatics', 'Clears static auction-help text resources under the original guard.');
method('dj', 'e', '(I)V', 'releaseStatics', 'Clears static paged-help text references under the original guard.');
method('dn', 'c', '(Z)V', 'releaseStatics', 'Clears trinket-icon text, sprite and layout references under the original guard.');
method('dq', '$cfr$sneakyThrow', '(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;', 'rethrowUnchecked', 'Preserves the generated generic throwable rethrow without wrapping the thrown object.');
method('dq', 'a', '(Z)V', 'releaseStatics', 'Clears the static proxy text reference under the original guard.');
method('e', 'a', '(I)V', 'releaseStatics', 'Clears splash text, fullscreen state and world-entry references under the original guard.');
method('eb', 'a', '(I)V', 'releaseStatics', 'Clears shared disk-cache sprite and resource references under the original guard.');
method('ek', 'b', '(II)I', 'bitwiseXor', 'Returns the bitwise XOR of the supplied integers.');
method('ek', 'd', '(Z)V', 'releaseStatics', 'Clears the static trinket-shop text reference under the original guard.');
method('ek', 'g', '(I)V', 'enqueueTrinketPickerDialog', 'Adds a fresh TrinketPickerDialog to the pending dialog deque.');
method('ev', 'g', '(I)V', 'releaseStatics', 'Clears static console text and resource references under the original guard.');
method('fk', 'f', '(I)V', 'releaseStatics', 'Clears shared waiting-screen resources under the original guard.');
method('fm', 'g', '(B)V', 'releaseStatics', 'Clears the shared achievements text and layout references under the original arithmetic guard.');
method('fo', 'c', '(B)V', 'releaseStatics', 'Clears the shared age-validator text reference under the original guard.');
method('fp', 'a', '(I)V', 'releaseStatics', 'Clears shared auction sprites, text, selection and layout references under the original guard.');
method('fr', 'a', '(B)V', 'showAccountRegistrationPanel', 'Constructs and installs the shared account registration panel.');
method('fr', 'a', '(I)V', 'releaseStatics', 'Clears static suggestion text and layout resources under the original guard.');
method('fu', 'a', '(Z)V', 'releaseStatics', 'Clears shared chat, text and integer-list resources under the original guard.');
method('gg', 'a', '(I)V', 'drawDimmedModalOverlay', 'Draws the shared modal overlay with full-raster background dimming enabled.');
method('gi', 'c', '(Z)Z', 'isSelectedColor', 'Compares this swatch color with the selected primary or secondary appearance color.');
method('gi', 'h', '(I)V', 'releaseStatics', 'Clears the shared swatch text reference under the original guard.');
method('gm', 'i', '(B)V', 'releaseStatics', 'Clears shared footballer render tables and text/resource references under the original guard.');
method('gn', 'c', '(I)V', 'readAccountNameUpdate', 'Reads the current account name and updates its normalized lookup representation.');
method('gn', 'd', '(I)V', 'releaseStatics', 'Clears the shared participant-results text reference on the valid guard path.');
method('ha', 'a', '(ZB)Z', 'negate', 'Returns the negation of the supplied boolean under the original guard.');
method('ha', 'g', '(I)V', 'releaseStatics', 'Clears shared welcome-dialog strings and resources under the original guard.');
method('hd', 'g', '(I)V', 'releaseStatics', 'Clears shared layout-node text and resource references under the original guard.');
method('he', 'b', '(I)V', 'releaseStatics', 'Clears shared lobby-row text and sprite resources under the original guard.');
method('hg', 'h', '(I)V', 'releaseStatics', 'Clears promotion text, sprite and numeric resources under the original guard.');
method('hi', 'g', '(I)V', 'releaseStatics', 'Clears the shared disk-request text reference under the original guard.');
method('hm', 'a', '(BI)I', 'triple', 'Returns the supplied integer multiplied by three, preserving Java integer overflow behavior.');
method('hm', 'g', '(I)V', 'releaseStatics', 'Clears shared integer-console text, color and coordinate resources under the original guard.');
method('hm', 'h', '(I)Lmc;', 'createNanoTickClock', 'Constructs a new NanoTickClock, retaining the original guard branch.');
method('hs', 'a', '(I)V', 'initializeButtonSelection', 'Creates the phase button selection state and initializes its hover index from the current pointer.');
method('hs', 'b', '(I)V', 'releaseStatics', 'Clears shared match-phase text and icon resources under the original arithmetic guard.');
method('ht', 'a', '(Z)V', 'releaseStatics', 'Clears static hash-table resource references under the original guard.');
method('hw', 'a', '(I)V', 'releaseStatics', 'Clears static note-mask integer and resource references under the original guard.');
method('i', 'f', '(B)V', 'releaseStatics', 'Clears shared message-dialog text and resources under the original arithmetic guard.');
method('ib', 'a', '(I)V', 'releaseStatics', 'Clears shared date-of-birth text and resource references under the original guard.');
method('ie', 'h', '(I)V', 'releaseStatics', 'Clears the shared sell-player text reference under the original guard.');
method('ik', 'g', '(I)V', 'releaseStatics', 'Clears shared numeric-console text and resources under the original arithmetic guard.');
method('im', 'a', '(I)V', 'releaseStatics', 'Clears shared list-row text and resources under the original guard.');
method('ir', 'a', '(Z)V', 'releaseStatics', 'Clears shared console arrays and text references under the original guard.');
method('iw', 'a', '(Z)Ljava/lang/String;', 'readNullableString', 'Consumes a zero byte as null; otherwise reads the existing null-terminated string on the valid guard path.');
method('jb', 'c', '(Z)V', 'releaseStatics', 'Clears shared popup text and secure-random references under the original guard.');
method('jc', 'a', '(IZ)I', 'twice', 'Returns the supplied integer multiplied by two, preserving Java integer overflow behavior.');
method('jd', 'b', '(B)V', 'releaseStatics', 'Clears shared validation text and integer-array resources under the original arithmetic guard.');

// Archive, cache and kit roles reviewed against their published consumers.
method('sj', 'a', '(DBDD)V', 'moveProjectionTarget', 'Adds pan and zoom deltas to the shared projection target and applies the original pitch and zoom bounds.');
method('sj', 'a', '(IIB)I', 'hitTestMenuAction', 'Measures the shared menu rows and returns the action identifier under the pointer, or minus one.');
method('sj', 'a', '(IIZ)Z', 'isFileIdInRange', 'Loads the archive index and range-checks group and file ids against file-id capacities, preserving the debug exception path.');
method('sj', 'a', '(Ljava/lang/String;B)Z', 'hasGroupName', 'Lowercases and hashes the supplied group name and checks for an index entry.');
method('sj', 'a', '(ZI)I', 'getFileIdCapacity', 'Returns the indexed file-id capacity for a valid group, or zero when unavailable.');
method('sj', 'a', '(ZLjava/lang/String;)Z', 'ensurePackedGroupByName', 'Looks up the lowercased group name then requests its packed bytes.');
method('sj', 'b', '(BI)Z', 'ensurePackedGroup', 'Returns true for resident packed group bytes, otherwise loads them and checks again.');
method('sj', 'b', '(I)V', 'initializeReflectionCheckQueue', 'Creates the deque consumed by MatchAgent and ConsoleCommand as ReflectionCheck requests.');
method('sj', 'b', '(III)[B', 'takeFile', 'Delegates to the existing file extraction method with no XTEA keys, preserving the original guard.');
method('sj', 'c', '(II)[I', 'getFileIds', 'Returns explicit sparse file ids, or builds the sequential id list for a dense group.');
method('sj', 'e', '(I)I', 'getOverallProgress', 'Averages group progress over nonempty groups; an empty archive is complete and an unavailable index reports zero.');
method('ow', 'a', '(Lsj;IBI)Lut;', 'loadSprite', 'Decodes a sprite sheet from the archive and constructs its first sprite, or returns null if unavailable.');
method('ow', 'a', '(Z)V', 'releaseStatics', 'Clears shared archive-source resources under the original guard.');
method('n', 'a', '(CLjava/lang/String;BLjava/lang/String;)Ljava/lang/String;', 'replaceCharacter', 'Replaces each occurrence of the supplied character with the literal replacement string, precomputing capacity.');
method('n', 'a', '(ILjava/lang/String;)V', 'showCenteredMessagePanel', 'Sets the shared message, measures its paragraph height and centers the panel and confirmation button.');
method('n', 'a', '(Lqh;IIZLqh;)Lwm;', 'getArchiveSource', 'Returns or constructs the per-id cached archive source from the loaded master index CRC, digest and version.');
method('n', 'a', '(Z)Z', 'hasActiveModal', 'Tests whether the shared modal stack exists and has an active top modal.');
method('bi', 'a', '(Ljava/lang/String;ILjava/lang/String;)Z', 'isAcceptablePassword', 'PasswordValidator rejects nonalphanumeric and disallowed passwords and passwords containing transformed account names.');
method('hi', 'a', '(Ljava/applet/Applet;Z)V', 'clearSessionAndReload', 'Clears the session cookie and reloads the applet page.');
method('eq', 'a', '(I)V', 'layoutAnimatedChatPanel', 'Eases the shared chat panel vertical position using the squared transition counter and positions its Quick Chat overlay.');
method('eq', 'a', '(Z)Z', 'hasBlockingInputPopup', 'Checks shared context-menu, prompt and routed popup references before allowing normal input.');
method('pn', 'a', '(I)Ljava/lang/Object;', 'getValue', 'Returns the strongly retained cache value; the shared abstract contract is propagated to overrides.');
method('pn', 'h', '(B)Z', 'isSoftReference', 'Returns false for a strong entry; WeightedLruCache promotes entries whose corresponding predicate is true.');
method('pn', 'b', '(I)V', 'releaseStatics', 'Clears shared strong-cache-entry resources under the original guard.');
method('pn', 'g', '(I)Z', 'hasGameFocus', 'Treats fullscreen as focused, otherwise returns the last game focus snapshot on the valid guard path.');
method('tb', 'a', '(BI)V', 'enqueueMessageDialog', 'Appends a message dialog; message 28 first closes the current popup and clears the pending queue.');
method('tb', 'a', '(ILsj;)V', 'initializeSocialPanels', 'Loads the display-name-change sprite and constructs the shared friends, ignore and social containers and controls.');
method('tb', 'a', '(Ljava/lang/String;I)Z', 'containsLoginPassword', 'Chat submission checks whether text contains the stored login password and displays the explicit password-disclosure warning.');
method('rd', 'a', '(I)Z', 'usesSecondColorForClashCheck', 'Kit ids zero, thirteen and twenty-three select the second color array in MatchScreen color-clash checks.');
method('rd', 'a', '(IB[I)Z', 'isAchievementLocked', 'Restricted access levels require the configured achievement bit; definitions without an achievement are unlocked.');
method('rd', 'a', '(I[BB)Z', 'isUnlockMaskLocked', 'Negates the configured kit unlock bit unless the definition has no unlock-mask requirement.');
method('rd', 'a', '(JII)Z', 'matchesAccessRequirements', 'Requires access level two for restricted kits and matches the configured long key unless its sentinel allows any key.');
method('rd', 'a', '(Z)V', 'releaseStatics', 'Clears shared kit-definition resources under the original guard.');
method('ap', 'a', '(I[IZ[I[I)V', 'separateClashingKitColors', 'Selects each kit dominant color and flips the team color bank when the two colors are too close.');
method('ap', 'c', '(B)V', 'drawParticipantPanels', 'Draws team participant panels at y=150 for a received online match with an active phase.');
method('gr', 'a', '(BI)Z', 'hasLogEntryForSlot', 'Tests whether findLogEntryBySlot returns a record for the requested slot.');
method('gr', 'a', '(II)Z', 'isClubFlagSet', 'Tests the requested bit in the club flags integer under the original guard.');
method('em', 'a', '(Lam;BJ)V', 'put', 'Unlinks an existing secondary chain membership and inserts the node into the masked hash bucket under its long key.');
method('em', 'b', '(B)Lam;', 'first', 'Resets the hash table iteration bucket and delegates to its next-entry traversal.');
method('o', 'a', '(I)Lam;', 'first', 'Starts iteration at the sentinel next link and remembers the following node.');
method('o', 'b', '(I)Lam;', 'next', 'Advances the saved deque cursor and returns null at the sentinel.');
method('o', 'c', '(I)I', 'size', 'Counts secondary-linked nodes between the deque sentinel links.');
method('o', 'd', '(I)V', 'releaseStatics', 'Clears shared deque resources under the original guard.');
method('lf', 'a', '(BI)I', 'projectPitchY', 'Reflects pitch Y around 1344 when orientation is reversed and applies worldToScreenY.');


method('wm', 'a', '(I)Lkl;', 'getIndex', 'Loads and verifies the cached or network archive index and returns it when available.');
method('wm', 'a', '(II)I', 'getGroupProgress', 'Returns progress from the queued request for the group, or zero if no request exists.');
method('wm', 'a', '(IIB)Lvv;', 'getValidatedGroupRequest', 'Starts or polls the requested disk, priority or background group transfer and validates its CRC, digest and version before returning completion.');
method('wm', 'b', '(B)V', 'requestAllGroups', 'Enables background group fetching when a disk cache exists and ensures the pending work deque exists.');
method('wm', 'b', '(I)V', 'serviceBackgroundRequests', 'Processes bounded disk verification and background fetch queues, then periodically unlinks completed old requests.');
method('wm', 'b', '(II)[B', 'getGroupBytes', 'Takes bytes from a completed validated priority group request and unlinks that request.');
method('wm', 'd', '(I)V', 'servicePrefetchQueue', 'Checks explicit group prefetch entries, requesting disk validation or network recovery until the group is valid.');
method('n', 'a', '(I)V', 'serviceArchiveSources', 'Services every cached source prefetch queue before servicing its background requests.');
method('em', 'a', '(I)Lam;', 'next', 'Traverses secondary links within the current hash bucket then advances to the next nonempty bucket.');
method('em', 'a', '(IJ)Lam;', 'get', 'Searches the masked hash bucket for the long key and preserves a cursor for further equal-key entries.');
method('em', 'a', '(B)Lam;', 'nextWithSameKey', 'Continues from the lookup cursor, returning the next entry with the same long key.');
method('kc', 'a', '(I)Lgn;', 'next', 'Advances through intrusive-node hash buckets and stores the next node cursor.');
method('kc', 'a', '(Z)V', 'clear', 'Unlinks every node from every hash bucket and clears both iteration cursors.');
method('kc', 'a', '(ZJ)Lgn;', 'get', 'Looks up a long key in the masked bucket, retaining a search cursor.');
method('kc', 'b', '(I)Lgn;', 'first', 'Sets the starting iteration bucket and returns its first available entry.');
method('ko', 'a', '(III)V', 'updatePointerSelection', 'Updates selected index and button hold/repeat state from pointer presses, releases and hovered indices.');
method('ko', 'a', '(I)Z', 'isPointerHeld', 'Reports whether a mouse button is latched in the selection controller.');
method('ko', 'a', '(IIIZ)V', 'restoreSelection', 'Restores pointer-driven versus keyboard-driven selection, held button state and the corresponding selected index.');
method('ko', 'a', '(ZIB)V', 'resetPointerSelection', 'Clears the held button state and optionally sets a new pointer-driven selected index.');
method('ko', 'b', '(I)V', 'captureActivationKey', 'Clears pointer activation state and records the current key only when no mouse button is held.');
method('ko', 'c', '(I)Z', 'isActivated', 'Reports pointer activation or the two keyboard activation codes 84 and 83.');
method('ko', 'd', '(I)V', 'handleVerticalArrowKeys', 'Wraps selection on key codes 98 and 99 while switching to keyboard-driven selection.');
method('ml', 'a', '(BI[BI)V', 'readIsaacBytes', 'Reads bytes while subtracting consecutive ISAAC outputs into the destination slice.');
method('ml', 'a', '(III)V', 'writeBits', 'Masks and packs the requested number of bits into successive bytes, maintaining free bits in the current byte.');
method('ml', 'b', '(IB)V', 'writeIsaacByte', 'Adds the next ISAAC output to the byte before writing it and advancing position.');
method('ml', 'k', '(B)I', 'readIsaacByte', 'Subtracts the next ISAAC output from the input byte and masks the unsigned result.');
method('ml', 'b', '(Z)V', 'finishBitWrite', 'Advances past a partially filled output byte and restores the byte-aligned write state.');
method('ml', 'n', '(I)V', 'beginBitWrite', 'Zeroes the current output byte and initializes its eight available bit positions.');
method('ml', 'p', '(I)V', 'beginBitRead', 'Converts the byte position into the initial bit-read cursor.');
method('ml', 'l', '(B)V', 'finishBitRead', 'Rounds the bit-read cursor upward to the next byte position.');
method('ml', 'k', '(II)V', 'advanceLoadingProgress', 'Raises the shared loading progress monotonically and reports a stage update.');
method('ml', 'm', '(I)V', 'releaseStatics', 'Clears shared cipher-buffer text, sprite and integer resources under the original guard.');
method('ml', 'o', '(I)V', 'initializeExtendedKeyMappings', 'Populates punctuation, bracket and extended Java key-code translations in the shared key map.');
method('ml', 'a', '(ILsj;)V', 'loadSplitFinalFrameSprites', 'Loads final_frame.jpg and renders its upper and lower sections into separate sprites while preserving raster state.');
method('ml', 'c', '(Z)V', 'layoutSharedChatControls', 'Repositions shared chat, Quick Chat and input widgets according to the current panel size and expanded state.');
method('mm', 'a', '(ILjava/lang/String;Ljava/applet/Applet;)Ljava/lang/Object;', 'callJavaScript', 'Invokes a named function on the applet JavaScript window without arguments.');
method('mm', 'a', '([Ljava/lang/Object;Ljava/applet/Applet;Ljava/lang/String;I)Ljava/lang/Object;', 'callJavaScript', 'Invokes a named function on the applet JavaScript window with the supplied arguments.');
method('ov', 'a', '(III)Z', 'handleQuickChatKey', 'Dismisses or resets Quick Chat for its control keys, otherwise dispatches category key shortcuts.');
method('ov', 'b', '(I)V', 'reset', 'Initializes the iterator bucket, current link and returned-node cursor.');
method('qi', 'a', '(Z)I', 'getCurrentDayOfMonth', 'Sets the shared calendar to the monotonic wall-clock timestamp and returns Calendar.DAY_OF_MONTH.');
method('qi', 'b', '(B)V', 'releaseStatics', 'Clears the shared player-stat sort text references under the original guard.');
method('qo', 'a', '(IJJ)I', 'multiplyFixed16', 'Multiplies the long operands and returns their product shifted right by sixteen bits as an integer.');
method('qo', 'f', '(B)V', 'releaseStatics', 'Clears shared email-validation text under the original guard.');
method('rb', 'a', '(I)Ljava/lang/String;', 'getText', 'Returns the current prompt input builder contents as a String.');
method('at', 'c', '(Z)I', 'getPriceTextColor', 'Renders the trinket price white when club money covers it, otherwise red.');
method('fm', 'a', '(Z)Z', 'hasJagexModeratorRights', 'Tests whether the account rights level is at least two, the JMod threshold documented by the kit-selection message.');
method('cq', 'b', '(I)V', 'releaseStatics', 'Clears shared auction-log text, sprite and input-builder references under the original guard.');
field('rd', 'm', 'I', 'styleId', 'Assigned from the kit definition array index and used by KitStyleTile and the kit mesh builder.');
field('rd', 'g', 'I', 'unlockBitIndex', 'MSB-first unlock-mask index, with minus one meaning no unlock-bit restriction.');
field('rd', 'k', 'I', 'achievementBitIndex', 'Achievement bit required for this kit style, with minus one meaning no achievement restriction.');
field('rd', 'j', 'Z', 'requiresJagexModeratorRights', 'Requires rights level at least two; KitStyleTile explicitly labels these kits as available because the player is a JMod.');
field('rd', 'f', 'J', 'requiredAccessKey', 'Optional exact-match key; minus one permits any key.');
field('rd', 'l', '[[[Z', 'patternMasks', 'Two kit recoloring masks consumed by the mesh builder.');


method('wm', 'a', '(BLut;I)Lut;', 'resizeSpriteByJoiningEdges', 'Draws the source at the left edge, clips to the right half and redraws aligned to the right edge in a target-width sprite.');
method('wm', 'c', '(B)Z', 'isPublicChatInputActive', 'Checks that chat input is active and that the compose channel is the default channel zero.');
method('n', 'a', '(III)V', 'prepareRankingStatistics', 'Ensures capacity for ranking rows, sort indices and selection flags, then resets statistic extrema and row count before the rankings response is read.');
method('df', 'a', '(IIZI)Lvn;', 'createKitMesh', 'Copies the kit template and recolors its two pattern grids with the supplied kit colors.');
method('pt', 'a', '(IIIII)V', 'pushRasterClip', 'Saves the raster state then intersects its clip rectangle with the supplied bounds.');
method('ks', 'a', '(IIII)S', 'packHslColor', 'Packs hue in bits ten and above, saturation in bits seven through nine and lightness in the low seven bits.');
method('ut', 'e', '()V', 'setRasterTarget', 'Installs this sprite pixel buffer, width and height as the software raster target.');
method('ti', '$cfr$sneakyThrow', '(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;', 'rethrowUnchecked', 'Generic decompiler helper rethrows the original Throwable without wrapping it.');
method('u', '$cfr$sneakyThrow', '(Ljava/lang/Throwable;)Ljava/lang/RuntimeException;', 'rethrowUnchecked', 'Generic decompiler helper rethrows the original Throwable without wrapping it.');
method('nb', 'a', '(I)Z', 'hasPendingManagerActions', 'Tests whether the shared deque of queued ManagerAction objects is nonempty.');
method('nb', 'b', '(B)I', 'getTargetFramesPerSecond', 'Returns one billion divided by the configured nanosecond frame period.');
method('la', 'a', '(I)Z', 'isGuestSession', 'Returns the session flag set for guest entry and cleared after a successful account login.');
method('la', 'a', '(Z)V', 'showCurrentQuickChatMenu', 'Opens the shared Quick Chat menu using its current compose context.');
method('cq', 'e', '(I)Z', 'isLoggedInJagexModerator', 'Requires a nonguest session and rights level at least two, the JMod threshold.');
method('qb', 'b', '(I)Z', 'isDetachedFromGameTable', 'Reports whether this lobby game setup has no secondary-link membership in its game-id table.');
method('qb', 'h', '(B)I', 'getGameId', 'Returns the setup panel secondary key used for the lobby game-id table and game-details selection packet.');
method('he', 'h', '(I)Z', 'isDetachedFromPlayerTable', 'Reports whether the lobby player row has no secondary-link membership.');
method('rb', 'c', '(Z)V', 'releaseStatics', 'Clears shared prompt text resources under the original guard.');
method('lo', 'c', '(B)V', 'releaseStatics', 'Clears shared password-validator arrays and text resources under the original guard.');
method('lm', 'a', '(Z)V', 'releaseStatics', 'Clears shared tournament-lobby validation, text and Quick Chat cache resources under the original guard.');
method('ln', 'k', '(I)V', 'releaseStatics', 'Clears the shared drop-target integer buffer under the original recursive guard.');
method('na', 'a', '(I)V', 'releaseStatics', 'Clears shared vertical-scrollbar arrays and text under the original arithmetic guard.');
method('je', 'a', '(I)V', 'releaseStatics', 'Clears shared skeleton, kit-style and associated text arrays under the original guard.');
method('jg', 'h', '(B)V', 'releaseStatics', 'Clears shared draggable-widget text and resource references under the original arithmetic guard.');
method('ji', 'a', '(I)V', 'releaseStatics', 'Clears shared scrollbar text references under the original guard.');
method('ji', 'k', '(I)V', 'clearFadingSounds', 'Detaches all fading sounds then clears their shared node deque.');
method('jj', 'a', '(III)V', 'setChannelProgram', 'Applies a channel program change to each constituent MIDI PCM stream from the requested starting index.');
method('jm', 'a', '(I)V', 'releaseStatics', 'Clears shared delayed-packet text references under the original arithmetic guard.');
method('jo', 'g', '(I)V', 'releaseStatics', 'Clears shared demo-console text and array resources under the original guard.');
method('jq', 'a', '(Z)V', 'releaseStatics', 'Clears shared auction-help resource references under the original guard.');
method('jr', 'i', '(I)V', 'releaseStatics', 'Clears the shared received-auction-row reference under the original guard.');
method('js', 'a', '(B)V', 'releaseStatics', 'Clears shared app-screen sprite and text resources under the original guard.');
method('ju', 'h', '(B)V', 'releaseStatics', 'Clears shared validation-help text and long-array resources under the original arithmetic guard.');
method('kb', 'g', '(I)V', 'releaseStatics', 'Clears shared integer-write command text and mesh arrays under the original guard.');
method('ki', 'a', '(I)V', 'releaseStatics', 'Clears shared input-event form and text references on the valid guard path.');
method('kn', 'g', '(I)V', 'releaseStatics', 'Clears shared trinket-picker text and resources under the original guard.');
method('uv', 'a', '(B)Z', 'consumeSelection', 'Delegates selection consumption to the active player context-menu widget, returning false when absent.');


method('ih', 'a', '(III)[Lut;', 'createSolidNineSliceSprites', 'Builds one-pixel solid border sprites and a solid center through the nine-slice sprite helper.');
method('ih', 'a', '(ILnu;I)V', 'buildMatchKitPreviewSprites', 'Renders both team kit meshes to outlined preview sprites with opposing rotations for the requested viewing team.');
method('ih', 'a', '(Ljava/lang/CharSequence;Z)Z', 'isValidBasicDisplayName', 'Delegates display-name shape and basic character validation from index zero.');
method('gv', 'a', '(ZLjava/lang/CharSequence;I)Z', 'isValidBasicDisplayName', 'Checks display-name length, separators and normalization, then requires ASCII alphanumerics or allowed name separators from the requested index.');
method('jw', 'a', '(CI)Z', 'isBasicDisplayNameCharacter', 'Accepts ASCII letters and digits, hyphen, underscore, space and nonbreaking space, rejecting control characters.');
method('lh', 'a', '(IBI)Lut;', 'createSolidSprite', 'Creates a square sprite with every pixel initialized to the supplied color.');
method('cq', 'a', '(IIII)[Lut;', 'createSolidNineSliceSprites', 'Shares a solid border sprite across eight nine-slice positions and supplies a separate 64-pixel square center.');
method('ko', 'a', '(IIJ)V', 'sendLobbyPlayerRemoval', 'Sends lobby action seven with the player id; used by the Kick, Reject and Cancel controls on lobby player rows.');
method('mb', 'a', '(B)V', 'releaseStatics', 'Clears the shared display-name form reference under the original guard.');
method('mh', 'g', '(I)V', 'releaseStatics', 'Clears shared email-availability validation text under the original guard.');
method('mo', 'a', '(I)V', 'releaseStatics', 'Clears shared match-agent text and resource references under the original guard.');
method('mr', 'n', '(B)V', 'releaseStatics', 'Clears shared validated-text-widget arrays, text and resources under the original guard.');
method('mu', 'p', '(I)V', 'releaseStatics', 'Clears shared transition-dialog text and input-panel resources under the original guard.');
method('pj', 'h', '(B)V', 'releaseStatics', 'Clears shared alpha-container text and layout resources under the original guard.');


// Gameplay prediction, control sources and trinket effects reviewed together.
method('ap', 'b', '(B)Z', 'isTournamentSpectator', 'Combines spectator status with the tournament flag used by the champion notification and Tournament Game input context.');
method('ap', 'b', '(I)Z', 'usesTournamentSpectatorControls', 'Requires a tournament spectator and the extra server flag used by tournament input-context and return-routing controls.');
field('ap', 'A', 'Z', 'isTournamentMatch', 'The match-start flags identify tournament games; gates champion messages, tournament menus and the Tournament Game chat context.');
field('ap', 'v', 'Z', 'tournamentSpectatorControlsEnabled', 'The match-start flags enable tournament-specific input-context and return routing for spectators.');
method('nu', 'a', '(I)V', 'assignInitialControlledSlots', 'Chooses active participants controlled slots in priority order 3,4,the supplied slot,1, then resets footballer AI waits and the AI tick.');
method('nu', 'a', '(IZJII)Z', 'canParticipantUseCheat', 'Allows special account keys or JMod rights except for megamode, otherwise tests the active participant footballers cheat trinkets.');
method('nu', 'a', '(Lml;I)V', 'readDeltaState', 'Decodes phase time, participant deltas and the active phase agents, using delta footballer and ball state during play.');
method('nu', 'a', '(Lml;II)V', 'readFullState', 'Decodes participants, phase, kits, formations, lineups and results, then the complete active phase agents and physics state.');
method('nu', 'a', '(Lnl;B)V', 'adjustTackleForLooseBall', 'Simulates the loose ball trajectory against the tackling footballer and adjusts interception velocity, duration and any aerial action.');
method('nu', 'a', '(Lnu;III)V', 'reconcileAgentStatesFrom', 'Copies phase time and reconciles participant and active phase agents with their prediction-correction policy.');
method('nu', 'a', '(ZLki;)V', 'applyCheatCommand', 'Applies the participant cheat event: effect bits, ball-model toggles, big-head mode or megamode.');
method('nu', 'a', '(Z)V', 'releaseStatics', 'Clears shared CommonGame text and resource references under the original guard.');
method('nu', 'b', '(BI)I', 'findActiveTeamParticipant', 'Finds the first active participant on the requested team, retaining zero as the original missing-result value.');
method('nu', 'b', '(Z)V', 'drawOffscreenPlayerArrows', 'Draws shared OffscreenPlayerArrow entries while the local participant is active.');
method('nu', 'c', '(II)Z', 'participantHasBall', 'Compares the participant team and controlled slot with the ball possessor team and slot.');
method('nu', 'a', '(IJIIZLjava/lang/String;)V', 'sendTextPromptResponse', 'Sends the prompt target id, text, selected action and checkbox value in a byte-length-prefixed packet.');
method('mo', 'a', '(ILjava/lang/CharSequence;)Ljava/lang/String;', 'normalizeAccountName', 'Trims name separators, enforces the twelve-character limit and normalizes allowed account-name characters, returning null for an empty result.');
method('mo', 'a', '(ILmo;II)Z', 'shouldDeferStateCorrection', 'Defers correction for up to sixty-four attempts when the newer state has a recent local-participant control source.');
method('mo', 'a', '(Lmo;B)V', 'inheritControlSource', 'Resets control-source age and inherits its participant id; ParticipantAgent rejects retagging through its override.');
method('mo', 'a', '(Lmo;I)V', 'copySynchronizationMetadata', 'Copies the control-source participant and age without copying subclass state.');
method('mo', 'a', '(Lmo;III)V', 'reconcileStateFrom', 'Keeps prediction when correction is deferred, otherwise copies complete state and synchronization metadata.');
method('mo', 'a', '(Lmo;Z)V', 'copyCompleteStateFrom', 'Copies subclass state through copyStateFrom and then copies the synchronization metadata.');
method('mo', 'b', '(Lml;I)V', 'readSynchronizationMetadata', 'Reads the bounded control-source age and an optional four-bit source participant id.');
method('mo', 'a', '(Lml;I)V', 'writeReflectionCheckReply', 'Waits for reflection tasks, serializes their results or error codes, appends a CRC and removes the completed request.');
method('mo', 'b', '(I)Lut;', 'buildFirstDecodedSprite', 'Expands the first decoded indexed pixel buffer through its palette, preserves trim metadata and clears shared decode buffers.');
field('mo', 'b', 'I', 'controlSourceAge', 'Ticks since the last inherited control source; incremented by CommonGame ticks and decoded as an age bounded by sixty-four.');
field('mo', 'e', 'I', 'controlSourceParticipant', 'ParticipantAgent initializes this to its participant index; physics interactions inherit that source id for prediction reconciliation.');
field('mo', 'c', 'I', 'deferredCorrectionCount', 'Limits successive prediction-correction deferrals to sixty-four before accepting the replacement state.');
method('up', 'a', '(BZ)Z', 'usesTankAbilities', 'Recognizes Tank and Keeper archetypes, or an active Tank Clone trinket.');
method('up', 'a', '(ZB)Z', 'hasShinPads', 'Checks active trinkets for the Shin Pads type.');
method('up', 'a', '(ZIZ)Z', 'hasCheatTrinket', 'Matches cheat ids zero through nine to their granting trinket predicates when trinkets are enabled.');
method('up', 'a', '(ZZ)I', 'getTackleStunBonus', 'Returns the largest enabled trinket stun bonus, added to the tackled footballer action duration.');
method('up', 'a', '(ZZB)I', 'getDetailsPanelHeight', 'Sums portrait, stats, optional experience, trinkets and optional price section heights.');
method('up', 'a', '(BIZIIIIZ)V', 'drawDetailsPanel', 'Draws the portrait, name, archetype, stat bars, optional experience, trinket list and price sections.');
method('up', 'b', '(ZB)Z', 'hasTackleProtection', 'Checks enabled trinkets for tackle protection or Shin Pads before allowing a tackle hit.');
method('up', 'b', '(ZI)Z', 'hasSlalom', 'Checks enabled trinkets for Slalom.');
method('up', 'b', '(ZZ)Z', 'canTackleTeammates', 'Disallows same-team tackle hits when enabled Safe Tackler or Shin Pads trinkets suppress them.');
method('up', 'c', '(BZ)Z', 'hasActiveHorrorCostume', 'Checks enabled trinkets for the active horror-costume predicate used by portrait drawing.');
method('up', 'c', '(ZB)Z', 'usesHotshotAbilities', 'Recognizes the Hotshot archetype or an enabled Hotshot Clone trinket.');
method('up', 'c', '(ZI)Z', 'usesRangerAbilities', 'Recognizes the Ranger archetype or an enabled Ranger Clone trinket.');
method('up', 'f', '(I)Z', 'areTrinketsDisabled', 'Resolves the per-player override or account default; controls dimming and the explicit Trinkets Disabled label.');
method('jd', 'f', '(I)Z', 'areAccountTrinketsDisabled', 'Disables trinkets for a guest session or an account without positive remaining membership time.');
method('up', 'a', '(IB)V', 'setChatPanelY', 'Stores a new shared chat-panel Y origin and reapplies the current easing transition and Quick Chat placement.');
method('up', 'a', '(II)V', 'sendLobbyGamePreferences', 'Sends lobby action two with the current game preference bitset, two option values and packed option choices.');
method('fn', 'a', '(B)I', 'tackleStunBonus', 'Returns thirty extra stun ticks for type 57, sixty for type 58 and zero for other trinkets.');


method('tf', 'a', '(ILgn;)V', 'addFirst', 'Unlinks any existing membership and inserts the node immediately after the deque sentinel.');
method('tf', 'a', '(ILtf;)V', 'moveAllTo', 'Appends this entire deque to the destination using the tail-range splice helper.');
method('tf', 'a', '(Ltf;Lgn;I)V', 'moveTailTo', 'Detaches the range from the supplied source node through this deque tail and appends it to the destination tail.');
method('tf', 'a', '(Z)I', 'size', 'Counts the forward links from the sentinel and preserves the original guard result.');
method('tf', 'a', '(ZLjava/lang/CharSequence;)I', 'hashCp1252', 'Computes a base-thirty-one string hash from signed CP1252-encoded bytes.');
method('tf', 'b', '(ILgn;)Lgn;', 'firstFrom', 'Starts forward iteration at the supplied node, or at the first node when null.');
method('tf', 'c', '(I)Lgn;', 'next', 'Returns the saved forward cursor and advances it, returning null at the sentinel.');
method('tf', 'e', '(I)Lgn;', 'previous', 'Returns the saved reverse cursor and advances it toward the previous link.');
method('tf', 'f', '(I)[Lgn;', 'toArray', 'Copies nodes in forward deque order into an exactly sized array.');
method('tf', 'g', '(I)Lgn;', 'first', 'Starts forward traversal at the sentinel next link.');
method('nw', 'a', '(B)Lgn;', 'first', 'Starts this independent cursor at the owning deque first forward link.');
method('nw', 'a', '(BLgn;)Lgn;', 'lastFrom', 'Starts reverse traversal at the supplied node, or at the deque last node when null.');
method('nw', 'a', '(I)Lgn;', 'next', 'Returns the saved forward node and advances toward the sentinel.');
method('nw', 'a', '(ILgn;)Lgn;', 'firstFrom', 'Starts forward traversal at the supplied node, or at the deque first node when null.');
method('nw', 'b', '(B)Lgn;', 'previous', 'Returns the saved reverse node and advances toward the sentinel.');
method('nw', 'b', '(I)Lgn;', 'last', 'Starts reverse traversal at the sentinel previous link.');
method('nw', 'a', '(ILut;)V', 'buildDirectionalMarkerSprites', 'Builds four marker orientations by reflection and rotation and records their shared dimensions.');
method('dt', 'a', '(B)V', 'draw', 'Draws an active offscreen-player arrow with its optional player number, using the selected raster detail path.');
method('dt', 'a', '(IIII)V', 'updateScreenIntersection', 'Projects the target footballer, derives arrow direction and distance and intersects its ray with the viewport edge.');
method('ol', 'a', '(IBI)I', 'approachEased', 'Moves an integer one eighth of the remaining distance toward the target, with a minimum one-unit step.');
method('ol', 'a', '(IIIILbu;I)Ljava/awt/Frame;', 'tryEnterFullscreen', 'Selects a supported bit depth when unspecified, waits for the fullscreen task and cleans up a failed frame.');
method('ol', 'b', '(B)Z', 'canTrainAnySquadPlayer', 'Checks the result-view eligibility gates and whether a selected squad player has at least one hundred experience and an improvable stat.');
method('ol', 'g', '(I)V', 'releaseStatics', 'Clears shared result-view text and resources under the original guard.');
method('ma', 'a', '(Ljava/lang/String;IB)V', 'initializeAppletParameters', 'Loads network applet parameters with the fixed 640 by 480 client dimensions.');
method('ma', 'b', '(Z)V', 'showPendingServerNotice', 'Formats the pending server notice into the centered message panel and clears the pending reference.');
method('ma', 'd', '(Z)V', 'releaseStatics', 'Clears shared network-client text and resource references under the original guard.');
method('ma', 'j', '(B)V', 'readExternalUrlPacket', 'Reads the URL flags and ISAAC-decoded URL bytes and opens the decoded external URL.');
method('ma', 'k', '(B)V', 'updateChatPanelTransition', 'Adjusts the chat origin when the target changes and advances the shared eased layout countdown.');
method('ma', 'k', '(I)V', 'drawQuickChatOverlay', 'Dims the current raster clip and draws the shared Quick Chat layout when its visibility flag is set.');


method('ma', 'a', '(ZZZ)I', 'processAccountMenu', 'Processes account-name checks, registration, login, guest entry, support and browser actions, country-list loading and menu exit results.');
method('ma', 'a', '(IBLqb;Z)V', 'updateGameOptionControls', 'Applies lobby game or matching-preference selections, entitlement and dependency restrictions, tooltips and any changed game-options packet.');
method('ma', 'b', '(IZ)I', 'pollAccountMenuSelection', 'Processes account-menu selection while suppressing the actual login handshake in that call.');
method('ma', 'c', '(IZ)V', 'serviceClientInfrastructure', 'Updates canvas sizing and shared input, idle logout, resource-connection recovery, staged UI loading, audio setup and canvas replacement.');
method('ma', 'f', '(I)Lhd;', 'getLobbyPlayerListContent', 'Returns the shared lobby player-list scroll pane content node on the valid guard path.');
method('ma', 'i', '(I)V', 'enableChatResponseHandlers', 'Enables chat response packet ids eleven and twelve together with the supplied additional handler id.');
method('ma', 'n', '(I)V', 'processStartupInterface', 'Services the available account menu or startup/loading interface according to client and preparation stages.');
method('ol', 'g', '(II)Ljava/lang/String;', 'kickActionName', 'Maps action ids one, two and three to kick, slide and header text, otherwise the null label.');
method('ol', 'h', '(I)Ltf;', 'getTrainingActions', 'Returns the result-view deque populated with ManagerAction training operations.');
method('fn', 'a', '(BLjava/lang/String;)V', 'showLoginWithExtraText', 'Sets the login extra text and activates its shared account interface.');
method('fn', 'a', '(IB)V', 'setSoundEffectVolume', 'Updates active sound-handle volumes and the shared effect mixer channel gains for channels one and two.');
method('fn', 'a', '(Lgm;I)V', 'drawFootballerShadow', 'Projects the rendered footballer and draws a cached or generated shadow mask, with a radial fallback at lower detail.');
method('fn', 'd', '(B)V', 'buildBlurredModelSprite', 'Renders the shared model scene to a 540 by 140 raster, applies repeated white silhouettes and blur, then halves it into the destination sprite.');
method('fn', 'd', '(Z)Lot;', 'getIconSprite', 'Selects the trinket icon from its slot and mapped type, using the separate empty-slot sprite for type zero.');
method('fn', 'f', '(I)Ljava/lang/String;', 'updateChatComposeDisplay', 'Formats chat target and account prefixes, input status and caret, updates the shared input widget and returns its hover help text.');
method('fn', 'i', '(I)V', 'initializeAfterimagePool', 'Allocates the requested number of reusable EntityAfterimage objects.');
method('fn', 'q', '(I)V', 'releaseStatics', 'Clears shared trinket text, sprite, archive and layout resources under the original guard.');
method('up', 'a', '(B)Z', 'beginReconnectGracePeriod', 'Enables recoverable reconnect handling and sets its fifteen-second deadline, returning whether the client is in its connected stage.');
method('up', 'e', '(I)V', 'finishUiTransitions', 'Finishes modal animations, marks the loading dialog to complete and resets shared interaction feedback.');
method('pa', 'c', '(B)V', 'releaseStatics', 'Clears shared generated-panel text and trinket definition references under the original guard.');
method('pf', 'a', '(B)V', 'releaseStatics', 'Clears shared byte-storage text and integer buffers under the original guard.');
method('pp', 'a', '(Z)V', 'releaseStatics', 'Clears shared music-patch stream text references under the original guard.');
method('pw', 'g', '(I)V', 'releaseStatics', 'Clears shared auction-settings text, sprite and scroll-pane resources under the original guard.');
method('qa', 'g', '(I)V', 'releaseStatics', 'Clears shared league-help sprites, text and Quick Chat layout resources under the original guard.');
method('qb', 'a', '(I)V', 'releaseStatics', 'Clears shared game-setup panel text references under the original guard.');
method('qe', 'a', '(Z)V', 'releaseStatics', 'Clears shared archive-preloader text and sprite resources under the original guard.');
method('qk', 'a', '(B)V', 'releaseStatics', 'Clears shared checkbox text and layout resources under the original guard.');
method('qs', 'h', '(B)V', 'releaseStatics', 'Clears shared player-shop layouts, sprites and text resources under the original guard.');
method('qt', 'a', '(I)V', 'enqueueLoginRequiredDialog', 'Appends a new LoginRequiredDialog to the pending dialog deque.');
method('qt', 'c', '(B)V', 'releaseStatics', 'Clears shared button-menu screen text, sprite and audio resources under the original arithmetic guard.');
method('ra', 'g', '(I)V', 'releaseStatics', 'Clears shared game-mode help sprites, text and three-dimensional lookup tables under the original guard.');
method('ri', 'b', '(Z)V', 'releaseStatics', 'Clears shared beveled-text painter text and resources under the original guard.');
method('rm', 'f', '(I)V', 'releaseStatics', 'Clears shared ranking-screen resource references under the original guard.');
method('rq', 'a', '(Z)V', 'releaseStatics', 'Clears shared server-message screen, frame and text resources under the original guard.');
method('rt', 'g', '(I)V', 'releaseStatics', 'Clears shared stat-choice dialog sprites and text resources under the original guard.');
method('s', 'i', '(I)V', 'releaseStatics', 'Clears shared rotary-dial widget text references under the original guard.');
method('si', 'a', '(I)V', 'releaseStatics', 'Clears shared reflection-check text and resource references under the original recursive guard.');
method('sq', 'g', '(I)V', 'releaseStatics', 'Clears shared save-changes dialog text and model material references under the original guard.');
method('ta', 'g', '(B)V', 'releaseStatics', 'Clears shared team-management screen resources under the original arithmetic guard.');
method('td', 'a', '(I)V', 'resetChatComposition', 'Clears the shared chat input builder and restores compose channel zero.');
method('td', 'a', '(Z)V', 'releaseStatics', 'Clears shared trinket-catalog layout and text references under the original guard.');
method('tj', 'f', '(I)V', 'releaseStatics', 'Clears shared ball-agent text, sprite and array resources under the original guard.');
method('oj', 'j', '(B)V', 'releaseStatics', 'Clears shared loading-progress text and option-description tables under the original arithmetic guard.');


// Raster and text APIs reviewed against their pixel and layout operations.
method('ut', 'a', '(III[I[IIIIIIIII)V', 'blitAdditiveRows', 'Adds nonzero source RGB pixels to destination pixels with per-channel saturation.');
method('ut', 'a', '(III[I[IIIIIIIIII)V', 'blitAdditiveIntensityRows', 'Scales nonzero source RGB intensity before saturated additive blending.');
method('ut', 'a', '(I[I[IIIIIIII)V', 'blitMultiplyRows', 'Multiplies corresponding RGB channels when both source and destination pixels are nonzero.');
method('ut', 'a', '([IIIIIIII)V', 'blitHalfSizeAveragedRows', 'Averages each two-by-two source block into one raster pixel, substituting the destination color for transparent samples.');
method('ut', 'a', '([I[IIIIIII)V', 'copyPixelRows', 'Copies complete pixel rows, including zero pixels, with separate source and destination row skips.');
method('ut', 'a', '([I[IIIIIIIII)V', 'blitAlphaRows', 'Blends nonzero RGB pixels using one global opacity and the complementary destination weight.');
method('ut', 'a', '([I[IIIIIIIIIII)V', 'blitScaledRows', 'Samples nearest pixels using sixteen-bit fractional source coordinates and skips transparent zero pixels.');
method('ut', 'b', '([I[IIIIIIIIIIII)V', 'blitScaledAlphaRows', 'Blends nearest-scaled nonzero RGB pixels using a global opacity.');
method('ut', 'b', '(III)V', 'drawAlpha', 'Applies trim offsets and raster clipping before opacity blending; the ARGB override also multiplies per-pixel alpha.');
method('ut', 'c', '()V', 'rotateCounterclockwise', 'Transposes pixels in counterclockwise order and swaps dimensions, canvas dimensions and trim offsets accordingly.');
method('ut', 'c', '(II)V', 'draw', 'Draws clipped nonzero RGB pixels at the trim-adjusted position; ARGB sprites use their per-pixel alpha.');
method('ut', 'd', '(II)V', 'drawOpaque', 'Copies all clipped RGB pixels, including zero; the ARGB override retains its native per-pixel-alpha blending.');
method('ut', 'd', '(III)V', 'drawTinted', 'Clips and recolors neutral RGB pixels with the supplied tint; ARGB sprites blend shaded grayscale pixels.');
method('ut', 'b', '(IIIIII)V', 'rotateBilinear', 'Inverse-maps a clipped rotated and scaled rectangle and samples through drawBilinearPixel in each rotation quadrant.');
method('ut', 'c', '(IIII)V', 'drawRotatedBilinear', 'Uses the sprite canvas center as the source pivot and delegates to bilinear rotation at the supplied destination center.');
method('ot', 'b', '([I[IIIIIIIIIII)V', 'blitArgbScaled', 'Nearest-scales ARGB pixels and blends their source alpha against the destination; matches the reviewed Steel Sentinels body.');
method('ot', 'c', '([I[IIIIIIIIIIII)V', 'blitArgbScaledAlpha', 'Multiplies nearest-scaled source alpha by a global opacity before RGB blending; matches the reviewed Steel Sentinels body.');
method('ot', 'd', '([I[IIIIIIIII)V', 'blitArgbAlpha', 'Blends unscaled ARGB rows using source alpha multiplied by global opacity; matches the reviewed Steel Sentinels body.');
method('kg', 'a', '([I[B[IIIIIIIIII)V', 'copyPaletteRowsScaled', 'Nearest-scales indexed pixels through the palette, skipping index zero; matches the reviewed Steel Sentinels body.');
method('st', 'a', '(BLjava/lang/String;IILhu;)V', 'layoutRightAlignedLine', 'Caches a single text line with its final character position at the supplied right edge.');
method('st', 'a', '(IILhu;Ljava/lang/String;I)V', 'layoutCenteredLine', 'Caches a single text line with character positions centered around the supplied X coordinate.');
method('st', 'a', '(ILhu;IIIBLjava/lang/String;I)V', 'layoutWrappedText', 'Wraps text into cached lines and computes character positions using the requested horizontal and vertical alignment and line spacing.');
method('st', 'a', '(ILjava/lang/String;BLhu;I)V', 'layoutLeftAlignedLine', 'Caches a single text line beginning at the supplied left X coordinate.');
method('st', 'a', '(Lnu;II)V', 'initializeMatchMinimap', 'Selects the game and participant for drawMatchMinimap, shows the minimap and resets its slide animation and timing.');
method('st', 'b', '(III)V', 'setMinimapPosition', 'Stores the horizontal slide offset and vertical origin consumed by drawMatchMinimap.');
method('st', 'c', '(I)[I', 'createEightIntBuffer', 'Allocates an eight-entry zeroed integer buffer shared by achievement masks and fixed-size lookup/state data.');
method('lb', 'a', '(B)V', 'rebuildHotspotRegions', 'Parses hotspot tags and builds linked per-line rectangles from the cached text character positions.');
method('lb', 'a', '(BI)V', 'sendAchievementMaskRequest', 'Sends the subtype-two request queued by TutorialScenerySupport.requestAchievementMask.');
method('lb', 'a', '(III)Z', 'intersectsPlayerViewport', 'Tests the player footprint with twenty-pixel side margins and forty-pixel upper extent against the 640 by 480 viewport.');
method('lb', 'a', '(ILjava/lang/String;)V', 'sendModeratorCommand', 'Sends a short-length-prefixed command string on opcode 89 only for a logged-in JMod.');
method('lb', 'a', '(Lgm;I)Lak;', 'createFootballerDrawEntry', 'Creates a WorldDrawEntry of the supplied kind referencing the rendered footballer.');
method('lb', 'a', '(Ljava/lang/String;II)V', 'setHotspotHelpText', 'Grows and updates the per-hotspot help-text array returned for the hovered hotspot.');
method('lb', 'b', '(III)Ler;', 'hitTestHotspot', 'Tests all line rectangles belonging to each hotspot and returns the matching hotspot root region.');
method('lb', 'b', '(IIII)V', 'dispatchAction', 'Dispatches the base button action and then a hotspot-click callback for the local pointer position.');
method('lb', 'c', '(IIII)V', 'setBoundsWithTextHeight', 'Uses the text layout preferred height while applying the supplied position and width.');
method('lb', 'i', '(I)V', 'releaseStatics', 'Clears shared hotspot-widget sprites, text and arrays under the original guard.');
method('om', 'a', '(I)V', 'readSubmissionAcknowledgement', 'Consumes queued submission acknowledgements, verifies the CRC for subtype zero and matches subtype-one blob requests by request CRC.');
method('om', 'a', '(IB)V', 'layoutIconAndLabel', 'Measures the first child and places the second child after the requested gap in the remaining width.');
method('om', 'a', '(IIIIII)V', 'setBoundsAndLayout', 'Applies the composite bounds then lays out the icon and label using the requested gap.');
method('om', 'a', '(Ljava/math/BigInteger;Liw;BLiw;Ljava/math/BigInteger;)V', 'writeEncryptedLoginBuffer', 'Passes the populated source packet bytes and RSA parameters to writeEncryptedLoginBlock.');
method('om', 'b', '(II)I', 'measureWidthWithGap', 'Returns the sum of both child preferred widths and the supplied gap.');
method('om', 'b', '(I)V', 'releaseStatics', 'Clears shared icon-label resource references under the original guard.');
method('ew', 'a', '(B)V', 'snapshotMouseInput', 'Copies synchronized mouse button, pointer, press and movement state into the tick snapshot and consumes pending edge events.');
method('ew', 'a', '(IIB[B)V', 'readFully', 'Reads through pending writes, the read buffer and the backing file, fills sparse gaps with zero and throws EOFException for an incomplete request.');
method('ew', 'a', '(III[B)V', 'write', 'Buffers or directly writes the requested byte range, flushes discontinuous pending writes and updates overlapping read-cache bytes.');
method('ew', 'a', '(I[B)V', 'readFully', 'Reads exactly the destination array length from the current logical file position.');
method('ew', 'b', '(I)V', 'refillReadBuffer', 'Seeks to the logical position and fills the read cache until capacity or end of file.');
method('ew', 'e', '(I)V', 'flush', 'Writes pending bytes to the backing file, updates any overlapping read cache and clears the pending write range.');
method('ew', 'a', '(ILjava/lang/String;)Z', 'isActivePrivateChatRecipient', 'Checks that chat input is active in private-message compose mode and that the normalized recipient matches.');
method('ew', 'a', '(ZLsj;Lsj;I)V', 'initializeChatInterface', 'Builds shared chat widgets, loads chat-filter sprites and initializes Quick Chat definitions and menu resources.');


method('ew', 'a', '(BILml;III)I', 'readSignedFourRangeBits', 'Builds signed half-range offsets from four bit widths and delegates to the two-bit-selector signed-value decoder.');
method('ew', 'a', '(IILhu;Lhu;)V', 'configureLoadingDisplay', 'Stores both loading fonts and the display parameter, centers the loading display and updates its font metrics.');
method('fs', 'a', '(IIIIIIILml;II)I', 'readSignedFourRangeValue', 'Uses a two-bit selector to read a signed value of one of four widths and applies cumulative magnitude offsets.');
method('aq', 'a', '(IILml;)I', 'readSignedBits', 'Reads the requested bit width and sign-extends its highest bit through XOR and subtraction.');
method('aq', 'a', '(Ljava/lang/String;I)Ljava/lang/String;', 'highlightConsoleSyntax', 'Tokenizes the console source and wraps its token spans in the configured syntax colors.');
method('aq', 'c', '(I)Ljava/lang/String;', 'getPendingExternalUrl', 'Returns the stored URL consumed by the account-menu external-browser action.');
method('ll', 'a', '(I)[B', 'getBytes', 'Returns a new byte array containing the complete direct buffer contents, resetting its position before copying.');
method('ll', 'a', '([[[IIILea;I)I', 'colorBoxSliceMoment', 'Computes the four signed summed-moment corners for a box cross section at a supplied axis coordinate.');
method('ll', 'b', '(B)V', 'releaseStatics', 'Clears shared direct-storage sprites, font, menu and arrays under the original guard.');
method('ll', 'c', '(B)V', 'tickSharedInterface', 'Advances the chat-panel transition and shared UI timers under the original arithmetic guard.');
method('pf', 'a', '(Liw;I)V', 'readPackedRankingStatistics', 'Reads the four packed ranking statistic fields passed to appendRankingStatistics.');
method('ou', 'a', '(BLsj;)V', 'loadLogoModels', 'Loads logo.fo3d materials and meshes, scales them and records each mesh center before translating it to the origin.');
method('ou', 'a', '(III)Lut;', 'createStripedFillSprite', 'Renders the two-color repeating diagonal stripe tile with rounded vertical brightness falloff.');
method('ou', 'a', '(Z)Lut;', 'createRoundedEndMask', 'Creates the grayscale rounded-end mask multiplied into the striped progress bar end caps.');
method('ou', 'b', '(IIII)I', 'choosePopupX', 'Keeps the requested X if the popup fits, otherwise tries the opposite anchor side and then right-aligns to the raster.');


method('eg', 'a', '(IIIIIIII)V', 'drawOrthographic', 'Rotates and translates vertices, projects them using one constant depth divisor and draws the depth-sorted faces.');
method('eg', 'a', '(ZZJII)V', 'drawSortedFaces', 'Culls back faces, records optional pointer hits and draws faces by depth and render priority, dispatching near-clipped faces separately.');
method('eg', 'a', '(ZZLeg;[B[S[I[I[I)Lqc;', 'copyInto', 'Copies vertices into the target model and shares or copies alpha, color and shading arrays according to the requested policy.');
method('eg', 'a', '(ZZZ)Lqc;', 'copyForAnimation', 'Ensures reusable scratch arrays and copies into the shared animation model with the requested alpha and shading sharing.');
method('eg', 'a', '([I[I)V', 'drawTransformed', 'Combines camera and model transforms, culls the bounds, projects vertices with perspective and dispatches sorted faces with near-plane clipping.');
method('eg', 'b', '(I)V', 'rotateY', 'Rotates the X and Z vertex coordinates using the indexed sine and cosine tables and invalidates bounds.');
method('eg', 'b', '(IIIIIIII)Z', 'isPointInTriangleBounds', 'Tests a point against the axis-aligned bounds of the three projected triangle vertices.');
method('eg', 'c', '(I)V', 'drawClippedFace', 'Clips a face against depth fifty, interpolates shade values and rasterizes the resulting triangle or two-triangle quad.');
method('eg', 'e', '(I)V', 'drawFace', 'Chooses the face alpha, flat or shaded color, texture mapping and near-clipped rendering path.');
method('eg', 'f', '()V', 'rotateYQuarterTurn', 'Maps each X,Z vertex pair to Z,-X and invalidates bounds.');
method('kk', '$cfr$intArgs$a$842e35442ba4', '(IZZLjava/lang/String;)V', 'showLoginDialog', 'Full-integer guard overload that resets account-interface state, deactivates current modals and pushes the shared login form.');
method('kk', 'a', '(BZZLjava/lang/String;)V', 'showLoginDialog', 'Resets account-interface state, deactivates current modals and constructs and pushes the shared login form.');
method('kk', 'a', '(I)V', 'invalidateBounds', 'Marks the triangle mesh cached bounds invalid under the original arithmetic guard.');
method('kk', 'a', '(ILsj;IILsj;)Lcn;', 'loadFont', 'Loads glyph sprites and font metrics by numeric group and file ids, returning null until the sprite sheet is available.');
method('kk', 'a', '(ILtf;)Z', 'isWorldDrawListSorted', 'Checks ascending getSortY values through the consecutive WorldDrawEntry nodes at the front of the deque.');
method('kk', 'a', '(Lup;IZ)Lot;', 'getPlayerPortraitWithClubDefaults', 'Uses the current club kit and appearance defaults unless the player supplies its own appearance, then delegates to getPlayerPortrait.');
method('gm', 'a', '(Ljava/lang/String;ZB)Lgv;', 'enqueueFadingChatMessage', 'Creates a fading message and either queues it for a later screen or inserts it into the current message display.');
method('gm', 'a', '(Lsj;ILjava/lang/String;Lsj;Ljava/lang/String;)Lcn;', 'loadFontByName', 'Resolves group and file names in the glyph archive and delegates to the numeric font loader with the metrics archive.');
method('gm', 'a', '(IIZIIIZIIZZZII)V', 'updateSharedInterface', 'Clears tooltip state, displays pending server notices and routes pointer, keyboard and text-prompt updates through the shared interface.');
method('gm', 'a', '(IZLhd;Lkq;)V', 'drawPlayerSaleSummary', 'Draws the selected squad player portrait and sale value, a rejection warning or an empty-selection explanation in the supplied panel.');
method('gm', 'd', '(Z)V', 'drawFootballer', 'Projects and culls the footballer, draws optional diagnostics and renders directly or through the outline and color-effect sprite path.');
method('gm', 'h', '(I)I', 'getPerspectiveAdjustedY', 'Adjusts rendered world Y for positive height and pitch orientation, capping height below the projection denominator singularity.');
method('gm', 'i', '(I)V', 'restoreSharedDefaultButtons', 'Restores the default button set on each shared controller from the supplied starting index.');
method('aq', 'a', '(Z)I', 'getCameraY', 'Returns the integer part of the shared camera Y center used by world projection and camera motion.');
method('tq', 'h', '(I)I', 'getCameraX', 'Returns the integer part of the shared camera X center used by world projection and camera motion.');

method('ol', 'a', '(IIIBI)V', 'drawManagerRewards', 'Draws squad portraits, training controls, player experience, money and league-point rewards on the post-match screen.');
method('ol', 'a', '(Ltf;IIZ)I', 'drawGoalLogTable', 'Draws LoggedGoal rows with player, action and time columns, own-goal formatting and the empty-log message, returning the ending Y.');
method('ol', 'f', '(I)V', 'drawParticipantResults', 'Draws both team participant panels, rank badges, departure markers and rated or exhibition eligibility explanations.');
method('ol', 'i', '(I)V', 'drawMatchStatisticsPages', 'Draws the possession and minimap page, both goal logs and tackle or kick statistic tables with page and scroll controls.');
method('lm', 'a', '(II)Z', 'isTabVisible', 'The tab drawing and routing predicate returns true on its valid guard path, making each tab visible.');
method('lm', 'b', '(II)I', 'tabY', 'Returns the shared chat-panel boundary minus twenty for positioning tournament tab buttons.');
method('lm', 'a', '(ILml;)V', 'readTournamentStatistics', 'Reads participant statistic arrays and builds the per-player statistic and summary matrices, then resets scrolling.');
method('lm', 'a', '(Lml;B)V', 'readRoundUpdate', 'Reads bracket round records, the round index and readiness or countdown data, then rebuilds current-round match previews.');
method('lm', 'b', '(B)V', 'drawTournamentBracket', 'Draws linked round match boxes and scores, plus the final winner and trophy after completion.');
method('lm', 'e', '(I)V', 'drawCurrentRound', 'Draws the current round title, participant list with eliminated players struck out, rank badges, previews and countdown.');
method('lm', 'f', '(I)I', 'getRoundIndex', 'Returns the round index read by the round update and used to select the localized round title.');
method('lm', 'a', '(Ljava/applet/Applet;I)Lvl;', 'readLastLoginMethod', 'Matches the jagex-last-login-method cookie against login method names, returning the configured default when no match exists.');
method('lm', 'd', '(I)V', 'initializeTournamentStatics', 'Startup hook called by NetworkGameClient.initialiseClient; the valid guard path is empty and the invalid path releases shared resources.');
method('nt', 'a', '(ILsj;ILgq;)V', 'initializeLogoSequence', 'Computes the initial frame delay, decodes logo audio, loads models and final-frame sprites, and builds intensity and blurred-model resources.');
method('nt', 'a', '(Ljava/applet/Applet;B)V', 'updateSessionLinks', 'Decorates the codebase with session data and calls JavaScript updatelinks for home, games, servers, options and legal links.');
method('nt', 'c', '(IZ)V', 'updateKitTile', 'Refreshes the cached kit mesh, rotates hovered previews, sets unlock or rights help and handles selection or locked-kit notices.');
method('nt', 'h', '(I)V', 'drawKitTile', 'Draws the visible kit preview with selection or hover outlines, achievement and unlock markers and its price.');
method('nt', 'c', '(Z)V', 'finishSharedUiTransitions', 'Delegates to PlayerStats.finishUiTransitions on the valid guard path.');
method('nt', 'i', '(I)V', 'releaseStatics', 'Clears shared kit-tile byte and integer arrays and archive resources under the original guard.');
method('nt', 'j', '(I)V', 'updateTutorialCamera', 'Selects and interpolates tutorial camera targets and zoom for the tutorial stages, footballers, ball and scripted pitch positions.');
method('nt', 'k', '(I)[I', 'createDemoIntegerValues', 'Returns the integer array one through four used by DemoIntegersCommand.evaluate.');
method('at', 'a', '(Lhu;Lsj;B)V', 'initializeQuickChat', 'Creates Quick Chat category and phrase caches, finds the marked root category, and builds its styles, arrow sprite and root menu layout.');
method('at', 'i', '(B)V', 'drawTileText', 'Draws the trinket name and price for a tile intersecting the vertical viewport using getPriceTextColor.');
method('av', 'a', '(II[ILea;)V', 'labelColorBoxCells', 'Labels flattened thirty-three-cubed histogram cells inside the supplied ColorQuantizationBox with the requested palette index.');
method('dq', 'a', '(I)Ljava/net/Socket;', 'connect', 'Uses system ProxySelector HTTP and HTTPS candidates, preserves proxy-authentication failures and falls back to a direct socket; implements the SocketConnector contract.');
method('dq', 'a', '(BILjava/lang/String;Ljava/lang/String;)Ljava/net/Socket;', 'connectHttpTunnel', 'Opens an HTTP CONNECT tunnel through the proxy, writes optional authorization and handles success or proxy-authentication-required responses.');
method('dq', 'a', '(BILjava/util/Random;)I', 'nextBoundedInt', 'Requires a positive bound and uses unsigned multiplication for powers of two or rejection sampling and floorMod otherwise.');
method('dq', '$cfr$intArgs$a$7f8aad568c81', '(IILjava/util/Random;)I', 'nextBoundedInt', 'Full-integer guard overload of the bounded random generator, preserving multiplication and rejection-sampling behavior.');
method('dq', 'a', '(II)V', 'resendPendingSubmissions', 'Iterates queued blob submissions and the second pending-submission deque and writes their requests with the supplied opcode.');
method('dq', 'a', '(Lbu;Ljava/awt/Frame;I)V', 'exitFullscreen', 'Retries the platform exit-fullscreen task until success, then hides and disposes the fullscreen frame.');
method('bb', 'h', '(I)Z', 'hasActivatedItem', 'Tests menu item activation state and recursively checks the open submenu without consuming or resetting a selection.');
method('wt', 'a', '(ILfd;)Z', 'focusPreviousChild', 'Delegates backward keyboard-focus traversal to focusPreviousChildByStep with a step of one.');
method('wt', 'a', '(ILfd;I)Z', 'focusPreviousChildByStep', 'Finds the focused child and tries preceding child-array positions at the supplied step until a child accepts keyboard focus.');
method('wt', 'a', '(Lfd;II)Z', 'focusNextChildByStep', 'Finds the focused child and tries following child-array positions at the supplied step until a child accepts keyboard focus.');
method('wt', 'b', '(Lfd;I)Z', 'focusNextChild', 'Delegates forward keyboard-focus traversal to focusNextChildByStep with a step of one.');
method('wt', 'a', '(Z)Lfd;', 'getFocusedChild', 'Returns the first non-null child whose isFocused predicate is true.');
method('wt', 'a', '(Ljava/util/Hashtable;IILjava/lang/StringBuilder;)V', 'appendChildDebugTrees', 'Appends each indented child debug tree or a null marker to the diagnostic buffer.');
method('wt', 'a', '(ILnu;I[Lut;)V', 'initializePlayerArrows', 'Stores game, local participant and number sprites, creating four offscreen arrows for the local team or clearing them for spectators.');
method('wt', 'a', '(IZZIII)Lwh;', 'createFadingSoundPlayer', 'Creates and enqueues a FadingSoundPlayer while the shared pending-player list has fewer than sixteen entries, otherwise returns null.');
method('wt', 'a', '(I[Ljava/lang/String;)Lwn;', 'createNameSuggestionResponse', 'Creates an unsuccessful AccountRegistrationResponse containing the supplied name suggestions.');
method('wt', 'b', '(Z)V', 'releaseStatics', 'Clears shared array-container sprites and integer-array resources under the original guard.');
method('mf', '$cfr$intArgs$a$fbddc791f0bf', '(ILml;Z)V', 'readLeagueRankingPage', 'Full-integer guard overload reading a league ranking page into ListingRowCache, updating the LeaguesScreen table and optionally scrolling to the flagged or local-player entry.');
method('mf', 'a', '(CB)B', 'encodeCp1252Char', 'Maps ASCII, Latin-1 and the defined Windows-1252 extension characters to their byte values, using a question mark for unsupported characters.');
method('mf', 'a', '(IB)V', 'resendRankingsRequests', 'Iterates the queued RankingsRequest deque and writes each request with the supplied opcode.');
method('mf', 'a', '(I[Ljava/lang/CharSequence;II)Ljava/lang/String;', 'joinCharSequences', 'Concatenates the requested slice of character sequences with literal null text for null entries and no separator.');
method('mf', 'a', '(ZI)Lwn;', 'createTermsResponse', 'Creates a successful AccountRegistrationResponse and records whether acceptance of terms is required.');
method('mf', 'a', '([Lut;Z)V', 'initializeCheckboxSprites', 'Stores the tickbox sprite sheet, makes brightened copies of its first two sprites and retains the third shared sprite.');
method('mf', 'b', '(I)V', 'drawFadingChatMessages', 'Draws the shared FadingChatMessage array in eighteen-pixel rows inside the match chat raster clip.');
method('mf', 'h', '(B)V', 'initializeLocalizedUiTables', 'Builds shared localized action, validation, settings, round-title and game-option text arrays once after loading the language pack.');
method('mf', 'k', '(B)V', 'drawSquadSlots', 'Draws the squad grid background and nine clipped slots, drawing the actively dragged slot last.');
method('uv', 'a', '(IIZIIZIILbu;IJIILjava/lang/String;)V', 'initializeClientConnectionState', 'Creates inbound and outbound packet buffers, stores client connection and platform settings, and opens the platform cache file when present.');
method('uv', 'a', '(II[I)V', 'addSocialMenuItems', 'Adds friend, ignore, private-message and related player actions according to social-list membership and chat availability.');
method('uv', 'a', '(Ltv;B)V', 'addChatFilterMenuItems', 'Adds hide or filter actions for the selected non-system ChatMessage channel and remembers that channel for handling the selection.');
method('uv', 'a', '(ZI)V', 'addGameSetupMenuItems', 'Adds join, accept, reject or remove-style player actions according to the current GameSetupPanel and player invitation or membership state.');
method('uv', 'a', '(ZII)I', 'directionMaskFromVector', 'Converts the vector to an eight-direction angle then derives the movement direction bit mask.');
method('uv', 'b', '(IIB)I', 'angleFromVector', 'Computes a signed angle in the eight-thousand-one-hundred-ninety-two-unit circle using quadrant-aware fixed-point arctangent.');
method('uv', 'a', '(ZIIII)Z', 'dispatchSelectedAction', 'Retrieves the selected action, returns false for the supplied sentinel and otherwise dispatches secondary, social, primary and friend-prompt handlers.');
method('en', 'b', '(II)I', 'directionMaskFromAngle', 'Maps a signed circle angle to overlapping movement direction bits one, two, four and eight.');
method('en', 'a', '(II)V', 'decodeChatFilters', 'Unpacks three two-bit chat-filter values and clamps each decoded setting to at most two.');
method('vd', 'a', '(III)I', 'firstQuadrantAngle', 'Computes the first-quadrant angle from nonnegative vector components using a fixed-point ratio and an arctangent lookup helper.');
method('no', 'b', '(II)I', 'atanFixedPoint', 'Looks up the arctangent of a signed sixteen-bit fixed-point ratio, using reciprocal symmetry outside the unit interval.');

method('gr', 'a', '(B)Z', 'hasAuctionablePlayer', 'Requires canStartAuction and finds a nonempty squad slot without an associated auction log entry.');
method('gr', 'a', '(BLjava/lang/CharSequence;)Z', 'isDecimalInteger', 'Delegates to the signed base-ten integer syntax and overflow validator with leading plus enabled.');
method('gr', 'a', '(I)Z', 'hasActiveAuctionEntries', 'Returns true when an auction log entry has a type other than outbid type three; the entry toString identifies bid, buy, own and outbid types.');
method('gr', 'd', '(B)Z', 'hasFourAvailablePlayers', 'Counts nonempty squad slots without an auction log entry and requires at least four, as used by match-entry controls.');
method('gr', 'd', '(I)I', 'findEmptySquadSlot', 'When canStartAuction permits trading, returns the first empty squad index; otherwise retains the supplied failure value.');
method('gn', 'a', '(IIILjava/lang/StringBuilder;)V', 'appendPaddedBinary', 'Appends the binary integer representation with leading zeroes to meet the requested minimum width.');
method('gn', 'b', '(B)I', 'getSoundEffectVolume', 'Returns the shared volume used to scale FadingSoundPlayer and SoundStreamHandle playback.');
method('gn', 'c', '(B)V', 'unlink', 'Reconnects the previous and next intrusive links and clears both links on this node, doing nothing when already unlinked.');
method('gn', 'd', '(B)I', 'getMenuHeight', 'Returns the shared menu height calculated from item heights and used to draw the menu panel.');
method('no', 'a', '(Ljava/lang/String;I)Lld;', 'validateDomainLabel', 'Validates one DNS-style domain label: nonempty, at most sixty-three characters, alphanumeric or internal hyphens; used after splitting an email domain on dots.');
method('no', 'a', '([Ljava/lang/String;ILjava/lang/String;I)V', 'completeRegistrationResponse', 'Converts the account-menu response code into an AccountRegistrationResponse, including name suggestions or terms requirements.');
method('no', 'g', '(B)V', 'releaseStatics', 'Clears shared league-winner dialog strings, arrays and bytes under the original guard.');
method('no', 'g', '(I)V', 'updateTutorialRestrictions', 'Selects movement and action restrictions for the current tutorial stage through LoginCredentials.setTutorialRestrictions.');
method('bs', 'a', '(III)V', 'setMenuAnchor', 'Sets the shared X and Y anchor used by menu sizing and placement.');
method('bs', 'a', '([Lut;B)[Lut;', 'resetSpriteCanvasBounds', 'Clears each sprite trim offset and sets its logical canvas dimensions to its pixel dimensions, returning the same array.');
method('bi', 'a', '(IIII)V', 'setMenuTextColors', 'Stores the normal, heading and selected menu text colors used by CheckboxPainter when drawing menu rows.');
method('cr', 'b', '(I)Z', 'isAwaitingLoginResponse', 'Requires a live client socket and a protocol stage whose isLoginResponseStage predicate is true.');
method('dd', 'a', '(B)V', 'resetFrameTiming', 'Resets the shared tick clock, clears both thirty-two-entry timing histories and resets the timing sample counter.');
method('dd', 'a', '(I)Z', 'tickAnimation', 'Starts queued clips when their delays expire and advances the current frame when its frame countdown reaches zero.');
method('dh', 'a', '(BI)Lsj;', 'createResourceArchive', 'Creates the requested archive through the shared disk-backed archive factory with all-group prefetch disabled and the original resource loading options.');
method('dh', 'a', '(Lup;Z)I', 'calculatePlayerSaleValue', 'Returns one tenth of the calculated player value, rounding a positive value below ten up to one; used by sale summaries and sale actions.');
method('dh', 'b', '(Z)V', 'updateMenuCamera', 'Cycles projection targets while the main menu background is visible and delegates other camera modes to the shared camera update.');
method('dt', 'b', '(B)I', 'getTutorialBackgroundOpacity', 'Computes the clamped background opacity from the first tutorial stage footballer position, returning zero in other stages.');
method('ev', 'a', '(Lnu;II)V', 'drawGoalkeeperDiagnostics', 'Draws keeper target rays, reach and goal-distance circles, predicted goal-line intersections and action or damage text.');
method('fb', 'a', '(Lfd;Ljava/lang/String;IBI)V', 'drawCenteredWidgetLabel', 'Draws the supplied label centered on the widget width at the supplied offsets and baseline.');
method('fb', 'b', '(Z)Z', 'hasMissingDateParts', 'Returns true when any of the three numeric date input strings is null or empty.');
method('fb', 'i', '(B)[Lkg;', 'buildDecodedIndexedSprites', 'Constructs IndexedSprite objects from the shared decoded sheet dimensions, offsets, pixels and palette, then releases decode scratch arrays.');
method('cf', 'a', '(BLbc;)V', 'updateRankingRow', 'Validates category and row identity, updates rank, name and statistic text, and colors flagged or local-player entries.');
method('cf', 'a', '(ILsb;)Llk;', 'readQuotedExpression', 'Reads a quoted console token from StringCursor, preserves escaped characters and source position and selects its expression kind from the quote character.');
method('cf', 'b', '(I)V', 'drawRankingRow', 'Draws alternating row backgrounds, rank, player and statistic columns, or the unavailable-row text.');
method('cu', 'a', '(BII)V', 'trainPlayerStat', 'Applies and queues manager action type three for the supplied squad slot and stat, then refreshes the selected player when MySquadScreen is open.');
method('ch', 'a', '(BILnl;IIIILnu;Lnl;)V', 'captureGoalFromAction', 'Delegates to captureGoal with the supplied action type and zero charge, retaining the original unused player parameters.');
method('ch', 'a', '(Lnu;IIILnl;ILnl;II)V', 'captureKickGoal', 'Delegates to captureGoal with kick type one and the supplied kick charge, retaining the original unused player parameters.');
method('ch', 'a', '(ILsj;)Z', 'ensureArchiveAvailable', 'Delegates to ResourceArchive.ensureAllGroupsAvailable and returns its completion state.');
method('el', 'a', '(Lhd;ZLnp;ILjava/lang/String;[IJLjava/lang/String;I)V', 'createPlayerContextMenu', 'Stores the shared chat scroll pane and creates its PlayerContextMenu using the supplied player identity and action metadata.');
method('el', 'g', '(B)V', 'releaseStatics', 'Clears shared command strings and font resources under the original guard.');
method('el', 'g', '(I)V', 'setTutorialStage', 'Stores the tutorial stage, clears its current game state and resets the stage-ready flag.');
method('vl', 'a', '(IIZI)Lut;', 'createRingSprite', 'Creates a sprite with an outer filled circle and a transparent inner circle of the requested border thickness.');
method('vl', 'a', '(IZZLjava/lang/CharSequence;)Z', 'isIntegerInRadix', 'Validates a signed integer in radix two through thirty-six, optionally accepting leading plus and rejecting invalid digits or integer overflow.');
method('kt', 'a', '(Ljava/lang/CharSequence;ZBI)I', 'parseIntegerInRadix', 'Parses a signed integer in radix two through thirty-six, optionally accepting leading plus and throwing on missing digits, invalid digits or overflow.');
method('kt', 'a', '(ZLjava/lang/String;)Lkw;', 'getEmailAvailabilityRequest', 'Replaces a completed availability request when the query changes and returns the current email availability request.');
method('kt', 'a', '([BZ)Ljava/lang/String;', 'decodeCp1252Bytes', 'Decodes the complete byte array using the shared Windows-1252 decoder on the valid boolean path.');
method('uv', 'a', '(IBI)V', 'drawAnimatedPlayerMarker', 'Passes the requested screen coordinates to the default-phase animated player-marker drawing helper.');
method('c', 'a', '(IIII)V', 'drawAnimatedPlayerMarker', 'Delegates to PasswordValidator.drawAnimatedPlayerMarker with phase zero and full-size drawing.');
method('lo', 'a', '(IIIZB)V', 'drawAnimatedPlayerMarker', 'Chooses a marker frame from monotonic time plus the supplied phase and draws it centered at full or half size.');

method('gi', 'a', '(I)V', 'drawColorSwatch', 'Draws the swatch fill, selection-sized border, highlight sprites and selected-color marker.');
method('gi', 'a', '(ILpt;)Z', 'isAuctionListingUnqueued', 'Returns false if the pending listing deque already contains the same auction listing, otherwise true.');
method('gi', 'b', '(I)V', 'serviceFadingAudio', 'Services the shared audio outputs and updates each queued FadingSoundPlayer.');
method('fr', 'a', '(Lea;[[[IZ)I', 'colorBoxMoment', 'Computes the eight signed corners of the supplied summed-moment cube for the ColorQuantizationBox bounds.');
method('fr', 'a', '([Ljava/lang/String;I)V', 'setNameSuggestions', 'Clears old children, normalizes suggested names and builds a link-style button for each name plus the alternate-choice button.');
method('fr', 'h', '(B)Lqv;', 'getDefaultTextPainter', 'Lazily creates and returns the shared wrapping TextWidgetPainter with its fixed font, colors, line spacing and sizing defaults.');
method('fm', 'a', '(Ljava/lang/String;I)Lgg;', 'findSocialPlayerByName', 'Normalizes the requested and stored account names and searches the shared social-player hash table, resolving hash collisions by full normalized comparison.');
method('er', 'a', '(ZI[B)I', 'crc32Prefix', 'Delegates to the shared CRC-32 calculator over the byte array prefix from zero to the supplied length.');
method('dw', 'a', '(ZI)V', 'enterConfiguredFullscreen', 'Enters the configured native or browser fullscreen path, attaches input handlers to its canvas and updates the menu mode for success, failure or non-fullscreen use.');
method('ku', 'a', '(IIIIII)V', 'drawQuickChatToggleHint', 'Draws a rounded hint background and the Quick Chat show or hide label containing the configured toggle key.');
method('kt', 'b', '(B)V', 'drawQuickChatToggleHint', 'Draws the default Quick Chat toggle hint next to the shared chat-panel boundary.');
method('uv', 'a', '(Z)V', 'requestLoginMenuMode', 'Selects shared account-menu mode seventeen, as called when submitting the login form.');

method('be', 'a', '(IILjava/lang/String;)V', 'appendOutputLine', 'Appends a colored console output row, retains at most two hundred fifty-six rows, lays them out and scrolls to the end.');
method('be', 'a', '(ILjava/lang/String;B)V', 'printWrapped', 'Splits console output on newlines, wraps overwide lines to the scroll-pane width and appends the colored rows.');
method('be', 'a', '(ILjava/lang/String;I)Lhd;', 'createOutputLine', 'Creates a console text widget with the supplied color, the console font, measured width and fixed row height.');
method('be', 'a', '(Ljava/lang/String;I)V', 'rememberCommand', 'Adds a command to the front of console history unless it duplicates the latest command, then enforces the supplied history limit.');
method('be', 'b', '(ILjava/lang/String;I)Ltf;', 'wrapTextLines', 'Builds TextLine entries fitting the requested pixel width, preferring spaces and falling back to character boundaries for long words.');
method('kd', 'a', '(Ljava/lang/String;Z)Z', 'executeCommand', 'Tokenizes, parses and evaluates console input, prints its result and handles syntax highlighting or evaluation errors; implements the ConsolePanel contract.');
method('kd', 'b', '(B)[Ljava/lang/String;', 'getCommandSuggestions', 'Finds the command prefix at the caret, positions the suggestion panel and returns display signatures of matching commands.');
method('kd', 'b', '(I)V', 'completeCommandInput', 'Inserts the longest common suffix of matching command names at the caret, adds call parentheses when complete and positions the caret for arguments.');
method('kd', 'b', '(Ljava/lang/String;B)Lo;', 'findCommandsByPrefix', 'Collects registered console commands whose names begin with the supplied prefix into a secondary-link deque.');
method('kd', 'a', '(CB)Z', 'isCp1252Character', 'Accepts nonzero ASCII and Latin-1 characters or characters listed in the Windows-1252 extension table.');
method('kd', 'a', '(ILqb;ZLjava/lang/String;)V', 'buildGameSetupContextMenu', 'Creates the game-setup context menu, adds permitted spectate and show-or-hide-player actions, builds common items and positions the result at the pointer.');
method('wb', 'a', '(BI)V', 'selectTeam', 'Queues the participant team-selection event and, for a networked view, sends the selected team in opcode seventy-two.');
method('wb', 'a', '(ILjava/lang/String;I)Lwn;', 'createRegistrationFailure', 'Creates an unsuccessful AccountRegistrationResponse with the supplied response code and message.');
method('wb', 'a', '(ILjava/lang/String;ZIIIII)V', 'updateChatComposerPopup', 'Opens the chat composer from its shared button, lays out and updates the popup, and handles its close or reset controls.');
method('wb', 'a', '(Lhd;B)V', 'addTeamArrowButtons', 'Creates and styles the left and right arrow controls, adds them to the supplied parent and positions them at its edges.');
method('wb', 'a', '(Ljava/lang/String;IIIII)V', 'drawWrappedTextPanel', 'Delegates to the shared wrapped-text panel renderer with the original fixed text layout and background options.');
method('wb', 'b', '(B)V', 'initializeSelectionOverlays', 'Builds thirty-two colored ring frames and the shared footballer overlay drawn for ball carriers.');
method('wb', 'f', '(I)V', 'discardPendingManagerActions', 'Clears the shared deque of ManagerAction entries, as used by the discard option in SaveChangesDialog.');
method('wb', 'g', '(I)V', 'releaseStatics', 'Clears shared team-selection strings and array references under the original guard.');
method('wb', 'h', '(I)Z', 'pollArchiveMasterIndex', 'Returns the shared archive manager master-index polling result.');
method('nq', 'a', '(IILnl;IBI)V', 'setDirectionTowardPoint', 'Sets the footballer direction mask toward the supplied point with a dead zone, using the supplied fallback facing when already within it.');
method('nq', 'a', '(ZLjava/lang/String;J)Z', 'canSendPrivateChatTo', 'The private-chat send gate accepts a social player with a non-null availability string or a participant in the current game setup.');
method('nq', 'a', '([SLml;II)[S', 'readBaseOffsetShortArray', 'Reads an array length, four-bit offset width and sixteen-bit base, then fills or reuses a short array with base-plus-offset values; zero length returns null.');
method('nq', 'b', '(II)V', 'requestLeagueRankings', 'For non-guests without an outstanding request, sends opcode seventy-seven with the requested league category and marks the request pending.');
method('nq', 'b', '(III)V', 'setTooltipAnchor', 'Stores the tooltip X and Y anchor, as used by ValidatedTextWidget.getTooltip and consumed by CaptionedContainer tooltip positioning.');
method('nq', 'g', '(I)I', 'getMouseIdleTicks', 'Delegates to ConsoleTokenParser.getMouseIdleTicks on the valid guard path.');
method('nq', 'h', '(I)V', 'releaseStatics', 'Clears tournament-champion shared sprite and string resources under the original guard.');
method('nq', 'i', '(I)Z', 'isLogoSequenceComplete', 'Tests whether the logo frame counter initialized by KitStyleTile.initializeLogoSequence has passed frame two hundred fifty.');
method('uj', 'a', '(BI)Z', 'readPacketBytes', 'Accumulates up to the requested byte count from the client socket, retaining partial progress and handling disconnects, I/O failures and the session timeout.');
method('uj', 'a', '(B[Lit;[Ljava/lang/String;I)[Lut;', 'createParticipantNameSprites', 'Renders and outlines one name sprite per participant, coloring names according to whether they belong to the requested team.');
method('uj', 'a', '(IBIZZZ)Lsj;', 'createResourceArchive', 'Initializes shared disk-cache files, creates an archive source, optionally requests all groups and constructs the ResourceArchive with the requested loading options.');
method('uj', 'a', '(ILjava/lang/String;Ljava/lang/String;)Z', 'containsForwardOrReversedIgnoringUnderscores', 'Removes underscores from the searched text and tests for the supplied string or its reverse, as used by password validation.');
method('uj', 'a', '(Z)V', 'releaseStatics', 'Clears shared SetLagCommand strings, sprite and integer-array resources.');
method('uj', 'b', '(Z)V', 'showLoginForm', 'Requires the account UI, closes an existing form, creates LoginForm with the suggested account name and pushes and finishes its modal transition.');
method('qd', 'a', '(I)V', 'releaseStatics', 'Clears shared indexed-sprite state strings, meshes, deque and boolean-grid resources under the original guard.');
method('qd', 'b', '(II)V', 'setAccountMenuMode', 'Stores the shared account-menu mode consumed by PromotionDialog routing.');
method('qd', 'a', '(ILtf;[Ljava/awt/Point;)V', 'addPolygonGroundMarkers', 'Delegates the closed point polygon to the ground-marker line sampler with the fixed spacing of thirty-eight.');
method('wv', 'a', '(BILtf;[Ljava/awt/Point;)V', 'addPolygonGroundMarkers', 'Walks every polygon edge including the closing edge and adds sampled ground markers to the supplied draw-entry deque.');
method('nm', 'a', '(IIIIILtf;B)V', 'addGroundMarkerLine', 'Computes the segment length and adds evenly spaced ground marker WorldDrawEntry objects along the line at the requested spacing.');
method('ek', 'b', '(ZII)Lak;', 'createGroundMarker', 'Creates a ground-level draw entry at the supplied coordinates and chooses between two marker sprites from the coordinate parity bit.');
method('aw', 'a', '(IILsj;I)Lkg;', 'loadIndexedSprite', 'Decodes the requested archive sprite sheet and takes its first decoded IndexedSprite, returning null until the sheet is available.');
method('bc', 'a', '(Liw;I)V', 'readFromPacket', 'Reads a league ranking row account and display names, statistic values, rank index, category and row flags.');
method('bd', 'a', '(Ljava/lang/String;Ljava/lang/Throwable;I)V', 'reportClientError', 'Formats and prints a compact error, URL-escapes it and submits clienterror.ws with client, user and Java version details, swallowing report failures.');
method('cq', 'a', '(I)I', 'encodeChatFilters', 'Packs the three two-bit chat-filter settings into one byte with shifts zero, two and four.');
method('cq', 'a', '(ILsj;IILsj;)Luo;', 'loadBinaryFont', 'Decodes glyph sprites from the requested archive group and file, then creates a BinaryBitmapFont with metrics from the companion archive.');
method('cq', 'a', '(ZI)V', 'drawSharedChatInterface', 'Draws the shared social tabs and text panel, then the chat input and Quick Chat overlay through the two shared rendering helpers.');
method('cq', 'a', '([BZI)Ljava/lang/Object;', 'wrapByteStorage', 'Stores arrays larger than the supplied threshold in DirectByteStorage, otherwise returns the original array or a copy according to the copy flag.');
method('qe', 'a', '(I)Z', 'pollCompletion', 'Advances preload entries after their indexes and requested groups or full archives become available, updating progress and returning false at the first incomplete entry.');
method('qe', 'a', '(IILoc;)V', 'updateProgress', 'Sets the loading label from the current entry and percentage and computes weighted overall progress from the entry index.');
method('qe', 'a', '(ILsj;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)V', 'addPreloadEntry', 'Grows the preload-entry array and appends archive, numeric or named group, progress label and index-loading label metadata.');
method('qe', 'a', '(Ljava/lang/String;Lsj;I)V', 'addArchiveIndexPreload', 'Adds an entry requiring only the archive index, with the supplied index-loading message and no group or full-archive progress label.');
method('qe', 'a', '(Lsj;BLjava/lang/String;Ljava/lang/String;)V', 'addArchivePreload', 'Adds an entry requiring all groups in an archive, with progress and index-loading labels.');
method('qe', 'a', '(Lsj;Ljava/lang/String;ILjava/lang/String;Ljava/lang/String;)V', 'addNamedGroupPreload', 'Adds an entry requiring the named archive group, with progress and index-loading labels.');
method('qe', 'a', '(ZLjava/lang/String;)Z', 'isRepeatedCharacter', 'Tests whether every character equals the first character, as used by account-name and password validation.');

method('rb', 'a', '(BI)Z', 'isSix', 'Returns whether the supplied integer is six on the valid guard path; the sole meaningful caller is IsSixCommand.evaluate.');
method('rb', 'a', '(BLjava/lang/String;)V', 'requestAccountPage', 'Stores a requested relative account page such as terms.ws, privacy.ws or conduct.ws and selects account-menu mode twelve.');
method('rb', 'a', '(IIBI)Ltv;', 'rebuildChatHistory', 'Filters retained chat messages, rebuilds styled rows when needed, lays them out and maintains bottom-follow scrolling, returning the activated message.');
method('rb', 'a', '(ILhd;IILhd;)I', 'appendParagraph', 'Measures the paragraph height at the supplied width, adds it to the parent after an eight-pixel gap and returns the next row position.');
method('rb', 'a', '(ILjava/lang/String;ILhd;Lhd;B)I', 'appendLabelRow', 'Creates and adds a twenty-four-pixel text row at the supplied Y and returns Y plus thirty-two.');
method('rb', 'a', '(ZI)I', 'updateAndGetResult', 'Updates prompt text, mute toggle and nonempty-text-dependent action buttons, returning the chosen action, cancel value or pending result.');
method('rb', 'b', '(I)Z', 'isMuteSelected', 'Returns the state of the optional suggest-muting or forty-eight-hour mute control included by the report prompt constructor.');
method('rb', 'h', '(B)Z', 'interceptPromptKey', 'Intercepts keys while the prompt result is pending, recording cancellation when the shared key value is thirteen.');
method('tj', 'a', '(IIBI)V', 'setPositionAndStop', 'Sets ball X, height and Y and clears all three velocity components; RenderedBall extends this contract to update its render targets.');
method('tj', 'a', '(Ljava/lang/String;Ljava/applet/Applet;BJLjava/lang/String;)V', 'writeCookie', 'Builds a domain-scoped cookie with discard or expiry and max-age attributes and assigns it through the applet JavaScript bridge.');
method('tj', 'a', '(Lml;B)V', 'readFullState', 'Reads the ball possessor, three positions, three velocities, uncatchable and friction counters and model id from the bit stream.');
method('tj', 'c', '(Lml;I)V', 'readDeltaState', 'Uses change bits to decode optional possessor updates, signed position and velocity deltas and refreshed ball counters and model id.');
method('ob', 'a', '(BLtv;)Ljava/lang/String;', 'formatChatMessagePrefix', 'Formats the channel label, sender moderator badge and public or private-message sender prefix for a chat row.');
method('ob', 'a', '(II)I', 'measureTutorialMessageWidth', 'Chooses a tutorial message width from wrapped line counts and adds the surrounding panel allowance, returning zero for no message.');
method('ob', 'a', '(Lgm;B)V', 'updateBallVisuals', 'Sets held-ball render targets from its carrier, accumulates rolling rotation from displacement, queues bounce or movement sounds and captures friction afterimages.');
method('ob', 'b', '(IIIII)V', 'drawDottedRectangle', 'Writes white pixels at two-pixel intervals along the clipped rectangle edges.');
method('ob', 'i', '(I)V', 'releaseStatics', 'Clears shared rendered-ball strings and boolean-array resources under the original guard.');
method('ob', 'm', '(I)Z', 'pollAndMergeAchievementMask', 'Requests achievement mask four, waits for completion, ORs its eight result words into one shared mask and removes them from another before clearing the request.');
method('jt', 'a', '(IBII)Lwd;', 'getOrCreateRankingsRequest', 'Reuses a queued rankings request for the supplied query key or initializes, queues and writes a new request.');
method('jt', 'c', '(IZ)V', 'updatePitchTile', 'Updates pitch purchase controls and affordability, displays owned or prerequisite help and activates an owned tile when clicked.');
method('jt', 'h', '(I)Z', 'isPreviousTierLocked', 'Returns true when this is not the first pitch tier and the preceding tier for the same surface is not owned.');
method('jt', 'i', '(I)Z', 'isOwned', 'Returns the club ownership flag indexed by this pitch surface and tier.');
method('jt', 'j', '(I)V', 'drawPitchTile', 'Draws the surface-and-tier preview, owned or selected state, localized title, price and prerequisite lock marker.');
method('jt', 'k', '(I)Z', 'isSelected', 'Compares this tile surface and tier with the club currently selected pitch.');
method('sp', 'a', '(BI)[Lut;', 'createSolidNineSliceSprites', 'Returns a nine-sprite panel array with only its center populated by the shared sixty-four-pixel solid sprite factory.');
method('sp', 'a', '(ILfa;I)V', 'writeRequestAcknowledgement', 'Writes the supplied acknowledgement opcode, request subtype byte and request identifier short to the outgoing packet buffer.');
method('sp', 'a', '([BIII)Z', 'canStartConfiguredGame', 'Requires a player count between two and the configured maximum, rejects a matching forbidden configuration and checks the settings byte-three player-count condition.');
method('sp', 'c', '(II)Lwh;', 'playDefaultFadingSound', 'Delegates to ParticipantStatus.playFadingSound with the supplied sound id and the default volume and policy.');
method('sp', 'i', '(I)V', 'clampCameraToPitch', 'Clamps the camera center against zoom-dependent pitch margins and clamps the projection-distance value unless the unrestricted camera flag is set.');
method('sp', 'j', '(I)V', 'releaseStatics', 'Clears shared shop-player sprites, layout and string resources under the original guard.');
method('bc', 'a', '(B[I)V', 'initializeGamePacketLengths', 'Installs the game-specific incoming opcode lengths and variable-length sentinels in the shared table passed to the incoming-packet reader at startup.');
method('ca', 'a', '(II)V', 'writeChatFilterSettings', 'Writes the supplied opcode, fixed settings record header and packed chat-filter byte to the outgoing packet buffer.');
method('gd', 'a', '(IIII)V', 'setChatFilter', 'Changes the requested chat channel filter, marks chat rows for rebuilding and sends updated packed settings when the value changes.');
method('np', 'a', '(III)V', 'drawHalfSizePlayerMarker', 'Delegates to the animated player-marker renderer with zero phase and half-size drawing.');
method('np', 'a', '(IZZIZI)Z', 'layoutAndScroll', 'Unless the supplied suppression flag is set, lays out the scroll-pane content using its viewport height and advances scrolling.');
method('np', 'a', '(ZBIIIIZ)Z', 'layoutAndScroll', 'Chooses whether to lay out vertical content from interaction and hover flags, then advances the scroll state and returns that layout decision.');
method('qe', 'a', '(IIIII[IIII)V', 'rasterizeSortedTriangleHalfBlend', 'Rasterizes a triangle with Y-sorted vertices, clips its edge spans to the raster viewport and blends each span with the supplied constant color at half intensity.');

method('pq', 'a', '(ILjava/lang/String;Z)V', 'requestLeaguePlayerSearch', 'Writes opcode fifty-four with a variable-length player name and search-mode byte, then starts the league response timeout and pending state for non-guests.');
method('sp', 'a', '(Ljava/lang/String;B)V', 'requestLeaguePlayerSearch', 'Delegates the player-name search from LeaguesScreen to the league request writer with mode sixteen and pending state enabled.');
method('dr', 'a', '(I[I)Z', 'pollIncomingPacket', 'Reads ISAAC opcodes and their table-sized payloads, maintains packet history and optionally queues or delivers packets under simulated network lag.');
method('cq', 'a', '(ILjava/lang/String;B)Ljava/lang/String;', 'describeGameJoinStatus', 'Returns localized game-entry or invitation status text and substitutes the supplied player name for the named status case.');
method('mc', 'a', '(BJ)I', 'waitAndAdvanceTicks', 'Sleeps for the clock requested delay when positive and then advances its tick schedule using the supplied tick interval.');
method('mc', 'a', '(DDZ)D', 'cameraApproachSpeed', 'Returns the square root of distance times one-point-seven times the supplied approach parameter, as used to update camera velocity toward its projection target.');
method('mc', 'a', '(I)V', 'resetChatComposerLayout', 'Clears composer popup widgets, restores the saved shared text-entry layout and its styles when present, and resets the composer layout state.');
method('mc', 'a', '(JZ)Z', 'isTradingExemptAccount', 'Matches the two account ids exempted from the moderator auction restriction in squad and auction controls.');
method('np', 'h', '(B)Z', 'hasModeratorTradingExemption', 'Checks the current account id against the trading-exemption predicate used when blocking moderator auctions.');
method('np', 'a', '(I)Z', 'isLocalGameHost', 'Compares the local participant identity with the current GameSetupPanel host identity, as used to gate setup context-menu actions.');
method('np', 'b', '(I)V', 'resetArchiveFailureState', 'Clears the archive network client failure count and last failure status.');
method('np', 'h', '(I)V', 'advanceLoginTransition', 'Advances the shared account-dialog fade, opens the requested login form after fading out, then submits the pending score and reenters fullscreen when required.');
method('iw', 'a', '(ILut;)V', 'pushSpriteRaster', 'Saves the current raster state and installs the supplied sprite pixels and dimensions as the drawing target.');
method('iw', 'g', '(I)V', 'setAccountMenuMode', 'Delegates to the shared account-menu mode setter.');
method('ln', 'l', '(I)Ljava/awt/Canvas;', 'getActiveCanvas', 'Returns the fullscreen canvas when one exists, otherwise the regular game canvas.');
method('bl', 'a', '(ZZB)V', 'showLoginDialog', 'Delegates to the shared login dialog opener with the supplied modal flags and no initial text.');
method('hm', 'a', '(ZI)V', 'showLoginDialog', 'Opens the login dialog through LobbyMatchPreview.showLoginDialog with the second modal flag disabled.');
method('cd', 'a', '(BII)V', 'drawQuickChatToggleHint', 'Draws the default white Quick Chat hint at the supplied screen position with the current HUD opacity.');
method('ci', 'a', '(Z)V', 'drawMenuPanel', 'Draws the shared menu nine-slice background using measured menu bounds and then draws its text rows.');
method('jf', 'a', '(ILup;I)V', 'enqueueSellPlayerDialog', 'Adds a SellPlayerDialog for the supplied player and squad index to the shared pending-dialog deque.');
method('jf', 'g', '(I)V', 'releaseStatics', 'Clears shared DoSomethingCommand string resources under the original guard.');
method('ju', 'b', '(IC)C', 'titleCaseCharacter', 'Applies Character.toTitleCase except for micro sign and florin, whose original spelling is preserved.');
method('vi', 'a', '(II[[I[B)Z', 'matchesConfigurationRule', 'Returns true when all index-value pairs in any rule match the byte configuration, treating index minus one as the supplied player count.');

method('ql', 'a', '(BZLjava/lang/String;)V', 'startLoginTransition', 'Starts the shared account-dialog transition and records which login-form flag to use, as requested by WelcomeDialog, LoginRequiredDialog and fullscreen routing.');

method('kd', 'a', '(IIZZII)[Lkg;', 'createCrowdAnimationFrames', 'Builds six indexed bleacher sprites with sampled animated spectators, or reuses one empty-bleacher sprite when crowd rendering is disabled, reporting loading progress.');
method('pj', 'a', '(ZILtf;I)Lkg;', 'renderCrowdFrame', 'Draws the pitch backdrop, bleacher sprite and each spectator at the requested animation frame, then converts the combined raster to an indexed sprite.');

method('bf', 'a', '(BZIZ)V', 'drawLineupSlotPlaceholder', 'Draws the scaled lineup placeholder sprite, optional rounded highlight and slot number with selection-dependent opacity.');
method('bf', 'a', '(I[Ljava/lang/String;ILjava/applet/Applet;II)V', 'initializePromotionResources', 'Reads overxgames and overxachievements thresholds, checks the optional currency parameter and allocates one banner-sized sprite per supplied promotion label.');
method('bf', 'a', '(Ltv;B)V', 'openChatMessageContextMenu', 'Builds player actions from a chat message, adds channel, setup, social and filter actions and lays out the menu at the pointer.');
method('bf', 'a', '(ZLhd;)Z', 'containsGamePointer', 'Tests the game pointer coordinates maintained by mouse-lock routing against the supplied layout node interior.');
method('ba', 'a', '(ZII)V', 'buildFullscreenPromptMenu', 'Builds membership, fullscreen confirmation and failure menus, measures their wrapped text and actions and calculates row bounds and initial selection.');
method('ba', 'b', '(B)V', 'closeArchiveResources', 'Closes the archive network client, shuts down the archive worker and closes shared disk-cache files, swallowing individual file-close failures.');
method('bo', 'a', '(Lec;BLec;)I', 'pollRegistrationRequest', 'Delegates the account-registration request and response polling using the two supplied LoginText values and the original default options.');
method('m', 'a', '(ILec;Lec;IZLjava/lang/String;Z)I', 'pollRegistrationRequest', 'Writes encrypted registration or preflight payloads and polls responses, name suggestions, settings cookies and errors while managing reconnect and timeout state.');

method('ec', 'a', '(ZLjava/lang/String;I)I', 'measureMenuText', 'Measures text using one of the two menu fonts selected by the supplied flag.');
method('ec', 'a', '(ZLtv;)V', 'appendChatMessage', 'Counts retained messages of the same channel by filter visibility, evicts excess rows in each category and appends the supplied message on the enabled path.');
method('kj', 'a', '(B)V', 'playSelectionSound', 'Plays the default fading sound with id forty-four, as used when activating an owned pitch option.');
method('da', 'a', '(II)V', 'resendRequestAcknowledgements', 'Iterates the pending acknowledgement deque and writes each record with the supplied opcode.');
method('da', 'a', '(Lsj;ZLsj;Lsj;I)V', 'initializeAccountInterface', 'Creates a completed empty availability request, initializes account widgets and resets the shared login-state values.');
method('da', 'b', '(II)Lut;', 'getMessageDialogIcon', 'Selects the shared message-dialog icon for the supplied dialog type, including special league and report-related cases.');
method('da', 'a', '(I)V', 'initializeChatComposerPopup', 'Delegates shared chat-composer popup construction with its configured layout styles.');
method('fi', 'a', '(Lhd;Lhd;ILhd;Lhd;)V', 'initializeChatComposerPopup', 'Saves the current chat text-entry layout and creates the composer popup heading, text row and action widgets unless it already exists.');
method('m', 'a', '(BILjava/lang/String;IIIIII)V', 'layoutChatComposerPopup', 'Sets the composer heading and action text, positions the saved entry controls and sizes and centers the popup using the supplied row metrics.');
method('lo', 'a', '([Lli;Z[Ltm;Ljava/lang/String;)Lli;', 'invokeConsoleCommand', 'Finds the first console command matching the name and argument types and executes it, otherwise throws a descriptive undefined-method evaluation error.');
method('tm', 'a', '([Lli;ILjava/lang/String;)Z', 'matchesInvocation', 'Checks a console command name, argument count and primitive or reference argument compatibility before execution.');
method('tm', 'b', '(I)Z', 'isReflectionCheckReady', 'Returns true when a queued reflection check exists and all its requested field and method platform tasks have completed.');
method('tm', 'a', '(IIZLdg;)V', 'configureMenuPanel', 'Stores menu border and padding dimensions and the shared nine-slice panel painter.');
method('lo', 'a', '(JZ)Lhe;', 'findLobbyPlayerById', 'Looks up the LobbyPlayerRow in the shared player identity hash table.');
method('lo', 'a', '(III)V', 'drawRatedRewardsTable', 'Draws the Rated and Unrated reward comparison, showing winner and loser values in a bordered three-column table.');
method('lo', 'a', '(IIIIIZ)V', 'updateDirectionalIndicatorSprites', 'Rebuilds the cached indicator sprites when shape, color or direction parameters change, recolors their intensity pixels and rotates them to the requested vector.');
method('uc', 'a', '(Ltf;I)V', 'sortWorldDrawList', 'Sorts WorldDrawEntry nodes by projected Y, selecting the reversed ordering helper when the pitch orientation is reversed.');
method('uc', 'a', '(JII)V', 'sendGameJoinRequest', 'Writes the supplied opcode with action subtype six and the target player identity, as used for joining or accepting a game invitation.');
method('uc', 'g', '(B)V', 'openAccountInterface', 'Resets shared account state, enables the account interface, deactivates existing modals and updates the applet input mode.');
method('uc', 'g', '(I)V', 'releaseStatics', 'Clears shared IntTripleCommand strings, packet lengths and double-array resources under the original guard.');
method('uc', 'h', '(B)I', 'getFullscreenPromptWidth', 'Returns the difference between the fullscreen-prompt right and left bounds used to draw its menu panel.');
method('uc', 'h', '(I)I', 'getButtonPulseIntensity', 'Returns a periodic fading grayscale intensity during the last four hundred forty milliseconds of each pulse, otherwise minus one.');
method('kl', 'b', '(I)Z', 'isGamePointerOutsideViewport', 'Tests whether the mouse-lock-adjusted game pointer is outside the horizontal viewport or above or below the play-area boundary.');
method('kl', 'c', '(I)V', 'advanceSelectionOverlayFrame', 'Advances the shared selection-ring animation frame with the original counter wrap behavior.');
method('vc', 'a', '(IIB)I', 'floorDiv', 'Adjusts negative integer division to floor rounding for the positive row-size divisors used by scrolling.');
method('vc', 'a', '(Ljava/lang/String;I)V', 'setChatChannelLabel', 'Stores the label used when formatting channel-four chat message prefixes.');
method('vc', 'b', '(I)I', 'loadBeachSprites', 'Polls the beach group, returns loading progress until available and loads its deckchairs, parasol, ball, bucket, palms, starfish, ice cream and stains once.');
method('vc', 'f', '(B)V', 'closeSharedPopups', 'Closes the player context menu, hover tooltip, text prompt and Quick Chat menu.');
method('vc', 'h', '(B)V', 'updateTutorialPossessionAssist', 'Keeps tutorial possession on the selected footballer and enables catch assistance again when a loose slow ball and the controlled player are in the eligible area.');
method('vc', 'i', '(B)V', 'drawPlayerSelectionOverlays', 'Draws the ball-carrier overlay and animated control rings for active participants on the relevant team, emphasizing the local participant.');
method('vu', 'a', '(I)V', 'releaseStatics', 'Clears shared context-menu-item archive, array, scroll-container and string references under the original guard.');
method('vu', 'a', '(III)V', 'layoutIconAndLabel', 'Measures the optional icon and text child, constrains content to the row width and positions both children according to horizontal alignment.');
method('vu', 'a', '(IIIIIII)V', 'setBoundsAndLayout', 'Applies the context-menu row bounds and then lays out its icon and label using the supplied gap and padding.');
method('vu', 'a', '(ZZ)V', 'drawSharedPopups', 'Draws the active tooltip, player context menu, dialog, report prompt and Quick Chat keys help using the supplied interaction state.');
method('vu', 'b', '(I)V', 'clearChatHistory', 'Clears the retained ChatMessage array entries and resets its used length.');
method('vu', 'b', '(III)I', 'measureWidthWithPadding', 'Returns the optional icon and label preferred widths plus the supplied gap and two side paddings.');
method('jw', 'a', '(JIB)I', 'multiplyFixed16', 'Multiplies a long fixed-point value by the supplied integer, shifts right sixteen and returns the narrowed integer result.');
method('jc', 'b', '(I)Z', 'canSendPrivateChatToSelectedPlayer', 'Checks private-chat eligibility for the shared selected player name and identity.');

method('nr', 'a', '(II)V', 'drawSpectatorFrame', 'Applies the selected crowd animation frame to the spectator model, draws its shadow and rasterizes the model into the shared sprite before half-size blitting.');
method('nr', 'a', '(IIBIIIIIIILhu;Lhu;Ldg;IIILdg;IILdg;I)V', 'configureSharedMenuTheme', 'Configures shared loading fonts and metrics, text styles, menu anchor, panel geometry and normal, heading and selected menu colors.');
method('nr', 'a', '(ILml;IIII)I', 'readSignedTwoRangeValue', 'Uses a one-bit selector to decode a signed value of one of two widths, applying a signed magnitude offset for the extended range.');
method('kr', 'a', '(Lhd;ZI)V', 'openChatFilterMenu', 'Builds the public, game or private chat filter choices with icons and positions their context menu beside the supplied widget.');
method('kr', 'a', '(Ljava/lang/String;IB)Ljava/lang/String;', 'formatLobbyPlayerStatus', 'Formats status notices such as entering or joining a game, leaving the lobby or losing connection, substituting the supplied player label.');
method('vl', 'a', '(Z)Z', 'shouldDelayTooltip', 'Delays a new tooltip when none is currently shown and the pointer has been idle for fewer than ten ticks.');
method('qd', 'a', '(BLjava/lang/String;)V', 'showTextTooltip', 'Marks the tooltip as requested, respects the shared tooltip delay and selects the supplied text for the plain-tooltip renderer.');
method('qd', '$cfr$intArgs$a$b6210757cdab', '(ILjava/lang/String;)V', 'showTextTooltip', 'Full-integer guard overload requesting a delayed plain text tooltip.');
method('je', 'a', '(BLpu;)V', 'showTrinketTooltip', 'Marks a tooltip request, respects the shared delay and selects the supplied TrinketSlot for its details-card renderer.');
method('ka', 'a', '(IIB)V', 'showCurrencyTooltip', 'Selects the currency tooltip with its base amount and optional signed change after the shared tooltip delay.');
method('ka', 'a', '(ILjava/lang/String;)V', 'setServerMessageText', 'Stores the text drawn by ServerMessageScreen.');
method('hr', 'b', '(I)V', 'measureQuickChatToggleHint', 'Sets the hint background width from the wider of its two toggle labels plus the supplied padding.');
method('hk', 'g', '(I)V', 'releaseStatics', 'Clears shared auction-bid dialog array and string resources under the original guard.');
method('jw', 'a', '(I)V', 'releaseStatics', 'Clears shared checkbox-label font, widget and string resources under the original guard.');
method('lr', 'f', '(I)V', 'releaseStatics', 'Clears shared formation-view sprites, boolean arrays and text resources under the original guard.');
method('lr', 'g', '(II)V', 'selectFormation', 'Queues the participant formation event and sends opcode seventy-three with the selected formation for a networked view.');
method('ii', 'a', '(B)V', 'playUiClickSound', 'Plays fading sound forty-eight when activating menu buttons, selecting tabs or accepting dialog actions.');
method('ei', 'a', '(ZZ)V', 'drawContentTransitionAndTooltip', 'Draws the shared content transition and then the plain tooltip when one is available.');
method('vs', 'a', '(ZZB)V', 'drawDimmedSharedOverlay', 'Dims the current framebuffer or clears it according to the supplied flag, then draws the shared overlay widget.');
method('ha', 'c', '(IZ)V', 'drawDimmedSharedOverlay', 'Delegates to the shared overlay renderer with background dimming enabled.');

method('cc', 'a', '(I)V', 'normalize', 'Computes the fixed-point quaternion squared magnitude and rescales all four components when it lies outside the unit-length tolerance.');
method('cc', 'a', '(Lcc;I)V', 'preMultiply', 'Computes the Hamilton product of the supplied quaternion with this quaternion, stores the result and normalizes it.');
method('d', 'a', '(B)V', 'resetTooltipTracking', 'Clears the tooltip dwell counter, pending label, anchor coordinates and visibility tracking flag.');
method('hl', 'a', '(ZLhd;)V', 'resetChildScrollLayout', 'Clears vertical position, height and scroll offsets on the supplied layout node and each immediate child.');
method('cj', 'a', '(IIIIZIZ)V', 'updateChatComposerPopup', 'Chooses the default chat composer heading for the current mode and delegates the popup update with the supplied layout and input parameters.');
method('cj', 'k', '(I)I', 'getVolumeScale', 'Returns the full volume scale of two hundred fifty-six used to clamp, step and render the music and sound controls.');
method('qo', 'a', '(ZB)Z', 'pollClientConnection', 'Starts or polls the asynchronous client socket request, resets packet cursors, writes the initial handshake and records either the connected or failed protocol stage.');
method('qo', 'd', '(B)Ltf;', 'createConsoleCommands', 'Creates the developer-console command registry with arithmetic, array, conversion, lag and broadcast commands and their parameter types.');
method('qo', 'e', '(B)I', 'getFullscreenPromptHeight', 'Returns the measured height used when drawing the fullscreen-prompt menu panel.');
method('qo', 'g', '(I)Lot;', 'createBallCarrierOverlay', 'Draws concentric grayscale circles, downsamples them and converts intensity to white per-pixel alpha for the ball-carrier overlay.');
method('lr', 'a', '(Ljava/awt/Component;I)V', 'detachKeyHandler', 'Removes the shared key and focus listeners from the supplied AWT component and resets the key-handler state.');
method('lr', 'b', '(B)V', 'closeClientSocket', 'Closes and clears the shared client socket when present.');
method('dh', 'a', '(IILiw;II)V', 'writeClientHandshake', 'Writes the initial client connection header, fixed protocol fields and supplied client identifiers to the packet buffer.');
method('pc', 'a', '(II)I', 'approximateSquareRootFixed8', 'Uses a precomputed rounded square-root table and power-of-four rescaling to approximate the nonnegative integer square root with eight fractional bits.');
method('de', 'a', '(IB)I', 'approximateSquareRoot', 'Drops the eight fractional bits from the shared fixed-point square-root approximation.');
method('hg', 'a', '(IB)V', 'resendLookupRequests', 'Writes all pending lookup record updates and lookup queries using the supplied opcode.');
method('hg', 'g', '(I)I', 'pollAccountUiAction', 'Processes account-modal pointer, animation and keyboard input, consumes a queued menu action and returns availability or login-state actions.');
method('iu', 'a', '(II)V', 'updateAccountInterface', 'Runs the account UI action poll to advance its modal input and animation state, discarding the returned action.');
method('gu', 'a', '(ZIIZI)Lsj;', 'createResourceArchive', 'Delegates to the shared archive factory with the supplied archive id, loading policy and optional all-group prefetch.');

method('io', 'a', '(I)V', 'loadInstructionSprites', 'Polls and loads stadium icons, keyboard and arrow-key states and mouse-button or wheel instruction sprites.');
method('io', 'a', '(III)V', 'drawButton', 'Draws the enabled, hovered or pressed button sprite, mode-dependent label, volume slider and any disabled overlay or hover help.');
method('io', 'a', '(IIZILup;ZI)V', 'showPlayerStatsTooltip', 'Requests the detailed PlayerStats tooltip, recording its display flags and dimensions after the shared tooltip delay.');
method('io', 'a', '(ZI)V', 'stepVolume', 'Changes the button music or sound-effect volume by one eighth of the full scale and clamps it to the valid range.');
method('io', 'a', '(ZZZII)V', 'updateButtonInput', 'Updates hover state, activates ordinary buttons on click and tracks and applies volume-slider pointer dragging.');
method('pe', 'a', '(IB)V', 'setSoundEffectVolume', 'Delegates the requested sound-effect volume to the shared sound-stream volume updater.');
method('pe', 'a', '(I)V', 'updateFullscreenModals', 'Detects a canceled fullscreen canvas, opens its error dialog and routes modal pointer, animation and keyboard updates.');
method('sk', 'a', '(B)I', 'getMusicVolume', 'Returns the shared music volume used by the music-volume menu button and its slider.');
method('sk', 'a', '(Z)V', 'readAcknowledgementResult', 'Consumes four integer fields and removes the first queued acknowledgement, closing the client socket if no matching pending record exists.');
method('ju', 'a', '(FLjava/lang/String;B)V', 'setLoadingStatus', 'Stores the loading progress value and label rendered by the shared loading canvas path.');
method('ju', 'a', '(IILsj;B)Lut;', 'loadSprite', 'Decodes the requested archive sprite sheet and constructs its first Sprite, returning null until the sheet is available.');
method('ra', 'a', '(IIIII)[I', 'clampTooltipPosition', 'Keeps the supplied tooltip rectangle inside the six-hundred-forty by four-hundred-eighty viewport with a two-pixel margin.');
method('ra', 'i', '(B)V', 'closeHoverTooltip', 'Clears the shared HoverTooltip reference under the original guard.');
method('bh', 'a', '(Z)V', 'requestLoadingProgressDialog', 'When enabled, opens the shared loading-progress dialog and queues account-menu action four.');
method('lj', 'a', '(IZ)I', 'scaleLobbyPreviewCoordinate', 'Scales a pitch coordinate by twenty-three over two hundred fifty-six for the dimensions of LobbyGameRecord match previews.');
method('dn', 'a', '(I)V', 'validateLoadingGuard', 'Evaluates the original arithmetic guard used by the loading-canvas path; it changes no state on a valid input.');

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
      '`KitStyleDefinition` stores the kit pattern masks and achievement, unlock and JMod-rights requirements. `KitPatternMaskSupport` decodes those masks; `AuctionsHelpScreen.createKitMesh` applies them to the template mesh.', '',
      '`AchievementQuery` / `AchievementSubmission`, `LookupQuery` / `LookupRecordUpdate`, `HighScoreQuery` / `HighScoreSubmission` and `RankingsRequest` describe queued protocol operations. `PcmPlayerService`, `PcmMixerListener`, `PcmSampleStream` and `MidiPcmStream` expose scheduling, playback and MIDI control.', '',
      '`LocalizedTextLoader` supplies the language pack. `ClientProtocolStage`, `RegistrationRequestState`, `AccountNameCheckState` and `AccountInputValidationResult` distinguish transport and account states. `ModelMaterialDecoder` / `ModelMaterial` decode the logo model palette.', '',
      '`TutorialScenerySupport` builds tutorial boundaries and scenery; `PitchDecorationSupport` supplies surface decorations and `GoalSpriteLoader` loads goal sprites. `SharedWidgetFactory`, `MatchUiLayoutSupport` and `SocialListLayoutSupport` build and position the common UI. `ConsoleLexer` / `ConsoleTokenParser` retain console token source positions.', '',
      'The obfuscator moved independent static helpers between owners. Owner names describe their retained role; individual method names describe each helper without changing its placement or calls.', '',
      'Sprite operations, request completion, calendar and character boundaries, Quick Chat decoding, PCM mixing, MIDI controller dispatch and summed color moments are checked against independent native Java expectations in both raw and named corpora. These focused checks do not establish full gameplay or multiplayer equivalence.', '',
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
