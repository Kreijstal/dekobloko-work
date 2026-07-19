from __future__ import annotations

from dataclasses import dataclass, field
import itertools
import random
import threading
import time
from typing import Protocol

from .packets import PacketBuilder, pack_5bit


class LobbySession(Protocol):
    display_name: str
    current_game: "HostedGame | None"
    player_slot: int | None

    def send_server_message(self, message: str) -> None:
        ...

    def send_lobby_bootstrap(self) -> None:
        ...

    def send_match_start(self, game: "HostedGame", local_slot: int) -> None:
        ...

    def send_piece_event(self, player_slot: int, piece: "Piece", speed_index: int) -> None:
        ...

    def send_queued_piece(self, player_slot: int, piece: "Piece") -> None:
        ...

    def send_action_stream(self, player_slot: int, controls_payload: bytes) -> None:
        ...

    def send_player_removed(self, player_slot: int, result_code: int) -> None:
        ...


@dataclass(frozen=True)
class GameOptions:
    bucket_large: bool = False
    speed_index: int = 2
    bombardment_level: int = 1
    colours: int = 4
    special_level: int = 0
    allow_spectators: bool = True
    rated: bool = False
    theme: int = 0

    def settings_word(self) -> int:
        word = self.speed_index & 0xF
        word |= (self.bombardment_level & 0x3) << 4
        word |= (self.colours & 0x7) << 6
        word |= (self.special_level & 0x7) << 9
        if self.bucket_large:
            word |= 0x1000
        if self.allow_spectators:
            word |= 0x2000
        if self.rated:
            word |= 0x8000
        return word & 0xFFFF


@dataclass(frozen=True)
class Piece:
    piece_id: int
    width: int
    height: int
    cells: tuple[int, ...]
    descriptor: int

    def encode_rf(self) -> bytes:
        if len(self.cells) != self.width * self.height:
            raise ValueError("piece cell count does not match piece dimensions")
        return (
            PacketBuilder()
            .varint7(self.piece_id)
            .u8(self.width)
            .u8(self.height)
            .raw(pack_5bit(list(self.cells)))
            .finish()
        )


@dataclass
class HostedGame:
    game_id: int
    host: LobbySession
    options: GameOptions = field(default_factory=GameOptions)
    players: list[LobbySession] = field(default_factory=list)
    state: str = "waiting"
    created_at: float = field(default_factory=time.time)
    piece_counter: int = 0
    rng: random.Random = field(default_factory=random.Random)
    _lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def __post_init__(self) -> None:
        seed = (self.game_id << 32) ^ int(self.created_at * 1000)
        self.rng.seed(seed)
        self.add_player(self.host)

    @property
    def names(self) -> list[str]:
        return [player.display_name for player in self.players]

    def active_mask(self) -> int:
        mask = 0
        for index, _player in enumerate(self.players[:8]):
            mask |= 1 << index
        return mask

    def add_player(self, session: LobbySession) -> int:
        with self._lock:
            if self.state != "waiting":
                raise ValueError("cannot join a game that has already started")
            if session in self.players:
                return self.players.index(session)
            if len(self.players) >= 8:
                raise ValueError("Dekobloko multiplayer supports at most 8 players")
            self.players.append(session)
            slot = len(self.players) - 1
            session.current_game = self
            session.player_slot = slot
            return slot

    def remove_player(self, session: LobbySession) -> None:
        with self._lock:
            if session not in self.players:
                return
            slot = self.players.index(session)
            self.players.remove(session)
            session.current_game = None
            session.player_slot = None
            for index, player in enumerate(self.players):
                player.player_slot = index
            if self.state == "playing":
                self._broadcast_player_removed(slot, 0)

    def start(self) -> None:
        with self._lock:
            if self.state == "playing":
                return
            if not self.players:
                raise ValueError("cannot start a game with no players")
            self.state = "playing"
            players = list(self.players)

        for index, player in enumerate(players):
            player.send_match_start(self, index)

        self.broadcast_message(f"Game {self.game_id} started with {len(players)} player(s).")

        # Send one active piece and one queued piece for every player. Packet 64
        # is BELIEVED to start the currently falling piece and 67 to fill the
        # client's queue -- read off the decompiled client, never observed. No
        # match has ever started, so this loop has never run against a client.
        # If multiplayer is ever reached, expect to debug this from scratch:
        # the piece counts, the ordering, and whether every player should see
        # every other player's pieces are all assumptions.
        for slot, _player in enumerate(players):
            active = self.next_piece()
            queued = self.next_piece()
            self.broadcast_piece_event(slot, active)
            self.broadcast_queued_piece(slot, queued)

    def next_piece(self) -> Piece:
        with self._lock:
            piece_id = self.piece_counter
            self.piece_counter += 1

        colour_count = max(1, min(7, self.options.colours))
        colour_a = self.rng.randrange(colour_count)
        colour_b = self.rng.randrange(colour_count)
        if colour_a == colour_count:
            colour_a = 7
        if colour_b == colour_count:
            colour_b = 7
        descriptor = ((colour_a & 0x7) << 4) | (colour_b & 0x7)

        shape = self.rng.choice(
            [
                (2, 2, (1, 1, 1, 1)),
                (3, 2, (2, 0, 0, 2, 2, 2)),
                (3, 2, (0, 3, 0, 3, 3, 3)),
                (3, 2, (0, 4, 4, 4, 4, 0)),
                (3, 2, (5, 5, 0, 0, 5, 5)),
                (4, 1, (6, 6, 6, 6)),
            ]
        )
        width, height, cells = shape
        remapped = tuple(0 if cell == 0 else 1 + ((cell - 1) % colour_count) for cell in cells)
        return Piece(piece_id=piece_id, width=width, height=height, cells=remapped, descriptor=descriptor)

    def broadcast_message(self, message: str) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_send_message(player, message)

    def broadcast_chat(self, sender: LobbySession, message: str) -> None:
        self.broadcast_message(f"[game {self.game_id}] {sender.display_name}: {message}")

    def broadcast_piece_event(self, player_slot: int, piece: Piece) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_call(lambda p=player: p.send_piece_event(player_slot, piece, self.options.speed_index))

    def broadcast_queued_piece(self, player_slot: int, piece: Piece) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_call(lambda p=player: p.send_queued_piece(player_slot, piece))

    def handle_controls(self, sender: LobbySession, payload: bytes) -> None:
        slot = sender.player_slot
        if slot is None:
            return
        with self._lock:
            players = [player for player in self.players if player is not sender]
        for player in players:
            _safe_call(lambda p=player: p.send_action_stream(slot, payload))

        # GUESSWORK, and the weakest thing in this file. The claim is that
        # packet 60 arrives either after 20 input samples or when the local
        # piece locks, so a short payload means a lock and warrants handing out
        # a new piece. Nothing verifies that: no client has ever sent packet 60
        # to this server. The "< 20" threshold in particular is a heuristic
        # standing in for a lock signal we have not located in the client.
        #
        # If pieces ever duplicate, vanish, or arrive at the wrong time in a
        # real match, suspect this branch first rather than the piece encoding.
        if payload and payload[0] < 20:
            self.broadcast_piece_event(slot, self.next_piece())
            self.broadcast_queued_piece(slot, self.next_piece())

    def handle_piece_request(self, sender: LobbySession) -> None:
        slot = sender.player_slot
        if slot is None:
            return
        self.broadcast_piece_event(slot, self.next_piece())
        self.broadcast_queued_piece(slot, self.next_piece())

    def _broadcast_player_removed(self, slot: int, result_code: int) -> None:
        with self._lock:
            players = list(self.players)
        for player in players:
            _safe_call(lambda p=player: p.send_player_removed(slot, result_code))


class Lobby:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._sessions: set[LobbySession] = set()
        self._games: dict[int, HostedGame] = {}
        self._game_ids = itertools.count(1)

    def join(self, session: LobbySession) -> None:
        """Register the session only. The bootstrap is deliberately NOT sent here.

        client.n(int) loads resources across five ticks and only builds the
        lobby UI in stage 3 (mf.a -> gf.field_c at mf.java:546). Sending the
        bootstrap at login time drives bh.field_k to 14 while the client is
        still on stage 1, so client.i() dereferences the not-yet-built lobby
        object and dies with an NPE at jg.java:169 (gf.field_c.field_Ob).
        See send_bootstrap(), which is gated on the client's heartbeat.
        """
        session.current_game = None
        session.player_slot = None
        with self._lock:
            self._sessions.add(session)
            peers = list(self._sessions)
        for peer in peers:
            if peer is not session:
                _safe_send_message(peer, f"{session.display_name} has joined the lobby.")

    def sessions_snapshot(self) -> list["LobbySession"]:
        """Current lobby sessions, copied under the lock.

        Chat relay iterates this outside the lock, so it must not hand back the
        live set -- a session leaving mid-broadcast would mutate it during
        iteration.
        """
        with self._lock:
            return list(self._sessions)

    def send_bootstrap(self, session: LobbySession) -> None:
        """Send the lobby state once the client reports it is ready.

        Readiness signal: the client only starts emitting opcode 4/5 after its
        resource load completes. That much is supported -- sending earlier
        reliably produced the NPE at jg.java:169.

        Everything else here is unconfirmed. The only observation of this
        function's effect is a client that CRASHED on it; a client has never
        been seen to consume the bootstrap successfully and show a working
        lobby. So the sequence below (bootstrap, then a message, then the game
        list) is a plausible order, not a known-correct one, and the payloads it
        sends are untested. Note also that opcode 5 was recently found to be a
        request rather than a heartbeat, which means the "4/5 heartbeat pair"
        framing this docstring inherited is itself only half right.
        """
        session.send_lobby_bootstrap()
        session.send_server_message("Lobby ready. Type ::help for server commands.")
        self.send_games(session)

    def leave(self, session: LobbySession) -> None:
        self.leave_game(session, announce=False)
        with self._lock:
            existed = session in self._sessions
            self._sessions.discard(session)
            peers = list(self._sessions)
        if existed:
            for peer in peers:
                _safe_send_message(peer, f"{session.display_name} has left the lobby.")

    def broadcast_chat(self, sender: LobbySession, message: str) -> None:
        text = f"{sender.display_name}: {message}"
        with self._lock:
            peers = list(self._sessions)
        for peer in peers:
            _safe_send_message(peer, text)

    def handle_chat_or_command(self, sender: LobbySession, message: str) -> None:
        if message.startswith("::"):
            self._handle_command(sender, message[2:].strip())
            return
        if sender.current_game is not None:
            sender.current_game.broadcast_chat(sender, message)
            return
        self.broadcast_chat(sender, message)

    def handle_lobby_button(self, sender: LobbySession) -> None:
        game = sender.current_game
        if game is None:
            waiting = self._first_waiting_game()
            if waiting is None:
                game = self.create_game(sender)
                sender.send_server_message(f"Created game {game.game_id}. Type ::start to start it.")
            else:
                slot = waiting.add_player(sender)
                waiting.broadcast_message(f"{sender.display_name} joined game {waiting.game_id} as slot {slot}.")
            return
        if game.host is sender and game.state == "waiting":
            game.start()
            return
        if game.state == "playing":
            game.handle_piece_request(sender)
            return
        sender.send_server_message("Only the host can start this game. Type ::leave to leave it.")

    def create_game(self, host: LobbySession) -> HostedGame:
        with self._lock:
            if host.current_game is not None:
                return host.current_game
            game_id = next(self._game_ids)
            game = HostedGame(game_id=game_id, host=host)
            self._games[game_id] = game
        self._broadcast_lobby_status(f"{host.display_name} created game {game_id}.", exclude=host)
        return game

    def join_game(self, session: LobbySession, game_id: int) -> None:
        with self._lock:
            game = self._games.get(game_id)
        if game is None:
            session.send_server_message(f"No game {game_id} exists.")
            return
        if session.current_game is not None and session.current_game is not game:
            self.leave_game(session, announce=False)
        slot = game.add_player(session)
        game.broadcast_message(f"{session.display_name} joined game {game.game_id} as slot {slot}.")

    def leave_game(self, session: LobbySession, announce: bool = True) -> None:
        game = session.current_game
        if game is None:
            return
        was_host = game.host is session
        game.remove_player(session)
        if announce:
            game.broadcast_message(f"{session.display_name} left game {game.game_id}.")
            session.send_server_message(f"Left game {game.game_id}.")
        with self._lock:
            if was_host or not game.players:
                self._games.pop(game.game_id, None)
                for player in list(game.players):
                    player.current_game = None
                    player.player_slot = None
                    _safe_send_message(player, f"Game {game.game_id} closed because the host left.")

    def start_game(self, session: LobbySession) -> None:
        game = session.current_game
        if game is None:
            game = self.create_game(session)
        if game.host is not session:
            session.send_server_message("Only the game host can start the match.")
            return
        game.start()

    def send_games(self, session: LobbySession) -> None:
        with self._lock:
            games = list(self._games.values())
        if not games:
            session.send_server_message("No hosted games. Type ::create to host one.")
            return
        rows = []
        for game in games:
            rows.append(
                f"#{game.game_id} {game.state}, host={game.host.display_name}, "
                f"players={len(game.players)}/8"
            )
        session.send_server_message("Hosted games: " + " | ".join(rows))

    def _handle_command(self, sender: LobbySession, command_line: str) -> None:
        parts = command_line.split()
        command = parts[0].lower() if parts else "help"

        if command in {"help", "?"}:
            sender.send_server_message(
                "Commands: ::create, ::games, ::join <id>, ::start, ::piece, ::leave, ::where"
            )
            return
        if command in {"create", "host"}:
            game = self.create_game(sender)
            sender.send_server_message(f"You are hosting game {game.game_id}. Type ::start to begin.")
            return
        if command in {"games", "list"}:
            self.send_games(sender)
            return
        if command == "join":
            if len(parts) != 2:
                sender.send_server_message("Usage: ::join <game-id>")
                return
            self.join_game(sender, int(parts[1]))
            return
        if command == "start":
            self.start_game(sender)
            return
        if command == "piece":
            game = sender.current_game
            if game is None or game.state != "playing":
                sender.send_server_message("You are not in a running game.")
                return
            game.handle_piece_request(sender)
            return
        if command in {"leave", "quit"}:
            self.leave_game(sender)
            return
        if command == "where":
            game = sender.current_game
            if game is None:
                sender.send_server_message("You are in the lobby.")
            else:
                sender.send_server_message(
                    f"You are in game {game.game_id}, state={game.state}, slot={sender.player_slot}."
                )
            return

        sender.send_server_message(f"Unknown command ::{command}. Type ::help.")

    def _first_waiting_game(self) -> HostedGame | None:
        with self._lock:
            for game in self._games.values():
                if game.state == "waiting" and len(game.players) < 8:
                    return game
        return None

    def _broadcast_lobby_status(self, message: str, exclude: LobbySession | None = None) -> None:
        with self._lock:
            peers = [peer for peer in self._sessions if peer is not exclude]
        for peer in peers:
            if peer.current_game is None:
                _safe_send_message(peer, message)


def _safe_send_message(peer: LobbySession, message: str) -> None:
    try:
        peer.send_server_message(message)
    except OSError:
        peer.current_game = None
        peer.player_slot = None


def _safe_call(callback) -> None:
    try:
        callback()
    except OSError:
        return


LOBBY = Lobby()
