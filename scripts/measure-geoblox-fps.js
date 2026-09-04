// GeoBlox frame-rate harness: main menu, Instructions, tutorial, gameplay.
//
//   DISPLAY=:10 NODE_PATH=<java-tools>/node_modules \
//     node scripts/measure-geoblox-fps.js --out .work/geoblox-fps/run1 [--sample 20]
//
// Requires the cloning page on --url (default http://localhost:5173/). Writes
// samples.jsonl plus one screenshot per state; always check the screenshots
// before trusting a state's numbers. Never run two of these concurrently.
// See docs/performance.md.
'use strict';
const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes(n);
const OUT = opt('--out', './fpsout');
const URL = opt('--url', 'http://localhost:5173/');
const SAMPLE_S = Number(opt('--sample', '20'));
const PROFILE_DIR = opt('--profile-dir', path.join(process.env.HOME, '.cache/geoblox-ff-profile'));
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const log = (...a) => { const s = `[${((Date.now() - T0) / 1000).toFixed(1)}s] ${a.join(' ')}`; console.log(s); fs.appendFileSync(path.join(OUT, 'log.txt'), s + '\n'); };

(async () => {
  const ctx = await firefox.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: opt('--exe', process.env.HOME + '/.cache/ms-playwright/firefox-1509/firefox/firefox'),
    viewport: { width: 1000, height: 760 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 160)));
  await page.goto(URL);
  log('navigated', URL);

  const stats = () => page.evaluate(() => {
    const s = window.geobloxSession;
    const jvm = s && s.debug && s.debug.debugController && s.debug.debugController.jvm;
    const p = (jvm && jvm._awtPresentationStats) || {};
    return {
      presented: p.presented || 0, dirty: p.dirtyMarks || 0, coalesced: p.coalesced || 0,
      uploadMs: p.uploadMs || 0,
      timings: (p.recentFrameTimings || []).map((t) => ({ a: t.presentedAt, g: t.presentationGapMs, c: t.completionGapMs, u: t.uploadMs })),
      hidden: document.hidden, focus: document.hasFocus(),
      status: (document.getElementById('geoblox-status') || {}).textContent || '',
      prepDone: Boolean(s && (s.runtimePreparation || s.runtimePreparationError)),
      hasJvm: Boolean(jvm), now: performance.now(),
    };
  });

  const waitFor = async (label, pred, timeoutMs) => {
    const t = Date.now(); let last = null;
    while (Date.now() - t < timeoutMs) {
      try { last = await stats(); } catch (e) {}
      if (last && pred(last)) { log('PHASE', label, 'presented', last.presented, 'dirty', last.dirty, JSON.stringify(last.status.slice(0, 60))); return last; }
      await page.waitForTimeout(500);
    }
    log('TIMEOUT waiting for', label);
    return null;
  };

  if (!await waitFor('jvm_started', (s) => s.hasJvm, 900000)) { await ctx.close(); process.exit(1); }
  await waitFor('first_frame', (s) => s.presented > 0, 600000);
  await waitFor('ready', (s) => s.prepDone || /^GeoBlox ready/.test(s.status), 900000);
  await page.waitForTimeout(10000);
  await page.screenshot({ path: path.join(OUT, '00-menu.png') });

  const canvas = await page.waitForSelector('.awt-applet-root canvas');
  const box = await canvas.boundingBox();
  log('canvas box', JSON.stringify(box));

  async function sample(label, seconds) {
    const start = await stats();
    let prev = start; let lastAt = -Infinity;
    const fpsSeries = []; const dirtySeries = []; const gaps = [];
    for (let i = 0; i < seconds; i++) {
      await page.waitForTimeout(1000);
      const cur = await stats();
      const dt = (cur.now - prev.now) / 1000;
      fpsSeries.push(+((cur.presented - prev.presented) / dt).toFixed(1));
      dirtySeries.push(+((cur.dirty - prev.dirty) / dt).toFixed(1));
      for (const t of cur.timings) if (t.a > lastAt && t.g != null) gaps.push(+t.g.toFixed(1));
      if (cur.timings.length) lastAt = cur.timings[cur.timings.length - 1].a;
      prev = cur;
    }
    const total = (prev.now - start.now) / 1000;
    const sorted = gaps.slice().sort((a, b) => a - b);
    const pct = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : null);
    const summary = {
      label, seconds: +total.toFixed(1),
      avgFps: +((prev.presented - start.presented) / total).toFixed(2),
      min1s: Math.min(...fpsSeries), max1s: Math.max(...fpsSeries),
      guestFramesPerS: +((prev.dirty - start.dirty) / total).toFixed(1),
      coalesced: prev.coalesced - start.coalesced,
      uploadMsPerS: +((prev.uploadMs - start.uploadMs) / total).toFixed(1),
      gapCount: gaps.length, gapMedian: pct(0.5), gapP90: pct(0.9), gapP99: pct(0.99), gapMax: sorted.length ? sorted[sorted.length - 1] : null,
      hidden: prev.hidden, focus: prev.focus,
      fpsSeries, dirtySeries,
    };
    log('SAMPLE', JSON.stringify(summary));
    fs.appendFileSync(path.join(OUT, 'samples.jsonl'), JSON.stringify(summary) + '\n');
    await page.screenshot({ path: path.join(OUT, `${label}.png`) });
    return summary;
  }
  const click = async (label, fx, fy) => {
    await page.mouse.move(box.x + fx, box.y + fy); await page.waitForTimeout(150);
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
    log(`click ${label} @${fx},${fy}`);
  };
  const key = async (k) => { await page.keyboard.press(k); log('key', k); };

  await sample('menu', SAMPLE_S);

  // Instructions
  await click('instructions', 320, 198);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, '01-after-instructions-click.png') });
  await sample('instructions', SAMPLE_S);

  // Back to menu, then start the game.
  await key('Escape');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, '02-after-escape.png') });
  await click('startgame', 320, 158);
  await page.waitForTimeout(12000);
  await page.screenshot({ path: path.join(OUT, '03-after-start.png') });
  await sample('tutorial', SAMPLE_S);
  await key('Space');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(OUT, '04-after-space.png') });
  await sample('gameplay', SAMPLE_S);

  await ctx.close();
})().catch((e) => { log('FAILED', (e && e.stack) || e); process.exit(1); });
