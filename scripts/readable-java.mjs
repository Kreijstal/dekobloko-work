import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export {generateReadable, sourceInventory, sourceIdentity} from '../readable/tools/readable-java.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = spawnSync(process.execPath,
    [fileURLToPath(new URL('../readable/tools/readable-java.mjs', import.meta.url)), ...process.argv.slice(2)],
    {stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
