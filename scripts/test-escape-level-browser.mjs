// Full input-only playthrough in the real browser client. A local cloner dev
// server is required. All browser/profile state is owned and removed afterwards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import {installEscapeLevelPilot} from '../apps/launcher/escape-level-pilot.mjs';
import {switchbackSalvage,encodeEscapeLevel} from '../apps/launcher/browser-loader/escape-levels.mjs';
const require=createRequire(new URL('../../blank-github-cloner/package.json',import.meta.url));
const {chromium}=require('playwright');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'escape-level-browser-'));
let context;
try {
  context=await chromium.launchPersistentContext(path.join(temporary,'profile'),{
    headless:true,viewport:{width:1000,height:800},args:['--no-sandbox','--disable-background-timer-throttling'],
  });
  const page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(0);page.setDefaultNavigationTimeout(0);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.routeWebSocket('**',socket=>socket.close());
  const url=new URL(process.argv[2]||'http://127.0.0.1:5173/');
  url.searchParams.set('game','escapevector');url.searchParams.set('level',switchbackSalvage.id);url.searchParams.set('sources','local');
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.geobloxSession?.debug?.debugController?.jvm?.classes?.ShipHullGeometry?.staticFields?.get('field_h:Z'),{},{timeout:0});
  await page.evaluate(installEscapeLevelPilot);
  const canvas=page.locator('#awt-container canvas').last();
  await canvas.click({position:{x:320,y:203}});await page.waitForTimeout(700);
  await canvas.click({position:{x:192,y:260}});await page.waitForTimeout(700);
  await canvas.click({position:{x:506,y:120}});
  console.log('Playing Switchback Salvage using rotation and thrust inputs…');
  await page.waitForFunction(()=>{
    const p=window.escapeLevelPilot;
    return p&&!['waiting','flying','verifying'].includes(p.status);
  },{},{timeout:0});
  const result=await page.evaluate(()=>{
    const p=window.escapeLevelPilot;
    return {status:p.status,engineComplete:p.engineComplete,phase:p.phase,target:p.target,state:p.state,pickup:p.pickup,error:p.error,
      sourceIdentity:window.geobloxSession.sourceIdentity,traceSamples:p.trace.length};
  });
  console.log(JSON.stringify({...result,mapSha256:crypto.createHash('sha256').update(encodeEscapeLevel(switchbackSalvage)).digest('hex'),errors}));
  assert.equal(result.status,'completed');assert.equal(result.engineComplete,true);
  assert.equal(result.state.cargo,1);assert.equal(result.state.destroyed,0);
  assert.equal(result.state.easy,0);assert.equal(result.state.timeHack,0);
  assert.ok(result.state.fuel>0);assert.ok(result.state.shield>0);assert.deepEqual(errors,[]);
}finally{await context?.close();fs.rmSync(temporary,{recursive:true,force:true});}
