import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

export function introManifest(player,runtime) {
  const provenance=JSON.parse(fs.readFileSync(path.join(player,'provenance.json')));
  if(provenance.generatedBy!=='dekobloko-geoblox-intro')throw new Error('Not an intro player');
  const classes=[];
  function visit(directory,prefix='') {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name=prefix+entry.name, file=path.join(directory,entry.name);
      if(entry.isDirectory())visit(file,name+'/');
      else if(name.endsWith('.class'))classes.push({filename:name,content:fs.readFileSync(file).toString('base64')});
    }
  }
  visit(path.join(player,'classes'));
  const integrationSha256=sha256(Buffer.concat([
    'runtime.mjs','../launcher/browser-loader/browser-image-decoder.mjs',
    '../launcher/browser-loader/browser-inflater.mjs','../launcher/browser-loader/code-pack.mjs',
  ].map(name=>fs.readFileSync(path.resolve(here,name)))));
  return {classes,provenance,sourceSha256:sha256(JSON.stringify(classes)),integrationSha256,
    jvmOptions:{...JSON.parse(fs.readFileSync(path.resolve(here,'../launcher/browser-runtime.json'))).jvmOptions,
      prepareWasmPreparedUpgradesOnly:true},
    runtimeSha256:sha256(fs.readFileSync(path.join(runtime,'jvm-debug.js')))};
}
