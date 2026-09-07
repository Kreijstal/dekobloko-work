// Deko Bloko frame pacing in real Firefox, against the local game library.
//
//   xvfb-run -n 71 node scripts/measure-dekobloko-firefox-fps.js \
//     --url http://127.0.0.1:3771/play/dekobloko --out .work/phase1/ff
//
// Every Phase 1 number so far is Node. Section 3.5 of docs/refactor.md is
// explicit that no Node or SpiderMonkey run satisfies the browser gate, so
// this exists to say how far the real target actually is. It is a READ-ONLY
// client of a game-library server that is already running: it starts no
// listener of its own and never touches a remote host.
//
// This machine is not the 900 MHz target, so a pass here is not the gate.
// It is the prerequisite measurement the gate is stated against.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const URL = opt('--url', 'http://127.0.0.1:3771/play/dekobloko');
const OUT = path.resolve(opt('--out', '.work/phase1/firefox'));
const BUDGET_MS = 1000 / 24;
const SAMPLE_MS = Number(opt('--sample-ms', '500'));
const MAX_MS = Number(opt('--max-ms', '360000'));

// This repository's playwright may pin a Firefox build that was never
// downloaded; pick one whose browser is actually on disk and say which.
function resolveFirefox() {
  const tried = [];
  const roots = [path.resolve(__dirname, '..', '..')];
  const candidates = [];
  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root); } catch (error) { entries = []; }
    for (const entry of entries) {
      const candidate = path.join(root, entry, 'node_modules', 'playwright');
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
  }
  for (const candidate of candidates) {
    try {
      const { firefox } = require(candidate);
      if (fs.existsSync(firefox.executablePath())) return firefox;
      tried.push(`${candidate}: browser absent`);
    } catch (error) {
      tried.push(`${candidate}: ${error.message.split('\n')[0]}`);
    }
  }
  throw new Error(`no usable playwright firefox:\n  ${tried.join('\n  ')}`);
}

function percentile(sorted, fraction) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return Number(sorted[index].toFixed(2));
}

function bucket(gaps) {
  if (!gaps.length) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  return {
    frames: gaps.length,
    meanFps: Number((1000 / (total / gaps.length)).toFixed(2)),
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxGapMs: Number(sorted[sorted.length - 1].toFixed(2)),
    framesOverBudget: gaps.filter((gap) => gap > BUDGET_MS).length,
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const firefox = resolveFirefox();
  console.log(`firefox: ${firefox.executablePath()}`);
  console.log(`url:     ${URL}`);
  // A throwaway profile: a shared one has already once carried a stale pref
  // into a run and faked a large regression.
  const profileDir = fs.mkdtempSync(path.join(OUT, 'profile-'));
  const context = await firefox.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1024, height: 768 },
  });
  const page = context.pages()[0] || await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));

  const started = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // The runtime already keeps every frame's real gap in a 256-entry ring
  // (Graphics.js, recentPresentationGaps). At the rates seen here that ring
  // holds ~11 s, so a 500 ms poll cannot overflow it: taking the last N
  // entries, where N is the growth in `presented`, reconstructs the exact
  // per-frame sequence. That is what section 0.5 asks for, and it is why this
  // harness no longer has to settle for interval rates.
  const probe = () => page.evaluate(() => {
    const debug = window.jvmDebug;
    const jvm = debug && debug.debugController && debug.debugController.jvm;
    const stats = (jvm && jvm._awtPresentationStats) || null;
    return {
      hasJvm: Boolean(jvm),
      hidden: document.hidden,
      presented: stats ? (stats.presented || 0) : 0,
      gaps: stats && Array.isArray(stats.recentPresentationGaps)
        ? stats.recentPresentationGaps.slice() : [],
      fpsText: (document.getElementById('fpsValue') || {}).textContent || '',
    };
  });

  const samples = [];
  const gaps = [];
  let firstFrameAtMs = null;
  let lastPresented = 0;
  let ringOverflows = 0;
  let missedFrames = 0;
  let hiddenSamples = 0;
  while (Date.now() - started < MAX_MS) {
    let sample = null;
    try { sample = await probe(); } catch (error) { /* navigating */ }
    if (sample) {
      const atMs = Date.now() - started;
      if (firstFrameAtMs === null && sample.presented > 0) {
        firstFrameAtMs = atMs;
        console.log(`[${(atMs / 1000).toFixed(1)}s] first frame`);
      }
      if (sample.presented !== lastPresented) {
        const delta = sample.presented - lastPresented;
        samples.push({ atMs, presented: sample.presented, delta });
        // Losing the ring would silently drop frames from the distribution,
        // so say it rather than report a prettier number than was measured.
        if (delta > sample.gaps.length && lastPresented > 0) {
          ringOverflows += 1;
          missedFrames += delta - sample.gaps.length;
        }
        const taken = sample.gaps.slice(Math.max(0, sample.gaps.length - delta));
        for (const gapMs of taken) {
          if (typeof gapMs === 'number' && gapMs >= 0) gaps.push({ atMs, gapMs });
        }
        lastPresented = sample.presented;
      }
      if (sample.hidden) { hiddenSamples += 1; console.log('WARNING: tab reported hidden'); }
    }
    await page.waitForTimeout(SAMPLE_MS);
  }

  const shot = path.join(OUT, 'final.png');
  try { await page.screenshot({ path: shot }); } catch (error) { /* ignore */ }
  await context.close();

  const intervals = [];
  for (let index = 1; index < samples.length; index += 1) {
    const span = samples[index].atMs - samples[index - 1].atMs;
    if (span <= 0) continue;
    intervals.push({ atMs: samples[index].atMs,
      fps: Number((samples[index].delta * 1000 / span).toFixed(2)) });
  }
  // Split the run the way section 0.5 asks for it. The boundary is not a
  // guess: loading is a multi-second window with no presentation at all, so
  // the last gap longer than LOADING_GAP_MS is where the menu begins. Frames
  // before it are the logo (and the dark loading window); frames after it are
  // the menu. If no such gap exists the run never left one phase, and the
  // report says so instead of inventing a division.
  const LOADING_GAP_MS = 2000;
  let boundary = -1;
  for (let index = gaps.length - 1; index >= 0; index -= 1) {
    if (gaps[index].gapMs > LOADING_GAP_MS) { boundary = index; break; }
  }
  const logoGaps = boundary >= 0 ? gaps.slice(0, boundary) : gaps.slice();
  const menuGaps = boundary >= 0 ? gaps.slice(boundary + 1) : [];
  const distribution = (entries) => {
    const values = entries.map((entry) => entry.gapMs).sort((a, b) => a - b);
    if (!values.length) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      frames: values.length,
      meanFps: Number((1000 * values.length / sum).toFixed(2)),
      p50Ms: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
      p99Ms: percentile(values, 0.99),
      maxMs: percentile(values, 1),
      overBudget: values.filter((value) => value > BUDGET_MS).length,
      overBudgetPct: Number(
        (100 * values.filter((value) => value > BUDGET_MS).length /
          values.length).toFixed(1)),
    };
  };
  const report = {
    url: URL, startedAt: new Date(started).toISOString(),
    firstFrameAtMs, totalPresented: lastPresented,
    budgetMs: Number(BUDGET_MS.toFixed(2)),
    // Every frame's real gap, reconstructed from the runtime's own ring.
    // ringOverflows > 0 would mean frames were lost between polls and the
    // distribution is incomplete.
    capture: { sampledFrames: gaps.length, ringOverflows, missedFrames,
      hiddenSamples },
    phases: {
      boundaryFound: boundary >= 0,
      logo: distribution(logoGaps),
      menu: distribution(menuGaps),
    },
    gaps: gaps.map((entry) => Number(entry.gapMs.toFixed(2))),
    intervals, pageErrors: pageErrors.slice(0, 20),
    note: 'per-frame gaps from recentPresentationGaps; intervals are a ' +
      'cross-check only. This machine is not the 900 MHz target of 3.5.',
  };
  fs.writeFileSync(path.join(OUT, 'report.json'),
    JSON.stringify(report, null, 2));

  console.log(`first frame:     ${firstFrameAtMs === null ? 'never' : (firstFrameAtMs / 1000).toFixed(1) + 's'}`);
  console.log(`frames total:    ${lastPresented}  captured ${gaps.length}`);
  if (ringOverflows) {
    console.log(`INCOMPLETE:      ${missedFrames} frames lost in ${ringOverflows} polls`);
  }
  const line = (name, dist) => {
    if (!dist) { console.log(`${name.padEnd(16)} no frames`); return; }
    console.log(`${name.padEnd(16)} ${String(dist.frames).padStart(5)} frames  ` +
      `mean ${String(dist.meanFps).padStart(6)} fps  ` +
      `p50 ${String(dist.p50Ms).padStart(7)}  p95 ${String(dist.p95Ms).padStart(7)}  ` +
      `p99 ${String(dist.p99Ms).padStart(8)}  max ${String(dist.maxMs).padStart(9)} ms  ` +
      `over ${dist.overBudget} (${dist.overBudgetPct}%)`);
  };
  console.log(`budget:          ${BUDGET_MS.toFixed(2)} ms = 24 fps`);
  line('logo+loading:', report.phases.logo);
  line('menu:', report.phases.menu);
  console.log(`page errors:     ${pageErrors.length}`);
  for (const line of pageErrors.slice(0, 5)) console.log('  ' + line);
  console.log(`report:          ${path.join(OUT, 'report.json')}`);
  process.exit(0);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
