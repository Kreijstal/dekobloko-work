#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const jarPath = process.argv[2] || path.resolve(__dirname, "../dekobloko.jar");
const outPath = process.argv[3] || path.resolve(__dirname, "../leaf-methods.json");
const javap = process.env.JAVAP || "/home/clawd/.jdks/jdk-22.0.2+9/bin/javap";

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });

const classNames = run("/home/clawd/.jdks/jdk-22.0.2+9/bin/jar", ["tf", jarPath])
  .split(/\r?\n/)
  .filter((line) => line.endsWith(".class"))
  .map((line) => line.slice(0, -".class".length).replace(/\//g, "."));

const classSet = new Set(classNames);
const methods = new Map();

const normalizeMemberName = (name) => name.replace(/^"|"$/g, "");

const parseMethodRef = (currentClass, ref) => {
  const colon = ref.lastIndexOf(":");
  if (colon < 0) return null;

  const ownerAndName = ref.slice(0, colon).trim();
  const descriptor = ref.slice(colon + 1).trim();
  const dot = ownerAndName.lastIndexOf(".");

  let owner;
  let name;
  if (dot >= 0) {
    owner = ownerAndName.slice(0, dot).replace(/\//g, ".");
    name = ownerAndName.slice(dot + 1);
  } else {
    owner = currentClass;
    name = ownerAndName;
  }

  return {
    owner,
    name: normalizeMemberName(name),
    descriptor,
    id: `${owner}.${normalizeMemberName(name)}${descriptor}`,
  };
};

const parseClass = (className) => {
  const text = run(javap, ["-classpath", jarPath, "-c", "-p", "-s", className]);
  const lines = text.split(/\r?\n/);
  const parsed = [];
  let pendingHeader = null;
  let current = null;
  let inCode = false;

  const finish = () => {
    if (current) {
      parsed.push(current);
      methods.set(current.id, current);
    }
    current = null;
    inCode = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!current && trimmed.endsWith(";") && trimmed.includes("(") && !trimmed.startsWith("descriptor:")) {
      pendingHeader = trimmed;
      continue;
    }

    if (!current && pendingHeader && trimmed.startsWith("descriptor: ")) {
      const descriptor = trimmed.slice("descriptor: ".length);
      let beforeParen = pendingHeader.slice(0, pendingHeader.indexOf("(")).trim();
      let name = beforeParen.split(/\s+/).pop();
      if (name === className || name.endsWith(`.${className}`)) name = "<init>";
      if (pendingHeader === "static {};") name = "<clinit>";

      current = {
        className,
        name,
        descriptor,
        id: `${className}.${name}${descriptor}`,
        instructions: 0,
        calls: [],
        internalCalls: [],
      };
      pendingHeader = null;
      continue;
    }

    if (current && trimmed === "Code:") {
      inCode = true;
      continue;
    }

    if (current && trimmed.startsWith("Exception table:")) {
      inCode = false;
      continue;
    }

    if (current && !inCode && trimmed.endsWith(";") && trimmed.includes("(")) {
      finish();
      pendingHeader = trimmed;
      continue;
    }

    if (!current || !inCode) continue;

    if (/^\d+:/.test(trimmed)) current.instructions++;

    const match = line.match(/\/\/\s+(?:InterfaceMethod|Method)\s+(.+)$/);
    if (!match) continue;
    const call = parseMethodRef(className, match[1]);
    if (!call) continue;
    current.calls.push(call);
  }

  finish();
  return parsed;
};

for (const className of classNames) parseClass(className);

for (const method of methods.values()) {
  method.internalCalls = method.calls.filter((call) => classSet.has(call.owner) && methods.has(call.id));
}

const all = [...methods.values()].sort((a, b) => a.id.localeCompare(b.id));
const leaves = all
  .filter((method) => method.internalCalls.length === 0)
  .sort((a, b) => a.instructions - b.instructions || a.id.localeCompare(b.id));

const output = {
  jar: jarPath,
  classCount: classNames.length,
  methodCount: all.length,
  leafCount: leaves.length,
  leaves,
};

fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(`classes: ${output.classCount}`);
console.log(`methods: ${output.methodCount}`);
console.log(`leaves:  ${output.leafCount}`);
console.log(`wrote:   ${outPath}`);
console.log("");
for (const method of leaves.slice(0, 50)) {
  console.log(`${String(method.instructions).padStart(4)}  ${method.id}`);
}
