import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory} from './tools/readable-java.mjs';
import {archivedInput,digest,funorbRepository,verifyToolPin,workflowRoot} from './game-export.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
const SOURCE_COMMIT='8f15143529e53929d7157a5393487342612a4180';
const classes={
 gf:['GameScreen','Abstract screen identity, render/update and key-input contract.'],
 qj:['GameplayScreen','Coordinates multiplayer match, selected board, game input, updates and rendering.'],
 ak:['MultiplayerMatch','Retains player boards/names, player count, configuration and three player-state masks; routes queued attacks between boards.'],
 j:['PlayerBoard','Per-player brick/ball/paddle state, scores, effects, deterministic random state and simulation/snapshot paths.'],
 vi:['MovingBody','Common fixed8 positions/velocities, type and serialized state word with synchronization checksum.'],
 bn:['RectangleBody','Moving-body width/height, rectangle/circle collision and extended checksum.'],
 no:['CircleBody','Moving-body radius and extended synchronization checksum.'],
 vo:['Paddle','Rectangle-backed paddle with retained center/board span/control mode and grow/shrink/reset stages.'],
 on:['Brick','Fixed34-by16-pixel rectangle with brick type, hit/animation state, power-up flags and ball contact effects.'],
 vn:['Ball','Radius-six circular body with velocities, angle-based launch and hit-history caches.'],
 nm:['IntrusiveNode','Previous/next links, collection key and unlink contract.'],
 vl:['NodeDeque','Intrusive sentinel list, insertion/removal, forward/reverse traversal, size and clear.'],
};
const members={};
function field(owner,original,descriptor,to,evidence){members[`F:${owner}.field_${original}:${descriptor}`]={to,evidence};}
function method(owner,original,descriptor,to,evidence,parameters){const key=owner+'.'+original+descriptor;if(original!=='<init>')members['M:'+key]={to,evidence};for(const [ordinal,name] of Object.entries(parameters||{}))members['P:'+key+'#'+ordinal]={to:name,evidence};}
for(const [name,to] of [['j','x256'],['m','y256'],['k','velocityX256'],['o','velocityY256'],['i','typeId'],['l','stateWord']])field('vi',name,'I',to,'Common body constructor, packed snapshot decoder and checksum; coordinates and brick dimensions use256 units per pixel; state word meaning remains unresolved.');
field('bn','u','I','width256','Rectangle constructor width; bricks use8704 and paddles22528.');field('bn','s','I','height256','Rectangle constructor height; bricks use4096 and paddles3840.');field('no','u','I','radius256','Circle constructor radius; ball constructors use1536.');
for(const [name,type,to] of [['l','[Lj;','playerBoards'],['k','I','playerCount'],['f','[Ljava/lang/String;','playerNames'],['b','Loi;','configuration'],['i','I','playerMaskOne'],['g','I','playerMaskTwo'],['a','I','playerMaskThree']])field('ak',name,type,to,'Match constructor and board iteration; player masks retain separate numbered identities rather than guessing elimination/disconnect encodings.');
for(const [name,type,to] of [['yb','Lvo;','paddle'],['mb','I','boardWidth'],['ub','I','boardOffset'],['sb','I','randomSeed'],['s','Lfo;','seededRandom'],['O','[Lon;','bricks'],['K','Lvl;','queuedBalls'],['ob','I','score'],['F','I','simulationTick']])field('j',name,type,to,'Player board constructor, queued attack scheduling, brick/ball/paddle geometry and scoring paths; board offset participates in scrolling/progress state; finer meaning remains qualified.');
field('qj','w','Lak;','match','Gameplay controller owns this player-board match.');
for(const [name,to] of [['E','centerX256'],['y','boardSpan256'],['B','controlMode'],['F','sizeStage']])field('vo',name,'I',to,'Paddle construction/reset and growth/shrink: center remains fixed while width changes in3072-unit increments; control mode retains its numeric encoding.');
field('nm','b','Lnm;','previous','Previous intrusive link; unlink patches both neighbors.');field('nm','e','Lnm;','next','Next intrusive link; forward deque traversal follows it.');field('nm','g','J','key','Retained collection key.');field('vl','e','Lnm;','sentinel','Circular list sentinel initialized with both links to itself.');field('vl','b','Lnm;','cursor','Shared mutable traversal cursor.');
method('nm','b','(I)Z','isLinked','Checks previous link; canonical guard zero.',['obfuscationGuard']);method('nm','b','(B)V','unlink','Patches neighbors then nulls both owned links; canonical guard111.',['obfuscationGuard']);
for(const [original,descriptor,to,params,evidence] of [
 ['a','(ZLnm;)V','addFirst',['obfuscationGuard','node'],'Moves linked node to front; canonical true guard.'],
 ['a','(Lnm;B)V','addLast',['node','obfuscationGuard'],'Moves linked node to back; canonical guard3.'],
 ['d','(I)Lnm;','first',['obfuscationGuard'],'Starts forward traversal; guard below -6.'],
 ['a','(B)Lnm;','next',['obfuscationGuard'],'Advances shared forward cursor; guard116.'],
 ['f','(I)Lnm;','last',['obfuscationGuard'],'Starts reverse traversal; guard0.'],
 ['b','(I)Lnm;','previous',['obfuscationGuard'],'Advances reverse cursor; guard arithmetic retained.'],
 ['c','(I)Lnm;','removeFirst',['obfuscationGuard'],'Unlinks first node or returns null; guard3.'],
 ['a','(I)Lnm;','removeLast',['obfuscationGuard'],'Unlinks last node or returns null; original guard arithmetic retained.'],
 ['e','(I)I','size',['obfuscationGuard'],'Counts forward nodes; guard at least117 preserves unrelated static state.'],
 ['a','(Z)Z','isEmpty',['obfuscationGuard'],'Reports whether sentinel is next node; canonical guard from source retained.'],
 ['c','(B)V','clear',['obfuscationGuard'],'Unlinks all nodes and resets cursor; guard at most -43.'],
])method('vl',original,descriptor,to,evidence,params);
method('gf','b','(B)V','drawScreen','Screen rendering callback invoked by the applet render path.',['obfuscationGuard']);
method('gf','a','(ZZI)V','advanceScreen','Applet tick/input callback; first update flag retains its original meaning and second controls input routing.',['updateFlag','inputEnabled','obfuscationGuard']);
method('gf','a','(CII)Z','handleKey','Screen key event callback returning whether consumed.',['character','keyCode','obfuscationGuard']);
method('ak','a','(IILvl;B)V','distributeQueuedAttacks','Copies queued effects with board tick offsets; routes either to selected board or other unmasked players according to effect flag and player count.',['playerId','tickOffset','attacks','obfuscationGuard']);
method('vi','a','(ILwq;)V','readBodySnapshot','Decodes grid/packed fixed8 position and optional signed velocities/state/type fields.',['obfuscationGuard','packet']);
for(const owner of ['vi','bn','no','vo','on','vn'])method(owner,'a','(ILjava/lang/StringBuilder;)I','computeSyncChecksum','Preserves original wrapping integer checksum and optional diagnostic text; canonical guard above79.',['obfuscationGuard','diagnostics']);
method('bn','a','(Lno;Z)Z','overlapsCircle','Broad-phase strict center bounds followed by closest-point squared-distance test; canonical false guard.',['circle','obfuscationGuard']);
method('bn','a','(Lno;B)Z','resolveCircleCollision','Swept rectangle/circle collision response with body/paddle/brick dispatch; original guards and integer rounding preserved.',['circle','obfuscationGuard']);
method('vo','f','(I)V','resetSize','Resets stage8, width22528 and x=center-11264; retains reset argument in an unresolved state field.',['resetState']);method('vo','d','(I)V','grow','Adds3072 width and moves left1536 until stage14; guard at least6.',['obfuscationGuard']);method('vo','e','(B)V','shrink','Subtracts3072 width and moves right1536 until stage0; guard arithmetic retained.',['obfuscationGuard']);
method('vn','a','(III)V','setVelocityFromAngle','Derives signed horizontal/vertical velocities from existing trigonometric helpers; guard at least95.',['angle','speed','obfuscationGuard']);
method('ak','a','(B)I','getStateZeroPlayerMask','Selects boards with state M zero excluding OR of three masks; canonical guard -92.',['obfuscationGuard']);method('ak','c','(I)I','getStateSevenPlayerMask','Selects board state Z seven excluding maskThree; canonical guard -17566.',['obfuscationGuard']);
for(const [owner,desc,params,evidence] of [
 ['vi','(IIIII)V',['x256','y256','velocityX256','velocityY256','typeId'],'Retains common position/velocity/type state.'],
 ['bn','(IIIIIII)V',['x256','y256','velocityX256','velocityY256','width256','height256','typeId'],'Retains common body and rectangle dimensions.'],
 ['no','(IIIIII)V',['x256','y256','velocityX256','velocityY256','radius256','typeId'],'Retains common body and circle radius.'],
 ['vo','(IIII)V',['centerX256','y256','controlMode','boardSpan256'],'Constructs15-pixel-high paddle and resets its88-pixel width.'],
 ['vn','(IIII)V',['x256','y256','velocityX256','velocityY256'],'Constructs radius-six ball and hit caches.'],
 ['on','(IIIIIIII)V',['x256','y256','velocityX256','velocityY256','typeId','brickFlags','brickState','hitState'],'Constructs34-by16-pixel brick and retains unresolved numeric state words.'],
 ['j','(IIIII)V',['boardWidth','initialBoardOffset','paletteVariant','randomSeed','initialState'],'Constructs board geometry, paddle, deterministic random state and effect collections.'],
])method(owner,'<init>',desc,'<init>',evidence,params);
export function buildBrickRules(input, rows) {
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

const workflowFiles=['build-brickabrac-rules.mjs','reproduce-brickabrac.mjs','tests/test-brickabrac-core.mjs','game-export.mjs','compilation-stubs.mjs'];
export function validateBrickManifest(rules){if(rules.schema!==1||rules.game!=='brickabrac'||rules.source.commit!==SOURCE_COMMIT)throw new Error('Invalid Brick-a-brac naming manifest');for(const [file,sha] of Object.entries(rules.readabilityWorkflow.files))if(digest(fs.readFileSync(path.join(workflowRoot,file)))!==sha)throw new Error('Naming workflow changed: '+file);if(JSON.stringify(rules.generators.namingTool)!==JSON.stringify(verifyToolPin()))throw new Error('Naming tool identity changed');}
export function buildBrickGuide(rules,mapping){const link=o=>`[${classes[o][0]}](${classes[o][0]}.java)`;return ['# Reading Brick-a-brac','',
'Java here is the single published version. Rebuild with Deko’s `readable/reproduce-brickabrac.mjs`. The reverse dictionary is `../../decompilation/brickabrac-naming.json`.','',
`This pass reviews ${Object.keys(classes).length} class identities across ${mapping.files.length} compiled classes. Other names remain unresolved. Numbered state masks/words identify observed storage without guessing server semantics. Identifiers have no opaque suffixes; reversal recovers original bytes.`, '',
'| Start here | Follow |','| --- | --- |',
`| ${link('qj')} → ${link('ak')} → ${link('j')} | Gameplay screen, multiplayer match and per-player boards. |`,
`| ${link('vi')} / ${link('bn')} / ${link('no')} | Fixed8 body coordinates/velocities, rectangle/circle geometry, snapshots and checksums. |`,
`| ${link('vo')} / ${link('vn')} / ${link('on')} | Paddle size stages, balls and bricks. |`,
`| ${link('nm')} / ${link('vl')} | Intrusive ownership and deque traversal/transfer. |`, '',
'Focused raw/named probes check body constructors/checksums, circle overlap boundaries, paddle growth/shrink/reset, player-state mask getters and deque ownership/order. The client branch flag is supplied by a headless Applet-compatible shim; player-board/match construction is bypassed for mask fixtures. Full ball/brick collision response, snapshots, gameplay input/rendering, live multiplayer and browser/phone behavior remain unverified.','',
`Decompiler source commit: ${rules.generators.javaTools.commit}. Tracked-source Git tar SHA-256: ${rules.generators.javaTools.trackedSourceTarSha256}. This identifies decompiler source, not a gamepack JAR.`, ''].join('\n');}
export function buildBrickManifest(){const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'brick-naming-rules-'));try{
 const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout),record=catalog.publication.games.brickabrac;
 const rules={schema:1,game:'brickabrac',version:1,source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/brickabrac'},inputTreeSha256:record.sources.sha256};
 const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary),helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
 captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');fs.writeFileSync(files,sourceInventory(input).map(f=>f.path).join('\n')+'\n');captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(l=>l.split('\t'));
 rules.renames=buildBrickRules(input,rows);const symbols=new Set(rules.renames.map(r=>r.symbol));rules.classNameLiterals={policy:'direct-owned-class-for-name',expectedEdits:rows.filter(r=>r[0]==='S'&&symbols.has(r[4])).length};rules.labels={policy:'lexical-targets',expectedEdits:rows.filter(r=>['T','B','N'].includes(r[0])&&symbols.has(r[4])).length};if(rows.some(r=>r[0]==='U'&&symbols.has(r[4])))throw new Error('Unsupported escaped class-name literal');
 const archive=path.join(temporary,'decompiler-source.tar');captureProcess('git',['-C',path.resolve(funorbRepository,'../java-tools'),'archive','--format=tar','--output='+archive,record.sourceGenerator.commit]);
 rules.publication={stubSourceTreeSha256:stubs.sourceTreeSha256,stubJarSha256:digest(fs.readFileSync(stubs.jar))};rules.readabilityWorkflow={repository:'Kreijstal/dekobloko-work',files:Object.fromEntries(workflowFiles.map(file=>[file,digest(fs.readFileSync(path.join(workflowRoot,file)))]))};rules.generators={javaTools:{...record.sourceGenerator,trackedSourceTarSha256:digest(fs.readFileSync(archive))},namingTool:verifyToolPin()};return rules;
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const rules=buildBrickManifest(),file=path.join(workflowRoot,'brickabrac-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==bytes)throw new Error('Brick-a-brac rules differ from regeneration');}else fs.writeFileSync(file,bytes);console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));}catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}}
