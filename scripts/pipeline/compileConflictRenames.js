'use strict';

// Exact field renames for javac source conflicts introduced by CFR's choice to
// emit short class names. These are semantic no-ops at bytecode level: every
// definition and every exact owner/name/descriptor reference is renamed.
const FIELD_RENAMES = [];

const METHOD_RENAMES = [];

const FIELD_OPS = new Set(['getfield', 'putfield', 'getstatic', 'putstatic']);
const METHOD_OPS = new Set(['invokevirtual', 'invokespecial', 'invokestatic', 'invokeinterface']);

function symbolKey(owner, name, descriptor) {
  return `${owner}.${name}:${descriptor}`;
}

function classesOf(ast) {
  return ast && Array.isArray(ast.classes) ? ast.classes : [];
}

function methodKey(name, descriptor) {
  return `${name}:${descriptor}`;
}

function collectClassInfo(ast) {
  const classes = new Map();
  for (const cls of classesOf(ast)) {
    const methods = new Set();
    for (const item of cls.items || []) {
      if (item && item.type === 'method' && item.method) {
        methods.add(methodKey(item.method.name, item.method.descriptor));
      }
    }
    classes.set(cls.className, {
      name: cls.className,
      superName: cls.superClassName || null,
      interfaces: Array.isArray(cls.interfaces) ? cls.interfaces.slice() : [],
      methods,
    });
  }
  return classes;
}

function classLinks(info) {
  const links = new Map();
  function add(a, b) {
    if (!a || !b || !info.has(a) || !info.has(b)) return;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a).add(b);
    links.get(b).add(a);
  }
  for (const cls of info.values()) {
    add(cls.name, cls.superName);
    for (const itf of cls.interfaces) add(cls.name, itf);
  }
  return links;
}

function expandMethodRenames(ast, methodRenames) {
  const info = collectClassInfo(ast);
  const links = classLinks(info);
  const expanded = new Map();

  for (const rename of methodRenames) {
    const wanted = methodKey(rename.name, rename.descriptor);
    const queue = [rename.owner];
    const seen = new Set();

    while (queue.length > 0) {
      const owner = queue.shift();
      if (seen.has(owner)) continue;
      seen.add(owner);

      const cls = info.get(owner);
      if (cls && cls.methods.has(wanted)) {
        const key = symbolKey(owner, rename.name, rename.descriptor);
        const previous = expanded.get(key);
        if (previous && previous.to !== rename.to) {
          throw new Error(`Conflicting method rename for ${key}: ${previous.to} vs ${rename.to}`);
        }
        expanded.set(key, { ...rename, owner });
      }

      for (const next of links.get(owner) || []) {
        if (!seen.has(next)) queue.push(next);
      }
    }
  }

  return [...expanded.values()];
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
  const methodRenames = options.methodRenames
    ? options.methodRenames
    : expandMethodRenames(ast, METHOD_RENAMES);
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

module.exports = { FIELD_RENAMES, METHOD_RENAMES, expandMethodRenames, runCompileConflictRenames };
