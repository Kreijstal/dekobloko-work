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
  ha:['Battlefield','Owns the rectangular tile grid, unit lists, player/team state, mana and turns.'],
  jd:['Unit','Tagged fields c/o/str/max/x/y decode type, owner, strength and coordinates.'],
  ne:['MapTile','Tagged fields unit/own/type/mod decode occupant, owner, terrain and metadata.'],
  ca:['TileMetadata','Tagged fields name/mf/ownr/tag/god and MapTile metadata accessors.'],
  go:['TeamRoster','Constructor stores team name and player IDs; membership checks scan those IDs.'],
  ic:['GameplayController','Owns Battlefield, selected units, movement plans and AI planners; coordinates game input and display.'],
  nn:['MovementPlanner','Grid costs, path state and unit action packet serialization.'],
  ej:['AiPlanner','Evaluates own/enemy power, capture and summoning scores against Battlefield.'],
  ci:['TutorialController','Tutorial prompts, flashing controls and stage-indexed kr tables.'],
  oj:['GameEvent','Abstract battlefield application and gameplay presentation of unit events.'],
  st:['TurnEffectEvent','Diagnostic EventTurnEffect and strength/status changes in apply.'],
  as:['OwnerChangeEvent','EventSwitch diagnostic and Unit.b(newOwner,-1) in apply.'],
  vp:['ManaEvent','EventMana diagnostic and capped player/team mana changes in apply.'],
  ag:['CombatEvent','Diagnostic EventCombat; battle, combat, attack, damage and death records.'],
  ec:['TeleportEvent','Diagnostic EventTeleport with source and destination positions.'],
  hp:['DeathEvent','Diagnostic EventDeath and battlefield application of unit death.'],
  rt:['RevivalEvent','Application moves a defeated unit to a destination, restores maximum strength, clears poison and consumes the revival modifier.'],
  kc:['TurnChangeEvent','Diagnostic EventTurnChange with new turn and active player.'],
  kf:['GrowthEvent','Diagnostic EventGrowth with strength and owner information.'],
  kn:['TelefragEvent','Diagnostic EventTelefrag on the affected unit.'],
  kr:['MoveEvent','Diagnostic EventMove with start position and directional footsteps.'],
  mb:['SummonEvent','Diagnostic EventSummon with position, bonus and player.'],
  md:['ParasiteEvent','Diagnostic EventParasite with position, destination and owner.'],
  ns:['AttackEvent','Diagnostic EventAttack on the attacking unit.'],
  nw:['DamageEvent','Diagnostic EventDamage with damage amount and poison flag.'],
  q:['TelepopEvent','Diagnostic EventTelepop on the affected unit.'],
  qj:['UpkeepEvent','Diagnostic EventUpkeep at a unit position.'],
  qq:['StateChangeEvent','Diagnostic EventStateChange with position, effect type and player.'],
  rl:['KingBlackDragonEvent','Diagnostic EventKBD with player and King Black Dragon summon state.'],
  tr:['DeployEvent','Diagnostic EventDeploy with position and modifiers.'],
  pj:['TrinketUseEvent','Trinketused diagnostic and trinket application to the battlefield.'],
  tc:['IntrusiveNode','Two node links and unlink update both neighbours.'],
  at:['NodeDeque','Sentinel node, prepend/append, pop and bidirectional traversal.'],
  vh:['PacketBuffer','Byte payload, cursor and primitive read/write methods.'],
  bv:['CipherPacketBuffer','Extends PacketBuffer with bit cursor and ciphered opcode output.'],
  wk:['RgbSprite','Integer pixels, clipping and SoftwareRaster blits.'],
  qn:['SoftwareRaster','Shared pixel buffer, dimensions, clipping and drawing operations.'],
  ka:['BitmapFont','Glyph metrics, text width, markup parsing and drawing.'],
  uo:['TaggedFieldReader','Shared named-field decoding contract implemented by Unit, MapTile and TileMetadata.'],
};
const members = {};
function field(owner, original, descriptor, to, evidence) {
  members[`F:${owner}.field_${original}:${descriptor}`] = {to,evidence};
}
function method(owner, original, descriptor, to, evidence, parameters) {
  const key = `${owner}.${original}${descriptor}`;
  members['M:'+key] = {to,evidence};
  for (const [ordinal,name] of Object.entries(parameters || {}))
    members[`P:${key}#${ordinal}`] = {to:name,evidence};
}
for (const [original,to,type] of [
  ['v','mapWidth','I'],['db','mapHeight','I'],['Eb','tiles','[Lne;'],
  ['W','playerCount','I'],['tb','teamCount','I'],['w','teams','[Lgo;'],
  ['yb','playerTeamIndices','[I'],['lb','playerNames','[Ljava/lang/String;'],
  ['t','unitsByPlayer','[Lat;'],['k','unitObservers','Lat;'],['l','pendingEvents','Lat;'],
  ['H','playerMana','[I'],['fb','teamManaCollected','[I'],['m','remainingRuneCap','[I'],
  ['mb','playerTurnCounts','[I'],['c','chosenGods','[[I'],['E','godFavourLevels','[[I'],
  ['gb','currentPlayer','I'],['Gb','turnNumber','I'],['sb','localPlayer','I'],
  ['wb','teamGame','Z'],['hb','mapTheme','I'],['cb','mapSizeSetting','I'],['jb','randomSeed','I'],
  ['Bb','kingBlackDragonSummoned','Z'],
]) field('ha',original,type,to,'Battlefield constructor, rectangular tile indexing and seed/player/mana/turn diagnostic dump.');
for (const [original,to,type] of [
  ['J','tileX','I'],['w','tileY','I'],['N','unitType','I'],['O','ownerPlayer','I'],
  ['Y','strength','I'],['t','maximumStrength','I'],['l','battlefield','Lha;'],
  ['K','displayName','Ljava/lang/String;'],['V','movementFlags','I'],
  ['E','tag','I'],['H','objectiveId','I'],['q','tankId','I'],
  ['B','packedLowFlags','I'],['s','packedFlag4','Z'],['W','packedFlag8','Z'],
  ['I','poisoned','Z'],['F','packedFlag32','Z'],['C','packedFlag64','Z'],
  ['bb','packedFlag256','Z'],['D','packedFlag512','Z'],
]) field('jd',original,type,to,'Unit tagged decoder, constructor and h(byte) packing. Flag names describe bit positions; their gameplay meanings remain unresolved.');
members['F:jd.field_I:Z'].evidence='DamageEvent applies its diagnostic poison flag to this field; Unit.m(byte) suppresses regeneration while it is set.';
for (const [original,to,type] of [
  ['h','terrainType','I'],['c','occupant','Ljd;'],['a','ownerPlayer','I'],
  ['n','metadata','Lca;'],['d','battlefield','Lha;'],['g','godId','I'],
]) field('ne',original,type,to,'MapTile tagged decoder, constructors and god metadata accessor.');
for (const [original,to,type] of [
  ['e','displayName','Ljava/lang/String;'],['c','modifierFlags','I'],
  ['b','ownerPlayer','I'],['d','tag','I'],['g','godId','I'],
]) field('ca',original,type,to,'TileMetadata decoder keys name/mf/ownr/tag/god.');
field('go','a','[I','playerIds','TeamRoster constructor and membership scan.');
field('go','b','Ljava/lang/String;','teamName','TeamRoster constructor and name accessor.');
field('ic','xb','Lha;','battlefield','GameplayController stores and queries the current battlefield.');
field('ic','vb','Lnn;','movementPlanner','GameplayController movement overlay and path planning calls.');
field('ic','Eb','[Lej;','aiPlanners','GameplayController constructs per-player AI planners.');
field('ic','T','Ljd;','selectedUnit','Input selection and movement overlay reference the selected unit.');
field('ej','D','Lha;','battlefield','AI scoring uses tile grid, players, owners and strength.');
field('nn','r','Lha;','battlefield','Movement costs and paths index the battlefield grid.');
field('ci','a','I','tutorialStage','Indexes kr stage tables throughout the tutorial controller.');
field('oj','w','Ljd;','unit','GameEvent and its subclasses store the affected unit.');
field('st','D','I','effectType','EventTurnEffect diagnostic and apply switch.');
field('st','G','Z','applied','Apply returns if already true, then sets true before mutation.');
field('as','A','I','newOwnerPlayer','Passed to Unit.b(int,int) in event application.');
field('as','C','Z','applied','Apply returns if already true, then sets true before mutation.');
field('vp','E','I','manaPoints','EventMana diagnostic and capped mana additions.');
field('vp','C','I','playerId','EventMana diagnostic and player/team mana array indices.');
field('nw','D','I','damageAmount','EventDamage amount diagnostic and Unit.applyStrengthDamage argument.');
field('nw','A','Z','poison','EventDamage poison diagnostic and poisoned state mutation.');
field('nw','C','Z','applied','Apply returns if already true, then sets true before mutation.');
field('kc','y','I','newTurnNumber','EventTurnChange new-turn diagnostic.');
field('kc','z','I','nextPlayer','EventTurnChange player diagnostic.');
field('kr','H','I','startX','EventMove start-position diagnostic.');
field('kr','I','I','startY','EventMove start-position diagnostic.');
field('kr','B','[I','pathDirections','EventMove footsteps array and North/South/East/West debug output.');
field('ag','D','I','battleId','EventCombat battleid diagnostic.');
field('tc','b','Ltc;','next','NodeDeque forward traversal follows this link.');
field('tc','j','Ltc;','previous','Unlink updates both neighbouring links.');
field('tc','i','J','key','Intrusive collection lookup key.');
field('at','d','Ltc;','sentinel','Deque constructors and sentinel termination checks.');
field('at','e','Ltc;','traversalCursor','Deque traversal methods update this cursor.');
field('vh','o','[B','payload','Primitive reads/writes index the byte array.');
field('vh','q','I','position','Primitive reads/writes increment the byte cursor.');
field('bv','v','I','bitPosition','Bit read method advances this bit cursor.');
field('bv','w','Lha;','currentBattlefield','Shared reference used by gameplay overlays and input.');
field('bw','m','[[I','unitDefinitions','Unit queries type-indexed speed/range/flag columns; class itself also owns unrelated crypto.');
field('uc','d','[[I','spellDefinitions','AI and gameplay inspect chant type, cost and effect columns; class has other mixed helpers.');
field('ArmiesOfGielinor','M','Z','obfuscationControl','Whole-corpus opaque branch-control flag.');

method('ha','c','(IZI)Ljd;','getUnitAt','Bounds-checks y and x, then reads tiles[x+y*width].occupant.',{0:'tileY',1:'obfuscationGuard',2:'tileX'});
method('ha','c','(III)Z','arePlayersAllied','Rejects -1/255 sentinels and compares player team indices.',{0:'firstPlayer',1:'obfuscationGuard',2:'secondPlayer'});
method('ha','o','(II)I','getPlayerTeamIndex','Returns the player-to-team lookup after its original guard.',{0:'playerId',1:'obfuscationGuard'});
method('ha','d','(II)Lgo;','getPlayerTeam','Returns teams[playerTeamIndices[player]].',{0:'playerId',1:'obfuscationGuard'});
method('ha','a','(ILjd;)V','registerUnit','Adds to the owner deque and notifies mm observers.',{0:'obfuscationGuard',1:'unit'});
method('ha','b','(BIII)V','setTerrainType','Writes tile terrain and marks it dirty.',{0:'obfuscationGuard',1:'terrainType',2:'tileX',3:'tileY'});
method('ha','j','(II)Ljava/lang/String;','describeBattlefield','Dumps seed, map settings, players, tiles and units.',{0:'playerId',1:'obfuscationGuard'});
method('ha','a','(ILgn;I)V','appendPlayerDiagnostics','Labels mana, collected mana, turns, gods, favour and rune cap.',{0:'playerId',1:'output',2:'obfuscationGuard'});
method('ha','a','(BIII)V','healOrRaiseSkeletonAt','Heals allied type-20 unit or creates type-20 unit on a marked corpse tile.',{0:'obfuscationGuard',1:'playerId',2:'tileY',3:'tileX'});
method('jd','h','(B)I','packStatusFlags','Reconstructs the constructor bit positions and low two bits.',{0:'obfuscationGuard'});
method('jd','c','(Z)Z','hasMovementFlag1','Tests movementFlags bit 1; retains original guard side effect.',{0:'obfuscationGuard'});
method('jd','a','(IZ)V','applyStrengthDamage','Subtracts strength or consumes protective equipment charges, then optionally updates the unit.',{0:'damage',1:'updateAfterDamage'});
method('jd','a','(B)V','refreshTileEffects','Delegates to Battlefield.a(Unit,int).',{0:'obfuscationGuard'});
method('jd','b','(II)Ljd;','replaceWithOwner','Removes the old unit, copies its state under the new owner and registers the replacement.',{0:'newOwnerPlayer',1:'obfuscationGuard'});
method('jd','e','(I)V','removeFromBattlefield','Clears the occupied tile, unlinks the unit and updates tile effects.',{0:'obfuscationGuard'});
method('jd','w','(I)V','queueDeathOrRevival','Checks effective strength, then queues a revival destination or a death event.',{0:'obfuscationGuard'});
method('jd','m','(B)V','refreshForTurnChange','Called before current-player changes; queues eligible regeneration, decrements a countdown and resets movement/status flags.',{0:'obfuscationGuard'});
method('ha','a','(ZII)V','applyTurnChange','Refreshes the previous player units and sets the incoming player and turn number.',{0:'obfuscationGuard',1:'nextPlayer',2:'turnNumber'});
method('go','c','(I)I','getPlayerCount','Returns playerIds.length.',{0:'obfuscationGuard'});
method('go','a','(IB)Z','containsPlayer','Scans playerIds for equality.',{0:'playerId',1:'obfuscationGuard'});
method('go','d','(I)Ljava/lang/String;','getTeamName','Returns the constructor-supplied team name.',{0:'obfuscationGuard'});
method('ne','f','(B)Ljava/lang/String;','getDisplayName','Uses metadata name or terrain text with a modifier suffix.',{0:'obfuscationGuard'});
method('ne','b','(B)I','getExplicitOwner','Checks metadata flag 16, returns -1 for missing or 255 owner.',{0:'obfuscationGuard'});
method('ne','a','(B)I','getTag','Returns metadata tag or zero.',{0:'obfuscationGuard'});
method('ne','a','(ZI)V','setTag','Creates metadata and writes its tag.',{0:'obfuscationGuard',1:'tag'});
method('ne','b','(ZI)V','setExplicitOwner','Stores owner and sets metadata flag 16.',{0:'obfuscationGuard',1:'ownerPlayer'});
method('ne','a','(IB)Z','isAlliedToPlayer','Delegates tile owner comparison to Battlefield.arePlayersAllied.',{0:'playerId',1:'obfuscationGuard'});
method('ne','c','(B)Z','hasExplicitOwner','Tests metadata modifier bit 16.',{0:'obfuscationGuard'});
method('ne','k','(I)Z','hasModifierFlag1','Tests metadata modifier bit 1; meaning unresolved.',{0:'obfuscationGuard'});
method('ne','h','(I)Z','hasModifierFlag2','Tests metadata modifier bit 2; meaning unresolved.',{0:'obfuscationGuard'});
method('ne','e','(B)Z','hasModifierFlag4','Tests metadata modifier bit 4; meaning unresolved.',{0:'obfuscationGuard'});
method('ne','c','(I)Z','hasCorpse','Tests modifier bit 8 consumed by the skeleton-raising path.',{0:'obfuscationGuard'});
method('ne','i','(I)V','clearCorpse','Clears modifier bit 8 after skeleton creation.',{0:'obfuscationGuard'});
method('uo','a','(ILbv;Ljava/lang/String;B)V','decodeTaggedField','Shared decoder dispatches named fields while preserving the interface contract.',{0:'encodedLength',1:'packet',2:'fieldName',3:'obfuscationGuard'});
method('oj','a','(Lha;I)V','applyToBattlefield','Abstract application contract propagated to every event subclass.',{0:'battlefield',1:'obfuscationGuard'});
method('oj','a','(BZ)Ljava/lang/String;','describeEvent','Abstract diagnostic contract propagated to event subclasses.',{0:'obfuscationGuard',1:'verbose'});
method('tc','d','(I)V','unlink','Updates neighbouring links and clears this node links.',{0:'obfuscationGuard'});
method('at','e','(B)Ltc;','first','Returns the first node and primes forward traversal.',{0:'obfuscationGuard'});
method('at','a','(B)Ltc;','next','Continues traversal through node links.',{0:'obfuscationGuard'});

export function buildArmiesRules(input, rows) {
  const declarations = rows.filter(row=>row[0]==='D');
  const declared = new Map(declarations.map(row=>[row[4],row]));
  const rules = new Map();
  const add = (symbol,to,evidence,confidence='reviewed') => {
    const row=declared.get(symbol);
    if(!row) throw new Error('Reviewed identity missing: '+symbol);
    if(row[5]!==to) rules.set(symbol,{symbol,originalName:row[5],to,evidence,confidence});
  };
  for(const [owner,[to,evidence]] of Object.entries(classes)) add('C:'+owner,to,`${owner}.java: ${evidence}`);
  for(const [symbol,{to,evidence}] of Object.entries(members)) add(symbol,to,`${symbol.slice(2).split('.')[0]}.java: ${evidence}`);
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
  for(const source of sources.values()) {
    const event=source.match(/\bclass\s+(\w+)\s+extends\s+oj\b/)?.[1];
    if(event&&!classes[event]) throw new Error('Unreviewed gameplay event: '+event);
  }
  for(const row of rows.filter(row=>row[0]==='T')) {
    const suffix=sources.get(row[1]).slice(Number(row[3]));
    const loop=/^\s*:\s*(?:while|for|do)\b/.test(suffix);
    const ordinal=Number(row[4].slice(row[4].lastIndexOf('#')+1))+1;
    rules.set(row[4],{symbol:row[4],originalName:row[5],to:(loop?'scanLoop':'regionExit')+ordinal,
      evidence:'Resolved lexical target and declaration ordinal; transfers are unchanged.',confidence:'structural'});
  }
  return [...rules.values()].sort((a,b)=>a.symbol<b.symbol?-1:1);
}

const workflowFiles=['build-armiesofgielinor-rules.mjs','reproduce-armiesofgielinor.mjs',
  'tests/test-armiesofgielinor-core.mjs','game-export.mjs','compilation-stubs.mjs'];
export function validateArmiesManifest(rules) {
  if(rules.schema!==1||rules.game!=='armiesofgielinor'||rules.source.commit!==SOURCE_COMMIT) throw new Error('Invalid Armies naming manifest');
  for(const [file,sha] of Object.entries(rules.readabilityWorkflow.files))
    if(digest(fs.readFileSync(path.join(workflowRoot,file)))!==sha) throw new Error('Naming workflow changed: '+file);
  if(JSON.stringify(rules.generators.namingTool)!==JSON.stringify(verifyToolPin())) throw new Error('Naming tool identity changed');
}
export function buildArmiesGuide(rules,mapping) {
  const link=owner=>`[${classes[owner][0]}](${classes[owner][0]}.java)`;
  return ['# Reading Armies of Gielinor','',
    'Java here is the single published version. Rebuild from pinned raw Git input using Deko’s `readable/reproduce-armiesofgielinor.mjs`. The current reverse dictionary is `../../decompilation/armiesofgielinor-naming.json`.','',
    `This first gameplay pass reviews ${Object.keys(classes).length} class identities across all ${mapping.files.length} compiled classes. Other class/member names remain unresolved. Unresolved packed flags use bit-position names without guessing gameplay effects. Renamed identifiers have no opaque suffixes; the dictionary records their original identities.`, '',
    '| Start here | Follow |','| --- | --- |',
    `| ${link('ha')} | Map geometry, player/team state, mana, turns, god favour and unit/event collections. |`,
    `| ${link('jd')} / ${link('ne')} / ${link('ca')} | Unit coordinates and strength; tile occupants, terrain, owners and tagged metadata. |`,
    `| ${link('go')} | Team membership and player lists. |`,
    `| ${link('ic')} → ${link('nn')} / ${link('ej')} | Gameplay coordination, movement planning and AI evaluation. |`,
    `| ${link('oj')} → ${link('st')} / ${link('as')} / ${link('vp')} | Event application, turn effects, ownership changes and mana. |`,
    `| ${link('kr')} / ${link('ns')} / ${link('ag')} / ${link('nw')} / ${link('hp')} | Movement, attacks, combat records, damage/poison and death. |`,
    `| ${link('mb')} / ${link('ec')} / ${link('kn')} / ${link('q')} / ${link('qq')} | Summoning, teleport variants and state changes. Event names follow their own diagnostic text. |`,
    `| ${link('rt')} / ${link('pj')} / ${link('kc')} | Revival, trinket use and turn changes. All 21 concrete GameEvent subclasses have reviewed names. |`,
    `| ${link('ci')} | Tutorial stages, prompts and flashing controls. |`,
    `| ${link('vh')} / ${link('bv')} / ${link('uo')} | Packet data, ciphered opcodes and tagged-field decoding. |`, '',
    'Start with `Battlefield.getUnitAt`, `arePlayersAllied`, `registerUnit` and `Unit.applyStrengthDamage`. Grid indexing is `tileX + tileY * mapWidth`; `getUnitAt` keeps the original argument order (y, guard, x). Dummy guards and their side effects remain intact. `GameEvent.applyToBattlefield` names the complete resolved override family.','',
    'The naming pass changes identifiers and lexical labels, not control flow. Three files still retain compiler dispatcher fallbacks, and large methods remain. More semantic work is needed in combat, spells, AI, tutorial stages and multiplayer packet handling.','',
    'The exporter compiles both complete corpora and verifies bindings/overrides. A headless raw-versus-named probe checks rectangular map lookup, team membership, unit flags/damage and tile metadata against independent expectations. It bypasses battlefield construction and the Applet graph; it does not establish whole-game playability, AI quality or server compatibility. Exact dictionary reversal recovers every original source byte.',''].join('\n');
}
export function buildArmiesManifest() {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'armies-naming-rules-'));
  try {
    const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout);
    const record=catalog.publication.games.armiesofgielinor;
    const rules={schema:1,game:'armiesofgielinor',version:1,
      source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/armiesofgielinor'},inputTreeSha256:record.sources.sha256};
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    const helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
    captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
    const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');
    fs.writeFileSync(files,sourceInventory(input).map(file=>file.path).join('\n')+'\n');
    captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);
    const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(line=>line.split('\t'));
    rules.renames=buildArmiesRules(input,rows);
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
    const rules=buildArmiesManifest(),file=path.join(workflowRoot,'armiesofgielinor-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';
    if(process.argv.includes('--check')) {if(fs.readFileSync(file,'utf8')!==bytes) throw new Error('Armies rules differ from regeneration');}
    else fs.writeFileSync(file,bytes);
    console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));
  } catch(error) {console.error(error.stderr?.toString()||error.message);process.exitCode=1;}
}
