import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
test('asset tools use the selected static root independently of checkout and working directory', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'deko-assets-'));
  try {
    const assets = path.join(target, 'static');
    mkdirSync(assets);
    const catalog = JSON.stringify({games: [{internalName: 'absent', assetRoot: '/game-assets/absent'}]});
    writeFileSync(path.join(assets, 'game-catalog.json'), catalog);
    const env = {...process.env, GAME_ASSETS_ROOT: assets, ALTERORB_JVMJS_CACHE_ROOT: path.join(target, 'empty'), JS5_RECORDED_ROOT: path.join(target, 'recorded')};
    const run = (script, ...args) => spawnSync(process.execPath, [path.join(scripts, script), ...args], {cwd: target, env, encoding: 'utf8'});
    const audit = run('audit-game-assets.cjs');
    assert.equal(audit.status, 0, audit.stderr);
    assert.equal(JSON.parse(audit.stdout).missing, 1);
    assert.ok(existsSync(path.join(assets, 'game-assets/asset-report.json')));
    assert.equal(run('audit-game-assets.cjs', '--complete').status, 1);
    const imported = run('import-game-assets.cjs');
    assert.equal(imported.status, 1, imported.stderr);
    assert.match(imported.stdout, /No offline cache/);
    assert.ok(existsSync(path.join(assets, 'game-assets/import-report.json')));
    // Validate catalog lookup before any download/network activity.
    const fetched = run('fetch-game-assets.cjs', 'unknown');
    assert.equal(fetched.status, 1);
    assert.match(fetched.stderr, /Unknown game unknown/);
    assert.ok(!existsSync(path.join(target, 'public')));
  } finally {rmSync(target, {recursive: true, force: true});}
});
