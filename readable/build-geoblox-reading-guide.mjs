import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {manifestFile, publishedReadableRoot} from './layout.mjs';

// Game-specific reading priorities live here. Links resolve from the current
// reversible dictionary and declarations, never copied historical line numbers.
export function buildReadingGuide(manifest, exportRoot) {
  const mapping = JSON.parse(fs.readFileSync(path.join(exportRoot, 'mapping.json')));
  const provenance = JSON.parse(fs.readFileSync(path.join(exportRoot, 'provenance.json')));
  assert.equal(mapping.inputTreeSha256, manifest.inputTreeSha256);
  assert.equal(mapping.files.length, 303);
  assert.equal(provenance.inputTreeSha256, manifest.inputTreeSha256);
  assert.deepEqual(provenance.source, manifest.source);
  assert.equal(mapping.rules.length, manifest.renames.length);
  for (let i = 0; i < mapping.rules.length; i++) {
    const {renamedSymbol, ...rule} = mapping.rules[i];
    assert.deepEqual(rule, manifest.renames[i], rule.symbol + ' current complete rule');
  }
  const symbols = new Map(mapping.symbols.map(s => [s.symbol, s]));
  const aliases = new Map(manifest.renames.map(r => [r.symbol, r.to]));
  const className = owner => aliases.get('C:' + owner) || owner;
  const sourceLink = (symbol, label) => {
    const declaration = symbols.get(symbol);assert.ok(declaration, symbol + ' declaration');
    const owner = symbol.slice(2).split('.')[0];
    const sourceName = className(owner) + '.java';
    const source = fs.readFileSync(path.join(exportRoot, 'src', sourceName), 'utf8');
    const name = declaration.renamedName;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp('^\\s*(?:(?:public|private|protected|static|final|synchronized|native|abstract|strictfp)\\s+)*[\\w$.[\\]<>?,]+\\s+' + escaped + '\\s*\\(');
    const lines = source.split('\n').flatMap((line, i) => matcher.test(line) ? [i + 1] : []);
    assert.equal(lines.length, 1, symbol + ' unique current declaration');
    return `[${label || className(owner) + '.' + name}](${sourceName}#L${lines[0]})`;
  };
  const row = (symbol, purpose) => '| ' + sourceLink(symbol) + ' | ' + purpose + ' |';
  const compiler = manifest.generators.javaTools;
  const fields = manifest.publication.verification.unresolvedFieldPurposeInventory;
  assert.equal(fields.length, 41);
  assert.equal(fields.filter(f => f.observation === 'no-ordinary-source-references').length, 6);
  assert.equal(fields.filter(f => f.observation === 'constructor-and-merge-only').length, 35);
  const lookup = symbols.get('L:gh.b(B)V#7');assert.ok(lookup);
  const guide = [
    '# Reading the current GeoBlox source',
    '',
    'This guide is generated from the current export by Deko’s `build-geoblox-reading-guide.mjs`. It follows the game code; previous pass narratives remain in Git history and the existing [workflow record](README.md).',
    '',
    'The Java in [this directory](.) is the only maintained GeoBlox source, published directly in `games/geoblox`. Its 303 top-level classes have meaningful names; 302 are renamed and `Geoblox` keeps its original name. The manifest contains ' + manifest.renames.length.toLocaleString('en-US') + ' guarded names and the dictionary preserves ' + mapping.symbols.length.toLocaleString('en-US') + ' complete identities.',
    '',
    '## Start with the game loop',
    '',
    '| Entry point | What to follow |',
    '| --- | --- |',
    row('M:Geoblox.c(Z)V', 'Runs the client update; follow the screen selection and active gameplay session.'),
    row('M:Geoblox.a(I)V', 'Draws the current screen, transitions, loading scene and gameplay.'),
    row('M:Geoblox.o(I)Z', 'Prepares fonts, sprites, music and interface resources over readiness stages.'),
    row('M:gh.a(I)V', 'Updates panel animation, progression, tutorial/input handling, entity work and the ending sequence.'),
    row('M:gh.a(B)V', 'Renders the rotating board, entities, counters, tutorial and result overlays.'),
    '',
    'The applet and session share work with static helpers. A semantic class name describes a role; it does not mean that every static helper on that original owner has moved into one subsystem.',
    '',
    '## Follow gameplay by task',
    '',
    '| Task | Source entry point |',
    '| --- | --- |',
    '| Scene preparation, completion and theme achievements | ' + sourceLink('M:gh.b(B)V') + ' |',
    '| Select and request the next theme | ' + sourceLink('M:gh.j(I)V') + ' |',
    '| Advance tutorial phases and steps | ' + sourceLink('M:gh.b(I)V') + ' |',
    '| Draw the tutorial prompt and its controls | ' + sourceLink('M:gh.g(I)V') + ' |',
    '| Start the ending sequence | ' + sourceLink('M:gh.d(B)V') + ' |',
    '| Advance result expansion, countdown and completion | ' + sourceLink('M:gh.f(I)V') + ' |',
    '| Add points and update score-dependent state | ' + sourceLink('M:gh.a(BI)V') + ' |',
    '| Submit an eligible positive score | ' + sourceLink('M:gh.e(B)V') + ' |',
    '| Process sorted/deduplicated match candidates | ' + sourceLink('M:ec.b(I)Z') + ' |',
    '| Test whether entity queues have settled | ' + sourceLink('M:ih.a(I)Z') + ' |',
    '| Link entities through ownership-mask contacts | ' + sourceLink('M:ih.a(IILja;I)V') + ' |',
    '| Advance difficulty tables | ' + sourceLink('M:ld.b(Z)V') + ' |',
    '',
    '## Read the scene-transition method',
    '',
    '1. At animation tick zero it prepares the next theme or resets score, copies the board raster, clears entity/contact queues and redraws the ownership mask.',
    '2. It increments the animation tick. At tick 160, the normal control path of a transition that preserves score searches the seven-entry theme cycle and selects the preceding entry, wrapping index zero to entry six.',
    '3. It retains the original theme dispatch and achievement calls. Logical continuation conditions place each operand on its own line; read them in their written short-circuit order.',
    '4. It clears transition/rebuild flags, resets the animation tick and advances difficulty/release quotas when required.',
    '',
    '`' + lookup.renamedName + '` belongs to the preceding-theme lookup. It is initialized true and written false when the matching cycle entry is found. The retained snapshot has no later read in this method; it must not be mistaken for a tutorial decision or removed as part of naming.',
    '',
    '## Understand retained reconstruction names',
    '',
    '- `methodGuard` and `clientControlFlowGuard` preserve the original numeric arguments and control snapshot. Nonzero paths, wrong-guard behavior and arithmetic have not been assumed away.',
    '- Names ending in `FrameContinues` describe whether original remainder work continues. They are reconstructed control decisions, not additional game states.',
    '- Names such as `themeIndexThenId` identify reused locals whose role changes during a method. They retain every original store and read.',
    '- Mixed-purpose static helpers keep their original owners. Follow a method’s full identity and evidence rather than treating its class as an exclusive module boundary.',
    '',
    '## What remains uncertain',
    '',
    '| Source family | Verified observation | Limit |',
    '| --- | --- | --- |',
    '| [GameApplet](geoblox/src/GameApplet.java) | Six public static fields have no ordinary references in this corpus. | This does not rule out external or reflective access. Their finer purpose is unknown. |',
    '| [VisualPropertyOverrides](geoblox/src/VisualPropertyOverrides.java) | Thirty-five private fields are used only by construction and property merging. | Names describe types and merge sentinels, not invented visual roles. |',
    '',
    'There are no remaining plain block labels or large framed state-machine methods. Long ordinary methods and ' + fields.length + ' finer field purposes still need review. Source/binding/native checks are scoped evidence; original-game equivalence, browser/phone behavior and heap/presented-FPS acceptance remain unverified.',
    '',
    '## Reproduce and trace a name',
    '',
    'Run from the Deko repository:',
    '',
    '```sh',
    'env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update',
    'env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check',
    '```',
    '',
    'Both commands cover the current Java export and this guide. The [current naming dictionary](../../decompilation/geoblox-naming.json) contains original spellings, full JVM descriptors, declaration ordinals, UTF-16 edit positions and provenance. Reverse it with Deko’s `readable/restore-game.mjs geoblox OUTPUT`; do not append opaque spellings to readable names.',
    '',
    'Current raw source: `' + manifest.source.commit + '`; tree SHA-256: `' + manifest.inputTreeSha256 + '`.',
    '',
    'Decompiler source: `' + compiler.commit + '`. The SHA-256 of its tracked Git tar is `' + compiler.sourceArchive.sha256 + '`; this is the decompiler source hash, not a game JAR hash.',
    '',
  ].join('\n');
  return guide;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--check']);
  const guide = buildReadingGuide(JSON.parse(fs.readFileSync(manifestFile)), path.join(publishedReadableRoot, 'geoblox'));
  assert.equal(fs.readFileSync(path.join(publishedReadableRoot, 'GEOBLOX-READING-GUIDE.md'), 'utf8'), guide);
  console.log(JSON.stringify({readingGuideChecked: true, lines: guide.split('\n').length - 1}));
}
