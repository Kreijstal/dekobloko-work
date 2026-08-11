#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Ordinary wrapper cleanup and tail cloning can legitimately duplicate a few
// calls. Require an extremely fragmented protected graph before treating that
// multiplicity change as unsafe; this is the shape where removing the ranges
// unlocks cross-region CFG cloning rather than routine local duplication.
const MIN_RUNTIME_HANDLER_ROWS = 32;
const MIN_DISTINCT_INCREASED_CALLS = 2;
const MIN_TOTAL_ADDED_CALLS = 3;

function codeOf(method) {
  return (method && method.attributes || [])
    .find(attribute => attribute && attribute.type === 'code')?.code || null;
}

function methodMap(classAst) {
  return new Map((classAst.items || [])
    .filter(item => item && item.type === 'method' && item.method)
    .map(item => [item.method.name + item.method.descriptor, item.method]));
}

function catchType(entry) {
  return entry && (entry.catch_type || entry.catchType || entry.type || null);
}

function invocationKey(instruction) {
  const op = typeof instruction === 'string' ? instruction : instruction && instruction.op;
  const reference = instruction && typeof instruction === 'object' ? instruction.arg : null;
  if (!op || !op.startsWith('invoke') || !Array.isArray(reference) ||
      !Array.isArray(reference[2])) return null;
  return `${op}:${reference[1]}.${reference[2][0]}${reference[2][1]}`;
}

function invocationCounts(method) {
  const counts = new Map();
  for (const item of codeOf(method)?.codeItems || []) {
    const key = invocationKey(item && item.instruction);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function findUnsafeMethods(originalClass, transformedClass) {
  const transformedMethods = methodMap(transformedClass);
  const findings = [];
  for (const [identity, originalMethod] of methodMap(originalClass)) {
    const transformedMethod = transformedMethods.get(identity);
    const originalCode = codeOf(originalMethod);
    const transformedCode = codeOf(transformedMethod);
    if (!originalCode || !transformedCode) continue;
    const originalRuntimeHandlers = (originalCode.exceptionTable || [])
      .filter(entry => catchType(entry) === 'java/lang/RuntimeException').length;
    const transformedRuntimeHandlers = (transformedCode.exceptionTable || [])
      .filter(entry => catchType(entry) === 'java/lang/RuntimeException').length;
    if (originalRuntimeHandlers < MIN_RUNTIME_HANDLER_ROWS ||
        transformedRuntimeHandlers !== 0) continue;

    const originalCalls = invocationCounts(originalMethod);
    const transformedCalls = invocationCounts(transformedMethod);
    const increasedCalls = [];
    let totalAddedCalls = 0;
    for (const [key, transformedCount] of transformedCalls) {
      const originalCount = originalCalls.get(key) || 0;
      if (transformedCount <= originalCount) continue;
      increasedCalls.push({key, originalCount, transformedCount});
      totalAddedCalls += transformedCount - originalCount;
    }
    if (increasedCalls.length < MIN_DISTINCT_INCREASED_CALLS ||
        totalAddedCalls < MIN_TOTAL_ADDED_CALLS) continue;
    findings.push({
      identity,
      originalRuntimeHandlers,
      increasedCalls,
      totalAddedCalls,
    });
  }
  return findings;
}

function classFiles(root) {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.class')) {
        files.push(path.relative(root, absolute).split(path.sep).join('/'));
      }
    }
  };
  visit(root);
  return files.sort();
}

function parserModules() {
  const javaTools = process.env.JAVA_TOOLS_DIR || '/home/kreijstal/git/java-tools';
  const parserPath = require.resolve('jvm_parser', {
    paths: [path.join(javaTools, 'node_modules')],
  });
  return {
    getAST: require(parserPath).getAST,
    convertJson: require(path.join(javaTools, 'src', 'parsing', 'convert_tree')).convertJson,
  };
}

function loadClass(file) {
  const {getAST, convertJson} = parserModules();
  const parsed = getAST(new Uint8Array(fs.readFileSync(file)));
  return convertJson(parsed.ast, parsed.constantPool).classes[0];
}

function findUnsafeClasses(originalRoot, transformedRoot) {
  const findings = [];
  for (const relative of classFiles(originalRoot)) {
    const transformedFile = path.join(transformedRoot, ...relative.split('/'));
    if (!fs.existsSync(transformedFile)) continue;
    const methods = findUnsafeMethods(
      loadClass(path.join(originalRoot, ...relative.split('/'))),
      loadClass(transformedFile),
    );
    if (methods.length) findings.push({relative, methods});
  }
  return findings;
}

function main(argv) {
  if (argv.length !== 2) {
    console.error('Usage: find-unsafe-observable-call-duplications.js <original-classes> <transformed-classes>');
    process.exit(2);
  }
  const findings = findUnsafeClasses(path.resolve(argv[0]), path.resolve(argv[1]));
  for (const finding of findings) process.stdout.write(`${finding.relative}\n`);
  for (const finding of findings) {
    for (const method of finding.methods) {
      console.error(`[runtime-safety] ${finding.relative}:${method.identity} removed ` +
        `${method.originalRuntimeHandlers} RuntimeException rows and added ` +
        `${method.totalAddedCalls} calls across ${method.increasedCalls.length} targets`);
    }
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  findUnsafeMethods,
  invocationCounts,
};
