(() => {
  const jvm = window.jvmDebug && window.jvmDebug.debugController && window.jvmDebug.debugController.jvm;
  if (!jvm) return 'no jvm';
  const rf = (obj, key) => { if (!obj || !obj.fields) return undefined; const f = obj.fields;
    const sym = Object.getOwnPropertySymbols(f).find(s => String(s).includes('denseFieldSlots'));
    const slot = sym && f[sym] ? f[sym].get(key) : undefined; return Number.isInteger(slot) ? f[slot] : f[key]; };
  const st = (cls, name) => { const c = jvm.classes[cls]; if (!c || !c.staticFields) return 'nocls'; const sf = c.staticFields; const keys = typeof sf.keys === 'function' ? [...sf.keys()] : Object.keys(sf); const k = keys.find(k => k.startsWith(name + ':')); if (!k) return 'nofield'; return typeof sf.get === 'function' ? sf.get(k) : sf[k]; };
  const show = v => v === null ? 'null' : v === undefined ? 'undef' : typeof v === 'bigint' ? String(v) : typeof v === 'object' ? (Array.isArray(v) ? '[len ' + v.length + ']' : v.array ? '[arr ' + v.array.length + ']' : (v.type || 'obj')) : String(v);
  const list = ab => { const head = rf(ab, 'ab.b'); if (!head) return 'nohead'; const out = []; let n = rf(head, 'be.p'); let guard = 0; while (n && n !== head && guard++ < 50) { let id = rf(n, 'pj.r'); if (id === undefined) { const f = n.fields || {}; const sym = Object.getOwnPropertySymbols(f).find(s => String(s).includes('denseFieldSlots')); const keys = sym && f[sym] ? [...f[sym].keys()] : Object.keys(f); const k = keys.find(k => /\.r$/.test(k)); id = k ? rf(n, k) : undefined; if (id === undefined) out.push('keys:' + keys.join(',')); } out.push((id === undefined ? '?' : (Number(BigInt(id) >> 32n) + '/' + Number(BigInt(id) & 0xffffffffn))) + (rf(n, 'pj.z') ? 'p' : 'd') + (rf(n, 'pj.D') ? 'U' : 'n')); n = rf(n, 'be.p'); } return out.join(' '); };
  const r = {};
  r.s_Pb = show(st('s', 'Pb')); r.hd_n = show(st('hd', 'n')); r.hc_d = show(st('hc', 'd'));
  const loader = st('sh', 'g'); r.cb_j = show(rf(loader, 'cb.j')); r.cb_g = show(rf(loader, 'cb.g'));
  const js5 = st('ta', 'k'); r.sock = show(rf(js5, 'qb.v')); r.idle = show(rf(js5, 'dd.b')); r.fail_j = show(rf(js5, 'dd.j')); r.o = show(rf(js5, 'dd.o'));
  r.q_urgent_d = list(rf(js5, 'dd.d')); r.q_normal_n = list(rf(js5, 'dd.n')); r.inflight_g = list(rf(js5, 'dd.g')); r.inflight_l = list(rf(js5, 'dd.l'));
  const stages = rf(loader, 'cb.f'); const arr = stages && (stages.array || stages); const j = rf(loader, 'cb.j');
  if (arr && Number.isInteger(j) && arr[j]) { const stg = arr[j]; r.stage_caption = show(rf(stg, 'pb.j')); const ar = rf(stg, 'pb.g');
    r.archive_index = show(rf(ar, 'ji.f')); const d = rf(ar, 'ji.d'); const da = d && (d.array || d); r.groups_loaded = da ? da.filter(x => x != null).length + '/' + da.length : 'n/a';
    const prov = rf(ar, 'ji.a'); r.prov_F = (() => { const F = rf(prov, 'le.F'); const a = F && (F.array || F); return a ? Array.from(a).join('') : 'n/a'; })(); r.prov_I = show(rf(prov, 'le.I')); r.prov_p = show(rf(prov, 'le.p')); r.prov_x = show(rf(prov, 'le.x')); }
  const frameName = t => { try { const cs = t.callStack; const fr = cs && (typeof cs.peek === 'function' ? cs.peek() : (cs.frames && cs.frames[cs.frames.length - 1])); if (!fr) return '-'; const m = fr.method || fr.methodInfo || {}; return (fr.className || fr.class || (m.className) || '?') + '.' + (m.name || fr.methodName || '?') + (fr.pc !== undefined ? '@' + fr.pc : ''); } catch (e) { return 'err'; } };
  r.threads = (jvm.threads || []).map(t => t.id + ':' + t.name + ':' + t.status + (t.sleepUntil ? ':sleep' : '') + ':' + frameName(t));
  try { const stg = arr && Number.isInteger(j) && arr[j]; const ar = stg && rf(stg, 'pb.g'); const prov = ar && rf(ar, 'ji.a'); const im = prov && rf(prov, 'le.v');
    if (im) { r.disk_queue_b = show(rf(im, 'im.b')); r.disk_stop_a = show(rf(im, 'im.a')); r.disk_thread = show(rf(im, 'im.h')); const q = rf(im, 'im.e'); const head = q && rf(q, 'ab.b'); let n = head && rf(head, 'be.p'); const items = []; let g = 0; while (n && n !== head && g++ < 30) { items.push(show(rf(n, 'el.F')) + (rf(n, 'pj.z') ? 'p' : 'd')); n = rf(n, 'be.p'); } r.disk_items = items.join(' '); }
    const G = prov && rf(prov, 'le.G'); r.prov_G = show(G); } catch (e) { r.disk_err = String(e).slice(0, 120); }
  return JSON.stringify(r);
})()
