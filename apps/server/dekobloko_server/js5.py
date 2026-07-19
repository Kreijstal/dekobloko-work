from __future__ import annotations

from pathlib import Path

import socket
import struct
import zlib
from dataclasses import dataclass

from .cache import CacheStore
from .io import read_exact, read_u8


# --- substitutes for cache groups that no longer exist anywhere -------------
#
# Archive 6 group 1 is "benefits" (files: borders, logo, price, screenshots) --
# the FunOrb subscription upsell panel. The original service is dead and the
# data is in no surviving cache, so the client blocks forever on "Loading extra
# data" waiting for it. An empty container does NOT satisfy it: the client
# treats a zero-length group as a failed fetch and re-requests indefinitely.
#
# So serve a structurally valid replacement instead. See
# docs/js5-sprite-format.md; the generator is synthetic/make_happy.py, a
# sibling of the dekobloko_server package (apps/server/synthetic/).
_SUBSTITUTE_DIR = Path(__file__).resolve().parents[1] / "synthetic"
_SUBSTITUTES = {(6, 1): "archive6_group1.bin"}
_substitute_cache: dict[tuple[int, int], bytes | None] = {}


def _load_substitute(archive_id: int, group_id: int) -> bytes | None:
    key = (archive_id, group_id)
    if key in _substitute_cache:
        return _substitute_cache[key]
    name = _SUBSTITUTES.get(key)
    data = None
    if name is not None:
        path = _SUBSTITUTE_DIR / name
        try:
            data = path.read_bytes()
        except OSError as exc:
            print(f"[js5] substitute {archive_id}/{group_id} unreadable at {path}: {exc}")
    _substitute_cache[key] = data
    return data


# --- CRC reconciliation for substituted groups -----------------------------
#
# The client validates every group it downloads against the CRC recorded for it
# in that archive's group table, and rejects a mismatch with "CRC mismatch -
# unable to get a valid download" plus an endless Retry loop. A synthesised
# group can never match the CRC of the data it replaces, and the CRC cannot be
# worked backwards into the original bytes -- 32 bits against ~10^5 bytes.
#
# We serve the group table too, so the fix runs the other way: rewrite the
# recorded CRC to match what we actually send. That is a two-level chain,
# because the master index (255/255) records a CRC over each group table:
#
#     substitute bytes      -> CRC lands in archive N's group table (255/N)
#     patched 255/N         -> CRC lands in the master index (255/255)
#
# Both levels must go through _patched_read(), or the client accepts the group
# and then rejects the table that vouches for it.
#
# Verified against this cache: the CRC covers the whole container, header
# included, and there is no version trailer on the 255/N entries.

def _decompress(raw: bytes) -> bytes:
    compression = raw[0]
    length = int.from_bytes(raw[1:5], "big")
    if compression == 0:
        return raw[5:5 + length]
    body = raw[9:9 + length]
    if compression == 1:
        import bz2
        return bz2.decompress(b"BZh1" + body)
    import gzip
    import io as _io
    return gzip.GzipFile(fileobj=_io.BytesIO(body)).read()


def _as_container(payload: bytes) -> bytes:
    """Wrap payload as an uncompressed js5 container.

    Re-emitting uncompressed rather than recompressing keeps the bytes
    deterministic, which matters because the CRC we then advertise must match
    exactly what goes on the wire.
    """
    return bytes([0]) + len(payload).to_bytes(4, "big") + payload


def _group_table_crc_offset(table: bytes, group_id: int) -> int | None:
    """Byte offset of group_id's CRC field inside a decompressed group table."""
    p = 0
    protocol = table[p]; p += 1
    if protocol >= 6:
        p += 4                                   # version
    flags = table[p]; p += 1
    count = int.from_bytes(table[p:p + 2], "big"); p += 2
    ids = []
    acc = 0
    for _ in range(count):
        acc += int.from_bytes(table[p:p + 2], "big"); p += 2
        ids.append(acc)
    if flags & 1:
        p += 4 * count                           # name hashes
    if group_id not in ids:
        return None
    return p + 4 * ids.index(group_id)


@dataclass(frozen=True)
class Js5Request:
    priority: bool
    archive_id: int
    group_id: int


class Js5Session:
    def __init__(self, sock: socket.socket, cache: CacheStore, peer: str) -> None:
        self.sock = sock
        self.cache = cache
        self.peer = peer
        self.xor_key = 0

    def run_after_handshake(self, revision: int) -> None:
        print(f"[js5] {self.peer} accepted revision={revision}")
        self.sock.sendall(b"\x00")
        while True:
            packet = read_exact(self.sock, 6)
            opcode = packet[0]

            if opcode in (0, 1):
                request = Js5Request(
                    priority=opcode == 1,
                    archive_id=packet[1],
                    group_id=int.from_bytes(packet[2:6], "big"),
                )
                self._handle_file_request(request)
                continue

            if opcode == 2:
                print(f"[js5] {self.peer} priority control {packet.hex(' ')}")
                continue

            if opcode == 3:
                print(f"[js5] {self.peer} normal control {packet.hex(' ')}")
                continue

            if opcode == 4:
                self.xor_key = packet[1]
                print(f"[js5] {self.peer} xor-key={self.xor_key}")
                continue

            if opcode == 6:
                print(f"[js5] {self.peer} setup {packet.hex(' ')}")
                continue

            if opcode == 7:
                print(f"[js5] {self.peer} disconnect control")
                return

            print(f"[js5] {self.peer} unknown opcode={opcode} packet={packet.hex(' ')}")

    def _patched_read(self, archive_id: int, group_id: int) -> bytes | None:
        """cache.read() with substituted groups and reconciled CRCs applied.

        Every read path must use this. Reading the cache directly anywhere
        re-introduces the mismatch this exists to remove.
        """
        raw = self.cache.read(archive_id, group_id)

        # Level 0: the substituted group itself.
        if raw is None:
            substitute = _load_substitute(archive_id, group_id)
            if substitute is not None:
                print(
                    f"[js5] {self.peer} SUBSTITUTE archive={archive_id} "
                    f"group={group_id} bytes={len(substitute)} "
                    f"crc=0x{zlib.crc32(substitute) & 0xFFFFFFFF:08x}"
                )
                return substitute
            return None

        # Levels 1 and 2 are DISABLED. Rewriting the recorded CRC does not work:
        # the master index (255/255) is *signed*, and it covers the group-table
        # CRCs. Patching a group table forces a matching edit to the master
        # index, which invalidates the signature -- the client verifies it,
        # throws RuntimeException and dies with error_game_crash before it ever
        # reaches the login screen.
        #
        # The workable direction is the reverse: forge the substitute so its CRC
        # equals the value already recorded (0xaacfba29 for archive 6 group 1).
        # CRC32 is affine over GF(2), so 32 probe CRCs are enough to solve for
        # four bytes that land on any target. Put them somewhere inert -- the
        # palette, not pixel indices, which could go out of bounds and crash the
        # sprite reader. Then nothing signed has to change.
        return raw

        if archive_id != 255:
            return raw

        # Level 1: a group table vouching for a substituted group.
        if group_id != 255:
            patched = raw
            for (arch, grp), _name in _SUBSTITUTES.items():
                if arch != group_id:
                    continue
                substitute = _load_substitute(arch, grp)
                if substitute is None:
                    continue
                table = bytearray(_decompress(patched))
                off = _group_table_crc_offset(bytes(table), grp)
                if off is None:
                    print(f"[js5] {self.peer} group {grp} absent from table {arch}; CRC not patched")
                    continue
                want = zlib.crc32(substitute) & 0xFFFFFFFF
                had = int.from_bytes(table[off:off + 4], "big")
                table[off:off + 4] = want.to_bytes(4, "big")
                patched = _as_container(bytes(table))
                print(
                    f"[js5] {self.peer} patched table {arch} group {grp} "
                    f"crc 0x{had:08x} -> 0x{want:08x}"
                )
            return patched

        # Level 2: the master index vouching for those group tables.
        touched = {arch for arch, _ in _SUBSTITUTES}
        if not touched:
            return raw
        body = bytearray(_decompress(raw))
        count = body[0]
        for arch in sorted(touched):
            if arch >= count:
                continue
            table = self._patched_read(255, arch)
            if table is None:
                continue
            off = 1 + arch * 72                  # crc(4) + version(4) + whirlpool(64)
            want = zlib.crc32(table) & 0xFFFFFFFF
            had = int.from_bytes(body[off:off + 4], "big")
            if had == want:
                continue
            body[off:off + 4] = want.to_bytes(4, "big")
            print(
                f"[js5] {self.peer} patched master index archive {arch} "
                f"crc 0x{had:08x} -> 0x{want:08x}"
            )
        return _as_container(bytes(body))

    def _build_master_index(self) -> bytes:
        """Generate the js5 master index (archive 255, group 255) from the per-archive
        indexes (255, N). The master index is never stored on disk; a real js5 server
        computes it live. Format: container([count:u8] then per archive
        [crc:u32][version:u32][whirlpool:64b])."""
        idx_path = self.cache.cache_dir / "main_file_cache.idx255"
        count = idx_path.stat().st_size // 6 if idx_path.is_file() else 0
        body = bytearray([count & 0xFF])
        for n in range(count):
            raw = self._patched_read(255, n)
            if raw is None:
                crc = 0
            else:
                crc = zlib.crc32(raw) & 0xFFFFFFFF
            body.extend(struct.pack(">II", crc, 0))  # crc, version=0
            body.extend(b"\x00" * 64)                # whirlpool (zero-filled)
        return bytes([0]) + struct.pack(">I", len(body)) + bytes(body)  # compression 0

    def _handle_file_request(self, request: Js5Request) -> None:
        if request.archive_id == 255 and request.group_id == 255:
            raw = self._patched_read(255, 255)
            if raw is None:
                raw = self._build_master_index()
                print(f"[js5] {self.peer} generated unsigned fallback master index ({len(raw)}b)")
            else:
                print(f"[js5] {self.peer} loaded signed master index ({len(raw)}b)")
        else:
            raw = self._patched_read(request.archive_id, request.group_id)
        if raw is None:
            print(
                f"[js5] {self.peer} MISS archive={request.archive_id} "
                f"group={request.group_id} priority={request.priority}"
            )
            # Answer the miss instead of staying silent.
            #
            # A bare return leaves the client waiting for a response that never
            # arrives; it holds the JS5 connection open, eventually drops it, and
            # reopens ~30s later, forever. Observed at game-over: the client asks
            # for archive=6 group=1 and archive=2 group=3, neither of which is in
            # any local cache, so it never returns to the main menu and looks
            # hung. Client instrumentation showed byte-identical request bursts
            # exactly 30s apart with no server reply in between.
            #
            # Replying with a well-formed empty container (compression 0, length
            # 0) at least lets the client's reader complete and decide for itself
            # what to do with an empty group, rather than blocking on silence.
            # This does NOT conjure up the missing data — if the client genuinely
            # needs those bytes it will fail some other way, but it should fail
            # visibly instead of hanging.
            flags = 0
            if not request.priority:
                flags |= 0x80
            empty = bytearray()
            empty.append(request.archive_id & 0xFF)
            empty.extend(request.group_id.to_bytes(4, "big"))
            empty.append(flags)
            empty.extend((0).to_bytes(4, "big"))
            self._send_framed(bytes(empty))
            print(
                f"[js5] {self.peer} sent EMPTY container for miss "
                f"archive={request.archive_id} group={request.group_id}"
            )
            return

        if request.archive_id != 255:
            compression = raw[0]
            compressed_length = int.from_bytes(raw[1:5], "big")
            container_length = (5 if compression == 0 else 9) + compressed_length
            if len(raw) < container_length:
                print(
                    f"[js5] {self.peer} truncated cache entry archive={request.archive_id} "
                    f"group={request.group_id} bytes={len(raw)} expected={container_length}"
                )
                return
            if len(raw) > container_length:
                trailer = raw[container_length:]
                print(
                    f"[js5] {self.peer} stripped disk trailer={trailer.hex()} "
                    f"archive={request.archive_id} group={request.group_id}"
                )
                raw = raw[:container_length]

        if len(raw) < 5:
            print(f"[js5] {self.peer} invalid short cache entry: {request}")
            return

        compression = raw[0]
        compressed_length = int.from_bytes(raw[1:5], "big")
        flags = compression & 0x7F
        if not request.priority:
            flags |= 0x80

        packet = bytearray()
        packet.append(request.archive_id & 0xFF)
        packet.extend(request.group_id.to_bytes(4, "big"))
        packet.append(flags)
        packet.extend(compressed_length.to_bytes(4, "big"))
        packet.extend(raw[5:])

        self._send_framed(bytes(packet))
        print(
            f"[js5] {self.peer} sent archive={request.archive_id} "
            f"group={request.group_id} bytes={len(raw)} priority={request.priority}"
        )

    def _xor(self, data: bytes) -> bytes:
        """Apply the client-selected JS5 XOR key to outgoing bytes.

        The client may send opcode 4 with a key byte, after which it expects
        every subsequent byte of the JS5 stream — headers, framing 0xFF markers
        and payload alike — to be XORed with that key. Storing the key but
        sending plaintext makes the client decode garbage and drop the
        connection with "IO error - unable to communicate reliably with the data
        server". Key 0 is the identity, i.e. XOR disabled.
        """
        if not self.xor_key:
            return data
        k = self.xor_key & 0xFF
        return bytes(b ^ k for b in data)

    def _send_framed(self, packet: bytes) -> None:
        if len(packet) <= 512:
            self.sock.sendall(self._xor(packet))
            return

        offset = 512
        self.sock.sendall(self._xor(packet[:offset]))
        while offset < len(packet):
            self.sock.sendall(self._xor(b"\xff"))
            end = min(offset + 511, len(packet))
            self.sock.sendall(self._xor(packet[offset:end]))
            offset = end
