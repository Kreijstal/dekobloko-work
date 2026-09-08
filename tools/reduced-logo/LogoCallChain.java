/** Procedural call-chain reduction: 2304 triangles x 32 scan rows per frame.
 * No captured game input. Protected calls and Java integer/array semantics
 * deliberately remain observable; this is not a handwritten JS replacement. */
public final class LogoCallChain {
 public final int[] pixels=new int[540*140];
 public int checksum;
 public void step(int frame){
  for(int i=0;i<pixels.length;i++)pixels[i]=0;
  for(int triangle=0;triangle<2304;triangle++)
   triangle(pixels,(triangle*37+frame*3)%538,(triangle*7)%108,
     1,triangle&1,32,0x182436+(frame&15));
  for(int pixel:pixels)checksum=checksum*31+pixel;
 }
 static void triangle(int[] dst,int x,int y,int dx,int parity,int rows,int color){
  try{
   for(int row=0;row<rows;row++){
    int left=(x+row*dx)%538;
    submit(dst,left,y+row,((row+parity)&1)*2,color);
   }
  }catch(RuntimeException e){throw new IllegalStateException("triangle",e);}
 }
 static void submit(int[] dst,int x,int y,int length,int color){
  if(y<0||y>=140)return;
  if(x<0){length+=x;x=0;}
  if(x+length>540)length=540-x;
  span(dst,y*540+x,length,color);
 }
 static void span(int[] dst,int offset,int length,int color){
  try{
   while(length-->0){dst[offset]=color+Mask.apply(dst[offset]>>1,0x7f7f7f);offset++;}
  }catch(RuntimeException e){throw new IllegalStateException("span",e);}
 }
 public static void main(String[] args)throws Exception{
  LogoCallChain w=new LogoCallChain();
  java.io.DataOutputStream out=args.length==0?null:new java.io.DataOutputStream(new java.io.FileOutputStream(args[0]));
  for(int frame=0;frame<32;frame++){
   w.step(frame);if(out!=null)for(int pixel:w.pixels)out.writeInt(pixel);
  }
  if(out!=null)out.close();System.out.println("checksum="+w.checksum);
 }
}
final class Mask {static int apply(int value,int mask){return value&mask;}}
