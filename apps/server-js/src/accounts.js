'use strict';

// Port of dekobloko_server/accounts.py.

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

class AuthResult {
  // Mirrors the frozen dataclass AuthResult(ok, display_name, reason).
  constructor(ok, display_name, reason) {
    this.ok = ok;
    this.display_name = display_name;
    this.reason = reason;
    Object.freeze(this);
  }
}

function normalize(username) {
  return username.trim().toLowerCase();
}

function passwordHash(password) {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

class AccountStore {
  constructor(path_, auto_register) {
    this.path = path_;
    this.auto_register = auto_register;
    this.accounts = {};
    if (fs.existsSync(path_)) {
      const loaded = JSON.parse(fs.readFileSync(path_, 'utf8'));
      this.accounts = Object.assign({}, loaded.accounts || {});
    }
  }

  authenticate(username, password) {
    const normalized = normalize(username);
    const existing = this.accounts[normalized];
    if (existing === undefined) {
      if (!this.auto_register) {
        return new AuthResult(false, username, "unknown account");
      }
      this.accounts[normalized] = {
        display_name: username || "Player",
        password_sha256: passwordHash(password),
      };
      this._save();
      return new AuthResult(true, username || "Player", "auto-registered");
    }
    if (existing.password_sha256 !== passwordHash(password)) {
      return new AuthResult(
        false, existing.display_name !== undefined ? existing.display_name : username, "bad password");
    }
    return new AuthResult(
      true, existing.display_name !== undefined ? existing.display_name : username, "ok");
  }

  _save() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true });
    // json.dump(..., sort_keys=True) parity: sorted account keys.
    const sortedAccounts = {};
    for (const key of Object.keys(this.accounts).sort()) {
      sortedAccounts[key] = this.accounts[key];
    }
    fs.writeFileSync(this.path, JSON.stringify({ accounts: sortedAccounts }, null, 2) + '\n');
  }

  // Stable per-account id sent to the client at login. Derived from the name
  // so it survives restarts; see accounts.py for the reconnect identity story.
  player_id(username) {
    const normalized = normalize(username);
    const digest = createHash('sha256').update(normalized, 'utf8').digest();
    return (0x10000000 + (digest.readUInt32BE(0) & 0x0fffffff)) >>> 0;
  }

  username_for_player_id(player_id) {
    if (!(player_id > 0)) return null;
    for (const name of Object.keys(this.accounts)) {
      if (this.player_id(name) === player_id) return name;
    }
    return null;
  }
}

module.exports = { AuthResult, AccountStore, normalize, passwordHash };
