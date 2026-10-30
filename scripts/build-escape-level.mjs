#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {switchbackSalvage,encodeEscapeLevel} from '../apps/launcher/browser-loader/escape-levels.mjs';
const [id,output,...extra]=process.argv.slice(2);
if(id!==switchbackSalvage.id||!output||extra.length)throw new Error('Usage: node scripts/build-escape-level.mjs switchback-salvage OUTPUT.bin');
const bytes=encodeEscapeLevel(switchbackSalvage);
fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({id,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
