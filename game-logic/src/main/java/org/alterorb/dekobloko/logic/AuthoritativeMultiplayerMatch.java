package org.alterorb.dekobloko.logic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.OptionalInt;

/**
 * Fixed-slot multiplayer state owned by a server. Clients contribute controls,
 * never placement, lives, elimination, or winner declarations.
 */
public final class AuthoritativeMultiplayerMatch {
    public enum Outcome { RUNNING, WON, DRAW }

    private final PlayerBucket[] players;
    private final DropTiming timing;
    private final int colorCount;
    private final FeedbackLevel feedbackLevel;
    private Outcome outcome = Outcome.RUNNING;
    private int winnerSlot = -1;

    public AuthoritativeMultiplayerMatch(int playerCount, int width, int height,
            DropTiming timing) {
        this(playerCount, width, height, timing, 7, FeedbackLevel.OFF);
    }

    public AuthoritativeMultiplayerMatch(int playerCount, int width, int height,
            DropTiming timing, int colorCount, FeedbackLevel feedbackLevel) {
        if (playerCount < 2 || playerCount > 8) {
            throw new IllegalArgumentException("multiplayer requires 2..8 players");
        }
        this.timing = java.util.Objects.requireNonNull(timing, "timing");
        if (colorCount < 1 || colorCount > 7) {
            throw new IllegalArgumentException("color count must be 1..7");
        }
        this.colorCount = colorCount;
        this.feedbackLevel = java.util.Objects.requireNonNull(feedbackLevel, "feedbackLevel");
        players = new PlayerBucket[playerCount];
        for (int slot = 0; slot < playerCount; slot++) {
            players[slot] = new PlayerBucket(new Board(width, height));
        }
    }

    public void spawn(int slot, Domino domino) {
        PlayerBucket player = livePlayer(slot);
        if (player.active != null) {
            throw new IllegalStateException("slot already has an active domino");
        }
        player.active = new ActiveDomino(player.board, domino, timing);
    }

    /** Applies the exact ordered tick masks from one C2S control batch. */
    public boolean applyControls(int slot, int... controls) {
        PlayerBucket player = livePlayer(slot);
        if (player.active == null) {
            throw new IllegalStateException("slot has no active domino");
        }
        for (int control : controls) {
            if (player.active.tick(control)) {
                return true;
            }
        }
        return false;
    }

    /** Finalizes the server-owned landed piece and updates lives/outcome. */
    public PieceLockResult finalizeLanded(int slot) {
        PlayerBucket player = livePlayer(slot);
        if (player.active == null) {
            throw new IllegalStateException("slot has no active domino");
        }
        PieceLockResult result = player.active.finalizePlacement(player.lives);
        player.active = null;
        player.lives = result.livesRemaining();
        player.lastResolutions.clear();
        if (player.lives == 0) {
            player.activeSlot = false;
            updateOutcome();
        } else {
            resolveCascades(player);
        }
        return result;
    }

    private void resolveCascades(PlayerBucket player) {
        while (true) {
            Resolution resolution = MatchRules.resolve(
                    player.board, colorCount, feedbackLevel);
            if (!resolution.changedBoard()) {
                return;
            }
            player.lastResolutions.add(resolution);
            player.board.collapseLooseTiles();
        }
    }

    /** Tombstones a disconnected/resigned slot without renumbering survivors. */
    public void eliminate(int slot) {
        PlayerBucket player = player(slot);
        if (!player.activeSlot) {
            return;
        }
        player.activeSlot = false;
        player.active = null;
        player.lives = 0;
        updateOutcome();
    }

    private void updateOutcome() {
        int liveCount = 0;
        int survivor = -1;
        for (int slot = 0; slot < players.length; slot++) {
            if (players[slot].activeSlot) {
                liveCount++;
                survivor = slot;
            }
        }
        if (liveCount == 1) {
            outcome = Outcome.WON;
            winnerSlot = survivor;
        } else if (liveCount == 0) {
            outcome = Outcome.DRAW;
            winnerSlot = -1;
        }
    }

    public Board board(int slot) { return player(slot).board; }
    public ActiveDomino activeDomino(int slot) { return player(slot).active; }
    public int lives(int slot) { return player(slot).lives; }
    public boolean isActive(int slot) { return player(slot).activeSlot; }
    public List<Resolution> lastResolutions(int slot) {
        return Collections.unmodifiableList(
                new ArrayList<Resolution>(player(slot).lastResolutions));
    }
    public int playerCount() { return players.length; }
    public Outcome outcome() { return outcome; }
    public OptionalInt winnerSlot() {
        return winnerSlot < 0 ? OptionalInt.empty() : OptionalInt.of(winnerSlot);
    }

    private PlayerBucket livePlayer(int slot) {
        PlayerBucket player = player(slot);
        if (!player.activeSlot || outcome != Outcome.RUNNING) {
            throw new IllegalStateException("slot is not active in a running match");
        }
        return player;
    }

    private PlayerBucket player(int slot) {
        if (slot < 0 || slot >= players.length) {
            throw new IndexOutOfBoundsException("invalid player slot: " + slot);
        }
        return players[slot];
    }

    private static final class PlayerBucket {
        private final Board board;
        private ActiveDomino active;
        private final List<Resolution> lastResolutions = new ArrayList<Resolution>();
        private int lives = 3;
        private boolean activeSlot = true;

        private PlayerBucket(Board board) {
            this.board = board;
        }
    }
}
