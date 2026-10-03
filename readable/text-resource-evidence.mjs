import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// This checks one reviewed, pinned source representation. It does not infer
// names or try to accommodate unreviewed decompiler output shapes.
export function validateTextResourceEvidence(source, manifest, currentRules) {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),
    manifest.loaderSourceSha256, 'loader source differs from the reviewed text evidence');
  const reads = [...source.matchAll(/var2 = fk\.a\(2229, "([^"]+)"\);/g)];
  const assignments = /var2 = fk\.a\(2229, "([^"]+)"\);\s*if \((?:var2 != null|null != var2)\) \{\s*(?:(\w+)\.)?(field_\w+)(?:\[(\d+)\])? = ag\.a\(1, var2\);\s*\}/g;
  const fields = new Map();
  let stored = 0;
  for (const match of source.matchAll(assignments)) {
    const [, key, explicitOwner, originalName, position] = match;
    const owner = explicitOwner ?? 'wi'; // enclosing class of this pinned loader
    const indexed = position !== undefined;
    const symbol = `F:${owner}.${originalName}:` + (indexed ? '[Ljava/lang/String;' : 'Ljava/lang/String;');
    const binding = fields.get(symbol) ?? {symbol, originalName, resources: []};
    binding.resources.push({key, index: indexed ? Number(position) : null,
      line: source.slice(0, match.index).split('\n').length});
    fields.set(symbol, binding);
    if (indexed) assert.equal(key.split(',')[1], position, 'resource index differs from its array position');
    stored++;
  }
  const observed = [...fields.values()].sort((a, b) => a.symbol < b.symbol ? -1 : 1);
  const recorded = manifest.resourceAssignments.map(({symbol, originalName, resources}) =>
    ({symbol, originalName, resources}));
  assert.deepEqual(observed, recorded, 'resource fields differ from direct guarded assignments');
  assert.equal(reads.length, manifest.review.allResourceReads);
  assert.equal(stored, manifest.review.storedResourceReads);
  assert.equal(reads.length - stored, manifest.review.discardedReadsUnnamed);
  const rules = new Map(currentRules.map(rule => [rule.symbol, rule]));
  assert.equal(rules.size, currentRules.length, 'duplicate naming identity');
  for (const binding of manifest.resourceAssignments) {
    const prefixes = new Set(binding.resources.map(resource => resource.key.split(',')[0]));
    assert.equal(prefixes.size, 1, 'ambiguous resource group');
    const rule = rules.get(binding.symbol);
    assert.ok(rule, 'resource field has no guarded name');
    assert.equal(rule.originalName, binding.originalName, 'resource spelling guard differs');
    assert.equal(rule.to, binding.to, 'resource field differs from its reviewed name');
  }
  return {resourceFields: observed.length, storedReads: stored, discardedReads: reads.length - stored};
}
