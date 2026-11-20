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
      '`SerializableGameState` names `readState`, `writeState`, `copyTo` and `differsFrom` across the simulation. `CompactGameState` exposes its additional packed representation. `PacketBuffer`, `IsaacPacketBuffer` and `IsaacCipher` separate byte codecs, bit codecs and encoded protocol bytes.', '',
      '`MissionEvent.evaluateAndExecute` evaluates each condition, applies its negation flag, collects target body ids and executes actions. Conditions and actions expose descriptions, editable parameters and world marker positions. `GameStateFactory` names default-instance and typed-array creation; each named concrete factory identifies its product type.', '',
      '`GraphicsToolkit` has software, native software, OpenGL and Direct3D implementations. `GpuToolkit` shares the hardware path between `OpenGlGpuToolkit` and `Direct3DToolkit`. `ProceduralTexture` connects `TextureOperation` inputs; `ColorRowCache` and `MonochromeRowCache` retain their computed rows. The native-memory and Direct3D Java wrappers have names matching the operations they dispatch.', '',
      '`GraphicsToolkit` names clipping, projection, drawing, pixel transfer, sprite/font creation, framebuffer selection and heap management. `ToolkitSprite` exposes dimensions, padding, scaled/rotated/affine drawing and tiling across backends; `SoftwareRenderContext` owns the software triangle rasterizer. `Transform3D` names camera setup; the OpenGL and GPU transforms expose matrix export and rigid inversion. `NativeDisposalQueue` manages deferred `NativeResource` cleanup. `OpenGlPostProcessor` runs `OpenGlPostEffect` passes; `OpenGlBloomEffect` implements luminance thresholding, blur and compositing.', '',
      '`ToolkitFont` exposes ordinary and masked glyph drawing. Its software palette, monochrome and alpha variants name their pixel blitters; `GlyphMask` names the software span mask and OpenGL texture mask. Renderer capability names follow the original diagnostic messages for memory pools, backbuffers, shadows, bloom, environment maps, anti-aliasing, threads, particles, underwater effects, clipping and point lights.', '',
      '`AudioPump` services `AudioOutput`; `JavaSoundAudioOutput` submits mixed PCM through Java Sound. `PcmStreamMixer` combines child streams and scheduled listeners. `MidiPcmStream` reads `MusicTrack` events with `MidiFileReader`, manages patch notes and controllers, and mixes them through `MusicPatchPcmStream`. `PcmSampleStream` names its forward/reverse, mono/stereo, interpolated/aligned and gain-ramped mixing kernels. `SoundCache` loads music samples and synthesized `SoundEffect` samples. `SoundInstrument`, `SoundEnvelope` and `SoundFilter` expose synthesis; `VorbisSample` decodes compressed music through its codebooks, floors, residues and mappings.', '',
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
