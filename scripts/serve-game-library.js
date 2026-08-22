const http = require('http');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const repositoryRoot = path.resolve(__dirname, '..');
const javaToolsRoot = process.env.JAVA_TOOLS_ROOT ||
  path.resolve(repositoryRoot, '..', 'java-tools');
const {WebSocketServer, WebSocket} =
  require(path.join(javaToolsRoot, 'node_modules', 'ws'));

// Data-driven browser launcher for every game in the AlterOrb catalog.
const port = Number(
  process.env.GAME_LIBRARY_PORT ||
  process.env.DEKOBLOKO_BROWSER_PORT ||
  3765);
const bundleDir = process.env.GAME_LIBRARY_BUNDLE_DIR ||
  '/tmp/dekobloko-browser-bundle';
const bundleScript =
  process.env.GAME_LIBRARY_BUNDLE ||
  process.env.DEKOBLOKO_BROWSER_BUNDLE ||
  'jvm-debug-current.js';
const gamepackDir = path.join(repositoryRoot, '.work', 'gamepacks');
const menuImageDir = path.join(repositoryRoot, '.work', 'alterorb-jvmjs', 'menus');
const alterOrbConfigUrl = process.env.ALTERORB_CONFIG_URL ||
  'https://static.alterorb.net/launcher/v3/config.json';
const alterOrbConfigCache = path.join(
  repositoryRoot, '.work', 'game-library', 'config.json');
const gameCacheRoot = path.join(
  os.homedir(), '.alterorb', 'caches');
const telemetryPath =
  process.env.GAME_LIBRARY_TELEMETRY_PATH ||
  process.env.DEKOBLOKO_TELEMETRY_PATH ||
  path.join(repositoryRoot, '.work', 'telemetry', 'game-library.jsonl');
const diagnosticsHtmlPath =
  path.join(javaToolsRoot, 'benchmarks', 'browser-ceiling.html');
const diagnosticsScriptPath =
  path.join(javaToolsRoot, 'benchmarks', 'browser-ceiling.js');
const diagnosticsJavaPath =
  path.join(javaToolsRoot, 'benchmarks', 'BrowserAwtCeiling.java');
const diagnosticsJarPath =
  path.join(bundleDir, 'browser-awt-ceiling.jar');
const loadingLogoPath =
  path.join(repositoryRoot, 'web', 'jvm-js-logo.svg');
fs.mkdirSync(path.dirname(telemetryPath), {recursive: true});
const versionCache = new Map();
let alterOrbConfig = null;

function gameJarPath(game) {
  // Per-game override for locally patched (server-key) gamepacks; the
  // override opts the game out of catalog-hash validation because a
  // re-signed JAR cannot match AlterOrb's published hash.
  const override =
    process.env['GAME_LIBRARY_JAR_' +
      game.internalName.toUpperCase().replace(/[^A-Z0-9]/g, '_')];
  if (override) return override;
  if (game.internalName === 'dekobloko' && process.env.DEKOBLOKO_BROWSER_JAR) {
    return process.env.DEKOBLOKO_BROWSER_JAR;
  }
  return path.join(gamepackDir, game.internalName + '.jar');
}

function cacheDirectoryForGame(game) {
  return path.join(gameCacheRoot, game.internalName);
}

function cacheFilesForGame(game) {
  const directory = cacheDirectoryForGame(game);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name =>
    name === 'random.dat' || /^main_file_cache\.(?:dat2|idx\d+)$/.test(name));
}

function gameById(id) {
  return alterOrbConfig && (alterOrbConfig.games || [])
    .find(game => game.internalName === id) || null;
}

function gameJarOverridden(game) {
  return Boolean(process.env['GAME_LIBRARY_JAR_' +
    game.internalName.toUpperCase().replace(/[^A-Z0-9]/g, '_')]);
}

function gameJarAvailable(game) {
  const jarPath = gameJarPath(game);
  if (gameJarOverridden(game)) return fs.existsSync(jarPath);
  return fs.existsSync(jarPath) &&
    fileVersion(jarPath) === String(game.gamepackHash || '').toLowerCase();
}

function buildDiagnosticsJar() {
  const current = fs.existsSync(diagnosticsJarPath) &&
    fs.statSync(diagnosticsJarPath).mtimeMs >= fs.statSync(diagnosticsJavaPath).mtimeMs;
  if (current) return;
  const directory = fs.mkdtempSync('/tmp/dekobloko-awt-ceiling-');
  try {
    const javac = spawnSync('javac', [
      '-source', '8', '-target', '8', '-d', directory, diagnosticsJavaPath
    ], {encoding: 'utf8'});
    if (javac.status !== 0) {
      throw new Error('Failed to compile browser AWT diagnostics: ' +
        String(javac.stderr || javac.stdout));
    }
    const jar = spawnSync('jar', [
      'cf', diagnosticsJarPath, '-C', directory, 'BrowserAwtCeiling.class'
    ], {encoding: 'utf8'});
    if (jar.status !== 0) {
      throw new Error('Failed to package browser AWT diagnostics: ' +
        String(jar.stderr || jar.stdout));
    }
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}

buildDiagnosticsJar();

function fileVersion(file) {
  const stat = fs.statSync(file);
  const cached = versionCache.get(file);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
    return cached.version;
  }
  const version = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  versionCache.set(file, {size: stat.size, mtimeMs: stat.mtimeMs, version});
  return version;
}

function assetEntry(url, file, name, virtualPath = name) {
  const stat = fs.statSync(file);
  const version = fileVersion(file);
  return {name, virtualPath, url: url + '?v=' + version, version, size: stat.size};
}

function browserAssetManifest(game) {
  const bundlePath = path.join(bundleDir, bundleScript);
  const jarPath = gameJarPath(game);
  const cacheDir = cacheDirectoryForGame(game);
  const cacheFiles = cacheFilesForGame(game);
  return {
    schema: 1,
    game: {
      id: game.internalName,
      name: game.name,
      mainClass: game.mainClass,
      gamecrc: game.gamecrc,
      server: String(alterOrbConfig.server).replace(/\/?$/, '/'),
      expectedStartupInflateBlocks:
        game.internalName === 'dekobloko' ? 9 : null,
    },
    runtime: assetEntry('/' + bundleScript, bundlePath, bundleScript),
    jar: fs.existsSync(jarPath) ? assetEntry(
      '/game-jars/' + game.internalName + '.jar',
      jarPath,
      game.internalName + '.jar',
    ) : null,
    gameCache: cacheFiles.map(name => assetEntry(
      '/game-cache/' + game.internalName + '/' + name,
      path.join(cacheDir, name),
      name,
      '.alterorb/caches/' + game.internalName + '/' + name,
    ))
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function libraryHtml() {
  const games = (alterOrbConfig.games || []).slice()
    .sort((left, right) => left.name.localeCompare(right.name));
  const cards = games.map(game => {
    const jarPath = gameJarPath(game);
    const menuPath = path.join(menuImageDir, game.internalName + '.png');
    const available = gameJarAvailable(game);
    const thumbnail = fs.existsSync(menuPath)
      ? '/game-thumbnails/' + game.internalName + '.png?v=' +
        fileVersion(menuPath)
      : '/jvm-js-logo.svg?v=' + fileVersion(loadingLogoPath);
    const bytes = available ? fs.statSync(jarPath).size : 0;
    return '<a class="game-card' + (available ? '' : ' unavailable') +
      '" href="' + (available ? '/play/' + encodeURIComponent(game.internalName) : '#') +
      '" data-name="' + escapeHtml(game.name.toLowerCase()) + '">' +
      '<img src="' + thumbnail + '" alt="" loading="lazy">' +
      '<span class="game-copy"><strong>' + escapeHtml(game.name) + '</strong>' +
      '<small>' + escapeHtml(game.mainClass) + ' · ' +
      (available ? (bytes / 1048576).toFixed(1) + ' MiB' : 'JAR unavailable or invalid') +
      '</small></span></a>';
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>jvm.js game library</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: #f5f7fb;
      background: radial-gradient(circle at 50% 0, #263553 0, #141a27 44%, #0b0e15 100%);
      font: 15px system-ui, sans-serif;
    }
    header {
      display: flex;
      align-items: center;
      gap: 22px;
      max-width: 1320px;
      margin: 0 auto;
      padding: 28px 24px 18px;
    }
    header img { width: 110px; height: 110px; object-fit: contain; }
    h1 { margin: 0 0 5px; font-size: clamp(28px, 5vw, 48px); }
    header p { margin: 0; color: #aebad0; }
    .toolbar {
      max-width: 1320px;
      margin: 0 auto;
      padding: 0 24px 20px;
    }
    #gameSearch {
      width: min(430px, 100%);
      padding: 11px 13px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      color: #fff;
      background: rgba(8,11,18,.72);
      font: inherit;
    }
    #gameGrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
      gap: 16px;
      max-width: 1320px;
      margin: 0 auto;
      padding: 0 24px 40px;
    }
    .game-card {
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 11px;
      color: inherit;
      background: rgba(20,27,41,.88);
      text-decoration: none;
      box-shadow: 0 10px 28px rgba(0,0,0,.25);
      transition: transform .12s ease, border-color .12s ease;
    }
    .game-card:hover, .game-card:focus-visible {
      transform: translateY(-2px);
      border-color: #69c7aa;
      outline: none;
    }
    .game-card[hidden] { display: none; }
    .game-card img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #000;
    }
    .game-copy { display: block; padding: 12px 13px 14px; }
    .game-copy strong { display: block; font-size: 16px; }
    .game-copy small { display: block; margin-top: 4px; color: #93a2bd; }
    .unavailable { opacity: .45; pointer-events: none; }
  </style>
</head>
<body>
  <header>
    <img src="/jvm-js-logo.svg?v=${fileVersion(loadingLogoPath)}" alt="jvm.js">
    <div>
      <h1>Game library</h1>
      <p>${games.length} AlterOrb games · one shared browser JVM runner</p>
    </div>
  </header>
  <div class="toolbar">
    <input id="gameSearch" type="search" placeholder="Find a game…" aria-label="Find a game">
  </div>
  <main id="gameGrid">${cards}</main>
  <script>
    const search = document.getElementById('gameSearch');
    const cards = [...document.querySelectorAll('.game-card')];
    search.addEventListener('input', () => {
      const query = search.value.trim().toLowerCase();
      for (const card of cards) card.hidden = !card.dataset.name.includes(query);
    });
  </script>
</body>
</html>`;
}

const launcher = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>__GAME_NAME__ · jvm.js</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      padding: 24px;
      color: #f5f7fb;
      background: radial-gradient(circle at 50% 20%, #263553 0, #141a27 48%, #0b0e15 100%);
      font: 15px system-ui, sans-serif;
    }
    #libraryLink {
      display: inline-block;
      margin: 0 0 12px;
      color: #b9c7de;
      text-decoration: none;
    }
    #libraryLink:hover { color: #fff; }
    #appletStage {
      position: relative;
      width: 800px;
      height: 600px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 18px 55px rgba(0,0,0,.42);
    }
    #loader {
      position: absolute;
      z-index: 10;
      inset: 0;
      width: 800px;
      height: 600px;
      background: #000;
    }
    #loader.complete {
      display: none;
    }
    #loadingCanvas {
      display: block;
      width: 800px;
      height: 600px;
      background: #000;
    }
    #loader.error #loadingCanvas {
      outline: 2px solid #8f2b35;
      outline-offset: -2px;
    }
    .loader-accessible {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .report-button {
      width: 100%;
      margin-top: 12px;
      padding: 9px 11px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      color: #e4e9f3;
      background: rgba(255,255,255,.07);
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }
    .report-button:hover { background: rgba(255,255,255,.12); }
    #loaderCrashReportButton { display: none; }
    .awt-applet-root {
      position: absolute;
      inset: 0;
      z-index: 1;
      width: max-content;
      background: #fff;
    }
    #perfPanel {
      position: fixed;
      z-index: 20;
      top: 24px;
      right: 24px;
      width: 176px;
      padding: 15px 16px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      background: rgba(15, 20, 31, .9);
      box-shadow: 0 12px 38px rgba(0,0,0,.32);
      backdrop-filter: blur(7px);
      font-variant-numeric: tabular-nums;
    }
    .perf-title {
      margin-bottom: 4px;
      color: #91a0bb;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    #fpsValue {
      color: #78e1ba;
      font-size: 34px;
      font-weight: 750;
      line-height: 1;
    }
    .perf-unit { color: #b9c3d8; font-size: 13px; }
    .perf-detail {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 9px;
      color: #91a0bb;
      font-size: 12px;
    }
    .perf-detail output { color: #e4e9f3; }
    @media (max-width: 1040px) {
      #perfPanel { top: auto; right: 12px; bottom: 12px; }
    }
  </style>
</head>
<body>
  <a id="libraryLink" href="/">← Game library</a>
  <main id="appletStage">
    <div id="loader" aria-live="polite">
      <canvas id="loadingCanvas" width="800" height="600" aria-label="Game startup progress"></canvas>
      <div class="loader-accessible">
        <div id="status">Preparing the browser JVM…</div>
        <p id="loadingDetail">The first Firefox launch can take a while. Startup progress will appear here.</p>
        <div id="progressTrack" role="progressbar" aria-label="Game startup progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div id="progressFill"></div>
        </div>
        <span id="stageLabel">Stage 1 of 16 · 0%</span>
        <span id="elapsed">Elapsed 0s</span>
        <button id="loaderCrashReportButton" type="button">Send diagnostic report</button>
      </div>
    </div>
  </main>
  <aside id="perfPanel" aria-label="Live game performance">
    <div class="perf-title">Presented frames</div>
    <div><output id="fpsValue">--</output> <span class="perf-unit">FPS</span></div>
    <div class="perf-detail"><span>Frame gap</span><output id="frameGap">-- ms</output></div>
    <div class="perf-detail"><span>Worst · 2s</span><output id="worstGap">-- ms</output></div>
    <button id="crashReportButton" class="report-button" type="button">Send diagnostic report</button>
  </aside>
  <script>
    (async () => {
      const loader = document.getElementById('loader');
      const appletStage = document.getElementById('appletStage');
      const loadingCanvas = document.getElementById('loadingCanvas');
      const loadingContext = loadingCanvas.getContext('2d');
      const status = document.getElementById('status');
      const loadingDetail = document.getElementById('loadingDetail');
      const progressTrack = document.getElementById('progressTrack');
      const progressFill = document.getElementById('progressFill');
      const stageLabel = document.getElementById('stageLabel');
      const elapsed = document.getElementById('elapsed');
      const fpsValue = document.getElementById('fpsValue');
      const frameGap = document.getElementById('frameGap');
      const worstGap = document.getElementById('worstGap');
      const crashReportButton = document.getElementById('crashReportButton');
      const loaderCrashReportButton = document.getElementById('loaderCrashReportButton');
      const startedAt = performance.now();
      const assetManifest = __DEKOBLOKO_ASSET_MANIFEST__;
      const game = assetManifest.game;
      const loadingLogo = new Image();
      let loadingLogoReady = false;
      loadingLogo.addEventListener('load', () => {
        loadingLogoReady = true;
        renderLoadingCanvas();
      });
      loadingLogo.src = '/jvm-js-logo.svg?v=__JVM_JS_LOGO_VERSION__';
      const canvasLines = (text, maxWidth, maxLines) => {
        const words = String(text || '').replace(/\\s+/g, ' ').trim().split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
          const candidate = line ? line + ' ' + word : word;
          if (line && loadingContext.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
            if (lines.length === maxLines) break;
          } else {
            line = candidate;
          }
        }
        if (lines.length < maxLines && line) lines.push(line);
        if (words.length && lines.length === maxLines) {
          const last = lines.length - 1;
          while (lines[last].length > 1 &&
              loadingContext.measureText(lines[last] + '…').width > maxWidth) {
            lines[last] = lines[last].slice(0, -1);
          }
          if (!lines[last].endsWith(words[words.length - 1])) lines[last] += '…';
        }
        return lines;
      };
      const renderLoadingCanvas = () => {
        const width = loadingCanvas.width;
        const height = loadingCanvas.height;
        const value = Number(progressTrack.getAttribute('aria-valuenow') || 0);
        const failed = loader.classList.contains('error');
        loadingContext.fillStyle = '#000';
        loadingContext.fillRect(0, 0, width, height);
        loadingContext.textAlign = 'center';
        loadingContext.textBaseline = 'middle';
        if (loadingLogoReady) {
          loadingContext.drawImage(loadingLogo, 300, 30, 200, 200);
        } else {
          loadingContext.fillStyle = '#fff';
          loadingContext.font = 'bold 26px Arial, sans-serif';
          loadingContext.fillText('jvm.js', width / 2, 190);
        }
        loadingContext.fillStyle = failed ? '#ff858c' : '#d8d8d8';
        loadingContext.font = 'bold 16px Arial, sans-serif';
        loadingContext.fillText(status.textContent, width / 2, 245);
        const barX = 190;
        const barY = 280;
        const barWidth = 420;
        const barHeight = 18;
        loadingContext.fillStyle = '#111';
        loadingContext.fillRect(barX, barY, barWidth, barHeight);
        loadingContext.strokeStyle = failed ? '#c94d58' : '#8e8e8e';
        loadingContext.lineWidth = 1;
        loadingContext.strokeRect(barX + .5, barY + .5,
          barWidth - 1, barHeight - 1);
        const fillWidth = Math.max(0, Math.round((barWidth - 4) * value / 100));
        loadingContext.fillStyle = failed ? '#a52f3a' : '#4b9c82';
        loadingContext.fillRect(barX + 2, barY + 2, fillWidth, barHeight - 4);
        loadingContext.textAlign = 'left';
        loadingContext.fillStyle = '#a8a8a8';
        loadingContext.font = '12px Arial, sans-serif';
        loadingContext.fillText(stageLabel.textContent, barX, 322);
        loadingContext.textAlign = 'right';
        loadingContext.fillText(elapsed.textContent, barX + barWidth, 322);
        loadingContext.textAlign = 'center';
        loadingContext.fillStyle = '#bcbcbc';
        loadingContext.font = '13px Arial, sans-serif';
        const lines = canvasLines(loadingDetail.textContent, 580, failed ? 5 : 3);
        lines.forEach((line, index) => {
          loadingContext.fillText(line, width / 2, 365 + index * 19);
        });
        if (failed) {
          loadingContext.fillStyle = '#8f8f8f';
          loadingContext.font = '12px Arial, sans-serif';
          loadingContext.fillText(
            'Use “Send diagnostic report” in the panel on the right.',
            width / 2, 485);
        }
      };
      const telemetrySession = Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 10);
      const telemetry = (event, details) => {
        const payload = {
          session: telemetrySession,
          event,
          elapsedMs: Math.round(performance.now() - startedAt),
          details: details || {}
        };
        fetch('/telemetry', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      };
      const originalConsoleLog = console.log.bind(console);
      console.log = (...values) => {
        originalConsoleLog(...values);
        const message = values.map(value => String(value)).join(' ');
        if (!message.startsWith('[AUDIO_TRACE] ')) return;
        const encoded = message.slice('[AUDIO_TRACE] '.length);
        try {
          telemetry('guest_audio_trace', JSON.parse(encoded));
        } catch (error) {
          telemetry('guest_audio_trace_error', {
            message: String(error && error.message || error),
            encoded: encoded.slice(0, 6000)
          });
        }
      };
      let guestOutputCursor = 0;
      let guestOutputRemainder = '';
      setInterval(() => {
        const output = document.getElementById('systemOutput');
        const text = output ? output.textContent || '' : '';
        if (text.length < guestOutputCursor) guestOutputCursor = 0;
        if (text.length === guestOutputCursor) return;
        guestOutputRemainder += text.slice(guestOutputCursor);
        guestOutputCursor = text.length;
        const lines = guestOutputRemainder.split('\\n');
        guestOutputRemainder = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('[AUDIO_TRACE] ')) continue;
          const encoded = line.slice('[AUDIO_TRACE] '.length);
          try {
            telemetry('guest_audio_trace', JSON.parse(encoded));
          } catch (error) {
            telemetry('guest_audio_trace_error', {
              message: String(error && error.message || error),
              encoded: encoded.slice(0, 6000)
            });
          }
        }
      }, 500);
      const reportedErrors = new Set();
      const recentErrors = [];
      const socketMetrics = new Map();
      const captureSocketMetrics = () => [...socketMetrics.values()].map(metric => ({
        id: metric.id,
        port: metric.port,
        state: metric.state,
        openedAfterMs: metric.openedAt === null
          ? null : Math.round(metric.openedAt - startedAt),
        closedAfterMs: metric.closedAt === null
          ? null : Math.round(metric.closedAt - startedAt),
        receivedBytes: metric.receivedBytes,
        sentBytes: metric.sentBytes,
        errorCount: metric.errorCount,
        closeCode: metric.closeCode,
        closeReason: metric.closeReason,
        wasClean: metric.wasClean
      }));
      let javascriptCalibration = null;
      const simpleThrownValue = value => {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value !== 'object') return String(value);
        if (Object.prototype.hasOwnProperty.call(value, 'value')) {
          return String(value.value);
        }
        if (typeof value.type === 'string') return value.type;
        if (value.message !== undefined && value.message !== value) {
          return simpleThrownValue(value.message);
        }
        return value.constructor && value.constructor.name
          ? value.constructor.name : String(value);
      };
      const describeThrownValue = error => {
        const type = error && typeof error.type === 'string' ? error.type :
          error && typeof error.jvmExceptionType === 'string'
            ? error.jvmExceptionType : null;
        const message = error && error.message !== undefined
          ? simpleThrownValue(error.message) : simpleThrownValue(error);
        const stack = error && typeof error.stack === 'string' ? error.stack : '';
        const cause = error && error.cause ? {
          type: typeof error.cause.type === 'string' ? error.cause.type : null,
          message: simpleThrownValue(
            error.cause.message !== undefined ? error.cause.message : error.cause)
        } : null;
        const headline = [type, message].filter(Boolean)
          .filter((value, index, values) => index === 0 || value !== values[0])
          .join(': ');
        return {
          type,
          message,
          stack,
          cause,
          text: headline + (stack ? '\\n' + stack : '')
        };
      };
      const browserState = () => ({
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        hasFocus: document.hasFocus(),
        hardwareConcurrency: Number(navigator.hardwareConcurrency || 0),
        deviceMemoryGiB: Number(navigator.deviceMemory || 0),
        crossOriginIsolated: Boolean(window.crossOriginIsolated)
      });
      const integerCalibrationKernel = (iterations, seed) => {
        let value = seed | 0;
        for (let index = 0; index < iterations; index += 1) {
          value = (Math.imul(value ^ index, 1664525) + 1013904223) | 0;
        }
        return value;
      };
      const calibrateJavascript = () => {
        integerCalibrationKernel(250000, 1);
        integerCalibrationKernel(250000, 2);
        const iterations = 5000000;
        const before = performance.now();
        const checksum = integerCalibrationKernel(iterations, 3);
        const elapsedMs = performance.now() - before;
        javascriptCalibration = {
          iterations,
          elapsedMs: Math.round(elapsedMs * 100) / 100,
          millionIterationsPerSecond:
            Math.round(iterations / Math.max(elapsedMs, 0.01) / 1000 * 100) / 100,
          checksum
        };
        telemetry('javascript_calibration', {
          ...javascriptCalibration,
          browser: browserState()
        });
      };
      const reportFailure = (kind, error) => {
        const diagnostic = describeThrownValue(error);
        const message = diagnostic.text;
        const key = kind + ':' + message;
        if (reportedErrors.has(key)) return;
        reportedErrors.add(key);
        recentErrors.push({kind, message: message.slice(0, 6000),
          elapsedMs: Math.round(performance.now() - startedAt)});
        if (recentErrors.length > 10) recentErrors.shift();
        telemetry(kind, {
          message: message.slice(0, 6000),
          error: diagnostic
        });
        loader.classList.remove('complete');
        loader.classList.add('error');
        status.textContent = 'Startup failed';
        loadingDetail.textContent = message;
        progressTrack.classList.remove('busy');
        renderLoadingCanvas();
      };
      const captureJvmStacks = () => {
        const jvm = window.jvmDebug && window.jvmDebug.debugController &&
          window.jvmDebug.debugController.jvm;
        if (!jvm) return {available: false, threads: []};
        return {
          available: true,
          currentThreadIndex: jvm.currentThreadIndex,
          threads: (jvm.threads || []).map(thread => ({
            id: thread.id,
            name: thread.name,
            status: thread.status,
            frames: (thread.callStack && thread.callStack.items || [])
              .slice(-40).reverse().map(frame => {
                const method = frame.method || {};
                const instruction = frame.instructions && frame.instructions[frame.pc];
                return {
                  className: frame.className || null,
                  method: method.name || null,
                  descriptor: method.descriptor || null,
                  instructionIndex: frame.pc,
                  bytecodeLabel: instruction && instruction.labelDef || null
                };
              })
          })),
          awtInputQueueDepth: Number(jvm._awtEventQueue &&
            jvm._awtEventQueue.length || 0),
          awtInputDispatches: Number(jvm._awtInputDispatchCount || 0),
          schedulerTimings: typeof jvm.getSchedulerTimingSnapshot === 'function'
            ? jvm.getSchedulerTimingSnapshot(20)
            : null,
          audio: typeof window.JVMDebug?.audioPlatform?.getWebAudioDiagnostics ===
            'function'
            ? window.JVMDebug.audioPlatform.getWebAudioDiagnostics()
            : {registered: false},
          sockets: captureSocketMetrics(),
          jit: jvm.jit ? {
            enabled: Boolean(jvm.jit.enabled),
            codegenEnabled: Boolean(jvm.jit.codegenEnabled),
            preferWholeMethodJs: Boolean(jvm.jit.preferWholeMethodJs),
            adaptiveConstructorCallers: Boolean(
              jvm.jit.adaptiveConstructorCallersEnabled),
            adaptiveEntryPromotions: Number(
              jvm.jit.adaptiveEntryPromotionCount || 0),
            adaptiveTimePromotions: Number(
              jvm.jit.adaptiveTimePromotionCount || 0),
            adaptiveWholeMethodPromotions: Number(
              jvm.jit.adaptiveWholeMethodPromotionCount || 0),
            adaptiveWholeMethodEscalations: Number(
              jvm.jit.adaptiveWholeMethodEscalationCount || 0),
            generatedRuns: Number(jvm.jit.generatedRunCount || 0),
            wasmRuns: Number(jvm.jit.wasmJit && jvm.jit.wasmJit.runCount || 0),
            affineSpriteRasterRuns: Number(
              jvm.jit.affineSpriteRasterRunCount || 0),
            affineSpriteRasterGuardedFallbacks: Number(
              jvm.jit.affineSpriteRasterGuardedFallbackCount || 0),
            structuredSsaRuns: Number(
              jvm.jit.structuredSsa && jvm.jit.structuredSsa.runCount || 0),
            structuredSsaLazyStaticLinks: Number(
              jvm.jit.structuredSsa &&
              jvm.jit.structuredSsa.lazyStaticTargetLinkCount || 0),
            structuredSsaRestoringDirectRuns: Number(
              jvm.jit.structuredSsa &&
              jvm.jit.structuredSsa.restoringDirectRunCount || 0),
            ordinaryAdaptiveFramelessRuns: Number(
              jvm.jit.ordinaryAdaptiveFramelessRunCount || 0),
            affineSpriteRasterRuns: Number(
              jvm.jit.affineSpriteRasterRunCount || 0),
            affineSpriteRasterGuardedFallbacks: Number(
              jvm.jit.affineSpriteRasterGuardedFallbackCount || 0),
            alphaMaskedColorBlitRuns: Number(
              jvm.jit.alphaMaskedColorBlitRunCount || 0),
            alphaMaskedColorBlitSlowPaths: Number(
              jvm.jit.alphaMaskedColorBlitSlowPathCount || 0),
            transparentIntBlitRuns: Number(
              jvm.jit.transparentIntBlitRunCount || 0),
            transparentIntBlitSlowPaths: Number(
              jvm.jit.transparentIntBlitSlowPathCount || 0),
            clippedGradientRuns: Number(
              jvm.jit.clippedGradientRunCount || 0),
            clippedGradientSlowPaths: Number(
              jvm.jit.clippedGradientSlowPathCount || 0),
            oversizedWasmFirstMethods: Number(
              jvm.jit.oversizedWasmFirstMethodCount || 0),
            longArithmeticWasmFirstMethods: Number(
              jvm.jit.longArithmeticWasmFirstMethodCount || 0),
            referenceFramelessPositionalRuns: Number(
              jvm.jit.referenceFramelessPositionalRunCount || 0),
            fusedRuns: Number(jvm.jit.fusedRunCount || 0),
            fusedDirectRuns: Number(jvm.jit.fusedDirectRunCount || 0),
            guardedFallbacks: Number(jvm.jit.fusedGuardedFallbackCount || 0)
          } : null
        };
      };
      const captureJitMethodTimings = jvm => {
        const jit = jvm && jvm.jit;
        if (!jit || !(jit.methodTimingSamples instanceof Map)) return [];
        return [...jit.methodTimingSamples.entries()]
          .sort((left, right) => right[1].totalMs - left[1].totalMs)
          .slice(0, 16)
          .map(([method, value]) => ({
            method,
            tier: value.tier,
            samples: value.samples,
            totalMs: Math.round(value.totalMs * 100) / 100,
            maxMs: Math.round(value.maxMs * 100) / 100,
            averageMs: Math.round(value.totalMs /
              Math.max(value.samples, 1) * 100) / 100
          }));
      };
      const sendDiagnosticReport = () => {
        telemetry('manual_diagnostic_report', {
          loader: {
            status: status.textContent,
            detail: loadingDetail.textContent,
            classes: [...loader.classList]
          },
          performance: {
            fps: fpsValue.textContent,
            frameGap: frameGap.textContent,
            worstGap: worstGap.textContent,
            browser: browserState(),
            javascriptCalibration
          },
          startupWork: {...startupWork},
          recentErrors: recentErrors.slice(),
          jvm: captureJvmStacks()
        });
        for (const button of [crashReportButton, loaderCrashReportButton]) {
          button.textContent = 'Diagnostic report sent';
          button.disabled = true;
        }
        setTimeout(() => {
          for (const button of [crashReportButton, loaderCrashReportButton]) {
            button.textContent = 'Send diagnostic report';
            button.disabled = false;
          }
        }, 2500);
      };
      crashReportButton.addEventListener('click', sendDiagnosticReport);
      loaderCrashReportButton.addEventListener('click', sendDiagnosticReport);
      window.addEventListener('error', event =>
        reportFailure('runtime_error', event.error || event.message));
      window.addEventListener('unhandledrejection', event =>
        reportFailure('unhandled_rejection', event.reason));
      telemetry('session_start', {
        game: game.id,
        gameName: game.name,
        mainClass: game.mainClass,
        userAgent: navigator.userAgent,
        viewport: {width: innerWidth, height: innerHeight},
        runtime: {
          version: assetManifest.runtime.version,
          bytes: assetManifest.runtime.size
        },
        browser: browserState()
      });
      for (const eventName of ['visibilitychange', 'focus', 'blur']) {
        window.addEventListener(eventName, () =>
          telemetry('browser_state', {reason: eventName, ...browserState()}));
      }
      setTimeout(calibrateJavascript, 0);
      let readyWatch = null;
      let canvasReported = false;
      let firstFrameReported = false;
      let startupWork = {crcCalls: 0, crcBytes: 0, inflateCalls: 0,
        inflateInputBytes: 0, inflateOutputBytes: 0};
      const expectedStartupInflateBlocks =
        Number.isFinite(game.expectedStartupInflateBlocks)
          ? game.expectedStartupInflateBlocks : null;
      let appletStartedAt = null;
      let lastInflateMilestoneCount = 0;
      let lastInflateMilestoneAt = null;
      let estimatedInflateBlockMs = 10000;
      let estimatedStartupReadyAt = null;
      const presentationSamples = [];
      const presentationGaps = [];
      let lastPresented = null;
      let lastPresentationAt = null;
      let animationCallbacks = 0;
      let lastPerformanceAt = performance.now();
      let lastPerformanceAnimationCallbacks = 0;
      const updateFps = now => {
        animationCallbacks += 1;
        const jvm = window.jvmDebug && window.jvmDebug.debugController &&
          window.jvmDebug.debugController.jvm;
        const stats = jvm && jvm._awtPresentationStats;
        const presented = Number(stats && stats.presented || 0);
        presentationSamples.push({time: now, presented});
        while (presentationSamples.length > 1 &&
            presentationSamples[1].time < now - 1000) {
          presentationSamples.shift();
        }
        if (lastPresented !== null && presented > lastPresented) {
          if (lastPresentationAt !== null) {
            presentationGaps.push({time: now, gap: now - lastPresentationAt});
          }
          lastPresentationAt = now;
        }
        lastPresented = presented;
        while (presentationGaps.length && presentationGaps[0].time < now - 2000) {
          presentationGaps.shift();
        }
        const oldest = presentationSamples[0];
        const duration = now - oldest.time;
        if (duration >= 500 && stats) {
          const fps = (presented - oldest.presented) * 1000 / duration;
          fpsValue.textContent = fps.toFixed(1);
        } else {
          fpsValue.textContent = '--';
        }
        if (presentationGaps.length) {
          const latest = presentationGaps[presentationGaps.length - 1].gap;
          const worst = presentationGaps.reduce((value, sample) =>
            Math.max(value, sample.gap), 0);
          frameGap.textContent = Math.round(latest) + ' ms';
          worstGap.textContent = Math.round(worst) + ' ms';
        } else {
          frameGap.textContent = '-- ms';
          worstGap.textContent = '-- ms';
        }
        requestAnimationFrame(updateFps);
      };
      requestAnimationFrame(updateFps);
      const performanceTimer = setInterval(() => {
        const jvm = window.jvmDebug && window.jvmDebug.debugController &&
          window.jvmDebug.debugController.jvm;
        if (!jvm) return;
        const now = performance.now();
        const intervalMs = now - lastPerformanceAt;
        const intervalAnimationCallbacks =
          animationCallbacks - lastPerformanceAnimationCallbacks;
        lastPerformanceAt = now;
        lastPerformanceAnimationCallbacks = animationCallbacks;
        telemetry('performance', {
          fps: Number(fpsValue.textContent) || 0,
          frameGapMs: Number.parseInt(frameGap.textContent, 10) || 0,
          worstGapMs: Number.parseInt(worstGap.textContent, 10) || 0,
          presented: Number(jvm._awtPresentationStats &&
            jvm._awtPresentationStats.presented || 0),
          inputDispatches: Number(jvm._awtInputDispatchCount || 0),
          inputQueueDepth: Number(jvm._awtEventQueue &&
            jvm._awtEventQueue.length || 0),
          animationCallbacksPerSecond:
            Math.round(intervalAnimationCallbacks * 100000 /
              Math.max(intervalMs, 1)) / 100,
          telemetryIntervalMs: Math.round(intervalMs),
          schedulerTimings:
            typeof jvm.getSchedulerTimingSnapshot === 'function'
              ? jvm.getSchedulerTimingSnapshot(8)
              : null,
          jitMethodTimings: captureJitMethodTimings(jvm),
          jit: jvm.jit ? {
            ordinaryAdaptiveFramelessRuns: Number(
              jvm.jit.ordinaryAdaptiveFramelessRunCount || 0),
            alphaMaskedColorBlitRuns: Number(
              jvm.jit.alphaMaskedColorBlitRunCount || 0),
            alphaMaskedColorBlitSlowPaths: Number(
              jvm.jit.alphaMaskedColorBlitSlowPathCount || 0),
            transparentIntBlitRuns: Number(
              jvm.jit.transparentIntBlitRunCount || 0),
            transparentIntBlitSlowPaths: Number(
              jvm.jit.transparentIntBlitSlowPathCount || 0),
            clippedGradientRuns: Number(
              jvm.jit.clippedGradientRunCount || 0),
            clippedGradientSlowPaths: Number(
              jvm.jit.clippedGradientSlowPathCount || 0),
            oversizedWasmFirstMethods: Number(
              jvm.jit.oversizedWasmFirstMethodCount || 0),
            longArithmeticWasmFirstMethods: Number(
              jvm.jit.longArithmeticWasmFirstMethodCount || 0),
            referenceFramelessPositionalRuns: Number(
              jvm.jit.referenceFramelessPositionalRunCount || 0),
            structuredSsaRuns: Number(
              jvm.jit.structuredSsa && jvm.jit.structuredSsa.runCount || 0),
            structuredSsaSafePoints: Number(
              jvm.jit.structuredSsa && jvm.jit.structuredSsa.safePointCount || 0),
            structuredSsaLazyStaticLinks: Number(
              jvm.jit.structuredSsa &&
              jvm.jit.structuredSsa.lazyStaticTargetLinkCount || 0),
            structuredSsaRestoringDirectRuns: Number(
              jvm.jit.structuredSsa &&
              jvm.jit.structuredSsa.restoringDirectRunCount || 0),
            generatedRuns: Number(jvm.jit.generatedRunCount || 0),
            runnerRuns: Number(jvm.jit.runnerRunCount || 0),
            fusedRuns: Number(jvm.jit.fusedRunCount || 0),
            fusedFallbacks: Number(
              jvm.jit.fusedGuardedFallbackCount || 0)
          } : null,
          audio: typeof window.JVMDebug?.audioPlatform?.getWebAudioDiagnostics ===
            'function'
            ? window.JVMDebug.audioPlatform.getWebAudioDiagnostics()
            : {registered: false},
          presentation: jvm._awtPresentationStats
            ? {
                dirtyMarks: Number(jvm._awtPresentationStats.dirtyMarks || 0),
                scheduled: Number(jvm._awtPresentationStats.scheduled || 0),
                coalesced: Number(jvm._awtPresentationStats.coalesced || 0),
                presented: Number(jvm._awtPresentationStats.presented || 0),
                uploadMs: Number(jvm._awtPresentationStats.uploadMs || 0),
                drawImageCalls: Number(
                  jvm._awtPresentationStats.drawImageCalls || 0),
                softwareBlits: Number(
                  jvm._awtPresentationStats.softwareBlits || 0),
                blitCopyMs: Number(jvm._awtPresentationStats.blitCopyMs || 0),
                wasmSwizzles: Number(
                  jvm._awtPresentationStats.wasmSwizzles || 0),
                jsSwizzles: Number(jvm._awtPresentationStats.jsSwizzles || 0),
                presentationFallbacks: Number(
                  jvm._awtPresentationStats.presentationFallbacks || 0)
              }
            : null,
          browser: browserState()
        });
      }, 10000);
      const elapsedTimer = setInterval(() => {
        elapsed.textContent = 'Elapsed ' + Math.floor((performance.now() - startedAt) / 1000) + 's';
        if (!loader.classList.contains('complete')) renderLoadingCanvas();
      }, 250);
      let lastProgressTelemetry = '';
      const setProgress = (percent, label, detail, stage, busy) => {
        const value = Math.max(0, Math.min(100, Math.round(percent)));
        status.textContent = label;
        loadingDetail.textContent = detail;
        stageLabel.textContent = 'Stage ' + stage + ' of 16 · ' + value + '%';
        progressFill.style.width = value + '%';
        progressTrack.setAttribute('aria-valuenow', String(value));
        progressTrack.classList.toggle('busy', Boolean(busy));
        renderLoadingCanvas();
        const telemetryKey = stage + ':' + label;
        if (telemetryKey !== lastProgressTelemetry) {
          lastProgressTelemetry = telemetryKey;
          telemetry('startup_stage', {stage, percent: value, label});
        }
      };
      renderLoadingCanvas();
      const formatStartupEta = milliseconds => {
        if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '';
        const seconds = Math.max(1, Math.round(milliseconds / 1000));
        if (seconds < 90) return 'about ' + seconds + 's';
        return 'about ' + Math.round(seconds / 60) + ' min';
      };
      const startupAssetState = waitingForFrame => {
        const hasExpectedBlockCount =
          Number.isFinite(expectedStartupInflateBlocks) &&
          expectedStartupInflateBlocks > 0;
        const blocks = hasExpectedBlockCount
          ? Math.min(expectedStartupInflateBlocks, startupWork.inflateCalls)
          : startupWork.inflateCalls;
        const now = performance.now();
        const interpolationStartedAt = lastInflateMilestoneAt === null
          ? appletStartedAt : lastInflateMilestoneAt;
        const sinceMilestone = interpolationStartedAt === null
          ? 0 : now - interpolationStartedAt;
        // Move toward the next real block while it is running, but reserve the
        // final 15% of each interval until that block is actually observed.
        const partialBlock = !hasExpectedBlockCount ||
            blocks < expectedStartupInflateBlocks
          ? Math.min(0.85, sinceMilestone / Math.max(estimatedInflateBlockMs, 1))
          : 0;
        const progressBlocks = blocks + partialBlock;
        const percent = hasExpectedBlockCount
          ? 10 + progressBlocks * 85 / expectedStartupInflateBlocks
          : 10 + 84 * (1 - Math.exp(-progressBlocks / 8));
        const estimatedRemainingMs = estimatedStartupReadyAt === null
          ? null : Math.max(1000, estimatedStartupReadyAt - now);
        let label;
        let stage;
        if (waitingForFrame &&
            (!hasExpectedBlockCount || blocks >= expectedStartupInflateBlocks)) {
          label = 'Painting the first game frame…';
          stage = 16;
        } else if (blocks > 0) {
          label = hasExpectedBlockCount
            ? 'Preparing game assets · block ' + blocks + ' of ' +
              expectedStartupInflateBlocks + '…'
            : 'Preparing game assets · ' + blocks +
              ' compressed blocks processed…';
          stage = hasExpectedBlockCount
            ? Math.min(15, 6 + blocks)
            : Math.min(15, 6 + Math.floor(percent / 10));
        } else {
          label = 'Starting ' + game.name + '…';
          stage = 6;
        }
        return {blocks, percent, stage, label, estimatedRemainingMs};
      };
      let lastStartupWorkTelemetryAt = 0;
      const showStartupWork = () => {
        // Compression continues lazily after the first playable frame. Those
        // later blocks are useful telemetry, but they must not move a
        // completed loader back from 100% to the asset-preparation label.
        if (firstFrameReported) return;
        const now = performance.now();
        if (startupWork.inflateCalls > lastInflateMilestoneCount) {
          const milestoneStart = lastInflateMilestoneAt === null
            ? appletStartedAt : lastInflateMilestoneAt;
          if (milestoneStart !== null) {
            const observedBlockMs = Math.max(1, now - milestoneStart);
            estimatedInflateBlockMs = lastInflateMilestoneCount === 0
              ? observedBlockMs
              : estimatedInflateBlockMs * 0.65 + observedBlockMs * 0.35;
          }
          lastInflateMilestoneCount = startupWork.inflateCalls;
          lastInflateMilestoneAt = now;
          if (Number.isFinite(expectedStartupInflateBlocks)) {
            const remainingUnits = expectedStartupInflateBlocks + 1 -
              Math.min(expectedStartupInflateBlocks, startupWork.inflateCalls);
            estimatedStartupReadyAt = now +
              estimatedInflateBlockMs * remainingUnits;
          }
        }
        const progress = startupAssetState(false);
        let detail = startupWork.crcCalls + ' CRC checks (' +
          startupWork.crcBytes.toLocaleString() + ' bytes), ' +
          startupWork.inflateCalls + ' compressed blocks (' +
          startupWork.inflateInputBytes.toLocaleString() + ' → ' +
          startupWork.inflateOutputBytes.toLocaleString() + ' bytes).';
        if (progress.estimatedRemainingMs !== null) {
          detail += ' Estimated time remaining: ' +
            formatStartupEta(progress.estimatedRemainingMs) + '.';
        } else {
          detail += ' The ETA will appear after the first compressed block.';
        }
        setProgress(progress.percent, progress.label, detail,
          progress.stage, true);
        if (now - lastStartupWorkTelemetryAt >= 2000) {
          lastStartupWorkTelemetryAt = now;
          telemetry('startup_work', {
            ...startupWork,
            progressPercent: Math.round(progress.percent),
            estimatedRemainingMs: progress.estimatedRemainingMs === null
              ? null : Math.round(progress.estimatedRemainingMs)
          });
        }
      };
      const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const loadScript = source => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = source;
        script.onload = resolve;
        script.onerror = () => reject(new Error('JVM runtime request failed'));
        document.head.appendChild(script);
      });
      const fetchBlobWithProgress = async (source, onProgress) => {
        const response = await fetch(source);
        if (!response.ok) throw new Error('JAR request failed: ' + response.status);
        const total = Number(response.headers.get('content-length')) || 0;
        if (!response.body || !total) return response.blob();
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          chunks.push(result.value);
          loaded += result.value.byteLength;
          onProgress(loaded / total, loaded, total);
        }
        return new Blob(chunks, {type: response.headers.get('content-type') || 'application/java-archive'});
      };
      const openAssetDatabase = () => new Promise((resolve, reject) => {
        const request = indexedDB.open('alterorb-assets-' + game.id, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('files')) {
            request.result.createObjectStore('files', {keyPath: 'name'});
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const databaseRequest = request => new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const readCachedFile = (database, name) => databaseRequest(
        database.transaction('files', 'readonly').objectStore('files').get(name));
      const readAllCachedFiles = database => databaseRequest(
        database.transaction('files', 'readonly').objectStore('files').getAll());
      const writeCachedFile = (database, record) => databaseRequest(
        database.transaction('files', 'readwrite').objectStore('files').put(record));
      const deleteCachedFile = (database, name) => databaseRequest(
        database.transaction('files', 'readwrite').objectStore('files').delete(name));
      const resourceCacheHit = source => {
        const absolute = new URL(source, location.href).href;
        const entries = performance.getEntriesByName(absolute);
        const entry = entries[entries.length - 1];
        return Boolean(entry && entry.transferSize === 0 && entry.decodedBodySize > 0);
      };
      try {
        await nextPaint();
        setProgress(1, 'Downloading the JVM runtime…', 'Loading the Java bytecode engine and browser services.', 1, true);
        await loadScript(assetManifest.runtime.url);
        telemetry('asset_loaded', {
          name: assetManifest.runtime.name,
          bytes: assetManifest.runtime.size,
          browserCacheHit: resourceCacheHit(assetManifest.runtime.url)
        });
        setProgress(2, 'Downloading ' + game.name + '…',
          'Reading ' + assetManifest.jar.name + '.', 2, true);
        const jarBlob = await fetchBlobWithProgress(assetManifest.jar.url, (fraction, loaded, total) => {
          const mib = 1024 * 1024;
          setProgress(2 + fraction * 2, 'Downloading ' + game.name + '…',
            (loaded / mib).toFixed(1) + ' of ' + (total / mib).toFixed(1) + ' MiB received.', 2, true);
        });
        telemetry('asset_loaded', {
          name: assetManifest.jar.name,
          bytes: assetManifest.jar.size,
          browserCacheHit: resourceCacheHit(assetManifest.jar.url)
        });
        const file = new File([jarBlob], assetManifest.jar.name,
          {type: 'application/java-archive'});
        setProgress(5, 'Creating the browser JVM…', 'Configuring the generated-code optimizer and runtime.', 3, true);
        const debug = new JVMDebug.BrowserJVMDebug();
        window.jvmDebug = debug;
        const query = new URLSearchParams(location.search);
        const optimizerMode = query.get('mode') || 'structured';
        const structuredSsa = optimizerMode !== 'baseline';
        const wasmFirst = optimizerMode === 'wasm';
        // Production uses the bytecode-structural compiler. Handwritten guest
        // translations remain an explicit differential oracle only, never an
        // optimizer dependency.
        const guestKernelOracles = query.get('oracles') === '1';
        // Lightweight generated-body timing is enabled unless explicitly
        // disabled. The JIT chooses a sample before formatting method identity,
        // so ordinary entries pay only one deterministic PRNG update.
        const timingProfile = query.get('timings') === '1';
        const timingRateParameter = query.get('timingRate');
        const requestedMethodTimingRate = Number(timingRateParameter);
        const methodTimingSampleRate = timingRateParameter !== null
          && Number.isFinite(requestedMethodTimingRate)
          ? Math.max(1, Math.min(4096, Math.round(requestedMethodTimingRate)))
          : 128;
        const schedulerRateParameter = query.get('schedulerRate');
        const requestedSchedulerTimingRate = Number(schedulerRateParameter);
        const schedulerTimingRate = schedulerRateParameter !== null
          && Number.isFinite(requestedSchedulerTimingRate)
          ? Math.max(1, Math.min(4096, Math.round(requestedSchedulerTimingRate)))
          : 256;
        const yieldStrategy = query.get('yield') === 'message-channel'
          ? 'message-channel' : 'timer';
        // BrowserJVMDebug.run() resets the DebugController before it starts the
        // applet. Store the optimizer policy in the controller's constructor
        // options so the replacement JVM receives it too.
        debug.debugController.options.jit = {
          ...(debug.debugController.options.jit || {}),
          codegen: optimizerMode !== 'interpreter' &&
            optimizerMode !== 'no-codegen',
          rendererPipeline: true,
          scalarLoops: true,
          scalarGuestBodies: true,
          scalarSsaOptimizations: false,
          guestKernelOracles,
          fusedRegions: true,
          structuredSsa,
          structuredDeferredCallMaterialization: structuredSsa,
          ordinaryAdaptiveFramelessPositional: structuredSsa,
          adaptiveFramelessBudgetMultiplier: 100,
          affineSpriteRaster: query.get('affine') !== '0',
          preferWholeMethodJs: !wasmFirst,
          profileTimings: timingProfile,
          methodTimingSampleRate,
          adaptiveWholeMethodEscalationThreshold: wasmFirst ? 0 : 16
        };
        // Keep the default browser page equivalent to the headless
        // --until-main-menu performance run. Add ?full=1 to exercise normal
        // login/audio startup instead.
        const simpleMode = query.get('full') !== '1';
        debug.debugController.options.appletParameters = {
          overxgames: '45',
          overxachievements: '1000',
          member: 'no',
          gameport1: '43594',
          gameport2: '43594',
          servernum: '8003',
          simplemode: simpleMode ? 'true' : 'false',
          instanceid: String(Date.now()),
          gamecrc: String(game.gamecrc)
        };
        debug.debugController.options.appletCodeBase = game.server;
        debug.debugController.options.eventLoopYieldStrategy = yieldStrategy;
        // Sample one scheduler entry in 256. This records elapsed time, not
        // invocation counts, and is cheap enough to leave enabled while
        // locating browser-only stalls.
        debug.debugController.options.schedulerTimingRate = schedulerTimingRate;
        telemetry('applet_configuration', {
          game: game.id,
          mainClass: game.mainClass,
          simplemode: simpleMode,
          fullMode: !simpleMode,
          optimizerMode,
          structuredSsa,
          guestKernelOracles,
          wasmFirst,
          timingProfile,
          methodTimingSampleRate,
          schedulerTimingRate,
          yieldStrategy
        });
        const jit = debug.debugController.jvm.jit;
        jit.rendererPipelineEnabled = true;
        jit.scalarLoopsEnabled = true;
        jit.scalarGuestBodiesEnabled = true;
        jit.fusedRegions.enabled = true;
        jit.structuredSsa.enabled = structuredSsa;
        setProgress(6, 'Initializing Java…', 'Preparing classes, memory, and the applet environment.', 3, true);
        await debug.initialize();
        setProgress(7, 'Indexing game classes…',
          'Reading ' + assetManifest.jar.name +
          ' and resolving its startup classes.', 4, true);
        await debug.loadFile(file);
        setProgress(8, 'Installing browser services…', 'Connecting graphics, files, compression, and networking.', 5, true);
        const virtualFiles = new Map();
        const virtualDirectories = new Set();
        setProgress(9, 'Restoring cached game assets…',
          'Loading the Java cache files from persistent browser storage.', 5, true);
        let assetDatabase = null;
        try {
          assetDatabase = await openAssetDatabase();
        } catch (error) {
          telemetry('asset_cache_database_error', {message: String(error)});
        }
        const cacheVersions = new Map(
          assetManifest.gameCache.map(asset => [asset.virtualPath, asset.version]));
        let persistentHits = 0;
        let httpLoads = 0;
        let restoredBytes = 0;
        await Promise.all(assetManifest.gameCache.map(async asset => {
          let bytes = null;
          if (assetDatabase) {
            const cached = await readCachedFile(assetDatabase, asset.virtualPath);
            if (cached && cached.sourceVersion === asset.version && cached.bytes) {
              bytes = Uint8Array.from(cached.bytes);
              persistentHits += 1;
            }
          }
          if (!bytes) {
            const response = await fetch(asset.url);
            if (!response.ok) throw new Error('Game cache request failed: ' + asset.name);
            bytes = new Uint8Array(await response.arrayBuffer());
            httpLoads += 1;
            if (assetDatabase) {
              await writeCachedFile(assetDatabase, {
                name: asset.virtualPath,
                sourceVersion: asset.version,
                bytes,
                updatedAt: Date.now()
              });
            }
          }
          virtualFiles.set(asset.virtualPath, bytes);
          restoredBytes += bytes.length;
        }));
        if (assetDatabase) {
          for (const cached of await readAllCachedFiles(assetDatabase)) {
            if (!virtualFiles.has(cached.name) && cached.bytes) {
              virtualFiles.set(cached.name, Uint8Array.from(cached.bytes));
              restoredBytes += cached.bytes.length;
            }
          }
        }
        telemetry('asset_cache_restored', {
          persistentHits,
          httpLoads,
          files: virtualFiles.size,
          bytes: restoredBytes
        });
        setProgress(9, 'Game assets ready',
          virtualFiles.size + ' cache files restored (' +
          (restoredBytes / 1048576).toFixed(1) + ' MiB).', 5, true);
        const persistTimers = new Map();
        const persistVirtualFile = name => {
          if (!assetDatabase) return;
          const pending = persistTimers.get(name);
          if (pending) clearTimeout(pending);
          persistTimers.set(name, setTimeout(() => {
            persistTimers.delete(name);
            const bytes = virtualFiles.get(name);
            if (!bytes) return;
            writeCachedFile(assetDatabase, {
              name,
              sourceVersion: cacheVersions.get(name) || 'runtime',
              bytes: Uint8Array.from(bytes),
              updatedAt: Date.now()
            }).catch(error => telemetry('asset_cache_write_error', {
              name, message: String(error)
            }));
          }, 250));
        };
        const filePath = file => file && file.path ? file.path : '';
        const ensureFile = path => {
          if (!virtualFiles.has(path)) virtualFiles.set(path, new Uint8Array(0));
          return virtualFiles.get(path);
        };
        const browserSockets = new Map();
        let nextSocketId = 1;
        const wakeSocket = state => state.waiters.splice(0).forEach(resolve => resolve());
        const openSocket = port => {
          const id = nextSocketId++;
          const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(protocol + '//' + location.host + '/tcp?port=' + port);
          ws.binaryType = 'arraybuffer';
          const metric = {
            id,
            port,
            state: 'connecting',
            openedAt: null,
            closedAt: null,
            receivedBytes: 0,
            sentBytes: 0,
            errorCount: 0,
            closeCode: null,
            closeReason: '',
            wasClean: null
          };
          socketMetrics.set(id, metric);
          telemetry('socket_opening', {id, port});
          const state = {
            ws,
            metric,
            chunks: [],
            size: 0,
            closed: false,
            waiters: [],
            pending: []
          };
          browserSockets.set(id, state);
          ws.onopen = () => {
            metric.state = 'open';
            metric.openedAt = performance.now();
            telemetry('socket_open', {
              id,
              port,
              queuedWrites: state.pending.length
            });
            state.pending.splice(0).forEach(bytes => ws.send(bytes));
          };
          ws.onmessage = event => {
            const bytes = new Uint8Array(event.data);
            metric.receivedBytes += bytes.length;
            state.chunks.push(bytes);
            state.size += bytes.length;
            wakeSocket(state);
          };
          ws.onerror = () => {
            metric.errorCount += 1;
            telemetry('socket_error', {
              id,
              port,
              state: metric.state,
              receivedBytes: metric.receivedBytes,
              sentBytes: metric.sentBytes
            });
            state.closed = true;
            wakeSocket(state);
          };
          ws.onclose = event => {
            metric.state = 'closed';
            metric.closedAt = performance.now();
            metric.closeCode = event.code;
            metric.closeReason = event.reason || '';
            metric.wasClean = event.wasClean;
            telemetry('socket_close', {
              id,
              port,
              elapsedOpenMs: metric.openedAt === null
                ? null : Math.round(metric.closedAt - metric.openedAt),
              receivedBytes: metric.receivedBytes,
              sentBytes: metric.sentBytes,
              code: event.code,
              reason: event.reason || '',
              wasClean: event.wasClean
            });
            state.closed = true;
            wakeSocket(state);
          };
          return id;
        };
        const waitForSocket = state => state.size || state.closed
          ? Promise.resolve()
          : new Promise(resolve => state.waiters.push(resolve));
        const readSocket = (state, target, offset, length) => {
          if (!state || state.size === 0) return state && state.closed ? -1 : 0;
          let copied = 0;
          while (copied < length && state.size > 0) {
            const chunk = state.chunks[0];
            const count = Math.min(chunk.length, length - copied);
            for (let i = 0; i < count; i++) target[offset + copied + i] = (chunk[i] << 24) >> 24;
            if (count === chunk.length) state.chunks.shift();
            else state.chunks[0] = chunk.slice(count);
            state.size -= count;
            copied += count;
          }
          return copied;
        };
        const sendSocket = (state, bytes) => {
          const payload = Uint8Array.from(bytes, value => value & 255);
          state.metric.sentBytes += payload.length;
          if (state.ws.readyState === WebSocket.OPEN) state.ws.send(payload);
          else state.pending.push(payload);
        };
        const crcTable = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let crc = i;
          for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
          crcTable[i] = crc >>> 0;
        }
        debug.debugController.options.jreOverrides = {
          'net/alterorb/launcher/Hook': {
            methods: {
              'cacheRedirect(Ljava/lang/String;Ljava/lang/String;)Ljava/io/File;': (jvm, _, args) => {
                const value = item => item && item.value !== undefined ? String(item.value) : String(item || '');
                const subDirectory = value(args[0]);
                const fileName = value(args[1]);
                const pieces = ['.alterorb', 'caches'];
                if (subDirectory && subDirectory !== 'null') pieces.push(subDirectory);
                pieces.push(fileName);
                return { type: 'java/io/File', _className: 'java/io/File', path: pieces.join('/') };
              }
            }
          },
          'java/io/File': {
            methods: {
              'exists()Z': (jvm, file) => {
                const target = filePath(file);
                if (virtualFiles.has(target) || virtualDirectories.has(target)) return 1;
                const prefix = (target.endsWith('/') ? target.slice(0, -1) : target) + '/';
                return [...virtualFiles.keys()].some(key => key.startsWith(prefix)) ? 1 : 0;
              },
              'length()J': (jvm, file) => BigInt((virtualFiles.get(filePath(file)) || []).length),
              'delete()Z': (jvm, file) => {
                const target = filePath(file);
                const deleted = virtualFiles.delete(target);
                if (deleted && assetDatabase) {
                  deleteCachedFile(assetDatabase, target).catch(error =>
                    telemetry('asset_cache_write_error', {
                      name: target, message: String(error)
                    }));
                }
                return deleted ? 1 : 0;
              },
              'mkdir()Z': (jvm, file) => {
                virtualDirectories.add(filePath(file));
                return 1;
              },
              'mkdirs()Z': (jvm, file) => {
                virtualDirectories.add(filePath(file));
                return 1;
              }
            }
          },
          'java/io/RandomAccessFile': {
            methods: {
              '<init>(Ljava/io/File;Ljava/lang/String;)V': (jvm, raf, args) => {
                raf.path = filePath(args[0]);
                raf.mode = String(args[1] || 'r');
                raf.position = 0;
                if (raf.mode.includes('w')) ensureFile(raf.path);
                else if (!virtualFiles.has(raf.path)) jvm.throwException('java/io/IOException', 'Cannot open file: ' + raf.path);
              },
              'read()I': (jvm, raf) => {
                const bytes = ensureFile(raf.path);
                if (raf.position >= bytes.length) return -1;
                return bytes[raf.position++] & 255;
              },
              'read([BII)I': (jvm, raf, args) => {
                const target = args[0], offset = args[1] | 0, length = args[2] | 0;
                const bytes = ensureFile(raf.path);
                const count = Math.min(length, Math.max(0, bytes.length - raf.position));
                if (count === 0) return -1;
                for (let i = 0; i < count; i++) target[offset + i] = (bytes[raf.position + i] << 24) >> 24;
                raf.position += count;
                return count;
              },
              'write(I)V': (jvm, raf, args) => {
                const old = ensureFile(raf.path);
                const size = Math.max(old.length, raf.position + 1);
                const next = new Uint8Array(size);
                next.set(old);
                next[raf.position++] = args[0] & 255;
                virtualFiles.set(raf.path, next);
                persistVirtualFile(raf.path);
              },
              'write([B)V': (jvm, raf, args) => {
                const source = args[0] || [];
                return debug.debugController.jvm._jreFindMethod('java/io/RandomAccessFile', 'write', '([BII)V')(jvm, raf, [source, 0, source.length]);
              },
              'write([BII)V': (jvm, raf, args) => {
                const source = args[0] || [], offset = args[1] | 0, length = args[2] | 0;
                const old = ensureFile(raf.path);
                const size = Math.max(old.length, raf.position + length);
                const next = new Uint8Array(size);
                next.set(old);
                for (let i = 0; i < length; i++) next[raf.position + i] = source[offset + i] & 255;
                raf.position += length;
                virtualFiles.set(raf.path, next);
                persistVirtualFile(raf.path);
              },
              'seek(J)V': (jvm, raf, args) => { raf.position = Number(args[0]); },
              'length()J': (jvm, raf) => BigInt(ensureFile(raf.path).length),
              'close()V': () => {}
            }
          },
          'java/util/zip/CRC32': {
            methods: {
              '<init>()V': (jvm, crc) => { crc.value = 0; },
              'reset()V': (jvm, crc) => { crc.value = 0; },
              'update([BII)V': (jvm, crc, args) => {
                const source = args[0] && args[0].array ? args[0].array : args[0];
                const offset = args[1] | 0;
                const length = args[2] | 0;
                let value = (crc.value || 0) ^ 0xffffffff;
                for (let i = 0; i < length; i++) value = crcTable[(value ^ source[offset + i]) & 255] ^ value >>> 8;
                crc.value = (value ^ 0xffffffff) >>> 0;
                console.log('JVM CRC32 len=' + length + ' value=0x' + crc.value.toString(16).padStart(8, '0'));
                startupWork.crcCalls += 1;
                startupWork.crcBytes += length;
                showStartupWork();
              },
              'getValue()J': (jvm, crc) => BigInt((crc.value || 0) >>> 0)
            }
          },
          'java/util/zip/Inflater': {
            methods: {
              '<init>()V': (jvm, inflater) => { inflater.nowrap = false; inflater.input = null; },
              '<init>(Z)V': (jvm, inflater, args) => { inflater.nowrap = !!args[0]; inflater.input = null; },
              'setInput([BII)V': (jvm, inflater, args) => {
                const source = args[0] && args[0].array ? args[0].array : args[0];
                inflater.input = Uint8Array.from(source.slice(args[1] | 0, (args[1] | 0) + (args[2] | 0)), value => value & 255);
              },
              'inflate([B)I': async (jvm, inflater, args) => {
                const response = await fetch(inflater.nowrap ? '/inflate-raw' : '/inflate', {method: 'POST', body: inflater.input});
                if (!response.ok) jvm.throwException('java/util/zip/DataFormatException', 'Inflate service failed');
                const bytes = new Uint8Array(await response.arrayBuffer());
                const target = args[0] && args[0].array ? args[0].array : args[0];
                const length = Math.min(bytes.length, target.length);
                for (let i = 0; i < length; i++) target[i] = (bytes[i] << 24) >> 24;
                console.log('JVM inflate input=' + inflater.input.length + ' output=' + bytes.length);
                startupWork.inflateCalls += 1;
                startupWork.inflateInputBytes += inflater.input.length;
                startupWork.inflateOutputBytes += bytes.length;
                showStartupWork();
                return length;
              },
              'reset()V': (jvm, inflater) => { inflater.input = null; },
              'end()V': () => {}
            }
          },
          'um': {
            natives: {applicationFallback: true},
            methods: {
              'a(I[BII)[B': async (jvm, _, args) => {
                const source = args[1] && args[1].array ? args[1].array : args[1];
                const offset = args[2] | 0;
                const length = args[3] | 0;
                const body = Uint8Array.from(source.slice(offset, offset + length), value => value & 255);
                const response = await fetch('/whirlpool', {method: 'POST', body});
                if (!response.ok) jvm.throwException('java/lang/RuntimeException', 'Whirlpool service failed');
                const digest = Array.from(new Uint8Array(await response.arrayBuffer()), value => (value << 24) >> 24);
                digest.type = '[B';
                digest.elementType = 'byte';
                return digest;
              }
            }
          },
          'java/lang/Runtime': {
            methods: {
              'availableProcessors()I': () => navigator.hardwareConcurrency || 4,
              'freeMemory()J': () => BigInt(64 * 1024 * 1024),
              'totalMemory()J': () => BigInt(128 * 1024 * 1024),
              'maxMemory()J': () => BigInt(2 * 1024 * 1024 * 1024)
            }
          },
          'java/net/Socket': {
            methods: {
              '<init>(Ljava/net/InetAddress;I)V': (jvm, socket, args) => {
                socket.socketId = openSocket(args[1] | 0);
                socket.isClosed = false;
              },
              'connect(Ljava/net/SocketAddress;)V': () => {},
              'setSoTimeout(I)V': () => {},
              'setTcpNoDelay(Z)V': () => {},
              'getOutputStream()Ljava/io/OutputStream;': (jvm, socket) => ({
                type: 'java/net/SocketOutputStream', socketId: socket.socketId
              }),
              'getInputStream()Ljava/io/InputStream;': (jvm, socket) => ({
                type: 'java/net/SocketInputStream', socketId: socket.socketId
              }),
              'close()V': (jvm, socket) => {
                const state = browserSockets.get(socket.socketId);
                if (state) state.ws.close();
                socket.isClosed = true;
              }
            }
          },
          'java/net/InetAddress': {
            methods: {
              'getByName(Ljava/lang/String;)Ljava/net/InetAddress;': (jvm, _, args) => {
                const address = [127, 0, 0, 1];
                address.type = '[B';
                address.elementType = 'byte';
                return {
                  type: 'java/net/InetAddress',
                  hostName: args[0],
                  address
                };
              }
            }
          },
          'java/net/SocketInputStream': {
            methods: {
              'available()I': (jvm, stream) => (browserSockets.get(stream.socketId) || {}).size || 0,
              'read()I': async (jvm, stream) => {
                const state = browserSockets.get(stream.socketId);
                while (state && state.size === 0 && !state.closed) await waitForSocket(state);
                const byte = [0];
                return readSocket(state, byte, 0, 1) === 1 ? byte[0] & 255 : -1;
              },
              'read([B)I': async (jvm, stream, args) => {
                const state = browserSockets.get(stream.socketId);
                while (state && state.size === 0 && !state.closed) await waitForSocket(state);
                return readSocket(state, args[0], 0, Math.min(args[0].length, 512));
              },
              'read([BII)I': async (jvm, stream, args) => {
                const state = browserSockets.get(stream.socketId);
                while (state && state.size === 0 && !state.closed) await waitForSocket(state);
                return readSocket(state, args[0], args[1] | 0, Math.min(args[2] | 0, 512));
              },
              'close()V': () => {}
            }
          },
          'java/net/SocketOutputStream': {
            methods: {
              'write(I)V': (jvm, stream, args) => sendSocket(browserSockets.get(stream.socketId), [args[0]]),
              'write([B)V': (jvm, stream, args) => sendSocket(browserSockets.get(stream.socketId), args[0] || []),
              'write([BII)V': (jvm, stream, args) => {
                const source = args[0] || [], offset = args[1] | 0, length = args[2] | 0;
                sendSocket(browserSockets.get(stream.socketId), source.slice(offset, offset + length));
              },
              'flush()V': () => {},
              'close()V': () => {}
            }
          },
          'java/applet/AppletContext': {
            methods: {
              'showDocument(Ljava/net/URL;)V': (jvm, context, args) => {
                console.error('JVM showDocument: ' + String(args[0] && args[0].url || args[0]));
              },
              'showDocument(Ljava/net/URL;Ljava/lang/String;)V': (jvm, context, args) => {
                console.error('JVM showDocument: ' + String(args[0] && args[0].url || args[0]) + ' target=' + String(args[1]));
              },
              'showStatus(Ljava/lang/String;)V': (jvm, context, args) => {
                console.log('JVM status: ' + String(args[0]));
              }
            }
          }
        };
        if (game.id !== 'dekobloko') {
          // Whirlpool is a Deko Bloko host compatibility adapter, not a JIT
          // optimization. Keep it out of every other obfuscated game.
          delete debug.debugController.options.jreOverrides.um;
        }
        debug.debugController.options.appletParameters = {
          overxgames: '45', overxachievements: '1000', member: 'no',
          gameport1: '43594', gameport2: '43594', servernum: '8003',
          simplemode: simpleMode ? 'true' : 'false',
          instanceid: String(Date.now()), gamecrc: String(game.gamecrc)
        };
        debug.debugController.options.appletCodeBase = game.server;
        appletStartedAt = performance.now();
        setProgress(10, 'Starting the Java applet…',
          'The JVM is running. Game asset preparation has not started yet.', 6, true);
        let canvasSeenAt = null;
        let lastWaitTelemetrySecond = -30;
        readyWatch = setInterval(() => {
          const canvas = document.querySelector('.awt-applet-root canvas');
          if (!canvas || !canvas.width || !canvas.height) {
            const progress = startupAssetState(false);
            const waitingSeconds = Math.floor(
              (performance.now() - appletStartedAt) / 1000);
            let detail = progress.blocks > 0
              ? Number.isFinite(expectedStartupInflateBlocks)
                ? progress.blocks + ' of ' + expectedStartupInflateBlocks +
                  ' compressed blocks processed. Waiting for the game canvas.'
                : progress.blocks +
                  ' compressed blocks processed. Waiting for the game canvas.'
              : 'The applet is running. Waiting for the first asset block and ' +
                'game canvas (' + waitingSeconds + 's).';
            if (progress.estimatedRemainingMs !== null) {
              detail += ' Estimated time remaining: ' +
                formatStartupEta(progress.estimatedRemainingMs) + '.';
            }
            setProgress(progress.percent, progress.label, detail,
              progress.stage, true);
            return;
          }
          const appletRoot = canvas.closest('.awt-applet-root');
          if (appletRoot && appletRoot.parentNode !== appletStage) {
            appletStage.appendChild(appletRoot);
          }
          if (canvasSeenAt === null) {
            canvasSeenAt = performance.now();
            if (!canvasReported) {
              canvasReported = true;
              telemetry('canvas_created', {width: canvas.width, height: canvas.height});
            }
          }
          const jvm = debug.debugController.jvm;
          const surfaces = [...(jvm && jvm._softCanvases || [])];
          const pixels = surfaces.find(surface =>
            surface && surface._pixels && surface._pixels.length)?._pixels;
          let visibleSamples = 0;
          if (pixels) {
            const stride = Math.max(1, Math.floor(pixels.length / 2048));
            for (let index = 0; index < pixels.length; index += stride) {
              const rgb = Number(pixels[index]) & 0xffffff;
              if (rgb !== 0 && rgb !== 0xffffff && ++visibleSamples >= 4) break;
            }
          }
          if (visibleSamples < 4) {
            const waitingSeconds = Math.floor((performance.now() - canvasSeenAt) / 1000);
            loader.classList.toggle('stalled', waitingSeconds >= 30);
            const hasAssetWork = startupWork.crcCalls + startupWork.inflateCalls > 0;
            const progress = startupAssetState(true);
            let detail = hasAssetWork
              ? startupWork.crcCalls + ' CRC checks and ' +
                startupWork.inflateCalls +
                (Number.isFinite(expectedStartupInflateBlocks)
                  ? ' of ' + expectedStartupInflateBlocks : '') +
                ' compressed blocks processed. No game frame yet; waiting ' +
                waitingSeconds + 's.'
              : 'The applet is running, but asset preparation has not reported its ' +
                'first compressed block yet. Waiting ' + waitingSeconds + 's.';
            if (progress.estimatedRemainingMs !== null) {
              detail += ' Estimated time remaining: ' +
                formatStartupEta(progress.estimatedRemainingMs) + '.';
            }
            const label = !hasAssetWork && waitingSeconds >= 30
              ? 'Startup is taking longer than usual…'
              : progress.label;
            setProgress(progress.percent, label, detail,
              progress.stage, true);
            if (waitingSeconds - lastWaitTelemetrySecond >= 30) {
              lastWaitTelemetrySecond = waitingSeconds;
              telemetry('startup_waiting_for_frame', {
                waitingSeconds,
                startupWork: {...startupWork}
              });
            }
            return;
          }
          clearInterval(readyWatch);
          readyWatch = null;
          loader.classList.remove('stalled');
          setProgress(100, 'Game ready',
            game.name + ' has painted its first visible frame.', 16, false);
          if (!firstFrameReported) {
            firstFrameReported = true;
            telemetry('first_visible_frame', {
              visibleSamples,
              startupWork: {...startupWork}
            });
          }
          clearInterval(elapsedTimer);
          setTimeout(() => loader.classList.add('complete'), 450);
        }, 100);
        const clientRun = debug.run(game.mainClass);
        if (optimizerMode === 'interpreter' || optimizerMode === 'no-wasm') {
          debug.debugController.jvm.jit.wasmJit.enabled = false;
        }
        const runResult = await clientRun;
        if (readyWatch) clearInterval(readyWatch);
        clearInterval(elapsedTimer);
        telemetry('jvm_run_completed', {
          result: runResult,
          firstFrameReported,
          browser: browserState(),
          lastPresentationAgeMs: lastPresentationAt === null
            ? null : Math.round(performance.now() - lastPresentationAt),
          sockets: captureSocketMetrics(),
          jvm: captureJvmStacks()
        });
        clearInterval(performanceTimer);
        loader.classList.remove('complete');
        const completionDetail = firstFrameReported
          ? 'The Java runtime returned after the game had painted. This does not mean a match ended.'
          : 'The Java runtime returned before the game painted its first visible frame.';
        setProgress(100, 'Runtime stopped', completionDetail +
          ' Reload the page to start it again.', 16, false);
      } catch (error) {
        if (readyWatch) clearInterval(readyWatch);
        clearInterval(elapsedTimer);
        clearInterval(performanceTimer);
        console.error(error);
        reportFailure('startup_error', error);
      }
    })();
  </script>
</body>
</html>`;

function sendFile(request, response, file, contentType, requestedVersion) {
  const size = fs.statSync(file).size;
  const version = fileVersion(file);
  const immutable = requestedVersion === version;
  const etag = '"' + version + '"';
  if (immutable && request.headers['if-none-match'] === etag) {
    response.writeHead(304, {
      'ETag': etag,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    response.end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': size,
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
    'ETag': etag
  });
  fs.createReadStream(file).pipe(response);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  const pathname = requestUrl.pathname;
  const requestedVersion = requestUrl.searchParams.get('v');
  if (pathname === '/telemetry' && request.method === 'POST') {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 32 * 1024) tooLarge = true;
      else chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) {
        response.writeHead(413, {'Content-Type': 'text/plain'});
        response.end('Telemetry payload too large');
        return;
      }
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const event = String(payload.event || '').slice(0, 80);
        if (!/^[a-z0-9_-]+$/i.test(event)) throw new Error('Invalid telemetry event');
        const record = {
          receivedAt: new Date().toISOString(),
          session: String(payload.session || '').slice(0, 80),
          event,
          elapsedMs: Math.max(0, Number(payload.elapsedMs) || 0),
          details: payload.details && typeof payload.details === 'object'
            ? payload.details : {}
        };
        fs.appendFile(telemetryPath, JSON.stringify(record) + '\n', error => {
          if (error) console.error('Telemetry write failed:', error.message);
        });
        console.log('[telemetry] ' + record.event + ' session=' + record.session +
          ' elapsed=' + record.elapsedMs + 'ms');
        response.writeHead(204, {'Cache-Control': 'no-store'});
        response.end();
      } catch (error) {
        response.writeHead(400, {'Content-Type': 'text/plain'});
        response.end(error.message);
      }
    });
    return;
  }
  if (pathname === '/whirlpool' && request.method === 'POST') {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      const result = spawnSync('openssl', ['dgst', '-provider', 'legacy', '-whirlpool', '-binary'], {
        input: Buffer.concat(chunks),
        maxBuffer: 1024 * 1024
      });
      if (result.status !== 0 || result.stdout.length !== 64) {
        response.writeHead(500, {'Content-Type': 'text/plain'});
        response.end(result.stderr || 'Whirlpool failed');
        return;
      }
      response.writeHead(200, {'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store'});
      response.end(result.stdout);
    });
    return;
  }
  if ((pathname === '/inflate' || pathname === '/inflate-raw') && request.method === 'POST') {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 16 * 1024 * 1024) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const input = Buffer.concat(chunks);
        const output = pathname === '/inflate-raw' ? zlib.inflateRawSync(input) : zlib.inflateSync(input);
        response.writeHead(200, {'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store'});
        response.end(output);
      } catch (error) {
        response.writeHead(400, {'Content-Type': 'text/plain'});
        response.end(error.message);
      }
    });
    return;
  }
  if (pathname === '/jvm-js-logo.svg') {
    sendFile(request, response, loadingLogoPath, 'image/svg+xml', requestedVersion);
    return;
  }
  if (pathname === '/' || pathname === '/index.html') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(libraryHtml());
    return;
  }
  if (pathname === '/games.json') {
    const games = (alterOrbConfig.games || []).map(game => ({
      id: game.internalName,
      name: game.name,
      mainClass: game.mainClass,
      gamecrc: game.gamecrc,
      available: gameJarAvailable(game),
      playUrl: '/play/' + encodeURIComponent(game.internalName)
    }));
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify({schema: 1, games}));
    return;
  }
  const playMatch = /^\/play\/([a-z0-9_]+)\/?$/.exec(pathname);
  if (playMatch) {
    const game = gameById(playMatch[1]);
    if (!game || !gameJarAvailable(game)) {
      response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
      response.end('Game not found or its local JAR failed validation');
      return;
    }
    const manifest = browserAssetManifest(game);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(launcher
      .replace('__DEKOBLOKO_ASSET_MANIFEST__',
        JSON.stringify(manifest).replace(/</g, '\\u003c'))
      .replace('__JVM_JS_LOGO_VERSION__', fileVersion(loadingLogoPath))
      .replace('__GAME_NAME__', escapeHtml(game.name)));
    return;
  }
  if (pathname === '/diagnostics' || pathname === '/diagnostics/') {
    const diagnosticsGame =
      gameById(requestUrl.searchParams.get('game')) ||
      // Prefer a locally available game so the manifest below never
      // stats a missing JAR; dekobloko itself is often not downloaded.
      (alterOrbConfig.games || []).find(game => gameJarAvailable(game)) ||
      alterOrbConfig.games[0];
    if (!diagnosticsGame || !fs.existsSync(gameJarPath(diagnosticsGame))) {
      response.writeHead(503, {'Content-Type': 'application/json; charset=utf-8'});
      response.end(JSON.stringify(
        {schema: 1, error: 'no locally validated game JAR for diagnostics'}));
      return;
    }
    const manifest = browserAssetManifest(diagnosticsGame);
    const diagnosticsConfig = {
      schema: 1,
      awtJarUrl: '/browser-awt-ceiling.jar?v=' + fileVersion(diagnosticsJarPath),
      runtime: {
        name: manifest.runtime.name,
        version: manifest.runtime.version,
        bytes: manifest.runtime.size
      }
    };
    const html = fs.readFileSync(diagnosticsHtmlPath, 'utf8')
      .replace('__BROWSER_CEILING_CONFIG_JSON__', JSON.stringify(diagnosticsConfig))
      .replace('__JVM_RUNTIME_URL__', manifest.runtime.url);
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(html);
    return;
  }
  if (pathname === '/browser-ceiling.js') {
    sendFile(request, response, diagnosticsScriptPath,
      'text/javascript; charset=utf-8', requestedVersion);
    return;
  }
  if (pathname === '/browser-awt-ceiling.jar') {
    sendFile(request, response, diagnosticsJarPath,
      'application/java-archive', requestedVersion);
    return;
  }
  const thumbnailMatch = /^\/game-thumbnails\/([a-z0-9_]+)\.png$/.exec(pathname);
  if (thumbnailMatch) {
    const game = gameById(thumbnailMatch[1]);
    const thumbnailPath = game &&
      path.join(menuImageDir, game.internalName + '.png');
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      sendFile(request, response, thumbnailPath, 'image/png', requestedVersion);
      return;
    }
  }
  const jarMatch = /^\/game-jars\/([a-z0-9_]+)\.jar$/.exec(pathname);
  if (jarMatch) {
    const game = gameById(jarMatch[1]);
    if (game && gameJarAvailable(game)) {
      sendFile(request, response, gameJarPath(game),
        'application/java-archive', requestedVersion);
      return;
    }
  }
  const cacheMatch = /^\/game-cache\/([a-z0-9_]+)\/([^/]+)$/.exec(pathname);
  if (cacheMatch) {
    const game = gameById(cacheMatch[1]);
    const fileName = cacheMatch[2];
    if (game && cacheFilesForGame(game).includes(fileName)) {
      sendFile(request, response,
        path.join(cacheDirectoryForGame(game), fileName),
        'application/octet-stream', requestedVersion);
      return;
    }
  }
  if (pathname === '/dekobloko.jar') {
    response.writeHead(302, {'Location': '/game-jars/dekobloko.jar'});
    response.end();
    return;
  }
  if (pathname === '/cache-manifest.json') {
    const game =
      gameById(requestUrl.searchParams.get('game')) ||
      gameById('dekobloko');
    response.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
    response.end(JSON.stringify(game ? cacheFilesForGame(game) : []));
    return;
  }
  const bundleName = path.basename(pathname);
  const bundlePath = path.join(bundleDir, bundleName);
  if (bundleName === pathname.slice(1) && fs.existsSync(bundlePath)) {
    sendFile(request, response, bundlePath,
      bundleName.endsWith('.map') ? 'application/json' : 'text/javascript',
      requestedVersion);
    return;
  }
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.end('Not found');
});

const webSockets = new WebSocketServer({noServer: true});
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');
  const targetPort = Number(url.searchParams.get('port'));
  if (url.pathname !== '/tcp' || targetPort !== 43594) {
    socket.destroy();
    return;
  }
  webSockets.handleUpgrade(request, socket, head, ws => {
    // Route the guest's game-server connection through a locally running
    // backend when configured; fall back to AlterOrb's public server.
    const tcp = net.createConnection({
      host: process.env.GAME_LIBRARY_TCP_BRIDGE_HOST || 'mgg-server.alterorb.net',
      port: Number(process.env.GAME_LIBRARY_TCP_BRIDGE_PORT || targetPort),
    });
    ws.on('message', bytes => tcp.write(bytes));
    ws.on('close', () => tcp.destroy());
    ws.on('error', () => tcp.destroy());
    tcp.on('data', bytes => {
      if (ws.readyState === WebSocket.OPEN) ws.send(bytes);
    });
    tcp.on('close', () => ws.close());
    tcp.on('error', error => {
      console.error('TCP bridge error on ' + targetPort + ': ' + error.message);
      ws.close();
    });
  });
});

async function loadAlterOrbConfig() {
  try {
    let config;
    if (alterOrbConfigUrl.startsWith('file://')) {
      // Pinned offline catalog: never contacts AlterOrb.
      config = JSON.parse(fs.readFileSync(new URL(alterOrbConfigUrl), 'utf8'));
    } else {
      const response = await fetch(alterOrbConfigUrl);
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' from ' + alterOrbConfigUrl);
      }
      config = await response.json();
    }
    if (!config || !Array.isArray(config.games) || config.games.length === 0) {
      throw new Error('AlterOrb config contains no games');
    }
    fs.mkdirSync(path.dirname(alterOrbConfigCache), {recursive: true});
    const temporaryPath = alterOrbConfigCache + '.tmp';
    fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2) + '\n');
    fs.renameSync(temporaryPath, alterOrbConfigCache);
    return config;
  } catch (error) {
    if (!fs.existsSync(alterOrbConfigCache)) throw error;
    console.warn('Using cached AlterOrb config: ' + error.message);
    const config = JSON.parse(fs.readFileSync(alterOrbConfigCache, 'utf8'));
    if (!config || !Array.isArray(config.games) || config.games.length === 0) {
      throw new Error('Cached AlterOrb config contains no games');
    }
    return config;
  }
}

async function start() {
  alterOrbConfig = await loadAlterOrbConfig();
  const availableGames = alterOrbConfig.games.filter(gameJarAvailable);
  server.listen(port, '0.0.0.0', () => {
    console.log('jvm.js game library listening on 0.0.0.0:' + port +
      ' (' + availableGames.length + '/' + alterOrbConfig.games.length +
      ' validated game JARs)');
  });
}

start().catch(error => {
  console.error('Unable to start game library:', error);
  process.exitCode = 1;
});
