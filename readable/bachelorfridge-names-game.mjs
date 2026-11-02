// Reviewed names: the battle model, orders, events, effects and animation nodes.
import {cls, mem, fld, group} from './bachelorfridge-name-api.mjs';
import './bachelorfridge-names-specials.mjs';

// ---- Battle state and board ---------------------------------------------
cls('op', 'BattleState', 'Owns the tile grid, per-player rosters, turn order and queued orders; names the board types Pizza, Dessert and Curry.');
cls('wia', 'BoardTile', 'Grid cell with terrain type and occupant; its debug string prints tile x, y, occupied, object id and powerup.');
cls('aga', 'BattleCreature', 'Creature on the board; its debug dump prints x, y, hp, splitid, status, friendly and shield.');
cls('rk', 'CreatureProfile', 'Base of aga that keeps skill arrays, a name and a Random, copy-constructed from another rk or built from a wca.');
cls('wca', 'CreatureType', 'Table row with name strings and skill index arrays that rk is constructed from.');
cls('nq', 'CreatureRef', 'Holds two ints or wraps an aga and resolves the creature against a BattleState.');
cls('ib', 'PlayerRoster', 'Array of up to seven aga creatures of one player with a count and a flag.');
cls('tk', 'PlayerMatchStats', 'Eighteen private counters of one player read through an index getter.');
fld('op', 'a', '[[Lwia;', 'tiles', 'op indexes field_a[x][y] for every tile read and write.');
fld('op', 'z', 'I', 'width', 'op loops x below field_z over the tile grid.');
fld('op', 'B', 'I', 'height', 'op loops y below field_B over the tile grid.');
fld('op', 'd', 'I', 'playerCount', 'op allocates one roster per field_d.');
fld('op', 'S', '[Lib;', 'rosters', 'op creates one ib per player in field_S.');
fld('aga', 'x', 'I', 'tileX', 'The debug dump prints field_x as x and aga indexes the tile grid with it.');
fld('aga', 'J', 'I', 'tileY', 'The debug dump prints field_J as y and aga indexes the tile grid with it.');
fld('aga', 'I', 'I', 'hp', 'aga.i(int) reports the creature as down when field_I is not above zero.');
fld('aga', 'w', 'Lop;', 'battle', 'aga reads the tile grid and turn data through field_w.');
fld('aga', 'F', 'I', 'splitId', 'The debug dump prints field_F as splitid.');
fld('aga', 'C', 'I', 'statusTurns', 'The debug dump prints field_C as the turns left on the status.');
fld('aga', 'y', 'I', 'statusId', 'The debug dump indexes the status table with field_y.');
fld('aga', 'E', 'I', 'friendly', 'The debug dump prints field_E as friendly.');
fld('aga', 'H', 'I', 'shield', 'The debug dump prints field_H as shield.');
fld('aga', 'D', 'I', 'ownerIndex', 'The debug string prints the owner and ib rosters are indexed with field_D.');
fld('aga', 'u', 'I', 'rosterSlot', 'The debug string prints field_u as the creature pos and nq stores it.');
mem('aga', 'i', '(I)Z', 'isDown', 'Returns true when the hp field is not above zero.');
fld('wia', 'l', 'Laga;', 'occupant', 'The creature standing on the tile.');
fld('wia', 'n', 'I', 'terrain', 'Tile type index compared with constants such as 20, 21 and 23.');

// ---- Orders, events, effects ----------------------------------------------
cls('sfa', 'CreatureOrder', 'IntrusiveNode holding an order kind, a move id and a creature reference; toString prints the move name or "Move not found."');
cls('hia', 'AttackOrder', 'sfa subclass with kind 1 that builds attack events.');
cls('gm', 'MoveOrder', 'sfa subclass with kind 2 that builds df movement events.');
cls('td', 'SpecialOrder', 'sfa subclass with kind 4 that dispatches special move ids 88 to 137 to concrete subclasses.');
cls('cj', 'BattleUpdate', 'Abstract IntrusiveNode that serialises to a PacketBuffer and builds an animation node for a gj.');
cls('ii', 'CreatureEvent', 'BattleUpdate with a creature reference and a move id, written ahead of its own payload.');
cls('vja', 'AttackEvent', 'CreatureEvent produced by AttackOrder.');
cls('df', 'MoveEvent', 'CreatureEvent with kind 2 that stores a direction and distance packed in one byte.');
cls('bca', 'SpecialEvent', 'CreatureEvent with kind 4 that owns a deque of pp effects applied when it runs.');
cls('lc', 'BoardChangeBatch', 'BattleUpdate of kind 6 that holds a deque of jm board changes.');
cls('rv', 'EffectBatch', 'BattleUpdate of kind 5 that holds a deque of pp effects applied without a creature.');
cls('jm', 'BoardChange', 'Abstract change with a type code that is read, written and applied to a BattleState.');
cls('pp', 'EventEffect', 'Abstract effect applied to a creature and BattleState; writes a tag byte identifying its subclass.');
cls('iv', 'DamageEffect', 'Effect that hits a creature for a damage amount, may set a status id and records the hit.');
cls('cn', 'PlaceCreatureEffect', 'Effect that writes a new grid position into a creature and stores it on that tile.');
cls('bj', 'MoveCreatureEffect', 'Effect that clears the old tile and stores the creature on a free target tile.');
cls('sl', 'DamageTileEffect', 'Effect that lowers a tile counter and restores the original terrain at zero.');
cls('eba', 'SnowEffect', 'Effect that raises the BattleState snow flag; the SNOW special adds it to its event.');
cls('rla', 'SetFriendlyEffect', 'Effect that stores a value in the creature field that its debug dump prints as friendly.');
cls('ro', 'ClearTileFlagEffect', 'Effect that clears one boolean flag on the tile at a stored position.');
cls('at', 'AnimationNode', 'IntrusiveNode with a started flag and a child deque that runs children until all are finished.');
cls('ana', 'EventAnimation', 'AnimationNode constructed from a gj and a bca event that creates the creature view and attaches effect popups.');
mem('cj', 'a', '(Llu;I)V', 'write', 'Abstract hook that each update implements to serialise itself to a PacketBuffer.');
mem('cj', 'a', '(ILgj;)Lat;', 'createAnimation', 'Abstract hook that each update implements to build its animation node for a gj.');
mem('cj', 'a', '(Lop;Z)V', 'apply', 'Abstract hook that each update implements to change the BattleState.');
mem('pp', 'a', '(Laga;Lop;I)V', 'apply', 'Abstract hook that each effect implements to change a creature or the BattleState.');
mem('pp', 'a', '(Llu;B)V', 'write', 'Writes the effect tag byte chosen by instanceof, then subclasses add their payload.');
mem('at', 'c', '(B)Z', 'isFinished', 'Abstract hook; ra returns true when its countdown and child animation have both ended.');
mem('at', 'b', '(I)Z', 'update', 'Runs the node and its children once and reports whether the whole node has finished.');
mem('at', 'a', '(ILat;)V', 'addChild', 'Creates the child deque on first use and appends the child.');
mem('sfa', 'a', '(Lop;I)Lii;', 'createEvent', 'Abstract hook that each order implements to build the event the BattleState executes.');
fld('ii', 'l', 'Lnq;', 'creature', 'ii serialises field_l through er.a ahead of the payload.');
fld('ii', 'k', 'I', 'moveId', 'ii writes field_k first and subclasses compare it with move ids.');
fld('sfa', 'g', 'I', 'moveId', 'sfa.toString looks the move name up with field_g.');
fld('sfa', 'h', 'Lnq;', 'creature', 'td.a resolves field_h against the BattleState.');
fld('bca', 'o', 'Leaa;', 'effects', 'bca applies each pp in field_o.');
fld('pp', 'h', 'Lnq;', 'target', 'Effect subclasses resolve field_h to find their creature.');
fld('ana', 'q', 'Lgj;', 'screen', 'ana constructor stores its gj here.');
fld('ana', 'p', 'Lbca;', 'event', 'ana constructor stores its bca here and walks its effects.');

// ---- Move tables and status info ---------------------------------------
cls('oha', 'MoveDefinition', 'Move table row with a type code, name, description and numeric stats; type 4 marks specials.');
cls('hd', 'SpecialMoveDefinition', 'oha subclass created with type 4 whose range method throws "This special doesn\'t have a defined range."');
cls('t', 'BasicMoveDefinition', 'oha subclass carrying nine extra ints per row for non-special moves.');
cls('rs', 'StatusEffectInfo', 'Row of the 55-entry status table whose name string the creature debug dump prints.');
fld('oha', 'a', 'I', 'kind', 'oha.a(int) tests field_a == 4 and sfa kinds are 1 attack, 2 move, 4 special.');
fld('oha', 'f', 'Ljava/lang/String;', 'name', 'sfa.toString returns field_f of the move row.');
fld('oha', 'k', 'Ljava/lang/String;', 'description', 'hd constructor stores its second string in field_k.');
fld('rs', 'd', 'Ljava/lang/String;', 'name', 'The creature debug dump prints field_d as status.');
fld('rs', 'e', 'Ljava/lang/String;', 'description', 'Second text field of the status row.');

// ---- Widget system -----------------------------------------------------
cls('wj', 'UiWidget', 'IntrusiveNode whose toString prints address, position, text, mouseover and focused flags, renderer and listener.');
cls('pl', 'WidgetListener', 'Empty marker interface extended by the action, focus and sequence listener interfaces.');
cls('lja', 'WidgetActionListener', 'WidgetListener whose single callback receives the hf widget that was activated.');
cls('uia', 'WidgetPointerListener', 'WidgetActionListener with extra press and release callbacks that carry pointer coordinates.');
cls('caa', 'WidgetFocusListener', 'WidgetListener whose callback receives a boolean focus state and the widget.');
cls('qda', 'WidgetRenderer', 'Interface with one draw callback taking a widget and its bounds.');
cls('hf', 'InteractiveWidget', 'UiWidget that tracks pressed and enabled state and forwards clicks and focus to its listener.');
cls('hfa', 'WidgetWrapper', 'UiWidget holding a single child that it forwards drawing, input, focus and tooltips to.');
cls('vd', 'WidgetContainer', 'UiWidget owning a deque of child widgets that it draws and forwards input to.');
cls('tf', 'UiNode', 'DualLinkNode subclass that sna extends; it declares no instance state.');
cls('sna', 'UiComponent', 'UiNode with a name string, parent, child deque, bounds and sprite arrays built from a name and rectangle.');
fld('wj', 'w', 'Ljava/lang/String;', 'text', 'The toString dump prints text= from field_w.');
fld('wj', 'h', 'Ljava/lang/String;', 'tooltip', 'wj.c(byte) returns field_h and hfa prefers its child tooltip over it.');
fld('wj', 's', 'I', 'x', 'The toString dump prints field_s first after the at sign and containers add it to child offsets.');
fld('wj', 'v', 'I', 'y', 'The toString dump prints field_v second after the at sign.');
fld('wj', 'p', 'I', 'width', 'The toString dump prints field_p before the x separator.');
fld('wj', 'q', 'I', 'height', 'The toString dump prints field_q after the x separator.');
fld('wj', 't', 'Z', 'mouseOver', 'The toString dump appends mouseover when field_t is set.');
fld('wj', 'f', 'Lqda;', 'renderer', 'The toString dump prints renderer= from this field.');
fld('wj', 'k', 'Lpl;', 'listener', 'The toString dump prints listener= from this field.');
fld('vd', 'A', 'Leaa;', 'children', 'vd walks the eaa in field_A to draw and dispatch to child widgets.');
fld('hfa', 'A', 'Lwj;', 'child', 'hfa forwards every call to the single widget in field_A.');
fld('sna', 'z', 'Leaa;', 'children', 'sna keeps its child components in the eaa field_z.');
fld('sna', 'pb', 'Ljava/lang/String;', 'name', 'BattleScreen creates sna instances with names such as endturn and cancelorder stored here.');

// ---- Presentation ----------------------------------------------------------
cls('gj', 'BattleScreen', 'Client battle controller that owns the BattleState, board view, endturn and cancelorder buttons and the state dump.');
cls('jo', 'BoardView', 'Draws the tile grid, creature actors and highlights for a BattleScreen and resolves clicks to tiles.');
cls('ad', 'CreatureActor', 'IntrusiveNode view of one BattleCreature that carries position and animation deques.');
cls('kj', 'TileEffect', 'Visual effect linked into the BattleScreen per-tile list; subclasses draw one frame and report when finished.');
cls('ub', 'BoardChangeAnimation', 'AnimationNode built from a BoardChangeBatch that replays each change on the screen.');
cls('taa', 'ActorAnimation', 'AnimationNode constructed from a gj and a CreatureActor that animates that actor.');
cls('up', 'CreatureSelectPanel', 'Panel constructed from a BattleScreen and the rk team that owns a commit button and the actor list.');
cls('ng', 'MoveInfoPanel', 'Panel that lists the selected creature moves with Damage and Status effect text and moveselect buttons.');
cls('ola', 'FridgeScreen', 'Controller that owns the food shop panel, the fridge creatures and the shop and arena navigation.');
cls('jt', 'FoodShopPanel', 'Shop panel with food list, freezer box, scrollbar and basket components.');
cls('jfa', 'FridgeCreature', 'Creature living in the fridge, drawn from left_eye, right_eye, mouth and bacteria_components sprites.');
cls('pn', 'ArenaTheme', 'Abstract arena tile set that id, pla and kn specialise as pizza, dessert and curry.');
cls('id', 'PizzaArenaTheme', 'pn subclass that loads the tiles_pizza sprites.');
cls('pla', 'DessertArenaTheme', 'pn subclass that loads the tiles_dessert sprites.');
cls('kn', 'CurryArenaTheme', 'pn subclass that loads the tiles_curry sprites.');
cls('ru', 'NanoGameClock', 'Clock keeping a long-valued timestamp ring and sleeping until the next frame.');
cls('tn', 'GameClock', 'Abstract base of ru.');
cls('ur', 'WhirlpoolDigest', 'Eight long state arrays and 64-byte blocks fed through a Whirlpool-style hash.');
cls('rf', 'ArchiveIndex', 'Verifies a byte array against a CRC and digest and decodes group and file tables; also holds the move-name table.');

// ---- Widget protocol and panels -------------------------------------------
group('wj', 'UiWidget virtual whose base body or hf override shows the widget protocol.', [
  ['c', '(B)Ljava/lang/String;', 'getTooltip'], ['e', '(I)Z', 'isFocused'], ['f', '(I)V', 'blur'],
  ['a', '(Lwj;I)Z', 'acquireFocus'], ['a', '(IICLwj;)Z', 'handleKey'], ['a', '(IILwj;I)V', 'updateMouseOver'],
  ['a', '(BIII)V', 'draw'], ['d', '(I)V', 'refreshLayout'], ['a', '(ZIII)Z', 'processInput'],
]);
cls('lka', 'TextInputWidget', 'hf subclass with blink timers and a character handler that ph and gda hold as editable fields.');
cls('qka', 'WidgetMetrics', 'Interface of widget-parameterised int getters that gha implements for layout.');
cls('gha', 'DefaultWidgetRenderer', 'Implements the renderer and metrics interfaces, drawing widgets with a po font and returning sizes.');
cls('qh', 'WidgetTheme', 'Collects a po font and five qda renderers with colour ints.');
cls('ar', 'TermsPanel', 'Container that links the terms.ws, privacy.ws and conduct.ws pages through an aha.');
cls('ue', 'AccountCreationPanel', 'Container with five vn inputs, buttons, an aha and the same three policy links.');
cls('dka', 'ReportAbusePanel', 'Container with three hf buttons headed by the Report abuse string.');
cls('aha', 'LinkTextWidget', 'hf subclass that stores string lines and hit-tests aia link regions.');
cls('aia', 'TextLinkRegion', 'IntrusiveNode rectangle with a chained next region used by aha hit tests.');
cls('jma', 'EffectBatchAnimation', 'AnimationNode that counts down, then applies each pp effect of an rv batch and starts popup animations.');
