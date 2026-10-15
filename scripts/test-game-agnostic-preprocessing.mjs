import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const javaTools = path.resolve(process.env.JAVA_TOOLS_DIR || path.join(repository, '../java-tools'));
const toolRequire = createRequire(path.join(javaTools, 'package.json'));
const acorn = toolRequire('acorn');
const {runStructuredGotoClone} = require('./pipeline/structuredGotoClone.js');
const {FIELD_RENAMES, METHOD_RENAMES} = require('./pipeline/compileConflictRenames.js');

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, child] of Object.entries(node)) {
    if (['start', 'end', 'loc'].includes(key)) continue;
    if (Array.isArray(child)) child.forEach(value => walk(value, visit));
    else if (child && typeof child === 'object') walk(child, visit);
  }
}

test('production preprocessors contain no application descriptor or member identity gates', () => {
  const root = path.join(repository, 'scripts/pipeline');
  assert.equal(fs.existsSync(path.join(root, 'profiles')), false);
  assert.deepEqual(FIELD_RENAMES, []);
  assert.deepEqual(METHOD_RENAMES, []);
  for (const filename of fs.readdirSync(root).filter(file => file.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(root, filename), 'utf8');
    const ast = acorn.parse(source, {ecmaVersion: 'latest', locations: true});
    const ownerParameters = new Map();
    walk(ast, node => {
      if (node.type === 'FunctionDeclaration') {
        const index = node.params.findIndex(parameter => /^(?:owner|className)$/.test(parameter.name));
        if (index >= 0) ownerParameters.set(node.id.name, index);
      }
    });
    walk(ast, node => {
      const site = filename + ':' + node.loc.start.line;
      // Inspect helper signatures too: application selectors must not hide in
      // a new field-matching helper omitted from a hand-maintained call list.
      if (node.type === 'CallExpression' && ownerParameters.has(node.callee.name)) {
        const owner = node.arguments[ownerParameters.get(node.callee.name)];
        if (owner?.type === 'Literal' && typeof owner.value === 'string')
          assert.match(owner.value, /^(?:java|javax)\//, site + ': fixed application owner');
      }
      if (node.type === 'ArrayExpression' && ['Field', 'Method', 'InterfaceMethod'].includes(node.elements[0]?.value)) {
        const owner = node.elements[1];
        if (owner?.type === 'Literal' && typeof owner.value === 'string')
          assert.match(owner.value, /^(?:java|javax)\//, site + ': fixed application reference');
      }
      if (node.type === 'Literal' && typeof node.value === 'string') {
        assert.ok(!/^L[0-9]+$/.test(node.value), site + ': fixed bytecode offset selector');
        for (const [, type] of node.value.matchAll(/L([^;]+);/g))
          assert.match(type, /^(?:java|javax)\//, site + ': application descriptor ' + node.value);
      }
      if (node.type === 'CallExpression' && ['isInvoke', 'isGetField', 'isGetStatic', 'rangeContainsInvokeShape', 'isPutField', 'fieldMatches', 'hasFieldAccessNearby'].includes(node.callee.name)) {
        const literals = node.arguments.filter(argument => argument.type === 'Literal' && typeof argument.value === 'string');
        assert.ok(!literals.some(argument => /^[a-z]{1,3}(?:_[a-z]+)?$/.test(argument.value)), site + ': application member selector');
      }
      if (node.type === 'BinaryExpression') {
        for (const [member, literal] of [[node.left, node.right], [node.right, node.left]]) {
          const property = member.type === 'MemberExpression'
            ? (member.computed ? member.property.value : member.property.name) : null;
          if (['name', 'arg', 'className', 'owner'].includes(property)
              && literal.type === 'Literal' && typeof literal.value === 'string')
            assert.match(literal.value, /^(?:(?:java|javax)\/|<init>$|<clinit>$)/,
              site + ': fixed application identity comparison');
        }
      }
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
          && ['includes', 'startsWith', 'endsWith'].includes(node.callee.property.name)
          && node.callee.object.type === 'MemberExpression' && node.callee.object.property.name === 'arg') {
        const literal = node.arguments[0];
        if (literal?.type === 'Literal' && typeof literal.value === 'string')
          assert.match(literal.value, /^(?:(?:java|javax)\/|LCK)/,
            site + ': fixed application message/content selector');
      }
    });
  }
});

test('renaming application classes, members, descriptors and labels commutes with a generic rewrite', () => {
  const environment = {...process.env};
  try {
    // Isolate the generic transform under test; these are diagnostic controls,
    // not required options for the production preprocessing entry point.
    const source = fs.readFileSync(path.join(repository, 'scripts/pipeline/structuredGotoClone.js'), 'utf8');
    for (const name of new Set(source.match(/STRUCTURED_GOTO_[A-Z_]+/g))) process.env[name] = '0';
    process.env.STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES = '1';
    process.env.STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINE_MAX_REWRITES = '64';
    for (let variant = 0; variant < 16; variant++) {
      const owner = variant ? 'example/Owner' + variant : 'rd';
      const member = variant ? 'selectedValue' + variant : 'rd_g';
      const type = variant ? 'example/Value' + variant : 'wa';
      const method = variant ? 'process' + variant : 'h';
      const label = name => 'Lvariant' + variant + '_' + name;
      const items = [
        {labelDef: label('start') + ':', instruction: 'aload_0'},
        {instruction: {op: 'getfield', arg: ['Field', owner, [member, 'L' + type + ';']]}},
        {instruction: 'pop'},
        {labelDef: label('jump') + ':', instruction: {op: 'goto', arg: label('bridge')}},
        {labelDef: label('bridge') + ':', instruction: {op: 'goto', arg: label('exit')}},
        {labelDef: label('exit') + ':', instruction: 'return'},
      ];
      while (items.length < 20) items.push({labelDef: label('pad' + items.length) + ':'});
      const ast = {classes: [{className: owner, items: [{type: 'method', method: {
        name: method, descriptor: '(L' + type + ';)V', attributes: [{type: 'code', code: {codeItems: items}}],
      }}]}]};
      const result = runStructuredGotoClone(ast);
      assert.equal(result.changed, true);
      assert.equal(result.rewrites, 1);
      assert.equal(items[3].instruction.arg, label('exit'));
      assert.deepEqual(items[1].instruction.arg, ['Field', owner, [member, 'L' + type + ';']]);
    }
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in environment)) delete process.env[name];
    Object.assign(process.env, environment);
  }
});

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 120000,
    maxBuffer: 8 * 1024 * 1024, ...options});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('named bytecode profiles fail explicitly before creating output', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agnostic-profile-refusal-'));
  try {
    const output = path.join(temporary, 'output');
    const result = spawnSync(process.execPath, [path.join(repository, 'scripts/pipeline/bulk-pipeline.js'),
      'unused-input', output, '--profile', 'arbitrary-game'], {encoding: 'utf8', env: {...process.env, JAVA_TOOLS_DIR: javaTools}});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Game-specific bytecode profiles are no longer supported/);
    assert.equal(fs.existsSync(output), false);
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
});

test('complete programs preserve externally written nonzero flags under both pipeline modes and renamed symbols', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agnostic-native-'));
  const environment = {...process.env, JAVA_TOOLS_DIR: javaTools};
  for (const name of Object.keys(environment))
    if (/^(?:PIPELINE_|BULK_PIPELINE_|STRUCTURED_GOTO_|SKIP_PIPELINE_)/.test(name)) delete environment[name];
  delete environment.JAVA_TOOL_OPTIONS;
  try {
    let reference;
    for (const [className, method, flag, score] of [
      ['em', 'h', 'em_h', 'score'],
      ['RenamedController', 'advance', 'externalState', 'total'],
    ]) {
      const input = path.join(temporary, className, 'input'); fs.mkdirSync(input, {recursive: true});
      const source = `public class ${className} {
static int ${flag}; int ${score};
void ${method}(int guard){int trap=-74/((29-guard)/44);${score}=trap;int snapshot=${flag};
if(snapshot!=0)${score}+=2;if(snapshot==0)${score}+=3;if(snapshot!=0)${score}+=5;}
public static void main(String[] args){for(int value:new int[]{0,1,-7})for(int guard:new int[]{-60,-100,-150}){
${flag}=value;${className} object=new ${className}();object.${method}(guard);
int expected=-74/((29-guard)/44)+(value==0?3:7);if(object.${score}!=expected)throw new AssertionError(value+":"+guard+":"+object.${score});
System.out.println(value+":"+guard+":"+object.${score});}}}`;
      const java = path.join(temporary, className, className + '.java'); fs.writeFileSync(java, source);
      run('javac', ['--release', '8', '-g:none', '-d', input, java], {env: environment});
      const expected = run('java', ['-Xverify:all', '-cp', input, className], {env: environment});
      if (reference === undefined) reference = expected;
      else assert.equal(expected, reference);
      const modernBytes = fs.readFileSync(path.join(input, className + '.class'));
      for (const [version, major, preserve] of [['modern', 52, true], ['java7', 51, true], ['version50', 50, false], ['legacy', 49, false]]) {
        const bytes = Buffer.from(modernBytes);
        // This fixture uses only pre-Java-7 instructions. Exercise actual
        // rewriting as well as preservation of classes requiring stack maps.
        bytes.writeUInt16BE(major, 6);
        fs.writeFileSync(path.join(input, className + '.class'), bytes);
        for (const mode of [[], ['--safe-bytecode']]) {
          const output = path.join(temporary, className, version + (mode.length ? '-safe' : '-default'));
          const stdout = run(process.execPath, [path.join(repository, 'scripts/pipeline/bulk-pipeline.js'), input, output, ...mode], {env: environment});
          assert.match(stdout, /Done: 1\/1 processed, 0 failed \(passthrough\), 0 copied/);
          assert.equal(run('java', ['-Xverify:all', '-cp', output, className], {env: environment}), expected);
          const emitted = fs.readFileSync(path.join(output, className + '.class'));
          if (preserve) assert.deepEqual(emitted, bytes);
          else assert.notDeepEqual(emitted, bytes, 'legacy fixtures must exercise preprocessing, not the modern preservation path');
        }
      }
    }
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
});

test('mixed class versions keep references from preserved callers valid', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agnostic-mixed-'));
  const environment = {...process.env, JAVA_TOOLS_DIR: javaTools};
  for (const name of Object.keys(environment))
    if (/^(?:PIPELINE_|BULK_PIPELINE_|STRUCTURED_GOTO_|SKIP_PIPELINE_)/.test(name)) delete environment[name];
  delete environment.JAVA_TOOL_OPTIONS;
  try {
    const input = path.join(temporary, 'input'); fs.mkdirSync(input);
    const sources = {
      LegacyLibrary: 'public class LegacyLibrary { public static int choose(boolean enabled) { return enabled ? 19 : 7; } }',
      ModernCaller: 'public class ModernCaller { public static void main(String[] args) { if (LegacyLibrary.choose(true) != 19 || LegacyLibrary.choose(false) != 7) throw new AssertionError(); System.out.println("mixed references valid"); } }',
    };
    for (const [name, source] of Object.entries(sources)) fs.writeFileSync(path.join(temporary, name + '.java'), source);
    run('javac', ['--release', '8', '-g:none', '-d', input,
      ...Object.keys(sources).map(name => path.join(temporary, name + '.java'))], {env: environment});
    const legacyFile = path.join(input, 'LegacyLibrary.class');
    const legacyBytes = fs.readFileSync(legacyFile); legacyBytes.writeUInt16BE(50, 6); fs.writeFileSync(legacyFile, legacyBytes);
    const modernBytes = fs.readFileSync(path.join(input, 'ModernCaller.class'));
    const expected = run('java', ['-Xverify:all', '-cp', input, 'ModernCaller'], {env: environment});
    for (const mode of [[], ['--safe-bytecode']]) {
      const output = path.join(temporary, mode.length ? 'safe' : 'default');
      const stdout = run(process.execPath, [path.join(repository, 'scripts/pipeline/bulk-pipeline.js'), input, output, ...mode], {env: environment});
      assert.match(stdout, /Done: 2\/2 processed, 0 failed \(passthrough\), 0 copied/);
      assert.deepEqual(fs.readFileSync(path.join(output, 'ModernCaller.class')), modernBytes);
      assert.equal(run('java', ['-Xverify:all', '-cp', output, 'ModernCaller'], {env: environment}), expected);
    }
  } finally {fs.rmSync(temporary, {recursive: true, force: true});}
});

test('constant folds preserve taken destinations and shared branch inputs on the native JVM', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agnostic-constant-fold-'));
  const environment = {...process.env};
  delete process.env.JAVA_TOOL_OPTIONS;
  try {
    const {parseJasminSource} = toolRequire('./src/utils/jasminAssembly');
    const {writeClassAstToClassFile} = toolRequire('./src/parsing/classAstToClassFile');
    const ast = parseJasminSource(`.version 50 0
.class public super BranchProbe
.super java/lang/Object
.field public static observed I
.method public static execute : ()V
.code stack 1 locals 0
 iconst_0
 ifeq Lwork
 return
Lwork: bipush 19
 putstatic Field BranchProbe observed I
 return
.end code
.end method
.method public static joined : (Z)I
.code stack 3 locals 1
 iload_0
 ifeq Lconstant
 iconst_1
 iconst_2
 iconst_1
 goto Lshared
Lconstant: iconst_1
 iconst_2
 iconst_0
Lshared: ifne Lother
 if_icmpeq Lsame
 bipush 19
 ireturn
Lsame: bipush 23
 ireturn
Lother: pop2
 bipush -7
 ireturn
.end code
.end method
.end class`);
    for (const item of ast.classes[0].items) {
      const code = item.method?.attributes.find(attribute => attribute.type === 'code')?.code;
      if (code) {
        code.codeItems = code.codeItems.map(item => item?.labelDef || item?.instruction ? item : {instruction: item});
        while (code.codeItems.length < 20) code.codeItems.push({labelDef: 'Lpadding' + code.codeItems.length + ':'});
      }
    }
    const input = path.join(temporary, 'input'), output = path.join(temporary, 'output');
    fs.mkdirSync(input); fs.mkdirSync(output);
    writeClassAstToClassFile(ast, path.join(input, 'BranchProbe.class'));
    const runner = path.join(temporary, 'BranchOracle.java');
    fs.writeFileSync(runner, 'public class BranchOracle { public static void main(String[] args) { BranchProbe.execute(); if (BranchProbe.observed != 19 || BranchProbe.joined(false) != 19 || BranchProbe.joined(true) != -7) throw new AssertionError(); System.out.println("native branch oracle passed"); } }');
    run('javac', ['--release', '8', '-cp', input, '-d', input, runner]);
    const expected = run('java', ['-Xverify:all', '-cp', input, 'BranchOracle']);
    const source = fs.readFileSync(path.join(repository, 'scripts/pipeline/structuredGotoClone.js'), 'utf8');
    for (const name of new Set(source.match(/STRUCTURED_GOTO_[A-Z_]+/g))) process.env[name] = '0';
    process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARDS = '1';
    process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS = '';
    process.env.STRUCTURED_GOTO_CONST_FALSE_COMPARE_INTERRUPTERS = '1';
    const joined = ast.classes[0].items.find(item => item.method?.name === 'joined');
    const originalJoined = structuredClone(joined);
    const result = runStructuredGotoClone(ast);
    assert.equal(result.rewrites, 1, 'the taken constant guard is the only eligible rewrite');
    assert.deepEqual(joined, originalJoined, 'a second incoming value prevents constant folding');
    writeClassAstToClassFile(ast, path.join(output, 'BranchProbe.class'));
    assert.equal(run('java', ['-Xverify:all', '-cp', output + path.delimiter + input, 'BranchOracle']), expected);
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in environment)) delete process.env[name];
    Object.assign(process.env, environment);
    fs.rmSync(temporary, {recursive: true, force: true});
  }
});
