#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const javaTools = path.resolve(process.env.JAVA_TOOLS_DIR ||
  path.join(root, "..", "java-tools"));
const gameJar = path.resolve(process.env.FUNORB_GAME_JAR ||
  path.join(root, "dekobloko.jar"));
const source = path.join(root, "tools", "music", "JavaVorbisDecodeProbe.java");
const work = path.join(root, ".work", "vorbis-probe");
const classes = path.join(work, "classes");
const driverJar = path.join(work, "vorbis-probe.jar");
const sampleRoot = path.join(
  root, ".work", "music", "dekobloko", "split", "archive09_group000");
const bank = JSON.parse(fs.readFileSync(path.join(
  root, ".work", "music", "dekobloko", "json", "sample-bank.json"), "utf8"));
const vorbisIds = Object.keys(bank.samples)
  .filter(key => key.startsWith("vorbis:"))
  .map(key => Number(key.slice("vorbis:".length)))
  .sort((left, right) => left - right);
const sampleFilesByPhysicalIndex = new Map();
for (const name of fs.readdirSync(sampleRoot)) {
  const match = /^(\d+)_sample\.packvorbis\.bin$/.exec(name);
  if (!match) continue;
  const physicalIndex = Number(match[1]);
  if (sampleFilesByPhysicalIndex.has(physicalIndex)) {
    throw new Error(`duplicate Vorbis physical sample ${physicalIndex}`);
  }
  sampleFilesByPhysicalIndex.set(physicalIndex, name);
}
const vorbisFilesById = new Map(vorbisIds.map((id, physicalIndex) => [
  id,
  sampleFilesByPhysicalIndex.get(physicalIndex + 1),
]));
const titleDecodeOrder = [90, 64, 30, 45, 22, 75, 86];
const inputs = [
  path.join(sampleRoot, "00_headers.packvorbis.bin"),
  ...titleDecodeOrder.map(id => {
    const filename = vorbisFilesById.get(id);
    if (!filename) throw new Error(`missing Vorbis sample id ${id}`);
    return path.join(sampleRoot, filename);
  }),
];

for (const file of [gameJar, source, ...inputs]) {
  if (!fs.existsSync(file)) throw new Error(`missing input: ${file}`);
}
fs.mkdirSync(classes, { recursive: true });
execFileSync("javac", [
  "--release", "8", "-cp", gameJar, "-d", classes, source,
], { stdio: "inherit" });
execFileSync("jar", ["cfM", driverJar, "-C", classes, "."], {
  stdio: "inherit",
});

const { JVM } = require(path.join(javaTools, "src", "core", "jvm"));
const jvm = new JVM({
  classpath: [driverJar, gameJar],
  jit: {
    enabled: true,
    preferWholeMethodJs: true,
    inlineLoopRegions: true,
    rendererPipeline: true,
    scalarLoops: true,
    scalarGuestBodies: true,
    structuredSsa: true,
    structuredDeferredCallMaterialization: true,
    ordinaryAdaptiveFramelessPositional: true,
    adaptiveFramelessBudgetMultiplier: 100,
    adaptiveWholeMethodEscalationThreshold: 16,
  },
});

(async () => {
  await jvm.run("JavaVorbisDecodeProbe", { args: inputs });
  const fields = jvm.classes.JavaVorbisDecodeProbe.staticFields;
  const number = name => {
    const value = fields.get(`${name}:I`);
    return typeof value === "bigint" ? Number(value) : Number(value || 0);
  };
  const samples = [];
  for (let index = 0; index < Math.min(3, number("count")); index++) {
    samples.push({
      input: path.basename(inputs[index + 1]),
      length: number(`length${index}`),
      nonZero: number(`nonZero${index}`),
      peak: number(`peak${index}`),
      checksum: number(`checksum${index}`) >>> 0,
    });
  }
  const traceFields = jvm.classes.AudioTrace &&
    jvm.classes.AudioTrace.staticFields;
  const trace = traceFields ? {
    headerSmallBlock: Number(traceFields.get("headerSmallBlock:I") || 0),
    headerLargeBlock: Number(traceFields.get("headerLargeBlock:I") || 0),
    headerTableValues: Number(traceFields.get("headerTableValues:I") || 0),
    headerTableNonZero: Number(traceFields.get("headerTableNonZero:I") || 0),
    headerTableChecksum:
      Number(traceFields.get("headerTableChecksum:I") || 0) >>> 0,
  } : null;
  process.stdout.write(`${JSON.stringify({
    error: number("error"),
    samples,
    trace,
  }, null, 2)}\n`);
  if (number("error")) process.exitCode = 1;
})().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
