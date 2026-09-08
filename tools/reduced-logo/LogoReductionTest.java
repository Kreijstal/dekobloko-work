/** Exact per-pixel A/B oracle: direct versus protected state-machine projection. */
public final class LogoReductionTest {
    public static void main(String[] args){
        int[] checks={-1370228226,-757457398,143333580,2045229082};
        long compared=0;
        for(int d=1;d<=4;d++){
            LogoDetailWorkload a=new LogoDetailWorkload(d),b=new LogoDetailWorkload(d);
            LogoDetailWorkload c=new LogoDetailWorkload(d);c.useFlatNormals();
            b.stateProjection=true;
            for(int f=0;f<32;f++){
                a.step(f);b.step(f);c.step(f);
                if(a.minDepth!=b.minDepth||a.maxDepth!=b.maxDepth)throw new AssertionError("depth bounds");
                for(int i=0;i<a.pixels.length;i++){if(a.pixels[i]!=b.pixels[i]||a.pixels[i]!=c.pixels[i])throw new AssertionError("pixel "+d+":"+f+":"+i);compared++;}
            }
            if(a.checksum!=checks[d-1]||b.checksum!=checks[d-1])throw new AssertionError("checksum "+d);
        }
        System.out.println("exact=true comparedPixels="+compared+" densityLevels=4 framesPerLevel=32");
    }
}
