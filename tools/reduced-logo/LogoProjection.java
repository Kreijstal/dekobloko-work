/** Projection state-machine shape follows geoblox p.a: loop test, transform,
 * clipping, projection, depth bounds, optional storage and advance are separate
 * protected cases. Arithmetic/output match the direct-loop control exactly. */
final class LogoProjection {
    static void direct(LogoDetailWorkload w,int box,int sine,int cosine){
        int min=2147483647,max=-2147483648;
        for(int v=0;v<w.vertices;v++){
            int rx=(w.px[v]*cosine+w.pz[v]*sine)>>16;
            int rz=((w.pz[v]*cosine-w.px[v]*sine)>>16)+220;
            if(rz>=50){
                w.sx[v]=18+box*46+rx*220/rz;
                w.sy[v]=70+w.py[v]*220/rz+((box&1)==0?-5:5);
                if(rz<min)min=rz;if(rz>max)max=rz;
            }
        }
        w.minDepth=min;w.maxDepth=max;
    }
    static void stateMachine(LogoDetailWorkload w,int box,int sine,int cosine){
        int pc=0,v=0,rx=0,rz=0,min=2147483647,max=-2147483648;
        Throwable caught=null;
        stateLoop:while(true){
            switch(pc){
                case 0:{pc=5;continue stateLoop;}
                case 5:{try{pc=v>=w.vertices?26:6;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 6:{try{
                    rx=(w.px[v]*cosine+w.pz[v]*sine)>>16;
                    rz=((w.pz[v]*cosine-w.px[v]*sine)>>16)+220;
                    pc=7;continue stateLoop;
                }catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 7:{try{pc=rz<50?19:8;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 8:{try{pc=10;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 10:{try{
                    w.sx[v]=18+box*46+rx*220/rz;
                    w.sy[v]=70+w.py[v]*220/rz+((box&1)==0?-5:5);
                    pc=rz>=min?14:11;continue stateLoop;
                }catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 11:{try{pc=13;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 13:{try{min=rz;pc=14;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 14:{try{pc=max<rz?17:15;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 15:{try{pc=18;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 17:{try{max=rz;pc=18;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 18:{try{pc=21;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 19:{try{pc=21;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 21:{try{pc=22;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 22:{try{pc=25;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 25:{try{v++;pc=5;continue stateLoop;}
                    catch(Throwable e){caught=e;pc=68;continue stateLoop;}}
                case 26:{w.minDepth=min;w.maxDepth=max;return;}
                case 68:{throw new IllegalStateException("projection("+box+","+v+","+rx+","+rz+")",caught);}
                default:throw new IllegalStateException("projection state");
            }
        }
    }
}
