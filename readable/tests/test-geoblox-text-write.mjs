import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

// Exercise the real score-text writer, including offsets, retained suffixes,
// aliasing, partial writes and exception wrapping. No game assets are needed.
const root = publishedReadableRoot;
const nativeInput = process.argv[2] && path.resolve(process.argv[2]);
if (!nativeInput) throw new Error('Usage: node readable/tests/test-geoblox-text-write.mjs NATIVE_CLASSES');
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile))
  .renames.map(rule => [rule.symbol, rule.to]));
const expectedNativeSha256 = 'c99483f76661e9d3866aab389d6bd640e45ab1ff3e1766ad6a8aa7d9f3214f31';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-text-write-'));
try {
  const files = [];
  const visit = directory => {
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) visit(file);
      else if (item.name.endsWith('.class')) files.push(file);
    }
  };
  visit(nativeInput);
  const nativeHash = crypto.createHash('sha256');
  for (const file of files.sort()) {
    const name = Buffer.from(path.relative(nativeInput, file).split(path.sep).join('/'));
    const bytes = fs.readFileSync(file);
    nativeHash.update(name.length + ':'); nativeHash.update(name);
    nativeHash.update(bytes.length + ':'); nativeHash.update(bytes);
  }
  const nativePin = JSON.parse(fs.readFileSync(path.join(root, '../decompilation/geoblox-provenance.json')))
    .verifiedTransformedClasses;
  assert.equal(files.length, nativePin.files);
  assert.equal(nativeHash.digest('hex'), nativePin.sha256);
  let expected;
  for (const variant of ['native', 'original', 'renamed']) {
    const native = variant === 'native', renamed = variant === 'renamed';
    const name = (symbol, original) => renamed ? aliases.get(symbol) ?? original : original;
    const type = original => name('C:' + original, original);
    const field = (owner, original, descriptor) => native ? original.replace(/^field_/, '')
      : name(`F:${owner}.${original}:${descriptor}`, original);
    const signature = 'a(Ljava/lang/CharSequence;Ljava/lang/StringBuilder;II)Ljava/lang/StringBuilder;';
    const harness = `import java.lang.reflect.*;
      public class TextWriteBehavior {
        static Method writer; static Field originalError; static StringBuilder calls;
        static Throwable failed; static int cases;
        static class Source implements CharSequence {
          final String value; final int failureAt, kind;
          Source(String value,int failureAt,int kind) { this.value=value;this.failureAt=failureAt;this.kind=kind; }
          public int length() { calls.append('L'); if(failureAt==-2) fail(); return value.length(); }
          public char charAt(int index) { calls.append(index); if(index==failureAt)fail(); return value.charAt(index); }
          public CharSequence subSequence(int a,int b) { throw new AssertionError("unused"); }
          void fail() { if(kind==0) { failed=new IllegalArgumentException("source failure"); throw (IllegalArgumentException)failed; }
            failed=new AssertionError("source failure");throw (AssertionError)failed; }
        }
        static String encode(CharSequence text) {
          if(text==null)return "null";
          StringBuilder result=new StringBuilder();
          for(int i=0;i<text.length();i++)result.append(Integer.toHexString(text.charAt(i))).append(',');
          return result.toString();
        }
        static void run(String label,CharSequence input,StringBuilder target,int offset,boolean oracle) throws Exception {
          String before=target==null?null:target.toString();calls=new StringBuilder();failed=null;
          String outcome;
          try {
            Object result=writer.invoke(null,input,target,offset,47);
            if(result!=target)throw new AssertionError("returned different builder");
            if(oracle) {
              String source=input.toString();int end=offset+source.length();
              String wanted=before.substring(0,offset)+source+(end<before.length()?before.substring(end):"");
              if(!target.toString().equals(wanted))throw new AssertionError("prefix/suffix oracle");
            }
            if(input==target) {
              String wanted=offset==0?"abc":offset==1?"aaaa":"abcabc";
              if(!target.toString().equals(wanted))throw new AssertionError("sequential alias oracle");
            }
            outcome="same";
          } catch(InvocationTargetException wrapped) {
            Throwable error=wrapped.getCause();Throwable cause=error;
            if(originalError.getDeclaringClass().isInstance(error))cause=(Throwable)originalError.get(error);
            if(failed!=null&&cause!=failed)throw new AssertionError("source throwable identity");
            outcome=(error==cause?"escaped:":"wrapped:")+cause.getClass().getSimpleName()+":"+(failed!=null&&cause==failed);
          }
          System.out.println(label+":"+offset+":"+outcome+":"+encode(target)+":"+calls);cases++;
        }
        public static void main(String[] args) throws Exception {
          Thread watchdog=new Thread(()->{try{Thread.sleep(45000);}catch(InterruptedException error){}System.exit(124);});
          watchdog.setDaemon(true);watchdog.start();
          writer=Class.forName("${type('td')}").getDeclaredMethod("${name('M:td.' + signature, 'a')}",
            CharSequence.class,StringBuilder.class,int.class,int.class);writer.setAccessible(true);
          originalError=Class.forName("${type('sa')}").getDeclaredField("${field('sa', 'field_a', 'Ljava/lang/Throwable;')}");
          originalError.setAccessible(true);
          Field control=Class.forName("${type('Geoblox')}").getDeclaredField("${field('Geoblox', 'field_C', 'I')}");
          control.setAccessible(true);
          for(int guard:new int[]{0,1}) { control.setInt(null,guard);
            for(String old:new String[]{"","0123456789","abcdef"})
            for(String value:new String[]{"","x","123456789012","\\u0000\\ud800\\udfff"})
            for(int offset:new int[]{-1,0,1,old.length(),old.length()+1}) {
              run("ordinary:"+guard,new String(value),new StringBuilder(old),offset,offset>=0&&offset<=old.length());
            }
            for(int offset:new int[]{0,1,3}) {
              StringBuilder target=new StringBuilder("abc");run("alias:"+guard,target,target,offset,false);
            }
            for(int at:new int[]{-2,-1,0,1,2})for(int kind:new int[]{0,1}) {
              run("effects:"+guard+":"+at+":"+kind,new Source("XYZ",at,kind),new StringBuilder("abcdef"),2,false);
            }
            run("null-source:"+guard,null,new StringBuilder("abc"),0,false);
            run("null-target:"+guard,"x",null,0,false);
            run("null-both:"+guard,null,null,0,false);
          }
          System.out.println("complete:"+cases);
        }
      }`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'TextWriteBehavior.java');
    fs.writeFileSync(harnessFile, harness);
    const stub = path.join(root, 'funorb-stubs.jar');
    const cp = native ? nativeInput + path.delimiter + stub : stub;
    const sources = native ? [] : sourceInventory(path.join(root, renamed ? 'geoblox/src' : '../games/geoblox'))
      .map(file => path.join(root, renamed ? 'geoblox/src' : '../games/geoblox', file.path));
    const list = path.join(directory, 'sources.txt');
    fs.writeFileSync(list, [...sources, harnessFile].map(file => JSON.stringify(file)).join('\n') + '\n');
    captureProcess('javac', ['--release','8','-proc:none','-encoding','UTF-8','-classpath',cp,'-d',classes,'@'+list]);
    const output = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'TextWriteBehavior']).stdout;
    const sha256 = crypto.createHash('sha256').update(output).digest('hex');
    console.log(JSON.stringify({variant, sha256, completion: output.toString().trim().split('\n').at(-1)}));
    assert.equal(sha256, expectedNativeSha256, variant);
    if (expected === undefined) expected = output;
    else assert.equal(Buffer.compare(output, expected), 0, variant);
  }
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
