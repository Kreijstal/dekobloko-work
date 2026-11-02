// Hostile Spawn: Vengeance has an underscore in its game id, which the shared
// installReviewedGame/naming-coverage identity check (/^[a-z0-9]+$/) rejects.
// Shared files are hash-pinned by other games, so this script reuses the shared
// helpers and performs the install step itself with identical semantics.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {hostileConfig as config} from './build-hostilespawn_vengeance-rules.mjs';
import {checkJavaPublication, validateReviewedManifest} from './reviewed-game.mjs';
import {generateReadable, sourceInventory, sourceIdentity} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {archivedInput, digest, funorbRepository, namedReceipt, workflowRoot} from './game-export.mjs';

export function installHostileGame(repository, game, generated, dictionary, guide, check) {
  if (game !== 'hostilespawn_vengeance') throw new Error('Invalid game identity');
  const directory = path.join(repository, 'games', game);
  const dictionaryFile = path.join(repository, 'decompilation', game + '-naming.json');
  const manifestFile = path.join(repository, 'decompilation-provenance.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile)), bytes = JSON.stringify(dictionary, null, 2) + '\n';
  const receipt = {...namedReceipt(game, dictionary, bytes, guide),
    ...(dictionary.provenance.inputPreparation ? {inputPreparation: dictionary.provenance.inputPreparation} : {})};
  checkJavaPublication(directory); checkJavaPublication(path.join(generated, 'src'));
  if (check) {
    if (sourceIdentity(sourceInventory(directory)) !== receipt.sources.sha256 ||
        fs.readFileSync(dictionaryFile, 'utf8') !== bytes || fs.readFileSync(path.join(directory, 'README.md'), 'utf8') !== guide ||
        JSON.stringify(manifest.namedExports?.[game]) !== JSON.stringify(receipt) ||
        JSON.stringify(manifest.publication.games?.[game]?.publishedSources) !== JSON.stringify(receipt.sources))
      throw new Error('Published named game differs: ' + game);
    return;
  }
  const refresh = fs.mkdtempSync(path.join(repository, '.named-refresh-')), previous = path.join(refresh, 'previous');
  const originals = new Map([dictionaryFile, manifestFile].map(f => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
  try {
    const candidate = path.join(refresh, 'game');
    fs.cpSync(path.join(generated, 'src'), candidate, {recursive: true});
    fs.writeFileSync(path.join(candidate, 'README.md'), guide);
    manifest.namedExports = {...manifest.namedExports, [game]: receipt};
    manifest.publication.readableExports = 'Named Java is published directly in games/; pinned input and reverse dictionaries are recorded in namedExports.';
    if (manifest.publication.games?.[game]) manifest.publication.games[game].publishedSources = receipt.sources;
    fs.writeFileSync(path.join(refresh, 'dictionary.json'), bytes);
    fs.writeFileSync(path.join(refresh, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.renameSync(directory, previous);
    try {
      fs.renameSync(candidate, directory);
      fs.renameSync(path.join(refresh, 'dictionary.json'), dictionaryFile);
      fs.renameSync(path.join(refresh, 'manifest.json'), manifestFile);
    } catch (error) {
      fs.rmSync(directory, {recursive: true, force: true}); fs.renameSync(previous, directory);
      for (const [file, original] of originals) original === null ? fs.rmSync(file, {force: true}) : fs.writeFileSync(file, original);
      throw error;
    }
    fs.rmSync(previous, {recursive: true});
  } finally {if (!fs.existsSync(previous)) fs.rmSync(refresh, {recursive: true, force: true});}
}

async function reproduce(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--update', '--check'].includes(args[0]))
    throw new Error(`Usage: node readable/reproduce-${config.game}.mjs --update|--check`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-export-'));
  try {
    const rulesFile = path.join(workflowRoot, config.game + '-rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesFile)); validateReviewedManifest(config, rules);
    if (rules.baseInputTreeSha256 || rules.inputPreparation) throw new Error('Unexpected source preparation');
    const input = archivedInput(rules, temporary);
    const stubs = buildCompilationStubs(funorbRepository, temporary);
    if (stubs.sourceTreeSha256 !== rules.publication.stubSourceTreeSha256 || digest(fs.readFileSync(stubs.jar)) !== rules.publication.stubJarSha256)
      throw new Error('Compilation stub source/dependency changed');
    const generated = path.join(temporary, 'generated');
    const result = generateReadable({input, output: generated, rulesFile, classpath: stubs.jar});
    const mapping = JSON.parse(fs.readFileSync(path.join(generated, 'mapping.json')));
    const dictionary = {...mapping, provenance: JSON.parse(fs.readFileSync(path.join(generated, 'provenance.json'))), generators: rules.generators};
    dictionary.provenance.verification.gameplayCore = await config.verifyCore(input, path.join(generated, 'src'), mapping, stubs.jar, temporary);
    installHostileGame(funorbRepository, config.game, generated, dictionary, config.readingGuide(rules, mapping), args[0] === '--check');
    return {...result, gameplayCore: dictionary.provenance.verification.gameplayCore, check: args[0] === '--check', publishedDirectory: 'games/' + config.game};
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
}

try {console.log(JSON.stringify(await reproduce()));}
catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
