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

// The independent javac verifier derives exit targets and complete suffixes
// from the original trees. Normalizing synthetic scaffolding is allowed only
// after verifying that exact recipe, bound flags, and ordered syntax. Source
// provenance additionally checks all old bindings and protected transfers.
const preview = process.argv.includes('--preview');
const javaTools = path.resolve(process.argv.slice(2).find(a => a !== '--preview') || '../java-tools');
const root = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.dominatingGuardedFrameRecovery;
assert.ok(preview || proof);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-dominating-frame-proof-'));
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
  const require = createRequire(import.meta.url);
  const {foldGuardedFrameCompletion,compactLocalBooleanGuards,reindentStructuredSource} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava} = require(path.join(tools.directory, 'src/java-frontend/lexer.js'));
  const bodyFixture = path.join(workflowRoot, 'tests/test-geoblox-guarded-abrupt-source.mjs');
  if (proof) assert.equal(hash(fs.readFileSync(bodyFixture)), proof.bodyPositionFixtureSha256);
  const template = fs.readFileSync(bodyFixture, 'utf8').match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/); assert.ok(template);
  fs.writeFileSync(path.join(temporary, 'GeobloxBodyPositions.java'), new Function('return ' + template[1].slice(0, -2))());
  fs.writeFileSync(path.join(temporary, 'GuardedFrameTrees.java'), `
import java.io.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;import java.util.stream.*;
import javax.tools.*;import javax.lang.model.element.*;import javax.lang.model.type.*;import com.sun.source.tree.*;import com.sun.source.util.*;
public class GuardedFrameTrees {
 static void check(boolean b,String message){if(!b)throw new AssertionError(message);}
 static Tree peel(Tree n){while(n instanceof ParenthesizedTree)n=((ParenthesizedTree)n).getExpression();return n;}
 static class Recipe {
  String key,name,label;long before,after,body;Element flag;
  Set<String> suffixes=new HashSet<>();Map<Long,Long> decisions=new HashMap<>(),effects=new HashMap<>();Map<String,long[]> prefixes=new HashMap<>(),dominators=new HashMap<>();
 }
 static class Audit {
  CompilationUnitTree unit;Trees trees;SourcePositions positions;boolean after;Map<Long,Long> origins;
  Map<Long,Recipe> markers;Map<Tree,Recipe> oldFrames=new IdentityHashMap<>(),oldGuards=new IdentityHashMap<>(),oldEffects=new IdentityHashMap<>();
  Map<Element,Recipe> flags=new HashMap<>();Map<Long,Recipe> bodies=new HashMap<>();
  Set<String> seenSuffixes=new HashSet<>(),seenDecisions=new HashSet<>();Set<Long> found=new HashSet<>();
  StringBuilder out=new StringBuilder();
  Audit(CompilationUnitTree u,Trees t,Map<Long,Recipe> m,Map<Long,Long> o,boolean a){unit=u;trees=t;positions=t.getSourcePositions();markers=m;origins=o;after=a;}
  long start(Tree n){return positions.getStartPosition(unit,n);}
  Element element(Tree n){Element e=trees.getElement(TreePath.getPath(unit,peel(n)));check(e!=null,"bound element");return e;}
  Long project(Tree n){return origins.get(start(n));} Long endProject(Tree n){return origins.get(positions.getEndPosition(unit,n)-1);}
  Tree parent(Tree n){TreePath p=TreePath.getPath(unit,n);check(p!=null&&p.getParentPath()!=null,"parent");return p.getParentPath().getLeaf();}
  String suffix(Recipe r,BlockTree block,List<Long> statements){return r.key+":"+start(block)+":"+statements;}
  void checkPrefixes(Recipe r,LabeledStatementTree frame){
   for(Map.Entry<String,long[]> evidence:r.prefixes.entrySet()){
    String name=evidence.getKey();long[] offsets=evidence.getValue();List<VariableTree> declarations=new ArrayList<>();
    new TreeScanner<Void,Void>(){@Override public Void visitVariable(VariableTree n,Void ignored){if(start(n)==offsets[0]&&n.getName().contentEquals(name))declarations.add(n);return super.visitVariable(n,ignored);}}.scan(unit,null);
    check(declarations.size()==1,"one original declaration");VariableTree declaration=declarations.get(0);Element local=element(declaration);Tree scope=parent(declaration);
    check(local.getKind()==ElementKind.LOCAL_VARIABLE&&declaration.getInitializer()==null&&scope instanceof BlockTree,"uninitialized local scope");
    Tree cursor=frame.getStatement();while(cursor!=scope)cursor=parent(cursor);
    boolean matched=false;
    for(StatementTree n:((BlockTree)frame.getStatement()).getStatements()){
     if(!(n instanceof VariableTree||n instanceof ExpressionStatementTree))break;
     if(start(n)!=offsets[1])continue;
     check(n instanceof ExpressionStatementTree,"straight assignment");Tree expression=peel(((ExpressionStatementTree)n).getExpression());
     check(expression instanceof AssignmentTree&&element(((AssignmentTree)expression).getVariable()).equals(local)&&offsets[0]<offsets[1],"dominating bound assignment");matched=true;break;
    }
    check(matched,"assignment precedes every branch/exit");
   }
  }
  void checkDominators(Recipe r,LabeledStatementTree frame){
   for(Map.Entry<String,long[]> evidence:r.dominators.entrySet()){
    String name=evidence.getKey();long[] offsets=evidence.getValue();List<VariableTree> declarations=new ArrayList<>();
    new TreeScanner<Void,Void>(){@Override public Void visitVariable(VariableTree n,Void ignored){if(start(n)==offsets[0]&&n.getName().contentEquals(name))declarations.add(n);return super.visitVariable(n,ignored);}}.scan(unit,null);
    check(declarations.size()==1,"one independently bound prior declaration");VariableTree declaration=declarations.get(0);Element local=element(declaration);Tree scope=parent(declaration);
    check(local.getKind()==ElementKind.LOCAL_VARIABLE&&declaration.getInitializer()==null&&scope instanceof BlockTree,"original uninitialized local scope");
    Tree lexical=frame;while(lexical!=scope)lexical=parent(lexical);
    boolean matched=false;Tree cursor=frame;
    while(!matched){Tree owner=parent(cursor);
     if(owner instanceof BlockTree){List<? extends StatementTree> statements=((BlockTree)owner).getStatements();int index=statements.indexOf(cursor);check(index>=0,"original block member");
      for(int i=0;i<index;i++){StatementTree n=statements.get(i);if(start(n)!=offsets[1])continue;
       check(n instanceof ExpressionStatementTree&&offsets[0]<offsets[1],"original direct earlier sibling");Tree expression=peel(((ExpressionStatementTree)n).getExpression());
       check(expression instanceof AssignmentTree&&((AssignmentTree)expression).getVariable() instanceof IdentifierTree&&element(((AssignmentTree)expression).getVariable()).equals(local),"same bound simple assignment");
       new TreePathScanner<Void,Void>(){@Override public Void visitIdentifier(IdentifierTree n,Void unused){check(!local.equals(trees.getElement(getCurrentPath())),"no self-reading initialization");return super.visitIdentifier(n,unused);}}.scan(TreePath.getPath(unit,((AssignmentTree)expression).getExpression()),null);matched=true;
      }
     }else if(owner instanceof IfTree)check(((IfTree)owner).getThenStatement()==cursor||((IfTree)owner).getElseStatement()==cursor,"original conditional arm");
     else if(owner instanceof LabeledStatementTree)check(((LabeledStatementTree)owner).getStatement()==cursor,"original label body");
     else if(owner instanceof WhileLoopTree)check(((WhileLoopTree)owner).getStatement()==cursor,"original while body");
     else if(owner instanceof ForLoopTree)check(((ForLoopTree)owner).getStatement()==cursor,"original for body");
     else if(owner instanceof DoWhileLoopTree)check(((DoWhileLoopTree)owner).getStatement()==cursor,"original do body");
     else if(owner instanceof EnhancedForLoopTree)check(((EnhancedForLoopTree)owner).getStatement()==cursor,"original enhanced-for body");
     else throw new AssertionError("crossed case entry, catch/finally or protected entry");
     cursor=owner;
    }
   }
  }
  void derive(Recipe r,LabeledStatementTree frame){
   check(frame.getLabel().contentEquals(r.label)&&frame.getStatement() instanceof BlockTree,"original frame");
   checkPrefixes(r,frame);checkDominators(r,frame);
   r.body=start(frame.getStatement());oldFrames.put(frame,r);bodies.put(r.body,r);
   new TreeScanner<Void,Void>(){
    @Override public Void visitBreak(BreakTree jump,Void ignored){
     if(jump.getLabel()==null)return null;Tree target=parent(jump);
     while(!(target instanceof LabeledStatementTree&&((LabeledStatementTree)target).getLabel().contentEquals(jump.getLabel())))target=parent(target);
     if(target!=frame)return null;
     Tree guard=parent(jump);
     boolean effect=false;if(guard instanceof BlockTree){List<? extends StatementTree> ss=((BlockTree)guard).getStatements();check(!ss.isEmpty()&&ss.get(ss.size()-1)==jump,"direct terminal exit");effect=ss.size()>1;guard=parent(guard);}
     check(guard instanceof IfTree,"guarded exit");effect=effect||((IfTree)guard).getElseStatement()!=null;
     IfTree decision=(IfTree)guard;Tree arm=decision.getThenStatement();
     check(arm==jump||arm instanceof BlockTree&&((BlockTree)arm).getStatements().get(((BlockTree)arm).getStatements().size()-1)==jump,"exact terminal exit arm");
     if(effect){oldEffects.put(jump,r);check(r.effects.put(positions.getEndPosition(unit,jump)-1,start(jump))==null,"unique effectful exit");}else{oldGuards.put(guard,r);check(r.decisions.put(start(decision.getCondition()),start(guard))==null,"unique decision");}
     Tree child=guard;
     while(child!=frame.getStatement()){
      Tree p=parent(child);
      if(p instanceof BlockTree){List<? extends StatementTree> ss=((BlockTree)p).getStatements();int i=ss.indexOf(child);check(i>=0,"suffix child");if(i+1<ss.size())r.suffixes.add(suffix(r,(BlockTree)p,ss.subList(i+1,ss.size()).stream().map(Audit.this::start).collect(Collectors.toList())));}
      else if(p instanceof IfTree)check(((IfTree)p).getThenStatement()==child||((IfTree)p).getElseStatement()==child,"if corridor");
      else check(p instanceof LabeledStatementTree&&((LabeledStatementTree)p).getStatement()==child&&child instanceof BlockTree,"plain label corridor");
      child=p;
     }
     return null;
    }
    @Override public Void visitContinue(ContinueTree jump,Void ignored){check(jump.getLabel()==null||!jump.getLabel().contentEquals(r.label),"no frame continuation");return null;}
   }.scan(frame.getStatement(),null);
   check((!r.decisions.isEmpty()||!r.effects.isEmpty())&&!r.suffixes.isEmpty(),"nonempty recipe");
  }
  void initialize(){
   new TreeScanner<Void,Void>(){
    @Override public Void scan(Tree n,Void ignored){if(n==null)return null;Recipe r=markers.get(start(n));if(r!=null){check(found.add(start(n)),"one marker");if(after){check(n instanceof BlockTree,"new frame scope");List<? extends StatementTree> ss=((BlockTree)n).getStatements();check(!ss.isEmpty()&&ss.get(0) instanceof VariableTree,"first flag declaration");VariableTree d=(VariableTree)ss.get(0);r.flag=element(d);check(r.flag.getKind()==ElementKind.LOCAL_VARIABLE&&r.flag.asType().getKind()==TypeKind.BOOLEAN&&d.getName().contentEquals(r.name)&&d.getModifiers().getFlags().isEmpty()&&d.getModifiers().getAnnotations().isEmpty(),"typed flag");Tree init=peel(d.getInitializer());check(init instanceof LiteralTree&&Boolean.TRUE.equals(((LiteralTree)init).getValue()),"true initializer");check(flags.put(r.flag,r)==null,"unique flag");}else{check(n instanceof LabeledStatementTree,"old label");derive(r,(LabeledStatementTree)n);}}return super.scan(n,ignored);}
   }.scan(unit,null);check(found.equals(markers.keySet()),"all frames found");
  }
  Recipe guard(Tree n){if(!(n instanceof IfTree))return null;Tree c=peel(((IfTree)n).getCondition());if(!(c instanceof IdentifierTree))return null;Element e=trees.getElement(TreePath.getPath(unit,c));return flags.get(e);}
  Recipe decision(Tree n){if(!(n instanceof ExpressionStatementTree))return null;Tree e=peel(((ExpressionStatementTree)n).getExpression());if(!(e instanceof AssignmentTree))return null;return flags.get(trees.getElement(TreePath.getPath(unit,peel(((AssignmentTree)e).getVariable()))));}
  boolean effect(Tree n){Tree e=peel(((AssignmentTree)((ExpressionStatementTree)n).getExpression()).getExpression());return e instanceof LiteralTree&&Boolean.FALSE.equals(((LiteralTree)e).getValue());}
  Tree condition(Tree n){Tree e=peel(((AssignmentTree)((ExpressionStatementTree)n).getExpression()).getExpression());check(e.getKind()==Tree.Kind.LOGICAL_COMPLEMENT,"original decision negation");return ((UnaryTree)e).getExpression();}
  List<Long> statementIds(List<? extends StatementTree> ss){List<Long> ids=new ArrayList<>();for(StatementTree n:ss){Recipe g=guard(n),d=decision(n);if(g!=null){IfTree i=(IfTree)n;check(i.getElseStatement()==null&&i.getThenStatement() instanceof BlockTree,"exact suffix guard");ids.addAll(statementIds(((BlockTree)i.getThenStatement()).getStatements()));}else if(d!=null){if(effect(n)){Long p=endProject(n);check(p!=null&&d.effects.containsKey(p),"old terminal exit origin");ids.add(d.effects.get(p));}else{Long p=project(condition(n));check(p!=null&&d.decisions.containsKey(p),"old decision origin");ids.add(d.decisions.get(p));}}else {Long p=project(n);check(p!=null,"retained statement origin");Recipe frame=bodies.get(p);ids.add(frame==null?p:frame.before);}}return ids;}
  void atom(Object v){String s=String.valueOf(v);out.append(s.length()).append(':').append(s);}
  void emitDecision(Recipe r,Tree c){out.append("(decision:");atom(r.key);scan(c);out.append(')');}
  void scan(Tree n){
   if(n==null){out.append("nil;");return;}if(n instanceof ParenthesizedTree){scan(((ParenthesizedTree)n).getExpression());return;}
   if(!after&&oldFrames.containsKey(n)){scan(((LabeledStatementTree)n).getStatement());return;}
   if(!after&&oldEffects.containsKey(n)){out.append("(effect-exit:");atom(oldEffects.get(n).key);out.append(')');return;}
   if(!after&&oldGuards.containsKey(n)){emitDecision(oldGuards.get(n),((IfTree)n).getCondition());return;}
   if(after){
    if(n instanceof VariableTree&&flags.containsKey(trees.getElement(TreePath.getPath(unit,n))))return;
    Recipe g=guard(n);if(g!=null){IfTree i=(IfTree)n;check(i.getElseStatement()==null&&i.getThenStatement() instanceof BlockTree,"complete suffix guard");Tree p=parent(n);while(!(p instanceof BlockTree)||project(p)==null)p=parent(p);Long block=project(p);String key=g.key+":"+block+":"+statementIds(((BlockTree)i.getThenStatement()).getStatements());check(g.suffixes.contains(key)&&seenSuffixes.add(key),"one complete independently derived suffix: "+key);for(StatementTree s:((BlockTree)i.getThenStatement()).getStatements())scan(s);return;}
    Recipe d=decision(n);if(d!=null){if(effect(n)){Long p=endProject(n);check(p!=null&&d.effects.containsKey(p)&&seenDecisions.add(d.key+":E:"+p),"one original terminal exit");out.append("(effect-exit:");atom(d.key);out.append(')');return;}Tree c=condition(n);Long origin=project(c);check(origin!=null&&d.decisions.containsKey(origin)&&seenDecisions.add(d.key+":"+origin),"one original captured decision");emitDecision(d,c);return;}
    if(n instanceof IdentifierTree)check(!flags.containsKey(trees.getElement(TreePath.getPath(unit,n))),"no other flag use");
   }
   out.append('(');atom(n.getKind());
   if(n instanceof IdentifierTree)atom(((IdentifierTree)n).getName());else if(n instanceof MemberSelectTree)atom(((MemberSelectTree)n).getIdentifier());else if(n instanceof LiteralTree)atom(((LiteralTree)n).getValue());else if(n instanceof VariableTree)atom(((VariableTree)n).getName());else if(n instanceof MethodTree)atom(((MethodTree)n).getName());else if(n instanceof ClassTree)atom(((ClassTree)n).getSimpleName());else if(n instanceof LabeledStatementTree)atom(((LabeledStatementTree)n).getLabel());else if(n instanceof BreakTree)atom(((BreakTree)n).getLabel());else if(n instanceof ContinueTree)atom(((ContinueTree)n).getLabel());else if(n instanceof PrimitiveTypeTree)atom(((PrimitiveTypeTree)n).getPrimitiveTypeKind());else if(n instanceof ModifiersTree)atom(((ModifiersTree)n).getFlags().stream().map(Object::toString).sorted().collect(Collectors.joining(",")));else if(n instanceof BlockTree)atom(((BlockTree)n).isStatic());else if(n instanceof MemberReferenceTree){atom(((MemberReferenceTree)n).getMode());atom(((MemberReferenceTree)n).getName());}
   new TreeScanner<Void,Void>(){@Override public Void scan(Tree c,Void ignored){Audit.this.scan(c);return null;}void children(Tree c){super.scan(c,null);}}.children(n);
   out.append(')');
  }
 }
 public static void main(String[]args)throws Exception{
  Map<String,Map<Long,Recipe>> markers=new HashMap<>();
  for(String line:Files.readAllLines(Paths.get(args[3]))){String[]r=line.split("\\t",-1);Recipe p=new Recipe();p.before=Long.parseLong(r[1]);p.after=Long.parseLong(r[2]);p.name=r[3];p.label=r[4];p.key=r[0]+":"+r[1];if(r.length>5&&!r[5].isEmpty())for(String prefix:r[5].split(",")){String[]e=prefix.split(":");check(e.length==3,"prefix marker");p.prefixes.put(e[0],new long[]{Long.parseLong(e[1]),Long.parseLong(e[2])});}if(r.length>6&&!r[6].isEmpty())for(String dominator:r[6].split(",")){String[]e=dominator.split(":");check(e.length==3,"dominating marker");p.dominators.put(e[0],new long[]{Long.parseLong(e[1]),Long.parseLong(e[2])});}markers.computeIfAbsent(r[0],k->new HashMap<>()).put(p.before,p);}
  Map<String,Map<Long,Long>> origins=new HashMap<>();for(String line:Files.readAllLines(Paths.get(args[4]))){String[]r=line.split("\\t");origins.computeIfAbsent(r[0],k->new HashMap<>()).put(Long.parseLong(r[1]),Long.parseLong(r[2]));}
  Map<String,Audit> before=new TreeMap<>();
  for(int mode=0;mode<2;mode++){JavaCompiler c=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();try(StandardJavaFileManager fm=c.getStandardFileManager(errors,null,StandardCharsets.UTF_8);Stream<Path> paths=Files.list(Paths.get(args[mode]))){List<File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());JavacTask task=(JavacTask)c.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-sourcepath","","-classpath",args[2]),null,fm.getJavaFileObjectsFromFiles(files));List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);task.analyze();for(Diagnostic<?> d:errors.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d);Trees trees=Trees.instance(task);
   for(CompilationUnitTree unit:units){String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();Map<Long,Recipe> selected=markers.getOrDefault(file,Collections.emptyMap());if(mode==1)selected=selected.values().stream().collect(Collectors.toMap(r->r.after,r->r));Audit a=new Audit(unit,trees,selected,origins.get(file),mode==1);if(mode==1)a.bodies.putAll(before.get(file).bodies);a.initialize();a.scan(unit);if(mode==0)before.put(file,a);else{Audit old=before.get(file);check(old.out.toString().equals(a.out.toString()),file+" all ordered original syntax");Set<String> suffixes=selected.values().stream().flatMap(r->r.suffixes.stream()).collect(Collectors.toSet());Set<String> decisions=selected.values().stream().flatMap(r->java.util.stream.Stream.concat(r.decisions.keySet().stream().map(p->r.key+":"+p),r.effects.keySet().stream().map(p->r.key+":E:"+p))).collect(Collectors.toSet());check(a.seenSuffixes.equals(suffixes)&&a.seenDecisions.equals(decisions),file+" complete recipe");System.out.println(file+"\\t"+selected.size()+"\\t"+decisions.size()+"\\t"+suffixes.size());}}
  }}
 }
}
`);
  const helpers = path.join(temporary, 'helpers'), expected = path.join(temporary, 'expected'), stubs = path.join(funorbRepository, 'readable/funorb-stubs.jar');
  fs.mkdirSync(helpers); fs.mkdirSync(expected);
  run('javac', ['-d', helpers, path.join(temporary, 'GeobloxBodyPositions.java'), path.join(temporary, 'GuardedFrameTrees.java'), path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const facts = dir => rows(run('java', ['-cp', helpers, 'GeobloxBodyPositions', dir, stubs, 'fields']));
  const initial = facts(before), spans = initial.filter(r => r[0].endsWith('.java') && (!r[7] || r[7] === r[0].slice(0, -5))), maps = new Map(), selections = [];
  for (const entry of entries) {
    let text = fs.readFileSync(path.join(before, entry.path), 'utf8'), origins = Array.from({length: text.length}, (_, i) => i);
    for (const span of spans.filter(r => r[0] === entry.path).sort((a, b) => +b[1] - +a[1])) {
      const base = +span[1] + 1, end = +span[2] - 1; let body = text.slice(base, end);
      for (;;) {
        const r = foldGuardedFrameCompletion(body, {reservedNames: span[3].split(',').filter(Boolean), retainDiagnostics: true, effectfulGuards:true,alternateGuards:true,maximumExits:64,dominatingAssignments:true}); if (!r.framesRecovered) break;
        const d = r.diagnostics, position = n => {const v = origins[base + n]; assert.ok(Number.isInteger(v)); return v;}, range = r => ({start: position(r.start), end: position(r.end - 1) + 1});
        const selection = {file: entry.path, methodStart: +span[6], name: d.name, label: d.label, region: range(d.range), guards: d.guards.map(g => ({range: range(g.range), condition: range(g.conditionRange), jump: range(g.jumpRange), corridorKinds: g.corridorKinds,...(g.effectful?{effectful:true,prefix:range(g.prefixRange)}:{}),...(g.alternate?{alternate:true}:{})})), guardsAdded: d.suffixes.length, prefixAssignments: (d.prefixAssignments || []).map(p => ({name: p.name, declarationOffset: position(p.declarationOffset), assignmentOffset: position(p.assignmentOffset)})), dominatingAssignments: (d.dominatingAssignments || []).map(p => ({name:p.name,declarationOffset:position(p.declarationOffset),assignmentOffset:position(p.assignmentOffset)}))};
        let candidate = body;
        for (const e of d.edits) {
          let replacement = Array(e.text.length).fill(null);
          if (e.kind === 'decision') {const prefix = e.text.indexOf('!') + 1; replacement.splice(prefix, e.conditionRange.end - e.conditionRange.start, ...origins.slice(base + e.conditionRange.start, base + e.conditionRange.end));}
          if(e.kind==='effect-decision')replacement[replacement.length-1]=origins[base+e.end-1];
          assert.equal(replacement.length, e.text.length);
          origins = [...origins.slice(0, base + e.start), ...replacement, ...origins.slice(base + e.end)];
          candidate = candidate.slice(0, e.start) + e.text + candidate.slice(e.end);
        }
        assert.equal(candidate, r.source); body = r.source; selections.push(selection);
      }
      const changed=selections.some(s=>s.file===entry.path&&s.methodStart===+span[6]);
      if(changed){const f=reindentStructuredSource(body,{retainDiagnostics:true});if(f.linesReindented){const changes=new Map(f.diagnostics.edits.map(e=>[e.start,e])),seen=new Set(),edits=[];for(const t of tokenizeJava(body).tokens){if(t.kind==='eof')continue;const start=body.lastIndexOf('\n',t.range.startOffset-1)+1;if(seen.has(start))continue;seen.add(start);const old=body.slice(start,t.range.startOffset);assert.match(old,/^[ \t]*$/);const text='        '+(changes.get(start)?.text??old);if(text!==old)edits.push({start,end:t.range.startOffset,text});}let cursor=0;const texts=[],parts=[];for(const e of edits.sort((a,b)=>a.start-b.start)){texts.push(body.slice(cursor,e.start),e.text);parts.push(origins.slice(base+cursor,base+e.start),Array(e.text.length).fill(null));cursor=e.end;}texts.push(body.slice(cursor));parts.push(origins.slice(base+cursor,base+body.length));origins=[...origins.slice(0,base),...parts.flat(),...origins.slice(base+body.length)];body=texts.join('');}}
      text = text.slice(0, base) + body + text.slice(end);
    }
    // Final method rendering removes horizontal whitespace on empty lines.
    // These deletions affect no token or line ending; preserve all token origins.
    for(const match of [...text.matchAll(/^[ \t]+$/gm)].reverse()){const start=match.index,end=start+match[0].length;assert.ok(!tokenizeJava(text).tokens.some(t=>t.kind!=='eof'&&t.range.startOffset<end&&t.range.endOffset>start));text=text.slice(0,start)+text.slice(end);origins=[...origins.slice(0,start),...origins.slice(end)];}
    fs.writeFileSync(path.join(expected, entry.path), text); maps.set(entry.path, origins);
  }
  if (proof) assert.equal(selections.length, proof.framesRecovered);
  else assert.ok(selections.length > 0, 'preview must make structural progress');
  const list = path.join(temporary, 'sources.txt'); fs.writeFileSync(list, entries.map(e => e.path).join('\n') + '\n');
  const audit = dir => {const report = path.join(temporary, 'bindings.tsv'), classes = fs.mkdtempSync(path.join(temporary, 'classes-')); run('java', ['-cp', helpers, 'ReadableJava', dir, list, report, classes, stubs, '--class-name-literals', '--labels']); return rows(fs.readFileSync(report, 'utf8'));};
  const old = audit(before), after = audit(expected), positional = new Set(['D', 'R', 'T', 'B', 'N', 'S', 'U']);
  const originalPosition = (file, offset) => {const n = maps.get(file)[offset]; assert.ok(Number.isInteger(n), file + ':' + offset + ' original character'); return n;};
  const projected = r => [r[0], r[1], String(originalPosition(r[1], +r[2])), String(originalPosition(r[1], +r[3] - 1) + 1), ...r.slice(4)];
  for (const s of selections) {const t = old.filter(r => r[0] === 'T' && r[1] === s.file && +r[2] === s.region.start); assert.equal(t.length, 1); s.removedSymbol = t[0][4];}
  const removedSymbols = new Set(selections.map(s => s.removedSymbol)), declarations = new Map(old.filter(r => ['D', 'T'].includes(r[0]) && !removedSymbols.has(r[4])).map(r => [[r[1], r[2], r[3]].join(':'), r])), nextToOld = new Map(), oldToNext = new Map(), flags = [];
  for (const r of after.filter(r => ['D', 'T'].includes(r[0]))) {
    if (maps.get(r[1])[+r[2]] === null) {assert.equal(r[0], 'D'); assert.match(r[4], /^L:/); assert.match(r[5], /^decompiledFrameRemainder\d+$/); flags.push(r); continue;}
    const p = projected(r), o = declarations.get([r[1], p[2], p[3]].join(':')); assert.ok(o); assert.equal(r[0], o[0]); assert.equal(r[5], o[5]); assert.ok(!nextToOld.has(r[4]) && !oldToNext.has(o[4])); nextToOld.set(r[4], o[4]); oldToNext.set(o[4], r[4]);
  }
  assert.equal(nextToOld.size, declarations.size); assert.equal(flags.length, selections.length);
  for (const s of selections) {
    const owner = old.find(r => r[0] === 'D' && r[1] === s.file && r[4].startsWith('M:') && +r[2] >= s.methodStart && +r[2] < +spans.find(p => p[0] === s.file && +p[6] === s.methodStart)[1]); assert.ok(owner); s.method = owner[4];
    const f = flags.filter(r => r[1] === s.file && r[4].startsWith('L:' + s.method.slice(2) + '#') && r[5] === s.name); assert.equal(f.length, 1); s.symbol = f[0][4]; s.afterStart = fs.readFileSync(path.join(expected, s.file), 'utf8').lastIndexOf('{', +f[0][2]);
    assert.equal(old.filter(r => r[0] === 'B' && r[4] === s.removedSymbol).length, s.guards.length);
  }
  const flagSymbols = new Set(flags.map(r => r[4])), retained = [], added = [];
  for (const r of after.filter(r => positional.has(r[0]))) {if (maps.get(r[1])[+r[2]] === null) {assert.ok(['D', 'R'].includes(r[0]) && flagSymbols.has(r[4])); added.push(r);} else {const p = projected(r); p[4] = nextToOld.get(r[4]) || r[4]; retained.push(p);}}
  assert.deepEqual(ordered(retained), ordered(old.filter(r => positional.has(r[0]) && !removedSymbols.has(r[4])))); assert.deepEqual(after.filter(r => r[0] === 'O'), old.filter(r => r[0] === 'O'));
  for (const s of selections) {assert.equal(added.filter(r => r[4] === s.symbol && r[0] === 'D').length, 1); assert.equal(added.filter(r => r[4] === s.symbol && r[0] === 'R').length, s.guards.length + s.guardsAdded);}
  const removed = r => selections.some(s => s.file === r[1] && s.guards.some(g => +r[2] === g.jump.start && +r[3] === g.jump.end));
  const transfers = initial.filter(r => r[0] === 'Q'), nextTransfers = facts(expected).filter(r => r[0] === 'Q').map(r => {const scopes = (r[9] || '').split(',').filter(Boolean).map(s => {const [k, role, start] = s.split(':'); return [k, role, originalPosition(r[1], +start)].join(':');}).join(','); return ['Q', r[1], String(originalPosition(r[1], +r[2])), String(originalPosition(r[1], +r[3] - 1) + 1), ...r.slice(4, 7), String(originalPosition(r[1], +r[7])), String(originalPosition(r[1], +r[8] - 1) + 1), scopes];});
  assert.deepEqual(ordered(nextTransfers), ordered(transfers.filter(r => !removed(r))), 'all retained targets and protected scopes');
  for (const s of selections) for (const g of s.guards) {const q = transfers.filter(r => r[1] === s.file && +r[2] === g.jump.start); assert.equal(q.length, 1); assert.equal(q[0][4], 'BREAK'); assert.equal(q[0][5], s.label); assert.equal(+q[0][7], s.region.start); assert.equal(+q[0][8], s.region.end);}
  const markers = path.join(temporary, 'markers.tsv'); fs.writeFileSync(markers, selections.map(s => [s.file, s.region.start, s.afterStart, s.name, s.label, s.prefixAssignments.map(p => [p.name, p.declarationOffset, p.assignmentOffset].join(':')).join(','), s.dominatingAssignments.map(p=>[p.name,p.declarationOffset,p.assignmentOffset].join(':')).join(',')].join('\t')).join('\n') + '\n');
  const originsFile = path.join(temporary, 'origins.tsv'), originRows = [];
  for (const e of entries) {const offsets = new Set(tokenizeJava(fs.readFileSync(path.join(expected, e.path), 'utf8')).tokens.flatMap(t => [t.range.startOffset, t.range.endOffset - 1])); for (const n of offsets) if (maps.get(e.path)[n] !== null) originRows.push([e.path, n, maps.get(e.path)[n]].join('\t'));}
  fs.writeFileSync(originsFile, originRows.join('\n') + '\n');
  const recipes = rows(run('java', ['-Xmx768m', '-cp', helpers, 'GuardedFrameTrees', before, expected, stubs, markers, originsFile])); assert.equal(recipes.length, 303);
  // CFR compacts the newly introduced local-Boolean guards after frame
  // reconstruction. Verify that second stage independently against the
  // already certified intermediate tree, rather than accepting its recipe.
  const booleanFixture = path.join(workflowRoot, 'tests/test-geoblox-boolean-guards-source.mjs');
  if(proof)assert.equal(hash(fs.readFileSync(booleanFixture)),proof.booleanGuardFixtureSha256);
  const booleanTemplate=fs.readFileSync(booleanFixture,'utf8').match(/fs\.writeFileSync\(path\.join\(temporary,'BooleanGuardTrees\.java'\),(`\nimport java[\s\S]*?`\);)/);assert.ok(booleanTemplate);
  const booleanJava=new Function('return '+booleanTemplate[1].slice(0,-2))();const emptyMarker='for(String line:Files.readAllLines(Paths.get(args[2]))){String[]r=line.split';assert.ok(booleanJava.includes(emptyMarker));fs.writeFileSync(path.join(temporary,'BooleanGuardTrees.java'),booleanJava.replace(emptyMarker,'for(String line:Files.readAllLines(Paths.get(args[2]))){if(line.isEmpty())continue;String[]r=line.split'));
  run('javac',['-d',helpers,path.join(temporary,'BooleanGuardTrees.java')]);
  const compacted=path.join(temporary,'compacted');fs.mkdirSync(compacted);
  const compactMaps=new Map(),compactSelections=[];
  const compactSpans=facts(expected).filter(r=>r[0].endsWith('.java')&&(!r[7]||r[7]===r[0].slice(0,-5)));
  for(const entry of entries){
    let text=fs.readFileSync(path.join(expected,entry.path),'utf8'),origins=Array.from({length:text.length},(_,i)=>i);
    for(const span of compactSpans.filter(r=>r[0]===entry.path).sort((a,b)=>+b[1]-+a[1])){
      const base=+span[1]+1,end=+span[2]-1;let body=text.slice(base,end),changed=false;
      for(;;){const r=compactLocalBooleanGuards(body,{reservedNames:span[3].split(',').filter(Boolean),retainDiagnostics:true});if(!r.guardsCompacted)break;
        const d=r.diagnostics,position=n=>{const v=origins[base+n];assert.ok(Number.isInteger(v));return v;};
        compactSelections.push({file:entry.path,name:d.name,start:position(d.range.start),removedRead:{start:position(d.innerRead.start),end:position(d.innerRead.end-1)+1}});
        const replacement=d.segments.flatMap(s=>s.text===undefined?origins.slice(base+s.range.start,base+s.range.end):Array(s.text.length).fill(null));
        origins=[...origins.slice(0,base+d.range.start),...replacement,...origins.slice(base+d.range.end)];body=r.source;changed=true;
      }
      if(changed){const f=reindentStructuredSource(body,{retainDiagnostics:true}),changes=new Map((f.diagnostics?.edits||[]).map(e=>[e.start,e])),seen=new Set(),edits=[];
        for(const t of tokenizeJava(body).tokens){if(t.kind==='eof')continue;const start=body.lastIndexOf('\n',t.range.startOffset-1)+1;if(seen.has(start))continue;seen.add(start);const old=body.slice(start,t.range.startOffset);assert.match(old,/^[ \t]*$/);const text='        '+(changes.get(start)?.text??old);if(text!==old)edits.push({start,end:t.range.startOffset,text});}
        let cursor=0;const texts=[],parts=[];for(const e of edits.sort((a,b)=>a.start-b.start)){texts.push(body.slice(cursor,e.start),e.text);parts.push(origins.slice(base+cursor,base+e.start),Array(e.text.length).fill(null));cursor=e.end;}texts.push(body.slice(cursor));parts.push(origins.slice(base+cursor,base+body.length));origins=[...origins.slice(0,base),...parts.flat(),...origins.slice(base+body.length)];body=texts.join('');
      }
      text=text.slice(0,base)+body+text.slice(end);
    }
    for(const match of [...text.matchAll(/^[ \t]+$/gm)].reverse()){const start=match.index,end=start+match[0].length;assert.ok(!tokenizeJava(text).tokens.some(t=>t.kind!=='eof'&&t.range.startOffset<end&&t.range.endOffset>start));text=text.slice(0,start)+text.slice(end);origins=[...origins.slice(0,start),...origins.slice(end)];}
    fs.writeFileSync(path.join(compacted,entry.path),text);compactMaps.set(entry.path,origins);
  }
  const compactAfter=audit(compacted),compactPosition=(file,n)=>{const v=compactMaps.get(file)[n];assert.ok(Number.isInteger(v));return v;};
  const compactProject=r=>[r[0],r[1],String(compactPosition(r[1],+r[2])),String(compactPosition(r[1],+r[3]-1)+1),...r.slice(4)];
  const readRemoved=r=>compactSelections.some(s=>s.file===r[1]&&+r[2]===s.removedRead.start&&+r[3]===s.removedRead.end);
  assert.deepEqual(ordered(compactAfter.filter(r=>positional.has(r[0])).map(compactProject)),ordered(after.filter(r=>positional.has(r[0])&&!readRemoved(r))));
  assert.deepEqual(compactAfter.filter(r=>r[0]==='O'),after.filter(r=>r[0]==='O'));
  for(const s of compactSelections){const ref=after.filter(r=>r[0]==='R'&&r[1]===s.file&&+r[2]===s.removedRead.start&&+r[3]===s.removedRead.end);assert.equal(ref.length,1);assert.ok(flagSymbols.has(ref[0][4]));s.afterStart=compactMaps.get(s.file).indexOf(s.start);}
  const compactTransfers=facts(compacted).filter(r=>r[0]==='Q').map(r=>{const scopes=(r[9]||'').split(',').filter(Boolean).map(s=>{const[k,role,p]=s.split(':');return[k,role,compactPosition(r[1],+p)].join(':');}).join(',');return['Q',r[1],String(compactPosition(r[1],+r[2])),String(compactPosition(r[1],+r[3]-1)+1),...r.slice(4,7),String(compactPosition(r[1],+r[7])),String(compactPosition(r[1],+r[8]-1)+1),scopes];});
  assert.deepEqual(ordered(compactTransfers),ordered(facts(expected).filter(r=>r[0]==='Q')),'all targets and protected scopes after compaction');
  const compactMarkers=path.join(temporary,'compact-markers.tsv');fs.writeFileSync(compactMarkers,compactSelections.filter(s=>s.afterStart>=0).map(s=>[s.file,s.start,s.afterStart,s.name].join('\t')).join('\n')+'\n');
  const fingerprint=(dir,mode)=>rows(run('java',['-Xmx768m','-cp',helpers,'BooleanGuardTrees',dir,stubs,compactMarkers,mode]));
  assert.deepEqual(fingerprint(compacted,'after'),fingerprint(expected,'before'),'all independently attributed conditional stores and ordered original operations');
  const candidate = preview ? process.env.GEOBLOX_DOMINATING_FRAME_CANDIDATE_DIR : path.join(archive(funorbRepository, proof.sourceCommit, 'after', 'games/geoblox').directory, 'games/geoblox');
  if (candidate) for (const e of entries) assert.ok(fs.readFileSync(path.join(compacted, e.path)).equals(fs.readFileSync(path.join(candidate, e.path))), e.path + ' exact selected compiler bytes');
  if (preview && process.env.GEOBLOX_DOMINATING_FRAME_OUTPUT_DIR) {const output = process.env.GEOBLOX_DOMINATING_FRAME_OUTPUT_DIR; fs.mkdirSync(output, {recursive: true}); for (const e of entries) fs.copyFileSync(path.join(compacted, e.path), path.join(output, e.path));}
  const result = {files: 303, changedFiles: new Set(selections.map(s => s.file)).size, changedMethods: new Set(selections.map(s => s.method)).size, framesRecovered: selections.length, prefixAssignmentsCompared: selections.reduce((n, s) => n + s.prefixAssignments.length, 0), dominatingAssignmentsCompared: selections.reduce((n,s)=>n+s.dominatingAssignments.length,0), newDecisionLocals: flags.length, newFlagOccurrences: added.length-compactSelections.length, intermediateFlagOccurrences:added.length, redundantFlagReadsRemoved:compactSelections.length, removedLabelBindings: old.filter(r => r[0] === 'B' && removedSymbols.has(r[4])).length, bindingsBefore: old.filter(r => ['D', 'R'].includes(r[0])).length, bindingsAfter: compactAfter.filter(r => ['D', 'R'].includes(r[0])).length, transfersBefore: transfers.length, transfersAfter: nextTransfers.length, frameExitsConsumed: transfers.filter(removed).length, sourceTreeSha256: sourceIdentity(sourceInventory(compacted)), symbolMigrations: [...oldToNext].filter(([a, b]) => a !== b).map(([before, after]) => ({before, after})), selections};
  if (proof) {assert.equal(result.sourceTreeSha256, proof.sourceTreeSha256); assert.deepEqual(result.selections, proof.selections);}
  console.log(JSON.stringify(result));
} finally {fs.rmSync(temporary, {recursive: true, force: true});}
