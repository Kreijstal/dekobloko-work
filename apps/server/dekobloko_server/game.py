from __future__ import annotations

import secrets
import socket
import threading

from .accounts import AccountStore
from .config import ServerConfig
from .crypto import RsaPrivateKey, signed32
from .io import hex_preview, read_exact, read_u8, read_u16, write_u8, write_u64
from .lobby import HostedGame, LOBBY, Piece
from .login import PacketReader, ParsedLogin, parse_login_body
from .huffman import decode as huffman_decode
from .packets import (
    PacketBuilder,
    PacketCodec,
    build_chat_broadcast,
    build_f_reply,
    build_sb_reply,
)


class GameSession:
    def __init__(self, sock: socket.socket, config: ServerConfig, peer: str) -> None:
        self.sock = sock
        self.config = config
        self.peer = peer
        self.rsa_key = RsaPrivateKey.from_json(config.rsa_key_path)
        self.accounts = AccountStore(config.accounts_path, config.auto_register)
        self.codec: PacketCodec | None = None
        self.display_name = config.display_name
        self.current_game: HostedGame | None = None
        self.player_slot: int | None = None
        self._send_lock = threading.Lock()
        self._lobby_ready = False
        self._lobby_bootstrapped = False

    def _ensure_lobby_bootstrap(self, trigger: str) -> None:
        """Send the lobby state the first time the client actually asks for it.

        Deliberately lazy: the bootstrap appears to be what puts the client on
        the lobby screen, so sending it unprompted skips the main menu. Gate it
        behind a packet that only a client already heading for multiplayer
        would send.

        Evidence, and its limits: with the bootstrap auto-sent, forcing
        v.field_d by reflection produced the lobby; with it withheld, the same
        forced bit produced the main menu. Same build, same bit, so the
        bootstrap does decide which screen appears. But BOTH observations came
        from a client driven by a reflection hack, never one that got there on
        its own -- and opcodes 58 and 9, the triggers chosen below, have never
        actually been received from a client. That they are what a
        multiplayer-bound client sends is a guess.
        """
        if self._lobby_bootstrapped:
            return

        # NOTE: deliberately NOT gated on self._lobby_ready.
        #
        # _lobby_ready is set per connection by the 4/5 heartbeat, but the
        # client issues the lobby request (opcode 9, from jm.a:151 <- ke.d:3578
        # <- ke.k:1426, the ENTER MULTIPLAYER LOBBY handler) on a DIFFERENT
        # connection that never sends a heartbeat. Requiring readiness here
        # rejected every real lobby request with "arrived before ready" and
        # broke lobby entry that had previously worked.
        #
        # The request is its own readiness proof: that button only exists on a
        # fully loaded main menu. The original crash this gate was meant to
        # prevent came from pushing the bootstrap UNPROMPTED at login time,
        # which is still avoided -- nothing is sent until the client asks.
        self._lobby_bootstrapped = True
        print(f"[game] {self.peer} lobby requested via {trigger}; sending bootstrap")
        LOBBY.send_bootstrap(self)
        if self.config.welcome_message:
            self.send_server_message(
                self.config.welcome_message.replace("{name}", self.display_name)
            )

    def run_after_opcode(self, opcode: int) -> None:
        print(f"[game] {self.peer} opcode={opcode}")

        if opcode == 14:
            self._handle_seeded_login()
            return

        if opcode in (16, 18):
            self._handle_direct_login(opcode)
            return

        print(f"[game] {self.peer} unsupported first opcode={opcode}")

    def _handle_seeded_login(self) -> None:
        target = read_u8(self.sock)
        challenge = secrets.randbits(64)
        print(f"[game] {self.peer} login-target={target} challenge=0x{challenge:016x}")

        write_u8(self.sock, 0)
        write_u64(self.sock, challenge)

        login_opcode = read_u8(self.sock)
        if login_opcode not in (16, 18):
            print(f"[game] {self.peer} unexpected login opcode={login_opcode}")
            return

        length = read_u16(self.sock)
        body = read_exact(self.sock, length)
        print(
            f"[game] {self.peer} login opcode={login_opcode} "
            f"length={length} body={hex_preview(body)}"
        )

        try:
            parsed = parse_login_body(body, self.rsa_key, challenge)
        except Exception as exc:
            print(f"[auth] {self.peer} login parse failed: {exc}")
            self._send_login_error(3, "Could not parse the login block.")
            return
        self._log_login(parsed)

        if not parsed.challenge_matches:
            self._send_login_error(3, "Login seed challenge mismatch.")
            return

        auth = self.accounts.authenticate(parsed.credentials.username, parsed.credentials.password)
        if not auth.ok:
            print(f"[auth] {self.peer} denied username={parsed.credentials.username!r} reason={auth.reason}")
            self._send_login_error(3, "Invalid username or password.")
            return

        self.display_name = auth.display_name or self.config.display_name
        self.codec = PacketCodec(parsed.client_seed)
        self._send_login_success()
        LOBBY.join(self)
        try:
            # Welcome text is deferred with the bootstrap; anything sent before
            # the client finishes loading crashes it. See Lobby.join().
            self._run_packet_loop()
        finally:
            LOBBY.leave(self)

    def _handle_direct_login(self, opcode: int) -> None:
        length = read_u16(self.sock)
        body = read_exact(self.sock, length)
        print(
            f"[game] {self.peer} direct/create opcode={opcode} "
            f"length={length} body={hex_preview(body)}"
        )
        write_u8(self.sock, 2)


    def _send_login_error(self, code: int, message: str) -> None:
        payload = message.encode("cp1252", errors="replace") + b"\x00"
        if len(payload) > 255:
            raise ValueError("login error payload must fit in one byte")
        write_u8(self.sock, code)
        write_u8(self.sock, len(payload))
        self.sock.sendall(payload)
        print(f"[game] {self.peer} login error code={code} message={message!r}")

    def _send_login_success(self) -> None:
        payload = bytearray()
        payload.extend((self.config.player_id & 0xFFFFFFFFFFFFFFFF).to_bytes(8, "big"))
        payload.append(0)  # moderator/staff level
        payload.append(0)  # account state byte
        payload.extend(b"\x00\x00")  # eh.eh_a membership/subscription field
        payload.append(0)  # empty optional browser/system message string
        payload.append(0)  # login flags
        payload.extend(self.display_name.encode("cp1252", errors="replace"))
        payload.append(0)
        payload.append(0)  # final account flag byte

        if len(payload) > 255:
            raise ValueError("login payload must fit in one byte")

        write_u8(self.sock, 0)
        write_u8(self.sock, len(payload))
        self.sock.sendall(payload)
        print(f"[game] {self.peer} login success display_name={self.display_name!r}")

    def send_server_message(self, text: str) -> None:
        self._send_server_message(text)

    def send_lobby_bootstrap(self) -> None:
        # Opcode 14 with an empty payload. This one HAS been sent and the client
        # reacted to it (it drove bh.field_k to 14 and, when sent too early, the
        # NPE at jg.java:169), so the opcode is right. Whether an empty payload
        # is right is a separate question and untested: the crash proved the
        # client dispatched the packet, not that it read a well-formed one.
        self._send_packet(14)
        print(f"[game] {self.peer} sent lobby bootstrap")

    # ---------------------------------------------------------------------
    # Everything below is UNEXERCISED. No client has ever been observed
    # reaching multiplayer, and none of these appear in any surviving log:
    # no match start, no piece event, no queued piece, no action stream, no
    # player removed. Single player was played, but that runs entirely inside
    # the client and never touches this code.
    #
    # So the payload layouts here are reconstructions from reading the
    # decompiled client, never confirmed against a running one. They may well
    # be wrong in ways nothing has had a chance to reveal. Two specific
    # reasons to distrust them:
    #
    #   * They were written against the old per-opcode length table, which
    #     turned out to be invented -- 58/61/64 were marked -2 (u16 length)
    #     and 62 as fixed-width, and the client supports neither. That table
    #     is gone now, but these payloads were never re-checked against the
    #     framing that replaced it.
    #   * A single u8 length caps any server packet at 255 bytes. A full board
    #     update (61) or a match start with several long names could exceed
    #     that, and encode_server_packet will now raise rather than truncate.
    #     Nobody has tested whether real payloads fit.
    #
    # Treat a working-looking call here as unproven until a second client is
    # actually in a game.
    # ---------------------------------------------------------------------

    def send_match_start(self, game: HostedGame, local_slot: int) -> None:
        payload = (
            PacketBuilder()
            .u16(game.options.settings_word())
            .u16(game.game_id)
            .u8(game.options.theme)
            .u8(len(game.players))
            .i8(local_slot)
        )
        for name in game.names:
            payload.jagex_string(name)
        payload.u8(game.active_mask())
        self._send_packet(58, payload.finish())
        print(
            f"[game] {self.peer} sent match start game={game.game_id} "
            f"slot={local_slot} names={game.names!r}"
        )

    def send_piece_event(self, player_slot: int, piece: Piece, speed_index: int) -> None:
        # Packet 64 is BELIEVED to feed a vm event into qc_v[player].lb_g, which
        # would install the active rf shape for that player's board. That is a
        # reading of the decompiled client, not an observation -- no client has
        # ever received this packet. The five leading bytes below (slot, two
        # zeroed i8s, a speed nibble shifted left 2, a zero) are the shakiest
        # part: their meaning was guessed from field order, and the two zeros in
        # particular have no known justification.
        payload = (
            PacketBuilder()
            .u8(player_slot)
            .i8(0)
            .i8(0)
            .u8((speed_index & 0xF) << 2)
            .u8(0)
            .raw(piece.encode_rf())
            .u8(piece.descriptor)
            .varint7(0)
            .varint7(0)
            .finish()
        )
        self._send_packet(64, payload)
        print(
            f"[game] {self.peer} sent piece event slot={player_slot} "
            f"piece={piece.piece_id} {piece.width}x{piece.height}"
        )

    def send_queued_piece(self, player_slot: int, piece: Piece) -> None:
        payload = PacketBuilder().u8(player_slot).raw(piece.encode_rf()).finish()
        self._send_packet(67, payload)
        print(
            f"[game] {self.peer} sent queued piece slot={player_slot} "
            f"piece={piece.piece_id} {piece.width}x{piece.height}"
        )

    def send_action_stream(self, player_slot: int, controls_payload: bytes) -> None:
        payload = PacketBuilder().u8(player_slot).raw(controls_payload).finish()
        self._send_packet(63, payload)
        print(
            f"[game] {self.peer} relayed controls slot={player_slot} "
            f"len={len(controls_payload)}"
        )

    def send_player_removed(self, player_slot: int, result_code: int) -> None:
        self._send_packet(62, PacketBuilder().u8(player_slot).u8(result_code).finish())
        print(f"[game] {self.peer} sent player removed slot={player_slot} result={result_code}")

    def _send_server_message(self, text: str) -> None:
        if self.codec is None:
            raise RuntimeError("packet codec is not initialized")
        packet = self.codec.make_server_message(text)
        with self._send_lock:
            self.sock.sendall(packet)
        print(f"[game] {self.peer} sent server message: {text!r}")

    def _send_packet(self, opcode: int, payload: bytes = b"") -> None:
        if self.codec is None:
            raise RuntimeError("packet codec is not initialized")
        packet = self.codec.encode_server_packet(opcode, payload)
        with self._send_lock:
            self.sock.sendall(packet)

    def _run_packet_loop(self) -> None:
        if self.codec is None:
            raise RuntimeError("packet codec is not initialized")

        while True:
            packet = self.codec.read_client_packet(self.sock)
            print(
                f"[game] {self.peer} packet opcode={packet.opcode} "
                f"len={len(packet.payload)} assumed_variable={packet.assumed_variable} "
                f"payload={hex_preview(packet.payload, 64)}"
            )

            # The opcode 4/5 heartbeat only starts once client.n(int) has run
            # all five load stages, so the first one marks the client as ready.
            # Anything sent before that NPEs it. See Lobby.join().
            #
            # Readiness is NOT the same as wanting the lobby. Pushing the lobby
            # bootstrap here drives the client straight into the lobby screen
            # and skips the main menu entirely, which is not how the real
            # service behaved -- after login you get the main menu, and the
            # lobby only once you ask for multiplayer. So mark ready and wait
            # for the client to ask. See _ensure_lobby_bootstrap().
            if packet.opcode in (4, 5) and not self._lobby_ready:
                self._lobby_ready = True
                print(f"[game] {self.peer} client ready (heartbeat {packet.opcode}); "
                      f"holding lobby bootstrap until requested")

            # Opcode 5 is a request, not a heartbeat: oi.java:272 writes it as
            # [5][2][0][sb.field_r] into the outbound buffer. That much is solid.
            #
            # THE REPLY BELOW IS A PROVEN NO-OP. The client receives it, parses
            # it, and throws it away. Measured end to end with instrumentation:
            #
            #   NET-IN 4a / 06 / 00 x6      all 8 bytes arrive at the socket
            #   vi.a completes              bh.field_k=12, dl.field_N=-1, buffer reset
            #   te.field_v[12] == true      dispatch is enabled
            #   DISPATCH bd.f opcode=12     bd.f IS entered with opcode 12
            #   REACHED cm.a(53)            NEVER fires
            #
            # bd.java:974 is why: `if (var2 == 12) { break L3; }` -- opcode 12
            # hits a branch that does nothing. cm.a(53), the parser that would
            # drain ef.field_S and set sb.field_s, is never reached, so this
            # cannot move qj.field_k. An earlier comment here claimed the
            # opposite; it was based on misreading bd.f's nested control flow,
            # which the probes contradicted.
            #
            # Kept only so the opcode is not silently swallowed as a heartbeat
            # again, and so the next person starts from the measurement rather
            # than repeating it. Whatever does reach cm.a(53) is still unknown;
            # find that before shaping any payload here. Deleting this handler
            # entirely would lose nothing that currently works.
            # Opcode 5 is a request (oi.java:272 writes [5][2][0][sb.field_r]),
            # but NOTHING WE HAVE TRIED ANSWERS IT CORRECTLY. Measured:
            #
            #   reply opcode 12 -> received, dispatched, silently discarded.
            #                      bd.java:974 `if (var2 == 12) break L3;` then
            #                      L4 only sets a boolean and falls into
            #                      ki.a(...)/cl.a(...). cm.a(53) never reached.
            #   reply opcode 6  -> HARMFUL. Client reconnects immediately; one
            #                      full login per reply, 1114 logins in a single
            #                      short run. Do not re-try this.
            #   no reply        -> client stalls on "Loading extra data" but the
            #                      session stays stable. This is the least-bad
            #                      known state, so it is what we do.
            #
            # The target is cm.a((byte) 53), which drains ef.field_S and sets
            # sb.field_s, which dc.java:370 needs to flip qj.field_k. Which
            # opcode actually reaches cm.a is UNKNOWN -- three attempts to
            # derive it by reading bd.f's nested blocks gave three different
            # wrong answers (12, then 6). Get it from bytecode, not from the CFR
            # output, before touching this again.
            if packet.opcode == 5:
                self._send_packet(4, build_sb_reply(0))
                print(f"[game] {self.peer} opcode 5 -> sent opcode 4 (cm.a path, from bytecode)")
                continue

            # Opcode 4 is a request, not a heartbeat. gm.b(4, 65) (gm.java:90)
            # writes it as [4][1][2], which is the `01 02` payload long
            # mislabelled as half a "heartbeat pair". It is issued by
            # cc.a (cc.java:14), which first registers an `f` on rc.field_e.
            #
            # The reply is server opcode 3 -> dk.a, per the bytecode dispatch
            # table. dk.a pops rc.field_e, sets field_t and field_u, and
            # dc.java:335 then walks field_t's 8 entries and sets nm.field_Qb.
            #
            # nm.field_Qb is the second half of route B: se.i(-1) checks
            # `if (!nm.field_Qb) return v.field_d` first, so qj.field_k alone
            # does nothing. Both are needed to open the UI without v.field_d.
            if packet.opcode == 4:
                self._send_packet(3, build_f_reply())
                print(f"[game] {self.peer} opcode 4 -> sent opcode 3 (dk.a path)")
                continue

            # Client opcode 12: what the lobby chat box actually sends. Written
            # by ce.a (ce.java:435) as [12][u8 len][payload]. The server was
            # dropping it silently, which is why a typed message never appeared.
            #
            # The payload layout is NOT decoded yet, so this cannot echo real
            # text. ce.a writes: a discriminator (param2), then the string only
            # when that discriminator == 2, then either d(-1, param4) or an
            # ij.a(...) encoding. An observed send was `00 04 e7 bc` -- leading
            # byte 0, i.e. the no-string branch, so the message body is not
            # plain text here and probably references a quickchat id.
            #
            # Logged in full so the format can be worked out from real samples.
            # Do not guess at it; decode ce.a's writer and ij.a first.
            # Client opcode 12: the lobby chat send, written by ce.a
            # (ce.java:435) as [12][u8 len][payload]:
            #
            #   byte 0   discriminator (0 = ce.a's plain-string branch skipped)
            #   byte 1   uncompressed character count
            #   rest     Huffman-compressed text, table from archive 3
            #
            # This protocol does not locally echo your own chat -- the client
            # sends and waits for the server to broadcast it back. Dropping this
            # packet is why typed messages never appeared.
            if packet.opcode == 12:
                text = None
                if len(packet.payload) >= 2:
                    count = packet.payload[1]
                    try:
                        text = huffman_decode(packet.payload[2:], count)
                    except Exception as exc:
                        print(f"[chat] {self.peer} huffman decode failed: {exc}")
                print(
                    f"[chat] {self.peer} <{self.display_name}> {text!r}"
                    f"  (raw={packet.payload.hex(' ')})"
                )
                if text:
                    # Relay the client's own compressed bytes rather than
                    # recompressing: the receiving client decompresses with the
                    # same table, so no encoder is needed server-side.
                    # payload is [discriminator][count][huffman]; relay the
                    # compressed bytes and the count separately.
                    broadcast = build_chat_broadcast(
                        self.display_name, count, packet.payload[2:]
                    )
                    for peer in LOBBY.sessions_snapshot():
                        try:
                            peer._send_packet(11, broadcast)
                        except Exception as exc:
                            print(f"[chat] relay to {peer.peer} failed: {exc}")
                continue

            if packet.opcode == 14:
                message = self._parse_client_chat_packet(packet.payload)
                if message:
                    print(f"[chat] {self.peer} {self.display_name}: {message}")
                    LOBBY.handle_chat_or_command(self, message)
                continue

            if packet.opcode == 58:
                self._ensure_lobby_bootstrap("lobby button (58)")
                LOBBY.handle_lobby_button(self)
                continue

            if packet.opcode == 9:
                self._ensure_lobby_bootstrap("game list request (9)")
                LOBBY.send_games(self)
                continue

            # "Return to Main Menu" in the lobby (mf.java:537) sets nh.field_a,
            # which ka.java:563 drains by writing outbound opcode 10. The client
            # then waits for the server to move it. leave_game() alone answers
            # nothing, so the button appeared dead.
            # "Return to Main Menu" (mf.java:537) sets nh.field_a, which
            # ka.java:563 drains by writing client opcode 10. The client then
            # WAITS for the server to move it -- exactly like opcodes 4 and 5.
            # leave_game() alone answers nothing, which is why the button looked
            # dead.
            #
            # Reply candidate: server opcode 15. client.java has a second
            # dispatcher (separate from bd.f) covering 9, 10, 14, 15 and 58-77;
            # at :747 opcode 15 gets its own branch, checked before 10. It has no
            # mk.field_c entry, so it is fixed zero-length. UNVERIFIED beyond the
            # test that follows -- if the client storms or ignores it, try the
            # opcode 10 branch (guarded by uh.field_b -> ke.a(113)) instead, and
            # read the bytecode rather than the CFR output.
            if packet.opcode == 10:
                print(f"[game] {self.peer} client requested return to main menu (10)")
                LOBBY.leave_game(self)
                self._lobby_bootstrapped = False
                self._send_packet(15)
                print(f"[game] {self.peer} -> sent opcode 15 (return-to-menu candidate)")
                continue

            if packet.opcode == 59:
                if packet.payload:
                    print(f"[game] {self.peer} piece/update ack={packet.payload[0]}")
                continue

            if packet.opcode == 60:
                if self.current_game is not None:
                    self.current_game.handle_controls(self, packet.payload)
                continue

            if packet.opcode == 62:
                LOBBY.leave_game(self)
                continue

            if packet.opcode == 63:
                if self.current_game is not None:
                    self.current_game.handle_piece_request(self)
                continue

            message = self._try_parse_client_text_packet(packet.payload)
            if message:
                print(f"[chat] {self.peer} {self.display_name}: {message}")
                LOBBY.handle_chat_or_command(self, message)

    def _parse_client_chat_packet(self, payload: bytes) -> str | None:
        if len(payload) < 11:
            return None
        reader = PacketReader(payload)
        reader.read_u64()
        try:
            text = reader.read_cstring()
        except ValueError:
            return None
        if reader.remaining() < 2:
            return None
        reader.read_u8()
        reader.read_u8()
        if reader.remaining() != 0:
            return None
        if not text or any(ord(ch) < 32 and ch not in "\t\n\r" for ch in text):
            return None
        return text

    def _try_parse_client_text_packet(self, payload: bytes) -> str | None:
        if len(payload) < 10:
            return None
        reader = PacketReader(payload)
        reader.read_u64()
        try:
            text = reader.read_cstring()
        except ValueError:
            return None
        if reader.remaining() < 2:
            return None
        if not text or any(ord(ch) < 32 and ch not in "\t\n\r" for ch in text):
            return None
        return text

    def _log_login(self, parsed: ParsedLogin) -> None:
        print(
            f"[auth] {self.peer} revision={parsed.prefix.client_revision} "
            f"client_detail=0x{parsed.prefix.client_detail:016x} flags=0x{parsed.prefix.flags:02x} "
            f"client_string={parsed.prefix.client_string!r}"
        )
        print(
            f"[auth] {self.peer} rsa_len={len(parsed.rsa_plain)} "
            f"xtea_keys={[signed32(k) for k in parsed.xtea_keys]} "
            f"xtea_plain_length={parsed.xtea_plain_length}"
        )
        print(
            f"[auth] {self.peer} client_seed={list(parsed.client_seed_signed)} "
            f"challenge=0x{parsed.challenge_seed:016x} match={parsed.challenge_matches}"
        )
        print(
            f"[auth] {self.peer} username={parsed.credentials.username!r} "
            f"password_len={len(parsed.credentials.password)} kind={parsed.credentials.credential_kind} "
            f"login_mode={parsed.credentials.login_mode}"
        )
