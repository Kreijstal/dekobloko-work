from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import threading

from dekobloko_server.accounts import AccountStore


class EscapeStore(AccountStore):
    """One shared, locked store for both TCP ports; one atomic state file."""

    def __init__(self, path: Path, auto_register: bool = True) -> None:
        self.lock = threading.RLock()
        super().__init__(path, auto_register)

    def authenticate(self, username: str, password: str):
        if not username.strip() or len(username.encode("cp1252", errors="replace")) > 80:
            from dekobloko_server.accounts import AuthResult
            return AuthResult(False, username, "invalid account name")
        with self.lock:
            return super().authenticate(username, password)

    def username_for_player_id(self, player_id: int) -> str | None:
        with self.lock:
            return super().username_for_player_id(player_id)

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        name = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.path.parent,
                                             prefix=self.path.name + ".", delete=False) as handle:
                name = handle.name
                json.dump({"accounts": self.accounts}, handle, sort_keys=True, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(name, self.path)
        finally:
            if name is not None and os.path.exists(name):
                os.unlink(name)

    def _data(self, username: str) -> dict:
        return self.accounts[self._normalize(username)].setdefault("escapevector", {})

    def progress(self, username: str, mode: int) -> int:
        with self.lock:
            return self._data(username).get("progress", {}).get(str(mode), 0)

    def complete_level(self, username: str, mode: int, level: int) -> None:
        # gn.a records the cleared level; gn.c consumes the next available one.
        # Each campaign has 16 levels (fh.c). Mode 3 uses achievement bits.
        if mode not in (0, 1, 2) or not 0 <= level < 16:
            raise ValueError("invalid campaign progress")
        with self.lock:
            progress = self._data(username).setdefault("progress", {})
            progress[str(mode)] = max(progress.get(str(mode), 0), min(level + 1, 15))
            self._save()

    def achievements(self, username: str) -> list[int]:
        with self.lock:
            return list(self._data(username).get("achievements", []))

    def earn_achievement(self, username: str, index: int) -> None:
        if not 0 <= index < 256:
            raise ValueError("invalid achievement index")
        with self.lock:
            data = self._data(username)
            data["achievements"] = sorted(set(data.get("achievements", [])) | {index})
            self._save()

    def blob(self, username: str) -> bytes:
        with self.lock:
            return bytes.fromhex(self._data(username).get("blob", ""))

    def save_blob(self, username: str, value: bytes) -> None:
        with self.lock:
            self._data(username)["blob"] = value.hex()
            self._save()

    def submit_score(self, username: str, board: int, score: int) -> int:
        if not 0 <= board < 4 or score < 0:
            raise ValueError("invalid highscore")
        with self.lock:
            scores = self._data(username).setdefault("scores", {})
            scores[str(board)] = max(scores.get(str(board), 0), score)
            self._save()
            return scores[str(board)]

    def leaders(self, board: int, count: int) -> list[tuple[str, int, str]]:
        with self.lock:
            rows = [(row["display_name"], row.get("escapevector", {}).get("scores", {}).get(str(board)), name)
                    for name, row in self.accounts.items()]
            rows = [(display, score, name) for display, score, name in rows if score is not None]
            return sorted(rows, key=lambda row: (-row[1], row[2]))[:count]
