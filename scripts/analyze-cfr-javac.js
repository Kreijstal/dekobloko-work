#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { createRequire } = Module;

const DEKOB = path.resolve(__dirname, '..');
const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const jtRequire = createRequire(path.join(JT, 'package.json'));

function requireJavaTools(rel) {
  return require(path.join(JT, rel));
}

const { tokenizeJava } = requireJavaTools('src/java-frontend/lexer');

function usage() {
  console.error('Usage: node scripts/analyze-cfr-javac.js <work-dir> [class ...]');
  console.error('  work-dir must contain cfr/*.java and logs/*.log, like /tmp/vh-current');
}

function main(argv) {
  const workDir = argv[0];
  if (!workDir) {
    usage();
    process.exit(2);
  }
  const cfrDir = path.join(workDir, 'cfr');
  const logDir = path.join(workDir, 'logs');
  if (!fs.existsSync(cfrDir) || !fs.existsSync(logDir)) {
    throw new Error(`Missing cfr/ or logs/ under ${workDir}`);
  }
  const classes = argv.slice(1);
  const names = classes.length
    ? classes
    : fs.readdirSync(logDir).filter((name) => name.endsWith('.log')).map((name) => path.basename(name, '.log')).sort();

  for (const cls of names) {
    const sourcePath = path.join(cfrDir, `${cls}.java`);
    const logPath = path.join(logDir, `${cls}.log`);
    if (!fs.existsSync(sourcePath) || !fs.existsSync(logPath)) continue;
    const errors = parseJavacErrors(fs.readFileSync(logPath, 'utf8'));
    if (errors.length === 0) continue;
    const source = fs.readFileSync(sourcePath, 'utf8');
    const index = indexSource(source);
    printClassReport(cls, errors, index);
  }
}

function parseJavacErrors(log) {
  const lines = log.split(/\r?\n/);
  const errors = [];
  for (let i = 0; i < lines.length; i += 1) {
    const header = /^(.+\.java):(\d+): error: (.+)$/.exec(lines[i]);
    if (!header) continue;
    const err = {
      line: Number(header[2]),
      message: header[3],
      sourceLine: lines[i + 1] || '',
      details: [],
    };
    for (let j = i + 2; j < Math.min(lines.length, i + 8); j += 1) {
      if (/^.+\.java:\d+: error: /.test(lines[j])) break;
      if (lines[j].trim()) err.details.push(lines[j]);
    }
    errors.push(err);
  }
  return errors;
}

function indexSource(source) {
  const lines = source.split(/\r?\n/);
  const depths = lineDepths(lines);
  const declarations = new Map();
  const declarationOrder = [];
  collectDeclarationsWithLexer(source, declarations, declarationOrder, depths);
  collectDeclarationsWithRegex(lines, declarations, declarationOrder, depths);
  return { lines, depths, declarations, declarationOrder };
}

function lineDepths(lines) {
  const depths = [];
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    depths[i + 1] = depth;
    const text = stripStringsAndComments(lines[i]);
    for (const ch of text) {
      if (ch === '{') depth += 1;
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }
  return depths;
}

function stripStringsAndComments(line) {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function collectDeclarationsWithLexer(source, declarations, declarationOrder, depths) {
  let tokens;
  try {
    tokens = tokenizeJava(source, { sourceLevel: 7 }).tokens;
  } catch {
    return;
  }
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const type = declarationTypeAt(tokens, i);
    if (!type) continue;
    const nameToken = tokens[i + type.width];
    if (!nameToken || nameToken.kind !== 'identifier') continue;
    const next = tokens[i + type.width + 1];
    if (!next || !['=', ';', ',', '['].includes(next.text)) continue;
    addDeclaration(declarations, declarationOrder, nameToken.text, {
      type: type.text,
      line: nameToken.range.start.line,
      depth: depths[nameToken.range.start.line] || 0,
      source: lineAt(source, nameToken.range.start.line).trim(),
    });
  }
}

function declarationTypeAt(tokens, index) {
  const token = tokens[index];
  if (!token) return null;
  if (isPrimitiveType(token.text)) {
    const suffix = arraySuffixWidth(tokens, index + 1);
    return { text: `${token.text}${'[]'.repeat(suffix / 2)}`, width: 1 + suffix };
  }
  if (token.kind !== 'identifier') return null;
  const suffix = arraySuffixWidth(tokens, index + 1);
  return { text: `${token.text}${'[]'.repeat(suffix / 2)}`, width: 1 + suffix };
}

function arraySuffixWidth(tokens, index) {
  let width = 0;
  while (tokens[index + width] && tokens[index + width].text === '[' &&
      tokens[index + width + 1] && tokens[index + width + 1].text === ']') {
    width += 2;
  }
  return width;
}

function isPrimitiveType(text) {
  return ['boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double'].includes(text);
}

function collectDeclarationsWithRegex(lines, declarations, declarationOrder, depths) {
  const re = /\b(boolean|byte|char|short|int|long|float|double|Object|[A-Za-z_$][\w$]*(?:\[\])*)\s+([A-Za-z_$][\w$]*)\b/g;
  for (let i = 0; i < lines.length; i += 1) {
    const text = stripStringsAndComments(lines[i]);
    let match;
    while ((match = re.exec(text)) !== null) {
      addDeclaration(declarations, declarationOrder, match[2], {
        type: match[1],
        line: i + 1,
        depth: depths[i + 1] || 0,
        source: lines[i].trim(),
      });
    }
  }
}

function addDeclaration(declarations, declarationOrder, name, decl) {
  if (!declarations.has(name)) declarations.set(name, []);
  const list = declarations.get(name);
  if (list.some((existing) => existing.line === decl.line && existing.type === decl.type)) return;
  list.push(decl);
  declarationOrder.push({ name, ...decl });
}

function lineAt(source, line) {
  return source.split(/\r?\n/)[line - 1] || '';
}

function printClassReport(cls, errors, index) {
  const groups = groupErrors(errors);
  const total = errors.length;
  console.log(`\n${cls}: ${total} javac error(s)`);
  for (const [kind, list] of groups) {
    console.log(`  ${kind}: ${list.length}`);
    for (const err of list.slice(0, 8)) {
      console.log(`    L${err.line}: ${err.message}`);
      const info = explainError(err, index);
      if (info) console.log(`      ${info}`);
    }
    if (list.length > 8) console.log(`    ... ${list.length - 8} more`);
  }
}

function groupErrors(errors) {
  const groups = new Map();
  for (const err of errors) {
    const kind = classify(err);
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(err);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function classify(err) {
  if (err.message === 'cannot find symbol') {
    const symbol = err.details.find((line) => line.includes('symbol:'));
    if (symbol && symbol.includes('variable')) return 'missing-variable';
    return 'missing-symbol';
  }
  if (/array required, but Object found/.test(err.message)) return 'object-used-as-array';
  if (/boolean cannot be converted to int|incomparable types: boolean and int/.test(err.message)) return 'boolean-int-confusion';
  if (/non-static method .* cannot be referenced from a static context|'void' type not allowed here/.test(err.message)) return 'static-or-void-call';
  if (/call to super must be first statement|constructor .* cannot be applied/.test(err.message)) return 'constructor-shape';
  if (/reference to .* is ambiguous/.test(err.message)) return 'overload-ambiguity';
  if (/';' expected|illegal start of expression|not a statement|unclosed character literal/.test(err.message)) return 'syntax-break';
  return err.message;
}

function explainError(err, index) {
  if (err.message === 'cannot find symbol') {
    const variable = variableFromDetails(err.details);
    if (!variable) return null;
    const decls = index.declarations.get(variable) || [];
    if (decls.length === 0) return `${variable}: no declaration found in CFR source`;
    const before = decls.filter((decl) => decl.line <= err.line).sort((a, b) => b.line - a.line)[0];
    const any = before || decls[0];
    const relation = before ? 'declared earlier' : 'declared later';
    const scope = any.depth > (index.depths[err.line] || 0) ? ', narrower brace depth' : '';
    return `${variable}: ${relation} at L${any.line} as ${any.type}${scope}: ${any.source}`;
  }
  const boolInt = /(?:boolean cannot be converted to int|incomparable types: boolean and int)/.test(err.message);
  if (boolInt) {
    const names = identifiers(err.sourceLine).filter((name) => index.declarations.has(name));
    const hints = names.map((name) => {
      const decl = nearestDeclaration(index.declarations.get(name), err.line);
      return decl ? `${name}:${decl.type}@L${decl.line}` : null;
    }).filter(Boolean);
    return hints.length ? hints.join(', ') : null;
  }
  return null;
}

function variableFromDetails(details) {
  const symbol = details.find((line) => /symbol:\s+variable\s+/.test(line));
  if (!symbol) return null;
  const match = /symbol:\s+variable\s+([A-Za-z_$][\w$]*)/.exec(symbol);
  return match ? match[1] : null;
}

function identifiers(line) {
  return [...String(line || '').matchAll(/\b[A-Za-z_$][\w$]*\b/g)].map((match) => match[0]);
}

function nearestDeclaration(decls, line) {
  if (!decls || decls.length === 0) return null;
  return decls
    .slice()
    .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line))[0];
}

main(process.argv.slice(2));
