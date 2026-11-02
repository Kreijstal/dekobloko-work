import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewedManifest} from './reviewed-game.mjs';
import {workflowRoot} from './game-export.mjs';

// Identities below belong to the pinned Virogrid export (an Ataxx-style
// clone/jump capture game with a 3D board and a FunOrb multiplayer lobby).
const classes = {
  l: ['IntrusiveNode', 'Long key plus two reciprocal links; unlink removes it from a ring.'],
  wb: ['DualLinkNode', 'IntrusiveNode subclass with an independent second link pair and long key.'],
  p: ['IntrusiveDeque', 'Sentinel-based ring of IntrusiveNode with insertion, removal and traversal.'],
  ma: ['IntrusiveDequeCursor', 'Cursor constructed from an IntrusiveDeque, used to iterate nodes.'],
  uk: ['GameApplet', 'Abstract Applet implementing Runnable and focus/window listeners.'],
  jc: ['PacketBuffer', 'IntrusiveNode with a byte payload and cursor, big-endian primitive, string and RSA operations.'],
  uf: ['GameBoard', 'Owns the byte grid of cells (-1 empty, 0/1 players) and applies clone/jump moves with captures.'],
  m: ['CellAnimator', 'Mirrors the board grid and queues CellFlip animations for cells whose owner changed.'],
  fb: ['CellFlip', 'IntrusiveNode animating one cell through three phases before updating the displayed owner.'],
  me: ['MouseInputHandler', 'Implements MouseListener, MouseMotionListener and FocusListener to track the pointer.'],
  ld: ['GameKeyHandler', 'Implements KeyListener and FocusListener to record key state.'],
  cb: ['MouseWheelInput', 'Abstract wheel-input hook with component registration and a delta query.'],
  hb: ['MouseWheelHandler', 'MouseWheelInput subclass implementing MouseWheelListener.'],
  el: ['BufferedSocket', 'Runnable owning a Socket with input/output streams and a write buffer.'],
  pd: ['PlatformTaskDispatcher', 'Runnable owning a Thread, an EventQueue and a reflection Method for queued platform tasks.'],
  wf: ['RasterBuffer', 'Abstract int pixel array with an Image handed to the rasterizer.'],
  gd: ['ImageProducerRasterBuffer', 'RasterBuffer implementing ImageProducer to push pixels to an ImageConsumer.'],
  df: ['Rasterizer', 'Static pixel array with clip bounds and software pixel and rectangle drawing.'],
  rl: ['SpriteState', 'DualLinkNode subclass holding the full and trimmed dimension and offset integers.'],
  mg: ['Sprite', 'SpriteState subclass owning an int pixel array with software blits.'],
  eh: ['Js5Archive', 'Synchronized lookups of byte arrays by group and file index or name over cached Object arrays.'],
  in: ['AudioStream', 'IntrusiveNode subclass with an abstract fill of an int sample buffer and a linked next stream.'],
  sc: ['MusicTrack', 'Loaded from the archive by name for the title screen and in-game tracks.'],
  fm: ['WhirlpoolDigest', 'Keeps a 32-byte bit-length counter, a 64-byte block and eight long state words.'],
  fi: ['UiWidget', 'IntrusiveNode base widget with a listener, text and bounds fields, hit tests and key and click handlers.'],
  fd: ['WidgetContainer', 'UiWidget owning an IntrusiveDeque of children traversed with cursors for layout, input and hit tests.'],
  ic: ['GameSession', 'Constructs a GameBoard and CellAnimator and drives turn text, timers and board input.'],
};
const members = {};
const field = (owner, original, descriptor, to, evidence) =>
  members[`F:${owner}.field_${original}:${descriptor}`] = {to, evidence};
const method = (owner, original, descriptor, to, evidence) =>
  members[`M:${owner}.${original}${descriptor}`] = {to, evidence};

const node = 'IntrusiveDeque unlinks a node by rewiring these links.';
field('l', 'a', 'Ll;', 'next', node);
field('l', 'f', 'Ll;', 'previous', node);
field('l', 'd', 'J', 'key', 'Hash and deque lookups compare this long key.');
field('jc', 'g', '[B', 'payload', 'Every read and write indexes this byte array at the cursor.');
field('jc', 'l', 'I', 'position', 'Reads and writes advance this cursor.');
method('jc', 'g', '(I)I', 'readUnsignedByte', 'Returns one byte masked with 255 and advances the cursor.');
method('jc', 'a', '(B)B', 'readByte', 'Returns one signed byte and advances the cursor.');
method('jc', 'c', '(B)I', 'readUnsignedShort', 'Combines two bytes big-endian and advances the cursor by two.');
method('jc', 'a', '(I)I', 'readMedium', 'Combines three bytes big-endian and advances the cursor by three.');
method('jc', 'd', '(B)I', 'readInt', 'Combines four bytes big-endian and advances the cursor by four.');
method('jc', 'e', '(I)Z', 'verifyChecksum', 'Backs up four bytes and compares the trailing int with a checksum of the preceding bytes.');
method('jc', 'd', '(I)I', 'readSignedSmart', 'Reads one byte minus 64 or two bytes minus 49152 depending on the first byte.');
method('jc', 'c', '(IB)V', 'writeSignedSmart', 'Writes a value in the one- or two-byte signed range and rejects others.');
method('jc', 'f', '(II)V', 'writeSmart', 'Writes a value below 128 as one byte and below 32768 as two bytes.');
field('uf', 'C', '[[B', 'cells', 'Holds -1 for empty and 0 or 1 for each player; initialised with four corner pieces.');
field('uf', 'z', '[I', 'pieceCounts', 'Recount loops increment one counter per player owning a cell.');
field('uf', 'A', 'I', 'currentPlayer', 'advanceTurn steps it modulo two and the UI compares it with the local player.');
field('uf', 'E', 'Z', 'finished', 'advanceTurn and applyMove throw IllegalStateException when it is set.');
field('uf', 'u', 'I', 'turnCount', 'advanceTurn increments it once per turn.');
field('uf', 'c', '[Ljava/lang/String;', 'playerNames', 'The constructor requires exactly two names and the UI prints them as the winner.');
method('uf', 'a', '(IIBII)I', 'classifyMove', 'Returns 0 for a one-step clone, 1 for a two-step jump and -1 otherwise onto an empty cell.');
method('uf', 'a', '(IIBIII)I', 'applyMove', 'Places or moves the piece, converts adjacent opposing cells and returns the capture count.');
method('uf', 'a', '(IIIIII)Z', 'isLegalMove', 'Requires a valid classified move from a cell owned by the given player.');
method('uf', 'c', '(I)Z', 'checkGameEnd', 'Counts pieces and sets the winner when the grid is full or a player has none.');
method('uf', 'a', '(B)V', 'recountPieces', 'Counts pieces per player and flags a full board or a wiped-out player.');
method('uf', 'b', '(I)V', 'advanceTurn', 'Increments the turn count and moves to the next player not in the eliminated mask.');
method('uf', 'd', '(II)V', 'finishGame', 'Stores the winner (or -1 for a draw) and marks the board finished.');
method('uf', 'd', '(I)V', 'restart', 'Rebuilds the grid, clears flags and alternates the starting player.');
method('uf', 'a', '(BIIB)Z', 'cellEquals', 'Bounds-checks a cell and compares it with the given value.');
method('uf', 'a', '(Ljc;B)V', 'readCells', 'Fills the grid from a packet buffer when bit 2 of the flag byte is set.');
method('uf', 'a', '(III)V', 'setTurn', 'Stores the current player and the turn counter.');
method('uf', 'b', '(II)V', 'collectBestMoves', 'Enumerates all clone and jump offsets for the current player at AI level 1, 2 or 3 and keeps the top-scoring candidates.');
method('uf', 'b', '(IIIIII)V', 'recordCandidate', 'Appends a move to the candidate arrays unless its score is below the best, clearing them when it is higher.');
field('uf', 'f', 'I', 'candidateCount', 'recordCandidate increments it per stored move and collectBestMoves resets it.');
field('uf', 'l', 'I', 'bestScore', 'recordCandidate compares each move score against it.');
field('m', 'l', 'Luf;', 'board', 'Every grid comparison reads the board cells.');
field('m', 'd', '[[B', 'displayedCells', 'Copied from the board and updated when a flip animation finishes.');
field('m', 'g', 'Lp;', 'flips', 'Deque of CellFlip nodes advanced each tick.');
method('m', 'a', '(I)V', 'advanceFlips', 'Steps each CellFlip through its phases and writes the new owner when finished.');
method('m', 'a', '(Z)V', 'resetToBoard', 'Copies the board cells to the displayed grid and clears the flip deque.');
method('m', 'a', '(ZI)V', 'syncWithBoard', 'Queues a CellFlip for each cell whose owner differs from the board.');
field('fb', 'j', 'I', 'phase', 'advanceFlips switches on values 0, 1 and 2.');
method('ic', 'b', '(B)V', 'resign', 'Offline it makes the opponent the winner; online it sends a packet instead.');
method('ic', 'a', '(I)V', 'layoutBoard', 'Computes the cell size and offsets that fit the grid into a 360 by 300 area.');
method('ic', 'c', '(II)V', 'chooseAiMove', 'Collects the best candidate moves and picks one by tick modulo the candidate count.');
field('ic', 'r', 'I', 'cellSize', 'layoutBoard sets it to the smaller of the two area-over-grid divisions.');
method('ic', 'a', '(IZ)V', 'tick', 'Per-frame update: counts ticks, runs the board hover pulse, turn timer and flip animations.');
field('ic', 'w', 'I', 'turnTimer', 'tick decrements it and chooses an AI move when it reaches zero.');
field('ic', 'j', 'I', 'tickCount', 'tick increments it and the end-of-game sounds key off it modulo 20.');
method('ic', 'a', '(IIIII)V', 'performMove', 'Applies the move to the board, syncs the animator, checks for game end, else advances the turn and resets the timer.');
method('ic', 'a', '(B)V', 'restartGame', 'Online it sends a request packet; offline it restarts the board and rebuilds the animator.');
method('ic', 'a', '(II)I', 'cellScreenY', 'Converts a grid index to a screen coordinate using the cell size and board offset.');
method('ic', 'a', '(ZII)I', 'cellScreenX', 'Converts a grid index to a screen coordinate from either side using the cell size and board offset.');
method('ic', 'e', '(I)I', 'turnPulse', 'Triangle wave of the tick counter whose sign depends on the current player.');
method('ic', 'b', '(IZ)V', 'drawStatusPanel', 'Draws both piece counts and the winner or turn text from the board state.');
method('uk', 'c', '(I)V', 'tickGame', 'The per-tick method samples a 32-entry clock ring and then calls this.');
method('uk', 'c', '(Z)V', 'initializeGame', 'Called once from run after the canvas is created and before the tick loop.');
method('uk', 'd', '(I)V', 'shutdown', 'Called on the exit path of run before System.exit.');
method('uk', 'a', '(Z)V', 'runTick', 'Samples the tick clock into a 32-entry ring and calls tickGame.');
field('fb', 'g', 'I', 'row', 'advanceFlips writes displayedCells at this first index.');
field('fb', 'k', 'I', 'column', 'advanceFlips writes displayedCells at this second index.');
field('fb', 'q', 'Z', 'newOwnerIsFirstPlayer', 'advanceFlips stores 0 into the displayed cell when set and 1 otherwise.');
method('jc', 'a', '(Ljava/lang/String;B)V', 'writeString', 'Rejects NUL characters, writes the encoded text and a trailing zero byte.');
method('jc', 'b', '(Ljava/lang/String;B)V', 'writeZeroPrefixedString', 'Rejects NUL characters and writes a zero byte, the encoded text and a trailing zero byte.');
method('jc', 'h', '(I)Ljava/lang/String;', 'readString', 'Scans to the zero terminator and decodes the bytes between.');
method('jc', 'f', '(I)Ljava/lang/String;', 'readOptionalString', 'Returns null for a leading zero byte and otherwise reads a string.');
method('jc', 'a', '(Ljava/math/BigInteger;Ljava/math/BigInteger;B)V', 'encryptRsa', 'Replaces the buffer with the modPow of its bytes under the given exponent and modulus.');
method('jc', 'd', '(Z)I', 'readLargeSmart', 'Reads an int when the next byte is negative and otherwise an unsigned short.');
field('uf', 'n', 'Z', 'boardFilled', 'Set when no empty cell remains after a recount.');
field('uf', 'x', 'Z', 'playerWipedOut', 'Set when a recount finds one player with zero pieces.');
field('uf', 'k', 'I', 'lastMoveSourceRow', 'applyMove stores its first index argument, the source row, here.');
field('uf', 'a', 'I', 'lastMoveSourceColumn', 'applyMove stores its second index argument, the source column, here.');
field('uf', 'B', 'I', 'lastMovePlayer', 'applyMove stores the moving player here.');
field('uf', 'm', 'I', 'lastMoveDestRow', 'applyMove stores the destination row, the first cell index it writes, here.');
field('uf', 'w', 'I', 'lastMoveDestColumn', 'applyMove stores the destination column, the second cell index it writes, here.');
field('uf', 'e', '[I', 'candidateDestRows', 'recordCandidate stores the destination row of each candidate move.');
field('uf', 'G', '[I', 'candidateDestColumns', 'recordCandidate stores the destination column of each candidate move.');
field('uf', 'q', '[I', 'candidateSourceRows', 'recordCandidate stores the source row of each candidate move.');
field('uf', 't', '[I', 'candidateSourceColumns', 'recordCandidate stores the source column of each candidate move.');
field('m', 'c', 'I', 'selectedRow', 'chooseAiMove resets it to -1 together with selectedColumn.');
field('m', 'k', 'I', 'selectedColumn', 'GameSession passes it as the source column to classifyMove.');
field('ic', 'x', 'I', 'hoverRow', 'tick compares it with the row loop index to find the hovered cell.');
field('ic', 'h', 'I', 'hoverColumn', 'tick compares it with the column loop index to find the hovered cell.');
field('ic', 'g', 'Z', 'online', 'Moves, resign and restart send packets instead of acting locally when it is set.');
field('uf', 'y', 'I', 'timeSetting', 'GameSession indexes the per-move time table with it to reset the turn timer.');
field('uf', 's', 'I', 'sizeSetting', 'The constructor indexes the 7, 9 and 11 grid size table with it.');
field('ra', 'a', '[I', 'gridSizes', 'Holds the three board edge lengths 7, 9 and 11.');
field('sh', 'yb', '[I', 'turnDurations', 'Holds descending per-move tick budgets from 6000 to 500.');
field('ic', 'C', 'Luf;', 'board', 'Constructed with the GameBoard and read for the turn state.');
field('ic', 'A', 'Lm;', 'animator', 'Constructed with the CellAnimator for the board.');
field('ic', 'e', 'I', 'localPlayer', 'Compared with the current player to decide whose turn text to show.');

export const config = {
  game: 'virogrid', version: 1, sourceCommit: '32e4691aae4850122db80d30c2db96a06b6b4029', classes, members,
  verifyCore: async () => ({status: 'not-run', note: 'Naming-only pass; no gameplay core fixtures.'}),
  workflowFiles: ['build-virogrid-rules.mjs', 'reproduce-virogrid.mjs', 'reviewed-game.mjs',
    'pinned-compiler.mjs', 'game-export.mjs', 'compilation-stubs.mjs'],
  readingGuide(rules, mapping) {
    return ['# Reading Virogrid', '',
      `This pass names ${Object.keys(classes).length} reviewed classes and ${Object.keys(members).length} members in ${mapping.files.length} source files. Unresolved roles keep their original names.`, '',
      'Start at `Virogrid`; the shared engine (nodes, deques, applet shell) uses the same role names as other FunOrb games.', ''].join('\n');
  },
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rules = buildReviewedManifest(config), file = path.join(workflowRoot, 'virogrid-rules.json');
    const bytes = JSON.stringify(rules, null, 2) + '\n';
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('Virogrid rules differ from regeneration');
    } else fs.writeFileSync(file, bytes);
    console.log(JSON.stringify({rules: rules.renames.length, reviewedClasses: Object.keys(classes).length, check: process.argv.includes('--check')}));
  } catch (error) {console.error(error.stderr?.toString() || error.stack); process.exitCode = 1;}
}
