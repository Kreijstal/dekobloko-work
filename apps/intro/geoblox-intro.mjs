#!/usr/bin/env node
// Build a standalone player from the published intro renderer. No game startup.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildCompilationStubs} from '../../readable/compilation-stubs.mjs';
import {sourceInventory, sourceIdentity} from '../../readable/tools/readable-java.mjs';
import {captureProcess} from '../../readable/tools/lib/capture-process.mjs';

const repository = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const publication = path.resolve(process.env.FUNORB_DECOMPILED_DIR || path.join(repository, '../funorb-decompiled'));
const options = {output: path.join(os.homedir(), '.cache/dekobloko/geoblox-intro')};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (['--check', '--build-only'].includes(key)) options[key.slice(2)] = true;
  else if (['--assets', '--output'].includes(key) && process.argv[i + 1]) options[key.slice(2)] = path.resolve(process.argv[++i]);
  else throw new Error('Usage: node apps/intro/geoblox-intro.mjs --assets JS5_DIR [--output DIR] [--check | --build-only]');
}
assert.ok(options.assets, '--assets must select the local GeoBlox JS5 directory');
assert.ok(!(options.check && options['build-only']), 'Choose --check or --build-only');
const output = path.resolve(options.output);
assert.ok(![publication, repository, options.assets].some(root => output === root || root.startsWith(output + path.sep)),
  'Output cannot replace an input or repository');
const kind = 'dekobloko-geoblox-intro';
if (fs.existsSync(output)) {
  assert.ok(!fs.lstatSync(output).isSymbolicLink(), 'Output cannot be a symlink');
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'provenance.json'))).generatedBy, kind,
    'Refusing to replace an unrelated directory');
  assert.ok(fs.readdirSync(output).every(name => ['classes', 'assets', 'run.sh', 'provenance.json'].includes(name)),
    'Output contains unrelated files');
}

const player = String.raw`import java.awt.*;
import java.awt.event.*;
import java.awt.image.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.locks.LockSupport;
import java.util.zip.CRC32;
import javax.sound.sampled.*;
import javax.swing.*;

public final class GeobloxIntro {
  static final int WIDTH=640, HEIGHT=480, LAST_TICK=250;
  final BufferedImage image=new BufferedImage(WIDTH,HEIGHT,BufferedImage.TYPE_INT_RGB);
  final int[] pixels=((DataBufferInt)image.getRaster().getDataBuffer()).getData();
  final PcmSample sound;
  volatile boolean closed, replay;
  volatile int pointerX=-1, pointerY=-1;
  Clip clip;

  // Supply the original archive decoder with local files, without cache workers,
  // update-server sockets, account UI or the applet's bootstrap state machine.
  static final class LocalArchive extends ArchiveSource {
    final Path root;
    final ArchiveIndex index;
    final Set<Integer> opened=new TreeSet<Integer>();
    LocalArchive(Path root)throws Exception {
      this.root=root;
      byte[] bytes=Files.readAllBytes(root.resolve("255-10.bin"));
      CRC32 crc=new CRC32();crc.update(bytes);
      index=new ArchiveIndex(bytes,(int)crc.getValue(),null);
    }
    int getGroupProgress(int guard,int group){return 100;}
    ArchiveIndex getIndex(byte guard){return index;}
    byte[] getPackedGroup(int guard,int group) {
      if(group<1||group>4)throw new AssertionError("Non-intro archive group requested: "+group);
      opened.add(group);
      try{return Files.readAllBytes(root.resolve("10-"+group+".bin"));}
      catch(Exception error){throw new RuntimeException(error);}
    }
  }

  GeobloxIntro(Path assets)throws Exception {
    MessageDialog.gameCanvas=new Canvas();
    Geoblox.clientControlFlowFlag=0;
    SoftwareRasterizer.setRasterTarget(pixels,WIDTH,HEIGHT);
    LocalArchive local=new LocalArchive(assets);
    ResourceArchive archive=new ResourceArchive(local,false,0);
    MessageDialogContent.loadLogoMeshesAndMaterials(archive,0);
    MatchCandidateSupport.prepareFinalFrameSlices(-21541,archive);
    FullscreenSupport.prepareMeshSpecularResponse((byte)-91);
    MidiNoteMixer.prepareLogoGlowRaster((byte)-32);
    MusicDecoder.decodeSetup(archive.getNamedFile(0,"","headers.packvorbis"));
    sound=MusicDecoder.loadByName(archive,"jagex logo2.packvorbis","").decodePcm();
    require(sound!=null&&sound.samples.length>0,"intro sound decoded");
    require(local.opened.equals(new TreeSet<Integer>(Arrays.asList(1,2,3,4))),"only intro assets opened");
    System.out.println("INTRO READY meshes="+ArchiveIndex.logoMeshes.length+" samples="+sound.samples.length+" sampleRate="+sound.sampleRateHz);
  }

  static void require(boolean valid,String message) {
    if(!valid)throw new AssertionError(message);
  }

  void render(int tick) {
    SoftwareRasterizer.setRasterTarget(pixels,WIDTH,HEIGHT);
    SoftwareRasterizer.clearFramebuffer();
    PrefixCodeDecoder.pointerXSnapshot=pointerX;
    PcmResampler.pointerYSnapshot=pointerY;
    DequeCursor.logoAnimationTick=tick;
    LogoCompositor.drawLogoAnimation(HEIGHT/2,WIDTH/2,-51);
    require(MatchingTextValidator.rasterTargetStack.isEmpty(13519),"raster target restored");
  }

  long pixelHash() {
    CRC32 crc=new CRC32();
    for(int pixel:pixels){crc.update(pixel>>>16);crc.update(pixel>>>8);crc.update(pixel);}
    return crc.getValue();
  }

  void check() {
    long[] first=new long[LAST_TICK+1];int visibleFrames=0;
    for(int pass=0;pass<2;pass++)for(int tick=0;tick<=LAST_TICK;tick++) {
      render(tick);
      if(pass==0) {
        first[tick]=pixelHash();
        int lit=0;for(int pixel:pixels)if((pixel&0xffffff)!=0)lit++;
        if(lit>100)visibleFrames++;
      } else require(first[tick]==pixelHash(),"deterministic replay at tick "+tick);
    }
    require(visibleFrames>150,"animated visible logo");
    require(first[25]!=first[75]&&first[75]!=first[150],"mesh motion and final-frame transition");
    render(250);for(int pixel:pixels)require((pixel&0xffffff)==0,"fade ends on black");
    pointerX=20;pointerY=20;render(80);long left=pixelHash();
    pointerX=620;pointerY=460;render(80);require(left!=pixelHash(),"pointer controls original lighting");
    require(VisualPropertyOverrides.clientBootstrapStage==0
      &&UiWidget.gameplaySession==null&&!DebouncedValidationProvider.gameAssetsInitialized,
      "game and loading pipeline never started");
    System.out.println("PASS intro-only: 502 frames; deterministic loops; motion, lighting, fade, audio; no game bootstrap");
  }

  void openAudio() {
    try {
      clip=AudioSystem.getClip();
      clip.open(new AudioFormat((float)sound.sampleRateHz,8,1,true,false),sound.samples,0,sound.samples.length);
    } catch(Exception unavailable) {
      if(clip!=null)clip.close();clip=null;
      System.err.println("Intro sound device unavailable: "+unavailable);
    }
  }

  void play()throws Exception {
    openAudio();
    Canvas canvas=new Canvas();canvas.setPreferredSize(new Dimension(WIDTH,HEIGHT));canvas.setIgnoreRepaint(true);
    canvas.setBackground(Color.BLACK);
    final JFrame frame=new JFrame("Jagex Intro");
    frame.setDefaultCloseOperation(JFrame.DO_NOTHING_ON_CLOSE);
    frame.addWindowListener(new WindowAdapter(){public void windowClosing(WindowEvent event){closed=true;}});
    canvas.addMouseMotionListener(new MouseMotionAdapter(){public void mouseMoved(MouseEvent e){pointerX=e.getX();pointerY=e.getY();}
      public void mouseDragged(MouseEvent e){mouseMoved(e);}});
    canvas.addMouseListener(new MouseAdapter(){public void mouseExited(MouseEvent e){pointerX=-1;pointerY=-1;}
      public void mousePressed(MouseEvent e){replay=true;}});
    canvas.addKeyListener(new KeyAdapter(){public void keyPressed(KeyEvent e){
      if(e.getKeyCode()==KeyEvent.VK_ESCAPE)closed=true;
      else if(e.getKeyCode()==KeyEvent.VK_SPACE||e.getKeyCode()==KeyEvent.VK_R)replay=true;
    }});
    render(0);
    SwingUtilities.invokeAndWait(()->{frame.add(canvas);frame.pack();frame.setResizable(false);
      frame.setLocationRelativeTo(null);frame.setVisible(true);frame.toFront();canvas.requestFocusInWindow();});
    canvas.createBufferStrategy(2);BufferStrategy buffers=canvas.getBufferStrategy();
    int tick=0;long next=System.nanoTime();
    try {
      while(!closed) {
        if(replay){tick=0;replay=false;}
        if(tick==0&&clip!=null){clip.stop();clip.setFramePosition(0);clip.start();}
        render(tick);
        do {
          do {Graphics graphics=buffers.getDrawGraphics();try{graphics.drawImage(image,0,0,null);}finally{graphics.dispose();}}
          while(buffers.contentsRestored());
          buffers.show();Toolkit.getDefaultToolkit().sync();
        } while(buffers.contentsLost()&&!closed);
        tick=(tick+1)%(LAST_TICK+1);
        next+=20000000L;long wait=next-System.nanoTime();
        if(wait>0)LockSupport.parkNanos(wait);else if(wait < -200000000L)next=System.nanoTime();
      }
    } finally {if(clip!=null)clip.close();SwingUtilities.invokeAndWait(()->frame.dispose());}
  }

  public static void main(String[] args)throws Exception {
    GeobloxIntro intro=new GeobloxIntro(Paths.get(args[0]));
    if(args.length>1&&args[1].equals("--check"))intro.check();else intro.play();
  }
}
`;

function javaRuntime() {
  if (process.env.JAVA) return process.env.JAVA;
  for (const version of [8, 17, 21, 11]) {
    const candidate = `/usr/lib/jvm/java-${version}-openjdk/bin/java`;
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'java';
}

fs.mkdirSync(path.dirname(output), {recursive: true});
const build = fs.mkdtempSync(path.join(path.dirname(output), '.geoblox-intro-build-'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-intro-'));
try {
  const sources = path.join(publication, 'games/geoblox');
  const files = sourceInventory(sources);
  const dictionary = JSON.parse(fs.readFileSync(path.join(publication, 'decompilation/geoblox-naming.json')));
  assert.equal(files.length, 303);
  assert.equal(sourceIdentity(files), dictionary.provenance.outputTreeSha256);
  const classes = path.join(build, 'classes'), assets = path.join(build, 'assets');
  fs.mkdirSync(assets);
  const hashes = {};
  for (const name of ['255-10.bin', '10-1.bin', '10-2.bin', '10-3.bin', '10-4.bin']) {
    const bytes = fs.readFileSync(path.join(options.assets, name));
    fs.writeFileSync(path.join(assets, name), bytes);
    hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  const stubs = buildCompilationStubs(publication, temporary);
  fs.cpSync(path.join(temporary, 'stub-classes'), classes, {recursive: true});
  const host = path.join(temporary, 'GeobloxIntro.java');fs.writeFileSync(host, player);
  const list = path.join(temporary, 'sources.args');
  const inputs = [...files.map(file => path.join(sources, file.path)), host,
    path.join(repository, 'apps/launcher/src/net/alterorb/launcher/Hook.java'),
    path.join(repository, 'apps/launcher/src/local/Trace.java')];
  fs.writeFileSync(list, inputs.map(file => JSON.stringify(file)).join('\n') + '\n');
  const compilation = captureProcess(process.env.JAVAC || 'javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8',
    '-classpath', stubs.jar, '-d', classes, '@' + list]);
  if (compilation.stderr.length) process.stderr.write(compilation.stderr);
  const runtime = javaRuntime();
  if (options.check) process.stdout.write(captureProcess(runtime, ['-Djava.awt.headless=true', '-Xmx256m',
    '-cp', classes, 'GeobloxIntro', assets, '--check']).stdout);
  const run = `#!/bin/sh\nset -eu\nintro_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\n` +
    `if [ -z "\${JAVA:-}" ]; then\n` +
    `  for candidate in /usr/lib/jvm/java-8-openjdk/bin/java /usr/lib/jvm/java-17-openjdk/bin/java /usr/lib/jvm/java-21-openjdk/bin/java /usr/lib/jvm/java-11-openjdk/bin/java; do\n` +
    `    if [ -x "$candidate" ]; then JAVA=$candidate; break; fi\n  done\nfi\n` +
    `exec "\${JAVA:-java}" -Xmx256m -cp "$intro_root/classes" GeobloxIntro "$intro_root/assets" "$@"\n`;
  fs.writeFileSync(path.join(build, 'run.sh'), run, {mode: 0o755});
  fs.writeFileSync(path.join(build, 'provenance.json'), JSON.stringify({generatedBy: kind,
    readableSourceSha256: sourceIdentity(files), compiler: dictionary.generators,
    builderSha256: crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
    stubSourceSha256: stubs.sourceTreeSha256, assets: hashes, checked: !!options.check}, null, 2) + '\n');
  if (fs.existsSync(output)) fs.rmSync(output, {recursive: true});
  fs.renameSync(build, output);
  console.log('Built intro only: ' + path.join(output, 'run.sh'));
  if (!options.check && !options['build-only']) {
    const result = spawnSync(path.join(output, 'run.sh'), [], {stdio: 'inherit'});
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  if (error.stdout?.length) process.stderr.write(error.stdout);
  if (error.stderr?.length) process.stderr.write(error.stderr);
  throw error;
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
  if (fs.existsSync(build)) fs.rmSync(build, {recursive: true, force: true});
}
