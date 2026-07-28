#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { execFileSync } = require("child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repositoryRoot, "web");
const dataRoot = path.resolve(process.env.FUNORB_AUDIO_DATA ||
  path.join(repositoryRoot, ".work/music/dekobloko"));
const host = process.env.AUDIO_DIAGNOSTICS_HOST || "0.0.0.0";
const port = Number(process.env.AUDIO_DIAGNOSTICS_PORT || 8775);
const javaToolsRoot = path.resolve(process.env.JAVA_TOOLS_DIR ||
  path.join(repositoryRoot, "..", "java-tools"));
const gameJar = path.join(repositoryRoot, "dekobloko.jar");
const guestMixerSource = path.join(
  repositoryRoot, "tools", "music", "JavaFunOrbTrackPlayer.java");
const javaAssetRoot = path.join(
  repositoryRoot, ".work", "audio-diagnostics", "java");
const telemetryFile = path.join(
  repositoryRoot, ".work", "telemetry", "audio-diagnostics.jsonl");
const animationTelemetryFile = path.join(
  repositoryRoot, ".work", "telemetry", "animation-diagnostics.jsonl");
const javaJar = path.join(javaAssetRoot, "funorb-guest-mixer.jar");
const sampleBankBinary = path.join(
  javaAssetRoot, "funorb-sample-bank.bin");
const jvmBundle = path.join(javaToolsRoot, "dist", "jvm-debug.js");
const webAudioBridge = path.join(javaToolsRoot, "dist", "web-audio.js");
const originalClasses = path.join(repositoryRoot, "classes-original");
const animationAssetRoot = path.join(
  repositoryRoot, ".work", "animation-diagnostics");
const sceneTrace = path.resolve(process.env.DEKOBLOKO_SCENE_TRACE ||
  path.join(animationAssetRoot, "logo-animation-trace.json"));
const sceneClassesJar = path.resolve(process.env.DEKOBLOKO_SCENE_CLASSES_JAR ||
  path.join(repositoryRoot, ".work", "games", "dekobloko",
    "hybrid-all-recompiled-lean-carriers.jar"));
const compressedSceneTrace = path.join(
  animationAssetRoot, "logo-animation-trace.json.gz");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jar", "application/java-archive"],
  [".bin", "application/octet-stream"],
]);

const javaManifest = prepareJavaAssets();
const animationManifest = prepareAnimationAssets();

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  let file;
  if (url.pathname === "/api/audio-diagnostics" && request.method === "POST") {
    receiveTelemetry(request, response, telemetryFile);
    return;
  }
  if (url.pathname === "/api/audio-diagnostics/latest" &&
      request.method === "GET") {
    serveLatestTelemetry(response, telemetryFile);
    return;
  }
  if (url.pathname === "/api/animation-diagnostics" &&
      request.method === "POST") {
    receiveTelemetry(request, response, animationTelemetryFile);
    return;
  }
  if (url.pathname === "/api/animation-diagnostics/latest" &&
      request.method === "GET") {
    serveLatestTelemetry(response, animationTelemetryFile);
    return;
  }
  if (url.pathname === "/jvm-assets/manifest.json") {
    const body = Buffer.from(JSON.stringify(javaManifest, null, 2));
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    });
    response.end(body);
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(302, { Location: "/audio-diagnostics/" });
    response.end();
    return;
  }
  if (url.pathname === "/animation-diagnostics") {
    response.writeHead(302, { Location: "/animation-diagnostics/" });
    response.end();
    return;
  }
  if (url.pathname === "/audio-diagnostics") {
    response.writeHead(302, { Location: "/audio-diagnostics/" });
    response.end();
    return;
  }
  if (url.pathname.startsWith("/audio-data/")) {
    file = resolveInside(dataRoot, url.pathname.slice("/audio-data/".length));
  } else if (url.pathname.startsWith("/audio-diagnostics/")) {
    const relative = url.pathname === "/audio-diagnostics/"
      ? "audio-diagnostics/index.html"
      : url.pathname.slice(1);
    file = resolveInside(webRoot, relative);
  } else if (url.pathname.startsWith("/animation-diagnostics/")) {
    const relative = url.pathname === "/animation-diagnostics/"
      ? "animation-diagnostics/index.html"
      : url.pathname.slice(1);
    file = resolveInside(webRoot, relative);
  } else if (url.pathname.startsWith("/music-visualizer/")) {
    file = resolveInside(webRoot, url.pathname.slice(1));
  } else if (url.pathname === "/jvm-assets/jvm-debug.js") {
    file = jvmBundle;
  } else if (url.pathname === "/jvm-assets/web-audio.js") {
    file = webAudioBridge;
  } else if (url.pathname === "/jvm-assets/dekobloko.jar") {
    file = gameJar;
  } else if (url.pathname === "/jvm-assets/funorb-guest-mixer.jar") {
    file = javaJar;
  } else if (url.pathname === "/jvm-assets/funorb-sample-bank.bin") {
    file = sampleBankBinary;
  } else if (url.pathname === "/animation-assets/manifest.json") {
    const body = Buffer.from(JSON.stringify(animationManifest, null, 2));
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    });
    response.end(body);
    return;
  } else if (url.pathname === "/animation-assets/scene-classes.jar") {
    file = sceneClassesJar;
  } else if (url.pathname === "/animation-assets/animation-trace.json") {
    serveGzipJson(compressedSceneTrace, request, response);
    return;
  }
  if (!file) {
    response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
    response.end("Not found\n");
    return;
  }
  serveFile(file, url.pathname, request, response);
});

function serveFile(file, urlPath, request, response) {
  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
      response.end("Not found\n");
      return;
    }
    const etag = `W/"${stat.size}-${Math.trunc(stat.mtimeMs)}"`;
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, { ETag: etag });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes.get(path.extname(file)) || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": urlPath.startsWith("/audio-data/") ||
        urlPath === "/jvm-assets/funorb-sample-bank.bin"
        ? "public, max-age=3600"
        : "no-cache",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(file).pipe(response);
  });
}

function serveGzipJson(file, request, response) {
  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
      response.end("Not found\n");
      return;
    }
    const etag = `W/"${stat.size}-${Math.trunc(stat.mtimeMs)}"`;
    if (request.headers["if-none-match"] === etag) {
      response.writeHead(304, { ETag: etag });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Encoding": "gzip",
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=3600",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file).pipe(response);
  });
}

if (process.argv.includes("--prepare-only")) {
  console.log(JSON.stringify(javaManifest, null, 2));
} else {
  server.listen(port, host, () => {
    console.log(`FunOrb PCM diagnostics: http://${host}:${port}/audio-diagnostics/`);
    console.log(`Audio data: ${dataRoot}`);
    console.log(`Dekobloko JAR: ${javaManifest.gameJarSha256}`);
    console.log(`Guest mixer driver: ${javaManifest.driverJarSha256}`);
    console.log(`Scene replay: ${animationManifest.sceneTraceSha256}`);
  });
}

function resolveInside(root, relative) {
  let decoded;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return null;
  }
  const resolved = path.resolve(root, decoded);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

function prepareJavaAssets() {
  for (const file of [
    gameJar, guestMixerSource, jvmBundle, webAudioBridge, originalClasses,
  ]) {
    if (!fs.existsSync(file)) {
      throw new Error(`Java PCM diagnostic dependency is missing: ${file}`);
    }
  }
  fs.mkdirSync(javaAssetRoot, { recursive: true });
  prepareSampleBankBinary();
  execFileSync("javac", [
    "-source", "8", "-target", "8",
    "-cp", originalClasses, "-d", javaAssetRoot, guestMixerSource,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const driverClasses = [
    "JavaFunOrbTrackPlayer.class",
    "JavaFunOrbTrackPlayer$ByteReader.class",
  ];
  const stableTimestamp = new Date("2000-01-01T00:00:00Z");
  for (const classFile of driverClasses) {
    fs.utimesSync(path.join(javaAssetRoot, classFile),
      stableTimestamp, stableTimestamp);
  }
  execFileSync("jar", [
    "cMf", javaJar,
    "-C", javaAssetRoot, driverClasses[0],
    "-C", javaAssetRoot, driverClasses[1],
  ], { stdio: ["ignore", "ignore", "pipe"] });
  return {
    trackClassName: "JavaFunOrbTrackPlayer",
    repositories: {
      dekoblokoWork: gitMetadata(repositoryRoot),
      javaTools: gitMetadata(javaToolsRoot),
    },
    environment: relevantEnvironment(),
    guestMixerSourceSha256: sha256(guestMixerSource),
    sampleBankSha256: sha256(sampleBankBinary),
    gameJarSha256: sha256(gameJar),
    driverJarSha256: sha256(javaJar),
    jvmBundleSha256: sha256(jvmBundle),
    webAudioSha256: sha256(webAudioBridge),
  };
}

function prepareAnimationAssets() {
  for (const file of [jvmBundle, sceneTrace, sceneClassesJar]) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Animation diagnostic dependency is missing: ${file}`);
    }
  }
  fs.mkdirSync(animationAssetRoot, { recursive: true });
  const sourceStat = fs.statSync(sceneTrace);
  const compressedStat = fs.statSync(
    compressedSceneTrace, { throwIfNoEntry: false });
  if (!compressedStat || compressedStat.mtimeMs < sourceStat.mtimeMs) {
    fs.writeFileSync(compressedSceneTrace,
      zlib.gzipSync(fs.readFileSync(sceneTrace), { level: 9 }));
    fs.utimesSync(compressedSceneTrace,
      sourceStat.atime, sourceStat.mtime);
  }
  const traceHeader = fs.readFileSync(sceneTrace, "utf8").slice(0, 1024);
  const methodKey = /"methodKey"\s*:\s*"([^"]+)"/.exec(traceHeader)?.[1] || null;
  return {
    schema: 2,
    workload: "moving-logo-animation",
    methodKey,
    repositories: {
      dekoblokoWork: gitMetadata(repositoryRoot),
      javaTools: gitMetadata(javaToolsRoot),
    },
    environment: relevantEnvironment(),
    jvmBundleSha256: sha256(jvmBundle),
    sceneTraceSha256: sha256(sceneTrace),
    sceneTraceBytes: sourceStat.size,
    compressedSceneTraceBytes: fs.statSync(compressedSceneTrace).size,
    sceneClassesJarSha256: sha256(sceneClassesJar),
    sceneClassesJarBytes: fs.statSync(sceneClassesJar).size,
    generatedFromGameJarSha256: sha256(gameJar),
  };
}

function gitMetadata(root) {
  const git = (args) => execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  try {
    const status = git(["status", "--porcelain=v1"]);
    const trackedStatus = git([
      "status", "--porcelain=v1", "--untracked-files=no",
    ]);
    const patch = execFileSync("git", ["-C", root, "diff", "--binary", "HEAD"], {
      encoding: null,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return {
      revisionSha1: git(["rev-parse", "HEAD"]),
      treeSha1: git(["rev-parse", "HEAD^{tree}"]),
      trackedDirty: Boolean(trackedStatus),
      dirty: Boolean(status),
      trackedPatchSha256: crypto.createHash("sha256").update(patch).digest("hex"),
    };
  } catch {
    return {
      revisionSha1: null,
      treeSha1: null,
      trackedDirty: null,
      dirty: null,
      trackedPatchSha256: null,
    };
  }
}

function relevantEnvironment() {
  const keys = Object.keys(process.env)
    .filter(key => key.startsWith("JVM_") ||
      key === "JAVA_TOOLS_DIR" ||
      key === "FUNORB_AUDIO_DATA" ||
      key === "AUDIO_DIAGNOSTICS_HOST" ||
      key === "AUDIO_DIAGNOSTICS_PORT")
    .sort();
  return Object.fromEntries(keys.map(key => [key, process.env[key]]));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function prepareSampleBankBinary() {
  const source = JSON.parse(fs.readFileSync(
    path.join(dataRoot, "json", "sample-bank.json"), "utf8"));
  const samples = Object.values(source.samples).sort((left, right) =>
    left.bank.localeCompare(right.bank) || left.id - right.id);
  const chunks = [
    int32(0x464f5042),
    int32(25),
    int32(96),
    int32(samples.length),
  ];
  for (const sample of samples) {
    const pcm = Buffer.from(sample.pcm8, "base64");
    chunks.push(Buffer.from([sample.bank === "vorbis" ? 1 : 0]));
    chunks.push(int32(sample.id));
    chunks.push(int32(sample.rate));
    chunks.push(int32(sample.loopStart));
    chunks.push(int32(sample.loopEnd));
    chunks.push(Buffer.from([sample.pingPong ? 1 : 0]));
    chunks.push(int32(pcm.length));
    chunks.push(pcm);
  }
  fs.writeFileSync(sampleBankBinary, Buffer.concat(chunks));
}

function int32(value) {
  const bytes = Buffer.allocUnsafe(4);
  bytes.writeInt32BE(value | 0);
  return bytes;
}

function receiveTelemetry(request, response, destination) {
  const chunks = [];
  let length = 0;
  request.on("data", chunk => {
    length += chunk.length;
    if (length > 128 * 1024) {
      response.writeHead(413, {"Content-Type": "text/plain; charset=utf-8"});
      response.end("Telemetry payload too large\n");
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    if (response.writableEnded) return;
    try {
      const submitted = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!submitted || typeof submitted !== "object" ||
          Array.isArray(submitted)) {
        throw new Error("expected a JSON object");
      }
      const record = {
        ...submitted,
        receivedAt: new Date().toISOString(),
        remoteAddress: request.socket.remoteAddress || null,
        userAgent: request.headers["user-agent"] || null,
      };
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.appendFileSync(destination, `${JSON.stringify(record)}\n`);
      response.writeHead(204, {"Cache-Control": "no-store"});
      response.end();
    } catch (error) {
      response.writeHead(400, {"Content-Type": "text/plain; charset=utf-8"});
      response.end(`Invalid telemetry: ${error.message}\n`);
    }
  });
}

function serveLatestTelemetry(response, source) {
  let records = [];
  try {
    records = fs.readFileSync(source, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-20)
      .map(line => JSON.parse(line));
  } catch (error) {
    if (error.code !== "ENOENT") {
      response.writeHead(500, {"Content-Type": "text/plain; charset=utf-8"});
      response.end(`Could not read telemetry: ${error.message}\n`);
      return;
    }
  }
  const body = Buffer.from(JSON.stringify(records, null, 2));
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  response.end(body);
}
