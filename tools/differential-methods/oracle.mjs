// Independent JS5 sprite decoder, not a call to the Java implementation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=path.resolve(process.argv[2]),b=fs.readFileSync(path.join(dir,'candy.bin'));
const count=b.readUInt16BE(b.length-2),meta=b.length-7-count*8;
if(count!==1)throw Error('This fixture contract requires exactly one sprite');
let p=meta;const u16=()=>{const v=b.readUInt16BE(p);p+=2;return v;};
const width=u16(),height=u16(),paletteSize=b[p++]+1;
const x=u16(),y=u16(),w=u16(),h=u16();
p=meta-3*(paletteSize-1);const palette=[0];
for(let i=1;i<paletteSize;i++){palette[i]=b.readUIntBE(p,3)||1;p+=3;}
p=0;const flags=b[p++],pixels=new Int32Array(w*h);
if(flags&1){for(let xx=0;xx<w;xx++)for(let yy=0;yy<h;yy++)pixels[yy*w+xx]=palette[b[p++]];}
else for(let i=0;i<pixels.length;i++)pixels[i]=palette[b[p++]];
if(flags&2)p+=pixels.length; // sc.a expands indices; it does not consume alpha.
if(p!==meta-3*(paletteSize-1))throw Error('Unconsumed or malformed pixel payload');
let checksum=1;for(const v of [width,height,y,x,w,h,...pixels])checksum=(Math.imul(checksum,31)+v)|0;
const canonical=Buffer.alloc(pixels.length*4);pixels.forEach((v,i)=>canonical.writeInt32BE(v,i*4));
const oracle={checksum,width,height,x,y,w,h,flags,pixels:pixels.length,pixelSha256:crypto.createHash('sha256').update(canonical).digest('hex'),contract:'sc.a palette-expanded first sprite; alpha intentionally not represented by this game operation'};
fs.writeFileSync(path.join(dir,'oracle.json'),JSON.stringify(oracle,null,2));
fs.writeFileSync(path.join(dir,'pixels.bin'),canonical);
console.log(oracle);
