import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module, {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {archivedInput, digest, funorbRepository, workflowRoot} from './game-export.mjs';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from './tools/readable-java.mjs';
import {inventory} from '../scripts/publish-decompiled-games.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {verifyArmiesCore} from './tests/test-armiesofgielinor-core.mjs';

const baseSource={repository:'Kreijstal/funorb-decompiled',commit:'1655ca853d0d4027018f3efcdc37be76ab7895f4',subdirectory:'games/armiesofgielinor'};
const baseSha='a335a5dc8ceefc629e9ddd18c57c3ce19734ff22b3026833869d1fd193ad0637';
const bytecodeSha='e85e17bfa81c859e973427b53083553b59aabbe27319c2174ef0baeb723f0886';
const compilerCommit='ef1fb8596761b757a3ddf5288ca96dcc186a070f';
const targets=[['ha','b','(IIZ)V',['int','int','boolean'],'void'],['ej','a','(ZII)V',['boolean','int','int'],'void'],['gs','a','(B[I)Z',['byte','int[]'],'boolean']];

// Application-owned method selection; CFG reconstruction and its proofs are
// entirely supplied by the pinned generic compiler. Never infer a body from
// its game role or replace unrelated declarations in the historical input.
export function reconstructArmiesMethods(bytecodeDirectory, output, javaTools=path.resolve(workflowRoot,'../../java-tools')) {
  output=path.resolve(output);bytecodeDirectory=path.resolve(bytecodeDirectory);javaTools=path.resolve(javaTools);
  if(fs.existsSync(output))throw new Error('Reconstruction output already exists');
  const git=(...args)=>captureProcess('git',['-C',javaTools,...args],{maxBuffer:128*1024*1024}).stdout;
  if(git('rev-parse','HEAD').toString().trim()!==compilerCommit||git('status','--porcelain','--untracked-files=no').toString().trim())throw new Error('Reconstruction requires the clean pinned compiler');
  const bytecode=inventory(bytecodeDirectory,'.class');
  if(bytecode.files!==542||bytecode.sha256!==bytecodeSha)throw new Error('Bytecode differs from the verified historical pipeline');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'armies-method-reconstruction-'));
  const previousNodePath=process.env.NODE_PATH;
  try {
    const base=archivedInput({game:'armiesofgielinor',source:baseSource,inputTreeSha256:baseSha},temporary);
    // Installed dependency locations may differ; this changes no compiler
    // transformation policy. No generated binary is retained in the export.
    process.env.NODE_PATH=[path.join(javaTools,'node_modules'),process.env.JAVA_TOOLS_NODE_DEPS_DIR&&path.join(process.env.JAVA_TOOLS_NODE_DEPS_DIR,'node_modules'),previousNodePath].filter(Boolean).join(path.delimiter);
    Module._initPaths();
    const require=createRequire(path.join(javaTools,'package.json'));
    const {getAST}=require('jvm_parser');
    const {convertJson}=require(path.join(javaTools,'src/parsing/convert_tree.js'));
    const {decompileAstRoot,buildExceptionModel}=require(path.join(javaTools,'src/decompiler/cfr.js'));
    const {structureMethod}=require(path.join(javaTools,'src/decompiler/exceptionStructurer.js'));
    const {tokenizeJava}=require(path.join(javaTools,'src/java-frontend/lexer.js'));
    const roots=new Map(bytecode.entries.map(([file])=>{
      const parsed=getAST(new Uint8Array(fs.readFileSync(path.join(bytecodeDirectory,file))));
      return [file,convertJson(parsed.ast,parsed.constantPool)];
    }));
    const model=buildExceptionModel([...roots.values()].flatMap(root=>root.classes||[]));
    function bodyRange(source,name,parameters,returnType) {
      const lexed=tokenizeJava(source);if(lexed.diagnostics.length)throw new Error('Cannot tokenize method source');
      const tokens=lexed.tokens,header=[returnType,name,'('];
      parameters.forEach((type,index)=>{if(index)header.push(',');header.push(...type.match(/[A-Za-z_$][\w$]*|\[|\]/g),'param'+index);});header.push(')','{');
      const matches=[];for(let i=0;i<tokens.length;i++)if(header.every((text,j)=>tokens[i+j]?.text===text))matches.push(i+header.length-1);
      if(matches.length!==1)throw new Error('Method header is not unique: '+name);
      const open=matches[0];let depth=1,close=open+1;
      for(;close<tokens.length;close++){if(tokens[close].text==='{')depth++;if(tokens[close].text==='}'&&!--depth)break;}
      if(depth!==0)throw new Error('Unclosed method body');
      return [tokens[open].range.startOffset,tokens[close].range.endOffset];
    }
    const replacements=[];
    for(const [owner,name,descriptor,parameters,returnType] of targets) {
      // Long constants are BigInts in the parser AST, not JSON values.
      const root=structuredClone(roots.get(owner+'.class')),cls=root.classes[0];
      cls.items=cls.items.filter(item=>!item.method||item.method.name===name&&item.method.descriptor===descriptor);
      const methods=cls.items.filter(item=>item.method);if(methods.length!==1)throw new Error('Selected method missing');
      const code=methods[0].method.attributes.find(attribute=>attribute.type==='code').code;
      const proof=structureMethod(code.codeItems,code.exceptionTable);
      const protectedMethod=code.exceptionTable.length>0;
      if(!proof.ok||!(protectedMethod?proof.regionExitsVerified:proof.normalFlowVerified))throw new Error('Selected method lacks the original-edge/region proof: '+proof.reason);
      const diagnostics=[],candidate=decompileAstRoot(root,{exceptionModel:model,diagnostics});
      if(diagnostics.length||/switch\s*\(statePc\)/.test(candidate))throw new Error('Reconstructed method retains a fallback');
      const repeatedDiagnostics=[],repeated=decompileAstRoot(structuredClone(root),{exceptionModel:model,diagnostics:repeatedDiagnostics});
      if(repeated!==candidate||repeatedDiagnostics.length)throw new Error('Method reconstruction is not deterministic');
      const file=path.join(base,owner+'.java'),original=fs.readFileSync(file,'utf8');
      const [start,end]=bodyRange(original,name,parameters,returnType),[newStart,newEnd]=bodyRange(candidate,name,parameters,returnType);
      const oldBody=original.slice(start,end),newBody=candidate.slice(newStart,newEnd);
      if(!/switch\s*\(statePc\)/.test(oldBody))throw new Error('Historical method is not the expected dispatcher');
      fs.writeFileSync(file,original.slice(0,start)+newBody+original.slice(end));
      replacements.push({owner,name,descriptor,oldBodySha256:digest(oldBody),newBodySha256:digest(newBody),deterministic:true,
        ...(protectedMethod?{exceptionTableRows:code.exceptionTable.length,regions:proof.regionExitContracts.length,regionExitsVerified:true,regionSourceFlowVerified:true,outerRoutingVerified:true}
          :{splitBlocks:proof.splitBlocks,normalFlowVerified:true})});
    }
    if(previousNodePath===undefined)delete process.env.NODE_PATH;else process.env.NODE_PATH=previousNodePath;Module._initPaths();
    // Compare the complete old and reconstructed source corpora in native Java.
    // Empty alias rules select the original class/member spellings on both sides.
    const oldTemporary=path.join(temporary,'old');fs.mkdirSync(oldTemporary);
    const original=archivedInput({game:'armiesofgielinor',source:baseSource,inputTreeSha256:baseSha},oldTemporary);
    const mapping=JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/armiesofgielinor-naming.json')));mapping.rules=[];
    const stubs=buildCompilationStubs(funorbRepository,temporary);
    const verification=verifyArmiesCore(original,base,mapping,stubs.jar,temporary);
    const sourceSha=sourceIdentity(sourceInventory(base));
    const generator={repository:'Kreijstal/java-tools',commit:compilerCommit,trackedClean:true,sourceArchive:{sha256:digest(git('archive','--format=tar',compilerCommit)),reproduce:`git archive --format=tar ${compilerCommit} | sha256sum`}};
    fs.cpSync(base,output,{recursive:true});
    return {baseSource,baseSourceTreeSha256:baseSha,bytecode:{files:542,sha256:bytecodeSha},generator,methods:replacements,sourceTreeSha256:sourceSha,verification};
  } finally {
    if(previousNodePath===undefined)delete process.env.NODE_PATH;else process.env.NODE_PATH=previousNodePath;Module._initPaths();
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==4)throw new Error('Usage: node readable/reconstruct-armies-methods.mjs VERIFIED_BYTECODE OUTPUT');
  try{console.log(JSON.stringify(reconstructArmiesMethods(process.argv[2],process.argv[3])));}
  catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
}
