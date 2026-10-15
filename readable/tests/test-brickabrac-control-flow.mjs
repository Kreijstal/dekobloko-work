import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {archivedInput, funorbRepository, workflowRoot} from '../game-export.mjs';
import {buildCompilationStubs} from '../compilation-stubs.mjs';
import {verifyBrickCore} from './test-brickabrac-core.mjs';

// Diagnostic only: exercise a candidate generic pass against the current
// published game in one temporary tree. Publication still requires a fresh
// decompile, pinned raw input, symbol binding checks and exact reversal.
const require = createRequire(import.meta.url);
const javaTools = path.resolve(process.env.JAVA_TOOLS_DIR || path.join(workflowRoot, '../../java-tools'));
const {tokenizeJava} = require(path.join(javaTools, 'src/java-frontend/lexer.js'));
const {flattenElseIfChains, simplifyPredicateNegations, simplifyPredicateGrouping,
  reindentStructuredSource} = require(path.join(javaTools, 'src/decompiler/javaAstEmitter.js'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'brick-control-flow-'));
try {
  const named = path.join(temporary, 'candidate');
  fs.cpSync(path.join(funorbRepository, 'games/brickabrac'), named, {recursive: true});
  const changed = [];
  let methodCount = 0, blocksRemoved = 0, decisionsRotated = 0;
  const nesting = source => {
    let depth = 0, maximum = 0;
    for (const token of tokenizeJava(source).tokens) {
      if (token.text === '{') maximum = Math.max(maximum, ++depth);
      else if (token.text === '}') depth--;
    }
    return maximum;
  };
  for (const file of fs.readdirSync(named).filter(f => f.endsWith('.java')).sort()) {
    const filename = path.join(named, file), source = fs.readFileSync(filename, 'utf8');
    const lexed = tokenizeJava(source);
    assert.equal(lexed.diagnostics.length, 0, file);
    const tokens = lexed.tokens.filter(t => !['whitespace', 'comment', 'eof'].includes(t.kind));
    const stack = [], closes = new Map(), opens = new Map();
    for (let i = 0; i < tokens.length; i++) {
      if (['(', '[', '{'].includes(tokens[i].text)) stack.push(i);
      else if ([')', ']', '}'].includes(tokens[i].text)) {
        const open = stack.pop(); closes.set(open, i); opens.set(i, open);
      }
    }
    const edits = [];
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.text === '}') depth--;
      if (token.text !== '{') continue;
      if (depth++ !== 1 || tokens[i - 1]?.text !== ')') continue;
      const argumentsOpen = opens.get(i - 1), methodName = tokens[argumentsOpen - 1]?.text;
      if (tokens[argumentsOpen - 1]?.kind !== 'identifier' || tokens[argumentsOpen - 2]?.text === 'new') continue;
      methodCount++;
      const close = closes.get(i), start = token.range.endOffset, end = tokens[close].range.startOffset;
      const body = source.slice(start, end);
      let result = body, removed = 0, rotated = 0;
      for (;;) {
        const next = flattenElseIfChains(result);
        if (!next.blocksRemoved) break;
        removed += next.blocksRemoved; rotated += next.decisionsRotated; result = next.source;
      }
      if (!removed) continue;
      for (;;) {
        const next = simplifyPredicateNegations(result, {complementIntegralRelations: false});
        if (!next.predicatesSimplified) break;
        result = next.source;
      }
      result = simplifyPredicateGrouping(result).source;
      result = reindentStructuredSource(result).source;
      edits.push({start, end, text: result});
      blocksRemoved += removed; decisionsRotated += rotated;
      changed.push({file, method: methodName, blocksRemoved: removed, decisionsRotated: rotated,
        maximumBraceDepthBefore: nesting(body), maximumBraceDepthAfter: nesting(result)});
      i = close; depth--;
    }
    let output = source;
    for (const edit of edits.reverse()) output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    if (edits.length) fs.writeFileSync(filename, output);
  }
  assert.ok(blocksRemoved > 0, 'Candidate did not simplify the published source');
  const gameplay = changed.find(m => m.file === 'PowerUp.java' && m.method === 'applyToBoard');
  assert.ok(gameplay && gameplay.maximumBraceDepthAfter < gameplay.maximumBraceDepthBefore);
  console.log(JSON.stringify({methodsScanned: methodCount, methodsChanged: changed.length, blocksRemoved,
    decisionsRotated, gameplay, changedFiles: new Set(changed.map(m => m.file)).size}));
  const rules = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'brickabrac-rules.json')));
  const mapping = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/brickabrac-naming.json')));
  const input = archivedInput(rules, temporary), stubs = buildCompilationStubs(funorbRepository, temporary);
  const verification = verifyBrickCore(input, named, mapping, stubs.jar, temporary);
  const contracts = Object.fromEntries([['core', verification], ['serviceHeader', verification.serviceHeader],
    ['listReset', verification.listReset], ['paddleMovement', verification.paddleMovement]]
    .map(([name, result]) => [name, {checks: result.checks, traceSha256: result.traceSha256,
      rawCandidateIdentical: result.rawNamedIdentical}]));
  console.log(JSON.stringify({contracts, checksPerVariant: Object.values(contracts).reduce((n, r) => n + r.checks, 0),
    runtimeEquivalenceVerified: false, published: false}));
} finally {fs.rmSync(temporary, {recursive: true, force: true});}
