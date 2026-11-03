import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Bachelor Fridge export. Similar names
// in other games are corroborating role evidence, never copied obfuscated IDs.
import {classes, members, cls} from './bachelorfridge-name-api.mjs';
import './bachelorfridge-names.mjs';
import './bachelorfridge-names-engine.mjs';
import './bachelorfridge-names-game.mjs';
import './bachelorfridge-names-statics.mjs';

cls('bw', 'IntrusiveNode', 'Holds a long key and two links; the only operations are unlink and linked test.');
cls('eo', 'DualLinkNode', 'IntrusiveNode subclass with an independent second link pair and key, unlinked on its own.');
cls('ck', 'GameAppletShell', 'Abstract Applet implementing Runnable and focus/window listeners; base of the game applet.');
cls('ms', 'NetworkGameClient', 'Abstract GameAppletShell subclass that is the direct superclass of BachelorFridge and holds client state.');

export const config = {
  game: 'bachelorfridge', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-bachelorfridge-rules.mjs', 'reproduce-bachelorfridge.mjs', 'bachelorfridge-name-api.mjs',
    'bachelorfridge-names.mjs', 'bachelorfridge-names-engine.mjs', 'bachelorfridge-names-engine-members.mjs',
    'bachelorfridge-names-specials.mjs', 'bachelorfridge-names-game.mjs', 'bachelorfridge-names-statics.mjs', 'reviewed-game.mjs',
    'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: () => ({status: 'not-run', reason: 'No game-specific reconstruction or fixtures in this naming wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading Bachelor Fridge', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/bachelorfridge-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names; renamed names have no opaque suffix.`, '',
      'Start at `BachelorFridge`, which extends the client shell chain `NetworkGameClient` / `GameAppletShell`. Shared engine names reflect role matches with other FunOrb games by reviewed behavior, not by obfuscated spelling. No gameplay fixtures or reconstructions accompany this pass.', '',
      'Reproduce with `node readable/build-bachelorfridge-rules.mjs --check`, `node readable/reproduce-bachelorfridge.mjs --update`, and `node readable/reproduce-bachelorfridge.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'bachelorfridge-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Bachelor Fridge rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
