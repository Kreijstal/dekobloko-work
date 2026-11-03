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
method('ut', 'd', '(II)V', 'drawWithOffsets', 'Body is identical to zombiedawn Sprite.drawWithOffsets.');
method('ut', 'f', '()Lut;', 'flipHorizontal', 'Body is identical to wizardrun Sprite.flipHorizontal.');
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
method('ut', 'a', '(III)V', 'drawWithOffsets', 'Body closely matches zombiedawn Sprite.drawWithOffsets.');
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
field('up', 'q', 'I', 'playerType', 'toString prints uf.field_e[field_q] as Type and -1 means an empty player.');
field('up', 'e', 'I', 'initialIndex', 'getDisplayName upper-cases the letter td.field_a[field_e] as the first-name initial.');
field('up', 'l', 'I', 'surnameIndex', 'getDisplayName appends ce.field_G[type][field_l] as the surname.');
field('up', 'j', 'I', 'appearance', 'toString prints it as "Appearance".');
field('up', 'n', 'I', 'power', 'toString prints it as "POW".');
field('up', 'o', 'I', 'tackle', 'toString prints it as "TCK".');
field('up', 'g', 'I', 'speed', 'toString prints it as "SPD".');
field('up', 'r', 'I', 'experience', 'toString prints it as "EXP".');
field('up', 'h', '[I', 'trinketIds', 'toString prints "Num Trinkets" from its length and the ids list.');
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
