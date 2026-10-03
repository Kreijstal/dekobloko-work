import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

// Drive real matching/scoring queues against an independent scoring oracle.
// Asset-dependent constructors are bypassed; contact physics and device audio
// are outside this probe. The optional third argument checks a candidate raw
// export without altering the published readable source or its native digest.

const root = publishedReadableRoot;
const nativeInput = process.argv[2] && path.resolve(process.argv[2]);
const rawInput = process.argv[3] && path.resolve(process.argv[3]);
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile))
  .renames.map(rule => [rule.symbol, rule.to]));
const expectedNativeSha256 = '222f18c6366fdab862f1d5d70980cb0a6f32b3adb6eba308c08846a473bac16a';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-match-scoring-'));
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
    const harness = `import java.lang.reflect.*; import java.util.*; import java.security.*;
      public class MatchScoringBehavior {
        static final Object unsafe; static final Method allocateInstance;
        static { try { Class<?> type=Class.forName("sun.misc.Unsafe");
          Field f=type.getDeclaredField("theUnsafe"); f.setAccessible(true); unsafe=f.get(null);
          allocateInstance=type.getMethod("allocateInstance",Class.class);
        } catch(Exception error) { throw new RuntimeException(error); } }
        static final Map<String,Field> fields=new HashMap<>();
        static Field field(String owner,String name) throws Exception {
          String key=owner+":"+name; Field f=fields.get(key);
          if(f==null) { f=Class.forName(owner).getDeclaredField(name); f.setAccessible(true); fields.put(key,f); }
          return f;
        }
        static Object get(String owner,String name,Object target) throws Exception { return field(owner,name).get(target); }
        static void set(String owner,String name,Object target,Object value) throws Exception { field(owner,name).set(target,value); }
        static Object allocate(String name) throws Exception { return allocateInstance.invoke(unsafe,Class.forName(name)); }
        static Object construct(String name,Class<?>[] types,Object... args) throws Exception {
          Constructor<?> c=Class.forName(name).getDeclaredConstructor(types); c.setAccessible(true); return c.newInstance(args);
        }
        static Method method(String owner,String name,Class<?>... types) throws Exception {
          Method m=Class.forName(owner).getDeclaredMethod(name,types); m.setAccessible(true); return m;
        }
        static Method add, size, first, next, collect, process, advance, emit, score, pending;
        static Object session, attached, active, available, audio, transientQueue;
        static Object[] entities, popups; static int[] packed;
        static MessageDigest trace;
        static int scenarios, ticks, successes;
        static void check(boolean value,String label) { if(!value) throw new AssertionError("case="+scenarios+":"+label); }
        static Object deque() throws Exception { return construct("${type('tf')}",new Class<?>[0]); }
        static int count(Object queue) throws Exception { return (Integer)size.invoke(queue,100); }
        static int identity(Object node,Object[] values) {
          for(int i=0;i<values.length;i++) if(node==values[i]) return i; return -1;
        }
        static void snapshot(String label) throws Exception {
          StringBuilder line=new StringBuilder(label);
          ${[['field_o','I'],['field_A','I'],['field_X','Ljava/lang/StringBuilder;'],['field_g','Ljava/lang/StringBuilder;'],['field_T','I'],['field_y','I'],['field_K','Z']].map(([f,d])=>`line.append(':').append(${get('gh',f,d,'session')});`).join('\n')}
          ${[['gf','field_f'],['h','field_a'],['dd','field_D'],['dk','field_b'],['oa','field_a'],['ml','field_r'],['pa','field_g'],['nd','field_a'],['uf','field_b'],['ka','field_h']].map(([o,f])=>`line.append(':').append(${get(o,f,'I')});`).join('\n')}
          line.append(':').append(Arrays.toString(packed));
          for(Object entity:entities) {
            Object queue=${get('ja','field_K','Ltf;','entity')};
            line.append(':').append(queue==null?0:queue==transientQueue?1:2);
          }
          for(Object popup:popups) {
            ${[['field_f','I'],['field_h','I'],['field_m','Ljava/lang/String;']].map(([f,d])=>`line.append(':').append(${get('me',f,d,'popup')});`).join('\n')}
            ${['field_n','field_i','field_k'].map(f=>`line.append(':').append(Float.floatToRawIntBits((Float)${get('me',f,'F','popup')}));`).join('\n')}
          }
          for(Object queue:new Object[]{active,available}) {
            line.append(':').append(count(queue)).append('[');
            Object node=first.invoke(queue,0); int walked=0;
            while(node!=null) { line.append(identity(node,popups)).append(','); node=next.invoke(queue,1); check(++walked<=popups.length,"queue cycle"); }
            line.append(']');
          }
          line.append(':').append(count(audio));
          trace.update((line.toString()+"\\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        static void setup(int pool,boolean tutorial,int initialScore,int counterMode) throws Exception {
          trace=MessageDigest.getInstance("SHA-256");
          session=allocate("${type('gh')}");
          ${set('el','field_o','Lgh;','null','session')}
          ${set('Geoblox','field_C','I','null','0')}
          ${set('gh','field_Y','Z','session','tutorial')}
          ${set('gh','field_o','I','session','initialScore')}
          ${set('gh','field_X','Ljava/lang/StringBuilder;','session','new StringBuilder(Integer.toString(initialScore))')}
          ${set('gh','field_g','Ljava/lang/StringBuilder;','session','new StringBuilder("0")')}
          ${set('gh','field_T','I','session','463')}
          ${set('oa','field_a','I','null','50')}
          ${set('ml','field_r','I','null','90')}
          ${set('kd','field_c','I','null','counterMode')}
          ${set('da','field_a','I','null','0')}
          ${set('vl','field_p','I','null','-1')}
          ${set('wb','field_b','I','null','0')}
          ${set('w','field_f','Z','null','false')}
          ${set('dd','field_D','I','null','0')}
          ${set('dk','field_b','I','null','0')}
          ${set('pa','field_g','I','null','0')}
          ${set('ka','field_h','I','null','0')}
          ${set('nd','field_a','I','null','0')}
          ${set('uf','field_b','I','null','3')}
          attached=deque(); active=deque(); available=deque(); audio=deque(); transientQueue=deque();
          ${set('a','field_d','Ltf;','null','attached')}
          ${set('md','field_a','Ltf;','null','active')}
          ${set('ue','field_f','Ltf;','null','available')}
          ${set('qa','field_f','Ltf;','null','audio')}
          ${set('bh','field_c','Ltf;','null','transientQueue')}
          ${set('ge','field_d','Lob;','null','construct("'+type('ob')+'",new Class<?>[0])')}
          ${set('qk','field_j','I','null','22050')}
          Object sample=construct("${type('gd')}",new Class<?>[]{int.class,byte[].class,int.class,int.class},22050,new byte[32],0,32);
          Object samples=Array.newInstance(Class.forName("${type('gd')}"),33);
          for(int i=0;i<33;i++) Array.set(samples,i,sample);
          ${set('fl','field_c','[Lgd;','null','samples')}
          popups=new Object[pool];
          for(int i=0;i<pool;i++) { popups[i]=construct("${type('me')}",new Class<?>[0]); add.invoke(available,-35,popups[i]); }
          packed=new int[32]; entities=new Object[0];
          ${set('nk','field_f','[I','null','packed')}
          ${set('h','field_a','I','null','0')}
        }
        static String hex(byte[] bytes) { StringBuilder result=new StringBuilder(); for(byte b:bytes) result.append(String.format("%02x",b&255)); return result.toString(); }
        static void finish(String label) throws Exception { snapshot("final"); System.out.println(label+":"+scenarios+":"+hex(trace.digest())); scenarios++; }
        static int drain() throws Exception {
          int elapsed=0;
          while(count(active)>0) { check(elapsed<400,"popup timeout"); advance.invoke(null,(byte)27); snapshot("tick:"+(++elapsed)); ticks++; }
          return elapsed;
        }
        static class Oracle {
          int total,popupTotal,left=50,right=90,mode; boolean tutorial;
          String scoreText,popupText="0";
          Oracle(int score,int mode,boolean tutorial) {
            total=score;this.mode=mode;this.tutorial=tutorial;scoreText=Integer.toString(score);
          }
          static String overwritePrefix(String old,String replacement) {
            return replacement.length()<old.length() ? replacement+old.substring(replacement.length()) : replacement;
          }
          void credit(int points) {
            if(tutorial) return; total+=points;
            scoreText=overwritePrefix(scoreText,Integer.toString(Math.min(total,9999999)));
            if(mode%3==0) left+=points;
            else if(mode%3==1) right-=points;
            else { left+=points/3; right-=points-points/3; }
          }
          void popup(int points) {
            if(!tutorial) { popupTotal+=points;popupText=overwritePrefix(popupText,Integer.toString(Math.min(popupTotal,99999))); }
          }
          void verify(String label) throws Exception {
            check((Integer)${get('gh','field_o','I','session')}==total,label+":score");
            check((Integer)${get('gh','field_A','I','session')}==popupTotal,label+":pending");
            check(${get('gh','field_X','Ljava/lang/StringBuilder;','session')}.toString().equals(scoreText),label+":score display cap");
            check(${get('gh','field_g','Ljava/lang/StringBuilder;','session')}.toString().equals(popupText),label+":pending display cap");
            check((Integer)${get('oa','field_a','I')}==left,label+":left counter");
            check((Integer)${get('ml','field_r','I')}==right,label+":right counter");
          }
        }
        public static void main(String[] args) throws Exception {
          Thread watchdog=new Thread(() -> { try { Thread.sleep(45000); System.err.println("match probe timeout"); System.exit(91); } catch(InterruptedException error) {} }); watchdog.setDaemon(true); watchdog.start();
          Class<?> node=Class.forName("${type('hf')}");
          add=method("${type('tf')}","${method('tf','a(ILhf;)V')}",int.class,node);
          size=method("${type('tf')}","${method('tf','a(I)I')}",int.class);
          first=method("${type('tf')}","${method('tf','g(I)Lhf;')}",int.class);
          next=method("${type('tf')}","${method('tf','d(I)Lhf;')}",int.class);
          collect=method("${type('ul')}","${method('ul','b(I)V')}",int.class);
          process=method("${type('ec')}","${method('ec','b(I)Z')}",int.class);
          advance=method("${type('cf')}","${method('cf','d(B)V')}",byte.class);
          emit=method("${type('gh')}","${method('gh','c(Z)V')}",boolean.class);
          score=method("${type('gh')}","${method('gh','a(BI)V')}",byte.class,int.class);
          pending=method("${type('gh')}","${method('gh','a(II)V')}",int.class,int.class);
          int[][] colors={{1,1,1,1},{1,1,1,1},{0,1,2,3},{0,1,2,3},{1,1,1,2},{1,1,1,1}};
          int[][] shapes={{2,2,2,2},{0,1,2,3},{2,2,2,2},{0,1,2,3},{2,2,3,3},{2,2,2,2}};
          int[] ids={7,2,9,4};
          for(int pattern=0;pattern<6;pattern++) for(int graph=0;graph<3;graph++)
          for(int blocked=0;blocked<3;blocked++) for(int pool:new int[]{0,1,6})
          for(int initialChain:new int[]{0,6}) for(boolean tutorial:new boolean[]{false,true}) {
            int initialScore=scenarios%3==0?9999990:scenarios%3==1?Integer.MAX_VALUE-100:17;
            int mode=new int[]{-1,0,1,2,4}[scenarios%5];
            setup(pool,tutorial,initialScore,mode); Oracle oracle=new Oracle(initialScore,mode,tutorial);
            ${set('gf','field_f','I','null','initialChain')}
            entities=new Object[4]; Object byId=Array.newInstance(Class.forName("${type('ja')}"),10);
            for(int i=0;i<4;i++) { entities[i]=allocate("${type('ja')}"); Array.set(byId,ids[i],entities[i]); add.invoke(attached,-35,entities[i]); }
            ${set('tl','field_g','[Lja;','null','byId')}
            List<Integer> expectedPacked=new ArrayList<>(); int variantCount=0,categoryCount=0; boolean dual=false;
            for(int i=0;i<4;i++) {
              Object entity=entities[i]; List<Integer> neighbors=new ArrayList<>();
              for(int j=0;j<4;j++) if(i!=j && (graph==0 || graph==1&&(i==0||j==0) || graph==2&&Math.abs(i-j)==1)) neighbors.add(j);
              Object related=Array.newInstance(Class.forName("${type('ja')}"),neighbors.size()); int sameColor=0,sameShape=0;
              for(int j=0;j<neighbors.size();j++) { int n=neighbors.get(j); Array.set(related,j,entities[n]); if(colors[pattern][i]==colors[pattern][n])sameColor++; if(shapes[pattern][i]==shapes[pattern][n])sameShape++; }
              ${set('ja','field_H','I','entity','ids[i]')}
              ${set('ja','field_C','I','entity','colors[pattern][i]')}
              ${set('ja','field_M','I','entity','shapes[pattern][i]')}
              ${set('ja','field_N','I','entity','sameColor')}
              ${set('ja','field_m','I','entity','sameShape')}
              ${set('ja','field_L','I','entity','neighbors.size()')}
              ${set('ja','field_n','[Lja;','entity','related')}
              ${set('ja','field_E','I','entity','blocked==1&&i==0?1:blocked==2&&i==2?2:0')}
              ${set('ja','field_o','F','entity','319.75f+i*7.5f')}
              ${set('ja','field_v','F','entity','-3.75f-i*5.25f')}
              for(int j=0;j<neighbors.size();j++) for(int k=j+1;k<neighbors.size();k++) {
                int a=neighbors.get(j),b=neighbors.get(k);
                boolean color=sameColor>1 && colors[pattern][i]==colors[pattern][a] && colors[pattern][i]==colors[pattern][b];
                boolean shape=sameShape>1 && shapes[pattern][i]==shapes[pattern][a] && shapes[pattern][i]==shapes[pattern][b];
                if(color||shape) { int[] triple={ids[i],ids[a],ids[b]}; Arrays.sort(triple);
                  expectedPacked.add((triple[2]<<20)|(triple[1]<<10)|triple[0]|(color?Integer.MIN_VALUE:0)|(shape?0x40000000:0));
                  if(color)categoryCount++; if(shape)variantCount++; if(color&&shape)dual=true;
                }
              }
            }
            snapshot("before"); collect.invoke(null,-2); snapshot("collected");
            check((Integer)${get('h','field_a','I')}==expectedPacked.size(),"collected count");
            for(int i=0;i<expectedPacked.size();i++) check(packed[i]==expectedPacked.get(i),"packed IDs/flags/order");
            check((Integer)${get('dd','field_D','I')}==variantCount,"variant counter");
            check((Integer)${get('dk','field_b','I')}==categoryCount,"category counter");
            List<Integer> awards=new ArrayList<>(); int chain=initialChain;
            for(int candidate:new TreeSet<>(expectedPacked)) {
              boolean eligible=true;
              for(int id:new int[]{(candidate>>>20)&1023,(candidate>>>10)&1023,candidate&1023})
                if((Integer)${get('ja','field_E','I','Array.get(byId,id)')}>0) eligible=false;
              if(eligible) awards.add((candidate>>>30==3?90:30)*++chain);
            }
            check((Boolean)process.invoke(null,-18913)==!expectedPacked.isEmpty(),"batch return");
            snapshot("processed");
            check((Integer)${get('gf','field_f','I')}==chain,"chain advances once per eligible distinct candidate");
            check((Integer)${get('h','field_a','I')}==0,"batch consumed");
            for(int candidate:packed) check(candidate==0,"candidate cleared");
            int queued=Math.min(pool,awards.size());
            for(int i=queued;i<awards.size();i++) oracle.credit(awards.get(i));
            oracle.verify("before animation"); check(count(active)==queued,"bounded popup pool");
            successes+=awards.size(); int elapsed=drain();
            if(queued>0) { float progress=0; int expectedTicks=0; while(progress<1) {progress+=0.03999999910593033f*progress+0.00004999999873689376f;expectedTicks++;} check(elapsed==expectedTicks+1,"credit occurs after crossing tick"); }
            for(int i=0;i<queued;i++) { if(initialChain+i+1==1)oracle.credit(awards.get(i));else oracle.popup(awards.get(i)); }
            oracle.verify("after animation"); check(count(available)==pool,"popup identities recycled");
            int emitted=oracle.popupTotal; emit.invoke(session,scenarios%2==0); snapshot("emitted");
            oracle.popupTotal=0; if(emitted!=0&&pool==0)oracle.credit(emitted); drain(); if(emitted!=0&&pool>0)oracle.credit(emitted);
            oracle.verify("after panel credit");
            check((Boolean)${get('gh','field_K','Z','session')}==(emitted!=0&&scenarios%2==0),"submission guard only on emitted points");
            finish("match");
          }
          for(int attachments:new int[]{0,1,4}) for(boolean shock:new boolean[]{false,true}) for(int panel:new int[]{463,480}) {
            setup(1,false,10,0); ${set('wb','field_b','I','null','attachments')}
            ${set('w','field_f','Z','null','shock')}
            ${set('gf','field_f','I','null','7')}
            ${set('gh','field_T','I','session','panel')}
            ${set('gh','field_A','I','session','193')}
            check(!(Boolean)process.invoke(null,-18913),"empty batch return"); snapshot("empty");
            boolean reset=attachments>0&&!shock, flush=reset&&panel==463;
            check((Integer)${get('gf','field_f','I')}==(reset?0:7),"chain reset gate");
            check((Integer)${get('gh','field_y','I','session')}==(flush?1:0),"panel direction");
            check((Integer)${get('gh','field_A','I','session')}==(flush?0:193),"pending flush gate");
            drain(); finish("empty");
          }
          for(float progress:new float[]{-1,0,0.99999f,1,Float.NaN,Float.POSITIVE_INFINITY})
          for(int multiplier:new int[]{-3,0,1,2}) for(boolean tutorial:new boolean[]{false,true}) {
            setup(1,tutorial,9999995,2); Object popup=popups[0];
            ${set('me','field_k','F','popup','progress')}
            ${set('me','field_f','I','popup','17')}
            ${set('me','field_h','I','popup','multiplier')}
            ${set('gh','field_A','I','session','99990')}
            add.invoke(active,-35,popup); Oracle oracle=new Oracle(9999995,2,tutorial); oracle.popupTotal=99990;
            advance.invoke(null,(byte)27); snapshot("edge credit");
            if(progress>=1) { if(multiplier==1)oracle.credit(17);else oracle.popup(17); }
            oracle.verify("progress edge"); check(count(active)==(progress>=1?0:1),"progress comparison including NaN"); finish("edge");
          }
          System.out.println("complete:"+scenarios+":"+successes+":"+ticks);
        }
      }`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'MatchScoringBehavior.java');
    fs.writeFileSync(harnessFile, harness);
    const stub = path.join(root, 'funorb-stubs.jar');
    const cp = native ? nativeInput + path.delimiter + stub : stub;
    const sourceRoot = !renamed && rawInput ? rawInput : path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const sources = native ? [] : sourceInventory(sourceRoot).map(file => path.join(sourceRoot, file.path));
    const list = path.join(directory, 'sources.txt');
    fs.writeFileSync(list, [...sources, harnessFile].map(file => JSON.stringify(file)).join('\n') + '\n');
    captureProcess('javac', ['--release','8','-proc:none','-encoding','UTF-8','-classpath',cp,'-d',classes,'@'+list]);
    const output = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'MatchScoringBehavior']).stdout;
    const sha256 = crypto.createHash('sha256').update(output).digest('hex');
    console.log(JSON.stringify({variant, sha256, completion: output.toString().trim().split('\n').at(-1)}));
    assert.equal(sha256, expectedNativeSha256, variant);
    if (expected === undefined) expected = output;
    else assert.equal(Buffer.compare(output, expected), 0, variant);
  }
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
