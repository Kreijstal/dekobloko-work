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

// Whole-source certification of the final Boolean-only cleanup. The independent
// JDK tree fingerprint canonicalizes only primitive control conditions; ordinary
// equality operands (including boxed identity) remain opaque to that algebra.
const preview = process.argv.includes('--preview');
const javaTools = path.resolve(process.argv[2] || '../java-tools');
const root = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.finalBooleanPredicateCleanup;
assert.ok(preview || proof);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-final-boolean-'));
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
  const {simplifyPredicateNegations, simplifyPredicateGrouping} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const helperFixture = path.join(workflowRoot, 'tests/test-geoblox-guarded-abrupt-source.mjs');
  if (proof) assert.equal(hash(fs.readFileSync(helperFixture)), proof.bodyPositionFixtureSha256);
  const template = fs.readFileSync(helperFixture, 'utf8').match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/);
  assert.ok(template);
  fs.writeFileSync(path.join(temporary, 'GeobloxBodyPositions.java'), new Function('return ' + template[1].slice(0, -2))());
  fs.writeFileSync(path.join(temporary, 'BooleanTreeProof.java'), `
import java.io.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;import java.util.stream.*;
import javax.tools.*;import com.sun.source.tree.*;import com.sun.source.util.*;
public class BooleanTreeProof {
 static Tree peel(Tree n){while(n instanceof ParenthesizedTree)n=((ParenthesizedTree)n).getExpression();return n;}
 static String fingerprint(Tree root){
  StringBuilder out=new StringBuilder();new TreeScanner<Void,Void>(){
   void atom(Object value){String s=String.valueOf(value);out.append(s.length()).append(':').append(s);}
   void condition(Tree n,boolean negative){
    if(n==null){out.append("nil;");return;}n=peel(n);
    if(n.getKind()==Tree.Kind.LOGICAL_COMPLEMENT){condition(((UnaryTree)n).getExpression(),!negative);return;}
    Tree.Kind k=n.getKind();
    if(k==Tree.Kind.CONDITIONAL_AND||k==Tree.Kind.CONDITIONAL_OR){
     BinaryTree b=(BinaryTree)n;out.append('(');atom(negative?(k==Tree.Kind.CONDITIONAL_AND?Tree.Kind.CONDITIONAL_OR:Tree.Kind.CONDITIONAL_AND):k);
     condition(b.getLeftOperand(),negative);condition(b.getRightOperand(),negative);out.append(')');return;
    }
    if(k==Tree.Kind.EQUAL_TO||k==Tree.Kind.NOT_EQUAL_TO){
     BinaryTree b=(BinaryTree)n;out.append('(');atom(negative?(k==Tree.Kind.EQUAL_TO?Tree.Kind.NOT_EQUAL_TO:Tree.Kind.EQUAL_TO):k);
     scan(b.getLeftOperand(),null);scan(b.getRightOperand(),null);out.append(')');return;
    }
    if(n instanceof LiteralTree&&((LiteralTree)n).getValue() instanceof Boolean){
     out.append('(');atom(Tree.Kind.BOOLEAN_LITERAL);atom(negative?!((Boolean)((LiteralTree)n).getValue()):((LiteralTree)n).getValue());out.append(')');return;
    }
    if(negative){out.append('(');atom(Tree.Kind.LOGICAL_COMPLEMENT);}scan(n,null);if(negative)out.append(')');
   }
   @Override public Void scan(Tree n,Void unused){
    if(n==null){out.append("nil;");return null;}if(n instanceof ParenthesizedTree)return scan(((ParenthesizedTree)n).getExpression(),null);
    out.append('(');atom(n.getKind());
    if(n instanceof IdentifierTree)atom(((IdentifierTree)n).getName());else if(n instanceof MemberSelectTree)atom(((MemberSelectTree)n).getIdentifier());else if(n instanceof LiteralTree)atom(((LiteralTree)n).getValue());else if(n instanceof VariableTree)atom(((VariableTree)n).getName());else if(n instanceof MethodTree)atom(((MethodTree)n).getName());else if(n instanceof ClassTree)atom(((ClassTree)n).getSimpleName());else if(n instanceof LabeledStatementTree)atom(((LabeledStatementTree)n).getLabel());else if(n instanceof BreakTree)atom(((BreakTree)n).getLabel());else if(n instanceof ContinueTree)atom(((ContinueTree)n).getLabel());else if(n instanceof PrimitiveTypeTree)atom(((PrimitiveTypeTree)n).getPrimitiveTypeKind());else if(n instanceof ModifiersTree)atom(((ModifiersTree)n).getFlags().stream().map(Object::toString).sorted().collect(Collectors.joining(",")));else if(n instanceof MemberReferenceTree){atom(((MemberReferenceTree)n).getMode());atom(((MemberReferenceTree)n).getName());}
    super.scan(n,null);out.append(')');return null;
   }
   @Override public Void visitIf(IfTree n,Void u){condition(n.getCondition(),false);scan(n.getThenStatement(),null);scan(n.getElseStatement(),null);return null;}
   @Override public Void visitWhileLoop(WhileLoopTree n,Void u){condition(n.getCondition(),false);scan(n.getStatement(),null);return null;}
   @Override public Void visitDoWhileLoop(DoWhileLoopTree n,Void u){scan(n.getStatement(),null);condition(n.getCondition(),false);return null;}
   @Override public Void visitForLoop(ForLoopTree n,Void u){scan(n.getInitializer(),null);condition(n.getCondition(),false);scan(n.getUpdate(),null);scan(n.getStatement(),null);return null;}
  }.scan(root,null);
  try{byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(out.toString().getBytes(StandardCharsets.UTF_8));StringBuilder hex=new StringBuilder();for(byte b:bytes)hex.append(String.format("%02x",b&255));return hex.toString();}catch(Exception e){throw new AssertionError(e);}
 }
 public static void main(String[]args)throws Exception{
  JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();
  try(StandardJavaFileManager fm=compiler.getStandardFileManager(errors,null,StandardCharsets.UTF_8);Stream<Path> paths=Files.list(Paths.get(args[0]))){
   List<File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());
   JavacTask task=(JavacTask)compiler.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-sourcepath","","-classpath",args[1]),null,fm.getJavaFileObjectsFromFiles(files));List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);task.analyze();for(Diagnostic<?> d:errors.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d);
   for(CompilationUnitTree unit:units)System.out.println(Paths.get(unit.getSourceFile().toUri()).getFileName()+"\\t"+fingerprint(unit));
  }
 }
}
`);
  const helpers = path.join(temporary, 'helpers'), expected = path.join(temporary, 'expected');
  const stubs = path.join(funorbRepository, 'readable/funorb-stubs.jar'); fs.mkdirSync(helpers); fs.mkdirSync(expected);
  run('javac', ['-d', helpers, path.join(temporary, 'GeobloxBodyPositions.java'), path.join(temporary, 'BooleanTreeProof.java'), path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const facts = directory => rows(run('java', ['-cp', helpers, 'GeobloxBodyPositions', directory, stubs, 'fields']));
  const initial = facts(before), spans = initial.filter(r => r[0].endsWith('.java') && (!r[7] || r[7] === r[0].slice(0, -5)));
  const counts = {predicatesSimplified: 0, doubleNegations: 0, equalityComplements: 0, deMorganOperators: 0, booleanLiterals: 0, relationalComplements: 0, parenthesisPairsRemoved: 0};
  const changes = [], maps = new Map();
  for (const entry of entries) {
    let text = fs.readFileSync(path.join(before, entry.path), 'utf8');
    const mapped = Array.from({length: text.length}, (_, i) => i);
    for (const span of spans.filter(r => r[0] === entry.path).sort((a, b) => +b[1] - +a[1])) {
      const base = +span[1] + 1, end = +span[2] - 1; let body = text.slice(base, end), rewrites = 0, pairs = 0;
      function edits(list) {
        let candidate = body;
        for (const edit of list.slice().sort((a, b) => b.start - a.start || b.end - a.end)) {
          candidate = candidate.slice(0, edit.start) + edit.text + candidate.slice(edit.end);
          mapped.splice(base + edit.start, edit.end - edit.start, ...Array(edit.text.length).fill(null));
        }
        return candidate;
      }
      for (;;) {
        const result = simplifyPredicateNegations(body, {complementIntegralRelations: false, retainDiagnostics: true});
        if (!result.predicatesSimplified) break;
        assert.equal(result.diagnostics.counts.relationalComplements, 0);
        for (const edit of result.diagnostics.tokenEdits) {
          const old = body.slice(edit.start, edit.end);
          assert.ok(old === '!' && edit.text === '' || ({'==': '!=', '!=': '==', '&&': '||', '||': '&&', 'true': 'false', 'false': 'true'})[old] === edit.text || !old && ['!(', ')'].includes(edit.text));
        }
        assert.equal(edits(result.diagnostics.tokenEdits), result.source);
        body = result.source; rewrites += result.predicatesSimplified; counts.predicatesSimplified += result.predicatesSimplified;
        for (const [key, count] of Object.entries(result.diagnostics.counts)) counts[key] += count;
      }
      const grouped = simplifyPredicateGrouping(body, {retainDiagnostics: true});
      if (grouped.parenthesisPairsRemoved) {
        const d = grouped.diagnostics; assert.equal(d.deletedRanges.length, grouped.parenthesisPairsRemoved * 2);
        assert.deepEqual(new Set(d.deletedRanges.map(r => r.start)), new Set(d.pairs.flatMap(p => [p.open, p.close])));
        for (const p of d.pairs) { assert.equal(body[p.open], '('); assert.equal(body[p.close], ')'); }
        assert.equal(edits(d.deletedRanges.map(r => ({...r, text: ''}))), grouped.source);
        body = grouped.source; pairs = grouped.parenthesisPairsRemoved; counts.parenthesisPairsRemoved += pairs;
      }
      if (rewrites || pairs) { text = text.slice(0, base) + body + text.slice(end); changes.push({file: entry.path, methodStart: +span[6], predicates: rewrites, pairs}); }
    }
    fs.writeFileSync(path.join(expected, entry.path), text); maps.set(entry.path, mapped);
  }
  assert.ok(changes.length);
  const fingerprints = dir => rows(run('java', ['-cp', helpers, 'BooleanTreeProof', dir, stubs]));
  assert.deepEqual(fingerprints(expected), fingerprints(before), 'all independent attributed JDK ASTs retain ordered control algebra and every ordinary operand');
  const files = path.join(temporary, 'files.txt'); fs.writeFileSync(files, entries.map(e => e.path).join('\n') + '\n');
  const audit = directory => { const report = path.join(temporary, 'bindings.tsv'), classes = fs.mkdtempSync(path.join(temporary, 'classes-')); run('java', ['-cp', helpers, 'ReadableJava', directory, files, report, classes, stubs, '--class-name-literals', '--labels']); return rows(fs.readFileSync(report, 'utf8')); };
  const old = audit(before), after = audit(expected), mapped = r => {
    const map = maps.get(r[1]); assert.ok(Number.isInteger(map[+r[2]]) && Number.isInteger(map[+r[3] - 1]));
    return [r[0], r[1], String(map[+r[2]]), String(map[+r[3] - 1] + 1), ...r.slice(4)];
  };
  const valueRows = ['D', 'R', 'T', 'B', 'N', 'S', 'U'];
  assert.deepEqual(after.filter(r => valueRows.includes(r[0])).map(mapped), old.filter(r => valueRows.includes(r[0])), 'every full value/class-name/label binding identity survives');
  assert.deepEqual(after.filter(r => r[0] === 'O'), old.filter(r => r[0] === 'O'));
  const originalPosition = (file, offset) => { const value = maps.get(file)[offset]; assert.ok(Number.isInteger(value)); return value; };
  const nextTransfers = facts(expected).filter(r => r[0] === 'Q').map(r => {
    const scopes = (r[9] || '').split(',').filter(Boolean).map(s => { const [kind, role, start] = s.split(':'); return [kind, role, originalPosition(r[1], +start)].join(':'); }).join(',');
    return ['Q', r[1], String(originalPosition(r[1], +r[2])), String(originalPosition(r[1], +r[3] - 1) + 1), ...r.slice(4, 7), String(originalPosition(r[1], +r[7])), String(originalPosition(r[1], +r[8] - 1) + 1), scopes];
  });
  assert.deepEqual(nextTransfers, initial.filter(r => r[0] === 'Q'), 'every transfer retains its target and protected scopes');
  const candidate = preview ? process.env.GEOBLOX_FINAL_BOOLEAN_CANDIDATE_DIR : path.join(funorbRepository, 'games/geoblox');
  if (candidate) for (const e of entries) assert.ok(fs.readFileSync(path.join(expected, e.path)).equals(fs.readFileSync(path.join(candidate, e.path))), e.path + ' exact expected compiler bytes');
  const result = {files: 303, changedFiles: new Set(changes.map(c => c.file)).size, changedMethods: changes.length, counts, independentlyComparedAstFiles: 303, bindingsCompared: old.filter(r => ['D', 'R'].includes(r[0])).length, transfersCompared: nextTransfers.length, sourceTreeSha256: sourceIdentity(sourceInventory(expected)), selections: changes.map(c => {
    const methods = old.filter(r => r[0] === 'D' && r[1] === c.file && r[4].startsWith('M:') && +r[2] >= c.methodStart && +r[2] < c.methodStart + 300); return {...c, symbol: methods[0]?.[4] || 'initializer'};
  })};
  if (proof) { assert.equal(result.sourceTreeSha256, proof.sourceTreeSha256); assert.deepEqual(result.counts, proof.counts); }
  console.log(JSON.stringify(result));
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
