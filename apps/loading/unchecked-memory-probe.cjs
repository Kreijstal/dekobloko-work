// Unsafe causal diagnostic only: never a runtime policy or acceptance run.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {Module}=require('node:module'),original=Module.prototype._compile;
const revision=process.argv[2],player=path.resolve(process.argv[3]||path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'));
const component=process.argv[4]||'bounds';
assert.ok(['all','bounds','statics','casts'].includes(component),'Expected bounds, statics, casts or all diagnostic');
assert.match(revision||'',/^[a-f0-9]{40}$/, 'Provide an exact source commit; this is an unsafe diagnostic, never acceptance.');
const receiptFile=path.join(player,'benchmark.json');
const previousDiagnostic=JSON.stringify(JSON.parse(fs.readFileSync(receiptFile)).kernelDiagnostic);
const sites={numericStaticReads:0,numericStaticWrites:0,slabAccesses:0,numericArrayAccesses:0,arrayCasts:0};
Module.prototype._compile=function(source,filename){
 const result=original.call(this,source,filename);
 if(!filename.endsWith('/src/jit/StructuredWasmCompiler.js'))return result;
 const p=this.exports.prototype,{T,OP,uleb,sleb,sig,arrayLoadImportName}=this.require('./wasmShared');
 const read=p.nativeStaticRead;
 if(component==='all'||component==='statics')p.nativeStaticRead=function(field,entry){
  if(!field.native)return read.call(this,field,entry);
  sites.numericStaticReads++;this.usedHeap=true;
  return [OP.i32_const,...sleb(field.native.address+4),OP.i32_load,2,0];
 };
 if(component==='all'||component==='statics')p.nativeStaticWrite=function(field,value,out){
  sites.numericStaticWrites++;this.usedHeap=true;
  const address=field.native.address;
  out.push(OP.i32_const,...sleb(address+4),...value,OP.i32_store,2,0,
   OP.i32_const,...sleb(address+8),OP.i32_const,0,OP.i32_store,2,0);
 };
 if(component==='all')p.slabAccessSeq=function(node,slot,fieldIdx,isGet,use){
  sites.slabAccesses++;this.objImports();this.usedHeap=true;
  const cache=this.objCacheFor(node.args[0]),align=slot.kind==='i32'?2:3;
  const op=slot.kind==='i32'?(isGet?OP.i32_load:OP.i32_store):
   slot.kind==='f64'?(isGet?OP.f64_load:OP.f64_store):(isGet?OP.i64_load:OP.i64_store);
  return [...this.objectCacheFill(cache,use(0)),OP.local_get,...uleb(cache.base),
   ...(isGet?[]:use(1)),op,...uleb(align),...uleb(slot.offset)];
 };
 const heapAccess=p.heapAccessSeq;
 if(component==='all'||component==='bounds')p.heapAccessSeq=function(node,access,store,importT){
  if(this.activeGuardedLoopPlan?.memoryNodes.has(node.id))return heapAccess.call(this,node,access,store,importT);
  sites.numericArrayAccesses++;this.heapImports();this.usedHeap=true;
  const cache=this.arrayCacheFor(node.args[0]);
  const raw=[OP.local_get,...uleb(cache.base),
   ...this.useOf(node.args[1]),...(access.shift?[OP.i32_const,...sleb(access.shift),OP.i32_shl]:[]),
   OP.i32_add,...(store||[]),OP[access.op],...uleb(access.shift),0];
  if(component==='all'||this.parameterHeapAccess&&cache.parameter)return [...this.arrayAccessFill(cache,node),...raw];
  const storeName=this.wasmJit.typedArrayStoresEnabled?'aset_'+node.op:'aset_'+sig(importT);
  const name=store?storeName:arrayLoadImportName(this,node.op,importT);
  return [...this.arrayAccessFill(cache,node),OP.local_get,...uleb(cache.base),OP.i32_const,0,OP.i32_ge_s,
   OP.if,store?0x40:access.t,...raw,OP.else,...this.useOf(node.args[0]),...this.useOf(node.args[1]),
   ...(store||[]),OP.call,...uleb(this.importIndexByName.get(name)),OP.end];
 };
 const cast=p.nativeCastSeq;
 if(component==='casts')p.nativeCastSeq=function(node){
  if(node.op!=='checkcast'||!/^\[[ZBCSIJFD]$/.test(node.imm))return cast.call(this,node);
  sites.arrayCasts++;return this.useOf(node.args[0]);
 };
 return result;
};
const probe=path.join(__dirname,'probe.mjs');
process.argv=[process.execPath,probe,'slab','all',revision,'loading',player];
(async()=>{
 let success=false,error;
 try{await import(pathToFileURL(probe));success=true;}
 catch(caught){error=String(caught.stack||caught);process.exitCode=1;}
 finally{
  Module.prototype._compile=original;
  const file=receiptFile;
  const data=JSON.parse(fs.readFileSync(file)),d=data.kernelDiagnostic;
  const row={diagnosticOnly:true,unsafe:true,success,error,revision,component,sites,
   assumptions:component==='casts'?'Unchecked primitive-array checkcast success; no type-getter or ClassCastException semantics.':
    component==='bounds'?'Unchecked native numeric array ranges; original representation fallbacks remain.':
    component==='statics'?'Unchecked numeric static-cell capabilities.':'Unchecked numeric static cells, slab receivers and numeric array representation/ranges; invalid for arbitrary inputs.',
   hookSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')};
  if(success)assert.equal(d.runtimeRevision,revision);
  if(d.runtimeRevision===revision&&JSON.stringify(d)!==previousDiagnostic){d.instrumented=true;
   for(const key of ['runtimeRevision','harnessSha256','equal','check','musicMs','graphicsMs','loadingMs','elapsed','executionMs','lateCompiles','compilation','heapUsage'])row[key]=d[key];}
  (data.optimizationTrials.uncheckedMemoryUpperBound ||= {runs:[]}).runs.push(row);
  fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');console.log('UNCHECKED_MEMORY',JSON.stringify(row));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
