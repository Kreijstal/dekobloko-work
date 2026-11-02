// Reviewed names: containers, buffers, cryptography, network and platform shell.
import {cls, mem, fld, group} from './bachelorfridge-name-api.mjs';

// ---- Intrusive containers -------------------------------------------------
fld('bw', 'b', 'Lbw;', 'next', 'bw.a(Z) splices field_b/field_e out of the neighbours and clears both.');
fld('bw', 'e', 'Lbw;', 'previous', 'bw.a(Z) sets the previous node field_e to this.field_b before clearing it.');
fld('bw', 'c', 'J', 'key', 'Hash tables store their long lookup key in bw.field_c.');
mem('bw', 'a', '(Z)V', 'unlink', 'Joins the two neighbours and nulls both links.');
mem('bw', 'a', '(B)Z', 'isLinked', 'Returns whether the previous link is non-null.');
fld('eo', 'm', 'Leo;', 'secondaryNext', 'eo.b(int) joins field_m and field_i of the neighbours like bw unlink.');
fld('eo', 'i', 'Leo;', 'secondaryPrevious', 'eo.b(int) splices the secondary previous link out.');
fld('eo', 'h', 'J', 'secondaryKey', 'eo.d(int) returns field_h and a(boolean,long) stores it only while unlinked.');
mem('eo', 'b', '(I)V', 'unlinkSecondary', 'Splices the node out of the secondary link pair.');
mem('eo', 'a', '(I)Z', 'isSecondaryLinked', 'Returns whether the secondary previous link is non-null.');
mem('eo', 'a', '(ZJ)V', 'setSecondaryKey', 'Throws if still linked, otherwise stores the key.');

cls('eaa', 'IntrusiveDeque', 'Sentinel-based deque of bw nodes with first/next/last/previous walks and splicing.');
cls('rna', 'IntrusiveDequeCursor', 'Constructed from an eaa deque and walks its nodes through first/next/previous/last accessors.');
cls('js', 'IntrusiveNodeHashTable', 'Power-of-two bucket array of bw nodes with a long-keyed get and put.');
cls('wha', 'IterableNodeHashTable', 'Iterable bucket array of bw nodes with a long-keyed put and get.');
cls('np', 'NodeHashTableIterator', 'Iterator constructed from a wha table that walks its buckets.');
cls('wma', 'DualLinkNodeHashTable', 'Bucket array of eo nodes with a long-keyed get and put.');
cls('in', 'DualLinkDeque', 'Sentinel deque of eo nodes with insert and poll walks.');
cls('ou', 'IterableDualLinkDeque', 'Iterable deque of eo nodes that hands out an ev iterator.');
cls('ev', 'DualLinkDequeIterator', 'Iterator constructed from an ou deque that walks eo secondary links.');

// ---- Buffers and cryptography -------------------------------------------
cls('lu', 'PacketBuffer', 'bw subclass with a byte payload and cursor, big-endian reads and writes, strings, RSA and XTEA.');
fld('lu', 'h', '[B', 'payload', 'Every read and write indexes lu.field_h.');
fld('lu', 'g', 'I', 'position', 'Every read and write advances lu.field_g.');
group('lu', 'PacketBuffer primitive whose body shows the byte layout.', [
  ['e', '(II)V', 'writeInt'], ['d', '(II)V', 'writeByte'], ['c', '(II)V', 'writeMedium'], ['b', '(IJ)V', 'writeLong'],
  ['b', '(I)I', 'readUnsignedByte'], ['e', '(B)I', 'readUnsignedShort'], ['f', '(I)I', 'readInt'], ['c', '(I)J', 'readLong'],
  ['c', '(B)I', 'readSignedShort'], ['g', '(I)Ljava/lang/String;', 'readString'], ['a', '(BLjava/lang/String;)V', 'writeString'],
  ['g', '(B)Ljava/lang/String;', 'readNullableString'], ['d', '(I)I', 'readVarInt'], ['a', '(IB)V', 'writeVarInt'],
  ['a', '(Ljava/math/BigInteger;ILjava/math/BigInteger;)V', 'encryptRsa'], ['a', '(II[II)V', 'decryptXtea'], ['a', '([II)V', 'encryptXtea'],
  ['j', '(I)Z', 'verifyCrc'], ['f', '(B)I', 'readSmartInt'], ['e', '(I)I', 'readSignedSmart'], ['c', '(BI)V', 'writeSignedSmart'],
  ['b', '(IZ)V', 'writeSmart'], ['a', '(BI)V', 'writeLengthShort'], ['b', '(BI)V', 'writeLengthByte'],
]);
cls('pf', 'BitPacketBuffer', 'PacketBuffer subclass with a bit cursor and an ISAAC cipher applied to bytes it writes and reads.');
fld('pf', 'l', 'I', 'bitPosition', 'pf.d(int,byte) reads bits from field_l >> 3 and advances field_l.');
fld('pf', 'm', 'Lko;', 'cipher', 'pf adds and subtracts field_m.b(28602) from each byte.');
group('pf', 'BitPacketBuffer body mixes the cipher into bytes or moves between byte and bit cursors.', [
  ['i', '(B)V', 'endBitAccess'], ['m', '(I)V', 'startBitAccess'], ['d', '(IB)I', 'readBits'], ['c', '(IB)V', 'writeCipheredByte'],
  ['k', '(I)I', 'readCipheredByte'], ['b', '([II)V', 'seedCipher'], ['b', '([BIII)V', 'readCipheredBytes'],
]);
cls('ko', 'IsaacRandom', 'Two 256-entry int arrays, golden-ratio seed mixing and shift/xor generation passes.');
mem('ko', 'b', '(I)I', 'nextInt', 'Refills the batch when exhausted and returns the next result word.');
mem('ko', 'a', '(II)I', 'nextBounded', 'Rejection-samples nextInt against a positive bound and throws otherwise.');
cls('gi', 'ClientException', 'RuntimeException subclass keeping the wrapped Throwable and a context string.');
fld('gi', 'd', 'Ljava/lang/Throwable;', 'cause', 'gi constructor stores its Throwable argument here.');
fld('gi', 'e', 'Ljava/lang/String;', 'context', 'gi constructor stores its String argument here.');
mem('pe', 'a', '(Ljava/lang/Throwable;Ljava/lang/String;)Lgi;', 'wrapException', 'Every catch block in the game wraps its error with this call and a method tag.');

// ---- Network and platform ------------------------------------------------
cls('rma', 'SocketConnector', 'Abstract holder of host and port that creates a java.net.Socket.');
fld('rma', 'a', 'Ljava/lang/String;', 'host', 'dm writes rma.field_a into its CONNECT request.');
fld('rma', 'b', 'I', 'port', 'dm writes rma.field_b into its CONNECT request.');
cls('dm', 'ProxySocketConnector', 'SocketConnector that consults the ProxySelector and writes an HTTP CONNECT exchange.');
cls('pj', 'BufferedSocket', 'Runnable owning a Socket with input and output streams and a writer buffer.');
cls('ht', 'PlatformTaskDispatcher', 'Runnable queueing socket, reflection, frame and URL requests as eh tasks.');
cls('eh', 'PlatformTask', 'Request record with a volatile status and result filled by ht.');
cls('tca', 'JaggrabDownloader', 'Runnable that writes a JAGGRAB request line and reads the reply.');
cls('ea', 'DiskCacheWorker', 'Runnable thread handing se requests to ta cache stores.');
cls('se', 'DiskCacheRequest', 'cga request holding a ta store and a byte payload.');
cls('ta', 'SectorCacheStore', 'Reads and writes archive groups through two v cache files.');
cls('v', 'BufferedCacheFile', 'Buffers reads and writes over a file handle with separate read and write windows.');
cls('mfa', 'GameKeyHandler', 'Synchronized KeyListener and FocusListener recording key events.');
cls('nn', 'MouseInputHandler', 'Synchronized MouseListener, MouseMotionListener and FocusListener recording pointer events.');
cls('sca', 'MouseWheelInput', 'Abstract wheel-input hook registered against a Component.');
cls('qv', 'MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener and accumulating rotation.');
cls('kg', 'FullscreenFocusCanvas', 'Canvas with a FocusListener that repaints through update and paint.');
cls('hr', 'DelegatingCanvas', 'Canvas whose paint and update delegate to a wrapped Component.');
cls('br', 'CursorController', 'Wraps java.awt.Robot to move the mouse and set a custom cursor.');
cls('hma', 'AwtDisplayController', 'Switches display modes through java.awt.');
cls('qp', 'MicrosoftDisplayController', 'Implements IEnumModesCallback and collects Microsoft JVM display modes.');
cls('pq', 'MicrosoftCursorController', 'Sets cursors through the Microsoft JVM.');
