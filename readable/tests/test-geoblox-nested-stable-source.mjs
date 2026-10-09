import {funorbRepository as repository, workflowRoot} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

const javaTools = path.resolve(process.argv[2] || '../java-tools');
const preview = process.argv.includes('--preview');
const root = JSON.parse(fs.readFileSync(path.join(repository, 'decompilation/geoblox-provenance.json')));
const proof = preview ? null : root.nestedStableFallbackRecovery;
assert.ok(preview || proof, 'current nested stable-continuation proof required');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-nested-stable-proof-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (cmd, args) => captureProcess(cmd, args, {maxBuffer: 128 * 1024 * 1024}).stdout.toString();
const git = (repo, ...args) => run('git', ['-C', repo, ...args]).trim();
const rows = text => text.trim().split('\n').filter(Boolean).map(line => line.split('\t'));
try {
  function archive(repo, commit, name, subpath) {
    const tar = path.join(temporary, name + '.tar'), directory = path.join(temporary, name);
    git(repo, 'archive', '--format=tar', '--output=' + tar, commit, ...(subpath ? [subpath] : []));
    fs.mkdirSync(directory); run('tar', ['-xf', tar, '-C', directory]);
    return {directory, sha256: hash(fs.readFileSync(tar))};
  }
  if (proof) {
    assert.equal(proof.sourceProofTest, 'readable/tests/test-geoblox-nested-stable-source.mjs');
    assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))), proof.sourceProofTestSha256);
  }
  const tools = preview ? {directory: javaTools} : archive(javaTools, proof.javaToolsCommit, 'tools');
  if (proof) assert.equal(tools.sha256, proof.sourceArchiveSha256);
  const before = preview ? path.join(repository, 'games/geoblox') : path.join(archive(repository, proof.previousSourceCommit, 'before', 'games/geoblox').directory, 'games/geoblox');
  const entries = sourceInventory(before); assert.equal(entries.length, 303);
  if (proof) assert.equal(sourceIdentity(entries), proof.previousSourceTreeSha256);
  const require = createRequire(import.meta.url);
  const {foldNestedStableGuardedFallbacks: fold} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava} = require(path.join(tools.directory, 'src/java-frontend/lexer.js'));
  const lexical = source => {
    const result = tokenizeJava(source); assert.equal(result.diagnostics.length, 0);
    return result.tokens.filter(token => !['whitespace', 'eof'].includes(token.kind));
  };
  const auxiliary = path.join(workflowRoot, 'tests/test-geoblox-guarded-abrupt-source.mjs');
  const auxiliarySource = fs.readFileSync(auxiliary, 'utf8');
  if (proof) assert.equal(hash(fs.readFileSync(auxiliary)), proof.bodyPositionFixtureSha256);
  const template = auxiliarySource.match(/fs\.writeFileSync\(helper, (`import com\.sun[\s\S]*?`\);)/);
  assert.ok(template);
  let java = new Function('return ' + template[1].slice(0, -2))();
  // Extend the independently attributed JDK certificate, keeping the shared
  // historical helper bytes immutable. The certifier resolves Java elements;
  // it does not import compiler diagnostics or its syntax tree.
  const start = java.indexOf('  static void stableFallback('), end = java.indexOf('\n  static ', start + 10);
  assert.ok(start >= 0 && end > start);
  let method = java.slice(start, end);
  function replace(old, next) { assert.equal(method.split(old).length, 2, old); method = method.replace(old, next); }
  replace('List<? extends StatementTree> ss=((BlockTree)frame.getStatement()).getStatements();', '');
  replace('if(references[0]!=1)return;', `if(references[0]<1||references[0]>128)return;
    List<BlockTree> containers=new ArrayList<>();new TreeScanner<Void,Void>(){
      @Override public Void visitBlock(BlockTree block,Void unused){containers.add(block);return super.visitBlock(block,unused);}
    }.scan(frame.getStatement(),null);
    for(BlockTree container:containers){
      TreePath cursor=TreePath.getPath(unit,container);
      while(cursor.getLeaf()!=frame.getStatement()){
        Tree child=cursor.getLeaf();TreePath up=cursor.getParentPath();if(up==null)break;Tree parent=up.getLeaf();
        if(parent instanceof BlockTree){List<? extends StatementTree> statements=((BlockTree)parent).getStatements();if(statements.isEmpty()||statements.get(statements.size()-1)!=child)break;}
        else if(parent instanceof IfTree){IfTree branch=(IfTree)parent;if(branch.getThenStatement()!=child&&branch.getElseStatement()!=child)break;}
        else break;
        cursor=up;
      }
      if(cursor.getLeaf()!=frame.getStatement())continue;
      List<? extends StatementTree> ss=container.getStatements();`);
  replace('boolean scoped=!(framePath.getParentPath().getLeaf() instanceof BlockTree)', 'boolean scoped=references[0]>1||container!=frame.getStatement()||!(framePath.getParentPath().getLeaf() instanceof BlockTree)');
  replace('+strict);', '+strict+"\\t"+positions.getStartPosition(unit,container)+"\\t"+positions.getEndPosition(unit,container)+"\\t"+(references[0]>1));');
  const last = method.lastIndexOf('\n  }'); assert.ok(last >= 0);
  method = method.slice(0, last) + '\n    }' + method.slice(last);
  java = java.slice(0, start) + method + java.slice(end);
  fs.writeFileSync(path.join(temporary, 'GeobloxBodyPositions.java'), java);
  const helpers = path.join(temporary, 'helpers'), stubs = path.join(repository, 'readable/funorb-stubs.jar');
  fs.mkdirSync(helpers);
  run('javac', ['-d', helpers, path.join(temporary, 'GeobloxBodyPositions.java'), path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const factsFor = directory => rows(run('java', ['-cp', helpers, 'GeobloxBodyPositions', directory, stubs, 'stable-fallbacks']));
  const initialFacts = factsFor(before);
  const spans = initialFacts.filter(r => r[0].endsWith('.java') && (!r[7] || r[7] === r[0].slice(0, -5)));
  const expected = path.join(temporary, 'expected'); fs.mkdirSync(expected);
  for (const entry of entries) fs.copyFileSync(path.join(before, entry.path), path.join(expected, entry.path));
  const provenance = new Map(), consumed = new Set(), removedLabels = new Set(), changedMethods = [], certificates = [];
  let copies = 0, copiedReads = 0, labels = 0;
  for (const entry of entries) {
    let whole = fs.readFileSync(path.join(expected, entry.path), 'utf8');
    let origins = Array.from({length: whole.length}, (_, position) => position);
    for (const span of spans.filter(r => r[0] === entry.path).sort((a, b) => +b[1] - +a[1])) {
      const base = +span[1] + 1;
      let body = whole.slice(base, +span[2] - 1), mapped = origins.slice(base, +span[2] - 1), recoveries = 0;
      const names = (span[3] || '').split(',').filter(Boolean), types = (span[5] || '').split(',');
      const parameters = names.map((name, i) => ({name, type: Buffer.from(types[i], 'base64').toString()}));
      for (let iteration = 0; iteration < 128; iteration++) {
        const result = fold(body, {parameters, fpStrict: span[8] === 'true', retainDiagnostics: true});
        if (!result.framesRecovered) break;
        const d = result.diagnostics, facts = factsFor(expected);
        const fact = facts.find(row => row[0] === 'X' && row[1] === entry.path && +row[2] === base + d.range.start && +row[4] === base + d.branchRange.start && +row[10] === base + d.jumpRange.start);
        assert.ok(fact, 'independent javac certifies the terminal corridor, sole selected exit, primitive inputs and prefix invariance');
        assert.deepEqual([base + d.range.end, base + d.branchRange.end, base + d.conditionRange.start - 1, base + d.conditionRange.end + 1, base + d.guardRange.start - 1, base + d.guardRange.end + 1, base + d.jumpRange.end], [3, 5, 6, 7, 8, 9, 11].map(i => +fact[i]));
        assert.equal(String(d.copied), fact[12]); assert.equal(d.prefixStatements, +fact[13]);
        assert.equal(d.label, fact[14]); assert.equal(String(d.frameScopeRetained), fact[17]);
        assert.deepEqual([base + d.containerRange.start, base + d.containerRange.end], [+fact[19], +fact[20]]);
        assert.equal(String(d.labelRetained), fact[21]);
        const permitted = facts.filter(row => row[0] === 'DUP' && row[1] === entry.path && +row[2] === base + d.range.start && +row[3] >= base + d.conditionRange.start && +row[4] <= base + d.conditionRange.end);
        assert.equal(permitted.length, result.primitiveReadCopiesAdded);
        assert.notEqual(mapped[d.jumpRange.start], null); consumed.add(entry.path + ':' + mapped[d.jumpRange.start]);
        if (!d.labelRetained) { assert.notEqual(mapped[d.range.start], null); removedLabels.add(entry.path + ':' + mapped[d.range.start]); }
        let text = '', nextOrigins = [];
        for (const segment of d.segments) {
          if (segment.text !== undefined) {
            assert.ok(/^[\s!(){}|if]*$/.test(segment.text), 'generated text contains no actions, declarations or selectors');
            text += segment.text; nextOrigins.push(...Array(segment.text.length).fill(null)); continue;
          }
          assert.ok(segment.range.start >= d.range.start && segment.range.end <= d.range.end);
          if (segment.copy) assert.ok(segment.range.start >= d.conditionRange.start && segment.range.end <= d.conditionRange.end);
          let part = body.slice(segment.range.start, segment.range.end), partOrigins = mapped.slice(segment.range.start, segment.range.end);
          for (const edit of (segment.replacements || []).slice().reverse()) {
            const old = body.slice(edit.range.start, edit.range.end), kind = segment.range.start >= d.guardRange.start ? fact[16] : fact[15];
            assert.ok(['==', '!='].includes(old)); assert.equal(edit.text, old === '==' ? '!=' : '==');
            assert.equal(kind, old === '==' ? 'EQUAL_TO' : 'NOT_EQUAL_TO');
            part = part.slice(0, edit.range.start - segment.range.start) + edit.text + part.slice(edit.range.end - segment.range.start);
          }
          if (segment.trimEnd) { part = part.trimEnd(); partOrigins = partOrigins.slice(0, part.length); }
          if (segment.indent) {
            // Map original characters through formatting, including leading
            // whitespace at the continuation's end. No source token is dropped.
            const lineStart = body.lastIndexOf('\n', d.branchRange.start - 1) + 1;
            const indent = body.slice(lineStart, d.branchRange.start);
            let offset = 0, out = '', mappedPart = [];
            for (const match of part.matchAll(/\n([ \t]*)(?=\S)/g)) {
              const stop = match.index + 1; out += part.slice(offset, stop); mappedPart.push(...partOrigins.slice(offset, stop));
              out += '  '; mappedPart.push(null, null); offset = stop;
            }
            out += part.slice(offset); mappedPart.push(...partOrigins.slice(offset));
            const trailing = out.match(/[ \t]*$/)[0].length;
            part = out.slice(0, out.length - trailing) + indent;
            partOrigins = mappedPart.slice(0, mappedPart.length - trailing).concat(Array(indent.length).fill(null));
          }
          text += part; nextOrigins.push(...partOrigins);
        }
        if (d.dedent) {
          const lines = text.split('\n'), next = []; let offset = 0;
          text = lines.map((line, index) => {
            const cut = index && line.startsWith(d.dedent.indent) ? d.dedent.delta : 0;
            next.push(...nextOrigins.slice(offset + cut, offset + line.length));
            offset += line.length + 1; if (index < lines.length - 1) next.push(nextOrigins[offset - 1]);
            return line.slice(cut);
          }).join('\n'); nextOrigins = next;
        }
        assert.equal(result.source, body.slice(0, d.range.start) + text + body.slice(d.range.end));
        const oldBodyLength = body.length;
        mapped = mapped.slice(0, d.range.start).concat(nextOrigins, mapped.slice(d.range.end));
        body = result.source; assert.equal(mapped.length, body.length);
        whole = whole.slice(0, base) + body + whole.slice(base + oldBodyLength);
        origins = origins.slice(0, base).concat(mapped, origins.slice(base + oldBodyLength));
        fs.writeFileSync(path.join(expected, entry.path), whole);
        certificates.push({file: entry.path, originalJump: consumed.size, shared: d.labelRetained, nested: d.corridorKinds.length > 0});
        copies += result.conditionCopiesAdded; copiedReads += result.primitiveReadCopiesAdded; labels += result.labelsRemoved; recoveries++;
      }
      if (recoveries) changedMethods.push({file: entry.path, methodStart: +span[6], start: +span[1], recoveries});
    }
    provenance.set(entry.path, origins);
  }
  assert.ok(certificates.length);
  const finalFacts = factsFor(expected), files = path.join(temporary, 'files.txt'); fs.writeFileSync(files, entries.map(e => e.path).join('\n') + '\n');
  const audit = (directory, name) => {
    const output = path.join(temporary, name + '.tsv'), classes = path.join(temporary, name + '-classes'); fs.mkdirSync(classes);
    run('java', ['-cp', helpers, 'ReadableJava', directory, files, output, classes, stubs, '--labels']); return rows(fs.readFileSync(output, 'utf8'));
  };
  const old = audit(before, 'old'), next = audit(expected, 'next');
  const byPosition = new Map(old.filter(r => ['D', 'R', 'T', 'B', 'N'].includes(r[0])).map(r => [r[0] + ':' + r[1] + ':' + r[2], r]));
  const originalAt = (file, position) => { const result = provenance.get(file)[position]; assert.notEqual(result, null); assert.notEqual(result, undefined); return result; };
  const declarations = new Map(), seen = new Map();
  for (const row of next.filter(r => ['D', 'R', 'T', 'B', 'N'].includes(r[0]))) {
    const position = originalAt(row[1], +row[2]), original = byPosition.get(row[0] + ':' + row[1] + ':' + position);
    assert.ok(original, 'every current binding originates at an original declaration/reference'); assert.equal(row[5], original[5]);
    assert.equal(originalAt(row[1], +row[3] - 1), +original[3] - 1);
    if (['D', 'R'].includes(row[0])) assert.deepEqual(row.slice(4), original.slice(4));
    else if (row[0] === 'T') declarations.set(row[4], original[4]);
    else assert.equal(declarations.get(row[4]), original[4], 'every surviving label reference retains its original target');
    const key = row[0] + ':' + row[1] + ':' + position; seen.set(key, (seen.get(key) || 0) + 1);
  }
  let extraReads = 0;
  for (const row of old.filter(r => ['D', 'R', 'T', 'B', 'N'].includes(r[0]))) {
    const key = row[0] + ':' + row[1] + ':' + row[2], count = seen.get(key) || 0;
    if (row[0] === 'T' && removedLabels.has(row[1] + ':' + row[2])) { assert.equal(count, 0); continue; }
    // Label reference spans start after the break keyword; independently
    // identify consumed transfers from the original Q source interval.
    if (row[0] === 'B' && initialFacts.some(q => q[0] === 'Q' && q[1] === row[1] && consumed.has(q[1] + ':' + q[2]) && +row[2] >= +q[2] && +row[3] <= +q[3])) { assert.equal(count, 0); continue; }
    assert.ok(count >= 1, key + ' retained');
    if (row[0] !== 'R') assert.equal(count, 1); else extraReads += count - 1;
  }
  assert.equal(extraReads, copiedReads); assert.deepEqual(next.filter(r => r[0] === 'O'), old.filter(r => r[0] === 'O'));
  const originalTransfers = new Map(initialFacts.filter(r => r[0] === 'Q').map(r => [r[1] + ':' + r[2], r]));
  const seenTransfers = new Set();
  for (const row of finalFacts.filter(r => r[0] === 'Q')) {
    const key = row[1] + ':' + originalAt(row[1], +row[2]), original = originalTransfers.get(key); assert.ok(original); assert.ok(!consumed.has(key));
    assert.equal(originalAt(row[1], +row[3] - 1), +original[3] - 1); assert.deepEqual(row.slice(4, 7), original.slice(4, 7));
    assert.equal(originalAt(row[1], +row[7]), +original[7]); assert.equal(originalAt(row[1], +row[8] - 1), +original[8] - 1);
    const scopes = (row[9] || '').split(',').filter(Boolean).map(s => { const [kind, role, start] = s.split(':'); return [kind, role, originalAt(row[1], +start)].join(':'); }).join(','); assert.equal(scopes, original[9] || ''); seenTransfers.add(key);
  }
  assert.equal(seenTransfers.size + consumed.size, originalTransfers.size);
  const selected = changedMethods.map(method => {
    const declarations = old.filter(r => r[0] === 'D' && r[1] === method.file && r[4].startsWith('M:') && +r[2] >= method.methodStart && +r[3] <= method.start);
    assert.equal(declarations.length, 1); return {symbol: declarations[0][4], recoveries: method.recoveries};
  }).sort((a, b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
  const result = {files: 303,changedFiles: new Set(changedMethods.map(m => m.file)).size,changedMethods: selected,recoveries: certificates.length,labelsRemoved: labels,conditionCopiesAdded: copies,primitiveReadCopiesAdded: copiedReads,allOriginalBindingsAndSurvivingTransfersPreserved: true,completeCorpusCompiled: true,independentJdkCertificatesAtEveryStep: true,sourceTreeSha256: sourceIdentity(sourceInventory(expected))};
  if (proof) {
    assert.equal(result.sourceTreeSha256, proof.sourceTreeSha256); assert.deepEqual(selected, proof.changedMethods);
    for (const entry of entries) assert.ok(fs.readFileSync(path.join(expected, entry.path)).equals(fs.readFileSync(path.join(repository, 'games/geoblox', entry.path))), entry.path + ' exact independent replay');
    assert.deepEqual({recoveries: result.recoveries,labelsRemoved: labels,conditionCopiesAdded: copies,primitiveReadCopiesAdded: copiedReads}, proof.counts);
  }
  console.log(JSON.stringify(result));
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
