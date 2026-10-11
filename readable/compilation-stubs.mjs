import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from './tools/readable-java.mjs';

// Signature dependencies are built from published source, never committed JARs.
export function buildCompilationStubs(repository, temporary) {
  const input = path.join(repository, 'stubs/src');
  const files = sourceInventory(input);
  const classes = path.join(temporary, 'stub-classes');
  fs.mkdirSync(classes, {recursive: true});
  const args = path.join(temporary, 'stub-sources.args');
  fs.writeFileSync(args, files.map(f => JSON.stringify(path.join(input, f.path))).join('\n') + '\n');
  captureProcess('javac', ['--release', '8', '-encoding', 'UTF-8', '-d', classes, '@' + args]);
  const jar = path.join(temporary, 'funorb-stubs.jar');
  // Fixed ZIP times and sorted entries make the temporary dependency repeatable.
  captureProcess('python3', ['-c', `import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w') as output:
 for file in sorted(root.rglob('*.class')):
  entry=zipfile.ZipInfo(file.relative_to(root).as_posix(),(1980,1,1,0,0,0))
  entry.external_attr=0o644 << 16
  output.writestr(entry,file.read_bytes())`, classes, jar]);
  return {jar, sourceTreeSha256: sourceIdentity(files)};
}

let cached;
export function temporaryCompilationStubs(repository) {
  if (!cached) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-stubs-'));
    process.on('exit', () => fs.rmSync(temporary, {recursive: true, force: true}));
    cached = buildCompilationStubs(repository, temporary);
  }
  return cached;
}
