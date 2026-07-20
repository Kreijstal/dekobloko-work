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
    # WAS `4: 2`, which is wrong and was actively dangerous. Opcode 4 also
    # carries the achievement record, and MEASURED by running the client's own
    # writer (kk.a at kk.java:39, invoked by reflection with a synthetic `ki`)
    # that packet is:
    #
    #   [opcode 4][u8 length = 23][
    #     u8 count=1 | u8 field_v ACHIEVEMENT INDEX | u8 field_p |
    #     i32 field_s | i32 field_r | i32 field_o | i32 field_q | i32 checksum ]
    #
    # Observed emission: 17 01 02 11 22222222 33333333 44444444 55555555 ff3adbba
    #
    # Reading that as fixed-2 consumes 2 of 25 bytes and leaves 23 in the
    # stream -- a permanent ISAAC keystream desync, i.e. garbage opcodes and a
    # crash shortly after earning an achievement.
    #
    # -1 also stays correct for the short form the old note recorded
    # (`fd 01 02`): as [len=1][payload 02] it consumes the same 2 bytes. So -1
    # is right for both observations and fixed-2 is right for only one.
    4: -1,
    # Opcode 5 is NOT in this table on purpose: it has two producers with
    # different framing and no single length describes it. See _read_opcode_5,
    # which is dispatched before this table is consulted. It was `5: 3`, which
    # framed the request form correctly and desynced on every progress record.
    9: 0,
    10: 0,
    # Written by ce.a (ce.java:435), which reserves a byte after the opcode and
    # backfills it: [opcode][u8 length][payload]. So -1 is correct, and it is
    # listed explicitly rather than left to the assumed-variable fallback --
    # the fallback happened to guess right here, which is not a guarantee.
    # Observed payload on a lobby chat send: 00 04 e7 bc (4 bytes).
    # LOBBY actions (create/join/leave room, play rated, etc). Named from the
    # shattered-plans deobfuscation of the same framework: C2S 0x0b = LOBBY,
    # VARIABLE_BYTE. Previously absent from this table, so it fell to the
    # assumed-variable fallback -- which guessed right, but was never recorded
    # as a fact and had no handler, so every room action was silently dropped.
    #
    # OBSERVED from a real client: `04 08 80 00 00 02 01 01` (create) and `00`
    # (play rated).
    11: -1,
    12: -1,  # lobby message / chat send -- payload layout NOT yet decoded
    14: -1,  # chat: u64 target + cstring text + u8 channel + u8 quickchat
    # Create/join a game room. PROVEN by running the client's own writer:
    # fh.a((byte) 8, cl, 7) assembles [opcode][u8 q][u8 z] with NO length byte,
    # observed as 45 00 0a for q=0, z=10.
    #
    # This entry is load-bearing. Without it opcode 7 hits the `length is None`
    # fallback, which reads the q byte (0x00) as a LENGTH, consumes no payload,
    # and leaves z (0x0a) to be deciphered as the next opcode -- a permanent
    # ISAAC keystream desync that surfaces later as garbage opcodes.
    7: 2,
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
# Client LOBBY action codes (client opcode 11, first payload byte).
#
# Names taken from a deobfuscated client for the same FunOrb framework
# (lexi-lambda/shattered-plans, C2SPacket.LobbyAction). The action codes are
# framework-level and two of them are already corroborated here: this server's
# roster "mode 5" and "mode 23" line up with that project's server-side
# PLAYER_ENTERED_LOBBY (5) and PLAYER_ID (23).
#
# Used for logging only. Naming an opcode is not the same as knowing Dekobloko's
# payload for it, so nothing here should be treated as a verified wire layout.
LOBBY_ACTION_NAMES: dict[int, str] = {
    0: "PLAY_RATED_GAME",
    1: "RETURN_TO_LOBBY",
    2: "SET_RATED_OPTIONS",
    3: "ACK_RATED_ROOM_INFO",
    4: "CREATE_UNRATED_GAME",
    5: "SET_ROOM_OPTIONS",
    6: "INVITE_PLAYER_TO_GAME",
    7: "KICK_PLAYER_FROM_GAME",
    8: "JOIN_ROOM",
    9: "LEAVE_ROOM",
    10: "SPECTATE_GAME",
    11: "SHOW_PLAYERS_IN_GAME",
}


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
    # 14 and 15 are MEASURED, not assumed. mk.c is `new int[256]` (mk.<clinit>)
    # and neither index is ever written by any iastore in the gamepack, so both
    # keep the array default 0 = fixed size, NO length byte.
    #
    # Recorded explicitly because "absent from this table" previously got
    # misread as "we never measured it", which led to opcode 15 being removed on
    # a wrong desync theory -- that broke return-to-menu, since the client
    # storms opcode 10 forever without the ack. An explicit 0 states the fact.
    14: 0,    # lobby bootstrap (empty payload is CORRECT, not just untested)
    15: 0,    # return-to-menu ack, answers client opcode 10
    16: -1,
    17: -1,
    18: 1,
    # Achievement mask push. MEASURED from the client's own table, not assumed:
    # client.java:3010 is `mk.field_c[75] = -1`, i.e. a u8 length byte.
    75: -1,
    58: -2,   # start own multiplayer game
    59: -2,   # start spectator multiplayer game
    # Game teardown / game over. Fixed EMPTY payload -- no length byte.
    #
    # Listed explicitly even though the missing-entry fallback (len(payload) ==
    # 0) frames it identically today. The fallback is a guess that happens to
    # agree; this is the measured value, so a future non-empty payload fails
    # loudly here instead of silently desynchronising the client.
    #
    # Note 58/59/60 all exist in BOTH directions with DIFFERENT framing. The
    # client sends 60 as -1 (a move batch) while the server sends 60 as fixed
    # empty. The two tables are separate, so this is not a conflict -- but do
    # not "reconcile" them.
    60: 0,
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

        if opcode == 3:
            return self._read_opcode_3(sock)

        if opcode == 5:
            return self._read_opcode_5(sock)

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

    def _read_opcode_3(self, sock: socket.socket) -> GamePacket:
        """Frame client opcode 3, which has TWO producers with DIFFERENT framing.

        This is the one opcode a static length table cannot describe. Both
        writers were confirmed by running the client's own code:

          wb.a  hiscore request      NO length byte, fixed 6-byte body,
                                     always starting 0x05 0x00.
                                     Proven: 03 05 00 00 00 0A 01
          fm.a  achievement record   ONE u8 length byte, then sub-command 0x01.
                                     Proven: 03 24 01 ...  (0x24 = 36 body bytes)

        So the byte after the opcode is a sub-command in one case and a LENGTH
        in the other. We disambiguate by peeking it:

          == 0x05  -> hiscore: that byte is payload[0], read 5 more (6 total)
          otherwise -> achievement: that byte is the length

        Why the peek is safe rather than merely convenient: for it to misfire,
        an achievement record would have to declare a length of exactly 5. The
        achievement body is sub-command + three u16 + an i32 + flags + a counted
        array + a 4-byte checksum tail -- it cannot fit in 5 bytes. The observed
        length is 36. The two spaces do not overlap.

        This disambiguation is the one piece of opcode-3 handling NOT proven by
        running the client -- both framings are proven individually, but nothing
        yet confirms both writers fire in a single session. If opcode 3 ever
        starts desynchronising the stream, suspect this first: capture the
        decrypted bytes of a hiscore-screen open and a stat-generation event and
        check the peek actually separates them.
        """
        first = read_u8(sock)
        if first == 0x05:
            payload = bytes([first]) + read_exact(sock, 5)
            return GamePacket(3, payload, False)
        payload = read_exact(sock, first) if first else b""
        return GamePacket(3, payload, False)

    def _read_opcode_5(self, sock: socket.socket) -> GamePacket:
        """Frame client opcode 5, which -- like opcode 3 -- has TWO producers.

        Both were MEASURED by running the client's own writers by reflection:

          oi.a   saved-value request   NO length byte, fixed 3-byte body.
                 (oi.java:272)         Writes a literal 2, a literal 0, then
                                       sb.field_r (0). Proven: 05 02 00 00
          mc.a   progress record       ONE u8 length byte, then the body.
                 (mc.java:12)          Proven emissions (length | body):
                                         17 | 01 00 43 ... (field_r = 3)
                                         18 | 01 00 c0 40 ... (field_r = 64)

        So, exactly as with opcode 3, the byte after the opcode is payload in
        one case and a LENGTH in the other. Peek it:

          == 0x02  -> request: that byte is payload[0], read 2 more (3 total)
          otherwise -> progress record: that byte is the length

        Why the peek is safe: for it to misfire, a progress record would have to
        declare a length of exactly 2. Its body is count + field_q + a varint
        field_r + four i32 + a 4-byte checksum, measured at 23-24 bytes and
        never below 23. The two spaces cannot overlap.

        This replaces a `5: 3` fixed entry, which was wrong and actively
        harmful: a progress record read as 3 bytes leaves ~22 bytes in the
        stream and permanently desynchronises the ISAAC opcode keystream. It
        fired exactly when a stamina stage was cleared, which is the moment the
        client queues the record.
        """
        first = read_u8(sock)
        if first == 0x02:
            payload = bytes([first]) + read_exact(sock, 2)
            return GamePacket(5, payload, False)
        payload = read_exact(sock, first) if first else b""
        return GamePacket(5, payload, False)

    def encode_server_packet(self, opcode: int, payload: bytes = b"") -> bytes:
        """Encode one server packet, framed per SERVER_PACKET_LENGTHS.

        A fixed-size opcode carries NO length byte -- adding one makes the
        client read the first payload byte as the length and desynchronise the
        stream silently. Nothing on either side validates this, so the damage
        surfaces much later as unrelated-looking corruption.

        An opcode missing from the table falls back to the payload's own length,
        i.e. fixed-size. That is a guess for anything the table does not cover;
        prefer adding a real entry over relying on it.

        That fallback is now LOUD. It once framed a guessed opcode 15 as bare
        fixed-size and crashed a real client: the client's own length table
        disagreed, so it read the next packet's bytes as a length and desynced.
        The failure surfaced as an unrelated-looking NullPointerException far
        from the cause, which is exactly the silent damage described above.
        Our table lacking an entry tells us nothing about the client's table.
        """
        raw_opcode = (opcode + self.outbound.next()) & 0xFF
        if opcode not in SERVER_PACKET_LENGTHS:
            print(
                f"[packets] WARNING opcode {opcode} has no measured length entry; "
                f"guessing fixed {len(payload)}-byte framing. If the client's "
                f"mk.field_c[{opcode}] disagrees, this DESYNCS the stream and "
                f"the client will die somewhere unrelated."
            )
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
    """Payload for SERVER opcode 4, answering the client's opcode-5 request.

    This docstring previously said "opcode 12" and "THE CLIENT DISCARDS THIS
    PACKET". Both were wrong. bd.f's dispatch, read from BYTECODE rather than
    CFR output (which had already produced three different wrong answers), is a
    chain of compares on bh.field_k:

        opcode 1 -> ua.i     opcode 2 -> ke.e
        opcode 3 -> dk.a     opcode 4 -> cm.a((byte) 53)   <-- this packet

    So cm.a IS reached, and it parses this payload:

        byte 0        discriminator; 0 selects the `sb` path
        byte 1        read into var3; unused on the sb path
        remaining     little-endian into sb.field_q, capped at
                      field_q.length << 2 (field_q is int[1], so 4 bytes)

    cm.java:134 then sets sb.field_s = true, which is exactly what dc.java:370
    waits on before folding field_q[0] into id.field_P -- the stamina progress
    that vk.java:671 tests as `>= 3` to enable the Master Challenge.

    So `value` here is the player's highest stamina stage index, and passing a
    hardcoded 0 kept that button grey no matter how far the player had got.
    """
    return bytes([0, 0]) + int(value).to_bytes(4, "little")


def build_achievements_reply(indices: list[int]) -> bytes:
    """Payload for server opcode 3 -- the reply to a client ACHIEVEMENTS request.

    Layout confirmed against a deobfuscated client for the same FunOrb
    framework (lexi-lambda/shattered-plans, JagexApplet.handleAchievementsPacket
    and its reference server ClientHandler):

        u8 status   0 = OK: u8 count, then count x i32 bitmap words
                    1 = shut the connection down
                    2 = achievements offline/unavailable

    That project names the opcodes: C2S 0x04 = ACHIEVEMENTS, S2C 0x03 =
    ACHIEVEMENTS. Both match what we had reverse-engineered here as "opcode 4"
    and "the dk.a path".

    THIS REPLACES A STATUS-2 REPLY. build_f_reply() sent a bare `2`, which the
    reference names `areAchievementsOffline` -- i.e. we were answering every
    request with "the Achievements system is currently unavailable", which is
    why the screen stayed empty no matter how many records we had stored.

    MUST ONLY BE SENT AS A REPLY. The client pops a pending request queue and
    tears the connection down if nothing is waiting (`achievementRequests.poll()
    ... ifPresentOrElse(..., JagexApplet::shutdownServerConnection)`), which is
    the same disconnect we observed here as si.a(127) out of dk.a.

    Bit placement matches rb.a (rb.java:184): word = index >> 5, bit = index &
    31. All 31 Dekobloko achievements fit in word 0.
    """
    words = [0] * 8
    for index in indices:
        if 0 <= index < 31:
            words[index >> 5] |= 1 << (index & 31)

    count = 1
    while count < 8 and any(words[count:]):
        count += 1

    payload = bytearray([0, count])  # status 0 = OK
    for word in words[:count]:
        payload.extend((word & 0xFFFFFFFF).to_bytes(4, "big"))
    return bytes(payload)


def build_achievement_mask(indices: list[int]) -> bytes:
    """Payload for server opcode 75 -- the earned-achievement mask.

    UNUSED / NOT SENT. Kept only as a record of a measurement.

    This was written to push the mask unsolicited at bootstrap, which is wrong:
    the achievements reply belongs on opcode 3 as an answer to a request (see
    build_achievements_reply). Sending it unsolicited would hit the same
    empty-pending-queue disconnect that dk.a takes.

    Layout READ FROM THE HANDLER, client.java:761-841:

        u8            count
        count x i32   mask words, big-endian

    The handler allocates a scratch int[8] (`b.h(-123)`, b.java:42 returns
    new int[8]), reads `count` ints into it (client.java:838, `i(7553)`), then
    bitwise-ORs them into the two persistent masks: j.field_d
    (client.java:802-812) and o.field_g (client.java:824-834). It then walks the
    31 indices and raises a toast per newly-set bit (client.java:788-790).

    Bit placement matches rb.a (rb.java:184): word = index >> 5, bit = index &
    31. All 31 achievements therefore live in word 0, so one word suffices --
    but the scratch array is int[8] and a count above 8 would overrun it, so
    this refuses to emit more than 8 words.

    NOT YET CONFIRMED AGAINST A LIVE CLIENT. Two specific risks:
      - The merge is an OR, so this can only ever ADD achievements. It cannot
        take one away, which is the safe direction to be wrong in.
      - client.java:768-778 has an AND-NOT branch taken when nm.field_Qb is
        set. Sending after that latch flips could CLEAR bits instead of setting
        them, so this is sent during bootstrap, before the initial sync
        completes.
    """
    words = [0] * 8
    for index in indices:
        if 0 <= index < 31:
            words[index >> 5] |= 1 << (index & 31)

    # Trailing zero words carry no information; sending only what is needed
    # keeps the packet minimal and stays well inside the int[8] scratch.
    count = 1
    while count < 8 and any(words[count:]):
        count += 1

    payload = bytearray([count])
    for word in words[:count]:
        payload.extend((word & 0xFFFFFFFF).to_bytes(4, "big"))
    return bytes(payload)


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


# ---------------------------------------------------------------------------
# Multiplayer feature builders.
#
# Every layout below was proven by EXECUTING the client's own classes headless
# (harnesses under the session scratch dir, driven against the compiled client)
# rather than by reading decompiled source. That distinction matters here: in
# this project every wire format derived by reading was wrong at least once --
# the bd.f dispatch three times, the Huffman table twice, the chat envelope
# four. Where a field below is NOT execution-proven it says so explicitly.
#
# A caveat that applies to all of them: these proofs are field-decode proofs.
# The harnesses drove the client's parsers and asserted the resulting state
# fields, but no renderer was driven (painting needs AWT). A packet that decodes
# is not automatically a packet that paints.
# ---------------------------------------------------------------------------


def build_room_membership(disc: int, occupants: int = 0) -> bytes:
    """Server opcode 6 -- the reply to a client opcode 7 room request.

    PROVEN by running the client's ul.a handler:

      [u8 disc][u8 N]  and, only when N > 0, occupant data.

    `disc` MUST equal the `q` byte the client sent in its opcode 7 request (the
    pending cl.field_q). A mismatch is not ignored: the client calls si.a(122)
    and DISCONNECTS. This was verified with a deliberate mismatch control.

    N == 0 is the proven early-out. It still finalizes the room -- cl.field_A
    becomes true and cl.b() runs -- it just yields an empty occupant list.

    N >= 1 is NOT shipped because the per-occupant record is not reversed: the
    host name is not on the wire (it comes from oa.f), then (N-1) NUL-terminated
    names, then N bit-packed pn.a(63, wl) records whose layout is unknown.
    Sending a guessed occupant blob would desynchronise the room state. Reverse
    pn.a before raising this above 0.
    """
    if occupants != 0:
        raise ValueError(
            "occupant records (N >= 1) are not reversed yet; see build_room_membership"
        )
    return PacketBuilder().u8(disc).u8(occupants).finish()


def build_achievement_ack(key: int, value: int = 0) -> bytes:
    """Server opcode 2, sub-command 1 -- acknowledge one achievement record.

    PROVEN by feeding `01 ab cd 11 22 33 44 55 66 77 88` to the client's real
    ke.e: it set kn.field_o to 0x1122334455667788 exactly and popped the pending
    kn (field_u == 0xABCD) off pb.field_c.

      [u8 1][u16 BE key][i64 BE value]      = 11 bytes

    `key` MUST echo the kn.field_u correlation id from the client's opcode 3
    push, verbatim. The client matches the ack against its pending queue by that
    id; an unmatched ack leaves the record queued and the request re-draining
    forever (the governing rule).

    Sub-command 1 is mandatory. Sub-command 0 on opcode 2 is the unrelated
    hiscore/roster branch -- see build_hiscore_table.
    """
    return PacketBuilder().u8(1).u16(key).u64(value).finish()


def build_hiscore_table(
    key: int,
    entries: list[tuple[int, int, list[int]]],
    vcols: int = 1,
    columns: list[tuple[str, str | None]] | None = None,
) -> bytes:
    """Server opcode 2, sub-command 0 -- the hiscore table.

    PROVEN accepted by the client's real ke.e; it set kc.field_p and populated
    field_t / field_u.

      u8      subtype = 0
      u16 BE  key            MUST equal the request's field_n
      u8      count          columns including col 0 (the local player)
      per extra column:  cstring name, u8 flag, cstring second only if flag == 1
      u8      entryCount
      per entry:  u8 columnIndex, i64 BE score, vcols x i32 BE value

    `entries` is a list of (column_index, score, values) with len(values) == vcols.

    Only the count == 1 single-board case is execution-proven; the extra-column
    path and vcols > 1 are read from the handler but were never run. The proven
    minimal payload is:

      00 00 00 01 01 00 00 00 00 00 00 00 03 E7 00 00 00 05
    """
    builder = PacketBuilder().u8(0).u16(key)
    count = 1 + (len(columns) if columns else 0)
    builder.u8(count)
    for name, second in columns or []:
        builder.cstring(name)
        if second is None:
            builder.u8(0)
        else:
            builder.u8(1).cstring(second)
    builder.u8(len(entries))
    for column_index, score, values in entries:
        if len(values) != vcols:
            raise ValueError(f"entry needs exactly {vcols} values, got {len(values)}")
        builder.u8(column_index).u64(score)
        for value in values:
            builder.u32(value)
    return builder.finish()


def build_ignore_entry(name: str, previous: str = "", world: str = "") -> bytes:
    """Server opcode 13, mode 1 -- one ignore-list entry.

    PROVEN by running the client's oe.c(false) on
    `01 00 46 6F 6F 00 57 6F 72 6C 64 31 00`: md.field_Z became 1, mc.field_a a
    fresh nk(128), and the wb was enqueued on qi.field_S.

      [u8 1][cstring previous][cstring name][cstring world]

    An empty `previous` (a bare NUL) is stored as null, which is the normal case
    for an entry that was not renamed.

    Note the ignore branch has NO flag byte -- the friend branch does. They are
    genuinely different shapes on the same opcode; see build_friend_entry.
    """
    return PacketBuilder().u8(1).cstring(previous).cstring(name).cstring(world).finish()


def build_friend_entry(name: str, display_name: str | None = None, world: str = "") -> bytes:
    """Server opcode 13, mode 0 -- one friend-list entry.

    PROVEN by running oe.c on the same tail as the ignore case. Note the extra
    flag byte, which the ignore branch does not have:

      [u8 0][u8 flag][cstring name][cstring displayName only if flag == 1][cstring world]

    Populates hg.field_e / ed.field_g / uf.field_z, with wb.field_Pb holding the
    display name.
    """
    builder = PacketBuilder().u8(0)
    if display_name is None:
        builder.u8(0).cstring(name)
    else:
        builder.u8(1).cstring(name).cstring(display_name)
    return builder.cstring(world).finish()


def build_local_player_id(uid: int) -> bytes:
    """Server frame 10, mode 23 -- tell the client which player it is.

    Same connection channel and framing as build_lobby_player(); see that
    docstring for the transport.

      [u8 23][u64 BE uid]

    The client identifies its own roster row by comparing tj.field_cc against
    uc.field_g (cl.java:645). nk.a initialises uc.field_g to the sentinel -1L
    on frame 14, so until this packet arrives NO row matches and the client
    cannot tell which entry is itself.

    PROVEN by execution: driven through the real connection path into ke.a
    with uc.field_g pre-set to the -1L sentinel; it came back 42, consuming
    exactly 9 bytes and returning cleanly (no `jb` -- unlike mode 5, this
    branch reads a fixed body and returns rather than looping).

    Mode 23 was identified from the dispatch chain in ke.a
    (`bipush 23; iload_3; if_icmpeq 1230`), not guessed.

    Send AFTER frame 14 and, for the local player's row to resolve, the uid
    here must match the uid given to build_lobby_player() for that player.
    """
    if not 0 <= uid <= 0xFFFFFFFFFFFFFFFF:
        raise ValueError(f"uid must fit in u64, got {uid}")
    return PacketBuilder().u8(23).u64(uid).finish()


def build_lobby_player(
    uid: int,
    name: str,
    rating: int,
    rated_games: int = 0,
    flag: bool = False,
    display_name: str | None = None,
    previous_name: str = "",
    seconds_ago: int = 0,
    icon: int = 0,
    options: int = 0,
) -> bytes:
    """Server frame 10, mode 5 -- add-or-update ONE lobby roster row.

    This is NOT a bd.f game-channel opcode. It arrives on the login/connection
    channel read by qb.a, which writes the frame code straight into bh.field_k
    (qb.a offset 1160-1162); client.i then sees bh.field_k == 10 && uh.field_b
    and calls ke.a to parse it. That is why 10 never appears in te.field_v --
    the enable table gates bd.f dispatch, and this is a different reader.
    Framing is [u8 frameCode][u8 length][body], per fh.a (-1 => u8 length),
    which independently agrees with mk.field_c[10] == -1.

      [u8 5][u64 BE uid][cstring name][cstring previousName]
      [cstring displayName][u32 BE secondsAgo][u16 BE rating]
      [u8 (ratedGames << 1) | flag][u8 icon][u8 options]

    PROVEN by execution: driven through the real connection path (stubbed qk
    socket) into ke.a, every field round-tripped exactly -- tj.field_cc=42,
    field_Rb/field_Yb="Alice", field_Ub=1487 (the rating), field_Xb=37,
    field_ec=True, field_dc=3, field_Sb=0 -- consuming exactly 31 bytes.

    ORDERING: the roster hashtable ob.field_i is allocated by nk.a from the
    frame-14 branch (client.java:730). Send frame 14 (send_lobby_bootstrap)
    BEFORE any frame 10, or there is no table to insert into.

    ke.a reads records until the buffer is exhausted and then throws `jb`.
    That is normal loop termination, not an error -- the same shape already
    documented for oe.c. One record per packet is the tested shape.

    rating lands in tj.field_Ub and is rendered as Integer.toString into the
    Rating column widget tj.field_Tb. The column is always present: pd.field_a
    is a hardcoded true (iconst_1 in pd.<clinit>, zero cross-class writes), so
    the server cannot gate it -- every row must carry a rating.
    """
    if not 0 <= rating <= 0xFFFF:
        raise ValueError(f"rating must fit in u16, got {rating}")
    if not 0 <= rated_games <= 0x7F:
        raise ValueError(
            f"rated_games must fit in 7 bits (packed as games << 1 | flag), got {rated_games}"
        )
    return (
        PacketBuilder()
        .u8(5)
        .u64(uid)
        .cstring(name)
        .cstring(previous_name)
        .cstring(name if display_name is None else display_name)
        .u32(seconds_ago)
        .u16(rating)
        .u8((rated_games << 1) | (1 if flag else 0))
        .u8(icon)
        .u8(options)
        .finish()
    )


def build_social_list_complete(mode: int = 2) -> bytes:
    """Server opcode 13, mode 2/3 -- the social-list transfer-complete marker.

    Toggles the static jj.field_b list-complete / dirty flags. Send it after the
    entries so the client stops treating the list as still arriving.

    Mode 4 is deliberately rejected: it reads an extra cstring into f.field_w
    plus a u8 and then calls nh.a(12, x). That path was read from bytecode but
    never executed, so building it here would be a guess.
    """
    if mode not in (2, 3):
        raise ValueError("only the proven list-complete modes 2 and 3 are supported")
    return PacketBuilder().u8(mode).finish()


def build_quickchat_broadcast(name: str, quickchat_id: int, channel: int = 0) -> bytes:
    """Server opcode 12 -- a canned quick-chat line from `name`.

    Opcode 12 is quickchat, dispatched to ki.a(0, true); opcode 11 is free text,
    ki.a(0, false). Confirmed from bd.f bytecode. The text is NOT on the wire --
    the client looks it up by id via wj.field_Qb.a(127, id).

      [u8 flags][u8 tg.field_c][u64 fc.field_h][u8 var4][cstring name][u16 BE id]

    Two fields decide whether this renders at all, both learned the hard way on
    the free-text path (see build_chat_broadcast):

      flags  = channel, with bit 0x80 CLEAR, or the name is suppressed
      tg.field_c = 1, or the name renders as the literal string "null"

    Only channel 0 with var4 = 0 (a single reused name) is execution-proven. The
    channel 2 branch additionally reads a u16 and a u24, and channels 1 and 4
    read a further u16 + cstring; those were read from bytecode, never run.

    The id is relayed verbatim. Ids from the F10 menu path arrive with bit 0x8000
    set (ig.a: Nb[idx] | 0x8000) and ki.a does not mask it on read, so passing it
    through is the behaviour-preserving choice -- but that the renderer tolerates
    the high bit is UNPROVEN. If quickchat lines come out blank, strip it here.
    """
    if channel != 0:
        raise ValueError("only channel 0 is execution-proven for quickchat")
    builder = PacketBuilder().u8(channel).u8(1).u64(0).u8(0)
    return builder.cstring(name).u16(quickchat_id).finish()
