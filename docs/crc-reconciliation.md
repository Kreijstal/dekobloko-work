# Making a substituted group pass the client's CRC check

The client validates every group it downloads against the CRC recorded for that
group in its archive's group table. A synthesised replacement never matches, and
the client rejects it with:

```
CRC mismatch - unable to get a valid download. Please check any
firewall/antivirus/filtering software.                          [ Retry ]
```

...then retries forever. In the client log the signal is `net-validate-failed`:

```
[INSTR 745604ms] LE-OUT net-validate-failed archive=6 group=1 ex=RuntimeException
```

Do not read `ASSET ... ok` lines as acceptance — those record successful name
lookups, not successful validation.

## Do not rewrite the recorded CRC

The obvious fix — patch the CRC in the group table to match what we serve — does
not work, and fails destructively.

The CRCs live in a two-level chain:

```
group bytes        -> CRC recorded in archive N's group table  (255/N)
group table 255/N  -> CRC recorded in the master index         (255/255)
```

Patching a group table forces a matching edit to the master index. **The master
index is signed.** The client verifies it, the signature no longer matches the
edited content, and the client dies before the login screen with:

```
Error: null| java.lang.RuntimeException
error_game_crash
```

The server log shows `loaded signed master index (2375b)` on every run — that
line is the warning. The disabled level-1/level-2 code in `js5.py` is kept
behind an early `return` with this reasoning attached, so it is not re-derived.

## Forge the data instead

Run it the other way: make the substitute's CRC equal the value already
recorded. Then nothing signed changes.

CRC32 is affine over GF(2) — `F(x) = F(0) XOR L(x)` with `L` linear — so four
free bytes can be solved to hit any target in **33 CRC computations**, not 2^32.
Brute force is hours; this is instantaneous.

```python
def crc_with(x):                       # data with 4 bytes at `off` set to x
    d = bytearray(data); d[off:off+4] = x.to_bytes(4, "big")
    return zlib.crc32(d) & 0xFFFFFFFF

f0    = crc_with(0)
basis = [crc_with(1 << i) ^ f0 for i in range(32)]
want  = TARGET ^ f0
# Gaussian elimination over GF(2) on (basis[i], 1 << i) rows -> x
```

**Put the four bytes somewhere inert.** The palette is ideal: three `u24`
colours where every value is a legal RGB. Do *not* use pixel data — a forged
palette *index* can point past the end of the palette and crash the sprite
reader.

Applied to archive 6 group 1:

```
before: 33018 bytes crc=0x6f25b31f  target=0xaacfba29
palette at 4102, patching bytes [4105:4109]
solved x=0xd66c3b80 -> crc=0xaacfba29 MATCH
container: comp=0 declaredLen=33013 actualPayload=33013 ok
```

Re-verify the container framing after patching — the declared length must still
equal the actual payload, or the group is malformed in a way the CRC check will
not catch.

## Reference values

Archive 6 group table (`proto=6 version=14 flags=1`):

| group | crc | version | files | name hash |
| --- | --- | --- | --- | --- |
| 0 | `0x6c451246` | 13 | 128 | 0 |
| 1 | `0xaacfba29` | 2 | 4 | `1685905084` |

`1685905084` is Java `"benefits".hashCode()` exactly, confirming the group's
identity. Master index records archive 6 as `crc=0x9a79a313 version=14`.

The CRC covers the **whole container**, header included; the 255/N entries carry
no version trailer. Verified by reproducing the master index's recorded value
from the stored bytes.
