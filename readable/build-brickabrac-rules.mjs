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
};
const members={};
function field(owner,original,descriptor,to,evidence){members[`F:${owner}.field_${original}:${descriptor}`]={to,evidence};}
function method(owner,original,descriptor,to,evidence,parameters){const key=owner+'.'+original+descriptor;if(original!=='<init>')members['M:'+key]={to,evidence};for(const [ordinal,name] of Object.entries(parameters||{}))members['P:'+key+'#'+ordinal]={to:name,evidence};}
function local(owner,signature,ordinal,expectedOriginalName,to,evidence){members[`L:${owner}.${signature}#${ordinal}`]={to,expectedOriginalName,evidence};}
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
`| ${link('wq')} / ${link('pi')} / ${link('mj')} | Big-endian bytes, compact integers, strings, bit streams, cipher arithmetic and body snapshots. |`, '',
'Focused raw/named probes check body checksums/overlaps, paddle sizes, player masks, deque ownership, histories, popup expiry, scheduled power-up routing, ball effects, waypoint motion, selected brick contacts, packet primitives/strings/bits, CRC and block operations, and body/paddle/ball/brick/path snapshot decoding. Opcode fixtures check cipher arithmetic against a separate instance of the existing generator; the generator itself is not independently verified. The client branch flag is supplied by a headless Applet-compatible shim; board/match construction is bypassed. Contact fixtures supply scratch coordinates and cover two brick types. Full board snapshots, swept collision detection, gameplay, score accounting, live multiplayer and browser/phone behavior remain unverified.','',
`Decompiler source commit: ${rules.generators.javaTools.commit}. Tracked-source Git tar SHA-256: ${rules.generators.javaTools.trackedSourceTarSha256}. This identifies decompiler source, not a gamepack JAR.`, ''].join('\n');}
export function buildBrickManifest(){const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'brick-naming-rules-'));try{
 const catalog=JSON.parse(captureProcess('git',['-C',funorbRepository,'show',SOURCE_COMMIT+':decompilation-provenance.json']).stdout),record=catalog.publication.games.brickabrac;
 const rules={schema:1,game:'brickabrac',version:4,source:{repository:'Kreijstal/funorb-decompiled',commit:SOURCE_COMMIT,subdirectory:'games/brickabrac'},inputTreeSha256:record.sources.sha256};
 const input=archivedInput(rules,temporary),stubs=buildCompilationStubs(funorbRepository,temporary),helper=path.join(temporary,'helper'),compiled=path.join(temporary,'classes');fs.mkdirSync(helper);fs.mkdirSync(compiled);
 captureProcess('javac',['-encoding','UTF-8','-d',helper,path.join(workflowRoot,'tools/lib/ReadableJava.java')]);const files=path.join(temporary,'files'),audit=path.join(temporary,'audit.tsv');fs.writeFileSync(files,sourceInventory(input).map(f=>f.path).join('\n')+'\n');captureProcess('java',['-Xmx1024m','-cp',helper,'ReadableJava',input,files,audit,compiled,stubs.jar,'--class-name-literals','--labels']);const rows=fs.readFileSync(audit,'utf8').trimEnd().split('\n').map(l=>l.split('\t'));
 rules.renames=buildBrickRules(input,rows);const symbols=new Set(rules.renames.map(r=>r.symbol));rules.classNameLiterals={policy:'direct-owned-class-for-name',expectedEdits:rows.filter(r=>r[0]==='S'&&symbols.has(r[4])).length};rules.labels={policy:'lexical-targets',expectedEdits:rows.filter(r=>['T','B','N'].includes(r[0])&&symbols.has(r[4])).length};if(rows.some(r=>r[0]==='U'&&symbols.has(r[4])))throw new Error('Unsupported escaped class-name literal');
 const archive=path.join(temporary,'decompiler-source.tar');captureProcess('git',['-C',path.resolve(funorbRepository,'../java-tools'),'archive','--format=tar','--output='+archive,record.sourceGenerator.commit]);
 rules.publication={stubSourceTreeSha256:stubs.sourceTreeSha256,stubJarSha256:digest(fs.readFileSync(stubs.jar))};rules.readabilityWorkflow={repository:'Kreijstal/dekobloko-work',files:Object.fromEntries(workflowFiles.map(file=>[file,digest(fs.readFileSync(path.join(workflowRoot,file)))]))};rules.generators={javaTools:{...record.sourceGenerator,trackedSourceTarSha256:digest(fs.readFileSync(archive))},namingTool:verifyToolPin()};return rules;
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const rules=buildBrickManifest(),file=path.join(workflowRoot,'brickabrac-rules.json'),bytes=JSON.stringify(rules,null,2)+'\n';if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==bytes)throw new Error('Brick-a-brac rules differ from regeneration');}else fs.writeFileSync(file,bytes);console.log(JSON.stringify({rules:rules.renames.length,reviewedClasses:Object.keys(classes).length,check:process.argv.includes('--check')}));}catch(error){console.error(error.stderr?.toString()||error.message);process.exitCode=1;}}
