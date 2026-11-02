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
