import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {generateReadable, sourceInventory, sourceIdentity} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';

export const workflowRoot = path.dirname(fileURLToPath(import.meta.url));
export const funorbRepository = path.resolve(process.env.FUNORB_DECOMPILED_DIR || path.join(workflowRoot, '../../funorb-decompiled'));
export const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file));

export function archivedInput(rules, temporary) {
  if (rules.source?.repository !== 'Kreijstal/funorb-decompiled' || !/^[a-f0-9]{40}$/.test(rules.source.commit) ||
      rules.source.subdirectory !== 'games/' + rules.game) throw new Error('Invalid pinned game source');
  const archive = path.join(temporary, 'input.tar');
  captureProcess('git', ['-C', funorbRepository, 'archive', '--format=tar', '--output=' + archive, rules.source.commit, rules.source.subdirectory]);
  captureProcess('tar', ['-xf', archive, '-C', temporary]);
  const input = path.join(temporary, rules.source.subdirectory);
  if (sourceIdentity(sourceInventory(input)) !== rules.inputTreeSha256) throw new Error('Pinned source identity differs');
  return input;
}

export function verifyToolPin() {
  const pin = json(path.join(workflowRoot, 'tools/PIN.json'));
  for (const [file, expected] of Object.entries(pin.files))
    if (digest(fs.readFileSync(path.join(workflowRoot, 'tools', file))) !== expected) throw new Error('Frozen naming tool changed: ' + file);
  return pin;
}

export function namedReceipt(game, dictionary, bytes, guide) {
  return {source: dictionary.provenance.source, inputTreeSha256: dictionary.inputTreeSha256,
    sources: {files: dictionary.files.length, sha256: dictionary.provenance.outputTreeSha256},
    dictionary: {path: `decompilation/${game}-naming.json`, sha256: digest(bytes)},
    readingGuide: {path: `games/${game}/README.md`, sha256: digest(guide)},
    rulesSha256: dictionary.provenance.rulesSha256, compiler: dictionary.generators.javaTools};
}

export function installNamedGame(repository, game, generated, dictionary, guide, check = false) {
  const directory = path.join(repository, 'games', game);
  const dictionaryFile = path.join(repository, 'decompilation', game + '-naming.json');
  const manifestFile = path.join(repository, 'decompilation-provenance.json');
  const manifest = json(manifestFile);
  const bytes = JSON.stringify(dictionary, null, 2) + '\n';
  const receipt = namedReceipt(game, dictionary, bytes, guide);
  if (check) {
    if (sourceIdentity(sourceInventory(directory)) !== receipt.sources.sha256 ||
        fs.readFileSync(dictionaryFile, 'utf8') !== bytes || fs.readFileSync(path.join(directory, 'README.md'), 'utf8') !== guide ||
        JSON.stringify(manifest.namedExports?.[game]) !== JSON.stringify(receipt)) throw new Error('Published named game differs: ' + game);
    return;
  }
  // Stage the Java and all receipt bytes before touching the current publication.
  const refresh = fs.mkdtempSync(path.join(repository, '.named-refresh-'));
  const previous = path.join(refresh, 'previous');
  const originals = new Map([dictionaryFile, manifestFile].map(file => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
  try {
    const candidate = path.join(refresh, 'game');
    fs.cpSync(path.join(generated, 'src'), candidate, {recursive: true});
    fs.writeFileSync(path.join(candidate, 'README.md'), guide);
    const contents = fs.readdirSync(directory);
    if (contents.some(name => !fs.lstatSync(path.join(directory, name)).isFile() || !name.endsWith('.java') && name !== 'README.md'))
      throw new Error('Unmanaged entry in game publication');
    manifest.namedExports = {...manifest.namedExports, [game]: receipt};
    manifest.publication.readableExports = 'Named Java is published directly in games/; pinned input and reverse dictionaries are recorded in namedExports.';
    if (manifest.publication?.games?.[game]) manifest.publication.games[game].publishedSources = receipt.sources;
    fs.writeFileSync(path.join(refresh, 'dictionary.json'), bytes);
    fs.writeFileSync(path.join(refresh, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.renameSync(directory, previous);
    try {
      fs.renameSync(candidate, directory);
      fs.renameSync(path.join(refresh, 'dictionary.json'), dictionaryFile);
      fs.renameSync(path.join(refresh, 'manifest.json'), manifestFile);
    } catch (error) {
      fs.rmSync(directory, {recursive: true, force: true});
      fs.renameSync(previous, directory);
      for (const [file, original] of originals) original === null ? fs.rmSync(file, {force: true}) : fs.writeFileSync(file, original);
      throw error;
    }
    fs.rmSync(previous, {recursive: true});
  } finally {if (!fs.existsSync(previous)) fs.rmSync(refresh, {recursive: true, force: true});}
}

export async function reproduceGame(game, args = process.argv.slice(2)) {
  if (!['geoblox', 'dekobloko'].includes(game) || args.length !== 1 || !['--update', '--check'].includes(args[0]))
    throw new Error(`Usage: node readable/reproduce-${game}.mjs --update|--check`);
  const check = args[0] === '--check';
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-naming-'));
  try {
    verifyToolPin();
    const rulesFile = path.join(workflowRoot, game + '-rules.json');
    const rules = json(rulesFile);
    if (game === 'geoblox') {
      const {validateManifest} = await import('./build-geoblox-rules.mjs');
      validateManifest(rules);
    } else {
      const {validateDekoblokoManifest} = await import('./build-dekobloko-rules.mjs');
      validateDekoblokoManifest(rules);
    }
    const input = archivedInput(rules, temporary);
    const stubs = buildCompilationStubs(funorbRepository, temporary);
    if (stubs.sourceTreeSha256 !== rules.publication.stubSourceTreeSha256 ||
        digest(fs.readFileSync(stubs.jar)) !== rules.publication.stubJarSha256) throw new Error('Compilation stub source/dependency changed');
    const generated = path.join(temporary, 'generated');
    const result = generateReadable({input, output: generated, rulesFile, classpath: stubs.jar});
    const mapping = json(path.join(generated, 'mapping.json'));
    const dictionary = {...mapping, provenance: json(path.join(generated, 'provenance.json')), generators: rules.generators};
    if (game === 'dekobloko') {
      const {verifySnapshots} = await import('./tests/test-dekobloko-snapshots.mjs');
      dictionary.provenance.verification.multiplayerSnapshots = verifySnapshots(input, path.join(generated, 'src'), mapping, stubs.jar, temporary);
    }
    let guide;
    if (game === 'geoblox') {
      const {buildReadingGuide} = await import('./build-geoblox-reading-guide.mjs');
      guide = buildReadingGuide(rules, generated).replaceAll('geoblox/src/', '').replaceAll('[geoblox/src](geoblox/src)', '[this directory](.)');
    } else {
      const {buildDekoblokoGuide} = await import('./build-dekobloko-rules.mjs');
      guide = buildDekoblokoGuide(rules, mapping);
    }
    installNamedGame(funorbRepository, game, generated, dictionary, guide, check);
    console.log(JSON.stringify({...result, check, publishedDirectory: `games/${game}`, dictionary: `decompilation/${game}-naming.json`, readingGuideChecked: true}));
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
}
