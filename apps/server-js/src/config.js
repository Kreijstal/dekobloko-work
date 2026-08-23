'use strict';

// Port of dekobloko_server/config.py.
//
// The Python side is a frozen dataclass, so the JS object is Object.freeze()d
// after construction. Path fields (cache_dir, jar_path, rsa_key_path,
// accounts_path) are plain strings here; Node has no pathlib and callers hand
// them to fs/path APIs unchanged. Field names keep snake_case so diffs against
// config.py stay mechanical.

const FIELDS = [
  'host',
  'http_port',
  'game_port1',
  'game_port2',
  'cache_dir',
  'jar_path',
  'rsa_key_path',
  'accounts_path',
  'auto_register',
  'servernum',
  'gamecrc',
  'instanceid',
  'member',
  'lang',
  'affid',
  'simplemode',
  'display_name',
  'player_id',
  'welcome_message',
];

class ServerConfig {
  constructor(fields) {
    for (const name of FIELDS) {
      if (!(name in fields)) {
        throw new TypeError('ServerConfig missing field: ' + name);
      }
      this[name] = fields[name];
    }
    Object.freeze(this);
  }

  // Mirrors the applet_params @property; returns a fresh mapping each call,
  // exactly like the Python property builds a new dict.
  get applet_params() {
    return {
      gameport1: String(this.game_port1),
      gameport2: String(this.game_port2),
      servernum: String(this.servernum),
      gamecrc: String(this.gamecrc),
      instanceid: String(this.instanceid),
      member: this.member,
      lang: String(this.lang),
      affid: String(this.affid),
      simplemode: this.simplemode,
    };
  }
}

module.exports = { ServerConfig };
