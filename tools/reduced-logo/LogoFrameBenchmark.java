/** HotSpot comparison includes the same raster, fade and full-surface copy,
 * but excludes AWT/device publication. Every process retains cold frame zero. */
public final class LogoFrameBenchmark {
    public static void main(String[] args){
        LogoDetailWorkload w=new LogoDetailWorkload(4,args[0].equals("thin"));w.useFlatNormals();
        int[] screen=new int[640*480];long total=0,first=0,max=0;int outputChecksum=0;
        for(int f=0;f<32;f++){
            long t=System.nanoTime();w.step(f);LogoCompositor.compose(w.pixels,screen,f);long ns=System.nanoTime()-t;
            total+=ns;if(f==0)first=ns;if(ns>max)max=ns;
            for(int p:screen)outputChecksum=outputChecksum*31+p;
        }
        System.out.println("layout="+args[0]+" frames=32 totalMs="+total/1000000+" firstMs="+first/1000000+" maxMs="+max/1000000+" rasterChecksum="+w.checksum+" surfaceChecksum="+outputChecksum);
    }
}
