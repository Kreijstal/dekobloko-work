// Real AWT/HotSpot smoke test of the published readable source. No game edits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {buildCompilationStubs} from '../compilation-stubs.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {createBrowserGameServer} from '../../apps/launcher/browser-loader/browser-game-server.mjs';

const workflowRepository = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const funorbRepository = path.resolve(process.env.FUNORB_DECOMPILED_DIR ||
  path.join(workflowRepository, '../funorb-decompiled'));

const javaSource = String.raw`import java.applet.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.image.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.*;
import javax.swing.*;
public class ReadableGameProbe implements AppletStub, AppletContext {
  static Applet game;
  static JFrame frame;
  static Path out;
  static Robot robot;
  static int port;
  static volatile Throwable failure;
  static java.util.List<String> captures = new ArrayList<>();
  final Map<String, String> params = new HashMap<>();
  ReadableGameProbe() {
    params.put("gameport1", "" + port);
    params.put("gameport2", "" + port);
    params.put("gamecrc", "-1254821409");
    params.put("instanceid", "1");
    params.put("servernum", "8003");
    params.put("member", "no");
    params.put("simplemode", "true");
    params.put("overxgames", "45");
    params.put("overxachievements", "1000");
  }
  static Field field(String cls, String key) throws Exception {
    Field f = Class.forName(cls).getDeclaredField(key);
    f.setAccessible(true);
    return f;
  }
  static Object get(String cls, String key) throws Exception {
    return field(cls, key).get(null);
  }
  static Object member(Object object, String key) throws Exception {
    return field(object.getClass().getName(), key).get(object);
  }
  static void check(boolean value, String message) {
    if (!value)
      throw new AssertionError(message);
    if (failure != null)
      throw new AssertionError("Game failed", failure);
  }
  interface Condition {
    boolean test() throws Exception;
  }
  static void await(Condition condition, String label, int seconds) throws Exception {
    long end = System.nanoTime() + seconds * 1000000000L;
    while (!condition.test()) {
      check(System.nanoTime() < end, "Timeout: " + label);
      Thread.sleep(20);
    }
    check(true, label);
    System.out.println("PASS " + label);
  }
  static boolean screen(int id) throws Exception {
    return (Integer) get("SettingsCookieSupport", "currentScreenId") == id
        && (Integer) get("ScoreSubmission", "requestedScreenId") == id
        && (Integer) get("TriangleMesh", "screenTransitionTick") == 0;
  }
  static Object currentScreen() throws Exception {
    return ((Object[]) get("TextTemplateDefinition",
        "screens"))[(Integer) get("SettingsCookieSupport", "currentScreenId")];
  }
  static void activate(int index) throws Exception {
    Object s = currentScreen();
    Method m = s.getClass().getDeclaredMethod("activateMenuItem", int.class, byte.class);
    m.setAccessible(true);
    m.invoke(s, index, (byte) -2);
  }
  static BufferedImage snap(String name) throws Exception {
    Thread.sleep(120);
    Component c = (Component) get("MessageDialog", "gameCanvas");
    Point p = c.getLocationOnScreen();
    BufferedImage image =
        robot.createScreenCapture(new Rectangle(p.x, p.y, c.getWidth(), c.getHeight()));
    check(image.getWidth() == 640 && image.getHeight() == 480, "actual canvas size");
    ImageIO.write(image, "png", out.resolve(name + ".png").toFile());
    captures.add(name + ".png");
    System.out.println("SCREENSHOT " + name);
    return image;
  }
  static int difference(BufferedImage a, BufferedImage b) {
    int n = 0;
    for (int y = 0; y < a.getHeight(); y++)
      for (int x = 0; x < a.getWidth(); x++)
        if (a.getRGB(x, y) != b.getRGB(x, y))
          n++;
    return n;
  }
  static void key(int key) throws Exception {
    focus();
    robot.keyPress(key);
    Thread.sleep(80);
    robot.keyRelease(key);
  }
  static void focus() throws Exception {
    Component c = (Component) get("MessageDialog", "gameCanvas");
    SwingUtilities.invokeAndWait(() -> {
      frame.toFront();
      frame.requestFocus();
      c.requestFocusInWindow();
    });
    if (!c.isFocusOwner()) {
      Point p = c.getLocationOnScreen();
      robot.mouseMove(p.x + 10, p.y + 10);
      robot.mousePress(InputEvent.BUTTON1_DOWN_MASK);
      robot.mouseRelease(InputEvent.BUTTON1_DOWN_MASK);
    }
    await(() -> c.isFocusOwner(), "canvas keyboard focus", 5);
    Thread.sleep(150);
  }
  static Object session() throws Exception {
    return get("UiWidget", "gameplaySession");
  }
  static void replayAfterGameOver(int number) throws Exception {
    Object endedSession = session();
    check((Boolean) member(endedSession, "sessionEnding")
        && (Boolean) member(endedSession, "showGameOverOverlay"), "normal game-over state");
    snap("game-over");
    focus();
    key(KeyEvent.VK_ESCAPE);
    await(() -> {
      int id = (Integer) get("SettingsCookieSupport", "currentScreenId");
      return id >= 0 && screen(id);
    }, "game-over result menu " + number, 15);
    int id = (Integer) get("SettingsCookieSupport", "currentScreenId");
    if (id != 0) {
      int[] actions = ((int[][]) get("InstrumentEnvelope", "menuActionIds"))[id];
      int back = -1;
      for (int i = 0; i < actions.length; i++)
        if (actions[i] == 5 || actions[i] == 14) { back = i; break; }
      check(back >= 0, "result menu has a return-to-menu action");
      activate(back);
      await(() -> screen(0), "game-over return to menu " + number, 10);
    }
    activate(0);
    await(() -> screen(-1) && session() != endedSession, "new gameplay session " + number, 15);
    if ((Boolean) member(session(), "tutorialMode")) {
      focus();
      key(KeyEvent.VK_SPACE);
      await(() -> !(Boolean) member(session(), "tutorialMode"), "replay tutorial skip", 5);
    }
    await(() -> !(Boolean) member(session(), "sceneTransitionInProgress")
        && !(Boolean) member(session(), "sceneTransitionRequested"), "replay gameplay transition", 15);
    focus();
  }
  static void run(int seconds) throws Exception {
    Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
      failure = e;
      System.err.println("UNCAUGHT " + t.getName());
      e.printStackTrace();
    });
    game = (Applet) Class.forName("Geoblox").getConstructor().newInstance();
    check(Paths.get(game.getClass().getProtectionDomain().getCodeSource().getLocation().toURI())
        .equals(Paths.get(System.getProperty("readable.expectedClasses"))),
        "game loaded from freshly compiled readable classes");
    System.out.println("GAME CODE SOURCE " + game.getClass().getProtectionDomain().getCodeSource().getLocation());
    game.setStub(new ReadableGameProbe());
    SwingUtilities.invokeAndWait(() -> {
      frame = new JFrame("Readable GeoBlox - HotSpot");
      frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
      frame.add(game);
      game.setPreferredSize(new Dimension(640, 480));
      frame.pack();
      frame.setLocationRelativeTo(null);
      frame.setVisible(true);
      frame.toFront();
      game.init();
      game.start();
    });
    robot = new Robot();
    await(()
              -> (Boolean) get("DebouncedValidationProvider", "gameAssetsInitialized") && screen(0),
        "usable menu", 60);
    snap("menu");
    activate(1);
    await(() -> screen(3), "instructions transition", 10);
    Object instructions = currentScreen();
    BufferedImage previous = null;
    for (int page = 0; page < 5; page++) {
      final int wanted = page;
      await(()
                -> (Integer) member(instructions, "tutorialPageIndex") == wanted
              && !(Boolean) member(instructions, "tutorialSlideActive"),
          "instruction page " + (page + 1), 10);
      BufferedImage next = snap("instructions-" + (page + 1));
      if (previous != null)
        check(difference(previous, next) > 1000, "instruction content changes");
      previous = next;
      if (page < 4)
        activate(2);
    }
    activate(0);
    await(()
              -> (Integer) member(instructions, "tutorialPageIndex") == 3
            && !(Boolean) member(instructions, "tutorialSlideActive"),
        "instructions previous control", 10);
    activate(1);
    await(() -> screen(0), "return to menu", 10);
    activate(0);
    await(()
              -> screen(-1) && session() != null && (Boolean) member(session(), "tutorialMode")
            && (Boolean) member(session(), "tutorialPromptActive"),
        "tutorial start", 15);
    snap("tutorial");
    focus();
    key(KeyEvent.VK_ENTER);
    await(() -> !(Boolean) member(session(), "tutorialPromptActive"), "tutorial continue input", 5);
    float before = ((Number) member(session(), "boardAngleRadians")).floatValue();
    robot.keyPress(KeyEvent.VK_RIGHT);
    Thread.sleep(1800);
    robot.keyRelease(KeyEvent.VK_RIGHT);
    float after = ((Number) member(session(), "boardAngleRadians")).floatValue();
    check(Math.abs(after - before) > 0.1, "rotation input changes board angle");
    snap("tutorial-rotation");
    key(KeyEvent.VK_SPACE);
    await(() -> !(Boolean) member(session(), "tutorialMode"), "tutorial skip input", 5);
    await(()
              -> !(Boolean) member(session(), "sceneTransitionInProgress")
            && !(Boolean) member(session(), "sceneTransitionRequested"),
        "gameplay transition", 15);
    BufferedImage first = snap("gameplay-start");
    int tickBefore = (Integer) member(session(), "updateTick");
    int scoreBefore = (Integer) member(session(), "score");
    long gameplayStart = System.nanoTime();
    int samples = 0, maxReleased = 0, maxScore = scoreBefore, ended = 0, tickAdvance = 0;
    int[] directions = {KeyEvent.VK_RIGHT, KeyEvent.VK_LEFT};
    while (samples < seconds) {
      check(screen(-1), "gameplay stays visible");
      Object s = session();
      if ((Boolean) member(s, "sessionEnding")) {
        ended++;
        replayAfterGameOver(ended);
        continue;
      }
      int sampleTickBefore = (Integer) member(s, "updateTick");
      if (!((Component) get("MessageDialog", "gameCanvas")).isFocusOwner()) focus();
      robot.keyPress(directions[samples % 2]);
      robot.keyPress(KeyEvent.VK_DOWN);
      try {Thread.sleep(1000);}
      finally {
        robot.keyRelease(KeyEvent.VK_DOWN);
        robot.keyRelease(directions[samples % 2]);
      }
      tickAdvance += (Integer) member(s, "updateTick") - sampleTickBefore;
      maxReleased =
          Math.max(maxReleased, (Integer) get("MatchCandidateSupport", "releasedInCurrentTheme"));
      maxScore = Math.max(maxScore, (Integer) member(s, "score"));
      check(true, "live gameplay");
      samples++;
      System.out.println("GAMEPLAY tick=" + member(s, "updateTick") + " score=" + member(s, "score")
          + " released=" + get("MatchCandidateSupport", "releasedInCurrentTheme")
          + " angle=" + member(s, "boardAngleRadians"));
      if (samples == 5)
        snap("gameplay-active");
    }
    BufferedImage last = snap("gameplay-end");
    int tickAfter = (Integer) member(session(), "updateTick");
    check(tickAdvance > 100, "game ticks advance across played sessions");
    check(maxReleased > 0, "entities released");
    check(difference(first, last) > 1000, "presented gameplay changes");
    check(samples == seconds, "complete requested gameplay duration");
    check(maxScore > scoreBefore, "matching awards points");
    long gameplayElapsedMillis = (System.nanoTime() - gameplayStart) / 1000000;
    if ((Boolean) member(session(), "sessionEnding")) replayAfterGameOver(++ended);
    focus();
    key(KeyEvent.VK_ESCAPE);
    await(() -> screen(1), "pause menu input", 10);
    snap("pause-menu");
    int pausedTick = (Integer) member(session(), "updateTick");
    Thread.sleep(400);
    check((Integer) member(session(), "updateTick") == pausedTick, "paused updates stop");
    activate(0);
    await(() -> screen(-1), "resume gameplay", 10);
    int resumeBefore = (Integer) member(session(), "updateTick");
    Thread.sleep(600);
    check((Integer) member(session(), "updateTick") > resumeBefore, "resumed updates advance");
    String json =
        "{\"status\":\"passed\",\"instructionPages\":5,\"tutorialContinue\":true,\"rotationInput\":"
        + "true,\"tutorialSkip\":true,\"pauseResume\":true,\"gameplaySamples\":"
        + samples + ",\"gameplayElapsedMillis\":" + gameplayElapsedMillis
        + ",\"gameEnded\":" + ended + ",\"ticksBefore\":" + tickBefore
        + ",\"ticksAfter\":" + tickAfter + ",\"gameplayTickAdvance\":" + tickAdvance
        + ",\"maximumReleased\":" + maxReleased
        + ",\"maximumScore\":" + maxScore + ",\"pixelDifference\":" + difference(first, last)
        + "}";
    Files.write(out.resolve("result.txt"), json.getBytes("UTF-8"));
    System.out.println("RESULT " + json);
  }
  public static void main(String[] args) {
    try {
      out = Paths.get(args[0]);
      port = Integer.parseInt(args[1]);
      run(Integer.parseInt(args[2]));
      System.exit(0);
    } catch (Throwable e) {
      e.printStackTrace();
      System.exit(1);
    }
  }
  public boolean isActive() {
    return true;
  }
  public URL getDocumentBase() {
    return getCodeBase();
  }
  public URL getCodeBase() {
    try {
      return new URL("http://127.0.0.1:" + port + "/");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
  public String getParameter(String n) {
    return params.get(n);
  }
  public AppletContext getAppletContext() {
    return this;
  }
  public void appletResize(int w, int h) {}
  public AudioClip getAudioClip(URL u) {
    return null;
  }
  public Image getImage(URL u) {
    return Toolkit.getDefaultToolkit().getImage(u);
  }
  public Applet getApplet(String n) {
    return game;
  }
  public Enumeration<Applet> getApplets() {
    return Collections.enumeration(Collections.singleton(game));
  }
  public void showDocument(URL u) {
    failure = new AssertionError("Unexpected navigation: " + u);
    System.err.println(failure);
  }
  public void showDocument(URL u, String t) {
    showDocument(u);
  }
  public void showStatus(String s) {
    System.out.println("STATUS " + s);
  }
  public void setStream(String k, InputStream s) {}
  public InputStream getStream(String k) {
    return null;
  }
  public Iterator<String> getStreamKeys() {
    return Collections.emptyIterator();
  }
}
`;

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  assert.ok(['--assets', '--output', '--cache', '--seconds', '--display'].includes(key) && process.argv[i + 1],
    'Usage: node readable/tests/test-geoblox-hotspot.mjs --assets JS5_DIR --output OUTPUT [--cache CACHE_DIR] [--seconds 60] [--display :0]');
  assert.ok(!Object.hasOwn(options, key), 'Duplicate option: ' + key);
  options[key] = process.argv[i + 1];
}
assert.ok(options['--assets'] && options['--output'], '--assets and --output are required');
const assets = path.resolve(options['--assets']);
const output = path.resolve(options['--output']);
const seconds = Number(options['--seconds'] ?? 60);
assert.ok(Number.isInteger(seconds) && seconds >= 5 && seconds <= 600, '--seconds must be 5..600');
assert.ok(output !== assets && !output.startsWith(assets + path.sep), 'Output must be separate from assets');
assert.ok(!output.startsWith(workflowRepository + path.sep), 'Generated output belongs outside Deko');
fs.mkdirSync(output, {recursive: true});
assert.ok(!fs.lstatSync(output).isSymbolicLink(), 'Output cannot be a symlink');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-hotspot-build-'));
const runtime = path.join(temporary, 'screens');
const classes = path.join(temporary, 'classes');
const cacheRoot = path.join(temporary, 'cache');
for (const dir of [runtime, classes, path.join(cacheRoot, 'geoblox')]) fs.mkdirSync(dir, {recursive: true});
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const report = {status: 'failed', scope: 'Readable GeoBlox desktop instructions/tutorial/gameplay smoke test',
  startedAt: new Date().toISOString(), requestedGameplaySeconds: seconds, simpleMode: true,
  runnerSha256: digest(fs.readFileSync(new URL(import.meta.url))),
  display: options['--display'] ?? 'isolated Xvfb',
  wholeGameEquivalenceVerified: false, browserPhoneAndFpsVerified: false};
let server, child, processExit, timer;
const sockets = new Set();
const served = new Map();
const errors = [];
const log = path.join(output, 'hotspot.log');
try {
  const sources = path.join(funorbRepository, 'games/geoblox');
  const {provenance} = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-naming.json')));
  const inventory = sourceInventory(sources);
  assert.equal(inventory.length, 303);
  const sourceSha256 = sourceIdentity(inventory);
  assert.equal(sourceSha256, provenance.outputTreeSha256, 'Published readable bytes differ from provenance');
  const stubs = buildCompilationStubs(funorbRepository, temporary);
  const stub = stubs.jar;
  Object.assign(report, {sourceSha256, sourceFiles: inventory.length, rawSourceCommit: provenance.source.commit,
    stubSha256: digest(fs.readFileSync(stub)), stubSourceSha256: stubs.sourceTreeSha256});
  const installed = path.resolve(options['--cache'] ?? path.join(os.homedir(), '.alterorb/caches/geoblox'));
  if (fs.existsSync(installed)) {
    const files = fs.readdirSync(installed).filter(name => /^main_file_cache\.(dat2|idx[0-9]+)$/.test(name)).sort();
    report.seedCache = files.map(name => {const data = fs.readFileSync(path.join(installed, name));
      fs.writeFileSync(path.join(cacheRoot, 'geoblox', name), data);return {file: name, sha256: digest(data)};});
  } else report.seedCache = [];
  const harness = path.join(temporary, 'ReadableGameProbe.java');
  fs.writeFileSync(harness, javaSource);
  report.harnessSha256 = digest(javaSource);
  const list = path.join(temporary, 'sources.txt');
  const sourceFiles = [...inventory.map(file => path.join(sources, file.path)), harness,
    path.join(workflowRepository, 'apps/launcher/src/net/alterorb/launcher/Hook.java'),
    path.join(workflowRepository, 'apps/launcher/src/local/Trace.java')];
  assert.ok(sourceFiles.every(file => !/["\r\n]/.test(file)), 'Unsupported javac argument-file path');
  fs.writeFileSync(list, sourceFiles.map(file => '"' + file + '"').join('\n') + '\n');
  const javac = process.env.JAVAC ?? 'javac';
  const java = process.env.JAVA ?? 'java';
  const compilation = captureProcess(javac, ['--release', '8', '-proc:none', '-encoding', 'UTF-8',
    '-classpath', stub, '-d', classes, '@' + list]);
  fs.writeFileSync(path.join(output, 'compile.log'), compilation.stdout + compilation.stderr);
  report.jdk = captureProcess(java, ['-version']).stderr.toString().trim();
  assert.match(report.jdk, /HotSpot|OpenJDK .*Server VM/, 'This test requires HotSpot');
  const {frameJs5Response} = createBrowserGameServer({game: {}});
  server = net.createServer(socket => {
    sockets.add(socket);socket.on('close', () => sockets.delete(socket));
    socket.on('error', error => errors.push(error.message));
    let buffer = Buffer.alloc(0), ready = false, xor = 0;
    socket.on('data', data => {
      try {
        buffer = Buffer.concat([buffer, data]);
        assert.ok(buffer.length < 1048576, 'Oversized request');
        if (!ready) {
          const offset = buffer[0] === 12 ? 8 : 0;
          if (buffer.length < offset + 1) return;
          if (buffer[offset] === 17) {socket.end();return;} // Empty local JAGGRAB document.
          assert.equal(buffer[offset], 15, 'Only local JS5 is supported; no account or multiplayer emulation');
          if (buffer.length < offset + 5) return;
          if (offset) assert.equal(buffer.readUInt16BE(3), 1, 'GeoBlox game id');
          assert.equal(buffer.readInt32BE(offset + 1), -1254821409, 'GeoBlox game CRC');
          buffer = buffer.subarray(offset + 5);ready = true;socket.write(Buffer.from([0]));
        }
        while (buffer.length >= 6) {
          const request = buffer.subarray(0, 6);buffer = buffer.subarray(6);
          const opcode = request[0];
          if (opcode === 4) {xor = request[1];continue;}
          if ([2, 3, 6].includes(opcode)) continue;
          if (opcode === 7) {socket.end();return;}
          assert.ok(opcode === 0 || opcode === 1, 'Unknown JS5 opcode');
          const archive = request[1], group = request.readUInt32BE(2);
          const file = `${archive}-${group}.bin`, bytes = fs.readFileSync(path.join(assets, file));
          served.set(file, {file, sha256: digest(bytes)});
          let container = bytes;
          if (archive !== 255) {
            assert.ok(bytes.length >= 5, 'Short JS5 container');
            const length = (bytes[0] === 0 ? 5 : 9) + bytes.readUInt32BE(1);
            assert.ok(length <= bytes.length, 'Truncated JS5 container');container = bytes.subarray(0, length);
          }
          socket.write(Buffer.from(frameJs5Response(archive, group, container, opcode === 0)).map(v => v ^ xor));
        }
      } catch (error) {errors.push(error.message);socket.destroy();}
    });
  });
  server.listen(0, '127.0.0.1');await once(server, 'listening');
  const port = server.address().port;
  const args = ['-Xmx512m', '-Dreadable.expectedClasses=' + classes,
    '-Dalterorb.cacheRoot=' + cacheRoot, '-Djavax.sound.sampled.SourceDataLine=#default',
    '-Djavax.sound.sampled.Clip=#default', '-cp', classes + path.delimiter + stub,
    'ReadableGameProbe', runtime, String(port), String(seconds)];
  const descriptor = fs.openSync(log, 'w');
  try {
    child = options['--display']
      ? spawn(java, args, {detached: true, stdio: ['ignore', descriptor, descriptor],
        env: {...process.env, DISPLAY: options['--display']}})
      : spawn('xvfb-run', ['-a', '--server-args=-screen 0 800x600x24 -nolisten tcp', java, ...args],
        {detached: true, stdio: ['ignore', descriptor, descriptor]});
  }
  finally {fs.closeSync(descriptor);}
  processExit = new Promise((resolve, reject) => {child.once('error', reject);
    child.once('exit', (code, signal) => resolve({code, signal}));});
  timer = setTimeout(() => {try {process.kill(-child.pid, 'SIGTERM');} catch {}}, (seconds + 150) * 1000);
  const exit = await processExit;clearTimeout(timer);
  assert.equal(exit.code, 0, 'HotSpot smoke failed; inspect ' + log + (exit.signal ? ' (' + exit.signal + ')' : ''));
  assert.deepEqual(errors, [], 'Local JS5 server errors');
  const result = JSON.parse(fs.readFileSync(path.join(runtime, 'result.txt')));
  assert.equal(result.status, 'passed');
  Object.assign(report, result);
  console.log(JSON.stringify({status: report.status, sourceFiles: report.sourceFiles,
    sourceSha256: report.sourceSha256, ...result, report: path.join(output, 'report.json')}));
} catch (error) {
  report.error = error.message;
  if (error.stderr) fs.appendFileSync(log, error.stderr);
  console.error(error.stack);process.exitCode = 1;
} finally {
  if (timer) clearTimeout(timer);
  // Kill only our isolated process group, including its Xvfb child.
  if (child?.pid) {try {process.kill(-child.pid, 'SIGTERM');} catch {}}
  if (processExit) await processExit.catch(() => {});
  for (const socket of sockets) socket.destroy();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  report.assetsServed = [...served.values()].sort((a, b) => a.file.localeCompare(b.file));
  report.serverErrors = errors;
  report.screenshots = fs.readdirSync(runtime).filter(file => file.endsWith('.png')).sort();
  for (const file of report.screenshots) fs.copyFileSync(path.join(runtime, file), path.join(output, file));
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.rmSync(temporary, {recursive: true, force: true});
}

