'use strict';

// Extract repeated terminal iterator/throttle regions into private helpers.
//
// The gate is bytecode shape based:
//   receiver boolean guard -> receiver long throttle guard -> iterator init
//   -> null-checked object loop -> receiver long update -> return
//
// Some obfuscated dispatchers also share one of these terminal regions through
// a reset/fallthrough branch. For those, this pass synthesizes a boolean helper
// that returns whether the original code would have returned.

function runTerminalIteratorExtract(astRoot) {
  let rewrites = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || !Array.isArray(cls.items)) continue;
    const originalItems = cls.items.slice();
    for (const item of originalItems) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name === '<init>' || item.method.name === '<clinit>') continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const code = codeAttr && codeAttr.code;
      const codeItems = code && code.codeItems;
      if (!Array.isArray(codeItems) || codeItems.length < 120) continue;

      const result = extractFromMethod(cls, item.method, codeItems);
      rewrites += result.rewrites;
      for (const helper of result.helpers) cls.items.push(helper);
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function extractFromMethod(cls, method, codeItems) {
  const regions = findTerminalLoopRegions(codeItems, cls.className);
  if (regions.length < 2) return { rewrites: 0, helpers: [] };

  const helperBase = freshMethodName(cls, 'ck$terminalIterator');
  const loopHelper = `${helperBase}$loop`;
  const maybeHelper = `${helperBase}$maybe`;
  const refs = collectBranchRefs(codeItems);
  const unsafe = regions.filter((region) => incomingRefsToRegion(region, refs).length !== 0);

  const helpers = [];
  let rewrites = 0;
  const maybeSpec = findMaybeLoopSpec(codeItems, unsafe, cls.className, method);
  if (maybeSpec) {
    replaceMaybeLoopRegion(codeItems, maybeSpec, cls.className, maybeHelper);
    rewrites += 1;
  }

  const postRegions = findTerminalLoopRegions(codeItems, cls.className);
  const postRefs = collectBranchRefs(codeItems);
  const safe = postRegions.filter((region) =>
    incomingRefsToRegion(region, postRefs).length === 0 &&
    hasClosedLocalInputs(region.items));
  if (safe.length < 2 && rewrites === 0) return { rewrites: 0, helpers: [] };
  if (safe.length === 0) return { rewrites, helpers };

  const loopRegion = cloneItems(safe[0].items);
  for (let i = safe.length - 1; i >= 0; i -= 1) {
    replaceRegionWithLoopCall(codeItems, safe[i], cls.className, loopHelper);
  }
  rewrites += safe.length;
  helpers.push(loopHelperMethod(loopHelper, loopRegion));
  if (maybeSpec) helpers.push(maybeHelperMethod(maybeHelper, loopHelper, cls.className, maybeSpec));
  return { rewrites, helpers };
}

function findTerminalLoopRegions(codeItems, className) {
  const regions = [];
  for (let i = 0; i < codeItems.length - 4; i += 1) {
    if (opAt(codeItems, i) !== 'aload_0') continue;
    const guardField = fieldRef(codeItems[i + 1] && codeItems[i + 1].instruction);
    if (!guardField || guardField.owner !== className || guardField.desc !== 'Z') continue;

    let putLong = -1;
    for (let j = i + 2; j < codeItems.length && j <= i + 180; j += 1) {
      const field = fieldRef(codeItems[j] && codeItems[j].instruction);
      if (opAt(codeItems, j) === 'putfield' && field && field.owner === className && field.desc === 'J') {
        putLong = j;
        break;
      }
    }
    if (putLong < 0) continue;

    let ret = -1;
    for (let j = putLong + 1; j < codeItems.length && j <= putLong + 5; j += 1) {
      if (opAt(codeItems, j) === 'return') {
        ret = j;
        break;
      }
    }
    if (ret < 0) continue;

    const items = codeItems.slice(i, ret + 1);
    const shape = readIteratorShape(items, className);
    if (!shape) continue;
    const startLabel = trim(codeItems[i] && codeItems[i].labelDef);
    const returnLabel = trim(codeItems[ret] && codeItems[ret].labelDef);
    if (!startLabel || !returnLabel) continue;
    regions.push({ start: i, end: ret + 1, startLabel, returnLabel, items, shape });
    i = ret;
  }
  return regions;
}

function readIteratorShape(items, className) {
  const iteratorFields = new Map();
  let castType = null;
  for (let i = 0; i < items.length; i += 1) {
    const insn = items[i] && items[i].instruction;
    const field = fieldRef(insn);
    if (op(insn) === 'getfield' && field && field.owner === className && /^L[^;]+;$/.test(field.desc)) {
      const constant = op(items[i + 1] && items[i + 1].instruction);
      const invoke = items[i + 2] && items[i + 2].instruction;
      const method = methodRef(invoke);
      if (method && method.desc && /^\([ZI]\)L[^;]+;$/.test(method.desc) &&
          (constant === 'iconst_0' || constant === 'iconst_1' || constant === 'bipush')) {
        const key = `${field.owner}.${field.name}:${field.desc}`;
        const seen = iteratorFields.get(key) || { initial: false, next: false, returnDesc: method.desc.slice(3) };
        if (method.desc.startsWith('(Z)')) seen.initial = true;
        if (method.desc.startsWith('(I)')) seen.next = true;
        iteratorFields.set(key, seen);
      }
    }
    if (op(insn) === 'checkcast' && typeof insn.arg === 'string') castType = insn.arg;
  }
  for (const seen of iteratorFields.values()) {
    if (seen.initial && seen.next && castType) return { castType, returnDesc: seen.returnDesc };
  }
  return null;
}

function replaceRegionWithLoopCall(codeItems, region, className, helperName) {
  codeItems.splice(region.start, region.end - region.start,
    { labelDef: `${region.startLabel}:`, instruction: 'aload_0' },
    { instruction: { op: 'invokespecial', arg: ['Method', className, [helperName, '()V']] } },
    { labelDef: `${region.returnLabel}:`, instruction: 'return' });
}

function findMaybeLoopSpec(codeItems, unsafeRegions, className, method) {
  for (const region of unsafeRegions) {
    const pre = findMaybePrefixStart(codeItems, region.start, className);
    if (pre < 0) continue;
    const flagLocal = loadLocal(codeItems[pre].instruction, 'i');
    const resetBranch = codeItems[pre + 1] && codeItems[pre + 1].instruction;
    const resetLabel = trim(resetBranch && resetBranch.arg);
    const valueLocal = loadLocal(codeItems[pre + 2].instruction, 'i');
    const compareConstant = cloneInstruction(codeItems[pre + 3].instruction);
    const skipBranch = codeItems[pre + 4] && codeItems[pre + 4].instruction;
    const fallthroughLabel = trim(skipBranch && skipBranch.arg);
    const helperCompare = invertIntCompare(op(skipBranch));
    if (!resetLabel || !valueLocal || !flagLocal || !fallthroughLabel || !helperCompare) continue;

    const resetIdx = findLabelIndex(codeItems, resetLabel);
    if (resetIdx < 0) continue;
    const secondStart = findSecondMaybeStart(codeItems, resetIdx, fallthroughLabel, className, compareConstant, op(skipBranch));
    if (secondStart < 0) continue;
    const secondRegion = unsafeRegions.find((candidate) => candidate.start === secondStart);
    if (!secondRegion) continue;

    const valueDesc = localDescriptor(method, valueLocal) || 'I';
    return {
      start: pre,
      end: secondRegion.end,
      startLabel: trim(codeItems[pre] && codeItems[pre].labelDef),
      returnLabel: secondRegion.returnLabel,
      fallthroughLabel,
      valueLocal,
      valueDesc,
      flagLocal,
      compareConstant,
      helperCompare,
      resetItems: cloneResetItems(codeItems, resetIdx),
      nullStoreItems: cloneItems(codeItems.slice(pre + 5, region.start)),
    };
  }
  return null;
}

function findMaybePrefixStart(codeItems, regionStart, className) {
  for (let pre = Math.max(0, regionStart - 16); pre < regionStart; pre += 1) {
    if (loadLocal(codeItems[pre] && codeItems[pre].instruction, 'i') == null) continue;
    if (op(codeItems[pre + 1] && codeItems[pre + 1].instruction) !== 'ifne') continue;
    if (loadLocal(codeItems[pre + 2] && codeItems[pre + 2].instruction, 'i') == null) continue;
    if (!isIntConstant(codeItems[pre + 3] && codeItems[pre + 3].instruction)) continue;
    if (!invertIntCompare(op(codeItems[pre + 4] && codeItems[pre + 4].instruction))) continue;
    if (matchesNullFieldStore(codeItems, pre + 5, className) && pre + 9 === regionStart) return pre;
  }
  return -1;
}

function findSecondMaybeStart(codeItems, resetIdx, fallthroughLabel, className, compareConstant, compareOpcode) {
  for (let i = resetIdx; i < codeItems.length - 8; i += 1) {
    if (trim(codeItems[i] && codeItems[i].labelDef) === fallthroughLabel) return -1;
    if (loadLocal(codeItems[i] && codeItems[i].instruction, 'i') == null) continue;
    if (!sameInstruction(codeItems[i + 1] && codeItems[i + 1].instruction, compareConstant)) continue;
    const branch = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (op(branch) !== compareOpcode || trim(branch.arg) !== fallthroughLabel) continue;
    if (!matchesNullFieldStore(codeItems, i + 3, className)) continue;
    return i + 7;
  }
  return -1;
}

function replaceMaybeLoopRegion(codeItems, spec, className, helperName) {
  codeItems.splice(spec.start, spec.end - spec.start,
    { labelDef: `${spec.startLabel}:`, instruction: 'aload_0' },
    { instruction: loadInstruction('i', spec.valueLocal) },
    { instruction: loadInstruction('i', spec.flagLocal) },
    { instruction: { op: 'invokespecial', arg: ['Method', className, [helperName, `(${spec.valueDesc}I)Z`]] } },
    { instruction: { op: 'ifeq', arg: spec.fallthroughLabel } },
    { labelDef: `${spec.returnLabel}:`, instruction: 'return' });
}

function loopHelperMethod(name, loopRegion) {
  return methodItem(name, '()V', Math.max(1, maxTouchedLocal(loopRegion) + 1), cloneItems(loopRegion));
}

function maybeHelperMethod(name, loopHelper, className, spec) {
  const reset = relabelItems(spec.resetItems, 'LCKMAYBE_RESET');
  const nullStore = relabelItems(spec.nullStoreItems, 'LCKMAYBE_NULL');
  const items = [
    { labelDef: 'LCKMAYBE0:', instruction: 'iload_2' },
    { instruction: { op: 'ifeq', arg: 'LCKMAYBE_AFTER_RESET' } },
    ...reset,
    { labelDef: 'LCKMAYBE_AFTER_RESET:', instruction: 'iload_1' },
    { instruction: cloneInstruction(spec.compareConstant) },
    { instruction: { op: spec.helperCompare, arg: 'LCKMAYBE_DO_LOOP' } },
    { instruction: 'iconst_0' },
    { instruction: 'ireturn' },
    ...withFirstLabel(nullStore, 'LCKMAYBE_DO_LOOP'),
    { instruction: 'aload_0' },
    { instruction: { op: 'invokespecial', arg: ['Method', className, [loopHelper, '()V']] } },
    { instruction: 'iconst_1' },
    { instruction: 'ireturn' },
  ];
  return methodItem(name, `(${spec.valueDesc}I)Z`, 3, items);
}

function methodItem(name, descriptor, localsSize, codeItems) {
  return {
    type: 'method',
    method: {
      flags: ['private', 'final'],
      accessFlags: 18,
      name,
      descriptor,
      attributes: [{
        type: 'code',
        code: {
          long: false,
          stackSize: '64',
          localsSize: String(localsSize),
          codeItems,
          exceptionTable: [],
          attributes: [],
        },
      }],
    },
  };
}

function matchesNullFieldStore(codeItems, start, className) {
  const field = fieldRef(codeItems[start + 3] && codeItems[start + 3].instruction);
  return opAt(codeItems, start) === 'aload_0' &&
    opAt(codeItems, start + 1) === 'aconst_null' &&
    opAt(codeItems, start + 2) === 'checkcast' &&
    opAt(codeItems, start + 3) === 'putfield' &&
    field && field.owner === className;
}

function cloneResetItems(codeItems, resetIdx) {
  const items = [];
  for (let i = resetIdx; i < codeItems.length; i += 1) {
    if (opAt(codeItems, i) === 'goto') break;
    items.push(codeItems[i]);
  }
  return cloneItems(items);
}

function incomingRefsToRegion(region, refs) {
  const labels = new Set();
  for (const item of region.items) {
    const label = trim(item && item.labelDef);
    if (label) labels.add(label);
  }
  return refs.filter((ref) =>
    labels.has(ref.to) &&
    (ref.from < region.start || ref.from >= region.end) &&
    ref.to !== region.startLabel);
}

function collectBranchRefs(codeItems) {
  const refs = [];
  for (let i = 0; i < codeItems.length; i += 1) {
    for (const label of collectLabels(codeItems[i] && codeItems[i].instruction)) refs.push({ from: i, to: label });
  }
  return refs;
}

function collectLabels(value, out = []) {
  if (typeof value === 'string') {
    if (/^L[A-Za-z0-9_$]+$/.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const part of value) collectLabels(part, out);
  } else if (value && typeof value === 'object') {
    collectLabels(value.arg, out);
  }
  return out;
}

function localDescriptor(method, local) {
  const index = Number(local);
  if (!Number.isInteger(index)) return null;
  const slots = [];
  if (!hasStaticFlag(method)) slots.push({ index: 0, desc: 'Lthis;' });
  let slot = hasStaticFlag(method) ? 0 : 1;
  for (const desc of parseMethodParams(method.descriptor)) {
    slots.push({ index: slot, desc });
    slot += (desc === 'J' || desc === 'D') ? 2 : 1;
  }
  const found = slots.find((entry) => entry.index === index);
  if (!found || found.desc === 'Lthis;') return null;
  if (found.desc === 'Z' || found.desc === 'B' || found.desc === 'C' || found.desc === 'S') return found.desc;
  return found.desc === 'I' ? 'I' : null;
}

function hasClosedLocalInputs(items, initialLocals = new Set([0])) {
  const assigned = new Set(initialLocals);
  for (const item of items) {
    const insn = item && item.instruction;
    for (const local of readLocalIndexes(insn)) {
      if (!assigned.has(local)) return false;
    }
    for (const local of writtenLocalIndexes(insn)) assigned.add(local);
  }
  return true;
}

function maxTouchedLocal(items) {
  let max = -1;
  for (const item of items) {
    for (const local of readLocalIndexes(item && item.instruction)) max = Math.max(max, local);
    for (const local of writtenLocalIndexes(item && item.instruction)) max = Math.max(max, local);
  }
  return max;
}

function readLocalIndexes(insn) {
  const local = localIndex(insn);
  const opcode = op(insn);
  return local != null && /load/.test(opcode || '') ? [local] : [];
}

function writtenLocalIndexes(insn) {
  const local = localIndex(insn);
  const opcode = op(insn);
  return local != null && (/store/.test(opcode || '') || opcode === 'iinc') ? [local] : [];
}

function localIndex(insn) {
  const opcode = op(insn);
  if (!opcode) return null;
  const short = /^[ialfd]?(?:load|store)_(\d)$/.exec(opcode);
  if (short) return Number(short[1]);
  if (opcode === 'iinc') {
    const first = Array.isArray(insn.arg) ? insn.arg[0] : String(insn.arg || '').split(/\s+/)[0];
    const local = Number(first);
    return Number.isFinite(local) ? local : null;
  }
  if (/^[ialfd]?(?:load|store)$/.test(opcode)) {
    const local = Number(insn && insn.arg);
    return Number.isFinite(local) ? local : null;
  }
  return null;
}

function parseMethodParams(descriptor) {
  const end = descriptor.indexOf(')');
  const body = descriptor.slice(1, end);
  const out = [];
  for (let i = 0; i < body.length;) {
    let start = i;
    while (body[i] === '[') i += 1;
    if (body[i] === 'L') {
      i = body.indexOf(';', i) + 1;
      out.push(body.slice(start, i));
    } else {
      out.push(body.slice(start, i + 1));
      i += 1;
    }
  }
  return out;
}

function hasStaticFlag(method) {
  return (method.flags || []).includes('static') || (method.accessFlags & 0x0008) !== 0;
}

function freshMethodName(cls, prefix) {
  let n = 0;
  while (hasMethodPrefix(cls, `${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

function hasMethodPrefix(cls, prefix) {
  return (cls.items || []).some((item) =>
    item && item.type === 'method' && item.method && item.method.name.startsWith(prefix));
}

function cloneItems(items) {
  return items.map((item) => {
    const out = {};
    if (item.labelDef) out.labelDef = item.labelDef;
    if (item.instruction !== undefined) out.instruction = cloneInstruction(item.instruction);
    if (item.stackMapFrame) out.stackMapFrame = JSON.parse(JSON.stringify(item.stackMapFrame));
    if (item.lineNumber) out.lineNumber = item.lineNumber;
    return out;
  });
}

function cloneInstruction(insn) {
  if (!insn || typeof insn !== 'object') return insn;
  const out = Array.isArray(insn) ? insn.slice() : { ...insn };
  delete out.pc;
  delete out.cp_index;
  if (Array.isArray(out.arg)) out.arg = JSON.parse(JSON.stringify(out.arg));
  return out;
}

function relabelItems(items, prefix) {
  const labels = new Map();
  let next = 0;
  for (const item of items) {
    const label = trim(item && item.labelDef);
    if (label && !labels.has(label)) labels.set(label, `${prefix}_${next++}`);
  }
  return items.map((item) => {
    const out = cloneItems([item])[0];
    const label = trim(out.labelDef);
    if (label && labels.has(label)) out.labelDef = `${labels.get(label)}:`;
    rewriteLabels(out.instruction, labels);
    return out;
  });
}

function withFirstLabel(items, label) {
  const out = cloneItems(items);
  if (out.length > 0) out[0].labelDef = `${label}:`;
  return out;
}

function rewriteLabels(value, labels) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.arg === 'string' && labels.has(trim(value.arg))) value.arg = labels.get(trim(value.arg));
  if (Array.isArray(value.arg)) rewriteLabelsInArray(value.arg, labels);
}

function rewriteLabelsInArray(values, labels) {
  for (let i = 0; i < values.length; i += 1) {
    if (typeof values[i] === 'string' && labels.has(trim(values[i]))) values[i] = labels.get(trim(values[i]));
    else if (Array.isArray(values[i])) rewriteLabelsInArray(values[i], labels);
  }
}

function sameInstruction(a, b) {
  return JSON.stringify(stripVolatileInstruction(a)) === JSON.stringify(stripVolatileInstruction(b));
}

function stripVolatileInstruction(insn) {
  const out = cloneInstruction(insn);
  if (out && typeof out === 'object') {
    delete out.pc;
    delete out.cp_index;
  }
  return out;
}

function fieldRef(insn) {
  if (!insn || typeof insn !== 'object' || !Array.isArray(insn.arg)) return null;
  const arg = insn.arg;
  if (arg[0] !== 'Field' || !Array.isArray(arg[2])) return null;
  return { owner: arg[1], name: arg[2][0], desc: arg[2][1] };
}

function methodRef(insn) {
  if (!insn || typeof insn !== 'object' || !Array.isArray(insn.arg)) return null;
  const arg = insn.arg;
  if (arg[0] !== 'Method' || !Array.isArray(arg[2])) return null;
  return { owner: arg[1], name: arg[2][0], desc: arg[2][1] };
}

function isIntConstant(insn) {
  const opcode = op(insn);
  return opcode === 'iconst_m1' || /^iconst_[0-5]$/.test(opcode || '') ||
    opcode === 'bipush' || opcode === 'sipush' || opcode === 'ldc' || opcode === 'ldc_w';
}

function invertIntCompare(opcode) {
  return {
    if_icmpgt: 'if_icmple',
    if_icmpge: 'if_icmplt',
    if_icmplt: 'if_icmpge',
    if_icmple: 'if_icmpgt',
    if_icmpeq: 'if_icmpne',
    if_icmpne: 'if_icmpeq',
  }[opcode] || null;
}

function loadLocal(insn, family = 'i') {
  const opcode = op(insn);
  if (opcode === `${family}load_0`) return '0';
  if (opcode === `${family}load_1`) return '1';
  if (opcode === `${family}load_2`) return '2';
  if (opcode === `${family}load_3`) return '3';
  if (opcode === `${family}load`) return String(insn.arg);
  return null;
}

function loadInstruction(family, local) {
  const n = String(local);
  if (['0', '1', '2', '3'].includes(n)) return `${family}load_${n}`;
  return { op: `${family}load`, arg: n };
}

function hasMethod(cls, name, descriptor) {
  return (cls.items || []).some((item) =>
    item && item.type === 'method' && item.method &&
    item.method.name === name && item.method.descriptor === descriptor);
}

function findLabelIndex(codeItems, label) {
  const target = trim(label);
  return codeItems.findIndex((item) => trim(item && item.labelDef) === target);
}

function opAt(codeItems, index) {
  return op(codeItems[index] && codeItems[index].instruction);
}

function op(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function trim(label) {
  return typeof label === 'string' && label.endsWith(':') ? label.slice(0, -1) : label;
}

module.exports = { runTerminalIteratorExtract };
