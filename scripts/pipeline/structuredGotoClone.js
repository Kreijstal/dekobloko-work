'use strict';

const v8 = require('v8');

let boundedConditionalTailCloneId = 0;
let sharedForwardContinuationCloneId = 0;
let sharedLoopIncrementCloneId = 0;
let structuredCloneId = 0;

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
      if (process.env.STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES === '1') {
        rewrites += retargetGotoTrampolines(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION === '1') {
        rewrites += cloneQueueDrainContinuations(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL === '1') {
        rewrites += materializeSharedBooleanConstantTails(codeItems, codeAttr.code);
        rewrites += materializePredicateBooleanConstantSelectorRefs(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_PADDED_BOOLEAN_CONSTANT_TAIL === '1') {
        rewrites += materializePaddedBooleanConstantTails(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_STORE_TARGET === '1') {
        rewrites += cloneSharedBooleanStoreTargets(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES === '1') {
        rewrites += removeDominatedBooleanLocalBranches(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_ARRAY_LENGTH_PRELOOP_ENTRY === '1') {
        rewrites += retargetDuplicateArrayLengthPreloopEntries(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_SELECTOR_PARTIAL_SETUP === '1') {
        rewrites += retargetDuplicateSelectorPartialSetups(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS === '1') {
        rewrites += cloneSharedForwardLoopIncrementTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS === '1') {
        rewrites += cloneSharedForwardConditionalContinuations(codeItems, codeAttr.code, item.method);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS === '1') {
        rewrites += cloneSharedForwardGotoContinuations(codeItems, codeAttr.code, item.method);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAILS === '1') {
        rewrites += cloneSharedInstanceIntUpdateTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STRING_INDEX_RETRY_TAIL === '1') {
        rewrites += cloneSharedStringIndexRetryTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY === '1') {
        rewrites += cloneSharedArrayRecordUpdateBodies(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STATIC_INT_LOOP_FLAG_BRANCHES === '1') {
        rewrites += removeStaticIntLoopFlagBranches(codeItems, item.method);
      }
      if (process.env.STRUCTURED_GOTO_RASTER_TOP_CLIP_SCANLINE_ENTRY === '1') {
        rewrites += cloneRasterTopClipScanlineEntries(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_GRID_SCAN_CONTINUES === '1') {
        rewrites += retargetDuplicateGridScanContinues(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_ITERATOR_PROCESS_GUARD === '1') {
        rewrites += materializeIteratorProcessGuards(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SIBLING_LOCAL_SCAN_BODIES === '1') {
        rewrites += cloneSiblingLocalScanBodies(codeItems, codeAttr.code, item.method);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_FALLTHROUGH_CONTINUATION_TAIL === '1' &&
        shouldRunSharedFallthroughContinuationTail(item.method, codeItems)) {
        rewrites += cloneSharedFallthroughContinuationTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_TAIL === '1') {
        rewrites += cloneSharedStaticAssignmentTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENTS_GOTO_TAIL === '1') {
        rewrites += cloneSharedStaticAssignmentsGotoTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_FALLTHROUGH_TAIL === '1') {
        rewrites += cloneSharedStaticAssignmentFallthroughTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_SIDE_EFFECT_GOTO_TAIL === '1') {
        rewrites += cloneSharedSideEffectGotoTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_GUARDED_SIDE_EFFECT_TAIL === '1') {
        rewrites += cloneSharedGuardedSideEffectTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_INT_GUARDED_SIDE_EFFECT_TAIL === '1') {
        rewrites += cloneSharedIntGuardedSideEffectTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_CONDITIONAL_SIDE_EFFECT_EXIT_TAIL === '1') {
        rewrites += cloneSharedConditionalSideEffectExitTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_NULL_FIELD_INVOKE_CONTINUATION === '1') {
        rewrites += cloneSharedNullFieldInvokeContinuations(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_OBJECT_CLEAR_TAIL === '1') {
        rewrites += cloneSharedStaticObjectClearTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_INSTANCE_ASSIGNMENT_TAIL === '1') {
        rewrites += cloneSharedInstanceAssignmentTails(codeItems, codeAttr.code);
      }
      if (shouldRunCachedLookupContinuationClone(cls, item.method)) {
        rewrites += cloneHbbCachedLookupContinuationTail(codeItems, codeAttr.code);
      }
      if (shouldRunObjectRefreshContinuationClone(cls, item.method)) {
        rewrites += cloneObjectRefreshContinuation(codeItems, codeAttr.code);
      }
      if (shouldRunPrefixContinuationClone(cls, item.method)) {
        rewrites += clonePrefixContinuation(codeItems, codeAttr.code);
      }
      if (shouldRunSharedBooleanLoopTailClone(cls, item.method)) {
        rewrites += cloneSharedBooleanLoopTail(codeItems, codeAttr.code);
      }
      if (shouldRunIteratorAdvanceTailClone(cls, item.method)) {
        rewrites += cloneIteratorAdvanceTail(codeItems, codeAttr.code);
      }
      if (shouldRunMessageExitTailClone(cls, item.method)) {
        rewrites += cloneMessageExitTail(codeItems, codeAttr.code);
      }
      if (shouldRunTwoSidedNotCompareCleanup(cls, item.method)) {
        rewrites += simplifyTwoSidedNotCompares(codeItems);
      }
      if (shouldRunOneSidedNotMinusOneCompareCleanup(cls, item.method)) {
        rewrites += simplifyOneSidedNotMinusOneCompares(codeItems);
      }
      if (shouldRunStackShiftStoreTailClone(cls, item.method)) {
        rewrites += cloneStackShiftStoreTails(codeItems, codeAttr.code);
      }
      if (shouldRunDuplicateCardLoopCleanup(cls, item.method)) {
        rewrites += removeDuplicateCardLoopGoto(codeItems);
      }
      if (shouldRunStackCompareTailClone(cls, item.method)) {
        rewrites += cloneStackCompareTails(codeItems, codeAttr.code);
      }
      if (shouldRunStaticZeroFlagBranchCleanup(cls, item.method)) {
        rewrites += removeAnyStaticZeroFlagLocalBranches(codeItems);
      }
      if (shouldRunStaticZeroFlagBranchCleanupForAlternateShape(cls, item.method)) {
        rewrites += removeAlternateStaticZeroFlagLocalBranches(codeItems);
      }
      if (shouldRunCardSecondHandLoopClone(cls, item.method)) {
        rewrites += cloneCardSecondHandLoop(codeItems, codeAttr.code);
      }
      if (shouldRunCardLoopFallbackClone(cls, item.method)) {
        rewrites += cloneCardLoopFallback(codeItems, codeAttr.code);
      }
      if (shouldRunSharedIconLoopClone(cls, item.method)) {
        rewrites += cloneSharedIconLoop(codeItems, codeAttr.code);
      }
      if (shouldRunEarlyFinalLoopExitClone(cls, item.method)) {
        rewrites += cloneEarlyFinalLoopExit(codeItems, codeAttr.code);
      }
      if (shouldRunArrayMembershipOuterContinueLocalization(cls, item.method, codeItems)) {
        rewrites += localizeArrayMembershipOuterContinueExits(codeItems, codeAttr.code);
      }
      if (shouldRunDuplicateArrayLoopHeaderAliasCanonicalize(cls, item.method, codeItems)) {
        rewrites += canonicalizeDuplicateArrayLoopHeaderAliases(codeItems, codeAttr.code);
      }
      if (shouldRunTargetedSharedLoopIncrementTailClone(cls, item.method)) {
        rewrites += cloneSharedForwardLoopIncrementTails(codeItems, codeAttr.code);
      }
      if (shouldRunBucketArrayInitTailClone(cls, item.method)) {
        rewrites += cloneBucketArrayInitTail(codeItems, codeAttr.code);
      }
      if (shouldRunObjectLoopIncrementTailClone(cls, item.method)) {
        rewrites += cloneUcaSharedLoopIncrementTail(codeItems, codeAttr.code);
      }
      if (shouldRunObjectSharedReturnTailClone(cls, item.method)) {
        rewrites += cloneObjectSharedReturnTail(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_TERMINAL_TAIL === '1') {
        rewrites += cloneSharedTerminalTails(codeItems, codeAttr.code);
      }
      if (shouldRunEntityLoopContinuationClone(cls, item.method)) {
        rewrites += cloneEntityLoopContinuation(codeItems, codeAttr.code);
      }
      if (shouldRunSharedRenderContinuationClone(cls, item.method, codeItems)) {
        rewrites += cloneSharedRenderContinuations(codeItems, codeAttr.code);
      }
      if (shouldRunNestedArrayScanOuterContinueClone(cls, item.method, codeItems)) {
        rewrites += cloneNestedArrayScanOuterContinueTails(codeItems, codeAttr.code);
      }
      if (shouldRunNestedArrayScanInnerContinueClone(cls, item.method, codeItems)) {
        rewrites += cloneNestedArrayScanInnerContinueTails(codeItems, codeAttr.code);
        rewrites += cloneNestedArrayScanPostMatchTails(codeItems, codeAttr.code);
      }
      if (shouldRunSharedTooltipRenderTailClone(cls, item.method, codeItems)) {
        rewrites += cloneSharedTooltipRenderTails(codeItems, codeAttr.code);
      }
      if (shouldRunMenuLoopContinuationClone(cls, item.method)) {
        rewrites += cloneMenuLoopContinuations(codeItems, codeAttr.code);
      }
      if (shouldRunRasterBlurLoopHeaderRetarget(cls, item.method)) {
        rewrites += retargetDetachedRasterBlurLoopHeader(codeItems);
      }
      if (shouldRunEventDrainLoopRetarget(cls, item.method)) {
        rewrites += retargetEventDrainLoopEntry(codeItems);
      }
      if (shouldRunStackFlagCompareMaterialize(cls, item.method)) {
        rewrites += materializeStackFlagCompares(codeItems, codeAttr.code);
      }
      if (shouldRunQueueBodyEntryClone(cls, item.method)) {
        rewrites += cloneQueueLoopBodyEntries(codeItems, codeAttr.code);
      }
      if (shouldRunQueueFlagTrueEntryClone(cls, item.method)) {
        rewrites += cloneQueueFlagTrueEntryTrampolines(codeItems, codeAttr.code);
      }
      if (shouldRunBackwardContinueTailClone(cls, item.method)) {
        rewrites += cloneBackwardContinueTails(codeItems, codeAttr.code);
      }
      if (shouldRunPhaseContinuationTailClone(cls, item.method)) {
        rewrites += clonePhaseContinuationTail(codeItems, codeAttr.code);
      }
      if (shouldRunMenuContinuationTailClone(cls, item.method)) {
        rewrites += cloneMenuContinuationTail(codeItems, codeAttr.code);
      }
      if (shouldRunDuplicateQueueEntryRetarget(cls, item.method, codeItems)) {
        rewrites += retargetDuplicateQueueEntry(codeItems);
      }
      if (shouldRunDuplicateInitialPoseRetarget(cls, item.method, codeItems)) {
        rewrites += retargetDuplicateInitialPose(codeItems);
      }
      if (shouldRunIteratorBooleanTailClone(cls, item.method, codeItems)) {
        rewrites += cloneIteratorBooleanTail(codeItems, codeAttr.code);
      }
      if (shouldRunPresenceBooleanTailClone(cls, item.method, codeItems)) {
        rewrites += clonePresenceBooleanTails(codeItems, codeAttr.code);
      }
      if (shouldRunDuplicateRadiusScanRetarget(cls, item.method, codeItems)) {
        rewrites += retargetDuplicateRadiusScans(codeItems, codeAttr.code);
      }
      if (shouldRunBase38DuplicateEncoderEntryCleanup(cls, item.method, codeItems)) {
        rewrites += retargetDuplicateBase38EncoderEntry(codeItems);
        rewrites += cloneForwardBase38CharBody(codeItems, codeAttr.code);
      }
      if (shouldRunChatWidthTailClone(cls, item.method, codeItems)) {
        rewrites += cloneChatWidthTails(codeItems, codeAttr.code);
      }
      if (shouldRunBooleanBase38DuplicateEncoderEntryRetarget(cls, item.method, codeItems)) {
        rewrites += retargetBooleanDuplicateBase38Encoder(codeItems);
      }
      if (shouldRunEventActionTailClone(cls, item.method, codeItems)) {
        rewrites += cloneEventActionTails(codeItems, codeAttr.code);
      }
      if (shouldRunObjectMergeLoopRetarget(cls, item.method, codeItems)) {
        rewrites += retargetObjectMergeLoopTrampolines(codeItems);
      }
      if (shouldRunRendererDispatchClone(cls, item.method, codeItems)) {
        rewrites += cloneRendererDispatchBodies(codeItems, codeAttr.code);
      }
      if (shouldRunGridTileUpdateContinueClone(cls, item.method, codeItems)) {
        rewrites += cloneGridTileUpdateContinueHeaders(codeItems);
        rewrites += retargetDuplicatePreLoopSetup(codeItems);
      }
      if (shouldRunStateUpdateCreationClone(cls, item.method, codeItems)) {
        rewrites += cloneStateUpdateCreationBody(codeItems, codeAttr.code);
      }
      if (shouldRunTargetedBase38DecrementTailClone(cls, item.method, codeItems)) {
        rewrites += cloneTargetedBase38DecrementTails(codeItems);
      }
      if (shouldRunDisableBackwardTailClone(cls, item.method, codeItems)) {
        rewrites += cloneDisableBackwardTails(codeItems);
      }
      if (shouldRunColumnContinueSplitter(cls, item.method, codeItems)) {
        rewrites += retargetColumnContinues(codeItems);
      }
      if (shouldRunStateBridgeCleanup(cls, item.method, codeItems)) {
        rewrites += invertConditionalGotoBridges(codeItems);
      }
      if (shouldRunInvalidEntryTailClone(cls, item.method, codeItems)) {
        rewrites += cloneInvalidEntryTails(codeItems);
      }
      if (shouldRunTargetedCanonicalIincContinueSplitter(cls, item.method, codeItems)) {
        rewrites += retargetIincBackedgesToCanonicalContinues(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_FORWARD_IINC_CONTINUES === '1') {
        rewrites += retargetForwardIincContinuesToCanonicalTail(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_INT_GUARD_ALIAS === '1') {
        rewrites += retargetDuplicateIntGuardAliases(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET === '1') {
        rewrites += retargetDuplicateForwardTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_INT_PAIR_CONTINUATION === '1') {
        rewrites += cloneSharedIntPairContinuations(codeItems, codeAttr.code, item.method);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_RADIX_PARSER_LOOP === '1') {
        rewrites += retargetDuplicateRadixParserLoop(codeItems, item.method);
        rewrites += canonicalizeDuplicatedRadixParserLoop(codeItems, codeAttr.code, item.method);
      }
      if (process.env.STRUCTURED_GOTO_CONST_FALSE_COMPARE_INTERRUPTERS === '1') {
        rewrites += removeConstantFalseCompareInterrupters(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_SIMPLIFY_CONSTANT_BRANCHES === '1') {
        rewrites += simplifyConstantBooleanBranches(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_RANGE_BRANCHES === '1') {
        rewrites += simplifyDominatedIntRangeBranches(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_EQUALITY_BRANCHES === '1') {
        rewrites += simplifyDominatedIntEqualityBranches(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_REMOVE_DEAD_ATHROW_PADDING === '1') {
        rewrites += removeDeadAthrowPadding(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL === '1') {
        rewrites += cloneSharedChangeLogTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CONDITIONAL_INT_CONSTANT_COMPARE_BOUND === '1') {
        rewrites += materializeConditionalIntConstantCompareBounds(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_RENDERER_BOOLEAN_SELECTOR === '1') {
        rewrites += cloneSharedRendererBooleanSelectors(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_CONDITIONAL_RENDER_TAIL === '1') {
        rewrites += cloneSharedConditionalRenderTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_RENDER_CHOICE_TAIL === '1') {
        rewrites += cloneSharedRenderChoiceTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_BOOLEAN_RENDER_RESTORE_TAIL === '1') {
        rewrites += cloneSharedStaticBooleanRenderRestoreTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_INVOKE_JOIN_TAIL === '1') {
        rewrites += cloneSharedStaticInvokeJoinTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_FORWARD_BOOLEAN_PREDICATE_PREFIX === '1') {
        rewrites += cloneSharedForwardBooleanPredicatePrefixes(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_STATIC_ZERO_PAIR_GOTO_RESET === '1') {
        rewrites += cloneSharedStaticZeroPairGotoResets(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_ASSIGNMENT_GOTO_COMMON_TAIL === '1') {
        rewrites += cloneAssignmentGotoCommonTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STATE_ARRAY_ALLOCATION_TAIL === '1') {
        rewrites += cloneStateArrayAllocationTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_STORE_TARGET === '1') {
        rewrites += cloneConditionalBooleanLocalStoreTargets(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CONDITIONAL_INT_LOCAL_COPY_TARGET === '1') {
        rewrites += cloneConditionalIntLocalCopyTargets(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_CONSTANT_TAIL === '1') {
        rewrites += materializeConditionalBooleanLocalConstantTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STRING_BUILDER_CHAR_APPEND_TAIL === '1') {
        rewrites += cloneStringBuilderCharAppendTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SMALL_FORWARD_TERMINAL_GOTO_TAIL === '1') {
        rewrites += cloneSmallForwardTerminalGotoTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_FORWARD_CASE_JOIN_BODY === '1') {
        rewrites += cloneForwardCaseJoinBodies(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_FORWARD_LOOP_SUFFIX_ENTRY === '1') {
        rewrites += cloneForwardLoopSuffixEntries(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_FORWARD_GOTO_LOOP_BODY === '1') {
        rewrites += cloneForwardGotoLoopBodies(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_FORWARD_EXIT_CONTINUATION === '1') {
        rewrites += cloneSharedForwardExitContinuations(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CHECKED_LOOP_BODY_ENTRIES === '1') {
        rewrites += cloneCheckedLoopBodyEntries(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CHECKED_LOOP_BODY_SUFFIX_ENTRIES === '1') {
        rewrites += cloneCheckedLoopBodySuffixEntries(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_INSTANCEOF_SUMMARY_BODY_CLONE === '1') {
        rewrites += cloneInstanceofSummaryBodies(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STACK_CARRIED_FORWARD_COMPARE_BODY === '1') {
        rewrites += cloneStackCarriedForwardCompareBodies(codeItems, codeAttr.code);
      }
      if (shouldRunSharedBooleanSelectorTail(item.method)) {
        rewrites += cloneSharedBooleanSelectorTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_INT_SELECTOR_INVOKE_TAIL === '1') {
        rewrites += cloneSharedIntSelectorInvokeTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_INT_ADVANCE_SELECTOR_TAIL === '1') {
        rewrites += cloneSharedIntAdvanceSelectorTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_PREDICATE_SELECTOR_TAIL === '1') {
        rewrites += cloneSharedBooleanPredicateSelectorTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_PAIRED_PREDICATE_RESULT_TAIL === '1') {
        rewrites += clonePairedPredicateResultTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_NULL_STATIC_BOOLEAN_ASSIGNMENT_TAIL === '1') {
        rewrites += cloneSharedNullStaticBooleanAssignmentTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_NULL_ARRAY_ELEMENT_ASSIGNMENT_TAIL === '1') {
        rewrites += cloneSharedNullArrayElementAssignmentTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_SHARED_SIMPLE_INVOKE_GOTO_TAIL === '1') {
        rewrites += cloneSharedSimpleInvokeGotoTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STACK_BOOLEAN_TERMINAL_GOTO === '1') {
        rewrites += materializeStackBooleanTerminalGotos(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STACK_BOOLEAN_RASTER_BODY === '1') {
        rewrites += cloneStackBooleanRasterBodies(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STACK_COMPARE_CONTINUATION === '1') {
        rewrites += cloneEarlyArrayLengthLoopEntries(codeItems, codeAttr.code);
        rewrites += collapseInvariantFlagLoopBackedges(codeItems);
        rewrites += collapseFallthroughInvariantFlagLoopBackedges(codeItems);
        if (process.env.STRUCTURED_GOTO_INVARIANT_FLAG_FORWARD_EXIT === '1') {
          rewrites += removeInvariantFlagForwardLoopExits(codeItems);
        }
        if (process.env.STRUCTURED_GOTO_STACK_CARRIED_INVARIANT_FLAG_FORWARD_EXIT === '1') {
          rewrites += removeStackCarriedInvariantFlagForwardExits(codeItems);
        }
        if (process.env.STRUCTURED_GOTO_NULL_GUARD_INVARIANT_FLAG_FORWARD_EXIT === '1') {
          rewrites += removeNullGuardInvariantFlagForwardExits(codeItems);
        }
        rewrites += cloneStackCompareContinuations(codeItems, codeAttr.code);
        rewrites += cloneStackCompareResetContinuations(codeItems, codeAttr.code);
        rewrites += cloneBooleanPutfieldCompareContinuations(codeItems, codeAttr.code);
        rewrites += cloneBooleanPutfieldDrainLoopEntries(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_EVENT_LOOP_ACTION_TAIL_CLONE === '1') {
        rewrites += cloneEventLoopActionTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_RASTER_ROW_SCAN_HEADER_CLONE === '1') {
        rewrites += cloneRasterRowScanContinueHeaders(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_STRING_BASE38_SPLIT_TAIL === '1') {
        rewrites += cloneStringBase38SplitDecrementTails(codeItems, codeAttr.code);
        rewrites += cloneStringBase38ForwardSplitDecrementTails(codeItems, codeAttr.code);
        rewrites += cloneStringBase38ForwardCharBodies(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_DISABLE_OPTION_CONTINUE_TAIL === '1') {
        rewrites += cloneByteArrayClearSharedFieldCopyTails(codeItems, codeAttr.code);
        rewrites += cloneDisableOptionContinueTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_CONST_FALSE_COMPARE_INTERRUPTERS === '1') {
        rewrites += removeConstantFalseCompareInterrupters(codeItems);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_HALVE_SETUP_TAIL === '1') {
        rewrites += retargetDuplicateHalveSetupTails(codeItems, codeAttr.code);
      }
      if (process.env.STRUCTURED_GOTO_DUPLICATE_DUMMY_GUARD_BODY === '1') {
        rewrites += retargetDuplicateDummyGuardBodies(codeItems, codeAttr.code);
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

// Value operand of a bitwise-complement comparison. The common obfuscator
// idiom uses one int producer, but some constructors compare a computed int[]
// element (for example `this.q[row * width + column]`). Return the complete
// expression so the safety check cannot mistake a dropped `iconst_m1; ixor`
// for a valid fold merely because the producer spans several instructions.
function complementValueOperand(insn) {
  if (!insn) return null;
  if (intLoadLocal(insn) != null) return insn;
  const cur = op(insn);
  if (cur === 'getstatic' || cur === 'getfield') {
    const arg = insn.arg;
    const descriptor = Array.isArray(arg) && Array.isArray(arg[2]) ? arg[2][1] : null;
    if (descriptor === 'I' || descriptor === 'Z' || descriptor === 'B' ||
      descriptor === 'S' || descriptor === 'C') return insn;
  }
  return null;
}

function complementValueItemsEndingAt(codeItems, end) {
  const single = complementValueOperand(codeItems[end] && codeItems[end].instruction);
  if (single) return [codeItems[end]];
  if (op(codeItems[end] && codeItems[end].instruction) !== 'iaload') return null;

  // Look only for a short, side-effect-free expression. This deliberately does
  // not accept invokes, stores, array loads nested in the index, or arbitrary
  // object graphs: the rollback guard should be conservative.
  const first = Math.max(0, end - 16);
  for (let start = first; start <= end; start += 1) {
    const stack = [];
    let sawIntArray = false;
    let valid = true;
    for (let i = start; i <= end && valid; i += 1) {
      const insn = codeItems[i] && codeItems[i].instruction;
      const cur = op(insn);
      if (refLoadLocal(insn) != null) {
        stack.push('ref');
      } else if (intLoadLocal(insn) != null || integerConstantValue(insn) != null) {
        stack.push('int');
      } else if (cur === 'getstatic' && instructionDescriptor(insn) === '[I') {
        stack.push('int-array');
        sawIntArray = true;
      } else if (cur === 'getfield' && instructionDescriptor(insn) === '[I') {
        if (stack.pop() !== 'ref') valid = false;
        else {
          stack.push('int-array');
          sawIntArray = true;
        }
      } else if (cur === 'ineg') {
        if (stack.pop() !== 'int') valid = false;
        else stack.push('int');
      } else if (isPureIntBinaryOp(cur)) {
        if (stack.pop() !== 'int' || stack.pop() !== 'int') valid = false;
        else stack.push('int');
      } else if (cur === 'iaload') {
        if (stack.pop() !== 'int' || stack.pop() !== 'int-array') valid = false;
        else stack.push('int');
      } else {
        valid = false;
      }
    }
    if (valid && sawIntArray && stack.length === 1 && stack[0] === 'int') {
      return codeItems.slice(start, end + 1);
    }
  }
  return null;
}

function instructionDescriptor(insn) {
  const arg = insn && insn.arg;
  return Array.isArray(arg) && Array.isArray(arg[2]) ? arg[2][1] : null;
}

function isPureIntBinaryOp(cur) {
  return cur === 'iadd' || cur === 'isub' || cur === 'imul' || cur === 'idiv' ||
    cur === 'irem' || cur === 'ishl' || cur === 'ishr' || cur === 'iushr' ||
    cur === 'iand' || cur === 'ior' || cur === 'ixor';
}

// Collect every `~value <cmp> C` comparison in the original method, in BOTH
// operand orderings the compiler can emit:
//   value-first: value ; iconst_m1 ; ixor ; const ; branch   (`~value <cmp> C`)
//   const-first: const ; value ; iconst_m1 ; ixor ; branch   (`C <cmp> ~value`)
// The prior detector only handled the value-first ordering with an int LOCAL
// operand, so complement idioms on a getstatic field and/or with the constant
// pushed first (e.g. oj.b: `bipush -4; getstatic hd.n; iconst_m1; ixor;
// if_icmpeq`) were never registered and silently corrupted by cloning.
function intComplementComparisons(codeItems) {
  const out = [];
  for (let i = 1; i + 2 < codeItems.length; i += 1) {
    const complementConstant = codeItems[i] && codeItems[i].instruction;
    const complementXor = codeItems[i + 1] && codeItems[i + 1].instruction;
    if (op(complementConstant) !== 'iconst_m1' || op(complementXor) !== 'ixor') continue;
    const valueItems = complementValueItemsEndingAt(codeItems, i - 1);
    if (!valueItems) continue;
    const valueStart = i - valueItems.length;

    // value-first: value... ; iconst_m1 ; ixor ; const ; branch
    {
      const constant = integerConstantValue(codeItems[i + 2] && codeItems[i + 2].instruction);
      const branchOp = op(codeItems[i + 3] && codeItems[i + 3].instruction);
      if (constant != null && isIntCompareBranch(branchOp)) {
        out.push({ valueItems, constant, branchOp });
      }
    }
    // const-first: const ; value... ; iconst_m1 ; ixor ; branch
    const leadingConstant = integerConstantValue(codeItems[valueStart - 1] && codeItems[valueStart - 1].instruction);
    if (leadingConstant != null) {
      const branchOp = op(codeItems[i + 2] && codeItems[i + 2].instruction);
      if (isIntCompareBranch(branchOp)) {
        out.push({ valueItems, constant: leadingConstant, branchOp });
      }
    }
  }
  return out;
}

// Detect a comparison that lost its complement: the same value operand compared
// directly against the same (un-complemented) constant with the same branch op,
// in either operand ordering, with no intervening `iconst_m1; ixor`. A correct
// fold would either keep the `iconst_m1; ixor` or complement the constant, so
// this only fires on genuine corruption.
function hasIncorrectUncomplementedComparison(codeItems, comparison) {
  const width = comparison.valueItems.length;
  for (let i = 0; i + width + 1 < codeItems.length; i += 1) {
    // value-first: value... ; const ; branch
    if (sameInstructionSequence(codeItems, i, comparison.valueItems) &&
      integerConstantValue(codeItems[i + width] && codeItems[i + width].instruction) === comparison.constant &&
      op(codeItems[i + width + 1] && codeItems[i + width + 1].instruction) === comparison.branchOp) return true;
    // const-first: const ; value... ; branch
    if (integerConstantValue(codeItems[i] && codeItems[i].instruction) === comparison.constant &&
      sameInstructionSequence(codeItems, i + 1, comparison.valueItems) &&
      op(codeItems[i + width + 1] && codeItems[i + width + 1].instruction) === comparison.branchOp) return true;
  }
  return false;
}

function sameInstructionSequence(codeItems, start, expectedItems) {
  for (let offset = 0; offset < expectedItems.length; offset += 1) {
    if (!sameInstructionOperand(
      codeItems[start + offset] && codeItems[start + offset].instruction,
      expectedItems[offset] && expectedItems[offset].instruction)) return false;
  }
  return true;
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

function shouldRunCachedLookupContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_CACHED_LOOKUP_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_CACHED_LOOKUP_CONTINUATION_TARGETS', cls, method);
}

function shouldRunObjectLoopIncrementTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_OBJECT_LOOP_INCREMENT_TAIL') &&
    targetGate('STRUCTURED_GOTO_OBJECT_LOOP_INCREMENT_TAIL_TARGETS', cls, method);
}

function shouldRunObjectSharedReturnTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_OBJECT_SHARED_RETURN_TAIL') &&
    targetGate('STRUCTURED_GOTO_OBJECT_SHARED_RETURN_TAIL_TARGETS', cls, method);
}

function shouldRunEntityLoopContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_ENTITY_LOOP_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_ENTITY_LOOP_CONTINUATION_TARGETS', cls, method);
}

function shouldRunSharedRenderContinuationClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION_TARGETS', cls, method) &&
    hasSharedRenderContinuationCandidate(codeItems);
}

function shouldRunMenuLoopContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_MENU_LOOP_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_MENU_LOOP_CONTINUATION_TARGETS', cls, method);
}

function shouldRunNestedArrayScanOuterContinueClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_NESTED_ARRAY_SCAN_OUTER_CONTINUE') &&
    targetGate('STRUCTURED_GOTO_NESTED_ARRAY_SCAN_OUTER_CONTINUE_TARGETS', cls, method) &&
    hasNestedArrayScanOuterContinueCandidate(codeItems);
}

function shouldRunNestedArrayScanInnerContinueClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_NESTED_ARRAY_SCAN_INNER_CONTINUE') &&
    targetGate('STRUCTURED_GOTO_NESTED_ARRAY_SCAN_INNER_CONTINUE_TARGETS', cls, method) &&
    (hasNestedArrayScanInnerContinueCandidate(codeItems) ||
      hasNestedArrayScanPostMatchTailCandidate(codeItems));
}

function shouldRunSharedTooltipRenderTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_TOOLTIP_RENDER_TAIL') &&
    targetGate('STRUCTURED_GOTO_SHARED_TOOLTIP_RENDER_TAIL_TARGETS', cls, method) &&
    hasSharedTooltipRenderTailCandidate(codeItems);
}

function shouldRunRasterBlurLoopHeaderRetarget(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER') &&
    targetGate('STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER_TARGETS', cls, method);
}

function shouldRunEventDrainLoopRetarget(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_EVENT_DRAIN_LOOP') &&
    targetGate('STRUCTURED_GOTO_EVENT_DRAIN_LOOP_TARGETS', cls, method);
}

function shouldRunStackFlagCompareMaterialize(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STACK_FLAG_COMPARE_MATERIALIZE') &&
    targetGate('STRUCTURED_GOTO_STACK_FLAG_COMPARE_MATERIALIZE_TARGETS', cls, method);
}

function shouldRunQueueBodyEntryClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_QUEUE_BODY_ENTRY_CLONE') &&
    targetGate('STRUCTURED_GOTO_QUEUE_BODY_ENTRY_CLONE_TARGETS', cls, method);
}

function shouldRunQueueFlagTrueEntryClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_QUEUE_FLAG_TRUE_ENTRY') &&
    targetGate('STRUCTURED_GOTO_QUEUE_FLAG_TRUE_ENTRY_TARGETS', cls, method);
}

function shouldRunBackwardContinueTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_BACKWARD_CONTINUE_TAILS') &&
    targetGate('STRUCTURED_GOTO_BACKWARD_CONTINUE_TAILS_TARGETS', cls, method);
}

function shouldRunPhaseContinuationTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_PHASE_CONTINUATION_TAIL') &&
    targetGate('STRUCTURED_GOTO_PHASE_CONTINUATION_TAIL_TARGETS', cls, method);
}

function shouldRunMenuContinuationTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_MENU_CONTINUATION_TAIL') &&
    targetGate('STRUCTURED_GOTO_MENU_CONTINUATION_TAIL_TARGETS', cls, method);
}

function shouldRunSharedBooleanSelectorTail(method) {
  if (process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_SELECTOR_TAIL !== '1') return false;
  const access = Array.isArray(method && method.access) ? method.access : [];
  return method && method.descriptor === '(I)V' && !access.includes('static');
}

function shouldRunPresenceBooleanTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_PRESENCE_BOOLEAN_TAIL') &&
    targetGate('STRUCTURED_GOTO_PRESENCE_BOOLEAN_TAIL_TARGETS', cls, method) &&
    method && method.descriptor === '(B)V' &&
    hasPresenceBooleanCandidate(codeItems);
}

function shouldRunDuplicateQueueEntryRetarget(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_DUPLICATE_QUEUE_ENTRY_RETARGET') &&
    targetGate('STRUCTURED_GOTO_DUPLICATE_QUEUE_ENTRY_RETARGET_TARGETS', cls, method) &&
    method &&
    hasDuplicateQueueEntry(codeItems);
}

function shouldRunDuplicateInitialPoseRetarget(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_DUPLICATE_INITIAL_POSE_RETARGET') &&
    targetGate('STRUCTURED_GOTO_DUPLICATE_INITIAL_POSE_RETARGET_TARGETS', cls, method) &&
    method && method.name === '<init>' &&
    findDuplicateInitialPose(codeItems) != null;
}

function shouldRunIteratorBooleanTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_ITERATOR_BOOLEAN_TAIL') &&
    targetGate('STRUCTURED_GOTO_ITERATOR_BOOLEAN_TAIL_TARGETS', cls, method) &&
    method &&
    findIteratorBooleanTail(codeItems) != null;
}

function shouldRunDuplicateRadiusScanRetarget(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_DUPLICATE_RADIUS_SCAN_RETARGET') &&
    targetGate('STRUCTURED_GOTO_DUPLICATE_RADIUS_SCAN_RETARGET_TARGETS', cls, method) &&
    method && method.descriptor === '(ZII)V' &&
    findDuplicateRadiusScans(codeItems) != null;
}

function shouldRunBase38DuplicateEncoderEntryCleanup(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_BASE38_DUPLICATE_ENCODER_ENTRY') &&
    targetGate('STRUCTURED_GOTO_BASE38_DUPLICATE_ENCODER_ENTRY_TARGETS', cls, method) &&
    method && method.descriptor === '(Ljava/lang/String;B)V' &&
    findDuplicateBase38EncoderEntry(codeItems) != null;
}

function shouldRunChatWidthTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_CHAT_WIDTH_TAILS') &&
    targetGate('STRUCTURED_GOTO_CHAT_WIDTH_TAILS_TARGETS', cls, method) &&
    method && method.descriptor === '(III)Z' &&
    findChatWidthTailUses(codeItems).length > 0;
}

function shouldRunBooleanBase38DuplicateEncoderEntryRetarget(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_BASE38_BOOLEAN_DUPLICATE_ENCODER_ENTRY') &&
    targetGate('STRUCTURED_GOTO_BASE38_BOOLEAN_DUPLICATE_ENCODER_ENTRY_TARGETS', cls, method) &&
    method && method.descriptor === '(Ljava/lang/String;Z)V' &&
    findBooleanDuplicateBase38Encoder(codeItems) != null;
}

function shouldRunEventActionTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_EVENT_ACTION_TAIL') &&
    targetGate('STRUCTURED_GOTO_EVENT_ACTION_TAIL_TARGETS', cls, method) &&
    method && method.descriptor === '(IB)V' &&
    findEventActionTail(codeItems) != null;
}

function shouldRunObjectMergeLoopRetarget(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_OBJECT_MERGE_LOOP_RETARGET') &&
    targetGate('STRUCTURED_GOTO_OBJECT_MERGE_LOOP_RETARGET_TARGETS', cls, method) &&
    method && method.descriptor === '(B)Lwa;' &&
    hasObjectMergeLoopTrampoline(codeItems);
}

function shouldRunRendererDispatchClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_RENDERER_DISPATCH_BODY') &&
    targetGate('STRUCTURED_GOTO_RENDERER_DISPATCH_BODY_TARGETS', cls, method) &&
    method && method.descriptor === '(IZIIIIILfe;)V' &&
    hasRendererDispatchBody(codeItems);
}

function shouldRunGridTileUpdateContinueClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_GRID_TILE_UPDATE_CONTINUE') &&
    targetGate('STRUCTURED_GOTO_GRID_TILE_UPDATE_CONTINUE_TARGETS', cls, method) &&
    method && method.descriptor === '(I)V' &&
    (hasGridTileUpdateContinueHeader(codeItems) || hasDuplicatePreLoopSetup(codeItems));
}

function shouldRunStateUpdateCreationClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_STATE_UPDATE_CREATION_BODY') &&
    targetGate('STRUCTURED_GOTO_STATE_UPDATE_CREATION_BODY_TARGETS', cls, method) &&
    method && method.descriptor === '(IIIII)V' &&
    findStateUpdateCreationBranch(codeItems) != null;
}

function shouldRunTargetedBase38DecrementTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_TARGETED_BASE38_DECREMENT_TAIL') &&
    targetGate('STRUCTURED_GOTO_TARGETED_BASE38_DECREMENT_TAIL_TARGETS', cls, method) &&
    isTargetedBase38DecrementTailMethod(cls, method) &&
    hasTargetedBase38DecrementTail(codeItems);
}

function isTargetedBase38DecrementTailMethod(cls, method) {
  return method && method.descriptor === '(Ljava/lang/String;I)V';
}

function shouldRunDisableBackwardTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_DISABLE_BACKWARD_TAIL') &&
    targetGate('STRUCTURED_GOTO_DISABLE_BACKWARD_TAIL_TARGETS', cls, method) &&
    method && method.descriptor === '(Ljava/awt/Canvas;B)V' &&
    hasDisableBackwardTail(codeItems);
}

function shouldRunColumnContinueSplitter(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_COLUMN_CONTINUE_SPLITTER') &&
    targetGate('STRUCTURED_GOTO_COLUMN_CONTINUE_SPLITTER_TARGETS', cls, method) &&
    method && method.descriptor === '(ZIZLka;IIIII)V' &&
    findCanonicalColumnContinue(codeItems) != null;
}

function shouldRunStateBridgeCleanup(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_STATE_BRIDGES') &&
    targetGate('STRUCTURED_GOTO_STATE_BRIDGE_TARGETS', cls, method) &&
    method && method.descriptor === '(BI)Lqe;' &&
    hasConditionalGotoBridge(codeItems);
}

function shouldRunInvalidEntryTailClone(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_INVALID_ENTRY_TAIL') &&
    targetGate('STRUCTURED_GOTO_INVALID_ENTRY_TAIL_TARGETS', cls, method) &&
    method && method.descriptor === '(B)V' &&
    findInvalidEntryTail(codeItems) != null;
}

function shouldRunTargetedCanonicalIincContinueSplitter(cls, method, codeItems) {
  return featureEnabled('STRUCTURED_GOTO_TARGETED_CANONICAL_IINC_CONTINUES') &&
    targetGate('STRUCTURED_GOTO_TARGETED_CANONICAL_IINC_CONTINUE_TARGETS', cls, method) &&
    isTargetedCanonicalIincContinueMethod(cls, method) &&
    hasCanonicalIincContinueCandidate(codeItems);
}

function isTargetedCanonicalIincContinueMethod(cls, method) {
  return method && method.descriptor === '(IIB)I';
}

function shouldRunTargetedSharedLoopIncrementTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAILS') &&
    targetGate('STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAIL_TARGETS', cls, method);
}

function shouldRunBucketArrayInitTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL') &&
    targetGate('STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL_TARGETS', cls, method);
}

function shouldRunObjectRefreshContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION_TARGETS', cls, method);
}

function shouldRunPrefixContinuationClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_PREFIX_CONTINUATION') &&
    targetGate('STRUCTURED_GOTO_PREFIX_CONTINUATION_TARGETS', cls, method);
}

function shouldRunSharedBooleanLoopTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL') &&
    targetGate('STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL_TARGETS', cls, method);
}

function shouldRunIteratorAdvanceTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL') &&
    targetGate('STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL_TARGETS', cls, method);
}

function shouldRunMessageExitTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_MESSAGE_EXIT_TAIL') &&
    targetGate('STRUCTURED_GOTO_MESSAGE_EXIT_TAIL_TARGETS', cls, method);
}

function shouldRunTwoSidedNotCompareCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE') &&
    targetGate('STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE_TARGETS', cls, method);
}

function shouldRunOneSidedNotMinusOneCompareCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE') &&
    targetGate('STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE_TARGETS', cls, method);
}

function shouldRunStackShiftStoreTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STACK_SHIFT_STORE_TAIL') &&
    targetGate('STRUCTURED_GOTO_STACK_SHIFT_STORE_TAIL_TARGETS', cls, method);
}

function shouldRunDuplicateCardLoopCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_DUPLICATE_CARD_LOOP_CLEANUP') &&
    targetGate('STRUCTURED_GOTO_DUPLICATE_CARD_LOOP_CLEANUP_TARGETS', cls, method);
}

function shouldRunStackCompareTailClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STACK_COMPARE_TAILS') &&
    targetGate('STRUCTURED_GOTO_STACK_COMPARE_TAIL_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_STACK_COMPARE_TAILS_TARGETS', cls, method);
}

function shouldRunStaticZeroFlagBranchCleanup(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES') &&
    targetGate('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCH_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES_TARGETS', cls, method);
}

function shouldRunStaticZeroFlagBranchCleanupForAlternateShape(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES') &&
    targetGate('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCH_TARGETS', cls, method) &&
    targetGate('STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES_TARGETS', cls, method);
}

function shouldRunCardSecondHandLoopClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_CARD_SECOND_HAND_LOOP') &&
    targetGate('STRUCTURED_GOTO_CARD_SECOND_HAND_LOOP_TARGETS', cls, method);
}

function shouldRunCardLoopFallbackClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_CARD_LOOP_FALLBACK') &&
    targetGate('STRUCTURED_GOTO_CARD_LOOP_FALLBACK_TARGETS', cls, method);
}

function shouldRunSharedIconLoopClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_SHARED_ICON_LOOP') &&
    targetGate('STRUCTURED_GOTO_SHARED_ICON_LOOP_TARGETS', cls, method);
}

function shouldRunEarlyFinalLoopExitClone(cls, method) {
  return featureEnabled('STRUCTURED_GOTO_EARLY_FINAL_LOOP_EXIT') &&
    targetGate('STRUCTURED_GOTO_EARLY_FINAL_LOOP_EXIT_TARGETS', cls, method);
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
  return v8.deserialize(v8.serialize(value));
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



function cloneObjectRefreshContinuation(codeItems, code) {
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
    const end = findObjectRefreshIteratorLatchEnd(codeItems, target);
    if (end <= target) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, target, end, 'LCKOBJREF');
  }
  return rewrites;
}

function findObjectRefreshIteratorLatchEnd(codeItems, start) {
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

function clonePrefixContinuation(codeItems, code) {
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
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, target, end, 'LCKPFX');
  }
  return rewrites;
}

function cloneIteratorAdvanceTail(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 1; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    const tail = readIteratorAdvanceTail(codeItems, target);
    if (!tail) continue;
    const prev = previousInstructionIndex(codeItems, i - 1);
    if (prev < 0 || op(codeItems[prev] && codeItems[prev].instruction) !== 'ifeq') continue;
    rewrites += cloneGotoRangeAt(codeItems, code, i, target, tail.end, 'LCKITERADV');
  }
  return rewrites;
}

function readIteratorAdvanceTail(codeItems, start) {
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

function cloneMessageExitTail(codeItems, code) {
  const exitStart = findSharedMessageExitStart(codeItems);
  if (exitStart < 0) return 0;
  const tail = readSharedMessageNormalTail(codeItems, exitStart);
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
    rewrites += cloneGotoRangeAt(codeItems, code, candidates[c], exitStart, tail.end, 'LCKMSGEXIT');
  }
  return rewrites;
}

function findSharedMessageExitStart(codeItems) {
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

function readSharedMessageNormalTail(codeItems, start) {
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

function cloneSharedBooleanLoopTail(codeItems, code) {
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

      const cloneId = structuredCloneId;
      structuredCloneId += 1;
      const clone = cloneItems(codeItems.slice(sharedFalse, sharedFalse + 5));
      renameInternalLabels(clone, `LCKBOOLTAIL_${cloneId}_`);
      const cloneFalse = labelName(clone[0] && clone[0].labelDef) || freshLabel(codeItems, `LCKBOOLTAIL_${cloneId}_FALSE`);
      const cloneMerge = labelName(clone[1] && clone[1].labelDef) || freshLabel(codeItems, `LCKBOOLTAIL_${cloneId}_MERGE`);
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

function simplifyTwoSidedNotCompares(codeItems) {
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
    // Take the nearest complement pair that is both rewritable and provably the
    // branch's left operand; a nearer pair failing the stack check belongs to a
    // different expression, so keep looking rather than corrupting it.
    let leftPair = -1;
    const labelRefs = collectLabelReferenceCounts(codeItems);
    for (let candidate = findPreviousNotPair(codeItems, i - 3, 18);
      candidate >= 0;
      candidate = findPreviousNotPair(codeItems, candidate, 18 - (i - 3 - candidate))) {
      // Stack check first: it is local and cheap, while plainUnreferencedItems
      // rebuilds label counts across the whole method on every call.
      if (complementProducesBranchLeftOperand(codeItems, candidate, i, labelRefs)
        && plainUnreferencedItems(codeItems, candidate, candidate + 1)) {
        leftPair = candidate;
        break;
      }
    }
    if (leftPair < 0) continue;
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

// Stack width of a field/return descriptor: 2 for long and double, 0 for void,
// 1 for every reference, array, and narrow primitive.
function descriptorStackWidth(descriptor) {
  if (typeof descriptor !== 'string' || !descriptor) return null;
  const c = descriptor[0];
  if (c === '[' || c === 'L') return 1;
  if (c === 'V') return 0;
  if (c === 'J' || c === 'D') return 2;
  if ('BCFISZ'.includes(c)) return 1;
  return null;
}

// Combined stack width of a method descriptor's parameters.
function methodArgumentStackWidth(descriptor) {
  if (typeof descriptor !== 'string' || descriptor[0] !== '(') return null;
  const close = descriptor.indexOf(')');
  if (close < 0) return null;
  let width = 0;
  let i = 1;
  while (i < close) {
    let isArray = false;
    while (descriptor[i] === '[') { isArray = true; i += 1; }
    const c = descriptor[i];
    if (c === 'L') {
      const end = descriptor.indexOf(';', i);
      if (end < 0 || end > close) return null;
      i = end + 1;
      width += 1;
      continue;
    }
    if (!'BCDFIJSZ'.includes(c)) return null;
    i += 1;
    width += (!isArray && (c === 'J' || c === 'D')) ? 2 : 1;
  }
  return width;
}

const SIMPLE_STACK_DELTAS = new Map(Object.entries({
  nop: 0, goto: 0, goto_w: 0, iinc: 0, swap: 0, arraylength: 0,
  checkcast: 0, instanceof: 0, ineg: 0, fneg: 0, lneg: 0, dneg: 0,
  i2f: 0, l2d: 0, f2i: 0, d2l: 0, i2b: 0, i2c: 0, i2s: 0,
  aconst_null: 1, new: 1, newarray: 0, anewarray: 0,
  bipush: 1, sipush: 1, ldc: 1, ldc_w: 1, ldc2_w: 2,
  lconst_0: 2, lconst_1: 2, dconst_0: 2, dconst_1: 2,
  fconst_0: 1, fconst_1: 1, fconst_2: 1,
  pop: -1, pop2: -2, dup: 1, dup_x1: 1, dup_x2: 1,
  dup2: 2, dup2_x1: 2, dup2_x2: 2,
  monitorenter: -1, monitorexit: -1,
  i2l: 1, i2d: 1, f2l: 1, f2d: 1, l2i: -1, l2f: -1, d2i: -1, d2f: -1,
  lcmp: -3, dcmpl: -3, dcmpg: -3, fcmpl: -1, fcmpg: -1,
  laload: 0, daload: 0,
  iastore: -3, fastore: -3, aastore: -3, bastore: -3, castore: -3, sastore: -3,
  lastore: -4, dastore: -4,
  lshl: -1, lshr: -1, lushr: -1,
}));

// Net operand-stack effect of one instruction, or null when the effect is not
// modelled. Callers must treat null as "unknown" and refuse to transform.
function instructionStackDelta(insn) {
  const opcode = op(insn);
  if (!opcode) return null;
  if (SIMPLE_STACK_DELTAS.has(opcode)) return SIMPLE_STACK_DELTAS.get(opcode);
  if (/^iconst_/.test(opcode)) return 1;
  if (/^[ifa]load(_\d)?$/.test(opcode)) return 1;
  if (/^[ld]load(_\d)?$/.test(opcode)) return 2;
  if (/^[ifa]store(_\d)?$/.test(opcode)) return -1;
  if (/^[ld]store(_\d)?$/.test(opcode)) return -2;
  if (/^[ifab cs]aload$/.test(opcode)) return -1;
  if (/^[if](add|sub|mul|div|rem|and|or|xor|shl|shr|ushr)$/.test(opcode)) return -1;
  if (/^[ld](add|sub|mul|div|rem|and|or|xor)$/.test(opcode)) return -2;

  if (opcode === 'getstatic' || opcode === 'putstatic'
    || opcode === 'getfield' || opcode === 'putfield') {
    const width = descriptorStackWidth(fieldDescriptor(insn));
    if (width === null) return null;
    if (opcode === 'getstatic') return width;
    if (opcode === 'putstatic') return -width;
    if (opcode === 'getfield') return width - 1;
    return -width - 1;
  }

  if (/^invoke(virtual|special|static|interface|dynamic)$/.test(opcode)) {
    const descriptor = methodDescriptor(insn);
    const args = methodArgumentStackWidth(descriptor);
    const close = typeof descriptor === 'string' ? descriptor.indexOf(')') : -1;
    const ret = close < 0 ? null : descriptorStackWidth(descriptor.slice(close + 1));
    if (args === null || ret === null) return null;
    const receiver = (opcode === 'invokestatic' || opcode === 'invokedynamic') ? 0 : 1;
    return ret - args - receiver;
  }

  return null;
}

// `~left OP ~right` may only be folded when the candidate left `iconst_m1; ixor`
// actually produces the branch's left operand. Simulate the operand stack from
// just after that `ixor` to just before the branch: the intervening code must
// push exactly one value (the right operand) and must never consume the left
// one. Without this, the backward scan happily latches onto an unrelated `~x`
// from a neighbouring expression and deletes it — silently turning, for example,
// `~this.A & param0` into `this.A & param0`.
function complementProducesBranchLeftOperand(codeItems, leftPairStart, branchIndex, labelRefs) {
  let depth = 0;
  for (let i = leftPairStart + 2; i <= branchIndex - 3; i += 1) {
    const item = codeItems[i];
    if (!item) return false;
    // Only a label another instruction actually targets can join a different
    // stack here. Rejecting on a label merely being present would disable this
    // fold on real input, where the disassembler labels nearly every
    // instruction. A frame implies a join point regardless.
    const label = labelName(item.labelDef);
    if (label && (labelRefs.get(label) || 0) > 0) return false;
    if (item.stackMapFrame) return false;
    if (!item.instruction) continue;
    const delta = instructionStackDelta(item.instruction);
    if (delta === null) return false;
    depth += delta;
    if (depth < 0) return false;
  }
  return depth === 1;
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
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  clone.push({ instruction: { op: 'goto', arg: cleanExit } });
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function cloneSharedFallthroughContinuationTails(codeItems, code) {
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_FALLTHROUGH_CONTINUATION_TAIL_MAX_REWRITES || 4);
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || targetLabel.startsWith('LCKSFTC_')) continue;
    const refs = collectLabelReferencesDetailed(codeItems, targetLabel);
    if (refs.length < 1 || !hasSharedFallthroughSource(codeItems, target, i, refs)) continue;
    const tail = readSharedFallthroughContinuationTail(codeItems, target);
    if (!tail) continue;
    if (tail.kind === 'staticThenReceiverCleanup' && !isConstStaticIntModeBranch(codeItems, i)) continue;
    if (tail.kind === 'staticThenReceiverCleanup' && !cleanupExitHasArgumentGuard(codeItems, tail.exitIndex)) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, 'LCKSFTC_FALL');
    const exitLabel = ensureFreshLabel(codeItems, tail.exitIndex, 'LCKSFTC_EXIT');
    const cloneId = structuredCloneId;
    structuredCloneId += 1;
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKSFTC_${cloneId}_`);
    clone.push({ instruction: { op: 'goto', arg: exitLabel } });
    insn.op = invertConditionalBranch(cur);
    insn.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function hasSharedFallthroughSource(codeItems, target, branchIndex, refs) {
  if (refs.some((ref) => ref !== branchIndex)) return true;
  const previous = previousInstruction(codeItems, target - 1);
  const prevOp = op(previous && previous.instruction);
  return !!prevOp && prevOp !== 'goto' && !isConditionalBranch(prevOp) && !isReturnOp(prevOp) && prevOp !== 'athrow';
}

function shouldRunSharedFallthroughContinuationTail(method, codeItems) {
  if (!method || !Array.isArray(codeItems)) return false;
  return hasStaticStateTransitionSharedTailShape(method, codeItems) ||
    hasBufferedObjectValidationSharedTailShape(method, codeItems) ||
    hasSharedInvokeExitTailCandidate(codeItems);
}

function hasStaticStateTransitionSharedTailShape(method, codeItems) {
  if (method.descriptor !== '(ZI)V') return false;
  let boolCalls = 0;
  let staticIntStores = 0;
  let staticObjectNullStores = 0;
  let staticObjectActionCalls = 0;
  for (const item of codeItems) {
    const insn = item && item.instruction;
    if (isInvokeDescriptor(insn, '(I)Z')) boolCalls += 1;
    if (isPutStaticDescriptor(insn, 'I')) staticIntStores += 1;
    if (isPutStaticDescriptor(insn, 'Z')) staticIntStores += 1;
    if (isPutStaticDescriptor(insn, 'Loj;')) staticObjectNullStores += 1;
    if (isInvokeDescriptor(insn, '(ILoj;I)V')) staticObjectActionCalls += 1;
  }
  return boolCalls >= 2 && staticIntStores >= 6 && staticObjectNullStores >= 1 && staticObjectActionCalls >= 1;
}

function hasBufferedObjectValidationSharedTailShape(method, codeItems) {
  if (method.descriptor !== '(B)V') return false;
  let byteArrayFieldLoads = 0;
  let intFieldLoads = 0;
  let staticObjectClears = 0;
  let checksumCalls = 0;
  let messageCalls = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isGetFieldDescriptor(insn, '[B')) byteArrayFieldLoads += 1;
    if (isGetFieldDescriptor(insn, 'I')) intFieldLoads += 1;
    if (op(insn) === 'aconst_null' && isPutStaticObjectDescriptor(codeItems[i + 1] && codeItems[i + 1].instruction)) {
      staticObjectClears += 1;
    }
    if (isInvokeDescriptor(insn, '([BBI)J')) checksumCalls += 1;
    if (isInvokeDescriptor(insn, '(BZILjava/lang/String;)V')) messageCalls += 1;
  }
  return byteArrayFieldLoads >= 1 &&
    intFieldLoads >= 2 &&
    staticObjectClears >= 1 &&
    checksumCalls >= 1 &&
    messageCalls >= 1;
}

function isPutStaticObjectDescriptor(insn) {
  const descriptor = fieldDescriptor(insn);
  return op(insn) === 'putstatic' && typeof descriptor === 'string' && descriptor.startsWith('L');
}

function hasSharedInvokeExitTailCandidate(codeItems) {
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let start = 0; start < codeItems.length; start += 1) {
    const label = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!label) continue;
    const tail = readSharedInvokeExitTail(codeItems, start);
    if (!tail) continue;
    const refs = refsByLabel.get(label) || [];
    if (refs.some((idx) => idx < start && isConditionalBranch(op(codeItems[idx] && codeItems[idx].instruction))) &&
      hasSharedFallthroughSource(codeItems, start, refs[0], refs)) {
      return true;
    }
  }
  return false;
}

function readSharedInvokeExitTail(codeItems, start) {
  if (!isReceiverLoadInstruction(codeItems[start] && codeItems[start].instruction)) return null;
  for (let invokeIndex = start + 2; invokeIndex <= start + 4 && invokeIndex + 1 < codeItems.length; invokeIndex += 1) {
    const invoke = codeItems[invokeIndex] && codeItems[invokeIndex].instruction;
    if (!isInvokeInstruction(invoke)) continue;
    const descriptor = methodDescriptor(invoke);
    if (!['(Z)V', '(B)V', '(I)V', '(II)V'].includes(descriptor)) continue;
    if (!rangeHasOnlySimpleInvokeArguments(codeItems, start + 1, invokeIndex)) continue;
    const jump = codeItems[invokeIndex + 1] && codeItems[invokeIndex + 1].instruction;
    if (op(jump) !== 'goto') continue;
    const exitIndex = findLabelIndex(codeItems, jump.arg);
    if (exitIndex <= invokeIndex + 1) continue;
    return { end: invokeIndex + 1, exitIndex };
  }
  return null;
}

function isReceiverLoadInstruction(insn) {
  const descriptor = fieldDescriptor(insn);
  if (op(insn) === 'getstatic' && typeof descriptor === 'string' && (descriptor.startsWith('L') || descriptor.startsWith('['))) return true;
  return refLoadLocal(insn) != null || op(insn) === 'aload_0';
}

function rangeHasOnlySimpleInvokeArguments(codeItems, start, end) {
  if (end <= start) return false;
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (integerConstantValue(insn) != null) continue;
    if (intLoadLocal(insn) != null) continue;
    return false;
  }
  return true;
}

function readSharedFallthroughContinuationTail(codeItems, start) {
  const invokeTail = readSharedInvokeExitTail(codeItems, start);
  if (invokeTail) return invokeTail;
  const first = op(codeItems[start] && codeItems[start].instruction);
  const second = op(codeItems[start + 1] && codeItems[start + 1].instruction);
  if (second !== 'putstatic') return null;
  if (first !== 'aconst_null' && first !== 'getstatic') return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) === 'goto') {
    const exitIndex = findLabelIndex(codeItems, codeItems[start + 2].instruction.arg);
    if (exitIndex < 0) return null;
    return { end: start + 3, exitIndex };
  }
  const fourth = op(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (intLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction) == null) return null;
  if (!isConditionalBranch(fourth)) return null;
  const branchTarget = findLabelIndex(codeItems, codeItems[start + 3].instruction.arg);
  const exitIndex = nextInstructionIndex(codeItems, start + 4);
  if (branchTarget <= start + 3 || exitIndex < 0) return null;
  return { end: start + 4, exitIndex };
}

function cloneSharedStaticAssignmentTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_TAIL_MAX_INSNS || 10);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_TAIL_MAX_REFS || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSSTAT_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 1 || refs.length > maxRefs) continue;
    if (refs.length === 1 && !hasImmediateFallthroughPredecessor(codeItems, target)) continue;

    const tail = readSharedStaticAssignmentTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, tail.end - 1, collectLabelReferenceCounts(codeItems))) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedStaticAssignmentTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        currentTarget,
        currentTail.end,
        currentTail.exitLabel,
        'LCKSSTAT',
      );
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function cloneSharedStaticObjectClearTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_OBJECT_CLEAR_TAIL_MAX_REWRITES || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  const refCounts = collectLabelReferenceCounts(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSOCLR_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)));
    if (refs.length !== 1) continue;
    if (!hasImmediateFallthroughPredecessor(codeItems, target)) continue;
    if (!isNullStaticObjectCompareBranch(codeItems, refs[0])) continue;
    if (op(codeItems[target - 1] && codeItems[target - 1].instruction) !== 'putfield') continue;
    const tail = readSharedStaticObjectClearTail(codeItems, target);
    if (!tail) continue;
    if (!tail.fields.some((ref) => sameFieldRef(ref, nullStaticObjectCompareField(codeItems, refs[0])))) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, tail.end - 1, refCounts)) continue;

    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      refs[0],
      target,
      tail.end,
      tail.exitLabel,
      'LCKSOCLR',
    );
    if (changed) {
      rewrites += changed;
      target += Math.max(0, tail.end - target);
    }
  }
  return rewrites;
}

function cloneSharedStaticAssignmentFallthroughTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_FALLTHROUGH_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_FALLTHROUGH_TAIL_MAX_INSNS || 8);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_FALLTHROUGH_TAIL_MAX_REFS || 8);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  const refCounts = collectLabelReferenceCounts(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSFT_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 1 || refs.length > maxRefs) continue;

    const tail = readSharedStaticAssignmentFallthroughTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, tail.end - 1, refCounts)) continue;
    if (!hasImmediateFallthroughPredecessor(codeItems, target) && refs.length < 2) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedStaticAssignmentFallthroughTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const insn = codeItems[ref] && codeItems[ref].instruction;
      let changed = 0;
      if (op(insn) === 'goto') {
        changed = cloneGotoRangeAtWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSFT',
        );
      } else if (isConditionalBranch(op(insn))) {
        changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSFT',
        );
      }
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function readSharedStaticAssignmentFallthroughTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sawPutStatic = false;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (isConditionalBranch(cur) || cur === 'goto' || cur === 'tableswitch' || cur === 'lookupswitch' ||
      isReturnOp(cur) || cur === 'athrow' || cur === 'putfield' || isInvokeInstruction(insn) || localStore(insn)) {
      return null;
    }
    if (cur === 'putstatic') {
      if (sawPutStatic) return null;
      sawPutStatic = true;
      const exitIndex = nextInstructionIndex(codeItems, i + 1);
      if (exitIndex < 0) return null;
      const exitLabel = ensureLabel(codeItems[exitIndex], 'LCKSFT_EXIT');
      return { end: i + 1, exitLabel };
    }
    if (!isStaticAssignmentTailStackOp(cur)) return null;
  }
  return null;
}

function cloneSharedStaticAssignmentsGotoTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENTS_GOTO_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENTS_GOTO_TAIL_MAX_INSNS || 16);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENTS_GOTO_TAIL_MAX_REFS || 8);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  const refCounts = collectLabelReferenceCounts(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSSTATS_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 1 || refs.length > maxRefs) continue;

    const tail = readSharedStaticAssignmentsGotoTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, tail.end - 1, refCounts)) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedStaticAssignmentsGotoTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const insn = codeItems[ref] && codeItems[ref].instruction;
      let changed = 0;
      if (op(insn) === 'goto') {
        changed = cloneGotoRangeAtWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSSTATS',
        );
      } else if (isConditionalBranch(op(insn))) {
        changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSSTATS',
        );
      }
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function readSharedStaticAssignmentsGotoTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let putStatics = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (isConditionalBranch(cur) || cur === 'tableswitch' || cur === 'lookupswitch' ||
      isReturnOp(cur) || cur === 'athrow' || cur === 'putfield' || isInvokeInstruction(insn) || localStore(insn)) {
      return null;
    }
    if (cur === 'putstatic') {
      putStatics += 1;
      continue;
    }
    if (cur === 'goto') {
      const exitLabel = labelName(insn.arg);
      const exitIndex = findLabelIndex(codeItems, exitLabel);
      if (!exitLabel || exitIndex <= i || putStatics < 2) return null;
      return { end: i, exitLabel };
    }
    if (!isStaticAssignmentTailStackOp(cur)) return null;
  }
  return null;
}

function cloneSharedSideEffectGotoTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_SIDE_EFFECT_GOTO_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_SIDE_EFFECT_GOTO_TAIL_MAX_INSNS || 48);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_SIDE_EFFECT_GOTO_TAIL_MAX_REFS || 8);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  const refCounts = collectLabelReferenceCounts(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSEGT_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRefs) continue;
    if (!hasImmediateFallthroughPredecessor(codeItems, target)) continue;

    const tail = readSharedSideEffectGotoTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, tail.end - 1, refCounts)) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedSideEffectGotoTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const insn = codeItems[ref] && codeItems[ref].instruction;
      let changed = 0;
      if (op(insn) === 'goto') {
        changed = cloneGotoRangeAtWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSEGT',
        );
      } else if (isConditionalBranch(op(insn))) {
        changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSEGT',
        );
      }
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function readSharedSideEffectGotoTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sideEffects = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'goto') {
      const exitLabel = labelName(insn.arg);
      const exitIndex = findLabelIndex(codeItems, exitLabel);
      if (!exitLabel || exitIndex <= i || sideEffects < 2) return null;
      return { end: i, exitLabel };
    }
    if (isConditionalBranch(cur) || cur === 'tableswitch' || cur === 'lookupswitch' ||
      isReturnOp(cur) || cur === 'athrow' || localStore(insn)) {
      return null;
    }
    if (isSharedSideEffectGotoTailEffect(cur)) sideEffects += 1;
  }
  return null;
}

function isSharedSideEffectGotoTailEffect(cur) {
  return cur === 'putstatic' || cur === 'putfield' ||
    cur === 'iastore' || cur === 'lastore' || cur === 'fastore' || cur === 'dastore' ||
    cur === 'aastore' || cur === 'bastore' || cur === 'castore' || cur === 'sastore' ||
    cur === 'iinc' || cur === 'new' || (typeof cur === 'string' && cur.startsWith('invoke'));
}

function cloneSharedGuardedSideEffectTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_GUARDED_SIDE_EFFECT_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_GUARDED_SIDE_EFFECT_TAIL_MAX_INSNS || 32);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_GUARDED_SIDE_EFFECT_TAIL_MAX_REFS || 8);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSGSE_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRefs) continue;

    const tail = readSharedGuardedSideEffectTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (rangeHasExternalLabelRefsInside(codeItems, target, tail.end)) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedGuardedSideEffectTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const insn = codeItems[ref] && codeItems[ref].instruction;
      let changed = 0;
      if (op(insn) === 'goto') {
        changed = cloneGotoRangeAtWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSGSE',
        );
      } else if (isConditionalBranch(op(insn))) {
        changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end,
          currentTail.exitLabel,
          'LCKSGSE',
        );
      }
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function readSharedGuardedSideEffectTail(codeItems, start, maxInsns) {
  if (!isObjectOrArrayGetStatic(codeItems[start] && codeItems[start].instruction)) return null;
  if (!isConditionalBranch(op(codeItems[start + 1] && codeItems[start + 1].instruction))) return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'goto') return null;
  const bodyIndex = findLabelIndex(codeItems, codeItems[start + 1].instruction.arg);
  const initialExitIndex = findLabelIndex(codeItems, codeItems[start + 2].instruction.arg);
  if (bodyIndex <= start + 2 || initialExitIndex <= bodyIndex) return null;
  let instructions = 0;
  let sideEffects = 0;
  let exitIndex = initialExitIndex;
  let exitLabel = labelName(codeItems[start + 2].instruction.arg);
  for (let i = start; i < codeItems.length; i += 1) {
    if (exitIndex === i) {
      return sideEffects >= 1 && exitLabel ? { end: exitIndex, exitLabel } : null;
    }
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'tableswitch' || cur === 'lookupswitch' || isReturnOp(cur) || cur === 'athrow' || localStore(insn)) {
      return null;
    }
    if (isBranchOp(cur)) {
      const labels = collectInstructionLabels(insn).map(labelName).filter(Boolean);
      if (labels.length !== 1) return null;
      const dest = findLabelIndex(codeItems, labels[0]);
      if (dest <= i) return null;
      if (cur === 'goto') {
        if (exitIndex >= 0 && dest !== exitIndex) return null;
        exitIndex = dest;
        exitLabel = labels[0];
      } else if (exitIndex >= 0 && dest > exitIndex) {
        return null;
      }
      continue;
    }
    if (isSharedSideEffectGotoTailEffect(cur)) sideEffects += 1;
  }
  return null;
}

function cloneSharedConditionalSideEffectExitTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_CONDITIONAL_SIDE_EFFECT_EXIT_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_CONDITIONAL_SIDE_EFFECT_EXIT_TAIL_MAX_INSNS || 32);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_CONDITIONAL_SIDE_EFFECT_EXIT_TAIL_MAX_REFS || 6);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKCSE_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 1 || refs.length > maxRefs) continue;
    if (refs.length === 1 && !hasImmediateFallthroughPredecessor(codeItems, target)) continue;

    const tail = readSharedConditionalSideEffectExitTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (rangeHasExternalLabelRefsInside(codeItems, target, tail.end)) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedConditionalSideEffectExitTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const branch = codeItems[ref] && codeItems[ref].instruction;
      // refsByLabel is a snapshot taken before cloning starts. Once an earlier
      // clone retargets this branch to its original fallthrough, the cached ref
      // is stale and must not be applied to the same tail again.
      if (labelName(branch && branch.arg) !== targetLabel) continue;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        currentTarget,
        currentTail.end,
        currentTail.exitLabel,
        'LCKCSE',
      );
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function readSharedConditionalSideEffectExitTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sideEffects = 0;
  let conditionalBranches = 0;
  let exitLabel = null;
  let exitIndex = -1;

  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'tableswitch' || cur === 'lookupswitch' || isReturnOp(cur) || cur === 'athrow' || localStore(insn)) {
      return null;
    }
    if (cur === 'goto') {
      const targetLabel = labelName(insn.arg);
      const targetIndex = findLabelIndex(codeItems, targetLabel);
      if (!targetLabel || targetIndex <= i) return null;
      if (exitLabel && targetLabel !== exitLabel) return null;
      return sideEffects >= 1 && conditionalBranches >= 2 ? { end: i, exitLabel: targetLabel } : null;
    }
    if (isConditionalBranch(cur)) {
      const labels = collectInstructionLabels(insn).map(labelName).filter(Boolean);
      if (labels.length !== 1) return null;
      const targetLabel = labels[0];
      const targetIndex = findLabelIndex(codeItems, targetLabel);
      if (targetIndex <= i) return null;
      if (!exitLabel) {
        exitLabel = targetLabel;
        exitIndex = targetIndex;
      } else if (targetLabel !== exitLabel) {
        return null;
      }
      if (targetIndex <= start || (exitIndex >= 0 && targetIndex !== exitIndex)) return null;
      conditionalBranches += 1;
      continue;
    }
    if (isSharedSideEffectGotoTailEffect(cur)) sideEffects += 1;
  }
  return null;
}

function isObjectOrArrayGetStatic(insn) {
  const descriptor = fieldDescriptor(insn);
  return op(insn) === 'getstatic' &&
    typeof descriptor === 'string' &&
    (descriptor.startsWith('L') || descriptor.startsWith('['));
}

function cloneSharedIntGuardedSideEffectTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_INT_GUARDED_SIDE_EFFECT_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_INT_GUARDED_SIDE_EFFECT_TAIL_MAX_INSNS || 24);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_INT_GUARDED_SIDE_EFFECT_TAIL_MAX_REFS || 8);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSIGSE_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRefs) continue;
    const tail = readSharedIntGuardedSideEffectTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (rangeHasExternalLabelRefsInside(codeItems, target, tail.end)) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedIntGuardedSideEffectTail(codeItems, currentTarget, maxInsns);
      if (!currentTail) continue;
      const changed = cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        currentTarget,
        currentTail.end,
        currentTail.exitLabel,
        'LCKSIGSE',
      );
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target += Math.max(0, tail.end - target);
  }
  return rewrites;
}

function readSharedIntGuardedSideEffectTail(codeItems, start, maxInsns) {
  const first = codeItems[start] && codeItems[start].instruction;
  if (op(first) !== 'getstatic' || !isIntLikeFieldDescriptor(fieldDescriptor(first))) return null;
  let instructions = 0;
  let conditionalBranches = 0;
  let sideEffects = 0;
  let exitLabel = null;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'tableswitch' || cur === 'lookupswitch' || isReturnOp(cur) || cur === 'athrow' || localStore(insn)) return null;
    if (cur === 'goto') {
      const label = labelName(insn.arg);
      const dest = findLabelIndex(codeItems, label);
      if (!label || dest <= i || (exitLabel && label !== exitLabel)) return null;
      return sideEffects >= 1 && conditionalBranches >= 2 ? { end: i, exitLabel: label } : null;
    }
    if (isConditionalBranch(cur)) {
      const labels = collectInstructionLabels(insn).map(labelName).filter(Boolean);
      if (labels.length !== 1) return null;
      const label = labels[0];
      const dest = findLabelIndex(codeItems, label);
      if (dest <= i) return null;
      if (!exitLabel) exitLabel = label;
      else if (label !== exitLabel) return null;
      conditionalBranches += 1;
      continue;
    }
    if (isSharedSideEffectGotoTailEffect(cur)) sideEffects += 1;
  }
  return null;
}

function cloneSharedNullFieldInvokeContinuations(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_NULL_FIELD_INVOKE_CONTINUATION_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_NULL_FIELD_INVOKE_CONTINUATION_MAX_INSNS || 12);

  for (let branch = 3; branch < codeItems.length && rewrites < maxRewrites; branch += 1) {
    const insn = codeItems[branch] && codeItems[branch].instruction;
    if (op(insn) !== 'if_acmpne') continue;
    if (op(codeItems[branch - 3] && codeItems[branch - 3].instruction) !== 'aconst_null') continue;
    if (op(codeItems[branch - 2] && codeItems[branch - 2].instruction) !== 'aload_0') continue;
    const comparedField = codeItems[branch - 1] && codeItems[branch - 1].instruction;
    if (op(comparedField) !== 'getfield') continue;
    const target = findLabelIndex(codeItems, insn.arg);
    const fallthrough = nextInstructionIndex(codeItems, branch + 1);
    if (target <= branch || fallthrough < 0 || fallthrough >= target) continue;
    const targetShape = readSharedNullFieldInvokeContinuation(codeItems, target, maxInsns);
    if (!targetShape) continue;
    if (!sameFieldRef(fieldRef(comparedField), targetShape.field)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, targetShape.end)) continue;
    if (rangeHasExternalLabelRefsInside(codeItems, target, targetShape.end)) continue;
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branch,
      target,
      targetShape.end,
      targetShape.exitLabel,
      'LCKNFIC',
    );
    if (changed) {
      rewrites += changed;
      branch += targetShape.end - target;
    }
  }
  return rewrites;
}

function readSharedNullFieldInvokeContinuation(codeItems, start, maxInsns) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'aload_0') return null;
  const read = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (op(read) !== 'getfield' || !fieldDescriptor(read) || fieldDescriptor(read)[0] !== 'L') return null;
  let instructions = 0;
  let invokeIndex = -1;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'goto') {
      const exitLabel = labelName(insn.arg);
      const exitIndex = findLabelIndex(codeItems, exitLabel);
      if (invokeIndex < start || !exitLabel || exitIndex <= i) return null;
      return { end: i, exitLabel, field: fieldRef(read) };
    }
    if (isConditionalBranch(cur) || cur === 'tableswitch' || cur === 'lookupswitch' ||
      isReturnOp(cur) || cur === 'athrow' || localStore(insn) || cur === 'putfield' || cur === 'putstatic') {
      return null;
    }
    if (isInvokeInstruction(insn)) {
      if (invokeIndex >= 0) return null;
      invokeIndex = i;
    }
  }
  return null;
}

function rangeHasExternalLabelRefsInside(codeItems, start, end) {
  for (let i = start + 1; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    const refs = collectLabelReferencesDetailed(codeItems, label);
    if (refs.some((ref) => ref < start || ref >= end)) return true;
  }
  return false;
}

function readSharedStaticObjectClearTail(codeItems, start) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'aconst_null') return null;
  const first = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (!isPutStaticObjectDescriptor(first)) return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'aconst_null') return null;
  const second = codeItems[start + 3] && codeItems[start + 3].instruction;
  if (!isPutStaticObjectDescriptor(second)) return null;
  if (fieldDescriptor(first) !== fieldDescriptor(second)) return null;
  const jump = codeItems[start + 4] && codeItems[start + 4].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  const exitIndex = findLabelIndex(codeItems, exitLabel);
  if (!exitLabel || exitIndex <= start + 4) return null;
  return { end: start + 4, exitLabel, fields: [fieldRef(first), fieldRef(second)] };
}

function isNullStaticObjectCompareBranch(codeItems, branchIndex) {
  const cur = op(codeItems[branchIndex] && codeItems[branchIndex].instruction);
  if (cur !== 'if_acmpeq' && cur !== 'if_acmpne') return false;
  return !!nullStaticObjectCompareField(codeItems, branchIndex);
}

function nullStaticObjectCompareField(codeItems, branchIndex) {
  const left = codeItems[branchIndex - 2] && codeItems[branchIndex - 2].instruction;
  const right = codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction;
  if (op(left) === 'aconst_null' && op(right) === 'getstatic' && isObjectDescriptor(fieldDescriptor(right))) {
    return fieldRef(right);
  }
  if (op(right) === 'aconst_null' && op(left) === 'getstatic' && isObjectDescriptor(fieldDescriptor(left))) {
    return fieldRef(left);
  }
  return null;
}

function isObjectDescriptor(descriptor) {
  return typeof descriptor === 'string' && descriptor.startsWith('L');
}

function sameFieldRef(left, right) {
  return !!left && !!right && left.owner === right.owner && left.name === right.name && left.descriptor === right.descriptor;
}

function cloneSharedInstanceAssignmentTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_INSTANCE_ASSIGNMENT_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_INSTANCE_ASSIGNMENT_TAIL_MAX_INSNS || 10);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSINST_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)));
    if (refs.length !== 1) continue;
    if (!hasImmediateFallthroughPredecessor(codeItems, target)) continue;

    const tail = readSharedInstanceAssignmentTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (hasReferencedLabelsInside(codeItems, target + 1, tail.end - 1, collectLabelReferenceCounts(codeItems))) continue;

    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      refs[0],
      target,
      tail.end,
      tail.exitLabel,
      'LCKSINST',
    );
    if (changed) {
      rewrites += changed;
      target += Math.max(0, tail.end - target);
    }
  }
  return rewrites;
}

function readSharedInstanceAssignmentTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sawPutField = false;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (sawPutField && cur !== 'goto') {
      const exitLabel = ensureLabel(codeItems[i], 'LCKSINST_EXIT');
      return { end: i, exitLabel };
    }
    if (isConditionalBranch(cur) || cur === 'tableswitch' || cur === 'lookupswitch' ||
      isReturnOp(cur) || cur === 'athrow' || cur === 'putstatic' || (sawPutField && isInvokeInstruction(insn))) {
      return null;
    }
    if (cur === 'putfield') {
      if (sawPutField) return null;
      sawPutField = true;
      continue;
    }
    if (cur === 'goto') {
      const exitLabel = labelName(insn.arg);
      const exitIndex = findLabelIndex(codeItems, exitLabel);
      if (!sawPutField || !exitLabel || exitIndex <= i) return null;
      return { end: i, exitLabel };
    }
    if (sawPutField) return null;
    if (!isInstanceAssignmentTailStackOp(cur)) return null;
  }
  return null;
}

function isInstanceAssignmentTailStackOp(cur) {
  return cur === 'aload_0' || cur === 'aload_1' || cur === 'aload_2' || cur === 'aload_3' ||
    cur === 'aload' || cur === 'getfield' || cur === 'invokevirtual' || cur === 'invokeinterface' ||
    cur === 'invokestatic' || cur === 'invokespecial' || isStaticAssignmentTailStackOp(cur);
}

function readSharedStaticAssignmentTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sawPutStatic = false;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (isConditionalBranch(cur) || cur === 'tableswitch' || cur === 'lookupswitch' ||
      isReturnOp(cur) || cur === 'athrow' || cur === 'putfield' || isInvokeInstruction(insn)) {
      return null;
    }
    if (cur === 'putstatic') {
      if (sawPutStatic) return null;
      sawPutStatic = true;
      continue;
    }
    if (cur === 'goto') {
      const exitLabel = labelName(insn.arg);
      const exitIndex = findLabelIndex(codeItems, exitLabel);
      if (!sawPutStatic || !exitLabel || exitIndex <= i) return null;
      return { end: i, exitLabel };
    }
    if (sawPutStatic) return null;
    if (!isStaticAssignmentTailStackOp(cur)) return null;
  }
  return null;
}

function isStaticAssignmentTailStackOp(cur) {
  return cur === 'getstatic' ||
    cur === 'i2b' || cur === 'i2c' || cur === 'i2s' ||
    cur === 'iadd' || cur === 'isub' || cur === 'imul' || cur === 'idiv' || cur === 'irem' ||
    cur === 'iand' || cur === 'ior' || cur === 'ixor' || cur === 'ishl' || cur === 'ishr' || cur === 'iushr' ||
    cur === 'ldc_w' ||
    isIntegerConstant({ op: cur });
}

function cloneSharedBooleanStoreTargets(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_STORE_TARGET_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_STORE_TARGET_MAX_INSNS || 36);
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const cur = op(branch);
    if (!isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    const label = labelName(branch.arg);
    if (!label) continue;
    const refs = findBranchRefsToLabel(codeItems, label, Math.max(0, branchIndex - 80), target + 1);
    if (refs.length < 2) continue;
    const tail = readBooleanStoreTargetTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (tail.local == null || tail.end <= target) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, target, tail.end, 'LCKBOOLSTORE');
  }
  return rewrites;
}

function readBooleanStoreTargetTail(codeItems, start, maxInsns) {
  let sawConstant = false;
  let sawCompare = false;
  let sawGoto = false;
  let instructions = 0;
  for (let i = start; i < codeItems.length && instructions < maxInsns; i += 1) {
    const item = codeItems[i];
    const insn = item && item.instruction;
    if (!insn) continue;
    instructions += 1;
    const cur = op(insn);
    const storeLocal = intStoreLocal(insn);
    if (storeLocal != null) {
      return sawConstant && sawCompare && sawGoto ? { end: i + 1, local: storeLocal } : null;
    }
    if (cur === 'iconst_0' || cur === 'iconst_1') sawConstant = true;
    if (isConditionalBranch(cur)) {
      const target = findLabelIndex(codeItems, insn.arg);
      if (target < start || target <= i) return null;
      sawCompare = true;
      continue;
    }
    if (cur === 'goto') {
      const target = findLabelIndex(codeItems, insn.arg);
      if (target < start || target <= i) return null;
      sawGoto = true;
      continue;
    }
    if (!isBooleanStoreTargetStackOp(cur, insn)) return null;
  }
  return null;
}

function isBooleanStoreTargetStackOp(cur, insn) {
  return cur === 'aload_0' ||
    cur === 'getstatic' ||
    cur === 'getfield' ||
    cur === 'invokestatic' ||
    cur === 'iconst_2' ||
    cur === 'iconst_3' ||
    cur === 'iconst_4' ||
    cur === 'iconst_5' ||
    cur === 'bipush' ||
    cur === 'sipush' ||
    cur === 'ldc' ||
    cur === 'ldc_w' ||
    cur === 'ixor' ||
    cur === 'lshl' ||
    cur === 'l2i' ||
    intLoadLocal(insn) != null ||
    integerConstantValue(insn) != null;
}

function cloneGotoRangeAtWithFallthroughGoto(codeItems, code, gotoIndex, start, end, exitLabel, prefix) {
  if (start < 0 || end <= start || gotoIndex < 0 || gotoIndex >= codeItems.length) return 0;
  const cleanExit = labelName(exitLabel);
  if (!cleanExit) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
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
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
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
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 1; i < codeItems.length && rewrites < 1; i += 1) {
    const load = codeItems[i - 1] && codeItems[i - 1].instruction;
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifnonnull') continue;
    const local = refLoadLocal(load);
    if (local == null) continue;
    const targetLabel = labelName(branch.arg);
    if ((refCounts.get(targetLabel) || 0) < 2) continue;
    const target = findLabelIndex(codeItems, targetLabel);
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





function cloneBucketArrayInitTail(codeItems, code) {
  for (let i = 4; i + 1 < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    if (!looksLikeBucketArrayInit(codeItems, target)) continue;
    if (op(codeItems[i - 1] && codeItems[i - 1].instruction) !== 'if_icmpgt') continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'goto') continue;
    if (op(codeItems[i - 3] && codeItems[i - 3].instruction) !== 'if_icmpgt') continue;
    if (op(codeItems[i - 4] && codeItems[i - 4].instruction) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 5] && codeItems[i - 5].instruction) !== 63) continue;
    const fallthroughExit = findBucketInitFallthrough(codeItems, target);
    if (fallthroughExit <= target) return 0;
    const exitLabel = labelName(codeItems[fallthroughExit] && codeItems[fallthroughExit].labelDef);
    if (!exitLabel) return 0;
    return cloneGotoRangeAtWithFallthroughGoto(codeItems, code, i, target, fallthroughExit, exitLabel, 'LCKBUCKET');
  }
  return 0;
}

function looksLikeBucketArrayInit(codeItems, start) {
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

function findBucketInitFallthrough(codeItems, start) {
  for (let i = start; i + 2 < Math.min(codeItems.length, start + 80); i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'ifeq') continue;
    const target = findLabelIndex(codeItems, codeItems[i].instruction.arg);
    if (target < 0 || target >= i) continue;
    const next = nextInstructionIndex(codeItems, i + 1);
    if (next > i) return next;
  }
  return -1;
}

function cloneObjectSharedReturnTail(codeItems, code) {
  const tailStart = findObjectSharedReturnTailStart(codeItems);
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
      rewrites += cloneGotoRangeAt(codeItems, code, refIndex, tailStart, tailEnd, 'LCKOBJRET');
      continue;
    }
    if (!isConditionalBranch(cur)) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, refIndex, tailStart, tailEnd, 'LCKOBJRET');
  }
  return rewrites;
}

function cloneSharedTerminalTails(codeItems, code) {
  if (Array.isArray(code && code.exceptionTable) && code.exceptionTable.length > 0) return 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_TERMINAL_TAIL_MAX_REWRITES || 4);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_TERMINAL_TAIL_MAX_INSNS || 3);
  const refCounts = collectLabelReferenceCounts(codeItems);
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 0 && rewrites < maxRewrites; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || (refCounts.get(targetLabel) || 0) < 1) continue;
    const tail = readBoundedTerminalRegion(codeItems, target, maxInsns);
    if (!tail) continue;
    const clone = cloneItems(codeItems.slice(target, tail.end));
    rewriteFirstLabel(clone, labelName(codeItems[i].labelDef) || null);
    codeItems.splice(i, 1, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function findObjectSharedReturnTailStart(codeItems) {
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

function cloneEntityLoopContinuation(codeItems, code) {
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
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, i, target, target + 1, 'LCKENTITYCONT');
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
  renameInternalLabels(clonedTail, `${prefix}_${structuredCloneId++}_`);
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

function hasNestedArrayScanInnerContinueCandidate(codeItems) {
  return findNestedArrayScanInnerContinueUse(codeItems) != null;
}

function hasNestedArrayScanPostMatchTailCandidate(codeItems) {
  return findNestedArrayScanPostMatchTailUse(codeItems) != null;
}

function cloneNestedArrayScanInnerContinueTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_NESTED_ARRAY_SCAN_INNER_CONTINUE_MAX_REWRITES || 8);
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < maxRewrites; searchStart += 1) {
    const use = findNestedArrayScanInnerContinueUse(codeItems, searchStart);
    if (!use) break;
    if (rangeTouchesExceptionTable(code, codeItems, use.tailStart, use.tailEnd)) {
      searchStart = use.branchIndex + 1;
      continue;
    }
    const clone = cloneItems(codeItems.slice(use.tailStart, use.tailEnd));
    renameInternalLabels(clone, `LCKNAIC_${rewrites}_`);
    const cloneEntry = freshLabel(codeItems, 'LCKNAIC');
    clone[0].labelDef = `${cloneEntry}:`;
    codeItems[use.branchIndex].instruction.arg = cloneEntry;
    codeItems.splice(use.branchIndex + 1, 0, ...clone);
    rewrites += 1;
    searchStart = use.branchIndex + clone.length;
  }
  return rewrites;
}

function cloneNestedArrayScanPostMatchTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_NESTED_ARRAY_SCAN_POST_MATCH_TAIL_MAX_REWRITES || 4);
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < maxRewrites; searchStart += 1) {
    const use = findNestedArrayScanPostMatchTailUse(codeItems, searchStart);
    if (!use) break;
    if (rangeTouchesExceptionTable(code, codeItems, use.tailStart, use.tailEnd)) {
      searchStart = use.tailStart + 1;
      continue;
    }
    const refs = use.refs.slice().sort((a, b) => b - a);
    for (const ref of refs) {
      const jump = codeItems[ref] && codeItems[ref].instruction;
      if (op(jump) !== 'goto' || labelName(jump.arg) !== use.tailLabel) continue;
      const clone = cloneItems(codeItems.slice(use.tailStart, use.tailEnd));
      renameInternalLabels(clone, `LCKNASPM_${rewrites}_`);
      if (codeItems[ref].labelDef) clone[0].labelDef = codeItems[ref].labelDef;
      else delete clone[0].labelDef;
      codeItems.splice(ref, 1, ...clone);
      rewrites += 1;
      if (rewrites >= maxRewrites) break;
    }
    searchStart = use.tailStart + 1;
  }
  return rewrites;
}

function findNestedArrayScanPostMatchTailUse(codeItems, searchStart = 0) {
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let tail = Math.max(1, searchStart); tail < codeItems.length; tail += 1) {
    const tailLabel = labelName(codeItems[tail] && codeItems[tail].labelDef);
    if (!tailLabel || String(tailLabel).startsWith('LCKNASPM')) continue;
    const indexes = nextInstructionIndexes(codeItems, tail, 7);
    if (indexes.length < 7) continue;
    const flagLocal = intLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction);
    const branch = codeItems[indexes[1]] && codeItems[indexes[1]].instruction;
    if (flagLocal == null || op(branch) !== 'ifne') continue;
    const falseInc = readIincInstruction(codeItems[indexes[2]] && codeItems[indexes[2]].instruction);
    const falseJump = codeItems[indexes[3]] && codeItems[indexes[3]].instruction;
    if (!falseInc || falseInc.incr !== 1 || op(falseJump) !== 'goto') continue;
    const trueStart = findLabelIndex(codeItems, branch.arg);
    if (trueStart !== indexes[4]) continue;
    const trueCounterInc = readIincInstruction(codeItems[indexes[4]] && codeItems[indexes[4]].instruction);
    const trueInnerInc = readIincInstruction(codeItems[indexes[5]] && codeItems[indexes[5]].instruction);
    const trueJump = codeItems[indexes[6]] && codeItems[indexes[6]].instruction;
    if (!trueCounterInc || trueCounterInc.incr !== 1) continue;
    if (!trueInnerInc || trueInnerInc.incr !== 1 || trueInnerInc.local !== falseInc.local) continue;
    if (op(trueJump) !== 'goto' || labelName(trueJump.arg) !== labelName(falseJump.arg)) continue;
    const innerHeader = findLabelIndex(codeItems, falseJump.arg);
    if (innerHeader < 0 || innerHeader >= tail || !looksLikeLoopHeader(codeItems, innerHeader)) continue;
    if (!rangeHasSiblingNestedByteScanFacts(codeItems, Math.max(0, innerHeader - 220), tail, falseInc.local, trueCounterInc.local)) continue;
    const refs = (refsByLabel.get(tailLabel) || [])
      .filter((idx) => idx < tail && op(codeItems[idx] && codeItems[idx].instruction) === 'goto')
      .filter((idx) => previousNonNopIincLocal(codeItems, idx) === trueCounterInc.local);
    if (refs.length === 0 || refs.length > 4) continue;
    return { tailStart: tail, tailEnd: indexes[6] + 1, tailLabel, refs };
  }
  return null;
}

function previousNonNopIincLocal(codeItems, before) {
  for (let i = before - 1; i >= 0 && i >= before - 5; i -= 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'nop') continue;
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    return inc && inc.incr === 1 ? inc.local : null;
  }
  return null;
}

function rangeHasSiblingNestedByteScanFacts(codeItems, start, end, innerLocal, counterLocal) {
  let byteArrayLoads = 0;
  let innerStores = 0;
  let counterIncrements = 0;
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'baload') byteArrayLoads += 1;
    if (intStoreLocal(codeItems[i] && codeItems[i].instruction) === innerLocal) innerStores += 1;
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (inc && inc.local === counterLocal && inc.incr === 1) counterIncrements += 1;
  }
  return byteArrayLoads >= 2 && innerStores >= 1 && counterIncrements >= 1;
}

function findNestedArrayScanInnerContinueUse(codeItems, searchStart = 0) {
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = Math.max(8, searchStart); i + 3 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    if (!isByteArrayMembershipCompareAt(codeItems, i)) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart < 0 || tailStart === i) continue;
    const tailLabel = labelName(branch.arg);
    if ((refCounts.get(tailLabel) || 0) < 2) continue;
    const innerInc = readIincInstruction(codeItems[tailStart] && codeItems[tailStart].instruction);
    if (!innerInc || innerInc.incr !== 2) continue;
    const innerBackedge = codeItems[tailStart + 1] && codeItems[tailStart + 1].instruction;
    if (op(innerBackedge) !== 'goto') continue;
    const innerHeader = findLabelIndex(codeItems, innerBackedge.arg);
    if (innerHeader < 0 || innerHeader >= tailStart || !looksLikeLoopHeader(codeItems, innerHeader)) continue;

    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;
    const outerInc = readIincInstruction(codeItems[fallthrough] && codeItems[fallthrough].instruction);
    if (!outerInc || outerInc.incr !== 1 || outerInc.local === innerInc.local) continue;
    const outerBackedge = codeItems[fallthrough + 1] && codeItems[fallthrough + 1].instruction;
    if (op(outerBackedge) !== 'goto') continue;
    const outerHeader = findLabelIndex(codeItems, outerBackedge.arg);
    if (outerHeader < 0 || outerHeader >= fallthrough || !looksLikeLoopHeader(codeItems, outerHeader)) continue;
    if (!rangeHasNestedArrayPairScanFacts(codeItems, Math.max(0, outerHeader), tailStart, innerInc.local, outerInc.local)) continue;
    return { branchIndex: i, tailStart, tailEnd: tailStart + 2, innerLocal: innerInc.local, outerLocal: outerInc.local };
  }
  return null;
}

function isByteArrayMembershipCompareAt(codeItems, branchIndex) {
  const valueLoad = intLoadLocal(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction);
  const indexLoad = intLoadLocal(codeItems[branchIndex - 4] && codeItems[branchIndex - 4].instruction);
  if (valueLoad == null || indexLoad == null) return false;
  if (integerConstantValue(codeItems[branchIndex - 7] && codeItems[branchIndex - 7].instruction) === 255 &&
    op(codeItems[branchIndex - 6] && codeItems[branchIndex - 6].instruction) === 'getstatic' &&
    isFieldWithDescriptor(codeItems[branchIndex - 5] && codeItems[branchIndex - 5].instruction, 'getfield', '[B') &&
    op(codeItems[branchIndex - 3] && codeItems[branchIndex - 3].instruction) === 'baload' &&
    op(codeItems[branchIndex - 2] && codeItems[branchIndex - 2].instruction) === 'iand') {
    return true;
  }
  return integerConstantValue(codeItems[branchIndex - 6] && codeItems[branchIndex - 6].instruction) === 255 &&
    isFieldWithDescriptor(codeItems[branchIndex - 5] && codeItems[branchIndex - 5].instruction, 'getstatic', '[B') &&
    op(codeItems[branchIndex - 3] && codeItems[branchIndex - 3].instruction) === 'baload' &&
    op(codeItems[branchIndex - 2] && codeItems[branchIndex - 2].instruction) === 'iand';
}

function rangeHasNestedArrayPairScanFacts(codeItems, start, end, innerLocal, outerLocal) {
  let sawOuterArrayLoad = false;
  let sawInnerArrayLength = false;
  let sawInnerPairValueLoad = false;
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (cur === 'aaload' && intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) === outerLocal) {
      sawOuterArrayLoad = true;
    }
    if (cur === 'arraylength' && intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction) === innerLocal) {
      sawInnerArrayLength = true;
    }
    if (cur === 'iaload' && intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) === innerLocal) {
      sawInnerPairValueLoad = true;
    }
  }
  return sawOuterArrayLoad && sawInnerArrayLength && sawInnerPairValueLoad;
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
  return findSharedRenderContinuation(codeItems) != null ||
    findSharedRenderZeroInvokeTail(codeItems) != null ||
    findSharedTextRenderExitTail(codeItems) != null;
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
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < 16; searchStart += 1) {
    const tail = findSharedTextRenderExitTail(codeItems, searchStart);
    if (!tail) break;
    const refs = ((collectLabelReferencesByLabel(codeItems).get(tail.startLabel) || []).filter((idx) => idx < tail.start))
      .filter((idx) => isConditionalBranch(op(codeItems[idx] && codeItems[idx].instruction)))
      .sort((a, b) => b - a);
    for (const refIndex of refs) {
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems, code, refIndex, tail.start, tail.end, tail.exitLabel, 'LCKSRTXT');
      if (rewrites >= 16) break;
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

function findSharedTextRenderExitTail(codeItems, searchStart = 0) {
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let start = Math.max(0, searchStart); start + 8 < codeItems.length; start += 1) {
    const startLabel = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!startLabel || String(startLabel).startsWith('LCKSRTXT_')) continue;
    const tail = readSharedTextRenderExitTail(codeItems, start);
    if (!tail) continue;
    const refs = refsByLabel.get(startLabel) || [];
    if (refs.length < 2 || !refs.some((idx) => idx < start && isConditionalBranch(op(codeItems[idx] && codeItems[idx].instruction)))) continue;
    return { ...tail, start, startLabel };
  }
  return null;
}

function readSharedTextRenderExitTail(codeItems, start) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'getstatic') return null;
  if (!isStringProducerInstruction(codeItems[start + 1] && codeItems[start + 1].instruction)) return null;
  const invoke = codeItems[start + 7] && codeItems[start + 7].instruction;
  if (!isInvokeDescriptor(invoke, '(Ljava/lang/String;IIIII)V')) return null;
  const jump = codeItems[start + 8] && codeItems[start + 8].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  const exit = findLabelIndex(codeItems, exitLabel);
  if (exit <= start + 8) return null;
  return { end: start + 8, exit, exitLabel };
}

function isStringProducerInstruction(insn) {
  if (isGetStaticDescriptor(insn, 'Ljava/lang/String;')) return true;
  const local = refLoadLocal(insn);
  return local != null;
}

function cloneMenuLoopContinuations(codeItems, code) {
  let rewrites = 0;
  rewrites += cloneMenuFirstItemTail(codeItems, code);
  rewrites += cloneMenuSecondRelatedLoop(codeItems, code);
  return rewrites;
}

function retargetDetachedRasterBlurLoopHeader(codeItems) {
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

function retargetEventDrainLoopEntry(codeItems) {
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

    const replacement = findCanonicalEventDrainHeader(codeItems, oldHeader + 1, local);
    if (replacement <= oldHeader) continue;
    const replacementLabel = labelName(codeItems[replacement] && codeItems[replacement].labelDef);
    if (!replacementLabel) continue;
    jump.arg = replacementLabel;
    rewrites += 1;
    break;
  }
  return rewrites;
}

function materializeStackFlagCompares(codeItems, code) {
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

function cloneQueueLoopBodyEntries(codeItems, code) {
  if (!hasStaticBooleanLoad(codeItems)) return 0;
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 4 && rewrites < 4; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i || !looksLikeQueueBodyEntry(codeItems, target)) continue;
    const end = findQueueBodyContinuation(codeItems, target);
    if (end <= target || end - target > 220) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, end)) continue;

    const clone = cloneItems(codeItems.slice(target, end));
    renameInternalLabels(clone, `LCKACEQ_${rewrites}_`);
    specializeQueueBodyCloneForFlagTrue(clone);
    const cloneLabel = labelName(clone[0] && clone[0].labelDef);
    if (!cloneLabel) continue;
    jump.arg = cloneLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function cloneQueueFlagTrueEntryTrampolines(codeItems, code) {
  if (!hasStaticBooleanLoad(codeItems)) return 0;
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 4 && rewrites < 4; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i || op(codeItems[target] && codeItems[target].instruction) !== 'iconst_0') continue;
    if (!looksLikeQueueBodyEntry(codeItems, target)) continue;
    const plan = readFlagTrueEntryPlan(codeItems, target);
    if (!plan) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, plan.compareIndex + 1)) continue;

    const cleanupEnd = findFlagTrueCleanupEnd(codeItems, plan.fallthroughIndex);
    if (cleanupEnd <= plan.fallthroughIndex || cleanupEnd - plan.fallthroughIndex > 90) continue;
    const clone = [
      ...cloneItems(codeItems.slice(target, plan.flagLoadIndex)),
      ...cloneItems(codeItems.slice(plan.trueIndex, plan.compareIndex + 1)),
      ...cloneItems(codeItems.slice(plan.fallthroughIndex, cleanupEnd)),
    ];
    renameInternalLabels(clone, `LCKACEFT_${rewrites}_`);
    specializeQueueBodyCloneForFlagTrue(clone);
    const cloneLabel = labelName(clone[0] && clone[0].labelDef);
    if (!cloneLabel) continue;
    jump.arg = cloneLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function findFlagTrueCleanupEnd(codeItems, start) {
  for (let i = start; i + 2 < Math.min(codeItems.length, start + 90); i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 5) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'ifeq') continue;
    if (isReturnOp(op(codeItems[i + 2] && codeItems[i + 2].instruction))) return i + 3;
  }
  return -1;
}

function readFlagTrueEntryPlan(codeItems, start) {
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

function looksLikeQueueBodyEntry(codeItems, start) {
  const offset = op(codeItems[start] && codeItems[start].instruction) === 'iconst_0' ? 1 : 0;
  return op(codeItems[start + offset] && codeItems[start + offset].instruction) === 'aload_0' &&
    isGetFieldReferenceDescriptor(codeItems[start + offset + 1] && codeItems[start + offset + 1].instruction) &&
    isGetFieldDescriptor(codeItems[start + offset + 2] && codeItems[start + offset + 2].instruction, '[I') &&
    op(codeItems[start + offset + 3] && codeItems[start + offset + 3].instruction) === 'aload_0' &&
    isGetFieldDescriptor(codeItems[start + offset + 4] && codeItems[start + offset + 4].instruction, 'I') &&
    op(codeItems[start + offset + 5] && codeItems[start + offset + 5].instruction) === 'iaload';
}

function findQueueBodyContinuation(codeItems, start) {
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

function specializeQueueBodyCloneForFlagTrue(items) {
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

function cloneBackwardContinueTails(codeItems, code) {
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
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKBASE38DECKCONTF_${rewrites}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKBASE38DECKCONT_${rewrites}_`);
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

function findCanonicalEventDrainHeader(codeItems, start, local) {
  for (let header = start; header + 40 < codeItems.length; header += 1) {
    const headerLabel = labelName(codeItems[header] && codeItems[header].labelDef);
    if (!headerLabel) continue;
    if (refLoadLocal(codeItems[header] && codeItems[header].instruction) !== local) continue;
    if (op(codeItems[header + 1] && codeItems[header + 1].instruction) !== 'ifnonnull') continue;
    if (!looksLikeEventDrainHeader(codeItems, header, local, headerLabel)) continue;
    return header;
  }
  return -1;
}

function looksLikeEventDrainHeader(codeItems, header, local, headerLabel) {
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

function cloneMenuFirstItemTail(codeItems, code) {
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
    const end = findItemRenderTailEnd(codeItems, target);
    if (end <= target) return 0;
    return cloneConditionalRangeAfterBranch(codeItems, code, i, target, end, 'LCKMENUITEM');
  }
  return 0;
}

function findItemRenderTailEnd(codeItems, start) {
  for (let i = start; i + 3 < Math.min(codeItems.length, start + 360); i += 1) {
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.local !== 13 || inc.incr !== 1) continue;
    if (intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction) !== 26) continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'ifeq') continue;
    return i + 3;
  }
  return -1;
}

function cloneMenuSecondRelatedLoop(codeItems, code) {
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= i) continue;
    if (!looksLikeRelatedEntityLoopStart(codeItems, target, 47, 46, 51, 52, 53)) continue;
    const end = findReturnTailEnd(codeItems, target, 460);
    if (end <= target) return 0;
    return cloneGotoRangeAt(codeItems, code, i, target, end, 'LCKMENULOOP');
  }
  return 0;
}

function looksLikeRelatedEntityLoopStart(codeItems, start, rsbLocal, qsaLocal, sgLocal, stringLocal, compareSgLocal) {
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
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}


function removeDuplicateCardLoopGoto(codeItems) {
  let rewrites = 0;
  for (let gotoIndex = 2; gotoIndex + 4 < codeItems.length && rewrites < 1; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    const fallthrough = nextInstructionIndex(codeItems, gotoIndex + 1);
    if (fallthrough !== gotoIndex + 1 || target <= fallthrough) continue;
    if (!looksLikeCardLoop(codeItems, fallthrough)) continue;
    if (!looksLikeCardLoop(codeItems, target)) continue;
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



function removeAnyStaticZeroFlagLocalBranches(codeItems) {
  const candidate = findStaticZeroFlagLocalBinding(codeItems);
  return candidate
    ? removeStaticZeroFlagLocalBranches(codeItems, candidate.owner, candidate.name)
    : 0;
}

function removeAlternateStaticZeroFlagLocalBranches(codeItems) {
  return removeAnyStaticZeroFlagLocalBranches(codeItems);
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

function removeStaticIntLoopFlagBranches(codeItems, method) {
  if (!looksLikeOneIntInstanceUpdateMethod(method)) return 0;
  if (!hasIntegerGuardDividePrologue(codeItems)) return 0;
  const candidate = findStaticIntLoopFlagBinding(codeItems);
  if (!candidate) return 0;
  return removeStaticZeroFlagLocalBranches(codeItems, candidate.owner, candidate.name);
}

function looksLikeOneIntInstanceUpdateMethod(method) {
  const access = Array.isArray(method && method.access) ? method.access : [];
  return method && method.name === 'h' && method.descriptor === '(I)V' && !access.includes('static');
}

function hasIntegerGuardDividePrologue(codeItems) {
  for (let i = 0; i + 8 < Math.min(codeItems.length, 24); i += 1) {
    if (integerConstantValue(codeItems[i] && codeItems[i].instruction) !== -74) continue;
    if (integerConstantValue(codeItems[i + 1] && codeItems[i + 1].instruction) !== 29) continue;
    if (intLoadLocal(codeItems[i + 2] && codeItems[i + 2].instruction) == null) continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'isub') continue;
    if (integerConstantValue(codeItems[i + 4] && codeItems[i + 4].instruction) !== 44) continue;
    if (op(codeItems[i + 5] && codeItems[i + 5].instruction) !== 'idiv') continue;
    if (op(codeItems[i + 6] && codeItems[i + 6].instruction) !== 'idiv') continue;
    if (intStoreLocal(codeItems[i + 7] && codeItems[i + 7].instruction) != null) return true;
  }
  return false;
}

function findStaticIntLoopFlagBinding(codeItems) {
  const minBranches = Number(process.env.STRUCTURED_GOTO_STATIC_INT_LOOP_FLAG_MIN_BRANCHES || 3);
  const binding = findStaticZeroFlagLocalBinding(codeItems);
  if (!binding) return null;
  const get = codeItems[binding.getIndex] && codeItems[binding.getIndex].instruction;
  const field = staticFieldRef(get);
  if (!field || field.descriptor !== 'I') return null;

  let branches = 0;
  let ifne = 0;
  let ifeq = 0;
  for (let index = binding.storeIndex + 1; index + 1 < codeItems.length; index += 1) {
    const insn = codeItems[index] && codeItems[index].instruction;
    if (writesLocal(insn, binding.local)) break;
    if (intLoadLocal(insn) !== binding.local) continue;
    const branchIndex = nextInstructionIndex(codeItems, index + 1);
    if (branchIndex !== index + 1) return null;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const cur = op(branch);
    if (cur !== 'ifne' && cur !== 'ifeq') return null;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target < 0 || target === branchIndex) return null;
    branches += 1;
    if (cur === 'ifne') ifne += 1;
    else ifeq += 1;
  }
  if (branches < minBranches || ifne === 0 || ifeq === 0) return null;
  if (!looksLikeStaticIntGridLoopFlagMethod(codeItems)) return null;
  return { ...binding, ...field };
}

function looksLikeStaticIntGridLoopFlagMethod(codeItems) {
  if (!hasEarlyStaticIntGridWidthLoad(codeItems)) return false;
  let staticInt2dLoads = 0;
  let arrayLoads = 0;
  let arrayStores = 0;
  let negations = 0;
  let randomIntCalls = 0;
  for (const item of codeItems) {
    const insn = item && item.instruction;
    const cur = op(insn);
    if (isGetStaticDescriptor(insn, '[[I')) staticInt2dLoads += 1;
    if (cur === 'aaload' || cur === 'iaload') arrayLoads += 1;
    if (cur === 'iastore') arrayStores += 1;
    if (cur === 'ineg') negations += 1;
    if (isInvokeDescriptor(insn, '(IZLjava/util/Random;)I')) randomIntCalls += 1;
  }
  return staticInt2dLoads >= 4 &&
    arrayLoads >= 8 &&
    arrayStores >= 4 &&
    negations >= 2 &&
    randomIntCalls >= 2;
}

function hasEarlyStaticIntGridWidthLoad(codeItems) {
  for (let i = 0; i + 4 < Math.min(codeItems.length, 60); i += 1) {
    if (!isGetStaticDescriptor(codeItems[i] && codeItems[i].instruction, '[[I')) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'iconst_0') continue;
    if (op(codeItems[i + 2] && codeItems[i + 2].instruction) !== 'aaload') continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'arraylength') continue;
    if (intStoreLocal(codeItems[i + 4] && codeItems[i + 4].instruction) != null) return true;
  }
  return false;
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
    const field = staticFieldRef(get);
    return {
      local,
      getIndex: index,
      storeIndex,
      owner: field && field.owner,
      name: field && field.name,
    };
  }
  return null;
}

function staticFieldRef(insn) {
  if (!isGetStaticDescriptor(insn, 'I')) return null;
  const arg = insn && insn.arg;
  if (!Array.isArray(arg) || !Array.isArray(arg[2])) return null;
  return { owner: arg[1], name: arg[2][0], descriptor: arg[2][1] };
}

function cloneRasterTopClipScanlineEntries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_RASTER_TOP_CLIP_SCANLINE_ENTRY_MAX_REWRITES || 2);
  const maxRange = Number(process.env.STRUCTURED_GOTO_RASTER_TOP_CLIP_SCANLINE_ENTRY_MAX_RANGE || 360);
  for (let i = 0; i + 8 < codeItems.length && rewrites < maxRewrites; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'iconst_0') continue;
    const rowLocal = intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction);
    if (rowLocal == null) continue;
    const branch = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (op(branch) !== 'if_icmpgt') continue;
    const gotoIndex = nextInstructionIndex(codeItems, i + 3);
    if (gotoIndex !== i + 3 || op(codeItems[gotoIndex] && codeItems[gotoIndex].instruction) !== 'goto') continue;
    const clipStart = findLabelIndex(codeItems, branch.arg);
    const scanlineStart = findLabelIndex(codeItems, codeItems[gotoIndex].instruction.arg);
    if (clipStart <= gotoIndex || scanlineStart <= clipStart || scanlineStart - gotoIndex > maxRange) continue;
    const shape = readRasterTopClipScanlineLoop(codeItems, scanlineStart, rowLocal);
    if (!shape || shape.end - scanlineStart > maxRange) continue;
    if (!hasTopClipAdjustmentBeforeScanline(codeItems, clipStart, scanlineStart, rowLocal)) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, scanlineStart, shape.end, 'LCKTOPCLIP');
  }
  return rewrites;
}

function retargetDuplicateGridScanContinues(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_GRID_SCAN_CONTINUE_MAX_REWRITES || 4);
  const maxRange = Number(process.env.STRUCTURED_GOTO_DUPLICATE_GRID_SCAN_CONTINUE_MAX_RANGE || 260);
  for (let first = 0; first + 3 < codeItems.length && rewrites < maxRewrites; first += 1) {
    const firstHeader = readLocalCompareHeader(codeItems, first);
    if (!firstHeader) continue;
    const firstLabel = labelName(codeItems[first] && codeItems[first].labelDef);
    if (!firstLabel) continue;
    for (let second = first + 4; second < Math.min(codeItems.length, first + maxRange); second += 1) {
      const secondHeader = readLocalCompareHeader(codeItems, second);
      if (!secondHeader) continue;
      if (secondHeader.leftLocal !== firstHeader.leftLocal || secondHeader.rightLocal !== firstHeader.rightLocal) continue;
      if (secondHeader.branchOp !== firstHeader.branchOp) continue;
      if (rangeTouchesExceptionTable(code, codeItems, first, second + 3)) continue;
      const secondLabel = labelName(codeItems[second] && codeItems[second].labelDef);
      if (!secondLabel) continue;
      const refs = collectLabelReferencesByLabel(codeItems).get(secondLabel) || [];
      const continueRefs = refs.filter((ref) => {
        if (ref <= first || ref >= second) return false;
        if (op(codeItems[ref] && codeItems[ref].instruction) !== 'goto') return false;
        const inc = readIincInstruction(codeItems[ref - 1] && codeItems[ref - 1].instruction);
        return inc && inc.local === firstHeader.leftLocal && inc.incr === 1;
      });
      if (continueRefs.length < 2) continue;
      for (const ref of continueRefs) {
        codeItems[ref].instruction.arg = firstLabel;
        rewrites += 1;
        if (rewrites >= maxRewrites) break;
      }
      first = second;
      break;
    }
  }
  return rewrites;
}

function readLocalCompareHeader(codeItems, index) {
  const leftLocal = intLoadLocal(codeItems[index] && codeItems[index].instruction);
  if (leftLocal == null) return null;
  const rightLocal = intLoadLocal(codeItems[index + 1] && codeItems[index + 1].instruction);
  if (rightLocal == null) return null;
  const branch = codeItems[index + 2] && codeItems[index + 2].instruction;
  const branchOp = op(branch);
  if (!isConditionalBranch(branchOp)) return null;
  const target = findLabelIndex(codeItems, branch.arg);
  if (target <= index + 2) return null;
  return { leftLocal, rightLocal, branchOp, target };
}

function materializeIteratorProcessGuards(codeItems, code) {
  let rewrites = 0;
  if (process.env.STRUCTURED_GOTO_ITERATOR_PROCESS_GUARD_DEBUG === '1') {
    console.error(`iterator-process-guard scan len=${codeItems.length}`);
  }
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_ITERATOR_PROCESS_GUARD_MAX_REWRITES || 2);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const shape = readIteratorProcessGuardShape(codeItems, i);
    if (!shape) continue;
    if (rangeTouchesExceptionTable(code, codeItems, i, shape.processIndex)) continue;

    const tempLocal = chooseFreshIntLocal(codeItems, code);
    const checkStaticLabel = freshLabel(codeItems, 'LCKIPG_CHECK_STATIC');
    const checkObjectLabel = freshLabel(codeItems, 'LCKIPG_CHECK_OBJECT');
    const decideLabel = freshLabel(codeItems, 'LCKIPG_DECIDE');
    const processLabel = labelName(codeItems[shape.processIndex] && codeItems[shape.processIndex].labelDef) ||
      ensureFreshLabel(codeItems, shape.processIndex, 'LCKIPG_PROCESS');

    const nullLoad = cloneItems(codeItems.slice(i, shape.nullBranchIndex));
    const staticLoad = cloneItems(codeItems.slice(shape.staticLoadStart, shape.staticBranchIndex));
    const boolLoad = cloneItems(codeItems.slice(shape.boolLoadStart, shape.boolBranchIndex));
    const skipTail = cloneItems(codeItems.slice(shape.localSkipStart, shape.processIndex));
    for (const item of [...nullLoad, ...staticLoad, ...boolLoad, ...skipTail]) delete item.labelDef;

    const replacement = [
      { ...cloneItemMetadata(codeItems[i]), instruction: 'iconst_1' },
      { instruction: { op: 'istore', arg: String(tempLocal) } },
      { labelDef: `${checkStaticLabel}:`, instruction: nullLoad[0].instruction },
      ...nullLoad.slice(1),
      { instruction: { op: 'if_acmpne', arg: decideLabel } },
      ...staticLoad,
      { instruction: { op: 'ifne', arg: checkObjectLabel } },
      { instruction: 'iconst_0' },
      { instruction: { op: 'istore', arg: String(tempLocal) } },
      { instruction: { op: 'goto', arg: decideLabel } },
      { labelDef: `${checkObjectLabel}:`, instruction: boolLoad[0].instruction },
      ...boolLoad.slice(1),
      { instruction: { op: 'ifne', arg: decideLabel } },
      { instruction: 'iconst_0' },
      { instruction: { op: 'istore', arg: String(tempLocal) } },
      { labelDef: `${decideLabel}:`, instruction: { op: 'iload', arg: String(tempLocal) } },
      { instruction: { op: 'ifne', arg: processLabel } },
      ...skipTail,
    ];

    codeItems.splice(i, shape.processIndex - i, ...replacement);
    rewrites += 1;
    i += replacement.length;
  }
  return rewrites;
}

function readIteratorProcessGuardShape(codeItems, start) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'aconst_null') return null;
  const objectField = readReferenceFieldLoad(codeItems, start + 1, (descriptor) => isObjectDescriptor(descriptor));
  if (!objectField) return debugIteratorProcessGuardSkip(start, 'object-field');
  const nullBranchIndex = objectField.end;
  const nullBranch = codeItems[nullBranchIndex] && codeItems[nullBranchIndex].instruction;
  if (op(nullBranch) !== 'if_acmpne') return debugIteratorProcessGuardSkip(start, 'null-branch');
  const processIndex = findLabelIndex(codeItems, nullBranch.arg);
  if (processIndex <= nullBranchIndex) return debugIteratorProcessGuardSkip(start, 'process-index');

  const staticLoadStart = nextInstructionIndex(codeItems, nullBranchIndex + 1);
  if (staticLoadStart < 0 || op(codeItems[staticLoadStart] && codeItems[staticLoadStart].instruction) !== 'getstatic') return debugIteratorProcessGuardSkip(start, 'static-load');
  if (fieldDescriptor(codeItems[staticLoadStart] && codeItems[staticLoadStart].instruction) !== 'Z') return debugIteratorProcessGuardSkip(start, 'static-descriptor');
  const staticBranchIndex = nextInstructionIndex(codeItems, staticLoadStart + 1);
  const staticBranch = codeItems[staticBranchIndex] && codeItems[staticBranchIndex].instruction;
  if (op(staticBranch) !== 'ifeq') return debugIteratorProcessGuardSkip(start, 'static-branch');

  const boolLoadStart = nextInstructionIndex(codeItems, staticBranchIndex + 1);
  const boolField = readIntLikeReferenceFieldLoad(codeItems, boolLoadStart);
  if (!boolField || boolField.local !== objectField.local) return debugIteratorProcessGuardSkip(start, 'bool-field');
  const boolBranchIndex = boolField.end;
  const boolBranch = codeItems[boolBranchIndex] && codeItems[boolBranchIndex].instruction;
  if (op(boolBranch) !== 'ifne' || findLabelIndex(codeItems, boolBranch.arg) !== processIndex) return debugIteratorProcessGuardSkip(start, 'bool-branch');

  const localSkipStart = nextInstructionIndex(codeItems, boolBranchIndex + 1);
  const localSkip = readIteratorAdvanceSkipTail(codeItems, localSkipStart);
  if (!localSkip || localSkip.end !== processIndex) return debugIteratorProcessGuardSkip(start, 'local-skip');
  const staticSkipIndex = findLabelIndex(codeItems, staticBranch.arg);
  const staticSkip = readIteratorAdvanceSkipTail(codeItems, staticSkipIndex);
  if (!staticSkip || staticSkip.signature !== localSkip.signature) return debugIteratorProcessGuardSkip(start, 'static-skip');

  return {
    nullBranchIndex,
    staticLoadStart,
    staticBranchIndex,
    boolLoadStart,
    boolBranchIndex,
    localSkipStart,
    processIndex,
  };
}

function debugIteratorProcessGuardSkip(start, reason) {
  if (process.env.STRUCTURED_GOTO_ITERATOR_PROCESS_GUARD_DEBUG === '1') {
    console.error(`iterator-process-guard skip start=${start} reason=${reason}`);
  }
  return null;
}

function readReferenceFieldLoad(codeItems, start, descriptorPredicate) {
  const load = codeItems[start] && codeItems[start].instruction;
  const local = refLoadLocal(load);
  if (local == null) return null;
  let fieldIndex = nextInstructionIndex(codeItems, start + 1);
  if (fieldIndex >= 0 && op(codeItems[fieldIndex] && codeItems[fieldIndex].instruction) === 'checkcast') {
    fieldIndex = nextInstructionIndex(codeItems, fieldIndex + 1);
  }
  const field = codeItems[fieldIndex] && codeItems[fieldIndex].instruction;
  if (op(field) !== 'getfield') return null;
  const descriptor = fieldDescriptor(field);
  if (!descriptorPredicate(descriptor)) return null;
  return { local, end: nextInstructionIndex(codeItems, fieldIndex + 1) };
}

function isIntLikeFieldDescriptor(descriptor) {
  return descriptor === 'Z' ||
    descriptor === 'B' ||
    descriptor === 'C' ||
    descriptor === 'S' ||
    descriptor === 'I';
}

function readIntLikeReferenceFieldLoad(codeItems, start) {
  const local = refLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (local == null) return null;
  let fieldIndex = nextInstructionIndex(codeItems, start + 1);
  if (fieldIndex >= 0 && op(codeItems[fieldIndex] && codeItems[fieldIndex].instruction) === 'checkcast') {
    fieldIndex = nextInstructionIndex(codeItems, fieldIndex + 1);
  }
  const field = codeItems[fieldIndex] && codeItems[fieldIndex].instruction;
  if (op(field) !== 'getfield' || !isIntLikeFieldDescriptor(fieldDescriptor(field))) return null;
  return { local, end: nextInstructionIndex(codeItems, fieldIndex + 1) };
}

function readIteratorAdvanceSkipTail(codeItems, start) {
  if (start < 0) return null;
  const indexes = nextInstructionIndexes(codeItems, start, 5);
  if (indexes.length < 5) return null;
  const ops = indexes.map((index) => op(codeItems[index] && codeItems[index].instruction));
  if (ops[0] !== 'getstatic' ||
    ops[1] !== 'iconst_1' ||
    ops[2] !== 'invokevirtual' ||
    ops[3] !== 'checkcast' ||
    refStoreLocal(codeItems[indexes[4]] && codeItems[indexes[4]].instruction) == null) {
    return null;
  }
  const jumpIndex = nextInstructionIndex(codeItems, indexes[4] + 1);
  const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
  if (op(jump) !== 'goto') return null;
  return {
    end: jumpIndex + 1,
    signature: indexes.map((index) => stableInstructionArg(codeItems[index] && codeItems[index].instruction)).join('|') +
      `|${labelName(jump.arg)}`,
  };
}

function readRasterTopClipScanlineLoop(codeItems, start, rowLocal) {
  if (!isGetStaticDescriptor(codeItems[start] && codeItems[start].instruction, '[I')) return null;
  if (intLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction) !== rowLocal) return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'iaload') return null;
  if (intStoreLocal(codeItems[start + 3] && codeItems[start + 3].instruction) == null) return null;
  if (intLoadLocal(codeItems[start + 4] && codeItems[start + 4].instruction) == null) return null;
  if (intLoadLocal(codeItems[start + 5] && codeItems[start + 5].instruction) !== rowLocal) return null;
  const exitBranch = codeItems[start + 6] && codeItems[start + 6].instruction;
  if (op(exitBranch) !== 'if_icmple') return null;
  const end = findLabelIndex(codeItems, exitBranch.arg);
  if (end <= start) return null;
  if (!hasInvokeInRange(codeItems, start, end, '(IIIIBIII[II)V')) return null;
  return { end };
}

function hasTopClipAdjustmentBeforeScanline(codeItems, start, end, rowLocal) {
  let rowZeroStore = false;
  let rowFromOtherStore = false;
  let adjustmentStores = 0;
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'iconst_0' && intStoreLocal(codeItems[i + 1] && codeItems[i + 1].instruction) === rowLocal) {
      rowZeroStore = true;
    }
    if (intLoadLocal(insn) != null && intStoreLocal(codeItems[i + 1] && codeItems[i + 1].instruction) === rowLocal) {
      rowFromOtherStore = true;
    }
    const store = intStoreLocal(insn);
    if (store != null && store !== rowLocal) adjustmentStores += 1;
  }
  return rowZeroStore && rowFromOtherStore && adjustmentStores >= 8;
}

function hasInvokeInRange(codeItems, start, end, descriptor) {
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    if (isInvokeDescriptor(codeItems[i] && codeItems[i].instruction, descriptor)) return true;
  }
  return false;
}

function writesLocal(insn, local) {
  return writtenLocalIndexes(insn).includes(local);
}

function cloneStackCompareTails(codeItems, code) {
  let rewrites = 0;
  for (let branchIndex = 2; branchIndex < codeItems.length && rewrites < 2; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction) !== 4) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
    if (fallthrough !== branchIndex + 1 || target <= branchIndex) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (targetLabel && targetLabel.startsWith('LCKSTACKCMP_')) continue;

    const clonePlan = readStackCompareSharedLoopClonePlan(codeItems, target);
    if (!clonePlan) continue;
    if (rangeTouchesExceptionTable(code, codeItems, clonePlan.start, clonePlan.end)) continue;

    const cloneId = structuredCloneId;
    structuredCloneId += 1;
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKSTACKCMPF_${cloneId}`);
    const clone = cloneItems(codeItems.slice(clonePlan.start, clonePlan.end));
    renameInternalLabels(clone, `LCKSTACKCMP_${cloneId}_`);
    if (clonePlan.appendExitLabel) clone.push({ instruction: { op: 'goto', arg: clonePlan.appendExitLabel } });
    branch.op = 'ifeq';
    branch.arg = fallthroughLabel;
    codeItems.splice(branchIndex + 1, 0, ...clone);
    rewrites += 1;
    branchIndex += clone.length;
  }
  return rewrites;
}

function readStackCompareSharedLoopClonePlan(codeItems, target) {
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



function cloneCardSecondHandLoop(codeItems, code) {
  let rewrites = 0;
  rewrites += cloneCardFirstHandLoopEntry(codeItems, code);
  rewrites += cloneCardSecondHandLoopEntry(codeItems, code);
  return rewrites;
}

function cloneCardFirstHandLoopEntry(codeItems, code) {
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
    const secondLoop = findCardHandLoopStart(codeItems, target + 8, exit, exitBranch.arg);
    if (secondLoop <= target) continue;
    if (!looksLikeSecondHandLoopBody(codeItems, target, secondLoop)) continue;
    return cloneConditionalRangeAfterBranchWithFallthroughGoto(codeItems, code, i, target, exit, labelName(exitBranch.arg), 'LCKCARDHAND1');
  }
  return 0;
}

function cloneCardSecondHandLoopEntry(codeItems, code) {
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
    if (!looksLikeSecondHandLoopBody(codeItems, target, exit)) continue;
    return cloneGotoRangeAtWithFallthroughGoto(codeItems, code, i, target, exit, labelName(exitBranch.arg), 'LCKCARDHAND2');
  }
  return 0;
}

function findCardHandLoopStart(codeItems, start, end, exitLabel) {
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

function looksLikeSecondHandLoopBody(codeItems, start, end) {
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


function cloneSharedIconLoop(codeItems, code) {
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
    const tail = readSharedIconLoop(codeItems, target);
    if (!tail) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, target, tail.end, 'LCKICONLOOP');
  }
  return rewrites;
}

function readSharedIconLoop(codeItems, start) {
  if (!looksLikeCardLoop(codeItems, start)) return null;
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

function cloneEarlyFinalLoopExit(codeItems, code) {
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
    if (!looksLikeFinalLoopBody(codeItems, finalLoop)) continue;
    const end = readUntilReturnEnd(codeItems, finalLoop, 96);
    if (end <= finalLoop) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, jumpIndex, finalLoop, end, 'LCKBRSAEXIT');
  }
  return rewrites;
}

function looksLikeFinalLoopBody(codeItems, start) {
  return isGetStaticDescriptor(codeItems[start] && codeItems[start].instruction, 'Ljava/util/Vector;')
    && intLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction) === 3
    && isInvoke(codeItems[start + 2] && codeItems[start + 2].instruction, 'java/util/Vector', 'elementAt', '(I)Ljava/lang/Object;');
}

function cloneCardLoopFallback(codeItems, code) {
  let rewrites = 0;
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < 2; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex || !looksLikeCardLoop(codeItems, target)) continue;
    if (!isBipush(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction, -2)) continue;
    const end = findCardLoopEnd(codeItems, target);
    if (end <= target) continue;
    rewrites += cloneConditionalRangeAfterBranch(codeItems, code, branchIndex, target, end, 'LCKCARDLOOP');
    break;
  }

  for (let gotoIndex = 0; gotoIndex < codeItems.length && rewrites < 3; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex || !looksLikeCardLoop(codeItems, target)) continue;
    const previousBranch = previousInstruction(codeItems, gotoIndex - 1);
    if (!previousBranch || op(previousBranch.instruction) !== 'ifeq') continue;
    if (intLoadLocal(codeItems[gotoIndex - 2] && codeItems[gotoIndex - 2].instruction) !== 7) continue;
    const end = findCardLoopEnd(codeItems, target);
    if (end <= target) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, gotoIndex, target, end, 'LCKCARDLOOP');
    break;
  }
  return rewrites;
}

function looksLikeCardLoop(codeItems, start) {
  return op(codeItems[start] && codeItems[start].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[start + 1] && codeItems[start + 1].instruction) === 6
    && isBipush(codeItems[start + 2] && codeItems[start + 2].instruction, 7)
    && intLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction) === 6
    && op(codeItems[start + 4] && codeItems[start + 4].instruction) === 'if_icmple'
    && refLoadLocal(codeItems[start + 5] && codeItems[start + 5].instruction) === 0
    && isGetFieldReferenceDescriptor(codeItems[start + 6] && codeItems[start + 6].instruction)
    && isGetFieldObjectArrayDescriptor(codeItems[start + 7] && codeItems[start + 7].instruction)
    && !String(labelName(codeItems[start] && codeItems[start].labelDef) || '').startsWith('LCKCARDLOOP_');
}

function findCardLoopEnd(codeItems, start) {
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

function cloneStackShiftStoreTails(codeItems, code) {
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
    if (firstLabel.startsWith('LCKSHIFTSTORE_') || secondLabel.startsWith('LCKSHIFTSTORE_')) continue;
    const firstRefs = findConditionalRefsToLabel(codeItems, firstLabel, Math.max(0, firstShift - 160), firstShift);
    const secondRefs = findConditionalRefsToLabel(codeItems, secondLabel, Math.max(0, secondShift - 260), secondShift);
    const candidates = [
      ...firstRefs.map((refIndex) => ({ refIndex, start: firstShift })),
      ...secondRefs.map((refIndex) => ({ refIndex, start: secondShift })),
    ].sort((a, b) => b.refIndex - a.refIndex);
    for (const candidate of candidates) {
      rewrites += cloneConditionalRangeAfterBranch(codeItems, code, candidate.refIndex, candidate.start, storeTail + 8, 'LCKSHIFTSTORE');
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
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
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
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function retargetGotoTrampolines(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINE_MAX_REWRITES || 64);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchInstruction(insn)) continue;
    const targetLabel = labelName(insn.arg);
    if (!targetLabel) continue;
    const target = findLabelIndex(codeItems, targetLabel);
    if (target < 0 || target === i) continue;
    const trampoline = codeItems[target] && codeItems[target].instruction;
    if (op(trampoline) !== 'goto') continue;
    const replacement = labelName(trampoline.arg);
    if (!replacement || replacement === targetLabel) continue;
    const replacementIndex = findLabelIndex(codeItems, replacement);
    if (replacementIndex < 0 || replacementIndex === target) continue;
    // Preserve a conditional's explicit terminal trampoline. Several later
    // tail-cloning passes use that goto as the region boundary; bypassing it
    // lets them mistake an earlier live sibling block for terminal padding and
    // remove it. Unconditional gotos remain safe to collapse, and conditional
    // trampolines to non-terminal continuations still get the intended cleanup.
    const replacementOp = op(codeItems[replacementIndex] && codeItems[replacementIndex].instruction);
    if (isConditionalBranch(op(insn)) && isTerminalOp(replacementOp)) continue;
    insn.arg = replacement;
    rewrites += 1;
  }
  return rewrites;
}

function retargetDuplicateArrayLengthPreloopEntries(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_ARRAY_LENGTH_PRELOOP_ENTRY_MAX_REWRITES || 8);
  for (let early = 0; early + 4 < codeItems.length && rewrites < maxRewrites; early += 1) {
    const earlyGuard = readArrayLengthExitGuard(codeItems, early);
    if (!earlyGuard) continue;
    const earlyTrue = findLabelIndex(codeItems, earlyGuard.trueLabel);
    const earlyFalse = findLabelIndex(codeItems, earlyGuard.falseLabel);
    if (earlyTrue <= early || earlyFalse <= early) continue;

    for (let later = early + 5; later + 4 < Math.min(codeItems.length, earlyTrue) && rewrites < maxRewrites; later += 1) {
      const laterGuard = readArrayLengthExitGuard(codeItems, later);
      if (!laterGuard) continue;
      if (laterGuard.branchOp !== earlyGuard.branchOp) continue;
      if (laterGuard.constant !== earlyGuard.constant) continue;
      if (laterGuard.falseLabel !== earlyGuard.falseLabel) continue;
      if (laterGuard.arraySig !== earlyGuard.arraySig) continue;
      const laterTrue = findLabelIndex(codeItems, laterGuard.trueLabel);
      if (laterTrue <= later || laterTrue >= earlyTrue) continue;
      if (!hasLocalSetupBetween(codeItems, later + 5, earlyTrue)) continue;
      codeItems[earlyGuard.branchIndex].instruction.arg = ensureLabel(codeItems[later], 'LCKARRLENPRE');
      rewrites += 1;
      break;
    }
  }
  return rewrites;
}

function retargetDuplicateSelectorPartialSetups(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_SELECTOR_PARTIAL_SETUP_MAX_REWRITES || 8);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_DUPLICATE_SELECTOR_PARTIAL_SETUP_MAX_DISTANCE || 96);

  for (let i = 2; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const early = readIntSelectorBranch(codeItems, i);
    if (!early) continue;
    const partial = readInitialLocalStoreSetup(codeItems, i + 1);
    if (!partial || partial.stores.length === 0 || partial.stores.length > 2) continue;

    const searchEnd = Math.min(codeItems.length, i + maxDistance);
    for (let laterIndex = partial.end + 1; laterIndex < searchEnd && rewrites < maxRewrites; laterIndex += 1) {
      const later = readIntSelectorBranch(codeItems, laterIndex);
      if (!later) continue;
      if (!sameSelectorBranch(early, later)) continue;

      const full = readInitialLocalStoreSetup(codeItems, laterIndex + 1);
      if (!full || full.stores.length <= partial.stores.length) continue;
      if (!storeSetupStartsWith(full.stores, partial.stores)) continue;
      if (full.end < 0 || op(codeItems[full.end] && codeItems[full.end].instruction) !== 'goto') continue;
      const joinLabel = labelName(codeItems[full.end].instruction.arg);
      const joinIndex = findLabelIndex(codeItems, joinLabel);
      const targetIndex = findLabelIndex(codeItems, early.targetLabel);
      if (targetIndex <= i || joinIndex <= targetIndex) continue;
      if (joinIndex - targetIndex > maxDistance) continue;
      if (rangeReadsSetupStores(codeItems, partial.end, later.loadIndex, partial.stores)) continue;
      if (rangeTouchesExceptionTable(code, codeItems, i - 2, joinIndex)) continue;

      const sharedLabel = ensureFreshLabel(codeItems, partial.end, `LCKDUPSEL_SHARED_${structuredCloneId}`);
      const clone = cloneItems(codeItems.slice(targetIndex, joinIndex));
      renameInternalLabels(clone, `LCKDUPSEL_${structuredCloneId}_`);
      const cloneLabel = labelName(clone[0] && clone[0].labelDef);
      structuredCloneId += 1;
      if (!cloneLabel) continue;
      const branch = codeItems[i] && codeItems[i].instruction;
      branch.op = invertConditionalBranch(early.op);
      branch.arg = sharedLabel;
      clone.push({ instruction: { op: 'goto', arg: joinLabel } });
      codeItems.splice(i + 1, 0, ...clone);
      for (let dead = i + 1 + clone.length; dead < partial.end + clone.length; dead += 1) {
        if (codeItems[dead] && codeItems[dead].instruction) codeItems[dead].instruction = 'nop';
      }
      rewrites += 1;
      i += clone.length;
      break;
    }
  }
  return rewrites;
}

function readIntSelectorBranch(codeItems, branchIndex) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const branchOp = op(branch);
  if (branchOp !== 'if_icmpne' && branchOp !== 'if_icmpeq') return null;
  const constIndex = previousInstructionIndex(codeItems, branchIndex - 1);
  const loadIndex = previousInstructionIndex(codeItems, constIndex - 1);
  if (constIndex < 0 || loadIndex < 0) return null;
  if (nextInstructionIndex(codeItems, loadIndex + 1) !== constIndex) return null;
  if (nextInstructionIndex(codeItems, constIndex + 1) !== branchIndex) return null;
  const local = intLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction);
  const value = integerConstantValue(codeItems[constIndex] && codeItems[constIndex].instruction);
  const targetLabel = labelName(branch.arg);
  if (local == null || value == null || !targetLabel) return null;
  return { branchIndex, loadIndex, local, value, op: branchOp, targetLabel };
}

function sameSelectorBranch(left, right) {
  return left.local === right.local &&
    left.value === right.value &&
    left.op === right.op &&
    left.targetLabel === right.targetLabel;
}

function readInitialLocalStoreSetup(codeItems, start) {
  const stores = [];
  let i = nextInstructionIndex(codeItems, start);
  while (i >= 0 && i + 1 < codeItems.length && stores.length < 6) {
    const valueInsn = codeItems[i] && codeItems[i].instruction;
    if (!isSimpleLocalSetupProducer(valueInsn)) break;
    const storeIndex = nextInstructionIndex(codeItems, i + 1);
    if (storeIndex < 0 || storeIndex !== i + 1) break;
    const storeInsn = codeItems[storeIndex] && codeItems[storeIndex].instruction;
    const store = localStore(storeInsn);
    if (!store || !Number.isFinite(store.local)) break;
    stores.push({
      producer: instructionSignature(valueInsn),
      store: `${store.kind}:${store.local}`,
    });
    i = nextInstructionIndex(codeItems, storeIndex + 1);
  }
  if (stores.length === 0) return null;
  return { stores, end: i < 0 ? codeItems.length : i };
}

function isSimpleLocalSetupProducer(insn) {
  const cur = op(insn);
  return integerConstantValue(insn) != null ||
    cur === 'aconst_null' ||
    cur === 'getstatic' ||
    cur === 'aload_0' ||
    cur === 'aload_1' ||
    cur === 'aload_2' ||
    cur === 'aload_3' ||
    cur === 'aload';
}

function storeSetupStartsWith(full, prefix) {
  if (full.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (full[i].producer !== prefix[i].producer || full[i].store !== prefix[i].store) return false;
  }
  return true;
}

function rangeReadsSetupStores(codeItems, start, end, stores) {
  const locals = new Set(stores.map((store) => Number(store.store.split(':')[1])).filter(Number.isFinite));
  if (locals.size === 0) return false;
  for (let i = start; i < end; i += 1) {
    const reads = readLocalIndexes(codeItems[i] && codeItems[i].instruction);
    if (reads.some((local) => locals.has(local))) return true;
  }
  return false;
}

function readArrayLengthExitGuard(codeItems, start) {
  const arrayLoad = codeItems[start] && codeItems[start].instruction;
  if (op(arrayLoad) !== 'getstatic' && refLoadLocal(arrayLoad) == null) return null;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'arraylength') return null;
  const constant = integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction);
  if (constant == null) return null;
  const branch = codeItems[start + 3] && codeItems[start + 3].instruction;
  const branchOp = op(branch);
  if (branchOp !== 'if_icmpge' && branchOp !== 'if_icmpgt' && branchOp !== 'if_icmple' && branchOp !== 'if_icmplt') {
    return null;
  }
  const jump = codeItems[start + 4] && codeItems[start + 4].instruction;
  if (op(jump) !== 'goto') return null;
  const trueLabel = labelName(branch.arg);
  const falseLabel = labelName(jump.arg);
  if (!trueLabel || !falseLabel || trueLabel === falseLabel) return null;
  return {
    start,
    branchIndex: start + 3,
    branchOp,
    constant,
    trueLabel,
    falseLabel,
    arraySig: instructionSignature(arrayLoad),
  };
}

function hasLocalSetupBetween(codeItems, start, end) {
  let stores = 0;
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    if (localStore(codeItems[i] && codeItems[i].instruction)) stores += 1;
    if (stores >= 2) return true;
  }
  return false;
}

function cloneQueueDrainContinuations(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION_MAX_REWRITES || 6);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isConditionalBranch(branch)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i || target - i > 180) continue;
    const drain = readQueueDrainLoop(codeItems, target);
    if (!drain) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, drain.end)) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      drain.end,
      drain.exitLabel,
      'LCKQDRN',
    );
    if (changed) {
      rewrites += changed;
      i += drain.end - target;
    }
  }
  return rewrites;
}

function readQueueDrainLoop(codeItems, start) {
  const headerLabel = labelName(codeItems[start] && codeItems[start].labelDef);
  if (!headerLabel) return null;
  const indexes = nextInstructionIndexes(codeItems, start, 6);
  if (indexes.length < 6) return null;
  if (op(codeItems[indexes[0]] && codeItems[indexes[0]].instruction) !== 'aload_0') return null;
  if (op(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) !== 'getfield') return null;
  if (!isIntegerConstant(codeItems[indexes[2]] && codeItems[indexes[2]].instruction)) return null;
  if (!isInvokeDescriptor(codeItems[indexes[3]] && codeItems[indexes[3]].instruction, '(B)Z')) return null;
  const exitBranch = codeItems[indexes[4]] && codeItems[indexes[4]].instruction;
  if (op(exitBranch) !== 'ifne') return null;
  const exitLabel = labelName(exitBranch.arg);
  const exit = findLabelIndex(codeItems, exitLabel);
  if (exit <= indexes[4] || exit - start > 140) return null;
  let sawDrainInvoke = false;
  let backedge = -1;
  for (let i = indexes[5]; i < exit; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isInvokeInstruction(insn)) sawDrainInvoke = true;
    if (op(insn) === 'goto' && labelName(insn.arg) === headerLabel) {
      backedge = i;
      break;
    }
  }
  if (!sawDrainInvoke || backedge < 0) return null;
  return { end: backedge + 1, exitLabel };
}

function materializeSharedBooleanConstantTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL_MAX_REWRITES || 8);
  for (let start = 0; start + 3 < codeItems.length && rewrites < maxRewrites; start += 1) {
    const tail = readSharedBooleanConstantTail(codeItems, start);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, start, tail.join + 1)) continue;

    const refs = [
      ...collectLabelReferencesDetailed(codeItems, tail.firstLabel)
        .filter((ref) => ref < start)
        .map((ref) => ({ ref, value: tail.firstValue })),
      ...collectLabelReferencesDetailed(codeItems, tail.secondLabel)
        .filter((ref) => ref < start)
        .map((ref) => ({ ref, value: tail.secondValue })),
    ].sort((a, b) => b.ref - a.ref);
    if (refs.length < 2) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      rewrites += materializeBooleanConstantTailReference(codeItems, ref.ref, ref.value, tail.joinLabel);
    }
    if (rewrites > 0) start = tail.join;
  }
  return rewrites;
}

function materializePredicateBooleanConstantSelectorRefs(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL_MAX_REWRITES || 8);
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const tail = readPredicateBooleanConstantSelector(codeItems, branchIndex);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tail.trueIndex, tail.join + 1)) continue;

    const refs = [...new Set(tail.falseLabels.flatMap((label) => collectLabelReferencesDetailed(codeItems, label)))]
      .filter((ref) => ref < branchIndex)
      .sort((a, b) => b - a);
    if (refs.length === 0) continue;

    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      rewrites += materializeBooleanConstantTailReference(codeItems, ref, tail.falseValue, tail.joinLabel);
    }
    if (rewrites > 0) branchIndex = tail.join;
  }
  return rewrites;
}

function readPredicateBooleanConstantSelector(codeItems, branchIndex) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  if (!isConditionalBranchOp(op(branch))) return null;
  const indexes = nextInstructionIndexes(codeItems, branchIndex, 5);
  if (indexes.length < 5 || indexes[0] !== branchIndex) return null;
  const trueValue = integerConstantValue(codeItems[indexes[1]] && codeItems[indexes[1]].instruction);
  if (trueValue !== 0 && trueValue !== 1) return null;
  const jump = codeItems[indexes[2]] && codeItems[indexes[2]].instruction;
  if (op(jump) !== 'goto') return null;
  const falseValue = integerConstantValue(codeItems[indexes[3]] && codeItems[indexes[3]].instruction);
  if (falseValue !== 0 && falseValue !== 1 || falseValue === trueValue) return null;

  const falseLabel = labelName(branch.arg);
  const falseIndex = findLabelIndex(codeItems, falseLabel);
  if (!falseLabel || falseIndex < 0 || nextInstructionIndex(codeItems, falseIndex) !== indexes[3]) return null;
  const joinLabel = labelName(jump.arg);
  const join = findLabelIndex(codeItems, joinLabel);
  if (!joinLabel || join < 0 || nextInstructionIndex(codeItems, join) !== indexes[4]) return null;
  if (intStoreLocal(codeItems[indexes[4]] && codeItems[indexes[4]].instruction) == null) return null;
  return {
    trueIndex: indexes[1],
    falseLabels: labelsForInstructionIndex(codeItems, indexes[3]),
    falseValue,
    join,
    joinLabel,
  };
}

function isConditionalBranchOp(cur) {
  return typeof cur === 'string' && cur.startsWith('if');
}

function labelsForInstructionIndex(codeItems, instructionIndex) {
  const labels = [];
  for (let i = 0; i < codeItems.length; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    const targetInstruction = codeItems[i] && codeItems[i].instruction ? i : nextInstructionIndex(codeItems, i);
    if (targetInstruction === instructionIndex) labels.push(label);
  }
  return labels;
}

function materializePaddedBooleanConstantTails(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_PADDED_BOOLEAN_CONSTANT_TAIL_MAX_REWRITES || 4);
  for (let start = 0; start + 4 < codeItems.length && rewrites < maxRewrites; start += 1) {
    const tail = readPaddedBooleanConstantTail(codeItems, start);
    if (!tail) continue;
    const refs = [
      ...collectLabelReferencesDetailed(codeItems, tail.firstLabel)
        .filter((ref) => ref < start)
        .map((ref) => ({ ref, value: tail.firstValue })),
      ...collectLabelReferencesDetailed(codeItems, tail.secondLabel)
        .filter((ref) => ref < tail.secondIndex)
        .map((ref) => ({ ref, value: tail.secondValue })),
    ].sort((a, b) => b.ref - a.ref);
    if (refs.length < 2) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      rewrites += materializeBooleanConstantTailReference(codeItems, ref.ref, ref.value, tail.joinLabel);
    }
    if (rewrites > 0) start = tail.join;
  }
  return rewrites;
}

function readPaddedBooleanConstantTail(codeItems, start) {
  const firstValue = integerConstantValue(codeItems[start] && codeItems[start].instruction);
  if (firstValue !== 0 && firstValue !== 1) return null;
  const firstLabel = labelName(codeItems[start] && codeItems[start].labelDef);
  if (!firstLabel) return null;
  const jump = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (op(jump) !== 'goto') return null;
  const join = findLabelIndex(codeItems, jump.arg);
  if (join <= start + 2 || join > start + 8) return null;
  const joinLabel = labelName(codeItems[join] && codeItems[join].labelDef);
  if (!joinLabel || intStoreLocal(codeItems[join] && codeItems[join].instruction) == null) return null;
  let secondIndex = -1;
  for (let i = start + 2; i < join; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    const value = integerConstantValue(codeItems[i] && codeItems[i].instruction);
    if (value === 0 || value === 1) {
      if (secondIndex >= 0 || value === firstValue) return null;
      secondIndex = i;
      continue;
    }
    if (cur !== 'athrow') return null;
  }
  if (secondIndex < 0) return null;
  const secondLabel = labelName(codeItems[secondIndex] && codeItems[secondIndex].labelDef);
  if (!secondLabel) return null;
  const secondValue = integerConstantValue(codeItems[secondIndex] && codeItems[secondIndex].instruction);
  return { firstLabel, firstValue, secondLabel, secondValue, secondIndex, join, joinLabel };
}

function readSharedBooleanConstantTail(codeItems, start) {
  const firstValue = integerConstantValue(codeItems[start] && codeItems[start].instruction);
  if (firstValue !== 0 && firstValue !== 1) return null;
  const firstLabel = labelName(codeItems[start] && codeItems[start].labelDef);
  if (!firstLabel) return null;
  const jump = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (op(jump) !== 'goto') return null;
  const secondValue = integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction);
  if (secondValue !== 0 && secondValue !== 1 || secondValue === firstValue) return null;
  const secondLabel = labelName(codeItems[start + 2] && codeItems[start + 2].labelDef);
  if (!secondLabel) return null;
  const join = findLabelIndex(codeItems, jump.arg);
  if (join !== start + 3) return null;
  const joinLabel = labelName(codeItems[join] && codeItems[join].labelDef);
  if (!joinLabel) return null;
  if (intStoreLocal(codeItems[join] && codeItems[join].instruction) == null) return null;
  return { firstLabel, firstValue, secondLabel, secondValue, join, joinLabel };
}

function materializeBooleanConstantTailReference(codeItems, ref, value, joinLabel) {
  const insn = codeItems[ref] && codeItems[ref].instruction;
  const cur = op(insn);
  if (cur === 'goto') {
    const meta = cloneItemMetadata(codeItems[ref]);
    codeItems[ref] = { ...meta, instruction: intConstantInstruction(value) };
    codeItems.splice(ref + 1, 0, { instruction: { op: 'goto', arg: joinLabel } });
    return 1;
  }
  if (!isConditionalBranch(insn)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, ref + 1);
  if (fallthrough < 0) return 0;
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKBOOLTAILF_${cloneId}`);
  insn.op = invertConditionalBranch(cur);
  insn.arg = fallthroughLabel;
  codeItems.splice(ref + 1, 0,
    { labelDef: `LCKBOOLTAIL_${cloneId}:`, instruction: intConstantInstruction(value) },
    { instruction: { op: 'goto', arg: joinLabel } },
  );
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

function removeDominatedBooleanLocalBranches(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_MAX_REWRITES || 12);
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 2; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifne' && branchOp !== 'ifeq') continue;
    const loadIndex = previousInstructionIndex(codeItems, i - 1);
    if (loadIndex < 0 || loadIndex + 1 !== i) continue;
    const local = intLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction);
    if (local == null) continue;
    if (hasAnyLabelReference(codeItems, codeItems[loadIndex] && codeItems[loadIndex].labelDef)) continue;
    if (hasAnyLabelReference(codeItems, codeItems[i] && codeItems[i].labelDef)) continue;
    const continuationIndex = nextInstructionIndex(codeItems, i + 1);
    if (continuationIndex === i + 1 &&
        isConditionalBranchOp(op(codeItems[continuationIndex] &&
          codeItems[continuationIndex].instruction))) {
      // The boolean is the top value, but the following conditional proves
      // that at least one older comparison value is live beneath it. Removing this
      // branch is locally stack-neutral, yet later loop-threading passes can
      // mistake those buried operands for an enclosing loop condition and
      // redirect the increment edge back into the same iteration. Preserve
      // the opaque guard so every subsequent CFG pass sees the real boundary.
      continue;
    }

    const dominator = findDominatingBooleanBranch(codeItems, local, loadIndex, refCounts);
    if (!dominator) continue;
    const knownFalse = dominator.op === 'ifne';
    const knownTrue = dominator.op === 'ifeq';
    const branchNotTaken = (knownFalse && branchOp === 'ifne') || (knownTrue && branchOp === 'ifeq');
    if (!branchNotTaken) continue;
    codeItems[loadIndex].instruction = 'nop';
    codeItems[i].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function findDominatingBooleanBranch(codeItems, local, before, refCounts) {
  for (let i = before - 1; i >= 1 && i >= before - 220; i -= 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifne' && branchOp !== 'ifeq') continue;
    const loadIndex = previousInstructionIndex(codeItems, i - 1);
    if (loadIndex < 0 || loadIndex + 1 !== i) continue;
    if (intLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction) !== local) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= before) continue;
    // The fallthrough value is only known when every route to the later test
    // passes through this branch. A jump into the intervening range bypasses
    // the supposed dominator (qk.run has exactly this shape), so conservatively
    // retain the later test whenever that range contains a referenced label.
    if (hasReferencedLabelsInside(codeItems, i + 1, before + 1, refCounts)) continue;
    if (rangeWritesLocal(codeItems, i + 1, before, local)) continue;
    return { index: i, op: branchOp, target };
  }
  return null;
}

function rangeWritesLocal(codeItems, start, end, local) {
  for (let i = start; i < end; i += 1) {
    if (writtenLocalIndexes(codeItems[i] && codeItems[i].instruction).includes(local)) return true;
  }
  return false;
}

function hasAnyLabelReference(codeItems, labelDef) {
  const label = labelName(labelDef);
  if (!label) return false;
  return (collectLabelReferenceCounts(codeItems).get(label) || 0) > 0;
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

function cloneSharedForwardGotoContinuations(codeItems, code, method) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATION_MAX_REWRITES || 12);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATION_MAX_INSNS || 6);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATION_MAX_REFS || 8);

  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const targetLabel = labelName(jump.arg);
    const target = findLabelIndex(codeItems, targetLabel);
    if (target <= i + 1) continue;
    if (isStructuredGotoCloneLabel(codeItems[target], 'LCKSFG_')) continue;
    const refCounts = collectLabelReferenceCounts(codeItems);
    const targetRefs = refCounts.get(targetLabel) || 0;
    if (targetRefs < 2 || targetRefs > maxRefs) continue;
    if (!hasFallthroughPredecessor(codeItems, target)) continue;

    const tail = readForwardContinuationCloneTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (isSimpleLocalCopyContinuationTail(codeItems, target, tail.end)) continue;
    if (rangeContainsConditionalBranch(codeItems, target, tail.end)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (method && method.name === '<init>' && rangeContainsConstructorCall(codeItems, target, tail.end)) continue;

    const changed = cloneGotoRangeAt(codeItems, code, i, target, tail.end, 'LCKSFG');
    if (changed) {
      rewrites += changed;
      i += Math.max(0, tail.end - target - 1);
    }
  }
  return rewrites;
}

function cloneSharedInstanceIntUpdateTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAIL_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAIL_MAX_INSNS || 18);

  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const targetLabel = labelName(jump.arg);
    const target = findLabelIndex(codeItems, targetLabel);
    if (target <= i + 1) continue;
    if (isStructuredGotoCloneLabel(codeItems[target], 'LCKIIU_')) continue;
    const refs = collectLabelReferenceCounts(codeItems).get(targetLabel) || 0;
    if (refs !== 2) continue;
    if (!hasConditionalReferenceBetween(codeItems, i + 1, target, targetLabel)) continue;
    if (!isZeroGuardBridgeToGotoTail(codeItems, i, targetLabel)) continue;

    const tail = readSharedInstanceIntUpdateTail(codeItems, target, maxInsns);
    if (!tail) continue;
    const changed = cloneGotoRangeAt(codeItems, code, i, target, tail.end, 'LCKIIU');
    if (changed) {
      rewrites += changed;
      i += Math.max(0, tail.end - target - 1);
    }
  }
  return rewrites;
}

function cloneSharedArrayRecordUpdateBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY_MAX_INSNS || 48);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKARRREC_')) continue;
    const refs = collectLabelReferencesDetailed(codeItems, targetLabel);
    if (refs.length !== 2) continue;
    const branchRef = refs.find((ref) => isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)));
    const gotoRef = refs.find((ref) => op(codeItems[ref] && codeItems[ref].instruction) === 'goto');
    if (branchRef == null || gotoRef == null) continue;
    if (gotoRef !== previousInstructionIndex(codeItems, target - 1)) continue;
    if (branchRef >= gotoRef || target - branchRef > 32) continue;
    const body = readSharedArrayRecordUpdateBody(codeItems, target, maxInsns);
    if (!body) continue;

    const changedBranch = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branchRef,
      target,
      body.end,
      body.exitLabel,
      'LCKARRREC',
    );
    if (!changedBranch) continue;
    rewrites += changedBranch;

    const updatedTarget = findLabelIndex(codeItems, targetLabel);
    const updatedBody = readSharedArrayRecordUpdateBody(codeItems, updatedTarget, maxInsns);
    if (!updatedBody) continue;
    const updatedGoto = collectLabelReferencesDetailed(codeItems, targetLabel)
      .find((ref) => op(codeItems[ref] && codeItems[ref].instruction) === 'goto');
    if (updatedGoto == null) continue;
    const changedGoto = cloneGotoRangeAtWithFallthroughGoto(
      codeItems,
      code,
      updatedGoto,
      updatedTarget,
      updatedBody.end,
      updatedBody.exitLabel,
      'LCKARRREC',
    );
    rewrites += changedGoto;
    target = Math.max(target, updatedTarget + (updatedBody.end - updatedTarget));
  }
  return rewrites;
}

function cloneSharedStringIndexRetryTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STRING_INDEX_RETRY_TAIL_MAX_REWRITES || 8);

  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKIDXRETRY_')) continue;
    const refs = collectLabelReferencesDetailed(codeItems, targetLabel);
    if (refs.length !== 2) continue;
    const branchRef = refs.find((ref) => isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)));
    const gotoRef = refs.find((ref) => op(codeItems[ref] && codeItems[ref].instruction) === 'goto');
    if (branchRef == null || gotoRef == null || branchRef >= gotoRef) continue;
    if (target <= gotoRef || target - branchRef > 320) continue;
    const tail = readSharedStringIndexRetryTail(codeItems, target);
    if (!tail) continue;

    const changedBranch = cloneConditionalRangeAfterBranch(codeItems, code, branchRef, target, tail.end, 'LCKIDXRETRY');
    if (!changedBranch) continue;
    rewrites += changedBranch;

    const updatedTarget = findLabelIndex(codeItems, targetLabel);
    const updatedTail = readSharedStringIndexRetryTail(codeItems, updatedTarget);
    if (!updatedTail) continue;
    const updatedGoto = collectLabelReferencesDetailed(codeItems, targetLabel)
      .find((ref) => op(codeItems[ref] && codeItems[ref].instruction) === 'goto');
    if (updatedGoto == null) continue;
    rewrites += cloneGotoRangeAt(codeItems, code, updatedGoto, updatedTarget, updatedTail.end, 'LCKIDXRETRY');
    target = updatedTarget + Math.max(0, updatedTail.end - updatedTarget);
  }
  return rewrites;
}

function readSharedStringIndexRetryTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 8);
  if (indexes.length < 8) return null;
  if (refLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction) == null) return null;
  if (refLoadLocal(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) == null) return null;
  const indexLocal = intLoadLocal(codeItems[indexes[2]] && codeItems[indexes[2]].instruction);
  if (indexLocal == null) return null;
  if (integerConstantValue(codeItems[indexes[3]] && codeItems[indexes[3]].instruction) !== -1) return null;
  if (op(codeItems[indexes[4]] && codeItems[indexes[4]].instruction) !== 'isub') return null;
  const invoke = codeItems[indexes[5]] && codeItems[indexes[5]].instruction;
  if (!isInvokeInstruction(invoke)) return null;
  const invokeArg = invoke.arg;
  if (!Array.isArray(invokeArg) || invokeArg[1] !== 'java/lang/String' || !Array.isArray(invokeArg[2]) ||
      invokeArg[2][0] !== 'indexOf' || invokeArg[2][1] !== '(Ljava/lang/String;I)I') return null;
  if (intStoreLocal(codeItems[indexes[6]] && codeItems[indexes[6]].instruction) !== indexLocal) return null;
  const jump = codeItems[indexes[7]] && codeItems[indexes[7]].instruction;
  if (op(jump) !== 'goto' || findLabelIndex(codeItems, jump.arg) >= start) return null;
  return { end: indexes[7] + 1 };
}

function readSharedArrayRecordUpdateBody(codeItems, start, maxInsns) {
  let instructions = 0;
  let putfields = 0;
  let sawArrayElementLoad = false;
  let sawStoreObjectLocal = false;

  for (let i = start; i < codeItems.length; i += 1) {
    const item = codeItems[i];
    const insn = item && item.instruction;
    const cur = op(insn);
    if (!cur) continue;
    if (i > start && item.labelDef && putfields >= 3 && sawArrayElementLoad && sawStoreObjectLocal) {
      const exitLabel = labelName(item.labelDef);
      return exitLabel ? { end: i, exitLabel } : null;
    }
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (!isArrayRecordUpdateBodyOp(cur)) return null;
    if (cur === 'aaload') sawArrayElementLoad = true;
    if (cur === 'astore' || /^astore_[0-3]$/.test(cur)) sawStoreObjectLocal = true;
    if (cur === 'putfield') putfields += 1;
  }
  return null;
}

function isArrayRecordUpdateBodyOp(cur) {
  return cur === 'iload' || /^iload_[0-3]$/.test(cur) ||
    cur === 'istore' || /^istore_[0-3]$/.test(cur) ||
    cur === 'aload' || /^aload_[0-3]$/.test(cur) ||
    cur === 'astore' || /^astore_[0-3]$/.test(cur) ||
    cur === 'getstatic' || cur === 'aaload' || cur === 'i2b' || cur === 'putfield';
}

function hasConditionalReferenceBetween(codeItems, start, end, label) {
  const target = labelName(label);
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isConditionalBranch(op(insn)) && labelName(insn.arg) === target) return true;
  }
  return false;
}

function isZeroGuardBridgeToGotoTail(codeItems, gotoIndex, targetLabel) {
  const branchIndex = previousInstructionIndex(codeItems, gotoIndex - 1);
  if (branchIndex < 2) return false;
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  if (op(branch) !== 'if_icmpeq' && op(branch) !== 'if_icmpne') return false;
  if (labelName(branch.arg) === targetLabel) return false;
  const top = previousInstructionIndex(codeItems, branchIndex - 1);
  const beforeTop = previousInstructionIndex(codeItems, top - 1);
  const beforeFieldLoad = previousInstructionIndex(codeItems, beforeTop - 1);
  if (top < 0 || beforeTop < 0 || beforeFieldLoad < 0) return false;
  const topInsn = codeItems[top] && codeItems[top].instruction;
  const beforeTopInsn = codeItems[beforeTop] && codeItems[beforeTop].instruction;
  const beforeFieldLoadInsn = codeItems[beforeFieldLoad] && codeItems[beforeFieldLoad].instruction;
  if (isInstanceIntFieldLoad(topInsn) && op(beforeTopInsn) === 'aload_0') {
    return integerConstantValue(beforeFieldLoadInsn) === 0;
  }
  if (integerConstantValue(topInsn) === 0 && isInstanceIntFieldLoad(beforeTopInsn)) {
    const load = previousInstructionIndex(codeItems, beforeTop - 1);
    return op(codeItems[load] && codeItems[load].instruction) === 'aload_0';
  }
  return false;
}

function readSharedInstanceIntUpdateTail(codeItems, start, maxInsns) {
  const indexes = nextInstructionIndexes(codeItems, start, maxInsns);
  const gotoIndexes = indexes.filter((index) => op(codeItems[index] && codeItems[index].instruction) === 'goto');
  const gotoPos = gotoIndexes[gotoIndexes.length - 1];
  if (gotoPos < 0) return null;
  const end = gotoPos + 1;
  if (rangeContainsUnsupportedSharedInstanceIntUpdateTailOp(codeItems, start, end)) return null;

  let stateField = null;
  let sawStateCompare = false;
  let sawStateIncrement = false;
  let sawOtherIntFieldStore = false;

  for (let i = start; i < end; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'getfield') {
      const field = instanceIntFieldRef(codeItems[i] && codeItems[i].instruction);
      if (!field) continue;
      const prev = previousInstructionIndex(codeItems, i - 1);
      if (op(codeItems[prev] && codeItems[prev].instruction) !== 'aload_0') continue;
      const next = nextInstructionIndex(codeItems, i + 1);
      if (next >= 0 && integerConstantValue(codeItems[next] && codeItems[next].instruction) != null) {
        const branch = nextInstructionIndex(codeItems, next + 1);
        if (branch >= 0 && isConditionalBranch(op(codeItems[branch] && codeItems[branch].instruction))) {
          stateField = field;
          sawStateCompare = true;
        }
      }
    }
    if (cur !== 'putfield') continue;
    const field = instanceIntFieldRef(codeItems[i] && codeItems[i].instruction);
    if (!field) continue;
    if (stateField && sameFieldRef(field, stateField) && isInstanceIntIncrementStore(codeItems, i, stateField)) {
      sawStateIncrement = true;
    } else {
      sawOtherIntFieldStore = true;
    }
  }

  if (!sawStateCompare || !sawStateIncrement) return null;
  if (!sawOtherIntFieldStore) return null;
  return { end };
}

function rangeContainsUnsupportedSharedInstanceIntUpdateTailOp(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur) continue;
    if (cur === 'tableswitch' || cur === 'lookupswitch' || isReturnOp(cur) || cur === 'athrow') return true;
    if (isInvokeInstruction(codeItems[i] && codeItems[i].instruction)) return true;
    if (cur.startsWith('store') || cur.endsWith('store') || cur === 'iinc') return true;
  }
  return false;
}

function isInstanceIntFieldLoad(insn) {
  return !!instanceIntFieldRef(insn);
}

function instanceIntFieldRef(insn) {
  if (!insn || op(insn) !== 'getfield' && op(insn) !== 'putfield') return null;
  const arg = insn.arg;
  if (!Array.isArray(arg) || arg[0] !== 'Field' || !Array.isArray(arg[2])) return null;
  if (arg[2][1] !== 'I') return null;
  return { owner: arg[1], name: arg[2][0], desc: arg[2][1] };
}

function sameFieldRef(a, b) {
  const leftDesc = a.descriptor || a.desc;
  const rightDesc = b.descriptor || b.desc;
  return !!a && !!b && a.owner === b.owner && a.name === b.name && leftDesc === rightDesc;
}

function isInstanceIntIncrementStore(codeItems, putIndex, field) {
  const iadd = previousInstructionIndex(codeItems, putIndex - 1);
  const amount = previousInstructionIndex(codeItems, iadd - 1);
  const get = previousInstructionIndex(codeItems, amount - 1);
  const dup = previousInstructionIndex(codeItems, get - 1);
  const load = previousInstructionIndex(codeItems, dup - 1);
  if (iadd < 0 || amount < 0 || get < 0 || dup < 0 || load < 0) return false;
  if (op(codeItems[iadd] && codeItems[iadd].instruction) !== 'iadd') return false;
  if (integerConstantValue(codeItems[amount] && codeItems[amount].instruction) == null) return false;
  if (op(codeItems[dup] && codeItems[dup].instruction) !== 'dup') return false;
  if (op(codeItems[load] && codeItems[load].instruction) !== 'aload_0') return false;
  return sameFieldRef(instanceIntFieldRef(codeItems[get] && codeItems[get].instruction), field);
}

function cloneSiblingLocalScanBodies(codeItems, code, method) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SIBLING_LOCAL_SCAN_BODY_MAX_REWRITES || 4);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SIBLING_LOCAL_SCAN_BODY_MAX_INSNS || 96);

  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifnull') continue;
    const branchLoadLocal = refLoadLocal(codeItems[previousInstructionIndex(codeItems, i - 1)] && codeItems[previousInstructionIndex(codeItems, i - 1)].instruction);
    if (branchLoadLocal == null) continue;
    const bridgeIndex = nextInstructionIndex(codeItems, i + 1);
    if (bridgeIndex !== i + 1) continue;
    const bridge = codeItems[bridgeIndex] && codeItems[bridgeIndex].instruction;
    if (op(bridge) !== 'goto') continue;
    const nullStart = findLabelIndex(codeItems, branch.arg);
    const nonNullStart = findLabelIndex(codeItems, bridge.arg);
    if (nullStart <= bridgeIndex || nonNullStart <= nullStart) continue;

    const laterHeader = findFirstGotoTargetInRange(codeItems, nullStart, nonNullStart);
    if (laterHeader < 0 || laterHeader >= nullStart) continue;
    const laterScan = readLocalArrayScanHeader(codeItems, laterHeader);
    if (!laterScan) continue;
    const earlierScan = findPreviousLocalArrayScanHeader(codeItems, i, laterScan);
    if (!earlierScan || earlierScan.objectLocal === laterScan.objectLocal) continue;
    if (!rangeHasLocalStore(codeItems, earlierScan.index, i, branchLoadLocal)) continue;

    const end = findLastGotoToHeaderEnd(codeItems, nonNullStart, laterScan.headerLabel, maxInsns);
    if (end <= nonNullStart || end - nullStart > maxInsns) continue;
    if (!rangeBranchTargetsInsideOrHeader(codeItems, nullStart, end, laterScan.headerLabel)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, nullStart, end)) continue;
    if (method && method.name === '<init>' && rangeContainsConstructorCall(codeItems, nullStart, end)) continue;

    const cloneId = structuredCloneId;
    structuredCloneId += 1;
    const cloned = cloneItems(codeItems.slice(nullStart, end));
    const labels = renameInternalLabelsWithMap(cloned, `LCKSIB_${cloneId}_`);
    rewriteCloneLocalReferences(cloned, laterScan.objectLocal, earlierScan.objectLocal);
    rewriteCloneLabelReferences(cloned, new Map([[laterScan.headerLabel, earlierScan.headerLabel]]));
    const nullLabel = labels.get(labelName(codeItems[nullStart] && codeItems[nullStart].labelDef));
    const nonNullLabel = labels.get(labelName(codeItems[nonNullStart] && codeItems[nonNullStart].labelDef));
    if (!nullLabel || !nonNullLabel) continue;

    branch.arg = nullLabel;
    bridge.arg = nonNullLabel;
    codeItems.splice(bridgeIndex + 1, 0, ...cloned);
    rewrites += 1;
    i += cloned.length;
  }
  return rewrites;
}

function readLocalArrayScanHeader(codeItems, index) {
  const indexLocal = intLoadLocal(codeItems[index] && codeItems[index].instruction);
  const objectLocal = refLoadLocal(codeItems[index + 1] && codeItems[index + 1].instruction);
  if (indexLocal == null || objectLocal == null) return null;
  if (op(codeItems[index + 2] && codeItems[index + 2].instruction) !== 'checkcast') return null;
  const fieldInsn = codeItems[index + 3] && codeItems[index + 3].instruction;
  if (op(fieldInsn) !== 'getfield') return null;
  const fieldArg = fieldInsn.arg;
  if (!Array.isArray(fieldArg) || !Array.isArray(fieldArg[2])) return null;
  if (fieldArg[2][1] !== 'I') return null;
  const exitBranch = codeItems[index + 4] && codeItems[index + 4].instruction;
  if (!isIntCompareBranch(op(exitBranch))) return null;
  const headerLabel = labelName(codeItems[index] && codeItems[index].labelDef);
  if (!headerLabel) return null;
  return { index, indexLocal, objectLocal, fieldKey: JSON.stringify(fieldArg), headerLabel };
}

function findPreviousLocalArrayScanHeader(codeItems, before, scan) {
  for (let i = before - 1; i >= Math.max(0, before - 220); i -= 1) {
    const candidate = readLocalArrayScanHeader(codeItems, i);
    if (!candidate) continue;
    if (candidate.indexLocal !== scan.indexLocal) continue;
    if (candidate.fieldKey !== scan.fieldKey) continue;
    return candidate;
  }
  return null;
}

function findFirstGotoTargetInRange(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'goto') continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target >= 0) return target;
  }
  return -1;
}

function findLastGotoToHeaderEnd(codeItems, start, headerLabel, maxInsns) {
  let seen = 0;
  let end = -1;
  for (let i = start; i < codeItems.length; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction)) seen += 1;
    if (seen > maxInsns) break;
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && labelName(insn.arg) === headerLabel) end = i + 1;
  }
  return end;
}

function rangeBranchTargetsInsideOrHeader(codeItems, start, end, headerLabel) {
  const labelsInside = new Set();
  for (let i = start; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) labelsInside.add(label);
  }
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    for (const raw of collectInstructionLabels(insn)) {
      const label = labelName(raw);
      if (label !== headerLabel && !labelsInside.has(label)) return false;
    }
  }
  return true;
}

function rangeHasLocalStore(codeItems, start, end, local) {
  for (let i = start; i < end; i += 1) {
    if (writtenLocalIndexes(codeItems[i] && codeItems[i].instruction).includes(local)) return true;
  }
  return false;
}

function renameInternalLabelsWithMap(items, prefix) {
  const labels = [];
  for (const item of items) {
    const label = labelName(item && item.labelDef);
    if (label) labels.push(label);
  }
  const renamed = new Map(labels.map((label, idx) => [label, `${prefix}${idx}`]));
  for (const item of items) {
    const label = labelName(item && item.labelDef);
    if (label && renamed.has(label)) item.labelDef = `${renamed.get(label)}:`;
    rewriteInstructionLabels(item && item.instruction, renamed);
  }
  return renamed;
}

function rewriteCloneLabelReferences(items, labels) {
  for (const item of items) rewriteInstructionLabels(item && item.instruction, labels);
}

function rewriteCloneLocalReferences(items, fromLocal, toLocal) {
  for (const item of items) {
    const insn = item && item.instruction;
    if (!insn || typeof insn !== 'object') continue;
    const cur = op(insn);
    if ((cur === 'aload' || cur === 'astore' || cur === 'iload' || cur === 'istore') && Number(insn.arg) === fromLocal) {
      insn.arg = String(toLocal);
    }
    if (cur === 'iinc' && Number(insn.varnum) === fromLocal) insn.varnum = String(toLocal);
    if (cur === 'iinc' && Array.isArray(insn.arg) && Number(insn.arg[0]) === fromLocal) insn.arg[0] = String(toLocal);
  }
}

function rangeContainsConditionalBranch(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    if (isConditionalBranch(op(codeItems[i] && codeItems[i].instruction))) return true;
  }
  return false;
}

function cloneSharedIntPairContinuations(codeItems, code, method) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_INT_PAIR_CONTINUATION_MAX_REWRITES || 4);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_INT_PAIR_CONTINUATION_MAX_REFS || 4);

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
    const refs = collectLabelReferencesDetailed(codeItems, targetLabel);
    const previous = previousInstructionIndex(codeItems, target - 1);
    if (refs.length !== 2 || !refs.includes(i)) continue;
    if (previous < 0 || !refs.includes(previous) || op(codeItems[previous] && codeItems[previous].instruction) !== 'goto') continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;

    const tail = readSharedIntPairContinuationTail(codeItems, target, refCounts);
    if (!tail) continue;
    if (!hasRecentMinusOneInitializers(codeItems, i, tail.storeLocals)) continue;
    if (hasSystemOutSideEffect(codeItems)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    if (method && method.name === '<init>' && rangeContainsConstructorCall(codeItems, target, tail.end)) continue;
    const exitLabel = ensureFreshLabel(codeItems, tail.end, 'LCKIPC_EXIT');
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      tail.end,
      exitLabel,
      'LCKIPC',
    );
    if (changed) {
      rewrites += changed;
      i += tail.end - target;
    }
  }
  return rewrites;
}

function simplifyDominatedIntRangeBranches(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_RANGE_BRANCHES_MAX_REWRITES || 8);
  for (let i = 0; i + 10 < codeItems.length && rewrites < maxRewrites; i += 1) {
    const local = intLoadLocal(codeItems[i] && codeItems[i].instruction);
    const lowerBound = integerConstantValue(codeItems[i + 1] && codeItems[i + 1].instruction);
    const lowerGuard = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (local == null || lowerBound == null || op(lowerGuard) !== 'if_icmplt') continue;

    const firstConst = integerConstantValue(codeItems[i + 3] && codeItems[i + 3].instruction);
    const firstLocal = intLoadLocal(codeItems[i + 4] && codeItems[i + 4].instruction);
    const firstBranch = codeItems[i + 5] && codeItems[i + 5].instruction;
    if (firstConst == null || firstLocal !== local || op(firstBranch) !== 'if_icmple') continue;
    if (firstConst > lowerBound) continue;

    const firstTarget = findLabelIndex(codeItems, firstBranch.arg);
    if (firstTarget <= i + 5 || firstTarget > i + 10) continue;
    const secondLocal = intLoadLocal(codeItems[firstTarget] && codeItems[firstTarget].instruction);
    const secondConst = integerConstantValue(codeItems[firstTarget + 1] && codeItems[firstTarget + 1].instruction);
    const secondBranch = codeItems[firstTarget + 2] && codeItems[firstTarget + 2].instruction;
    if (secondLocal !== local || secondConst == null || op(secondBranch) !== 'if_icmpge') continue;
    if (labelName(secondBranch.arg) !== labelName(lowerGuard.arg)) continue;
    if (secondConst > lowerBound) continue;

    codeItems[i + 3].instruction = 'nop';
    codeItems[i + 4].instruction = 'nop';
    codeItems[i + 5].instruction = { op: 'goto', arg: labelName(firstBranch.arg) };
    codeItems[firstTarget].instruction = 'nop';
    codeItems[firstTarget + 1].instruction = 'nop';
    codeItems[firstTarget + 2].instruction = { op: 'goto', arg: labelName(secondBranch.arg) };
    rewrites += 2;
  }
  return rewrites;
}

function simplifyDominatedIntEqualityBranches(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_EQUALITY_BRANCHES_MAX_REWRITES || 8);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_EQUALITY_BRANCHES_MAX_DISTANCE || 96);
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let branchIndex = 2; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const current = readIntLocalConstEqualityBranch(codeItems, branchIndex);
    if (!current) continue;
    if (hasAnyLabelReference(codeItems, codeItems[current.loadIndex] && codeItems[current.loadIndex].labelDef)) continue;
    if (hasAnyLabelReference(codeItems, codeItems[current.constIndex] && codeItems[current.constIndex].labelDef)) continue;
    if (hasAnyLabelReference(codeItems, codeItems[current.branchIndex] && codeItems[current.branchIndex].labelDef)) continue;

    const dominator = findDominatingIntEqualityBranch(codeItems, current, maxDistance, refCounts);
    if (!dominator) continue;
    const knownEqual = dominator.op === 'if_icmpne';
    const knownNotEqual = dominator.op === 'if_icmpeq';
    const alwaysTaken = (knownEqual && current.op === 'if_icmpeq') ||
      (knownNotEqual && current.op === 'if_icmpne');
    const alwaysFallthrough = (knownEqual && current.op === 'if_icmpne') ||
      (knownNotEqual && current.op === 'if_icmpeq');
    if (!alwaysTaken && !alwaysFallthrough) continue;

    codeItems[current.loadIndex].instruction = 'nop';
    codeItems[current.constIndex].instruction = 'nop';
    codeItems[current.branchIndex].instruction = alwaysTaken
      ? { op: 'goto', arg: labelName(current.arg) }
      : 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function findDominatingIntEqualityBranch(codeItems, current, maxDistance, refCounts) {
  for (let i = current.loadIndex - 1; i >= 2 && current.loadIndex - i <= maxDistance; i -= 1) {
    const previous = readIntLocalConstEqualityBranch(codeItems, i);
    if (!previous) continue;
    if (previous.local !== current.local || previous.value !== current.value) continue;
    const target = findLabelIndex(codeItems, previous.arg);
    if (target <= current.branchIndex) continue;
    if (hasReferencedLabelsInside(codeItems, previous.branchIndex + 1, current.branchIndex + 1, refCounts)) continue;
    if (rangeWritesLocal(codeItems, previous.branchIndex + 1, current.loadIndex, current.local)) continue;
    return previous;
  }
  return null;
}

function readIntLocalConstEqualityBranch(codeItems, branchIndex) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const branchOp = op(branch);
  if (branchOp !== 'if_icmpeq' && branchOp !== 'if_icmpne') return null;
  const constIndex = previousInstructionIndex(codeItems, branchIndex - 1);
  if (constIndex < 0 || constIndex + 1 !== branchIndex) return null;
  const loadIndex = previousInstructionIndex(codeItems, constIndex - 1);
  if (loadIndex < 0 || loadIndex + 1 !== constIndex) return null;
  let local = intLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction);
  let value = integerConstantValue(codeItems[constIndex] && codeItems[constIndex].instruction);
  if (local == null || value == null) {
    local = intLoadLocal(codeItems[constIndex] && codeItems[constIndex].instruction);
    value = integerConstantValue(codeItems[loadIndex] && codeItems[loadIndex].instruction);
    if (local == null || value == null) return null;
  }
  return {
    loadIndex,
    constIndex,
    branchIndex,
    local,
    value,
    op: branchOp,
    arg: branch.arg,
  };
}

function retargetDuplicateRadixParserLoop(codeItems, method) {
  if (!method || !method.descriptor || !method.descriptor.includes('Ljava/lang/CharSequence;') || !method.descriptor.endsWith(')I')) return 0;
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 1; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isConditionalBranch(op(branch))) continue;
    const messyStart = findLabelIndex(codeItems, branch.arg);
    if (messyStart <= i + 1) continue;
    const messy = readRadixParserLoopInit(codeItems, messyStart);
    if (!messy) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough < 0 || fallthrough >= messyStart) continue;
    const cleanGoto = findForwardGotoBefore(codeItems, fallthrough, messyStart);
    if (cleanGoto < 0) continue;
    if (!hasSameMethodStaticCallBetween(codeItems, fallthrough, cleanGoto, method)) continue;
    const cleanStart = findLabelIndex(codeItems, codeItems[cleanGoto].instruction.arg);
    if (cleanStart <= messyStart) continue;
    const clean = readRadixParserLoopInit(codeItems, cleanStart);
    if (!clean || !sameRadixParserLoopInit(messy, clean)) continue;
    branch.arg = labelName(codeItems[cleanStart] && codeItems[cleanStart].labelDef);
    rewrites += 1;
  }
  return rewrites;
}

function canonicalizeDuplicatedRadixParserLoop(codeItems, code, method) {
  if (!method || method.descriptor !== '(IZILjava/lang/CharSequence;)I') return 0;
  if (!looksLikeDuplicatedRadixParserMethod(codeItems)) return 0;
  const sideEffect = readRadixParserDummySideEffect(codeItems);
  if (!sideEffect) return 0;
  codeItems.splice(0, codeItems.length, ...buildCanonicalRadixParserItems(sideEffect));
  if (code) {
    code.stackSize = Math.max(Number(code.stackSize) || 0, 4);
    code.localsSize = Math.max(Number(code.localsSize) || 0, 11);
    if (Array.isArray(code.exceptionTable)) code.exceptionTable = [];
  }
  return 1;
}

function looksLikeDuplicatedRadixParserMethod(codeItems) {
  if (codeItems.length < 250) return false;
  let charAtCount = 0;
  let lengthCount = 0;
  let nfeCount = 0;
  for (const item of codeItems) {
    const insn = item && item.instruction;
    if (isCharSequenceCharAtInvoke(insn)) charAtCount += 1;
    if (isCharSequenceLengthInvoke(insn)) lengthCount += 1;
    if (op(insn) === 'new' && insn.arg === 'java/lang/NumberFormatException') nfeCount += 1;
  }
  return charAtCount >= 3 && lengthCount >= 2 && nfeCount >= 4;
}

function readRadixParserDummySideEffect(codeItems) {
  for (let i = 0; i + 6 < Math.min(codeItems.length, 1500); i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) !== 2) continue;
    const guardConstant = integerConstantValue(codeItems[i + 1] && codeItems[i + 1].instruction);
    if (guardConstant == null) continue;
    const guard = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (!isIntCompareBranch(op(guard))) continue;
    if (op(codeItems[i + 3] && codeItems[i + 3].instruction) !== 'aconst_null') continue;
    const cast = codeItems[i + 4] && codeItems[i + 4].instruction;
    if (op(cast) !== 'checkcast' || cast.arg !== 'java/lang/String') continue;
    const put = codeItems[i + 5] && codeItems[i + 5].instruction;
    if (op(put) !== 'putstatic' || !Array.isArray(put.arg) || put.arg[0] !== 'Field') continue;
    const nameAndDesc = put.arg[2];
    if (!Array.isArray(nameAndDesc) || nameAndDesc[1] !== 'Ljava/lang/String;') continue;
    const jump = codeItems[i + 6] && codeItems[i + 6].instruction;
    if (op(jump) !== 'goto') continue;
    return { guardConstant, guardOp: op(guard), fieldRef: cloneValue(put.arg) };
  }
  return null;
}

function buildCanonicalRadixParserItems(sideEffect) {
  const items = [];
  const add = (label, instruction) => items.push(label ? { labelDef: `${label}:`, instruction } : { instruction });
  const addNoLabel = (instruction) => add(null, instruction);
  const invoke = (kind, owner, name, descriptor) => ({ op: kind, arg: [kind === 'invokeinterface' ? 'InterfaceMethod' : 'Method', owner, [name, descriptor]] });
  const field = (opName, ref) => ({ op: opName, arg: cloneValue(ref) });
  const newObj = (className) => ({ op: 'new', arg: className });
  const branch = (opName, label) => ({ op: opName, arg: label });

  add('LCKRAD_START', 'iload_0');
  addNoLabel('iconst_2');
  addNoLabel(branch('if_icmplt', 'LCKRAD_BAD_RADIX'));
  addNoLabel('iload_0');
  addNoLabel({ op: 'bipush', arg: '36' });
  addNoLabel(branch('if_icmpgt', 'LCKRAD_BAD_RADIX'));
  addNoLabel('iload_2');
  addNoLabel(intConstantInstruction(sideEffect.guardConstant));
  addNoLabel(branch(sideEffect.guardOp, 'LCKRAD_INIT'));
  addNoLabel('aconst_null');
  addNoLabel({ op: 'checkcast', arg: 'java/lang/String' });
  addNoLabel(field('putstatic', sideEffect.fieldRef));

  add('LCKRAD_INIT', 'iconst_0');
  addNoLabel(intStoreInstruction(4));
  addNoLabel(intConstantInstruction(0));
  addNoLabel(intStoreInstruction(5));
  addNoLabel(intConstantInstruction(0));
  addNoLabel(intStoreInstruction(6));
  addNoLabel(refLoadInstruction(3));
  addNoLabel({ op: 'checkcast', arg: 'java/lang/CharSequence' });
  addNoLabel(invoke('invokeinterface', 'java/lang/CharSequence', 'length', '()I'));
  addNoLabel(intStoreInstruction(7));
  addNoLabel(intConstantInstruction(0));
  addNoLabel(intStoreInstruction(8));

  add('LCKRAD_LOOP', intLoadInstruction(8));
  addNoLabel(intLoadInstruction(7));
  addNoLabel(branch('if_icmpge', 'LCKRAD_DONE'));
  addNoLabel(refLoadInstruction(3));
  addNoLabel({ op: 'checkcast', arg: 'java/lang/CharSequence' });
  addNoLabel(intLoadInstruction(8));
  addNoLabel(invoke('invokeinterface', 'java/lang/CharSequence', 'charAt', '(I)C'));
  addNoLabel(intStoreInstruction(9));
  addNoLabel(intLoadInstruction(8));
  addNoLabel(branch('ifne', 'LCKRAD_DIGIT'));
  addNoLabel(intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '45' });
  addNoLabel(branch('if_icmpne', 'LCKRAD_PLUS'));
  addNoLabel('iconst_1');
  addNoLabel(intStoreInstruction(4));
  addNoLabel({ op: 'iinc', arg: ['8', '1'] });
  addNoLabel({ op: 'goto', arg: 'LCKRAD_LOOP' });
  add('LCKRAD_PLUS', intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '43' });
  addNoLabel(branch('if_icmpne', 'LCKRAD_DIGIT'));
  addNoLabel('iload_1');
  addNoLabel(branch('ifeq', 'LCKRAD_DIGIT'));
  addNoLabel({ op: 'iinc', arg: ['8', '1'] });
  addNoLabel({ op: 'goto', arg: 'LCKRAD_LOOP' });

  add('LCKRAD_DIGIT', intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '48' });
  addNoLabel(branch('if_icmplt', 'LCKRAD_UPPER'));
  addNoLabel(intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '57' });
  addNoLabel(branch('if_icmpgt', 'LCKRAD_UPPER'));
  addNoLabel({ op: 'iinc', arg: ['9', '-48'] });
  addNoLabel({ op: 'goto', arg: 'LCKRAD_DIGIT_OK' });
  add('LCKRAD_UPPER', intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '65' });
  addNoLabel(branch('if_icmplt', 'LCKRAD_LOWER'));
  addNoLabel(intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '90' });
  addNoLabel(branch('if_icmpgt', 'LCKRAD_LOWER'));
  addNoLabel({ op: 'iinc', arg: ['9', '-55'] });
  addNoLabel({ op: 'goto', arg: 'LCKRAD_DIGIT_OK' });
  add('LCKRAD_LOWER', intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '97' });
  addNoLabel(branch('if_icmplt', 'LCKRAD_BAD_NUMBER'));
  addNoLabel(intLoadInstruction(9));
  addNoLabel({ op: 'bipush', arg: '122' });
  addNoLabel(branch('if_icmpgt', 'LCKRAD_BAD_NUMBER'));
  addNoLabel({ op: 'iinc', arg: ['9', '-87'] });

  add('LCKRAD_DIGIT_OK', intLoadInstruction(9));
  addNoLabel('iload_0');
  addNoLabel(branch('if_icmpge', 'LCKRAD_BAD_NUMBER'));
  addNoLabel(intLoadInstruction(4));
  addNoLabel(branch('ifeq', 'LCKRAD_ACCUM'));
  addNoLabel(intLoadInstruction(9));
  addNoLabel('ineg');
  addNoLabel(intStoreInstruction(9));
  add('LCKRAD_ACCUM', intLoadInstruction(6));
  addNoLabel('iload_0');
  addNoLabel('imul');
  addNoLabel(intLoadInstruction(9));
  addNoLabel('iadd');
  addNoLabel(intStoreInstruction(10));
  addNoLabel(intLoadInstruction(10));
  addNoLabel('iload_0');
  addNoLabel('idiv');
  addNoLabel(intLoadInstruction(6));
  addNoLabel(branch('if_icmpne', 'LCKRAD_BAD_NUMBER'));
  addNoLabel(intLoadInstruction(10));
  addNoLabel(intStoreInstruction(6));
  addNoLabel('iconst_1');
  addNoLabel(intStoreInstruction(5));
  addNoLabel({ op: 'iinc', arg: ['8', '1'] });
  addNoLabel({ op: 'goto', arg: 'LCKRAD_LOOP' });

  add('LCKRAD_DONE', intLoadInstruction(5));
  addNoLabel(branch('ifeq', 'LCKRAD_BAD_NUMBER'));
  addNoLabel(intLoadInstruction(6));
  addNoLabel('ireturn');

  add('LCKRAD_BAD_NUMBER', newObj('java/lang/NumberFormatException'));
  addNoLabel('dup');
  addNoLabel(invoke('invokespecial', 'java/lang/NumberFormatException', '<init>', '()V'));
  addNoLabel('athrow');
  add('LCKRAD_BAD_RADIX', newObj('java/lang/IllegalArgumentException'));
  addNoLabel('dup');
  addNoLabel(invoke('invokespecial', 'java/lang/IllegalArgumentException', '<init>', '()V'));
  addNoLabel('athrow');
  return items;
}

function intConstantInstruction(value) {
  if (value === -1) return 'iconst_m1';
  if (value >= 0 && value <= 5) return `iconst_${value}`;
  if (value >= -128 && value <= 127) return { op: 'bipush', arg: String(value) };
  return { op: 'sipush', arg: String(value) };
}

function readRadixParserLoopInit(codeItems, start) {
  const idx = nextInstructionIndexes(codeItems, start, 13);
  if (idx.length < 13) return null;
  const signLocal = zeroStoreLocalAt(codeItems, idx[0], idx[1]);
  const seenDigitLocal = zeroStoreLocalAt(codeItems, idx[2], idx[3]);
  const resultLocal = zeroStoreLocalAt(codeItems, idx[4], idx[5]);
  if (signLocal == null || seenDigitLocal == null || resultLocal == null) return null;
  const sequenceLocal = refLoadLocal(codeItems[idx[6]] && codeItems[idx[6]].instruction);
  if (sequenceLocal == null) return null;
  if (op(codeItems[idx[7]] && codeItems[idx[7]].instruction) === 'checkcast') {
    if (!isCharSequenceTypeArg(codeItems[idx[7]].instruction.arg)) return null;
    if (!isCharSequenceLengthInvoke(codeItems[idx[8]] && codeItems[idx[8]].instruction)) return null;
    const lengthLocal = intStoreLocal(codeItems[idx[9]] && codeItems[idx[9]].instruction);
    const indexLocal = zeroStoreLocalAt(codeItems, idx[10], idx[11]);
    if (lengthLocal == null || indexLocal == null) return null;
    return { signLocal, seenDigitLocal, resultLocal, sequenceLocal, lengthLocal, indexLocal };
  }
  if (!isCharSequenceLengthInvoke(codeItems[idx[7]] && codeItems[idx[7]].instruction)) return null;
  const lengthLocal = intStoreLocal(codeItems[idx[8]] && codeItems[idx[8]].instruction);
  const indexLocal = zeroStoreLocalAt(codeItems, idx[9], idx[10]);
  if (lengthLocal == null || indexLocal == null) return null;
  return { signLocal, seenDigitLocal, resultLocal, sequenceLocal, lengthLocal, indexLocal };
}

function sameRadixParserLoopInit(left, right) {
  return left.signLocal === right.signLocal &&
    left.seenDigitLocal === right.seenDigitLocal &&
    left.resultLocal === right.resultLocal &&
    left.sequenceLocal === right.sequenceLocal &&
    left.lengthLocal === right.lengthLocal &&
    left.indexLocal === right.indexLocal;
}

function hasSameMethodStaticCallBetween(codeItems, start, end, method) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'invokestatic') continue;
    const ref = methodRef(insn);
    if (ref && ref.name === method.name && ref.descriptor === method.descriptor) return true;
  }
  return false;
}

function removeConstantFalseCompareInterrupters(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length; i += 1) {
    const constant = codeItems[i] && codeItems[i].instruction;
    const branchIndex = nextInstructionIndex(codeItems, i + 1);
    if (branchIndex !== i + 1) continue;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConstantFalseBranch(constant, branch)) continue;
    const compareIndex = nextInstructionIndex(codeItems, branchIndex + 1);
    if (compareIndex !== branchIndex + 1) continue;
    if (!isIntCompareBranch(op(codeItems[compareIndex] && codeItems[compareIndex].instruction))) continue;
    codeItems[i].instruction = 'nop';
    codeItems[branchIndex].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function isConstantFalseBranch(constant, branch) {
  return (op(constant) === 'iconst_0' && op(branch) === 'ifne') ||
    (op(constant) === 'iconst_1' && op(branch) === 'ifeq');
}

function isIntCompareBranch(cur) {
  return cur === 'if_icmpeq' ||
    cur === 'if_icmpne' ||
    cur === 'if_icmplt' ||
    cur === 'if_icmpge' ||
    cur === 'if_icmpgt' ||
    cur === 'if_icmple';
}

function simplifyConstantBooleanBranches(codeItems) {
  let rewrites = 0;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 0; i < codeItems.length; i += 1) {
    const constant = codeItems[i] && codeItems[i].instruction;
    const branchIndex = nextInstructionIndex(codeItems, i + 1);
    if (branchIndex !== i + 1) continue;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const constantOp = op(constant);
    const branchOp = op(branch);
    if ((constantOp !== 'iconst_0' && constantOp !== 'iconst_1') ||
      (branchOp !== 'ifeq' && branchOp !== 'ifne')) {
      continue;
    }
    // Another predecessor may jump directly to the branch with its own stack
    // value, bypassing the adjacent constant. Folding from only the fallthrough
    // producer would remove the shared consumer and strand that other value on
    // the operand stack. This is a phi/join, not a constant branch.
    const branchLabel = labelName(codeItems[branchIndex] && codeItems[branchIndex].labelDef);
    if (branchLabel && (refCounts.get(branchLabel) || 0) > 0) continue;
    const value = constantOp === 'iconst_1';
    const taken = (branchOp === 'ifne' && value) || (branchOp === 'ifeq' && !value);
    if (taken) continue;
    codeItems[i].instruction = 'nop';
    codeItems[branchIndex].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function removeDeadAthrowPadding(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_REMOVE_DEAD_ATHROW_PADDING_MAX_REWRITES || 256);
  const droppableHandlerIndexes = new Set();
  const droppableGotoIndexes = new Set();
  if (code && Array.isArray(code.exceptionTable) && code.exceptionTable.length > 0) {
    const dropHandlers = new Set();
    for (const entry of code.exceptionTable) {
      const handler = exceptionTableLabelValue(entry, ['handlerLbl', 'handlerLabel', 'handler', 'usingLbl', 'usingLabel', 'using']);
      const handlerIndex = findLabelIndex(codeItems, handler);
      if (handlerIndex <= 0) continue;
      if (op(codeItems[handlerIndex] && codeItems[handlerIndex].instruction) !== 'athrow') continue;
      const previous = previousInstructionIndex(codeItems, handlerIndex - 1);
      if (previous < 0 || op(codeItems[previous] && codeItems[previous].instruction) !== 'goto') continue;
      const next = nextInstructionIndex(codeItems, handlerIndex + 1);
      if (next >= 0 && findLabelIndex(codeItems, codeItems[previous].instruction.arg) === next) {
        droppableGotoIndexes.add(previous);
      }
      droppableHandlerIndexes.add(handlerIndex);
      dropHandlers.add(labelName(handler));
    }
    if (dropHandlers.size > 0) {
      const before = code.exceptionTable.length;
      code.exceptionTable = code.exceptionTable.filter((entry) => {
        const handler = labelName(exceptionTableLabelValue(entry, ['handlerLbl', 'handlerLabel', 'handler', 'usingLbl', 'usingLabel', 'using']));
        const handlerIndex = findLabelIndex(codeItems, exceptionTableLabelValue(entry, ['handlerLbl', 'handlerLabel', 'handler', 'usingLbl', 'usingLabel', 'using']));
        return !dropHandlers.has(handler) && !droppableHandlerIndexes.has(handlerIndex);
      });
      rewrites += before - code.exceptionTable.length;
    }
  }
  const refCounts = collectLabelReferenceCounts(codeItems);
  const exceptionLabels = collectExceptionTableLabels(codeItems, code);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'athrow') continue;
    const previous = previousInstructionIndex(codeItems, i - 1);
    if (previous < 0 || op(codeItems[previous] && codeItems[previous].instruction) !== 'goto') continue;
    const next = nextInstructionIndex(codeItems, i + 1);
    const gotoFallsThroughAfterAthrow = next >= 0 && findLabelIndex(codeItems, codeItems[previous].instruction.arg) === next;
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!droppableHandlerIndexes.has(i) && label && ((refCounts.get(label) || 0) > 0 || exceptionLabels.has(label))) continue;
    if (gotoFallsThroughAfterAthrow || droppableGotoIndexes.has(previous)) {
      codeItems[previous].instruction = 'nop';
    }
    codeItems[i].instruction = 'nop';
    rewrites += 1;
  }
  return rewrites;
}

function exceptionTableLabelValue(entry, keys) {
  if (!entry) return null;
  for (const key of keys) {
    if (entry[key] != null) return entry[key];
  }
  return null;
}

function collectExceptionTableLabels(codeItems, code) {
  const out = new Set();
  const entries = code && Array.isArray(code.exceptionTable) ? code.exceptionTable : [];
  for (const entry of entries) {
    for (const keys of [
      ['handlerLbl', 'handlerLabel', 'handler', 'usingLbl', 'usingLabel', 'using'],
      ['startLbl', 'startLabel', 'start', 'fromLbl', 'fromLabel', 'from'],
      ['endLbl', 'endLabel', 'end', 'toLbl', 'toLabel', 'to'],
    ]) {
      const index = exceptionTableLabelIndex(codeItems, entry, keys);
      if (index >= 0) {
        const label = labelName(codeItems[index] && codeItems[index].labelDef);
        if (label) out.add(label);
      }
    }
  }
  return out;
}

function cloneSharedChangeLogTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL_MAX_REWRITES || 16);
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 6; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const cur = op(branch);
    if (cur !== 'ifne' && cur !== 'ifeq') continue;
    const isBooleanCallBranch = isBooleanInvoke(codeItems[i - 1] && codeItems[i - 1].instruction);
    const isNullXorBranch = op(codeItems[previousInstructionIndex(codeItems, i - 1)] && codeItems[previousInstructionIndex(codeItems, i - 1)].instruction) === 'ixor';
    if (!isBooleanCallBranch && !isNullXorBranch) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1 || target - i > 96) continue;
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel) continue;
    const targetRefs = refCounts.get(targetLabel) || 0;
    if (isBooleanCallBranch && targetRefs > 1 && !hasRecentNullXorBranchToLabel(codeItems, i, targetLabel, 96)) continue;
    if (isNullXorBranch && targetRefs > 3) continue;
    const tail = readChangeLogSetFlagTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      tail.end,
      tail.joinLabel,
      'LCKCHGLOG',
    );
    i += tail.end - target;
  }
  rewrites += simplifyDuplicateNullXorChangeDetectors(codeItems);
  rewrites += cloneSharedInstanceChangeReturnSummaries(codeItems, code);
  rewrites += nopUnreachableChangedLogTails(codeItems);
  return rewrites;
}

function isBooleanInvoke(insn) {
  const cur = op(insn);
  if (cur !== 'invokevirtual' && cur !== 'invokeinterface') return false;
  const descriptor = methodDescriptor(insn);
  return typeof descriptor === 'string' && descriptor.endsWith(')Z');
}

function isAnyBooleanInvoke(insn) {
  const cur = op(insn);
  if (!isInvokeInstruction(insn)) return false;
  const descriptor = methodDescriptor(insn);
  return typeof descriptor === 'string' && descriptor.endsWith(')Z');
}

function hasRecentNullXorBranchToLabel(codeItems, before, label, maxDistance) {
  const min = Math.max(0, before - maxDistance);
  for (let i = before - 1; i >= min; i -= 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const cur = op(branch);
    if ((cur !== 'ifne' && cur !== 'ifeq') || labelName(branch.arg) !== label) continue;
    const xorIndex = previousInstructionIndex(codeItems, i - 1);
    if (xorIndex >= 0 && op(codeItems[xorIndex] && codeItems[xorIndex].instruction) === 'ixor') return true;
  }
  return false;
}

function readChangeLogSetFlagTail(codeItems, start, options = {}) {
  const ensureJoin = options.ensureJoin !== false;
  let logInvokeIndex = -1;
  let storeIndex = -1;
  let flagLocal = null;
  let sawChangedMessage = false;
  const limit = Math.min(codeItems.length, start + 80);
  for (let i = start; i < limit; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'goto' || isConditionalBranch(cur) || isReturnOp(cur) || cur === 'athrow') break;
    if (isChangedMessageConstant(codeItems[i] && codeItems[i].instruction)) sawChangedMessage = true;
    const ref = methodRef(codeItems[i] && codeItems[i].instruction);
    if (ref && methodDescriptor(codeItems[i] && codeItems[i].instruction) &&
      methodDescriptor(codeItems[i] && codeItems[i].instruction).endsWith(')V') &&
      (ref.owner === 'java/io/PrintStream' || cur === 'invokestatic')) {
      logInvokeIndex = i;
    }
    if (op(codeItems[i] && codeItems[i].instruction) === 'iconst_1') {
      const store = intStoreLocal(codeItems[i + 1] && codeItems[i + 1].instruction);
      if (store != null) {
        storeIndex = i + 1;
        flagLocal = store;
      }
    }
  }
  if (!sawChangedMessage || logInvokeIndex < 0 || storeIndex < 0) return null;

  const end = Math.max(logInvokeIndex + 1, storeIndex + 1);
  if (flagLocal == null) return null;
  const joinIndex = nextInstructionIndex(codeItems, end);
  if (joinIndex < 0) return null;
  const joinLabel = ensureJoin
    ? ensureFreshLabel(codeItems, joinIndex, 'LCKCHGLOG_JOIN')
    : labelName(codeItems[joinIndex] && codeItems[joinIndex].labelDef);
  return { end, joinLabel };
}

function isChangedMessageConstant(insn) {
  const cur = op(insn);
  if (cur !== 'ldc' && cur !== 'ldc_w') return false;
  return typeof insn.arg === 'string' && insn.arg.includes(' has changed. before=');
}

function cloneSharedInstanceChangeReturnSummaries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_INSTANCE_CHANGE_RETURN_MAX_REWRITES || 24);
  const refCounts = collectLabelReferenceCounts(codeItems);
  const candidates = [];
  for (let start = 0; start < codeItems.length; start += 1) {
    const summary = readInstanceChangeReturnSummary(codeItems, start);
    if (!summary) continue;
    const targetLabel = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!targetLabel) continue;
    const refCount = refCounts.get(targetLabel) || 0;
    if (refCount < 2 || refCount > 4) continue;
    if (rangeTouchesExceptionTable(code, codeItems, start, summary.end)) continue;
    const refs = collectLabelReferencesDetailed(codeItems, targetLabel)
      .filter((refIndex) => refIndex < start);
    if (refs.length !== refCount) continue;
    if (!refs.every((refIndex) => {
      const cur = op(codeItems[refIndex] && codeItems[refIndex].instruction);
      return cur === 'goto' || isConditionalBranch(cur);
    })) continue;
    candidates.push({ start, end: summary.end, refs });
  }

  for (const candidate of candidates) {
    for (const refIndex of [...candidate.refs].sort((a, b) => b - a)) {
      if (rewrites >= maxRewrites) return rewrites;
      const cur = op(codeItems[refIndex] && codeItems[refIndex].instruction);
      if (cur === 'goto') {
        rewrites += cloneGotoRangeAt(codeItems, code, refIndex, candidate.start, candidate.end, 'LCKINSTRET');
      } else if (isConditionalBranch(cur)) {
        rewrites += cloneConditionalRangeAfterBranch(codeItems, code, refIndex, candidate.start, candidate.end, 'LCKINSTRET');
      }
    }
  }
  return rewrites;
}

function readInstanceChangeReturnSummary(codeItems, start) {
  const flagLocal = intLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (flagLocal == null) return null;
  const printBranch = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (op(printBranch) !== 'ifne') return null;
  const returnJump = codeItems[start + 2] && codeItems[start + 2].instruction;
  if (op(returnJump) !== 'goto') return null;
  const printIndex = findLabelIndex(codeItems, printBranch.arg);
  const returnIndex = findLabelIndex(codeItems, returnJump.arg);
  if (printIndex !== start + 3 || returnIndex !== start + 6) return null;
  if (op(codeItems[printIndex] && codeItems[printIndex].instruction) !== 'getstatic') return null;
  if (!isInstanceChangedMessageConstant(codeItems[printIndex + 1] && codeItems[printIndex + 1].instruction)) return null;
  if (!isPrintStringInvoke(codeItems[printIndex + 2] && codeItems[printIndex + 2].instruction)) return null;
  if (!isReturnOp(op(codeItems[returnIndex] && codeItems[returnIndex].instruction))) return null;
  return { flagLocal, end: returnIndex + 1 };
}

function isInstanceChangedMessageConstant(insn) {
  const cur = op(insn);
  if (cur !== 'ldc' && cur !== 'ldc_w') return false;
  return typeof insn.arg === 'string' &&
    insn.arg.startsWith('This instance of ') &&
    insn.arg.endsWith(' has changed');
}

function isPrintStringInvoke(insn) {
  const ref = methodRef(insn);
  return !!ref &&
    op(insn) === 'invokevirtual' &&
    ref.owner === 'java/io/PrintStream' &&
    ref.name === 'println' &&
    methodDescriptor(insn) === '(Ljava/lang/String;)V';
}

function simplifyDuplicateNullXorChangeDetectors(codeItems) {
  let rewrites = 0;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 0; i < codeItems.length; i += 1) {
    const first = readBooleanizedNullFieldCheck(codeItems, i);
    if (!first) continue;
    const second = readBooleanizedNullFieldCheck(codeItems, first.end);
    if (!second || !sameFieldCheck(first, second)) continue;
    if (first.whenNull !== second.whenNull || first.whenNonNull !== second.whenNonNull) continue;
    const xorIndex = second.end;
    if (op(codeItems[xorIndex] && codeItems[xorIndex].instruction) !== 'ixor') continue;
    const branchIndex = nextInstructionIndex(codeItems, xorIndex + 1);
    if (branchIndex !== xorIndex + 1) continue;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;
    const takenLabel = labelName(branch.arg);
    const takenIndex = findLabelIndex(codeItems, takenLabel);
    if (!takenLabel || takenIndex <= branchIndex) continue;
    const replacementLabel = branchOp === 'ifeq'
      ? takenLabel
      : ensureFreshLabel(codeItems, branchIndex + 1, 'LCKNULLXOR_FALSE');
    if (!rangeLabelsAreInternal(codeItems, refCounts, i + 1, branchIndex + 1)) continue;

    const replacement = cloneItems(codeItems.slice(first.exprStart, first.exprEnd))
      .map((item) => item.instruction)
      .filter(Boolean);
    if (!replacement.length) continue;
    replacement.push('pop', { op: 'goto', arg: replacementLabel });
    for (let j = i; j <= branchIndex; j += 1) {
      const next = replacement[j - i];
      codeItems[j].instruction = next ? cloneInstruction(next) : 'nop';
    }
    rewrites += 1;
    i = branchIndex;
  }
  return rewrites;
}

function readBooleanizedNullFieldCheck(codeItems, start) {
  let exprStart = start;
  let nullFirst = false;
  if (op(codeItems[exprStart] && codeItems[exprStart].instruction) === 'aconst_null') {
    nullFirst = true;
    exprStart += 1;
  }
  const expr = readReferenceFieldLoad(codeItems, exprStart);
  if (!expr) return null;
  const branchIndex = expr.end;
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const branchOp = op(branch);
  let trueWhenNull;
  if (nullFirst) {
    if (branchOp === 'if_acmpeq') trueWhenNull = true;
    else if (branchOp === 'if_acmpne') trueWhenNull = false;
    else return null;
  } else if (branchOp === 'ifnull') {
    trueWhenNull = true;
  } else if (branchOp === 'ifnonnull') {
    trueWhenNull = false;
  } else {
    return null;
  }

  const fallthroughValue = integerConstantValue(codeItems[branchIndex + 1] && codeItems[branchIndex + 1].instruction);
  if (fallthroughValue !== 0 && fallthroughValue !== 1) return null;
  const jump = codeItems[branchIndex + 2] && codeItems[branchIndex + 2].instruction;
  if (op(jump) !== 'goto') return null;
  const target = findLabelIndex(codeItems, branch.arg);
  if (target <= branchIndex + 2) return null;
  const targetValue = integerConstantValue(codeItems[target] && codeItems[target].instruction);
  if (targetValue !== 0 && targetValue !== 1) return null;
  const join = findLabelIndex(codeItems, jump.arg);
  if (join <= target) return null;

  return {
    exprStart,
    exprEnd: expr.end,
    end: join,
    local: expr.local,
    field: expr.field,
    whenNull: trueWhenNull ? targetValue : fallthroughValue,
    whenNonNull: trueWhenNull ? fallthroughValue : targetValue,
  };
}

function readReferenceFieldLoad(codeItems, start) {
  const local = refLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (local == null) return null;
  let index = start + 1;
  if (op(codeItems[index] && codeItems[index].instruction) === 'checkcast') index += 1;
  const fieldInsn = codeItems[index] && codeItems[index].instruction;
  if (op(fieldInsn) !== 'getfield') return null;
  const field = fieldRef(fieldInsn);
  if (!field || typeof field.descriptor !== 'string' ||
    (!field.descriptor.startsWith('L') && !field.descriptor.startsWith('['))) return null;
  return { local, field, end: index + 1 };
}

function sameFieldCheck(left, right) {
  return left.local === right.local &&
    left.field.owner === right.field.owner &&
    left.field.name === right.field.name &&
    left.field.descriptor === right.field.descriptor;
}

function rangeLabelsAreInternal(codeItems, refCounts, start, end) {
  for (let i = start; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label && (refCounts.get(label) || 0) > 1) return false;
  }
  return true;
}

function nopUnreachableChangedLogTails(codeItems) {
  let rewrites = 0;
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 1; i < codeItems.length; i += 1) {
    const prev = previousInstructionIndex(codeItems, i - 1);
    if (prev < 0 || !isUnconditionalTerminal(op(codeItems[prev] && codeItems[prev].instruction))) continue;
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label && (refCounts.get(label) || 0) > 0) continue;
    const tail = readChangeLogSetFlagTail(codeItems, i, { ensureJoin: false });
    if (!tail) continue;
    let end = tail.end;
    const jumpIndex = nextInstructionIndex(codeItems, end);
    if (jumpIndex === end && op(codeItems[jumpIndex] && codeItems[jumpIndex].instruction) === 'goto') {
      const jumpLabel = labelName(codeItems[jumpIndex] && codeItems[jumpIndex].labelDef);
      if (!jumpLabel || (refCounts.get(jumpLabel) || 0) === 0) end = jumpIndex + 1;
    }
    for (let j = i; j < end; j += 1) {
      if (codeItems[j] && codeItems[j].instruction) codeItems[j].instruction = 'nop';
    }
    rewrites += 1;
    i = end;
  }
  return rewrites;
}

function materializeConditionalIntConstantCompareBounds(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 8; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const trueValueIndex = findLabelIndex(codeItems, branch.arg);
    if (trueValueIndex <= i + 2) continue;
    const falseValueIndex = nextInstructionIndex(codeItems, i + 1);
    if (falseValueIndex !== i + 1) continue;
    if (!isIntegerConstant(codeItems[falseValueIndex] && codeItems[falseValueIndex].instruction)) continue;
    const gotoIndex = nextInstructionIndex(codeItems, falseValueIndex + 1);
    if (gotoIndex !== falseValueIndex + 1) continue;
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const joinIndex = findLabelIndex(codeItems, jump.arg);
    if (joinIndex <= trueValueIndex) continue;
    if (!isIntegerConstant(codeItems[trueValueIndex] && codeItems[trueValueIndex].instruction)) continue;
    const afterTrue = nextInstructionIndex(codeItems, trueValueIndex + 1);
    if (afterTrue !== joinIndex) continue;
    if (!readCompareAfterSelectedBound(codeItems, joinIndex)) continue;

    // Materialization stores the selected value through a temp local and reloads
    // it once at the join. That is only sound when this select EXCLUSIVELY owns
    // both the true-value slot and the join: if any other branch also targets
    // the true-value label, or any other goto targets the join label (a shared
    // multi-way selector funnelling several conditions into one bound compare),
    // those paths never execute the istore/iload we insert, so the reloaded
    // join runs one operand short — a stack underflow CFR reports as
    // "Exception decompiling". Require sole ownership before rewriting.
    const trueRefs = collectLabelReferencesDetailed(codeItems, branch.arg);
    const joinRefs = collectLabelReferencesDetailed(codeItems, jump.arg);
    if (trueRefs.length !== 1 || trueRefs[0] !== i) continue;
    if (joinRefs.length !== 1 || joinRefs[0] !== gotoIndex) continue;

    ensureFreshLabel(codeItems, joinIndex, 'LCKCSEL_JOIN');
    const tempLocal = chooseFreshIntLocal(codeItems, code);
    codeItems.splice(gotoIndex, 0, { instruction: { op: 'istore', arg: String(tempLocal) } });
    const shiftedTrueValueIndex = trueValueIndex + 1;
    codeItems.splice(shiftedTrueValueIndex + 1, 0, { instruction: { op: 'istore', arg: String(tempLocal) } });
    const shiftedJoinIndex = joinIndex + 2;
    codeItems.splice(shiftedJoinIndex, 0, { instruction: intLoadInstruction(tempLocal) });
    rewrites += 1;
    i = shiftedJoinIndex;
  }
  return rewrites;
}

function readCompareAfterSelectedBound(codeItems, joinIndex) {
  const first = codeItems[joinIndex] && codeItems[joinIndex].instruction;
  if (isIntCompareBranch(op(first))) return { compareIndex: joinIndex };
  const secondIndex = nextInstructionIndex(codeItems, joinIndex + 1);
  if (secondIndex !== joinIndex + 1) return null;
  const thirdIndex = nextInstructionIndex(codeItems, secondIndex + 1);
  if (thirdIndex !== secondIndex + 1) return null;
  if (op(first) === 'iconst_m1' &&
    op(codeItems[secondIndex] && codeItems[secondIndex].instruction) === 'ixor' &&
    isIntCompareBranch(op(codeItems[thirdIndex] && codeItems[thirdIndex].instruction))) {
    return { compareIndex: thirdIndex };
  }
  return null;
}

function cloneSharedRendererBooleanSelectors(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_RENDERER_BOOLEAN_SELECTOR_MAX_REWRITES || 12);
  for (let falseIndex = 0; falseIndex + 1 < codeItems.length && rewrites < maxRewrites; falseIndex += 1) {
    const selector = readSharedRendererBooleanSelector(codeItems, falseIndex);
    if (!selector) continue;
    for (const refIndex of selector.refs.slice().sort((a, b) => b - a)) {
      if (rewrites >= maxRewrites) return rewrites;
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        refIndex,
        selector.falseIndex,
        selector.falseIndex + 1,
        selector.joinLabel,
        'LCKRBOOL',
      );
    }
    falseIndex = selector.joinIndex;
  }
  return rewrites;
}

function readSharedRendererBooleanSelector(codeItems, falseIndex) {
  const falseLabel = labelName(codeItems[falseIndex] && codeItems[falseIndex].labelDef);
  if (!falseLabel || op(codeItems[falseIndex] && codeItems[falseIndex].instruction) !== 'iconst_0') return null;
  const joinIndex = nextInstructionIndex(codeItems, falseIndex + 1);
  if (joinIndex !== falseIndex + 1) return null;
  const joinLabel = labelName(codeItems[joinIndex] && codeItems[joinIndex].labelDef) || ensureFreshLabel(codeItems, joinIndex, 'LCKRBOOL_JOIN');
  const storeLocal = intStoreLocal(codeItems[joinIndex] && codeItems[joinIndex].instruction);
  if (storeLocal == null) return null;

  const trueJumpIndex = previousInstructionIndex(codeItems, falseIndex - 1);
  const trueValueIndex = previousInstructionIndex(codeItems, trueJumpIndex - 1);
  if (trueValueIndex < 0 || trueJumpIndex < 0) return null;
  if (op(codeItems[trueValueIndex] && codeItems[trueValueIndex].instruction) !== 'iconst_1') return null;
  if (op(codeItems[trueJumpIndex] && codeItems[trueJumpIndex].instruction) !== 'goto' ||
    labelName(codeItems[trueJumpIndex].instruction.arg) !== joinLabel) return null;

  const refs = collectLabelReferencesDetailed(codeItems, falseLabel)
    .filter((refIndex) => refIndex < falseIndex && isConditionalBranch(op(codeItems[refIndex] && codeItems[refIndex].instruction)));
  if (refs.length < 3 || refs.length > 5) return null;
  if (refs.some((refIndex) => {
    const fallthrough = nextInstructionIndex(codeItems, refIndex + 1);
    return fallthrough < 0 || fallthrough >= falseIndex;
  })) return null;

  const callRef = refs.find((refIndex) => {
    const beforeCall = previousInstructionIndex(codeItems, refIndex - 1);
    const beforeArg = previousInstructionIndex(codeItems, beforeCall - 1);
    return beforeCall >= 0 &&
      op(codeItems[refIndex] && codeItems[refIndex].instruction) === 'ifeq' &&
      isAnyBooleanInvoke(codeItems[beforeCall] && codeItems[beforeCall].instruction) &&
      integerConstantValue(codeItems[beforeArg] && codeItems[beforeArg].instruction) === 0;
  });
  if (callRef == null) return null;

  const staticFalseRefs = refs.filter((refIndex) => {
    const loadIndex = previousInstructionIndex(codeItems, refIndex - 1);
    const load = codeItems[loadIndex] && codeItems[loadIndex].instruction;
    return loadIndex >= 0 &&
      op(load) === 'getstatic' &&
      fieldDescriptor(load) === 'Z';
  });
  if (staticFalseRefs.length < 2) return null;
  if (!staticFalseRefs.some((refIndex) => Math.abs(callRef - refIndex) <= 48)) return null;

  if (!hasNearbyObjectBooleanGate(codeItems, falseLabel, staticFalseRefs[0], callRef)) return null;
  if (!hasDownstreamBooleanCallUsingLocal(codeItems, joinIndex + 1, storeLocal)) return null;
  return { falseIndex, joinIndex, joinLabel, refs };
}

function cloneSharedConditionalRenderTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_CONDITIONAL_RENDER_TAIL_MAX_REWRITES || 8);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKCRT_')) continue;
    const tail = readSharedConditionalRenderTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > 8) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        target,
        tail.end,
        tail.exitLabel,
        'LCKCRT',
      );
      if (changed) rewrites += changed;
    }
    target = tail.end;
  }
  return rewrites;
}

function cloneSharedRenderChoiceTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_RENDER_CHOICE_TAIL_MAX_REWRITES || 8);
  for (let falseStart = 0; falseStart < codeItems.length && rewrites < maxRewrites; falseStart += 1) {
    const falseTail = readRenderChoiceFalseTail(codeItems, falseStart);
    if (!falseTail) continue;
    const falseLabel = labelName(codeItems[falseStart] && codeItems[falseStart].labelDef);
    if (!falseLabel || isStructuredGotoCloneLabel(codeItems[falseStart], 'LCKRCT_')) continue;
    const trueStart = findRenderChoiceTrueTailForJoin(codeItems, falseStart, falseTail.exitLabel);
    if (trueStart < 0) continue;
    const trueTail = readRenderChoiceTrueTail(codeItems, trueStart);
    if (!trueTail || trueTail.exitLabel !== falseTail.exitLabel) continue;
    if (rangeTouchesExceptionTable(code, codeItems, falseStart, falseTail.end)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, trueStart, trueTail.end)) continue;

    const refs = collectLabelReferencesByLabel(codeItems);
    const falseRefs = (refs.get(falseLabel) || [])
      .filter((ref) => ref < falseStart && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    const trueLabel = labelName(codeItems[trueStart] && codeItems[trueStart].labelDef);
    const trueRefs = (refs.get(trueLabel) || [])
      .filter((ref) => ref < trueStart && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    if (falseRefs.length + trueRefs.length < 2) continue;

    for (const ref of falseRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        falseStart,
        falseTail.end,
        falseTail.exitLabel,
        'LCKRCT',
      );
    }
    for (const ref of trueRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        trueStart,
        trueTail.end,
        trueTail.exitLabel,
        'LCKRCT',
      );
    }
    falseStart = Math.max(falseStart, falseTail.end);
  }
  return rewrites;
}

function findRenderChoiceTrueTailForJoin(codeItems, falseStart, exitLabel) {
  const limit = Math.min(codeItems.length, falseStart + 32);
  for (let i = Math.max(0, falseStart - 24); i < limit; i += 1) {
    const tail = readRenderChoiceTrueTail(codeItems, i);
    if (tail && tail.exitLabel === exitLabel) return i;
  }
  return -1;
}

function readRenderChoiceTrueTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 8);
  if (indexes.length < 6) return null;
  if (!isGetStaticDescriptor(codeItems[indexes[0]] && codeItems[indexes[0]].instruction, 'Lkv;')) return null;
  if (intLoadLocal(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) == null) return null;
  if (integerConstantValue(codeItems[indexes[2]] && codeItems[indexes[2]].instruction) == null) return null;
  if (integerConstantValue(codeItems[indexes[3]] && codeItems[indexes[3]].instruction) == null) return null;
  if (!isInvokeDescriptor(codeItems[indexes[4]] && codeItems[indexes[4]].instruction, '(III)V')) return null;
  const jump = codeItems[indexes[5]] && codeItems[indexes[5]].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  if (!exitLabel || findLabelIndex(codeItems, exitLabel) <= indexes[5]) return null;
  return { end: indexes[5], exitLabel };
}

function readRenderChoiceFalseTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 16);
  if (indexes.length < 12) return null;
  const receiverLocal = refLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction);
  if (receiverLocal == null) return null;
  if (op(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) !== 'checkcast') return null;
  if (!isGetFieldDescriptor(codeItems[indexes[2]] && codeItems[indexes[2]].instruction, 'Llna;')) return null;
  let invokeIndex = -1;
  for (let i = 3; i < indexes.length; i += 1) {
    if (isInvokeDescriptor(codeItems[indexes[i]] && codeItems[indexes[i]].instruction, '(IIIIII)V')) {
      invokeIndex = indexes[i];
      break;
    }
  }
  if (invokeIndex < 0) return null;
  const jumpIndex = nextInstructionIndex(codeItems, invokeIndex + 1);
  if (jumpIndex < 0 || op(codeItems[jumpIndex] && codeItems[jumpIndex].instruction) !== 'goto') return null;
  const exitLabel = labelName(codeItems[jumpIndex].instruction.arg);
  if (!exitLabel || findLabelIndex(codeItems, exitLabel) <= jumpIndex) return null;
  return { end: jumpIndex, exitLabel };
}

function readSharedConditionalRenderTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 16);
  if (indexes.length < 14) return null;
  const sourceLocal = intLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction);
  const storedLocal = intStoreLocal(codeItems[indexes[1]] && codeItems[indexes[1]].instruction);
  if (sourceLocal == null || storedLocal == null || sourceLocal === storedLocal) return null;
  if (integerConstantValue(codeItems[indexes[2]] && codeItems[indexes[2]].instruction) !== 0) return null;
  if (!isInvokeDescriptor(codeItems[indexes[3]] && codeItems[indexes[3]].instruction, '(Z)Z')) return null;
  const branch = codeItems[indexes[4]] && codeItems[indexes[4]].instruction;
  if (op(branch) !== 'ifne' && op(branch) !== 'ifeq') return null;
  if (integerConstantValue(codeItems[indexes[5]] && codeItems[indexes[5]].instruction) == null) return null;
  if (op(codeItems[indexes[6]] && codeItems[indexes[6]].instruction) !== 'goto') return null;
  const selectedIndex = findLabelIndex(codeItems, branch.arg);
  if (selectedIndex !== indexes[7]) return null;
  if (integerConstantValue(codeItems[indexes[7]] && codeItems[indexes[7]].instruction) == null) return null;
  const joinIndex = findLabelIndex(codeItems, codeItems[indexes[6]].instruction.arg);
  if (joinIndex !== indexes[8]) return null;
  let invokeIndex = -1;
  for (let i = 8; i < indexes.length; i += 1) {
    if (isInvokeDescriptor(codeItems[indexes[i]] && codeItems[indexes[i]].instruction, '(IIIZ)V')) {
      invokeIndex = indexes[i];
      break;
    }
  }
  if (invokeIndex < 0) return null;
  let usesStoredLocal = false;
  for (let i = indexes[8]; i < invokeIndex; i += 1) {
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) === storedLocal) usesStoredLocal = true;
  }
  if (!usesStoredLocal) return null;
  const jumpIndex = nextInstructionIndex(codeItems, invokeIndex + 1);
  if (jumpIndex < 0 || op(codeItems[jumpIndex] && codeItems[jumpIndex].instruction) !== 'goto') return null;
  const exitLabel = labelName(codeItems[jumpIndex].instruction.arg);
  const exitIndex = findLabelIndex(codeItems, exitLabel);
  if (!exitLabel || exitIndex <= jumpIndex) return null;
  return { end: jumpIndex, exitLabel };
}

function hasNearbyObjectBooleanGate(codeItems, falseLabel, startRef, callRef) {
  const min = Math.max(0, startRef - 32);
  for (let i = min; i < callRef; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isConditionalBranch(op(branch)) || labelName(branch.arg) === falseLabel) continue;
    const getIndex = previousInstructionIndex(codeItems, i - 1);
    if (getIndex < 1) continue;
    const get = codeItems[getIndex] && codeItems[getIndex].instruction;
    const recv = codeItems[previousInstructionIndex(codeItems, getIndex - 1)] &&
      codeItems[previousInstructionIndex(codeItems, getIndex - 1)].instruction;
    if (op(get) !== 'getfield' || fieldDescriptor(get) !== 'Z') continue;
    if (op(recv) !== 'getstatic') continue;
    const trueTarget = findLabelIndex(codeItems, branch.arg);
    if (trueTarget > i && trueTarget <= callRef) return true;
  }
  return false;
}

function hasDownstreamBooleanCallUsingLocal(codeItems, start, selectedLocal) {
  const limit = Math.min(codeItems.length, start + 40);
  let sawSelectedLocal = false;
  for (let i = start; i < limit; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (isReturnOp(cur) || cur === 'athrow') return false;
    if (intLoadLocal(codeItems[i] && codeItems[i].instruction) === selectedLocal) sawSelectedLocal = true;
    if (sawSelectedLocal && op(codeItems[i] && codeItems[i].instruction) === 'invokestatic' &&
      methodDescriptor(codeItems[i] && codeItems[i].instruction) === '(ZZ)V') return true;
    if (cur === 'goto') {
      const target = findLabelIndex(codeItems, codeItems[i] && codeItems[i].instruction && codeItems[i].instruction.arg);
      if (target <= i || target >= limit) return false;
    }
  }
  return false;
}

function cloneSharedStaticBooleanRenderRestoreTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_BOOLEAN_RENDER_RESTORE_TAIL_MAX_REWRITES || 4);
  for (let branchIndex = 1; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifne' && branchOp !== 'ifeq') continue;
    const staticField = fieldRef(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction);
    if (!staticField || op(codeItems[branchIndex - 1].instruction) !== 'getstatic' || staticField.descriptor !== 'Z') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    const tail = readStaticBooleanRenderRestoreTail(codeItems, target, staticField);
    if (!tail) continue;
    const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
    if (fallthrough < 0 || fallthrough >= target) continue;
    if (!hasRenderRestoreSourceFallthrough(codeItems, fallthrough, tail.flagLocal, tail.exitLabel)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branchIndex,
      target,
      tail.end,
      tail.exitLabel,
      'LCKRREST',
    );
    if (changed) {
      rewrites += changed;
      branchIndex += tail.end - target;
    }
  }
  return rewrites;
}

function readStaticBooleanRenderRestoreTail(codeItems, start, staticField) {
  const receiver = codeItems[start] && codeItems[start].instruction;
  if (op(receiver) !== 'getstatic' || !isObjectDescriptor(fieldDescriptor(receiver))) return null;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'iconst_1') return null;
  if (!isInvokeDescriptor(codeItems[start + 2] && codeItems[start + 2].instruction, '(Z)V')) return null;
  const flagLocal = intLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction);
  const falseBranch = codeItems[start + 4] && codeItems[start + 4].instruction;
  if (flagLocal == null || (op(falseBranch) !== 'ifeq' && op(falseBranch) !== 'ifne')) return null;
  const restoreGoto = codeItems[start + 5] && codeItems[start + 5].instruction;
  if (op(restoreGoto) !== 'goto') return null;
  const falseIndex = findLabelIndex(codeItems, falseBranch.arg);
  const restoreIndex = findLabelIndex(codeItems, restoreGoto.arg);
  if (falseIndex <= start + 5 || restoreIndex <= falseIndex) return null;
  if (op(codeItems[falseIndex] && codeItems[falseIndex].instruction) !== 'getstatic') return null;
  if (!isObjectDescriptor(fieldDescriptor(codeItems[falseIndex] && codeItems[falseIndex].instruction))) return null;
  if (op(codeItems[falseIndex + 1] && codeItems[falseIndex + 1].instruction) !== 'iconst_0') return null;
  if (op(codeItems[falseIndex + 2] && codeItems[falseIndex + 2].instruction) !== 'iconst_0') return null;
  if (!isInvokeDescriptor(codeItems[falseIndex + 3] && codeItems[falseIndex + 3].instruction, '(II)V')) return null;
  if (nextInstructionIndex(codeItems, falseIndex + 4) !== restoreIndex) return null;
  if (intLoadLocal(codeItems[restoreIndex] && codeItems[restoreIndex].instruction) == null) return null;
  const restoreField = fieldRef(codeItems[restoreIndex + 1] && codeItems[restoreIndex + 1].instruction);
  if (op(codeItems[restoreIndex + 1] && codeItems[restoreIndex + 1].instruction) !== 'putstatic') return null;
  if (!sameFieldRef(staticField, restoreField)) return null;
  return { end: restoreIndex, exitLabel: labelName(codeItems[restoreIndex] && codeItems[restoreIndex].labelDef), flagLocal };
}

function hasRenderRestoreSourceFallthrough(codeItems, start, flagLocal, exitLabel) {
  if (integerConstantValue(codeItems[start] && codeItems[start].instruction) == null) return false;
  const sideEffect = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (op(sideEffect) !== 'invokestatic' || methodDescriptor(sideEffect) !== '(B)V') return false;
  if (intLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction) !== flagLocal) return false;
  const branch = codeItems[start + 3] && codeItems[start + 3].instruction;
  if (!isConditionalBranch(op(branch))) return false;
  return labelName(branch.arg) === labelName(exitLabel);
}

function cloneSharedStaticInvokeJoinTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_INVOKE_JOIN_TAIL_MAX_REWRITES || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSIJT_')) continue;
    const tail = readStaticInvokeJoinTail(codeItems, target);
    if (!tail) continue;
    if (!hasImmediateFallthroughPredecessor(codeItems, target)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > 4) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        target,
        tail.end,
        tail.exitLabel,
        'LCKSIJT',
      );
      if (changed) rewrites += changed;
    }
    target = tail.end;
  }
  return rewrites;
}

function cloneSharedForwardBooleanPredicatePrefixes(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_BOOLEAN_PREDICATE_PREFIX_MAX_REWRITES || 8);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_BOOLEAN_PREDICATE_PREFIX_MAX_REFS || 4);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKBPRED_')) continue;
    const prefix = readSharedForwardBooleanPredicatePrefix(codeItems, target);
    if (!prefix) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, prefix.end)) continue;
    const refs = (collectLabelReferencesByLabel(codeItems).get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRefs) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneConditionalPredicatePrefixAfterBranch(
        codeItems,
        code,
        ref,
        targetLabel,
        'LCKBPRED',
      );
      if (changed) rewrites += changed;
    }
    target = prefix.end;
  }
  return rewrites;
}

function cloneConditionalPredicatePrefixAfterBranch(codeItems, code, branchIndex, targetLabel, prefixName) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const branchOp = op(branch);
  if (!isConditionalBranch(branchOp)) return 0;
  const target = findLabelIndex(codeItems, targetLabel);
  if (target <= branchIndex) return 0;
  const prefix = readSharedForwardBooleanPredicatePrefix(codeItems, target);
  if (!prefix || rangeTouchesExceptionTable(code, codeItems, target, prefix.end)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough < 0 || fallthrough >= target) return 0;
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefixName}F_${cloneId}`);
  const successLabel = ensureFreshLabel(codeItems, prefix.success, `${prefixName}S_${cloneId}`);
  const clone = cloneItems(codeItems.slice(target, prefix.end));
  renameInternalLabels(clone, `${prefixName}_${cloneId}_`);
  clone.push({ instruction: { op: 'goto', arg: successLabel } });
  branch.op = invertConditionalBranch(branchOp);
  branch.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function readSharedForwardBooleanPredicatePrefix(codeItems, start) {
  const maxEnd = Math.min(codeItems.length, start + 12);
  let invokeIndex = -1;
  for (let i = start; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    if (isReturnOp(cur) || cur === 'athrow' || cur === 'goto') return null;
    if (isConditionalBranch(cur)) {
      if (invokeIndex < 0) return null;
      if (previousInstructionIndex(codeItems, i - 1) !== invokeIndex) return null;
      const exit = findLabelIndex(codeItems, insn.arg);
      if (exit <= i || exit - start > 260) return null;
      const success = nextInstructionIndex(codeItems, i + 1);
      if (success !== i + 1) return null;
      return { end: success, success, exit };
    }
    if (isInvokeInstruction(insn)) {
      if (invokeIndex >= 0) return null;
      const descriptor = methodDescriptor(insn);
      if (!descriptor || !descriptor.endsWith(')Z')) return null;
      invokeIndex = i;
      continue;
    }
    if (!isBooleanPredicatePrefixOp(cur)) return null;
  }
  return null;
}

function isBooleanPredicatePrefixOp(cur) {
  return cur === 'aload_0' ||
    cur === 'aload_1' ||
    cur === 'aload_2' ||
    cur === 'aload_3' ||
    cur === 'aload' ||
    cur === 'iload_0' ||
    cur === 'iload_1' ||
    cur === 'iload_2' ||
    cur === 'iload_3' ||
    cur === 'iload' ||
    cur === 'aconst_null' ||
    cur === 'iconst_m1' ||
    cur === 'iconst_0' ||
    cur === 'iconst_1' ||
    cur === 'iconst_2' ||
    cur === 'iconst_3' ||
    cur === 'iconst_4' ||
    cur === 'iconst_5' ||
    cur === 'bipush' ||
    cur === 'sipush' ||
    cur === 'ldc' ||
    cur === 'ldc_w' ||
    cur === 'getstatic' ||
    cur === 'getfield' ||
    cur === 'aaload' ||
    cur === 'iaload' ||
    cur === 'baload' ||
    cur === 'caload' ||
    cur === 'saload' ||
    cur === 'checkcast' ||
    cur === 'iadd' ||
    cur === 'isub' ||
    cur === 'imul' ||
    cur === 'idiv' ||
    cur === 'irem' ||
    cur === 'ishl' ||
    cur === 'ishr' ||
    cur === 'iushr' ||
    cur === 'iand' ||
    cur === 'ior' ||
    cur === 'ixor' ||
    cur === 'ineg';
}

function cloneSharedStaticZeroPairGotoResets(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ZERO_PAIR_GOTO_RESET_MAX_REWRITES || 4);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_STATIC_ZERO_PAIR_GOTO_RESET_MAX_REFS || 4);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKZRESET_')) continue;
    const tail = readStaticZeroPairGotoReset(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (collectLabelReferencesByLabel(codeItems).get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranchOp(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRefs) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneConditionalStaticZeroPairGotoResetAfterBranch(codeItems, code, ref, targetLabel);
      if (changed) rewrites += changed;
    }
    target = tail.end;
  }
  return rewrites;
}

function cloneConditionalStaticZeroPairGotoResetAfterBranch(codeItems, code, branchIndex, targetLabel) {
  const target = findLabelIndex(codeItems, targetLabel);
  if (target <= branchIndex) return 0;
  const tail = readStaticZeroPairGotoReset(codeItems, target);
  if (!tail || rangeTouchesExceptionTable(code, codeItems, target, tail.end)) return 0;
  return cloneConditionalRangeAfterBranchWithFallthroughGoto(
    codeItems,
    code,
    branchIndex,
    target,
    tail.end,
    tail.joinLabel,
    'LCKZRESET',
  );
}

function readStaticZeroPairGotoReset(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 5);
  if (indexes.length < 5) return null;
  if (integerConstantValue(codeItems[indexes[0]] && codeItems[indexes[0]].instruction) !== 0) return null;
  const firstField = fieldRef(codeItems[indexes[1]] && codeItems[indexes[1]].instruction);
  if (op(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) !== 'putstatic' || !firstField || firstField.descriptor !== 'I') return null;
  if (integerConstantValue(codeItems[indexes[2]] && codeItems[indexes[2]].instruction) !== 0) return null;
  const secondField = fieldRef(codeItems[indexes[3]] && codeItems[indexes[3]].instruction);
  if (op(codeItems[indexes[3]] && codeItems[indexes[3]].instruction) !== 'putstatic' || !secondField || secondField.descriptor !== 'I') return null;
  if (sameFieldRef(firstField, secondField)) return null;
  const jumpIndex = indexes[4];
  const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
  if (op(jump) !== 'goto') return null;
  const joinLabel = ensureFreshLabel(codeItems, jumpIndex, 'LCKZRESET_JOIN');
  if (!labelName(jump.arg) || findLabelIndex(codeItems, jump.arg) <= jumpIndex) return null;
  return { end: jumpIndex, joinLabel };
}

function cloneAssignmentGotoCommonTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_ASSIGNMENT_GOTO_COMMON_TAIL_MAX_REWRITES || 2);
  for (let gotoIndex = 3; gotoIndex < codeItems.length && rewrites < maxRewrites; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    if (!hasImmediateIntAssignmentBefore(codeItems, gotoIndex)) continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex || target - gotoIndex > 80) continue;
    if (!hasImmediateIntAssignmentBetween(codeItems, gotoIndex + 1, target)) continue;
    const tail = readForwardSingleExitCommonTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const changed = cloneGotoRangeAtWithFallthroughGoto(
      codeItems,
      code,
      gotoIndex,
      target,
      tail.end,
      tail.exitLabel,
      'LCKASGT',
    );
    if (changed) {
      rewrites += changed;
      gotoIndex += tail.end - target;
    }
  }
  return rewrites;
}

function hasImmediateIntAssignmentBefore(codeItems, index) {
  const putIndex = previousInstructionIndex(codeItems, index - 1);
  if (putIndex < 0 || op(codeItems[putIndex] && codeItems[putIndex].instruction) !== 'putfield') return false;
  if (fieldDescriptor(codeItems[putIndex] && codeItems[putIndex].instruction) !== 'I') return false;
  const valueIndex = previousInstructionIndex(codeItems, putIndex - 1);
  if (valueIndex < 0 || integerConstantValue(codeItems[valueIndex] && codeItems[valueIndex].instruction) == null) return false;
  const receiverIndex = previousInstructionIndex(codeItems, valueIndex - 1);
  return receiverIndex >= 0 && refLoadLocal(codeItems[receiverIndex] && codeItems[receiverIndex].instruction) != null;
}

function hasImmediateIntAssignmentBetween(codeItems, start, end) {
  for (let i = start + 2; i < end; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'putfield') continue;
    if (fieldDescriptor(codeItems[i] && codeItems[i].instruction) !== 'I') continue;
    const valueIndex = previousInstructionIndex(codeItems, i - 1);
    if (valueIndex < start || integerConstantValue(codeItems[valueIndex] && codeItems[valueIndex].instruction) == null) continue;
    const receiverIndex = previousInstructionIndex(codeItems, valueIndex - 1);
    if (receiverIndex >= start && refLoadLocal(codeItems[receiverIndex] && codeItems[receiverIndex].instruction) != null) return true;
  }
  return false;
}

function readForwardSingleExitCommonTail(codeItems, start) {
  const maxEnd = Math.min(codeItems.length, start + 96);
  let exit = -1;
  let branches = 0;
  let stores = 0;
  for (let i = start; i < maxEnd; i += 1) {
    if (exit >= 0 && i >= exit) break;
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (isReturnOp(cur) || cur === 'athrow' || cur === 'goto') return null;
    if (op(insn) === 'putfield' || op(insn) === 'putstatic' || intStoreLocal(insn) != null) stores += 1;
    if (!isConditionalBranch(cur)) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i || target - start > 96) return null;
    if (exit < 0) exit = target;
    if (target !== exit) return null;
    branches += 1;
    if (i + 1 >= exit) break;
  }
  if (exit <= start || branches < 2 || stores < 1) return null;
  return { end: exit, exitLabel: ensureFreshLabel(codeItems, exit, 'LCKASGT_EXIT') };
}

function cloneSharedNullArrayElementAssignmentTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_NULL_ARRAY_ELEMENT_ASSIGNMENT_TAIL_MAX_REWRITES || 4);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_SHARED_NULL_ARRAY_ELEMENT_ASSIGNMENT_TAIL_MAX_REFS || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKNULLARR_')) continue;
    const tail = readNullArrayElementAssignmentTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(codeItems[ref] && codeItems[ref].instruction))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRefs) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        target,
        tail.end,
        tail.exitLabel,
        'LCKNULLARR',
      );
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target = tail.end;
  }
  return rewrites;
}

function readNullArrayElementAssignmentTail(codeItems, start) {
  const idx = nextInstructionIndexes(codeItems, start, 5);
  if (idx.length < 5 || idx[0] !== start) return null;
  const arraySource = codeItems[idx[0]] && codeItems[idx[0]].instruction;
  if (refLoadLocal(arraySource) == null && op(arraySource) !== 'getstatic') return null;
  const second = codeItems[idx[1]] && codeItems[idx[1]].instruction;
  const secondOp = op(second);
  if (secondOp === 'getfield') {
    const field = fieldRef(second);
    if (!field || !field.descriptor.startsWith('[L')) return null;
  } else if (intLoadLocal(second) == null && integerConstantValue(second) == null) {
    return null;
  }
  let cursor = secondOp === 'getfield' ? 2 : 1;
  const indexInsn = codeItems[idx[cursor]] && codeItems[idx[cursor]].instruction;
  if (intLoadLocal(indexInsn) == null && integerConstantValue(indexInsn) == null) return null;
  cursor += 1;
  if (op(codeItems[idx[cursor]] && codeItems[idx[cursor]].instruction) !== 'aconst_null') return null;
  cursor += 1;
  if (op(codeItems[idx[cursor]] && codeItems[idx[cursor]].instruction) !== 'aastore') return null;
  const exit = nextInstructionIndex(codeItems, idx[cursor] + 1);
  if (exit < 0) return null;
  return { end: idx[cursor] + 1, exitLabel: ensureFreshLabel(codeItems, exit, 'LCKNULLARR_EXIT') };
}

function cloneStateArrayAllocationTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STATE_ARRAY_ALLOCATION_TAIL_MAX_REWRITES || 4);
  for (let branchIndex = 2; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(op(branch))) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex || target - branchIndex > 160) continue;
    const tail = readStateArrayAllocationTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branchIndex,
      target,
      tail.end,
      tail.exitLabel,
      'LCKSTATEARR',
    );
    if (changed) {
      rewrites += changed;
      branchIndex += tail.end - target;
    }
  }
  return rewrites;
}

function readStateArrayAllocationTail(codeItems, start) {
  const state = fieldRef(codeItems[start] && codeItems[start].instruction);
  if (op(codeItems[start] && codeItems[start].instruction) !== 'getstatic' || !state || !state.descriptor.startsWith('L')) return null;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'putstatic') return null;
  const stateTarget = fieldRef(codeItems[start + 1] && codeItems[start + 1].instruction);
  if (!stateTarget || stateTarget.descriptor !== state.descriptor) return null;
  if (integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction) == null) return null;
  if (intLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction) == null) return null;
  if (op(codeItems[start + 4] && codeItems[start + 4].instruction) !== 'iadd' &&
    op(codeItems[start + 4] && codeItems[start + 4].instruction) !== 'isub') return null;
  if (op(codeItems[start + 5] && codeItems[start + 5].instruction) !== 'anewarray') return null;
  if (op(codeItems[start + 6] && codeItems[start + 6].instruction) !== 'putstatic') return null;
  const arrayTarget = fieldRef(codeItems[start + 6] && codeItems[start + 6].instruction);
  if (!arrayTarget || !arrayTarget.descriptor.startsWith('[L')) return null;
  const exit = nextInstructionIndex(codeItems, start + 7);
  if (exit < 0) return null;
  return { end: start + 7, exitLabel: ensureFreshLabel(codeItems, exit, 'LCKSTATEARR_EXIT') };
}

function materializeConditionalBooleanLocalConstantTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_CONSTANT_TAIL_MAX_REWRITES || 12);
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(branch)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex || target - branchIndex > 96) continue;
    const tail = readBooleanLocalConstantGotoTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const changed = materializeBooleanConstantTailReference(codeItems, branchIndex, tail.value, tail.joinLabel);
    if (changed) rewrites += changed;
  }
  return rewrites;
}

function cloneConditionalBooleanLocalStoreTargets(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_STORE_TARGET_MAX_REWRITES || 4);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_STORE_TARGET_MAX_REFS || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 1; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKBSTORE_')) continue;
    const tail = readBooleanLocalStoreTarget(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(codeItems[ref] && codeItems[ref].instruction))
      .sort((a, b) => a - b);
    if (refs.length < 2 || refs.length > maxRefs) continue;
    for (const ref of refs.slice(0, -1).sort((a, b) => b - a)) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readBooleanLocalStoreTarget(codeItems, currentTarget);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        currentTarget,
        currentTail.end,
        currentTail.exitLabel,
        'LCKBSTORE',
      );
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target = tail.end;
  }
  return rewrites;
}

function readBooleanLocalStoreTarget(codeItems, start) {
  const value = integerConstantValue(codeItems[start] && codeItems[start].instruction);
  if (value !== 0 && value !== 1) return null;
  const storeIndex = nextInstructionIndex(codeItems, start + 1);
  if (storeIndex !== start + 1) return null;
  const local = intStoreLocal(codeItems[storeIndex] && codeItems[storeIndex].instruction);
  if (local == null) return null;
  const exit = nextInstructionIndex(codeItems, storeIndex + 1);
  if (exit < 0) return null;
  return { value, local, end: storeIndex + 1, exitLabel: ensureFreshLabel(codeItems, exit, 'LCKBSTORE_EXIT') };
}

function cloneConditionalIntLocalCopyTargets(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_CONDITIONAL_INT_LOCAL_COPY_TARGET_MAX_REWRITES || 8);
  const maxRefs = Number(process.env.STRUCTURED_GOTO_CONDITIONAL_INT_LOCAL_COPY_TARGET_MAX_REFS || 6);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 1; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKICOPY_')) continue;
    const tail = readIntLocalCopyTarget(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && isConditionalBranch(codeItems[ref] && codeItems[ref].instruction))
      .sort((a, b) => b - a);
    if (refs.length < 1 || refs.length > maxRefs) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readIntLocalCopyTarget(codeItems, currentTarget);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        currentTarget,
        currentTail.end,
        currentTail.exitLabel,
        'LCKICOPY',
      );
      if (changed) rewrites += changed;
    }
    if (rewrites > 0) target = tail.end;
  }
  return rewrites;
}

function readIntLocalCopyTarget(codeItems, start) {
  const source = intLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (source == null) return null;
  const storeIndex = nextInstructionIndex(codeItems, start + 1);
  if (storeIndex !== start + 1) return null;
  const dest = intStoreLocal(codeItems[storeIndex] && codeItems[storeIndex].instruction);
  if (dest == null || dest === source) return null;
  const exit = nextInstructionIndex(codeItems, storeIndex + 1);
  if (exit < 0) return null;
  return { source, dest, end: storeIndex + 1, exitLabel: ensureFreshLabel(codeItems, exit, 'LCKICOPY_EXIT') };
}

function readBooleanLocalConstantGotoTail(codeItems, start) {
  const value = integerConstantValue(codeItems[start] && codeItems[start].instruction);
  if (value !== 0 && value !== 1) return null;
  const jump = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (op(jump) !== 'goto') return null;
  const join = findLabelIndex(codeItems, jump.arg);
  if (join <= start + 1 || join > start + 8) return null;
  const joinLabel = labelName(codeItems[join] && codeItems[join].labelDef);
  if (!joinLabel || intStoreLocal(codeItems[join] && codeItems[join].instruction) == null) return null;
  for (let i = start + 2; i < join; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!insn) continue;
    const cur = op(insn);
    const otherValue = integerConstantValue(insn);
    if (otherValue === 0 || otherValue === 1 || cur === 'goto' || cur === 'athrow') continue;
    return null;
  }
  return { value, end: join + 1, joinLabel };
}

function cloneStringBuilderCharAppendTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STRING_BUILDER_CHAR_APPEND_TAIL_MAX_REWRITES || 12);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 2; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSBAPP_')) continue;
    const tail = readStringBuilderCharAppendTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target)
      .sort((a, b) => b - a);
    if (refs.length < 1) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readStringBuilderCharAppendTail(codeItems, currentTarget);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const insn = codeItems[ref] && codeItems[ref].instruction;
      let changed = 0;
      if (op(insn) === 'goto') {
        changed = cloneGotoRangeAt(codeItems, code, ref, currentTarget, currentTail.end, 'LCKSBAPP');
      } else if (isConditionalBranch(insn)) {
        changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
          codeItems,
          code,
          ref,
          currentTarget,
          currentTail.end - 1,
          currentTail.joinLabel,
          'LCKSBAPP',
        );
      }
      if (changed) rewrites += changed;
    }
    target = tail.end;
  }
  return rewrites;
}

function readStringBuilderCharAppendTail(codeItems, start) {
  const appendIndex = start + 3;
  const append = codeItems[appendIndex] && codeItems[appendIndex].instruction;
  if (!isInvoke(append, 'java/lang/StringBuilder', 'append', '(C)Ljava/lang/StringBuilder;')) return null;
  if (op(codeItems[appendIndex + 1] && codeItems[appendIndex + 1].instruction) !== 'pop') return null;
  const jump = codeItems[appendIndex + 2] && codeItems[appendIndex + 2].instruction;
  if (op(jump) !== 'goto') return null;
  const joinLabel = labelName(jump.arg);
  if (!joinLabel || findLabelIndex(codeItems, joinLabel) <= appendIndex + 2) return null;
  let stackish = 0;
  for (let i = start; i < appendIndex; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (!cur || cur === 'athrow' || cur === 'goto' || isConditionalBranch(codeItems[i] && codeItems[i].instruction)) return null;
    stackish += 1;
  }
  if (stackish < 2) return null;
  return { end: appendIndex + 3, joinLabel };
}

function cloneSmallForwardTerminalGotoTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SMALL_FORWARD_TERMINAL_GOTO_TAIL_MAX_REWRITES || 8);
  for (let gotoIndex = 0; gotoIndex < codeItems.length && rewrites < maxRewrites; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex) continue;
    const tail = readSmallForwardTerminalGotoTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const changed = cloneGotoRangeAt(codeItems, code, gotoIndex, target, tail.end, 'LCKTERMTAIL');
    if (changed) {
      rewrites += changed;
      gotoIndex += tail.end - target;
    }
  }
  return rewrites;
}

function readSmallForwardTerminalGotoTail(codeItems, start) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SMALL_FORWARD_TERMINAL_GOTO_TAIL_MAX_INSNS || 12);
  let insns = 0;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!insn) continue;
    const cur = op(insn);
    if (!cur) continue;
    insns += 1;
    if (insns > maxInsns) return null;
    if (cur === 'athrow' || cur === 'goto' || isConditionalBranch(insn)) return null;
    if (isReturnOp(cur)) return insns >= 2 ? { end: i + 1 } : null;
  }
  return null;
}

function cloneForwardCaseJoinBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_FORWARD_CASE_JOIN_BODY_MAX_REWRITES || 4);
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(branch)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    const body = readForwardCaseJoinBody(codeItems, branchIndex, target);
    if (!body) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, body.end)) continue;
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branchIndex,
      target,
      body.end,
      body.joinLabel,
      'LCKCASEJOIN',
    );
    if (changed) {
      rewrites += changed;
      branchIndex += body.end - target;
    }
  }
  return rewrites;
}

function readForwardCaseJoinBody(codeItems, branchIndex, target) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_FORWARD_CASE_JOIN_BODY_MAX_INSNS || 48);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_FORWARD_CASE_JOIN_BODY_MAX_DISTANCE || 160);
  if (target - branchIndex > maxDistance) return null;
  if (intLoadLocal(codeItems[target] && codeItems[target].instruction) != null) return null;
  const join = findForwardCaseJoin(codeItems, branchIndex, target, maxInsns);
  if (join <= target) return null;
  const joinLabel = labelName(codeItems[join] && codeItems[join].labelDef);
  if (!joinLabel) return null;
  if (!caseBodyBranchesAreLocal(codeItems, target, join, joinLabel)) return null;
  let stores = 0;
  let terminals = 0;
  let insns = 0;
  for (let i = target; i < join; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    insns += 1;
    if (insns > maxInsns) return null;
    if (localStore(insn)) stores += 1;
    if (cur === 'athrow' || isReturnOp(cur)) terminals += 1;
  }
  if (stores < 1 && terminals < 1) return null;
  return { end: join, joinLabel };
}

function findForwardCaseJoin(codeItems, branchIndex, target, maxInsns) {
  const candidateGotos = [];
  for (let i = branchIndex + 1; i < target; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'goto') continue;
    const dest = findLabelIndex(codeItems, insn.arg);
    if (dest > target) candidateGotos.push(dest);
  }
  if (candidateGotos.length < 1) return -1;
  const maxEnd = Math.min(codeItems.length, target + maxInsns + 1);
  let best = -1;
  for (const dest of candidateGotos) {
    if (dest <= target || dest > maxEnd) continue;
    if (best < 0 || dest < best) best = dest;
  }
  if (best < 0) return -1;
  const joinLabel = labelName(codeItems[best] && codeItems[best].labelDef);
  if (!joinLabel) return -1;
  return best;
}

function caseBodyBranchesAreLocal(codeItems, start, end, joinLabel) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    if (cur === 'jsr' || cur === 'ret') return false;
    if (cur === 'goto' || isConditionalBranch(insn)) {
      const labels = collectInstructionLabels(insn);
      if (labels.length < 1) return false;
      for (const raw of labels) {
        const label = labelName(raw);
        if (!label) return false;
        if (label === joinLabel) continue;
        const dest = findLabelIndex(codeItems, label);
        if (dest < start || dest >= end) return false;
      }
    }
  }
  return true;
}

function cloneForwardLoopSuffixEntries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_FORWARD_LOOP_SUFFIX_ENTRY_MAX_REWRITES || 4);
  for (let branchIndex = 1; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(branch)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    const suffix = readForwardLoopSuffixEntry(codeItems, branchIndex, target);
    if (!suffix) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, suffix.end)) continue;
    const changed = cloneConditionalRangeAfterBranch(
      codeItems,
      code,
      branchIndex,
      target,
      suffix.end,
      'LCKLOOPSUF',
    );
    if (changed) {
      rewrites += changed;
      branchIndex += suffix.end - target;
    }
  }
  return rewrites;
}

function readForwardLoopSuffixEntry(codeItems, branchIndex, target) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_FORWARD_LOOP_SUFFIX_ENTRY_MAX_INSNS || 260);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_FORWARD_LOOP_SUFFIX_ENTRY_MAX_DISTANCE || 260);
  if (target - branchIndex > maxDistance) return null;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough < 0 || fallthrough >= target) return null;
  const header = findLoopHeaderBeforeForwardSuffix(codeItems, branchIndex, target, maxInsns);
  if (header <= branchIndex || header >= target) return null;
  if (fallthrough >= header) return null;
  const headerLabel = labelName(codeItems[header] && codeItems[header].labelDef);
  if (!headerLabel) return null;
  const end = findForwardLoopSuffixEnd(codeItems, target, headerLabel, maxInsns);
  if (end <= target) return null;
  const lastInsn = previousInstructionIndex(codeItems, end - 1);
  if (lastInsn < target || op(codeItems[lastInsn] && codeItems[lastInsn].instruction) !== 'goto') return null;
  const endLabel = ensureFreshLabel(codeItems, end, 'LCKLOOPSUF_EXIT');
  if (!forwardLoopSuffixBranchesAreLocal(codeItems, target, end, headerLabel, endLabel)) return null;
  if (!rangeHasSideEffectOrStore(codeItems, target, end)) return null;
  return { end, headerLabel, endLabel };
}

function findLoopHeaderBeforeForwardSuffix(codeItems, branchIndex, target, maxInsns) {
  const maxEnd = Math.min(codeItems.length, target + maxInsns);
  let best = -1;
  for (let i = target; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    for (const raw of collectInstructionLabels(insn)) {
      const dest = findLabelIndex(codeItems, raw);
      if (dest > branchIndex && dest < target && (best < 0 || dest < best)) best = dest;
    }
  }
  return best;
}

function findForwardLoopSuffixEnd(codeItems, target, headerLabel, maxInsns) {
  const maxEnd = Math.min(codeItems.length, target + maxInsns);
  let end = -1;
  for (let i = target; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (isReturnOp(cur) || cur === 'athrow' || cur === 'jsr' || cur === 'ret') return end;
    if (collectInstructionLabels(insn).some((raw) => labelName(raw) === headerLabel)) {
      end = i + 1;
    }
  }
  return end;
}

function forwardLoopSuffixBranchesAreLocal(codeItems, start, end, headerLabel, endLabel) {
  const labelsInside = new Set();
  for (let i = start; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) labelsInside.add(label);
  }
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    for (const raw of collectInstructionLabels(insn)) {
      const label = labelName(raw);
      if (label === headerLabel || label === endLabel || labelsInside.has(label)) continue;
      return false;
    }
  }
  return true;
}

function rangeHasSideEffectOrStore(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    if (isStoreOrSideEffect(op(codeItems[i] && codeItems[i].instruction))) return true;
  }
  return false;
}

function cloneForwardGotoLoopBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_FORWARD_GOTO_LOOP_BODY_MAX_REWRITES || 2);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_FORWARD_GOTO_LOOP_BODY_MAX_DISTANCE || 420);
  for (let gotoIndex = 1; gotoIndex < codeItems.length && rewrites < maxRewrites; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex || target - gotoIndex > maxDistance) continue;
    const body = readForwardGotoLoopBody(codeItems, target);
    if (!body) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, body.end)) continue;
    const changed = cloneGotoRangeAtWithFallthroughGoto(
      codeItems,
      code,
      gotoIndex,
      target,
      body.end,
      body.exitLabel,
      'LCKGLOOP',
    );
    if (changed) {
      rewrites += changed;
      gotoIndex += body.end - target;
    }
  }
  return rewrites;
}

function readForwardGotoLoopBody(codeItems, target) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_FORWARD_GOTO_LOOP_BODY_MAX_INSNS || 360);
  const maxEnd = Math.min(codeItems.length, target + maxInsns);
  for (let branchIndex = target + 2; branchIndex < maxEnd; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(branch)) continue;
    const exit = findLabelIndex(codeItems, branch.arg);
    if (exit <= branchIndex || exit > maxEnd) continue;
    const headerLabel = findBackedgeHeaderLabelForForwardLoop(codeItems, target, branchIndex, exit);
    if (!headerLabel) continue;
    const exitLabel = ensureFreshLabel(codeItems, exit, 'LCKGLOOP_EXIT');
    if (!forwardLoopBodyBranchesAreLocal(codeItems, target, exit, exitLabel)) continue;
    if (!rangeHasSideEffectOrStore(codeItems, target, exit)) continue;
    if (!rangeHasObjectConstruction(codeItems, target, exit)) continue;
    return { end: exit, exitLabel, headerLabel };
  }
  return null;
}

function rangeHasObjectConstruction(codeItems, start, end) {
  let sawNew = false;
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (cur === 'new') sawNew = true;
    if (sawNew && cur === 'invokespecial') {
      const ref = methodRef(insn);
      if (ref && ref.name === '<init>') return true;
    }
  }
  return false;
}

function findBackedgeHeaderLabelForForwardLoop(codeItems, start, branchIndex, exit) {
  const candidateLabels = new Set();
  for (let i = start; i <= branchIndex; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) candidateLabels.add(label);
  }
  if (candidateLabels.size < 1) return null;
  for (let i = branchIndex + 1; i < exit; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    for (const raw of collectInstructionLabels(insn)) {
      const label = labelName(raw);
      if (candidateLabels.has(label)) return label;
    }
  }
  return null;
}

function forwardLoopBodyBranchesAreLocal(codeItems, start, end, exitLabel) {
  const labelsInside = new Set();
  for (let i = start; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) labelsInside.add(label);
  }
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    for (const raw of collectInstructionLabels(insn)) {
      const label = labelName(raw);
      if (label === exitLabel || labelsInside.has(label)) continue;
      return false;
    }
  }
  return true;
}

function cloneSharedForwardExitContinuations(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_EXIT_CONTINUATION_MAX_REWRITES || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKEXITCONT_')) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    if (refs.length < 1) continue;
    const tail = readSharedForwardExitContinuation(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const currentTarget = findLabelIndex(codeItems, targetLabel);
      if (currentTarget <= ref) continue;
      const currentTail = readSharedForwardExitContinuation(codeItems, currentTarget);
      if (!currentTail) continue;
      if (rangeTouchesExceptionTable(code, codeItems, currentTarget, currentTail.end)) continue;
      const changed = cloneGotoRangeAt(codeItems, code, ref, currentTarget, currentTail.end, 'LCKEXITCONT');
      if (changed) rewrites += changed;
    }
    target = tail.end;
  }
  return rewrites;
}

function readSharedForwardExitContinuation(codeItems, start) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_EXIT_CONTINUATION_MAX_INSNS || 96);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_SHARED_FORWARD_EXIT_CONTINUATION_MAX_DISTANCE || 180);
  let insns = 0;
  let exitLabel = null;
  let exitIndex = -1;
  let conditionalExits = 0;
  let gotoExits = 0;
  let sideEffects = 0;
  for (let i = start; i < codeItems.length && insns <= maxInsns; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    insns += 1;
    if (isReturnOp(cur) || cur === 'athrow') return null;
    if (cur.startsWith('invoke') || localStore(insn) || cur === 'putfield' || cur === 'putstatic') sideEffects += 1;
    if (cur === 'goto' || isConditionalBranch(insn)) {
      const labels = collectInstructionLabels(insn);
      if (labels.length !== 1) return null;
      const label = labelName(labels[0]);
      const dest = findLabelIndex(codeItems, label);
      if (dest < 0) return null;
      if (dest === start) return null;
      if (dest > start) {
        if (dest - start > maxDistance) return null;
        if (dest <= i) return null;
        if (!exitLabel) {
          exitLabel = label;
          exitIndex = dest;
        } else if (label !== exitLabel) {
          return null;
        }
        if (cur === 'goto') gotoExits += 1;
        else conditionalExits += 1;
      }
    }
    if (exitIndex > 0 && i + 1 >= exitIndex) break;
  }
  if (exitIndex <= start || exitIndex - start > maxInsns + 1) return null;
  if (conditionalExits < 1 || gotoExits < 1 || sideEffects < 1) return null;
  if (!caseBodyBranchesAreLocal(codeItems, start, exitIndex, exitLabel)) return null;
  return { end: exitIndex, exitLabel };
}

function cloneCheckedLoopBodyEntries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_CHECKED_LOOP_BODY_ENTRY_MAX_REWRITES || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 2; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKCHKLOOP_')) continue;
    const loop = readCheckedLoopBody(codeItems, target);
    if (!loop) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, loop.end)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .filter((ref) => isCheckedLoopBodyEntrySource(codeItems, ref, loop.exitLabel))
      .sort((a, b) => b - a);
    if (refs.length < 2 || refs.length > maxRewrites) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneCheckedLoopBodyEntryAt(codeItems, code, ref, targetLabel);
      if (changed) rewrites += changed;
    }
    target = loop.end;
  }
  return rewrites;
}

function cloneCheckedLoopBodyEntryAt(codeItems, code, gotoIndex, targetLabel) {
  const target = findLabelIndex(codeItems, targetLabel);
  if (target <= gotoIndex) return 0;
  const loop = readCheckedLoopBody(codeItems, target);
  if (!loop || rangeTouchesExceptionTable(code, codeItems, target, loop.end)) return 0;
  if (!isCheckedLoopBodyEntrySource(codeItems, gotoIndex, loop.exitLabel)) return 0;
  return cloneGotoRangeAt(codeItems, code, gotoIndex, target, loop.end, 'LCKCHKLOOP');
}

function cloneCheckedLoopBodySuffixEntries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_CHECKED_LOOP_BODY_SUFFIX_ENTRY_MAX_REWRITES || 4);
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let target = 2; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKCHKSUF_')) continue;
    const suffix = readCheckedLoopBodySuffix(codeItems, target);
    if (!suffix) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, suffix.backedge)) continue;
    const refs = (refsByLabel.get(targetLabel) || [])
      .filter((ref) => ref < target && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .filter((ref) => isCheckedLoopBodyEntrySource(codeItems, ref, suffix.exitLabel))
      .sort((a, b) => b - a);
    if (refs.length < 1 || refs.length > maxRewrites) continue;
    for (const ref of refs) {
      if (rewrites >= maxRewrites) break;
      const changed = cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        target,
        suffix.backedge,
        suffix.headerLabel,
        'LCKCHKSUF',
      );
      if (changed) rewrites += changed;
    }
    target = suffix.backedge;
  }
  return rewrites;
}

function readCheckedLoopBodySuffix(codeItems, target) {
  const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
  if (!targetLabel) return null;
  const maxEnd = Math.min(codeItems.length, target + 48);
  let invokes = 0;
  for (let i = target; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (isReturnOp(cur) || cur === 'athrow') return null;
    if (isInvokeInstruction(insn)) invokes += 1;
    if (cur !== 'goto') continue;
    const headerLabel = labelName(insn.arg);
    const header = findLabelIndex(codeItems, headerLabel);
    if (!headerLabel || header < 0 || header >= target) return null;
    const loop = readCheckedLoopFromHeader(codeItems, header);
    if (!loop || target >= loop.end || i >= loop.end) return null;
    if (invokes < 1) return null;
    return { backedge: i, headerLabel, exitLabel: loop.exitLabel };
  }
  return null;
}

function readCheckedLoopFromHeader(codeItems, header) {
  const headerLabel = labelName(codeItems[header] && codeItems[header].labelDef);
  if (!headerLabel) return null;
  const maxBranch = Math.min(codeItems.length, header + 24);
  for (let branchIndex = header + 1; branchIndex < maxBranch; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'ifeq' && op(branch) !== 'ifne') continue;
    const invokeIndex = previousInstructionIndex(codeItems, branchIndex - 1);
    if (invokeIndex < header || !isAnyBooleanInvoke(codeItems[invokeIndex] && codeItems[invokeIndex].instruction)) return null;
    const exit = findLabelIndex(codeItems, branch.arg);
    if (exit <= branchIndex || exit - header > 260) return null;
    let backedges = 0;
    let invokes = 0;
    for (let i = branchIndex + 1; i < exit; i += 1) {
      const insn = codeItems[i] && codeItems[i].instruction;
      if (isInvokeInstruction(insn)) invokes += 1;
      if (collectInstructionLabels(insn).includes(headerLabel)) backedges += 1;
    }
    if (backedges < 1 || invokes < 1) return null;
    return { end: exit, exitLabel: labelName(codeItems[exit] && codeItems[exit].labelDef) };
  }
  return null;
}

function readCheckedLoopBody(codeItems, target) {
  const branchIndex = previousInstructionIndex(codeItems, target - 1);
  const invokeIndex = previousInstructionIndex(codeItems, branchIndex - 1);
  if (branchIndex < 0 || invokeIndex < 0) return null;
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  if (op(branch) !== 'ifeq' && op(branch) !== 'ifne') return null;
  if (!isAnyBooleanInvoke(codeItems[invokeIndex] && codeItems[invokeIndex].instruction)) return null;
  const exit = findLabelIndex(codeItems, branch.arg);
  if (exit <= target || exit - target > 260) return null;
  const argIndex = previousInstructionIndex(codeItems, invokeIndex - 1);
  const headerLabel = labelName(codeItems[argIndex] && codeItems[argIndex].labelDef) ||
    labelName(codeItems[invokeIndex] && codeItems[invokeIndex].labelDef) ||
    labelName(codeItems[branchIndex] && codeItems[branchIndex].labelDef);
  if (!headerLabel) return null;
  let backedges = 0;
  let invokes = 0;
  for (let i = target; i < exit; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isInvokeInstruction(insn)) invokes += 1;
    if (collectInstructionLabels(insn).includes(headerLabel)) backedges += 1;
  }
  if (backedges < 1 || invokes < 1) return null;
  return { end: exit, exitLabel: labelName(codeItems[exit] && codeItems[exit].labelDef) };
}

function isCheckedLoopBodyEntrySource(codeItems, gotoIndex, exitLabel) {
  const branchIndex = previousInstructionIndex(codeItems, gotoIndex - 1);
  const invokeIndex = previousInstructionIndex(codeItems, branchIndex - 1);
  if (branchIndex < 0 || invokeIndex < 0) return false;
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  if (op(branch) !== 'ifeq' && op(branch) !== 'ifne') return false;
  if (labelName(branch.arg) !== labelName(exitLabel)) return false;
  return isAnyBooleanInvoke(codeItems[invokeIndex] && codeItems[invokeIndex].instruction);
}

function readStaticInvokeJoinTail(codeItems, start) {
  if (integerConstantValue(codeItems[start] && codeItems[start].instruction) == null) return null;
  if (integerConstantValue(codeItems[start + 1] && codeItems[start + 1].instruction) == null) return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'invokestatic') return null;
  if (methodDescriptor(codeItems[start + 2] && codeItems[start + 2].instruction) !== '(II)V') return null;
  const jump = codeItems[start + 3] && codeItems[start + 3].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  const exitIndex = findLabelIndex(codeItems, exitLabel);
  if (!exitLabel || exitIndex <= start + 3) return null;
  return { end: start + 3, exitLabel };
}

function cloneInstanceofSummaryBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_INSTANCEOF_SUMMARY_BODY_CLONE_MAX_REWRITES || 2);
  for (let gotoIndex = 3; gotoIndex < codeItems.length && rewrites < maxRewrites; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex) continue;
    const branchIndex = previousInstructionIndex(codeItems, gotoIndex - 1);
    const instanceIndex = previousInstructionIndex(codeItems, branchIndex - 1);
    const loadIndex = previousInstructionIndex(codeItems, instanceIndex - 1);
    if (branchIndex < 0 || instanceIndex < 0 || loadIndex < 0) continue;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'ifne') continue;
    if (op(codeItems[instanceIndex] && codeItems[instanceIndex].instruction) !== 'instanceof') continue;
    const local = refLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction);
    if (local == null) continue;
    const typedTarget = findLabelIndex(codeItems, branch.arg);
    if (typedTarget !== nextInstructionIndex(codeItems, gotoIndex + 1)) continue;
    const plan = readInstanceofSummaryBody(codeItems, target, gotoIndex, local);
    if (!plan) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, plan.end)) continue;
    const changed = cloneGotoRangeAt(codeItems, code, gotoIndex, target, plan.end, 'LCKISUM');
    if (changed) {
      rewrites += changed;
      gotoIndex += plan.end - target;
    }
  }
  return rewrites;
}

function readInstanceofSummaryBody(codeItems, start, sourceIndex, local) {
  if (refLoadLocal(codeItems[start] && codeItems[start].instruction) !== local) return null;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'getfield') return null;
  if (fieldDescriptor(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'I') return null;
  if (!isConditionalBranch(op(codeItems[start + 2] && codeItems[start + 2].instruction))) return null;
  const maxEnd = Math.min(codeItems.length, start + 220);
  let instanceofCount = 0;
  let sawArrayStore = false;
  for (let i = start; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (cur === 'instanceof') instanceofCount += 1;
    if (cur === 'iastore') sawArrayStore = true;
    if (cur === 'goto') {
      const backedge = findLabelIndex(codeItems, insn.arg);
      if (backedge >= 0 && backedge < sourceIndex && instanceofCount >= 2 && sawArrayStore) {
        return { end: i + 1 };
      }
    }
    if (isReturnOp(cur) || cur === 'athrow') return null;
  }
  return null;
}

function cloneStackCarriedForwardCompareBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STACK_CARRIED_FORWARD_COMPARE_BODY_MAX_REWRITES || 2);
  for (let branchIndex = 2; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifne' && branchOp !== 'ifeq') continue;
    const guardLocal = intLoadLocal(codeItems[previousInstructionIndex(codeItems, branchIndex - 1)] && codeItems[previousInstructionIndex(codeItems, branchIndex - 1)].instruction);
    if (guardLocal == null) continue;
    const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
    if (!isIntegerCompareBranch(op(codeItems[fallthrough] && codeItems[fallthrough].instruction))) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    if (!isIntegerCompareBranch(op(codeItems[target] && codeItems[target].instruction))) continue;
    const body = readStackCarriedForwardCompareBody(codeItems, target);
    if (!body) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, body.end)) continue;
    const exitLabel = ensureFreshLabel(codeItems, body.end, 'LCKSCMP_EXIT');
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branchIndex,
      target,
      body.end,
      exitLabel,
      'LCKSCMP',
    );
    if (changed) {
      rewrites += changed;
      branchIndex += body.end - target;
    }
  }
  return rewrites;
}

function readStackCarriedForwardCompareBody(codeItems, start) {
  const maxEnd = Math.min(codeItems.length, start + 100);
  let sawInvoke = false;
  for (let i = start + 1; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (isInvokeInstruction(insn)) sawInvoke = true;
    if (isReturnOp(cur) || cur === 'athrow') return null;
    if (isConditionalBranch(cur) || cur === 'goto') {
      const target = findLabelIndex(codeItems, insn.arg);
      if (target >= 0 && target < start && sawInvoke) {
        const end = nextInstructionIndex(codeItems, i + 1);
        return end > i ? { end } : null;
      }
    }
  }
  return null;
}

function isIntegerCompareBranch(cur) {
  return cur === 'if_icmpeq' ||
    cur === 'if_icmpne' ||
    cur === 'if_icmplt' ||
    cur === 'if_icmpge' ||
    cur === 'if_icmpgt' ||
    cur === 'if_icmple';
}

function cloneSharedBooleanSelectorTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_SELECTOR_TAIL_MAX_REWRITES || 4);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_SELECTOR_TAIL_MAX_INSNS || 64);

  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!isConditionalBranch(branchOp)) continue;
    const targetLabel = labelName(branch.arg);
    const target = findLabelIndex(codeItems, targetLabel);
    if (target <= i + 1) continue;
    const refs = collectLabelReferencesByLabel(codeItems).get(targetLabel) || [];
    if (refs.filter((ref) => ref < target).length < 2) continue;
    const tail = readSharedBooleanSelectorTail(codeItems, target, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      tail.end,
      tail.exitLabel,
      'LCKBOOLSEL',
    );
    if (changed) {
      rewrites += changed;
      i += Math.max(0, tail.end - target);
    }
  }
  return rewrites;
}

function readSharedBooleanSelectorTail(codeItems, start, maxInsns) {
  let instructions = 0;
  let sawZero = false;
  let sawOne = false;
  let storeLocal = null;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    instructions += 1;
    if (instructions > maxInsns) return null;
    if (cur === 'iconst_0') sawZero = true;
    else if (cur === 'iconst_1') sawOne = true;
    const local = intStoreLocal(insn);
    if (local != null) {
      storeLocal = local;
      const exitIndex = nextInstructionIndex(codeItems, i + 1);
      const exitLabel = exitIndex >= 0 ? ensureLabel(codeItems[exitIndex], 'LCKBOOLSEL_EXIT') : null;
      if (!sawZero || !sawOne || !exitLabel) return null;
      return { end: i + 1, exitLabel, storeLocal };
    }
    if (!isBooleanSelectorTailOp(cur)) return null;
  }
  return null;
}

function isBooleanSelectorTailOp(cur) {
  return cur === 'iconst_0' ||
    cur === 'iconst_1' ||
    cur === 'aconst_null' ||
    cur === 'bipush' ||
    cur === 'getstatic' ||
    cur === 'getfield' ||
    cur === 'baload' ||
    cur === 'invokestatic' ||
    cur === 'goto' ||
    isConditionalBranch(cur);
}

function cloneSharedIntSelectorInvokeTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_INT_SELECTOR_INVOKE_TAIL_MAX_REWRITES || 8);
  for (let invokeIndex = 0; invokeIndex < codeItems.length && rewrites < maxRewrites; invokeIndex += 1) {
    const joinTail = readSharedIntSelectorInvokeTailAtInvoke(codeItems, invokeIndex);
    if (!joinTail) continue;
    const { join } = joinTail;
    const falseStart = previousInstructionIndex(codeItems, join - 1);
    const trueGoto = previousInstructionIndex(codeItems, falseStart - 1);
    const trueStart = previousInstructionIndex(codeItems, trueGoto - 1);
    if (falseStart < 0 || trueStart < 0 || op(codeItems[trueGoto] && codeItems[trueGoto].instruction) !== 'goto') continue;
    if (findLabelIndex(codeItems, codeItems[trueGoto].instruction.arg) !== join) continue;
    if (integerConstantValue(codeItems[falseStart] && codeItems[falseStart].instruction) == null) continue;
    if (integerConstantValue(codeItems[trueStart] && codeItems[trueStart].instruction) == null) continue;
    const falseLabel = labelName(codeItems[falseStart] && codeItems[falseStart].labelDef);
    const trueLabel = labelName(codeItems[trueStart] && codeItems[trueStart].labelDef);
    if (!falseLabel || !trueLabel || isStructuredGotoCloneLabel(codeItems[falseStart], 'LCKINTSEL_')) continue;
    if (rangeTouchesExceptionTable(code, codeItems, falseStart, joinTail.end)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, trueStart, joinTail.end)) continue;

    const refs = collectLabelReferencesByLabel(codeItems);
    const falseRefs = (refs.get(falseLabel) || [])
      .filter((ref) => ref < falseStart && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    const trueRefs = (refs.get(trueLabel) || [])
      .filter((ref) => ref < trueStart && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    if (falseRefs.length + trueRefs.length < 2) continue;

    for (const ref of falseRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        falseStart,
        joinTail.end,
        joinTail.exitLabel,
        'LCKINTSEL',
      );
    }
    for (const ref of trueRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        trueStart,
        joinTail.end,
        joinTail.exitLabel,
        'LCKINTSEL',
      );
    }
    invokeIndex = Math.max(invokeIndex, joinTail.end);
  }
  return rewrites;
}

function readSharedIntSelectorInvokeTailAtInvoke(codeItems, invokeIndex) {
  if (!isInvokeDescriptor(codeItems[invokeIndex] && codeItems[invokeIndex].instruction, '(IZBI)V')) return null;
  const thirdArg = previousInstructionIndex(codeItems, invokeIndex - 1);
  const secondArg = previousInstructionIndex(codeItems, thirdArg - 1);
  const join = previousInstructionIndex(codeItems, secondArg - 1);
  if (join < 0 || secondArg < 0 || thirdArg < 0) return null;
  if (integerConstantValue(codeItems[join] && codeItems[join].instruction) == null) return null;
  if (integerConstantValue(codeItems[secondArg] && codeItems[secondArg].instruction) == null) return null;
  if (integerConstantValue(codeItems[thirdArg] && codeItems[thirdArg].instruction) == null) return null;
  const exitIndex = nextInstructionIndex(codeItems, invokeIndex + 1);
  const jump = codeItems[exitIndex] && codeItems[exitIndex].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  const exitTarget = findLabelIndex(codeItems, exitLabel);
  if (!exitLabel || exitTarget < 0 || (exitTarget >= join && exitTarget <= exitIndex)) return null;
  return { join, end: exitIndex, exitLabel };
}

function cloneSharedIntAdvanceSelectorTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_INT_ADVANCE_SELECTOR_TAIL_MAX_REWRITES || 8);
  for (let trueStart = 0; trueStart < codeItems.length && rewrites < maxRewrites; trueStart += 1) {
    const tail = readSharedIntAdvanceSelectorTail(codeItems, trueStart);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tail.falseStart, tail.falseEnd)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tail.trueStart, tail.trueEnd)) continue;

    const refs = collectLabelReferencesByLabel(codeItems);
    const falseRefs = (refs.get(tail.falseLabel) || [])
      .filter((ref) => ref < tail.falseStart && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    const trueRefs = (refs.get(tail.trueLabel) || [])
      .filter((ref) => ref < tail.trueStart && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (falseRefs.length + trueRefs.length < 2) continue;

    for (const ref of falseRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        tail.falseStart,
        tail.falseEnd,
        tail.exitLabel,
        'LCKIADV',
      );
    }
    for (const ref of trueRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        tail.trueStart,
        tail.trueEnd,
        tail.exitLabel,
        'LCKIADV',
      );
    }
    trueStart = Math.max(trueStart, tail.trueEnd);
  }
  return rewrites;
}

function readSharedIntAdvanceSelectorTail(codeItems, trueStart) {
  const t0 = nextInstructionIndex(codeItems, trueStart);
  const t1 = nextInstructionIndex(codeItems, t0 + 1);
  const t2 = nextInstructionIndex(codeItems, t1 + 1);
  const t3 = nextInstructionIndex(codeItems, t2 + 1);
  if (t0 !== trueStart || t3 < 0) return null;
  const targetLocal = intLoadLocal(codeItems[t0] && codeItems[t0].instruction);
  const widthLocal = intLoadLocal(codeItems[t1] && codeItems[t1].instruction);
  if (targetLocal == null || widthLocal == null) return null;
  if (op(codeItems[t2] && codeItems[t2].instruction) !== 'iadd') return null;
  if (intStoreLocal(codeItems[t3] && codeItems[t3].instruction) !== targetLocal) return null;
  const exitIndex = nextInstructionIndex(codeItems, t3 + 1);
  if (exitIndex < 0) return null;
  const trueLabel = labelName(codeItems[t0] && codeItems[t0].labelDef);
  const exitLabel = labelName(codeItems[exitIndex] && codeItems[exitIndex].labelDef);
  if (!trueLabel || !exitLabel || isStructuredGotoCloneLabel(codeItems[t0], 'LCKIADV_')) return null;

  const falseJump = previousInstructionIndex(codeItems, t0 - 1);
  const f5 = previousInstructionIndex(codeItems, falseJump - 1);
  const f4 = previousInstructionIndex(codeItems, f5 - 1);
  const f3 = previousInstructionIndex(codeItems, f4 - 1);
  const f2 = previousInstructionIndex(codeItems, f3 - 1);
  const f1 = previousInstructionIndex(codeItems, f2 - 1);
  const f0 = previousInstructionIndex(codeItems, f1 - 1);
  if (f0 < 0 || op(codeItems[falseJump] && codeItems[falseJump].instruction) !== 'goto') return null;
  if (findLabelIndex(codeItems, codeItems[falseJump].instruction.arg) !== exitIndex) return null;
  if (intLoadLocal(codeItems[f0] && codeItems[f0].instruction) !== targetLocal) return null;
  if (intLoadLocal(codeItems[f1] && codeItems[f1].instruction) !== widthLocal) return null;
  if (integerConstantValue(codeItems[f2] && codeItems[f2].instruction) == null) return null;
  if (op(codeItems[f3] && codeItems[f3].instruction) !== 'iadd') return null;
  if (op(codeItems[f4] && codeItems[f4].instruction) !== 'iadd') return null;
  if (intStoreLocal(codeItems[f5] && codeItems[f5].instruction) !== targetLocal) return null;
  const falseLabel = labelName(codeItems[f0] && codeItems[f0].labelDef);
  if (!falseLabel) return null;
  return {
    falseStart: f0,
    falseEnd: falseJump + 1,
    trueStart: t0,
    trueEnd: exitIndex,
    falseLabel,
    trueLabel,
    exitLabel,
  };
}

function cloneSharedBooleanPredicateSelectorTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_PREDICATE_SELECTOR_TAIL_MAX_REWRITES || 8);
  for (let storeIndex = 0; storeIndex < codeItems.length && rewrites < maxRewrites; storeIndex += 1) {
    if (intStoreLocal(codeItems[storeIndex] && codeItems[storeIndex].instruction) == null) continue;
    const tail = readSharedBooleanPredicateSelectorTail(codeItems, storeIndex);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tail.trueStart, tail.end)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tail.falseStart, tail.end)) continue;

    const refs = collectLabelReferencesByLabel(codeItems);
    const trueRefs = (refs.get(tail.trueLabel) || [])
      .filter((ref) => ref < tail.trueStart && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    const falseRefs = (refs.get(tail.falseLabel) || [])
      .filter((ref) => ref < tail.falseStart && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction)))
      .sort((a, b) => b - a);
    if (trueRefs.length + falseRefs.length < 2) continue;

    for (const ref of trueRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        tail.trueStart,
        tail.end,
        tail.exitLabel,
        'LCKBPSEL',
      );
    }
    for (const ref of falseRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneConditionalRangeAfterBranchWithFallthroughGoto(
        codeItems,
        code,
        ref,
        tail.falseStart,
        tail.end,
        tail.exitLabel,
        'LCKBPSEL',
      );
    }
    storeIndex = Math.max(storeIndex, tail.end);
  }
  return rewrites;
}

function readSharedBooleanPredicateSelectorTail(codeItems, storeIndex) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_BOOLEAN_PREDICATE_SELECTOR_TAIL_MAX_INSNS || 96);
  const exitIndex = nextInstructionIndex(codeItems, storeIndex + 1);
  if (exitIndex < 0) return null;
  const exitLabel = labelName(codeItems[exitIndex] && codeItems[exitIndex].labelDef);
  if (!exitLabel) return null;

  const refs = collectLabelReferencesByLabel(codeItems);
  const minStart = Math.max(0, storeIndex - maxInsns);
  let falseStart = -1;
  for (let i = storeIndex - 1; i >= minStart; i -= 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label || isStructuredGotoCloneLabel(codeItems[i], 'LCKBPSEL_')) continue;
    const conditionalRefs = (refs.get(label) || []).filter((ref) =>
      ref < i && isConditionalBranch(op(codeItems[ref] && codeItems[ref].instruction))
    );
    if (conditionalRefs.length >= 2) {
      falseStart = i;
      break;
    }
  }
  if (falseStart < 0) return null;

  let trueStart = -1;
  for (let i = falseStart - 1; i >= minStart; i -= 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label || isStructuredGotoCloneLabel(codeItems[i], 'LCKBPSEL_')) continue;
    const gotoRefs = (refs.get(label) || []).filter((ref) =>
      ref < i && op(codeItems[ref] && codeItems[ref].instruction) === 'goto'
    );
    if (gotoRefs.length >= 2) {
      trueStart = i;
      break;
    }
  }
  if (trueStart < 0 || falseStart - trueStart > maxInsns) return null;

  let sawBooleanInvoke = false;
  let sawZero = false;
  let sawOne = false;
  for (let i = trueStart; i <= storeIndex; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    if (isInvokeInstruction(insn) && methodDescriptor(insn) && methodDescriptor(insn).endsWith(')Z')) sawBooleanInvoke = true;
    if (cur === 'iconst_0') sawZero = true;
    if (cur === 'iconst_1') sawOne = true;
    if (isReturnOp(cur) || cur === 'athrow') return null;
  }
  if (!sawBooleanInvoke || !sawZero || !sawOne) return null;

  return {
    trueStart,
    falseStart,
    end: storeIndex + 1,
    trueLabel: labelName(codeItems[trueStart] && codeItems[trueStart].labelDef),
    falseLabel: labelName(codeItems[falseStart] && codeItems[falseStart].labelDef),
    exitLabel,
  };
}

function clonePairedPredicateResultTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_PAIRED_PREDICATE_RESULT_TAIL_MAX_REWRITES || 4);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_PAIRED_PREDICATE_RESULT_TAIL_MAX_INSNS || 160);
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const branchOp = op(branch);
    if (!isConditionalBranch(branchOp)) continue;
    const gotoIndex = nextInstructionIndex(codeItems, branchIndex + 1);
    if (gotoIndex !== branchIndex + 1) continue;
    const fallthroughGoto = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(fallthroughGoto) !== 'goto') continue;

    const trueStart = findLabelIndex(codeItems, branch.arg);
    const falseStart = findLabelIndex(codeItems, fallthroughGoto.arg);
    if (falseStart <= gotoIndex || trueStart <= gotoIndex || falseStart >= trueStart) continue;
    const tail = readPairedPredicateResultTail(codeItems, falseStart, trueStart, maxInsns);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, falseStart, tail.exitIndex)) continue;

    const combined = cloneItems(codeItems.slice(falseStart, tail.exitIndex));
    const renamed = renameInternalLabelsWithMap(combined, `LCKPPR_${rewrites}_`);
    const trueLabel = labelName(codeItems[trueStart] && codeItems[trueStart].labelDef);
    const clonedTrueLabel = renamed.get(trueLabel);
    if (!clonedTrueLabel) continue;
    branch.arg = clonedTrueLabel;
    combined.push({ instruction: { op: 'goto', arg: tail.exitLabel } });
    codeItems.splice(gotoIndex, 1, ...combined);
    rewrites += 1;
    branchIndex += combined.length;
  }
  return rewrites;
}

function readPairedPredicateResultTail(codeItems, falseStart, trueStart, maxInsns) {
  const trueLabel = labelName(codeItems[trueStart] && codeItems[trueStart].labelDef);
  if (!trueLabel) return null;
  let exitIndex = -1;
  let exitLabel = null;
  let sawBranchToTrue = false;
  for (let i = falseStart; i < codeItems.length && i - falseStart <= maxInsns; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    if (isReturnOp(cur) || cur === 'athrow') return null;
    if (isConditionalBranch(cur) && labelName(insn.arg) === trueLabel) sawBranchToTrue = true;
    if (cur !== 'goto') continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target > trueStart) {
      if (exitIndex < 0 || target < exitIndex) {
        exitIndex = target;
        exitLabel = labelName(insn.arg);
      }
    }
  }
  if (!sawBranchToTrue || exitIndex <= trueStart || !exitLabel) return null;
  if (exitIndex - falseStart > maxInsns) return null;
  return { exitIndex, exitLabel };
}

function cloneSharedNullStaticBooleanAssignmentTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_NULL_STATIC_BOOLEAN_ASSIGNMENT_TAIL_MAX_REWRITES || 8);
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const tail = readSharedNullStaticBooleanAssignmentTail(codeItems, branchIndex);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tail.commonStart, tail.commonEnd)) continue;
    const changed = cloneGotoRangeAtWithFallthroughGoto(
      codeItems,
      code,
      tail.gotoIndex,
      tail.commonStart,
      tail.commonEnd,
      tail.exitLabel,
      'LCKNSBAT',
    );
    if (changed) {
      rewrites += changed;
      branchIndex = Math.max(branchIndex, tail.commonEnd);
    }
  }
  return rewrites;
}

function readSharedNullStaticBooleanAssignmentTail(codeItems, branchIndex) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const branchOp = op(branch);
  if (branchOp !== 'ifnull' && branchOp !== 'if_icmpeq' && branchOp !== 'ifeq') return null;
  if (branchOp === 'ifnull') {
    const loadedLocal = refLoadLocal(codeItems[previousInstructionIndex(codeItems, branchIndex - 1)] && codeItems[previousInstructionIndex(codeItems, branchIndex - 1)].instruction);
    if (loadedLocal == null) return null;
  } else if (branchOp === 'if_icmpeq') {
    const prev = previousInstructionIndex(codeItems, branchIndex - 1);
    const beforePrev = previousInstructionIndex(codeItems, prev - 1);
    const hasSentinelCompare =
      intLoadLocal(codeItems[beforePrev] && codeItems[beforePrev].instruction) != null &&
      integerConstantValue(codeItems[prev] && codeItems[prev].instruction) != null;
    if (!hasSentinelCompare) return null;
  } else {
    const xorIndex = previousInstructionIndex(codeItems, branchIndex - 1);
    const constantIndex = previousInstructionIndex(codeItems, xorIndex - 1);
    const loadIndex = previousInstructionIndex(codeItems, constantIndex - 1);
    const hasNotSentinelCompare =
      op(codeItems[xorIndex] && codeItems[xorIndex].instruction) === 'ixor' &&
      integerConstantValue(codeItems[constantIndex] && codeItems[constantIndex].instruction) != null &&
      intLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction) != null;
    if (!hasNotSentinelCompare) return null;
  }
  const falseStart = findLabelIndex(codeItems, branch.arg);
  if (falseStart <= branchIndex) return null;
  const zeroIndex = nextInstructionIndex(codeItems, branchIndex + 1);
  const falsePutIndex = nextInstructionIndex(codeItems, zeroIndex + 1);
  const gotoIndex = nextInstructionIndex(codeItems, falsePutIndex + 1);
  if (!isZeroConstant(codeItems[zeroIndex] && codeItems[zeroIndex].instruction)) return null;
  const falsePut = codeItems[falsePutIndex] && codeItems[falsePutIndex].instruction;
  if (!isPutStaticDescriptor(falsePut, 'Z')) return null;
  if (op(codeItems[gotoIndex] && codeItems[gotoIndex].instruction) !== 'goto') return null;
  const commonStart = findLabelIndex(codeItems, codeItems[gotoIndex].instruction.arg);
  if (commonStart <= gotoIndex) return null;

  const falseLoad = nextInstructionIndex(codeItems, falseStart);
  const falseBranch = nextInstructionIndex(codeItems, falseLoad + 1);
  if (intLoadLocal(codeItems[falseLoad] && codeItems[falseLoad].instruction) == null) return null;
  if (!isConditionalBranch(op(codeItems[falseBranch] && codeItems[falseBranch].instruction))) return null;
  if (findLabelIndex(codeItems, codeItems[falseBranch].instruction.arg) !== commonStart) return null;
  const oneIndex = nextInstructionIndex(codeItems, falseBranch + 1);
  const truePutIndex = nextInstructionIndex(codeItems, oneIndex + 1);
  if (op(codeItems[oneIndex] && codeItems[oneIndex].instruction) !== 'iconst_1') return null;
  const truePut = codeItems[truePutIndex] && codeItems[truePutIndex].instruction;
  if (!sameStaticFieldInstructionRef(falsePut, truePut) || !isPutStaticDescriptor(truePut, 'Z')) return null;

  const commonLabel = labelName(codeItems[commonStart] && codeItems[commonStart].labelDef);
  if (!commonLabel || isStructuredGotoCloneLabel(codeItems[commonStart], 'LCKNSBAT_')) return null;
  const commonEnd = readStaticAssignmentTailEnd(codeItems, commonStart);
  if (commonEnd <= commonStart) return null;
  const exitIndex = nextInstructionIndex(codeItems, commonEnd);
  if (exitIndex < 0) return null;
  const exitLabel = ensureFreshLabel(codeItems, exitIndex, 'LCKNSBAT_EXIT');
  return { gotoIndex, commonStart, commonEnd, exitLabel };
}

function readStaticAssignmentTailEnd(codeItems, start) {
  const maxAssignments = Number(process.env.STRUCTURED_GOTO_SHARED_NULL_STATIC_BOOLEAN_ASSIGNMENT_TAIL_MAX_ASSIGNMENTS || 4);
  let index = start;
  let assignments = 0;
  while (assignments < maxAssignments) {
    const loadIndex = nextInstructionIndex(codeItems, index);
    const putIndex = nextInstructionIndex(codeItems, loadIndex + 1);
    if (loadIndex < 0 || putIndex < 0) break;
    const load = codeItems[loadIndex] && codeItems[loadIndex].instruction;
    const put = codeItems[putIndex] && codeItems[putIndex].instruction;
    if (!isGetStaticDescriptor(load, 'I') || !isPutStaticDescriptor(put, 'I')) break;
    assignments += 1;
    index = putIndex + 1;
  }
  return assignments >= 1 ? index : -1;
}

function sameStaticFieldInstructionRef(left, right) {
  const leftArg = left && typeof left === 'object' ? left.arg : null;
  const rightArg = right && typeof right === 'object' ? right.arg : null;
  return Array.isArray(leftArg) &&
    Array.isArray(rightArg) &&
    leftArg[0] === 'Field' &&
    rightArg[0] === 'Field' &&
    leftArg[1] === rightArg[1] &&
    Array.isArray(leftArg[2]) &&
    Array.isArray(rightArg[2]) &&
    leftArg[2][0] === rightArg[2][0] &&
    leftArg[2][1] === rightArg[2][1];
}

function cloneSharedSimpleInvokeGotoTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_SHARED_SIMPLE_INVOKE_GOTO_TAIL_MAX_REWRITES || 8);
  // Inlining a shared tail at a goto site rewires control flow, and in rare
  // shapes (e.g. the goto being replaced was the only barrier keeping a
  // stack-consuming block from being entered with the wrong operand height) the
  // result underflows even though each cloned tail is itself self-contained.
  // Snapshot the method so we can drop this transform's edits wholesale if the
  // result no longer verifies, leaving every other transform's gains intact.
  const refs = collectLabelReferencesByLabel(codeItems);
  for (let target = 0; target < codeItems.length && rewrites < maxRewrites; target += 1) {
    const targetLabel = labelName(codeItems[target] && codeItems[target].labelDef);
    if (!targetLabel || isStructuredGotoCloneLabel(codeItems[target], 'LCKSIGT_')) continue;
    const gotoRefs = (refs.get(targetLabel) || [])
      .filter((ref) => ref < target && op(codeItems[ref] && codeItems[ref].instruction) === 'goto')
      .sort((a, b) => b - a);
    if (gotoRefs.length < 2) continue;
    const tail = readSimpleInvokeGotoTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    for (const ref of gotoRefs) {
      if (rewrites >= maxRewrites) break;
      rewrites += cloneGotoRangeAtWithFallthroughGoto(
        codeItems,
        code,
        ref,
        target,
        tail.end,
        tail.exitLabel,
        'LCKSIGT',
      );
    }
    target = Math.max(target, tail.end);
  }
  return rewrites;
}

function readSimpleInvokeGotoTail(codeItems, start) {
  const maxInsns = Number(process.env.STRUCTURED_GOTO_SHARED_SIMPLE_INVOKE_GOTO_TAIL_MAX_INSNS || 32);
  let insns = 0;
  let sawInvoke = false;
  for (let i = start; i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    insns += 1;
    if (insns > maxInsns) return null;
    if (isInvokeInstruction(insn)) sawInvoke = true;
    if (isReturnOp(cur) || cur === 'athrow' || isConditionalBranch(cur)) return null;
    if (cur === 'goto') {
      const exitLabel = labelName(insn.arg);
      const exitTarget = findLabelIndex(codeItems, exitLabel);
      if (!sawInvoke || !exitLabel || exitTarget < 0 || exitTarget <= i) return null;
      return { end: i + 1, exitLabel };
    }
  }
  return null;
}

function materializeStackBooleanTerminalGotos(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STACK_BOOLEAN_TERMINAL_GOTO_MAX_REWRITES || 8);
  for (let gotoIndex = 1; gotoIndex < codeItems.length && rewrites < maxRewrites; gotoIndex += 1) {
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const producerIndex = previousInstructionIndex(codeItems, gotoIndex - 1);
    if (producerIndex !== gotoIndex - 1) continue;
    const producer = codeItems[producerIndex] && codeItems[producerIndex].instruction;
    if (!isInvokeDescriptor(producer, '()Z')) continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target <= gotoIndex || target - gotoIndex > 12) continue;
    const targetBranch = codeItems[target] && codeItems[target].instruction;
    if (op(targetBranch) !== 'ifeq' && op(targetBranch) !== 'ifne') continue;
    const terminalIndex = nextInstructionIndex(codeItems, target + 1);
    if (terminalIndex !== target + 1) continue;
    const terminal = codeItems[terminalIndex] && codeItems[terminalIndex].instruction;
    if (!isReturnOp(op(terminal))) continue;
    if (rangeTouchesExceptionTable(code, codeItems, producerIndex, terminalIndex + 1)) continue;
    if (hasLabelReferenceBetween(codeItems, jump.arg, gotoIndex + 1, target)) continue;

    const sourceMeta = cloneItemMetadata(codeItems[gotoIndex]);
    codeItems[gotoIndex] = {
      ...sourceMeta,
      instruction: { op: op(targetBranch), arg: labelName(targetBranch.arg) },
    };
    codeItems.splice(gotoIndex + 1, 0, { instruction: cloneInstruction(terminal) });
    rewrites += 1;
    gotoIndex += 1;
  }
  return rewrites;
}

function hasLabelReferenceBetween(codeItems, label, start, end) {
  const target = labelName(label);
  if (!target) return false;
  for (let i = start; i < end; i += 1) {
    if (collectInstructionLabels(codeItems[i] && codeItems[i].instruction)
      .some((entry) => labelName(entry) === target)) return true;
  }
  return false;
}

function cloneStackBooleanRasterBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STACK_BOOLEAN_RASTER_BODY_MAX_REWRITES || 4);
  for (let branchIndex = 1; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (op(branch) !== 'ifne' && op(branch) !== 'ifeq') continue;
    const terminalIndex = nextInstructionIndex(codeItems, branchIndex + 1);
    if (terminalIndex !== branchIndex + 1) continue;
    if (!isReturnOp(op(codeItems[terminalIndex] && codeItems[terminalIndex].instruction))) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= terminalIndex) continue;
    const producerIndex = previousInstructionIndex(codeItems, branchIndex - 1);
    if (producerIndex < 0 || !isInvokeDescriptor(codeItems[producerIndex] && codeItems[producerIndex].instruction, '()Z')) continue;
    const body = readStackBooleanRasterBody(codeItems, target);
    if (!body) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, body.end)) continue;
    const changed = cloneConditionalRasterBodyAfterBranch(codeItems, code, branchIndex, target, body.end, body.exitLabel);
    if (changed) {
      rewrites += changed;
      branchIndex += body.end - target;
    }
  }
  return rewrites;
}

function readStackBooleanRasterBody(codeItems, start) {
  const maxEnd = Math.min(codeItems.length, start + 460);
  let loopHeader = -1;
  let sawPixelStore = false;
  let sawFloatBlend = false;
  let backwardToHeader = 0;
  for (let i = start; i < maxEnd; i += 1) {
    const cur = op(codeItems[i] && codeItems[i].instruction);
    if (cur === 'iastore') sawPixelStore = true;
    if (cur === 'fmul' || cur === 'f2i') sawFloatBlend = true;
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (inc && inc.incr === -1 && loopHeader < 0) loopHeader = i;
    if (loopHeader >= 0 && cur === 'goto' && findLabelIndex(codeItems, codeItems[i].instruction.arg) === loopHeader) {
      backwardToHeader += 1;
    }
    if (i > start + 96 && isInvokeDescriptor(codeItems[i] && codeItems[i].instruction, '()Z')) {
      if (sawPixelStore && sawFloatBlend && backwardToHeader >= 1) {
        return { end: i, exitLabel: ensureFreshLabel(codeItems, i, 'LCKSBR_EXIT') };
      }
      return null;
    }
  }
  if (!sawPixelStore || !sawFloatBlend || backwardToHeader < 1) return null;
  if (maxEnd === codeItems.length) return { end: codeItems.length, exitLabel: null };
  return null;
}

function cloneConditionalRasterBodyAfterBranch(codeItems, code, branchIndex, start, end, exitLabel) {
  if (end <= start) return 0;
  if (rangeTouchesExceptionTable(code, codeItems, start, end)) return 0;
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const terminalIndex = nextInstructionIndex(codeItems, branchIndex + 1);
  const terminalLabel = ensureFreshLabel(codeItems, terminalIndex, 'LCKSBR_RETURN');
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `LCKSBR_${cloneId}_`);
  if (exitLabel) clone.push({ instruction: { op: 'goto', arg: labelName(exitLabel) } });
  branch.op = invertConditionalBranch(op(branch));
  branch.arg = terminalLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function cloneStackCompareContinuations(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STACK_COMPARE_CONTINUATION_MAX_REWRITES || 12);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_STACK_COMPARE_CONTINUATION_MAX_DISTANCE || 32);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) == null) continue;

    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1 || target - i > maxDistance) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;
    if (!isIntCompareBranch(op(codeItems[fallthrough] && codeItems[fallthrough].instruction))) continue;

    const tail = readStackCompareContinuationTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    const exitLabel = ensureFreshLabel(codeItems, tail.end, `LCKSCC_EXIT_${rewrites}`);
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKSCC_F_${rewrites}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKSCC_${rewrites}_`);
    clone.push({ instruction: { op: 'goto', arg: exitLabel } });

    branch.op = invertConditionalBranch(branchOp);
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function collapseInvariantFlagLoopBackedges(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_INVARIANT_FLAG_BACKEDGE_MAX_REWRITES || 16);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_INVARIANT_FLAG_BACKEDGE_MAX_DISTANCE || 96);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const guard = codeItems[i] && codeItems[i].instruction;
    const guardOp = op(guard);
    if (guardOp !== 'ifeq' && guardOp !== 'ifne') continue;
    const flagLocal = intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (flagLocal == null) continue;
    const knownValueStart = findLabelIndex(codeItems, guard.arg);
    if (knownValueStart <= i || knownValueStart - i > maxDistance) continue;
    const guardTargetLabel = labelName(guard.arg);
    const refs = collectLabelReferencesDetailed(codeItems, guardTargetLabel);
    if (refs.length !== 1 || refs[0] !== i) continue;

    for (let j = knownValueStart + 1; j < codeItems.length && j - knownValueStart <= maxDistance; j += 1) {
      const cur = codeItems[j] && codeItems[j].instruction;
      const curOp = op(cur);
      if (writtenLocalIndexes(cur).includes(flagLocal)) break;
      if (curOp !== guardOp) continue;
      if (intLoadLocal(codeItems[j - 1] && codeItems[j - 1].instruction) !== flagLocal) continue;
      const backedge = findLabelIndex(codeItems, cur.arg);
      if (backedge < 0 || backedge >= j) continue;
      codeItems[j - 1].instruction = 'nop';
      cur.op = 'goto';
      rewrites += 1;
      i = j;
      break;
    }
  }
  return rewrites;
}

function cloneEarlyArrayLengthLoopEntries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_EARLY_ARRAY_LENGTH_LOOP_ENTRY_MAX_REWRITES || 4);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_EARLY_ARRAY_LENGTH_LOOP_ENTRY_MAX_DISTANCE || 620);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const gate = readEarlyArrayLengthLoopEntryGate(codeItems, i);
    if (!gate) continue;
    const target = findLabelIndex(codeItems, gate.branch.arg);
    if (target <= gate.branchIndex || target - gate.branchIndex > maxDistance) continue;
    const loop = readJumpedArrayLengthLoopEntry(codeItems, target);
    if (!loop || loop.end - target > 140) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, loop.end)) continue;

    const exitLabel = ensureFreshLabel(codeItems, loop.end, `LCKEALG_EXIT_${rewrites}`);
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      gate.branchIndex,
      target,
      loop.end,
      exitLabel,
      'LCKEALG',
    );
    if (changed) {
      rewrites += changed;
      i += loop.end - target;
    }
  }
  return rewrites;
}

function readEarlyArrayLengthLoopEntryGate(codeItems, start) {
  const idx = nextInstructionIndexes(codeItems, start, 7);
  if (idx.length < 7 || idx[0] !== start) return null;
  if (intLoadLocal(codeItems[idx[0]] && codeItems[idx[0]].instruction) == null) return null;
  const flagBranch = op(codeItems[idx[1]] && codeItems[idx[1]].instruction);
  if (flagBranch !== 'ifeq' && flagBranch !== 'ifne') return null;
  const arrayGet = codeItems[idx[2]] && codeItems[idx[2]].instruction;
  if (op(arrayGet) !== 'getstatic' || !isIntArrayField(arrayGet)) return null;
  if (op(codeItems[idx[3]] && codeItems[idx[3]].instruction) !== 'arraylength') return null;
  if (integerConstantValue(codeItems[idx[4]] && codeItems[idx[4]].instruction) == null) return null;
  const branch = codeItems[idx[5]] && codeItems[idx[5]].instruction;
  if (!isIntCompareBranch(op(branch))) return null;
  if (op(codeItems[idx[6]] && codeItems[idx[6]].instruction) !== 'goto') return null;
  return { branch, branchIndex: idx[5] };
}

function readJumpedArrayLengthLoopEntry(codeItems, start) {
  const jump = codeItems[start] && codeItems[start].instruction;
  if (op(jump) !== 'goto') return null;
  const header = findLabelIndex(codeItems, jump.arg);
  if (header !== nextInstructionIndex(codeItems, start + 1)) return null;
  const idx = nextInstructionIndexes(codeItems, header, 4);
  if (idx.length < 4) return null;
  const loopLocal = intLoadLocal(codeItems[idx[0]] && codeItems[idx[0]].instruction);
  if (loopLocal == null) return null;
  const arrayGet = codeItems[idx[1]] && codeItems[idx[1]].instruction;
  if (op(arrayGet) !== 'getstatic' || !isIntArrayField(arrayGet)) return null;
  if (op(codeItems[idx[2]] && codeItems[idx[2]].instruction) !== 'arraylength') return null;
  if (!isIntCompareBranch(op(codeItems[idx[3]] && codeItems[idx[3]].instruction))) return null;
  const headerLabel = labelName(codeItems[header] && codeItems[header].labelDef);
  for (let i = idx[3] + 1; i < Math.min(codeItems.length, header + 140); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && labelName(insn.arg) === headerLabel) return { end: i + 1 };
    if (op(insn) === 'iinc') {
      const iinc = readIincInstruction(insn);
      if (iinc && iinc.local !== loopLocal) return null;
    }
  }
  return null;
}

function isIntArrayField(insn) {
  const arg = insn && insn.arg;
  return Array.isArray(arg) && Array.isArray(arg[2]) && arg[2][1] === '[I';
}

function collapseFallthroughInvariantFlagLoopBackedges(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_FALLTHROUGH_FLAG_BACKEDGE_MAX_REWRITES || 16);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_FALLTHROUGH_FLAG_BACKEDGE_MAX_DISTANCE || 220);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const guard = codeItems[i] && codeItems[i].instruction;
    const guardOp = op(guard);
    if (guardOp !== 'ifeq' && guardOp !== 'ifne') continue;
    const flagLocal = intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (flagLocal == null) continue;
    const guardedExit = findLabelIndex(codeItems, guard.arg);
    if (guardedExit <= i || guardedExit - i > maxDistance) continue;

    for (let j = i + 2; j < guardedExit && rewrites < maxRewrites; j += 1) {
      const cur = codeItems[j] && codeItems[j].instruction;
      const curOp = op(cur);
      if (writtenLocalIndexes(cur).includes(flagLocal)) break;
      if (curOp !== invertConditionalBranch(guardOp)) continue;
      if (intLoadLocal(codeItems[j - 1] && codeItems[j - 1].instruction) !== flagLocal) continue;
      const backedge = findLabelIndex(codeItems, cur.arg);
      if (backedge < 0 || backedge >= j || j - backedge > maxDistance) continue;
      if (!isLoopHeaderAt(codeItems, backedge)) continue;
      codeItems[j - 1].instruction = 'nop';
      cur.op = 'goto';
      rewrites += 1;
      i = j;
      break;
    }
  }
  return rewrites;
}

function removeInvariantFlagForwardLoopExits(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_INVARIANT_FLAG_FORWARD_EXIT_MAX_REWRITES || 8);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_INVARIANT_FLAG_FORWARD_EXIT_MAX_DISTANCE || 260);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const guard = codeItems[i] && codeItems[i].instruction;
    const guardOp = op(guard);
    if (guardOp !== 'ifeq' && guardOp !== 'ifne') continue;
    const flagLocal = intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (flagLocal == null) continue;
    const guardedExit = findLabelIndex(codeItems, guard.arg);
    if (guardedExit <= i || guardedExit - i > maxDistance) continue;

    const secondLoad = nextInstructionIndex(codeItems, i + 1);
    const secondBranchIndex = nextInstructionIndex(codeItems, secondLoad + 1);
    const normalExitIndex = nextInstructionIndex(codeItems, secondBranchIndex + 1);
    if (secondLoad !== i + 1 || secondBranchIndex !== i + 2 || normalExitIndex !== i + 3) continue;
    if (intLoadLocal(codeItems[secondLoad] && codeItems[secondLoad].instruction) !== flagLocal) continue;
    const secondBranch = codeItems[secondBranchIndex] && codeItems[secondBranchIndex].instruction;
    if (op(secondBranch) !== invertConditionalBranch(guardOp)) continue;
    const backedge = findLabelIndex(codeItems, secondBranch.arg);
    if (backedge < 0 || backedge >= secondBranchIndex || secondBranchIndex - backedge > maxDistance) continue;
    if (!isLoopHeaderAt(codeItems, backedge)) continue;
    const normalExit = codeItems[normalExitIndex] && codeItems[normalExitIndex].instruction;
    if (op(normalExit) !== 'goto') continue;
    const normalExitTarget = findLabelIndex(codeItems, normalExit.arg);
    if (normalExitTarget <= secondBranchIndex || normalExitTarget > guardedExit) continue;
    if (writtenLocalIndexes(guard).includes(flagLocal)) continue;

    codeItems[i - 1].instruction = 'nop';
    guard.op = 'nop';
    delete guard.arg;
    rewrites += 1;
  }
  return rewrites;
}

function removeStackCarriedInvariantFlagForwardExits(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STACK_CARRIED_INVARIANT_FLAG_FORWARD_EXIT_MAX_REWRITES || 4);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_STACK_CARRIED_INVARIANT_FLAG_FORWARD_EXIT_MAX_DISTANCE || 1400);
  for (let i = 2; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const guard = codeItems[i] && codeItems[i].instruction;
    const guardOp = op(guard);
    if (guardOp !== 'ifeq' && guardOp !== 'ifne') continue;
    const flagLocal = intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (flagLocal == null) continue;
    if (refLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction) == null) continue;
    const guardedExit = findLabelIndex(codeItems, guard.arg);
    if (guardedExit <= i || guardedExit - i > maxDistance) continue;
    if (refStoreLocal(codeItems[guardedExit] && codeItems[guardedExit].instruction) == null) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;
    const fallthroughOp = op(codeItems[fallthrough] && codeItems[fallthrough].instruction);
    if (fallthroughOp !== 'ifnull' && fallthroughOp !== 'ifnonnull') continue;
    if (writtenLocalIndexes(guard).includes(flagLocal)) continue;

    codeItems[i - 1].instruction = 'nop';
    guard.op = 'nop';
    delete guard.arg;
    rewrites += 1;
  }
  return rewrites;
}

function removeNullGuardInvariantFlagForwardExits(codeItems) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_NULL_GUARD_INVARIANT_FLAG_FORWARD_EXIT_MAX_REWRITES || 4);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_NULL_GUARD_INVARIANT_FLAG_FORWARD_EXIT_MAX_DISTANCE || 1400);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const guard = codeItems[i] && codeItems[i].instruction;
    const guardOp = op(guard);
    if (guardOp !== 'ifeq' && guardOp !== 'ifne') continue;
    const flagLocal = intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (flagLocal == null) continue;
    const guardedExit = findLabelIndex(codeItems, guard.arg);
    if (guardedExit <= i || guardedExit - i > maxDistance) continue;
    const nullLoad = nextInstructionIndex(codeItems, i + 1);
    const nullGuardIndex = nextInstructionIndex(codeItems, nullLoad + 1);
    if (nullLoad !== i + 1 || nullGuardIndex !== i + 2) continue;
    if (refLoadLocal(codeItems[nullLoad] && codeItems[nullLoad].instruction) == null) continue;
    const nullGuardOp = op(codeItems[nullGuardIndex] && codeItems[nullGuardIndex].instruction);
    if (nullGuardOp !== 'ifnull' && nullGuardOp !== 'ifnonnull') continue;
    if (writtenLocalIndexes(guard).includes(flagLocal)) continue;

    codeItems[i - 1].instruction = 'nop';
    guard.op = 'nop';
    delete guard.arg;
    rewrites += 1;
  }
  return rewrites;
}

function isLoopHeaderAt(codeItems, index) {
  const branch = codeItems[index + 2] && codeItems[index + 2].instruction;
  return intLoadLocal(codeItems[index] && codeItems[index].instruction) != null &&
    (op(codeItems[index + 1] && codeItems[index + 1].instruction) === 'arraylength' ||
      isIntegerConstant(codeItems[index + 1] && codeItems[index + 1].instruction) ||
      intLoadLocal(codeItems[index + 1] && codeItems[index + 1].instruction) != null) &&
    isIntCompareBranch(op(branch));
}

function cloneStackCompareResetContinuations(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_STACK_COMPARE_RESET_MAX_REWRITES || 12);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_STACK_COMPARE_RESET_MAX_DISTANCE || 96);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!isIntCompareBranch(branchOp)) continue;
    const targetLabel = labelName(branch.arg);
    const target = findLabelIndex(codeItems, targetLabel);
    if (target <= i + 1 || target - i > maxDistance) continue;
    const refs = collectLabelReferencesDetailed(codeItems, targetLabel);
    if (refs.length < 2 || !refs.includes(i)) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;

    const tail = readStackCompareResetTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    const exitLabel = ensureFreshLabel(codeItems, tail.end, `LCKSCR_EXIT_${rewrites}`);
    const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKSCR_F_${rewrites}`);
    const clone = cloneItems(codeItems.slice(target, tail.end));
    renameInternalLabels(clone, `LCKSCR_${rewrites}_`);
    clone.push({ instruction: { op: 'goto', arg: exitLabel } });

    branch.op = invertConditionalBranch(branchOp);
    branch.arg = fallthroughLabel;
    codeItems.splice(i + 1, 0, ...clone);
    rewrites += 1;
    i += clone.length;
  }
  return rewrites;
}

function cloneBooleanPutfieldCompareContinuations(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_BOOLEAN_PUTFIELD_COMPARE_MAX_REWRITES || 8);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_BOOLEAN_PUTFIELD_COMPARE_MAX_DISTANCE || 220);
  for (let i = 1; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) == null) continue;

    const target = findLabelIndex(codeItems, branch.arg);
    if (target < 0 || Math.abs(i - target) > maxDistance) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;

    const tail = readBooleanPutfieldCompareTail(codeItems, target);
    if (!tail) continue;
    if (tail.end <= target) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;

    if (target < i) {
      const exitLabel = ensureFreshLabel(codeItems, tail.end, `LCKBPC_EXIT_${rewrites}`);
      const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `LCKBPC_F_${rewrites}`);
      const clone = cloneItems(codeItems.slice(target, tail.end));
      renameInternalLabels(clone, `LCKBPC_${rewrites}_`);
      clone.push({ instruction: { op: 'goto', arg: exitLabel } });

      branch.op = invertConditionalBranch(branchOp);
      branch.arg = fallthroughLabel;
      codeItems.splice(i + 1, 0, ...clone);
      rewrites += 1;
      i += clone.length;
      continue;
    }

    const exitLabel = ensureFreshLabel(codeItems, tail.end, `LCKBPC_EXIT_${rewrites}`);
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      tail.end,
      exitLabel,
      'LCKBPC',
    );
    if (changed) {
      rewrites += changed;
      i += tail.end - target;
    }
  }
  return rewrites;
}

function cloneBooleanPutfieldDrainLoopEntries(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_BOOLEAN_PUTFIELD_DRAIN_MAX_REWRITES || 8);
  const maxDistance = Number(process.env.STRUCTURED_GOTO_BOOLEAN_PUTFIELD_DRAIN_MAX_DISTANCE || 180);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!isIntCompareBranch(branchOp)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1 || target - i > maxDistance) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;

    const tail = readBooleanPutfieldDrainLoopEntry(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const exitLabel = ensureFreshLabel(codeItems, tail.end, `LCKBPD_EXIT_${rewrites}`);
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      tail.end,
      exitLabel,
      'LCKBPD',
    );
    if (changed) {
      rewrites += changed;
      i += tail.end - target;
    }
  }
  return rewrites;
}

function readBooleanPutfieldDrainLoopEntry(codeItems, start) {
  const prefix = nextInstructionIndexes(codeItems, start, 6);
  if (prefix.length < 6) return null;
  if (refLoadLocal(codeItems[prefix[0]] && codeItems[prefix[0]].instruction) == null) return null;
  if (integerConstantValue(codeItems[prefix[1]] && codeItems[prefix[1]].instruction) !== 1) return null;
  if (!isBooleanPutfield(codeItems[prefix[2]] && codeItems[prefix[2]].instruction)) return null;
  const initSource = intLoadLocal(codeItems[prefix[3]] && codeItems[prefix[3]].instruction);
  const loopLocal = intStoreLocal(codeItems[prefix[4]] && codeItems[prefix[4]].instruction);
  if (initSource == null || loopLocal == null) return null;
  if (intLoadLocal(codeItems[prefix[5]] && codeItems[prefix[5]].instruction) !== loopLocal) return null;

  const maxEnd = Math.min(codeItems.length, start + 96);
  for (let i = prefix[5] + 1; i < maxEnd; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) !== 'if_icmpge' && op(insn) !== 'if_icmplt') continue;
    const end = findLabelIndex(codeItems, insn.arg);
    if (end <= i || end - start > 96) return null;
    if (!rangeContainsIincForLocal(codeItems, i + 1, end, loopLocal)) return null;
    if (!hasBackedgeToLabelInRange(codeItems, labelName(codeItems[prefix[5]] && codeItems[prefix[5]].labelDef), i + 1, end)) return null;
    return { end, loopLocal };
  }
  return null;
}

function rangeContainsIincForLocal(codeItems, start, end, local) {
  for (let i = start; i < end; i += 1) {
    const iinc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (iinc && iinc.local === local) return true;
  }
  return false;
}

function hasBackedgeToLabelInRange(codeItems, label, start, end) {
  if (!label) return false;
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && labelName(insn.arg) === label) return true;
    if (isConditionalBranch(op(insn)) && labelName(insn.arg) === label) return true;
  }
  return false;
}

function readBooleanPutfieldCompareTail(codeItems, start) {
  if (!isIntArithmeticOp(op(codeItems[start] && codeItems[start].instruction))) return null;
  const compareIndex = nextInstructionIndex(codeItems, start + 1);
  if (compareIndex !== start + 1) return null;
  const compare = codeItems[compareIndex] && codeItems[compareIndex].instruction;
  if (!isIntCompareBranch(op(compare))) return null;

  const trueConstantIndex = nextInstructionIndex(codeItems, compareIndex + 1);
  if (trueConstantIndex !== compareIndex + 1) return null;
  const trueValue = integerConstantValue(codeItems[trueConstantIndex] && codeItems[trueConstantIndex].instruction);
  if (trueValue !== 0 && trueValue !== 1) return null;

  const gotoIndex = nextInstructionIndex(codeItems, trueConstantIndex + 1);
  if (gotoIndex !== trueConstantIndex + 1 || op(codeItems[gotoIndex] && codeItems[gotoIndex].instruction) !== 'goto') return null;
  const falseConstantIndex = findLabelIndex(codeItems, compare.arg);
  const joinIndex = findLabelIndex(codeItems, codeItems[gotoIndex].instruction.arg);
  if (falseConstantIndex <= gotoIndex || joinIndex <= falseConstantIndex) return null;
  if (nextInstructionIndex(codeItems, falseConstantIndex) !== falseConstantIndex) return null;

  const falseValue = integerConstantValue(codeItems[falseConstantIndex] && codeItems[falseConstantIndex].instruction);
  if (falseValue !== 0 && falseValue !== 1 || falseValue === trueValue) return null;
  const put = codeItems[joinIndex] && codeItems[joinIndex].instruction;
  if (!isBooleanPutfield(put)) return null;
  return { end: joinIndex + 1 };
}

function readStackCompareResetTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 8);
  if (indexes.length < 7) return null;
  let cursor = 0;
  const objLocal = refLoadLocal(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction);
  if (objLocal == null) return null;
  cursor += 1;
  const field = codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction;
  if (op(field) === 'checkcast') {
    cursor += 1;
    if (cursor >= indexes.length) return null;
  }
  if (!isIntFieldRead(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction)) return null;
  cursor += 1;
  const constant = integerConstantValue(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction);
  if (constant == null || Math.abs(constant) > 8) return null;
  cursor += 1;
  if (!isIntArithmeticOp(op(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction))) return null;
  cursor += 1;
  const loadedLocal = intLoadLocal(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction);
  if (loadedLocal == null) return null;
  cursor += 1;
  if (!isIntArithmeticOp(op(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction))) return null;
  cursor += 1;
  const storeLocal = intStoreLocal(codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction);
  if (storeLocal == null) return null;
  return { end: indexes[cursor] + 1, objLocal, loadedLocal, storeLocal };
}

function readStackCompareContinuationTail(codeItems, start) {
  const firstOp = op(codeItems[start] && codeItems[start].instruction);
  if (!isIntArithmeticOp(firstOp)) return null;
  const storeLocal = intStoreLocal(codeItems[start + 1] && codeItems[start + 1].instruction);
  if (storeLocal == null) return null;
  if (isBranchOp(op(codeItems[start] && codeItems[start].instruction)) ||
    isBranchOp(op(codeItems[start + 1] && codeItems[start + 1].instruction))) {
    return null;
  }
  return { end: start + 2, storeLocal };
}

function isIntArithmeticOp(cur) {
  return cur === 'iadd' || cur === 'isub' || cur === 'imul' || cur === 'idiv' ||
    cur === 'irem' || cur === 'iand' || cur === 'ior' || cur === 'ixor';
}

function isIntFieldRead(insn) {
  if (op(insn) !== 'getfield' && op(insn) !== 'getstatic') return false;
  const arg = insn && insn.arg;
  return Array.isArray(arg) && Array.isArray(arg[2]) && arg[2][1] === 'I';
}

function isBooleanPutfield(insn) {
  if (op(insn) !== 'putfield') return false;
  const arg = insn && insn.arg;
  return Array.isArray(arg) && Array.isArray(arg[2]) && arg[2][1] === 'Z';
}

function cloneEventLoopActionTails(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 2; i += 1) {
    const loopCall = codeItems[i] && codeItems[i].instruction;
    if (!isInvoke(loopCall, 'dl', 'f', '(I)Z')) continue;
    const exitBranchIndex = nextInstructionIndex(codeItems, i + 1);
    const exitBranch = codeItems[exitBranchIndex] && codeItems[exitBranchIndex].instruction;
    if (exitBranchIndex !== i + 1 || op(exitBranch) !== 'ifeq') continue;
    const loopExit = findLabelIndex(codeItems, exitBranch.arg);
    if (loopExit <= exitBranchIndex) continue;

    const branchIndex = findEiQEqualsBranch(codeItems, exitBranchIndex + 1, Math.min(loopExit, exitBranchIndex + 48), 13);
    if (branchIndex < 0) continue;
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex || target >= loopExit) continue;
    if (!rangeContainsInvokeShape(codeItems, target, Math.min(loopExit, target + 420), 'q', 'a', '(IZII)V')) continue;
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      branchIndex,
      target,
      loopExit,
      labelName(codeItems[loopExit] && codeItems[loopExit].labelDef),
      'LCKEVT',
    );
    if (changed) rewrites += changed;
  }
  return rewrites;
}

function cloneEventActionTails(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 3; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const target = findLabelIndex(codeItems, insn && insn.arg);
    if (target <= i) continue;
    const tail = readEventActionTail(codeItems, target);
    if (!tail) continue;
    let changed = 0;
    if (op(insn) === 'goto') {
      changed = cloneGotoRangeAtWithFallthroughGoto(codeItems, code, i, target, tail.end, tail.exitLabel, 'LCKACTION');
    } else if (isConditionalBranch(op(insn))) {
      changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(codeItems, code, i, target, tail.end, tail.exitLabel, 'LCKACTION');
    }
    if (changed) rewrites += changed;
  }
  return rewrites;
}

function retargetObjectMergeLoopTrampolines(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 8; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifnonnull' || refLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 1) continue;
    const trampoline = findLabelIndex(codeItems, branch.arg);
    if (trampoline <= i) continue;
    const jump = codeItems[trampoline] && codeItems[trampoline].instruction;
    if (op(jump) !== 'goto') continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header < 0 || header >= trampoline) continue;
    if (!looksLikeObjectMergeHeader(codeItems, header)) continue;
    branch.arg = labelName(jump.arg);
    rewrites += 1;
  }
  return rewrites;
}

function hasObjectMergeLoopTrampoline(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifnonnull' || refLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 1) continue;
    const trampoline = findLabelIndex(codeItems, branch.arg);
    if (trampoline <= i) continue;
    const jump = codeItems[trampoline] && codeItems[trampoline].instruction;
    if (op(jump) !== 'goto') continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header >= 0 && header < trampoline && looksLikeObjectMergeHeader(codeItems, header)) return true;
  }
  return false;
}

function looksLikeObjectMergeHeader(codeItems, start) {
  return isGetStatic(codeItems[start] && codeItems[start].instruction, 'rd', 'rd_g', 'Lwa;') &&
    isGetField(codeItems[start + 1] && codeItems[start + 1].instruction, 'wa', 'wa_g', 'I') &&
    refLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction) === 1 &&
    op(codeItems[start + 3] && codeItems[start + 3].instruction) === 'checkcast' &&
    isGetField(codeItems[start + 4] && codeItems[start + 4].instruction, 'wa', 'wa_g', 'I') &&
    isIntCompareBranch(op(codeItems[start + 5] && codeItems[start + 5].instruction));
}

function cloneRendererDispatchBodies(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 10; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isBranchOp(op(insn))) continue;
    const target = findLabelIndex(codeItems, insn.arg);
    if (target <= i) continue;
    const body = readRendererDispatchBody(codeItems, target);
    if (!body) continue;
    const changed = op(insn) === 'goto'
      ? cloneGotoRangeAtWithFallthroughGoto(codeItems, code, i, target, body.end, body.exitLabel, 'LCKRENDER')
      : cloneConditionalRangeAfterBranchWithFallthroughGoto(codeItems, code, i, target, body.end, body.exitLabel, 'LCKRENDER');
    if (changed) rewrites += changed;
  }
  return rewrites;
}

function hasRendererDispatchBody(codeItems) {
  for (let i = 0; i < codeItems.length; i += 1) {
    if (readRendererDispatchBody(codeItems, i)) return true;
  }
  return false;
}

function readRendererDispatchBody(codeItems, start) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'aload_0') return null;
  if (!isGetField(codeItems[start + 1] && codeItems[start + 1].instruction, 'eg', 'eg_k', 'Lwe;')) return null;
  let invokeIndex = -1;
  for (let i = start + 2; i < Math.min(codeItems.length, start + 42); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isInvoke(insn, 'we', 'a', '(Ljava/lang/String;IIII)V') ||
      isInvoke(insn, 'we', 'b', '(Ljava/lang/String;IIII)V') ||
      isInvoke(insn, 'we', 'c', '(Ljava/lang/String;IIII)V')) {
      invokeIndex = i;
      break;
    }
  }
  if (invokeIndex < 0) return null;
  const jump = codeItems[invokeIndex + 1] && codeItems[invokeIndex + 1].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  const exit = findLabelIndex(codeItems, exitLabel);
  if (exit <= invokeIndex || !looksLikeRendererCleanup(codeItems, exit)) return null;
  return { end: invokeIndex + 1, exitLabel };
}

function looksLikeRendererCleanup(codeItems, start) {
  return intLoadLocal(codeItems[start] && codeItems[start].instruction) === 2 &&
    isInvoke(codeItems[start + 1] && codeItems[start + 1].instruction, 'tk', 'b', '(Z)V') &&
    op(codeItems[start + 2] && codeItems[start + 2].instruction) === 'return';
}

function cloneGridTileUpdateContinueHeaders(codeItems) {
  let rewrites = 0;
  for (let i = 1; i < codeItems.length && rewrites < 8; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const inc = readIincInstruction(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (!inc || inc.local !== 3 || inc.incr !== 1) continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header < 0 || header >= i) continue;
    const shape = readGridTileUpdateHeader(codeItems, header);
    if (!shape) continue;
    if (!hasGridTileWriteBefore(codeItems, i - 12, i - 1, inc.local)) continue;
    const bodyLabel = ensureFreshLabel(codeItems, shape.bodyStart, `LCKGRID_BODY_${rewrites}`);
    const exitLabel = shape.exitLabel;
    const limitInstruction = JSON.parse(JSON.stringify(codeItems[shape.limitIndex].instruction));
    codeItems.splice(i, 1,
      { instruction: intLoadInstruction(inc.local) },
      { instruction: limitInstruction },
      { instruction: { op: 'if_icmpge', arg: exitLabel } },
      { instruction: { op: 'goto', arg: bodyLabel } },
    );
    rewrites += 1;
    i += 3;
  }
  return rewrites;
}

function retargetDuplicatePreLoopSetup(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 17) continue;
    const falseStart = nextInstructionIndex(codeItems, i + 1);
    const trueStart = findLabelIndex(codeItems, branch.arg);
    if (falseStart !== i + 1 || trueStart <= falseStart) continue;
    const falseSetup = readModuloPreLoopSetup(codeItems, falseStart);
    if (!falseSetup) continue;
    let sharedSetup = null;
    for (let j = trueStart + 1; j < Math.min(codeItems.length, trueStart + 96); j += 1) {
      sharedSetup = readModuloPreLoopSetup(codeItems, j);
      if (sharedSetup) {
        sharedSetup.start = j;
        break;
      }
    }
    if (!sharedSetup) continue;
    if (sharedSetup.header <= falseSetup.header) continue;
    const sharedLabel = ensureFreshLabel(codeItems, sharedSetup.start, 'LCKPRELOOP_SHARED');
    const meta = cloneItemMetadata(codeItems[falseStart]);
    codeItems[falseStart] = { ...meta, instruction: { op: 'goto', arg: sharedLabel } };
    return 1;
  }
  return 0;
}

function hasDuplicatePreLoopSetup(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 17) continue;
    const falseStart = nextInstructionIndex(codeItems, i + 1);
    const trueStart = findLabelIndex(codeItems, branch.arg);
    if (falseStart !== i + 1 || trueStart <= falseStart) continue;
    if (!readModuloPreLoopSetup(codeItems, falseStart)) continue;
    for (let j = trueStart + 1; j < Math.min(codeItems.length, trueStart + 96); j += 1) {
      if (readModuloPreLoopSetup(codeItems, j)) return true;
    }
  }
  return false;
}

function hasGridTileUpdateContinueHeader(codeItems) {
  for (let i = 1; i < codeItems.length; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const inc = readIincInstruction(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (!inc || inc.local !== 3 || inc.incr !== 1) continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header >= 0 && header < i && readGridTileUpdateHeader(codeItems, header)) return true;
  }
  return false;
}

function readModuloPreLoopSetup(codeItems, start) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'iconst_m1') return null;
  if (!isGetStaticDescriptor(codeItems[start + 1] && codeItems[start + 1].instruction, 'I')) return null;
  if (op(codeItems[start + 2] && codeItems[start + 2].instruction) !== 'iconst_1') return null;
  if (op(codeItems[start + 3] && codeItems[start + 3].instruction) !== 'iand') return null;
  if (op(codeItems[start + 4] && codeItems[start + 4].instruction) !== 'iconst_m1') return null;
  if (op(codeItems[start + 5] && codeItems[start + 5].instruction) !== 'ixor') return null;
  const oddBranch = codeItems[start + 6] && codeItems[start + 6].instruction;
  if (op(oddBranch) !== 'if_icmpeq') return null;
  if (op(codeItems[start + 7] && codeItems[start + 7].instruction) !== 'return') return null;
  const update = findLabelIndex(codeItems, oddBranch.arg);
  if (update !== start + 8) return null;
  if (!isGetStaticDescriptor(codeItems[update] && codeItems[update].instruction, 'I')) return null;
  if (op(codeItems[update + 1] && codeItems[update + 1].instruction) !== 'iconst_1') return null;
  if (op(codeItems[update + 2] && codeItems[update + 2].instruction) !== 'iadd') return null;
  if (integerConstantValue(codeItems[update + 3] && codeItems[update + 3].instruction) !== 8) return null;
  if (op(codeItems[update + 4] && codeItems[update + 4].instruction) !== 'irem') return null;
  if (!isPutStaticDescriptor(codeItems[update + 5] && codeItems[update + 5].instruction, 'I')) return null;
  if (op(codeItems[update + 6] && codeItems[update + 6].instruction) !== 'iconst_0') return null;
  if (intStoreLocal(codeItems[update + 7] && codeItems[update + 7].instruction) !== 3) return null;
  const header = update + 8;
  if (!readGridTileUpdateHeader(codeItems, header)) return null;
  return { header };
}

function readGridTileUpdateHeader(codeItems, start) {
  if (intLoadLocal(codeItems[start] && codeItems[start].instruction) !== 3) return null;
  const limit = codeItems[start + 1] && codeItems[start + 1].instruction;
  if (!isGetStaticDescriptor(limit, 'I')) return null;
  const exitBranch = codeItems[start + 2] && codeItems[start + 2].instruction;
  if (op(exitBranch) !== 'if_icmpge') return null;
  const exitLabel = labelName(exitBranch.arg);
  if (!exitLabel || findLabelIndex(codeItems, exitLabel) <= start) return null;
  return { limitIndex: start + 1, bodyStart: start + 3, exitLabel };
}

function hasGridTileWriteBefore(codeItems, start, end, indexLocal) {
  const min = Math.max(0, start);
  for (let i = min; i < end; i += 1) {
    if (!isGetStaticDescriptor(codeItems[i] && codeItems[i].instruction, '[[C')) continue;
    for (let j = i + 1; j < Math.min(end, i + 14); j += 1) {
      if (intLoadLocal(codeItems[j] && codeItems[j].instruction) !== indexLocal) continue;
      for (let k = j + 1; k <= Math.min(end, j + 8); k += 1) {
        if (op(codeItems[k] && codeItems[k].instruction) === 'castore') return true;
      }
    }
  }
  return false;
}

function cloneStateUpdateCreationBody(codeItems, code) {
  const branch = findStateUpdateCreationBranch(codeItems);
  if (!branch) return 0;
  const joinLabel = ensureFreshLabel(codeItems, branch.bodyEnd, 'LCKSTATEQ_JOIN');
  return cloneConditionalRangeAfterBranchWithFallthroughGoto(
    codeItems,
    code,
    branch.branchIndex,
    branch.bodyStart,
    branch.bodyEnd,
    joinLabel,
    'LCKSTATEQ',
  );
}

function findStateUpdateCreationBranch(codeItems) {
  for (let i = 0; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifne') continue;
    const bodyStart = findLabelIndex(codeItems, branch.arg);
    if (bodyStart <= i) continue;
    const bodyEnd = readStateUpdateCreationBodyEnd(codeItems, bodyStart);
    if (bodyEnd <= bodyStart) continue;
    if (!looksLikeQueueEmptyCheck(codeItems, i)) continue;
    return { branchIndex: i, bodyStart, bodyEnd };
  }
  return null;
}

function looksLikeQueueEmptyCheck(codeItems, branchIndex) {
  return op(codeItems[branchIndex - 6] && codeItems[branchIndex - 6].instruction) === 'aload_0' &&
    isGetField(codeItems[branchIndex - 5] && codeItems[branchIndex - 5].instruction, 'al', 'al_u', 'Lko;') &&
    intLoadLocal(codeItems[branchIndex - 4] && codeItems[branchIndex - 4].instruction) === 5 &&
    integerConstantValue(codeItems[branchIndex - 3] && codeItems[branchIndex - 3].instruction) === -19063 &&
    op(codeItems[branchIndex - 2] && codeItems[branchIndex - 2].instruction) === 'iadd' &&
    isInvoke(codeItems[branchIndex - 1] && codeItems[branchIndex - 1].instruction, 'ko', 'c', '(I)Z');
}

function readStateUpdateCreationBodyEnd(codeItems, start) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'aload_0') return -1;
  if (!isGetField(codeItems[start + 1] && codeItems[start + 1].instruction, 'al', 'al_u', 'Lko;')) return -1;
  if (integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction) !== -58) return -1;
  if (op(codeItems[start + 3] && codeItems[start + 3].instruction) !== 'new') return -1;
  if ((codeItems[start + 3] && codeItems[start + 3].instruction || {}).arg !== 'qe') return -1;
  if (op(codeItems[start + 4] && codeItems[start + 4].instruction) !== 'dup') return -1;
  if (intLoadLocal(codeItems[start + 5] && codeItems[start + 5].instruction) !== 3) return -1;
  if (intLoadLocal(codeItems[start + 6] && codeItems[start + 6].instruction) !== 4) return -1;
  if (!isInvoke(codeItems[start + 7] && codeItems[start + 7].instruction, 'qe', '<init>', '(II)V')) return -1;
  if (op(codeItems[start + 8] && codeItems[start + 8].instruction) !== 'dup') return -1;
  const createdLocal = refStoreLocal(codeItems[start + 9] && codeItems[start + 9].instruction);
  if (createdLocal == null) return -1;
  if (refLoadLocal(codeItems[start + 10] && codeItems[start + 10].instruction) !== createdLocal) return -1;
  if (refStoreLocal(codeItems[start + 11] && codeItems[start + 11].instruction) !== 6) return -1;
  if (!isInvoke(codeItems[start + 12] && codeItems[start + 12].instruction, 'ko', 'b', '(BLma;)V')) return -1;
  if (op(codeItems[start + 13] && codeItems[start + 13].instruction) !== 'aload_0') return -1;
  if (!isGetField(codeItems[start + 14] && codeItems[start + 14].instruction, 'al', 'al_f', 'Lsq;')) return -1;
  if (refLoadLocal(codeItems[start + 15] && codeItems[start + 15].instruction) !== createdLocal) return -1;
  if (op(codeItems[start + 16] && codeItems[start + 16].instruction) !== 'iconst_0') return -1;
  if (!isInvoke(codeItems[start + 17] && codeItems[start + 17].instruction, 'sq', 'a', '(Lqe;Z)V')) return -1;
  if (op(codeItems[start + 18] && codeItems[start + 18].instruction) !== 'aload_0') return -1;
  if (intLoadLocal(codeItems[start + 19] && codeItems[start + 19].instruction) !== 4) return -1;
  return start + 18;
}

function cloneDisableBackwardTails(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 4; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    if (!isMinusOneCompareBranch(codeItems, i, [8, 9, 10])) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart < 0 || tailStart >= i) continue;
    const tail = readDisableTail(codeItems, tailStart);
    if (!tail) continue;
    const changed = cloneBackwardConditionalTailAtBranch(codeItems, i, tailStart, tail.end, 'LCKDISABLE');
    if (changed) {
      rewrites += changed;
      i += tail.end - tailStart;
    }
  }
  return rewrites;
}

function hasDisableBackwardTail(codeItems) {
  for (let i = 0; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    if (!isMinusOneCompareBranch(codeItems, i, [8, 9, 10])) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart >= 0 && tailStart < i && readDisableTail(codeItems, tailStart)) return true;
  }
  return false;
}

function readDisableTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 5);
  if (indexes.length < 5) return null;
  if (refLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction) !== 7) return null;
  if (integerConstantValue(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) !== 0) return null;
  if (!isPutField(codeItems[indexes[2]] && codeItems[indexes[2]].instruction, 'ei', 'ei_c', 'Z')) return null;
  const inc = readIincInstruction(codeItems[indexes[3]] && codeItems[indexes[3]].instruction);
  if (!inc || inc.local !== 6 || inc.incr !== 1) return null;
  const jump = codeItems[indexes[4]] && codeItems[indexes[4]].instruction;
  if (op(jump) !== 'goto' || findLabelIndex(codeItems, jump.arg) >= start) return null;
  return { end: indexes[4] + 1 };
}

function isMinusOneCompareBranch(codeItems, branchIndex, locals) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  if (!isIntCompareBranch(op(branch))) return false;
  const leftIndex = previousInstructionIndex(codeItems, branchIndex - 2);
  const rightIndex = previousInstructionIndex(codeItems, branchIndex - 1);
  const left = codeItems[leftIndex] && codeItems[leftIndex].instruction;
  const right = codeItems[rightIndex] && codeItems[rightIndex].instruction;
  return (integerConstantValue(left) === -1 && locals.includes(intLoadLocal(right))) ||
    (locals.includes(intLoadLocal(left)) && integerConstantValue(right) === -1);
}

function retargetColumnContinues(codeItems) {
  const canonical = findCanonicalColumnContinue(codeItems);
  if (!canonical) return 0;
  let rewrites = 0;
  for (let i = canonical.iincIndex - 1; i > canonical.headerStart && rewrites < 16; i -= 1) {
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.local !== 21 || inc.incr !== 1) continue;
    const jumpIndex = nextInstructionIndex(codeItems, i + 1);
    if (jumpIndex !== i + 1) continue;
    const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
    if (op(jump) !== 'goto' || labelName(jump.arg) !== canonical.headerLabel) continue;
    if (!canRemoveUnreferencedInstruction(codeItems, jumpIndex)) continue;
    codeItems[i].instruction = { op: 'goto', arg: canonical.tailLabel };
    codeItems.splice(jumpIndex, 1);
    rewrites += 1;
  }
  return rewrites;
}

function retargetIincBackedgesToCanonicalContinues(codeItems) {
  const groups = collectIincBackedgeGroups(codeItems);
  const edits = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.iincIndex - b.iincIndex);
    const canonical = group[group.length - 1];
    const canonicalLabel = ensureFreshLabel(codeItems, canonical.iincIndex, 'LCKIINCCONT');
    for (const candidate of group.slice(0, -1)) {
      edits.push({ ...candidate, canonicalLabel });
    }
  }
  let rewrites = 0;
  for (const edit of edits.sort((a, b) => b.iincIndex - a.iincIndex)) {
    const inc = readIincInstruction(codeItems[edit.iincIndex] && codeItems[edit.iincIndex].instruction);
    const jump = codeItems[edit.gotoIndex] && codeItems[edit.gotoIndex].instruction;
    if (!inc || inc.local !== edit.local || inc.incr !== edit.incr) continue;
    if (op(jump) !== 'goto' || labelName(jump.arg) !== edit.targetLabel) continue;
    if (!canRemoveUnreferencedInstruction(codeItems, edit.gotoIndex)) continue;
    codeItems[edit.iincIndex].instruction = { op: 'goto', arg: edit.canonicalLabel };
    codeItems.splice(edit.gotoIndex, 1);
    rewrites += 1;
  }
  return rewrites;
}

function retargetForwardIincContinuesToCanonicalTail(codeItems, code) {
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_FORWARD_IINC_CONTINUE_MAX_REWRITES || 32);
  const edits = collectForwardIincContinueEdits(codeItems, code);
  let rewrites = 0;
  for (const edit of edits.sort((a, b) => b.iincIndex - a.iincIndex)) {
    if (rewrites >= maxRewrites) break;
    const inc = readIincInstruction(codeItems[edit.iincIndex] && codeItems[edit.iincIndex].instruction);
    const jump = codeItems[edit.gotoIndex] && codeItems[edit.gotoIndex].instruction;
    if (!inc || inc.local !== edit.local || inc.incr !== edit.incr) continue;
    if (op(jump) !== 'goto' || labelName(jump.arg) !== edit.headerLabel) continue;
    if (!canRemoveUnreferencedInstruction(codeItems, edit.gotoIndex)) continue;
    codeItems[edit.iincIndex].instruction = { op: 'goto', arg: edit.canonicalLabel };
    codeItems.splice(edit.gotoIndex, 1);
    rewrites += 1;
  }
  return rewrites;
}

function collectForwardIincContinueEdits(codeItems, code) {
  const groups = new Map();
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.incr === 0) continue;
    const jumpIndex = nextInstructionIndex(codeItems, i + 1);
    if (jumpIndex !== i + 1) continue;
    const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header <= jumpIndex) continue;
    const canonicalIndex = previousInstructionIndex(codeItems, header - 1);
    if (canonicalIndex <= i) continue;
    const canonicalInc = readIincInstruction(codeItems[canonicalIndex] && codeItems[canonicalIndex].instruction);
    if (!canonicalInc || canonicalInc.local !== inc.local || canonicalInc.incr !== inc.incr) continue;
    if (rangeTouchesExceptionTable(code, codeItems, i, jumpIndex + 1)) continue;
    if (!canRemoveUnreferencedInstruction(codeItems, jumpIndex)) continue;
    const canonicalLabel = ensureFreshLabel(codeItems, canonicalIndex, 'LCKFIINCCONT');
    const edit = {
      iincIndex: i,
      gotoIndex: jumpIndex,
      local: inc.local,
      incr: inc.incr,
      headerLabel: labelName(jump.arg),
      canonicalLabel,
    };
    const key = `${inc.local}:${inc.incr}:${edit.headerLabel}:${canonicalLabel}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(edit);
  }
  return [...groups.values()].filter((group) => group.length >= 2).flat();
}

function retargetDuplicateIntGuardAliases(codeItems, code) {
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_INT_GUARD_ALIAS_MAX_REWRITES || 8);
  let rewrites = 0;
  for (let i = 0; i + 7 < codeItems.length && rewrites < maxRewrites; i += 1) {
    const plan = readDuplicateIntGuardAlias(codeItems, i);
    if (!plan) continue;
    if (rangeTouchesExceptionTable(code, codeItems, i, plan.bodyIndex)) continue;
    if (!canRemoveUnreferencedInstruction(codeItems, i + 1) ||
      !canRemoveUnreferencedInstruction(codeItems, i + 2) ||
      !canRemoveUnreferencedInstruction(codeItems, i + 3)) {
      continue;
    }
    codeItems[i].instruction = { op: 'goto', arg: plan.secondGuardLabel };
    codeItems.splice(i + 1, 3);
    rewrites += 1;
  }
  return rewrites;
}

function readDuplicateIntGuardAlias(codeItems, start) {
  const firstConstant = integerConstantValue(codeItems[start] && codeItems[start].instruction);
  if (firstConstant == null) return null;
  const firstLoad = codeItems[start + 1] && codeItems[start + 1].instruction;
  const firstBranch = codeItems[start + 2] && codeItems[start + 2].instruction;
  const jump = codeItems[start + 3] && codeItems[start + 3].instruction;
  const secondConstant = integerConstantValue(codeItems[start + 4] && codeItems[start + 4].instruction);
  const secondLoad = codeItems[start + 5] && codeItems[start + 5].instruction;
  const secondBranch = codeItems[start + 6] && codeItems[start + 6].instruction;
  if (secondConstant !== firstConstant) return null;
  if (intLoadLocal(firstLoad) == null || intLoadLocal(secondLoad) !== intLoadLocal(firstLoad)) return null;
  if (!isIntCompareBranch(op(firstBranch)) || op(secondBranch) !== op(firstBranch)) return null;
  if (labelName(firstBranch.arg) !== labelName(secondBranch.arg)) return null;
  if (op(jump) !== 'goto') return null;
  const secondGuardLabel = labelName(codeItems[start + 4] && codeItems[start + 4].labelDef);
  if (!secondGuardLabel) return null;
  const bodyIndex = findLabelIndex(codeItems, jump.arg);
  if (bodyIndex !== start + 7) return null;
  return { secondGuardLabel, bodyIndex };
}

function retargetDuplicateForwardTails(codeItems, code) {
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET_MAX_REWRITES || 8);
  const maxInsns = Number(process.env.STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET_MAX_INSNS || 8);
  let rewrites = 0;
  for (let branchIndex = 0; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(branch)) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= branchIndex) continue;
    const duplicate = findPriorDuplicateForwardTail(codeItems, branchIndex + 1, target, maxInsns);
    if (!duplicate) continue;
    if (rangeTouchesExceptionTable(code, codeItems, duplicate.start, duplicate.end) ||
      rangeTouchesExceptionTable(code, codeItems, target, target + duplicate.length)) {
      continue;
    }
    branch.arg = duplicate.label;
    rewrites += 1;
  }
  return rewrites;
}

function findPriorDuplicateForwardTail(codeItems, searchStart, target, maxInsns) {
  for (let start = searchStart; start < target; start += 1) {
    const label = labelName(codeItems[start] && codeItems[start].labelDef);
    if (!label) continue;
    for (let length = 2; length <= maxInsns && start + length <= target && target + length <= codeItems.length; length += 1) {
      const last = codeItems[start + length - 1] && codeItems[start + length - 1].instruction;
      const targetLast = codeItems[target + length - 1] && codeItems[target + length - 1].instruction;
      if (op(last) !== 'goto' || op(targetLast) !== 'goto') continue;
      if (labelName(last.arg) !== labelName(targetLast.arg)) continue;
      if (!rangeContainsOp(codeItems, start, start + length, 'putstatic')) continue;
      if (!sameInstructionRange(codeItems, start, target, length)) continue;
      return { start, end: start + length, length, label };
    }
  }
  return null;
}

function rangeContainsOp(codeItems, start, end, expectedOp) {
  for (let i = start; i < end; i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) === expectedOp) return true;
  }
  return false;
}

function sameInstructionRange(codeItems, left, right, length) {
  for (let offset = 0; offset < length; offset += 1) {
    const a = codeItems[left + offset] && codeItems[left + offset].instruction;
    const b = codeItems[right + offset] && codeItems[right + offset].instruction;
    if (instructionSignature(a) !== instructionSignature(b)) return false;
  }
  return true;
}

function hasCanonicalIincContinueCandidate(codeItems) {
  for (const group of collectIincBackedgeGroups(codeItems).values()) {
    if (group.length >= 2) return true;
  }
  return false;
}

function collectIincBackedgeGroups(codeItems) {
  const groups = new Map();
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.incr === 0) continue;
    const jumpIndex = nextInstructionIndex(codeItems, i + 1);
    if (jumpIndex !== i + 1) continue;
    const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (target < 0 || target >= i) continue;
    if (!canRemoveUnreferencedInstruction(codeItems, jumpIndex)) continue;
    const targetLabel = labelName(jump.arg);
    const key = `${inc.local}:${inc.incr}:${targetLabel}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ iincIndex: i, gotoIndex: jumpIndex, local: inc.local, incr: inc.incr, targetLabel });
  }
  return groups;
}

function findCanonicalColumnContinue(codeItems) {
  for (let i = codeItems.length - 2; i >= 1; i -= 1) {
    const inc = readIincInstruction(codeItems[i] && codeItems[i].instruction);
    if (!inc || inc.local !== 21 || inc.incr !== 1) continue;
    const jumpIndex = nextInstructionIndex(codeItems, i + 1);
    if (jumpIndex !== i + 1) continue;
    const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const headerStart = findLabelIndex(codeItems, jump.arg);
    if (headerStart < 0 || headerStart >= i) continue;
    if (!isColumnHeader(codeItems, headerStart)) continue;
    const tailLabel = ensureFreshLabel(codeItems, i, 'LCKCOLUMNCONT');
    return {
      iincIndex: i,
      headerStart,
      headerLabel: labelName(jump.arg),
      tailLabel,
    };
  }
  return null;
}

function isColumnHeader(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 6);
  if (indexes.length < 6) return false;
  if (integerConstantValue(codeItems[indexes[0]] && codeItems[indexes[0]].instruction) !== -2) return false;
  if (intLoadLocal(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) !== 21) return false;
  const branch = codeItems[indexes[2]] && codeItems[indexes[2]].instruction;
  if (op(branch) !== 'if_icmple') return false;
  if (findLabelIndex(codeItems, branch.arg) <= indexes[5]) return false;
  const rowInc = readIincInstruction(codeItems[indexes[3]] && codeItems[indexes[3]].instruction);
  if (!rowInc || rowInc.local !== 12 || rowInc.incr !== 64) return false;
  const tileInc = readIincInstruction(codeItems[indexes[4]] && codeItems[indexes[4]].instruction);
  if (!tileInc || tileInc.local !== 20 || tileInc.incr !== 1) return false;
  const jump = codeItems[indexes[5]] && codeItems[indexes[5]].instruction;
  return op(jump) === 'goto' && findLabelIndex(codeItems, jump.arg) < start;
}

function hasConditionalGotoBridge(codeItems) {
  for (let i = 0; i + 1 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (!isConditionalBranch(branchOp)) continue;
    const gotoIndex = nextInstructionIndex(codeItems, i + 1);
    if (gotoIndex !== i + 1) continue;
    const jump = codeItems[gotoIndex] && codeItems[gotoIndex].instruction;
    if (op(jump) !== 'goto') continue;
    const fallthroughIndex = nextInstructionIndex(codeItems, gotoIndex + 1);
    if (fallthroughIndex >= 0 && findLabelIndex(codeItems, branch.arg) === fallthroughIndex) return true;
  }
  return false;
}

function cloneInvalidEntryTails(codeItems) {
  const tail = findInvalidEntryTail(codeItems);
  if (!tail) return 0;
  const cloneLabel = freshLabel(codeItems, 'LCKINVALID');
  const clone = cloneItems(codeItems.slice(tail.sharedStart, tail.sharedEnd));
  clone[0].labelDef = `${cloneLabel}:`;
  clone[clone.length - 1].instruction = { op: 'goto', arg: tail.continueLabel };
  for (const branchIndex of tail.invalidBranches) {
    codeItems[branchIndex].instruction.arg = cloneLabel;
  }
  codeItems.splice(tail.insertIndex, 0, ...clone);
  return 1;
}

function findInvalidEntryTail(codeItems) {
  for (let i = 1; i + 3 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpgt') continue;
    if (integerConstantValue(codeItems[i - 1] && codeItems[i - 1].instruction) !== -1) continue;
    const sharedStart = findLabelIndex(codeItems, branch.arg);
    if (!isRemoveEntryTail(codeItems, sharedStart)) continue;
    const secondBranch = findSecondInvalidEntryBranch(codeItems, i + 1, sharedStart);
    if (secondBranch < 0 || labelName(codeItems[secondBranch].instruction.arg) !== labelName(branch.arg)) continue;
    const continueIndex = findInvalidEntryTailContinueIndex(codeItems, sharedStart);
    if (continueIndex < 0) continue;
    const continueLabel = labelName(codeItems[continueIndex].instruction.arg);
    const insertIndex = findLabelIndex(codeItems, continueLabel);
    if (insertIndex < 0) continue;
    return {
      invalidBranches: [i, secondBranch],
      sharedStart,
      sharedEnd: continueIndex + 1,
      continueLabel,
      insertIndex,
    };
  }
  return null;
}

function findSecondInvalidEntryBranch(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'if_icmple' && hasInstructionInWindow(codeItems, Math.max(start, i - 4), i, (candidate) =>
      isGetField(candidate, 'tf', 'tf_r', 'I'))) {
      return i;
    }
  }
  return -1;
}

function hasInstructionInWindow(codeItems, start, end, predicate) {
  for (let i = start; i < end; i += 1) {
    if (predicate(codeItems[i] && codeItems[i].instruction)) return true;
  }
  return false;
}

function isRemoveEntryTail(codeItems, start) {
  if (start < 0) return false;
  const indexes = nextInstructionIndexes(codeItems, start, 4);
  if (indexes.length < 4) return false;
  return refLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction) === 2 &&
    integerConstantValue(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) === 1 &&
    isInvoke(codeItems[indexes[2]] && codeItems[indexes[2]].instruction, 'da', 'a', '(Z)V') &&
    op(codeItems[indexes[3]] && codeItems[indexes[3]].instruction) === 'goto';
}

function findInvalidEntryTailContinueIndex(codeItems, sharedStart) {
  const indexes = nextInstructionIndexes(codeItems, sharedStart, 4);
  return indexes.length >= 4 ? indexes[3] : -1;
}

function canRemoveUnreferencedInstruction(codeItems, index) {
  const label = labelName(codeItems[index] && codeItems[index].labelDef);
  return !label || (collectLabelReferenceCounts(codeItems).get(label) || 0) === 0;
}

function findEventActionTail(codeItems) {
  for (let i = 0; i < codeItems.length; i += 1) {
    if (readEventActionTail(codeItems, i)) return i;
  }
  return null;
}

function readEventActionTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 20);
  if (indexes.length < 20) return null;
  if (!isGetStatic(codeItems[indexes[0]] && codeItems[indexes[0]].instruction, 'kc', 'kc_c', 'I')) return null;
  if (integerConstantValue(codeItems[indexes[1]] && codeItems[indexes[1]].instruction) !== 1) return null;
  if (op(codeItems[indexes[2]] && codeItems[indexes[2]].instruction) !== 'iadd') return null;
  if (!isPutStatic(codeItems[indexes[3]] && codeItems[indexes[3]].instruction, 'kc', 'kc_c', 'I')) return null;
  if (intLoadLocal(codeItems[indexes[4]] && codeItems[indexes[4]].instruction) !== 2) return null;
  if (integerConstantValue(codeItems[indexes[5]] && codeItems[indexes[5]].instruction) !== -9410) return null;
  if (op(codeItems[indexes[6]] && codeItems[indexes[6]].instruction) !== 'ixor') return null;
  if (!isInvoke(codeItems[indexes[7]] && codeItems[indexes[7]].instruction, 'pg', 'a', '(I)V')) return null;
  if (op(codeItems[indexes[8]] && codeItems[indexes[8]].instruction) !== 'new' || codeItems[indexes[8]].instruction.arg !== 'gh') return null;
  if (op(codeItems[indexes[9]] && codeItems[indexes[9]].instruction) !== 'dup') return null;
  if (op(codeItems[indexes[10]] && codeItems[indexes[10]].instruction) !== 'aload_0') return null;
  const ownerDescriptor = fieldDescriptor(codeItems[indexes[11]] && codeItems[indexes[11]].instruction);
  if (op(codeItems[indexes[11]] && codeItems[indexes[11]].instruction) !== 'getfield' ||
    typeof ownerDescriptor !== 'string' || !/^L[^;]+;$/.test(ownerDescriptor)) return null;
  if (intLoadLocal(codeItems[indexes[12]] && codeItems[indexes[12]].instruction) !== 3) return null;
  if (!isInvoke(codeItems[indexes[13]] && codeItems[indexes[13]].instruction, 'gh', '<init>', `(${ownerDescriptor}Z)V`)) return null;
  if (!isPutStatic(codeItems[indexes[14]] && codeItems[indexes[14]].instruction, 'el', 'el_o', 'Lgh;')) return null;
  if (integerConstantValue(codeItems[indexes[15]] && codeItems[indexes[15]].instruction) !== -39) return null;
  if (!isInvoke(codeItems[indexes[16]] && codeItems[indexes[16]].instruction, 'le', 'a', '(B)V')) return null;
  if (integerConstantValue(codeItems[indexes[17]] && codeItems[indexes[17]].instruction) !== -1) return null;
  if (!isPutStatic(codeItems[indexes[18]] && codeItems[indexes[18]].instruction, 'ai', 'ai_p', 'I')) return null;
  const jump = codeItems[indexes[19]] && codeItems[indexes[19]].instruction;
  if (op(jump) !== 'goto') return null;
  const exitLabel = labelName(jump.arg);
  if (!exitLabel || findLabelIndex(codeItems, exitLabel) <= indexes[19]) return null;
  return { end: indexes[19], exitLabel };
}

function findEiQEqualsBranch(codeItems, start, end, value) {
  for (let i = start; i + 2 < end; i += 1) {
    if (!isBipush(codeItems[i] && codeItems[i].instruction, value) && !(value >= -1 && value <= 5 && op(codeItems[i] && codeItems[i].instruction) === `iconst_${value}`)) continue;
    if (!isGetStatic(codeItems[i + 1] && codeItems[i + 1].instruction, 'ei', 'ei_q', 'I')) continue;
    const branch = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (op(branch) === 'if_icmpeq') return i + 2;
  }
  return -1;
}

function rangeContainsInvokeShape(codeItems, start, end, owner, name, descriptor) {
  for (let i = Math.max(0, start); i < Math.min(codeItems.length, end); i += 1) {
    if (isInvoke(codeItems[i] && codeItems[i].instruction, owner, name, descriptor)) return true;
  }
  return false;
}

function cloneRasterRowScanContinueHeaders(codeItems, code) {
  let rewrites = 0;
  const maxHeaderSpan = Number(process.env.STRUCTURED_GOTO_RASTER_ROW_SCAN_HEADER_MAX_SPAN || 240);
  for (let i = 0; i < codeItems.length && rewrites < 4; i += 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    const header = findLabelIndex(codeItems, jump.arg);
    if (header < 0 || header >= i) continue;

    const incrementIndex = previousInstructionIndex(codeItems, i - 1);
    const increment = readIincInstruction(codeItems[incrementIndex] && codeItems[incrementIndex].instruction);
    if (!increment || increment.incr !== 1) continue;
    const sourceBranchIndex = previousInstructionIndex(codeItems, incrementIndex - 1);
    const sourceBranch = codeItems[sourceBranchIndex] && codeItems[sourceBranchIndex].instruction;
    if (!isIntCompareBranch(op(sourceBranch))) continue;
    const sourceBody = findLabelIndex(codeItems, sourceBranch.arg);
    if (sourceBody !== i + 1) continue;
    if (sourceBranchIndex - header > maxHeaderSpan) continue;

    const shape = readRasterRowScanHeaderShape(codeItems, header, sourceBranchIndex, increment.local);
    if (!shape) continue;
    const changed = cloneGotoRangeAtWithFallthroughGoto(
      codeItems,
      code,
      i,
      header,
      shape.bodyStart,
      shape.bodyLabel,
      'LCKROW',
    );
    if (changed) {
      rewrites += changed;
      i += shape.bodyStart - header;
    }
  }
  return rewrites;
}

function readRasterRowScanHeaderShape(codeItems, header, before, rowLocal) {
  const first = codeItems[header] && codeItems[header].instruction;
  const second = codeItems[header + 1] && codeItems[header + 1].instruction;
  const exit = codeItems[header + 2] && codeItems[header + 2].instruction;
  if (intLoadLocal(first) !== rowLocal) return null;
  if (intLoadLocal(second) == null) return null;
  if (!isIntCompareBranch(op(exit))) return null;
  const exitTarget = findLabelIndex(codeItems, exit.arg);
  if (exitTarget <= before) return null;

  let bodyStart = -1;
  let bodyLabel = null;
  let guardCount = 0;
  for (let i = header + 3; i < before; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const incrementIndex = nextInstructionIndex(codeItems, i + 1);
    if (incrementIndex !== i + 1) continue;
    const increment = readIincInstruction(codeItems[incrementIndex] && codeItems[incrementIndex].instruction);
    if (!increment || increment.local !== rowLocal || increment.incr !== 1) continue;
    const jumpIndex = nextInstructionIndex(codeItems, incrementIndex + 1);
    if (jumpIndex !== incrementIndex + 1) continue;
    const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
    if (op(jump) !== 'goto' || findLabelIndex(codeItems, jump.arg) !== header) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= jumpIndex || target > before) continue;
    bodyStart = target;
    bodyLabel = labelName(branch.arg);
    guardCount += 1;
    i = jumpIndex;
  }
  if (guardCount < 2 || bodyStart < 0 || !bodyLabel) return null;
  if (!rangeContainsInvokeShape(codeItems, bodyStart, before, 'vn', 'a', '(II)I')) return null;
  return { bodyStart, bodyLabel };
}

function cloneStringBase38SplitDecrementTails(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 16; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const compare = readMinusOneCompareConstant(codeItems, i);
    if (!compare || compare.constant !== -11) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart < 0 || tailStart >= i) continue;
    const tail = readSingleIincBackedgeTail(codeItems, tailStart, compare.local, -1);
    const resetTail = tail || readBase38ResetBackedgeTail(codeItems, tailStart, compare.local);
    if (!resetTail) continue;
    if (!hasStringCharAtBefore(codeItems, resetTail.header, i, compare.local)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tailStart, resetTail.end)) continue;
    const changed = cloneBackwardConditionalTailAtBranch(codeItems, i, tailStart, resetTail.end, 'LCKB38');
    if (changed) {
      rewrites += changed;
      i += resetTail.end - tailStart;
    }
  }
  return rewrites;
}

function cloneTargetedBase38DecrementTails(codeItems) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 8; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const compare = readMinusOneCompareConstant(codeItems, i);
    if (!compare || compare.local !== 8 || compare.constant !== -11) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart < 0 || tailStart >= i) continue;
    const tail = readSingleIincBackedgeTail(codeItems, tailStart, compare.local, -1);
    const resetTail = tail || readBase38ResetBackedgeTail(codeItems, tailStart, compare.local);
    if (!resetTail) continue;
    if (!hasStringCharAtBefore(codeItems, resetTail.header, i, compare.local)) continue;
    const changed = cloneBackwardConditionalTailAtBranch(codeItems, i, tailStart, resetTail.end, 'LCKSUMB38');
    if (changed) {
      rewrites += changed;
      i += resetTail.end - tailStart;
    }
  }
  return rewrites;
}

function hasTargetedBase38DecrementTail(codeItems) {
  for (let i = 0; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const compare = readMinusOneCompareConstant(codeItems, i);
    if (!compare || compare.local !== 8 || compare.constant !== -11) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart < 0 || tailStart >= i) continue;
    const tail = readSingleIincBackedgeTail(codeItems, tailStart, compare.local, -1) ||
      readBase38ResetBackedgeTail(codeItems, tailStart, compare.local);
    if (tail && hasStringCharAtBefore(codeItems, tail.header, i, compare.local)) return true;
  }
  return false;
}

function readBase38ResetBackedgeTail(codeItems, start, indexLocal) {
  const indexes = nextInstructionIndexes(codeItems, start, 6);
  if (indexes.length < 6) return null;
  if (!isLongLoad(codeItems[indexes[0]] && codeItems[indexes[0]].instruction)) return null;
  if (!isLongStore(codeItems[indexes[1]] && codeItems[indexes[1]].instruction)) return null;
  if (op(codeItems[indexes[2]] && codeItems[indexes[2]].instruction) !== 'lconst_0') return null;
  if (!isLongStore(codeItems[indexes[3]] && codeItems[indexes[3]].instruction)) return null;
  const inc = readIincInstruction(codeItems[indexes[4]] && codeItems[indexes[4]].instruction);
  if (!inc || inc.local !== indexLocal || inc.incr !== -1) return null;
  const jump = codeItems[indexes[5]] && codeItems[indexes[5]].instruction;
  if (op(jump) !== 'goto') return null;
  const header = findLabelIndex(codeItems, jump.arg);
  if (header < 0 || header >= start) return null;
  return { end: indexes[5] + 1, header };
}

function cloneStringBase38ForwardSplitDecrementTails(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 8; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const compare = readMinusOneCompareConstant(codeItems, i);
    if (!compare || compare.constant !== -11) continue;
    const splitStart = findLabelIndex(codeItems, branch.arg);
    if (splitStart <= i || splitStart - i > 16) continue;
    const gotoIndex = readBase38ForwardSplitGotoIndex(codeItems, splitStart);
    if (gotoIndex < 0) continue;
    const tailStart = findLabelIndex(codeItems, codeItems[gotoIndex].instruction.arg);
    if (tailStart < 0 || tailStart >= i) continue;
    const tail = readSingleIincBackedgeTail(codeItems, tailStart, compare.local, -1);
    if (!tail) continue;
    if (!hasStringCharAtBefore(codeItems, tail.header, i, compare.local)) continue;
    const changed = cloneGotoRangeAt(codeItems, code, gotoIndex, tailStart, tail.end, 'LCKB38FG');
    if (changed) rewrites += changed;
  }
  return rewrites;
}

function readBase38ForwardSplitGotoIndex(codeItems, splitStart) {
  const indexes = nextInstructionIndexes(codeItems, splitStart, 5);
  if (indexes.length < 5) return -1;
  if (!isLongLoad(codeItems[indexes[0]] && codeItems[indexes[0]].instruction)) return -1;
  if (!isLongStore(codeItems[indexes[1]] && codeItems[indexes[1]].instruction)) return -1;
  if (op(codeItems[indexes[2]] && codeItems[indexes[2]].instruction) !== 'lconst_0') return -1;
  if (!isLongStore(codeItems[indexes[3]] && codeItems[indexes[3]].instruction)) return -1;
  if (op(codeItems[indexes[4]] && codeItems[indexes[4]].instruction) !== 'goto') return -1;
  return indexes[4];
}

function cloneStringBase38ForwardCharBodies(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 8; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1) continue;
    const shape = readStringBase38CharBody(codeItems, target);
    if (!shape) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, shape.end)) continue;
    const exitLabel = shape.exitLabel || ensureFreshLabel(codeItems, shape.end, 'LCKB38B_EXIT');
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      shape.end,
      exitLabel,
      'LCKB38B',
    );
    if (changed) {
      rewrites += changed;
      i += shape.end - target;
    }
  }
  return rewrites;
}

function cloneDisableOptionContinueTails(codeItems, code) {
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 0 && rewrites < 12; i -= 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isConditionalBranch(op(branch))) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (tailStart < 0) continue;
    const tail = readDisableOptionContinueTail(codeItems, tailStart);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, tailStart, tail.end)) continue;
    const changed = cloneBackwardConditionalTailAtBranch(codeItems, i, tailStart, tail.end, 'LCKDIS');
    if (changed) rewrites += changed;
  }
  return rewrites;
}

function cloneByteArrayClearSharedFieldCopyTails(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_BYTE_ARRAY_CLEAR_FIELD_COPY_MAX_REWRITES || 4);
  for (let i = 0; i < codeItems.length && rewrites < maxRewrites; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target <= i + 1 || target - i > 260) continue;
    if (!isByteArrayClearLoopExit(codeItems, i)) continue;
    const tail = readSharedFieldCopyTail(codeItems, target);
    if (!tail) continue;
    if (rangeTouchesExceptionTable(code, codeItems, target, tail.end)) continue;
    const exitLabel = ensureFreshLabel(codeItems, tail.end, `LCKBASE38DEC_EXIT_${rewrites}`);
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      target,
      tail.end,
      exitLabel,
      'LCKBASE38DEC',
    );
    if (changed) {
      rewrites += changed;
      i += tail.end - target;
    }
  }
  return rewrites;
}

function isByteArrayClearLoopExit(codeItems, branchIndex) {
  const previous = previousInstructionIndex(codeItems, branchIndex - 1);
  const indexLocal = intLoadLocal(codeItems[previous] && codeItems[previous].instruction);
  if (indexLocal == null) return false;
  const loopStart = Math.max(0, branchIndex - 16);
  let sawArrayLength = false;
  let sawClearStore = false;
  let sawBackedge = false;
  for (let i = loopStart; i < branchIndex + 24 && i < codeItems.length; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'arraylength') sawArrayLength = true;
    if (op(insn) === 'bastore' &&
      intLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction) === indexLocal &&
      integerConstantValue(codeItems[i - 1] && codeItems[i - 1].instruction) === 0) {
      sawClearStore = true;
    }
    if (op(insn) === 'goto') {
      const target = findLabelIndex(codeItems, insn.arg);
      if (target >= loopStart && target < branchIndex) sawBackedge = true;
    }
  }
  return sawArrayLength && sawClearStore && sawBackedge;
}

function findNearestPreviousLabel(codeItems, before) {
  for (let i = before; i >= 0; i -= 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) return label;
  }
  return null;
}

function readSharedFieldCopyTail(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 16);
  if (indexes.length < 10) return null;
  let cursor = 0;
  const sourceStatic = codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction;
  if (op(sourceStatic) !== 'getstatic') return null;
  cursor += 1;
  const nullBranch = codeItems[indexes[cursor]] && codeItems[indexes[cursor]].instruction;
  const nullBranchOp = op(nullBranch);
  if (nullBranchOp !== 'ifnonnull' &&
    nullBranchOp !== 'ifnull' &&
    nullBranchOp !== 'if_acmpne' &&
    nullBranchOp !== 'if_acmpeq') return null;
  const copyStart = nullBranchOp === 'ifnonnull' || nullBranchOp === 'if_acmpne'
    ? findLabelIndex(codeItems, nullBranch.arg)
    : indexes[cursor] + 1;
  if (copyStart < 0) return null;
  const copyFirst = nextInstructionIndex(codeItems, copyStart);
  if (copyFirst !== indexes[cursor + 2] && copyFirst !== indexes[cursor + 1]) return null;
  if ((nullBranchOp === 'ifnonnull' || nullBranchOp === 'if_acmpne') &&
    op(codeItems[indexes[cursor + 1]] && codeItems[indexes[cursor + 1]].instruction) !== 'goto') return null;
  const copy = nextInstructionIndexes(codeItems, copyFirst, 9);
  if (copy.length < 9) return null;
  if (op(codeItems[copy[0]] && codeItems[copy[0]].instruction) !== 'getstatic') return null;
  if (op(codeItems[copy[1]] && codeItems[copy[1]].instruction) !== 'getstatic') return null;
  if (!isScaledInstanceFieldIndex(codeItems, copy[2], copy[5])) return null;
  if (op(codeItems[copy[5]] && codeItems[copy[5]].instruction) !== 'imul') return null;
  if (op(codeItems[copy[6]] && codeItems[copy[6]].instruction) !== 'aaload') return null;
  if (op(codeItems[copy[7]] && codeItems[copy[7]].instruction) !== 'getfield') return null;
  if (op(codeItems[copy[8]] && codeItems[copy[8]].instruction) !== 'putfield') return null;
  return { end: copy[8] + 1 };
}

function isScaledInstanceFieldIndex(codeItems, start, end) {
  const firstConstant = integerConstantValue(codeItems[start] && codeItems[start].instruction) != null;
  const firstReceiver = refLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction) != null;
  const secondReceiver = refLoadLocal(codeItems[start] && codeItems[start].instruction) != null;
  const secondConstant = integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction) != null;
  if (firstConstant && firstReceiver &&
    op(codeItems[start + 2] && codeItems[start + 2].instruction) === 'getfield' &&
    start + 3 === end) {
    return true;
  }
  if (secondReceiver &&
    op(codeItems[start + 1] && codeItems[start + 1].instruction) === 'getfield' &&
    secondConstant &&
    start + 3 === end) {
    return true;
  }
  return false;
}

function readDisableOptionContinueTail(codeItems, start) {
  const objectLocal = refLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (objectLocal == null) return null;
  if (op(codeItems[start + 1] && codeItems[start + 1].instruction) !== 'iconst_0') return null;
  const put = codeItems[start + 2] && codeItems[start + 2].instruction;
  if (op(put) !== 'putfield' || !Array.isArray(put.arg) || put.arg[0] !== 'Field') return null;
  const fieldNameAndDesc = put.arg[2];
  if (!Array.isArray(fieldNameAndDesc) || fieldNameAndDesc[1] !== 'Z') return null;
  const increment = readIincInstruction(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (!increment || increment.incr !== 1) return null;
  const jump = codeItems[start + 4] && codeItems[start + 4].instruction;
  if (op(jump) !== 'goto') return null;
  const header = findLabelIndex(codeItems, jump.arg);
  if (header < 0 || header >= start) return null;
  if (intLoadLocal(codeItems[header] && codeItems[header].instruction) !== increment.local) return null;
  const exitBranch = findNextConditionalBranch(codeItems, header + 1, header + 8);
  if (exitBranch < 0 || !isIntCompareBranch(op(codeItems[exitBranch] && codeItems[exitBranch].instruction))) return null;
  const label = labelName(codeItems[start] && codeItems[start].labelDef);
  if (!label) return null;
  return { label, header, end: start + 5, objectLocal, indexLocal: increment.local };
}

function retargetDuplicateHalveSetupTails(codeItems, code) {
  let rewrites = 0;
  for (let i = 1; i < codeItems.length && rewrites < 4; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    const branchOp = op(branch);
    if (branchOp !== 'ifeq' && branchOp !== 'ifne') continue;
    const loadIndex = previousInstructionIndex(codeItems, i - 1);
    if (intLoadLocal(codeItems[loadIndex] && codeItems[loadIndex].instruction) == null) continue;
    const commonStart = nextInstructionIndex(codeItems, i + 1);
    const alternateStart = findLabelIndex(codeItems, branch.arg);
    if (commonStart !== i + 1 || alternateStart <= commonStart || alternateStart - commonStart > 320) continue;
    const commonShape = readHalveSetupTail(codeItems, commonStart);
    if (!commonShape) continue;
    const alternateTailStart = findDuplicateHalveSetupTailStart(codeItems, alternateStart, commonShape, alternateStart + 180);
    if (alternateTailStart < 0) continue;
    if (!hasShortFieldSetPrefixBeforeDuplicateTail(codeItems, alternateStart, alternateTailStart)) continue;
    if (rangeTouchesExceptionTable(code, codeItems, alternateTailStart, alternateTailStart + commonShape.length)) continue;
    const commonLabel = ensureFreshLabel(codeItems, commonStart, 'LCKHALVE_COMMON');
    const sourceMeta = cloneItemMetadata(codeItems[alternateTailStart]);
    codeItems[alternateTailStart] = { ...sourceMeta, instruction: { op: 'goto', arg: commonLabel } };
    rewrites += 1;
  }
  return rewrites;
}

function retargetDuplicateDummyGuardBodies(codeItems, code) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.STRUCTURED_GOTO_DUPLICATE_DUMMY_GUARD_BODY_MAX_REWRITES || 4);
  for (let branchIndex = 1; branchIndex < codeItems.length && rewrites < maxRewrites; branchIndex += 1) {
    const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
    if (!isConditionalBranch(op(branch))) continue;
    const duplicateStart = findLabelIndex(codeItems, branch.arg);
    const sideEffectStart = nextInstructionIndex(codeItems, branchIndex + 1);
    if (duplicateStart <= sideEffectStart || duplicateStart - sideEffectStart < 96) continue;
    const bodyStart = findDuplicateBodyStartAfterShortSideEffect(codeItems, sideEffectStart, duplicateStart);
    if (bodyStart < 0) continue;
    if (rangeTouchesExceptionTable(code, codeItems, branchIndex, duplicateStart + 1)) continue;
    branch.arg = ensureFreshLabel(codeItems, bodyStart, 'LCKDUMMY_BODY');
    rewrites += 1;
  }
  return rewrites;
}

function findDuplicateBodyStartAfterShortSideEffect(codeItems, sideEffectStart, duplicateStart) {
  let sawInvoke = false;
  for (let bodyStart = nextInstructionIndex(codeItems, sideEffectStart + 1);
    bodyStart > sideEffectStart && bodyStart < Math.min(duplicateStart, sideEffectStart + 8);
    bodyStart = nextInstructionIndex(codeItems, bodyStart + 1)) {
    const before = nextInstructionIndexes(codeItems, sideEffectStart, bodyStart - sideEffectStart);
    if (before.length === 0 || before.length > 6) continue;
    if (before.some((index) => {
      const cur = op(codeItems[index] && codeItems[index].instruction);
      if (isInvokeInstruction(codeItems[index] && codeItems[index].instruction)) sawInvoke = true;
      return cur === 'goto' || isConditionalBranch(cur) || isReturnOp(cur) || cur === 'athrow';
    })) continue;
    if (!sawInvoke) continue;
    if (sameInstructionPrefixIgnoringBranches(codeItems, bodyStart, duplicateStart, 32)) return bodyStart;
  }
  return -1;
}

function sameInstructionPrefixIgnoringBranches(codeItems, left, right, length) {
  for (let offset = 0; offset < length; offset += 1) {
    const leftInsn = codeItems[left + offset] && codeItems[left + offset].instruction;
    const rightInsn = codeItems[right + offset] && codeItems[right + offset].instruction;
    if (!leftInsn || !rightInsn) return false;
    if (isBranchInstruction(leftInsn) || isBranchInstruction(rightInsn)) {
      if (op(leftInsn) !== op(rightInsn)) return false;
      continue;
    }
    if (!sameInstructionOperand(leftInsn, rightInsn)) return false;
  }
  return true;
}

function findDuplicateHalveSetupTailStart(codeItems, start, shape, end) {
  for (let i = start + 1; i < Math.min(codeItems.length, end); i += 1) {
    const duplicate = readHalveSetupTail(codeItems, i);
    if (!duplicate) continue;
    if (sameHalveSetupShape(shape, duplicate)) return i;
  }
  return -1;
}

function readHalveSetupTail(codeItems, start) {
  const first = readHalveFieldAssignment(codeItems, start);
  if (!first) return null;
  const second = readHalveFieldAssignment(codeItems, first.end);
  if (!second) return null;
  return {
    length: second.end - start,
    assignments: [
      { source: first.sourceField, target: first.targetField },
      { source: second.sourceField, target: second.targetField },
    ],
  };
}

function readHalveFieldAssignment(codeItems, start) {
  const indexes = nextInstructionIndexes(codeItems, start, 6);
  if (indexes.length < 6) return null;
  const receiverA = refLoadLocal(codeItems[indexes[0]] && codeItems[indexes[0]].instruction);
  const receiverB = refLoadLocal(codeItems[indexes[1]] && codeItems[indexes[1]].instruction);
  if (receiverA == null || receiverA !== receiverB) return null;
  const get = codeItems[indexes[2]] && codeItems[indexes[2]].instruction;
  if (!isIntFieldRead(get)) return null;
  if (integerConstantValue(codeItems[indexes[3]] && codeItems[indexes[3]].instruction) !== 2) return null;
  if (op(codeItems[indexes[4]] && codeItems[indexes[4]].instruction) !== 'idiv') return null;
  const put = codeItems[indexes[5]] && codeItems[indexes[5]].instruction;
  if (!isPutFieldDescriptor(put, 'I')) return null;
  return {
    end: indexes[5] + 1,
    sourceField: stableInstructionArg(get),
    targetField: stableInstructionArg(put),
  };
}

function sameHalveSetupShape(left, right) {
  if (!left || !right || left.assignments.length !== right.assignments.length) return false;
  for (let i = 0; i < left.assignments.length; i += 1) {
    if (left.assignments[i].source !== right.assignments[i].source) return false;
    if (left.assignments[i].target !== right.assignments[i].target) return false;
  }
  return true;
}

function hasShortFieldSetPrefixBeforeDuplicateTail(codeItems, start, end) {
  if (end <= start || end - start > 96) return false;
  let putIntFields = 0;
  let branchCount = 0;
  let gotoToEnd = 0;
  const endLabel = labelName(codeItems[end] && codeItems[end].labelDef);
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (isPutFieldDescriptor(insn, 'I')) putIntFields += 1;
    if (isConditionalBranch(cur)) branchCount += 1;
    if (cur === 'goto' && endLabel && labelName(insn.arg) === endLabel) gotoToEnd += 1;
  }
  return putIntFields >= 2 && branchCount >= 1 && gotoToEnd >= 1;
}

function findNextConditionalBranch(codeItems, start, end) {
  for (let i = start; i < Math.min(codeItems.length, end); i += 1) {
    if (isConditionalBranch(op(codeItems[i] && codeItems[i].instruction))) return i;
  }
  return -1;
}

function readStringBase38CharBody(codeItems, start) {
  const stringLocal = refLoadLocal(codeItems[start] && codeItems[start].instruction);
  const indexLocal = intLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction);
  if (stringLocal == null || indexLocal == null) return null;
  if (!isInvoke(codeItems[start + 2] && codeItems[start + 2].instruction, 'java/lang/String', 'charAt', '(I)C')) return null;
  const charLocal = intStoreLocal(codeItems[start + 3] && codeItems[start + 3].instruction);
  if (charLocal == null) return null;

  for (let i = start + 4; i < Math.min(codeItems.length, start + 96); i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (!isIntCompareBranch(op(branch))) continue;
    const compare = readMinusOneCompareConstant(codeItems, i);
    if (!compare || compare.local !== indexLocal || compare.constant !== -11) continue;
    const end = findBase38FinalWriteBlock(codeItems, i + 1, start + 260);
    if (end < 0) continue;
    const exitLabel = labelName(codeItems[end] && codeItems[end].labelDef);
    return { end, exitLabel };
  }
  return null;
}

function findBase38FinalWriteBlock(codeItems, start, end) {
  for (let i = start; i + 3 < Math.min(codeItems.length, end); i += 1) {
    if (op(codeItems[i] && codeItems[i].instruction) !== 'aload_0') continue;
    if (!isLongLoad(codeItems[i + 1] && codeItems[i + 1].instruction)) continue;
    if (isBase38AccumulatorWrite(codeItems, i, 12, '(JB)V') &&
      findSecondBase38AccumulatorWrite(codeItems, i + 4, end, 12, '(JB)V') >= 0) return i;
    if (!isBipush(codeItems[i + 2] && codeItems[i + 2].instruction, 116)) continue;
    if (isInvoke(codeItems[i + 3] && codeItems[i + 3].instruction, 'fs', 'a', '(JI)V')) return i;
  }
  return -1;
}

function findSecondBase38AccumulatorWrite(codeItems, start, end, marker, descriptor) {
  for (let i = start; i + 3 < Math.min(codeItems.length, end); i += 1) {
    if (isBase38AccumulatorWrite(codeItems, i, marker, descriptor)) return i;
  }
  return -1;
}

function isBase38AccumulatorWrite(codeItems, start, marker, descriptor) {
  if (op(codeItems[start] && codeItems[start].instruction) !== 'aload_0') return false;
  if (!isLongLoad(codeItems[start + 1] && codeItems[start + 1].instruction)) return false;
  if (integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction) !== marker) return false;
  const actualDescriptor = methodDescriptor(codeItems[start + 3] && codeItems[start + 3].instruction);
  return isInvokeInstruction(codeItems[start + 3] && codeItems[start + 3].instruction) &&
    actualDescriptor === descriptor;
}

function readMinusOneCompareConstant(codeItems, branchIndex) {
  if (branchIndex < 4) return null;
  const constantIndex = previousInstructionIndex(codeItems, branchIndex - 1);
  const xorIndex = previousInstructionIndex(codeItems, constantIndex - 1);
  const minusOneIndex = previousInstructionIndex(codeItems, xorIndex - 1);
  const loadIndex = previousInstructionIndex(codeItems, minusOneIndex - 1);
  const load = codeItems[loadIndex] && codeItems[loadIndex].instruction;
  if (op(codeItems[minusOneIndex] && codeItems[minusOneIndex].instruction) !== 'iconst_m1') return null;
  if (op(codeItems[xorIndex] && codeItems[xorIndex].instruction) !== 'ixor') return null;
  const constant = integerConstantValue(codeItems[constantIndex] && codeItems[constantIndex].instruction);
  const local = intLoadLocal(load);
  if (local == null || constant == null) return null;
  return { local, constant };
}

function readSingleIincBackedgeTail(codeItems, start, local, incr) {
  const inc = readIincInstruction(codeItems[start] && codeItems[start].instruction);
  if (!inc || inc.local !== local || inc.incr !== incr) return null;
  const jumpIndex = nextInstructionIndex(codeItems, start + 1);
  if (jumpIndex !== start + 1) return null;
  const jump = codeItems[jumpIndex] && codeItems[jumpIndex].instruction;
  if (op(jump) !== 'goto') return null;
  const header = findLabelIndex(codeItems, jump.arg);
  if (header < 0 || header >= start) return null;
  return { end: jumpIndex + 1, header };
}

function hasStringCharAtBefore(codeItems, start, end, indexLocal) {
  for (let i = Math.max(0, start); i + 2 < end; i += 1) {
    if (refLoadLocal(codeItems[i] && codeItems[i].instruction) == null) continue;
    if (intLoadLocal(codeItems[i + 1] && codeItems[i + 1].instruction) !== indexLocal) continue;
    if (isInvoke(codeItems[i + 2] && codeItems[i + 2].instruction, 'java/lang/String', 'charAt', '(I)C')) return true;
  }
  return false;
}

function cloneBackwardConditionalTailAtBranch(codeItems, branchIndex, start, end, prefix) {
  const branch = codeItems[branchIndex] && codeItems[branchIndex].instruction;
  const cur = op(branch);
  if (!isConditionalBranch(cur)) return 0;
  const fallthrough = nextInstructionIndex(codeItems, branchIndex + 1);
  if (fallthrough !== branchIndex + 1) return 0;
  const cloneId = structuredCloneId;
  structuredCloneId += 1;
  const fallthroughLabel = ensureFreshLabel(codeItems, fallthrough, `${prefix}F_${cloneId}`);
  const clone = cloneItems(codeItems.slice(start, end));
  renameInternalLabels(clone, `${prefix}_${cloneId}_`);
  branch.op = invertConditionalBranch(cur);
  branch.arg = fallthroughLabel;
  codeItems.splice(branchIndex + 1, 0, ...clone);
  return 1;
}

function nextInstructionIndexes(codeItems, start, count) {
  const out = [];
  for (let i = start; i < codeItems.length && out.length < count; i += 1) {
    if (codeItems[i] && codeItems[i].instruction) out.push(i);
  }
  return out;
}

function zeroStoreLocalAt(codeItems, constIndex, storeIndex) {
  if (op(codeItems[constIndex] && codeItems[constIndex].instruction) !== 'iconst_0') return null;
  return intStoreLocal(codeItems[storeIndex] && codeItems[storeIndex].instruction);
}

function isCharSequenceLengthInvoke(insn) {
  if (op(insn) !== 'invokeinterface') return false;
  const arg = insn && insn.arg;
  return Array.isArray(arg) &&
    arg[1] === 'java/lang/CharSequence' &&
    Array.isArray(arg[2]) &&
    arg[2][0] === 'length' &&
    arg[2][1] === '()I';
}

function isCharSequenceCharAtInvoke(insn) {
  if (op(insn) !== 'invokeinterface') return false;
  const arg = insn && insn.arg;
  return Array.isArray(arg) &&
    arg[1] === 'java/lang/CharSequence' &&
    Array.isArray(arg[2]) &&
    arg[2][0] === 'charAt' &&
    arg[2][1] === '(I)C';
}

function isCharSequenceTypeArg(arg) {
  return arg === 'java/lang/CharSequence' || (Array.isArray(arg) && arg.includes('java/lang/CharSequence'));
}

function findForwardGotoBefore(codeItems, start, end) {
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (op(insn) === 'goto' && findLabelIndex(codeItems, insn.arg) > end) return i;
  }
  return -1;
}

function readSharedIntPairContinuationTail(codeItems, start, refCounts) {
  let i = start;
  const first = readIntReturningInstanceCallStore(codeItems, i);
  if (!first) return null;
  i = first.end;
  const second = readIntReturningInstanceCallStore(codeItems, i);
  if (!second) return null;
  if (first.storeLocal === second.storeLocal) return null;
  if (hasReferencedLabelsInside(codeItems, start + 1, second.end, refCounts)) return null;
  const next = nextInstructionIndex(codeItems, second.end);
  if (next < 0) return null;
  if (isConditionalBranch(op(codeItems[next] && codeItems[next].instruction))) return null;
  return { end: next, storeLocals: [first.storeLocal, second.storeLocal] };
}

function readIntReturningInstanceCallStore(codeItems, start) {
  const receiverLocal = refLoadLocal(codeItems[start] && codeItems[start].instruction);
  if (receiverLocal == null) return null;
  let sawArg = false;
  let invokeIndex = -1;
  for (let i = start + 1; i < Math.min(codeItems.length, start + 8); i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    const cur = op(insn);
    if (!cur) continue;
    if (cur === 'goto' || isConditionalBranch(cur) || isReturnOp(cur) || cur === 'athrow') return null;
    if (isInvokeInstruction(insn)) {
      if (!invokeReturnsInt(insn)) return null;
      invokeIndex = i;
      break;
    }
    if (!isSimpleIntCallArgumentInstruction(insn)) return null;
    sawArg = true;
  }
  if (invokeIndex < 0 || !sawArg) return null;
  const storeIndex = nextInstructionIndex(codeItems, invokeIndex + 1);
  if (storeIndex !== invokeIndex + 1) return null;
  const storeLocal = intStoreLocal(codeItems[storeIndex] && codeItems[storeIndex].instruction);
  if (storeLocal == null) return null;
  return { end: storeIndex + 1, receiverLocal, storeLocal };
}

function invokeReturnsInt(insn) {
  const arg = insn && insn.arg;
  if (!Array.isArray(arg) || !Array.isArray(arg[2])) return false;
  return typeof arg[2][1] === 'string' && arg[2][1].endsWith(')I');
}

function isSimpleIntCallArgumentInstruction(insn) {
  const cur = op(insn);
  return intLoadLocal(insn) != null ||
    isIntegerConstant(insn) ||
    cur === 'iadd' || cur === 'isub' || cur === 'ixor' || cur === 'iand' || cur === 'ior' ||
    cur === 'ineg';
}

function hasRecentMinusOneInitializers(codeItems, before, locals) {
  const needed = new Set(locals);
  const start = Math.max(0, before - 64);
  for (let i = before - 1; i > start && needed.size > 0; i -= 1) {
    const storeLocal = intStoreLocal(codeItems[i] && codeItems[i].instruction);
    if (!needed.has(storeLocal)) continue;
    const prev = previousInstructionIndex(codeItems, i - 1);
    if (prev >= start && op(codeItems[prev] && codeItems[prev].instruction) === 'iconst_m1') {
      needed.delete(storeLocal);
    }
  }
  return needed.size === 0;
}

function hasSystemOutSideEffect(codeItems) {
  for (const item of codeItems) {
    const insn = item && item.instruction;
    if (op(insn) === 'getstatic') {
      const arg = insn && insn.arg;
      if (Array.isArray(arg) && arg[1] === 'java/lang/System' && Array.isArray(arg[2]) && arg[2][0] === 'out') {
        return true;
      }
    }
    if (!isInvokeInstruction(insn)) continue;
    const arg = insn && insn.arg;
    if (Array.isArray(arg) && arg[1] === 'java/io/PrintStream' && Array.isArray(arg[2]) && arg[2][0] === 'println') {
      return true;
    }
  }
  return false;
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

function isSimpleLocalCopyContinuationTail(codeItems, start, end) {
  const instructions = [];
  for (let i = start; i < end; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (insn) instructions.push(insn);
  }
  if (instructions.length !== 3 || op(instructions[2]) !== 'goto') return false;
  const store = localStore(instructions[1]);
  if (!store) return false;
  if (store.kind === 'a') return refLoadLocal(instructions[0]) != null;
  if (store.kind === 'i') return intLoadLocal(instructions[0]) != null;
  return false;
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

function intStoreInstruction(local) {
  if (local === 0) return 'istore_0';
  if (local === 1) return 'istore_1';
  if (local === 2) return 'istore_2';
  if (local === 3) return 'istore_3';
  return { op: 'istore', arg: String(local) };
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

function clonePhaseContinuationTail(codeItems, code) {
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 1; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    if (!isInvokeDescriptor(codeItems[i - 1] && codeItems[i - 1].instruction, '(IIII)V')) continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (!looksLikePhaseContinuationEntry(codeItems, target)) continue;
    if (!canCloneForwardContinuationTail(codeItems, code, i, target)) continue;
    const clone = cloneItems(codeItems.slice(target));
    renameInternalLabels(clone, `LCKPHASE_${rewrites}_`);
    preserveReplacementEntryLabel(codeItems[i], clone);
    codeItems.splice(i, 1, ...clone);
    rewrites += 1;
    break;
  }
  return rewrites;
}

function looksLikePhaseContinuationEntry(codeItems, target) {
  if (target < 0 || target + 5 >= codeItems.length) return false;
  return op(codeItems[target] && codeItems[target].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[target + 1] && codeItems[target + 1].instruction) === 7
    && op(codeItems[target + 2] && codeItems[target + 2].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[target + 3] && codeItems[target + 3].instruction) === 8
    && op(codeItems[target + 4] && codeItems[target + 4].instruction) === 'iconst_0'
    && intStoreLocal(codeItems[target + 5] && codeItems[target + 5].instruction) === 9;
}

function cloneMenuContinuationTail(codeItems, code) {
  let rewrites = 0;
  for (let i = codeItems.length - 1; i >= 1 && rewrites < 2; i -= 1) {
    const jump = codeItems[i] && codeItems[i].instruction;
    if (op(jump) !== 'goto') continue;
    if (!isPutStaticDescriptor(codeItems[i - 1] && codeItems[i - 1].instruction, 'Ljava/lang/String;')) continue;
    const target = findLabelIndex(codeItems, jump.arg);
    if (!looksLikeMenuContinuationEntry(codeItems, target)) continue;
    if (!canCloneForwardContinuationTail(codeItems, code, i, target)) continue;
    const clone = cloneItems(codeItems.slice(target));
    renameInternalLabels(clone, `LCKMENUCONT_${rewrites}_`);
    preserveReplacementEntryLabel(codeItems[i], clone);
    codeItems.splice(i, 1, ...clone);
    rewrites += 1;
  }
  return rewrites;
}

function looksLikeMenuContinuationEntry(codeItems, target) {
  if (target < 0 || target + 2 >= codeItems.length) return false;
  return isGetStaticDescriptor(codeItems[target] && codeItems[target].instruction, 'J')
    && op(codeItems[target + 1] && codeItems[target + 1].instruction) === 'lconst_0'
    && op(codeItems[target + 2] && codeItems[target + 2].instruction) === 'lcmp';
}

function hasPresenceBooleanCandidate(codeItems) {
  return findPresenceBooleanBranch(codeItems) != null;
}

function clonePresenceBooleanTails(codeItems, code) {
  let rewrites = 0;
  for (let searchStart = 0; searchStart < codeItems.length && rewrites < 2; searchStart += 1) {
    const use = findPresenceBooleanBranch(codeItems, searchStart);
    if (!use) break;
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      use.branchIndex,
      use.falseStart,
      use.falseEnd,
      use.exitLabel,
      'LCKPRES',
    );
    if (changed) {
      rewrites += changed;
      searchStart = use.branchIndex + 1;
    } else {
      searchStart = use.branchIndex + 1;
    }
  }
  return rewrites;
}

function findPresenceBooleanBranch(codeItems, searchStart = 0) {
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = Math.max(4, searchStart); i + 1 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifeq') continue;
    if (op(codeItems[i - 1] && codeItems[i - 1].instruction) !== 'iand') continue;
    if (integerConstantValue(codeItems[i - 2] && codeItems[i - 2].instruction) !== 1) continue;
    const objLocal = refLoadLocal(codeItems[i - 4] && codeItems[i - 4].instruction);
    if (objLocal == null) continue;
    const trueStart = nextInstructionIndex(codeItems, i + 1);
    if (trueStart !== i + 1 || integerConstantValue(codeItems[trueStart] && codeItems[trueStart].instruction) !== 1) continue;
    const trueJump = codeItems[trueStart + 1] && codeItems[trueStart + 1].instruction;
    if (op(trueJump) !== 'goto') continue;
    const putfieldIndex = findLabelIndex(codeItems, trueJump.arg);
    if (putfieldIndex < 0 || putfieldIndex <= trueStart) continue;
    if (!isFieldWithDescriptor(codeItems[putfieldIndex] && codeItems[putfieldIndex].instruction, 'putfield', 'Z')) continue;
    const falseStart = findLabelIndex(codeItems, branch.arg);
    if (falseStart < 0 || falseStart === trueStart || falseStart >= putfieldIndex) continue;
    if ((refCounts.get(labelName(branch.arg)) || 0) < 2) continue;
    if (integerConstantValue(codeItems[falseStart] && codeItems[falseStart].instruction) !== 0) continue;
    if (falseStart + 1 !== putfieldIndex) continue;
    const exitLabel = ensureFreshLabel(codeItems, putfieldIndex + 1, 'LCKPRES_EXIT');
    return { branchIndex: i, falseStart, falseEnd: putfieldIndex + 1, exitLabel };
  }
  return null;
}

function hasDuplicateQueueEntry(codeItems) {
  return findDuplicateQueueEntry(codeItems) != null;
}

function retargetDuplicateQueueEntry(codeItems) {
  const use = findDuplicateQueueEntry(codeItems);
  if (!use) return 0;
  for (const ref of use.refs) {
    const insn = codeItems[ref] && codeItems[ref].instruction;
    if (insn && labelName(insn.arg) === use.trampolineLabel) insn.arg = use.canonicalLabel;
  }
  const refCounts = collectLabelReferenceCounts(codeItems);
  if ((refCounts.get(use.trampolineLabel) || 0) === 0 && !hasFallthroughPredecessor(codeItems, use.trampolineIndex)) {
    codeItems.splice(use.trampolineIndex, 2);
  }
  return 1;
}

function findDuplicateQueueEntry(codeItems) {
  for (let i = 0; i + 3 < codeItems.length; i += 1) {
    const first = codeItems[i] && codeItems[i].instruction;
    const jump = codeItems[i + 1] && codeItems[i + 1].instruction;
    const second = codeItems[i + 2] && codeItems[i + 2].instruction;
    if (!isGetStatic(first, 'kl', 'kl_c', '[I')) continue;
    if (op(jump) !== 'goto') continue;
    if (!sameInstructionOperand(first, second)) continue;
    const trampolineLabel = labelName(codeItems[i] && codeItems[i].labelDef);
    const canonicalLabel = labelName(codeItems[i + 2] && codeItems[i + 2].labelDef);
    if (!trampolineLabel || !canonicalLabel) continue;
    if (findLabelIndex(codeItems, jump.arg) !== i + 3) continue;
    const refs = collectLabelReferencesDetailed(codeItems, trampolineLabel);
    if (refs.length === 0 || refs.some((ref) => ref >= i)) continue;
    if (rangeContainsInstructionLabels(codeItems, i, i + 2, new Set([canonicalLabel]))) continue;
    return { trampolineIndex: i, trampolineLabel, canonicalLabel, refs };
  }
  return null;
}

function rangeContainsInstructionLabels(codeItems, start, end, labels) {
  for (let i = start; i < end; i += 1) {
    for (const label of collectInstructionLabels(codeItems[i] && codeItems[i].instruction)) {
      if (labels.has(label)) return true;
    }
  }
  return false;
}

function retargetDuplicateInitialPose(codeItems) {
  const use = findDuplicateInitialPose(codeItems);
  if (!use) return 0;
  let changed = 0;
  for (const ref of use.refs) {
    const insn = codeItems[ref] && codeItems[ref].instruction;
    if (!insn || labelName(insn.arg) !== use.laterLabel) continue;
    insn.arg = use.earlierLabel;
    changed += 1;
  }
  return changed > 0 ? 1 : 0;
}

function findDuplicateInitialPose(codeItems) {
  for (let first = 0; first + 13 < codeItems.length; first += 1) {
    if (!isInitialPoseBlock(codeItems, first)) continue;
    const earlierLabel = labelName(codeItems[first] && codeItems[first].labelDef);
    if (!earlierLabel) continue;
    for (let second = first + 13; second + 13 < codeItems.length && second < first + 80; second += 1) {
      if (!isInitialPoseBlock(codeItems, second)) continue;
      if (!sameInstructionRangeExceptFinalBranch(codeItems, first, second, 13)) continue;
      const laterLabel = labelName(codeItems[second] && codeItems[second].labelDef);
      if (!laterLabel) continue;
      const refs = collectLabelReferencesDetailed(codeItems, laterLabel).filter((ref) => ref < first);
      if (refs.length === 0) continue;
      return { earlierLabel, laterLabel, refs };
    }
  }
  return null;
}

function isInitialPoseBlock(codeItems, start) {
  return op(codeItems[start] && codeItems[start].instruction) === 'aload_0'
    && integerConstantValue(codeItems[start + 1] && codeItems[start + 1].instruction) === 740
    && isPutField(codeItems[start + 2] && codeItems[start + 2].instruction, 'gf', 'gf_f', 'I')
    && op(codeItems[start + 3] && codeItems[start + 3].instruction) === 'aload_0'
    && integerConstantValue(codeItems[start + 4] && codeItems[start + 4].instruction) === 450
    && isPutField(codeItems[start + 5] && codeItems[start + 5].instruction, 'gf', 'E', 'I')
    && op(codeItems[start + 6] && codeItems[start + 6].instruction) === 'aload_0'
    && integerConstantValue(codeItems[start + 7] && codeItems[start + 7].instruction) === -50
    && isPutField(codeItems[start + 8] && codeItems[start + 8].instruction, 'gf', 'gf_n', 'I')
    && op(codeItems[start + 9] && codeItems[start + 9].instruction) === 'aload_0'
    && integerConstantValue(codeItems[start + 10] && codeItems[start + 10].instruction) === 0
    && isPutField(codeItems[start + 11] && codeItems[start + 11].instruction, 'gf', 'gf_e', 'I')
    && op(codeItems[start + 12] && codeItems[start + 12].instruction) === 'goto';
}

function cloneIteratorBooleanTail(codeItems, code) {
  const use = findIteratorBooleanTail(codeItems);
  if (!use) return 0;
  return cloneConditionalRangeAfterBranchWithFallthroughGoto(
    codeItems,
    code,
    use.branchIndex,
    use.tailStart,
    use.tailEnd,
    use.exitLabel,
    'LCKITERBOOL',
  );
}

function findIteratorBooleanTail(codeItems) {
  const refCounts = collectLabelReferenceCounts(codeItems);
  for (let i = 2; i + 3 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifne') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 1) continue;
    const targetLabel = labelName(branch.arg);
    if (!targetLabel || (refCounts.get(targetLabel) || 0) < 2) continue;
    const tailStart = findLabelIndex(codeItems, targetLabel);
    if (tailStart <= i) continue;
    const invokeIndex = tailStart + 1;
    if (integerConstantValue(codeItems[tailStart] && codeItems[tailStart].instruction) !== 0) continue;
    if (!isInvoke(codeItems[invokeIndex] && codeItems[invokeIndex].instruction, 'tg', 'a', '(Z)Lpi;')) continue;
    const fallthrough = nextInstructionIndex(codeItems, i + 1);
    if (fallthrough !== i + 1) continue;
    if (integerConstantValue(codeItems[fallthrough] && codeItems[fallthrough].instruction) !== 1) continue;
    const fallthroughJump = codeItems[fallthrough + 1] && codeItems[fallthrough + 1].instruction;
    if (op(fallthroughJump) !== 'goto' || findLabelIndex(codeItems, fallthroughJump.arg) !== invokeIndex) continue;
    const exitLabel = ensureFreshLabel(codeItems, invokeIndex + 1, 'LCKITERBOOL_EXIT');
    return { branchIndex: i, tailStart, tailEnd: invokeIndex + 1, exitLabel };
  }
  return null;
}

function retargetDuplicateRadiusScans(codeItems, code) {
  const plan = findDuplicateRadiusScans(codeItems);
  if (!plan) return 0;
  const canonicalLabel = labelName(codeItems[plan.canonicalStart] && codeItems[plan.canonicalStart].labelDef);
  if (!canonicalLabel) return 0;
  let rewrites = 0;
  for (const duplicate of plan.duplicates.slice().sort((a, b) => b.start - a.start)) {
    if (rangeTouchesExceptionTable(code, codeItems, duplicate.start, duplicate.end)) continue;
    const replacement = cloneItemMetadata(codeItems[duplicate.start]);
    replacement.instruction = { op: 'goto', arg: canonicalLabel };
    codeItems.splice(duplicate.start, duplicate.end - duplicate.start, replacement);
    rewrites += 1;
  }
  return rewrites;
}

function findDuplicateRadiusScans(codeItems) {
  const starts = [];
  for (let i = 0; i + 8 < codeItems.length; i += 1) {
    if (looksLikeRadiusScanSetup(codeItems, i)) starts.push(i);
  }
  if (starts.length < 4) return null;
  const canonicalStart = starts[starts.length - 1];
  const canonicalLabel = labelName(codeItems[canonicalStart] && codeItems[canonicalStart].labelDef);
  if (!canonicalLabel) return null;
  const duplicates = [];
  for (const start of starts.slice(0, -1)) {
    const end = findExternallyTargetedLabelAfter(codeItems, start + 1, canonicalStart, start);
    if (end <= start) return null;
    if (!rangeHasOnlyInternalLabelReferences(codeItems, start, end)) return null;
    duplicates.push({ start, end });
  }
  return duplicates.length >= 3 ? { canonicalStart, duplicates } : null;
}

function looksLikeRadiusScanSetup(codeItems, start) {
  return isGetStatic(codeItems[start] && codeItems[start].instruction, 'uc', 'uc_d', '[[I') &&
    intLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction) === 4 &&
    op(codeItems[start + 2] && codeItems[start + 2].instruction) === 'aaload' &&
    integerConstantValue(codeItems[start + 3] && codeItems[start + 3].instruction) === 7 &&
    op(codeItems[start + 4] && codeItems[start + 4].instruction) === 'iaload' &&
    intStoreLocal(codeItems[start + 5] && codeItems[start + 5].instruction) === 6 &&
    intLoadLocal(codeItems[start + 6] && codeItems[start + 6].instruction) === 6 &&
    intStoreLocal(codeItems[start + 7] && codeItems[start + 7].instruction) === 8;
}

function findExternallyTargetedLabelAfter(codeItems, start, limit, duplicateStart) {
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (let i = start; i < limit; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (!label) continue;
    const refs = refsByLabel.get(label) || [];
    if (refs.some((ref) => ref < duplicateStart)) return i;
  }
  return -1;
}

function rangeHasOnlyInternalLabelReferences(codeItems, start, end) {
  const labels = new Set();
  for (let i = start + 1; i < end; i += 1) {
    const label = labelName(codeItems[i] && codeItems[i].labelDef);
    if (label) labels.add(label);
  }
  if (labels.size === 0) return true;
  const refsByLabel = collectLabelReferencesByLabel(codeItems);
  for (const label of labels) {
    for (const ref of refsByLabel.get(label) || []) {
      if (ref < start || ref >= end) return false;
    }
  }
  return true;
}

function retargetDuplicateBase38EncoderEntry(codeItems) {
  const use = findDuplicateBase38EncoderEntry(codeItems);
  if (!use) return 0;
  codeItems[use.jumpIndex].instruction.arg = use.canonicalLabel;
  return 1;
}

function cloneForwardBase38CharBody(codeItems, code) {
  let rewrites = 0;
  for (let i = 0; i < codeItems.length && rewrites < 2; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpgt') continue;
    const lengthLocal = intLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction);
    const indexLocal = intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction);
    if (lengthLocal !== 7 || indexLocal !== 8) continue;
    const bodyStart = findLabelIndex(codeItems, branch.arg);
    if (bodyStart <= i || bodyStart - i > 40) continue;
    const body = readForwardBase38CharBody(codeItems, bodyStart);
    if (!body) continue;
    const exitLabel = ensureFreshLabel(codeItems, body.exitIndex, `LCKB38FWD_EXIT_${rewrites}`);
    const changed = cloneConditionalRangeAfterBranchWithFallthroughGoto(
      codeItems,
      code,
      i,
      bodyStart,
      body.exitIndex,
      exitLabel,
      'LCKB38FWD',
    );
    if (changed) {
      rewrites += changed;
      i += body.exitIndex - bodyStart;
    }
  }
  return rewrites;
}

function findDuplicateBase38EncoderEntry(codeItems) {
  for (let i = 0; i + 6 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    if (integerConstantValue(codeItems[i - 1] && codeItems[i - 1].instruction) !== 94) continue;
    if (intLoadLocal(codeItems[i - 2] && codeItems[i - 2].instruction) !== 2) continue;
    const canonicalIndex = findLabelIndex(codeItems, branch.arg);
    if (!looksLikeBase38EncoderEntry(codeItems, canonicalIndex)) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'aload_0') continue;
    if (integerConstantValue(codeItems[i + 2] && codeItems[i + 2].instruction) !== 64) continue;
    if (!isPutFieldDescriptor(codeItems[i + 3] && codeItems[i + 3].instruction, 'I')) continue;
    const jump = codeItems[i + 4] && codeItems[i + 4].instruction;
    if (op(jump) !== 'goto') continue;
    const duplicateIndex = findLabelIndex(codeItems, jump.arg);
    if (!looksLikeBase38EncoderEntry(codeItems, duplicateIndex)) continue;
    return { jumpIndex: i + 4, canonicalLabel: labelName(branch.arg) };
  }
  return null;
}

function looksLikeBase38EncoderEntry(codeItems, start) {
  return start >= 0 &&
    op(codeItems[start] && codeItems[start].instruction) === 'lconst_0' &&
    op(codeItems[start + 1] && codeItems[start + 1].instruction) === 'lstore_3' &&
    op(codeItems[start + 2] && codeItems[start + 2].instruction) === 'lconst_0' &&
    op(codeItems[start + 3] && codeItems[start + 3].instruction) === 'lstore' &&
    refLoadLocal(codeItems[start + 4] && codeItems[start + 4].instruction) === 1 &&
    isInvoke(codeItems[start + 5] && codeItems[start + 5].instruction, 'java/lang/String', 'length', '()I') &&
    intStoreLocal(codeItems[start + 6] && codeItems[start + 6].instruction) === 7;
}

function readForwardBase38CharBody(codeItems, start) {
  if (refLoadLocal(codeItems[start] && codeItems[start].instruction) !== 1) return null;
  if (intLoadLocal(codeItems[start + 1] && codeItems[start + 1].instruction) !== 8) return null;
  if (!isInvoke(codeItems[start + 2] && codeItems[start + 2].instruction, 'java/lang/String', 'charAt', '(I)C')) return null;
  if (intStoreLocal(codeItems[start + 3] && codeItems[start + 3].instruction) !== 9) return null;
  for (let i = start + 4; i < Math.min(codeItems.length, start + 160); i += 1) {
    const compare = readMinusOneCompareConstant(codeItems, i);
    if (!compare || compare.local !== 8 || compare.constant !== -11) continue;
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpne') continue;
    const target = findLabelIndex(codeItems, branch.arg);
    if (target < 0 || target >= start) return null;
    const resetStore = nextInstructionIndexes(codeItems, i + 1, 6);
    if (resetStore.length < 6) return null;
    if (!isLongLoad(codeItems[resetStore[0]] && codeItems[resetStore[0]].instruction)) return null;
    if (!isLongStore(codeItems[resetStore[1]] && codeItems[resetStore[1]].instruction)) return null;
    if (op(codeItems[resetStore[2]] && codeItems[resetStore[2]].instruction) !== 'lconst_0') return null;
    if (!isLongStore(codeItems[resetStore[3]] && codeItems[resetStore[3]].instruction)) return null;
    const jump = codeItems[resetStore[4]] && codeItems[resetStore[4]].instruction;
    if (op(jump) !== 'goto' || findLabelIndex(codeItems, jump.arg) !== target) return null;
    return { exitIndex: resetStore[5] };
  }
  return null;
}

function cloneChatWidthTails(codeItems, code) {
  let rewrites = 0;
  const uses = findChatWidthTailUses(codeItems).sort((a, b) => b.branchIndex - a.branchIndex);
  for (const use of uses) {
    rewrites += cloneTailAfterConditionalBranch(codeItems, code, use.branchIndex, use.tailStart, use.tailEnd, 'LCKWIDTH');
  }
  return rewrites;
}

function findChatWidthTailUses(codeItems) {
  const out = [];
  const special = findCeEqualsTwoTail(codeItems);
  if (special) out.push(special);
  const channel = findNonMinusOnePrefixTail(codeItems);
  if (channel) out.push(channel);
  return out;
}

function findCeEqualsTwoTail(codeItems) {
  for (let i = 2; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpeq') continue;
    if (integerConstantValue(codeItems[i - 2] && codeItems[i - 2].instruction) !== 2) continue;
    if (!isGetStatic(codeItems[i - 1] && codeItems[i - 1].instruction, 'ce', 'ce_d', 'I')) continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (!looksLikeDirectMessageWidthTail(codeItems, tailStart)) continue;
    const tailEnd = findWidthCheckReturnEnd(codeItems, tailStart, 2, 340);
    if (tailEnd <= tailStart) continue;
    return { branchIndex: i, tailStart, tailEnd };
  }
  return null;
}

function findNonMinusOnePrefixTail(codeItems) {
  for (let i = 3; i < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'if_icmpne') continue;
    if (integerConstantValue(codeItems[i - 3] && codeItems[i - 3].instruction) !== -1) continue;
    if (!isGetStatic(codeItems[i - 2] && codeItems[i - 2].instruction, 'ce', 'ce_d', 'I')) continue;
    if (op(codeItems[i - 1] && codeItems[i - 1].instruction) !== 'ixor') continue;
    const tailStart = findLabelIndex(codeItems, branch.arg);
    if (!looksLikePrefixWidthTail(codeItems, tailStart)) continue;
    const tailEnd = findWidthCheckReturnEnd(codeItems, tailStart, 1, 120);
    if (tailEnd <= tailStart) continue;
    return { branchIndex: i, tailStart, tailEnd };
  }
  return null;
}

function looksLikeDirectMessageWidthTail(codeItems, start) {
  return start >= 0 &&
    isGetStatic(codeItems[start] && codeItems[start].instruction, 'dg', 'dg_b', 'Ljava/lang/String;') &&
    integerConstantValue(codeItems[start + 1] && codeItems[start + 1].instruction) === 116 &&
    integerConstantValue(codeItems[start + 2] && codeItems[start + 2].instruction) === 1 &&
    op(codeItems[start + 3] && codeItems[start + 3].instruction) === 'anewarray';
}

function looksLikePrefixWidthTail(codeItems, start) {
  return start >= 0 &&
    op(codeItems[start] && codeItems[start].instruction) === 'new' &&
    op(codeItems[start + 1] && codeItems[start + 1].instruction) === 'dup' &&
    op(codeItems[start + 2] && codeItems[start + 2].instruction) === 'invokespecial' &&
    refLoadLocal(codeItems[start + 3] && codeItems[start + 3].instruction) === 8;
}

function findWidthCheckReturnEnd(codeItems, start, ordinal, maxInsns) {
  let instructions = 0;
  let widthChecks = 0;
  for (let i = start; i < codeItems.length && instructions < maxInsns; i += 1) {
    if (!codeItems[i] || !codeItems[i].instruction) continue;
    instructions += 1;
    if (!looksLikeWidthCheckStart(codeItems, i)) continue;
    widthChecks += 1;
    if (widthChecks !== ordinal) continue;
    const end = findSecondIreturnAfter(codeItems, i, 48);
    if (end > i) return end;
  }
  return -1;
}

function looksLikeWidthCheckStart(codeItems, start) {
  return isGetStatic(codeItems[start] && codeItems[start].instruction, 'vl', 'Q', 'Ljl;') &&
    isGetStatic(codeItems[start + 1] && codeItems[start + 1].instruction, 'mp', 'mp_a', 'Ljava/lang/StringBuilder;') &&
    isInvoke(codeItems[start + 2] && codeItems[start + 2].instruction, 'java/lang/StringBuilder', 'toString', '()Ljava/lang/String;') &&
    isInvoke(codeItems[start + 3] && codeItems[start + 3].instruction, 'jl', 'c', '(Ljava/lang/String;)I') &&
    intLoadLocal(codeItems[start + 4] && codeItems[start + 4].instruction) === 6;
}

function findSecondIreturnAfter(codeItems, start, maxInsns) {
  let instructions = 0;
  let returns = 0;
  for (let i = start; i < codeItems.length && instructions < maxInsns; i += 1) {
    if (!codeItems[i] || !codeItems[i].instruction) continue;
    instructions += 1;
    if (op(codeItems[i].instruction) !== 'ireturn') continue;
    returns += 1;
    if (returns < 2) continue;
    const next = nextInstructionIndex(codeItems, i + 1);
    return next > 0 ? next : i + 1;
  }
  return -1;
}

function retargetBooleanDuplicateBase38Encoder(codeItems) {
  const use = findBooleanDuplicateBase38Encoder(codeItems);
  if (!use) return 0;
  codeItems[use.jumpIndex].instruction.arg = use.canonicalLabel;
  return 1;
}

function findBooleanDuplicateBase38Encoder(codeItems) {
  for (let i = 2; i + 6 < codeItems.length; i += 1) {
    const branch = codeItems[i] && codeItems[i].instruction;
    if (op(branch) !== 'ifeq') continue;
    if (intLoadLocal(codeItems[i - 1] && codeItems[i - 1].instruction) !== 2) continue;
    if (op(codeItems[i - 2] && codeItems[i - 2].instruction) !== 'lstore_3') continue;
    const canonicalIndex = findLabelIndex(codeItems, branch.arg);
    if (!looksLikeBooleanBase38EncoderEntry(codeItems, canonicalIndex)) continue;
    if (op(codeItems[i + 1] && codeItems[i + 1].instruction) !== 'aload_0') continue;
    if (integerConstantValue(codeItems[i + 2] && codeItems[i + 2].instruction) !== -109) continue;
    if (!isPutField(codeItems[i + 3] && codeItems[i + 3].instruction, 'qc', 'qc_f', 'I')) continue;
    const jump = codeItems[i + 4] && codeItems[i + 4].instruction;
    if (op(jump) !== 'goto') continue;
    const duplicateIndex = findLabelIndex(codeItems, jump.arg);
    if (!looksLikeBooleanBase38EncoderEntry(codeItems, duplicateIndex)) continue;
    return { jumpIndex: i + 4, canonicalLabel: labelName(branch.arg) };
  }
  return null;
}

function looksLikeBooleanBase38EncoderEntry(codeItems, start) {
  return start >= 0 &&
    op(codeItems[start] && codeItems[start].instruction) === 'lconst_0' &&
    op(codeItems[start + 1] && codeItems[start + 1].instruction) === 'lstore' &&
    refLoadLocal(codeItems[start + 2] && codeItems[start + 2].instruction) === 1 &&
    isInvoke(codeItems[start + 3] && codeItems[start + 3].instruction, 'java/lang/String', 'length', '()I') &&
    intStoreLocal(codeItems[start + 4] && codeItems[start + 4].instruction) === 7 &&
    integerConstantValue(codeItems[start + 5] && codeItems[start + 5].instruction) === 19 &&
    intStoreLocal(codeItems[start + 6] && codeItems[start + 6].instruction) === 8;
}

function canCloneForwardContinuationTail(codeItems, code, source, target) {
  if (target <= source || target >= codeItems.length) return false;
  const maxInsns = Number(process.env.STRUCTURED_GOTO_CONTINUATION_MAX_INSNS || 2500);
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

    // The clone is inserted immediately after the conditional. Invert the
    // branch so its original fallthrough skips the clone; otherwise both
    // outcomes enter the cloned iinc tail and the fallthrough body becomes
    // unreachable. That body can contain loop-carried stores consumed after
    // the loop (dekobloko ad.a([BI)V updates its running maximum there).
    const fallthrough = ensureLabel(codeItems[i + 1], `LCKIJF_${rewrites}`);
    const clone = cloneItems(codeItems.slice(target, tail.end + 1));
    renameInternalLabels(clone, `LCKIJC_${rewrites}_`);
    const cloneEntry = `LCKIJ_${rewrites}`;
    clone[0].labelDef = `${cloneEntry}:`;
    insn.op = invertConditionalBranch(cur);
    insn.arg = fallthrough;
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

function integerConstantValue(insn) {
  const cur = op(insn);
  if (cur === 'iconst_m1') return -1;
  const iconst = /^iconst_([0-5])$/.exec(cur || '');
  if (iconst) return Number(iconst[1]);
  if (cur === 'bipush' || cur === 'sipush' || cur === 'ldc' || cur === 'ldc_w') {
    const value = Number(insn && insn.arg);
    return Number.isFinite(value) ? value : null;
  }
  return null;
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
  return JSON.stringify(insn.arg, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
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

function isLongLoad(insn) {
  const cur = op(insn);
  return cur === 'lload_0' ||
    cur === 'lload_1' ||
    cur === 'lload_2' ||
    cur === 'lload_3' ||
    cur === 'lload';
}

function isLongStore(insn) {
  const cur = op(insn);
  return cur === 'lstore_0' ||
    cur === 'lstore_1' ||
    cur === 'lstore_2' ||
    cur === 'lstore_3' ||
    cur === 'lstore';
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
