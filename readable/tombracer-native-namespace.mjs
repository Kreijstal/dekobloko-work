import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {digest, funorbRepository, verifyToolPin, workflowRoot} from './game-export.mjs';

const tools = path.join(workflowRoot, 'native-namespace');
const load = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const internal = name => name.replaceAll('.', '/');
const sorted = rows => rows.map(row => JSON.stringify(row)).sort();

function member(symbol) {
  const at = symbol.startsWith('M:') ? symbol.indexOf('(') : symbol.lastIndexOf(':');
  const dot = symbol.lastIndexOf('.', at);
  assert(at > dot && dot >= 2, 'Invalid resolved member identity');
  return {owner: internal(symbol.slice(2, dot)), name: symbol.slice(dot + 1, at),
    descriptor: symbol.slice(at + (symbol.startsWith('M:') ? 0 : 1))};
}

// This workflow consumes the original gamepack only as classfile data. It never
// initializes application classes, invokes application methods or loads SW3D.
export function verifyTombNativeNamespace(input, named, mapping, stubJar, temporary) {
  verifyToolPin();
  const policyFile = path.join(workflowRoot, 'tombracer-native-namespace.json');
  const policy = load(policyFile), dependencies = load(path.join(tools, 'dependencies.json'));
  assert.equal(policy.schema, 1); assert.equal(policy.game, 'tombracer');
  assert.equal(dependencies.schema, 1);
  assert.equal(digest(fs.readFileSync(stubJar)), load(path.join(workflowRoot,'tombracer-rules.json')).publication.stubJarSha256,
    'Compilation stubs differ from the reviewed source workflow');
  const originalJar = path.join(process.env.FUNORB_GAMEPACK_DIR || path.join(workflowRoot, '../.work/gamepacks'), 'tombracer.jar');
  assert.equal(digest(fs.readFileSync(originalJar)), policy.originalJarSha256, 'Original gamepack differs');
  const dependencyDirectory = process.env.MAVEN_REPOSITORY || path.join(os.homedir(), '.m2/repository');
  const jars = Object.entries(dependencies.artifacts).map(([artifact, hash]) => {
    const file = path.join(dependencyDirectory, ...dependencies.group.split('.'), artifact, dependencies.version, artifact + '-' + dependencies.version + '.jar');
    assert.equal(digest(fs.readFileSync(file)), hash, 'ASM dependency differs: ' + artifact);
    return file;
  });
  const inventory = sourceInventory(named), expected = mapping.files.map(f => ({path: f.renamed, sha256: f.outputSha256})).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.deepEqual(inventory, expected, 'Named source differs from resolved dictionary');
  const directory = path.join(temporary, 'native-namespace');
  fs.mkdirSync(directory);
  const stateFile = path.join(directory, 'build-state.json');
  const state = {status: 'running', stage: 'original-api', commands: []};
  const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
  const run = (command, args, stage, environment = {}) => {
    state.stage = stage; save();
    const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
    try {
      for (const [key, value] of Object.entries(environment)) process.env[key] = value;
      const result = captureProcess(command, args, {maxBuffer: 32 * 1024 * 1024});
      const log = path.join(directory, String(state.commands.length + 1).padStart(2, '0') + '-' + stage + '.log');
      fs.writeFileSync(log, Buffer.concat([result.stdout, result.stderr]), {flag: 'wx'});
      state.commands.push({command: [command, ...args], environment, exitCode: 0, log}); save();
      return result.stdout.toString();
    } catch (error) {
      const log = path.join(directory, String(state.commands.length + 1).padStart(2, '0') + '-' + stage + '-failed.log');
      fs.writeFileSync(log, Buffer.concat([error.stdout || Buffer.alloc(0), error.stderr || Buffer.alloc(0), Buffer.from(error.stack + '\n')]), {flag:'wx'});
      state.commands.push({command:[command,...args],environment,exitCode:error.status ?? null,error:error.message,log});save();
      throw error;
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  };
  try {
    const python = process.env.PYTHON || 'python3', java = process.env.JAVA || 'java', javac = process.env.JAVAC || 'javac';
    const independent = path.join(tools, 'verify-namespace.py'), originalApiFile = path.join(directory, 'original-api.json');
    run(python, ['-I', independent, 'inspect', originalJar, originalApiFile], 'original-api');
    const originalApi = load(originalApiFile);
    assert.equal(originalApi.jarSha256, policy.originalJarSha256);
    const original = new Map(originalApi.classes.map(c => [c.name, c]));
    const fileMap = new Map(mapping.files.map(f => [f.original, f]));
    const symbols = new Map(mapping.symbols.map(s => [s.symbol, s]));
    const classes = mapping.symbols.filter(s => s.symbol.startsWith('C:')).map(s => {
      const originalName = internal(s.symbol.slice(2)), current = internal(s.renamedSymbol.slice(2));
      return {current, target: original.has(originalName) ? originalName : current, originalId: s.symbol,
        sourceFile: fileMap.get(s.declaration.file).renamed, originalJarClass: original.has(originalName)};
    });
    assert.equal(new Set(classes.map(c => c.current)).size, classes.length);
    assert.equal(new Set(classes.map(c => c.target)).size, classes.length);
    assert.deepEqual(classes.filter(c => !c.originalJarClass).map(c => c.originalId.slice(2)).sort(), [...policy.extraSourceClasses].sort());
    const classMap = new Map(classes.map(c => [c.current, c.target]));
    const descriptor = value => value.replace(/L([^;]+);/g, (_, name) => 'L' + (classMap.get(name) || name) + ';');
    const methods = [], fields = [], sourceGeneratedMethods = [];
    for (const s of mapping.symbols) {
      if (!s.symbol.startsWith('M:') && !s.symbol.startsWith('F:')) continue;
      const raw = member(s.symbol), current = member(s.renamedSymbol), owner = original.get(raw.owner);
      // The two decompiler partition classes retain their readable namespace.
      if (!owner) continue;
      const isField = s.symbol.startsWith('F:');
      const choices = (isField ? owner.fields : owner.methods).filter(m => m.desc === raw.descriptor &&
        (m.name === raw.name || isField && raw.name.startsWith('field_') && m.name === raw.name.slice(6)));
      if (!isField && !choices.length && policy.extraSourceMethods.includes(s.symbol)) {
        sourceGeneratedMethods.push({...current, targetName: current.name, originalId: s.symbol});
        continue;
      }
      assert.equal(choices.length, 1, 'Original JVM member correspondence is ambiguous/missing: ' + s.symbol);
      assert.equal(classMap.get(current.owner), raw.owner);
      assert.equal(descriptor(current.descriptor), choices[0].desc);
      (isField ? fields : methods).push({...current, targetName: choices[0].name, originalId: s.symbol});
    }
    assert.deepEqual(sourceGeneratedMethods.map(m => m.originalId).sort(), [...policy.extraSourceMethods].sort());
    const classNameLiteralSites = [];
    for (const f of mapping.files) {
      const text = fs.readFileSync(path.join(named, f.renamed), 'utf8'); let shift = 0;
      for (const edit of f.edits) {
        const at = edit.start + shift;
        if (edit.kind === 'class-name-literal') {
          assert.equal(text.slice(at - 1, at + edit.renamed.length + 1), '"' + edit.renamed + '"');
          classNameLiteralSites.push({sourceFile: f.renamed, line: text.slice(0, at).split('\n').length,
            currentValue: edit.renamed, targetValue: edit.original, symbol: edit.symbol, namedUtf16Start: at, namedUtf16End: at + edit.renamed.length});
        }
        shift += edit.renamed.length - (edit.end - edit.start);
      }
    }
    const e = policy.expectedCounts;
    assert.equal(classes.length, e.sourceClasses); assert.equal(mapping.files.length, e.sourceFiles);
    assert.equal(original.size, e.originalClasses); assert.equal(methods.length, e.originalSourceMethods);
    assert.equal(fields.length, e.originalFields); assert.equal(sourceGeneratedMethods.length, e.sourceGeneratedMethods);
    assert.equal(classNameLiteralSites.length, e.classNameLiteralSites);
    const plan = {classes, methods, fields, sourceGeneratedMethods, classNameLiteralSites};
    const planFile = path.join(directory, 'plan.json'), planTsv = path.join(directory, 'plan.tsv');
    write(planFile, plan);
    const rows = [['V','1'], ...classes.map(c => ['C',c.current,c.target,c.sourceFile])];
    for (const [tag, items] of [['M',methods],['F',fields],['X',sourceGeneratedMethods]])
      for (const m of items) rows.push([tag,m.owner,m.name,m.descriptor,m.targetName]);
    for (const s of classNameLiteralSites) rows.push(['S',s.sourceFile,String(s.line),s.currentValue,s.targetValue]);
    assert(rows.every(row => row.every(value => typeof value === 'string' && !/[\r\n\t]/.test(value))));
    fs.writeFileSync(planTsv, rows.map(row => row.join('\t')).join('\n') + '\n', {flag: 'wx'});
    const helper = path.join(directory, 'compiler-helper'), compiled = path.join(directory, 'classes'), namespaceTool = path.join(directory, 'namespace-tool');
    for (const dir of [helper,compiled,namespaceTool]) fs.mkdirSync(dir);
    run(javac, ['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')], 'compiler-helper');
    const list = path.join(directory, 'files.txt'), audit = path.join(directory, 'audit.tsv');
    fs.writeFileSync(list, inventory.map(f => f.path).join('\n') + '\n', {flag: 'wx'});
    run(java, ['-Xmx1024m','-cp',helper,'ReadableJava',named,list,audit,compiled,stubJar,'--class-name-literals','--labels'], 'compile-named');
    const literalBindings = fs.readFileSync(audit,'utf8').split('\n').map(line => line.split('\t')).filter(a => a[0] === 'S').map(a => [a[1],Number(a[2]),Number(a[3]),a[4],a[5]]);
    const expectedBindings = classNameLiteralSites.map(s => [s.sourceFile,s.namedUtf16Start,s.namedUtf16End,symbols.get(s.symbol).renamedSymbol,s.currentValue]);
    assert.deepEqual(sorted(literalBindings), sorted(expectedBindings), 'Class-name literal AST provenance differs');
    run(javac, ['--release','11','-encoding','UTF-8','-cp',jars.join(path.delimiter),'-d',namespaceTool,
      path.join(tools,'RestoreNativeNamespace.java'),path.join(tools,'VerifyNativeClasses.java')], 'namespace-tool');
    const namespaceClasspath = [namespaceTool,...jars].join(path.delimiter);
    const artifact = path.join(directory,'tombracer-original-namespace.jar'), repeat = path.join(directory,'repeat-original-namespace.jar');
    run(java, ['-cp',namespaceClasspath,'RestoreNativeNamespace',planTsv,compiled,artifact,path.join(directory,'generation.json')], 'restore-utc', {TZ:'UTC'});
    const verificationFile = path.join(directory,'verification.json');
    run(python, ['-I',independent,'verify',planFile,compiled,artifact,originalJar,policyFile,verificationFile], 'independent-verification');
    const verification = load(verificationFile); assert.equal(verification.status,'PASS');
    const classLoading = [compiled,artifact].map((item,index) => JSON.parse(run(java,
      ['-Xverify:all','-cp',namespaceTool,'VerifyNativeClasses',item,stubJar,String(classes.length)], 'jvm-verification-'+index)));
    assert.deepEqual(classLoading[0],classLoading[1]);
    assert.equal(classLoading[0].nativeDeclarations,e.nativeDeclarations);
    run(java, ['-cp',namespaceClasspath,'RestoreNativeNamespace',planTsv,compiled,repeat,path.join(directory,'repeat-generation.json')], 'restore-berlin', {TZ:'Europe/Berlin'});
    assert(fs.readFileSync(artifact).equals(fs.readFileSync(repeat)), 'Native namespace artifact is not reproducible across timezones');
    const result = {status:'verified',policySha256:digest(fs.readFileSync(policyFile)),
      dependencySha256:dependencies.artifacts,sourceTreeSha256:sourceIdentity(inventory),
      originalJarSha256:policy.originalJarSha256,artifactSha256:digest(fs.readFileSync(artifact)),
      apiCounts:verification.apiCounts,nativeCallbacksMatched:verification.nativeCallbacksMatched,
      bytecodeInstructionsCompared:verification.counts.inputInstructions,exceptionHandlersCompared:verification.counts.inputHandlers,
      classNameLiteralEdits:verification.exactLiteralChanges,preexistingOriginalApiModifierDifferences:verification.preexistingOriginalApiModifierDifferences,
      introducedModifierDifferences:0,allExecutableInstructionsAndFramesVerified:true,
      classLoading:classLoading[0],byteIdenticalAcrossTimezones:true,nativeRuntimeVerified:false};
    write(path.join(directory,'receipt.json'),result); state.status='complete';state.stage='complete';save();
    return result;
  } catch(error) {
    state.status='stopped-on-error';state.error=error.stack;save();throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [flag, output, ...extra] = process.argv.slice(2);
    if (flag !== '--output' || !output || extra.length) throw new Error('Usage: node readable/tombracer-native-namespace.mjs --output NEW_DIRECTORY');
    const temporary = path.resolve(output); fs.mkdirSync(temporary);
    const dictionary = load(path.join(funorbRepository,'decompilation/tombracer-naming.json'));
    const stubs = buildCompilationStubs(funorbRepository,temporary);
    const result = verifyTombNativeNamespace(null,path.join(funorbRepository,'games/tombracer'),dictionary,stubs.jar,temporary);
    console.log(JSON.stringify({...result,artifact:path.join(temporary,'native-namespace/tombracer-original-namespace.jar')}));
  } catch(error) {console.error(error.stderr?.toString() || error.stack);process.exitCode=1;}
}
