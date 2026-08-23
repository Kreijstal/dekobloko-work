#!/usr/bin/env python3
"""Golden-vector generator for apps/server-js.

Conventions (see PORTING.md): expected bytes are produced BY RUNNING THE
PYTHON CODE -- this script imports/uses the original implementations and
records their outputs as JSON fixtures under test/fixtures/. Hex only; no
large binaries are committed (oversized plains are described by hash plus
head/tail snippets, and the JS tests rebuild them deterministically).

Usage: python3 test/gen-vectors.py [section ...]
Sections: bzip2 cache js5   (default: all that are implemented)
"""
from __future__ import annotations

import bz2
import gzip
import hashlib
import json
import pathlib
import sys
import zlib

HERE = pathlib.Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
BLOCK_MAGIC = bytes([0x31, 0x41, 0x59, 0x26, 0x53, 0x59])


def describe(name: str, description: str, payload: bytes, comp: bytes, *, extra=None):
    return {
        "name": name,
        "description": description,
        "plain_len": len(payload),
        "plain_sha256": hashlib.sha256(payload).hexdigest(),
        "plain_head_hex": payload[:32].hex(),
        "plain_tail_hex": payload[-32:].hex(),
        # Full plaintext kept only when small enough to commit comfortably.
        "plain_hex": payload.hex() if len(payload) <= 4096 else None,
        # The compressed input is what the JS decoder must consume.
        "compressed_hex": comp.hex(),
        **(extra or {}),
    }


# --------------------------------------------------------------------------
# bzip2 (exercises src/bzip2.js against CPython's libbz2)
# --------------------------------------------------------------------------

def gen_bzip2():
    vectors = []

    def add(name, description, payload, comp, **extra):
        vectors.append(describe(name, description, payload, comp, extra=extra))

    add("empty", "bz2.compress(b''): header + EOS, zero blocks",
        b"", bz2.compress(b""))

    add("tiny", "short mixed text", b"hello world hello", bz2.compress(b"hello world hello"))

    add("repetitive", "50k single-byte run: heavy RLE1 path", b"a" * 50000,
        bz2.compress(b"a" * 50000))

    repro = bytes(range(256)) * 40 + b"dekobloko js5 archive tail"
    add("repro", "full alphabet + tail (the original bug-report vector)", repro,
        bz2.compress(repro))

    import random
    rng = random.Random(42)
    entropy = rng.randbytes(4096)
    add("entropy", "high-entropy 4 KiB from random.Random(42)", entropy,
        bz2.compress(entropy))

    # NOTE: libbz2 splits blocks on its internal budget, which for highly
    # redundant data is far above 100_000 staged bytes -- measured empirically
    # here so the fixture really contains multiple blocks.
    unit = b"abcdefghij" * 12
    big = unit * 20000  # 2_400_000 bytes
    comp_big = bz2.compress(big, 1)
    blocks = comp_big.count(BLOCK_MAGIC)
    assert blocks >= 2, f"expected multi-block stream, got {blocks} blocks"
    add("multiblock", f"multi-block ({blocks} blocks) via compresslevel=1 over {len(big)} B",
        big, comp_big, blocks=blocks,
        rebuild_js="Buffer.from('abcdefghij'.repeat(12), 'utf8', 20000)")

    first, second = b"first member " * 8, b"second member!"
    comp_multi = bz2.compress(first, 1) + bz2.compress(second, 9)
    add("multimember", "two concatenated .bz2 members (bz2.decompress joins them)",
        first + second, comp_multi,
        member_plain_hex=(first + second).hex())

    return {
        "_meta": {
            "generator": "test/gen-vectors.py gen_bzip2()",
            "python": sys.version.split()[0],
            "notes": [
                "All compressed_hex values were produced by CPython bz2.compress.",
                "crc32_bzip2('123456789') must equal fc891918 (CRC-32/BZIP2 check value).",
                "zlib-flavoured CRCs are cross-checked below for src/bzip2.js's exported crc32.",
            ],
            "crc32_zlib_hello": zlib.crc32(b"hello") & 0xFFFFFFFF,
            "crc32_zlib_tiny_payload": zlib.crc32(b"hello world hello") & 0xFFFFFFFF,
        },
        "vectors": vectors,
    }


# --------------------------------------------------------------------------
# cache / js5 sections are appended as those modules are ported.
# --------------------------------------------------------------------------

SECTIONS = {
    "bzip2": (gen_bzip2, "bzip2.json"),
}


def main(argv):
    FIXTURES.mkdir(parents=True, exist_ok=True)
    wanted = argv or list(SECTIONS)
    for section in wanted:
        gen, filename = SECTIONS[section]
        out = FIXTURES / filename
        data = gen()
        out.write_text(json.dumps(data, indent=1, sort_keys=False) + chr(10))
        print(f"wrote {out.relative_to(HERE.parent.parent)} "
              f"({len(data.get('vectors', []))} vectors)")


if __name__ == "__main__":
    main(sys.argv[1:])
