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

// Independent source certificate of the selected leading-loop exit recipe.
// Validate both javac control forms, every retained binding/transfer and the
// original protected scopes. Native oracle coverage is recorded separately.
const preview = process.argv.includes('--preview');
const javaTools = path.resolve(process.argv.slice(2).find(a => a !== '--preview') || '../java-tools');
const root = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.leadingLoopExitWorkRecovery;
assert.ok(preview || proof);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-leading-loop-proof-'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const run = (cmd, args) => {try {return captureProcess(cmd, args, {maxBuffer: 128 * 1024 * 1024}).stdout.toString();} catch (e) {throw new Error(e.stderr?.toString() || e.message);}};
const rows = s => s.trim().split('\n').filter(Boolean).map(l => l.split('\t'));
const ordered = a => a.map(v => JSON.stringify(v)).sort();
try {
  function archive(repo, commit, name, subpath) {
    const tar = path.join(temporary, name + '.tar'), directory = path.join(temporary, name);
    run('git', ['-C', repo, 'archive', '--format=tar', '--output=' + tar, commit, ...(subpath ? [subpath] : [])]);
    fs.mkdirSync(directory); run('tar', ['-xf', tar, '-C', directory]); return {directory, sha256: hash(fs.readFileSync(tar))};
  }
  const pin = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'tools/PIN.json')));
  assert.equal(hash(fs.readFileSync(path.join(workflowRoot, 'tools/lib/ReadableJava.java'))), pin.files['lib/ReadableJava.java']);
  const tools = preview ? {directory: javaTools} : archive(javaTools, proof.javaToolsCommit, 'tools');
  if (proof) {assert.equal(tools.sha256, proof.sourceArchiveSha256); assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))), proof.sourceProofTestSha256);}
  const before = preview ? path.join(funorbRepository, 'games/geoblox') : path.join(archive(funorbRepository, proof.previousSourceCommit, 'before', 'games/geoblox').directory, 'games/geoblox');
  const entries = sourceInventory(before); assert.equal(entries.length, 303); if (proof) assert.equal(sourceIdentity(entries), proof.previousSourceTreeSha256);
  const {foldLeadingLoopExitWork} = createRequire(import.meta.url)(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const bodyFixture = path.join(workflowRoot, 'tests/test-geoblox-guarded-abrupt-source.mjs');
  if (proof) assert.equal(hash(fs.readFileSync(bodyFixture)), proof.bodyPositionFixtureSha256);
  const template = fs.readFileSync(bodyFixture, 'utf8').match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/); assert.ok(template);
  fs.writeFileSync(path.join(temporary, 'GeobloxBodyPositions.java'), new Function('return ' + template[1].slice(0, -2))());
  fs.writeFileSync(path.join(temporary, 'LeadingLoopTrees.java'), `
import java.io.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;import java.util.stream.*;
import javax.tools.*;import javax.lang.model.element.*;import javax.lang.model.type.*;
import com.sun.source.tree.*;import com.sun.source.util.*;
public class LeadingLoopTrees {
 static Tree peel(Tree n){while(n instanceof ParenthesizedTree)n=((ParenthesizedTree)n).getExpression();return n;}
 static void check(boolean b){if(!b)throw new AssertionError("invalid leading-loop certificate");}
 static String fingerprint(CompilationUnitTree unit,Trees trees,Map<Long,String[]> selections,boolean after){
  StringBuilder out=new StringBuilder();Set<Long> found=new HashSet<>();SourcePositions positions=trees.getSourcePositions();
  new TreeScanner<Void,Void>(){
   void atom(Object value){String s=String.valueOf(value);out.append(s.length()).append(':').append(s);}
   Element element(Tree n){Element e=trees.getElement(TreePath.getPath(unit,peel(n)));check(e!=null);return e;}
   Tree negative(Tree n){n=peel(n);check(n.getKind()==Tree.Kind.LOGICAL_COMPLEMENT);return ((UnaryTree)n).getExpression();}
   WhileLoopTree loop(Tree n,String label){if(n instanceof LabeledStatementTree){check(((LabeledStatementTree)n).getLabel().contentEquals(label));n=((LabeledStatementTree)n).getStatement();}else check(label.isEmpty());check(n instanceof WhileLoopTree);return (WhileLoopTree)n;}
   void canonical(String label,Tree condition,List<? extends StatementTree> body,List<? extends StatementTree> work){TypeMirror t=trees.getTypeMirror(TreePath.getPath(unit,condition));check(t.getKind()==TypeKind.BOOLEAN||t.toString().equals("java.lang.Boolean"));out.append("(leading-loop:");atom(label);scan(condition,null);out.append("body:");scan(body,null);out.append("exit-work:");scan(work,null);out.append(')');}
   @Override public Void scan(Tree n,Void unused){
    if(n==null){out.append("nil;");return null;}if(n instanceof ParenthesizedTree)return scan(((ParenthesizedTree)n).getExpression(),null);
    long start=positions.getStartPosition(unit,n);String[] choice=selections.get(start);
    if(choice!=null){check(found.add(start));String name=choice[0],label=choice[1];
     if(!after){WhileLoopTree original=loop(n,label);Tree condition=peel(original.getCondition());check(condition instanceof LiteralTree&&Boolean.TRUE.equals(((LiteralTree)condition).getValue()));check(original.getStatement() instanceof BlockTree);List<? extends StatementTree> ss=((BlockTree)original.getStatement()).getStatements();check(ss.size()>=2&&ss.get(0) instanceof IfTree);IfTree guard=(IfTree)ss.get(0);check(guard.getElseStatement()==null&&guard.getThenStatement() instanceof BlockTree);List<? extends StatementTree> work=((BlockTree)guard.getThenStatement()).getStatements();check(work.size()>=2&&work.get(work.size()-1) instanceof BreakTree);BreakTree exit=(BreakTree)work.get(work.size()-1);check(exit.getLabel()==null||exit.getLabel().contentEquals(label));canonical(label,guard.getCondition(),ss.subList(1,ss.size()),work.subList(0,work.size()-1));
     }else{check(n instanceof BlockTree&&!((BlockTree)n).isStatic());List<? extends StatementTree> ss=((BlockTree)n).getStatements();check(ss.size()==3&&ss.get(0) instanceof VariableTree&&ss.get(2) instanceof IfTree);VariableTree flag=(VariableTree)ss.get(0);Element local=element(flag);check(local.getKind()==ElementKind.LOCAL_VARIABLE&&local.asType().getKind()==TypeKind.BOOLEAN&&flag.getName().contentEquals(name)&&flag.getModifiers().getFlags().isEmpty());Tree initial=peel(flag.getInitializer());check(initial instanceof LiteralTree&&Boolean.FALSE.equals(((LiteralTree)initial).getValue()));WhileLoopTree changed=loop(ss.get(1),label);Tree decision=peel(negative(changed.getCondition()));check(decision instanceof AssignmentTree);AssignmentTree store=(AssignmentTree)decision;check(element(store.getVariable()).equals(local)&&changed.getStatement() instanceof BlockTree);IfTree guard=(IfTree)ss.get(2);check(element(guard.getCondition()).equals(local)&&guard.getElseStatement()==null&&guard.getThenStatement() instanceof BlockTree);canonical(label,store.getExpression(),((BlockTree)changed.getStatement()).getStatements(),((BlockTree)guard.getThenStatement()).getStatements());}
     return null;
    }
    out.append('(');atom(n.getKind());
    if(n instanceof IdentifierTree)atom(((IdentifierTree)n).getName());else if(n instanceof MemberSelectTree)atom(((MemberSelectTree)n).getIdentifier());else if(n instanceof LiteralTree)atom(((LiteralTree)n).getValue());else if(n instanceof VariableTree)atom(((VariableTree)n).getName());else if(n instanceof MethodTree)atom(((MethodTree)n).getName());else if(n instanceof ClassTree)atom(((ClassTree)n).getSimpleName());else if(n instanceof LabeledStatementTree)atom(((LabeledStatementTree)n).getLabel());else if(n instanceof BreakTree)atom(((BreakTree)n).getLabel());else if(n instanceof ContinueTree)atom(((ContinueTree)n).getLabel());else if(n instanceof PrimitiveTypeTree)atom(((PrimitiveTypeTree)n).getPrimitiveTypeKind());else if(n instanceof ModifiersTree)atom(((ModifiersTree)n).getFlags().stream().map(Object::toString).sorted().collect(Collectors.joining(",")));else if(n instanceof BlockTree)atom(((BlockTree)n).isStatic());else if(n instanceof MemberReferenceTree){atom(((MemberReferenceTree)n).getMode());atom(((MemberReferenceTree)n).getName());}
    super.scan(n,null);out.append(')');return null;
   }
  }.scan(unit,null);check(found.equals(selections.keySet()));
  try{byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(out.toString().getBytes(StandardCharsets.UTF_8));StringBuilder hex=new StringBuilder();for(byte b:bytes)hex.append(String.format("%02x",b&255));return hex.toString();}catch(Exception e){throw new AssertionError(e);}
 }
 public static void main(String[]args)throws Exception{Map<String,Map<Long,String[]>> markers=new HashMap<>();for(String line:Files.readAllLines(Paths.get(args[2]))){String[] r=line.split("\\t",-1);markers.computeIfAbsent(r[0],k->new HashMap<>()).put(Long.valueOf(r[args[3].equals("after")?2:1]),new String[]{r[3],r[4]});}
 JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();try(StandardJavaFileManager fm=compiler.getStandardFileManager(errors,null,StandardCharsets.UTF_8);Stream<Path> paths=Files.list(Paths.get(args[0]))){List<File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());JavacTask task=(JavacTask)compiler.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-sourcepath","","-classpath",args[1]),null,fm.getJavaFileObjectsFromFiles(files));List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);task.analyze();for(Diagnostic<?> d:errors.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d);Trees trees=Trees.instance(task);for(CompilationUnitTree unit:units){String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();System.out.println(file+"\\t"+fingerprint(unit,trees,markers.getOrDefault(file,Collections.emptyMap()),args[3].equals("after")));}}
 }
}
`);
  const helpers = path.join(temporary, 'helpers'), expected = path.join(temporary, 'expected'), stubs = path.join(funorbRepository, 'readable/funorb-stubs.jar'); fs.mkdirSync(helpers); fs.mkdirSync(expected);
  run('javac', ['-d', helpers, path.join(temporary, 'GeobloxBodyPositions.java'), path.join(temporary, 'LeadingLoopTrees.java'), path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const facts = dir => rows(run('java', ['-cp', helpers, 'GeobloxBodyPositions', dir, stubs, 'fields']));
  const initial = facts(before), spans = initial.filter(r => r[0].endsWith('.java') && (!r[7] || r[7] === r[0].slice(0, -5)));
  const maps = new Map(), selections = [];
  for (const entry of entries) {
    let text = fs.readFileSync(path.join(before, entry.path), 'utf8'), origins = Array.from({length: text.length}, (_, i) => i);
    for (const span of spans.filter(r => r[0] === entry.path).sort((a, b) => +b[1] - +a[1])) {
      const base = +span[1] + 1, end = +span[2] - 1; let body = text.slice(base, end);
      for (;;) {
        const r = foldLeadingLoopExitWork(body, {reservedNames: span[3].split(',').filter(Boolean), retainDiagnostics: true}); if (!r.loopsRecovered) break;
        const d = r.diagnostics, position = offset => {const value = origins[base + offset]; assert.ok(Number.isInteger(value)); return value;};
        const range = r => ({start: position(r.start), end: position(r.end - 1) + 1});
        const selection = {file: entry.path, methodStart: +span[6], name: d.name, region: range(d.range), condition: range(d.conditionRange), work: range(d.workRange), removedExit: range(d.removedExitRange), loop: range(d.originalLoopRange), label: d.label, otherLoopBreaks: d.otherLoopBreaks};
        assert.equal(r.source, body.slice(0,d.range.start) + d.segments.map(s => s.text ?? body.slice(s.range.start,s.range.end)).join('') + body.slice(d.range.end));
        const injected = d.segments.flatMap(s => s.text === undefined ? origins.slice(base + s.range.start, base + s.range.end) : Array(s.text.length).fill(null));
        origins = [...origins.slice(0,base+d.range.start), ...injected, ...origins.slice(base+d.range.end)];
        body = r.source; selections.push(selection);
      }
      text = text.slice(0,base) + body + text.slice(end);
    }
    fs.writeFileSync(path.join(expected,entry.path),text); maps.set(entry.path,origins);
  }
  assert.equal(selections.length,13);
  const list = path.join(temporary,'sources.txt');fs.writeFileSync(list,entries.map(e=>e.path).join('\n')+'\n');
  const audit = dir => {const report=path.join(temporary,'bindings.tsv'),classes=fs.mkdtempSync(path.join(temporary,'classes-'));run('java',['-cp',helpers,'ReadableJava',dir,list,report,classes,stubs,'--class-name-literals','--labels']);return rows(fs.readFileSync(report,'utf8'));};
  const old=audit(before), after=audit(expected), positional=new Set(['D','R','T','B','N','S','U']);
  const originalPosition=(file,offset)=>{const value=maps.get(file)[offset];assert.ok(Number.isInteger(value),file+':'+offset+' original character');return value;};
  const projected=r=>[r[0],r[1],String(originalPosition(r[1],+r[2])),String(originalPosition(r[1],+r[3]-1)+1),...r.slice(4)];
  const declarations=new Map(old.filter(r=>['D','T'].includes(r[0])).map(r=>[[r[1],r[2],r[3]].join(':'),r]));
  const nextToOld=new Map(),oldToNext=new Map(),flags=[];
  for(const r of after.filter(r=>['D','T'].includes(r[0]))){if(maps.get(r[1])[+r[2]]===null){assert.equal(r[0],'D');assert.match(r[4],/^L:/);assert.match(r[5],/^decompiledNaturalLoopExit\d+$/);flags.push(r);continue;}const p=projected(r),o=declarations.get([r[1],p[2],p[3]].join(':'));assert.ok(o);assert.equal(r[0],o[0]);assert.equal(r[5],o[5]);assert.ok(!nextToOld.has(r[4])&&!oldToNext.has(o[4]));nextToOld.set(r[4],o[4]);oldToNext.set(o[4],r[4]);}
  assert.equal(nextToOld.size,declarations.size);assert.equal(flags.length,selections.length);
  for(const s of selections){const owner=old.find(r=>r[0]==='D'&&r[1]===s.file&&r[4].startsWith('M:')&&+r[2]>=s.methodStart&&+r[2]<+spans.find(p=>p[0]===s.file&&+p[6]===s.methodStart)[1]);assert.ok(owner);s.method=owner[4];const f=flags.filter(r=>r[1]===s.file&&r[4].startsWith('L:'+s.method.slice(2)+'#')&&r[5]===s.name);assert.equal(f.length,1);s.symbol=f[0][4];s.afterStart=fs.readFileSync(path.join(expected,s.file),'utf8').lastIndexOf('{',+f[0][2]);}
  const flagSymbols=new Set(flags.map(r=>r[4]));const removed=r=>selections.some(s=>s.file===r[1]&&+r[2]>=s.removedExit.start&&+r[3]<=s.removedExit.end);
  const retained=[],added=[];for(const r of after.filter(r=>positional.has(r[0]))){if(maps.get(r[1])[+r[2]]===null){assert.ok(['D','R'].includes(r[0])&&flagSymbols.has(r[4]));added.push(r);}else{const p=projected(r);p[4]=nextToOld.get(r[4])||r[4];retained.push(p);}}
  assert.deepEqual(ordered(retained),ordered(old.filter(r=>positional.has(r[0])&&!removed(r))));assert.deepEqual(after.filter(r=>r[0]==='O'),old.filter(r=>r[0]==='O'));
  for(const s of selections){assert.equal(added.filter(r=>r[4]===s.symbol&&r[0]==='D').length,1);assert.equal(added.filter(r=>r[4]===s.symbol&&r[0]==='R').length,2);}
  const transfers=initial.filter(r=>r[0]==='Q'),nextTransfers=facts(expected).filter(r=>r[0]==='Q').map(r=>{const scopes=(r[9]||'').split(',').filter(Boolean).map(s=>{const[k,role,start]=s.split(':');return[k,role,originalPosition(r[1],+start)].join(':');}).join(',');return['Q',r[1],String(originalPosition(r[1],+r[2])),String(originalPosition(r[1],+r[3]-1)+1),...r.slice(4,7),String(originalPosition(r[1],+r[7])),String(originalPosition(r[1],+r[8]-1)+1),scopes];});
  assert.deepEqual(ordered(nextTransfers),ordered(transfers.filter(r=>!removed(r))),'all retained targets and protected scopes');
  for(const s of selections){const exit=transfers.filter(r=>r[1]===s.file&&+r[2]===s.removedExit.start);assert.equal(exit.length,1);assert.equal(exit[0][4],'BREAK');assert.equal(+exit[0][8],s.loop.end,JSON.stringify({selection:s,exit:exit[0]}));assert.equal(+exit[0][7],exit[0][5]?s.region.start:s.loop.start,JSON.stringify({selection:s,exit:exit[0]}));}
  const markers=path.join(temporary,'markers.tsv');fs.writeFileSync(markers,selections.map(s=>[s.file,s.region.start,s.afterStart,s.name,s.label||''].join('\t')).join('\n')+'\n');
  const fingerprint=(dir,mode)=>rows(run('java',['-cp',helpers,'LeadingLoopTrees',dir,stubs,markers,mode]));
  assert.deepEqual(fingerprint(expected,'after'),fingerprint(before,'before'),'all attributed Java syntax preserves the selected loop recipe and every other operation');
  const candidate=preview?process.env.GEOBLOX_LEADING_LOOP_CANDIDATE_DIR:path.join(archive(funorbRepository,proof.sourceCommit,'after','games/geoblox').directory,'games/geoblox');
  if(candidate)for(const e of entries)assert.ok(fs.readFileSync(path.join(expected,e.path)).equals(fs.readFileSync(path.join(candidate,e.path))),e.path+' exact selected compiler bytes');
  const result={files:303,changedFiles:new Set(selections.map(s=>s.file)).size,changedMethods:new Set(selections.map(s=>s.method)).size,loopsRecovered:selections.length,newDecisionLocals:flags.length,newFlagOccurrences:added.length,bindingsBefore:old.filter(r=>['D','R'].includes(r[0])).length,bindingsAfter:after.filter(r=>['D','R'].includes(r[0])).length,transfersBefore:transfers.length,transfersAfter:nextTransfers.length,leadingLoopExitsConsumed:transfers.filter(removed).length,removedLabelBindings:old.filter(r=>r[0]==='B'&&removed(r)).length,sourceTreeSha256:sourceIdentity(sourceInventory(expected)),symbolMigrations:[...oldToNext].filter(([a,b])=>a!==b).map(([before,after])=>({before,after})),selections};
  if(proof){assert.equal(result.sourceTreeSha256,proof.sourceTreeSha256);assert.deepEqual(result.selections,proof.selections);}
  console.log(JSON.stringify(result));
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
