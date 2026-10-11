import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {archivedInput, digest, funorbRepository, workflowRoot} from '../game-export.mjs';
import {buildCompilationStubs} from '../compilation-stubs.mjs';

export function verifySnapshots(input, named, mapping, classpath, temporary) {
  const aliases = new Map(mapping.rules.map(rule => [rule.symbol, rule.to]));
  const fields = ['O','a','jb','C','zb','q','L','e','Ab','A','Cb','o','db','yb','U','y','Bb','P','T'];
  const symbols = new Map(mapping.symbols.map(symbol => [symbol.symbol, symbol]));
  const fieldKey = name => [...symbols.keys()].find(key => key.startsWith('F:lk.field_'+name+':'));
  const outputs = [];
  for (const readable of [false, true]) {
    const className = owner => readable ? aliases.get('C:'+owner) || owner : owner;
    const board = className('lk'), buffer = className('wl'), client = className('client');
    const flag = readable ? aliases.get('F:client.field_A:Z') : 'field_A';
    const fieldNames = fields.map(name => readable ? aliases.get(fieldKey(name)) : 'field_'+name);
    assert.ok(fieldNames.every(Boolean));
    const decoder = readable ? aliases.get('M:lk.a(ZLwl;B)V') : 'a';
    const directory = path.join(temporary, readable ? 'named-snapshots' : 'raw-snapshots');
    const classes = path.join(directory, 'classes'), shims = path.join(directory, 'shims');
    fs.mkdirSync(classes, {recursive:true});fs.mkdirSync(shims);
    // The snapshot path reads only the client control flag. Avoid initializing
    // the Applet/audio graph; both variants use the same headless boundary.
    const shim = path.join(directory, client+'.java');
    fs.writeFileSync(shim, `public final class ${client} {public static boolean ${flag}=false;}`);
    captureProcess('javac',['--release','8','-d',shims,shim]);
    const harness = path.join(directory,'SnapshotProbe.java');
    fs.writeFileSync(harness, `import java.lang.reflect.*;import java.util.*;import java.io.*;
public class SnapshotProbe {
static final String[] F=${JSON.stringify(fieldNames).replace(/^\[/,'{').replace(/\]$/,'}')};
static Object get(Class<?> type,Object value,String field)throws Exception{Field f=type.getDeclaredField(field);f.setAccessible(true);return f.get(value);}
static byte[] packet(int seed)throws Exception{ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);out.writeShort(0);out.writeByte(1+seed%3);for(int i=0;i<144;i++)out.writeByte(i==136?16+seed%7:0);out.writeByte(seed%32);out.writeByte(2);out.writeByte(1);out.writeByte(16+seed%7);out.writeByte(16+(seed+1)%7);out.writeByte(seed%7);out.writeByte(seed%10);out.writeByte(1+seed%40);out.writeShort(30+seed);out.writeByte(seed%32);out.writeByte(0);out.writeByte(1);out.writeByte(0);out.writeByte(0);return bytes.toByteArray();}
public static void main(String[] args)throws Exception{
Class<?> board=Class.forName("${board}"),buffer=Class.forName("${buffer}");Constructor<?> create=board.getDeclaredConstructor(boolean.class,int.class,int.class,int.class,int.class),wrap=buffer.getDeclaredConstructor(byte[].class);create.setAccessible(true);wrap.setAccessible(true);Method decode=board.getDeclaredMethod("${decoder}",boolean.class,buffer,byte.class);decode.setAccessible(true);
for(int seed=0;seed<160;seed++){Object value=create.newInstance(false,0,0,4,0);decode.invoke(value,false,wrap.newInstance((Object)packet(seed)),(byte)118);
int[] expected={8,18,1+seed%3,2,1,seed%7,seed%10,1+seed%40,30+seed,seed%32,0};for(int i=0;i<expected.length;i++)if(!get(board,value,F[i]).equals(expected[i]))throw new AssertionError(seed+":"+i);
int[] active=(int[])get(board,value,F[18]);if(!Arrays.equals(active,new int[]{16+seed%7,16+(seed+1)%7}))throw new AssertionError("active cells");int[] settled=(int[])get(board,value,F[17]);if(settled.length!=144||settled[136]!=(16+seed%7))throw new AssertionError("settled cells");
StringBuilder trace=new StringBuilder().append(seed);for(String field:F){Object v=get(board,value,field);trace.append(':').append(v instanceof int[]?Arrays.toString((int[])v):v);}System.out.println(trace);}}
}`);
    const root = readable ? named : input;
    const argumentsFile = path.join(directory,'sources.args');
    fs.writeFileSync(argumentsFile,[...sourceInventory(root).map(file=>JSON.stringify(path.join(root,file.path))),JSON.stringify(harness)].join('\n')+'\n');
    captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-sourcepath','','-classpath',classpath,'-d',classes,'@'+argumentsFile]);
    outputs.push(captureProcess('java',['-Djava.awt.headless=true','-cp',[shims,classes,classpath].join(path.delimiter),'SnapshotProbe']).stdout);
  }
  assert.deepEqual(outputs[1],outputs[0],'named snapshots differ from pinned raw Java');
  return {scenarios:160,rawNamedIdentical:true,independentFieldExpectations:true,traceSha256:digest(outputs[0])};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'deko-snapshot-check-'));
  try {
    const rules=JSON.parse(fs.readFileSync(path.join(workflowRoot,'dekobloko-rules.json')));
    const mapping=JSON.parse(fs.readFileSync(path.join(funorbRepository,'decompilation/dekobloko-naming.json')));
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    console.log(JSON.stringify(verifySnapshots(input,path.join(funorbRepository,'games/dekobloko'),mapping,stubs.jar,temporary)));
  }catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
  finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
