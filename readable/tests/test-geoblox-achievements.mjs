import {publishedReadableRoot, manifestFile} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {sourceInventory} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

// Controlled registration and packet scopes, with independent mask/queue and
// big-endian/CRC oracles. A pre-existing notification avoids asset/font loading.
// Response/retry scopes use in-memory packets and controlled queues/login flags;
// they do not exercise real sockets, unknown response types or empty-panel assets,
// or interpret the tracking integers as a server-side validation algorithm.
const root = publishedReadableRoot;
const nativeInput = process.argv[2] && path.resolve(process.argv[2]);
const aliases = new Map(JSON.parse(fs.readFileSync(manifestFile))
  .renames.map(rule => [rule.symbol, rule.to]));
const expectedNativeSha256 = 'd6c2a9615dc04f73a8983a99f676bb23f2e00cd87573fae3a0701ce552f2dd00';
const expectedAchievementResponseSha256 = '1664da2a05a4a62e4f3a876199e7ac368e929f19e94ac726696fee6751be9e1f';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-achievements-'));
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
  let expected, expectedResponse;
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
      import java.nio.*; import java.util.zip.*; import java.security.*;
      public class AchievementBehavior {
        static final Object unsafe; static final Method allocate;
        static { try { Class<?> c=Class.forName("sun.misc.Unsafe");
          Field f=c.getDeclaredField("theUnsafe"); f.setAccessible(true); unsafe=f.get(null);
          allocate=c.getMethod("allocateInstance",Class.class);
        } catch(Exception e) { throw new RuntimeException(e); } }
        static Object alloc(String c) throws Exception { return allocate.invoke(unsafe,Class.forName(c)); }
        static Field f(String c,String n) throws Exception {
          Field f=Class.forName(c).getDeclaredField(n); f.setAccessible(true); return f; }
        static Object get(String c,String n,Object o) throws Exception { return f(c,n).get(o); }
        static void set(String c,String n,Object o,Object v) throws Exception { f(c,n).set(o,v); }
        static Method m(String c,String n,Class<?>... p) throws Exception {
          Method m=Class.forName(c).getDeclaredMethod(n,p); m.setAccessible(true); return m; }
        static Object deque() throws Exception { Constructor<?> c=Class.forName("${type('tf')}").getDeclaredConstructor();
          c.setAccessible(true); return c.newInstance(); }
        static void check(boolean b,String s) { if(!b)throw new AssertionError(s); }
        public static void main(String[] ignored) throws Exception {
          Method register=m("${type('ra')}","${method('ra','a(III)V')}",int.class,int.class,int.class);
          Method add=m("${type('tf')}","${method('tf','a(ILhf;)V')}",int.class,Class.forName("${type('hf')}"));
          Method pop=m("${type('tf')}","${method('tf','b(B)Lhf;')}",byte.class);
          Method first=m("${type('tf')}","${method('tf','g(I)Lhf;')}",int.class);
          Method init=m("${type('pk')}","${method('pk','a([IZ)V')}",int[].class,boolean.class);
          Method submit=m("${type('sj')}","${method('sj','a(Lp;II)V')}",Class.forName("${type('p')}"),int.class,int.class);
          MessageDigest trace=MessageDigest.getInstance("SHA-256"); int scenarios=0,packets=0;
          for(int control:new int[]{0,7}) for(int id:new int[]{-1,0,4,16,31,32,33,255,256})
          for(boolean tutorial:new boolean[]{false,true}) for(boolean blocked:new boolean[]{false,true})
          for(boolean earned:new boolean[]{false,true}) for(boolean tracked:new boolean[]{false,true})
          for(int guard:new int[]{-88,-47,0}) {
            int bit=1<<id, initialEarned=earned?bit:0, initialTracking=tracked?bit:0;
            int accumulator=id%2==0?Integer.MIN_VALUE:Integer.MAX_VALUE;
            int primary=id*17+1,secondary=id*31-8,checkByte=id^255;
            Object session=alloc("${type('gh')}"),pending=deque(),submissions=deque(),sent=deque();
            Object marker=alloc("${type('nj')}");
            ${set('Geoblox','field_C','I','null','control')}
            ${set('el','field_o','Lgh;','null','session')}
            ${set('gh','field_Y','Z','session','tutorial')}
            ${set('gh','field_K','Z','session','blocked')}
            ${set('gh','field_e','I','session','41')}
            ${set('pb','field_t','Ltf;','null','pending')}
            ${set('ja','field_A','Ltf;','null','submissions')}
            ${set('rh','field_a','Ltf;','null','sent')}
            ${set('vl','field_p','I','null','initialEarned')}
            ${set('ug','field_c','I','null','0x40000000')}
            ${set('dc','field_a','I','null','initialTracking')}
            ${set('el','field_g','I','null','accumulator')}
            ${set('sc','field_f','I','null','primary')}
            ${set('lb','field_b','I','null','secondary')}
            ${set('ra','field_b','Ljava/lang/String;','null','"sentinel"')}
            add.invoke(pending,-80,marker);
            register.invoke(null,checkByte,guard,id);
            boolean accept=!tutorial&&!earned;
            int wantedTracking=accept?initialTracking|bit:initialTracking;
            int wantedAccumulator=accept&&!tracked?accumulator-bit:accumulator;
            check((Integer)${get('vl','field_p','I')}==(accept?initialEarned|bit:initialEarned),"earned mask");
            check((Integer)${get('ug','field_c','I')}==(accept?0x40000000|bit:0x40000000),"new mask");
            check((Integer)${get('dc','field_a','I')}==wantedTracking,"tracking bits");
            check((Integer)${get('el','field_g','I')}==wantedAccumulator,"tracking accumulator overflow");
            check((Integer)${get('gh','field_e','I','session')}==41+(accept?1:0),"new count");
            check((accept&&guard>=-47)?${get('ra','field_b','Ljava/lang/String;')}==null:
              "sentinel".equals(${get('ra','field_b','Ljava/lang/String;')}),"invalid guard side effect");
            // A repeated registration must be a no-op even when the first was blocked from submission.
            register.invoke(null,checkByte,guard,id);
            check((Integer)${get('gh','field_e','I','session')}==41+(accept?1:0),"duplicate count");
            check(pop.invoke(pending,(byte)-118)==marker,"existing notification order");
            Object notification=pop.invoke(pending,(byte)-118);
            check((notification!=null)==accept,"notification presence");
            if(notification!=null)check((Integer)${get('nj','field_h','I','notification')}==id,"notification id");
            check(pop.invoke(pending,(byte)-118)==null,"no duplicate notifications");
            Object record=pop.invoke(submissions,(byte)-118);
            check((record!=null)==(accept&&!blocked),"submission gating");
            check(pop.invoke(submissions,(byte)-118)==null,"no duplicate records");
            if(record!=null) {
              int[] values=new int[]{id,checkByte,wantedTracking,wantedAccumulator,primary,secondary};
              String[] fields=new String[]{"${field('p','field_l','I')}","${field('p','field_h','I')}",
                "${field('p','field_f','I')}","${field('p','field_g','I')}",
                "${field('p','field_j','I')}","${field('p','field_n','I')}"};
              for(int i=0;i<6;i++)check((Integer)get("${type('p')}",fields[i],record)==values[i],"record field "+i);
              Object packet=alloc("${type('pk')}"); byte[] bytes=new byte[64];
              ${set('qc','field_j','[B','packet','bytes')}
              ${set('qc','field_f','I','packet','0')}
              ${set('fj','field_q','Lpk;','null','packet')}
              init.invoke(packet,new int[]{1,2,3,4},false);
              submit.invoke(null,record,-56,4);
              check(first.invoke(sent,0)==record,"record retained for acknowledgement/retry");
              check((Integer)${get('qc','field_f','I','packet')}==25,"packet length");
              check((bytes[1]&255)==23,"length backpatch");
              byte[] body=new byte[23]; ByteBuffer out=ByteBuffer.wrap(body).order(ByteOrder.BIG_ENDIAN);
              out.put((byte)1).put((byte)id).put((byte)checkByte).putInt(wantedTracking)
                .putInt(wantedAccumulator).putInt(primary).putInt(secondary);
              CRC32 crc=new CRC32(); crc.update(body,0,19); out.putInt((int)crc.getValue());
              check(Arrays.equals(body,Arrays.copyOfRange(bytes,2,25)),"independent packet/CRC layout");
              trace.update(Arrays.copyOf(bytes,25)); packets++;
            }
            String state=control+":"+id+":"+tutorial+":"+blocked+":"+earned+":"+tracked+":"+guard
              +":"+wantedTracking+":"+wantedAccumulator+":"+accept+"\\n";
            trace.update(state.getBytes("UTF-8")); scenarios++;
          }
          StringBuilder digest=new StringBuilder(); for(byte b:trace.digest())digest.append(String.format("%02x",b&255));
          System.out.println("complete:"+scenarios+":"+packets+":"+digest);
        }
      }`;
    const responseHarness = `import java.lang.reflect.*; import java.util.*;
      import java.nio.*; import java.util.zip.*; import java.security.*;
      public class AchievementResponseBehavior extends AchievementBehavior {
        static Object packet(byte[] bytes,boolean ciphered) throws Exception {
          Object p=alloc("${type('pk')}");
          ${set('qc','field_j','[B','p','bytes')}
          ${set('qc','field_f','I','p','0')}
          if(ciphered)m("${type('pk')}","${method('pk','a([IZ)V')}",int[].class,boolean.class)
            .invoke(p,new int[]{1,2,3,4},false);
          return p;
        }
        static String failure(Method m,Object... args) throws Exception {
          try { m.invoke(null,args); return "none"; }
          catch(InvocationTargetException e) {
            Throwable t=e.getCause(); if(t.getClass()==Class.forName("${type('sa')}"))
              t=(Throwable)${get('sa','field_a','Ljava/lang/Throwable;','t')};
            return t.getClass().getSimpleName();
          }
        }
        static byte[] payload(int[] values) {
          byte[] body=new byte[23]; ByteBuffer out=ByteBuffer.wrap(body).order(ByteOrder.BIG_ENDIAN);
          out.put((byte)1).put((byte)values[0]).put((byte)values[1]);
          for(int i=2;i<6;i++)out.putInt(values[i]);
          CRC32 crc=new CRC32(); crc.update(body,0,19);out.putInt((int)crc.getValue());return body;
        }
        public static void main(String[] ignored) throws Exception {
          Method add=m("${type('tf')}","${method('tf','a(ILhf;)V')}",int.class,Class.forName("${type('hf')}"));
          Method first=m("${type('tf')}","${method('tf','g(I)Lhf;')}",int.class);
          Method next=m("${type('tf')}","${method('tf','d(I)Lhf;')}",int.class);
          Method response=m("${type('ud')}","${method('ud','b(I)V')}",int.class);
          Method retry=m("${type('ud')}","${method('ud','a(BI)V')}",byte.class,int.class);
          Method request=m("${type('cf')}","${method('cf','a(II)Lqi;')}",int.class,int.class);
          Method update=m("${type('je')}","${method('je','c(B)V')}",byte.class);
          Method hasSixteen=m("${type('qi')}","${method('qi','d(I)Z')}",int.class);
          Constructor<?> queryConstructor=Class.forName("${type('qi')}").getDeclaredConstructor();
          queryConstructor.setAccessible(true);
          MessageDigest trace=MessageDigest.getInstance("SHA-256"); int responses=0,retries=0,requests=0,imports=0;
          for(int control:new int[]{0,7}) for(int kind:new int[]{0,1,2})
          for(int count:new int[]{0,1,3,8,9,255}) for(int queued=0;queued<3;queued++) {
            Object queries=deque(),submissions=deque(); Object[] q=new Object[queued],s=new Object[queued];
            for(int i=0;i<queued;i++) { q[i]=queryConstructor.newInstance(); s[i]=alloc("${type('p')}");
              ${set('qi','field_j','I','q[i]','-123456')}
              add.invoke(queries,-80,q[i]);add.invoke(submissions,-80,s[i]); }
            ${set('Geoblox','field_C','I','null','control')}
            ${set('k','field_e','Ltf;','null','queries')}
            ${set('rh','field_a','Ltf;','null','submissions')}
            ${set('oc','field_e','Lba;','null','null')}
            byte[] bytes=new byte[kind==0?2+4*count:1];bytes[0]=(byte)kind;
            if(kind==0) { bytes[1]=(byte)count;ByteBuffer out=ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN);
              out.position(2);for(int i=0;i<count;i++)out.putInt(i%2==0?Integer.MIN_VALUE+i:Integer.MAX_VALUE-i); }
            Object incoming=packet(bytes,false);
            ${set('eh','field_d','Lpk;','null','incoming')}
            String error=failure(response,119);boolean overflow=kind==0&&count>8;
            check(error.equals(overflow?"ArrayIndexOutOfBoundsException":"none"),"response failure identity");
            int position=(Integer)${get('qc','field_f','I','incoming')};
            check(position==(kind==0?(overflow?38:2+4*count):1),"response consumption before queue checks/failure");
            boolean resolve=kind!=1&&!overflow&&queued>0;
            if(queued>0) {
              check((Boolean)${get('qi','field_f','Z','q[0]')}==resolve,"only resolved query completes");
              int[] values=(int[])${get('qi','field_g','[I','q[0]')};
              if(resolve) { int[] wanted=new int[8];if(kind==0)for(int i=0;i<count;i++)
                  wanted[i]=i%2==0?Integer.MIN_VALUE+i:Integer.MAX_VALUE-i;
                check(Arrays.equals(values,wanted),"eight values and zero padding");
                check((Integer)${get('qi','field_j','I','q[0]')}==wanted[0],"first value is mask"); }
              else {check(values==null,"unresolved values remain null");
                check((Integer)${get('qi','field_j','I','q[0]')}==-123456,"unresolved mask retained");}
            }
            Object current=first.invoke(queries,0); int start=resolve?1:0;
            for(int i=start;i<queued;i++) {check(current==q[i],"query FIFO and identity");current=next.invoke(queries,1);}
            check(current==null,"only first query removed");
            current=first.invoke(submissions,0);start=kind==1&&queued>0?1:0;
            for(int i=start;i<queued;i++) {check(current==s[i],"acknowledgement FIFO and identity");current=next.invoke(submissions,1);}
            check(current==null,"only first acknowledged record removed");
            String state="response:"+control+":"+kind+":"+count+":"+queued+":"+error+":"+position+":"+resolve+"\\n";
            trace.update(state.getBytes("UTF-8"));responses++;
          }
          for(int control:new int[]{0,7}) for(byte guard:new byte[]{-125,-100})
          for(int queryCount=0;queryCount<3;queryCount++) for(int recordCount=0;recordCount<3;recordCount++) {
            Object queries=deque(),submissions=deque();Object[] q=new Object[queryCount],s=new Object[recordCount];
            int[][] values=new int[recordCount][];
            for(int i=0;i<queryCount;i++) {q[i]=queryConstructor.newInstance();add.invoke(queries,-80,q[i]);}
            String[] fields=new String[]{"${field('p','field_l','I')}","${field('p','field_h','I')}",
              "${field('p','field_f','I')}","${field('p','field_g','I')}",
              "${field('p','field_j','I')}","${field('p','field_n','I')}"};
            for(int i=0;i<recordCount;i++) {s[i]=alloc("${type('p')}");
              values[i]=new int[]{16+i,239-i,Integer.MIN_VALUE+i,Integer.MAX_VALUE-i,-i-1,i+8801};
              for(int j=0;j<6;j++)set("${type('p')}",fields[j],s[i],values[i][j]);add.invoke(submissions,-80,s[i]);}
            ${set('Geoblox','field_C','I','null','control')}
            ${set('k','field_e','Ltf;','null','queries')}
            ${set('rh','field_a','Ltf;','null','submissions')}
            ${set('ud','field_a','Ljava/lang/String;','null','"sentinel"')}
            byte[] bytes=new byte[256];Object outgoing=packet(bytes,true);
            ${set('fj','field_q','Lpk;','null','outgoing')}
            int messageLength=25*recordCount+3*queryCount;
            for(int round=0;round<2;round++) {
              check(failure(retry,guard,4).equals("none"),"retry returns");
              check((Integer)${get('qc','field_f','I','outgoing')}==(round+1)*messageLength,"retry packet extent");
              int offset=round*messageLength;
              for(int i=0;i<recordCount;i++) {check((bytes[offset+1]&255)==23,"retry length");
                check(Arrays.equals(payload(values[i]),Arrays.copyOfRange(bytes,offset+2,offset+25)),"retry record order/payload");offset+=25;}
              for(int i=0;i<queryCount;i++) {check(bytes[offset+1]==1&&bytes[offset+2]==2,"retry query version/subtype");offset+=3;}
            }
            Object current=first.invoke(queries,0);for(Object wanted:q){check(current==wanted,"retry retains query identity/order");current=next.invoke(queries,1);}check(current==null,"no extra queries");
            current=first.invoke(submissions,0);for(Object wanted:s){check(current==wanted,"retry retains submission identity/order");current=next.invoke(submissions,1);}check(current==null,"no extra submissions");
            check(guard>-123?${get('ud','field_a','Ljava/lang/String;')}==null:
              "sentinel".equals(${get('ud','field_a','Ljava/lang/String;')}),"retry guard side effect");
            trace.update(Arrays.copyOf(bytes,2*messageLength));retries++;
          }
          for(int control:new int[]{0,7}) for(int opcode:new int[]{4,255,32}) for(int guard:new int[]{94,-51}) {
            Object queries=deque();byte[] bytes=new byte[16];Object outgoing=packet(bytes,true);
            ${set('Geoblox','field_C','I','null','control')}
            ${set('k','field_e','Ltf;','null','queries')}
            ${set('fj','field_q','Lpk;','null','outgoing')}
            String error="none";Object returned=null;
            try{returned=request.invoke(null,opcode,guard);}catch(InvocationTargetException e){error=e.getCause().getClass().getSimpleName();}
            Object queued=first.invoke(queries,0);check(queued!=null,"query queued before guard arithmetic");
            check(!(Boolean)${get('qi','field_f','Z','queued')},"initial query incomplete");
            check(${get('qi','field_g','[I','queued')}==null,"initial query values null");
            check(next.invoke(queries,1)==null,"one query only");
            check(error.equals(guard==94?"none":"ArithmeticException"),"request guard failure");
            int position=(Integer)${get('qc','field_f','I','outgoing')};check(position==(guard==94?3:0),"guard before request bytes");
            if(guard==94){check(returned==queued,"returned query identity");check(bytes[1]==1&&bytes[2]==2,"request version/subtype");}
            trace.update(("request:"+control+":"+opcode+":"+guard+":"+error+"\\n").getBytes("UTF-8"));
            trace.update(Arrays.copyOf(bytes,position));requests++;
          }
          for(int control:new int[]{0,7}) for(int mask:new int[]{0,65536,-1,7})
          for(boolean present:new boolean[]{false,true})for(boolean completed:new boolean[]{false,true})
          for(boolean received:new boolean[]{false,true})for(boolean loginGate:new boolean[]{false,true}) {
            Object query=queryConstructor.newInstance(),pending=deque();
            ${set('Geoblox','field_C','I','null','control')}
            ${set('qi','field_f','Z','query','completed')}
            ${set('qi','field_j','I','query','mask')}
            ${set('vk','field_b','Lqi;','null','present?query:null')}
            ${set('hj','field_c','Z','null','received')}
            ${set('hl','field_G','Z','null','loginGate')}
            ${set('ra','field_d','I','null','31')}
            ${set('ug','field_c','I','null','0x1234')}
            ${set('vl','field_p','I','null','0x202')}
            ${set('ja','field_A','Ltf;','null','pending')}
            check(failure(update,(byte)-123).equals("none"),"mask import returns");
            boolean importMask=!received&&present&&completed;int wanted=importMask?mask:31;
            check((Integer)${get('ra','field_d','I')}==wanted,"received mask");
            check((Boolean)${get('hj','field_c','Z')}==(received||importMask),"received flag");
            check((Integer)${get('ug','field_c','I')}==(importMask?0x1234&~mask:0x1234),"new bits exclude received bits");
            check((Integer)${get('vl','field_p','I')}==(importMask?0x202|mask:0x202),"received bits merged into earned mask");
            check((Boolean)hasSixteen.invoke(null,105)==(wanted>0&&(wanted&65536)!=0),"positive-mask condition for bit16");
            trace.update(("import:"+control+":"+mask+":"+present+":"+completed+":"+received+":"+loginGate+":"+wanted+"\\n").getBytes("UTF-8"));imports++;
          }
          StringBuilder digest=new StringBuilder();for(byte b:trace.digest())digest.append(String.format("%02x",b&255));
          System.out.println("response-complete:"+responses+":"+retries+":"+requests+":"+imports+":"+digest);
        }
      }`;
    const directory = path.join(temporary, variant), classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'AchievementBehavior.java');
    fs.writeFileSync(harnessFile, harness);
    const responseFile = path.join(directory, 'AchievementResponseBehavior.java');
    fs.writeFileSync(responseFile, responseHarness);
    const stub = path.join(root, 'funorb-stubs.jar');
    const cp = native ? nativeInput + path.delimiter + stub : stub;
    const sourceRoot = path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const sources = native ? [] : sourceInventory(sourceRoot).map(file => path.join(sourceRoot, file.path));
    const list = path.join(directory, 'sources.txt');
    fs.writeFileSync(list, [...sources, harnessFile, responseFile].map(file => JSON.stringify(file)).join('\n') + '\n');
    captureProcess('javac', ['--release','8','-proc:none','-encoding','UTF-8','-classpath',cp,'-d',classes,'@'+list]);
    const output = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'AchievementBehavior']).stdout;
    const sha256 = crypto.createHash('sha256').update(output).digest('hex');
    console.log(JSON.stringify({variant, sha256, completion: output.toString().trim()}));
    assert.equal(sha256, expectedNativeSha256, variant);
    if (expected === undefined) expected = output;
    else assert.equal(Buffer.compare(output, expected), 0, variant);
    const responseOutput = captureProcess('java', ['-Djava.awt.headless=true','-cp',classes + path.delimiter + cp,
      'AchievementResponseBehavior']).stdout;
    const responseSha256 = crypto.createHash('sha256').update(responseOutput).digest('hex');
    console.log(JSON.stringify({variant, responseSha256, completion: responseOutput.toString().trim()}));
    assert.equal(responseSha256, expectedAchievementResponseSha256, variant);
    if (expectedResponse === undefined) expectedResponse = responseOutput;
    else assert.equal(Buffer.compare(responseOutput, expectedResponse), 0, variant);
  }
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
