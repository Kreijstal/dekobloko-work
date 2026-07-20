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
    build_achievement_ack,
    LOBBY_ACTION_NAMES,
    build_achievements_reply,
    build_chat_broadcast,
    build_f_reply,
    build_friend_entry,
    build_hiscore_table,
    build_ignore_entry,
    build_lobby_player,
    build_local_player_id,
    build_room_membership,
    build_sb_reply,
    build_social_list_complete,
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
        # Account key this session authenticated as. Set at login; the default
        # only matters for a session that never gets that far.
        self.account_name = config.display_name
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

        # The username slot may hold a RECONNECT ID rather than a packed name.
        # The client stores the player id we issue at login and sends it back
        # here on every reconnect -- and return-to-main-menu reconnects. Decode
        # it as base37 and you get a bogus name (the old hardcoded id 1 decoded
        # to "A"), logging the player into someone else's account mid-session.
        # Resolve a known id back to its account BEFORE authenticating.
        login_name = parsed.credentials.username
        reconnect_as = self.accounts.username_for_player_id(
            parsed.credentials.username_raw
        )
        if reconnect_as is not None:
            print(
                f"[auth] {self.peer} reconnect id={parsed.credentials.username_raw} "
                f"-> account {reconnect_as!r} (slot held an id, not a name)"
            )
            login_name = reconnect_as

        auth = self.accounts.authenticate(login_name, parsed.credentials.password)
        if not auth.ok:
            print(f"[auth] {self.peer} denied username={parsed.credentials.username!r} reason={auth.reason}")
            self._send_login_error(3, "Invalid username or password.")
            return

        self.display_name = auth.display_name or self.config.display_name
        # Remember which ACCOUNT this session belongs to, not just its display
        # name -- the player id must be derived from the account key so the
        # reconnect lookup above finds it again.
        self.account_name = login_name
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
        # Per-account id, NOT config.player_id. The client echoes this back in
        # the username slot on reconnect, so a constant here (it defaulted to 1)
        # makes every reconnecting player resolve to the same wrong account.
        player_id = self.accounts.player_id(self.account_name)
        payload.extend((player_id & 0xFFFFFFFFFFFFFFFF).to_bytes(8, "big"))
        payload.append(0)  # moderator/staff level
        payload.append(0)  # account state byte
        # eh.field_a -- read as a u16 by sn.a (sn.java:675, `de.field_V.e(3)`;
        # e(int) advances field_n by 2 and assembles two bytes, so the width
        # here is correct).
        #
        # This is the Master Challenge gate, and sending 0 kept that button grey
        # no matter how much stamina progress the player had. The render at
        # ke.java:2988 greys item id 2 when `id.field_P < 3 || h.a(false)`, and
        # h.java:232 is `return ph.n(-30146) || eh.field_a <= 0`. So progress is
        # necessary but NOT sufficient -- this field has to be positive too.
        #
        # Every read of eh.field_a in the client is a `> 0` test (f.java:255,
        # jk.java:18, mc.java:900/939/967, qm.java:438, rb.java:338), so it acts
        # as a boolean gate and the magnitude is not known to mean anything.
        # 365 is a plausible "days remaining" and is only chosen for being
        # positive; do not read significance into it.
        payload.extend((365).to_bytes(2, "big"))
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

    def send_local_player_id(self, uid: int) -> None:
        """Frame 10 / mode 23 -- tell the client which roster row is itself.

        DISABLED BY DEFAULT -- THIS PACKET BREAKS RETURN-TO-MAIN-MENU.

        A/B tested against a real client: sending the mode-5 rows alone renders
        the roster AND leaves return-to-main-menu working; adding this packet
        keeps the roster rendering but makes the menu button crash the client
        (client.java:1598, kf.field_I null while am.field_c is still true).

        The packet itself is not malformed -- execution against the client's own
        ke.a handler shows it sets uc.field_g exactly as intended, consuming all
        9 bytes and returning cleanly. So the damage is a downstream consequence
        of uc.field_g being set, not a parse failure, and it is NOT understood.
        Do not re-enable without finding that mechanism first.

        Without this uc.field_g stays at nk.a's -1L sentinel and no row ever
        matches, so the list renders but the client cannot identify the local
        player. Must follow frame 14 and use the same uid as that player's
        build_lobby_player() row.
        """
        self._send_packet(10, build_local_player_id(uid))
        print(f"[game] {self.peer} sent local player id uid={uid}")

    def send_lobby_roster(self, rows: list[tuple[int, str, int, int]]) -> None:
        """Populate the lobby player list -- one frame-10/mode-5 packet per row.

        MUST follow send_lobby_bootstrap(): the roster hashtable ob.field_i is
        allocated by nk.a from the frame-14 branch, so a frame 10 sent first has
        no table to insert into. Verified headless -- with the table absent the
        row is simply dropped.

        One record per packet is the tested shape. ke.a keeps reading records
        until the buffer runs dry and then throws `jb`, which is normal loop
        termination rather than an error, so batching several rows into one
        packet is plausible but UNTESTED -- do not do it without proving it.
        """
        for uid, name, rating, rated_games in rows:
            self._send_packet(10, build_lobby_player(
                uid=uid, name=name, rating=rating, rated_games=rated_games,
            ))
        print(f"[game] {self.peer} sent lobby roster ({len(rows)} row(s))")

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

    def send_winner(self, result_code: int) -> None:
        """Server opcode 69 -- tell THIS session it won.

        Fixed one-byte payload, no length byte. The client stores the byte in
        qc.field_T, sets qc.field_r and pushes the win UI resource.

        Send this only to the winner. The result-code vocabulary is not decoded:
        qc.field_T feeds a text lookup that was never driven (it needs AWT), so
        which byte renders "you win" versus a placement line is unknown. 0 is
        what we send until someone maps it.
        """
        self._send_packet(69, PacketBuilder().u8(result_code).finish())
        print(f"[game] {self.peer} sent winner result={result_code}")

    def send_game_over(self) -> None:
        """Server opcode 60 -- tear the game down.

        Fixed EMPTY payload. Ordering is load-bearing: send the per-player
        results (62 to each loser, 69 to the winner) BEFORE this. Opcode 60
        clears the game state the result packets refer to, so a 60 that arrives
        first strands them.

        The teardown effects (clearing fm.field_b / am.field_c / fa.field_n)
        were read from bytecode, NOT executed -- only the empty framing is
        execution-proven.
        """
        self._send_packet(60)
        print(f"[game] {self.peer} sent game over (60)")

    def send_friend_list(self, friends: list[str]) -> None:
        """Push the friend list as opcode 13 mode-0 entries, then the marker."""
        for name in friends:
            self._send_packet(13, build_friend_entry(name))
        self._send_packet(13, build_social_list_complete())
        print(f"[game] {self.peer} sent friend list ({len(friends)} entries)")

    def send_ignore_list(self, ignored: list[str]) -> None:
        """Push the ignore list as opcode 13 mode-1 entries, then the marker."""
        for name in ignored:
            self._send_packet(13, build_ignore_entry(name))
        self._send_packet(13, build_social_list_complete())
        print(f"[game] {self.peer} sent ignore list ({len(ignored)} entries)")

    def _send_server_message(self, text: str) -> None:
        if self.codec is None:
            raise RuntimeError("packet codec is not initialized")
        packet = self.codec.make_server_message(text)
        with self._send_lock:
            self.sock.sendall(packet)
        print(f"[game] {self.peer} sent server message: {text!r}")

    def _decode_progress_record(self, payload: bytes) -> int | None:
        """Extract the stage index from an opcode-5 progress record, or None.

        Returns None rather than a guess whenever the record does not match the
        measured layout: a mismatch means the framing assumption is wrong, and
        an invented stage would silently unlock (or fail to unlock) content.
        """
        if len(payload) < 3:
            print(f"[prog] {self.peer} record too short: {payload.hex(' ')}")
            return None

        count, field_q = payload[0], payload[1]
        if count != 1:
            # Every measured emission writes a literal 1 (mc.java:21).
            print(
                f"[prog] {self.peer} count={count} != 1 -- layout NOT proven "
                f"for this record: {payload.hex(' ')}"
            )
            return None

        tag = payload[2]
        if tag & 0xC0 == 0x40:
            stage, rest = tag & 0x3F, payload[3:]
        elif tag & 0xC0 == 0xC0:
            if len(payload) < 4:
                print(f"[prog] {self.peer} truncated 2-byte field_r: {payload.hex(' ')}")
                return None
            stage, rest = ((tag & 0x3F) << 8) | payload[3], payload[4:]
        else:
            # Only the 01 and 11 tags were ever produced across the measured
            # range. A 00/10 tag means the encoding is wider than proven, so
            # refuse it instead of decoding it as if the rule held.
            print(
                f"[prog] {self.peer} unknown field_r tag {tag:#04x} -- varint "
                f"rule not proven for this value: {payload.hex(' ')}"
            )
            return None

        ctx = [
            int.from_bytes(rest[o : o + 4], "big", signed=True)
            for o in range(0, min(16, len(rest) - len(rest) % 4), 4)
        ]
        print(
            f"[prog] {self.peer} progress record field_q={field_q} "
            f"stage_index={stage} ctx={ctx[:4]}"
        )
        return stage

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
                # Two forms, separated in _read_opcode_5. The 3-byte `02 00 00`
                # is the saved-value request (oi.a); anything else is a progress
                # record (mc.a), MEASURED as:
                #
                #   [u8 count=1][u8 field_q][varint field_r STAGE INDEX]
                #   [i32 field_p][i32 field_n][i32 field_s][i32 field_t]
                #   [i32 checksum]
                #
                # field_r uses a 2-bit-tagged varint, proven at the boundary:
                #   3 -> 43, 63 -> 7f, 64 -> c0 40, 119 -> c0 77
                # i.e. v < 64 is one byte 0x40|v, else two bytes 0xC000|v.
                if packet.payload[:1] != b"\x02":
                    stage = self._decode_progress_record(packet.payload)
                    if stage is not None:
                        LOBBY.record_progress(self.display_name, stage)
                    continue

                # The request. Its answer becomes sb.field_q[0] via cm.a, which
                # dc.java:371 folds into id.field_P -- the value vk.java:671
                # tests as `>= 3` to enable Master Challenge. Sending a
                # hardcoded 0 here is why that button was always grey.
                progress = LOBBY.progress_for(self.display_name)
                self._send_packet(4, build_sb_reply(progress))
                print(
                    f"[game] {self.peer} opcode 5 saved-value request -> "
                    f"replied progress={progress} (stage {progress + 1}; "
                    f"Master Challenge "
                    f"{'unlocked' if progress >= LOBBY.MASTER_CHALLENGE_STAGE else 'locked'})"
                )
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
                # Opcode 4 has TWO forms. The 23-byte body is an achievement
                # record (`ki`), built by kk.a (kk.java:39) and reached via
                # qc.c -> si.field_e queue -> client.java:537 drain -> ce.a.
                # Layout MEASURED by invoking kk.a on a synthetic ki:
                #
                #   [u8 count][u8 field_v INDEX][u8 field_p]
                #   [i32 field_s][i32 field_r][i32 field_o][i32 field_q]
                #   [i32 checksum]
                #
                # Anything else is the short request form that the dk.a reply
                # below serves; do not decode that as a record.
                if len(packet.payload) == 23:
                    count = packet.payload[0]
                    index = packet.payload[1]
                    field_p = packet.payload[2]
                    ctx = [
                        int.from_bytes(packet.payload[o : o + 4], "big", signed=True)
                        for o in (3, 7, 11, 15)
                    ]
                    checksum = int.from_bytes(packet.payload[19:23], "big")
                    name = (
                        LOBBY.ACHIEVEMENT_NAMES[index]
                        if 0 <= index < len(LOBBY.ACHIEVEMENT_NAMES)
                        else "?"
                    )
                    print(
                        f"[achv] {self.peer} record count={count} "
                        f"index={index} ({name}) field_p={field_p} "
                        f"ctx={ctx} checksum={checksum:#010x}"
                    )
                    if count != 1:
                        # Every observed emission writes a literal 1. A different
                        # count means the framing assumption is wrong; say so
                        # rather than decode the rest as if it held.
                        print(
                            f"[achv] {self.peer}   count != 1 -- layout NOT proven "
                            f"for this record: {packet.payload.hex(' ')}"
                        )
                    else:
                        LOBBY.record_earned_achievement(self.display_name, index)
                    # Do NOT reply. This used to fall through to the dk.a reply
                    # below on the theory that an unanswered record re-drains
                    # forever. That was wrong, and it was the single largest
                    # cause of dropped connections: 11266 of the disconnects in
                    # srv.log occur immediately after "sent opcode 3 (dk.a
                    # path)".
                    #
                    # dk.a pops the pending request queue rc.field_e and calls
                    # si.a(127) / si.a(115) -- a hard disconnect -- when it is
                    # empty (dk.java). A record is not a request, so nothing is
                    # ever pending for it, so the reply always hit that path.
                    # Only the short request form below may be answered.
                    continue

                # The short form is an ACHIEVEMENTS request. Named in the
                # shattered-plans deobfuscation: C2SPacket.a093bo writes
                # [len=1][type=2], and the reference server answers on S2C
                # opcode 3 with a status byte.
                #
                # We used to answer build_f_reply(), a bare status 2 -- which
                # that project names `areAchievementsOffline`. So every request
                # was answered "Achievements system unavailable", and the screen
                # stayed empty regardless of what we had stored.
                earned = LOBBY.achievements_for(self.display_name)
                self._send_packet(3, build_achievements_reply(earned))
                names = ", ".join(
                    LOBBY.ACHIEVEMENT_NAMES[i] for i in earned if 0 <= i < 31
                )
                print(
                    f"[achv] {self.peer} achievements request -> replied "
                    f"status=0 mask={earned} ({names or 'none'})"
                )
                continue

            # Client opcode 7: create/join a game room. Written by fh.a as
            # [7][u8 q][u8 z] -- proven by running the client's own writer.
            #
            # This is a BLOCKING request: ai.a registers a pending `cl` on the
            # oe.I queue keyed by field_q BEFORE sending, so the room stays
            # unfinalized until a reply pops it. Unanswered, it re-drains forever
            # through bd.g like every other unanswered request.
            #
            # The reply's first byte MUST echo `q`. A mismatch is not tolerated:
            # the client calls si.a(122) and drops the connection. Verified with
            # a deliberate mismatch control, so do not "normalise" this to a
            # room id of our own choosing.
            #
            # We answer with an EMPTY room (N=0), which is the proven early-out:
            # it finalizes the room (cl.field_A = true, cl.b()) with no occupant
            # list. Real occupants need the pn.a per-occupant record, which is
            # not reversed -- see build_room_membership.
            # Client opcode 11: LOBBY actions -- this is where create/join room
            # actually arrives. Named from the shattered-plans deobfuscation of
            # the same FunOrb framework (C2SPacket.LobbyAction).
            #
            # This was silently dropped until now. Note opcode 7, which this
            # server has long treated as "create/join a game room", has NEVER
            # been received in any session in srv.log -- in that framework 0x07
            # is RANKING (fixed 2 bytes) and its reply S2C 0x06 is RATINGS, so
            # that handler is misidentified, not merely unused.
            if packet.opcode == 11:
                if not packet.payload:
                    print(f"[lobby] {self.peer} LOBBY action with empty payload")
                    continue
                action = packet.payload[0]
                name = LOBBY_ACTION_NAMES.get(action, "UNKNOWN")
                print(
                    f"[lobby] {self.peer} action={action} ({name}) "
                    f"body={packet.payload[1:].hex(' ') or '<empty>'}"
                )
                # Deliberately no reply yet. The action codes are shared across
                # the framework, but Dekobloko's room payloads are not the same
                # as that game's, and an unsolicited or wrong-shaped reply is
                # exactly what caused the disconnect storm via dk.a. Capture
                # first, answer once the shape is known.
                continue

            if packet.opcode == 7:
                if len(packet.payload) < 2:
                    print(f"[game] {self.peer} opcode 7 too short: {packet.payload!r}")
                    continue
                q, z = packet.payload[0], packet.payload[1]
                self._ensure_lobby_bootstrap("room request (7)")
                self._send_packet(6, build_room_membership(q, 0))
                print(f"[game] {self.peer} opcode 7 q={q} z={z} -> sent opcode 6 empty room")
                continue

            # Client opcode 3 has TWO producers with different framing; the codec
            # disambiguates by peeking the sub-command (see _read_opcode_3).
            #
            #   payload[0] == 0x05  hiscore table request  (wb.a, fixed 6 bytes)
            #   payload[0] == 0x01  achievement record     (fm.a, u8-length body)
            #
            # Both are blocking requests answered on server opcode 2, which is a
            # shared handler (ke.e) discriminated by ITS own leading sub byte:
            # 0 = hiscore table, 1 = achievement ack. Do not cross them.
            if packet.opcode == 3:
                if not packet.payload:
                    print(f"[game] {self.peer} opcode 3 with empty payload")
                    continue

                if packet.payload[0] == 0x05 and len(packet.payload) >= 6:
                    # [05][00][u16 key][u8 rows][u8 vcols]
                    key = int.from_bytes(packet.payload[2:4], "big")
                    rows = packet.payload[4]
                    vcols = packet.payload[5]
                    # Pass the requester: every row renders under the local
                    # player's name (column 0), so the table is theirs.
                    entries = LOBBY.hiscore_rows(
                        key, rows, vcols, player=self.display_name
                    )
                    self._send_packet(2, build_hiscore_table(key, entries, vcols))
                    print(
                        f"[hiscore] {self.peer} request key={key} rows={rows} "
                        f"vcols={vcols} -> sent {len(entries)} entries"
                    )
                    for column, score, values in entries:
                        print(
                            f"[hiscore]   col={column} score={score} values={values}"
                        )
                    if not entries:
                        # Empty is a PROVEN-valid response, so this is not an
                        # error. Scores ARE stored now, so an empty table means
                        # this player has none yet -- most often because they
                        # logged in under a different account than the one the
                        # scores were filed under.
                        print(
                            f"[hiscore]   (no stored scores for "
                            f"{self.display_name!r} yet)"
                        )
                    continue

                if packet.payload[0] == 0x01 and len(packet.payload) >= 3:
                    # The ack must echo the client's own correlation id
                    # (kn.field_u, a u16 at payload[1..3]) VERBATIM. The client
                    # matches acks against its pending queue by that id; an
                    # unmatched ack leaves the record queued and re-draining.
                    # Ack 1:1 and in order.
                    seq = int.from_bytes(packet.payload[1:3], "big")
                    LOBBY.record_achievement(self, packet.payload)
                    self._send_packet(2, build_achievement_ack(seq, 0))
                    print(f"[game] {self.peer} achievement record seq={seq} -> acked")
                    continue

                print(
                    f"[game] {self.peer} opcode 3 unrecognised sub-command "
                    f"{packet.payload[0]:#04x}: {hex_preview(packet.payload, 64)}"
                )
                continue

            # Bare game-control packet. Explicitly ignored so it does not fall
            # through to the text-parsing fallback at the bottom of the loop,
            # which would try to read an empty payload as chat.
            if packet.opcode == 61:
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
            # Reply: server opcode 15, bare (no length byte, no body).
            #
            # The framing is now MEASURED, not a candidate: mk.c is int[256] and
            # index 15 is never written by any iastore in the gamepack, so it is
            # 0 = fixed zero-length. A bare enciphered opcode byte is right.
            #
            # This ack is REQUIRED. It was briefly removed on a theory that its
            # framing desynced the stream; that theory was wrong, and without
            # the ack the client re-sends opcode 10 forever and the
            # return-to-menu button does nothing.
            #
            # NOTE: a real client still NPE'd (client.b(int,boolean), from the
            # client.i tick loop) shortly after a 15 went out. Since the framing
            # is now proven correct, that crash has some OTHER cause and 15 is
            # not it. Leading suspect: the zero-occupant room this server builds
            # in reply to client opcode 7 -- tearing down a room the local
            # player never appeared in. Do not "fix" that by re-guessing this
            # packet again.
            # Client opcode 10. Deliberately a NO-OP: no reply, no state change.
            #
            # This was previously read as "return to main menu" and answered by
            # tearing down lobby state and sending opcode 15. That CRASHED the
            # client, proven by reflection: the NPE is client.java:1598,
            #   kf.field_I.b(2, true)
            # reached with kf.field_I == null while am.field_c is still true.
            # Every other teardown in the client clears am.field_c BEFORE
            # nulling kf.field_I; driving a teardown from here broke that
            # invariant. Reproduced headlessly -- the harness's trap trail
            # `client.O(30661,false)` matches the live crash string exactly.
            #
            # It is also the wrong reading of the button. The ranking/hiscore UI
            # navigates the BROWSER: wb/bh/sm/pk build a codebase-relative URL
            # ("reload.ws", "tosupport.ws", ...) and call
            # AppletContext.showDocument themselves. Those links are constructed
            # client-side and need no server packet at all, so there is nothing
            # for us to answer here.
            #
            # No-reply is safe. An earlier log showed repeated opcode 10s that I
            # mistook for a retry storm; they were interleaved with chat packets,
            # i.e. a user clicking a dead button, not the client re-requesting.
            # Nothing blocks on this opcode.
            if packet.opcode == 10:
                print(f"[game] {self.peer} client requested return to main menu (10)")
                LOBBY.leave_game(self)
                # DO NOT clear _lobby_bootstrapped here.
                #
                # Clearing it made the next lobby entry send frame 14 a SECOND
                # time on the same connection, which re-runs nk.a and
                # reallocates the lobby tables. Observed effect: the first
                # return-to-main-menu works, then re-entering the lobby and
                # leaving again crashes the client at client.java:1598
                # (kf.field_I null while am.field_c is still true).
                #
                # The bootstrap is per-CONNECTION, not per-lobby-visit. The
                # client keeps its lobby state across a menu round trip, so
                # re-bootstrapping is both unnecessary and destructive.
                self._send_packet(15)
                print(f"[game] {self.peer} -> sent opcode 15 return-to-menu ack")
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

            # The social add/remove opcodes (friend add, ignore add, remove) are
            # written by sn.a, which takes the opcode as a runtime menu-action
            # parameter -- there is no literal anywhere in the traced chains, so
            # the NUMBER is still unknown even though the PAYLOAD is proven:
            #
            #   [u64 targetId][cstring name][u8][u8]
            #
            # Log anything matching that shape. One click in a live client turns
            # this into the missing opcode number. Framing is already safe: an
            # unlisted opcode falls back to a u8 length, which is exactly sn.a's
            # framing, so these do NOT desync the stream while unidentified.
            #
            # This check runs BEFORE the text fallback deliberately -- a social
            # add otherwise gets misread as a chat line.
            social = self._match_social_signature(packet.payload)
            if social is not None:
                target_id, name = social
                print(
                    f"[social] {self.peer} UNIDENTIFIED social opcode {packet.opcode} "
                    f"target_id={target_id:#018x} name={name!r} "
                    f"payload={hex_preview(packet.payload, 64)} "
                    f"-- add this opcode to CLIENT_PACKET_LENGTHS as -1 and route it"
                )
                continue

            message = self._try_parse_client_text_packet(packet.payload)
            if message:
                print(f"[chat] {self.peer} {self.display_name}: {message}")
                LOBBY.handle_chat_or_command(self, message)

    def _match_social_signature(self, payload: bytes) -> tuple[int, str] | None:
        """Recognise sn.a's proven wire shape: u64 + cstring + exactly 2 bytes.

        Deliberately strict -- it must not swallow chat. Returns None unless the
        payload is exactly a u64, a NUL-terminated name, and two trailing bytes,
        with a plausible printable name.
        """
        if len(payload) < 11:
            return None
        terminator = payload.find(b"\x00", 8)
        if terminator == -1 or len(payload) - terminator != 3:
            return None
        raw_name = payload[8:terminator]
        if not raw_name or len(raw_name) > 32:
            return None
        try:
            name = raw_name.decode("cp1252")
        except UnicodeDecodeError:
            return None
        if not all(ch.isprintable() for ch in name):
            return None
        return int.from_bytes(payload[:8], "big"), name

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
