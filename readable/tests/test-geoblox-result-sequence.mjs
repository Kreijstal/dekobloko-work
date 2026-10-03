import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

const root = publishedReadableRoot;
const nativeInput = process.argv[2] && path.resolve(process.argv[2]);
const rawInput = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root,'../games/geoblox');
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile))
  .renames.map(rule => [rule.symbol, rule.to]));
const expectedNativeSha256 = '7b5891a65a952e19dbf395fb064530df9386712028f2a90eaf2afa5fa22dbb18';
const diagnostics = process.env.GEOBLOX_RESULT_PROBE_DIAGNOSTICS;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-result-sequence-'));
try {
  if (nativeInput) {
    const files = [];
    const visit = directory => {
      for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
        const file = path.join(directory, item.name);
        if (item.isDirectory()) visit(file);
        else if (item.name.endsWith('.class')) files.push(file);
      }
    };
    visit(nativeInput);
    const hash = crypto.createHash('sha256');
    for (const file of files.sort()) {
      const name = Buffer.from(path.relative(nativeInput, file).split(path.sep).join('/'));
      const bytes = fs.readFileSync(file);
      hash.update(name.length + ':'); hash.update(name);
      hash.update(bytes.length + ':'); hash.update(bytes);
    }
    const pin = JSON.parse(fs.readFileSync(path.join(root, '../decompilation/geoblox-provenance.json')))
      .verifiedTransformedClasses;
    assert.equal(files.length, pin.files);
    assert.equal(hash.digest('hex'), pin.sha256);
  }
  let expected;
  for (const variant of [...(nativeInput ? ['native'] : []), 'original', 'renamed']) {
    const native = variant === 'native', renamed = variant === 'renamed';
    const name = (symbol, original) => renamed ? aliases.get(symbol) ?? original : original;
    const type = original => name('C:' + original, original);
    const field = (owner, original, descriptor) => native ? original.replace(/^field_/, '')
      : name(`F:${owner}.${original}:${descriptor}`, original);
    const method = (owner, signature) => name('M:' + owner + '.' + signature, signature.split('(')[0]);
    const get = (owner, original, descriptor, instance = 'null') =>
      `get("${type(owner)}", "${field(owner, original, descriptor)}", ${instance})`;
    const set = (owner, original, descriptor, instance, value) =>
      `set("${type(owner)}", "${field(owner, original, descriptor)}", ${instance}, ${value});`;
    const sessionFields = [['field_D','I'], ['field_bb','I'], ['field_q','I'], ['field_c','I'],
      ['field_S','I'], ['field_W','I'], ['field_ab','I'], ['field_H','Z'], ['field_R','Z'],
      ['field_B','Z'], ['field_y','I'], ['field_e','I'], ['field_o','I']];
    const popupFields = [['field_f','I'], ['field_h','I'], ['field_n','F'], ['field_i','F'],
      ['field_k','F'], ['field_m','Ljava/lang/String;']];
    const harness = `import java.lang.reflect.*; import java.nio.*; import java.security.*;
      import java.util.*;
      public class ResultSequenceBehavior {
        static final Object unsafe;
        static final Method allocateInstance;
        static { try { Class<?> type = Class.forName("sun.misc.Unsafe");
          Field f = type.getDeclaredField("theUnsafe"); f.setAccessible(true); unsafe = f.get(null);
          allocateInstance = type.getMethod("allocateInstance",Class.class);
        } catch (Exception error) { throw new RuntimeException(error); } }
        static final Map<String,Field> fields = new HashMap<>();
        static Object get(String owner, String name, Object instance) throws Exception {
          return field(owner,name).get(instance);
        }
        static void set(String owner, String name, Object instance, Object value) throws Exception {
          field(owner,name).set(instance,value);
        }
        static Field field(String owner,String name) throws Exception {
          String key = owner+":"+name; Field f = fields.get(key);
          if (f == null) { f = Class.forName(owner).getDeclaredField(name);
            f.setAccessible(true); fields.put(key,f); } return f;
        }
        static Object allocate(String name) throws Exception {
          return allocateInstance.invoke(unsafe,Class.forName(name));
        }
        static Object construct(String name,Class<?>[] types,Object... args) throws Exception {
          Constructor<?> c = Class.forName(name).getDeclaredConstructor(types); c.setAccessible(true);
          return c.newInstance(args);
        }
        static Object deque() throws Exception { return construct("${type('tf')}",new Class<?>[0]); }
        static final Method add, count, update;
        static { try {
          add = Class.forName("${type('tf')}").getDeclaredMethod("${method('tf','a(ILhf;)V')}",
            int.class,Class.forName("${type('hf')}")); add.setAccessible(true);
          count = Class.forName("${type('tf')}").getDeclaredMethod("${method('tf','a(I)I')}",int.class);
          count.setAccessible(true);
          update = Class.forName("${type('gh')}").getDeclaredMethod("${method('gh','f(I)V')}",int.class);
          update.setAccessible(true);
        } catch (Exception error) { throw new RuntimeException(error); } }
        static int count(Object queue) throws Exception { return (Integer)count.invoke(queue,100); }
        static Object sprite(int width,int height) throws Exception {
          return construct("${type('dm')}",new Class<?>[]{int.class,int.class},width,height);
        }
        static String digest(int[] pixels) throws Exception {
          ByteBuffer data = ByteBuffer.allocate(pixels.length*4);
          for (int pixel:pixels) data.putInt(pixel);
          StringBuilder s = new StringBuilder();
          for (byte b:MessageDigest.getInstance("SHA-256").digest(data.array()))
            s.append(String.format("%02x",b&255)); return s.toString();
        }
        public static void main(String[] args) throws Exception {
          Thread main=Thread.currentThread();
          Thread watchdog=new Thread(()-> {
            try { Thread.sleep(20000); } catch(InterruptedException ignored) { return; }
            System.err.println("Result-sequence watchdog: method did not finish");
            for(StackTraceElement frame:main.getStackTrace()) System.err.println(frame);
            System.exit(2);
          }); watchdog.setDaemon(true); watchdog.start();
          int scenarios=0, ticks=0;
          for(int entities:new int[]{0,1,3}) for(int pattern:new int[]{-1,0,1})
          for(float angle:new float[]{0.0f,0.25f,1.2f}) {
            Object session=allocate("${type('gh')}");
            ${set('el','field_o','Lgh;','null','session')}
            ${set('Geoblox','field_C','I','null','0')}
            ${set('gh','field_H','Z','session','true')}
            ${set('gh','field_bb','I','session','1')}
            ${set('gh','field_q','I','session','121')}
            ${set('gh','field_ab','I','session','480')}
            ${set('gh','field_y','I','session','-7')}
            ${set('gh','field_B','Z','session','true')}
            ${set('gh','field_K','Z','session','true')}
            ${set('gh','field_X','Ljava/lang/StringBuilder;','session','new StringBuilder()')}
            ${set('gh','field_g','Ljava/lang/StringBuilder;','session','new StringBuilder()')}
            ${set('vl','field_p','I','null','-1')}
            ${set('af','field_c','I','null','10000')}
            ${set('qf','field_bb','Lrf;','null','null')}
            ${set('gf','field_f','I','null','99')}
            Object attached=deque(), active=deque(), available=deque(), audio=deque();
            ${set('a','field_d','Ltf;','null','attached')}
            ${set('md','field_a','Ltf;','null','active')}
            ${set('ue','field_f','Ltf;','null','available')}
            ${set('qa','field_f','Ltf;','null','audio')}
            ${set('ge','field_d','Lob;','null','construct("'+type('ob')+'",new Class<?>[0])')}
            ${set('qk','field_j','I','null','22050')}
            Object sample=construct("${type('gd')}",
              new Class<?>[]{int.class,byte[].class,int.class,int.class},22050,new byte[32],0,32);
            Object samples=Array.newInstance(Class.forName("${type('gd')}"),33);
            Array.set(samples,28,sample);
            ${set('fl','field_c','[Lgd;','null','samples')}
            ${set('lj','field_d','Ldm;','null','sprite(40,8)')}
            Object scratch=sprite(9,9);
            ${set('vf','field_L','Ldm;','null','scratch')}
            Object display=allocate("${type('bf')}");
            ${set('sc','field_a','I','display','640')}
            ${set('sc','field_c','I','display','480')}
            int[] displayPixels=new int[640*480];
            ${set('sc','field_d','[I','display','displayPixels')}
            ${set('sh','field_y','Lsc;','null','display')}
            Method selectDisplay=Class.forName("${type('sc')}")
              .getDeclaredMethod("${method('sc','a(I)V')}",int.class);
            selectDisplay.setAccessible(true); selectDisplay.invoke(display,255);
            Object[] popups=new Object[3];
            for(int i=0;i<popups.length;i++) {
              popups[i]=construct("${type('me')}",new Class<?>[0]);
              add.invoke(available,-35,popups[i]);
            }
            for(int i=0;i<entities;i++) {
              Object entity=allocate("${type('ja')}"), image=sprite(5,7);
              int[] pixels=(int[])${get('dm','field_v','[I','image')};
              if(pattern!=0) for(int p=0;p<pixels.length;p++)
                if(p%3!=1) pixels[p]=0x112233+p;
              ${set('ja','field_o','F','entity','pattern==-1?320.0f:343.0f+i*6')}
              ${set('ja','field_v','F','entity','pattern==-1?240.0f:247.0f-i*2')}
              ${set('ja','field_u','F','entity','angle')}
              ${set('ja','field_J','Ldm;','entity','image')}
              add.invoke(attached,-35,entity);
            }
            int seen=0, scenarioTicks=0;
            for(int tick=0;tick<1200;tick++) {
              try { update.invoke(session,10); }
              catch(InvocationTargetException error) { throw new AssertionError(
                "scenario="+scenarios+",tick="+tick,error.getCause()); }
              ticks++; scenarioTicks++;
              int phase=(Integer)${get('gh','field_bb','I','session')}; seen|=1<<phase;
              StringBuilder line=new StringBuilder().append(scenarios).append(':').append(tick);
              ${sessionFields.map(([f,d])=>`line.append(':').append(${get('gh',f,d,'session')});`).join('\n')}
              line.append(':').append(${get('gf','field_f','I')});
              line.append(':').append(${get('af','field_c','I')});
              line.append(':').append(count(audio)).append(':').append(count(active))
                .append(':').append(count(available));
              for(Object popup:popups) {
                ${popupFields.map(([f,d])=>`line.append(':').append(${get('me',f,d,'popup')});`).join('\n')}
              }
              System.out.println(line);
              if(tick==0) {
                if((Integer)${get('gh','field_q','I','session')}!=300) throw new AssertionError("initial bonus");
                ${set('gh','field_H','Z','session','false')}
                System.out.println("pixels:"+scenarios+":"+digest((int[])${get('dm','field_v','[I','scratch')}));
                if(${get('vb','field_c','[I')}!=displayPixels) throw new AssertionError("display restoration");
              }
              if(phase==5) {
                if(!(Boolean)${get('gh','field_H','Z','session')}) throw new AssertionError("transition");
                if((Integer)${get('gh','field_D','I','session')}!=0) throw new AssertionError("tick reset");
                if(count(active)!=(entities==0?2:1)) throw new AssertionError("completion popups");
                break;
              }
            }
            if(seen!=((1<<2)|(1<<3)|(1<<4)|(1<<5))) throw new AssertionError("phases="+seen);
            if(scenarioTicks==1200) throw new AssertionError("sequence did not complete");
            scenarios++;
          }
          if(scenarios!=27) throw new AssertionError(scenarios);
          System.out.println("complete:"+scenarios+":"+ticks);
        }
      }`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'ResultSequenceBehavior.java');
    fs.writeFileSync(harnessFile, harness);
    const stub = path.join(root, 'funorb-stubs.jar');
    const cp = native ? nativeInput + path.delimiter + stub : stub;
    const sourceRoot = renamed ? path.join(root,'geoblox/src') : rawInput;
    const sources = native ? [] : sourceInventory(sourceRoot).map(file=>path.join(sourceRoot,file.path));
    const list = path.join(directory,'sources.txt');
    fs.writeFileSync(list,[...sources,harnessFile].map(file=>JSON.stringify(file)).join('\n')+'\n');
    captureProcess('javac',['--release','8','-proc:none','-encoding','UTF-8','-classpath',cp,'-d',classes,'@'+list]);
    const output = captureProcess('java',['-Djava.awt.headless=true','-cp',classes+path.delimiter+cp,
      'ResultSequenceBehavior']).stdout;
    const sha256 = crypto.createHash('sha256').update(output).digest('hex');
    if(diagnostics) {
      fs.mkdirSync(diagnostics,{recursive:true});
      fs.writeFileSync(path.join(diagnostics,variant+'-output.txt'),output);
    }
    let mismatch = '';
    if(expected && sha256 !== expectedNativeSha256) {
      const oldLines=expected.toString().split('\n'), newLines=output.toString().split('\n');
      const index=oldLines.findIndex((line,i)=>line!==newLines[i]);
      mismatch=`; first difference at line ${index+1}: native=${oldLines[index]}; rebuilt=${newLines[index]}`;
    }
    assert.equal(sha256,expectedNativeSha256,variant+mismatch);
    if(expected === undefined) expected=output; else assert.equal(Buffer.compare(output,expected),0,variant);
    console.log(JSON.stringify({variant,sha256,completion:output.toString().trim().split('\n').at(-1)}));
  }
} catch(error) {
  if(error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
