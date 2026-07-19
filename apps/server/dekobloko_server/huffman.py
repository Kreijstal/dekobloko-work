"""Chat text Huffman codec.

Chat bodies are compressed with a table the client loads from archive 3, file
"huffman" (client.java:4669: `new jk(cl.field_y.a(0, "huffman", ""))`). The raw
table is 256 bytes -- one code length per character -- but the code VALUES are
produced by jk's constructor, which assigns them in character order with
per-length counters and carry propagation between lengths.

That construction was reimplemented by hand twice and was wrong both times
(plain canonical ordering yields 'sfee'/'yb' for known-good input; a literal
translation of the constructor yields nothing at all). Rather than keep
guessing, the code table was dumped from the client's OWN jk class -- loaded in
a JVM with the real table bytes and read back by reflection -- into
huffman-codes.csv as `char,bitlength,code` rows.

Verified against captured traffic: `e7 bc` -> "test", `8d 09 80` -> "lmao".

If the cache is ever replaced, regenerate the CSV rather than editing it; the
values are derived, not authored.
"""
from __future__ import annotations

from pathlib import Path

_CSV = Path(__file__).resolve().parent / "huffman-codes.csv"
_table: dict[tuple[int, int], int] | None = None


def _load() -> dict[tuple[int, int], int]:
    global _table
    if _table is None:
        rows = (
            line.split(",")
            for line in _CSV.read_text().splitlines()
            if line.strip()
        )
        _table = {(int(ln), int(code)): int(ch) for ch, ln, code in rows}
    return _table


def decode(data: bytes, count: int) -> str:
    """Decode `count` characters from Huffman-compressed `data`.

    Bits are consumed MSB-first. `count` comes from the packet (li.a caps it at
    80); decoding stops there even if bits remain, which is expected since the
    final byte is usually padded.
    """
    table = _load()
    out: list[str] = []
    cur = 0
    length = 0
    for byte in data:
        for bit in range(7, -1, -1):
            cur = (cur << 1) | ((byte >> bit) & 1)
            length += 1
            if (length, cur) in table:
                out.append(chr(table[(length, cur)]))
                cur = 0
                length = 0
                if len(out) == count:
                    return "".join(out)
    return "".join(out)
