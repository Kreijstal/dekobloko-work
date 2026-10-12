import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureProcess} from './tools/lib/capture-process.mjs';
import {sourceInventory} from './tools/readable-java.mjs';
import {buildCompilationStubs} from './compilation-stubs.mjs';
import {archivedInput, digest, funorbRepository, verifyToolPin, workflowRoot} from './game-export.mjs';

const SOURCE_COMMIT = 'f9a6dd401349b0d2b3a426a62d2ee09c32514c63';
// Evidence below refers to this immutable Java input, not to another game's map.
const classes = {
  dq:['HuffmanCodec','Retained symbol lengths, left-aligned code words and decode trie; packs bytes MSB-first and decodes a requested output length. Unrelated static helpers retain separate purposes.'],
  mp:['SocialListPanel','Scrollable retained social-list content with add/remove buttons, prototype copying and shared bottom-row geometry. Unrelated static helpers retain separate purposes.'],
  oc:['AccountNamePrompt','Anchored account-name prompt with instruction/input components, mutable name buffer and waiting/cancel/submit state; modern polling and legacy key handling remain distinct.'],
  hl:['SocialListEntry','Shared friend/ignore-list row with current/previous display names, optional account name, online location label, ordering and lazy name/location/rename components. Unrelated sprite helpers retain separate purposes.'],
  k:['AccountNameNormalizer','Canonical account lookup keys: trims the four separator characters, enforces a 1–12-character trimmed span, drops unsupported characters and folds the retained alphabet.'],
  tg:['ClientContextMenu','Targeted client context-menu state for lobby admission, friends/ignore lists, chat filtering, private messages and reporting; owns a copied ContextActionMenu and retained target metadata.'],
  mo:['ChatMessage','Retained chat channel, sender/account/display identity, text/label, filter classification and rendered row; constructors snapshot decoded state or create a system message. Unrelated static helpers retain separate purposes.'],
  i:['ReportAbuseDialog','Report-target text, rule/offence choices, optional mute control and close/wait/cancel state; unrelated static helpers retain separate purposes.'],
  fp:['IconLabelControl','Client component combining selected/unselected icon styles with a measured text label and inherited visual state; unrelated static helpers retain separate purposes.'],
  au:['LobbyRoom','Lobby room record and client row: player capacity/options, owner, play/join/invitation state, notification lifetime and ordering. Unrelated static helpers retain separate purposes.'],
  of:['LobbyPlayer','Account/name and lobby player row with rating/unlocks, invitation/join-request state, notification lifetime and ordering. Unrelated static helpers retain separate purposes.'],
  ml:['TabbedPanel','Linked tab buttons and caller-retained content panels; evenly spaced tab geometry and active-panel switching. Unrelated static helpers retain separate purposes.'],
  tp:['DualNodeHashTable','Sentinel buckets indexed by secondary keys/links, with duplicate lookup continuation and a separate bucket-order cursor; unrelated static helpers retain separate purposes.'],
  dp:['EditableTextField','Single-line mutable text with caret/selection, printable-character filtering, separator navigation, pointer selection and asynchronous clipboard tasks; unrelated static helpers retain separate purposes.'],
  hd:['PlatformTaskService','Runnable queue servicing platform tasks, including sockets, threads, reflection, clipboard, fullscreen/cursor adapters and retained cache files; constructor side effects remain unchanged.'],
  wo:['PlatformTask','Linked platform request with type, two integer arguments, object argument and volatile pending/success/failure status and result.'],
  np:['ContextActionMenu','Bounded list of icon/text action rows, measured popup placement and action-ID polling with waiting/cancel sentinels; unrelated static helpers retain separate purposes.'],
  ll:['VerticalScrollbar','Linked up/down buttons, track halves and draggable thumb; proportional geometry, drag conversion and shared held-button repeat counter. Unrelated static helpers retain separate purposes.'],
  dn:['ScrollContainer','Retains a supplied content component inside a clipping viewport with a copied vertical scrollbar; clamps pending scroll offsets and consumes button/page/wheel/drag input. Unrelated static helpers retain separate purposes.'],
  im:['ClientUiNode','Empty instance root for linked client UI components; unrelated static helpers retain separate purposes.'],
  je:['ClientUiComponent','Client UI bounds, retained style/font/sprite/text, linked children, input traversal and rendering contract; distinct from the shared Widget hierarchy.'],
  nf:['IconTextComponent','ClientUiComponent composing optional icon and text children, measuring their width and laying them out together; unrelated static helpers retain separate purposes.'],
  mq:['QuickChatMenu','ClientUiComponent containing shortcut-prefixed item components, phrase IDs, submenus and collapse animation/navigation state; unrelated static helpers retain separate purposes.'],
  bl:['QuickChatCategoryRepository','Loads and caches group-zero quick-chat categories from local/global archives; global IDs use bit 32768. Unrelated static helpers retain separate purposes.'],
  rf:['QuickChatPhraseRepository','Loads and caches group-one quick-chat phrases from local/global archives and applies the global linked-ID bit. Unrelated static helpers retain separate purposes.'],
  va:['QuickChatCategory','Opcode-decoded title, subcategory/phrase IDs, shortcut characters and root-selection flag used to build the quick-chat menu. Unrelated static fields retain separate purposes.'],
  ar:['QuickChatPhrase','Opcode-decoded text fragments, linked phrase IDs and command-definition argument rows; preview joins fragments with ellipses. Unrelated static helpers retain separate purposes.'],
  me:['QuickChatCommandDefinition','Quick-chat command ID and number of unsigned-short arguments retained by phrase definitions; the two other constructor integers are unused. Unrelated static helpers retain separate purposes.'],
  ri:['WeightedLruCache','Weight-budgeted cache combining primary hash membership with secondary least-recently-used order; clears empty references and promotes reference-backed entries to strong entries.'],
  uq:['CacheEntry','Abstract retained-value/reference-kind contract with an entry weight and independent hash/LRU links. Unrelated static protocol/coat helpers retain separate purposes.'],
  f:['StrongCacheEntry','CacheEntry retaining its value directly as an Object and reporting no reference-backed representation. Unrelated static fields retain separate purposes.'],
  m:['IterableNodeHashTable','Masked-key sentinel buckets accepting intrusive primary nodes and duplicate keys, with independent Iterator traversal. Unrelated static fields retain separate purposes.'],
  tl:['NodeHashIterator','Bucket-order Iterator over IterableNodeHashTable with its own cursor, bucket index and removable last-returned node; unrelated static rendering/archive helpers retain separate purposes.'],
  pq:['PointerInputHandler','Synchronized AWT mouse callbacks maintain live pointer/button state; focus loss clears the held button and popup triggers are consumed. Unrelated static helpers retain separate purposes.'],
  wg:['IterableDualNodeDeque','Sentinel deque over independent secondary links, exposing an Iterator with node removal. Unrelated static input/name helpers retain separate purposes.'],
  sp:['DualNodeIterator','Iterator over IterableDualNodeDeque secondary links, with its own cursor and last-returned removal state; preserves the original nonstandard exhaustion behavior.'],
  ja:['CameraOverviewTarget','Averaged tile-coordinate cluster consumed by GameplayController camera overviews; proximity grouping, hold-started flag and a forty-call hold counter. Unrelated static helpers retain separate purposes.'],
  qu:['DelayedPacket','Instance retains a release timestamp, opcode and copied payload for artificial-latency delivery; unrelated static helpers retain separate purposes.'],
  sa:['ClientConnectionState','Identity-tag instances mark common-client connection stages; login completion selects connectedState and packet polling checks that identity. Static bit/tag helpers remain independent.'],
  kb:['Widget','Base UI node: position, width/height, painter dispatch and pointer hit testing; unrelated static helpers retain separate purposes.'],
  kh:['WidgetPainter','Widget drawing contract invoked with parent-origin offsets, a guard and a rendering flag.'],
  gs:['DropdownArrowPainter','Instance draws a shaded dropdown button and downward arrow; static packet polling and other helpers remain separate.'],
  gh:['DropdownSelector','Text/arrow controls, option list, prefix selection and expandable dropdown viewport.'],
  pp:['DropdownOptionList','Dropdown option storage, selected/hovered indices, row height and option rendering.'],
  tm:['TriangleRasterizer','Static flat, shaded and textured triangle/scanline drawing, raster clip setup and fixed-point sine/cosine tables.'],
  lh:['TextureProvider','Texture availability, pixel and colour queries used by mesh construction and textured rasterization; unresolved property queries retain their names.'],
  ig:['AnimationSkeleton','Decoded transform slots: type, mesh group indices and per-slot masks; frames share this object by identity.'],
  ht:['AnimationFrame','Sparse signed-smart transform components, preceding pivot slots and interpolation flags decoded against a shared skeleton.'],
  wp:['AnimationFrameSet','Loads an archive group of frames, resolves and reuses skeletons by ID, then releases retained encoded frame bytes.'],
  wq:['FixedQuaternion','Four 16.16 quaternion components, axis-angle setup, copying, normalization and normalized prepended Hamilton product.'],
  ni:['MeshObject','Empty instance root shared by MeshData and ModelMeshBase; unrelated static helpers retain separate purposes.'],
  js:['MeshData','Decoded vertex coordinates, face indices/materials, normal accumulation and animation skin groups used to construct ModelMesh.'],
  kk:['ModelMeshBase','Abstract mesh copy, transform, animation and drawing contract implemented by ModelMesh.'],
  wi:['VertexNormal','Accumulated x/y/z normal components and the number of contributing smooth faces.'],
  kg:['FaceNormal','One normalized x/y/z vector retained for a flat-shaded face.'],
  ub:['RadialSummonMenu','Places god-tab or unit-choice items around a portal; resolves pointer hits and draws summon availability.'],
  jr:['RadialSummonItem','Unit/god choice identity, icon group, radial offsets and circular hit radius.'],
  eu:['UnitCycler','Wraps forward/reverse selection through the player unit deque, refreshing after the selected node is unlinked.'],
  sj:['TurnTimerDial','Angular pixel thresholds and a wrapping sweep driven by remaining turn ticks, rendered beside the tick/50 countdown.'],
  iu:['BattleTutorial','In-battle tutorial stages, messages, action notifications, control highlights and animated hint panel; distinct from the tutorial menu controller.'],
  gb:['EquipmentBattleTutorial','BattleTutorial subclass whose specialist-equipment lesson texts follow Eastbridge; tracks the current equipped slot and eligibility gates.'],
  uf:['SpellConfirmationDialog','Retains spell ID, target tile, selection mode and confirmation prompt; caller resumes the spell cast when confirmed.'],
  eo:['BattleUnitRenderer','Camera visibility, retained UnitModelPreview objects and per-unit model animation/projection updates.'],
  mg:['ByteStorage','Abstract set/get byte contract for the retained direct-buffer implementation; unrelated static helpers retain separate purposes.'],
  cj:['DirectByteStorage','Stores a copied payload in a direct ByteBuffer; reads return a fresh full-capacity byte array.'],
  jm:['ArchiveIndex','Versions 5–7 decode group/file IDs, revisions, CRCs, optional names and 64-byte digests.'],
  lr:['IntKeyLookup','Open-addressed integer key table returning original input indices, with linear probing.'],
  kl:['ResourceArchive','Lazy archive index, packed group storage, unpacked file storage and named resource lookup.'],
  ew:['ArchiveProvider','Abstract archive-index, encoded-group and group-progress contract.'],
  bm:['CachedArchiveProvider','Validates archive indexes and group responses from disk caches and the resource protocol client.'],
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
  jf:['NetworkResourceRequest','Padded response buffer, received block position and resource completion/progress accessors.'],
  bp:['ResourceProtocolClient','Separate queued/in-flight priority and normal request lanes with twenty-request caps.'],
  ae:['SocketResourceClient','Socket-backed resource request sending, response headers, continuation blocks and XOR decoding.'],
  hi:['BufferedSocket','Blocking input plus a bounded asynchronous output ring and deferred write errors.'],
  ms:['DualLinkedNode','IntrusiveNode plus independent secondary links and a key that cannot be changed while secondary-linked.'],
  ui:['DualNodeDeque','Sentinel deque using independent secondary node links; supports append, pop and traversal.'],
  ks:['ResourceRequest','Abstract pending/data/progress contract shared by disk and network requests.'],
  nh:['DiskCacheRequest','Disk request operation, store and byte payload with inherited pending state.'],
  vo:['DiskCacheWorker','Queued disk reads/writes, immediate reads that reuse pending writes and a worker thread.'],
  bc:['SectorCacheStore','Six-byte entry index and chained 520-byte sectors with small/large entry headers.'],
  ue:['BufferedFile','Buffered seek/read/write with logical/physical lengths, cached reads and pending writes.'],
  ei:['BoundedFile','RandomAccessFile wrapper with position accounting and a maximum file length.'],
  sl:['CampaignQuicksave','Versioned campaign snapshot header, mana/loss/damage state and incremental snapshot reception.'],
  pr:['PaletteRegionMap','Maps image palette indices to regions, retains marker anchors, identifies clicked regions and renders masks.'],
  a:['RegionAnchor','Row/column anchor node collected from marker pixels; unrelated static helpers retain their separate purposes.'],
  qg:['RgbSpriteBase','RGB sprite canvas/pixel bounds and offsets inherited by RgbSprite.'],
  si:['IndexedSpriteBase','Abstract indexed sprite bounds and transparent/alpha draw contracts.'],
  ru:['IndexedSprite','Byte palette indices and RGB palette with conversion, hit tests and raster drawing.'],
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
  if(original!=='<init>')members['M:'+key] = {to,evidence};
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
constructorParameters('vb','(Lic;Lha;Leo;Loj;Z)V',['controller','battlefield','unitRenderer','event','blocking'],'EventPresenter constructor bindings; blocking mode preserves its original flag.');
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
method('ej','a','(ZII)V','considerEquippedSpell','Checks an equipped slot, resets its strategy, scans radius-bounded square windows and submits every nonzero total; a selected candidate becomes a UnitSpell request.',{0:'skipEvaluation',1:'equippedSlot',2:'obfuscationGuard'});
method('sm','a','(IIIFBI)V','submitSpellCandidate','Stores destination, score and acting player in a reused candidate. The equipped-slot argument is unused by this method.',{0:'unusedEquippedSlot',1:'destinationX',2:'destinationY',3:'score',4:'obfuscationGuard',5:'actingPlayer'});
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
method('ha','b','(IIZ)V','eliminatePlayer','Marks the player, records elimination order and removes/transfers owned resources using reconstructed control flow.',{0:'obfuscationGuard',1:'playerId',2:'removeUnits'});
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
  ['ha','b(IIZ)V',[[7,'var4','orderIndex'],[13,'var10','receivingPlayers'],[14,'var11','unitToRemove'],[15,'var12','campaignUnit']]],
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

for(const [original,to,type] of [['h','sourceImage','Lru;'],['d','regionByPaletteIndex','[I'],['b','anchorsByRegion','[Lat;'],['e','regionCount','I'],['c','ignoredColour','I'],['j','anchorColour','I']])field('pr',original,type,to,'Palette scan, anchor accumulation, region lookup, sprite extraction and selected-region drawing.');
constructorParameters('pr','(Lru;II)V',['sourceImage','ignoredColour','anchorColour'],'Stores the image and special palette colours then scans region IDs/anchor positions.');
method('pr','c','(I)V','indexRegions','Initializes palette-to-region IDs and anchor lists, assigning regions by first pixel occurrence rather than connectivity.',{0:'obfuscationGuard'});
// Region-anchor helper carries the original y/x ordering.
method('pr','a','(IIIB)V','addAnchor','Appends a row/column marker to the list at regionId + 1; region -1 has its own list.',{0:'row',1:'column',2:'regionId',3:'obfuscationGuard'});
method('pr','a','(II)Lat;','getAnchors','Returns the retained anchor deque at regionId + 1; noncanonical guard returns null.',{0:'regionId',1:'obfuscationGuard'});
method('pr','a','(IBI)I','getRegionAt','Applies source offsets and bounds before palette lookup; preserves the original signed-byte indexing.',{0:'x',1:'obfuscationGuard',2:'y'});
method('pr','a','(IIBI)Lwk;','extractRegionSprite','Finds the selected region bounds and creates a coloured RGB mask with padding; retains the omitted rightmost column and offset calculations.',{0:'regionId',1:'colour',2:'obfuscationGuard',3:'padding'});
method('pr','a','(BI[ZILru;)V','drawSelectedRegions','Copies source colours only for enabled region IDs, respecting the raster clip and unsigned palette indices.',{0:'obfuscationGuard',1:'left',2:'enabledRegions',3:'top',4:'colourImage'});
field('a','p','I','column','Region marker helper constructs new a(column,row), and the menu uses this coordinate horizontally.');
field('a','l','I','row','Marker helper and menu use this coordinate vertically.');
constructorParameters('a','(II)V',['column','row'],'Marker helper constructs the node from source column then row; menu positions use the same horizontal/vertical order.');
for(const [original,to] of [['g','canvasWidth'],['f','canvasHeight'],['i','offsetX'],['d','offsetY'],['e','pixelWidth'],['h','pixelHeight']])field('si',original,'I',to,'Indexed sprite constructor/conversion and scaled/offset draw methods distinguish full canvas bounds from pixel dimensions.');
field('ru','k','[B','pixelIndices','Pixel bytes index the RGB palette; transparent drawing skips index zero.');
field('ru','j','[I','palette','RGB colours for byte indices; conversion and normal drawing mask indices to unsigned values.');
constructorParameters('ru','(IIIIII[B[I)V',['canvasWidth','canvasHeight','offsetX','offsetY','pixelWidth','pixelHeight','pixelIndices','palette'],'Retains supplied palette/pixel arrays and distinct canvas/pixel dimensions.');
constructorParameters('ru','(III)V',['width','height','paletteSize'],'Allocates zero-filled byte pixels and palette with zero offsets.');
method('si','a','(II)V','draw','Draw contract with transparent index zero.',{0:'left',1:'top'});
method('si','a','(III)V','drawAlpha','Draw contract with 0..256 alpha and transparent index zero.',{0:'left',1:'top',2:'alpha'});
method('ru','a','()Lwk;','toRgbSprite','Expands unsigned palette indices into a new RGB pixel array, preserving canvas/pixel bounds.');
method('ru','a','(IIII)Z','containsOpaquePixel','Tests a point relative to drawn position/offset; any nonzero pixel index counts as opaque.',{0:'left',1:'top',2:'x',3:'y'});
method('ru','b','(II)V','drawOpaque','Copies all palette colours, including index zero, with clipping.',{0:'left',1:'top'});
method('ru','c','(IIII)V','drawScaled','Draws with fixed-point nearest-neighbor sampling and clipping.',{0:'left',1:'top',2:'width',3:'height'});
for(const [original,to,type] of [['B','pixels','[I'],['A','canvasWidth','I'],['x','canvasHeight','I'],['w','offsetX','I'],['z','offsetY','I'],['y','pixelWidth','I'],['v','pixelHeight','I']])field(original==='B'?'wk':'qg',original,type,to,'RGB sprite constructors, indexed-to-RGB conversion and clipped draw methods.');
constructorParameters('wk','(IIIIII[I)V',['canvasWidth','canvasHeight','offsetX','offsetY','pixelWidth','pixelHeight','pixels'],'Retains supplied RGB array with separate canvas/pixel bounds.');
constructorParameters('wk','(II)V',['width','height'],'Allocates a zero-filled full-canvas RGB sprite.');
for(const [original,to,type] of [['d','pixels','[I'],['l','width','I'],['g','height','I'],['j','clipLeft','I'],['a','clipTop','I'],['e','clipRight','I'],['f','clipBottom','I']])field('qn',original,type,to,'Raster buffer installation and clipped sprite/region drawing use these exclusive clip bounds.');
for(const [owner,signature,items] of [
 ['pr','a(IBI)I',[[0,'var4','relativeX'],[1,'var5','relativeY'],[2,'var6','paletteIndex'],[3,'var7','regionId']]],
 ['pr','c(I)V',[[1,'var2','paletteIndex'],[2,'var3','anchorPaletteIndex'],[4,'var5','paletteEntry'],[5,'var6','pixelPaletteIndex'],[7,'var2Lifetime1','ignoredPaletteIndex'],[8,'var4Lifetime1','lastRegionId'],[9,'var5Lifetime1','pixelIndex']]],
 ['pr','a(IIBI)Lwk;',[[0,'var11_int','x'],[4,'var5','minimumX'],[5,'var6','maximumX'],[6,'var7','minimumY'],[7,'var8','maximumY'],[8,'var9','y'],[10,'var11','sprite'],[11,'var12','paletteIndex'],[12,'var13','region'],[13,'var14','outputPaletteIndex'],[14,'var15','outputRegion'],[16,'var17','outputX'],[17,'var9Lifetime1','height'],[18,'var10Lifetime1','width'],[19,'var12Lifetime1','outputY']]],
 ['pr','a(BI[ZILru;)V',[[0,'var11','y'],[1,'var12','x'],[10,'var7','clipLeft'],[11,'var8','clipTop'],[12,'var9','clipRight'],[13,'var10','clipBottom'],[14,'var13','sourceIndex'],[15,'var14','paletteIndex'],[16,'var15','regionId'],[17,'var16','colour'],[18,'var17','destinationIndex'],[22,'var21','pixels']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and palette indexing, marker positions, region bounds or clipped drawing data flow.');

for(const [original,to,type] of [['g','campaignIndex','I'],['e','missionId','I'],['d','damageTaken','I'],['f','hasLostUnit','Z'],['j','playerMana','[I'],['h','eliminatedPlayerMask','I'],['c','snapshotBytes','[B'],['b','receivedBytes','I']])field('sl',original,type,to,'Quicksave header encoding, gameplay restoration and snapshot reception; receivedBytes is -1 for non-streaming data.');
field('ha','zb','[I','damageTakenByPlayer','DamageEvent accumulates damage capped at current strength+bonus; gameplay scoring/quicksave uses the local-player entry.');
field('ha','h','[I','unitLossCounts','Unit removal increments this tracked count; quicksave stores/restores only whether the local count is positive.');
field('bu','b','Lsl;','storedQuicksave','Quicksave upload and inbound header assign this; campaign menu lookup and deletion consume it.');
field('vl','n','Lbv;','outgoingPacket','Client requests append ciphered opcodes and payloads to this shared outgoing buffer.');
constructorParameters('sl','(Lvh;IZ)V',['packet','formatVersion','receiveInChunks'],'Reads common fields; version 8+ adds mana, version 9+ adds elimination mask, and valid lengths 1..99999 allocate the snapshot.');
constructorParameters('sl','(IILha;IZ)V',['campaignIndex','missionId','battlefield','damageTaken','hasLostUnit'],'Captures a legacy battlefield snapshot, copies mana values and stores campaign score/loss state.');
method('sl','a','(IILbv;)Z','appendSnapshotChunk','Copies chunk data into the received offset and reports completion; noncanonical guards copy without advancing that offset.',{0:'length',1:'obfuscationGuard',2:'packet'});
method('sl','b','(ILvh;)V','writeHeader','Writes the current header layout including mana values, elimination mask and snapshot length.',{0:'obfuscationGuard',1:'packet'});
method('sl','a','(ILvh;)V','write','Writes the current header followed by snapshot bytes using the supplied source offset.',{0:'sourceOffset',1:'packet'});
method('ku','j','(I)Lsl;','getStoredQuicksave','Returns the retained save or null; keeps the original guard side effect.',{0:'obfuscationGuard'});
method('of','a','(Lha;IIBII)V','uploadQuicksave','When permitted by the original mode check, captures/stores a save and writes opcode 80 with a two-byte length prefix.',{0:'battlefield',1:'damageTaken',2:'unitLossCount',3:'obfuscationGuard',4:'missionId',5:'campaignIndex'});
method('qh','b','(B)V','requestDeleteQuicksave','For guard 27 and the original permitted-mode state, queues opcode 81 and clears the stored save.',{0:'obfuscationGuard'});
method('ic','a','(BLsl;Lom;)V','restoreCampaignQuicksave','Reads the snapshot, restores score/loss/mana/mask fields, clears inactive ownership and reconstructs missing player turn counts.',{0:'obfuscationGuard',1:'quicksave',2:'mission'});
method('ic','s','(B)V','saveCampaignQuicksave','Uploads the current campaign/mission with damage/loss state and shows the existing feedback.',{0:'obfuscationGuard'});
method('ts','a','(Lom;ILsl;)V','startCampaignMission','Creates gameplay for the mission, installs player coats and optionally restores a quicksave.',{0:'mission',1:'obfuscationGuard',2:'quicksave'});
method('cv','b','(B)V','selectMissionOrQuicksaveDialog','Starts a selected mission directly without a save, otherwise chooses matching-save or overwrite confirmation.',{0:'obfuscationGuard'});
method('cv','a','(Lom;Lsl;III)Lwk;','renderMissionPreview','Renders terrain and saved/current mission occupants into the preview sprite, preserving width/height and original guards.',{0:'mission',1:'quicksave',2:'height',3:'obfuscationGuard',4:'width'});
method('vh','a','([BIII)V','writeBytes','Copies a source slice into the payload and advances position, preserving guard arithmetic and bounds failures.',{0:'source',1:'sourceOffset',2:'length',3:'obfuscationGuard'});
method('vh','g','(B)[B','copyWrittenBytes','Returns a new array containing payload bytes before position.',{0:'obfuscationGuard'});
for(const [owner,signature,items] of [
 ['sl','<init>(Lvh;IZ)V',[[0,'var5','playerIndex'],[6,'var4_int','manaCount'],[8,'var4_intLifetime1','snapshotLength']]],
 ['sl','b(ILvh;)V',[[0,'var3_int','playerIndex']]],
 ['ic','a(BLsl;Lom;)V',[[8,'var4_int','localPlayer'],[10,'var5_ref_ne__','tiles'],[11,'var5','turnReferencePlayer'],[12,'var6','tileIndex'],[13,'var7_ref_ne','tile'],[14,'var7','playerId'],[16,'var6Lifetime1','referenceTurnCount']]],
 ['of','a(Lha;IIBII)V',[[0,'var9','quicksave'],[1,'var7','payloadStart']]],
 ['cv','a(Lom;Lsl;III)Lwk;',[[1,'var6','sprite'],[2,'var7','layout'],[3,'var8','tileHeight'],[4,'var9','tileWidth'],[5,'var10','leftOffset'],[6,'var11','topOffset'],[7,'var12','terrain'],[8,'var13','participantNames'],[10,'var14','previewBattlefield'],[11,'var15','tileIndex'],[12,'var16','tileY'],[13,'var17','tileX'],[14,'var18','tile'],[15,'var19','terrainType'],[27,'var20','tileColour'],[28,'var21_ref_jd','unit'],[29,'var21','left'],[30,'var22','top']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and versioned save header, restored state, upload packet length or map-preview rendering data flow.');

field('l','c','Lom;','activeCampaignMission','Campaign startup, progress reporting, result processing and quicksave paths share this selected mission.');
field('kr','C','Lcv;','campaignMenu','Campaign resources/input and result submission update this shared menu instance.');
field('ic','jb','Z','campaignMode','Campaign setup sets true; metric tracking runs only in this mode.');
field('ic','G','I','encodedDamageCheckpoint','Metric tracking stores damageTaken XOR 996394 and compares its decoded value with current battlefield damage.');
field('ic','I','I','encodedTurnCheckpoint','Metric tracking stores turnsTaken XOR 996394 and compares its decoded value with current player turns.');
for(const [owner,original,index] of [['kw','R',0],['ii','b',1],['cg','j',2],['wr','L',3]])field(owner,original,'I','campaignPacketWord'+index,'Shared arithmetic state serialized as 32-bit word '+index+' in campaign result packets; finer server validation semantics remain unresolved.');
for(const [owner,original,descriptor,index,parameters] of [['km','a','(I)I',0,{0:'obfuscationGuard'}],['oq','a','(Z)I',1,{0:'obfuscationGuard'}],['jr','a','(Z)I',2,{0:'obfuscationGuard'}],['rt','g','(I)I',3,{0:'obfuscationGuard'}]])method(owner,original,descriptor,'getCampaignPacketWord'+index,'Returns the corresponding shared state word for the canonical guard, preserving original noncanonical behavior.',parameters);
method('ra','a','(IILom;ZII)V','submitCampaignResult','Updates menu score, conditionally stores metrics/sends opcode 79 and then requests quicksave deletion; score 1 always qualifies.',{0:'obfuscationGuard',1:'damageTaken',2:'mission',3:'hasLostUnit',4:'candidateScore',5:'turnsTaken'});
method('ic','d','(Z)V','prepareMatchResults','Prepares result presentation and submits local campaign metrics when the local slot is the active player.',{0:'obfuscationGuard'});
method('ic','j','(Z)V','trackCampaignMetrics','Tracks nondecreasing damage/turn checkpoints and retains the shared packet-word mutations.',{0:'obfuscationGuard'});
method('vo','a','(ZIILom;)V','reportCampaignTurn','Queues a type-zero progress record using campaignIndex*1000+missionId, local-turn flag and turn count.',{0:'isLocalTurn',1:'obfuscationGuard',2:'turnsTaken',3:'mission'});
method('qq','a','(BIII)V','sendProgressRecord','Queues opcode 16 with a byte-length-prefixed type-zero record, unsigned-short ID, byte flag and unsigned-short counter.',{0:'obfuscationGuard',1:'recordId',2:'flag',3:'counter'});
method('vh','e','(II)V','writeByteLengthPrefix','Writes the preceding length byte from current position and payload length for canonical guard 5930.',{0:'length',1:'obfuscationGuard'});
for(const [owner,signature,items] of [
 ['ra','a(IILom;ZII)V',[[7,'var6_int','campaignIndex'],[9,'var7','missionId'],[10,'var8','mutationSelector'],[11,'var9','mutationVariant']]],
 ['vo','a(ZIILom;)V',[[0,'var6','localTurnFlag'],[1,'var4_int','campaignIndex'],[2,'var5','missionId']]],
 ['ic','d(Z)V',[[9,'var2_int','localTurn'],[11,'var3','turnsTaken'],[12,'var4','hasLostUnit'],[13,'var5','damageTaken'],[14,'var6','candidateScore'],[15,'var7','currentDamageThenSpecialUnitCount'],[16,'var8_int','currentTurns'],[17,'var8','localUnits'],[18,'var9_int','previousDamage'],[19,'var9','unit'],[20,'var10','previousTurns'],[21,'var11','damageDelta'],[22,'var12','turnDelta'],[23,'var13','mutationSelector'],[24,'var14','mutationVariant']]],
 ['ic','j(Z)V',[[1,'var2_int','damageTaken'],[3,'var3','turnsTaken'],[4,'var4','previousDamage'],[5,'var5','previousTurns'],[6,'var6','currentDamageThenMutationSelector'],[7,'var7','currentTurnsThenMutationVariant'],[8,'var8','damageCheckpoint'],[9,'var9','turnCheckpoint'],[10,'var10','damageDelta'],[11,'var11','turnDelta'],[12,'var12','deltaMutationSelector'],[13,'var13','deltaMutationVariant']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and campaign metrics, score submission, checkpoint deltas or shared-word mutation data flow.');

field('ms','l','Lms;','secondaryPrevious','Independent backward secondary link; unlink updates the secondary neighbors only.');
field('ms','s','Lms;','secondaryNext','Independent forward secondary link used by request queues and caches.');
field('ms','q','J','secondaryKey','Secondary-node key used as the disk entry ID in requests; cannot be assigned through the setter while secondary-linked.');
method('ms','a','(B)Z','isSecondaryLinked','Checks whether secondaryPrevious is present, retaining linked-only guard arithmetic.',{0:'obfuscationGuard'});
method('ms','c','(B)V','unlinkSecondary','Unlinks only the independent secondary chain; primary IntrusiveNode membership survives.',{0:'obfuscationGuard'});
method('ms','a','(I)J','getSecondaryKey','Returns the retained key with original guard side effects.',{0:'obfuscationGuard'});
method('ms','a','(ZJ)V','setSecondaryKey','Rejects changes while secondary-linked, then stores the supplied key.',{0:'obfuscationGuard',1:'key'});
field('ui','d','Lms;','sentinel','Constructor self-links this node in the secondary chain.');
field('ui','j','Lms;','traversalCursor','First/next walk this independent cursor.');
method('ui','a','(Lms;Z)V','addLast','Unlinks existing secondary membership before appending to this deque.',{0:'node',1:'obfuscationGuard'});
method('ui','b','(I)Lms;','popFirst','Removes and returns the first secondary node; guard 11 is canonical.',{0:'obfuscationGuard'});
method('ui','a','(B)Lms;','first','Returns the first node and primes secondary traversal.',{0:'obfuscationGuard'});
method('ui','c','(I)Lms;','next','Advances the secondary cursor even when a noncanonical guard returns null.',{0:'obfuscationGuard'});
method('ui','a','(I)I','size','Counts secondary-linked nodes without modifying them.',{0:'obfuscationGuard'});
field('ks','x','Z','pending','Volatile flag starts true and is cleared when a resource request completes.');
field('ks','z','Z','requestFlag','Retained queue-write argument; immediate disk reads set true unless they reuse a queued write. Finer flag semantics remain unresolved.');
method('ks','d','(B)[B','getBytes','Resource data accessor; disk implementation rejects reads while pending.',{0:'obfuscationGuard'});
method('ks','g','(I)I','getProgress','Reports resource progress; disk implementation returns zero or 100 from pending state.',{0:'obfuscationGuard'});
field('nh','F','[B','bytes','Queued writes retain the supplied array; reads install cache bytes here.');
field('nh','C','Lbc;','store','Worker dispatches disk operations to this cache store.');
field('nh','L','I','operation','Disk request codes: 1 immediate read, 2 queued write, 3 queued read.');
for(const [original,to,type] of [['g','requests','Lui;'],['a','stopRequested','Z'],['b','queuedCount','I'],['c','workerThread','Ljava/lang/Thread;']])field('vo',original,type,to,'Worker constructor, synchronized request queue, dispatch loop and stop/join lifecycle. queuedCount excludes the in-flight request.');
method('vo','a','(BILbc;)Lnh;','queueRead','Creates a pending code-3 request and enqueues it.',{0:'obfuscationGuard',1:'entryId',2:'store'});
method('vo','a','(ILbc;Z[B)Lnh;','queueWrite','Retains the supplied byte array in a code-2 request and enqueues it.',{0:'entryId',1:'store',2:'requestFlag',3:'bytes'});
method('vo','a','(BLnh;)V','enqueue','Appends under the request-queue monitor, increments queuedCount and notifies waiters.',{0:'obfuscationGuard',1:'request'});
method('vo','a','(ILbc;I)Lnh;','readNow','Reuses the first pending write for this store/key; otherwise performs a synchronous store read.',{0:'entryId',1:'store',2:'obfuscationGuard'});
method('vo','a','(B)V','stop','Sets the original stop flag, notifies and joins the worker thread.',{0:'obfuscationGuard'});
constructorParameters('vo','(Lhd;)V',['threadLauncher'],'Uses the existing launcher to start this Runnable and retain its thread.');
for(const [original,to,type] of [['b','archiveId','I'],['c','maximumEntryLength','I'],['l','dataFile','Lue;'],['g','indexFile','Lue;']])field('bc',original,type,to,'Cache constructor and index/sector header validation.');
constructorParameters('bc','(ILue;Lue;I)V',['archiveId','dataFile','indexFile','maximumEntryLength'],'Retains both buffered files and archive/entry-size limits.');
method('bc','a','(II[BI)Z','write','Attempts sector reuse then allocation, rejecting negative or oversized lengths.',{0:'obfuscationGuard',1:'length',2:'bytes',3:'entryId'});
method('bc','a','(I[BZIB)Z','writeSectors','Writes the index entry and chained sector headers/payloads using 8- or 10-byte headers.',{0:'entryId',1:'bytes',2:'reuseSectors',3:'length',4:'obfuscationGuard'});
method('bc','a','(II)[B','read','Reads and validates the index/sector chain; malformed or missing data returns null.',{0:'obfuscationGuard',1:'entryId'});
for(const [original,to,type] of [['j','file','Lei;'],['f','readBuffer','[B'],['b','writeBuffer','[B'],['h','position','J'],['l','filePosition','J'],['g','logicalLength','J'],['n','physicalLength','J'],['i','readBufferStart','J'],['d','readBufferLength','I'],['m','writeBufferStart','J'],['c','writeBufferLength','I']])field('ue',original,type,to,'Buffered I/O constructor, seek, read refills, write flushes and overlapping-buffer updates.');
constructorParameters('ue','(Lei;II)V',['file','readBufferSize','writeBufferSize'],'Retains the bounded file and allocates independent read/write buffers.');
method('ue','a','(Z)J','length','Returns the logical length including pending writes.',{0:'obfuscationGuard'});
method('ue','a','(IJ)V','seek','Sets the logical position; negative offsets throw IOException.',{0:'obfuscationGuard',1:'position'});
method('ue','a','(IIB[B)V','write','Writes the source slice, updating buffers and logical length.',{0:'length',1:'sourceOffset',2:'obfuscationGuard',3:'source'});
method('ue','a','(I[BBI)V','readFully','Reads an exact destination slice or throws EOFException, including pending-write overlap.',{0:'destinationOffset',1:'destination',2:'obfuscationGuard',3:'length'});
method('ue','a','(I[B)V','readArray','Delegates a full array read to readFully.',{0:'destinationOffset',1:'destination'});
method('ue','d','(B)V','flush','Writes pending buffered bytes and refreshes overlapping cached reads.',{0:'obfuscationGuard'});
method('ue','e','(B)V','refillReadBuffer','Refills cached reads from the current logical position.',{0:'obfuscationGuard'});
method('ue','c','(B)V','close','Flushes pending bytes and closes the underlying file.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['g','file','Ljava/io/RandomAccessFile;'],['c','position','J'],['f','maximumLength','J']])field('ei',original,type,to,'Bounded file constructor, read/write accounting, seek and close.');
constructorParameters('ei','(Ljava/io/File;Ljava/lang/String;J)V',['path','mode','maximumLength'],'Opens the file; -1 means unlimited, and an oversized existing file is deleted before opening.');
method('ei','a','(II[BI)I','read','Reads a slice and advances position by the positive byte count.',{0:'length',1:'obfuscationGuard',2:'destination',3:'destinationOffset'});
method('ei','a','(III[B)V','write','Checks the maximum length before writing a source slice; overflow writes the original marker byte then throws EOFException.',{0:'obfuscationGuard',1:'sourceOffset',2:'length',3:'source'});
method('ei','a','(JI)V','seek','Seeks to the supplied offset and tracks position.',{0:'position',1:'obfuscationGuard'});
method('ei','a','(Z)J','length','Returns the underlying file length.',{0:'obfuscationGuard'});
method('ei','b','(I)V','close','Closes the file for canonical guard 783.',{0:'obfuscationGuard'});
for(const [owner,signature,items] of [
 ['vo','run()V',[[1,'var2','queueMonitor'],[3,'var7','request']]],
 ['vo','a(ILbc;I)Lnh;',[[0,'var4','request'],[2,'var5','queueMonitor'],[3,'var6','queuedRequest']]],
 ['bc','a(II)[B',[[3,'var3_ref','dataMonitor'],[4,'var4_int','entryLength'],[5,'var5','sector'],[6,'var6','bytes'],[7,'var7','bytesRead'],[8,'var8','chunkIndex'],[9,'var9','payloadLength'],[10,'var10','headerEntryId'],[11,'var11','headerChunkIndex'],[12,'var12','nextSector'],[13,'var13','headerArchiveId'],[14,'var14','headerLength'],[15,'var15','readEnd']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and disk dispatch, queued-write reuse or cache-sector validation data flow.');

for(const [original,to,type] of [['B','paddingBytes','B'],['E','responseBuffer','Lvh;'],['F','blockPosition','I']])field('jf',original,type,to,'Resource response assembly excludes padding from completion/progress and tracks 512-byte transport block position.');
for(const [original,to,type] of [['b','queuedPriority','Lui;'],['n','inFlightPriority','Lui;'],['f','queuedNormal','Lui;'],['g','inFlightNormal','Lui;'],['o','outgoingRecord','Lvh;'],['h','incomingHeader','Lvh;'],['a','activeResponse','Ljf;'],['i','xorByte','B'],['q','errorCount','I'],['p','errorCode','I'],['l','idleMillis','I'],['r','lastPollMillis','J']])field('bp',original,type,to,'Request creation/counting and socket client send/receive/reconnection paths. Priority and normal lanes each include queued and in-flight requests.');
method('bp','a','(IZIBZ)Ljf;','request','Combines archive/group IDs into the secondary key and queues a padded request in the selected lane, enforcing a cap of twenty.',{0:'groupId',1:'obfuscationGuard',2:'archiveId',3:'paddingBytes',4:'priority'});
method('bp','a','(I)I','getPriorityCount','Counts queued plus in-flight priority requests.',{0:'obfuscationGuard'});
method('bp','b','(I)I','getNormalCount','Counts queued plus in-flight normal requests.',{0:'obfuscationGuard'});
method('bp','d','(I)Z','isPriorityFull','Returns whether the priority lane has at least twenty requests.',{0:'obfuscationGuard'});
method('bp','a','(B)Z','isNormalFull','Returns whether the normal lane has at least twenty requests.',{0:'obfuscationGuard'});
method('bp','a','(Z)Z','poll','Contract for request sends and resource response processing.',{0:'checkWriteError'});
method('bp','a','(Ljava/lang/Object;ZI)V','attachTransport','Contract for transport replacement and queued request recovery.',{0:'transport',1:'sessionFlag',2:'obfuscationGuard'});
method('bp','c','(I)V','close','Contract for closing the transport.',{0:'obfuscationGuard'});
method('bp','b','(B)V','invalidateTransport','Contract for transport invalidation and retry state.',{0:'obfuscationGuard'});
field('ae','t','Lhi;','socket','Socket client reads availability/bytes and queues outgoing records through this transport.');
for(const [original,to,type] of [['l','socket','Ljava/net/Socket;'],['f','input','Ljava/io/InputStream;'],['n','output','Ljava/io/OutputStream;'],['e','threadLauncher','Lhd;'],['d','writerTask','Lwo;'],['c','writeBuffer','[B'],['p','bufferCapacity','I'],['b','readPosition','I'],['g','writePosition','I'],['k','closed','Z'],['o','writeError','Z']])field('hi',original,type,to,'Socket constructors, synchronized output ring, input methods and close/writer lifecycle.');
method('hi','a','([BBII)V','write','Queues a byte slice into the output ring and starts the writer through the existing launcher if absent.',{0:'source',1:'obfuscationGuard',2:'sourceOffset',3:'length'});
method('hi','a','(III[B)V','readFully','Reads exactly the requested input slice or throws EOFException.',{0:'obfuscationGuard',1:'destinationOffset',2:'length',3:'destination'});
method('hi','d','(B)I','available','Returns input availability, or zero when closed.',{0:'obfuscationGuard'});
method('hi','a','(I)I','readByte','Reads one input byte, preserving closed/guard behavior.',{0:'obfuscationGuard'});
method('hi','a','(Z)V','checkWriteError','For a true check flag, clears a deferred write-error flag and throws IOException.',{0:'check'});
method('hi','c','(B)V','close','Sets closed and notifies the writer, then joins the existing task thread for the canonical guard.',{0:'obfuscationGuard'});
constructorParameters('hi','(Ljava/net/Socket;Lhd;)V',['socket','threadLauncher'],'Uses the original 5000-byte default output ring.');
constructorParameters('hi','(Ljava/net/Socket;Lhd;I)V',['socket','threadLauncher','bufferCapacity'],'Sets a 30-second read timeout, TCP_NODELAY, streams and ring capacity.');
method('vh','a','(ZJ)V','writeLong40','Writes the low forty bits big-endian; retains guard side effects.',{0:'obfuscationGuard',1:'value'});
for(const [owner,signature,items] of [
 ['bp','a(IZIBZ)Ljf;',[[0,'var6','requestKey'],[1,'var8','request']]],
 ['ae','a(Z)Z',[[4,'var2_long','now'],[5,'var2','priorityRequest'],[9,'var4','elapsedThenHeaderLength'],[11,'var5','availableThenResponseLength'],[12,'var6','readCountThenArchiveId'],[13,'var7','groupIdThenByteIndex'],[14,'var8','flags'],[15,'var9','compressedLength'],[16,'var10','compressionType'],[17,'var11','normalResponseFlag'],[18,'var12','responseKey'],[20,'var14_ref','matchedRequest'],[21,'var15','responsePrefixLength'],[23,'var2Lifetime1','normalRequest']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical ordinal and resource queue keys, response header matching or block reads.');


// Archive identities are reviewed against this game's decoder and callers.
for(const [original,to,type] of [
 ['r','groupCount','I'],['q','groupIds','[I'],['i','groupCapacity','I'],['c','revision','I'],
 ['s','indexCrc','I'],['n','indexDigest','[B'],['m','groupNameHashes','[I'],['l','groupNameLookup','Llr;'],
 ['e','groupCrcs','[I'],['v','groupDigests','[[B'],['t','groupVersions','[I'],
 ['p','fileCounts','[I'],['h','fileCapacities','[I'],['a','fileIds','[[I'],
 ['j','fileNameHashes','[[I'],['f','fileNameLookups','[Llr;'],
])field('jm',original,type,to,'Index constructor checksum/digest validation, versioned decode and ResourceArchive group/file access. Sparse arrays are indexed by actual IDs; null fileIds rows encode contiguous IDs.');
method('jm','a','([BZ)V','decode','Decompresses the index container; reads versions 5–7, flags, delta-coded IDs and optional name/digest tables.',{0:'encodedIndex',1:'obfuscationGuard'});
constructorParameters('jm','([BI[B)V',['encodedIndex','expectedCrc','expectedDigest'],'Checks the entire encoded container CRC and optional 64-byte digest before decoding.');
field('lr','b','[I','keyIndexSlots','Interleaved key and original-input-index slots; -1 in the index slot denotes empty, including when the key itself is -1.');
method('lr','a','(II)I','get','Linear probes and returns the first matching original input index, or -1; duplicate keys preserve the first match.',{0:'key',1:'obfuscationGuard'});
constructorParameters('lr','([I)V',['keys'],'Copies integer keys into a power-of-two table sized above 1.5 times the input count; does not retain the input array.');
for(const [original,to,type] of [['g','provider','Lew;'],['j','index','Ljm;'],['h','packedGroups','[Ljava/lang/Object;'],['c','unpackedFiles','[[Ljava/lang/Object;'],['b','discardPackedGroups','Z'],['e','fileRetentionMode','I']])field('kl',original,type,to,'Archive constructor and unpack/get paths: discard packed groups after decompression; file retention modes 0 retain, 1 discard the returned file, 2 discard its group row.');
method('ew','a','(I)Ljm;','getIndex','Returns the validated archive index when available, otherwise null.',{0:'obfuscationGuard'});
method('ew','a','(II)[B','getEncodedGroup','Returns the encoded group response when available, otherwise null.',{0:'groupId',1:'obfuscationGuard'});
method('ew','b','(II)I','getGroupProgress','Reports the request progress for the group.',{0:'obfuscationGuard',1:'groupId'});
field('bm','q','Ljm;','index','Retained validated index returned by getIndex; constructed from disk or network response bytes.');
for(const [original,descriptor,to,parameters] of [
 ['a','(B)Z','ensureIndex',{0:'obfuscationGuard'}],
 ['c','(II)Z','isValidGroup',{0:'groupId',1:'obfuscationGuard'}],
 ['b','(III)Z','isValidFile',{0:'groupId',1:'obfuscationGuard',2:'fileId'}],
 ['a','(Ljava/lang/String;I)I','getGroupId',{0:'groupName',1:'obfuscationGuard'}],
 ['a','(BILjava/lang/String;)I','getFileId',{0:'obfuscationGuard',1:'groupId',2:'fileName'}],
 ['e','(I)I','getGroupCapacity',{0:'obfuscationGuard'}],
 ['d','(II)I','getFileCapacity',{0:'groupId',1:'obfuscationGuard'}],
 ['b','(II)[I','getFileIds',{0:'obfuscationGuard',1:'groupId'}],
 ['b','(IB)I','getGroupProgress',{0:'groupId',1:'obfuscationGuard'}],
 ['a','(ZI)V','loadPackedGroup',{0:'obfuscationGuard',1:'groupId'}],
 ['a','(BII)[B','getFile',{0:'obfuscationGuard',1:'fileId',2:'groupId'}],
])method('kl',original,descriptor,to,'Reviewed archive index access, case-folded name lookup, group progress or file storage data flow.',parameters);
constructorParameters('kl','(Lew;ZI)V',['provider','discardPackedGroups','fileRetentionMode'],'Stores the provider and validates fileRetentionMode in 0..2.');
method('vh','f','(B)I','readLargeSmart','Reads an unsigned short when the next byte is nonnegative, otherwise an int with the high bit cleared.',{0:'obfuscationGuard'});
method('el','a','(Z[B)[B','decompressContainer','Reads container type and lengths; type zero copies payload, type one dispatches the block decompressor, other types dispatch the stream decompressor.',{0:'obfuscationGuard',1:'encodedContainer'});
for(const [owner,signature,items] of [
 ['jm','a([BZ)V',[[16,'var4','formatVersion'],[17,'var5','flags'],[18,'var6','hasNames'],[19,'var7','hasGroupDigests'],[20,'var8','cumulativeGroupId'],[21,'var9','maximumGroupId'],[22,'var10','groupOrdinal'],[23,'var11','groupId'],[24,'var12','fileCount'],[25,'var13','maximumFileId'],[26,'var14','fileOrdinal'],[27,'var15','fileId'],[30,'var18','packet'],[31,'var22','groupDigest'],[32,'var8Lifetime1','cumulativeFileId'],[33,'var10Lifetime1','groupNameSlot'],[34,'var10Lifetime2','crcGroupOrdinal'],[35,'var10Lifetime3','digestGroupOrdinal'],[36,'var10Lifetime4','versionGroupOrdinal'],[37,'var10Lifetime5','fileGroupOrdinal'],[38,'var10Lifetime6','namedGroupOrdinal'],[39,'var13Lifetime1','fileNameSlot'],[40,'var14Lifetime1','namedFileId'],[41,'var11Lifetime1','namedGroupId'],[42,'var12Lifetime1','namedFileCount'],[43,'var10Lifetime1Lifetime1','groupNameOrdinal'],[44,'var13Lifetime1Lifetime1','namedFileOrdinal']]],
 ['lr','<init>([I)V',[[0,'var2_int','capacity'],[1,'var3','slotIndex'],[2,'var4','bucket'],[8,'var3Lifetime1','inputIndex']]],
 ['lr','a(II)I',[[0,'var3','bucketMask'],[1,'var4','bucket'],[2,'var5','inputIndex']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical declaration ordinal and index delta decoding, table allocation, name/digest slots or open-address probing.');

// Group extraction and storage: names follow the actual decode/release paths.
for(const [original,descriptor,to,parameters,evidence] of [
 ['a','([IIII)[B','getFileWithKeys',{0:'xteaKey',1:'obfuscationGuard',2:'fileId',3:'groupId'},'Reuses unpacked files or loads/unpacks the group with optional XTEA keys, then applies file retention.'],
 ['a','(II[II)Z','unpackGroup',{0:'requestedFileId',1:'obfuscationGuard',2:'xteaKey',3:'groupId'},'Copies encrypted groups before XTEA decryption from offset five; decompresses, sizes and splits chunk tables. Mode two extracts only the requested file.'],
 ['a','(I)I','getOverallProgress',{0:'initialProgressWeight'},'Sums nonempty-group progress and adds 100 per group to the supplied denominator weight; canonical weight is zero.'],
 ['a','(II)Z','ensureGroupAvailable',{0:'obfuscationGuard',1:'groupId'},'Loads a missing packed group through its provider; true means packed bytes are available.'],
 ['a','(III)Z','ensureFileAvailable',{0:'groupId',1:'fileId',2:'obfuscationGuard'},'Returns true for an unpacked file or available packed group, requesting the group otherwise. It does not decompress the file.'],
 ['d','(I)Z','ensureAllGroupsAvailable',{0:'obfuscationGuard'},'Requests every indexed group that lacks packed bytes and reports whether all are available.'],
 ['a','(ILjava/lang/String;)Z','ensureGroupAvailableByName',{0:'obfuscationGuard',1:'groupName'},'Lowercases and hashes the group name, then checks/requests packed bytes.'],
 ['a','(ILjava/lang/String;Ljava/lang/String;)Z','ensureFileAvailableByName',{0:'obfuscationGuard',1:'fileName',2:'groupName'},'The file name precedes the group name in this original signature; resolves both and checks packed/unpacked availability.'],
 ['a','(BLjava/lang/String;)Z','containsGroupName',{0:'obfuscationGuard',1:'groupName'},'Canonical guard -127 tests the case-folded group name hash; noncanonical guards retain their unconditional true branch.'],
 ['a','(Ljava/lang/String;ILjava/lang/String;)[B','getFileByName',{0:'fileName',1:'obfuscationGuard',2:'groupName'},'Resolves group then file names and calls getFile; original argument order is file name before group name.'],
 ['c','(IB)[B','getFlatFile',{0:'id',1:'obfuscationGuard'},'Uses a file ID when the archive group capacity is one, otherwise requires file capacity one in the requested group.'],
 ['a','(IB)Z','ensureFlatFileAvailable',{0:'id',1:'obfuscationGuard'},'Uses the same single-group/single-file-capacity interpretation as getFlatFile and requests packed bytes.'],
 ['a','(Ljava/lang/String;B)I','getGroupProgressByName',{0:'groupName',1:'obfuscationGuard'},'Resolves a case-folded group hash then reports group progress.'],
])method('kl',original,descriptor,to,evidence,parameters);
method('vh','a','([IIII)V','decryptXteaRange','Decrypts 32-round XTEA blocks in [startOffset,endOffset), leaves the partial tail untouched and restores the saved packet position.',{0:'key',1:'endOffset',2:'startOffset',3:'obfuscationGuard'});
method('vh','a','(B[I)V','encryptXtea','Encrypts complete eight-byte blocks up to the initial packet position; starts at zero and leaves position at the end of the complete blocks.',{0:'obfuscationGuard',1:'key'});
method('pf','a','(I[BZ)Ljava/lang/Object;','storeBytes','Payloads above 136 bytes are copied to DirectByteStorage. Smaller arrays are retained or copied according to copySmallArrays; null stays null.',{0:'obfuscationGuard',1:'bytes',2:'copySmallArrays'});
method('ko','a','(ZILjava/lang/Object;)[B','getStoredBytes','Returns byte arrays directly or cloned according to copyByteArrays; ByteStorage reads always return a fresh array; unsupported objects fail.',{0:'copyByteArrays',1:'obfuscationGuard',2:'storedData'});
method('mg','a','(B[B)V','setBytes','Copies input bytes into newly allocated direct storage.',{0:'obfuscationGuard',1:'bytes'});
method('mg','a','(I)[B','getBytes','Direct storage allocates a full-capacity output and reads from the supplied offset; canonical offset zero returns all bytes.',{0:'startOffset'});
field('cj','p','Ljava/nio/ByteBuffer;','buffer','Fresh direct ByteBuffer populated by setBytes; getBytes resets its position before copying.');
for(const [owner,signature,items] of [
 ['kl','a([IIII)[B',[[7,'var5','fileBytesOrFailure'],[9,'var8','fileBytes']]],
 ['kl','a(I)I',[[0,'var2','totalWeight'],[1,'var3','totalProgress'],[2,'var4','groupId'],[3,'var4Lifetime1','percentage']]],
 ['kl','d(I)Z',[[0,'var3','groupOrdinal'],[1,'var2','allGroupsAvailable'],[2,'var4','groupId']]],
 ['kl','a(ILjava/lang/String;)Z',[[0,'var3_int','groupId'],[2,'var4','groupNameCharacters']]],
 ['kl','a(ILjava/lang/String;Ljava/lang/String;)Z',[[0,'var4_int','groupId'],[2,'var5','fileId'],[3,'var6','groupNameCharacters'],[4,'var7','fileNameCharacters']]],
 ['kl','a(Ljava/lang/String;ILjava/lang/String;)[B',[[2,'var5','groupId'],[3,'var6','fileId'],[4,'var7','groupNameCharacters'],[5,'var8','fileNameCharacters']]],
 ['kl','a(II[II)Z',[[0,'array$0','newFileSlots'],[1,'var9_int','presentFileOrdinal'],[3,'array$1','newFileBytes'],[11,'var5_int','fileCount'],[12,'var5','unpackFailure'],[13,'var6','groupFileIds'],[14,'var7','fileSlots'],[15,'var8','allFilesPresent'],[16,'var9','encodedGroup'],[17,'var10','presentFileId'],[18,'var11_ref_RuntimeException','decompressionFailure'],[20,'var12','chunkCount'],[21,'var14','fileSizesOrOffsets'],[22,'var14_int','selectedFileSize'],[24,'var15','splitFileArrays'],[29,'var21','candidateFileId'],[31,'var23','decompressedBytes'],[32,'var24','fileIdTableAlias'],[33,'var25','encryptedCopyAlias'],[34,'var26','decryptionPacket'],[35,'var27','decompressedAlias'],[36,'var29','selectedFileTable'],[37,'var31','allFileTable'],[38,'var32','sizeTableAlias'],[39,'var33','splitArrayAlias'],[40,'var34','fileIdTable'],[41,'var35','encryptedGroupCopy'],[42,'var36','groupData'],[43,'var39','sizesOrWriteOffsets'],[44,'var40','splitFiles'],[45,'var43','splitData'],[46,'var44','selectedFileBytes'],[47,'var14_intLifetime1','selectedFileWriteOffset']]],
 ['vh','a([IIII)V',[[5,'var5_int','savedPosition'],[7,'var6','blockCount'],[8,'var7','blockIndex'],[9,'var8','leftWord'],[10,'var9','rightWord'],[11,'var10','sum'],[12,'var11','delta'],[13,'var12','roundsRemaining']]],
 ['vh','a(B[I)V',[[5,'var3_int','blockCount'],[7,'var4','blockIndex'],[8,'var5','leftWord'],[9,'var6','rightWord'],[10,'var7','sum'],[11,'var8','delta'],[12,'var9','roundsRemaining']]],
 ['pf','a(I[BZ)Ljava/lang/Object;',[[0,'var3','directStorage']]],
 ['ko','a(ZILjava/lang/Object;)[B',[[0,'var3','byteArray'],[3,'var5','byteStorage']]],
 ['cj','a(I)[B',[[0,'var3','result'],[1,'var2','resultAlias']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical declaration ordinal and archive name resolution, chunk sizing/copying, XTEA round arithmetic, progress or byte storage data flow. Reused size/offset roles retain qualified names.');


// Gameplay selection and feedback, reviewed through GameplayController callers.
for(const [original,to,type] of [['k','godMenu','Lub;'],['w','unitMenus','[Lub;'],['N','unitCycler','Leu;'],['v','turnTimerDial','Lsj;'],['s','battleTutorial','Liu;'],['ub','spellConfirmation','Luf;'],['p','remainingTurnTicks','I'],['q','controlledPlayerId','I']])field('ic',original,type,to,'Gameplay construction, god/unit menu rebuilding, own-player selection cycling, timer decrement/tick-divided countdown, tutorial notifications and confirmed spell resumption.');
field('ha','ib','I','turnDurationOption','Indexes ce.turnDurationTicks in gameplay construction and each turn-timer reset.');
field('ce','O','[I','turnDurationTicks','Seven turn-duration choices {12000,9000,7500,6000,4500,3000,1500}; gameplay displays remaining ticks divided by fifty.');
for(const [original,to,type] of [['c','itemCount','I'],['b','items','[Ljr;'],['f','layoutRadius','I']])field('ub',original,type,to,'Constructor retains items and places them around the radius; hit scans and choice lookup traverse itemCount.');
for(const [original,to,type] of [['b','offsetX','I'],['g','offsetY','I'],['a','unitChoice','Z'],['c','godGroupId','I'],['i','choiceId','I'],['d','hitRadius','I']])field('jr',original,type,to,'Item constructor, strict circular pointer hit test and unit/god drawing. choiceId is a unit type for unit choices and a tab choice for god choices.');
constructorParameters('jr','(ZIII)V',['unitChoice','godGroupId','choiceId','hitRadius'],'Captures the choice kind, god/neutral icon group, choice ID and radius.');
constructorParameters('ub','(I[Ljr;Z)V',['layoutRadius','items','clockwise'],'Retains the supplied array and assigns integer-truncated sine/cosine offsets; clockwise chooses the horizontal sign.');
method('jr','b','(IIIII)Z','containsPoint','Uses squared Java-int distance strictly less than radius squared, preserving boundary exclusion and integer wrapping.',{0:'obfuscationGuard',1:'pointerX',2:'originY',3:'originX',4:'pointerY'});
method('jr','a','(IIZI)V','draw','Draws the god or unit choice, with availability and pointer highlight.',{0:'availability',1:'originY',2:'obfuscationGuard',3:'originX'});
method('ub','a','(BIIII)I','getChoiceAtPoint','Returns the first hit item choiceId or -1; retains original coordinate argument order.',{0:'obfuscationGuard',1:'pointerY',2:'originX',3:'pointerX',4:'originY'});
method('ub','b','(BIIII)Z','isSecondHalfHit','Returns true only when the first hit ordinal is strictly greater than itemCount/2.',{0:'obfuscationGuard',1:'pointerY',2:'originY',3:'originX',4:'pointerX'});
method('ub','a','(II)Ljr;','getItemByChoiceId','Returns the first matching choice ID; duplicates remain distinct entries.',{0:'choiceId',1:'obfuscationGuard'});
method('ub','a','(II[III)V','draw','Checks mana and favour against unit definitions; neutral/god tabs use their favour value before item drawing.',{0:'mana',1:'obfuscationGuard',2:'godFavourLevels',3:'originX',4:'originY'});
method('ic','f','(Z)V','rebuildSummonMenus','Builds the god tabs and neutral/per-god unit menus from chosen gods, unlock masks and campaign state.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['c','selectedNode','Ltc;'],['b','units','Lat;'],['f','iterator','Lbb;']])field('eu',original,type,to,'Tracks a selected unit node and independent deque iterator; refreshes selection after unlink, with wrapping traversal.');
constructorParameters('eu','(Lat;)V',['units'],'Retains the supplied unit deque and creates an independent iterator.');
method('eu','d','(B)Ltc;','getSelectedNode','Returns the retained node without implicitly validating its links.',{0:'obfuscationGuard'});
method('eu','c','(B)Z','isSelectionUnlinked','Clears a null/unlinked selection; tests the next link rather than deque membership.',{0:'obfuscationGuard'});
method('eu','a','(ILjd;)V','selectUnit','Stores the supplied Unit for canonical guards at most -90; does not validate deque membership.',{0:'obfuscationGuard',1:'unit'});
method('eu','a','(I)V','selectNext','Advances from the selected node and wraps to first; refreshes an invalid selection.',{0:'obfuscationGuard'});
method('eu','b','(I)V','selectPrevious','Moves backwards from the selected node and wraps to last.',{0:'obfuscationGuard'});
method('eu','b','(B)I','getUnitCount','Reports the current deque size.',{0:'obfuscationGuard'});
method('eu','c','(I)V','refreshIteratorIfNeeded','Recreates the iterator when the selected node is absent or unlinked.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['c','cycleLength','I'],['f','pixelThresholds','[I'],['h','sweepPosition','I'],['i','useSweepMask','Z']])field('sj',original,type,to,'Angular threshold constructor and downward sweep with cycle wrap; negative targets reset position and enable the mask.');
constructorParameters('sj','(I)V',['cycleLength'],'Builds one angular threshold per timer sprite pixel using the shared width/height.');
method('sj','a','(ZIB)V','advanceSweep','Moves down toward the target by at most twice the nominal tick rate, wrapping once; resets on a negative target.',{0:'useMaskAfterWrap',1:'targetPosition',2:'obfuscationGuard'});
method('sj','a','(IIB)V','draw','Draws the base timer sprite or selects base/alternate pixels using angular thresholds.',{0:'screenY',1:'screenX',2:'obfuscationGuard'});
method('tp','b','(I)I','getNominalTickRate','Returns 1000000000 divided by the configured nanoseconds per game tick; this is not presented rendering FPS.',{0:'obfuscationGuard'});
for(const [original,to,type] of [['q','controller','Lic;'],['k','stage','I'],['p','messageId','I'],['e','message','Ljava/lang/String;'],['w','buttonMode','I'],['c','expanded','Z'],['a','expandedPanelHeight','I'],['j','panelHeight','I'],['f','targetPanelWidth','I'],['g','panelWidth','I'],['m','autoAdvanceFrames','I'],['v','enemyWaveSpawned','Z']])field('iu',original,type,to,'Tutorial constructors, stage/message selection, button handling, summon-wave completion test and five-pixel panel interpolation. Message ID indexes vl.battleHintMessages at stage 34.');
field('vl','m','[Ljava/lang/String;','battleHintMessages','BattleTutorial stage 34 selects the constructor-supplied message ID; message 95 is chosen by an existing tutorial control helper.');
method('iu','a','(Ljava/lang/String;B)V','setMessage','Stores text and recalculates expanded panel height/target width; stage 34 keeps the original 100-pixel collapsed width.',{0:'message',1:'obfuscationGuard'});
method('iu','f','(I)V','advancePanelAnimation','Moves panel height/width by at most five per call and advances a delayed tutorial action when its frame counter reaches zero.',{0:'obfuscationGuard'});
method('iu','b','(III)V','handleInteraction','Dispatches tutorial interaction kinds; kind five is reclassified by the tile terrain before stage handling.',{0:'tileIndex',1:'obfuscationGuard',2:'interactionKind'});
method('iu','b','(II)V','setStage','Stores the stage, clears control highlights, selects the hint/button mode and invokes the existing stage-specific effects.',{0:'stage',1:'obfuscationGuard'});
method('iu','h','(B)V','draw','Draws the animated tutorial panel, controls and message.',{0:'obfuscationGuard'});
method('iu','a','(Z)V','activateButton','Dispatches the current button mode; mode one toggles expansion, mode five moves to stage 33.',{0:'obfuscationGuard'});
method('iu','d','(B)V','clearControlHighlights','Clears the four GameplayController flags used by tutorial control highlights.',{0:'obfuscationGuard'});
method('iu','c','(B)Z','isEnemyWaveDefeated','Tests that player-one units are empty and the designated tutorial portal belongs to player zero.',{0:'obfuscationGuard'});
method('iu','a','(IB)I','classifyTerrainInteraction','Maps terrain 7/8/9 to interaction kinds 6/7/8, and all other terrain to kind 9.',{0:'tileIndex',1:'obfuscationGuard'});
method('iu','c','(I)V','spawnEnemyWave','Changes tile (9,12) terrain and queues three fixed tutorial summons, then records wave-spawned state.',{0:'secondUnitBonus'});
constructorParameters('iu','(Lic;I)V',['controller','messageId'],'Creates a stage-34 battle hint indexed by messageId.');
constructorParameters('iu','(Lic;)V',['controller'],'Creates the full battle tutorial and modifies the designated portal/team structure state.');
method('ic','g','(III)V','notifyTutorialInteraction','Forwards interactionKind and tileIndex to the current BattleTutorial when present.',{0:'interactionKind',1:'tileIndex',2:'obfuscationGuard'});
for(const [original,to,type] of [['d','selectionMode','I'],['k','spellId','I'],['b','tileX','I'],['c','tileY','I'],['h','prompt','Ljava/lang/String;']])field('uf',original,type,to,'Dialog constructor and GameplayController confirm branch resume the same spell cast with confirmation accepted.');
constructorParameters('uf','(IIIILjava/lang/String;Lic;)V',['selectionMode','spellId','tileX','tileY','prompt','unusedController'],'Stores spell target/selection and message; controller argument is not retained.');
method('uf','a','(IBI)I','getActionAtPointer','Inclusive left/right button rectangles return the supplied confirmation/cancellation action IDs, or -1.',{0:'cancelAction',1:'obfuscationGuard',2:'confirmAction'});
method('uf','b','(I)V','draw','Draws the dimmed background, prompt and two confirmation buttons.',{0:'obfuscationGuard'});
method('ic','a','(IIIIZI)V','requestSpellCast','Validates the spell and shows an optional confirmation prompt before preparing movement or queuing the cast.',{0:'selectionMode',1:'tileY',2:'spellId',3:'obfuscationGuard',4:'confirmed',5:'tileX'});
method('de','a','(BILha;III)Ljava/lang/String;','getSpellCastError','Checks acting turn, cost/favour, target bounds and spell-specific restrictions; null permits the cast.',{0:'obfuscationGuard',1:'tileY',2:'battlefield',3:'tileX',4:'spellId',5:'actingPlayer'});
method('kq','a','(IIILha;I)Ljava/lang/String;','getSpellConfirmationPrompt','Returns a warning when a targeted spell can overwrite equipment/status; null means no prompt.',{0:'tileY',1:'obfuscationGuard',2:'spellId',3:'battlefield',4:'tileX'});
method('ka','a','(Ljava/lang/String;II)I','getParagraphHeight','Wraps text to the supplied width and returns ascent plus line increments plus descent; lineHeight zero uses the font default.',{0:'text',1:'width',2:'lineHeight'});
field('eo','b','Lv;','camera','Projects each tile before unit visibility/model refresh.');
field('ic','gb','Leo;','unitRenderer','Gameplay refreshes models through this camera-backed renderer.');
field('vb','u','Leo;','unitRenderer','Both EventPresenter constructors retain the renderer supplied by gameplay.');
field('jd','x','Lhr;','modelPreview','BattleUnitRenderer creates and retains the current model preview for the unit.');
field('jd','U','Z','modelVisible','BattleUnitRenderer stores its camera-bound visibility test before model refresh.');
field('jd','z','I','modelAnimationIndex','Passed to UnitModelPreview.selectAnimation; the renderer normalizes sentinel -1 to zero.');
constructorParameters('eo','(Lv;)V',['camera'],'Retains the supplied camera and constructs the existing projection helper.');
method('eo','a','(BI)Z','isTileVisible','Projects the tile and permits screen bounds x in [-180,width], y in [-10,height].',{0:'obfuscationGuard',1:'tileIndex'});
method('eo','a','(IBI[Lne;)V','refreshUnitModels','Traverses the rectangular tile array and refreshes eligible occupants.',{0:'mapWidth',1:'obfuscationGuard',2:'mapHeight',3:'tiles'});
method('eo','a','(IILjd;)V','refreshUnitModel','Updates visibility, releases offscreen models when eligible, otherwise advances the retained model.',{0:'obfuscationGuard',1:'tileIndex',2:'unit'});
for(const [owner,signature,items] of [
 ['ub','<init>(I[Ljr;Z)V',[[0,'var4_int','itemOrdinal']]],
 ['ub','a(BIIII)I',[[0,'var6','itemOrdinal']]],
 ['ub','a(II)Ljr;',[[0,'var3','itemOrdinal']]],
 ['jr','b(IIIII)Z',[[0,'var7','deltaY'],[1,'var6','deltaX'],[2,'var7Lifetime1','deltaYCanonical']]],
 ['sj','<init>(I)V',[[0,'var4','pixelIndex'],[1,'var2','minimumThreshold'],[2,'var3','maximumThreshold'],[3,'var5','pixelXFromCenter'],[4,'var6','pixelYFromCenter'],[5,'var7','threshold']]],
 ['sj','a(ZIB)V',[[0,'var5','distanceToTarget'],[1,'var6','maximumStep'],[2,'var4','guardArithmetic']]],
 ['iu','f(I)V',[[8,'var2','targetHeight'],[9,'var3','guardArithmetic'],[10,'var4','heightToShrink'],[11,'var4Lifetime1','heightToGrow'],[12,'var4Lifetime2','widthToShrink'],[13,'var4Lifetime3','widthToGrow']]],
 ['uf','a(IBI)I',[[0,'var4','surfaceWidth'],[1,'var5','surfaceHeight'],[2,'var6','dialogHeight']]],
 ['ic','f(Z)V',[[3,'var2','godItems'],[4,'var2_int','neutralItemCount'],[6,'var3_int','godOrdinal'],[7,'var3','neutralItems'],[8,'var4','neutralUnitOrdinal'],[9,'var5','neutralUnitType'],[10,'var6','godUnitType'],[12,'var3Lifetime1','godUnitItems'],[15,'var2_intLifetime1','godUnitCount'],[16,'var5Lifetime1','godUnitOrdinal'],[17,'var4Lifetime1','chosenGodOrdinal']]],
 ['ic','a(IIIIZI)V',[[1,'var7','validationMessage'],[3,'var8','spell'],[5,'var7Lifetime1','confirmationPrompt']]],
 ['eo','a(BI)Z',[[0,'var3','screenX'],[1,'var4','screenY'],[3,'var5','surfaceWidth'],[4,'var6','surfaceHeight']]],
 ['eo','a(IBI[Lne;)V',[[0,'var7','tileIndex'],[1,'var5_int','tileCount'],[3,'var6','unit']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical declaration ordinal and summon item layout/hits, timer angles/sweep, hint animation, spell confirmation or visible unit refresh.');


field('gb','C','I','equipmentSlot','Indexes battlefield.equippedSpellIds[0] during the five-slot equipment lesson; starts at -1.');
field('r','E','[Ljava/lang/String;','equipmentTutorialMessages','Specialist-equipment lesson text beginning after Eastbridge, read by EquipmentBattleTutorial.');
field('ha','B','[[I','equippedSpellIds','Five equipment/spell IDs per player, assigned during match setup and read by the equipment tutorial slot cursor.');
field('ha','a','[[I','godUnitUnlockMasks','Per-player masks indexed by unit unlock group minus one; equipment tutorial unit availability also checks god favour.');
constructorParameters('gb','(Lic;)V',['controller'],'Initializes the full equipment tutorial, fixed tutorial units and captured structures.');
method('gb','c','(II)Z','isGodLocked','Tests whether player-zero favour for the god is exactly zero; negative favour retains its nonzero behavior.',{0:'godId',1:'obfuscationGuard'});
method('gb','b','(IB)Z','isUnitLocked','Tests player-zero favour and the unit bit in its god unlock group.',{0:'unitType',1:'obfuscationGuard'});
method('gb','j','(I)Z','isSelectedUnitEligible','For equipped spell IDs 34/35/109 accepts an unspent player-zero unit; ID 36 accepts an unspent nonzero-owner unit. Other IDs reject.',{0:'obfuscationGuard'});
method('gb','e','(II)V','setEquipmentStage','Stores the equipment lesson stage, clears highlights and selects its prompt/slot state.',{0:'obfuscationGuard',1:'stage'});
method('gb','h','(I)V','updateLesson','Uses the current stage, equipped slot and spell definition to update lesson controls and hints.',{0:'obfuscationGuard'});
method('ic','t','(B)V','startEquipmentTutorial','Resets planners, creates EquipmentBattleTutorial and installs the existing two-player tutorial setup.',{0:'obfuscationGuard'});


// Isometric projection, mesh preprocessing and event-owned model lifetime.
for(const [original,to,type] of [['j','mapWidth','I'],['m','mapHeight','I'],['c','gridPosition','[I'],['e','screenPosition','[I'],['h','transformedPosition','[I'],['b','projectionTileIndex','I']])field('v',original,type,to,'Camera initialization, index-to-grid conversion, 40/20 isometric projection, viewport offset and fixed-point transformed target.');
field('ro','ob','Lv;','modelProjectionCamera','UnitModelPreview uses this shared BattleCamera when its screen-Y argument is -1.');
method('v','a','(II)V','projectTile','Stores tile index division/remainder as grid coordinates, projects to targetPosition and offsets it into the viewport.',{0:'gridYSlot',1:'tileIndex'});
method('v','f','(I)V','projectGridToTarget','Maps grid coordinates to targetX=40+40*(x+y), targetY=20*(y-x)+mapWidth*20.',{0:'obfuscationGuard'});
method('v','i','(I)V','projectTargetToScreen','Adds the viewport center to targetPosition minus currentPosition; canonical current-X slot is zero.',{0:'currentXSlot'});
method('v','b','(B)V','selectProjectionTile','Decodes projectionTileIndex into the current grid position; its byte guard has no extra canonical work.',{0:'obfuscationGuard'});
method('v','c','(I)V','projectModelAnchor','Projects grid coordinates and computes the viewport anchor with the original minus-twenty Y offset.',{0:'obfuscationGuard'});
method('v','a','(B)V','transformTarget','Maps the target to the existing fixed-point transformed position used by the quaternion setup helper.',{0:'obfuscationGuard'});
method('v','e','(I)V','screenToTarget','Converts screenPosition back into world target coordinates relative to the viewport center and camera.',{0:'obfuscationGuard'});
method('v','d','(I)V','targetToGrid','Converts world target to grid coordinates with the original negative-coordinate rounding and height offset.',{0:'gridYSlot'});
method('v','c','(Z)V','screenToGrid','Converts screenPosition through world target into grid coordinates.',{0:'obfuscationGuard'});
constructorParameters('v','(II)V',['mapWidth','mapHeight'],'Initializes camera arrays and publishes the shared influence-map camera; initial position uses the existing pre-assignment dimension values.');
method('hr','b','(IIB)V','setBattleScreenPosition','Uses modelProjectionCamera when screenY is -1; otherwise uses the given coordinates, then applies X+39 and Y+7 offsets.',{0:'screenY',1:'screenXOrTileIndex',2:'obfuscationGuard'});
method('hr','a','(IZIIIZ)Z','advanceBattleModel','Selects/advances the animation and updates the projected screen position/yaw; a missing sequence completes before projection.',{0:'screenY',1:'unusedVisible',2:'screenXOrTileIndex',3:'yawOverride',4:'animationIndex',5:'obfuscationGuard'});
method('hr','a','(BZ)V','drawAtStoredPosition','Draws the mesh at its retained screenPosition with optional highlighting.',{0:'obfuscationGuard',1:'highlighted'});
method('hr','a','(ZII)V','initialize','Creates its animation player, selects type/default animation and initializes screen position/yaw.',{0:'obfuscationGuard',1:'yaw',2:'unitType'});
method('eo','a','(IIIILjd;)Z','advanceUnitModel','Creates a missing preview, uses type 75 for flagged type 34, normalizes animation sentinel -1 to zero and advances the model.',{0:'screenXOrTileIndex',1:'obfuscationGuard',2:'screenY',3:'yawOverride',4:'unit'});
field('jd','u','Z','presentationOwnsModel','GameEvent sets this while a presentation owns the unit, then clears it on completion; regular model refresh skips these units and preserves their offscreen model.');
method('oj','a','(Ljd;I)V','claimUnitModel','Sets presentationOwnsModel on the supplied unit; does not change the event unit reference.',{0:'unit',1:'obfuscationGuard'});
method('oj','f','(I)V','completeAllPresentations','Clears unit presentation ownership/animation, sets pending count to zero and marks completion.',{0:'obfuscationGuard'});
method('jd','c','(II)V','setModelUnitType','Creates a missing preview or changes its type while retaining the preview object.',{0:'modelUnitType',1:'obfuscationGuard'});
method('vh','a','(I)I','readSignedSmart','Reads a one-byte signed value offset by 64, or a two-byte value offset by 49152; mesh vertex and face-index deltas use this codec.',{0:'obfuscationGuard'});
method('pg','a','(IIZI)Lqb;','selectUnitAnimation','Selects a random variant in the animation slot; a negative choice scans for the first nonnegative variant before optional slot-zero fallback.',{0:'animationIndex',1:'obfuscationGuard',2:'allowDefaultFallback',3:'unitType'});
field('aw','j','[[[I','unitAnimationVariants','Nine animation slots per unit, each containing variant IDs or negative unavailable markers.');
field('ck','e','[[Lqb;','animationSequencesByGroup','Unit animation group then selected variant indexes this sequence table.');
field('sf','P','[I','unitAnimationGroups','Maps unit type to its sequence-table group.');
field('gg','J','Ljava/util/Random;','animationRandom','Random generator consumed when choosing a unit animation variant.');
for(const [original,to] of [['b','w'],['f','x'],['d','y'],['e','z']])field('wq',original,'I',to,'Hamilton-product component equations and identity scalar 65536 establish the 16.16 quaternion roles.');
method('wq','a','(Lwq;Z)V','copyInto','Copies all four components into the destination; a null destination creates a local unretained quaternion.',{0:'destination',1:'obfuscationGuard'});
method('wq','a','(ILwq;)V','prependRotation','Computes other*this with separately shifted 16.16 products, then normalizes; canonical guard one installs all four components.',{0:'obfuscationGuard',1:'other'});
method('wq','a','(I)V','normalize','Normalizes unless squared magnitude lies in 65535..65537; a zero quaternion retains division-by-zero failure.',{0:'obfuscationGuard'});
method('wq','a','(BIIII)V','setAxisAngle','Uses half the encoded angle and 2048-entry sine/cosine tables; original axis argument order is X,Z,Y.',{0:'obfuscationGuard',1:'axisX',2:'axisZ',3:'axisY',4:'angle'});
method('ik','a','(JJI)I','multiplyFixed16','Returns the low int of the signed long product shifted right sixteen.',{0:'left',1:'right',2:'obfuscationGuard'});
method('ue','a','(JJB)I','divideFixed16','Returns the low int of (numerator<<16)/denominator, retaining long wrapping and truncation toward zero.',{0:'numerator',1:'denominator',2:'obfuscationGuard'});
method('so','a','(II)I','sqrtFixed16','Uses the existing fixed-point square-root table and scale shifts; zero returns zero and negative input fails.',{0:'value',1:'obfuscationGuard'});
for(const [original,to,type] of [['x','vertexCount','I'],['v','referencedVertexCapacity','I'],['O','faceCount','I'],['N','verticesX','[I'],['D','verticesY','[I'],['u','verticesZ','[I'],['q','faceVertexA','[I'],['o','faceVertexB','[I'],['r','faceVertexC','[I'],['p','faceRenderTypes','[B'],['y','vertexNormals','[Lwi;'],['L','faceNormals','[Lkg;'],['m','vertexSkinIds','[I'],['e','faceSkinIds','[I'],['l','vertexGroups','[[I'],['H','faceGroups','[[I'],['i','faceColors','[S']])field('js',original,type,to,'Mesh decoder, normal accumulation, skin-ID grouping and ModelMesh construction. referencedVertexCapacity is one plus the highest face-referenced vertex index.');
for(const [original,to,type] of [['I','vertexCount','I'],['p','referencedVertexCapacity','I'],['Y','faceCount','I'],['G','verticesX','[I'],['o','verticesY','[I'],['F','verticesZ','[I'],['jb','faceVertexA','[I'],['bb','faceVertexB','[I'],['N','faceVertexC','[I'],['r','faceColors','[S'],['S','vertexGroups','[[I'],['i','faceGroups','[[I']])field('gd',original,type,to,'ModelMesh retains the geometry and grouped animation bindings from MeshData before calculating face lighting.');
for(const [original,to] of [['nb','textureVertexA'],['q','textureVertexB'],['w','textureVertexC']])field('gd',original,'[I',to,'Texture triangles copied from MeshData M/n/C for type-zero texture mappings; these are vertex indices, not geometry coordinates.');
field('gd','l','I','textureTriangleCount','Counts retained type-zero texture triangles referenced by faces.');
for(const [original,to,type] of [['k','skeletonId','I'],['o','transformCount','I'],['p','transformTypes','[I'],['l','transformGroups','[[I'],['s','transformMasks','[I'],['q','encodedTransformFlags','[Z']])field('ig',original,type,to,'Skeleton constructor decodes transform types, encoded flags, unsigned-short masks and group index rows; frame blending consumes types/groups/masks.');
for(const [original,to,type] of [['n','skeleton','Lig;'],['d','transformCount','I'],['a','transformSlots','[S'],['l','transformX','[S'],['f','transformY','[S'],['h','transformZ','[S'],['i','precedingPivotSlots','[S'],['m','interpolationFlags','[B']])field('ht',original,type,to,'Sparse frame decoder and ModelMeshBase blending: components default to zero or 128 for scale, rotations unpack to eleven bits, preceding pivots use -1, interpolation flag bits inhibit blending.');
for(const [original,to,type] of [['C','groupId','I'],['x','encodedFrames','[[B'],['A','frames','[Lht;']])field('wp',original,type,to,'Frame-set constructor and readiness method retain encoded archive files until all skeleton dependencies are available, build the sparse frame-ID array and release encoded bytes.');
constructorParameters('ig','(I[B)V',{0:'skeletonId',1:'encodedSkeleton'},'Decodes the transform slot tables with this skeleton identity.');
constructorParameters('ht','([BLig;)V',{0:'encodedFrame',1:'skeleton'},'Decodes sparse transforms against the supplied skeleton; invalid/trailing input sets transformCount to zero.');
constructorParameters('wp','(I)V',{0:'groupId'},'Stores the archive group ID.');
method('wp','f','(B)Z','ensureFramesAvailable','Resolves skeleton dependencies, reuses skeleton identity within the set, and releases encodedFrames after construction.',{0:'obfuscationGuard'});
method('kk','a','(Lwp;ILwp;IIIZ)V','applyAnimationFrame','Begins animation, optionally blends a second frame sharing the exact skeleton object, then finishes animation.',{0:'frameSet',1:'frameId',2:'nextFrameSet',3:'nextFrameId',4:'elapsed',5:'duration',6:'transformOption'});
method('kk','a','(Lig;Lht;Lht;II[ZZZI[I)V','blendAnimationFrames','Interpolates sparse transforms by slot, applies preceding pivots and intersects skeleton masks; rotation differences wrap at 2048 and colour hue differences at 64.',{0:'skeleton',1:'frame',2:'nextFrame',3:'elapsed',4:'duration',5:'slotSelection',6:'selectedValue',7:'transformOption',8:'transformMask',9:'transformMatrix'});
method('kk','b','()Z','beginAnimation','Returns false without vertex groups; otherwise resets the shared pivot coordinates.');
method('kk','a','()V','finishAnimation','Refreshes modified face lighting when needed and invalidates mesh bounds.');
method('kk','a','(I[IIIIZ)V','applyGroupTransform','Applies an encoded transform type to the listed mesh groups.',{0:'transformType',1:'groups',2:'x',3:'y',4:'z',5:'transformOption'});
method('kk','a','(I[IIIIZI[I)V','applyMaskedGroupTransform','Applies a group transform with the per-slot mask and optional transform matrix.',{0:'transformType',1:'groups',2:'x',3:'y',4:'z',5:'transformOption',6:'transformMask',7:'transformMatrix'});
method('kk','b','(III)V','scaleGeometry','Scales vertex coordinates independently with 128 as unity; invalidates bounds.',{0:'scaleX',1:'scaleY',2:'scaleZ'});
field('jj','c','Lkl;','animationFramesArchive','AnimationFrameSet obtains its encoded frame groups and file IDs from this archive.');
field('up','e','Lkl;','animationSkeletonsArchive','AnimationFrameSet resolves skeleton IDs through this archive’s flat-file contract.');
for(const [original,to,type] of [['v','animationPivotX','I'],['mb','animationPivotY','I'],['cb','animationPivotZ','I'],['e','vertexTransformMasks','[S'],['g','faceTransformMasks','[S'],['H','faceAlpha','[B'],['db','faceColorsDirty','Z'],['k','boundsValid','Z']])field('gd',original,type,to,'Group transforms average a shared pivot, test vertex/face mask intersection, clamp unsigned alpha and mark colour lighting dirty; finishAnimation invalidates bounds.');
method('gd','e','()V','refreshFaceLighting','Retains packed brightness and recomputes the colour-dependent shade portions after face colours change.');
method('gd','d','()V','calculateBounds','Calculates the spherical radius over referenced vertices, retaining Java-int square overflow and the short radius representation.');
field('gd','A','S','boundingRadius','Stored as a short after sqrt(max squared XYZ radius) plus 0.99 in calculateBounds.');
for(const [original,to,type] of [['n','sineTable','[I'],['e','cosineTable','[I'],['o','textureProvider','Llh;'],['l','clipWidth','I'],['q','clipHeight','I'],['k','scanlineOffsets','[I'],['c','projectionCenterX','I'],['j','projectionCenterY','I']])field('tm',original,type,to,'Raster clip setup computes width/height, absolute row offsets and local projection centre; model transforms read 2048-entry trigonometric tables generated at scale 65536.');
method('tm','a','()V','useRasterClip','Copies the current SoftwareRaster clip into the triangle rasterizer.');
method('tm','a','(IIII)V','setClip','Sets clip dimensions, resets projection centre and fills absolute scanline offsets.',{0:'left',1:'top',2:'right',3:'bottom'});
method('tm','c','()V','centerProjection','Resets the local projection centre to half the clip dimensions.');
method('tm','c','(II)V','setProjectionCenter','Converts the supplied raster coordinates to coordinates relative to the first scanline offset.',{0:'rasterX',1:'rasterY'});
field('tm','f','I','blendAlpha','Span drawing weights existing pixels by this value and new colours by 256 minus it; the original flat-span special case at 254 remains unchanged.');
field('tm','a','Z','clipHorizontalSpans','Span methods clamp left/right endpoints to 0 and clipWidth when enabled.');
field('tm','h','[I','colorPalette','Shaded spans map interpolated packed colour indices to integer RGB pixels through this table.');
method('tm','a','(IIIIIII)V','drawFlatTriangle','Rasterizes the triangle into absolute scanline rows, using one RGB colour.',{0:'yA',1:'yB',2:'yC',3:'xA',4:'xB',5:'xC',6:'rgbColor'});
method('tm','a','(IIIIIIIII)V','drawShadedTriangle','Interpolates per-vertex packed colour indices and draws through colorPalette.',{0:'yA',1:'yB',2:'yC',3:'xA',4:'xB',5:'xC',6:'colorA',7:'colorB',8:'colorC'});
constructorParameters('gd','(Ljs;IIIII)V',['source','ambient','contrast','lightX','lightY','lightZ'],'Retains source geometry and builds face lighting from ambient, contrast and the supplied light vector.');
method('lh','a','(ZI)Z','hasTexture','Mesh construction retains a texture ID only when this availability query succeeds.',{0:'obfuscationGuard',1:'textureId'});
method('lh','a','(IFI)[I','getTexturePixels','Textured triangle drawing requests this integer pixel array with the current brightness argument.',{0:'textureId',1:'brightness',2:'obfuscationGuard'});
method('lh','a','(IB)I','getAverageTextureColor','Missing texture pixels fall back to shaded triangles using this packed colour.',{0:'textureId',1:'obfuscationGuard'});
for(const [original,to,type] of [['j','scratchTransformSlots','[S'],['k','scratchTransformX','[S'],['e','scratchTransformY','[S'],['b','scratchTransformZ','[S'],['g','scratchPivotSlots','[S'],['c','scratchInterpolationFlags','[B']])field('ht',original,type,to,'Shared fixed-capacity frame decoder scratch arrays; completed frames copy their populated prefix into owned arrays.');
method('ht','a','()V','releaseDecoderScratch','Clears shared decoder scratch arrays; subsequent nonempty decoding retains the original caught-failure behavior.');
for(const [owner,signature,items] of [
 ['ig','<init>(I[B)V',[[0,'array$0','groupIndices'],[1,'var5','groupIndexOrdinal'],[9,'var3','failure'],[10,'var4','typeSlot'],[11,'var7','packet'],[12,'var8','packetAlias'],[13,'var4Lifetime1','flagSlot'],[14,'var4Lifetime2','maskSlot'],[15,'var4Lifetime3','groupSizeSlot'],[16,'var4Lifetime4','groupSlot']]],
 ['ht','<init>([BLig;)V',[[1,'var3','decodeFailure'],[2,'var4','componentPacket'],[3,'var5','encodedSlotCount'],[4,'var6','decodedTransformCount'],[5,'var7','latestPivotSlot'],[6,'var8','lastEmittedPivotSlot'],[7,'var9','slot'],[8,'var10','transformType'],[9,'var11','componentFlags'],[10,'var12','defaultComponent'],[11,'var13','copiedTransform'],[12,'var14','flagsPacket'],[13,'var9Lifetime1','initialCopyCursor']]],
 ['wp','f(B)Z',[[0,'var2','allSkeletonsAvailable'],[1,'var3_int','encodedFileOrdinal'],[2,'var3','loadedSkeletons'],[3,'var4','frameCapacity'],[4,'var6','requiredSkeletonId'],[5,'var8','frameHeader'],[6,'var9','skeletonId'],[7,'var10','resolvedSkeleton'],[8,'var11','cachedSkeleton'],[9,'var12','obfuscationControl'],[10,'var13','dependencyOrdinal'],[11,'var16','dependencyHeader'],[12,'var27','encodedFileIds'],[13,'var28','dependencyBytes'],[14,'var29','frameFileIds'],[15,'var30','frameBytes'],[16,'var3_intLifetime1','initialDependencyCursor'],[17,'var6Lifetime1','decodedFileOrdinal']]],
 ['kk','a(Lwp;ILwp;IIIZ)V',[[0,'var8','frame'],[1,'var9','skeleton'],[2,'var10','compatibleNextFrame']]],
 ['kk','a(Lig;Lht;Lht;II[ZZZI[I)V',[[0,'var11','initialFrameCursor'],[1,'var12','initialNextFrameCursor'],[2,'var13','initialSlotCursor'],[3,'var14','frameHasSlot'],[4,'var15','nextFrameHasSlot'],[5,'var16','defaultComponent'],[6,'var17','transformType'],[7,'var18','frameX'],[8,'var19','frameY'],[9,'var20','frameZ'],[10,'var21','framePivotSlot'],[11,'var22','frameFlags'],[12,'var23','nextX'],[13,'var24','nextY'],[14,'var25','nextZ'],[15,'var26','nextPivotSlot'],[16,'var27','nextFlags'],[17,'var28','blendedX'],[18,'var29','blendedY'],[19,'var30','blendedZ'],[20,'var31','wrappedXOrHueDelta'],[21,'var32','wrappedYDelta'],[22,'var33','wrappedZDelta'],[23,'var34','frameCursor'],[24,'var35','nextFrameCursor'],[25,'var36','slot'],[26,'var11Lifetime1','singleFrameCursor'],[27,'var12Lifetime1','singleFrameSlot'],[28,'var13Lifetime1','singleFramePivotSlot'],[29,'var14Lifetime1','singleFramePivotMask'],[30,'var31Lifetime1','pivotMask'],[31,'var31Lifetime2','slotMask'],[32,'var14Lifetime1Lifetime1','singleFrameSlotMask']]],
 ['gd','a(I[IIIIZ)V',[[0,'var7','groupCount'],[1,'var8','pivotVertexCount'],[2,'var9','pivotGroupOrdinal'],[3,'var10','pivotGroupId'],[4,'var11','translationVertexOrdinal'],[5,'var12','pivotVertexOrdinal'],[6,'var13','pivotVertexIndex'],[7,'var14','cosZ'],[8,'var15','rotatedXAfterZ'],[9,'var16','lightness'],[10,'var35','pivotVertices'],[11,'var36','translatedVertices'],[12,'var37','rotatedVertices'],[13,'var38','scaledVertices'],[14,'var39','alphaFaces'],[15,'var40','colorFaces'],[16,'var8Lifetime1','translationGroupOrdinal'],[17,'var8Lifetime2','rotationGroupOrdinal'],[18,'var8Lifetime3','scaleGroupOrdinal'],[19,'var8Lifetime4','faceGroupOrdinal'],[20,'var9Lifetime1','translationGroupId'],[21,'var9Lifetime2','rotationGroupId'],[22,'var9Lifetime3','scaleGroupId'],[23,'var9Lifetime4','faceGroupId'],[24,'var11Lifetime1','rotationVertexOrdinal'],[25,'var11Lifetime2','scaleVertexOrdinal'],[26,'var11Lifetime3','faceOrdinal'],[27,'var12Lifetime1','translationVertexIndex'],[28,'var12Lifetime2','rotationVertexIndex'],[29,'var12Lifetime3','scaleVertexIndex'],[30,'var12Lifetime4','faceIndex'],[31,'var13Lifetime1','sinZ'],[32,'var13Lifetime2','packedColorOrAlpha'],[33,'var14Lifetime1','hue'],[34,'var15Lifetime1','saturation'],[35,'var14Lifetime2','cosX'],[36,'var14Lifetime3','cosY'],[37,'var15Lifetime2','rotatedYAfterX'],[38,'var15Lifetime3','rotatedXAfterY'],[39,'var13Lifetime1Lifetime1','sinX'],[40,'var13Lifetime1Lifetime2','sinY']]],
 ['gd','a(I[IIIIZI[I)V',[[2,'var9','groupCount'],[3,'var10','pivotVertexCount'],[4,'var11','pivotGroupOrdinal'],[5,'var12','pivotGroupId'],[6,'var13','translationVertexOrdinal'],[7,'var14','pivotVertexOrdinal'],[8,'var15','pivotVertexIndex'],[38,'var43','matrixRotationVertexIndex'],[49,'var78','pivotVertices'],[50,'var79','translatedVertices'],[51,'var80','matrixRotationVertices'],[52,'var81','rotatedVertices'],[53,'var82','matrixScaleVertices'],[54,'var83','scaledVertices'],[55,'var84','alphaFaces'],[56,'var85','colorFaces'],[57,'var10Lifetime1','transformedTranslationX'],[58,'var10Lifetime2','groupOrdinalOrBasisOffsetX'],[59,'var11Lifetime1','transformedTranslationY'],[60,'var11Lifetime2','groupIdOrBasisOffsetY'],[61,'var12Lifetime1','transformedTranslationZ'],[62,'var12Lifetime2','basisOffsetZ'],[64,'var14Lifetime1','translationVertexIndex'],[68,'var10Lifetime1Lifetime1','translationGroupOrdinal'],[69,'var11Lifetime1Lifetime1','translationGroupId']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical identity and frame decoding/loading, slot interpolation, pivot/group traversal, trigonometric rotation or matrix data flow. Phase-shared values retain qualified names.');
for(const [original,to] of [['d','x'],['e','y'],['b','z'],['g','contributions']])field('wi',original,'I',to,'Smooth-face normal accumulation adds the normalized vector and increments contributions once for every referenced vertex occurrence.');
for(const [original,to] of [['b','x'],['a','y'],['e','z']])field('kg',original,'I',to,'Flat-face normal stores the cross product normalized to scale 256.');
constructorParameters('js','([B)V',['encodedMesh'],'Detects the extended-format footer marker, otherwise decodes the legacy format.');
constructorParameters('js','(Ljs;ZZZZ)V',['source','shareVertices','shareFaceColors','shareTextureIds','shareFaceAlpha'],'Shares selected data arrays or copies them; unshared missing alpha becomes a zero-filled array. Indices, skin groups and normals retain their existing sharing.');
field('js','B','[S','faceTextureIds','Optional face texture IDs read by decoding and the copy constructor.');
field('js','h','[B','faceAlpha','Optional per-face alpha bytes; unshared null alpha is materialized as zeros.');
method('js','b','([B)V','decodeLegacyFormat','Decodes the eighteen-byte footer format, signed-smart vertex/index deltas and optional attributes.',{0:'encodedMesh'});
method('js','a','([B)V','decodeExtendedFormat','Decodes the format selected by the two trailing -1 bytes, retaining its extended texture/attribute fields.',{0:'encodedMesh'});
method('js','b','()V','calculateNormals','Lazily computes smooth vertex normals and flat face normals; scales large cross products down and clamps a zero magnitude divisor to one.');
method('js','a','()V','buildSkinGroups','Groups vertex/face indices by their byte-range skin IDs, then releases the original ID arrays.');
method('js','a','(IIIII)Lkk;','createModel','Constructs the lit ModelMesh from this geometry and lighting parameters.',{0:'ambient',1:'contrast',2:'lightX',3:'lightY',4:'lightZ'});
method('js','a','(Lkl;Ljava/lang/String;Ljava/lang/String;)Ljs;','load','Loads the named archive file and decodes its mesh data; missing bytes return null.',{0:'archive',1:'groupName',2:'fileName'});
for(const [owner,signature,items] of [
 ['wq','a(ILwq;)V',[[0,'var3_int','newW'],[1,'var4','newX'],[2,'var5','newY']]],
 ['wq','a(I)V',[[0,'var2','squaredMagnitude']]],
 ['v','f(I)V',[[4,'var4','tileX'],[5,'var5','tileY'],[7,'var3','worldYOffset'],[8,'var11','diagonalY'],[9,'var10','diagonalX']]],
 ['pg','a(IIZI)Lqb;',[[0,'var7','variantOrdinal'],[1,'var8','variant'],[3,'var13','variants'],[4,'var11','variantsAlias'],[5,'var10','variantChoices'],[6,'var4','slotVariants'],[7,'var5','selectedVariant'],[8,'var14','fallbackChoices']]],
 ['js','b()V',[[1,'var1','vertexIndex'],[2,'var2','vertexA'],[3,'var3','vertexB'],[4,'var4','vertexC'],[5,'var5','edgeABX'],[6,'var6','edgeABY'],[7,'var7','edgeABZ'],[8,'var8','edgeACX'],[9,'var9','edgeACY'],[10,'var10','edgeACZ'],[11,'var11','normalX'],[12,'var12','normalY'],[13,'var13','normalZ'],[14,'var14','normalMagnitude'],[15,'var15','renderType'],[16,'var16','faceNormal'],[17,'var17','normalA'],[18,'var18','normalB'],[19,'var19','normalC'],[20,'var1Lifetime1','faceIndex']]],
 ['js','a()V',[[6,'var2','maximumVertexSkin'],[7,'var3','vertexIndex'],[8,'var4','vertexSkinId'],[9,'var5','vertexCountsBySkin'],[10,'var6','faceCountsBySkin'],[11,'var4Lifetime1','faceSkinId'],[12,'var4Lifetime2','groupedVertexSkinId'],[13,'var4Lifetime1Lifetime1','groupedFaceSkinId'],[14,'var2Lifetime1','maximumFaceSkin'],[15,'var3Lifetime1','faceIndex']]],
])for(const [ordinal,originalName,to] of items)local(owner,signature,ordinal,originalName,to,'Reviewed lexical declaration ordinal and projection, fixed-point quaternion arithmetic, animation variants or face-normal/skin grouping data flow.');

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

// Widget identities are reviewed in this game's own input, including overrides.
for(const [original,type,to] of [['B','I','x'],['p','I','y'],['l','I','width'],['w','I','height'],['k','Lkh;','painter']])
  field('kb',original,type,to,'Widget constructor and setBounds assign x/y/width/height; drawing dispatch invokes the retained painter with parent offsets.');
method('kb','<init>','(IIIILkh;Lqo;)V','<init>','Constructor stores widget bounds, painter and listener.',{0:'x',1:'y',2:'width',3:'height',4:'painter',5:'listener'});
method('kb','a','(IIIII)V','setBounds','Assigns x, width, y and height in the original argument order; guard 8192 is canonical. DropdownSelector overrides this for its collapsed height.',{0:'x',1:'width',2:'y',3:'obfuscationGuard',4:'height'});
method('kb','b','(IIIII)Z','containsPointer','Tests pointer coordinates against origin-offset widget bounds. Base bounds are half-open; the option-list override retains its inclusive edges.',{0:'obfuscationGuard',1:'originX',2:'pointerY',3:'pointerX',4:'originY'});
method('kh','a','(Lkb;IIZI)V','paintWidget','Painter contract and Widget dispatch establish the widget and parent-origin offsets; rendering flag meaning remains qualified.',{0:'widget',1:'originX',2:'obfuscationGuard',3:'renderFlag',4:'originY'});
for(const [original,type,to] of [['I','Ljava/lang/String;','typedPrefix'],['H','Z','expanded'],['J','I','collapsedHeight'],['G','I','maximumDropdownHeight'],['O','Lpp;','optionList'],['E','Lfw;','textButton'],['N','Lfw;','arrowButton'],['Q','Lai;','dropdownViewport'],['K','Lka;','font']])
  field('gh',original,type,to,'Dropdown construction, keyboard prefix lookup, bounds updates and open/close viewport paths establish this role.');
for(const [original,signature,to,evidence,parameters] of [
 ['l','(I)Z','isExpanded','Returns expanded state; guard 11180 is canonical.',{0:'obfuscationGuard'}],
 ['m','(I)V','openDropdown','Clamps option-list height, creates/attaches the viewport and scrolls selection into view.',{0:'obfuscationGuard'}],
 ['k','(I)V','closeDropdown','Restores collapsed bounds, clears expanded state and unlinks the viewport.',{0:'obfuscationGuard'}],
 ['n','(I)V','ensureSelectionVisible','Adjusts fixed-point scroll position to keep the selected option within the viewport.',{0:'obfuscationGuard'}],
 ['a','(B)I','getSelectedIndex','Returns the option-list selected index; other guards return -94.',{0:'obfuscationGuard'}],
 ['a','(ILjava/lang/String;)I','findOptionPrefix','Finds the first case-insensitive option string prefix, starting at the requested index.',{0:'startIndex',1:'prefix'}],
])method('gh',original,signature,to,evidence,parameters);
method('gh','<init>','([Ljava/lang/Object;II)V','<init>','Constructs the option list with initial selection and stores the dropdown height cap.',{0:'options',1:'selectedIndex',2:'maximumDropdownHeight'});
for(const [original,type,to] of [['W','[Ljava/lang/Object;','options'],['T','I','selectedIndex'],['O','I','hoveredIndex'],['Z','I','rowHeight'],['V','Lgh;','selector'],['U','Lka;','font']])
  field('pp',original,type,to,'Option-list initialization, rendering and pointer selection establish array/index/row and owner/font roles.');
method('pp','a','(II[Ljava/lang/Object;)V','setOptions','Stores options/selection, resets hover and rejects an out-of-range non-null selection.',{0:'selectedIndex',1:'obfuscationGuard',2:'options'});
method('pp','j','(I)Ljava/lang/Object;','getSelectedOption','Returns selected object or null for null options/no selection; noncanonical guard reads the first option.',{0:'obfuscationGuard'});
method('pp','<init>','(Lgh;Lka;[Ljava/lang/Object;I)V','<init>','Stores selector/font, derives row height from font metrics and initializes options.',{0:'selector',1:'font',2:'options',3:'selectedIndex'});

// Common-client packet reception is separate from resource-protocol requests.
for(const [owner,original,type,to,evidence] of [
 ['mg','e','Lbv;','incomingPacket','Opcode decoding, variable length headers and payload reception reuse this cipher packet buffer.'],
 ['mg','f','I','pendingOpcode','Negative means no opcode is pending; framing retains the opcode across partial payload reads.'],
 ['fk','b','I','packetPayloadLength','Opcode lookup yields a fixed length or -1/-2 for byte/short length prefixes; payload completion uses the decoded value.'],
 ['vj','b','Lat;','delayedPackets','Artificial-latency polling enqueues opcode/payload records and releases the oldest due record first.'],
 ['dq','c','I','packetDelayMillis','Nonzero enables delayed delivery and contributes the base offset to a packet release timestamp.'],
 ['sp','e','D','packetJitterMillis','Scales nextGaussian before integer truncation and the existing zero clamp; non-finite values retain Java casts.'],
 ['iq','h','J','lastPacketReadMillis','Successful receive updates this monotonic timestamp; TileMetadata reports elapsed inactivity.'],
 ['iq','e','Ljava/util/Random;','connectionRandom','Provides login seed integers and Gaussian packet-delay jitter.'],
 ['am','z','Lhi;','sessionSocket','Common-client login and game/lobby packet reception share this socket; resource transport uses separate clients.'],
 ['ov','g','Lsa;','connectionState','Login stages update this identity tag; incoming packet polling requires connectedState.'],
 ['kl','k','Lsa;','connectedState','Assigned after login response/user metadata are decoded, and required by the live-socket predicate and packet poller.'],
 ['nm','o','I','deliveredOpcode','Caller dispatches this opcode only after a complete or due delayed packet is delivered.'],
 ['sj','e','I','previousOpcode','Delivery shifts the previously delivered opcode into this first history position.'],
 ['ba','F','I','secondPreviousOpcode','Second history position after packet delivery rotates the opcode history.'],
 ['me','c','I','thirdPreviousOpcode','Oldest of three prior-opcode history positions.'],
 ['sh','a','[I','opcodePayloadLengths','Client initializes fixed and -1/-2 variable packet lengths here and passes the table to the poller.'],
 ['qu','l','J','releaseAtMillis','Polling delivers only when monotonic now is strictly greater than this timestamp.'],
 ['qu','o','I','opcode','Delivered into deliveredOpcode after the queued payload is copied.'],
 ['qu','m','[B','payload','Constructor retains the array; enqueue copies incoming bytes, and delivery copies them into the shared buffer.'],
])field(owner,original,type,to,evidence);
constructorParameters('qu','(JI[B)V',['releaseAtMillis','opcode','payload'],'Constructor retains the supplied time, opcode and byte array without copying.');
method('gs','a','(B[I)Z','pollIncomingPacket','Checks the connection, releases an eligible delayed record or frames incoming opcodes/payloads; delayed enqueue retries until no further complete packet is ready.',{0:'obfuscationGuard',1:'opcodePayloadLengths'});
method('es','a','(II)Z','receivePacketBytes','Receives only the still-needed bytes, keeps partial cursor state and resets the cursor on newly completed reads; existing cursor >= required length returns directly.',{0:'obfuscationGuard',1:'requiredLength'});
method('jh','g','(I)Z','isPacketPayloadReady','Decodes -1/-2 byte/short length headers once, then requests the payload length.',{0:'obfuscationGuard'});
method('vi','b','(I)J','monotonicMillis','Returns wall-clock milliseconds plus the accumulated backward-clock adjustment, under the original synchronized guard behavior.',{0:'obfuscationGuard'});

// Camera overview grouping and movement, traced through both controller users.
for(const [original,type,to] of [['m','I','tileXSum'],['p','I','tileYSum'],['l','I','sampleCount'],['n','I','holdTicks'],['k','Z','holdStarted']])
 field('ja',original,type,to,'Constructors retain one tile sample; grouping accumulates integer sums, averages truncate, settling starts a forty-call hold.');
constructorParameters('ja','(Ljd;)V',['unit'],'Copies the unit tile coordinates into one sample without retaining the unit.');
constructorParameters('ja','(II)V',['tileX','tileY'],'Initializes a one-sample camera target.');
method('ja','b','(IIB)V','addTile','Always increments sample count and Y sum; canonical guard >85 also increments X sum.',{0:'tileX',1:'tileY',2:'obfuscationGuard'});
method('ja','f','(I)V','startHold','Marks the hold as started after the original guard arithmetic; repeated calls do not reset holdTicks.',{0:'obfuscationGuard'});
method('ja','a','(I)Z','advanceHold','Post-increments holdTicks and returns whether its previous value was below forty; noncanonical guard follows the original failure path.',{0:'obfuscationGuard'});
method('ja','a','(B)Z','hasStartedHold','Reads the hold-started flag; guard <=123 retains the original Y-only extra sample.',{0:'obfuscationGuard'});
method('ja','a','(ILja;)Z','isNearTarget','Tests averaged-coordinate squared deltas: one below four and the other below twenty-five; Java integer overflow is retained.',{0:'obfuscationGuard',1:'other'});
method('ja','a','(Ljd;I)Z','containsUnit','Checks the unit coordinates against the inclusive two-tile centroid bounds.',{0:'unit',1:'obfuscationGuard'});
method('ja','a','(BLjd;)V','addUnit','Adds current unit coordinates only for guard <=-59.',{0:'obfuscationGuard',1:'unit'});
method('ja','a','(IIB)Z','containsTile','Checks inclusive centroid +/-2 bounds on each axis, with the original bad-guard side effect.',{0:'tileX',1:'tileY',2:'obfuscationGuard'});
method('ja','b','(ILja;)I','distanceSquaredTo','Returns squared centroid distance for guard two; retains integer wrapping and the -59 alternate return.',{0:'obfuscationGuard',1:'other'});
method('ja','a','(IB)I','getTileIndex','Flattens the truncated centroid using mapWidth; noncanonical guard returns -50 after averaging.',{0:'mapWidth',1:'obfuscationGuard'});
field('ic','cb','Lat;','overviewTargets','Built from controlled units, flagged other-player units and portal/modifier landmarks, then visited by the camera.');
field('ic','Qb','Z','cameraFocusPending','Explicit tile focus suppresses regular input until moveTowardTile settles.');
field('ic','Z','I','cameraFocusTileIndex','Flattened focus tile set from unit selection or explicit focusCameraOnTile.');
method('ic','j','(I)V','rebuildOverviewTargets','Clusters controlled units, other-player movement-flag-1 units and portal/modifier-flag landmarks by centroid proximity.',{0:'obfuscationGuard'});
method('ic','d','(B)V','updateCamera','Prioritizes explicit focus, manual input and overview targets; removes nearby overview targets and promotes the nearest remaining one.',{0:'obfuscationGuard'});
method('ic','c','(III)V','focusCameraOnTile','Stores the flattened tile, marks pending focus and clears the two other camera-follow flags.',{0:'obfuscationGuard',1:'tileX',2:'tileY'});
for(const [original,type,to] of [['a','[I','previousPointer'],['n','[I','viewportOriginGrid'],['r','[I','viewportCenterGrid'],['g','I','focusWorldX'],['i','I','focusWorldY'],['q','Z','eventFocusActive'],['o','[I','overlayValues']])
 field('v',original,type,to,'Camera drag, viewport-grid refresh, retained event/tile focus and generated overlay values; no unverified fog/weather interpretation.');
method('v','b','(BI)Z','advanceTowardTarget','Clamps the target, adjusts per-axis velocity, advances/clamps position and returns whether both velocities are zero.',{0:'obfuscationGuard',1:'maximumSpeed'});
method('v','a','(IIIII)I','adjustAxisVelocity','Preserves signed velocity, stopping-distance braking, reversal damping, acceleration and maximum-speed gates.',{0:'velocity',1:'obfuscationGuard',2:'distance',3:'acceleration',4:'maximumSpeed'});
method('v','a','(BII)Z','shouldBrake','Sums successively truncated seven-eighths speeds and compares the resulting stopping distance.',{0:'obfuscationGuard',1:'speed',2:'distance'});
method('v','a','(ZZII)Z','dragCamera','Records pointer coordinates; an active nonnegative drag subtracts the pointer delta from currentPosition.',{0:'obfuscationGuard',1:'dragging',2:'pointerX',3:'pointerY'});
method('v','a','(ZZZZZZ)Z','panCamera','Updates directional velocity using the original sixteen-unit gates; suspendInertia keeps position unchanged when no direction is requested.',{0:'enabled',1:'panDown',2:'suspendInertia',3:'panRight',4:'panLeft',5:'panUp'});
method('v','a','(IZIZZZZZI)Z','handleInput','Runs pointer drag first, otherwise directional panning, and reports requested manual movement.',{0:'obfuscationGuard',1:'panDown',2:'pointerY',3:'panUp',4:'panRight',5:'panLeft',6:'suspendInertia',7:'dragging',8:'pointerX'});
method('v','a','(I[I)V','clampWorldPosition','Applies the original map-width-based diamond and inset clamps, including rectangular-map behavior.',{0:'obfuscationGuard',1:'worldPosition'});
method('v','a','(IIB)V','setWorldPosition','Stores world coordinates, clamps them and refreshes viewport grid coordinates.',{0:'worldX',1:'worldY',2:'obfuscationGuard'});
method('v','j','(I)V','refreshViewportGrid','Refreshes both viewport grid coordinates only for guard <=-117.',{0:'obfuscationGuard'});
method('v','c','(B)V','storeGridFocus','Projects the current grid point into retained focusWorldX/Y and refreshes viewport coordinates.',{0:'obfuscationGuard'});
method('v','h','(I)V','updateViewportOriginGrid','Projects screen origin back to the grid and stores it.',{0:'obfuscationGuard'});
method('v','a','(Z)V','updateViewportCenterGrid','Projects the screen centre back to the grid and stores it.',{0:'obfuscationGuard'});
method('v','a','(IZ)V','snapToTile','Decodes a tile index and snaps current/focus position to its projection; retains the original boolean guard effects.',{0:'tileIndex',1:'obfuscationGuard'});
method('v','a','(IBI)Z','moveTowardTile','Projects a tile and reports zero velocity after advancing. Maximum speed one can stop before the target; completion does not prove arrival.',{0:'maximumSpeed',1:'obfuscationGuard',2:'tileIndex'});
method('v','a','(BLat;)V','followEventPresenters','Retains the first reverse-traversed presenter with a tile, activates focus when distant and advances toward its screen-derived world position.',{0:'obfuscationGuard',1:'presenters'});
method('v','a','(BI)V','setFocusTile','Stores a projected tile as the retained focus point, preserving guard arithmetic.',{0:'obfuscationGuard',1:'tileIndex'});
method('v','b','(Z)V','snapToGrid','Projects the current grid position, copies it into current/focus position and refreshes viewport coordinates.',{0:'obfuscationGuard'});
method('v','a','(III)V','initialize','Initializes arrays before assigning dimensions, generates overlay values and refreshes the original initial position.',{0:'mapHeight',1:'mapWidth',2:'obfuscationGuard'});
method('v','b','(I)V','generateOverlayValues','Stores 256 minus each unsigned generated byte; overlay drawing reads these retained values.',{0:'obfuscationGuard'});

// Intrusive collection operations used by unit, event and camera queues.
method('at','a','(I)Ltc;','popFirst','Unlinks the first primary node or returns null for an empty deque; retains the integer guard side effect.',{0:'obfuscationGuard'});
method('at','c','(B)Ltc;','popLast','Unlinks the last primary node; guard >-120 also executes the existing empty query.',{0:'obfuscationGuard'});
method('at','d','(B)Ltc;','last','Returns the last primary node and primes reverse traversal; retains byte guard side effects.',{0:'obfuscationGuard'});
method('at','b','(B)Ltc;','previous','Returns the cached reverse cursor and advances it; exhaustion returns null once and retains guard arithmetic.',{0:'obfuscationGuard'});
method('at','b','(I)V','clear','Unlinks every primary node and clears the owned cursor before the original bad-guard null insertion failure.',{0:'obfuscationGuard'});
method('at','a','(Z)Z','isEmpty','Tests the sentinel next link; true also clears the owned traversal cursor.',{0:'obfuscationGuard'});
method('at','b','(Z)I','size','Counts primary nodes for guard false; true detaches the first nonempty node and fails in unlink guard arithmetic, preserving stale node links.',{0:'obfuscationGuard'});
method('at','a','(ZLat;)V','moveAllTo','Appends the complete primary chain to destination without copying nodes or resetting cursors; false subsequently follows the original clear/failure path.',{0:'obfuscationGuard',1:'destination'});
method('at','a','(Ltc;Lat;I)V','moveSuffixTo','Splices firstNode through the source tail onto destination; keeps earlier source nodes and does not validate node ownership.',{0:'firstNode',1:'destination',2:'obfuscationGuard'});
method('at','a','(ZLtc;)Ltc;','startForwardAt','Returns the supplied node or the first node when null, and caches its successor without checking ownership.',{0:'obfuscationGuard',1:'node'});
method('bb','a','(Ltc;Z)Ltc;','startForwardAt','For guard true, returns the supplied node or deque head and caches its next link; false leaves the cursor unchanged.',{0:'node',1:'obfuscationGuard'});
method('bb','a','(ZLtc;)Ltc;','startReverseAt','For guard false, returns the supplied node or deque tail and caches its previous link; true leaves the cursor unchanged.',{0:'obfuscationGuard',1:'node'});
field('wg','f','Lms;','sentinel','Constructor self-links the independent secondary chain.');
method('wg','a','(Z)Lms;','popFirst','Guard false unlinks and returns the first secondary node; true returns null without unlinking.',{0:'obfuscationGuard'});
method('wg','a','(ILms;)V','addLast','Unlinks previous secondary membership and appends this same node before the sentinel.',{0:'obfuscationGuard',1:'node'});
field('sp','a','Lms;','lastReturned','next stores the returned node here; remove unlinks it once and clears this field.');
field('sp','f','Lms;','cursor','Independent iterator cursor follows secondaryNext; first exhaustion changes it to null.');
field('sp','c','Lwg;','deque','Iterator retains the owning iterable deque and compares against its sentinel.');
constructorParameters('sp','(Lwg;)V',['deque'],'Retains the deque and starts at its first secondary node.');
field('sm','d','I','pointerX','The synchronized input snapshot copies the current mouse X coordinate here; common-client UI hit helpers consume it.');
field('ko','b','I','pointerY','The synchronized input snapshot copies the current mouse Y coordinate here; common-client UI hit helpers consume it.');
method('wg','a','(IIIII)Z','isPointerInBounds','Tests pointerX and pointerY against inclusive minimum/maximum bounds without normalizing reversed ranges.',{0:'obfuscationGuard',1:'minimumX',2:'maximumX',3:'minimumY',4:'maximumY'});

// Hash-backed retained values, weighted capacity and secondary LRU order.
for(const [original,type,to] of [['f','I','capacity'],['a','I','remainingCapacity'],['e','Lwg;','lruEntries'],['g','Lm;','entries']])
 field('ri',original,type,to,'Constructor capacity, insertion reservation/refunds, primary key lookup and secondary least-recently-used ordering.');
field('uq','z','I','weight','CacheEntry constructor stores the supplied weight; cache removal refunds it.');
field('f','B','Ljava/lang/Object;','value','StrongCacheEntry retains this object directly without copying.');
for(const owner of ['uq','f']){
 method(owner,'b','(Z)Ljava/lang/Object;','getValue','Returns the retained value for the canonical false guard; StrongCacheEntry returns null for true.',{0:'obfuscationGuard'});
 method(owner,'a','(Z)Z','isReferenceBacked','True selects replacement by a strong entry on cache hit; the exported StrongCacheEntry implementation always returns false.',{0:'obfuscationGuard'});
}
constructorParameters('uq','(I)V',['weight'],'Stores the entry weight with inherited primary/secondary links.');
constructorParameters('f','(Ljava/lang/Object;I)V',['value','weight'],'Retains the value directly and passes weight to CacheEntry.');
constructorParameters('ri','(I)V',['capacity'],'Uses the same value for capacity and maximum bucket sizing.');
constructorParameters('ri','(II)V',['capacity','bucketGrowthLimit'],'Doubles bucket count while twice the count is below capacity and the current count is below the supplied growth threshold; the final count can exceed that threshold.');
method('ri','a','(JB)Ljava/lang/Object;','get','Refreshes LRU order and clears secondaryKey; empty values remove/refund the entry and reference-backed values become strong entries.',{0:'key',1:'obfuscationGuard'});
method('ri','a','(Luq;I)V','removeEntry','Unlinks both memberships and refunds the supplied entry weight without checking cache ownership.',{0:'entry',1:'obfuscationGuard'});
method('ri','a','(Ljava/lang/Object;BIJ)V','putWeighted','Replaces the key, reserves weight, evicts oldest entries until the budget fits and installs a strong entry; zero/negative weights and partial guard failures remain.',{0:'value',1:'obfuscationGuard',2:'weight',3:'key'});
method('ri','a','(JI)V','remove','Removes/refunds the first matching key only when guard <=-64.',{0:'key',1:'obfuscationGuard'});
method('ri','a','(Ljava/lang/Object;IJ)V','put','Inserts a weight-one entry; noncanonical guard also refreshes key 64 if present.',{0:'value',1:'obfuscationGuard',2:'key'});
for(const [original,type,to] of [['c','[Ltc;','buckets'],['d','I','bucketCount'],['e','Ltc;','lookupNext']])
 field('m',original,type,to,'Masked key lookup and sentinel bucket insertion; lookup retains the successor of the found node.');
method('m','a','(Ltc;ZJ)V','put','Moves the same node into the masked primary bucket and sets its key; duplicate keys retain insertion order.',{0:'node',1:'obfuscationGuard',2:'key'});
method('m','a','(IJ)Ltc;','get','Returns the first key match in its masked bucket and stores the following lookup node.',{0:'obfuscationGuard',1:'key'});
constructorParameters('m','(I)V',['bucketCount'],'Allocates self-linked sentinel buckets without validating positive or power-of-two counts.');
for(const [original,type,to] of [['d','Ltc;','cursor'],['b','I','nextBucket'],['c','Ltc;','lastReturned'],['g','Lm;','table']])
 field('tl',original,type,to,'Iterator reset, bucket scanning, hasNext cursor advancement and removable last-returned primary node.');
constructorParameters('tl','(Lm;)V',['table'],'Retains the table and initializes traversal from bucket zero.');
method('tl','c','(B)V','reset','Clears removal state and starts at bucket-zero first node with nextBucket one.',{0:'obfuscationGuard'});

// Quick-chat definitions and archive/cache routing, traced through QC setup.
for(const [owner,original,type,to] of [
 ['bl','e','Lri;','categories'],['bl','d','Lkl;','localArchive'],['bl','c','Lkl;','globalArchive'],
 ['rf','b','Lri;','phrases'],['rf','f','Lkl;','localArchive'],['rf','c','Lkl;','globalArchive'],
 ['va','E','Ljava/lang/String;','title'],['va','C','[I','subcategoryIds'],['va','x','[C','subcategoryShortcuts'],
 ['va','y','[I','phraseIds'],['va','v','[C','phraseShortcuts'],['va','H','Z','isRootCategory'],
 ['ar','z','[Ljava/lang/String;','textFragments'],['ar','A','[I','linkedPhraseIds'],['ar','B','[I','commandIds'],['ar','u','[[I','commandArguments'],
 ['me','b','I','commandId'],['me','f','I','definitionArgumentCount'],['mp','Sb','Lbl;','quickChatCategories'],['ce','K','Lrf;','quickChatPhrases'],
])field(owner,original,type,to,'Quick-chat archive decoding, menu construction and definition-command lookup; linked phrase list finer response semantics remain unresolved.');
constructorParameters('bl','(ILkl;Lkl;)V',['unusedParameter','localArchive','globalArchive'],'Retains both archives, creates a 64-entry cache and queries group-zero file capacities.');
constructorParameters('rf','(ILkl;Lkl;Lgj;)V',['unusedParameter','localArchive','globalArchive','unusedMarker'],'Retains both archives, creates a 64-entry cache and queries group-one file capacities; the other arguments are unused.');
constructorParameters('me','(IIII)V',['commandId','unusedParameter1','unusedParameter2','definitionArgumentCount'],'Only the command ID and definition argument count are retained.');
method('bl','a','(IZ)Lva;','getCategory','Loads local IDs from group zero; IDs >=32768 select the global archive with file ID masked to 15 bits. Missing bytes still yield cached default definitions.',{0:'categoryId',1:'obfuscationGuard'});
method('rf','a','(II)Lar;','getPhrase','Loads local/global group-one definitions, applies the global bit to linked IDs and caches defaults for missing bytes. Guard arithmetic precedes cache lookup.',{0:'phraseId',1:'obfuscationGuard'});
method('va','a','(BLvh;)V','decode','Reads category opcodes through zero; unrecognized opcodes consume only their opcode byte.',{0:'obfuscationGuard',1:'packet'});
method('va','a','(BLvh;I)V','decodeOpcode','Reads title, parallel ID/shortcut arrays or the root flag; zero shortcuts remain zero and other bytes use the existing character decoder.',{0:'obfuscationGuard',1:'packet',2:'opcode'});
method('va','g','(I)V','applyGlobalIds','ORs bit 32768 into subcategory and phrase IDs before the original bad-guard failure.',{0:'obfuscationGuard'});
method('ar','a','(Lvh;B)V','decode','Reads phrase opcodes through zero, retaining guard and unknown-command cursor behavior.',{0:'packet',1:'obfuscationGuard'});
method('ar','a','(BILvh;)V','decodeOpcode','Splits text on <, reads linked phrase IDs and command IDs/argument rows; unknown command IDs leave default rows and consume no arguments.',{0:'obfuscationGuard',1:'opcode',2:'packet'});
method('ar','a','(Z)V','applyGlobalIds','ORs bit 32768 into linked phrase IDs before the original false-guard failure.',{0:'obfuscationGuard'});
method('ar','d','(B)Ljava/lang/String;','getPreviewText','Joins text fragments with literal ellipses; an undecoded phrase yields the empty string.',{0:'obfuscationGuard'});
method('fi','b','(II)Lme;','getQuickChatCommand','Scans the original fourteen-entry command registry from startIndex and returns its matching ID.',{0:'startIndex',1:'commandId'});
method('uj','c','(B)[Lme;','getQuickChatCommands','Returns the original command-definition registry in its retained order.',{0:'obfuscationGuard'});
method('ps','b','(B)Lva;','findQuickChatRootCategory','Scans category IDs upward until the root flag is present; retains its unbounded scan and IllegalArgumentException handling.',{0:'obfuscationGuard'});
method('lo','a','(Lva;I)V','addCustomQuickChatOption','Replaces root phrase choices with ID -1 and shortcut ? without changing subcategories.',{0:'category',1:'obfuscationGuard'});
method('l','a','(Lva;Lje;ILje;Lje;)Lmq;','buildQuickChatCategoryMenu','Builds subcategory menus recursively and phrase preview choices from decoded categories.',{0:'category',2:'obfuscationGuard'});
method('vh','g','(I)Ljava/lang/String;','readNullTerminatedString','Reads through a zero byte and decodes the preceding text; retains cursor increments on truncated input.',{0:'obfuscationGuard'});
method('we','a','(IB)C','decodeSingleByteCharacter','Rejects byte zero, maps extension bytes through the existing table and replaces unmapped characters with ?.',{0:'obfuscationGuard',1:'encodedByte'});

// Client component composition and the quick-chat menu consuming definitions.
for(const [original,type,to] of [['S','I','x'],['ab','I','y'],['gb','I','width'],['ob','I','height'],['V','I','screenX'],['D','I','screenY'],['J','I','pendingXDelta'],['db','I','pendingYDelta'],['Hb','I','pendingWidthDelta'],['nb','I','pendingHeightDelta'],['fb','Lat;','children'],['X','Ljava/lang/String;','text'],['Z','Lka;','font'],['cb','Lwk;','sprite'],['yb','I','pressedButton'],['hb','I','heldPressButton'],['jb','Z','hovered'],['eb','Z','heldButtonMatches'],['rb','Z','selected'],['Eb','I','horizontalAlignment'],['Fb','I','verticalAlignment'],['Cb','Z','inheritParentVisualState'],['xb','Z','inputEnabled'],['C','I','textOpacity'],['Gb','Z','draggable']])
 field('je',original,type,to,'Component construction, layout/measurement, sparse style overlay, clipped input and font/sprite rendering. heldButtonMatches preserves the zero-button equality case.');
method('je','a','(ILje;)V','applyStyle','Overlays supported nondefault style values; retains sparse zero/false/sentinel handling and shared font/sprite references.',{0:'obfuscationGuard',1:'style'});
method('je','a','(Lje;I)V','addChild','Appends the same child through its primary intrusive links, moving prior membership if needed.',{0:'child',1:'obfuscationGuard'});
method('je','a','(IIIII)V','setBounds','Stores local bounds and resets pending deltas for the canonical guard.',{0:'height',1:'obfuscationGuard',2:'width',3:'y',4:'x'});
method('je','a','(ZI)I','measureContentWidth','Returns the maximum of bounded text width, sprite canvas width and child x+width; retains the false-guard Y change.',{0:'obfuscationGuard',1:'maximumTextWidth'});
method('je','j','(I)I','getPreferredWidth','Measures content with an effectively unbounded text width, preserving guard arithmetic.',{0:'obfuscationGuard'});
method('je','i','(I)V','inheritVisualStateForDescendants','Recursively marks descendants to use inherited selected/held visual state; each component still intersects raster clipping with its own bounds.',{0:'obfuscationGuard'});
method('je','a','(ZZ)V','updateInput','Updates component/child geometry and clipped pointer state; enableCapture resets the shared event-consumption flags before traversal.',{0:'inputAllowed',1:'enableCapture'});
constructorParameters('je','(JLje;)V',['key','style'],'Initializes default component state, overlays style and stores the intrusive key.');
constructorParameters('je','(JLje;Ljava/lang/String;)V',['key','style','text'],'Initializes from a style and replaces text only when supplied.');
constructorParameters('je','(JLje;IIIILjava/lang/String;)V',['key','style','x','y','width','height','text'],'Stores local bounds/key, overlays style and then optionally replaces text.');
for(const [original,type,to] of [
 ['kb','I','spriteOpacity'],
 ['Db','Z','selectWhenFocused'],['Y','Z','focused'],['I','Ljava/lang/String;','blinkTextSuffix'],
 ['N','I','textColour'],['L','I','disabledTextColour'],['W','I','matchedButtonTextColour'],['T','I','heldPressTextColour'],['wb','I','selectedTextColour'],
 ['G','[Lwk;','skinSprites'],['A','[Lwk;','disabledSkinSprites'],['mb','[Lwk;','matchedButtonSkinSprites'],['U','[Lwk;','heldPressSkinSprites'],['H','[Lwk;','selectedSkinSprites'],
 ['sb','Lwk;','disabledSprite'],['vb','Lwk;','matchedButtonSprite'],['qb','Lwk;','heldPressSprite'],['P','Lwk;','selectedSprite'],
 ['F','I','contentOffsetX'],['z','I','contentOffsetY'],['ib','I','matchedButtonOffsetX'],['E','I','matchedButtonOffsetY'],['Bb','I','heldPressOffsetX'],['R','I','heldPressOffsetY'],['B','I','selectedOffsetX'],['tb','I','selectedOffsetY'],
 ['O','I','textHorizontalPadding'],['pb','I','textLineSpacing'],['ub','Z','drawSkinInParentBounds'],['bb','I','dragGrabX'],['Ab','I','dragGrabY'],
])field('je',original,type,to,'Component rendering chooses disabled, matching-button, held-press and selected alternatives in that order; offsets propagate to child origins, focus selects opted-in components, and drag grabs retain press-relative coordinates. Visual-state inheritance does not bypass clipping.');
method('je','b','(ZI)V','draw','Draws the component tree in the current raster with optional blinking text suffix.',{0:'blinkOn',1:'obfuscationGuard'});
method('je','a','(BIZIIZZZIZZ)V','drawTree','Intersects each component clip, chooses state-dependent skins/sprites/text/offsets and renders children with inherited visual state.',{0:'obfuscationGuard',1:'parentHeight',2:'blinkOn',3:'parentWidth',4:'parentY',5:'inheritedHeldPress',6:'inheritedFocus',7:'inheritedSelection',8:'parentX',9:'inputAllowed',10:'inheritedButtonMatch'});
method('je','a','(ZZIIII)V','updateInputTree','Eases pending geometry by signed ceiling-quarter steps, traverses clipped input in reverse child order and clamps draggable components to parent bounds.',{0:'inputAllowed',1:'capturePress',2:'parentY',3:'parentHeight',4:'parentWidth',5:'parentX'});
method('je','b','(ILje;)V','setFocusedComponent','Traverses all descendants, assigns focus by object identity and mirrors it to selection for opted-in components.',{0:'obfuscationGuard',1:'focusedComponent'});
method('je','a','(ZIII)V','layoutVerticalContent','Optionally stacks children using pending heights and spacing, then clamps current and pending scroll offsets to the viewport.',{0:'preserveChildLayout',1:'viewportHeight',2:'childSpacing',3:'obfuscationGuard'});
method('je','a','(Lje;ZILje;)V','positionAfter','Positions a supplied child below a preceding sibling, including pending sibling geometry; no sibling resets Y and its pending delta.',{0:'child',1:'obfuscationGuard',2:'spacing',3:'previousSibling'});

for(const [original,to] of [['Ib','upButton'],['Qb','downButton'],['Lb','track'],['Vb','pageUpArea'],['Pb','pageDownArea'],['Ub','thumb']])field('ll',original,'Lje;',to,'Scrollbar constructor builds linked buttons, track halves and a draggable thumb; layout and repeat helpers consume these exact components.');
field('ll','Ob','I','repeatTicks','One counter shared by arrow/page helpers; initial press sets 20, successful repeats reset to 3 and released holds do not decrement it.');
constructorParameters('ll','(JLje;Lje;Lje;Lje;)V',['key','upStyle','downStyle','trackStyle','thumbStyle'],'Builds six real components; the two track halves draw their skins against parent bounds and the thumb is draggable.');
constructorParameters('ll','(JLll;)V',['key','style'],'Copies styles from the source scrollbar controls, not its geometry or repeat counter.');
method('ll','a','(IIIIIIII)V','setLayout','Sets scrollbar bounds then computes button, track and thumb geometry.',{0:'obfuscationGuard',1:'width',2:'height',3:'y',4:'contentHeight',5:'viewportHeight',6:'x',7:'scrollOffset'});
method('ll','a','(IIII)V','layoutThumb','Sizes the thumb proportionally with a width-sized minimum bounded by track length, and positions it using rounded integer scroll ratios.',{0:'pageDownX',1:'contentHeight',2:'viewportHeight',3:'scrollOffset'});
method('ll','m','(I)Z','pollScrollUp','Reports an initial up-button press or held repeat, retaining canonical guard arithmetic and shared countdown behavior.',{0:'obfuscationGuard'});
method('ll','n','(I)Z','pollScrollDown','Reports an initial down-button press or held repeat using the same countdown.',{0:'obfuscationGuard'});
method('ll','o','(I)Z','pollPageUp','Repeats only while the pointer is strictly above the pending thumb top; the initial press is unconditional.',{0:'obfuscationGuard'});
method('ll','l','(I)Z','pollPageDown','Repeats only while the pointer reaches or exceeds the pending thumb bottom; the initial press is unconditional.',{0:'obfuscationGuard'});
method('ll','a','(Z)Z','isThumbHeld','Checks the retained thumb press button, independently of hovered/matching-button state.',{0:'obfuscationGuard'});
method('ll','a','(IZII)I','getDraggedScrollOffset','Converts thumb travel into a rounded scroll offset and preserves the two clamp orders, which differ for negative content overflow.',{0:'viewportHeight',1:'clampMinimumFirst',2:'contentHeight',3:'obfuscationGuard'});
for(const [original,type,to] of [['Jb','Lje;','content'],['Nb','Lje;','viewport'],['Ib','Lll;','scrollbar']])field('dn',original,type,to,'Constructor retains the supplied content, nests it in a new viewport and copies scrollbar control styles.');
constructorParameters('dn','(JLje;Lje;Lll;)V',['key','content','viewportStyle','scrollbarStyle'],'Builds the viewport and scrollbar children around the supplied content identity.');
method('dn','a','(IZIIIII)V','setLayout','Sets container bounds, content/viewport width and scrollbar layout.',{0:'x',1:'obfuscationGuard',2:'width',3:'scrollbarGap',4:'scrollbarWidth',5:'y',6:'height'});
method('dn','a','(IZI)V','layoutViewport','Reserves scrollbar width and a gap on the right and sizes the scrollbar against current content geometry.',{0:'scrollbarWidth',1:'obfuscationGuard',2:'scrollbarGap'});
method('dn','a','(IZIZ)V','advanceScroll','Consumes arrow/page/wheel/drag input and clamps pending content scroll against the viewport.',{0:'arrowStep',1:'clampMinimumFirst',2:'wheelDelta',3:'obfuscationGuard'});
method('dn','a','(IIZII)V','applyScrollInput','Updates pending content Y, preserving clamp order and drag precedence, then refreshes thumb layout.',{0:'pageDownXHalf',1:'arrowStep',2:'clampMinimumFirst',3:'wheelDelta',4:'pageStep'});
method('dn','a','(ZIIZII)Z','updateContentLayout','A nonzero layout-state argument skips work; otherwise updates child layout and scroll input and reports whether existing child layout was preserved.',{0:'forceChildLayout',1:'wheelDelta',2:'arrowStep',3:'preserveChildLayout',4:'layoutState',5:'childSpacing'});
method('dn','a','(ZIIIIIZ)Z','updateContentLayoutAndScroll','Selects existing versus stacked child layout from hold/force flags, clamps scrolling and reports the selected layout policy.',{0:'forceChildLayout',1:'wheelDelta',2:'pageStep',3:'arrowStep',4:'pageDownXHalf',5:'childSpacing',6:'preserveChildLayout'});
for(const [original,type,to] of [['Tb','Lhd;','platformService'],['Ob','Lje;','caretComponent'],['Kb','I','selectionHeight'],['Nb','Z','wordSelectionDrag'],['Mb','I','initialWordEnd'],['Jb','I','selectionAnchor'],['Ib','Z','pointerSelecting'],['Wb','J','lastPressMillis'],['Pb','Lje;','textComponent'],['Ub','I','maximumLength'],['Rb','Ljava/lang/StringBuilder;','textBuffer'],['Sb','Lwo;','pendingClipboardTask'],['Xb','Lje;','selectionComponent'],['Qb','I','caretIndex']])field('dp',original,type,to,'Real text-field constructor and edit/selection/clipboard lifecycle: anchor and caret are distinct, pointer double-click mode uses a 250ms threshold, and asynchronous task completion is consumed during advanceEditing.');
constructorParameters('dp','(JLje;Lje;Lje;I)V',['key','style','selectionStyle','textStyle','maximumLength'],'Creates selection/text/caret components and a mutable buffer; -1 means unbounded length.');
constructorParameters('dp','(JLje;Lje;Lje;)V',['key','style','selectionStyle','textStyle'],'Constructs an unbounded text field.');
method('dp','c','(II)I','characterIndexAtX','Returns the first character boundary at or beyond the supplied pixel offset, bounded by buffer length.',{0:'obfuscationGuard',1:'pixelOffset'});
method('dp','a','(Z)V','clearText','Resets the buffer and collapses selection to zero; the boolean controls only the resize helper return/fill policy.',{0:'resizePolicy'});
method('dp','a','(Lhd;I)V','setPlatformService','Stores the service used to enqueue clipboard reads/writes.',{0:'platformService',1:'obfuscationGuard'});
method('dp','a','(III)V','setSelection','Clamps each supplied endpoint independently to the current text length.',{0:'obfuscationGuard',1:'selectionAnchor',2:'caretIndex'});
method('dp','l','(I)V','deleteSelection','Removes the half-open range between anchor/caret, preserves its suffix and collapses to the earlier endpoint.',{0:'obfuscationGuard'});
method('dp','a','(BLjava/lang/String;)V','insertClipboardText','Inserts at the caret and then moves selection to the buffer end; the bounded path retains its unconditional remaining-capacity substring and resulting failures.',{0:'obfuscationGuard',1:'text'});
method('dp','d','(B)Ljava/lang/String;','getSelectedText','Returns the ordered half-open selection substring.',{0:'obfuscationGuard'});
method('dp','a','(IIC)Z','handleKey','Rejects angle brackets, accepts printable ASCII and dispatches internal edit/navigation/clipboard key codes; returns consumed even for a full printable buffer.',{0:'keyCode',1:'obfuscationGuard',2:'typedCharacter'});
method('dp','g','(B)V','requestPaste','Enqueues a clipboard read when a platform service is present.',{0:'obfuscationGuard'});
method('dp','h','(B)V','cutSelection','Copies the selection and deletes it when a platform service is present.',{0:'obfuscationGuard'});
method('dp','p','(I)V','copySelection','Enqueues the nonempty selection as a StringSelection without waiting for completion.',{0:'obfuscationGuard'});
method('dp','q','(I)Ljava/lang/String;','getText','Returns the current buffer contents.',{0:'obfuscationGuard'});
method('dp','o','(I)I','getCaretIndex','Returns the caret endpoint while preserving guard arithmetic.',{0:'obfuscationGuard'});
method('dp','a','(Ljava/lang/String;B)V','setText','Replaces the buffer, truncates to the configured maximum length and collapses selection at its end; does not apply typed-character filtering.',{0:'text',1:'obfuscationGuard'});
method('dp','b','(IIIII)V','setLayout','Sets field/text/caret bounds and selection height; textYOffset affects only the text component.',{0:'y',1:'textYOffset',2:'width',3:'height',4:'x'});
method('dp','b','(IZ)V','moveCaret','Moves the caret without clamping and updates the anchor unless explicitly preserved or internal key 81 is held.',{0:'caretIndex',1:'preserveAnchor'});
method('dp','c','(IZ)V','setCollapsedSelection','Assigns both endpoints directly without clamping.',{0:'caretIndex',1:'obfuscationGuard'});
method('dp','m','(I)V','advanceEditing','Processes pointer character/word selection, caret/selection geometry, focus collapse and completed clipboard tasks; catches paste failures after any partial edit.',{0:'obfuscationGuard'});
method('dp','k','(I)I','previousSeparatorBoundary','Scans backward to the boundary following space or parentheses; preserves the original guard comparison.',{0:'obfuscationGuard'});
method('dp','e','(B)I','nextSeparatorBoundary','Scans forward to the boundary following space or parentheses.',{0:'obfuscationGuard'});
method('wr','a','(CB)Z','isTextNavigationSeparator','Only space and the two parentheses are separators for text-field word navigation.',{0:'character',1:'obfuscationGuard'});

for(const [original,type,to] of [['c','I','integerArgument'],['d','I','secondIntegerArgument'],['g','I','status'],['e','I','taskType'],['f','Ljava/lang/Object;','result'],['b','Ljava/lang/Object;','objectArgument'],['a','Lwo;','nextTask']])field('wo',original,type,to,'Enqueue retains arguments and links FIFO requests; run sets volatile status to 1 on success or 2 on failure, with 0 pending, and notifies the task monitor.');
for(const [original,type,to] of [['w','Lwo;','queueHead'],['s','Lwo;','queueTail'],['g','Z','stopRequested'],['v','Ljava/lang/Thread;','workerThread'],['e','Z','privilegedServicesEnabled'],['h','Z','microsoftJvm'],['r','Lei;','cacheDataFile'],['m','Lei;','randomDataFile'],['c','[Lei;','cacheIndexFiles'],['d','Lei;','masterIndexFile'],['j','Ljava/awt/EventQueue;','eventQueue'],['t','Ljava/lang/String;','javaVendor'],['u','Ljava/lang/String;','javaVersion'],['n','Ljava/lang/String;','lowercaseOsName'],['a','Ljava/lang/String;','osName'],['f','Ljava/lang/String;','userDirectory'],['k','I','cacheStoreId'],['i','Ljava/lang/String;','cacheName'],['p','J','networkBlockedUntilMillis']])field('hd',original,type,to,'Constructor properties/cache setup, synchronized FIFO enqueue/run, temporary network delay gates and stop/join/file-release lifecycle.');
constructorParameters('hd','(ILjava/lang/String;IZ)V',['requestedCacheStoreId','requestedCacheName','cacheIndexCount','privilegedServicesEnabled'],'Retains cache/property setup and starts the daemon worker; requested names remain distinct from unqualified static cache identities. Constructor side effects are not invoked by controlled task fixtures.');
method('hd','a','(IILjava/lang/Object;BI)Lwo;','enqueueTask','Appends a new task under the service monitor, notifies the worker and retains post-enqueue guard arithmetic.',{0:'secondIntegerArgument',1:'integerArgument',2:'objectArgument',3:'obfuscationGuard',4:'taskType'});
method('hd','a','(Ljava/awt/datatransfer/Transferable;I)Lwo;','writeClipboardAsync','Queues task type 19 retaining the exact Transferable object.',{0:'contents',1:'obfuscationGuard'});
method('hd','a','(I)Lwo;','readClipboardAsync','Queues task type 18; unsupported guards return null without enqueue.',{0:'obfuscationGuard'});
method('hd','a','(IILjava/lang/Runnable;)Lwo;','startThreadAsync','Queues task type 2 with a retained Runnable and requested priority.',{0:'priority',1:'obfuscationGuard',2:'runnable'});
method('hd','a','(Ljava/lang/Class;I[Ljava/lang/Class;Ljava/lang/String;)Lwo;','findDeclaredMethodAsync','Queues task type 8 retaining declaring class, name and parameter-type array.',{0:'declaringClass',1:'obfuscationGuard',2:'parameterTypes',3:'methodName'});
method('hd','a','(ILjava/lang/Class;Ljava/lang/String;)Lwo;','findDeclaredFieldAsync','Queues task type 9 retaining declaring class and field name.',{0:'obfuscationGuard',1:'declaringClass',2:'fieldName'});
method('hd','a','(IBLjava/lang/String;)Lwo;','openSocketAsync','Queues ordinary socket task type 1 with hostname and port; retained network timing gates are enforced by the worker.',{0:'port',1:'obfuscationGuard',2:'hostname'});
method('hd','a','(Ljava/net/URL;Z)Lwo;','openUrlStreamAsync','Queues task type 4 with the retained URL.',{0:'url',1:'obfuscationGuard'});
method('hd','a','(Z)V','stopAndClose','Stores the supplied stop flag, wakes and joins the worker, then closes retained cache/random files; false retains its existing waiting behavior.',{0:'stopRequested'});
method('hd','b','(I)Lwo;','getDisplayModesAsync','Queues task type 5 for display-mode enumeration; unsupported guards return null.',{0:'obfuscationGuard'});
method('hd','a','(BLjava/awt/Frame;)Lwo;','exitFullscreenAsync','Queues task type 7 with the supplied Frame identity.',{0:'obfuscationGuard',1:'frame'});
method('hd','b','(Z)Z','supportsFullscreen','Requires privileged services and the selected Microsoft or reflective fullscreen adapter.',{0:'obfuscationGuard'});

for(const [original,type,to] of [['Sb','[Lnf;','items'],['Kb','I','pendingResult'],['Xb','I','verticalPadding'],['Ub','[Lwk;','matchedButtonSkin'],['Tb','Lje;','itemTextStyle'],['Nb','Lje;','emptyTextStyle'],['Pb','I','itemPadding'],['Lb','I','itemCount'],['Yb','I','iconTextGap'],['Rb','I','horizontalPadding'],['Mb','[I','actionIds'],['Ib','I','rowHeight']])field('np',original,type,to,'Popup construction, bounded 256-entry insertion, maximum row measurement, popup placement and pressed-item action-ID return.');
constructorParameters('np','(Lje;[Lwk;Lje;Lje;IIIII)V',['style','matchedButtonSkin','emptyTextStyle','itemTextStyle','horizontalPadding','itemPadding','iconTextGap','verticalPadding','rowHeight'],'Retains style objects/skin and stores layout spacing; starts with result sentinel -2.');
constructorParameters('np','(Lnp;)V',['style'],'Copies popup style and spacing into new empty item/action arrays.');
method('np','a','(ZLjava/lang/String;ILwk;)V','addIconAction','Creates a real icon/text row retaining its action ID, skin and text style; exceeding 256 entries preserves array failure.',{0:'obfuscationGuard',1:'text',2:'actionId',3:'icon'});
method('np','a','(ILjava/lang/String;B)V','addTextAction','Creates a text-only action row with the same item style and skin.',{0:'actionId',1:'text',2:'obfuscationGuard'});
method('np','a','(IIIBI)V','layoutPopup','Adds an empty placeholder when needed, measures rows and chooses below/above/fallback placement against the raster bounds.',{0:'anchorHeight',1:'anchorY',2:'anchorWidth',3:'obfuscationGuard',4:'anchorX'});
method('nf','a','(III)I','measureRowWidth','Combines icon/text preferred widths, gap and twice the padding; a missing child contributes negative gap, preserving the both-missing formula.',{0:'obfuscationGuard',1:'iconTextGap',2:'padding'});
method('np','a','(BZ)I','pollAction','Updates clipped input and returns a pressed row ID, -1 for a press outside rows, or the retained waiting result; capture disabled returns -2.',{0:'obfuscationGuard',1:'enableCapture'});
method('np','d','(B)Z','isWaitingForAction','Checks result -2 and cancels it on internal key code 13; retains the true return for the cancelling call.',{0:'obfuscationGuard'});
// Lobby identity, packet-maintained state and independently retained UI links.
for(const [original,type,to] of [['Ub','I','playerCount'],['nc','I','playerCapacity'],['Tb','I','gameType'],['uc','Z','openToJoin'],['kc','Z','playing'],['ac','I','spectatorMode'],['Sb','Z','joinable'],['tc','Z','allowsAdmissionRequests'],['vc','Z','rated'],['pc','[B','gameOptions'],['qc','I','displayRating'],['Mb','J','activityStartedMillis'],['bc','I','completedDurationMillis'],['dc','J','ownerAccountId'],['rc','Ljava/lang/String;','ownerName'],['jc','[Ljava/lang/String;','playerNames'],['Nb','Z','invitationReceived'],['gc','Z','joinRequestSent'],['mc','I','notificationCode'],['Lb','I','notificationTicks']])field('au',original,type,to,'Room header decoder, admission context-menu labels, packet subtypes 8–13, sorted room list and notification expiry; spectator mode 2 uses the spectating tooltip and bit 32 uses rated/unrated tooltip text.');
for(const [original,to] of [['lc','ownerNameComponent'],['cc','playerCountComponent'],['hc','capacityComponent'],['Zb','ratingComponent'],['ic','gameTypeIcon'],['fc','spectatorIcon'],['Vb','ratedIcon'],['Qb','optionIcons'],['oc','optionIconContainer']])field('au',original,original==='Qb'?'[Lje;':'Lje;',to,'Room row renderer assigns these precise owner/count/rating labels and game/spectator/rated/option icons.');
constructorParameters('au','(I)V',['gameOptionCount'],'Allocates the retained option-byte array with this exact count.');
method('au','k','(I)Z','isRemovedFromIndex','Reports absence of secondary-link index membership; primary UI/list membership is independent.',{0:'obfuscationGuard'});
method('au','d','(B)I','getRoomId','Returns the secondary long key narrowed to int with canonical guard arithmetic.',{0:'obfuscationGuard'});
method('au','a','(BLau;)Z','sortsBefore','Orders invitation/notification-6 priority, joinability/game type, play state, admission/spectator mode and activity timestamp; equal timestamps retain false.',{0:'obfuscationGuard',1:'other'});
for(const [original,type,to] of [['Pb','J','accountId'],['cc','Ljava/lang/String;','accountName'],['Yb','Ljava/lang/String;','displayName'],['Vb','J','lastActivityMillis'],['Sb','I','rating'],['Xb','I','ratedGamesPlayed'],['Zb','Z','packedFlag0'],['Qb','I','chatIconId'],['Ob','I','optionUnlockMask'],['Wb','Z','invitationSent'],['Ub','Z','joinRequested'],['Kb','I','notificationCode'],['Rb','I','notificationTicks'],['ac','Lje;','nameComponent'],['Tb','Lje;','ratingComponent'],['dc','Lje;','admissionButton'],['ec','Lje;','cancelRejectButton']])field('of',original,type,to,'Lobby packet subtypes 5/6/14–19 retain player identity/stats and invitation/request notifications; row rendering and action labels distinguish accountName from displayed name. The low packed flag purpose remains unresolved.');
constructorParameters('of','(Ljava/lang/String;Ljava/lang/String;J)V',['accountName','displayName','accountId'],'Retains names and account identity; calls the existing account-name normalizer without retaining its return value.');
method('of','a','(BLjava/lang/String;Ljava/lang/String;)V','setNames','Updates both retained names and calls the same normalizer without storing its result.',{0:'obfuscationGuard',1:'displayName',2:'accountName'});
method('of','k','(I)Z','isRemovedFromIndex','Checks secondary-link absence without changing primary list membership.',{0:'obfuscationGuard'});
method('of','a','(ILof;)Z','sortsBefore','Prioritizes join requests, then invitations and earlier activity; equal timestamps retain false.',{0:'obfuscationGuard',1:'other'});
method('hh','a','(Lau;ZLvh;I)V','decodeLobbyRoom','Decodes optional player count, capacity/type/flags/options/rating/timing/owner/names; explicit player names rewind to the first name and preserve zero-count cursor behavior.',{0:'room',1:'includePlayerCount',2:'packet',3:'obfuscationGuard'});
method('bl','a','(B)V','processLobbyUpdate','Dispatches lobby update subtypes 0–23 from incomingPacket into room/player indexes, display lists, invitation/request state and current-room/setup state.',{0:'obfuscationGuard'});
method('rf','a','(ILau;)V','insertLobbyRoomSorted','Moves only primary membership into the sorted room deque using sortsBefore, retaining secondary index membership.',{0:'obfuscationGuard',1:'room'});
method('sf','a','(BLof;)V','insertLobbyPlayerSorted','Moves the player into the sorted primary lobby deque without replacing its secondary-key identity.',{0:'obfuscationGuard',1:'player'});
method('tr','a','(BJ)Lof;','getLobbyPlayer','Looks up the secondary account key in the lobby player index.',{0:'obfuscationGuard',1:'accountId'});
method('hr','a','(JI)Lof;','getCurrentRoomPlayer','Looks up an account in the current-room player index.',{0:'accountId',1:'obfuscationGuard'});
method('ij','b','(BI)Lau;','getLobbyRoom','Looks up the secondary room key in the lobby room index.',{0:'obfuscationGuard',1:'roomId'});
method('vu','b','(Z)Z','isCurrentRoomOwner','Compares current-room ownerAccountId with localAccountId; preserves null-room failure.',{0:'obfuscationGuard'});
for(const [owner,original,type,to] of [['oi','d','Ltp;','lobbyPlayersById'],['qm','J','Ltp;','lobbyRoomsById'],['qc','g','Lat;','lobbyRoomOrder'],['be','u','Lat;','lobbyPlayerOrder'],['wl','F','Lat;','currentRoomPlayers'],['eu','e','Ltp;','currentRoomPlayersById'],['vu','M','Lau;','currentRoom'],['no','K','Lau;','roomSetup'],['oh','H','J','localAccountId'],['vj','a','I','pendingJoinRequestCount'],['qd','K','I','lobbyNotificationDuration'],['tq','b','I','gameOptionCount']])field(owner,original,type,to,'Lobby packet dispatcher, sorted insertion, room/player lookup, ownership test and notification expiry share these exact globals.');
for(const [original,type,to] of [['d','J','lookupKey'],['h','[Lms;','buckets'],['b','I','bucketCount'],['a','Lms;','iterationCursor'],['i','I','iterationBucket'],['g','Lms;','lookupCursor']])field('tp',original,type,to,'Secondary-link hash construction, masked key lookup, duplicate continuation and independent bucket-order iteration.');
constructorParameters('tp','(I)V',['bucketCount'],'Builds sentinel secondary-link buckets, retaining zero/non-power-of-two counts.');
method('tp','a','(BJ)Lms;','get','Sets lookup key/cursor and returns the first matching secondary key.',{0:'obfuscationGuard',1:'key'});
method('tp','d','(I)Lms;','getNextMatch','Continues duplicate-key lookup through the selected bucket.',{0:'obfuscationGuard'});
method('tp','a','(IJLms;)V','put','Unlinks prior secondary membership then appends to key & (bucketCount + guard); canonical guard -1 gives the usual mask.',{0:'obfuscationGuard',1:'key',2:'node'});
method('tp','a','(B)Lms;','first','Resets bucket traversal without resetting duplicate-key lookup.',{0:'obfuscationGuard'});
method('tp','c','(I)Lms;','next','Advances the separate bucket-order traversal cursor.',{0:'obfuscationGuard'});
for(const [original,type,to] of [['Mb','Lje;','contentHost'],['Ib','[Lje;','tabButtons'],['Jb','[Lje;','panels'],['Kb','I','activeTab']])field('ml',original,type,to,'Real constructor retains caller panels and constructs labeled tab buttons; active-tab changes hide/show panels by shifting local X by 10000.');
constructorParameters('ml','(JLje;[Ljava/lang/String;Lje;[Lje;I)V',['key','tabStyle','labels','contentStyle','panels','activeTab'],'Creates tab buttons, nests retained panel objects and selects the specified initial tab.');
method('ml','a','(IIIIIII)V','setLayout','Stores container bounds, then lays out tabs and content for the canonical guard.',{0:'width',1:'y',2:'x',3:'contentPadding',4:'obfuscationGuard',5:'tabHeight',6:'height'});
method('ml','a','(III)V','layoutTabs','Divides available width with integer boundaries, sizes padded content panels and shifts inactive panels out of view.',{0:'contentPadding',1:'tabHeight',2:'obfuscationGuard'});
method('ml','l','(I)V','advanceTabSelection','Consumes every pressed tab in index order, moving old/new panels by ±10000.',{0:'obfuscationGuard'});
method('ad','a','(I)V','advanceLobbyNotifications','Decrements player/room notification counters, clears expired codes and removes primary rows only when secondary index membership is absent.',{0:'obfuscationGuard'});
for(const [original,type,to] of [['f','J','accountId'],['h','Ljava/lang/String;','displayName'],['o','[I','quickChatContext'],['g','Lje;','sourceComponent'],['m','Ljava/lang/String;','accountName'],['i','Lnp;','menu'],['c','I','roomId'],['e','I','chatChannel']])field('tg',original,type,to,'Constructor retains target metadata and selects the source component; action builders and dispatchers consume target account/room, chat channel and quick-chat context.');
constructorParameters('tg','(Lje;JLjava/lang/String;Ljava/lang/String;II[I)V',['sourceComponent','accountId','accountName','displayName','roomId','chatChannel','quickChatContext'],'Copies the configured menu style, retains quick-chat context and marks the source selected.');
method('tg','b','(IBI)Z','dispatchAdmissionAction','Maps action IDs 0/1/2/3/10/15/16 to player/room admission, spectating and watched-room request writers; unsupported actions return false.',{0:'actionId',1:'obfuscationGuard',2:'packetOpcode'});
method('tg','a','(IZI)Z','dispatchSocialAction','Handles friend/ignore additions/removals and posts any returned error as a system chat message.',{0:'socialPacketOpcode',1:'obfuscationGuard',2:'actionId'});
method('tg','a','(IBIIZ)Z','pollAndDispatch','Polls the context menu, returns false while waiting and invokes each action dispatcher for the chosen action ID.',{0:'packetOpcode',1:'obfuscationGuard',2:'socialPacketOpcode',3:'reportPacketOpcode',4:'enableCapture'});
method('tg','a','(Lmo;I)V','addChatFilterActions','Adds friends-only/off filter actions for the message channel and current channel context, excluding system messages.',{0:'message',1:'currentChannel'});
method('tg','a','(IZ)V','addPlayerAdmissionActions','Adds kick/withdraw/invite/accept/reject actions according to current ownership, capacity and player admission state.',{0:'obfuscationGuard',1:'includeJoinRequests'});
method('tg','a','(B)V','addRoomAdmissionActions','Adds join/accept/decline/request/withdraw choices from the indexed room state when outside a current room.',{0:'obfuscationGuard'});
method('tg','a','(IIB)Z','dispatchChatAction','Dispatches private/public text or quick-chat composition, filter changes and auto-response actions by ID; preserves post-action guard arithmetic.',{0:'actionId',1:'filterContext',2:'obfuscationGuard'});
method('tg','b','(I)Ljava/lang/String;','getTargetDisplayName','Returns a retained display name when present, otherwise the account name.',{0:'obfuscationGuard'});
method('tg','a','(IBI)Z','dispatchReportAction','Action 17 opens the abuse-report control against the source bounds.',{0:'actionId',1:'obfuscationGuard',2:'reportPacketOpcode'});
method('tg','a','(BZ)V','draw','Delegates drawing to the owned ContextActionMenu.',{0:'obfuscationGuard',1:'blinkOn'});
method('tg','c','(B)Z','isWaitingForAction','Returns whether the menu exists and retains its waiting state.',{0:'obfuscationGuard'});
method('tg','a','([III)V','addSocialActions','Builds friend/ignore/private/quick-chat actions from account state and optional retained quick-chat context.',{0:'quickChatContext',1:'obfuscationGuard',2:'chatChannel'});
method('tg','b','(B)V','addReportAction','Adds action 17 for a nonlocal account; preserves the original report-label/report-dialog pairing.',{0:'obfuscationGuard'});
method('ng','a','(Ldn;Lje;[ILjava/lang/String;IIILjava/lang/String;J)V','openClientContextMenu','Retains the source scroll container and constructs/selects a context-menu target.',{0:'scrollContainer',1:'sourceComponent',2:'quickChatContext',3:'displayName',4:'roomId',5:'obfuscationGuard',6:'chatChannel',7:'accountName',8:'accountId'});
field('tn','Z','Ltg;','activeContextMenu','Context-menu creation publishes this target state for menu builders and polling.');
field('pq','b','Ldn;','contextMenuScrollContainer','Context-menu creation stores the optional originating scroll container.');
field('oo','a','I','watchedRoomId','Watched-room request writer retains this ID, skips repeated requests and clears the prior room playerNames cache.');
method('ra','a','(JII)V','writePlayerAdmissionRequest','Writes a ciphered opcode, byte length and command/account ID; the actual admission caller supplies command 6, keeping the long-writer guard valid.',{0:'accountId',1:'packetOpcode',2:'command'});
method('te','a','(IJB)V','writePlayerAdmissionCancellation','Writes byte-framed command 7 and the eight-byte account ID.',{0:'packetOpcode',1:'accountId',2:'obfuscationGuard'});
method('ag','a','(III)V','writeRoomAdmissionRequest','Writes fixed byte-framed command 8 and the low sixteen bits of the room ID.',{0:'packetOpcode',1:'obfuscationGuard',2:'roomId'});
method('pq','a','(III)V','writeRoomAdmissionCancellation','Writes fixed byte-framed command 9 and room ID, preserving guard arithmetic after opcode/length.',{0:'obfuscationGuard',1:'roomId',2:'packetOpcode'});
method('ov','a','(III)V','writeSpectateRoomRequest','Writes fixed byte-framed command 10 and room ID; canonical payload length 3 also supplies the byte-writer guard.',{0:'packetOpcode',1:'payloadLength',2:'roomId'});
method('bw','a','(IIB)V','writeWatchedRoomRequest','Changes watchedRoomId, clears the prior indexed room playerNames and writes command 11 only when the target differs.',{0:'packetOpcode',1:'roomId',2:'obfuscationGuard'});
method('vh','a','(JI)V','writeLong','Writes eight big-endian bytes before applying the original post-write guard side effect.',{0:'value',1:'obfuscationGuard'});
for(const [original,type,to] of [['b','I','channelId'],['m','Ljava/lang/String;','accountName'],['q','Ljava/lang/String;','displayName'],['n','J','accountId'],['h','Ljava/lang/String;','text'],['k','Ljava/lang/String;','channelLabel'],['v','I','contextId'],['d','[I','quickChatValues'],['f','Z','systemMessage'],['p','I','chatIconId'],['a','I','identityWord0'],['e','I','identityWord1'],['u','Lje;','rowComponent']])field('mo',original,type,to,'Decoded-state snapshot and system-message constructors, sender prefix rendering, duplicate identity checks, filter classification and context-menu target creation. Identity-word finer protocol meaning remains unresolved.');
constructorParameters('mo','(Z)V',['retainQuickChatValues'],'Snapshots the current decoded chat globals and optionally retains the same quick-chat value array.');
constructorParameters('mo','(ILjava/lang/String;ILjava/lang/String;Ljava/lang/String;)V',['channelId','accountName','contextId','channelLabel','text'],'Constructs a system message with zero sender/identity/icon fields and matching account/display names.');
method('mo','a','(Z)I','getFilterPriority','Returns 2 for system/private-icon messages, 1 for self or enabled friend context, otherwise 0; false guard clears displayName.',{0:'obfuscationGuard'});
method('af','a','(Lmo;B)Ljava/lang/String;','formatChatPrefix','Formats channel and sender prefixes, including icons and private-message identity-word distinctions.',{0:'message',1:'obfuscationGuard'});
method('pg','a','(ILmo;)V','openChatMessageContextMenu','Constructs a context target from the message row/account/channel and adds channel-specific actions.',{0:'obfuscationGuard',1:'message'});
for(const [original,type,to] of [['Qb','Lfp;','muteControl'],['Ib','Lje;','closeButton'],['Sb','J','accountId'],['Jb','Ljava/lang/StringBuilder;','targetName'],['Tb','Lje;','content'],['Ub','[Lje;','offenceButtons'],['Mb','Lje;','title'],['Kb','I','pendingResult'],['Rb','Lje;','targetNameComponent'],['Vb','Lje;','instructions'],['Pb','Lje;','helpText']])field('i',original,type,to,'Abuse-report constructor builds target/rule text and optional mute control; poll/getter callers serialize offence ID, target name/account and mute choice.');
constructorParameters('i','(IIIIILje;Lje;Lje;Lje;Lfp;Lje;Ljava/lang/String;J)V',['anchorX','anchorY','anchorWidth','anchorHeight','unusedReportPacketOpcode','style','titleStyle','closeStyle','textStyle','muteStyle','offenceStyle','targetName','accountId'],'Constructs the report dialogue against source bounds; unavailable target names use the original instructional-only branch.');
method('i','l','(I)Z','isWaitingForChoice','Returns true while pendingResult is -2, changing it to -1 for key 13 while preserving the true return on that call.',{0:'obfuscationGuard'});
method('i','a','(ZB)I','pollOffence','Updates input/text, toggles optional mute selection and returns pressed offence, close/outside cancellation or the retained waiting result.',{0:'enableCapture',1:'obfuscationGuard'});
method('i','o','(I)Z','isMuteSelected','Reports whether the optional icon/label mute control is selected.',{0:'obfuscationGuard'});
method('i','k','(I)Ljava/lang/String;','getTargetName','Returns the target-name buffer for the canonical guard.',{0:'obfuscationGuard'});
method('i','a','([Lwk;IIBII)V','drawNineSlice','Draws/tile-clips the nine retained skin sprites against supplied bounds, preserving null and zero-size cases.',{0:'sprites',1:'height',2:'x',3:'obfuscationGuard',4:'y',5:'width'});
for(const [original,to] of [['Jb','iconComponent'],['Kb','labelComponent']])field('fp',original,'Lje;',to,'Real constructor assigns these icon/text children; width and layout use icon preferred width plus the configured gap.');
constructorParameters('fp','(JLje;Lje;Ljava/lang/String;)V',['key','iconStyle','labelStyle','text'],'Builds icon and label children and marks descendants for inherited visual state.');
constructorParameters('fp','(JLfp;Ljava/lang/String;)V',['key','style','text'],'Copies icon/label styles from a prototype.');
constructorParameters('fp','(JLwk;Lwk;ILje;Ljava/lang/String;)V',['key','selectedIcon','icon','verticalAlignment','labelStyle','text'],'Creates icon/label content with explicit selected/unselected sprites.');
method('fp','a','(BIIIII)V','setLayout','Sets local bounds, then reserves measured icon width plus gap for the label.',{0:'obfuscationGuard',1:'y',2:'iconTextGap',3:'height',4:'x',5:'width'});
method('fp','c','(II)V','layoutContent','Lays out full-height icon and remaining label width; canonical first argument zero also supplies child Y/guard.',{0:'obfuscationGuard',1:'iconTextGap'});
method('fp','d','(II)I','measureRowWidth','Returns icon preferred width plus gap plus label preferred width.',{0:'obfuscationGuard',1:'iconTextGap'});
method('fu','a','(Ljava/lang/String;IJIZI)V','writeAbuseReport','Writes opcode and a byte-framed account ID, zero-terminated target name, offence byte and mute byte; retains its early-return and partial-write guard behavior.',{0:'targetName',1:'offenceId',2:'accountId',3:'obfuscationGuard',4:'mute',5:'packetOpcode'});
for(const [original,type,to] of [['Mb','Ljava/lang/String;','displayName'],['Nb','Ljava/lang/String;','previousDisplayName'],['Pb','Ljava/lang/String;','accountName'],['Ib','Ljava/lang/String;','locationLabel'],['Ob','I','orderIndex'],['Qb','Lje;','nameComponent'],['Kb','Lje;','locationComponent'],['Jb','Lje;','previousNameComponent']])field('hl',original,type,to,'Incoming friend/ignore records update names and order; shared list layout displays the current name, optional previous-name indicator and online location.');
for(const [owner,original,type,to] of [['nh','K','Ltp;','friendsByName'],['bk','a','Ltp;','ignoredAccountsByName'],['wh','c','Lat;','friendEntries'],['ot','E','Lat;','ignoreEntries'],['dj','a','I','friendCount'],['vg','p','I','ignoreCount'],['th','a','I','socialListState'],['vl','p','Ljava/lang/String;','currentLocationLabel'],['ft','p','Ljava/lang/String;','localAccountNameKey'],['mv','d','Ljava/lang/String;','localAccountName']])field(owner,original,type,to,'Social update, lookup, addition/removal and reset data flow; state 0 is unavailable, 1 is loading/nonmodifiable, and 2 enables friend/ignore changes. Location labels are interned and compared by reference.');
method('k','a','(Ljava/lang/CharSequence;Z)Ljava/lang/String;','normalize','Trims space/NBSP/underscore/hyphen, checks trimmed length 1–12, filters characters and folds accents/case; an empty retained key returns null.',{0:'name',1:'obfuscationGuard'});
method('rs','a','(CB)Z','isAccountNameSeparator','Recognizes space, NBSP, underscore and hyphen for canonical trim and name validation.',{0:'character',1:'obfuscationGuard'});
method('ph','a','(IC)Z','isAccountNameCharacter','Accepts ASCII alphanumerics plus the fixed separator/accent and bracket/hash alphabets; rejects ISO controls.',{0:'obfuscationGuard',1:'character'});
method('pv','a','(IC)C','foldAccountNameCharacter','Maps separators to underscore, the supported accent groups to lower-case ASCII and sharp-s to b; retains brackets/hash.',{0:'obfuscationGuard',1:'character'});
method('wn','a','(Ljava/lang/CharSequence;IZ)Z','hasValidAccountNameShape','Checks raw length and canonical content, forbids trailing separators and optionally rejects consecutive separators.',{0:'name',1:'minimumLength',2:'allowRepeatedSeparators'});
method('hg','a','(BLjava/lang/CharSequence;)Z','isValidSocialTargetName','Combines account-name shape validation with acceptance of every original character.',{0:'obfuscationGuard',1:'name'});
method('lg','a','(Ljava/lang/String;B)Lhl;','findFriend','Scans all equal-hash secondary entries and compares normalized current display names; null/empty/uncanonicalizable input returns null.',{0:'name',1:'obfuscationGuard'});
method('db','a','(Ljava/lang/String;I)Lhl;','findIgnoredAccount','Scans equal-hash entries using canonical keys when available, otherwise exact raw names.',{0:'name',1:'obfuscationGuard'});
method('jj','a','(ILjava/lang/String;)Z','isFriend','Checks friend lookup, independent of online location.',{0:'obfuscationGuard',1:'name'});
method('si','a','(Ljava/lang/String;I)Z','isIgnoredAccount','Checks ignored-account lookup.',{0:'name',1:'obfuscationGuard'});
method('gt','a','(Ljava/lang/String;B)Z','isLocalAccountName','Compares the normalized target against the retained local account-name key.',{0:'name',1:'obfuscationGuard'});
method('wq','a','(JLjava/lang/String;B)Z','isOnlineFriendOrRoomMember','Returns true for a friend with a location label or an account in the current room.',{0:'accountId',1:'name',2:'obfuscationGuard'});
method('u','a','(I)V','processSocialListUpdate','Reads subtypes 0–4: ignore record, friend record, ready/nonmodifiable transitions and location/filter initialization. Reuses renamed rows and preserves ordering.',{0:'obfuscationGuard'});
method('wd','a','(ZLhl;Lhl;)Z','isFriendOrderedAfter','Compares order-index difference with ±200 biases for reference-identical current location and null/offline labels; true guard returns false.',{0:'obfuscationGuard',1:'entry',2:'other'});
method('da','c','(I)V','clearSocialLists','Clears retained current location, counts, both primary lists and secondary indexes before resetting state to zero; requires initialized indexes.',{0:'obfuscationGuard'});
method('da','a','(I)V','readLocalAccountName','Reads the local name and retains its normalized lookup key.',{0:'obfuscationGuard'});
method('op','a','(ILjava/lang/String;I)Ljava/lang/String;','requestAddFriend','Validates the name/state/self/existing friend/capacity/ignore constraints, then writes command 0; rows remain unchanged until incoming updates.',{0:'obfuscationGuard',1:'name',2:'packetOpcode'});
method('nw','a','(Ljava/lang/String;BI)Ljava/lang/String;','requestRemoveFriend','Unlinks the friend and decrements each subsequent displayed row orderIndex before writing command 1 with the supplied name.',{0:'name',1:'obfuscationGuard',2:'packetOpcode'});
method('se','a','(Ljava/lang/String;II)Ljava/lang/String;','requestAddIgnoredAccount','Validates the name/self/state/existing ignore/capacity/friend constraints, then writes command 2 without adding a row locally.',{0:'name',1:'packetOpcode',2:'obfuscationGuard'});
method('fq','a','(ILjava/lang/String;ZLjava/lang/String;)Ljava/lang/String;','requestRemoveIgnoredAccount','Validates accountName, looks up displayName and unlinks/decrements immediately before command 3; true guard leaves an incomplete frame.',{0:'packetOpcode',1:'displayName',2:'obfuscationGuard',3:'accountName'});
method('sm','a','(IIZ)Lhl;','updateFriendListControls','Lays out name/location/previous-name controls and opens private-message or friend-removal actions for the selected row.',{0:'obfuscationGuard',1:'visibleRows',2:'enableCapture'});
method('tr','a','(IZI)V','updateIgnoreListControls','Lays out current/previous-name controls and opens ignore-removal actions for pressed rows.',{0:'obfuscationGuard',1:'enableCapture',2:'visibleRows'});
method('la','a','(ZII)V','updateSocialListControls','Coordinates friend and ignore list controls, adding friend-removal/context popup actions for a selected friend.',{0:'enableCapture',1:'visibleRows',2:'obfuscationGuard'});
for(const [original,type,to] of [['a','[B','symbolCodeLengths'],['h','[I','symbolCodes'],['b','[I','decodeTrie']])field('dq',original,type,to,'Constructor retains lengths and builds high-bit-aligned codes and a packed zero/one trie with complemented symbol leaves.');
constructorParameters('dq','([B)V',['codeLengths'],'Constructs the code words and decode trie, retaining the supplied lengths array.');
method('dq','a','(I[BI[BIB)I','compress','Packs retained symbol codes MSB-first at a byte-aligned output offset; returns bytes written and rejects zero-length symbols.',{0:'inputOffset',1:'input',2:'inputLength',3:'output',4:'outputOffset',5:'obfuscationGuard'});
method('dq','a','([BIZII[B)I','decompress','Walks the trie until outputLength bytes are decoded, returning input bytes consumed; zero output length consumes nothing.',{0:'input',1:'inputOffset',2:'obfuscationGuard',3:'outputLength',4:'outputOffset',5:'output'});
field('ds','c','Ldq;','chatHuffmanCodec','Installed codebook is shared by compressed chat text read/write helpers.');
method('uc','a','(Ldq;I)V','setChatHuffmanCodec','Installs the shared chat codebook.',{0:'codec',1:'obfuscationGuard'});
method('nr','a','(Ljava/lang/CharSequence;Z)[B','encodeSingleByteText','Encodes the supported CP1252-style alphabet, replacing unsupported UTF-16 code units and NUL with question marks.',{0:'text',1:'obfuscationGuard'});
method('co','a','(III[B)Ljava/lang/String;','decodeSingleByteText','Decodes the single-byte alphabet and skips zero bytes.',{0:'offset',1:'length',2:'obfuscationGuard',3:'bytes'});
method('vh','a','(ZI)V','writeUnsignedSmart','Writes one byte for 0..127 or a high-bit-marked short for 128..32767; rejects values outside the range.',{0:'obfuscationGuard',1:'value'});
method('vh','e','(I)I','readUnsignedSmart','Reads the one-byte or high-bit-marked two-byte unsigned smart value.',{0:'obfuscationGuard'});
method('sf','a','(ILjava/lang/String;Lvh;)I','writeCompressedChatText','Writes the single-byte text length as unsigned smart then Huffman bytes, advancing the packet cursor and returning total bytes written.',{0:'obfuscationGuard',1:'text',2:'packet'});
method('le','a','(IBLvh;)Ljava/lang/String;','readCompressedChatText','Reads unsigned-smart decoded length, clamps it to maximumLength and decodes only that many bytes; catches failures as Cabbage without rewinding consumed length.',{0:'maximumLength',1:'obfuscationGuard',2:'packet'});
method('it','a','(IIILjava/lang/String;ILjava/lang/String;)V','writeChatMessage','Writes caller opcode and byte-length-framed channel, optional private recipient, then compressed text or caller-supplied sixteen-bit phrase ID.',{0:'phraseId',1:'obfuscationGuard',2:'channelId',3:'recipientName',4:'packetOpcode',5:'text'});
for(const [owner,original,type,to] of [['rs','t','I','outgoingChatChannel'],['qd','G','Ljava/lang/String;','chatRecipientName'],['wm','b','Ljava/lang/String;','chatRecipientNameKey'],['dj','e','J','chatRecipientAccountId'],['hf','c','Z','textChatActive'],['qd','I','Lmq;','activeQuickChatMenu'],['wn','jb','Lmq;','defaultQuickChatMenu'],['as','E','Lje;','quickChatMenuHost'],['iu','h','Z','quickChatMenuVisible'],['vt','l','I','lastQuickChatChannel'],['wn','db','Ljava/lang/String;','lastQuickChatRecipientName'],['vi','e','I','lastQuickChatPhraseId'],['lq','d','Z','hasLastQuickChat'],['rt','z','J','lastQuickChatRecipientAccountId'],['qj','C','Ljava/lang/StringBuilder;','chatTextBuffer']])field(owner,original,type,to,'Private/public composer selection, quick-chat response/root menu installation, typed/phrase serialization and replay of the last quick-chat message.');
method('gk','a','(ILjava/lang/String;J)V','openPrivateTextChat','Selects channel 2, retains recipient identity/key and enables text chat.',{0:'obfuscationGuard',1:'recipientName',2:'accountId'});
method('og','a','(JILjava/lang/String;)V','openPrivateQuickChat','Selects channel 2, retains recipient identity/key and opens the default quick-chat menu.',{0:'accountId',1:'obfuscationGuard',2:'recipientName'});
method('rb','a','(JLjava/lang/String;II[I)Z','canOpenQuickChatResponses','Requires a response-ID array; private-channel targets additionally require an online friend or current room membership.',{0:'accountId',1:'recipientName',2:'obfuscationGuard',3:'channelId',4:'responsePhraseIds'});
method('me','a','(ILjava/lang/String;[IJI)Z','openQuickChatResponses','Checks response eligibility, remaps channel 1 to 0, retains target state, builds response rows and installs the returned menu.',{0:'obfuscationGuard',1:'recipientName',2:'responsePhraseIds',3:'accountId',4:'channelId'});
method('fg','a','(ILje;[ILje;Lje;)Lmq;','buildQuickChatResponseMenu','Builds phrase previews with shortcuts starting at character 2; phrase lookup/preview exceptions return null before construction.',{0:'obfuscationGuard',1:'style',2:'responsePhraseIds',3:'textStyle',4:'itemStyle'});
method('vs','a','(ILmq;)V','showQuickChatMenu','A null menu is a no-op; otherwise replaces host children with the retained active menu and marks it visible.',{0:'obfuscationGuard',1:'menu'});
method('hh','a','(B)V','openDefaultQuickChatMenu','Installs the configured default menu through showQuickChatMenu.',{0:'obfuscationGuard'});
method('la','b','(I)V','openPublicTextChat','Selects outgoing channel 0 and enables text chat for the canonical guard.',{0:'obfuscationGuard'});
method('np','k','(I)V','openPublicQuickChat','Selects outgoing channel 0 and opens the default quick-chat menu.',{0:'obfuscationGuard'});
method('rd','b','(I)V','clearChatText','Clears the shared text buffer and returns outgoing channel to zero.',{0:'obfuscationGuard'});
method('e','a','(B)V','closeQuickChatMenu','Clears visible state, resets menu selection, clears text/channel when nonzero and resets the menu layout inset.',{0:'obfuscationGuard'});
method('fs','a','(BLjava/lang/String;)Z','isActivePrivateTextRecipient','Requires active text chat, outgoing channel 2 and a matching normalized recipient key for canonical guards.',{0:'obfuscationGuard',1:'recipientName'});
method('vu','j','(I)Z','isChatRecipientAvailable','Checks online friend or current-room membership against retained recipient identity.',{0:'obfuscationGuard'});
method('jh','a','(Ljava/lang/String;JIII)V','rememberLastQuickChat','Retains replay recipient/channel/phrase; canonical guard also marks history available and stores the account ID.',{0:'recipientName',1:'accountId',2:'phraseId',3:'channelId',4:'obfuscationGuard'});
method('po','a','(III)Z','handleQuickChatShortcuts','Handles response/default/replay keys 9/10/11 using target eligibility, room-setup gates and the existing repeat-message throttle.',{0:'packetOpcode',1:'obfuscationGuard',2:'unusedParameter2'});
method('kp','a','(II)I','getChatFilter','Reads public/room/private filter for channel IDs 0/1/2; other values return zero.',{0:'channelId',1:'obfuscationGuard'});
method('ud','b','(IZII)V','setChatFilter','Changes the selected public/room/private filter, marks settings changed and writes updated packed filters only when different.',{0:'filterValue',1:'obfuscationGuard',2:'channelId',3:'packetOpcode'});
for(const [original,type,to] of [['Nb','Lje;','listContent'],['Kb','Ldn;','scrollContainer'],['Ib','Lje;','addButton'],['Rb','Lje;','removeButton']])field('mp',original,type,to,'Social-list prototype construction and friend/ignore controls use retained content, scroll container and add/remove buttons.');
constructorParameters('mp','(JLmp;Ljava/lang/String;Ljava/lang/String;)V',['key','style','addLabel','removeLabel'],'Copies the social-list viewport/scrollbar/button styles from a prototype.');
constructorParameters('mp','(JLje;Lje;Lll;Lje;Ljava/lang/String;Ljava/lang/String;)V',['key','style','viewportStyle','scrollbarStyle','buttonStyle','addLabel','removeLabel'],'Constructs content, scroll container and add/remove buttons.');
method('mp','a','(IIIIIIIB)V','setLayout','Stores panel bounds, then lays out the scroll area and shared bottom button row.',{0:'x',1:'scrollbarWidth',2:'gap',3:'buttonHeight',4:'width',5:'y',6:'height',7:'obfuscationGuard'});
method('mp','a','(BIII)V','layoutControls','Splits bottom-row width with integer division, reserves the gap and lays out the scroll container above it.',{0:'obfuscationGuard',1:'scrollbarWidth',2:'buttonHeight',3:'gap'});
for(const [original,type,to] of [['Kb','I','pendingResult'],['Lb','Lje;','instructionsComponent'],['Mb','Lje;','inputComponent'],['Qb','Ljava/lang/StringBuilder;','nameBuffer']])field('oc',original,type,to,'Prompt construction and two input paths retain text, displayed components and 0/1/2 waiting/cancel/submit state.');
constructorParameters('oc','(IIIILjava/lang/String;Lje;Lje;Lje;)V',['anchorX','anchorY','anchorWidth','anchorHeight','instructions','style','instructionsStyle','inputStyle'],'Constructs an instruction/input prompt and fits it against raster bounds beside the anchor.');
method('oc','b','(ZZ)I','pollInput','Polls queued keys when enabled, preserving modern name/bracket input, submit/cancel return values and outside-click cancellation.',{0:'obfuscationGuard',1:'enableCapture'});
method('oc','d','(B)Z','handleLegacyNameKey','Handles one decoded key with lower-case ASCII/underscore conversion, twelve-character limit, backspace and retained cancellation/submission.',{0:'obfuscationGuard'});
for(const [owner,signature,names] of [
 ['dq','a(I[BI[BIB)I',[[9,'var7_int','outputWord'],[11,'var8','outputBitPosition'],[12,'var9','symbol'],[13,'var10','symbolCode'],[14,'var11','codeLength'],[15,'var12','outputByteIndex'],[16,'var13','bitShift'],[17,'var14','lastOutputByte'],[18,'var15','obfuscationControl']]],
 ['dq','<init>([B)V',[[0,'var5','symbol'],[1,'var14','copyIndex'],[6,'var2_int','symbolCount'],[8,'var3','codeFrontier'],[9,'var4','nextTrieSlot'],[10,'var6','codeLength'],[11,'var7','codeStep'],[12,'var8','symbolCode'],[13,'var9','nextCode'],[14,'var10','shorterLength'],[15,'var11','shorterCode'],[16,'var12','shorterStep'],[17,'var13','expandedTrie'],[18,'var16','frontierAlias'],[19,'var17','frontier'],[20,'var10Lifetime1','longerLength'],[21,'var10Lifetime2','trieSlot'],[22,'var11Lifetime1','codeBit'],[23,'var12Lifetime1','codeMask']]],
 ['dq','a([BIZII[B)I',[[24,'var7_int','trieSlot'],[26,'var8','inputIndex'],[27,'var9','inputByte'],[28,'var10','decodedLeaf'],[29,'var11','obfuscationControl'],[30,'var10Lifetime1','leafBit6'],[31,'var10Lifetime2','leafBit5'],[32,'var10Lifetime3','leafBit4'],[33,'var10Lifetime4','leafBit3'],[34,'var10Lifetime5','leafBit2'],[35,'var10Lifetime6','leafBit1'],[36,'var10Lifetime7','leafBit0']]],
 ['sf','a(ILjava/lang/String;Lvh;)I',[[0,'var3_int','startPosition'],[2,'var4','encodedText'],[4,'var6','textCharacters']]],
 ['it','a(IIILjava/lang/String;ILjava/lang/String;)V',[[0,'var9','packet'],[1,'var7','payloadStart'],[2,'var6','packetAlias']]],
 ['me','a(ILjava/lang/String;[IJI)Z',[[0,'var6','responseMenu'],[2,'var7','recipientCharacters']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed Huffman construction/packing/trie traversal, compressed text or retained chat target at this exact declaration.');
for(const [owner,signature,names] of [
 ['u','a(I)V',[[0,'fieldTemp$1','newIgnoreOrder'],[1,'fieldTemp$0','newFriendOrder'],[7,'var1','packet'],[9,'var2','updateType'],[10,'var3','initialLocation'],[11,'var3_int','hasSeparateAccountName'],[12,'var4','chatFilterBits'],[13,'var4_ref_String','ignoreDisplayName'],[14,'var5','ignoreAccountName'],[15,'var6','ignoreEntry'],[16,'var7','nextFriend'],[17,'var7_ref','previousIgnoreName'],[18,'var8','ignoreNameKey'],[19,'var9','obfuscationControl'],[20,'var3Lifetime1','friendLocation'],[21,'var4_ref_StringLifetime1','friendDisplayName'],[22,'var5Lifetime1','previousFriendName'],[23,'var6Lifetime1','friendEntry']]],
 ['k','a(Ljava/lang/CharSequence;Z)Ljava/lang/String;',[[8,'var2_int','trimmedStart'],[10,'var3','trimmedEnd'],[11,'var4','trimmedLength'],[12,'var5','canonicalName'],[13,'var6','characterIndex'],[14,'var7','character'],[15,'var8','foldedCharacter'],[16,'var9','obfuscationControl']]],
 ['lg','a(Ljava/lang/String;B)Lhl;',[[0,'var2','nameKey'],[1,'var3','friend'],[2,'var4','candidateNameKey'],[3,'var5','obfuscationControl'],[4,'var6','nameCharacters'],[5,'var7','candidateCharacters']]],
 ['db','a(Ljava/lang/String;I)Lhl;',[[0,'var2','nameKey'],[1,'var3','ignoredAccount'],[2,'var4','candidateNameKey'],[3,'var5','obfuscationControl'],[4,'var6','nameCharacters'],[5,'var7','candidateCharacters']]],
 ['wd','a(ZLhl;Lhl;)Z',[[0,'var3_int','orderDifference'],[2,'var4','obfuscationControl']]],
 ['op','a(ILjava/lang/String;I)Ljava/lang/String;',[[14,'var4','payloadStart'],[15,'var5','packet'],[16,'var6','nameCharacters']]],
 ['nw','a(Ljava/lang/String;BI)Ljava/lang/String;',[[9,'var5','payloadStart'],[10,'var6','obfuscationControl'],[11,'var7','subsequentFriend'],[12,'var8','friend'],[13,'var9','packet'],[14,'var10','nameCharacters']]],
 ['se','a(Ljava/lang/String;II)Ljava/lang/String;',[[1,'var4','payloadStart'],[2,'var5','packet'],[3,'var6','nameCharacters']]],
 ['fq','a(ILjava/lang/String;ZLjava/lang/String;)Ljava/lang/String;',[[1,'var5','packet'],[2,'var6','payloadStart'],[3,'var7','ignoredAccount'],[4,'var8','accountNameCharacters']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed social record, canonical-name collision lookup, ordering and command framing at this exact declaration.');
for(const [owner,signature,names] of [
 ['tg','b(IBI)Z',[[0,'var5','obfuscationControl']]],
 ['tg','b(I)Ljava/lang/String;',[[0,'var2','targetName'],[1,'var3','guardQuotient']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed admission dispatch and context display-name selection at this exact declaration.');
for(const [owner,signature,names] of [
 ['au','a(BLau;)Z',[[20,'var3_int','hasInvitationPriority'],[22,'var4','otherHasInvitationPriority'],[23,'var5','hasAdmissionPriority'],[24,'var6','otherHasAdmissionPriority']]],
 ['hh','a(Lau;ZLvh;I)V',[[0,'var8','playerIndex'],[21,'var4_int','packedFlags'],[23,'var5','hasCompletedDuration'],[24,'var6','hasPlayerNames'],[25,'var7','namesStart'],[26,'var9','obfuscationControl']]],
 ['ml','a(III)V',[[0,'dupTemp$0','inactivePanel'],[1,'var4','tabIndex'],[2,'var5','tabLeft'],[3,'var6','tabRight'],[4,'var7','obfuscationControl'],[5,'var8','panelIndex'],[6,'var4Lifetime1','initialPanelIndex']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed lobby ordering/header decoding or tab layout at this exact declaration.');
for(const [owner,signature,names] of [
 ['dp','c(II)I',[[0,'incrementValue$1','characterIndexBeforeIncrement'],[1,'var3_int','characterIndex'],[3,'var4','measuredWidth'],[4,'var5','textLength'],[5,'var6','obfuscationControl']]],
 ['dp','a(III)V',[[2,'var4_int','textLength'],[3,'var5','obfuscationControl']]],
 ['dp','k(I)I',[[0,'var2_int','characterIndex'],[1,'var3','obfuscationControl']]],
 ['dp','e(B)I',[[0,'var2_int','textLength'],[1,'var3','characterIndex'],[2,'var4','obfuscationControl']]],
 ['dp','l(I)V',[[1,'stackIn_5_0','selectionStartValue'],[2,'stackIn_9_0','selectionEndValue'],[4,'var2_int','selectionStart'],[6,'var3','selectionEnd'],[7,'var4','retainedSuffix']]],
 ['dp','d(B)Ljava/lang/String;',[[0,'var2','text'],[1,'stackIn_6_0','selectionStartValue'],[2,'stackIn_10_0','selectionEndValue'],[3,'stackIn_11_0','selectedText'],[6,'var3','selectionStart'],[7,'var4','selectionEnd']]],
 ['dp','a(BLjava/lang/String;)V',[[7,'var3_int','remainingCapacity'],[9,'var4','retainedSuffix'],[10,'var3_intLifetime1','guardQuotient']]],
 ['dp','a(IIC)Z',[[3,'stackIn_57_0','forwardCaretValue'],[4,'stackIn_66_0','backwardCaretValue'],[6,'var4_int','nextCaret'],[8,'var5','retainedSuffix']]],
 ['dp','m(I)V',[[0,'dupTemp$0','unfocusedTextLength'],[1,'stackIn_19_1','pressWithinDoubleClickThreshold'],[2,'stackIn_32_0','selectionLeftValue'],[4,'var2_int','pointerCharacterIndex'],[6,'var3_long','pressMillis'],[7,'var3','anchorPixelX'],[8,'var4_int','selectionLeftX'],[9,'var4','pasteFailure'],[10,'var5','selectionWidth'],[11,'var6','obfuscationControl'],[12,'var7','clipboardContents'],[13,'var8','clipboardText']]],
 ['hd','a(IILjava/lang/Object;BI)Lwo;',[[0,'var6','task'],[1,'var7','guardRemainder'],[3,'var7_ref_Object','serviceMonitor']]],
 ['np','a(IIIBI)V',[[0,'var10','itemIndex'],[1,'var6','popupWidth'],[2,'var7','measurementIndex'],[3,'var8','itemWidth'],[4,'var9','popupY'],[5,'var11','obfuscationControl'],[6,'var7Lifetime1','popupHeight'],[7,'var8Lifetime1','popupX']]],
 ['np','a(BZ)I',[[0,'var3','itemIndex'],[1,'var4','obfuscationControl']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed text navigation, synchronized task enqueue or popup measurement/polling at this exact declaration.');
field('nf','Lb','Lje;','iconComponent','Optional sprite child created from the icon style.');
field('nf','Ob','Lje;','textComponent','Optional text child created from the text style.');
constructorParameters('nf','(JLje;Lje;Lje;Lwk;Ljava/lang/String;)V',['key','style','iconStyle','textStyle','icon','text'],'Creates optional icon/text children and enables inherited visual state on descendants.');
method('nf','a','(BII)V','layoutContent','Measures icon/text widths within available width, applies horizontal alignment and positions the two children.',{0:'obfuscationGuard',1:'iconTextGap',2:'padding'});
method('nf','a','(IIIIIII)V','setLayout','Sets component bounds and then lays out icon/text content.',{0:'height',1:'padding',2:'obfuscationGuard',3:'width',4:'y',5:'x',6:'iconTextGap'});
for(const [original,type,to] of [['Ub','[I','phraseIds'],['Sb','I','menuHeight'],['Yb','I','collapseTicks'],['Qb','I','menuWidth'],['Pb','I','openItemIndex'],['Vb','[Lnf;','items'],['Tb','I','itemCount'],['Zb','I','animationAnchorY'],['Ib','I','rowHeight'],['Ob','Lmq;','activeSubmenu'],['Kb','[C','shortcuts'],['Rb','[Lmq;','submenus'],['Jb','I','contentWidth']])
 field('mq',original,type,to,'Quick-chat constructor retains ID/shortcut/submenu arrays, constructs item components and drives layout, collapse and submenu navigation.');
constructorParameters('mq','(JLje;Lje;Lje;[Lmq;[I[Ljava/lang/String;[C)V',['key','style','itemStyle','textStyle','submenus','phraseIds','labels','shortcuts'],'Retains supplied arrays and mutates labels with shortcut markup before constructing item components.');
method('mq','b','(IIIIII)V','layoutMenu','Computes padded menu bounds, positions rows and recursively places an open submenu against the available bottom edge.',{0:'padding',1:'iconTextGap',2:'bottomY',3:'x',4:'animationAnchorY',5:'obfuscationGuard'});
method('mq','d','(B)Z','hasPressedItem','Checks item press state, then delegates to an active submenu.',{0:'obfuscationGuard'});
method('mq','a','(ZII)Z','handleKeyboard','Delegates to an active submenu or activates the first matching shortcut; preserves internal key-85 navigation and custom-key substitution.',{0:'obfuscationGuard',1:'selectionContext',2:'messageContext'});
method('mq','f','(B)V','resetSelection','Clears item press/selection state, recursively resets/unlinks the active submenu and starts twelve collapse ticks.',{0:'obfuscationGuard'});
method('mq','a','(IIII)V','activateItem','Toggles an existing open item, opens a submenu or dispatches the selected phrase/custom-message path.',{0:'messageContext',1:'obfuscationGuard',2:'itemIndex',3:'selectionContext'});
method('mq','c','(II)V','setCollapseTicks','Sets the original quadratic row interpolation using ticks squared over 144 without clamping.',{0:'ticks',1:'obfuscationGuard'});
method('mq','a','(IBI)V','advanceMenu','Handles pressed items/submenus and decrements positive collapse ticks.',{0:'selectionContext',1:'obfuscationGuard',2:'messageContext'});
method('mq','e','(B)I','getOpenMenuWidth','Returns this laid-out width plus the active submenu width recursively.',{0:'obfuscationGuard'});
field('s','c','Lwk;','quickChatArrow','Quick-chat menu constructors use its canvas width and attach it to submenu/custom-message rows.');
for(const [owner,signature,names] of [
 ['je','a(ZIII)V',[[0,'var10_ref_je','child'],[1,'var9','stackEndY'],[2,'var11','obfuscationControl'],[3,'var9Lifetime1','maximumTargetScroll'],[4,'var5','currentScroll'],[5,'var6','targetScroll'],[6,'var7','currentHeight'],[7,'var8','targetHeight'],[8,'var10','maximumCurrentScroll']]],
 ['je','a(ZZIIII)V',[[0,'stackIn_30_1','pointerInsideClip'],[1,'stackIn_38_1','buttonMatches'],[2,'var7','xStep'],[3,'var8','savedClipLeft'],[4,'var9','savedClipTop'],[5,'var10','savedClipRight'],[6,'var11','savedClipBottom'],[7,'var12','pressCaptured'],[8,'var13','child'],[9,'var14','obfuscationControl'],[10,'var7Lifetime1','yStep'],[11,'var7Lifetime2','widthStep'],[12,'var7Lifetime3','heightStep']]],
 ['ll','a(IIII)V',[[0,'var5','upButtonHeight'],[1,'var6','downButtonY'],[2,'var9','nonpositiveContentOverflow'],[3,'var10','nonpositiveContentTravel'],[4,'var11','nonpositiveContentThumbY'],[5,'var12','nonpositiveContentSplitY'],[6,'var14','nonpositiveContentUpButton'],[7,'var15','nonpositiveContentDownButton'],[8,'var16','nonpositiveContentTrack'],[9,'var17','nonpositiveContentPageUpArea'],[10,'var18','nonpositiveContentPageDownArea'],[11,'var19','nonpositiveContentThumb'],[12,'var14Lifetime1','upButton'],[13,'var15Lifetime1','downButton'],[14,'var16Lifetime1','track'],[15,'var17Lifetime1','pageUpArea'],[16,'var18Lifetime1','pageDownArea'],[17,'var19Lifetime1','thumb'],[18,'var9Lifetime1','scrollOverflow'],[19,'var10Lifetime1','thumbTravel'],[20,'var11Lifetime1','thumbY'],[21,'var12Lifetime1','trackSplitY'],[22,'var7','trackHeight'],[23,'var8','thumbHeight']]],
 ['ll','a(IZII)I',[[0,'var5','scrollOffset'],[1,'var6','thumbTravel'],[2,'var7','thumbY'],[3,'var8','scrollOverflow']]],
 ['mq','c(II)V',[[0,'var6','itemIndex'],[1,'var4','expandedY'],[2,'var5','ticksSquared'],[3,'var7','obfuscationControl'],[4,'var3','guardRemainder']]],
 ['mq','<init>(JLje;Lje;Lje;[Lmq;[I[Ljava/lang/String;[C)V',[[0,'var13','itemIndex'],[18,'var11','shortcutPrefix'],[19,'var12','shortcutSuffix'],[20,'var14','arrow'],[21,'var15','labelWidth'],[22,'var17','measurementFont'],[23,'var18','rowFont']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed client UI geometry/input, scrollbar proportional layout/drag conversion or quick-chat row construction at this exact local declaration.');
for(const [owner,signature,names] of [
 ['va','a(BLvh;I)V',[[10,'var4_int','guardRemainder'],[12,'var5','entryCount'],[13,'var6','entryIndex'],[14,'var7','encodedShortcut'],[15,'var8','obfuscationControl']]],
 ['va','a(BLvh;)V',[[0,'var3_int','opcode'],[1,'var4','obfuscationControl']]],
 ['ar','a(BILvh;)V',[[1,'var9','argumentIndex'],[6,'var4_int','guardRemainder'],[8,'var5','entryCount'],[9,'var6','entryIndex'],[10,'var7','commandId'],[11,'var8','command'],[12,'var10','obfuscationControl']]],
 ['ar','a(Lvh;B)V',[[0,'var3_int','opcode'],[1,'var4','obfuscationControl']]],
 ['bl','a(IZ)Lva;',[[0,'var4','encodedCategory'],[1,'var3','category']]],
 ['rf','a(II)Lar;',[[0,'var5','encodedPhrase'],[1,'var4','guardRemainder'],[2,'var3','cachedPhrase'],[3,'var6','phrase']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed quick-chat opcode decoding, paired arrays, command argument rows and cached local/global archive lookup at this exact declaration.');
for(const [owner,signature,names] of [
 ['ri','a(JB)Ljava/lang/Object;',[[0,'var6','promotedEntry'],[1,'var7','entry'],[2,'var6Lifetime1','guardedPromotedEntry'],[3,'var5','value']]],
 ['ri','a(Ljava/lang/Object;BIJ)V',[[0,'var9','evictedEntry'],[1,'var7','newEntry'],[2,'var8','obfuscationControl'],[3,'var6_int','guardRemainder']]],
 ['m','a(IJ)Ltc;',[[0,'var4','bucket'],[1,'var5','match'],[2,'var6','obfuscationControl'],[3,'var4Lifetime1','guardedBucket'],[4,'var5Lifetime1','guardedMatch']]],
 ['tl','next()Ljava/lang/Object;',[[0,'fieldTemp$0','bucketIndex'],[1,'var2','obfuscationControl'],[2,'var3','firstInBucket'],[3,'var4','nextNode']]],
 ['tl','hasNext()Z',[[0,'fieldTemp$0','bucketIndex'],[1,'var2','obfuscationControl']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed cache promotion/eviction and independent hash-bucket traversal at this exact local declaration.');
for(const [owner,original,type,to] of [
 ['lf','q','Lpq;','pointerInputHandler'],['nh','B','I','livePointerX'],['kl','i','I','livePointerY'],
 ['av','a','I','pointerIdleTicks'],['ku','I','Z','pointerChanged'],['lk','f','Z','pointerChangedSnapshot'],
 ['ob','J','I','heldPointerButton'],['ro','ub','I','pointerButton'],['jm','k','I','pressedPointerButton'],
 ['tr','A','I','pointerPressButton'],['mq','Xb','I','lastPointerPressX'],['ei','d','I','lastPointerPressY'],
 ['iu','t','I','pointerPressX'],['ur','z','I','pointerPressY'],['tb','g','I','livePointerButtonMask'],['eq','l','I','pointerButtonMask'],
])field(owner,original,type,to,'AWT PointerInputHandler writes live state; capturePointerInput snapshots it under the same handler monitor. Held/pressed button codes are 0 none, 1 non-right and 2 right, separate from the three-bit button mask.');
method('ds','a','(B)V','capturePointerInput','Copies held button/position/change state, increments idle ticks and consumes pending press/change state under the handler monitor; preserves partial copies on bad-guard failure.',{0:'obfuscationGuard'});
for(const name of ['mouseMoved','mouseDragged','mouseEntered','mouseExited','mousePressed','mouseReleased','mouseClicked','focusGained','focusLost']){
 const descriptor=name.startsWith('focus')?'(Ljava/awt/event/FocusEvent;)V':'(Ljava/awt/event/MouseEvent;)V';
 members[`P:pq.${name}${descriptor}#0`]={to:'event',evidence:'Standard AWT callback retains its external method name and receives this event.'};
}
for(const [owner,signature,names] of [
 ['at','a(I)Ltc;',[[0,'var2','guardedFirstNode'],[1,'var2Lifetime1','firstNode']]],
 ['at','d(B)Ltc;',[[0,'var2','guardedLastNode'],[1,'var2Lifetime1','lastNode']]],
 ['at','c(B)Ltc;',[[0,'var2','lastNode']]],
 ['at','b(B)Ltc;',[[0,'var2','previousNode'],[1,'var3','guardRemainder']]],
 ['at','b(I)V',[[0,'var2','firstNode'],[1,'var3','obfuscationControl'],[2,'var4','nullNode']]],
 ['at','b(Z)I',[[0,'var2','count'],[1,'var3','node'],[2,'var3Lifetime1','guardedNode'],[3,'var2Lifetime1','guardedCount']]],
 ['at','a(Ltc;Lat;I)V',[[0,'var4','oldTail'],[2,'var5','guardRemainder']]],
 ['wg','a(Z)Lms;',[[0,'var2','firstNode']]],
 ['sp','next()Ljava/lang/Object;',[[0,'var1','nextNode']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Reviewed primary/secondary link traversal, suffix splicing, count and removal data flow at this exact local declaration.');
for(const [owner,signature,names] of [
 ['ja','a(ILja;)Z',[[0,'var3_int','otherCenterX'],[2,'var4','otherCenterY'],[3,'var5','centerX'],[4,'var6','centerY'],[5,'var7','squaredDeltaX'],[6,'var8','squaredDeltaY']]],
 ['ja','b(ILja;)I',[[0,'var3_int','otherCenterX'],[2,'var4','otherCenterY'],[3,'var5','centerX'],[4,'var6','centerY'],[5,'var7','deltaX'],[6,'var8','deltaY']]],
 ['ja','a(IB)I',[[0,'var3','centerX'],[1,'var4','centerY']]],
 ['ja','a(IIB)Z',[[0,'var5','guardedCenterY'],[1,'var4','centerX'],[2,'var5Lifetime1','centerY']]],
 ['v','a(IIIII)I',[[6,'var6','adjustedVelocity'],[7,'var7','velocityDirection'],[8,'var8','targetDirection'],[9,'var9','reversing'],[10,'var10','atSpeedLimit'],[11,'var11','braking'],[12,'var12','canAccelerate'],[13,'var13','belowSpeedLimit'],[14,'var14','obfuscationControl']]],
 ['v','a(BII)Z',[[0,'var6','obfuscationControl'],[1,'var4','remainingSpeed'],[2,'var5','stoppingDistance']]],
 ['v','b(BI)Z',[[0,'var3','targetX'],[1,'var4','targetY'],[2,'var5','deltaX'],[3,'var6','deltaY'],[4,'var7','speedLimit'],[5,'var8','acceleration']]],
 ['ic','j(I)V',[[19,'var2','controlledUnits'],[21,'var3_ref_jd','controlledUnit'],[22,'var3','playerIndex'],[23,'var4','controlledUnitGrouped'],[24,'var4_ref_at','otherPlayerUnits'],[25,'var5','controlledUnitTarget'],[26,'var5_ref','landmarkTile'],[27,'var5_ref2','otherUnit'],[28,'var6','otherUnitGrouped'],[29,'var7','otherUnitTarget'],[30,'var8','obfuscationControl'],[31,'var7Lifetime1','landmarkTarget'],[38,'var3Lifetime1','tileX'],[39,'var4Lifetime1','tileY'],[40,'var6Lifetime1','landmarkGrouped']]],
 ['ic','d(B)V',[[17,'var2_int','directionKeysEnabled'],[19,'var3','manualCameraMovement'],[20,'var4_int','cameraPlayerIndex'],[21,'var4','overviewTarget'],[22,'var5','overviewVelocitySettled'],[23,'var6','nearestTarget'],[24,'var7','candidateTarget'],[25,'var8','candidateDistance'],[26,'var9','obfuscationControl'],[27,'var5Lifetime1','nearestDistance']]],
])for(const [ordinal,originalName,to] of names)local(owner,signature,ordinal,originalName,to,'Camera overview grouping, centroid arithmetic, smoothing phases and manual/automatic target traversal at this exact local declaration.');

const workflowFiles=['build-armiesofgielinor-rules.mjs','reproduce-armiesofgielinor.mjs','reconstruct-armies-methods.mjs',
  'tests/test-armiesofgielinor-core.mjs','tests/archive-index-probe.mjs','game-export.mjs','compilation-stubs.mjs'];
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
    'Widget, WidgetPainter, DropdownSelector, DropdownOptionList and DropdownArrowPainter expose the shared UI bounds and dropdown flow. Controlled fixtures check half-open base hit bounds, case-insensitive first-prefix matching, option validation/selection and the arrow painter’s pixels. The option-list hit override retains its different inclusive edges; complete interactive menu behavior remains unverified.','',
    '| Start here | Follow |','| --- | --- |',
    `| ${link('je')} / ${link('nf')} / ${link('mq')} | Client UI style/layout/input, icon/text composition and quick-chat menu navigation. |`,
    `| ${link('ll')} / ${link('dn')} | Scrollbar geometry, held-button repeat, draggable thumb and clipped scrolling content. |`,
    `| ${link('dp')} / ${link('np')} | Editable text, selection/clipboard lifecycle and popup action rows. |`,
    `| ${link('hd')} / ${link('wo')} | FIFO platform requests and asynchronous status/results. |`,
    `| ${link('au')} / ${link('of')} / ${link('tp')} | Lobby room/player records, secondary-key indexes and ordered display lists. |`,
    `| ${link('ml')} | Retained tab panels, integer tab geometry and active-panel switching. |`,
    `| ${link('tg')} / ${link('mo')} | Context targets, lobby/social/chat dispatch and retained chat-message identity/text/filter state. |`,
    `| ${link('i')} / ${link('fp')} | Abuse-report rule/name/mute controls and icon/label composition. |`,
    `| ${link('hl')} / ${link('k')} | Shared friend/ignore rows, canonical lookup keys and name validation. |`,
    `| ${link('mp')} / ${link('oc')} | Scrollable social-list buttons and anchored account-name entry prompt. |`,
    `| ${link('dq')} | Huffman symbol lengths/code words, compressed chat text and bounded decode traversal. |`,
    `| ${link('va')} / ${link('ar')} / ${link('me')} | Quick-chat category/phrase decoding, shortcuts and command definition arguments. |`,
    `| ${link('bl')} / ${link('rf')} | Local/global quick-chat archives and cached definition lookup. |`,
    `| ${link('ri')} / ${link('uq')} / ${link('f')} | Weighted retained values, LRU eviction and reference-backed entry promotion. |`,
    `| ${link('m')} / ${link('tl')} | Iterable key buckets, duplicate keys and removable bucket traversal. |`,
    `| ${link('at')} / ${link('bb')} / ${link('wg')} / ${link('sp')} | Intrusive queues, independent traversal and secondary-link iteration. |`,
    `| ${link('pq')} | Live AWT pointer input; ds.capturePointerInput copies state for gameplay/menu consumers. |`,
    `| ${link('v')} / ${link('ja')} | Camera projection, input, smoothing and grouped overview targets. |`,
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
    `| ${link('ub')} / ${link('jr')} / ${link('eu')} | Portal summon choices, circular hit tests, campaign unlock filtering and unit-selection cycling. |`,
    `| ${link('sj')} / ${link('uf')} / ${link('iu')} / ${link('gb')} / ${link('eo')} | Turn timer, spell confirmation, battle/equipment tutorial hints and visible unit-model refresh. |`,
    `| ${link('hm')} → ${link('cm')} / ${link('ho')} | Player inventory/rune accounting and versioned campaign results. |`,
    `| ${link('kl')} → ${link('ew')} / ${link('bm')} / ${link('jm')} / ${link('lr')} | Resource loading, versioned archive indexes and group/file name lookup. |`,
    `| ${link('mg')} / ${link('cj')} | Retained direct-buffer storage, byte-array copying and archive payload lifetime. |`,
    `| ${link('js')} → ${link('kk')} / ${link('gd')} / ${link('wi')} / ${link('kg')} | Mesh decoding, face/vertex normals, skin grouping and retained render geometry. |`,
    `| ${link('wp')} → ${link('ht')} / ${link('ig')} | Animation frame loading, sparse transform decoding and shared skeleton slots. |`,
    `| ${link('tm')} → ${link('lh')} | Triangle rasterization, clip/scanline state and texture queries. |`,
    `| ${link('wq')} / ${link('v')} / ${link('hr')} | Fixed-point rotations, isometric camera projection and battle-model positioning/lifetime. |`,
    `| ${link('cf')} / ${link('sd')} / ${link('ln')} / ${link('fu')} | Campaign/participant metadata, loadouts, reward previews, shared unit overrides and coats of arms. |`,
    `| ${link('bp')} → ${link('ae')} / ${link('jf')} / ${link('hi')} | Resource request lanes, socket protocol, padded responses and buffered transport. |`,
    `| ${link('vo')} → ${link('nh')} / ${link('bc')} / ${link('ue')} / ${link('ei')} | Disk-cache requests, sector storage and buffered/bounded file access. |`,
    `| ${link('ms')} / ${link('ui')} / ${link('ks')} | Independent secondary links, request queues and pending data/progress contracts. |`,
    `| ${link('sl')} | Versioned quicksave header, snapshot chunks, stored mana and campaign damage/loss state. |`,
    `| ${link('pr')} → ${link('a')} / ${link('ru')} / ${link('si')} / ${link('qg')} | Palette region indexing, marker anchors, pixel lookup and indexed sprites. |`,
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
    'PaletteRegionMap assigns one region per encountered palette index, even when colours repeat or a region is disconnected. Marker-colour pixels attach to the latest region in row-major order; markers before any region belong to region -1. IndexedSprite/IndexedSpriteBase and RgbSprite expose full canvas bounds, pixel dimensions, offsets and retained palette/pixel arrays. Normal draw/conversion and selected-region rendering mask byte indices to unsigned values, while getRegionAt and extraction retain signed indexing. Alpha drawing retains arithmetic-shift sign extension of blended 24-bit colours. Region extraction also retains its omitted rightmost column and original padded offsets. These naming changes document and probe the existing decompiled behavior rather than repairing rendering semantics.', '',
    'CampaignQuicksave stores campaign/mission IDs, unsigned-short damage, a unit-loss flag, snapshot bytes and versioned extra state. Header versions above 7 carry mana values; versions above 8 also carry an eliminated-player mask. Only snapshot lengths 1 through 99999 allocate data. Streaming construction leaves receivedBytes at zero; eager construction reads all bytes and retains -1. appendSnapshotChunk consumes bytes even for noncanonical guards, which report completion without advancing the receive offset. Current serialization always writes the latest header and carries no embedded format-version byte. Quicksave deletion retains the original mode gate and opcode 81; upload uses opcode 80. Gameplay restoration names damageTakenByPlayer and unitLossCounts, while a save preserves only whether the loss count was positive. Codec fixtures do not establish full gameplay restoration or server compatibility.', '',
    'submitCampaignResult updates the menu before comparing profile scores. It stores turns/damage and emits opcode 79 only for an improved candidate score or score 1; profile scores are subsequently calculated from those metrics, not stored as the candidate score. Every permitted submission then requests quicksave deletion, even without a result packet. The result carries campaign/mission IDs, score, turns, damage, loss flag and four campaignPacketWord integers. The words name packet positions only: their server validation meaning remains unresolved. reportCampaignTurn emits an opcode-16, type-zero record keyed by campaignIndex*1000+missionId. trackCampaignMetrics keeps XOR-996394 checkpoints, rejects decreases and preserves the original pointer-selected arithmetic mutations.', '',
    'DiskCacheWorker dispatches queued writes (2) and reads (3); immediate reads (1) reuse the first queued write for the same store/key or read synchronously. Queued writes retain caller arrays, and queuedCount excludes the operation already in flight. ResourceRequest.pending is volatile; disk access rejects pending data reads and reports progress as 0/100. requestFlag deliberately remains qualified because finer priority/cache semantics are unresolved. DualLinkedNode keeps primary and secondary memberships independent, and its setter rejects key changes while secondary-linked. SectorCacheStore uses six-byte index records and 520-byte data sectors: IDs up to 65535 use an eight-byte header with 512 payload bytes, larger IDs a ten-byte header with 510 bytes. The pinned decompiled writer retains a 512-byte next-link cutoff even for large-ID sectors with 510 payload bytes: 511/512-byte writes can report success but read back as null. The original gamepack bytecode confirms the same cutoff at bc.a(I[BZIB)Z offsets 766-780 and the 510-byte cap at 1087-1098; its 542-class identity matches the pinned original classes. BufferedFile and BoundedFile retain cached/pending I/O, length tracking, guard behavior and overflow/error paths. Controlled disk probes bypass the service launcher and exercise the real worker on owned temporary files, not full game asset loading.', '',
    'NetworkResourceRequest exposes padding, response bytes and block position. ResourceProtocolClient maintains queued/in-flight priority and normal lanes capped separately at twenty; SocketResourceClient sends six-byte request records and assembles padded responses from ten-byte headers and 512-byte transport blocks. Response flag 128 selects the normal lane, while the lower seven bits select compression. A nonzero xorByte decodes received bytes. Network getBytes retains the padded array and rejects pending/incomplete data; getProgress uses signed padding and is not clamped to 100. Controlled stream fixtures bypass real sockets and the thread launcher; they do not establish live server compatibility.', '',
    'Common-client packet reception names pendingOpcode, deliveredOpcode, the three prior-opcode slots and packetPayloadLength. pollIncomingPacket requires connectedState and frames fixed, one-byte-length and two-byte-length payloads across partial reads. DelayedPacket retains opcode, payload and releaseAtMillis; packetDelayMillis and Gaussian packetJitterMillis determine a clamped delay. Delivery requires now > releaseAtMillis and retains FIFO ordering. Fixtures cover byte-at-a-time reception, encrypted opcode bytes, length headers, payload copying, delayed queues, non-finite jitter casts and failure wrapping. These controlled streams do not establish live multiplayer compatibility.', '',
    'CameraOverviewTarget clusters controlled units, movement-flag-1 units from other players and portal/modifier-flag landmarks. Integer sums and centroids retain wrapping and truncation; containsTile uses inclusive two-tile bounds, while isNearTarget uses a narrower cross-shaped squared-distance test. The camera visits each target, starts its forty-call hold when velocity settles, removes nearby targets and promotes the nearest remaining one. adjustAxisVelocity exposes seven-eighths braking and one-eighth reversal damping. handleInput applies dragging before directional panning; suspendInertia retains velocity without moving when no direction is requested. moveTowardTile reports zero velocity, which can occur before arrival at maximum speed one. Native fixtures preserve that edge case, integer wrapping, guard side effects and partial failures. The map-width-based world clamp and constructor pre-assignment dimensions remain unchanged; these controlled checks do not prove rendered camera behavior.', '',
    'NodeDeque names popFirst/popLast, clear, size, isEmpty, reverse traversal, explicit traversal starts and suffix/full-chain transfers. Transfers preserve node identity and append in order without resetting retained cursors. Independent NodeIterator cursors continue after their returned node is unlinked; supplied start nodes are not ownership-checked. Guard effects remain: size(true) on a nonempty deque detaches the first node then throws with stale node links, clear with guard <=74 empties the deque before failing, and moveAllTo(false, destination) transfers nodes before its failure. IterableDualNodeDeque and DualNodeIterator use independent secondary links, so removal leaves primary membership intact. Their iterator returns null at first exhaustion, then hasNext reports true and another next fails; this original nonstandard behavior is preserved. Native list-model sequences and explicit partial-failure probes verify these contracts.', '',
    'PointerInputHandler exposes the synchronized AWT mouse callbacks and retained live coordinates, button codes, press coordinates, change flag and button mask. ds.capturePointerInput copies held/pressed state under the same monitor, increments pointerIdleTicks and consumes the pending press/change flags. The held/pressed codes collapse non-right buttons to one and right to two, while the old modifier mask keeps three independent bits. Focus loss clears the held button; exiting uses coordinates -1/-1. Popup events are consumed even on the original disabled-handler paths. isPointerInBounds has inclusive edges and does not normalize reversed bounds. Native AWT events verify movement, drag, enter/exit, presses/releases, popup consumption, snapshots and the retained partial-update guard failure. These headless callbacks do not prove browser input delivery or rendered UI interaction.', '',
    'WeightedLruCache separates capacity/remainingCapacity, hash entries and secondary lruEntries. put inserts a weight-one StrongCacheEntry; putWeighted replaces the key, reserves weight and evicts oldest entries until it fits. get refreshes LRU order and secondaryKey, removes/refunds entries with null values, and replaces a reference-backed entry with a strong entry retaining the same value/weight. CacheEntry.isReferenceBacked describes that virtual branch without assuming a soft/weak GC mechanism: only StrongCacheEntry exists in this export, and promotion/removal fixtures supply a controlled subclass. Independent bounded LinkedHashMap models compare LRU order, values, entry count and remaining capacity. Zero/negative weights remain accepted; oversized entries fail before replacing the old value. A bad insertion guard retains the reserved capacity after removing the previous entry. Constructor bucket doubling can exceed bucketGrowthLimit by one power-of-two step. These source behaviors are documented and tested, not repaired.', '',
    'IterableNodeHashTable keeps duplicate keys in insertion order within each masked bucket and does not require power-of-two bucket counts. Moving a node changes only its primary membership. NodeHashIterator scans buckets independently of lookupNext; hasNext advances across empty buckets. Removal unlinks its last returned primary node, and repeated next calls at exhaustion return null. Native fixtures cover negative/large keys, collisions, duplicates, non-power-of-two counts, moves, independent iterators and zero-bucket lookup failure.', '',
    'QuickChatCategory stores title, subcategoryIds, phraseIds and parallel shortcut arrays. Opcode four marks isRootCategory; findQuickChatRootCategory scans upward until that flag is found. Shortcut zero remains zero; nonzero bytes use the original single-byte character table, including ? for undefined extension bytes. QuickChatPhrase splits text on <, previews fragment joins with ellipses, and stores linkedPhraseIds plus commandIds/commandArguments. The fourteen-entry QuickChatCommandDefinition registry supplies argument counts; its two other constructor integers are unused. Unknown command IDs retain zero/null rows and consume no argument bytes. The finer meaning of linked phrase lists remains unresolved.', '',
    'QuickChatCategoryRepository reads archive group zero and QuickChatPhraseRepository group one. IDs >=32768 select globalArchive with a masked fifteen-bit file ID, while the full requested ID remains the cache key. applyGlobalIds ORs bit 32768 into linked definition IDs; repeated application is idempotent. Missing files produce cached default definitions. addCustomQuickChatOption replaces root phrase choices with ID -1 and shortcut ?. Controlled real archive/index fixtures verify local/global routing, missing defaults, caching and root lookup; direct wire fixtures check every shortcut byte, phrase delimiters, command rows, unknown opcodes/commands and partial decode/guard failures. They do not establish rendered quick-chat UI or live message delivery.', '',
    'ClientUiNode/ClientUiComponent name the separate linked client UI hierarchy, with local/screen bounds, pending geometry deltas, text/font/sprite, children, alignment and pointer state. applyStyle overlays nondefault values and shares object references; a default style does not reset retained font/opacity. IconTextComponent composes optional icon/text children and lays out measured content. Native constructor/measurement probes verify retained style values, child moves, visual-state inheritance and icon/text placement. Input probes use the real SoftwareRaster clipping code and half-open hit bounds. heldButtonMatches keeps the original hovered zero-button equality case. Full rendered client UI remains unverified.', '',
    'VerticalScrollbar and ScrollContainer name arrow/page buttons, the two track halves, draggable thumb, proportional sizing, shared repeat countdown, viewport and retained content. Native fixtures verify short/empty scrollbars, rounded drag conversion, both clamp orders, initial delay 20/repeat delay 3, shared repeat state, page hit boundaries, wheel/arrow input and drag precedence over pending scroll. Negative content overflow retains the clamp-order difference. ClientUiComponent now names state-specific skins/sprites/colours/offsets, text and sprite opacity, focus, signed ceiling-quarter geometry easing, vertical stacking and drag grabs. inheritParentVisualState corrects the earlier misleading clip name: selected/held visual state is inherited, but child bounds still intersect the raster clip. Real sprite pixels verify state precedence, inherited selection and child clipping. Text/skin pixel rendering and a complete interactive scrolling session remain unverified.', '',
    'EditableTextField retains a mutable buffer with independent caret/selection anchor, optional maximum length, text/caret/highlight components and queued clipboard task. Typed characters accept ASCII 32–126 except angle brackets; setting text directly retains other characters and markup. A full buffer still consumes an accepted printable character. Native fixtures verify clamped selections, deletion/replacement, internal key navigation, separator boundaries, modifier behavior, text geometry and clipboard request/completion/release. Internal key codes remain numeric: these probes do not establish physical keyboard mappings. Clipboard paste retains its quirks: insertion moves the caret to the complete buffer end, and bounded insertion takes an unconditional remaining-capacity substring. A short paste can therefore delete the old selection before failing; the completion is still released. Pointer double-click/word-drag timing and actual system clipboard delivery remain unverified.', '',
    'PlatformTaskService queues PlatformTask objects under its monitor with retained object arguments, FIFO links and volatile status/result. Status 0 is pending, 1 successful and 2 failed. Enqueue guards retain their existing return/partial-mutation behavior. Controlled queue fixtures inspect clipboard, thread, reflection, socket and URL request payloads without executing network or system-clipboard requests. A real worker services reflection lookups, records missing/unknown request failures, drains its queue and stops. The service constructor is bypassed so cache/property/fullscreen setup and networking remain unverified.', '',
    'ContextActionMenu retains up to 256 icon/text rows and action IDs, measures a popup against raster bounds, inserts an empty placeholder and polls clipped row presses. Result -2 means waiting and -1 means cancellation/no action; internal key 13 cancels while returning true on its first waiting check. Native fixtures verify text/icon measurement, popup placement, half-open row edges, any nonzero press button, capture-disabled polling, cancellation, empty rows and retained capacity after overflow. Complete rendered menu interaction and action dispatch remain unverified.', '',
    'LobbyRoom and LobbyPlayer separate room identity/admission/options from account/display names, player rating/unlocks and invitation/request state. Secondary-key indexes are independent of primary display lists. Native fixtures check all 256 room-header flags, optional player-count retention, options/rating/timing/owner fields and explicit name lists. The first string is retained as ownerName even when names are present; the name-list decoder rewinds to that string. With explicit names and count zero, it leaves the cursor at the name start. The spectator policy is 1/2; room bit 32 is rated and bit 64 is playing. Player packedFlag0 remains unresolved. Existing player names update only when the middle rename marker is nonempty. These names and fixtures describe the pinned Java rather than proving a live server protocol.', '',
    'QuickChatCategoryRepository.processLobbyUpdate names the otherwise unrelated static lobby dispatcher. Local packet fixtures exercise update types 0–23, room/player indexes, invitation/request transitions, request counts, notification expiry, current-room member reuse/removal, ownership, setup masks and list clearing. Sorted insertion preserves secondary index links; removed records can stay in primary lists until notification expiry. Ordering fixtures retain equal-time false results and distinct play/admission/type priorities. DualNodeHashTable checks duplicate lookup, non-power-of-two masks, independent iteration/lookup, secondary-link moves retaining primary membership and zero-bucket refusal. TabbedPanel retains caller panel arrays, partitions tab width by integer boundaries and hides inactive panels by adding 10000 to X. Native constructor/layout/switch fixtures preserve negative padded widths. Complete rendered lobby interaction and outgoing request delivery remain unverified.', '',
    '| Lobby update type | Retained behavior / payload after the type byte |',
    '| --- | --- |',
    '| 0–4 | Clear current-room members and admission flags; 1 retains the previous owner name, 2/3 retain setup state, 3 reads configured preference masks/options, 4 reads u16 room ID then a room header without player count. |',
    '| 5 | Player u64 ID, account/rename-marker/display strings, i32 activity age, u16 rating, variable integer containing games count shifted left one plus unresolved low flag, u8 chat icon and u8 unlock mask. |',
    '| 6/7 | Remove/update one player by u64 ID plus u8 notification code, or clear all lobby players. |',
    '| 8/9/10 | u16 room ID plus full room header; remove/update room by ID plus u8 code; or clear listed rooms. |',
    '| 11/12/13 | u16 room ID: receive invitation, mark join request sent, or clear both states with a u8 notification code. |',
    '| 14/16 | u64 player ID: mark invitation sent or join requested. |',
    '| 15/17 | u64 player ID plus u8 notification: clear invitation or join request; request-count changes are guarded against repeats. |',
    '| 18/19/20 | Add/update current-room member by u64 ID and name/stats; remove member by ID plus u8 notification; update current-room header without count. |',
    '| 21/22/23 | u16 relative start time (zero clears); u16 plus variable integer status fields; u64 local account ID. Finer type-22 status meaning remains unresolved. |', '',
    'Room headers: optional u8 player count, u8 capacity, u8 game type, u8 flags, configured count of raw option bytes, u16 display rating, i32 activity age, optional i32 completed duration (bit 2), u64 owner ID, then zero-terminated names. Bits 7/6/5/4/3 denote open-to-join/playing/rated/spectator-mode-2/admission-requests; bit 1 supplies the counted name list. No live connection, unknown-type disconnect path or complete malformed lobby packet matrix is verified by these fixtures.', '',
    'ClientContextMenu retains account/display/room/channel metadata, a source component and quick-chat context. Construction selects the source and copies a menu prototype. Admission action IDs 0/1/2/3/10/15/16 write commands 6/7/8/9/10/11/11 respectively. The caller supplies the packet opcode. Exact byte fixtures use real packet/cipher methods with controlled result words, checking opcode wrapping, length framing, offsets, low-sixteen-bit room IDs, sentinel tails and one consumed cipher word per written frame. These are serialization fixtures, not an independent ISAAC algorithm proof. A repeated watched-room ID writes nothing; changing it clears the prior indexed room playerNames cache. Unsupported admission actions return false and leave the buffer unchanged.', '',
    '| Outgoing payload | Byte framing after the caller-supplied ciphered opcode |',
    '| --- | --- |',
    '| Friend / ignore change | u8 length, u8 command 0/1/2/3 (add friend/remove friend/add ignore/remove ignore), zero-terminated supplied account name. Caller opcode is shared by this command family. |',
    '| Text / quick-chat message | u8 length, u8 channel, optional zero-terminated recipient name when the supplied channel equals 2, then either compressed text or the supplied low u16 phrase ID. QuickChatMenu sets phrase bit 15 before calling the writer. |',
    '| Player admission / cancellation | u8 length 9, u8 command 6/7, u64 account ID. Invite/accept and kick/withdraw/reject meaning depends on the current room/player state. |',
    '| Room admission / cancellation / spectating / watch | u8 length 3, u8 command 8/9/10/11, low u16 room ID. Watch action 16 supplies room ID zero. |',
    '| Abuse report (separate opcode) | u8 length, u64 account ID, zero-terminated target name, u8 offence ID, u8 mute flag. No admission command byte is added. |', '',
    'ReportAbuseDialog exposes target/account, rule buttons, optional mute selection and waiting/cancellation. Context action 17 opens this report control; action 19 uses the retained quick-chat context for auto-response. IconLabelControl names selected/unselected icon and label composition and row measurement/layout. Real constructor/getter/cancellation fixtures verify the report control and inherited icon visual state. Abuse-report byte fixtures preserve byte narrowing and NUL-name failure after opcode, reserved length and account ID have already advanced the cursor; the reserved length remains unfilled on that failure. Complete social-action, report-click and rendered-dialog paths remain unverified, and these fixtures never deliver reports or requests to a server.', '',
    'ChatMessage names channel/account/display identity, text/channel label, context ID, optional quick-chat values and row component. The system-message constructor sets systemMessage and zero sender/identity/icon state. Filter priority is 2 for system messages or private-channel messages with an icon, 1 for self or an enabled friend context, otherwise 0; false guard clears displayName. Controlled constructor/self/other/system/icon fixtures and a retained friend-row fixture verify filtering. Duplicate identity-word meanings, decoded-chat snapshots, prefix rendering and complete chat delivery remain unverified.', '',
    'SocialListEntry is shared by friends and ignored accounts, with separate secondary-name indexes and primary display lists. AccountNameNormalizer.normalize trims space/NBSP/underscore/hyphen, checks the trimmed span before filtering (1–12 characters), drops unsupported characters and folds the fixed alphabet. Sharp-s folds to b. Social request validation separately rejects unsupported original characters and trailing separators. Name lookup scans all equal-hash entries; ignored-account lookup falls back to exact raw names when no canonical key exists. Native fixtures cover canonicalization, actual equal-hash names an/c0, renamed row reuse/reindexing and friend-aware chat filtering.', '',
    '| Incoming social subtype | Payload after subtype byte |',
    '| --- | --- |',
    '| 0 | u8 separate-account-name flag (only 1 is true), zero-terminated display name, optional account name, previous display name. Adds/updates ignored-account row. |',
    '| 1 | Zero-terminated location label (empty means offline), current display name and previous display name. Adds/updates friend row, interns the location and reorders the display list. |',
    '| 2/3 | No further payload; 2 changes state 1 to 2, 3 changes state 2 to 1. Other states stay unchanged. |',
    '| 4 | Zero-terminated current location label and u8 packed chat filters. Sets state 1, interns the location and applies the original filter masks/clamps. |', '',
    'Friend ordering uses order-index difference plus ±200 biases for reference-identical current-location labels and null/offline labels. The reference comparison is preserved: equal text in a different String object does not get the same-location bias. Incoming records intern labels. Removing a friend immediately unlinks both memberships, decrements friendCount and subtracts one from each later displayed row orderIndex, even when sorting makes that index negative. Removing an ignored account immediately unlinks/decrements without renumbering survivors; display-name lookup and the account name written to the packet remain separate. Adds leave local rows unchanged pending an incoming update. Guarded partial frames, rejection without writes, free/entitled friend limits of 100/200, ignore limit 100 and reset of both indexes/lists are tested. Live delivery, unknown-subtype disconnects, the complete malformed social packet matrix and rendered list controls remain unverified.', '',
    'SocialListPanel exposes listContent, scrollContainer and add/remove buttons. Native constructors and geometry fixtures verify prototype copying and integer width splitting, including odd widths and gaps. AccountNamePrompt exposes instructions/input components, nameBuffer and pendingResult (0 waiting, 1 cancelled, 2 submitted). Its legacy single-key path lowercases ASCII, maps an interior space to underscore, caps input at twelve characters and retains a trailing underscore on submission; modern pollInput remains a distinct path. Legacy key fixtures verify leading-space suppression, backspace, limit, submit/cancel and ignoring keys after completion. Full modern queued-key/outside-click and rendered prompt sessions remain unverified.', '',
    'HuffmanCodec retains its input code-length array, high-bit-aligned symbolCodes and decodeTrie. Independent packed-bit fixtures cover two mixed-length prefix trees, 32-bit codes and an eight-bit identity table, with input/output offsets, empty input, missing symbols and untouched tails. Text encoding uses the client single-byte alphabet: supported CP1252 characters map to their byte slots, while unsupported UTF-16 code units and NUL become question marks. The decoder skips zero bytes. Compressed text starts with unsigned-smart decoded length, followed by MSB-first Huffman bytes. Unsigned-smart lengths use one byte below 128 and a high-bit-marked short above. readCompressedChatText clamps the requested decoded count and advances only over compressed bytes needed for that count; it can leave compressed bytes from the original message unread. Its Cabbage fallback retains length-header consumption after a missing-codebook or truncated-data failure. These fixtures use synthetic codebooks and do not prove the original loaded chat codebook or a complete malformed-data matrix.', '',
    'Chat composition now names outgoingChatChannel, recipient name/key/account, textChatActive, active/default quick-chat menus and the last quick-chat replay record. Private text selection sets channel 2 and the canonical recipient key. Private/public quick-chat selection installs the default menu; installation replaces host children, while a null menu changes nothing. Response menus require a supplied phrase-ID array; private targets additionally need an online friend or current-room membership. Channel 1 is remapped to 0 when opening responses. Real response-menu fixtures retain the supplied ID array and shortcuts 2, 3; a phrase lookup failure returns no new menu but the caller still changes target state and returns true. rememberLastQuickChat stores replay state; it does not deliver a message. Exact text/phrase byte fixtures verify caller opcodes, private-recipient framing, code-unit replacement, low-sixteen-bit IDs, channel-byte narrowing and NUL-recipient partial writes. Live delivery, replay/throttle timing, complete QuickChatMenu activation/filter-change paths and rendered composition remain unverified.', '',
    'QuickChatMenu retains supplied ID/shortcut/submenu arrays and mutates label entries with shortcut markup. Row height derives from font metrics; setCollapseTicks uses the original unclamped ticks-squared interpolation over 144. Shortcut activation opens a submenu, and internal key code 85 closes it when that child has no deeper open item. resetSelection clears press/selection state and unlinks an active submenu from the overlay. Native fixtures use real menu/item constructors and verify animation, shortcut opening, back navigation and recursive category menu construction. Missing phrase shortcuts start at character 2, then 3; this original numbering is preserved. Selection/message context integer meanings, message dispatch and rendered interaction remain unverified.', '',
    'The naming stage changes identifiers and lexical labels. Its pinned raw input now incorporates three reconstructed method bodies from the generic compiler. Battlefield.eliminatePlayer, AiPlanner.considerEquippedSpell and DropdownArrowPainter.pollIncomingPacket no longer use dispatcher fallbacks. The poller preserves its two protected regions, outside opcode read and shared terminal catch; no statePc dispatchers remain in this export. Large methods remain. More semantic work is needed in combat, spells, AI, tutorial stages and multiplayer packet handling.','',
    'ArchiveIndex decodes formats 5–7: versions 6/7 carry a revision, version 7 uses large-smart integers, and IDs are delta-coded. Names and 64-byte group digests are separate flag-controlled tables. Arrays are indexed by actual group/file IDs, with null fileIds rows representing contiguous IDs. IntKeyLookup linear-probes interleaved key/index slots and returns the first matching input index, including negative and duplicate keys. ResourceArchive lowercases names, exposes index availability, separates packed groups from unpacked files and retains the three existing file-retention modes. CachedArchiveProvider supplies validated indexes and encoded groups from cache/network requests. Independent fixtures cover raw and gzip containers, every version/flag combination, sparse/contiguous/large IDs, checksum and digest-length rejection, name lookup and returned-file retention. This does not establish cache/network end-to-end loading or server compatibility.','',
    'Follow ResourceArchive.getFileWithKeys and unpackGroup: encrypted groups are copied before 32-round XTEA decryption beginning at container offset five. Decompression precedes chunk-table sizing and copying; signed table differences can make later file chunks smaller than earlier ones. Modes zero/one split every file, while mode two extracts only requestedFileId. storeBytes retains or copies arrays through 136 bytes and copies larger payloads to DirectByteStorage; getStoredBytes returns fresh arrays from direct storage. Mode one clears a single-file row after reading; mode two retains the pinned decoder’s null result for an empty file in a multi-file group. Availability methods can report packed bytes without unpacking. Flat access uses archive/file capacities and rejects ambiguous layouts. Independent ciphertext, range/tail, multi-chunk, sparse-ID, reload, copy-boundary and named/flat lookup probes use a controlled ArchiveProvider subclass, while exercising the real archive/index/storage implementation. They do not establish complete cache/network loading or server compatibility.','',
    'RadialSummonMenu and RadialSummonItem expose portal god tabs and summon choices. Menus retain their item arrays and assign integer-truncated circular offsets; pointer tests exclude the circle boundary and retain Java-int wrapping. Duplicate choice IDs return the first item. GameplayController.rebuildSummonMenus filters campaign neutral units and per-god unlock masks, retaining the type-4 to type-74 King Black Dragon substitution before the dragon has been summoned. UnitCycler wraps in both directions and refreshes after unlink; its accessor retains an unlinked selection until traversal validates it, and selectUnit does not enforce deque membership.','',
    'TurnTimerDial displays remainingTurnTicks with a nominal fifty-tick countdown. Its angular sweep moves downward, wraps once and switches its mask on the existing conditions. The nominal tick-rate helper uses the configured tick interval; these probes do not measure presented rendering frames. SpellConfirmationDialog retains selection mode, spell ID and target coordinates. Its inclusive confirm/cancel rectangles remain separated by a central gap. BattleTutorial is the in-battle stage/message/hint controller, distinct from TutorialController. Message hints use stage 34, expansion animates in five-pixel steps, terrain interactions retain their kind mapping, and enemy-wave completion requires both an empty player-one deque and the tutorial portal owned by player zero. BattleUnitRenderer names camera culling and retained model refresh; this pass does not test rasterized unit rendering or a complete tutorial walkthrough.','',
    'EquipmentBattleTutorial follows the Eastbridge battle with specialist-equipment lessons and tracks one of the five equippedSpellIds slots. Its availability gates use player-zero god favour and godUnitUnlockMasks; zero favour locks a choice, while the existing code treats negative favour as nonzero. Selected-unit eligibility retains the spell-specific owner and movement-spent rules for IDs 34/35/36/109. Independent fixtures cover these gates with controlled tables and units; they bypass the tutorial constructor and do not prove its complete scripted sequence.','',
    'AiPlanner.considerEquippedSpell exposes equipped-slot gates, radius-bounded square candidate windows and strategy submission. Damage-spell fixtures cover IDs 47–53, friendly/enemy signs, negative/zero caps, empty cells, border exclusion, skip/guard ordering and nonzero totals. The recording strategy returns no selected candidate, so these fixtures verify candidate generation, not complete AI decisions or live spell execution. submitSpellCandidate names its destination/score/player payload; its equipped-slot argument remains unused.','',
    'MeshObject is the empty instance root of MeshData and ModelMeshBase; ModelMesh is the concrete render mesh. MeshData decodes legacy/extended formats and keeps vertexCount separate from referencedVertexCapacity. calculateNormals lazily accumulates smooth normals or retains a flat FaceNormal at scale 256; repeated indices contribute repeatedly. buildSkinGroups retains ordered index rows and releases the original skin-ID arrays. Copy construction independently shares/copies coordinates, colours, texture IDs and alpha; unshared absent alpha becomes zeros, while indices/groups/normals keep their existing sharing. A hand-encoded legacy triangle and controlled normal/group/copy fixtures exercise the real mesh code. Rasterized mesh drawing and extended-format wire decoding remain untested by this probe.','',

    'AnimationFrameSet resolves archive frame and skeleton dependencies, reuses skeleton objects by ID within a set, and releases encodedFrames after loading. AnimationSkeleton exposes transform types, groups and masks. AnimationFrame decodes sparse signed-smart components, scale defaults of 128, packed eleven-bit rotations, preceding pivot slots and interpolation flags; malformed/trailing input leaves transformCount zero. ModelMeshBase.applyAnimationFrame and blendAnimationFrames interpolate translation/scale linearly, rotations modulo 2048 and hue modulo 64. A second frame is accepted only when it shares the exact skeleton object. A recording mesh verifies the real blend logic and flag gates; a real ModelMesh fixture verifies grouped translation and coordinate storage. ModelMesh.verticesY now identifies the actual coordinate array copied from MeshData; the former incorrectly named field is textureVertexA, paired with textureVertexB/C. Controlled ArchiveProvider fixtures now exercise real frame loading through archive indexes, raw/gzip groups and all three retention modes, including delayed dependencies, sparse IDs and malformed empty frames. Per-set skeleton identity and encoded-byte release are verified. Frame decoder scratch arrays are separate from owned frame arrays; cleanup retains the prior frame and causes subsequent nonempty decoding to fail closed. Live cache/network animation loading remains unverified.','',
    'Mesh group traversal now names pivot averaging, axis rotations, scaling, alpha and packed hue/saturation/lightness. Fixtures cover repeated/missing groups, zero/null masks, signed coordinates, scale zero/negative factors, unsigned alpha clamps and colour wrap/clamps. Masked displacement can use a 3×3 matrix; vertex masks and face masks remain distinct. Slot-selection fixtures retain pivot transforms and distinguish missing frame slots from scale defaults. Bounds fixtures preserve referenced-vertex limits, wrapped square sums and signed-short radii in the pinned source. Matrix-backed rotation/scale and rasterized animation remain unverified.','',
    'TriangleRasterizer names clip dimensions, row offsets, projection centres, trigonometric tables and flat/shaded triangle entry points. Clip fixtures verify offset growth and raster-relative centres. Pixel fixtures draw flat and constant-shade triangles in all six vertex orders with blend values 0, 128 and 255. Independent interior/exterior colour expectations and exact raw/named full-pixel traces check those cases; varying-shade gradients, textured triangles and the full mesh draw path remain unverified.','',
    'BattleCamera names index/grid/world/screen conversions. The pinned forward projection uses mapWidth for its Y offset, while inverse conversion uses mapHeight; rectangular fixtures retain the resulting disagreement. Model anchors retain X+39 and projected Y+3 offsets. presentationOwnsModel connects event claim/completion with model skipping and offscreen retention; event kind 19 retains its special acknowledgement behavior. UnitModelPreview completes immediately when no sequence is available. Unit animation variants use a Random source, scan past unavailable choices and optionally fall back to slot zero. FixedQuaternion uses 16.16 components and a normalized other*this product; its square-root lookup and truncated trigonometric tables retain integer approximation. Mathematical expectations allow bounded rounding differences while raw/named traces compare exact quaternion outputs. These headless probes verify clipping, fallback construction, type-34/flag-8 model substitution and lifecycle state, not presented rendering FPS.','',
    'The exporter compiles both complete corpora and verifies bindings/overrides. A headless raw-versus-named probe checks rectangular map lookup, team membership, unit flags/damage, equipment/ranges, combat payloads, spell serialization, tile metadata, AI candidate selection/recycling, packed move request decoding, prepared action event payloads, combat/cover calculations, team tile effects, summoning permissions, popup animation, match conditions/masks/rankings, structure income, bit/compact codecs, tagged fields/maps, all five event dispatcher categories and unknown categories, concatenated events, stored-unit records, snapshot chunks, spell factories, tutorial layout/selection, spell-menu hierarchy, setup option validation, instruction bounds and preview units, instruction table shapes/navigation, animation decoding/playback, timing pulses and model-preview setters, versioned profiles/campaign results, mission scoring, coats/participants/overrides, campaign loadouts/reward previews, menu entry/neighbor selection, button bounds, hash-table behavior, palette regions/anchors and clipped indexed rendering, versioned quicksave headers/chunks/deletion, campaign result packets/checkpoints/progress records, secondary deque membership and disk sector/worker behavior, resource queue caps/response assembly and forty-bit keys, incoming packet framing/partial reads/delay queues/failure wrapping, camera centroid grouping/holds/smoothing/input, primary/secondary deque transfers and iteration, AWT pointer snapshots/bounds, weighted cache replacement/eviction/refunds/reference promotion and iterable hash buckets, quick-chat definitions/shortcuts/command arguments/local-global routing, client UI composition/clipped input and quick-chat menu layout/navigation, and contextual errors, legacy/version-0/version-1/version-2 map terrain headers and event presentation acknowledgement against independent expectations. It bypasses battlefield construction and the Applet graph; it does not establish whole-game playability, AI quality or server compatibility. Exact dictionary reversal recovers every original source byte.',''].join('\n');
}
export function buildArmiesManifest() {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'armies-naming-rules-'));
  try {
    const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout);
    const record=catalog.publication.games.armiesofgielinor;
    const rules={schema:1,game:'armiesofgielinor',version:38,
      source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/armiesofgielinor'},inputTreeSha256:record.sources.sha256};
    const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary);
    const helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
    captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);
    const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');
    fs.writeFileSync(files,sourceInventory(input).map(file=>file.path).join('\n')+'\n');
    captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);
    const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(line=>line.split('\t'));
    rules.originalBytecodeEvidence={cacheLargeEntryLink:{jarUrl:'https://static.alterorb.net/launcher/v3/jars/armiesofgielinor.jar',jarSha256:'97a2342b166f8d22259eda3e84cd04f30861ea8978d676164e913ccb146f1afa',originalClasses:record.originalClasses,method:'bc.a(I[BZIB)Z',linkCutoff:{offset:766,complementThreshold:-513,zeroNextSectorStore:780},largePayloadCap:{offset:1087,maximum:510},javapDeclaration:'private final boolean a(int, byte[], boolean, int, byte);',instructionChecks:{766:'iload 4',768:'iload 9',770:'isub',771:'iconst_m1',772:'ixor',773:'sipush -513',776:'if_icmplt 782',779:'iconst_0',780:'istore 11',1087:'sipush 510',1090:'iload 12',1092:'if_icmpge 1100',1095:'sipush 510',1098:'istore 12'},conclusion:'Original bytecode clears the next-sector link for remaining bytes <=512 even when large-entry sectors hold only 510 bytes.'}};
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
