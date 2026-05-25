'use strict';

function runTerminalActionExtract(astRoot) {
  let rewrites = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || !Array.isArray(cls.items) || !cls.className) continue;
    const originalItems = cls.items.slice();
    for (const item of originalItems) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name === '<init>' || item.method.name === '<clinit>') continue;
      const params = parseMethodParams(item.method.descriptor);
      if (params.length !== 1 || (params[0] !== 'B' && params[0] !== 'I') || !item.method.descriptor.endsWith(')V')) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const code = codeAttr && codeAttr.code;
      const codeItems = code && code.codeItems;
      if (!Array.isArray(codeItems) || codeItems.length < 200) continue;

      const regions = findTerminalActionRegions(codeItems, cls.className);
      if (regions.length < 2) continue;
      const refs = collectBranchRefs(codeItems);
      const safe = regions.filter((region) => hasNoExternalInteriorRefs(region, refs));
      if (safe.length < 2) continue;

      const helperName = freshMethodName(cls, 'ck$terminalAction');
      const helperItems = relabelItems(cloneItems(safe[0].items), 'LCKTA');
      cls.items.push(methodItem(helperName, `(${params[0]})V`, 2, helperItems));
      for (let i = safe.length - 1; i >= 0; i -= 1) {
        replaceRegionWithCall(codeItems, safe[i], cls.className, helperName, params[0]);
        rewrites += 1;
      }
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function findTerminalActionRegions(codeItems, className) {
  const regions = [];
  for (let i = 0; i < codeItems.length - 16; i += 1) {
    const header = readTerminalActionHeader(codeItems, i, className);
    if (!header) continue;
    const retIdx = findLabelIndex(codeItems, header.returnLabel);
    if (retIdx <= i || opAt(codeItems, retIdx) !== 'return') continue;
    if (countInstructions(codeItems, i, retIdx + 1) > 520) continue;
    if (!regionBranchesStayInside(codeItems, i, retIdx + 1)) continue;
    regions.push({
      start: i,
      end: retIdx + 1,
      startLabel: trim(codeItems[i] && codeItems[i].labelDef),
      returnLabel: header.returnLabel,
      items: codeItems.slice(i, retIdx + 1),
      key: header.key,
    });
    i = retIdx;
  }
  return groupRepeatedRegions(regions);
}

function readTerminalActionHeader(codeItems, start, className) {
  if (opAt(codeItems, start) !== 'aload_0') return null;
  const receiverField = fieldRef(codeItems[start + 1] && codeItems[start + 1].instruction);
  if (!receiverField || receiverField.owner !== className || receiverField.desc !== 'Z') return null;
  if (opAt(codeItems, start + 2) !== 'ifeq') return null;
  const contLabel = trim((codeItems[start + 2] && codeItems[start + 2].instruction || {}).arg);
  if (!contLabel) return null;
  const staticField = fieldRef(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (!staticField || staticField.desc !== 'Z') return null;
  const staticBranch = opAt(codeItems, start + 4);
  if (staticBranch !== 'ifne' && staticBranch !== 'ifeq') return null;
  const returnLabel = trim((codeItems[start + 4] && codeItems[start + 4].instruction || {}).arg);
  if (!returnLabel) return null;
  if (!isByteConstant(codeItems[start + 5] && codeItems[start + 5].instruction)) return null;
  const call = methodRef(codeItems[start + 6] && codeItems[start + 6].instruction);
  if (!call || call.desc !== '(B)Z' || opAt(codeItems, start + 6) !== 'invokestatic') return null;
  if (opAt(codeItems, start + 7) !== 'ifeq') return null;
  if (trim((codeItems[start + 7] && codeItems[start + 7].instruction || {}).arg) !== contLabel) return null;
  if (opAt(codeItems, start + 8) !== 'return') return null;
  if (trim(codeItems[start + 9] && codeItems[start + 9].labelDef) !== contLabel) return null;
  if (loadLocal(codeItems[start + 9] && codeItems[start + 9].instruction, 'i') !== 1) return null;
  if (!isByteConstant(codeItems[start + 10] && codeItems[start + 10].instruction)) return null;
  const compare = opAt(codeItems, start + 11);
  if (compare !== 'if_icmpeq' && compare !== 'if_icmpne') return null;
  if (opAt(codeItems, start + 12) !== 'return' && opAt(codeItems, start + 12) !== 'goto') return null;
  return {
    returnLabel,
    key: JSON.stringify({
      receiverField,
      staticField,
      staticBranch,
      byteConstant: stripVolatileInstruction(codeItems[start + 5].instruction),
      call,
      argConstant: stripVolatileInstruction(codeItems[start + 10].instruction),
      compare,
    }),
  };
}

function groupRepeatedRegions(regions) {
  const groups = new Map();
  for (const region of regions) {
    const list = groups.get(region.key) || [];
    list.push(region);
    groups.set(region.key, list);
  }
  return [...groups.values()].filter((list) => list.length >= 2).flat();
}

function replaceRegionWithCall(codeItems, region, className, helperName, paramDesc) {
  codeItems.splice(region.start, region.end - region.start,
    { labelDef: region.startLabel ? `${region.startLabel}:` : undefined, instruction: 'aload_0' },
    { instruction: loadInstruction(paramDesc, 1) },
    { instruction: { op: 'invokespecial', arg: ['Method', className, [helperName, `(${paramDesc})V`]] } },
    { labelDef: `${region.returnLabel}:`, instruction: 'return' });
}

function hasNoExternalInteriorRefs(region, refs) {
  const labels = new Set();
  for (let i = region.start + 1; i < region.end - 1; i += 1) {
    const label = trim(region.items[i - region.start] && region.items[i - region.start].labelDef);
    if (label) labels.add(label);
  }
  return refs.every((ref) => !labels.has(ref.to) || (ref.from >= region.start && ref.from < region.end));
}

function regionBranchesStayInside(codeItems, start, end) {
  const labels = new Map();
  for (let i = start; i < end; i += 1) {
    const label = trim(codeItems[i] && codeItems[i].labelDef);
    if (label) labels.set(label, i);
  }
  for (let i = start; i < end; i += 1) {
    for (const label of collectLabels(codeItems[i] && codeItems[i].instruction)) {
      const target = labels.get(label);
      if (target == null || target < start || target >= end) return false;
    }
  }
  return true;
}

function collectBranchRefs(codeItems) {
  const refs = [];
  for (let i = 0; i < codeItems.length; i += 1) {
    for (const label of collectLabels(codeItems[i] && codeItems[i].instruction)) refs.push({ from: i, to: label });
  }
  return refs;
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

function countInstructions(codeItems, start, end) {
  let count = 0;
  for (let i = start; i < end; i += 1) if (codeItems[i] && codeItems[i].instruction) count += 1;
  return count;
}

function findLabelIndex(codeItems, label) {
  for (let i = 0; i < codeItems.length; i += 1) {
    if (trim(codeItems[i] && codeItems[i].labelDef) === label) return i;
  }
  return -1;
}

function freshMethodName(cls, prefix) {
  let n = 0;
  while ((cls.items || []).some((item) => item && item.type === 'method' && item.method && item.method.name === `${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
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
    out.instruction = rewriteLabels(out.instruction, labels);
    return out;
  });
}

function rewriteLabels(value, labels) {
  if (typeof value === 'string') return labels.get(value) || value;
  if (Array.isArray(value)) return value.map((part) => rewriteLabels(part, labels));
  if (value && typeof value === 'object') {
    const out = { ...value };
    if (out.arg !== undefined) out.arg = rewriteLabels(out.arg, labels);
    return out;
  }
  return value;
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

function parseMethodParams(descriptor) {
  const end = descriptor.indexOf(')');
  const body = descriptor.slice(1, end);
  const out = [];
  for (let i = 0; i < body.length;) {
    const start = i;
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

function loadInstruction(desc, local) {
  const kind = desc === 'J' ? 'l' : desc === 'F' ? 'f' : desc === 'D' ? 'd' : desc && (desc[0] === 'L' || desc[0] === '[') ? 'a' : 'i';
  if (local >= 0 && local <= 3) return `${kind}load_${local}`;
  return { op: `${kind}load`, arg: String(local) };
}

function loadLocal(insn, kind) {
  const opcode = op(insn);
  if (opcode === `${kind}load`) return Number(insn.arg);
  const short = new RegExp(`^${kind}load_(\\d)$`).exec(opcode || '');
  return short ? Number(short[1]) : null;
}

function isByteConstant(insn) {
  const opcode = op(insn);
  return opcode === 'bipush' || opcode === 'sipush' || opcode === 'iconst_m1' || /^iconst_[0-5]$/.test(opcode || '');
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

function stripVolatileInstruction(insn) {
  return cloneInstruction(insn);
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

module.exports = { runTerminalActionExtract };
