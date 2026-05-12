#!/usr/bin/env python3
import argparse
import bz2
import concurrent.futures
import json
import os
import select
import socket
import struct
import sys
import zlib
from pathlib import Path


DEFAULT_CONFIG = ".work/upstream-alterorb-launcher/config.json"
DEFAULT_HOST = "mgg-server.alterorb.net"
DEFAULT_PORT = 43594
DEFAULT_SERVER_NUM = 8003
DEFAULT_LANG = 0


class Js5Error(Exception):
    pass


class Buffer:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def u8(self):
        value = self.data[self.pos]
        self.pos += 1
        return value

    def u16(self):
        value = struct.unpack_from(">H", self.data, self.pos)[0]
        self.pos += 2
        return value

    def u32(self):
        value = struct.unpack_from(">I", self.data, self.pos)[0]
        self.pos += 4
        return value

    def large_smart(self):
        if self.data[self.pos] & 0x80:
            return self.u32() & 0x7FFFFFFF
        return self.u16()

    def bytes(self, size):
        value = self.data[self.pos:self.pos + size]
        self.pos += size
        return value


class Js5Client:
    def __init__(self, host, port, game_crc, build, server_num, lang, timeout):
        self.host = host
        self.port = port
        self.game_crc = game_crc & 0xFFFFFFFF
        self.build = build
        self.server_num = server_num
        self.lang = lang
        self.timeout = timeout
        self.sock = None

    def __enter__(self):
        address = socket.gethostbyname(self.host)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect((address, self.port))
        self.sock.settimeout(self.timeout)
        setup = struct.pack(
            ">BHHHBBI",
            12,
            17,
            self.build,
            self.server_num,
            self.lang,
            15,
            self.game_crc,
        )
        self.sock.sendall(setup)
        ack = self._read_exact(1)
        if ack != b"\x00":
            raise Js5Error(f"JS5 setup failed: response={ack.hex()}")
        self.sock.sendall(bytes([6, 0, 0, 3, 0, 0]))
        self.sock.sendall(bytes([3, 0, 0, 0, 0, 0]))
        return self

    def __exit__(self, exc_type, exc, tb):
        if self.sock is not None:
            self.sock.close()
            self.sock = None

    def fetch(self, index, archive):
        self.request(index, archive)
        return self.read_response(expected=(index, archive))

    def request(self, index, archive):
        key = (index << 32) | archive
        self.sock.sendall(bytes([1]) + key.to_bytes(5, "big"))

    def read_response(self, expected=None):
        header = self._read_exact(10)
        got_index = header[0]
        got_archive = struct.unpack_from(">I", header, 1)[0]
        compression = header[5]
        compressed_len = struct.unpack_from(">I", header, 6)[0]
        if expected is not None and (got_index, got_archive) != expected:
            raise Js5Error(
                f"unexpected response: wanted {expected[0]}:{expected[1]}, got {got_index}:{got_archive}"
            )

        raw = bytearray()
        raw.append(compression)
        raw += header[6:10]
        remaining = compressed_len + (4 if compression != 0 else 0)
        block_pos = 10
        while remaining:
            size = min(512 - block_pos, remaining)
            chunk = self._read_exact(size)
            raw += chunk
            remaining -= size
            block_pos += size
            if block_pos == 512 and remaining:
                marker = self._read_exact(1)
                if marker != b"\xff":
                    raise Js5Error(f"bad continuation marker: {marker.hex()}")
                block_pos = 1
        return got_index, got_archive, bytes(raw)

    def fetch_available(self, index, archives, idle_timeout, batch_size):
        pending = list(archives)
        known = {archive["archive"] for archive in pending}
        yielded = set()
        for offset in range(0, len(pending), batch_size):
            batch = pending[offset:offset + batch_size]
            wanted = {(index, archive["archive"]) for archive in batch}
            for archive in batch:
                self.request(index, archive["archive"])
            while wanted:
                ready, _, _ = select.select([self.sock], [], [], idle_timeout)
                if not ready:
                    break
                got_index, got_archive, raw = self.read_response()
                key = (got_index, got_archive)
                if got_index != index or got_archive not in known:
                    raise Js5Error(f"unexpected batched response: {got_index}:{got_archive}")
                wanted.discard(key)
                if got_archive not in yielded:
                    yielded.add(got_archive)
                    yield got_archive, raw

    def _read_exact(self, size):
        data = bytearray()
        while len(data) < size:
            try:
                chunk = self.sock.recv(size - len(data))
            except TimeoutError as exc:
                raise Js5Error("timed out waiting for JS5 response") from exc
            if not chunk:
                raise Js5Error("connection closed")
            data += chunk
        return bytes(data)


def decompress_container(data):
    compression = data[0]
    compressed_len = struct.unpack_from(">I", data, 1)[0]
    if compression == 0:
        return data[5:5 + compressed_len]

    uncompressed_len = struct.unpack_from(">I", data, 5)[0]
    compressed = data[9:9 + compressed_len]
    if compression == 1:
        try:
            out = bz2.decompress(compressed)
        except OSError:
            out = bz2.decompress(b"BZh1" + compressed)
    elif compression == 2:
        out = zlib.decompress(compressed[10:-8], -zlib.MAX_WBITS)
    else:
        raise Js5Error(f"unknown compression type: {compression}")
    if len(out) != uncompressed_len:
        raise Js5Error(f"bad decompressed length: expected {uncompressed_len}, got {len(out)}")
    return out


def parse_master(data):
    body = decompress_container(data)
    buf = Buffer(body)
    count = buf.u8()
    entries = []
    for archive in range(count):
        offset = 1 + archive * 72
        entry = Buffer(body[offset:offset + 72])
        crc = entry.u32()
        version = entry.u32()
        whirlpool = entry.bytes(64)
        entries.append({"archive": archive, "crc": crc, "version": version, "whirlpool": whirlpool})
    return entries


def parse_index(data):
    body = decompress_container(data)
    buf = Buffer(body)
    version = buf.u8()
    if not 5 <= version <= 7:
        raise Js5Error(f"unsupported index format version: {version}")
    if version >= 6:
        buf.u32()
    flags = buf.u8()
    has_names = bool(flags & 1)
    has_whirlpool = bool(flags & 2)
    group_count = buf.large_smart() if version >= 7 else buf.u16()

    group_ids = []
    last = 0
    for _ in range(group_count):
        delta = buf.large_smart() if version >= 7 else buf.u16()
        last += delta
        group_ids.append(last)

    if has_names:
        for _ in group_ids:
            buf.u32()
    group_crcs = [buf.u32() for _ in group_ids]
    if has_whirlpool:
        for _ in group_ids:
            buf.bytes(64)
    group_versions = [buf.u32() for _ in group_ids]
    file_counts = [(buf.large_smart() if version >= 7 else buf.u16()) for _ in group_ids]

    for file_count in file_counts:
        last = 0
        for _ in range(file_count):
            delta = buf.large_smart() if version >= 7 else buf.u16()
            last += delta

    return [
        {"archive": archive, "crc": crc, "version": version}
        for archive, crc, version in zip(group_ids, group_crcs, group_versions)
    ]


class CacheStore:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.data_path = self.directory / "main_file_cache.dat2"
        self.data = open(self.data_path, "r+b" if self.data_path.exists() else "w+b")

    def close(self):
        self.data.close()

    def write(self, index, archive, payload):
        idx_path = self.directory / f"main_file_cache.idx{index}"
        with open(idx_path, "r+b" if idx_path.exists() else "w+b") as idx:
            block = max(1, (self._data_len() + 519) // 520)
            first_block = block
            idx.seek(archive * 6)
            idx.write(len(payload).to_bytes(3, "big") + first_block.to_bytes(3, "big"))

            offset = 0
            chunk = 0
            large = archive > 0xFFFF
            header_size = 10 if large else 8
            chunk_size = 510 if large else 512
            while offset < len(payload):
                part = payload[offset:offset + chunk_size]
                offset += len(part)
                next_block = block + 1 if offset < len(payload) else 0
                self.data.seek(block * 520)
                if large:
                    header = (
                        archive.to_bytes(4, "big")
                        + chunk.to_bytes(2, "big")
                        + next_block.to_bytes(3, "big")
                        + bytes([index])
                    )
                else:
                    header = (
                        archive.to_bytes(2, "big")
                        + chunk.to_bytes(2, "big")
                        + next_block.to_bytes(3, "big")
                        + bytes([index])
                    )
                self.data.write(header + part)
                if len(part) < chunk_size:
                    self.data.write(b"\x00" * (chunk_size - len(part)))
                block = next_block
                chunk += 1

    def _data_len(self):
        self.data.seek(0, os.SEEK_END)
        return self.data.tell()


def signed_crc(value):
    return value - 0x100000000 if value & 0x80000000 else value


def load_games(path, filters):
    with open(path, "r", encoding="utf-8") as f:
        games = json.load(f)["games"]
    if filters:
        names = set(filters.split(","))
        games = [game for game in games if game["internalName"] in names]
    return games


def game_build(args, game):
    if args.builds:
        key = game["internalName"]
        if key not in args.builds:
            raise Js5Error(f"missing JS5 build for {key}; add it to --builds or pass --build")
        return int(args.builds[key])
    if args.build is not None:
        return args.build
    raise Js5Error("missing JS5 build; pass --build for one game or --builds for bulk downloads")


def download_game(args, game):
    build = game_build(args, game)
    out_dir = Path(args.output) / game["internalName"]
    out_dir.mkdir(parents=True, exist_ok=True)
    store = CacheStore(out_dir)
    try:
        with Js5Client(
            args.host,
            args.port,
            game["gamecrc"],
            build,
            args.server_num,
            args.lang,
            args.timeout,
        ) as client:
            print(f"{game['internalName']}: fetch master build={build}", flush=True)
            master = client.fetch(255, 255)[2]
            indexes = [entry for entry in parse_master(master) if entry["crc"] != 0]
            if args.indexes:
                selected = parse_int_set(args.indexes)
                indexes = [entry for entry in indexes if entry["archive"] in selected]

            if args.index_limit is not None:
                indexes = indexes[:args.index_limit]
            total_written = 0
            total_missing = 0
            for index_entry in indexes:
                index_client = client
                if args.reconnect_per_index:
                    index_client = Js5Client(
                        args.host,
                        args.port,
                        game["gamecrc"],
                        build,
                        args.server_num,
                        args.lang,
                        args.timeout,
                    )
                    index_client.__enter__()
                try:
                    written, missing = download_index(args, game, store, index_client, index_entry)
                    total_written += written
                    total_missing += missing
                finally:
                    if args.reconnect_per_index:
                        index_client.__exit__(None, None, None)
            print(
                f"{game['internalName']}: done archives-written={total_written} archives-missing={total_missing}",
                flush=True,
            )
    finally:
        store.close()


def download_index(args, game, store, client, index_entry):
    index = index_entry["archive"]
    print(f"{game['internalName']}: fetch index {index}", flush=True)
    index_data = client.fetch(255, index)[2]
    if (zlib.crc32(index_data) & 0xFFFFFFFF) != index_entry["crc"]:
        raise Js5Error(
            f"index {index} CRC mismatch: expected {index_entry['crc']:08x}"
        )
    store.write(255, index, index_data)
    if args.metadata_only:
        print(f"{game['internalName']}: index {index} metadata-only", flush=True)
        return 0, 0

    try:
        archives = parse_index(index_data)
    except (Js5Error, IndexError, struct.error) as exc:
        print(f"{game['internalName']}: WARN: skip index {index}: {exc}", file=sys.stderr, flush=True)
        return 0, 0
    if args.archive_limit is not None:
        archives = archives[:args.archive_limit]

    missing = 0
    if args.skip_missing_archives and args.archive_workers > 1:
        received = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.archive_workers) as executor:
            futures = {
                executor.submit(fetch_one_archive, args, game, index, archive_entry["archive"]): archive_entry
                for archive_entry in archives
            }
            for future in concurrent.futures.as_completed(futures):
                archive_entry = futures[future]
                archive = archive_entry["archive"]
                try:
                    received[archive] = future.result()
                except (Js5Error, OSError):
                    missing += 1
        archive_iter = [
            (archive_entry, received[archive_entry["archive"]])
            for archive_entry in archives
            if archive_entry["archive"] in received
        ]
    elif args.skip_missing_archives:
        received = {}
        for archive, raw in client.fetch_available(
            index,
            archives,
            args.archive_idle_timeout,
            args.archive_batch_size,
        ):
            received[archive] = raw
        missing += len(archives) - len(received)
        archive_iter = [
            (archive_entry, received[archive_entry["archive"]])
            for archive_entry in archives
            if archive_entry["archive"] in received
        ]
    else:
        archive_iter = []
        for archive_entry in archives:
            archive_iter.append((archive_entry, client.fetch(index, archive_entry["archive"])[2]))

    written = 0
    for archive_entry, raw in archive_iter:
        archive = archive_entry["archive"]
        expected_crc = archive_entry["crc"]
        actual_crc = zlib.crc32(raw) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise Js5Error(
                f"{index}:{archive} CRC mismatch: expected {expected_crc:08x}, got {actual_crc:08x}"
            )
        version = archive_entry["version"] & 0xFFFF
        store.write(index, archive, raw + version.to_bytes(2, "big"))
        written += 1
    print(
        f"{game['internalName']}: index {index} archives={len(archives)} written={len(archive_iter)}",
        flush=True,
    )
    return written, missing


def fetch_one_archive(args, game, index, archive):
    build = game_build(args, game)
    with Js5Client(
        args.host,
        args.port,
        game["gamecrc"],
        build,
        args.server_num,
        args.lang,
        args.timeout,
    ) as client:
        return client.fetch(index, archive)[2]


def parse_int_set(value):
    out = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.update(range(int(lo), int(hi) + 1))
        else:
            out.add(int(part))
    return out


def main(argv):
    parser = argparse.ArgumentParser(description="Download AlterOrb/FunOrb JS5 caches without loading gamepacks.")
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--game", help="comma-separated internal game names")
    parser.add_argument("--output", default=".work/js5-caches")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--build", type=int, help="JS5 build to use for every selected game")
    parser.add_argument("--builds", help="JSON object mapping internal game names to JS5 builds")
    parser.add_argument("--server-num", type=int, default=DEFAULT_SERVER_NUM)
    parser.add_argument("--lang", type=int, default=DEFAULT_LANG)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--index-limit", type=int)
    parser.add_argument("--indexes", help="comma-separated JS5 indexes to download, e.g. 2,3,4,5 or 0-8")
    parser.add_argument("--archive-limit", type=int)
    parser.add_argument("--metadata-only", action="store_true", help="download only the master/index metadata")
    parser.add_argument("--keep-going", action="store_true", help="continue with the next game after a JS5 error")
    parser.add_argument("--skip-missing-archives", action="store_true", help="continue when an archive request times out")
    parser.add_argument("--archive-idle-timeout", type=float, default=3.0)
    parser.add_argument("--archive-batch-size", type=int, default=20)
    parser.add_argument("--archive-workers", type=int, default=1)
    parser.add_argument("--reconnect-per-index", action="store_true", help="open a fresh JS5 connection for each index")
    args = parser.parse_args(argv)
    if args.builds:
        with open(args.builds, "r", encoding="utf-8") as f:
            args.builds = json.load(f)

    games = load_games(args.config, args.game)
    failed = 0
    for game in games:
        try:
            download_game(args, game)
        except Js5Error as exc:
            failed += 1
            print(f"{game['internalName']}: ERROR: {exc}", file=sys.stderr, flush=True)
            if not args.keep_going:
                return 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
