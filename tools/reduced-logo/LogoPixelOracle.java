import java.io.DataOutputStream;
import java.io.BufferedOutputStream;
import java.io.FileOutputStream;

/** Host-only oracle writer. Output is expected pixels, never replay input. */
public final class LogoPixelOracle {
    public static void main(String[] args) throws Exception {
        String variant=args.length>2?args[2]:"direct";
        LogoDetailWorkload w=new LogoDetailWorkload(Integer.parseInt(args[0]),variant.equals("thin"));
        w.stateProjection=variant.equals("state");
        if(variant.equals("flat")||variant.equals("thin"))w.useFlatNormals();
        DataOutputStream out=new DataOutputStream(new BufferedOutputStream(new FileOutputStream(args[1])));
        for(int f=0;f<32;f++){w.step(f);for(int value:w.pixels)out.writeInt(value);}
        out.close();System.out.println("oraclePixels="+(32*540*140)+" checksum="+w.checksum);
    }
}
