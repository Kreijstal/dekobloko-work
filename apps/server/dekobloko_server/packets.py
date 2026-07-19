from __future__ import annotations

import socket
from dataclasses import dataclass

from .crypto import IsaacCipher, u32
from .io import read_exact, read_u8, read_u16

# Client-to-server packet sizes. -1 means a one-byte length follows the opcode;
# -2 means a two-byte length.
#
# Provenance is mixed. Entries carrying a comment below were traced or
# measured. The bare ones were not: they were inferred from traffic that
# happened to parse, which only proves they did not desynchronise the stream in
# the situations exercised so far -- not that they are right. An entry that is
# wrong in the same direction as the data it happened to see will look correct
# indefinitely. Prefer to re-derive from the client before relying on one.
#
# No client-side array like mk.field_c has been located for THIS direction. If
# one exists, reading it out of a live client would settle these the way
# mk.field_c settled SERVER_PACKET_LENGTHS below -- worth looking for before
# trusting any bare number here.
CLIENT_PACKET_LENGTHS: dict[int, int] = {
    0: 0,
    1: 0,
    # Measured from client instrumentation at uf.f(): opcode 4 is written at
    # buffer position 0 and opcode 5 at position 3, flushing as a single 7-byte
    # write (fd 01 02 | 05 02 00 00). Omitting either entry makes the reader
    # fall back to assumed-variable length, which mis-consumes the payload and
    # permanently desynchronises the ISAAC opcode keystream.
    #
    # These were long described as a "lobby heartbeat pair". The sizes are
    # right, that description is not: opcode 5 is a request written by
    # oi.java:272 and it expects a reply. See the opcode 5 handler in game.py.
    # Whether opcode 4 is also a request has not been checked.
    4: 2,
    5: 3,
    9: 0,
    10: 0,
    # Written by ce.a (ce.java:435), which reserves a byte after the opcode and
    # backfills it: [opcode][u8 length][payload]. So -1 is correct, and it is
    # listed explicitly rather than left to the assumed-variable fallback --
    # the fallback happened to guess right here, which is not a guarantee.
    # Observed payload on a lobby chat send: 00 04 e7 bc (4 bytes).
    12: -1,  # lobby message / chat send -- payload layout NOT yet decoded
    14: -1,  # chat: u64 target + cstring text + u8 channel + u8 quickchat
    17: 0,
    18: -1,
    58: 0,   # lobby selected-game/start button in the Dekobloko UI path
    59: 1,   # current local piece/update counter acknowledgement
    60: -1,  # gameplay controls: u8 count + bitpacked 5-bit controls
    61: 0,
    62: 0,   # resign/leave active game from the game UI path
    63: 0,   # request/advance style packet in the game UI path
}

# Server-to-client packet sizes.
#
#   length >= 0  fixed-size payload, NO length byte on the wire
#   -1           one-byte length follows the opcode
#   -2           two-byte length follows the opcode
#
# GROUND TRUTH, not inference. These are the non-zero entries of mk.field_c,
# the client's own 256-entry table, read out of a live client by reflection.
# The client uses it at vi.java:304:
#
#   dl.field_N = de.field_V.i(...)      read opcode
#   sm.field_e = param0[dl.field_N]     look up length  <-- param0 is mk.field_c
#   fh.a(...)                           reads 1 or 2 length bytes only if -1/-2
#
# and the array reaches vi.a from client.java:558, `vi.a(mk.field_c, 0)`.
# Anything not listed is 0, i.e. a fixed empty payload.
#
# Read fh.a carefully before "correcting" this. fh.a reads a length byte only
# when sm.field_e == -1, and sm.field_e is assigned from this table BEFORE fh.a
# is called. Looking at fh.a alone makes it appear that every packet carries a
# length byte and that fixed sizes cannot exist -- that reading is wrong, and it
# cost a working table once already. The producer is vi.java:304; the consumer
# is fh.java:94. Check both.
SERVER_PACKET_LENGTHS: dict[int, int] = {
    1: 16,
    2: -2,
    3: -1,
    4: -1,
    5: -1,
    6: -2,
    7: -1,
    8: -2,
    9: -1,    # server/lobby/game message string
    10: -1,
    11: -1,
    12: -1,   # reply to client opcode 5; see build_sb_reply()
    13: -1,
    16: -1,
    17: -1,
    18: 1,
    58: -2,   # start own multiplayer game
    59: -2,   # start spectator multiplayer game
    61: -2,   # full board/state update for one player
    62: 2,    # remove/defeat one player and result/status byte
    63: -1,   # compressed controls/event stream for one player
    64: -2,   # immediate piece/event for one player
    65: 1,
    66: 2,
    67: -1,   # queued piece for one player
    68: 1,
    69: 1,
    70: 1,
    71: 1,
    72: 1,
    73: 1,
    74: 1,
    75: -1,
    76: 1,
}

# te.field_v (boolean[64]) separately gates bd.f: an opcode whose slot is false
# is not dispatched at all, whatever its length. Observed live as true for
# 0 2 3 4 6 7 8 11 12 13 16 17 18, but that set is built up incrementally by
# scattered assignments in bd.java as a session progresses, so it is a snapshot
# and will differ at other moments. Length and dispatch are independent: a
# correct length does not mean the client will act on the packet.
SERVER_OPCODES_SEEN_ENABLED = frozenset({0, 2, 3, 4, 6, 7, 8, 11, 12, 13, 16, 17, 18})


@dataclass(frozen=True)
class GamePacket:
    opcode: int
    payload: bytes
    assumed_variable: bool = False


class PacketCodec:
    def __init__(self, client_seed: tuple[int, int, int, int]) -> None:
        inbound_seed = [u32(value) for value in client_seed]
        outbound_seed = [u32(value + 50) for value in client_seed]
        self.inbound = IsaacCipher(inbound_seed)
        self.outbound = IsaacCipher(outbound_seed)

    def read_client_packet(self, sock: socket.socket) -> GamePacket:
        raw_opcode = read_u8(sock)
        opcode = (raw_opcode - self.inbound.next()) & 0xFF
        length = CLIENT_PACKET_LENGTHS.get(opcode)
        assumed_variable = False

        if length is None:
            length = read_u8(sock)
            assumed_variable = True
        elif length == -1:
            length = read_u8(sock)
        elif length == -2:
            length = read_u16(sock)

        payload = read_exact(sock, length) if length else b""
        return GamePacket(opcode, payload, assumed_variable)

    def encode_server_packet(self, opcode: int, payload: bytes = b"") -> bytes:
        """Encode one server packet, framed per SERVER_PACKET_LENGTHS.

        A fixed-size opcode carries NO length byte -- adding one makes the
        client read the first payload byte as the length and desynchronise the
        stream silently. Nothing on either side validates this, so the damage
        surfaces much later as unrelated-looking corruption.

        An opcode missing from the table falls back to the payload's own length,
        i.e. fixed-size. That is a guess for anything the table does not cover;
        prefer adding a real entry over relying on it.
        """
        raw_opcode = (opcode + self.outbound.next()) & 0xFF
        length_kind = SERVER_PACKET_LENGTHS.get(opcode, len(payload))
        out = bytearray([raw_opcode])
        if length_kind == -1:
            if len(payload) > 255:
                raise ValueError(
                    f"packet {opcode}: {len(payload)} bytes does not fit a one-byte length"
                )
            out.append(len(payload))
        elif length_kind == -2:
            if len(payload) > 65535:
                raise ValueError(
                    f"packet {opcode}: {len(payload)} bytes does not fit a two-byte length"
                )
            out.extend(len(payload).to_bytes(2, "big"))
        else:
            if length_kind != len(payload):
                raise ValueError(
                    f"packet {opcode} is fixed at {length_kind} bytes, got {len(payload)}"
                )
        out.extend(payload)
        return bytes(out)

    def make_server_message(self, text: str) -> bytes:
        payload = text.encode("cp1252", errors="replace") + b"\x00"
        return self.encode_server_packet(9, payload)


class PacketBuilder:
    def __init__(self) -> None:
        self.data = bytearray()

    def u8(self, value: int) -> "PacketBuilder":
        self.data.append(value & 0xFF)
        return self

    def i8(self, value: int) -> "PacketBuilder":
        self.data.append(value & 0xFF)
        return self

    def u16(self, value: int) -> "PacketBuilder":
        self.data.extend((value & 0xFFFF).to_bytes(2, "big"))
        return self

    def u24(self, value: int) -> "PacketBuilder":
        self.data.extend((value & 0xFFFFFF).to_bytes(3, "big"))
        return self

    def u32(self, value: int) -> "PacketBuilder":
        self.data.extend((value & 0xFFFFFFFF).to_bytes(4, "big"))
        return self

    def u64(self, value: int) -> "PacketBuilder":
        self.data.extend((value & 0xFFFFFFFFFFFFFFFF).to_bytes(8, "big"))
        return self

    def cstring(self, value: str) -> "PacketBuilder":
        if "\x00" in value:
            raise ValueError("NUL is not allowed inside client strings")
        self.data.extend(value.encode("cp1252", errors="replace"))
        self.data.append(0)
        return self

    def jagex_string(self, value: str) -> "PacketBuilder":
        # The client's wl.b(true) reader expects a leading zero byte, then a NUL string.
        self.data.append(0)
        return self.cstring(value)

    def varint7(self, value: int) -> "PacketBuilder":
        if value < 0:
            raise ValueError("varint7 cannot encode negative values")
        groups = [value & 0x7F]
        value >>= 7
        while value:
            groups.append(value & 0x7F)
            value >>= 7
        for group in reversed(groups[1:]):
            self.data.append(group | 0x80)
        self.data.append(groups[0])
        return self

    def raw(self, value: bytes | bytearray) -> "PacketBuilder":
        self.data.extend(value)
        return self

    def finish(self) -> bytes:
        return bytes(self.data)


def pack_5bit(values: list[int] | tuple[int, ...]) -> bytes:
    out = bytearray()
    current = 0
    bits_left = 8

    for value in values:
        remaining = 5
        value &= 0x1F
        while remaining > bits_left:
            current += value >> (remaining - bits_left)
            out.append(current & 0xFF)
            value &= (1 << (remaining - bits_left)) - 1
            remaining -= bits_left
            current = 0
            bits_left = 8
        if remaining == bits_left:
            current += value
            out.append(current & 0xFF)
            current = 0
            bits_left = 8
        else:
            bits_left -= remaining
            current += value << bits_left

    if bits_left != 8:
        out.append(current & 0xFF)

    return bytes(out)


def build_sb_reply(value: int) -> bytes:
    """Payload for server opcode 12. THE CLIENT DISCARDS THIS PACKET.

    Do not spend time tuning these bytes. Instrumentation showed opcode 12 is
    received, framed correctly, and dispatched -- and then dropped at
    bd.java:974, `if (var2 == 12) { break L3; }`, a branch that does nothing.
    cm.a((byte) 53), which would parse this payload, is never reached. See the
    opcode 5 handler in game.py for the full measurement.

    The layout below was read off cm.a and is therefore UNTESTED, since nothing
    has ever parsed it:

        byte 0        discriminator; 0 believed to select the `sb` path
        byte 1        read into var3; appears unused on the sb path
        remaining     little-endian into sb.field_q, capped at
                      field_q.length << 2 (field_q is int[1], so 4 bytes)

    The intent was to set sb.field_s, which dc.java:370 needs to flip
    qj.field_k. That path is real; reaching it via opcode 12 is not. Find what
    actually reaches cm.a(53) before reworking this.
    """
    return bytes([0, 0]) + int(value).to_bytes(4, "little")


def build_f_reply() -> bytes:
    """Payload for server opcode 3, answering client opcode 4.

    dk.a (the opcode 3 handler, per the bytecode dispatch table) reads one
    discriminator byte first:

        0  -> reads an int[] via b.h, then a u8 count, then a loop
        1  -> pops cg.field_c instead (different queue)
        2  -> pops rc.field_e, sets field_t = b.h(...), field_u = true
        _  -> error "A1:" then si.a(90)

    Discriminator 2 is the short path and the one we want. b.h(int) (b.java:42)
    is `return new int[8]` -- it reads NOTHING from the wire -- so no further
    payload is needed. dc.java:335 then walks those 8 entries and sets
    nm.field_Qb.

    That is why this is a single byte. If a future change makes dk.a read more,
    this will silently under-run; check b.h first.
    """
    return bytes([2])


def build_chat_broadcast(name: str, count: int, body: bytes) -> bytes:
    """Payload for server opcode 11 -- a lobby chat line from a player.

    The server does not compress anything. `body` is the client's own Huffman
    blob relayed verbatim; the receiving client decompresses it with the same
    table (archive 3). `count` is the character count that travelled with it.

    Envelope, from ki.java:16 (ki.a, reached via bd.f opcode 11 ->
    cl.a(ki.a(0, false), true)):

        u8    flags        mf.field_R = v & 127 (channel); bit 0x80 -> fm.field_f
        u8    tg.field_c   -> hl.field_l   MUST BE 1 (see below)
        u64   fc.field_h                (wl.f = two wl.i reads, 4 bytes each)
        u16 + u24          } channel 2 only (vl.field_k, ic.field_a)
        u8    var4         0 => ONE name string follows and is reused
        str   ad.field_x   plain NUL-terminated, NO leading zero byte
        u16 + str          } channel 1 or 4 only -> qm.field_e
        u8    count        character count (li.a caps at 80)
        ...   body         Huffman bytes

    The formatter is mb.java:118-215, and it decides everything:

        var2 = null
        if (field_p != null && field_l == 1) var2 = "<img=0>" + field_p
        if (field_l == 2)                    var2 = "<img=1>" + var2
        ...
        if (field_m == 0 && ii.field_q) var3 = "[" + uc.field_b + "] "  // "[Lobby] "
        if (field_m == 1)               var3 = "[<owner>'s game] "
        if (field_m == 4 && f.field_q)  var3 = "[" + f.field_q + "] "
        if (field_m == 3)               var3 = "[#" + field_g + "] "
        if (!field_j)                   var3 = var3 + var2 + ": "       // the NAME

    Three consequences, each of which cost an attempt:

      * tg.field_c MUST be 1 (or 2). var2 -- the rendered name -- is populated
        ONLY on that branch; with tg.field_c = 0 it stays null and the line
        reads "null: text" on EVERY channel. This, not the channel, was the
        real cause of the null name. The "<img=0>" is the rank icon that
        appears before the name.
      * Channel 0 is the lobby line. It is the only value that produces the
        "[Lobby] " prefix.
      * The 0x80 bit must be CLEAR. The name is appended only under
        `if (!field_j)`, and 0x80 sets field_j -- which is why 0x82/0x84
        rendered as system lines with no speaker.

    The prefix also depends on client UI state (`ii.field_q`, `f.field_q`,
    `pk.field_r`, `cd.field_m` at nm.java:255), i.e. which screen the player is
    on -- it is not purely a function of the packet.

    Observed channel behaviour, all by sending and watching:

      | flags | result                                                      |
      | 0x00  | "[Lobby] <name>: text"  (with tg.field_c = 1)               |
      | 0x01  | in-game channel, "[<owner>'s game] "                        |
      | 0x02  | renderer NullPointerException                               |
      | 0x82  | server message / status channel, no speaker                 |
      | 0x84  | named line, wrong channel and colour                        |

    Two further traps:

      * The name is a PLAIN cstring. PacketBuilder.jagex_string documents a
        leading zero byte, but that is the wl.b(true) reader; ki.a uses
        c((byte) -38).
      * `count` and `body` are separate fields; the inbound payload is
        [discriminator][count][huffman].

    Validate offline with HlDump, which dumps every hl field the formatter
    reads. Note it exercises ki.a only -- rendering happens later and can throw.
    """
    # `name` may already contain markup (e.g. a "<img=1>" gold-crown tag). The
    # formatter wraps it as "<img=0>" + name, so an injected tag yields
    # "<img=0><img=1>name" -- silver crown then gold then the name. That double
    # crown is the only way to show the gold icon WITH a name, since the
    # field_l==2 branch that would give a lone gold crown nulls the name.
    encoded = name.encode("cp1252", errors="replace")
    out = bytearray()
    out.append(0x00)                     # channel 0 -> "[Lobby] "; 0x80 clear -> name appended
    # tg.field_c -> hl.field_l, the rank-icon selector in mb.a:
    #   1 -> "<img=0>" + name   (moderator crown)
    #   2 -> "<img=1>" + name   (jagex moderator crown)
    # Any other value leaves the rendered name null in the decompiled listing,
    # which is why the line read "null: text" for so long. Whether 0 genuinely
    # has no name branch or CFR mangled one is unresolved -- the `field_l == 2`
    # branch as decompiled reads `var2 = "<img=1>" + var2` with var2 still null,
    # which cannot be literal, so this function's control flow is not trustworthy
    # as printed. Confirm any change against a live client.
    out.append(1)                        # tg.field_c -> field_l = 1: the ONLY branch
                                         # that builds the name string (var2).
                                         # field_l = 2 (the <img=1> gold-crown
                                         # branch) prepends the icon to a null
                                         # var2 and renders "<img=1>null" -- a
                                         # real client bug, confirmed in mb.class
                                         # bytecode, not a decompiler artifact.
    out.extend(b"\x00" * 8)              # fc.field_h
    out.append(0)                        # var4: single name
    out.extend(encoded)                  # ad.field_x -> field_p -> the NAME
    out.append(0)
    out.append(count & 0xFF)             # li.a character count
    out.extend(body)
    return bytes(out)
