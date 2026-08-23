#!/usr/bin/env python3
"""Generate golden-vector fixtures for the JS port by RUNNING the Python code.

Usage:
    cd /home/kreijstal/git/dekobloko-work
    PYTHONPATH=apps/server python3 apps/server-js/test/gen-vectors.py <module> ...

Writes JSON fixtures under apps/server-js/test/fixtures/. Bytes are hex-encoded;
oversized plains are described by hash plus head/tail snippets only.
Sections: config io bzip2 cache js5
"""
from __future__ import annotations

import bz2
import hashlib
import json
import random
import sys
import tempfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "server"))

FIXTURES = Path(__file__).resolve().parent / "fixtures"
BLOCK_MAGIC = bytes([0x31, 0x41, 0x59, 0x26, 0x53, 0x59])
NL = chr(10)


def dump(name, obj):
    FIXTURES.mkdir(parents=True, exist_ok=True)
    path = FIXTURES / (name + ".json")
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + NL, encoding="utf-8")
    print("wrote " + str(path))


def describe_payload(payload: bytes) -> dict:
    return {
        "plain_len": len(payload),
        "plain_sha256": hashlib.sha256(payload).hexdigest(),
        "plain_head_hex": payload[:32].hex(),
        "plain_tail_hex": payload[-32:].hex(),
        "plain_hex": payload.hex() if len(payload) <= 4096 else None,
    }


# ------------------------------------------------------------- config --------

def gen_config():
    from dekobloko_server import config as config_mod

    base = dict(
        host="127.0.0.1",
        http_port=8080,
        game_port1=43594,
        game_port2=43595,
        cache_dir="/tmp/dekobloko/cache",
        jar_path="/tmp/dekobloko/game.jar",
        rsa_key_path="/tmp/dekobloko/rsa.json",
        accounts_path="/tmp/dekobloko/accounts.json",
        auto_register=True,
        servernum=12345,
        gamecrc=1122334455,
        instanceid=42,
        member="1",
        lang=0,
        affid=77,
        simplemode="0",
        display_name="Dekobloko",
        player_id=1,
        welcome_message="Welcome to Dekobloko!",
    )

    def build(label, **overrides):
        fields = dict(base)
        fields.update(overrides)
        cfg = config_mod.ServerConfig(**fields)
        return {"label": label, "inputs": fields, "applet_params": cfg.applet_params}

    cases = [
        build("default_like"),
        build("alt", host="0.0.0.0", http_port=9000, game_port1=40001,
              game_port2=40002, auto_register=False, servernum=7, gamecrc=99,
              instanceid=1234, member="0", lang=3, affid=9, simplemode="1",
              display_name="Alt", player_id=2, welcome_message="Hi!"),
    ]
    dump("config", {"cases": cases})


# ---------------------------------------------------------------- io ---------

class FakeSock:
    """Mirrors socket.recv/sendall semantics used by dekobloko_server.io.

    sendall() appends to both .sent (one stream) and .chunks (per-call pieces);
    JS5 framing tests assert the exact chunk sequence.
    """

    def __init__(self, data=b""):
        self._buf = bytearray(data)
        self.sent = bytearray()
        self.chunks = []

    def recv(self, size):
        if not self._buf:
            return b""
        chunk = self._buf[:size]
        del self._buf[:size]
        return bytes(chunk)

    def sendall(self, data):
        self.chunks.append(bytes(data))
        self.sent.extend(data)


def gen_io():
    from dekobloko_server import io as io_mod

    cases = []

    sock = FakeSock(bytes([1, 2, 3, 4, 5]))
    got = io_mod.read_exact(sock, 5)
    cases.append({"op": "read_exact", "in_hex": "0102030405", "size": 5,
                  "out_hex": got.hex()})

    sock = FakeSock(b"ab")
    try:
        io_mod.read_exact(sock, 4)
        raise AssertionError("expected EOFError")
    except EOFError as exc:
        cases.append({"op": "read_exact_eof", "in_hex": "6162", "size": 4,
                      "error": type(exc).__name__, "message": str(exc)})

    sock = FakeSock(bytes([0xAB]))
    cases.append({"op": "read_u8", "in_hex": "ab", "out": io_mod.read_u8(sock)})
    sock = FakeSock(bytes.fromhex("f1f2"))
    cases.append({"op": "read_u16", "in_hex": "f1f2", "out": io_mod.read_u16(sock)})
    sock = FakeSock(bytes.fromhex("ffffffff"))
    cases.append({"op": "read_i32", "in_hex": "ffffffff", "out": io_mod.read_i32(sock)})
    sock = FakeSock(bytes.fromhex("80000000"))
    cases.append({"op": "read_i32", "in_hex": "80000000", "out": io_mod.read_i32(sock)})
    sock = FakeSock(bytes.fromhex("7fffffff"))
    cases.append({"op": "read_i32", "in_hex": "7fffffff", "out": io_mod.read_i32(sock)})

    for value in (0, 0xFF, 0x100, 300):
        sock = FakeSock()
        io_mod.write_u8(sock, value)
        cases.append({"op": "write_u8", "value": value, "out_hex": bytes(sock.sent).hex()})
    for value in (0, 0xFFFF, 70000, 0x1234ABCD):
        sock = FakeSock()
        io_mod.write_u16(sock, value)
        cases.append({"op": "write_u16", "value": value, "out_hex": bytes(sock.sent).hex()})
    for value in (0, 1, 2**40 + 5, 2**63, -1):
        sock = FakeSock()
        io_mod.write_u64(sock, value)
        cases.append({"op": "write_u64", "value": value, "out_hex": bytes(sock.sent).hex()})

    data = b"hello world"
    cases.append({"op": "hex_preview", "in_hex": data.hex(), "limit": 32,
                  "out": io_mod.hex_preview(data)})
    data = bytes(range(40))
    cases.append({"op": "hex_preview", "in_hex": data.hex(), "limit": 32,
                  "out": io_mod.hex_preview(data)})
    cases.append({"op": "hex_preview", "in_hex": data.hex(), "limit": 8,
                  "out": io_mod.hex_preview(data, 8)})
    cases.append({"op": "hex_preview", "in_hex": "", "limit": 32,
                  "out": io_mod.hex_preview(b"", 32)})

    dump("io", {"cases": cases})


# -------------------------------------------------------------- bzip2 --------

def gen_bzip2():
    vectors = []

    def add(name, description, payload, comp, **extra):
        vec = {"name": name, "description": description}
        vec.update(describe_payload(payload))
        vec["compressed_hex"] = comp.hex()
        vec.update(extra)
        vectors.append(vec)

    add("empty", "bz2.compress(b''): header + EOS, zero blocks",
        b"", bz2.compress(b""))

    add("tiny", "short mixed text", b"hello world hello",
        bz2.compress(b"hello world hello"))

    add("repetitive", "50k single-byte run: heavy RLE1 path", b"a" * 50000,
        bz2.compress(b"a" * 50000))

    repro = bytes(range(256)) * 40 + b"dekobloko js5 archive tail"
    add("repro", "full alphabet + tail (the original bug-report vector)", repro,
        bz2.compress(repro))

    rng = random.Random(42)
    entropy = rng.randbytes(4096)
    add("entropy", "high-entropy 4 KiB from random.Random(42)", entropy,
        bz2.compress(entropy))

    # libbz2 splits blocks on an internal budget far above 100_000 staged
    # bytes for redundant data -- measured empirically so the fixture really
    # contains multiple blocks.
    unit = b"abcdefghij" * 12
    big = unit * 20000
    comp_big = bz2.compress(big, 1)
    blocks = comp_big.count(BLOCK_MAGIC)
    assert blocks >= 2, "expected multi-block stream, got %d blocks" % blocks
    add("multiblock", "multi-block (%d blocks) via compresslevel=1" % blocks,
        big, comp_big, blocks=blocks)

    first, second = b"first member " * 8, b"second member!"
    comp_multi = bz2.compress(first, 1) + bz2.compress(second, 9)
    add("multimember", "two concatenated .bz2 members",
        first + second, comp_multi,
        member_plain_hex=(first + second).hex())

    dump("bzip2", {
        "_meta": {
            "generator": "gen_bzip2()",
            "notes": [
                "All compressed_hex produced by CPython bz2.compress.",
                "CRC-32/BZIP2 check: crc32_bzip2('123456789') == fc891918.",
                "Reflected flavour cross-check below for src/bzip2.js crc32().",
            ],
            "crc32_zlib_hello": zlib.crc32(b"hello") & 0xFFFFFFFF,
            "crc32_zlib_tiny_payload": zlib.crc32(b"hello world hello") & 0xFFFFFFFF,
        },
        "vectors": vectors,
    })


# ---------------------------------------------------------------- cache ------

SECTOR = 520


def u24(v):
    return v.to_bytes(3, "big")


def build_synthetic_cache(directory: Path):
    """Write a tiny deterministic Jagex cache exercising every reader branch.

    Returns filespecs describing the exact bytes for the JS tests to replay."""
    dat2 = bytearray()
    # Sector 0 is never used by real caches and the reader rejects sector<=0.
    dat2.extend(bytes(SECTOR))

    def add_sector(image: bytes) -> int:
        assert len(image) == SECTOR
        pad = -(len(dat2)) % SECTOR
        if pad:
            dat2.extend(bytes(pad))
        idx = len(dat2) // SECTOR
        dat2.extend(image)
        return idx

    def small_sector(group, chunk, nxt, archive, block):
        head = (group.to_bytes(2, "big") + chunk.to_bytes(2, "big") +
                u24(nxt) + bytes([archive]))
        img = head + block
        if len(img) < SECTOR:
            img += bytes(SECTOR - len(img))
        return img

    def big_sector(group, chunk, nxt, archive, block):
        head = (group.to_bytes(4, "big") + chunk.to_bytes(2, "big") +
                u24(nxt) + bytes([archive]))
        img = head + block
        if len(img) < SECTOR:
            img += bytes(SECTOR - len(img))
        return img

    def container(payload: bytes) -> bytes:
        # Uncompressed js5 container: 0x00 + u32 length + payload.
        return bytes([0]) + len(payload).to_bytes(4, "big") + payload

    indexes = {}

    # Archive 7 group 3: 1200-byte container across three 512-byte chunks.
    filler = ((b"dekobloko synthetic js5 payload " * 40) + bytes(range(200)))[:1195]
    p1 = container(filler)
    assert len(p1) == 1200
    s1 = add_sector(small_sector(3, 0, 2, 7, p1[0:512]))
    s2 = add_sector(small_sector(3, 1, 3, 7, p1[512:1024]))
    add_sector(small_sector(3, 2, 0, 7, p1[1024:]))
    idx7 = bytearray(4 * 6)
    idx7[3 * 6:4 * 6] = (1200).to_bytes(3, "big") + u24(s1)
    indexes["main_file_cache.idx7"] = bytes(idx7)

    # Archive 8 group 5: broken chain (second sector claims chunk id 7).
    p2 = bytes([0]) + (695).to_bytes(4, "big") + (b"z" * 695)
    assert len(p2) == 700
    b1 = add_sector(small_sector(5, 0, 0, 8, p2[0:512]))
    add_sector(small_sector(5, 7, 0, 8, p2[512:]))  # wrong chunk id on purpose
    idx8 = bytearray(6 * 6)
    idx8[5 * 6:6 * 6] = (700).to_bytes(3, "big") + u24(b1)
    indexes["main_file_cache.idx8"] = bytes(idx8)

    # Archive 9 group 70000 (>0xFFFF path, 10-byte sector headers).
    p3 = container((bytes(range(256)) * 3)[:595])
    assert len(p3) == 600
    t1 = add_sector(big_sector(70000, 0, 7, 9, p3[0:510]))
    assert t1 + 1 == 7, "big-sector next pointer hardcodes sector 7"
    add_sector(big_sector(70000, 1, 0, 9, p3[510:]))
    idx9 = bytearray(420006)
    off = 70000 * 6
    idx9[off:off + 6] = (600).to_bytes(3, "big") + u24(t1)
    indexes["main_file_cache.idx9"] = bytes(idx9)

    # Archive 5 group 1: container followed by 12 bytes of on-disk trailer.
    inner = container(b"A" * 95)
    padded = inner + bytes([0xAA]) * 12
    s_pad = add_sector(small_sector(1, 0, 0, 5, padded))
    idx5 = bytearray(2 * 6)
    idx5[1 * 6:2 * 6] = (112).to_bytes(3, "big") + u24(s_pad)
    indexes["main_file_cache.idx5"] = bytes(idx5)

    # Archive 255: ten zeroed records -> generated master index count=10
    # (container 726 bytes -> framed across multiple socket writes).
    indexes["main_file_cache.idx255"] = bytes(10 * 6)

    directory.mkdir(parents=True, exist_ok=True)
    (directory / "main_file_cache.dat2").write_bytes(bytes(dat2))
    for name, blob in indexes.items():
        (directory / name).write_bytes(blob)

    filespecs = [{
        "file": "main_file_cache.dat2",
        "truncate": len(dat2),
        "writes": [{"offset": 0, "hex": bytes(dat2).hex()}],
    }]
    for name, blob in indexes.items():
        spec = {"file": name, "truncate": len(blob), "writes": []}
        if name.endswith("idx9"):
            # Only carry the non-sparse region: everything before the record
            # is zeros, recreated by the JS test via truncate().
            o = 70000 * 6
            spec["writes"].append({"offset": o, "hex": bytes(blob[o:]).hex()})
        else:
            spec["writes"].append({"offset": 0, "hex": blob.hex()})
        filespecs.append(spec)

    return filespecs


def gen_cache():
    from dekobloko_server.cache import CacheStore

    out = {}

    # --- deterministic synthetic mini-cache ---------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        filespecs = build_synthetic_cache(d)
        cs = CacheStore(d)

        reads = []
        for archive, group in [
            (7, 3), (9, 70000), (8, 5), (7, 0), (7, 4), (9, 70001), (255, 255),
        ]:
            raw = cs.read(archive, group)
            entry = {"archive": archive, "group": group,
                     "result_hex": None if raw is None else raw.hex()}
            if raw is not None:
                entry.update(describe_payload(raw))
            reads.append(entry)

        stats = []
        for archive, group in [(7, 3), (9, 70000), (5, 1), (8, 5)]:
            st = cs.stats(archive, group)
            stats.append({"archive": archive, "group": group,
                          "result": None if st is None else vars(st)})

        versions = {}
        for archive in (7, 9):
            versions[str(archive)] = {str(k): v for k, v in
                                      cs._read_group_versions(archive).items()}
        gv = []
        for archive, group in [(7, 3), (7, 0), (9, 70000), (5, 1)]:
            gv.append({"archive": archive, "group": group,
                       "result": cs.group_version(archive, group)})

        small = CacheStore(d, max_entry_size=10)
        clamp = small.read(7, 3)
        empty_store = CacheStore(Path(tmp) / "does-not-exist")
        out["synthetic"] = {
            "_meta": {"note": "built by build_synthetic_cache(); goldens read "
                              "back through the REAL CacheStore"},
            "filespecs": filespecs,
            "reads": reads,
            "stats": stats,
            "group_versions_map": versions,
            "group_version_probes": gv,
            "clamped_read_is_none": clamp is None,
            "missing_cache_available": empty_store.available(),
            "missing_cache_read": empty_store.read(7, 3),
        }

    # --- live cache (geoblox), used only when present -----------------------
    live_dir = Path.home() / ".alterorb" / "caches" / "geoblox"
    if not (live_dir / "main_file_cache.dat2").is_file():
        out["live"] = {"_meta": {"present": False}}
        dump("cache", out)
        return

    cs = CacheStore(live_dir)
    pairs = [(255, 0), (0, 0), (6, 1), (255, 255)]
    idx0 = (live_dir / "main_file_cache.idx0").read_bytes()
    best_gid, best_len = None, 0
    for gid in range(len(idx0) // 6):
        rec = idx0[gid * 6:gid * 6 + 6]
        ln = int.from_bytes(rec[0:3], "big")
        sec = int.from_bytes(rec[3:6], "big")
        if ln > best_len and sec > 0:
            best_gid, best_len = gid, ln
    if best_gid is not None:
        pairs.append((0, best_gid))

    reads = []
    for archive, group in pairs:
        raw = cs.read(archive, group)
        entry = {"archive": archive, "group": group, "result_hex": None}
        if raw is not None:
            entry["result_hex"] = raw.hex()
            entry.update(describe_payload(raw))
        reads.append(entry)

    versions0 = {str(k): v for k, v in cs._read_group_versions(0).items()}
    gv = [{"archive": a, "group": g, "result": cs.group_version(a, g)}
          for a, g in [(0, 0), (0, 1), (0, 2), (6, 1), (255, 0)]]

    table = cs.read(255, 0)
    out["live"] = {
        "_meta": {"present": True, "cache_dir_name": live_dir.name},
        "reads": reads,
        "stats": [{"archive": a, "group": g,
                   "result": None if cs.stats(a, g) is None else vars(cs.stats(a, g))}
                  for a, g in [(0, 0), (255, 0), (0, best_gid or 0)]],
        "group_versions_archive0": versions0,
        "group_version_probes": gv,
        "table255_0_head_hex": table[:96].hex(),
        "table255_0_compression": table[0],
        "largest_idx0_group": best_gid,
    }
    dump("cache", out)


# ------------------------------------------------------------------ js5 ------

def gen_js5():
    from dekobloko_server.cache import CacheStore
    from dekobloko_server.js5 import (
        Js5Request, Js5Session, _load_substitute, _as_container,
        _group_table_crc_offset, _decompress,
    )

    out = {"pure": {}, "synthetic": {}, "live": {}}

    sub = _load_substitute(6, 1)
    sub_desc = {"path": "apps/server/synthetic/archive6_group1.bin"}
    sub_desc.update(describe_payload(sub))
    sub_desc["crc32"] = zlib.crc32(sub) & 0xFFFFFFFF
    out["pure"]["substitute"] = sub_desc
    out["pure"]["load_missing_substitute_is_none"] = _load_substitute(7, 7) is None

    crc_cases = []
    for label, blob in [("empty", b""), ("hello", b"hello"),
                        ("123456789", b"123456789"), ("substitute", sub)]:
        crc_cases.append({"label": label, "crc32": zlib.crc32(blob) & 0xFFFFFFFF})
    out["pure"]["crc32_cases"] = crc_cases

    out["pure"]["as_container_abc_hex"] = _as_container(b"abc").hex()

    # synthetic group-table for CRC-offset probing (protocol 6, flags 0)
    tbl = bytearray()
    tbl += bytes([6])
    tbl += (0).to_bytes(4, "big")           # version
    tbl += bytes([0])                        # flags
    ids = [0, 1]
    tbl += (2).to_bytes(2, "big")
    prev = 0
    for gid in ids:
        tbl += (gid - prev).to_bytes(2, "big")
        prev = gid
    for gid in ids:                          # CRCs
        tbl += (0xDEAD0000 + gid).to_bytes(4, "big")
    for gid in ids:                          # versions
        tbl += gid.to_bytes(4, "big")
    out["pure"]["synthetic_table"] = {
        "table_hex": bytes(tbl).hex(),
        "offsets": {str(g): _group_table_crc_offset(bytes(tbl), g)
                    for g in [0, 1, 42]},
    }

    xor_cases = []
    for key in (0x00, 0x5A, 0xFF):
        blob = bytes([0x00, 0xFF, 0x10, 0x5A])
        xored = bytes(b ^ key for b in blob) if key else blob
        xor_cases.append({"key": key, "in_hex": blob.hex(), "out_hex": xored.hex()})
    out["pure"]["xor_cases"] = xor_cases

    # Direct encodes replicating _handle_file_request's packet assembly.
    def encode(request, raw):
        if request.archive_id != 255:
            compression = raw[0]
            clen = int.from_bytes(raw[1:5], "big")
            need = (5 if compression == 0 else 9) + clen
            if len(raw) < need:
                return None
            if len(raw) > need:
                raw = raw[:need]
        if len(raw) < 5:
            return None
        compression = raw[0]
        clen = int.from_bytes(raw[1:5], "big")
        flags = compression & 0x7F
        if not request.priority:
            flags |= 0x80
        pkt = bytearray()
        pkt.append(request.archive_id & 0xFF)
        pkt.extend(request.group_id.to_bytes(4, "big"))
        pkt.append(flags)
        pkt.extend(clen.to_bytes(4, "big"))
        pkt.extend(raw[5:])
        return bytes(pkt)

    cont = bytes([0]) + (5).to_bytes(4, "big") + b"12345"
    gz_head = bytes([0x1F, 0x8B, 8, 0])
    gz = bytes([2]) + (0).to_bytes(4, "big") + gz_head + b"payloadish"
    truncated = bytes([0]) + (50).to_bytes(4, "big") + b"short"
    trailer_raw = bytes([0]) + (3).to_bytes(4, "big") + b"abc" + bytes([0x11, 0x22, 0x33])
    enc = [
        {"label": "priority_small", "raw_hex": cont.hex(), "priority": True,
         "archive": 5, "group": 9,
         "packet_hex": encode(Js5Request(True, 5, 9), cont).hex()},
        {"label": "nonpriority_flags80", "raw_hex": cont.hex(), "priority": False,
         "archive": 5, "group": 9,
         "packet_hex": encode(Js5Request(False, 5, 9), cont).hex()},
        {"label": "gzip_header_length9", "raw_hex": gz.hex(), "priority": True,
         "archive": 4, "group": 1,
         "packet_hex": encode(Js5Request(True, 4, 1), gz).hex()},
        {"label": "truncated_null", "raw_hex": truncated.hex(), "priority": True,
         "archive": 5, "group": 9, "packet_hex": None},
        {"label": "short_255_null", "raw_hex": "000000", "priority": True,
         "archive": 255, "group": 1,
         "packet_hex": encode(Js5Request(True, 255, 1), bytes([0, 0, 0]))},
        {"label": "trailer_stripped", "raw_hex": trailer_raw.hex(), "priority": True,
         "archive": 5, "group": 2,
         "packet_hex": encode(Js5Request(True, 5, 2), trailer_raw).hex()},
    ]
    out["pure"]["encode_cases"] = enc

    # Framing reference: chunk structure per size.
    def py_frame(packet):
        if len(packet) <= 512:
            return [packet]
        chunks = [packet[:512]]
        offset = 512
        while offset < len(packet):
            chunks.append(bytes([0xFF]))
            end = min(offset + 511, len(packet))
            chunks.append(packet[offset:end])
            offset = end
        return chunks

    fr = []
    for n in (0, 1, 512, 513, 1023, 1024, 2000):
        packet = bytes((i * 37 + 11) & 0xFF for i in range(n))
        chunks = py_frame(packet)
        joined = b"".join(chunks)
        fr.append({"packet_len": n, "chunk_lens": [len(c) for c in chunks],
                   # Identify markers by CONTENT: a multi-chunk frame whose
                   # final data slice is exactly one byte is not a marker.
                   "marker_positions_hex":
                       [c.hex() for c in chunks if len(c) == 1 and c == b"\xff"],
                   "packet_sha256": hashlib.sha256(packet).hexdigest(),
                   "chunks_stream_sha256": hashlib.sha256(joined).hexdigest()})
    out["pure"]["frame_cases"] = fr

    # --- session behaviour over the synthetic cache ----------------------
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        build_synthetic_cache(d)
        cache = CacheStore(d)

        def capture(priority, archive, group, xor_key=0):
            sock = FakeSock()
            session = Js5Session(sock, cache, "test-peer")
            session.xor_key = xor_key
            session._handle_file_request(Js5Request(priority, archive, group))
            stream = bytes(sock.sent)
            rec = {
                "request": [priority, archive, group],
                "xor_key": xor_key,
                "chunk_lens": [len(c) for c in sock.chunks],
                "stream_len": len(stream),
                "stream_sha256": hashlib.sha256(stream).hexdigest(),
            }
            if len(stream) <= 1024:
                rec["stream_hex"] = stream.hex()
            if xor_key:
                rec["stream_hex"] = stream.hex()
            return rec

        out["synthetic"] = {"requests": [
            capture(True, 255, 255),
            capture(False, 255, 255),
            capture(True, 7, 3),
            capture(False, 7, 3),
            capture(True, 9, 70000),
            capture(True, 8, 5),   # broken chain -> empty container reply
            capture(False, 2, 3),  # miss -> empty container reply
            capture(True, 6, 1),   # substitute (real committed synthetic file)
            capture(True, 5, 1),   # trailer stripped
            capture(True, 7, 3, xor_key=0x5A),
        ]}

    # --- live cache extras ----------------------------------------------
    live_dir = Path.home() / ".alterorb" / "caches" / "geoblox"
    if not (live_dir / "main_file_cache.dat2").is_file():
        out["live"] = {"_meta": {"present": False}}
        dump("js5", out)
        return

    cache = CacheStore(live_dir)

    def capture_live(priority, archive, group):
        sock = FakeSock()
        session = Js5Session(sock, cache, "live-peer")
        session._handle_file_request(Js5Request(priority, archive, group))
        stream = bytes(sock.sent)
        rec = {"request": [priority, archive, group],
               "chunk_lens": [len(c) for c in sock.chunks],
               "stream_len": len(stream),
               "stream_sha256": hashlib.sha256(stream).hexdigest()}
        if len(stream) <= 2048:
            rec["stream_hex"] = stream.hex()
        return rec

    table = cache.read(255, 0)
    decompressed = _decompress(table)
    master_index = Js5Session(FakeSock(), cache, "x")._build_master_index().hex()
    out["live"] = {
        "_meta": {"present": True},
        "requests": [
            capture_live(True, 255, 255),   # generated unsigned master index
            capture_live(True, 0, 0),
            capture_live(False, 0, 0),
            capture_live(False, 2, 3),      # documented miss -> empty container
            capture_live(True, 6, 1),       # substitute
        ],
        "table255_0_decompressed_len": len(decompressed),
        "table255_0_decompressed_head_hex": decompressed[:24].hex(),
        "crc_offsets": {str(g): _group_table_crc_offset(decompressed, g)
                        for g in [0, 1, 2, 424242]},
        "master_index_generated_hex": master_index,
    }
    dump("js5", out)


# ------------------------------------------------------------- crypto --------

_ROOT = Path(__file__).resolve().parents[3]


def _gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a


def _is_prime(x: int) -> bool:
    if x < 2:
        return False
    i = 2
    while i * i <= x:
        if x % i == 0:
            return False
        i += 1
    return True


def _prime_from(start: int) -> int:
    x = start | 1
    while not _is_prime(x):
        x += 2
    return x


def _synth_rsa(p_start: int, q_start: int, e: int):
    p = _prime_from(p_start)
    q = _prime_from(q_start)
    if q == p:
        q = _prime_from(q + 2)
    phi = (p - 1) * (q - 1)
    assert _gcd(e, phi) == 1, "chosen e is not coprime with phi"
    # Strings so JSON consumers (JS BigInt) never lose precision above 2**53.
    return {"n": str(p * q), "d": str(pow(e, -1, phi)), "e": str(e)}


def gen_crypto():
    from dekobloko_server import crypto as cm

    rng = random.Random(20240601)

    # --- scalar conversions -------------------------------------------------
    scalars = []
    scalar_cases = [
        ("u32", [0], cm.u32(0)),
        ("u32", [-1], cm.u32(-1)),
        ("u32", [2**32 + 5], cm.u32(2**32 + 5)),
        ("u32", [0xDEADBEEF], cm.u32(0xDEADBEEF)),
        ("signed32", [0x7FFFFFFF], cm.signed32(0x7FFFFFFF)),
        ("signed32", [0xFFFFFFFF], cm.signed32(0xFFFFFFFF)),
        ("signed32", [0x80000000], cm.signed32(0x80000000)),
        ("signed32", [-3], cm.signed32(-3)),
        ("i32", [0xCAFEBABE], cm.i32(0xCAFEBABE)),
        ("urshift", [-1, 31], cm.urshift(-1, 31)),
        ("urshift", [0x12345678, 11], cm.urshift(0x12345678, 11)),
    ]
    for name, args, out in scalar_cases:
        scalars.append({"op": name, "args": args, "out": out})

    buf = bytes.fromhex("ffffffff00000000800000007f123456")
    for off in (0, 4, 5, len(buf) - 1):  # last one hits the short-slice quirk
        scalars.append({"op": "read_i32_be", "in_hex": buf.hex(),
                        "offset": off, "out": cm.read_i32_be(buf, off)})

    # --- XTEA ---------------------------------------------------------------
    key_sets = {
        "zeros": [0, 0, 0, 0],
        "classic": [0x12345678, 0x9ABCDEF0, 0xFEDCBA98, 0x76543210],
        "high_bits": [0xFFFFFFFF, 0x80000000, -1, 0xDEADBEEF],
        "mixed_sign": [305419896, -2005440877, 123456789, -1],
    }
    plains = {
        "zero_block": bytes(8),
        "pattern24": bytes(rng.getrandbits(8) for _ in range(24)),
        "high16": bytes.fromhex("ffeeddccbbaa99887766554433221100"),
    }
    xtea_cases = []
    for kname, keys in key_sets.items():
        for pname, plain in plains.items():
            enc = cm.xtea_encrypt_dekobloko(plain, keys)
            xtea_cases.append({"name": f"enc/{kname}/{pname}", "dir": "encrypt",
                               "keys": keys, "in_hex": plain.hex(),
                               "out_hex": enc.hex()})
            dec = cm.xtea_decrypt_dekobloko(enc, keys)
            xtea_cases.append({"name": f"dec/{kname}/{pname}", "dir": "decrypt",
                               "keys": keys, "in_hex": enc.hex(),
                               "out_hex": dec.hex()})
    empty = cm.xtea_encrypt_dekobloko(b"", key_sets["classic"])
    assert empty == b""
    xtea_cases.append({"name": "enc/classic/empty", "dir": "encrypt",
                       "keys": key_sets["classic"], "in_hex": "",
                       "out_hex": ""})
    for bad_len in (1, 7, 9):
        try:
            cm.xtea_encrypt_dekobloko(bytes(bad_len), key_sets["classic"])
            raise AssertionError("expected ValueError")
        except ValueError as exc:
            xtea_cases.append({"name": f"err/len{bad_len}", "dir": "encrypt",
                               "keys": key_sets["classic"],
                               "in_hex": bytes(bad_len).hex(),
                               "out_hex": "", "error": str(exc)})
    try:
        cm.xtea_encrypt_dekobloko(bytes(8), [1, 2, 3])
        raise AssertionError("expected ValueError")
    except ValueError as exc:
        xtea_cases.append({"name": "err/keys3", "dir": "encrypt", "keys": [1, 2, 3],
                           "in_hex": bytes(8).hex(), "out_hex": "",
                           "error": str(exc)})

    # --- ISAAC --------------------------------------------------------------
    def stream(seed, count):
        c = cm.IsaacCipher(seed)
        return ["%08x" % c.next() for _ in range(count)]

    isaac_cases = []
    seed_ramp = list(range(256))
    isaac_cases.append({"name": "ramp256", "seed": seed_ramp,
                        "stream_hex": stream(seed_ramp, 300)})  # crosses a refill

    login_seed = [0x11223344, 0x55667788, 0x99AABBCC, 0xDDEEFF00]
    isaac_cases.append({"name": "login4", "seed": login_seed,
                        "stream_hex": stream(login_seed, 32)})
    shifted = [v + 50 for v in login_seed]  # packets.py outbound flavour
    isaac_cases.append({"name": "login4_plus50", "seed": shifted,
                        "stream_hex": stream(shifted, 32)})

    neg_seed = [0xFFFFFFFF, 0x80000000, 123456789, -1]
    isaac_cases.append({"name": "negative_inputs", "seed": neg_seed,
                        "stream_hex": stream(neg_seed, 32)})

    long_seed = [(i * 2654435761) & 0xFFFFFFFF for i in range(300)]
    isaac_cases.append({"name": "long_seed_truncated_to_256", "seed": long_seed,
                        "stream_hex": stream(long_seed[:256], 8)})

    nb_cipher = cm.IsaacCipher(login_seed)
    nb = bytes(nb_cipher.next_byte() for _ in range(12))
    enc_cipher = cm.IsaacCipher(login_seed)
    ops = [0, 1, 127, 128, 255, 42]
    enc_ops = [enc_cipher.encrypt_opcode(op) for op in ops]
    dec_cipher = cm.IsaacCipher(login_seed)
    dec_ops = [dec_cipher.decrypt_opcode(x) for x in enc_ops]
    assert dec_ops == ops
    isaac_cases.append({"name": "opcode_helpers", "seed": login_seed,
                        "next_byte_hex": nb.hex(), "plaintext_ops": ops,
                        "encrypted_ops_hex": ["%02x" % v for v in enc_ops],
                        "decrypted_ops": dec_ops})

    # --- RSA ----------------------------------------------------------------
    rsa_cases = []

    def rsa_case(label, key, message_int, pad_to=None):
        n, d, e = int(key["n"]), int(key["d"]), int(key["e"])
        k = (n.bit_length() + 7) // 8
        cipher_int = pow(message_int, e, n)
        ct_len = k if pad_to is None else pad_to
        ct = (cipher_int.to_bytes(ct_len, "big") if cipher_int
              else b"\x00" * ct_len)
        out = cm.RsaPrivateKey(n=n, d=d, e=e).decrypt_block(ct)
        rsa_cases.append({"name": label, "key": key,
                          "cipher_hex": ct.hex(), "plain_hex": out.hex()})

    small = _synth_rsa(1000, 2000, 17)       # textbook scale (p~1009, q~2003)
    mid = _synth_rsa(10**9, 2 * 10**9, 65537)
    rsa_case("small_textbook_msg1", small, 1)
    rsa_case("small_textbook_msg72", small, 72)   # the classic "Hi" example
    rsa_case("small_leading_zero_msg", small,
             int.from_bytes(bytes.fromhex("00ff00ff"), "big"))
    n_small = int(small["n"])
    rsa_case("small_max_msg", small, n_small - 1)
    zero_key = cm.RsaPrivateKey(n=n_small, d=int(small["d"]))
    zero_ct = b"\x00" * ((n_small.bit_length() + 7) // 8)
    rsa_cases.append({"name": "zero_cipher", "key": small,
                      "cipher_hex": zero_ct.hex(),
                      "plain_hex": zero_key.decrypt_block(zero_ct).hex()})
    msg_mid = int.from_bytes(bytes(rng.getrandbits(8) for _ in range(15)), "big")
    rsa_case("mid_modulus_15b", mid, msg_mid)

    # Real deployment key, when present (.work/multiplayer/dekobloko-rsa-private.json).
    real_path = _ROOT / ".work" / "multiplayer" / "dekobloko-rsa-private.json"
    if real_path.is_file():
        data = json.loads(real_path.read_text(encoding="utf-8"))
        real = {"n": str(data["n"]), "d": str(data["d"]),
                "e": str(data.get("e", 65537))}
        msg_real = int.from_bytes(bytes(range(1, 40)), "big")
        assert msg_real < int(real["n"])
        rsa_case("real_deployment_key", real, msg_real)

    dump("crypto", {
        "_meta": {
            "generator": "gen_crypto()",
            "note": "byte fields hex; ints decimal; isaac streams are %08x words",
        },
        "scalars": scalars,
        "xtea": xtea_cases,
        "isaac": isaac_cases,
        "rsa": rsa_cases,
    })


# ----------------------------------------------------------------- http ------

def gen_http():
    from dekobloko_server.config import ServerConfig
    from dekobloko_server.http import DekoblokoHTTPRequestHandler, DekoblokoHTTPServer

    base = dict(
        host="127.0.0.1", http_port=8080, game_port1=43594, game_port2=43595,
        cache_dir="/tmp/dk/cache",
        jar_path="/tmp/dk/www/dekobloko-rsa-client.jar",
        rsa_key_path="/tmp/dk/rsa.json", accounts_path="/tmp/dk/accounts.json",
        auto_register=True, servernum=12345, gamecrc=1122334455,
        instanceid=42, member="1", lang=0, affid=77, simplemode="0",
        display_name="Dekobloko", player_id=1, welcome_message="Welcome!",
    )

    def make_handler(fields):
        cfg = ServerConfig(**fields)
        handler = object.__new__(DekoblokoHTTPRequestHandler)
        server = object.__new__(DekoblokoHTTPServer)
        server.config = cfg
        handler.server = server
        return handler

    cases = []
    nasty = dict(base)
    nasty["member"] = '"><script>&amp;'
    nasty["simplemode"] = "a&b'c\"d"
    for label, fields in [("default_like", base), ("nasty_values", nasty)]:
        handler = make_handler(fields)
        cases.append({
            "label": label,
            "inputs": {k: str(v) for k, v in fields.items()},
            "index_html": handler._index_html(),
        })

    handler = make_handler(base)
    dump("http", {
        "index_cases": cases,
        "simple_page": {
            "title": "Reload",
            "body": '<a href="/">Return to game</a>',
            "out": handler._simple_page("Reload", '<a href="/">Return to game</a>'),
        },
        "countrylist_ws_body":
            "0|Local\n276|Germany\n826|United Kingdom\n840|United States\n",
        "clienterror_ws_body_hex": "0a",  # b"\n"
    })


GENERATORS = {
    "config": gen_config,
    "io": gen_io,
    "bzip2": gen_bzip2,
    "cache": gen_cache,
    "js5": gen_js5,
    "crypto": gen_crypto,
    "http": gen_http,
}


def main():
    targets = sys.argv[1:] or sorted(GENERATORS)
    for name in targets:
        GENERATORS[name]()
    print("done: " + ", ".join(targets))


if __name__ == "__main__":
    sys.exit(main())
