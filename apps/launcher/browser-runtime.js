const {controller, session, setStatus, sendTelemetry} = context;
const jvm = controller.jvm;

while (controller.jvm === jvm &&
    Number(jvm._awtPresentationStats?.presented || 0) < 500) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (controller.jvm !== jvm) return;

const loader = document.getElementById("geoblox-loader");
const canvas = document.querySelector(".awt-applet-root canvas");
loader?.classList.remove("complete");
if (canvas) canvas.style.pointerEvents = "none";
setStatus("Preparing optimized browser runtime…");
const startedAt = performance.now();
try {
  const result = await jvm.precompileInitializedClasses({
    preloadClasspath: true,
    initializedOnly: false,
    effectful: true,
    wasm: true,
    wasmPreparedUpgradesOnly: true,
    onProgress: ({completed, total, tier}) => {
      if (tier === "javascript" && (completed % 100 === 0 || completed === total)) {
        setStatus(`Preparing optimized browser runtime… ${completed}/${total}`);
      }
    },
  });
  jvm.jit.wasmJit.freezeCompilation();
  session.runtimePreparation = result;
  sendTelemetry("runtime_preparation_complete", {
    ...result,
    durationMs: performance.now() - startedAt,
  });
  setStatus("GeoBlox ready");
} catch (error) {
  session.runtimePreparationError = String(error?.stack || error);
  console.error("DekoBloko browser runtime preparation failed:", error);
  setStatus("GeoBlox ready (runtime preparation unavailable)");
} finally {
  if (canvas) canvas.style.pointerEvents = "";
  loader?.classList.add("complete");
}
