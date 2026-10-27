from __future__ import annotations

import zlib

from dekobloko_server.game import GameSession
from dekobloko_server.io import read_exact, read_u8
from dekobloko_server.packets import GamePacket, PacketBuilder, PacketCodec, build_achievement_ack, build_hiscore_table


class EscapeCodec(PacketCodec):
    # Derived from Escape Vector's writers, not Deko's gameplay opcodes.
    LENGTHS = {0: 0, 1: 0, 2: 3, 4: -1, 6: -1, 7: 2, 8: -1, 16: -1, 17: 0}

    def read_client_packet(self, sock) -> GamePacket:
        opcode = (read_u8(sock) - self.inbound.next()) & 255
        if opcode == 3:
            return self._read_opcode_3(sock)
        if opcode == 5:
            return self._read_opcode_5(sock)
        if opcode not in self.LENGTHS:
            raise ValueError(f"unsupported Escape Vector opcode {opcode}")
        length = self.LENGTHS[opcode]
        if length == -1:
            length = read_u8(sock)
        return GamePacket(opcode, read_exact(sock, length), False)


def checked_record(payload: bytes, length: int | None = None) -> bytes:
    if len(payload) < 5 or (length is not None and len(payload) != length) or payload[0] != 1:
        raise ValueError("invalid account record length/subcommand")
    if zlib.crc32(payload[:-4]) & 0xFFFFFFFF != int.from_bytes(payload[-4:], "big"):
        raise ValueError("account record CRC mismatch")
    return payload[:-4]


def smart(value: int) -> bytes:
    if -64 <= value < 64:
        return bytes([value + 64])
    if -16384 <= value < 16384:
        return (value + 49152).to_bytes(2, "big")
    raise ValueError("signed smart out of range")


class EscapeSession(GameSession):
    packet_codec = EscapeCodec

    def __init__(self, sock, config, peer, *, store) -> None:
        super().__init__(sock, config, peer, accounts=store)
        self.store = store

    def _serve_authenticated(self) -> None:
        # No Deko lobby, bots or match packets. Only framework services are
        # networked in Escape Vector; GameplaySession simulates flight locally.
        self._start_keepalive()
        try:
            self._run_packet_loop()
        finally:
            self._stop_keepalive.set()

    def _log_login(self, parsed) -> None:
        print(f"[escapevector] {self.peer} login username={parsed.credentials.username!r} "
              f"challenge_matches={parsed.challenge_matches}")

    def _run_packet_loop(self) -> None:
        while True:
            packet = self.codec.read_client_packet(self.sock)
            if packet.opcode in (1, 17):
                return
            self.handle_packet(packet)

    def handle_packet(self, packet: GamePacket) -> None:
        op, body = packet.opcode, packet.payload
        user = self.account_name
        if op == 0:
            return
        if op == 2:
            self._send_packet(1, b"\0" * 16)  # ll.b: four statistic integers
        elif op == 3:
            self._highscores(body)
        elif op == 4:
            if body == b"\x02":  # km.a -> cg.c pending achievement request
                words = [0] * 8
                for index in self.store.achievements(user):
                    words[index >> 5] |= 1 << (index & 31)
                payload = PacketBuilder().u8(0).u8(8)
                for word in words:
                    payload.u32(word)
                self._send_packet(3, payload.finish())
            else:  # sm.a -> cg.c status 1 pops the record queue
                record = checked_record(body, 23)
                self.store.earn_achievement(user, record[1])
                self._send_packet(3, b"\x01")
        elif op == 5:
            if len(body) == 3 and body[:2] == b"\x02\0":  # oa.a -> dk.e
                mode = body[2]
                if mode not in (0, 1, 2):
                    raise ValueError("invalid progress request mode")
                value = self.store.progress(user, mode)
                self._send_packet(4, bytes([0, mode]) + value.to_bytes(4, "little"))
            else:  # IntrusiveNode.a -> dk.e status 1 unlinks matching cc
                record = checked_record(body)
                if len(record) < 19:
                    raise ValueError("invalid progress record")
                first = record[2]
                size = 1 if first < 128 else 2
                if len(record) != 2 + size + 16:
                    raise ValueError("invalid progress record")
                level = first - 64 if size == 1 else int.from_bytes(record[2:4], "big") - 49152
                mode = record[1]
                self.store.complete_level(user, mode, level)
                self._send_packet(4, bytes([1, mode]) + smart(level))
        elif op == 6:
            if body == b"\x00":  # q.c -> ge.a, CRC includes subtype and length
                blob = self.store.blob(user)
                reply = bytes([0, len(blob)]) + blob
                self._send_packet(5, reply + (zlib.crc32(reply) & 0xFFFFFFFF).to_bytes(4, "big"))
            else:  # r.a writes blob + CRC; ge.a acknowledges that exact CRC
                record = checked_record(body)
                if len(record) < 2 or len(record) != 2 + record[1] or record[1] > 249:
                    raise ValueError("invalid saved game data")
                self.store.save_blob(user, record[2:])
                self._send_packet(5, b"\x01" + body[-4:])
        elif op == 7:
            # qh.a -> ri.a. Empty framework rating table; Escape has no matches.
            self._send_packet(6, bytes([body[0], 0]))
        elif op in (8, 16):
            # Client reflection reply / client status telemetry, no reply.
            return
        else:
            raise ValueError(f"unsupported Escape Vector opcode {op}")

    def _highscores(self, body: bytes) -> None:
        if len(body) == 6 and body[:2] == b"\x05\0":
            board = int.from_bytes(body[2:4], "big")
            count, columns = body[4:6]
            if board not in range(4) or columns != 1 or count > 100:
                raise ValueError("invalid Escape Vector highscore request")
            rows = self.store.leaders(board, count)
            names, entries = [], []
            for display, score, name in rows:
                index = 0
                if name != self.store._normalize(self.account_name):
                    names.append((display, None))
                    index = len(names)
                entries.append((index, score, [score]))
            self._send_packet(2, build_hiscore_table(board, entries, 1, names))
            return
        record = checked_record(body)
        if len(record) != 28 or record[23] != 1:
            raise ValueError("invalid Escape Vector score record")
        correlation = int.from_bytes(record[1:3], "big")
        board = int.from_bytes(record[3:5], "big")
        variant = int.from_bytes(record[5:7], "big")
        if variant != board ^ 65535:
            raise ValueError("invalid highscore board variant")
        score = int.from_bytes(record[24:28], "big", signed=True)
        best = self.store.submit_score(self.account_name, board, score)
        self._send_packet(2, build_achievement_ack(correlation, best))
