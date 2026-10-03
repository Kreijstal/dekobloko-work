import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

// Actual factory calls must return the wheel/raster implementations rather than
// silently selecting the old null/fallback paths after a class rename.
const nativeInput = process.argv[2] && path.resolve(process.argv[2]);
if (!nativeInput || process.argv.length !== 3)
  throw new Error('Usage: test-geoblox-reflection.mjs VERIFIED_CLASSES');
const root = publishedReadableRoot;
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile)).renames.map(rule => [rule.symbol, rule.to]));
const expectedNativeSha256 = '2139fc69b4da9fb817337abe6567b8c0993d8072d868aae27eac2f5ff19a2777';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-reflection-'));
try {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.class')) files.push(file);
    }
  }
  visit(nativeInput);
  const identity = crypto.createHash('sha256');
  for (const file of files.sort()) {
    const name = Buffer.from(path.relative(nativeInput, file).split(path.sep).join('/'));
    const bytes = fs.readFileSync(file);
    identity.update(name.length + ':'); identity.update(name);
    identity.update(bytes.length + ':'); identity.update(bytes);
  }
  const pin = JSON.parse(fs.readFileSync(path.join(root, '../decompilation/geoblox-provenance.json'))).verifiedTransformedClasses;
  assert.equal(files.length, pin.files); assert.equal(identity.digest('hex'), pin.sha256);
  let expected;
  for (const variant of ['native', 'original', 'renamed']) {
    const native = variant === 'native', renamed = variant === 'renamed';
    const name = (symbol, original) => renamed ? aliases.get(symbol) ?? original : original;
    const type = original => name('C:' + original, original);
    const field = (owner, original, descriptor) => native ? original.replace(/^field_/, '') : name(`F:${owner}.${original}:${descriptor}`, original);
    const method = (owner, signature) => name('M:' + owner + '.' + signature, signature.split('(')[0]);
    const harness = `import java.awt.*; import java.awt.event.*; import java.awt.image.*; import java.lang.reflect.*;
public class ReflectionBehavior {
  static int cases;
  static void check(boolean valid) { if (!valid) throw new AssertionError(cases); }
  static Field field(String owner, String name) throws Exception { Field f=Class.forName(owner).getDeclaredField(name);f.setAccessible(true);return f; }
  static Method method(String owner, String name, Class<?>... args) throws Exception { Method m=Class.forName(owner).getDeclaredMethod(name,args);m.setAccessible(true);return m; }
  public static void main(String[] args) throws Exception {
    String[] owners={"${type('gl')}","${type('ve')}","${type('of')}","${type('pd')}","${type('tk')}"};
    for(int i=0;i<owners.length;i++) {
      Class<?> c=Class.forName(owners[i],false,ReflectionBehavior.class.getClassLoader());
      c.getDeclaredConstructor();System.out.println("loaded:"+i);cases++;
    }
    method("${type('pd')}","enter",Frame.class,int.class,int.class,int.class,int.class);
    method("${type('pd')}","exit");method("${type('pd')}","listmodes");
    method("${type('tk')}","movemouse",int.class,int.class);
    method("${type('tk')}","showcursor",Component.class,boolean.class);
    method("${type('tk')}","setcustomcursor",Component.class,int[].class,int.class,int.class,Point.class);
    Method wheelFactory=method("${type('nd')}","${method('nd','a(I)Lvk;')}",int.class);
    Method attach=method("${type('gl')}","${method('gl','a(ILjava/awt/Component;)V')}",int.class,Component.class);
    Method drain=method("${type('gl')}","${method('gl','a(Z)I')}",boolean.class);
    Method detach=method("${type('gl')}","${method('gl','a(Ljava/awt/Component;B)V')}",Component.class,byte.class);
    Field control=field("${type('Geoblox')}","${field('Geoblox','field_C','I')}");
    for(int flag:new int[]{-1,0,1,42})for(int guard:new int[]{121,120})
    for(boolean validDrain:new boolean[]{true,false})for(int rotation:new int[]{0,1,-1,Integer.MAX_VALUE,Integer.MIN_VALUE}) {
      control.setInt(null,flag);Object wheel=wheelFactory.invoke(null,2);
      check(wheel!=null&&wheel.getClass()==Class.forName("${type('gl')}"));
      Canvas canvas=new Canvas();attach.invoke(wheel,guard,canvas);check(canvas.getMouseWheelListeners().length==1);
      MouseWheelEvent first=new MouseWheelEvent(canvas,MouseEvent.MOUSE_WHEEL,0,0,0,0,0,false,MouseWheelEvent.WHEEL_UNIT_SCROLL,1,rotation);
      MouseWheelEvent second=new MouseWheelEvent(canvas,MouseEvent.MOUSE_WHEEL,0,0,0,0,0,false,MouseWheelEvent.WHEEL_UNIT_SCROLL,1,rotation+1);
      ((MouseWheelListener)wheel).mouseWheelMoved(first);((MouseWheelListener)wheel).mouseWheelMoved(second);
      check(first.isConsumed()&&second.isConsumed());int expectedRotation=(guard<121?-83:0)+rotation+(rotation+1);
      if(!validDrain) {
        try {drain.invoke(wheel,false);throw new AssertionError();}
        catch(InvocationTargetException error){check(error.getCause() instanceof NullPointerException);}
      }
      int drained=(Integer)drain.invoke(wheel,true);check(drained==expectedRotation);check((Integer)drain.invoke(wheel,true)==0);
      try {detach.invoke(wheel,canvas,(byte)1);throw new AssertionError();}
      catch(InvocationTargetException error){check(error.getCause() instanceof ArithmeticException);}
      check(canvas.getMouseWheelListeners().length==1);detach.invoke(wheel,canvas,(byte)-64);check(canvas.getMouseWheelListeners().length==0);
      System.out.println("wheel:"+flag+":"+guard+":"+validDrain+":"+rotation+":"+drained);cases++;
    }
    Method factory=method("${type('fk')}","${method('fk','a(ZLjava/awt/Component;II)Lsc;')}",boolean.class,Component.class,int.class,int.class);
    Method initialize=method("${type('ve')}","${method('ve','a(ILjava/awt/Component;IB)V')}",int.class,Component.class,int.class,byte.class);
    Method draw=method("${type('ve')}","${method('ve','a(ILjava/awt/Graphics;II)V')}",int.class,Graphics.class,int.class,int.class);
    Field pixels=field("${type('sc')}","${field('sc','field_d','[I')}");
    Field image=field("${type('sc')}","${field('sc','field_e','Ljava/awt/Image;')}");
    for(int[] size:new int[][]{{1,1},{3,2},{5,7}})for(byte guard:new byte[]{127,117})
    for(int drawGuard:new int[]{0,1})for(int seed:new int[]{0,0xabcdef,0xff112233}) {
      int w=size[0],h=size[1];Canvas canvas=new Canvas();Object raster=factory.invoke(null,false,canvas,h,w);
      check(raster!=null&&raster.getClass()==Class.forName("${type('ve')}"));
      initialize.invoke(raster,h,canvas,w,guard);int[] data=(int[])pixels.get(raster);check(data.length==w*h+1);
      for(int i=0;i<data.length;i++)data[i]=seed^(i*65793);
      BufferedImage source=(BufferedImage)image.get(raster);check(((DataBufferInt)source.getRaster().getDataBuffer()).getData()==data);
      BufferedImage target=new BufferedImage(w+3,h+3,BufferedImage.TYPE_INT_RGB);Graphics graphics=target.getGraphics();
      try{draw.invoke(raster,1,graphics,2,drawGuard);}finally{graphics.dispose();}
      for(int y=0;y<h;y++)for(int x=0;x<w;x++)check((target.getRGB(x+2,y+1)&0xffffff)==(data[y*w+x]&0xffffff));
      check(target.getRGB(0,0)==0xff000000);System.out.println("raster:"+w+":"+h+":"+guard+":"+drawGuard+":"+seed+":"+data[data.length-1]);cases++;
    }
    check(factory.invoke(null,true,null,1,1)==null);System.out.println("suppressed-raster:null");cases++;
    check(cases==122);System.out.println("complete:"+cases);
  }
}`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'ReflectionBehavior.java');fs.writeFileSync(harnessFile, harness);
    const stub = path.join(root, 'funorb-stubs.jar'), cp = native ? nativeInput + path.delimiter + stub : stub;
    const sourceRoot = path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const sources = native ? [] : sourceInventory(sourceRoot).map(file => path.join(sourceRoot, file.path));
    const list = path.join(directory, 'sources.txt');fs.writeFileSync(list, [...sources, harnessFile].map(file => JSON.stringify(file)).join('\n') + '\n');
    captureProcess('javac', ['--release','8','-proc:none','-encoding','UTF-8','-classpath',cp,'-d',classes,'@'+list]);
    const output = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,'ReflectionBehavior']).stdout;
    const sha256 = crypto.createHash('sha256').update(output).digest('hex');
    console.log(JSON.stringify({variant, sha256, completion: output.toString().trim().split('\n').at(-1)}));
    assert.equal(sha256, expectedNativeSha256, variant);
    if (expected === undefined) expected = output;else assert.equal(Buffer.compare(output, expected),0,variant);
  }
} catch (error) {if(error.stderr)process.stderr.write(error.stderr);throw error;}
finally {fs.rmSync(temporary,{recursive:true,force:true});}
