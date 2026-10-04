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

// Recheck the latest guarded-abrupt structural pass from immutable Git inputs.
// The suffix/shared-exit/guarded-loop extensions share this fixture; earlier source/hash
// remains available in its pinned workflow commit. No extra preview is needed.
const repository = funorbRepository;
const javaTools = process.argv[2] && path.resolve(process.argv[2]);
if (!javaTools) throw new Error('Usage: node readable/tests/test-geoblox-guarded-abrupt-source.mjs JAVA_TOOLS_REPOSITORY');
const provenance = JSON.parse(fs.readFileSync(path.join(repository, 'decompilation/geoblox-provenance.json')));
const proof = provenance.guardedLoopContinuationRecovery ?? provenance.guardedAbruptSharedExitRecovery ?? provenance.guardedAbruptSuffixRecovery ?? provenance.guardedAbruptExitRecovery;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-guarded-abrupt-proof-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd = repository) => captureProcess(command, command === 'git' ? ['-C', cwd, ...args] : args).stdout;

try {
  assert.equal(proof.sourceProofTest, 'readable/tests/test-geoblox-guarded-abrupt-source.mjs');
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
            if(tree.getBody()!=null)System.out.println(file+"\\t"+positions.getStartPosition(unit,tree.getBody())+"\\t"+positions.getEndPosition(unit,tree.getBody())+"\\t"+tree.getParameters().stream().map(p->p.getName().toString()).collect(Collectors.joining(",")));
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
    return {file, start: Number(start), end: Number(end), parameterNames: (parameters || '').split(',').filter(Boolean)};
  });
  const require = createRequire(import.meta.url);
  const {recoverPostGuardExits, foldGuardedAbruptPlainBlockExits, foldGuardedLoopContinuations} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava} = require(path.join(tools.directory, 'src/java-frontend/lexer.js'));
  const tokens = source => tokenizeJava(source).tokens.filter(t => !['whitespace', 'eof'].includes(t.kind)).map(t => t.text);
  const counts = {}, sharedSelections = [];
  let methods = 0, files = 0, linesBefore = 0, linesAfter = 0, labelsBefore = 0, labelsAfter = 0;
  for (const entry of beforeFiles) {
    const original = fs.readFileSync(path.join(before, entry.path), 'utf8');
    const actual = fs.readFileSync(path.join(after, entry.path), 'utf8');
    const edits = [];
    for (const span of spans.filter(s => s.file === entry.path)) {
      const body = original.slice(span.start + 1, span.end - 1);
      const recover = source => {
        if (!proof.guardedLoopContinuations) return recoverPostGuardExits(source, {parameterNames: span.parameterNames});
        let loops = 0;
        for (;;) {
          const result = foldGuardedLoopContinuations(source, {parameterNames: span.parameterNames});
          if (!result.loopsRecovered) break;
          assert.notEqual(result.source, source, 'each guarded loop removes its entry if');
          source = result.source; loops += result.loopsRecovered;
        }
        return {source, rewrites: loops, counts: {guardedLoopContinuations: loops}};
      };
      const result = recover(body);
      if (!result.rewrites) continue;
      assert.equal(recover(result.source).source, result.source, 'fixed point');
      if (proof.sharedGuardedJumpSelections) {
        let selected = body, jumps = 0;
        for (;;) {
          const folded = foldGuardedAbruptPlainBlockExits(selected, {retainDiagnostics: true});
          if (!folded.jumpsRemoved) break;
          assert.notEqual(folded.source, selected, 'each guarded jump recovery progresses');
          if (folded.diagnostics.labelRetained) sharedSelections.push({...span, label: folded.diagnostics.label});
          selected = folded.source; jumps += folded.jumpsRemoved;
        }
        assert.equal(jumps, result.counts.guardedAbruptJumps, 'independent guarded jump selection replay');
      }
      for (const [name, value] of Object.entries(result.counts)) counts[name] = (counts[name] || 0) + value;
      edits.push({...span, source: result.source}); methods++;
    }
    edits.sort((a, b) => a.start - b.start);
    assert.ok(edits.every((e, i) => !i || edits[i - 1].end <= e.start), 'nonoverlapping executable edits');
    let expected = original;
    for (const edit of edits.reverse()) expected = expected.slice(0, edit.start + 1) + edit.source + expected.slice(edit.end - 1);
    assert.deepEqual(tokens(actual), tokens(expected), entry.path + ' complete expected token stream');
    if (!edits.length) assert.equal(actual, original, entry.path + ' unchanged bytes');
    else files++;
    linesBefore += original.split('\n').length - 1; linesAfter += actual.split('\n').length - 1;
    labelsBefore += (original.match(/^\s+L\d+:\s*\{/gm) || []).length;
    labelsAfter += (actual.match(/^\s+L\d+:\s*\{/gm) || []).length;
  }
  assert.equal(methods, proof.changedMethodBodies); assert.equal(files, proof.changedJavaFiles);
  assert.equal(linesBefore, proof.sourceLinesBefore); assert.equal(linesAfter, proof.sourceLinesAfter);
  assert.equal(labelsBefore, proof.plainBlockLabelsBefore); assert.equal(labelsAfter, proof.plainBlockLabelsAfter);
  assert.deepEqual(counts, proof.counts);

  const list = path.join(temporary, 'files.txt');
  fs.writeFileSync(list, beforeFiles.map(f => f.path).join('\n') + '\n');
  const stubs = path.join(repository, 'readable/funorb-stubs.jar');
  assert.equal(hash(fs.readFileSync(stubs)), provenance.stubJar.sha256);
  function audit(root, name) {
    const report = path.join(temporary, name + '.tsv');
    run('java', ['-cp', helpers, 'ReadableJava', root, list, report, path.join(temporary, name + '-classes'), stubs, '--labels']);
    return fs.readFileSync(report, 'utf8').trim().split('\n').map(line => line.split('\t'));
  }
  const oldAudit = audit(before, 'old'), newAudit = audit(after, 'new');
  for (const [kind, count] of [['D', proof.sourceDeclarationsBefore], ['R', proof.sourceReferenceOccurrencesBefore]]) {
    const identities = rows => rows.filter(r => r[0] === kind).map(r => [r[1], r[4], r[5]]);
    assert.equal(identities(oldAudit).length, count);
    assert.deepEqual(identities(newAudit), identities(oldAudit), 'all ordered ' + kind + ' bindings and local ordinals');
  }
  const declarations = rows => rows.filter(r => r[0] === 'T');
  const oldLabels = declarations(oldAudit), newLabels = declarations(newAudit);
  assert.equal(oldLabels.length, proof.labelDeclarationsBefore);
  assert.equal(newLabels.length, proof.labelDeclarationsAfter);
  const labelIdentity = row => JSON.stringify([row[1], row[4].slice(0, row[4].lastIndexOf('#')), row[5]]);
  const labelTargets = new Map(newLabels.map(row => [labelIdentity(row), row[4]]));
  assert.equal(labelTargets.size, newLabels.length, 'unique original label spelling in each enclosing method');
  const mapping = new Map(oldLabels.map(row => [row[4], labelTargets.get(labelIdentity(row))]));
  let migrations = 0;
  for (const [before, after] of mapping) if (after && before !== after) migrations++;
  assert.equal(migrations, proof.survivingLabelOrdinalMigrations);
  const records = rows => rows.filter(r => ['T', 'B', 'N'].includes(r[0]));
  const selectedTargets = sharedSelections.map(span => {
    const declarations = oldLabels.filter(row => row[1] === span.file && row[5] === span.label
      && Number(row[2]) >= span.start && Number(row[3]) <= span.end);
    assert.equal(declarations.length, 1, 'unique original selected label in the executable scope');
    return {file: span.file, symbol: declarations[0][4], originalName: span.label};
  });
  if (proof.sharedGuardedJumpSelections) assert.deepEqual(selectedTargets, proof.sharedGuardedJumpSelections, 'all independently selected shared frame exits');
  const pending = new Set(selectedTargets.filter(target => mapping.get(target.symbol)).map(target => target.symbol));
  assert.equal(pending.size, selectedTargets.filter(target => mapping.get(target.symbol)).length, 'at most one selected guarded jump per surviving frame');
  const expectedLabels = records(oldAudit).filter(row => mapping.get(row[4])).filter(row => {
    if (row[0] !== 'B' || !pending.has(row[4])) return true;
    // The destination proof permits all other references only in the complete
    // fallback. Its selected direct guard is therefore the first old break to
    // this label. Prune only that reference, never another fallback transfer.
    pending.delete(row[4]); return false;
  })
    .map(row => [row[0], row[1], mapping.get(row[4]), row[5]]);
  assert.equal(pending.size, 0, 'every selected surviving-frame break accounted for');
  const actualLabels = records(newAudit).map(row => [row[0], row[1], row[4], row[5]]);
  assert.equal(records(oldAudit).length, proof.labelBindingsBefore);
  assert.equal(actualLabels.length, proof.labelBindingsAfter);
  assert.deepEqual(actualLabels, expectedLabels, 'all ordered surviving label declarations, destinations and transfer kinds');
  if (proof.largeLabeledBodiesAfter) {
    const inventory = [];
    for (const line of run('java', ['-cp', helpers, 'GeobloxBodyPositions', after]).toString().trim().split('\n')) {
      const [file, start, end] = line.split('\t');
      const source = fs.readFileSync(path.join(after, file), 'utf8');
      const body = source.slice(Number(start), Number(end));
      const lines = body.split('\n').length;
      const labels = newLabels.filter(row => row[1] === file && Number(row[2]) >= Number(start) && Number(row[3]) <= Number(end));
      if (lines < proof.largeLabeledBodiesAfter.minimumBodyLines || !labels.length) continue;
      const enclosingMethod = labels[0][4].slice(2, labels[0][4].lastIndexOf('#'));
      assert.ok(labels.every(row => row[4].slice(2, row[4].lastIndexOf('#')) === enclosingMethod), 'no nested executable inventory ambiguity');
      inventory.push({rawFile: file, enclosingMethod, lines, labels: labels.length});
    }
    assert.equal(inventory.length, proof.largeLabeledBodiesAfter.bodies);
    assert.deepEqual(inventory, proof.largeLabeledBodiesAfter.inventory.map(({rawFile, enclosingMethod, lines, labels}) =>
      ({rawFile, enclosingMethod, lines, labels})).sort((a, b) => a.rawFile < b.rawFile ? -1 : a.rawFile > b.rawFile ? 1 : 0), 'complete large labeled-body inventory');
  }
  const overrides = rows => rows.filter(r => r[0] === 'O');
  assert.equal(overrides(oldAudit).length, proof.fullOverridePairsPreserved);
  assert.deepEqual(overrides(newAudit), overrides(oldAudit), 'complete ordered override pairs');
  assert.equal(fs.readFileSync(path.join(repository, 'decompilation/geoblox-decompiler-diagnostics.json'), 'utf8'),
    run('git', ['show', proof.previousSourceCommit + ':decompilation/geoblox-decompiler-diagnostics.json']).toString(), 'diagnostics unchanged');
  console.log(JSON.stringify({filesChecked: 303, changedFiles: files, changedMethods: methods, labelsBefore, labelsAfter,
    declarations: proof.sourceDeclarationsAfter, references: proof.sourceReferenceOccurrencesAfter, overrides: proof.fullOverridePairsPreserved,
    counts, labelBindings: actualLabels.length, survivingLabelOrdinalMigrations: migrations, sourceArchiveSha256: proof.sourceArchiveSha256, exactExpectedTokenStreams: true, orderedJavaBindingsUnchanged: true}));
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
