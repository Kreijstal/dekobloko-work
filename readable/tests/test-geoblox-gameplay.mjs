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
if (!nativeInput) throw new Error('Usage: node readable/tests/test-geoblox-gameplay.mjs NATIVE_CLASSES');
const expectedNativeSha256 = '42be694a3c2f9a7a80ec7e0ec910bd312bdba5bc38f30293eb00faddcb17ac79';
// The additional matrix has its own trace; the existing gameplay baseline
// remains independently pinned.
const expectedDifficultySha256 = '8c66899b5955eac3380cc3aefd3cbe17a5063cc68f98cd507ff406cea4ae587b';
const expectedComparatorSha256 = '9be228f7421970f2214c74e8890327f8592f706dc90ccd0d0933e6f2fbe0a604';
const expectedMotionSha256 = '002e562320b82c572202b5df57ea645a7f71630b6f78e379d60fac1a41de1dd4';
const expectedCollisionSpawnSha256 = '4823d8fb380856fb2f1090c741d450b0e10e99919c94bbecaa10a39debecf9d8';
const rules = JSON.parse(fs.readFileSync(manifestFile));
const aliases = new Map(rules.renames.map(rule => [rule.symbol, rule.to]));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-gameplay-'));
try {
  const nativeFiles = [];
  const visit = directory => {
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) visit(file);
      else if (item.name.endsWith('.class')) nativeFiles.push(file);
    }
  };
  visit(nativeInput);
  const nativeHash = crypto.createHash('sha256');
  for (const file of nativeFiles.sort()) {
    const name = Buffer.from(path.relative(nativeInput, file).split(path.sep).join('/'));
    const bytes = fs.readFileSync(file);
    nativeHash.update(name.length + ':'); nativeHash.update(name);
    nativeHash.update(bytes.length + ':'); nativeHash.update(bytes);
  }
  const pin = JSON.parse(fs.readFileSync(path.join(root, '../decompilation/geoblox-provenance.json')))
    .verifiedTransformedClasses;
  assert.equal(nativeFiles.length, pin.files);
  assert.equal(nativeHash.digest('hex'), pin.sha256);
  let expected, expectedDifficulty, expectedComparator;
  for (const variant of ['native', 'original', 'renamed']) {
    const native = variant === 'native', renamed = variant === 'renamed';
    const name = (key, original) => renamed ? aliases.get(key) ?? original : original;
    const type = original => name('C:' + original, original);
    const field = (owner, original, descriptor) => native ? original.replace(/^field_/, '')
      : name(`F:${owner}.${original}:${descriptor}`, original);
    const global = (owner, original, descriptor) => type(owner) + '.' + field(owner, original, descriptor);
    const method = (owner, signature) => name('M:' + owner + '.' + signature, signature.split('(')[0]);
    const call = (owner, signature) => type(owner) + '.' + method(owner, signature);
    const deque = type('tf'), popup = type('me'), entity = type('ja'), raster = type('dm');
    const active = global('md', 'field_a', 'Ltf;'), available = global('ue', 'field_f', 'Ltf;');
    const addLast = method('tf', 'a(ILhf;)V'), empty = method('tf', 'c(I)Z');
    const framebuffer = global('vb', 'field_c', '[I');
    const candidates = global('nk', 'field_f', '[I');
    const candidateCount = global('h', 'field_a', 'I');
    const chain = global('gf', 'field_f', 'I');
    const moving = global('ji', 'field_r', 'Ltf;');
    const staged = global('wd', 'field_e', 'Ltf;');
    const transient = global('bh', 'field_c', 'Ltf;');
    const attached = global('a', 'field_d', 'Ltf;');
    const harness = `public final class GameplayBehavior {
      static int cases,conversionFailures;
      static void check(boolean value, String label) { if (!value) throw new AssertionError(label); }
      static boolean boundary() { return ${call('ld', 'a(I)Z')}(-61); }
      static ${entity} entity(int id,int category,int variant,int kind) {
        return new ${entity}(variant,category,kind,320,240,0,0,0,0,id);
      }
      static boolean link(${entity} a,${entity} b,boolean force) {
        return ${call('ik', 'a(Lja;Lja;Z)Z')}(a,b,force);
      }
      static String state(${entity} e) {
        StringBuilder result=new StringBuilder();
        result.append(e.${field('ja','field_H','I')}).append(':')
          .append(e.${field('ja','field_z','I')}).append(':')
          .append(e.${field('ja','field_C','I')}).append(':')
          .append(e.${field('ja','field_M','I')}).append(':')
          .append(e.${field('ja','field_E','I')}).append(':')
          .append(e.${field('ja','field_L','I')}).append(':')
          .append(e.${field('ja','field_N','I')}).append(':')
          .append(e.${field('ja','field_m','I')}).append(':')
          .append(e.${field('ja','field_B','Z')}).append(':')
          .append(e.${field('ja','field_t','Z')}).append(':')
          .append(e.${field('ja','field_K','Ltf;')}==${moving}).append(':');
        for(${entity} neighbor:e.${field('ja','field_n','[Lja;')})
          result.append(neighbor==null?0:neighbor.${field('ja','field_H','I')}).append(',');
        return result.toString();
      }
      static void ordinaryOracle(${entity} e,${entity}[] neighbors) {
        check(e.${field('ja','field_L','I')}==neighbors.length,"neighbor count");
        int categories=0,variants=0;
        for(int i=0;i<neighbors.length;i++) {
          check(e.${field('ja','field_n','[Lja;')}[i]==neighbors[i],"neighbor order");
          if(e.${field('ja','field_C','I')}==neighbors[i].${field('ja','field_C','I')})categories++;
          if(e.${field('ja','field_M','I')}==neighbors[i].${field('ja','field_M','I')})variants++;
        }
        check(e.${field('ja','field_N','I')}==categories,"category count");
        check(e.${field('ja','field_m','I')}==variants,"variant count");
      }
      static void contacts() {
        ${raster} sprite=new ${raster}(1,1);
        ${global('ke','field_a','[[[Ldm;')}=new ${raster}[1][2][2];
        ${global('s','field_G','[[Ldm;')}=new ${raster}[][]{{sprite,sprite}};
        ${global('jg','field_h','[[I')}=new int[][]{{0,0,0,0,0,0,0}};
        ${global('ka','field_m','[[[Ldm;')}=new ${raster}[1][2][7];
        for(int c=0;c<2;c++)for(int v=0;v<2;v++)${global('ke','field_a','[[[Ldm;')}[0][c][v]=sprite;
        for(int v=0;v<2;v++)java.util.Arrays.fill(${global('ka','field_m','[[[Ldm;')}[0][v],sprite);
        for(int guard=0;guard<2;guard++) {
          ${global('Geoblox','field_C','I')}=guard;
          for(int firstKind=0;firstKind<3;firstKind++)for(int secondKind=0;secondKind<3;secondKind++)
          for(int category=0;category<2;category++)for(int variant=0;variant<2;variant++)
          for(boolean force:new boolean[]{false,true}) {
            ${entity} first=entity(1,0,0,firstKind),second=entity(2,category,variant,secondKind);
            first.${field('ja','field_t','Z')}=true;second.${field('ja','field_t','Z')}=true;
            boolean detached=link(first,second,force);
            check(detached==second.${field('ja','field_B','Z')},"return is second detach flag");
            if(firstKind==0&&secondKind==0) {
              ordinaryOracle(first,force?new ${entity}[0]:new ${entity}[]{second});
              ordinaryOracle(second,force?new ${entity}[0]:new ${entity}[]{first});
              check(detached==force,"forced ordinary detach");
              check(!first.${field('ja','field_B','Z')},"first stays attached");
              check(second.${field('ja','field_t','Z')},"second keeps avatar contact");
            }
            String before=state(first)+"/"+state(second);
            // Duplicate suppression applies while the contact is retained.
            if(first.${field('ja','field_L','I')}>0&&second.${field('ja','field_L','I')}>0) {
              check(!link(first,second,true),"duplicate returns false before force flag");
              check(before.equals(state(first)+"/"+state(second)),"duplicate changes nothing");
            }
            System.out.println("contact:"+guard+":"+firstKind+":"+secondKind+":"+category+":"+variant+":"+force+":"+detached+":"+before);
            cases++;
          }
          // First, middle and sixth slots, plus a missing entity,
          // with starting indices that include, skip or reach the array end.
          for(int target:new int[]{0,2,5,6})for(int start:new int[]{0,2,5,6}) {
            ${entity} center=entity(10,0,0,0);${entity}[] neighbors=new ${entity}[7];
            for(int i=0;i<7;i++)neighbors[i]=entity(i+20,i%2,i/2%2,0);
            for(int i=0;i<6;i++)link(neighbors[i],center,false);
            center.${method('ja','a(Lja;I)V')}(neighbors[target],start);
            java.util.ArrayList<${entity}> wanted=new java.util.ArrayList<${entity}>();
            for(int i=0;i<6;i++)if(i!=target||target<start)wanted.add(neighbors[i]);
            ordinaryOracle(center,wanted.toArray(new ${entity}[0]));
            for(int i=wanted.size();i<6;i++)check(center.${field('ja','field_n','[Lja;')}[i]==null,"cleared tail");
            System.out.println("remove:"+guard+":"+target+":"+start+":"+state(center));cases++;
          }
          // Force-detach an entity with two pre-existing contacts. Each
          // surviving neighbor retains its other contact and matching counts.
          ${entity} a=entity(30,0,0,0),b=entity(31,0,0,0),c=entity(32,0,0,0),d=entity(33,1,1,0);
          link(a,c,false);link(b,c,false);link(b,d,false);
          check(link(a,b,true),"force detach existing neighborhood");
          ordinaryOracle(a,new ${entity}[]{c});ordinaryOracle(b,new ${entity}[0]);
          ordinaryOracle(c,new ${entity}[]{a});ordinaryOracle(d,new ${entity}[0]);
          check(b.${field('ja','field_K','Ltf;')}==${moving},"moving queue selected");
          System.out.println("unlink:"+guard+":"+state(a)+"/"+state(b)+"/"+state(c)+"/"+state(d));cases++;
        }
      }
      static void secondaryQueues() {
        for(int guard=0;guard<2;guard++) {
          ${global('Geoblox','field_C','I')}=guard;
          ${type('wd')}[] queues={new ${type('wd')}(),new ${type('wd')}()};
          java.util.ArrayList<java.util.ArrayList<${entity}>> model=new java.util.ArrayList<java.util.ArrayList<${entity}>>();
          model.add(new java.util.ArrayList<${entity}>());model.add(new java.util.ArrayList<${entity}>());
          ${entity}[] nodes=new ${entity}[7];${deque} primary=new ${deque}();
          ${type('hf')}[] next=new ${type('hf')}[7],previous=new ${type('hf')}[7];
          for(int i=0;i<7;i++){nodes[i]=entity(i+40,0,0,0);primary.${addLast}(-35,nodes[i]);}
          for(int i=0;i<7;i++){next[i]=nodes[i].${field('hf','field_b','Lhf;')};previous[i]=nodes[i].${field('hf','field_c','Lhf;')};}
          java.util.Random random=new java.util.Random(17023);
          for(int step=0;step<160;step++) {
            int q=random.nextInt(2),index=random.nextInt(7),operation=random.nextInt(4);
            ${entity} node=nodes[index];
            if(operation<2) {
              model.get(0).remove(node);model.get(1).remove(node);
              if(operation==0){queues[q].${method('wd','a(Lrc;Z)V')}(node,false);model.get(q).add(0,node);}
              else {queues[q].${method('wd','a(ILrc;)V')}(-45,node);model.get(q).add(node);}
            } else if(operation==2) {
              ${entity} wanted=model.get(q).isEmpty()?null:model.get(q).remove(0);
              check(queues[q].${method('wd','a(Z)Lrc;')}(true)==wanted,"secondary pop identity");
            } else {
              node.${method('rc','a(B)V')}((byte)65);model.get(0).remove(node);model.get(1).remove(node);
            }
            StringBuilder trace=new StringBuilder();
            for(int which=0;which<2;which++) {
              check(queues[which].${method('wd','b(B)I')}((byte)67)==model.get(which).size(),"secondary count");
              ${type('rc')} current=queues[which].${method('wd','c(B)Lrc;')}((byte)121);
              for(${entity} wanted:model.get(which)) {
                check(current==wanted,"secondary traversal order");
                check(current.${field('rc','field_k','Lrc;')}.${field('rc','field_l','Lrc;')}==current,"secondary forward reciprocity");
                check(current.${field('rc','field_l','Lrc;')}.${field('rc','field_k','Lrc;')}==current,"secondary backward reciprocity");
                trace.append(wanted.${field('ja','field_H','I')}).append(',');
                current=queues[which].${method('wd','a(I)Lrc;')}(-59);
              }
              check(current==null,"secondary traversal end");trace.append('/');
            }
            for(int i=0;i<7;i++) {
              check(nodes[i].${field('hf','field_b','Lhf;')}==next[i]&&nodes[i].${field('hf','field_c','Lhf;')}==previous[i],"primary links independent");
              if(!model.get(0).contains(nodes[i])&&!model.get(1).contains(nodes[i]))
                check(nodes[i].${field('rc','field_k','Lrc;')}==null&&nodes[i].${field('rc','field_l','Lrc;')}==null,"secondary unlink clears both links");
            }
            System.out.println("secondary:"+guard+":"+step+":"+q+":"+index+":"+operation+":"+trace);cases++;
          }
        }
      }
      static void conversions() {
        int[][] pairs={{0,1},{0,2},{0,3},{1,2},{1,3},{2,3}};
        for(int guard=0;guard<2;guard++)for(int mode=0;mode<4;mode++)
        for(int root:new int[]{0,3})for(int key=0;key<2;key++)for(int mask=0;mask<64;mask++) {
          ${global('Geoblox','field_C','I')}=guard;
          ${entity}[] nodes=new ${entity}[4];${entity} template=entity(99,key,key,0);
          template.${field('ja','field_u','F')}=1.5f;
          int[] oldKind=new int[4],oldCategory=new int[4],oldVariant=new int[4];
          ${deque} primary=new ${deque}();${type('hf')}[] next=new ${type('hf')}[4],previous=new ${type('hf')}[4];
          for(int i=0;i<4;i++) {
            int kind=mode==1?1:mode==2?2:1+(i+key)%2;
            nodes[i]=entity(i+60,i%2,i%2,kind);nodes[i].${field('ja','field_u','F')}=i+0.25f;
            oldKind[i]=kind;oldCategory[i]=nodes[i].${field('ja','field_C','I')};oldVariant[i]=nodes[i].${field('ja','field_M','I')};
            primary.${addLast}(-35,nodes[i]);
          }
          // Control graph adjacency directly: conversion is tested separately
          // from the contact producer and starts with zero match counters.
          for(int edge=0;edge<6;edge++)if((mask&(1<<edge))!=0) {
            int a=pairs[edge][0],b=pairs[edge][1];
            nodes[a].${field('ja','field_n','[Lja;')}[nodes[a].${field('ja','field_L','I')}++]=nodes[b];
            nodes[b].${field('ja','field_n','[Lja;')}[nodes[b].${field('ja','field_L','I')}++]=nodes[a];
          }
          for(int i=0;i<4;i++){next[i]=nodes[i].${field('hf','field_b','Lhf;')};previous[i]=nodes[i].${field('hf','field_c','Lhf;')};}
          boolean[] reached=new boolean[4];reached[root]=true;
          if(mode!=0)for(int pass=0;pass<4;pass++)for(int edge=0;edge<6;edge++)if((mask&(1<<edge))!=0) {
            int a=pairs[edge][0],b=pairs[edge][1];if(reached[a]||reached[b])reached[a]=reached[b]=true;
          }
          boolean category=mode==2||mode==3,variant=mode==1||mode==3;
          boolean expectedFailure=false;
          for(int i=0;i<4;i++)if(mode==3&&reached[i]&&oldKind[i]==2)expectedFailure=true;
          String outcome="ok";
          try { ${call('bh','a(ZLja;ILja;Z)V')}(category,template,1,nodes[root],variant); }
          catch(${type('sa')} error) {
            check(expectedFailure,"unexpected conversion exception");
            check(error.${field('sa','field_a','Ljava/lang/Throwable;')} instanceof ArrayIndexOutOfBoundsException,"mixed-flag failure cause");
            outcome=error.${field('sa','field_a','Ljava/lang/Throwable;')}.getClass().getSimpleName()+":"+error.${field('sa','field_d','Ljava/lang/String;')};
            conversionFailures++;
          }
          check(outcome.equals("ok")!=expectedFailure,"predicted mixed-flag outcome");
          StringBuilder trace=new StringBuilder();int failedKindTwo=0;
          for(int i=0;i<4;i++) {
            ${entity} node=nodes[i];boolean converted=reached[i]&&mode!=0;
            int degree=node.${field('ja','field_L','I')};
            if(!expectedFailure) {
            check(node.${field('ja','field_z','I')}==(converted?0:oldKind[i]),"conversion reachability/kind");
            check(node.${field('ja','field_C','I')}==(converted&&category?key:oldCategory[i]),"conversion category");
            check(node.${field('ja','field_M','I')}==(converted&&variant?key:oldVariant[i]),"conversion variant");
            check(node.${field('ja','field_N','I')}==(converted&&category?degree:0),"category edge increments");
            check(node.${field('ja','field_m','I')}==(converted&&variant?degree:0),"variant edge increments");
            check(node.${field('ja','field_E','I')}==(converted&&oldKind[i]==2?60:0),"old kind cooldown");
            check(node.${field('ja','field_B','Z')}==(converted&&mode==2),"category-only detachment");
            check((node.${field('ja','field_K','Ltf;')}==${moving})==(converted&&mode==2),"conversion moving marker");
            } else {
              int actualKind=node.${field('ja','field_z','I')};
              if(actualKind==0) {
                check(reached[i],"partial conversion stays in reachable component");
                check(node.${field('ja','field_M','I')}==key,"partial variant write");
                if(oldKind[i]==2) {
                  check(node.${field('ja','field_C','I')}==-1&&node.${field('ja','field_E','I')}==60,"failed kind-two partial write");failedKindTwo++;
                } else check(node.${field('ja','field_C','I')}==key&&node.${field('ja','field_E','I')}==0,"completed kind-one write");
              } else {
                check(actualKind==oldKind[i]&&node.${field('ja','field_C','I')}==oldCategory[i]
                  &&node.${field('ja','field_M','I')}==oldVariant[i]&&node.${field('ja','field_E','I')}==0,"unprocessed entity unchanged");
              }
              check(node.${field('ja','field_N','I')}==node.${field('ja','field_m','I')}
                &&node.${field('ja','field_N','I')}>=0&&node.${field('ja','field_N','I')}<=degree,"partial edge increments");
              check(!node.${field('ja','field_B','Z')}&&node.${field('ja','field_K','Ltf;')}==null,"mixed flags do not detach");
            }
            check(node.${field('hf','field_b','Lhf;')}==next[i]&&node.${field('hf','field_c','Lhf;')}==previous[i],"conversion preserves primary links");
            if(!category)check(node.${field('ja','field_u','F')}==i+0.25f,"variant preserves angle");
            trace.append(state(node)).append(':').append(Float.floatToIntBits(node.${field('ja','field_u','F')})).append('/');
          }
          if(expectedFailure)check(failedKindTwo==1,"exactly one failing kind-two write");
          System.out.println("conversion:"+guard+":"+mode+":"+root+":"+key+":"+mask+":"+outcome+":"+trace);cases++;
        }
      }
      static Object allocate(Class<?> type) throws Exception {
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");
        java.lang.reflect.Field field=unsafe.getDeclaredField("theUnsafe");field.setAccessible(true);
        return unsafe.getMethod("allocateInstance",Class.class).invoke(field.get(null),type);
      }
      static ${type('gh')} session() throws Exception {
        return (${type('gh')})allocate(${type('gh')}.class);
      }
      static String queueState(${deque} queue) {
        StringBuilder result=new StringBuilder();
        ${entity} node=(${entity})queue.${method('tf','g(I)Lhf;')}(0);
        int count=0;
        while(node!=null){result.append(node.${field('ja','field_H','I')}).append(',');
          check(++count<10,"queue cycle");node=(${entity})queue.${method('tf','d(I)Lhf;')}(1);}
        return result.toString();
      }
      static void reconciliation() throws Exception {
        int[][] pairs={{0,1},{0,2},{0,3},{1,2},{1,3},{2,3}};
        ${global('vf','field_L','Ldm;')}=new ${raster}(1,1);
        ${global('bk','field_a','Ldm;')}=new ${raster}(640,480);
        for(int guard=0;guard<2;guard++)for(int geometry=0;geometry<2;geometry++)
        for(boolean rebuild:new boolean[]{false,true})for(boolean contactDirty:new boolean[]{false,true})
        for(int mask=0;mask<64;mask++)for(int anchors=0;anchors<16;anchors++) {
          ${global('Geoblox','field_C','I')}=guard;
          ${global('el','field_o','Lgh;')}=session();
          ${global('a','field_d','Ltf;')}=new ${deque}();${moving}=new ${deque}();${transient}=new ${deque}();
          ${global('ra','field_a','Ltf;')}=new ${deque}();
          ${global('pk','field_o','[Z')}=new boolean[1002];${global('pk','field_o','[Z')}[998]=true;${global('pk','field_o','[Z')}[1001]=true;
          ${global('re','field_j','Z')}=rebuild;${global('w','field_f','Z')}=false;
          ${global('ab','field_f','Z')}=contactDirty;${global('fa','field_a','Z')}=true;
          ${global('rb','field_b','I')}=0;${global('og','field_r','F')}=2.5f;
          ${entity}[] nodes=new ${entity}[4];
          for(int i=0;i<4;i++) {
            nodes[i]=entity(i,i%2,i/2,0);
            nodes[i].${field('ja','field_o','F')}=geometry==0?340+i*10:320;
            nodes[i].${field('ja','field_v','F')}=geometry==0?245+i*5:240;
            nodes[i].${field('ja','field_t','Z')}=(anchors&(1<<i))!=0;
            ${attached}.${addLast}(-35,nodes[i]);
          }
          // Real contact linking supplies neighbor order and matching counts.
          for(int edge=0;edge<6;edge++)if((mask&(1<<edge))!=0)link(nodes[pairs[edge][0]],nodes[pairs[edge][1]],false);
          boolean[] anchored=new boolean[4];
          for(int i=0;i<4;i++)anchored[i]=(anchors&(1<<i))!=0;
          for(int pass=0;pass<4;pass++)for(int edge=0;edge<6;edge++)if((mask&(1<<edge))!=0) {
            int a=pairs[edge][0],b=pairs[edge][1];if(anchored[a]||anchored[b])anchored[a]=anchored[b]=true;
          }
          String outcome="ok";
          try { ${call('kc','b(I)V')}(-90); }
          catch(${type('sa')} error) {
            outcome=error.${field('sa','field_a','Ljava/lang/Throwable;')}.getClass().getSimpleName()+":"+error.${field('sa','field_d','Ljava/lang/String;')};
            if(guard==0)throw new AssertionError("normal reconciliation failure: "+outcome);
          }
          StringBuilder attachedOrder=new StringBuilder(),movingOrder=new StringBuilder(),trace=new StringBuilder();
          boolean detached=false;
          for(int i=0;i<4;i++) {
            ${entity} node=nodes[i];
            if(guard==0) {
              boolean retained=!rebuild||anchored[i];detached|=!retained;
              check(node.${field('ja','field_B','Z')}==!retained,"anchored component or clean connectivity retained");
              check(node.${field('ja','field_K','Ltf;')}==null,"reconciliation clears queue marker");
              check(node.${field('ja','field_t','Z')}==((anchors&(1<<i))!=0),"avatar root preserved");
              if(retained) {
                attachedOrder.append(i).append(',');
                java.util.ArrayList<${entity}> wanted=new java.util.ArrayList<${entity}>();
                for(int edge=0;edge<6;edge++)if((mask&(1<<edge))!=0) {
                  int a=pairs[edge][0],b=pairs[edge][1];if(a==i)wanted.add(nodes[b]);else if(b==i)wanted.add(nodes[a]);
                }
                ordinaryOracle(node,wanted.toArray(new ${entity}[0]));
              } else {
                movingOrder.append(i).append(',');ordinaryOracle(node,new ${entity}[0]);
                if(geometry==1)check(Float.isNaN(node.${field('ja','field_w','F')})&&Float.isNaN(node.${field('ja','field_F','F')}),"center normalization preserves NaN");
                else {
                  float dx=320-node.${field('ja','field_o','F')},dy=240-node.${field('ja','field_v','F')};
                  double magnitude=Math.sqrt(dx*dx+dy*dy);
                  check(Float.floatToIntBits(node.${field('ja','field_w','F')})==Float.floatToIntBits((float)(dx*2.5/magnitude)),"radial x velocity");
                  check(Float.floatToIntBits(node.${field('ja','field_F','F')})==Float.floatToIntBits((float)(dy*2.5/magnitude)),"radial y velocity");
                }
              }
            }
            trace.append(state(node)).append(':').append(Float.floatToIntBits(node.${field('ja','field_w','F')}))
              .append(':').append(Float.floatToIntBits(node.${field('ja','field_F','F')})).append('/');
          }
          String actualAttached=queueState(${attached}),actualMoving=queueState(${moving});
          int visits=0;for(int i=0;i<1000;i++)if(${global('pk','field_o','[Z')}[i])visits++;
          if(guard==0) {
            check(actualAttached.equals(attachedOrder.toString())&&actualMoving.equals(movingOrder.toString()),"reconciliation queue partition/order");
            check(${global('re','field_j','Z')}==detached,"transferred entities dirty connectivity again");
            check(${global('el','field_o','Lgh;')}.${field('gh','field_B','Z')}==rebuild,"connectivity rebuild reported");
            check(${global('el','field_o','Lgh;')}.${field('gh','field_F','Z')}==(detached||contactDirty),"raster dirtiness gates");
            check(visits==(rebuild?0:1)&&${global('pk','field_o','[Z')}[1001],"exact visited range reset only on rebuild");
            check(${global('fa','field_a','Z')}==detached,"unanchored component detach reported");
          }
          System.out.println("reconcile:"+guard+":"+geometry+":"+rebuild+":"+contactDirty+":"+mask+":"+anchors+":"+outcome+":"+trace+":"+actualAttached+":"+actualMoving
            +":"+${global('re','field_j','Z')}+":"+${global('el','field_o','Lgh;')}.${field('gh','field_B','Z')}+":"+${global('el','field_o','Lgh;')}.${field('gh','field_F','Z')}
            +":"+${global('fa','field_a','Z')}+":"+visits+":"+${global('pk','field_o','[Z')}[1001]);cases++;
        }
      }
      static void audio() {
        ${global('qa','field_f','Ltf;')}=new ${deque}();${global('ge','field_d','Lob;')}=new ${type('ob')}();
        ${global('qk','field_j','I')}=22050;${global('j','field_gb','I')}=80;
        ${global('fl','field_c','[Lgd;')}=new ${type('gd')}[33];
        for(int i=0;i<33;i++)${global('fl','field_c','[Lgd;')}[i]=new ${type('gd')}(22050,new byte[32],0,32);
      }
      static int soundSample() {
        ${type('je')} sound=(${type('je')})${global('qa','field_f','Ltf;')}.${method('tf','g(I)Lhf;')}(0);
        if(sound==null)return -1;
        for(int i=0;i<33;i++)if(sound.${field('je','field_g','Lkl;')}.${field('ia','field_g','Le;')}==${global('fl','field_c','[Lgd;')}[i])return i;
        throw new AssertionError("unknown sample identity");
      }
      static void feedback() {
        for(int guard=0;guard<2;guard++)for(int base=0;base<=36;base+=6)
        for(int request=-1;request<=7;request++)for(int hold:new int[]{-1,0,1,110})
        for(boolean clear:new boolean[]{false,true})for(int frame:new int[]{-7,5,37}) {
          ${global('Geoblox','field_C','I')}=guard;audio();
          ${global('ka','field_h','I')}=base;${global('pa','field_g','I')}=hold;
          ${global('nd','field_a','I')}=-5;${global('wa','field_a','I')}=7;${global('uf','field_b','I')}=frame;
          ${raster} sprite=new ${raster}(1,1);${global('jc','field_a','Ldm;')}=sprite;
          int wantedBase=base,wantedHold=hold,wantedMode=-5,wantedEffect=7,wantedFrame=frame,wantedSound=-1;
          if(request==7&&base!=36){wantedBase=36;wantedHold=110;wantedMode=6;wantedSound=23;}
          boolean held=wantedHold>0;
          if(held) {if(request==3){wantedEffect=50;wantedSound=27;}}
          else {
            if(request>=0&&request<=5) {
              wantedBase=request*6;wantedMode=request;
              if(request==3||request==4||request==5)wantedHold=110;
              if(request==3){wantedEffect=50;wantedSound=27;}
              if(request==5)wantedSound=24;
              if(request==0&&base!=0&&base<24)wantedSound=25;
              if(request==2&&base!=12&&base<24)wantedSound=26;
            }
            wantedFrame=frame%6+wantedBase;
          }
          ${call('jc','a(IZ)V')}(request,clear);
          check(${global('ka','field_h','I')}==wantedBase&&${global('pa','field_g','I')}==wantedHold,"feedback base/hold oracle");
          check(${global('nd','field_a','I')}==wantedMode&&${global('wa','field_a','I')}==wantedEffect,"feedback mode/effect oracle");
          check(${global('uf','field_b','I')}==wantedFrame,"feedback frame/remainder oracle");
          check((${global('jc','field_a','Ldm;')}==null)==(clear&&!held),"feedback sprite guard");
          check(${global('qa','field_f','Ltf;')}.${method('tf','a(I)I')}(100)==(wantedSound==-1?0:1)&&soundSample()==wantedSound,"feedback sample identity/count");
          System.out.println("feedback:"+guard+":"+base+":"+request+":"+hold+":"+clear+":"+frame+":"+wantedBase+":"+wantedHold+":"+wantedMode+":"+wantedEffect+":"+wantedFrame+":"+wantedSound);cases++;
        }
      }
      // Compact state model, independent of the recovered duplicated branches.
      // frame, step timer, hold, blink clock, shock timer/frame, tint timer/color.
      static int[] animationState() {
        return new int[]{${global('uf','field_b','I')},${global('af','field_c','I')},
          ${global('pa','field_g','I')},${global('gi','field_e','I')},${global('wa','field_a','I')},
          ${global('ha','field_g','I')},${global('jf','field_j','I')},${global('rj','field_c','I')}};
      }
      static void animationState(int[] state) {
        ${global('uf','field_b','I')}=state[0];${global('af','field_c','I')}=state[1];
        ${global('pa','field_g','I')}=state[2];${global('gi','field_e','I')}=state[3];
        ${global('wa','field_a','I')}=state[4];${global('ha','field_g','I')}=state[5];
        ${global('jf','field_j','I')}=state[6];${global('rj','field_c','I')}=state[7];
      }
      static int[] animationOracle(int[] old,int base,int direction,boolean enabled,int period,
          int color,float red,float green,float blue) {
        int[] next=old.clone();if(!enabled)return next;
        next[1]--;
        if(old[1]<0) {
          next[1]=20;
          int offset=old[0]-base;
          if(offset==0)next[0]=base+3;
          else if(direction==0)next[0]+=Integer.compare(3,offset);
          else if(direction==1&&offset>1)next[0]--;
          else if(direction==2&&offset<5)next[0]++;
        }
        next[2]--;next[3]++;
        if(next[3]%period<30)next[0]=base;
        next[4]--;if(old[4]>0)next[5]=next[4]%15%2;
        next[6]--;
        if(old[6]>0) {
          float factor=(float)(50-old[6])*0.0066999997943639755f;
          next[7]=color+((int)(red*factor)<<16)+((int)(green*factor)<<8)+(int)(blue*factor);
        }
        return next;
      }
      static void advanceAnimation(boolean gameplay,byte guard,int period) {
        if(gameplay)${call('f','o(I)V')}(period);
        else ${call('qa','b(B)V')}(guard);
      }
      static void animation() throws Exception {
        ${global('el','field_o','Lgh;')}=session();
        ${global('el','field_o','Lgh;')}.${field('gh','field_x','Z')}=false;
        int matrix=0;
        for(boolean gameplay:new boolean[]{false,true})for(int guard=0;guard<2;guard++)
        for(int base:new int[]{0,18,36})for(int direction:new int[]{-1,0,1,2,3})
        for(int offset:new int[]{-1,0,1,2,3,4,5,6,8})for(int delay:new int[]{-2,-1,0,1,20})
        for(int clock:new int[]{-1,0,28,29,30,598,599,600}) {
          ${global('Geoblox','field_C','I')}=guard;${global('ka','field_h','I')}=base;
          ${global('jk','field_d','I')}=direction;
          int[] initial={base+offset,delay,1,clock,2,7,25,0x123456};animationState(initial);
          ${global('r','field_ub','I')}=0x654321;${global('md','field_b','F')}=-91.75f;
          ${global('fe','field_c','F')}=110.5f;${global('uk','field_j','F')}=-0.75f;
          advanceAnimation(gameplay,(byte)127,600);
          int[] wanted=animationOracle(initial,base,direction,true,600,0x654321,-91.75f,110.5f,-0.75f);
          check(java.util.Arrays.equals(animationState(),wanted),"animation frame/direction/timer oracle");
          System.out.println("animate:"+gameplay+":"+guard+":"+base+":"+direction+":"+offset+":"+delay+":"+clock+":"+java.util.Arrays.toString(animationState()));
          cases++;matrix++;
        }
        check(matrix==21600,"animation matrix count");
        int effects=0;
        for(boolean gameplay:new boolean[]{false,true})for(int guard=0;guard<2;guard++)
        for(int hold:new int[]{-1,0,1,50,110})for(int shock:new int[]{-1,0,1,2,15,50})
        for(int tint:new int[]{-1,0,1,2,49,50})for(int colors=0;colors<4;colors++) {
          ${global('Geoblox','field_C','I')}=guard;${global('ka','field_h','I')}=18;
          ${global('jk','field_d','I')}=2;
          float red=colors==0?0:colors==1?255:colors==2?-255:128.75f;
          float green=colors==0?0:colors==1?-128:colors==2?128:-255.5f;
          float blue=colors==0?0:colors==1?32:colors==2?-32:0.75f;
          int[] initial={22,-1,hold,50,shock,9,tint,0x13579b};animationState(initial);
          ${global('r','field_ub','I')}=0xabcdef;${global('md','field_b','F')}=red;
          ${global('fe','field_c','F')}=green;${global('uk','field_j','F')}=blue;
          advanceAnimation(gameplay,(byte)72,600);
          check(java.util.Arrays.equals(animationState(),animationOracle(initial,18,2,true,600,0xabcdef,red,green,blue)),"animation effects/tint oracle");
          System.out.println("animate-effects:"+gameplay+":"+guard+":"+hold+":"+shock+":"+tint+":"+colors+":"+java.util.Arrays.toString(animationState()));
          cases++;effects++;
        }
        check(effects==2880,"animation effects count");
        for(byte methodGuard:new byte[]{-128,0,71,72,127}) {
          ${global('ka','field_h','I')}=6;${global('jk','field_d','I')}=1;
          int[] initial={11,-1,5,599,1,8,1,0};animationState(initial);
          ${global('r','field_ub','I')}=0xabcdef;${global('md','field_b','F')}=1;
          ${global('fe','field_c','F')}=2;${global('uk','field_j','F')}=3;
          advanceAnimation(false,methodGuard,600);
          check(java.util.Arrays.equals(animationState(),animationOracle(initial,6,1,methodGuard>=72,600,0xabcdef,1,2,3)),"menu animation guard oracle");
          System.out.println("animate-guard:"+methodGuard+":"+java.util.Arrays.toString(animationState()));cases++;
        }
        // Exercise expiration and multiple blink/frame cycles, not only isolated calls.
        for(boolean gameplay:new boolean[]{false,true})for(int direction=0;direction<3;direction++) {
          ${global('ka','field_h','I')}=12;${global('jk','field_d','I')}=direction;
          ${global('r','field_ub','I')}=0x789abc;${global('md','field_b','F')}=-32;
          ${global('fe','field_c','F')}=75;${global('uk','field_j','F')}=-110;
          int[] wanted={12,0,110,550,50,0,50,0x789abc};animationState(wanted);
          for(int tick=0;tick<720;tick++) {
            wanted=animationOracle(wanted,12,direction,true,600,0x789abc,-32,75,-110);
            advanceAnimation(gameplay,(byte)127,600);
            check(java.util.Arrays.equals(animationState(),wanted),"animation sequence tick oracle");
            System.out.println("animate-sequence:"+gameplay+":"+direction+":"+tick+":"+java.util.Arrays.toString(animationState()));cases++;
          }
        }
      }
      static int[] tintState() {
        return new int[]{${global('r','field_ub','I')},${global('jf','field_j','I')},
          Float.floatToIntBits(${global('md','field_b','F')}),Float.floatToIntBits(${global('fe','field_c','F')}),
          Float.floatToIntBits(${global('uk','field_j','F')})};
      }
      static void tintRequests() {
        int[] palette={0x123456,0xabcdef,0x020304,0xfefdfc,0x654321};
        ${global('uf','field_h','[I')}=palette;
        float[] radii={0,13225,26450,39675,52900,60000,-100000,Float.NaN,Float.POSITIVE_INFINITY};
        int[] indices={0,1,2,3,4,5,-7,0,Integer.MAX_VALUE};
        int count=0;
        for(int color:new int[]{0x123456,0xffffff,0x80000000})for(int remaining:new int[]{-1,0,1,50})
        for(int radius=0;radius<radii.length;radius++)for(byte guard:new byte[]{14,0,-59}) {
          ${global('rj','field_c','I')}=color;${global('r','field_ub','I')}=-22;
          ${global('jf','field_j','I')}=remaining;${global('md','field_b','F')}=1.5f;
          ${global('fe','field_c','F')}=-2.5f;${global('uk','field_j','F')}=3.5f;
          int[] wanted=tintState();String outcome="ok",expectedOutcome="ok";
          if(remaining<=0) {
            wanted[0]=color;
            int index=indices[radius];
            if(guard==-59)expectedOutcome="ArithmeticException";
            else if(index<0||index>=palette.length)expectedOutcome="ArrayIndexOutOfBoundsException";
            else {
              wanted[1]=50;
              wanted[2]=Float.floatToIntBits((float)((palette[index]>>>16)-(color>>>16&255)));
              wanted[3]=Float.floatToIntBits((float)((palette[index]>>>8&255)-(color>>>8&255)));
              wanted[4]=Float.floatToIntBits((float)((palette[index]&255)-(color&255)));
            }
          }
          try{${call('wc','a(FB)V')}(radii[radius],guard);}catch(RuntimeException failure){outcome=failure.getClass().getSimpleName();}
          check(outcome.equals(expectedOutcome),"tint request failure/bypass oracle");
          check(java.util.Arrays.equals(tintState(),wanted),"tint request delta/partial-write oracle");
          check(${global('rj','field_c','I')}==color,"tint request preserves current color");
          System.out.println("tint-request:"+color+":"+remaining+":"+radius+":"+guard+":"+outcome+":"+java.util.Arrays.toString(tintState()));cases++;count++;
        }
        check(count==324,"tint request matrix count");
      }
      static void routing() throws Exception {
        ${raster} sprite=new ${raster}(1,1);sprite.${field('dm','field_v','[I')}[0]=0x123456;
        for(int c=0;c<2;c++)for(int v=0;v<2;v++)${global('ke','field_a','[[[Ldm;')}[0][c][v]=sprite;
        ${global('s','field_G','[[Ldm;')}=new ${raster}[][]{{sprite,sprite}};
        ${global('hb','field_d','[Ldm;')}=new ${raster}[]{sprite};${global('fc','field_g','[Ldm;')}=new ${raster}[]{sprite};
        for(int v=0;v<2;v++)java.util.Arrays.fill(${global('ka','field_m','[[[Ldm;')}[0][v],sprite);
        for(int guard=0;guard<2;guard++)for(int route=0;route<6;route++)for(int kind=0;kind<5;kind++)
        for(int size:new int[]{1,3,5})for(boolean avatar:new boolean[]{false,true})for(float angle:new float[]{0,0.75f})
        for(boolean withNeighbor:new boolean[]{false,true}) {
          if(withNeighbor&&route!=1&&route!=2&&route!=3)continue;
          ${global('Geoblox','field_C','I')}=guard;${global('el','field_o','Lgh;')}=session();
          ${global('el','field_o','Lgh;')}.${field('gh','field_J','F')}=angle;
          ${attached}=new ${deque}();${moving}=new ${deque}();${transient}=new ${deque}();${global('ra','field_a','Ltf;')}=new ${deque}();
          ${global('re','field_j','Z')}=false;${global('w','field_f','Z')}=route==3;${global('jl','field_t','Z')}=true;
          ${global('ab','field_f','Z')}=false;${global('rb','field_b','I')}=0;${global('og','field_r','F')}=2.5f;
          ${global('ka','field_h','I')}=0;${global('pa','field_g','I')}=0;${global('nd','field_a','I')}=0;
          ${global('wa','field_a','I')}=0;${global('uf','field_b','I')}=0;audio();
          ${active}=new ${deque}();${available}=new ${deque}();
          for(int i=0;i<size;i++)${available}.${addLast}(-35,new ${popup}());
          // Keep scoring enabled for controlled shock popups without allocating
          // session score builders: every award has an available popup.
          ${global('el','field_o','Lgh;')}.${field('gh','field_Y','Z')}=false;
          ${global('vl','field_p','I')}=-1;
          ${global('vf','field_L','Ldm;')}=new ${raster}(9,9);${global('bk','field_a','Ldm;')}=new ${raster}(640,480);
          ${global('wd','field_b','Ldm;')}=new ${raster}(460,460);${global('wd','field_a','I')}=90;${global('wd','field_d','I')}=10;
          ${global('i','field_a','Ldm;')}=new ${raster}(1,1);
          ${type('sc')} display=(${type('sc')})allocate(${type('bf')}.class);
          display.${field('sc','field_a','I')}=640;display.${field('sc','field_c','I')}=480;display.${field('sc','field_d','[I')}=new int[640*480];
          ${global('sh','field_y','Lsc;')}=display;display.${method('sc','a(I)V')}(255);
          ${entity}[] nodes=new ${entity}[size];${type('wd')} secondary=new ${type('wd')}();
          ${entity}[] neighbors=new ${entity}[size];
          for(int i=0;i<size;i++) {
            nodes[i]=entity(i+70,0,0,kind);nodes[i].${field('ja','field_o','F')}=330+i*8;nodes[i].${field('ja','field_v','F')}=246+i*4;
            nodes[i].${field('ja','field_t','Z')}=avatar;
            nodes[i].${field('ja','field_B','Z')}=route==5;
            nodes[i].${field('ja','field_K','Ltf;')}=route==0?${attached}:route==1?${moving}:route==2?${transient}:route==4?${global('ra','field_a','Ltf;')}:null;
            ${deque} input=route==0||route==5?${moving}:route==4?${transient}:${attached};input.${addLast}(-35,nodes[i]);
            secondary.${method('wd','a(ILrc;)V')}(-45,nodes[i]);
            if(withNeighbor) {
              ${entity} neighbor=neighbors[i]=entity(i+90,0,0,0);neighbor.${field('ja','field_o','F')}=340+i*8;neighbor.${field('ja','field_v','F')}=260;
              // Control one reciprocal edge without allowing contact conversion
              // to consume the queue marker before routing is exercised.
              nodes[i].${field('ja','field_n','[Lja;')}[0]=neighbor;neighbor.${field('ja','field_n','[Lja;')}[0]=nodes[i];
              nodes[i].${field('ja','field_L','I')}=neighbor.${field('ja','field_L','I')}=1;
              nodes[i].${field('ja','field_N','I')}=neighbor.${field('ja','field_N','I')}=nodes[i].${field('ja','field_C','I')}==0?1:0;
              nodes[i].${field('ja','field_m','I')}=neighbor.${field('ja','field_m','I')}=nodes[i].${field('ja','field_M','I')}==0?1:0;
            }
          }
          String outcome="ok";
          try {${call('kc','b(I)V')}(-90);}catch(${type('sa')} error) {
            outcome=error.${field('sa','field_a','Ljava/lang/Throwable;')}.getClass().getSimpleName()+":"+error.${field('sa','field_d','Ljava/lang/String;')};
            if(guard==0){error.${field('sa','field_a','Ljava/lang/Throwable;')}.printStackTrace();throw new AssertionError(outcome);}
          }
          boolean triggered=route==2||route==3&&avatar;
          StringBuilder expectedOrder=new StringBuilder(),trace=new StringBuilder();
          for(${entity} node:nodes) {
            expectedOrder.append(node.${field('ja','field_H','I')}).append(',');
            if(guard==0) {
              check(node.${field('ja','field_K','Ltf;')}==null,"routing clears marker");
              check(node.${field('ja','field_z','I')}==(triggered?(kind==4?7:5):kind),"transient kind selection");
              if(triggered)check(node.${field('ja','field_r','I')}==50&&node.${field('ja','field_G','I')}==0,"transient lifetime/frame");
              check((node.${field('rc','field_l','Lrc;')}==null)==(route!=5&&!(route==3&&!avatar)),"secondary membership cleanup");
              if(route==0) {
                int pixels=0;for(int pixel:${global('bk','field_a','Ldm;')}.${field('dm','field_v','[I')})if(pixel==node.${field('ja','field_H','I')}+1)pixels++;
                check(pixels>0,"attachment stamps ownership pixels");
              }
            }
            trace.append(state(node)).append(':').append(node.${field('ja','field_r','I')}).append(':').append(node.${field('ja','field_G','I')}).append('/');
          }
          if(withNeighbor)for(${entity} neighbor:neighbors) {
            if(guard==0&&(route==1||triggered))ordinaryOracle(neighbor,new ${entity}[0]);
            trace.append(state(neighbor)).append('/');
          }
          String attachedTrace=queueState(${attached}),movingTrace=queueState(${moving}),transientTrace=queueState(${transient}),poolTrace=queueState(${global('ra','field_a','Ltf;')});
          int points=0,popups=0;StringBuilder popupTrace=new StringBuilder();boolean[] seenOrigin=new boolean[size];
          ${popup} pop=(${popup})${active}.${method('tf','g(I)Lhf;')}(0);
          while(pop!=null){points+=pop.${field('me','field_f','I')};check(pop.${field('me','field_h','I')}==1,"shock popup multiplier");
            float x=pop.${field('me','field_n','F')},y=pop.${field('me','field_i','F')};
            int index=(int)(x-330)/8;
            check(index>=0&&index<size&&x==330+index*8&&y==246+index*4&&!seenOrigin[index],"shock popup origin oracle");seenOrigin[index]=true;
            popupTrace.append(Float.floatToIntBits(x)).append(',').append(Float.floatToIntBits(y)).append('/');
            popups++;pop=(${popup})${active}.${method('tf','d(I)Lhf;')}(1);}
          if(guard==0) {
            String order=expectedOrder.toString();check(attachedTrace.equals(route==0||route==3&&!avatar?order:"")&&movingTrace.equals(route==1||route==5?order:"")
              &&transientTrace.equals(triggered?order:"")&&poolTrace.equals(route==4?order:""),"routing queue oracle");
            check(points==(route==3&&avatar?size*(kind==3||kind==4?100:10):0)&&popups==(route==3&&avatar?size:0),"shock popup points/count");
            check(${global('rb','field_b','I')}==(triggered&&kind==4?size:0),"kind-four counter");
            check(!${global('w','field_f','Z')}&&${global('jl','field_t','Z')}==(route!=3),"shock flags consumed");
          }
          System.out.println("route:"+guard+":"+route+":"+kind+":"+size+":"+avatar+":"+Float.floatToIntBits(angle)+":"+withNeighbor+":"+outcome+":"+trace+":"+attachedTrace+":"+movingTrace+":"+transientTrace+":"+poolTrace
            +":"+points+":"+popups+":"+popupTrace+":"+${global('rb','field_b','I')}+":"+soundSample()+":"+java.util.Arrays.hashCode(${global('bk','field_a','Ldm;')}.${field('dm','field_v','[I')}));cases++;
        }
      }
      static void boundaryMatrix() {
        // A closed-form lattice boundary, independent of the scan's error
        // recurrence: x is the largest integer with x*(x-1)+y*y <= r*r.
        boolean[][] expectedPixels=new boolean[461][461];int perimeterPixels=0;
        for(int y=0;y<=230;y++) {
          int x=(int)Math.floor(0.5+Math.sqrt(52900-y*y+0.25));
          if(y>x)break;
          check(x*(x-1)+y*y<=52900&&x*(x+1)+y*y>52900,"circle root bounds");
          int[][] symmetric={{x,y},{x,-y},{-x,y},{-x,-y},{y,x},{-y,x},{y,-x},{-y,-x}};
          for(int[] point:symmetric)if(!expectedPixels[point[1]+230][point[0]+230]) {
            expectedPixels[point[1]+230][point[0]+230]=true;perimeterPixels++;
          }
        }
        check(perimeterPixels==1300,"complete discrete perimeter");int pixelCases=0,guardCases=0,rasterCases=0;
        for(int stride:new int[]{640,641}) {
          ${global('vb','field_f','I')}=stride;
          ${global('Geoblox','field_C','I')}=stride-640;
          int[] pixels=new int[stride*480];${framebuffer}=pixels;
          for(int y=10;y<=470;y++)for(int x=90;x<=550;x++) {
            int index=y*stride+x,value=((x+y)%3==0?Integer.MIN_VALUE:(x+y)%3==1?-1:7);
            pixels[index]=value;boolean actual=boundary();
            check(actual==expectedPixels[y-10][x-90],"boundary pixel "+stride+":"+x+":"+y);
            check(pixels[index]==value,"boundary scan is read-only");pixels[index]=0;pixelCases++;
          }
          check(!boundary(),"scan empty after all pixels");
          for(int pixel:pixels)check(pixel==0,"no other framebuffer writes");
        }
        ${global('Geoblox','field_C','I')}=0;${global('vb','field_f','I')}=640;
        ${framebuffer}=new int[640*480];
        for(int methodGuard:new int[]{Integer.MIN_VALUE,-61,-2,-1,0,32,65,66,Integer.MAX_VALUE})
          for(boolean occupied:new boolean[]{false,true}) {
            ${framebuffer}[240*640+90]=occupied?1:0;boolean dividesByZero=(methodGuard-32)/34==0,failed=false;
            try {
              boolean actual=${call('ld','a(I)Z')}(methodGuard);
              check(!dividesByZero&&actual==occupied,"guard cannot bypass arithmetic");
            } catch(${type('sa')} error) {
              check(dividesByZero,"unexpected guard exception");failed=true;
              check(error.${field('sa','field_a','Ljava/lang/Throwable;')} instanceof ArithmeticException,"guard cause");
              check(error.${field('sa','field_d','Ljava/lang/String;')}.equals("ld.B("+methodGuard+")"),"guard context");
            }
            check(failed==dividesByZero,"guard failure prediction");guardCases++;
          }
        for(int mode=0;mode<5;mode++) {
          int methodGuard=mode==1?0:-61;
          int[] pixels=mode<2?null:new int[240*640+91];${framebuffer}=pixels;
          if(mode==3)pixels[240*640+90]=-1;
          if(mode==4)pixels[240*640+90]=Integer.MIN_VALUE;
          boolean failed=false;
          try { check(boundaryWithGuard(methodGuard)&&mode>=3,"left cardinal hit must precede invalid right index"); }
          catch(${type('sa')} error) {
            failed=true;Throwable cause=error.${field('sa','field_a','Ljava/lang/Throwable;')};
            check(mode==0?cause instanceof NullPointerException:mode==1?cause instanceof ArithmeticException:
              mode==2&&cause instanceof ArrayIndexOutOfBoundsException,"raster failure priority");
            check(error.${field('sa','field_d','Ljava/lang/String;')}.equals("ld.B("+methodGuard+")"),"raster context");
          }
          check(failed==(mode<3),"raster outcome");rasterCases++;
        }
        ${framebuffer}=new int[640*480];
        check(pixelCases==425042&&guardCases==18&&rasterCases==5,"boundary matrix coverage");
        System.err.println("boundary-matrix:"+pixelCases+":"+perimeterPixels+":"+guardCases+":"+rasterCases);
      }
      static boolean boundaryWithGuard(int guard) { return ${call('ld','a(I)Z')}(guard); }
      static String comparatorOracle(boolean primary,byte guard,int[] firstTable,int[] secondTable,
          int[] leftPart,int[] middlePart,int[] rightPart) {
        int[] first=primary?firstTable:secondTable,second=primary?secondTable:firstTable;
        if(first[1]!=first[0])return Boolean.toString(first[1]<first[0]);
        if(second[1]!=second[0])return Boolean.toString(second[1]<second[0]);
        int left=leftPart[1]+middlePart[1]+rightPart[1];
        int right=middlePart[0]+(rightPart[0]+leftPart[0]);
        if((-38-guard)/45==0)return "ArithmeticException";
        if(left!=right)return Boolean.toString(left<right);
        return "false";
      }
      static void comparatorMatrix() throws Exception {
        java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");
        int count=0;int[] values={Integer.MIN_VALUE,-1,0,1,Integer.MAX_VALUE};
        for(int seed=0;seed<64;seed++) {
          int[] first={values[seed%5],values[(seed/5)%5]};
          int[] second={values[(seed/7)%5],values[(seed/11)%5]};
          if(seed%4==0){first[1]=first[0];second[1]=second[0];}
          int[] left={values[(seed/13)%5],values[(seed/17)%5]};
          int[] middle={values[(seed/19)%5],values[(seed/23)%5]};
          int[] right={values[(seed/29)%5],values[(seed/31)%5]};
          ${global('hg','field_a','[I')}=first;${global('gk','field_a','[I')}=second;
          ${global('cj','field_b','[I')}=left;${global('fb','field_m','[I')}=middle;
          ${global('k','field_i','[I')}=right;
          for(boolean primary:new boolean[]{false,true})for(int guard=-128;guard<=127;guard++) {
            String actual;
            try {actual=Boolean.toString(${call('ig','a(ZIBI)Z')}(primary,0,(byte)guard,1));}
            catch(ArithmeticException failure){actual="ArithmeticException";}
            String wanted=comparatorOracle(primary,(byte)guard,first,second,left,middle,right);
            check(actual.equals(wanted),"comparator priority, overflow, tie and guard failure");
            digest.update((seed+":"+primary+":"+guard+":"+actual+"\\n")
              .getBytes(java.nio.charset.StandardCharsets.UTF_8));count++;
          }
        }
        check(count==32768,"comparator coverage");StringBuilder hash=new StringBuilder();
        for(byte value:digest.digest())hash.append(String.format("%02x",value&255));
        System.err.println("comparator-matrix:"+count+":"+hash);
      }
      static void sameFloat(float actual,float wanted,String label) {
        check(Float.floatToIntBits(actual)==Float.floatToIntBits(wanted),label+":"+actual+":"+wanted);
      }
      static String motionState(${entity} e) {
        return Float.floatToIntBits(e.${field('ja','field_o','F')})+":"+
          Float.floatToIntBits(e.${field('ja','field_v','F')})+":"+
          Float.floatToIntBits(e.${field('ja','field_w','F')})+":"+
          Float.floatToIntBits(e.${field('ja','field_F','F')})+":"+
          Float.floatToIntBits(e.${field('ja','field_u','F')})+":"+
          e.${field('ja','field_r','I')}+":"+e.${field('ja','field_p','I')}+":"+
          e.${field('ja','field_C','I')}+":"+e.${field('ja','field_M','I')}+":"+
          e.${field('ja','field_z','I')}+":"+e.${field('ja','field_L','I')}+":"+
          e.${field('ja','field_N','I')}+":"+e.${field('ja','field_m','I')}+":"+
          e.${field('ja','field_E','I')}+":"+e.${field('ja','field_G','I')}+":"+
          e.${field('ja','field_t','Z')}+":"+e.${field('ja','field_B','Z')};
      }
      static void motionMatrix() throws Exception {
        java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");
        java.lang.reflect.Field clock=${entity}.class.getDeclaredField("${field('ja','field_I','I')}");
        clock.setAccessible(true);int constructors=0,integrations=0,rotations=0,initializations=0;
        float[][] positions={{320,240},{0,-0.0f},{320.00003f,239.99998f},
          {Float.MAX_VALUE,-Float.MAX_VALUE},{Float.NaN,Float.POSITIVE_INFINITY}};
        float[][] velocities={{0,-0.0f},{1.25f,-2.5f},{-10.5f,0.75f},
          {Float.MAX_VALUE,-Float.MAX_VALUE},{Float.NaN,Float.POSITIVE_INFINITY}};
        float[] speeds={0.4f,0,-0.7f,Float.NaN,Float.POSITIVE_INFINITY};
        ${global('Geoblox','field_C','I')}=0;${global('c','field_ab','I')}=0;
        ${raster} ordinary=new ${raster}(1,1),amorphous=new ${raster}(1,1);
        ${global('ke','field_a','[[[Ldm;')}=new ${raster}[][][]{{{ordinary}}};
        ${global('ka','field_m','[[[Ldm;')}=new ${raster}[][][]{{{amorphous,amorphous,amorphous,amorphous}}};
        for(float[] position:positions)for(float[] velocity:velocities)for(int kind:new int[]{0,2}) {
          ${entity} e=new ${entity}(0,0,kind,position[0],position[1],velocity[0],velocity[1],Float.NaN,Float.POSITIVE_INFINITY,37);
          sameFloat(e.${field('ja','field_o','F')},position[0],"constructor X");
          sameFloat(e.${field('ja','field_v','F')},position[1],"constructor Y");
          sameFloat(e.${field('ja','field_w','F')},velocity[0],"constructor preserves X velocity");
          sameFloat(e.${field('ja','field_F','F')},velocity[1],"constructor preserves Y velocity");
          check(e.${field('ja','field_H','I')}==37 && e.${field('ja','field_C','I')}==(kind==2?-1:0) &&
            e.${field('ja','field_J','Ldm;')}==(kind==2?amorphous:ordinary),"constructor selection");
          check(e.${field('ja','field_n','[Lja;')}.length==6 && clock.getInt(e)==0 &&
            e.${field('ja','field_L','I')}==0 && e.${field('ja','field_K','Ltf;')}==null,"constructor defaults");
          digest.update(("construct:"+motionState(e)+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));constructors++;
        }
        for(float[] position:positions)for(float[] velocity:velocities)for(byte guard:new byte[]{-59,0,-128,127}) {
          ${entity} e=entity(37,0,0,0);e.${field('ja','field_o','F')}=position[0];e.${field('ja','field_v','F')}=position[1];
          e.${field('ja','field_w','F')}=velocity[0];e.${field('ja','field_F','F')}=velocity[1];e.${field('ja','field_m','I')}=5;
          e.${method('ja','f(B)V')}(guard);
          sameFloat(e.${field('ja','field_o','F')},position[0]+velocity[0],"integrated X");
          sameFloat(e.${field('ja','field_v','F')},position[1]+velocity[1],"integrated Y");
          sameFloat(e.${field('ja','field_w','F')},velocity[0],"integration preserves X velocity");
          sameFloat(e.${field('ja','field_F','F')},velocity[1],"integration preserves Y velocity");
          check(e.${field('ja','field_m','I')}==(guard==-59?5:-29),"integration guard side effect");
          digest.update(("integrate:"+guard+":"+motionState(e)+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));integrations++;
        }
        for(float[] position:positions)for(float angle:new float[]{0,-0.0f,(float)(Math.PI/2),-(float)Math.PI,0.125f,Float.NaN})
        for(float speed:speeds)for(int kind:new int[]{0,2})for(int guard:new int[]{-79,-128}) {
          ${entity} e=entity(37,0,0,0);e.${field('ja','field_o','F')}=position[0];e.${field('ja','field_v','F')}=position[1];
          e.${field('ja','field_z','I')}=kind;e.${field('ja','field_u','F')}=0.75f;${global('og','field_r','F')}=speed;
          double cosine=Math.cos((double)angle),sine=Math.sin((double)angle);
          double x=(double)(position[0]-320.0f),y=(double)(position[1]-240.0f);
          float expectedX=(float)(x*cosine-y*sine)+320.0f,expectedY=(float)(x*sine+y*cosine)+240.0f;
          float expectedVx=320.0f-expectedX,expectedVy=240.0f-expectedY;
          float normSquared=expectedVx*expectedVx+expectedVy*expectedVy;
          if(normSquared>speed*speed) {double factor=(double)speed/Math.sqrt((double)normSquared);
            expectedVx=(float)((double)expectedVx*factor);expectedVy=(float)((double)expectedVy*factor);}
          e.${method('ja','a(FI)V')}(angle,guard);
          sameFloat(e.${field('ja','field_o','F')},expectedX,"rotated X");sameFloat(e.${field('ja','field_v','F')},expectedY,"rotated Y");
          sameFloat(e.${field('ja','field_w','F')},expectedVx,"inward X velocity");sameFloat(e.${field('ja','field_F','F')},expectedVy,"inward Y velocity");
          sameFloat(e.${field('ja','field_u','F')},kind==2?0.75f:0.75f-angle,"rotation sprite kind rule");
          digest.update(("rotate:"+Float.floatToIntBits(angle)+":"+Float.floatToIntBits(speed)+":"+kind+":"+guard+":"+
            motionState(e)+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));rotations++;
        }
        for(float[] position:positions)for(float[] velocity:velocities)for(float speed:speeds)
        for(int lifetime:new int[]{-1,0,1,60,Integer.MAX_VALUE})for(int guard:new int[]{101,0,-19})for(int kind:new int[]{0,2}) {
          ${entity} e=entity(37,0,0,0);${deque} queue=new ${deque}();clock.setInt(e,7);
          e.${field('ja','field_K','Ltf;')}=queue;e.${field('ja','field_u','F')}=0.75f;e.${field('ja','field_G','I')}=3;
          e.${field('ja','field_N','I')}=4;e.${field('ja','field_m','I')}=5;e.${field('ja','field_L','I')}=3;
          e.${field('ja','field_E','I')}=9;e.${field('ja','field_t','Z')}=true;e.${field('ja','field_B','Z')}=true;
          e.${field('ja','field_n','[Lja;')}[0]=e;${global('og','field_r','F')}=speed;
          double factor=(double)speed/Math.sqrt((double)(velocity[0]*velocity[0]+velocity[1]*velocity[1]));
          float vx=(float)((double)velocity[0]*factor),vy=(float)((double)velocity[1]*factor);boolean failed=false;
          try {e.${method('ja','a(IFIFIIFFFIF)V')}(guard,position[0],kind,velocity[0],0,lifetime,
            Float.NaN,position[1],velocity[1],0,Float.POSITIVE_INFINITY);}
          catch(ArithmeticException failure){failed=true;}
          boolean expectedFailure=guard!=101;check(failed==expectedFailure,"initialization arithmetic guard");
          sameFloat(e.${field('ja','field_o','F')},position[0],"initialized X");sameFloat(e.${field('ja','field_v','F')},position[1],"initialized Y");
          sameFloat(e.${field('ja','field_w','F')},vx,"normalized X");sameFloat(e.${field('ja','field_F','F')},vy,"normalized Y");
          check(e.${field('ja','field_r','I')}==lifetime && e.${field('ja','field_p','I')}==lifetime &&
            e.${field('ja','field_z','I')}==kind && e.${field('ja','field_C','I')}==(!failed && kind==2?-1:0),"initialization partial writes");
          sameFloat(e.${field('ja','field_u','F')},failed?0.75f:0,"initialization angle reset order");
          check(e.${field('ja','field_N','I')}==(failed?4:0) && e.${field('ja','field_m','I')}==(failed?5:0) &&
            e.${field('ja','field_L','I')}==(failed?3:0) && e.${field('ja','field_E','I')}==(failed?9:0) &&
            e.${field('ja','field_G','I')}==(failed?3:0) && clock.getInt(e)==(failed?7:0),"initialization reset order");
          check(e.${field('ja','field_t','Z')}==failed && e.${field('ja','field_B','Z')}==failed &&
            e.${field('ja','field_K','Ltf;')}==(failed?queue:null) && e.${field('ja','field_n','[Lja;')}[0]==e,"reset retains array slots");
          check(e.${field('ja','field_J','Ldm;')}==(!failed && kind==2?amorphous:ordinary),"sprite reset follows guard");
          digest.update(("initialize:"+Float.floatToIntBits(speed)+":"+guard+":"+failed+":"+clock.getInt(e)+":"+
            motionState(e)+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));initializations++;
        }
        check(constructors==50 && integrations==100 && rotations==600 && initializations==3750,"motion coverage");
        StringBuilder hash=new StringBuilder();for(byte value:digest.digest())hash.append(String.format("%02x",value&255));
        System.err.println("motion-matrix:"+constructors+":"+integrations+":"+rotations+":"+initializations+":"+hash);
      }
      static ${raster} mask(int width,int height,int trimX,int trimY,int pattern) {
        ${raster} out=new ${raster}(width,height);
        out.${field('wh','field_u','I')}=trimX;out.${field('wh','field_p','I')}=trimY;
        out.${field('wh','field_s','I')}=width+4;out.${field('wh','field_o','I')}=height+4;
        int[] pixels=out.${field('dm','field_v','[I')};
        for(int i=0;i<pixels.length;i++)pixels[i]=pattern==0?0:pattern==1?1:pattern==2?(i%2==0?0:-1):(i%3==0?0:i+2);
        return out;
      }
      static int[] overlapOracle(${raster} first,int firstX,int firstY,${raster} second,int secondX,int secondY) {
        int[] a=first.${field('dm','field_v','[I')},b=second.${field('dm','field_v','[I')};
        int aw=first.${field('wh','field_r','I')},ah=first.${field('wh','field_m','I')},bw=second.${field('wh','field_r','I')},bh=second.${field('wh','field_m','I')};
        int ax=firstX+first.${field('wh','field_u','I')},ay=firstY+first.${field('wh','field_p','I')},bx=secondX+second.${field('wh','field_u','I')},by=secondY+second.${field('wh','field_p','I')};
        // Walk first-mask pixels in world row/column order and look up the
        // corresponding second pixel; no shared clipping/index recurrence.
        for(int y=0;y<ah;y++)for(int x=0;x<aw;x++) {
          int sx=ax+x-bx,sy=ay+y-by;
          if(a[y*aw+x]!=0 && sx>=0 && sx<bw && sy>=0 && sy<bh && b[sy*bw+sx]!=0)return new int[]{ax+x,ay+y};
        }
        return null;
      }
      static void collisionSpawnMatrix() throws Exception {
        java.security.MessageDigest digest=java.security.MessageDigest.getInstance("SHA-256");
        int overlaps=0,boardChecks=0,contactChecks=0,spawns=0,steering=0;
        int[][] layouts={{1,1,0,0},{3,2,1,2},{2,3,-1,-2},{0,2,0,0},{2,0,0,0}};
        for(int[] left:layouts)for(int[] right:layouts)for(int a=0;a<4;a++)for(int b=0;b<4;b++)
        for(int[] origin:new int[][]{{0,0},{-2,3},{3,-2}})for(int[] other:new int[][]{{0,0},{1,1},{-1,-1},{4,-2},{-3,3}}) {
          ${raster} first=mask(left[0],left[1],left[2],left[3],a),second=mask(right[0],right[1],right[2],right[3],b);
          int[] beforeFirst=first.${field('dm','field_v','[I')}.clone(),beforeSecond=second.${field('dm','field_v','[I')}.clone();
          int[] wanted=overlapOracle(first,origin[0],origin[1],second,other[0],other[1]);
          ${global('aa','field_a','I')}=-701;${global('aa','field_b','I')}=-702;
          boolean hit=${call('aa','a(Ldm;IILdm;II)Z')}(first,origin[0],origin[1],second,other[0],other[1]);
          check(hit==(wanted!=null),"overlap presence");
          check(${global('aa','field_a','I')}==(hit?wanted[0]:-701) && ${global('aa','field_b','I')}==(hit?wanted[1]:-702),"first overlap position or retained sentinel");
          check(java.util.Arrays.equals(beforeFirst,first.${field('dm','field_v','[I')}) && java.util.Arrays.equals(beforeSecond,second.${field('dm','field_v','[I')}),"overlap preserves pixels");
          digest.update(("overlap:"+overlaps+":"+hit+":"+${global('aa','field_a','I')}+":"+${global('aa','field_b','I')}+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));overlaps++;
        }
        ${global('Geoblox','field_C','I')}=0;
        for(int x:new int[]{-1,0,3,5,10})for(int y:new int[]{-1,0,3,5,10})for(int pattern=0;pattern<4;pattern++) {
          ${raster} scratch=mask(3,3,1,2,pattern),board=mask(5,5,0,0,3),probe=mask(5,5,-1,1,2);
          ${global('vf','field_L','Ldm;')}=scratch;${global('bk','field_a','Ldm;')}=board;${global('wd','field_b','Ldm;')}=probe;
          ${global('ng','field_G','I')}=x;${global('td','field_E','I')}=y;
          ${global('wd','field_a','I')}=-2;${global('wd','field_d','I')}=1;
          for(int guard:new int[]{0,1,-1}) {
            ${global('aa','field_a','I')}=-701;${global('aa','field_b','I')}=-702;
            int[] wanted=guard==0?overlapOracle(scratch,x-3,y-3,board,0,0):null;
            boolean hit=${call('uj','a(Lja;FI)Z')}(null,Float.NaN,guard);
            check(hit==(wanted!=null),"board wrapper hit/guard");
            check(${global('aa','field_a','I')}==(hit?wanted[0]:-701) && ${global('aa','field_b','I')}==(hit?wanted[1]:-702),"board wrapper coordinates");
            digest.update(("board:"+x+":"+y+":"+pattern+":"+guard+":"+hit+":"+${global('aa','field_a','I')}+":"+${global('aa','field_b','I')}+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));boardChecks++;
          }
          ${global('aa','field_a','I')}=-701;${global('aa','field_b','I')}=-702;
          int[] wanted=overlapOracle(probe,0,0,scratch,x-3+2,y-3-1);
          boolean hit=${call('ma','a(ZFLja;)Z')}(true,Float.POSITIVE_INFINITY,null);
          check(hit==(wanted!=null),"contact wrapper hit");
          check(${global('aa','field_a','I')}==(hit?wanted[0]:-701) && ${global('aa','field_b','I')}==(hit?wanted[1]:-702),"contact wrapper coordinates");
          digest.update(("contact-mask:"+x+":"+y+":"+pattern+":"+hit+":"+${global('aa','field_a','I')}+":"+${global('aa','field_b','I')}+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));contactChecks++;
        }
        ${raster}[][][] ordinary=new ${raster}[1][4][4],amorphous=new ${raster}[1][4][4];${raster}[][] geometry=new ${raster}[1][4];
        for(int c=0;c<4;c++)for(int v=0;v<4;v++){ordinary[0][c][v]=new ${raster}(1,1);amorphous[0][c][v]=new ${raster}(1,1);geometry[0][c]=new ${raster}(1,1);}
        ${raster} black=new ${raster}(1,1),silver=new ${raster}(1,1);
        ${global('ke','field_a','[[[Ldm;')}=ordinary;${global('ka','field_m','[[[Ldm;')}=amorphous;${global('s','field_G','[[Ldm;')}=geometry;
        ${global('fc','field_g','[Ldm;')}=new ${raster}[]{black};${global('hb','field_d','[Ldm;')}=new ${raster}[]{silver};
        ${global('jg','field_h','[[I')}=new int[][]{{0x123456,0x234567,0x345678,0x456789,0x56789a,0x6789ab,0x789abc}};
        ${global('c','field_ab','I')}=0;${global('og','field_r','F')}=0.7f;${global('el','field_o','Lgh;')}=session();
        int[][] positions={{320,240},{0,0},{321,239},{639,479},{-100,900}};
        float[] angles={0,(float)(Math.PI/2),-(float)Math.PI,0.125f,Float.NaN};
        for(int[] position:positions)for(float angle:angles)for(int category=0;category<4;category++)for(int variant=0;variant<4;variant++)
        for(boolean special:new boolean[]{false,true})for(int poolSize=0;poolSize<3;poolSize++)for(int guard:new int[]{-28195,0}) {
          ${global('ra','field_a','Ltf;')}=new ${deque}();${moving}=new ${deque}();
          ${entity} first=entity(17,0,0,0),last=entity(19,0,0,0);
          first.${field('ja','field_K','Ltf;')}=${moving};last.${field('ja','field_K','Ltf;')}=${moving};
          if(poolSize>0)${global('ra','field_a','Ltf;')}.${addLast}(-35,first);
          if(poolSize>1)${global('ra','field_a','Ltf;')}.${addLast}(-35,last);
          ${global('el','field_o','Lgh;')}.${field('gh','field_J','F')}=angle;
          ${call('nb','a(IIIIIZ)V')}(guard,position[0],category,position[1],variant,special);
          boolean emitted=guard==-28195&&poolSize>0;
          check(${global('ra','field_a','Ltf;')}.${method('tf','a(I)I')}(95)==poolSize-(emitted?1:0) && ${moving}.${method('tf','a(I)I')}(95)==(emitted?1:0),"spawn queue counts/guard");
          if(emitted) {
            ${entity} actual=(${entity})${moving}.${method('tf','g(I)Lhf;')}(0);
            check(actual==(poolSize==2?last:first),"spawn removes pool tail");
            double dx=(double)(position[0]-320),dy=(double)(position[1]-240),theta=-(double)angle;
            int x=(int)(320.0+dx*Math.cos(theta)-dy*Math.sin(theta)),y=(int)(240.0+dx*Math.sin(theta)+dy*Math.cos(theta));
            sameFloat(actual.${field('ja','field_o','F')},(float)x,"inverse rotation spawn X");sameFloat(actual.${field('ja','field_v','F')},(float)y,"inverse rotation spawn Y");
            float vx=(float)(320-x),vy=(float)(240-y);double normalization=(double)0.7f/Math.sqrt((double)(vx*vx+vy*vy));
            sameFloat(actual.${field('ja','field_w','F')},(float)((double)vx*normalization),"spawn inward X velocity");sameFloat(actual.${field('ja','field_F','F')},(float)((double)vy*normalization),"spawn inward Y velocity");
            int kind=special?new int[]{2,4,3,1}[(category+variant)%4]:0;
            check(actual.${field('ja','field_z','I')}==kind && actual.${field('ja','field_C','I')}==(kind==0||kind==1?category:-1) && actual.${field('ja','field_M','I')}==(kind==0||kind==2?variant:-1),"spawn category/variant/kind");
            ${raster} selected=kind==0?ordinary[0][category][variant]:kind==1?geometry[0][category]:kind==2?amorphous[0][variant][0]:kind==3?silver:black;
            check(actual.${field('ja','field_J','Ldm;')}==selected && actual.${field('ja','field_K','Ltf;')}==null && actual.${field('ja','field_r','I')}==0 && actual.${field('ja','field_p','I')}==0,"spawn resets/selects sprite");
            digest.update(("spawn:"+spawns+":"+actual.${field('ja','field_H','I')}+":"+motionState(actual)+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));
          } else {
            check(first.${field('ja','field_K','Ltf;')}==${moving} && last.${field('ja','field_K','Ltf;')}==${moving},"ignored spawn retains entities");
            digest.update(("spawn:"+spawns+":ignored"+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));
          }
          spawns++;
        }
        for(int state:new int[]{0,1,2})for(byte guard:new byte[]{45,74,127}) {
          ${global('jk','field_d','I')}=state;${call('me','a(B)V')}((byte)38);check(${global('jk','field_d','I')}==1,"negative rotation steering");steering++;
          ${global('jk','field_d','I')}=state;${call('wd','a(B)V')}(guard);check(${global('jk','field_d','I')}==2,"positive rotation steering");steering++;
          digest.update(("steer:"+state+":"+guard+":1:2"+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        for(int state:new int[]{0,1,2})for(int guard:new int[]{-106,-96,0}) {
          ${global('jk','field_d','I')}=state;${global('jj','field_c','Ljava/lang/String;')}="retained";
          ${call('jj','b(I)V')}(guard);
          check(${global('jk','field_d','I')}==0,"neutral steering");
          check(guard>-96?${global('jj','field_c','Ljava/lang/String;')}==null:"retained".equals(${global('jj','field_c','Ljava/lang/String;')}),"neutral steering guard effect");steering++;
          digest.update(("neutral:"+state+":"+guard+":"+${global('jj','field_c','Ljava/lang/String;')}+(char)10).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        check(overlaps==6000 && boardChecks==300 && contactChecks==100 && spawns==4800 && steering==27,"collision/spawn coverage");
        StringBuilder hash=new StringBuilder();for(byte value:digest.digest())hash.append(String.format("%02x",value&255));
        System.err.println("collision-spawn-matrix:"+overlaps+":"+boardChecks+":"+contactChecks+":"+spawns+":"+steering+":"+hash);
      }
      static final class DifficultyState {
        int step,variants,categories,interval,quota;
        float speed,rotation,scale;
        double chance;
        DifficultyState copy() {
          DifficultyState out=new DifficultyState();out.step=step;out.variants=variants;
          out.categories=categories;out.interval=interval;out.quota=quota;
          out.speed=speed;out.rotation=rotation;out.scale=scale;out.chance=chance;return out;
        }
        public String toString() {
          return step+":"+variants+":"+categories+":"+interval+":"+quota+":"+
            Float.floatToIntBits(speed)+":"+Float.floatToIntBits(rotation)+":"+
            Float.floatToIntBits(scale)+":"+Double.doubleToLongBits(chance);
        }
      }
      static DifficultyState difficultyState() {
        DifficultyState state=new DifficultyState();
        state.step=${global('ji','field_h','I')};state.variants=${global('ag','field_k','I')};
        state.categories=${global('f','field_qb','I')};state.interval=${global('kb','field_c','I')};
        state.quota=${global('sa','field_b','I')};state.speed=${global('og','field_r','F')};
        state.rotation=${global('rc','field_h','F')};state.scale=${global('ij','field_ab','F')};
        state.chance=${global('sa','field_c','D')};return state;
      }
      static void difficultyState(DifficultyState state) {
        ${global('ji','field_h','I')}=state.step;${global('ag','field_k','I')}=state.variants;
        ${global('f','field_qb','I')}=state.categories;${global('kb','field_c','I')}=state.interval;
        ${global('sa','field_b','I')}=state.quota;${global('og','field_r','F')}=state.speed;
        ${global('rc','field_h','F')}=state.rotation;${global('ij','field_ab','F')}=state.scale;
        ${global('sa','field_c','D')}=state.chance;
      }
      static void intervalOracle(DifficultyState state,boolean preserveQuota) {
        state.interval=(int)(201f/state.speed*state.scale+0.5f);
        if(!preserveQuota)state.quota=-10;
      }
      static void difficultyOracle(DifficultyState state,int[] flags,boolean recursiveGuard) {
        state.step++;
        if(state.step>=flags.length) {
          if(state.chance>0.15000000000000002)state.chance-=0.05;
          return;
        }
        // Express the table's effects directly, independently of the emitted
        // duplicated branches. A recursive call changes the shared index;
        // later effects deliberately re-read that index and may fail.
        if((flags[state.step]&4)!=0) {
          state.speed+=0.055555559694767f;intervalOracle(state,!recursiveGuard);
        }
        if((flags[state.step]&1)!=0&&state.variants<7)state.variants++;
        if(recursiveGuard)difficultyOracle(state,flags,true);
        if((flags[state.step]&2)!=0&&state.categories<7)state.categories++;
        if((flags[state.step]&16)!=0)state.chance+=0.05;
        if((flags[state.step]&8)!=0)state.rotation*=1.100000023841858f;
        if((flags[state.step]&128)!=0) {
          if(state.scale<0.8f)state.scale+=0.02857142873108387f;
          intervalOracle(state,!recursiveGuard);
        }
      }
      static String failure(Runnable work) {
        try {work.run();return "ok";}
        catch(RuntimeException error){return error.getClass().getName();}
      }
      static java.security.MessageDigest difficultyDigest;
      static void difficultyTrace(String value) {
        difficultyDigest.update((value+"\\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
      }
      static void verifyDifficulty(DifficultyState initial,int[] flags,boolean recursiveGuard,String label) {
        DifficultyState wanted=initial.copy();difficultyState(initial);
        ${global('kd','field_f','[I')}=flags;
        String expectedFailure=failure(()->difficultyOracle(wanted,flags,recursiveGuard));
        String actualFailure=failure(()->${call('ld','b(Z)V')}(recursiveGuard));
        check(actualFailure.equals(expectedFailure),"difficulty failure "+label+":"+expectedFailure+":"+actualFailure);
        check(difficultyState().toString().equals(wanted.toString()),"difficulty state "+label+":"+wanted+":"+difficultyState());
        difficultyTrace(label+":"+actualFailure+":"+difficultyState());
      }
      static int randomBoundOracle(java.util.Random random,int bound) {
        if((bound&(bound-1))==0)return(int)(Integer.toUnsignedLong(random.nextInt())*bound>>>32);
        long rejected=(1L<<32)%bound;
        int draw;
        do {draw=random.nextInt();}while((long)draw>Integer.MAX_VALUE-rejected);
        return Math.floorMod(draw,bound);
      }
      static void difficultyMatrix() throws Exception {
        difficultyDigest=java.security.MessageDigest.getInstance("SHA-256");
        int[] originalFlags=${global('kd','field_f','[I')};
        int[] expectedTable={0,4,12,133,0,140,1,4,136,2,4,132,17,16,128,3,0,128,2,16,132,16,0};
        check(java.util.Arrays.equals(originalFlags,expectedTable),"original difficulty table");
        int matrix=0,bounds=0,sequence=0,intervals=0,quotas=0,resets=0,selections=0;
        for(int clientGuard=0;clientGuard<2;clientGuard++)for(int mask=0;mask<256;mask++)
          for(int variants:new int[]{0,6,7})for(int categories:new int[]{0,6,7})
          for(double chance:new double[]{-0d,0.15000000000000002,Double.NaN})
          for(float scale:new float[]{Math.nextDown(0.8f),0.8f,Float.NaN})
          for(boolean recursive:new boolean[]{false,true}) {
            ${global('Geoblox','field_C','I')}=clientGuard;
            DifficultyState state=new DifficultyState();state.step=-1;state.variants=variants;state.categories=categories;
            state.chance=chance;state.scale=scale;state.speed=new float[]{0.4f,0f,Float.MAX_VALUE,Float.NaN}[mask&3];
            state.rotation=0.01666666753590107f;state.interval=91;state.quota=17;
            int[] flags={mask,mask^129,0};
            verifyDifficulty(state,flags,recursive,"matrix:"+clientGuard+":"+mask+":"+variants+":"+categories+":"+
              Double.doubleToLongBits(chance)+":"+Float.floatToIntBits(scale)+":"+recursive);
            check(java.util.Arrays.equals(flags,new int[]{mask,mask^129,0}),"difficulty table read-only");matrix++;
          }
        for(int step:new int[]{Integer.MIN_VALUE,-2,-1,0,2,3,Integer.MAX_VALUE})
          for(int[] flags:new int[][]{null,new int[0],new int[]{255},expectedTable})
          for(boolean recursive:new boolean[]{false,true}) {
            DifficultyState state=new DifficultyState();state.step=step;state.variants=6;state.categories=6;
            state.speed=0.4f;state.scale=0.75f;state.chance=0.2;state.rotation=0.01666666753590107f;
            state.interval=377;state.quota=17;
            verifyDifficulty(state,flags,recursive,"bounds:"+step+":"+(flags==null?-1:flags.length)+":"+recursive);bounds++;
          }
        DifficultyState state=new DifficultyState();state.step=0;state.variants=3;state.categories=4;
        state.speed=0.4f;state.scale=0.75f;state.rotation=0.01666666753590107f;state.interval=377;state.quota=17;
        for(int tick=0;tick<60;tick++) {
          verifyDifficulty(state,expectedTable,false,"sequence:"+tick);state=difficultyState();sequence++;
        }
        for(float speed:new float[]{0.4f,0f,-0f,Float.MIN_VALUE,Float.MAX_VALUE,Float.NEGATIVE_INFINITY,Float.POSITIVE_INFINITY,Float.NaN})
          for(float scale:new float[]{-1f,-0f,0.75f,Math.nextDown(0.8f),0.8f,Float.NaN,Float.POSITIVE_INFINITY})
          for(boolean preserve:new boolean[]{false,true}) {
            DifficultyState initial=new DifficultyState();initial.speed=speed;initial.scale=scale;initial.quota=99;
            DifficultyState wanted=initial.copy();intervalOracle(wanted,preserve);difficultyState(initial);
            ${call('sa','b(Z)V')}(preserve);
            check(wanted.toString().equals(difficultyState().toString()),"interval floating/cast oracle");
            difficultyTrace("interval:"+preserve+":"+difficultyState());intervals++;
          }
        for(int step:new int[]{-1,0,1,20,21,22})for(int before:new int[]{-9,0,1,40,99})
          for(int increment:new int[]{-11,0,1,2,10}) {
            ${global('ji','field_h','I')}=step;${global('fa','field_b','I')}=before;${global('sa','field_b','I')}=91;
            int total=before+increment+(step!=0&&step<21?10:0);
            int quota=total>0?Math.floorDiv(total+2,3):total/3;
            ${call('qe','b(I)V')}(increment);
            check(${global('fa','field_b','I')}==total&&${global('sa','field_b','I')}==quota,"theme quota ceiling oracle");
            difficultyTrace("quota:"+step+":"+before+":"+increment+":"+total+":"+quota);quotas++;
          }
        for(int methodGuard:new int[]{Integer.MIN_VALUE,-1,0,9407,9408,9409,Integer.MAX_VALUE}) {
          ${global('ul','field_b','I')}=71;${global('fj','field_m','I')}=72;${global('di','field_g','I')}=73;
          ${global('el','field_t','I')}=74;${global('gb','field_c','I')}=75;${global('kc','field_a','I')}=76;
          ${global('kb','field_c','I')}=77;${call('pg','a(I)V')}(methodGuard);
          state=difficultyState();
          check(state.step==0&&state.variants==3&&state.categories==4&&state.quota==17&&state.chance==0,
            "reset counts and quota");
          check(Float.floatToIntBits(state.speed)==Float.floatToIntBits(0.4f)&&state.scale==0.75f&&
            state.rotation==0.01666666753590107f,"reset motion");
          check(${global('fa','field_b','I')}==50&&${global('ul','field_b','I')}==0&&${global('fj','field_m','I')}==0,
            "reset theme progression");
          boolean full=methodGuard==9408;
          check(state.interval==(full?377:77)&&${global('di','field_g','I')}==(full?0:73)&&
            ${global('el','field_t','I')}==(full?0:74)&&${global('gb','field_c','I')}==(full?0:75)&&
            ${global('kc','field_a','I')}==76,"reset guard partial state");
          difficultyTrace("reset:"+methodGuard+":"+state);resets++;
        }
        java.util.Random originalRandom=${global('gk','field_d','Ljava/util/Random;')};
        for(int seed=0;seed<24;seed++)for(int count:new int[]{1,2,3,4,7}) {
          ${global('ag','field_k','I')}=count;${global('f','field_qb','I')}=count;
          for(byte guard:new byte[]{-128,-67,-56,-55,0,127}) {
            ${global('gk','field_d','Ljava/util/Random;')}=new java.util.Random(seed);
            java.util.Random oracle=new java.util.Random(seed);
            int wanted=guard>=-55?66:randomBoundOracle(oracle,count);
            int actual=${call('nf','c(B)I')}(guard);
            check(actual==wanted&&${global('gk','field_d','Ljava/util/Random;')}.nextInt()==oracle.nextInt(),
              "variant selector bound, guard and RNG consumption");
            difficultyTrace("variant:"+seed+":"+count+":"+guard+":"+actual);selections++;
          }
          for(int guard:new int[]{Integer.MIN_VALUE,18,19,48,Integer.MAX_VALUE}) {
            ${global('gk','field_d','Ljava/util/Random;')}=new java.util.Random(seed);
            java.util.Random oracle=new java.util.Random(seed);
            if(guard<=18)randomBoundOracle(oracle,count);
            int wanted=randomBoundOracle(oracle,count),actual=${call('ij','m(I)I')}(guard);
            check(actual==wanted&&${global('gk','field_d','Ljava/util/Random;')}.nextInt()==oracle.nextInt(),
              "category selector bound, guard and RNG consumption");
            difficultyTrace("category:"+seed+":"+count+":"+guard+":"+actual);selections++;
          }
        }
        for(double chance:new double[]{-1d,-0d,0d,Double.NaN})for(int guard:new int[]{0,741924303,741924304}) {
          ${global('sa','field_c','D')}=chance;
          int actual=${call('vd','a(I)I')}(guard);check(actual==(guard==741924304?0:104),"kind selector closed gate");
          difficultyTrace("kind:"+Double.doubleToLongBits(chance)+":"+guard+":"+actual);selections++;
        }
        ${global('gk','field_d','Ljava/util/Random;')}=originalRandom;
        ${global('kd','field_f','[I')}=originalFlags;${global('Geoblox','field_C','I')}=0;
        StringBuilder hash=new StringBuilder();for(byte value:difficultyDigest.digest())hash.append(String.format("%02x",value&255));
        check(matrix==82944&&bounds==56&&sequence==60&&intervals==112&&quotas==150&&resets==7&&selections==1332,
          "complete difficulty matrix coverage");
        System.err.println("difficulty-matrix:"+matrix+":"+bounds+":"+sequence+":"+intervals+":"+quotas+":"+resets+":"+selections+":"+hash);
      }
      public static void main(String[] args) throws Exception {
        Thread watchdog=new Thread(()->{try{Thread.sleep(45000);}catch(InterruptedException error){}System.exit(124);});
        watchdog.setDaemon(true);watchdog.start();
        ${global('Geoblox', 'field_C', 'I')} = 0;
        ${global('vb', 'field_f', 'I')} = 640;
        ${global('vb', 'field_b', 'I')} = 480;
        ${framebuffer} = new int[640 * 480];
        check(!boundary(), "empty playfield");
        int[][] nonBoundary = {{320,240}, {549,240}, {551,240}, {320,11}, {320,9}};
        for (int[] point : nonBoundary) {
          ${framebuffer}[point[0] + point[1] * 640] = 7;
          check(!boundary(), "interior/exterior pixel");
          ${framebuffer}[point[0] + point[1] * 640] = 0;
        }
        int[][] hits = {{550,240}, {90,240}, {320,10}, {320,470},
          {550,241}, {90,239}, {321,10}, {319,470}};
        for (int[] point : hits) {
          ${framebuffer}[point[0] + point[1] * 640] = 1;
          check(boundary(), "circle contact at " + point[0] + "," + point[1]);
          ${framebuffer}[point[0] + point[1] * 640] = 0;
        }
        boundaryMatrix();

        ${active} = new ${deque}();
        ${available} = new ${deque}();
        ${popup} first = new ${popup}(), second = new ${popup}();
        ${available}.${addLast}(-35, second);
        ${available}.${addLast}(-35, first);
        ${call('ug', 'a(IZIII)V')}(90, true, 220, 3, 330);
        ${call('ug', 'a(IZIII)V')}(17, true, 100, 1, 80);
        check(${available}.${empty}(13519), "popup pool consumed");
        check(${active}.${method('tf', 'a(I)I')}(100) == 2, "two active popups");
        check(first.${field('me', 'field_f', 'I')} == 90 && second.${field('me', 'field_f', 'I')} == 17, "points");
        check(first.${field('me', 'field_h', 'I')} == 3 && second.${field('me', 'field_h', 'I')} == 1, "chain");
        check(first.${field('me', 'field_m', 'Ljava/lang/String;')}.equals("90"), "points text");
        check(first.${field('me', 'field_n', 'F')} == 330 && first.${field('me', 'field_i', 'F')} == 220, "origin");
        float progress = 0;
        for (int tick = 0; tick < 10; tick++) {
          progress += 0.03999999910593033f * progress + 0.00004999999873689376f;
          ${call('cf', 'd(B)V')}((byte)27);
          check(Float.floatToIntBits(first.${field('me', 'field_k', 'F')}) == Float.floatToIntBits(progress), "progress");
          check(first.${field('me', 'field_k', 'F')} == second.${field('me', 'field_k', 'F')}, "shared progress");
        }
        check(${call('wa', 'a(I)I')}(-25866) == 107, "unfinished points already include multiplier");
        check(${active}.${empty}(13519), "active popups drained");
        check(${call('wa', 'a(I)I')}(-25866) == 0, "empty drain");

        // Use a one-pixel ordinary sprite so the real entity constructor runs.
        ${global('c', 'field_ab', 'I')} = 0;
        ${global('ke', 'field_a', '[[[Ldm;')} = new ${raster}[1][1][1];
        ${global('ke', 'field_a', '[[[Ldm;')}[0][0][0] = new ${raster}(1, 1);
        ${entity}[] triple = new ${entity}[3];
        for (int i = 0; i < 3; i++)
          triple[i] = new ${entity}(0, 0, 0, 320, 240, 0, 0, 0, 0, i + 1);
        ${global('tl', 'field_g', '[Lja;')} = new ${entity}[]{null, triple[0], triple[1], triple[2]};
        int packed = (1 << 20) | (2 << 10) | 3;
        for (int blocked = 0; blocked < 3; blocked++) {
          ${chain} = 0;
          for (int i = 0; i < 3; i++) {
            triple[i].${field('ja', 'field_E', 'I')} = i == blocked ? 1 : 0;
            triple[i].${field('ja', 'field_K', 'Ltf;')} = new ${deque}();
          }
          ${candidateCount} = 2;
          ${candidates} = new int[]{packed, packed};
          check(${call('ec', 'b(I)Z')}(-18913), "blocked nonempty batch still processed");
          check(${candidateCount} == 0 && ${candidates}[0] == 0 && ${candidates}[1] == 0, "batch consumed");
          check(${chain} == 0 && ${active}.${empty}(13519), "cooldown prevented points popup");
          for (${entity} member : triple)
            check(member.${field('ja', 'field_K', 'Ltf;')} == null, "candidate queue reset");
        }
        ${global('wb', 'field_b', 'I')} = 0;
        check(!${call('ec', 'b(I)Z')}(-18913), "empty batch");

        ${moving} = new ${deque}(); ${staged} = new ${deque}(); ${transient} = new ${deque}();
        ${attached} = new ${deque}();
        ${attached}.${addLast}(-35, triple[0]);
        ${global('jl', 'field_t', 'Z')} = false;
        check(${call('ih', 'a(I)Z')}(0), "settled does not mean attached board empty");
        for (${deque} queue : new ${deque}[]{${moving}, ${staged}, ${transient}}) {
          queue.${addLast}(-35, triple[1]);
          check(!${call('ih', 'a(I)Z')}(0), "active queue prevents settling");
          queue.${method('tf', 'b(B)Lhf;')}((byte)-100);
        }
        ${global('jl', 'field_t', 'Z')} = true;
        check(!${call('ih', 'a(I)Z')}(0), "additional settling gate");
        System.out.println("gameplay behavior passed");cases++;
        contacts();
        secondaryQueues();
        conversions();
        reconciliation();
        feedback();
        animation();
        tintRequests();
        routing();
        difficultyMatrix();
        comparatorMatrix();
        motionMatrix();
        collisionSpawnMatrix();
        System.out.println("complete:"+cases+":conversion-failures:"+conversionFailures);
      }
    }`;
    const directory = path.join(temporary, variant);
    const classes = path.join(directory, 'classes');
    fs.mkdirSync(classes, {recursive: true});
    const harnessFile = path.join(directory, 'GameplayBehavior.java');
    fs.writeFileSync(harnessFile, harness);
    const sourceRoot = path.join(root, renamed ? 'geoblox/src' : '../games/geoblox');
    const files = path.join(directory, 'sources.txt');
    fs.writeFileSync(files, [...(native ? [] : sourceInventory(sourceRoot).map(file => JSON.stringify(path.join(sourceRoot, file.path)))), JSON.stringify(harnessFile)].join('\n') + '\n');
    const stub = path.join(root, 'funorb-stubs.jar');
    const classpath = native ? nativeInput + path.delimiter + stub : stub;
    captureProcess(process.env.JAVAC ?? 'javac', ['--release', '8', '-proc:none', '-encoding', 'UTF-8', '-classpath', classpath, '-d', classes, '@' + files]);
    const output = captureProcess(process.env.JAVA ?? 'java', ['-Djava.awt.headless=true', '-cp', classes + path.delimiter + classpath, 'GameplayBehavior']);
    const sha256 = crypto.createHash('sha256').update(output.stdout).digest('hex');
    assert.match(output.stderr.toString(), /(?:^|\n)boundary-matrix:425042:1300:18:5(?:\n|$)/,
      'complete boundary matrix must run independently in every variant');
    const difficulty = output.stderr.toString().match(/(?:^|\n)difficulty-matrix:82944:56:60:112:150:7:1332:([a-f0-9]{64})(?:\n|$)/)?.[1];
    assert.ok(difficulty, 'complete difficulty matrix must run independently in every variant');
    assert.equal(difficulty,expectedDifficultySha256,variant);
    if(expectedDifficulty===undefined)expectedDifficulty=difficulty;
    else assert.equal(difficulty,expectedDifficulty,variant);
    const comparator = output.stderr.toString().match(/(?:^|\n)comparator-matrix:32768:([a-f0-9]{64})(?:\n|$)/)?.[1];
    assert.ok(comparator, 'complete comparator matrix must run independently in every variant');
    assert.equal(comparator,expectedComparatorSha256,variant);
    if(expectedComparator===undefined)expectedComparator=comparator;
    else assert.equal(comparator,expectedComparator,variant);
    console.log(JSON.stringify({variant,sha256,completion:output.stdout.toString().trim().split('\n').at(-1),
      boundaryPixelChecks:425042,boundaryPerimeterPixels:1300,boundaryGuardChecks:18,boundaryRasterChecks:5,
      difficultySha256:difficulty,difficultyFlagCases:82944,difficultyBoundsCases:56,difficultySequenceTicks:60,
      spawnIntervalCases:112,themeQuotaCases:150,difficultyResetCases:7,spawnSelectionCases:1332,
      comparatorSha256:comparator,comparatorCases:32768}));
    const motion=output.stderr.toString().match(/(?:^|\n)motion-matrix:50:100:600:3750:([a-f0-9]{64})(?:\n|$)/)?.[1];
    assert.ok(motion,'complete independent motion matrix must run in every variant');
    console.log(JSON.stringify({variant,motionSha256:motion,motionCases:4500}));
    assert.equal(motion,expectedMotionSha256,variant);
    const collisionSpawn=output.stderr.toString().match(/(?:^|\n)collision-spawn-matrix:6000:300:100:4800:27:([a-f0-9]{64})(?:\n|$)/)?.[1];
    assert.ok(collisionSpawn,'complete collision/spawn matrix must run in every variant');
    console.log(JSON.stringify({variant,collisionSpawnSha256:collisionSpawn,collisionSpawnCases:11227}));
    assert.equal(collisionSpawn,expectedCollisionSpawnSha256,variant);
    assert.equal(sha256,expectedNativeSha256,variant);
    if(expected===undefined)expected=output.stdout;
    else assert.equal(Buffer.compare(output.stdout,expected),0,variant);
  }
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
