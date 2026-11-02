import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Dr Phlogiston export. Similar
// names in other games are corroborating role evidence, never copied IDs.
const classes = {
  gi: ['IntrusiveNode', 'Two links (next, previous) with a primary unlink that splices neighbours and nulls both links; same shared role as other FunOrb games.'],
  uh: ['DualLinkNode', 'IntrusiveNode subclass with an independent secondary link pair and secondary-only unlink.'],
  li: ['GameAppletShell', 'Applet/Runnable lifecycle with focus/window listeners, paint, start/stop and abstract client hooks.'],
  sl: ['GameClientShell', 'Abstract GameAppletShell subclass extended by the game applet; owns client loop state.'],
  gl: ['ClientException', 'RuntimeException wrapper retaining the original cause and appended client context; same role as other FunOrb games.'],
  ic: ['PcmStream', 'Abstract linked stream with mixing into int buffers, next/skip hooks and a volatile flag; ag extends it.'],
  ag: ['PcmSampleStream', 'PcmStream subclass interpolating sample bytes into int buffers with position, step and gain ramps.'],
  fe: ['KeyboardInput', 'KeyListener/FocusListener that records key press, release and typed events and clears them on focus loss.'],
  aj: ['MouseInput', 'Synchronized Mouse/MouseMotion/Focus listener recording pointer position and button state.'],
  j: ['LevelSession', 'Large gameplay class whose debug overlay prints the level number and fps, and which shows the Cheating! and Bonus: texts.'],
  jd: ['LoginMenuScreen', 'Screen holding the login, account creation, JS5 error, ticketing and chat-mode message keys and handling their flow.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of parameters.entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const nodeEvidence = 'IntrusiveNode unlink assigns neighbours through next/previous and clears them.';
field('gi', 'e', 'Lgi;', 'next', nodeEvidence);
field('gi', 'b', 'Lgi;', 'previous', nodeEvidence);
field('gi', 'g', 'J', 'key', 'Node key field carried alongside the links.');
method('gi', 'a', '(I)V', 'unlink', ['obfuscationGuard'], nodeEvidence);
method('gi', 'c', '(I)Z', 'isLinked', ['obfuscationGuard'], 'Returns whether the previous link is non-null.');
const dualEvidence = 'DualLinkNode secondary unlink splices field_p/field_n and clears them.';
field('uh', 'p', 'Luh;', 'secondaryNext', dualEvidence);
field('uh', 'n', 'Luh;', 'secondaryPrevious', dualEvidence);
field('uh', 't', 'J', 'secondaryKey', 'Secondary key paired with the secondary links.');
method('uh', 'f', '(I)V', 'unlinkSecondary', ['obfuscationGuard'], dualEvidence);
const wrapEvidence = 'ie.a returns an existing ClientException with appended context, otherwise wraps the throwable in a new one.';
method('ie', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Lgl;', 'wrapClientException', ['cause', 'context'], wrapEvidence);
field('gl', 'd', 'Ljava/lang/String;', 'context', wrapEvidence);
field('gl', 'a', 'Ljava/lang/Throwable;', 'cause', wrapEvidence);
field('j', 'q', 'I', 'levelNumber', 'Printed after "lvl: " in the debug overlay.');

export const config = {
  game: 'drphlogistonsavestheearth', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-drphlogistonsavestheearth-rules.mjs', 'reproduce-drphlogistonsavestheearth.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({policy: 'naming-only', gameplayTests: 'none'}),
  readingGuide(rules, mapping) {
    return ['# Reading Dr Phlogiston Saves the Earth', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/drphlogistonsavestheearth-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `DrPhlogistonSavesTheEarth` (extends `GameClientShell` extends `GameAppletShell`).', ''].join('\n');
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'drphlogistonsavestheearth-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
