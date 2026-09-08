/** The game renders its 540x140 logo offscreen, then fades/blits it onto
 * the 640x480 applet surface. Keep that output work separate from geometry. */
final class LogoCompositor {
    static void compose(int[] logo,int[] screen,int frame){
        for(int i=0;i<screen.length;i++)screen[i]=0;
        int tick=frame*250/31,alpha=tick<75?tick*256/75:(tick>200?(250-tick)*256/50:256);
        for(int y=0;y<140;y++)for(int x=0;x<540;x++){
            int color=logo[y*540+x];
            screen[(y+170)*640+x+50]=(((color&0xff00ff)*alpha&0xff00ff00)|((color&0x00ff00)*alpha&0x00ff0000))>>>8;
        }
    }
}
