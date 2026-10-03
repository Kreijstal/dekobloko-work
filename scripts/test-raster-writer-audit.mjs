import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRasterSource} from './audit-geoblox-raster-writers.mjs';

test('inventory retains forwarded arrays and constructor aliases', () => {
  const result = inspectRasterSource(`class Example {
    Example(int[] param0) {
        this.pixels = param0;
    }
    static void draw(int[] param0) {
        int[] alias = param0;
        kernel(alias);
        kernel(vb.field_c);
        vb.field_c[0] = 4;
    }
}`, 'Example.java');
  assert.equal(result.members.length, 2);
  assert.equal(result.members[0].arrayReferenceUses[0].text, 'this.pixels = param0;');
  assert.equal(result.members[1].arrayReferenceUses[0].text, 'int[] alias = param0;');
  assert.equal(result.members[1].rasterReferences.length, 2);
  assert.deepEqual(result.unclassified, []);
});

test('new unrecognized raster use is not silently covered', () => {
  const source = `class Example {
    static int[] escaped = vb.field_c;
}`;
  const result = inspectRasterSource(source, 'Example.java');
  assert.equal(result.unclassified.length, 1);
  assert.notEqual(result.sha256, inspectRasterSource(source + '\n', 'Example.java').sha256);
  assert.throws(() => inspectRasterSource(`class Example {
    void draw() {
        vb.field_c[0] = 1;
}`, 'Example.java'), /unterminated member/);
});

test('only the exact raster field declaration is exempt', () => {
  const source = `class vb {
    static int[] field_c;
    static int[] alias = field_c;
    static void bind(int[] param0) {
        field_c = param0;
    }
}`;
  const result = inspectRasterSource(source, 'vb.java');
  assert.equal(result.unclassified.length, 1);
  assert.equal(result.unclassified[0].text, 'static int[] alias = field_c;');
  assert.equal(result.members[0].rasterReferences.length, 1);
});
