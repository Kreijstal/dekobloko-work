import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Transmogrify export. Similar names
// in GeoBlox/Monkey Puzzle 2 are corroborating role evidence only.
const classes = {
  wf: ['IntrusiveNode', 'Long key plus two reciprocal links; unlink at c(5) reconnects neighbours.'],
  ri: ['DualLinkNode', 'IntrusiveNode subclass with a second independent link pair and long key.'],
  pf: ['SecondaryNodeDeque', 'Iterable over ri secondary links, iterated by wg.'],
  wg: ['SecondaryNodeDequeIterator', 'Iterator constructed from a pf deque.'],
  vi: ['IterableNodeHashTable', 'Bucket array of IntrusiveNode implementing Iterable.'],
  w: ['NodeHashTableIterator', 'Iterator walking the buckets of a vi hash table.'],
  fa: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  ig: ['SessionGameApplet', 'Abstract GameApplet subclass extended by the Transmogrify main class.'],
  ah: ['DelegatingCanvas', 'Canvas wrapping another Component that it delegates to.'],
  dg: ['FullscreenFocusCanvas', 'Canvas with a Frame that records focus loss.'],
  ce: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  qi: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  sk: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  rj: ['MouseWheelInput', 'Abstract wheel-input hook with a delta query.'],
  fg: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  cj: ['RasterBuffer', 'Abstract int pixel buffer handed to the rasterizer.'],
  ib: ['PlatformTask', 'Request object with a status, result object and next link handed to the dispatcher thread.'],
  fe: ['PlatformTaskDispatcher', 'Runnable owning a Thread, EventQueue and reflection handles that services queued platform tasks.'],
  gj: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a write buffer.'],
  ec: ['SocketConnector', 'Abstract holder of host and port that creates a Socket.'],
  nl: ['ProxySocketConnector', 'SocketConnector that writes an HTTP CONNECT request.'],
  qj: ['IntrusiveDeque', 'Sentinel-based deque of IntrusiveNode with forward and backward traversal.'],
  j: ['TileRack', 'Fixed-size array of LetterTile with an origin; named submission_rack, carryover_rack or new_rack in debug output.'],
  sj: ['LetterTile', 'Draws a tile sprite, its letter and a numeric value; tracks its rack, slot and destination.'],
  qg: ['UiWidget', 'IntrusiveNode base widget with text label, listener and bounds fields.'],
  ui: ['WidgetListener', 'Single-method callback taking a UiWidget; implemented by button handlers.'],
  ag: ['PcmStream', 'Abstract audio stream linked to a next stream with sample-mixing hooks.'],
  bb: ['PcmSampleStream', 'PcmStream with loop, position and rate state that mixes a PCM sample buffer.'],
  oa: ['PacketBuffer', 'Byte payload with cursor and big-endian, string, RSA BigInteger and ISAAC-style operations.'],
  nf: ['WordLanguage', 'Holds a language font, vowel string and word list; validates the letters of a tile array.'],
  ad: ['WordDictionary', 'Decodes length-prefixed byte arrays from a packet and answers membership for a char[] word.'],
  kl: ['ContextualRuntimeException', 'RuntimeException retaining a cause and context text.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
field('wf', 'b', 'Lwf;', 'next', 'Hash table lookup walks field_b to advance through a bucket.');
field('wf', 'f', 'Lwf;', 'previous', 'Unlink at c(5) clears the back reference held in field_f.');
field('wf', 'c', 'J', 'key', 'IterableNodeHashTable matches nodes by comparing this long.');

field('j', 'e', '[Lsj;', 'tiles', 'Rack debug dump indexes this array by slot for each tile.');
field('j', 'd', 'I', 'originX', 'Tile destination x is slot * 32 + this value.');
field('j', 'c', 'I', 'originY', 'Tile destination y is copied from this value.');
field('sj', 'i', 'C', 'letter', 'Drawn on the tile face and printed in rack debug dumps.');
field('sj', 'o', 'Lj;', 'rack', 'The rack whose tiles array holds this tile at its slot.');
field('sj', 't', 'I', 'slot', 'Index of this tile in its rack tiles array.');
field('sj', 'g', 'I', 'destinationX', 'Printed as the x of "with dest" in rack debug output.');
field('sj', 'p', 'I', 'destinationY', 'Printed as the y of "with dest" in rack debug output.');
field('sj', 'k', 'Lj;', 'previousRack', 'Saved when a tile leaves any rack other than the submission rack.');
field('sj', 's', 'I', 'previousSlot', 'Saved with previousRack when a tile moves racks.');
field('sj', 'j', 'I', 'x', 'Added to the draw offset when blitting the tile sprite.');
field('sj', 'q', 'I', 'y', 'Added to the draw offset when blitting the tile sprite.');
field('sj', 'v', 'I', 'baseValue', 'Displayed tile number is baseValue plus twice field_h.');
field('sj', 'h', 'I', 'carryoverFlag', 'When nonzero the tile prefers the carryover rack over the new rack when returned.');
field('sj', 'x', 'Z', 'doublesWordScore', 'ni.a doubles the word total when any tile has this flag set.');
field('vi', 'a', '[I', 'wordScores', 'dc.a stores each submitted word score at the submitted-word index.');
field('eh', 'a', 'I', 'totalScore', 'dc.a adds each word score to it.');
field('rh', 'n', 'I', 'unlockedAchievementMask', 'fi.b tests and sets one bit per achievement index in it.');
field('oa', 'g', '[B', 'payload', 'PacketBuffer byte array that readers index by the cursor.');
field('oa', 'h', 'I', 'position', 'PacketBuffer cursor advanced by each read.');
field('vi', 'g', '[Ljava/lang/StringBuilder;', 'usedWords', 'ni.a compares the submitted word against each entry ignoring case.');
field('n', 'a', 'I', 'submittedWordCount', 'dc.a increments it per submitted word and ends the game at 10; ni.a loops over earlier words up to it.');
field('of', 'e', 'Ljava/lang/StringBuilder;', 'wordBuffer', 'ni.a clears it then appends each tile letter.');
field('nf', 'f', 'Lad;', 'dictionary', 'nf.isValidWord forwards the letters to this object.');
field('od', 'g', 'Lj;', 'submissionRack', 'ac.a maps this rack to the text "submission_rack".');
field('wk', 'a', 'Lj;', 'carryoverRack', 'ac.a maps this rack to the text "carryover_rack".');
field('si', 'i', 'Lj;', 'newRack', 'ac.a maps this rack to the text "new_rack".');
field('bl', 'b', '[Ljava/lang/String;', 'achievementDescriptions', 'Holds the sixteen achievement texts such as "Score 600+ points".');
field('sg', 'k', 'Ljava/lang/String;', 'varietyBonusLabel', 'Text constant "Variety bonus:".');
field('ub', 'e', 'Ljava/lang/String;', 'timeBonusLabel', 'Text constant "Time bonus:".');
field('he', 'h', 'Ljava/lang/String;', 'endGameLabel', 'Text constant "End Game".');
field('he', 'g', 'Ljava/lang/String;', 'skipRoundPrompt', 'Text asks whether to skip the round and score 0.');
field('th', 'b', 'Ljava/lang/String;', 'shuffleLabel', 'Text constant "Shuffle".');
field('mc', 'a', '[Ljava/lang/String;', 'countdownLabels', 'Holds "Ready", "Set", "Go".');
field('ua', 'a', '[Ljava/lang/String;', 'bonusWords', 'Holds mummy, skeleton, pumpkin, vampire from the final achievement text.');
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};
method('j', 'a', '(I)V', 'shuffle', 'Fisher-Yates swaps of the tiles array, then reassigns slots and destinations.');
method('j', 'a', '(Z)V', 'clear', 'Releases every tile and nulls the slot.');
method('sj', 'a', '(IIII)V', 'draw', 'Blits the tile sprite, letter and value text.');
method('sj', 'a', '(IILj;)V', 'moveToRack', 'Removes the tile from its rack and places it at the new slot, updating destination.');
method('ac', 'a', '(ILj;)Ljava/lang/String;', 'rackName', 'Returns submission_rack, carryover_rack or new_rack for a rack.');
method('eh', 'a', '(Lsj;I)V', 'returnTileToRack', 'Puts a removed tile back in its previous slot or the first free carryover or new rack slot, then closes the gap.');
method('dc', 'a', '(IZ)V', 'submitWord', 'Scores the submission rack via ni.a, appends the word to the used list and ends the game after the tenth word.');
method('fi', 'b', '(III)Z', 'unlockAchievement', 'Sets bit param2 of the unlocked mask once and queues an achievement popup; dc.a calls it with score-based indices.');
method('ni', 'a', '(B)I', 'scoreSubmittedWord', 'Reads the submission rack: 0 if empty, -1 if invalid or already used, else summed tile values, doubled by a special tile.');
method('nf', 'a', '(I[Lsj;)Z', 'isValidWord', 'Copies tile letters into a char[] and asks the word dictionary.');
method('nf', 'a', '(IC)C', 'toUpperCase', 'Returns Character.toUpperCase of its argument.');
method('ad', 'a', '(B[C)Z', 'containsWord', 'Public wrapper over the private lookup used by nf for a char[] word.');
method('ue', 'b', '(I)V', 'dumpRackState', 'Prints each rack tile and any tile that believes itself elsewhere.');

export const config = {
  game: 'transmogrify', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-transmogrify-rules.mjs', 'reproduce-transmogrify.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Transmogrify', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Transmogrify`; the shared engine (nodes, deques, packet buffer, sockets, widgets, sprites) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'transmogrify-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Transmogrify rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
