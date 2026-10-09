import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {funorbRepository, workflowRoot} from '../layout.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

// Certify only the selected dynamic-tail rewrite, not equivalence of the whole
// game to its bytecode. Independent javac trees recognize both control forms;
// provenance verifies every retained binding and protected transfer, and both
// removed/retained tails must resolve to identical original symbols and targets.
const preview = process.argv.includes('--preview');
const javaTools = path.resolve(process.argv.slice(2).find(arg => arg !== '--preview') || '../java-tools');
const root = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.dynamicGuardedTailSharing;
assert.ok(preview || proof);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-dynamic-tails-proof-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (cmd, args) => {
  try { return captureProcess(cmd, args, {maxBuffer: 128 * 1024 * 1024}).stdout.toString(); }
  catch (error) { throw new Error(error.stderr?.toString() || error.message); }
};
const rows = text => text.trim().split('\n').filter(Boolean).map(line => line.split('\t'));
const ordered = values => values.map(value => JSON.stringify(value)).sort();
try {
  function archive(repo, commit, name, subpath) {
    const tar = path.join(temporary, name + '.tar'), directory = path.join(temporary, name);
    run('git', ['-C', repo, 'archive', '--format=tar', '--output=' + tar, commit, ...(subpath ? [subpath] : [])]);
    fs.mkdirSync(directory); run('tar', ['-xf', tar, '-C', directory]);
    return {directory, sha256: hash(fs.readFileSync(tar))};
  }
  const namingPin = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'tools/PIN.json')));
  assert.equal(hash(fs.readFileSync(path.join(workflowRoot, 'tools/lib/ReadableJava.java'))), namingPin.files['lib/ReadableJava.java'], 'frozen independent binding auditor');
  const tools = preview ? {directory: javaTools} : archive(javaTools, proof.javaToolsCommit, 'tools');
  if (proof) {
    assert.equal(tools.sha256, proof.sourceArchiveSha256);
    assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))), proof.sourceProofTestSha256);
  }
  const before = preview ? path.join(funorbRepository, 'games/geoblox')
    : path.join(archive(funorbRepository, proof.previousSourceCommit, 'before', 'games/geoblox').directory, 'games/geoblox');
  const entries = sourceInventory(before); assert.equal(entries.length, 303);
  if (proof) assert.equal(sourceIdentity(entries), proof.previousSourceTreeSha256);
  const require = createRequire(import.meta.url);
  const {shareDynamicGuardedTails} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const bodyFixture = path.join(workflowRoot, 'tests/test-geoblox-guarded-abrupt-source.mjs');
  if (proof) assert.equal(hash(fs.readFileSync(bodyFixture)), proof.bodyPositionFixtureSha256);
  const template = fs.readFileSync(bodyFixture, 'utf8').match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/);
  assert.ok(template);
  fs.writeFileSync(path.join(temporary, 'GeobloxBodyPositions.java'), new Function('return ' + template[1].slice(0, -2))());
  fs.writeFileSync(path.join(temporary, 'DynamicTailTrees.java'), `
import java.io.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;import java.util.stream.*;
import javax.tools.*;import javax.lang.model.element.*;import javax.lang.model.type.*;
import com.sun.source.tree.*;import com.sun.source.util.*;
public class DynamicTailTrees {
 static Tree peel(Tree n){while(n instanceof ParenthesizedTree)n=((ParenthesizedTree)n).getExpression();return n;}
 static void check(boolean yes){if(!yes)throw new AssertionError("invalid dynamic-tail certificate");}
 static String fingerprint(CompilationUnitTree unit,Trees trees,Map<Long,String> selections,boolean after){
  StringBuilder out=new StringBuilder();Set<Long> found=new HashSet<>();SourcePositions positions=trees.getSourcePositions();
  new TreeScanner<Void,Void>(){
   void atom(Object value){String s=String.valueOf(value);out.append(s.length()).append(':').append(s);}
   void decision(Tree n){TypeMirror t=trees.getTypeMirror(TreePath.getPath(unit,n));check(t.getKind()==TypeKind.BOOLEAN||t.toString().equals("java.lang.Boolean"));}
   Element element(Tree n){Element e=trees.getElement(TreePath.getPath(unit,peel(n)));check(e!=null);return e;}
   Tree negated(Tree n){n=peel(n);check(n instanceof UnaryTree&&n.getKind()==Tree.Kind.LOGICAL_COMPLEMENT);return ((UnaryTree)n).getExpression();}
   void canonical(Tree condition,List<? extends StatementTree> prefix,Tree guard,List<? extends StatementTree> tail){
    decision(condition);decision(guard);out.append("(dynamic-tail:");scan(condition,null);out.append("prefix:");scan(prefix,null);out.append("guard:");scan(guard,null);out.append("tail:");scan(tail,null);out.append(')');
   }
   @Override public Void visitBlock(BlockTree block,Void unused){
    atom(block.isStatic());List<? extends StatementTree> statements=block.getStatements();
    for(int i=0;i<statements.size();i++){
     StatementTree first=statements.get(i);long start=positions.getStartPosition(unit,first);String name=selections.get(start);
     if(name==null){scan(first,null);continue;}check(found.add(start));
     if(!after){
      check(first instanceof IfTree);IfTree branch=(IfTree)first;
      check(branch.getThenStatement() instanceof BlockTree&&branch.getElseStatement() instanceof BlockTree);
      List<? extends StatementTree> main=((BlockTree)branch.getThenStatement()).getStatements();check(main.size()>=2&&main.get(main.size()-1) instanceof IfTree);
      IfTree guard=(IfTree)main.get(main.size()-1);check(guard.getElseStatement()==null&&guard.getThenStatement() instanceof BlockTree);
      List<? extends StatementTree> yes=((BlockTree)guard.getThenStatement()).getStatements(),no=((BlockTree)branch.getElseStatement()).getStatements();
      // Binding/transfer equality of these two copies is independently checked
      // by the JS certificate, not inferred from this syntax fingerprint.
      String a=plain(yes),b=plain(no);check(a.equals(b));
      canonical(branch.getCondition(),main.subList(0,main.size()-1),guard.getCondition(),no);
     }else{
      check(first instanceof VariableTree&&i+2<statements.size());VariableTree flag=(VariableTree)first;
      Element local=element(flag);check(local.getKind()==ElementKind.LOCAL_VARIABLE&&local.asType().getKind()==TypeKind.BOOLEAN&&flag.getName().contentEquals(name)&&flag.getModifiers().getFlags().isEmpty());
      Tree condition=negated(flag.getInitializer());
      check(statements.get(i+1) instanceof IfTree&&statements.get(i+2) instanceof IfTree);
      IfTree main=(IfTree)statements.get(i+1),tail=(IfTree)statements.get(i+2);
      check(element(negated(main.getCondition())).equals(local)&&element(tail.getCondition()).equals(local));
      check(main.getElseStatement()==null&&tail.getElseStatement()==null&&main.getThenStatement() instanceof BlockTree&&tail.getThenStatement() instanceof BlockTree);
      List<? extends StatementTree> prefix=((BlockTree)main.getThenStatement()).getStatements();check(prefix.size()>=2);
      StatementTree last=prefix.get(prefix.size()-1);check(last instanceof ExpressionStatementTree&&((ExpressionStatementTree)last).getExpression() instanceof AssignmentTree);
      AssignmentTree store=(AssignmentTree)((ExpressionStatementTree)last).getExpression();check(element(store.getVariable()).equals(local));
      canonical(condition,prefix.subList(0,prefix.size()-1),store.getExpression(),((BlockTree)tail.getThenStatement()).getStatements());i+=2;
     }
    }return null;
   }
   String plain(List<? extends StatementTree> ss){StringBuilder save=new StringBuilder(out);out.setLength(0);scan(ss,null);String result=out.toString();out.setLength(0);out.append(save);return result;}
   @Override public Void scan(Tree n,Void unused){
    if(n==null){out.append("nil;");return null;}if(n instanceof ParenthesizedTree)return scan(((ParenthesizedTree)n).getExpression(),null);
    out.append('(');atom(n.getKind());
    if(n instanceof IdentifierTree)atom(((IdentifierTree)n).getName());else if(n instanceof MemberSelectTree)atom(((MemberSelectTree)n).getIdentifier());else if(n instanceof LiteralTree)atom(((LiteralTree)n).getValue());else if(n instanceof VariableTree)atom(((VariableTree)n).getName());else if(n instanceof MethodTree)atom(((MethodTree)n).getName());else if(n instanceof ClassTree)atom(((ClassTree)n).getSimpleName());else if(n instanceof LabeledStatementTree)atom(((LabeledStatementTree)n).getLabel());else if(n instanceof BreakTree)atom(((BreakTree)n).getLabel());else if(n instanceof ContinueTree)atom(((ContinueTree)n).getLabel());else if(n instanceof PrimitiveTypeTree)atom(((PrimitiveTypeTree)n).getPrimitiveTypeKind());else if(n instanceof ModifiersTree)atom(((ModifiersTree)n).getFlags().stream().map(Object::toString).sorted().collect(Collectors.joining(",")));else if(n instanceof MemberReferenceTree){atom(((MemberReferenceTree)n).getMode());atom(((MemberReferenceTree)n).getName());}
    super.scan(n,null);out.append(')');return null;
   }
  }.scan(unit,null);check(found.equals(selections.keySet()));
  try{byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(out.toString().getBytes(StandardCharsets.UTF_8));StringBuilder hex=new StringBuilder();for(byte b:bytes)hex.append(String.format("%02x",b&255));return hex.toString();}catch(Exception e){throw new AssertionError(e);}
 }
 public static void main(String[]args)throws Exception{
  Map<String,Map<Long,String>> markers=new HashMap<>();for(String line:Files.readAllLines(Paths.get(args[2]))){String[] r=line.split("\\t");markers.computeIfAbsent(r[0],k->new HashMap<>()).put(Long.valueOf(r[args[3].equals("after")?2:1]),r[3]);}
  JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();
  try(StandardJavaFileManager fm=compiler.getStandardFileManager(errors,null,StandardCharsets.UTF_8);Stream<Path> paths=Files.list(Paths.get(args[0]))){
   List<File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());
   JavacTask task=(JavacTask)compiler.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-sourcepath","","-classpath",args[1]),null,fm.getJavaFileObjectsFromFiles(files));List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);task.analyze();for(Diagnostic<?> d:errors.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d);
   Trees trees=Trees.instance(task);for(CompilationUnitTree unit:units){String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();System.out.println(file+"\\t"+fingerprint(unit,trees,markers.getOrDefault(file,Collections.emptyMap()),args[3].equals("after")));}
  }
 }
}
`);
  const helpers = path.join(temporary, 'helpers'), expected = path.join(temporary, 'expected');
  const stubs = path.join(funorbRepository, 'readable/funorb-stubs.jar'); fs.mkdirSync(helpers); fs.mkdirSync(expected);
  run('javac', ['-d', helpers, path.join(temporary, 'GeobloxBodyPositions.java'), path.join(temporary, 'DynamicTailTrees.java'), path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const facts = directory => rows(run('java', ['-cp', helpers, 'GeobloxBodyPositions', directory, stubs, 'fields']));
  const initial = facts(before), spans = initial.filter(r => r[0].endsWith('.java') && (!r[7] || r[7] === r[0].slice(0, -5)));
  const changes = [], maps = new Map(); let duplicateTokensRemoved = 0;
  for (const entry of entries) {
    let text = fs.readFileSync(path.join(before, entry.path), 'utf8'), mapped = Array.from({length: text.length}, (_, i) => i);
    for (const span of spans.filter(r => r[0] === entry.path).sort((a, b) => +b[1] - +a[1])) {
      const base = +span[1] + 1, end = +span[2] - 1, body = text.slice(base, end);
      const result = shareDynamicGuardedTails(body, {reservedNames: span[3].split(',').filter(Boolean), retainDiagnostics: true});
      if (!result.tailsShared) continue;
      const d = result.diagnostics;
      // A second rewrite in the same method requires a new certificate scheme.
      assert.equal(shareDynamicGuardedTails(result.source, {reservedNames: span[3].split(',').filter(Boolean)}).tailsShared, 0);
      const replacement = d.segments.map(s => s.text ?? body.slice(s.range.start, s.range.end)).join('');
      assert.equal(result.source, body.slice(0, d.range.start) + replacement + body.slice(d.range.end));
      const localOrigins = d.segments.flatMap(s => s.text === undefined ? mapped.slice(base + s.range.start, base + s.range.end) : Array(s.text.length).fill(null));
      const absolute = r => ({start: base + r.start, end: base + r.end});
      changes.push({file: entry.path, methodStart: +span[6], name: d.name, region: absolute(d.range), condition: absolute(d.conditionRange), guard: absolute(d.guardConditionRange), removedTail: absolute(d.removedTailRange), retainedTail: absolute(d.retainedTailRange), duplicateTokensRemoved: result.duplicateTokensRemoved});
      duplicateTokensRemoved += result.duplicateTokensRemoved;
      mapped = [...mapped.slice(0, base + d.range.start), ...localOrigins, ...mapped.slice(base + d.range.end)];
      text = text.slice(0, base) + result.source + text.slice(end);
    }
    fs.writeFileSync(path.join(expected, entry.path), text); maps.set(entry.path, mapped);
  }
  assert.equal(changes.length, 8);
  const list = path.join(temporary, 'sources.txt'); fs.writeFileSync(list, entries.map(e => e.path).join('\n') + '\n');
  const audit = directory => { const report = path.join(temporary, 'bindings.tsv'), classes = fs.mkdtempSync(path.join(temporary, 'classes-')); run('java', ['-cp', helpers, 'ReadableJava', directory, list, report, classes, stubs, '--class-name-literals', '--labels']); return rows(fs.readFileSync(report, 'utf8')); };
  const old = audit(before), after = audit(expected), positional = new Set(['D', 'R', 'T', 'B', 'N', 'S', 'U']);
  const originalPosition = (file, position) => { const value = maps.get(file)[position]; assert.ok(Number.isInteger(value), file + ':' + position + ' original character'); return value; };
  const mappedRow = r => [r[0], r[1], String(originalPosition(r[1], +r[2])), String(originalPosition(r[1], +r[3] - 1) + 1), ...r.slice(4)];
  const declarationMap = new Map(old.filter(r => ['D', 'T'].includes(r[0])).map(r => [[r[1], r[2], r[3]].join(':'), r]));
  const nextToOld = new Map(), oldToNext = new Map(), newFlags = [];
  for (const row of after.filter(r => ['D', 'T'].includes(r[0]))) {
    if (maps.get(row[1])[+row[2]] === null) { assert.equal(row[0], 'D'); assert.match(row[4], /^L:/); assert.match(row[5], /^decompiledSharedTail\d+$/); newFlags.push(row); continue; }
    const projected = mappedRow(row), previous = declarationMap.get([row[1], projected[2], projected[3]].join(':'));
    assert.ok(previous, 'original declaration'); assert.equal(row[0], previous[0]); assert.equal(row[5], previous[5]);
    assert.ok(!nextToOld.has(row[4]) && !oldToNext.has(previous[4])); nextToOld.set(row[4], previous[4]); oldToNext.set(previous[4], row[4]);
  }
  assert.equal(nextToOld.size, declarationMap.size); assert.equal(newFlags.length, changes.length);
  for (const c of changes) {
    const owner = old.find(r => r[0] === 'D' && r[1] === c.file && r[4].startsWith('M:') && +r[2] >= c.methodStart && +r[2] < c.methodStart + 300);
    assert.ok(owner); c.method = owner[4];
    const flags = newFlags.filter(r => r[1] === c.file && r[4].startsWith('L:' + c.method.slice(2) + '#'));
    assert.equal(flags.length, 1); c.symbol = flags[0][4]; c.afterStart = +flags[0][2] - 'boolean '.length;
  }
  const flagSymbols = new Set(newFlags.map(r => r[4]));
  const isRemoved = r => changes.some(c => c.file === r[1] && +r[2] >= c.removedTail.start && +r[3] <= c.removedTail.end);
  const retained = [], added = [];
  for (const r of after.filter(r => positional.has(r[0]))) {
    if (maps.get(r[1])[+r[2]] === null) { assert.ok(['D', 'R'].includes(r[0]) && flagSymbols.has(r[4])); added.push(r); continue; }
    const projected = mappedRow(r); projected[4] = nextToOld.get(r[4]) || r[4]; retained.push(projected);
  }
  assert.deepEqual(ordered(retained), ordered(old.filter(r => positional.has(r[0]) && !isRemoved(r))), 'every original retained declaration/read/label binding');
  assert.deepEqual(after.filter(r => r[0] === 'O'), old.filter(r => r[0] === 'O'));
  for (const c of changes) {
    const within = range => old.filter(r => positional.has(r[0]) && r[1] === c.file && +r[2] >= range.start && +r[3] <= range.end).map(r => [r[0], ...r.slice(4)]);
    assert.deepEqual(within(c.removedTail), within(c.retainedTail), 'both copies resolve to identical original bindings');
    assert.equal(added.filter(r => r[4] === c.symbol && r[0] === 'D').length, 1);
    assert.equal(added.filter(r => r[4] === c.symbol && r[0] === 'R').length, 3);
  }
  const transfers = initial.filter(r => r[0] === 'Q'), nextTransfers = facts(expected).filter(r => r[0] === 'Q').map(r => {
    const scopes = (r[9] || '').split(',').filter(Boolean).map(s => { const [kind, role, start] = s.split(':'); return [kind, role, originalPosition(r[1], +start)].join(':'); }).join(',');
    return ['Q', r[1], String(originalPosition(r[1], +r[2])), String(originalPosition(r[1], +r[3] - 1) + 1), ...r.slice(4, 7), String(originalPosition(r[1], +r[7])), String(originalPosition(r[1], +r[8] - 1) + 1), scopes];
  });
  assert.deepEqual(ordered(nextTransfers), ordered(transfers.filter(r => !isRemoved(r))), 'all retained transfers keep targets and protected scopes');
  for (const c of changes) {
    const within = range => transfers.filter(r => r[1] === c.file && +r[2] >= range.start && +r[3] <= range.end).map(r => r.slice(4));
    assert.deepEqual(within(c.removedTail), within(c.retainedTail), 'both copies resolve to identical exit targets and protected scopes');
  }
  const markers = path.join(temporary, 'selections.tsv'); fs.writeFileSync(markers, changes.map(c => [c.file, c.region.start, c.afterStart, c.name].join('\t')).join('\n') + '\n');
  const fingerprint = (directory, mode) => rows(run('java', ['-cp', helpers, 'DynamicTailTrees', directory, stubs, markers, mode]));
  assert.deepEqual(fingerprint(expected, 'after'), fingerprint(before, 'before'), 'all independent attributed JDK trees preserve ordered conditions, prefix, guard, retained tail and all other operations');
  const candidate = preview ? process.env.GEOBLOX_DYNAMIC_TAIL_CANDIDATE_DIR : path.join(archive(funorbRepository, proof.sourceCommit, 'after', 'games/geoblox').directory, 'games/geoblox');
  if (candidate) for (const e of entries) assert.ok(fs.readFileSync(path.join(expected, e.path)).equals(fs.readFileSync(path.join(candidate, e.path))), e.path + ' exact expected compiler bytes');
  const result = {files: 303, changedFiles: new Set(changes.map(c => c.file)).size, changedMethods: changes.length, sharedTails: changes.length, duplicateTokensRemoved, independentlyComparedAstFiles: 303, bindingsBefore: old.filter(r => ['D', 'R'].includes(r[0])).length, bindingsAfter: after.filter(r => ['D', 'R'].includes(r[0])).length, duplicateBindingsRemoved: old.filter(r => ['D', 'R'].includes(r[0]) && isRemoved(r)).length, declarationsAdded: newFlags.length, newFlagOccurrences: added.length, transfersBefore: transfers.length, transfersAfter: nextTransfers.length, duplicateTransfersRemoved: transfers.filter(isRemoved).length, sourceTreeSha256: sourceIdentity(sourceInventory(expected)), symbolMigrations: [...oldToNext].filter(([a, b]) => a !== b).map(([before, after]) => ({before, after})), selections: changes};
  if (proof) { assert.equal(result.sourceTreeSha256, proof.sourceTreeSha256); assert.deepEqual(result.selections, proof.selections); }
  console.log(JSON.stringify(result));
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
