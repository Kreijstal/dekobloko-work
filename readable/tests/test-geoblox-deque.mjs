import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

const root = publishedReadableRoot;
const rules = JSON.parse(fs.readFileSync(manifestFile));
const aliases = new Map(rules.renames.map(rule => [rule.symbol, rule.to]));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-deque-'));
try {
  for (const renamed of [false, true]) {
    const name = (key, original) => renamed ? aliases.get(key) ?? original : original;
    const node = name('C:hf', 'hf'), deque = name('C:tf', 'tf'), dual = name('C:rc', 'rc');
    const method = (signature, original) => name('M:tf.' + signature, original);
    const next = name('F:hf.field_b:Lhf;', 'field_b');
    const previous = name('F:hf.field_c:Lhf;', 'field_c');
    const secondaryNext = name('F:rc.field_k:Lrc;', 'field_k');
    const secondaryPrevious = name('F:rc.field_l:Lrc;', 'field_l');
    const harness = `public final class DequeBehavior {
      static void check(boolean value) { if (!value) throw new AssertionError(); }
      public static void main(String[] args) {
        ${deque} source = new ${deque}(), destination = new ${deque}();
        ${node} a = new ${node}(), b = new ${node}(), c = new ${node}(), d = new ${node}();
        source.${method('a(ILhf;)V', 'a')}(-35, a);
        source.${method('a(ILhf;)V', 'a')}(-35, b);
        source.${method('a(Lhf;Z)V', 'a')}(c, false);
        check(source.${method('a(I)I', 'a')}(100) == 3);
        check(source.${method('g(I)Lhf;', 'g')}(0) == c);
        check(source.${method('d(I)Lhf;', 'd')}(1) == a);
        check(source.${method('d(I)Lhf;', 'd')}(1) == b);
        check(source.${method('d(I)Lhf;', 'd')}(1) == null);
        check(source.${method('a(Z)Lhf;', 'a')}(false) == b);
        check(source.${method('b(I)Lhf;', 'b')}(0) == a);
        check(source.${method('b(I)Lhf;', 'b')}(0) == c);
        check(source.${method('b(I)Lhf;', 'b')}(0) == null);
        check(source.${method('b(B)Lhf;', 'b')}((byte)-100) == c);
        check(c.${next} == null && c.${previous} == null);
        check(source.${method('e(I)Lhf;', 'e')}(1) == b);
        destination.${method('a(ILhf;)V', 'a')}(-35, d);
        destination.${method('a(ILhf;)V', 'a')}(-35, a);
        check(source.${method('c(I)Z', 'c')}(13519));
        source.${method('a(ILhf;)V', 'a')}(-35, b);
        source.${method('a(ILhf;)V', 'a')}(-35, c);
        source.${method('a(Ltf;B)V', 'a')}(destination, (byte)-70);
        check(source.${method('c(I)Z', 'c')}(13519));
        check(destination.${method('b(B)Lhf;', 'b')}((byte)-100) == d);
        check(destination.${method('b(B)Lhf;', 'b')}((byte)-100) == a);
        check(destination.${method('b(B)Lhf;', 'b')}((byte)-100) == b);
        check(destination.${method('b(B)Lhf;', 'b')}((byte)-100) == c);
        check(destination.${method('b(B)Lhf;', 'b')}((byte)-100) == null);
        source.${method('a(ILhf;)V', 'a')}(-35, a);
        source.${method('a(ILhf;)V', 'a')}(-35, b);
        source.${method('c(B)V', 'c')}((byte)-126);
        check(source.${method('c(I)Z', 'c')}(13519));
        check(a.${next} == null && b.${previous} == null);
        ${dual} linked = new ${dual}(), sentinel = new ${dual}();
        source.${method('a(ILhf;)V', 'a')}(-35, linked);
        sentinel.${secondaryNext} = sentinel.${secondaryPrevious} = linked;
        linked.${secondaryNext} = linked.${secondaryPrevious} = sentinel;
        linked.${name('M:rc.a(B)V', 'a')}((byte)45);
        check(linked.${secondaryNext} == null && linked.${secondaryPrevious} == null);
        check(linked.${next} != null && linked.${previous} != null);
        check(sentinel.${secondaryNext} == sentinel && sentinel.${secondaryPrevious} == sentinel);
        source.${method('c(B)V', 'c')}((byte)-126);
        System.out.println("deque behavior passed");
      }
    }`;
    const directory = path.join(temporary, renamed ? 'renamed' : 'original');
    const classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'DequeBehavior.java');
    fs.writeFileSync(harnessFile, harness);
    const sourceRoot = path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const files = path.join(directory, 'sources.txt');
    fs.writeFileSync(files, [...sourceInventory(sourceRoot).map(file => JSON.stringify(path.join(sourceRoot, file.path))), JSON.stringify(harnessFile)].join('\n') + '\n');
    const classpath = path.join(root, 'funorb-stubs.jar');
    captureProcess(process.env.JAVAC ?? 'javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-classpath', classpath, '-d', classes, '@' + files]);
    const output = captureProcess(process.env.JAVA ?? 'java', ['-Djava.awt.headless=true', '-cp', classes + path.delimiter + classpath, 'DequeBehavior']);
    assert.equal(output.stdout.toString(), 'deque behavior passed\n');
    console.log(`${renamed ? 'renamed' : 'original'}: head/tail, bidirectional traversal, transfer, splice, clear and independent secondary links passed`);
  }
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
