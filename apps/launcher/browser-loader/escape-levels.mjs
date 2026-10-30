// Original levels and their deterministic version-11 Escape Vector encoder.
// No original encrypted member content is used or replaced.
export const switchbackSalvage = Object.freeze({
  id: 'switchback-salvage', title: 'Switchback Salvage',
  width: 768, height: 960, theme: 3,
  spawn: {x: 192, y: -96}, fuel: 6500, shield: 300, gravity: 512,
  // Follow the broad descending switchback, collect the cargo in the lowest
  // chamber, then tow it back. Chambers give room to brake and turn the load.
  route: [[192,-128],[192,192],[512,192],[512,480],[224,480],[224,784],[448,816]],
  corridorRadius: 82,
  landingShelf: {left:400,right:520,top:874},
  chambers: [[192,192,112],[512,192,108],[512,480,116],[224,480,112],[352,808,156]],
  objects: [{type: 1, x: 448, y: 860}],
  briefing: 'SWITCHBACK SALVAGE: Descend the winding cave. Recover the cargo and tow it above the surface.',
});

function segmentDistance(x, y, a, b) {
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}

export function makeLevelTerrain(level = switchbackSalvage) {
  const pixels=new Uint8Array(level.width*level.height);
  for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++) {
    let distance=Infinity;
    for(let i=1;i<level.route.length;i++)
      distance=Math.min(distance,segmentDistance(x,y,level.route[i-1],level.route[i])-level.corridorRadius);
    for(const [cx,cy,r] of level.chambers)distance=Math.min(distance,Math.hypot(x-cx,y-cy)-r);
    // Low-frequency rock contours, continuous across 32-pixel tile seams.
    // Tiny integer hash variation breaks up the curves without a random seed.
    let noise=Math.imul(x+73,374761393)^Math.imul(y+211,668265263);
    noise=Math.imul(noise^(noise>>>13),1274126177);
    const rough=4*Math.sin(x/19)+3*Math.sin(y/23)+2*Math.sin((x+y)/11)+((noise>>>28)-7)/4;
    const shelf=level.landingShelf;
    pixels[y*level.width+x]=y>=level.height-24||(shelf&&x>=shelf.left&&x<shelf.right&&y>=shelf.top)||distance+rough>0?1:0;
  }
  return pixels;
}

export function encodeEscapeLevel(level, pixels = makeLevelTerrain(level)) {
  if(!Number.isInteger(level.width)||!Number.isInteger(level.height)||level.width<32||level.height<32||
     level.width%32||level.height%32||level.width>8160||level.height>8160||pixels.length!==level.width*level.height)
    throw new Error('Terrain dimensions must be positive multiples of 32, at most 8160');
  const bytes=[];
  const byte=n=>bytes.push(n&255);
  const short=n=>{byte(n>>>8);byte(n);};
  const int=n=>{short(n>>>16);short(n);};
  function quadrant(left,top,size) {
    const first=pixels[top*level.width+left];
    for(let y=top;y<top+size;y++)for(let x=left;x<left+size;x++)
      if(pixels[y*level.width+x]!==first)return 2;
    return first?1:0;
  }
  function split(left,top,size) {
    const half=size/2, children=[[left,top],[left+half,top],[left,top+half],[left+half,top+half]];
    const codes=children.map(([x,y])=>quadrant(x,y,half));
    byte(codes.reduce((packed,code,i)=>packed|(code<<(2*i)),0));
    children.forEach(([x,y],i)=>{if(codes[i]===2)split(x,y,half);});
  }
  byte(11);byte(0); // Retrieval objective.
  byte(0);int(0); // No countdown.
  byte(level.width/32);byte(level.height/32);byte(level.theme);byte(level.theme);
  const tilesWide=level.width/32, tilesHigh=level.height/32;
  for(let i=0;i<tilesWide*tilesHigh;i+=4) {
    const group=[];
    for(let n=0;n<4&&i+n<tilesWide*tilesHigh;n++) {
      const tile=i+n,x=(tile%tilesWide)*32,y=Math.floor(tile/tilesWide)*32;
      group.push({x,y,code:quadrant(x,y,32)});
    }
    byte(group.reduce((packed,tile,n)=>packed|(tile.code<<(2*n)),0));
    for(const tile of group)if(tile.code===2)split(tile.x,tile.y,32);
  }
  if(level.objects.length>255)throw new Error('Too many level objects');
  byte(level.objects.length);
  for(const object of level.objects) {
    if(!Number.isInteger(object.type)||object.type<0||object.type>13||!Number.isInteger(object.x)||!Number.isInteger(object.y)||
       object.x<0||object.x>=level.width||object.y<0||object.y>=level.height)
      throw new Error('Invalid level object');
    byte(object.type);short(object.x);short(object.y);byte(object.target?1:0);byte(0);int(object.frame||0);
  }
  byte(0); // No seeker mines in this first navigation mission.
  int(level.spawn.x*65536);int(level.spawn.y*65536);int(level.fuel);int(level.shield);
  byte(0);short(level.gravity); // No initial pickups; normal gravity.
  return Uint8Array.from(bytes);
}

export function selectedEscapeLevel(search) {
  const id=new URLSearchParams(search).get('level');
  if(!id)return null;
  if(id!==switchbackSalvage.id)throw new Error('Unknown Escape Vector custom level: '+id);
  return switchbackSalvage;
}

// Install the authored stream in a normal session, using the ordinary game
// loader, terrain, collision, towing and completion paths. Normal campaigns
// are unaffected when the applet parameter is absent. Never submit custom
// mission progress, scores or achievements to the original campaign profile.
export function patchEscapeCustomLevel(source, sourcePath) {
  if(sourcePath==='games/escapevector/TrackerMusicDefinition.java') {
    const title='    final static String levelDisplayName(byte guard, int mode, int levelIndex) {';
    if(source.includes('GameplaySession.browserCustomMission()'))return source;
    if(source.split(title).length!==2)throw new Error('Custom mission title anchor changed');
    return source.replace(title,title+`\n        if (levelIndex >= 0 && GameplaySession.browserCustomMission()) return "${switchbackSalvage.title}";`);
  }
  if(sourcePath!=='games/escapevector/GameplaySession.java'||source.includes('deko-custom-escape-level'))return source;
  const constructor='    GameplaySession(byte[][] levelData, int option, int gameMode, int levelIndex) {';
  const start='    final void startSession(byte guard) {';
  if(source.split(constructor).length!==2||source.split(start).length!==2)
    throw new Error('Escape Vector custom-level session anchors changed');
  const data=encodeEscapeLevel(switchbackSalvage);
  const hex=Array.from(data,n=>n.toString(16).padStart(2,'0')).join('');
  const helper=`
    // deko-custom-escape-level: original authored content, selected by map ID.
    static boolean browserCustomMission() {
        java.applet.Applet applet = PointCloudEffect.activeApplet((byte)-111);
        return applet != null && "${switchbackSalvage.id}".equals(applet.getParameter("customlevel"));
    }
    private static byte[] browserCustomLevelBytes() {
        String hex = "${hex}";
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            int high = hex.charAt(i * 2);
            int low = hex.charAt(i * 2 + 1);
            high = high <= 57 ? high - 48 : high - 87;
            low = low <= 57 ? low - 48 : low - 87;
            bytes[i] = (byte)((high << 4) | low);
        }
        return bytes;
    }
`;
  source=source.replace(constructor,helper+constructor+`
        boolean customMission = browserCustomMission();
        if (customMission) {
            levelData = new byte[][] {browserCustomLevelBytes()};
            levelIndex = 0;
            gameMode = 0;
        }`);
  // Restrict this edit to the normal constructor, not the tutorial constructor.
  const offset=source.indexOf(constructor);
  const tail=source.slice(offset);
  if(!tail.includes('this.scoringEnabled = true;'))throw new Error('Custom mission scoring anchor changed');
  source=source.slice(0,offset)+tail.replace('this.scoringEnabled = true;','this.scoringEnabled = !customMission;');
  source=source.replace(start,start+`
        if (browserCustomMission()) {
            this.queueHudMessage(360, (byte)122, "${switchbackSalvage.briefing}");
            return;
        }`);
  for(const name of ['saveLevelProgress','updateCampaignBestScore','checkCampaignAchievements','awardAchievement','submitCampaignScore']) {
    const header=new RegExp('((?:private final|final) void '+name+'\\([^\\n]*\\) \\{)');
    if(!header.test(source))throw new Error('Custom mission profile guard anchor changed: '+name);
    source=source.replace(header,'$1\n        if (browserCustomMission()) return;');
  }
  return source;
}
