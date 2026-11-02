import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Names belong to the pinned Lexicominos export. Matching shared roles in
// other games were located by signature, then reviewed against this code.
const shared = (name, role, seen) => [name, `${role} (same shared role as ${seen}; matching member signatures here).`];
const classes = {
  qb: shared('GameAppletShell', 'Applet/Runnable lifecycle with focus and input listeners', 'Escape Vector GameAppletShell'),
  lf: shared('SoftwareRasterizer', 'Global software framebuffer with clip bounds and drawing primitives', 'Escape Vector SoftwareRasterizer'),
  lk: shared('PcmStream', 'Linked PCM stream contract for substreams and mixing', 'Escape Vector PcmStream'),
  cc: shared('PcmSampleStream', 'Interpolating sample playback with looping and gain', 'Escape Vector PcmSampleStream'),
  ke: shared('PcmSample', 'Signed PCM data with rate and loop bounds', 'Escape Vector PcmSample'),
  le: shared('BitmapFont', 'Software text layout and glyph drawing', 'Escape Vector BitmapFont'),
  ic: shared('Bzip2Decoder', 'Bzip2 block decompressor', 'Escape Vector Bzip2Decoder'),
  ak: shared('SynthInstrument', 'Synthesized sound instrument decoder', 'Escape Vector SynthInstrument'),
  se: shared('SoundEnvelope', 'Envelope decoder used by synthesized sound', 'Escape Vector SoundEnvelope'),
  gi: shared('AudioFilter', 'Audio filter coefficient decoder', 'Escape Vector AudioFilter'),
  h: shared('VorbisCodebook', 'Vorbis codebook decoder', 'Escape Vector VorbisCodebook'),
  mf: shared('VorbisFloor', 'Vorbis floor decoder', 'Escape Vector VorbisFloor'),
  i: shared('VorbisResidue', 'Vorbis residue decoder', 'Escape Vector VorbisResidue'),
  sd: shared('VorbisSample', 'Vorbis sample stream decoder', 'Escape Vector VorbisSample'),
  ba: shared('SoundEffect', 'Synthesized sound effect container', 'Escape Vector SoundEffect'),
  jb: shared('IndexedSprite', 'Palette-indexed software sprite', 'Escape Vector IndexedSprite'),
  lc: shared('CursorController', 'Cursor-setting controller contract', 'Escape Vector CursorController'),
  k: shared('MeshRasterState', 'Triangle rasterization scratch state', 'Escape Vector MeshRasterState'),
  pk: shared('TriangleMesh', 'Triangle mesh storage and transforms', 'Escape Vector TriangleMesh'),
  b: shared('AudioOutput', 'Audio output buffering contract', 'Escape Vector AudioOutput'),
  cd: shared('BinaryBitmapFont', 'Zero/nonzero glyph mask font', 'Escape Vector BinaryBitmapFont'),
  vj: shared('CoverageBitmapFont', 'Palette-to-coverage glyph blending font', 'Escape Vector CoverageBitmapFont'),
  hk: shared('PcmStreamMixer', 'PCM substream mixer', 'GeoBlox PcmStreamMixer'),
  ek: shared('MidiTrackReader', 'MIDI track event reader', 'GeoBlox MidiTrackReader'),
};
const members = {};

export const lexicominosConfig = {
  game: 'lexicominos', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  workflowFiles: ['build-lexicominos-rules.mjs', 'reproduce-lexicominos.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  verifyCore: async () => ({policy: 'no-game-specific-core-verification'}),
  readingGuide(rules, mapping) {
    return ['# Reading Lexicominos', '',
      'This directory is the single published Java tree. The scripts and reviewed rules live in dekobloko-work/readable; the current reverse dictionary is ../../decompilation/lexicominos-naming.json.', '',
      `This pass names ${Object.keys(classes).length} reviewed classes in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Shared engine roles (applet shell, software rasterizer, PCM and Vorbis audio, fonts, Bzip2) reuse the names found in other FunOrb games after reviewing matching member signatures.', '',
      'Reproduce with `node readable/build-lexicominos-rules.mjs --check`, `node readable/reproduce-lexicominos.mjs --update` and `node readable/reproduce-lexicominos.mjs --check` from dekobloko-work.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(lexicominosConfig), file = path.join(workflowRoot, 'lexicominos-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Lexicominos rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
