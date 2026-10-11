import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';

export const workflowRoot = fileURLToPath(new URL('./', import.meta.url));
export const workflowRepository = path.resolve(workflowRoot, '..');
// The source/export repository is an explicit integration dependency. No Java
// export is generated in Deko, including during checks of cloned worktrees.
export const funorbRepository = path.resolve(process.env.FUNORB_DECOMPILED_DIR ||
  path.join(workflowRepository, '..', 'funorb-decompiled'));
export const manifestFile = path.join(workflowRoot, 'geoblox-rules.json');

// Historical probes need a pinned raw/named pair, only in temporary storage.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-probe-view-'));
process.on('exit', () => fs.rmSync(temporary, {recursive: true, force: true}));
export const publishedReadableRoot = path.join(temporary, 'named');
fs.mkdirSync(path.join(publishedReadableRoot, 'geoblox'), {recursive: true});
const legacy = path.join(funorbRepository, 'readable/geoblox');
const dictionaryFile = path.join(funorbRepository, 'decompilation/geoblox-naming.json');
if (fs.existsSync(dictionaryFile)) {
  const {provenance, generators, ...mapping} = JSON.parse(fs.readFileSync(dictionaryFile));
  fs.writeFileSync(path.join(publishedReadableRoot, 'geoblox/mapping.json'), JSON.stringify(mapping, null, 2) + '\n');
  fs.writeFileSync(path.join(publishedReadableRoot, 'geoblox/provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  fs.symlinkSync(path.join(funorbRepository, 'games/geoblox'), path.join(publishedReadableRoot, 'geoblox/src'), 'dir');
  fs.copyFileSync(path.join(funorbRepository, 'games/geoblox/README.md'), path.join(publishedReadableRoot, 'GEOBLOX-READING-GUIDE.md'));
} else {
  for (const name of ['mapping.json', 'provenance.json']) fs.copyFileSync(path.join(legacy, name), path.join(publishedReadableRoot, 'geoblox', name));
  fs.symlinkSync(path.join(legacy, 'src'), path.join(publishedReadableRoot, 'geoblox/src'), 'dir');
}
const rules = JSON.parse(fs.readFileSync(manifestFile));
const archive = path.join(temporary, 'raw.tar');
captureProcess('git', ['-C', funorbRepository, 'archive', '--format=tar', '--output=' + archive, rules.source.commit, rules.source.subdirectory]);
captureProcess('tar', ['-xf', archive, '-C', temporary]);
const stubs = buildCompilationStubs(funorbRepository, temporary);
export const compilationStubJar = stubs.jar;
fs.symlinkSync(stubs.jar, path.join(publishedReadableRoot, 'funorb-stubs.jar'));
