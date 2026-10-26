// Semantic oracle for the original terrain decoder and its source export.
// The stream describes one partial 32x32 tile: its upper-left quadrant is solid.
export const className = 'TileMaskProbe';
export const source = `import java.io.*;
import java.lang.reflect.*;
public class TileMaskProbe {
 public static void main(String[] args) throws Exception {
  Constructor<?> c=Class.forName("vc").getDeclaredConstructor(DataInputStream.class,int.class);c.setAccessible(true);
  Object map=c.newInstance(new DataInputStream(new ByteArrayInputStream(new byte[]{1,1,1,2,1})),9);
  Field f=null;
  for(Field candidate:map.getClass().getDeclaredFields()) if(candidate.getType()==int[][].class) {
   if(f!=null)throw new AssertionError("Ambiguous terrain masks");f=candidate;
  }
  if(f==null)throw new AssertionError("Missing terrain masks");
  f.setAccessible(true);int[] tile=((int[][])f.get(map))[0];
  int bits=0,rows=0,hash=1;
  for(int value:tile){bits+=Integer.bitCount(value);if(value!=0)rows++;hash=31*hash+value;}
  System.out.println("rows="+rows+" bits="+bits+" hash="+hash);
 }
}
`;
export const expected = 'rows=16 bits=256 hash=-2084791551';
