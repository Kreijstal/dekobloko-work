import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

const root = publishedReadableRoot;
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile))
  .renames.map(rule => [rule.symbol, rule.to]));
const expected = 'e2e462accb656ba5820c8a5f28b8a45f71a06b8a48045ba0dccbed73a0eedd1c';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-text-'));
const nativeClasses = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (process.argv.length > 3) throw new Error('Usage: node test-geoblox-text.mjs [VERIFIED_TRANSFORMED_CLASSES]');

function verifyNativeInput(directory) {
  const files = [];
  const visit = subdirectory => {
    for (const entry of fs.readdirSync(subdirectory, {withFileTypes: true})) {
      const file = path.join(subdirectory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.class')) files.push(file);
    }
  };
  visit(directory);
  const hash = crypto.createHash('sha256');
  for (const file of files.sort()) {
    const name = Buffer.from(path.relative(directory, file).split(path.sep).join('/'));
    const bytes = fs.readFileSync(file);
    hash.update(String(name.length) + ':'); hash.update(name);
    hash.update(String(bytes.length) + ':'); hash.update(bytes);
  }
  const pin = JSON.parse(fs.readFileSync(path.join(root, '../decompilation/geoblox-provenance.json')))
    .verifiedTransformedClasses;
  assert.equal(files.length, pin.files);
  assert.equal(hash.digest('hex'), pin.sha256, 'native probe must use the fixed transformed bytecode');
}

try {
  if (nativeClasses) verifyNativeInput(nativeClasses);
  for (const variant of ['original', 'renamed', ...(nativeClasses ? ['native'] : [])]) {
    const renamed = variant === 'renamed', native = variant === 'native';
    const name = (symbol, original) => renamed ? aliases.get(symbol) ?? original : original;
    const type = original => name('C:' + original, original);
    const call = (owner, descriptor) => type(owner) + '.' + name('M:' + owner + '.' + descriptor, descriptor.split('(')[0]);
    const guard = native ? 'C' : name('F:Geoblox.field_C:I', 'field_C');
    const context = native ? 'd' : name('F:sa.field_d:Ljava/lang/String;', 'field_d');
    const decoderFlag = native ? 'a' : name('F:bc.field_a:I', 'field_a');
    const decoderArray = native ? 'j' : name('F:ag.field_j:[Z', 'field_j');
    const harness = `public class TextBehavior {
      static void check(boolean value, String label) { if (!value) throw new AssertionError(label); }
      public static void main(String[] args) throws Exception {
        java.lang.reflect.Field guard = ${type('Geoblox')}.class.getDeclaredField("${guard}");
        guard.setAccessible(true); guard.setInt(null, 0);
        byte[][] inputs = {new byte[0], new byte[]{65,0,66},
          new byte[]{(byte)128,(byte)129,(byte)159,(byte)255}, new byte[256]};
        for (int i = 0; i < 256; i++) inputs[3][i] = (byte)i;
        for (byte[] bytes : inputs) {
          String value = ${call('ag', 'a(I[B)Ljava/lang/String;')}(1, bytes);
          StringBuilder output = new StringBuilder();
          for (int i = 0; i < value.length(); i++) output.append((int)value.charAt(i)).append(',');
          System.out.println(output);
        }
        try { ${call('wi', 'a(BLrh;)V')}((byte)74, (${type('rh')})null);
          throw new AssertionError("null archive succeeded"); }
        catch (RuntimeException error) {
          if (error.getClass() != ${type('sa')}.class) throw new AssertionError(error);
          System.out.println("sa");
          java.lang.reflect.Field context = error.getClass().getDeclaredField("${context}");
          context.setAccessible(true); System.out.println(context.get(error));
        }
        // Check slices against the already probed whole-array decoder, including
        // boundaries around NUL and the extended-character byte range.
        byte[] allBytes = inputs[3];
        for (int offset : new int[]{0,1,127,128,159,200,256})
          for (int length : new int[]{0,1,2,10,256-offset}) {
            if (offset + length > 256) continue;
            String expected = ${call('ag', 'a(I[B)Ljava/lang/String;')}(1,
              java.util.Arrays.copyOfRange(allBytes, offset, offset + length));
            check(${call('bc', 'a(I[BII)Ljava/lang/String;')}(-8, allBytes, offset, length).equals(expected),
              "slice " + offset + ":" + length);
          }
        check(${call('fk', 'a(ILjava/lang/String;)[B')}(2228, "ignored") == null, "reader guard");
        java.lang.reflect.Field decoderFlag = ${type('bc')}.class.getDeclaredField("${decoderFlag}");
        decoderFlag.setAccessible(true); decoderFlag.setInt(null, -1);
        check(${call('bc', 'a(I[BII)Ljava/lang/String;')}(-8, null, 0, 0).equals(""), "empty null slice");
        check(decoderFlag.getInt(null) == -1, "ordinary slice leaves flag unchanged");
        check(${call('bc', 'a(I[BII)Ljava/lang/String;')}(1, null, 0, 0).equals(""), "guarded empty slice");
        check(decoderFlag.getInt(null) == 49, "positive slice guard preserves flag write");
        java.lang.reflect.Field decoderArray = ${type('ag')}.class.getDeclaredField("${decoderArray}");
        decoderArray.setAccessible(true); boolean[] marker = new boolean[]{true};
        decoderArray.set(null, marker);
        check(${call('ag', 'a(I[B)Ljava/lang/String;')}(1, new byte[]{65}).equals("A"), "whole decoder");
        check(decoderArray.get(null) == marker, "ordinary whole decode preserves array");
        check(${call('ag', 'a(I[B)Ljava/lang/String;')}(0, new byte[]{65}).equals("A"), "whole decoder guard");
        check(decoderArray.get(null) == null, "whole decoder guard preserves array cleanup");
      }
    }`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'TextBehavior.java'); fs.writeFileSync(harnessFile, harness);
    const stub = path.join(root, 'funorb-stubs.jar');
    const classpath = native ? nativeClasses + path.delimiter + stub : stub;
    const sourceRoot = path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const sources = native ? [] : sourceInventory(sourceRoot).map(file => path.join(sourceRoot, file.path));
    const files = path.join(directory, 'sources.txt');
    fs.writeFileSync(files, [...sources, harnessFile].map(file => JSON.stringify(file)).join('\n') + '\n');
    captureProcess(process.env.JAVAC ?? 'javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8',
      '-classpath', classpath, '-d', classes, '@' + files]);
    const output = captureProcess(process.env.JAVA ?? 'java', ['-Djava.awt.headless=true',
      '-cp', classes + path.delimiter + classpath, 'TextBehavior']).stdout;
    assert.equal(crypto.createHash('sha256').update(output).digest('hex'), expected,
      `${variant}: decoding and nested failure context must match the verified original JVM probe`);
    console.log(`${variant}: four decoder inputs, slice boundaries, guard effects and nested archive failure context passed`);
  }
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
