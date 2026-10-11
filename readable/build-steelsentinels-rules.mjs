import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {archivedInput, digest, funorbRepository, verifyToolPin, workflowRoot} from './game-export.mjs';

const SOURCE_COMMIT = '1655ca853d0d4027018f3efcdc37be76ab7895f4';
// Evidence below refers to this immutable Java input, not to another game's map.
const classes = {
  ee:['CombatWorld','Owns terrain, sentinel/projectile/effect collections, simulation ticks and synchronization checksum.'],
  mb:['Sentinel','Player/team IDs, fixed-point position, velocity, chassis, modules, armour, charge and combat controls.'],
  nb:['GameplayController','Owns CombatWorld, player selection, trajectories, input and game rendering.'],
  ji:['SentinelDesigner','Engineering and construction UI, option tables and part configuration editing.'],
  hd:['BattleTerrain','Seed-derived terrain profiles, clamped profile accessors and spawn positions.'],
  wl:['Projectile','Position, velocities, source sentinel, affected sentinels and projectile collision/update paths.'],
  jb:['Explosion','Created by projectile/ability paths with radius, force and affected sentinel state.'],
  qb:['ParticleEffect','Short-lived visual effects with world position, velocity and age.'],
  je:['SentinelCommand','Action type, subtype, start/end ticks and activation state consumed by Sentinel control paths.'],
  nk:['ArticulatedPart','Sprite-backed component with attached part instructions, rotation, component ID and recursive property aggregation.'],
  qd:['PartInstruction','Part attachment, instruction metadata, optional part name and recursive copy.'],
  ck:['IntrusiveNode','Two neighbour links, collection key and unlink.'],
  kd:['DualNode','Second pair of intrusive links and unlink, in addition to IntrusiveNode.'],
  ul:['NodeDeque','Sentinel, prepend/append, traversal and size.'],
  ra:['DualNodeDeque','Sentinel and traversal over the second intrusive links.'],
  jc:['NodeIterator','Independent traversal cursor over NodeDeque.'],
  gi:['PacketBuffer','Byte payload, position and primitive reads/writes.'],
  kj:['CipherPacketBuffer','Ciphered opcodes and bit-position reads on PacketBuffer.'],
  ie:['IsaacRandom','256-word ISAAC generator; used for opcode encryption and seeded world generation.'],
  ea:['Sprite','Sprite dimensions/offsets and abstract drawing operation.'],
  wk:['RgbSprite','Integer pixel array and clipped blits to SoftwareRaster.'],
  gk:['IndexedSprite','Palette, byte pixel indices and conversion to RgbSprite.'],
  pb:['SoftwareRaster','Global pixel target, dimensions, clip bounds and drawing operations.'],
  mi:['BitmapFont','Glyph metrics, markup-aware text widths and rendering.'],
  lg:['GameApplet','Applet lifecycle, game loop and AWT listeners.'],
  n:['FunOrbClient','Common client lifecycle and connection/UI coordination beneath SteelSentinels.'],
  gh:['SceneWidget','Widget dimensions, position, parent/child links and UI dispatch.'],
};
const members={};
function field(owner,original,descriptor,to,evidence) {
  members[`F:${owner}.field_${original}:${descriptor}`]={to,evidence};
}
function method(owner,original,descriptor,to,evidence,parameters) {
  const key=`${owner}.${original}${descriptor}`;
  members['M:'+key]={to,evidence};
  for(const [ordinal,name] of Object.entries(parameters||{}))members[`P:${key}#${ordinal}`]={to:name,evidence};
}
for(const [original,to,type] of [
  ['xc','world','Lee;'],['hc','worldX','I'],['Gb','worldY','I'],
  ['K','velocityX','I'],['ab','velocityY','I'],['Bb','playerId','I'],['jc','teamId','I'],
  ['Zb','chassis','Lnk;'],['gb','weaponParts','[Lnk;'],['Z','animatedParts','[Lnk;'],
  ['nb','moduleTypes','[I'],['s','moduleCount','I'],['rc','activeModuleType','I'],
  ['Eb','maximumArmour','I'],['rb','armour','I'],['Tb','charge','I'],['x','maximumCharge','I'],
  ['B','pendingCommands','Lul;'],['Ec','secondaryCommands','Lul;'],
]) field('mb',original,type,to,'Sentinel constructor, configure-design path, physics, module checks, armour/charge changes and world checksum.');
for(const [original,to,type] of [
  ['ab','terrain','Lhd;'],['K','sentinels','Lul;'],['r','simulationTick','I'],
  ['D','random','Lie;'],['bb','playerNames','[Ljava/lang/String;'],['kb','playerCount','I'],
  ['Q','computerPlayerCount','I'],['Y','mapSeed','I'],['y','spawnedSpecialSentinel','Lmb;'],
  ['T','projectiles','Lul;'],['u','explosions','Lul;'],
]) field('ee',original,type,to,'CombatWorld constructor and per-tick sentinel/projectile/explosion iteration.');
members['F:ee.field_y:Lmb;'].evidence='World update spawns the special oh.field_h design, stores it here and checks its score for progression. This is not the local controlled sentinel.';
field('nb','X','Lee;','world','GameplayController coordinates this CombatWorld.');
field('nb','C','Lmb;','controlledSentinel','GameplayController applies player controls and draws overlays for this sentinel.');
field('hd','n','I','profileLength','Clamped profile accessors and terrain construction.');
field('hd','m','[I','groundHeightProfile','Sentinel spawn/ground contact uses this height profile with inverted world Y.');
field('hd','e','[I','secondaryHeightProfile','Parallel terrain height profile; finer geometry role unresolved.');
field('hd','f','[I','surfaceProfile','Third parallel terrain profile; finer surface encoding unresolved.');
field('hd','b','I','terrainType','Map seed modulo-eight layout choice and getTerrainType accessor.');
field('hd','o','[I','spawnPositions','World creates boundary/spawn effects from this coordinate table.');
for(const [original,to,type] of [
  ['B','world','Lee;'],['U','worldX','I'],['A','worldY','I'],
  ['X','sourceSentinel','Lmb;'],['fb','affectedSentinels','[Lmb;'],['Z','ageTicks','I'],
  ['y','sourceWeaponType','I'],['C','effectType','I'],
]) field('wl',original,type,to,'Projectile constructor and update/collision paths.');
members['F:wl.field_y:I'].evidence='Sentinel firing passes ArticulatedPart.componentId - 17; special effects use negative markers. Preserves the original encoding.';
field('jb','Z','Lee;','world','Explosion constructor stores its CombatWorld.');
field('jb','I','Lwl;','projectile','Explosion constructor links the originating projectile.');
field('qb','z','Lee;','world','Particle effect factory stores its CombatWorld.');
for(const [original,to,type] of [
  ['s','actionType','I'],['A','actionVariant','I'],['x','startTick','I'],
  ['r','endTick','I'],['z','activated','Z'],
]) field('je',original,type,to,'SentinelCommand constructor derives end tick and activation by action type/variant.');
field('nk','I','[Lqd;','instructions','Articulated part constructors, recursive copy, property sums and rendering.');
field('nk','R','Lgk;','sprite','Articulated part constructors store its indexed sprite.');
field('nk','N','I','componentId','Used by component name/ID lookup and design editing.');
field('nk','y','I','rotation','Interpolated animation writes angles into this field.');
field('qd','d','Lnk;','attachedPart','Recursive instruction copies clone this attached part.');
field('qd','v','Ljava/lang/String;','partName','String constructor and recursive component name lookup.');
field('qd','e','I','armourContribution','ArticulatedPart sums this property recursively to obtain maximum armour.');
field('ck','k','Lck;','next','Deque forward traversal follows this link.');
field('ck','i','Lck;','previous','Unlink updates both neighbouring links.');
field('ck','j','J','key','Intrusive collection key.');
field('kd','o','Lkd;','dualNext','Dual-node traversal link.');
field('kd','v','Lkd;','dualPrevious','Dual unlink updates both neighbouring secondary links.');
field('ul','e','Lck;','sentinel','Deque constructor and end-of-traversal checks.');
field('ul','i','Lck;','traversalCursor','Deque first/next cursor.');
field('gi','t','[B','payload','Primitive packet serialization uses this byte array.');
field('gi','p','I','position','Primitive packet reads/writes advance this cursor.');
field('SteelSentinels','G','I','obfuscationControl','Shared opaque branch-control integer.');

method('ee','b','(B)V','advanceSimulation','Updates sentinel/projectile state and advances simulationTick.',{0:'obfuscationGuard'});
method('ee','b','(Z)I','computeSyncChecksum','Aggregates sentinel positions, velocities, armour, charge, score and world state.',{0:'obfuscationGuard'});
method('ee','f','(II)Lmb;','findSentinelForPlayer','Traverses sentinels to find a matching player ID.',{0:'playerId',1:'obfuscationGuard'});
method('ee','e','(I)V','checkMatchCompletion','Builds surviving player/team masks and checks match completion.',{0:'obfuscationGuard'});
method('mb','a','([IZZII)V','configureDesign','Builds chassis/modules and initializes player/team and design-derived properties.',{0:'design',1:'obfuscationGuard',2:'alternateConfiguration',3:'playerId',4:'teamId'});
method('mb','c','(II)V','advanceCombatState','Updates timers, armour/charge state, effects and combat physics; receives the world simulation tick.',{0:'obfuscationGuard',1:'simulationTick'});
method('mb','i','(II)Z','hasModuleType','Checks active/installed module IDs, including original special aliases.',{0:'moduleType',1:'obfuscationGuard'});
method('mb','h','(II)I','addModuleBonuses','Adds active and installed module bonuses to an incoming count.',{0:'baseCount',1:'moduleType'});
method('mb','e','(II)V','reduceArmour','Subtracts armour and updates the local player world accumulator.',{0:'obfuscationGuard',1:'amount'});
method('mb','e','(I)V','restoreArmour','Restores maximum armour and updates local world accumulators.',{0:'obfuscationGuard'});
method('mb','f','(I)V','clearArmour','Clears armour and updates the local world accumulator.',{0:'obfuscationGuard'});
method('mb','a','(ZI)V','consumeCharge','Subtracts charge with the original cap and module-37 override; no new clamping.',{0:'obfuscationGuard',1:'amount'});
method('mb','g','(I)V','refillCharge','Restores charge to maximum and updates the local world accumulators.',{0:'obfuscationGuard'});
method('mb','b','(ZI)I','getStatistic','Reads a selected match statistic using its original numeric index.',{0:'obfuscationGuard',1:'statisticId'});
method('mb','d','(B)I','getTeamColour','Returns the team palette colour with special/fallback colours.',{0:'obfuscationGuard'});
method('hd','a','(I)I','getProfileLength','Returns the shared terrain profile length.',{0:'obfuscationGuard'});
method('hd','b','(I)I','getTerrainType','Returns the seed-derived terrain layout type.',{0:'obfuscationGuard'});
method('hd','a','(BI)I','getGroundHeightAt','Clamps the index and reads groundHeightProfile.',{0:'obfuscationGuard',1:'profileIndex'});
method('hd','a','(ZI)I','getSecondaryHeightAt','Clamps the index and reads secondaryHeightProfile.',{0:'obfuscationGuard',1:'profileIndex'});
method('hd','b','(BI)I','getSurfaceProfileAt','Clamps the index and reads surfaceProfile.',{0:'obfuscationGuard',1:'profileIndex'});
method('wl','i','(I)V','advanceProjectile','Updates projectile state, collision checks and associated effects.',{0:'obfuscationGuard'});
method('nk','g','(I)I','getTotalArmour','Recursively sums armour contributions on attached parts.',{0:'obfuscationGuard'});
method('nk','l','(I)Ljava/lang/String;','getPartName','Returns a component-table name or an instruction-supplied part name.',{0:'obfuscationGuard'});
method('ck','b','(I)V','unlink','Unlinks the node from its neighbours.',{0:'obfuscationGuard'});
method('kd','e','(I)V','unlinkDual','Unlinks the secondary intrusive links.',{0:'obfuscationGuard'});
method('ul','a','(ILck;)V','addLast','Adds before the sentinel while preserving original guard effects.',{0:'obfuscationGuard',1:'node'});
method('ul','e','(I)Lck;','first','Returns first node and primes forward traversal.',{0:'obfuscationGuard'});
method('ul','a','(B)Lck;','next','Continues forward traversal.',{0:'obfuscationGuard'});
method('ul','g','(I)V','clear','Unlinks every node and resets the cursor.',{0:'obfuscationGuard'});
method('ul','b','(B)I','size','Counts nodes with the original dummy-guard branch.',{0:'obfuscationGuard'});
method('gk','a','()Lwk;','toRgbSprite','Expands unsigned byte indices through the palette.');
// Command scheduling is distinct from command activation: insertion marks a
// command scheduled, whereas activation is consumed by individual abilities.
field('je','p','Z','scheduled','Sentinel.scheduleCommand sets this on insertion; executeCommand checks it before dispatch.');
field('je','u','I','targetWorldX','Gameplay input and projectile interception copy the target X coordinate here.');
field('je','y','I','targetWorldY','Gameplay input and projectile interception copy the target Y coordinate here.');
field('je','B','I','aimAngle','atan2 target offset converted to 65536 units per turn, adjusted for sentinel facing.');
for(const [original,to] of [['eb','velocityX'],['F','velocityY']])
  field('wl',original,'I',to,'Projectile constructor records motion; update adds velocity to world coordinates.');
for(const [original,to,type] of [
  ['H','worldX','I'],['M','worldY','I'],['V','velocityX','I'],['T','velocityY','I'],
  ['Y','ageTicks','I'],['z','durationTicks','I'],['X','affectedSentinels','[Lmb;'],
])field('jb',original,type,to,'Explosion constructor bindings, position advancement, age increment and duration termination.');
for(const [original,to] of [['F','worldX'],['B','worldY'],['A','velocityX'],['O','velocityY']])
  field('qb',original,'I',to,'Particle update adds these velocities to the corresponding world coordinates before terrain contact.');
method('mb','d','(BLje;)V','scheduleCommand','Routes types 3/4/6 to the secondary queue; inserts by tick, replaces equal ticks and removes older unscheduled commands.',{0:'obfuscationGuard',1:'command'});
method('mb','a','(BI)V','advanceCommandQueues','Clears queues when requested and executes the first command from each queue.',{0:'obfuscationGuard',1:'simulationTick'});
method('mb','a','(ZLje;I)V','executeCommand','Checks scheduled/activated state and dispatches the action at its simulation tick.',{0:'obfuscationGuard',1:'command',2:'simulationTick'});
method('ie','a','(Lck;ILck;)V','insertNodeBefore','Splices a node before an existing intrusive node; command scheduling uses guard 30.',{0:'existingNode',1:'obfuscationGuard',2:'node'});
method('qb','c','(B)V','advanceParticle','Integrates world coordinates, applies terrain contact and updates particle motion.',{0:'obfuscationGuard'});
method('jb','a','(Z)V','advanceExplosion','Advances explosion position/age and applies its effects to world entities.',{0:'obfuscationGuard'});
for(const [owner,descriptor,names] of [
  ['je','(III)V',['actionType','actionVariant','startTick']],
  ['jb','(IIIIILee;[Lmb;Lwl;)V',['worldX','worldY','velocityX','velocityY','durationTicks','world','affectedSentinels','projectile']],
])for(const [ordinal,to] of names.entries())members[`P:${owner}.<init>${descriptor}#${ordinal}`]={to,evidence:'Constructor assignments and callers establish these parameter roles.'};

for(const [owner,signature,ordinal,originalName,to] of [
  ['je','<init>(III)V',0,'var4','durationTicks'],
  ['mb','a(BI)V',0,'var3','primaryCommand'],
  ['mb','a(BI)V',1,'var4','secondaryCommand'],
  ['mb','d(BLje;)V',0,'var3','commandQueue'],
  ['mb','d(BLje;)V',1,'var4','queuedCommand'],
])members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName:originalName,
  evidence:'Reviewed lexical declaration ordinal and command duration/queue traversal data flow.'};

export function buildSteelRules(input, rows) {
  const declarations = rows.filter(row=>row[0]==='D');
  const declared = new Map(declarations.map(row=>[row[4],row]));
  const rules = new Map();
  const add = (symbol,to,evidence,confidence='reviewed') => {
    const row=declared.get(symbol);
    if(!row) throw new Error('Reviewed identity missing: '+symbol);
    if(row[5]!==to) rules.set(symbol,{symbol,originalName:row[5],to,evidence,confidence});
  };
  for(const [owner,[to,evidence]] of Object.entries(classes)) add('C:'+owner,to,`${owner}.java: ${evidence}`);
  for(const [symbol,{to,evidence,expectedOriginalName}] of Object.entries(members)) {
    if(expectedOriginalName&&declared.get(symbol)?.[5]!==expectedOriginalName)throw new Error('Reviewed local identity differs: '+symbol);
    add(symbol,to,`${symbol.slice(2).split('.')[0]}.java: ${evidence}`);
  }
  // Follow resolved override edges in both directions. A name never crosses an
  // unresolved or external contract, and contradictory reviewed names fail.
  const edges=rows.filter(row=>row[0]==='O').map(row=>[row[1],row[2]]);
  let changed=true;
  while(changed) {
    changed=false;
    for(const [a,b] of edges) {
      const left=rules.get(a),right=rules.get(b),known=left||right;
      if(!known) continue;
      if(left&&right&&left.to!==right.to) throw new Error('Conflicting override family: '+a);
      for(const symbol of [a,b]) {
        if(!declared.has(symbol)) throw new Error('Reviewed method overrides external contract: '+symbol);
        if(!rules.has(symbol)) {add(symbol,known.to,known.evidence+' Resolved override family.');changed=true;}
        const key=symbol.slice(2);
        for(const row of declarations.filter(row=>row[4].startsWith('P:'+key+'#'))) {
          const ordinal=row[4].slice(row[4].lastIndexOf('#'));
          const origin=rules.get('P:'+known.symbol.slice(2)+ordinal);
          if(origin&&!rules.has(row[4])) add(row[4],origin.to,origin.evidence+' Resolved override parameter.');
        }
      }
    }
  }
  const sources=new Map(sourceInventory(input).map(file=>[file.path,fs.readFileSync(path.join(input,file.path),'utf8')]));
  for(const row of rows.filter(row=>row[0]==='T')) {
    const suffix=sources.get(row[1]).slice(Number(row[3]));
    const loop=/^\s*:\s*(?:while|for|do)\b/.test(suffix);
    const ordinal=Number(row[4].slice(row[4].lastIndexOf('#')+1))+1;
    rules.set(row[4],{symbol:row[4],originalName:row[5],to:(loop?'scanLoop':'regionExit')+ordinal,
      evidence:'Resolved lexical target and declaration ordinal; transfers are unchanged.',confidence:'structural'});
  }
  return [...rules.values()].sort((a,b)=>a.symbol<b.symbol?-1:1);
}

const workflowFiles=['build-steelsentinels-rules.mjs','reproduce-steelsentinels.mjs',
  'tests/test-steelsentinels-core.mjs','game-export.mjs','compilation-stubs.mjs'];
export function validateSteelManifest(rules) {
  if(rules.schema!==1||rules.game!=='steelsentinels'||rules.source.commit!==SOURCE_COMMIT) throw new Error('Invalid Steel naming manifest');
  for(const [file,sha] of Object.entries(rules.readabilityWorkflow.files))
    if(digest(fs.readFileSync(path.join(workflowRoot,file)))!==sha) throw new Error('Naming workflow changed: '+file);
  if(JSON.stringify(rules.generators.namingTool)!==JSON.stringify(verifyToolPin())) throw new Error('Naming tool identity changed');
}
export function buildSteelGuide(rules,mapping) {
  const link=owner=>`[${classes[owner][0]}](${classes[owner][0]}.java)`;
  return ['# Reading Steel Sentinels','',
    'Java here is the single published version. Rebuild from pinned raw Git input with Deko’s `readable/reproduce-steelsentinels.mjs`. The current reverse dictionary is `../../decompilation/steelsentinels-naming.json`.','',
    `This gameplay naming pass names ${Object.keys(classes).length} reviewed classes across ${mapping.files.length} compiled classes. Unknown class/member purposes remain unresolved. Profile and charge names describe observed roles; finer encodings remain open. Renamed identifiers have no opaque suffixes; the dictionary preserves original identities.`, '',
    '| Start here | Follow |','| --- | --- |',
    `| ${link('nb')} → ${link('ee')} | Player control, game display, world updates and synchronization checksum. |`,
    `| ${link('mb')} | Sentinel position/velocity, player/team, chassis, modules, armour, charge, command queues and combat updates. |`,
    `| ${link('je')} | Action type/variant, scheduling, activation, target coordinates, aiming and start/end simulation ticks. |`,
    `| ${link('wl')} / ${link('jb')} / ${link('qb')} | Projectiles, explosions and visual effects. |`,
    `| ${link('hd')} | Terrain layout, ground/secondary/surface profiles and spawn positions. |`,
    `| ${link('ji')} → ${link('nk')} / ${link('qd')} | Engineering UI and sprite-backed articulated part configuration. |`,
    `| ${link('gi')} / ${link('kj')} / ${link('ie')} | Packet data, ciphered opcodes and deterministic seeded random generation. |`, '',
    'Start with `Sentinel.scheduleCommand`, `advanceCommandQueues`, `executeCommand`, `CombatWorld.advanceSimulation`, `Sentinel.advanceCombatState`, `configureDesign`, `hasModuleType`, `reduceArmour` and `consumeCharge`. Positions retain their fixed-point scale: ground contacts index `worldX >> 4`, and terrain heights convert to inverted world Y with `-(height << 4)`. Physics velocities are distinct from armour; the sentinel constructor starts vertical velocity at 1000.','',
    '`computeSyncChecksum` retains Java integer wrapping and the original state fields. Module aliases, noncanonical dummy-guard behaviour, negative armour and unusual charge values are preserved. `ArticulatedPart.getTotalArmour` recursively aggregates attachment contributions.','',
    'Compilation and symbol/override checks cover the complete game. The raw/named core probe independently checks module aliases/bonuses, armour and charge mutations, terrain boundaries, part aggregation, synchronization checksums, command timing, queue routing, ordering and equal-tick replacement. It allocates controlled world/sentinel/terrain fixtures without game construction and replaces only the client branch-control flag at runtime. It does not prove whole-game playability, projectile simulation, rendering or server compatibility. Dictionary reversal recovers every original source byte.','',
    'This is a naming pass. Three files still contain compiler dispatcher fallbacks, and large methods remain. Further work should explain weapon/projectile variants, command dispatch, physics/collision, tutorial flow and multiplayer packets.',''].join('\n');
}
export function buildSteelManifest() {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'steel-naming-rules-'));
  try {
    const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout);
    const record=catalog.publication.games.steelsentinels;
    const rules={schema:1,game:'steelsentinels',version:2,
      source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/steelsentinels'},inputTreeSha256:record.sources.sha256};
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    const helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
    captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
    const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');
    fs.writeFileSync(files,sourceInventory(input).map(file=>file.path).join('\n')+'\n');
    captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);
    const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(line=>line.split('\t'));
    rules.renames=buildSteelRules(input,rows);
    const symbols=new Set(rules.renames.map(rule=>rule.symbol));
    rules.classNameLiterals={policy:'direct-owned-class-for-name',expectedEdits:rows.filter(row=>row[0]==='S'&&symbols.has(row[4])).length};
    rules.labels={policy:'lexical-targets',expectedEdits:rows.filter(row=>['T','B','N'].includes(row[0])&&symbols.has(row[4])).length};
    if(rows.some(row=>row[0]==='U'&&symbols.has(row[4]))) throw new Error('Unsupported escaped class-name literal');
    rules.publication={stubSourceTreeSha256:stubs.sourceTreeSha256,stubJarSha256:digest(fs.readFileSync(stubs.jar))};
    rules.readabilityWorkflow={repository:'Kreijstal/dekobloko-work',files:Object.fromEntries(workflowFiles.map(file=>[file,digest(fs.readFileSync(path.join(workflowRoot,file)))]))};
    rules.generators={javaTools:record.sourceGenerator,namingTool:verifyToolPin()};
    return rules;
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const rules=buildSteelManifest(),file=path.join(workflowRoot,'steelsentinels-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';
    if(process.argv.includes('--check')) {if(fs.readFileSync(file,'utf8')!==bytes) throw new Error('Steel rules differ from regeneration');}
    else fs.writeFileSync(file,bytes);
    console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));
  } catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
}
