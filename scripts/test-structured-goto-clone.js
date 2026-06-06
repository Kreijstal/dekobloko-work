#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { runStructuredGotoClone } = require('./pipeline/structuredGotoClone');

function item(label, instruction) {
  const out = {};
  if (label) out.labelDef = `${label}:`;
  if (instruction !== undefined) out.instruction = instruction;
  return out;
}

function astFrom(codeItems) {
  return {
    classes: [{
      items: [{
        type: 'method',
        method: {
          name: 'm',
          attributes: [{ type: 'code', code: { codeItems } }],
        },
      }],
    }],
  };
}

function padded(codeItems) {
  while (codeItems.length < 20) codeItems.push(item(`LPAD${codeItems.length}`, null));
  return codeItems;
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

function cloneItems(items) {
  return JSON.parse(JSON.stringify(items));
}

console.log('PASS structured-goto-clone selftest');
