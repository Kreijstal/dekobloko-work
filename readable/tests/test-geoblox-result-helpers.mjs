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
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile))
  .renames.map(rule => [rule.symbol, rule.to]));
const expectedNativeSha256 = 'ec3c627a2eec22d24549607b97ae8c3b6d735e24217b26c61e8a5e510872ace6';
const expectedCacheWriteSha256 = 'e5d3ac6ab42a61da22e44337bc05b64e89e0360d4d51a94256fff69d3a37081d';
const expectedShutdownSha256 = '2fec6ee86681993c79d39ef1e57026f31fd9b0a87b7d7f94a5bddf5af83d6335';
const expectedSocketIoSha256 = 'ed8f7d5f5438f4fb39cb3bceca82a861d01f4e08502ca73ba7af8ca475b6292b';
const expectedDispatcherShutdownSha256 = '86554dba87ac6740912bf88fcd328c871758629250b6277e4223e4955bfcfb29';
const expectedInputSha256 = 'f8fe8768fbba9c94298f8e9a9193605681295cdd49d1eeba47929c208634844e';
const expectedArchiveSectorSha256 = '77dc4b47188f20793aaecb76f198e59850d0fc3d8af0ca07b2d0a111719a869b';
const expectedArchiveCompressionSha256 = '191d74dde65e8e0a6b5dc72a0193765baa165a94ab82ef5df15f10d86fd6f8fe';
const expectedBzip2BlockSha256 = 'f237b1b6fd8e69c006fa43ec005f742ae5909d107d0ba5ec4574f2c804ad3ba9';
const expectedMusicScoreSha256 = 'dbb5328e2411eeac81a8c9f515fb6ab1cd3f07f56a2bca7ffda0508a6f444ff4';
const expectedInstrumentPatchSha256 = '632bd2079878bac0a78c60d5bce99a688b1fdc552641b56dd62ad9d21e7d5b24';
const expectedFrameTimerSha256 = 'ede4d1133daada42504bf8fe04c675cbbde84af1a2e59b7793339f7210538df8';
let expectedFrameTimerBaseline;
const expectedSynthesizedSoundSha256 = '5940267c23617214e39dc820f851b313492cc7e3c5950144a2d34ffb1a75d62b';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-result-helpers-'));
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
  let expected, expectedArchiveSectorSha256Baseline, expectedArchiveCompressionBaseline, expectedBzip2BlockBaseline, expectedMusicScoreBaseline, expectedInstrumentPatchBaseline, expectedSynthesizedSoundBaseline;
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
    const harness = `import java.lang.reflect.*; import java.util.*;
      public class ResultHelperBehavior {
        static final Object unsafe; static final Method allocateInstance;
        static { try { Class<?> type = Class.forName("sun.misc.Unsafe");
          Field f = type.getDeclaredField("theUnsafe"); f.setAccessible(true); unsafe = f.get(null);
          allocateInstance = type.getMethod("allocateInstance",Class.class);
        } catch(Exception error) { throw new RuntimeException(error); } }
        static final Map<String,Field> fields = new HashMap<>();
        static Field field(String owner,String name) throws Exception {
          String key=owner+":"+name; Field f=fields.get(key);
          if(f==null) { f=Class.forName(owner).getDeclaredField(name); f.setAccessible(true);
            fields.put(key,f); } return f;
        }
        static Object get(String owner,String name,Object instance) throws Exception {
          return field(owner,name).get(instance);
        }
        static void set(String owner,String name,Object instance,Object value) throws Exception {
          field(owner,name).set(instance,value);
        }
        static Object allocate(String name) throws Exception {
          return allocateInstance.invoke(unsafe,Class.forName(name));
        }
        static Object construct(String name,Class<?>[] types,Object... args) throws Exception {
          Constructor<?> c=Class.forName(name).getDeclaredConstructor(types); c.setAccessible(true);
          return c.newInstance(args);
        }
        static Method method(String owner,String name,Class<?>... types) throws Exception {
          Method m=Class.forName(owner).getDeclaredMethod(name,types); m.setAccessible(true); return m;
        }
        static void check(boolean value,String label) { if(!value) throw new AssertionError(label); }
        public static void main(String[] args) throws Exception {
          int selectorCases=0, factoryCases=0, positionChecks=0, musicCases=0;
          Method add=method("${type('tf')}","${method('tf','a(ILhf;)V')}",int.class,Class.forName("${type('hf')}"));
          Method count=method("${type('tf')}","${method('tf','a(I)I')}",int.class);
          Method select=method("${type('i')}","${method('i','a(B)Lja;')}",byte.class);
          float[][] shapes={ {}, {320,240}, {Float.NaN,240}, {320+Float.MIN_VALUE,240},
            {321,240}, {323,244,317,236}, {321,240,340,240,330,240},
            {Float.NaN,240,320,241,Float.POSITIVE_INFINITY,240},
            {Float.POSITIVE_INFINITY,240,Float.NEGATIVE_INFINITY,240,340,240},
            {321,240,320,240,Float.NaN,240} };
          for(int shape=0;shape<shapes.length;shape++) for(int guard:new int[]{0,1,-1})
          for(byte methodGuard:new byte[]{-128,-127,0,127}) {
            Object queue=construct("${type('tf')}",new Class<?>[0]);
            ${set('a','field_d','Ltf;','null','queue')}
            ${set('Geoblox','field_C','I','null','guard')}
            Object mask=construct("${type('dm')}",new Class<?>[]{int.class,int.class},1,1);
            ${set('i','field_a','Ldm;','null','mask')}
            float[] coordinates=shapes[shape]; Object[] entities=new Object[coordinates.length/2];
            for(int i=0;i<entities.length;i++) {
              Object entity=allocate("${type('ja')}"); entities[i]=entity;
              ${set('ja','field_o','F','entity','coordinates[i*2]')}
              ${set('ja','field_v','F','entity','coordinates[i*2+1]')}
              add.invoke(queue,-35,entity);
            }
            int wanted=-1; float max=Float.MIN_VALUE;
            for(int i=entities.length-1;i>=0;i--) {
              float x=coordinates[i*2]-320, y=coordinates[i*2+1]-240;
              float distance=x*x+y*y;
              if(distance>max) { max=distance; wanted=i; }
              if(guard!=0) break;
            }
            Object selected=select.invoke(null,methodGuard); int actual=-1;
            for(int i=0;i<entities.length;i++) if(entities[i]==selected) actual=i;
            check(actual==wanted,"selector identity "+selectorCases);
            boolean maskCleared=${get('i','field_a','Ldm;')}==null;
            check(maskCleared==(methodGuard>=-127),"selector guard side effect");
            check((Integer)count.invoke(queue,100)==entities.length,"selector retains queue");
            for(int i=0;i<entities.length;i++) {
              check(Float.floatToRawIntBits((Float)${get('ja','field_o','F','entities[i]')})==
                Float.floatToRawIntBits(coordinates[i*2]),"selector retains x");
              check(Float.floatToRawIntBits((Float)${get('ja','field_v','F','entities[i]')})==
                Float.floatToRawIntBits(coordinates[i*2+1]),"selector retains y");
            }
            System.out.println("select:"+shape+":"+guard+":"+methodGuard+":"+actual+":"+maskCleared);
            selectorCases++;
          }
          ${set('Geoblox','field_C','I','null','0')}
          Class<?> sampleType=Class.forName("${type('gd')}");
          Method create=method("${type('kl')}","${method('kl','a(Lgd;II)Lkl;')}",sampleType,int.class,int.class);
          Method outside=method("${type('kl')}","${method('kl','l()Z')}");
          for(int rate:new int[]{0,8000,22050,48000,Integer.MAX_VALUE})
          for(int outputRate:new int[]{0,8000,22050,48000})
          for(int percent:new int[]{-100,0,50,100,200,Integer.MAX_VALUE})
          for(int volume:new int[]{0,45,96,-1,Integer.MIN_VALUE})
          for(int length:new int[]{-1,0,1,8}) for(boolean bounce:new boolean[]{false,true}) {
            byte[] samples=length<0?null:new byte[length];
            if(samples!=null) for(int i=0;i<samples.length;i++) samples[i]=(byte)(i*17-63);
            Object sample=construct("${type('gd')}",
              new Class<?>[]{int.class,byte[].class,int.class,int.class,boolean.class},
              rate,samples,0,Math.max(0,length),bounce);
            ${set('qk','field_j','I','null','outputRate')}
            String result;
            try {
              Object stream=create.invoke(null,sample,percent,volume);
              if(stream==null) { check(length<=0,"empty sample only"); result="null"; }
              else {
                check(length>0 && outputRate!=0,"nonempty sample and output frequency");
                int step=(Integer)${get('kl','field_p','I','stream')};
                int scaledVolume=(Integer)${get('kl','field_u','I','stream')};
                check(step==(int)((long)rate*256L*(long)percent/(long)(100*outputRate)),"PCM step");
                check(scaledVolume==(volume<<6),"PCM volume");
                check(${get('ia','field_g','Le;','stream')}==sample,"sample identity");
                check((Integer)${get('kl','field_q','I','stream')}==0,"loop start");
                check((Integer)${get('kl','field_m','I','stream')}==length,"loop end");
                check((Boolean)${get('kl','field_r','Z','stream')}==bounce,"ping-pong flag");
                int initial=(Integer)${get('kl','field_x','I','stream')}; check(initial==0,"initial position");
                StringBuilder positions=new StringBuilder();
                for(int position:new int[]{-1,0,255,(length<<8)-1,length<<8}) {
                  ${set('kl','field_x','I','stream','position')}
                  boolean value=(Boolean)outside.invoke(stream);
                  check(value==(position<0 || position>=(length<<8)),"position bounds");
                  check((Integer)${get('kl','field_x','I','stream')}==position,"query retains position");
                  positions.append(value?'1':'0'); positionChecks++;
                }
                result=step+":"+scaledVolume+":"+positions;
              }
            } catch(InvocationTargetException error) {
              check(length>0 && outputRate==0 && error.getCause() instanceof ArithmeticException,
                "only nonempty zero-output frequency divides by zero");
              result=error.getCause().getClass().getSimpleName();
            }
            check(${get('gd','field_k','[B','sample')}==samples,"sample bytes identity");
            if(samples!=null) for(int i=0;i<samples.length;i++) check(samples[i]==(byte)(i*17-63),"sample bytes");
            System.out.println("sample:"+rate+":"+outputRate+":"+percent+":"+volume+":"+length+":"+bounce+":"+result);
            factoryCases++;
          }
          try { create.invoke(null,null,100,96); throw new AssertionError("null sample must throw"); }
          catch(InvocationTargetException error) { check(error.getCause() instanceof NullPointerException,"null sample"); }
          factoryCases++;
          Method music=method("${type('ra')}","${method('ra','a(ILrf;)V')}",int.class,Class.forName("${type('rf')}"));
          for(int guard:new int[]{0,1}) for(int state=0;state<3;state++) {
            Object current=state==0?null:allocate("${type('rf')}"); Object requested=state==1?current:null;
            ${set('fe','field_e','Lrf;','null','current')}
            ${set('ra','field_d','I','null','77')}
            music.invoke(null,guard,requested);
            check(${get('fe','field_e','Lrf;')}==current,"music early-return track identity");
            check((Integer)${get('ra','field_d','I')}==77,"music early-return guard");
            System.out.println("music:"+guard+":"+state+":unchanged"); musicCases++;
          }
          check(selectorCases==120 && factoryCases==4801 && positionChecks==9000 && musicCases==6,"case counts");
          System.out.println("complete:"+selectorCases+":"+factoryCases+":"+positionChecks+":"+musicCases);
        }
      }
      class CacheWriteBehavior extends ResultHelperBehavior {
        public static void main(String[] args) throws Exception {
          Method write=method("${type('ic')}","${method('ic','a(B)V')}",byte.class);
          java.nio.file.Path path=java.nio.file.Files.createTempFile("geoblox-cache-probe-",".bin");
          int cases=0;
          try {
            for(byte guard:new byte[]{65,0,-128,127})for(int mode=0;mode<7;mode++)
            for(int offset:new int[]{-1,0,8,40,Integer.MAX_VALUE-12}) {
              java.nio.file.Files.write(path,new byte[0]);
              Object file=construct("${type('pa')}",new Class<?>[]{java.io.File.class,String.class,long.class},
                path.toFile(),"rw",mode==6?12L:1024L);
              java.io.RandomAccessFile raw=(java.io.RandomAccessFile)${get('pa','field_d','Ljava/io/RandomAccessFile;','file')};
              try {
                byte[] before=new byte[mode==6?12:40]; Arrays.fill(before,(byte)99);raw.write(before);raw.seek(0L);
                Object cache=construct("${type('sk')}",new Class<?>[]{Class.forName("${type('pa')}"),int.class,int.class},
                  file,64,0);
                Object packet=mode==4||mode==5?null:allocate("${type('pk')}");
                byte[] payload=new byte[64];for(int index=0;index<payload.length;index++)payload[index]=(byte)(index*17-63);
                if(packet!=null) {
                  ${set('qc','field_f','I','packet','offset')}
                  ${set('qc','field_j','[B','packet','mode==3?null:payload')}
                }
                ${set('Geoblox','field_C','I','null','0')}
                ${set('af','field_b','Lsk;','null','mode==0||mode==5?null:cache')}
                ${set('eh','field_d','Lpk;','null','packet')}
                ${set('ic','field_a','Ljava/lang/String;','null','"guard-sentinel"')}
                if(mode==2)raw.close(); // keep the closed handle to exercise IOException
                String completion="ok";
                try { write.invoke(null,guard); }
                catch(InvocationTargetException error) {
                  check(packet==null && error.getCause() instanceof NullPointerException,"outside null packet failure");
                  completion=error.getCause().getClass().getName();
                }
                check(packet==null?!completion.equals("ok"):completion.equals("ok"),"completion kind");
                int after=packet==null?offset:(Integer)${get('qc','field_f','I','packet')};
                check(packet==null||after==offset+24,"offset advances after swallowed cache failure");
                check(guard==65?"guard-sentinel".equals(${get('ic','field_a','Ljava/lang/String;')}):
                  ${get('ic','field_a','Ljava/lang/String;')}==null,"guard side effect");
                byte[] expected=before.clone();
                if(mode==1 && offset>=0 && offset<=payload.length-24)System.arraycopy(payload,offset,expected,0,24);
                if(mode==6) {expected=Arrays.copyOf(expected,13);expected[12]=1;}
                byte[] actual=java.nio.file.Files.readAllBytes(path);
                check(Arrays.equals(actual,expected),"cache file bytes");
                for(int index=0;index<payload.length;index++)check(payload[index]==(byte)(index*17-63),"input bytes unchanged");
                System.out.println("cache:"+guard+":"+mode+":"+offset+":"+after+":"+completion+":"+Arrays.toString(actual));
                cases++;
              } finally {raw.close();}
            }
          } finally {java.nio.file.Files.deleteIfExists(path);}
          check(cases==140,"cache case count");System.out.println("cache-complete:"+cases);
        }
      }
      class ArchiveSectorBehavior extends ResultHelperBehavior {
        static final int archiveId=7;
        static void put(byte[] bytes,int offset,int value,int width) {
          for(int i=width-1;i>=0;i--) { bytes[offset+i]=(byte)value;value>>>=8; }
        }
        static byte[] payload(int length) {
          byte[] bytes=new byte[length];for(int i=0;i<length;i++)bytes[i]=(byte)(i*37+11);return bytes;
        }
        static String digest(byte[] bytes) throws Exception {
          byte[] hash=java.security.MessageDigest.getInstance("SHA-256").digest(bytes);
          StringBuilder result=new StringBuilder();for(byte b:hash)result.append(String.format("%02x",b&255));return result.toString();
        }
        static class Fixture implements AutoCloseable {
          final java.nio.file.Path directory,dataPath,indexPath;
          final Object cache,dataFile,indexFile;
          Fixture(byte[] data,byte[] index,int maximumLength) throws Exception {
            directory=java.nio.file.Files.createTempDirectory("geoblox-sectors-");
            dataPath=directory.resolve("data.bin");indexPath=directory.resolve("index.bin");
            java.nio.file.Files.write(dataPath,data);java.nio.file.Files.write(indexPath,index);
            dataFile=construct("${type('pa')}",new Class<?>[]{java.io.File.class,String.class,long.class},dataPath.toFile(),"rw",2097152L);
            indexFile=construct("${type('pa')}",new Class<?>[]{java.io.File.class,String.class,long.class},indexPath.toFile(),"rw",2097152L);
            Object dataBuffer=construct("${type('sk')}",new Class<?>[]{Class.forName("${type('pa')}"),int.class,int.class},dataFile,64,0);
            Object indexBuffer=construct("${type('sk')}",new Class<?>[]{Class.forName("${type('pa')}"),int.class,int.class},indexFile,64,0);
            cache=construct("${type('jh')}",new Class<?>[]{int.class,Class.forName("${type('sk')}"),Class.forName("${type('sk')}"),int.class},archiveId,dataBuffer,indexBuffer,maximumLength);
          }
          public void close() throws Exception {
            Method close=method("${type('pa')}","${method('pa','a(B)V')}",byte.class);
            try {close.invoke(dataFile,(byte)-5);} finally {
              try {close.invoke(indexFile,(byte)-5);} finally {
                java.nio.file.Files.deleteIfExists(dataPath);java.nio.file.Files.deleteIfExists(indexPath);java.nio.file.Files.deleteIfExists(directory);
              }
            }
          }
        }
        static void trace(String tag,int id,int length,boolean written,byte[] read,Fixture f) throws Exception {
          check(!Thread.holdsLock(${get('jh','field_d','Lsk;','f.cache')}),"archive data monitor released");
          System.out.println("sector:"+tag+":"+id+":"+length+":"+written+":"+(read==null?"null":digest(read))+":"+
            digest(java.nio.file.Files.readAllBytes(f.dataPath))+":"+digest(java.nio.file.Files.readAllBytes(f.indexPath)));
        }
        public static void main(String[] args) throws Exception {
          ${set('Geoblox','field_C','I','null','0')}
          Method write=method("${type('jh')}","${method('jh','a([BBII)Z')}",byte[].class,byte.class,int.class,int.class);
          Method read=method("${type('jh')}","${method('jh','a(IB)[B')}",int.class,byte.class);
          int cases=0;
          for(int id:new int[]{0,1,65535,65536,70000})for(int length:new int[]{0,1,509,510,511,512,513,1020,1021,1022,1024,1600})for(boolean reuse:new boolean[]{false,true}) {
            try(Fixture f=new Fixture(new byte[0],new byte[0],20000)) {
              if(reuse)check((Boolean)write.invoke(f.cache,payload(1600),(byte)-53,id,1600),"seed archive write");
              byte[] expected=payload(length);
              boolean written=(Boolean)write.invoke(f.cache,expected,(byte)-53,id,length);
              check(written,"archive write status");
              byte[] actual=(byte[])read.invoke(f.cache,id,(byte)-78);
              boolean losesChain=id>65535 && length>510 && (length%510==1 || length%510==2);
              boolean missingEmptyEntry=!reuse && length==0;
              if(losesChain||missingEmptyEntry)check(actual==null,"retained chain/empty behavior");
              else check(Arrays.equals(actual,expected),"archive payload roundtrip");
              trace(reuse?"reuse":"new",id,length,written,actual,f);cases++;
            }
          }
          for(int id:new int[]{1,65536})for(int mode=0;mode<8;mode++) {
            int header=id>65535?10:8;
            byte[] expected=payload(500),data=new byte[1040],index=new byte[id*6+6];
            put(index,id*6,500,3);put(index,id*6+3,mode==7?0:1,3);
            put(data,520,mode==1?id+1:id,id>65535?4:2);
            put(data,520+(id>65535?4:2),mode==2?1:0,2);
            put(data,520+(id>65535?6:4),mode==4?3:0,3);
            data[520+header-1]=(byte)(mode==3?archiveId+1:archiveId);
            System.arraycopy(expected,0,data,520+header,expected.length);
            if(mode==5)data=Arrays.copyOf(data,520+header+499);
            try(Fixture f=new Fixture(data,index,mode==6?100:20000)) {
              byte[] actual=(byte[])read.invoke(f.cache,id,(byte)-78);
              if(mode==0)check(Arrays.equals(actual,expected),"seed sector decode");
              else check(actual==null,"malformed sector rejected");
              trace("malformed"+mode,id,500,false,actual,f);cases++;
            }
          }
          for(int id:new int[]{1,65536}) {
            byte[] data=new byte[520],index=new byte[id*6+6];put(index,id*6,1,3);put(index,id*6+3,1,3);
            try(Fixture f=new Fixture(data,index,20000)) {
              boolean written=(Boolean)write.invoke(f.cache,payload(4),(byte)-53,id,4);
              check(written,"header EOF retains success exit");
              byte[] actual=(byte[])read.invoke(f.cache,id,(byte)-78);
              check(actual==null,"EOF chain remains unreadable");
              check(Arrays.equals(data,java.nio.file.Files.readAllBytes(f.dataPath)),"EOF exit writes no sector");
              put(index,id*6,4,3);check(Arrays.equals(index,java.nio.file.Files.readAllBytes(f.indexPath)),"index published before header EOF");
              trace("header-eof",id,4,written,actual,f);cases++;
            }
          }
          check(cases==138,"sector archive case count");System.out.println("archive-sector-complete:"+cases);
        }
      }
      class ArchiveCompressionBehavior extends ResultHelperBehavior {
        static byte[] packet(int type,byte[] payload,int packedLength,int outputLength) throws Exception {
          java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
          java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);out.writeByte(type);out.writeInt(packedLength);
          if(type!=0)out.writeInt(outputLength);out.write(payload);return bytes.toByteArray();
        }
        static byte[] gzip(byte[] payload) throws Exception {
          java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
          try(java.util.zip.GZIPOutputStream gzip=new java.util.zip.GZIPOutputStream(bytes)){gzip.write(payload);}
          return bytes.toByteArray();
        }
        static String error(InvocationTargetException failure) throws Exception {
          Throwable cause=failure.getCause();check(cause.getClass()==Class.forName("${type('sa')}"),"compression contextual error");
          return "context:"+((Throwable)${get('sa','field_a','Ljava/lang/Throwable;','cause')}).getClass().getName();
        }
        public static void main(String[] args) throws Exception {
          ${set('Geoblox','field_C','I','null','0')}
          Object shared=construct("${type('fe')}",new Class<?>[0]);${set('sc','field_b','Lfe;','null','shared')}
          Method unpack=method("${type('v')}","${method('v','a([BI)[B')}",byte[].class,int.class);
          Method inflate=method("${type('fe')}","${method('fe','a(ILqc;[B)V')}",int.class,Class.forName("${type('qc')}"),byte[].class);
          int cases=0;
          for(int type:new int[]{0,2,99})for(int length:new int[]{0,1,16,513})for(int limit:new int[]{0,length,length==0?1:length-1}) {
            byte[] expected=ArchiveSectorBehavior.payload(length),packed=type==0?expected:gzip(expected);
            byte[] input=packet(type,packed,packed.length,length),before=input.clone();
            ${set('uj','field_b','I','null','limit')}
            boolean rejected=limit!=0&&(packed.length>limit||length>limit);byte[] actual=null;String status="ok";
            try{actual=(byte[])unpack.invoke(null,input,-1);}catch(InvocationTargetException failure){status=error(failure);}
            check(rejected?!status.equals("ok"):status.equals("ok")&&Arrays.equals(actual,expected),"container length limit/payload");
            check(Arrays.equals(before,input),"container input retained");
            System.out.println("compression:container:"+type+":"+length+":"+limit+":"+status+":"+(actual==null?"null":ArchiveSectorBehavior.digest(actual)));cases++;
          }
          ${set('uj','field_b','I','null','0')}
          for(int type:new int[]{2,99})for(int declared:new int[]{0,1}) {
            byte[] expected=ArchiveSectorBehavior.payload(16),input=packet(type,gzip(expected),declared,16);
            byte[] actual=(byte[])unpack.invoke(null,input,-1);check(Arrays.equals(actual,expected),"gzip uses full backing input");
            System.out.println("compression:declared:"+type+":"+declared+":"+ArchiveSectorBehavior.digest(actual));cases++;
          }
          for(int type:new int[]{2,99}) {
            byte[] compressed=gzip(ArchiveSectorBehavior.payload(16)),input=packet(type,compressed,compressed.length,16);
            byte[] actual=(byte[])unpack.invoke(null,input,~type);
            check(Arrays.equals(actual,Arrays.copyOfRange(input,5,5+compressed.length)),"complement selector raw-copy branch");
            System.out.println("compression:selector:"+type+":"+ArchiveSectorBehavior.digest(actual));cases++;
          }
          byte[] prefix="Archive block payload: ".getBytes(java.nio.charset.StandardCharsets.US_ASCII),expected=new byte[151];
          System.arraycopy(prefix,0,expected,0,prefix.length);for(int i=prefix.length;i<expected.length;i++)expected[i]=(byte)((i-prefix.length)%32);
          byte[] bzip=Base64.getDecoder().decode("MUFZJlNZNrnT2AAAQn2Af////8AAABAgAD5s0SAgAHIpAGhoAAyAAMNQKqoGgGgAGI9TENMgIQtXC6XiIvmAwmIxmQykZmM5oNJqNZsNpuN5wOJyJCUmOZ0IHXxXVshPKmvFoSwCgERYE/F3JFOFCQNrnT2A");
          byte[] decoded=(byte[])unpack.invoke(null,packet(1,bzip,bzip.length,expected.length),-1);
          check(Arrays.equals(decoded,expected),"fixed stripped Bzh1 block vector");
          Object state=${get('tb','field_a','Ljl;')};
          check(${get('jl','field_p','[B','state')}==null&&${get('jl','field_j','[B','state')}==null,"successful bzip releases input/output arrays");
          System.out.println("compression:bzip:"+ArchiveSectorBehavior.digest(decoded));cases++;
          decoded=(byte[])unpack.invoke(null,packet(1,new byte[]{23},0,4),-1);
          check(Arrays.equals(decoded,new byte[4]),"early bzip end ignores declared packed length/output completion");
          System.out.println("compression:bzip-end:"+ArchiveSectorBehavior.digest(decoded));cases++;
          Object reusable=construct("${type('fe')}",new Class<?>[0]);byte[] payload=ArchiveSectorBehavior.payload(16),compressed=gzip(payload);
          for(int position:new int[]{0,3})for(int outputLength:new int[]{0,1,16,20})for(int mode=0;mode<4;mode++) {
            if(outputLength==0&&mode==3)continue;
            byte[] input=new byte[position+compressed.length];System.arraycopy(compressed,0,input,position,compressed.length);
            if(mode==1)input[position]=0;if(mode==2)input[input.length-8]^=127;if(mode==3)input[position+10]=7;
            byte[] before=input.clone(),actual=new byte[outputLength];Arrays.fill(actual,(byte)85);
            Object buffer=construct("${type('qc')}",new Class<?>[]{byte[].class},input);${set('qc','field_f','I','buffer','position')}
            String status="ok";try{inflate.invoke(reusable,-1,buffer,actual);}catch(InvocationTargetException failure){status=error(failure);}
            boolean rejected=mode==1||mode==3;check(rejected?!status.equals("ok"):status.equals("ok"),"gzip completion kind");
            byte[] wanted=new byte[outputLength];Arrays.fill(wanted,(byte)85);if(!rejected)System.arraycopy(payload,0,wanted,0,Math.min(outputLength,payload.length));
            check(Arrays.equals(actual,wanted),"gzip partial output/tail retention");check(Arrays.equals(input,before),"gzip input unchanged");
            check((Integer)${get('qc','field_f','I','buffer')}==position,"gzip input cursor unchanged");
            java.util.zip.Inflater decoder=(java.util.zip.Inflater)${get('fe','field_i','Ljava/util/zip/Inflater;','reusable')};
            check(decoder.getBytesRead()==0&&decoder.getBytesWritten()==0,"gzip inflater reset/reused");
            System.out.println("compression:inflate:"+position+":"+outputLength+":"+mode+":"+status+":"+ArchiveSectorBehavior.digest(actual));cases++;
          }
          check(cases==74,"compression case count");System.out.println("archive-compression-complete:"+cases);
        }
      }
      class Bzip2BlockBehavior extends ResultHelperBehavior {
        static final String[] vectors={"F3JFOFCQAAAAAA==","MUFZJlNZ9qAUoQAAI3////////////////////////////////////////////+wANkEmAAmAAJgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkwAEwABMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADiNAEwAJowAAAJiYGjQAAAAAAAExMBNNMAATAAAAAAAAAAAEwAAABNMmAYCCBQYMODxAREhMUFfgLC4wMjQ2ODo8PkBD8SL5fMjJCUmJygpKissLS4vMDEyMzQ1Njc4OTr6HZ4e/U+P0BBQkMIhgfZFCBQAMEjAgoEMAAkdISUpLTE1OT1BRUlNUVVZXVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P0XckU4UJD2oBShA=","MUFZJlNZur7RmwAAA//////////////////////////////////////////////AArwAAAkwAEwABMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEmAAmAAJgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkwAEwABMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqqqAmAmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf0QEQIQMQQQUf8IMIOIQISIUIWIYP/ENEOEPEQERESETEUEVEWEXEYEZEaEbEcEdEeEfEgEhEiEjEkElEmEnEoEpEqErEsEtEuEvEwExEyEzE0E1E2E3E4E5E6E7E8E9E+E/FAFBFCFDFEFFFGFHFIFJFKFLFMFNFOFPFQFRFSFTFUFVFWFXFYFZFaFbFcFdFeFfFgFhFiFjFkFlFmFnFoFpFqFrFsFtFuFvFwFxFyFzF0F1F2F3F4F5F6F7F8F9F+F/GAGBGCGDGEGFGGGHGIGJGKGLGMGNGOGPGQGRGSGTGUGVGWGXGYGZGaGbGcGdGeGfGgGhGiGjGkGlGmGnGoGpGqGrGsGtGuGvGwGxGyGzG0G1G2G3G4G5G6G7G8G9G+G/HAHBHCHDHEHFHGHHHIHJHKHLHMHNHOHPHQHRHSHTHUHVHWHXHYHZHaHbHcHdHeHfHgHhHiHjHkHlHmHnHoHpHqHrHsHtHuHvHwHxHyHzH0H1H2H3H4H5H6H7H8H9H+F3JFOFCQur7Rmw==","MUFZJlNZFrlp7AADtf/////////////////////////////////////////////gClvvV3PPfZ963e97XvDrfdatue3b3e3a73n3dve+27fe+2++59ruSaBtGp6mEGjNRoaeppkNNkEekemiaaNNppNNMmmNRo2o9J5A1D1MjNBPRNqDTIY0jJtCHom0EyMnqGaQ09QyNpGANGmjBBoGRoaaIIU9qj9E2iMRPDU9U9GptTyaGnoTap5PVPCaPTVP1TahhNPJkam9FHplMngamp+ownqTwE9Keap7RN6ppPap5T9FPKekb0MU2mp6npPKHkpvTBGmmmhlTxo1NplPUeqfpTbVPRqP1RCD00aRtTEaaGah6npqbUbIjR6mhtI0yPU9TEyekDI9T1NBtTI0D0QehqHpNlPDU2oJhNinpNlPSabImnqaaaek02iPSbUBiep6QaepoYCaZMmmI0eokzRNMmE9TAmj0TQB6mmATJk8oyGTT1MTNT0GINNAj9Jk00aaj0JkxNNDE0yN6o0xqNME9RgCNDCZMmajTah6j0am0nqY1NMQ9TJmSY1BJppoYDU0yPU00GjZTJ6m1NgapsmjRNppPJo0j0mIGaNNR6hmSPERk0NHlDEbKaeo9QMaQMQbQTJpiaNDRoaaPU2gTNEeiaHo1HkgwmQhM1MAyE00eIZGpmpmgnqMmQ2po2phpHpMmammjJo0YmmZIzTRNMmJowjRk2po0wnqabQTR6BMnoajEaaZomj1NNMmJ6NR6TBpDMmhqZlNFDPTB1qSJ9ibSUF9VlGUs+bAmN7szLvdxkWEW5TR87ehDIeTApObEQJdjVC6YawdSlAx8xo0x63NGZYZG6giiaFHOpUoTNUArt5uecqm5auhT+mni167vYh5HVyJLR+QkZ80RGuqRI4K+NgaqOYpCcOiGKRM8wpZEZDCfN9axmzXwrwPsbIhWhhb5iglV5MKEvy2hBxTSHfggTIU2Qjx6xPnSbuktq/1Wxigyr+DcTEDOVUqr/58In2rSUt95W0WnZgQ/ctIpg8KrE0tQMXO8T33L5tK9R45x0y8bRT5KRpBJXaQXPHSuUjsyk0DnEzeeqlZaMXTWHiYqVyq/prnyTEHfqoNOvtCkEuWfHQRgI3PAPpy9lgvAN8R0YYcztTmxlyo6EjoUMDNeoCACgDllarklOEPOK30/dlj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"};
        static byte[] payload(int shape) {
          int[] lengths={0,272,2048,4096,1024,120064};byte[] result=new byte[lengths[shape]];
          if(shape==1){byte[] prefix="AAAAABBBCCDDDDDD".getBytes(java.nio.charset.StandardCharsets.US_ASCII);System.arraycopy(prefix,0,result,0,prefix.length);for(int i=prefix.length;i<result.length;i++)result[i]=(byte)(i-prefix.length);}
          if(shape==2||shape==5)for(int i=0;i<result.length;i++)result[i]=(byte)i;
          if(shape==3){int seed=0x12345678;for(int i=0;i<result.length;i++){seed=seed*1664525+1013904223;result[i]=(byte)(seed>>>24);}}
          if(shape==4)Arrays.fill(result,(byte)90);return result;
        }
        static byte[] input(int shape){return Base64.getDecoder().decode(vectors[shape]);}
        public static void main(String[] args) throws Exception {
          Method decode=method("${type('tb')}","${method('tb','a([BI[BII)I')}",byte[].class,int.class,byte[].class,int.class,int.class);
          int cases=0;Object state=${get('tb','field_a','Ljl;')};
          for(int shape=0;shape<vectors.length;shape++) {
            byte[] expected=payload(shape),compressed=input(shape),before=compressed.clone();
            SortedSet<Integer> capacities=new TreeSet<>(Arrays.asList(0,1,3,expected.length/2,expected.length,expected.length+5));
            for(int capacity:capacities) {
              byte[] destination=new byte[capacity];Arrays.fill(destination,(byte)85);
              int count=(Integer)decode.invoke(null,destination,capacity,compressed,-999,0);
              int wantedCount=Math.min(capacity,expected.length);byte[] wanted=new byte[capacity];Arrays.fill(wanted,(byte)85);
              System.arraycopy(expected,0,wanted,0,wantedCount);
              check(count==wantedCount&&Arrays.equals(destination,wanted),"bzip block/partial payload oracle");
              check(Arrays.equals(compressed,before),"bzip input untouched");
              check((Integer)${get('jl','field_C','I','state')}==count&&(Integer)${get('jl','field_A','I','state')}==capacity-count,"bzip output state");
              check(${get('jl','field_p','[B','state')}==null&&${get('jl','field_j','[B','state')}==null,"bzip success releases arrays");
              check(!Thread.holdsLock(state),"bzip state monitor released");
              System.out.println("bzip-block:"+shape+":"+capacity+":"+count+":"+ArchiveSectorBehavior.digest(destination));cases++;
            }
          }
          for(int mode=0;mode<3;mode++) {
            byte[] compressed=mode==0?new byte[0]:mode==1?input(1):null,destination=new byte[16];Arrays.fill(destination,(byte)85);
            String status="ok";try{decode.invoke(null,destination,16,compressed,0,mode==1?-1:0);}catch(InvocationTargetException failure){status=failure.getCause().getClass().getName();}
            check(status.equals(mode==2?"java.lang.NullPointerException":"java.lang.ArrayIndexOutOfBoundsException"),"bzip malformed input failure kind");
            byte[] wanted=new byte[16];Arrays.fill(wanted,(byte)85);check(Arrays.equals(destination,wanted),"bzip malformed input retains output");
            check(${get('jl','field_p','[B','state')}==compressed&&${get('jl','field_j','[B','state')}==destination,"bzip failure retains array aliases");
            check(!Thread.holdsLock(state),"bzip failed monitor released");
            System.out.println("bzip-failure:"+mode+":"+status+":"+ArchiveSectorBehavior.digest(destination));cases++;
            byte[] expected=payload(1),recovered=new byte[expected.length];
            int count=(Integer)decode.invoke(null,recovered,recovered.length,input(1),0,0);
            check(count==expected.length&&Arrays.equals(expected,recovered),"bzip recovery after failed input");
            check(${get('jl','field_p','[B','state')}==null&&${get('jl','field_j','[B','state')}==null,"bzip recovery clears aliases");
            System.out.println("bzip-recovery:"+mode+":"+count+":"+ArchiveSectorBehavior.digest(recovered));cases++;
          }
          check(cases==40,"bzip block case count");System.out.println("bzip-block-complete:"+cases);
        }
      }
      class ShutdownBehavior extends ResultHelperBehavior {
        public static void main(String[] args) throws Exception {
          Method close=method("${type('ba')}","${method('ba','b(I)V')}",int.class);
          Thread terminated=new Thread(()->{});terminated.start();terminated.join();int cases=0;
          for(int guard:new int[]{-124,-118,Integer.MIN_VALUE})for(int state=0;state<8;state++)
          for(boolean initialClosed:new boolean[]{false,true})for(boolean interrupted:new boolean[]{false,true}) {
            if(state==6 && !initialClosed && !interrupted || state==7 && (initialClosed || interrupted))continue;
            Object socket=allocate("${type('ba')}");Object task=state==0?null:allocate("${type('cb')}");
            java.util.concurrent.CountDownLatch ready=new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.CountDownLatch release=new java.util.concurrent.CountDownLatch(1);
            Thread worker=null,publisher=null;
            if(task!=null) {
              ${set('cb','field_a','I','task','state==1?2:state==7?0:1')}
              Object payload=state==2?terminated:state==3?new Thread(()->{}):state==4?null:"wrong-type";
              if(state==6) {
                worker=new Thread(()->{ready.countDown();try {release.await();}catch(InterruptedException ignored){}});
                worker.start();check(ready.await(3,java.util.concurrent.TimeUnit.SECONDS),"worker started");payload=worker;
              }
              ${set('cb','field_b','Ljava/lang/Object;','task','payload')}
            }
            ${set('ba','field_m','Lcb;','socket','task')}
            ${set('ba','field_f','Z','socket','initialClosed')}
            if(state==7) {
              publisher=new Thread(()->{try {synchronized(socket) {
                ready.countDown();while(!(Boolean)${get('ba','field_f','Z','socket')})socket.wait();
                ${set('cb','field_a','I','task','2')}
              }}catch(Exception failure){throw new AssertionError(failure);}});
              publisher.start();check(ready.await(3,java.util.concurrent.TimeUnit.SECONDS),"publisher waiting");
            }
            try {
              if(interrupted)Thread.currentThread().interrupt();String completion="ok";
              try {close.invoke(socket,guard);}catch(InvocationTargetException error) {
                check(!initialClosed && (state==4 && error.getCause() instanceof NullPointerException
                  || state==5 && error.getCause() instanceof ClassCastException),"unmatched join failure");
                completion=error.getCause().getClass().getName();
              }
              check(completion.equals("ok")== (initialClosed || state!=4 && state!=5),"completion kind");
              boolean closed=(Boolean)${get('ba','field_f','Z','socket')};check(closed,"closed flag");
              Object after=${get('ba','field_m','Lcb;','socket')};
              check(initialClosed || !completion.equals("ok")?after==task:after==null,"task release/failure retention");
              boolean afterInterrupt=Thread.currentThread().isInterrupted();
              check(afterInterrupt==(interrupted && (initialClosed || state!=6)),"interrupt consumption");
              check(!Thread.holdsLock(socket),"monitor released");
              System.out.println("shutdown:"+guard+":"+state+":"+initialClosed+":"+interrupted+":"+completion+
                ":"+closed+":"+(after==task)+":"+afterInterrupt);cases++;
            } finally {
              Thread.interrupted();release.countDown();
              if(worker!=null) {worker.join(3000L);check(!worker.isAlive(),"worker stopped");}
              if(publisher!=null) {publisher.join(3000L);check(!publisher.isAlive(),"publisher stopped");}
            }
          }
          check(cases==84,"shutdown case count");System.out.println("shutdown-complete:"+cases);
        }
      }
      class SocketIoBehavior extends ResultHelperBehavior {
        static class Input extends java.io.InputStream {
          byte[] bytes={11,22,33,44};int position,reads,closes,mode;boolean closeFailure;
          final java.io.IOException failure=new java.io.IOException("input");
          public int available(){return bytes.length-position;}
          public int read() throws java.io.IOException {reads++;if(mode==2)throw failure;
            return position==bytes.length?-1:bytes[position++]&255;}
          public int read(byte[] target,int offset,int length) throws java.io.IOException {
            reads++;if(mode==2)throw failure;if(mode==1)return 0;
            if(position==bytes.length)return -1;int count=Math.min(2,Math.min(length,bytes.length-position));
            System.arraycopy(bytes,position,target,offset,count);position+=count;return count;
          }
          public void close() throws java.io.IOException {closes++;if(closeFailure)throw failure;}
        }
        static class Output extends java.io.OutputStream {
          final java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();int writes,flushes,closes,mode;
          public void write(int value){bytes.write(value);}
          public void write(byte[] source,int offset,int length) throws java.io.IOException {
            writes++;if(mode==1)throw new java.io.IOException("write");bytes.write(source,offset,length);
          }
          public void flush() throws java.io.IOException {flushes++;if(mode==2)throw new java.io.IOException("flush");}
          public void close(){closes++;}
        }
        static class Socket extends java.net.Socket {
          final Input input=new Input();final Output output=new Output();int timeout,closes;boolean noDelay;
          public void setSoTimeout(int value){timeout=value;}public void setTcpNoDelay(boolean value){noDelay=value;}
          public java.io.InputStream getInputStream(){return input;}public java.io.OutputStream getOutputStream(){return output;}
          public synchronized void close(){closes++;}
        }
        static Throwable call(Method method,Object receiver,Object... arguments) throws Exception {
          try{method.invoke(receiver,arguments);return null;}catch(InvocationTargetException error){return error.getCause();}
        }
        static Object holder(Socket fixture,int capacity,int start,boolean closed) throws Exception {
          Object socket=allocate("${type('ba')}");
          ${set('ba','field_j','Ljava/net/Socket;','socket','fixture')}
          ${set('ba','field_g','Ljava/io/InputStream;','socket','fixture.input')}
          ${set('ba','field_a','Ljava/io/OutputStream;','socket','fixture.output')}
          ${set('ba','field_b','I','socket','capacity')}
          ${set('ba','field_k','I','socket','start')}
          ${set('ba','field_e','I','socket','start')}
          ${set('ba','field_f','Z','socket','closed')}
          ${set('ba','field_m','Lcb;','socket',`allocate("${type('cb')}")`)}
          return socket;
        }
        public static void main(String[] args) throws Exception {
          int cases=0;Class<?> dispatcher=Class.forName("${type('d')}");
          for(int capacity:new int[]{5000,256}) {
            Socket fixture=new Socket();Object tasks=allocate("${type('d')}");
            Object socket=capacity==5000?construct("${type('ba')}",new Class<?>[]{java.net.Socket.class,dispatcher},fixture,tasks)
              :construct("${type('ba')}",new Class<?>[]{java.net.Socket.class,dispatcher,int.class},fixture,tasks,capacity);
            check(fixture.timeout==30000 && fixture.noDelay,"socket configuration");
            check(${get('ba','field_j','Ljava/net/Socket;','socket')}==fixture &&
              ${get('ba','field_g','Ljava/io/InputStream;','socket')}==fixture.input &&
              ${get('ba','field_a','Ljava/io/OutputStream;','socket')}==fixture.output &&
              ${get('ba','field_l','Ld;','socket')}==tasks,"constructor identities");
            check((Integer)${get('ba','field_b','I','socket')}==capacity &&
              !(Boolean)${get('ba','field_f','Z','socket')} && !(Boolean)${get('ba','field_i','Z','socket')} &&
              (Integer)${get('ba','field_k','I','socket')}==0 && (Integer)${get('ba','field_e','I','socket')}==0 &&
              ${get('ba','field_d','[B','socket')}==null && ${get('ba','field_m','Lcb;','socket')}==null,"constructor state");
            ${set('ba','field_f','Z','socket','true')}
            System.out.println("constructor:"+capacity+":"+fixture.timeout+":"+fixture.noDelay);cases++;
          }
          Method available=method("${type('ba')}","${method('ba','a(B)I')}",byte.class);
          Method readByte=method("${type('ba')}","${method('ba','c(I)I')}",int.class);
          Method readFully=method("${type('ba')}","${method('ba','a([BBII)V')}",byte[].class,byte.class,int.class,int.class);
          Method checkError=method("${type('ba')}","${method('ba','d(I)V')}",int.class);
          Method enqueue=method("${type('ba')}","${method('ba','a(III[B)V')}",int.class,int.class,int.class,byte[].class);
          Method run=method("${type('ba')}","run");
          for(boolean closed:new boolean[]{false,true})for(byte guard:new byte[]{-128,71,72,127}) {
            Socket fixture=new Socket();Object socket=holder(fixture,256,0,closed);String completion="ok";int count=-1;
            try{count=(Integer)available.invoke(socket,guard);}catch(InvocationTargetException error){
              check(!closed && guard<=71 && error.getCause() instanceof NullPointerException,"available failure");completion="null";}
            check(!completion.equals("ok") || count==(closed?0:4),"available count");
            check((${get('ba','field_g','Ljava/io/InputStream;','socket')}==null)==(guard<=71),"available guard effect");
            System.out.println("available:"+closed+":"+guard+":"+completion+":"+count);cases++;
          }
          for(boolean closed:new boolean[]{false,true})for(int guard:new int[]{-17422,0,Integer.MIN_VALUE}) {
            Socket fixture=new Socket();Object socket=holder(fixture,256,0,closed);int value=(Integer)readByte.invoke(socket,guard);
            check(value==(closed?0:guard==-17422?11:-104),"read byte result");
            check(fixture.input.position==(!closed && guard==-17422?1:0),"read byte consumption");
            System.out.println("byte:"+closed+":"+guard+":"+value+":"+fixture.input.position);cases++;
          }
          for(boolean closed:new boolean[]{false,true})for(byte guard:new byte[]{-97,0})
          for(int mode=0;mode<3;mode++)for(int length:new int[]{0,1,4,8}) {
            Socket fixture=new Socket();fixture.input.mode=mode;Object socket=holder(fixture,256,0,closed);
            byte[] target=new byte[10],expected=new byte[10];Arrays.fill(target,(byte)99);Arrays.fill(expected,(byte)99);
            boolean active=!closed && guard==-97 && length>0;int copied=active && mode==0?Math.min(length,4):0;
            System.arraycopy(fixture.input.bytes,0,expected,1,copied);Throwable error=call(readFully,socket,target,guard,1,length);
            boolean fails=active && (mode!=0 || length>4);check((error!=null)==fails,"readFully completion");
            if(fails)check(mode==2?error==fixture.input.failure:error instanceof java.io.EOFException,"readFully throwable");
            check(Arrays.equals(target,expected) && fixture.input.position==copied,"readFully partial bytes");
            System.out.println("readFully:"+closed+":"+guard+":"+mode+":"+length+":"+(error==null?"ok":error.getClass().getName())+
              ":"+Arrays.toString(target)+":"+fixture.input.reads);cases++;
          }
          for(boolean closed:new boolean[]{false,true})for(boolean pending:new boolean[]{false,true})
          for(int guard:new int[]{-128,-79,0}) {
            Socket fixture=new Socket();Object socket=holder(fixture,256,0,closed);
            ${set('ba','field_i','Z','socket','pending')}
            Throwable error=call(checkError,socket,guard);boolean fails=!closed && pending && guard<-79;
            check((error!=null)==fails && (!fails || error instanceof java.io.IOException),"pending error completion");
            boolean after=(Boolean)${get('ba','field_i','Z','socket')};check(after==(pending && !fails),"pending error consumption");
            System.out.println("pending:"+closed+":"+pending+":"+guard+":"+fails+":"+after);cases++;
          }
          for(int capacity:new int[]{256,512})for(int start:new int[]{0,capacity-2})
          for(int length:new int[]{0,1,5,capacity-101,capacity-100})for(boolean closed:new boolean[]{false,true})
          for(boolean pending:new boolean[]{false,true})for(int guard:new int[]{100,0}) {
            Socket fixture=new Socket();Object socket=holder(fixture,capacity,start,closed);
            Object task=${get('ba','field_m','Lcb;','socket')};byte[] source=new byte[length+2];
            for(int i=0;i<source.length;i++)source[i]=(byte)(i*17+3);
            ${set('ba','field_i','Z','socket','pending')}
            Throwable error=call(enqueue,socket,guard,1,length,source);
            boolean overflow=!closed && !pending && length==capacity-100;
            boolean fails=!closed && (pending || overflow);check((error!=null)==fails && (!fails || error instanceof java.io.IOException),"enqueue completion");
            byte[] buffer=(byte[])${get('ba','field_d','[B','socket')};int copied=closed || pending?0:length;
            check((buffer==null)==(closed || pending),"lazy buffer allocation");
            if(buffer!=null){byte[] expected=new byte[capacity];for(int i=0;i<copied;i++)expected[(start+i)%capacity]=source[i+1];
              check(Arrays.equals(buffer,expected),"ring bytes");}
            int write=(Integer)${get('ba','field_e','I','socket')};check(write==(start+copied)%capacity,"ring write position");
            check((Integer)${get('ba','field_k','I','socket')}==start && ${get('ba','field_m','Lcb;','socket')}==task,"ring read/task retention");
            boolean after=(Boolean)${get('ba','field_i','Z','socket')};check(after==(closed && pending),"enqueue consumes pending failure");
            check((${get('ba','field_a','Ljava/io/OutputStream;','socket')}==null)==(!closed && !pending && !overflow && guard!=100),"enqueue guard effect");
            check(!Thread.holdsLock(socket),"enqueue monitor released");
            System.out.println("enqueue:"+capacity+":"+start+":"+length+":"+closed+":"+pending+":"+guard+":"+fails+":"+write+":"+after);cases++;
          }
          for(int capacity:new int[]{256,512})for(int start:new int[]{0,capacity-2})for(int length:new int[]{0,1,5})
          for(int mode=0;mode<3;mode++)for(boolean closeFailure:new boolean[]{false,true}) {
            Socket fixture=new Socket();fixture.output.mode=mode;fixture.input.closeFailure=closeFailure;
            Object socket=holder(fixture,capacity,start,true);byte[] buffer=new byte[capacity],expected=new byte[length];
            for(int i=0;i<length;i++){expected[i]=(byte)(i*17+3);buffer[(start+i)%capacity]=expected[i];}
            ${set('ba','field_d','[B','socket','buffer')}
            ${set('ba','field_e','I','socket','(start+length)%capacity')}
            check(call(run,socket)==null,"writer completion");
            check(Arrays.equals(fixture.output.bytes.toByteArray(),mode==1?new byte[0]:expected),"writer bytes");
            int chunks=length==0?0:start+length>capacity?2:1;
            check(fixture.output.writes==chunks && fixture.output.flushes==(length==0?0:1),"writer split/flush");
            check((Integer)${get('ba','field_k','I','socket')}==(start+length)%capacity &&
              ${get('ba','field_d','[B','socket')}==null,"writer consumption/release");
            check((Boolean)${get('ba','field_i','Z','socket')}==(length>0 && mode!=0),"writer failure flag");
            check(fixture.input.closes==1 && fixture.output.closes==(closeFailure?0:1) && fixture.closes==(closeFailure?0:1),"close failure order");
            check(!Thread.holdsLock(socket),"writer monitor released");
            System.out.println("writer:"+capacity+":"+start+":"+length+":"+mode+":"+closeFailure+":"+
              Arrays.toString(fixture.output.bytes.toByteArray())+":"+fixture.output.writes+":"+fixture.output.flushes+":"+fixture.output.closes+":"+fixture.closes);cases++;
          }
          check(cases==308,"socket I/O case count");System.out.println("socket-io-complete:"+cases);
        }
      }
      class DispatcherShutdownBehavior extends ResultHelperBehavior {
        static final StringBuilder trace=new StringBuilder();
        static class RecordingFile extends java.io.RandomAccessFile {
          final String id;final boolean fails;boolean tracing=true;
          RecordingFile(java.io.File path,String id,boolean fails)throws java.io.IOException {super(path,"rw");this.id=id;this.fails=fails;}
          public void close()throws java.io.IOException {if(tracing)trace.append(id).append(',');super.close();if(fails&&tracing)throw new java.io.IOException(id);}
          void forceClose()throws java.io.IOException {tracing=false;super.close();}
        }
        static Object file(java.nio.file.Path directory,String id,boolean failure,java.util.List<Object> holders,
            java.util.List<RecordingFile> files)throws Exception {
          Object holder=allocate("${type('pa')}");RecordingFile file=new RecordingFile(directory.resolve(id).toFile(),id,failure);
          ${set('pa','field_d','Ljava/io/RandomAccessFile;','holder','file')}
          holders.add(holder);files.add(file);return holder;
        }
        public static void main(String[] args)throws Exception {
          Method shutdown=method("${type('d')}","${method('d','a(B)V')}",byte.class);int cases=0;
          for(int nullMask=0;nullMask<32;nullMask++)for(int failMask:new int[]{0,21,31}) {
            java.nio.file.Path directory=java.nio.file.Files.createTempDirectory("geoblox-dispatcher-close-");
            java.util.List<Object> holders=new ArrayList<>();java.util.List<RecordingFile> files=new ArrayList<>();
            try {
              Object dispatcher=allocate("${type('d')}");Object indices=java.lang.reflect.Array.newInstance(Class.forName("${type('pa')}"),5);
              ${set('d','field_i','Ljava/lang/Thread;','dispatcher','new Thread()')}
              ${set('d','field_j','Lpa;','dispatcher','file(directory,"data",false,holders,files)')}
              ${set('d','field_s','Lpa;','dispatcher','file(directory,"master",false,holders,files)')}
              String expected="data,master,";
              for(int index=0;index<5;index++)if((nullMask&(1<<index))==0) {
                java.lang.reflect.Array.set(indices,index,file(directory,"index"+index,(failMask&(1<<index))!=0,holders,files));
                expected+="index"+index+",";
              }
              ${set('d','field_r','[Lpa;','dispatcher','indices')}
              ${set('d','field_n','Lpa;','dispatcher','file(directory,"seed",false,holders,files)')}
              expected+="seed,";trace.setLength(0);shutdown.invoke(dispatcher,(byte)13);
              check(trace.toString().equals(expected),"cache shutdown order: "+trace+" != "+expected);
              for(int i=0;i<holders.size();i++)check((${get('pa','field_d','Ljava/io/RandomAccessFile;','holders.get(i)')}!=null)==files.get(i).fails,"close success/failure retention");
              check((Boolean)${get('d','field_c','Z','dispatcher')} && !Thread.holdsLock(dispatcher),"dispatcher flag/monitor");
              check(${get('d','field_d','Lcb;','dispatcher')}==null && ${get('d','field_g','Lcb;','dispatcher')}==null,"no shutdown task for valid guard");
              System.out.println("dispatcher-close:"+nullMask+":"+failMask+":"+trace);cases++;
            } finally {
              for(int i=0;i<holders.size();i++) {files.get(i).forceClose();${set('pa','field_d','Ljava/io/RandomAccessFile;','holders.get(i)','null')}}
              try(java.util.stream.Stream<java.nio.file.Path> children=java.nio.file.Files.list(directory)) {
                for(java.nio.file.Path child:(Iterable<java.nio.file.Path>)children::iterator)java.nio.file.Files.delete(child);
              }
              java.nio.file.Files.delete(directory);
            }
          }
          check(cases==96,"dispatcher shutdown case count");System.out.println("dispatcher-shutdown-complete:"+cases);
        }
      }
      class InputBehavior extends ResultHelperBehavior {
        static int cases;
        static void check(boolean value,String label) { ResultHelperBehavior.check(value,label); }
        static void resetKeyboard(Object listener,int read,int write,int end) throws Exception {
          ${set('Geoblox','field_C','I','null','0')}
          ${set('je','field_j','Lwl;','null','listener')}
          ${set('vd','field_n','I','null','read')}
          ${set('ba','field_c','I','null','write')}
          ${set('pc','field_p','I','null','end')}
          ${set('kj','field_O','[I','null','new int[128]')}
          ${set('ai','field_n','[C','null','new char[128]')}
          ${set('kj','field_o','[Z','null','new boolean[112]')}
          ${set('gf','field_c','[I','null','new int[128]')}
          ${set('gk','field_b','I','null','read')}
          ${set('ii','field_c','I','null','read')}
          ${set('nk','field_e','I','null','7')}
        }
        static void trace(String name,int... values) {
          StringBuilder out=new StringBuilder(name);for(int value:values)out.append(':').append(value);
          System.out.println(out);cases++;
        }
        public static void main(String[] args) throws Exception {
          Object keyboard=ResultHelperBehavior.allocate("${type('wl')}");
          java.awt.Canvas canvas=new java.awt.Canvas();
          int[] starts={0,1,63,126,127};
          for(int start:starts)for(int count:new int[]{0,1,2,64,127})for(int guard:new int[]{41,42,127}) {
            int end=(start+count)%128;resetKeyboard(keyboard,start,(end+1)%128,end);
            ${set('ki','field_d','I','null','-777')}${set('te','field_a','C','null',"(char)777")}
            int[] codes=(int[])${get('kj','field_O','[I')};char[] chars=(char[])${get('ai','field_n','[C')};
            for(int i=0;i<count;i++){int slot=(start+i)%128;codes[slot]=i%2==0?96:-1;chars[slot]=(char)(i%2==0?0:65+i);}
            int consumed=0;
            while(${type('hh')}.${method('hh','a(I)Z')}(guard)) {
              check(guard>41 && consumed<count,"poll boundary");
              check((Integer)${get('ki','field_d','I')}==codes[(start+consumed)%128],"poll code");
              check((Character)${get('te','field_a','C')}==chars[(start+consumed)%128],"poll character");consumed++;
            }
            check(consumed==(guard>41?count:0),"poll count");
            check((Integer)${get('vd','field_n','I')}==(start+consumed)%128,"poll cursor wrap");
            check((Integer)${get('ba','field_c','I')}==(end+1)%128 && (Integer)${get('pc','field_p','I')}==end,"poll frame fence");
            if(consumed==0)check((Integer)${get('ki','field_d','I')}==-777 && (Character)${get('te','field_a','C')}==777,"empty poll retains payload");
            check(!Thread.holdsLock(keyboard),"poll monitor released");trace("poll",start,count,guard,consumed);
          }
          int[][] changes={{},{0},{96,~96},{~0,111,~111,97},{1,2,~1,3,~2,~3}};
          for(int start:starts)for(int pattern=0;pattern<changes.length;pattern++)for(boolean reset:new boolean[]{false,true})for(boolean guard:new boolean[]{false,true}) {
            resetKeyboard(keyboard,start,17,11);boolean[] held=(boolean[])${get('kj','field_o','[Z')};
            Arrays.fill(held,true);boolean[] expected=held.clone();int[] queue=(int[])${get('gf','field_c','[I')};
            for(int i=0;i<changes[pattern].length;i++)queue[(start+i)%128]=changes[pattern][i];
            int write=reset?-1:(start+changes[pattern].length)%128;
            ${set('ii','field_c','I','null','write')}${set('re','field_f','Ljava/lang/String;','null','"retained"')}
            if(reset)Arrays.fill(expected,false);else for(int change:changes[pattern])expected[change<0?~change:change]=change>=0;
            ${type('re')}.${method('re','b(Z)V')}(guard);
            check(Arrays.equals(held,expected),"held key replay/reset");
            check((Integer)${get('gk','field_b','I')}==(reset?start:write) && (Integer)${get('ii','field_c','I')}==(reset?start:write),"held queue cursors");
            check((Integer)${get('vd','field_n','I')}==11 && (Integer)${get('pc','field_p','I')}==17,"new frame fence");
            check((Integer)${get('nk','field_e','I')}==8,"keyboard idle increment");
            check(guard?"retained".equals(${get('re','field_f','Ljava/lang/String;')}):${get('re','field_f','Ljava/lang/String;')}==null,"keyboard guard effect");
            check(!Thread.holdsLock(keyboard),"frame monitor released");trace("held",start,pattern,reset?1:0,guard?1:0,Arrays.hashCode(held));
          }
          int[] mapping={-1,0,96,225,85,10,111,82};
          for(int start:starts)for(int code=0;code<10;code++)for(int modifiers:new int[]{0,2,8})for(boolean full:new boolean[]{false,true})for(boolean stateFull:new boolean[]{false,true})for(boolean release:new boolean[]{false,true}) {
            int next=(start+1)%128;resetKeyboard(keyboard,full?next:(start+2)%128,start,0);
            ${set('gk','field_b','I','null','stateFull?next:start')}
            ${set('ii','field_c','I','null','start')}
            ${set('oe','field_P','[I','null','mapping.clone()')}
            java.awt.event.KeyEvent event=new java.awt.event.KeyEvent(canvas,release?java.awt.event.KeyEvent.KEY_RELEASED:java.awt.event.KeyEvent.KEY_PRESSED,0,modifiers,code,'x');
            java.awt.event.KeyListener listener=(java.awt.event.KeyListener)keyboard;
            if(release)listener.keyReleased(event);else listener.keyPressed(event);
            int translated=code<mapping.length?mapping[code]:-1;
            translated=release?(translated & ~128):((translated & 128)==0?translated:-1);
            boolean queued=translated>=0;
            int[] stateQueue=(int[])${get('gf','field_c','[I')};int[] eventQueue=(int[])${get('kj','field_O','[I')};
            check((Integer)${get('ii','field_c','I')}==(queued?(stateFull?-1:next):start),"listener state write/overflow");
            if(queued)check(stateQueue[start]==(release?~translated:translated),"listener state encoding");
            boolean eventAdded=queued&&!release&&!full;
            check((Integer)${get('ba','field_c','I')}==(eventAdded?next:start),"listener event fullness");
            if(eventAdded)check(eventQueue[start]==translated && ((char[])${get('ai','field_n','[C')})[start]==0,"press payload");
            check((Integer)${get('nk','field_e','I')}==0,"callback idle reset");
            check(event.isConsumed()==(release || (modifiers&10)!=0 || translated==85 || translated==10),"key consumption");
            trace("key",start,code,modifiers,full?1:0,stateFull?1:0,release?1:0,translated,eventAdded?1:0);
          }
          for(int start:starts)for(int character:new int[]{0,1,31,32,65,127,128,159,160,255,256,8364,8218,402,8230,352,338,8482,376,0xd800,65535})for(boolean active:new boolean[]{false,true})for(boolean full:new boolean[]{false,true}) {
            resetKeyboard(active?keyboard:null,full?(start+1)%128:(start+2)%128,start,0);
            java.awt.event.KeyEvent event=new java.awt.event.KeyEvent(canvas,java.awt.event.KeyEvent.KEY_TYPED,0,0,java.awt.event.KeyEvent.VK_UNDEFINED,'x');
            // Include sentinel payloads that the AWT constructor rejects.
            event.setKeyChar((char)character);
            ((java.awt.event.KeyListener)keyboard).keyTyped(event);
            boolean accepted=character>0&&character<128 || character>=160&&character<=255 || Arrays.binarySearch(new int[]{338,352,376,402,8218,8230,8364,8482},character)>=0;
            boolean added=active&&accepted&&!full;
            check((Integer)${get('ba','field_c','I')}==(added?(start+1)%128:start),"typed queue index");
            if(added)check(((int[])${get('kj','field_O','[I')})[start]==-1 && ((char[])${get('ai','field_n','[C')})[start]==character,"typed payload");
            check(event.isConsumed(),"typed event consumed");trace("typed",start,character,active?1:0,full?1:0,added?1:0);
          }
          for(int start:starts) {
            resetKeyboard(keyboard,start,start,0);((java.awt.event.FocusListener)keyboard).focusLost(new java.awt.event.FocusEvent(canvas,java.awt.event.FocusEvent.FOCUS_LOST));
            check((Integer)${get('ii','field_c','I')}==-1,"focus reset sentinel");trace("focus",start);
          }
          Object pointer=ResultHelperBehavior.allocate("${type('le')}");
          String[] operations={"mouseMoved","mouseDragged","mouseEntered","mouseExited","mousePressed","mouseReleased","mouseClicked","focusLost"};
          for(String operation:operations)for(int[] xy:new int[][]{{-1,-1},{0,0},{320,240},{639,479}})for(int button:new int[]{0,1,3})for(boolean active:new boolean[]{false,true})for(boolean popup:new boolean[]{false,true}) {
            ${set('pg','field_c','Lle;','null','active?pointer:null')}
            ${set('gh','field_P','I','null','13')}${set('lj','field_b','I','null','31')}${set('eg','field_h','I','null','29')}
            ${set('ah','field_e','I','null','37')}${set('hi','field_C','I','null','43')}${set('vd','field_a','I','null','2')}
            ${set('s','field_I','I','null','1')}${set('fc','field_f','Z','null','false')}
            if(operation.equals("focusLost"))((java.awt.event.FocusListener)pointer).focusLost(new java.awt.event.FocusEvent(canvas,java.awt.event.FocusEvent.FOCUS_LOST));
            else {
              java.awt.event.MouseEvent event=new java.awt.event.MouseEvent(canvas,java.awt.event.MouseEvent.MOUSE_PRESSED,0,0,xy[0],xy[1],1,popup,button);
              ResultHelperBehavior.method("${type('le')}",operation,java.awt.event.MouseEvent.class).invoke(pointer,event);
              boolean consumes=popup&&(operation.equals("mousePressed")||operation.equals("mouseReleased")||operation.equals("mouseClicked"));
              check(event.isConsumed()==consumes,"pointer popup consumption");
            }
            boolean motion=operation.equals("mouseMoved")||operation.equals("mouseDragged")||operation.equals("mouseEntered"),exit=operation.equals("mouseExited"),press=operation.equals("mousePressed"),release=operation.equals("mouseReleased"),focus=operation.equals("focusLost");
            int x=active&&motion?xy[0]:active&&exit?-1:31,y=active&&motion?xy[1]:active&&exit?-1:29;
            int pressX=active&&press?xy[0]:37,pressY=active&&press?xy[1]:43,pressButton=active&&press?(button==3?2:1):2;
            int held=active&&press?pressButton:active&&(release||focus)?0:1;
            boolean changed=active&&(motion||exit||press||release);
            check((Integer)${get('gh','field_P','I')}==(changed?0:13),"pointer idle state");
            ${set('pg','field_c','Lle;','null','pointer')}
            ${type('mc')}.${method('mc','a(B)V')}((byte)-128);
            check((Integer)${get('qa','field_a','I')}==x && (Integer)${get('ue','field_e','I')}==y,"pointer position snapshot");
            check((Integer)${get('mc','field_a','I')}==pressX && (Integer)${get('he','field_d','I')}==pressY,"press position snapshot");
            check((Integer)${get('bi','field_g','I')}==pressButton && (Integer)${get('gf','field_a','I')}==held,"button snapshots");
            check((Boolean)${get('wb','field_a','Z')}==changed && !(Boolean)${get('fc','field_f','Z')} && (Integer)${get('vd','field_a','I')}==0,"pending pointer state consumed");
            ${type('mc')}.${method('mc','a(B)V')}((byte)-128);
            check((Integer)${get('bi','field_g','I')}==0 && !(Boolean)${get('wb','field_a','Z')} && (Integer)${get('gf','field_a','I')}==held,"press consumed once; held retained");
            check(!Thread.holdsLock(pointer),"pointer monitor released");trace(operation,xy[0],xy[1],button,active?1:0,popup?1:0,x,y,pressX,pressY,pressButton,held,changed?1:0);
          }
          check(cases==2184,"input case count");System.out.println("input-complete:"+cases);
        }
      }

      class MusicScoreBehavior extends ResultHelperBehavior {
        static class Event {
          int kind, channel, a, b, delta, track, ordinal; long tick;
          Event(int kind,int channel,int a,int b,int delta) {this.kind=kind;this.channel=channel;this.a=a;this.b=b;this.delta=delta;}
        }
        static void u16(java.io.ByteArrayOutputStream out,int value) {out.write(value>>>8);out.write(value);}
        static void i32(java.io.ByteArrayOutputStream out,int value) {out.write(value>>>24);out.write(value>>>16);out.write(value>>>8);out.write(value);}
        static void vlq(java.io.ByteArrayOutputStream out,int value) {
          int shift=0;while((value>>>(shift+7))!=0 && shift<21)shift+=7;
          for(;shift>=0;shift-=7)out.write(((value>>>shift)&127)|(shift==0?0:128));
        }
        static int stream(int controller) {
          switch(controller) {
            case 0:case 32:return 14;case 1:return 4;case 33:return 11;
            case 7:return 5;case 39:return 12;case 10:return 6;case 42:return 13;
            case 99:return 16;case 98:return 17;case 101:return 18;case 100:return 19;
            case 64:case 65:case 120:case 121:case 123:return 0;default:return 9;
          }
        }
        static byte[] pack(List<List<Event>> tracks,int division) throws Exception {
          java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream(),deltas=new java.io.ByteArrayOutputStream(),controllers=new java.io.ByteArrayOutputStream();
          java.io.ByteArrayOutputStream[] values=new java.io.ByteArrayOutputStream[21];for(int i=0;i<values.length;i++)values[i]=new java.io.ByteArrayOutputStream();
          int channel=0,note=0,on=0,off=0,pitch=0,pressure=0,poly=0,controller=0;
          int[] controls=new int[128];
          for(List<Event> track:tracks)for(Event e:track) {
            out.write(e.kind>=7?e.kind:e.kind|((channel^e.channel)<<4));
            if(e.kind<7)channel=e.channel;
            vlq(deltas,e.delta);
            switch(e.kind) {
              case 0:case 1:case 5:
                values[7].write(e.a-note);note=e.a;
                if(e.kind==0){values[8].write(e.b-on);on=e.b;}
                else if(e.kind==1){values[10].write(e.b-off);off=e.b;}
                else {values[1].write(e.b-poly);poly=e.b;}break;
              case 2:
                controllers.write(e.a-controller);controller=e.a;
                values[stream(e.a)].write(e.b-controls[e.a]);controls[e.a]=e.b;break;
              case 3:
                int change=e.a-pitch;int low=change&127;int high=(change-low)>>7;
                check(change==low+(high<<7)&&high==(byte)high,"representable pitch delta");
                values[15].write(low);values[3].write(high);pitch=e.a;break;
              case 4:values[2].write(e.a-pressure);pressure=e.a;break;
              case 6:values[14].write(e.a);break;
              case 23:values[20].write(e.a>>>16);values[20].write(e.a>>>8);values[20].write(e.a);break;
              case 7:break;default:throw new AssertionError("fixture event");
            }
          }
          out.write(deltas.toByteArray());out.write(controllers.toByteArray());for(java.io.ByteArrayOutputStream v:values)out.write(v.toByteArray());
          out.write(tracks.size());u16(out,division);return out.toByteArray();
        }
        // Build the expected standard chunks directly from absolute event values.
        // This does not use the packed stream counts/cursors or delta reconstruction.
        static byte[] midi(List<List<Event>> tracks,int division) throws Exception {
          java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
          i32(out,0x4d546864);i32(out,6);u16(out,tracks.size()>1?1:0);u16(out,tracks.size());u16(out,division);
          int[] statuses={144,128,176,224,208,160,192};
          for(List<Event> track:tracks) {
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();int lastStatus=-1;
            for(Event e:track) {
              vlq(bytes,e.delta);int status=e.kind<7?statuses[e.kind]+e.channel:255;
              if(status!=lastStatus||e.kind==23)bytes.write(status);lastStatus=status;
              switch(e.kind) {
                case 0:case 1:case 2:case 5:bytes.write(e.a);bytes.write(e.b);break;
                case 3:bytes.write(e.a&127);bytes.write((e.a>>>7)&127);break;
                case 4:case 6:bytes.write(e.a);break;
                case 7:bytes.write(47);bytes.write(0);break;
                case 23:bytes.write(81);bytes.write(3);bytes.write(e.a>>>16);bytes.write(e.a>>>8);bytes.write(e.a);break;
                default:throw new AssertionError();
              }
            }
            i32(out,0x4d54726b);i32(out,bytes.size());out.write(bytes.toByteArray());
          }
          return out.toByteArray();
        }
        static List<List<Event>> fixture(int shape,int channel,int velocity,int delta,int seed) {
          List<List<Event>> tracks=new ArrayList<>();
          for(int t=0;t<(shape==3?2:1);t++) {
            List<Event> events=new ArrayList<>();int c=(channel+t)&15,n=(seed*31+t*17)&127;
            if(shape!=0) {
              events.add(new Event(23,0,400000+seed*33333,0,delta));
              events.add(new Event(0,c,n,velocity,delta));
              events.add(new Event(0,c,(n+1)&127,127,delta));
              events.add(new Event(6,c,(seed*19+t)&127,0,delta));
              if(shape>=2) {
                for(int control:new int[]{0,32,1,33,7,39,10,42,99,98,101,100,64,65,120,121,123,11,127}) {
                  events.add(new Event(2,c,control,(control*3+seed+t)&127,delta));
                  events.add(new Event(2,c,control,(control*7+seed+t)&127,0));
                }
                events.add(new Event(6,c,(seed*23+t)&127,0,delta));
                events.add(new Event(3,c,8192,0,delta));events.add(new Event(3,c,0,0,delta));
                events.add(new Event(3,c,16383,0,delta));
                events.add(new Event(4,c,127,0,delta));events.add(new Event(4,c,0,0,delta));
                events.add(new Event(5,c,n,127,delta));events.add(new Event(5,c,(n+1)&127,0,delta));
              }
              events.add(new Event(0,c,(n+2)&127,velocity,delta));
              events.add(new Event(1,c,n,64,delta));events.add(new Event(1,c,(n+2)&127,0,delta));
            }
            events.add(new Event(7,0,0,0,delta));long tick=0;int index=0;
            for(Event e:events){tick+=e.delta;e.tick=tick;e.track=t;e.ordinal=index++;}tracks.add(events);
          }
          return tracks;
        }
        static SortedMap<Integer,byte[]> masks(List<List<Event>> tracks) {
          List<Event> ordered=new ArrayList<>();for(List<Event> track:tracks)ordered.addAll(track);
          Collections.sort(ordered,(a,b)->a.tick!=b.tick?Long.compare(a.tick,b.tick):a.track!=b.track?Integer.compare(a.track,b.track):Integer.compare(a.ordinal,b.ordinal));
          int[] banks=new int[16],programs=new int[16];banks[9]=programs[9]=128;
          SortedMap<Integer,byte[]> result=new TreeMap<>();
          for(Event e:ordered) {
            if(e.kind==2&&e.a==0)banks[e.channel]=(banks[e.channel]&~(127<<14))|(e.b<<14);
            if(e.kind==2&&e.a==32)banks[e.channel]=(banks[e.channel]&~(127<<7))|(e.b<<7);
            if(e.kind==6)programs[e.channel]=banks[e.channel]+e.a;
            if(e.kind==0&&e.b>0){int instrument=programs[e.channel];if(!result.containsKey(instrument))result.put(instrument,new byte[128]);result.get(instrument)[e.a]=1;}
          }
          return result;
        }
        static void checkMasks(Object table,SortedMap<Integer,byte[]> wanted) throws Exception {
          Method first=method("${type('fi')}","${method('fi','a(B)Lhf;')}",byte.class);
          Method next=method("${type('fi')}","${method('fi','b(I)Lhf;')}",int.class);
          SortedMap<Integer,byte[]> actual=new TreeMap<>();Object node=first.invoke(table,(byte)125);
          while(node!=null){int key=(int)(long)(Long)${get('hf','field_a','J','node')};check(!actual.containsKey(key),"unique instrument key");actual.put(key,(byte[])${get('pj','field_h','[B','node')});node=next.invoke(table,-100);}
          check(actual.keySet().equals(wanted.keySet()),"instrument key oracle");
          for(int key:wanted.keySet())check(Arrays.equals(actual.get(key),wanted.get(key)),"instrument note mask oracle");
        }
        public static void main(String[] args) throws Exception {
          Method collect=method("${type('rf')}","${method('rf','b()V')}");Method clear=method("${type('rf')}","${method('rf','a()V')}");
          Class<?> bufferType=Class.forName("${type('qc')}");int cases=0;
          for(int shape=0;shape<4;shape++)for(int channel=0;channel<16;channel++)for(int seed=0;seed<4;seed++)for(int delta:new int[]{0,1,127,128,16384,0x1fffff}) {
            int velocity=new int[]{0,1,64,127}[seed],division=new int[]{1,96,480,32767}[seed];
            List<List<Event>> tracks=fixture(shape,channel,velocity,delta,seed);byte[] packed=pack(tracks,division),before=packed.clone(),wanted=midi(tracks,division);
            Object buffer=construct("${type('qc')}",new Class<?>[]{byte[].class},packed);
            Object score=construct("${type('rf')}",new Class<?>[]{bufferType},buffer);
            byte[] decoded=(byte[])${get('rf','field_f','[B','score')};
            check(Arrays.equals(decoded,wanted),"exact MIDI oracle case "+cases+" actual="+ArchiveSectorBehavior.digest(decoded)+" wanted="+ArchiveSectorBehavior.digest(wanted));
            check(Arrays.equals(packed,before),"packed score unmodified");check(${get('rf','field_g','Lfi;','score')}==null,"instrument cache initially absent");
            collect.invoke(score);Object table=${get('rf','field_g','Lfi;','score')};SortedMap<Integer,byte[]> notes=masks(tracks);checkMasks(table,notes);
            collect.invoke(score);check(${get('rf','field_g','Lfi;','score')}==table,"idempotent collection");clear.invoke(score);check(${get('rf','field_g','Lfi;','score')}==null,"clear cache");
            check(${get('rf','field_f','[B','score')}==decoded,"clearing retains MIDI array");collect.invoke(score);Object rebuilt=${get('rf','field_g','Lfi;','score')};check(rebuilt!=table,"rebuild cache identity");checkMasks(rebuilt,notes);
            Object reader=construct("${type('jb')}",new Class<?>[]{byte[].class},decoded);
            Method count=method("${type('jb')}","${method('jb','g()I')}");Method loaded=method("${type('jb')}","${method('jb','f()Z')}");Method restart=method("${type('jb')}","${method('jb','a(J)V')}",long.class);
            Method time=method("${type('jb')}","${method('jb','d(I)J')}",int.class);Method select=method("${type('jb')}","${method('jb','c()I')}");
            check((Integer)count.invoke(reader)==tracks.size()&&(Boolean)loaded.invoke(reader),"reader header/loaded");check((Integer)${get('jb','field_d','I','reader')}==division,"reader division");
            restart.invoke(reader,123456789L);check((Integer)select.invoke(reader)==0,"equal tick tie picks first track");
            int[] ticks=(int[])${get('jb','field_a','[I','reader')};for(int tick:ticks)check(tick==delta,"restart reads first delta");
            check((Long)time.invoke(reader,7)==123456789L+7L*500000L,"initial tempo time oracle");
            method("${type('jb')}","${method('jb','a()V')}").invoke(reader);check(!(Boolean)loaded.invoke(reader),"unload");
            check(${get('jb','field_e','[I','reader')}==null&&${get('jb','field_a','[I','reader')}==null&&${get('jb','field_c','[I','reader')}==null&&${get('jb','field_i','[I','reader')}==null,"unload releases track arrays");
            System.out.println("music:"+shape+":"+channel+":"+seed+":"+delta+":"+ArchiveSectorBehavior.digest(decoded)+":"+notes.keySet()+":"+${get('qc','field_f','I','buffer')});cases++;
          }
          for(byte[] input:new byte[][]{null,new byte[0],new byte[1],new byte[2],new byte[]{8,0,1,0,96},new byte[]{7,0,1,0,96},new byte[]{0,7,0,0,1,0,96}}) {
            Object buffer=construct("${type('qc')}",new Class<?>[]{byte[].class},(Object)input);String failure="ok";
            try{construct("${type('rf')}",new Class<?>[]{bufferType},buffer);}catch(InvocationTargetException error){failure=error.getCause().getClass().getName();}
            System.out.println("music-failure:"+cases+":"+failure+":"+${get('qc','field_f','I','buffer')});cases++;
          }

          for(int shape=0;shape<8;shape++)for(int tempo:new int[]{0,500000,1000000,0xffffff})for(int tick:new int[]{0,1,127,32767}) {
            java.io.ByteArrayOutputStream body=new java.io.ByteArrayOutputStream();vlq(body,tick);int expectedEvent;
            if(shape==0){body.write(new byte[]{(byte)255,1,2,3,4});expectedEvent=3;}
            else if(shape==1||shape==2){body.write(shape==1?240:247);body.write(new byte[]{3,1,2,3});expectedEvent=0;}
            else if(shape==3){body.write(new byte[]{(byte)247,1,(byte)246});expectedEvent=246;}
            else if(shape==4){body.write(new byte[]{(byte)247,2,(byte)241,55});expectedEvent=241|(55<<8);}
            else if(shape==5||shape==6){body.write(255);body.write(81);body.write(shape==5?3:5);body.write(tempo>>>16);body.write(tempo>>>8);body.write(tempo);if(shape==6)body.write(new byte[]{9,10});expectedEvent=2;}
            else {body.write(new byte[]{(byte)144,60,64,0,61,0});expectedEvent=144|(60<<8)|(64<<16);}
            body.write(new byte[]{0,(byte)255,47,0});
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();i32(bytes,0x4d546864);i32(bytes,6);u16(bytes,0);u16(bytes,1);u16(bytes,480);
            if((shape&1)!=0){i32(bytes,0x4a554e4b);i32(bytes,3);bytes.write(new byte[]{7,8,9});}
            i32(bytes,0x4d54726b);i32(bytes,body.size());bytes.write(body.toByteArray());
            Object reader=construct("${type('jb')}",new Class<?>[]{byte[].class},(Object)bytes.toByteArray());
            method("${type('jb')}","${method('jb','a(J)V')}",long.class).invoke(reader,123L);
            Method seek=method("${type('jb')}","${method('jb','a(I)V')}",int.class),event=method("${type('jb')}","${method('jb','e(I)I')}",int.class);
            Method delta=method("${type('jb')}","${method('jb','f(I)V')}",int.class),save=method("${type('jb')}","${method('jb','b(I)V')}",int.class);
            seek.invoke(reader,0);int actual=(Integer)event.invoke(reader,0);check(actual==expectedEvent,"reader meta/system/packed event oracle");
            long expectedTime=123L+(long)tick*500000L+2L*(shape==5||shape==6?tempo:500000);
            check((Long)method("${type('jb')}","${method('jb','d(I)J')}",int.class).invoke(reader,tick+2)==expectedTime,"tempo continuity oracle");
            if(shape==7){delta.invoke(reader,0);check((Integer)event.invoke(reader,0)==(144|(61<<8)),"running-status data event oracle");}
            delta.invoke(reader,0);check((Integer)event.invoke(reader,0)==1,"end-of-track oracle");
            method("${type('jb')}","${method('jb','d()V')}").invoke(reader);save.invoke(reader,0);
            check((Boolean)method("${type('jb')}","${method('jb','e()Z')}").invoke(reader),"all tracks ended");
            check((Integer)method("${type('jb')}","${method('jb','c()I')}").invoke(reader)==-1,"ended track excluded");
            System.out.println("music-reader:"+shape+":"+tempo+":"+tick+":"+actual+":"+expectedTime);cases++;
          }
          check(cases==1671,"music case count");System.out.println("music-complete:"+cases+":1536:128");
        }
      }

      class InstrumentPatchBehavior extends MusicScoreBehavior {
        static class Envelope {
          byte[] volume,release;int decay,volumeScale,releaseScale,decayScale,phase,depth,ramp;
          Envelope(int mode,int seed,int index) {
            int v=mode==1?2:mode==3?3:0,r=mode==2||mode==3?2:0;
            if(v>0){volume=new byte[2*v];for(int i=0;i<v;i++){volume[2*i]=(byte)(i*(index+2));volume[2*i+1]=(byte)(64-i*32+seed);}}
            if(r>0){release=new byte[2*r+2];release[1]=64;for(int i=1;i<=r;i++)release[2*i]=(byte)(i*(index+2));for(int i=1;i<r;i++)release[2*i+1]=(byte)(32+seed);}
            decay=mode==0?0:seed+index+1;volumeScale=v>0?seed+2:0;releaseScale=r>0?seed+3:0;decayScale=decay>0?seed+4:0;
            phase=(seed+index)%3==0?0:index+1;depth=phase>0&&(seed+index)%2==0?7:0;ramp=depth>0?seed+5:0;
          }
        }
        static class Patch {
          int segments,shape,seed,mode,curves;int[] ids;Envelope[] envelopes;int[] keys,gain,pan;
          Patch(int shape,int segments,int mode,int curves,int seed) {
            this.shape=shape;this.segments=segments;this.seed=seed;this.mode=mode;this.curves=curves;
            ids=new int[segments];envelopes=new Envelope[segments];
            for(int i=0;i<segments;i++){ids[i]=shape==0?0:shape==1?1:shape==2?(i%2==0?2:5):shape==3?(i==0?0:i+2):new int[]{4,7,10,17}[i];envelopes[i]=new Envelope(mode,seed,i);}
            keys=curves==3?new int[]{16,64,112}:new int[]{32,96};
            if(curves==1||curves==3)gain=curves==3?new int[]{-32,64,127}:new int[]{32,96};
            if(curves==2||curves==3)pan=curves==3?new int[]{-64,64,0}:new int[]{-32,32};
          }
        }
        static void runs(java.io.ByteArrayOutputStream out,Patch p){for(int i=1;i<p.segments;i++)out.write(128/p.segments);out.write(0);}
        static byte[] packPatch(Patch p) {
          java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();runs(out,p);for(int i=0;i<p.segments;i++)out.write(new int[]{0,1,127,-128}[i]);
          runs(out,p);for(int i=0;i<p.segments;i++)out.write(new int[]{-16,0,16,8}[i]);
          runs(out,p);for(int i=2;i<p.segments;i++)out.write(0);
          for(Envelope e:p.envelopes){out.write(e.volume==null?0:e.volume.length/2);out.write(e.release==null?0:(e.release.length-2)/2);}
          out.write(p.gain==null?0:p.keys.length);out.write(p.pan==null?0:p.keys.length);runs(out,p);
          for(int i=0;i<128;i++)out.write(new int[]{0,1,127,255}[p.seed]);
          for(int i=0;i<128;i++)out.write(new int[]{0,1,2,255}[p.seed]);
          for(int id:p.ids)vlq(out,id);
          for(int i=0;i<p.segments;i++)if(p.ids[i]>0)out.write(new int[]{0,63,127,255}[(p.seed+i)&3]);
          out.write(new int[]{0,127,255,63}[p.seed]);
          for(Envelope e:p.envelopes){if(e.volume!=null)for(int i=1;i<e.volume.length;i+=2)out.write(e.volume[i]);if(e.release!=null)for(int i=3;i<e.release.length-2;i+=2)out.write(e.release[i]);}
          if(p.gain!=null)for(int v:p.gain)out.write(v);if(p.pan!=null)for(int v:p.pan)out.write(v);
          for(Envelope e:p.envelopes)if(e.release!=null)for(int i=2;i<e.release.length;i+=2)out.write((e.release[i]&255)-(e.release[i-2]&255)-1);
          for(Envelope e:p.envelopes)if(e.volume!=null)for(int i=2;i<e.volume.length;i+=2)out.write((e.volume[i]&255)-(e.volume[i-2]&255)-1);
          if(p.gain!=null){out.write(p.keys[0]);for(int i=1;i<p.keys.length;i++)out.write(p.keys[i]-p.keys[i-1]-1);}
          if(p.pan!=null){out.write(p.keys[0]);for(int i=1;i<p.keys.length;i++)out.write(p.keys[i]-p.keys[i-1]-1);}
          for(Envelope e:p.envelopes)out.write(e.decay);
          for(Envelope e:p.envelopes){if(e.volume!=null)out.write(e.volumeScale);if(e.release!=null)out.write(e.releaseScale);if(e.decay>0)out.write(e.decayScale);}
          for(Envelope e:p.envelopes)out.write(e.phase);for(Envelope e:p.envelopes)if(e.phase>0)out.write(e.depth);for(Envelope e:p.envelopes)if(e.depth>0)out.write(e.ramp);
          return out.toByteArray();
        }
        static int curve(int key,int[] keys,int[] values,int factor) {
          if(key<keys[0])return values[0]*factor;
          for(int i=1;i<keys.length;i++)if(key<keys[i]) {
            int width=keys[i]-keys[i-1],left=values[i-1]*factor,right=values[i]*factor;
            return Math.floorDiv(left*width+width/2+(right-left)*(key-keys[i-1]),width);
          }
          return values[values.length-1]*factor;
        }
        static int integer(Object object,String f) throws Exception {return (Integer)get("${type('t')}",f,object);}
        static void checkEnvelope(Object actual,Envelope e) throws Exception {
          check(Arrays.equals((byte[])${get('t','field_f','[B','actual')},e.volume)&&Arrays.equals((byte[])${get('t','field_e','[B','actual')},e.release),"envelope pair oracle");
          check(integer(actual,"${field('t','field_c','I')}")==e.decay&&integer(actual,"${field('t','field_g','I')}")==e.volumeScale&&integer(actual,"${field('t','field_a','I')}")==e.releaseScale&&integer(actual,"${field('t','field_h','I')}")==e.decayScale,"envelope key-scaling oracle");
          check(integer(actual,"${field('t','field_d','I')}")==e.phase&&integer(actual,"${field('t','field_b','I')}")==e.depth&&integer(actual,"${field('t','field_j','I')}")==e.ramp,"vibrato parameter oracle");
        }
        static String failure(Throwable error) throws Exception {
          if(error==null)return "ok";
          if(error.getClass().getName().equals("${type('sa')}"))return ((Throwable)${get('sa','field_a','Ljava/lang/Throwable;','error')}).getClass().getName()+":"+${get('sa','field_d','Ljava/lang/String;','error')};
          return error.getClass().getName();
        }
        public static void main(String[] args) throws Exception {
          int cases=0,decodes=0,loads=0,clears=0,floors=0,wrappers=0,truncations=0;
          for(int shape=0;shape<5;shape++)for(int segments:new int[]{1,2,4})for(int mode=0;mode<4;mode++)for(int curves=0;curves<4;curves++)for(int seed=0;seed<4;seed++) {
            Patch expected=new Patch(shape,segments,mode,curves,seed);byte[] packed=packPatch(expected),before=packed.clone();
            Object patch=construct("${type('vl')}",new Class<?>[]{byte[].class},(Object)packed);
            int[] ids=(int[])${get('vl','field_h','[I','patch')};short[] pitch=(short[])${get('vl','field_j','[S','patch')};byte[] groups=(byte[])${get('vl','field_i','[B','patch')},pans=(byte[])${get('vl','field_m','[B','patch')},volumes=(byte[])${get('vl','field_o','[B','patch')};Object[] envelopes=(Object[])${get('vl','field_f','[Lt;','patch')},samples=(Object[])${get('vl','field_k','[Lgd;','patch')};
            check(ids.length==128&&pitch.length==128&&groups.length==128&&pans.length==128&&volumes.length==128&&envelopes.length==128&&samples.length==128,"128-key allocation oracle");
            Object[] shared=new Object[segments];int active=0,volume=0;int[] expectedVolume=new int[segments];
            for(int i=0;i<segments;i++){if(expected.ids[i]>0)volume=(byte)(new int[]{0,63,127,255}[(seed+i)&3]+1);expectedVolume[i]=volume;}
            for(int key=0;key<128;key++) {
              int zone=key/(128/segments),id=expected.ids[zone];check(ids[key]==id&&samples[key]==null,"initial sample ID/reference oracle");
              short wantedPitch=(short)(new int[]{0,1,127,255}[seed]*(key+1)+(new int[]{0,1,2,255}[seed]*(key+1)<<8)+(((id-1)<<14)&32768));check(pitch[key]==wantedPitch,"pitch/flag wrapping oracle");
              int wantedPan=0,wantedGroup=0;
              if(id!=0){int group=active++/(128/segments);wantedGroup=(byte)(new int[]{0,1,127,-128}[group]-1);wantedPan=(byte)((new int[]{-16,0,16,8}[group]+16)<<2);check(envelopes[key]!=null,"active key envelope");if(shared[group]==null)shared[group]=envelopes[key];else check(shared[group]==envelopes[key],"shared envelope identity");checkEnvelope(envelopes[key],expected.envelopes[group]);}
              else check(envelopes[key]==null,"inactive key envelope");
              check(groups[key]==(byte)wantedGroup,"exclusive key group oracle");
              int wantedVolume=expectedVolume[zone];if(expected.gain!=null)wantedVolume=(byte)((wantedVolume*curve(key,expected.keys,expected.gain,1)+32)>>6);
              if(expected.pan!=null)wantedPan=Math.max(0,Math.min(128,(wantedPan&255)+curve(key,expected.keys,expected.pan,2)));
              check(volumes[key]==(byte)wantedVolume&&pans[key]==(byte)wantedPan,"gain/pan curve oracle "+cases+":"+key);
            }
            for(int i=0;i<segments;i++)for(int j=0;j<i;j++)if(shared[i]!=null&&shared[j]!=null)check(shared[i]!=shared[j],"distinct envelope allocations");
            check((Integer)${get('vl','field_g','I','patch')}==new int[]{0,127,255,63}[seed]+1,"global volume oracle");check(Arrays.equals(packed,before),"packed patch retained");
            System.out.println("patch:"+shape+":"+segments+":"+mode+":"+curves+":"+seed+":"+Arrays.hashCode(ids)+":"+Arrays.hashCode(pitch)+":"+ArchiveSectorBehavior.digest(groups)+":"+ArchiveSectorBehavior.digest(pans)+":"+ArchiveSectorBehavior.digest(volumes));cases++;decodes++;
          }
          Method load=method("${type('vl')}","${method('vl','a([I[BILci;)Z')}",int[].class,byte[].class,int.class,Class.forName("${type('ci')}"));
          Method clear=method("${type('vl')}","${method('vl','a(B)V')}",byte.class);
          for(int provider=0;provider<4;provider++)for(int maskKind=0;maskKind<4;maskKind++)for(int guard:new int[]{-1,8,9,Integer.MAX_VALUE}) {
            Object patch=allocate("${type('vl')}");int[] ids=new int[128];for(int key=0;key<128;key++)ids[key]=new int[]{1,2,3,4,5,6,0}[(key/8)%7];int[] wantedIds=ids.clone();Object[] samples=(Object[])java.lang.reflect.Array.newInstance(Class.forName("${type('gd')}"),128),wantedSamples=new Object[128];
            ${set('vl','field_h','[I','patch','ids')}${set('vl','field_k','[Lgd;','patch','samples')}${set('vl','field_q','Z','null','false')}
            byte[] mask=maskKind==0?null:new byte[maskKind==3?64:128];if(mask!=null)for(int key=0;key<mask.length;key++)mask[key]=(byte)(maskKind==1?0:maskKind==3||key%3==0?1:0);
            Object cache=null;Object[][] cached=new Object[2][3];
            if(provider!=3) {
              Object archive=allocate("${type('rh')}"),index=allocate("${type('bm')}");${set('bm','field_k','[I','index','new int[]{32}')}${set('rh','field_c','Lbm;','archive','index')}
              cache=construct("${type('ci')}",new Class<?>[]{Class.forName("${type('rh')}"),Class.forName("${type('rh')}")},archive,archive);Object table=${get('ci','field_b','Lfi;','cache')};
              Method put=method("${type('fi')}","${method('fi','a(BLhf;J)V')}",byte.class,Class.forName("${type('hf')}"),long.class);
              for(int family=0;family<2;family++)for(int id=0;id<3;id++)if(provider==0||provider==1&&family==0) {
                Object sample=construct("${type('gd')}",new Class<?>[]{int.class,byte[].class,int.class,int.class},22050,new byte[]{(byte)(family*8+id)},0,1);cached[family][id]=sample;put.invoke(table,(byte)102,sample,(long)id^(family==0?0L:4294967296L));
              }
            }
            boolean complete=true;String wantedFailure=null;
            for(int key=0;key<128;key++) {
              if(mask!=null&&key>=mask.length){wantedFailure="java.lang.ArrayIndexOutOfBoundsException";break;}if(mask!=null&&mask[key]==0||wantedIds[key]==0)continue;
              if(provider==3){wantedFailure="java.lang.NullPointerException";break;}
              int code=wantedIds[key]-1;Object sample=cached[code&1][code>>2];if(sample==null)complete=false;else{wantedSamples[key]=sample;wantedIds[key]=0;}
            }
            Boolean result=null;Throwable error=null;int[] budget={0};
            try{result=(Boolean)load.invoke(patch,budget,mask,guard,cache);}catch(InvocationTargetException thrown){error=thrown.getCause();}
            String status=failure(error);check(wantedFailure==null?error==null:status.startsWith(wantedFailure+":"),"sample-load failure oracle");if(error==null)check(result==complete,"sample-load completeness oracle");
            check(Arrays.equals(ids,wantedIds),"resolved IDs cleared; unresolved IDs preserved");for(int key=0;key<128;key++)check(samples[key]==wantedSamples[key],"cached sample alias oracle");check(budget[0]==0,"cached/failed sample budget unchanged");
            check((Boolean)${get('vl','field_q','Z')}==(error==null&&guard<=8),"guard side-effect order");
            System.out.println("patch-load:"+provider+":"+maskKind+":"+guard+":"+result+":"+status+":"+Arrays.hashCode(ids));cases++;loads++;
            for(byte clearGuard:new byte[]{-128,-94,-93,127}) {
              short[] pitches=new short[128];int[] encoded=new int[128];${set('vl','field_j','[S','patch','pitches')}${set('vl','field_h','[I','patch','encoded')}
              clear.invoke(patch,clearGuard);check(${get('vl','field_h','[I','patch')}==null,"encoded sample IDs released");check(${get('vl','field_j','[S','patch')}==(clearGuard>-94?null:pitches),"pitch guard cleanup oracle");check(${get('vl','field_k','[Lgd;','patch')}==samples,"resolved samples retained");
              System.out.println("patch-clear:"+provider+":"+maskKind+":"+guard+":"+clearGuard);cases++;clears++;
            }
          }
          Method floor=method("${type('pk')}","${method('pk','a(IBI)I')}",int.class,byte.class,int.class);
          for(int divisor:new int[]{1,2,3,7,64,127,Integer.MAX_VALUE})for(int numerator:new int[]{Integer.MIN_VALUE,Integer.MIN_VALUE+1,-10001,-129,-128,-127,-1,0,1,127,128,129,10001,Integer.MAX_VALUE}) {
            int value=(Integer)floor.invoke(null,divisor,(byte)-6,numerator);check(value==Math.floorDiv(numerator,divisor),"positive-divisor floor oracle");System.out.println("patch-floor:"+divisor+":"+numerator+":"+value);cases++;floors++;
          }
          Method wrap=method("${type('t')}","${method('t','a(Ljava/lang/Throwable;Ljava/lang/String;)Lsa;')}",Throwable.class,String.class);
          for(int kind=0;kind<3;kind++)for(String context:new String[]{null,"","next","ñ"}) {
            Throwable cause=kind==0?null:new RuntimeException("cause");Object old=kind==2?wrap.invoke(null,cause,"first"):cause;Object wrapped=wrap.invoke(null,old,context);
            check(${get('sa','field_a','Ljava/lang/Throwable;','wrapped')}==cause,"context original-cause identity");check(Objects.equals(${get('sa','field_d','Ljava/lang/String;','wrapped')},kind==2?"first "+context:context),"context text oracle");check(kind!=2||wrapped==old,"context wrapper reuse");
            System.out.println("patch-context:"+kind+":"+context+":"+${get('sa','field_d','Ljava/lang/String;','wrapped')});cases++;wrappers++;
          }
          byte[] full=packPatch(new Patch(4,4,3,3,3));
          for(int length=-1;length<full.length;length++) {
            byte[] input=length<0?null:Arrays.copyOf(full,length);Throwable error=null;
            try{construct("${type('vl')}",new Class<?>[]{byte[].class},(Object)input);}catch(InvocationTargetException thrown){error=thrown.getCause();}
            check(error!=null,"truncated patch must fail");String status=failure(error);check(status.contains("vl.<init>("),"original patch diagnostic context");System.out.println("patch-truncated:"+length+":"+status);cases++;truncations++;
          }
          check(decodes==960&&loads==64&&clears==256&&floors==98&&wrappers==12,"patch case inventory");
          System.out.println("patch-complete:"+cases+":"+decodes+":"+loads+":"+clears+":"+floors+":"+wrappers+":"+truncations);
        }
      }
`;
    const soundHarness = `
      class SynthesizedSoundBehavior extends ResultHelperBehavior {
        static Object buffer(byte[] bytes) throws Exception {return construct("${type('qc')}",new Class<?>[]{byte[].class},(Object)bytes);}
        static Object envelope(int value) throws Exception {
          Object envelope=construct("${type('uc')}",new Class<?>[0]);
          ${set('uc','field_i','[I','envelope','new int[]{value,value}')}
          ${set('uc','field_e','I','envelope','1')}
          return envelope;
        }
        static void shortBE(java.io.DataOutputStream out,int value) throws Exception {out.writeShort(value);}
        static byte[] envelopeBytes() throws Exception {
          java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
          out.writeByte(3);out.writeInt(-12345);out.writeInt(98765);out.writeByte(3);
          for(int[] point:new int[][]{{0,0},{32768,32768},{65535,65535}}){shortBE(out,point[0]);shortBE(out,point[1]);}
          return bytes.toByteArray();
        }
        static String failure(Throwable error) {return error==null?"ok":error.getClass().getName();}
        public static void main(String[] args) throws Exception {
          int cases=0,flat=0,ramps=0,truncated=0,filters=0,effects=0;
          Method reset=method("${type('uc')}","${method('uc','a()V')}");
          Method step=method("${type('uc')}","${method('uc','a(I)I')}",int.class);
          Method decodeEnvelope=method("${type('uc')}","${method('uc','a(Lqc;)V')}",Class.forName("${type('qc')}"));
          for(int level:new int[]{0,1,32768,65535})for(int length:new int[]{0,1,2,8,32,65536}) {
            Object env=envelope(level);
            for(int repeat=0;repeat<2;repeat++) {
              reset.invoke(env);int[] actual=new int[40];
              for(int i=0;i<actual.length;i++){actual[i]=(Integer)step.invoke(env,length);check(actual[i]==level,"flat envelope independent oracle");}
              check((Integer)${get('uc','field_b','I','env')}==40,"envelope sample counter");
              System.out.println("sound-flat:"+level+":"+length+":"+repeat+":"+Arrays.hashCode(actual));cases++;flat++;
            }
          }
          byte[] encoded=envelopeBytes();
          for(int repeat=0;repeat<3;repeat++) {
            Object env=construct("${type('uc')}",new Class<?>[0]),input=buffer(encoded);
            decodeEnvelope.invoke(env,input);check((Integer)${get('qc','field_f','I','input')}==encoded.length,"envelope exact decode cursor");
            check((Integer)${get('uc','field_e','I','env')}==3&&(Integer)${get('uc','field_j','I','env')}==-12345&&(Integer)${get('uc','field_g','I','env')}==98765,"envelope header oracle");
            check(Arrays.equals((int[])${get('uc','field_c','[I','env')},new int[]{0,32768,65535})&&Arrays.equals((int[])${get('uc','field_i','[I','env')},new int[]{0,32768,65535}),"envelope point oracle");
            // Fixed-point increments truncate before shifting: the penultimate
            // segment sample is 54612, rather than a rounded linear sample.
            int[] wanted={0,8192,16384,24576,32768,43690,54612,65535,65535,65535,65535,65535},actual=new int[wanted.length];
            reset.invoke(env);for(int i=0;i<actual.length;i++)actual[i]=(Integer)step.invoke(env,8);
            check(Arrays.equals(actual,wanted),"explicit piecewise ramp oracle: "+Arrays.toString(actual));
            System.out.println("sound-ramp:"+repeat+":"+Arrays.toString(actual));cases++;ramps++;
          }
          for(int length=-1;length<encoded.length;length++) {
            Object env=construct("${type('uc')}",new Class<?>[0]),input=buffer(length<0?null:Arrays.copyOf(encoded,length));Throwable error=null;
            try{decodeEnvelope.invoke(env,input);}catch(InvocationTargetException thrown){error=thrown.getCause();}
            check(error!=null,"truncated envelope fails");
            System.out.println("sound-truncated:"+length+":"+failure(error)+":"+${get('qc','field_f','I','input')}+":"+${get('uc','field_e','I','env')}+":"+${get('uc','field_j','I','env')}+":"+${get('uc','field_g','I','env')}+":"+Arrays.toString((int[])${get('uc','field_c','[I','env')})+":"+Arrays.toString((int[])${get('uc','field_i','[I','env')}));cases++;truncated++;
          }
          Method decodeFilter=method("${type('ub')}","${method('ub','a(Lqc;Luc;)V')}",Class.forName("${type('qc')}"),Class.forName("${type('uc')}"));
          Method compute=method("${type('ub')}","${method('ub','a(IF)I')}",int.class,float.class);
          for(int packed:new int[]{0,16,1,17,68})for(int mask:new int[]{0,255})for(float fraction:new float[]{0,0.5f,1,Float.NaN}) {
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);out.writeByte(packed);
            int[] counts={packed>>4,packed&15};
            if(packed!=0){shortBE(out,0);shortBE(out,mask==0?0:1024);out.writeByte(mask);
              for(int channel=0;channel<2;channel++)for(int pair=0;pair<counts[channel];pair++){shortBE(out,channel*8192+pair*512);shortBE(out,mask==0?0:6400+pair*100);}
              if(mask!=0){for(int channel=0;channel<2;channel++)for(int pair=0;pair<counts[channel];pair++){shortBE(out,16384+channel*4096+pair*256);shortBE(out,3200+pair*80);}out.write(envelopeBytes(),9,13);}
            }
            Object filter=construct("${type('ub')}",new Class<?>[0]),env=envelope(0),input=buffer(bytes.toByteArray());decodeFilter.invoke(filter,input,env);
            check((Integer)${get('qc','field_f','I','input')}==bytes.size(),"filter exact decode cursor");
            check(Arrays.equals((int[])${get('ub','field_b','[I','filter')},counts),"filter pair counts");
            ${set('ub','field_f','[[F','null','new float[2][8]')}${set('ub','field_g','[[I','null','new int[2][8]')}
            int left=(Integer)compute.invoke(filter,0,fraction),right=(Integer)compute.invoke(filter,1,fraction);int[][] coefficients=(int[][])${get('ub','field_g','[[I')};
            check(left==counts[0]*2&&right==counts[1]*2,"coefficient count oracle");
            if(mask==0&&!Float.isNaN(fraction)){check((Integer)${get('ub','field_a','I')}==65536,"unity filter forward scale");check(Arrays.deepEquals(coefficients,new int[2][8]),"zero-radius filter coefficients");}
            float[][] floats=(float[][])${get('ub','field_f','[[F')};int[][] bits=new int[2][8];for(int c=0;c<2;c++)for(int i=0;i<8;i++)bits[c][i]=Float.floatToIntBits(floats[c][i]);
            System.out.println("sound-filter:"+packed+":"+mask+":"+Float.floatToIntBits(fraction)+":"+left+":"+right+":"+${get('ub','field_a','I')}+":"+Float.floatToIntBits((Float)${get('ub','field_d','F')})+":"+Arrays.deepToString(coefficients)+":"+Arrays.deepToString(bits));cases++;filters++;
          }
          Method render=method("${type('fg')}","${method('fg','b()[B')}");Method toSample=method("${type('fg')}","${method('fg','a()Lgd;')}");
          for(int count:new int[]{0,1,2,3,10})for(int polarity:new int[]{-1,1})for(int delay:new int[]{0,3}) {
            byte[] packed=new byte[14];packed[11]=2;packed[13]=9;Object input=buffer(packed);
            Object effect=construct("${type('fg')}",new Class<?>[]{Class.forName("${type('qc')}")},input);
            Object[] instruments=(Object[])${get('fg','field_a','[Led;','effect')};
            check(instruments.length==10&&(Integer)${get('qc','field_f','I','input')}==14,"effect decode slots/cursor");
            for(int i=0;i<count;i++) {
              Object instrument=construct("${type('ed')}",new Class<?>[0]);instruments[i]=instrument;
              ${set('ed','field_t','Luc;','instrument','envelope(0)')}${set('ed','field_o','Luc;','instrument','envelope(32767)')}
              ${set('ed','field_e','Lub;','instrument','construct("'+type('ub')+'",new Class<?>[0])')}
              ${set('ed','field_a','[I','instrument','new int[]{polarity*100,0,0,0,0}')}
              ${set('ed','field_d','I','instrument','10')}${set('ed','field_v','I','instrument','delay')}
            }
            byte[] actual=(byte[])render.invoke(effect);int offset=22050*delay/1000,length=count==0?0:22050*(10+delay)/1000;
            check(actual.length==length,"effect duration oracle");
            int contribution=polarity==1?63:-64,wanted=Math.max(-128,Math.min(127,count*contribution));
            for(int i=0;i<actual.length;i++)check(actual[i]==(i>=offset&&i<offset+220?wanted:0),"square-wave mixing/delay/saturation oracle "+i);
            Object sample=toSample.invoke(effect);check((Integer)${get('gd','field_h','I','sample')}==22050&&(Integer)${get('gd','field_g','I','sample')}==44&&(Integer)${get('gd','field_j','I','sample')}==198,"sample loop positions in samples");
            check(Arrays.equals((byte[])${get('gd','field_k','[B','sample')},actual),"sample contains rendered signed PCM");
            System.out.println("sound-effect:"+count+":"+polarity+":"+delay+":"+length+":"+Arrays.hashCode(actual));cases++;effects++;
          }
          method("${type('ub')}","${method('ub','a()V')}").invoke(null);
          check(${get('ub','field_f','[[F')}==null&&${get('ub','field_g','[[I')}==null,"filter coefficient cleanup");
          check(flat==48&&ramps==3&&truncated==23&&filters==40&&effects==20,"sound case inventory");
          System.out.println("sound-complete:"+cases+":"+flat+":"+ramps+":"+truncated+":"+filters+":"+effects);
        }
      }
`;
    const timerHarness=`
      class FrameTimerBehavior extends ResultHelperBehavior {
        static Field F(String owner,String name){try{return field(owner,name);}catch(Exception e){throw new AssertionError(e);}}
        static final Field accumulated=F("${type('cm')}","${field('cm','field_e','J')}");
        static final Field scheduled=F("${type('cm')}","${field('cm','field_c','J')}");
        static final Field lastSample=F("${type('cm')}","${field('cm','field_i','J')}");
        static final Field samples=F("${type('cm')}","${field('cm','field_f','[J')}");
        static final Field index=F("${type('cm')}","${field('cm','field_d','I')}");
        static final Field sampleCount=F("${type('cm')}","${field('cm','field_g','I')}");
        static final java.security.MessageDigest trace;
        static int cases,advances,resets,averages,wrappers,ranking,flushes,cleanup,failures;
        static {try{trace=java.security.MessageDigest.getInstance("SHA-256");}catch(Exception e){throw new AssertionError(e);}}
        static void record(String text){try{trace.update((text+"\\n").getBytes("UTF-8"));cases++;}catch(Exception e){throw new AssertionError(e);}}
        static long wrappedAdd(long a,long b){return java.math.BigInteger.valueOf(a).add(java.math.BigInteger.valueOf(b)).longValue();}
        static long[] tickOracle(long time,long deadline,long previous,long period){
          if(deadline>time){long adjusted=java.math.BigInteger.valueOf(previous).add(java.math.BigInteger.valueOf(deadline)).subtract(java.math.BigInteger.valueOf(time)).longValue();return new long[]{deadline,wrappedAdd(deadline,period),adjusted,1};}
          for(int k=1;k<=10;k++){long candidate=java.math.BigInteger.valueOf(deadline).add(java.math.BigInteger.valueOf(period).multiply(java.math.BigInteger.valueOf(k))).longValue();if(candidate>=time||k==10)return new long[]{time,Math.max(time,candidate),previous,k};}
          throw new AssertionError("tick oracle");
        }
        static ${type('cm')} timer(long time,long deadline,long previous,int count,int cursor,long[] ring)throws Exception{
          ${type('cm')} timer=(${type('cm')})allocate("${type('cm')}");accumulated.setLong(timer,time);scheduled.setLong(timer,deadline);lastSample.setLong(timer,previous);sampleCount.setInt(timer,count);index.setInt(timer,cursor);samples.set(timer,ring);return timer;
        }
        static void control(int value)throws Exception{${set('Geoblox','field_C','I','null','value')}}
        static void advanceCases()throws Exception{
          long[] clocks={-100,0,5,100,Long.MIN_VALUE,Long.MAX_VALUE,Long.MIN_VALUE+10,Long.MAX_VALUE-10};
          for(int flag:new int[]{-1,0,1})for(long time:clocks)for(long deadline:clocks)for(long previous:new long[]{0,Long.MAX_VALUE})for(long period:new long[]{-3,0,1,7,Long.MIN_VALUE,Long.MAX_VALUE})for(boolean guard:new boolean[]{false,true}){
            control(flag);long[] ring={1,2,3,4,5,6,7,8,9,10};${type('cm')} timer=timer(time,deadline,previous,2,3,ring);int[] palette={1,2};${set('cm','field_j','[I','null','palette')}${set('cm','field_h','Ljava/lang/String;','null','"Checking"')}
            int ticks=timer.${method('cm','a(ZJ)I')}(guard,period);long[] wanted=tickOracle(time,deadline,previous,period);check(ticks==wanted[3]&&accumulated.getLong(timer)==wanted[0]&&scheduled.getLong(timer)==wanted[1]&&lastSample.getLong(timer)==wanted[2],"tick oracle");check(samples.get(timer)==ring&&sampleCount.getInt(timer)==2&&index.getInt(timer)==3,"tick retains ring");check(${get('cm','field_j','[I')}==(guard?palette:null)&&Objects.equals(${get('cm','field_h','Ljava/lang/String;')},guard?"Checking":null),"tick guard cleanup");record("tick:"+flag+":"+time+":"+deadline+":"+previous+":"+period+":"+guard+":"+Arrays.toString(wanted));advances++;
          }
          for(int flag:new int[]{-1,0,1})for(long time:clocks)for(long deadline:clocks)for(long previous:new long[]{0,Long.MAX_VALUE})for(int guard:new int[]{0,59,60,100}){
            control(flag);long[] ring={1,2,3,4,5,6,7,8,9,10};${type('cm')} timer=timer(time,deadline,previous,2,3,ring);timer.${method('cm','a(I)V')}(guard);check(accumulated.getLong(timer)==Math.max(time,deadline)&&scheduled.getLong(timer)==deadline&&lastSample.getLong(timer)==(guard>=60?0:previous),"reset partial oracle");check(samples.get(timer)==ring&&sampleCount.getInt(timer)==2&&index.getInt(timer)==3,"reset retains ring");record("reset:"+flag+":"+time+":"+deadline+":"+previous+":"+guard);resets++;
          }
        }
        static void averageCases()throws Exception{
          Method average=method("${type('cm')}","${method('cm','d(I)J')}",int.class);
          for(int flag:new int[]{-1,0,1})for(int count:new int[]{0,1,2,10})for(int cursor:new int[]{0,5,9})for(int initial:new int[]{-3,0,5})for(boolean accepted:new boolean[]{false,true}){
            control(flag);long before=System.nanoTime(),seed=wrappedAdd(before,accepted?-1000000:10000000000L);long[] ring={-10,20,-30,40,-50,60,-70,80,-90,100},original=ring.clone();${type('cm')} timer=timer(17,23,seed,count,cursor,ring);long value=0;boolean failed=false;
            try{value=(Long)average.invoke(timer,initial);}catch(InvocationTargetException e){check(!accepted&&count==0&&e.getCause() instanceof ArithmeticException,"average failure");failed=true;failures++;}
            long after=System.nanoTime(),observed=lastSample.getLong(timer),delta=observed-seed;check(observed>=before&&observed<=after,"stored actual clock sample");check((delta>-5000000000L&&delta<5000000000L)==accepted,"controlled interval domain");int wantedCount=accepted&&count<1?count+1:count,wantedIndex=accepted?(cursor+1)%10:cursor;
            long[] wantedRing=original.clone();if(accepted)wantedRing[cursor]=delta;check(Arrays.equals(ring,wantedRing)&&index.getInt(timer)==wantedIndex&&sampleCount.getInt(timer)==wantedCount,"sample ring state");check(accumulated.getLong(timer)==17&&scheduled.getLong(timer)==23,"sampling retains tick clocks");
            long sum=initial;for(int offset=1;offset<=wantedCount;offset++)sum=wrappedAdd(sum,wantedRing[(wantedIndex+10-offset)%10]);check(failed==(wantedCount==0),"average zero count");if(!failed)check(value==sum/wantedCount,"average arithmetic");record("average:"+flag+":"+count+":"+cursor+":"+initial+":"+accepted+":"+failed);averages++;
          }
          for(int flag:new int[]{-1,0,1}){control(flag);long before=System.nanoTime();${type('cm')} timer=new ${type('cm')}();long after=System.nanoTime();check(accumulated.getLong(timer)>=before&&scheduled.getLong(timer)>=accumulated.getLong(timer)&&scheduled.getLong(timer)<=after,"constructor clock samples");check(lastSample.getLong(timer)==0&&sampleCount.getInt(timer)==1&&index.getInt(timer)==0&&Arrays.equals((long[])samples.get(timer),new long[10]),"constructor interval state");record("constructor:"+flag);averages++;}
        }
        static class ProbeTimer extends ${type('cj')} {
          final StringBuilder calls=new StringBuilder();long delay;int failAt=-1;Throwable failure;
          void ${method('cj','a(I)V')}(int guard){throw new AssertionError("unused reset");}
          long ${method('cj','a(B)J')}(byte guard){calls.append("sample:").append(guard).append(';');if(failAt==0)fail();return delay;}
          int ${method('cj','a(ZJ)I')}(boolean guard,long period){calls.append("advance:").append(guard).append(':').append(period).append(';');if(failAt==1)fail();return 3;}
          void fail(){if(failure instanceof Error)throw (Error)failure;throw (RuntimeException)failure;}
        }
        static void wrapperCases()throws Exception{
          for(byte guard:new byte[]{-6,0,7})for(long period:new long[]{0,1,Long.MAX_VALUE})for(long delay:new long[]{-1,0,1})for(int failAt:new int[]{-1,0,1})for(boolean error:new boolean[]{false,true}){
            ProbeTimer timer=new ProbeTimer();timer.delay=delay;timer.failAt=failAt;timer.failure=error?new AssertionError("clock-callback"):new IllegalArgumentException("clock-callback");boolean shouldFail=failAt==0||failAt==1&&guard==-6,failed=false;int value=0;
            try{value=timer.${method('cj','a(BJ)I')}(guard,period);}catch(RuntimeException e){check(shouldFail&&!error&&e==timer.failure,"clock runtime identity");failed=true;failures++;}catch(Error e){check(shouldFail&&error&&e==timer.failure,"clock Error identity");failed=true;failures++;}
            check(failed==shouldFail,"wrapper failure order");if(!failed)check(value==(guard==-6?3:-30),"wrapper result");String wanted="sample:-49;"+(failAt!=0&&guard==-6?"advance:true:"+period+";":"");check(timer.calls.toString().equals(wanted),"wrapper callback order");record("wrapper:"+guard+":"+period+":"+delay+":"+failAt+":"+error+":"+failed+":"+timer.calls);wrappers++;
          }
          for(int guard:new int[]{-60,-59,-58,0}){int[] components={1,2};${set('cj','field_b','[I','null','components')}${set('cj','field_a','Ljava/lang/String;','null','"record"')}method("${type('cj')}","${method('cj','b(I)V')}",int.class).invoke(null,guard);check(${get('cj','field_a','Ljava/lang/String;')}==null&&${get('cj','field_b','[I')}==(guard<=-59?null:components),"frame resource guard");record("cleanup:"+guard);cleanup++;}
        }
        static byte[] response(int limit,int values,boolean names)throws Exception{
          java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);out.writeByte(0);out.writeShort(777);out.writeByte(names?3:0);
          if(names){out.writeBytes("Other");out.writeByte(0);out.writeByte(1);out.writeBytes("alias");out.writeByte(0);out.writeBytes("SELF");out.writeByte(0);out.writeByte(0);out.writeByte(3);
            for(int row=0;row<3;row++){out.writeByte(row);out.writeLong(40+row);for(int col=0;col<values;col++)out.writeInt(100*row+col+1);}}
          return bytes.toByteArray();
        }
        static void rankingCase(int flag,int limit,int values,boolean names,int prefix)throws Exception{
          control(flag);byte[] complete=response(limit,values,names),bytes=prefix<0?complete:Arrays.copyOf(complete,prefix);${type('pk')} packet=new ${type('pk')}(bytes);${set('eh','field_d','Lpk;','null','packet')}${set('wd','field_f','Ljava/lang/String;','null','"Self"')}${set('vg','field_b','Ljava/lang/String;','null','"self"')}
          ${type('mg')} query=new ${type('mg')}();query.${field('mg','field_i','I')}=777;query.${field('mg','field_f','I')}=limit;query.${field('mg','field_l','I')}=values;String[][] oldNames={{"old"}};int[][] oldValues={{-7}};query.${field('mg','field_k','[[Ljava/lang/String;')}=oldNames;query.${field('mg','field_h','[[I')}=oldValues;
          ${type('tf')} pending=new ${type('tf')}();pending.${method('tf','a(ILhf;)V')}(-71,query);${set('rh','field_d','Ltf;','null','pending')}
          ${type('lc')}[] table=new ${type('lc')}[3];for(int i=0;i<3;i++)table[i]=new ${type('lc')}();${set('id','field_b','[Llc;','null','table')}
          String failure="ok";try{method("${type('cm')}","${method('cm','c(I)V')}",int.class).invoke(null,-24839);}catch(InvocationTargetException e){Object underlying=get("${type('sa')}","${field('sa','field_a','Ljava/lang/Throwable;')}",e.getCause());check(prefix>=0&&underlying instanceof RuntimeException,"truncated ranking failure");failure=underlying.getClass().getSimpleName();failures++;}
          if(prefix<0){check(query.${field('mg','field_j','Z')},"ranking completion");check(pending.${method('tf','g(I)Lhf;')}(0)==null,"query unlinked");check(packet.${field('qc','field_f','I')}==complete.length,"ranking cursor");
            if(!names)check(query.${field('mg','field_k','[[Ljava/lang/String;')}==oldNames&&query.${field('mg','field_h','[[I')}==oldValues,"zero names retains views");
            else{String[] primary={"Self","Other","SELF"};int[][] sourceRows={{0,1,2},{0,2},{0,1,2}};
              for(int view=0;view<3;view++)for(int row=0;row<limit;row++){int available=view==1?2:Math.min(3,limit);String wanted=row<available?(view==1?"Self":primary[sourceRows[view][row]]):null;check(Objects.equals(query.${field('mg','field_k','[[Ljava/lang/String;')}[view][row],wanted),"ranking view names");for(int col=0;col<values;col++)check(query.${field('mg','field_h','[[I')}[view][row*values+col]==(row<available?100*sourceRows[view][row]+col+1:0),"ranking view values");}
              check(table[0].${field('lc','field_c','Z')}&&table[1].${field('lc','field_c','Z')}&&table[2].${field('lc','field_c','Z')}==(limit>=3),"unique name-index state");check(Objects.equals(table[1].${field('lc','field_a','Ljava/lang/String;')},"alias")&&table[2].${field('lc','field_a','Ljava/lang/String;')}==null,"alternate names");}}
          else check(!query.${field('mg','field_j','Z')},"partial query not completed");record("ranking:"+flag+":"+limit+":"+values+":"+names+":"+prefix+":"+failure+":"+packet.${field('qc','field_f','I')}+":"+Arrays.deepToString(query.${field('mg','field_k','[[Ljava/lang/String;')})+":"+Arrays.deepToString(query.${field('mg','field_h','[[I')}));ranking++;
        }
        static void rankingCases()throws Exception{
          for(int flag:new int[]{-1,0,1})for(int limit:new int[]{2,3,4})for(int values:new int[]{0,1,2})for(boolean names:new boolean[]{false,true})rankingCase(flag,limit,values,names,-1);
          int length=response(3,2,true).length;for(int prefix=0;prefix<length;prefix++)rankingCase(0,3,2,true,prefix);
        }
        static void flushCases()throws Exception{
          Method flush=method("${type('cm')}","${method('cm','a(II)V')}",int.class,int.class);
          for(int flag:new int[]{-1,0,1})for(int position:new int[]{0,1,3})for(int guard:new int[]{Integer.MIN_VALUE,-1,0,Integer.MAX_VALUE})for(boolean closed:new boolean[]{false,true})for(boolean allowed:new boolean[]{false,true}){
            control(flag);SocketIoBehavior.Socket fixture=new SocketIoBehavior.Socket();Object socket=SocketIoBehavior.holder(fixture,256,0,closed);${set('oc','field_e','Lba;','null','socket')}
            ${type('pk')} packet=new ${type('pk')}(new byte[]{11,22,33,44});packet.${field('qc','field_f','I')}=position;${set('fj','field_q','Lpk;','null','packet')}
            ${set('pk','field_l','Lgk;','null','null')}long future=${type('oa')}.${method('oa','a(I)J')}(-12520)+100000;${set('v','field_r','J','null','future')}
            flush.invoke(null,guard,allowed?-1:20);boolean attempted=allowed&&guard>~position;check(packet.${field('qc','field_f','I')}==(allowed&&!attempted?position:0),"flush pending position");int queued=(Integer)${get('ba','field_e','I','socket')};check(queued==(attempted&&!closed?position:0),"flush queue length flag="+flag+" pos="+position+" guard="+guard+" closed="+closed+" allowed="+allowed+" actual="+queued+" attempted="+attempted);if(queued>0){byte[] queue=(byte[])${get('ba','field_d','[B','socket')};for(int i=0;i<queued;i++)check(queue[i]==packet.${field('qc','field_j','[B')}[i],"flush queued bytes");}
            long last=(Long)${get('v','field_r','J')};check(attempted?last<future:last==future,"flush clock write timing");record("flush:"+flag+":"+position+":"+guard+":"+closed+":"+allowed+":"+queued+":"+packet.${field('qc','field_f','I')});flushes++;
          }
          ${set('oc','field_e','Lba;','null','null')}
        }
        public static void main(String[] args)throws Exception{
          advanceCases();averageCases();wrapperCases();rankingCases();flushCases();StringBuilder hash=new StringBuilder();for(byte b:trace.digest())hash.append(String.format("%02x",b&255));System.out.println("frame-timer:"+cases+":"+advances+":"+resets+":"+averages+":"+wrappers+":"+ranking+":"+flushes+":"+cleanup+":"+failures+":"+hash);
        }
      }
`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'ResultHelperBehavior.java');
    fs.writeFileSync(harnessFile, harness + soundHarness + timerHarness);
    const stub = path.join(root, 'funorb-stubs.jar');
    const cp = native ? nativeInput + path.delimiter + stub : stub;
    const sourceRoot = path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const sources = native ? [] : sourceInventory(sourceRoot).map(file => path.join(sourceRoot, file.path));
    const list = path.join(directory, 'sources.txt');
    fs.writeFileSync(list, [...sources, harnessFile].map(file => JSON.stringify(file)).join('\n') + '\n');
    captureProcess('javac', ['--release','8','-proc:none','-encoding','UTF-8','-classpath',cp,'-d',classes,'@'+list]);

    const timerOutput=captureProcess('java',['-Djava.awt.headless=true','-cp',classes+path.delimiter+cp,'FrameTimerBehavior']).stdout;
    const timerSha=crypto.createHash('sha256').update(timerOutput).digest('hex');
    console.log(JSON.stringify({variant,frameTimerTrace:timerOutput.toString().trim(),sha256:timerSha}));
    assert.match(timerOutput.toString(),/^frame-timer:6802:4608:1536:219:162:129:144:4:174:[a-f0-9]{64}\n$/);
    assert.equal(timerSha,expectedFrameTimerSha256,variant+': fixed native frame-timer trace');
    if(expectedFrameTimerBaseline===undefined)expectedFrameTimerBaseline=timerOutput;
    else assert.deepEqual(timerOutput,expectedFrameTimerBaseline,variant+': clock arithmetic/guards, ranking views/partial cursor and queued writes');
    const soundOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'SynthesizedSoundBehavior']).stdout;
    const synthesizedSoundSha256 = crypto.createHash('sha256').update(soundOutput).digest('hex');
    console.log(JSON.stringify({variant, synthesizedSoundSha256, completion: soundOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(synthesizedSoundSha256, expectedSynthesizedSoundSha256, variant);
    if (variant === 'native') expectedSynthesizedSoundBaseline = soundOutput;
    if (nativeInput && variant !== 'native') assert.equal(Buffer.compare(soundOutput, expectedSynthesizedSoundBaseline), 0, variant);


    const patchOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'InstrumentPatchBehavior']).stdout;
    const instrumentPatchSha256 = crypto.createHash('sha256').update(patchOutput).digest('hex');
    console.log(JSON.stringify({variant, instrumentPatchSha256, completion: patchOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(instrumentPatchSha256, expectedInstrumentPatchSha256, variant);
    if (variant === 'native') expectedInstrumentPatchBaseline = patchOutput;
    if (nativeInput && variant !== 'native') assert.equal(Buffer.compare(patchOutput, expectedInstrumentPatchBaseline), 0, variant);

    const musicOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'MusicScoreBehavior']).stdout;
    const musicScoreSha256 = crypto.createHash('sha256').update(musicOutput).digest('hex');
    console.log(JSON.stringify({variant, musicScoreSha256, completion: musicOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(musicScoreSha256, expectedMusicScoreSha256, variant);
    if (variant === 'native') expectedMusicScoreBaseline = musicOutput;
    if (nativeInput && variant !== 'native') assert.equal(Buffer.compare(musicOutput, expectedMusicScoreBaseline), 0, variant);

    const output = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'ResultHelperBehavior']).stdout;
    const sha256 = crypto.createHash('sha256').update(output).digest('hex');
    console.log(JSON.stringify({variant, sha256, completion: output.toString().trim().split('\n').at(-1)}));
    assert.equal(sha256, expectedNativeSha256, variant);
    if (expected === undefined) expected = output;
    else assert.equal(Buffer.compare(output, expected), 0, variant);
    const cacheOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'CacheWriteBehavior']).stdout;
    const cacheSha256 = crypto.createHash('sha256').update(cacheOutput).digest('hex');
    console.log(JSON.stringify({variant, cacheSha256, completion: cacheOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(cacheSha256, expectedCacheWriteSha256, variant);
    const archiveOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'ArchiveSectorBehavior']).stdout;
    const archiveSectorSha256 = crypto.createHash('sha256').update(archiveOutput).digest('hex');
    console.log(JSON.stringify({variant, archiveSectorSha256, completion: archiveOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(archiveSectorSha256, expectedArchiveSectorSha256, variant);
    if (variant === 'native') expectedArchiveSectorSha256Baseline = archiveOutput;
    if (nativeInput && variant !== 'native') {
      const actualLines = archiveOutput.toString().split('\n'), nativeLines = expectedArchiveSectorSha256Baseline.toString().split('\n');
      const mismatch = actualLines.findIndex((line, index) => line !== nativeLines[index]);
      assert.equal(mismatch, -1, `${variant}: ${nativeLines[mismatch]} versus ${actualLines[mismatch]}`);
    }
    const shutdownOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'ShutdownBehavior']).stdout;
    const shutdownSha256 = crypto.createHash('sha256').update(shutdownOutput).digest('hex');
    console.log(JSON.stringify({variant, shutdownSha256, completion: shutdownOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(shutdownSha256, expectedShutdownSha256, variant);
    const compressionOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'ArchiveCompressionBehavior']).stdout;
    const archiveCompressionSha256 = crypto.createHash('sha256').update(compressionOutput).digest('hex');
    console.log(JSON.stringify({variant, archiveCompressionSha256, completion: compressionOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(archiveCompressionSha256, expectedArchiveCompressionSha256, variant);
    if (variant === 'native') expectedArchiveCompressionBaseline = compressionOutput;
    if (nativeInput && variant !== 'native') assert.equal(Buffer.compare(compressionOutput, expectedArchiveCompressionBaseline), 0, variant);
    const bzipOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'Bzip2BlockBehavior']).stdout;
    const bzip2BlockSha256 = crypto.createHash('sha256').update(bzipOutput).digest('hex');
    console.log(JSON.stringify({variant, bzip2BlockSha256, completion: bzipOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(bzip2BlockSha256, expectedBzip2BlockSha256, variant);
    if (variant === 'native') expectedBzip2BlockBaseline = bzipOutput;
    if (nativeInput && variant !== 'native') assert.equal(Buffer.compare(bzipOutput, expectedBzip2BlockBaseline), 0, variant);
    const socketIoOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'SocketIoBehavior']).stdout;
    const socketIoSha256 = crypto.createHash('sha256').update(socketIoOutput).digest('hex');
    console.log(JSON.stringify({variant, socketIoSha256, completion: socketIoOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(socketIoSha256, expectedSocketIoSha256, variant);
    const dispatcherShutdownOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'DispatcherShutdownBehavior']).stdout;
    const dispatcherShutdownSha256 = crypto.createHash('sha256').update(dispatcherShutdownOutput).digest('hex');
    console.log(JSON.stringify({variant, dispatcherShutdownSha256, completion: dispatcherShutdownOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(dispatcherShutdownSha256, expectedDispatcherShutdownSha256, variant);
    const inputOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'InputBehavior']).stdout;
    const inputSha256 = crypto.createHash('sha256').update(inputOutput).digest('hex');
    console.log(JSON.stringify({variant, inputSha256, completion: inputOutput.toString().trim().split('\n').at(-1)}));
    assert.equal(inputSha256, expectedInputSha256, variant);
  }
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
