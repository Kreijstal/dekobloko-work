import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {archivedInput, digest, funorbRepository, verifyToolPin, workflowRoot} from './game-export.mjs';

const SOURCE_COMMIT = '1655ca853d0d4027018f3efcdc37be76ab7895f4';
const classNames = {
  client:'DekoBlokoClient',hn:'GameApplet',bd:'FunOrbClient',fd:'PlatformService',mh:'AsyncTask',
  hk:'SoftwareRaster',wf:'SoftwareFramebuffer',eh:'Framebuffer',ck:'RgbSprite',pi:'IndexedSprite',lc:'Sprite',
  mm:'BitmapFont',w:'SceneWidget',km:'SceneWidgetNode',ce:'UiComponent',ek:'InteractiveComponent',kf:'ComponentContainer',ma:'ComponentDecorator',
  bh:'HashNode',be:'DualNode',vj:'NodeDeque',ab:'DualNodeDeque',si:'NodeHashTable',uh:'IterableNodeCollection',
  wl:'PacketBuffer',uf:'CipherPacketBuffer',qk:'BufferedSocket',we:'SocketFactory',sc:'ProxySocketFactory',
  ji:'ResourceArchive',im:'CacheWorkQueue',el:'ArchiveRequestManager',qb:'NetworkArchiveRequestManager',
  ol:'PcmStream',mi:'PcmStreamMixer',ei:'RawPcmStream',ud:'RawSound',en:'PcmPlayer',jn:'JavaSoundPcmPlayer',
  ia:'MidiSynthesizer',ui:'MusicTrack',va:'VorbisSample',bi:'SoundEffect',dh:'ClientException',
  wg:'MouseInput',lk:'BucketBoard',qc:'GameSession',rf:'ReturnedShape',oi:'ReturnedShapeCache',
  uk:'AnimatedTileRegion',cf:'TextLayout',ea:'RichTextLayout',nf:'TextLineMetrics',
  ml:'TranslatedUiText',sh:'GameAssets',jj:'ThemeTips',jg:'LoginCredentials',vk:'GameplayControls',
};
const categoryNames = {
  'Application lifecycle':'ApplicationSupport', 'Platform and asynchronous I/O':'PlatformSupport',
  'Input and AWT events':'InputAdapter', 'Game-screen widget tree':'SceneWidgetPart',
  'Reusable UI components':'UiComponentPart', 'Software rendering, sprites, and fonts':'RenderingSupport',
  'Audio and music':'AudioSupport', 'Networking and wire protocol':'NetworkSupport',
  'Resources, cache, and serialization':'ResourceSupport', 'Collections and intrusive nodes':'CollectionSupport',
  'Game and lobby domain logic':'GameDomainSupport', 'Crypto and compression helpers':'CodecSupport',
  'Errors and diagnostics':'DiagnosticSupport', 'Callback and strategy interfaces':'CallbackContract',
  'Utility or mixed responsibility':'MixedSupport',
};
// These identities are asserted by the existing original-bytecode differential.
const boardFields = {O:'boardWidth',a:'boardHeight',U:'pieceAcknowledgement',C:'pieceWidth',zb:'pieceHeight',
  q:'pieceX',L:'pieceY',Ab:'forcedDropCountdown',yb:'dominoDescriptor',T:'activePieceCells',P:'settledCells',
  e:'dropCountdown',A:'previousControls',Cb:'horizontalRepeatTicks',o:'verticalParity',db:'horizontalParity',
  y:'grounded',Bb:'landed',jb:'livesRemaining',w:'selectedCellIndices'};
const explicitMembers = {
  'M:lk.a(ZLwl;B)V':'decodeMultiplayerSnapshot', 'M:lk.d(II)V':'applyControls',
  'M:lk.a(IBZ)V':'finalizePiecePlacement', 'M:lk.a(Llk;Loi;III)V':'buildCookedFeedbackShape',
  'M:lk.b(B)V':'moveLeft', 'M:lk.j(I)V':'moveRight',
  'M:lk.c(Z)V':'rotateCounterClockwise', 'M:lk.i(I)V':'rotateClockwise',
  'M:lk.c(B)Z':'pieceCollides', 'M:lk.a(BZ)Z':'tryDropAndReportCollision',
  'M:lk.h(I)V':'updateGroundedAfterMovement', 'M:lk.c(III)V':'advanceDropCountdown',
  'M:lk.a(IIZ)V':'selectDropSpeed', 'M:lk.o(I)I':'getPieceCenterY2',
  'M:lk.d(I)V':'recordDeepestPiecePosition',
  'F:rf.field_b:I':'width', 'F:rf.field_n:I':'height', 'F:rf.field_c:[B':'packedCells',
  'F:wl.field_r:[B':'payload', 'F:wl.field_n:I':'position',
  'F:bh.field_a:Lbh;':'next', 'F:bh.field_b:Lbh;':'previous', 'F:bh.field_i:J':'key',
  'F:client.field_A:Z':'obfuscationControl',
  'F:lk.field_g:I':'dropIntervalTicks', 'F:lk.field_M:I':'deepestPieceCenterY2',
  'F:nf.field_a:[I':'characterXPositions', 'F:nf.field_c:I':'topY', 'F:nf.field_i:I':'bottomY',
  'F:cf.field_a:[Lnf;':'lines', 'F:ea.field_o:Lmm;':'font',
  'M:nf.a(II)I':'findNearestCharacterIndex', 'M:nf.b(I)I':'getRightX',
  'P:lk.d(II)V#0':'controls', 'P:lk.d(II)V#1':'obfuscationGuard',
  'L:lk.d(II)V#2':'newlyPressedControls', 'L:lk.d(II)V#3':'forceDrop',
  'L:lk.d(II)V#4':'obfuscationControlSnapshot',
  'P:lk.a(ZLwl;B)V#1':'packet',
  'P:lk.a(Llk;Loi;III)V#0':'destinationBucket',
  'P:lk.a(Llk;Loi;III)V#1':'shapeCache',
  'P:lk.a(Llk;Loi;III)V#2':'packedColour',
  'P:lk.a(Llk;Loi;III)V#3':'selectedOffset',
  'P:lk.a(Llk;Loi;III)V#4':'selectedCount',
  'F:qc.field_h:[Llk;':'buckets', 'F:qc.field_db:Loi;':'returnedShapeCache',
  'F:jg.field_k:[Ljava/lang/String;':'tutorialTips', 'F:jj.field_d:[Ljava/lang/String;':'themeTips',
  'P:lk.c(III)V#0':'obfuscationGuard', 'P:lk.c(III)V#1':'countdown', 'P:lk.c(III)V#2':'stepsDropped',
  'P:lk.a(IIZ)V#0':'speedLevel', 'P:lk.a(IIZ)V#1':'obfuscationGuard', 'P:lk.a(IIZ)V#2':'alternateSpeedTable',
};
for (const [name, to] of Object.entries(boardFields)) explicitMembers[`F:lk.field_${name}:${['T','P','w'].includes(name)?'[I':['y','Bb'].includes(name)?'Z':'I'}`] = to;

function typeStem(type, aliases) {
  const primitives={I:'integer',B:'byte',S:'short',J:'long',F:'float',D:'double',C:'character',Z:'boolean',V:'action'};
  if (type[0]==='[') return typeStem(type.slice(1),aliases)+'Array';
  if (primitives[type]) return primitives[type];
  const owner=type.replace(/^L|;$/g,'').replaceAll('/','.');
  const name=aliases[owner] || owner.split('.').at(-1);
  return name[0].toLowerCase()+name.slice(1);
}

function descriptorParameters(key) {
  const descriptor=key.slice(key.indexOf('(')+1,key.indexOf(')'));
  return descriptor.match(/\[*L[^;]+;|\[*[ZBCSIJFD]/g)||[];
}

export function buildNamingRules(input, rows, classMap) {
  const declarations=rows.filter(r=>r[0]==='D');
  const topClasses=declarations.filter(r=>r[4].startsWith('C:') && r[1]===r[5]+'.java');
  const categories=new Map();
  for(const line of classMap.split('\n')) {
    const cells=line.split('|').map(s=>s.trim());
    const name=cells[1]?.match(/^\[`([^`]+)`\]/)?.[1];
    if(name && ['high','medium','low'].includes(cells[3]) && cells[4]?.startsWith('`')) categories.set(name,{category:cells[2],confidence:cells[3]});
  }
  const aliases={},counts=new Map(),rules=[];
  const add=(symbol,originalName,to,evidence,confidence)=>{if(originalName!==to)rules.push({symbol,originalName,to,evidence,confidence});};
  for(const row of topClasses.sort((a,b)=>a[4]<b[4]?-1:1)) {
    const original=row[5],info=categories.get(original);
    if(!info)throw new Error('Unclassified current class: '+original);
    let name=classNames[original];
    if(!name){const prefix=categoryNames[info.category];if(!prefix)throw new Error('Unknown class category');const index=(counts.get(prefix)||0)+1;counts.set(prefix,index);name=prefix+String(index).padStart(3,'0');}
    aliases[original]=name;
    add(row[4],original,name,classNames[original]
      ?'Reviewed current source, supported by the class map; gameplay anchors also use the existing original-bytecode differential.'
      :`Structural category: ${info.category} (${info.confidence}); numbered category label, finer purpose unresolved.`,classNames[original]?'reviewed':'category');
  }
  if(new Set(Object.values(aliases)).size!==topClasses.length)throw new Error('Class alias collision');
  const parents=new Map();
  const find=x=>{if(!parents.has(x))parents.set(x,x);const p=parents.get(x);if(p!==x)parents.set(x,find(p));return parents.get(x);};
  for(const r of rows.filter(r=>r[0]==='O'))parents.set(find(r[2]),find(r[1]));
  const groups=new Map();
  for(const r of declarations.filter(r=>r[4].startsWith('M:')&&!r[4].includes('.<'))){const k=find(r[4]);const group=groups.get(k)||[];group.push(r);groups.set(k,group);}
  let methodIndex=0;
  for(const group of [...groups.values()].sort((a,b)=>a[0][4]<b[0][4]?-1:1)) {
    const family=find(group[0][4]);
    const external=[...parents.keys()].find(k=>find(k)===family&&!declarations.some(r=>r[4]===k));
    const explicit=group.map(r=>explicitMembers[r[4]]).find(Boolean);
    const readable=group.find(r=>r[5].length>2 && !r[5].startsWith('$'));
    const to=external?external.slice(2,external.indexOf('(')).split('.').at(-1):explicit||readable?.[5]||
      (group[0][4].endsWith('V')?'performAction':'compute'+typeStem(group[0][4].slice(group[0][4].indexOf(')')+1),aliases).replace(/^./,s=>s.toUpperCase()))+String(++methodIndex).padStart(4,'0');
    for(const r of group)add(r[4],r[5],to,explicit?'Reviewed current source operation; core board operations also use the original-bytecode differential.':external?'Resolved external override contract.':'Resolved override family; type-based operation label, finer purpose unresolved.',explicit?'reviewed':'typed');
  }
  const sources=new Map(sourceInventory(input).map(f=>[f.path,fs.readFileSync(path.join(input,f.path),'utf8')]));
  for(const r of rows.filter(r=>r[0]==='T')) {
    const suffix=sources.get(r[1]).slice(Number(r[3]));
    const loop=/^\s*:\s*(?:while|for|do)\b/.test(suffix);
    const ordinal=Number(r[4].slice(r[4].lastIndexOf('#')+1))+1;
    add(r[4],r[5],(loop?'scanLoop':'regionExit')+ordinal,'Resolved lexical label target and declaration ordinal; transfer kind and target are unchanged.','structural');
  }
  const fieldCounts=new Map();
  for(const r of declarations) {
    const symbol=r[4],original=r[5];
    if(symbol.startsWith('F:')) {
      const stem=typeStem(symbol.slice(symbol.indexOf(':',2)+1),aliases)+'State';
      // Fields can be selected through subclasses: even an inaccessible private
      // field would hide a renamed inherited field with the same spelling.
      const key=stem,index=(fieldCounts.get(key)||0)+1;fieldCounts.set(key,index);
      const to=explicitMembers[symbol]||stem+String(index).padStart(4,'0');
      add(symbol,original,to,explicitMembers[symbol]?'Current field identity and original-bytecode differential / linked-list or buffer layout.':'Resolved declaration type; state label, finer field purpose unresolved.',explicitMembers[symbol]?'reviewed':'typed');
    }else if(symbol.startsWith('P:')||symbol.startsWith('L:')) {
      if(!/^(?:param\d+|var\d+|stackIn_|dupTemp|incrementValue|array\$|fieldTemp|decompiled)/.test(original))continue;
      const ordinal=Number(symbol.slice(symbol.lastIndexOf('#')+1));let type;
      if(symbol.startsWith('P:'))type=descriptorParameters(symbol)[ordinal];
      else {const text=sources.get(r[1]).slice(0,Number(r[2]));const prefix=text.slice(text.lastIndexOf('\n')+1);const found=prefix.match(/([\w.$]+(?:\[\])*)\s+$/)?.[1];
        if(found){const primitives={int:'I',byte:'B',short:'S',long:'J',float:'F',double:'D',char:'C',boolean:'Z'};const dimensions=(found.match(/\[\]/g)||[]).length;const base=found.replaceAll('[]','');type='['.repeat(dimensions)+(primitives[base]||'L'+base.replaceAll('.','/')+';');}}
      const stem=type?typeStem(type,aliases):'value';
      const generatedRole=original.match(/^decompiled([A-Z]\w*?)[0-9]*$/)?.[1];
      const role=generatedRole?generatedRole[0].toLowerCase()+generatedRole.slice(1):
        original.startsWith('stackIn_')?'stack'+stem[0].toUpperCase()+stem.slice(1):
        original.startsWith('incrementValue')?'previous'+stem[0].toUpperCase()+stem.slice(1):
        original.startsWith('dupTemp')?'cached'+stem[0].toUpperCase()+stem.slice(1):stem;
      add(symbol,original,explicitMembers[symbol]||role+(symbol.startsWith('P:')?'Argument':'Local')+(ordinal+1),
        explicitMembers[symbol]?'Current source operation and original-bytecode gameplay differential.':'Resolved declaration ordinal and type; cached values, stores and branch behavior are unchanged.',explicitMembers[symbol]?'reviewed':'typed');
    }
  }
  for(const [symbol,to] of Object.entries(explicitMembers))if(!declarations.some(r=>r[4]===symbol))throw new Error('Reviewed identity missing: '+symbol);
  return rules.sort((a,b)=>a.symbol<b.symbol?-1:1);
}

export function buildDekoblokoGuide(rules,mapping) {
  const names=new Map(mapping.rules.map(r=>[r.symbol,r.to]));
  const link=original=>`[${names.get('C:'+original)}](${names.get('C:'+original)}.java)`;
  return ['# Reading Deko Bloko','',
    'The Java in this directory is the single published version. Deko’s naming script rebuilds it from pinned Git input; the reverse dictionary is in `decompilation/dekobloko-naming.json`.','',
    `All ${mapping.files.length} classes have stable names. ${rules.renames.filter(r=>r.symbol.startsWith('C:')&&r.confidence==='reviewed').length} class names are reviewed semantic anchors; other class names describe the structural category and explicitly retain an unresolved finer purpose. Type-based member names are also provisional. Numbers are deterministic labels, not original obfuscated suffixes.`, '',
    '| Follow | Purpose |','| --- | --- |',
    `| ${link('client')} → ${link('qc')} | Loading, screens and active game-session coordination. |`,
    `| ${link('lk')} | Bucket cells, active domino, controls, gravity, locking and multiplayer snapshots. |`,
    `| ${link('rf')} / ${link('oi')} | Returned cooked-shape bitmaps and their cache. |`,
    `| ${link('uk')} | Animated tile-region splitting. |`,
    `| ${link('ea')} / ${link('nf')} / ${link('cf')} | Styled text layout and per-line character metrics, also used by tutorial UI. |`,
    `| ${link('jg')} / ${link('jj')} | Login credentials; static tutorial and theme-tip text. |`,
    `| ${link('sh')} / ${link('ml')} | Game assets and translated UI strings. |`,
    `| ${link('w')} / ${link('ce')} | Scene and reusable component hierarchies. |`,
    `| ${link('wl')} / ${link('uf')} / ${link('qk')} | Packet serialization, cipher buffer and socket transport. |`,
    `| ${link('hk')} / ${link('ck')} / ${link('pi')} | Software pixels and sprites. |`,'',
    '`BucketBoard.decodeMultiplayerSnapshot`, `applyControls`, `finalizePiecePlacement` and `buildCookedFeedbackShape` follow identities exercised by the existing original-bytecode differential. Follow `moveLeft`, `moveRight`, both rotation methods, `pieceCollides`, `advanceDropCountdown` and `tryDropAndReportCollision` for active-piece movement. Board dimensions, piece coordinates, countdowns, controls, lives and cell arrays have semantic names.','',
    'Compilation and symbol/override verification cover the complete game. Exact dictionary reversal verifies all input bytes. These checks do not establish whole-game runtime equivalence.',''].join('\n');
}

export function validateDekoblokoManifest(rules) {
  if(rules.schema!==1||rules.game!=='dekobloko'||rules.source.commit!==SOURCE_COMMIT||rules.renames.length<343)throw new Error('Invalid Deko naming manifest');
  for(const [file,sha] of Object.entries(rules.readabilityWorkflow.files))if(digest(fs.readFileSync(path.join(workflowRoot,file)))!==sha)throw new Error('Naming workflow changed: '+file);
  for(const item of rules.publication.evidence)if(digest(fs.readFileSync(path.resolve(workflowRoot,'..',item.file)))!==item.sha256)throw new Error('Naming evidence changed: '+item.file);
  const pin=verifyToolPin();if(JSON.stringify(rules.generators.namingTool)!==JSON.stringify(pin))throw new Error('Naming tool identity changed');
  return rules;
}

export function buildDekoblokoManifest() {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'deko-naming-rules-'));
  try {
    const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout);
    const record=catalog.publication.games.dekobloko;
    const rules={schema:1,game:'dekobloko',version:1,source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/dekobloko'},inputTreeSha256:record.sources.sha256};
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    const helper=path.join(temporary,'helper'),classes=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(classes);
    captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
    const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');fs.writeFileSync(files,sourceInventory(input).map(f=>f.path).join('\n')+'\n');
    captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,classes,stubs.jar,'--class-name-literals','--labels']);
    const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(s=>s.split('\t'));
    const mapFile=path.resolve(workflowRoot,'../docs/dekobloko-class-map.md');
    rules.renames=buildNamingRules(input,rows,fs.readFileSync(mapFile,'utf8'));
    rules.classNameLiterals={policy:'direct-owned-class-for-name',expectedEdits:rows.filter(r=>r[0]==='S'&&rules.renames.some(n=>n.symbol===r[4])).length};
    rules.labels={policy:'lexical-targets',expectedEdits:rows.filter(r=>['T','B','N'].includes(r[0])&&rules.renames.some(n=>n.symbol===r[4])).length};
    if(rows.some(r=>r[0]==='U'&&rules.renames.some(n=>n.symbol===r[4])))throw new Error('Unsupported escaped class-name literal');
    const evidence=['docs/dekobloko-class-map.md','game-logic/src/test/java/org/alterorb/dekobloko/logic/OriginalMultiplayerProtocolTest.java','readable/tests/test-dekobloko-snapshots.mjs'];
    rules.publication={stubSourceTreeSha256:stubs.sourceTreeSha256,stubJarSha256:digest(fs.readFileSync(stubs.jar)),evidence:evidence.map(file=>({file,sha256:digest(fs.readFileSync(path.resolve(workflowRoot,'..',file)))}))};
    const filesToPin=['build-dekobloko-rules.mjs','game-export.mjs','compilation-stubs.mjs','reproduce-dekobloko.mjs'];
    rules.readabilityWorkflow={repository:'Kreijstal/dekobloko-work',files:Object.fromEntries(filesToPin.map(file=>[file,digest(fs.readFileSync(path.join(workflowRoot,file)))]))};
    rules.generators={javaTools:record.sourceGenerator,namingTool:verifyToolPin()};
    return rules;
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const rules=buildDekoblokoManifest(),file=path.join(workflowRoot,'dekobloko-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';
  if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==bytes)throw new Error('Deko rules differ from deterministic regeneration');}
  else fs.writeFileSync(file,bytes);
  console.log(JSON.stringify({rules:rules.renames.length,classes:rules.renames.filter(r=>r.symbol.startsWith('C:')).length,sourceCommit:SOURCE_COMMIT,check:process.argv.includes('--check')}));
}
