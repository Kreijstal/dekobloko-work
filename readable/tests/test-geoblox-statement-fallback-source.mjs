import {funorbRepository as repository, workflowRoot} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

// Certify every intermediate syntax tree with javac, rather than treating
// topology created by a previous rewrite as an assumption about the raw input.
const javaTools=path.resolve(process.argv[2] || '../java-tools');
const preview=process.argv.includes('--preview');
const root=JSON.parse(fs.readFileSync(path.join(repository,'decompilation/geoblox-provenance.json')));
const proof=preview?null:root.sharedStatementFallbackRecovery;
assert.ok(preview || proof, 'current statement-continuation proof is required');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'geoblox-statement-proof-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(cmd,args)=>captureProcess(cmd,args,{maxBuffer:128*1024*1024}).stdout.toString();
const git=(repo,...args)=>run('git',['-C',repo,...args]).trim();
const rows=text=>text.trim().split('\n').filter(Boolean).map(l=>l.split('\t'));
try {
  function archive(repo,commit,name,subpath) {
    const tar=path.join(temporary,name+'.tar'),directory=path.join(temporary,name);
    git(repo,'archive','--format=tar','--output='+tar,commit,...(subpath?[subpath]:[]));
    fs.mkdirSync(directory);run('tar',['-xf',tar,'-C',directory]);
    return {directory,sha256:hash(fs.readFileSync(tar))};
  }
  if(proof)assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))),proof.sourceProofTestSha256);
  const tools=preview?{directory:javaTools}:archive(javaTools,proof.javaToolsCommit,'tools');
  if(proof)assert.equal(tools.sha256,proof.sourceArchiveSha256);
  const before=preview?path.join(repository,'games/geoblox'):path.join(archive(repository,proof.previousSourceCommit,'before','games/geoblox').directory,'games/geoblox');
  const entries=sourceInventory(before);assert.equal(entries.length,303);
  if(proof)assert.equal(sourceIdentity(entries),proof.previousSourceTreeSha256);
  const require=createRequire(import.meta.url),{foldSharedStatementFallbacks:fold}=require(path.join(tools.directory,'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava}=require(path.join(tools.directory,'src/java-frontend/lexer.js'));
  const lex=s=>{const r=tokenizeJava(s);assert.equal(r.diagnostics.length,0);return r.tokens.filter(t=>!['whitespace','eof'].includes(t.kind));};
  const auxiliary=path.join(workflowRoot,'tests/test-geoblox-guarded-abrupt-source.mjs'),auxiliarySource=fs.readFileSync(auxiliary,'utf8');
  if(proof)assert.equal(hash(fs.readFileSync(auxiliary)),proof.bodyPositionFixtureSha256);
  const template=auxiliarySource.match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/);assert.ok(template);
  fs.writeFileSync(path.join(temporary,'GeobloxBodyPositions.java'),new Function('return '+template[1].slice(0,-2))());
  fs.writeFileSync(path.join(temporary,'StatementBodyProof.java'),`import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.*;
public final class StatementBodyProof {
  static long start(CompilationUnitTree u,SourcePositions p,Tree t){return p.getStartPosition(u,t);}
  static long end(CompilationUnitTree u,SourcePositions p,Tree t){return p.getEndPosition(u,t);}
  static boolean supported(StatementTree s,int[] n,int depth){
    if(++n[0]>24||depth>4)return false;
    if(s instanceof BlockTree){List<? extends StatementTree> ss=((BlockTree)s).getStatements();return !ss.isEmpty()&&ss.stream().allMatch(t->supported(t,n,depth+1));}
    if(s instanceof IfTree){IfTree t=(IfTree)s;return ++n[2]<=4&&supported(t.getThenStatement(),n,depth+1)&&(t.getElseStatement()==null||supported(t.getElseStatement(),n,depth+1));}
    if(!(s instanceof ExpressionStatementTree)||++n[1]>8)return false;
    ExpressionTree e=((ExpressionStatementTree)s).getExpression();
    return e instanceof AssignmentTree||e instanceof CompoundAssignmentTree||e instanceof MethodInvocationTree||e instanceof NewClassTree||Arrays.asList(Tree.Kind.PREFIX_INCREMENT,Tree.Kind.PREFIX_DECREMENT,Tree.Kind.POSTFIX_INCREMENT,Tree.Kind.POSTFIX_DECREMENT).contains(e.getKind());
  }
  public static void main(String[]args)throws Exception{
    JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
    try(StandardJavaFileManager manager=compiler.getStandardFileManager(null,null,StandardCharsets.UTF_8);Stream<Path> paths=Files.list(Paths.get(args[0]))){
      List<java.io.File> files=paths.filter(f->f.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());
      JavacTask task=(JavacTask)compiler.getTask(null,manager,diagnostics,Arrays.asList("-proc:none","-source","8"),null,manager.getJavaFileObjectsFromFiles(files));
      Trees trees=Trees.instance(task);SourcePositions positions=trees.getSourcePositions();
      for(CompilationUnitTree unit:task.parse())new TreePathScanner<Void,Void>(){
        @Override public Void visitMethod(MethodTree method,Void ignored){
          final boolean[] invalid={false};new TreeScanner<Void,Void>(){
            @Override public Void visitClass(ClassTree t,Void u){invalid[0]=true;return null;}
            @Override public Void visitLambdaExpression(LambdaExpressionTree t,Void u){invalid[0]=true;return null;}
            @Override public Void visitMemberReference(MemberReferenceTree t,Void u){invalid[0]=true;return null;}
            @Override public Void visitNewClass(NewClassTree t,Void u){if(t.getClassBody()!=null)invalid[0]=true;return super.visitNewClass(t,u);}
          }.scan(method.getBody(),null);if(invalid[0])return null;return super.visitMethod(method,ignored);
        }
        @Override public Void visitLabeledStatement(LabeledStatementTree frame,Void ignored){
          if(!(frame.getStatement() instanceof BlockTree))return super.visitLabeledStatement(frame,ignored);
          TreePath framePath=getCurrentPath();final int[] refs={0};final boolean[] invalid={false};
          new TreePathScanner<Void,Void>(){
            @Override public Void visitBreak(BreakTree t,Void u){if(GeobloxBodyPositions.transferTarget(getCurrentPath())==frame)refs[0]++;return super.visitBreak(t,u);}
            @Override public Void visitContinue(ContinueTree t,Void u){if(GeobloxBodyPositions.transferTarget(getCurrentPath())==frame)invalid[0]=true;return super.visitContinue(t,u);}
          }.scan(framePath,null);if(refs[0]==0||refs[0]>128||invalid[0])return super.visitLabeledStatement(frame,ignored);
          new TreePathScanner<Void,Void>(){
            @Override public Void visitBlock(BlockTree block,Void u){
              List<String> corridor=new ArrayList<>();Tree current=block;boolean terminal=true;
              for(TreePath parent=getCurrentPath().getParentPath();current!=frame.getStatement();parent=parent.getParentPath()){
                if(parent==null){terminal=false;break;}Tree owner=parent.getLeaf();
                if(owner instanceof BlockTree){List<? extends StatementTree> ss=((BlockTree)owner).getStatements();terminal=!ss.isEmpty()&&ss.get(ss.size()-1)==current;}
                else if(owner instanceof IfTree)terminal=((IfTree)owner).getThenStatement()==current||((IfTree)owner).getElseStatement()==current;
                else if(owner instanceof LabeledStatementTree)terminal=((LabeledStatementTree)owner).getStatement()==current;
                else terminal=false;if(!terminal)break;corridor.add(owner.getKind().toString());current=owner;
              }
              List<? extends StatementTree> ss=block.getStatements();
              if(terminal)for(int i=0;i<ss.size()-1;i++){
                if(!(ss.get(i) instanceof IfTree))continue;IfTree branch=(IfTree)ss.get(i);
                if(branch.getElseStatement()!=null||!(branch.getThenStatement() instanceof BlockTree))continue;
                List<? extends StatementTree> suffix=ss.subList(i+1,ss.size()),arm=((BlockTree)branch.getThenStatement()).getStatements();int[] n={0,0,0};
                if(suffix.size()>8||!suffix.stream().allMatch(s->supported(s,n,0))||arm.size()<2||!(arm.get(arm.size()-1) instanceof IfTree)||arm.subList(0,arm.size()-1).stream().anyMatch(s->s instanceof VariableTree||s instanceof ClassTree))continue;
                IfTree guard=(IfTree)arm.get(arm.size()-1);StatementTree jump=guard.getThenStatement();
                if(jump instanceof BlockTree){List<? extends StatementTree> exits=((BlockTree)jump).getStatements();jump=exits.size()==1?exits.get(0):null;}
                if(guard.getElseStatement()!=null||!(jump instanceof BreakTree)||GeobloxBodyPositions.transferTarget(TreePath.getPath(unit,jump))!=frame)continue;
                boolean scope=refs[0]>1||!(framePath.getParentPath().getLeaf() instanceof BlockTree)||((BlockTree)frame.getStatement()).getStatements().stream().anyMatch(s->s instanceof VariableTree||s instanceof ClassTree);
                String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();
                System.out.println(String.join("\\t",file,""+start(unit,positions,frame),""+end(unit,positions,frame),""+start(unit,positions,block),""+end(unit,positions,block),""+start(unit,positions,branch),""+end(unit,positions,branch),""+start(unit,positions,branch.getCondition()),""+end(unit,positions,branch.getCondition()),""+start(unit,positions,guard.getCondition()),""+end(unit,positions,guard.getCondition()),""+start(unit,positions,jump),""+end(unit,positions,jump),""+start(unit,positions,suffix.get(0)),""+end(unit,positions,suffix.get(suffix.size()-1)),""+(arm.size()-1),frame.getLabel().toString(),""+scope,""+refs[0],String.join(",",corridor),""+suffix.size(),""+n[1],""+n[2]));
              }
              return super.visitBlock(block,u);
            }
          }.scan(framePath,null);return super.visitLabeledStatement(frame,ignored);
        }
      }.scan(unit,null);
      if(diagnostics.getDiagnostics().stream().anyMatch(d->d.getKind()==Diagnostic.Kind.ERROR))throw new AssertionError(diagnostics.getDiagnostics());
    }
  }
}
`);
  const helpers=path.join(temporary,'helpers'),stubs=path.join(repository,'readable/funorb-stubs.jar');fs.mkdirSync(helpers);
  const pin=JSON.parse(fs.readFileSync(path.join(workflowRoot,'tools/PIN.json')));assert.equal(hash(fs.readFileSync(path.join(workflowRoot,'tools/lib/ReadableJava.java'))),pin.files['lib/ReadableJava.java']);
  run('javac',['-d',helpers,path.join(temporary,'GeobloxBodyPositions.java'),path.join(temporary,'StatementBodyProof.java'),path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
  const positions=rows(run('java',['-cp',helpers,'GeobloxBodyPositions',before,stubs,'shared-fallbacks']));
  const spans=positions.filter(r=>r[0].endsWith('.java')&&(!r[7]||r[7]===r[0].slice(0,-5)));
  const expected=path.join(temporary,'expected'),stages=path.join(temporary,'stages');fs.mkdirSync(expected);fs.mkdirSync(stages);
  const edits=new Map(),snapshots=[],methods=[];let ordinal=0;
  for(const r of spans){
    const original=fs.readFileSync(path.join(before,r[0]),'utf8'),start=+r[1]+1,end=+r[2]-1;let source=original.slice(start,end),mapped=lex(source).map(t=>({text:t.text,origin:start+t.range.startOffset,end:start+t.range.endOffset})),count=0,retired=0,copies=0;
    for(;;){const result=fold(source,{retainDiagnostics:true});if(!result.guardsRecovered)break;const d=result.diagnostics,oldTokens=lex(source),prefix='class Check {void method(){',stage='Stage'+ordinal+++'.java';
      fs.writeFileSync(path.join(stages,stage),prefix+source+'}}');
      const slice=range=>oldTokens.flatMap((t,i)=>t.range.startOffset>=range.start&&t.range.endOffset<=range.end?[{token:t,mapped:mapped[i]}]:[]);
      const origin=offset=>{const i=oldTokens.findIndex(t=>t.range.startOffset===offset);assert.ok(i>=0);assert.notEqual(mapped[i].origin,null);return mapped[i].origin;};
      const jumpOrigin=origin(d.jumpRange.start),frameOrigin=origin(d.range.start);
      const retained=slice(d.fallbackRange),allowedCopies=new Set(retained.map(x=>x.mapped.copyOf??x.mapped.origin).filter(x=>x!==null));
      const q=positions.find(p=>p[0]==='Q'&&p[1]===r[0]&&+p[2]===jumpOrigin);assert.ok(q);assert.deepEqual(q.slice(4,8),['BREAK',d.label,'LABELED_STATEMENT',String(frameOrigin)]);
      snapshots.push({stage,prefix:prefix.length,file:r[0],d,result,jumpOrigin,frameOrigin,allowedCopies});
      let bytes='',rebuilt=[],copiesInRewrite=0;
      for(const segment of d.segments){
        if(segment.text!==undefined){const generated=lex(segment.text);assert.ok(generated.every(t=>['if','else','!','(',')','{','}'].includes(t.text)));bytes+=segment.text;rebuilt.push(...generated.map(t=>({text:t.text,origin:null})));continue;}
        assert.ok(segment.range.start>=d.range.start&&segment.range.end<=d.range.end);
        if(segment.copy){assert.deepEqual(segment.range,d.fallbackRange);copiesInRewrite++;}
        bytes+=source.slice(segment.range.start,segment.range.end).replace(/\n([ \t]*)(?=\S)/g,(_,indent)=>'\n'+' '.repeat(segment.indent||0)+indent);
        for(const {mapped:original} of slice(segment.range)){const item={...original};if(segment.copy){if((item.copyOf??item.origin)!==null)item.copyOf=item.copyOf??item.origin;item.origin=null;}rebuilt.push(item);}
      }
      assert.equal(copiesInRewrite,1);assert.equal(d.segments.filter(s=>s.range?.start===d.fallbackRange.start&&s.range?.end===d.fallbackRange.end&&!s.copy).length,1);
      if(d.dedent)bytes=bytes.split('\n').map((line,i)=>i&&line.startsWith(d.dedent.indent)?line.slice(d.dedent.delta):line).join('\n');if(d.trimEnd)bytes=bytes.trimEnd();
      assert.equal(result.source,source.slice(0,d.range.start)+bytes+source.slice(d.range.end));
      mapped=[...slice({start:0,end:d.range.start}).map(x=>x.mapped),...rebuilt,...slice({start:d.range.end,end:source.length}).map(x=>x.mapped)];assert.deepEqual(mapped.map(t=>t.text),lex(result.source).map(t=>t.text));
      source=result.source;count++;retired+=result.labelsRemoved;copies+=result.fallbackIdentifierCopiesAdded;
    }
    if(count){const list=edits.get(r[0])||[];list.push({start,end,source,mapped});edits.set(r[0],list);methods.push({file:r[0],start:+r[1],methodStart:+r[6],shared:count,retained:count-retired,labels:retired,identifiers:copies});}
  }
  assert.ok(snapshots.length>0);
  const certified=rows(run('java',['-cp',helpers,'StatementBodyProof',stages]));
  for(const s of snapshots){const fact=certified.find(r=>r[0]===s.stage&&+r[11]===s.d.jumpRange.start+s.prefix);assert.ok(fact,'javac certifies each current intermediate continuation independently');
    for(const [range,i] of [[s.d.range,1],[s.d.containerRange,3],[s.d.branchRange,5],[s.d.conditionRange,7],[s.d.guardRange,9],[s.d.jumpRange,11],[s.d.fallbackRange,13]])assert.deepEqual([range.start+s.prefix,range.end+s.prefix],[+fact[i],+fact[i+1]]);
    assert.equal(s.d.prefixStatements,+fact[15]);assert.equal(s.d.label,fact[16]);assert.equal(String(s.d.frameScopeRetained),fact[17]);assert.equal(s.d.labelRetained,+fact[18]>1);
    const kinds={IfStatement:'IF',BlockStatement:'BLOCK',LabeledStatement:'LABELED_STATEMENT'};assert.equal(s.d.corridorKinds.map(k=>kinds[k]).join(','),fact[19]);assert.equal(s.d.fallbackStatements,+fact[20]);assert.equal(s.d.fallbackLeaves,+fact[21]);assert.equal(s.d.fallbackConditions,+fact[22]);
  }
  const locations=new Map(),copied=new Map();
  for(const entry of entries){const original=fs.readFileSync(path.join(before,entry.path),'utf8'),changes=(edits.get(entry.path)||[]).sort((a,b)=>a.start-b.start);let source='',mapped=[],cursor=0;
    const retain=(a,b)=>lex(original.slice(a,b)).map(t=>({text:t.text,origin:a+t.range.startOffset,end:a+t.range.endOffset}));
    for(const e of changes){source+=original.slice(cursor,e.start)+e.source;mapped.push(...retain(cursor,e.start),...e.mapped);cursor=e.end;}
    source+=original.slice(cursor);mapped.push(...retain(cursor,original.length));fs.writeFileSync(path.join(expected,entry.path),source);const tokens=lex(source);assert.deepEqual(mapped.map(t=>t.text),tokens.map(t=>t.text));
    const offsets=new Map(),copies=[];mapped.forEach((t,i)=>{if(t.origin!==null){offsets.set(t.origin,tokens[i].range.startOffset);offsets.set(t.end-1,tokens[i].range.endOffset-1);}if(t.copyOf!==undefined)copies.push({origin:t.copyOf,start:tokens[i].range.startOffset,end:tokens[i].range.endOffset,text:t.text});});locations.set(entry.path,offsets);copied.set(entry.path,copies);
  }
  const files=path.join(temporary,'files.txt');fs.writeFileSync(files,entries.map(e=>e.path).join('\n')+'\n');
  const audit=(directory,name)=>{const output=path.join(temporary,name+'.tsv'),classes=path.join(temporary,name+'-classes');fs.mkdirSync(classes);run('java',['-cp',helpers,'ReadableJava',directory,files,output,classes,stubs,'--labels']);return rows(fs.readFileSync(output,'utf8'));};
  const old=audit(before,'old'),next=audit(expected,'next');
  const transfer=rows(run('java',['-cp',helpers,'GeobloxBodyPositions',expected,stubs,'shared-fallbacks'])).filter(r=>r[0]==='Q');
  const mappedRange=(file,a,b)=>{if(!edits.has(file))return[+a,+b];const map=locations.get(file);assert.ok(map.has(+a),file+' original start remains');assert.ok(map.has(+b-1),file+' original end remains');return[map.get(+a),map.get(+b-1)+1];};
  for(const kind of ['D','R']){
    const records=old.filter(r=>r[0]===kind),want=records.map(r=>{const p=mappedRange(r[1],r[2],r[3]);return[r[0],r[1],...p,r[4],r[5]];});
    if(kind==='R')for(const [file,copies]of copied)for(const copy of copies){const record=records.find(r=>r[1]===file&&+r[2]===copy.origin);if(!record)continue;assert.ok(snapshots.some(s=>s.file===file&&s.allowedCopies.has(copy.origin)));assert.equal(record[5],copy.text);want.push(['R',file,copy.start,copy.end,record[4],record[5]]);}
    const sort=rr=>rr.sort((a,b)=>a[1].localeCompare(b[1])||+a[2]-+b[2]||a[4].localeCompare(b[4]));assert.deepEqual(sort(next.filter(r=>r[0]===kind)),sort(want.map(r=>r.map(String))),kind+' every original and copied Java binding');
  }
  assert.deepEqual(next.filter(r=>r[0]==='O'),old.filter(r=>r[0]==='O'));
  const labelMap=new Map(),retired=new Set(snapshots.filter(s=>s.result.labelsRemoved).map(s=>s.file+':'+s.frameOrigin));
  for(const r of old.filter(r=>r[0]==='T')){if(retired.has(r[1]+':'+r[2]))continue;const [start]=mappedRange(r[1],r[2],r[3]),n=next.find(n=>n[0]==='T'&&n[1]===r[1]&&+n[2]===start);assert.ok(n);assert.equal(n[5],r[5]);labelMap.set(r[4],n[4]);}
  const consumed=new Set(snapshots.map(s=>s.file+':'+s.jumpOrigin));
  const consumedRanges=positions.filter(r=>r[0]==='Q'&&consumed.has(r[1]+':'+r[2]));
  const expectedLabels=old.filter(r=>['T','B','N'].includes(r[0])&&!retired.has(r[1]+':'+r[2])&&!consumedRanges.some(q=>q[1]===r[1]&&+r[2]>=+q[2]&&+r[3]<=+q[3])).map(r=>[''+r[0],r[1],...mappedRange(r[1],r[2],r[3]).map(String),labelMap.get(r[4]),r[5]]);
  assert.deepEqual(next.filter(r=>['T','B','N'].includes(r[0])),expectedLabels,'all surviving lexical label tokens and identities');
  const targetMap=q=>{const [targetStart,targetEnd]=mappedRange(q[1],q[7],q[8]);const scopes=q[9]?q[9].split(',').map(s=>{const [kind,role,at]=s.split(':');const position=edits.has(q[1])?locations.get(q[1]).get(+at):+at;assert.notEqual(position,undefined);return [kind,role,position].join(':');}).join(','):'';return['Q',q[1],...mappedRange(q[1],q[2],q[3]).map(String),...q.slice(4,7),String(targetStart),String(targetEnd),scopes];};
  assert.deepEqual(transfer,positions.filter(r=>r[0]==='Q'&&!consumed.has(r[1]+':'+r[2])).map(targetMap),'every surviving transfer destination and protected scope');
  const result={files:303,changedFiles:edits.size,changedMethods:methods.length,sharedFallbacks:snapshots.length,fallbackStatementSitesAdded:snapshots.reduce((n,s)=>n+s.result.fallbackStatementSitesAdded,0),fallbackConditionsAdded:snapshots.reduce((n,s)=>n+s.result.fallbackConditionsAdded,0),labelsRemoved:retired.size,sourceReferencesAdded:next.filter(r=>r[0]==='R').length-old.filter(r=>r[0]==='R').length,independentlyCertifiedIntermediateTrees:snapshots.length,allOriginalAndCopiedBindingsPreserved:true,allSurvivingTransfersAndProtectedScopesPreserved:true,completeCorpusCompiled:true,methods};
  if(proof){assert.equal(sourceIdentity(sourceInventory(expected)),proof.sourceTreeSha256);for(const e of entries)assert.ok(fs.readFileSync(path.join(expected,e.path)).equals(fs.readFileSync(path.join(repository,'games/geoblox',e.path))),e.path+' exact expected source bytes');assert.equal(result.sharedFallbacks,proof.counts.sharedFallbacks);assert.equal(result.labelsRemoved,proof.counts.labelsRemoved);assert.equal(result.sourceReferencesAdded,proof.sourceReferenceOccurrencesAdded);assert.deepEqual(methods.map(m=>{const definitions=old.filter(r=>r[0]==='D'&&r[1]===m.file&&r[4].startsWith('M:')&&+r[2]>=m.methodStart&&+r[3]<=m.start);assert.equal(definitions.length,1);return{symbol:definitions[0][4],shared:m.shared,retained:m.retained,labels:m.labels,identifiers:m.identifiers};}).sort((a,b)=>a.symbol<b.symbol?-1:a.symbol>b.symbol?1:0),proof.changedMethods);}
  console.log(JSON.stringify(result));
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
