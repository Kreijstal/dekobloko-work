import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {gameNamingCoverage, catalogNamingCoverage} from '../catalog-naming-coverage.mjs';

const symbol = (symbol, renamedName, originalName = renamedName) => ({symbol, renamedName, originalName,
  declaration: {file: 'Game.java'}});
const mapping = () => ({files: [{original: 'Game.java', renamed: 'Game.java'}], rules: [], symbols: [
  symbol('C:Game', 'Game'), symbol('M:Game.run()V', 'run'),
]});

test('counts nested generated helpers, unchanged three-letter classes and explicit placeholders', () => {
  const m = mapping();
  m.symbols.push(symbol('C:abc', 'abc'), symbol('C:x', 'RenderingSupport001', 'x'),
    symbol('C:Game$1$CfrPartitionedBody', '$CfrPartitionedBody'),
    symbol('M:Game$1$CfrPartitionedBody.runChunk0()V', 'runChunk0'),
    symbol('M:Game.compute()I', 'computeInteger0001'), symbol('M:Game.partition()V', 'runPartition1'));
  m.rules.push({symbol: 'C:x', confidence: 'category'}, {symbol: 'M:Game.compute()I',
    evidence: 'Resolved override family; type-based operation label, finer purpose unresolved.'});
  const c = gameNamingCoverage(m);
  assert.equal(c.unresolvedClasses.length, 3);
  assert.equal(c.unresolvedMethods.length, 3);
  assert.equal(c.namedClasses, 1);
  assert.equal(c.namedMethods, 1);
  assert.equal(c.complete, false);
});

test('keeps meaningful short contracts, numeric formats and constructors', () => {
  const m = mapping();
  m.symbols.push(symbol('C:Vector3f', 'Vector3f'), symbol('M:Game.get()I', 'get'),
    symbol('M:Game.crc()I', 'crc32'), symbol('M:Game.<init>()V', 'Game'));
  const c = gameNamingCoverage(m);
  assert.equal(c.complete, true);
  assert.equal(c.methods, 3);
  assert.equal(c.constructors, 1);
});

test('requires the complete canonical roster, dictionaries and matching source bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-coverage-test-'));
  try {
    const catalogFile = path.join(root, 'catalog.tsv');
    fs.writeFileSync(catalogFile, '# catalog\nhostilespawn_vengeance\t1\n');
    fs.mkdirSync(path.join(root, 'games', 'hostilespawn_vengeance'), {recursive: true});
    fs.mkdirSync(path.join(root, 'decompilation'));
    const source = 'class Game { void run() {} }\n';
    const file = path.join(root, 'games', 'hostilespawn_vengeance', 'Game.java');
    fs.writeFileSync(file, source);
    const m = mapping();
    m.files[0].outputSha256 = crypto.createHash('sha256').update(source).digest('hex');
    const dictionary = path.join(root, 'decompilation', 'hostilespawn_vengeance-naming.json');
    fs.writeFileSync(dictionary, JSON.stringify(m));
    const options = {repository: root, catalogFile};
    assert.equal(catalogNamingCoverage(options).complete, true);
    fs.writeFileSync(file, source + '// modified');
    assert.throws(() => catalogNamingCoverage(options), /source differs from dictionary/);
    fs.writeFileSync(file, source);
    fs.unlinkSync(dictionary);
    assert.throws(() => catalogNamingCoverage(options), /ENOENT/);
    fs.writeFileSync(dictionary, JSON.stringify(m));
    fs.appendFileSync(catalogFile, 'missinggame\t1\n');
    assert.throws(() => catalogNamingCoverage(options), /games differ from canonical catalog/);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
