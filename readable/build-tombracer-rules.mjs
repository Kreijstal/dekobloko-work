import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Tomb Racer export; names from other games are corroborating role evidence only.
const classes = {
  vg: ['IntrusiveNode', 'Long key plus two reciprocal links and an unlink method, subclassed by widgets and buffers.'],
  be: ['SocketConnector', 'Abstract holder of host and port whose abstract method creates a Socket.'],
  qb: ['ProxySocketConnector', 'SocketConnector that consults a ProxySelector.'],
  jna: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners; base of the applet shell.'],
  hua: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  qaa: ['MouseWheelInput', 'Abstract wheel-input hook subclassed by the MouseWheelListener implementation.'],
  hfa: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  he: ['DelegatingCanvas', 'Canvas that forwards paint to a wrapped Component.'],
  qea: ['IsaacCipher', 'Two int arrays and counters, the ISAAC generator seeded with the golden-ratio constant.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const node = 'IntrusiveNode unlink body splices field_e and field_a of its neighbours.';
field('vg', 'a', 'Lvg;', 'next', node);
field('vg', 'e', 'Lvg;', 'previous', node);
field('vg', 'd', 'J', 'key', node);
field('be', 'a', 'Ljava/lang/String;', 'host', 'SocketConnector holds the host string handed to the Socket factory.');
field('be', 'b', 'I', 'port', 'SocketConnector holds the port handed to the Socket factory.');

export const config = {
  game: 'tombracer', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-tombracer-rules.mjs', 'reproduce-tombracer.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Tomb Racer', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `TombRacer`; the shared engine (nodes, sockets, applet shell, input) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'tombracer-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Tomb Racer rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
