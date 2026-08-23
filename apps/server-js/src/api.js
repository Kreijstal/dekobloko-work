'use strict';

// Port of dekobloko_server/api.py.
//
// Supported in-process API for lobby automation and alternate front ends.
// Python re-exports the lobby names verbatim; the one addition is a concrete
// LobbySession base class, because lobby.py's LobbySession is only a
// typing.Protocol (no runtime body) and JS has nothing to re-export for it.
// Defining the documented method surface here keeps api.LobbySession importable
// exactly like the Python name while staying duck-type compatible: every
// session object with these members satisfies it, no inheritance required.

const {
  CookedShape,
  GameOptions,
  HostedGame,
  LOBBY,
  Lobby,
  Piece,
} = require("./lobby.js");

/**
 * Structural mirror of lobby.py's LobbySession protocol. Subclassing is
 * optional -- HostedGame/Lobby only ever duck-type these members -- but the
 * class gives embedders a concrete base to build socket-free front ends on,
 * the same role BotLobbySession's send_* sinks fill.
 */
class LobbySession {
  constructor(display_name) {
    this.display_name = display_name;
    this.current_game = null;
    this.player_slot = null;
  }

  send_server_message(message) {}

  send_lobby_bootstrap() {}

  send_lobby_roster(rows) {}

  send_local_player_id(uid) {}

  send_lobby_event(payload) {}

  send_chat_payload(opcode, payload) {}

  send_match_start(game, local_slot) {}

  send_piece_event(
    player_slot,
    piece,
    speed_index,
    final_x = 0,
    final_y = 0,
    final_orientation = 0,
    finalize_argument = 0,
  ) {}

  send_cooked_shape(player_slot, shape) {}

  send_action_stream(player_slot, controls_payload) {}

  send_player_removed(player_slot, result_code) {}

  send_elimination_order(player_slot) {}

  send_full_state(player_slot, state_payload) {}

  send_match_result(winner_slot) {}

  send_rematch_state(player_mask) {}

  send_game_over() {}
}

module.exports = {
  CookedShape,
  GameOptions,
  HostedGame,
  LOBBY,
  Lobby,
  LobbySession,
  Piece,
};
