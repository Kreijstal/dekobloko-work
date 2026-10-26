import path from 'node:path';
import Module, {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {digest, workflowRoot} from './game-export.mjs';

// Load tracked compiler modules from Git objects in the canonical checkout.
// This isolates unrelated runtime WIP without making another checkout/export.
export function withPinnedCompiler(commit, archiveSha256, operation) {
  const root = path.resolve(process.env.JAVA_TOOLS_DIR || path.join(workflowRoot, '../../java-tools'));
  const git = args => captureProcess('git', ['-C', root, ...args], {maxBuffer: 128 * 1024 * 1024}).stdout;
  if (!/^[a-f0-9]{40}$/.test(commit) || digest(git(['archive', '--format=tar', commit])) !== archiveSha256)
    throw new Error('Pinned decompiler source archive differs');
  const names = git(['ls-tree', '-r', '--name-only', commit, 'src', 'package.json']).toString().trim().split('\n')
    .filter(name => /\.(js|json)$/.test(name));
  const batch = execFileSync('git', ['-C', root, 'cat-file', '--batch'], {
    input: names.map(name => commit + ':' + name).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024,
  });
  const sources = new Map(); let offset = 0;
  for (const name of names) {
    const end = batch.indexOf(10, offset), size = Number(batch.subarray(offset, end).toString().split(' ')[2]);
    if (!Number.isSafeInteger(size)) throw new Error('Missing pinned compiler file: ' + name);
    offset = end + 1; sources.set(path.join(root, name), batch.subarray(offset, offset + size).toString()); offset += size + 1;
  }
  const previous = new Map(), extensions = {...Module._extensions};
  const owned = file => file.startsWith(path.join(root, 'src') + path.sep) || file === path.join(root, 'package.json');
  for (const file of Object.keys(Module._cache)) if (owned(file)) {previous.set(file, Module._cache[file]); delete Module._cache[file];}
  for (const extension of ['.js', '.json']) Module._extensions[extension] = (module, file) => {
    if (!owned(file)) return extensions[extension](module, file);
    if (!sources.has(file)) throw new Error('Unpinned compiler module requested: ' + file);
    if (extension === '.js') module._compile(sources.get(file), file);
    else module.exports = JSON.parse(sources.get(file));
  };
  try {return operation(createRequire(path.join(root, 'package.json')), root);}
  finally {
    for (const extension of ['.js', '.json']) Module._extensions[extension] = extensions[extension];
    for (const file of Object.keys(Module._cache)) if (owned(file)) delete Module._cache[file];
    for (const [file, module] of previous) Module._cache[file] = module;
  }
}
