import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {digest} from './game-export.mjs';
import {inventory} from '../scripts/publish-decompiled-games.mjs';
import {withPinnedCompiler} from './pinned-compiler.mjs';
import {sourceInventory, sourceIdentity} from './tools/readable-java.mjs';

export const aceRecoveryCompiler = {commit: 'c288eacc93fa01782116ea4bd01c7c78c028f9f7',
  sourceArchiveSha256: 'aab0ddf355c9552f609f6061924d56818118123a7585f85bcd038c64f94b186c'};
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
export function reconstructAceMethods(input, temporary) {
  // Retain the entire fixed historical input for native trace comparison.
  // All verification copies live in the workflow's automatically removed temp.
  fs.cpSync(input, path.join(temporary, 'historical-source'), {recursive: true});
  const bytecode = aceOriginalClasses(temporary);
  return withPinnedCompiler(aceRecoveryCompiler.commit, aceRecoveryCompiler.sourceArchiveSha256, (require, root) => {
    const {getAST} = require('jvm_parser'), {convertJson} = require(path.join(root, 'src/parsing/convert_tree.js'));
    const regionStructurer = require(path.join(root, 'src/decompiler/exceptionStructurer.js'));
    const {verifyStructuredFlow} = require(path.join(root, 'src/decompiler/structuredFlowVerifier.js'));
    const {buildCfgFromCode} = require(path.join(root, 'src/decompiler/structurer.js'));
    const structure = regionStructurer.structureMethod, proofs = [], plainProofs = [];
    // Observe the default compiler result, without changing any arguments,
    // policy or returned tree. Recheck its original-edge certificates.
    regionStructurer.structureMethod = (...args) => {
      const result = structure(...args);
      if (result.ok) {
        if (args[1]?.length) proofs.push(result);
        else {
          const cfg = buildCfgFromCode(args[0], []);
          const flow = {entry: cfg.entry, blocks: cfg.term.map((term, block) => ({block, term}))};
          assert.equal(verifyStructuredFlow(result.tree, flow), true, 'Plain reconstruction changed source CFG edges');
          plainProofs.push({tree: result.tree, flow});
        }
      }
      return result;
    };
    const {decompileAstRoot, buildExceptionModel} = require(path.join(root, 'src/decompiler/cfr.js'));
    const {tokenizeJava} = require(path.join(root, 'src/java-frontend/lexer.js'));
    const {parseDescriptor} = require(path.join(root, 'src/parsing/typeParser.js'));
    const roots = inventory(bytecode.directory, '.class').entries.map(([file]) => {
      const parsed = getAST(new Uint8Array(fs.readFileSync(path.join(bytecode.directory, file))));
      return convertJson(parsed.ast, parsed.constantPool);
    });
    const exceptionModel = buildExceptionModel(roots.flatMap(root => root.classes || []));
    const selected = structuredClone(roots.find(root => root.classes[0].className === 'pk'));
    // Three small methods use specialized emitters rather than a region
    // certificate. Preserve their base source, along with initialization.
    // Every other ordinary method has the generic original-edge proof below.
    const preservedMethods = ['a(IIIIIIB)V', 'd(II)V', 'e(I)V'];
    selected.classes[0].items = selected.classes[0].items.filter(item => !item.method ||
      !item.method.name.startsWith('<') && !preservedMethods.includes(item.method.name + item.method.descriptor) && item.method.attributes?.some(attribute =>
        attribute.type === 'code' && attribute.code.exceptionTable?.length));
    const methods = selected.classes[0].items.filter(item => item.method).map(({method}) => {
      const descriptor = parseDescriptor(method.descriptor);
      return {name: method.name, descriptor: method.descriptor,
        parameters: descriptor.params.map(type => type.replace(/^java\.lang\./, '')), returnType: descriptor.returnType,
        dispatcher: method.name === 'a' && method.descriptor === '(IIIZIIIZI)V'};
    });
    assert.equal(methods.length, 51, 'Fixed protected method inventory differs');
    const make = () => {
      const before = proofs.length;
      const diagnostics = [], source = decompileAstRoot(structuredClone(selected), {exceptionModel, diagnostics});
      assert.deepEqual(diagnostics, []); assert.doesNotMatch(source, /switch\s*\(statePc\)/);
      assert.equal(proofs.length, before + methods.length);
      for (const proof of proofs.slice(before)) {
        assert.equal(proof.regionExitsVerified, true);
        assert.equal(regionStructurer.verifyRegionExitContracts(proof.tree, proof.regionExitContracts), true);
        assert.equal(regionStructurer.verifyRegionFlowContracts(proof.tree, proof.regionExitContracts), true);
        assert.equal(verifyStructuredFlow(proof.tree, proof.regionMethodFlow), true);
      }
      return source;
    };
    const candidate = make(); assert.equal(make(), candidate, 'Method reconstruction is not deterministic');
    function body(source, method) {
      const lexed = tokenizeJava(source); assert.deepEqual(lexed.diagnostics, []);
      const tokens = lexed.tokens, parameters = method.parameters;
      const header = [...tokenizeJava(method.returnType).tokens.filter(t => t.kind !== 'eof').map(t => t.text), method.name, '('];
      parameters.forEach((type, i) => {if (i) header.push(','); header.push(...tokenizeJava(type).tokens.filter(t => t.kind !== 'eof').map(t => t.text), 'param' + i);}); header.push(')', '{');
      const found = [];
      for (let i = 0; i < tokens.length; i++) if (header.every((text, j) => tokens[i + j]?.text === text)) found.push(i + header.length - 1);
      assert.equal(found.length, 1, 'Selected method is not unique: ' + method.name + method.descriptor);
      const open = found[0]; let depth = 1, close = open + 1;
      for (; close < tokens.length; close++) {if (tokens[close].text === '{') depth++; if (tokens[close].text === '}' && !--depth) break;}
      assert.equal(depth, 0);
      return [tokens[open].range.startOffset, tokens[close].range.endOffset];
    }
    const file = path.join(input, 'pk.java'), original = fs.readFileSync(file, 'utf8');
    const edits = [], certificates = [];
    for (const method of methods) {
      const [start, end] = body(original, method), [newStart, newEnd] = body(candidate, method);
      const oldBody = original.slice(start, end), newBody = candidate.slice(newStart, newEnd);
      if (method.dispatcher) assert.match(oldBody, /switch\s*\(statePc\)/);
      edits.push({start, end, body: newBody});
      certificates.push({method: 'pk.' + method.name + method.descriptor,
        oldBodySha256: digest(oldBody), newBodySha256: digest(newBody),
        oldBodyLines: oldBody.split('\n').length, newBodyLines: newBody.split('\n').length});
    }
    let prepared = original;
    for (const edit of edits.sort((a,b) => b.start - a.start))
      prepared = prepared.slice(0, edit.start) + edit.body + prepared.slice(edit.end);
    fs.writeFileSync(file, prepared);

    // The sprite decoder has no exception table. Reconstruct its body with a
    // separate original-edge proof, keeping every other class member at base.
    const sprite = structuredClone(roots.find(root => root.classes[0].className === 'vd'));
    sprite.classes[0].items = sprite.classes[0].items.filter(item => !item.method ||
      item.method.name === 'a' && item.method.descriptor === '([B)[Lvd;');
    const spriteMethods = sprite.classes[0].items.filter(item => item.method);
    assert.equal(spriteMethods.length, 1);
    const {method: selectedSpriteMethod} = spriteMethods[0], spriteDescriptor = parseDescriptor(selectedSpriteMethod.descriptor);
    const spriteMethod = {name: selectedSpriteMethod.name, descriptor: selectedSpriteMethod.descriptor,
      parameters: spriteDescriptor.params, returnType: spriteDescriptor.returnType};
    const makeSprite = () => {
      const before = plainProofs.length, diagnostics = [];
      const source = decompileAstRoot(structuredClone(sprite), {exceptionModel, diagnostics});
      assert.deepEqual(diagnostics, []); assert.doesNotMatch(source, /switch\s*\(statePc\)/);
      assert.equal(plainProofs.length, before + 1);
      for (const proof of plainProofs.slice(before)) assert.equal(verifyStructuredFlow(proof.tree, proof.flow), true);
      return source;
    };
    const spriteCandidate = makeSprite(); assert.equal(makeSprite(), spriteCandidate);
    const spriteFile = path.join(input, 'vd.java'), originalSprite = fs.readFileSync(spriteFile, 'utf8');
    const [spriteStart, spriteEnd] = body(originalSprite, spriteMethod), [newSpriteStart, newSpriteEnd] = body(spriteCandidate, spriteMethod);
    const oldSpriteBody = originalSprite.slice(spriteStart, spriteEnd), newSpriteBody = spriteCandidate.slice(newSpriteStart, newSpriteEnd);
    fs.writeFileSync(spriteFile, originalSprite.slice(0, spriteStart) + newSpriteBody + originalSprite.slice(spriteEnd));
    const plainMethods = [{method: 'vd.' + spriteMethod.name + spriteMethod.descriptor,
      oldBodySha256: digest(oldSpriteBody), newBodySha256: digest(newSpriteBody),
      oldBodyLines: oldSpriteBody.split('\n').length, newBodyLines: newSpriteBody.split('\n').length,
      originalCfgEdgesVerified: true}];
    // Apply the very same default declaration proofs to all pinned prepared
    // sources, including methods preserved above. No bytecode preprocessing or
    // game control flow is repeated/replaced by this source-level operation.
    const {localizeCompilationUnitDeclarations} = require(path.join(root, 'src/decompiler/javaAstEmitter.js'));
    const scopeInput = sourceIdentity(sourceInventory(input)), changedFiles = [];
    const counts = {bodiesLocalized: 0, declarationsMoved: 0, declarationsMerged: 0, inertStoresRemoved: 0};
    for (const entry of sourceInventory(input)) {
      const file = path.join(input, entry.path), source = fs.readFileSync(file, 'utf8');
      const localized = localizeCompilationUnitDeclarations(source);
      assert.deepEqual(localizeCompilationUnitDeclarations(source), localized, 'Declaration recovery is not deterministic: ' + entry.path);
      assert.equal(localizeCompilationUnitDeclarations(localized.source).source, localized.source, 'Declaration recovery is not idempotent: ' + entry.path);
      if (localized.source === source) continue;
      for (const key of Object.keys(counts)) counts[key] += localized[key];
      changedFiles.push({file: entry.path, inputSha256: entry.sha256, outputSha256: digest(localized.source),
        bodiesLocalized: localized.bodiesLocalized, declarationsMoved: localized.declarationsMoved,
        declarationsMerged: localized.declarationsMerged, inertStoresRemoved: localized.inertStoresRemoved});
      fs.writeFileSync(file, localized.source);
    }
    const declarationScopes = {inputTreeSha256: scopeInput, outputTreeSha256: sourceIdentity(sourceInventory(input)),
      filesChecked: sourceInventory(input).length, filesChanged: changedFiles.length, ...counts,
      deterministic: true, idempotent: true, defaultMethodBodyProofs: true, files: changedFiles};
    return {methods: certificates, plainMethods, preservedMethods, declarationScopes, compiler: aceRecoveryCompiler, bytecode: {
      sourceUrl: bytecode.sourceUrl, gamepackSha256: bytecode.gamepackSha256,
      files: bytecode.files, originalClassesSha256: bytecode.originalClassesSha256},
      defaultCompilerRecovery: true, regionExitsVerified: true, regionSourceFlowVerified: true,
      outerRoutingVerified: true, plainSourceFlowVerified: true, deterministic: true, stateMachine: false};
  });
}
