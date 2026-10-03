import {funorbRepository, workflowRoot} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

// Recheck the historical structural pass from immutable Git inputs. Later
// naming passes can run this proof without maintaining another source preview.
const repository = funorbRepository;
const javaTools = process.argv[2] && path.resolve(process.argv[2]);
if (!javaTools) throw new Error('Usage: node readable/tests/test-geoblox-array-increments-source.mjs JAVA_TOOLS_REPOSITORY');
const provenance = JSON.parse(fs.readFileSync(path.join(repository, 'decompilation/geoblox-provenance.json')));
const proof = provenance.arrayIndexIncrementRecovery;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-array-increments-proof-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd = repository) => captureProcess(command, command === 'git' ? ['-C', cwd, ...args] : args).stdout;

try {
  assert.equal(proof.sourceProofTest, 'readable/tests/test-geoblox-array-increments-source.mjs');
  assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))), proof.sourceProofTestSha256, 'reviewed source proof');
  const toolPin = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'tools/PIN.json')));
  assert.equal(hash(fs.readFileSync(path.join(workflowRoot, 'tools/lib/ReadableJava.java'))), toolPin.files['lib/ReadableJava.java'], 'frozen binding auditor');
  function archive(repo, commit, name, subdirectory) {
    const tar = path.join(temporary, name + '.tar');
    run('git', ['archive', '--format=tar', '--output=' + tar, commit, ...(subdirectory ? [subdirectory] : [])], repo);
    const directory = path.join(temporary, name);
    fs.mkdirSync(directory);
    run('tar', ['-xf', tar, '-C', directory]);
    return {tar, directory};
  }
  const tools = archive(javaTools, proof.javaToolsCommit, 'tools');
  assert.equal(hash(fs.readFileSync(tools.tar)), proof.sourceArchiveSha256, 'tracked decompiler-source tar');
  const before = path.join(archive(repository, proof.previousSourceCommit, 'before', 'games/geoblox').directory, 'games/geoblox');
  const after = path.join(archive(repository, proof.sourceCommit, 'after', 'games/geoblox').directory, 'games/geoblox');
  const beforeFiles = sourceInventory(before), afterFiles = sourceInventory(after);
  assert.equal(beforeFiles.length, 303); assert.equal(afterFiles.length, 303);
  assert.equal(sourceIdentity(beforeFiles), proof.previousSourceTreeSha256);
  assert.equal(sourceIdentity(afterFiles), proof.sourceTreeSha256);
  assert.deepEqual(beforeFiles.map(f => f.path), afterFiles.map(f => f.path));

  const helper = path.join(temporary, 'GeobloxBodyPositions.java');
  fs.writeFileSync(helper, `import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.*;
public final class GeobloxBodyPositions {
  public static void main(String[] args) throws Exception {
    JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
    try(StandardJavaFileManager manager=compiler.getStandardFileManager(null,null,StandardCharsets.UTF_8);
        Stream<Path> paths=Files.list(Paths.get(args[0]))) {
      List<java.io.File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());
      JavacTask task=(JavacTask)compiler.getTask(null,manager,null,Arrays.asList("-proc:none","-source","8"),null,manager.getJavaFileObjectsFromFiles(files));
      SourcePositions positions=Trees.instance(task).getSourcePositions();
      for(CompilationUnitTree unit:task.parse()) {
        String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();
        String source=unit.getSourceFile().getCharContent(true).toString();
        new TreeScanner<Void,Void>() {
          @Override public Void visitClass(ClassTree tree,Void unused) {
            for(Tree member:tree.getMembers())if(member instanceof BlockTree)
              System.out.println(file+"\\t"+source.indexOf("{",(int)positions.getStartPosition(unit,member))+"\\t"+positions.getEndPosition(unit,member)+"\\t");
            return super.visitClass(tree,unused);
          }
          @Override public Void visitMethod(MethodTree tree,Void unused) {
            if(tree.getBody()!=null)System.out.println(file+"\\t"+positions.getStartPosition(unit,tree.getBody())+"\\t"+positions.getEndPosition(unit,tree.getBody())+"\\t"+tree.getParameters().stream().map(p->p.getName().toString()+":"+p.getType().toString()).collect(Collectors.joining(",")));
            return super.visitMethod(tree,unused);
          }
        }.scan(unit,null);
      }
    }
  }
}
`);
  const helpers = path.join(temporary, 'helpers');
  fs.mkdirSync(helpers);
  run('javac', ['-d', helpers, helper, path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const spans = run('java', ['-cp', helpers, 'GeobloxBodyPositions', before]).toString().trim().split('\n').map(line => {
    const [file, start, end, parameters] = line.split('\t');
    return {file, start: Number(start), end: Number(end), parameters: (parameters || '').split(',').filter(Boolean).map(p => {const [name, type] = p.split(':'); return {name, type};})};
  });
  const require = createRequire(import.meta.url);
  const {recoverArrayIndexIncrements} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava} = require(path.join(tools.directory, 'src/java-frontend/lexer.js'));
  const tokens = source => tokenizeJava(source).tokens.filter(t => !['whitespace', 'eof'].includes(t.kind)).map(t => t.text);
  let captures = 0; let methods = 0, files = 0, linesBefore = 0, linesAfter = 0, labelsBefore = 0, labelsAfter = 0;
  const expectedRoot = path.join(temporary, 'expected');
  fs.mkdirSync(expectedRoot);
  for (const entry of beforeFiles) {
    const original = fs.readFileSync(path.join(before, entry.path), 'utf8');
    const actual = fs.readFileSync(path.join(after, entry.path), 'utf8');
    const edits = [];
    for (const span of spans.filter(s => s.file === entry.path)) {
      const body = original.slice(span.start + 1, span.end - 1);
      const result = recoverArrayIndexIncrements(body, {parameters: span.parameters});
      if (!result.capturesFolded) continue;
      assert.equal(recoverArrayIndexIncrements(result.source, {parameters: span.parameters}).source, result.source, 'fixed point');
      captures += result.capturesFolded;
      edits.push({...span, source: result.source}); methods++;
    }
    edits.sort((a, b) => a.start - b.start);
    assert.ok(edits.every((e, i) => !i || edits[i - 1].end <= e.start), 'nonoverlapping executable edits');
    let expected = original;
    for (const edit of edits.reverse()) expected = expected.slice(0, edit.start + 1) + edit.source + expected.slice(edit.end - 1);
    assert.deepEqual(tokens(actual), tokens(expected), entry.path + ' complete expected token stream');
    fs.writeFileSync(path.join(expectedRoot, entry.path), expected);
    if (!edits.length) assert.equal(actual, original, entry.path + ' unchanged bytes');
    else files++;
    linesBefore += original.split('\n').length - 1; linesAfter += actual.split('\n').length - 1;
    labelsBefore += (original.match(/^\s+L\d+:\s*\{/gm) || []).length;
    labelsAfter += (actual.match(/^\s+L\d+:\s*\{/gm) || []).length;
  }
  assert.equal(methods, proof.changedMethodBodies); assert.equal(files, proof.changedJavaFiles);
  assert.equal(linesBefore, proof.sourceLinesBefore); assert.equal(linesAfter, proof.sourceLinesAfter);
  assert.equal(labelsAfter, labelsBefore, 'existing plain block labels stay unchanged');
  assert.equal(captures, proof.capturesFolded);

  const list = path.join(temporary, 'files.txt');
  fs.writeFileSync(list, beforeFiles.map(f => f.path).join('\n') + '\n');
  const stubs = path.join(repository, 'readable/funorb-stubs.jar');
  assert.equal(hash(fs.readFileSync(stubs)), provenance.stubJar.sha256);
  function audit(root, name) {
    const report = path.join(temporary, name + '.tsv');
    run('java', ['-cp', helpers, 'ReadableJava', root, list, report, path.join(temporary, name + '-classes'), stubs]);
    return fs.readFileSync(report, 'utf8').trim().split('\n').map(line => line.split('\t'));
  }
  const oldAudit = audit(before, 'old'), newAudit = audit(after, 'new'), expectedAudit = audit(expectedRoot, 'expected');
  const identities = (rows, kind) => rows.filter(r => r[0] === kind).map(r => [r[1], r[4], r[5]]);
  for (const [kind, beforeCount, afterCount] of [
    ['D', proof.sourceDeclarationsBefore, proof.sourceDeclarationsAfter],
    ['R', proof.sourceReferenceOccurrencesBefore, proof.sourceReferenceOccurrencesAfter]]) {
    assert.equal(identities(oldAudit, kind).length, beforeCount);
    assert.equal(identities(newAudit, kind).length, afterCount);
    assert.deepEqual(identities(newAudit, kind), identities(expectedAudit, kind), 'complete ordered predicted ' + kind + ' identities');
  }
  // Match declaration identities in source order after removing only captures
  // that the exact expected rewrite deleted. Surviving spellings/owners stay put.
  const oldDeclarations = oldAudit.filter(r => r[0] === 'D'), newDeclarations = newAudit.filter(r => r[0] === 'D');
  const identity = r => [r[1], r[4].split('#')[0], r[5]].join('\t');
  const survivingIdentities = new Set(newDeclarations.map(identity));
  const removed = oldDeclarations.filter(r => r[4].startsWith('L:') && /^incrementValue\$\d+$/.test(r[5]) && !survivingIdentities.has(identity(r)));
  assert.equal(removed.length, captures, 'one deleted declaration per folded capture');
  assert.equal(proof.sourceReferenceOccurrencesBefore - proof.sourceReferenceOccurrencesAfter, captures * 3,
    'each folded capture removes its two reads plus the redundant counter read');
  const removedKeys = new Set(removed.map(r => r[4]));
  const survivors = oldDeclarations.filter(r => !removedKeys.has(r[4]));
  assert.equal(survivors.length, newDeclarations.length);
  let migrated = 0;
  survivors.forEach((r, index) => {
    const next = newDeclarations[index];
    assert.equal(identity(next), identity(r), 'surviving ordered declaration spelling and owner');
    if (r[4] !== next[4]) { assert.ok(r[4].startsWith('L:')); migrated++; }
  });
  assert.equal(migrated, proof.survivingLocalOrdinalMigrations);
  const previousRules = JSON.parse(run('git', ['show', proof.previousRulesCommit + ':readable/geoblox-rules.json']));
  assert.equal(previousRules.renames.filter(r => removedKeys.has(r.symbol)).length, proof.namedCapturesRetired);
  const overrides = rows => rows.filter(r => r[0] === 'O');
  assert.equal(overrides(oldAudit).length, proof.fullOverridePairsPreserved);
  assert.deepEqual(overrides(newAudit), overrides(oldAudit), 'complete ordered override pairs');
  assert.deepEqual(overrides(newAudit), overrides(expectedAudit));
  assert.equal(fs.readFileSync(path.join(repository, 'decompilation/geoblox-decompiler-diagnostics.json'), 'utf8'),
    run('git', ['show', proof.previousSourceCommit + ':decompilation/geoblox-decompiler-diagnostics.json']).toString(), 'diagnostics unchanged');
  console.log(JSON.stringify({filesChecked: 303, changedFiles: files, changedMethods: methods, labelsBefore, labelsAfter,
    declarations: proof.sourceDeclarationsAfter, references: proof.sourceReferenceOccurrencesAfter, overrides: proof.fullOverridePairsPreserved,
    sourceArchiveSha256: proof.sourceArchiveSha256, exactExpectedTokenStreams: true, orderedPredictedBindingsChecked: true, capturesFolded: captures, localOrdinalMigrations: migrated}));
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
