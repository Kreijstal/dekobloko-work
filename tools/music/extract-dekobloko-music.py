#!/usr/bin/env python3
import argparse
import bz2
import gzip
import json
import re
import shutil
import struct
import sys
import zlib
from pathlib import Path


TRACK_NAMES = [
    "music/Deko Bloko Titlescreen",
    "music/Ant_and_Deko_remix_NORMAL",
    "music/Ant_and_Deko_remix_PANIC",
    "music/Ant_and_Deko_remix_REALLY_PANIC",
    "music/Ant_and_Deko_remix_FINISH_THEM",
    "music/Art_Deko_remix_NORMAL",
    "music/Art_Deko_remix_PANIC",
    "music/Art_Deko_remix_REALLY_PANIC",
    "music/Art_Deko_remix_FINISH_THEM",
    "music/Bokonosis!_remix_NORMAL",
    "music/Bokonosis!_remix_PANIC",
    "music/Bokonosis!_remix_REALLY_PANIC",
    "music/Bokonosis!_remix_FINISH_THEM",
    "music/Deko_Rating_remix_NORMAL",
    "music/Deko_Rating_remix_PANIC",
    "music/Deko_Rating_remix_REALLY_PANIC",
    "music/Deko_Rating_remix_FINISH_THEM",
    "music/double_deko_NORMAL",
    "music/double_deko_PANIC",
    "music/double_deko_REALLY_PANIC",
    "music/double_deko_FINISH_THEM",
    "music/making_connections_remix_NORMAL",
    "music/making_connections_remix_PANIC",
    "music/making_connections_remix_REALLY_PANIC",
    "music/making_connections_remix_FINISH_THEM",
    "music/Oh No Boko!_remix_NORMAL",
    "music/Oh No Boko!_remix_PANIC",
    "music/Oh No Boko!_remix_REALLY_PANIC",
    "music/Oh No Boko!_remix_FINISH_THEM",
    "music/Swab the Deks!_remix_NORMAL",
    "music/Swab the Deks!_remix_PANIC",
    "music/Swab the Deks!_remix_REALLY_PANIC",
    "music/Swab the Deks!_remix_FINISH_THEM",
    "music/momentum_remix_NORMAL",
    "music/momentum_remix_PANIC",
    "music/momentum_remix_REALLY_PANIC",
    "music/momentum_remix_FINISH_THEM",
    "music/Deko Bloko Game Win",
    "music/Deko Bloko Game Lose",
]

ARCHIVE10_FILE_IDS_BY_TRACK = [
    10,
    2,
    40,
    57,
    47,
    8,
    6,
    44,
    46,
    19,
    12,
    60,
    52,
    30,
    35,
    54,
    49,
    41,
    11,
    43,
    59,
    27,
    23,
    48,
    45,
    32,
    39,
    61,
    55,
    3,
    7,
    53,
    62,
    22,
    5,
    51,
    56,
    33,
    28,
]

# Build 31 archive 10 metadata maps these client-side names to sparse JS5 file IDs.
# The split payload order is file-ID order, not client load order.
ARCHIVE10_TRACK_NAMES_BY_FILE_ID = dict(zip(ARCHIVE10_FILE_IDS_BY_TRACK, TRACK_NAMES))
ARCHIVE10_FILE_IDS = sorted(ARCHIVE10_TRACK_NAMES_BY_FILE_ID)

TETRALINK_ARCHIVES = {
    7: {
        "role": "synth/sample archive used by fa/ge",
    },
    8: {
        "role": "Vorbis/sample archive used by fa/ag",
    },
    9: {
        "role": "instrument patch archive used by g/go/ng",
    },
    10: {
        "role": "ri MIDI-like song descriptors",
        "tracks": [
            "tetralink titlescreen",
            "tetralink ingame 1",
            "tetralink ingame 2",
            "tetralink ingame 3",
        ],
    },
}

VIROGRID_ARCHIVES = {
    7: {
        "role": "synth/sample archive used by jg/vn",
    },
    8: {
        "role": "Vorbis/sample archive used by jg/gj",
    },
    9: {
        "role": "instrument patch archive used by i/rc",
    },
    10: {
        "role": "sc MIDI-like song descriptors",
        "tracks": [
            "ataxx titlescreen",
            "tetralink ingame 1",
            "tetralink ingame 2",
            "tetralink ingame 3",
        ],
    },
}

BRICKABRAC_ARCHIVES = {
    7: "dr synth sample archive used by wp",
    8: "bk Vorbis sample archive stored as sparse files in group 0",
    9: "pq instrument patch archive",
    10: "vm MIDI-like song descriptors",
    13: "music label/test metadata observed in warmed caches",
}

BRICKABRAC_TRACK_NAMES = [
    "BaB_panic",
    "BaB_desert",
    "BaB_underthesea",
    "BaB_arctic",
    "BaB_chocolate",
    "BaB_jungle",
    "BaB_volcano",
    "BaB_city_paris",
    "BaB_podium",
    "BaB_game_completed",
    "BaB_farmyard",
    "BaB_title_music",
    "BaB_construction",
    "BaB_space",
    "BaB_halloween",
    "BAB_ninja",
]


class Buffer:
    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0

    def u8(self) -> int:
        value = self.data[self.pos]
        self.pos += 1
        return value

    def u16(self) -> int:
        value = struct.unpack_from(">H", self.data, self.pos)[0]
        self.pos += 2
        return value

    def u32(self) -> int:
        value = struct.unpack_from(">I", self.data, self.pos)[0]
        self.pos += 4
        return value

    def i32(self) -> int:
        value = struct.unpack_from(">i", self.data, self.pos)[0]
        self.pos += 4
        return value

    def bytes(self, size: int) -> bytes:
        value = self.data[self.pos : self.pos + size]
        self.pos += size
        return value

    def large_smart(self) -> int:
        if self.data[self.pos] & 0x80:
            return self.u32() & 0x7FFFFFFF
        return self.u16()


def cp1252_byte(ch: str) -> int:
    code = ord(ch)
    if 0 < code < 128 or 160 <= code <= 255:
        return code
    table = {
        0x20AC: -128,
        0x201A: -126,
        0x0192: -125,
        0x201E: -124,
        0x2026: -123,
        0x2020: -122,
        0x2021: -121,
        0x02C6: -120,
        0x2030: -119,
        0x0160: -118,
        0x2039: -117,
        0x0152: -116,
        0x017D: -114,
        0x2018: -111,
        0x2019: -110,
        0x201C: -109,
        0x201D: -108,
        0x2022: -107,
        0x2013: -106,
        0x2014: -105,
        0x02DC: -104,
        0x2122: -103,
        0x0161: -102,
        0x203A: -101,
        0x0153: -100,
        0x017E: -98,
        0x0178: -97,
    }
    return table.get(code, 63)


def name_hash(name: str) -> int:
    value = 0
    for ch in name.lower():
        value = (value * 31 + cp1252_byte(ch)) & 0xFFFFFFFF
    return value - 0x100000000 if value & 0x80000000 else value


def read_group(cache_dir: Path, archive: int, group: int) -> bytes:
    idx = (cache_dir / f"main_file_cache.idx{archive}").read_bytes()
    off = group * 6
    if off + 6 > len(idx):
        raise ValueError(f"missing archive {archive} group {group}")
    size = int.from_bytes(idx[off : off + 3], "big")
    sector = int.from_bytes(idx[off + 3 : off + 6], "big")
    out = bytearray()
    chunk = 0
    with (cache_dir / "main_file_cache.dat2").open("rb") as dat:
        while len(out) < size:
            dat.seek(sector * 520)
            header = dat.read(8)
            data = dat.read(512)
            got_group = int.from_bytes(header[0:2], "big")
            got_chunk = int.from_bytes(header[2:4], "big")
            next_sector = int.from_bytes(header[4:7], "big")
            got_archive = header[7]
            if got_group != group or got_chunk != chunk or got_archive != archive:
                raise ValueError(
                    f"bad sector for archive {archive} group {group}: "
                    f"sector={sector} header={header.hex()}"
                )
            take = min(size - len(out), 512)
            out += data[:take]
            sector = next_sector
            chunk += 1
    return bytes(out)


def has_group(cache_dir: Path, archive: int, group: int) -> bool:
    idx_path = cache_dir / f"main_file_cache.idx{archive}"
    if not idx_path.exists():
        return False
    idx = idx_path.read_bytes()
    off = group * 6
    if off + 6 > len(idx):
        return False
    size = int.from_bytes(idx[off : off + 3], "big")
    sector = int.from_bytes(idx[off + 3 : off + 6], "big")
    return size > 0 and sector > 0


def decode_container(raw: bytes) -> bytes:
    kind = raw[0]
    compressed_size = int.from_bytes(raw[1:5], "big")
    if kind == 0:
        return raw[5 : 5 + compressed_size]
    expected_size = int.from_bytes(raw[5:9], "big")
    body = raw[9:]
    if kind == 1:
        for prefix in (b"BZh1", b"BZh9"):
            try:
                data = bz2.decompress(prefix + body)
                break
            except OSError:
                data = None
        if data is None:
            raise ValueError("could not decompress bzip2 JS5 container")
    elif kind == 2:
        try:
            data = gzip.decompress(body)
        except (EOFError, gzip.BadGzipFile):
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            data = decoder.decompress(body)
    else:
        raise ValueError(f"unknown JS5 compression kind {kind}")
    if len(data) != expected_size:
        raise ValueError(f"decoded {len(data)} bytes, expected {expected_size}")
    return data


def parse_index(cache_dir: Path, archive: int) -> dict:
    raw = read_group(cache_dir, 255, archive)
    body = decode_container(raw)
    buf = Buffer(body)
    version = buf.u8()
    if not 5 <= version <= 7:
        raise ValueError(f"unsupported index {archive} version {version}")
    if version >= 6:
        revision = buf.u32()
    else:
        revision = None
    flags = buf.u8()
    has_names = bool(flags & 1)
    has_whirlpool = bool(flags & 2)
    group_count = buf.large_smart() if version >= 7 else buf.u16()

    group_ids = []
    last = 0
    for _ in range(group_count):
        last += buf.large_smart() if version >= 7 else buf.u16()
        group_ids.append(last)

    group_name_hashes = {}
    if has_names:
        for group_id in group_ids:
            group_name_hashes[group_id] = buf.i32()

    group_crcs = {group_id: buf.u32() for group_id in group_ids}
    if has_whirlpool:
        for _ in group_ids:
            buf.bytes(64)
    group_versions = {group_id: buf.u32() for group_id in group_ids}
    file_counts = {
        group_id: (buf.large_smart() if version >= 7 else buf.u16())
        for group_id in group_ids
    }

    file_ids_by_group = {}
    for group_id in group_ids:
        file_ids = []
        last = 0
        for _ in range(file_counts[group_id]):
            last += buf.large_smart() if version >= 7 else buf.u16()
            file_ids.append(last)
        file_ids_by_group[group_id] = file_ids

    file_name_hashes = {}
    if has_names:
        for group_id in group_ids:
            file_name_hashes[group_id] = {
                file_id: buf.i32() for file_id in file_ids_by_group[group_id]
            }

    groups = {}
    groups_by_hash = {}
    for group_id in group_ids:
        group = {
            "id": group_id,
            "name_hash": group_name_hashes.get(group_id),
            "crc": group_crcs[group_id],
            "version": group_versions[group_id],
            "file_ids": file_ids_by_group[group_id],
            "file_name_hashes": file_name_hashes.get(group_id, {}),
            "file_count": file_counts[group_id],
        }
        groups[group_id] = group
        if group["name_hash"] is not None:
            groups_by_hash[group["name_hash"]] = group

    return {
        "archive": archive,
        "version": version,
        "revision": revision,
        "flags": flags,
        "groups": groups,
        "groups_by_hash": groups_by_hash,
    }


def split_group(data: bytes, file_count: int) -> list[bytes]:
    if file_count == 1:
        return [data]
    chunks = data[-1]
    table_len = chunks * file_count * 4
    table_start = len(data) - 1 - table_len
    if table_start < 0:
        raise ValueError("split table does not fit")

    pos = table_start
    lengths = [0] * file_count
    for _ in range(chunks):
        acc = 0
        for file_id in range(file_count):
            acc += struct.unpack(">i", data[pos : pos + 4])[0]
            pos += 4
            if acc < 0:
                raise ValueError("negative split length")
            lengths[file_id] += acc

    files = [bytearray() for _ in range(file_count)]
    pos = 0
    table_pos = table_start
    for _ in range(chunks):
        acc = 0
        for file_id in range(file_count):
            acc += struct.unpack(">i", data[table_pos : table_pos + 4])[0]
            table_pos += 4
            files[file_id] += data[pos : pos + acc]
            pos += acc
    if pos != table_start:
        raise ValueError(f"split consumed {pos}, expected {table_start}")
    return [bytes(file_data) for file_data in files]


def valid_split(data: bytes, file_count: int) -> bool:
    try:
        files = split_group(data, file_count)
    except (struct.error, ValueError):
        return False
    return all(files)


def choose_split_count(data: bytes) -> int:
    candidates = [count for count in range(2, 257) if valid_split(data, count)]
    if not candidates:
        return 1
    return max(candidates)


def safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name.replace("/", "_")).strip("_")


def logical_name_for_file(archive: int, group_id: int, file_id: int, index: int, group_name: str | None, profile: str) -> str:
    if archive == 10 and group_name:
        return group_name
    if group_name == "headers.packvorbis":
        return "headers.packvorbis"
    if group_name:
        return group_name
    if profile == "tetralink" and archive == 7:
        return f"synth_sample_{file_id:03d}"
    if profile == "tetralink" and archive == 8:
        return f"vorbis_sample_{file_id:03d}"
    if profile == "tetralink" and archive == 9:
        return f"instrument_patch_{file_id:03d}"
    if archive == 8:
        return f"synth_sample_{file_id:02d}"
    return f"archive{archive:02d}_group{group_id:03d}_file{file_id:03d}"


def file_suffix_for_archive(archive: int, group_name: str | None, profile: str) -> str:
    if archive == 10:
        if profile == "virogrid":
            return ".sc.bin"
        return ".ri.bin"
    if group_name and group_name.endswith(".packvorbis"):
        return ".packvorbis.bin"
    if profile == "tetralink" and archive == 7:
        return ".synth.bin"
    if profile == "tetralink" and archive == 8:
        return ".packvorbis.bin"
    if profile == "tetralink" and archive == 9:
        return ".patch.bin"
    if archive == 9:
        return ".packvorbis.bin"
    if archive == 8:
        return ".synth.bin"
    return ".bin"


def write_split(out_dir: Path, archive: int, files: list[bytes]) -> list[dict]:
    split_dir = out_dir / "split" / f"archive{archive:02d}_group000"
    split_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    for index, data in enumerate(files):
        file_id = index
        if archive == 10 and len(files) == len(ARCHIVE10_FILE_IDS) and index < len(ARCHIVE10_FILE_IDS):
            file_id = ARCHIVE10_FILE_IDS[index]
            logical_name = ARCHIVE10_TRACK_NAMES_BY_FILE_ID[file_id]
            filename = f"{safe_name(logical_name)}.ui.bin"
        elif archive == 10:
            filename = f"{index:02d}_track.ui.bin"
            logical_name = f"music_track_{index:02d}"
        elif archive == 9 and index == 0:
            filename = "00_headers.packvorbis.bin"
            logical_name = "headers.packvorbis"
        elif archive == 9:
            filename = f"{index:02d}_sample.packvorbis.bin"
            logical_name = f"packvorbis_sample_{index:02d}"
        elif archive == 8:
            filename = f"{index:02d}_synth.bin"
            logical_name = f"synth_sample_{index:02d}"
        else:
            filename = f"{index:02d}.bin"
            logical_name = filename
        path = split_dir / filename
        path.write_bytes(data)
        entries.append(
            {
                "index": index,
                "file_id": file_id,
                "name": logical_name,
                "path": str(path.relative_to(out_dir)),
                "bytes": len(data),
                "head": data[:16].hex(" "),
            }
        )
    return entries


def write_brickabrac_tracks(out_dir: Path, files: list[bytes], group: dict | None = None) -> list[dict]:
    split_dir = out_dir / "split" / "archive10"
    split_dir.mkdir(parents=True, exist_ok=True)
    entries = []
    names_by_hash = {name_hash(name): name for name in BRICKABRAC_TRACK_NAMES}
    file_ids = group["file_ids"] if group else list(range(len(files)))
    file_hashes = group["file_name_hashes"] if group else {}
    # Runtime-warmed Brickabrac caches can contain archive 10 without the
    # archive-255 metadata needed to recover file-name hashes. In that exact
    # 16-track shape, use the client load strings recovered from decompiled
    # sources instead of writing anonymous brickabrac_track_NN files.
    fallback_names = BRICKABRAC_TRACK_NAMES if len(files) == len(BRICKABRAC_TRACK_NAMES) else []
    for index, data in enumerate(files):
        file_id = file_ids[index] if index < len(file_ids) else index
        name = names_by_hash.get(
            file_hashes.get(file_id),
            fallback_names[index] if index < len(fallback_names) else f"brickabrac_track_{index:02d}",
        )
        path = split_dir / f"{name}.vm.bin"
        path.write_bytes(data)
        entries.append(
            {
                "index": index,
                "file_id": file_id,
                "name": name,
                "path": str(path.relative_to(out_dir)),
                "bytes": len(data),
                "head": data[:16].hex(" "),
            }
        )
    return entries


def write_named_group(
    out_dir: Path,
    archive: int,
    group: dict,
    group_name: str | None,
    decoded: bytes,
    profile: str,
) -> dict:
    files = split_group(decoded, group["file_count"])
    file_ids = group["file_ids"]
    archive_dir = out_dir / "split" / f"archive{archive:02d}"
    archive_dir.mkdir(parents=True, exist_ok=True)
    file_entries = []
    for index, data in enumerate(files):
        file_id = file_ids[index] if index < len(file_ids) else index
        logical_name = logical_name_for_file(archive, group["id"], file_id, index, group_name, profile)
        suffix = file_suffix_for_archive(archive, group_name, profile)
        if group_name and len(files) == 1:
            filename = f"{safe_name(logical_name)}{suffix}"
        elif group_name:
            filename = f"{safe_name(group_name)}_{file_id:03d}{suffix}"
        else:
            filename = f"group{group['id']:03d}_file{file_id:03d}{suffix}"
        path = archive_dir / filename
        path.write_bytes(data)
        file_entries.append(
            {
                "index": index,
                "file_id": file_id,
                "name": logical_name,
                "path": str(path.relative_to(out_dir)),
                "bytes": len(data),
                "head": data[:16].hex(" "),
            }
        )
    return {
        "group": group["id"],
        "group_name": group_name,
        "group_name_hash": group["name_hash"],
        "payload_bytes": len(decoded),
        "file_count": len(files),
        "files": file_entries,
    }


def write_selected_named_files(
    out_dir: Path,
    archive: int,
    group: dict,
    group_name: str,
    decoded: bytes,
    names: list[str],
    profile: str = "tetralink",
) -> dict:
    files = split_group(decoded, group["file_count"])
    file_by_hash = {
        file_hash: file_id
        for file_id, file_hash in group["file_name_hashes"].items()
    }
    file_by_id = {
        file_id: files[index]
        for index, file_id in enumerate(group["file_ids"])
        if index < len(files)
    }
    archive_dir = out_dir / "split" / f"archive{archive:02d}"
    archive_dir.mkdir(parents=True, exist_ok=True)
    file_entries = []
    missing = []
    for name in names:
        file_hash = name_hash(name)
        file_id = file_by_hash.get(file_hash)
        if file_id is None or file_id not in file_by_id:
            missing.append(
                {
                    "archive": archive,
                    "group": group["id"],
                    "group_name": group_name,
                    "name": name,
                    "name_hash": file_hash,
                    "reason": "file name not present in JS5 index",
                }
            )
            continue
        data = file_by_id[file_id]
        path = archive_dir / f"{safe_name(name)}{file_suffix_for_archive(archive, name, profile)}"
        path.write_bytes(data)
        file_entries.append(
            {
                "file_id": file_id,
                "name": name,
                "path": str(path.relative_to(out_dir)),
                "bytes": len(data),
                "head": data[:16].hex(" "),
            }
        )
    return {
        "entry": {
            "group": group["id"],
            "group_name": group_name,
            "group_name_hash": group["name_hash"],
            "payload_bytes": len(decoded),
            "file_count": len(file_entries),
            "files": file_entries,
        },
        "missing": missing,
    }


def extract_dekobloko(cache_dir: Path, out_dir: Path, game: str) -> dict:
    manifest = {
        "game": game,
        "source_cache": str(cache_dir),
        "profile": "dekobloko",
        "format": {
            "archive8": "decoded synth sample bank split from JS5 group 0",
            "archive9": "decoded packvorbis sample bank split from JS5 group 0; file 0 is headers",
            "archive10": "decoded ui music descriptors split from JS5 group 0",
        },
        "archives": {},
    }

    for archive in (8, 9, 10):
        raw = read_group(cache_dir, archive, 0)
        decoded = decode_container(raw)
        (out_dir / "raw" / f"archive{archive:02d}_group000.container.bin").write_bytes(raw)
        (out_dir / "raw" / f"archive{archive:02d}_group000.payload.bin").write_bytes(decoded)
        file_count = choose_split_count(decoded)
        files = split_group(decoded, file_count)
        manifest["archives"][str(archive)] = {
            "group": 0,
            "container_bytes": len(raw),
            "payload_bytes": len(decoded),
            "file_count": file_count,
            "files": write_split(out_dir, archive, files),
        }
    return manifest


def extract_tetralink_like(cache_dir: Path, out_dir: Path, game: str, archives: dict[int, dict], profile: str) -> dict:
    manifest = {
        "game": game,
        "source_cache": str(cache_dir),
        "profile": profile,
        "format": {
            "archive7": archives[7]["role"],
            "archive8": archives[8]["role"],
            "archive9": archives[9]["role"],
            "archive10": archives[10]["role"],
        },
        "archives": {},
        "missing": [],
    }

    for archive, spec in archives.items():
        index = parse_index(cache_dir, archive)
        archive_manifest = {
            "role": spec["role"],
            "index_version": index["version"],
            "index_revision": index["revision"],
            "group_count": len(index["groups"]),
            "groups": [],
        }

        requested_names = spec.get("tracks")
        groups_to_extract = []
        if requested_names and archive == 10:
            group_name = ""
            group = index["groups_by_hash"].get(name_hash(group_name))
            if group is None:
                manifest["missing"].append(
                    {
                        "archive": archive,
                        "name": group_name,
                        "name_hash": name_hash(group_name),
                        "reason": "group name not present in JS5 index",
                    }
                )
            elif not has_group(cache_dir, archive, group["id"]):
                manifest["missing"].append(
                    {
                        "archive": archive,
                        "group": group["id"],
                        "name": group_name,
                        "reason": "group payload not present in cache",
                    }
                )
            else:
                raw = read_group(cache_dir, archive, group["id"])
                decoded = decode_container(raw)
                raw_name = f"archive{archive:02d}_group{group['id']:03d}"
                (out_dir / "raw" / f"{raw_name}.container.bin").write_bytes(raw)
                (out_dir / "raw" / f"{raw_name}.payload.bin").write_bytes(decoded)
                selected = write_selected_named_files(out_dir, archive, group, group_name, decoded, requested_names, profile)
                archive_manifest["groups"].append(selected["entry"])
                manifest["missing"].extend(selected["missing"])
            manifest["archives"][str(archive)] = archive_manifest
            continue
        if requested_names:
            for name in requested_names:
                group = index["groups_by_hash"].get(name_hash(name))
                if group is None:
                    manifest["missing"].append(
                        {
                            "archive": archive,
                            "name": name,
                            "name_hash": name_hash(name),
                            "reason": "name not present in JS5 index",
                        }
                    )
                    continue
                groups_to_extract.append((name, group))
        else:
            groups_to_extract = [(None, group) for group in index["groups"].values()]

        for group_name, group in groups_to_extract:
            if not has_group(cache_dir, archive, group["id"]):
                manifest["missing"].append(
                    {
                        "archive": archive,
                        "group": group["id"],
                        "name": group_name,
                        "reason": "group payload not present in cache",
                    }
                )
                continue
            raw = read_group(cache_dir, archive, group["id"])
            decoded = decode_container(raw)
            raw_name = f"archive{archive:02d}_group{group['id']:03d}"
            if group_name:
                raw_name += f"_{safe_name(group_name)}"
            (out_dir / "raw" / f"{raw_name}.container.bin").write_bytes(raw)
            (out_dir / "raw" / f"{raw_name}.payload.bin").write_bytes(decoded)
            archive_manifest["groups"].append(write_named_group(out_dir, archive, group, group_name, decoded, profile))

        manifest["archives"][str(archive)] = archive_manifest
    return manifest


def extract_tetralink(cache_dir: Path, out_dir: Path, game: str) -> dict:
    return extract_tetralink_like(cache_dir, out_dir, game, TETRALINK_ARCHIVES, "tetralink")


def extract_virogrid(cache_dir: Path, out_dir: Path, game: str) -> dict:
    return extract_tetralink_like(cache_dir, out_dir, game, VIROGRID_ARCHIVES, "virogrid")


def extract_brickabrac(cache_dir: Path, out_dir: Path, game: str) -> dict:
    manifest = {
        "game": game,
        "source_cache": str(cache_dir),
        "profile": "brickabrac",
        "format": {f"archive{archive}": role for archive, role in BRICKABRAC_ARCHIVES.items()},
        "archives": {},
        "tracks": [],
        "missing": [],
    }

    for archive, role in BRICKABRAC_ARCHIVES.items():
        try:
            index = parse_index(cache_dir, archive)
        except Exception:
            index = None
        idx_path = cache_dir / f"main_file_cache.idx{archive}"
        archive_manifest = {
            "role": role,
            "index_version": index["version"] if index else None,
            "index_revision": index["revision"] if index else None,
            "groups": [],
        }
        if not idx_path.exists():
            manifest["missing"].append(
                {
                    "archive": archive,
                    "reason": "index file not present in cache",
                }
            )
            manifest["archives"][str(archive)] = archive_manifest
            continue

        group_count = len(idx_path.read_bytes()) // 6
        for group in range(group_count):
            if not has_group(cache_dir, archive, group):
                continue
            raw = read_group(cache_dir, archive, group)
            decoded = decode_container(raw)
            raw_name = f"archive{archive:02d}_group{group:03d}"
            (out_dir / "raw" / f"{raw_name}.container.bin").write_bytes(raw)
            (out_dir / "raw" / f"{raw_name}.payload.bin").write_bytes(decoded)

            group_manifest = {
                "group": group,
                "container_bytes": len(raw),
                "payload_bytes": len(decoded),
                "head": decoded[:16].hex(" "),
            }
            if archive == 10 and group == 0:
                index_group = index["groups"].get(group) if index else None
                file_count = choose_split_count(decoded)
                files = split_group(decoded, file_count)
                tracks = write_brickabrac_tracks(out_dir, files, index_group)
                manifest["tracks"] = tracks
                group_manifest["file_count"] = file_count
                group_manifest["files"] = tracks
            archive_manifest["groups"].append(group_manifest)

        if not archive_manifest["groups"]:
            manifest["missing"].append(
                {
                    "archive": archive,
                    "reason": "no populated groups found in cache",
                }
            )
        manifest["archives"][str(archive)] = archive_manifest
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract FunOrb music-related JS5 archives.")
    parser.add_argument("cache_dir", nargs="?", default=str(Path.home() / ".alterorb/caches/dekobloko"))
    parser.add_argument("out_dir", nargs="?", default=".work/music/dekobloko")
    parser.add_argument(
        "--game",
        choices=("dekobloko", "tetralink", "brickabrac", "virogrid"),
        help="extraction profile; defaults to output directory name",
    )
    args = parser.parse_args()

    cache_dir = Path(args.cache_dir)
    out_dir = Path(args.out_dir)
    game = args.game or out_dir.name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "raw").mkdir(parents=True)

    if game == "tetralink":
        manifest = extract_tetralink(cache_dir, out_dir, game)
    elif game == "virogrid":
        manifest = extract_virogrid(cache_dir, out_dir, game)
    elif game == "brickabrac":
        manifest = extract_brickabrac(cache_dir, out_dir, game)
    else:
        manifest = extract_dekobloko(cache_dir, out_dir, game)

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {out_dir}")
    for archive, entry in manifest["archives"].items():
        if "file_count" in entry:
            print(f"archive {archive}: {entry['file_count']} files")
        else:
            file_count = sum(group.get("file_count", 1) for group in entry["groups"])
            print(f"archive {archive}: {len(entry['groups'])} groups, {file_count} files")
    if manifest.get("tracks"):
        print(f"tracks: {len(manifest['tracks'])}")
    if manifest.get("missing"):
        print(f"missing: {len(manifest['missing'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
