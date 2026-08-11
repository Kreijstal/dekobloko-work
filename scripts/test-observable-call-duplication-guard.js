#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {findUnsafeMethods} = require('./find-unsafe-observable-call-duplications');

const invoke = (owner, name) => ({instruction: {
  op: 'invokestatic',
  arg: ['Method', owner, [name, '()V']],
}});
const method = (calls, handlers) => ({
  name: 'work',
  descriptor: '()V',
  attributes: [{type: 'code', code: {
    codeItems: calls,
    exceptionTable: Array.from({length: handlers}, () => ({
      catch_type: 'java/lang/RuntimeException',
    })),
  }}],
});
const cls = value => ({items: [{type: 'method', method: value}]});

const original = cls(method([invoke('a', 'first'), invoke('b', 'second')], 32));
const duplicated = cls(method([
  invoke('a', 'first'), invoke('a', 'first'),
  invoke('b', 'second'), invoke('b', 'second'), invoke('b', 'second'),
], 0));
assert.strictEqual(findUnsafeMethods(original, duplicated).length, 1,
  'multiple observable calls duplicated after handler removal require a safe retry');

const stillProtected = cls(method(duplicated.items[0].method.attributes[0].code.codeItems, 1));
assert.strictEqual(findUnsafeMethods(original, stillProtected).length, 0,
  'remaining runtime protection does not match the unsafe removal shape');

const ordinaryFragmentation = cls(method(
  original.items[0].method.attributes[0].code.codeItems, 31));
assert.strictEqual(findUnsafeMethods(ordinaryFragmentation, duplicated).length, 0,
  'ordinary handler fragmentation does not trigger a class-wide conservative retry');

const oneTarget = cls(method([
  invoke('a', 'first'), invoke('a', 'first'), invoke('a', 'first'), invoke('a', 'first'),
  invoke('b', 'second'),
], 0));
assert.strictEqual(findUnsafeMethods(original, oneTarget).length, 0,
  'one repeated call target alone is insufficient evidence of CFG-region duplication');

console.log('observable call duplication guard tests passed');
