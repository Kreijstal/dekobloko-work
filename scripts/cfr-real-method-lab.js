#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');

function usage() {
  console.error(`Usage:
  node scripts/cfr-real-method-lab.js extract --class-file <Foo.class> --method <name> --descriptor <desc> --out <lab-dir> [--case before] [--category name]
  node scripts/cfr-real-method-lab.js extract --j <Foo.j> --method <name> --descriptor <desc> --out <lab-dir> [--case before] [--category name]`);
}

function main(argv) {
  const cmd = argv[0];
  if (cmd !== 'extract') {
    usage();
    process.exit(cmd ? 2 : 0);
  }
  const args = parseArgs(argv.slice(1));
  extract(args);
}

function parseArgs(argv) {
  const out = {
    classFile: null,
    j: null,
    method: null,
    descriptor: null,
    outDir: null,
    caseName: 'before',
    category: 'real-method-reducer',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--class-file') out.classFile = path.resolve(argv[++i]);
    else if (arg.startsWith('--class-file=')) out.classFile = path.resolve(arg.slice('--class-file='.length));
    else if (arg === '--j') out.j = path.resolve(argv[++i]);
    else if (arg.startsWith('--j=')) out.j = path.resolve(arg.slice('--j='.length));
    else if (arg === '--method') out.method = argv[++i];
    else if (arg.startsWith('--method=')) out.method = arg.slice('--method='.length);
    else if (arg === '--descriptor') out.descriptor = argv[++i];
    else if (arg.startsWith('--descriptor=')) out.descriptor = arg.slice('--descriptor='.length);
    else if (arg === '--out') out.outDir = path.resolve(argv[++i]);
    else if (arg.startsWith('--out=')) out.outDir = path.resolve(arg.slice('--out='.length));
    else if (arg === '--case') out.caseName = argv[++i];
    else if (arg.startsWith('--case=')) out.caseName = arg.slice('--case='.length);
    else if (arg === '--category') out.category = argv[++i];
    else if (arg.startsWith('--category=')) out.category = arg.slice('--category='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.classFile && !out.j) throw new Error('--class-file or --j is required');
  if (out.classFile && out.j) throw new Error('use only one of --class-file or --j');
  if (!out.method) throw new Error('--method is required');
  if (!out.descriptor) throw new Error('--descriptor is required');
  if (!out.outDir) throw new Error('--out is required');
  return out;
}

function extract(args) {
  const sourceJ = args.j || disassembleToTemp(args.classFile);
  const text = fs.readFileSync(sourceJ, 'utf8');
  const lines = text.split(/\r?\n/);
  const firstMethod = lines.findIndex((line) => line.startsWith('.method '));
  if (firstMethod < 0) throw new Error(`No methods found in ${sourceJ}`);
  const header = lines.slice(0, firstMethod);
  const method = findMethod(lines, args.method, args.descriptor);
  const trailer = classTrailer(lines);
  const labSource = normalizeBlankLines(header.concat(method.lines, trailer)).join('\n').trimEnd() + '\n';

  fs.mkdirSync(args.outDir, { recursive: true });
  const casePath = path.join(args.outDir, `${args.caseName}.j`);
  fs.writeFileSync(casePath, labSource, 'utf8');
  writeJsonIfAbsent(path.join(args.outDir, 'expected.json'), {
    category: args.category,
    cases: {
      [args.caseName]: {
        minMarkers: 1,
        mustContain: ['\\*\\* GOTO|Unable to fully structure code|lbl-1000'],
        javac: false,
      },
    },
  });
  writeTextIfAbsent(path.join(args.outDir, 'hypothesis.md'), `# ${titleFromCategory(args.category)}

Source: \`${path.relative(DEKOB, sourceJ)}\`

This lab extracts the complete real method \`${args.method}${args.descriptor}\`
from the failing class while dropping unrelated methods. It is the first
reduction step: the CFR GOTO marker must survive here before smaller bytecode
windows are meaningful.

Prediction:

- \`${args.caseName}.j\` should reproduce at least one CFR GOTO marker.
`);
  console.log(`wrote ${casePath}`);
}

function disassembleToTemp(classFile) {
  if (!fs.existsSync(classFile)) throw new Error(`Missing class file: ${classFile}`);
  const out = path.join(DEKOB, '.work', 'cfr-goto-reduce', 'disassembled', `${path.basename(classFile, '.class')}.j`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const result = spawnSync(process.execPath, [
    path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js'),
    'disassemble',
    classFile,
    '--out',
    out,
  ], { cwd: DEKOB, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`disassemble failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return out;
}

function findMethod(lines, name, descriptor) {
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseMethodHeader(lines[i]);
    if (!parsed) continue;
    const end = findMethodEnd(lines, i);
    if (parsed.name === name && parsed.descriptor === descriptor) {
      return { start: i, end, lines: lines.slice(i, end + 1) };
    }
    i = end;
  }
  throw new Error(`Method not found: ${name}${descriptor}`);
}

function parseMethodHeader(line) {
  if (!line.startsWith('.method ')) return null;
  const match = /^\.method\s+(.+?)\s*:\s*(\S+)\s*$/.exec(line);
  if (!match) return null;
  const left = match[1].trim().split(/\s+/);
  return { name: left[left.length - 1], descriptor: match[2] };
}

function findMethodEnd(lines, start) {
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '.end method') return i;
  }
  throw new Error(`Unterminated method starting at line ${start + 1}`);
}

function classTrailer(lines) {
  let lastMethodEnd = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '.end method') lastMethodEnd = i;
  }
  if (lastMethodEnd < 0) return [];
  return lines.slice(lastMethodEnd + 1).filter((line) => {
    const trimmed = line.trim();
    return trimmed === '' || trimmed === '.end class' || trimmed.startsWith('.sourcefile ');
  });
}

function normalizeBlankLines(lines) {
  const out = [];
  let blank = false;
  for (const line of lines) {
    const isBlank = line.trim() === '';
    if (isBlank && blank) continue;
    out.push(line);
    blank = isBlank;
  }
  return out;
}

function writeJsonIfAbsent(file, data) {
  if (fs.existsSync(file)) return;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeTextIfAbsent(file, text) {
  if (fs.existsSync(file)) return;
  fs.writeFileSync(file, text, 'utf8');
}

function titleFromCategory(category) {
  return String(category || 'Real Method Reducer')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

main(process.argv.slice(2));
