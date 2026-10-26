import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {digest} from './game-export.mjs';
import {inventory} from '../scripts/publish-decompiled-games.mjs';
import {withPinnedCompiler} from './pinned-compiler.mjs';

export const aceHudCompiler = {commit: 'c6f6a1e61b0088e882236d732145a84775fd9cb8',
  sourceArchiveSha256: '2e63dcc7a33667d65beb99316a9937c1946b16357d343e69c46bd3968d1d2ddd'};
const originalClassesSha256 = '9f0daf3471d01ae2de9a8a71504d0bf94fb751c66e0b5c3553477eb22b9c7f15';
const url = 'https://static.alterorb.net/launcher/v3/jars/aceofskies.jar';

export function aceOriginalClasses(temporary) {
  const cache = path.join(os.homedir(), '.cache/dekobloko/gamepacks'), jar = path.join(cache, 'aceofskies.jar');
  fs.mkdirSync(cache, {recursive: true});
  const downloaded = !fs.existsSync(jar), candidate = path.join(temporary, 'aceofskies.jar');
  const input = downloaded ? candidate : jar;
  if (downloaded) captureProcess('curl', ['-L', '--fail', '--silent', '--show-error', '--output', candidate, url]);
  const classes = path.join(temporary, 'original-bytecode'); fs.mkdirSync(classes);
  captureProcess('python3', ['-c', `import pathlib,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as jar:
 for item in jar.infolist():
  if not item.filename.endswith('.class'):continue
  name=pathlib.PurePosixPath(item.filename)
  if name.is_absolute() or '..' in name.parts:raise ValueError('Unsafe JAR path')
  target=pathlib.Path(sys.argv[2])/name
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(jar.read(item))`, input, classes]);
  const identity = inventory(classes, '.class');
  assert.equal(identity.files, 545); assert.equal(identity.sha256, originalClassesSha256, 'Fixed original gamepack differs from the catalog');
  if (downloaded) fs.copyFileSync(candidate, jar);
  return {directory: classes, sourceUrl: url, gamepackSha256: digest(fs.readFileSync(input)),
    originalClassesSha256: identity.sha256, files: identity.files};
}

// Application-specific method selection; reconstruction is supplied entirely
// by the unmodified, pinned generic decompiler and its default proof checks.
export function reconstructAceHud(input, temporary) {
  const bytecode = aceOriginalClasses(temporary);
  return withPinnedCompiler(aceHudCompiler.commit, aceHudCompiler.sourceArchiveSha256, (require, root) => {
    const {getAST} = require('jvm_parser'), {convertJson} = require(path.join(root, 'src/parsing/convert_tree.js'));
    const regionStructurer = require(path.join(root, 'src/decompiler/exceptionStructurer.js'));
    const {verifyStructuredFlow} = require(path.join(root, 'src/decompiler/structuredFlowVerifier.js'));
    const structure = regionStructurer.structureMethod, proofs = [];
    // Observe the default compiler result, without changing any arguments,
    // policy or returned tree. Recheck its original-edge certificates.
    regionStructurer.structureMethod = (...args) => {
      const result = structure(...args);
      if (result.ok) proofs.push(result);
      return result;
    };
    const {decompileAstRoot, buildExceptionModel} = require(path.join(root, 'src/decompiler/cfr.js'));
    const {tokenizeJava} = require(path.join(root, 'src/java-frontend/lexer.js'));
    const roots = inventory(bytecode.directory, '.class').entries.map(([file]) => {
      const parsed = getAST(new Uint8Array(fs.readFileSync(path.join(bytecode.directory, file))));
      return convertJson(parsed.ast, parsed.constantPool);
    });
    const exceptionModel = buildExceptionModel(roots.flatMap(root => root.classes || []));
    const selected = structuredClone(roots.find(root => root.classes[0].className === 'pk'));
    selected.classes[0].items = selected.classes[0].items.filter(item => !item.method ||
      item.method.name === 'a' && item.method.descriptor === '(IIIZIIIZI)V');
    assert.equal(selected.classes[0].items.filter(item => item.method).length, 1);
    const make = () => {
      const before = proofs.length;
      const diagnostics = [], source = decompileAstRoot(structuredClone(selected), {exceptionModel, diagnostics});
      assert.deepEqual(diagnostics, []); assert.doesNotMatch(source, /switch\s*\(statePc\)/);
      assert.equal(proofs.length, before + 1);
      const proof = proofs.at(-1);
      assert.equal(proof.regionExitsVerified, true);
      assert.equal(regionStructurer.verifyRegionExitContracts(proof.tree, proof.regionExitContracts), true);
      assert.equal(regionStructurer.verifyRegionFlowContracts(proof.tree, proof.regionExitContracts), true);
      assert.equal(verifyStructuredFlow(proof.tree, proof.regionMethodFlow), true);
      return source;
    };
    const candidate = make(); assert.equal(make(), candidate, 'HUD reconstruction is not deterministic');
    function body(source) {
      const lexed = tokenizeJava(source); assert.deepEqual(lexed.diagnostics, []);
      const tokens = lexed.tokens, parameters = ['int','int','int','boolean','int','int','int','boolean','int'];
      const header = ['void', 'a', '('];
      parameters.forEach((type, i) => {if (i) header.push(','); header.push(type, 'param' + i);}); header.push(')', '{');
      const found = [];
      for (let i = 0; i < tokens.length; i++) if (header.every((text, j) => tokens[i + j]?.text === text)) found.push(i + header.length - 1);
      assert.equal(found.length, 1, 'Selected HUD method is not unique');
      const open = found[0]; let depth = 1, close = open + 1;
      for (; close < tokens.length; close++) {if (tokens[close].text === '{') depth++; if (tokens[close].text === '}' && !--depth) break;}
      assert.equal(depth, 0);
      return [tokens[open].range.startOffset, tokens[close].range.endOffset];
    }
    const file = path.join(input, 'pk.java'), original = fs.readFileSync(file, 'utf8');
    const [start, end] = body(original), [newStart, newEnd] = body(candidate);
    const oldBody = original.slice(start, end), newBody = candidate.slice(newStart, newEnd);
    assert.match(oldBody, /switch\s*\(statePc\)/);
    fs.writeFileSync(path.join(temporary, 'original-pk.java'), original);
    fs.writeFileSync(file, original.slice(0, start) + newBody + original.slice(end));
    return {method: 'pk.a(IIIZIIIZI)V', compiler: aceHudCompiler, bytecode: {
      sourceUrl: bytecode.sourceUrl, gamepackSha256: bytecode.gamepackSha256,
      files: bytecode.files, originalClassesSha256: bytecode.originalClassesSha256},
      oldBodySha256: digest(oldBody), newBodySha256: digest(newBody),
      oldBodyLines: oldBody.split('\n').length, newBodyLines: newBody.split('\n').length,
      defaultCompilerRecovery: true, regionExitsVerified: true, regionSourceFlowVerified: true,
      outerRoutingVerified: true, deterministic: true, stateMachine: false};
  });
}
