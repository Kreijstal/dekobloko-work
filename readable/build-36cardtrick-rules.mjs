import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities belong to the pinned 36 Card Trick export; similar roles in other
// games are corroborating evidence only, never copied obfuscated IDs.
const classes = {
  qb: ['IntrusiveNode', 'Long key plus two links with a null-link-guarded unlink; same shared role as other games.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
function method(owner, original, descriptor, to, parameters, evidence) {
  const signature = owner + '.' + original + descriptor;
  if (original !== '<init>') members['M:' + signature] = {to, evidence};
  for (const [ordinal, name] of (parameters || []).entries()) members[`P:${signature}#${ordinal}`] = {to: name, evidence};
}
const nodeEvidence = 'IntrusiveNode link fields and unlink bodies.';
field('qb', 'e', 'J', 'key', nodeEvidence);
field('qb', 'd', 'Lqb;', 'next', nodeEvidence);
field('qb', 'a', 'Lqb;', 'previous', nodeEvidence);
method('qb', 'c', '(I)V', 'unlink', ['obfuscationGuard'], nodeEvidence);
method('qb', 'b', '(I)Z', 'isLinked', ['obfuscationGuard'], nodeEvidence);

export const cardConfig = {
  game: '36cardtrick', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-36cardtrick-rules.mjs', 'reproduce-36cardtrick.mjs', 'reviewed-game.mjs',
    'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-applicable', reason: 'No game-specific reconstructions or tests in this naming wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading 36 Card Trick', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/36cardtrick-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Reproduce with `node readable/build-36cardtrick-rules.mjs --check`, `node readable/reproduce-36cardtrick.mjs --update`, and `node readable/reproduce-36cardtrick.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(cardConfig), file = path.join(workflowRoot, '36cardtrick-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('36 Card Trick rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
