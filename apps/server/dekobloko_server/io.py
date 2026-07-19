from __future__ import annotations

import socket


def read_exact(sock: socket.socket, size: int) -> bytes:
    data = bytearray()
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            raise EOFError(f"socket closed while reading {size} bytes")
        data.extend(chunk)
    return bytes(data)


def read_u8(sock: socket.socket) -> int:
    return read_exact(sock, 1)[0]


def read_u16(sock: socket.socket) -> int:
    return int.from_bytes(read_exact(sock, 2), "big")


def read_i32(sock: socket.socket) -> int:
    return int.from_bytes(read_exact(sock, 4), "big", signed=True)


def write_u8(sock: socket.socket, value: int) -> None:
    sock.sendall(bytes([value & 0xFF]))


def write_u16(sock: socket.socket, value: int) -> None:
    sock.sendall((value & 0xFFFF).to_bytes(2, "big"))


def write_u64(sock: socket.socket, value: int) -> None:
    sock.sendall((value & 0xFFFFFFFFFFFFFFFF).to_bytes(8, "big"))


def hex_preview(data: bytes, limit: int = 32) -> str:
    shown = data[:limit].hex(" ")
    if len(data) > limit:
        return f"{shown} ... ({len(data)} bytes)"
    return f"{shown} ({len(data)} bytes)"
