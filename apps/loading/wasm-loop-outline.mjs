// Preparation-only diagnostic: outline a closed counted-loop region, keeping
// its original checks/imports and moving its normal continuation only once.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {installWasmOptimizer} from './wasm-optimizer.mjs';

export function parseWat(source){
 assert.ok(source.length<=16*1024*1024,'WAT exceeds diagnostic budget');
 const roots=[],stack=[roots];let i=0,nodes=0;
 while(i<source.length){
  if(/\s/.test(source[i])){i++;continue;}
  if(source.startsWith(';;',i)){while(i<source.length&&source[i]!=='\n')i++;continue;}
  if(source.startsWith('(;',i)){let depth=1;i+=2;while(depth&&i<source.length){
   if(source.startsWith('(;',i)){depth++;i+=2;}else if(source.startsWith(';)',i)){depth--;i+=2;}else i++;
  }assert.equal(depth,0,'Unclosed WAT comment');continue;}
  if(source[i]==='('){const node=[];stack.at(-1).push(node);stack.push(node);i++;
   assert.ok(++nodes<=250000&&stack.length<=1024,'WAT tree exceeds diagnostic budget');continue;}
  if(source[i]===')'){assert.ok(stack.length>1,'Unexpected WAT closing parenthesis');stack.pop();i++;continue;}
  const start=i;
  if(source[i]==='"'){i++;while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i++]==='"')break;}
   assert.equal(source[i-1],'"','Unclosed WAT string');
  }else while(i<source.length&&!/[\s()]/.test(source[i]))i++;
  stack.at(-1).push(source.slice(start,i));
 }
 assert.equal(stack.length,1,'Unclosed WAT expression');assert.equal(roots.length,1,'Expected one WAT module');
 assert.equal(roots[0][0],'module');return roots[0];
}
export const printWat=node=>Array.isArray(node)?'('+node.map(printWat).join(' ')+')':node;
const walk=(node,visit)=>{if(!Array.isArray(node))return;visit(node);for(const child of node)walk(child,visit);};
const copy=node=>Array.isArray(node)?node.map(copy):node;
const localGet=name=>['local.get',name];
const int=value=>['i32.const',String(value)];
const tuple=values=>['tuple.make',String(values.length),...values];
const declaration=node=>Array.isArray(node)&&['type','param','result','local','export'].includes(node[0]);

export function outlineWat(source,{functionPrefix='',requiredImportName,minimumMemoryOps=4,maxHelpers=1,maxInputs=64,maxOutputs=32}={}){
 const module=parseWat(source),helpers=[],rows=[],refusals={},names=new Set();
 const requiredCalls=new Set(module.filter(n=>Array.isArray(n)&&n[0]==='import'&&n[2]===JSON.stringify(requiredImportName)&&n[3]?.[0]==='func').map(n=>n[3][1]));
 walk(module,n=>{for(const token of n)if(typeof token==='string'&&token.startsWith('$'))names.add(token);});
 const fresh=prefix=>{let i=0;while(names.has(prefix+i))i++;const name=prefix+i;names.add(name);return name;};
 const refuse=reason=>{refusals[reason]=(refusals[reason]||0)+1;};
 for(const fn of [...module]){
  if(!Array.isArray(fn)||fn[0]!=='func'||typeof fn[1]!=='string'||!fn[1].startsWith(functionPrefix))continue;
  // Generated core bodies return one status. Export wrappers keep their ABI.
  const result=fn.find(n=>Array.isArray(n)&&n[0]==='result');
  if(printWat(result||[])!=='(result i32)')continue;
  const types=new Map(),params=new Set();let eligible=true;
  for(const node of fn)if(Array.isArray(node)&&['param','local'].includes(node[0])){
   if(node.length!==3||!node[1].startsWith('$')){eligible=false;break;}
   types.set(node[1],node[2]);if(node[0]==='param')params.add(node[1]);
  }
  if(!eligible)continue;
  while(helpers.length<maxHelpers){
  const candidates=[];let outlined=false;
  const collect=(parent,index)=>{const node=parent[index];if(!Array.isArray(node))return;
   if(node[0]==='loop')candidates.push({parent,index,node});for(let i=0;i<node.length;i++)collect(node,i);};
  for(let i=0;i<fn.length;i++)if(!declaration(fn[i]))collect(fn,i);
  for(const candidate of candidates){
   if(helpers.length>=maxHelpers)break;
   const {parent,node}=candidate,label=node[1],parts=node.slice(2);let exitIndex=parts.length-1;
   while(exitIndex>=0&&parts[exitIndex]?.[0]==='unreachable')exitIndex--;
   const exit=parts[exitIndex];
   if(typeof label!=='string'||!label.startsWith('$')||exit?.[0]!=='if'||exit.length!==4||exit[2]?.[0]!=='then'||exit[3]?.[0]!=='else')continue;
   const continuation=exit[2].slice(1),body=exit[3].slice(1);let nested=false,memory=0,requiredCallSites=0;
   for(const item of body)walk(item,n=>{if(n[0]==='loop')nested=true;if(/^(?:i32|i64|f32|f64)\.(?:load|store)/.test(n[0]))memory++;
    if(n[0]==='call'&&requiredCalls.has(n[1]))requiredCallSites++;
   });
   if(nested||memory<minimumMemoryOps||requiredImportName&&!requiredCallSites)continue;
   let resumesLoop=false;
   for(const item of continuation)walk(item,n=>{if(n[0].startsWith('br')&&n.slice(1).includes(label))resumesLoop=true;});
   if(resumesLoop){refuse('exit-arm-backedge');continue;}
   // Disallow every escaping branch other than the loop's own backedge.
   // The normal exit arm becomes the single post-call continuation.
   const done=fresh('$outline_done_'),region=['loop',label,...parts.slice(0,exitIndex).map(copy),
    ['if',copy(exit[1]),['then',['br',done]],copy(exit[3])],...parts.slice(exitIndex+1).map(copy)];
   // Keep cold status exits in the caller. Their Java-frame snapshots often
   // reference many values unrelated to the loop's arithmetic. A side-exit
   // tag returns modified live values first, then runs the exact old branch.
   const sideExits=[];
   const splitCold=n=>{if(!Array.isArray(n))return n;
    const then=n.find?.(child=>Array.isArray(child)&&child[0]==='then');
    if(n[0]==='if'&&then&&!n.some(child=>Array.isArray(child)&&child[0]==='else')&&then.at(-1)?.[0]==='return'&&sideExits.length<16){
     let unsafe=false;walk(then,child=>{if(child[0].startsWith('br')||['loop','try','try_table'].includes(child[0]))unsafe=true;});
     if(!unsafe){const tag=sideExits.length+2;sideExits.push({tag,body:then.slice(1)});
      return n.map(child=>child===then?['then',['outline.side_exit',String(tag)]]:splitCold(child));}
    }
    return n.map(splitCold);
   };
   const hotRegion=splitCold(region);
   const gets=new Set(),sets=new Set();let unsafe=false;
   const control=(n,scope)=>{if(!Array.isArray(n))return;
    if(['block','loop','if'].includes(n[0])&&typeof n[1]==='string'&&n[1].startsWith('$'))scope=[...scope,n[1]];
    if(['br','br_if'].includes(n[0])&&!scope.includes(n[1]))unsafe=true;
    for(const child of n)control(child,scope);
   };control(hotRegion,[done]);
   walk(hotRegion,n=>{
    if(n[0].startsWith('br_')&&n[0]!=='br_if'||n[0].startsWith('return_call')||
      ['try','try_table','throw','throw_ref','rethrow','delegate'].includes(n[0]))unsafe=true;
    if(n[0]==='return'&&n.length!==2)unsafe=true;
    if(n[0]==='local.get')gets.add(n[1]);
    if(n[0]==='local.set'||n[0]==='local.tee')sets.add(n[1]);
   });
   if(unsafe){refuse('escaping-control-or-exception-region');continue;}
   const outsideGets=new Set();
   const outside=n=>{if(n===node||!Array.isArray(n))return;if(n[0]==='local.get')outsideGets.add(n[1]);for(const child of n)outside(child);};outside(fn);
   for(const item of continuation)outside(item);
   for(const side of sideExits)for(const item of side.body)outside(item);
   const outputs=[...sets].filter(name=>outsideGets.has(name)),inputs=[...new Set([...gets,...outputs])];
   const used=new Set([...gets,...sets]);
   if([...used].some(name=>!types.has(name)||Array.isArray(types.get(name))&&types.get(name)[0]==='tuple')||
     inputs.some(name=>Array.isArray(types.get(name))&&types.get(name)[0]==='ref'&&types.get(name)[1]!=='null')){refuse('unknown-tuple-or-nonnullable-local');continue;}
   if(inputs.length>maxInputs||outputs.length>maxOutputs){refuse('capture-budget');continue;}
   const helperName=fresh('$jvm_outline_'),scratch=fresh('$outline_result_');
   const resultTypes=['i32','i32',...outputs.map(name=>types.get(name))];
   const returnValues=status=>tuple([int(1),status,...outputs.map(localGet)]);
   const rewriteReturns=n=>{if(!Array.isArray(n))return n;
    if(n[0]==='outline.side_exit')return ['return',tuple([int(n[1]),int(0),...outputs.map(localGet)])];
    if(n[0]==='return')return ['return',returnValues(rewriteReturns(n[1]))];return n.map(rewriteReturns);};
   const helper=['func',helperName,...inputs.map(name=>['param',name,types.get(name)]),['result',...resultTypes],
    ...[...used].filter(name=>!inputs.includes(name)).map(name=>['local',name,types.get(name)]),
    ['block',done,rewriteReturns(hotRegion)],tuple([int(0),int(0),...outputs.map(localGet)])];
   const extract=slot=>['tuple.extract',String(resultTypes.length),String(slot),localGet(scratch)];
   const replacement=['block',['local.set',scratch,['call',helperName,...inputs.map(localGet)]],
    ...outputs.map((name,i)=>['local.set',name,extract(i+2)]),
    ...sideExits.map(side=>['if',['i32.eq',extract(0),int(side.tag)],['then',...side.body]]),
    ['if',extract(0),['then',['return',extract(1)]]],...continuation];
   // New helper locals are private; all externally live writes are returned
   // exactly once. A thrown import never repeats effects or the continuation.
   const declarationEnd=fn.findIndex((n,i)=>i>1&&!declaration(n));
   fn.splice(declarationEnd,0,['local',scratch,['tuple',...resultTypes]]);
   // Top-level insertion may shift a candidate's index; find it by identity.
   parent[parent.indexOf(node)]=replacement;
   helpers.push(helper);rows.push({function:fn[1],loop:label,helper:helperName,memorySites:memory,inputs:inputs.length,outputs:outputs.length,sideExits:sideExits.length,requiredCallSites});
   outlined=true;break;
  }
  if(!outlined)break;
  }
 }
 module.push(...helpers);
 return {wat:helpers.length?printWat(module):source,outlinedLoops:rows,refusals};
}

export function installWasmLoopOutliner({functionPrefix,outputPath,...limits}){
 const rows=[],refusals={},outputs=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');let preview;
 const features=['--mvp-features','--enable-mutable-globals','--enable-reference-types','--enable-gc',
  '--enable-multivalue','--enable-exception-handling','--enable-nontrapping-float-to-int','--enable-sign-ext','--enable-bulk-memory','--enable-simd'];
 const optimizer=installWasmOptimizer({minimumBytes:16384,optimize:input=>{
  const source=execFileSync('wasm-dis',['--all-features','-'],{input,encoding:'utf8',maxBuffer:64*1024*1024});
  if(!source.includes('(func '+functionPrefix))return input;
  const result=outlineWat(source,{functionPrefix,...limits});
  rows.push(...result.outlinedLoops.map(row=>({...row,moduleInputSha256:hash(input)})));
  for(const [reason,count]of Object.entries(result.refusals))refusals[reason]=(refusals[reason]||0)+count;
  if(!result.outlinedLoops.length)return input;
  const output=execFileSync('wasm-as',[...features,'-','-o','-'],{input:result.wat,maxBuffer:64*1024*1024});
  assert.ok(outputs.size<16||outputs.has(hash(input)),'Diagnostic transformed-module budget exceeded');
  outputs.set(hash(input),output);
  return output;
 }});
 return {
  writePreview(inputSha256){const bytes=outputs.get(inputSha256);assert.ok(bytes,'Active method was not transformed');
   if(outputPath)fs.writeFileSync(outputPath,execFileSync('wasm-dis',['--all-features','-'],{input:bytes}));
   preview={inputSha256,outputSha256:hash(bytes),output:outputPath};outputs.clear();return preview;
  },
  finishPreparation(){return {...optimizer.finishPreparation(),transformation:'closed-loop-outline',
   options:{disassemble:['--all-features','-'],assemble:[...features,'-','-o','-']},
   selection:{functionPrefix,...limits},outlinedLoops:rows,refusals,preview};},
 };
}
