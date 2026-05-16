'use strict';

const assert = require('assert');
const { inferQuadrants, runRasterClipContinuation } = require('./ckClipFlag');

function pair(prefix, xOp = 'iflt', yOp = 'ifge') {
  const x = `${prefix}x`;
  const y = `${prefix}y`;
  const scan = `${prefix}scan`;
  const done = `${prefix}done`;
  return [
    { labelDef: `${prefix}entry:`, instruction: 'return' },
    { labelDef: `${x}Start:`, instruction: 'dup' },
    { labelDef: `${x}Store:`, instruction: { op: 'istore', arg: '1' } },
    { labelDef: `${x}Cond:`, instruction: { op: xOp, arg: `${y}Start` } },
    { labelDef: `${x}Adjust:`, instruction: 'iconst_0' },
    { labelDef: `${x}Zero:`, instruction: { op: 'goto', arg: done } },
    { labelDef: `${y}Start:`, instruction: 'dup' },
    { labelDef: `${y}Store:`, instruction: { op: 'istore', arg: '2' } },
    { labelDef: `${y}Cond:`, instruction: { op: yOp, arg: scan } },
    { labelDef: `${y}Adjust:`, instruction: 'iconst_0' },
    { labelDef: `${y}Zero:`, instruction: { op: 'goto', arg: done } },
    { labelDef: `${scan}:`, instruction: 'iconst_1' },
    { labelDef: `${done}:`, instruction: 'return' },
  ];
}

function methodAst(pairCount) {
  const codeItems = [];
  for (let i = 0; i < pairCount; i += 1) codeItems.push(...pair(`Q${i}_`));
  return {
    classes: [{
      className: 'Raster',
      items: [{
        type: 'method',
        method: {
          name: 'draw',
          descriptor: '()V',
          attributes: [{
            type: 'code',
            code: {
              localsSize: '3',
              codeItems,
              exceptionTable: [],
              attributes: [],
            },
          }],
        },
      }],
    }],
  };
}

{
  const ast = methodAst(4);
  const code = ast.classes[0].items[0].method.attributes[0].code;
  assert.strictEqual(inferQuadrants(code.codeItems).length, 4);
  const result = runRasterClipContinuation(ast);
  assert.deepStrictEqual(result, { changed: true, fired: 4 });
  assert.strictEqual(code.localsSize, 4);
  assert.ok(code.codeItems.some((item) => item.instruction && item.instruction.op === 'ifeq'));
}

{
  const ast = methodAst(3);
  const code = ast.classes[0].items[0].method.attributes[0].code;
  assert.strictEqual(inferQuadrants(code.codeItems).length, 3);
  const result = runRasterClipContinuation(ast);
  assert.deepStrictEqual(result, { changed: false, fired: 0 });
  assert.strictEqual(code.localsSize, '3');
}

