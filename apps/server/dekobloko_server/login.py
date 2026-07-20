from __future__ import annotations

from dataclasses import dataclass
import os

from .crypto import RsaPrivateKey, signed32, u32, xtea_decrypt_dekobloko

_BASE37 = "_abcdefghijklmnopqrstuvwxyz0123456789"


class PacketReader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.pos = 0

    def remaining(self) -> int:
        return len(self.data) - self.pos

    def read_u8(self) -> int:
        if self.pos >= len(self.data):
            raise ValueError("not enough data for u8")
        value = self.data[self.pos]
        self.pos += 1
        return value

    def read_u16(self) -> int:
        return int.from_bytes(self.read_bytes(2), "big")

    def read_u24(self) -> int:
        return int.from_bytes(self.read_bytes(3), "big")

    def read_u32(self) -> int:
        return int.from_bytes(self.read_bytes(4), "big")

    def read_u64(self) -> int:
        return int.from_bytes(self.read_bytes(8), "big")

    def read_i32(self) -> int:
        return int.from_bytes(self.read_bytes(4), "big", signed=True)

    def read_bytes(self, length: int) -> bytes:
        value = self.data[self.pos : self.pos + length]
        if len(value) != length:
            raise ValueError(f"not enough data: wanted {length}, got {len(value)}")
        self.pos += length
        return value

    def read_cstring(self) -> str:
        try:
            end = self.data.index(0, self.pos)
        except ValueError as exc:
            raise ValueError("unterminated string") from exc
        raw = self.data[self.pos : end]
        self.pos = end + 1
        return raw.decode("cp1252", errors="replace")

    def read_nullable_cstring(self) -> str | None:
        if self.pos < len(self.data) and self.data[self.pos] == 0:
            self.pos += 1
            return None
        return self.read_cstring()


@dataclass(frozen=True)
class LoginPrefix:
    client_revision: int
    client_detail: int
    flags: int
    client_string: str
    extra_token: bytes | None


@dataclass(frozen=True)
class LoginCredentials:
    username: str
    password: str
    login_mode: int
    credential_kind: str
    # The RAW u64 from the username slot, before base37 decoding.
    #
    # Needed because that slot does NOT always hold a packed name: on a
    # reconnect the client sends back the player id the server issued at login.
    # Base37-decoding that id produces a bogus "name" (id 1 decodes to "A"),
    # which silently logs the player into a different account. Callers must be
    # able to recognise an issued id before trusting `username`.
    username_raw: int = 0


@dataclass(frozen=True)
class ParsedLogin:
    prefix: LoginPrefix
    rsa_plain: bytes
    xtea_keys: tuple[int, int, int, int]
    xtea_plain_length: int
    client_seed: tuple[int, int, int, int]
    client_seed_signed: tuple[int, int, int, int]
    challenge_seed: int
    challenge_matches: bool
    random_uid: bytes
    credentials: LoginCredentials


def decode_base37(value: int) -> str:
    if value <= 0 or value >= 6_582_952_005_840_035_281 or value % 37 == 0:
        return str(value)
    chars: list[str] = []
    while value:
        value, index = divmod(value, 37)
        char = _BASE37[index]
        if char == "_":
            if chars:
                chars[-1] = chars[-1].upper()
            char = " "
        chars.append(char)
    decoded = "".join(reversed(chars)).strip()
    return decoded[:1].upper() + decoded[1:]


def decode_base38_pair(data: bytes) -> str:
    if len(data) != 14:
        return data.hex()

    def decode_group(value: int, size: int) -> list[str]:
        chars: list[str] = []
        for _ in range(size):
            value, rem = divmod(value, 38)
            if rem == 0:
                chars.append("")
            elif rem == 1:
                chars.append(" ")
            elif 2 <= rem <= 27:
                chars.append(chr(ord("a") + rem - 2))
            else:
                chars.append(chr(ord("0") + rem - 28))
        return chars

    low = int.from_bytes(data[0:7], "big")
    high = int.from_bytes(data[7:14], "big")
    return "".join(decode_group(low, 10) + decode_group(high, 10)).rstrip()


def _parse_credentials(plain: bytes, offset: int, login_mode: int) -> LoginCredentials:
    # Opt-in because this dumps the decrypted login block, which contains
    # credential material. Set DEKOBLOKO_DEBUG_LOGIN=1 only on a local server
    # you own, and turn it off afterwards.
    if os.environ.get("DEKOBLOKO_DEBUG_LOGIN") == "1":
        print(f"[login-debug] plain={len(plain)}B offset={offset} mode={login_mode}")
        print(f"[login-debug]   full : {plain.hex(' ')}")
        print(f"[login-debug]   creds: {plain[offset:].hex(' ')}")
        # Show where a base37-packed name would appear, so a mismatch between
        # "what we read" and "where the name actually is" is visible directly.
        for name in ("a", "hello"):
            packed = 0
            for ch in name:
                packed = packed * 37 + _BASE37.find(ch)
            needle = packed.to_bytes(8, "big")
            found = plain.find(needle.lstrip(b"\x00") or b"\x00")
            print(
                f"[login-debug]   base37({name!r})={packed} "
                f"bytes={needle.hex(' ')} first-seen-at={found}"
            )
        ascii_at = plain.find(b"hello")
        print(f"[login-debug]   literal b'hello' at offset {ascii_at}")

    if offset >= len(plain):
        return LoginCredentials("Player", "", login_mode, "empty")

    # There are two forms in this client family:
    #
    #   1. string/base38: 00, NUL-terminated email/username, 14-byte packed password
    #   2. base37/base38: u64 packed username, 14-byte packed password
    #
    # The packed u64 username often starts with 00 for normal small names, so a leading
    # zero is not enough to identify the string form.  The string form is used for the
    # email-login branch and is only accepted here if it has a plausible NUL-terminated
    # account string followed by the 14-byte password field.  Otherwise we fall back to
    # the u64/base37 form.
    if plain[offset] == 0:
        try:
            reader = PacketReader(plain)
            reader.pos = offset + 1
            username = reader.read_cstring()
            if username and reader.remaining() >= 14 and all(ord(ch) >= 32 for ch in username):
                password = decode_base38_pair(reader.read_bytes(14))
                return LoginCredentials(username, password, login_mode, "string/base38")
        except ValueError:
            pass

    reader = PacketReader(plain)
    reader.pos = offset
    if reader.remaining() >= 22:
        username_long = reader.read_u64()
        password = decode_base38_pair(reader.read_bytes(14))
        return LoginCredentials(
            decode_base37(username_long), password, login_mode, "base37/base38",
            username_raw=username_long,
        )

    return LoginCredentials("Player", plain[offset:].hex(), login_mode, "raw")


def parse_login_body(body: bytes, rsa_key: RsaPrivateKey, expected_challenge: int) -> ParsedLogin:
    outer = PacketReader(body)
    client_revision = outer.read_u32()
    client_detail = outer.read_u64()
    flags = outer.read_u8()
    client_string = outer.read_cstring()
    extra_token = None
    if flags & 0x10:
        marker = outer.read_u8()
        if marker != 0:
            raise ValueError(f"bad optional login token marker {marker}; expected 0")
        extra_token = outer.read_cstring().encode("cp1252", errors="replace")
    prefix = LoginPrefix(client_revision, client_detail, flags, client_string, extra_token)

    rsa_length = outer.read_u16()
    rsa_cipher = outer.read_bytes(rsa_length)
    xtea_cipher = outer.read_bytes(outer.remaining())

    rsa_plain = rsa_key.decrypt_block(rsa_cipher)
    rsa_reader = PacketReader(rsa_plain)
    marker = rsa_reader.read_u8()
    if marker != 10:
        raise ValueError(f"bad RSA marker {marker}; expected 10; clear={rsa_plain.hex(' ')}")

    xtea_keys = tuple(rsa_reader.read_u32() for _ in range(4))
    xtea_plain_length = rsa_reader.read_u16()

    xtea_plain_padded = xtea_decrypt_dekobloko(xtea_cipher, xtea_keys)
    if xtea_plain_length > len(xtea_plain_padded):
        raise ValueError(
            f"XTEA plain length {xtea_plain_length} exceeds decrypted payload length {len(xtea_plain_padded)}"
        )
    xtea_plain = xtea_plain_padded[:xtea_plain_length]

    inner = PacketReader(xtea_plain)
    client_seed = tuple(inner.read_u32() for _ in range(4))
    client_seed_signed = tuple(signed32(value) for value in client_seed)
    challenge_seed = ((client_seed[2] & 0xFFFF_FFFF) << 32) | (client_seed[3] & 0xFFFF_FFFF)
    random_uid = inner.read_bytes(24)
    login_mode = inner.read_u16()
    credentials = _parse_credentials(xtea_plain, inner.pos, login_mode)

    return ParsedLogin(
        prefix=prefix,
        rsa_plain=rsa_plain,
        xtea_keys=tuple(u32(k) for k in xtea_keys),
        xtea_plain_length=xtea_plain_length,
        client_seed=tuple(u32(k) for k in client_seed),
        client_seed_signed=client_seed_signed,
        challenge_seed=challenge_seed,
        challenge_matches=(challenge_seed == (expected_challenge & 0xFFFF_FFFF_FFFF_FFFF)),
        random_uid=random_uid,
        credentials=credentials,
    )
