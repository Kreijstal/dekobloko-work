import {page} from './capture.mjs';
const [url,mode]=process.argv.slice(2);
if(!/^http:\/\/localhost:1821[2-5]\/$/.test(url||''))throw Error('Expected isolated benchmark URL on ports 18212–18215');
async function chrome(script){const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'chrome',script})})).json();if(r[2])throw Error(JSON.stringify(r[2]));return r[3]?.value;}
if(mode!=='--attach')await chrome(`const w=Services.wm.getMostRecentWindow('navigator:browser');w.gBrowser.selectedBrowser.loadURI(Services.io.newURI(${JSON.stringify(url)}),{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});return true;`);
const start=Date.now();let last='',arrived=mode==='--attach';
while(Date.now()-start<720000){
 const status=JSON.parse(await page(`JSON.stringify({url:location.href,state:window.diffResult?.state,completed:window.diffResult?.completed,error:window.diffResult?.error,visible:document.visibilityState})`));
 if(status.url===url)arrived=true;
 if(status.url!==url){if(arrived||Date.now()-start>15000)throw Error('Diagnostic tab navigated away: '+status.url);await new Promise(resolve=>setTimeout(resolve,1000));continue;}
 const key=status.state+':'+status.completed;
 if(key!==last){console.log(status);last=key;}
 if(status.state==='completed')process.exit(0);
 if(status.state==='failed')throw Error(status.error||'Benchmark failed');
 if(status.state==='ready-for-visible-run'&&status.visible==='hidden'){
  await chrome(`const w=Services.wm.getMostRecentWindow('navigator:browser');if(w.gBrowser.selectedBrowser.currentURI.spec!==${JSON.stringify(url)})throw Error('Wrong window');w.restore();w.focus();return true;`);
 }
 await new Promise(resolve=>setTimeout(resolve,10000));
}
throw Error('Bounded Firefox runner timeout');
