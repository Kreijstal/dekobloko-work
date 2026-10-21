// The same original audio preparation and archive decoder execute in both VMs.
// Drawing, network transfer and audio-device playback are outside this workload.
export function vorbisProbeSource() {
  return `public class LoadingKernelProbe {
 static byte[] output;static int written;static long decodeNanos;
 public static void main(String[] args)throws Exception {
  GeobloxLoading.browserMode=args.length==0;GeobloxLoading.assetRoot=args.length==0?null:args[0];Geoblox.clientControlFlowFlag=0;
  GeobloxLoading.LocalArchive local=new GeobloxLoading.LocalArchive(3);ResourceArchive archive=new ResourceArchive(local,false,0);archive.ensureIndexLoaded(0);
  int count=local.index.fileCounts[0],chosen=-1,size=-1;int[] files=local.index.fileIds[0];
  for(int i=0;i<count;i++){int file=files==null?i:files[i];if(file==0)continue;byte[] data=archive.getFile(0,-28153,file);if(data.length>size){size=data.length;chosen=file;}}
  if(chosen<0)throw new AssertionError("No sample");
  MusicDecoder decoder=MusicDecoder.loadById(archive,0,chosen);if(decoder==null)throw new AssertionError("No decoder");
  long start=System.nanoTime();PcmSample sample=decoder.decodePcmBudgeted(null);decodeNanos=System.nanoTime()-start;
  if(sample==null)throw new AssertionError("No PCM");output=sample.samples;written=output.length;
  if(args.length>0)System.out.write(output);
 }
}`;
}

export function loadingWorkloadSource(groups) {
  return String.raw`import java.nio.file.*;
import java.util.zip.CRC32;
public final class GeobloxLoading {
  static boolean browserMode;
  static String assetRoot;
  static native byte[] browserAsset(String name);
  static long musicNanos, graphicsNanos, decodedBytes, pcmBytes;
  static int pcmSamples, archiveFiles;
  static long pcmCrc, graphicsCrc;
  static final byte[][] graphicPayloads=new byte[4096][];
  static byte[] asset(String name) throws Exception {
    return browserMode ? browserAsset(name) : Files.readAllBytes(Paths.get(assetRoot,name));
  }
  static final class LocalArchive extends ArchiveSource {
    final int archiveId;
    final ArchiveIndex index;
    LocalArchive(int id) throws Exception {
      archiveId=id;byte[] data=asset("255-"+id+".bin");CRC32 crc=new CRC32();crc.update(data,0,data.length);
      index=new ArchiveIndex(data,(int)crc.getValue(),null);
    }
    int getGroupProgress(int guard,int group){return 100;}
    ArchiveIndex getIndex(byte guard){return index;}
    byte[] getPackedGroup(int guard,int group){try{return asset(archiveId+"-"+group+".bin");}catch(Exception e){throw new RuntimeException(e);}}
  }
  static ResourceArchive archive(int id) throws Exception {return new ResourceArchive(new LocalArchive(id),false,0);}
  static void audio() throws Exception {
    AudioOutput.configureAudio(22050,true,10);
    PasswordWidgetRenderer.gameMusicStream=new MidiPcmStream();
    SocketConnector.prepareInitialGameAudio(archive(2),(byte)80,archive(3),archive(5),archive(4));
  }
  static void validateAudio() {
    CRC32 hash=new CRC32();
    for(PcmSample sample:GameSoundResources.gameSoundSamples)if(sample!=null){hash.update(sample.samples,0,sample.samples.length);pcmBytes+=sample.samples.length;pcmSamples++;}
    pcmCrc=hash.getValue();if(pcmSamples==0)throw new AssertionError("No audio decoded");
  }
  static void graphics() throws Exception {
    int archiveCursor=0;int[][] selectedGroups=${groups};
    for(int id:new int[]{0,1,6}) {
      LocalArchive local=new LocalArchive(id);ResourceArchive archive=new ResourceArchive(local,false,0);
      archive.ensureIndexLoaded(0);
      for(int group:selectedGroups[archiveCursor++]) {
        int[] files=local.index.fileIds[group];
        int count=local.index.fileCounts[group];
        for(int i=0;i<count;i++) {
          byte[] bytes=archive.getFile(group,-28153,files==null?i:files[i]);
          if(bytes==null)throw new AssertionError("Missing decoded file");
          if(archiveFiles==graphicPayloads.length)throw new AssertionError("Too many decoded files");
          graphicPayloads[archiveFiles++]=bytes;decodedBytes+=bytes.length;
        }
      }
    }
  }
  static void validateGraphics() {
    CRC32 hash=new CRC32();
    for(int i=0;i<archiveFiles;i++)hash.update(graphicPayloads[i],0,graphicPayloads[i].length);
    graphicsCrc=hash.getValue();
  }
  public static void main(String[] args) throws Exception {
    browserMode=args.length==0;assetRoot=browserMode?null:args[0];
    Geoblox.clientControlFlowFlag=0;
    long t=System.nanoTime();audio();musicNanos=System.nanoTime()-t;validateAudio();
    t=System.nanoTime();graphics();graphicsNanos=System.nanoTime()-t;validateGraphics();
    System.out.println("LOADING musicMs="+(musicNanos/1e6)+" graphicsMs="+(graphicsNanos/1e6)+" pcmSamples="+pcmSamples+" pcmBytes="+pcmBytes+" pcmCrc="+pcmCrc+" archiveFiles="+archiveFiles+" decodedBytes="+decodedBytes+" graphicsCrc="+graphicsCrc);
  }
}
`;
}
