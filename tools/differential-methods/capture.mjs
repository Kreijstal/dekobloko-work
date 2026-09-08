import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function page(code) {
  const r = await (await fetch('http://localhost:9226', {method:'POST',body:JSON.stringify({context:'content',script:`return window.wrappedJSObject.eval(${JSON.stringify(code)});`})})).json();
  if(r[2]) throw Error(JSON.stringify(r[2]));
  return r[3]?.value;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href&&process.argv[2]) {
  const out=path.resolve(process.argv[2]); fs.mkdirSync(out,{recursive:true});
  await page('window.geobloxSession.debug.debugController.pause(); true');
  const entries=JSON.parse(await page('JSON.stringify(window.geobloxSession.compilation.artifacts.map(a=>a.outputPath))'));
  const hashes={};
  for(const name of entries) {
    const b64=await page(`(()=>{const b=window.geobloxSession.debug.readWorkspaceFile(${JSON.stringify(name)});let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s)})()`);
    const bytes=Buffer.from(b64,'base64'), target=path.join(out,name.replace(/^\/classes\//,''));
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
    hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');
  }
  fs.writeFileSync(path.join(out,'class-hashes.json'),JSON.stringify(hashes,null,2));
  console.log(`Captured ${entries.length} unchanged classfiles; diagnostic game paused.`);
}
