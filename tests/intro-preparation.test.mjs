import test from 'node:test';
import assert from 'node:assert/strict';
import {introPreparationPolicy} from '../apps/intro/manifest.mjs';
import {configureIntro} from '../apps/intro/runtime.mjs';
import {geobloxPreparationPolicy, selectGamePreparationProfile} from '../apps/launcher/browser-loader/preparation-profile.mjs';

const appletSource='b168d7edeb104599156b5f908df62dfdc9f3b250';
const appletPatch='catalog-account-server-v11-voice-cursor';

test('intro and applet share rotation preparation while keeping their entry points',()=>{
  const intro=introPreparationPolicy('d1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b98');
  const applet=selectGamePreparationProfile({internalName:'geoblox'},appletSource,appletPatch);
  assert.deepEqual(applet.priorityMethods,intro.priorityMethods);
  assert.deepEqual(applet.wasmCalleeMethods,intro.wasmCalleeMethods);
  assert.equal(applet.entryMethods,undefined,'the applet never receives the standalone entry point');
  applet.priorityMethods.pop();
  assert.equal(geobloxPreparationPolicy(appletSource,appletPatch).priorityMethods.length,4);
  assert.equal(intro.priorityMethods.length,4);
  for(const [source,patch] of [[appletSource,'changed'],['changed',appletPatch],[undefined,appletPatch],
    [appletSource,'standalone-intro-v1']]) {
    assert.equal(selectGamePreparationProfile({internalName:'geoblox'},source,patch),undefined);
  }
  assert.equal(selectGamePreparationProfile({internalName:'dekobloko'},appletSource,appletPatch),undefined);
});

test('shared preparation preserves supplied budgets and adds dependencies without duplicates',()=>{
  const shared=geobloxPreparationPolicy(appletSource,appletPatch);
  const policy={maxMethods:10,entryMethods:['Applet.init()V'],wasmRootMethods:['Render.draw()V'],wasmLoopsOnly:true,
    priorityMethods:[shared.priorityMethods[0],'Render.draw()V'],
    wasmCalleeMethods:[shared.wasmCalleeMethods[0],'Render.fill()V']};
  const supplied={internalName:'geoblox',preparationProfiles:[{sourceIdentity:appletSource,patchIdentity:appletPatch,policy}]};
  for(const game of [{internalName:'geoblox'},supplied]) {
    const selected=selectGamePreparationProfile(game,appletSource,appletPatch,policy);
    assert.equal(selected.maxMethods,10);
    assert.deepEqual(selected.entryMethods,['Applet.init()V']);
    assert.deepEqual(selected.wasmRootMethods,['Render.draw()V']);
    assert.equal(selected.wasmLoopsOnly,true);
    assert.deepEqual(selected.priorityMethods,[...shared.priorityMethods,'Render.draw()V']);
    assert.deepEqual(selected.wasmCalleeMethods,[...shared.wasmCalleeMethods,'Render.fill()V']);
    selected.priorityMethods.pop();
    assert.deepEqual(policy.priorityMethods,[shared.priorityMethods[0],'Render.draw()V']);
  }
  assert.equal(selectGamePreparationProfile(supplied,'changed',appletPatch,policy),policy);
});

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
