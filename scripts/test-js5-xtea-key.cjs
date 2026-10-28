'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {pack} = require('./lib/js5-cache-recovery.cjs');
const {decryptContainer, findKeys} = require('./find-js5-xtea-key.cjs');

const jar = process.env.ESCAPE_GAMEPACK || path.resolve(__dirname, '../.work/gamepacks/escapevector.jar');
test('candidate recovery agrees with the original Java client encryption, including partial blocks and disk trailers', {
  skip: !fs.existsSync(jar) && 'original local Escape Vector JAR required',
}, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'js5-xtea-oracle-'));
  const key = [-1920480496, -1423914110, 951774544, -1419269290];
  try {
    // n.a is the original game's XTEA encryptor, not a duplicate in this test.
    fs.writeFileSync(path.join(tmp, 'KeyOracle.java'), `import java.nio.file.*;
public class KeyOracle {public static void main(String[] args)throws Exception {
 byte[] raw=Files.readAllBytes(Paths.get(args[0]));byte[] body=new byte[raw.length-5];
 System.arraycopy(raw,5,body,0,body.length);n packet=new n(body);packet.m=body.length;
 packet.a(1527987844,new int[]{-1920480496,-1423914110,951774544,-1419269290});
 System.arraycopy(body,0,raw,5,body.length);Files.write(Paths.get(args[1]),raw);
}}`);
    const javac = spawnSync('javac', ['--release','8','-cp',jar,'-d',tmp,path.join(tmp,'KeyOracle.java')], {encoding:'utf8'});
    assert.equal(javac.status, 0, javac.stderr);
    for (const compression of [1,2]) for (const size of [31,128,1027]) {
      const plain = Buffer.from(Array.from({length:size}, (_, i) => (i * 137 + i % 7) & 255));
      let container;
      if (compression === 2) container = pack(plain);
      else {
        const compressed = spawnSync('bzip2',['-1c'],{input:plain});
        assert.equal(compressed.status,0);
        const body=compressed.stdout.subarray(4), header=Buffer.alloc(9);
        header[0]=1;header.writeUInt32BE(body.length,1);header.writeUInt32BE(plain.length,5);
        container=Buffer.concat([header,body]);
      }
      fs.writeFileSync(path.join(tmp,'plain.bin'),container);
      const native=spawnSync('java',['-cp',tmp+path.delimiter+jar,'KeyOracle',path.join(tmp,'plain.bin'),path.join(tmp,'encrypted.bin')],{encoding:'utf8'});
      assert.equal(native.status,0,native.stderr);
      const encrypted=Buffer.concat([fs.readFileSync(path.join(tmp,'encrypted.bin')),Buffer.from([0,6])]);
      assert.deepEqual(decryptContainer(encrypted,key),container);
      const result=findKeys(encrypted,[[0,0,0,0],key]);
      assert.equal(result.tested,2);assert.equal(result.headerMatches,1);assert.equal(result.matches.length,1);
      assert.deepEqual(result.matches[0].plain,plain);
      // A matching prefix must not accept damage later in the compressed data.
      const corrupt = Buffer.from(encrypted);
      corrupt[container.length - 3] ^= 1;
      const rejected = findKeys(corrupt, [key]);
      assert.equal(rejected.headerMatches,1);assert.equal(rejected.matches.length,0);
    }
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('candidate scanner rejects malformed keys and truncated/unsupported containers', () => {
  const raw=Buffer.alloc(17);raw[0]=1;raw.writeUInt32BE(8,1);
  assert.throws(()=>findKeys(raw,[[1,2,3]]),/four 32-bit/);
  assert.throws(()=>findKeys(raw,[[1,2,3,2**40]]),/four 32-bit/);
  assert.throws(()=>findKeys(raw,[null]),/four 32-bit/);
  assert.throws(()=>findKeys(Buffer.alloc(4),[]),/Expected/);
  raw.writeUInt32BE(1000,1);assert.throws(()=>findKeys(raw,[]),/Truncated/);
});
