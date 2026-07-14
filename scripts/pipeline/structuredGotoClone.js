'use strict';

let boundedConditionalTailCloneId = 0;
let sharedForwardContinuationCloneId = 0;
let sharedLoopIncrementCloneId = 0;
let shatteredPlansCloneId = 0;

function runStructuredGotoClone(astRoot) {
  let rewrites = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || !Array.isArray(cls.items)) continue;
    for (const item of cls.items) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
      if (!Array.isArray(codeItems) || codeItems.length < 20) continue;
      const rewritesBeforeMethod = rewrites;
      const codeItemsBeforeMethod = cloneItems(codeItems);
      if (process.env.STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES === '1') {
        rewrites += invertConditionalGotoBridges(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS === '1') {
        rewrites += cloneSharedForwardLoopIncrementTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS === '1') {
        rewrites += cloneSharedForwardConditionalContinuations(codeItems, codeAttr.code, item.method);
      }
      if (shouldRunHbbCachedLookupContinuationClone(cls, item.method)) {
        rewrites += cloneHbbCachedLookupContinuationTail(codeItems, codeAttr.code);
      }
      if (shouldRunShatteredPlansHiContinuationClone(cls, item.method)) {
        rewrites += cloneShatteredPlansHiContinuation(codeItems, codeAttr.code);
      }
      if (shouldRunShatteredPlansLePrefixContinuationClone(cls, item.method)) {
        rewrites += cloneShatteredPlansLePrefixContinuation(codeItems, codeAttr.code);
      }
      if (shouldRunShatteredPlansScSharedBooleanTailClone(cls, item.method)) {
        rewrites += cloneShatteredPlansScSharedBooleanLoopTail(codeItems, codeAttr.code);
      }
      if (shouldRunShatteredPlansUoIteratorAdvanceClone(cls, item.method)) {
        rewrites += cloneShatteredPlansUoIteratorAdvanceTail(codeItems, codeAttr.code);
      }
      if (shouldRunShatteredPlansUoMessageExitClone(cls, item.method)) {
        rewrites += cloneShatteredPlansUoMessageExitTail(codeItems, codeAttr.code);
      }
      if (shouldRunShatteredPlansDcNotCompareCleanup(cls, item.method)) {
        rewrites += simplifyShatteredPlansDcTwoSidedNotCompares(codeItems);
      }
      if (shouldRunOneSidedNotMinusOneCompareCleanup(cls, item.method)) {
        rewrites += simplifyOneSidedNotMinusOneCompares(codeItems);
      }
      if (shouldRunBachelorFridgeGtStackShiftStoreClone(cls, item.method)) {
        rewrites += cloneBachelorFridgeGtStackShiftStoreTails(codeItems, codeAttr.code);
      }
      if (shouldRunBachelorFridgeGjDuplicateInventoryLoopCleanup(cls, item.method)) {
        rewrites += removeBachelorFridgeGjDuplicateInventoryLoopGoto(codeItems);
      }
      if (shouldRunBachelorFridgeJoStackCompareTailClone(cls, item.method)) {
        rewrites += cloneBachelorFridgeJoStackCompareTails(codeItems, codeAttr.code);
      }
      if (shouldRunBachelorFridgeDeadFlagBranchCleanup(cls, item.method)) {
        rewrites += removeBachelorFridgeDeadFlagLocalBranches(codeItems);
      }
      if (shouldRunBrickAbracDeadFlagBranchCleanup(cls, item.method)) {
        rewrites += removeBrickAbracDeadFlagLocalBranches(codeItems);
      }
      if (shouldRunBachelorFridgeGjSecondHandLoopClone(cls, item.method)) {
        rewrites += cloneBachelorFridgeGjSecondHandLoop(codeItems, codeAttr.code);
      }
      if (shouldRunBachelorFridgeGjCardLoopClone(cls, item.method)) {
        rewrites += cloneBachelorFridgeGjCardLoopFallback(codeItems, codeAttr.code);
      }
      if (shouldRunBachelorFridgeGjSharedIconLoopClone(cls, item.method)) {
        rewrites += cloneBachelorFridgeGjSharedIconLoop(codeItems, codeAttr.code);
      }
      if (shouldRunBrickAbracSaEarlyFinalLoopExitClone(cls, item.method)) {
        rewrites += cloneBrickAbracSaEarlyFinalLoopExit(codeItems, codeAttr.code);
      }
      if (shouldRunArrayMembershipOuterContinueLocalization(cls, item.method, codeItems)) {
        rewrites += localizeArrayMembershipOuterContinueExits(codeItems, codeAttr.code);
      }
      if (shouldRunDuplicateArrayLoopHeaderAliasCanonicalize(cls, item.method, codeItems)) {
        rewrites += canonicalizeDuplicateArrayLoopHeaderAliases(codeItems, codeAttr.code);
      }
      if (shouldRunVoidHuntersSharedLoopIncrementTailClone(cls, item.method)) {
        rewrites += cloneSharedForwardLoopIncrementTails(codeItems, codeAttr.code);
      }
      if (shouldRunVoidHuntersRoaYBucketInitClone(cls, item.method)) {
        rewrites += cloneVoidHuntersRoaYBucketInitTail(codeItems, codeAttr.code);
      }
      if (shouldRunUcaSharedLoopIncrementTailClone(cls, item.method)) {
        rewrites += cloneUcaSharedLoopIncrementTail(codeItems, codeAttr.code);
      }
      if (shouldRunVoidHuntersUcaSharedReturnTailClone(cls, item.method)) {
        rewrites += cloneVoidHuntersUcaSharedReturnTail(codeItems, codeAttr.code);
      }
      if (shouldRunVoidHuntersUcaEntityLoopContinuationClone(cls, item.method)) {
        rewrites += cloneVoidHuntersUcaEntityLoopContinuation(codeItems, codeAttr.code);
      }
      if (shouldRunSharedRenderContinuationClone(cls, item.method, codeItems)) {
        rewrites += cloneSharedRenderContinuations(codeItems, codeAttr.code);
      }
      if (shouldRunNestedArrayScanOuterContinueClone(cls, item.method, codeItems)) {
        rewrites += cloneNestedArrayScanOuterContinueTails(codeItems, codeAttr.code);
      }
      if (shouldRunSharedTooltipRenderTailClone(cls, item.method, codeItems)) {
        rewrites += cloneSharedTooltipRenderTails(codeItems, codeAttr.code);
      }
      if (shouldRunVoidHuntersUcaMenuLoopContinuationClone(cls, item.method)) {
        rewrites += cloneVoidHuntersUcaMenuLoopContinuations(codeItems, codeAttr.code);
      }
      if (shouldRunThirtySixCardVjBlurLoopHeaderRetarget(cls, item.method)) {
        rewrites += retargetThirtySixCardVjDetachedBlurLoopHeader(codeItems);
      }
      if (shouldRunAceOfSkiesFgAgDrainLoopRetarget(cls, item.method)) {
        rewrites += retargetAceOfSkiesFgAgDrainLoopEntry(codeItems);
      }
      if (shouldRunAceOfSkiesFgStackFlagCompareMaterialize(cls, item.method)) {
        rewrites += materializeAceOfSkiesFgStackFlagCompares(codeItems, codeAttr.code);
      }
      if (shouldRunAceOfSkiesFgQueueBodyEntryClone(cls, item.method)) {
        rewrites += cloneAceOfSkiesFgQueueLoopBodyEntries(codeItems, codeAttr.code);
      }
      if (shouldRunAceOfSkiesFgQueueFlagTrueEntryClone(cls, item.method)) {
        rewrites += cloneAceOfSkiesFgQueueFlagTrueEntryTrampolines(codeItems, codeAttr.code);
      }
      if (shouldRunSteelSentinelsFcBackwardContinueClone(cls, item.method)) {
        rewrites += cloneSteelSentinelsFcBackwardContinueTails(codeItems, codeAttr.code);
      }
      if (shouldRunVertigo2BhPhaseContinuationClone(cls, item.method)) {
        rewrites += cloneVertigo2BhPhaseContinuationTail(codeItems, codeAttr.code);
      }
      if (shouldRunVertigo2GjMenuContinuationClone(cls, item.method)) {
        rewrites += cloneVertigo2GjMenuContinuationTail(codeItems, codeAttr.code);
      }
      if (item.method.name === '<init>' || item.method.name === '<clinit>') {
        if (restoreDroppedIntComplements(codeItems, codeItemsBeforeMethod)) {
          rewrites = rewritesBeforeMethod;
        }
        continue;
      }
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
      if (process.env.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS === '1') rewrites += cloneBoundedConditionalTerminalTails(codeItems, codeAttr.code);
      if (process.env.STRUCTURED_GOTO_ONESHOT_PREHEADER === '1') rewrites += rewriteOneShotPreheaderUpdateEntries(codeItems, codeAttr.code);
      if (restoreDroppedIntComplements(codeItems, codeItemsBeforeMethod)) {
        rewrites = rewritesBeforeMethod;
      }
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function countIntComplements(codeItems) {
  let count = 0;
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) === 'iconst_m1' &&
      op(codeItems[i + 1] && codeItems[i + 1].instruction) === 'ixor') count += 1;
  }
  return count;
}

function restoreDroppedIntComplements(codeItems, original) {
  const comparisons = intComplementComparisons(original);
  if (!comparisons.some((comparison) => hasIncorrectUncomplementedComparison(codeItems, comparison))) return false;
  codeItems.splice(0, codeItems.length, ...cloneItems(original));
  return true;
}

function intComplementComparisons(codeItems) {
  const out = [];
  for (let i = 0; i + 4 < codeItems.length; i += 1) {
    const local = intLoadLocal(codeItems[i] && codeItems[i].instruction);
    const constant = integerConstantValue(codeItems[i + 3] && codeItems[i + 3].instruction);
    const branchOp = op(codeItems[i + 4] && codeItems[i + 4].instruction);
    if (local == null || constant == null || !isIntCompareBranch(branchOp)) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'iconst_m1' ||
      op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'ixor') continue;
    out.push({ local, constant, branchOp });
  }
  return out;
}

function hasIncorrectUncomplementedComparison(codeItems, comparison) {
  for (let i = 0; i + 2 < codeItems.length; i += 1) {
    const local = intLoadLocal(codeItems[i] && codeItems[i].instruction);
    if (local !== comparison.local) continue;
    if (integerConstantValue(codeItems[i + 1] && codeItems[i + 1].instruction) === comparison.constant &&
      op(codeItems[i + 2] && codeItems[i + 2].instruction) === comparison.branchOp) return true;
  }
  return false;
}



function methodSignature(cls, method) {
  const owner = cls && cls.className || '*';
  return `${owner}.${method && method.name || ''}${method && method.descriptor || ''}`;
}

function targetList(envName, defaults = '') {
  return (Object.prototype.hasOwnProperty.call(process.env, envName) ? process.env[envName] : defaults)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function targetMatches(target, cls, method) {
  if (!target) return false;
  const signature = methodSignature(cls, method);
  if (target === signature) return true;
  const dot = target.indexOf('.');
  if (dot === 0 || target.startsWith('*.')) {
    const suffix = target.slice(dot + 1);
    return `${method && method.name || ''}${method && method.descriptor || ''}` === suffix;
  }
  return false;
}

function featureEnabled(...names) {
  for (const name of names) {
    if (process.env[name] === '0') return false;
  }
  return names.some((name) => process.env[name] === '1');
}

function targetGate(envName, cls, method) {
  const configured = Object.prototype.hasOwnProperty.call(process.env, envName);
  if (!configured) return true;
  const targets = targetList(envName, '');
  if (targets.length === 0) return true;
  return targets.some((target) => targetMatches(target, cls, method));
}

function shouldRunHbbCachedLookupContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_HBB_CACHED_LOOKUP_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_HBB_CACHED_LOOKUP_CONTINUATION_TARGETS', cls, method);
}

function shouldRunUcaSharedLoopIncrementTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_UCA_SHARED_LOOP_INCREMENT_TAIL') &&
    targetGate('STRUCTURED_GOTO_UCA_SHARED_LOOP_INCREMENT_TAIL_TARGETS', cls, method);
}

function shouldRunVoidHuntersUcaSharedReturnTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_VH_UCA_SHARED_RETURN_TAIL') &&
    targetGate('STRUCTURED_GOTO_VH_UCA_SHARED_RETURN_TAIL_TARGETS', cls, method);
}

function shouldRunVoidHuntersUcaEntityLoopContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_VH_UCA_ENTITY_LOOP_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_VH_UCA_ENTITY_LOOP_CONTINUATION_TARGETS', cls, method);
}

function shouldRunSharedRenderContinuationClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION_TARGETS', cls, method) &&
    hasSharedRenderContinuationCandidate(codeItems);
}

function shouldRunVoidHuntersUcaMenuLoopContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_VH_UCA_MENU_LOOP_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_VH_UCA_MENU_LOOP_CONTINUATION_TARGETS', cls, method);
}

function shouldRunNestedArrayScanOuterContinueClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_NESTED_ARRAY_SCAN_OUTER_CONTINUE') &&
    targetGate('STRUCTURED_GOTO_NESTED_ARRAY_SCAN_OUTER_CONTINUE_TARGETS', cls, method) &&
    hasNestedArrayScanOuterContinueCandidate(codeItems);
}

function shouldRunSharedTooltipRenderTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_TOOLTIP_RENDER_TAIL') &&
    targetGate('STRUCTURED_GOTO_SHARED_TOOLTIP_RENDER_TAIL_TARGETS', cls, method) &&
    hasSharedTooltipRenderTailCandidate(codeItems);
}

function shouldRunThirtySixCardVjBlurLoopHeaderRetarget(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER', 'STRUCTURED_GOTO_36CARD_VJ_BLUR_LOOP_HEADER') &&
    targetGate('STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_36CARD_VJ_BLUR_LOOP_HEADER_TARGETS', cls, method);
}

function shouldRunAceOfSkiesFgAgDrainLoopRetarget(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_EVENT_DRAIN_LOOP', 'STRUCTURED_GOTO_ACE_FG_AG_DRAIN_LOOP') &&
    targetGate('STRUCTURED_GOTO_EVENT_DRAIN_LOOP_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_ACE_FG_AG_DRAIN_LOOP_TARGETS', cls, method);
}

function shouldRunAceOfSkiesFgStackFlagCompareMaterialize(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STACK_FLAG_COMPARE_MATERIALIZE', 'STRUCTURED_GOTO_ACE_FG_STACK_FLAG_COMPARE') &&
    targetGate('STRUCTURED_GOTO_STACK_FLAG_COMPARE_MATERIALIZE_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_ACE_FG_STACK_FLAG_COMPARE_TARGETS', cls, method);
}

function shouldRunAceOfSkiesFgQueueBodyEntryClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_QUEUE_BODY_ENTRY_CLONE', 'STRUCTURED_GOTO_ACE_FG_QUEUE_BODY_ENTRY') &&
    targetGate('STRUCTURED_GOTO_QUEUE_BODY_ENTRY_CLONE_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_ACE_FG_QUEUE_BODY_ENTRY_TARGETS', cls, method);
}

function shouldRunAceOfSkiesFgQueueFlagTrueEntryClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_QUEUE_FLAG_TRUE_ENTRY', 'STRUCTURED_GOTO_ACE_FG_QUEUE_FLAG_TRUE_ENTRY') &&
    targetGate('STRUCTURED_GOTO_QUEUE_FLAG_TRUE_ENTRY_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_ACE_FG_QUEUE_FLAG_TRUE_ENTRY_TARGETS', cls, method);
}

function shouldRunSteelSentinelsFcBackwardContinueClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_BACKWARD_CONTINUE_TAILS', 'STRUCTURED_GOTO_STEEL_FC_BACKWARD_CONTINUE') &&
    targetGate('STRUCTURED_GOTO_BACKWARD_CONTINUE_TAILS_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_STEEL_FC_BACKWARD_CONTINUE_TARGETS', cls, method);
}

function shouldRunVertigo2BhPhaseContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_PHASE_CONTINUATION_TAIL', 'STRUCTURED_GOTO_VERTIGO2_BH_PHASE_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_PHASE_CONTINUATION_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_VERTIGO2_BH_PHASE_CONTINUATION_TARGETS', cls, method);
}

function shouldRunVertigo2GjMenuContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_MENU_CONTINUATION_TAIL', 'STRUCTURED_GOTO_VERTIGO2_GJ_MENU_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_MENU_CONTINUATION_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_VERTIGO2_GJ_MENU_CONTINUATION_TARGETS', cls, method);
}

function shouldRunVoidHuntersSharedLoopIncrementTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAILS', 'STRUCTURED_GOTO_VOIDHUNTERS_SHARED_LOOP_INCREMENT_TAILS') &&
    targetGate('STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_VOIDHUNTERS_SHARED_LOOP_INCREMENT_TAIL_TARGETS', cls, method);
}

function shouldRunVoidHuntersRoaYBucketInitClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL', 'STRUCTURED_GOTO_VH_ROA_Y_BUCKET_INIT') &&
    targetGate('STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_VH_ROA_Y_BUCKET_INIT_TARGETS', cls, method);
}

function shouldRunShatteredPlansHiContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION', 'STRUCTURED_GOTO_SHATTERED_PLANS_HI_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_SHATTERED_PLANS_HI_CONTINUATION_TARGETS', cls, method);
}

function shouldRunShatteredPlansLePrefixContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_PREFIX_CONTINUATION', 'STRUCTURED_GOTO_SHATTERED_PLANS_LE_PREFIX_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_PREFIX_CONTINUATION_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_SHATTERED_PLANS_LE_PREFIX_CONTINUATION_TARGETS', cls, method);
}

function shouldRunShatteredPlansScSharedBooleanTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL', 'STRUCTURED_GOTO_SHATTERED_PLANS_SC_SHARED_BOOLEAN_TAIL') &&
    targetGate('STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_SHATTERED_PLANS_SC_SHARED_BOOLEAN_TAIL_TARGETS', cls, method);
}

function shouldRunShatteredPlansUoIteratorAdvanceClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL', 'STRUCTURED_GOTO_SHATTERED_PLANS_UO_ITERATOR_ADVANCE') &&
    targetGate('STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_SHATTERED_PLANS_UO_ITERATOR_ADVANCE_TARGETS', cls, method);
}

function shouldRunShatteredPlansUoMessageExitClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_MESSAGE_EXIT_TAIL', 'STRUCTURED_GOTO_SHATTERED_PLANS_UO_MESSAGE_EXIT') &&
    targetGate('STRUCTURED_GOTO_MESSAGE_EXIT_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_SHATTERED_PLANS_UO_MESSAGE_EXIT_TARGETS', cls, method);
}

function shouldRunShatteredPlansDcNotCompareCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE', 'STRUCTURED_GOTO_SHATTERED_PLANS_DC_NOT_COMPARE') &&
    targetGate('STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_SHATTERED_PLANS_DC_NOT_COMPARE_TARGETS', cls, method);
}

function shouldRunOneSidedNotMinusOneCompareCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE') &&
    targetGate('STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE_TARGETS', cls, method);
}

function shouldRunBachelorFridgeGtStackShiftStoreClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STACK_SHIFT_STORE_TAIL', 'STRUCTURED_GOTO_BACHELOR_GT_STACK_SHIFT_STORE') &&
    targetGate('STRUCTURED_GOTO_STACK_SHIFT_STORE_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_GT_STACK_SHIFT_STORE_TARGETS', cls, method);
}

function shouldRunBachelorFridgeGjDuplicateInventoryLoopCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_DUPLICATE_CARD_LOOP_CLEANUP', 'STRUCTURED_GOTO_BACHELOR_GJ_DUPLICATE_INVENTORY_LOOP') &&
    targetGate('STRUCTURED_GOTO_DUPLICATE_CARD_LOOP_CLEANUP_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_GJ_DUPLICATE_INVENTORY_LOOP_TARGETS', cls, method);
}

function shouldRunBachelorFridgeJoStackCompareTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STACK_COMPARE_TAILS', 'STRUCTURED_GOTO_BACHELOR_JO_STACK_COMPARE_TAILS') &&
    targetGate('STRUCTURED_GOTO_STACK_COMPARE_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_JO_STACK_COMPARE_TAIL_TARGETS', cls, method);
}

function shouldRunBachelorFridgeDeadFlagBranchCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES', 'STRUCTURED_GOTO_BACHELOR_DEAD_FLAG_BRANCHES') &&
    targetGate('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCH_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_DEAD_FLAG_BRANCH_TARGETS', cls, method);
}

function shouldRunBrickAbracDeadFlagBranchCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES', 'STRUCTURED_GOTO_BRICK_DEAD_FLAG_BRANCHES') &&
    targetGate('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCH_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BRICK_DEAD_FLAG_BRANCH_TARGETS', cls, method);
}

function shouldRunBachelorFridgeGjSecondHandLoopClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_CARD_SECOND_HAND_LOOP', 'STRUCTURED_GOTO_BACHELOR_GJ_SECOND_HAND_LOOP') &&
    targetGate('STRUCTURED_GOTO_CARD_SECOND_HAND_LOOP_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_GJ_SECOND_HAND_LOOP_TARGETS', cls, method);
}

function shouldRunBachelorFridgeGjCardLoopClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_CARD_LOOP_FALLBACK', 'STRUCTURED_GOTO_BACHELOR_GJ_CARD_LOOP') &&
    targetGate('STRUCTURED_GOTO_CARD_LOOP_FALLBACK_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_GJ_CARD_LOOP_TARGETS', cls, method);
}

function shouldRunBachelorFridgeGjSharedIconLoopClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_ICON_LOOP', 'STRUCTURED_GOTO_BACHELOR_GJ_SHARED_ICON_LOOP') &&
    targetGate('STRUCTURED_GOTO_SHARED_ICON_LOOP_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BACHELOR_GJ_SHARED_ICON_LOOP_TARGETS', cls, method);
}

function shouldRunBrickAbracSaEarlyFinalLoopExitClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_EARLY_FINAL_LOOP_EXIT', 'STRUCTURED_GOTO_BRICK_SA_EARLY_FINAL_LOOP_EXIT') &&
    targetGate('STRUCTURED_GOTO_EARLY_FINAL_LOOP_EXIT_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_BRICK_SA_EARLY_FINAL_LOOP_EXIT_TARGETS', cls, method);
}

function shouldRunArrayMembershipOuterContinueLocalization(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE') &&
    targetGate('STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE_TARGETS', cls, method) &&
    hasArrayMembershipOuterContinueExitCandidate(codeItems);
}

function shouldRunDuplicateArrayLoopHeaderAliasCanonicalize(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS') &&
    targetGate('STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS_TARGETS', cls, method) &&
    hasDuplicateArrayLoopHeaderAliasCandidate(codeItems);
}

function shouldRunFalseReturnGuardCleanup(cls, method) {
  if (process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARDS === '0') return false;
  return targetGate('STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS', cls, method);
}

function shouldRunSmallIincJoin(cls, method) {
  if (process.env.STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN === '0') return false;
  return process.env.STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN === '1' ||
    targetGate('STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN_TARGETS', cls, method);
}

function shouldRunSharedContinueTailClone(cls, method) {
  if (process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAILS === '0') return false;
  return targetGate('STRUCTURED_GOTO_SHARED_CONTINUE_TAIL_TARGETS', cls, method);
}

function shouldRunJiByteWrapScanTailClone(cls, method) {
  if (process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS === '0') return false;
  return targetGate('STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_TARGETS', cls, method);
}

function shouldRunPbBlurTailRetarget(cls, method) {
  if (process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET === '0') return false;
  return targetGate('STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET_TARGETS', cls, method);
}

function shouldRunDuplicateDrainHeaderCanonicalize(cls, method) {
  if (process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER === '0') return false;
  return targetGate('STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER_TARGETS', cls, method);
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
    const transformedStart = Math.min(i, outerHeader.index);
    const transformedEnd = Math.max(updateShape.end + 1, outerHeader.end + 1);
    if (rangeTouchesExceptionTable(code, codeItems, transformedStart, transformedEnd)) {
      debugOneShotSkip(i, update, 'exception-region-overlap');
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

    const sourceMarker = cloneItemMetadata(codeItems[i]);
    sourceMarker.instruction = 'iconst_1';
    codeItems.splice(i, 1,
      sourceMarker,
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

function rangeTouchesExceptionTable(code, codeItems, start, end) {
  const entries = code && Array.isArray(code.exceptionTable) ? code.exceptionTable : [];
  if (entries.length === 0) return false;
  for (const entry of entries) {
    const handler = exceptionTableLabelIndex(codeItems, entry, ['handlerLbl', 'handlerLabel', 'handler', 'usingLbl', 'usingLabel', 'using']);
    const protectedStart = exceptionTableLabelIndex(codeItems, entry, ['startLbl', 'startLabel', 'start', 'fromLbl', 'fromLabel', 'from']);
    const protectedEnd = exceptionTableLabelIndex(codeItems, entry, ['endLbl', 'endLabel', 'end', 'toLbl', 'toLabel', 'to']);
    if (handler < 0 || protectedStart < 0 || protectedEnd < 0) return true;
    if (handler >= start && handler < end) return true;
    if (Math.max(start, protectedStart) < Math.min(end, protectedEnd)) return true;
  }
  return false;
}

function exceptionTableLabelIndex(codeItems, entry, keys) {
  if (!entry) return -1;
  for (const key of keys) {
    if (entry[key] == null) continue;
    const index = findLabelIndex(codeItems, entry[key]);
    if (index >= 0) return index;
  }
  return -1;
}

function cloneItemMetadata(item) {
  const out = {};
  if (!item) return out;
  if (item.labelDef !== undefined) out.labelDef = item.labelDef;
  if (item.stackMapFrame !== undefined) out.stackMapFrame = cloneValue(item.stackMapFrame);
  if (item.lineNumber !== undefined) out.lineNumber = item.lineNumber;
  return out;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
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
  const candidate = max + 1;
  const limit = code && Number(code.localsSize);
  if (Number.isFinite(limit) && limit <= candidate) code.localsSize = String(candidate + 1);
  return candidate;
}

function nextInstructionIndex(codeItems, start) {
  for (let i = start; i < codeItems.length; i += 1) {
    if (codeItems[i] && codeItems[i].instruction) return i;
  }
  return -1;
}



function cloneShatteredPlansHiContinuation(codeItems, code) {
  let rewrites = 0;
  for (let i = 8; i + 2 < codeItems.length && rewrites < 1; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'if_icmplt' && branchOp !== 'if_icmpge') continue;
    if (!hasFieldAccessNearby(codeItems, i - 18, i, 'ln', 'x', 'I')) continue;
    if (!hasFieldAccessNearby(codeItems, i - 18, i, 'ln', 'N', 'I')) continue;
    const gotoIndex = nextInstructionIndex(codeItems, i + 1);
    if (gotoIndex !== i + 1 || op(codeItems[gotoIndex] && codeItems[gotoIndex].instruction) !== 'goto') continue;
    const fallthrough = nextInstructionIndex(codeItems, gotoIndex + 1);
    if (fallthrough < 0 || findLabelIndex(codeItems, branch.arg) !== fallthrough) continue;
    const target = findLabelIndex(codeItems, codeItems[gotoIndex].instruction.arg);
    if (target <= gotoIndex) continue;
    if (intLoadLocal(codeItems[target] && codeItems[target].instruction) !== 2) continue;
    const end = findShatteredPlansHiIteratorLatchEnd(codeItems, target);
    if (end <= target) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, target, end, 'LCKSPHI');
  }
  return rewrites;
}

function findShatteredPlansHiIteratorLatchEnd(codeItems, start) {
  for (let i = start; i + 6 < Math.min(codeItems.length, start + 360); i += 1) {
    if (refLoadLocal(codeItems[i] && codeItems[i].instruction) !== 0) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'getfield') continue;
    if (!isBipush(codeItems[i + 2] && codeItems[i + 2].instruction, -71)) continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'invokevirtual') continue;
    if (op(codeItems[i + 4] && codeItems[i + 4].instruction) !== 'checkcast') continue;
    const store = localStore(codeItems[i + 5] && codeItems[i + 5].instruction);
    if (!store || store.kind !== 'a' || store.local !== 3) continue;
    if (op(codeItems[i + 6] && codeItems[i + 6].instruction) !== 'goto') continue;
    return i + 7;
  }
  return -1;
}

function cloneShatteredPlansLePrefixContinuation(codeItems, code) {
  let rewrites = 0;
  for (let i = 2; i + 2 < codeItems.length && rewrites < 1; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'iconst_0') continue;
    if (!isGetStatic(codeItems[i - 1] && codeItems[i - 1].instruction, 'em', 'em_h', 'I')) continue;
    const gotoIndex = nextInstructionIndex(codeItems, i + 1);
    if (gotoIndex !== i + 1 || op(codeItems[gotoIndex] && codeItems[gotoIndex].instruction) !== 'goto') continue;
    const fallthrough = nextInstructionIndex(codeItems, gotoIndex + 1);
    if (fallthrough < 0 || findLabelIndex(codeItems, branch.arg) !== fallthrough) continue;
    const target = findLabelIndex(codeItems, codeItems[gotoIndex].instruction.arg);
    if (target <= gotoIndex || op(codeItems[target] && codeItems[target].instruction) !== 'new') continue;
    const end = readForwardGotoBlockEnd(codeItems, target, 64);
    if (end <= target) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, target, end, 'LCKSPLE');
  }
  return rewrites;
}

function cloneShatteredPlansUoIteratorAdvanceTail(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 1; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    const tail = readShatteredPlansUoIteratorAdvanceTail(codeItems, target);
    if (!tail) continue;
    const prev = previousInstructionIndex(codeItems, i - 1);
    if (prev < 0 || op(codeItems[prev] && codeItems[prev].instruction) !== 'ifeq') continue;
    rewrites += cloneGotoRangeAt(codeItems, code, i, target, tail.end, 'LCKSPUOADV');
  }
  return rewrites;
}

function readShatteredPlansUoIteratorAdvanceTail(codeItems, start) {
  if (refLoadLocal(codeItems[start] && codeItems[start].instruction) !== 17) return null;
  if (!isBipush(codeItems[start + 1] && codeItems[start + 1].instruction, -71)) return null;
  if (!isInvoke(codeItems[start + 2] && codeItems[start + 2].instruction, 'pf', 'a', '(B)Loh;')) return null;
  if (op(codeItems[start + 3] && codeItems[start + 3].instruction) !== 'checkcast') return null;
  const store = localStore(codeItems[start + 4] && codeItems[start + 4].instruction);
  if (!store || store.kind !== 'a') return null;
  if (op(codeItems[start + 5] && codeItems[start + 5].instruction) !== 'goto') return null;
  const header = findLabelIndex(codeItems, codeItems[start + 5].instruction.arg);
  if (header < 0 || header >= start) return null;
  const headerLocal = refLoadLocal(codeItems[header] && codeItems[header].instruction);
  const nextHeader = nextInstructionIndex(codeItems, header + 1);
  const nextHeaderLocal = nextHeader >= 0 ? refLoadLocal(codeItems[nextHeader] && codeItems[nextHeader].instruction) : null;
  if (headerLocal !== store.local && nextHeaderLocal !== store.local) return null;
  return { end: start + 6 };
}

function cloneShatteredPlansUoMessageExitTail(codeItems, code) {
  const exitStart = findShatteredPlansUoCommonExitStart(codeItems);
  if (exitStart < 0) return 0;
  const tail = readShatteredPlansUoCommonNormalTail(codeItems, exitStart);
  if (!tail) return 0;
  const exitLabel = labelName(codeItems[exitStart] && codeItems[exitStart].labelDef);
  if (!exitLabel) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, exitStart, tail.end)) return 0;
  if (rangeHasBranchTargetOutside(codeItems, exitStart, tail.end)) return 0;
  const candidates = [];
  for (let i = 2; i < exitStart; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto' || labelName(jump.arg) !== exitLabel) continue;
    if (!isPutStaticDescriptor(codeItems[i - 1] && codeItems[i - 1].instruction, 'Ljava/lang/String;')) continue;
    const prev = codeItems[i - 2] && codeItems[i - 2].instruction;
    if (!isInvokeDescriptor(prev, '(Ljava/lang/String;I[Ljava/lang/String;)Ljava/lang/String;') &&
        !isGetStaticDescriptor(prev, 'Ljava/lang/String;')) continue;
    candidates.push(i);
  }
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_MESSAGE_EXIT_TAIL_MAX_REWRITES || 8);
  let rewrites = 0;
  for (let c = candidates.length - 1; c >= 0 && rewrites < maxRewrites; c -= 1) {
    rewrites += cloneGotoRangeAt(codeItems, code, candidates[c], exitStart, tail.end, 'LCKSPUOEXIT');
  }
  return rewrites;
}

function findShatteredPlansUoCommonExitStart(codeItems) {
  for (let i = 0; i + 5 < codeItems.length; i += 1) {
    if (!isGetStaticDescriptor(codeItems[i] && codeItems[i].instruction, 'J')) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'ldc2_w') continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'lxor') continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'ldc2_w') continue;
    if (op(codeItems[i + 4] && codeItems[i + 4].instruction) !== 'lcmp') continue;
    if (op(codeItems[i + 5] && codeItems[i + 5].instruction) !== 'ifeq') continue;
    return i;
  }
  return -1;
}

function readShatteredPlansUoCommonNormalTail(codeItems, start) {
  let sawNormalExit = false;
  for (let i = start; i < Math.min(codeItems.length, start + 520); i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'goto') sawNormalExit = true;
    const store = localStore(codeItems[i] && codeItems[i].instruction);
    if (sawNormalExit && store && store.kind === 'a' && op(codeItems[i + 1] && codeItems[i + 1].instruction) === 'aload') {
      const load = refLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction);
      if (load === store.local && op(codeItems[i + 2] && codeItems[i + 2].instruction) === 'new') return { end: i };
    }
    if (cur === 'return') return { end: i + 1 };
  }
  return null;
}

function cloneShatteredPlansScSharedBooleanLoopTail(codeItems, code) {
  let rewrites = 0;
  for (let sharedFalse = 0; sharedFalse + 4 < codeItems.length && rewrites < 1; sharedFalse += 1) {
    if (op(codeItems[sharedFalse] && codeItems[sharedFalse].instruction) !== 'iconst_0') continue;
    const falseLabel = labelName(codeItems[sharedFalse] && codeItems[sharedFalse].labelDef);
    if (!falseLabel) continue;
    if (op(codeItems[sharedFalse + 1] && codeItems[sharedFalse + 1].instruction) !== 'iand') continue;
    const mergeLabel = labelName(codeItems[sharedFalse + 1] && codeItems[sharedFalse + 1].labelDef);
    if (!mergeLabel) continue;
    if (!isPutFieldDescriptor(codeItems[sharedFalse + 2] && codeItems[sharedFalse + 2].instruction, 'Z')) continue;
    const iinc = readIincInstruction(codeItems[sharedFalse + 3] && codeItems[sharedFalse + 3].instruction);
    if (!iinc || iinc.incr !== 1) continue;
    if (op(codeItems[sharedFalse + 4] && codeItems[sharedFalse + 4].instruction) !== 'goto') continue;

    for (let branchIndex = 0; branchIndex < sharedFalse && rewrites < 1; branchIndex += 1) {
      const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
      if (op(branch) !== 'if_icmpne' || labelName(branch.arg) !== falseLabel) continue;
      const trueIndex = nextInstructionIndex(codeItems, branchIndex + 1);
      const gotoIndex = nextInstructionIndex(codeItems, trueIndex + 1);
      if (trueIndex < 0 || op(codeItems[trueIndex] && codeItems[trueIndex].instruction) !== 'iconst_1') continue;
      if (gotoIndex < 0 || op(codeItems[gotoIndex] && codeItems[gotoIndex].instruction) !== 'goto') continue;
      if (labelName(codeItems[gotoIndex].instruction.arg) !== mergeLabel) continue;
      if (nextInstructionIndex(codeItems, gotoIndex + 1) === sharedFalse) continue;
      const headerLabel = findPreviousLocalLoopHeaderLabel(codeItems, branchIndex, iinc.local);
      if (!headerLabel) continue;
      if (rangeTouchesExceptionTable(code, codeItems, sharedFalse, sharedFalse + 5)) continue;

      const cloneId = shatteredPlansCloneId;
      shatteredPlansCloneId += 1;
      const clone = cloneItems(codeItems.slice(sharedFalse, sharedFalse + 5));
      renameInternalLabels(clone, `LCKSPSC_${cloneId}_`);
      const cloneFalse = labelName(clone[0] && clone[0].labelDef) || freshLabel(codeItems, `LCKSPSC_${cloneId}_FALSE`);
      const cloneMerge = labelName(clone[1] && clone[1].labelDef) || freshLabel(codeItems, `LCKSPSC_${cloneId}_MERGE`);
      clone[0].labelDef = `${cloneFalse}:`;
      clone[1].labelDef = `${cloneMerge}:`;
      clone[4].instruction.arg = headerLabel;
      branch.arg = cloneFalse;
      codeItems[gotoIndex].instruction.arg = cloneMerge;
      codeItems.splice(gotoIndex + 1, 0, ...clone);
      rewrites += 1;
    }
  }
  return rewrites;
}


function simplifyOneSidedNotMinusOneCompares(codeItems) {
  const replacements = {
    if_icmpeq: 'ifeq',
    if_icmpne: 'ifne',
  };
  let rewrites = 0;
  for (let i = 3; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    const replacement = replacements[branchOp];
    if (!replacement) continue;
    if (op(codeItems[i - 3] && codeItems[i - 3].instruction) !== 'iconst_m1') continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'ixor') continue;
    if (op(codeItems[i - 1] && codeItems[i - 1].instruction) !== 'iconst_m1') continue;
    if (!plainUnreferencedItems(codeItems, i - 3, i - 1)) continue;
    branch.op = replacement;
    codeItems.splice(i - 3, 3);
    rewrites += 1;
    i = Math.max(2, i - 3);
  }
  return rewrites;
}

function simplifyShatteredPlansDcTwoSidedNotCompares(codeItems) {
  const ops = {
    if_icmpgt: 'if_icmplt',
    if_icmpge: 'if_icmple',
    if_icmplt: 'if_icmpgt',
    if_icmple: 'if_icmpge',
    if_icmpeq: 'if_icmpeq',
    if_icmpne: 'if_icmpne',
  };
  let rewrites = 0;
  for (let i = 4; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!ops[branchOp]) continue;
    if (op(codeItems[i - 1] && codeItems[i - 1].instruction) !== 'ixor') continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'iconst_m1') continue;
    if (!plainUnreferencedItems(codeItems, i - 2, i - 1)) continue;
    const leftPair = findPreviousNotPair(codeItems, i - 3, 18);
    if (leftPair < 0 || !plainUnreferencedItems(codeItems, leftPair, leftPair + 1)) continue;
    branch.op = ops[branchOp];
    codeItems.splice(i - 2, 2);
    codeItems.splice(leftPair, 2);
    rewrites += 1;
    i = Math.max(leftPair - 1, 0);
  }
  return rewrites;
}

function findPreviousNotPair(codeItems, before, maxDistance) {
  const min = Math.max(0, before - maxDistance);
  for (let i = before - 1; i >= min; i -= 1) {
    if (op(codeItems[i] && codeItems[i].instruction) === 'iconst_m1' && op(codeItems[i + 1] && codeItems[i + 1].instruction) === 'ixor') return i;
  }
  return -1;
}


function cloneConditionalRangeAfterBranchWithFallthroughGoto(codeItems, code, branchIndex, start, end, exitLabel, prefix) {
  const insn = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const cur = op(insn);
  if (!isConditionalBranch(cur)) return 0;
  if (start <= branchIndex || end <= start) return 0;
  const cleanExit = labelName(exitLabel);
  if (!cleanExit) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough < 0 || fallthrough >= start) return 0;
  const cloneId = shatteredPlansCloneId;
  shatteredPlansCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  clone.push({ instruction: { op: 'goto', arg: cleanExit } });
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function cloneGotoRangeAtWithFallthroughGoto(codeItems, code, gotoIndex, start, end, exitLabel, prefix) {
  if (start < 0 || end <= start || gotoIndex < 0 || gotoIndex >= codeItems.length) return 0;
  const cleanExit = labelName(exitLabel);
  if (!cleanExit) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const cloneId = shatteredPlansCloneId;
  shatteredPlansCloneId += 1;
  const replacement = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(replacement, `${prefix}_${cloneId}_`);
  replacement.push({ instruction: { op: 'goto', arg: cleanExit } });
  const sourceMeta = cloneItemMetadata(codeItems[gotoIndex]);
  delete sourceMeta.instruction;
  if (Object.keys(sourceMeta).length > 0) {
    if (replacement.length > 0 && !replacement[0].labelDef && sourceMeta.labelDef) {
      replacement[0].labelDef = sourceMeta.labelDef;
      delete sourceMeta.labelDef;
    }
    if (Object.keys(sourceMeta).length > 0) replacement.unshift(sourceMeta);
  }
  codeItems.splice(gotoIndex, 1, ...replacement);
  return 1;
}

function cloneGotoRangeAt(codeItems, code, gotoIndex, start, end, prefix) {
  if (start < 0 || end <= start || gotoIndex < 0 || gotoIndex >= codeItems.length) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const cloneId = shatteredPlansCloneId;
  shatteredPlansCloneId += 1;
  const replacement = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(replacement, `${prefix}_${cloneId}_`);
  const sourceMeta = cloneItemMetadata(codeItems[gotoIndex]);
  delete sourceMeta.instruction;
  if (Object.keys(sourceMeta).length > 0) {
    if (replacement.length > 0 && !replacement[0].labelDef && sourceMeta.labelDef) {
      replacement[0].labelDef = sourceMeta.labelDef;
      delete sourceMeta.labelDef;
    }
    if (Object.keys(sourceMeta).length > 0) replacement.unshift(sourceMeta);
  }
  codeItems.splice(gotoIndex, 1, ...replacement);
  return 1;
}

function readForwardGotoBlockEnd(codeItems, start, maxInsns) {
  let instructions = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    if (!codeItems[i] || !codeItems[i].instruction) continue;
    instructions += 1;
    if (instructions > maxInsns) return -1;
    if (op(codeItems[i].instruction) === 'goto') return i + 1;
  }
  return -1;
}

function findPreviousLocalLoopHeaderLabel(codeItems, before, local) {
  for (let i = before - 1; i >= 0; i -= 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label || intLoadLocal(codeItems[i] && codeItems[i].instruction) !== local) continue;
    for (let j = i + 1; j < Math.min(before, i + 8); j += 1) {
      if (isConditionalBranch(op(codeItems[j] && codeItems[j].instruction))) return label;
    }
  }
  return null;
}

function plainUnreferencedItems(codeItems, start, end) {
  const refs = collectLabelReferenceCounts(codeItems);
  for (let i = start; i <= end; i += 1) {
    const item = codeItems[i];
    if (!item) return false;
    const label = labelName(item.labelDef);
    if (label && (refs.get(label) || 0) > 0) return false;
    if (item.stackMapFrame || item.lineNumber) return false;
  }
  return true;
}

function hasFieldAccessNearby(codeItems, start, end, owner, name, descriptor) {
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if ((op(insn) === 'getfield' || op(insn) === 'getstatic') && fieldMatches(insn, owner, name, descriptor)) return true;
  }
  return false;
}

function fieldMatches(insn, owner, name, descriptor) {
  const itemArg = insn && typeof insn === 'object' ? insn.arg : null;
  return Array.isArray(itemArg)
    && itemArg[0] === 'Field'
    && itemArg[1] === owner
    && Array.isArray(itemArg[2])
    && itemArg[2][0] === name
    && itemArg[2][1] === descriptor;
}


function fieldRef(insn) {
  const itemArg = insn && typeof insn === 'object' ? insn.arg : null;
  if (!Array.isArray(itemArg) || itemArg[0] !== 'Field' || !Array.isArray(itemArg[2])) return null;
  return { owner: itemArg[1], name: itemArg[2][0], descriptor: itemArg[2][1] };
}

function fieldDescriptor(insn) {
  const ref = fieldRef(insn);
  return ref && ref.descriptor;
}

function isFieldWithDescriptor(insn, opcode, descriptor) {
  return op(insn) === opcode && fieldDescriptor(insn) === descriptor;
}

function isGetStaticDescriptor(insn, descriptor) {
  return isFieldWithDescriptor(insn, 'getstatic', descriptor);
}

function isPutStaticDescriptor(insn, descriptor) {
  return isFieldWithDescriptor(insn, 'putstatic', descriptor);
}

function isGetFieldDescriptor(insn, descriptor) {
  return isFieldWithDescriptor(insn, 'getfield', descriptor);
}

function isPutFieldDescriptor(insn, descriptor) {
  return isFieldWithDescriptor(insn, 'putfield', descriptor);
}

function isGetFieldReferenceDescriptor(insn) {
  const desc = fieldDescriptor(insn);
  return op(insn) === 'getfield' && typeof desc === 'string' && (desc.startsWith('L') || desc.startsWith('['));
}

function isGetFieldObjectArrayDescriptor(insn) {
  const desc = fieldDescriptor(insn);
  return op(insn) === 'getfield' && typeof desc === 'string' && desc.startsWith('[L');
}

function methodRef(insn) {
  const itemArg = insn && typeof insn === 'object' ? insn.arg : null;
  if (!Array.isArray(itemArg) || (itemArg[0] !== 'Method' && itemArg[0] !== 'InterfaceMethod') || !Array.isArray(itemArg[2])) return null;
  return { owner: itemArg[1], name: itemArg[2][0], descriptor: itemArg[2][1] };
}

function methodDescriptor(insn) {
  const ref = methodRef(insn);
  return ref && ref.descriptor;
}

function isInvokeDescriptor(insn, descriptor) {
  return isInvokeInstruction(insn) && methodDescriptor(insn) === descriptor;
}

function hasStaticBooleanLoad(codeItems) {
  return codeItems.some((item) => isGetStaticDescriptor(item && item.instruction, 'Z'));
}

function isPutStatic(insn, owner, name, descriptor) {
  return op(insn) === 'putstatic' && fieldMatches(insn, owner, name, descriptor);
}

function isPutField(insn, owner, name, descriptor) {
  return op(insn) === 'putfield' && fieldMatches(insn, owner, name, descriptor);
}

function cloneHbbCachedLookupContinuationTail(codeItems, code) {
  let rewrites = 0;
  for (let i = 1; i < codeItems.length && rewrites < 1; i += 1) {
    const load = codeItems[i - 1] && codeItems[i - 1].instruction;
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifnonnull') continue;
    const local = refLoadLocal(load);
    if (local == null) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;
    const targetInsn = nextInstructionIndex(codeItems, target);
    if (targetInsn < 0 || refLoadLocal(codeItems[targetInsn] && codeItems[targetInsn].instruction) !== local) continue;
    if (!storesReferenceLocalBeforeTarget(codeItems, fallthrough, target, local)) continue;
    const tail = readForwardContinuationCloneTail(codeItems, target, 64);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    const cloneId = sharedForwardContinuationCloneId;
    sharedForwardContinuationCloneId += 1;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKHBBF_${cloneId}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKHBB_${cloneId}_`);
    branch.op = 'ifnull';
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function storesReferenceLocalBeforeTarget(codeItems, start, end, local) {
  for (let i = start; i < end; i += 1) {
    const store = localStore(codeItems[i] && codeItems[i].instruction);
    if (store && store.kind === 'a' && store.local === local) return true;
  }
  return false;
}


function preserveReplacementEntryLabel(sourceItem, replacement) {
  if (!sourceItem || !sourceItem.labelDef || !Array.isArray(replacement) || replacement.length === 0) return replacement;
  if (!replacement[0].labelDef) {
    replacement[0].labelDef = sourceItem.labelDef;
    if (sourceItem.stackMapFrame !== undefined && replacement[0].stackMapFrame === undefined) {
      replacement[0].stackMapFrame = cloneValue(sourceItem.stackMapFrame);
    }
    if (sourceItem.lineNumber !== undefined && replacement[0].lineNumber === undefined) {
      replacement[0].lineNumber = sourceItem.lineNumber;
    }
    return replacement;
  }
  replacement.unshift(cloneItemMetadata(sourceItem));
  return replacement;
}

function cloneUcaSharedLoopIncrementTail(codeItems, code) {
  let rewrites = 0;
  for (let start = 0; start < codeItems.length; start += 1) {
    const first = nextInstructionIndex(codeItems, start);
    if (first !== start) continue;
    const iinc = readIincInstruction(codeItems[first] && codeItems[first].instruction);
    if (!iinc || iinc.local !== 11 || iinc.incr !== 1) continue;
    const jumpIndex = nextInstructionIndex(codeItems, first + 1);
    if (jumpIndex !== first + 1 || op(codeItems[jumpIndex] && codeItems[jumpIndex].instruction) !== 'goto') continue;
    const header = findLabelIndex(codeItems, codeItems[jumpIndex].instruction.arg);
    if (header < 0 || header >= first) continue;
    if (intLoadLocal(codeItems[nextInstructionIndex(codeItems, header)] && codeItems[nextInstructionIndex(codeItems, header)].instruction) !== 11) continue;
    if (rangeTouchesExceptionTable(code, codeItems, start, jumpIndex + 1)) continue;
    const targetLabel = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!targetLabel) continue;
    const refs = collectLabelReferencesByLabel(codeItems).get(targetLabel) || [];
    const selected = refs
      .filter((idx) => idx >= header && idx < start && isBranchOp(op(codeItems[idx] && codeItems[idx].instruction)))
      .sort((a, b) => b - a);
    if (selected.length === 0) continue;
    const sourceTail = cloneItems(codeItems.slice(start, jumpIndex + 1));
    const candidates = [];
    for (const refIndex of selected) {
      const insn = codeItems[refIndex] && codeItems[refIndex].instruction;
      const cur = op(insn);
      const cloneId = sharedLoopIncrementCloneId;
      sharedLoopIncrementCloneId += 1;
      if (cur === 'goto') {
        candidates.push({ refIndex, cur, cloneId });
        continue;
      }
      if (!isConditionalBranch(cur)) continue;
      const fallthrough = nextInstructionIndex(codeItems, refIndex + 1);
      if (fallthrough < 0 || fallthrough >= start) continue;
      const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKUCAF_${cloneId}`);
      candidates.push({ refIndex, cur, cloneId, fallthroughLabel });
    }
    for (const candidate of candidates) {
      const insn = codeItems[candidate.refIndex] && codeItems[candidate.refIndex].instruction;
      if (!insn) continue;
      const clone = cloneItems(sourceTail);
      renameInternalLabels(clone, `LCKUCA_${candidate.cloneId}_`);
      if (candidate.cur === 'goto') {
        preserveReplacementEntryLabel(codeItems[candidate.refIndex], clone);
        codeItems.splice(candidate.refIndex, 1, ...clone);
        rewrites += 1;
        continue;
      }
      insn.op = invertConditionalBranch(candidate.cur);
      insn.arg = candidate.fallthroughLabel;
      codeItems.splice(candidate.refIndex + 1, 0, ...clone);
      rewrites += 1;
    }
    break;
  }
  return rewrites;
}





function cloneVoidHuntersRoaYBucketInitTail(codeItems, code) {
  for (let i = 4; i + 1 < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    if (!looksLikeVoidHuntersRoaBucketArrayInit(codeItems, target)) continue;
    if (op(codeItems[i - 1] && codeItems[i - 1].instruction) !== 'if_icmpgt') continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'goto') continue;
    if (op(codeItems[i - 3] && codeItems[i - 3].instruction) !== 'if_icmpgt') continue;
    if (op(codeItems[i - 4] && codeItems[i - 4].instruction) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 5] && codeItems[i - 5].instruction) !== 63) continue;
    const fallthroughExit = findVoidHuntersRoaBucketInitFallthrough(codeItems, target);
    if (fallthroughExit <= target) return 0;
    const exitLabel = labelName(codeItems[fallthroughExit] && codeItems[fallthroughExit].labelDef);
    if (!exitLabel) return 0;
    return cloneGotoRangeAtWithFallthroughGoto(codeItems, code, i, target, fallthroughExit, exitLabel, 'LCKVHROABKT');
  }
  return 0;
}

function looksLikeVoidHuntersRoaBucketArrayInit(codeItems, start) {
  if (refLoadLocal(codeItems[start] && codeItems[start].instruction) !== 0) return false;
  if (!isGetFieldDescriptor(codeItems[start + 1] && codeItems[start + 1].instruction, '[[I')) return false;
  if (intLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction) !== 18) return false;
  if (refLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction) !== 92) return false;
  if (intLoadLocal(codeItems[start + 4] && codeItems[start + 4].instruction) !== 18) return false;
  if (op(codeItems[start + 5] && codeItems[start + 5].instruction) !== 'iaload') return false;
  if (op(codeItems[start + 6] && codeItems[start + 6].instruction) !== 'newarray') return false;
  if (op(codeItems[start + 7] && codeItems[start + 7].instruction) !== 'aastore') return false;
  return true;
}

function findVoidHuntersRoaBucketInitFallthrough(codeItems, start) {
  for (let i = start; i + 2 < Math.min(codeItems.length, start + 80); i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'ifeq') continue;
    const target = findLabelIndex(codeItems, codeItems[i].instruction.arg);
    if (target < 0 || target >= i) continue;
    const next = nextInstructionIndex(codeItems, i + 1);
    if (next > i) return next;
  }
  return -1;
}

function cloneVoidHuntersUcaSharedReturnTail(codeItems, code) {
  const tailStart = findVoidHuntersUcaSharedReturnTailStart(codeItems);
  if (tailStart < 0) return 0;
  const tailEnd = findReturnTailEnd(codeItems, tailStart, 40);
  if (tailEnd <= tailStart) return 0;
  const tailLabel = labelName(codeItems[tailStart] && codeItems[tailStart].labelDef);
  if (!tailLabel || rangeTouchesExceptionTable(code, codeItems, tailStart, tailEnd)) return 0;
  let rewrites = 0;
  const refs = (collectLabelReferencesByLabel(codeItems).get(tailLabel) || [])
    .filter((idx) => idx < tailStart && idx !== tailStart)
    .sort((a, b) => b - a);
  for (const refIndex of refs) {
    const insn = codeItems[refIndex] && codeItems[refIndex].instruction;
    const cur = op(insn);
    if (cur === 'goto') {
      rewrites += cloneGotoRangeAt(codeItems, code, refIndex, tailStart, tailEnd, 'LCKVHUCARETT');
      continue;
    }
    if (!isConditionalBranch(cur)) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, refIndex, tailStart, tailEnd, 'LCKVHUCARETT');
  }
  return rewrites;
}

function findVoidHuntersUcaSharedReturnTailStart(codeItems) {
  for (let i = 0; i + 8 < codeItems.length; i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 3) continue;
    if (!isBipush(codeItems[i + 1] && codeItems[i + 1].instruction, -11)) continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'if_icmpeq') continue;
    if (refLoadLocal(codeItems[i + 3] && codeItems[i + 3].instruction) !== 0) continue;
    if (op(codeItems[i + 4] && codeItems[i + 4].instruction) !== 'aconst_null') continue;
    if (op(codeItems[i + 5] && codeItems[i + 5].instruction) !== 'checkcast') continue;
    return i;
  }
  return -1;
}

function findReturnTailEnd(codeItems, start, maxInsns) {
  let real = 0;
  for (let i = start; i < Math.min(codeItems.length, start + maxInsns); i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    real += 1;
    if (isReturnOp(cur)) return i + 1;
  }
  return -1;
}

function cloneVoidHuntersUcaEntityLoopContinuation(codeItems, code) {
  let rewrites = 0;
  for (let i = 3; i + 1 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 19) continue;
    if (refLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction) !== 27) continue;
    if (op(codeItems[i - 3] && codeItems[i - 3].instruction) !== 'aconst_null') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i || op(codeItems[target] && codeItems[target].instruction) !== 'if_acmpeq') continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || op(codeItems[fallthrough] && codeItems[fallthrough].instruction) !== 'if_acmpeq') continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, i, target, target + 1, 'LCKVHUCAENT');
    break;
  }
  return rewrites;
}



function hasDuplicateArrayLoopHeaderAliasCandidate(codeItems) {
  return findDuplicateArrayLoopHeaderAliasCandidate(codeItems) != null;
}

function canonicalizeDuplicateArrayLoopHeaderAliases(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS_MAX_REWRITES || 4);
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < maxRewrites; searchStart += 1) {
    const candidate = findDuplicateArrayLoopHeaderAliasCandidate(codeItems, searchStart);
    if (!candidate) break;
    if (rangeTouchesExceptionTable(code, codeItems, candidate.header, candidate.header + candidate.headerLength)) {
      searchStart = candidate.header + 1;
      continue;
    }
    const sharedHeaderLabel = labelName(codeItems[candidate.sharedHeader] && codeItems[candidate.sharedHeader].labelDef);
    if (!sharedHeaderLabel) {
      searchStart = candidate.header + 1;
      continue;
    }

    codeItems[candidate.header].instruction = { op: 'goto', arg: sharedHeaderLabel };
    codeItems.splice(candidate.storeIndex + 1, 0,
      { instruction: refLoadInstruction(candidate.sourceArrayLocal) },
      { instruction: refStoreInstruction(candidate.sharedArrayLocal) },
    );
    rewrites += 1;
    searchStart = candidate.header + 2;
  }
  return rewrites;
}

function findDuplicateArrayLoopHeaderAliasCandidate(codeItems, searchStart = 0) {
  for (let header = Math.max(0, searchStart); header + 24 < codeItems.length; header += 1) {
    const first = readArrayBitsetLoopHeaderShape(codeItems, header);
    if (!first || first.hasElementAlias) continue;
    const sharedHeader = findLabelIndex(codeItems, first.continueTargetLabel);
    if (sharedHeader <= header || sharedHeader - header > 520) continue;
    const second = readArrayBitsetLoopHeaderShape(codeItems, sharedHeader);
    if (!second || !second.hasElementAlias) continue;
    if (second.indexLocal !== first.indexLocal) continue;
    if (labelName(second.exitLabel) !== labelName(first.exitLabel)) continue;
    if (labelName(second.continueTargetLabel) !== labelName(codeItems[sharedHeader] && codeItems[sharedHeader].labelDef)) continue;
    if (first.arrayLocal === second.arrayLocal) continue;

    const storeIndex = findPreviousRefStoreForLocal(codeItems, header, first.arrayLocal, 24);
    if (storeIndex < 0) continue;
    if (rangeHasLocalWrite(codeItems, storeIndex + 1, header, first.arrayLocal)) continue;
    if (rangeHasLocalReadBeforeWrite(codeItems, storeIndex + 1, header, second.arrayLocal)) continue;
    // Keep this canonicalization on the two-entry array-scan shape: after the shared
    // header the method should compute a bounded four-slot weighted choice.  This
    // avoids replacing unrelated duplicate loop headers that just happen to share an
    // induction variable.
    if (!hasBoundedWeightedChoiceAfterHeader(codeItems, second.bodyTarget, second.indexLocal, 560)) continue;
    return {
      header,
      headerLength: first.end - first.start,
      sharedHeader,
      storeIndex,
      sourceArrayLocal: first.arrayLocal,
      sharedArrayLocal: second.arrayLocal,
    };
  }
  return null;
}

function readArrayBitsetLoopHeaderShape(codeItems, start) {
  const arrayLocal = refLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (arrayLocal == null) return null;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'arraylength') return null;
  const indexLocal = intLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction);
  if (indexLocal == null) return null;
  const exitBranch = codeItems[start + 3] && codeItems[start + 3].instruction;
  if (!isConditionalBranch(op(exitBranch))) return null;
  const exitLabel = labelName(exitBranch.arg);
  if (!exitLabel) return null;
  if (refLoadLocal(codeItems[start + 4] && codeItems[start + 4].instruction) !== arrayLocal) return null;
  if (intLoadLocal(codeItems[start + 5] && codeItems[start + 5].instruction) !== indexLocal) return null;
  if (op(codeItems[start + 6] && codeItems[start + 6].instruction) !== 'aaload') return null;
  const elementLocal = refStoreLocal(codeItems[start + 7] && codeItems[start + 7].instruction);
  if (elementLocal == null) return null;

  let p = start + 8;
  let aliasLocal = null;
  let hasElementAlias = false;
  if (refLoadLocal(codeItems[p] && codeItems[p].instruction) === elementLocal) {
    aliasLocal = refStoreLocal(codeItems[p + 1] && codeItems[p + 1].instruction);
    if (aliasLocal != null) {
      hasElementAlias = true;
      p += 2;
    }
  }

  if (op(codeItems[p] && codeItems[p].instruction) !== 'iconst_1') return null;
  const valueLocal = refLoadLocal(codeItems[p + 1] && codeItems[p + 1].instruction);
  if (valueLocal !== elementLocal && valueLocal !== aliasLocal) return null;
  if (op(codeItems[p + 2] && codeItems[p + 2].instruction) !== 'checkcast') return null;
  if (!isGetFieldDescriptor(codeItems[p + 3] && codeItems[p + 3].instruction, 'I')) return null;
  if (op(codeItems[p + 4] && codeItems[p + 4].instruction) !== 'ishl') return null;
  if (refLoadLocal(codeItems[p + 5] && codeItems[p + 5].instruction) == null) return null;
  if (!isGetFieldDescriptor(codeItems[p + 6] && codeItems[p + 6].instruction, 'I')) return null;
  if (op(codeItems[p + 7] && codeItems[p + 7].instruction) !== 'iand') return null;

  let branchIndex = -1;
  const simpleZeroBranch = codeItems[p + 8] && codeItems[p + 8].instruction;
  if (op(simpleZeroBranch) === 'ifeq') {
    branchIndex = p + 8;
  } else {
    if (op(codeItems[p + 8] && codeItems[p + 8].instruction) !== 'iconst_m1') return null;
    if (op(codeItems[p + 9] && codeItems[p + 9].instruction) !== 'ixor') return null;
    if (op(codeItems[p + 10] && codeItems[p + 10].instruction) !== 'iconst_m1') return null;
    const notCompareBranch = codeItems[p + 11] && codeItems[p + 11].instruction;
    if (op(notCompareBranch) !== 'if_icmpeq') return null;
    branchIndex = p + 11;
  }

  const bodyBranch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const bodyTarget = findLabelIndex(codeItems, bodyBranch.arg);
  if (bodyTarget <= start) return null;
  const incIndex = branchIndex + 1;
  const inc = readIincInstruction(codeItems[incIndex] && codeItems[incIndex].instruction);
  if (!inc || inc.local !== indexLocal || inc.incr !== 1) return null;
  const jump = codeItems[incIndex + 1] && codeItems[incIndex + 1].instruction;
  if (op(jump) !== 'goto') return null;
  const continueTargetLabel = labelName(jump.arg);
  if (!continueTargetLabel) return null;
  return {
    start,
    end: incIndex + 2,
    arrayLocal,
    indexLocal,
    elementLocal,
    valueLocal,
    hasElementAlias,
    exitLabel,
    bodyTarget,
    continueTargetLabel,
  };
}

function findPreviousRefStoreForLocal(codeItems, before, local, maxDistance) {
  const min = Math.max(0, before - maxDistance);
  for (let i = before - 1; i >= min; i -= 1) {
    if (refStoreLocal(codeItems[i] && codeItems[i].instruction) === local) return i;
  }
  return -1;
}

function rangeHasLocalWrite(codeItems, start, end, local) {
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    if (writtenLocalIndexes(codeItems[i] && codeItems[i].instruction).includes(local)) return true;
  }
  return false;
}

function rangeHasLocalReadBeforeWrite(codeItems, start, end, local) {
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (readLocalIndexes(insn).includes(local)) return true;
    if (writtenLocalIndexes(insn).includes(local)) return false;
  }
  return false;
}

function hasBoundedWeightedChoiceAfterHeader(codeItems, start, indexLocal, maxDistance) {
  const end = Math.min(codeItems.length, Math.max(0, start) + maxDistance);
  let sawRandomSeed = false;
  let sawRandomChoice = false;
  let sawFourBound = false;
  let sawOuterBackedge = false;
  for (let i = Math.max(0, start); i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isInvokeDescriptor(insn, '(J)V')) sawRandomSeed = true;
    if (isInvokeDescriptor(insn, '(BILjava/util/Random;)I')) sawRandomChoice = true;
    if ((op(insn) === 'iconst_4' || isBipush(insn, 4)) && intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction) != null) {
      const branchOp = op(codeItems[i + 2] && codeItems[i + 2].instruction);
      if (isConditionalBranch(branchOp)) sawFourBound = true;
    }
    const inc = readIincInstruction(insn);
    if (inc && inc.local === indexLocal && inc.incr === 1 && op(codeItems[i + 1] && codeItems[i + 1].instruction) === 'goto') {
      sawOuterBackedge = true;
    }
  }
  return sawRandomSeed && sawRandomChoice && sawFourBound && sawOuterBackedge;
}

function hasNestedArrayScanOuterContinueCandidate(codeItems) {
  return findNestedArrayScanOuterContinueTail(codeItems) != null;
}

function cloneNestedArrayScanOuterContinueTails(codeItems, code) {
  let rewrites = 0;
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < 12; searchStart += 1) {
    const tail = findNestedArrayScanOuterContinueTail(codeItems, searchStart);
    if (!tail) break;
    if (rangeTouchesExceptionTable(code, codeItems, tail.start, tail.end)) {
      searchStart = tail.start + 1;
      continue;
    }
    const refs = findConditionalRefsToLabel(
      codeItems,
      tail.label,
      Math.max(tail.header + 1, tail.start - 160),
      Math.min(codeItems.length, tail.start + 96),
    )
      .filter((idx) => idx > tail.header && idx !== tail.start && idx !== tail.start + 1)
      .sort((a, b) => b - a);
    for (const refIndex of refs) {
      rewrites += localizeNestedArrayOuterContinueRef(codeItems, code, refIndex, tail, 'LCKNAOC');
      if (rewrites >= 12) break;
    }
    searchStart = tail.start + 1;
  }
  return rewrites;
}

function localizeNestedArrayOuterContinueRef(codeItems, code, refIndex, tail, prefix) {
  const branch = codeItems[refIndex] && codeItems[refIndex].instruction;
  if (!isConditionalBranch(op(branch)) || labelName(branch.arg) !== tail.label) return 0;
  const fallthrough = nextInstructionIndex(codeItems, refIndex + 1);
  if (fallthrough < 0 || fallthrough === tail.start) return 0;
  const innerInc = readIincInstruction(codeItems[fallthrough] && codeItems[fallthrough].instruction);
  if (!innerInc || innerInc.local === tail.outerLocal) return 0;
  const jump = codeItems[fallthrough + 1] && codeItems[fallthrough + 1].instruction;
  if (op(jump) !== 'goto') return 0;
  const innerHeader = findLabelIndex(codeItems, jump.arg);
  if (innerHeader < 0 || innerHeader >= fallthrough) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, fallthrough, fallthrough + 2)) return 0;
  const bridgeLabel = freshLabel(codeItems, prefix);
  const clonedTail = cloneItems(codeItems.slice(tail.start, tail.end));
  renameInternalLabels(clonedTail, `${prefix}_${shatteredPlansCloneId++}_`);
  if (clonedTail.length > 0) delete clonedTail[0].labelDef;
  branch.arg = bridgeLabel;
  codeItems.splice(fallthrough + 2, 0,
    { labelDef: `${bridgeLabel}:`, instruction: intLoadInstruction(innerInc.local) },
    { instruction: { op: 'istore', arg: String(innerInc.local) } },
    ...clonedTail,
  );
  return 1;
}

function findNestedArrayScanOuterContinueTail(codeItems, searchStart = 0) {
  for (let i = Math.max(1, searchStart); i + 1 < codeItems.length; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label || String(label).startsWith('LCKNAOC')) continue;
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.incr !== 1) continue;
    const jump = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (op(jump) !== 'goto') continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header < 0 || header >= i) continue;
    if (intLoadLocal(codeItems[header] && codeItems[header].instruction) !== inc.local) continue;
    if (!looksLikeLoopHeader(codeItems, header)) continue;
    const refs = findConditionalRefsToLabel(codeItems, label, Math.max(header + 1, i - 160), Math.min(codeItems.length, i + 96))
      .filter((idx) => idx > header && idx !== i && idx !== i + 1);
    if (refs.length === 0 || refs.length > 8) continue;
    // Keep the rule on nested array/pair scans: the incoming branch should be inside a
    // small region that has array loads and a second induction variable.
    let arrayLoads = 0;
    let otherIinc = false;
    for (let j = Math.max(header + 1, i - 90); j < i; j += 1) {
      const cur = op(codeItems[j] && codeItems[j].instruction);
      if (cur === 'aaload' || cur === 'iaload' || cur === 'baload') arrayLoads += 1;
      const inc2 = readIincInstruction(codeItems[j] && codeItems[j].instruction);
      if (inc2 && inc2.local !== inc.local) otherIinc = true;
    }
    if (arrayLoads < 2 || !otherIinc) continue;
    return { start: i, end: i + 2, label, header, outerLocal: inc.local };
  }
  return null;
}

function hasSharedTooltipRenderTailCandidate(codeItems) {
  return findSharedTooltipRenderTailUse(codeItems) != null;
}

function cloneSharedTooltipRenderTails(codeItems, code) {
  let rewrites = 0;
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < 8; searchStart += 1) {
    const use = findSharedTooltipRenderTailUse(codeItems, searchStart);
    if (!use) break;
    if (rangeTouchesExceptionTable(code, codeItems, use.rightTail, use.returnIndex + 1)) {
      searchStart = use.setup + 1;
      continue;
    }
    // False/non-left-positioned tooltip path: clone the right-edge adjustment plus the
    // common draw/return tail instead of jumping into a distant shared tail.
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, use.flagBranch, use.rightTail, use.returnIndex + 1, 'LCKSTRT');
    if (rewrites >= 8) break;
    // True/left-positioned tooltip path: localize jumps to the common draw/return tail.
    const commonRefs = findBranchRefsToLabel(codeItems, use.commonLabel, use.flagBranch + 1, use.rightTail)
      .filter((idx) => idx > use.flagBranch && idx < use.rightTail)
      .sort((a, b) => b - a);
    for (const refIndex of commonRefs) {
      const cur = op(codeItems[refIndex] && codeItems[refIndex].instruction);
      if (cur === 'goto') rewrites += cloneGotoRangeAt(codeItems, code, refIndex, use.commonTail, use.returnIndex + 1, 'LCKSTCT');
      else if (isConditionalBranch(cur)) rewrites += cloneConditionalRangeAfterBranch(codeItems, code, refIndex, use.commonTail, use.returnIndex + 1, 'LCKSTCT');
      if (rewrites >= 8) break;
    }
    searchStart = use.setup + 1;
  }
  return rewrites;
}

function findSharedTooltipRenderTailUse(codeItems, searchStart = 0) {
  for (let setup = Math.max(0, searchStart); setup + 18 < codeItems.length; setup += 1) {
    const shape = readTooltipSetupShape(codeItems, setup);
    if (!shape) continue;
    const flagBranch = shape.flagBranch;
    const rightTail = findLabelIndex(codeItems, codeItems[flagBranch].instruction.arg);
    if (rightTail <= flagBranch || rightTail - setup < 48) continue;
    const tail = readTooltipRightEdgeTail(codeItems, rightTail, shape.xLocal, shape.yLocal, shape.widthLocal);
    if (!tail) continue;
    const returnIndex = findTerminalReturnAfter(codeItems, tail.commonTail, 160);
    if (returnIndex < 0) continue;
    return { setup, flagBranch, rightTail, commonTail: tail.commonTail, commonLabel: tail.commonLabel, returnIndex };
  }
  return null;
}

function readTooltipSetupShape(codeItems, start) {
  if (!isBipushValue(codeItems[start] && codeItems[start].instruction, 10)) return null;
  if (!isGetStaticDescriptor(codeItems[start + 1] && codeItems[start + 1].instruction, 'I')) return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'iadd') return null;
  const xLocal = intStoreLocal(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (xLocal == null) return null;
  if (!isGetStaticDescriptor(codeItems[start + 4] && codeItems[start + 4].instruction, 'I')) return null;
  if (!isBipushValue(codeItems[start + 5] && codeItems[start + 5].instruction, -30) && !isBipushValue(codeItems[start + 5] && codeItems[start + 5].instruction, 30)) return null;
  if (op(codeItems[start + 6] && codeItems[start + 6].instruction) !== 'isub') return null;
  const yLocal = intStoreLocal(codeItems[start + 7] && codeItems[start + 7].instruction);
  if (yLocal == null) return null;
  if (op(codeItems[start + 8] && codeItems[start + 8].instruction) !== 'getstatic') return null;
  if (refLoadLocal(codeItems[start + 9] && codeItems[start + 9].instruction) == null) return null;
  if (!isInvokeDescriptor(codeItems[start + 10] && codeItems[start + 10].instruction, '(Ljava/lang/String;)I')) return null;
  const widthLocal = intStoreLocal(codeItems[start + 11] && codeItems[start + 11].instruction);
  if (widthLocal == null) return null;
  const flagLocal = intLoadLocal(codeItems[start + 12] && codeItems[start + 12].instruction);
  if (flagLocal == null) return null;
  if (op(codeItems[start + 13] && codeItems[start + 13].instruction) !== 'ifeq') return null;
  return { xLocal, yLocal, widthLocal, flagLocal, flagBranch: start + 13 };
}

function readTooltipRightEdgeTail(codeItems, start, xLocal, yLocal, widthLocal) {
  let p = start;
  if (isGetStaticDescriptor(codeItems[p] && codeItems[p].instruction, 'I')) {
    p += 1;
  } else if (op(codeItems[p] && codeItems[p].instruction) === 'getstatic' &&
    isGetFieldDescriptor(codeItems[p + 1] && codeItems[p + 1].instruction, 'I')) {
    p += 2;
  } else {
    return null;
  }
  if (!isBipushValue(codeItems[p] && codeItems[p].instruction, 20)) return null;
  if (op(codeItems[p + 1] && codeItems[p + 1].instruction) !== 'isub') return null;
  if (intLoadLocal(codeItems[p + 2] && codeItems[p + 2].instruction) !== widthLocal) return null;
  if (intLoadLocal(codeItems[p + 3] && codeItems[p + 3].instruction) !== xLocal) return null;
  if (op(codeItems[p + 4] && codeItems[p + 4].instruction) !== 'ineg') return null;
  if (op(codeItems[p + 5] && codeItems[p + 5].instruction) !== 'isub') return null;
  const branch = codeItems[p + 6] && codeItems[p + 6].instruction;
  if (op(branch) !== 'if_icmplt') return null;
  const adjustTail = findLabelIndex(codeItems, branch.arg);
  if (adjustTail <= start || adjustTail - start > 80) return null;
  const commonGoto = codeItems[p + 7] && codeItems[p + 7].instruction;
  if (op(commonGoto) !== 'goto') return null;
  const commonTail = findLabelIndex(codeItems, commonGoto.arg);
  if (commonTail <= adjustTail || commonTail - start > 120) return null;
  const commonLabel = labelName(codeItems[commonTail] && codeItems[commonTail].labelDef);
  if (!commonLabel) return null;
  // The common tail begins with vertical-bounds adjustment and eventually draws
  // the tooltip string. Check for the y local and string draw descriptor nearby.
  if (!isBipushValue(codeItems[commonTail] && codeItems[commonTail].instruction, 10)) return null;
  if (intLoadLocal(codeItems[commonTail + 1] && codeItems[commonTail + 1].instruction) !== yLocal) return null;
  let hasStringDraw = false;
  for (let i = commonTail; i < Math.min(codeItems.length, commonTail + 140); i += 1) {
    if (isInvokeDescriptor(codeItems[i] && codeItems[i].instruction, '(Ljava/lang/String;IIII)V')) {
      hasStringDraw = true;
      break;
    }
  }
  if (!hasStringDraw) return null;
  return { commonTail, commonLabel };
}

function findTerminalReturnAfter(codeItems, start, maxInsns) {
  let seen = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    seen += 1;
    if (seen > maxInsns) return -1;
    if (cur === 'return') return i;
    if (isReturnOp(cur) || cur === 'athrow') return -1;
  }
  return -1;
}

function findBranchRefsToLabel(codeItems, label, start, end) {
  const out = [];
  const target = labelName(label);
  if (!target) return out;
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur !== 'goto' && !isConditionalBranch(cur)) continue;
    if (labelName((codeItems[i] && codeItems[i].instruction || {}).arg) === target) out.push(i);
  }
  return out;
}

function isBipushValue(insn, value) {
  return op(insn) === 'bipush' && (value == null || Number(insn.arg) === value);
}

function hasSharedRenderContinuationCandidate(codeItems) {
  return findSharedRenderContinuation(codeItems) != null || findSharedRenderZeroInvokeTail(codeItems) != null;
}

function cloneSharedRenderContinuations(codeItems, code) {
  let rewrites = 0;
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < 6; searchStart += 1) {
    const shape = findSharedRenderContinuation(codeItems, searchStart);
    if (!shape) break;
    const refs = ((collectLabelReferencesByLabel(codeItems).get(shape.startLabel) || []).filter((idx) => idx < shape.start))
      .filter((idx) => isConditionalBranch(op(codeItems[idx] && codeItems[idx].instruction)))
      .sort((a, b) => b - a);
    for (const refIndex of refs) {
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems, code, refIndex, shape.start, shape.merge, shape.mergeLabel, 'LCKSRC');
      if (rewrites >= 6) break;
    }
    searchStart = shape.start + 1;
  }
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < 12; searchStart += 1) {
    const tail = findSharedRenderZeroInvokeTail(codeItems, searchStart);
    if (!tail) break;
    const refs = ((collectLabelReferencesByLabel(codeItems).get(tail.startLabel) || []).filter((idx) => idx < tail.start))
      .filter((idx) => isConditionalBranch(op(codeItems[idx] && codeItems[idx].instruction)))
      .sort((a, b) => b - a);
    for (const refIndex of refs) {
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems, code, refIndex, tail.start, tail.end, tail.mergeLabel, 'LCKSRZT');
      if (rewrites >= 12) break;
    }
    searchStart = tail.start + 1;
  }
  return rewrites;
}

function findSharedRenderContinuation(codeItems, searchStart = 0) {
  for (let start = Math.max(0, searchStart); start + 12 < codeItems.length; start += 1) {
    const startLabel = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!startLabel || String(startLabel).startsWith('LCKSRC_')) continue;
    if (refLoadLocal(codeItems[start] && codeItems[start].instruction) == null) continue;
    if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'ifnull') continue;
    const flagLocal = intLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction);
    if (flagLocal == null || op(codeItems[start + 3] && codeItems[start + 3].instruction) !== 'ifeq') continue;
    const zeroTail = findLabelIndex(codeItems, codeItems[start + 3].instruction.arg);
    if (zeroTail <= start) continue;
    if (!isGetStaticDescriptor(codeItems[start + 4] && codeItems[start + 4].instruction, 'Z')) continue;
    if (op(codeItems[start + 5] && codeItems[start + 5].instruction) !== 'ifne') continue;
    if (op(codeItems[start + 6] && codeItems[start + 6].instruction) !== 'bipush') continue;
    if (!isInvokeDescriptor(codeItems[start + 7] && codeItems[start + 7].instruction, '(B)V')) continue;
    if (intLoadLocal(codeItems[start + 8] && codeItems[start + 8].instruction) !== flagLocal) continue;
    if (op(codeItems[start + 9] && codeItems[start + 9].instruction) !== 'ifne') continue;
    const merge = findLabelIndex(codeItems, codeItems[start + 9].instruction.arg);
    if (merge <= start) continue;
    if (intLoadLocal(codeItems[start + 10] && codeItems[start + 10].instruction) == null) continue;
    if (op(codeItems[start + 11] && codeItems[start + 11].instruction) !== 'ifne') continue;
    if (findLabelIndex(codeItems, codeItems[start + 11].instruction.arg) !== zeroTail) continue;
    if (!looksLikeSharedRenderZeroInvokeTail(codeItems, zeroTail, merge)) continue;
    if (intLoadLocal(codeItems[merge] && codeItems[merge].instruction) == null) continue;
    if (!isPutStaticDescriptor(codeItems[merge + 1] && codeItems[merge + 1].instruction, 'Z')) continue;
    return { start, startLabel, merge, mergeLabel: labelName(codeItems[merge] && codeItems[merge].labelDef) };
  }
  return null;
}

function findSharedRenderZeroInvokeTail(codeItems, searchStart = 0) {
  for (let start = Math.max(0, searchStart); start + 4 < codeItems.length; start += 1) {
    const startLabel = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!startLabel || String(startLabel).startsWith('LCKSRZT_')) continue;
    const jump = codeItems[start + 4] && codeItems[start + 4].instruction;
    if (op(jump) !== 'goto') continue;
    const merge = findLabelIndex(codeItems, jump.arg);
    if (merge <= start + 4) continue;
    if (!looksLikeSharedRenderZeroInvokeTail(codeItems, start, merge)) continue;
    return { start, startLabel, end: start + 5, merge, mergeLabel: labelName(codeItems[merge] && codeItems[merge].labelDef) };
  }
  return null;
}

function looksLikeSharedRenderZeroInvokeTail(codeItems, start, merge) {
  if (start < 0 || start + 4 >= codeItems.length) return false;
  if (merge <= start) return false;
  if (op(codeItems[start] && codeItems[start].instruction) !== 'getstatic') return false;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'iconst_0') return false;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'iconst_0') return false;
  if (!isInvokeDescriptor(codeItems[start + 3] && codeItems[start + 3].instruction, '(II)V')) return false;
  const jump = codeItems[start + 4] && codeItems[start + 4].instruction;
  return op(jump) === 'goto' && findLabelIndex(codeItems, jump.arg) === merge;
}

function cloneVoidHuntersUcaMenuLoopContinuations(codeItems, code) {
  let rewrites = 0;
  rewrites += cloneVoidHuntersUcaMenuFirstItemTail(codeItems, code);
  rewrites += cloneVoidHuntersUcaMenuSecondPlayersLoop(codeItems, code);
  return rewrites;
}

function retargetThirtySixCardVjDetachedBlurLoopHeader(codeItems) {
  let rewrites = 0;
  for (let header = 1; header + 5 < codeItems.length; header += 1) {
    const firstLocal = intLoadLocal(codeItems[header] && codeItems[header].instruction);
    const secondLocal = intLoadLocal(codeItems[header + 1] && codeItems[header + 1].instruction);
    const headerBranch = codeItems[header + 2] && codeItems[header + 2].instruction;
    if (firstLocal == null || secondLocal == null || op(headerBranch) !== 'if_icmplt') continue;
    if (op(codeItems[header - 1] && codeItems[header - 1].instruction) !== 'return') continue;

    const duplicateBody = findLabelIndex(codeItems, headerBranch.arg);
    if (duplicateBody <= header + 2) continue;
    const duplicateShape = readZeroStoreGotoShape(codeItems, duplicateBody);
    if (!duplicateShape) continue;

    const earlierBody = duplicateBody - 3;
    if (earlierBody <= header) continue;
    const earlierShape = readZeroStoreGotoShape(codeItems, earlierBody);
    if (!earlierShape) continue;
    if (earlierShape.local !== duplicateShape.local) continue;
    if (labelName(earlierShape.gotoLabel) !== labelName(duplicateShape.gotoLabel)) continue;

    const headerLabel = labelName(codeItems[header] && codeItems[header].labelDef);
    const earlierLabel = labelName(codeItems[earlierBody] && codeItems[earlierBody].labelDef);
    if (!headerLabel || !earlierLabel) continue;

    let hasBackedge = false;
    for (let i = duplicateBody + 3; i < codeItems.length; i += 1) {
      const insn = codeItems[i] && codeItems[i].instruction;
      if (op(insn) === 'goto' && labelName(insn.arg) === headerLabel) {
        hasBackedge = true;
        break;
      }
    }
    if (!hasBackedge) continue;

    for (let i = 0; i < header; i += 1) {
      const insn = codeItems[i] && codeItems[i].instruction;
      if (!insn || !isConditionalBranch(op(insn))) continue;
      if (labelName(insn.arg) !== earlierLabel) continue;
      insn.arg = headerLabel;
      rewrites += 1;
    }
  }
  return rewrites;
}

function readZeroStoreGotoShape(codeItems, start) {
  const zero = codeItems[start] && codeItems[start].instruction;
  const store = codeItems[start + 1] && codeItems[start + 1].instruction;
  const jump = codeItems[start + 2] && codeItems[start + 2].instruction;
  if (op(zero) !== 'iconst_0') return null;
  const local = intStoreLocal(store);
  if (local == null || op(jump) !== 'goto') return null;
  return { local, gotoLabel: jump.arg };
}

function retargetAceOfSkiesFgAgDrainLoopEntry(codeItems) {
  if (!hasStaticBooleanLoad(codeItems)) return 0;
  let rewrites = 0;
  for (let i = 4; i < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const oldHeader = findLabelIndex(codeItems, jump.arg);
    if (oldHeader <= i || oldHeader + 2 >= codeItems.length) continue;
    const local = refLoadLocal(codeItems[oldHeader] && codeItems[oldHeader].instruction);
    if (local == null) continue;
    if (op(codeItems[oldHeader + 1] && codeItems[oldHeader + 1].instruction) !== 'ifnonnull') continue;

    const store = localStore(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (!store || store.kind !== 'a' || store.local !== local) continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'checkcast') continue;
    if (op(codeItems[i - 3] && codeItems[i - 3].instruction) !== 'invokevirtual') continue;

    const replacement = findAceOfSkiesFgCanonicalAgDrainHeader(codeItems, oldHeader + 1, local);
    if (replacement <= oldHeader) continue;
    const replacementLabel = labelName(codeItems[replacement] && codeItems[replacement].labelDef);
    if (!replacementLabel) continue;
    jump.arg = replacementLabel;
    rewrites += 1;
    break;
  }
  return rewrites;
}

function materializeAceOfSkiesFgStackFlagCompares(codeItems, code) {
  if (!hasStaticBooleanLoad(codeItems)) return 0;
  const refCounts = collectLabelReferenceCounts(codeItems);
  let rewrites = 0;
  for (let i = codeItems.length - 3; i >= 2 && rewrites < 16; i -= 1) {
    const flagLoad = codeItems[i - 1] && codeItems[i - 1].instruction;
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifne' && branchOp !== 'ifeq') continue;
    const flagLocal = intLoadLocal(flagLoad);
    if (flagLocal == null) continue;

    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || !isIntCompareBranch(op(codeItems[fallthrough] && codeItems[fallthrough].instruction))) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target < 0 || target <= i || !isIntCompareBranch(op(codeItems[target] && codeItems[target].instruction))) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || (refCounts.get(targetLabel) || 0) !== 1) continue;

    const locals = chooseFreshIntLocalPair(codeItems, code);
    const leftLocal = locals[0];
    const rightLocal = locals[1];

    const targetOriginal = cloneItems([codeItems[target]])[0];
    delete targetOriginal.labelDef;
    codeItems[target].instruction = intLoadInstruction(leftLocal);
    codeItems.splice(target + 1, 0,
      { instruction: intLoadInstruction(rightLocal) },
      targetOriginal,
    );

    codeItems.splice(i + 1, 0,
      { instruction: intLoadInstruction(leftLocal) },
      { instruction: intLoadInstruction(rightLocal) },
    );

    codeItems.splice(i - 1, 0,
      { instruction: { op: 'istore', arg: String(rightLocal) } },
      { instruction: { op: 'istore', arg: String(leftLocal) } },
    );
    rewrites += 1;
  }
  return rewrites;
}

function isIntCompareBranch(cur) {
  return cur === 'if_icmpeq' || cur === 'if_icmpne' || cur === 'if_icmplt' ||
    cur === 'if_icmpge' || cur === 'if_icmpgt' || cur === 'if_icmple';
}

function cloneAceOfSkiesFgQueueLoopBodyEntries(codeItems, code) {
  if (!hasStaticBooleanLoad(codeItems)) return 0;
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 4 && rewrites < 4; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i || !looksLikeAceOfSkiesFgQueueBodyEntry(codeItems, target)) continue;
    const end = findAceOfSkiesFgQueueBodyContinuation(codeItems, target);
    if (end <= target || end - target > 220) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, end)) continue;

    const clone = cloneItems(codeItems.slice(target, end));
    renameInternalLabels(clone, `LCKACEQ_${rewrites}_`);
    specializeAceOfSkiesFgQueueBodyCloneForFlagTrue(clone);
    const cloneLabel = labelName(clone[0] && clone[0].labelDef);
    if (!cloneLabel) continue;
    jump.arg = cloneLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function cloneAceOfSkiesFgQueueFlagTrueEntryTrampolines(codeItems, code) {
  if (!hasStaticBooleanLoad(codeItems)) return 0;
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 4 && rewrites < 4; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i || op(codeItems[target] && codeItems[target].instruction) !== 'iconst_0') continue;
    if (!looksLikeAceOfSkiesFgQueueBodyEntry(codeItems, target)) continue;
    const plan = readAceOfSkiesFgFlagTrueEntryPlan(codeItems, target);
    if (!plan) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, plan.compareIndex + 1)) continue;

    const cleanupEnd = findAceOfSkiesFgFlagTrueCleanupEnd(codeItems, plan.fallthroughIndex);
    if (cleanupEnd <= plan.fallthroughIndex || cleanupEnd - plan.fallthroughIndex > 90) continue;
    const clone = [
      ...cloneItems(codeItems.slice(target, plan.flagLoadIndex)),
      ...cloneItems(codeItems.slice(plan.trueIndex, plan.compareIndex + 1)),
      ...cloneItems(codeItems.slice(plan.fallthroughIndex, cleanupEnd)),
    ];
    renameInternalLabels(clone, `LCKACEFT_${rewrites}_`);
    specializeAceOfSkiesFgQueueBodyCloneForFlagTrue(clone);
    const cloneLabel = labelName(clone[0] && clone[0].labelDef);
    if (!cloneLabel) continue;
    jump.arg = cloneLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function findAceOfSkiesFgFlagTrueCleanupEnd(codeItems, start) {
  for (let i = start; i + 2 < Math.min(codeItems.length, start + 90); i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 5) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'ifeq') continue;
    if (isReturnOp(op(codeItems[i + 2] && codeItems[i + 2].instruction))) return i + 3;
  }
  return -1;
}

function readAceOfSkiesFgFlagTrueEntryPlan(codeItems, start) {
  for (let i = start + 6; i + 2 < Math.min(codeItems.length, start + 32); i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 5) continue;
    const branch = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (op(branch) !== 'ifne') continue;
    const trueIndex = findLabelIndex(codeItems, branch.arg);
    if (trueIndex <= i || trueIndex + 2 >= codeItems.length) continue;
    if (intLoadLocal(codeItems[trueIndex] && codeItems[trueIndex].instruction) == null) continue;
    if (intLoadLocal(codeItems[trueIndex + 1] && codeItems[trueIndex + 1].instruction) == null) continue;
    if (!isIntCompareBranch(op(codeItems[trueIndex + 2] && codeItems[trueIndex + 2].instruction))) continue;
    const fallthroughIndex = nextInstructionIndex(codeItems, trueIndex + 3);
    if (fallthroughIndex < 0) continue;
    return { flagLoadIndex: i, trueIndex, compareIndex: trueIndex + 2, fallthroughIndex };
  }
  return null;
}

function looksLikeAceOfSkiesFgQueueBodyEntry(codeItems, start) {
  const offset = op(codeItems[start] && codeItems[start].instruction) === 'iconst_0' ? 1 : 0;
  return op(codeItems[start + offset] && codeItems[start + offset].instruction) === 'aload_0' &&
    isGetFieldReferenceDescriptor(codeItems[start + offset + 1] && codeItems[start + offset + 1].instruction) &&
    isGetFieldDescriptor(codeItems[start + offset + 2] && codeItems[start + offset + 2].instruction, '[I') &&
    op(codeItems[start + offset + 3] && codeItems[start + offset + 3].instruction) === 'aload_0' &&
    isGetFieldDescriptor(codeItems[start + offset + 4] && codeItems[start + offset + 4].instruction, 'I') &&
    op(codeItems[start + offset + 5] && codeItems[start + offset + 5].instruction) === 'iaload';
}

function findAceOfSkiesFgQueueBodyContinuation(codeItems, start) {
  for (let i = start + 8; i + 12 < codeItems.length; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'iload_2') continue;
    const branch = codeItems[i + 1] && codeItems[i + 1].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;

    let continuation = -1;
    let scanStart = i + 2;
    let scanEnd = i + 30;
    if (branchOp === 'ifeq') {
      continuation = findLabelIndex(codeItems, branch.arg);
    } else {
      const skipUpdate = codeItems[i + 2] && codeItems[i + 2].instruction;
      if (op(skipUpdate) !== 'goto') continue;
      continuation = findLabelIndex(codeItems, skipUpdate.arg);
      const updateStart = findLabelIndex(codeItems, branch.arg);
      if (updateStart <= i || continuation <= updateStart) continue;
      scanStart = updateStart;
      scanEnd = continuation;
    }
    if (continuation <= i) continue;

    let sawQueueFalse = false;
    let sawIndexReset = false;
    let sawContinuationGoto = branchOp === 'ifne';
    for (let j = scanStart; j < Math.min(continuation, scanEnd); j += 1) {
      const insn = codeItems[j] && codeItems[j].instruction;
      if (isPutFieldDescriptor(insn, 'Z')) sawQueueFalse = true;
      if (isPutFieldDescriptor(insn, 'I')) sawIndexReset = true;
      if (op(insn) === 'goto' && labelName(insn.arg) === labelName(codeItems[continuation] && codeItems[continuation].labelDef)) sawContinuationGoto = true;
    }
    if (sawQueueFalse && sawIndexReset && sawContinuationGoto) return continuation;
  }
  return -1;
}

function specializeAceOfSkiesFgQueueBodyCloneForFlagTrue(items) {
  for (let i = items.length - 2; i >= 0; i -= 1) {
    if (intLoadLocal(items[i] && items[i].instruction) !== 5) continue;
    const branchItem = items[i + 1];
    const branch = branchItem && branchItem.instruction;
    const cur = op(branch);
    if (cur === 'ifeq') {
      items[i].instruction = 'nop';
      branchItem.instruction = 'nop';
      continue;
    }
    if (cur === 'ifne') {
      items[i].instruction = 'nop';
      branchItem.instruction = { op: 'goto', arg: branch.arg };
    }
  }
}

function chooseFreshIntLocalPair(codeItems, code) {
  let max = -1;
  for (const item of codeItems) {
    for (const local of readLocalIndexes(item && item.instruction)) max = Math.max(max, local);
    for (const local of writtenLocalIndexes(item && item.instruction)) max = Math.max(max, local);
  }
  const first = max + 1;
  const second = max + 2;
  const limit = code && Number(code.localsSize);
  if (Number.isFinite(limit) && limit <= second) code.localsSize = String(second + 1);
  return [first, second];
}

function cloneSteelSentinelsFcBackwardContinueTails(codeItems, code) {
  let rewrites = 0;
  for (let i = 1; i < codeItems.length && rewrites < 4; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifnull' && branchOp !== 'ifeq') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target < 0 || target >= i) continue;
    const tail = readSimpleIntContinueTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0) continue;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKSSFCF_${rewrites}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKSSFC_${rewrites}_`);
    branch.op = invertConditionalBranch(branchOp);
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function readSimpleIntContinueTail(codeItems, start) {
  const load = intLoadLocal(codeItems[start] && codeItems[start].instruction);
  const store = intStoreLocal(codeItems[start + 1] && codeItems[start + 1].instruction);
  const jump = codeItems[start + 2] && codeItems[start + 2].instruction;
  if (load == null || store == null) return null;
  if (op(jump) !== 'goto') return null;
  const header = findLabelIndex(codeItems, jump.arg);
  if (header < 0 || header >= start) return null;
  return { end: start + 3, local: load, header };
}

function findAceOfSkiesFgCanonicalAgDrainHeader(codeItems, start, local) {
  for (let header = start; header + 40 < codeItems.length; header += 1) {
    const headerLabel = labelName(codeItems[header] && codeItems[header].labelDef);
    if (!headerLabel) continue;
    if (refLoadLocal(codeItems[header] && codeItems[header].instruction) !== local) continue;
    if (op(codeItems[header + 1] && codeItems[header + 1].instruction) !== 'ifnonnull') continue;
    if (!looksLikeAceOfSkiesFgAgDrainHeader(codeItems, header, local, headerLabel)) continue;
    return header;
  }
  return -1;
}

function looksLikeAceOfSkiesFgAgDrainHeader(codeItems, header, local, headerLabel) {
  let backedges = 0;
  let sawAgPending = false;
  let sawAgTouched = false;
  let sawAgReady = false;
  let sawNextStore = false;
  const end = Math.min(codeItems.length, header + 140);
  for (let i = header + 1; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && labelName(insn.arg) === headerLabel) backedges += 1;
    if (isGetFieldDescriptor(insn, 'Z')) {
      if (!sawAgPending) sawAgPending = true;
      else if (!sawAgTouched) sawAgTouched = true;
      else sawAgReady = true;
    }
    const store = localStore(insn);
    if (store && store.kind === 'a' && store.local === local && op(codeItems[i - 1] && codeItems[i - 1].instruction) === 'checkcast') {
      sawNextStore = true;
    }
  }
  return backedges >= 2 && sawAgPending && sawAgTouched && sawAgReady && sawNextStore;
}

function cloneVoidHuntersUcaMenuFirstItemTail(codeItems, code) {
  for (let i = 3; i + 1 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 26) continue;
    if (refLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction) !== 14) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i || localStore(codeItems[target] && codeItems[target].instruction)?.local !== 29) continue;
    if (op(codeItems[target] && codeItems[target].instruction) !== 'astore') continue;
    if (op(codeItems[target + 1] && codeItems[target + 1].instruction) !== 'aload') continue;
    if (op(codeItems[target + 2] && codeItems[target + 2].instruction) !== 'checkcast') continue;
    const end = findVoidHuntersUcaItemRenderTailEnd(codeItems, target);
    if (end <= target) return 0;
    return cloneConditionalRangeAfterBranch(codeItems, code, i, target, end, 'LCKVHUCAITEM');
  }
  return 0;
}

function findVoidHuntersUcaItemRenderTailEnd(codeItems, start) {
  for (let i = start; i + 3 < Math.min(codeItems.length, start + 360); i += 1) {
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.local !== 13 || inc.incr !== 1) continue;
    if (intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction) !== 26) continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'ifeq') continue;
    return i + 3;
  }
  return -1;
}

function cloneVoidHuntersUcaMenuSecondPlayersLoop(codeItems, code) {
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    if (!looksLikeVoidHuntersUcaPlayersLoopStart(codeItems, target, 47, 46, 51, 52, 53)) continue;
    const end = findReturnTailEnd(codeItems, target, 460);
    if (end <= target) return 0;
    return cloneGotoRangeAt(codeItems, code, i, target, end, 'LCKVHUCASECOND');
  }
  return 0;
}

function looksLikeVoidHuntersUcaPlayersLoopStart(codeItems, start, rsbLocal, qsaLocal, sgLocal, stringLocal, compareSgLocal) {
  if (refLoadLocal(codeItems[start] && codeItems[start].instruction) !== 0) return false;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'getfield') return false;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'getfield') return false;
  if (refLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction) !== 0) return false;
  if (op(codeItems[start + 4] && codeItems[start + 4].instruction) !== 'getfield') return false;
  if (op(codeItems[start + 5] && codeItems[start + 5].instruction) !== 'getfield') return false;
  if (!isBipush(codeItems[start + 6] && codeItems[start + 6].instruction, 121)) return false;
  if (op(codeItems[start + 7] && codeItems[start + 7].instruction) !== 'invokevirtual') return false;
  if (op(codeItems[start + 8] && codeItems[start + 8].instruction) !== 'iconst_m1') return false;
  if (op(codeItems[start + 9] && codeItems[start + 9].instruction) !== 'iadd') return false;
  if (!isBipush(codeItems[start + 10] && codeItems[start + 10].instruction, -87)) return false;
  if (op(codeItems[start + 11] && codeItems[start + 11].instruction) !== 'invokevirtual') return false;
  if (op(codeItems[start + 12] && codeItems[start + 12].instruction) !== 'checkcast') return false;
  const rsbStore = localStore(codeItems[start + 13] && codeItems[start + 13].instruction);
  if (!rsbStore || rsbStore.kind !== 'a' || rsbStore.local !== rsbLocal) return false;
  if (op(codeItems[start + 14] && codeItems[start + 14].instruction) !== 'iconst_0') return false;
  const intStore = localStore(codeItems[start + 15] && codeItems[start + 15].instruction);
  return !!intStore && intStore.kind === 'i' && intStore.local === 14;
}

function cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, start, end, prefix) {
  const insn = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const cur = op(insn);
  if (!isConditionalBranch(cur)) return 0;
  if (start <= branchIndex || end <= start) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough < 0 || fallthrough >= start) return 0;
  const cloneId = shatteredPlansCloneId;
  shatteredPlansCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}


function removeBachelorFridgeGjDuplicateInventoryLoopGoto(codeItems) {
  let rewrites = 0;
  for (let gotoIndex = 2; gotoIndex + 4 < codeItems.length && rewrites < 1; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    const fallthrough = nextInstructionIndex(codeItems, gotoIndex + 1);
    if (fallthrough !== gotoIndex + 1 || target <= fallthrough) continue;
    if (!looksLikeBachelorFridgeGjCardLoop(codeItems, fallthrough)) continue;
    if (!looksLikeBachelorFridgeGjCardLoop(codeItems, target)) continue;
    if (intLoadLocal(codeItems[gotoIndex - 2] && codeItems[gotoIndex - 2].instruction) !== 7) continue;
    const guard = codeItems[gotoIndex - 1] && codeItems[gotoIndex - 1].instruction;
    if (op(guard) !== 'ifeq') continue;
    const fallthroughExit = labelName(codeItems[fallthrough + 4] && codeItems[fallthrough + 4].instruction && codeItems[fallthrough + 4].instruction.arg);
    const targetExit = labelName(codeItems[target + 4] && codeItems[target + 4].instruction && codeItems[target + 4].instruction.arg);
    if (!fallthroughExit || fallthroughExit !== targetExit) continue;
    codeItems[gotoIndex].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}



function removeBachelorFridgeDeadFlagLocalBranches(codeItems) {
  return removeStaticZeroFlagLocalBranches(codeItems);
}

function removeBrickAbracDeadFlagLocalBranches(codeItems) {
  return removeStaticZeroFlagLocalBranches(codeItems);
}

function removeStaticZeroFlagLocalBranches(codeItems, owner, name) {
  const binding = findStaticZeroFlagLocalBinding(codeItems, owner, name);
  if (!binding) return 0;
  let rewrites = 0;
  const local = binding.local;
  for (let index = binding.storeIndex + 1; index + 1 < codeItems.length; index += 1) {
    const item = codeItems[index];
    const insn = item && item.instruction;
    if (writesLocal(insn, local)) break;
    if (intLoadLocal(insn) !== local) continue;
    const branchIndex = nextInstructionIndex(codeItems, index + 1);
    if (branchIndex !== index + 1) continue;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const cur = op(branch);
    if (cur !== 'ifne' && cur !== 'ifeq') continue;
    item.instruction = 'nop';
    if (cur === 'ifne') {
      codeItems[branchIndex].instruction = 'nop';
    } else {
      codeItems[branchIndex].instruction = { op: 'goto', arg: branch.arg };
    }
    rewrites += 1;
  }
  return rewrites;
}

function findStaticZeroFlagLocalBinding(codeItems, owner, name) {
  for (let index = 0; index + 1 < codeItems.length && index < 40; index += 1) {
    const get = codeItems[index] && codeItems[index].instruction;
    if (owner || name) {
      if (!isGetStatic(get, owner, name, 'I')) continue;
    } else if (!isGetStaticDescriptor(get, 'I')) {
      continue;
    }
    const storeIndex = nextInstructionIndex(codeItems, index + 1);
    if (storeIndex !== index + 1) continue;
    const store = codeItems[storeIndex] && codeItems[storeIndex].instruction;
    const local = intStoreLocal(store);
    if (local == null) continue;
    return { local, getIndex: index, storeIndex };
  }
  return null;
}

function writesLocal(insn, local) {
  return writtenLocalIndexes(insn).includes(local);
}

function cloneBachelorFridgeJoStackCompareTails(codeItems, code) {
  let rewrites = 0;
  for (let branchIndex = 2; branchIndex < codeItems.length && rewrites < 2; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction) !== 4) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
    if (fallthrough !== branchIndex + 1 || target <= branchIndex) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (targetLabel && targetLabel.startsWith('LCKBFJO_')) continue;

    const clonePlan = readBachelorFridgeJoSharedLoopClonePlan(codeItems, target);
    if (!clonePlan) continue;
    if (rangeTouchesExceptionTable(code, codeItems, clonePlan.start, clonePlan.end)) continue;

    const cloneId = shatteredPlansCloneId;
    shatteredPlansCloneId += 1;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKBFJOF_${cloneId}`);
    const clone = cloneItems(codeItems.slice(clonePlan.start, clonePlan.end));
    renameInternalLabels(clone, `LCKBFJO_${cloneId}_`);
    if (clonePlan.appendExitLabel) clone.push({ instruction: { op: 'goto', arg: clonePlan.appendExitLabel } });
    branch.op = 'ifeq';
    branch.arg = fallthroughLabel;
    codeItems.splice(branchIndex + 1, 0, ...clone);
    rewrites += 1;
    branchIndex += clone.length;
  }
  return rewrites;
}

function readBachelorFridgeJoSharedLoopClonePlan(codeItems, target) {
  const targetOp = op(codeItems[target] && codeItems[target].instruction);
  if (targetOp === 'ixor') {
    const compareIndex = nextInstructionIndex(codeItems, target + 1);
    if (compareIndex !== target + 1) return null;
    const compare = codeItems[compareIndex] && codeItems[compareIndex].instruction;
    if (op(compare) !== 'ifle') return null;
    const exitIndex = findLabelIndex(codeItems, compare.arg);
    if (exitIndex <= compareIndex || exitIndex + 2 >= codeItems.length) return null;
    if (op(codeItems[exitIndex] && codeItems[exitIndex].instruction) !== 'iconst_0') return null;
    if (intStoreLocal(codeItems[exitIndex + 1] && codeItems[exitIndex + 1].instruction) !== 3) return null;
    const exitJump = codeItems[exitIndex + 2] && codeItems[exitIndex + 2].instruction;
    if (op(exitJump) !== 'goto') return null;
    return { start: target, end: exitIndex + 3, appendExitLabel: null };
  }
  if (targetOp === 'if_icmple') {
    const exitLabel = labelName(codeItems[target] && codeItems[target].instruction && codeItems[target].instruction.arg);
    const exitIndex = findLabelIndex(codeItems, exitLabel);
    if (!exitLabel || exitIndex <= target) return null;
    if (exitIndex - target < 40 || exitIndex - target > 420) return null;
    return { start: target, end: exitIndex, appendExitLabel: exitLabel };
  }
  return null;
}

function resolveGotoChainIndex(codeItems, index) {
  let cur = index;
  const seen = new Set();
  for (let depth = 0; depth < 12; depth += 1) {
    if (cur < 0 || cur >= codeItems.length || seen.has(cur)) return cur;
    seen.add(cur);
    const insn = codeItems[cur] && codeItems[cur].instruction;
    if (op(insn) !== 'goto') return cur;
    const next = findLabelIndex(codeItems, insn.arg);
    if (next < 0) return cur;
    cur = next;
  }
  return cur;
}



function cloneBachelorFridgeGjSecondHandLoop(codeItems, code) {
  let rewrites = 0;
  rewrites += cloneBachelorFridgeGjFirstHandLoopEntry(codeItems, code);
  rewrites += cloneBachelorFridgeGjSecondHandLoopEntry(codeItems, code);
  return rewrites;
}

function cloneBachelorFridgeGjFirstHandLoopEntry(codeItems, code) {
  for (let i = 0; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1 || target + 4 >= codeItems.length) continue;
    if (labelName(codeItems[target] && codeItems[target].labelDef) !== 'L687') continue;
    if (op(codeItems[target] && codeItems[target].instruction) !== 'iconst_0') continue;
    if (intStoreLocal(codeItems[target + 1] && codeItems[target + 1].instruction) !== 6) continue;
    if (!isBipush(codeItems[target + 2] && codeItems[target + 2].instruction, 7)) continue;
    if (intLoadLocal(codeItems[target + 3] && codeItems[target + 3].instruction) !== 6) continue;
    const exitBranch = codeItems[target + 4] && codeItems[target + 4].instruction;
    if (op(exitBranch) !== 'if_icmple') continue;
    const exit = findLabelIndex(codeItems, exitBranch.arg);
    if (exit <= target + 4) continue;
    const secondLoop = findBachelorFridgeGjHandLoopStart(codeItems, target + 8, exit, exitBranch.arg);
    if (secondLoop <= target) continue;
    if (!looksLikeBachelorFridgeGjSecondHandLoopBody(codeItems, target, secondLoop)) continue;
    return cloneConditionalRangeAfterBranchWithFallthroughGoto(codeItems, code, i, target, exit, labelName(exitBranch.arg), 'LCKBFGJHAND1');
  }
  return 0;
}

function cloneBachelorFridgeGjSecondHandLoopEntry(codeItems, code) {
  for (let i = 2; i < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i + 1 || target + 4 >= codeItems.length) continue;
    if (labelName(codeItems[target] && codeItems[target].labelDef) !== 'L883') continue;
    if (intLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction) !== 7) continue;
    const guard = codeItems[i - 1] && codeItems[i - 1].instruction;
    if (op(guard) !== 'ifeq') continue;
    if (op(codeItems[target] && codeItems[target].instruction) !== 'iconst_0') continue;
    if (intStoreLocal(codeItems[target + 1] && codeItems[target + 1].instruction) !== 6) continue;
    if (!isBipush(codeItems[target + 2] && codeItems[target + 2].instruction, 7)) continue;
    if (intLoadLocal(codeItems[target + 3] && codeItems[target + 3].instruction) !== 6) continue;
    const exitBranch = codeItems[target + 4] && codeItems[target + 4].instruction;
    if (op(exitBranch) !== 'if_icmple') continue;
    const exit = findLabelIndex(codeItems, exitBranch.arg);
    if (exit <= target + 4 || exit <= i) continue;
    if (labelName(guard.arg) !== labelName(exitBranch.arg)) continue;
    if (!looksLikeBachelorFridgeGjSecondHandLoopBody(codeItems, target, exit)) continue;
    return cloneGotoRangeAtWithFallthroughGoto(codeItems, code, i, target, exit, labelName(exitBranch.arg), 'LCKBFGJHAND2');
  }
  return 0;
}

function findBachelorFridgeGjHandLoopStart(codeItems, start, end, exitLabel) {
  const cleanExit = labelName(exitLabel);
  for (let i = start; i + 4 < end; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'iconst_0') continue;
    if (intStoreLocal(codeItems[i + 1] && codeItems[i + 1].instruction) !== 6) continue;
    if (!isBipush(codeItems[i + 2] && codeItems[i + 2].instruction, 7)) continue;
    if (intLoadLocal(codeItems[i + 3] && codeItems[i + 3].instruction) !== 6) continue;
    const branch = codeItems[i + 4] && codeItems[i + 4].instruction;
    if (op(branch) === 'if_icmple' && labelName(branch.arg) === cleanExit) return i;
  }
  return -1;
}

function looksLikeBachelorFridgeGjSecondHandLoopBody(codeItems, start, end) {
  if (end - start < 60 || end - start > 140) return false;
  let sawCardArray = false;
  let sawDrawSelected = false;
  let sawIncrementBackedge = false;
  const header = labelName(codeItems[start + 2] && codeItems[start + 2].labelDef);
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isGetFieldObjectArrayDescriptor(insn)) sawCardArray = true;
    if (isInvokeDescriptor(insn, '(IIIIII)V')) sawDrawSelected = true;
    const inc = readIincInstruction(insn);
    if (inc && inc.local === 6 && inc.incr === 1) {
      const branch = codeItems[nextInstructionIndex(codeItems, i + 1)] && codeItems[nextInstructionIndex(codeItems, i + 1)].instruction;
      if (op(branch) === 'ifeq' && header && labelName(branch.arg) === header) sawIncrementBackedge = true;
    }
  }
  return sawCardArray && sawDrawSelected && sawIncrementBackedge;
}


function cloneBachelorFridgeGjSharedIconLoop(codeItems, code) {
  let rewrites = 0;
  for (let branchIndex = 4; branchIndex < codeItems.length && rewrites < 1; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    if (!isBipush(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction, -2)) continue;
    if (op(codeItems[branchIndex - 2] && codeItems[branchIndex - 2].instruction) !== 'ixor') continue;
    if (op(codeItems[branchIndex - 3] && codeItems[branchIndex - 3].instruction) !== 'iconst_m1') continue;
    if (!isGetFieldDescriptor(codeItems[branchIndex - 4] && codeItems[branchIndex - 4].instruction, 'I')) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    const tail = readBachelorFridgeGjSharedIconLoop(codeItems, target);
    if (!tail) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, target, tail.end, 'LCKBFGJICON');
  }
  return rewrites;
}

function readBachelorFridgeGjSharedIconLoop(codeItems, start) {
  if (!looksLikeBachelorFridgeGjCardLoop(codeItems, start)) return null;
  let sawDrawCall = false;
  for (let i = start + 5; i < Math.min(codeItems.length, start + 220); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isInvokeDescriptor(insn, '(IIIIII)V')) sawDrawCall = true;
    const inc = readIincInstruction(insn);
    if (!inc || inc.local !== 6 || inc.incr !== 1) continue;
    const guard = nextInstructionIndex(codeItems, i + 1);
    if (guard !== i + 1 || intLoadLocal(codeItems[guard] && codeItems[guard].instruction) !== 7) continue;
    const back = nextInstructionIndex(codeItems, guard + 1);
    if (back !== guard + 1 || op(codeItems[back] && codeItems[back].instruction) !== 'ifeq') continue;
    const backTarget = findLabelIndex(codeItems, codeItems[back].instruction.arg);
    if (backTarget !== start + 2) continue;
    return sawDrawCall ? { end: back + 1 } : null;
  }
  return null;
}

function cloneBrickAbracSaEarlyFinalLoopExit(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i + 3 < codeItems.length && rewrites < 1; i += 1) {
    const first = intLoadLocal(codeItems[i] && codeItems[i].instruction);
    if (first !== 5) continue;
    const branch = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (op(branch) !== 'ifne') continue;
    const compareIndex = findLabelIndex(codeItems, branch.arg);
    if (compareIndex <= i + 1) continue;
    const compare = codeItems[compareIndex] && codeItems[compareIndex].instruction;
    if (op(compare) !== 'if_icmpge') continue;
    const jumpIndex = nextInstructionIndex(codeItems, compareIndex + 1);
    if (jumpIndex !== compareIndex + 1 || op(codeItems[jumpIndex] && codeItems[jumpIndex].instruction) !== 'goto') continue;
    const finalLoop = findLabelIndex(codeItems, codeItems[jumpIndex].instruction.arg);
    if (finalLoop <= jumpIndex) continue;
    if (!looksLikeBrickAbracSaFinalLoopBody(codeItems, finalLoop)) continue;
    const end = readUntilReturnEnd(codeItems, finalLoop, 96);
    if (end <= finalLoop) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, jumpIndex, finalLoop, end, 'LCKBRSAEXIT');
  }
  return rewrites;
}

function looksLikeBrickAbracSaFinalLoopBody(codeItems, start) {
  return isGetStaticDescriptor(codeItems[start] && codeItems[start].instruction, 'Ljava/util/Vector;')
    && intLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction) === 3
    && isInvoke(codeItems[start + 2] && codeItems[start + 2].instruction, 'java/util/Vector', 'elementAt', '(I)Ljava/lang/Object;');
}

function cloneBachelorFridgeGjCardLoopFallback(codeItems, code) {
  let rewrites = 0;
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < 2; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex || !looksLikeBachelorFridgeGjCardLoop(codeItems, target)) continue;
    if (!isBipush(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction, -2)) continue;
    const end = findBachelorFridgeGjCardLoopEnd(codeItems, target);
    if (end <= target) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, target, end, 'LCKBFGJCARDS');
    break;
  }

  for (let gotoIndex = 0; gotoIndex < codeItems.length && rewrites < 3; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex || !looksLikeBachelorFridgeGjCardLoop(codeItems, target)) continue;
    const previousBranch = previousInstruction(codeItems, gotoIndex - 1);
    if (!previousBranch || op(previousBranch.instruction) !== 'ifeq') continue;
    if (intLoadLocal(codeItems[gotoIndex - 2] && codeItems[gotoIndex - 2].instruction) !== 7) continue;
    const end = findBachelorFridgeGjCardLoopEnd(codeItems, target);
    if (end <= target) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, target, end, 'LCKBFGJCARDS');
    break;
  }
  return rewrites;
}

function looksLikeBachelorFridgeGjCardLoop(codeItems, start) {
  return op(codeItems[start] && codeItems[start].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[start + 1] && codeItems[start + 1].instruction) === 6
    && isBipush(codeItems[start + 2] && codeItems[start + 2].instruction, 7)
    && intLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction) === 6
    && op(codeItems[start + 4] && codeItems[start + 4].instruction) === 'if_icmple'
    && refLoadLocal(codeItems[start + 5] && codeItems[start + 5].instruction) === 0
    && isGetFieldReferenceDescriptor(codeItems[start + 6] && codeItems[start + 6].instruction)
    && isGetFieldObjectArrayDescriptor(codeItems[start + 7] && codeItems[start + 7].instruction)
    && !String(labelName(codeItems[start] && codeItems[start].labelDef) || '').startsWith('LCKBFGJCARDS_');
}

function findBachelorFridgeGjCardLoopEnd(codeItems, start) {
  const exit = labelName(codeItems[start + 4] && codeItems[start + 4].instruction && codeItems[start + 4].instruction.arg);
  if (!exit) return -1;
  const exitIndex = findLabelIndex(codeItems, exit);
  return exitIndex > start ? exitIndex : -1;
}

function readUntilReturnEnd(codeItems, start, maxInsns) {
  let seen = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    seen += 1;
    if (seen > maxInsns) return -1;
    if (cur === 'return') return i + 1;
  }
  return -1;
}


function hasArrayMembershipOuterContinueExitCandidate(codeItems) {
  return findArrayMembershipOuterContinueExit(codeItems) != null;
}

function localizeArrayMembershipOuterContinueExits(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE_MAX_REWRITES || 4);
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < maxRewrites; searchStart += 1) {
    const shape = findArrayMembershipOuterContinueExit(codeItems, searchStart);
    if (!shape) break;
    if (rangeTouchesExceptionTable(code, codeItems, shape.header, shape.insertAfter)) {
      searchStart = shape.header + 1;
      continue;
    }
    const afterLabel = freshLabel(codeItems, `LCKAMOC_${rewrites}`);
    codeItems[shape.outerGoto].instruction.arg = afterLabel;
    codeItems.splice(shape.insertAfter, 0,
      { labelDef: `${afterLabel}:`, instruction: intLoadInstruction(shape.indexLocal) },
      { instruction: { op: 'istore', arg: String(shape.indexLocal) } },
      { instruction: { op: 'goto', arg: shape.outerTargetLabel } },
    );
    rewrites += 1;
    searchStart = shape.insertAfter;
  }
  return rewrites;
}

function findArrayMembershipOuterContinueExit(codeItems, searchStart = 0) {
  for (let header = Math.max(0, searchStart); header + 14 < codeItems.length; header += 1) {
    const arrayLocal = refLoadLocal(codeItems[header] && codeItems[header].instruction);
    if (arrayLocal == null) continue;
    const indexLocal = intLoadLocal(codeItems[header + 1] && codeItems[header + 1].instruction);
    if (indexLocal == null) continue;
    if (op(codeItems[header + 2] && codeItems[header + 2].instruction) !== 'aaload') continue;
    const elementStore = localStore(codeItems[header + 3] && codeItems[header + 3].instruction);
    if (!elementStore || elementStore.kind !== 'a') continue;
    const elementLocal = elementStore.local;
    if (refLoadLocal(codeItems[header + 4] && codeItems[header + 4].instruction) !== elementLocal) continue;
    if (op(codeItems[header + 5] && codeItems[header + 5].instruction) !== 'iconst_0') continue;
    if (op(codeItems[header + 6] && codeItems[header + 6].instruction) !== 'iaload') continue;
    const valueLocal = intLoadLocal(codeItems[header + 7] && codeItems[header + 7].instruction);
    if (valueLocal == null) continue;
    if (op(codeItems[header + 8] && codeItems[header + 8].instruction) !== 'if_icmpgt') continue;
    const increment = findLabelIndex(codeItems, codeItems[header + 8].instruction.arg);
    if (increment <= header + 8) continue;
    if (intLoadLocal(codeItems[header + 9] && codeItems[header + 9].instruction) !== valueLocal) continue;
    if (refLoadLocal(codeItems[header + 10] && codeItems[header + 10].instruction) !== elementLocal) continue;
    if (op(codeItems[header + 11] && codeItems[header + 11].instruction) !== 'iconst_1') continue;
    if (op(codeItems[header + 12] && codeItems[header + 12].instruction) !== 'iaload') continue;
    if (op(codeItems[header + 13] && codeItems[header + 13].instruction) !== 'if_icmpgt') continue;
    if (findLabelIndex(codeItems, codeItems[header + 13].instruction.arg) !== increment) continue;
    const outerGoto = nextInstructionIndex(codeItems, header + 14);
    if (outerGoto !== header + 14 || op(codeItems[outerGoto] && codeItems[outerGoto].instruction) !== 'goto') continue;
    const outerTarget = findLabelIndex(codeItems, codeItems[outerGoto].instruction.arg);
    if (outerTarget < 0 || outerTarget >= header) continue;
    const tail = readArrayMembershipIndexWrapTail(codeItems, increment, header, indexLocal);
    if (!tail) continue;
    return {
      header,
      increment,
      outerGoto,
      outerTarget,
      outerTargetLabel: labelName(codeItems[outerTarget] && codeItems[outerTarget].labelDef),
      insertAfter: tail.end,
      indexLocal,
    };
  }
  return null;
}

function readArrayMembershipIndexWrapTail(codeItems, increment, header, indexLocal) {
  const inc = readIincInstruction(codeItems[increment] && codeItems[increment].instruction);
  if (!inc || inc.local !== indexLocal || inc.incr !== 1) return null;
  if (intLoadLocal(codeItems[increment + 1] && codeItems[increment + 1].instruction) !== indexLocal) return null;
  if (intLoadLocal(codeItems[increment + 2] && codeItems[increment + 2].instruction) == null) return null;
  if (op(codeItems[increment + 3] && codeItems[increment + 3].instruction) !== 'if_icmpge') return null;
  const reset = findLabelIndex(codeItems, codeItems[increment + 3].instruction.arg);
  if (reset <= increment + 3) return null;
  if (op(codeItems[increment + 4] && codeItems[increment + 4].instruction) !== 'goto') return null;
  if (findLabelIndex(codeItems, codeItems[increment + 4].instruction.arg) !== header) return null;
  if (op(codeItems[reset] && codeItems[reset].instruction) !== 'iconst_0') return null;
  if (intStoreLocal(codeItems[reset + 1] && codeItems[reset + 1].instruction) !== indexLocal) return null;
  if (op(codeItems[reset + 2] && codeItems[reset + 2].instruction) !== 'goto') return null;
  if (findLabelIndex(codeItems, codeItems[reset + 2].instruction.arg) !== header) return null;
  return { end: reset + 3 };
}

function cloneBachelorFridgeGtStackShiftStoreTails(codeItems, code) {
  let rewrites = 0;
  for (let firstShift = 0; firstShift + 10 < codeItems.length && rewrites < 4; firstShift += 1) {
    if (op(codeItems[firstShift] && codeItems[firstShift].instruction) !== 'ishr') continue;
    const bridge = nextInstructionIndex(codeItems, firstShift + 1);
    if (bridge !== firstShift + 1 || op(codeItems[bridge] && codeItems[bridge].instruction) !== 'goto') continue;
    const secondShift = nextInstructionIndex(codeItems, bridge + 1);
    if (secondShift !== bridge + 1 || op(codeItems[secondShift] && codeItems[secondShift].instruction) !== 'ishr') continue;
    const storeTail = nextInstructionIndex(codeItems, secondShift + 1);
    if (storeTail !== secondShift + 1 || op(codeItems[storeTail] && codeItems[storeTail].instruction) !== 'dup_x2') continue;
    if (op(codeItems[storeTail + 1] && codeItems[storeTail + 1].instruction) !== 'iastore') continue;
    if (op(codeItems[storeTail + 2] && codeItems[storeTail + 2].instruction) !== 'iastore') continue;
    const inc = readIincInstruction(codeItems[storeTail + 3] && codeItems[storeTail + 3].instruction);
    if (!inc || (inc.local !== 20 && inc.local !== 21) || inc.incr !== 1) continue;
    if (intLoadLocal(codeItems[storeTail + 4] && codeItems[storeTail + 4].instruction) !== 23) continue;
    if (op(codeItems[storeTail + 5] && codeItems[storeTail + 5].instruction) !== 'ifne') continue;
    if (intLoadLocal(codeItems[storeTail + 6] && codeItems[storeTail + 6].instruction) !== 23) continue;
    if (op(codeItems[storeTail + 7] && codeItems[storeTail + 7].instruction) !== 'ifeq') continue;
    if (rangeTouchesExceptionTable(code, codeItems, firstShift, storeTail + 8)) continue;

    const firstLabel = labelName(codeItems[firstShift] && codeItems[firstShift].labelDef);
    const secondLabel = labelName(codeItems[secondShift] && codeItems[secondShift].labelDef);
    if (!firstLabel || !secondLabel) continue;
    if (firstLabel.startsWith('LCKBFGT_') || secondLabel.startsWith('LCKBFGT_')) continue;
    const firstRefs = findConditionalRefsToLabel(codeItems, firstLabel, Math.max(0, firstShift - 160), firstShift);
    const secondRefs = findConditionalRefsToLabel(codeItems, secondLabel, Math.max(0, secondShift - 260), secondShift);
    const candidates = [
      ...firstRefs.map((refIndex) => ({ refIndex, start: firstShift })),
      ...secondRefs.map((refIndex) => ({ refIndex, start: secondShift })),
    ].sort((a, b) => b.refIndex - a.refIndex);
    for (const candidate of candidates) {
      rewrites += cloneConditionalRangeAfterBranch(codeItems, code, candidate.refIndex, candidate.start, storeTail + 8, 'LCKBFGT');
    }
    break;
  }
  return rewrites;
}

function findConditionalRefsToLabel(codeItems, label, start, end) {
  const out = [];
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!isConditionalBranch(cur)) continue;
    if (labelName(insn.arg) === label) out.push(i);
  }
  return out;
}

function cloneTailAfterConditionalBranch(codeItems, code, branchIndex, start, end, prefix) {
  const insn = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const cur = op(insn);
  if (!isConditionalBranch(cur)) return 0;
  if (start < 0 || end <= start) return 0;
  if (branchIndex >= start && branchIndex < end) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough < 0) return 0;
  const cloneId = shatteredPlansCloneId;
  shatteredPlansCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, start, end, prefix) {
  const insn = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const cur = op(insn);
  if (!isConditionalBranch(cur)) return 0;
  if (start <= branchIndex || end <= start) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough < 0 || fallthrough >= start) return 0;
  const cloneId = shatteredPlansCloneId;
  shatteredPlansCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function invertConditionalGotoBridges(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGE_MAX_REWRITES || 128);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!isConditionalBranch(branchOp)) continue;
    const gotoIndex = nextInstructionIndex(codeItems, i + 1);
    if (gotoIndex !== i + 1) continue;
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const fallthroughIndex = nextInstructionIndex(codeItems, gotoIndex + 1);
    if (fallthroughIndex < 0) continue;
    const branchTarget = findLabelIndex(codeItems, branch.arg);
    if (branchTarget !== fallthroughIndex) continue;
    branch.op = invertConditionalBranch(branchOp);
    branch.arg = jump.arg;
    codeItems[gotoIndex].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function cloneSharedForwardConditionalContinuations(codeItems, code, method) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATION_MAX_REWRITES || 12);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATION_MAX_INSNS || 180);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATION_MAX_REFS || 8);

  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const refCounts = collectLabelReferenceCounts(codeItems);
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!isConditionalBranch(branchOp)) continue;
    const targetLabel = labelName(branch.arg);
    const target = findLabelIndex(codeItems, targetLabel);
    if (target <= i + 1) continue;
    const targetRefs = refCounts.get(targetLabel) || 0;
    if (targetRefs < 2 || targetRefs > maxRefs) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;

    const tail = readForwardContinuationCloneTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (method && method.name === '<init>' && rangeContainsConstructorCall(codeItems, target, tail.end)) continue;

    const cloneId = sharedForwardContinuationCloneId;
    sharedForwardContinuationCloneId += 1;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKSFCF_${cloneId}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKSFC_${cloneId}_`);

    branch.op = invertConditionalBranch(branchOp);
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function readForwardContinuationCloneTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sawSideEffect = false;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'tableswitch' || cur === 'lookupswitch' || isReturnOp(cur) || cur === 'athrow') return null;
    if (isStoreOrSideEffect(cur)) sawSideEffect = true;
    if (cur === 'goto') {
      const target = findLabelIndex(codeItems, insn.arg);
      if (target < 0 || target === start) return null;
      return sawSideEffect ? { end: i + 1, instructions } : null;
    }
  }
  return null;
}

function cloneSharedForwardLoopIncrementTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAIL_MAX_REWRITES || 48);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAIL_MAX_INSNS || 4);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAIL_MAX_REFS || 12);
  for (let scan = 0; scan < codeItems.length && rewrites < maxRewrites; scan += 1) {
    const refsByLabel = collectLabelReferencesByLabel(codeItems);
    const label = labelName(codeItems[scan] && codeItems[scan].labelDef);
    if (!label) continue;
    const refs = (refsByLabel.get(label) || [])
      .filter((idx) => idx < scan && isBranchOp(op(codeItems[idx] && codeItems[idx].instruction)));
    if (refs.length === 0 || refs.length > maxRefs) continue;
    if (refs.length + (hasFallthroughPredecessor(codeItems, scan) ? 1 : 0) < 2) continue;
    const tail = readForwardLoopIncrementTail(codeItems, scan, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, scan, tail.end)) continue;

    const selected = refs
      .slice(0, Math.max(0, maxRewrites - rewrites))
      .sort((a, b) => b - a);
    const sourceTail = cloneItems(codeItems.slice(scan, tail.end));
    const candidates = [];
    for (const refIndex of selected) {
      const refInsn = codeItems[refIndex] && codeItems[refIndex].instruction;
      const refOp = op(refInsn);
      const cloneId = sharedLoopIncrementCloneId;
      sharedLoopIncrementCloneId += 1;
      if (refOp === 'goto') {
        candidates.push({ refIndex, refOp, cloneId });
        continue;
      }
      if (!isConditionalBranch(refOp)) continue;
      const fallthrough = nextInstructionIndex(codeItems, refIndex + 1);
      if (fallthrough < 0 || fallthrough >= scan) continue;
      const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKSLIF_${cloneId}`);
      candidates.push({ refIndex, refOp, cloneId, fallthroughLabel });
    }
    for (const candidate of candidates) {
      if (rewrites >= maxRewrites) break;
      const refInsn = codeItems[candidate.refIndex] && codeItems[candidate.refIndex].instruction;
      if (!refInsn) continue;
      const clone = cloneItems(sourceTail);
      renameInternalLabels(clone, `LCKSLI_${candidate.cloneId}_`);
      if (candidate.refOp === 'goto') {
        preserveReplacementEntryLabel(codeItems[candidate.refIndex], clone);
        codeItems.splice(candidate.refIndex, 1, ...clone);
        rewrites += 1;
        continue;
      }
      refInsn.op = invertConditionalBranch(candidate.refOp);
      refInsn.arg = candidate.fallthroughLabel;
      codeItems.splice(candidate.refIndex + 1, 0, ...clone);
      rewrites += 1;
    }
  }
  return rewrites;
}

function readForwardLoopIncrementTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sawIncrement = false;
  for (let i = start; i < codeItems.length && instructions < maxInsns; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (cur === 'iinc') {
      sawIncrement = true;
      continue;
    }
    if (cur !== 'goto' || !sawIncrement) return null;
    const header = findLabelIndex(codeItems, insn.arg);
    if (header < 0 || header >= start || !looksLikeLoopHeader(codeItems, header)) return null;
    return { end: i + 1, instructions };
  }
  return null;
}

function rangeContainsConstructorCall(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'invokespecial') continue;
    const arg = insn && insn.arg;
    if (Array.isArray(arg) && Array.isArray(arg[2]) && arg[2][0] === '<init>') return true;
  }
  return false;
}

function cloneBoundedConditionalTerminalTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_INSNS || 220);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i + 1) continue;

    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;
    if (isStructuredGotoCloneLabel(codeItems[fallthrough], 'LCKBCT_')) continue;
    if (!rangeContainsTerminal(codeItems, fallthrough, target)) continue;

    const tail = readBoundedTerminalRegion(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, i, tail.end)) continue;

    const cloneId = boundedConditionalTailCloneId;
    boundedConditionalTailCloneId += 1;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKBCTF_${cloneId}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKBCT_${cloneId}_`);

    insn.op = invertConditionalBranch(cur);
    insn.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function rangeContainsTerminal(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    if (isTerminalOp(op(codeItems[i] && codeItems[i].instruction))) return true;
  }
  return false;
}

function readBoundedTerminalRegion(codeItems, start, maxInsns) {
  let instructions = 0;
  let end = -1;
  for (let i = start; i < codeItems.length; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'tableswitch' || cur === 'lookupswitch') return null;
    if (isTerminalOp(cur)) {
      end = i + 1;
      break;
    }
  }
  if (end < 0) return null;

  const labelsInside = new Set();
  for (let i = start; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) labelsInside.add(label);
  }

  for (let i = start; i < end; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    for (const label of collectInstructionLabels(codeItems[i].instruction)) {
      if (!labelsInside.has(labelName(label))) return null;
    }
  }

  return { end, instructions };
}

function isTerminalOp(cur) {
  return isReturnOp(cur) || cur === 'athrow';
}

function isStructuredGotoCloneLabel(item, prefix) {
  const label = labelName(item && item.labelDef);
  return !!label && label.startsWith(prefix);
}

function ensureFreshLabel(codeItems, index, prefix) {
  const existing = labelName(codeItems[index] && codeItems[index].labelDef);
  if (existing) return existing;
  const label = freshLabel(codeItems, prefix);
  codeItems[index].labelDef = `${label}:`;
  return label;
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

function cloneVertigo2BhPhaseContinuationTail(codeItems, code) {
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 1; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    if (!isInvokeDescriptor(codeItems[i - 1] && codeItems[i - 1].instruction, '(IIII)V')) continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (!looksLikeVertigo2BhPhaseContinuationEntry(codeItems, target)) continue;
    if (!canCloneForwardContinuationTail(codeItems, code, i, target)) continue;
    const clone = cloneItems(codeItems.slice(target));
    renameInternalLabels(clone, `LCKV2BH_${rewrites}_`);
    preserveReplacementEntryLabel(codeItems[i], clone);
    codeItems.splice(i, 1, ...clone);
    rewrites += 1;
    break;
  }
  return rewrites;
}

function looksLikeVertigo2BhPhaseContinuationEntry(codeItems, target) {
  if (target < 0 || target + 5 >= codeItems.length) return false;
  return op(codeItems[target] && codeItems[target].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[target + 1] && codeItems[target + 1].instruction) === 7
    && op(codeItems[target + 2] && codeItems[target + 2].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[target + 3] && codeItems[target + 3].instruction) === 8
    && op(codeItems[target + 4] && codeItems[target + 4].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[target + 5] && codeItems[target + 5].instruction) === 9;
}

function cloneVertigo2GjMenuContinuationTail(codeItems, code) {
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 1 && rewrites < 2; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    if (!isPutStaticDescriptor(codeItems[i - 1] && codeItems[i - 1].instruction, 'Ljava/lang/String;')) continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (!looksLikeVertigo2GjMenuContinuationEntry(codeItems, target)) continue;
    if (!canCloneForwardContinuationTail(codeItems, code, i, target)) continue;
    const clone = cloneItems(codeItems.slice(target));
    renameInternalLabels(clone, `LCKV2GJ_${rewrites}_`);
    preserveReplacementEntryLabel(codeItems[i], clone);
    codeItems.splice(i, 1, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function looksLikeVertigo2GjMenuContinuationEntry(codeItems, target) {
  if (target < 0 || target + 2 >= codeItems.length) return false;
  return isGetStaticDescriptor(codeItems[target] && codeItems[target].instruction, 'J')
    && op(codeItems[target + 1] && codeItems[target + 1].instruction) === 'lconst_0'
    && op(codeItems[target + 2] && codeItems[target + 2].instruction) === 'lcmp';
}

function canCloneForwardContinuationTail(codeItems, code, source, target) {
  if (target <= source || target >= codeItems.length) return false;
  const maxInsns = Number(process.env.STRUCTURED_GOTO_VERTIGO2_CONTINUATION_MAX_INSNS || 2500);
  if (countInstructions(codeItems, target, codeItems.length) > maxInsns) return false;
  if (rangeTouchesExceptionTable(code, codeItems, target, codeItems.length)) return false;
  return !rangeHasBranchTargetOutside(codeItems, target, codeItems.length);
}

function countInstructions(codeItems, start, end) {
  let count = 0;
  for (let i = start; i < end; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction)) count += 1;
  }
  return count;
}

function rangeHasBranchTargetOutside(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target < 0 || target < start || target >= end) return true;
  }
  return false;
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

function refStoreLocal(insn) {
  const cur = op(insn);
  if (cur === 'astore_0') return 0;
  if (cur === 'astore_1') return 1;
  if (cur === 'astore_2') return 2;
  if (cur === 'astore_3') return 3;
  if (cur === 'astore') return Number(insn.arg);
  return null;
}

function refLoadInstruction(local) {
  if (local === 0) return 'aload_0';
  if (local === 1) return 'aload_1';
  if (local === 2) return 'aload_2';
  if (local === 3) return 'aload_3';
  return { op: 'aload', arg: String(local) };
}

function refStoreInstruction(local) {
  if (local === 0) return 'astore_0';
  if (local === 1) return 'astore_1';
  if (local === 2) return 'astore_2';
  if (local === 3) return 'astore_3';
  return { op: 'astore', arg: String(local) };
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

function isGetField(insn, owner, name, descriptor) {
  if (op(insn) !== 'getfield') return false;
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
    if (item.stackMapFrame) out.stackMapFrame = cloneValue(item.stackMapFrame);
    if (item.lineNumber) out.lineNumber = item.lineNumber;
    return out;
  });
}

function cloneInstruction(insn) {
  if (!insn || typeof insn !== 'object') return insn;
  const out = Array.isArray(insn) ? insn.slice() : { ...insn };
  delete out.pc;
  delete out.cp_index;
  if (Array.isArray(out.arg)) out.arg = cloneValue(out.arg);
  return out;
}

module.exports = { runStructuredGotoClone, countIntComplements, restoreDroppedIntComplements };
