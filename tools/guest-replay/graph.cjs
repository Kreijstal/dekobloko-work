'use strict';
const model = require('../../../java-tools/src/core/objectModel');
const typed = {Int8Array:'[B', Uint8Array:'[B', Uint8ClampedArray:'[B',
  Int16Array:'[S', Uint16Array:'[C', Int32Array:'[I', Uint32Array:'[I',
  Float32Array:'[F', Float64Array:'[D', BigInt64Array:'[J'};

// Only Java data is portable. Never clone native handles, functions or locks.
// IDs preserve cycles and repeated references, including aliased Java arrays.
function encode(roots, {maxNodes=100000, maxBytes=64*1024*1024,schema=2,fieldModel=model}={}) {
  if(![1,2].includes(schema))throw Error('Unsupported snapshot schema');
  const ids=new Map(), nodes=[], buffers=new Map(); let bytes=0;
  const atom=value=>{
    if(value===undefined)return {$undefined:true};
    if(typeof value==='bigint')return {$bigint:String(value)};
    if(typeof value==='number' && (!Number.isFinite(value)||Object.is(value,-0)))
      return {$number:Object.is(value,-0)?'-0':String(value)};
    if(value===null || ['string','number','boolean'].includes(typeof value))return value;
    if(typeof value!=='object')throw Error('Non-portable value: '+typeof value);
    if(ids.has(value))return {$ref:ids.get(value)};
    if(nodes.length>=maxNodes)throw Error('Snapshot node limit exceeded');
    const id=nodes.length;ids.set(value,id);nodes.push(null);
    let node;
    if(ArrayBuffer.isView(value)) {
      const kind=value.constructor.name;
      if(!typed[kind])throw Error('Unsupported view '+kind);
      const ranges=buffers.get(value.buffer)||[];
      if(ranges.some(([a,b])=>value.byteOffset<b && value.byteOffset+value.byteLength>a))
        throw Error('Overlapping distinct typed views need a shared-buffer snapshot');
      ranges.push([value.byteOffset,value.byteOffset+value.byteLength]);buffers.set(value.buffer,ranges);
      bytes+=value.byteLength;
      node={kind:'typed',type:kind,values:Array.from(value,atom)};
      if(schema>=2&&typeof value.type==='string')node.javaType=value.type;
    } else if(Array.isArray(value)) {
      bytes+=value.length*8;
      node={kind:'array',type:value.type||null,values:Array.from(value,atom)};
    } else if(value.fields && typeof value.type==='string') {
      const keys=fieldModel.enumerateFieldKeys(value.fields);
      // Legacy plain objects can contain auxiliary named fields absent from a
      // dense layout. Decode retains them as expandos; retain them on re-encode
      // too, rather than silently dropping part of the captured state.
      if(Array.isArray(value.fields))for(const key of Object.keys(value.fields))
        if(!/^(0|[1-9][0-9]*)$/.test(key)&&!keys.includes(key))keys.push(key);
      node={kind:'guest',type:value.type,fields:keys
        .sort().map(k=>[k,atom(fieldModel.readField(value.fields,k))])};
      // String payloads are stored outside guest fields in some JRE paths.
      if(Object.hasOwn(value,'value'))node.value=atom(value.value);
    } else {
      const proto=Object.getPrototypeOf(value);
      if(proto!==Object.prototype && proto!==null)throw Error('Host object in snapshot: '+value.constructor?.name);
      node={kind:'record',values:Object.keys(value).sort().map(k=>[k,atom(value[k])])};
    }
    if(bytes>maxBytes)throw Error('Snapshot byte limit exceeded');
    nodes[id]=node;return {$ref:id};
  };
  const root=atom(roots);
  return {schema,root,nodes,bytes};
}

function decode(snapshot,jvm) {
  if(![1,2].includes(snapshot.schema))throw Error('Unsupported snapshot schema');
  const objects=snapshot.nodes.map(n=>{
    if(n.kind==='guest')return model.makeObjectRef(jvm,n.type,model.newFields(jvm,n.type));
    if(n.kind==='typed') {
      const C=globalThis[n.type];if(!typed[n.type]||!C)throw Error('Unsupported typed array');
      const descriptor=n.javaType||typed[n.type];
      if(descriptor!==typed[n.type]&&!(descriptor==='[Z'&&n.type==='Int8Array'))
        throw Error('Incompatible primitive array descriptor');
      // Fresh arrays must belong to this runtime's heap, never the capture heap.
      const canonical=['Int8Array','Int16Array','Uint16Array','Int32Array','Float32Array','Float64Array','BigInt64Array'];
      const array=(canonical.includes(n.type)&&jvm.wasmHeap?.alloc(descriptor,n.values.length)) || new C(n.values.length);
      if(n.javaType)array.type=n.javaType;
      return array;
    }
    if(n.kind==='array')return new Array(n.values.length);
    if(n.kind==='record')return Object.create(null);
    throw Error('Unknown graph node '+n.kind);
  });
  const atom=v=>{
    if(v===null||typeof v!=='object')return v;
    if(Object.hasOwn(v,'$ref')) {
      if(!Number.isInteger(v.$ref)||!objects[v.$ref])throw Error('Invalid graph reference');
      return objects[v.$ref];
    }
    if(v.$undefined)return undefined;
    if(Object.hasOwn(v,'$bigint'))return BigInt(v.$bigint);
    if(Object.hasOwn(v,'$number'))return v.$number==='-0'?-0:Number(v.$number);
    throw Error('Invalid graph atom');
  };
  snapshot.nodes.forEach((n,i)=>{
    const o=objects[i];
    if(n.kind==='guest') {
      for(const [k,v] of n.fields)model.writeField(o.fields,k,atom(v));
      if(Object.hasOwn(n,'value'))o.value=atom(n.value);
    } else if(n.kind==='record') {
      for(const [k,v] of n.values)Object.defineProperty(o,k,{value:atom(v),writable:true,enumerable:true,configurable:true});
    } else {
      n.values.forEach((v,k)=>o[k]=atom(v));
      if(n.kind==='array'&&n.type)o.type=n.type;
    }
  });
  return atom(snapshot.root);
}

function primitiveTree(v,seen=new Set()) {
  if(v===null || ['number','boolean','bigint','string','undefined'].includes(typeof v))return true;
  if(ArrayBuffer.isView(v))return !!typed[v.constructor.name];
  if(!Array.isArray(v)||seen.has(v))return false;
  seen.add(v);return v.every(x=>primitiveTree(x,seen));
}

function captureStatics(jvm) {
  const values={},omitted=[];
  for(const [owner,cls] of Object.entries(jvm.classes)) {
    if(!cls.staticFields)continue;
    const entries=[];
    for(const [key,value] of cls.staticFields) {
      if(primitiveTree(value))entries.push([key,value]);
      else omitted.push(owner+'.'+key);
    }
    values[owner]=entries;
  }
  return {values,omitted};
}
module.exports={encode,decode,captureStatics};
