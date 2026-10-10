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

// Independently attribute primitive local guards and their ordered conditional
// assignments. The assignment value replaces only its immediate local read.
// Check every other binding/transfer/scope, ordered Java operation and token.
const preview = process.argv.includes('--preview');
const javaTools = path.resolve(process.argv.slice(2).find(a => a !== '--preview') || '../java-tools');
const root = JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.crossLocalBooleanGuardCompaction;
assert.ok(preview || proof);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'geoblox-cross-guard-proof-'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const run = (c,a) => {try{return captureProcess(c,a,{maxBuffer:128*1024*1024}).stdout.toString();}catch(e){throw new Error(e.stderr?.toString()||e.message);}};
const rows = s => s.trim().split('\n').filter(Boolean).map(l=>l.split('\t'));
const ordered = a => a.map(v=>JSON.stringify(v)).sort();
try {
  function archive(repo,commit,name,subpath){const tar=path.join(temporary,name+'.tar'),directory=path.join(temporary,name);run('git',['-C',repo,'archive','--format=tar','--output='+tar,commit,...(subpath?[subpath]:[])]);fs.mkdirSync(directory);run('tar',['-xf',tar,'-C',directory]);return{directory,sha256:hash(fs.readFileSync(tar))};}
  const pin=JSON.parse(fs.readFileSync(path.join(workflowRoot,'tools/PIN.json')));
  assert.equal(hash(fs.readFileSync(path.join(workflowRoot,'tools/lib/ReadableJava.java'))),pin.files['lib/ReadableJava.java']);
  const tools=preview?{directory:javaTools}:archive(javaTools,proof.javaToolsCommit,'tools');
  if(proof){assert.equal(tools.sha256,proof.sourceArchiveSha256);assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))),proof.sourceProofTestSha256);}
  const before=preview?path.join(funorbRepository,'games/geoblox'):path.join(archive(funorbRepository,proof.previousSourceCommit,'before','games/geoblox').directory,'games/geoblox');
  const entries=sourceInventory(before);assert.equal(entries.length,303);if(proof)assert.equal(sourceIdentity(entries),proof.previousSourceTreeSha256);
  const require=createRequire(import.meta.url),{compactLocalBooleanGuards:compact,reindentStructuredSource:indent}=require(path.join(tools.directory,'src/decompiler/javaAstEmitter.js')),{tokenizeJava}=require(path.join(tools.directory,'src/java-frontend/lexer.js'));
  const fixture=path.join(workflowRoot,'tests/test-geoblox-guarded-abrupt-source.mjs');if(proof)assert.equal(hash(fs.readFileSync(fixture)),proof.bodyPositionFixtureSha256);
  const template=fs.readFileSync(fixture,'utf8').match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/);assert.ok(template);fs.writeFileSync(path.join(temporary,'GeobloxBodyPositions.java'),new Function('return '+template[1].slice(0,-2))());
  fs.writeFileSync(path.join(temporary,'BooleanGuardTrees.java'),`
import java.io.*;import java.nio.file.*;import java.nio.charset.*;import java.util.*;import java.util.stream.*;
import javax.tools.*;import javax.lang.model.element.*;import javax.lang.model.type.*;import com.sun.source.tree.*;import com.sun.source.util.*;
public class BooleanGuardTrees{
 static void check(boolean b,String s){if(!b)throw new AssertionError(s);}
 static Tree peel(Tree n){while(n instanceof ParenthesizedTree)n=((ParenthesizedTree)n).getExpression();return n;}
 static String fingerprint(CompilationUnitTree unit,Trees trees,Map<Long,String> markers,boolean after){
  StringBuilder out=new StringBuilder();SourcePositions positions=trees.getSourcePositions();
  new TreeScanner<Void,Void>(){
   void atom(Object v){String s=String.valueOf(v);out.append(s.length()).append(':').append(s);}
   Element element(Tree n){return trees.getElement(TreePath.getPath(unit,peel(n)));}
   boolean localBoolean(Tree n){Element e=element(n);return peel(n) instanceof IdentifierTree&&e!=null&&e.getKind()==ElementKind.LOCAL_VARIABLE&&e.asType().getKind()==TypeKind.BOOLEAN;}
   void conjuncts(Tree n,List<Tree> into){n=peel(n);if(n instanceof BinaryTree&&n.getKind()==Tree.Kind.CONDITIONAL_AND){BinaryTree b=(BinaryTree)n;conjuncts(b.getLeftOperand(),into);conjuncts(b.getRightOperand(),into);}else into.add(n);}
   @Override public Void scan(Tree n,Void unused){
    if(n==null){out.append("nil;");return null;}if(n instanceof ParenthesizedTree)return scan(((ParenthesizedTree)n).getExpression(),null);
    if(n instanceof IfTree){
     IfTree current=(IfTree)n;List<Tree> conditions=new ArrayList<>();conjuncts(current.getCondition(),conditions);Tree body=current.getThenStatement();
     if(current.getElseStatement()==null)while(body instanceof BlockTree){
      List<? extends StatementTree> statements=((BlockTree)body).getStatements();if(statements.size()!=2||!(statements.get(0) instanceof ExpressionStatementTree)||!(statements.get(1) instanceof IfTree))break;
      Tree first=peel(((ExpressionStatementTree)statements.get(0)).getExpression());IfTree inner=(IfTree)statements.get(1);if(!(first instanceof AssignmentTree)||inner.getElseStatement()!=null||!(inner.getThenStatement() instanceof BlockTree))break;
      AssignmentTree assignment=(AssignmentTree)first;if(!localBoolean(assignment.getVariable()))break;List<Tree> innerConditions=new ArrayList<>();conjuncts(inner.getCondition(),innerConditions);if(innerConditions.isEmpty()||!localBoolean(innerConditions.get(0))||!element(innerConditions.get(0)).equals(element(assignment.getVariable())))break;
      boolean valid=true;for(int i=1;i<innerConditions.size();i++){Tree child=peel(innerConditions.get(i));if(!(child instanceof AssignmentTree)||!localBoolean(((AssignmentTree)child).getVariable()))valid=false;}if(!valid)break;
      conditions.add(assignment);conditions.addAll(innerConditions.subList(1,innerConditions.size()));body=inner.getThenStatement();
     }
     out.append('(');atom(Tree.Kind.IF);atom(conditions.size());for(Tree condition:conditions){TypeMirror type=trees.getTypeMirror(TreePath.getPath(unit,condition));check(type.getKind()==TypeKind.BOOLEAN||type.toString().equals("java.lang.Boolean"),"Boolean control conversion");atom(type.toString());scan(condition,null);}scan(body,null);scan(current.getElseStatement(),null);out.append(')');return null;
    }
    out.append('(');atom(n.getKind());if(n instanceof IdentifierTree)atom(((IdentifierTree)n).getName());else if(n instanceof MemberSelectTree)atom(((MemberSelectTree)n).getIdentifier());else if(n instanceof LiteralTree){Object v=((LiteralTree)n).getValue();atom(v==null?null:v.getClass().getName());atom(v);}else if(n instanceof VariableTree)atom(((VariableTree)n).getName());else if(n instanceof MethodTree)atom(((MethodTree)n).getName());else if(n instanceof ClassTree)atom(((ClassTree)n).getSimpleName());else if(n instanceof LabeledStatementTree)atom(((LabeledStatementTree)n).getLabel());else if(n instanceof BreakTree)atom(((BreakTree)n).getLabel());else if(n instanceof ContinueTree)atom(((ContinueTree)n).getLabel());else if(n instanceof PrimitiveTypeTree)atom(((PrimitiveTypeTree)n).getPrimitiveTypeKind());else if(n instanceof ModifiersTree)atom(((ModifiersTree)n).getFlags().stream().map(Object::toString).sorted().collect(Collectors.joining(",")));else if(n instanceof BlockTree)atom(((BlockTree)n).isStatic());else if(n instanceof MemberReferenceTree){atom(((MemberReferenceTree)n).getMode());atom(((MemberReferenceTree)n).getName());}super.scan(n,unused);out.append(')');return null;
   }
  }.scan(unit,null);try{byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(out.toString().getBytes(StandardCharsets.UTF_8));StringBuilder h=new StringBuilder();for(byte v:digest)h.append(String.format("%02x",v&255));return h.toString();}catch(Exception e){throw new AssertionError(e);}
 }
 public static void main(String[]args)throws Exception{
  Map<String,Map<Long,String>> markers=new HashMap<>();for(String line:Files.readAllLines(Paths.get(args[2]))){String[]r=line.split("\\t");markers.computeIfAbsent(r[0],k->new HashMap<>()).put(Long.valueOf(r[args[3].equals("after")?2:1]),r[3]);}
  JavaCompiler c=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();try(StandardJavaFileManager fm=c.getStandardFileManager(errors,null,StandardCharsets.UTF_8);Stream<Path> paths=Files.list(Paths.get(args[0]))){List<File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());JavacTask task=(JavacTask)c.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-sourcepath","","-classpath",args[1]),null,fm.getJavaFileObjectsFromFiles(files));List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);task.analyze();for(Diagnostic<?> d:errors.getDiagnostics())if(d.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(d);Trees trees=Trees.instance(task);for(CompilationUnitTree unit:units){String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();System.out.println(file+"\\t"+fingerprint(unit,trees,markers.getOrDefault(file,Collections.emptyMap()),args[3].equals("after")));}}
 }
}
`);
  const helpers=path.join(temporary,'helpers'),expected=path.join(temporary,'expected'),stubs=path.join(funorbRepository,'readable/funorb-stubs.jar');fs.mkdirSync(helpers);fs.mkdirSync(expected);
  run('javac',['-d',helpers,path.join(temporary,'GeobloxBodyPositions.java'),path.join(temporary,'BooleanGuardTrees.java'),path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
  const facts=dir=>rows(run('java',['-cp',helpers,'GeobloxBodyPositions',dir,stubs,'fields'])),initial=facts(before),spans=initial.filter(r=>r[0].endsWith('.java')&&(!r[7]||r[7]===r[0].slice(0,-5))),maps=new Map(),selections=[];
  let linesReindented=0,formattedBodies=0;
  for(const entry of entries){let text=fs.readFileSync(path.join(before,entry.path),'utf8'),origins=Array.from({length:text.length},(_,i)=>i);
    for(const span of spans.filter(r=>r[0]===entry.path).sort((a,b)=>+b[1]-+a[1])){const base=+span[1]+1,end=+span[2]-1;let body=text.slice(base,end),changed=false;
      for(;;){const r=compact(body,{reservedNames:span[3].split(',').filter(Boolean),retainDiagnostics:true,crossLocalAssignments:true});if(!r.guardsCompacted)break;const d=r.diagnostics,p=n=>{const v=origins[base+n];assert.ok(Number.isInteger(v));return v;},range=r=>({start:p(r.start),end:p(r.end-1)+1});selections.push({file:entry.path,methodStart:+span[6],name:d.name,region:range(d.range),removedRead:range(d.innerRead),assignment:range(d.assignmentRange),body:range(d.bodyRange),assignmentConditions:d.assignmentConditions});const replacement=d.segments.flatMap(s=>s.text===undefined?origins.slice(base+s.range.start,base+s.range.end):Array(s.text.length).fill(null));origins=[...origins.slice(0,base+d.range.start),...replacement,...origins.slice(base+d.range.end)];body=r.source;changed=true;}
      const formatted=indent(body,{retainDiagnostics:true});if(changed&&formatted.linesReindented){
        const originalBody=body,tokenValues=s=>tokenizeJava(s).tokens.map(t=>[t.kind,t.text]);
        assert.deepEqual(tokenValues(formatted.source),tokenValues(body));assert.equal(formatted.source.split('\n').length,body.split('\n').length);
        // Replay CFR's outer method/class indentation together with its
        // horizontal-whitespace edits. Fuse the edits before copying origins.
        const changedPrefixes=new Map(formatted.diagnostics.edits.map(e=>[e.start,e])),seen=new Set(),edits=[];
        for(const t of tokenizeJava(body).tokens){if(t.kind==='eof')continue;const begin=body.lastIndexOf('\n',t.range.startOffset-1)+1;if(seen.has(begin))continue;seen.add(begin);const old=body.slice(begin,t.range.startOffset);assert.match(old,/^[ \t]*$/);const relative=changedPrefixes.get(begin)?.text??old,text='        '+relative;if(text!==old)edits.push({start:begin,end:t.range.startOffset,text});}
        let cursor=0;const textChunks=[],originChunks=[];
        for(const e of edits.sort((a,b)=>a.start-b.start)){textChunks.push(body.slice(cursor,e.start),e.text);originChunks.push(origins.slice(base+cursor,base+e.start),Array(e.text.length).fill(null));cursor=e.end;}
        textChunks.push(body.slice(cursor));originChunks.push(origins.slice(base+cursor,base+body.length));const next=textChunks.join('');origins=[...origins.slice(0,base),...originChunks.flat(),...origins.slice(base+body.length)];body=next;
        assert.deepEqual(tokenValues(body),tokenValues(originalBody));assert.equal(body.split('\n').length,originalBody.split('\n').length);linesReindented+=edits.length;if(edits.length)formattedBodies++;
      }
      text=text.slice(0,base)+body+text.slice(end);
    }fs.writeFileSync(path.join(expected,entry.path),text);maps.set(entry.path,origins);
  }
  const candidate=preview?process.env.GEOBLOX_CROSS_GUARD_CANDIDATE_DIR:path.join(archive(funorbRepository,proof.sourceCommit,'after','games/geoblox').directory,'games/geoblox');
  // Formatting follows the real compiler. Permit only horizontal/line trivia;
  // every independently reconstructed token remains in the same order. Rebuild
  // origins before all javac binding, AST and protected-transfer comparisons.
  if(candidate)for(const entry of entries){const file=entry.path,a=fs.readFileSync(path.join(expected,file),'utf8'),b=fs.readFileSync(path.join(candidate,file),'utf8');if(a===b)continue;
    const left=tokenizeJava(a).tokens.filter(t=>t.kind!=='eof'),right=tokenizeJava(b).tokens.filter(t=>t.kind!=='eof');assert.deepEqual(left.map(t=>[t.kind,t.text]),right.map(t=>[t.kind,t.text]),file+' exact independently reconstructed tokens');
    const projected=Array(b.length).fill(null),oldMap=maps.get(file);let oldEnd=0,newEnd=0;
    for(let i=0;i<left.length;i++){const x=left[i],y=right[i],gap=a.slice(oldEnd,x.range.startOffset),nextGap=b.slice(newEnd,y.range.startOffset);assert.ok(gap===nextGap||/^\s*$/.test(gap)&&/^\s*$/.test(nextGap),file+' only whitespace gaps may change');for(let j=0;j<x.text.length;j++)projected[y.range.startOffset+j]=oldMap[x.range.startOffset+j];oldEnd=x.range.endOffset;newEnd=y.range.endOffset;}
    assert.ok(a.slice(oldEnd)===b.slice(newEnd)||/^\s*$/.test(a.slice(oldEnd))&&/^\s*$/.test(b.slice(newEnd)));maps.set(file,projected);fs.writeFileSync(path.join(expected,file),b);
  }
  assert.ok(selections.length>0&&linesReindented>0);
  const list=path.join(temporary,'sources.txt');fs.writeFileSync(list,entries.map(e=>e.path).join('\n')+'\n');const audit=dir=>{const report=path.join(temporary,'bindings.tsv'),classes=fs.mkdtempSync(path.join(temporary,'classes-'));run('java',['-cp',helpers,'ReadableJava',dir,list,report,classes,stubs,'--class-name-literals','--labels']);return rows(fs.readFileSync(report,'utf8'));};
  const old=audit(before),after=audit(expected),originalPosition=(file,offset)=>{const n=maps.get(file)[offset];assert.ok(Number.isInteger(n),file+':'+offset+' original token');return n;},project=r=>[r[0],r[1],String(originalPosition(r[1],+r[2])),String(originalPosition(r[1],+r[3]-1)+1),...r.slice(4)],removed=r=>selections.some(s=>s.file===r[1]&&+r[2]===s.removedRead.start&&+r[3]===s.removedRead.end);
  const positional=new Set(['D','R','T','B','N','S','U']);assert.deepEqual(ordered(after.filter(r=>positional.has(r[0])).map(project)),ordered(old.filter(r=>positional.has(r[0])&&!removed(r))));assert.deepEqual(after.filter(r=>r[0]==='O'),old.filter(r=>r[0]==='O'));
  for(const s of selections){const r=old.filter(r=>r[0]==='R'&&r[1]===s.file&&+r[2]===s.removedRead.start&&+r[3]===s.removedRead.end);assert.equal(r.length,1);assert.match(r[0][4],/^L:/);s.symbol=r[0][4];s.afterStart=maps.get(s.file).indexOf(s.region.start);}
  const transfers=initial.filter(r=>r[0]==='Q'),nextTransfers=facts(expected).filter(r=>r[0]==='Q').map(r=>{const scopes=(r[9]||'').split(',').filter(Boolean).map(s=>{const[k,role,p]=s.split(':');return[k,role,originalPosition(r[1],+p)].join(':');}).join(',');return['Q',r[1],String(originalPosition(r[1],+r[2])),String(originalPosition(r[1],+r[3]-1)+1),...r.slice(4,7),String(originalPosition(r[1],+r[7])),String(originalPosition(r[1],+r[8]-1)+1),scopes];});assert.deepEqual(ordered(nextTransfers),ordered(transfers),'every transfer target and protected scope');
  const active=selections.filter(s=>s.afterStart>=0),markers=path.join(temporary,'markers.tsv');fs.writeFileSync(markers,active.map(s=>[s.file,s.region.start,s.afterStart,s.name].join('\t')).join('\n')+'\n');const fingerprint=(dir,mode)=>rows(run('java',['-Xmx768m','-cp',helpers,'BooleanGuardTrees',dir,stubs,markers,mode]));assert.deepEqual(fingerprint(expected,'after'),fingerprint(before,'before'),'all independently attributed conditional stores and other ordered operations');
  if(preview&&process.env.GEOBLOX_CROSS_GUARD_OUTPUT_DIR){fs.mkdirSync(process.env.GEOBLOX_CROSS_GUARD_OUTPUT_DIR,{recursive:true});for(const e of entries)fs.copyFileSync(path.join(expected,e.path),path.join(process.env.GEOBLOX_CROSS_GUARD_OUTPUT_DIR,e.path));}
  if(candidate)for(const e of entries)assert.ok(fs.readFileSync(path.join(expected,e.path)).equals(fs.readFileSync(path.join(candidate,e.path))),e.path+' exact compiler source');
  const changedFiles=entries.filter(e=>!fs.readFileSync(path.join(before,e.path)).equals(fs.readFileSync(path.join(expected,e.path)))).length,result={files:303,changedFiles,guardsCompacted:selections.length,remainingCompoundGuards:active.length,redundantLocalReadsRemoved:selections.length,linesReindented,formattedBodies,bindingsBefore:old.filter(r=>['D','R'].includes(r[0])).length,bindingsAfter:after.filter(r=>['D','R'].includes(r[0])).length,transfersCompared:nextTransfers.length,sourceTreeSha256:sourceIdentity(sourceInventory(expected)),selections};
  if(proof){assert.equal(result.sourceTreeSha256,proof.sourceTreeSha256);assert.deepEqual(result.selections,proof.selections);}console.log(JSON.stringify(result));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
