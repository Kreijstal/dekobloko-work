// Native raw/named fixtures embedded in AceCoreProbe, sharing its complete
// source compilation. Packets are constructed independently with JDK I/O/CRC.
export function highscoreProbe(c, f, m) {
  return `
static ${c('dl')} highscorePacket(){
${c('dl')} packet=new ${c('dl')}(4096);packet.${m('dl','a','(Z[I)V')}(true,new int[]{0,0,0,0});return packet;
}
static byte[] queryBytes(int cipherWord,int queryId,int limit,int width)throws Exception{
java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
out.writeByte(cipherWord+3);out.writeByte(5);out.writeByte(0);out.writeShort(queryId);out.writeByte(limit);out.writeByte(width);return bytes.toByteArray();
}
static byte[] submissionBytes(int cipherWord,${c('ga')} submission)throws Exception{
java.io.ByteArrayOutputStream payload=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(payload);
out.writeByte(1);out.writeShort(submission.${f('ga','m','I')});out.writeShort(submission.${f('ga','e','I')});out.writeShort(submission.${f('ga','k','I')});
out.writeInt(submission.${f('ga','i','I')});out.writeInt(submission.${f('ga','g','I')});out.writeInt(submission.${f('ga','n','I')});out.writeInt(submission.${f('ga','f','I')});
out.writeByte(submission.${f('ga','h','[I')}.length);for(int value:submission.${f('ga','h','[I')})out.writeInt(value);
java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(payload.toByteArray());out.writeInt((int)crc.getValue());
java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();bytes.write((byte)(cipherWord+3));bytes.write(payload.size());bytes.write(payload.toByteArray());return bytes.toByteArray();
}
static void packetEquals(String name,${c('dl')} packet,byte[] expected){
check(name,Arrays.toString(Arrays.copyOf(packet.${f('rb','f','[B')},packet.${f('rb','g','I')})),Arrays.toString(expected));
}
static void incomingHighscores(byte[] bytes){
${c('dl')} packet=new ${c('dl')}(bytes.length);System.arraycopy(bytes,0,packet.${f('rb','f','[B')},0,bytes.length);${c('nm')}.${f('nm','c','Ldl;')}=packet;
${c('ce')}.${m('ce','a','(B)V')}((byte)116);check("highscore/response-consumed",packet.${f('rb','g','I')},bytes.length);
}
static void highscores()throws Exception{
for(int next:new int[]{-1,0,65535,65536,Integer.MAX_VALUE,Integer.MIN_VALUE}){
${c('am')}.${f('am','a','I')}=next;int[] values={Integer.MIN_VALUE,-1,0,Integer.MAX_VALUE};
${c('ga')} submission=new ${c('ga')}(1,65534,11,-22,33,-44,values);
check("highscore/id-wrap",submission.${f('ga','m','I')},next&65535);check("highscore/next-id",${c('am')}.${f('am','a','I')},next+1);
check("highscore/first-short",submission.${f('ga','e','I')},1);check("highscore/second-short",submission.${f('ga','k','I')},65534);
check("highscore/context-1",submission.${f('ga','i','I')},11);check("highscore/context-2",submission.${f('ga','g','I')},-22);
check("highscore/context-3",submission.${f('ga','n','I')},33);check("highscore/context-4",submission.${f('ga','f','I')},-44);
check("highscore/retained-values",submission.${f('ga','h','[I')}==values,true);
${c('q')}.${f('q','p','Ldl;')}=highscorePacket();${c('ac')}.${m('ac','a','(IILga;)V')}(0,3,submission);
packetEquals("highscore/submission-wire",${c('q')}.${f('q','p','Ldl;')},submissionBytes(new ${c('fc')}(new int[]{0,0,0,0}).${m('fc','b','(I)I')}(256),submission));
}
${c('nh')}.${f('nh','g','Lkp;')}=new ${c('kp')}();${c('tq')}.${f('tq','d','Lkp;')}=new ${c('kp')}();
${c('q')}.${f('q','p','Ldl;')}=highscorePacket();${c('fc')} expectedCipher=new ${c('fc')}(new int[]{0,0,0,0});
${c('uc')} query=${c('vo')}.${m('vo','a','(BIIII)Luc;')}((byte)127,3,10,1,1);
check("highscore/query-incomplete",query.${f('uc','i','Z')},false);check("highscore/query-linked",query.${m('wf','b','(B)Z')}((byte)100),true);
packetEquals("highscore/query-wire",${c('q')}.${f('q','p','Ldl;')},queryBytes(expectedCipher.${m('fc','b','(I)I')}(256),1,10,1));
int previousPosition=${c('q')}.${f('q','p','Ldl;')}.${f('rb','g','I')};
for(byte guard:new byte[]{119,127})check("highscore/deduplicate-id",${c('vo')}.${m('vo','a','(BIIII)Luc;')}(guard,99,3,2,1)==query,true);
check("highscore/deduplicate-no-write",${c('q')}.${f('q','p','Ldl;')}.${f('rb','g','I')},previousPosition);
check("highscore/deduplicate-keeps-limit",query.${f('uc','j','I')},10);check("highscore/deduplicate-keeps-width",query.${f('uc','m','I')},1);
// Zero name count completes a query without allocating result arrays.
incomingHighscores(new byte[]{0,0,1,0});check("highscore/empty-completed",query.${f('uc','i','Z')},true);
check("highscore/empty-no-values",query.${f('uc','h','[[I')}==null,true);check("highscore/completion-unlinks",query.${m('wf','b','(B)Z')}((byte)100),false);
check("highscore/completion-allows-new",${c('vo')}.${m('vo','a','(BIIII)Luc;')}((byte)127,3,3,2,1)!=query,true);
// Independent response rows: repeated local names, all/my/best
// views, widths 1..3, signed tokens and row limits. Every row contributes
// to at least one view; no assumption about server handling of discarded rows.
${c('cf')}.${f('cf','h','Ljava/lang/String;')}="pilot";${c('fj')}.${f('fj','a','Ljava/lang/String;')}="Pilot";
for(int width=1;width<=3;width++){
${c('nh')}.${f('nh','g','Lkp;')}=new ${c('kp')}();query=new ${c('uc')}();query.${f('uc','n','I')}=1;query.${f('uc','j','I')}=3;query.${f('uc','m','I')}=width;
${c('nh')}.${f('nh','g','Lkp;')}.${m('kp','a','(ILwf;)V')}(81,query);
${c('pe')}.${f('pe','b','[Lgl;')}=new ${c('gl')}[]{new ${c('gl')}(),new ${c('gl')}(),new ${c('gl')}()};
java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
out.writeByte(0);out.writeShort(1);out.writeByte(3);
out.writeBytes("Bob");out.writeByte(0);out.writeByte(1);out.writeBytes("OldBob");out.writeByte(0);
out.writeBytes("Cy");out.writeByte(0);out.writeByte(0);out.writeByte(4);
int[] nameIds={0,1,0,2};long[] tokens={11,22,-33,Long.MIN_VALUE};
for(int row=0;row<4;row++){out.writeByte(nameIds[row]);out.writeLong(tokens[row]);for(int value=0;value<width;value++)out.writeInt(10000-row*100+value);}
incomingHighscores(bytes.toByteArray());check("highscore/completed",query.${f('uc','i','Z')},true);check("highscore/unlinked",query.${m('wf','b','(B)Z')}((byte)100),false);
String[][] names={{"Pilot","Bob","Pilot"},{"Pilot","Pilot",null},{"Pilot","Bob","Cy"}};
int[][] rows={{0,1,2},{0,2,-1},{0,1,3}};
for(int view=0;view<3;view++)for(int row=0;row<3;row++){
int source=rows[view][row];check("highscore/view-name",query.${f('uc','e','[[Ljava/lang/String;')}[view][row],names[view][row]);
check("highscore/view-token",query.${f('uc','f','[[J')}[view][row],source<0?0L:tokens[source]);
for(int value=0;value<width;value++)check("highscore/view-value",query.${f('uc','h','[[I')}[view][row*width+value],source<0?0:10000-source*100+value);
}
check("highscore/alternate-name",${c('pe')}.${f('pe','b','[Lgl;')}[1].${f('gl','f','Ljava/lang/String;')},"OldBob");
for(${c('gl')} name:${c('pe')}.${f('pe','b','[Lgl;')})check("highscore/unique-marker",name.${f('gl','g','Z')},true);
${c('ga')} submitted=new ${c('ga')}(1,65534,0,0,0,0,new int[width]);submitted.${f('ga','j','J')}=-33;
for(int value=0;value<width;value++)submitted.${f('ga','h','[I')}[value]=9800+value;
for(int view=0;view<3;view++)check("highscore/find-submitted",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(query,(byte)113,view,submitted),view==0?2:view==1?1:-1);
for(int value=0;value<width;value++){submitted.${f('ga','h','[I')}[value]++;check("highscore/reject-any-value",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(query,(byte)113,0,submitted),-1);submitted.${f('ga','h','[I')}[value]--;}
submitted.${f('ga','j','J')}=123;check("highscore/reject-token",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(query,(byte)113,0,submitted),-1);
submitted.${f('ga','j','J')}=-33;submitted.${f('ga','e','I')}=0;check("highscore/reject-query",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(query,(byte)113,0,submitted),-1);
submitted.${f('ga','e','I')}=1;submitted.${f('ga','j','J')}=22;for(int value=0;value<width;value++)submitted.${f('ga','h','[I')}[value]=9900+value;
check("highscore/reject-other-player",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(query,(byte)113,0,submitted),-1);
check("highscore/null-query",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(null,(byte)113,0,submitted),-1);
check("highscore/null-submission",${c('ca')}.${m('ca','a','(Luc;BILga;)I')}(query,(byte)113,0,null),-1);
}
// Two pending submissions prove ACK lookup uses the ID, rather than head
// removal; retransmission also keeps all nodes pending until an ACK arrives.
${c('am')}.${f('am','a','I')}=65535;${c('ga')} first=new ${c('ga')}(0,65535,1,2,3,4,new int[]{12345}),second=new ${c('ga')}(1,65534,5,6,7,8,new int[]{98765});
${c('q')}.${f('q','p','Ldl;')}=highscorePacket();${c('ak')}.${m('ak','a','(Lga;ZI)V')}(first,true,3);${c('ak')}.${m('ak','a','(Lga;ZI)V')}(second,true,3);
check("highscore/queue-first",first.${m('wf','b','(B)Z')}((byte)100),true);check("highscore/queue-second",second.${m('wf','b','(B)Z')}((byte)100),true);
${c('nh')}.${f('nh','g','Lkp;')}=new ${c('kp')}();query=new ${c('uc')}();query.${f('uc','n','I')}=1;query.${f('uc','j','I')}=10;query.${f('uc','m','I')}=1;${c('nh')}.${f('nh','g','Lkp;')}.${m('kp','a','(ILwf;)V')}(81,query);
for(int guard:new int[]{1,0}){
${c('q')}.${f('q','p','Ldl;')}=highscorePacket();expectedCipher=new ${c('fc')}(new int[]{0,0,0,0});${c('pl')}.${m('pl','c','(II)V')}(3,guard);
java.io.ByteArrayOutputStream expected=new java.io.ByteArrayOutputStream();expected.write(submissionBytes(expectedCipher.${m('fc','b','(I)I')}(256),first));expected.write(submissionBytes(expectedCipher.${m('fc','b','(I)I')}(256),second));
if(guard==0)expected.write(queryBytes(expectedCipher.${m('fc','b','(I)I')}(256),1,10,1));packetEquals("highscore/resend-wire",${c('q')}.${f('q','p','Ldl;')},expected.toByteArray());
check("highscore/resend-keeps-pending",first.${m('wf','b','(B)Z')}((byte)100)&&second.${m('wf','b','(B)Z')}((byte)100)&&query.${m('wf','b','(B)Z')}((byte)100),true);
}
for(${c('ga')} submission:new ${c('ga')}[]{second,first}){
java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);out.writeByte(1);out.writeShort(submission.${f('ga','m','I')});out.writeLong(Long.MIN_VALUE+submission.${f('ga','m','I')});incomingHighscores(bytes.toByteArray());
check("highscore/ack-token",submission.${f('ga','j','J')},Long.MIN_VALUE+submission.${f('ga','m','I')});check("highscore/ack-unlinks",submission.${m('wf','b','(B)Z')}((byte)100),false);
if(submission==second)check("highscore/ack-preserves-other",first.${m('wf','b','(B)Z')}((byte)100),true);
}
check("highscore/queue-drained",${c('tq')}.${f('tq','d','Lkp;')}.${m('kp','a','(Z)Z')}(true),true);
// The real session result path remains headless; alternate client mode keeps
// local results without sending, and the normal mode queues the same object.
${c('ks')}.${f('ks','b','Z')}=true;${c('tt')}.${f('tt','a','Z')}=false;
for(boolean arcade:new boolean[]{false,true})for(int score:new int[]{0,1,123456,Integer.MAX_VALUE})for(int accuracy:new int[]{0,37,100}){
${c('pk')} session=(${c('pk')})unsafe.allocateInstance(${c('pk')}.class);field(${c('pk')}.class,"${f('pk','Cb','Z')}").setBoolean(session,arcade);session.${f('pk','q','I')}=score;session.${f('pk','b','I')}=accuracy;${c('to')}.${f('to','r','Lga;')}=null;
session.${m('pk','g','(I)V')}(-8);${c('ga')} result=${c('to')}.${f('to','r','Lga;')};
check("highscore/positive-score-required",result!=null,score>0);if(result==null)continue;
check("highscore/result-mode",result.${f('ga','e','I')},arcade?1:0);check("highscore/result-mode-check",result.${f('ga','k','I')},arcade?65534:65535);
check("highscore/result-packed",Arrays.toString(result.${f('ga','h','[I')}),Arrays.toString(new int[]{100*score+accuracy}));
check("highscore/local-result-unsent",result.${m('wf','b','(B)Z')}((byte)100),false);session.${m('pk','g','(I)V')}(-8);check("highscore/result-once",${c('to')}.${f('to','r','Lga;')}==result,true);
}
${c('pk')} session=(${c('pk')})unsafe.allocateInstance(${c('pk')}.class);session.${f('pk','q','I')}=123;session.${f('pk','b','I')}=97;${c('to')}.${f('to','r','Lga;')}=null;
${c('tt')}.${f('tt','a','Z')}=true;session.${m('pk','g','(I)V')}(-8);check("highscore/blocked-result",${c('to')}.${f('to','r','Lga;')}==null,true);
${c('tt')}.${f('tt','a','Z')}=false;${c('ks')}.${f('ks','b','Z')}=false;${c('q')}.${f('q','p','Ldl;')}=highscorePacket();session.${m('pk','g','(I)V')}(-8);
check("highscore/session-queues-result",${c('to')}.${f('to','r','Lga;')}.${m('wf','b','(B)Z')}((byte)100),true);
packetEquals("highscore/session-result-wire",${c('q')}.${f('q','p','Ldl;')},submissionBytes(new ${c('fc')}(new int[]{0,0,0,0}).${m('fc','b','(I)I')}(256),${c('to')}.${f('to','r','Lga;')}));

}
`;
}
