// Shared fixture logic, with independently reviewed declaration identities
// supplied by each game's core harness. No game implementation is substituted.
export function archiveIndexProbe({className, f, m}, spec) {
  const index=spec.index, lookup=spec.lookup, archive=spec.archive;
  const indexField=(name,type)=>f(index.owner,index.fields[name],type);
  const archiveField=(name,type)=>f(archive.owner,archive.fields[name],type);
  const invoke=(object, entry, args)=>`call(archive,${object},"${m(archive.owner,...entry.identity)}",new Class<?>[]{${entry.types}},${args??entry.args})`;
  const lookupCall=(object,key)=>`call(lookup,${object},"${m(lookup.owner,...lookup.get.identity)}",new Class<?>[]{${lookup.get.types}},${key},${lookup.get.guard})`;
  return `
static byte[] archiveContainer(byte[] body,int compression)throws Exception{
java.io.ByteArrayOutputStream data=new java.io.ByteArrayOutputStream();
if(compression==2){java.util.zip.GZIPOutputStream gzip=new java.util.zip.GZIPOutputStream(data);gzip.write(body);gzip.close();}else data.write(body);
byte[] encoded=data.toByteArray();java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
out.writeByte(compression);out.writeInt(encoded.length);if(compression!=0)out.writeInt(body.length);out.write(encoded);return bytes.toByteArray();
}
static void archiveInteger(java.io.DataOutputStream out,int version,int value)throws Exception{
if(version>=7&&value>=32768)out.writeInt(value|Integer.MIN_VALUE);else out.writeShort(value);
}
static int archiveCrc(byte[] bytes){java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(bytes);return (int)crc.getValue();}
static byte[] archiveIndexBody(int version,int flags,int[] groups,int[][] files)throws Exception{
java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
out.writeByte(version);if(version>=6)out.writeInt(0x12345678);out.writeByte(flags);archiveInteger(out,version,groups.length);
int previous=0;for(int id:groups){archiveInteger(out,version,id-previous);previous=id;}
String[] names={"models","maps"};if((flags&1)!=0)for(int i=0;i<groups.length;i++)out.writeInt(names[i].hashCode());
for(int i=0;i<groups.length;i++)out.writeInt(0x76543210+i);
if((flags&2)!=0)for(int i=0;i<groups.length;i++)for(int b=0;b<64;b++)out.writeByte(i*67+b);
for(int i=0;i<groups.length;i++)out.writeInt(700+i);
for(int[] row:files)archiveInteger(out,version,row.length);
for(int[] row:files){previous=0;for(int id:row){archiveInteger(out,version,id-previous);previous=id;}}
if((flags&1)!=0)for(int[] row:files)for(int i=0;i<row.length;i++)out.writeInt((i==0?"base":"extra").hashCode());
return bytes.toByteArray();
}
static void rejectArchiveIndex(Class<?> index,byte[] bytes,int crc,byte[] digest,String label)throws Exception{
try{make(index,new Class<?>[]{byte[].class,int.class,byte[].class},bytes,crc,digest);throw new AssertionError(label+": accepted");}
catch(InvocationTargetException error){Throwable cause=error.getCause();Class<?> context=Class.forName("${className(spec.context.owner)}");while(context.isInstance(cause))cause=(Throwable)get(context,cause,"${f(spec.context.owner,spec.context.cause,'Ljava/lang/Throwable;')}");check(label,cause.getClass()==RuntimeException.class,true);}
}
static void verifyArchiveIndexes(Class<?> packet)throws Exception{
Class<?> index=Class.forName("${className(index.owner)}"),lookup=Class.forName("${className(lookup.owner)}"),archive=Class.forName("${className(archive.owner)}"),provider=Class.forName("${className(spec.provider)}");
// Collisions, duplicate and negative keys, including -1, use value-slot emptiness.
int[][] keySets={{},{0},{-1},{0,16,32,-16,-1,0,Integer.MIN_VALUE,Integer.MAX_VALUE}};
for(int fixture=0;fixture<keySets.length;fixture++){int[] original=keySets[fixture].clone(),source=original.clone();Object table=make(lookup,new Class<?>[]{int[].class},(Object)source);Arrays.fill(source,12345);
for(int key:new int[]{0,16,32,-16,-1,Integer.MIN_VALUE,Integer.MAX_VALUE,99,12345}){int expected=-1;for(int i=0;i<original.length;i++)if(original[i]==key){expected=i;break;}check("index-lookup/"+fixture+"/"+key,${lookupCall('table','key')},expected);}}
// The independent encoder covers all supported versions/flags and both raw
// and gzip containers, including sparse rows and implicit contiguous IDs.
for(int version=5;version<=7;version++)for(int flags=0;flags<4;flags++)for(int compression:new int[]{0,2}){
int[] groups={2,5};int[][] files={{0,1},{1,4}};byte[] body=archiveIndexBody(version,flags,groups,files),encoded=archiveContainer(body,compression);
Object decoded=make(index,new Class<?>[]{byte[].class,int.class,byte[].class},encoded,archiveCrc(encoded),null);String label="archive-index/"+version+"/"+flags+"/"+compression;
check(label+"/group-count",get(index,decoded,"${indexField('groupCount','I')}"),2);check(label+"/group-capacity",get(index,decoded,"${indexField('groupCapacity','I')}"),6);
check(label+"/groups",Arrays.toString((int[])get(index,decoded,"${indexField('groupIds','[I')}")),"[2, 5]");check(label+"/revision",get(index,decoded,"${indexField('revision','I')}"),version>=6?0x12345678:0);
check(label+"/crc",get(index,decoded,"${indexField('indexCrc','I')}"),archiveCrc(encoded));check(label+"/unrequested-digest",get(index,decoded,"${indexField('indexDigest','[B')}")==null,true);
check(label+"/file-counts",Arrays.toString((int[])get(index,decoded,"${indexField('fileCounts','[I')}")),"[0, 0, 2, 0, 0, 2]");check(label+"/file-capacities",Arrays.toString((int[])get(index,decoded,"${indexField('fileCapacities','[I')}")),"[0, 0, 2, 0, 0, 5]");
int[][] fileIds=(int[][])get(index,decoded,"${indexField('fileIds','[[I')}");check(label+"/implicit-files",fileIds[2]==null,true);check(label+"/sparse-files",Arrays.toString(fileIds[5]),"[1, 4]");
int[] crcs=(int[])get(index,decoded,"${indexField('groupCrcs','[I')}"),versions=(int[])get(index,decoded,"${indexField('groupVersions','[I')}");
for(int group=0;group<6;group++){int ordinal=group==2?0:group==5?1:-1;check(label+"/group-crc/"+group,crcs[group],ordinal<0?0:0x76543210+ordinal);check(label+"/group-version/"+group,versions[group],ordinal<0?0:700+ordinal);}
byte[][] digests=(byte[][])get(index,decoded,"${indexField('groupDigests','[[B')}");check(label+"/digest-presence",digests!=null,(flags&2)!=0);
if(digests!=null)for(int group=0;group<6;group++){int ordinal=group==2?0:group==5?1:-1;check(label+"/digest-row/"+group,digests[group]!=null,ordinal>=0);if(ordinal>=0){check(label+"/digest-length/"+group,digests[group].length,64);for(int b=0;b<64;b++)check(label+"/digest-byte/"+group+"/"+b,digests[group][b],(byte)(ordinal*67+b));}}
Object groupLookup=get(index,decoded,"${indexField('groupNameLookup','L'+lookup.owner+';')}");check(label+"/name-presence",groupLookup!=null,(flags&1)!=0);
if((flags&1)!=0){int[] hashes=(int[])get(index,decoded,"${indexField('groupNameHashes','[I')}");int[][] fileHashes=(int[][])get(index,decoded,"${indexField('fileNameHashes','[[I')}");
check(label+"/group-hash-hole",hashes[0],-1);check(label+"/group-hash",hashes[5],"maps".hashCode());check(label+"/group-lookup",${lookupCall('groupLookup','"maps".hashCode()')},5);
check(label+"/file-hash-hole",fileHashes[5][0],-1);check(label+"/file-hash",fileHashes[5][4],"extra".hashCode());Object fileLookup=Array.get(get(index,decoded,"${indexField('fileNameLookups','[L'+lookup.owner+';')}"),5);check(label+"/file-lookup",${lookupCall('fileLookup','"extra".hashCode()')},4);
Object resource=make(archive,new Class<?>[]{provider,boolean.class,int.class},null,true,0);set(archive,resource,"${archiveField('index','L'+index.owner+';')}",decoded);
check(label+"/archive-ready",${invoke('resource',archive.ensure)},true);check(label+"/archive-group",${invoke('resource',archive.groupId,'"MAPS",'+archive.groupId.guard)},5);check(label+"/archive-missing-group",${invoke('resource',archive.groupId,'"missing",'+archive.groupId.guard)},-1);
check(label+"/archive-file",${invoke('resource',archive.fileId,archive.fileId.arguments('5','"EXTRA"'))},4);check(label+"/archive-missing-file",${invoke('resource',archive.fileId,archive.fileId.arguments('5','"missing"'))},-1);
}
for(int mode=0;mode<3;mode++){Object resource=make(archive,new Class<?>[]{provider,boolean.class,int.class},null,false,mode);set(archive,resource,"${archiveField('index','L'+index.owner+';')}",decoded);Object[][] rows=new Object[6][];rows[2]=new Object[]{new byte[]{9,8,7},new byte[]{6,5}};set(archive,resource,"${archiveField('unpackedFiles','[[Ljava/lang/Object;')}",rows);
check(label+"/retention/"+mode+"/bytes",Arrays.toString((byte[])${invoke('resource',archive.getFile,archive.getFile.arguments('2','0'))}),"[9, 8, 7]");check(label+"/retention/"+mode+"/row",rows[2]!=null,mode!=2);if(mode!=2){check(label+"/retention/"+mode+"/file",rows[2][0]!=null,mode==0);check(label+"/retention/"+mode+"/sibling",rows[2][1]!=null,true);}}
rejectArchiveIndex(index,encoded,archiveCrc(encoded)^1,null,label+"/bad-crc");rejectArchiveIndex(index,encoded,archiveCrc(encoded),new byte[63],label+"/bad-digest-length");
}
// Empty indexes and large-smart boundaries require explicit fixtures, since
// successful small-ID decoding cannot establish four-byte ID behavior.
byte[] empty=archiveContainer(archiveIndexBody(7,0,new int[0],new int[0][]),0);Object emptyIndex=make(index,new Class<?>[]{byte[].class,int.class,byte[].class},empty,archiveCrc(empty),null);check("archive-empty/count",get(index,emptyIndex,"${indexField('groupCount','I')}"),0);check("archive-empty/capacity",get(index,emptyIndex,"${indexField('groupCapacity','I')}"),0);
int[] largeGroups={0,32768};int[][] largeFiles={{0,32768},{32767}};byte[] large=archiveContainer(archiveIndexBody(7,0,largeGroups,largeFiles),0);Object largeIndex=make(index,new Class<?>[]{byte[].class,int.class,byte[].class},large,archiveCrc(large),null);check("archive-large/groups",Arrays.toString((int[])get(index,largeIndex,"${indexField('groupIds','[I')}")),"[0, 32768]");int[][] largeRows=(int[][])get(index,largeIndex,"${indexField('fileIds','[[I')}");check("archive-large/files",Arrays.toString(largeRows[0]),"[0, 32768]");check("archive-large/short-boundary",Arrays.toString(largeRows[32768]),"[32767]");
for(int badVersion:new int[]{4,8}){byte[] invalid=archiveContainer(new byte[]{(byte)badVersion},0);rejectArchiveIndex(index,invalid,archiveCrc(invalid),null,"archive-version/"+badVersion);}
for(int value:new int[]{0,32767,32768,65535,Integer.MAX_VALUE}){java.io.ByteArrayOutputStream data=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(data);archiveInteger(out,7,value);Object input=make(packet,new Class<?>[]{byte[].class},(Object)data.toByteArray());check("large-smart/"+value,call(packet,input,"${m(spec.packet.owner,...spec.packet.largeSmart.identity)}",new Class<?>[]{${spec.packet.largeSmart.types}},${spec.packet.largeSmart.guard}),value);check("large-smart/cursor/"+value,get(packet,input,"${f(spec.packet.owner,spec.packet.position,'I')}"),value<32768?2:4);}
}
`;
}
