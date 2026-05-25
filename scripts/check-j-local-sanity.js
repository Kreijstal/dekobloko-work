#!/usr/bin/env node
'use strict';

const fs = require('fs');

if (process.argv.length !== 3) {
  console.error('usage: node scripts/check-j-local-sanity.js CASE.j');
  process.exit(2);
}

const source = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
let ok = true;
let locals = null;

for (const raw of source) {
  const line = raw.trim();
  if (line.startsWith('.method ')) {
    locals = initialLocals(line);
    continue;
  }
  if (line.startsWith('.end method')) {
    locals = null;
    continue;
  }
  if (!locals) continue;
  const insn = parseInsn(line);
  if (!insn) continue;
  const read = localRead(insn);
  if (read) {
    const known = locals.get(read.local);
    if (known !== read.kind) {
      ok = false;
      console.error(`bad local read ${read.kind}load local ${read.local}, known=${known || 'unset'}: ${line}`);
    }
  }
  const write = localWrite(insn);
  if (write) {
    const known = locals.get(write.local);
    if (known && known !== write.kind) {
      ok = false;
      console.error(`mixed local write ${write.kind}store local ${write.local}, known=${known}: ${line}`);
    } else {
      locals.set(write.local, write.kind);
    }
  }
}

process.exit(ok ? 0 : 1);

function initialLocals(line) {
  const out = new Map();
  const isStatic = /\bstatic\b/.test(line);
  let cursor = 0;
  if (!isStatic) {
    out.set(cursor, 'a');
    cursor += 1;
  }
  const descriptor = line.match(/:\s*(\([^)]*\).*)$/);
  if (!descriptor) return out;
  for (const kind of descriptorParamKinds(descriptor[1])) {
    out.set(cursor, kind);
    cursor += kind === 'wide' ? 2 : 1;
  }
  return out;
}

function descriptorParamKinds(desc) {
  const close = desc.indexOf(')');
  if (!desc.startsWith('(') || close < 0) return [];
  const params = desc.slice(1, close);
  const out = [];
  for (let i = 0; i < params.length; i += 1) {
    let ch = params[i];
    if (ch === '[') {
      while (params[i] === '[') i += 1;
      if (params[i] === 'L') while (i < params.length && params[i] !== ';') i += 1;
      out.push('a');
      continue;
    }
    if (ch === 'L') {
      while (i < params.length && params[i] !== ';') i += 1;
      out.push('a');
    } else if (ch === 'J' || ch === 'D') {
      out.push('wide');
    } else {
      out.push(ch === '[' ? 'a' : 'i');
    }
  }
  return out;
}

function parseInsn(line) {
  const body = line.replace(/^L[\w$]+:\s*/, '');
  if (!body || body.startsWith('.')) return null;
  const parts = body.split(/\s+/);
  return { op: parts[0], arg: parts[1] };
}

function localRead(insn) {
  const local = numbered(insn.op, 'iload');
  if (local != null) return { kind: 'i', local };
  if (insn.op === 'iload') return { kind: 'i', local: Number(insn.arg) };
  const ref = numbered(insn.op, 'aload');
  if (ref != null) return { kind: 'a', local: ref };
  if (insn.op === 'aload') return { kind: 'a', local: Number(insn.arg) };
  return null;
}

function localWrite(insn) {
  const local = numbered(insn.op, 'istore');
  if (local != null) return { kind: 'i', local };
  if (insn.op === 'istore') return { kind: 'i', local: Number(insn.arg) };
  const ref = numbered(insn.op, 'astore');
  if (ref != null) return { kind: 'a', local: ref };
  if (insn.op === 'astore') return { kind: 'a', local: Number(insn.arg) };
  if (insn.op === 'iinc') return { kind: 'i', local: Number(insn.arg) };
  return null;
}

function numbered(op, base) {
  if (op === `${base}_0`) return 0;
  if (op === `${base}_1`) return 1;
  if (op === `${base}_2`) return 2;
  if (op === `${base}_3`) return 3;
  return null;
}
