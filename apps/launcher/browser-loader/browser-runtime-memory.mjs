// Runtime's Node process/os/v8 probes are unavailable in cloned browser bundles.
export function installBrowserRuntimeMemory(jvm, host = globalThis) {
  const methods = jvm.jre['java/lang/Runtime'].methods;
  const limit = 512 * 1024 * 1024;
  const sample = () => {
    const memory = host.performance?.memory;
    const total = Math.max(1, Math.min(limit, Number(memory?.totalJSHeapSize) || limit));
    const used = Math.max(0, Math.min(total, Number(memory?.usedJSHeapSize) || 0));
    return {total: Math.floor(total), free: Math.floor(total - used)};
  };
  methods['maxMemory()J'] = () => BigInt(limit);
  methods['totalMemory()J'] = () => BigInt(sample().total);
  methods['freeMemory()J'] = () => BigInt(sample().free);
  methods['availableProcessors()I'] = () => Math.max(1, Math.trunc(Number(host.navigator?.hardwareConcurrency) || 1));
  methods['gc()V'] = methods['runFinalization()V'] = () => {};
}
