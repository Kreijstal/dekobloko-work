from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import unittest
from urllib.request import urlopen
import zipfile
import zlib

from dekobloko_server.__main__ import make_config
from dekobloko_server.crypto import IsaacCipher
from dekobloko_server.io import read_exact
from dekobloko_server.packets import GamePacket, PacketCodec
from dekobloko_server.tcp import DekoblokoTCPServer
from escapevector_server.__main__ import build_parser, EscapeJs5Session, ServerRuntime
from escapevector_server.prepare import ensure_key, ORIGINAL_MODULUS, prepare_client
from escapevector_server.session import EscapeCodec, EscapeSession, smart
from escapevector_server.store import EscapeStore

ROOT = Path(__file__).resolve().parents[3]
GAMEPACK = Path(os.environ.get("ESCAPE_GAMEPACK", ROOT / ".work/gamepacks/escapevector.jar"))


def record(body: bytes) -> bytes:
    return body + (zlib.crc32(body) & 0xFFFFFFFF).to_bytes(4, "big")


def config(directory: Path):
    args = build_parser().parse_args([])
    args.host = "127.0.0.1"
    args.http_port = args.game_port1 = args.game_port2 = 0
    args.rsa_key_path = directory / "rsa-private.json"
    args.accounts_path = directory / "accounts.json"
    args.jar_path = directory / "escapevector-rsa-client.jar"
    args.cache_dir = directory / "cache"
    return make_config(args)


class CaptureSession(EscapeSession):
    def __init__(self, store, name):
        self.store, self.account_name = store, name
        self.sent = []

    def _send_packet(self, opcode, payload=b""):
        self.sent.append((opcode, payload))


class EscapeServicesTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="escapevector-server-test-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.store = EscapeStore(self.directory / "accounts.json")
        self.store.authenticate("Alice", "one")
        self.session = CaptureSession(self.store, "Alice")

    def send(self, opcode, payload):
        self.session.handle_packet(GamePacket(opcode, payload, False))
        return self.session.sent[-1] if self.session.sent else None

    def test_modes_and_accounts_stay_separate_across_restart(self):
        self.send(5, record(bytes([1, 1]) + smart(2) + bytes(16)))
        self.assertEqual(self.session.sent, [(4, b"\x01\x01\x42")])
        self.assertEqual(self.send(5, b"\x02\0\x01"), (4, b"\0\x01\x03\0\0\0"))
        self.assertEqual(self.send(5, b"\x02\0\0"), (4, bytes(6)))
        self.store.authenticate("Bob", "two")
        restored = EscapeStore(self.store.path)
        self.assertEqual(restored.progress("Alice", 1), 3)
        self.assertEqual(restored.progress("Bob", 1), 0)
        self.assertFalse(restored.authenticate("Alice", "bad").ok)
        self.assertTrue(restored.authenticate("ALICE", "one").ok)
        self.assertEqual(restored.username_for_player_id(restored.player_id("Alice")), "alice")
        self.assertEqual(self.store.path.stat().st_mode & 0o777, 0o600)

    def test_achievement_ack_and_all_eight_bitmap_words(self):
        for index in (0, 37, 255):
            self.assertEqual(self.send(4, record(bytes([1, index, 0]) + bytes(16))), (3, b"\x01"))
        _, reply = self.send(4, b"\x02")
        self.assertEqual(reply[:2], b"\0\x08")
        self.assertEqual(reply[2:6], b"\0\0\0\x01")
        self.assertEqual(reply[6:10], b"\0\0\0\x20")
        self.assertEqual(reply[-4:], b"\x80\0\0\0")

    def test_blob_round_trip_and_crc_ack(self):
        payload = record(b"\x01\x04game")
        self.assertEqual(self.send(6, payload), (5, b"\x01" + payload[-4:]))
        self.assertEqual(self.send(6, b"\0"), (5, record(b"\0\x04game")))
        self.assertEqual(EscapeStore(self.store.path).blob("Alice"), b"game")

    def test_invalid_records_cannot_mutate_state(self):
        before = self.store.path.read_bytes()
        for op, payload in [(4, bytes(23)), (5, record(b"\x01")), (5, record(b"\x01\0\x42")),
                            (6, record(b"\x01")), (6, record(b"\x01\x05hi")),
                            (5, record(b"\x01\0" + smart(16) + bytes(16)))]:
            with self.subTest(op=op, payload=payload), self.assertRaises(ValueError):
                self.send(op, payload)
        self.assertEqual(self.store.path.read_bytes(), before)

    def test_best_scores_and_global_leaderboard_attribution(self):
        self.store.authenticate("Bob", "two")
        self.store.submit_score("Alice", 0, 100)
        self.store.submit_score("Alice", 0, 50)
        self.store.submit_score("Bob", 0, 200)
        self.store.submit_score("Alice", 1, 999)
        self.assertEqual(self.store.leaders(0, 10), [("Bob", 200, "bob"), ("Alice", 100, "alice")])
        opcode, reply = self.send(3, b"\x05\0\0\0\x0a\x01")
        self.assertEqual(opcode, 2)
        self.assertEqual(reply[:10], b"\0\0\0\x02Bob\0\0\x02")
        self.assertEqual(reply[10], 1)  # Bob has his own named column
        self.assertEqual(reply[23], 0)  # Alice is local column 0

    def test_shared_store_serializes_concurrent_account_and_game_updates(self):
        def update(index):
            self.store.authenticate(f"Player{index}", "pass")
            self.store.earn_achievement("Alice", index)
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(update, range(20)))
        restored = EscapeStore(self.store.path)
        self.assertEqual(len(restored.accounts), 21)
        self.assertEqual(restored.achievements("Alice"), list(range(20)))

    def test_fragmented_mixed_framing_keeps_isaac_in_sync(self):
        seed = (1,2,3,4)
        cipher = IsaacCipher(list(seed))
        payloads = [(5, b"\x02\0\x01", False),
                    (5, record(b"\x01\0\x42" + bytes(16)), True),
                    (4, record(b"\x01\x25\0" + bytes(16)), True),
                    (3, b"\x05\0\0\0\x0a\x01", False),
                    (6, b"\0", True), (0, b"", False)]
        stream = bytearray()
        for op, body, variable in payloads:
            stream.append((op + cipher.next()) & 255)
            if variable:
                stream.append(len(body))
            stream.extend(body)

        class FragmentedSocket:
            def recv(self, count):
                chunk = bytes(stream[:min(count, 1)])
                del stream[:len(chunk)]
                return chunk
        codec = EscapeCodec(seed)
        for op, body, _ in payloads:
            packet = codec.read_client_packet(FragmentedSocket())
            self.assertEqual((packet.opcode, packet.payload), (op, body))

    def test_deko_defaults_are_unchanged_and_escape_never_substitutes_deko_art(self):
        from inspect import signature
        from dekobloko_server.game import GameSession
        from dekobloko_server.js5 import Js5Session
        defaults = signature(DekoblokoTCPServer).parameters
        self.assertIs(defaults["session_factory"].default, GameSession)
        self.assertIs(defaults["js5_factory"].default, Js5Session)
        self.assertIs(GameSession.packet_codec, PacketCodec)
        class MissingCache:
            def read(self, archive, group):
                return None
        self.assertIsNone(EscapeJs5Session(None, MissingCache(), "probe")._patched_read(6, 1))


@unittest.skipUnless(GAMEPACK.is_file() and shutil.which("javac") and shutil.which("openssl"),
                     "local original Escape Vector JAR, JDK and OpenSSL required")
class EscapeNativeTest(unittest.TestCase):
    def test_original_client_against_real_server_and_restart(self):
        with tempfile.TemporaryDirectory(prefix="escapevector-native-") as temporary:
            directory = Path(temporary)
            cfg = config(directory)
            cfg.cache_dir.mkdir()
            cache_body = bytes(range(256)) * 5
            cache_container = b"\0" + len(cache_body).to_bytes(4, "big") + cache_body
            (cfg.cache_dir / "255-255.bin").write_bytes(cache_container)
            key = ensure_key(cfg.rsa_key_path)
            self.assertEqual(ensure_key(cfg.rsa_key_path), key)
            original_hash = hashlib.sha256(GAMEPACK.read_bytes()).hexdigest()
            prepare_client(GAMEPACK, cfg.jar_path, key)
            patched = cfg.jar_path.read_bytes()
            prepare_client(GAMEPACK, cfg.jar_path, key)
            self.assertEqual(cfg.jar_path.read_bytes(), patched)
            self.assertEqual(hashlib.sha256(GAMEPACK.read_bytes()).hexdigest(), original_hash)
            with zipfile.ZipFile(cfg.jar_path) as jar:
                constants = jar.read("cf.class")
                self.assertNotIn(ORIGINAL_MODULUS.encode(), constants)
                self.assertIn(str(key.n).encode(), constants)
            classpath = os.pathsep.join([str(GAMEPACK), str(ROOT / "lib/dekobloko-stubs.jar")])
            subprocess.run(["javac", "--release", "8", "-cp", classpath, "-d", str(directory),
                            str(Path(__file__).with_name("EscapeProtocolProbe.java"))], check=True, capture_output=True)
            for restart in (False, True):
                runtime = ServerRuntime(cfg)
                try:
                    runtime.start()
                    http = f"http://127.0.0.1:{runtime.http_server.server_port}"
                    with urlopen(http) as response:
                        self.assertIn(b'EscapeVector.class', response.read())
                    with urlopen(http + "/escapevector-rsa-client.jar") as response:
                        self.assertEqual(response.read(), patched)
                    for index, tcp in enumerate(runtime.tcp_servers):
                        port = tcp.server_address[1]
                        with socket.create_connection(("127.0.0.1", port), timeout=10) as cache_socket:
                            cache_socket.sendall(b"\x0c" + bytes(7) + b"\x0f\0\0\0\x01")
                            self.assertEqual(read_exact(cache_socket, 1), b"\0")
                            cache_socket.sendall(b"\x01\xff\0\0\0\xff")
                            expected = b"\xff\0\0\0\xff\0" + len(cache_body).to_bytes(4, "big") + cache_body
                            # JS5 continues every 512 bytes with a 0xff marker.
                            framed = expected[:512]
                            for offset in range(512, len(expected), 511):
                                framed += b"\xff" + expected[offset:offset + 511]
                            self.assertEqual(read_exact(cache_socket, len(framed)), framed)
                        runtime_classpath = os.pathsep.join([str(directory), str(cfg.jar_path), str(ROOT / "lib/dekobloko-stubs.jar")])
                        args = ["java", "-Djava.awt.headless=true", "-cp", runtime_classpath,
                                "EscapeProtocolProbe", str(port), str(key.n), "Alice" if index == 0 else "Bob"]
                        if restart:
                            args.append("restored")
                            args.append(str(runtime.store.player_id("Alice" if index == 0 else "Bob")))
                        result = subprocess.run(args, capture_output=True, text=True, timeout=60)
                        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                        self.assertIn("EscapeProtocolProbe checks=", result.stdout)
                        print(result.stdout.strip())
                finally:
                    runtime.close()


if __name__ == "__main__":
    unittest.main()
