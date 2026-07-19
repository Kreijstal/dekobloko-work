from __future__ import annotations

import bz2
from dataclasses import dataclass
import gzip
from pathlib import Path


@dataclass(frozen=True)
class CacheStats:
    archive_id: int
    group_id: int
    length: int
    first_sector: int
    sectors: int


class CacheStore:
    """Reader for classic Jagex main_file_cache.dat2 / idxN stores."""

    def __init__(self, cache_dir: Path, max_entry_size: int = 100_000_000) -> None:
        self.cache_dir = cache_dir
        self.max_entry_size = max_entry_size
        self.data_path = cache_dir / "main_file_cache.dat2"
        self._group_versions: dict[int, dict[int, int]] = {}

    def available(self) -> bool:
        return self.data_path.is_file()

    def read(self, archive_id: int, group_id: int) -> bytes | None:
        idx_path = self.cache_dir / f"main_file_cache.idx{archive_id}"
        if not self.data_path.is_file() or not idx_path.is_file():
            return None

        with idx_path.open("rb") as index_file:
            index_file.seek(group_id * 6)
            index_record = index_file.read(6)

        if len(index_record) != 6:
            return None

        length = int.from_bytes(index_record[0:3], "big")
        sector = int.from_bytes(index_record[3:6], "big")
        if length <= 0 or length > self.max_entry_size or sector <= 0:
            return None

        payload = bytearray()
        chunk = 0

        with self.data_path.open("rb") as data_file:
            data_file.seek(0, 2)
            sector_count = data_file.tell() // 520

            while len(payload) < length:
                if sector <= 0 or sector > sector_count:
                    return None

                data_file.seek(sector * 520)
                remaining = length - len(payload)

                if group_id > 0xFFFF:
                    header = data_file.read(10)
                    if len(header) != 10:
                        return None
                    current_group = int.from_bytes(header[0:4], "big")
                    current_chunk = int.from_bytes(header[4:6], "big")
                    next_sector = int.from_bytes(header[6:9], "big")
                    current_archive = header[9]
                    block_size = min(510, remaining)
                else:
                    header = data_file.read(8)
                    if len(header) != 8:
                        return None
                    current_group = int.from_bytes(header[0:2], "big")
                    current_chunk = int.from_bytes(header[2:4], "big")
                    next_sector = int.from_bytes(header[4:7], "big")
                    current_archive = header[7]
                    block_size = min(512, remaining)

                if current_group != group_id:
                    return None
                if current_chunk != chunk:
                    return None
                if current_archive != archive_id:
                    return None

                block = data_file.read(block_size)
                if len(block) != block_size:
                    return None
                payload.extend(block)

                sector = next_sector
                chunk += 1

        return bytes(payload)

    def stats(self, archive_id: int, group_id: int) -> CacheStats | None:
        idx_path = self.cache_dir / f"main_file_cache.idx{archive_id}"
        if not self.data_path.is_file() or not idx_path.is_file():
            return None
        with idx_path.open("rb") as index_file:
            index_file.seek(group_id * 6)
            index_record = index_file.read(6)
        if len(index_record) != 6:
            return None
        length = int.from_bytes(index_record[0:3], "big")
        first_sector = int.from_bytes(index_record[3:6], "big")
        if length <= 0 or first_sector <= 0:
            return None
        payload_per_sector = 510 if group_id > 0xFFFF else 512
        sectors = (length + payload_per_sector - 1) // payload_per_sector
        return CacheStats(archive_id, group_id, length, first_sector, sectors)

    def group_version(self, archive_id: int, group_id: int) -> int | None:
        versions = self._group_versions.get(archive_id)
        if versions is None:
            versions = self._read_group_versions(archive_id)
            self._group_versions[archive_id] = versions
        return versions.get(group_id)

    def _read_group_versions(self, archive_id: int) -> dict[int, int]:
        raw = self.read(255, archive_id)
        if raw is None or len(raw) < 6:
            return {}
        compression = raw[0]
        compressed_length = int.from_bytes(raw[1:5], "big")
        if compression == 0:
            data = raw[5 : 5 + compressed_length]
        else:
            if len(raw) < 9:
                return {}
            compressed = raw[9 : 9 + compressed_length]
            if compression == 1:
                data = bz2.decompress(b"BZh1" + compressed)
            elif compression == 2:
                data = gzip.decompress(compressed)
            else:
                return {}

        position = 0
        protocol = data[position]
        position += 1
        if protocol >= 6:
            position += 4
        flags = data[position]
        position += 1
        if protocol >= 7:
            return {}
        group_count = int.from_bytes(data[position : position + 2], "big")
        position += 2
        group_ids: list[int] = []
        group_id_value = 0
        for _ in range(group_count):
            group_id_value += int.from_bytes(data[position : position + 2], "big")
            position += 2
            group_ids.append(group_id_value)
        if flags & 1:
            position += group_count * 4
        position += group_count * 4  # CRCs
        if flags & 2:
            position += group_count * 64
        versions: dict[int, int] = {}
        for current_group_id in group_ids:
            versions[current_group_id] = int.from_bytes(data[position : position + 4], "big")
            position += 4
        return versions
