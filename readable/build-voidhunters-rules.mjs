import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';
import {diffClasses, scriptClasses, getters, diffFields} from './voidhunters-diff-names.mjs';

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

export const config = {
  game: 'voidhunters', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-voidhunters-rules.mjs', 'reproduce-voidhunters.mjs', 'voidhunters-diff-names.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Void Hunters', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `VoidHunters`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
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
