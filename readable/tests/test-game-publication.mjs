import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installNamedGame} from '../game-export.mjs';
import {sourceIdentity, sourceInventory} from '../tools/readable-java.mjs';

test('failed manifest installation restores both current Java and dictionary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'named-rollback-test-'));
  const rename = fs.renameSync;
  try {
    const current = path.join(root, 'games/fixture');fs.mkdirSync(current, {recursive: true});fs.mkdirSync(path.join(root, 'decompilation'));
    fs.writeFileSync(path.join(current, 'Original.java'), 'class Original {}');
    const manifestFile = path.join(root, 'decompilation-provenance.json'), dictionaryFile = path.join(root, 'decompilation/fixture-naming.json');
    const originalManifest = '{"previous":true,"publication":{"games":{"fixture":{}}}}';
    fs.writeFileSync(manifestFile, originalManifest);fs.writeFileSync(dictionaryFile, '{"previousDictionary":true}');
    const generated = path.join(root, 'candidate');fs.mkdirSync(path.join(generated, 'src'), {recursive: true});
    fs.writeFileSync(path.join(generated, 'src/Named.java'), 'class Named {}');
    const dictionary = {files: [{}], provenance: {source: {commit: 'a'.repeat(40)}, outputTreeSha256: sourceIdentity(sourceInventory(path.join(generated, 'src')))},generators: {javaTools: {commit: 'b'.repeat(40)}}};
    fs.renameSync = (from, to) => {if (to === manifestFile) throw new Error('injected manifest failure');return rename(from, to);};
    assert.throws(() => installNamedGame(root, 'fixture', generated, dictionary, 'Guide'), /injected/);
    assert.equal(fs.readFileSync(path.join(current, 'Original.java'), 'utf8'), 'class Original {}');
    assert.equal(fs.readFileSync(dictionaryFile, 'utf8'), '{"previousDictionary":true}');
    assert.equal(fs.readFileSync(manifestFile, 'utf8'), originalManifest);
    assert.equal(fs.existsSync(path.join(current, 'Named.java')), false);
    assert.equal(fs.readdirSync(root).some(n => n.startsWith('.named-refresh-')), false);
  } finally {fs.renameSync = rename;fs.rmSync(root, {recursive: true, force: true});}
});
