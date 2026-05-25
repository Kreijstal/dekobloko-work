'use strict';

let helperBranchLabelId = 0;

function runTerminalCleanupExtract(astRoot) {
  let rewrites = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || !Array.isArray(cls.items) || !cls.className) continue;
    const originalItems = cls.items.slice();
    for (const item of originalItems) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name === '<init>' || item.method.name === '<clinit>') continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const code = codeAttr && codeAttr.code;
      const codeItems = code && code.codeItems;
      if (!Array.isArray(codeItems) || codeItems.length < 180) continue;

      const regions = findCleanupRegions(codeItems, cls.className);
      if (regions.length < 2) continue;
      const refs = collectBranchRefs(codeItems);
      const safe = regions.filter((region) => hasNoExternalInteriorRefs(region, refs));
      if (safe.length < 2) continue;

      const helperName = freshMethodName(cls, 'ck$terminalCleanup');
      const helperItems = relabelItems(cloneItems(safe[0].items), 'LCKCLEAN');
      cls.items.push(methodItem(helperName, '()V', 4, helperItems));
      for (let i = safe.length - 1; i >= 0; i -= 1) {
        replaceRegionWithCall(codeItems, safe[i], cls.className, helperName);
        rewrites += 1;
      }

      const iteratorRegions = findIteratorCleanupRegions(codeItems, helperName);
      const iteratorSafe = iteratorRegions.filter((region) => hasNoExternalInteriorRefs(region, collectBranchRefs(codeItems)));
      if (iteratorSafe.length >= 2) {
        const iteratorHelperName = freshMethodName(cls, 'ck$terminalIteratorCleanup');
        cls.items.push(iteratorCleanupHelperMethod(iteratorHelperName, cls.className, helperName, iteratorSafe[0].spec));
        for (let i = iteratorSafe.length - 1; i >= 0; i -= 1) {
          replaceRegionWithCall(codeItems, iteratorSafe[i], cls.className, iteratorHelperName);
          rewrites += 1;
        }
        rewrites += inlineConditionalHelperBranches(codeItems, cls.className, iteratorHelperName);
        rewrites += inlineConditionalIteratorStartBranches(codeItems, cls.className, iteratorHelperName, iteratorSafe[0].spec);
      }
      rewrites += inlineConditionalHelperBranches(codeItems, cls.className, helperName);
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function findCleanupRegions(codeItems, className) {
  const regions = [];
  for (let i = 0; i < codeItems.length - 28; i += 1) {
    const header = readCleanupHeader(codeItems, i, className);
    if (!header) continue;
    const retIdx = findLabelIndex(codeItems, header.returnLabel);
    if (retIdx <= i || opAt(codeItems, retIdx) !== 'return') continue;
    if (countInstructions(codeItems, i, retIdx + 1) > 140) continue;
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

function readCleanupHeader(codeItems, start, className) {
  if (!isIntConstant(codeItems[start] && codeItems[start].instruction)) return null;
  if (!isByteConstant(codeItems[start + 1] && codeItems[start + 1].instruction)) return null;
  const firstCall = methodRef(codeItems[start + 2] && codeItems[start + 2].instruction);
  if (opAt(codeItems, start + 2) !== 'invokestatic' || !firstCall || firstCall.desc !== '(IB)V') return null;

  const arrayField = fieldRef(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (opAt(codeItems, start + 3) !== 'getstatic' || !arrayField || arrayField.desc !== '[I') return null;
  if (!isByteConstant(codeItems[start + 4] && codeItems[start + 4].instruction)) return null;
  const loopCall = methodRef(codeItems[start + 5] && codeItems[start + 5].instruction);
  if (opAt(codeItems, start + 5) !== 'invokestatic' || !loopCall || loopCall.desc !== '([IB)Z') return null;
  if (opAt(codeItems, start + 6) !== 'ifeq') return null;
  const afterLoop = trim(codeItems[start + 6].instruction.arg);
  if (!afterLoop) return null;
  if (opAt(codeItems, start + 7) !== 'aload_0') return null;
  if (!isIntConstant(codeItems[start + 8] && codeItems[start + 8].instruction)) return null;
  const receiverCall = methodRef(codeItems[start + 9] && codeItems[start + 9].instruction);
  if (opAt(codeItems, start + 9) !== 'invokevirtual' || !receiverCall || receiverCall.owner !== className || receiverCall.desc !== '(Z)V') return null;
  if (opAt(codeItems, start + 10) !== 'goto') return null;
  const loopLabel = trim(codeItems[start + 10].instruction.arg);
  if (loopLabel !== trim(codeItems[start + 3] && codeItems[start + 3].labelDef)) return null;
  const afterLoopIdx = findLabelIndex(codeItems, afterLoop);
  if (afterLoopIdx !== start + 11) return null;
  if (!isIntConstant(codeItems[start + 11] && codeItems[start + 11].instruction)) return null;
  const flagLocal = storeLocal(codeItems[start + 12] && codeItems[start + 12].instruction, 'i');
  if (flagLocal == null) return null;
  if (!isByteConstant(codeItems[start + 13] && codeItems[start + 13].instruction)) return null;
  const flagCall = methodRef(codeItems[start + 14] && codeItems[start + 14].instruction);
  if (opAt(codeItems, start + 14) !== 'invokestatic' || !flagCall || flagCall.desc !== '(B)Z') return null;
  if (opAt(codeItems, start + 15) !== 'ifeq') return null;

  let cursor = start + 16;
  if (opAt(codeItems, cursor) !== 'aload_0') return null;
  if (!isByteConstant(codeItems[cursor + 1] && codeItems[cursor + 1].instruction)) return null;
  const valueCall = methodRef(codeItems[cursor + 2] && codeItems[cursor + 2].instruction);
  if (opAt(codeItems, cursor + 2) !== 'invokevirtual' || !valueCall || valueCall.owner !== className || valueCall.desc !== '(B)I') return null;
  const valueLocal = storeLocal(codeItems[cursor + 3] && codeItems[cursor + 3].instruction, 'i');
  if (valueLocal == null) return null;
  cursor += 4;
  if (!isIntConstant(codeItems[cursor] && codeItems[cursor].instruction)) return null;
  if (loadLocal(codeItems[cursor + 1] && codeItems[cursor + 1].instruction, 'i') !== valueLocal) return null;
  if (opAt(codeItems, cursor + 2) !== 'iconst_m1') return null;
  if (opAt(codeItems, cursor + 3) !== 'ixor') return null;
  if (opAt(codeItems, cursor + 4) !== 'if_icmpeq') return null;
  const setTrueLabel = trim(codeItems[cursor + 4].instruction.arg);
  if (!setTrueLabel) return null;
  if (opAt(codeItems, cursor + 5) !== 'goto') return null;
  const afterFlagLabel = trim(codeItems[cursor + 5].instruction.arg);
  if (!afterFlagLabel) return null;
  const setTrueIdx = findLabelIndex(codeItems, setTrueLabel);
  if (setTrueIdx !== cursor + 6) return null;
  if (!isIntConstant(codeItems[setTrueIdx] && codeItems[setTrueIdx].instruction)) return null;
  if (storeLocal(codeItems[setTrueIdx + 1] && codeItems[setTrueIdx + 1].instruction, 'i') !== flagLocal) return null;
  const afterFlagIdx = findLabelIndex(codeItems, afterFlagLabel);
  if (afterFlagIdx !== setTrueIdx + 2) return null;

  if (loadLocal(codeItems[afterFlagIdx] && codeItems[afterFlagIdx].instruction, 'i') !== flagLocal) return null;
  if (opAt(codeItems, afterFlagIdx + 1) !== 'ifne') return null;
  const callLabel = trim(codeItems[afterFlagIdx + 1].instruction.arg);
  if (!callLabel) return null;
  if (opAt(codeItems, afterFlagIdx + 2) !== 'goto') return null;
  const returnLabel = trim(codeItems[afterFlagIdx + 2].instruction.arg);
  if (!returnLabel) return null;
  const callIdx = findLabelIndex(codeItems, callLabel);
  if (callIdx !== afterFlagIdx + 3) return null;
  const renderCall = findInvokeBeforeLabel(codeItems, callIdx, returnLabel);
  if (!renderCall || renderCall.desc !== '(I[Lhl;II[Lhl;ILqe;ILqe;IIIII)V') return null;

  return {
    returnLabel,
    key: JSON.stringify({
      firstCall,
      arrayField,
      loopCall,
      flagCall,
      valueCall,
      renderCall,
    }),
  };
}

function findInvokeBeforeLabel(codeItems, start, endLabel) {
  const end = findLabelIndex(codeItems, endLabel);
  if (end <= start || end - start > 48) return null;
  let seen = null;
  for (let i = start; i < end; i += 1) {
    const cur = methodRef(codeItems[i] && codeItems[i].instruction);
    if (opAt(codeItems, i) === 'invokestatic' && cur) seen = cur;
    if (isBranchOp(opAt(codeItems, i))) return null;
  }
  return seen;
}

function replaceRegionWithCall(codeItems, region, className, helperName) {
  codeItems.splice(region.start, region.end - region.start,
    { labelDef: region.startLabel ? `${region.startLabel}:` : undefined, instruction: 'aload_0' },
    { instruction: { op: 'invokespecial', arg: ['Method', className, [helperName, '()V']] } },
    { labelDef: `${region.returnLabel}:`, instruction: 'return' });
}

function findIteratorCleanupRegions(codeItems, cleanupHelperName) {
  const regions = [];
  for (let i = 0; i < codeItems.length - 16; i += 1) {
    const spec = readIteratorCleanupRegion(codeItems, i, cleanupHelperName);
    if (!spec) continue;
    regions.push({
      start: i,
      end: spec.end,
      startLabel: trim(codeItems[i] && codeItems[i].labelDef),
      returnLabel: spec.returnLabel,
      items: codeItems.slice(i, spec.end),
      spec,
    });
    i = spec.end - 1;
  }
  return groupRepeatedIteratorRegions(regions);
}

function readIteratorCleanupRegion(codeItems, start, cleanupHelperName) {
  const iteratorField = fieldRef(codeItems[start] && codeItems[start].instruction);
  if (opAt(codeItems, start) !== 'getstatic' || !iteratorField || !/^L[^;]+;$/.test(iteratorField.desc)) return null;
  if (!isByteConstant(codeItems[start + 1] && codeItems[start + 1].instruction)) return null;
  const nextCall = methodRef(codeItems[start + 2] && codeItems[start + 2].instruction);
  if (opAt(codeItems, start + 2) !== 'invokevirtual' || !nextCall || nextCall.owner !== iteratorField.desc.slice(1, -1) || nextCall.desc !== '(B)Lrf;') return null;
  const castType = castRef(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (!castType) return null;
  const itemLocal = storeLocal(codeItems[start + 4] && codeItems[start + 4].instruction, 'a');
  if (itemLocal == null) return null;

  let cursor = start + 5;
  if (loadLocal(codeItems[cursor] && codeItems[cursor].instruction, 'a') === itemLocal) cursor += 1;
  if (storeLocal(codeItems[cursor] && codeItems[cursor].instruction, 'a') != null) cursor += 1;
  if (loadLocal(codeItems[cursor] && codeItems[cursor].instruction, 'a') != null) cursor += 1;
  if (storeLocal(codeItems[cursor] && codeItems[cursor].instruction, 'a') != null) cursor += 1;
  if (loadLocal(codeItems[cursor] && codeItems[cursor].instruction, 'a') == null) return null;
  const nullBranch = codeItems[cursor + 1] && codeItems[cursor + 1].instruction;
  if (op(nullBranch) !== 'ifnonnull') return null;
  const bodyLabel = trim(nullBranch.arg);
  if (!bodyLabel) return null;

  const nullIdx = cursor + 2;
  if (opAt(codeItems, nullIdx) !== 'aload_0') return null;
  const cleanupCall = methodRef(codeItems[nullIdx + 1] && codeItems[nullIdx + 1].instruction);
  if (opAt(codeItems, nullIdx + 1) !== 'invokespecial' || !cleanupCall || cleanupCall.name !== cleanupHelperName || cleanupCall.desc !== '()V') return null;
  if (opAt(codeItems, nullIdx + 2) !== 'return') return null;
  const returnLabel = trim(codeItems[nullIdx + 2] && codeItems[nullIdx + 2].labelDef);

  const bodyIdx = findLabelIndex(codeItems, bodyLabel);
  if (bodyIdx !== nullIdx + 3) return null;
  if (!isIntConstant(codeItems[bodyIdx] && codeItems[bodyIdx].instruction)) return null;
  if (!isByteConstant(codeItems[bodyIdx + 1] && codeItems[bodyIdx + 1].instruction)) return null;
  if (loadLocal(codeItems[bodyIdx + 2] && codeItems[bodyIdx + 2].instruction, 'a') !== itemLocal) return null;
  const actionCall = methodRef(codeItems[bodyIdx + 3] && codeItems[bodyIdx + 3].instruction);
  if (opAt(codeItems, bodyIdx + 3) !== 'invokestatic' || !actionCall || actionCall.desc !== `(IBL${castType};)V`) return null;
  if (opAt(codeItems, bodyIdx + 4) !== 'goto') return null;
  if (trim(codeItems[bodyIdx + 4].instruction.arg) !== trim(codeItems[start] && codeItems[start].labelDef)) return null;

  return {
    end: bodyIdx + 5,
    returnLabel,
    iteratorField,
    nextCall,
    castType,
    actionCall,
    cleanupHelperName,
    iteratorArg: cloneInstruction(codeItems[start + 1].instruction),
    actionArg0: cloneInstruction(codeItems[bodyIdx].instruction),
    actionArg1: cloneInstruction(codeItems[bodyIdx + 1].instruction),
    key: JSON.stringify({ iteratorField, nextCall, castType, actionCall, cleanupHelperName }),
  };
}

function groupRepeatedIteratorRegions(regions) {
  const groups = new Map();
  for (const region of regions) {
    const list = groups.get(region.spec.key) || [];
    list.push(region);
    groups.set(region.spec.key, list);
  }
  return [...groups.values()].filter((list) => list.length >= 2).flat();
}

function iteratorCleanupHelperMethod(name, className, cleanupHelperName, spec) {
  const items = [
    { labelDef: 'LCKIC_LOOP:', instruction: { op: 'getstatic', arg: ['Field', spec.iteratorField.owner, [spec.iteratorField.name, spec.iteratorField.desc]] } },
    { instruction: cloneInstruction(spec.iteratorArg) },
    { instruction: { op: 'invokevirtual', arg: ['Method', spec.nextCall.owner, [spec.nextCall.name, spec.nextCall.desc]] } },
    { instruction: { op: 'checkcast', arg: spec.castType } },
    { instruction: 'astore_1' },
    { instruction: 'aload_1' },
    { instruction: { op: 'ifnull', arg: 'LCKIC_DONE' } },
    { instruction: cloneInstruction(spec.actionArg0) },
    { instruction: cloneInstruction(spec.actionArg1) },
    { instruction: 'aload_1' },
    { instruction: { op: 'invokestatic', arg: ['Method', spec.actionCall.owner, [spec.actionCall.name, spec.actionCall.desc]] } },
    { instruction: { op: 'goto', arg: 'LCKIC_LOOP' } },
    { labelDef: 'LCKIC_DONE:', instruction: 'aload_0' },
    { instruction: { op: 'invokespecial', arg: ['Method', className, [cleanupHelperName, '()V']] } },
    { instruction: 'return' },
  ];
  return methodItem(name, '()V', 2, items);
}

function inlineConditionalHelperBranches(codeItems, className, helperName) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length - 3; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;
    const target = trim(branch.arg);
    const targetIdx = findLabelIndex(codeItems, target);
    if (targetIdx <= i) continue;
    if (!isHelperReturnAt(codeItems, targetIdx, className, helperName)) continue;
    const fallthroughLabel = ensureLabel(codeItems[i + 1], `LCKH_${rewrites}`);
    branch.op = branchOp === 'ifeq' ? 'ifne' : 'ifeq';
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0,
      { instruction: 'aload_0' },
      { instruction: { op: 'invokespecial', arg: ['Method', className, [helperName, '()V']] } },
      { instruction: 'return' });
    i += 3;
    rewrites += 1;
  }
  return rewrites;
}

function inlineConditionalIteratorStartBranches(codeItems, className, helperName, spec) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length - 3; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;
    const target = trim(branch.arg);
    const targetIdx = findLabelIndex(codeItems, target);
    if (targetIdx <= i) continue;
    if (!isIteratorStartAt(codeItems, targetIdx, spec)) continue;
    const fallthroughLabel = ensureLabel(codeItems[i + 1], `LCKI_${rewrites}`);
    branch.op = branchOp === 'ifeq' ? 'ifne' : 'ifeq';
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0,
      { instruction: 'aload_0' },
      { instruction: { op: 'invokespecial', arg: ['Method', className, [helperName, '()V']] } },
      { instruction: 'return' });
    i += 3;
    rewrites += 1;
  }
  return rewrites;
}

function isIteratorStartAt(codeItems, index, spec) {
  const iteratorField = fieldRef(codeItems[index] && codeItems[index].instruction);
  if (opAt(codeItems, index) !== 'getstatic' || !sameRef(iteratorField, spec.iteratorField)) return false;
  if (!sameInstruction(codeItems[index + 1] && codeItems[index + 1].instruction, spec.iteratorArg)) return false;
  const nextCall = methodRef(codeItems[index + 2] && codeItems[index + 2].instruction);
  if (opAt(codeItems, index + 2) !== 'invokevirtual' || !sameRef(nextCall, spec.nextCall)) return false;
  if (castRef(codeItems[index + 3] && codeItems[index + 3].instruction) !== spec.castType) return false;
  return storeLocal(codeItems[index + 4] && codeItems[index + 4].instruction, 'a') != null;
}

function isHelperReturnAt(codeItems, index, className, helperName) {
  if (opAt(codeItems, index) !== 'aload_0') return false;
  const call = methodRef(codeItems[index + 1] && codeItems[index + 1].instruction);
  if (opAt(codeItems, index + 1) !== 'invokespecial' || !call || call.owner !== className || call.name !== helperName || call.desc !== '()V') return false;
  return opAt(codeItems, index + 2) === 'return';
}

function ensureLabel(item, prefix) {
  const existing = trim(item && item.labelDef);
  if (existing) return existing;
  const label = `${prefix}_${helperBranchLabelId++}`;
  item.labelDef = `${label}:`;
  return label;
}

function sameRef(a, b) {
  return !!a && !!b && a.owner === b.owner && a.name === b.name && a.desc === b.desc;
}

function sameInstruction(a, b) {
  return JSON.stringify(stripVolatileInstruction(a)) === JSON.stringify(stripVolatileInstruction(b));
}

function stripVolatileInstruction(insn) {
  if (!insn || typeof insn !== 'object') return insn;
  const out = Array.isArray(insn) ? insn.map(stripVolatileInstruction) : { ...insn };
  delete out.pc;
  delete out.cp_index;
  if (out.arg !== undefined) out.arg = stripVolatileInstruction(out.arg);
  return out;
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

function findLabelIndex(codeItems, label) {
  for (let i = 0; i < codeItems.length; i += 1) {
    if (trim(codeItems[i] && codeItems[i].labelDef) === label) return i;
  }
  return -1;
}

function countInstructions(codeItems, start, end) {
  let count = 0;
  for (let i = start; i < end; i += 1) if (codeItems[i] && codeItems[i].instruction) count += 1;
  return count;
}

function fieldRef(insn) {
  const arg = insn && insn.arg;
  if (Array.isArray(arg) && arg[0] === 'Field') return { owner: arg[1], name: arg[2] && arg[2][0], desc: arg[2] && arg[2][1] };
  return null;
}

function methodRef(insn) {
  const arg = insn && insn.arg;
  if (Array.isArray(arg) && (arg[0] === 'Method' || arg[0] === 'InterfaceMethod')) {
    return { owner: arg[1], name: arg[2] && arg[2][0], desc: arg[2] && arg[2][1] };
  }
  return null;
}

function castRef(insn) {
  return op(insn) === 'checkcast' && typeof insn.arg === 'string' ? insn.arg : null;
}

function storeLocal(insn, kind) {
  const cur = op(insn);
  const prefix = kind === 'i' ? 'istore' : 'astore';
  if (cur === `${prefix}_0`) return 0;
  if (cur === `${prefix}_1`) return 1;
  if (cur === `${prefix}_2`) return 2;
  if (cur === `${prefix}_3`) return 3;
  if (cur === prefix) return Number(insn.arg);
  return null;
}

function loadLocal(insn, kind) {
  const cur = op(insn);
  const prefix = kind === 'i' ? 'iload' : 'aload';
  if (cur === `${prefix}_0`) return 0;
  if (cur === `${prefix}_1`) return 1;
  if (cur === `${prefix}_2`) return 2;
  if (cur === `${prefix}_3`) return 3;
  if (cur === prefix) return Number(insn.arg);
  return null;
}

function isBranchOp(cur) {
  return typeof cur === 'string' && (cur === 'goto' || cur.startsWith('if'));
}

function isIntConstant(insn) {
  const cur = op(insn);
  return cur === 'iconst_m1' || /^iconst_[0-5]$/.test(cur || '') || cur === 'bipush' || cur === 'sipush' || cur === 'ldc' || cur === 'ldc_w';
}

function isByteConstant(insn) {
  const cur = op(insn);
  return /^iconst_[0-5]$/.test(cur || '') || cur === 'bipush';
}

function opAt(codeItems, i) {
  return op(codeItems[i] && codeItems[i].instruction);
}

function op(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function trim(label) {
  return typeof label === 'string' && label.endsWith(':') ? label.slice(0, -1) : label;
}

module.exports = { runTerminalCleanupExtract };
