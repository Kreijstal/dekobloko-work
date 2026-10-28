import {test} from 'node:test';
import assert from 'node:assert/strict';
import {methodShapes,matchMethods} from '../match-game-methods.mjs';

function fixture(methodName,argument,body) {
  const source=`class Reader {int ${methodName}(int ${argument}) {${body}}}`;
  return methodShapes({symbols:[{symbol:'C:r',renamedName:'Reader'},
    {symbol:'M:r.a(I)I',renamedSymbol:`M:Reader.${methodName}(I)I`,renamedName:methodName,
      declaration:{file:'r.java',start:source.indexOf(methodName+'(')}}],
    files:[{original:'r.java',renamed:'Reader.java',edits:[]}]},()=>source);
}

test('shapes ignore identifier spelling and comments but preserve constants, operators and identifier reuse',()=>{
  const a=fixture('a','x','int y=x+3; /* } */ return y*y;');
  const b=fixture('squareAdjusted','input','int value=input+3; return value*value;');
  assert.equal(a[0].shape,b[0].shape);
  assert.notEqual(a[0].shape,fixture('a','x','int y=x-3; return y*y;')[0].shape);
  assert.notEqual(a[0].shape,fixture('a','x','int y=x+4; return y*y;')[0].shape);
  assert.notEqual(a[0].shape,fixture('a','x','int y=x+3; return y*x;')[0].shape);
});

test('literal braces stay inside strings and ambiguous names never become suggestions',()=>{
  const target=fixture('a','x','String label="}"; return x+label.length();');
  const one=fixture('measure','y','String text="}"; return y+text.length();');
  const two=one.map(row=>({...row,name:'differentMeaning'}));
  assert.equal(matchMethods(target,one,0)[0].proposedName,'measure');
  assert.deepEqual(matchMethods(target,[...one,...two],0),[]);
  assert.deepEqual(matchMethods(target,one,10000),[]);
  assert.deepEqual(matchMethods(target,one.map(row=>({...row,owner:'Other'})),0),[]);
});

test('source offsets account for prior variable-length dictionary edits and reject stale source',()=>{
  const source='class LongerReader {int a(){return 1;}}';
  const mapping={symbols:[{symbol:'C:r',renamedName:'LongerReader'},
    {symbol:'M:r.a()I',renamedName:'a',renamedSymbol:'M:LongerReader.a()I',declaration:{file:'r.java',start:13}}],
    files:[{original:'r.java',renamed:'LongerReader.java',edits:[{start:6,end:7,renamed:'LongerReader'}]}]};
  assert.equal(methodShapes(mapping,()=>source).length,1);
  assert.throws(()=>methodShapes(mapping,()=>source.replace('int a()','int b()')),/Stale/);
});

test('review inventory exposes exact bodies and method modifiers without borrowing class modifiers',()=>{
  const source='public class a {\n public\n static void b() {String text="}";}\n private static void c() {}\n}';
  const mapping={symbols:[{symbol:'C:a',renamedName:'a'},...['b','c'].map(name=>({
    symbol:`M:a.${name}()V`,renamedName:name,
    declaration:{file:'a.java',start:source.indexOf(name+'()')},
  }))],files:[{original:'a.java',renamed:'a.java',edits:[]}]};
  assert.deepEqual(methodShapes(mapping,()=>source),[]);
  const rows=methodShapes(mapping,()=>source,{includeOpaqueOwners:true});
  assert.equal(rows.length,2);
  assert.equal(rows[0].publicStaticVoid,true);
  assert.equal(rows[1].publicStaticVoid,false);
  assert.equal(source.slice(rows[0].bodyStart,rows[0].bodyEnd),'{String text="}";}');
  assert.equal(source.slice(rows[1].bodyStart,rows[1].bodyEnd),'{}');
});
