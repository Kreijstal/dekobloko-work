import java.applet.Applet;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.MemoryImageSource;

public final class LogoApplet extends Applet implements Runnable {
    public static int done,frames,checksum,phase;
    public static long[] frameNanos=new long[LogoWorkload.FRAMES];
    public static long[] renderNanos=new long[LogoWorkload.FRAMES],composeNanos=new long[LogoWorkload.FRAMES],publishNanos=new long[LogoWorkload.FRAMES];
    public static int[][] validationPixels;
    LogoWorkload work; Graphics graphics; Image image; MemoryImageSource source;
    LogoDetailWorkload detail;
    LogoCallChain chain;
    int[] screen;
    boolean calls;
    public void init(){
        if("pixels".equals(getParameter("verify")))validationPixels=new int[LogoWorkload.FRAMES][];
        calls=!"fused".equals(getParameter("mode"));work=new LogoWorkload();
        work.dispatch="dispatch".equals(getParameter("mode"));
        work.mesh="mesh".equals(getParameter("mode"));
        work.extracted=work.dispatch||"extracted".equals(getParameter("mode"));
        String mode=getParameter("mode");
        if(mode.equals("chain")){chain=new LogoCallChain();screen=new int[640*480];}
        if(mode.startsWith("detail"))detail=new LogoDetailWorkload(Integer.parseInt(mode.substring(6)));
        if(mode.startsWith("state")){detail=new LogoDetailWorkload(Integer.parseInt(mode.substring(5)));detail.stateProjection=true;}
        if(mode.startsWith("flat")){detail=new LogoDetailWorkload(Integer.parseInt(mode.substring(4)));detail.useFlatNormals();}
        if(mode.equals("full4")){detail=new LogoDetailWorkload(4);detail.useFlatNormals();screen=new int[640*480];}
        if(mode.equals("thin4")){detail=new LogoDetailWorkload(4,true);detail.useFlatNormals();screen=new int[640*480];}
        setSize(LogoWorkload.WIDTH,LogoWorkload.HEIGHT);
        int width=screen==null?540:640,height=screen==null?140:480;
        setSize(width,height);
        source=new MemoryImageSource(width,height,screen!=null?screen:(detail==null?work.pixels:detail.pixels),0,width);
        image=createImage(source);graphics=getGraphics();
    }
    public void start(){new Thread(this,"procedural-logo").start();}
    public void run(){
        for(int f=0;f<LogoWorkload.FRAMES;f++){
            long t=System.nanoTime();if(chain!=null)chain.step(f);else if(detail==null)work.step(f,calls);else detail.step(f);
            long rendered=System.nanoTime();
            if(screen!=null)LogoCompositor.compose(chain!=null?chain.pixels:detail.pixels,screen,f);
            long composed=System.nanoTime();
            source.newPixels();graphics.drawImage(image,0,0,this);
            frameNanos[f]=System.nanoTime()-t;frames=f+1;
            renderNanos[f]=rendered-t;composeNanos[f]=composed-rendered;publishNanos[f]=frameNanos[f]-(composed-t);
            if(validationPixels!=null){
                int[] current=chain!=null?chain.pixels:detail==null?work.pixels:detail.pixels;
                validationPixels[f]=new int[current.length];
                System.arraycopy(current,0,validationPixels[f],0,current.length);
            }
            try{Thread.sleep(1);}catch(InterruptedException e){return;}
        }
        checksum=chain!=null?chain.checksum:detail==null?work.checksum:detail.checksum;done=1;
    }
}
