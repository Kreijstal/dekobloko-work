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
