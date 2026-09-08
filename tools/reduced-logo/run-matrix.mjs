import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [origin,output,...modes]=process.argv.slice(2);
if(!origin||!output||!modes.length)throw Error('Usage: node run-matrix.mjs ORIGIN OUTPUT MODE...');
fs.mkdirSync(output,{recursive:true});
async function bridge(args){const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify(args)})).json();if(r[2])throw Error(JSON.stringify(r[2]));return r[3].value;}
for(const mode of modes){
 const target=new URL('/?mode='+encodeURIComponent(mode),origin);
 if(new URL(origin).searchParams.get('verify')==='pixels')target.searchParams.set('verify','pixels');
 const url=target.href;
 await bridge({context:'chrome',script:'const w=Services.wm.getMostRecentWindow("navigator:browser");w.gBrowser.selectedBrowser.loadURI(Services.io.newURI('+JSON.stringify(url)+'),{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()});return true;'});
 let done=false;
 for(let i=0;i<180;i++){
  await new Promise(r=>setTimeout(r,1000));
  const state=JSON.parse(await bridge({context:'content',script:'return window.wrappedJSObject.eval("JSON.stringify(window.gapResult||{})");'}))||{};
  if(state.state==='failed')throw Error(JSON.stringify(state));
  if(state.mode===mode&&state.state==='completed'){
   console.log(execFileSync(process.execPath,[fileURLToPath(new URL('./collect.mjs',import.meta.url)),output+'/'+mode+'.json'],{encoding:'utf8'}).trim());done=true;break;
  }
 }
 if(!done)throw Error('Incomplete '+mode);
}
