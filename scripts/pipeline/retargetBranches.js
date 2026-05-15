'use strict';

function runRetargetBranches(astRoot, options = {}) {
  let changed = 0;
  for (const target of options.targets || []) {
    const cls = findClass(astRoot, target.className);
    if (!cls) continue;
    for (const field of target.addFields || []) {
      changed += addField(cls, field);
    }
    if (!target.methodName) continue;
    const method = findMethod(cls, target.methodName, target.descriptor);
    if (!method) continue;
    const codeAttr = (method.attributes || []).find((attr) => attr && attr.type === 'code');
    const code = codeAttr && codeAttr.code;
    const codeItems = code && code.codeItems;
    if (!Array.isArray(codeItems)) continue;

    if (target.minLocals) {
      const current = Number(code.localsSize || 0);
      if (!Number.isNaN(current) && current < target.minLocals) {
        code.localsSize = String(target.minLocals);
        changed += 1;
      }
    }

    for (const split of target.splitBooleanParams || []) {
      changed += splitBooleanParam(codeItems, code, split);
    }

    for (const split of target.splitLocalFromStoreOrdinal || []) {
      changed += splitLocalFromStoreOrdinal(codeItems, code, split);
    }

    for (const typedNull of target.typedNullLocalStores || []) {
      changed += typeNullLocalStore(codeItems, typedNull);
    }

    const cloneLabels = new Map();
    for (const clone of target.clones || []) {
      const cloneStart = cloneRange(codeItems, clone.start, clone.end, clone.prefix, clone.before);
      if (clone.name) cloneLabels.set(clone.name, cloneStart);
      changed += 1;
      for (const retarget of clone.retargets || []) {
        changed += retargetBranch(codeItems, {
          ...retarget,
          to: retarget.toClone ? cloneLabels.get(retarget.toClone) : retarget.to,
        });
      }
    }

    for (const insert of target.insertBefore || []) {
      insertItemsBefore(codeItems, insert.label, insert.items || []);
      changed += 1;
    }

    for (const replace of target.replace || []) {
      changed += replaceBranch(codeItems, replace);
    }

    for (const replace of target.replaceInstructions || []) {
      changed += replaceInstruction(codeItems, replace);
    }

    for (const remove of target.deleteInstructions || []) {
      changed += deleteInstruction(codeItems, remove);
    }

    for (const replace of target.replaceAllInstructions || []) {
      changed += replaceAllInstructions(codeItems, replace);
    }

    for (const edit of target.edits || []) {
      changed += retargetBranch(codeItems, edit);
    }
  }
  return { changed: changed > 0, changed };
}

function findClass(astRoot, className) {
  return (astRoot.classes || []).find((cls) => cls && cls.className === className) || null;
}

function findMethod(cls, name, descriptor) {
  for (const item of cls.items || []) {
    if (!item || item.type !== 'method' || !item.method) continue;
    if (item.method.name === name && item.method.descriptor === descriptor) return item.method;
  }
  return null;
}

function addField(cls, field) {
  const items = cls.items || [];
  if (items.some((item) => item && item.type === 'field' && item.field && item.field.name === field.name)) {
    return 0;
  }
  const accessFlags = field.accessFlags !== undefined ? Number(field.accessFlags) : 0;
  const flags = Array.isArray(field.flags) ? field.flags.slice() : [];
  const index = items.findIndex((item) => item && item.type !== 'field');
  const fieldItem = {
    type: 'field',
    field: {
      flags,
      accessFlags,
      name: field.name,
      descriptor: field.descriptor,
      value: field.value === undefined ? null : field.value,
      attrs: field.attrs === undefined ? null : field.attrs,
    },
  };
  if (index < 0) items.push(fieldItem);
  else items.splice(index, 0, fieldItem);
  cls.items = items;
  return 1;
}

function findLabeledItem(codeItems, label) {
  const wanted = `${trim(label)}:`;
  return codeItems.find((item) => item && item.labelDef === wanted) || null;
}

function findLabelIndex(codeItems, label) {
  const wanted = `${trim(label)}:`;
  return codeItems.findIndex((item) => item && item.labelDef === wanted);
}

function retargetBranch(codeItems, edit) {
  const item = findLabeledItem(codeItems, edit.label);
  if (!item) throw new Error(`retarget-branches: missing ${edit.label}`);
  const insn = item.instruction;
  if (!insn || typeof insn !== 'object') {
    throw new Error(`retarget-branches: ${edit.label} is not a branch`);
  }
  if (edit.op && insn.op !== edit.op) {
    throw new Error(`retarget-branches: ${edit.label} expected ${edit.op}, saw ${insn.op}`);
  }
  if (trim(insn.arg) !== trim(edit.from)) {
    throw new Error(`retarget-branches: ${edit.label} expected ${edit.from}, saw ${insn.arg}`);
  }
  if (!edit.to) throw new Error(`retarget-branches: missing replacement target for ${edit.label}`);
  insn.arg = edit.to;
  return 1;
}

function replaceBranch(codeItems, edit) {
  const item = findLabeledItem(codeItems, edit.label);
  if (!item) throw new Error(`retarget-branches: missing ${edit.label}`);
  const insn = item.instruction;
  if (!insn || typeof insn !== 'object') {
    throw new Error(`retarget-branches: ${edit.label} is not a branch`);
  }
  if (edit.fromOp && insn.op !== edit.fromOp) {
    throw new Error(`retarget-branches: ${edit.label} expected ${edit.fromOp}, saw ${insn.op}`);
  }
  if (edit.from && trim(insn.arg) !== trim(edit.from)) {
    throw new Error(`retarget-branches: ${edit.label} expected ${edit.from}, saw ${insn.arg}`);
  }
  item.instruction = {
    ...insn,
    ...(edit.toOp ? { op: edit.toOp } : {}),
    ...(edit.to ? { arg: edit.to } : {}),
  };
  return 1;
}

function replaceInstruction(codeItems, edit) {
  const item = findLabeledItem(codeItems, edit.label);
  if (!item) throw new Error(`retarget-branches: missing ${edit.label}`);
  const insn = item.instruction;
  if (!matchesInstruction(insn, edit.from)) {
    throw new Error(`retarget-branches: ${edit.label} expected ${formatInstruction(edit.from)}, saw ${formatInstruction(insn)}`);
  }
  item.instruction = normalizeInstruction(edit.to);
  return 1;
}

function deleteInstruction(codeItems, edit) {
  const index = findLabelIndex(codeItems, edit.label);
  if (index < 0) throw new Error(`retarget-branches: missing ${edit.label}`);
  const item = codeItems[index];
  const insn = item && item.instruction;
  if (!matchesInstruction(insn, edit.from)) {
    throw new Error(`retarget-branches: ${edit.label} expected ${formatInstruction(edit.from)}, saw ${formatInstruction(insn)}`);
  }
  codeItems.splice(index, 1);
  return 1;
}

function replaceAllInstructions(codeItems, edit) {
  let count = 0;
  for (const item of codeItems) {
    if (!item || !matchesInstruction(item.instruction, edit.from)) continue;
    item.instruction = normalizeInstruction(edit.to);
    count += 1;
  }
  if (edit.minCount && count < edit.minCount) {
    throw new Error(`retarget-branches: expected at least ${edit.minCount} replacements for ${formatInstruction(edit.from)}, saw ${count}`);
  }
  return count;
}

function splitBooleanParam(codeItems, code, split) {
  const local = String(split.local);
  const fresh = String(allocateLocal(code, split.freshLocal));
  let replaced = 0;
  for (const item of codeItems) {
    if (!item || !isLoadLocal(item.instruction, local)) continue;
    item.instruction = { op: 'iload', arg: fresh };
    replaced += 1;
  }
  let foldedCopies = 0;
  for (let i = 0; i < codeItems.length - 1; i += 1) {
    if (!isLoadLocal(codeItems[i] && codeItems[i].instruction, fresh)) continue;
    const nextInsn = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (!isStoreInstruction(nextInsn)) continue;
    const copiedLocal = storeLocal(nextInsn);
    if (copiedLocal === fresh) continue;
    codeItems[i + 1].instruction = storeInstruction(localFamily(nextInsn), fresh);
    foldedCopies += 1;
    for (let j = i + 2; j < codeItems.length; j += 1) {
      const insn = codeItems[j] && codeItems[j].instruction;
      if (isStoreLocal(insn, copiedLocal)) break;
      if (isLoadLocal(insn, copiedLocal)) codeItems[j].instruction = loadInstruction(localFamily(insn), fresh);
    }
  }
  if (split.minLoads && replaced < split.minLoads) {
    throw new Error(`retarget-branches: expected at least ${split.minLoads} loads of local ${local}, saw ${replaced}`);
  }
  const firstLabel = freshLabel(codeItems, split.prefix || 'LBOOLSPLIT_');
  const secondLabel = nextFreshLabel(codeItems, split.prefix || 'LBOOLSPLIT_', firstLabel);
  insertItemsAt(codeItems, 0, [
    { label: firstLabel, instruction: loadInstruction('i', local) },
    { label: secondLabel, instruction: { op: 'istore', arg: fresh } },
  ]);
  return replaced + foldedCopies + 1;
}

function splitLocalFromStoreOrdinal(codeItems, code, split) {
  const local = String(split.local);
  const fresh = String(allocateLocal(code, split.freshLocal));
  let seenStores = 0;
  let start = -1;
  for (let i = 0; i < codeItems.length; i += 1) {
    if (!isStoreLocal(codeItems[i] && codeItems[i].instruction, local)) continue;
    seenStores += 1;
    if (seenStores === split.storeOrdinal) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    throw new Error(`retarget-branches: missing store ordinal ${split.storeOrdinal} for local ${local}`);
  }

  const firstStore = codeItems[start].instruction;
  const family = localFamily(firstStore);
  let changed = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (i > start && split.stopBeforeStoreOrdinal && isStoreLocal(insn, local)) {
      seenStores += 1;
      if (seenStores >= split.stopBeforeStoreOrdinal) break;
    }
    if (i > start && isStoreLocal(insn, local) && localFamily(insn) !== family) break;
    if (isLoadLocal(insn, local)) {
      codeItems[i].instruction = loadInstruction(family, fresh);
      changed += 1;
    } else if (isStoreLocal(insn, local)) {
      codeItems[i].instruction = storeInstruction(family, fresh);
      changed += 1;
    } else if (family === 'i' && isIincLocal(insn, local)) {
      insn.varnum = fresh;
      changed += 1;
    }
  }
  if (split.minReplacements && changed < split.minReplacements) {
    throw new Error(`retarget-branches: expected at least ${split.minReplacements} replacements for local ${local}, saw ${changed}`);
  }
  return changed;
}

function typeNullLocalStore(codeItems, typedNull) {
  const local = String(typedNull.local);
  const storeOrdinal = Number(typedNull.storeOrdinal || 1);
  let seen = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    if (!isNullFedObjectStore(codeItems, i, local)) continue;
    seen += 1;
    if (seen !== storeOrdinal) continue;
    insertItemsAt(codeItems, i, [{
      label: freshLabel(codeItems, typedNull.prefix || 'LTYPEDNULL_'),
      instruction: { op: 'checkcast', arg: typedNull.type },
    }]);
    return 1;
  }
  throw new Error(`retarget-branches: missing null-fed astore ordinal ${storeOrdinal} for local ${local}`);
}

function previousExecutableIndex(codeItems, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (codeItems[i] && codeItems[i].instruction) return i;
  }
  return -1;
}

function isNullFedObjectStore(codeItems, index, local) {
  const insn = codeItems[index] && codeItems[index].instruction;
  if (!isStoreLocal(insn, local) || localFamily(insn) !== 'a') return false;
  const prev = previousExecutableIndex(codeItems, index);
  return prev >= 0 && getOp(codeItems[prev].instruction) === 'aconst_null';
}

function allocateLocal(code, requested) {
  if (requested !== undefined) {
    const n = Number(requested);
    if (!Number.isInteger(n) || n < 0) throw new Error(`retarget-branches: invalid requested local ${requested}`);
    const current = Number(code.localsSize || 0);
    if (!Number.isNaN(current) && current <= n) code.localsSize = String(n + 1);
    return n;
  }
  const current = Number(code.localsSize || 0);
  const fresh = Number.isNaN(current) ? 0 : current;
  code.localsSize = String(fresh + 1);
  return fresh;
}

function isLoadLocal(insn, local) {
  if (typeof insn === 'string') {
    const m = insn.match(/^([a-z])load_(\d)$/);
    return !!m && m[2] === local;
  }
  return !!insn && typeof insn === 'object' && /^[a-z]load$/.test(insn.op) && String(insn.arg) === local;
}

function isStoreLocal(insn, local) {
  if (typeof insn === 'string') {
    const m = insn.match(/^([a-z])store_(\d)$/);
    return !!m && m[2] === local;
  }
  return !!insn && typeof insn === 'object' && /^[a-z]store$/.test(insn.op) && String(insn.arg) === local;
}

function isIincLocal(insn, local) {
  return !!insn && typeof insn === 'object' && insn.op === 'iinc' && String(insn.varnum) === local;
}

function isStoreInstruction(insn) {
  if (typeof insn === 'string') return /^[a-z]store_\d$/.test(insn);
  return !!insn && typeof insn === 'object' && /^[a-z]store$/.test(insn.op);
}

function storeLocal(insn) {
  if (typeof insn === 'string') {
    const m = insn.match(/^[a-z]store_(\d)$/);
    return m ? m[1] : null;
  }
  return insn && insn.arg !== undefined ? String(insn.arg) : null;
}

function getOp(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function localFamily(insn) {
  const op = typeof insn === 'string' ? insn : insn && insn.op;
  if (!op) return 'a';
  if (op.startsWith('i')) return 'i';
  if (op.startsWith('a')) return 'a';
  if (op.startsWith('f')) return 'f';
  if (op.startsWith('d')) return 'd';
  if (op.startsWith('l')) return 'l';
  return 'a';
}

function loadInstruction(family, local) {
  const n = Number(local);
  if (Number.isInteger(n) && n >= 0 && n <= 3) return `${family}load_${n}`;
  return { op: `${family}load`, arg: String(local) };
}

function storeInstruction(family, local) {
  const n = Number(local);
  if (Number.isInteger(n) && n >= 0 && n <= 3) return `${family}store_${n}`;
  return { op: `${family}store`, arg: String(local) };
}

function freshLabel(codeItems, prefix) {
  let i = 0;
  while (findLabelIndex(codeItems, `${prefix}${i}`) >= 0) i += 1;
  return `${prefix}${i}`;
}

function nextFreshLabel(codeItems, prefix, reserved) {
  let i = 0;
  while (findLabelIndex(codeItems, `${prefix}${i}`) >= 0 || `${prefix}${i}` === reserved) i += 1;
  return `${prefix}${i}`;
}

function matchesInstruction(insn, expected) {
  if (typeof expected === 'string') return insn === expected;
  if (!expected || typeof expected !== 'object') return false;
  if (typeof insn === 'string') {
    return expected.op === insn && expected.arg === undefined;
  }
  if (!insn || typeof insn !== 'object') return false;
  if (expected.op !== undefined && insn.op !== expected.op) return false;
  if (expected.arg !== undefined && String(insn.arg) !== String(expected.arg)) return false;
  return true;
}

function normalizeInstruction(insn) {
  return typeof insn === 'string' ? insn : { ...insn };
}

function formatInstruction(insn) {
  if (typeof insn === 'string') return insn;
  if (!insn || typeof insn !== 'object') return String(insn);
  return insn.arg === undefined ? insn.op : `${insn.op} ${insn.arg}`;
}

function cloneRange(codeItems, start, end, prefix, before) {
  const startIndex = findLabelIndex(codeItems, start);
  const endIndex = findLabelIndex(codeItems, end);
  const insertIndex = findLabelIndex(codeItems, before);
  if (startIndex < 0 || endIndex < startIndex || insertIndex < 0) {
    throw new Error(`retarget-branches: bad clone range ${start}-${end} before ${before}`);
  }

  const originals = codeItems.slice(startIndex, endIndex + 1).map((item) => trim(item.labelDef));
  const labelMap = new Map(originals.map((label, index) => [label, `${prefix}${index}`]));
  const clones = codeItems.slice(startIndex, endIndex + 1).map((item) => {
    const out = { ...item, labelDef: `${labelMap.get(trim(item.labelDef))}:` };
    if (item.instruction && typeof item.instruction === 'object') {
      out.instruction = { ...item.instruction };
      const arg = trim(out.instruction.arg);
      if (labelMap.has(arg)) out.instruction.arg = labelMap.get(arg);
    }
    return out;
  });
  codeItems.splice(insertIndex, 0, ...clones);
  return labelMap.get(trim(start));
}

function insertItemsBefore(codeItems, label, items) {
  const insertIndex = findLabelIndex(codeItems, label);
  if (insertIndex < 0) throw new Error(`retarget-branches: missing insertion point ${label}`);
  insertItemsAt(codeItems, insertIndex, items);
}

function insertItemsAt(codeItems, insertIndex, items) {
  codeItems.splice(insertIndex, 0, ...items.map((item) => ({
    labelDef: `${trim(item.label)}:`,
    instruction: typeof item.instruction === 'string' ? item.instruction : { ...item.instruction },
  })));
}

function trim(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : label;
}

module.exports = { runRetargetBranches };
