from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

_U32 = 0xFFFF_FFFF
_DELTA = 0x9E37_79B9
_XTEA_SUM_32 = (_DELTA * 32) & _U32


def u32(value: int) -> int:
    return value & _U32


def signed32(value: int) -> int:
    value &= _U32
    return value - 0x1_0000_0000 if value & 0x8000_0000 else value


def urshift(value: int, bits: int) -> int:
    return (value & _U32) >> bits


@dataclass(frozen=True)
class RsaPrivateKey:
    n: int
    d: int
    e: int = 65537

    @classmethod
    def from_json(cls, path: Path) -> "RsaPrivateKey":
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return cls(n=int(data["n"]), d=int(data["d"]), e=int(data.get("e", 65537)))

    def decrypt_block(self, encrypted: bytes) -> bytes:
        cipher_int = int.from_bytes(encrypted, "big", signed=False)
        plain_int = pow(cipher_int, self.d, self.n)
        if plain_int == 0:
            return b"\x00"
        plain = plain_int.to_bytes((plain_int.bit_length() + 7) // 8, "big")
        while len(plain) > 1 and plain[0] == 0:
            plain = plain[1:]
        return plain


def xtea_decrypt_dekobloko(data: bytes, keys: list[int] | tuple[int, int, int, int]) -> bytes:
    if len(keys) != 4:
        raise ValueError("XTEA requires exactly 4 keys")
    if len(data) % 8 != 0:
        raise ValueError("XTEA payload length must be a multiple of 8")

    key = [u32(k) for k in keys]
    output = bytearray()

    for offset in range(0, len(data), 8):
        v0 = int.from_bytes(data[offset : offset + 4], "big")
        v1 = int.from_bytes(data[offset + 4 : offset + 8], "big")
        total = _XTEA_SUM_32

        for _ in range(32):
            v1 = u32(
                v1
                - (
                    u32(total + key[(total & 0x1BC4) >> 11])
                    ^ u32(v0 + (u32(v0 << 4) ^ urshift(v0, 5)))
                )
            )
            total = u32(total - _DELTA)
            v0 = u32(
                v0
                - (
                    u32(total + key[total & 3])
                    ^ u32((urshift(v1, 5) ^ u32(v1 << 4)) + v1)
                )
            )

        output.extend(v0.to_bytes(4, "big"))
        output.extend(v1.to_bytes(4, "big"))

    return bytes(output)


def xtea_encrypt_dekobloko(data: bytes, keys: list[int] | tuple[int, int, int, int]) -> bytes:
    if len(keys) != 4:
        raise ValueError("XTEA requires exactly 4 keys")
    if len(data) % 8 != 0:
        raise ValueError("XTEA payload length must be a multiple of 8")

    key = [u32(k) for k in keys]
    output = bytearray()

    for offset in range(0, len(data), 8):
        v0 = int.from_bytes(data[offset : offset + 4], "big")
        v1 = int.from_bytes(data[offset + 4 : offset + 8], "big")
        total = 0

        for _ in range(32):
            v0 = u32(
                v0
                + (
                    u32(total + key[total & 3])
                    ^ u32((urshift(v1, 5) ^ u32(v1 << 4)) + v1)
                )
            )
            total = u32(total + _DELTA)
            v1 = u32(
                v1
                + (
                    u32(total + key[(total & 0x1BC4) >> 11])
                    ^ u32(v0 + (u32(v0 << 4) ^ urshift(v0, 5)))
                )
            )

        output.extend(v0.to_bytes(4, "big"))
        output.extend(v1.to_bytes(4, "big"))

    return bytes(output)


class IsaacCipher:
    def __init__(self, seed: list[int] | tuple[int, ...]) -> None:
        self.mem = [0] * 256
        self.results = [0] * 256
        self.a = 0
        self.b = 0
        self.c = 0
        self.count = 0
        for index, value in enumerate(seed[:256]):
            self.results[index] = u32(value)
        self._init()

    def next(self) -> int:
        if self.count == 0:
            self._generate()
            self.count = 256
        self.count -= 1
        return self.results[self.count]

    def _init(self) -> None:
        n3 = n4 = n5 = n6 = n7 = n8 = n9 = n10 = 0x9E37_79B9

        for _ in range(4):
            n8 = u32(n8 ^ u32(n5 << 11))
            n5 = u32(n5 + n6)
            n5 = u32(n5 ^ urshift(n6, 2))
            n4 = u32(n4 + n5)
            n3 = u32(n3 + n8)
            n6 = u32(n6 + n3)
            n6 = u32(n6 ^ u32(n3 << 8))
            n9 = u32(n9 + n6)
            n3 = u32(n3 + n4)
            n3 = u32(n3 ^ urshift(n4, 16))
            n10 = u32(n10 + n3)
            n4 = u32(n4 + n9)
            n4 = u32(n4 ^ u32(n9 << 10))
            n7 = u32(n7 + n4)
            n9 = u32(n9 + n10)
            n9 = u32(n9 ^ urshift(n10, 4))
            n8 = u32(n8 + n9)
            n10 = u32(n10 + n7)
            n10 = u32(n10 ^ u32(n7 << 8))
            n5 = u32(n5 + n10)
            n7 = u32(n7 + n8)
            n7 = u32(n7 ^ urshift(n8, 9))
            n6 = u32(n6 + n7)
            n8 = u32(n8 + n5)

        for offset in range(0, 256, 8):
            n7 = u32(n7 + self.results[offset + 7])
            n3 = u32(n3 + self.results[offset + 3])
            n10 = u32(n10 + self.results[offset + 6])
            n4 = u32(n4 + self.results[offset + 4])
            n9 = u32(n9 + self.results[offset + 5])
            n8 = u32(n8 + self.results[offset])
            n6 = u32(n6 + self.results[offset + 2])
            # b += rsl[i+1] belongs in the add block, before any mixing. Java
            # ee.a(int) does all eight seed adds first, then mixes. Hoisting the
            # b+=c / b^=c>>>2 / e+=b trio above this add is not commutable: both
            # it and b+=c write b with an XOR in between, so a, b and e diverge
            # from the first 8-word block onward.
            n5 = u32(n5 + self.results[offset + 1])
            n8 = u32(n8 ^ u32(n5 << 11))
            n3 = u32(n3 + n8)
            n5 = u32(n5 + n6)
            n5 = u32(n5 ^ urshift(n6, 2))
            n4 = u32(n4 + n5)
            n6 = u32(n6 + n3)
            n6 = u32(n6 ^ u32(n3 << 8))
            n3 = u32(n3 + n4)
            n3 = u32(n3 ^ urshift(n4, 16))
            n10 = u32(n10 + n3)
            n9 = u32(n9 + n6)
            n4 = u32(n4 + n9)
            n4 = u32(n4 ^ u32(n9 << 10))
            n7 = u32(n7 + n4)
            n9 = u32(n9 + n10)
            n9 = u32(n9 ^ urshift(n10, 4))
            n8 = u32(n8 + n9)
            n10 = u32(n10 + n7)
            n10 = u32(n10 ^ u32(n7 << 8))
            n5 = u32(n5 + n10)
            n7 = u32(n7 + n8)
            n7 = u32(n7 ^ urshift(n8, 9))
            n8 = u32(n8 + n5)
            n6 = u32(n6 + n7)

            self.mem[offset] = n8
            self.mem[offset + 1] = n5
            self.mem[offset + 2] = n6
            self.mem[offset + 3] = n3
            self.mem[offset + 4] = n4
            self.mem[offset + 5] = n9
            self.mem[offset + 6] = n10
            self.mem[offset + 7] = n7

        for offset in range(0, 256, 8):
            n7 = u32(n7 + self.mem[offset + 7])
            n3 = u32(n3 + self.mem[offset + 3])
            n8 = u32(n8 + self.mem[offset])
            n9 = u32(n9 + self.mem[offset + 5])
            n10 = u32(n10 + self.mem[offset + 6])
            n4 = u32(n4 + self.mem[offset + 4])
            n6 = u32(n6 + self.mem[offset + 2])
            # Same defect as pass 1: this add must precede the mix. See comment
            # in the seed pass above.
            n5 = u32(n5 + self.mem[offset + 1])
            n8 = u32(n8 ^ u32(n5 << 11))
            n3 = u32(n3 + n8)
            n5 = u32(n5 + n6)
            n5 = u32(n5 ^ urshift(n6, 2))
            n4 = u32(n4 + n5)
            n6 = u32(n6 + n3)
            n6 = u32(n6 ^ u32(n3 << 8))
            n3 = u32(n3 + n4)
            n3 = u32(n3 ^ urshift(n4, 16))
            n9 = u32(n9 + n6)
            n4 = u32(n4 + n9)
            n4 = u32(n4 ^ u32(n9 << 10))
            n7 = u32(n7 + n4)
            n10 = u32(n10 + n3)
            n9 = u32(n9 + n10)
            n9 = u32(n9 ^ urshift(n10, 4))
            n10 = u32(n10 + n7)
            n10 = u32(n10 ^ u32(n7 << 8))
            n8 = u32(n8 + n9)
            n7 = u32(n7 + n8)
            n7 = u32(n7 ^ urshift(n8, 9))
            n5 = u32(n5 + n10)
            n8 = u32(n8 + n5)
            n6 = u32(n6 + n7)

            self.mem[offset] = n8
            self.mem[offset + 1] = n5
            self.mem[offset + 2] = n6
            self.mem[offset + 3] = n3
            self.mem[offset + 4] = n4
            self.mem[offset + 5] = n9
            self.mem[offset + 6] = n10
            self.mem[offset + 7] = n7

        self._generate()
        self.count = 256

    def _generate(self) -> None:
        self.c = u32(self.c + 1)
        self.b = u32(self.b + self.c)

        for i in range(256):
            x = self.mem[i]
            if (i & 2) == 0:
                if (i & 1) == 0:
                    self.a = u32(self.a ^ (self.a << 13))
                else:
                    self.a = u32(self.a ^ urshift(self.a, 6))
            else:
                if (i & 1) == 0:
                    self.a = u32(self.a ^ (self.a << 2))
                else:
                    self.a = u32(self.a ^ urshift(self.a, 16))

            self.a = u32(self.a + self.mem[(i + 128) & 0xFF])
            y = u32(self.mem[(x & 0x3FC) >> 2] + self.a + self.b)
            self.mem[i] = y
            self.b = u32(x + self.mem[(y >> 10) & 0xFF])
            self.results[i] = self.b

# Compatibility aliases used by the game server implementation.
def i32(value: int) -> int:
    return signed32(value)


def read_i32_be(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset:offset + 4], "big", signed=True)


def xtea_decrypt(data: bytes, keys: list[int] | tuple[int, int, int, int]) -> bytes:
    return xtea_decrypt_dekobloko(data, keys)


def xtea_encrypt(data: bytes, keys: list[int] | tuple[int, int, int, int]) -> bytes:
    return xtea_encrypt_dekobloko(data, keys)


def _rsa_load(cls, path: Path) -> RsaPrivateKey:
    return cls.from_json(path)


RsaPrivateKey.load = classmethod(_rsa_load)  # type: ignore[attr-defined]


def _isaac_next_int(self: IsaacCipher) -> int:
    return self.next()


def _isaac_next_byte(self: IsaacCipher) -> int:
    return self.next() & 0xFF


def _isaac_encrypt_opcode(self: IsaacCipher, opcode: int) -> int:
    return (opcode + (self.next() & 0xFF)) & 0xFF


def _isaac_decrypt_opcode(self: IsaacCipher, encoded: int) -> int:
    return (encoded - (self.next() & 0xFF)) & 0xFF


IsaacCipher.next_int = _isaac_next_int  # type: ignore[attr-defined]
IsaacCipher.next_byte = _isaac_next_byte  # type: ignore[attr-defined]
IsaacCipher.encrypt_opcode = _isaac_encrypt_opcode  # type: ignore[attr-defined]
IsaacCipher.decrypt_opcode = _isaac_decrypt_opcode  # type: ignore[attr-defined]
