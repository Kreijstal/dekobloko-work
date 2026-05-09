'use strict';

// Exact field renames for javac source conflicts introduced by CFR's choice to
// emit short class names. These are semantic no-ops at bytecode level: every
// definition and every exact owner/name/descriptor reference is renamed.
const FIELD_RENAMES = [
  { owner: 'uh', name: 'a', descriptor: 'Lbe;', to: 'uh_a' },
  { owner: 'kl', name: 'u', descriptor: '[I', to: 'kl_u' },
  { owner: 'on', name: 'b', descriptor: 'I', to: 'on_b' },
  { owner: 'on', name: 'd', descriptor: 'Z', to: 'on_d' },
  { owner: 'on', name: 'j', descriptor: 'Lmm;', to: 'on_j' },
  { owner: 'wk', name: 'h', descriptor: 'Ljava/lang/String;', to: 'wk_h' },
  { owner: 'wk', name: 'i', descriptor: 'Z', to: 'wk_i' },
  { owner: 'la', name: 'a', descriptor: 'I', to: 'la_a' },
  { owner: 'fn', name: 'g', descriptor: 'Lw;', to: 'fn_g' },
  { owner: 'mk', name: 'c', descriptor: '[I', to: 'mk_c' },
  { owner: 'db', name: 'f', descriptor: 'Lck;', to: 'db_f' },
  { owner: 'ba', name: 'e', descriptor: 'Ljava/lang/String;', to: 'ba_e' },
  { owner: 'ba', name: 'f', descriptor: 'Lum;', to: 'ba_f' },
  { owner: 'bh', name: 'd', descriptor: '[[Lck;', to: 'bh_d' },
  { owner: 'bh', name: 'i', descriptor: 'J', to: 'bh_i' },
  { owner: 'wm', name: 'i', descriptor: 'Ljava/lang/String;', to: 'wm_i' },
];

const METHOD_RENAMES = [
  // Complete wm.a(String, byte) override family. Renaming only te breaks the
  // abstract contract, so keep the family together.
  { owner: 'wm', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 'ii', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 'jm', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 'kd', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 're', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 'te', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 'tl', name: 'a', descriptor: '(Ljava/lang/String;B)Ljava/lang/String;', to: 'wm_a_string' },
  { owner: 'jb', name: 'a', descriptor: '(Ljava/lang/String;B)V', to: 'jb_a_string' },
  { owner: 'me', name: 'a', descriptor: '(BLjava/applet/Applet;)V', to: 'me_a_applet' },
  { owner: 'me', name: 'a', descriptor: '(BLwl;)V', to: 'me_a_wl' },
  { owner: 'cn', name: 'a', descriptor: '(Ljl;B)Z', to: 'cn_a_jl' },
  { owner: 'qc', name: 'a', descriptor: '(Llk;IIIIIIIIILck;Luk;Z)V', to: 'qc_a_uk' },
];

const FIELD_OPS = new Set(['getfield', 'putfield', 'getstatic', 'putstatic']);
const METHOD_OPS = new Set(['invokevirtual', 'invokespecial', 'invokestatic', 'invokeinterface']);

function symbolKey(owner, name, descriptor) {
  return `${owner}.${name}:${descriptor}`;
}

function classesOf(ast) {
  return ast && Array.isArray(ast.classes) ? ast.classes : [];
}

function renameFieldDefinitions(cls, byKey) {
  if (!cls || !Array.isArray(cls.items)) return 0;
  const className = cls.className;
  const existing = new Set();
  for (const item of cls.items) {
    if (item && item.type === 'field' && item.field) {
      existing.add(item.field.name);
    }
  }

  let changed = 0;
  for (const item of cls.items) {
    if (!item || item.type !== 'field' || !item.field) continue;
    const field = item.field;
    const rename = byKey.get(symbolKey(className, field.name, field.descriptor));
    if (!rename) continue;
    if (existing.has(rename.to) && rename.to !== field.name) {
      throw new Error(`Refusing unsafe field rename ${className}.${field.name} -> ${rename.to}: name already exists`);
    }
    existing.delete(field.name);
    field.name = rename.to;
    existing.add(field.name);
    changed += 1;
  }
  return changed;
}

function renameMethodDefinitions(cls, byKey) {
  if (!cls || !Array.isArray(cls.items)) return 0;
  const className = cls.className;
  const existing = new Set();
  for (const item of cls.items) {
    if (item && item.type === 'method' && item.method) {
      existing.add(`${item.method.name}:${item.method.descriptor}`);
    }
  }

  let changed = 0;
  for (const item of cls.items) {
    if (!item || item.type !== 'method' || !item.method) continue;
    const method = item.method;
    const rename = byKey.get(symbolKey(className, method.name, method.descriptor));
    if (!rename) continue;
    const newKey = `${rename.to}:${method.descriptor}`;
    if (existing.has(newKey) && rename.to !== method.name) {
      throw new Error(`Refusing unsafe method rename ${className}.${method.name}${method.descriptor} -> ${rename.to}: method already exists`);
    }
    existing.delete(`${method.name}:${method.descriptor}`);
    method.name = rename.to;
    existing.add(newKey);
    changed += 1;
  }
  return changed;
}

function maybeRenameFieldInstruction(instruction, byKey) {
  if (!instruction || !FIELD_OPS.has(instruction.op)) return 0;
  const arg = instruction.arg;
  if (!Array.isArray(arg) || arg[0] !== 'Field' || !Array.isArray(arg[2])) return 0;
  const owner = arg[1];
  const name = arg[2][0];
  const descriptor = arg[2][1];
  const rename = byKey.get(symbolKey(owner, name, descriptor));
  if (!rename) return 0;
  arg[2][0] = rename.to;
  return 1;
}

function maybeRenameMethodInstruction(instruction, byKey) {
  if (!instruction || !METHOD_OPS.has(instruction.op)) return 0;
  const arg = instruction.arg;
  if (!Array.isArray(arg) || arg[0] !== 'Method' || !Array.isArray(arg[2])) return 0;
  const owner = arg[1];
  const name = arg[2][0];
  const descriptor = arg[2][1];
  const rename = byKey.get(symbolKey(owner, name, descriptor));
  if (!rename) return 0;
  arg[2][0] = rename.to;
  return 1;
}

function walkInstructions(node, fieldRenames, methodRenames) {
  if (!node || typeof node !== 'object') return 0;
  let changed = 0;
  if (node.instruction) {
    changed += maybeRenameFieldInstruction(node.instruction, fieldRenames);
    changed += maybeRenameMethodInstruction(node.instruction, methodRenames);
  }
  if (Array.isArray(node)) {
    for (const child of node) changed += walkInstructions(child, fieldRenames, methodRenames);
  } else {
    for (const child of Object.values(node)) changed += walkInstructions(child, fieldRenames, methodRenames);
  }
  return changed;
}

function runCompileConflictRenames(ast, options = {}) {
  const fieldRenames = options.fieldRenames || FIELD_RENAMES;
  const methodRenames = options.methodRenames || METHOD_RENAMES;
  const fieldsByKey = new Map();
  for (const rename of fieldRenames) {
    fieldsByKey.set(symbolKey(rename.owner, rename.name, rename.descriptor), rename);
  }
  const methodsByKey = new Map();
  for (const rename of methodRenames) {
    methodsByKey.set(symbolKey(rename.owner, rename.name, rename.descriptor), rename);
  }

  let changed = 0;
  for (const cls of classesOf(ast)) {
    changed += renameFieldDefinitions(cls, fieldsByKey);
    changed += renameMethodDefinitions(cls, methodsByKey);
  }
  changed += walkInstructions(ast, fieldsByKey, methodsByKey);
  return changed;
}

module.exports = { FIELD_RENAMES, METHOD_RENAMES, runCompileConflictRenames };
