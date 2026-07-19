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

    @staticmethod
    def _normalize(username: str) -> str:
        return username.strip().lower()

    @staticmethod
    def _password_hash(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()
