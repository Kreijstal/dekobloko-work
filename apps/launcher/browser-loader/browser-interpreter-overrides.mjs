// Keep methods that trigger bugs in older cloned JITs on the interpreter.
// Entries may select every overload (Class.method) or one exact descriptor.
export function installInterpreterOverrides(jvm, interpretMethods = []) {
  const interpreted = new Set(interpretMethods || []);
  if (!interpreted.size) return;
  const jit = jvm.jit;
  if (!jit?.jitDenied) throw new Error('JVM interpreter override hook unavailable');
  const denied = jit.jitDenied.bind(jit), recorded = new WeakSet();
  jvm.browserCompilationFallbacks = [];
  jit.jitDenied = method => {
    if (denied(method)) return true;
    const owner = jvm.findClassNameForMethod?.(method) || method?.className;
    if (!interpreted.has(`${owner}.${method?.name}`) && !interpreted.has(`${owner}.${method?.name}${method?.descriptor}`)) return false;
    if (!recorded.has(method)) {
      recorded.add(method);
      if (jvm.browserCompilationFallbacks.length < 100)
        jvm.browserCompilationFallbacks.push({class: owner, method: method.name, descriptor: method.descriptor});
    }
    return true;
  };
}
