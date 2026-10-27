"""Patch a local gamepack to a persistent, locally generated RSA key.

No downloads, extracted source trees or binary artifacts in the repository.
Run again with the same input and key to reproduce the exact patched JAR.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import zipfile

from dekobloko_server.crypto import RsaPrivateKey
from .__main__ import build_parser as server_parser

ORIGINAL_MODULUS = "6757747274818513864204534133465045479284128469717186816691454417744823753827902036844748836683348383638677747113757906301249837209713747402067689777172847"


def _der_value(data: bytes, pos: int) -> tuple[int, bytes, int]:
    tag, length = data[pos:pos + 2]
    pos += 2
    if length & 128:
        size = length & 127
        length = int.from_bytes(data[pos:pos + size], "big")
        pos += size
    end = pos + length
    if end > len(data):
        raise ValueError("truncated OpenSSL DER key")
    return tag, data[pos:end], end


def ensure_key(path: Path) -> RsaPrivateKey:
    if not path.exists():
        # The original client's RSA output buffer is only 100 bytes. Preserve
        # its 512-bit wire format rather than overflowing it with modern keys.
        pem = subprocess.run(["openssl", "genrsa", "-traditional", "512"],
                             check=True, capture_output=True).stdout
        der = subprocess.run(["openssl", "rsa", "-traditional", "-outform", "DER"],
                             input=pem, check=True, capture_output=True).stdout
        tag, body, end = _der_value(der, 0)
        if tag != 48 or end != len(der):
            raise ValueError("OpenSSL did not return a PKCS#1 key")
        values, pos = [], 0
        for _ in range(4):
            tag, value, pos = _der_value(body, pos)
            if tag != 2:
                raise ValueError("invalid RSA key integer")
            values.append(int.from_bytes(value, "big"))
        _, n, e, d = values
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            json.dump({"n": str(n), "e": e, "d": str(d)}, handle)
            handle.write("\n")
    return RsaPrivateKey.from_json(path)


def replace_constant(data: bytes, old: bytes, new: bytes) -> tuple[bytes, int]:
    if data[:4] != b"\xca\xfe\xba\xbe":
        raise ValueError("invalid class file")
    count = int.from_bytes(data[8:10], "big")
    out, pos, slot, changed = bytearray(data[:10]), 10, 1, 0
    widths = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4,
              12: 4, 15: 3, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2}
    while slot < count:
        tag = data[pos]
        out.append(tag)
        pos += 1
        if tag == 1:
            size = int.from_bytes(data[pos:pos + 2], "big")
            value = data[pos + 2:pos + 2 + size]
            pos += 2 + size
            if value == old:
                value, changed = new, changed + 1
            out.extend(struct.pack(">H", len(value)))
            out.extend(value)
        else:
            size = widths[tag]
            out.extend(data[pos:pos + size])
            pos += size
            if tag in (5, 6):
                slot += 1
        slot += 1
    out.extend(data[pos:])
    return bytes(out), changed


def prepare_client(source: Path, destination: Path, key: RsaPrivateKey) -> None:
    if key.n.bit_length() != 512 or key.e != 65537:
        raise ValueError("Escape Vector requires a 512-bit local RSA key with exponent 65537")
    if source.resolve() == destination.resolve():
        raise ValueError("output must differ from the original gamepack")
    entries, changes = [], 0
    with zipfile.ZipFile(source) as jar:
        for info in jar.infolist():
            if info.filename.upper().startswith("META-INF/") and info.filename.upper().endswith((".SF", ".RSA", ".DSA", ".EC")):
                continue
            data = jar.read(info)
            if info.filename.endswith(".class"):
                data, changed = replace_constant(data, ORIGINAL_MODULUS.encode(), str(key.n).encode())
                changes += changed
            entries.append((info, data))
    if changes != 1:
        raise ValueError(f"expected one Escape Vector login modulus, found {changes}; use the original JAR")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w") as jar:
        for info, data in entries:
            jar.writestr(info, data)


def main() -> None:
    defaults = server_parser().parse_args([])
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Original local Escape Vector JAR")
    parser.add_argument("--output", type=Path, default=defaults.jar_path)
    parser.add_argument("--rsa-key", type=Path, default=defaults.rsa_key_path)
    args = parser.parse_args()
    key = ensure_key(args.rsa_key)
    prepare_client(args.input, args.output, key)
    print(f"input SHA256  {hashlib.sha256(args.input.read_bytes()).hexdigest()}")
    print(f"output SHA256 {hashlib.sha256(args.output.read_bytes()).hexdigest()}")
    print(f"client: {args.output}; key: {args.rsa_key}")


if __name__ == "__main__":
    main()
