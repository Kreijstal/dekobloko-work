import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProcess} from './lib/capture-process.mjs';

test('preserves stdout and stderr independently without subprocess pipes', () => {
  const result = captureProcess(process.execPath, ['-e', 'process.stdout.write("output");process.stderr.write("diagnostic");']);
  assert.equal(result.stdout.toString(), 'output');
  assert.equal(result.stderr.toString(), 'diagnostic');
});

test('propagates nonzero exit status and compiler diagnostics', () => {
  assert.throws(() => captureProcess(process.execPath, ['-e', 'process.stderr.write("compile failed");process.exit(7);']),
    error => error.status === 7 && error.stderr.toString() === 'compile failed');
});

test('rejects missing executables', () => {
  assert.throws(() => captureProcess('/nonexistent/readable-java-test', []), {code: 'ENOENT'});
});

test('rejects output above the configured capture limit', () => {
  assert.throws(() => captureProcess(process.execPath, ['-e', 'process.stdout.write("12345");'], {maxBuffer: 4}), /exceeded capture limit/);
});
