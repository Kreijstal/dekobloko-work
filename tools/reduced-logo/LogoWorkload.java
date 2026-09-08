/** Procedural logo-shaped driver, with optional source-isolated raster kernels.
 * Models the observed mesh -> clipped triangle -> interpolated span call chain.
 * The A/B arms differ only in whether a span uses a separate wide static call.
 */
public final class LogoWorkload {
    public static final int WIDTH=540, HEIGHT=140, FRAMES=32;
    public final int[] pixels=new int[WIDTH*HEIGHT];
    final int[] x=new int[8], y=new int[8], z=new int[8];
    final int[] faces={0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,
        2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3};
    public int checksum, triangles, spans;
    public boolean extracted,dispatch,mesh;
    final LogoMesh shape;
    public LogoWorkload(){shape=new LogoMesh(faces);}

    static void span(int[] dst,int offset,int left,int right,int r,int g,int b,
                     int dr,int dg,int db,int alpha) {
      try {
        for(int p=offset+left,end=offset+right;p<end;p++) {
            int color=((r>>16)&255)<<16|((g>>16)&255)<<8|((b>>16)&255);
            int old=dst[p];
            dst[p]=((((color&0xff00ff)*alpha+(old&0xff00ff)*(256-alpha))&0xff00ff00)
                |(((color&0x00ff00)*alpha+(old&0x00ff00)*(256-alpha))&0x00ff0000))>>>8;
            r+=dr;g+=dg;b+=db;
        }
      } catch(RuntimeException e) {
        throw new IllegalStateException("span("+offset+","+left+","+right+","+r+","+g+","+b+","+dr+","+dg+","+db+","+alpha+")",e);
      }
    }

    void triangle(int x0,int y0,int x1,int y1,int x2,int y2,
                  int r0,int g0,int b0,int r1,int g1,int b1,int r2,int g2,int b2,
                  int alpha,boolean calls) {
      try {
        // Vertex sorting moves all interpolants, including both flat-edge cases.
        if(y1<y0){int t=x0;x0=x1;x1=t;t=y0;y0=y1;y1=t;
            t=r0;r0=r1;r1=t;t=g0;g0=g1;g1=t;t=b0;b0=b1;b1=t;}
        if(y2<y0){int t=x0;x0=x2;x2=t;t=y0;y0=y2;y2=t;
            t=r0;r0=r2;r2=t;t=g0;g0=g2;g2=t;t=b0;b0=b2;b2=t;}
        if(y2<y1){int t=x1;x1=x2;x2=t;t=y1;y1=y2;y2=t;
            t=r1;r1=r2;r2=t;t=g1;g1=g2;g2=t;t=b1;b1=b2;b2=t;}
        if(y0==y2||y2<=0||y0>=HEIGHT)return;
        triangles++;
        if(extracted){
            if(dispatch){LogoRasterState.pixels=pixels;
                LogoDispatch.draw(b0,g0,r2,g2,y1,b1,r0,y0,x2,b2,-2,r1,g1,x1,x0,y2);
            }else LogoTriangle.draw(g2,r0,x0,g1,y2,b2,r2,b1,y0,x1,r1,pixels,g0,x2,b0,y1,-1275583984);
            return;
        }
        int dy=y2-y0,dx=((x2-x0)<<16)/dy;
        int lr=((r2-r0)<<16)/dy,lg=((g2-g0)<<16)/dy,lb=((b2-b0)<<16)/dy;
        for(int row=Math.max(0,y0);row<Math.min(HEIGHT,y2);row++) {
            boolean lower=row>=y1;
            int sy=lower?y1:y0,ey=lower?y2:y1;
            if(sy==ey)continue;
            int sx=lower?x1:x0,ex=lower?x2:x1,delta=row-sy;
            int sr=lower?r1:r0,sg=lower?g1:g0,sb=lower?b1:b0;
            int er=lower?r2:r1,eg=lower?g2:g1,eb=lower?b2:b1;
            int a=((x0<<16)+dx*(row-y0))>>16;
            int b=((sx<<16)+(((ex-sx)<<16)/(ey-sy))*delta)>>16;
            int ra=(r0<<16)+lr*(row-y0),ga=(g0<<16)+lg*(row-y0),ba=(b0<<16)+lb*(row-y0);
            int rb=(sr<<16)+(((er-sr)<<16)/(ey-sy))*delta;
            int gb=(sg<<16)+(((eg-sg)<<16)/(ey-sy))*delta;
            int bb=(sb<<16)+(((eb-sb)<<16)/(ey-sy))*delta;
            if(a>b){int t=a;a=b;b=t;t=ra;ra=rb;rb=t;t=ga;ga=gb;gb=t;t=ba;ba=bb;bb=t;}
            if(a==b||b<=0||a>=WIDTH)continue;
            int dr=(rb-ra)/(b-a),dg=(gb-ga)/(b-a),db=(bb-ba)/(b-a);
            if(a<0){ra-=a*dr;ga-=a*dg;ba-=a*db;a=0;}
            if(b>WIDTH)b=WIDTH;
            spans++;
            if(calls)span(pixels,row*WIDTH,a,b,ra,ga,ba,dr,dg,db,alpha);
            else {
                for(int p=row*WIDTH+a,end=row*WIDTH+b;p<end;p++) {
                    int color=((ra>>16)&255)<<16|((ga>>16)&255)<<8|((ba>>16)&255);
                    int old=pixels[p];
                    pixels[p]=((((color&0xff00ff)*alpha+(old&0xff00ff)*(256-alpha))&0xff00ff00)
                        |(((color&0x00ff00)*alpha+(old&0x00ff00)*(256-alpha))&0x00ff0000))>>>8;
                    ra+=dr;ga+=dg;ba+=db;
                }
            }
        }
      } catch(RuntimeException e) {
        throw new IllegalStateException("triangle("+x0+","+y0+","+x1+","+y1+","+x2+","+y2+","+r0+","+g0+","+b0+","+r1+","+g1+","+b1+","+r2+","+g2+","+b2+")",e);
      }
    }
    public void step(int frame,boolean calls) {
        for(int i=0;i<pixels.length;i++)pixels[i]=0;
        triangles=0;spans=0;
        int angle=(frame*71)&2047;
        int sine=(int)(Math.sin(angle*Math.PI/1024)*65536);
        int cosine=(int)(Math.cos(angle*Math.PI/1024)*65536);
        // Twelve independent boxes: generated geometry, no extracted coordinates.
        for(int box=0;box<12;box++) {
            for(int v=0;v<8;v++) {
                int vx=(v&1)==0?-17:17,vy=(v&2)==0?-42:42,vz=(v&4)==0?-10:10;
                int rx=(vx*cosine+vz*sine)>>16,rz=(vz*cosine-vx*sine)>>16;
                z[v]=rz+220;
                x[v]=18+box*46+rx*220/z[v];
                y[v]=HEIGHT/2+vy*220/z[v]+((box&1)==0?-5:5);
            }
            if(mesh){
                LogoRasterState.pixels=pixels;LogoMeshRenderer.screenX=x;LogoMeshRenderer.screenY=y;
                LogoMeshRenderer.draw(100,120,80,6562,90,shape,100,110);
            } else for(int t=0;t<faces.length;t+=3){int a=faces[t],b=faces[t+1],c=faces[t+2];
                triangle(x[a],y[a],x[b],y[b],x[c],y[c],
                    80+a*20,110+a*13,150+a*11,80+b*20,110+b*13,150+b*11,
                    80+c*20,110+c*13,150+c*11,192,calls);
            }
        }
        for(int value:pixels)checksum=checksum*31+value;
    }

    public static void main(String[] args){
        if(args.length>0&&(args[0].equals("extracted")||args[0].equals("dispatch")||args[0].equals("mesh"))){
            LogoWorkload w=new LogoWorkload();w.extracted=true;w.dispatch=args[0].equals("dispatch");w.mesh=args[0].equals("mesh");long elapsed=0;
            for(int f=0;f<FRAMES;f++){long t=System.nanoTime();w.step(f,true);elapsed+=System.nanoTime()-t;}
            System.out.println("mode=extracted frames="+FRAMES+" checksum="+w.checksum+" totalMs="+elapsed/1000000);return;
        }
        LogoWorkload a=new LogoWorkload(),b=new LogoWorkload();
        long split=0,fused=0;
        for(int f=0;f<FRAMES;f++){
            long t=System.nanoTime();a.step(f,true);split+=System.nanoTime()-t;
            t=System.nanoTime();b.step(f,false);fused+=System.nanoTime()-t;
            if(a.checksum!=b.checksum||a.spans!=b.spans||a.triangles!=b.triangles)throw new AssertionError("state "+f);
            for(int i=0;i<a.pixels.length;i++)if(a.pixels[i]!=b.pixels[i])throw new AssertionError("pixel "+f+":"+i);
        }
        System.out.println("exact=true frames="+FRAMES+" checksum="+a.checksum+" splitMs="+split/1000000+" fusedMs="+fused/1000000);
    }
}
