/** Host-only counter driver, compiled with a diagnostic instrumented raster.
 * Never included in the browser performance jar. */
public final class LogoCostCensus {
    public static long triangles,rows,spans,pixels;
    public static void main(String[] args){
        LogoDetailWorkload w=new LogoDetailWorkload(4,args[0].equals("thin"));w.useFlatNormals();
        for(int f=0;f<32;f++)w.step(f);
        System.out.println("layout="+args[0]+" triangles="+triangles+" triangleRows="+rows+" spans="+spans+" writtenPixels="+pixels+" checksum="+w.checksum);
    }
}
