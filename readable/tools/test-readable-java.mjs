import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {captureProcess} from './lib/capture-process.mjs';
import {generateReadable, sourceInventory, sourceIdentity} from './readable-java.mjs';

function fixture(sources, rules, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'readable-java-test-'));
  const input = path.join(root, 'input');
  fs.mkdirSync(input);
  for (const [file, source] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(input, file)), {recursive: true});
    fs.writeFileSync(path.join(input, file), source);
  }
  const rulesFile = path.join(root, 'rules.json');
  fs.writeFileSync(rulesFile, JSON.stringify({schema: 1, inputTreeSha256: sourceIdentity(sourceInventory(input)),
    renames: rules.map(([symbol, to, originalName]) => ({symbol, to, evidence: 'Executable fixture',
      ...(originalName === undefined ? {} : {originalName})})), ...options}, null, 2) + '\n');
  return {root, input, output: path.join(root, 'readable'), rulesFile};
}

function run(root, source, name) {
  const classes = path.join(root, 'classes-' + name);
  fs.mkdirSync(classes);
  captureProcess(process.env.JAVAC ?? 'javac', ['--release', '8', '-d', classes,
    ...sourceInventory(source).map(file => path.join(source, file.path))], {});
  return captureProcess(process.env.JAVA ?? 'java', ['-cp', classes, 'p.Main']).stdout.toString();
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

test('local rules identify declarations across scopes and retain exact runtime effects', () => {
  const context = fixture({'p/Main.java': `package p;
public class Main {
  public static void main(String[] args) {
    int total = 0;
    { int value = 3; total += value; }
    { int value = 7; total += value; }
    try { throw new IllegalStateException("value"); }
    catch (IllegalStateException value) { System.out.println(total + ":" + value.getMessage()); }
  }
}
`}, [['L:p.Main.main([Ljava/lang/String;)V#1', 'leftValue_value', 'value']]);
  try {
    generateReadable(context);
    const source = fs.readFileSync(path.join(context.output, 'src/p/Main.java'), 'utf8');
    assert.match(source, /int leftValue_value = 3; total \+= leftValue_value/);
    assert.match(source, /int value = 7; total \+= value/);
    assert.match(source, /catch \(IllegalStateException value\)/);
    assert.equal(run(context.root, context.input, 'original'), '10:value\n');
    assert.equal(run(context.root, path.join(context.output, 'src'), 'renamed'), '10:value\n');
    assert.equal(generateReadable({...context, check: true}).check, true);
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('local ordinal rules reject absent or wrong original-name guards', () => {
  for (const originalName of [undefined, 'different']) {
    const context = fixture({'a.java': 'class a { int m() { int value = 1; return value; } }\n'},
      [['L:a.m()I#0', 'readable_value', originalName]]);
    try {
      assert.throws(() => generateReadable(context), /requires originalName|Original name mismatch/);
      assert.equal(fs.existsSync(context.output), false);
    } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
  }
});

test('constructor parameter rules preserve overloads, local carriers and exact reversal', () => {
  const context = fixture({
    'p/a.java': `package p; class a {
      int x;
      a(int x) { this.x = x++; }
      a(String x) { this.x = x.length(); }
    }`,
    'p/Main.java': `package p; public class Main {
      public static void main(String[] args) {
        class Loader { int result; Loader(int x) { result = x + 2; } }
        System.out.println(new a(4).x + ":" + new a("abc").x + ":" + new Loader(7).result);
      }
    }`,
  }, [['C:p.a', 'Packet'], ['F:p.a.x:I', 'value'],
      ['P:p.a.<init>(I)V#0', 'initialValue', 'x'],
      ['P:p.Main$1Loader.<init>(I)V#0', 'initialInput', 'x']]);
  try {
    generateReadable(context);
    const source = fs.readFileSync(path.join(context.output, 'src/p/Packet.java'), 'utf8');
    assert.match(source, /Packet\(int initialValue\) \{ this\.value = initialValue\+\+; \}/);
    assert.match(source, /Packet\(String x\) \{ this\.value = x\.length\(\); \}/);
    const main = fs.readFileSync(path.join(context.output, 'src/p/Main.java'), 'utf8');
    assert.match(main, /Loader\(int initialInput\) \{ result = initialInput \+ 2; \}/);
    assert.equal(run(context.root, context.input, 'original'), '4:3:9\n');
    assert.equal(run(context.root, path.join(context.output, 'src'), 'renamed'), '4:3:9\n');
    assert.equal(generateReadable({...context, check: true}).check, true);
    const restored = path.join(context.root, 'restored');
    captureProcess(process.execPath, [new URL('./restore-original.mjs', import.meta.url).pathname,
      context.output, restored]);
    for (const file of sourceInventory(context.input))
      assert.deepEqual(fs.readFileSync(path.join(restored, file.path)),
        fs.readFileSync(path.join(context.input, file.path)));
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('constructor identities still require a class rule rather than a method rename', () => {
  const context = fixture({'a.java': 'class a { a(int x) {} }'},
    [['M:a.<init>(I)V', 'build', 'a']]);
  try {
    assert.throws(() => generateReadable(context), /Use a class rule to rename constructors/);
    assert.equal(fs.existsSync(context.output), false);
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('owned Class.forName literals preserve loading, initialization, reflection calls and exact reversal', () => {
  const context = fixture({
    'p/a.java': `package p; public class a {
      static { Main.initializations++; }
      public a() {} public int value() { return 17; }
    }`,
    'p/Main.java': `package p; public class Main {
      static int initializations;
      static class Class { static String forName(String name) { return name; } }
      public static void main(String[] args) throws Exception {
        java.lang.Class<?> lazy = java.lang.Class.forName(("p.a"), false, Main.class.getClassLoader());
        System.out.print(initializations + ":");
        Object instance = java.lang.Class.forName("p.a").newInstance();
        System.out.println(initializations + ":" + lazy.getMethod("value").invoke(instance)
          + ":" + Class.forName("p.a") + ":" + "p.a");
        java.lang.Class.forName("java.lang.String");
        // Class.forName("p.a") is documentation, not an executable lookup.
      }
    }`,
  }, [['C:p.a', 'ReflectedValue']], {classNameLiterals: {policy: 'direct-owned-class-for-name', expectedEdits: 2}});
  try {
    const result = generateReadable(context);
    assert.equal(result.classNameLiteralEdits, 2);
    const main = fs.readFileSync(path.join(context.output, 'src/p/Main.java'), 'utf8');
    assert.match(main, /java\.lang\.Class\.forName\(\("p.ReflectedValue"\), false/);
    assert.match(main, /Class\.forName\("p.a"\) \+ ":" \+ "p.a"/);
    assert.match(main, /Class\.forName\("java.lang.String"\)/);
    assert.match(main, /\/\/ Class.forName\("p.a"\)/);
    assert.equal(run(context.root, context.input, 'original'), '0:1:17:p.a:p.a\n');
    assert.equal(run(context.root, path.join(context.output, 'src'), 'renamed'), '0:1:17:p.a:p.a\n');
    const mapping = JSON.parse(fs.readFileSync(path.join(context.output, 'mapping.json')));
    assert.equal(mapping.files.flatMap(file => file.edits).filter(edit => edit.kind === 'class-name-literal').length, 2);
    assert.equal(generateReadable({...context, check: true}).check, true);
    const restored = path.join(context.root, 'restored');
    captureProcess(process.execPath, [new URL('./restore-original.mjs', import.meta.url).pathname, context.output, restored]);
    for (const file of sourceInventory(context.input))
      assert.deepEqual(fs.readFileSync(path.join(restored, file.path)), fs.readFileSync(path.join(context.input, file.path)));
  } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
});

test('reflective class renames require explicit policy and the reviewed edit count', () => {
  for (const policy of [undefined, {policy: 'direct-owned-class-for-name', expectedEdits: 2}]) {
    const context = fixture({'a.java': 'class a { static Class<?> load() throws Exception { return Class.forName("a"); } }'},
      [['C:a', 'NamedClass']], policy ? {classNameLiterals: policy} : {});
    try {
      assert.throws(() => generateReadable(context), /requires explicit Class.forName literal policy|edit count differs/);
      assert.equal(fs.existsSync(context.output), false);
    } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
  }
});

test('escaped owned class literals remain unchanged or refuse a renamed target', () => {
  const source = String.raw`class a { static Class<?> load() throws Exception { return Class.forName("\u0061"); } }`;
  for (const renames of [[], [['C:a', 'NamedClass']]]) {
    const context = fixture({'a.java': source}, renames, {classNameLiterals: {policy: 'direct-owned-class-for-name'}});
    try {
      if (renames.length) {
        assert.throws(() => generateReadable(context), /Escaped Class.forName literal/);
        assert.equal(fs.existsSync(context.output), false);
      } else {
        assert.equal(generateReadable(context).classNameLiteralEdits, 0);
        assert.equal(fs.readFileSync(path.join(context.output, 'src/a.java'), 'utf8'), source);
      }
    } finally { fs.rmSync(context.root, {recursive: true, force: true}); }
  }
});
