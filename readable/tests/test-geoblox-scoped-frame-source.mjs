import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {funorbRepository, workflowRoot} from '../layout.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

// Reuse frozen independent Java target/continuation verifiers. The loop stage
// additionally audits every original token and the exact suffix guarded by the
// fresh bound Boolean; the guard stage compares full independently derived ASTs.
const preview=process.argv.includes('--preview');
const javaTools=path.resolve(process.argv.slice(2).find(a=>a!=='--preview')||'../java-tools');
const root=JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/geoblox-provenance.json')));
const proof=preview?null:root.scopedFrameInitializationRecovery;
assert.ok(preview||proof);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'geoblox-scoped-frame-proof-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(c,a)=>captureProcess(c,a,{maxBuffer:128*1024*1024}).stdout.toString();
const replace=(s,a,b)=>{assert.equal(s.split(a).length-1,1,a);return s.replace(a,b);};
try{
  function archive(repo,commit,name,subpath){
    const tar=path.join(temporary,name+'.tar'),directory=path.join(temporary,name);
    run('git',['-C',repo,'archive','--format=tar','--output='+tar,commit,...(subpath?[subpath]:[])]);
    fs.mkdirSync(directory);run('tar',['-xf',tar,'-C',directory]);
    return {directory,sha256:hash(fs.readFileSync(tar))};
  }
  const tools=preview?{directory:javaTools}:archive(javaTools,proof.javaToolsCommit,'tools');
  if(proof){assert.equal(tools.sha256,proof.sourceArchiveSha256);assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))),proof.sourceProofTestSha256);}
  const before=preview?path.join(funorbRepository,'games/geoblox'):path.join(archive(funorbRepository,proof.previousSourceCommit,'before','games/geoblox').directory,'games/geoblox');
  const entries=sourceInventory(before);assert.equal(entries.length,303);
  if(proof)assert.equal(sourceIdentity(entries),proof.previousSourceTreeSha256);
  const dependencies={loop:'test-geoblox-loop-completion-source.mjs',guard:'test-geoblox-dominating-frame-source.mjs'};
  const fixtures=Object.fromEntries(Object.entries(dependencies).map(([key,file])=>[key,path.join(workflowRoot,'tests',file)]));
  for(const[key,file]of Object.entries(fixtures))if(proof)assert.equal(hash(fs.readFileSync(file)),proof.fixtureSha256[key]);
  const fake=path.join(temporary,'funorb'),input=path.join(fake,'games/geoblox'),looped=path.join(temporary,'looped'),expected=path.join(temporary,'expected'),payload=path.join(temporary,'loop-audit.json');
  fs.mkdirSync(input,{recursive:true});fs.mkdirSync(path.join(fake,'readable'));fs.mkdirSync(path.join(fake,'decompilation'));
  for(const e of entries)fs.copyFileSync(path.join(before,e.path),path.join(input,e.path));
  fs.copyFileSync(path.join(funorbRepository,'readable/funorb-stubs.jar'),path.join(fake,'readable/funorb-stubs.jar'));
  fs.writeFileSync(path.join(fake,'decompilation/geoblox-provenance.json'),JSON.stringify(root));
  const imports=s=>s.replace(/(['"])(\.\.\/[^'"]+)\1/g,(all,q,spec)=>q+pathToFileURL(path.resolve(path.dirname(fixtures.loop),spec)).href+q);
  let child=imports(fs.readFileSync(fixtures.loop,'utf8'));
  child=replace(child,'retainDiagnostics:true});if(!r.exitsRecovered)','retainDiagnostics:true,scopedInitialization:true});if(!r.exitsRecovered)');
  child=replace(child,'console.log(JSON.stringify(result));',
    `const changed=new Set(changes.map(c=>c.file));if(process.env.GEOBLOX_SCOPED_LOOP_AUDIT)fs.writeFileSync(process.env.GEOBLOX_SCOPED_LOOP_AUDIT,JSON.stringify({flags,old:old.filter(r=>changed.has(r[1])),after:after.filter(r=>changed.has(r[1])),initial:initial.filter(r=>changed.has(r[1])),origins:Object.fromEntries([...origins].filter(([f])=>changed.has(f)))}));if(process.env.GEOBLOX_SCOPED_LOOP_OUTPUT){fs.mkdirSync(process.env.GEOBLOX_SCOPED_LOOP_OUTPUT,{recursive:true});for(const e of input)fs.copyFileSync(path.join(expected,e.path),path.join(process.env.GEOBLOX_SCOPED_LOOP_OUTPUT,e.path));}console.log(JSON.stringify(result));`);
  const loopFile=path.join(temporary,'loop-fixture.mjs');fs.writeFileSync(loopFile,child);
  const loop=JSON.parse(run('env',['FUNORB_DECOMPILED_DIR='+fake,'GEOBLOX_LOOP_COMPLETION_BASE_COMMIT=','GEOBLOX_LOOP_COMPLETION_CANDIDATE_DIR=','GEOBLOX_SCOPED_LOOP_OUTPUT='+looped,'GEOBLOX_SCOPED_LOOP_AUDIT='+payload,'node',loopFile,tools.directory,'--preview']));
  const audit=JSON.parse(fs.readFileSync(payload));
  const require=createRequire(import.meta.url),{tokenizeJava}=require(path.join(tools.directory,'src/java-frontend/lexer.js'));
  const lex=s=>tokenizeJava(s).tokens.filter(t=>t.kind!=='eof');let tokensCompared=0;
  for(const file of new Set(audit.flags.map(f=>f.file))){
    const old=lex(fs.readFileSync(path.join(before,file),'utf8')),next=lex(fs.readFileSync(path.join(looped,file),'utf8'));
    const oldStarts=new Map(old.map((t,i)=>[t.range.startOffset,i])),nextStarts=new Map(next.map((t,i)=>[t.range.startOffset,i]));
    const omittedOld=new Set(),omittedNext=new Set(),origins=audit.origins[file];
    for(const flag of audit.flags.filter(f=>f.file===file)){
      const symbol=loop.newFlags.find(f=>f.file===file&&f.originalName===flag.name&&f.frameSymbol===flag.frameSymbol).symbol;
      const declaration=audit.old.find(r=>r[0]==='T'&&r[4]===flag.frameSymbol);assert.ok(declaration);
      const labelIndex=oldStarts.get(+declaration[2]);assert.equal(old[labelIndex+1].text,':');omittedOld.add(labelIndex);omittedOld.add(labelIndex+1);
      const oldJump=audit.initial.find(r=>r[0]==='Q'&&r[1]===file&&+r[2]===flag.parentJump);assert.ok(oldJump);
      const oldIndex=oldStarts.get(flag.parentJump);assert.equal(old[oldIndex].text,'break');assert.equal(old[oldIndex+1].text,declaration[5]);omittedOld.add(oldIndex+1);
      const recipe=audit.initial.find(r=>r[0]==='X'&&r[1]===file&&+r[2]===flag.parentJump);assert.ok(recipe);
      const suffixes=recipe[7].split(',').map(s=>s.split(':').map(Number));let guards=0,stores=0,decls=0;
      const occurrences=audit.after.filter(r=>['D','R'].includes(r[0])&&r[4]===symbol);
      for(const row of occurrences){
        const i=nextStarts.get(+row[2]);assert.equal(next[i].text,flag.name);
        if(row[0]==='D'){
          assert.deepEqual(next.slice(i-1,i+4).map(t=>t.text),['boolean',flag.name,'=','true',';']);
          assert.equal(next[i-2].text,'{');assert.equal(old[labelIndex+2].text,'{');
          assert.equal(origins[next[i-2].range.startOffset],old[labelIndex+2].range.startOffset,'decision belongs to the original frame scope');
          assert.equal(origins[next[i+4].range.startOffset],old[labelIndex+3].range.startOffset,'initialization precedes the original first frame action');
          for(let n=i-1;n<i+4;n++)omittedNext.add(n);decls++;
        }else if(next[i+1]?.text==='='){
          assert.deepEqual(next.slice(i,i+5).map(t=>t.text),[flag.name,'=','false',';','break']);
          assert.equal(origins[next[i+4].range.startOffset],flag.parentJump);
          assert.equal(next[i+5].text,';');origins[next[i+5].range.startOffset]=+oldJump[3]-1;
          for(let n=i;n<i+4;n++)omittedNext.add(n);stores++;
        }else{
          assert.deepEqual(next.slice(i-2,i+3).map(t=>t.text),['if','(',flag.name,')','{']);
          let depth=1,close=i+3;for(;close<next.length;close++){if(next[close].text==='{')depth++;if(next[close].text==='}'&&!--depth)break;}
          assert.ok(close<next.length);for(let n=i-2;n<i+3;n++)omittedNext.add(n);omittedNext.add(close);
          const body=next.slice(i+3,close);const projected=body.map(t=>origins[t.range.startOffset]);
          const expectedSuffix=old.filter(t=>t.range.startOffset>=suffixes[guards][0]&&t.range.endOffset<=suffixes[guards][1]).map(t=>t.range.startOffset);
          assert.deepEqual(projected,expectedSuffix,'the complete independently derived original suffix');guards++;
        }
      }
      assert.equal(decls,1);assert.equal(stores,1);assert.equal(guards,suffixes.length);
    }
    const a=old.filter((_,i)=>!omittedOld.has(i)),b=next.filter((_,i)=>!omittedNext.has(i));assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++){
      assert.equal(b[i].text,a[i].text);assert.equal(origins[b[i].range.startOffset],a[i].range.startOffset);
      assert.equal(origins[b[i].range.endOffset-1],a[i].range.endOffset-1);
    }
    tokensCompared+=a.length;
  }
  for(const e of entries)fs.copyFileSync(path.join(looped,e.path),path.join(input,e.path));
  child=imports(fs.readFileSync(fixtures.guard,'utf8'));
  child=replace(child,'maximumExits:64,dominatingAssignments:true','maximumExits:64,dominatingAssignments:true,scopedInitialization:true');
  const guardFile=path.join(temporary,'guard-fixture.mjs');fs.writeFileSync(guardFile,child);
  const guard=JSON.parse(run('env',['FUNORB_DECOMPILED_DIR='+fake,'GEOBLOX_DOMINATING_FRAME_OUTPUT_DIR='+expected,'GEOBLOX_DOMINATING_FRAME_CANDIDATE_DIR=','node',guardFile,tools.directory,'--preview']));
  const candidate=preview?process.env.GEOBLOX_SCOPED_FRAME_CANDIDATE_DIR:path.join(archive(funorbRepository,proof.sourceCommit,'after','games/geoblox').directory,'games/geoblox');
  if(candidate)for(const e of entries)assert.ok(fs.readFileSync(path.join(expected,e.path)).equals(fs.readFileSync(path.join(candidate,e.path))),e.path+' exact compiler source');
  if(preview&&process.env.GEOBLOX_SCOPED_FRAME_OUTPUT_DIR){fs.mkdirSync(process.env.GEOBLOX_SCOPED_FRAME_OUTPUT_DIR,{recursive:true});for(const e of entries)fs.copyFileSync(path.join(expected,e.path),path.join(process.env.GEOBLOX_SCOPED_FRAME_OUTPUT_DIR,e.path));}
  const result={files:303,loopOriginalTokensCompared:tokensCompared,loop,guard,sourceTreeSha256:sourceIdentity(sourceInventory(expected))};
  if(proof){assert.equal(result.sourceTreeSha256,proof.sourceTreeSha256);assert.deepEqual(loop,proof.loop);assert.deepEqual(guard,proof.guard);}
  console.log(JSON.stringify(result));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
