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

// A conditional's explicit goto-to-return trampoline is a semantic boundary
// for the later terminal-tail transforms. Collapsing it exposed a live sibling
// block in Brick-a-Brac km.a(ZZI)V as apparent terminal padding, deleting the
// menu hit-test call. Direct gotos can still bypass the same trampoline.
{
  const conditional = padded([
    item('LLOAD', 'iload_1'),
    item('LBRANCH', { op: 'ifeq', arg: 'LTRAMP' }),
    item('LLIVE', 'iconst_1'),
    item(null, 'pop'),
    item(null, 'return'),
    item('LTRAMP', { op: 'goto', arg: 'LRETURN' }),
    item('LRETURN', 'return'),
  ]);
  const conditionalResult = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '1',
  }, () => runStructuredGotoClone(astFrom(conditional)));
  assert.equal(conditionalResult.rewrites, 0,
    'conditional terminal trampolines must remain explicit');
  assert.equal(conditional[1].instruction.arg, 'LTRAMP');

  const direct = padded([
    item('LDIRECT', { op: 'goto', arg: 'LTRAMP' }),
    item('LTRAMP', { op: 'goto', arg: 'LRETURN' }),
    item('LRETURN', 'return'),
  ]);
  const directResult = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '1',
  }, () => runStructuredGotoClone(astFrom(direct)));
  assert.equal(directResult.rewrites, 1,
    'unconditional terminal trampolines should still be collapsed');
  assert.equal(direct[0].instruction.arg, 'LRETURN');

  const nonTerminal = padded([
    item('LLOAD', 'iload_1'),
    item('LBRANCH', { op: 'ifeq', arg: 'LTRAMP' }),
    item('LLIVE', 'iconst_1'),
    item(null, 'pop'),
    item(null, 'return'),
    item('LTRAMP', { op: 'goto', arg: 'LCONTINUE' }),
    item('LCONTINUE', 'iconst_3'),
    item(null, 'istore_2'),
    item(null, 'return'),
  ]);
  const nonTerminalResult = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '1',
  }, () => runStructuredGotoClone(astFrom(nonTerminal)));
  assert.equal(nonTerminalResult.rewrites, 1,
    'conditional non-terminal trampolines should still be collapsed');
  assert.equal(nonTerminal[1].instruction.arg, 'LCONTINUE');
  const continuationIndex = nonTerminal.findIndex((entry) => entry.labelDef === 'LCONTINUE:');
  assert.notEqual(continuationIndex, -1, 'the non-terminal continuation must remain reachable');
  assert.equal(nonTerminal[continuationIndex].instruction, 'iconst_3',
    'the non-terminal continuation must remain intact');
  assert.equal(nonTerminal[continuationIndex + 1].instruction, 'istore_2',
    'the continuation store must remain intact');
}

// Brick-a-Brac qj.a(ZZI)V loads the selected gameplay theme on the fallthrough
// of a null check, then joins a shared conditional cleanup tail. After cloning
// that cleanup once, the transform used to treat its newly exposed,
// invoke-bearing fallthrough as a second tail and invert the null check again.
// The loader became unreachable and the title music played throughout games.
{
  const codeItems = padded([
    item('LNULL', 'aconst_null'),
    item(null, { op: 'getstatic', arg: ['Field', 'oa', ['Sb', 'Lki;']] }),
    item(null, { op: 'if_acmpeq', arg: 'LTAIL' }),
    item('LLOADPATH', { op: 'getstatic', arg: ['Field', 'oa', ['Sb', 'Lki;']] }),
    item(null, 'iconst_1'),
    item(null, { op: 'invokevirtual', arg: ['Method', 'ki', ['e', '(I)V']] }),
    item(null, { op: 'getstatic', arg: ['Field', 'oa', ['Sb', 'Lki;']] }),
    item(null, { op: 'getfield', arg: ['Field', 'ki', ['q', 'Z']] }),
    item(null, { op: 'ifeq', arg: 'LLOADTRACK' }),
    item(null, { op: 'goto', arg: 'LTAIL' }),
    item('LLOADTRACK', { op: 'getstatic', arg: ['Field', 'oa', ['Sb', 'Lki;']] }),
    item(null, { op: 'bipush', arg: '59' }),
    item(null, { op: 'invokevirtual', arg: ['Method', 'ki', ['d', '(I)V']] }),
    item('LTAIL', { op: 'getstatic', arg: ['Field', 'km', ['i', 'I']] }),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, 'iconst_m1'),
    item(null, { op: 'if_icmpge', arg: 'LEXIT' }),
    item(null, { op: 'getstatic', arg: ['Field', 'km', ['i', 'I']] }),
    item(null, 'iconst_1'),
    item(null, 'isub'),
    item(null, 'dup'),
    item(null, { op: 'putstatic', arg: ['Field', 'km', ['i', 'I']] }),
    item(null, 'iconst_0'),
    item(null, { op: 'if_icmpne', arg: 'LEXIT' }),
    item(null, 'aconst_null'),
    item(null, { op: 'putstatic', arg: ['Field', 'fq', ['c', '[Ljp;']] }),
    item(null, { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_CONDITIONAL_SIDE_EFFECT_EXIT_TAIL: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  const themeInvokes = codeItems.filter((entry) => {
    const insn = entry && entry.instruction;
    return insn && insn.op === 'invokevirtual' && Array.isArray(insn.arg) && insn.arg[1] === 'ki';
  });

  assert.equal(result.rewrites, 1, 'the shared cleanup tail should be cloned only once');
  assert.equal(codeItems[2].instruction.op, 'if_acmpne', 'the null guard should be inverted exactly once');
  assert.equal(codeItems[2].instruction.arg, 'LLOADPATH', 'the non-null path must still reach the theme loader');
  assert.equal(themeInvokes.length, 2, 'both gameplay-theme initialization calls must remain');
}

// Regression for issue #24: cloning a small iinc join immediately after its
// conditional must preserve the conditional's original fallthrough. The
// fallthrough store is loop-carried and consumed after the loop; making it
// unreachable leaves the running maximum at its -1 seed value.
{
  const codeItems = padded([
    item('LHEAD', { op: 'iload', arg: '1' }),
    item(null, { op: 'iload', arg: '2' }),
    item(null, { op: 'if_icmple', arg: 'LINC' }),
    item('LASSIGN', { op: 'iload', arg: '3' }),
    item(null, { op: 'istore', arg: '2' }),
    item('LINC', { op: 'iinc', arg: ['1', '1'] }),
    item(null, { op: 'goto', arg: 'LHEAD' }),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_CLONE_SMALL_IINC_JOIN: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));

  assert.equal(result.rewrites, 1, 'the small iinc join is cloned once');
  assert.equal(op(codeItems[2].instruction), 'if_icmpgt',
    'the branch is inverted so its old fallthrough jumps over the clone');
  assert.equal(codeItems[2].instruction.arg, 'LASSIGN',
    'the inverted branch targets the original fallthrough body');
  assert.equal(op(codeItems[3].instruction), 'iinc',
    'the original taken edge falls through into the cloned increment tail');
  assert.equal(op(codeItems[5].instruction), 'iload',
    'the loop-carried assignment remains reachable after the clone');
  assert.equal(op(codeItems[6].instruction), 'istore',
    'the loop-carried store is preserved');
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

// Regression for oj.b (issue #12): the complement idiom on a getstatic field
// with the constant pushed FIRST (`bipush -4; getstatic hd.n:I; iconst_m1;
// ixor; if_icmpeq`). The prior detector only handled value-first int-local
// shapes, so this corruption slipped through.
{
  const original = [
    item('LCONST', { op: 'bipush', arg: '-4' }),
    item(null, { op: 'getstatic', arg: ['Field', 'hd', ['n', 'I']] }),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'if_icmpeq', arg: 'LMATCH' }),
  ];
  const rewritten = cloneItems(original);
  rewritten.splice(2, 2); // drop iconst_m1; ixor -> `-4 == n` (wrong)
  assert.equal(countIntComplements(original), 1);
  assert.equal(restoreDroppedIntComplements(rewritten, original), true,
    'const-first getstatic complement drop should roll back the method');
  assert.deepEqual(rewritten, original);
  // Correctly folded to `n == 3` (constant complemented) must be retained.
  const equivalent = cloneItems(original);
  equivalent.splice(0, 4,
    item('LCONST', { op: 'getstatic', arg: ['Field', 'hd', ['n', 'I']] }),
    item(null, 'iconst_3'));
  assert.equal(restoreDroppedIntComplements(equivalent, original), false,
    'equivalent folded const-first comparison should be retained');
}

// Regression for issue #21: in.<init> compares -1 against the complement of a
// computed int[] element. Losing only `iconst_m1; ixor` changes the test from
// `cell == 0` to `cell == -1`, so field_q is never initialized.
{
  const original = [
    item('LCONST', 'iconst_m1'),
    item(null, 'aload_0'),
    item(null, { op: 'getfield', arg: ['Field', 'in', ['q', '[I']] }),
    item(null, { op: 'iload', arg: '10' }),
    item(null, { op: 'iload', arg: '4' }),
    item(null, 'imul'),
    item(null, { op: 'iload', arg: '11' }),
    item(null, 'iadd'),
    item(null, 'iaload'),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'if_icmpeq', arg: 'LPROCESS' }),
  ];
  const rewritten = cloneItems(original);
  rewritten.splice(9, 2);
  assert.equal(restoreDroppedIntComplements(rewritten, original), true,
    'computed int-array complement drop should roll back the method');
  assert.deepEqual(rewritten, original);

  // `-1 == ~cell` is exactly `0 == cell`; retaining that fold is safe.
  const equivalent = cloneItems(original);
  equivalent.splice(0, 1, item('LCONST', 'iconst_0'));
  equivalent.splice(9, 2);
  assert.equal(restoreDroppedIntComplements(equivalent, original), false,
    'equivalent computed int-array comparison should be retained');
}

// Regressions for the two-sided complement fold (8004973).
//
// simplifyTwoSidedNotCompares finds the `iconst_m1; ixor` pair feeding a
// comparison by scanning backwards up to 18 instructions. With no stack-depth
// or expression-boundary check it latched onto complements belonging to a
// completely different expression and deleted them, dropping a live `~`.
//
// lk.d(int,int) is the input rising-edge detector: `edges = ~this.A & param0`
// became `edges = this.A & param0`, so "newly pressed" turned into "still
// held" and holding a key rotated the piece every frame instead of once.
{
  const codeItems = padded([
    item('LENTRY', 'aload_0'),
    item(null, { op: 'getfield', arg: ['Field', 'lk', ['A', 'I']] }),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'iload', arg: '1' }),
    item(null, 'iand'),
    item(null, { op: 'istore', arg: '2' }),
    // Unrelated two-sided comparison. Its own complement is at i-2/i-1; the
    // backward scan used to reach past `iand`/`istore` and claim the `~this.A`
    // pair above as the branch's left operand.
    item(null, { op: 'iload', arg: '2' }),
    item(null, { op: 'iload', arg: '3' }),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'if_icmpgt', arg: 'LTGT' }),
    item(null, 'return'),
    item('LTGT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('lk', 'd', '(II)I', codeItems)));
  assert.equal(result.changed, false,
    'a complement from a neighbouring expression must not be folded away');
  assert.equal(countIntComplements(codeItems), 2,
    'both complements survive: the ~this.A operand and the comparison operand');
  assert.equal(opsOf(codeItems).slice(0, 6).join(','),
    'aload_0,getfield,iconst_m1,ixor,iload,iand',
    'the rising-edge detector still computes ~this.A & param0');
  assert.equal(codeItems.some((entry) => op(entry.instruction) === 'if_icmplt'), false,
    'the comparison is not inverted when the fold is declined');
}

// Positive direction: a genuine `~a OP ~b` must still fold, so the guard above
// cannot be satisfied by simply disabling the pass.
{
  const codeItems = padded([
    item('LENTRY', { op: 'iload', arg: '2' }),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'getstatic', arg: ['Field', 'hd', ['n', 'I']] }),
    item(null, 'iconst_m1'),
    item(null, 'ixor'),
    item(null, { op: 'if_icmpgt', arg: 'LTGT' }),
    item(null, 'return'),
    item('LTGT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('sk', 'a', '(II)I', codeItems)));
  assert.equal(result.changed, true,
    'a two-sided complement comparison is still simplified');
  assert.equal(countIntComplements(codeItems), 0, 'both complements are folded away');
  assert.equal(opsOf(codeItems).slice(0, 3).join(','), 'iload,getstatic,if_icmplt',
    'folding ~a > ~b inverts the comparison to a < b');
}

function op(instruction) {
  if (typeof instruction === 'string') return instruction;
  return instruction && instruction.op;
}

function opsOf(codeItems) {
  return codeItems.map((entry) => op(entry.instruction)).filter(Boolean);
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
    STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '0',
    STRUCTURED_GOTO_DUPLICATE_ARRAY_LENGTH_PRELOOP_ENTRY: '0',
    STRUCTURED_GOTO_SHARED_BOOLEAN_STORE_TARGET: '0',
    STRUCTURED_GOTO_PADDED_BOOLEAN_CONSTANT_TAIL: '0',
    STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_RANGE_BRANCHES: '0',
    STRUCTURED_GOTO_SHARED_LOOP_INCREMENT_TAILS: '0',
    STRUCTURED_GOTO_SHARED_FORWARD_CONTINUATIONS: '0',
    STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '0',
    STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAILS: '0',
    STRUCTURED_GOTO_SHARED_STRING_INDEX_RETRY_TAIL: '0',
    STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY: '0',
    STRUCTURED_GOTO_STATIC_INT_LOOP_FLAG_BRANCHES: '0',
    STRUCTURED_GOTO_RASTER_TOP_CLIP_SCANLINE_ENTRY: '0',
    STRUCTURED_GOTO_SIBLING_LOCAL_SCAN_BODIES: '0',
    STRUCTURED_GOTO_CACHED_LOOKUP_CONTINUATION: '0',
    STRUCTURED_GOTO_OBJECT_LOOP_INCREMENT_TAIL: '0',
    STRUCTURED_GOTO_OBJECT_SHARED_RETURN_TAIL: '0',
    STRUCTURED_GOTO_ENTITY_LOOP_CONTINUATION: '0',
    STRUCTURED_GOTO_MENU_LOOP_CONTINUATION: '0',
    STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAILS: '0',
    STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL: '0',
    STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION: '0',
    STRUCTURED_GOTO_PREFIX_CONTINUATION: '0',
    STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL: '0',
    STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL: '0',
    STRUCTURED_GOTO_MESSAGE_EXIT_TAIL: '0',
    STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE: '0',
    STRUCTURED_GOTO_ONE_SIDED_NOT_COMPARE: '0',
    STRUCTURED_GOTO_STACK_SHIFT_STORE_TAIL: '0',
    STRUCTURED_GOTO_DUPLICATE_CARD_LOOP_CLEANUP: '0',
    STRUCTURED_GOTO_STACK_COMPARE_TAILS: '0',
    STRUCTURED_GOTO_CARD_SECOND_HAND_LOOP: '0',
    STRUCTURED_GOTO_CARD_LOOP_FALLBACK: '0',
    STRUCTURED_GOTO_SHARED_ICON_LOOP: '0',
    STRUCTURED_GOTO_EARLY_FINAL_LOOP_EXIT: '0',
    STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES: '0',
    STRUCTURED_GOTO_ARRAY_MEMBERSHIP_OUTER_CONTINUE: '0',
    STRUCTURED_GOTO_DUPLICATE_ARRAY_LOOP_HEADER_ALIAS: '0',
    STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION: '0',
    STRUCTURED_GOTO_NESTED_ARRAY_SCAN_INNER_CONTINUE: '0',
    STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER: '0',
    STRUCTURED_GOTO_EVENT_DRAIN_LOOP: '0',
    STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL: '0',
    STRUCTURED_GOTO_SHARED_STATIC_BOOLEAN_RENDER_RESTORE_TAIL: '0',
    STRUCTURED_GOTO_SHARED_STATIC_INVOKE_JOIN_TAIL: '0',
    STRUCTURED_GOTO_SHARED_FORWARD_BOOLEAN_PREDICATE_PREFIX: '0',
    STRUCTURED_GOTO_SHARED_STATIC_ZERO_PAIR_GOTO_RESET: '0',
    STRUCTURED_GOTO_ASSIGNMENT_GOTO_COMMON_TAIL: '0',
    STRUCTURED_GOTO_STRING_BUILDER_CHAR_APPEND_TAIL: '0',
    STRUCTURED_GOTO_SMALL_FORWARD_TERMINAL_GOTO_TAIL: '0',
    STRUCTURED_GOTO_FORWARD_CASE_JOIN_BODY: '0',
    STRUCTURED_GOTO_SHARED_FORWARD_EXIT_CONTINUATION: '0',
    STRUCTURED_GOTO_CHECKED_LOOP_BODY_ENTRIES: '0',
    STRUCTURED_GOTO_INSTANCEOF_SUMMARY_BODY_CLONE: '0',
    STRUCTURED_GOTO_STACK_CARRIED_FORWARD_COMPARE_BODY: '0',
    STRUCTURED_GOTO_STACK_BOOLEAN_TERMINAL_GOTO: '0',
    STRUCTURED_GOTO_DUPLICATE_QUEUE_ENTRY_RETARGET: '0',
    STRUCTURED_GOTO_DUPLICATE_INITIAL_POSE_RETARGET: '0',
    STRUCTURED_GOTO_ITERATOR_BOOLEAN_TAIL: '0',
    STRUCTURED_GOTO_PRESENCE_BOOLEAN_TAIL: '0',
    STRUCTURED_GOTO_DUPLICATE_RADIUS_SCAN_RETARGET: '0',
    STRUCTURED_GOTO_BASE38_DUPLICATE_ENCODER_ENTRY: '0',
    STRUCTURED_GOTO_CHAT_WIDTH_TAILS: '0',
    STRUCTURED_GOTO_BASE38_BOOLEAN_DUPLICATE_ENCODER_ENTRY: '0',
    STRUCTURED_GOTO_EVENT_ACTION_TAIL: '0',
    STRUCTURED_GOTO_OBJECT_MERGE_LOOP_RETARGET: '0',
    STRUCTURED_GOTO_RENDERER_DISPATCH_BODY: '0',
    STRUCTURED_GOTO_GRID_TILE_UPDATE_CONTINUE: '0',
    STRUCTURED_GOTO_STATE_UPDATE_CREATION_BODY: '0',
    STRUCTURED_GOTO_TARGETED_BASE38_DECREMENT_TAIL: '0',
    STRUCTURED_GOTO_DISABLE_BACKWARD_TAIL: '0',
    STRUCTURED_GOTO_COLUMN_CONTINUE_SPLITTER: '0',
    STRUCTURED_GOTO_STATE_BRIDGES: '0',
    STRUCTURED_GOTO_INVALID_ENTRY_TAIL: '0',
    STRUCTURED_GOTO_TARGETED_CANONICAL_IINC_CONTINUES: '0',
    STRUCTURED_GOTO_FORWARD_IINC_CONTINUES: '0',
    STRUCTURED_GOTO_DUPLICATE_INT_GUARD_ALIAS: '0',
    STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET: '0',
    STRUCTURED_GOTO_CHECKED_LOOP_BODY_SUFFIX_ENTRIES: '0',
    STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_CONSTANT_TAIL: '0',
    STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_STORE_TARGET: '0',
    STRUCTURED_GOTO_CONDITIONAL_INT_CONSTANT_COMPARE_BOUND: '0',
    STRUCTURED_GOTO_CONDITIONAL_INT_LOCAL_COPY_TARGET: '0',
    STRUCTURED_GOTO_CONST_FALSE_COMPARE_INTERRUPTERS: '0',
    STRUCTURED_GOTO_DISABLE_OPTION_CONTINUE_TAIL: '0',
    STRUCTURED_GOTO_DUPLICATE_DUMMY_GUARD_BODY: '0',
    STRUCTURED_GOTO_DUPLICATE_GRID_SCAN_CONTINUES: '0',
    STRUCTURED_GOTO_DUPLICATE_HALVE_SETUP_TAIL: '0',
    STRUCTURED_GOTO_DUPLICATE_RADIX_PARSER_LOOP: '0',
    STRUCTURED_GOTO_DUPLICATE_SELECTOR_PARTIAL_SETUP: '0',
    STRUCTURED_GOTO_EVENT_LOOP_ACTION_TAIL_CLONE: '0',
    STRUCTURED_GOTO_FORWARD_GOTO_LOOP_BODY: '0',
    STRUCTURED_GOTO_FORWARD_LOOP_SUFFIX_ENTRY: '0',
    STRUCTURED_GOTO_INVARIANT_FLAG_FORWARD_EXIT: '0',
    STRUCTURED_GOTO_ITERATOR_PROCESS_GUARD: '0',
    STRUCTURED_GOTO_ITERATOR_PROCESS_GUARD_DEBUG: '0',
    STRUCTURED_GOTO_NULL_GUARD_INVARIANT_FLAG_FORWARD_EXIT: '0',
    STRUCTURED_GOTO_ONESHOT_DEBUG: '0',
    STRUCTURED_GOTO_PAIRED_PREDICATE_RESULT_TAIL: '0',
    STRUCTURED_GOTO_QUEUE_DRAIN_CONTINUATION: '0',
    STRUCTURED_GOTO_RASTER_ROW_SCAN_HEADER_CLONE: '0',
    STRUCTURED_GOTO_REMOVE_DEAD_ATHROW_PADDING: '0',
    STRUCTURED_GOTO_RETARGET_GOTO_TRAMPOLINES: '0',
    STRUCTURED_GOTO_SHARED_BOOLEAN_CONSTANT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_BOOLEAN_PREDICATE_SELECTOR_TAIL: '0',
    STRUCTURED_GOTO_SHARED_BOOLEAN_SELECTOR_TAIL: '0',
    STRUCTURED_GOTO_SHARED_CONDITIONAL_RENDER_TAIL: '0',
    STRUCTURED_GOTO_SHARED_CONDITIONAL_SIDE_EFFECT_EXIT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_FALLTHROUGH_CONTINUATION_TAIL: '0',
    STRUCTURED_GOTO_SHARED_GUARDED_SIDE_EFFECT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_INSTANCE_ASSIGNMENT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_INT_ADVANCE_SELECTOR_TAIL: '0',
    STRUCTURED_GOTO_SHARED_INT_GUARDED_SIDE_EFFECT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_INT_PAIR_CONTINUATION: '0',
    STRUCTURED_GOTO_SHARED_INT_SELECTOR_INVOKE_TAIL: '0',
    STRUCTURED_GOTO_SHARED_NULL_ARRAY_ELEMENT_ASSIGNMENT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_NULL_FIELD_INVOKE_CONTINUATION: '0',
    STRUCTURED_GOTO_SHARED_NULL_STATIC_BOOLEAN_ASSIGNMENT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_RENDERER_BOOLEAN_SELECTOR: '0',
    STRUCTURED_GOTO_SHARED_RENDER_CHOICE_TAIL: '0',
    STRUCTURED_GOTO_SHARED_SIDE_EFFECT_GOTO_TAIL: '0',
    STRUCTURED_GOTO_SHARED_SIMPLE_INVOKE_GOTO_TAIL: '0',
    STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENTS_GOTO_TAIL: '0',
    STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_FALLTHROUGH_TAIL: '0',
    STRUCTURED_GOTO_SHARED_STATIC_ASSIGNMENT_TAIL: '0',
    STRUCTURED_GOTO_SHARED_STATIC_OBJECT_CLEAR_TAIL: '0',
    STRUCTURED_GOTO_SHARED_TERMINAL_TAIL: '0',
    STRUCTURED_GOTO_SIMPLIFY_CONSTANT_BRANCHES: '0',
    STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_EQUALITY_BRANCHES: '0',
    STRUCTURED_GOTO_STACK_BOOLEAN_RASTER_BODY: '0',
    STRUCTURED_GOTO_STACK_CARRIED_INVARIANT_FLAG_FORWARD_EXIT: '0',
    STRUCTURED_GOTO_STACK_COMPARE_CONTINUATION: '0',
    STRUCTURED_GOTO_STATE_ARRAY_ALLOCATION_TAIL: '0',
    STRUCTURED_GOTO_STRING_BASE38_SPLIT_TAIL: '0',
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
    item('LSEARCH', { op: 'iload', arg: '16' }),
    item('LSEARCH_TEST', { op: 'ifne', arg: 'LBOUNDARY_CHAR' }),
    item('LBOUNDARY_CHAR', { op: 'iload', arg: '4' }),
    item('LBOUNDARY_TEST', { op: 'ifne', arg: 'LRETRY' }),
    item('LHASH_CHAR', { op: 'bipush', arg: '35' }),
    item('LHASH_ACTUAL', { op: 'iload', arg: '5' }),
    item('LHASH_COMPARE', { op: 'if_icmpeq', arg: 'LKEEP' }),
    item('LGOTO_RETRY', { op: 'goto', arg: 'LRETRY' }),
    item('LRETRY', { op: 'aload', arg: '10' }),
    item('LPATTERN', { op: 'aload', arg: '14' }),
    item('LINDEX', { op: 'iload', arg: '16' }),
    item('LONE', 'iconst_m1'),
    item('LADD_ONE', 'isub'),
    item('LINDEXOF', { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['indexOf', '(Ljava/lang/String;I)I']] }),
    item('LSTORE_INDEX', { op: 'istore', arg: '16' }),
    item('LBACK', { op: 'goto', arg: 'LSEARCH' }),
    item('LKEEP', 'iconst_0'),
    item('LRET', 'ireturn'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_STRING_INDEX_RETRY_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()I', codeItems)));
  assert.equal(result.changed, true, 'shared string index retry tail should be cloned for branch and goto sources');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LRETRY').length, 0);
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKIDXRETRY_')));
}

{
  const codeItems = padded([
    item('LCHECK_A', { op: 'iload', arg: '3' }),
    item('LCHECK_OBJ_A', { op: 'aload', arg: '16' }),
    item('LCHECK_CAST_A', { op: 'checkcast', arg: 'Entry' }),
    item('LCHECK_FIELD_A', { op: 'getfield', arg: ['Field', 'Entry', ['left', 'B']] }),
    item('LBRANCH_SHARED', { op: 'if_icmpeq', arg: 'LUPDATE' }),
    item('LCHECK_B', { op: 'aload', arg: '16' }),
    item('LCHECK_CAST_B', { op: 'checkcast', arg: 'Entry' }),
    item('LCHECK_FIELD_B', { op: 'getfield', arg: ['Field', 'Entry', ['right', 'B']] }),
    item('LCHECK_MINUS', 'iconst_m1'),
    item('LCHECK_XOR', 'ixor'),
    item('LEXIT_BRANCH', { op: 'ifeq', arg: 'LCONTINUE' }),
    item('LGOTO_SHARED', { op: 'goto', arg: 'LUPDATE' }),
    item('LUPDATE', { op: 'iload', arg: '7' }),
    item('LSTORE_INDEX', { op: 'istore', arg: '9' }),
    item('LLOAD_VALUE', { op: 'iload', arg: '6' }),
    item('LSTORE_VALUE', { op: 'istore', arg: '10' }),
    item('LARRAY', { op: 'getstatic', arg: ['Field', 'Table', ['entries', '[LEntry;']] }),
    item('LINDEX', { op: 'iload', arg: '9' }),
    item('LALOAD', 'aaload'),
    item('LOBJ', { op: 'astore', arg: '15' }),
    item('LPUT_A_OBJ', { op: 'aload', arg: '15' }),
    item('LPUT_A_VAL', { op: 'iload', arg: '10' }),
    item('LPUT_A_BYTE', 'i2b'),
    item('LPUT_A', { op: 'putfield', arg: ['Field', 'Entry', ['left', 'B']] }),
    item('LPUT_B_OBJ', { op: 'aload', arg: '15' }),
    item('LPUT_B_VAL', { op: 'iload', arg: '3' }),
    item('LPUT_B_BYTE', 'i2b'),
    item('LPUT_B', { op: 'putfield', arg: ['Field', 'Entry', ['right', 'B']] }),
    item('LPUT_C_OBJ', { op: 'aload', arg: '15' }),
    item('LPUT_C_VAL', { op: 'iload', arg: '4' }),
    item('LPUT_C', { op: 'putfield', arg: ['Field', 'Entry', ['score', 'I']] }),
    item('LCONTINUE', { op: 'iload_1' }),
    item('LRETURN', 'ireturn'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_ARRAY_RECORD_UPDATE_BODY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()I', codeItems)));
  assert.equal(result.changed, true, 'shared array record update body should be cloned for both sources');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LUPDATE').length, 0);
  assert.equal(codeItems.filter((entry) => entry.labelDef && entry.labelDef.startsWith('LCKARRREC_')).length > 0, true);
}

{
  const codeItems = padded([
    item('LCHECK_ZERO', 'iconst_0'),
    item('LLOAD_STATE', { op: 'aload_0' }),
    item('LGET_STATE', { op: 'getfield', arg: ['Field', 'Actor', ['stateTicks', 'I']] }),
    item('LIF_ZERO', { op: 'if_icmpeq', arg: 'LSETUP' }),
    item('LGOTO_TAIL', { op: 'goto', arg: 'LUPDATE_TAIL' }),
    item('LSETUP', { op: 'aload_0' }),
    item('LSETUP_STATE', 'iconst_1'),
    item('LSETUP_PUT', { op: 'putfield', arg: ['Field', 'Actor', ['mode', 'I']] }),
    item('LROUND_CHECK', 'iconst_5'),
    item('LROUND_LOAD', { op: 'getstatic', arg: ['Field', 'Round', ['number', 'I']] }),
    item('LROUND_DONE', { op: 'if_icmpne', arg: 'LUPDATE_TAIL' }),
    item('LEXIT_FINAL', { op: 'goto', arg: 'LDONE' }),
    item('LUPDATE_TAIL', { op: 'aload_0' }),
    item('LTAIL_GET', { op: 'getfield', arg: ['Field', 'Actor', ['stateTicks', 'I']] }),
    item('LTAIL_LIMIT', { op: 'bipush', arg: '-101' }),
    item('LTAIL_BRANCH', { op: 'if_icmplt', arg: 'LTAIL_SET_MODE' }),
    item('LTAIL_SKIP_SET', { op: 'goto', arg: 'LTAIL_INC' }),
    item('LTAIL_SET_MODE', { op: 'aload_0' }),
    item('LTAIL_ZERO', 'iconst_0'),
    item('LTAIL_MODE_PUT', { op: 'putfield', arg: ['Field', 'Actor', ['mode', 'I']] }),
    item('LTAIL_INC', { op: 'aload_0' }),
    item('LTAIL_DUP', 'dup'),
    item('LTAIL_GET_AGAIN', { op: 'getfield', arg: ['Field', 'Actor', ['stateTicks', 'I']] }),
    item('LTAIL_TWO', 'iconst_2'),
    item('LTAIL_ADD', 'iadd'),
    item('LTAIL_PUT', { op: 'putfield', arg: ['Field', 'Actor', ['stateTicks', 'I']] }),
    item('LTAIL_EXIT', { op: 'goto', arg: 'LDONE' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_INSTANCE_INT_UPDATE_TAILS: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared instance int update tail should be cloned at the bridge goto');
  assert.equal(result.rewrites, 1);
  const replacedGoto = codeItems.findIndex((entry) => entry.labelDef === 'LGOTO_TAIL:');
  assert.equal(codeItems[replacedGoto + 1].instruction.op, 'aload_0');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKIIU_')));
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LDONE').length, 3);
}

{
  const codeItems = padded([
    item('LNULL_A', 'aconst_null'),
    item('LLOAD_A', { op: 'aload', arg: '5' }),
    item('LFIELD_A', { op: 'getfield', arg: ['Field', 'tw', ['tw_d', 'Lso;']] }),
    item('LIF_A', { op: 'if_acmpne', arg: 'LNONNULL_A' }),
    item('LTRUE_A', 'iconst_1'),
    item('LGOTO_JOIN_A', { op: 'goto', arg: 'LLOAD_B' }),
    item('LNONNULL_A', 'iconst_0'),
    item('LLOAD_B', { op: 'aload', arg: '5' }),
    item('LFIELD_B', { op: 'getfield', arg: ['Field', 'tw', ['tw_d', 'Lso;']] }),
    item('LIF_B', { op: 'ifnonnull', arg: 'LNONNULL_B' }),
    item('LTRUE_B', 'iconst_1'),
    item('LGOTO_JOIN_B', { op: 'goto', arg: 'LJOIN_B' }),
    item('LNONNULL_B', 'iconst_0'),
    item('LJOIN_B', 'ixor'),
    item('LBRANCH', { op: 'ifne', arg: 'LCHANGED' }),
    item('LFALL', 'return'),
    item('LCHANGED', 'iconst_1'),
    item('LRETURN', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_CHANGE_LOG_TAIL: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should simplify duplicate null-XOR change detectors with ifne polarity');
  assert.deepEqual(codeItems[0].instruction, { op: 'aload', arg: '5' });
  assert.deepEqual(codeItems[1].instruction, { op: 'getfield', arg: ['Field', 'tw', ['tw_d', 'Lso;']] });
  assert.equal(codeItems[2].instruction, 'pop');
  assert.equal(codeItems[3].instruction.op, 'goto');
  assert.equal(codeItems[3].instruction.arg, 'LFALL', 'ifne replacement should jump to the not-taken fallthrough');
  assert.equal(codeItems.find((entry) => entry.labelDef === `${codeItems[3].instruction.arg}:`).instruction, 'return');
}

{
  const codeItems = padded([
    item('LOUTER_HEAD', { op: 'iload', arg: '12' }),
    item('L1', { op: 'getstatic', arg: ['Field', 'ncb', ['ncb_a', '[[I']] }),
    item('L2', 'arraylength'),
    item('L3', { op: 'if_icmpge', arg: 'LDONE' }),
    item('L4', { op: 'getstatic', arg: ['Field', 'ncb', ['ncb_a', '[[I']] }),
    item('L5', { op: 'iload', arg: '12' }),
    item('L6', 'aaload'),
    item('L7', { op: 'astore', arg: '27' }),
    item('L8', 'iconst_0'),
    item('L9', { op: 'istore', arg: '14' }),
    item('LINNER_HEAD', { op: 'aload', arg: '27' }),
    item('L11', 'arraylength'),
    item('L12', { op: 'iload', arg: '14' }),
    item('L13', { op: 'if_icmple', arg: 'LAFTER_INNER' }),
    item('L14', { op: 'aload', arg: '27' }),
    item('L15', { op: 'iload', arg: '14' }),
    item('L16', 'iaload'),
    item('L17', { op: 'istore', arg: '15' }),
    item('L18', { op: 'aload', arg: '27' }),
    item('L19', { op: 'iload', arg: '14' }),
    item('L20', 'iconst_1'),
    item('L21', 'iadd'),
    item('L22', 'iaload'),
    item('L23', { op: 'istore', arg: '16' }),
    item('L24', { op: 'sipush', arg: '255' }),
    item('L25', { op: 'getstatic', arg: ['Field', 'lqa', ['lqa_o', 'Lmm;']] }),
    item('L26', { op: 'getfield', arg: ['Field', 'mm', ['Pb', '[B']] }),
    item('L27', { op: 'iload', arg: '15' }),
    item('L28', 'baload'),
    item('L29', 'iand'),
    item('L30', { op: 'iload', arg: '16' }),
    item('L31', { op: 'if_icmpeq', arg: 'LINNER_CONT' }),
    item('LOUTER_CONT', { op: 'iinc', arg: ['12', '1'] }),
    item('L33', { op: 'goto', arg: 'LOUTER_HEAD' }),
    item('LINNER_CONT', { op: 'iinc', arg: ['14', '2'] }),
    item('L35', { op: 'goto', arg: 'LINNER_HEAD' }),
    item('LAFTER_INNER', 'return'),
    item('LDONE', 'return'),
    item('LOTHER_REF', { op: 'goto', arg: 'LINNER_CONT' }),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_NESTED_ARRAY_SCAN_INNER_CONTINUE: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should clone nested array-scan inner continue tails');
  assert.equal(result.rewrites, 1);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L31:').instruction.arg, 'LINNER_CONT');
  const clone = codeItems.find((entry) => entry.labelDef === `${codeItems.find((entry) => entry.labelDef === 'L31:').instruction.arg}:`);
  assert.ok(clone, 'cloned inner continue tail should define the new branch target');
  assert.deepEqual(clone.instruction, { op: 'iinc', arg: ['14', '2'] });
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LOTHER_REF:').instruction.arg, 'LINNER_CONT');
}

{
  const codeItems = padded([
    item('LOUTER_HEAD', { op: 'iload', arg: '9' }),
    item('L1', { op: 'getstatic', arg: ['Field', 'ncb', ['ncb_a', '[[I']] }),
    item('L2', 'arraylength'),
    item('L3', { op: 'if_icmpge', arg: 'LDONE' }),
    item('L4', { op: 'getstatic', arg: ['Field', 'ncb', ['ncb_a', '[[I']] }),
    item('L5', { op: 'iload', arg: '9' }),
    item('L6', 'aaload'),
    item('L7', { op: 'astore', arg: '21' }),
    item('LALIAS_A', { op: 'aload', arg: '21' }),
    item('LALIAS_B', { op: 'astore', arg: '20' }),
    item('LALIAS_C', { op: 'aload', arg: '20' }),
    item('LALIAS_D', { op: 'astore', arg: '19' }),
    item('LALIAS_E', { op: 'aload', arg: '19' }),
    item('LALIAS_F', { op: 'astore', arg: '17' }),
    item('LALIAS_G', { op: 'aload', arg: '17' }),
    item('LALIAS_H', { op: 'astore', arg: '10' }),
    item('LALIAS_I', 'iconst_0'),
    item('LALIAS_J', { op: 'istore', arg: '11' }),
    item('L8', 'iconst_0'),
    item('L9', { op: 'istore', arg: '12' }),
    item('LINNER_HEAD', { op: 'aload', arg: '21' }),
    item('L11', 'arraylength'),
    item('L12', { op: 'iload', arg: '12' }),
    item('L13', { op: 'if_icmple', arg: 'LAFTER_INNER' }),
    item('L14', { op: 'aload', arg: '21' }),
    item('L15', { op: 'iload', arg: '12' }),
    item('L16', 'iaload'),
    item('L17', { op: 'istore', arg: '13' }),
    item('L18', { op: 'aload', arg: '21' }),
    item('L19', { op: 'iload', arg: '12' }),
    item('L20', 'iconst_1'),
    item('L21', 'iadd'),
    item('L22', 'iaload'),
    item('L23', { op: 'istore', arg: '14' }),
    item('L24', { op: 'sipush', arg: '255' }),
    item('L25', { op: 'getstatic', arg: ['Field', 'tib', ['tib_i', '[B']] }),
    item('L26', { op: 'iload', arg: '13' }),
    item('L27', 'baload'),
    item('L28', 'iand'),
    item('L29', { op: 'iload', arg: '14' }),
    item('L30', { op: 'if_icmpeq', arg: 'LINNER_CONT' }),
    item('LOUTER_CONT', { op: 'iinc', arg: ['9', '1'] }),
    item('L32', { op: 'goto', arg: 'LOUTER_HEAD' }),
    item('LINNER_CONT', { op: 'iinc', arg: ['12', '2'] }),
    item('L34', { op: 'goto', arg: 'LINNER_HEAD' }),
    item('LAFTER_INNER', 'return'),
    item('LDONE', 'return'),
    item('LOTHER_REF', { op: 'goto', arg: 'LINNER_CONT' }),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_NESTED_ARRAY_SCAN_INNER_CONTINUE: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should clone nested array-scan inner continue tails with direct static byte arrays');
  assert.equal(result.rewrites, 1);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L30:').instruction.arg, 'LINNER_CONT');
  const clone = codeItems.find((entry) => entry.labelDef === `${codeItems.find((entry) => entry.labelDef === 'L30:').instruction.arg}:`);
  assert.ok(clone, 'direct static byte-array compare should get a cloned inner continue tail');
  assert.deepEqual(clone.instruction, { op: 'iinc', arg: ['12', '2'] });
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LOTHER_REF:').instruction.arg, 'LINNER_CONT');
}

{
  const codeItems = padded([
    item('LLOAD_A', { op: 'aload', arg: '7' }),
    item('LFLAGS_A', { op: 'iload', arg: '8' }),
    item('LONE_A', 'iconst_1'),
    item('LAND_A', 'iand'),
    item('LIFEQ_A', { op: 'ifeq', arg: 'LFALSE' }),
    item('LTRUE_A', 'iconst_1'),
    item('LGOTO_PUT_A', { op: 'goto', arg: 'LPUT' }),
    item('LSEP', { op: 'aload', arg: '7' }),
    item('LFLAGS_B', { op: 'iload', arg: '8' }),
    item('LONE_B', 'iconst_1'),
    item('LAND_B', 'iand'),
    item('LIFEQ_B', { op: 'ifeq', arg: 'LFALSE' }),
    item('LTRUE_B', 'iconst_1'),
    item('LGOTO_PUT_B', { op: 'goto', arg: 'LPUT' }),
    item('LFALSE', 'iconst_0'),
    item('LPUT', { op: 'putfield', arg: ['Field', 'bs', ['Zb', 'Z']] }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_PRESENCE_BOOLEAN_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('tq', 'a', '(B)V', codeItems)));
  assert.equal(result.changed, true, 'should clone presence boolean tails');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIFEQ_A:').instruction.op, 'ifne');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIFEQ_A:').instruction.arg, 'LTRUE_A');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIFEQ_A:').instruction.op, 'ifne');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIFEQ_B:').instruction.arg, 'LFALSE');
}

{
  const codeItems = padded([
    item('LENTRY_A', { op: 'ifeq', arg: 'LTRAMP' }),
    item('LENTRY_B', { op: 'if_icmpge', arg: 'LTRAMP' }),
    item('LSKIP', { op: 'goto', arg: 'LDONE' }),
    item('LTRAMP', { op: 'getstatic', arg: ['Field', 'kl', ['kl_c', '[I']] }),
    item('LTRAMP_GOTO', { op: 'goto', arg: 'LSTORE' }),
    item('LCANON', { op: 'getstatic', arg: ['Field', 'kl', ['kl_c', '[I']] }),
    item('LSTORE', { op: 'iload', arg: '19' }),
    item('LSTORE_VALUE', { op: 'iload', arg: '20' }),
    item('LIASTORE', 'iastore'),
    item('LBACK', { op: 'goto', arg: 'LCANON' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_QUEUE_ENTRY_RETARGET: '1',
  }, () => runStructuredGotoClone(targetAstFrom('pc', 'a', '(I)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget Hostile Spawn duplicate queue entry');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LENTRY_A:').instruction.arg, 'LCANON');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LENTRY_B:').instruction.arg, 'LCANON');
  assert.equal(codeItems.some((entry) => entry.labelDef === 'LTRAMP:'), false);
}

{
  const poseBlock = (prefix, exit) => [
    item(`${prefix}_A`, 'aload_0'),
    item(`${prefix}_B`, { op: 'sipush', arg: '740' }),
    item(`${prefix}_C`, { op: 'putfield', arg: ['Field', 'gf', ['gf_f', 'I']] }),
    item(`${prefix}_D`, 'aload_0'),
    item(`${prefix}_E`, { op: 'sipush', arg: '450' }),
    item(`${prefix}_F`, { op: 'putfield', arg: ['Field', 'gf', ['E', 'I']] }),
    item(`${prefix}_G`, 'aload_0'),
    item(`${prefix}_H`, { op: 'bipush', arg: '-50' }),
    item(`${prefix}_I`, { op: 'putfield', arg: ['Field', 'gf', ['gf_n', 'I']] }),
    item(`${prefix}_J`, 'aload_0'),
    item(`${prefix}_K`, 'iconst_0'),
    item(`${prefix}_L`, { op: 'putfield', arg: ['Field', 'gf', ['gf_e', 'I']] }),
    item(`${prefix}_M`, { op: 'goto', arg: exit }),
  ];
  const codeItems = padded([
    item('LEARLY_A', { op: 'if_icmpeq', arg: 'LLATE_A' }),
    item('LEARLY_B', { op: 'if_icmpeq', arg: 'LLATE_A' }),
    item('LID_24', { op: 'if_icmpne', arg: 'LMID' }),
    ...poseBlock('LFIRST', 'LEXIT'),
    item('LMID', { op: 'if_icmpeq', arg: 'LLATE_A' }),
    ...poseBlock('LLATE', 'LEXIT'),
    item('LDEFAULT', 'return'),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_INITIAL_POSE_RETARGET: '1',
  }, () => runStructuredGotoClone(targetAstFrom('gf', '<init>', '(IDDDDDDI)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget Dr Phlogiston gf duplicate initial pose');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LEARLY_A:').instruction.arg, 'LFIRST_A');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LEARLY_B:').instruction.arg, 'LFIRST_A');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LMID:').instruction.arg, 'LLATE_A');
}

{
  const codeItems = padded([
    item('LRECV_A', { op: 'aload', arg: '2' }),
    item('LWH_N_A', { op: 'getfield', arg: ['Field', 'wh', ['wh_n', 'Ltg;']] }),
    item('LFLAG_A', 'iload_1'),
    item('LBRANCH_A', { op: 'ifne', arg: 'LFALSE' }),
    item('LTRUE_A', 'iconst_1'),
    item('LGOTO_CALL_A', { op: 'goto', arg: 'LCALL' }),
    item('LRECV_B', { op: 'aload', arg: '2' }),
    item('LWH_N_B', { op: 'getfield', arg: ['Field', 'wh', ['wh_n', 'Ltg;']] }),
    item('LFLAG_B', 'iload_1'),
    item('LBRANCH_B', { op: 'ifne', arg: 'LFALSE' }),
    item('LTRUE_B', 'iconst_1'),
    item('LGOTO_CALL_B', { op: 'goto', arg: 'LCALL' }),
    item('LFALSE', 'iconst_0'),
    item('LCALL', { op: 'invokevirtual', arg: ['Method', 'tg', ['a', '(Z)Lpi;']] }),
    item('LAFTER', { op: 'checkcast', arg: 'qf' }),
    item('LSTORE', { op: 'astore', arg: '8' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_ITERATOR_BOOLEAN_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('di', 'a', '(ZLwh;Lri;ILbj;)Z', codeItems)));
  assert.equal(result.changed, true, 'should clone Miner Disturbance iterator boolean tail');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH_A:').instruction.op, 'ifeq');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH_A:').instruction.arg, 'LTRUE_A');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH_B:').instruction.arg, 'LFALSE');
}

{
  const radiusSetup = (prefix) => [
    item(`${prefix}_START`, { op: 'getstatic', arg: ['Field', 'uc', ['uc_d', '[[I']] }),
    item(`${prefix}_LOAD`, { op: 'iload', arg: '4' }),
    item(`${prefix}_AALOAD`, 'aaload'),
    item(`${prefix}_SEVEN`, { op: 'bipush', arg: '7' }),
    item(`${prefix}_IALOAD`, 'iaload'),
    item(`${prefix}_STORE6`, { op: 'istore', arg: '6' }),
    item(`${prefix}_LOAD6`, { op: 'iload', arg: '6' }),
    item(`${prefix}_STORE8`, { op: 'istore', arg: '8' }),
    item(`${prefix}_INNER`, { op: 'iinc', arg: '11 1' }),
    item(`${prefix}_BACK`, { op: 'goto', arg: `${prefix}_INNER` }),
  ];
  const codeItems = padded([
    item('LA_CHECK', { op: 'if_icmpne', arg: 'LA_END' }),
    ...radiusSetup('LA'),
    item('LA_END', { op: 'iload', arg: '8' }),
    item('LB_CHECK', { op: 'if_icmpne', arg: 'LB_END' }),
    ...radiusSetup('LB'),
    item('LB_END', { op: 'bipush', arg: '50' }),
    item('LC_CHECK', { op: 'if_icmpne', arg: 'LC_END' }),
    ...radiusSetup('LC'),
    item('LC_END', { op: 'iload', arg: '8' }),
    item('LCANON', { op: 'getstatic', arg: ['Field', 'uc', ['uc_d', '[[I']] }),
    item('LCANON_LOAD', { op: 'iload', arg: '4' }),
    item('LCANON_AALOAD', 'aaload'),
    item('LCANON_SEVEN', { op: 'bipush', arg: '7' }),
    item('LCANON_IALOAD', 'iaload'),
    item('LCANON_STORE6', { op: 'istore', arg: '6' }),
    item('LCANON_LOAD6', { op: 'iload', arg: '6' }),
    item('LCANON_STORE8', { op: 'istore', arg: '8' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_RADIUS_SCAN_RETARGET: '1',
  }, () => runStructuredGotoClone(targetAstFrom('ej', 'a', '(ZII)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget Armies of Gielinor duplicate radius scans');
  assert.equal(result.rewrites, 3);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LA_START:').instruction.arg, 'LCANON');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LB_START:').instruction.arg, 'LCANON');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LC_START:').instruction.arg, 'LCANON');
}

{
  const encoderEntry = (prefix) => [
    item(`${prefix}_ZERO_A`, 'lconst_0'),
    item(`${prefix}_STORE3`, 'lstore_3'),
    item(`${prefix}_ZERO_B`, 'lconst_0'),
    item(`${prefix}_STORE5`, { op: 'lstore', arg: '5' }),
    item(`${prefix}_ALOAD1`, 'aload_1'),
    item(`${prefix}_LEN`, { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['length', '()I']] }),
    item(`${prefix}_STORE7`, { op: 'istore', arg: '7' }),
  ];
  const codeItems = padded([
    item('LLOAD_BYTE', 'iload_2'),
    item('LCONST_94', { op: 'bipush', arg: '94' }),
    item('LBRANCH', { op: 'if_icmpeq', arg: 'LCANON_ZERO_A' }),
    item('LSET_THIS', 'aload_0'),
    item('LSET_64', { op: 'bipush', arg: '64' }),
    item('LSET_FIELD', { op: 'putfield', arg: ['Field', 'Buffer', ['pos', 'I']] }),
    item('LDUP_JUMP', { op: 'goto', arg: 'LDUP_ZERO_A' }),
    ...encoderEntry('LCANON'),
    item('LCANON_DONE', 'return'),
    ...encoderEntry('LDUP'),
    item('LDUP_DONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_BASE38_DUPLICATE_ENCODER_ENTRY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('encoder', 'write', '(Ljava/lang/String;B)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget duplicate base38 encoder entry');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LDUP_JUMP:').instruction.arg, 'LCANON_ZERO_A');
}

{
  const codeItems = padded([
    item('LLOAD_BYTE', 'iload_2'),
    item('LCONST_94', { op: 'bipush', arg: '94' }),
    item('LINIT_BRANCH', { op: 'if_icmpeq', arg: 'LENTRY_ZERO_A' }),
    item('LSET_THIS', 'aload_0'),
    item('LSET_64', { op: 'bipush', arg: '64' }),
    item('LSET_FIELD', { op: 'putfield', arg: ['Field', 'Buffer', ['pos', 'I']] }),
    item('LDUP_JUMP', { op: 'goto', arg: 'LDUP_ZERO_A' }),
    item('LENTRY_ZERO_A', 'lconst_0'),
    item('LENTRY_STORE3', 'lstore_3'),
    item('LENTRY_ZERO_B', 'lconst_0'),
    item('LENTRY_STORE5', { op: 'lstore', arg: '5' }),
    item('LENTRY_ALOAD1', 'aload_1'),
    item('LENTRY_LEN', { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['length', '()I']] }),
    item('LENTRY_STORE7', { op: 'istore', arg: '7' }),
    item('LHEADER', { op: 'iload', arg: '8' }),
    item('LHEADER_NOT_A', 'iconst_m1'),
    item('LHEADER_XOR', 'ixor'),
    item('LHEADER_NOT_B', 'iconst_m1'),
    item('LHEADER_EXIT', { op: 'if_icmpgt', arg: 'LEXIT' }),
    item('LMUL_LOAD', 'lload_3'),
    item('LMUL_CONST', { op: 'ldc2_w', arg: '38l' }),
    item('LMUL', 'lmul'),
    item('LMUL_STORE', 'lstore_3'),
    item('LLEN_LOAD', { op: 'iload', arg: '7' }),
    item('LINDEX_LOAD', { op: 'iload', arg: '8' }),
    item('LBRANCH', { op: 'if_icmpgt', arg: 'LBODY_ALOAD' }),
    item('LTAIL_INC_A', { op: 'iinc', varnum: '8', incr: '-1' }),
    item('LTAIL_INC_B', { op: 'iinc', varnum: '8', incr: '-1' }),
    item('LTAIL_INC_C', { op: 'iinc', varnum: '8', incr: '-1' }),
    item('LBODY_ALOAD', 'aload_1'),
    item('LBODY_INDEX', { op: 'iload', arg: '8' }),
    item('LBODY_CHAR', { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['charAt', '(I)C']] }),
    item('LBODY_STORE9', { op: 'istore', arg: '9' }),
    item('LBODY_LOAD9', { op: 'iload', arg: '9' }),
    item('LBODY_CONST', { op: 'bipush', arg: '65' }),
    item('LBODY_BRANCH', { op: 'if_icmplt', arg: 'LJOIN' }),
    item('LBODY_ACC', 'lload_3'),
    item('LBODY_ONE', 'lconst_1'),
    item('LBODY_ADD', 'ladd'),
    item('LBODY_STORE3B', 'lstore_3'),
    item('LJOIN', { op: 'iload', arg: '8' }),
    item('LJOIN_NOT_A', 'iconst_m1'),
    item('LJOIN_XOR', 'ixor'),
    item('LJOIN_NOT_B', { op: 'bipush', arg: '-11' }),
    item('LJOIN_BRANCH', { op: 'if_icmpne', arg: 'LTAIL_INC_C' }),
    item('LRESET_LOAD', 'lload_3'),
    item('LRESET_STORE5', { op: 'lstore', arg: '5' }),
    item('LRESET_ZERO', 'lconst_0'),
    item('LRESET_STORE3', 'lstore_3'),
    item('LRESET_BACK', { op: 'goto', arg: 'LTAIL_INC_C' }),
    item('LEXIT', 'return'),
    item('LDUP_ZERO_A', 'lconst_0'),
    item('LDUP_STORE3', 'lstore_3'),
    item('LDUP_ZERO_B', 'lconst_0'),
    item('LDUP_STORE5', { op: 'lstore', arg: '5' }),
    item('LDUP_ALOAD1', 'aload_1'),
    item('LDUP_LEN', { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['length', '()I']] }),
    item('LDUP_STORE7', { op: 'istore', arg: '7' }),
    item('LDUP_DONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_BASE38_DUPLICATE_ENCODER_ENTRY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('encoder', 'write', '(Ljava/lang/String;B)V', codeItems)));
  assert.equal(result.changed, true, 'should clone forward base38 char body');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction.op, 'if_icmple');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKB38FWD')));
}

{
  const widthCheck = (prefix) => [
    item(`${prefix}_Q`, { op: 'getstatic', arg: ['Field', 'vl', ['Q', 'Ljl;']] }),
    item(`${prefix}_TEXT`, { op: 'getstatic', arg: ['Field', 'mp', ['mp_a', 'Ljava/lang/StringBuilder;']] }),
    item(`${prefix}_TOSTRING`, { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['toString', '()Ljava/lang/String;']] }),
    item(`${prefix}_WIDTH`, { op: 'invokevirtual', arg: ['Method', 'jl', ['c', '(Ljava/lang/String;)I']] }),
    item(`${prefix}_LIMIT`, { op: 'iload', arg: '6' }),
    item(`${prefix}_OK`, { op: 'if_icmple', arg: `${prefix}_RET_OK` }),
    item(`${prefix}_MARK`, { op: 'getstatic', arg: ['Field', 'mp', ['mp_a', 'Ljava/lang/StringBuilder;']] }),
    item(`${prefix}_M1`, 'iconst_m1'),
    item(`${prefix}_LEN_SRC`, { op: 'getstatic', arg: ['Field', 'mp', ['mp_a', 'Ljava/lang/StringBuilder;']] }),
    item(`${prefix}_LEN`, { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['length', '()I']] }),
    item(`${prefix}_ADD`, 'iadd'),
    item(`${prefix}_SPACE`, { op: 'bipush', arg: '32' }),
    item(`${prefix}_COLOR`, { op: 'ldc', arg: '16736352' }),
    item(`${prefix}_CALL`, { op: 'invokestatic', arg: ['Method', 'nk', ['a', '(Ljava/lang/StringBuilder;ICI)Ljava/lang/StringBuilder;']] }),
    item(`${prefix}_POP`, 'pop'),
    item(`${prefix}_ONE_A`, 'iconst_1'),
    item(`${prefix}_RETURN_A`, 'ireturn'),
    item(`${prefix}_RET_OK`, 'iconst_1'),
    item(`${prefix}_RETURN_B`, 'ireturn'),
  ];
  const codeItems = padded([
    item('LCE2_CONST', 'iconst_2'),
    item('LCE2_GET', { op: 'getstatic', arg: ['Field', 'ce', ['ce_d', 'I']] }),
    item('LCE2_BRANCH', { op: 'if_icmpeq', arg: 'LDIRECT_START' }),
    item('LPREFIX_EMPTY', { op: 'ldc', arg: '' }),
    item('LPREFIX_STORE', { op: 'astore', arg: '8' }),
    item('LM1_CONST', 'iconst_m1'),
    item('LM1_GET', { op: 'getstatic', arg: ['Field', 'ce', ['ce_d', 'I']] }),
    item('LM1_XOR', 'ixor'),
    item('LM1_BRANCH', { op: 'if_icmpne', arg: 'LPREFIX_START' }),
    item('LFALLTHROUGH', 'return'),
    item('LPREFIX_START', { op: 'new', arg: 'java/lang/StringBuilder' }),
    item('LPREFIX_DUP', 'dup'),
    item('LPREFIX_INIT', { op: 'invokespecial', arg: ['Method', 'java/lang/StringBuilder', ['<init>', '()V']] }),
    item('LPREFIX_LOAD', { op: 'aload', arg: '8' }),
    item('LPREFIX_APPEND', { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;']] }),
    item('LPREFIX_NAME', { op: 'aload', arg: '33' }),
    item('LPREFIX_APPEND2', { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;']] }),
    item('LPREFIX_SUFFIX', { op: 'ldc', arg: ': ' }),
    item('LPREFIX_APPEND3', { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['append', '(Ljava/lang/String;)Ljava/lang/StringBuilder;']] }),
    item('LPREFIX_STRING', { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['toString', '()Ljava/lang/String;']] }),
    item('LPREFIX_STORE39', { op: 'astore', arg: '39' }),
    item('LPREFIX_LOAD_LIMIT', { op: 'iload', arg: '6' }),
    item('LPREFIX_Q2', { op: 'getstatic', arg: ['Field', 'vl', ['Q', 'Ljl;']] }),
    item('LPREFIX_WIDTH_ARG', { op: 'aload', arg: '39' }),
    item('LPREFIX_WIDTH', { op: 'invokevirtual', arg: ['Method', 'jl', ['c', '(Ljava/lang/String;)I']] }),
    item('LPREFIX_SUB', 'isub'),
    item('LPREFIX_STORE_LIMIT', { op: 'istore', arg: '6' }),
    ...widthCheck('LPREFIX_CHECK'),
    item('LDIRECT_START', { op: 'getstatic', arg: ['Field', 'dg', ['dg_b', 'Ljava/lang/String;']] }),
    item('LDIRECT_116', { op: 'bipush', arg: '116' }),
    item('LDIRECT_ARRAY_COUNT', 'iconst_1'),
    item('LDIRECT_ARRAY', { op: 'anewarray', arg: 'java/lang/String' }),
    item('LDIRECT_NAME', { op: 'astore', arg: '40' }),
    item('LDIRECT_ALT', { op: 'astore', arg: '41' }),
    item('LDIRECT_W10', { op: 'istore', arg: '10' }),
    item('LDIRECT_W11', { op: 'istore', arg: '11' }),
    item('LDIRECT_CMP', { op: 'if_icmplt', arg: 'LDIRECT_COMMON' }),
    item('LDIRECT_SUB11', { op: 'iinc', arg: '6 -1' }),
    ...widthCheck('LDIRECT_FIRST'),
    item('LDIRECT_COMMON', { op: 'iload', arg: '6' }),
    item('LDIRECT_SUB10_SRC', { op: 'iload', arg: '10' }),
    item('LDIRECT_SUB10', 'isub'),
    item('LDIRECT_STORE_LIMIT', { op: 'istore', arg: '6' }),
    ...widthCheck('LDIRECT_SECOND'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_CHAT_WIDTH_TAILS: '1',
  }, () => runStructuredGotoClone(targetAstFrom('go', 'a', '(III)Z', codeItems)));
  assert.equal(result.changed, true, 'should clone chat-width terminal tails');
  assert.equal(result.rewrites, 2);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LCE2_BRANCH:').instruction.arg, 'LDIRECT_START');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LM1_BRANCH:').instruction.arg, 'LPREFIX_START');
}

{
  const qcEncoderEntry = (prefix) => [
    item(`${prefix}_ZERO5`, 'lconst_0'),
    item(`${prefix}_STORE5`, { op: 'lstore', arg: '5' }),
    item(`${prefix}_ALOAD1`, 'aload_1'),
    item(`${prefix}_LEN`, { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['length', '()I']] }),
    item(`${prefix}_STORE7`, { op: 'istore', arg: '7' }),
    item(`${prefix}_19`, { op: 'bipush', arg: '19' }),
    item(`${prefix}_STORE8`, { op: 'istore', arg: '8' }),
  ];
  const codeItems = padded([
    item('LZERO3', 'lconst_0'),
    item('LSTORE3', 'lstore_3'),
    item('LLOAD_BOOL', 'iload_2'),
    item('LBRANCH', { op: 'ifeq', arg: 'LCANON_ZERO5' }),
    item('LTHIS', 'aload_0'),
    item('LFLAG', { op: 'bipush', arg: '-109' }),
    item('LPUT', { op: 'putfield', arg: ['Field', 'qc', ['qc_f', 'I']] }),
    item('LDUP_JUMP', { op: 'goto', arg: 'LDUP_ZERO5' }),
    ...qcEncoderEntry('LCANON'),
    item('LCANON_DONE', 'return'),
    ...qcEncoderEntry('LDUP'),
    item('LDUP_DONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_BASE38_BOOLEAN_DUPLICATE_ENCODER_ENTRY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('qc', 'a', '(Ljava/lang/String;Z)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget duplicate base38 encoder');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LDUP_JUMP:').instruction.arg, 'LCANON_ZERO5');
}

{
  const codeItems = padded([
    item('LHEAD', { op: 'iload', arg: '8' }),
    item('LEXIT_BRANCH', { op: 'iflt', arg: 'LEXIT' }),
    item('LMUL_A', { op: 'lload', arg: '3' }),
    item('LMUL_B', { op: 'ldc2_w', arg: '38' }),
    item('LMUL', 'lmul'),
    item('LMUL_STORE', { op: 'lstore', arg: '3' }),
    item('LDEC', { op: 'iinc', varnum: '8', incr: '-1' }),
    item('LBACK', { op: 'goto', arg: 'LHEAD' }),
    item('LCHAR_STRING', 'aload_1'),
    item('LCHAR_INDEX', { op: 'iload', arg: '8' }),
    item('LCHAR_CALL', { op: 'invokevirtual', arg: ['Method', 'java/lang/String', ['charAt', '(I)C']] }),
    item('LCHAR_STORE', { op: 'istore', arg: '9' }),
    item('LADD', { op: 'lload', arg: '3' }),
    item('LONE', 'lconst_1'),
    item('LADDL', 'ladd'),
    item('LADD_STORE', { op: 'lstore', arg: '3' }),
    item('LCMP_LOAD', { op: 'iload', arg: '8' }),
    item('LCMP_M1', 'iconst_m1'),
    item('LCMP_XOR', 'ixor'),
    item('LCMP_CONST', { op: 'bipush', arg: '-11' }),
    item('LCMP_BRANCH', { op: 'if_icmpne', arg: 'LDEC' }),
    item('LSAVE_LOAD', { op: 'lload', arg: '3' }),
    item('LSAVE_STORE', { op: 'lstore', arg: '5' }),
    item('LRESET_ZERO', 'lconst_0'),
    item('LRESET_STORE', { op: 'lstore', arg: '3' }),
    item('LRESET_GOTO', { op: 'goto', arg: 'LDEC' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_TARGETED_BASE38_DECREMENT_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('fs', 'a', '(Ljava/lang/String;I)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Sumoblitz fs base38 decrement tails');
  assert.equal(result.rewrites, 1);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LCMP_BRANCH:').instruction.arg, 'LDEC');
}

{
  const geobloxActionTail = (prefix) => [
    item(`${prefix}_COUNT`, { op: 'getstatic', arg: ['Field', 'kc', ['kc_c', 'I']] }),
    item(`${prefix}_ONE`, 'iconst_1'),
    item(`${prefix}_ADD`, 'iadd'),
    item(`${prefix}_COUNT_SET`, { op: 'putstatic', arg: ['Field', 'kc', ['kc_c', 'I']] }),
    item(`${prefix}_ARG`, 'iload_2'),
    item(`${prefix}_TOKEN`, { op: 'sipush', arg: '-9410' }),
    item(`${prefix}_XOR`, 'ixor'),
    item(`${prefix}_PING`, { op: 'invokestatic', arg: ['Method', 'pg', ['a', '(I)V']] }),
    item(`${prefix}_NEW`, { op: 'new', arg: 'gh' }),
    item(`${prefix}_DUP`, 'dup'),
    item(`${prefix}_THIS`, 'aload_0'),
    item(`${prefix}_GAME`, { op: 'getfield', arg: ['Field', 'c', ['c_p', 'LActionOwner;']] }),
    item(`${prefix}_FLAG`, 'iload_3'),
    item(`${prefix}_INIT`, { op: 'invokespecial', arg: ['Method', 'gh', ['<init>', '(LActionOwner;Z)V']] }),
    item(`${prefix}_STORE`, { op: 'putstatic', arg: ['Field', 'el', ['el_o', 'Lgh;']] }),
    item(`${prefix}_REFRESH_ARG`, { op: 'bipush', arg: '-39' }),
    item(`${prefix}_REFRESH`, { op: 'invokestatic', arg: ['Method', 'le', ['a', '(B)V']] }),
    item(`${prefix}_M1`, 'iconst_m1'),
    item(`${prefix}_AI`, { op: 'putstatic', arg: ['Field', 'ai', ['ai_p', 'I']] }),
    item(`${prefix}_EXIT`, { op: 'goto', arg: 'LEXIT' }),
  ];
  const codeItems = padded([
    item('LFLAG_LOAD', 'iload_3'),
    item('LFLAG_BRANCH', { op: 'ifne', arg: 'LTAIL_COUNT' }),
    item('LFALL_A', 'return'),
    item('LNULL_LOAD', { op: 'getstatic', arg: ['Field', 'ca', ['ca_f', 'Lmg;']] }),
    item('LNULL_BRANCH', { op: 'ifnull', arg: 'LTAIL_COUNT' }),
    item('LFALL_B', 'return'),
    item('LSET_FLAG', 'iconst_1'),
    item('LSTORE_FLAG', 'istore_3'),
    item('LDIRECT_GOTO', { op: 'goto', arg: 'LTAIL_COUNT' }),
    ...geobloxActionTail('LTAIL'),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_EVENT_ACTION_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('c', 'b', '(IB)V', codeItems)));
  assert.equal(result.changed, true, 'should clone event action tails');
  assert.equal(result.rewrites, 3);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LFLAG_BRANCH:').instruction.arg, 'LTAIL_COUNT');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LNULL_BRANCH:').instruction.arg, 'LTAIL_COUNT');
  const directGoto = codeItems.find((entry) => entry.labelDef === 'LDIRECT_GOTO:');
  assert.ok(!directGoto.instruction || directGoto.instruction.op !== 'goto');
}

{
  const codeItems = padded([
    item('LSETUP', 'aload_1'),
    item('LBRANCH', { op: 'ifnonnull', arg: 'LTRAMP' }),
    item('LNULL', 'areturn'),
    item('LHEADER', { op: 'getstatic', arg: ['Field', 'rd', ['rd_g', 'Lwa;']] }),
    item('LHG', { op: 'getfield', arg: ['Field', 'wa', ['wa_g', 'I']] }),
    item('LHLOAD', 'aload_1'),
    item('LHCAST', { op: 'checkcast', arg: 'wa' }),
    item('LHG2', { op: 'getfield', arg: ['Field', 'wa', ['wa_g', 'I']] }),
    item('LHCMP', { op: 'if_icmpeq', arg: 'LDONE' }),
    item('LDONE', 'areturn'),
    item('LTRAMP', { op: 'goto', arg: 'LHEADER' }),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_OBJECT_MERGE_LOOP_RETARGET: '1',
  }, () => runStructuredGotoClone(targetAstFrom('tf', 'a', '(B)Lwa;', codeItems)));
  assert.equal(result.changed, true, 'should retarget Shattered Plans tf wa merge-loop trampolines');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction.arg, 'LHEADER');
}

{
  const rendererBody = (prefix, method, cleanup) => [
    item(`${prefix}_THIS`, 'aload_0'),
    item(`${prefix}_FIELD`, { op: 'getfield', arg: ['Field', 'eg', ['eg_k', 'Lwe;']] }),
    item(`${prefix}_S`, { op: 'ldc', arg: 'x' }),
    item(`${prefix}_X`, 'iconst_0'),
    item(`${prefix}_Y`, 'iconst_1'),
    item(`${prefix}_Z`, 'iconst_2'),
    item(`${prefix}_W`, 'iconst_3'),
    item(`${prefix}_CALL`, { op: 'invokevirtual', arg: ['Method', 'we', [method, '(Ljava/lang/String;IIII)V']] }),
    item(`${prefix}_GOTO`, { op: 'goto', arg: cleanup }),
  ];
  const codeItems = padded([
    item('LZERO', 'iconst_0'),
    item('LLOAD', { op: 'iload', arg: '12' }),
    item('LBRANCH', { op: 'if_icmpeq', arg: 'LBODYA_THIS' }),
    item('LGOTO', { op: 'goto', arg: 'LBODYB_THIS' }),
    item('LFALL', 'return'),
    ...rendererBody('LBODYA', 'a', 'LCLEAN_A'),
    item('LCLEAN_A', 'iload_2'),
    item('LCLEAN_A_CALL', { op: 'invokestatic', arg: ['Method', 'tk', ['b', '(Z)V']] }),
    item('LCLEAN_A_RET', 'return'),
    ...rendererBody('LBODYB', 'b', 'LCLEAN_B'),
    item('LCLEAN_B', 'iload_2'),
    item('LCLEAN_B_CALL', { op: 'invokestatic', arg: ['Method', 'tk', ['b', '(Z)V']] }),
    item('LCLEAN_B_RET', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_RENDERER_DISPATCH_BODY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('eg', 'a', '(IZIIIIILfe;)V', codeItems)));
  assert.equal(result.changed, true, 'should clone MinerDisturbance eg renderer dispatch bodies');
  assert.equal(result.rewrites, 2);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction.arg, 'LBODYA_THIS');
  const directGoto = codeItems.find((entry) => entry.labelDef === 'LGOTO:');
  assert.ok(!directGoto.instruction || directGoto.instruction.op !== 'goto');
}

{
  const codeItems = padded([
    item('LHEAD', 'iload_3'),
    item('LLIMIT', { op: 'getstatic', arg: ['Field', 'Entities', ['count', 'I']] }),
    item('LEXIT_BRANCH', { op: 'if_icmpge', arg: 'LEXIT' }),
    item('LBODY', { op: 'getstatic', arg: ['Field', 'Tiles', ['grid', '[[C']] }),
    item('LROW', { op: 'getstatic', arg: ['Field', 'Rows', ['values', '[I']] }),
    item('LIDX_A', 'iload_3'),
    item('LIALOAD_A', 'iaload'),
    item('LAALOAD', 'aaload'),
    item('LCOL', { op: 'getstatic', arg: ['Field', 'Cols', ['values', '[I']] }),
    item('LIDX_B', 'iload_3'),
    item('LIALOAD_B', 'iaload'),
    item('LCHAR', { op: 'bipush', arg: '8' }),
    item('LI2C', 'i2c'),
    item('LSTORE', 'castore'),
    item('LINC', { op: 'iinc', varnum: '3', incr: '1' }),
    item('LCONT', { op: 'goto', arg: 'LHEAD' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_GRID_TILE_UPDATE_CONTINUE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('grid', 'tick', '(I)V', codeItems)));
  assert.equal(result.changed, true, 'should clone grid tile-update continue headers');
  assert.equal(result.rewrites, 1);
  assert.ok(!codeItems.some((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LHEAD'));
}

{
  const preLoopSetup = (prefix, header) => [
    item(`${prefix}_ODD_M1`, 'iconst_m1'),
    item(`${prefix}_NI`, { op: 'getstatic', arg: ['Field', 'Clock', ['tick', 'I']] }),
    item(`${prefix}_ONE`, 'iconst_1'),
    item(`${prefix}_AND`, 'iand'),
    item(`${prefix}_M1_B`, 'iconst_m1'),
    item(`${prefix}_XOR`, 'ixor'),
    item(`${prefix}_BRANCH`, { op: 'if_icmpeq', arg: `${prefix}_KB` }),
    item(`${prefix}_RETURN`, 'return'),
    item(`${prefix}_KB`, { op: 'getstatic', arg: ['Field', 'Animator', ['frame', 'I']] }),
    item(`${prefix}_INC_ONE`, 'iconst_1'),
    item(`${prefix}_ADD`, 'iadd'),
    item(`${prefix}_EIGHT`, { op: 'bipush', arg: '8' }),
    item(`${prefix}_REM`, 'irem'),
    item(`${prefix}_PUT`, { op: 'putstatic', arg: ['Field', 'Animator', ['frame', 'I']] }),
    item(`${prefix}_ZERO`, 'iconst_0'),
    item(`${prefix}_STORE3`, 'istore_3'),
    item(header, 'iload_3'),
    item(`${header}_LIMIT`, { op: 'getstatic', arg: ['Field', 'Entities', ['count', 'I']] }),
    item(`${header}_EXIT`, { op: 'if_icmpge', arg: 'LDONE' }),
    item(`${header}_BODY`, { op: 'getstatic', arg: ['Field', 'Tiles', ['grid', '[[C']] }),
  ];
  const codeItems = padded([
    item('LLOAD17', { op: 'iload', arg: '17' }),
    item('LBRANCH17', { op: 'ifne', arg: 'LTRUE_START' }),
    ...preLoopSetup('LFALSE', 'LFALSE_HEAD'),
    item('LTRUE_START', { op: 'bipush', arg: '120' }),
    item('LTRUE_PG', { op: 'getstatic', arg: ['Field', 'pg', ['pg_f', 'I']] }),
    item('LTRUE_BRANCH', { op: 'if_icmpgt', arg: 'LSHARED_ODD_M1' }),
    ...preLoopSetup('LSHARED', 'LSHARED_HEAD'),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_GRID_TILE_UPDATE_CONTINUE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('grid', 'tick', '(I)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget duplicate pre-loop setup');
  assert.equal(result.rewrites, 1);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LFALSE_ODD_M1:').instruction, { op: 'goto', arg: 'LSHARED_ODD_M1' });
}

{
  const codeItems = padded([
    item('LENTRY', { op: 'iload', arg: '5' }),
    item('LCHECK_CONST', { op: 'sipush', arg: '19063' }),
    item('LCHECK', { op: 'if_icmpeq', arg: 'LQUEUE_CHECK' }),
    item('LRET', 'return'),
    item('LQUEUE_CHECK', 'aload_0'),
    item('LQUEUE_FIELD', { op: 'getfield', arg: ['Field', 'al', ['al_u', 'Lko;']] }),
    item('LQUEUE_ARG', { op: 'iload', arg: '5' }),
    item('LQUEUE_OFFSET', { op: 'sipush', arg: '-19063' }),
    item('LQUEUE_ADD', 'iadd'),
    item('LQUEUE_EMPTY', { op: 'invokevirtual', arg: ['Method', 'ko', ['c', '(I)Z']] }),
    item('LQUEUE_BRANCH', { op: 'ifne', arg: 'LCREATE' }),
    item('LCMP_A', { op: 'iload', arg: '3' }),
    item('LCMP_MASK_A', { op: 'sipush', arg: '255' }),
    item('LCMP_AND_A', 'iand'),
    item('LLOAD_THIS', 'aload_0'),
    item('LLOAD_EXISTING', { op: 'bipush', arg: '49' }),
    item('LGET_EXISTING', { op: 'invokevirtual', arg: ['Method', 'al', ['j', '(I)Lqe;']] }),
    item('LDUP_EXISTING', 'dup'),
    item('LSTORE_EXISTING_A', { op: 'astore', arg: '7' }),
    item('LLOAD_EXISTING_B', { op: 'aload', arg: '7' }),
    item('LSTORE_EXISTING_B', { op: 'astore', arg: '6' }),
    item('LGET_VERSION', { op: 'getfield', arg: ['Field', 'qe', ['qe_v', 'I']] }),
    item('LCMP_MASK_B', { op: 'sipush', arg: '255' }),
    item('LCMP_AND_B', 'iand'),
    item('LMISMATCH', { op: 'if_icmpne', arg: 'LCREATE' }),
    item('LSET_EXISTING', { op: 'aload', arg: '7' }),
    item('LSET_VALUE', { op: 'iload', arg: '4' }),
    item('LPUT_EXISTING', { op: 'putfield', arg: ['Field', 'qe', ['L', 'I']] }),
    item('LSKIP_CREATE', { op: 'goto', arg: 'LJOIN' }),
    item('LCREATE', 'aload_0'),
    item('LCREATE_QUEUE', { op: 'getfield', arg: ['Field', 'al', ['al_u', 'Lko;']] }),
    item('LCREATE_FLAG', { op: 'bipush', arg: '-58' }),
    item('LCREATE_NEW', { op: 'new', arg: 'qe' }),
    item('LCREATE_DUP', 'dup'),
    item('LCREATE_ARG_A', { op: 'iload', arg: '3' }),
    item('LCREATE_ARG_B', { op: 'iload', arg: '4' }),
    item('LCREATE_INIT', { op: 'invokespecial', arg: ['Method', 'qe', ['<init>', '(II)V']] }),
    item('LCREATE_DUP_LOCAL', 'dup'),
    item('LCREATE_STORE_A', { op: 'astore', arg: '8' }),
    item('LCREATE_LOAD_A', { op: 'aload', arg: '8' }),
    item('LCREATE_STORE_B', { op: 'astore', arg: '6' }),
    item('LCREATE_ENQUEUE', { op: 'invokevirtual', arg: ['Method', 'ko', ['b', '(BLma;)V']] }),
    item('LNOTIFY_THIS', 'aload_0'),
    item('LNOTIFY_FIELD', { op: 'getfield', arg: ['Field', 'al', ['al_f', 'Lsq;']] }),
    item('LNOTIFY_ARG', { op: 'aload', arg: '8' }),
    item('LNOTIFY_FALSE', 'iconst_0'),
    item('LNOTIFY_CALL', { op: 'invokevirtual', arg: ['Method', 'sq', ['a', '(Lqe;Z)V']] }),
    item('LJOIN', 'aload_0'),
    item('LJOIN_VALUE', { op: 'iload', arg: '4' }),
    item('LJOIN_PUT', { op: 'putfield', arg: ['Field', 'al', ['A', 'I']] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STATE_UPDATE_CREATION_BODY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('al', 'a', '(IIIII)V', codeItems)));
  assert.equal(result.changed, true, 'should clone state-update creation body');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LQUEUE_BRANCH:').instruction.op, 'ifeq');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSTATEQ_')), 'state-update clone should use private labels');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LMISMATCH:').instruction.arg, 'LCREATE');
}

{
  const codeItems = padded([
    item('LLOOP', { op: 'aload', arg: '5' }),
    item('LARRAY_INDEX', { op: 'iload', arg: '6' }),
    item('LARRAY_LOAD', 'aaload'),
    item('LSTORE_EI', { op: 'astore', arg: '7' }),
    item('LOLD_DISABLE', { op: 'aload', arg: '7' }),
    item('LOLD_FALSE', 'iconst_0'),
    item('LOLD_PUT', { op: 'putfield', arg: ['Field', 'ei', ['ei_c', 'Z']] }),
    item('LOLD_INC', { op: 'iinc', varnum: '6', incr: '1' }),
    item('LOLD_BACK', { op: 'goto', arg: 'LLOOP' }),
    item('LLOAD9', { op: 'iload', arg: '9' }),
    item('LM1_A', 'iconst_m1'),
    item('LBRANCH_A', { op: 'if_icmpeq', arg: 'LOLD_DISABLE' }),
    item('LFALL_A', 'return'),
    item('LM1_B', 'iconst_m1'),
    item('LLOAD10', { op: 'iload', arg: '10' }),
    item('LBRANCH_B', { op: 'if_icmpeq', arg: 'LOLD_DISABLE' }),
    item('LFALL_B', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DISABLE_BACKWARD_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('di', 'a', '(Ljava/awt/Canvas;B)V', codeItems)));
  assert.equal(result.changed, true, 'should clone disable backward tails');
  assert.equal(result.rewrites, 2);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH_A:').instruction.arg, 'LOLD_DISABLE');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH_B:').instruction.arg, 'LOLD_DISABLE');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKDISABLE_')), 'disable clones should use private labels');
}

{
  const codeItems = padded([
    item('LOUTER', { op: 'iload', arg: '11' }),
    item('LOUTER_TILE', { op: 'iload', arg: '20' }),
    item('LOUTER_BRANCH', { op: 'if_icmpgt', arg: 'LSETUP' }),
    item('LOUTER_INC', { op: 'iinc', varnum: '18', incr: '1' }),
    item('LOUTER_BACK', { op: 'goto', arg: 'LOUTER' }),
    item('LSETUP', 'iconst_0'),
    item('LSETUP_STORE', { op: 'istore', arg: '21' }),
    item('LHEADER', { op: 'bipush', arg: '-2' }),
    item('LHEADER_COL', { op: 'iload', arg: '21' }),
    item('LHEADER_BRANCH', { op: 'if_icmple', arg: 'LBODY' }),
    item('LHEADER_ROW_INC', { op: 'iinc', varnum: '12', incr: '64' }),
    item('LHEADER_TILE_INC', { op: 'iinc', varnum: '20', incr: '1' }),
    item('LHEADER_BACK', { op: 'goto', arg: 'LOUTER' }),
    item('LBODY', 'aload_0'),
    item('LBODY_CHECK_A', { op: 'ifnonnull', arg: 'LKEEP_A' }),
    item('LBODY_INC_A', { op: 'iinc', varnum: '21', incr: '1' }),
    item('LBODY_GOTO_A', { op: 'goto', arg: 'LHEADER' }),
    item('LKEEP_A', 'aload_1'),
    item('LBODY_CHECK_B', { op: 'ifnonnull', arg: 'LCANON_INC' }),
    item('LBODY_INC_B', { op: 'iinc', varnum: '21', incr: '1' }),
    item('LBODY_GOTO_B', { op: 'goto', arg: 'LHEADER' }),
    item('LCANON_INC', { op: 'iinc', varnum: '21', incr: '1' }),
    item('LCANON_GOTO', { op: 'goto', arg: 'LHEADER' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_COLUMN_CONTINUE_SPLITTER: '1',
  }, () => runStructuredGotoClone(targetAstFrom('ra', 'a', '(ZIZLka;IIIII)V', codeItems)));
  assert.equal(result.changed, true, 'should retarget Torchallenge ra local continues to one forward tail');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LCANON_INC').length, 2);
}

{
  const codeItems = padded([
    item('LLOAD_STATE', { op: 'iload', arg: '4' }),
    item('LMINUS_ONE', 'iconst_m1'),
    item('LBRANCH_NEXT', { op: 'if_icmpne', arg: 'LNEXT_CASE' }),
    item('LJUMP_MINUS_ONE', { op: 'goto', arg: 'LMINUS_ONE_CASE' }),
    item('LNEXT_CASE', { op: 'iload', arg: '4' }),
    item('LNEXT_DONE', 'return'),
    item('LMINUS_ONE_CASE', 'aload_0'),
    item('LMINUS_ONE_DONE', 'areturn'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STATE_BRIDGES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('qe', 'c', '(BI)Lqe;', codeItems)));
  assert.equal(result.changed, true, 'should collapse Torchallenge qe state dispatch bridges');
  assert.equal(result.rewrites, 1);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH_NEXT:').instruction, { op: 'if_icmpeq', arg: 'LMINUS_ONE_CASE' });
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LJUMP_MINUS_ONE:').instruction, 'nop');
}

{
  const codeItems = padded([
    item('LLOOP', 'aload_2'),
    item('LNULL_EXIT', { op: 'ifnull', arg: 'LDONE' }),
    item('LLOAD_INDEX', 'iload_3'),
    item('LMINUS_ONE', 'iconst_m1'),
    item('LNEGATIVE_BRANCH', { op: 'if_icmpgt', arg: 'LREMOVE' }),
    item('LTHIS_LIMIT', 'aload_0'),
    item('LGET_C', { op: 'getfield', arg: ['Field', 'di', ['C', 'Ltf;']] }),
    item('LGET_LIMIT', { op: 'getfield', arg: ['Field', 'tf', ['tf_r', 'I']] }),
    item('LLOAD_INDEX_B', 'iload_3'),
    item('LLIMIT_BRANCH', { op: 'if_icmple', arg: 'LREMOVE' }),
    item('LM1_CHECK', 'iconst_m1'),
    item('LTHIS_ARRAY', 'aload_0'),
    item('LGET_C2', { op: 'getfield', arg: ['Field', 'di', ['C', 'Ltf;']] }),
    item('LGET_ARRAY', { op: 'getfield', arg: ['Field', 'tf', ['tf_e', '[I']] }),
    item('LLOAD_INDEX_C', 'iload_3'),
    item('LIALOAD', 'iaload'),
    item('LENTRY_BRANCH', { op: 'if_icmpne', arg: 'LBODY' }),
    item('LREMOVE', 'aload_2'),
    item('LTRUE', 'iconst_1'),
    item('LREMOVE_CALL', { op: 'invokevirtual', arg: ['Method', 'da', ['a', '(Z)V']] }),
    item('LREMOVE_GOTO', { op: 'goto', arg: 'LCONTINUE' }),
    item('LBODY', 'aload_0'),
    item('LBODY_DONE', { op: 'goto', arg: 'LCONTINUE' }),
    item('LCONTINUE', 'aload_0'),
    item('LNEXT', { op: 'invokevirtual', arg: ['Method', 'sl', ['c', '(I)Lda;']] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_INVALID_ENTRY_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('di', 'a', '(B)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Torchallenge di invalid-entry removal tail');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LNEGATIVE_BRANCH:').instruction.arg, 'LCKINVALID');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LLIMIT_BRANCH:').instruction.arg, 'LCKINVALID');
  assert.ok(codeItems.some((entry) => entry.labelDef === 'LCKINVALID:'));
}

{
  const codeItems = padded([
    item('LHEAD_A', { op: 'iload', arg: '3' }),
    item('LHEAD_A_LIMIT', { op: 'bipush', arg: '10' }),
    item('LHEAD_A_EXIT', { op: 'if_icmpge', arg: 'LDONE' }),
    item('LBODY_A_ONE', 'aload_0'),
    item('LBODY_A_CHECK', { op: 'ifnonnull', arg: 'LBODY_A_TWO' }),
    item('LBODY_A_INC', { op: 'iinc', varnum: '3', incr: '1' }),
    item('LBODY_A_BACK', { op: 'goto', arg: 'LHEAD_A' }),
    item('LBODY_A_TWO', 'aload_1'),
    item('LBODY_A_CHECK2', { op: 'ifnonnull', arg: 'LCANON_A_INC' }),
    item('LBODY_A_INC2', { op: 'iinc', varnum: '3', incr: '1' }),
    item('LBODY_A_BACK2', { op: 'goto', arg: 'LHEAD_A' }),
    item('LCANON_A_INC', { op: 'iinc', varnum: '3', incr: '1' }),
    item('LCANON_A_BACK', { op: 'goto', arg: 'LHEAD_A' }),
    item('LHEAD_B', { op: 'iload', arg: '4' }),
    item('LHEAD_B_LIMIT', { op: 'bipush', arg: '5' }),
    item('LHEAD_B_EXIT', { op: 'if_icmpge', arg: 'LDONE' }),
    item('LBODY_B_INC', { op: 'iinc', varnum: '4', incr: '1' }),
    item('LBODY_B_BACK', { op: 'goto', arg: 'LHEAD_B' }),
    item('LCANON_B_INC', { op: 'iinc', varnum: '4', incr: '1' }),
    item('LCANON_B_BACK', { op: 'goto', arg: 'LHEAD_B' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_TARGETED_CANONICAL_IINC_CONTINUES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('nk', 'a', '(IIB)I', codeItems)));
  assert.equal(result.changed, true, 'should retarget identical iinc backedges to canonical continue tails');
  assert.equal(result.rewrites, 3);
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LCANON_A_INC').length, 2);
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LCANON_B_INC').length, 1);
}

{
  const codeItems = padded([
    item('LSTART', 'iconst_0'),
    item('LDUP_A_INC', { op: 'iinc', varnum: '13', incr: '-1' }),
    item('LDUP_A_GOTO', { op: 'goto', arg: 'LHEADER' }),
    item('LDUP_B_INC', { op: 'iinc', varnum: '13', incr: '-1' }),
    item('LDUP_B_GOTO', { op: 'goto', arg: 'LHEADER' }),
    item('LDIFF_INC', { op: 'iinc', varnum: '12', incr: '-1' }),
    item('LDIFF_GOTO', { op: 'goto', arg: 'LHEADER' }),
    item('LCANON_INC', { op: 'iinc', varnum: '13', incr: '-1' }),
    item('LHEADER', { op: 'iload', arg: '11' }),
    item('LHEADER_EXIT', { op: 'ifeq', arg: 'LDONE' }),
    item('LBODY', 'aload_0'),
    item('LBACK_CHECK', { op: 'ifnonnull', arg: 'LCANON_INC' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_FORWARD_IINC_CONTINUES: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should retarget duplicate forward iinc continues to the canonical iinc tail');
  assert.equal(result.rewrites, 2);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LDUP_A_INC:').instruction, { op: 'goto', arg: 'LCANON_INC' });
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LDUP_B_INC:').instruction, { op: 'goto', arg: 'LCANON_INC' });
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LDIFF_INC:').instruction, { op: 'iinc', varnum: '12', incr: '-1' });
}

{
  const codeItems = padded([
    item('LENTRY', 'iconst_0'),
    item('LENTRY_LOAD', { op: 'iload', arg: '14' }),
    item('LENTRY_EXIT', { op: 'if_icmple', arg: 'LDONE' }),
    item('LENTRY_JUMP', { op: 'goto', arg: 'LBODY' }),
    item('LCANON', 'iconst_0'),
    item('LCANON_LOAD', { op: 'iload', arg: '14' }),
    item('LCANON_EXIT', { op: 'if_icmple', arg: 'LDONE' }),
    item('LBODY', 'iconst_0'),
    item('LBODY_STORE', { op: 'istore', arg: '21' }),
    item('LBODY_BACK', { op: 'goto', arg: 'LCANON' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_INT_GUARD_ALIAS: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should retarget duplicate integer guard aliases to the canonical guard');
  assert.equal(result.rewrites, 1);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LENTRY:').instruction, { op: 'goto', arg: 'LCANON' });
  assert.equal(codeItems.some((entry) => entry.labelDef === 'LENTRY_JUMP:'), false);
}

{
  const codeItems = padded([
    item('L0', { op: 'bipush', arg: '15' }),
    item('L1', { op: 'getstatic', arg: ['Field', 'kd', ['kd_u', 'I']] }),
    item('L2', { op: 'if_icmpge', arg: 'LDUP' }),
    item('L3', { op: 'getstatic', arg: ['Field', 'jf', ['jf_c', 'I']] }),
    item('L4', { op: 'bipush', arg: '-16' }),
    item('L5', { op: 'if_icmpge', arg: 'LDUP' }),
    item('L6', { op: 'bipush', arg: '-2' }),
    item('L7', { op: 'getstatic', arg: ['Field', 'ak', ['ak_d', 'I']] }),
    item('L8', { op: 'if_icmplt', arg: 'LDEC' }),
    item('LCANON', { op: 'bipush', arg: '50' }),
    item('LCANON_PUT', { op: 'putstatic', arg: ['Field', 'of', ['of_e', 'I']] }),
    item('LCANON_LOAD', { op: 'getstatic', arg: ['Field', 'jf', ['jf_c', 'I']] }),
    item('LCANON_PUT2', { op: 'putstatic', arg: ['Field', 'kd', ['kd_u', 'I']] }),
    item('LCANON_EXIT', { op: 'goto', arg: 'LDONE' }),
    item('LDEC', { op: 'getstatic', arg: ['Field', 'ak', ['ak_d', 'I']] }),
    item('LDEC_ONE', 'iconst_1'),
    item('LDEC_SUB', 'isub'),
    item('LDEC_PUT', { op: 'putstatic', arg: ['Field', 'ak', ['ak_d', 'I']] }),
    item('LDUP', { op: 'bipush', arg: '50' }),
    item('LDUP_PUT', { op: 'putstatic', arg: ['Field', 'of', ['of_e', 'I']] }),
    item('LDUP_LOAD', { op: 'getstatic', arg: ['Field', 'jf', ['jf_c', 'I']] }),
    item('LDUP_PUT2', { op: 'putstatic', arg: ['Field', 'kd', ['kd_u', 'I']] }),
    item('LDUP_EXIT', { op: 'goto', arg: 'LDONE' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_FORWARD_TAIL_RETARGET: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should retarget branches to an earlier identical forward tail');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'L2:').instruction.arg, 'LCANON');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'L5:').instruction.arg, 'LCANON');
}

{
  const codeItems = padded([
    item('LLOAD0', { op: 'iload', arg: '4' }),
    item('LBOUND', 'iconst_2'),
    item('LLOWER_GUARD', { op: 'if_icmplt', arg: 'LCOMPUTE' }),
    item('LIMPOSSIBLE_CONST1', { op: 'sipush', arg: '-140' }),
    item('LIMPOSSIBLE_LOAD1', { op: 'iload', arg: '4' }),
    item('LIMPOSSIBLE_BRANCH1', { op: 'if_icmple', arg: 'LSECOND' }),
    item('LFALSE1', 'iconst_0'),
    item('LFALSE1_GOTO', { op: 'goto', arg: 'LJOIN' }),
    item('LSECOND', { op: 'iload', arg: '4' }),
    item('LIMPOSSIBLE_CONST2', { op: 'sipush', arg: '-142' }),
    item('LIMPOSSIBLE_BRANCH2', { op: 'if_icmpge', arg: 'LCOMPUTE' }),
    item('LFALSE2', 'iconst_0'),
    item('LFALSE2_GOTO', { op: 'goto', arg: 'LJOIN' }),
    item('LCOMPUTE', 'iconst_1'),
    item('LJOIN', { op: 'istore', arg: '5' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_RANGE_BRANCHES: '1',
  }, () => runStructuredGotoClone(astFrom(codeItems)));
  assert.equal(result.changed, true, 'should simplify dominated integer range branches');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIMPOSSIBLE_CONST1:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIMPOSSIBLE_LOAD1:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIMPOSSIBLE_BRANCH1:').instruction.op, 'goto');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LSECOND:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIMPOSSIBLE_CONST2:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIMPOSSIBLE_BRANCH2:').instruction.op, 'goto');
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
    item('LGET', { op: 'getstatic', arg: ['Field', 'FlagHolder', ['y', 'I']] }),
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
    STRUCTURED_GOTO_STATIC_ZERO_FLAG_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('op', 'c', '(B)I', codeItems)));
  assert.equal(result.changed, true, 'should remove targeted static zero-flag branches');
  assert.equal(codeItems[2].instruction, 'nop');
  assert.equal(codeItems[3].instruction, 'nop');
  assert.equal(codeItems[4].instruction, 'nop');
  assert.deepEqual(codeItems[5].instruction, { op: 'goto', arg: 'LZERO' });
}

{
  const codeItems = padded([
    item('LGET', { op: 'getstatic', arg: ['Field', 'LoopFlag', ['state', 'I']] }),
    item('LSTORE', { op: 'istore', arg: '8' }),
    item('LDUMMY0', { op: 'bipush', arg: '-74' }),
    item(null, { op: 'bipush', arg: '29' }),
    item(null, 'iload_1'),
    item(null, 'isub'),
    item(null, { op: 'bipush', arg: '44' }),
    item(null, 'idiv'),
    item(null, 'idiv'),
    item(null, 'istore_3'),
    item('LWIDTH', { op: 'getstatic', arg: ['Field', 'GridA', ['cells', '[[I']] }),
    item(null, 'iconst_0'),
    item(null, 'aaload'),
    item(null, 'arraylength'),
    item(null, { op: 'istore', arg: '4' }),
    item('LLOAD1', { op: 'iload', arg: '8' }),
    item('LIFNE1', { op: 'ifne', arg: 'LALT' }),
    item('LBODY1', 'iconst_0'),
    item('LLOAD2', { op: 'iload', arg: '8' }),
    item('LIFEQ', { op: 'ifeq', arg: 'LZERO' }),
    item('LBODY2', 'iconst_1'),
    item('LLOAD3', { op: 'iload', arg: '8' }),
    item('LIFNE2', { op: 'ifne', arg: 'LALT' }),
    item('LGRID1', { op: 'getstatic', arg: ['Field', 'GridA', ['cells', '[[I']] }),
    item(null, 'iload_1'),
    item(null, 'aaload'),
    item(null, 'iload_2'),
    item(null, 'iaload'),
    item('LGRID2', { op: 'getstatic', arg: ['Field', 'GridB', ['cells', '[[I']] }),
    item(null, 'iload_1'),
    item(null, 'aaload'),
    item(null, 'iload_2'),
    item(null, 'iaload'),
    item('LGRID3', { op: 'getstatic', arg: ['Field', 'GridA', ['cells', '[[I']] }),
    item(null, 'iload_1'),
    item(null, 'aaload'),
    item(null, 'iload_2'),
    item(null, 'iconst_1'),
    item(null, 'iastore'),
    item('LGRID4', { op: 'getstatic', arg: ['Field', 'GridB', ['cells', '[[I']] }),
    item(null, 'iload_1'),
    item(null, 'aaload'),
    item(null, 'iload_2'),
    item(null, 'iconst_2'),
    item(null, 'iastore'),
    item(null, { op: 'getstatic', arg: ['Field', 'GridA', ['cells', '[[I']] }),
    item(null, 'iload_1'),
    item(null, 'aaload'),
    item(null, 'iload_2'),
    item(null, 'iconst_3'),
    item(null, 'iastore'),
    item(null, { op: 'getstatic', arg: ['Field', 'GridB', ['cells', '[[I']] }),
    item(null, 'iload_1'),
    item(null, 'aaload'),
    item(null, 'iload_2'),
    item(null, 'iconst_4'),
    item(null, 'iastore'),
    item(null, 'iload_3'),
    item(null, 'ineg'),
    item(null, 'iload_3'),
    item(null, 'ineg'),
    item(null, 'iconst_5'),
    item(null, 'iconst_1'),
    item(null, { op: 'getstatic', arg: ['Field', 'Rnd', ['r', 'Ljava/util/Random;']] }),
    item(null, { op: 'invokestatic', arg: ['Method', 'Rand', ['next', '(IZLjava/util/Random;)I']] }),
    item(null, 'iconst_5'),
    item(null, 'iconst_1'),
    item(null, { op: 'getstatic', arg: ['Field', 'Rnd', ['r', 'Ljava/util/Random;']] }),
    item(null, { op: 'invokestatic', arg: ['Method', 'Rand', ['next', '(IZLjava/util/Random;)I']] }),
    item('LFALL', 'return'),
    item('LZERO', 'ireturn'),
    item('LALT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STATIC_INT_LOOP_FLAG_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('any', 'h', '(I)V', codeItems)));
  assert.equal(result.changed, true, 'shape-gated static int loop flag branches should be removed without class targets');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LLOAD1:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIFNE1:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LLOAD2:').instruction, 'nop');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LIFEQ:').instruction, { op: 'goto', arg: 'LZERO' });
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LLOAD3:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIFNE2:').instruction, 'nop');
}

{
  const codeItems = padded([
    item('LSETUP', 'iconst_0'),
    item(null, { op: 'istore', arg: '33' }),
    item('LCLIP_TEST', 'iconst_0'),
    item(null, 'iload_2'),
    item(null, { op: 'if_icmpgt', arg: 'LCLIP' }),
    item('LDIRECT_ENTRY', { op: 'goto', arg: 'LSCAN' }),
    item('LCLIP', 'iload_1'),
    item(null, { op: 'iflt', arg: 'LLOWER' }),
    item(null, 'iload_2'),
    item(null, 'ineg'),
    item(null, 'istore_2'),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '19' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '17' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '20' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '18' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '21' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '22' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '23' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '24' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '24' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '25' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '27' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '29' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '28' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '30' }),
    item(null, 'iload_3'),
    item(null, 'iload_2'),
    item(null, { op: 'iload', arg: '31' }),
    item(null, 'imul'),
    item(null, 'iadd'),
    item(null, { op: 'istore', arg: '21' }),
    item(null, 'iconst_0'),
    item(null, 'istore_2'),
    item(null, { op: 'goto', arg: 'LSCAN' }),
    item('LLOWER', 'iload_1'),
    item(null, 'istore_2'),
    item(null, { op: 'goto', arg: 'LLOWER_BODY' }),
    item('LSCAN', { op: 'getstatic', arg: ['Field', 'Rows', ['offsets', '[I']] }),
    item(null, 'iload_2'),
    item(null, 'iaload'),
    item(null, { op: 'istore', arg: '36' }),
    item('LHEAD', 'iload_1'),
    item(null, 'iload_2'),
    item(null, { op: 'if_icmple', arg: 'LLOWER_BODY' }),
    item(null, { op: 'iload', arg: '29' }),
    item(null, { op: 'iload', arg: '25' }),
    item(null, 'iconst_0'),
    item(null, { op: 'iload', arg: '36' }),
    item(null, { op: 'bipush', arg: '-117' }),
    item(null, 'iconst_0'),
    item(null, { op: 'iload', arg: '21' }),
    item(null, { op: 'iload', arg: '38' }),
    item(null, { op: 'aload', arg: '16' }),
    item(null, 'iconst_0'),
    item(null, { op: 'invokestatic', arg: ['Method', 'Span', ['draw', '(IIIIBIII[II)V']] }),
    item(null, { op: 'iinc', arg: ['2', '1'] }),
    item(null, { op: 'goto', arg: 'LHEAD' }),
    item('LLOWER_BODY', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_RASTER_TOP_CLIP_SCANLINE_ENTRY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('any', 'm', '(IIIIIIIIIIBIIIII[I)V', codeItems)));
  assert.equal(result.changed, true, 'raster top-clip direct scanline entry should be cloned by shape');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LDIRECT_ENTRY:').instruction, { op: 'goto', arg: 'LSCAN' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKTOPCLIP_')), 'top-clip clone should use private labels');
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
  source.stackMapFrame = { frameType: 'same', longOperand: 1n };
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
  assert.deepEqual(codeItems[0].stackMapFrame, { frameType: 'same', longOperand: 1n });
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
    STRUCTURED_GOTO_CACHED_LOOKUP_CONTINUATION: '1',
    STRUCTURED_GOTO_CACHED_LOOKUP_CONTINUATION_TARGETS: 'hbb.a(Lbmb;ILasb;ILkka;)Z',
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
    STRUCTURED_GOTO_OBJECT_LOOP_INCREMENT_TAIL: '1',
    STRUCTURED_GOTO_OBJECT_LOOP_INCREMENT_TAIL_TARGETS: 'uca.a(Z[Lrba;Lsg;[Lit;[Lsg;Z)V',
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
    STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAILS: '1',
    STRUCTURED_GOTO_TARGETED_SHARED_LOOP_INCREMENT_TAIL_TARGETS: 'roa.<init>(Lpf;Lcbb;IIII)V',
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
    STRUCTURED_GOTO_OBJECT_SHARED_RETURN_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('uca', 'b', '(ILrsb;III)V', codeItems)));
  assert.equal(result.changed, true, 'should clone object shared return tail');
  assert.equal(result.rewrites, 2);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LIFNULL:').instruction.op, 'ifnonnull');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKOBJRET_')), 'uca return-tail clone should use private labels');
}

{
  const codeItems = padded([
    item('L0', 'aload_0'),
    item('L1', { op: 'getfield', arg: ['Field', 'x', ['enabled', 'Z']] }),
    item('L2', { op: 'ifeq', arg: 'LSIDE' }),
    item('L3', { op: 'goto', arg: 'LRET' }),
    item('LSIDE', 'iconst_1'),
    item('L5', { op: 'invokestatic', arg: ['Method', 'q', ['a', '(I)V']] }),
    item('LRET', { op: 'bipush', arg: '-2' }),
    item('L7', 'ireturn'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_TERMINAL_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('x', 'a', '()I', codeItems)));
  assert.equal(result.changed, true, 'should clone small shared terminal tail at forward goto');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'L3:').instruction.op, 'bipush');
  assert.ok(codeItems.filter((entry) => entry.instruction === 'ireturn').length >= 2, 'terminal return should be cloned');
}

{
  const codeItems = padded([
    item('L0', 'aload_0'),
    item('L1', { op: 'getfield', arg: ['Field', 'x', ['C', 'Z']] }),
    item('L2', { op: 'ifne', arg: 'LASSIGN' }),
    item('L3', { op: 'iload', arg: '5' }),
    item('L4', { op: 'ifeq', arg: 'LDIRECT' }),
    item('L5', 'iconst_1'),
    item('L6', { op: 'invokestatic', arg: ['Method', 'q', ['a', '(I)V']] }),
    item('LASSIGN', 'aload_0'),
    item('L8', 'iconst_0'),
    item('L9', { op: 'putfield', arg: ['Field', 'x', ['n', 'I']] }),
    item('L10', { op: 'goto', arg: 'LEXIT' }),
    item('LDIRECT', 'aload_0'),
    item('L12', 'iconst_0'),
    item('L13', { op: 'putfield', arg: ['Field', 'x', ['n', 'I']] }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_INSTANCE_ASSIGNMENT_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('x', 'a', '(Z)V', codeItems)));
  assert.equal(result.changed, true, 'should clone small shared instance assignment tail');
  assert.ok(result.rewrites >= 1);
  assert.ok(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'putfield').length >= 3, 'instance assignment should be cloned');
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
    STRUCTURED_GOTO_BUCKET_ARRAY_INIT_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('roa', '<init>', '(Lpf;Lcbb;IIII)V', codeItems)));
  assert.equal(result.changed, true, 'should clone bucket-array initialization tail');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LGO:').instruction, { op: 'goto', arg: 'LINIT' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBUCKET_')), 'roa bucket clone should use private labels');
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
    STRUCTURED_GOTO_OBJECT_REFRESH_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('hi', 'd', '(B)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Shattered Plans hi shared continuation');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LSKIP:').instruction, { op: 'goto', arg: 'LCONT' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKOBJREF_')), 'hi continuation clone should use private labels');
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
    STRUCTURED_GOTO_PREFIX_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('le', 'a', '(IIZ)Z', codeItems)));
  assert.equal(result.changed, true, 'should inline Shattered Plans le prefix continuation');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'L3:').instruction, { op: 'goto', arg: 'LJOIN' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKPFX_')), 'le clone should use private labels');
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
    STRUCTURED_GOTO_SHARED_BOOLEAN_LOOP_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('sc', 'a', '(IZLfb;I)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Shattered Plans sc shared boolean loop tail');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L8:').instruction.arg, 'LFALSE');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L10:').instruction.arg, 'LMERGE');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBOOLTAIL_')), 'sc clone should use private labels');
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
    STRUCTURED_GOTO_ITERATOR_ADVANCE_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('uo', 'a', '(BZIZZ)V', codeItems)));
  assert.equal(result.changed, true, 'should clone Shattered Plans uo iterator advance tail');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'L7:').instruction, { op: 'goto', arg: 'LADV' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKITERADV_')), 'uo iterator clone should use private labels');
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
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'message-exit tail should be cloned by descriptor shape, not class-name gates');
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'L2:').instruction, { op: 'goto', arg: 'LEXIT' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKMSGEXIT_')), 'uo exit clone should use private labels');
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
    STRUCTURED_GOTO_TWO_SIDED_NOT_COMPARE: '1',
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
    STRUCTURED_GOTO_RASTER_BLUR_LOOP_HEADER: '1',
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
    item('LZERO', 'iconst_0'),
    item('LLOAD_STATE', 'aload_0'),
    item('LFIELD', { op: 'getfield', arg: ['Field', 'Owner', ['count', 'I']] }),
    item('LBRANCH', { op: 'if_icmpge', arg: 'LRENDER' }),
    item('LBODY', 'aload_0'),
    item('LBODY_FIELD', { op: 'getfield', arg: ['Field', 'Owner', ['count', 'I']] }),
    item('LBODY_IF', { op: 'ifne', arg: 'LMID' }),
    item('LBODY_GOTO', { op: 'goto', arg: 'LAFTER' }),
    item('LMID', 'aload_0'),
    item('LMID_FIELD', { op: 'getfield', arg: ['Field', 'Owner', ['count', 'I']] }),
    item('LMID_IF', { op: 'ifne', arg: 'LAFTER' }),
    item('LMID_GOTO', { op: 'goto', arg: 'LRENDER' }),
    item('LAFTER', 'aload_0'),
    item('LAFTER_GOTO', { op: 'goto', arg: 'LRENDER' }),
    item('LRENDER', { op: 'getstatic', arg: ['Field', 'RendererHolder', ['renderer', 'LRenderer;']] }),
    item('LSTRING', { op: 'getstatic', arg: ['Field', 'Text', ['value', 'Ljava/lang/String;']] }),
    item('LX', { op: 'sipush', arg: '320' }),
    item('LY', { op: 'sipush', arg: '320' }),
    item('LCOLOR', { op: 'ldc', arg: '16711680' }),
    item('LSHADOW', 'iconst_m1'),
    item('LALPHA', { op: 'iload', arg: '3' }),
    item('LCALL', { op: 'invokevirtual', arg: ['Method', 'Renderer', ['draw', '(Ljava/lang/String;IIIII)V']] }),
    item('LRENDER_GOTO', { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_RENDER_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared text-render exit tail should be cloned for conditional branches');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSRTXT_')), 'shared text-render clone should get private labels');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction, { op: 'if_icmplt', arg: 'LBODY' });
}


{
  const codeItems = padded([
    item('LCALL', { op: 'invokestatic', arg: ['Method', 'Chooser', ['pick', '()I']] }),
    item('LSTORE', { op: 'istore', arg: '5' }),
    item('LRECV_A', { op: 'getstatic', arg: ['Field', 'ServiceHolder', ['service', 'LService;']] }),
    item('LARG_A', { op: 'iload', arg: '5' }),
    item('LCHECK_A', { op: 'invokevirtual', arg: ['Method', 'Service', ['has', '(I)Z']] }),
    item('LBRANCH', { op: 'ifeq', arg: 'LSHARED_TAIL' }),
    item('LRECV_B', { op: 'getstatic', arg: ['Field', 'ServiceHolder', ['service', 'LService;']] }),
    item('LARG_B', { op: 'iload', arg: '5' }),
    item('LCHECK_B', { op: 'invokevirtual', arg: ['Method', 'Service', ['done', '(I)Z']] }),
    item('LDONE_BRANCH', { op: 'ifne', arg: 'LEXIT' }),
    item('LRECV_C', { op: 'getstatic', arg: ['Field', 'ServiceHolder', ['service', 'LService;']] }),
    item('LCONST_C', { op: 'bipush', arg: '10' }),
    item('LARG_C', { op: 'iload', arg: '5' }),
    item('LACTION', { op: 'invokevirtual', arg: ['Method', 'Service', ['act', '(II)V']] }),
    item('LUPDATE', { op: 'aload_0' }),
    item('LUPDATE_ARG', { op: 'bipush', arg: '-92' }),
    item('LUPDATE_CALL', { op: 'invokespecial', arg: ['Method', 'Owner', ['update', '(I)V']] }),
    item('LSHARED_TAIL', { op: 'getstatic', arg: ['Field', 'ServiceHolder', ['service', 'LService;']] }),
    item('LTAIL_ARG', { op: 'bipush', arg: '-108' }),
    item('LTAIL_CALL', { op: 'invokevirtual', arg: ['Method', 'Service', ['flush', '(B)V']] }),
    item('LTAIL_GOTO', { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_FALLTHROUGH_CONTINUATION_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(Z)V', codeItems)));
  assert.equal(result.changed, true, 'shared invoke-exit tail should be cloned for conditional branches');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSFTC_')), 'shared invoke tail clone should use existing shared-fallthrough prefix');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction, { op: 'ifne', arg: 'LRECV_B' });
}

{
  const codeItems = padded([
    item('LFLAG_A', { op: 'iload', arg: '1' }),
    item('LBRANCH_A', { op: 'ifeq', arg: 'LSHARED_TAIL' }),
    item('LFLAG_B', { op: 'iload', arg: '2' }),
    item('LBRANCH_B', { op: 'ifne', arg: 'LSHARED_TAIL' }),
    item('LWORK', 'aload_0'),
    item('LWORK_ARG', 'iconst_0'),
    item('LWORK_CALL', { op: 'invokevirtual', arg: ['Method', 'Owner', ['work', '(Z)V']] }),
    item('LSHARED_TAIL', { op: 'aload', arg: '8' }),
    item('LTAIL_ARG', 'iconst_0'),
    item('LTAIL_CALL', { op: 'invokevirtual', arg: ['Method', 'Item', ['set', '(Z)V']] }),
    item('LTAIL_GOTO', { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_FALLTHROUGH_CONTINUATION_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared boolean invoke-exit tail should be cloned');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSFTC_')), 'boolean invoke tail clone should use shared-fallthrough prefix');
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

{
  const codeItems = padded([
    item('LSAVED', { op: 'iload', arg: '5' }),
    item('LSTATIC_LOAD', { op: 'getstatic', arg: ['Field', 'State', ['enabled', 'Z']] }),
    item('LBRANCH', { op: 'ifne', arg: 'LTRUE_RENDER' }),
    item('LSIDE_CONST', { op: 'bipush', arg: '124' }),
    item('LSIDE_EFFECT', { op: 'invokestatic', arg: ['Method', 'Hooks', ['mark', '(B)V']] }),
    item('LSIDE_FLAG', { op: 'iload', arg: '7' }),
    item('LSIDE_SKIP', { op: 'ifne', arg: 'LRESTORE' }),
    item('LSIDE_DRAW', { op: 'getstatic', arg: ['Field', 'Canvas', ['surface', 'LCanvas;']] }),
    item('LSIDE_X', 'iconst_0'),
    item('LSIDE_Y', 'iconst_0'),
    item('LSIDE_CALL', { op: 'invokevirtual', arg: ['Method', 'Canvas', ['draw', '(II)V']] }),
    item('LSIDE_GOTO', { op: 'goto', arg: 'LRESTORE' }),
    item('LTRUE_RENDER', { op: 'getstatic', arg: ['Field', 'Overlay', ['overlay', 'LOverlay;']] }),
    item('LTRUE_ONE', 'iconst_1'),
    item('LTRUE_CALL', { op: 'invokevirtual', arg: ['Method', 'Overlay', ['set', '(Z)V']] }),
    item('LTRUE_FLAG', { op: 'iload', arg: '7' }),
    item('LTRUE_FALSE_BRANCH', { op: 'ifeq', arg: 'LTRUE_FALSE' }),
    item('LTRUE_GOTO_RESTORE', { op: 'goto', arg: 'LRESTORE' }),
    item('LTRUE_FALSE', { op: 'getstatic', arg: ['Field', 'Canvas', ['surface', 'LCanvas;']] }),
    item('LTRUE_FALSE_X', 'iconst_0'),
    item('LTRUE_FALSE_Y', 'iconst_0'),
    item('LTRUE_FALSE_CALL', { op: 'invokevirtual', arg: ['Method', 'Canvas', ['draw', '(II)V']] }),
    item('LRESTORE', { op: 'iload', arg: '5' }),
    item('LRESTORE_STATIC', { op: 'putstatic', arg: ['Field', 'State', ['enabled', 'Z']] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_STATIC_BOOLEAN_RENDER_RESTORE_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared static boolean render restore tail should clone by shape');
  assert.equal(result.rewrites, 1);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction, { op: 'ifeq', arg: 'LSIDE_CONST' });
  assert.ok(codeItems.some((entry) => String(entry.labelDef || '').startsWith('LCKRREST_')));
}

{
  const codeItems = padded([
    item('LFLAG', { op: 'aload', arg: '2' }),
    item('LGET_FLAG', { op: 'getfield', arg: ['Field', 'Actor', ['flag', 'Z']] }),
    item('LBRANCH1', { op: 'ifeq', arg: 'LJOIN_TAIL' }),
    item('LMODE', { op: 'aload', arg: '0' }),
    item('LGET_MODE', { op: 'getfield', arg: ['Field', 'Owner', ['mode', 'I']] }),
    item('LSEVEN', 'iconst_7'),
    item('LBRANCH2', { op: 'if_icmpne', arg: 'LJOIN_TAIL' }),
    item('LFALL', { op: 'aload', arg: '0' }),
    item('LCALL', { op: 'invokevirtual', arg: ['Method', 'Owner', ['mark', '(IIB)V']] }),
    item('LJOIN_TAIL', { op: 'bipush', arg: '-4' }),
    item('LJOIN_CONST', { op: 'sipush', arg: '6836' }),
    item('LJOIN_CALL', { op: 'invokestatic', arg: ['Method', 'Notify', ['show', '(II)V']] }),
    item('LJOIN_GOTO', { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_STATIC_INVOKE_JOIN_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared static invoke join tails should be cloned by shape');
  assert.equal(result.rewrites, 2);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH1:').instruction, { op: 'ifne', arg: 'LMODE' });
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH2:').instruction, { op: 'if_icmpeq', arg: 'LFALL' });
}

{
  const codeItems = padded([
    item('LHEAD', { op: 'aload', arg: '4' }),
    item('LNULL', { op: 'ifnull', arg: 'LDONE' }),
    item('LCHECK', { op: 'aload', arg: '4' }),
    item('LINSTANCE', { op: 'instanceof', arg: 'Special' }),
    item('LIF_SPECIAL', { op: 'ifne', arg: 'LSPECIAL' }),
    item('LGOTO_SUMMARY', { op: 'goto', arg: 'LSUMMARY' }),
    item('LSPECIAL', { op: 'aload', arg: '4' }),
    item('LCAST', { op: 'checkcast', arg: 'Special' }),
    item('LFLAG', { op: 'getfield', arg: ['Field', 'Special', ['flag', 'Z']] }),
    item('LSKIP_INC', { op: 'ifne', arg: 'LSUMMARY' }),
    item('LTHIS', 'aload_0'),
    item('LDUP', 'dup'),
    item('LCOUNT', { op: 'getfield', arg: ['Field', 'Owner', ['count', 'I']] }),
    item('LONE', 'iconst_1'),
    item('LADD', 'iadd'),
    item('LSTORE', { op: 'putfield', arg: ['Field', 'Owner', ['count', 'I']] }),
    item('LSUMMARY', { op: 'aload', arg: '4' }),
    item('LZ', { op: 'getfield', arg: ['Field', 'Base', ['z', 'I']] }),
    item('LHAS_Z', { op: 'ifgt', arg: 'LCOUNT_ARRAY' }),
    item('LCHECK_G', { op: 'aload', arg: '4' }),
    item('LINSTANCE_G', { op: 'instanceof', arg: 'Other' }),
    item('LNO_G', { op: 'ifeq', arg: 'LNEXT_KIND' }),
    item('LCOUNT_ARRAY', { op: 'aload', arg: '0' }),
    item('LARRAY', { op: 'getfield', arg: ['Field', 'Owner', ['counts', '[I']] }),
    item('LIDX0', 'iconst_0'),
    item('LIDX1', 'dup2'),
    item('LALOAD', 'iaload'),
    item('LINC', 'iconst_1'),
    item('LADD2', 'iadd'),
    item('LASTORE', 'iastore'),
    item('LNEXT_KIND', { op: 'aload', arg: '4' }),
    item('LINSTANCE_MORE', { op: 'instanceof', arg: 'More' }),
    item('LNO_MORE', { op: 'ifeq', arg: 'LLATCH' }),
    item('LMORE_CALL', { op: 'aload', arg: '4' }),
    item('LMORE_INVOKE', { op: 'invokevirtual', arg: ['Method', 'Base', ['touch', '(B)V']] }),
    item('LLATCH', { op: 'aload', arg: '0' }),
    item('LLIST', { op: 'getfield', arg: ['Field', 'Owner', ['list', 'LList;']] }),
    item('LNEXT_ARG', 'iconst_0'),
    item('LNEXT_CALL', { op: 'invokevirtual', arg: ['Method', 'List', ['next', '(Z)LBase;']] }),
    item('LSTORE_NEXT', { op: 'astore', arg: '4' }),
    item('LBACK', { op: 'goto', arg: 'LHEAD' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_INSTANCEOF_SUMMARY_BODY_CLONE: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'instanceof false summary body should be cloned by shape');
  assert.equal(result.rewrites, 1);
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LGOTO_SUMMARY:').instruction, { op: 'goto', arg: 'LSUMMARY' });
}

{
  const codeItems = padded([
    item('LPREV_CONST', { op: 'bipush', arg: '-7' }),
    item('LPREV_LOAD', { op: 'aload', arg: '3' }),
    item('LPREV_FIELD', { op: 'getfield', arg: ['Field', 'Thing', ['kind', 'I']] }),
    item('LPREV_NOT', 'iconst_m1'),
    item('LPREV_XOR', 'ixor'),
    item('LDUMMY', { op: 'iload', arg: '20' }),
    item('LDUMMY_BRANCH', { op: 'ifne', arg: 'LCOMPARE_BODY' }),
    item('LPREV_COMPARE', { op: 'if_icmpeq', arg: 'LPREV_BODY' }),
    item('LPREV_SKIP', { op: 'goto', arg: 'LNEXT_LOOP' }),
    item('LPREV_BODY', { op: 'aload', arg: '3' }),
    item('LPREV_CALL', { op: 'invokevirtual', arg: ['Method', 'Thing', ['draw', '(I)V']] }),
    item('LNEXT_LOOP', { op: 'aload', arg: '3' }),
    item('LNEXT_FIELD', { op: 'getfield', arg: ['Field', 'Thing', ['kind', 'I']] }),
    item('LNEXT_NOT', 'iconst_m1'),
    item('LNEXT_XOR', 'ixor'),
    item('LNEXT_CONST', { op: 'bipush', arg: '-6' }),
    item('LCOMPARE_BODY', { op: 'if_icmpne', arg: 'LADVANCE' }),
    item('LBODY_LOAD', { op: 'aload', arg: '3' }),
    item('LBODY_SCORE', { op: 'invokevirtual', arg: ['Method', 'Thing', ['score', '(I)I']] }),
    item('LBODY_STORE', { op: 'istore', arg: '4' }),
    item('LBODY_DRAW', { op: 'aload', arg: '3' }),
    item('LBODY_CALL', { op: 'invokevirtual', arg: ['Method', 'Thing', ['draw', '(I)V']] }),
    item('LADVANCE', { op: 'aload', arg: '0' }),
    item('LITER', { op: 'invokevirtual', arg: ['Method', 'Iter', ['next', '()LThing;']] }),
    item('LSTORE_NEXT', { op: 'astore', arg: '3' }),
    item('LLOOP_GUARD', { op: 'iload', arg: '20' }),
    item('LLOOP_BACK', { op: 'ifeq', arg: 'LNEXT_LOOP' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STACK_CARRIED_FORWARD_COMPARE_BODY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'stack-carried forward compare body should be cloned by shape');
  assert.equal(result.rewrites, 1);
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LDUMMY_BRANCH:').instruction, { op: 'ifeq', arg: 'LPREV_COMPARE' });
}

{
  const codeItems = padded([
    item('LGUARD_A_LEFT', 'iconst_0'),
    item('LGUARD_A_VALUE', { op: 'iload', arg: '5' }),
    item('LGUARD_A', { op: 'if_icmpgt', arg: 'LPREDICATE' }),
    item('LGUARD_B_LOAD', { op: 'iload', arg: '6' }),
    item('LGUARD_B', { op: 'ifne', arg: 'LPREDICATE' }),
    item('LPRIMARY_LOAD', { op: 'aload', arg: '2' }),
    item('LPRIMARY_CALL', { op: 'invokestatic', arg: ['Method', 'Probe', ['hit', '(Ljava/lang/Object;)Z']] }),
    item('LPRIMARY_FALSE', { op: 'ifeq', arg: 'LPREDICATE' }),
    item('LPRIMARY_SUCCESS_OBJ', { op: 'aload', arg: '0' }),
    item('LPRIMARY_SUCCESS_CALL', { op: 'invokevirtual', arg: ['Method', 'Worker', ['accept', '()V']] }),
    item('LPRIMARY_DONE', { op: 'goto', arg: 'LDONE' }),
    item('LPREDICATE', { op: 'aload', arg: '0' }),
    item('LPRED_ARG_A', { op: 'iload', arg: '7' }),
    item('LPRED_ARG_B', { op: 'getstatic', arg: ['Field', 'State', ['target', 'LObject;']] }),
    item('LPRED_ARG_C', { op: 'iload', arg: '8' }),
    item('LPRED_ARG_D', 'iconst_m1'),
    item('LPRED_CALL', { op: 'invokevirtual', arg: ['Method', 'Worker', ['fallback', '(ILjava/lang/Object;II)Z']] }),
    item('LPRED_FALSE', { op: 'ifeq', arg: 'LDONE' }),
    item('LSUCCESS_FLAG', { op: 'aload', arg: '0' }),
    item('LSUCCESS_GUARD', { op: 'getfield', arg: ['Field', 'Worker', ['flag', 'Z']] }),
    item('LSUCCESS_SKIP', { op: 'ifne', arg: 'LSUCCESS_CALL' }),
    item('LSUCCESS_LOAD', { op: 'aload', arg: '0' }),
    item('LSUCCESS_REWARD', { op: 'invokevirtual', arg: ['Method', 'Worker', ['reward', '()V']] }),
    item('LSUCCESS_CALL', { op: 'aload', arg: '0' }),
    item('LSUCCESS_ACCEPT', { op: 'invokevirtual', arg: ['Method', 'Worker', ['accept', '()V']] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_FORWARD_BOOLEAN_PREDICATE_PREFIX: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared forward boolean predicate prefix should be cloned by shape');
  assert.equal(result.rewrites, 3);
  assert.equal(
    codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LPREDICATE').length,
    0,
    'predicate prefix should no longer be a shared branch target',
  );
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBPRED_')), 'predicate clone should use private labels');
  assert.ok(codeItems.some((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LSUCCESS_FLAG'));
}

{
  const codeItems = padded([
    item('LCHECK_FLAG_OBJ', { op: 'aload', arg: '1' }),
    item('LCHECK_FLAG', { op: 'getfield', arg: ['Field', 'Cell', ['ready', 'Z']] }),
    item('LBRANCH_READY', { op: 'ifeq', arg: 'LRESET' }),
    item('LCHECK_SPEED', { op: 'iload', arg: '2' }),
    item('LCHECK_MIN', { op: 'bipush', arg: '20' }),
    item('LBRANCH_SPEED', { op: 'if_icmplt', arg: 'LRESET' }),
    item('LCHECK_BLOCKED_OBJ', { op: 'aload', arg: '1' }),
    item('LCHECK_BLOCKED', { op: 'getfield', arg: ['Field', 'Cell', ['blocked', 'Z']] }),
    item('LBLOCKED_TRUE', { op: 'ifne', arg: 'LLOCAL_RESET' }),
    item('LSET_OBJ', { op: 'aload', arg: '1' }),
    item('LSET_TRUE', 'iconst_1'),
    item('LSET_FIELD', { op: 'putfield', arg: ['Field', 'Cell', ['active', 'Z']] }),
    item('LSIDE_EFFECT_FLAG', { op: 'getstatic', arg: ['Field', 'State', ['enabled', 'Z']] }),
    item('LSIDE_EFFECT_SKIP', { op: 'ifeq', arg: 'LLOCAL_RESET' }),
    item('LSIDE_EFFECT_CALL', { op: 'invokestatic', arg: ['Method', 'State', ['emit', '()V']] }),
    item('LRESET', 'iconst_0'),
    item('LRESET_A', { op: 'putstatic', arg: ['Field', 'State', ['dx', 'I']] }),
    item('LRESET_ZERO_B', 'iconst_0'),
    item('LRESET_B', { op: 'putstatic', arg: ['Field', 'State', ['dy', 'I']] }),
    item('LRESET_EXIT', { op: 'goto', arg: 'LDONE' }),
    item('LLOCAL_RESET', 'iconst_0'),
    item('LLOCAL_RESET_A', { op: 'putstatic', arg: ['Field', 'State', ['dx', 'I']] }),
    item('LLOCAL_RESET_ZERO_B', 'iconst_0'),
    item('LLOCAL_RESET_B', { op: 'putstatic', arg: ['Field', 'State', ['dy', 'I']] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_STATIC_ZERO_PAIR_GOTO_RESET: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared static zero-pair goto reset should clone branch targets by shape');
  assert.equal(result.rewrites, 2);
  assert.equal(
    codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LRESET').length,
    0,
    'guard branches should no longer jump directly to the shared reset label',
  );
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKZRESET_')), 'reset clone should use private labels');
}

{
  const codeItems = padded([
    item('LCOND_A', { op: 'iload', arg: '4' }),
    item('LCOND_A_BRANCH', { op: 'ifne', arg: 'LSKIP_ASSIGN' }),
    item('LASSIGN_RECEIVER', { op: 'aload', arg: '0' }),
    item('LASSIGN_VALUE', { op: 'bipush', arg: '-5' }),
    item('LASSIGN_FIELD', { op: 'putfield', arg: ['Field', 'Panel', ['selected', 'I']] }),
    item('LASSIGN_JUMP', { op: 'goto', arg: 'LCOMMON_TAIL' }),
    item('LSKIP_ASSIGN', { op: 'aload', arg: '0' }),
    item('LSKIP_VALUE', { op: 'bipush', arg: '-4' }),
    item('LSKIP_FIELD', { op: 'putfield', arg: ['Field', 'Panel', ['selected', 'I']] }),
    item('LCOMMON_TAIL', { op: 'iload', arg: '3' }),
    item('LCOMMON_NEG', 'iconst_m1'),
    item('LCOMMON_XOR', 'ixor'),
    item('LCOMMON_LIMIT', { op: 'bipush', arg: '-40' }),
    item('LCOMMON_BRANCH_A', { op: 'if_icmpge', arg: 'LDONE' }),
    item('LCOMMON_LOAD_B', { op: 'iload', arg: '3' }),
    item('LCOMMON_HIGH', { op: 'bipush', arg: '90' }),
    item('LCOMMON_BRANCH_B', { op: 'if_icmpge', arg: 'LDONE' }),
    item('LCOMMON_RECEIVER', { op: 'aload', arg: '0' }),
    item('LCOMMON_SET', { op: 'bipush', arg: '-2' }),
    item('LCOMMON_FIELD', { op: 'putfield', arg: ['Field', 'Panel', ['selected', 'I']] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_ASSIGNMENT_GOTO_COMMON_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'assignment goto common tail should clone bounded tail by shape');
  assert.equal(result.rewrites, 1);
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LASSIGN_JUMP:').instruction, { op: 'goto', arg: 'LCOMMON_TAIL' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKASGT_')), 'assignment tail clone should use private labels');
}

{
  const codeItems = padded([
    item('LLOAD_COUNT', { op: 'iload', arg: '2' }),
    item('LLIMIT', { op: 'bipush', arg: '105' }),
    item('LBRANCH', { op: 'if_icmple', arg: 'LALLOC' }),
    item('LFAST', { op: 'iload', arg: '2' }),
    item('LFAST_RET', 'ireturn'),
    item('LALLOC', { op: 'getstatic', arg: ['Field', 'State', ['next', 'LState;']] }),
    item('LSET_STATE', { op: 'putstatic', arg: ['Field', 'State', ['current', 'LState;']] }),
    item('LBASE', { op: 'bipush', arg: '-100' }),
    item('LCOUNT', { op: 'iload', arg: '2' }),
    item('LSIZE', 'iadd'),
    item('LNEW', { op: 'anewarray', arg: 'java/lang/String' }),
    item('LSTORE', { op: 'putstatic', arg: ['Field', 'State', ['names', '[Ljava/lang/String;']] }),
    item('LJOIN', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STATE_ARRAY_ALLOCATION_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'state array allocation tail should clone branch target by shape');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction.arg, 'LFAST');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSTATEARR_')), 'state array clone should use private labels');
}

{
  const codeItems = padded([
    item('LCHECK_FIELD', { op: 'getfield', arg: ['Field', 'Node', ['enabled', 'Z']] }),
    item('LBRANCH_FALSE', { op: 'ifeq', arg: 'LFALSE_TAIL' }),
    item('LCHECK_VALUE', { op: 'iload', arg: '2' }),
    item('LCHECK_CONST', 'iconst_5'),
    item('LCHECK_EQ', { op: 'if_icmpeq', arg: 'LTRUE_TAIL' }),
    item('LTRUE_TAIL', 'iconst_1'),
    item('LTRUE_JOIN', { op: 'goto', arg: 'LSTORE' }),
    item('LFALSE_TAIL', 'iconst_0'),
    item('LFALSE_JOIN', { op: 'goto', arg: 'LSTORE' }),
    item('LSTORE', { op: 'istore', arg: '6' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_CONDITIONAL_BOOLEAN_LOCAL_CONSTANT_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'conditional boolean local constant tail should materialize branch-owned constants');
  assert.equal(result.rewrites, 2);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LBRANCH_FALSE:').instruction.arg, 'LFALSE_TAIL');
}

{
  const codeItems = padded([
    item('LPRE_COND', { op: 'invokestatic', arg: ['Method', 'Input', ['needsChar', '()Z']] }),
    item('LBRANCH_APPEND', { op: 'ifne', arg: 'LAPPEND' }),
    item('LSKIP_BRANCH', { op: 'goto', arg: 'LJOIN' }),
    item('LPRE_GOTO', { op: 'iload', arg: '1' }),
    item('LGOTO_APPEND', { op: 'goto', arg: 'LAPPEND' }),
    item('LAPPEND', { op: 'aload', arg: '0' }),
    item('LBUILDER', { op: 'getfield', arg: ['Field', 'Form', ['buf', 'Ljava/lang/StringBuilder;']] }),
    item('LCHAR', { op: 'iload', arg: '2' }),
    item('LCALL', { op: 'invokevirtual', arg: ['Method', 'java/lang/StringBuilder', ['append', '(C)Ljava/lang/StringBuilder;']] }),
    item('LPOP', 'pop'),
    item('LAPPEND_DONE', { op: 'goto', arg: 'LJOIN' }),
    item('LJOIN', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STRING_BUILDER_CHAR_APPEND_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'string builder char append tail should be cloned by shape');
  assert.equal(result.rewrites, 3);
  assert.equal(
    codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LAPPEND').length,
    0,
    'append-tail entries should no longer share the append label',
  );
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSBAPP_')), 'append tail clone should use private labels');
}

{
  const codeItems = padded([
    item('LCHECK', { op: 'getstatic', arg: ['Field', 'State', ['ready', 'Z']] }),
    item('LBRANCH', { op: 'ifeq', arg: 'LLOCAL_RETURN' }),
    item('LJUMP_TAIL', { op: 'goto', arg: 'LTERMINAL_TAIL' }),
    item('LLOCAL_RETURN', 'iconst_0'),
    item('LLOCAL_IRETURN', 'ireturn'),
    item('LTERMINAL_TAIL', { op: 'bipush', arg: '74' }),
    item('LLOAD', { op: 'iload', arg: '4' }),
    item('LSUB', 'isub'),
    item('LSTORE', { op: 'istore', arg: '5' }),
    item('LRESULT', 'iconst_m1'),
    item('LRETURN', 'ireturn'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SMALL_FORWARD_TERMINAL_GOTO_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()I', codeItems)));
  assert.equal(result.changed, true, 'small forward terminal goto tail should be cloned by shape');
  assert.equal(result.rewrites, 1);
  assert.equal(
    codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LTERMINAL_TAIL').length,
    0,
    'terminal tail goto should be replaced by a local copy',
  );
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKTERMTAIL_')), 'terminal tail clone should use private labels');
}

{
  const codeItems = padded([
    item('LCMP_A_LOAD', { op: 'iload', arg: '2' }),
    item('LCMP_A_CONST', 'iconst_1'),
    item('LCMP_A', { op: 'if_icmpne', arg: 'LCASE_B_CHECK' }),
    item('LCASE_A_VALUE', { op: 'aload', arg: '0' }),
    item('LCASE_A_CALL', { op: 'invokevirtual', arg: ['Method', 'Store', ['first', '()Ljava/lang/Object;']] }),
    item('LCASE_A_STORE', { op: 'astore', arg: '4' }),
    item('LCASE_A_JOIN', { op: 'goto', arg: 'LJOIN' }),
    item('LCASE_B_CHECK', { op: 'iload', arg: '2' }),
    item('LCASE_B_CONST', 'iconst_2'),
    item('LCASE_B_BRANCH', { op: 'if_icmpeq', arg: 'LCASE_C' }),
    item('LCASE_B_VALUE', { op: 'aload', arg: '0' }),
    item('LCASE_B_CALL', { op: 'invokevirtual', arg: ['Method', 'Store', ['second', '()Ljava/lang/Object;']] }),
    item('LCASE_B_STORE', { op: 'astore', arg: '4' }),
    item('LCASE_B_JOIN', { op: 'goto', arg: 'LJOIN' }),
    item('LCASE_C', { op: 'aconst_null' }),
    item('LCASE_C_GUARD', { op: 'ifnonnull', arg: 'LCASE_C_BODY' }),
    item('LCASE_C_THROW_NEW', { op: 'new', arg: 'java/lang/RuntimeException' }),
    item('LCASE_C_THROW_DUP', 'dup'),
    item('LCASE_C_THROW_INIT', { op: 'invokespecial', arg: ['Method', 'java/lang/RuntimeException', ['<init>', '()V']] }),
    item('LCASE_C_THROW', 'athrow'),
    item('LCASE_C_BODY', { op: 'aload', arg: '0' }),
    item('LCASE_C_CALL', { op: 'invokevirtual', arg: ['Method', 'Store', ['third', '()Ljava/lang/Object;']] }),
    item('LCASE_C_STORE', { op: 'astore', arg: '4' }),
    item('LJOIN', { op: 'aload', arg: '4' }),
    item('LDONE', 'areturn'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_FORWARD_CASE_JOIN_BODY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()Ljava/lang/Object;', codeItems)));
  assert.equal(result.changed, true, 'forward case join body should be cloned by shape');
  assert.equal(result.rewrites, 1);
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'LCASE_B_BRANCH:').instruction.arg, 'LCASE_C');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKCASEJOIN_')), 'case join clone should use private labels');
}

{
  const codeItems = padded([
    item('LLEFT_CALL', { op: 'invokevirtual', arg: ['Method', 'Node', ['draw', '()V']] }),
    item('LLEFT_TO_CONT', { op: 'goto', arg: 'LCONT' }),
    item('LRIGHT_CALL', { op: 'invokevirtual', arg: ['Method', 'Node', ['draw', '()V']] }),
    item('LRIGHT_TO_CONT', { op: 'goto', arg: 'LCONT' }),
    item('LCONT', { op: 'aload', arg: '5' }),
    item('LCHECK_FLAG', { op: 'invokevirtual', arg: ['Method', 'Panel', ['visible', '()Z']] }),
    item('LIF_EXIT', { op: 'ifeq', arg: 'LEXIT' }),
    item('LLOAD_CHILD', { op: 'aload', arg: '6' }),
    item('LNULL_EXIT', { op: 'ifnull', arg: 'LEXIT' }),
    item('LCALL_CHILD', { op: 'invokevirtual', arg: ['Method', 'Node', ['draw', '()V']] }),
    item('LDONE_GOTO', { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_FORWARD_EXIT_CONTINUATION: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'shared forward exit continuation should be cloned by shape');
  assert.equal(result.rewrites, 2);
  assert.equal(
    codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LCONT').length,
    0,
    'plain gotos should no longer share the forward continuation label',
  );
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKEXITCONT_')), 'exit continuation clone should use private labels');
}

{
  const codeItems = padded([
    item('LPRE_A_ARG', { op: 'bipush', arg: '-1' }),
    item('LPRE_A_CHECK', { op: 'invokestatic', arg: ['Method', 'Input', ['poll', '(B)Z']] }),
    item('LPRE_A_EXIT', { op: 'ifeq', arg: 'LDONE' }),
    item('LPRE_A_GOTO', { op: 'goto', arg: 'LBODY' }),
    item('LPRE_B_ARG', { op: 'bipush', arg: '-1' }),
    item('LPRE_B_CHECK', { op: 'invokestatic', arg: ['Method', 'Input', ['poll', '(B)Z']] }),
    item('LPRE_B_EXIT', { op: 'ifeq', arg: 'LDONE' }),
    item('LPRE_B_GOTO', { op: 'goto', arg: 'LBODY' }),
    item('LHEADER_ARG', { op: 'bipush', arg: '-1' }),
    item('LHEADER_CHECK', { op: 'invokestatic', arg: ['Method', 'Input', ['poll', '(B)Z']] }),
    item('LHEADER_EXIT', { op: 'ifeq', arg: 'LDONE' }),
    item('LBODY', { op: 'getstatic', arg: ['Field', 'Input', ['key', 'I']] }),
    item('LKEY_CHECK', { op: 'ifne', arg: 'LACTION' }),
    item('LNOOP', { op: 'goto', arg: 'LHEADER_ARG' }),
    item('LACTION', { op: 'invokestatic', arg: ['Method', 'Input', ['act', '()V']] }),
    item('LACTION_BACK', { op: 'goto', arg: 'LHEADER_ARG' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_CHECKED_LOOP_BODY_ENTRIES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'checked loop body entries should clone first body pass by shape');
  assert.equal(result.rewrites, 2);
  assert.equal(
    codeItems.filter((entry) => entry.instruction && entry.instruction.arg === 'LBODY').length,
    0,
    'checked entry gotos should no longer share the body label',
  );
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKCHKLOOP_')), 'checked loop clone should use private labels');
}

{
  const codeItems = padded([
    item('LPRE_ARG', { op: 'iload', arg: '1' }),
    item('LPRE_FLAG', { op: 'bipush', arg: '-17' }),
    item('LPRE_CHECK', { op: 'invokevirtual', arg: ['Method', 'Input', ['poll', '(IB)Z']] }),
    item('LPRE_EXIT', { op: 'ifne', arg: 'LDONE' }),
    item('LPRE_GOTO', { op: 'goto', arg: 'LBODY_SUFFIX' }),
    item('LHEADER_ARG', { op: 'iload', arg: '1' }),
    item('LHEADER_FLAG', { op: 'bipush', arg: '-17' }),
    item('LHEADER_CHECK', { op: 'invokevirtual', arg: ['Method', 'Input', ['poll', '(IB)Z']] }),
    item('LHEADER_EXIT', { op: 'ifne', arg: 'LDONE' }),
    item('LBODY_SUFFIX', { op: 'aload', arg: '0' }),
    item('LBODY_ACTION', { op: 'invokevirtual', arg: ['Method', 'Input', ['advance', '()V']] }),
    item('LBODY_BACK', { op: 'goto', arg: 'LHEADER_ARG' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_CHECKED_LOOP_BODY_SUFFIX_ENTRIES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'checked loop body suffix entries should clone short body suffixes by shape');
  assert.equal(result.rewrites, 1);
  assert.notDeepEqual(codeItems.find((entry) => entry.labelDef === 'LPRE_GOTO:').instruction, { op: 'goto', arg: 'LBODY_SUFFIX' });
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKCHKSUF_')), 'checked loop suffix clone should use private labels');
}

{
  const codeItems = padded([
    item('LCALL', { op: 'invokestatic', arg: ['Method', 'Guard', ['poll', '()Z']] }),
    item('LGO', { op: 'goto', arg: 'LCOND' }),
    item('LPOLL', { op: 'invokestatic', arg: ['Method', 'Guard', ['poll', '()Z']] }),
    item('LCOND', { op: 'ifne', arg: 'LBODY' }),
    item('LRET', 'return'),
    item('LBODY', { op: 'getstatic', arg: ['Field', 'State', ['value', 'I']] }),
    item('LSTORE', { op: 'istore', arg: '4' }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_STACK_BOOLEAN_TERMINAL_GOTO: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'stack boolean goto to terminal condition should materialize locally');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LGO:').instruction, { op: 'ifne', arg: 'LBODY' });
  assert.equal(codeItems[2].instruction, 'return');
}

{
  const codeItems = padded([
    item('LGO', { op: 'goto', arg: 'LTAIL' }),
    item('LGO2', { op: 'goto', arg: 'LTAIL' }),
    item('LFALLTHROUGH', 'iconst_0'),
    item('LTAIL', 'iconst_1'),
    item('LPUT', { op: 'putstatic', arg: ['Field', 'State', ['flag', 'Z']] }),
    item('LJOIN', { op: 'goto', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_FORWARD_GOTO_CONTINUATIONS: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'plain goto into shared forward continuation should be cloned by shape');
  const sourceIndex = codeItems.findIndex((entry) => entry.labelDef === 'LGO:');
  assert.equal(codeItems[sourceIndex + 1].instruction, 'iconst_1');
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'putstatic').length, 2);
}

{
  const codeItems = padded([
    item('LEARLY_HEAD', { op: 'iload', arg: '2' }),
    item('LEARLY_OBJ', { op: 'aload', arg: '5' }),
    item('LEARLY_CAST', { op: 'checkcast', arg: 'Node' }),
    item('LEARLY_LEN', { op: 'getfield', arg: ['Field', 'Node', ['count', 'I']] }),
    item('LEARLY_EXIT', { op: 'if_icmpge', arg: 'LNEXT_OUTER' }),
    item('LEARLY_ARRAY_OBJ', { op: 'aload', arg: '5' }),
    item('LEARLY_ARRAY', { op: 'getfield', arg: ['Field', 'Node', ['items', '[LNode;']] }),
    item('LEARLY_INDEX', { op: 'iload', arg: '2' }),
    item('LEARLY_LOAD', 'aaload'),
    item('LEARLY_STORE', { op: 'astore', arg: '3' }),
    item('LEARLY_TEST', { op: 'aload', arg: '3' }),
    item('LEARLY_NULL', { op: 'ifnull', arg: 'LSHARED_NULL' }),
    item('LEARLY_NON_NULL_GOTO', { op: 'goto', arg: 'LSHARED_NON_NULL' }),
    item('LSIB_HEAD', { op: 'iload', arg: '2' }),
    item('LSIB_OBJ', { op: 'aload', arg: '6' }),
    item('LSIB_CAST', { op: 'checkcast', arg: 'Node' }),
    item('LSIB_LEN', { op: 'getfield', arg: ['Field', 'Node', ['count', 'I']] }),
    item('LSIB_EXIT', { op: 'if_icmpge', arg: 'LNEXT_OUTER' }),
    item('LSIB_ARRAY_OBJ', { op: 'aload', arg: '6' }),
    item('LSIB_ARRAY', { op: 'getfield', arg: ['Field', 'Node', ['items', '[LNode;']] }),
    item('LSIB_INDEX', { op: 'iload', arg: '2' }),
    item('LSIB_LOAD', 'aaload'),
    item('LSIB_STORE', { op: 'astore', arg: '3' }),
    item('LSIB_TEST', { op: 'aload', arg: '3' }),
    item('LSIB_NULL_BRANCH', { op: 'ifnull', arg: 'LSHARED_NULL' }),
    item('LSIB_NON_NULL_GOTO', { op: 'goto', arg: 'LSHARED_NON_NULL' }),
    item('LSHARED_NULL', { op: 'aload', arg: '6' }),
    item('LSHARED_NULL_ARRAY', { op: 'getfield', arg: ['Field', 'Node', ['items', '[LNode;']] }),
    item('LSHARED_NULL_INDEX', { op: 'iload', arg: '2' }),
    item('LSHARED_NULL_SHIFT', 'iconst_m1'),
    item('LSHARED_NULL_SUB', 'isub'),
    item('LSHARED_NULL_CALL', { op: 'invokestatic', arg: ['Method', 'Arrays', ['compact', '([Ljava/lang/Object;I)V']] }),
    item('LSHARED_NULL_INC', { op: 'iinc', arg: ['2', '1'] }),
    item('LSHARED_NULL_BACK', { op: 'goto', arg: 'LSIB_HEAD' }),
    item('LSHARED_NON_NULL', { op: 'getstatic', arg: ['Field', 'State', ['active', 'LState;']] }),
    item('LSHARED_NON_NULL_LOAD', { op: 'aload', arg: '3' }),
    item('LSHARED_NON_NULL_FIELD', { op: 'getfield', arg: ['Field', 'Node', ['state', 'LState;']] }),
    item('LSHARED_NON_NULL_KEEP', { op: 'if_acmpne', arg: 'LSHARED_ADD' }),
    item('LSHARED_NON_NULL_INC', { op: 'iinc', arg: ['2', '1'] }),
    item('LSHARED_NON_NULL_BACK', { op: 'goto', arg: 'LSIB_HEAD' }),
    item('LSHARED_ADD', { op: 'aload', arg: '1' }),
    item('LSHARED_ADD_ARG', { op: 'aload', arg: '3' }),
    item('LSHARED_ADD_CALL', { op: 'invokevirtual', arg: ['Method', 'Queue', ['add', '(LNode;)V']] }),
    item('LSHARED_ADD_INC', { op: 'iinc', arg: ['2', '1'] }),
    item('LSHARED_ADD_BACK', { op: 'goto', arg: 'LSIB_HEAD' }),
    item('LNEXT_OUTER', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SIBLING_LOCAL_SCAN_BODIES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'sibling local scan body should be cloned for the earlier scan');
  assert.equal(result.rewrites, 1);
  assert.ok(String(codeItems.find((entry) => entry.labelDef === 'LEARLY_NULL:').instruction.arg).startsWith('LCKSIB_'));
  assert.ok(String(codeItems.find((entry) => entry.labelDef === 'LEARLY_NON_NULL_GOTO:').instruction.arg).startsWith('LCKSIB_'));
  const clonedNull = codeItems.find((entry) => entry.labelDef && entry.labelDef.startsWith('LCKSIB_') && entry.instruction && entry.instruction.op === 'aload');
  assert.deepEqual(clonedNull.instruction, { op: 'aload', arg: '5' });
  assert.ok(codeItems.some((entry) => entry.instruction && entry.instruction.op === 'goto' && entry.instruction.arg === 'LEARLY_HEAD'));
}

{
  const codeItems = padded([
    item('LLOAD1', { op: 'iload', arg: '1' }),
    item('LIF1', { op: 'ifne', arg: 'LTRUE' }),
    item('LWORK', { op: 'iinc', arg: ['2', '1'] }),
    item('LLOAD2', { op: 'iload', arg: '1' }),
    item('LIF2', { op: 'ifne', arg: 'LALSO_TRUE' }),
    item('LSKIP', { op: 'goto', arg: 'LDONE' }),
    item('LALSO_TRUE', { op: 'iinc', arg: ['2', '1'] }),
    item('LTRUE', { op: 'iinc', arg: ['2', '1'] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(ZI)V', codeItems)));
  assert.equal(result.changed, true, 'same boolean branch in false-dominated region should be removed');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LLOAD2:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LIF2:').instruction, 'nop');
}

{
  const codeItems = padded([
    item('LLOAD1', { op: 'iload', arg: '1' }),
    item('LIF1', { op: 'ifne', arg: 'LTRUE' }),
    item('LCMP_LEFT', { op: 'iload', arg: '2' }),
    item('LCMP_RIGHT', { op: 'iload', arg: '3' }),
    item('LLOAD2', { op: 'iload', arg: '1' }),
    item('LIF2', { op: 'ifne', arg: 'LTRUE' }),
    item('LCOMPARE', { op: 'if_icmplt', arg: 'LWORK' }),
    item('LINCREMENT', { op: 'iinc', arg: ['2', '1'] }),
    item('LWORK', { op: 'iinc', arg: ['3', '1'] }),
    item('LTRUE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '1',
  }, () => runStructuredGotoClone(
    targetAstFrom('renamedOwner', 'renamedMethod', '(ZII)V', codeItems),
  ));
  assert.equal(result.changed, false,
    'a dominated boolean guard is retained when comparison operands are live beneath it');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LIF2:').instruction,
    { op: 'ifne', arg: 'LTRUE' });
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LCOMPARE:').instruction,
    { op: 'if_icmplt', arg: 'LWORK' });
}

{
  const codeItems = padded([
    item('LLOAD1', { op: 'iload', arg: '1' }),
    item('LIF1', { op: 'ifne', arg: 'LTRUE' }),
    item('LCMP_LEFT', { op: 'dload', arg: '2' }),
    item('LCMP_RIGHT', 'dconst_1'),
    item('LDCMP', 'dcmpg'),
    item('LLOAD2', { op: 'iload', arg: '1' }),
    item('LIF2', { op: 'ifne', arg: 'LTRUE' }),
    item('LCOMPARE', { op: 'iflt', arg: 'LWORK' }),
    item('LINCREMENT', { op: 'iinc', arg: ['4', '1'] }),
    item('LWORK', { op: 'iinc', arg: ['5', '1'] }),
    item('LTRUE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '1',
  }, () => runStructuredGotoClone(
    targetAstFrom('renamedOwner', 'renamedMethod', '(ZDII)V', codeItems),
  ));
  assert.equal(result.changed, false,
    'a dominated guard retains a unary comparison result buried beneath it');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LIF2:').instruction,
    { op: 'ifne', arg: 'LTRUE' });
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LCOMPARE:').instruction,
    { op: 'iflt', arg: 'LWORK' });
}

{
  const codeItems = padded([
    item('LBYPASS', { op: 'goto', arg: 'LJOIN' }),
    item('LLOAD1', { op: 'iload', arg: '1' }),
    item('LIF1', { op: 'ifeq', arg: 'LTRUE' }),
    item('LWORK', { op: 'iinc', arg: ['2', '1'] }),
    item('LJOIN', { op: 'iinc', arg: ['2', '1'] }),
    item('LLOAD2', { op: 'iload', arg: '1' }),
    item('LIF2', { op: 'ifeq', arg: 'LTRUE' }),
    item('LFALSE', { op: 'iinc', arg: ['2', '1'] }),
    item('LTRUE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DOMINATED_BOOLEAN_LOCAL_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(ZI)V', codeItems)));
  assert.equal(result.changed, false,
    'a boolean test must not be removed when another branch bypasses its supposed dominator');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LIF2:').instruction,
    { op: 'ifeq', arg: 'LTRUE' });
}

{
  const codeItems = padded([
    item('LCMP_A', { op: 'iload', arg: '2' }),
    item('LCMP_B', 'iconst_1'),
    item('LBRANCH', { op: 'if_icmpeq', arg: 'LSHARED' }),
    item('LFALL_A', { op: 'iload', arg: '3' }),
    item('LFALL_B', 'iconst_0'),
    item('LFALL_BRANCH', { op: 'if_icmpne', arg: 'LSHARED' }),
    item('LFALL_CONST', 'iconst_1'),
    item('LFALL_GOTO', { op: 'goto', arg: 'LSTORE' }),
    item('LSHARED', 'aload_0'),
    item('LSHARED_FIELD', { op: 'getfield', arg: ['Field', 'Owner', ['state', 'I']] }),
    item('LSHARED_CMP', 'iconst_5'),
    item('LSHARED_BRANCH', { op: 'if_icmpne', arg: 'LSHARED_ZERO' }),
    item('LSHARED_ONE', 'iconst_1'),
    item('LSHARED_ONE_GOTO', { op: 'goto', arg: 'LSTORE' }),
    item('LSHARED_ZERO', 'iconst_0'),
    item('LSTORE', { op: 'istore', arg: '4' }),
    item('LUSE', { op: 'iload', arg: '4' }),
    item('LEND', { op: 'ifeq', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_BOOLEAN_STORE_TARGET: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(II)V', codeItems)));
  assert.equal(result.changed, true, 'shared boolean-store conditional target should be cloned');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction.op, 'if_icmpne');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LBRANCH:').instruction.arg, 'LFALL_A');
  assert.equal(codeItems.filter((entry) => entry.instruction && entry.instruction.op === 'istore' && entry.instruction.arg === '4').length, 2);
}

{
  const codeItems = padded([
    item('LEARLY_ARRAY', { op: 'getstatic', arg: ['Field', 'Owner', ['items', '[I']] }),
    item('LEARLY_LEN', 'arraylength'),
    item('LEARLY_MIN', 'iconst_2'),
    item('LEARLY_BRANCH', { op: 'if_icmpge', arg: 'LSHARED_BODY' }),
    item('LEARLY_EXIT', { op: 'goto', arg: 'LEXIT' }),
    item('LNON_MATCHING_WORK', 'iconst_0'),
    item('LNON_MATCHING_STORE', { op: 'istore', arg: '5' }),
    item('LDUP_ARRAY', { op: 'getstatic', arg: ['Field', 'Owner', ['items', '[I']] }),
    item('LDUP_LEN', 'arraylength'),
    item('LDUP_MIN', 'iconst_2'),
    item('LDUP_BRANCH', { op: 'if_icmpge', arg: 'LSETUP' }),
    item('LDUP_EXIT', { op: 'goto', arg: 'LEXIT' }),
    item('LSETUP', 'iconst_1'),
    item('LSETUP_STORE_A', { op: 'istore', arg: '6' }),
    item('LSETUP_ZERO', 'iconst_0'),
    item('LSETUP_STORE_B', { op: 'istore', arg: '7' }),
    item('LSHARED_BODY', { op: 'iload', arg: '7' }),
    item('LSHARED_IF', { op: 'ifeq', arg: 'LEXIT' }),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_ARRAY_LENGTH_PRELOOP_ENTRY: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'duplicate array-length preloop entry should retarget to the canonical guard');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LEARLY_BRANCH:').instruction.arg, 'LDUP_ARRAY');
}

{
  const codeItems = padded([
    item('LPRE_LOAD', { op: 'iload', arg: '2' }),
    item('LPRE_CONST', { op: 'bipush', arg: '13' }),
    item('LPRE_BRANCH', { op: 'if_icmpne', arg: 'LSHARED_CLEAR' }),
    item('LEQ_LOAD_A', { op: 'iload', arg: '1' }),
    item('LEQ_CONST_A', 'iconst_1'),
    item('LEQ_BRANCH_A', { op: 'if_icmpne', arg: 'LDEFAULT_CASE' }),
    item('LPARTIAL_TRUE_A', 'iconst_1'),
    item('LPARTIAL_STORE_A', { op: 'istore', arg: '5' }),
    item('LSHARED_CLEAR', 'aload_0'),
    item('LSHARED_NULL', 'aconst_null'),
    item('LSHARED_PUTFIELD', { op: 'putfield', arg: ['Field', 'Owner', ['stream', 'Ljava/lang/Object;']] }),
    item('LEQ_LOAD_B', { op: 'iload', arg: '1' }),
    item('LEQ_CONST_B', 'iconst_1'),
    item('LEQ_BRANCH_B', { op: 'if_icmpne', arg: 'LDEFAULT_CASE' }),
    item('LFULL_TRUE_A', 'iconst_1'),
    item('LFULL_STORE_A', { op: 'istore', arg: '5' }),
    item('LFULL_TRUE_B', 'iconst_1'),
    item('LFULL_STORE_B', { op: 'istore', arg: '4' }),
    item('LFULL_OBJECT', { op: 'getstatic', arg: ['Field', 'Owner', ['choice', 'Lil;']] }),
    item('LFULL_STORE_OBJECT', { op: 'astore', arg: '3' }),
    item('LFULL_GOTO', { op: 'goto', arg: 'LJOIN' }),
    item('LDEFAULT_CASE', 'iconst_0'),
    item('LDEFAULT_STORE_A', { op: 'istore', arg: '5' }),
    item('LJOIN', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_DUPLICATE_SELECTOR_PARTIAL_SETUP: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(II)V', codeItems)));
  assert.equal(result.changed, true, 'duplicate selector partial setup should split the default case chain');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LEQ_BRANCH_A:').instruction,
    { op: 'if_icmpeq', arg: 'LSHARED_CLEAR' });
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LPARTIAL_TRUE_A:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LPARTIAL_STORE_A:').instruction, 'nop');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKDUPSEL_') &&
    entry.instruction === 'iconst_0'));
}

{
  const codeItems = padded([
    item('LCOND_TRUE_LOAD', { op: 'iload', arg: '1' }),
    item('LCOND_TRUE', { op: 'ifne', arg: 'LONE' }),
    item('LCOND_FALSE_LOAD', { op: 'iload', arg: '2' }),
    item('LCOND_FALSE', { op: 'iflt', arg: 'LZERO' }),
    item('LONE', 'iconst_1'),
    item('LONE_GOTO', { op: 'goto', arg: 'LSTORE' }),
    item('LTHROW_PAD', 'athrow'),
    item('LZERO', 'iconst_0'),
    item('LSTORE', { op: 'istore', arg: '3' }),
    item('LEND', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_PADDED_BOOLEAN_CONSTANT_TAIL: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'athrow-padded boolean constant tail should materialize branch references');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LCOND_TRUE:').instruction.op, 'ifeq');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LCOND_FALSE:').instruction.op, 'ifge');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBOOLTAIL_') &&
    entry.instruction === 'iconst_1'));
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBOOLTAIL_') &&
    entry.instruction === 'iconst_0'));
}

{
  const codeItems = padded([
    item('LKEEP_VALUE', 'iconst_0'),
    item('LNEVER_VALUE', 'iconst_0'),
    item('LNEVER_BRANCH', { op: 'ifne', arg: 'LUNREACHABLE' }),
    item('LSTORE', { op: 'istore', arg: '1' }),
    item('LALWAYS_VALUE', 'iconst_0'),
    item('LALWAYS_BRANCH', { op: 'ifeq', arg: 'LEXIT' }),
    item('LUNREACHABLE', 'return'),
    item('LEXIT', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SIMPLIFY_CONSTANT_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems)));
  assert.equal(result.changed, true, 'never-taken constant boolean branch should be removed');
  assert.equal(result.rewrites, 1);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LNEVER_VALUE:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LNEVER_BRANCH:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LALWAYS_BRANCH:').instruction.op, 'ifeq');
}

{
  const codeItems = padded([
    item('LENTRY_LOAD', { op: 'iload', arg: '0' }),
    item('LENTRY_BRANCH', { op: 'ifne', arg: 'LZERO' }),
    item('LONE', 'iconst_1'),
    item('LONE_GOTO', { op: 'goto', arg: 'LJOIN' }),
    item('LZERO', 'iconst_0'),
    item('LJOIN', { op: 'ifne', arg: 'LTAKEN' }),
    item('LFALL', 'return'),
    item('LTAKEN', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SIMPLIFY_CONSTANT_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(I)V', codeItems)));
  assert.equal(result.changed, false, 'shared boolean consumer must not fold from only one predecessor');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LONE:').instruction, 'iconst_1');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LZERO:').instruction, 'iconst_0');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LJOIN:').instruction.op, 'ifne');
}

{
  const codeItems = padded([
    item('LSTART', { op: 'goto', arg: 'LEND' }),
    item('LDEAD_PAD', 'athrow'),
    item('LREF_BRANCH', { op: 'goto', arg: 'LREFERENCED_PAD' }),
    item('LREFERENCED_PAD', 'athrow'),
    item('LEND', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_REMOVE_DEAD_ATHROW_PADDING: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '()V', codeItems, {
    exceptionTable: [{
      startLbl: 'LSTART',
      endLbl: 'LEND',
      handlerLbl: 'LDEAD_PAD',
      catchType: 'java/lang/RuntimeException',
    }],
  })));
  assert.equal(result.changed, true, 'unreferenced athrow padding after goto should be removed');
  assert.equal(result.rewrites, 2);
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LDEAD_PAD:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LREFERENCED_PAD:').instruction, 'athrow');
}

{
  const codeItems = padded([
    item('LCHECK_ONE_LOAD', { op: 'iload', arg: '4' }),
    item('LCHECK_ONE_CONST', 'iconst_1'),
    item('LCHECK_ONE_BRANCH', { op: 'if_icmpeq', arg: 'LONE' }),
    item('LCHECK_TWO_LOAD', { op: 'iload', arg: '4' }),
    item('LCHECK_TWO_CONST', 'iconst_2'),
    item('LCHECK_TWO_BRANCH', { op: 'if_icmpeq', arg: 'LTWO' }),
    item('LDOM_LOAD', { op: 'iload', arg: '4' }),
    item('LDOM_CONST', 'iconst_2'),
    item('LDOM_BRANCH', { op: 'if_icmpne', arg: 'LOTHER' }),
    item('LTWO', { op: 'iinc', arg: ['1', '1'] }),
    item('LTWO_EXIT', { op: 'goto', arg: 'LDONE' }),
    item('LONE', { op: 'iinc', arg: ['1', '1'] }),
    item('LONE_EXIT', { op: 'goto', arg: 'LDONE' }),
    item('LOTHER', { op: 'iinc', arg: ['1', '1'] }),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SIMPLIFY_DOMINATED_INT_EQUALITY_BRANCHES: '1',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(I)V', codeItems)));
  assert.equal(result.changed, true, 'dominated int equality branch should be simplified');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LDOM_LOAD:').instruction, 'nop');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'LDOM_CONST:').instruction, 'nop');
  assert.deepEqual(codeItems.find((entry) => entry.labelDef === 'LDOM_BRANCH:').instruction, { op: 'goto', arg: 'LOTHER' });
}

{
  const codeItems = padded([
    item('L0', { op: 'getstatic', arg: ['Field', 'owner', ['primary', 'Lnode;']] }),
    item('L1', { op: 'ifnull', arg: 'LFALL' }),
    item('L2', { op: 'getstatic', arg: ['Field', 'owner', ['primary', 'Lnode;']] }),
    item('L3', { op: 'getfield', arg: ['Field', 'node', ['flag', 'Z']] }),
    item('L4', { op: 'ifne', arg: 'LTAIL' }),
    item('LFALL', { op: 'getstatic', arg: ['Field', 'owner', ['secondary', 'Lnode;']] }),
    item('L6', { op: 'ifnonnull', arg: 'LSECOND' }),
    item('L7', 'iconst_0'),
    item('L8', { op: 'goto', arg: 'LSTORE' }),
    item('LSECOND', { op: 'getstatic', arg: ['Field', 'owner', ['secondary', 'Lnode;']] }),
    item('L10', { op: 'getfield', arg: ['Field', 'node', ['flag', 'Z']] }),
    item('L11', { op: 'ifne', arg: 'LTAIL' }),
    item('L12', 'iconst_0'),
    item('L13', { op: 'goto', arg: 'LSTORE' }),
    item('LTAIL', 'aconst_null'),
    item('L15', { op: 'getstatic', arg: ['Field', 'owner', ['context', 'Lctx;']] }),
    item('L16', { op: 'if_acmpne', arg: 'LCHECK' }),
    item('L17', 'iconst_0'),
    item('L18', { op: 'goto', arg: 'LSTORE' }),
    item('LCHECK', { op: 'bipush', arg: '-114' }),
    item('L20', { op: 'invokestatic', arg: ['Method', 'keys', ['pressed', '(I)Z']] }),
    item('L21', { op: 'ifne', arg: 'LTRUE' }),
    item('L22', 'iconst_0'),
    item('L23', { op: 'goto', arg: 'LSTORE' }),
    item('LTRUE', 'iconst_1'),
    item('LSTORE', 'istore_3'),
    item('LDONE', 'return'),
  ]);
  const result = withOnlyStructuredGotoEnv({
    STRUCTURED_GOTO_SHARED_BOOLEAN_SELECTOR_TAIL: '1',
    STRUCTURED_GOTO_SHARED_BOOLEAN_SELECTOR_TAIL_MAX_INSNS: '96',
  }, () => runStructuredGotoClone(targetAstFrom('renamedOwner', 'renamedMethod', '(I)V', codeItems)));
  assert.equal(result.changed, true, 'shared boolean selector tail should allow null-check tails');
  assert.equal(codeItems.find((entry) => entry.labelDef === 'L4:').instruction.op, 'ifeq');
  assert.notEqual(codeItems.find((entry) => entry.labelDef === 'L4:').instruction.arg, 'LTAIL');
  assert.ok(codeItems.some((entry) => entry.labelDef && entry.labelDef.startsWith('LCKBOOLSEL_')), 'selector clone should use private labels');
}

function cloneItems(items) {
  return JSON.parse(JSON.stringify(items));
}

console.log('PASS structured-goto-clone selftest');
