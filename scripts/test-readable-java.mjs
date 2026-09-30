import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {generateReadable, sourceInventory, sourceIdentity} from './readable-java.mjs';

function fixture(sources, rules) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readable-java-test-'));
  const input = path.join(root, 'input');
  fs.mkdirSync(input);
  for (const [file, source] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(input, file)), {recursive: true});
    fs.writeFileSync(path.join(input, file), source);
  }
  const rulesFile = path.join(root, 'rules.json');
  fs.writeFileSync(rulesFile, JSON.stringify({schema: 1, inputTreeSha256: sourceIdentity(sourceInventory(input)),
    renames: rules.map(([symbol, to]) => ({symbol, to, evidence: 'Executable fixture'}))}, null, 2) + '\n');
  return {root, input, output: path.join(root, 'readable'), rulesFile};
}

function run(root, source, name) {
  const classes = path.join(root, 'classes-' + name);
  fs.mkdirSync(classes);
  execFileSync(process.env.JAVAC ?? 'javac', ['--release', '8', '-d', classes,
    ...sourceInventory(source).map(file => path.join(source, file.path))], {stdio: 'pipe'});
  return execFileSync(process.env.JAVA ?? 'java', ['-cp', classes, 'p.Main'], {encoding: 'utf8'});
}

test('resolved renames preserve overloads, inheritance, shadows, constructors, literals and exact runtime effects', () => {
  const context = fixture({
    'p/a.java': `package p;
public class a implements i {
  int f = 4, other = f + 1;
  static int counter;
  static { int f = 1; counter = f; }
  { int f = 2; counter += f; }
  public a() {}
  public a(int x) { int f = x; this.f = f; }
  public int m(int x) { int f = x; return this.f + f; }
  public int m(String x) { return x.length(); }
  public a copy() { return new a(); }
}
`,
    'p/i.java': 'package p; interface i { int m(int x); }\n',
    'p/b.java': 'package p; class b extends a { @Override public int m(int x) { return super.m(x) * 2; } }\n',
    'p/Main.java': `package p;
import java.util.function.IntUnaryOperator;
public class Main {
  public static void main(String[] args) {
    a value = new b(); IntUnaryOperator call = value::m;
    a copy = value.copy();
    // a.m f are original documentation, never rewrite this comment.
    String literal = "a m f";
    System.out.println(call.applyAsInt(3) + ":" + value.m("abc") + ":" + copy.f + ":" + literal);
  }
}
`,
  }, [['C:p.a', 'Sprite_a'], ['F:p.a.f:I', 'pixels_f'],
      ['M:p.i.m(I)I', 'mix_m'], ['M:p.a.m(I)I', 'mix_m'], ['M:p.b.m(I)I', 'mix_m'],
      ['P:p.a.m(I)I#0', 'amount_x']]);
  try {
    const result = generateReadable(context);
    assert.equal(result.files, 4);
    const source = fs.readFileSync(path.join(context.output, 'src/p/Sprite_a.java'), 'utf8');
    assert.match(source, /public Sprite_a\(\)/);
    assert.match(source, /public Sprite_a\(int x\) \{ int f = x; this.pixels_f = f; \}/);
    assert.match(source, /int mix_m\(int amount_x\).*int f = amount_x; return this.pixels_f \+ f;/);
    assert.match(source, /int m\(String x\)/);
    const main = fs.readFileSync(path.join(context.output, 'src/p/Main.java'), 'utf8');
    assert.match(main, /value::mix_m/);
    assert.match(main, /String literal = "a m f"/);
    assert.match(main, /\/\/ a.m f are original documentation/);
    const mapping = JSON.parse(fs.readFileSync(path.join(context.output, 'mapping.json')));
    assert.equal(mapping.symbols.find(row => row.symbol === 'M:p.a.copy()Lp/a;').renamedSymbol, 'M:p.Sprite_a.copy()Lp/Sprite_a;');
    assert.equal(run(context.root, context.input, 'original'), '14:3:4:a m f\n');
    assert.equal(run(context.root, path.join(context.output, 'src'), 'renamed'), '14:3:4:a m f\n');
    const provenance = JSON.parse(fs.readFileSync(path.join(context.output, 'provenance.json')));
    assert.ok(provenance.verification.bindingsCompared > 0);
    assert.ok(provenance.verification.overrideFamiliesChecked >= 2);
    assert.match(provenance.jdk, /version/);
    assert.equal(provenance.verification.runtimeEquivalenceVerified, false);
    assert.equal(generateReadable({...context, check: true}).check, true);
    fs.appendFileSync(path.join(context.output, 'src/p/Main.java'), '// tampering\n');
    assert.throws(() => generateReadable({...context, check: true}), /differs from deterministic regeneration/);
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('refuses stale input and overwrite before changing output', () => {
  const context = fixture({'a.java': 'class a {}\n'}, [['C:a', 'Readable_a']]);
  try {
    fs.appendFileSync(path.join(context.input, 'a.java'), '// changed\n');
    assert.throws(() => generateReadable(context), /Source identity mismatch/);
    assert.equal(fs.existsSync(context.output), false);
    fs.mkdirSync(context.output);
    fs.writeFileSync(path.join(context.output, 'keep'), 'untouched');
    assert.throws(() => generateReadable(context), /Output already exists/);
    assert.equal(fs.readFileSync(path.join(context.output, 'keep'), 'utf8'), 'untouched');
    assert.throws(() => generateReadable({...context, output: path.join(context.input, 'nested')}), /separate/);
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('refuses incomplete override families and external callback renames', () => {
  const cases = [
    fixture({'a.java': 'class a { int m() { return 1; } } class b extends a { int m() { return 2; } }\n'},
      [['M:a.m()I', 'changed']]),
    fixture({'a.java': 'class a implements Runnable { public void run() {} }\n'},
      [['M:a.run()V', 'changed']]),
  ];
  try {
    for (const context of cases) {
      assert.throws(() => generateReadable(context), /Incomplete override family/);
      assert.equal(fs.existsSync(context.output), false);
    }
  } finally { for (const context of cases) fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('refuses a compiling rewrite that silently rebinds an untouched field reference', () => {
  const context = fixture({'a.java': 'class a { int f = 1; int m() { int named = 2; return f + named; } }\n'},
    [['F:a.f:I', 'named']]);
  try {
    assert.throws(() => generateReadable(context), /Binding changed/);
    assert.equal(fs.existsSync(context.output), false);
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('refuses a new virtual override even when all source references still bind', () => {
  const context = fixture({'a.java': 'class a { int named() { return 1; } } class b extends a { int m() { return 2; } }\n'},
    [['M:b.m()I', 'named']]);
  try {
    assert.throws(() => generateReadable(context), /Override relationships changed/);
    assert.equal(fs.existsSync(context.output), false);
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});
