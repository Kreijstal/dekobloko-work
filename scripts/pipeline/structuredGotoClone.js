'use strict';

function runStructuredGotoClone(astRoot) {
  let rewrites = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || !Array.isArray(cls.items)) continue;
    for (const item of cls.items) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name === '<init>' || item.method.name === '<clinit>') continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
      if (!Array.isArray(codeItems) || codeItems.length < 20) continue;
      if (process.env.STRUCTURED_GOTO_CLONE_SHORT !== '0') rewrites += cloneShortLoopContinues(codeItems);
      if (process.env.STRUCTURED_GOTO_CLONE_ZERO !== '0') rewrites += cloneZeroInitLoopPrefixes(codeItems);
      if (process.env.STRUCTURED_GOTO_CLONE_RETURN !== '0') rewrites += cloneForwardReturnCleanupGotos(codeItems);
      if (process.env.STRUCTURED_GOTO_CLONE_ARRAY_JOIN === '1') rewrites += cloneArrayLoadStoreJoins(codeItems);
      if (shouldRunSmallIincJoin(cls, item.method)) rewrites += cloneConditionalSmallIincJoins(codeItems);
      if (shouldRunFalseReturnGuardCleanup(cls, item.method)) rewrites += removeFalseReturnGuards(codeItems);
      if (shouldRunSharedContinueTailClone(cls, item.method)) rewrites += cloneSharedContinueTails(codeItems);
      if (shouldRunJiByteWrapScanTailClone(cls, item.method)) rewrites += cloneJiByteWrapScanTails(codeItems);
      if (shouldRunPbBlurTailRetarget(cls, item.method)) rewrites += retargetPbBlurLateTailEntry(codeItems);
      if (shouldRunDuplicateDrainHeaderCanonicalize(cls, item.method)) rewrites += canonicalizeDuplicateDrainHeader(codeItems);
      if (process.env.STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL !== '0') rewrites += mergeDuplicateArrayPretails(codeItems);
      let loopTailMerges = 0;
      if (process.env.STRUCTURED_GOTO_MERGE_IINC_TAILS !== '0') loopTailMerges += mergeDuplicateLoopIncrementTails(codeItems);
      if (loopTailMerges === 0 && process.env.STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS !== '0') loopTailMerges += mergeDuplicateLoopBackedgeTails(codeItems);
      rewrites += loopTailMerges;
      if (process.env.STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY === '1') rewrites += cloneForwardLoopBodyEntries(codeItems, item.method);
      if (process.env.STRUCTURED_GOTO_ONESHOT_PREHEADER === '1') rewrites += rewriteOneShotPreheaderUpdateEntries(codeItems, codeAttr.code);
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function shouldRunFalseReturnGuardCleanup(cls, method) {
  if (process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARDS === '0') return false;
  const targets = (process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS || 'se.a(I[B)V')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  const owner = cls && cls.className || '*';
  const signature = `${owner}.${method.name}${method.descriptor || ''}`;
  return targets.includes(signature);
}

function shouldRunSmallIincJoin(cls, method) {
  if (process.env.STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN === '1') return true;
  const targets = (process.env.STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN_TARGETS || 'oi.c(Lnh;)V')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  const owner = cls && cls.className || '*';
  const signature = `${owner}.${method.name}${method.descriptor || ''}`;
  return targets.includes(signature);
}

function shouldRunSharedContinueTailClone(cls, method) {
  if (process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAILS === '0') return false;
  const targets = (process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAIL_TARGETS || 'fc.a(ILjava/net/URL;Ljava/lang/String;Ljava/lang/String;I)Ljava/net/URL;')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  const owner = cls && cls.className || '*';
  const signature = `${owner}.${method.name}${method.descriptor || ''}`;
  return targets.includes(signature);
}

function shouldRunJiByteWrapScanTailClone(cls, method) {
  if (process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS === '0') return false;
  const targets = (process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_TARGETS || 'ji.b(B)I')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  const owner = cls && cls.className || '*';
  const signature = `${owner}.${method.name}${method.descriptor || ''}`;
  return targets.includes(signature);
}

function shouldRunPbBlurTailRetarget(cls, method) {
  if (process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET === '0') return false;
  const targets = (process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET_TARGETS || 'pb.a([IIIIIIIII)V')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  const owner = cls && cls.className || '*';
  const signature = `${owner}.${method.name}${method.descriptor || ''}`;
  return targets.includes(signature);
}

function shouldRunDuplicateDrainHeaderCanonicalize(cls, method) {
  if (process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER === '0') return false;
  const targetConfig = process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER_TARGETS || '';
  if (!targetConfig.trim()) return true;
  const targets = targetConfig
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (targets.length === 0) return false;
  const owner = cls && cls.className || '*';
  const signature = `${owner}.${method.name}${method.descriptor || ''}`;
  return targets.includes(signature);
}

function rewriteOneShotPreheaderUpdateEntries(codeItems, code) {
  let rewrites = 0;
  const refCounts = collectLabelReferenceCounts(codeItems);
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_ONESHOT_PREHEADER_MAX_REWRITES || 4);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const update = findLabelIndex(codeItems, jump.arg);
    if (update <= i) continue;
    const updateShape = readOneShotUpdateTail(codeItems, update);
    if (process.env.STRUCTURED_GOTO_ONESHOT_DEBUG === '1') {
      console.error(`oneshot candidate source=${i} target=${update} updateShape=${JSON.stringify(updateShape)}`);
    }
    if (!updateShape) {
      debugOneShotSkip(i, update, 'no-update-tail');
      continue;
    }
    const outerHeaderIndex = updateShape.outerHeaderIndex >= 0
      ? updateShape.outerHeaderIndex
      : findOuterHeaderBeforeInnerWithBackedge(codeItems, i + 1, updateShape.innerHeaderIndex, update);
    const requireOuterHeaderIntStore = updateShape.outerHeaderIndex >= 0;
    const allowOuterHeaderForwardGoto = updateShape.outerHeaderIndex < 0;
    if (outerHeaderIndex <= i || outerHeaderIndex >= update) {
      debugOneShotSkip(i, update, `bad-outer-index:${outerHeaderIndex}`);
      continue;
    }
    const innerHeaderIndex = updateShape.innerHeaderIndex > outerHeaderIndex
      ? updateShape.innerHeaderIndex
      : findInnerHeaderBeforeUpdate(codeItems, outerHeaderIndex, update);
    if (process.env.STRUCTURED_GOTO_ONESHOT_DEBUG === '1') {
      console.error(`oneshot outer=${outerHeaderIndex} inner=${innerHeaderIndex} looks=${looksLikeOneShotOuterHeader(codeItems, outerHeaderIndex, innerHeaderIndex, refCounts, { requireIntStore: requireOuterHeaderIntStore, allowForwardGoto: allowOuterHeaderForwardGoto })}`);
    }
    if (innerHeaderIndex <= outerHeaderIndex) {
      debugOneShotSkip(i, update, `no-inner-header:${innerHeaderIndex}`);
      continue;
    }
    const outerHeader = {
      index: outerHeaderIndex,
      end: innerHeaderIndex,
    };
    if (!looksLikeOneShotOuterHeader(codeItems, outerHeader.index, outerHeader.end, refCounts, { requireIntStore: requireOuterHeaderIntStore, allowForwardGoto: allowOuterHeaderForwardGoto })) {
      debugOneShotSkip(i, update, 'outer-header-shape');
      continue;
    }
    const fresh = chooseFreshIntLocal(codeItems, code);
    if (fresh == null) {
      debugOneShotSkip(i, update, 'no-fresh-local');
      continue;
    }

    const outerLabel = labelName(codeItems[outerHeader.index] && codeItems[outerHeader.index].labelDef);
    const guardFallthrough = `LCKOSP_${rewrites}`;
    const originalHeader = cloneItems([codeItems[outerHeader.index]])[0];
    originalHeader.labelDef = `${guardFallthrough}:`;
    codeItems[outerHeader.index].instruction = intLoadInstruction(fresh);
    codeItems.splice(outerHeader.index + 1, 0,
      { instruction: { op: 'ifeq', arg: guardFallthrough } },
      { instruction: 'iconst_0' },
      { instruction: { op: 'istore', arg: String(fresh) } },
      { instruction: { op: 'goto', arg: labelName(jump.arg) } },
      originalHeader,
    );

    codeItems.splice(i, 1,
      { labelDef: codeItems[i].labelDef, instruction: 'iconst_1' },
      { instruction: { op: 'istore', arg: String(fresh) } },
      { instruction: { op: 'goto', arg: outerLabel } },
    );
    rewrites += 1;
    i += 2;
  }
  return rewrites;
}

function debugOneShotSkip(source, target, reason) {
  if (process.env.STRUCTURED_GOTO_ONESHOT_DEBUG !== '1') return;
  console.error(`oneshot skip source=${source} target=${target} reason=${reason}`);
}

function readOneShotUpdateTail(codeItems, index) {
  if (op(codeItems[index] && codeItems[index].instruction) !== 'iinc') return null;
  let sideEffects = 0;
  for (let i = index + 1; i < Math.min(codeItems.length, index + 12); i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    if (cur === 'goto') {
      const targetIndex = findLabelIndex(codeItems, codeItems[i].instruction.arg);
      if (sideEffects > 0) return { end: i, outerHeaderIndex: targetIndex, innerHeaderIndex: -1 };
      return { end: i, outerHeaderIndex: -1, innerHeaderIndex: targetIndex };
    }
    if (isConditionalBranch(cur) || isReturnOp(cur)) return null;
    if (cur === 'iinc' || cur.startsWith('invoke') || cur.endsWith('store')) sideEffects += 1;
  }
  return null;
}

function findOuterHeaderBeforeInnerWithBackedge(codeItems, start, innerHeader, update) {
  if (innerHeader <= start || innerHeader >= update) return -1;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = innerHeader - 1; i >= start; i -= 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label || (refCounts.get(label) || 0) < 1) continue;
    if (!looksLikeOneShotOuterHeader(codeItems, i, innerHeader, refCounts, { requireIntStore: false, allowForwardGoto: true })) continue;
    if (hasBackedgeToLabelAfter(codeItems, label, update)) return i;
  }
  return -1;
}

function hasBackedgeToLabelAfter(codeItems, label, start) {
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && labelName(insn.arg) === label) return true;
  }
  return false;
}

function findInnerHeaderBeforeUpdate(codeItems, outerHeaderIndex, update) {
  for (let i = update - 1; i > outerHeaderIndex; i -= 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'goto') continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target > outerHeaderIndex && target < i) return target;
  }
  return -1;
}

function looksLikeOneShotOuterHeader(codeItems, start, update, refCounts, options = {}) {
  const label = labelName(codeItems[start] && codeItems[start].labelDef);
  if (!label || (refCounts.get(label) || 0) < 1) return false;
  const requireIntStore = options.requireIntStore !== false;
  const allowForwardGoto = options.allowForwardGoto === true;
  let seen = 0;
  let hasBranch = false;
  let hasIntStore = false;
  for (let i = start; i < update && seen < 20; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!insn) continue;
    seen += 1;
    if (isConditionalBranch(op(insn))) hasBranch = true;
    if (op(insn) === 'goto') {
      const target = findLabelIndex(codeItems, insn.arg);
      if (!allowForwardGoto || target <= i || target > update) return false;
      hasBranch = true;
      continue;
    }
    if (intStoreLocal(insn) != null) hasIntStore = true;
  }
  return seen > 0 && hasBranch && (!requireIntStore || hasIntStore);
}

function chooseFreshIntLocal(codeItems, code) {
  let max = -1;
  for (const item of codeItems) {
    for (const local of readLocalIndexes(item && item.instruction)) max = Math.max(max, local);
    for (const local of writtenLocalIndexes(item && item.instruction)) max = Math.max(max, local);
  }
  const limit = code && Number(code.localsSize);
  const candidate = max + 1;
  if (Number.isFinite(limit) && candidate < limit) return candidate;
  if (Number.isFinite(limit) && limit > 0) return limit - 1;
  return candidate;
}

function nextInstructionIndex(codeItems, start) {
  for (let i = start; i < codeItems.length; i += 1) {
    if (codeItems[i] && codeItems[i].instruction) return i;
  }
  return -1;
}

function intLoadInstruction(local) {
  if (local === 0) return 'iload_0';
  if (local === 1) return 'iload_1';
  if (local === 2) return 'iload_2';
  if (local === 3) return 'iload_3';
  return { op: 'iload', arg: String(local) };
}

function cloneForwardLoopBodyEntries(codeItems, method) {
  let rewrites = 0;
  const maxRewrites = 24;
  const refCounts = collectLabelReferenceCounts(codeItems);
  const initialLocals = methodInitialLocals(method);
  for (let i = codeItems.length - 1; i >= 0 && rewrites < maxRewrites; i -= 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (cur !== 'goto' && !isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const entry = readForwardLoopBodyEntry(codeItems, target, i, refCounts, initialLocals);
    if (!entry) continue;

    const clone = cloneItems(codeItems.slice(target, entry.end + 1));
    if (entry.renameInternalLabels) renameInternalLabels(clone, `LCKLBE_${rewrites}_`);
    else rewriteFirstLabel(clone, null);
    if (cur === 'goto') {
      if (entry.renameInternalLabels && codeItems[i].labelDef) clone.unshift({ labelDef: codeItems[i].labelDef });
      else clone[0].labelDef = codeItems[i].labelDef;
      codeItems.splice(i, 1, ...clone);
      rewrites += 1;
      continue;
    }

    const fallthrough = ensureLabel(codeItems[i + 1], `LCKLBE_F_${rewrites}`);
    insn.op = invertConditionalBranch(cur);
    insn.arg = fallthrough;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function removeFalseReturnGuards(codeItems) {
  let rewrites = 0;
  for (let i = 0; i + 2 < codeItems.length; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'iconst_0') continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'ifeq') continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'return') continue;
    codeItems[i].instruction = 'nop';
    codeItems[i + 1].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function cloneSharedContinueTails(codeItems) {
  let rewrites = 0;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 0; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifnull') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target < 0 || target >= i) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || (refCounts.get(targetLabel) || 0) < 2) continue;
    const first = codeItems[target] && codeItems[target].instruction;
    const second = codeItems[target + 1] && codeItems[target + 1].instruction;
    const third = codeItems[target + 2] && codeItems[target + 2].instruction;
    const loadLocal = intLoadLocal(first);
    const storeLocal = intStoreLocal(second);
    if (loadLocal == null || storeLocal == null || op(third) !== 'goto') continue;
    const loopHead = labelName(third.arg);
    if (!loopHead) continue;

    const insertAfter = findNextGotoToLabel(codeItems, i + 1, loopHead);
    if (insertAfter <= i) continue;
    const cloneLabel = freshLabel(codeItems, `LCKSCT_${rewrites}`);
    const clonedTail = cloneItems(codeItems.slice(target, target + 3));
    clonedTail[0].labelDef = `${cloneLabel}:`;
    branch.arg = cloneLabel;
    codeItems.splice(insertAfter + 1, 0, ...clonedTail);
    rewrites += 1;
    i = insertAfter + clonedTail.length;
  }
  return rewrites;
}

function cloneJiByteWrapScanTails(codeItems) {
  const sharedTail = findJiByteWrapScanTail(codeItems);
  if (!sharedTail) return 0;

  const maxRewrites = Number(process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_MAX_REWRITES || 4);
  const candidates = [];
  for (let i = 0; i + 4 < sharedTail.compIndex && candidates.length < maxRewrites; i += 1) {
    const underflow = codeItems[i] && codeItems[i].instruction;
    const direct = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (op(underflow) !== 'iflt' || labelName(underflow.arg) !== sharedTail.compLabel) continue;
    if (op(direct) !== 'goto' || labelName(direct.arg) !== sharedTail.checkLabel) continue;

    const refillA = readIincInstruction(codeItems[i + 2] && codeItems[i + 2].instruction);
    const refillB = readIincInstruction(codeItems[i + 3] && codeItems[i + 3].instruction);
    const localGoto = codeItems[i + 4] && codeItems[i + 4].instruction;
    if (!sameIinc(refillA, 3, 4) || !sameIinc(refillB, 2, 4) || op(localGoto) !== 'goto') continue;
    const localLoopHead = labelName(localGoto.arg);
    if (!localLoopHead) continue;
    candidates.push({ index: i, localLoopHead });
  }

  let rewrites = 0;
  for (let candidateIndex = candidates.length - 1; candidateIndex >= 0; candidateIndex -= 1) {
    const { index: i, localLoopHead } = candidates[candidateIndex];
    const underflow = codeItems[i] && codeItems[i].instruction;
    const direct = codeItems[i + 1] && codeItems[i + 1].instruction;
    const compClone = freshLabel(codeItems, `LCKJIBW_${rewrites}_COMP`);
    const checkClone = freshLabel(codeItems, `LCKJIBW_${rewrites}_CHECK`);
    const clone = buildJiByteWrapScanTailClone(codeItems, sharedTail, compClone, checkClone, localLoopHead);

    underflow.arg = compClone;
    direct.arg = checkClone;
    codeItems.splice(i + 2, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function buildJiByteWrapScanTailClone(codeItems, sharedTail, compClone, checkClone, localLoopHead) {
  const clone = cloneItems(codeItems.slice(sharedTail.compIndex, sharedTail.checkIndex + 8));
  clone[0].labelDef = `${compClone}:`;
  clone[sharedTail.checkIndex - sharedTail.compIndex].labelDef = `${checkClone}:`;
  clone.push(
    { instruction: { op: 'if_icmpne', arg: localLoopHead } },
    { instruction: intLoadInstruction(2) },
    { instruction: 'ireturn' },
  );
  return clone;
}

function findJiByteWrapScanTail(codeItems) {
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 0; i + 12 < codeItems.length; i += 1) {
    const compLabel = labelName(codeItems[i] && codeItems[i].labelDef);
    const checkLabel = labelName(codeItems[i + 2] && codeItems[i + 2].labelDef);
    if (!compLabel || !checkLabel) continue;
    if ((refCounts.get(compLabel) || 0) < 2 || (refCounts.get(checkLabel) || 0) < 2) continue;
    if (!sameIinc(readIincInstruction(codeItems[i] && codeItems[i].instruction), 2, 4)) continue;
    if (!sameIinc(readIincInstruction(codeItems[i + 1] && codeItems[i + 1].instruction), 3, 4)) continue;
    if (intLoadLocal(codeItems[i + 2] && codeItems[i + 2].instruction) !== 2) continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'iconst_m1') continue;
    if (op(codeItems[i + 4] && codeItems[i + 4].instruction) !== 'ixor') continue;
    if (refLoadLocal(codeItems[i + 5] && codeItems[i + 5].instruction) !== 0) continue;
    if (op(codeItems[i + 6] && codeItems[i + 6].instruction) !== 'getfield') continue;
    if (op(codeItems[i + 7] && codeItems[i + 7].instruction) !== 'getfield') continue;
    if (op(codeItems[i + 8] && codeItems[i + 8].instruction) !== 'iconst_m1') continue;
    if (op(codeItems[i + 9] && codeItems[i + 9].instruction) !== 'ixor') continue;
    const branchOp = op(codeItems[i + 10] && codeItems[i + 10].instruction);
    if (branchOp === 'if_icmpne') {
      if (intLoadLocal(codeItems[i + 11] && codeItems[i + 11].instruction) !== 2) continue;
      if (op(codeItems[i + 12] && codeItems[i + 12].instruction) !== 'ireturn') continue;
    } else if (branchOp === 'if_icmpeq') {
      if (op(codeItems[i + 11] && codeItems[i + 11].instruction) !== 'goto') continue;
      const exitIndex = findLabelIndex(codeItems, codeItems[i + 10].instruction.arg);
      if (exitIndex < 0 || intLoadLocal(codeItems[exitIndex] && codeItems[exitIndex].instruction) !== 2) continue;
      if (op(codeItems[exitIndex + 1] && codeItems[exitIndex + 1].instruction) !== 'ireturn') continue;
    } else {
      continue;
    }
    return {
      compIndex: i,
      checkIndex: i + 2,
      compLabel,
      checkLabel,
    };
  }
  return null;
}

function sameIinc(iinc, local, incr) {
  return !!iinc && iinc.local === local && iinc.incr === incr;
}

function retargetPbBlurLateTailEntry(codeItems) {
  const lateEntry = findPbBlurLateSharedEntry(codeItems);
  const firstTail = lateEntry && findPbBlurNegativeTailBefore(codeItems, lateEntry.branchIndex);
  if (!firstTail || !lateEntry) return 0;

  const branch = codeItems[lateEntry.branchIndex] && codeItems[lateEntry.branchIndex].instruction;
  if (op(branch) !== 'if_icmplt' || labelName(branch.arg) !== lateEntry.lateLabel) return 0;
  branch.arg = firstTail.label;
  return 1;
}

function findPbBlurNegativeTailBefore(codeItems, beforeIndex) {
  for (let i = Math.min(beforeIndex - 1, codeItems.length - 9); i >= 0; i -= 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 13) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'ifge') continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'iconst_0') continue;
    if (intStoreLocal(codeItems[i + 3] && codeItems[i + 3].instruction) !== 20) continue;
    if (intLoadLocal(codeItems[i + 4] && codeItems[i + 4].instruction) !== 20) continue;
    if (intLoadLocal(codeItems[i + 5] && codeItems[i + 5].instruction) !== 8) continue;
    if (op(codeItems[i + 6] && codeItems[i + 6].instruction) !== 'if_icmpge') continue;
    if (refLoadLocal(codeItems[i + 7] && codeItems[i + 7].instruction) !== 0) continue;
    if (intLoadLocal(codeItems[i + 8] && codeItems[i + 8].instruction) !== 19) continue;
    return { label, index: i };
  }
  return null;
}

function findPbBlurLateSharedEntry(codeItems) {
  for (let i = 0; i + 7 < codeItems.length; i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 13) continue;
    if (intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction) !== 18) continue;
    const branch = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (op(branch) !== 'if_icmplt') continue;
    const lateLabel = labelName(branch.arg);
    const lateIndex = findLabelIndex(codeItems, lateLabel);
    if (lateIndex < 0) continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'iload') continue;
    if (intLoadLocal(codeItems[i + 3] && codeItems[i + 3].instruction) !== 13) continue;
    if (op(codeItems[i + 4] && codeItems[i + 4].instruction) !== 'ifge') continue;
    if (op(codeItems[lateIndex] && codeItems[lateIndex].instruction) !== 'iconst_0') continue;
    if (intStoreLocal(codeItems[lateIndex + 1] && codeItems[lateIndex + 1].instruction) !== 20) continue;
    if (op(codeItems[lateIndex + 2] && codeItems[lateIndex + 2].instruction) !== 'goto') continue;
    const bodyLabel = labelName(codeItems[lateIndex + 2].instruction.arg);
    const bodyIndex = findLabelIndex(codeItems, bodyLabel);
    if (bodyIndex < 0 || intLoadLocal(codeItems[bodyIndex] && codeItems[bodyIndex].instruction) !== 20) continue;
    return { branchIndex: i + 2, lateLabel, bodyLabel };
  }
  return null;
}

function canonicalizeDuplicateDrainHeader(codeItems) {
  const headers = [];
  for (let i = 0; i + 16 < codeItems.length; i += 1) {
    const header = readDuplicateDrainHeader(codeItems, i);
    if (header) headers.push(header);
  }
  if (headers.length < 2) return 0;

  for (let i = 0; i < headers.length - 1; i += 1) {
    const early = headers[i];
    const canonical = headers[i + 1];
    if (!sameDuplicateDrainHeaderShape(codeItems, early, canonical)) continue;
    const refIndexes = collectLabelReferencesDetailed(codeItems, early.label);
    const changed = retargetDuplicateDrainHeaderRefs(codeItems, refIndexes, early, canonical);
    if (changed > 0) return changed;
  }
  return 0;
}

function readDuplicateDrainHeader(codeItems, index) {
  const label = labelName(codeItems[index] && codeItems[index].labelDef);
  if (!label) return null;
  if (!isIntegerConstant(codeItems[index] && codeItems[index].instruction)) return null;
  if (!isInvokeInstruction(codeItems[index + 1] && codeItems[index + 1].instruction)) return null;
  const exitBranch = codeItems[index + 2] && codeItems[index + 2].instruction;
  if (!isConditionalBranch(exitBranch)) return null;
  const exitLabel = labelName(exitBranch.arg);
  if (!exitLabel) return null;
  if (op(codeItems[index + 3] && codeItems[index + 3].instruction) !== 'getstatic') return null;
  const alternateBranch = codeItems[index + 4] && codeItems[index + 4].instruction;
  if (!isConditionalBranch(alternateBranch)) return null;
  const alternateLabel = labelName(alternateBranch.arg);
  if (!alternateLabel) return null;
  if (op(codeItems[index + 5] && codeItems[index + 5].instruction) !== 'getstatic') return null;
  const activeBranch = codeItems[index + 6] && codeItems[index + 6].instruction;
  if (!isConditionalBranch(activeBranch)) return null;
  const activeLabel = labelName(activeBranch.arg);
  if (!activeLabel) return null;
  if (op(codeItems[index + 7] && codeItems[index + 7].instruction) !== 'getstatic') return null;
  const redrawBranch = codeItems[index + 8] && codeItems[index + 8].instruction;
  if (!isConditionalBranch(redrawBranch)) return null;
  const redrawLabel = labelName(redrawBranch.arg);
  if (!redrawLabel) return null;
  const gotoActive = codeItems[index + 9] && codeItems[index + 9].instruction;
  if (op(gotoActive) !== 'goto' || labelName(gotoActive.arg) !== activeLabel) return null;
  const activeIndex = findLabelIndex(codeItems, activeLabel);
  if (activeIndex !== index + 10) return null;
  if (!isIntegerConstant(codeItems[index + 10] && codeItems[index + 10].instruction)) return null;
  if (!isIntegerConstant(codeItems[index + 11] && codeItems[index + 11].instruction)) return null;
  if (!isIntegerConstant(codeItems[index + 12] && codeItems[index + 12].instruction)) return null;
  if (op(codeItems[index + 13] && codeItems[index + 13].instruction) !== 'iconst_0') return null;
  if (!isInvokeInstruction(codeItems[index + 14] && codeItems[index + 14].instruction)) return null;
  const tailBranch = codeItems[index + 15] && codeItems[index + 15].instruction;
  if (!isConditionalBranch(tailBranch)) return null;
  const tailLabel = labelName(tailBranch.arg);
  if (!tailLabel) return null;
  const backedge = codeItems[index + 16] && codeItems[index + 16].instruction;
  if (op(backedge) !== 'goto' || labelName(backedge.arg) !== label) return null;

  return {
    index,
    label,
    exitLabel,
    alternateLabel,
    activeLabel,
    redrawLabel,
    tailLabel,
    backedgeIndex: index + 16,
  };
}

function sameDuplicateDrainHeaderShape(codeItems, early, canonical) {
  return sameDuplicateDrainHeaderInstructions(codeItems, early, canonical)
    && early.exitLabel === canonical.exitLabel
    && early.alternateLabel === canonical.alternateLabel
    && (early.redrawLabel === canonical.redrawLabel
      || sameDuplicateDrainRedrawTail(codeItems, early, canonical))
    && early.tailLabel === canonical.tailLabel
    && early.index < canonical.index;
}

function sameDuplicateDrainHeaderInstructions(codeItems, early, canonical) {
  const branchOffsets = new Set([2, 4, 6, 8, 9, 15, 16]);
  for (let offset = 0; offset <= 16; offset += 1) {
    if (branchOffsets.has(offset)) {
      if (op(codeItems[early.index + offset] && codeItems[early.index + offset].instruction)
        !== op(codeItems[canonical.index + offset] && codeItems[canonical.index + offset].instruction)) return false;
      continue;
    }
    if (!sameInstructionOperand(codeItems[early.index + offset] && codeItems[early.index + offset].instruction,
      codeItems[canonical.index + offset] && codeItems[canonical.index + offset].instruction)) return false;
  }
  return true;
}

function sameDuplicateDrainRedrawTail(codeItems, early, canonical) {
  const earlyIndex = findLabelIndex(codeItems, early.redrawLabel);
  const canonicalIndex = findLabelIndex(codeItems, canonical.redrawLabel);
  return earlyIndex >= 0
    && canonicalIndex >= 0
    && isDuplicateDrainRedrawTailAt(codeItems, earlyIndex, early.tailLabel)
    && isDuplicateDrainRedrawTailAt(codeItems, canonicalIndex, canonical.tailLabel)
    && sameInstructionRangeExceptFinalBranch(codeItems, earlyIndex, canonicalIndex, 7);
}

function isDuplicateDrainRedrawTailAt(codeItems, index, tailLabel) {
  if (!isIntegerConstant(codeItems[index] && codeItems[index].instruction)) return false;
  if (!isIntegerConstant(codeItems[index + 1] && codeItems[index + 1].instruction)) return false;
  if (!isIntegerConstant(codeItems[index + 2] && codeItems[index + 2].instruction)) return false;
  if (!isIntegerConstant(codeItems[index + 3] && codeItems[index + 3].instruction)) return false;
  if (!isInvokeInstruction(codeItems[index + 4] && codeItems[index + 4].instruction)) return false;
  if (op(codeItems[index + 5] && codeItems[index + 5].instruction) !== 'pop') return false;
  const jump = codeItems[index + 6] && codeItems[index + 6].instruction;
  return op(jump) === 'goto' && labelName(jump.arg) === tailLabel;
}

function sameInstructionRangeExceptFinalBranch(codeItems, left, right, length) {
  for (let offset = 0; offset < length; offset += 1) {
    const leftInsn = codeItems[left + offset] && codeItems[left + offset].instruction;
    const rightInsn = codeItems[right + offset] && codeItems[right + offset].instruction;
    if (offset === length - 1 && isBranchInstruction(leftInsn) && isBranchInstruction(rightInsn)) {
      if (op(leftInsn) !== op(rightInsn)) return false;
      continue;
    }
    if (!sameInstructionOperand(leftInsn, rightInsn)) return false;
  }
  return true;
}

function retargetDuplicateDrainHeaderRefs(codeItems, refIndexes, early, canonical) {
  let changed = 0;
  for (const index of refIndexes) {
    if (index >= canonical.index) continue;
    const insn = codeItems[index] && codeItems[index].instruction;
    if (!insn || labelName(insn.arg) !== early.label) continue;
    if (index > early.index && index !== early.backedgeIndex) continue;
    insn.arg = canonical.label;
    changed += 1;
  }
  return changed;
}

function readForwardLoopBodyEntry(codeItems, target, source, refCounts, initialLocals = new Set()) {
  const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
  if (!targetLabel || (refCounts.get(targetLabel) || 0) < 2) return null;
  const incoming = collectLabelReferencesDetailed(codeItems, targetLabel);
  const forwardIncoming = incoming.filter((idx) => idx < target).length;
  const backwardIncoming = incoming.filter((idx) => idx > target).length;
  const fallthrough = hasFallthroughPredecessor(codeItems, target);
  if (forwardIncoming !== 1 || backwardIncoming !== 1 || !fallthrough) return null;
  return readForwardLoopHeaderEntry(codeItems, target, source, initialLocals);
}

function readForwardLoopHeaderEntry(codeItems, target, source, initialLocals) {
  const guard = findFirstConditionalBranch(codeItems, target, target + 14);
  if (guard < 0) return null;
  const exitTarget = firstBranchTargetIndex(codeItems, guard);
  if (exitTarget == null || exitTarget <= guard) return null;
  const bodyStart = nextInstructionIndex(codeItems, guard + 1);
  if (bodyStart < 0 || bodyStart >= exitTarget) return null;
  const update = findBackedgeToTarget(codeItems, bodyStart, Math.min(exitTarget + 3, codeItems.length), target);
  if (update < 0) return null;
  if (!hasKnownLocalInputsAtSource(codeItems, source, target, update, initialLocals)) return null;
  if (countBranches(codeItems, target, update) > 8) return null;
  return { end: update, loopHeader: target, renameInternalLabels: true };
}

function hasKnownLocalInputsAtSource(codeItems, source, start, end, initialLocals = new Set()) {
  const needed = new Set();
  const definedInTail = new Set();
  for (let i = start; i <= end; i += 1) {
    for (const local of readLocalIndexes(codeItems[i] && codeItems[i].instruction)) {
      if (!definedInTail.has(local)) needed.add(local);
    }
    for (const local of writtenLocalIndexes(codeItems[i] && codeItems[i].instruction)) {
      definedInTail.add(local);
    }
  }
  if (needed.size === 0) return true;
  const assigned = new Set(initialLocals);
  for (let i = 0; i < source; i += 1) {
    for (const local of writtenLocalIndexes(codeItems[i] && codeItems[i].instruction)) {
      assigned.add(local);
    }
  }
  for (const local of needed) {
    if (!assigned.has(local)) return false;
  }
  return true;
}

function cloneShortLoopContinues(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'goto') continue;
    const previous = previousInstruction(codeItems, i - 1);
    if (op(previous && previous.instruction) !== 'iastore') continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const tail = readShortLoopContinueTail(codeItems, target, i);
    if (!tail) continue;
    const replacement = cloneItems(codeItems.slice(target, tail.end + 1));
    replacement[0].labelDef = codeItems[i].labelDef;
    codeItems.splice(i, 1, ...replacement);
    i += replacement.length - 1;
    rewrites += 1;
  }
  return rewrites;
}

function readShortLoopContinueTail(codeItems, target, source) {
  let i = target;
  let iincs = 0;
  while (i < codeItems.length && op(codeItems[i] && codeItems[i].instruction) === 'iinc' && iincs < 3) {
    i += 1;
    iincs += 1;
  }
  if (iincs === 0 || iincs > 2) return null;
  const jump = codeItems[i] && codeItems[i].instruction;
  if (op(jump) !== 'goto') return null;
  const loop = findLabelIndex(codeItems, jump.arg);
  if (loop < 0 || loop >= source) return null;
  if (!looksLikeLoopHeader(codeItems, loop)) return null;
  return { end: i };
}

function looksLikeLoopHeader(codeItems, index) {
  for (let i = index; i < Math.min(codeItems.length, index + 8); i += 1) {
    if (isBranchOp(op(codeItems[i] && codeItems[i].instruction))) return true;
  }
  return false;
}

function cloneZeroInitLoopPrefixes(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'goto') continue;
    const previous = previousInstruction(codeItems, i - 1);
    const previousOp = op(previous && previous.instruction);
    if (!previousOp || !previousOp.startsWith('invoke')) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const prefix = readZeroInitLoopPrefix(codeItems, target);
    if (!prefix) continue;
    const replacement = cloneItems(codeItems.slice(target, prefix.continueIndex));
    replacement.push({ instruction: { op: 'goto', arg: labelName(codeItems[prefix.continueIndex] && codeItems[prefix.continueIndex].labelDef) } });
    replacement[0].labelDef = codeItems[i].labelDef;
    codeItems.splice(i, 1, ...replacement);
    i += replacement.length - 1;
    rewrites += 1;
  }
  return rewrites;
}

function readZeroInitLoopPrefix(codeItems, target) {
  let i = target;
  const stores = [];
  while (i + 1 < codeItems.length && isZeroConstant(codeItems[i] && codeItems[i].instruction)) {
    const store = intStoreLocal(codeItems[i + 1] && codeItems[i + 1].instruction);
    if (store == null) break;
    stores.push(store);
    i += 2;
  }
  if (stores.length < 2 || stores.length > 4) return null;
  const firstLoad = intLoadLocal(codeItems[i] && codeItems[i].instruction);
  if (firstLoad == null || !stores.includes(firstLoad)) return null;
  if (!labelName(codeItems[i] && codeItems[i].labelDef)) return null;
  for (let j = i + 1; j < Math.min(codeItems.length, i + 8); j += 1) {
    if (isBranchOp(op(codeItems[j] && codeItems[j].instruction))) return { continueIndex: i };
  }
  return null;
}

function cloneForwardReturnCleanupGotos(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'goto') continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const tailEnd = readReturnCleanupTail(codeItems, target);
    if (tailEnd < 0) continue;
    const previous = previousInstruction(codeItems, i - 1);
    if (!previous || !isNullCompareBranch(previous.instruction)) continue;
    const replacement = cloneItems(codeItems.slice(target, tailEnd + 1));
    replacement[0].labelDef = codeItems[i].labelDef;
    codeItems.splice(i, 1, ...replacement);
    i += replacement.length - 1;
    rewrites += 1;
  }
  return rewrites;
}

function readReturnCleanupTail(codeItems, target) {
  let calls = 0;
  for (let i = target; i < Math.min(codeItems.length, target + 18); i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur && cur.startsWith('invoke')) calls += 1;
    if (cur === 'return') return calls === 1 ? i : -1;
    if (cur === 'goto' || (isBranchOp(cur) && cur !== 'return')) return -1;
  }
  return -1;
}

function isNullCompareBranch(insn) {
  const cur = op(insn);
  return cur === 'ifnull' || cur === 'ifnonnull' || cur === 'if_acmpeq' || cur === 'if_acmpne';
}

function cloneArrayLoadStoreJoins(codeItems) {
  let rewrites = 0;
  const maxRewrites = 16;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = codeItems.length - 1; i >= 0; i -= 1) {
    if (rewrites >= maxRewrites) break;
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (cur !== 'goto' && !isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const targetLabel = labelName(insn.arg);
    if ((refCounts.get(targetLabel) || 0) < 2 || (refCounts.get(targetLabel) || 0) > 8) continue;
    const join = readArrayLoadStoreJoin(codeItems, target);
    if (!join) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, join.continueIndex, refCounts)) {
      continue;
    }
    if (cur === 'goto') {
      continue;
    }
    const continuation = ensureLabel(codeItems[join.continueIndex], `LCKAJ_${rewrites}`);
    const clone = cloneItems(codeItems.slice(target, join.continueIndex));
    rewriteFirstLabel(clone, null);
    const fallthrough = ensureLabel(codeItems[i + 1], `LCKAJF_${rewrites}`);
    insn.op = invertConditionalBranch(cur);
    insn.arg = fallthrough;
    clone.push({ instruction: { op: 'goto', arg: continuation } });
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function cloneConditionalSmallIincJoins(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN_MAX_REWRITES || 64);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN_MAX_REFS || 8);
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = codeItems.length - 1; i >= 0 && rewrites < maxRewrites; i -= 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const targetLabel = labelName(insn.arg);
    const targetRefs = refCounts.get(targetLabel) || 0;
    if (targetRefs < 1 || targetRefs > maxRefs) continue;
    if (!hasImmediateFallthroughPredecessor(codeItems, target)) continue;
    const tail = readSmallIincJoinTail(codeItems, target, refCounts);
    if (!tail) continue;

    const clone = cloneItems(codeItems.slice(target, tail.end + 1));
    renameInternalLabels(clone, `LCKIJC_${rewrites}_`);
    const cloneEntry = `LCKIJ_${rewrites}`;
    clone[0].labelDef = `${cloneEntry}:`;
    insn.arg = cloneEntry;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function readSmallIincJoinTail(codeItems, target, refCounts) {
  let iincs = 0;
  for (let i = target; i < Math.min(codeItems.length, target + 6); i += 1) {
    if (i > target) {
      const label = labelName(codeItems[i] && codeItems[i].labelDef);
      if (label && (refCounts.get(label) || 0) > 0) return null;
    }
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (cur === 'iinc') {
      iincs += 1;
      if (iincs > 3) return null;
      continue;
    }
    if (cur === 'goto' && iincs > 0) {
      const targetIndex = findLabelIndex(codeItems, insn.arg);
      if (targetIndex < 0 || targetIndex === target) return null;
      return { end: i };
    }
    return null;
  }
  return null;
}

function mergeDuplicateArrayPretails(codeItems) {
  let rewrites = 0;
  const maxRewrites = 12;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 0; i + 10 < codeItems.length && rewrites < maxRewrites; i += 1) {
    const firstBranch = codeItems[i] && codeItems[i].instruction;
    const firstBranchOp = op(firstBranch);
    if (!isConditionalBranch(firstBranchOp)) continue;
    const firstSkip = findLabelIndex(codeItems, firstBranch.arg);
    if (firstSkip !== i + 6) continue;
    const firstLoad = readArrayLoadStoreAt(codeItems, i + 1);
    if (!firstLoad) continue;
    const jump = codeItems[i + 5] && codeItems[i + 5].instruction;
    if (op(jump) !== 'goto') continue;
    const join = findLabelIndex(codeItems, jump.arg);
    if (join <= i + 5) continue;
    const secondBranchIndex = findForwardBranchBefore(codeItems, firstSkip, join, 10);
    if (secondBranchIndex < 0) continue;
    const secondSkip = findLabelIndex(codeItems, codeItems[secondBranchIndex].instruction.arg);
    if (secondSkip <= join) continue;
    const secondLoadStart = findArrayLoadStoreEndingAt(codeItems, join, firstLoad);
    if (secondLoadStart < 0) continue;
    const secondLabel = labelName(codeItems[secondLoadStart] && codeItems[secondLoadStart].labelDef);
    if (!secondLabel) continue;
    if (hasReferencedLabelsInside(codeItems, i + 2, i + 5, refCounts)) continue;
    if (hasReferencedLabelsInside(codeItems, secondLoadStart + 1, join, refCounts)) continue;
    if (!onlyStackPrepAndForwardBranch(codeItems, firstSkip, secondBranchIndex)) continue;
    firstBranch.op = invertConditionalBranch(firstBranchOp);
    firstBranch.arg = secondLabel;
    codeItems.splice(i + 1, 5);
    rewrites += 1;
  }
  return rewrites;
}

function mergeDuplicateLoopIncrementTails(codeItems) {
  let rewrites = 0;
  const maxRewrites = 80;
  const groups = new Map();
  const refs = new Map();
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    const iinc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!iinc) continue;
    const jump = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (op(jump) !== 'goto') continue;
    const header = labelName(jump.arg);
    const headerIndex = findLabelIndex(codeItems, header);
    if (headerIndex < 0 || headerIndex >= i) continue;
    if (!looksLikeLoopHeader(codeItems, headerIndex)) continue;
    const labelRefs = collectLabelReferencesDetailed(codeItems, label);
    if (labelRefs.length === 0) continue;
    if (!labelRefs.every((ref) => isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))) continue;
    const key = `${iinc.local}:${iinc.incr}->${header}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ index: i, label, iinc, header, headerIndex, hasFallthrough: hasFallthroughPredecessor(codeItems, i) });
    refs.set(label, labelRefs);
  }

  for (const tails of groups.values()) {
    if (rewrites >= maxRewrites || tails.length < 2) continue;
    tails.sort((a, b) => Number(b.hasFallthrough) - Number(a.hasFallthrough) || a.index - b.index);
    const canonical = tails[0];
    for (const tail of tails.slice(1)) {
      if (rewrites >= maxRewrites) break;
      if (tail.hasFallthrough) continue;
      const incoming = refs.get(tail.label) || [];
      if (incoming.length === 0) continue;
      if (!incoming.every((ref) => ref !== tail.index && isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))) continue;
      for (const ref of incoming) {
        const insn = codeItems[ref] && codeItems[ref].instruction;
        if (insn && typeof insn === 'object' && labelName(insn.arg) === tail.label) insn.arg = canonical.label;
      }
      rewrites += 1;
    }
  }
  return rewrites;
}

function mergeDuplicateLoopBackedgeTails(codeItems) {
  let rewrites = 0;
  const maxRewrites = 80;
  const groups = new Map();
  const refs = collectLabelReferencesByLabel(codeItems);
  for (let i = 0; i < codeItems.length; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    const incoming = refs.get(label) || [];
    if (incoming.length === 0) continue;
    if (!incoming.every((ref) => isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))) continue;
    const tail = readBackedgeTail(codeItems, i, refs);
    if (!tail) continue;
    const key = tail.signature;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ index: i, label, incoming, tail, hasFallthrough: hasFallthroughPredecessor(codeItems, i) });
  }

  for (const tails of groups.values()) {
    if (rewrites >= maxRewrites || tails.length < 2) continue;
    tails.sort((a, b) => Number(b.hasFallthrough) - Number(a.hasFallthrough) || a.index - b.index);
    const canonical = tails[0];
    for (const tail of tails.slice(1)) {
      if (rewrites >= maxRewrites) break;
      if (tail.hasFallthrough) continue;
      if (!tail.incoming.every((ref) => ref !== tail.index && isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))) continue;
      for (const ref of tail.incoming) {
        const insn = codeItems[ref] && codeItems[ref].instruction;
        if (insn && typeof insn === 'object' && labelName(insn.arg) === tail.label) insn.arg = canonical.label;
      }
      rewrites += 1;
    }
  }
  return rewrites;
}

function readBackedgeTail(codeItems, index, refs) {
  if (looksLikeLoopValueContinuationTail(codeItems, index)) return null;
  const signature = [];
  let real = 0;
  for (let i = index; i < Math.min(codeItems.length, index + 8); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (i > index && label && (refs.get(label) || []).length > 0) return null;
    real += 1;
    signature.push(instructionSignature(insn));
    if (cur === 'goto') {
      const targetIndex = findLabelIndex(codeItems, insn.arg);
      if (targetIndex >= 0 && targetIndex < index && real >= 2) {
        if (!looksLikeLoopHeader(codeItems, targetIndex)) return null;
        return { end: i, signature: signature.join('|') };
      }
      return null;
    }
    if (real > 1 && isBranchOp(cur)) return null;
  }
  return null;
}

function looksLikeLoopValueContinuationTail(codeItems, index) {
  const ops = [];
  for (let i = index; i < Math.min(codeItems.length, index + 8); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (insn) ops.push(op(insn));
    if (op(insn) === 'goto') break;
  }
  return ops.join(' ') === 'aload_0 getfield iconst_0 invokevirtual checkcast astore goto' ||
    ops.join(' ') === 'aload_0 getfield iconst_0 invokevirtual astore goto';
}

function collectLabelReferencesByLabel(codeItems) {
  const out = new Map();
  for (let i = 0; i < codeItems.length; i += 1) {
    for (const label of collectInstructionLabels(codeItems[i] && codeItems[i].instruction)) {
      const normalized = labelName(label);
      if (!normalized) continue;
      if (!out.has(normalized)) out.set(normalized, []);
      out.get(normalized).push(i);
    }
  }
  return out;
}

function instructionSignature(insn) {
  return JSON.stringify([op(insn), normalizeSignatureValue(instructionArg(insn))]);
}

function instructionArg(insn) {
  if (!insn) return null;
  if (typeof insn === 'string') {
    const parts = insn.trim().split(/\s+/);
    return parts.slice(1).join(' ') || null;
  }
  if (insn.varnum !== undefined) return [insn.varnum, insn.incr];
  return insn.arg;
}

function normalizeSignatureValue(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeSignatureValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'pc' || key === 'cp_index') continue;
      out[key] = normalizeSignatureValue(entry);
    }
    return out;
  }
  return value;
}

function findForwardBranchBefore(codeItems, start, before, maxDistance) {
  const end = Math.min(before, start + maxDistance);
  for (let i = start; i < end; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, codeItems[i].instruction.arg);
    if (target > before) return i;
  }
  return -1;
}

function findArrayLoadStoreEndingAt(codeItems, end, expected) {
  for (let i = Math.max(0, end - 8); i + 4 <= end; i += 1) {
    const loadStore = readArrayLoadStoreAt(codeItems, i);
    if (loadStore && sameArrayLoadStore(loadStore, expected) && i + 4 === end) return i;
  }
  return -1;
}

function onlyStackPrepAndForwardBranch(codeItems, start, branchIndex) {
  for (let i = start; i <= branchIndex; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    if (isConditionalBranch(cur) && i === branchIndex) return true;
    if (intLoadLocal(codeItems[i].instruction) != null) continue;
    if (cur === 'iconst_m1' || cur === 'ixor') continue;
    return false;
  }
  return false;
}

function readArrayLoadStoreAt(codeItems, index) {
  if (index < 0 || index + 3 >= codeItems.length) return null;
  const arrayLocal = refLoadLocal(codeItems[index] && codeItems[index].instruction);
  if (arrayLocal == null) return null;
  const indexLocal = intLoadLocal(codeItems[index + 1] && codeItems[index + 1].instruction);
  if (indexLocal == null) return null;
  const loadOp = op(codeItems[index + 2] && codeItems[index + 2].instruction);
  if (!['aaload', 'iaload', 'baload', 'caload', 'saload'].includes(loadOp)) return null;
  const store = localStore(codeItems[index + 3] && codeItems[index + 3].instruction);
  if (!store) return null;
  if (loadOp === 'aaload' && store.kind !== 'a') return null;
  if (loadOp !== 'aaload' && store.kind !== 'i') return null;
  return { arrayLocal, indexLocal, loadOp, local: store.local, kind: store.kind };
}

function sameArrayLoadStore(a, b) {
  return a.arrayLocal === b.arrayLocal &&
    a.indexLocal === b.indexLocal &&
    a.loadOp === b.loadOp &&
    a.local === b.local &&
    a.kind === b.kind;
}

function collectLabelReferenceCounts(codeItems) {
  const counts = new Map();
  for (const item of codeItems) {
    for (const label of collectInstructionLabels(item && item.instruction)) {
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return counts;
}

function collectLabelReferencesDetailed(codeItems, label) {
  const out = [];
  for (let i = 0; i < codeItems.length; i += 1) {
    if (collectInstructionLabels(codeItems[i] && codeItems[i].instruction).includes(label)) out.push(i);
  }
  return out;
}

function collectInstructionLabels(insn, out = []) {
  if (!insn) return out;
  if (typeof insn === 'string') {
    if (/^L[A-Za-z0-9_$]+$/.test(insn)) out.push(insn);
    return out;
  }
  if (Array.isArray(insn)) {
    for (const part of insn) collectInstructionLabels(part, out);
    return out;
  }
  if (typeof insn === 'object') collectInstructionLabels(insn.arg, out);
  return out;
}

function readArrayLoadStoreJoin(codeItems, target) {
  const arrayLocal = refLoadLocal(codeItems[target] && codeItems[target].instruction);
  if (arrayLocal == null) return null;
  const indexLocal = intLoadLocal(codeItems[target + 1] && codeItems[target + 1].instruction);
  if (indexLocal == null) return null;
  const loadOp = op(codeItems[target + 2] && codeItems[target + 2].instruction);
  if (!['aaload', 'iaload', 'baload', 'caload', 'saload'].includes(loadOp)) return null;
  const store = localStore(codeItems[target + 3] && codeItems[target + 3].instruction);
  if (!store) return null;
  if (loadOp === 'aaload' && store.kind !== 'a') return null;
  if (loadOp !== 'aaload' && store.kind !== 'i') return null;
  if (!labelName(codeItems[target] && codeItems[target].labelDef)) return null;
  return { continueIndex: target + 4 };
}

function hasReferencedLabelsInside(codeItems, start, end, refCounts) {
  for (let i = start; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label && (refCounts.get(label) || 0) > 0) return true;
  }
  return false;
}

function hasFallthroughPredecessor(codeItems, target) {
  const prev = previousInstructionIndex(codeItems, target - 1);
  return prev >= 0 && !isUnconditionalTerminal(op(codeItems[prev] && codeItems[prev].instruction));
}

function hasImmediateFallthroughPredecessor(codeItems, target) {
  const prev = previousInstructionIndex(codeItems, target - 1);
  return prev === target - 1 && !isUnconditionalTerminal(op(codeItems[prev] && codeItems[prev].instruction));
}

function previousInstructionIndex(codeItems, start) {
  for (let i = start; i >= 0; i -= 1) {
    if (codeItems[i] && codeItems[i].instruction) return i;
  }
  return -1;
}

function isUnconditionalTerminal(cur) {
  return cur === 'goto' || isReturnOp(cur) || cur === 'athrow';
}

function findFirstConditionalBranch(codeItems, start, end) {
  for (let i = start; i < Math.min(codeItems.length, end); i += 1) {
    if (isConditionalBranch(op(codeItems[i] && codeItems[i].instruction))) return i;
  }
  return -1;
}

function firstBranchTargetIndex(codeItems, branchIndex) {
  const targetLabel = labelName((codeItems[branchIndex] && codeItems[branchIndex].instruction || {}).arg);
  return targetLabel ? findLabelIndex(codeItems, targetLabel) : null;
}

function findBackedgeToTarget(codeItems, start, end, target) {
  const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
  if (!targetLabel) return -1;
  for (let i = Math.max(start, target + 1); i < Math.min(codeItems.length, end); i += 1) {
    if (collectInstructionLabels(codeItems[i] && codeItems[i].instruction).includes(targetLabel)) return i;
  }
  return -1;
}

function countBranches(codeItems, start, end) {
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'goto' || isConditionalBranch(cur)) count += 1;
  }
  return count;
}

function renameInternalLabels(items, prefix) {
  const labels = new Set();
  for (const item of items) {
    const label = labelName(item && item.labelDef);
    if (label) labels.add(label);
  }
  if (labels.size === 0) return;
  const renamed = new Map([...labels].map((label, idx) => [label, `${prefix}${idx}`]));
  for (const item of items) {
    const label = labelName(item && item.labelDef);
    if (label && renamed.has(label)) item.labelDef = `${renamed.get(label)}:`;
    rewriteInstructionLabels(item && item.instruction, renamed);
  }
}

function rewriteInstructionLabels(insn, renamed) {
  if (!insn || typeof insn !== 'object') return;
  if (typeof insn.arg === 'string' && renamed.has(labelName(insn.arg))) {
    insn.arg = renamed.get(labelName(insn.arg));
    return;
  }
  if (Array.isArray(insn.arg)) {
    insn.arg = insn.arg.map((entry) => typeof entry === 'string' && renamed.has(labelName(entry)) ? renamed.get(labelName(entry)) : entry);
    return;
  }
  if (insn.arg && typeof insn.arg === 'object') {
    for (const [key, value] of Object.entries(insn.arg)) {
      if (typeof value === 'string' && renamed.has(labelName(value))) insn.arg[key] = renamed.get(labelName(value));
      else if (Array.isArray(value)) insn.arg[key] = value.map((entry) => typeof entry === 'string' && renamed.has(labelName(entry)) ? renamed.get(labelName(entry)) : entry);
    }
  }
}

function methodInitialLocals(method) {
  const locals = new Set();
  const access = Array.isArray(method && method.access) ? method.access : [];
  let slot = access.includes('static') ? 0 : 1;
  if (!access.includes('static')) locals.add(0);
  const descriptor = method && method.descriptor || '';
  const start = descriptor.indexOf('(');
  const end = descriptor.indexOf(')');
  if (start < 0 || end < start) return locals;
  const params = descriptor.slice(start + 1, end);
  for (let i = 0; i < params.length; i += 1) {
    let cur = params[i];
    while (cur === '[') cur = params[++i];
    if (cur === 'L') {
      while (i < params.length && params[i] !== ';') i += 1;
    }
    locals.add(slot);
    slot += cur === 'J' || cur === 'D' ? 2 : 1;
  }
  return locals;
}

function rewriteFirstLabel(items, label) {
  if (items.length === 0) return;
  if (label) items[0].labelDef = `${label}:`;
  else delete items[0].labelDef;
}

function ensureLabel(item, prefix) {
  const existing = labelName(item && item.labelDef);
  if (existing) return existing;
  const label = `${prefix}`;
  item.labelDef = `${label}:`;
  return label;
}

function invertConditionalBranch(cur) {
  const inverse = {
    ifeq: 'ifne',
    ifne: 'ifeq',
    iflt: 'ifge',
    ifge: 'iflt',
    ifgt: 'ifle',
    ifle: 'ifgt',
    ifnull: 'ifnonnull',
    ifnonnull: 'ifnull',
    if_icmpeq: 'if_icmpne',
    if_icmpne: 'if_icmpeq',
    if_icmplt: 'if_icmpge',
    if_icmpge: 'if_icmplt',
    if_icmpgt: 'if_icmple',
    if_icmple: 'if_icmpgt',
    if_acmpeq: 'if_acmpne',
    if_acmpne: 'if_acmpeq',
  };
  return inverse[cur] || cur;
}

function isConditionalBranch(cur) {
  return typeof cur === 'string' && cur.startsWith('if');
}

function isBranchOp(cur) {
  return typeof cur === 'string' && (cur === 'goto' || cur.startsWith('if'));
}

function isReturnOp(cur) {
  return cur === 'return' || cur === 'ireturn' || cur === 'lreturn' ||
    cur === 'freturn' || cur === 'dreturn' || cur === 'areturn';
}

function isStoreOrSideEffect(cur) {
  return typeof cur === 'string' && (
    cur.endsWith('store') ||
    cur === 'iastore' || cur === 'lastore' || cur === 'fastore' ||
    cur === 'dastore' || cur === 'aastore' || cur === 'bastore' ||
    cur === 'castore' || cur === 'sastore' ||
    cur === 'putfield' || cur === 'putstatic' || cur === 'iinc' ||
    cur.startsWith('invoke') || cur === 'athrow'
  );
}

function refLoadLocal(insn) {
  const cur = op(insn);
  if (cur === 'aload_0') return 0;
  if (cur === 'aload_1') return 1;
  if (cur === 'aload_2') return 2;
  if (cur === 'aload_3') return 3;
  if (cur === 'aload') return Number(insn.arg);
  return null;
}

function previousInstruction(codeItems, start) {
  for (let i = start; i >= 0; i -= 1) {
    if (codeItems[i] && codeItems[i].instruction) return codeItems[i];
  }
  return null;
}

function findLabelIndex(codeItems, label) {
  const target = labelName(label);
  if (!target) return -1;
  return codeItems.findIndex((item) => labelName(item && item.labelDef) === target);
}

function findNextGotoToLabel(codeItems, start, label) {
  const target = labelName(label);
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && labelName(insn.arg) === target) return i;
  }
  return -1;
}

function freshLabel(codeItems, prefix) {
  const used = new Set();
  for (const item of codeItems) {
    const label = labelName(item && item.labelDef);
    if (label) used.add(label);
  }
  let index = 0;
  let candidate = prefix;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}_${index}`;
  }
  return candidate;
}

function labelName(label) {
  return typeof label === 'string' && label.endsWith(':') ? label.slice(0, -1) : label;
}

function op(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function isZeroConstant(insn) {
  return op(insn) === 'iconst_0';
}

function isIntegerConstant(insn) {
  const cur = op(insn);
  return cur === 'iconst_m1'
    || /^iconst_[0-5]$/.test(cur || '')
    || cur === 'bipush'
    || cur === 'sipush'
    || cur === 'ldc';
}

function isSipush(insn, value) {
  return op(insn) === 'sipush' && Number(insn.arg) === value;
}

function isBipush(insn, value) {
  return op(insn) === 'bipush' && Number(insn.arg) === value;
}

function isInvokeInstruction(insn) {
  return !!op(insn) && String(op(insn)).startsWith('invoke');
}

function isInvoke(insn, owner, name, descriptor) {
  if (!isInvokeInstruction(insn)) return false;
  const arg = insn && insn.arg;
  return Array.isArray(arg)
    && arg[1] === owner
    && Array.isArray(arg[2])
    && arg[2][0] === name
    && arg[2][1] === descriptor;
}

function isBranchInstruction(insn) {
  const cur = op(insn);
  return cur === 'goto' || isConditionalBranch(insn);
}

function isConditionalBranch(insn) {
  const cur = op(insn);
  return typeof cur === 'string' && cur.startsWith('if');
}

function sameInstructionOperand(left, right) {
  if (op(left) !== op(right)) return false;
  return stableInstructionArg(left) === stableInstructionArg(right);
}

function stableInstructionArg(insn) {
  if (!insn || typeof insn !== 'object') return '';
  if (insn.arg === undefined) return '';
  return JSON.stringify(insn.arg);
}

function isGetStatic(insn, owner, name, descriptor) {
  if (op(insn) !== 'getstatic') return false;
  const arg = insn && insn.arg;
  return Array.isArray(arg)
    && arg[1] === owner
    && Array.isArray(arg[2])
    && arg[2][0] === name
    && arg[2][1] === descriptor;
}

function intLoadLocal(insn) {
  const cur = op(insn);
  if (cur === 'iload_0') return 0;
  if (cur === 'iload_1') return 1;
  if (cur === 'iload_2') return 2;
  if (cur === 'iload_3') return 3;
  if (cur === 'iload') return Number(insn.arg);
  return null;
}

function readLocalIndexes(insn) {
  const out = [];
  const intLocal = intLoadLocal(insn);
  if (intLocal != null) out.push(intLocal);
  const refLocal = refLoadLocal(insn);
  if (refLocal != null) out.push(refLocal);
  return out;
}

function writtenLocalIndexes(insn) {
  const out = [];
  const intLocal = intStoreLocal(insn);
  if (intLocal != null) out.push(intLocal);
  const store = localStore(insn);
  if (store && store.local != null && !out.includes(store.local)) out.push(store.local);
  const cur = op(insn);
  if (cur === 'iinc') {
    const iinc = readIincInstruction(insn);
    const local = iinc && iinc.local;
    if (Number.isFinite(local) && !out.includes(local)) out.push(local);
  }
  return out;
}

function readIincInstruction(insn) {
  if (op(insn) !== 'iinc') return null;
  let local;
  let incr;
  if (insn && insn.varnum !== undefined) {
    local = Number(insn.varnum);
    incr = Number(insn.incr);
  } else if (Array.isArray(insn && insn.arg)) {
    local = Number(insn.arg[0]);
    incr = Number(insn.arg[1]);
  } else {
    const parts = String(insn && insn.arg || '').split(/\s+/);
    local = Number(parts[0]);
    incr = Number(parts[1]);
  }
  if (!Number.isFinite(local) || !Number.isFinite(incr)) return null;
  return { local, incr };
}

function intStoreLocal(insn) {
  const cur = op(insn);
  if (cur === 'istore_0') return 0;
  if (cur === 'istore_1') return 1;
  if (cur === 'istore_2') return 2;
  if (cur === 'istore_3') return 3;
  if (cur === 'istore') return Number(insn.arg);
  return null;
}

function localStore(insn) {
  const intLocal = intStoreLocal(insn);
  if (intLocal != null) return { kind: 'i', local: intLocal };
  const cur = op(insn);
  if (cur === 'astore_0') return { kind: 'a', local: 0 };
  if (cur === 'astore_1') return { kind: 'a', local: 1 };
  if (cur === 'astore_2') return { kind: 'a', local: 2 };
  if (cur === 'astore_3') return { kind: 'a', local: 3 };
  if (cur === 'astore') return { kind: 'a', local: Number(insn.arg) };
  return null;
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

module.exports = { runStructuredGotoClone };
