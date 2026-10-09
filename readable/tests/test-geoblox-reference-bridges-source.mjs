import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {funorbRepository, workflowRoot} from '../layout.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

// This certificate requires deletion-only reference bridge cleanup and exact
// independently recompiled JVM instructions/exception tables. It proves the
// selected source pass, not equivalence of the whole game to original bytecode.
const preview = process.argv.includes('--preview');
const javaTools = path.resolve(process.argv.slice(2).find(arg => arg !== '--preview') || '../java-tools');
const root = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.checkedReferenceCastBridgeCleanup;
assert.ok(preview || proof);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-reference-bridge-proof-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (cmd, args) => {
  try { return captureProcess(cmd, args, {maxBuffer: 128 * 1024 * 1024}).stdout.toString(); }
  catch (error) { throw new Error(error.stderr?.toString() || error.message); }
};
const rows = text => text.trim().split('\n').filter(Boolean).map(line => line.split('\t'));
try {
  function archive(repo, commit, name, subpath) {
    const tar = path.join(temporary, name + '.tar'), directory = path.join(temporary, name);
    run('git', ['-C', repo, 'archive', '--format=tar', '--output=' + tar, commit, ...(subpath ? [subpath] : [])]);
    fs.mkdirSync(directory); run('tar', ['-xf', tar, '-C', directory]);
    return {directory, sha256: hash(fs.readFileSync(tar))};
  }
  const pin = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'tools/PIN.json')));
  assert.equal(hash(fs.readFileSync(path.join(workflowRoot, 'tools/lib/ReadableJava.java'))), pin.files['lib/ReadableJava.java']);
  if (proof) {
    assert.equal(archive(javaTools, proof.javaToolsCommit, 'tools').sha256, proof.sourceArchiveSha256);
    assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))), proof.sourceProofTestSha256);
  }
  const before = preview ? path.join(funorbRepository, 'games/geoblox')
    : path.join(archive(funorbRepository, proof.previousSourceCommit, 'before', 'games/geoblox').directory, 'games/geoblox');
  const after = preview ? process.env.GEOBLOX_REFERENCE_CAST_CANDIDATE_DIR
    : path.join(archive(funorbRepository, proof.sourceCommit, 'after', 'games/geoblox').directory, 'games/geoblox');
  assert.ok(after, 'preview requires GEOBLOX_REFERENCE_CAST_CANDIDATE_DIR');
  const entries = sourceInventory(before), next = sourceInventory(after); assert.equal(entries.length, 303);
  assert.deepEqual(next.map(e => e.path), entries.map(e => e.path));
  if (proof) { assert.equal(sourceIdentity(entries), proof.previousSourceTreeSha256); assert.equal(sourceIdentity(next), proof.sourceTreeSha256); }
  const helper = path.join(temporary, 'ReferenceBridgeFacts.java');
  fs.writeFileSync(helper, `import java.io.*;import java.nio.file.*;import java.util.*;import java.util.stream.*;import javax.tools.*;import javax.lang.model.type.*;import com.sun.source.tree.*;import com.sun.source.util.*;
public class ReferenceBridgeFacts{
 public static void main(String[]args)throws Exception{
  JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();
  try(StandardJavaFileManager fm=compiler.getStandardFileManager(errors,null,null);Stream<Path> paths=Files.list(Paths.get(args[0]))){
   List<File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());
   JavacTask task=(JavacTask)compiler.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-sourcepath","","-classpath",args[1]),null,fm.getJavaFileObjectsFromFiles(files));List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);task.analyze();for(Diagnostic<?> d:errors.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d);
   Trees trees=Trees.instance(task);SourcePositions positions=trees.getSourcePositions();for(CompilationUnitTree unit:units){String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();new TreePathScanner<Void,Void>(){
    @Override public Void visitTypeCast(TypeCastTree n,Void unused){
     TypeMirror target=trees.getTypeMirror(new TreePath(getCurrentPath(),n.getType())),operand=trees.getTypeMirror(new TreePath(getCurrentPath(),n.getExpression()));
     TreePath parent=getCurrentPath().getParentPath();while(parent!=null&&parent.getLeaf() instanceof ParenthesizedTree)parent=parent.getParentPath();
     // Primitive boxing and generic inference are not certified by this pass.
     if(target.toString().equals("java.lang.Object")&&(operand.getKind()==TypeKind.ARRAY||operand.getKind()==TypeKind.DECLARED||operand.getKind()==TypeKind.NULL)&&parent!=null&&parent.getLeaf() instanceof TypeCastTree){
      TypeCastTree outer=(TypeCastTree)parent.getLeaf();TypeMirror result=trees.getTypeMirror(new TreePath(parent,outer.getType()));
      if(result.getKind()==TypeKind.ARRAY||result.getKind()==TypeKind.DECLARED)System.out.println("C\\t"+file+"\\t"+positions.getStartPosition(unit,n)+"\\t"+positions.getStartPosition(unit,n.getExpression())+"\\t"+positions.getStartPosition(unit,n.getType())+"\\t"+positions.getEndPosition(unit,n.getType())+"\\t"+operand+"\\t"+result);
     }return super.visitTypeCast(n,unused);
    }
   }.scan(unit,null);}
  }
 }
}`);
  const helpers = path.join(temporary, 'helpers'), list = path.join(temporary, 'sources.txt'), stubs = path.join(funorbRepository, 'readable/funorb-stubs.jar');
  fs.mkdirSync(helpers); fs.writeFileSync(list, entries.map(e => e.path).join('\n') + '\n');
  run('javac', ['-d', helpers, helper, path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const casts = rows(run('java', ['-cp', helpers, 'ReferenceBridgeFacts', before, stubs]));
  const maps = new Map(), removed = [], changedFiles = [];
  for (const e of entries) {
    const original = fs.readFileSync(path.join(before, e.path), 'utf8'), candidate = fs.readFileSync(path.join(after, e.path), 'utf8'), origins = [];
    let i = 0, j = 0; const changes = [];
    while (i < original.length) {
      const bridgeDisappears = original.startsWith('(Object) ', i) && !candidate.startsWith('(Object) ', j);
      if (!bridgeDisappears && original[i] === candidate[j]) { origins.push(i++); j++; continue; }
      assert.ok(original.startsWith('(Object) ', i), e.path + ':' + i + ' only an Object bridge may disappear');
      const fact = casts.find(r => r[1] === e.path && +r[2] === i && +r[3] === i + '(Object) '.length);
      assert.ok(fact, e.path + ':' + i + ' independently attributed reference bridge');
      const change = {file: e.path, start: i, end: i + '(Object) '.length, typeStart: +fact[4], typeEnd: +fact[5], operandType: fact[6], targetType: fact[7]};changes.push(change);removed.push(change);i = change.end;
    }
    assert.equal(j, candidate.length, e.path + ' no added characters or other replacements');maps.set(e.path, origins);
    if (changes.length) changedFiles.push({file: e.path, bridgesRemoved: changes.length});
  }
  assert.ok(removed.length, 'selected compiler must improve the current sources');
  const audit = directory => {
    fs.writeFileSync(list, sourceInventory(directory).map(e => e.path).join('\n') + '\n');
    const report = path.join(temporary, 'bindings.tsv'), classes = fs.mkdtempSync(path.join(temporary, 'classes-'));
    run('java', ['-cp', helpers, 'ReadableJava', directory, list, report, classes, stubs, '--class-name-literals', '--labels']);
    return {bindings: rows(fs.readFileSync(report, 'utf8')), classes};
  };
  const old = audit(before), newer = audit(after), positional = new Set(['D', 'R', 'T', 'B', 'N', 'S', 'U']);
  const discarded = r => removed.some(c => c.file === r[1] && +r[2] === c.typeStart && +r[3] === c.typeEnd);
  const projected = newer.bindings.filter(r => positional.has(r[0])).map(r => {
    const map = maps.get(r[1]); assert.ok(Number.isInteger(map[+r[2]]) && Number.isInteger(map[+r[3] - 1]));
    return [r[0], r[1], String(map[+r[2]]), String(map[+r[3] - 1] + 1), ...r.slice(4)];
  });
  for (const r of old.bindings.filter(discarded)) { assert.equal(r[0], 'R'); assert.equal(r[4], 'C:java.lang.Object'); assert.equal(r[5], 'Object'); }
  assert.equal(old.bindings.filter(discarded).length, removed.length);
  assert.deepEqual(projected, old.bindings.filter(r => positional.has(r[0]) && !discarded(r)), 'all retained bindings and label targets have exact identities and character provenance');
  assert.deepEqual(newer.bindings.filter(r => r[0] === 'O'), old.bindings.filter(r => r[0] === 'O'));
  function classes(directory, prefix = '') {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap(e => e.isDirectory() ? classes(path.join(directory, e.name), prefix + e.name + '/') : e.name.endsWith('.class') ? [prefix + e.name] : []).sort();
  }
  const classFiles = classes(old.classes); assert.deepEqual(classes(newer.classes), classFiles);
  const compiledClassesByteExact = classFiles.every(f => fs.readFileSync(path.join(old.classes, f)).equals(fs.readFileSync(path.join(newer.classes, f))));
  assert.ok(compiledClassesByteExact, 'all independently recompiled class files, including stack maps and debug/exception metadata, stay byte exact');
  const names = classFiles.map(f => f.slice(0, -6).replaceAll('/', '.'));
  const instructions = directory => run('javap', ['-classpath', directory + path.delimiter + stubs, '-c', '-p', '-s', '-constants', ...names]).split('\n').map(line => {
    if (!/^\s*\d+:\s+\w+/.test(line)) return line;
    const comment = line.indexOf('//'); if (comment < 0) return line;
    // Normalize only resolved constant-pool operand indexes, never strings,
    // branch PCs, switch destinations or exception-table protected ranges.
    return line.slice(0, comment).replace(/#\d+/g, '#constant') + line.slice(comment);
  }).join('\n');
  const originalCode = instructions(old.classes), candidateCode = instructions(newer.classes);
  assert.equal(candidateCode, originalCode, 'every independent recompiled JVM instruction, symbolic operand, branch offset, method/field descriptor, constant and exception table stays exact');
  const readableBefore = preview ? path.join(funorbRepository, 'readable/geoblox')
    : path.join(archive(funorbRepository, proof.previousReadableCommit, 'readable-before', 'readable/geoblox').directory, 'readable/geoblox');
  const dictionary = JSON.parse(fs.readFileSync(path.join(readableBefore, 'mapping.json')));
  assert.equal(dictionary.inputTreeSha256, sourceIdentity(entries));
  const readableExpected = path.join(temporary, 'readable-expected'); fs.mkdirSync(readableExpected);
  for (const file of dictionary.files) {
    let text = fs.readFileSync(path.join(readableBefore, 'src', file.renamed), 'utf8');
    const translate = position => {
      assert.ok(!file.edits.some(e => e.start < position && e.end > position));
      return position + file.edits.filter(e => e.end <= position).reduce((sum, e) => sum + e.renamed.length - e.original.length, 0);
    };
    for (const change of removed.filter(c => c.file === file.original).sort((a, b) => b.start - a.start)) {
      const start = translate(change.start), end = translate(change.end);
      assert.equal(text.slice(start, end), '(Object) ');
      text = text.slice(0, start) + text.slice(end);
    }
    fs.writeFileSync(path.join(readableExpected, file.renamed), text);
  }
  const priorReadable = audit(path.join(readableBefore, 'src')), expectedReadable = audit(readableExpected);
  const readableClassFiles = classes(priorReadable.classes); assert.deepEqual(classes(expectedReadable.classes), readableClassFiles);
  assert.equal(readableClassFiles.length, classFiles.length);
  assert.ok(readableClassFiles.every(f => fs.readFileSync(path.join(priorReadable.classes, f)).equals(fs.readFileSync(path.join(expectedReadable.classes, f)))), 'independent previous/readable expected class files stay byte exact');
  const previousReadableTreeSha256 = sourceIdentity(sourceInventory(path.join(readableBefore, 'src'))), readableSourceTreeSha256 = sourceIdentity(sourceInventory(readableExpected));
  if (proof) { assert.equal(previousReadableTreeSha256, proof.previousReadableTreeSha256); assert.equal(readableSourceTreeSha256, proof.readableSourceTreeSha256); }
  const result = {sourceFiles: 303, changedJavaFiles: changedFiles.length, bridgesRemoved: removed.length, bindingsBefore: old.bindings.filter(r => ['D', 'R'].includes(r[0])).length, bindingsCompared: newer.bindings.filter(r => ['D', 'R'].includes(r[0])).length, removedClassTypeBindings: removed.length, compiledClassFiles: classFiles.length, compiledClassesByteExact, readableCompiledClassesByteExact: true, readableCompiledClassFiles: readableClassFiles.length, previousReadableTreeSha256, readableSourceTreeSha256, independentlyComparedMethods: (originalCode.match(/^\s*descriptor: \(/gm) || []).length, recompiledInstructionsAndExceptionTablesSha256: hash(originalCode), sourceTreeSha256: sourceIdentity(next), changedFiles, selections: removed};
  if (proof) { assert.equal(result.bridgesRemoved, proof.bridgesRemoved); assert.equal(result.recompiledInstructionsAndExceptionTablesSha256, proof.recompiledInstructionsAndExceptionTablesSha256); assert.deepEqual(result.selections, proof.selections); }
  console.log(JSON.stringify(result));
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
