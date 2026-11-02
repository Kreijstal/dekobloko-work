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
  qb: ['Model', 'Parsed from archive bytes into short vertex arrays and face arrays for the 3D pipeline.'],
  ol: ['WidgetListener', 'Single-method interface called with the source widget by click handlers.'],
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
method('uf', 'a', '(ZIBIIZII)I', 'scoreMove', 'Counts the converted neighbours (plus one for a clone), optionally writes them to the grid, and returns -1 for an invalid move.');
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
method('Virogrid', 'a', '(Leh;BLeh;Leh;Leh;Leh;)V', 'loadGraphics', 'Loads the fonts, starfield, logo, frame and icon sprites from the archives.');
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
method('uk', 'a', '(ILjava/lang/String;)V', 'redirectToErrorPage', 'Shows error_game_<code>.ws; callers pass wrongjava, crash and alreadyloaded.');
method('uk', 'a', '(BZ)V', 'terminate', 'Runs once under a synchronized flag, destroys the loader applet and calls the shutdown hooks.');
method('uk', 'e', '(I)V', 'recreateCanvas', 'Removes the old canvas from its parent, adds a new one of the configured size and then calls onCanvasCreated.');
method('uk', 'b', '(Z)V', 'onCanvasCreated', 'Called at the end of recreateCanvas after the new canvas is added and sized.');
field('fi', 'w', 'Lol;', 'listener', 'Constructors accept the listener argument and store it here.');
field('fd', 'z', 'Lp;', 'children', 'The constructor creates the IntrusiveDeque that layout, input and hit tests iterate.');
field('qk', 'd', '[Ljava/lang/String;', 'achievementTitles', 'Filled from the achievement_names text keys; the static initializer lists titles such as Perfect Jump.');
field('ak', 'b', '[Ljava/lang/String;', 'achievementCriteria', 'Filled from the achievement_criteria text keys; the initializer lists criteria such as Play five Rated games.');
field('mh', 'i', '[Ljava/lang/String;', 'aiLevelNames', 'Filled from the ailevelnames text keys.');
field('em', 'b', '[Ljava/lang/String;', 'instructionPages', 'Filled from the instructions_pages text keys.');
field('wf', 'e', '[Ljava/lang/String;', 'gameOptionLabels', 'Filled from the gameoptlabels text keys.');
field('cc', 'v', '[Ljava/lang/String;', 'detailNames', 'Filled from the DETAIL_NAMES text keys.');
field('wc', 'c', '[[Ljava/lang/String;', 'gameOptionNames', 'Filled from the gameoptnames,row,column text keys.');
field('mj', 'G', 'Ljava/lang/String;', 'textGamename', 'Assigned from the TEXT_GAMENAME text key.');
field('pc', 'a', 'Ljava/lang/String;', 'textCreateAccount1', 'Assigned from the TEXT_CREATE_ACCOUNT1 text key.');
field('dd', 'f', 'Ljava/lang/String;', 'textCreateAccount2', 'Assigned from the TEXT_CREATE_ACCOUNT2 text key.');
field('rb', 'd', 'Ljava/lang/String;', 'textFullscreenToggle', 'Assigned from the TEXT_FULLSCREEN_TOGGLE text key.');
field('ac', 'b', 'Ljava/lang/String;', 'textDetail', 'Assigned from the TEXT_DETAIL text key.');
field('pj', 'e', 'Ljava/lang/String;', 'textOptions', 'Assigned from the TEXT_OPTIONS text key.');
field('sm', 'd', 'Ljava/lang/String;', 'textRankingsBywinpercentage', 'Assigned from the TEXT_RANKINGS_BYWINPERCENTAGE text key.');
field('rf', 'f', 'Ljava/lang/String;', 'textYourcolour', 'Assigned from the TEXT_YOURCOLOUR text key.');
field('pc', 'e', 'Ljava/lang/String;', 'textOpponent', 'Assigned from the TEXT_OPPONENT text key.');
field('lm', 'k', 'Ljava/lang/String;', 'textPlayers', 'Assigned from the TEXT_PLAYERS text key.');
field('gf', 'B', 'Ljava/lang/String;', 'textYourTurnPlaying', 'Assigned from the TEXT_YOUR_TURN_PLAYING text key.');
field('ie', 'b', 'Ljava/lang/String;', 'textXTurnPlaying', 'Assigned from the TEXT_X_TURN_PLAYING text key.');
field('hc', 'b', 'Ljava/lang/String;', 'textXTurn', 'Assigned from the TEXT_X_TURN text key.');
field('pb', 'k', 'Ljava/lang/String;', 'textColourWhite', 'Assigned from the TEXT_COLOUR_WHITE text key.');
field('uk', 'g', 'Ljava/lang/String;', 'textColourBlue', 'Assigned from the TEXT_COLOUR_BLUE text key.');
field('sd', 'b', 'Ljava/lang/String;', 'text2d', 'Assigned from the TEXT_2D text key.');
field('ld', 'f', 'Ljava/lang/String;', 'text3d', 'Assigned from the TEXT_3D text key.');
field('sl', 'a', 'Ljava/lang/String;', 'textSwitch2d', 'Assigned from the TEXT_SWITCH_2D text key.');
field('o', 'a', 'Ljava/lang/String;', 'textSwitch3d', 'Assigned from the TEXT_SWITCH_3D text key.');
field('ai', 'b', 'Ljava/lang/String;', 'textBack', 'Assigned from the TEXT_BACK text key.');
field('fn', 'g', 'Ljava/lang/String;', 'textNotAvailableIn2d', 'Assigned from the TEXT_NOT_AVAILABLE_IN_2D text key.');
field('qm', 'Ob', 'Ljava/lang/String;', 'textError', 'Assigned from the TEXT_ERROR text key.');
field('hg', 'n', 'Ljava/lang/String;', 'textPlayAgain', 'Assigned from the TEXT_PLAY_AGAIN text key.');
field('dg', 'G', 'Ljava/lang/String;', 'textRatedAchievements', 'Assigned from the TEXT_RATED_ACHIEVEMENTS text key.');
field('ee', 'f', 'Ljava/lang/String;', 'textEndgameEntrapment', 'Assigned from the TEXT_ENDGAME_ENTRAPMENT text key.');
field('vc', 'db', 'Ljava/lang/String;', 'textEndgameEntrapmentYou', 'Assigned from the TEXT_ENDGAME_ENTRAPMENT_YOU text key.');
field('rc', 'i', 'Ljava/lang/String;', 'textEndgameBoardfilled', 'Assigned from the TEXT_ENDGAME_BOARDFILLED text key.');
field('fh', 'a', 'Ljava/lang/String;', 'textEndgameBoardfilledYou', 'Assigned from the TEXT_ENDGAME_BOARDFILLED_YOU text key.');
field('vf', 'd', 'Ljava/lang/String;', 'textEndgameBoardfilledDraw', 'Assigned from the TEXT_ENDGAME_BOARDFILLED_DRAW text key.');
field('cg', 'e', 'Ljava/lang/String;', 'textEndgameNopieces', 'Assigned from the TEXT_ENDGAME_NOPIECES text key.');
field('id', 'f', 'Ljava/lang/String;', 'textEndgameNopiecesYou', 'Assigned from the TEXT_ENDGAME_NOPIECES_YOU text key.');
field('dd', 'd', 'Ljava/lang/String;', 'textEndgameNotime', 'Assigned from the TEXT_ENDGAME_NOTIME text key.');
field('ao', 'Nb', 'Ljava/lang/String;', 'textEndgameNotimeYou', 'Assigned from the TEXT_ENDGAME_NOTIME_YOU text key.');
field('vm', 'a', 'Ljava/lang/String;', 'textEndgameResigned', 'Assigned from the TEXT_ENDGAME_RESIGNED text key.');
field('pg', 'a', 'Ljava/lang/String;', 'textEndgameResignedYou', 'Assigned from the TEXT_ENDGAME_RESIGNED_YOU text key.');
field('mc', 'd', 'Ljava/lang/String;', 'textViewcontrolsLeft', 'Assigned from the TEXT_VIEWCONTROLS_LEFT text key.');
field('pn', 'C', 'Ljava/lang/String;', 'textViewcontrolsRight', 'Assigned from the TEXT_VIEWCONTROLS_RIGHT text key.');
field('vb', 'i', 'Ljava/lang/String;', 'textViewcontrolsZoomout', 'Assigned from the TEXT_VIEWCONTROLS_ZOOMOUT text key.');
field('cb', 'b', 'Ljava/lang/String;', 'textViewcontrolsZoomin', 'Assigned from the TEXT_VIEWCONTROLS_ZOOMIN text key.');
field('ia', 'a', 'Ljava/lang/String;', 'textViewcontrolsCentre', 'Assigned from the TEXT_VIEWCONTROLS_CENTRE text key.');
field('um', 'Kb', 'Ljava/lang/String;', 'textViewcontrolsMode', 'Assigned from the TEXT_VIEWCONTROLS_MODE text key.');
field('em', 'e', 'Ljava/lang/String;', 'playernameHotseat2', 'Assigned from the PLAYERNAME_HOTSEAT_2 text key.');
field('mb', 'eb', 'Ljava/lang/String;', 'playernameHotseat1', 'Assigned from the PLAYERNAME_HOTSEAT_1 text key.');
field('jk', 'e', 'Ljava/lang/String;', 'textBootsequence', 'Assigned from the TEXT_BOOTSEQUENCE text key.');
field('ge', 'a', 'Ljava/lang/String;', 'textBootsequenceHalloween', 'Assigned from the TEXT_BOOTSEQUENCE_HALLOWEEN text key.');
field('cm', 'j', 'Ljava/lang/String;', 'hotseatmenulabel', 'Assigned from the hotseatmenulabel text key.');
field('pg', 'i', 'Ljava/lang/String;', 'hotseatoptionGridwidthColon', 'Assigned from the hotseatoption_gridwidth_colon text key.');
field('rk', 'b', 'Ljava/lang/String;', 'hotseatoptionTurndurationColon', 'Assigned from the hotseatoption_turnduration_colon text key.');
field('gh', 'Lb', 'Ljava/lang/String;', 'hotseatoptionAilevelColon', 'Assigned from the hotseatoption_ailevel_colon text key.');
field('ee', 'b', 'Ljava/lang/String;', 'tutorial1', 'Assigned from the tutorial1 text key.');
field('gl', 'h', 'Ljava/lang/String;', 'tutorial2', 'Assigned from the tutorial2 text key.');
field('fa', 'h', 'Ljava/lang/String;', 'tutorial3', 'Assigned from the tutorial3 text key.');
field('jd', 'a', 'Ljava/lang/String;', 'tutorial4', 'Assigned from the tutorial4 text key.');
field('mi', 'f', 'Ljava/lang/String;', 'textRemovedFromGame', 'Assigned from the text_removed_from_game text key.');
field('he', 'cc', 'Ljava/lang/String;', 'textLobbyPleaselogin', 'Assigned from the text_lobby_pleaselogin text key.');
field('hd', 'b', 'Lv;', 'standardFont', 'Loaded from the font resource in Virogrid.loadGraphics.');
field('vg', 'H', 'Lv;', 'smallFont', 'Loaded from the smallfont resource in Virogrid.loadGraphics.');
field('mc', 'b', 'Lv;', 'menuFont', 'Loaded from the menufont resource in Virogrid.loadGraphics.');
field('re', 'o', 'Lv;', 'tinyFont', 'Loaded from the tinyfont resource in Virogrid.loadGraphics.');
field('ib', 'b', '[Lmg;', 'frameSprites', 'Loaded from the frame resource in Virogrid.loadGraphics.');
field('kd', 'p', '[Lmg;', 'viewIcons', 'Loaded from the viewicons resource in Virogrid.loadGraphics.');
field('ak', 'e', 'Lmg;', 'lobbyIcon', 'Loaded from the lobbyicon resource in Virogrid.loadGraphics.');
field('cb', 'd', '[Lmg;', 'achievementIcons', 'Loaded from the achievements_large resource in Virogrid.loadGraphics.');
field('mj', 'F', 'Lmg;', 'unachievedIcon', 'Loaded from the unachieved resource in Virogrid.loadGraphics.');
field('ad', 'b', 'Lmg;', 'orbCoinIcon', 'Loaded from the orbcoin resource in Virogrid.loadGraphics.');
field('oi', 'c', '[Lsc;', 'musicTracks', 'Virogrid fills it with the title screen and three in-game tracks.');
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
