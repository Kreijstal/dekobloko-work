// Shared registration helpers for the reviewed Bachelor Fridge names. Original
// obfuscated identifiers are keys; roles shared with other FunOrb games are
// corroboration only and are confirmed against this game's own bodies.
export const classes = {};
export const members = {};
export const cls = (original, name, evidence) => { classes[original] = [name, evidence]; };
export const mem = (owner, original, descriptor, to, evidence) => { members[`M:${owner}.${original}${descriptor}`] = {to, evidence}; };
export const fld = (owner, original, descriptor, to, evidence) => { members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence}; };
export const group = (owner, evidence, rows) => { for (const [original, descriptor, to] of rows) mem(owner, original, descriptor, to, evidence); };
