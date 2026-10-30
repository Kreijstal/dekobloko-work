import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {switchbackSalvage as level,makeLevelTerrain,encodeEscapeLevel,selectedEscapeLevel,patchEscapeCustomLevel} from '../apps/launcher/browser-loader/escape-levels.mjs';
import {buildCompilationStubs} from '../readable/compilation-stubs.mjs';
import {configureApplet} from '../apps/launcher/browser-loader/applet-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const terrain=makeLevelTerrain(level), encoded=encodeEscapeLevel(level,terrain);

test('custom level selection is an ordinary Escape-only applet parameter',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'location');
  try {
    Object.defineProperty(globalThis,'location',{configurable:true,value:{search:'?level=switchback-salvage'}});
    const controller={options:{}};
    configureApplet(controller,{internalName:'escapevector',gamecrc:0});
    assert.equal(controller.options.appletParameters.customlevel,level.id);
    configureApplet(controller,{internalName:'geoblox',gamecrc:0});
    assert.equal(controller.options.appletParameters.customlevel,undefined);
    globalThis.location.search='';
    configureApplet(controller,{internalName:'escapevector',gamecrc:0});
    assert.equal(controller.options.appletParameters.customlevel,undefined);
  }finally{if(previous)Object.defineProperty(globalThis,'location',previous);else delete globalThis.location;}
});

test('authored cave has rough partial tiles and a towing-width route to cargo',()=>{
  assert.deepEqual(encodeEscapeLevel(level,terrain),encoded);
  assert.equal(selectedEscapeLevel(''),null);
  assert.equal(selectedEscapeLevel('?level=switchback-salvage'),level);
  assert.throws(()=>selectedEscapeLevel('?level=missing'),/Unknown/);
  assert.throws(()=>encodeEscapeLevel({...level,width:33},terrain),/dimensions/);
  for(let y=0;y<level.height;y++)assert.equal(terrain[y*level.width],1);
  for(let x=0;x<level.width;x++)assert.equal(terrain[(level.height-1)*level.width+x],1);
  const step=8, cols=level.width/step, rows=level.height/step;
  const clear=(cx,cy)=>{
    for(let a=0;a<24;a++) {
      const x=Math.round(cx+36*Math.cos(a*Math.PI/12)),y=Math.round(cy+36*Math.sin(a*Math.PI/12));
      if(x<0||x>=level.width||y>=level.height||(y>=0&&terrain[y*level.width+x]))return false;
    }
    return !terrain[Math.min(level.height-1,cy)*level.width+cx];
  };
  const queue=[[level.spawn.x/step,0]], seen=new Set([queue[0].join(',')]);
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=queue[i][0]+dx,y=queue[i][1]+dy,key=x+','+y;
    if(x<0||x>=cols||y<0||y>=rows||seen.has(key)||!clear(x*step,y*step))continue;
    seen.add(key);queue.push([x,y]);
  }
  const cargo=level.objects.find(o=>o.type===1);
  assert.ok(seen.has(Math.round((cargo.x-16)/step)+','+Math.round((cargo.y-36)/step)),
    'cargo landing approach must have a route with 36-pixel clearance');
  for(let x=400;x<520;x++)assert.equal(terrain[874*level.width+x],1,'flat landing shelf');
  let partial=0;
  for(let y=0;y<level.height;y+=32)for(let x=0;x<level.width;x+=32){
    let count=0;for(let r=0;r<32;r++)for(let c=0;c<32;c++)count+=terrain[(y+r)*level.width+x+c];
    if(count&&count<1024)partial++;
  }
  assert.ok(partial>100,'cave contours must cross tile boundaries');
});

test('complete authored stream decodes pixel-exactly in original and patched readable clients',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'escape-custom-level-'));
  const repository=path.resolve(root,'../funorb-decompiled');
  const original=path.join(root,'.work/gamepacks/escapevector.jar');
  assert.ok(fs.existsSync(original),'original gamepack is required for the native oracle');
  const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  try {
    const source=path.join(temporary,'source'),classes=path.join(temporary,'classes');fs.mkdirSync(source);fs.mkdirSync(classes);
    for(const file of fs.readdirSync(path.join(repository,'games/escapevector')).filter(f=>f.endsWith('.java'))) {
      const text=fs.readFileSync(path.join(repository,'games/escapevector',file),'utf8');
      const patched=patchEscapeCustomLevel(text,'games/escapevector/'+file);
      assert.equal(patchEscapeCustomLevel(patched,'games/escapevector/'+file),patched);
      fs.writeFileSync(path.join(source,file),patched);
    }
    fs.writeFileSync(path.join(temporary,'level.bin'),encoded);fs.writeFileSync(path.join(temporary,'terrain.bin'),terrain);
    const probe=`import java.io.*;import java.lang.reflect.*;import java.nio.file.*;import java.util.*;
public class CustomLevelProbe {
 static Object make(Class<?> c)throws Exception{Class<?> u=Class.forName("sun.misc.Unsafe");Field f=u.getDeclaredField("theUnsafe");f.setAccessible(true);return u.getMethod("allocateInstance",Class.class).invoke(f.get(null),c);}
 static Object field(Object o,String name)throws Exception{Field f;try{f=o.getClass().getDeclaredField(name);}catch(NoSuchFieldException e){f=o.getClass().getDeclaredField(name.substring(6));}f.setAccessible(true);return f.get(o);}
 public static void main(String[] args)throws Exception {
  boolean named=Boolean.parseBoolean(args[2]);Class<?> type=Class.forName(named?"GameplaySession":"oe");Object world=make(type);
  Field objects=type.getDeclaredField(named?"levelObjects":"kb");objects.setAccessible(true);objects.set(world,new Vector());
  ByteArrayInputStream raw=new ByteArrayInputStream(Files.readAllBytes(Paths.get(args[0])));
  Method decode=type.getDeclaredMethod(named?"decodeLevelStream":"a",boolean.class,int.class,InputStream.class);decode.setAccessible(true);decode.invoke(world,false,-1,raw);
  if(raw.available()!=0)throw new AssertionError("trailing level bytes");
  int width=(Integer)field(world,named?"worldWidth":"field_n"),height=(Integer)field(world,named?"worldHeight":"field_Fb");
  if(width!=768||height!=960)throw new AssertionError("level dimensions");
  int[][] masks=(int[][])field(world,named?"terrainMasks":"field_V");byte[] expected=Files.readAllBytes(Paths.get(args[1]));
  for(int y=0;y<height;y++)for(int x=0;x<width;x++){int[] tile=masks[(y/32)*(width/32)+x/32];boolean solid=tile!=null&&(tile.length==0||((tile[y%32]>>>(x%32))&1)!=0);if(solid!=(expected[y*width+x]!=0))throw new AssertionError("pixel "+x+","+y);}
  Vector list=(Vector)field(world,named?"levelObjects":"field_kb");if(list.size()!=1)throw new AssertionError("object count");
  Object cargo=list.elementAt(0);if((Integer)field(cargo,named?"objectType":"field_n")!=1||(Integer)field(cargo,named?"x":"field_k")!=448||(Integer)field(cargo,named?"y":"field_g")!=860)throw new AssertionError("cargo");
  if((Integer)field(world,named?"spawnXQ16":"field_t")!=(192<<16)||(Integer)field(world,named?"spawnYQ16":"field_bb")!=(-96<<16))throw new AssertionError("spawn");
  if((Integer)field(world,named?"initialFuel":"field_U")!=6500||(Integer)field(world,named?"initialShieldEnergy":"field_gc")!=300)throw new AssertionError("resources");
  if(named){
   Method bytes=type.getDeclaredMethod("browserCustomLevelBytes");bytes.setAccessible(true);if(!Arrays.equals((byte[])bytes.invoke(null),Files.readAllBytes(Paths.get(args[0]))))throw new AssertionError("embedded map bytes");
   Method selected=type.getDeclaredMethod("browserCustomMission");selected.setAccessible(true);if((Boolean)selected.invoke(null))throw new AssertionError("custom mission enabled by default");
   Field applet=Class.forName("ModalPanel").getDeclaredField("field_P");applet.setAccessible(true);Object previous=applet.get(null);applet.set(null,make(Class.forName("MissionApplet")));
   try {
    if(!(Boolean)selected.invoke(null))throw new AssertionError("custom mission selection");
    for(String name:new String[]{"saveLevelProgress","updateCampaignBestScore","checkCampaignAchievements","awardAchievement","submitCampaignScore"}) {
     for(Method method:type.getDeclaredMethods())if(method.getName().equals(name)){method.setAccessible(true);Object[] values=new Object[method.getParameterTypes().length];for(int i=0;i<values.length;i++){Class<?> t=method.getParameterTypes()[i];if(t==boolean.class)values[i]=false;else if(t==byte.class)values[i]=(byte)0;else values[i]=0;}method.invoke(world,values);}
    }
   }finally{applet.set(null,previous);}
  }
  System.out.println("pixels=737280 objects=1 stream=complete");
 }
}
class MissionApplet extends java.applet.Applet {public String getParameter(String name){return "customlevel".equals(name)?"switchback-salvage":null;}}
`;
    // Resolve the actual named height/resource spellings from the binding
    // dictionary; the original symbols remain fixed for the bytecode oracle.
    const dictionary=JSON.parse(fs.readFileSync(path.join(repository,'decompilation/escapevector-naming.json')));
    let java=probe;
    for(const [originalName,placeholder]of[['Fb','worldHeight'],['gc','initialShieldEnergy']]) {
      const row=dictionary.symbols.find(r=>r.symbol===`F:oe.field_${originalName}:I`);
      assert.ok(row);java=java.replaceAll('"'+placeholder+'"','"'+row.renamedName+'"');
    }
    fs.writeFileSync(path.join(source,'CustomLevelProbe.java'),java);
    const stubs=buildCompilationStubs(repository,temporary);
    const files=fs.readdirSync(source).filter(f=>f.endsWith('.java')).map(f=>JSON.stringify(path.join(source,f)));
    fs.writeFileSync(path.join(temporary,'sources.args'),files.join('\n'));
    run('javac',['--release','8','-encoding','UTF-8','-cp',stubs.jar,'-d',classes,'@'+path.join(temporary,'sources.args')]);
    const args=[path.join(temporary,'level.bin'),path.join(temporary,'terrain.bin')];
    const expected='pixels=737280 objects=1 stream=complete';
    assert.equal(run('java',['-Xverify:all','-Djava.awt.headless=true','-cp',classes+path.delimiter+stubs.jar,'CustomLevelProbe',...args,'true']).trim(),expected);
    assert.equal(run('java',['-Xverify:all','-Djava.awt.headless=true','-cp',original+path.delimiter+classes+path.delimiter+stubs.jar,'CustomLevelProbe',...args,'false']).trim(),expected);
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
