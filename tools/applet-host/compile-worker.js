// Compiles the applet source with javac.js inside a Web Worker so the page
// keeps repainting. Adapted from blank-github-cloner/public/compile-worker.js.
//
// The page hands over every bundle source as data (`bundleAssets`), so this
// worker never touches the network: the published browser bundle loads its
// lazy chunks through the DOM script loader even in a worker, and the tiny
// document shim below evaluates those chunks from the supplied sources
// (falling back to importScripts relative to `bundleUrl` only when a chunk
// was not supplied).
self.window = self;

self.document = {
  createElement(tagName) {
    if (tagName !== "script") return {};
    return {
      charset: "",
      timeout: 0,
      src: "",
      onload: null,
      onerror: null,
      setAttribute(name, value) { this[name] = value; },
      getAttribute(name) { return this[name] ?? null; },
    };
  },
  getElementsByTagName() { return []; },
  head: {
    appendChild(script) {
      try {
        const requested = new URL(script.src, self.location.href);
        const assetName = requested.pathname.split("/").pop();
        const source = self.__jvmBundleAssets && self.__jvmBundleAssets[assetName];
        if (source) {
          (0, eval)(`${source}\n//# sourceURL=jvm-assets/${assetName}`);
        } else {
          importScripts(new URL(assetName, self.__jvmBundleUrl).href);
        }
        script.onload?.({ type: "load", target: script });
      } catch (error) {
        script.onerror?.({
          type: "error", target: script, error,
          message: error?.message ?? String(error),
        });
      }
      return script;
    },
    removeChild(script) { return script; },
  },
};

self.addEventListener("message", async (message) => {
  if (message.data?.type !== "compile") return;
  const startedAt = Date.now();
  try {
    self.__jvmBundleUrl = message.data.bundleUrl;
    self.__jvmBundleAssets = message.data.bundleAssets || null;
    const mainBundle = self.__jvmBundleAssets && self.__jvmBundleAssets["jvm-debug.js"];
    if (mainBundle) {
      (0, eval)(`${mainBundle}\n//# sourceURL=jvm-assets/jvm-debug.js`);
    } else {
      importScripts(self.__jvmBundleUrl);
    }
    const debug = new self.JVMDebug.BrowserJVMDebug();
    await debug.initialize({ workspace: true });
    for (const source of message.data.sources) {
      debug.writeWorkspaceFile(source.path, source.content);
    }
    const phases = [];
    const result = debug.compileWorkspace(
      message.data.sources.map((source) => source.path),
      {
        sourceRoot: "/src",
        outputDir: "/classes",
        sourceLevel: 8,
        onProgress(event) {
          if (event.event === "start" || event.event === "end") {
            phases.push({ ...event, at: Date.now() - startedAt });
          }
          self.postMessage({ type: "progress", event });
        },
      },
    );
    const artifacts = result.artifacts.map((artifact) => {
      const bytes = new Uint8Array(artifact.bytes);
      return {
        internalName: artifact.internalName,
        outputPath: artifact.outputPath,
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    });
    self.postMessage(
      {
        type: "complete", artifacts, phases,
        reused: result.reused ?? 0,
        durationMs: Date.now() - startedAt,
      },
      artifacts.map((artifact) => artifact.bytes),
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message ?? String(error),
      stack: error?.stack ?? "",
      durationMs: Date.now() - startedAt,
    });
  }
});
