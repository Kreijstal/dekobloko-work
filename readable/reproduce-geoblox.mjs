import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {generateReadable} from './tools/readable-java.mjs';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {validateManifest} from './build-geoblox-rules.mjs';
import {validateTextResourceEvidence} from './text-resource-evidence.mjs';
import {funorbRepository, publishedReadableRoot} from './layout.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const repository = funorbRepository;
const args = process.argv.slice(2);
const check = args.includes('--check');
const update = args.includes('--update');
const positional = args.filter(arg => arg !== '--check' && arg !== '--update');
if (positional.length > 1 || positional.some(arg => arg.startsWith('--')) ||
    update && (check || positional.length))
  throw new Error('Usage: node readable/reproduce-geoblox.mjs [OUTPUT] [--check] | --update');
const output = positional[0] ? path.resolve(positional[0]) : path.join(publishedReadableRoot, 'geoblox');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-readable-input-'));
let refresh;
try {
  const rulesFile = path.join(root, 'geoblox-rules.json');
  const rules = validateManifest(JSON.parse(fs.readFileSync(rulesFile)));
  const publication = rules.publication;
  const classpath = path.join(publishedReadableRoot, 'funorb-stubs.jar');
  if (digest(fs.readFileSync(classpath)) !== publication.stubJarSha256)
    throw new Error('Frozen compilation dependency changed');
  const archive = path.join(temporary, 'input.tar');
  captureProcess('git', ['-C', repository, 'archive', '--format=tar', '--output=' + archive,
    rules.source.commit, rules.source.subdirectory]);
  captureProcess('tar', ['-xf', archive, '-C', temporary]);
  const input = path.join(temporary, rules.source.subdirectory);
  for (const item of publication.sourceEvidence)
    if (digest(fs.readFileSync(path.join(input, item.file))) !== item.sha256)
      throw new Error(`Reviewed source differs: ${item.file}`);
  const text = publication.textResources;
  if (!text) throw new Error('Missing current text-resource evidence');
  validateTextResourceEvidence(fs.readFileSync(path.join(input, 'wi.java'), 'utf8'), text, rules.renames);
  if (update && fs.existsSync(output)) {
    const walk = (directory, prefix = '') => {
      for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
        const relative = prefix + item.name;
        if (item.isDirectory() && (relative === 'src' || relative.startsWith('src/')))
          walk(path.join(directory, item.name), relative + '/');
        else if (!item.isFile() || !(relative.startsWith('src/') && relative.endsWith('.java') ||
            ['mapping.json', 'provenance.json', 'SYMBOLS.md'].includes(relative)))
          throw new Error(`Refusing to replace unmanaged export entry: ${relative}`);
      }
    };
    if (!fs.lstatSync(output).isDirectory()) throw new Error('Current export must be a real directory');
    walk(output);
  }
  // Stage and verify before replacing the one current output. The sibling
  // staging directory shares its filesystem, permitting rename and rollback.
  if (update) refresh = fs.mkdtempSync(path.join(path.dirname(output), '.geoblox-refresh-'));
  const result = generateReadable({input, output: update ? path.join(refresh, 'generated') : output,
    rulesFile, classpath, check});
  if (update) {
    const backup = path.join(refresh, 'previous');
    if (fs.existsSync(output)) fs.renameSync(output, backup);
    try { fs.renameSync(path.join(refresh, 'generated'), output); }
    catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, output);
      throw error;
    }
    fs.rmSync(backup, {recursive: true, force: true});
  }
  console.log(JSON.stringify({...result, ...(update ? {updatedCurrentExport: true} : {})}));
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
  // Preserve the previous output if rollback itself failed.
  if (refresh && !fs.existsSync(path.join(refresh, 'previous')))
    fs.rmSync(refresh, {recursive: true, force: true});
}
