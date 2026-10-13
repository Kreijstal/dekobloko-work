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
 vn:['Ball','Radius-six circular body with velocities, angle-based launch and center-coordinate histories.'],
 nm:['IntrusiveNode','Previous/next links, collection key and unlink contract.'],
 vl:['NodeDeque','Intrusive sentinel list, insertion/removal, forward/reverse traversal, size and clear.'],
 hp:['IntHistoryBuffer','Fixed-capacity indexed integer history; ball ticks append center coordinates, and reads reject future/erased entries.'],
 ao:['ObjectHistoryBuffer','Fixed-capacity indexed object history; scheduled power-ups and board snapshots retain absolute sequence indices.'],
 ge:['PowerUp','Falling circle dropped by a brick, caught by a paddle and routed locally or to opponents; queued copies retain their activation tick.'],
 ul:['ScorePopup','Intrusive score text with fixed8 position and a fifty-tick rising/fading lifetime.'],
 cl:['BrickMotionPath','Deque of timed waypoints with serialized count and total cyclic duration; moving bricks attach and interpolate along it.'],
 ee:['MotionWaypoint','Moving-body position with destination segment duration, used by cyclic brick paths.'],
 wq:['PacketBuffer','Cursor over caller-supplied or pooled bytes with big-endian primitives, compact integers, strings, checksums and block operations.'],
 pi:['BitPacketBuffer','Packet buffer with MSB-first bit input/output and seeded cipher arithmetic for opcodes and byte slices.'],
 mj:['LegacyUtf8Decoder','Length-delimited legacy UTF-8 decoder; zero bytes and four-byte sequences become replacement characters.'],
 fo:['IsaacGenerator','ISAAC state, block mixing, reverse-order result consumption and rejection-based bounded sampling; used by board randomness and opcode cipher.'],
 qc:['GameplayAudioEvent','Intrusive numeric audio event with optional detail ID; match queues events and bm selects sound effects/music tempo changes.'],
 oi:['LevelSequence','Retains a level pack, index order, period and repeat mode; resolves level labels and decodes selected payload into board collections.'],
 nc:['LevelPack','Raw level payloads and per-level metadata with pack identity and qualified score/completion words.'],
 wk:['LevelMetadata','Decoded level ID, resource index, localized number label, title and qualified numeric attributes.'],
 kq:['IntNode','Intrusive integer holder used for board level state and UI selections; default and value constructors retain its numeric value.'],
 dq:['LevelDecoder','Versioned level parser for brick groups, paths, flags and state; also contains an unrelated packet transform helper.'],
 mq:['LevelPackLoader','Loads indexed level metadata and raw payloads from an archive; other static helpers retain their existing roles.'],
 lb:['Rasterizer2D','Shared RGB pixel target, dimensions, clipping rectangle and integer drawing/effect routines.'],
 mn:['SpriteGeometry','Common cropped sprite dimensions, original canvas size and offsets; other static helpers retain their roles.'],
 jp:['RgbSprite','Integer RGB sprite with zero-color transparency, cropped geometry, draw/copy and pixel transforms.'],
 fb:['ArgbSprite','RGB sprite subtype whose draw overrides blend per-pixel8-bit alpha with integer rounding.'],
 tk:['DualLinkNode','Intrusive node with an independent secondary link pair/key used by sprite/cache ownership.'],
 km:['MenuScreen','Game screen with menu buttons, selection controller, shared geometry and entry/exit/action/navigation contracts.'],
 q:['MenuButton','Action ID and owner, rectangular geometry, pressed and marked state; delegates drawing and hit testing.'],
 re:['MenuSelection','Selected index/count, pointer mode and retained key/press/activation codes; numeric input encodings remain qualified.'],
 wg:['GameCanvas','AWT canvas/focus-listener boundary with frame reference and menu-screen registration helper.'],
 of:['BlankScreen','Screen ID -2 clears the raster and consumes no gameplay input.'],
 de:['MembershipBenefitsScreen','Screen ID12 loads members_benefits_screenshots and routes its slideshow input.'],
 ud:['LevelSelectScreen','Screen IDs13/15 retain selected pack/list, decoded preview brick groups, paths and integer state.'],
 rp:['MainMenuScreen','Screen ID0 with top-level menu actions and shared menu backdrop.'],
 vp:['TimedSplashScreen','Screen ID21 displays a splash sprite, counts250 eligible ticks and returns to screen0 on timeout/input.'],
 uj:['LevelList','Scrollable level-number control with viewport button, keyboard/pointer selection and retained scroll position. Unrelated static encoding helpers keep their existing names.'],
 dm:['MouseInput','AWT mouse/motion/focus callbacks retain live coordinates, held button and press/event latches for a synchronized frame snapshot.'],
 gk:['MouseWheelSource','Abstract component attachment/detachment and accumulated wheel polling contract.'],
 qk:['MouseWheelInput','AWT wheel listener accumulates signed rotations, consumes events and clears the accumulator when polled.'],
};
const members={};
function field(owner,original,descriptor,to,evidence){members[`F:${owner}.field_${original}:${descriptor}`]={to,evidence};}
function method(owner,original,descriptor,to,evidence,parameters){const key=owner+'.'+original+descriptor;if(original!=='<init>')members['M:'+key]={to,evidence};for(const [ordinal,name] of Object.entries(parameters||{}))members['P:'+key+'#'+ordinal]={to:name,evidence};}
function local(owner,signature,ordinal,expectedOriginalName,to,evidence){members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName,evidence};}
for(const [original,type,to,evidence] of [
 ['i','I','rowSpacing','Row height plus supplied row gap.'],['f','I','rowHeight','Constructor row height; used separately from rowSpacing by keyboard center calculation.'],['g','I','scrollOffset','Retained pixel scroll offset; delta scrolling clamps, direct setter does not.'],
 ['m','Lkm;','owner','Menu screen whose selected button determines whether this control is active.'],['l','Lnc;','pack','Level count and number-label metadata.'],['n','I','lastPointerY','Pointer y saved at selection/update.'],['h','I','scrollStep','Three halves of rowHeight; used by wheel and arrow actions.'],['b','I','lastPointerX','Pointer x saved at selection/update.'],['d','Z','keyboardSelection','Preserves keyboard-selected level while pointer is unchanged and wheel delta is zero.'],['j','I','labelBaselineOffset','Font-dependent row label baseline offset.'],['a','I','buttonIndex','Owner selection index that activates this control.'],['k','I','maxScrollOffset','Nonnegative contentHeight minus viewport height plus5.'],['c','I','rowGap','Supplied inter-row pixel gap.'],['p','Lq;','viewport','Menu button supplying clipping and pointer geometry.'],['r','I','contentHeight','rowGap plus levelCount times rowSpacing.'],['q','I','selectedLevelIndex','Selected level or -1; pointer clamp intentionally accepts levelCount as an upper sentinel.'],
])field('uj',original,type,to,evidence);
method('uj','<init>','(IIILkm;Lq;Lnc;)V','<init>','Retains geometry/owner/pack and computes font baseline, content/max scroll and scroll step.',['rowHeight','rowGap','buttonIndex','owner','viewport','pack']);
method('uj','a','(IZ)V','scrollBy','Adds signed pixels, clamping to zero/maxScrollOffset only when clamp is true.',['deltaPixels','clamp']);
method('uj','b','(I)V','setScrollOffset','Assigns pixel scroll offset without clamping.',['offsetPixels']);
method('uj','a','(B)V','selectFirst','Selects index0, resets scroll, enters keyboard selection and captures pointer coordinates; guard -90.',['obfuscationGuard']);
method('uj','b','(B)V','selectLast','Selects levelCount-1, scrolls to maximum and captures pointer coordinates; guard below -39.',['obfuscationGuard']);
method('uj','c','(B)V','draw','Clips to viewport, chooses row colors from selected/unlocked indices and renders visible level number labels; guard28.',['obfuscationGuard']);
method('uj','a','(III)Z','handleNavigationKey','Keys98/99 decrement/increment and scroll using rowHeight for center division; invalid selection becomes -1 and returns true. Character is retained but unused.',['obfuscationGuard','keyCode','characterCode']);
method('uj','b','(Z)V','updatePointerSelection','Applies wheel scrolling and pointer selection while owner button is selected; inactive control clears selection/history. True guard drops viewport.',['obfuscationGuard']);
local('uj','c(B)V',0,'var3','rowBaselineY','Visible row baseline in viewport coordinates.');
local('uj','c(B)V',1,'var2','levelIndex','First visible row index, advanced for each rendered label.');
local('uj','c(B)V',2,'var4','labelStyle','Numeric style selected by unlocked and selected level predicates.');
local('uj','c(B)V',3,'var5','clientBranchFlag','Original client branch flag retained by generated code.');
local('uj','a(III)Z',0,'var4','centerLevelIndex','Original center calculation uses rowHeight division and rowSpacing in viewport quotient.');
method('df','a','(IBI)I','divideFloorPositive','Original signed rounding formula produces floor division for a positive divisor; guard15.',['divisor','obfuscationGuard','dividend']);
for(const [owner,original,type,to,evidence] of [
 ['pq','k','I','pointerX','Frame snapshot of eo live pointer x from AWT getX.'],['po','a','I','pointerY','Frame snapshot of ep live pointer y from AWT getY.'],['eo','i','I','livePointerX','Written by mouse move/drag/enter callbacks; exit writes -1.'],['ep','g','I','livePointerY','Written by mouse move/drag/enter callbacks; exit writes -1.'],
 ['l','l','I','livePressX','AWT mousePressed x retained until next press.'],['va','e','I','livePressY','AWT mousePressed y retained until next press.'],['tb','fb','I','pressX','Frame snapshot of livePressX.'],['qo','O','I','pressY','Frame snapshot of livePressY.'],
 ['kb','Pb','I','liveHeldButton','Mouse press sets1/2, release or focus loss sets0.'],['cb','q','I','heldButton','Frame snapshot of live held-button code.'],['mi','c','I','livePressedButton','Press latch set1/2 and cleared by frame snapshot.'],['ki','e','I','pressedButton','Frame snapshot of pressed-button latch.'],
 ['kn','C','Z','livePointerChanged','Mouse callbacks latch pointer/button event; snapshot copies and clears it.'],['kb','Xb','Z','pointerChanged','Frame snapshot of pointer-change latch.'],['gr','a','I','pointerIdleTicks','Mouse events reset to0; input snapshot increments.'],['lj','j','Ldm;','mouseInput','Global listener used as snapshot monitor; callbacks are inactive while null.'],
 ['qa','x','Lgk;','mouseWheelSource','Optional wheel source polled during applet updates.'],['qc','o','I','mouseWheelDelta','Accumulated signed wheel rotation returned by source poll for current frame.'],['qk','e','I','pendingRotation','Accumulated wheel rotations; poll returns and clears it.'],
])field(owner,original,type,to,evidence);
method('sg','e','(I)V','snapshotMouseInput','Under mouse-input monitor copies coordinates/buttons/latch, clears pending press/change and increments idle ticks; guard70.',['obfuscationGuard']);
method('gk','a','(Ljava/awt/Component;I)V','detach','Removes wheel listener from component; canonical guard -117.',['component','obfuscationGuard']);
method('gk','a','(BLjava/awt/Component;)V','attach','Adds wheel listener for guard above37.',['obfuscationGuard','component']);
method('gk','b','(I)I','pollRotation','Returns accumulated signed rotation and clears it; guard500.',['obfuscationGuard']);
method('ea','a','(I)Lgk;','createMouseWheelSource','Reflectively creates owned wheel implementation and returns null if creation fails; canonical guard60.',['obfuscationGuard']);
for(const [original,to,evidence] of [
 ['H','previewLevelIndex','Level index whose preview is cached; -1 invalidates preview.'],['G','maxNumberLabelWidth','Maximum rendered level number label width used by button geometry.'],['C','emptySelectionText','Lowercased prompt drawn when no valid level is selected.'],['B','previewBottom256','Maximum eligible preview brick y+height in fixed8 coordinates.'],['D','previewRight256','Maximum eligible preview brick x+width in fixed8 coordinates.'],['u','previewLeft256','Minimum eligible preview brick x in fixed8 coordinates.'],['I','previewTop256','Minimum eligible preview brick y in fixed8 coordinates.'],
])field('ud',original,original==='C'?'Ljava/lang/String;':'I',to,evidence);
method('ud','c','(II)V','loadPreview','Clears/decodes preview brick/path collections and computes bounds, excluding bricks whose flags bit0 is set; guard -6845.',['obfuscationGuard','levelIndex']);
field('on','M','I','motionPathIndex','Decoded byte and constructor state used as path array index only when flags bit2 is set; also participates in synchronization checksum.');
field('j','v','Lvl;','motionPaths','Decoded motion-path collection used when attaching paths to board bricks.');
method('cg','a','([Lvl;BLvl;Z)V','attachBrickMotionPaths','Indexes decoded paths in deque order and attaches selected path to bricks with flags bit2, with caller-supplied velocity mode; guard35.',['brickGroups','obfuscationGuard','motionPaths','includeVelocity']);
local('ud','c(II)V',0,'var3','clearGroupIndex','Index while resetting preview brick group collections.');
local('ud','c(II)V',1,'var4','previewBrick','Current brick inspected for preview bounds.');
local('ud','c(II)V',2,'var5','clientBranchFlag','Original client branch flag retained by generated code.');
local('ud','c(II)V',3,'var3Lifetime1','boundsGroupIndex','Index while collecting eligible preview brick bounds.');
field('gf','a','I','screenId','Constructor identity used by registration, current-screen comparison and transitions.');
method('gf','<init>','(I)V','<init>','Retains screen ID.',['screenId']);
for(const [original,type,to,evidence] of [
 ['j','I','buttonLeft','Default button left coordinate.'],['l','I','buttonRight','Default button right coordinate; width is right-left.'],['p','I','buttonTop','Default first button y coordinate.'],['q','I','buttonSpacing','Default per-index y step.'],['m','[Lq;','buttons','Menu button array constructed from action IDs.'],['h','Lre;','selection','Selected index, pointer/key state and activation controller.'],
])field('km',original,type,to,evidence);
for(const [original,type,to,evidence] of [
 ['c','I','x','Button rectangle left coordinate.'],['a','I','y','Button rectangle top coordinate.'],['j','I','width','Button rectangle width.'],['d','I','height','Button rectangle height.'],['f','I','actionId','Numeric menu action/label index.'],['e','Lkm;','owner','Retained owner menu screen.'],['b','Z','pressed','Pressed rendering state; special actions29/30 derive it from held input and hit test.'],['h','Z','marked','Persistent marker set exclusively among menu buttons; distinct from focus index.'],
])field('q',original,type,to,evidence);
for(const [original,type,to,evidence] of [
 ['j','I','selectedIndex','Retained selected menu index; constructor starts at0.'],['r','I','itemCount','Configured menu item count used for navigation wrapping.'],['e','I','keyCode','Retained numeric keyboard event code.'],['n','I','heldCode','Nonzero held-input mode suppresses normal keyboard polling and direct selection updates.'],['l','I','pressCode','Retained numeric press code used by press-activation predicate.'],['c','I','activationCode','Retained numeric activation code used by activation predicate.'],['d','Z','pointerDriven','Selects pointer index at entry and is cleared by keyboard/direct selection updates.'],
])field('re',original,type,to,evidence);
method('km','<init>','(IIIII[I)V','<init>','Retains screen ID/geometry and initializes buttons, treating null action IDs as empty.',['screenId','buttonLeft','buttonRight','buttonTop','buttonSpacing','actionIds']);
method('km','a','([II)V','initializeButtons','Creates buttons and matching selection count, resets pressed states and lays out buttons.',['actionIds','startIndex']);
method('km','b','(Z)V','layoutButtons','Sets each rectangle through virtual left/right/top/height getters; true guard.',['obfuscationGuard']);
method('km','a','(ZI)I','getButtonLeft','Default left coordinate; true guard.',['obfuscationGuard','buttonIndex']);
method('km','a','(II)I','getButtonRight','Default right coordinate; guard below -71.',['obfuscationGuard','buttonIndex']);
method('km','b','(II)I','getButtonTop','Default y=buttonTop+buttonSpacing*buttonIndex; guard1.',['buttonIndex','obfuscationGuard']);
method('km','b','(BI)I','getButtonHeight','Default height30; original arithmetic guard retained.',['obfuscationGuard','buttonIndex']);
method('km','a','(Z)I','getParentScreenId','Screen used by default back navigation; true guard.',['obfuscationGuard']);
method('km','a','(IBI)I','findButtonAt','Returns first enabled button containing point, or -1; guard below -77.',['pointY','obfuscationGuard','pointX']);
method('km','a','(BI)Z','isButtonEnabled','Default returns true with guard above80; derived screens impose availability rules.',['obfuscationGuard','buttonIndex']);
method('km','a','(IZB)Z','handleMenuAction','Dispatches original numeric action semantics; role follows callers and derived overrides, encodings remain unchanged.',['buttonIndex','inputFlag','obfuscationGuard']);
method('km','a','(IIC)V','handleNavigationKey','Processes original key navigation and derived key hooks; guard -120.',['obfuscationGuard','keyCode','character']);
method('km','a','(ZII)V','onEnter','Initializes selection from current pointer hit or supplied fallback index; guard above96.',['usePointer','initialSelection','obfuscationGuard']);
method('km','d','(B)V','onExit','Exit hook overridden by screens that clear retained state; guard79.',['obfuscationGuard']);
method('km','d','(I)V','refreshMenu','Refresh hook overridden by screens that rebuild their menu data; guard at most -60.',['obfuscationGuard']);
method('km','b','(ZI)V','markButton','Clears every marker and assigns requested marker state to supplied index.',['marked','buttonIndex']);
method('km','c','(I)V','navigateBack','Requests parent screen transition; guard -1.',['obfuscationGuard']);
method('q','<init>','(ILkm;)V','<init>','Retains action ID and owner menu.',['actionId','owner']);
method('q','a','(III)Z','containsPoint','Tests left/top inclusive and right/bottom exclusive rectangle bounds; guard below -25.',['pointX','pointY','obfuscationGuard']);
method('q','a','(I)V','resetPressed','Clears pressed state; guard at most -63 preserves geometry.',['obfuscationGuard']);
method('q','a','(BZ)V','draw','Draws button using numeric action label, state and supplied focus flag; original guard retained.',['obfuscationGuard','focused']);
method('q','b','(I)V','updatePressed','Updates special action29/30 pressed state from held input and current pointer; guard -2217.',['obfuscationGuard']);
method('re','<init>','(I)V','<init>','Retains item count, selects0 and starts in keyboard-driven mode.',['itemCount']);
method('re','a','(IIZB)V','initializeSelection','Clears held mode and selects pointer or fallback index from supplied mode; guard below -126.',['pointerIndex','fallbackIndex','usePointer','obfuscationGuard']);
method('re','a','(ZI)V','setSelectedIndex','Updates index only when heldCode is0, clearing pointerDriven; false guard.',['obfuscationGuard','selectedIndex']);
method('re','d','(B)V','pollKeyboardCode','Clears press/activation/key codes, then copies global keyboard code only when heldCode is0; guard -124.',['obfuscationGuard']);
method('re','d','(I)V','navigateHorizontal','Polls key and wraps selected index for numeric keys98/99 while not held; canonical guard -1.',['obfuscationGuard']);
method('re','a','(II)V','navigateVertical','Polls key and wraps selected index for keys96/97, with original fallback handling for98/99.',['fallbackIndex','obfuscationGuard']);
method('re','a','(III)V','updatePointer','Updates selection and retained pointer codes from current global pointer state; original guarded logic retained.',['heldIndex','obfuscationGuard','pressedIndex']);
method('re','g','(B)Z','isKey96','Tests retained key code96; guard -57.',['obfuscationGuard']);
method('re','c','(I)Z','isKey97','Tests retained key code97; guard -98.',['obfuscationGuard']);
method('re','b','(I)Z','isKey102','Tests retained key code102; guard -103.',['obfuscationGuard']);
method('re','a','(I)Z','isKey103','Tests retained key code103; guard -1.',['obfuscationGuard']);
method('re','a','(Z)Z','isHeld','Tests nonzero heldCode; false guard.',['obfuscationGuard']);
method('re','a','(B)Z','isActivated','Tests nonzero activation code or key83/84; guard113.',['obfuscationGuard']);
method('re','c','(B)Z','isPressActivated','Tests nonzero press code or key83/84; original arithmetic guard retained.',['obfuscationGuard']);
method('bg','a','(IIIBIII)Z','containsRectanglePoint','Tests half-open integer rectangle bounds using original argument ordering; guard above32.',['left','rectangleHeight','rectangleWidth','obfuscationGuard','pointY','pointX','top']);
field('pg','k','[Lkm;','menuScreens','Screen-ID-indexed registry initialized with22 slots.');
field('ag','D','[Ljava/lang/String;','buttonLabels','Localized action-ID-indexed menu labels; action8 may be supplied by screen override.');
field('wg','e','Z','focusLossPending','Latched volatile focus-loss flag set by focusLost; focusGained leaves it unchanged.');
field('wg','a','Ljava/awt/Frame;','window','Retained AWT frame associated with canvas boundary.');
field('lp','rb','Lgf;','currentScreen','Screen currently handling applet draw/update/key callbacks.');
field('hd','d','Lgf;','pendingScreen','Screen requested by transition before installation.');
method('wg','a','(ILkm;)V','registerMenuScreen','Installs menu by screenId if within registry bounds; guard at most -53.',['obfuscationGuard','screen']);
method('hk','a','(BLmf;)V','initializeMenuScreens','Constructs and registers all22 menu slots with original screen identities and shared archive.',['obfuscationGuard','archive']);
method('ng','a','(ZII)V','requestScreen','Avoids transition to current ID, resolves requested screen, invokes menu entry hook and resets transition progress; guard at least52.',['usePointer','obfuscationGuard','screenId']);
method('de','<init>','(Lmf;)V','<init>','Retains archive for members-benefits screenshot loading.',['archive']);
field('de','u','Lmf;','archive','Retained archive used to load membership screenshots.');field('de','r','[Ltp;','screenshots','Lazy members-benefits screenshot array.');
field('vp','t','I','remainingTicks','Eligible splash countdown starts at250; input/timeout returns to screen0.');
field('ud','A','Lnc;','pack','Selected pack used by level list and preview.');field('ud','F','[Lvl;','previewBrickGroups','Three decoded preview groups.');field('ud','z','Lvl;','previewPaths','Decoded preview motion paths.');field('ud','r','Lkq;','previewState','Decoded preview integer state.');field('ud','y','Luj;','levelList','Level list component retaining pack and selected level.');
method('ud','<init>','(II)V','<init>','Selects menu identity and pack index.',['screenId','packIndex']);
method('ud','<init>','(I[II)V','<init>','Initializes buttons, selected pack, level list and preview collections.',['screenId','actionIds','packIndex']);
for(const [original,type,to,evidence] of [
 ['l','[I','pixels','Bound row-major destination pixel array.'],['c','I','width','Target row stride and full width.'],['d','I','height','Target full height.'],
 ['i','I','clipLeft','Inclusive horizontal clip origin.'],['b','I','clipTop','Inclusive vertical clip origin.'],['f','I','clipRight','Exclusive horizontal clip end.'],['j','I','clipBottom','Exclusive vertical clip end.'],
])field('lb',original,type,to,evidence);
for(const [original,to,evidence] of [
 ['D','width','Cropped pixel row width.'],['C','height','Cropped pixel height.'],['x','canvasWidth','Original untrimmed canvas width.'],['z','canvasHeight','Original untrimmed canvas height.'],['E','offsetX','Horizontal crop offset within original canvas.'],['F','offsetY','Vertical crop offset within original canvas.'],
])field('mn',original,'I',to,evidence);
field('jp','G','[I','pixels','Row-major sprite pixels; constructor retains supplied array.');
field('tk','n','Ltk;','secondaryPrevious','Previous link independent of inherited primary links.');field('tk','s','Ltk;','secondaryNext','Next link independent of inherited primary links.');field('tk','j','J','secondaryKey','Separate retained key guarded against updates while secondary-linked.');
method('tk','d','(I)V','unlinkSecondary','Patches secondary neighbors and clears both own links; guard3.',['obfuscationGuard']);
method('tk','c','(I)Z','isSecondaryLinked','Tests secondaryPrevious; guard2.',['obfuscationGuard']);
method('tk','e','(I)J','getSecondaryKey','Returns retained secondary key; guard -19451.',['obfuscationGuard']);
method('tk','a','(JI)V','setSecondaryKey','Rejects assignment while secondary-linked; guard below -62 preserves static state.',['key','obfuscationGuard']);
for(const [original,descriptor,to,params,evidence] of [
 ['a','([III)V','bind',['targetPixels','targetWidth','targetHeight'],'Retains target array and dimensions then resets clip to target bounds.'],
 ['a','()V','resetClip',[],'Resets clipping to full target bounds and clears clip-dependent mask arrays.'],
 ['e','(IIII)V','setClip',['left','top','right','bottom'],'Sets clip after original one-sided target-bound clamps; does not normalize inverted/outside bounds.'],
 ['d','(IIII)V','intersectClip',['left','top','right','bottom'],'Intersects existing clip by independently tightening its four bounds.'],
 ['a','([I)V','saveClip',['destination'],'Copies clipLeft/Top/Right/Bottom into first four array entries.'],
 ['b','([I)V','restoreClip',['saved'],'Restores four saved clip bounds without clamping.'],
 ['d','()V','clear',[],'Zeroes width*height pixels regardless of current clip; leaves any extra backing tail intact.'],
 ['a','(III)V','setPixel',['x','y','color'],'Writes one clipped RGB pixel.'],
 ['c','(IIII)V','drawHorizontalLine',['x','y','length','color'],'Writes horizontal clipped run.'],
 ['g','(IIII)V','drawVerticalLine',['x','y','length','color'],'Writes vertical clipped run.'],
 ['g','(IIIII)V','fillRectangle',['x','y','rectangleWidth','rectangleHeight','color'],'Fills clipped rectangle with RGB color.'],
 ['d','(IIIIII)V','fillRectangleAlpha',['x','y','rectangleWidth','rectangleHeight','color','alpha256'],'Blends clipped rectangle; source/destination channels are truncated separately before addition.'],
 ['b','(IIII)V','darkenRectangle',['x','y','rectangleWidth','rectangleHeight'],'Halves RGB channels using per-channel low-bit masking.'],
 ['a','(IIII)V','grayscaleRectangle',['x','y','rectangleWidth','rectangleHeight'],'Applies original weighted integer grayscale formula over clipped rectangle.'],
 ['e','(IIIII)V','drawRectangle',['x','y','rectangleWidth','rectangleHeight','color'],'Draws top/bottom and side runs using original overlap behavior.'],
 ['a','(IIIIII)V','drawRectangleAlpha',['x','y','rectangleWidth','rectangleHeight','color','alpha256'],'Draws alpha outline with corner pixels handled by horizontal runs.'],
 ['b','(IIIII)V','drawHorizontalLineAlpha',['x','y','length','color','alpha256'],'Blends horizontal run with combined channel products before truncation.'],
 ['f','(IIIII)V','drawVerticalLineAlpha',['x','y','length','color','alpha256'],'Blends vertical run with combined channel products before truncation.'],
 ['g','(IIIIII)V','fillVerticalGradient',['x','y','rectangleWidth','rectangleHeight','topColor','bottomColor'],'Interpolates16.16 vertical position then8-bit color weights; clipping preserves gradient origin.'],
 ['d','(IIIII)V','drawLine',['x1','y1','x2','y2','color'],'Draws inclusive endpoints with original fixed16 interpolation and horizontal/vertical special cases.'],
 ['c','()V','clearStaticReferences',[],'Clears target and auxiliary array references; dimensions/clip remain unchanged.'],
])method('lb',original,descriptor,to,evidence,params);
for(const [owner,desc,params,evidence] of [
 ['jp','(II)V',['width','height'],'Allocates uncropped zero-filled RGB pixels.'],['fb','(II)V',['width','height'],'Allocates uncropped zero-filled ARGB pixels through base constructor.'],
 ['jp','(IIIIII[I)V',['canvasWidth','canvasHeight','offsetX','offsetY','width','height','pixels'],'Retains cropped geometry and caller pixel array.'],['fb','(IIIIII[I)V',['canvasWidth','canvasHeight','offsetX','offsetY','width','height','pixels'],'Retains cropped geometry and caller ARGB array through base constructor.'],
])method(owner,'<init>',desc,'<init>',evidence,params);
method('jp','d','(IIII)Z','containsPixel','Tests point relative to canvas origin and crop offset; nonzero pixel word means contained.',['originX','originY','pointX','pointY']);
method('jp','c','(II)V','drawTransparent','RGB implementation skips zero pixels; ARGB override blends by per-pixel alpha.',['x','y']);
method('jp','d','(II)V','drawAt','RGB implementation copies all pixels, including zero; ARGB override retains its own alpha blending.',['x','y']);
method('jp','a','()V','flipHorizontal','Reverses each pixel row and reflects crop offset within original canvas.',[]);
method('jp','c','()Ljp;','copyFlippedHorizontal','Returns independent horizontally mirrored pixels and reflected offset.',[]);
method('jp','e','()Ljp;','copy','Returns independent pixel array retaining cropped geometry.',[]);
method('jp','f','()V','rotateClockwise','Rotates pixels90 degrees clockwise and swaps/refines canvas, dimensions and crop offsets.',[]);
method('jp','b','()V','rotateCounterclockwise','Rotates pixels90 degrees counterclockwise and swaps/refines canvas, dimensions and crop offsets.',[]);
method('jp','g','()V','bindRasterTarget','Binds sprite pixel array and cropped dimensions as global raster target.',[]);
method('jp','h','()V','replaceZeroWithOne','Replaces exact zero pixel words with1; preserves other pixel words.',[]);
method('jp','d','()V','trimTransparentBorders','Scans nonzero-pixel bounds and updates crop dimensions/offsets; original empty-sprite behavior retained.',[]);
for(const [original,type,to,evidence] of [
 ['b','Lnc;','pack','Retained level pack whose payload/metadata arrays are selected by sequence order.'],
 ['f','[I','order','Caller-owned level index order; sequence uses levelIndex modulo period.'],
 ['e','I','period','Cycle length; negative constructor input uses order length and enables repeats.'],
 ['c','Z','repeats','Set when constructor period is negative; match completion checks this flag.'],
])field('oi',original,type,to,evidence);
for(const [original,type,to,evidence] of [
 ['i','I','levelCount','Count read from pack metadata header and used for payload/metadata array allocation.'],
 ['j','[[B','levelData','Raw level bytes indexed by level ID; append operation copies only outer payload storage.'],
 ['c','[Lwk;','metadata','Per-level decoded metadata indexed by level ID.'],
 ['h','I','packId','Pack identity used for completion records; only negative-ID packs may be appended as extra payloads.'],
 ['b','I','scoreOffset','Offset used with completed-level count in score accounting; finer game mode meaning remains qualified.'],
 ['d','I','completionWord','Numeric word passed with its65535-XOR counterpart into completion reporting; protocol meaning remains qualified.'],
])field('nc',original,type,to,evidence);
for(const [original,type,to,evidence] of [
 ['n','I','levelId','Unsigned-short metadata index used to install payload and metadata into pack arrays.'],
 ['q','I','resourceIndex','32-bit resource selector passed into archive payload lookup; archive dimension naming remains qualified.'],
 ['o','Ljava/lang/String;','numberLabel','Localized lower-case label derived from levelId+1.'],
 ['j','Ljava/lang/String;','title','Length-delimited legacy UTF-8 title, returned by sequence title lookup.'],
 ['l','I','attributeByte','Unsigned-byte metadata attribute; purpose remains unresolved.'],
 ['i','I','attributeWord','32-bit metadata attribute; purpose remains unresolved.'],
])field('wk',original,type,to,evidence);
field('kq','p','I','value','Integer retained by value constructor; shared between level state and UI node uses.');
field('j','ab','Lkq;','levelState','Retained integer node decoded from version4+ level header; earlier versions reset its value to0.');
field('j','qb','I','levelIndex','Selects current level from sequence and advances at level completion.');
method('nc','<init>','(III)V','<init>','Retains pack ID and qualified score/completion values.',['packId','scoreOffset','completionWord']);
method('nc','a','(Lnc;Z)V','appendLevelData','Appends shallow raw payload references only; rejects nonnegative extra pack IDs and retains original metadata array; false guard.',['extra','obfuscationGuard']);
method('wk','a','(ILwq;)V','readMetadata','Decodes unsigned-short ID, localized number label, resource/attribute words, attribute byte and legacy UTF-8 title; guard -12988.',['obfuscationGuard','packet']);
method('kq','<init>','(I)V','<init>','Retains integer node value.',['value']);
method('oi','<init>','(Lnc;)V','<init>','Creates identity order covering the pack level count.',['pack']);
method('oi','<init>','(Lnc;[II)V','<init>','Retains caller order and period; negative period uses order length and enables repeating sequence.',['pack','order','period']);
method('oi','a','(I)I','getPeriod','Returns period; original arithmetic guard retained.',['obfuscationGuard']);
method('oi','a','(IZ)I','getLevelId','Maps levelIndex modulo period through retained order; true guard.',['levelIndex','obfuscationGuard']);
method('oi','a','(IB)Ljava/lang/String;','getLevelTitle','Returns selected metadata title; guard below -117.',['levelIndex','obfuscationGuard']);
method('oi','a','(BI)Ljava/lang/String;','getLevelNumberLabel','Returns selected metadata localized number label; guard above94.',['obfuscationGuard','levelIndex']);
method('oi','a','(Lga;Lkq;Lvl;IB[Lvl;)V','decodeLevel','Selects raw payload by sequence order and decodes into supplied groups/paths/state; guard at most -90.',['unusedContext','levelState','motionPaths','levelIndex','obfuscationGuard','brickGroups']);
method('td','a','([Lvl;[BLkq;Lvl;Lga;I)I','decodeLevelBytes','Wraps raw bytes as PacketBuffer then delegates versioned level decode; guard10792131.',['brickGroups','data','levelState','motionPaths','unusedContext','obfuscationGuard']);
method('dq','a','([Lvl;ZLwq;Lvl;Lkq;Lga;)I','decodeLevel','Requires empty destination collections and version at most5; decodes legacy/grouped bricks, motion paths, flags and version4+ state word; true guard.',['brickGroups','obfuscationGuard','packet','motionPaths','levelState','unusedContext']);
method('mq','a','(BLmf;Lwq;IIII)Lnc;','loadLevelPack','Reads metadata records, installs them by ID and resolves associated raw payloads through archive lookup; original guards and selector ordering retained.',['obfuscationGuard','archive','packet','archiveSelector','packId','completionWord','scoreOffset']);
method('ai','a','(BLwq;)Lwk;','readLevelMetadata','Creates metadata node and invokes guarded field decoder; guard -12.',['obfuscationGuard','packet']);
method('kj','a','(ILvl;I)V','addBoardBorders','Adds type1/flag1 bricks across the top and two sides for supplied column count; rows -1..30; guard16.',['columns','destination','obfuscationGuard']);
method('kk','a','(ZILfo;)[I','createIndexOrder','Allocates0..count-1; optionally shuffles using supplied seeded generator; false guard.',['obfuscationGuard','count','random']);
for(const [ordinal,original,to,evidence] of [
 [0,'var11','brickIndex','Index of serialized brick within current group.'],
 [16,'var6_int','destinationGroupIndex','Checks that every supplied destination group starts empty.'],
 [18,'var7','flags','Decoded level flags; version4+ high bits go to levelState.'],
 [20,'var9','entryIndex','Index of a grouped-format collection or a legacy-format brick entry.'],
 [21,'var9_ref_on','movingBrick','Legacy brick being moved to motion group when flag4 is set.'],
 [22,'var10','brickCount','Serialized brick count for current group.'],
 [23,'var12','brick','New grouped-format brick read from snapshot bytes.'],
 [26,'var15','legacyBrick','New legacy-format brick.'],
 [27,'var16','motionPath','New path read from serialized waypoints.'],
 [28,'var6_intLifetime1','version','Level format version selects raw/snapshot/grouped layout and optional suffixes.'],
 [29,'var8Lifetime1','pathCount','Number of serialized motion paths.'],
 [30,'var9Lifetime1','pathIndex','Index of serialized motion path.'],
])local('dq','a([Lvl;ZLwq;Lvl;Lkq;Lga;)I',ordinal,original,to,evidence);
for(const [original,type,to,evidence] of [
 ['m','I','accumulator','ISAAC accumulator updated by alternating shifts and half-block memory offsets.'],
 ['l','I','lastResult','ISAAC previous result, initially augmented by incremented block counter.'],
 ['e','I','blockCounter','Incremented at the start of each generated block.'],
 ['d','[I','memory','256-word ISAAC state memory.'],
 ['k','[I','results','256-word output block, seeded before initialization and consumed in reverse index order.'],
 ['j','I','remaining','Count of unread output words; nextInt returns results[--remaining].'],
])field('fo',original,type,to,evidence);
method('fo','<init>','([I)V','<init>','Copies seed into a zero-padded256-word result array, performs two initialization passes and produces the first block.',['seed']);
method('fo','a','(B)V','generateBlock','Produces256 ISAAC words with wrapping32-bit arithmetic; guard below -64.',['obfuscationGuard']);
method('fo','a','(Z)V','initialize','Four initial eight-word mixes and two state-filling passes, then first output block; true guard.',['obfuscationGuard']);
method('fo','b','(I)I','nextInt','Consumes output block in reverse order and refills when empty; guard at least88.',['obfuscationGuard']);
method('fo','a','(II)I','nextBoundedInt','Rejects nonpositive bounds, rejects the incomplete high range and returns nonnegative signed floor modulus; guard -37880252.',['obfuscationGuard','bound']);
field('j','W','I','randomCallCount','Board random wrappers increment once per call, including an invalid bounded request; internal rejection retries do not increment this counter.');
method('j','e','(I)I','nextRandomInt','Increments randomCallCount and consumes next seeded random word; original arithmetic guard retained.',['obfuscationGuard']);
method('j','a','(IB)I','nextRandomBoundedInt','Increments randomCallCount before delegating bounded sampling; guard62.',['bound','obfuscationGuard']);
method('er','a','(III)I','nonnegativeRemainder','Returns signed floor modulus for positive divisor using original sign adjustment; canonical guard -1560508993.',['obfuscationGuard','divisor','value']);
method('vi','a','(I[IILfo;)V','shuffleValues','Runs requested passes of random-index swaps over the array using seeded bounded sampling; original arithmetic guard retained.',['obfuscationGuard','values','passes','random']);
field('qc','m','I','eventCode','Numeric gameplay audio event code read by the audio event consumer.');
field('qc','j','I','detailId','Optional event detail; power-up pickup event3 uses its type to choose a sound effect.');
method('qc','<init>','(I)V','<init>','Creates audio event with default detail -1.',['eventCode']);
method('qc','<init>','(II)V','<init>','Retains event code and detail without interpreting their encodings.',['eventCode','detailId']);
method('bm','a','(IIZILvl;)V','playGameplayAudioEvents','Reads queued audio codes, selects effects and adjusts music tempo; event4 contributes tempo changes; guard -30791.',['volume','tempoScale256','alternateMusicTrack','obfuscationGuard','events']);
for(const [owner,signature,ordinal,original,to,evidence] of [
 ['fo','<init>([I)V',0,'var2_int','seedIndex','Index copied from caller seed into result block.'],
 ['fo','a(B)V',0,'fieldTemp$0','nextBlockCounter','Incremented block counter added to lastResult.'],
 ['fo','a(B)V',1,'var2','wordIndex','Current state/output index in generated block.'],
 ['fo','a(B)V',2,'dupTemp$1','newMemoryWord','Wrapping sum installed in state memory.'],
 ['fo','a(B)V',3,'dupTemp$2','newResult','Result installed in both lastResult and output block.'],
 ['fo','a(B)V',4,'var3','oldMemoryWord','Prior state value used for both indirect lookups and result addition.'],
 ['fo','a(B)V',5,'var4','memoryWord','New state value used for second indirect lookup.'],
 ['fo','b(I)I',0,'fieldTemp$0','resultIndex','Decremented output count used to select result word.'],
 ['fo','a(II)I',0,'var4','sample','Drawn signed word considered by rejection sampling.'],
 ['fo','a(II)I',1,'var3','maximumAccepted','Highest signed sample that excludes incomplete modulus range.'],
 ['fo','a(Z)V',0,'var2','scrambleRound','Four rounds of initial state mixing.'],
 ['fo','a(Z)V',10,'var2Lifetime1','seedBlockOffset','Eight-word block offset in first state-filling pass.'],
 ['fo','a(Z)V',11,'var2Lifetime2','memoryBlockOffset','Eight-word block offset in second state-filling pass.'],
 ...[['var3',4,'mixA'],['var4',6,'mixB'],['var5',2,'mixC'],['var6',7,'mixD'],['var7',8,'mixE'],['var8',9,'mixF'],['var9',3,'mixG'],['var10',5,'mixH']].map(([original,ordinal,to])=>['fo','a(Z)V',ordinal,original,to,'ISAAC initialization eight-word mixing lane.']),
])local(owner,signature,ordinal,original,to,evidence);
for(const [name,to] of [['j','x256'],['m','y256'],['k','velocityX256'],['o','velocityY256'],['i','typeId'],['l','stateWord']])field('vi',name,'I',to,'Common body constructor, packed snapshot decoder and checksum; coordinates and brick dimensions use256 units per pixel; state word meaning remains unresolved.');
field('bn','u','I','width256','Rectangle constructor width; bricks use8704 and paddles22528.');field('bn','s','I','height256','Rectangle constructor height; bricks use4096 and paddles3840.');field('no','u','I','radius256','Circle constructor radius; ball constructors use1536.');
for(const [name,type,to] of [['l','[Lj;','playerBoards'],['k','I','playerCount'],['f','[Ljava/lang/String;','playerNames'],['b','Loi;','configuration'],['i','I','playerMaskOne'],['g','I','playerMaskTwo'],['a','I','playerMaskThree']])field('ak',name,type,to,'Match constructor and board iteration; player masks retain separate numbered identities rather than guessing elimination/disconnect encodings.');
for(const [name,type,to] of [['yb','Lvo;','paddle'],['mb','I','boardWidth'],['ub','I','boardOffset'],['sb','I','randomSeed'],['s','Lfo;','seededRandom'],['O','[Lon;','portalBricks'],['K','Lvl;','queuedBalls'],['ob','I','score'],['F','I','simulationTick']])field('j',name,type,to,'Player board constructor, queued attack scheduling, brick/ball/paddle geometry and scoring paths; board offset participates in scrolling/progress state; finer meaning remains qualified.');
field('j','O','[Lon;','portalBricks','Board initialization populates this array only with type28 portal bricks, assigns portalIndex, and uses it to choose a different teleport destination.');
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
for(const [owner,index,capacity,entries,type] of [['hp','j','n','o','[I'],['ao','n','m','i','[Ljava/lang/Object;']]) {
 field(owner,index,'I','latestIndex','Starts at -1; append advances the absolute index before storing modulo capacity.');
 field(owner,capacity,'I','capacity','Constructor allocates this many entries; indexing wraps modulo capacity.');
 field(owner,entries,type,'entries','Circular storage; retained objects/integers are returned at absolute index modulo capacity.');
 method(owner,'<init>','(I)V','<init>','Creates empty indexed history with caller-supplied capacity.',['capacity']);
}
method('hp','a','(II)V','append','Advances latestIndex and stores value modulo capacity; canonical guard -7255.',['obfuscationGuard','value']);
method('hp','b','(II)I','get','Rejects future indices and indices below latestIndex-capacity+retentionAdjustment; canonical adjustment1.',['index','retentionAdjustment']);
method('ao','a','(Ljava/lang/Object;B)V','append','Advances latestIndex and stores the same object reference; canonical guard -39.',['value','obfuscationGuard']);
method('ao','a','(II)Ljava/lang/Object;','get','Rejects future and overwritten indices; canonical guard67 preserves the arithmetic guard.',['index','obfuscationGuard']);
field('vn','E','Lhp;','centerXHistory256','Match tick appends x256+radius256 to this history; reset paths set its latest index to -1.');
field('vn','y','Lhp;','centerYHistory256','Match tick appends y256+radius256 to this history; reset paths set its latest index to -1.');
for(const [original,type,to,evidence] of [
 ['gb','Lvl;','activeBalls','Board diagnostics name this collection Balls in play; match advances these bodies.'],
 ['pb','Lvl;','fallingPowerUps','Brick contact adds falling power-ups; match advances them and handles paddle pickup.'],
 ['nb','Lvl;','scorePopups','addScore appends score text; match tick advances its rising/fading lifetime.'],
 ['kb','Lao;','powerUpHistory','Match routing appends scheduled copies; pending consumption reads absolute indices.'],
 ['X','I','nextPowerUpIndex','First unapplied history index; advanced only after a due power-up is applied.'],
 ['Y','Lao;','snapshotHistory','Snapshot loading restores the latest index to simulationTick/5-1; finer snapshot storage remains unverified.'],
])field('j',original,type,to,evidence);
field('ge','y','I','activationTick','Scheduled copy constructor uses tickOffset+recipient.simulationTick; match applies only at or after this tick.');
method('ge','b','(Z)Z','isSelfTargeted','Reads the type flag used to route pickups to selected board instead of unmasked opponents; canonical false guard.',['obfuscationGuard']);
method('ge','a','(Lj;B)V','applyToBoard','Applies original type-specific paddle, ball and board mutations; board state3 suppresses all effects; guard99.',['board','obfuscationGuard']);
method('ge','<init>','(III)V','<init>','Creates a falling radius-eight power-up with downward velocity1024.',['x256','y256','typeId']);
method('ge','<init>','(IIII)V','<init>','Creates a falling body and retains its activation tick.',['x256','y256','typeId','activationTick']);
method('ge','<init>','(Lge;I)V','<init>','Copies source position/type, resets body velocity/state and assigns a recipient activation tick.',['source','activationTick']);
method('ak','a','(BI)V','applyPendingPowerUps','Consumes the due prefix in history order; stops at the first future entry even if a later entry is due; guard at least81.',['obfuscationGuard','playerId']);
method('j','a','(III)I','ticksUntilPendingPowerUp','Scans pending entries until the lookahead limit for the requested type; returns relative delay or -1; guard above8.',['typeId','obfuscationGuard','lookaheadTicks']);
method('j','a','(IZII)V','addScore','Updates score and accounting, optionally resets a state word, and appends a popup at supplied fixed8 coordinates.',['points','resetStateWord','x256','y256']);
for(const [original,type,to] of [['o','Ljava/lang/String;','text'],['i','I','x256'],['n','I','y256'],['q','I','remainingTicks']])field('ul',original,type,to,'Popup constructor, match lifetime update and cn drawing: integer score text, fixed8 coordinates and opacity remainingTicks/50.');
method('ul','<init>','(III)V','<init>','Formats score text and starts fifty-tick lifetime at supplied coordinates.',['points','x256','y256']);
method('ul','b','(Z)Z','advance','Moves upward one pixel and decrements remaining ticks; false guard returns whether remainingTicks is nonzero.',['obfuscationGuard']);
for(const [owner,signature,ordinal,original,to,evidence] of [
 ['ak','a(IILvl;B)V',0,'var6','recipientIndex','Opponent routing iterates this board index.'],
 ['ak','a(IILvl;B)V',9,'var8','powerUp','Current pickup from the source attack deque.'],
 ['ak','a(BI)V',0,'var3','board','Selected board whose scheduled history is being consumed.'],
 ['ak','a(BI)V',1,'var4','powerUp','Current pending power-up; its activation tick gates application.'],
 ['j','a(III)I',0,'var4','historyIndex','Scans absolute pending history indices.'],
 ['j','a(III)I',1,'var5','powerUp','Pending effect examined for type and activation tick.'],
 ['hp','a(II)V',0,'fieldTemp$0','nextIndex','New absolute index used for the modulo storage slot.'],
 ['ao','a(Ljava/lang/Object;B)V',0,'fieldTemp$0','nextIndex','New absolute index used for the modulo storage slot.'],
 ['ul','b(Z)Z',0,'fieldTemp$0','nextRemainingTicks','Decremented lifetime used to test whether the popup is still alive.'],
])local(owner,signature,ordinal,original,to,evidence);
field('wq','l','I','position','Read/write byte cursor; each primitive advances it by its encoded length.');
field('wq','k','[B','data','Backing byte array; array constructor retains caller reference.');
field('pi','p','I','bitPosition','Read cursor in bits; entering bit mode multiplies byte position by8 and finishing rounds up to a byte boundary.');
field('pi','n','I','writeBitsRemaining','Unused low-order bit count in current output byte; writing starts with8 and finishing accounts for a partial byte.');
field('pi','v','Lfo;','opcodeCipher','Seeded generator whose next integer is added to written opcodes and subtracted from received bytes.');
field('kk','g','[I','bitMasks','Low-bit masks indexed by bit count, including a full32-bit mask.');
field('ai','r','[C','cp1252Extensions','Byte128..159 character mapping; unmapped entries decode as question marks.');
for(const [owner,desc,params,evidence] of [
 ['wq','([B)V',['data'],'Starts cursor at0 and retains the supplied byte array.'],
 ['wq','(I)V',['capacity'],'Starts cursor at0 using the existing pooled byte-array allocator.'],
 ['pi','([B)V',['data'],'Wraps caller bytes through PacketBuffer constructor.'],
 ['pi','(I)V',['capacity'],'Uses PacketBuffer pooled allocation.'],
])method(owner,'<init>',desc,'<init>',evidence,params);
for(const [original,descriptor,to,params,evidence] of [
 ['l','(I)I','readUnsignedByte',['obfuscationGuard'],'Reads unsigned byte; guard255.'],
 ['b','(Z)B','readByte',['obfuscationGuard'],'Reads signed byte; true guard retains static state.'],
 ['i','(I)I','readUnsignedShort',['obfuscationGuard'],'Reads big-endian unsigned16-bit value; guard65280.'],
 ['a','(I)I','readShort',['obfuscationGuard'],'Reads big-endian signed16-bit value; guard above125.'],
 ['e','(B)I','readUnsignedMedium',['obfuscationGuard'],'Reads unsigned24-bit value; guard -34.'],
 ['j','(I)I','readMedium',['obfuscationGuard'],'Reads signed24-bit value; guard48.'],
 ['e','(I)I','readInt',['obfuscationGuard'],'Reads big-endian signed32-bit value; guard255.'],
 ['g','(I)J','readLong',['obfuscationGuard'],'Reads two unsigned32-bit halves and combines into64 bits; guard -32768.'],
 ['a','(II)V','writeByte',['obfuscationGuard','value'],'Writes low8 bits; original arithmetic guard retained.'],
 ['b','(BI)V','writeShort',['obfuscationGuard','value'],'Writes low16 bits big-endian; guard at least106.'],
 ['a','(BI)V','writeMedium',['obfuscationGuard','value'],'Writes low24 bits big-endian; guard47.'],
 ['a','(IB)V','writeInt',['value','obfuscationGuard'],'Writes32 bits big-endian; guard -79.'],
 ['a','(IJ)V','writeLong',['obfuscationGuard','value'],'Writes64 bits big-endian; guard -23054.'],
 ['a','(JB)V','writeLong40',['value','obfuscationGuard'],'Writes low40 bits big-endian; guard -32.'],
 ['a','(BJ)V','writeLong56',['obfuscationGuard','value'],'Writes low56 bits big-endian; guard -109.'],
 ['k','(I)I','readUnsignedSmart',['obfuscationGuard'],'Reads one-byte0..127 or two-byte value minus32768; guard -32768.'],
 ['c','(I)I','readSignedSmart',['obfuscationGuard'],'Reads one-byte value minus64 or two-byte value minus49152; guard -1342.'],
 ['c','(Z)I','readLargeSmart',['obfuscationGuard'],'Reads unsigned short or high-bit-marked int with its high bit removed; false guard.'],
 ['b','(II)V','writeUnsignedSmart',['obfuscationGuard','value'],'Writes unsigned compact range0..32767 using one or two bytes; canonical guard -1.'],
 ['b','(IB)V','writeSignedSmart',['value','obfuscationGuard'],'Writes compact signed range -16384..16383; guard at least110 rejects unsupported values.'],
 ['c','(B)I','readVarInt',['obfuscationGuard'],'Reads most-significant seven-bit groups first with continuation bits; original arithmetic guard retained.'],
 ['e','(BI)V','writeVarInt',['obfuscationGuard','value'],'Writes most-significant seven-bit groups with continuation bits; guard at most -53.'],
 ['a','([BIII)V','writeBytes',['source','obfuscationGuard','sourceOffset','length'],'Copies source slice into backing bytes; guard -1.'],
 ['a','(I[BII)V','readBytes',['destinationOffset','destination','obfuscationGuard','length'],'Copies backing bytes into destination slice; guard above109.'],
 ['f','(BI)V','padToPosition',['obfuscationGuard','endPosition'],'Appends zero bytes until absolute cursor reaches endPosition; guard -74.'],
 ['d','(BI)V','backfillByteLength',['obfuscationGuard','length'],'Stores payload length one byte before payload start without moving cursor; guard at least112.'],
 ['c','(II)V','backfillShortLength',['length','obfuscationGuard'],'Stores two-byte payload length before payload start; guard255.'],
 ['c','(BI)V','backfillIntLength',['obfuscationGuard','length'],'Stores four-byte payload length before payload start; guard at most -26.'],
 ['d','(I)Ljava/lang/String;','readCp1252String',['terminatorAdjustment'],'Scans through zero terminator; canonical adjustment -1 excludes it from decoded length.'],
 ['m','(I)Ljava/lang/String;','readNullableCp1252String',['obfuscationGuard'],'Leading zero means null; otherwise reads terminated string; guard0.'],
 ['f','(I)Ljava/lang/String;','readPrefixedCp1252String',['obfuscationGuard'],'Requires leading zero then reads terminated string; guard255.'],
 ['a','(Ljava/lang/String;I)V','writeCp1252String',['text','obfuscationGuard'],'Rejects embedded zero, encodes bytes and appends zero terminator; guard -1.'],
 ['a','(ILjava/lang/String;)V','writePrefixedCp1252String',['obfuscationGuard','text'],'Rejects embedded zero and surrounds encoded text with zero bytes; guard0.'],
 ['a','(B)Ljava/lang/String;','readLegacyUtf8String',['obfuscationGuard'],'Requires zero prefix, reads varint length, bounds-checks payload and invokes legacy decoder; guard24.'],
 ['a','(ZLjava/lang/String;)V','writeBase38Name',['obfuscationGuard','name'],'Encodes at most20 characters in two56-bit base38 words; false guard.'],
 ['d','(II)I','appendCrc32',['obfuscationGuard','startOffset'],'Computes CRC over startOffset..position and appends its32 bits; guard3.'],
 ['d','(B)Z','verifyCrc32',['obfuscationGuard'],'Checks trailing CRC against bytes from0 through position-4; cursor returns to original position; guard -27.'],
 ['a','(I[I)V','encryptBlocks',['obfuscationGuard','key'],'Encrypts complete eight-byte blocks from offset0 using32 rounds of two-word keyed mixing; cursor ends at complete-block boundary; guard18146.'],
 ['a','([IIIB)V','decryptBlocks',['key','startOffset','endOffset','obfuscationGuard'],'Decrypts complete eight-byte blocks in range and restores prior cursor; original arithmetic guard retained.'],
 ['a','(Ljava/math/BigInteger;Ljava/math/BigInteger;I)V','applyRsa',['exponent','modulus','obfuscationGuard'],'Treats written bytes as signed BigInteger, applies modPow and replaces with unsigned-short length plus result bytes; guard19775.'],
])method('wq',original,descriptor,to,evidence,params);
for(const [original,descriptor,to,params,evidence] of [
 ['n','(I)V','beginBitRead',['obfuscationGuard'],'Sets bitPosition from byte position; guard at most -74.'],
 ['f','(B)V','finishBitRead',['obfuscationGuard'],'Rounds consumed bits up to byte position; guard at least69.'],
 ['c','(IB)I','readBits',['bitCount','obfuscationGuard'],'Reads MSB-first bits across byte boundaries; original arithmetic guard retained.'],
 ['p','(I)V','beginBitWrite',['obfuscationGuard'],'Clears current output byte and initializes8 available bits; guard at least51.'],
 ['a','(III)V','writeBits',['bitCount','obfuscationGuard','value'],'Appends masked MSB-first bits across byte boundaries, clearing each new output byte; guard -17566.'],
 ['q','(I)V','finishBitWrite',['obfuscationGuard'],'Accounts for a partial final output byte; original arithmetic guard retained.'],
 ['a','([II)V','initializeOpcodeCipher',['seed','obfuscationGuard'],'Creates seeded generator for opcode arithmetic; original arithmetic guard retained.'],
 ['e','(II)V','writeCipheredOpcode',['obfuscationGuard','opcode'],'Adds next cipher integer and writes low byte; guard -13413.'],
 ['d','(Z)I','readCipheredOpcode',['obfuscationGuard'],'Subtracts next cipher integer and returns low byte; true guard.'],
 ['a','(ZII[B)V','readCipheredBytes',['obfuscationGuard','destinationOffset','length','destination'],'Subtracts consecutive cipher values while filling a destination slice; false guard.'],
])method('pi',original,descriptor,to,evidence,params);
method('mj','a','(BII[B)Ljava/lang/String;','decode','Decodes legacy UTF-8 byte slice, replacing zero/invalid sequences and every four-byte code point; guard below -89.',['obfuscationGuard','length','offset','data']);
method('df','a','(II[BI)Ljava/lang/String;','decodeCp1252','Decodes byte slice, skips zero bytes and uses extension mapping with question-mark fallback.',['length','obfuscationGuard','data','offset']);
method('hj','a','(I[BBILjava/lang/CharSequence;I)I','encodeCp1252','Encodes character slice to byte array, replacing unsupported characters with question marks; returns bytes written; guard86.',['endIndex','destination','obfuscationGuard','destinationOffset','text','startIndex']);
method('wq','h','(I)V','clearStaticStrings','Clears string references; canonical guard0 preserves static integer state.',['obfuscationGuard']);
method('pi','o','(I)V','clearStaticReferences','Clears owned static asset/message references; guard60.',['obfuscationGuard']);
method('mj','b','(B)V','clearStaticReferences','Clears owned static references; original arithmetic guard retained.',['obfuscationGuard']);
method('pi','a','(BIIILak;I)V','drawBoard','Draws selected board, brick groups, ball trails, paddle, power-ups, score popups and match-state overlays at supplied scale/offsets.',['obfuscationGuard','playerId','scaleDivisor','destinationY','match','destinationX']);
for(const [owner,signature,ordinal,original,to,evidence] of [
 ['vi','a(ILwq;)V',4,'var3_int','header','Packed coordinate mode, optional velocity/state/type flags and high coordinate bits.'],
 ['vi','a(ILwq;)V',8,'var6','gridColumn','Low five bits of second grid-coordinate byte.'],
 ['wq','c(B)I',1,'var2','currentByte','Current signed encoded byte; negative indicates continuation.'],
 ['wq','c(B)I',3,'var4','value','Accumulated seven-bit groups.'],
 ['wq','a([BIII)V',0,'var5_int','sourceIndex','Source slice index used while writing bytes.'],
 ['wq','a(I[BII)V',0,'var5_int','destinationIndex','Destination slice index used while reading bytes.'],
 ['pi','c(IB)I',0,'incrementValue$0','previousByteIndex','Byte index captured before advancing across a boundary.'],
 ['pi','c(IB)I',3,'var3','byteIndex','Current input byte from absolute bitPosition.'],
 ['pi','c(IB)I',4,'var5','availableBits','Unconsumed bits in current input byte.'],
 ['pi','c(IB)I',5,'var6','value','Accumulated MSB-first input bits.'],
])local(owner,signature,ordinal,original,to,evidence);
for(const [original,to,evidence] of [
 ['v','penetrationTicks','Timed power-up counter: suppresses ordinary brick reflection while contacts can still change brick type; phase counter is cleared when this counter is extended.'],
 ['J','phaseTicks','Timed power-up counter: bypasses collision on ordinary bricks and suppresses ordinary hit mutations; penetration counter is cleared when this counter is extended.'],
 ['I','brickBounceCount','Brick reflection increments this counter and paddle contact resets it; each fourth brick bounce perturbs velocity.'],
 ['C','contactCount','Brick/paddle contacts increment it; special board input consumes at forty contacts and clears it.'],
 ['B','destroyedBrickStreak','Incremented when a non-phased ball leaves a brick pending removal; reset after paddle contact and ball reset paths.'],
 ['z','launchAngle','Retained constructor angle controls initial velocity and placement on paddle; snapshot decoder restores it.'],
])field('vn',original,'I',to,evidence);
method('vn','a','(BI)V','extendPenetration','Adds ticks to penetration counter and clears phase counter; guard40 leaves static resources unchanged.',['obfuscationGuard','ticks']);
method('vn','b','(II)V','extendPhase','Adds ticks to phase counter and clears penetration counter; canonical guard at most -27 avoids velocity mutation.',['obfuscationGuard','ticks']);
method('vn','c','(II)V','adjustSpeed','Rescales velocity using approximate fixed8 square root; speeds below supplied threshold reset to512 and speeds above3840 cap there.',['speedFloorThreshold','speedDelta']);
method('vn','a','(II)V','redirectVelocity','Sets velocity from supplied angle at measured current speed; canonical guard6546 avoids unrelated timer mutation.',['obfuscationGuard','angle']);
method('vn','a','(Lvo;I)V','positionOnPaddle','Positions ball above paddle with horizontal offset from retained launch angle; canonical guard0 preserves center history.',['paddle','obfuscationGuard']);
method('vn','<init>','(II)V','<init>','Retains launch angle and sets initial velocity at supplied speed.',['launchAngle','speed']);
method('vn','<init>','(Lvo;II)V','<init>','Creates launched ball and positions it above supplied paddle.',['paddle','launchAngle','speed']);
field('vo','D','I','reboundSpeedStage','Starts at1, increments to8, contributes sixteen speed units per stage on top-face rebound and is packed in the snapshot size byte.');
field('vo','z','I','catchTicks','Timed paddle effect: positive value catches contacted balls into queuedBalls; power-up14 adds150 ticks and power-up9 clears it.');
method('vo','b','(Z)V','increaseReboundSpeed','Increments rebound stage until8; canonical true guard retains static resources.',['obfuscationGuard']);
method('bn','a','(BLj;Lno;)V','onCircleContact','Base contact relocates circle to collision-scratch coordinates; brick/paddle overrides update reflected velocity and game state.',['obfuscationGuard','board','circle']);
for(const [original,type,to,evidence] of [
 ['N','I','flags','Brick flags: bit2 permits power-up drops; bit4 enables waypoint motion; bit1 retains special contact behavior.'],
 ['R','I','pendingTypeId','-1 means no scheduled type change;0 schedules removal; positive value is applied after the transition countdown.'],
 ['B','I','transitionCode','Numeric hit/type-change animation code; its encoding remains qualified.'],
 ['H','I','portalIndex','Index assigned only to type28 portal bricks in the board portal table; used to choose a different teleport destination.'],
 ['P','[Lee;','waypoints','Ordered motion path waypoints copied from intrusive path nodes.'],
 ['G','I','pathDurationTicks','Total cyclic duration copied from motion path; elapsed motion wraps modulo this duration.'],
 ['J','I','motionElapsedTicks','Motion elapsed time from constructor/snapshot; advancing the segment wraps it modulo path duration.'],
 ['S','I','segmentElapsedTicks','Elapsed time within current segment; interpolation scales endpoint displacement by this value.'],
 ['C','I','destinationWaypointIndex','Current destination waypoint; advancing wraps this index modulo waypoint count.'],
 ['v','I','sourceWaypointIndex','Current source waypoint; advancing wraps this index modulo waypoint count.'],
])field('on',original,type,to,evidence);
field('j','z','[Lvl;','brickGroups','Board owns deques of bricks; match scans every group for contacts, type transitions and waypoint motion.');
field('cl','u','I','waypointCount','Snapshot decoder reads this many waypoint records; path checksum includes this serialized count.');
field('cl','p','Lvl;','waypoints','Intrusive deque of waypoint records; attachMotionPath copies its order.');
field('cl','t','I','durationTicks','Sum of decoded destination waypoint durations.');
field('ee','t','I','durationTicks','Destination segment duration in ticks; interpolation divides displacement by this value.');
method('ee','<init>','(IIIII)V','<init>','Retains moving-body waypoint coordinates/velocities/type.',['x256','y256','velocityX256','velocityY256','typeId']);
method('on','a','(Lcl;B)V','attachMotionPath','Copies nonempty path, selects the segment from elapsed motion and initializes segment-relative time; canonical guard -105.',['path','obfuscationGuard']);
method('on','a','(Lcl;ZI)V','setMotionPath','Attaches path then interpolates position and either segment velocity or zero; guard4.',['path','includeVelocity','obfuscationGuard']);
method('on','a','(BZ)V','interpolateMotion','Uses source/destination positions, destination duration and segment-relative time; canonical byte guard above33.',['obfuscationGuard','includeVelocity']);
method('on','f','(I)V','advanceMotionSegment','Wraps source/destination indices and global motion time; clears segment-relative time; guard above61.',['obfuscationGuard']);
method('on','a','(Lj;I)V','dropPowerUp','When flag bit2 and board drop cycle permit, appends falling power-up at brick center/below bottom edge; guard15165.',['board','obfuscationGuard']);
method('kj','a','(II)I','approximateSqrt256','Integer square-root estimate scaled by256 using normalized lookup and powers of two; negatives throw and guard2 preserves static state.',['value','obfuscationGuard']);
for(const [owner,signature,ordinal,original,to,evidence] of [
 ['on','a(BZ)V',0,'var6','sourceWaypoint','Current segment source position.'],
 ['on','a(BZ)V',1,'var4','destinationWaypoint','Current segment destination position and duration.'],
 ['on','a(BZ)V',2,'var5','durationTicks','Destination segment duration used for interpolation and velocity division.'],
 ['on','a(Lcl;B)V',0,'var3_int','waypointIndex','Index used while copying the path node order.'],
 ['on','a(Lcl;B)V',1,'var4_ref_ee','waypoint','Current waypoint copied from the path deque.'],
 ['on','a(Lcl;B)V',2,'incrementValue$0','copiedIndex','Previous array index captured before increment.'],
 ['on','a(Lcl;B)V',3,'var4','segmentStartTick','Elapsed sum at the selected segment start.'],
 ['on','a(Lcl;B)V',5,'var3_intLifetime1','segmentEndTick','Accumulated segment duration used to select elapsed-motion segment.'],
 ['on','f(I)V',0,'fieldTemp$0','nextDestinationIndex','Destination index before modulo wrapping.'],
 ['on','f(I)V',1,'fieldTemp$1','nextSourceIndex','Source index before modulo wrapping.'],
 ['vn','c(II)V',0,'var3','currentSpeed','Measured scalar speed used to rescale velocity components.'],
 ['vn','c(II)V',1,'var4','targetSpeed','Requested speed after floor reset and upper cap.'],
])local(owner,signature,ordinal,original,to,evidence);
for(const [owner,desc,params,evidence] of [
 ['vi','(IIIII)V',['x256','y256','velocityX256','velocityY256','typeId'],'Retains common position/velocity/type state.'],
 ['bn','(IIIIIII)V',['x256','y256','velocityX256','velocityY256','width256','height256','typeId'],'Retains common body and rectangle dimensions.'],
 ['no','(IIIIII)V',['x256','y256','velocityX256','velocityY256','radius256','typeId'],'Retains common body and circle radius.'],
 ['vo','(IIII)V',['centerX256','y256','controlMode','boardSpan256'],'Constructs15-pixel-high paddle and resets its88-pixel width.'],
 ['vn','(IIII)V',['x256','y256','velocityX256','velocityY256'],'Constructs radius-six ball and center-coordinate histories.'],
 ['on','(IIIIIIII)V',['x256','y256','velocityX256','velocityY256','typeId','brickFlags','brickState','motionElapsedTicks'],'Constructs34-by16-pixel brick, retains flags/qualified state and initializes elapsed cyclic motion.'],
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
`| ${link('nm')} / ${link('vl')} | Intrusive ownership and deque traversal/transfer. |`,
`| ${link('hp')} / ${link('ao')} | Absolute indices, circular retention and future/erased history boundaries. |`,
`| ${link('ge')} / ${link('ul')} | Falling/scheduled power-ups and score-popup lifetime. |`,
`| ${link('cl')} / ${link('ee')} | Cyclic waypoint order, destination duration and integer position/velocity interpolation. |`,
`| ${link('wq')} / ${link('pi')} / ${link('mj')} | Big-endian bytes, compact integers, strings, bit streams, cipher arithmetic and body snapshots. |`,
`| ${link('fo')} / ${link('qc')} | Deterministic board/cipher random state and queued gameplay audio codes/details. |`,
`| ${link('oi')} → ${link('nc')} / ${link('wk')} / ${link('mq')} | Level order, pack payloads, metadata and archive loading. |`,
`| ${link('dq')} / ${link('kq')} | Level versions0–5, brick groups, paths and retained integer state. |`,
`| ${link('lb')} / ${link('mn')} / ${link('jp')} / ${link('fb')} | Pixel targets, clipping, cropped RGB/ARGB sprites and transforms. |`,
`| ${link('tk')} | Secondary cache links/key independent of primary intrusive ownership. |`,
`| ${link('km')} / ${link('q')} / ${link('re')} | Button geometry, selected index, input codes and menu hooks. |`,
`| ${link('rp')} / ${link('ud')} / ${link('de')} / ${link('vp')} / ${link('of')} | Main menu, level selection, membership benefits, timed splash and blank screens. |`,
`| ${link('wg')} | Canvas focus boundary and screen registry helper. |`,
`| ${link('uj')} / ${link('dm')} / ${link('gk')} / ${link('qk')} | Level-number scrolling/selection, mouse snapshots and accumulated wheel input. |`, '',
'Focused raw/named probes check body geometry, paddle sizes, player masks, deque ownership, histories, power-ups, waypoint motion, selected contacts, packet operations and body/path snapshots. ISAAC fixtures use an independent unsigned-word model anchored to [Bob Jenkins’s published vectors](https://burtleburtle.net/bob/rand/randvect.txt), then compare seeded words/state, refill/counter boundaries, bounded rejection, shuffling, board random-call accounting and opcode bytes. Audio fixtures check event construction; playback remains unverified. The client flag uses a headless Applet-compatible shim and board/match construction is bypassed. Full board snapshots, swept collision detection, gameplay, score accounting, live multiplayer and browser/phone behavior remain unverified.','',
'Level fixtures check sequence order/repeats and caller-owned arrays, metadata labels/fields, payload-only pack appends, empty pack loading, all versions0–5, legacy regrouping, generated borders, path counts, wrapper delegation and early rejection. They retain negative-version default bricks and unchanged metadata after payload append. Metadata attribute byte/word and pack completion word remain qualified. Nonempty archive retrieval, full board initialization and rendered level selection remain unverified.','',
'Pixel fixtures check clipped solid/alpha fills and lines, darkening/grayscale, clip save/restore/reset, clear bounds, RGB copy/zero transparency and ARGB per-pixel rounding. Sprite fixtures check crop placement, copies, mirrors, quarter-turns, hit testing and raster binding. Secondary-link fixtures keep primary ownership intact. Gradients, arbitrary lines, transparent-border trimming, image decoding and full browser presentation remain unverified.','',
'Menu fixtures check a real base-menu subclass, button rectangles/lookup/markers, entry selection, key-code predicates, horizontal wrap/held suppression, direct selection and registry bounds. Blank/benefits/splash constructors retain their IDs; canvas focus-loss callbacks retain their latch. Other screen roles come from registration and inspected callers. Level-list fixtures preserve row geometry, unclamped/direct and clamped/delta scrolling, first/last selection, numeric key navigation and pointer-selection sentinels. Mouse fixtures exercise AWT callbacks, frame latches, wheel polling and the reflective wheel factory (including its owned class-name literal). Preview fixtures bypass screen construction and check decoding/path attachment, fixed8 bounds, excluded/border bricks, stationary preview velocity and repeated clearing. Font metrics are controlled; OS event dispatch, list rendering, full menu startup, action dispatch, transition installation and rendered menu flows remain unverified.','',
`Decompiler source commit: ${rules.generators.javaTools.commit}. Tracked-source Git tar SHA-256: ${rules.generators.javaTools.trackedSourceTarSha256}. This identifies decompiler source, not a gamepack JAR.`, ''].join('\n');}
export function buildBrickManifest(){const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'brick-naming-rules-'));try{
 const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout),record=catalog.publication.games.brickabrac;
 const rules={schema:1,game:'brickabrac',version:9,source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/brickabrac'},inputTreeSha256:record.sources.sha256};
 const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary),helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
 captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');fs.writeFileSync(files,sourceInventory(input).map(f=>f.path).join('\n')+'\n');captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(l=>l.split('\t'));
 rules.renames=buildBrickRules(input,rows);const symbols=new Set(rules.renames.map(r=>r.symbol));rules.classNameLiterals={policy:'direct-owned-class-for-name',expectedEdits:rows.filter(r=>r[0]==='S'&&symbols.has(r[4])).length};rules.labels={policy:'lexical-targets',expectedEdits:rows.filter(r=>['T','B','N'].includes(r[0])&&symbols.has(r[4])).length};if(rows.some(r=>r[0]==='U'&&symbols.has(r[4])))throw new Error('Unsupported escaped class-name literal');
 const archive=path.join(temporary,'decompiler-source.tar');captureProcess('git',['-C',path.resolve(funorbRepository,'../java-tools'),'archive','--format=tar','--output='+archive,record.sourceGenerator.commit]);
 rules.publication={stubSourceTreeSha256:stubs.sourceTreeSha256,stubJarSha256:digest(fs.readFileSync(stubs.jar))};rules.readabilityWorkflow={repository:'Kreijstal/dekobloko-work',files:Object.fromEntries(workflowFiles.map(file=>[file,digest(fs.readFileSync(path.join(workflowRoot,file)))]))};rules.generators={javaTools:{...record.sourceGenerator,trackedSourceTarSha256:digest(fs.readFileSync(archive))},namingTool:verifyToolPin()};return rules;
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const rules=buildBrickManifest(),file=path.join(workflowRoot,'brickabrac-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==bytes)throw new Error('Brick-a-brac rules differ from regeneration');}else fs.writeFileSync(file,bytes);console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));}catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}}
