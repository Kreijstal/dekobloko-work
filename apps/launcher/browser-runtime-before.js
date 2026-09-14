const {controller, session, setStatus, sendTelemetry} = context;
const jvm = controller.jvm;
if (jvm.guestStarted) {
  throw new Error("Browser preparation must precede the first guest instruction");
}

// Opt-in, bounded exit diagnostics for the loading decoder. Readiness alone
// does not show whether the prepared module remains in compiled execution.
if (new URLSearchParams(location.search).get("iteration") === "1") {
  const wasm = jvm.jit.wasmJit;
  const execute = wasm.execute;
  let reports = 0;
  wasm.execute = function(frame, thread, state, block, nested, osr) {
    const watched = reports < 80 && state.key === "ua.c(I)[F";
    const before = watched ? frame.pc : null;
    const result = execute.call(this, frame, thread, state, block, nested, osr);
    if (watched) {
      reports++;
      sendTelemetry("iteration_wasm_exit", {
        key: state.key, before, after: frame.pc, block, nested, osr, result,
        instruction: frame.instructions[frame.pc]?.instruction,
        runs: state.runs, exits: state.exits, fuelExits: state.fuelExits,
        stack: thread.callStack.items.slice(-5).map(f => ({
          owner: f.className, method: f.method?.name,
          descriptor: f.method?.descriptor, pc: f.pc,
        })),
      });
    }
    return result;
  };
}

// Java programs may catch and report a runtime failure themselves. Keep the
// guest location before exception unwinding discards the useful frames.
const handleException = jvm.handleException.bind(jvm);
session.runtimeExceptions = [];
jvm.handleException = (exception, pc, thread) => {
  if (exception?.type === "java/lang/NullPointerException") {
    const scalar = (value) => value == null || typeof value !== "object"
      ? (typeof value === "bigint" ? String(value) : value)
      : Array.isArray(value) || ArrayBuffer.isView(value)
        ? {arrayLength: value.length} : {type: value.type};
    const detail = {
      type: exception.type, message: String(exception.message || ""), pc,
      stack: (thread.callStack?.items || []).map(frame => ({
        owner: frame.className, method: frame.method?.name,
        descriptor: frame.method?.descriptor, pc: frame.pc,
        locals: (frame.locals || []).map(scalar),
      })),
    };
    session.runtimeExceptions.push(detail);
    if (session.runtimeExceptions.length > 16) session.runtimeExceptions.shift();
    sendTelemetry("guest_exception", detail);
  }
  return handleException(exception, pc, thread);
};

// JVM.run sets up the final classpath and prepares it before executing Java,
// including <clinit>. Observe that pass without running guest code early or
// inserting another preparation pass after the logo.
setStatus("Preparing optimized browser runtime…");
const prepare = jvm.precompileInitializedClasses.bind(jvm);
jvm.precompileInitializedClasses = async (options = {}) => {
  const startedAt = performance.now();
  const result = await prepare({
    ...options,
    onProgress(progress) {
      options.onProgress?.(progress);
      if (progress.completed % 100 === 0 || progress.completed === progress.total) {
        const stage = progress.tier === "wasm" ? "WebAssembly (2/2)"
          : progress.tier === "javascript" ? "JavaScript (1/2)" : "classes";
        setStatus(`Preparing ${stage}… ${progress.completed}/${progress.total}`);
      }
    },
  });
  session.runtimePreparation = {...result, durationMs: performance.now() - startedAt};
  sendTelemetry("runtime_preparation_complete", session.runtimePreparation);
  return result;
};
const recordGuestStart = () => {
  session.runtimeStartedAt = performance.now();
  sendTelemetry("guest_execution_start", {at: session.runtimeStartedAt});
  setStatus("Starting GeoBlox…");
};
if (typeof jvm.jit.markMainStarted === "function") {
  const markMainStarted = jvm.jit.markMainStarted.bind(jvm.jit);
  jvm.jit.markMainStarted = (...args) => {
    const result = markMainStarted(...args);
    recordGuestStart();
    return result;
  };
}

// Old bundles cannot safely prepare uninitialized classes. Report the missing
// lifecycle instead of forcing an unsupported compilation pass.
if (typeof jvm.prepareBeforeMain !== "boolean") {
  sendTelemetry("runtime_preparation_unavailable", {
    reason: "JVM bundle lacks preparation-before-main; rebuild browser-runtime from current java-tools source",
  });
}
