(() => {
  const jvm = window.jvmDebug.debugController.jvm;
  const frameName = t => { try { const cs = t.callStack; const fr = cs && (typeof cs.peek === 'function' && !cs.isEmpty() ? cs.peek() : (cs.items && cs.items[cs.items.length - 1])); if (!fr) return '-'; const m = fr.method || {}; return (fr.className || m.className || '?') + '.' + (m.name || '?') + (m.descriptor || '') + '@' + fr.pc; } catch (e) { return 'err'; } };
  const now = () => jvm.clock.millis();
  const snap = () => jvm.threads.map(t => t.id + ':' + t.status + ':' + frameName(t) + (t.sleepUntil !== undefined ? ':sleep' + (Number(t.sleepUntil) - now()) : '') + (t.waitDeadline !== undefined ? ':waitDl' + (Number(t.waitDeadline) - now()) : '') + (t.blockingOn ? ':blocked' : '') + (t.callStack && t.callStack.items ? ':depth' + t.callStack.items.length : ''));
  const before = snap();
  const sel = {}; let idle = 0, ticks = 0, yields = 0;
  const orig = jvm._prepareSchedulerTick;
  jvm._prepareSchedulerTick = function () { const r = orig.call(this); ticks++; if (r.thread) { const k = r.thread.id; sel[k] = (sel[k] || 0) + 1; } else if (r.idle) idle++; return r; };
  const origYield = jvm._yieldHostTurn;
  jvm._yieldHostTurn = function () { yields++; return origYield.call(this); };
  const t0 = performance.now();
  return new Promise(resolve => setTimeout(() => {
    jvm._prepareSchedulerTick = orig; jvm._yieldHostTurn = origYield;
    resolve(JSON.stringify({ ms: Math.round(performance.now() - t0), ticks, idle, yields, sel,
      producer: jvm._awtFrameProducerThread && jvm._awtFrameProducerThread.id,
      eventThread: jvm._awtEventThread && jvm._awtEventThread.id, audioPrio: !!jvm._audioPriority,
      pendingPresent: jvm._awtPendingPresentationCount, backlog: jvm._awtDroppedFrameBacklog, strategy: jvm._hostYieldStrategy(),
      relief: jvm._schedulerReliefActive, hidden: document.hidden, before, after: snap() }));
  }, 5000));
})()
