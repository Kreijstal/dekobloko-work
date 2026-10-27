from __future__ import annotations

from dekobloko_server.cache import CacheStore


class GameCache(CacheStore):
    """Read classic caches or the launcher's extracted archive-group.bin files."""

    def available(self) -> bool:
        return super().available() or (self.cache_dir / "255-255.bin").is_file()

    def read(self, archive_id: int, group_id: int) -> bytes | None:
        if not 0 <= archive_id <= 255 or not 0 <= group_id <= 0xFFFFFFFF:
            raise ValueError("invalid JS5 archive/group")
        loose = self.cache_dir / f"{archive_id}-{group_id}.bin"
        if loose.is_file():
            if loose.stat().st_size > self.max_entry_size:
                raise ValueError("oversized JS5 cache entry")
            return loose.read_bytes()
        return super().read(archive_id, group_id)
