/** Same twelve boxes and screen coverage; subdivision changes geometry density,
 * not the number of copies or an artificial delay. Mesh input is all procedural. */
public final class LogoDetailWorkload {
    final int[] px,py,pz,sx,sy,nx,ny,nz;
    final LogoMesh mesh;
    public final int[] pixels=new int[540*140];
    public int checksum;
    public int minDepth,maxDepth;
    public boolean stateProjection;
    public final int divisions,vertices,triangles;
    public LogoDetailWorkload(int d){this(d,false);}
    public LogoDetailWorkload(int d,boolean thin){
        if(d<1||d>8)throw new IllegalArgumentException("divisions");
        int columns=thin?d*d:d,rows=thin?1:d;
        divisions=d;vertices=6*(columns+1)*(rows+1);triangles=12*columns*rows;
        px=new int[vertices];py=new int[vertices];pz=new int[vertices];
        sx=new int[vertices];sy=new int[vertices];nx=new int[vertices];ny=new int[vertices];nz=new int[vertices];
        mesh=new LogoMesh(vertices,triangles);
        int[] limits={17,42,10};
        int vertex=0,triangle=0,axis=0,side=0,base=0,u=0,v=0,row=0,col=0,a=0,b=0,c=0,e=0;
        for(axis=0;axis<3;axis++)for(side=-1;side<=1;side+=2){
            base=vertex;u=(axis+1)%3;v=(axis+2)%3;
            for(row=0;row<=rows;row++)for(col=0;col<=columns;col++){
                a=side*limits[axis];b=-limits[u]+2*limits[u]*col/columns;c=-limits[v]+2*limits[v]*row/rows;
                if(axis==0){px[vertex]=a;py[vertex]=b;pz[vertex]=c;nx[vertex]=side*100;}
                else if(axis==1){py[vertex]=a;pz[vertex]=b;px[vertex]=c;ny[vertex]=side*100;}
                else{pz[vertex]=a;px[vertex]=b;py[vertex]=c;nz[vertex]=side*100;}
                vertex++;
            }
            for(row=0;row<rows;row++)for(col=0;col<columns;col++){
                a=base+row*(columns+1)+col;b=a+1;c=a+columns+1;e=c+1;
                face(triangle++,a,b,e);face(triangle++,a,e,c);
            }
        }
    }
    void face(int i,int a,int b,int c){
        mesh.faceA[i]=(short)a;mesh.normalA[i]=(short)a;
        mesh.faceB[i]=(short)b;mesh.normalB[i]=(short)b;
        mesh.faceC[i]=(short)c;mesh.normalC[i]=(short)c;
    }
    public void useFlatNormals(){
        // All vertices on each procedural box face already have equal normals.
        // Share their index, selecting the real renderer's flat-shading branch.
        for(int i=0;i<triangles;i++){mesh.normalB[i]=mesh.normalA[i];mesh.normalC[i]=mesh.normalA[i];}
    }
    public void step(int frame){
        for(int i=0;i<pixels.length;i++)pixels[i]=0;
        LogoRasterState.pixels=pixels;
        LogoMeshRenderer.normalX=nx;LogoMeshRenderer.normalY=ny;LogoMeshRenderer.normalZ=nz;
        LogoMeshRenderer.screenX=sx;LogoMeshRenderer.screenY=sy;
        if(LogoMeshRenderer.order.length!=triangles){
            LogoMeshRenderer.order=new int[triangles];
            for(int i=0;i<triangles;i++)LogoMeshRenderer.order[i]=i;
        }
        LogoMeshRenderer.faceCount=triangles;
        int angle=(frame*71)&2047,sine=(int)(Math.sin(angle*Math.PI/1024)*65536),cosine=(int)(Math.cos(angle*Math.PI/1024)*65536);
        for(int box=0;box<12;box++){
            if(stateProjection)LogoProjection.stateMachine(this,box,sine,cosine);
            else LogoProjection.direct(this,box,sine,cosine);
            LogoMeshRenderer.draw(100,120,80,6562,90,mesh,100,110);
        }
        for(int value:pixels)checksum=checksum*31+value;
    }
    public static void main(String[] args){
        int d=Integer.parseInt(args[0]);boolean thin=args.length>1&&args[1].equals("thin");LogoDetailWorkload w=new LogoDetailWorkload(d,thin);w.stateProjection=args.length>1&&!thin;long elapsed=0;
        if(thin||args.length>1&&args[1].equals("flat"))w.useFlatNormals();
        for(int f=0;f<32;f++){long t=System.nanoTime();w.step(f);elapsed+=System.nanoTime()-t;}
        System.out.println("divisions="+d+" trianglesPerFrame="+12*w.triangles+" checksum="+w.checksum+" totalMs="+elapsed/1000000);
    }
}
