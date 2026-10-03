import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Regular-file stdio works in environments that restrict subprocess pipe sockets.
// Exit status and output limits remain mandatory; compiler errors are never ignored.
export function captureProcess(command, args, {maxBuffer = 8 * 1024 * 1024} = {}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'readable-process-'));
  const outputs = ['stdout', 'stderr'].map(name => path.join(temporary, name));
  const descriptors = outputs.map(file => fs.openSync(file, 'w'));
  try {
    const result = spawnSync(command, args, {stdio: ['ignore', ...descriptors]});
    if (result.error) throw result.error;
    const [stdout, stderr] = outputs.map(file => {
      if (fs.statSync(file).size > maxBuffer) throw new Error('Subprocess output exceeded capture limit');
      return fs.readFileSync(file);
    });
    if (result.status !== 0) {
      const error = new Error(`${command} failed with status ${result.status}, signal ${result.signal}`);
      Object.assign(error, {status: result.status, signal: result.signal, stdout, stderr});
      throw error;
    }
    return {stdout, stderr};
  } finally {
    for (const descriptor of descriptors) fs.closeSync(descriptor);
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}
