import test from 'node:test';
import assert from 'node:assert/strict';
import {introPreparationPolicy} from '../apps/intro/manifest.mjs';
import {configureIntro} from '../apps/intro/runtime.mjs';

test('the measured helper profile applies only to its class and patch identity',()=>{
  const matching=introPreparationPolicy('d1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b98');
  assert.equal(matching.wasmCalleeMethods.length,4);
  assert.deepEqual(matching.priorityMethods,matching.wasmCalleeMethods);
  for(const source of [undefined,'changed', 'd1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b99']) {
    const unknown=introPreparationPolicy(source);
    assert.equal(unknown.wasmCalleeMethods,undefined);
    assert.equal(unknown.priorityMethods,undefined);
    assert.deepEqual(unknown.entryMethods,matching.entryMethods);
  }
  matching.wasmCalleeMethods.pop();
  assert.equal(introPreparationPolicy('d1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b98')
    .wasmCalleeMethods.length,4,'callers cannot mutate the shared profile');
});

test('intro configuration preserves selected helper preparation without executing Java',()=>{
  const policy={wasmCalleeMethods:['Helper.work(I)I'],priorityMethods:['Helper.work(I)I'],maxMethods:10};
  const controller={options:{jit:{codegen:true}}};
  configureIntro(controller,{jit:{preparationPolicy:policy},wasmHeap:true});
  assert.deepEqual(controller.options.jit.preparationPolicy,{...policy,
    entryMethods:['GeobloxIntro$Browser.main([Ljava/lang/String;)V']});
  assert.equal(controller.options.prepareBeforeMain,true);
  assert.equal(controller.options.wasmHeap,true);
  assert.equal(policy.entryMethods,undefined,'input policy is not mutated');
});
