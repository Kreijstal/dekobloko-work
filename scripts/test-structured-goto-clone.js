#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  runStructuredGotoClone,
  countIntComplements,
  restoreDroppedIntComplements,
} = require('./pipeline/structuredGotoClone');

function item(label, instruction) {
  const out = {};
  if (label) out.labelDef = `${label}:`;
  if (instruction !== undefined) out.instruction = instruction;
  return out;
}

function astFrom(codeItems, codeOptions = {}) {
  return {
    classes: [{
      items: [{
        type: 'method',
        method: {
          name: 'm',
          attributes: [{ type: 'code', code: { ...codeOptions, codeItems } }],
        },
      }],
    }],
  };
}

function targetAstFrom(className, methodName, descriptor, codeItems, codeOptions = {}) {
  return {
    classes: [{
      className,
      items: [{
        type: 'method',
        method: {
          name: methodName,
          descriptor,
          attributes: [{ type: 'code', code: { ...codeOptions, codeItems } }],
        },
      }],
    }],
  };
}

function padded(codeItems) {
  while (codeItems.length < 20) codeItems.push(item(`LPAD${codeItems.length}`, null));
  return codeItems;
}

{
  const original = [
    item('LLOAD', { op: 'iload', arg: '2' }),
    item('LNOT', 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'bipush', arg: '-3' }),
    item(null, { op: 'if_icmpeq', arg: 'LMATCH' }),
  ];
  const rewritten = cloneItems(original);
  rewritten.splice(1, 2);
  assert.equal(countIntComplements(original), 1);
  assert.equal(restoreDroppedIntComplements(rewritten, original), true, 'dropped integer complement should roll back the method');
  assert.deepEqual(rewritten, original);
  const equivalent = cloneItems(original);
  equivalent.splice(1, 3, item(null, 'iconst_2'));
  assert.equal(restoreDroppedIntComplements(equivalent, original), false, 'equivalent folded comparison should be retained');
}

function withLoopEntry(fn) {
  const old = process.env.STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY;
  process.env.STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY = '1';
  try {
    return fn();
  } finally {
    if (old === undefined) delete process.env.STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY;
    else process.env.STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY = old;
  }
}

function withOneShotPreheader(fn) {
  const keys = [
    'STRUCTURED_GOTO_ONESHOT_PREHEADER',
    'STRUCTURED_GOTO_CLONE_SHORT',
    'STRUCTURED_GOTO_CLONE_ZERO',
    'STRUCTURED_GOTO_CLONE_RETURN',
    'STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL',
  ];
  const old = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.STRUCTURED_GOTO_ONESHOT_PREHEADER = '1';
  process.env.STRUCTURED_GOTO_CLONE_SHORT = '0';
  process.env.STRUCTURED_GOTO_CLONE_ZERO = '0';
  process.env.STRUCTURED_GOTO_CLONE_RETURN = '0';
  process.env.STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL = '0';
  try {
    return fn();
  } finally {
    for (const key of keys) {
      const value = old.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function withFalseReturnGuards(fn) {
  const oldTargets = process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS;
  process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS = '*.m';
  try {
    return fn();
  } finally {
    if (oldTargets === undefined) delete process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS;
    else process.env.STRUCTURED_GOTO_FALSE_RETURN_GUARD_TARGETS = oldTargets;
  }
}

function withSharedContinueTails(fn) {
  const oldTargets = process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAIL_TARGETS;
  process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAIL_TARGETS = '*.m';
  try {
    return fn();
  } finally {
    if (oldTargets === undefined) delete process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAIL_TARGETS;
    else process.env.STRUCTURED_GOTO_SHARED_CONTINUE_TAIL_TARGETS = oldTargets;
  }
}

function withJiByteWrapScanTails(fn) {
  const oldTargets = process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_TARGETS;
  process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_TARGETS = '*.m';
  try {
    return fn();
  } finally {
    if (oldTargets === undefined) delete process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_TARGETS;
    else process.env.STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAIL_TARGETS = oldTargets;
  }
}

function withPbBlurTailRetarget(fn) {
  const oldTargets = process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET_TARGETS;
  process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET_TARGETS = '*.m';
  try {
    return fn();
  } finally {
    if (oldTargets === undefined) delete process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET_TARGETS;
    else process.env.STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET_TARGETS = oldTargets;
  }
}

function withDuplicateDrainHeader(fn) {
  const oldTargets = process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER_TARGETS;
  process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER_TARGETS = '*.m';
  try {
    return fn();
  } finally {
    if (oldTargets === undefined) delete process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER_TARGETS;
    else process.env.STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER_TARGETS = oldTargets;
  }
}

function withBoundedConditionalTails(fn) {
  const keys = [
    'STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS',
    'STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_REWRITES',
    'STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_INSNS',
    'STRUCTURED_GOTO_CLONE_SHORT',
    'STRUCTURED_GOTO_CLONE_ZERO',
    'STRUCTURED_GOTO_CLONE_RETURN',
    'STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL',
    'STRUCTURED_GOTO_ONESHOT_PREHEADER',
  ];
  const old = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS = '1';
  process.env.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_REWRITES = '4';
  process.env.STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAIL_MAX_INSNS = '32';
  process.env.STRUCTURED_GOTO_CLONE_SHORT = '0';
  process.env.STRUCTURED_GOTO_CLONE_ZERO = '0';
  process.env.STRUCTURED_GOTO_CLONE_RETURN = '0';
  process.env.STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL = '0';
  process.env.STRUCTURED_GOTO_ONESHOT_PREHEADER = '0';
  try {
    return fn();
  } finally {
    for (const key of keys) {
      const value = old.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function withOnlyStructuredGotoEnv(overrides, fn) {
  const disabled = {
    STRUCTURED_GOTO_CLONE_SHORT: '0',
    STRUCTURED_GOTO_CLONE_ZERO: '0',
    STRUCTURED_GOTO_CLONE_RETURN: '0',
    STRUCTURED_GOTO_CLONE_ARRAY_JOIN: '0',
    STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '0',
    STRUCTURED_GOTO_FALSE_RETURN_GUARDS: '0',
    STRUCTURED_GOTO_SHARED_CONTINUE_TAILS: '0',
    STRUCTURED_GOTO_JI_BYTE_WRAP_SCAN_TAILS: '0',
    STRUCTURED_GOTO_PB_BLUR_TAIL_RETARGET: '0',
    STRUCTURED_GOTO_DUPLICATE_DRAIN_HEADER: '0',
    STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
    STRUCTURED_GOTO_MERGE_IINC_TAILS: '0',
    STRUCTURED_GOTO_MERGE_BACKEDGE_TAILS: '0',
    STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '0',
    STRUCTURED_GOTO_BOUNDED_CONDITIONAL_TAILS: '0',
    STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    STRUCTURED_GOTO_INVERT_CONDITIONAL_GOTO_BRIDGES: '0',
    STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
    STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
    STRUCTURED_GOTO_HBB_CACHED_LOOKUP_CONTINUATION: '0',
    STRUCTURED_GOTO_UCA_SHARED_LOOP_INCREMENT_TAIL: '0',
    STRUCTURED_GOTO_VH_UCA_SHARED_RETURN_TAIL: '0',
    STRUCTURED_GOTO_VH_UCA_ENTITY_LOOP_CONTINUATION: '0',
    STRUCTURED_GOTO_VH_UCA_MENU_LOOP_CONTINUATION: '0',
    STRUCTURED_GOTO_VOIDHUNTERS_SHARED_LOOP_INCREMENT_TAILS: '0',
    STRUCTURED_GOTO_VH_ROA_Y_BUCKET_INIT: '0',
    STRUCTURED_GOTO_SHATTERED_PLANS_HI_CONTINUATION: '0',
    STRUCTURED_GOTO_SHATTERED_PLANS_LE_PREFIX_CONTINUATION: '0',
    STRUCTURED_GOTO_SHATTERED_PLANS_SC_SHARED_BOOLEAN_TAIL: '0',
    STRUCTURED_GOTO_SHATTERED_PLANS_UO_ITERATOR_ADVANCE: '0',
    STRUCTURED_GOTO_SHATTERED_PLANS_UO_MESSAGE_EXIT: '0',
    STRUCTURED_GOTO_SHATTERED_PLANS_DC_NOT_COMPARE: '0',
    STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE: '0',
    STRUCTURED_GOTO_BACHELOR_GT_STACK_SHIFT_STORE: '0',
    STRUCTURED_GOTO_BACHELOR_GJ_DUPLICATE_INVENTORY_LOOP: '0',
    STRUCTURED_GOTO_BACHELOR_JO_STACK_COMPARE_TAILS: '0',
    STRUCTURED_GOTO_BACHELOR_DEAD_FLAG_BRANCHES: '0',
    STRUCTURED_GOTO_BACHELOR_GJ_SECOND_HAND_LOOP: '0',
    STRUCTURED_GOTO_BACHELOR_GJ_CARD_LOOP: '0',
    STRUCTURED_GOTO_BACHELOR_GJ_SHARED_ICON_LOOP: '0',
    STRUCTURED_GOTO_BRICK_SA_EARLY_FINAL_LOOP_EXIT: '0',
    STRUCTURED_GOTO_BRICK_DEAD_FLAG_BRANCHES: '0',
    STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE: '0',
    STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS: '0',
    STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION: '0',
    STRUCTURED_GOTO_36CARD_VJ_BLUR_LOOP_HEADER: '0',
    STRUCTURED_GOTO_ACE_FG_AG_DRAIN_LOOP: '0',
  };
  const merged = { ...disabled, ...overrides };
  const keys = Object.keys(merged);
  const old = new Map(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(merged)) process.env[key] = value;
  try {
    return fn();
  } finally {
    for (const key of keys) {
      const value = old.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

{
  const codeItems = padded([
    item('L0', 'iconst_0'),
    item('L1', { op: 'ifeq', arg: 'L3' }),
    item('L2', 'return'),
    item('L3', 'iconst_1'),
    item('L4', 'ireturn'),
  ]);
  const result = withFalseReturnGuards(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should remove false return guards for targeted methods');
  assert.equal(codeItems[0].instruction, 'nop');
  assert.equal(codeItems[1].instruction, 'nop');
  assert.equal(codeItems[2].instruction, 'return');
}

{
  const codeItems = padded([
    item('LGET', { op: 'getstatic', arg: ['Field', 'BachelorFridge', ['y', 'I']] }),
    item('LSTORE', { op: 'istore', arg: '3' }),
    item('LLOAD1', { op: 'iload', arg: '3' }),
    item('LIFNE', { op: 'ifne', arg: 'LDEAD' }),
    item('LLOAD2', { op: 'iload', arg: '3' }),
    item('LIFEQ', { op: 'ifeq', arg: 'LZERO' }),
    item('LFALL', 'return'),
    item('LZERO', 'ireturn'),
    item('LDEAD', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_BACHELOR_DEAD_FLAG_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('op', 'c', '(B)I', codeItems)));
  assert.equal(result.changed, true, 'should remove targeted Bachelor Fridge zero-flag branches');
  assert.equal(codeItems[2].instruction, 'nop');
  assert.equal(codeItems[3].instruction, 'nop');
  assert.equal(codeItems[4].instruction, 'nop');
  assert.deepEqual(codeItems[5].instruction, { op: 'goto', arg: 'LZERO' });
}

{
  const codeItems = padded([
    item('L0', 'iconst_0'),
    item('L1', { op: 'istore', arg: '6' }),
    item('L2', { op: 'goto', arg: 'LHEAD' }),
    item('LCONT', { op: 'iload', arg: '7' }),
    item('L4', { op: 'istore', arg: '6' }),
    item('L5', { op: 'goto', arg: 'LHEAD' }),
    item('LHEAD', { op: 'aload_2' }),
    item('L7', { op: 'ifnull', arg: 'LCONT' }),
    item('L8', 'iconst_0'),
    item('L9', 'istore_1'),
    item('L10', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
    item('LUNUSED', { op: 'goto', arg: 'LCONT' }),
  ]);
  const result = withSharedContinueTails(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should clone shared continue tails for targeted methods');
  assert.notEqual(codeItems[7].instruction.arg, 'LCONT');
  const clone = codeItems.find((entry) => entry.labelDef === `${codeItems[7].instruction.arg}:`);
  assert.ok(clone, 'cloned continue tail should define the new branch target');
  assert.deepEqual(clone.instruction, { op: 'iload', arg: '7' });
}

{
  const codeItems = padded([
    item('L0', { op: 'iinc', arg: ['3', '-1'] }),
    item('L1', { op: 'iinc', arg: ['2', '-1'] }),
    item('L2', { op: 'iload_3' }),
    item('L3', { op: 'iflt', arg: 'LCOMP' }),
    item('L4', { op: 'goto', arg: 'LCHECK' }),
    item('L5', { op: 'iinc', arg: ['3', '4'] }),
    item('L6', { op: 'iinc', arg: ['2', '4'] }),
    item('L7', { op: 'goto', arg: 'LHEAD0' }),
    item('LHEAD0', 'iconst_m1'),
    item('L9', { op: 'goto', arg: 'L0' }),
    item('L10', { op: 'iinc', arg: ['3', '-1'] }),
    item('L11', { op: 'iinc', arg: ['2', '-1'] }),
    item('L12', { op: 'iload_3' }),
    item('L13', { op: 'iflt', arg: 'LCOMP' }),
    item('L14', { op: 'goto', arg: 'LCHECK' }),
    item('L15', { op: 'iinc', arg: ['3', '4'] }),
    item('L16', { op: 'iinc', arg: ['2', '4'] }),
    item('L17', { op: 'goto', arg: 'LHEAD1' }),
    item('LHEAD1', 'iconst_m1'),
    item('L19', { op: 'goto', arg: 'L10' }),
    item('LORIG', 'iconst_1'),
    item('L21', { op: 'goto', arg: 'LCHECK' }),
    item('LCOMP', { op: 'iinc', arg: ['2', '4'] }),
    item('L24', { op: 'iinc', arg: ['3', '4'] }),
    item('LCHECK', 'iload_2'),
    item('L26', 'iconst_m1'),
    item('L27', 'ixor'),
    item('L28', 'aload_0'),
    item('L29', 'getfield'),
    item('L30', 'getfield'),
    item('L31', 'iconst_m1'),
    item('L32', 'ixor'),
    item('L33', { op: 'if_icmpne', arg: 'LORIG' }),
    item('L34', 'iload_2'),
    item('L35', 'ireturn'),
  ]);
  const result = withJiByteWrapScanTails(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should clone ji byte wrap scan shared tails for targeted methods');
  assert.equal(result.rewrites, 2);
  assert.notEqual(codeItems[3].instruction.arg, 'LCOMP');
  assert.notEqual(codeItems[4].instruction.arg, 'LCHECK');
  const firstCloneComp = codeItems.findIndex((entry) => entry.labelDef === `${codeItems[3].instruction.arg}:`);
  assert.ok(firstCloneComp > 0, 'first cloned compensation tail should exist');
  assert.equal(codeItems[firstCloneComp + 10].instruction.arg, 'LHEAD0');
  const secondBranch = codeItems.find((entry) => entry.instruction && entry.instruction.op === 'iflt' && entry.instruction.arg !== 'LCOMP' && entry !== codeItems[3]);
  assert.ok(secondBranch, 'second source branch should also be retargeted');
}

{
  const codeItems = padded([
    item('LEARLY', { op: 'iload', arg: '13' }),
    item('L1', { op: 'ifge', arg: 'LEARLY_DONE' }),
    item('L2', 'iconst_0'),
    item('L3', { op: 'istore', arg: '20' }),
    item('L4', { op: 'iload', arg: '20' }),
    item('L5', { op: 'iload', arg: '8' }),
    item('L6', { op: 'if_icmpge', arg: 'LEARLY_END' }),
    item('L7', 'aload_0'),
    item('L8', { op: 'iload', arg: '19' }),
    item('LEARLY_DONE', 'return'),
    item('LNEAR', { op: 'iload', arg: '13' }),
    item('L11', { op: 'ifge', arg: 'LNEAR_DONE' }),
    item('L12', 'iconst_0'),
    item('L13', { op: 'istore', arg: '20' }),
    item('L14', { op: 'iload', arg: '20' }),
    item('L15', { op: 'iload', arg: '8' }),
    item('L16', { op: 'if_icmpge', arg: 'LNEAR_END' }),
    item('L17', 'aload_0'),
    item('L18', { op: 'iload', arg: '19' }),
    item('LNEAR_DONE', 'return'),
    item('LSWITCH', { op: 'iload', arg: '13' }),
    item('L21', { op: 'iload', arg: '18' }),
    item('L22', { op: 'if_icmplt', arg: 'LLATE' }),
    item('L23', { op: 'iload', arg: '13' }),
    item('L24', { op: 'ifge', arg: 'LDONE' }),
    item('LLATE', 'iconst_0'),
    item('L26', { op: 'istore', arg: '20' }),
    item('L27', { op: 'goto', arg: 'LBODY' }),
    item('LBODY', { op: 'iload', arg: '20' }),
    item('L29', { op: 'iload', arg: '8' }),
    item('L30', { op: 'if_icmpge', arg: 'LDONE' }),
    item('LDONE', 'return'),
  ]);
  const result = withPbBlurTailRetarget(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should retarget pb blur late shared entry');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems[22].instruction.arg, 'LNEAR');
}

{
  const codeItems = padded([
    item('LENTRY', { op: 'goto', arg: 'LEARLY' }),
    item('LBEFORE', 'iconst_0'),
    item('LEARLY', { op: 'sipush', arg: '22759' }),
    item('L3', { op: 'invokestatic', arg: ['Method', 'dl', ['f', '(I)Z']] }),
    item('L4', { op: 'ifeq', arg: 'LEXIT' }),
    item('L5', { op: 'getstatic', arg: ['Field', 'vl', ['v', 'Z']] }),
    item('L6', { op: 'ifeq', arg: 'LALT' }),
    item('L7', { op: 'getstatic', arg: ['Field', 'ob', ['y', 'Z']] }),
    item('L8', { op: 'ifne', arg: 'LACTIVE_EARLY' }),
    item('L9', { op: 'getstatic', arg: ['Field', 'ee', ['G', 'Z']] }),
    item('L10', { op: 'ifeq', arg: 'LREDRAW' }),
    item('L11', { op: 'goto', arg: 'LACTIVE_EARLY' }),
    item('LACTIVE_EARLY', { op: 'bipush', arg: '13' }),
    item('L13', { op: 'bipush', arg: '15' }),
    item('L14', { op: 'bipush', arg: '12' }),
    item('L15', 'iconst_0'),
    item('L16', { op: 'invokestatic', arg: ['Method', 'cn', ['a', '(IIIZ)Z']] }),
    item('L17', { op: 'ifeq', arg: 'LTAIL' }),
    item('L18', { op: 'goto', arg: 'LEARLY' }),
    item('LMID', 'iconst_1'),
    item('LCANON', { op: 'sipush', arg: '22759' }),
    item('L21', { op: 'invokestatic', arg: ['Method', 'dl', ['f', '(I)Z']] }),
    item('L22', { op: 'ifeq', arg: 'LEXIT' }),
    item('L23', { op: 'getstatic', arg: ['Field', 'vl', ['v', 'Z']] }),
    item('L24', { op: 'ifeq', arg: 'LALT' }),
    item('L25', { op: 'getstatic', arg: ['Field', 'ob', ['y', 'Z']] }),
    item('L26', { op: 'ifne', arg: 'LACTIVE_CANON' }),
    item('L27', { op: 'getstatic', arg: ['Field', 'ee', ['G', 'Z']] }),
    item('L28', { op: 'ifeq', arg: 'LREDRAW' }),
    item('L29', { op: 'goto', arg: 'LACTIVE_CANON' }),
    item('LACTIVE_CANON', { op: 'bipush', arg: '13' }),
    item('L31', { op: 'bipush', arg: '15' }),
    item('L32', { op: 'bipush', arg: '12' }),
    item('L33', 'iconst_0'),
    item('L34', { op: 'invokestatic', arg: ['Method', 'cn', ['a', '(IIIZ)Z']] }),
    item('L35', { op: 'ifeq', arg: 'LTAIL' }),
    item('L36', { op: 'goto', arg: 'LCANON' }),
    item('LALT', 'return'),
    item('LREDRAW', 'return'),
    item('LTAIL', 'return'),
    item('LEXIT', 'return'),
  ]);
  const result = withDuplicateDrainHeader(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should canonicalize duplicate drain headers');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems[0].instruction.arg, 'LCANON');
  assert.equal(codeItems[18].instruction.arg, 'LCANON');
}

{
  const codeItems = padded([
    item('L0', 'iconst_0'),
    item('L1', { op: 'istore', arg: '4' }),
    item('L2', { op: 'goto', arg: 'L10' }),
    item('L5', { op: 'iload', arg: '4' }),
    item('L6', { op: 'ifne', arg: 'L10' }),
    item('L10', { op: 'aload', arg: '4' }),
    item('L11', { op: 'iload', arg: '7' }),
    item('L12', 'iconst_m1'),
    item('L13', 'iastore'),
    item('L14', { op: 'iinc', arg: ['7', '1'] }),
    item('L15', { op: 'goto', arg: 'L5' }),
    item('L20', 'return'),
  ]);
  const result = withLoopEntry(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, false, 'must not clone tails reading an unassigned local at the forward source');
}

{
  const codeItems = padded([
    item('L0', 'iconst_0'),
    item('L1', { op: 'istore', arg: '4' }),
    item('L2', 'iconst_0'),
    item('L3', { op: 'istore', arg: '7' }),
    item('L4', { op: 'goto', arg: 'L10' }),
    item('L5', { op: 'iload', arg: '4' }),
    item('L6', { op: 'ifne', arg: 'L10' }),
    item('L10', { op: 'aload', arg: '4' }),
    item('L11', { op: 'iload', arg: '7' }),
    item('L12', 'iconst_m1'),
    item('L13', 'iastore'),
    item('L14', { op: 'iinc', arg: ['7', '1'] }),
    item('L15', { op: 'goto', arg: 'L5' }),
    item('L20', 'return'),
  ]);
  const result = withLoopEntry(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, false, 'must not clone legacy body-entry tails outside the validated header shape');
}

{
  const codeItems = padded([
    item('L0', 'iconst_0'),
    item('L1', { op: 'istore', arg: '1' }),
    item('L2', { op: 'iload', arg: '1' }),
    item('L3', { op: 'ifeq', arg: 'L10' }),
    item('L4', 'iconst_1'),
    item('L5', { op: 'istore', arg: '2' }),
    item('L10', 'aload_0'),
    item('L11', { op: 'getfield', arg: ['Field', 'C', ['n', 'I']] }),
    item('L12', 'iconst_4'),
    item('L13', { op: 'if_icmpge', arg: 'L30' }),
    item('L14', 'aload_0'),
    item('L15', 'iconst_0'),
    item('L16', { op: 'putfield', arg: ['Field', 'C', ['n', 'I']] }),
    item('L17', { op: 'iinc', arg: ['1', '1'] }),
    item('L18', { op: 'goto', arg: 'L10' }),
    item('L30', 'return'),
  ]);
  assert.equal(runStructuredGotoClone(astFrom(cloneItems(codeItems))).changed, false, 'loop-entry clone must be opt-in');
  const result = withLoopEntry(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should clone validated single-forward-entry loop headers');
  assert.ok(result.rewrites >= 1);
}

{
  const source = item('LENTRY', { op: 'goto', arg: 'LUPDATE' });
  source.stackMapFrame = { frameType: 'same' };
  const codeItems = padded([
    source,
    item('LBEFORE', 'iconst_0'),
    item('LOUTER', { op: 'iload', arg: '1' }),
    item('L3', { op: 'ifeq', arg: 'LINNER' }),
    item('L4', 'iconst_0'),
    item('L5', { op: 'istore', arg: '2' }),
    item('LINNER', { op: 'iload', arg: '2' }),
    item('L7', { op: 'ifge', arg: 'LEXIT' }),
    item('L8', 'iconst_1'),
    item('L9', { op: 'istore', arg: '3' }),
    item('L10', { op: 'goto', arg: 'LINNER' }),
    item('LUPDATE', { op: 'iinc', arg: ['2', '1'] }),
    item('L12', 'iconst_0'),
    item('L13', { op: 'istore', arg: '3' }),
    item('L14', { op: 'goto', arg: 'LOUTER' }),
    item('LEXIT', 'return'),
  ]);
  const ast = astFrom(codeItems, { localsSize: '4' });
  const result = withOneShotPreheader(() => runStructuredGotoClone(ast));
  const code = ast.classes[0].items[0].method.attributes[0].code;
  assert.equal(result.changed, true, 'should rewrite one-shot preheader update entries');
  assert.equal(result.rewrites, 1);
  assert.equal(code.localsSize, '5', 'fresh one-shot guard local must extend localsSize instead of reusing a live local');
  assert.equal(codeItems[0].instruction, 'iconst_1');
  assert.deepEqual(codeItems[0].stackMapFrame, { frameType: 'same' });
  assert.deepEqual(codeItems[1].instruction, { op: 'istore', arg: '4' });
  assert.deepEqual(codeItems[2].instruction, { op: 'goto', arg: 'LOUTER' });
  const outerIndex = codeItems.findIndex((entry) => entry.labelDef === 'LOUTER:');
  assert.ok(outerIndex > 0, 'rewritten outer header should remain labelled');
  assert.deepEqual(codeItems[outerIndex].instruction, { op: 'iload', arg: '4' });
  assert.deepEqual(codeItems[outerIndex + 1].instruction, { op: 'ifeq', arg: 'LCKOSP_0' });
  assert.deepEqual(codeItems[outerIndex + 4].instruction, { op: 'goto', arg: 'LUPDATE' });
  assert.equal(codeItems[outerIndex + 5].labelDef, 'LCKOSP_0:');
}

{
  const codeItems = padded([
    item('LENTRY', 'iconst_0'),
    item('LBRANCH', { op: 'ifeq', arg: 'LSHARED' }),
    item('LFALL', 'iconst_1'),
    item('L3', { op: 'istore', arg: '1' }),
    item('L4', 'return'),
    item('LSHARED', 'iconst_2'),
    item('L6', { op: 'istore', arg: '1' }),
    item('L7', 'return'),
    item('LSECOND', { op: 'goto', arg: 'LSHARED' }),
  ]);
  const result = withBoundedConditionalTails(() => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should clone bounded terminal tail behind a terminal fallthrough block');
  assert.equal(codeItems[1].instruction.op, 'ifne');
  assert.equal(codeItems[1].instruction.arg, 'LFALL');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBCT_')), 'cloned tail should define renamed labels');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LSECOND:').instruction.arg, 'LSHARED', 'other shared-tail users must continue to target the original region');
}

{
  const codeItems = padded([
    item('LHEAD', { op: 'aload', arg: '10' }),
    item('LIF', { op: 'ifnonnull', arg: 'LCACHED' }),
    item('LMISS', { op: 'aload', arg: '3' }),
    item('L3', { op: 'astore', arg: '10' }),
    item('L4', { op: 'goto', arg: 'LJOIN' }),
    item('LCACHED', { op: 'aload', arg: '10' }),
    item('L6', { op: 'invokevirtual', arg: ['Method', 'cache', ['touch', '()V']] }),
    item('L7', { op: 'goto', arg: 'LJOIN' }),
    item('LJOIN', 'return'),
    item('LOTHER', { op: 'goto', arg: 'LCACHED' }),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_HBB_CACHED_LOOKUP_CONTINUATION: '1',
    STRUCTURED_GOTO_HBB_CACHED_LOOKUP_CONTINUATION_TARGETS: 'hbb.a(Lbmb;ILasb;ILkka;)Z',
  }, () => runStructuredGotoClone(targetAstFrom('hbb', 'a', '(Lbmb;ILasb;ILkka;)Z', codeItems)));
  assert.equal(result.changed, true, 'should clone hbb cached lookup continuation tail');
  assert.equal(result.rewrites, 1);
  assert.deepEqual(codeItems[1].instruction, { op: 'ifnull', arg: 'LMISS' });
  assert.ok(codeItems[2].labelDef && codeItems[2].labelDef.startsWith('LCKHBB_'), 'hbb clone should be inserted before the miss path');
  assert.deepEqual(codeItems[2].instruction, { op: 'aload', arg: '10' });
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LOTHER:').instruction.arg, 'LCACHED', 'other shared cached-tail users must keep the original label');
}

{
  const codeItems = padded([
    item('LHEAD', { op: 'iload', arg: '11' }),
    item('L1', { op: 'iload', arg: '1' }),
    item('L2', { op: 'if_icmpge', arg: 'LDONE' }),
    item('L3', { op: 'aload', arg: '4' }),
    item('L4', { op: 'ifnull', arg: 'LINC' }),
    item('L5', { op: 'aload', arg: '5' }),
    item('L6', { op: 'ifnonnull', arg: 'LINC' }),
    item('L7', { op: 'goto', arg: 'LINC' }),
    item('LFALL', 'iconst_0'),
    item('LINC', { op: 'iinc', arg: ['11', '1'] }),
    item('LBACK', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_UCA_SHARED_LOOP_INCREMENT_TAIL: '1',
    STRUCTURED_GOTO_UCA_SHARED_LOOP_INCREMENT_TAIL_TARGETS: 'uca.a(Z[Lrba;Lsg;[Lit;[Lsg;Z)V',
  }, () => runStructuredGotoClone(targetAstFrom('uca', 'a', '(Z[Lrba;Lsg;[Lit;[Lsg;Z)V', codeItems)));
  assert.equal(result.changed, true, 'should clone uca shared local-11 increment tail');
  assert.equal(result.rewrites, 3);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'L4:').instruction, { op: 'ifnonnull', arg: 'L5' });
  assert.ok(codeItems.filter((entry) => entry.labelDef && entry.labelDef.startsWith('LCKUCA_')).length >= 3, 'uca clones should get private labels');
  assert.ok(codeItems.filter((entry) => JSON.stringify(entry.instruction) === JSON.stringify({ op: 'iinc', arg: ['11', '1'] })).length >= 4, 'uca shared increment should be cloned for each pre-tail branch');
}

{
  const codeItems = padded([
    item('LHEAD', { op: 'iload', arg: '2' }),
    item('L1', { op: 'ifge', arg: 'LDONE' }),
    item('L2', { op: 'iload', arg: '3' }),
    item('L3', { op: 'ifeq', arg: 'LINC' }),
    item('L4', { op: 'goto', arg: 'LINC' }),
    item('LINC', { op: 'iinc', arg: ['2', '1'] }),
    item('LBACK', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_VOIDHUNTERS_SHARED_LOOP_INCREMENT_TAILS: '1',
    STRUCTURED_GOTO_VOIDHUNTERS_SHARED_LOOP_INCREMENT_TAIL_TARGETS: 'roa.<init>(Lpf;Lcbb;IIII)V',
  }, () => runStructuredGotoClone(targetAstFrom('roa', '<init>', '(Lpf;Lcbb;IIII)V', codeItems)));
  assert.equal(result.changed, true, 'voidhunters shared loop-increment clone must run for targeted constructors');
  assert.ok(result.rewrites >= 2);
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSLI_')), 'constructor-targeted loop increment clones should be labelled privately');
  assert.ok(codeItems.filter((entry) => JSON.stringify(entry.instruction) === JSON.stringify({ op: 'iinc', arg: ['2', '1'] })).length >= 3, 'constructor-targeted loop increment should be cloned');
}



{
  const codeItems = padded([
    item('L0', { op: 'aload', arg: '16' }),
    item('LIFNULL', { op: 'ifnull', arg: 'LTAIL' }),
    item('LWORK', 'iconst_1'),
    item('LSTORE', { op: 'istore', arg: '7' }),
    item('LGOTO', { op: 'goto', arg: 'LTAIL' }),
    item('LTAIL', 'iload_3'),
    item('L6', { op: 'bipush', arg: '-11' }),
    item('L7', { op: 'if_icmpeq', arg: 'LRET' }),
    item('L8', 'aload_0'),
    item('L9', 'aconst_null'),
    item('L10', { op: 'checkcast', arg: 'lw' }),
    item('L11', 'iconst_0'),
    item('L12', 'aconst_null'),
    item('L13', { op: 'checkcast', arg: 'sg' }),
    item('L14', { op: 'astore', arg: '13' }),
    item('L15', { op: 'bipush', arg: '80' }),
    item('L16', 'iconst_1'),
    item('L17', { op: 'invokespecial', arg: ['Method', 'uca', ['a', '(Llw;ZLsg;IZ)V']] }),
    item('LRET', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_VH_UCA_SHARED_RETURN_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('uca', 'b', '(ILrsb;III)V', codeItems)));
  assert.equal(result.changed, true, 'should clone VoidHunters uca shared return tail');
  assert.equal(result.rewrites, 2);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LIFNULL:').instruction.op, 'ifnonnull');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKVHUCARETT_')), 'uca return-tail clone should use private labels');
}

{
  const codeItems = padded([
    item('L0', { op: 'iload', arg: '63' }),
    item('L1', { op: 'ifne', arg: 'LCMP2' }),
    item('L2', { op: 'if_icmpgt', arg: 'LSKIP' }),
    item('L3', { op: 'goto', arg: 'LOK' }),
    item('LCMP2', { op: 'if_icmpgt', arg: 'LFALL' }),
    item('LGO', { op: 'goto', arg: 'LINIT' }),
    item('LOK', 'return'),
    item('LHEAD', { op: 'iload', arg: '16' }),
    item('L8', 'iconst_m1'),
    item('L9', 'ixor'),
    item('L10', { op: 'iload', arg: '18' }),
    item('L11', 'iconst_m1'),
    item('L12', 'ixor'),
    item('L13', { op: 'if_icmpgt', arg: 'LFALL' }),
    item('LINIT', 'aload_0'),
    item('L15', { op: 'getfield', arg: ['Field', 'roa', ['a', '[[I']] }),
    item('L16', { op: 'iload', arg: '18' }),
    item('L17', { op: 'aload', arg: '92' }),
    item('L18', { op: 'iload', arg: '18' }),
    item('L19', 'iaload'),
    item('L20', { op: 'newarray', arg: 'int' }),
    item('L21', 'aastore'),
    item('L22', { op: 'aload', arg: '92' }),
    item('L23', { op: 'iload', arg: '18' }),
    item('L24', 'iconst_0'),
    item('L25', 'iastore'),
    item('L26', { op: 'iinc', arg: ['18', '1'] }),
    item('L27', { op: 'iload', arg: '63' }),
    item('L28', { op: 'ifne', arg: 'LNEXT' }),
    item('L29', { op: 'iload', arg: '63' }),
    item('L30', { op: 'ifeq', arg: 'LHEAD' }),
    item('LFALL', 'iconst_0'),
    item('L32', { op: 'istore', arg: '18' }),
    item('LNEXT', 'return'),
    item('LSKIP', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_VH_ROA_Y_BUCKET_INIT: '1',
  }, () => runStructuredGotoClone(targetAstFrom('roa', '<init>', '(Lpf;Lcbb;IIII)V', codeItems)));
  assert.equal(result.changed, true, 'should clone VoidHunters roa y-bucket initialization tail');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LGO:').instruction, { op: 'goto', arg: 'LINIT' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKVHROABKT_')), 'roa bucket clone should use private labels');
}

{
  const codeItems = padded([
    item('L0', 'aload_3'),
    item('L1', { op: 'getfield', arg: ['Field', 'co', ['wf_n', 'Lln;']] }),
    item('L2', { op: 'getfield', arg: ['Field', 'ln', ['x', 'I']] }),
    item('L3', 'iconst_m1'),
    item('L4', 'ixor'),
    item('L5', 'aload_3'),
    item('L6', { op: 'getfield', arg: ['Field', 'co', ['wf_n', 'Lln;']] }),
    item('L7', { op: 'getfield', arg: ['Field', 'ln', ['N', 'I']] }),
    item('L8', 'iconst_m1'),
    item('L9', 'ixor'),
    item('L10', { op: 'if_icmplt', arg: 'LDO' }),
    item('LSKIP', { op: 'goto', arg: 'LCONT' }),
    item('LDO', 'iconst_0'),
    item('L13', { op: 'istore', arg: '4' }),
    item('L14', { op: 'goto', arg: 'LLATCH' }),
    item('LCONT', 'iload_2'),
    item('L16', 'iconst_m1'),
    item('L17', 'ixor'),
    item('L18', { op: 'istore', arg: '2' }),
    item('LLATCH', 'aload_0'),
    item('L20', { op: 'getfield', arg: ['Field', 'hi', ['hi_l', 'Lpf;']] }),
    item('L21', { op: 'bipush', arg: '-71' }),
    item('L22', { op: 'invokevirtual', arg: ['Method', 'pf', ['a', '(B)Loh;']] }),
    item('L23', { op: 'checkcast', arg: 'co' }),
    item('L24', { op: 'astore', arg: '3' }),
    item('L25', { op: 'goto', arg: 'L0' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHATTERED_PLANS_HI_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('hi', 'd', '(B)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Shattered Plans hi shared continuation');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LSKIP:').instruction, { op: 'goto', arg: 'LCONT' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSPHI_')), 'hi continuation clone should use private labels');
}

{
  const codeItems = padded([
    item('L0', 'iconst_0'),
    item('L1', { op: 'getstatic', arg: ['Field', 'em', ['em_h', 'I']] }),
    item('L2', { op: 'if_icmpeq', arg: 'LFALL' }),
    item('L3', { op: 'goto', arg: 'LJOIN' }),
    item('LFALL', 'iconst_1'),
    item('L5', { op: 'istore', arg: '7' }),
    item('L6', { op: 'goto', arg: 'LDONE' }),
    item('LJOIN', { op: 'new', arg: 'java/lang/StringBuilder' }),
    item('L8', 'dup'),
    item('L9', { op: 'invokespecial', arg: ['Method', 'java/lang/StringBuilder', ['<init>', '()V']] }),
    item('L10', { op: 'astore', arg: '20' }),
    item('L11', { op: 'goto', arg: 'LDONE' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHATTERED_PLANS_LE_PREFIX_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('le', 'a', '(IIZ)Z', codeItems)));
  assert.equal(result.changed, true, 'should inline Shattered Plans le prefix continuation');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'L3:').instruction, { op: 'goto', arg: 'LJOIN' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSPLE_')), 'le clone should use private labels');
}

{
  const codeItems = padded([
    item('LHEAD1', { op: 'iload', arg: '10' }),
    item('L1', { op: 'getstatic', arg: ['Field', 'nl', ['nl_a', '[I']] }),
    item('L2', 'arraylength'),
    item('L3', { op: 'if_icmpge', arg: 'LEXIT' }),
    item('L4', 'dup'),
    item('L5', { op: 'getfield', arg: ['Field', 'sg', ['qr_bb', 'Z']] }),
    item('L6', 'iconst_m1'),
    item('L7', 'ixor'),
    item('L8', { op: 'if_icmpne', arg: 'LFALSE' }),
    item('L9', 'iconst_1'),
    item('L10', { op: 'goto', arg: 'LMERGE' }),
    item('LOTHER', 'iconst_0'),
    item('L12', { op: 'istore', arg: '9' }),
    item('LHEAD2', { op: 'iload', arg: '10' }),
    item('L14', { op: 'getstatic', arg: ['Field', 'nl', ['nl_a', '[I']] }),
    item('L15', 'arraylength'),
    item('L16', { op: 'if_icmpge', arg: 'LEXIT' }),
    item('L17', 'dup'),
    item('L18', { op: 'getfield', arg: ['Field', 'sg', ['qr_bb', 'Z']] }),
    item('L19', { op: 'if_icmpne', arg: 'LFALSE' }),
    item('L20', 'iconst_1'),
    item('L21', { op: 'goto', arg: 'LMERGE' }),
    item('LFALSE', 'iconst_0'),
    item('LMERGE', 'iand'),
    item('L24', { op: 'putfield', arg: ['Field', 'sg', ['qr_bb', 'Z']] }),
    item('L25', { op: 'iinc', arg: ['10', '1'] }),
    item('L26', { op: 'goto', arg: 'LHEAD2' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHATTERED_PLANS_SC_SHARED_BOOLEAN_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('sc', 'a', '(IZLfb;I)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Shattered Plans sc shared boolean loop tail');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L8:').instruction.arg, 'LFALSE');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L10:').instruction.arg, 'LMERGE');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSPSC_')), 'sc clone should use private labels');
}

{
  const codeItems = padded([
    item('LHEAD', 'aconst_null'),
    item('L1', { op: 'aload', arg: '22' }),
    item('L2', { op: 'if_acmpeq', arg: 'LDONE' }),
    item('L3', { op: 'aload', arg: '22' }),
    item('L4', { op: 'bipush', arg: '-80' }),
    item('L5', { op: 'invokevirtual', arg: ['Method', 'mj', ['h', '(I)Z']] }),
    item('L6', { op: 'ifeq', arg: 'LFALL' }),
    item('L7', { op: 'goto', arg: 'LADV' }),
    item('LFALL', 'iconst_0'),
    item('L9', { op: 'istore', arg: '16' }),
    item('L10', { op: 'goto', arg: 'LDONE' }),
    item('LADV', { op: 'aload', arg: '17' }),
    item('L12', { op: 'bipush', arg: '-71' }),
    item('L13', { op: 'invokevirtual', arg: ['Method', 'pf', ['a', '(B)Loh;']] }),
    item('L14', { op: 'checkcast', arg: 'mj' }),
    item('L15', { op: 'astore', arg: '22' }),
    item('L16', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHATTERED_PLANS_UO_ITERATOR_ADVANCE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('uo', 'a', '(BZIZZ)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Shattered Plans uo iterator advance tail');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'L7:').instruction, { op: 'goto', arg: 'LADV' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSPUOADV_')), 'uo iterator clone should use private labels');
}

{
  const codeItems = padded([
    item('L0', { op: 'invokestatic', arg: ['Method', 'RenamedFormatter', ['format', '(Ljava/lang/String;I[Ljava/lang/String;)Ljava/lang/String;']] }),
    item('L1', { op: 'putstatic', arg: ['Field', 'RenamedMessage', ['text', 'Ljava/lang/String;']] }),
    item('L2', { op: 'goto', arg: 'LEXIT' }),
    item('LFALL', 'return'),
    item('LEXIT', { op: 'getstatic', arg: ['Field', 'RenamedClock', ['stamp', 'J']] }),
    item('L5', { op: 'ldc2_w', arg: '-1L' }),
    item('L6', 'lxor'),
    item('L7', { op: 'ldc2_w', arg: '-1L' }),
    item('L8', 'lcmp'),
    item('L9', { op: 'ifeq', arg: 'LRET' }),
    item('L10', 'iconst_0'),
    item('L11', 'istore_1'),
    item('L12', { op: 'goto', arg: 'LRET' }),
    item('LRET', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_MESSAGE_EXIT_TAIL: '1',
    STRUCTURED_GOTO_SHATTERED_PLANS_UO_MESSAGE_EXIT: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'message-exit tail should be cloned by descriptor shape, not class-name gates');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'L2:').instruction, { op: 'goto', arg: 'LEXIT' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSPUOEXIT_')), 'uo exit clone should use private labels');
}

{
  const codeItems = padded([
    item('L0', { op: 'iload', arg: '13' }),
    item('L1', 'iconst_m1'),
    item('L2', 'ixor'),
    item('L3', { op: 'iload', arg: '10' }),
    item('L4', 'iconst_m1'),
    item('L5', 'ixor'),
    item('L6', { op: 'if_icmple', arg: 'LDONE' }),
    item('L7', 'return'),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHATTERED_PLANS_DC_NOT_COMPARE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('dc', 'c', '(B)V', codeItems)));
  assert.equal(result.changed, true, 'should simplify Shattered Plans dc two-sided not compare');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'L6:').instruction, { op: 'if_icmpge', arg: 'LDONE' });
  assert.equal(codeItems.some((entry) => entry.instruction === 'ixor'), false);
}


{
  const codeItems = padded([
    item('LENTRY0', { op: 'iload', arg: '13' }),
    item('LENTRY1', { op: 'iload', arg: '18' }),
    item('LENTRYIF', { op: 'if_icmplt', arg: 'LEARLY' }),
    item('LFALL', 'return'),
    item('LHEAD', { op: 'iload', arg: '13' }),
    item('LHEAD1', { op: 'iload', arg: '18' }),
    item('LHEADIF', { op: 'if_icmplt', arg: 'LDUP' }),
    item('LRET', 'return'),
    item('LEARLY', 'iconst_0'),
    item('LEARLYSTORE', { op: 'istore', arg: '20' }),
    item('LEARLYJUMP', { op: 'goto', arg: 'LBODY' }),
    item('LDUP', 'iconst_0'),
    item('LDUPSTORE', { op: 'istore', arg: '20' }),
    item('LDUPJUMP', { op: 'goto', arg: 'LBODY' }),
    item('LBODY', { op: 'iload', arg: '20' }),
    item('LBODYIF', { op: 'ifeq', arg: 'LDONE' }),
    item('LBACK', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_36CARD_VJ_BLUR_LOOP_HEADER: '1',
  }, () => runStructuredGotoClone(targetAstFrom('vj', 'a', '([IIIIIIIII)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget detached raster blur loop entry to real header');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LENTRYIF:').instruction, { op: 'if_icmplt', arg: 'LHEAD' });
}

{
  const codeItems = padded([
    item('LENTRY0', { op: 'iload', arg: '13' }),
    item('LENTRY1', { op: 'iload', arg: '18' }),
    item('LENTRYIF', { op: 'if_icmplt', arg: 'LEARLY' }),
    item('LFALL', 'return'),
    item('LHEAD', { op: 'iload', arg: '13' }),
    item('LHEAD1', { op: 'iload', arg: '18' }),
    item('LHEADIF', { op: 'if_icmplt', arg: 'LDUP' }),
    item('LRET', 'return'),
    item('LEARLY', 'iconst_0'),
    item('LEARLYSTORE', { op: 'istore', arg: '20' }),
    item('LEARLYJUMP', { op: 'goto', arg: 'LBODY' }),
    item('LDUP', 'iconst_0'),
    item('LDUPSTORE', { op: 'istore', arg: '20' }),
    item('LDUPJUMP', { op: 'goto', arg: 'LBODY' }),
    item('LBODY', { op: 'iload', arg: '20' }),
    item('LBODYIF', { op: 'ifeq', arg: 'LDONE' }),
    item('LBACK', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER: '1',
    STRUCTURED_GOTO_36CARD_VJ_BLUR_LOOP_HEADER: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '([IIIIIIIII)V', codeItems)));
  assert.equal(result.changed, true, 'generic raster blur loop should not depend on class or method name');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LENTRYIF:').instruction, { op: 'if_icmplt', arg: 'LHEAD' });
}



{
  const codeItems = padded([
    item('LOUTER', 'iconst_0'),
    item('L1', { op: 'istore', arg: '8' }),
    item('LHEAD', { op: 'aload', arg: '46' }),
    item('L3', { op: 'iload', arg: '9' }),
    item('L4', 'aaload'),
    item('L5', { op: 'astore', arg: '29' }),
    item('L6', { op: 'aload', arg: '29' }),
    item('L7', 'iconst_0'),
    item('L8', 'iaload'),
    item('L9', { op: 'iload', arg: '28' }),
    item('L10', { op: 'if_icmpgt', arg: 'LINC' }),
    item('L11', { op: 'iload', arg: '28' }),
    item('L12', { op: 'aload', arg: '29' }),
    item('L13', 'iconst_1'),
    item('L14', 'iaload'),
    item('L15', { op: 'if_icmpgt', arg: 'LINC' }),
    item('LGO', { op: 'goto', arg: 'LOUTER' }),
    item('LINC', { op: 'iinc', arg: ['9', '1'] }),
    item('L18', { op: 'iload', arg: '9' }),
    item('L19', { op: 'iload', arg: '12' }),
    item('L20', { op: 'if_icmpge', arg: 'LRESET' }),
    item('L21', { op: 'goto', arg: 'LHEAD' }),
    item('LRESET', 'iconst_0'),
    item('L23', { op: 'istore', arg: '9' }),
    item('L24', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'should localize array-membership outer-continue exits without class-name gates');
  const localized = codeItems.find((entry) => entry.labelDef === 'LGO:').instruction.arg;
  assert.notEqual(localized, 'LOUTER');
  const localizedIndex = codeItems.findIndex((entry) => entry.labelDef === `${localized}:`);
  assert.ok(localizedIndex > 0, 'localized continuation label should be inserted after the loop');
  assert.deepEqual(codeItems[localizedIndex].instruction, { op: 'iload', arg: '9' });
  assert.deepEqual(codeItems[localizedIndex + 1].instruction, { op: 'istore', arg: '9' });
  assert.deepEqual(codeItems[localizedIndex + 2].instruction, { op: 'goto', arg: 'LOUTER' });
}

{
  const codeItems = padded([
    item('LHEAD', { op: 'iload', arg: '2' }),
    item('L1', { op: 'iflt', arg: 'LDONE' }),
    item('LKEEPREF', { op: 'goto', arg: 'LREF' }),
    item('L2', { op: 'iload', arg: '3' }),
    item('LBRANCH', { op: 'ifeq', arg: 'LTAIL' }),
    item('LREF', { op: 'goto', arg: 'LTAIL' }),
    item('LTAIL', { op: 'iinc', arg: ['2', '1'] }),
    item('L7', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAILS: '1',
    STRUCTURED_GOTO_VOIDHUNTERS_SHARED_LOOP_INCREMENT_TAILS: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared loop-increment cloning should preserve labels on replaced gotos');
  const preserved = codeItems.find((entry) => entry.labelDef === 'LREF:');
  assert.ok(preserved, 'replaced goto label must remain a valid branch target');
  assert.ok(codeItems.some((entry) => entry.labelDef === 'LKEEPREF:'), 'upstream labels that used the replaced branch should also stay valid');
}



{
  const codeItems = padded([
    item('LPRELOAD', { op: 'iload', arg: '1' }),
    item('LPREBR', { op: 'ifeq', arg: 'LSTART' }),
    item('LFALL', 'return'),
    item('LSTART', { op: 'aload', arg: '10' }),
    item('LNULL', { op: 'ifnull', arg: 'LEXIT' }),
    item('LFLAG', { op: 'iload', arg: '7' }),
    item('LZEROIF', { op: 'ifeq', arg: 'LZERO' }),
    item('LSTATIC', { op: 'getstatic', arg: ['Field', 'AnyFlags', ['ready', 'Z']] }),
    item('LCWIF', { op: 'ifne', arg: 'LCW' }),
    item('LBYTE', { op: 'bipush', arg: '124' }),
    item('LINVOKE', { op: 'invokestatic', arg: ['Method', 'AnyHooks', ['hit', '(B)V']] }),
    item('LFLAG2', { op: 'iload', arg: '7' }),
    item('LMERGEIF', { op: 'ifne', arg: 'LMERGE' }),
    item('LOTHER', { op: 'iload', arg: '6' }),
    item('LOTHERIF', { op: 'ifne', arg: 'LZERO' }),
    item('LZERO', { op: 'getstatic', arg: ['Field', 'AnyRenderer', ['surface', 'LRender;']] }),
    item('LZ0', 'iconst_0'),
    item('LZ1', 'iconst_0'),
    item('LZCALL', { op: 'invokevirtual', arg: ['Method', 'Render', ['paint', '(II)V']] }),
    item('LZGOTO', { op: 'goto', arg: 'LMERGE' }),
    item('LCW', { op: 'getstatic', arg: ['Field', 'AnyRenderer', ['surface', 'LRender;']] }),
    item('LCW1', 'iconst_1'),
    item('LCWCALL', { op: 'invokevirtual', arg: ['Method', 'Render', ['flip', '(Z)V']] }),
    item('LMERGE', { op: 'iload', arg: '5' }),
    item('LPUT', { op: 'putstatic', arg: ['Field', 'AnyFlags', ['ready', 'Z']] }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared render continuation should be shape gated, not class-name gated');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSRC_')), 'shared render continuation clone should get private labels');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LPREBR:').instruction, { op: 'ifne', arg: 'LFALL' });
}



{
  const codeItems = padded([
    item('LVAL', { op: 'iload', arg: '4' }),
    item('LNOT', 'iconst_m1'),
    item('LXOR', 'ixor'),
    item('LM1', 'iconst_m1'),
    item('LBR', { op: 'if_icmpne', arg: 'LTRUE' }),
    item('LFALSE', 'return'),
    item('LTRUE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'one-sided ~x != -1 compare should simplify without class-name gates');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBR:').instruction, { op: 'ifne', arg: 'LTRUE' });
}

{
  const codeItems = padded([
    item('LSETUP', { op: 'aload', arg: '0' }),
    item('L1', { op: 'getfield', arg: ['Field', 'Owner', ['items', '[LElem;']] }),
    item('LSTORE_FIRST_ARRAY', { op: 'astore', arg: '22' }),
    item('LZERO', 'iconst_0'),
    item('LIDX', { op: 'istore', arg: '9' }),
    item('LDUP_HEAD', { op: 'aload', arg: '22' }),
    item('LDUP_LEN', 'arraylength'),
    item('LDUP_IDX', { op: 'iload', arg: '9' }),
    item('LDUP_EXIT', { op: 'if_icmple', arg: 'LDONE' }),
    item('LDUP_ARRAY', { op: 'aload', arg: '22' }),
    item('LDUP_IDX2', { op: 'iload', arg: '9' }),
    item('LDUP_LOAD', 'aaload'),
    item('LDUP_STORE_ELEM', { op: 'astore', arg: '23' }),
    item('LDUP_ONE', 'iconst_1'),
    item('LDUP_ELEM', { op: 'aload', arg: '23' }),
    item('LDUP_CAST', { op: 'checkcast', arg: 'Elem' }),
    item('LDUP_FIELD', { op: 'getfield', arg: ['Field', 'Elem', ['x', 'I']] }),
    item('LDUP_SHL', 'ishl'),
    item('LDUP_THIS', { op: 'aload', arg: '0' }),
    item('LDUP_MASK', { op: 'getfield', arg: ['Field', 'Owner', ['mask', 'I']] }),
    item('LDUP_AND', 'iand'),
    item('LDUP_NOT1', 'iconst_m1'),
    item('LDUP_XOR', 'ixor'),
    item('LDUP_NOT2', 'iconst_m1'),
    item('LDUP_BODY_IF', { op: 'if_icmpeq', arg: 'LBODY' }),
    item('LDUP_INC', { op: 'iinc', arg: ['9', '1'] }),
    item('LDUP_GO_SHARED', { op: 'goto', arg: 'LSHARED_HEAD' }),
    item('LBODY', 'iconst_0'),
    item('LBODY_STORE', { op: 'istore', arg: '7' }),
    item('LSHARED_SETUP', { op: 'aload', arg: '0' }),
    item('LSHARED_FIELD', { op: 'getfield', arg: ['Field', 'Owner', ['items', '[LElem;']] }),
    item('LSHARED_ARRAY_STORE', { op: 'astore', arg: '18' }),
    item('LSHARED_HEAD', { op: 'aload', arg: '18' }),
    item('LSHARED_LEN', 'arraylength'),
    item('LSHARED_IDX', { op: 'iload', arg: '9' }),
    item('LSHARED_EXIT', { op: 'if_icmple', arg: 'LDONE' }),
    item('LSHARED_ARRAY', { op: 'aload', arg: '18' }),
    item('LSHARED_IDX2', { op: 'iload', arg: '9' }),
    item('LSHARED_LOAD', 'aaload'),
    item('LSHARED_STORE_ELEM', { op: 'astore', arg: '25' }),
    item('LSHARED_ALIAS_LOAD', { op: 'aload', arg: '25' }),
    item('LSHARED_ALIAS_STORE', { op: 'astore', arg: '10' }),
    item('LSHARED_ONE', 'iconst_1'),
    item('LSHARED_ELEM', { op: 'aload', arg: '25' }),
    item('LSHARED_CAST', { op: 'checkcast', arg: 'Elem' }),
    item('LSHARED_FIELD2', { op: 'getfield', arg: ['Field', 'Elem', ['x', 'I']] }),
    item('LSHARED_SHL', 'ishl'),
    item('LSHARED_THIS', { op: 'aload', arg: '0' }),
    item('LSHARED_MASK', { op: 'getfield', arg: ['Field', 'Owner', ['mask', 'I']] }),
    item('LSHARED_AND', 'iand'),
    item('LSHARED_NOT1', 'iconst_m1'),
    item('LSHARED_XOR', 'ixor'),
    item('LSHARED_NOT2', 'iconst_m1'),
    item('LSHARED_BODY_IF', { op: 'if_icmpeq', arg: 'LSHARED_BODY' }),
    item('LSHARED_INC', { op: 'iinc', arg: ['9', '1'] }),
    item('LSHARED_BACK', { op: 'goto', arg: 'LSHARED_HEAD' }),
    item('LSHARED_BODY', { op: 'aload', arg: '0' }),
    item('LSEED', { op: 'invokevirtual', arg: ['Method', 'java/util/Random', ['setSeed', '(J)V']] }),
    item('LCHOICE', { op: 'invokestatic', arg: ['Method', 'Chooser', ['pick', '(BILjava/util/Random;)I']] }),
    item('LFOUR', 'iconst_4'),
    item('LINNER_IDX', { op: 'iload', arg: '12' }),
    item('LINNER_EXIT', { op: 'if_icmple', arg: 'LOUTER_TAIL' }),
    item('LOUTER_TAIL', { op: 'iinc', arg: ['9', '1'] }),
    item('LOUTER_BACK', { op: 'goto', arg: 'LSHARED_HEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'duplicate array-loop headers should be canonicalized by shape, not class name');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LDUP_HEAD:').instruction, { op: 'goto', arg: 'LSHARED_HEAD' });
  const storeIndex = codeItems.findIndex((entry) => entry.labelDef === 'LSTORE_FIRST_ARRAY:');
  assert.deepEqual(codeItems[storeIndex + 1].instruction, { op: 'aload', arg: '22' });
  assert.deepEqual(codeItems[storeIndex + 2].instruction, { op: 'astore', arg: '18' });
}

function cloneItems(items) {
  return JSON.parse(JSON.stringify(items));
}

console.log('PASS structured-goto-clone selftest');
