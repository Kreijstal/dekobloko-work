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
  pj:['SpellCastEvent','Legacy Trinketused diagnostic; dispatches Spell.applyEffect and battlefield spell-cost handling.'],
  ik:['Spell','Abstract spell ID, payload size/serialization and effect lifecycle; concrete implementations read spellDefinitions.'],
  wa:['UnitSpell','Stores target tile coordinates and dispatches spell-table effects on the target unit.'],
  ra:['ActionSpell','Spell modifier wrapping an ActionRequest; prepares its action and applies it on spell completion.'],
  al:['GlobalSpell','Spell-table dispatch for effects that do not carry target coordinates.'],
  mn:['ActionRequest','Abstract preparation contract shared by movement, summoning, deployment, spell casts and Sphinx-assisted actions.'],
  bd:['PreparedAction','Prepared battlefield action; implementations queue events or represent turn-condition markers.'],
  am:['MoveAttackRequest','Decodes packed paths and signed target deltas; validates movement, attacks, vine growth and teleportation.'],
  hw:['SummonRequest','Checks chosen gods, tile summoning permissions and affordability, then prepares a SummonAction.'],
  jc:['DeployRequest','Checks ownership, movement-spent state, deploy capability and terrain before preparing a DeployAction.'],
  to:['SpellCastRequest','Prepares a Spell then creates the action that queues its SpellCastEvent.'],
  ee:['SphinxActionRequest','Checks a type-72 Sphinx has an attack remaining, then prepares its delegated action with ownership bypass.'],
  ld:['MoveAttackAction','Copies path directions, computes attack origin and queues MoveEvent and optional AttackEvent.'],
  be:['SummonAction','Recomputes summoning bonus and queues SummonEvent.'],
  pl:['DeployAction','Queues DeathEvent for vine type 39 or DeployEvent for supported deployable units.'],
  ua:['SpellCastAction','Queues SpellCastEvent with spell, selection mode and casting player.'],
  pe:['VineGrowthAction','Queues GrowthEvent with destination, origin, strength and acting player.'],
  ur:['TeleportAction','Queues TeleportEvent with live unit source position, signed target deltas and destination-placement mode.'],
  il:['DisplacedUnitMarker','Created during turn preparation for displaced units; canonical application has no battlefield mutation.'],
  ss:['StateChangeMarker','Turn preparation creates this instead of StateChangeEvent in its marker branch; canonical application is a no-op.'],
  dk:['CorpseConditionMarker','Turn preparation creates this for type-10 units on corpse tiles with maximum strength 19; player flag 1024.'],
  kj:['SkeletonLimitMarker','Turn preparation creates this when at least 25 type-20 skeletons remain; player flag 8192.'],
  pa:['EventPresentation','Shared initialization, frame advancement, drawing and completion contract for four event presentations.'],
  vb:['EventPresenter','Selects a presentation from event kind, advances it, acknowledges completion and guards against stalled presentations.'],
  sk:['CombatPresentation','Full combat scene with attacker/defender characters, combat phases and camera transition.'],
  qv:['MovementPresentation','Interpolates movement paths and parasite movement while updating unit presentation coordinates.'],
  tb:['EffectPresentation','Unit/map effects for death, summoning, growth, teleportation and deployment.'],
  ql:['PopupPresentation','Short-lived overlays for damage, ownership, spell and status feedback.'],
  lf:['BattleCharacter','Own BattleCharacter diagnostic; animated combat character model, current/destination coordinates and animation state.'],
  v:['BattleCamera','Map focus, projected screen coordinates and smoothly interpolated camera position.'],
  sr:['CombatViewTransition','Interpolates the camera/display transition with a 0..256 completion factor.'],
  gd:['ModelMesh','Vertex/face arrays and transformed mesh used by combat characters.'],
  mm:['UnitObserver','Callback notified when Battlefield registers a unit; AiPlanner updates its unit-planner list.'],
  cl:['AiUnitPlanner','Scores movement/attack choices for one unit, orders unit decisions and executes the selected candidate.'],
  jb:['AiActionCandidate','Movement/attack/spell target coordinates, score and execution result for an AI choice.'],
  sm:['AiPlanningStrategy','Candidate queue/pool with interchangeable action selection strategies.'],
  aw:['BestScoreStrategy','Retains the highest-score candidate; equal scores retain the previous choice.'],
  ge:['WeightedScoreStrategy','Samples candidates using fourth-power normalized score weights.'],
  ir:['AiInfluenceMap','Tile cost propagation and distance-weighted power/influence accumulation.'],
  id:['CampaignUnitOverride','Instance data override unit type/name/strength when AiPlanner registers a campaign unit; static helpers also load assets.'],
  vn:['CombatSandbox','Own Attacker/Defender/Run Attack controls and six selectors; runs a standalone combat presentation.'],
  fi:['UnitInfoPopup','Owns one unit popup, layout coordinates, fade animation and scrolling unit-name feedback; static helpers also generate terrain.'],
  lv:['MatchCondition','Victory/defeat predicate and diagnostic-description contract shared by three concrete match conditions.'],
  tt:['MatchConditionRegistry','Per-player condition deques, any-victory/any-defeat checks and selective portal-loss removal.'],
  u:['MatchConditionEntry','Intrusive node wrapping one MatchCondition; static helpers also handle common client messages.'],
  up:['PortalLossCondition','Own Defeat: Total Portal Loss diagnostic; requires no usable portal and no possible capturing unit. Static fields also contain tutorial text.'],
  mc:['UnitLossCondition','Own Defeat: Total Unit Loss diagnostic; checks allied units and usable portals, with campaign restrictions.'],
  gm:['LeaderEscortCondition','Own Win: Leader Escort diagnostic; succeeds when every tracked leader has reached its goal.'],
  om:['CampaignMission','Tagged campaign mission identity, metadata, player slots and lazy map loading.'],
  lo:['MapLayout','Map format version, dimensions, terrain decoding, saved units and tagged map items.'],
  sc:['TaggedMapData','Tagged nump/w/h/them/map fields decode player count, dimensions, theme and tile objects for version-2 maps.'],
  mt:['TextCursor','Instance owns a string, character position and end test; static helpers also decode short tagged-field names.'],
  bb:['NodeIterator','Independent forward/reverse deque traversal, preserving a cursor while nodes unlink.'],
  ga:['IsaacRandom','256-word ISAAC state, golden-ratio seed mixing and opcode cipher output.'],
  bo:['TutorialLayout','Five 29-entry arrays store stage positions and spacing; accessors center coordinates on a 640 by 480 reference surface. Static helpers also decode spells.'],
  dl:['UiSelectionState','Shared tutorial/menu selection, keyboard input, pointer press state and repeat countdown; also used outside the tutorial.'],
  rg:['SpellMenuGroup','Nested spell-menu groups with icons, labels, descriptions, parent/child indices and leaf spell-ID lists.'],
  dm:['MatchSetupPanel','Tutorial stage-5 match options: player counts, map size, preview choices, item labels and per-item geometry.'],
  rk:['InstructionsPanel','Tutorial stage-7 instruction pages, text tables, illustrative unit previews and navigation/footer geometry.'],
  ft:['IntPair','Two integer components used as both positions and dimensions by panel layout helpers; retains its intrusive-node links and unrelated static helpers.'],
  em:['TickCounter','Instance counts calls up to a limit and resets; unrelated static methods load client assets and handle client messages.'],
  hh:['TrianglePulse','Interpolates an integer pulse over two halves of a TickCounter period, with original byte-range defaults/clamps.'],
  qb:['AnimationSequence','Opcode-decoded packed frame IDs, durations, loop start/count and additional retained sequence data.'],
  vj:['AnimationPlayer','Current sequence/frame/countdown with an optional delayed ring of sequence slots.'],
  hr:['UnitModelPreview','Unit-model selection, yaw, screen position, animation player and projection used by instruction illustrations.'],
  hm:['PlayerProfile','Versioned spell quantities, five equipped spell IDs, seven unit-unlock masks, rune accounting and campaign progress.'],
  cm:['CampaignProgress','Three campaign result tables with 64 mission slots, versioned decoding, result updates and score aggregation.'],
  ho:['CampaignResult','Own diagnostic names turnsTaken and damageTaken; consumed by campaign scoring.'],
  cf:['CampaignDefinition','Named campaign container with mission and participant tables, archive index and local-player label.'],
  sd:['CampaignParticipant','Campaign participant ID/name/coat and shared unit-override array with an append count.'],
  ln:['CoatOfArms','Six part choices and colour indices, coat query string, layer setters and drawing helpers.'],
  cv:['CampaignMenu','Campaign cards, mission-map entries, score updates, selection and quicksave dialogs.'],
  cq:['CampaignMenuEntry','Shared campaign/mission/quicksave entry with title, bounds, availability, score and preview sprites.'],
  iq:['CampaignMenuButton','Fixed-height labeled button with centered coordinates, pointer hit testing and drawing.'],
  bg:['NodeHashTable','Intrusive sentinel buckets with key lookup, traversal, insertion and clearing.'],
  fu:['CampaignRewardPreview','Displays the first unlocked unit, a spell or a mana bonus using the existing reward precedence.'],
  g:['ContextualRuntimeException','Stores the original throwable in its own field and accumulates a context string; it does not initialize the standard Java cause.'],
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
function constructorParameters(owner,descriptor,names,evidence) {
  for(const [ordinal,to] of Object.entries(names))members[`P:${owner}.<init>${descriptor}#${ordinal}`]={to,evidence};
}
function local(owner,signature,ordinal,originalName,to,evidence) {
  members[`L:${owner}.${signature}#${ordinal}`]={to,evidence,expectedOriginalName:originalName};
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
  ['B','attacksRemaining','I'],['s','movementSpent','Z'],['W','packedFlag8','Z'],
  ['I','poisoned','Z'],['F','packedFlag32','Z'],['C','meleeLifeSteal','Z'],
  ['bb','packedFlag256','Z'],['D','packedFlag512','Z'],
]) field('jd',original,type,to,'Unit tagged decoder, constructor and h(byte) packing. Flag names describe bit positions; their gameplay meanings remain unresolved.');
members['F:jd.field_I:Z'].evidence='DamageEvent applies its diagnostic poison flag to this field; Unit.m(byte) suppresses regeneration while it is set.';
members['F:jd.field_B:I'].evidence='Battlefield combat application decrements this attack count; turn refresh restores one or two attacks independently of the movement-spent flag.';
members['F:jd.field_s:Z'].evidence='MoveEvent sets this flag after moving; MovementPlanner rejects spent movement and Unit turn refresh resets it.';
members['F:jd.field_C:Z'].evidence='UnitSpell ID 120 sets this flag. Melee combat queues one healing event per damage point dealt while it is set.';
for(const [original,to,type] of [
  ['A','bonusStrength','I'],['r','equipmentDescriptor','I'],['ab','accessoryType','I'],
  ['P','statusEffectType','I'],['o','statusEffectValue','I'],['cb','immobilizedTurns','I'],
  ['fb','facingAngle','I'],['db','movementTargetX','I'],['k','movementTargetY','I'],
  ['m','attacksMade','I'],['M','attacksReceived','I'],
]) field('jd',original,type,to,'Unit getters/constructors, spell effect assignments, combat counters and facing/movement target operations.');
members['F:jd.field_P:I'].evidence='UnitSpell assigns spellDefinitions[id][5]; this is spell status, separate from the equipmentDescriptor field.';
members['F:jd.field_o:I'].evidence='UnitSpell assigns spellDefinitions[id][6]; protective statuses consume this value as charges, other statuses use its magnitude.';
members['F:jd.field_cb:I'].evidence='Immobilizing spell kind 21 increments this counter, spends movement/attacks and caps it at 100; turn refresh decrements it.';
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
for(const [original,to,type] of [
  ['Q','attackerX','I'],['G','attackerY','I'],['F','targetDeltaX','I'],['B','targetDeltaY','I'],
  ['K','attackerDamage','I'],['R','defenderDamage','I'],['N','attackerDies','Z'],['M','defenderDies','Z'],
  ['H','attackerAnimationCount','I'],['y','defenderAnimationCount','I'],
  ['J','attackerDeployed','Z'],['E','defenderDeployed','Z'],['z','unseenUnitType','I'],
]) field('ag',original,type,to,'CombatEvent debug labels explicitly identify attacker position, target offset, damage, death, animation counts and deployment.');
for(const [owner,items] of Object.entries({
  kr:[['A','applied','Z']],
  ns:[['J','applied','Z'],['N','targetUnit','Ljd;'],['z','targetDeltaX','I'],['H','targetDeltaY','I'],['C','attackerAnimationCount','I'],['Q','defenderAnimationCount','I']],
  mb:[['E','applied','Z'],['z','tileX','I'],['H','tileY','I'],['D','playerId','I'],['I','strengthBonus','I'],['A','unitType','I']],
  qq:[['C','applied','Z'],['I','tileX','I'],['J','tileY','I'],['F','effectType','I'],['G','playerId','I']],
  ec:[['C','applied','Z'],['A','sourceX','I'],['B','sourceY','I'],['z','targetDeltaX','I'],['y','targetDeltaY','I']],
  rt:[['y','destinationX','I'],['C','destinationY','I']],
  kf:[['H','tileX','I'],['F','tileY','I'],['J','originX','I'],['y','originY','I'],['z','strength','I'],['C','playerId','I'],['A','applied','Z']],
  tr:[['E','tileX','I'],['D','tileY','I'],['B','modifiers','I']],
})) for(const [original,to,type] of items)field(owner,original,type,to,'Event constructors, position/debug labels and battlefield application/one-time guards.');
field('ik','c','I','spellId','Every concrete spell indexes spellDefinitions with this ID and writes it as a big-endian short.');
field('wa','g','I','targetX','UnitSpell constructor and serialization write target X before target Y.');
field('wa','f','I','targetY','UnitSpell constructor and target-unit lookup.');
field('ra','g','Lmn;','request','ActionSpell prepares this wrapped action request.');
field('ra','h','Lbd;','preparedAction','Spell preparation creates this action; completion applies it and releases the reference.');
field('pj','B','Lik;','spell','SpellCastEvent dispatches the spell-table based effect.');
field('pj','C','Z','applied','Spell cast application is guarded against repeated mutation.');
field('pj','z','I','castingPlayer','Passed to Spell.applyEffect and battlefield spell accounting.');
for(const [original,to,type] of [
  ['x','mapWidth','I'],['A','mapHeight','I'],['i','unit','Ljd;'],['d','unitType','I'],
  ['o','actingPlayer','I'],['p','spellId','I'],['h','pathDirections','[I'],['m','pathLength','I'],
  ['q','movementCosts','[I'],['n','targetX','I'],['b','targetY','I'],['l','targetDeltaX','I'],
  ['j','targetDeltaY','I'],['t','directAction','Z'],['u','actionAllowed','Z'],
]) field('nn',original,type,to,'MovementPlanner constructor, path reconstruction, action selection and serialized movement packet fields.');
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
field('oj','m','I','eventKind','EventPresenter dispatch selects concrete presentation classes by this numeric event kind.');
field('oj','s','I','pendingPresentations','Acknowledgement decrements this count; event completes when it reaches zero.');
field('oj','o','Z','presentationComplete','Set when the outstanding presentation count is exhausted.');
for(const [original,to,type] of [
  ['k','battlefield','Lha;'],['y','controller','Lic;'],['r','event','Loj;'],['B','presentation','Lpa;'],
  ['p','elapsedFrames','I'],['s','acknowledged','Z'],['n','presentationActive','Z'],
  ['z','fullCombatScene','Z'],['m','screenX','I'],['v','screenY','I'],['x','tileIndex','I'],
])field('vb',original,type,to,'EventPresenter constructors, dispatch, render delegates and completion/1000-frame timeout path.');
for(const [owner,items] of Object.entries({
  sk:[['x','battlefield','Lha;'],['k','presenter','Lvb;'],['B','camera','Lv;'],['n','phase','I'],['F','phaseFrame','I'],['r','mapWidth','I'],['H','framebuffer','Lwk;'],['i','defenders','[Llf;'],['s','attackers','[Llf;']],
  qv:[['o','battlefield','Lha;'],['q','presenter','Lvb;'],['v','camera','Lv;'],['u','elapsedFrames','I'],['s','durationFrames','I'],['p','pathLength','I'],['h','pathDirections','[I'],['w','pathIndex','I']],
  tb:[['c','battlefield','Lha;'],['f','presenter','Lvb;'],['i','camera','Lv;'],['l','finished','Z'],['m','mapWidth','I']],
  ql:[['o','battlefield','Lha;'],['b','presenter','Lvb;'],['k','camera','Lv;'],['h','elapsedFrames','I'],['d','unit','Ljd;']],
}))for(const [original,to,type] of items)field(owner,original,type,to,'Presentation constructor bindings and frame/drawing/completion data flow.');
for(const [original,to,type] of [
  ['j','currentX','I'],['p','currentY','I'],['a','destinationX','I'],['s','destinationY','I'],
  ['C','unitType','I'],['G','modelIndex','I'],['A','model','Lgd;'],['D','animationState','I'],
  ['f','animationFrame','I'],['m','animationDelay','I'],
])field('lf',original,type,to,'BattleCharacter constructor and idle/arrival tests. Model variants may differ from the logical unit type.');
field('sr','n','I','transitionFactor','Combat view readiness tests factor 256; transition updates interpolate it.');
field('sr','k','Lv;','camera','CombatPresentation creates and updates the transition for this camera.');
for(const [original,to,type] of [
  ['p','currentPosition','[I'],['k','targetPosition','[I'],['l','velocity','[I'],['d','focusedPresenter','Lvb;'],
])field('v',original,type,to,'Camera smoothing moves currentPosition toward targetPosition with the per-axis velocity.');
field('ic','M','Lv;','camera','Shared camera passed to every concrete event presentation.');
field('ic','pc','Lat;','eventPresenters','GameplayController iterates active event presenters for update/drawing.');
field('jd','p','Lcl;','aiPlanner','AiUnitPlanner constructor associates its planner with the unit.');
for(const [original,to,type] of [
  ['z','playerId','I'],['P','weights','[F'],['u','campaignOverrides','[Lid;'],['p','unitPlanners','Lat;'],
  ['U','actionMovement','Lnn;'],['l','evaluationMovement','Lnn;'],['m','influenceMap','Lir;'],
  ['Q','bestScoreStrategy','Lsm;'],['F','weightedScoreStrategy','Lsm;'],['J','currentUnitPlanner','Lcl;'],
  ['N','tileEvaluationCache','[F'],['I','objectiveInfluence','[[[F'],
])field('ej',original,type,to,'AI constructor and unit/candidate evaluation; numeric weight and influence-channel meanings remain partly unresolved.');
for(const [original,to,type] of [
  ['r','planner','Lej;'],['o','unit','Ljd;'],['k','selectedAction','Ljb;'],['l','selectedTarget','Ljd;'],['y','decisionPriority','I'],
])field('cl',original,type,to,'Per-unit AI construction, candidate scoring, target lookup and decision comparator.');
for(const [original,to,type] of [
  ['s','destinationX','I'],['q','destinationY','I'],['k','targetX','I'],['o','targetY','I'],
  ['m','summoningPlayer','I'],['l','summonUnitType','I'],['r','executionResult','I'],['t','score','F'],
])field('jb',original,type,to,'Candidate reset and execution: destination path/target deltas for movement; summoning mode passes player and unit type to SummonRequest.');
field('sm','a','Lat;','candidates','Strategy submission and selection traverse this candidate deque.');
field('sm','f','Lat;','recycledCandidates','Strategy reset transfers previous candidates into the reuse pool.');
field('ge','k','F','minimumScore','Tracks the smallest submitted score and normalizes sampling weights.');
field('ge','j','F','totalWeight','Sums fourth-power sampling weights before drawing a random threshold.');
field('ge','l','I','candidateCount','Sampling diagnostic reports this candidate count.');
for(const [original,to,type] of [
  ['a','mapWidth','I'],['g','mapHeight','I'],['m','tiles','[Lne;'],['i','packedCosts','[I'],
  ['b','minimumY','I'],['n','maximumY','I'],['e','minimumX','I'],['c','maximumX','I'],
])field('ir',original,type,to,'Influence-map constructor and bounded row/column cost propagation loops.');
field('id','a','I','unitType','AiPlanner matches overrides by unit type.');
field('id','b','I','strength','Positive override strengths replace both maximum/current unit strength.');
field('id','e','Ljava/lang/String;','displayName','AI unit registration applies the override display name.');

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

method('ha','a','(IIZIIIZIII)V','queueCombatConsequences','CombatEvent supplies attacker coordinates, target offset, death flags and paired damage. Queues healing/growth/damage and consumes one attack.',
  {0:'attackerY',1:'targetDeltaX',2:'attackerDies',3:'attackerX',4:'targetDeltaY',5:'obfuscationGuard',6:'defenderDies',7:'attackerDamage',8:'defenderDamage',9:'unseenUnitType'});
for(const [ordinal,originalName,to] of [
  [37,'var12','defender'],[38,'var13','attackDistance'],[39,'var14','attackerEquipmentPoisons'],
  [40,'var15','defenderEquipmentPoisons'],[41,'var16','meleeAttack'],[42,'var17','guardQuotient'],
  [43,'var18','defenderHealingIndex'],[44,'var19','obfuscationControlSnapshot'],[45,'var20','attackerLookup'],
  [46,'var21','attacker'],[59,'var18Lifetime1','campaignKillMarker'],[60,'var18Lifetime2','attackerHealingIndex'],
])local('ha','a(IIZIIIZIII)V',ordinal,originalName,to,'Combat consequence data flow from attacker/defender lookup through poison, healing and campaign counters.');
constructorParameters('ag','(IIIIIIIZZIIZZI)V',['unseenUnitType','attackerX','attackerY','targetDeltaX','targetDeltaY','attackerDamage','defenderDamage','attackerDies','defenderDies','attackerAnimationCount','defenderAnimationCount','attackerDeployed','defenderDeployed','battleId'],'CombatEvent constructor assignments and labelled diagnostic fields.');
constructorParameters('kr','(II[I)V',['startX','startY','pathDirections'],'MoveEvent constructor and labelled path diagnostic.');
constructorParameters('jd','(III)V',['tileX','tileY','unitType'],'Unit constructor stores tile coordinates and type.');
constructorParameters('jd','(IIIIIIIIILha;IIIZI)V',['tileX','tileY','unitType','ownerPlayer','maximumStrength','strength','packedStatusFlags','accessoryType','bonusStrength','battlefield','statusEffectType','statusEffectValue','equipmentDescriptor','detached','immobilizedTurns'],'Unit full constructor field assignments and detached tile-installation guard.');
method('jd','g','(B)I','getEffectiveStrength','Adds temporary bonus strength to current strength.',{0:'obfuscationGuard'});
method('jd','g','(I)I','getUnitCategory','Returns definition column zero; category encoding remains numeric.',{0:'obfuscationGuard'});
method('jd','l','(B)I','getMinimumAttackRange','Definition column six with deployed dwarf-cannon override.',{0:'obfuscationGuard'});
method('jd','B','(I)I','getMaximumAttackRange','Definition column seven adjusted by equipment category/properties.',{0:'obfuscationGuard'});
method('jd','j','(I)I','getEquipmentCategory','Extracts the high bits of equipmentDescriptor or returns -1.',{0:'obfuscationGuard'});
method('jd','c','(B)I','getEquipmentId','Extracts the low five equipment bits or returns zero.',{0:'obfuscationGuard'});
method('jd','d','(II)I','getEquipmentProperty','Reads the selected property of the equipment table row.',{0:'propertyIndex',1:'obfuscationGuard'});
method('jd','e','(II)V','setFacingAngle','Sets valid 0..2047 orientation and updates the visual actor when present.',{0:'obfuscationGuard',1:'angle'});
method('jd','a','(Ljd;I)V','faceUnit','Faces another unit using its relative position.',{0:'targetUnit',1:'obfuscationGuard'});
method('jd','b','(Z)Ljd;','copyDetached','Copies full unit state without installing the copy on the tile.',{0:'obfuscationGuard'});
method('jd','o','(I)Z','hasMovementTarget','Clears a reached target and tests stored target coordinates.',{0:'obfuscationGuard'});
method('jd','A','(I)V','resetMovementTarget','Writes target X and clears target Y; retains original sentinel argument.',{0:'targetX'});
method('jd','y','(I)Z','hasPoisonousAttacks','Tests definition flag 64 used by combat damage poison propagation.',{0:'obfuscationGuard'});
method('jd','r','(I)Z','grantsGrowthOnDeath','Excludes the summoned jade-vine type from combat kill-growth rewards.',{0:'obfuscationGuard'});
method('jd','t','(I)Z','isDisplacedFromTile','Tests whether the unit differs from its tile occupant.',{0:'obfuscationGuard'});
method('ik','a','(I)I','getPayloadSize','Unit spells serialize four bytes; global/action spells serialize two.',{0:'obfuscationGuard'});
method('ik','a','(ILvh;)V','writePayload','Serializes spell ID and optional coordinates; propagates through all concrete spell implementations.',{0:'obfuscationGuard',1:'packet'});
method('ik','a','(ILha;I)V','applyEffect','Concrete spell dispatch using casting player and spell definition.',{0:'castingPlayer',1:'battlefield',2:'obfuscationGuard'});
method('ik','a','(BLha;)V','prepareEffect','ActionSpell prepares its wrapped action before spell application.',{0:'obfuscationGuard',1:'battlefield'});
method('ik','a','(Lha;I)V','finishEffect','ActionSpell applies and releases the prepared action; other variants preserve their original completion hooks.',{0:'battlefield',1:'obfuscationGuard'});
method('mn','a','(ILha;)Lbd;','prepareAction','Validates an action request and creates its prepared action; null means rejected.',{0:'obfuscationGuard',1:'battlefield'});
method('bd','a','(ILha;)V','applyToBattlefield','Queues gameplay events; turn-condition marker implementations preserve their canonical no-op behavior.',{0:'obfuscationGuard',1:'battlefield'});
constructorParameters('ik','(I)V',['spellId'],'Spell constructor stores its definition ID.');
constructorParameters('wa','(III)V',['spellId','targetX','targetY'],'UnitSpell constructor assigns ID and target coordinates.');
constructorParameters('al','(I)V',['spellId'],'GlobalSpell delegates ID to the base Spell constructor.');
constructorParameters('ra','(ILmn;)V',['spellId','request'],'ActionSpell stores its request and sets its spell ID.');
method('nn','a','(Lbv;BLjd;)I','writeAttackMovementPacket','Serializes selected path and target offsets for the attacked unit.',{0:'packet',1:'obfuscationGuard',2:'attackedUnit'});
method('nn','a','(ZLbv;)I','writeMovementPacket','Serializes movement path and optional spell ID to the ciphered packet buffer.',{0:'obfuscationGuard',1:'packet'});
method('nn','c','(I)I','getMovementBudget','Three times base movement, modified by selected spells/statuses and tile effects.',{0:'obfuscationGuard'});
method('nn','a','(IBI)V','reconstructPath','Walks the cost gradient backward and stores forward path directions.',{0:'targetY',1:'obfuscationGuard',2:'targetX'});
method('nn','a','(IZIB)V','selectTarget','Chooses movement/direct action for target coordinates or clears an invalid target.',{0:'targetY',1:'allowOtherPlayer',2:'targetX',3:'obfuscationGuard'});
method('nn','a','(III)V','selectDirectAction','Stores coordinate deltas when the required movement cost matches.',{0:'targetY',1:'targetX',2:'requiredCost'});
method('nn','a','(I)V','resetCosts','Initializes cost grids and clears tile selection state from the given offset.',{0:'startIndex'});
method('nn','a','(ZIILjd;II)V','prepareForUnit','Sets acting player, selected unit and spell, then fills movement costs.',{0:'allowOtherPlayer',1:'obfuscationGuard',2:'actingPlayer',3:'unit',4:'selectionMode',5:'spellId'});
method('nn','d','(I)V','clearSelection','Clears path, selected unit and spell, then resets movement grids.',{0:'obfuscationGuard'});
method('nn','e','(I)V','clearPath','Clears path availability and the direction array without changing target coordinates.',{0:'obfuscationGuard'});
constructorParameters('nn','(Lha;)V',['battlefield'],'MovementPlanner constructor captures map geometry and initializes its cost grids.');
method('at','a','(ILtc;)V','addFirst','Links the node immediately after the deque sentinel; combat uses guard 750.',{0:'obfuscationGuard',1:'node'});
method('at','a','(BLtc;)V','addLast','Links the node immediately before the deque sentinel; keeps the original byte guard.',{0:'obfuscationGuard',1:'node'});
method('pa','a','(Loj;B)Z','initialize','Initializes presentation data for the event.',{0:'event',1:'obfuscationGuard'});
method('pa','b','(Loj;B)V','advanceFrame','Advances event presentation and its current projected coordinates.',{0:'event',1:'obfuscationGuard'});
method('pa','b','(I)Z','isFinished','Tests completion in all four presentation implementations.',{0:'obfuscationGuard'});
method('pa','a','(I)V','requestFinish','Combat presentation requests its terminal phase; other implementations retain their original no-op/guard behavior.',{0:'obfuscationGuard'});
method('pa','c','(B)V','drawBaseLayer','Draws base event/framebuffer presentation layer.',{0:'obfuscationGuard'});
method('pa','a','(B)V','drawOverlayLayer','Draws overlay feedback where supported.',{0:'obfuscationGuard'});
method('pa','b','(B)Z','isCombatViewReady','Combat presentation tests its transition factor; other presentations return false for canonical guards.',{0:'obfuscationGuard'});
method('vb','e','(I)Z','initialize','Dispatches event kind to a presentation and initializes it.',{0:'obfuscationGuard'});
method('vb','a','(I)V','advanceFrame','Advances the presentation, acknowledges once, and applies the original 1000-frame limit.',{0:'excludedEventKind'});
method('vb','a','(IIZ)V','draw','Delegates drawing or draws the unanimated unit fallback.',{0:'frameNumber',1:'obfuscationGuard',2:'overlayLayer'});
method('vb','a','(B)Z','isCombatViewReady','Delegates combat-view readiness to the current presentation.',{0:'obfuscationGuard'});
method('oj','c','(B)V','acknowledgePresentation','Decrements pending presentations and clears unit presentation state at completion.',{0:'obfuscationGuard'});
method('lf','b','(I)Z','isAtDestination','Compares current and destination X/Y.',{0:'obfuscationGuard'});
method('lf','b','(B)Z','isIdle','Requires animation state zero and frame -1.',{0:'obfuscationGuard'});
method('lf','a','(IB)V','setAnimationState','Assigns the animation state while preserving the guard side effect.',{0:'animationState',1:'obfuscationGuard'});
method('sr','a','(B)Z','isExpanded','Tests the completed 256 transition factor.',{0:'obfuscationGuard'});
method('mm','a','(Ljd;B)V','onUnitRegistered','Battlefield unit-registration notification propagated to AI observer implementations.',{0:'unit',1:'obfuscationGuard'});
method('ej','a','(Lmn;I)Z','executeActionRequest','Prepares and applies an AI action request, preserving the original guard-dependent failure result.',{0:'request',1:'obfuscationGuard'});
method('ej','b','(Ljd;B)Lcl;','registerUnitPlanner','Applies campaign overrides and adds an AI unit planner.',{0:'unit',1:'obfuscationGuard'});
method('ej','a','(Lcl;B)Lsm;','getSelectionStrategy','Returns the strategy currently used for per-unit decisions.',{0:'unitPlanner',1:'obfuscationGuard'});
method('ej','a','(IIIB)F','scoreSpellAtTile','Scores damage, raising and occupancy effects at a target tile; returns -Float.MAX_VALUE outside the map.',{0:'tileX',1:'spellId',2:'tileY',3:'obfuscationGuard'});
method('ej','a','(III)F','scoreSummoningAtTile','Combines category matchup influence and vulnerability/power weights for a summoning score.',{0:'unitType',1:'baseCost',2:'tileIndex'});
method('ej','a','(Lat;I)V','sortUnitPlanners','Orders per-unit planners by priority and coordinate tie breaker.',{0:'planners',1:'obfuscationGuard'});
method('cl','a','(ZB)F','evaluateActions','Scores candidate tiles with action or evaluation movement data and stores a selected action.',{0:'selectAction',1:'obfuscationGuard'});
method('cl','g','(I)V','executeSelectedAction','Executes a valid selected candidate and clears action movement state.',{0:'obfuscationGuard'});
method('cl','a','(BLcl;)Z','shouldFollow','Decision ordering by priority then the unit coordinate sum.',{0:'obfuscationGuard',1:'otherPlanner'});
method('cl','e','(I)Ljd;','getSelectedTarget','Looks up the selected candidate target unit when one is present.',{0:'obfuscationGuard'});
method('jb','h','(I)V','reset','Restores original -1 sentinels and Float.MIN_VALUE score.',{0:'targetY'});
method('jb','g','(I)Z','hasTarget','Tests whether target X is not -1.',{0:'obfuscationGuard'});
method('jb','a','(I)Z','hasDestination','Tests whether destination X is not -1.',{0:'obfuscationGuard'});
method('jb','a','(BLej;)I','execute','Reconstructs the candidate path/target and executes its selection.',{0:'obfuscationGuard',1:'planner'});
method('sm','a','(B)Ljb;','selectCandidate','Selection contract implemented by maximum-score and weighted-sampling strategies.',{0:'obfuscationGuard'});
method('sm','a','(ILjb;)V','submitCandidate','Submits a candidate using the concrete selection policy.',{0:'obfuscationGuard',1:'candidate'});
method('sm','b','(B)V','reset','Transfers candidates to the reuse pool and resets strategy state.',{0:'obfuscationGuard'});
method('sm','b','(I)Ljb;','acquireCandidate','Reuses a pooled candidate or constructs one, then restores its original sentinels.',{0:'obfuscationGuard'});
constructorParameters('vb','(Lic;Lha;Leo;Loj;Z)V',['controller','battlefield','effectSprites','event','blocking'],'EventPresenter constructor bindings; blocking mode preserves its original flag.');
for(const owner of ['sk','qv','tb','ql'])constructorParameters(owner,'(Lha;Lv;Lvb;)V',['battlefield','camera','presenter'],'All presentation constructors bind battlefield, camera and presenter.');
constructorParameters('cl','(Lej;Ljd;)V',['planner','unit'],'AI unit planner constructor links the unit to its planner.');
constructorParameters('ir','([Lne;II)V',['tiles','mapWidth','mapHeight'],'Influence-map constructor stores rectangular geometry and allocates packed costs.');
constructorParameters('sm','(Lej;)V',['planner'],'Selection strategy constructor allocates candidate and recycling deques.');
constructorParameters('aw','(Lej;)V',['planner'],'Best-score strategy delegates candidate storage construction.');
constructorParameters('ge','(Lej;)V',['planner'],'Weighted strategy initializes its normalization bounds.');
constructorParameters('ej','(Lha;IZ[Lid;)V',['battlefield','playerId','configurationFlag','campaignOverrides'],'AI constructor stores battlefield/player/override data; boolean configuration meaning is unresolved.');

field('mn','p','I','actingPlayer','Request constructors set the player used in ownership/summoning checks and illegal-move diagnostics.');
field('mn','o','I','spellId','ActionSpell sets the optional spell definition ID on its wrapped request.');
field('mn','u','Z','allowOtherPlayer','MoveAttackRequest bypasses ownership rejection when true; SphinxActionRequest sets this on its delegate.');
field('bd','m','I','actingPlayer','Prepared action constructors store the player used in queued events or turn markers.');
field('bd','n','[I','playerFlags','Marker constructors allocate one entry per player and set only the acting player flag; not tile indices.');
field('ec','D','Z','skipDestinationPlacement','Teleport application and presentation skip destination handling when this flag is true.');
for(const [owner,items] of Object.entries({
  am:[['J','startX','I'],['G','startY','I'],['H','pathDirections','[I'],['w','targetDeltaX','I'],['E','targetDeltaY','I']],
  hw:[['E','tileX','I'],['A','tileY','I'],['v','unitType','I']],
  jc:[['A','tileX','I'],['z','tileY','I'],['y','deployModifier','I']],
  to:[['v','spell','Lik;'],['w','selectionMode','I']],
  ee:[['z','sphinxX','I'],['w','sphinxY','I'],['y','delegatedRequest','Lmn;']],
  ld:[['u','startX','I'],['v','startY','I'],['C','pathDirections','[I'],['D','pathLength','I'],['w','targetDeltaX','I'],['t','targetDeltaY','I'],['y','movingUnit','Ljd;'],['z','defenderSnapshot','Ljd;'],['E','attackOriginX','I'],['F','attackOriginY','I'],['A','attackerAnimationCount','I'],['B','defenderAnimationCount','I']],
  be:[['G','tileX','I'],['B','tileY','I'],['t','unitType','I'],['C','summoningBonus','I']],
  pl:[['u','unit','Ljd;'],['w','deployModifier','I']],
  ua:[['x','spell','Lik;'],['w','selectionMode','I']],
  pe:[['u','tileX','I'],['y','tileY','I'],['t','originX','I'],['A','originY','I'],['z','strength','I']],
  ur:[['y','unit','Ljd;'],['s','targetDeltaX','I'],['t','targetDeltaY','I'],['A','skipDestinationPlacement','Z']],
}))for(const [original,to,type] of items)field(owner,original,type,to,'Reviewed request/action constructor bindings and validation/event queue data flow.');
constructorParameters('am','(Lvh;I)V',['packet','actingPlayer'],'Decodes path count, start coordinates, four packed directions per byte and signed target deltas.');
constructorParameters('am','(II[IIIII)V',['actingPlayer','declaredPathLength','pathDirections','startX','startY','targetDeltaX','targetDeltaY'],'Constructor stores the path array and coordinates; the declared length argument is unused.');
constructorParameters('hw','(IIII)V',['actingPlayer','tileX','tileY','unitType'],'SummonRequest stores the player, destination and requested unit type.');
constructorParameters('jc','(IIII)V',['actingPlayer','tileX','tileY','deployModifier'],'DeployRequest stores player, position and deploy modifier.');
constructorParameters('to','(Lik;II)V',['spell','selectionMode','actingPlayer'],'SpellCastRequest captures its spell and acting player.');
constructorParameters('ee','(IIILmn;)V',['actingPlayer','sphinxX','sphinxY','delegatedRequest'],'Sphinx wrapper records the Sphinx and marks its delegate as allowed to act on another player unit.');
constructorParameters('ld','(II[IIIIILjd;Ljd;)V',['startX','startY','pathDirections','pathLength','targetDeltaX','targetDeltaY','actingPlayer','movingUnit','defender'],'MoveAttackAction constructor and queued MoveEvent/AttackEvent payload.');
constructorParameters('be','(IIIII)V',['tileX','tileY','unitType','preparedBonus','actingPlayer'],'Prepared bonus argument is unused; apply recomputes it from the battlefield.');
constructorParameters('pl','(ILjd;I)V',['actingPlayer','unit','deployModifier'],'DeployAction event queue uses these bindings.');
constructorParameters('ua','(Lik;II)V',['spell','selectionMode','actingPlayer'],'SpellCastAction passes these bindings to SpellCastEvent.');
constructorParameters('pe','(IIIIII)V',['tileX','tileY','originX','originY','strength','actingPlayer'],'VineGrowthAction passes all six values to GrowthEvent.');
constructorParameters('ur','(IIIIILjd;Z)V',['suppliedSourceX','suppliedSourceY','targetDeltaX','targetDeltaY','actingPlayer','unit','skipDestinationPlacement'],'Source arguments are unused: application reads the live unit position.');
for(const owner of ['dk','kj'])constructorParameters(owner,'(II)V',['actingPlayer','playerCount'],'Marker flag array is sized by player count and indexed by acting player.');
method('nn','a','(II)Lmn;','createActionRequest','Copies the selected path and wraps it in a SpellCastRequest when a spell modifier is present.',{0:'actingPlayer',1:'obfuscationGuard'});
method('mn','a','(I[Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;','formatIllegalMove','Formats player, action kind and concatenated diagnostic fragments.',{0:'obfuscationGuard',1:'messageParts',2:'actionKind'});
method('sm','a','(IIIF)V','submitMoveCandidate','Acquires and submits a scored movement destination.',{0:'destinationY',1:'destinationX',2:'obfuscationGuard',3:'score'});
method('sm','a','(IIIIFI)V','submitAttackCandidate','Acquires and submits scored destination and target coordinates.',{0:'destinationY',1:'targetX',2:'destinationX',3:'obfuscationGuard',4:'score',5:'targetY'});
method('sm','a','(IIFIIZ)V','submitSummonCandidate','Sets summoning player/unit type and destination, with original -2 result sentinel.',{0:'destinationY',1:'unitType',2:'score',3:'actingPlayer',4:'destinationX',5:'submit'});
method('sm','a','(BIF)V','submitResultCandidate','Submits a scored result without a destination.',{0:'obfuscationGuard',1:'executionResult',2:'score'});
method('cl','a','(IIZLnn;)F','scoreTile','Scores movement, target combat, capture and influence at a tile; optionally submits a candidate.',{0:'tileIndex',1:'obfuscationGuard',2:'submitCandidate',3:'movementPlanner'});
method('cl','a','(IIII)F','scoreAttackFromTile','Scores expected target damage minus counter-damage, healing and weighted influence.',{0:'targetTileIndex',1:'attackOriginX',2:'attackOriginY',3:'matchupCategory'});
method('cl','f','(I)V','refreshDecisionPriority','Refreshes scoring weights and decision order for an unspent unit.',{0:'obfuscationGuard'});
for(const [original,to] of [['u','previousSourceTile'],['n','previousTargetTile'],['m','previousDestinationTile']])field('cl',original,'I',to,'AI execution stores source, target and selected destination before later influence-map refresh.');

for(const [owner,signature,items] of [
  ['am','<init>(Lvh;I)V',[[0,'var5','pathIndex'],[1,'var3_int','pathLength'],[2,'var4','packedDirections'],[8,'var4Lifetime1','packedTargetDelta']]],
  ['ld','a(ILha;)V',[[0,'var4','pathIndex'],[5,'var3','copiedPath'],[7,'var5','direction'],[9,'var7','pathBuffer'],[10,'var8','eventPath']]],
  ['hw','a(ILha;)Lbd;',[[0,'var6','godIndex'],[12,'var3_int','requiredGod'],[14,'var4','godSelected'],[15,'var5','chosenGods'],[16,'var7','chosenGod'],[18,'var4Lifetime1','summoningBonus']]],
  ['cl','a(IIZLnn;)F',[[19,'var7','battlefield'],[20,'var8','tileX'],[21,'var9','tileY'],[22,'var10','sourceTileIndex'],[24,'var12','tile'],[25,'var13','occupant']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and request decoding, queue payload or AI coordinate data flow.');

field('ns','L','I','attackerX','AttackEvent constructor receives the prepared action attack origin and application looks up that unit.');
field('ns','M','I','attackerY','AttackEvent constructor receives the prepared action attack origin and application looks up that unit.');
constructorParameters('ns','(IIIILjd;II)V',['attackerX','attackerY','targetDeltaX','targetDeltaY','targetUnit','attackerAnimationCount','defenderAnimationCount'],'AttackEvent payload from MoveAttackAction.');
constructorParameters('ec','(IIIIZ)V',['sourceX','sourceY','targetDeltaX','targetDeltaY','skipDestinationPlacement'],'Teleport offsets are added to source coordinates during application.');
constructorParameters('ec','(IIIZ)V',['sourceX','sourceY','packedTargetDelta','skipDestinationPlacement'],'Packed signed X/Y deltas decode from high/low bytes.');
constructorParameters('il','(IILjd;Lne;)V',['suppliedX','suppliedY','unit','tile'],'Displaced-unit marker constructor inspects the supplied tile, without storing position/unit.');
constructorParameters('ss','(IIII)V',['suppliedX','suppliedY','suppliedState','actingPlayer'],'State-change marker stores only acting player; the other arguments are unused.');

method('am','a','(Ljd;BLha;)Lbd;','prepareVineGrowth','Validates one-step vine growth, terrain and map bounds, then creates VineGrowthAction.',{0:'unit',1:'obfuscationGuard',2:'battlefield'});
method('am','a','(Lha;ILjd;)Lbd;','prepareTeleport','Validates target delta bounds/terrain and chooses destination-placement mode.',{0:'battlefield',1:'obfuscationGuard',2:'unit'});
method('am','a','([Ljava/lang/String;I)Ljava/lang/String;','formatMoveRejection','Formats a rejected movement request.',{0:'messageParts',1:'obfuscationGuard'});
method('hw','a','([Ljava/lang/String;B)Ljava/lang/String;','formatSummonRejection','Formats a rejected summoning request.',{0:'messageParts',1:'obfuscationGuard'});
method('jc','a','([Ljava/lang/String;Z)Ljava/lang/String;','formatDeployRejection','Formats a rejected deployment request.',{0:'messageParts',1:'obfuscationGuard'});
method('ee','a','([Ljava/lang/String;I)Ljava/lang/String;','formatMindControlRejection','Formats a rejected Sphinx action using the original mind-control diagnostic.',{0:'messageParts',1:'obfuscationGuard'});

field('fk','d','[[I','matchupDamagePercent','Combat power multiplies attacker-category/defender-category table entries by effective strength. The owning class also renders widgets.');
field('ri','c','[I','terrainDamageTakenPercent','Combat damage scales by this terrain-indexed percentage; gameplay renders its complement as cover.');
field('hh','e','[I','statusProtectionMasks','Damage reduction applies when the attack mask is a subset of the selected status mask.');
field('dn','Pb','[Ljava/lang/String;','unitDisplayNames','Unit construction uses this type-indexed name table; identifies type 27 as Sea slug and type 39 as Jade vine.');
field('ne','k','[I','teamEffectFlags','Allocated by teamCount, projected by player team and aggregated with separate own/other-team masks.');
field('ne','m','I','captureStrength','Capture-capable units reduce this each turn; tile reset restores its default.');
field('ne','j','I','godFavourLevel','An allied god-specific portal raises local summoning favour to this value.');
for(const [original,to] of [['v','hasTileEffect16'],['Z','hasTileEffect4'],['eb','hasTileEffect8']])field('jd',original,'Z',to,'Battlefield.refreshUnitTileEffects projects bits 16/4/8 from the current tile effects onto the unit.');
field('vn','k','Lsk;','combatPresentation','Sandbox update/draw delegates to this standalone combat presentation and clears it at completion.');
for(const [original,to,type] of [['r','unit','Ljd;'],['k','screenX','I'],['t','screenY','I'],['m','fadeOffset','I'],['q','nameScrollOffset','I'],['o','maximumNameScroll','I'],['n','scrollPauseFrames','I'],['p','scrollForward','Z']])field('fi',original,type,to,'Unit popup constructor, draw, show/hide fade and scrolling-name animation.');
method('ha','a','(Ljd;IBILjd;II)[I','predictCombat','Returns defender damage, attacker counter-damage and death flags (bit 1 attacker, bit 2 defender), without applying events.',{0:'defender',1:'attackOriginY',2:'obfuscationGuard',3:'targetDeltaY',4:'attacker',5:'targetDeltaX',6:'attackOriginX'});
method('ha','a','(IIILjd;Ljd;B)I','computeAttackPower','Scales remaining attacker strength by matchup percent, with tile-effect and anti-flying overrides; protective target statuses reset prior damage.',{0:'attackerY',1:'priorDamage',2:'attackerX',3:'defender',4:'attacker',5:'obfuscationGuard'});
method('ha','a','(Ljd;BII)I','scaleIncomingDamage','Applies terrain/ownership cover and status protection to incoming attack power.',{0:'defender',1:'obfuscationGuard',2:'attackTypeMask',3:'attackPower'});
method('ha','a','(IILjd;)I','getDamageTakenPercent','Explicit allied ownership gives 60 percent; tile effect 8 negates cover; god-2 units have special terrain-3 cover.',{0:'tileIndex',1:'obfuscationGuard',2:'unit'});
method('ha','a','(Ljd;I)V','refreshUnitTileEffects','Projects current tile-effect bits into the unit state.',{0:'unit',1:'obfuscationGuard'});
method('ha','b','(IIII)I','getTileEffects','Projects team-indexed tile effects for a player.',{0:'obfuscationGuard',1:'tileY',2:'tileX',3:'playerId'});
method('ne','a','(BII)I','getEffectsForPlayer','Own team contributes bit 16, other teams bits 0..3; an unspecified player receives all bits.',{0:'obfuscationGuard',1:'playerId',2:'teamIndex'});
method('ne','a','(Z)Z','isStructure','Recognizes the structure terrain types through ck.isStructureTerrain.',{0:'obfuscationGuard'});
method('ck','a','(II)Z','isStructureTerrain','Canonical terrain values 7, 8, 9, 11 and 14 are structures.',{0:'terrainType',1:'obfuscationGuard'});
method('ne','e','(I)I','getDefaultCaptureStrength','Terrain types 9/14 use 15; other terrain types use 10.',{0:'obfuscationGuard'});
method('jd','x','(I)Z','isFlying','Definition category 4; used by attack eligibility and anti-flying damage rules.',{0:'obfuscationGuard'});
method('jd','j','(B)Z','canAttackFlying','Categories 2/3/4, deployed dwarf cannon, definition flag 2048 or accessory 2 can hit flying units.',{0:'obfuscationGuard'});
method('jd','n','(I)Z','hasAntiFlyingBonus','Definition flag 2048 or accessory 2 selects 90-percent power against flying units.',{0:'obfuscationGuard'});
method('jd','i','(I)Z','canCaptureStructures','Definition flag 512 or accessory 1 enables capture-strength reduction.',{0:'obfuscationGuard'});
method('jd','k','(B)Z','isSeaSlug','Type 27 in unitDisplayNames; parasite attacks also count as capture-capable units in game-end checks.',{0:'obfuscationGuard'});
method('jd','a','(Ljd;B)Z','canParasitize','Sea slug with enough effective strength can parasitize a target that is not deployed, except type zero.',{0:'target',1:'obfuscationGuard'});
method('jd','e','(B)Z','isJadeVine','Type 39 in the original name table; its action grows or removes a vine.',{0:'obfuscationGuard'});
method('ha','c','(IIII)I','getSummoningGodMaskAt','Returns all gods for an empty allied portal or its god bit for terrain 11; occupied/out-of-bounds tiles reject summoning.',{0:'tileX',1:'obfuscationGuard',2:'tileY',3:'playerId'});
method('ha','a','(IBII)[I','getSummoningFavourAt','An allied portal copies player favour; a god-specific portal raises its own god favour to the tile level.',{0:'tileY',1:'obfuscationGuard',2:'tileX',3:'playerId'});
method('ha','b','(IIIII)Z','canSummonUnitAt','Checks unlocked unit, mana and required local favour; god selection and tile mask are checked by SummonRequest.',{0:'tileY',1:'obfuscationGuard',2:'unitType',3:'tileX',4:'playerId'});
method('ha','a','(IIIII)I','getSummonFailureFlags','Flags 1/2/4 describe insufficient mana, favour and locked unit.',{0:'playerId',1:'obfuscationGuard',2:'unitType',3:'tileY',4:'tileX'});
method('fi','a','(BZ)V','advanceAnimation','Shows/hides the popup in steps of four and scrolls long names with endpoint pauses.',{0:'obfuscationGuard',1:'show'});
method('vn','c','(I)V','draw','Draws the active combat presentation or sandbox controls.',{0:'obfuscationGuard'});
method('vn','a','(IIIZIZ)V','advanceFrame','Updates the active combat presentation or sandbox input; preserves the original argument order.',{0:'inputValue',1:'obfuscationGuard',2:'screenY',3:'inputActive',4:'screenX',5:'secondaryInput'});

for(const [owner,signature,items] of [
  ['ha','a(Ljd;IBILjd;II)[I',[[13,'var8','attackerUnit'],[15,'var9','defenderUnit'],[16,'var10','combatPrediction'],[17,'var11','effectiveAttackerType'],[18,'var12','attackDistance'],[19,'var13','attackerDamageMask'],[20,'var14','defenderDamageMask'],[21,'var15','attackerEquipmentBonus'],[22,'var16','defenderEquipmentBonus'],[23,'var17','meleeRange'],[24,'var18','maximumRange'],[25,'var19','minimumRange'],[26,'var20','defenderDamage'],[27,'var21','attackerDamage'],[30,'var19Lifetime1','defenderMinimumRange']]],
  ['ha','a(IIILjd;Ljd;B)I',[[8,'var7_int','matchupPercent'],[10,'var8','attackPower']]],
  ['ha','a(Ljd;BII)I',[[0,'var5_int','damageTakenPercent']]],
  ['ne','a(BII)I',[[0,'var4','effectFlags'],[1,'var5','effectTeamIndex']]],
  ['cl','a(IIII)F',[[4,'var5','score'],[5,'var6','battlefield'],[6,'var7','targetX'],[7,'var8','targetY'],[8,'var9','targetTile'],[9,'var10','targetUnit'],[10,'var11','targetDeltaX'],[11,'var12','targetDeltaY'],[12,'var13','meleeRange'],[13,'var15','targetDamage'],[14,'var16','unitDamage'],[15,'var17','unitHealing'],[16,'var18','targetHealing'],[17,'var19','netTargetDamage'],[18,'var20','netUnitDamage'],[20,'var25','combatPrediction']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and combat power, range, cover, effect-mask or AI net-damage data flow.');

field('tt','b','[Lat;','conditionsByPlayer','Registry constructor creates one deque per player; all checks and removal use this array.');
field('u','m','Llv;','condition','Entry constructor captures the predicate evaluated by MatchConditionRegistry.');
for(const [owner,items] of Object.entries({
  up:[['a','playerId','I'],['d','battlefield','Lha;']],
  mc:[['b','playerId','I'],['e','battlefield','Lha;']],
  gm:[['c','leaders','[Ljd;']],
}))for(const [original,to,type] of items)field(owner,original,type,to,'Condition constructor bindings and victory/defeat predicates.');
field('jd','G','Z','escortComplete','MoveEvent sets this when a unit reaches its own marked objective tile; LeaderEscortCondition requires it on every tracked leader.');
field('jd','S','Z','removedFromActivePlay','Escort completion unlinks the unit and sets this flag; capture and loss checks exclude removed units.');
for(const [original,to,type] of [
  ['P','matchConditions','Ltt;'],['K','campaignMission','Lom;'],['e','eliminatedPlayerMask','I'],
  ['u','inactivePlayerMask','I'],['n','eliminationOrder','[I'],['p','rankedParticipants','[I'],
  ['R','winnerCount','I'],['O','turnLimit','I'],['xb','collectedManaTarget','I'],['z','teamStructureCounts','[[I'],
])field('ha',original,type,to,'Match condition initialization, elimination-mask/order maintenance and outcome/ranking calculations. The secondary inactive mask meaning is limited to observed player exclusion.');
method('lv','b','(I)Z','isVictory','Canonical guard zero evaluates victory; noncanonical arguments retain their original effects.',{0:'obfuscationGuard'});
method('lv','c','(I)Z','isDefeat','Canonical guard -128 evaluates defeat.',{0:'obfuscationGuard'});
method('lv','a','(I)Ljava/lang/String;','describeCondition','Own condition diagnostics identify portal loss, unit loss and leader escort.',{0:'obfuscationGuard'});
method('tt','a','(Llv;BI)V','addCondition','Prepends the condition wrapper to one player deque.',{0:'condition',1:'obfuscationGuard',2:'playerId'});
method('tt','a','(BI)Z','hasDefeat','Returns true if any registered condition reports defeat.',{0:'obfuscationGuard',1:'playerId'});
method('tt','a','(II)Z','hasVictory','Returns true if any registered condition reports victory.',{0:'playerId',1:'obfuscationGuard'});
method('tt','a','(I)[Ljava/lang/String;','describeConditions','Lists player headings and condition diagnostics in deque order; canonical initial count is zero.',{0:'initialCount'});
method('tt','a','(B)V','removePortalLossConditions','Removes only PortalLossCondition entries from every player.',{0:'obfuscationGuard'});
method('tt','b','(II)V','removePlayerPortalLossConditions','Removes only PortalLossCondition entries for one player.',{0:'obfuscationGuard',1:'playerId'});
constructorParameters('tt','(I)V',['playerCount'],'Registry creates a deque for each player.');
constructorParameters('u','(Llv;)V',['condition'],'Intrusive wrapper stores the condition.');
for(const owner of ['up','mc'])constructorParameters(owner,'(ILha;)V',['playerId','battlefield'],'Loss condition stores player and battlefield.');
constructorParameters('gm','(I[Ljd;)V',['suppliedPlayerId','leaders'],'The player argument is unused; victory examines the supplied leader array.');
method('ha','k','(I)V','initializeMatchConditions','Scans portals, capture units and leaders, then registers the applicable loss/escort conditions.',{0:'obfuscationGuard'});
method('ha','a','(ZZI)Lat;','prepareTurnConsequences','Refreshes captures/unit turn consequences and optionally collects prepared marker actions.',{0:'skipUnitProcessing',1:'collectMarkers',2:'obfuscationGuard'});
method('ha','h','(B)V','applyPendingEvents','Pops and applies queued events until the deque is empty.',{0:'obfuscationGuard'});
method('ha','f','(II)Lat;','getUnitsForPlayer','Returns the owner deque or null for missing/out-of-bounds player storage.',{0:'playerId',1:'obfuscationGuard'});
method('ha','b','(IB)Z','hasUsablePortal','Checks own/allied portal tiles, god favour and the original campaign restriction.',{0:'playerId',1:'obfuscationGuard'});
method('ha','a','(IZ)Z','hasCapturingUnit','Checks unremoved capture units/Sea Slugs, including allies in ordinary team matches.',{0:'playerId',1:'obfuscationGuard'});
method('ha','b','(IIZ)V','eliminatePlayer','Marks the player, records elimination order and removes/transfers owned resources using the existing dispatcher.',{0:'obfuscationGuard',1:'playerId',2:'removeUnits'});
method('ha','g','(II)V','setEliminatedPlayerMask','Reconciles changed player bits with elimination, then installs the supplied mask.',{0:'playerMask',1:'obfuscationGuard'});
method('ha','a','(II)V','setInactivePlayerMask','Reconciles changed secondary mask bits through elimination and stores the mask.',{0:'startPlayer',1:'playerMask'});
method('ha','b','(II)Z','isPlayerInactive','Tests either eliminated or secondary inactive mask.',{0:'obfuscationGuard',1:'playerId'});
method('ha','a','(B)I','getSurvivingPlayerMask','Complements eliminated bits and restricts them to the declared player count.',{0:'obfuscationGuard'});
method('ha','e','(B)Z','hasSingleSurvivor','Exactly one player, or one team with surviving members, remains.',{0:'obfuscationGuard'});
method('ha','d','(I)[I','getEliminationRanks','Inverts elimination order; players not in the order receive playerCount.',{0:'obfuscationGuard'});
method('ha','a','(I)V','updateMatchOutcome','Updates participant rankings and winner count from collected mana, turn limits, eliminations and campaign conditions.',{0:'obfuscationGuard'});
method('ha','a','(IZ[I)V','applyMatchOutcome','Stores winner count, outcome flag and ranked participants; one winner becomes currentPlayer, otherwise -1.',{0:'winnerCount',1:'outcomeFlag',2:'rankedParticipants'});
method('ha','b','(I)V','recountStructures','Recounts team-owned portals/towers/villages, then updates the match outcome.',{0:'obfuscationGuard'});
method('ha','k','(II)I','getStructureIncome','Returns 50 per portal, 75 per tower and 25 per village, with campaign scaling.',{0:'obfuscationGuard',1:'playerId'});
method('ha','m','(II)Z','checkPlayerVictory','When any player condition wins, eliminates opposing participants.',{0:'startPlayer',1:'playerId'});
method('ha','a','(BI)V','eliminatePlayerTeam','Looks up the player team and eliminates all its participants.',{0:'obfuscationGuard',1:'playerId'});
method('go','a','(ILha;)V','eliminateAllPlayers','Calls battlefield elimination for every player in the roster.',{0:'obfuscationGuard',1:'battlefield'});
for(const [original,to,type] of [
  ['v','missionId','I'],['k','flags','I'],['J','name','Ljava/lang/String;'],['n','description','Ljava/lang/String;'],
  ['w','playerSlot','I'],['o','mapSizeSetting','I'],['z','mapTheme','I'],['q','musicId','I'],
  ['m','scoreTurnTarget','I'],['F','scoreDamageTarget','I'],['E','difficulty','I'],['t','mapResourceId','I'],
  ['C','cachedLayout','Llo;'],['y','neighborMissionIds','[I'],['B','participantIds','[I'],['D','rewardUnitTypes','[I'],['x','teamAssignments','[I'],
])field('om',original,type,to,'Campaign mission tagged keys id/flg/name/dsc/pos/mpsz/mpt/song/gt/gd/df/mid/ngb/ptc/rwd/team and lazy loading. Finer numeric encodings remain unresolved.');
method('om','a','(I)Llo;','getMapLayout','Loads the map once and caches the resulting layout.',{0:'obfuscationGuard'});
method('om','d','(B)Llo;','loadMapLayout','Reads the mission map resource and creates a MapLayout.',{0:'obfuscationGuard'});
method('om','a','(B)[I','getTeamAssignments','Returns the original stored team assignment array.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['s','encodedMap','[B'],['r','decodedTiles','[Lne;'],['l','mapWidth','I'],['n','mapHeight','I'],['t','formatVersion','I']])field('lo',original,type,to,'Layout header decoding and row-major terrain/placement readers.');
method('lo','a','(B)Lvh;','readHeader','Reads version and dimensions, with tagged-map and legacy-format branches.',{0:'obfuscationGuard'});
method('lo','e','(I)[[I','getTerrainGrid','Returns rows of terrain type IDs from decoded tiles or encoded bytes.',{0:'obfuscationGuard'});
method('lo','a','(ILha;)[Lne;','createTiles','Decodes/binds layout tiles and saved units to the battlefield.',{0:'obfuscationGuard',1:'battlefield'});
constructorParameters('lo','(I[B)V',['suppliedMapId','encodedMap'],'Map ID argument is unused; the encoded byte header determines layout data.');

method('jd','k','(I)V','queueTurnConsequences','Queues upkeep, tile-state effects and displacement telefrag consequences for the unit.',{0:'obfuscationGuard'});
method('ne','d','(I)Z','isPortal','Terrain types 7 and 11 are portals.',{0:'obfuscationGuard'});
for(const [owner,signature,items] of [
  ['tt','a(II)Z',[[1,'var3','iterator'],[2,'var4','entry']]],
  ['tt','a(BI)Z',[[1,'var3','iterator'],[2,'var4','entry']]],
  ['ha','b(IIZ)V',[[17,'var4','orderIndex'],[23,'var10','receivingPlayers'],[24,'var11','unitToRemove'],[25,'var12','campaignUnit']]],
  ['ha','e(B)Z',[[0,'var2','survivingTeams'],[1,'var3','teams'],[2,'var4','teamIndex'],[3,'var5','team'],[4,'var6','players'],[5,'var7','playerIndex'],[6,'var8','playerId']]],
  ['ha','k(I)V',[[9,'var2','hasEscortGoals'],[10,'var3','hasPortals'],[11,'var4','portalOwners'],[12,'var5','captureUnitOwners'],[13,'var6','leaderGroups'],[15,'var7','needsUnitLossCheck'],[16,'var8_ref_ne','tile'],[21,'var13','leaders'],[23,'var15','leaderArray']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and condition, survivor, elimination-order or leader-registration data flow.');

for(const [original,to,type] of [['j','playerCount','I'],['k','mapWidth','I'],['e','mapHeight','I'],['a','mapTheme','I'],['c','tiles','[Lne;']])field('sc',original,type,to,'Tagged map keys nump/w/h/them/map and MapLayout version-2 header bindings.');
field('mt','b','Ljava/lang/String;','text','String constructor and cursor character reads.');
field('mt','c','I','position','Advances one character per read; used in parser diagnostic rendering.');
field('mt','a','I','length','Constructor caches string length; end-of-text test compares position.');
field('bb','e','Lat;','deque','Iterator constructor and forward/reverse sentinel checks.');
field('bb','f','Ltc;','cursor','Traversal captures the next/previous node before returning the current one.');
for(const [original,to,type] of [['e','results','[I'],['c','memory','[I'],['b','remainingResults','I'],['f','accumulator','I'],['j','lastResult','I'],['h','generationCounter','I']])field('ga',original,type,to,'ISAAC initialization, 256-word state generation and decrementing output cursor.');
field('bv','y','I','writeBitsRemaining','Bit-write cursor counts unused bits in the current payload byte.');
field('bv','z','Lga;','opcodeCipher','ISAAC output adds/subtracts from byte opcodes.');
field('oj','n','[I','bitMasks','Shared masks indexed by width, including mask zero and the full 32-bit mask.');
method('bv','g','(II)I','readBits','Reads MSB-first bits across bytes and advances only the bit cursor.',{0:'obfuscationGuard',1:'bitCount'});
method('bv','a','(III)V','writeBits','Writes a masked value at the bit-write cursor, preserving surrounding payload bits.',{0:'obfuscationGuard',1:'bitCount',2:'value'});
method('bv','d','(BI)V','setReadBitPosition','Sets the read bit cursor; preserves the original noncanonical guard side effect.',{0:'obfuscationGuard',1:'bitPosition'});
method('bv','a','(Z)I','getReadBitPosition','Returns read bit cursor for canonical false.',{0:'obfuscationGuard'});
method('bv','o','(I)V','beginBitReading','Initializes read bit cursor from byte position.',{0:'obfuscationGuard'});
method('bv','n','(I)V','endBitReading','Rounds read bit position up to the next byte position.',{0:'obfuscationGuard'});
method('bv','c','(IB)V','setWriteBitPosition','Sets byte position and remaining write bits from an absolute bit offset.',{0:'bitPosition',1:'obfuscationGuard'});
method('bv','h','(II)V','writeCipheredOpcode','Adds the next ISAAC value to a byte opcode.',{0:'obfuscationGuard',1:'opcode'});
method('bv','m','(I)I','readCipheredOpcode','Subtracts the next ISAAC value from a byte opcode.',{0:'obfuscationGuard'});
method('bv','a','([II)V','initializeOpcodeCipher','Constructs ISAAC from the supplied seed.',{0:'seed',1:'obfuscationGuard'});
method('ga','a','(I)I','nextInt','Consumes ISAAC results backwards and generates another block when exhausted.',{0:'obfuscationGuard'});
constructorParameters('ga','([I)V',['seed'],'Copies supplied seed words and initializes ISAAC state.');
method('mt','b','(I)C','readCharacter','Returns and advances the string cursor.',{0:'obfuscationGuard'});
method('mt','a','(B)Z','isAtEnd','Tests position against string length.',{0:'obfuscationGuard'});
constructorParameters('mt','(Ljava/lang/String;)V',['text'],'TextCursor constructor stores text, length and initial position.');
method('vh','i','(I)I','readInt','Reads four big-endian bytes.',{0:'obfuscationGuard'});
method('vh','e','(B)I','readUnsignedShort','Reads two big-endian bytes.',{0:'obfuscationGuard'});
method('vh','k','(I)I','readUnsignedByte','Reads the next byte as 0..255.',{0:'obfuscationGuard'});
method('vh','a','(B)B','readByte','Reads the next signed byte.',{0:'obfuscationGuard'});
method('vh','a','(BI)V','writeInt','Writes four big-endian bytes for canonical guards.',{0:'obfuscationGuard',1:'value'});
method('vh','b','(ZI)V','writeShort','Writes two big-endian bytes when enabled.',{0:'enabled',1:'value'});
method('vh','b','(II)V','writeByte','Writes the low byte for canonical guard 1.',{0:'obfuscationGuard',1:'value'});
method('de','a','(ILbv;IIII)I','readTieredSignedInt','Two-bit selector chooses signed widths in tier order 0/1/2/3; cumulative half-range offsets preserve signs.',{0:'obfuscationGuard',1:'packet',2:'tier0Bits',3:'tier1Bits',4:'tier3Bits',5:'tier2Bits'});
method('ir','a','(IIIIIILbv;)I','writeTieredSignedInt','Chooses a signed integer tier, writes selector/payload and returns bit length; rejects out-of-range values.',{0:'tier1Bits',1:'tier2Bits',2:'value',3:'tier3Bits',4:'obfuscationGuard',5:'tier0Bits',6:'packet'});
method('wa','a','(Lbv;II)I','readSignedBits','Reads a fixed-width two-complement signed value.',{0:'packet',1:'bitCount',2:'obfuscationGuard'});
method('vt','a','(IIILbv;)I','readTwoTierUnsignedInt','One-bit selector chooses short width or long width plus the short range.',{0:'obfuscationGuard',1:'longBits',2:'shortBits',3:'packet'});
method('sa','a','(Lbv;II)J','readTagCharacter','Decodes a tagged name character with unsigned 4/8-bit tiers; keeps unused argument.',{0:'packet',1:'unusedValue',2:'obfuscationGuard'});
method('mt','a','(Lbv;Z)Ljava/lang/String;','readTagName','Two-bit name length plus one, followed by encoded character values.',{0:'packet',1:'obfuscationGuard'});
method('tn','a','(ZILbv;)J','readTaggedInteger','Uses the standard signed 4/14/20/30-bit tiers; encoded-length argument is unused.',{0:'obfuscationGuard',1:'encodedLength',2:'packet'});
method('ai','a','(Lbv;Z)I','readCompactInt','Standard signed compact integer decoder used for list counts.',{0:'packet',1:'obfuscationGuard'});
method('ej','a','(Lbv;Z)I','readCompactInt','Standard signed compact integer decoder used for field lengths.',{0:'packet',1:'obfuscationGuard'});
method('no','a','(Lbv;Luo;II)V','readTaggedFields','Reads name/length fields, exposes their payload and restores relocated length headers after dispatch.',{0:'packet',1:'target',2:'recordBitLength',3:'obfuscationGuard'});
method('kq','a','(IIIILbv;)V','enterTaggedPayload','If payload exceeds length-header width, temporarily rotates its leading bits over the header and seeks to payload start.',{0:'headerBitPosition',1:'obfuscationGuard',2:'headerBitLength',3:'payloadBitLength',4:'packet'});
method('ao','a','(IIILbv;I)V','finishTaggedPayload','Restores the original compact length header if relocated, then seeks to the next field.',{0:'headerBitPosition',1:'obfuscationGuard',2:'headerBitLength',3:'packet',4:'payloadBitLength'});
method('a','a','(IILbv;)Ljd;','readTaggedUnit','Returns null for an empty record, otherwise decodes Unit fields.',{0:'recordBitLength',1:'obfuscationGuard',2:'packet'});
method('ui','a','(Lbv;II)Lca;','readTaggedTileMetadata','Returns null for an empty record, otherwise decodes tile metadata.',{0:'packet',1:'recordBitLength',2:'obfuscationGuard'});
method('rb','a','(IBLbv;)Lne;','readTaggedMapTile','Decodes a tile record and initializes god metadata.',{0:'recordBitLength',1:'obfuscationGuard',2:'packet'});
method('ut','a','(Lbv;BI)Lsc;','readTaggedMap','Returns null for an empty record, otherwise decodes TaggedMapData.',{0:'packet',1:'obfuscationGuard',2:'recordBitLength'});
method('po','a','(Lbv;I)Lsc;','readLengthPrefixedMap','Reads a four-byte bit length, decodes the tagged map and restores byte alignment.',{0:'packet',1:'obfuscationGuard'});
method('ha','b','(ILvh;)V','readLegacySnapshot','Reads seed, turn limit, player designs, turn/player state and tile/unit data.',{0:'obfuscationGuard',1:'packet'});
method('ha','a','(Lvh;II)V','writeLegacySnapshot','Writes the legacy snapshot for the selected player, preserving original field order.',{0:'packet',1:'obfuscationGuard',2:'playerId'});
method('ha','b','(Lvh;B)V','readSpecialEvent','Decodes special turn, teleport, revival, deployment and spell-related event packets.',{0:'packet',1:'obfuscationGuard'});
method('ha','a','(Lvh;I)V','readCombatEvent','Decodes combat or parasite event flags, coordinates, signed deltas and paired damage.',{0:'packet',1:'obfuscationGuard'});

method('bb','c','(I)Ltc;','first','Starts independent forward traversal.',{0:'obfuscationGuard'});
method('bb','b','(I)Ltc;','next','Continues forward traversal, including after current node unlink.',{0:'obfuscationGuard'});
method('bb','a','(I)Ltc;','last','Starts independent reverse traversal.',{0:'obfuscationGuard'});
method('bb','b','(B)Ltc;','previous','Continues reverse traversal.',{0:'obfuscationGuard'});
constructorParameters('bb','(Lat;)V',['deque'],'Iterator captures the deque without changing its shared cursor.');
for(const [original,descriptor] of [['a','(IIBIIIIIILbv;)I'],['$cfr$intArgs$a$eb6d2a313bbb','(IIIIIIIIILbv;)I']])
  method('sj',original,descriptor,'readTieredSignedBits','Two-bit mode selects signed width plus cumulative half-range offset. The int-guard overload is the existing decompiler bridge.',{0:'unusedTier3HalfRange',1:'tier2HalfRange',2:'obfuscationGuard',3:'tier3Bits',4:'tier2Bits',5:'tier1HalfRange',6:'tier0HalfRange',7:'tier1Bits',8:'tier0Bits',9:'packet'});

for(const [original,to] of [['D','sourceX'],['B','sourceY'],['E','destinationX'],['z','destinationY'],['C','newOwnerPlayer']])field('md',original,'I',to,'ParasiteEvent constructor adds signed deltas to source coordinates; battlefield application uses absolute destination coordinates despite the d diagnostic label.');
constructorParameters('md','(IIIII)V',['sourceX','sourceY','targetDeltaX','targetDeltaY','newOwnerPlayer'],'Parasite payload is decoded from the combat packet when flag 4 is set.');

method('ha','a','(Lvh;B)V','readGameEvent','Peeks at the header and dispatches categories 0/1/3/5/6 without consuming it first.',{0:'packet',1:'obfuscationGuard'});
method('ha','a','(BLvh;)V','readMoveEvent','Reads a 13-bit step count, source coordinates and four little-endian two-bit directions per byte.',{0:'obfuscationGuard',1:'packet'});
method('ha','a','(Lvh;Z)V','readSummonEvent','Decodes unit type, signed five-bit strength bonus, three-bit owner and destination coordinates.',{0:'packet',1:'obfuscationGuard'});
method('ha','a','(ILvh;)V','readStateChangeEvent','Decodes low-three-bit player ID and bits 3/4 effect type followed by tile coordinates.',{0:'obfuscationGuard',1:'packet'});
method('ha','a','(IILvh;I)V','readStoredUnitAt','Decodes and appends a unit to its owner deque; placement and removed-state semantics are preserved.',{0:'tileX',1:'obfuscationGuard',2:'packet',3:'tileY'});
method('ha','a','(ILvh;B)V','appendSnapshotChunk','Allocates a length-prefixed snapshot buffer on the first chunk, then appends payload slices.',{0:'chunkLength',1:'packet',2:'obfuscationGuard'});
field('ha','Z','Lvh;','snapshotBuffer','appendSnapshotChunk initializes this from a two-byte total length and advances its append cursor.');
method('mb','a','(IIIILvh;Lha;IZ)Ljd;','readStoredUnit','Decodes owner/flags, strength/status, counters, equipment, movement flags and optional tagged identifiers. Detached skips tile placement; it is distinct from removedFromActivePlay.',{0:'unitType',1:'formatVersion',2:'tileY',3:'tileX',4:'packet',5:'battlefield',6:'obfuscationGuard',7:'detached'});
method('bo','a','(ILvh;I)Lik;','readSpell','Uses spell-table kind and targeting columns to decode global, coordinate-targeted or action-wrapped spells.',{0:'actingPlayer',1:'packet',2:'obfuscationGuard'});
method('vh','a','(III[B)V','readBytes','Copies a sequential payload slice to the destination offset and advances position.',{0:'obfuscationGuard',1:'length',2:'destinationOffset',3:'destination'});
method('vh','h','(B)Ljava/lang/String;','readNullCircumfixedString','Requires a leading zero and reads through the terminating zero; preserves its original text decoder.',{0:'obfuscationGuard'});
field('pj','y','I','selectionMode','SpellCastAction/SpellCastEvent constructor and battlefield spell accounting pass this mode unchanged.');
field('rl','B','I','playerId','KingBlackDragonEvent constructor, own diagnostic and application identify the summoning player.');
for(const [owner,original,to] of [['hp','y','tileX'],['hp','D','tileY'],['q','z','tileX'],['q','E','tileY']])
  field(owner,original,'I',to,'Position diagnostic, coordinate constructor and source-unit lookup use these tile coordinates.');
for(const [owner,descriptor,names] of [
  ['kr','(II[I)V',['startX','startY','pathDirections']],
  ['mb','(IIIII)V',['unitType','tileX','tileY','strengthBonus','playerId']],
  ['qq','(IIII)V',['effectType','tileX','tileY','playerId']],
  ['rl','(I)V',['playerId']],
  ['pj','(Lik;II)V',['spell','selectionMode','castingPlayer']],
])constructorParameters(owner,descriptor,names,'Constructor assignments and event packet readers establish these payload roles.');
for(const [owner,signature,items] of [
  ['ha','a(Lvh;B)V',[[0,'var3_int','header'],[1,'var4','eventCategory']]],
  ['ha','a(BLvh;)V',[[1,'var3_int','stepsRemaining'],[2,'var4','guardArithmetic'],[3,'var5','startX'],[4,'var6','startY'],[5,'var7','directions'],[6,'var8','stepIndex'],[7,'var9','packedDirections'],[8,'var10','stepsInByte'],[10,'var12','directionArray'],[11,'var13','decodedDirections']]],
  ['ha','a(Lvh;Z)V',[[0,'var3_int','unitType'],[1,'var4','ownerAndBonus'],[2,'var5','tileX'],[3,'var6','tileY'],[4,'var7','strengthBonus']]],
  ['ha','a(ILvh;)V',[[0,'var3_int','header'],[1,'var4','tileX'],[2,'var5','tileY'],[3,'var6','playerId'],[4,'var7','effectType']]],
  ['ha','b(Lvh;B)V',[[4,'var3_int','specialKind'],[6,'var4','playerAndMode'],[7,'var5','selectionMode'],[8,'var6','dispatchKind'],[10,'var4Lifetime1','tileX'],[11,'var5Lifetime1','tileY']]],
  ['bo','a(ILvh;I)Lik;',[[8,'var3_int','spellId'],[10,'var4','spellKind']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and packet header, coordinate, packed path or spell dispatch data flow.');

for(const [original,to] of [['d','rightX'],['a','leftX'],['h','topY'],['e','bottomY'],['f','itemSpacing']])
  field('bo',original,'[I',to,'TutorialLayout stage setter, centered getters and TutorialController bounds/spacing use.');
method('bo','a','(IIBIIII)V','setStageLayout','Stores raw reference-surface positions and stage item spacing; tutorial panels draw width rightX minus leftX.',{0:'rightX',1:'bottomY',2:'obfuscationGuard',3:'topY',4:'leftX',5:'itemSpacing',6:'stage'});
method('bo','a','(BI)I','getRightX','Adds half the surface width minus 640 to the stored right coordinate.',{0:'obfuscationGuard',1:'stage'});
method('bo','b','(IB)I','getItemSpacing','Returns the stored stage spacing.',{0:'stage',1:'obfuscationGuard'});
method('bo','b','(II)I','getLeftX','Adds horizontal centering to the stored left coordinate.',{0:'stage',1:'obfuscationGuard'});
method('bo','a','(IB)I','getTopY','Adds half the surface height minus 480 to the stored top coordinate.',{0:'stage',1:'obfuscationGuard'});
method('bo','a','(II)I','getBottomY','Returns the centered bottom coordinate for canonical guard -6.',{0:'obfuscationGuard',1:'stage'});
method('bo','b','(III)V','setRightX','Adjusts the raw right coordinate so its centered getter returns screenX.',{0:'obfuscationGuard',1:'screenX',2:'stage'});
method('bo','a','(III)V','setLeftX','Adjusts the raw left coordinate to screenX for canonical guard -1.',{0:'obfuscationGuard',1:'screenX',2:'stage'});
method('bo','a','(IIB)V','setTopY','Adjusts the raw top coordinate so its centered getter returns screenY.',{0:'screenY',1:'stage',2:'obfuscationGuard'});
field('kr','D','Lbo;','tutorialLayout','TutorialController reads stage bounds from this initialized 29-stage layout.');
field('kr','y','[[I','tutorialStageItems','TutorialController indexes each stage item list, including its constructor selection count.');
method('gb','a','(IIIIII[II)V','configureTutorialStage','Registers stage item IDs and sets its bounds/spacing; MoveEvent static initialization configures all tutorial stage presets.',{0:'itemSpacing',1:'stage',2:'leftX',3:'rightX',4:'topY',5:'bottomY',6:'itemIds',7:'obfuscationGuard'});
field('ci','d','Ldl;','selectionState','Tutorial constructor builds the shared state for the current stage item count.');
for(const [original,to,type] of [
  ['a','buttonPress','I'],['b','pointerDrivenSelection','Z'],['j','keyCode','I'],
  ['h','selectedIndex','I'],['g','repeatCountdown','I'],['k','itemCount','I'],['f','pressedPointerButton','I'],
])field('dl',original,type,to,'Constructor, keyboard navigation, pointer update and explicit selection restore track these state roles.');
method('dl','b','(B)V','pollNavigationKeys','Clears input and wraps selection for key codes 98/99 while no pointer button is held.',{0:'obfuscationGuard'});
method('dl','a','(IB)V','pollNavigationKeysWithFallback','Wraps key codes 96/97 and uses fallback selection for 98/99 if current selection is negative.',{0:'fallbackIndex',1:'obfuscationGuard'});
method('dl','a','(Z)Z','isPointerPressed','Reports nonzero pressedPointerButton for canonical false.',{0:'obfuscationGuard'});
method('dl','d','(B)Z','hasActivationInput','Reports a new pointer press or key code 83/84.',{0:'obfuscationGuard'});
method('dl','a','(IZ)V','selectIndex','Keyboard/programmatic selection changes only when a pointer button is not held.',{0:'index',1:'obfuscationGuard'});
method('dl','c','(I)V','pollKeyForButtonState','Clears input and records the global key only when pointer state matches the argument.',{0:'pointerButton'});
method('dl','a','(I)Z','isIncrementKeyPressed','Reports captured key code 97 for canonical -98.',{0:'obfuscationGuard'});
method('dl','a','(B)Z','isDecrementKeyPressed','Reports captured key code 96; retains the original noncanonical state mutation.',{0:'obfuscationGuard'});
method('dl','a','(III)V','updatePointerSelection','Captures new presses, counts repeat delay and updates hover selection after release; validates upper index bounds.',{0:'previousButton',1:'pressedIndex',2:'hoverIndex'});
method('dl','a','(IZII)V','restoreSelection','Restores pointer state and chooses the pointer or fallback index according to its boolean.',{0:'fallbackIndex',1:'pointerDriven',2:'pointerIndex',3:'pointerButton'});
constructorParameters('dl','(I)V',['itemCount'],'Constructor stores selectable item count and starts selection at zero.');
constructorParameters('ci','(I)V',['tutorialStage'],'Constructor loads this stage item list and stage-specific resources.');
method('ci','d','(Z)V','clearSelectionResources','Clears selected index and stage-specific transient resources.',{0:'obfuscationGuard'});
method('ci','a','(IZI)V','restoreStageSelection','Restores selection, resets transient coordinates and reloads resources for relevant stages.',{0:'obfuscationGuard',1:'pointerDriven',2:'fallbackIndex'});
method('ci','c','(III)Ljava/lang/String;','formatCoordinatePair','Formats two coordinates without changing their values.',{0:'x',1:'obfuscationGuard',2:'y'});
method('ci','a','(ZI)I','getItemLeftX','Stage-specific left bound; defaults to the centered stage layout and delegates campaign panels to their existing layout helpers.',{0:'obfuscationGuard',1:'itemIndex'});
method('ci','a','(II)I','getItemRightX','Stage-specific right bound, including special campaign/setup panels.',{0:'itemIndex',1:'obfuscationGuard'});
method('ci','a','(IZ)I','getItemTopY','Stage-specific item Y; the default adds itemIndex times spacing to the centered top bound.',{0:'itemIndex',1:'obfuscationGuard'});
method('ci','d','(II)I','getItemHeight','Default height 30, stage-16 height 20, with delegated setup/campaign row heights.',{0:'obfuscationGuard',1:'itemIndex'});
method('ci','e','(II)Ljava/lang/String;','getItemText','Looks up an item text ID and applies its stage/client-state substitutions.',{0:'itemId',1:'obfuscationGuard'});
method('ci','b','(ZII)V','drawStageItem','Draws the item text, highlight palette, optional icon and volume percentage bars.',{0:'highlighted',1:'itemIndex',2:'obfuscationGuard'});

field('ft','k','I','first','Constructor stores the first component, used for X coordinates or widths by layout callers.');
field('ft','n','I','second','Constructor stores the second component, used for Y coordinates or heights by layout callers.');
constructorParameters('ft','(II)V',['first','second'],'The pair constructor stores both components unchanged.');
for(const [original,to,type] of [
  ['f','iconIndex','I'],['c','icon','Lwk;'],['k','label','Ljava/lang/String;'],['g','description','Ljava/lang/String;'],
  ['j','parent','Lrg;'],['e','indexInParent','I'],['a','children','[Lrg;'],['i','spellIds','[I'],
])field('rg',original,type,to,'SpellMenuGroup constructors link child groups or register leaf spell IDs; radial rendering uses these icons and labels.');
field('ct','o','[Lrg;','spellMenuById','Leaf SpellMenuGroup constructors register each of their spell IDs in this lookup.');
field('bm','D','Lrg;','spellMenuRoot','ul builds the complete spell-menu hierarchy here.');
field('ts','j','Lrg;','currentSpellMenu','Tutorial spell selection reads this group, its parent and its leaf/child entries.');
constructorParameters('rg','(ILjava/lang/String;Ljava/lang/String;[I)V',['iconIndex','label','description','spellIds'],'Leaf constructor stores icon/labels and registers spell IDs; it retains the supplied array.');
constructorParameters('rg','(ILjava/lang/String;Ljava/lang/String;[Lrg;)V',['iconIndex','label','description','children'],'Branch constructor assigns each child parent and index, retaining the supplied array.');
method('ul','a','(I)V','buildSpellMenu','Constructs the complete nested menu; the caller supplies spell ID 17 for the final entry in the first weakness group.',{0:'finalWeaknessSpellId'});
method('rg','a','(IIIILci;II)I','drawRadialMenu','Draws children or leaf spells around a circle and returns the hovered selection code.',{0:'transition',1:'selectionFade',2:'horizontalOffset',3:'obfuscationGuard',4:'unusedTutorial',5:'previousSelection',6:'selectedChild'});
field('kr','E','Ldm;','matchSetupPanel','Stage-5 tutorial layout/text methods delegate to this initialized panel.');
field('kr','G','Lrk;','instructionsPanel','Stage-7 tutorial layout/text methods delegate to the instruction-page panel.');
for(const [original,to,type] of [
  ['N','itemIds','[I'],['j','itemIndexById','[I'],['t','itemLabels','[Ljava/lang/String;'],
  ['i','itemStarts','[Lft;'],['T','itemEnds','[Lft;'],['r','selectedIndex','I'],
  ['e','playerCount','I'],['I','computerPlayerCount','I'],['E','mapSizeSetting','I'],
  ['K','selectedPreviewIndex','I'],['v','option33Enabled','Z'],['q','previewSize','Lft;'],['l','previewRowSpacing','I'],
])field('dm',original,type,to,'Panel option setter, caption dispatch, item-ID lookup and item-bound accessors establish these roles; option 33 and preview encodings remain qualified.');
method('dm','a','(IBIIZIILjava/lang/String;)V','setOptions','Validates selection/count/size fields independently, then applies a nonempty start-caption override.',{0:'selectedIndex',1:'obfuscationGuard',2:'mapSizeSetting',3:'previewIndex',4:'option33Enabled',5:'computerPlayerCount',6:'playerCount',7:'startCaption'});
method('dm','j','(I)V','resetOptions','Resets selection, two-player count, size, computers, preview and option 33.',{0:'obfuscationGuard'});
method('dm','a','(I)V','initializeItemIds','Builds the setup item-ID table, including the four consecutive preview choices.',{0:'obfuscationGuard'});
method('dm','a','(B)V','buildItemIndex','Builds ID-to-index lookup with -1 for missing IDs; duplicate IDs retain the last index.',{0:'obfuscationGuard'});
method('dm','b','(II)I','findItemIndex','Looks up an item ID; preserves the original complement-based guard check.',{0:'obfuscationGuard',1:'itemId'});
method('dm','a','(Ljava/lang/String;B)V','setStartCaption','Updates item 7 only for a nonnull, nonempty caption and an available lookup/label table.',{0:'caption',1:'obfuscationGuard'});
method('dm','e','(B)V','loadItemLabels','Copies valid localized labels and the final preview heading from the source table.',{0:'obfuscationGuard'});
method('dm','i','(I)V','initializePanel','Sets default bounds, item IDs, geometry, options and transient panel state.',{0:'obfuscationGuard'});
method('dm','a','(IZ)I','getItemLeftX','Returns centered item start X or sentinel 1 for missing/negative coordinates.',{0:'itemIndex',1:'obfuscationGuard'});
method('dm','b','(ZI)I','getItemRightX','Returns centered item end X or sentinel 1; a false guard can return 39.',{0:'obfuscationGuard',1:'itemIndex'});
method('dm','a','(II)I','getItemTopY','Returns centered item start Y or sentinel 1; preserves the noncanonical guard return.',{0:'itemIndex',1:'obfuscationGuard'});
method('dm','a','(ZI)I','getItemHeight','Returns positive raw end Y minus start Y, otherwise sentinel 1.',{0:'obfuscationGuard',1:'itemIndex'});
method('dm','b','(B)Lft;','getPanelStart','Returns component-wise nonnegative minima from itemStarts; incomplete bounds return (1,1).',{0:'obfuscationGuard'});
method('dm','h','(B)Lft;','getPanelEnd','Returns component-wise nonnegative maxima from itemEnds; incomplete bounds return (1,1).',{0:'obfuscationGuard'});
method('dm','h','(I)I','getPreviewRowHeight','Adds the preview height and spacing, preserving negative/overflow sentinel handling.',{0:'obfuscationGuard'});
for(const [original,to,type] of [
  ['w','itemIds','[I'],['N','pageIndex','I'],['p','pageCount','I'],['X','cachedPageSprites','[Lwk;'],['f','cachedPageIndex','I'],
  ['Z','footerStart','Lft;'],['n','footerEnd','Lft;'],['R','navigationStart','Lft;'],['b','navigationEnd','Lft;'],
  ['d','firstPreviewUnit','Ljd;'],['q','secondPreviewUnit','Ljd;'],['W','auxiliaryPreviewUnit','Ljd;'],
])field('rk',original,type,to,'Instruction table loading, page-sprite caching, sample-unit construction and item-ID-specific navigation/footer bounds.');
method('rk','n','(I)V','initializePanel','Sets page zero, missing page count, default navigation/footer bounds and item IDs, then clears interaction flags.',{0:'obfuscationGuard'});
method('rk','b','(IIII)Ljd;','createPreviewUnit','Validates unit type and player palette, then creates a detached unit with base maximum and one-less strength clamped to one.',{0:'unitType',1:'obfuscationGuard',2:'unusedValue',3:'playerId'});
method('rk','a','(IB)I','getItemLeftX','Returns navigation/footer left X, with item 23 centered on the surface.',{0:'itemIndex',1:'obfuscationGuard'});
method('rk','a','(ZI)I','getItemRightX','Returns navigation/footer right X, with item 22 stopping before the surface midpoint.',{0:'obfuscationGuard',1:'itemIndex'});
method('rk','g','(II)I','getItemTopY','Selects the navigation or footer Y for IDs 22/23 and 8.',{0:'obfuscationGuard',1:'itemIndex'});
method('rk','a','(IZ)I','getItemHeight','Returns the selected row end Y minus start Y, preserving negative heights.',{0:'itemIndex',1:'obfuscationGuard'});
method('rk','e','(B)Lft;','getPanelStart','Returns minima of navigation/footer starts, requiring all four bounds.',{0:'obfuscationGuard'});
method('rk','a','(B)Lft;','getPanelEnd','Returns maxima of navigation/footer ends, requiring all four bounds.',{0:'obfuscationGuard'});
method('rk','o','(I)I','getRowSpacing','Returns the difference between row start Y coordinates when both are valid and distinct.',{0:'obfuscationGuard'});
for(const [owner,signature,items] of [
  ['rg','a(IIIILci;II)I',[[15,'var8_int','angularPhase'],[17,'var9','hoveredSelection'],[18,'var10','extraRadius'],[19,'var11','opacity'],[20,'var12','entryCount'],[21,'var13','spellIndex'],[22,'var14','iconX'],[23,'var15','iconY'],[24,'var16','branchControl'],[25,'var17','childIndex']]],
  ['rg','<init>(ILjava/lang/String;Ljava/lang/String;[I)V',[[0,'var5_int','spellIndex']]],
  ['rg','<init>(ILjava/lang/String;Ljava/lang/String;[Lrg;)V',[[0,'var5_int','childIndex']]],
  ['dm','a(B)V',[[0,'var2','maximumId'],[1,'var3','maximumScanIndex'],[2,'var4','itemId'],[3,'var3Lifetime1','lookupIndex'],[4,'var3Lifetime2','itemIndex']]],
  ['rk','b(IIII)Ljd;',[[0,'var5','tileX'],[1,'var6','tileY'],[2,'var7','maximumStrength'],[3,'var8','strength'],[4,'var9','packedStatusFlags'],[5,'var10','bonusStrength'],[6,'var11','battlefield'],[7,'var12','detached'],[8,'var13','previewUnit']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and radial layout, hierarchy linking, reverse item lookup or detached preview construction data flow.');

field('up','b','[[Ljava/lang/String;','instructionSectionTitles','InstructionsPanel indexes these by page and section before drawing its section title.');
field('up','g','[[[Ljava/lang/String;','instructionRowHeadings','InstructionsPanel indexes page/section/row heading strings, including null placeholders.');
field('up','c','[[[[Ljava/lang/String;','instructionParagraphs','Page/section/row arrays contain paragraph lines and null illustration-only placeholders.');
field('go','f','[[[I','instructionIllustrationModes','InstructionsPanel dispatches these per-page/section/row mode values to illustration layout.');
field('da','a','[[[I','instructionIllustrationArguments','Parallel per-row arguments select illustrated types/variants; negative markers retain their original meaning.');
method('rk','k','(I)V','drawPageSections','Draws each available section from the parallel instruction tables; retains the special page-9 skip.',{0:'obfuscationGuard'});
method('rk','a','(Ljava/lang/String;[[Ljava/lang/String;I[III[Ljava/lang/String;[I)I','drawInstructionSection','Draws an optional section title, then its heading/paragraph rows and illustration metadata.',{0:'title',1:'paragraphs',2:'sectionIndex',3:'illustrationModes',4:'topY',5:'obfuscationGuard',6:'rowHeadings',7:'illustrationArguments'});
method('rk','a','([Ljava/lang/String;[[Ljava/lang/String;I[I[IBI)I','drawInstructionRows','Draws row headings, paragraphs and illustrations from their parallel arrays.',{0:'headings',1:'paragraphs',2:'topY',3:'illustrationModes',4:'illustrationArguments',5:'obfuscationGuard',6:'sectionIndex'});
for(const [original,to,type] of [
  ['hb','highlightPulse','Lhh;'],['u','illustrationCounter','Lem;'],['H','secondaryIllustrationCounter','Lem;'],['L','progressCounter','Lem;'],['ab','illustrationAnimation','Lvj;'],
  ['h','firstPreviewModel','Lhr;'],['M','secondPreviewModel','Lhr;'],['v','auxiliaryPreviewModel','Lhr;'],
  ['o','previousEnabled','Z'],['I','nextEnabled','Z'],['j','previousHighlighted','Z'],['Q','nextHighlighted','Z'],['P','footerHighlighted','Z'],
  ['O','footerCaption','Ljava/lang/String;'],['k','previousCaption','Ljava/lang/String;'],['eb','nextCaption','Ljava/lang/String;'],
])field('rk',original,type,to,'Instruction page setup, illustration updates and navigation drawing; TutorialController passes availability for item IDs 22/23 and selection highlights ID 8 in the footer.');
method('rk','a','(BIZZ)V','configureNavigation','Clears prior flags, sets previous/next availability and highlights the selected item ID.',{0:'obfuscationGuard',1:'selectedItem',2:'nextEnabled',3:'previousEnabled'});
method('rk','a','(Ljava/lang/String;ZIIZI)V','updatePageState','Selects a valid page, configures navigation, advances illustration counters and rebuilds page-specific assets.',{0:'footerCaption',1:'previousEnabled',2:'obfuscationGuard',3:'selectedItem',4:'nextEnabled',5:'pageIndex'});
method('rk','d','(B)V','drawPanel','Draws instruction content, navigation and footer when page count has been initialized.',{0:'obfuscationGuard'});
method('ci','a','(BI)Z','isItemEnabled','Disables instruction previous/next items at the page boundaries; other stages retain their existing availability.',{0:'obfuscationGuard',1:'itemIndex'});
method('ci','e','(I)V','updateInstructionsPanel','Derives previous/next availability from stage item IDs and updates the selected instruction page.',{0:'obfuscationGuard'});
method('ci','f','(I)V','drawInstructionsPanel','Draws the initialized instruction panel with its original guards.',{0:'obfuscationGuard'});
field('em','a','I','elapsedTicks','advanceAndCheck increments this once; reset clears it and constructor starts at zero.');
field('em','f','I','limit','Counter completion compares elapsedTicks against this unchanged constructor argument.');
method('em','c','(I)Z','advanceAndCheck','Advances the counter unless the original complement-based guard rejects it; returns whether limit is reached.',{0:'obfuscationGuard'});
method('em','b','(I)V','reset','Clears elapsedTicks, retaining the original noncanonical static-string side effect.',{0:'obfuscationGuard'});
method('em','a','(Lkl;I)V','loadClientAssets','Partitioned static asset/configuration loader; unrelated to the instance tick counter.',{0:'archive',1:'obfuscationGuard'});
constructorParameters('em','(I)V',['limit'],'Stores the limit without clamping zero or negative values.');
for(const [original,to,type] of [['k','counter','Lem;'],['h','minimum','I'],['b','maximum','I'],['g','value','I']])field('hh',original,type,to,'Pulse initialization, two-half integer interpolation and ordered minimum/maximum clamp assignments.');
method('hh','a','(IBII)V','configure','Applies original range/period defaults; maximum fallback can remain below a large minimum.',{0:'minimum',1:'obfuscationGuard',2:'maximum',3:'period'});
method('hh','b','(B)V','advance','Advances/resets the counter and interpolates/clamps the pulse; half-period zero still divides by zero.',{0:'obfuscationGuard'});
method('hh','a','(I)Z','isRisingHalf','Reports whether the counter is at or before half its period.',{0:'obfuscationGuard'});
method('hh','c','(I)I','getValue','Returns a valid byte-range value for the canonical guard, otherwise the original sentinels.',{0:'obfuscationGuard'});
constructorParameters('hh','(III)V',['minimum','maximum','period'],'Delegates to pulse configuration with canonical byte guard.');
for(const [original,to,type] of [
  ['a','frameIds','[I'],['d','frameDurations','[I'],['g','loopStartFrame','I'],['j','maximumLoops','I'],['b','unlimitedLoops','Z'],
  ['i','opcode3Values','[I'],['e','opcode13Rows','[[I'],
])field('qb',original,type,to,'Sequence opcode decoder and AnimationPlayer frame/loop consumption; opcode-3/13 data retains qualified names because its finer role is unresolved.');
method('qb','a','(ILvh;)V','decode','Reads opcode/payload records until the zero terminator.',{0:'obfuscationGuard',1:'packet'});
method('qb','a','(ILvh;I)V','decodeOpcode','Decodes frame IDs/durations, loop settings, retained data and consumed legacy fields.',{0:'obfuscationGuard',1:'packet',2:'opcode'});
for(const [original,to,type] of [
  ['f','sequence','Lqb;'],['m','frameIndex','I'],['i','frameId','I'],['e','ticksRemaining','I'],['d','completedLoops','I'],
  ['c','frameChanged','Z'],['l','scheduledSequences','[Lqb;'],['k','scheduledDelays','[I'],['h','scheduledSlot','I'],
])field('vj',original,type,to,'Sequence selection, per-call frame countdown and delayed sequence-ring consumption.');
method('vj','a','(I)Z','advance','Advances delays/countdown, changes frames and reports completion; preserves post-completion state.',{0:'obfuscationGuard'});
method('vj','a','(B)Z','advanceFrame','Advances frame index and loop count, honoring finite/unlimited and invalid-loop-start behavior.',{0:'obfuscationGuard'});
method('vj','a','(Z)V','resetFrameState','Resets frame index/ID, countdown and loop count without clearing the selected sequence.',{0:'frameChanged'});
method('vj','a','(ILqb;)V','selectSequence','Resets frame state, selects frame zero and stores the supplied scheduled-slot value.',{0:'scheduledSlot',1:'sequence'});
method('vj','a','(ZZZLkk;)Lkk;','applyCurrentFrame','Copies the supplied model and applies its current packed frame ID using the existing frame set.',{0:'copyVariant',1:'obfuscationGuard',2:'frameVariant',3:'model'});
constructorParameters('vj','(I)V',['scheduledCapacity'],'Creates parallel sequence/delay ring arrays and starts scheduledSlot at -1.');
for(const [original,to,type] of [
  ['a','model','Lgd;'],['c','unitType','I'],['f','animationIndex','I'],['j','yaw','I'],['e','screenPosition','[I'],
  ['g','animationPlayer','Lvj;'],['l','animationAvailable','Z'],['k','projectionVariant','Z'],
])field('hr',original,type,to,'Preview model/animation selection, yaw bounds, screen placement and alternate projection depth.');
field('mn','k','[[Lkk;','unitModels','UnitModelPreview selects model zero from the unit-type indexed model table.');
field('nh','D','[Z','unitProjectionVariants','UnitModelPreview uses the selected unit-type flag to choose its projection depth.');
method('hr','a','(BI)V','setUnitType','Clamps out-of-range types to zero and selects the first model and projection flag.',{0:'obfuscationGuard',1:'unitType'});
method('hr','a','(ZI)V','setYaw','Accepts only yaw values 0 through 2047; preserves the static guard side effect.',{0:'obfuscationGuard',1:'yaw'});
method('hr','a','(IIB)V','setScreenPosition','Stores both screen coordinates without clamping.',{0:'screenX',1:'screenY',2:'obfuscationGuard'});
method('hr','a','(II)V','selectAnimation','Selects an animation index with original invalid-index fallback and sequence loading.',{0:'obfuscationGuard',1:'animationIndex'});
method('hr','a','(IB)V','selectAnimationAndAdvance','Selects the animation, advances one call and installs its frame set.',{0:'animationIndex',1:'obfuscationGuard'});
method('hr','a','(B)V','loadSequence','Loads the unit-type/animation-index sequence and selects it when available.',{0:'obfuscationGuard'});
method('hr','a','(I)V','installFrameSet','Loads the frame set using the high 16 bits of the current packed frame ID.',{0:'obfuscationGuard'});
method('hr','a','(ZZII)V','drawModel','Copies/scales the current unit model and applies animation, yaw, projection and optional highlighting.',{0:'copyVariant',1:'highlighted',2:'screenX',3:'screenY'});
constructorParameters('hr','(I)V',['unitType'],'Creates the preview with default yaw 1792.');
constructorParameters('hr','([III)V',['unusedColors','unitType','yaw'],'The original constructor ignores its array and initializes model type and yaw.');
for(const [owner,signature,items] of [
  ['hh','b(B)V',[[0,'var2','halfPhase'],[1,'var3','halfPeriod'],[2,'var4','risingHalf'],[3,'var5','phaseStart'],[4,'var6','phaseEnd']]],
  ['qb','a(ILvh;I)V',[[0,'array$0','rowValues'],[1,'var7','wordIndex'],[6,'var4_int','elementCount'],[8,'var5','elementIndex'],[9,'var6','rowLength']]],
  ['rk','k(I)V',[[0,'var8','sectionIndex'],[1,'var2','titles'],[2,'var3','rowHeadings'],[3,'var4','paragraphs'],[4,'var5','illustrationModes'],[5,'var6','illustrationArguments'],[6,'var7','topY'],[7,'var9','sectionHeight'],[9,'var11','sectionTitles']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and pulse interpolation, sequence record shape or instruction-section table data flow.');

members['F:om.field_m:I'].evidence='Tagged key gt; CampaignProgress passes it as the target-turn denominator in calculateMissionScore. Earlier gameType naming was unsupported.';
members['F:om.field_F:I'].evidence='Tagged key gd; CampaignProgress passes it as the target-damage denominator in calculateMissionScore. Earlier godSetting naming was unsupported.';
for(const [original,to,type] of [
  ['a','spellQuantities','[I'],['d','equippedSpellIds','[I'],['b','unitUnlockMasks','[I'],
  ['c','runeCredit','I'],['k','runeDebit','I'],['j','progressionCredit','I'],['g','campaignProgress','Lcm;'],
])field('hm',original,type,to,'Profile decoder and purchase UI: available runes are credit minus debit; unlock level uses progressionCredit plus runeCredit. Accounting names describe formulas without assuming server-side ledger semantics.');
field('pg','d','Lhm;','playerProfile','Login/profile updates install this object; spell and unit purchase menus query it.');
field('at','c','[I','unlockLevelCosts','Profile legacy-level reconstruction and cumulative unlock-level calculation use these per-level costs.');
method('hm','a','(Lvh;IZ)I','decode','Reads profile versions 0 through 9, optional spell quantities and versioned campaign results.',{0:'packet',1:'obfuscationGuard',2:'includeSpellQuantities'});
method('hm','a','(B)I','getAvailableRunes','Returns runeCredit minus runeDebit with original Java int wrapping.',{0:'obfuscationGuard'});
method('hm','a','(IB)Z','tryDebitRunes','When available runes cover the amount, adds it to runeDebit; retains negative-amount behavior.',{0:'amount',1:'obfuscationGuard'});
method('hm','a','(I)I','getUnlockLevel','Subtracts cumulative per-level costs from progressionCredit plus runeCredit, beginning at the supplied index.',{0:'startLevel'});
constructorParameters('hm','(Lvh;Z)V',['packet','includeSpellQuantities'],'Initializes arrays/defaults then decodes a versioned profile.');
field('cm','d','[[Lho;','resultsByCampaign','Three lazily allocated 64-slot result arrays indexed by campaign and mission.');
field('ho','b','I','turnsTaken','Own toString diagnostic and campaign score argument.');
field('ho','c','I','damageTaken','Own toString diagnostic and campaign score argument.');
constructorParameters('ho','(II)V',['turnsTaken','damageTaken'],'Result constructor stores both scoring metrics unchanged.');
method('cm','a','(ILvh;I)V','decode','Reads a campaign mask and byte-indexed result records terminated by 255; pre-version-7 results use turnsTaken 2000.',{0:'profileVersion',1:'packet',2:'obfuscationGuard'});
method('cm','a','(IIIII)V','setResult','Creates campaign slots lazily; both -1 or both 65535 metrics remove the selected result.',{0:'obfuscationGuard',1:'missionIndex',2:'turnsTaken',3:'campaignIndex',4:'damageTaken'});
method('cm','a','(III)I','getMissionScore','Looks up mission targets and result metrics, returning zero for an absent result.',{0:'campaignIndex',1:'obfuscationGuard',2:'missionIndex'});
method('cm','a','(ZI)I','getCampaignScore','Sums mission scores using the cached campaign definition.',{0:'obfuscationGuard',1:'campaignIndex'});
method('b','a','(IIIBI)I','calculateMissionScore','Normalizes turns and damage against their mission targets with separate bonus curves and score limits; zero targets return 1.',{0:'turnTarget',1:'damageTarget',2:'damageTaken',3:'obfuscationGuard',4:'turnsTaken'});
field('cf','n','[Lom;','missions','Campaign loader and score lookup index this by mission ID.');
field('cf','q','[Lsd;','participants','Campaign loader registers participants by their ID; mission names and overrides use this table.');
field('cf','r','I','campaignIndex','Indexes loaded campaigns, map archive names and availability checks.');
field('cf','l','Ljava/lang/String;','localPlayerName','CampaignMission participant-name construction uses this label for the local player slot.');
constructorParameters('cf','(Ljava/lang/String;)V',['name'],'Campaign constructor retains the first header string as its name.');
field('cf','k','Ljava/lang/String;','name','Constructor/header string displayed by campaign menu consumers.');
field('om','G','Lcf;','campaign','Mission map loading and local/other participant names refer to this parent campaign.');
field('cd','a','[Lcf;','campaigns','Campaign loader registers definitions here; br lookup retrieves them by index.');
method('br','a','(IB)Lcf;','getCampaign','Returns the cached campaign at the supplied index.',{0:'campaignIndex',1:'obfuscationGuard'});
method('om','e','(I)[Ljava/lang/String;','getParticipantNames','Uses the campaign local-player name or the referenced participant display name for each slot.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['m','participantId','I'],['u','displayName','Ljava/lang/String;'],['q','coatOfArms','Lln;'],['k','unitOverrides','[Lid;'],['o','overrideCount','I']])field('sd',original,type,to,'Participant packet reader, mission participant-name lookup and shared unit-override append loop.');
method('ks','a','(ILcf;Lvh;)Lsd;','readCampaignParticipant','Reads participant ID/name, retained integer arrays and coat; the campaign argument is diagnostic-only.',{0:'obfuscationGuard',1:'campaign',2:'packet'});
method('em','a','(Lcf;BLbv;)V','readCampaignUnitOverride','Reads one unit override and appends the same object to every referenced participant, growing arrays by ten.',{0:'campaign',1:'obfuscationGuard',2:'packet'});
field('ln','a','[I','parts','Coat setters/query formatting and packet writer serialize six part choices.');
field('ln','b','[I','colourIndices','Parallel colour indices are serialized directly beside the six part choices.');
constructorParameters('ln','([I[I)V',['parts','colourIndices'],'Constructor retains both caller arrays without copying.');
method('ln','a','(III)V','setPart','Updates a part for guard at least 52, preserving array bounds behavior.',{0:'obfuscationGuard',1:'partId',2:'layer'});
method('ln','a','(IIB)V','setColour','Updates a layer colour; noncanonical guards retain their array-clearing side effect.',{0:'layer',1:'colourIndex',2:'obfuscationGuard'});
method('ln','a','(B)Ljava/lang/String;','toQueryString','Formats coat= followed by colon-delimited part/colour pairs over the part-array length.',{0:'obfuscationGuard'});
method('ln','b','(B)I','getMissingPartOffset','Returns -20 when layer 4 is absent, otherwise zero with the original guard arithmetic.',{0:'obfuscationGuard'});
field('ha','T','[Lln;','playerCoats','Legacy snapshots read and write one coat for every player.');
field('ah','a','Lln;','localCoat','Local coat editing and its outgoing packet use this instance.');
method('ir','a','([IBLvh;[I)V','writeCoatOfArms','Writes six part/colour pairs as bytes; low-byte truncation remains unchanged.',{0:'parts',1:'obfuscationGuard',2:'packet',3:'colourIndices'});
method('tb','a','([ILvh;Z[I)V','readCoatOfArms','Reads six part/colour byte pairs; part 255 becomes -1 and colours stay unsigned.',{0:'parts',1:'packet',2:'obfuscationGuard',3:'colourIndices'});
for(const [owner,signature,items] of [
  ['hm','a(Lvh;IZ)I',[[5,'var4_int','version'],[8,'var6','spellIndex'],[9,'var7','levelCost'],[11,'var5Lifetime1','legacyLevel'],[12,'var6Lifetime1','levelIndex'],[13,'var6Lifetime2','spellSlot'],[14,'var6Lifetime3','unlockGroup']]],
  ['cm','a(ILvh;I)V',[[0,'dupTemp$1','nextMissionId'],[1,'var4_int','campaignMask'],[2,'var5','campaignIndex'],[3,'var6','missionIndex'],[4,'var7','turnsTaken'],[5,'var8','damageTaken'],[6,'var9','legacyDamage']]],
  ['b','a(IIIBI)I',[[0,'var5','turnScore'],[1,'var6','turnBonus'],[2,'var7','damageBonus'],[3,'var6Lifetime1','damageScore']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and versioned profile/result packet or mission-score normalization data flow.');
field('g','b','Ljava/lang/Throwable;','originalCause','Constructor stores the wrapped throwable here rather than passing it to RuntimeException.');
field('g','g','Ljava/lang/String;','context','addExceptionContext appends space-separated context to this field when reusing a wrapper.');
constructorParameters('g','(Ljava/lang/Throwable;Ljava/lang/String;)V',['originalCause','context'],'Stores the supplied cause and context without changing standard exception-chain behavior.');
method('ig','a','(Ljava/lang/Throwable;Ljava/lang/String;)Lg;','addExceptionContext','Reuses a contextual wrapper and appends context, or creates a new wrapper for another throwable.',{0:'cause',1:'context'});
field('sd','t','[I','godFavourLevels','Battlefield campaign setup copies these six levels into each selected god favour slot.');
field('cf','s','I','localGodId','Battlefield campaign setup uses this as the local player chosen-god entry.');
method('uq','a','(Lvh;Z)Lln;','readSignedCoatOfArms','Reads six signed part/colour bytes for campaign participants; distinct from the unsigned snapshot reader.',{0:'packet',1:'obfuscationGuard'});
method('ev','a','(Lvh;B)[I','readNullableUnsignedByteArray','Reads a byte count and unsigned elements, returning null for count zero.',{0:'packet',1:'obfuscationGuard'});
method('en','a','(Lvh;B)[I','readUnsignedByteArray','Reads a byte count and unsigned elements, retaining an empty array for count zero.',{0:'packet',1:'obfuscationGuard'});
method('gt','a','(ILvh;)[I','readSixUnsignedBytes','Reads exactly six unsigned byte values for campaign god favour levels.',{0:'obfuscationGuard',1:'packet'});

members['F:om.field_D:[I'].evidence='Tagged rwd; campaign loadout converts IDs to unit unlock bits and reward previews use unit display names/icons.';
field('ha','bb','F','campaignManaMultiplier','Campaign loadout installs the accumulated multiplier; Battlefield scales incoming mana changes by it.');
field('cf','o','Ljava/lang/String;','description','Campaign menu copies this header string into the same detail text field used for mission descriptions.');
field('cf','p','[I','initialUnitTypes','Campaign loadout converts these unit IDs into initial category/ordinal unlock masks.');
field('sd','p','[I','availableUnitTypes','Campaign setup converts each ID to a unit unlock mask; mission preview also lists their unit categories.');
field('sd','n','[I','equippedSpellIds','Campaign setup copies this array into the per-player spell loadouts passed to Battlefield.');
field('om','l','I','rewardSpellId','Tagged tr; completed-mission loadout reads spellDefinitions and reward preview uses its spell icon/name.');
field('om','u','I','manaBonusPercent','Tagged mbr; completed missions add this value divided by 100 to the battlefield multiplier.');
method('ic','a','(Lom;B[I[I)F','buildCampaignLoadout','Clears/rebuilds unit masks from initial units and scored missions, merges rewarded spells and returns the cumulative mana multiplier.',{0:'mission',1:'obfuscationGuard',2:'equippedSpellIds',3:'unitUnlockMasks'});
method('mh','a','(III)I','getProfileMissionScore','Returns zero without a profile/progress object; otherwise queries stored campaign progress.',{0:'campaignIndex',1:'obfuscationGuard',2:'missionIndex'});
method('im','a','(Lom;I)I','getProfileMissionScore','Delegates using the mission parent campaign index and mission ID.',{0:'mission',1:'obfuscationGuard'});
method('ar','a','(III)Lom;','getCampaignMission','Returns null for a missing campaign or mission outside the supplied lower bound and mission array.',{0:'campaignIndex',1:'missionIndex',2:'minimumMissionIndex'});
method('jv','a','(ZI)I','getUnitUnlockGroup','Finds the unit ID in unitUnlockGroups; missing IDs retain the original group-zero fallback.',{0:'obfuscationGuard',1:'unitType'});
method('b','a','(ZI)I','getUnitUnlockOrdinal','Finds the unit ID within its unlock group; missing IDs retain ordinal-zero fallback.',{0:'obfuscationGuard',1:'unitType'});
field('wp','H','[[I','unitUnlockGroups','Unit group/ordinal lookup scans these rows before setting the corresponding unlock bit.');
method('nu','a','(ILkl;I)Lcf;','loadCampaign','Reads missions archive header, participant IDs, shared overrides and tagged missions, registering the campaign cache.',{0:'obfuscationGuard',1:'archive',2:'campaignIndex'});
method('lf','a','(Lcf;Lbv;Lkl;B)Lom;','readCampaignMission','Decodes a tagged mission then assigns its parent campaign and map archive.',{0:'campaign',1:'packet',2:'archive',3:'obfuscationGuard'});
field('om','H','Lkl;','mapArchive','Mission map loading retrieves map resources from this archive, installed by readCampaignMission.');
method('om','g','(I)Lfu;','createRewardPreview','Builds the existing preview from unit rewards, spell reward and mana bonus.',{0:'obfuscationGuard'});
constructorParameters('fu','([III)V',['rewardUnitTypes','rewardSpellId','manaBonusPercent'],'Chooses the first unit reward before spell reward before a positive mana bonus.');
for(const [original,to,type] of [['h','icon','Lwk;'],['c','title','Ljava/lang/String;'],['i','description','Ljava/lang/String;']])field('fu',original,type,to,'Reward constructor populates sprite, display name and explanatory text for the selected reward.');
for(const [owner,signature,items] of [
  ['ic','a(Lom;B[I[I)F',[[11,'var5_float','manaMultiplier'],[13,'var6','insertedSpellCount'],[14,'var7_int','maskIndex'],[15,'var7','initialUnits'],[16,'var7_array','campaignMissions'],[17,'var8','initialUnitIndex'],[18,'var9_int','initialUnitType'],[19,'var9','completedMission'],[20,'var10','initialUnlockGroup'],[21,'var10_ref_int__','rewardUnits'],[22,'var11','initialUnlockOrdinal'],[23,'var12','rewardUnitType'],[24,'var13','rewardUnlockGroup'],[25,'var14','rewardUnlockOrdinal'],[27,'var8Lifetime1','missionIndex'],[28,'var10Lifetime1','rewardSpell'],[29,'var11Lifetime1','rewardUnitIndex'],[30,'var12Lifetime1','equippedSpell'],[31,'var11Lifetime1Lifetime1','spellSlot']]],
  ['nu','a(ILkl;I)Lcf;',[[7,'var4','packet'],[8,'var5','campaignName'],[9,'var6','localGodId'],[10,'var7','localPlayerName'],[11,'var8','description'],[12,'var9','initialUnitTypes'],[13,'var10','campaign'],[14,'var11','participantCount'],[15,'var12','participantIndexThenOverrideCount'],[16,'var13','overrideIndexThenMissionCount'],[18,'var14','participantThenMissionIndex'],[23,'var19','decodedParticipant'],[24,'var20','participants'],[25,'var21','participant'],[26,'var22','decodedMission']]],
  ['lf','a(Lcf;Lbv;Lkl;B)Lom;',[[0,'var4','mission']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and campaign archive/loadout data flow; reused counters retain both roles.');

for(const [original,to,type] of [['k','entryId','I'],['B','width','I'],['o','height','I'],['y','left','I'],['x','top','I'],['D','godId','I'],['w','title','Ljava/lang/String;'],['q','description','Ljava/lang/String;'],['r','statusText','Ljava/lang/String;'],['A','score','I'],['l','selectable','Z'],['p','mission','Lom;'],['n','previewUnitCategories','Lbg;'],['m','previewSprite','Lwk;'],['s','highlightSprite','Lwk;'],['t','highlightProgress','I'],['v','selectionAge','I']])field('cq',original,type,to,'Campaign/mission constructors and menu rendering, selection, score updates, preview bounds and category enumeration.');
constructorParameters('cq','(Lom;)V',['mission'],'Creates a mission entry and indexes unit categories from non-local tiles and listed participant availability.');
constructorParameters('cq','(ILjava/lang/String;)V',['entryId','title'],'Creates a campaign/quicksave card with the original selection-age sentinel.');
method('cq','a','(III)Z','containsPoint','Inclusive hit rectangle after the centered horizontal/vertical offsets.',{0:'screenX',1:'screenY',2:'obfuscationGuard'});
method('cq','a','(Ljava/lang/Object;B)Ljava/lang/Class;','getBoxedPrimitiveType','Returns the Java primitive type for the eight boxed primitives; guard is checked after Integer.',{0:'value',1:'obfuscationGuard'});
for(const [original,to,type] of [['f','left','I'],['c','top','I'],['i','width','I'],['d','label','Ljava/lang/String;']])field('iq',original,type,to,'Button constructor, 30-pixel-high drawing and centered pointer hit rectangle.');
constructorParameters('iq','(Ljava/lang/String;III)V',['label','left','top','width'],'Retains button label and layout bounds.');
method('iq','a','(B)Z','containsPointer','Tests the shared pointer against the inclusive centered 30-pixel-high button rectangle.',{0:'obfuscationGuard'});
method('iq','a','(I)V','draw','Draws the button frame and label using pointer hover state.',{0:'textRenderParameter'});
for(const [original,to,type] of [['a','viewMode','I'],['l','campaignIndex','I'],['i','missionEntries','Lbg;'],['g','campaignEntries','Lbg;'],['b','selectedMissionEntry','Lcq;'],['d','selectedCampaignEntry','Lcq;'],['u','hoveredEntry','Lcq;'],['e','regionMap','Lpr;']])field('cv',original,type,to,'Campaign-menu state dispatch, cache lookup, selected entry handling and region-map rendering.');
method('cv','a','(IBI)V','updateMissionScore','Keeps larger scores except score 1 is always accepted; updates the displayed score string.',{0:'missionId',1:'obfuscationGuard',2:'score'});
method('cv','a','(II)Lcq;','getMissionEntry','Returns the indexed mission entry without creating it.',{0:'obfuscationGuard',1:'missionId'});
method('cv','a','(ILom;)V','addMissionEntry','Builds a mission entry, applies a positive profile score and registers it by ID.',{0:'obfuscationGuard',1:'mission'});
method('cv','b','(II)V','rebuildMissionEntries','Builds mission entries and determines selectable state from scored neighbors; assigns fallback card bounds.',{0:'campaignIndex',1:'obfuscationGuard'});
method('cv','a','(ZLcf;)Lcq;','buildCampaignEntry','Builds campaign title/description, availability, completion count and preview sprite, replacing a cached entry.',{0:'obfuscationGuard',1:'campaign'});
method('cv','a','(IZ)V','openCampaign','Loads campaign resources if needed, rebuilds missions and switches to mission view.',{0:'campaignIndex',1:'obfuscationGuard'});
method('cv','a','(IB)V','setViewMode','Sets the original numbered view and refreshes campaign/quicksave cards and footer state.',{0:'viewMode',1:'obfuscationGuard'});
method('cv','e','(B)V','draw','Dispatches campaign cards, mission map or quicksave confirmation views.',{0:'obfuscationGuard'});
method('cv','f','(B)V','handleInput','Handles pointer selections, mission launch/quicksave choices and original debug shortcuts.',{0:'obfuscationGuard'});
method('cv','c','(B)V','loadCampaignResources','Releases active controllers and loads campaign images, region maps and taken icons.',{0:'obfuscationGuard'});
method('cv','a','(I)V','releaseCampaignResources','Clears campaign image/region arrays and retains the original explicit GC call.',{0:'obfuscationGuard'});
method('cv','f','(I)V','resumeQuicksave','Starts the stored mission using its quicksave then restores turn-dependent tutorial state.',{0:'obfuscationGuard'});
method('cv','g','(I)V','openSelectedCampaign','Opens a selected campaign card or prepares its quicksave campaign view.',{0:'obfuscationGuard'});
method('om','e','(B)Z','requiresAllNeighborScores','Bit 2 makes mission selectability require all scored neighbors rather than any.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['c','bucketCount','I'],['a','buckets','[Ltc;'],['d','iterationBucket','I'],['f','iterationNext','Ltc;'],['e','lookupNext','Ltc;']])field('bg',original,type,to,'Hash-table sentinel allocation, masked bucket lookup and independent lookup/traversal cursors.');
constructorParameters('bg','(I)V',['bucketCount'],'Allocates exactly the requested bucket count; no power-of-two validation is added.');
method('bg','a','(IJ)Ltc;','get','Scans the bucket selected by key & (bucketCount-1), returning the first matching node.',{0:'obfuscationGuard',1:'key'});
method('bg','a','(Ltc;JI)V','put','Unlinks an already-linked node and appends it to the selected bucket; duplicate keys remain separate.',{0:'node',1:'key',2:'obfuscationGuard'});
method('bg','b','(I)Ltc;','first','Restarts bucket traversal and returns the first node.',{0:'obfuscationGuard'});
method('bg','b','(B)Ltc;','next','Continues insertion-order traversal within each bucket, then advances buckets.',{0:'obfuscationGuard'});
method('bg','c','(B)V','clear','Unlinks every stored node and clears both cursors.',{0:'obfuscationGuard'});
method('bg','a','(B)I','size','Counts stored nodes; noncanonical guards retain the original 109 result.',{0:'obfuscationGuard'});
for(const [owner,signature,items] of [
 ['cq','<init>(Lom;)V',[[0,'var4','playerSlotIndex'],[1,'var8','availableUnitIndex'],[7,'var3','tiles'],[8,'var4_ref_ne__','mapTiles'],[9,'var5','tileIndex'],[10,'var7','unitCategory'],[11,'var9','unitType'],[12,'var10','availableCategory'],[13,'var12','layout'],[14,'var13','tile'],[15,'var14','participant'],[16,'var18','availableUnits'],[17,'var5Lifetime1','participantId']]],
 ['cv','b(II)V',[[3,'var3','campaign'],[5,'var4_ref_om__','missions'],[6,'var4','initialLeft'],[7,'var5','missionIndex'],[8,'var6_ref_om','mission'],[9,'var6','left'],[10,'var7','top'],[11,'var8','lastColumnLeft'],[12,'var9','cardWidth'],[13,'var10','cardHeight'],[14,'var11','rowSpacing'],[15,'var12','columnSpacing'],[16,'var13','entry'],[17,'var14','requireAll'],[18,'var15','selectable'],[19,'var16','neighborIds'],[20,'var17','neighborIndex'],[21,'var18','neighborId'],[22,'var19','neighborHasScore'],[25,'var5Lifetime1','initialTop']]],
 ['cv','a(ILom;)V',[[1,'var3','entry'],[2,'var4','score']]],
 ['cv','a(IBI)V',[[1,'var4','entry']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and campaign entry construction, neighbor scoring or layout data flow.');

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
  for(const source of sources.values()) {
    const event=source.match(/\bclass\s+(\w+)\s+extends\s+(?:oj|mn|bd)\b/)?.[1];
    const condition=source.match(/\bclass\s+(\w+)\s+implements\s+lv\b/)?.[1];
    if(condition&&!classes[condition])throw new Error('Unreviewed match condition: '+condition);
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
    `This gameplay naming pass reviews ${Object.keys(classes).length} class identities across all ${mapping.files.length} compiled classes. Other class/member names remain unresolved. Unresolved packed flags use bit-position names without guessing gameplay effects. Renamed identifiers have no opaque suffixes; the dictionary records their original identities.`, '',
    '| Start here | Follow |','| --- | --- |',
    `| ${link('ha')} | Map geometry, player/team state, mana, turns, god favour and unit/event collections. |`,
    `| ${link('jd')} / ${link('ne')} / ${link('ca')} | Unit coordinates and strength; tile occupants, terrain, owners and tagged metadata. |`,
    `| ${link('go')} | Team membership and player lists. |`,
    `| ${link('ic')} → ${link('nn')} / ${link('ej')} | Gameplay coordination, movement planning and AI evaluation. |`,
    `| ${link('oj')} → ${link('st')} / ${link('as')} / ${link('vp')} | Event application, turn effects, ownership changes and mana. |`,
    `| ${link('kr')} / ${link('ns')} / ${link('ag')} / ${link('nw')} / ${link('hp')} | Movement, attacks, combat records, damage/poison and death. |`,
    `| ${link('mb')} / ${link('ec')} / ${link('kn')} / ${link('q')} / ${link('qq')} | Summoning, teleport variants and state changes. Event names follow their own diagnostic text. |`,
    `| ${link('rt')} / ${link('pj')} / ${link('kc')} | Revival, spell casts and turn changes. All 21 concrete GameEvent subclasses have reviewed names. |`,
    `| ${link('ik')} → ${link('wa')} / ${link('ra')} / ${link('al')} | Unit, action and global spells: definition IDs, payload serialization and effect lifecycle. |`,
    `| ${link('mn')} / ${link('bd')} | Action requests and prepared battlefield actions. |`,
    `| ${link('am')} / ${link('hw')} / ${link('jc')} / ${link('to')} / ${link('ee')} | Movement/attack, summoning, deployment, spell and Sphinx-assisted requests. |`,
    `| ${link('ld')} / ${link('be')} / ${link('pl')} / ${link('ua')} / ${link('pe')} / ${link('ur')} | Prepared actions queue their corresponding gameplay events. |`,
    `| ${link('il')} / ${link('ss')} / ${link('dk')} / ${link('kj')} | Turn-condition markers; their canonical application is a no-op. |`,
    `| ${link('vb')} → ${link('pa')} | Event dispatch, presentation frames and acknowledgement. |`,
    `| ${link('sk')} / ${link('qv')} / ${link('tb')} / ${link('ql')} | Combat, movement, effects and popups. |`,
    `| ${link('ej')} → ${link('cl')} / ${link('jb')} | Per-unit AI evaluation and selected actions. |`,
    `| ${link('sm')} → ${link('aw')} / ${link('ge')} | Highest-score and weighted candidate selection, recycling and reset. |`,
    `| ${link('vn')} / ${link('fi')} | Standalone combat sandbox and animated unit information popups. |`,
    `| ${link('tt')} → ${link('lv')} / ${link('up')} / ${link('mc')} / ${link('gm')} | Registered portal-loss, unit-loss and leader-escort conditions. |`,
    `| ${link('om')} → ${link('lo')} | Campaign metadata and encoded/decoded map layouts. |`,
    `| ${link('sc')} / ${link('bv')} / ${link('ga')} | Tagged version-2 map records, bit cursors and ISAAC ciphered opcodes. |`,
    `| ${link('ci')} → ${link('bo')} / ${link('dl')} | Tutorial stages, centered stage layout, keyboard/pointer selection, prompts and flashing controls. |`,
    `| ${link('rg')} / ${link('dm')} / ${link('rk')} | Nested spell-menu choices, match setup options and instruction-page layout/illustrations. |`,
    `| ${link('hr')} → ${link('vj')} / ${link('qb')} | Unit-model previews, animation playback and opcode-decoded frame sequences. |`,
    `| ${link('em')} / ${link('hh')} | Tick-based counters and triangular highlight pulses. |`,
    `| ${link('hm')} → ${link('cm')} / ${link('ho')} | Player inventory/rune accounting and versioned campaign results. |`,
    `| ${link('cf')} / ${link('sd')} / ${link('ln')} / ${link('fu')} | Campaign/participant metadata, loadouts, reward previews, shared unit overrides and coats of arms. |`,
    `| ${link('cv')} → ${link('cq')} / ${link('iq')} / ${link('bg')} | Campaign selection, mission entries, buttons and intrusive lookup/traversal. |`,
    `| ${link('vh')} / ${link('bv')} / ${link('uo')} | Packet data, ciphered opcodes and tagged-field decoding. |`, '',
    'Start with `Battlefield.getUnitAt`, `queueCombatConsequences`, `Unit.applyStrengthDamage`, `Spell.applyEffect` and `MovementPlanner.reconstructPath`. Grid indexing is `tileX + tileY * mapWidth`; `getUnitAt` keeps the original argument order (y, guard, x). Dummy guards and their side effects remain intact. `GameEvent.applyToBattlefield` names the complete resolved override family.','',
    'Combat payloads now name attacker/defender positions, offsets, damage, death flags and animation counts. The central consequence routine names its attacker/defender and healing/poison locals. Unit movement-spent and attacks-remaining state are separate; spell status and equipment descriptors are also separate. `SpellCastEvent` replaces the earlier trinket label: its legacy diagnostic says Trinketused, but the concrete implementations read the spell definition table.','',
    'ActionRequest and PreparedAction replace the overly narrow SpellArea names: all five request subclasses and ten prepared-action subclasses have been reviewed. ActionSpell wraps an action rather than defining a geometric area. AI summoningPlayer and summonUnitType replace the misleading spellId/selectionVariant pair. Teleport target deltas are relative offsets, not absolute destination coordinates. PreparedAction.playerFlags is indexed by player, not by tile. Unused constructor arguments and no-op marker application remain unchanged.', '',
    'Battlefield.predictCombat returns [defenderDamage, attackerDamage, deathFlags], where flags 1/2 mean attacker/defender death. computeAttackPower, scaleIncomingDamage and getDamageTakenPercent expose matchup strength, cover and protection; integer truncation, damage caps and unusual protected-target behavior are preserved. Unit capability names distinguish flying eligibility, anti-flying bonus, structure capture and Sea Slug parasitism. Tile effects are indexed by team, while summoning permissions and local god favour are separate checks.', '',
    'Turn/match names expose condition initialization, per-player victory/defeat queries, survivor masks, elimination order, participant rankings and collected-mana/turn limits. MatchConditionRegistry uses any-condition aggregation: portal and unit conditions can defeat a player, and leader escort can win. Escort completion and removal from active play are separate unit flags. CampaignMission and MapLayout retain tagged-field encodings, lazy loading and unused arguments.', '',
    'The wire layer names MSB-first bit I/O, opcode ciphering, compact signed integers and tagged record factories. Compact tier widths are 4/14/20/30 bits with a two-bit selector and cumulative signed offsets. Field names have one to four encoded characters. Tagged payload access can temporarily rotate bits over a length header; finishTaggedPayload restores the header and advances to the next field. Unknown field names still skip their declared payload. ParasiteEvent converts incoming signed deltas into stored absolute destination coordinates despite its legacy d diagnostic label. Legacy snapshot and event entry points now have names; this pass does not establish a complete multiplayer protocol.', '',
    'Follow `Battlefield.readGameEvent`: it peeks at the header, then delegates cursor advancement to movement, summon, combat, state-change or special-event readers. Movement packs four directions per byte from the low two-bit pair; summon packets pack a signed five-bit bonus and three-bit player. Stored-unit decoding distinguishes detached tile placement from removal of an active unit, and versioned records can add names, tags and objective IDs. Snapshot chunks append to a length-prefixed buffer. `TutorialLayout.readSpell` is an unrelated original static helper: it decodes global, targeted or action-wrapped spells. The raw decompiled special spell branch consumes two coordinate bytes after queuing its spell; this continuation is preserved and does not establish original-bytecode or live-server correctness.', '',
    '`TutorialLayout` stores 29 stage layouts and centers coordinates on the original 640 by 480 surface. Setters accept current surface coordinates; odd negative size differences retain arithmetic-shift rounding. `UiSelectionState` is shared with other menus: it tracks selected index, pointer presses, repeat countdown and captured keys. Navigation wraps within item count; pointer presses suppress keyboard/programmatic changes until release. Internal key IDs and their existing guard effects remain unchanged; the pass does not assign unverified physical key names.', '',
    '`SpellMenuGroup` forms the original 36-group tree with 27 leaves covering all 135 spell IDs. Branches link each child to its parent/index; leaves register in spellMenuById. Constructors retain supplied arrays, and duplicate IDs overwrite the lookup with the last leaf. Icons and descriptions are separate from spell effects. MatchSetupPanel exposes stage-5 option validation, localized item labels and geometry; selectedPreviewIndex and option33Enabled describe their observed roles without inventing finer gameplay encodings. InstructionsPanel exposes stage-7 instruction rows, page state and detached illustrative units. IntPair deliberately names its components first/second because callers use the same type for both positions and dimensions.', '',
    'Panel geometry preserves component-wise minima/maxima, centered coordinates, missing-bound sentinels and unusual negative heights. Setup options validate player, computer, map-size and selection fields independently; invalid values retain current state. Instruction preview units use base strength minus one, clamped to one, and skip tile placement. The core probe runs the actual spell hierarchy builder and panel accessors. Its client shim preserves the Applet subtype for bytecode verification without constructing the client; this still does not initialize the full UI or load instruction fonts/illustrations.', '',
    'Instruction text tables now name page/section titles, row headings, paragraph lines and parallel illustration modes/arguments. updateInstructionsPanel derives previous/next availability at the page boundaries; configureNavigation clears old state and highlights the selected item. UnitModelPreview identifies model/yaw/screen state and the animation path behind illustrative units. AnimationSequence decodes packed frame IDs, durations and loop settings; opcode3Values/opcode13Rows deliberately retain qualified names where finer meanings are unresolved.', '',
    'AnimationPlayer preserves countdown boundaries, finite/unlimited loops, invalid loop-start fallback and the last frame ID after completion. Its retained delayed-ring branch is tested with reflection-populated slots; this does not establish that normal gameplay fills that ring. TickCounter counts calls and preserves guard checks and Java integer wrapping. TrianglePulse keeps its original byte-range defaults, ordered clamps, odd-period endpoint duplication and zero-half-period division errors. For example, a requested maximum of 256 falls back to 224. These observed edge cases are documented and tested rather than changed by the naming pass. Model-preview setter fixtures do not prove full mesh rendering, asset loading or complete instruction-page execution.', '',
    'PlayerProfile decodes versions 0 through 9. Version 0 retains the legacy unlock level only; versions 1+ read five equipped spell IDs, rune credit and seven unlock masks. Spell quantities are always included before version 5 and otherwise depend on the includeSpellQuantities argument. Invalid equipped IDs become -1. Versions 6+ add rune debit, progression credit and campaign results; older levels reconstruct progression credit from cumulative unlockLevelCosts. Available runes are runeCredit minus runeDebit, while unlock level uses progressionCredit plus runeCredit. These names describe observed formulas; server ledger semantics remain unresolved. Negative debit requests and Java integer wrapping are preserved.', '',
    'CampaignProgress has three campaign tables with 64 mission slots. A bit mask selects the tables present in a packet; byte mission indices end at 255. Before version 7, turnsTaken defaults to 2000 and only damageTaken is encoded. Unselected tables survive a decode, while selected tables are rebuilt. Both -1 or both 65535 metrics clear a result; mixed sentinels remain records. Mission gt/gd fields are scoreTurnTarget and scoreDamageTarget, correcting the unsupported gameType/godSetting interpretation. calculateMissionScore applies separate turn/damage bonus curves and limits, with score 1 for a zero target.', '',
    'CoatOfArms retains caller arrays and serializes six part/colour pairs. Snapshot coat readers use unsigned bytes and map part 255 to -1; campaign participant coats read both arrays as signed bytes. The two readers retain their different signedness. CampaignParticipant also retains six god favour levels and available unit types and equipped spell IDs traced through campaign setup. Unit overrides share one decoded object across referenced participants, grow arrays by ten when filled and append duplicate participant references twice. ContextualRuntimeException stores originalCause separately from Java getCause; addExceptionContext reuses the wrapper and appends context. Profile-version rejection probes unwrap that original field to verify the actual failure reason.', '',
    'Campaign loadouts start from initialUnitTypes and add unit/spell rewards only for missions with a positive stored score. Unit IDs become group/ordinal mask bits; missing IDs retain the original zero/zero fallback. Spells with matching definition columns 3/4/5 replace one another only when the new definition improves column 6 or 7, except existing column-6 values 4/5 keep separate slots. Supplied spell slots are not cleared. Completed mission manaBonusPercent values accumulate into a multiplier starting at 1. Reward previews prefer the first unit reward, then a spell, then a positive mana bonus. The archive loader retains swallowed participant errors and logged mission errors.', '',
    'CampaignMenu uses numbered views for campaign cards, missions and quicksave dialogs. CampaignMenuEntry holds titles, descriptions, scores, inclusive bounds and preview/highlight state; CampaignMenuButton has a fixed height of 30. Mission entries collect unit categories from non-local map units and listed campaign participants. Neighbor scores control selectability: bit 2 requires all neighbors, otherwise any suffices. Empty neighbor arrays therefore select only in the all-neighbors case; absent arrays and already-scored entries are selectable. updateMissionScore ignores a lower score except that score 1 always replaces it. NodeHashTable preserves duplicate keys, masked bucket selection and insertion order within buckets; it adds no power-of-two validation.', '',
    'The naming pass changes identifiers and lexical labels, not control flow. Three files still retain compiler dispatcher fallbacks, and large methods remain. More semantic work is needed in combat, spells, AI, tutorial stages and multiplayer packet handling.','',
    'The exporter compiles both complete corpora and verifies bindings/overrides. A headless raw-versus-named probe checks rectangular map lookup, team membership, unit flags/damage, equipment/ranges, combat payloads, spell serialization, tile metadata, AI candidate selection/recycling, packed move request decoding, prepared action event payloads, combat/cover calculations, team tile effects, summoning permissions, popup animation, match conditions/masks/rankings, structure income, bit/compact codecs, tagged fields/maps, all five event dispatcher categories and unknown categories, concatenated events, stored-unit records, snapshot chunks, spell factories, tutorial layout/selection, spell-menu hierarchy, setup option validation, instruction bounds and preview units, instruction table shapes/navigation, animation decoding/playback, timing pulses and model-preview setters, versioned profiles/campaign results, mission scoring, coats/participants/overrides, campaign loadouts/reward previews, menu entry/neighbor selection, button bounds and hash-table behavior, and contextual errors, legacy/version-0/version-1/version-2 map terrain headers and event presentation acknowledgement against independent expectations. It bypasses battlefield construction and the Applet graph; it does not establish whole-game playability, AI quality or server compatibility. Exact dictionary reversal recovers every original source byte.',''].join('\n');
}
export function buildArmiesManifest() {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'armies-naming-rules-'));
  try {
    const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout);
    const record=catalog.publication.games.armiesofgielinor;
    const rules={schema:1,game:'armiesofgielinor',version:13,
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
