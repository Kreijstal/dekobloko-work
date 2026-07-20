from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path


@dataclass(frozen=True)
class AuthResult:
    ok: bool
    display_name: str
    reason: str


class AccountStore:
    def __init__(self, path: Path, auto_register: bool) -> None:
        self.path = path
        self.auto_register = auto_register
        self.accounts: dict[str, dict[str, str]] = {}
        if path.exists():
            with path.open("r", encoding="utf-8") as handle:
                loaded = json.load(handle)
            self.accounts = dict(loaded.get("accounts", {}))

    def authenticate(self, username: str, password: str) -> AuthResult:
        normalized = self._normalize(username)
        existing = self.accounts.get(normalized)
        if existing is None:
            if not self.auto_register:
                return AuthResult(False, username, "unknown account")
            self.accounts[normalized] = {
                "display_name": username or "Player",
                "password_sha256": self._password_hash(password),
            }
            self._save()
            return AuthResult(True, username or "Player", "auto-registered")

        if existing.get("password_sha256") != self._password_hash(password):
            return AuthResult(False, existing.get("display_name", username), "bad password")
        return AuthResult(True, existing.get("display_name", username), "ok")

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump({"accounts": self.accounts}, handle, indent=2, sort_keys=True)
            handle.write("\n")

    def player_id(self, username: str) -> int:
        """Stable per-account id sent to the client at login.

        This used to be a hardcoded 1 for every account, which caused real
        identity corruption: the client stores the id and sends it back in the
        USERNAME SLOT on every reconnect. Base37-decoding 1 yields "A", so any
        player who reconnected -- which happens on every return-to-main-menu --
        silently became account "a" and had their scores filed there.

        Deriving it from the account name makes the value round-trip to the
        right player, and is deterministic so it survives a restart without
        needing to be persisted.

        The offset keeps ids clear of the small integers a stray field might
        hold. It is NOT a guarantee of non-collision with a real packed name --
        username_for_player_id() only matches ids of accounts that exist, which
        is what actually makes the lookup safe.
        """
        normalized = self._normalize(username)
        digest = hashlib.sha256(normalized.encode("utf-8")).digest()
        return 0x1000_0000 | (int.from_bytes(digest[:4], "big") & 0x0FFF_FFFF)

    def username_for_player_id(self, player_id: int) -> str | None:
        """Reverse player_id() -- which account was this id issued to?

        Returns None when the value is not a known account's id, in which case
        the caller should treat the slot as a packed username as before.
        """
        if player_id <= 0:
            return None
        for name in self.accounts:
            if self.player_id(name) == player_id:
                return name
        return None

    @staticmethod
    def _normalize(username: str) -> str:
        return username.strip().lower()

    @staticmethod
    def _password_hash(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()
