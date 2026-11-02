import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Every identity below belongs to the pinned Hold the Line export. Similar names
// in other games are corroborating role evidence, never copied obfuscated IDs.
const classes = {
  hl: ['IntrusiveNode', 'Long key with two sibling links, the shared intrusive node base of most Hold the Line classes.'],
  md: ['GameAppletShell', 'Applet/Runnable with focus and window listeners; base of the game client.'],
  oh: ['NetworkGameClient', 'GameAppletShell subclass that HoldTheLine extends.'],
  sf: ['ImageProducerRasterBuffer', 'ImageProducer/ImageObserver that publishes the pixel buffer to AWT consumers.'],
  cl: ['DirectDrawFullscreenController', 'Implements the DirectDraw display-mode enumeration callback and enters fullscreen on a Frame.'],
  ef: ['FullscreenFocusCanvas', 'Canvas with FocusListener retaining the fullscreen Frame and overriding update.'],
  mi: ['DelegatingCanvas', 'Canvas retaining a Component and forwarding paint/update.'],
  f: ['MouseWheelInput', 'Implements MouseWheelListener and accumulates wheel movement.'],
  tj: ['PcmStream', 'Linked abstract audio stream that mixes into an int buffer and has sub-streams.'],
};
const members = {};
export const holdTheLineConfig = {
  game: 'holdtheline', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-holdtheline-rules.mjs', 'reproduce-holdtheline.mjs', 'reviewed-game.mjs', 'game-export.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Hold the Line', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `HoldTheLine`, a `NetworkGameClient` and `GameAppletShell`.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(holdTheLineConfig), file = path.join(workflowRoot, 'holdtheline-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Hold the Line rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
