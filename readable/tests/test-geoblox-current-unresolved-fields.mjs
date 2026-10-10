import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {funorbRepository, manifestFile, workflowRepository} from '../layout.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

// Keep the historical observer frozen. Recompute its field facts against the
// current committed corpus, allowing only independently checked file hashes to
// differ from the prior inventory. No field purpose is inferred by this audit.
assert.equal(process.argv.length, 2);
const read = file => JSON.parse(fs.readFileSync(file));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = read(manifestFile);
const provenance = read(path.join(funorbRepository, 'decompilation/geoblox-provenance.json'));
const proof = provenance.currentUnresolvedFieldSourceAudit;
assert.equal(proof.fixture, 'readable/tests/test-geoblox-current-unresolved-fields.mjs');
assert.equal(hash(fs.readFileSync(new URL(import.meta.url))), proof.fixtureSha256);
assert.equal(manifest.source.commit, proof.sourceCommit);
assert.equal(manifest.inputTreeSha256, proof.sourceTreeSha256);
assert.equal(proof.observerFixture, 'readable/tests/test-geoblox-unresolved-fields.mjs');
assert.equal(proof.observerFixtureSha256,
  '481dfb6193bc4226434c89e0b9f6330f355adea396acc6e64ca00d65158a79e3');
const observer = path.join(workflowRepository, proof.observerFixture);
assert.equal(hash(fs.readFileSync(observer)), proof.observerFixtureSha256);
const previous = JSON.parse(captureProcess('git', ['-C', workflowRepository, 'show',
  proof.previousInventoryCommit + ':readable/geoblox-rules.json'],
  {maxBuffer: 128 * 1024 * 1024}).stdout);
const actual = JSON.parse(captureProcess(process.execPath, [observer, '--preview'],
  {maxBuffer: 128 * 1024 * 1024}).stdout);
assert.equal(actual.sourceCommit, proof.sourceCommit);
assert.equal(actual.sourceTreeSha256, proof.sourceTreeSha256);
assert.equal(actual.compiledSourceFiles, 303);
assert.equal(actual.unresolvedFieldPurposes, 41);
const observations = inventory => inventory.map(({sourceSha256, ...facts}) => facts);
const oldInventory = previous.publication.verification.unresolvedFieldPurposeInventory;
assert.deepEqual(observations(actual.inventory), observations(oldInventory));
assert.deepEqual(actual.inventory, manifest.publication.verification.unresolvedFieldPurposeInventory);
const sourceHashes = new Map(manifest.publication.sourceEvidence.map(row => [row.file, row.sha256]));
for (const field of actual.inventory) assert.equal(field.sourceSha256, sourceHashes.get(field.file));
const refreshed = actual.inventory.filter((field, index) =>
  field.sourceSha256 !== oldInventory[index].sourceSha256);
assert.equal(refreshed.length, proof.refreshedSourceHashes);
assert.deepEqual([...new Set(refreshed.map(field => field.file))].sort(), proof.refreshedSourceFiles);
console.log(JSON.stringify({sourceCommit: actual.sourceCommit, sourceTreeSha256: actual.sourceTreeSha256,
  compiledSourceFiles: 303, unresolvedFieldPurposes: 41, publicFieldsWithoutOrdinaryReferences: 6,
  privateConstructorMergeOnlyFields: 35, fieldObservationsPreserved: true,
  refreshedSourceHashes: refreshed.length, refreshedSourceFiles: proof.refreshedSourceFiles}));
