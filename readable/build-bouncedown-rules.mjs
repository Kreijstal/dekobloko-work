import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Bounce Down export. Similar names in
// other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  ai: ['IntrusiveNode', 'Long key plus two sibling links with unlink and linked test; base of packet buffers, widgets and audio nodes.'],
  ug: ['DualLinkNode', 'IntrusiveNode with an independent secondary link pair and key, unlinked separately.'],
  wi: ['PacketBuffer', 'IntrusiveNode holding a byte payload and cursor with big-endian primitive and string encodings.'],
  ii: ['CipherPacketBuffer', 'PacketBuffer subclass adding an opcode cipher and a separate bit cursor.'],
  ga: ['ClientException', 'RuntimeException retaining the original cause and appended context text.'],
  Bounce: ['BounceDown', 'Main applet class: loads the platform, slime and menu assets named by literals and drives the game states.'],
  dg: ['Platform', 'Platform with a kind code, position, timer; constructed in the platform pool and drawn with the platform sprites.'],
  ud: ['Slime', 'Player slime with form, size, position, velocity and invulnerability blink; drawn with the slime sprite sets.'],
  fj: ['AppletShell', 'Applet/Runnable base with focus and window listeners and abstract client hooks.'],
  kk: ['GameClient', 'AppletShell subclass extended directly by the main applet.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};

export const bouncedownConfig = {
  game: 'bouncedown', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-bouncedown-rules.mjs', 'reproduce-bouncedown.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({status: 'not-run', reason: 'No game-specific reconstruction or test in this naming wave.'}),
  readingGuide(rules, mapping) {
    return ['# Reading Bounce Down', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/bouncedown-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Reproduce with `node readable/build-bouncedown-rules.mjs --check`, `node readable/reproduce-bouncedown.mjs --update`, and `node readable/reproduce-bouncedown.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(bouncedownConfig), file = path.join(workflowRoot, 'bouncedown-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Bounce Down rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
