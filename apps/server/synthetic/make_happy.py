#!/usr/bin/env python3
"""Synthesise archive 6 group 1 ("benefits") as placeholder art.

The real group held the FunOrb subscription upsell panel (borders, logo, price,
screenshots). That service is dead and the data is lost, so the client blocks
forever on the "Loading extra data" screen. This emits a structurally valid
group of four sprite sets carrying original placeholder art -- a smiley -- so
the load can complete.

Format per docs/js5-sprite-format.md section 8 (degenerate-but-legal choices:
one stripe, no compression, full-canvas frames, row-major, no alpha plane).
"""
import struct, zlib, pathlib

OUT = pathlib.Path("/home/kreijstal/.claude/jobs/720d2707/tmp/sprite/gen")

TRANSPARENT = 0          # palette index 0 is the unstored transparency key
FACE, INK, RING = 1, 2, 3
PALETTE = [0xFFCC33, 0x000001, 0xE09A00]   # black remapped to 0x000001


def happy_face(w, h):
    """Index-map of a smiley: filled disc, two eyes, an arc mouth."""
    px = bytearray(w * h)                     # 0 = transparent everywhere
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    r = min(w, h) / 2.0 - 1
    for y in range(h):
        for x in range(w):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= r:
                px[y * w + x] = RING if d > r - max(1.0, r * 0.08) else FACE
    # eyes
    er = max(1, int(r * 0.11))
    for sx in (-0.34, 0.34):
        ex, ey = cx + sx * r, cy - 0.28 * r
        for y in range(int(ey - er - 1), int(ey + er + 2)):
            for x in range(int(ex - er - 1), int(ex + er + 2)):
                if 0 <= x < w and 0 <= y < h and ((x - ex) ** 2 + (y - ey) ** 2) ** 0.5 <= er:
                    px[y * w + x] = INK
    # mouth: lower arc of a circle
    mr, tk = r * 0.60, max(1.0, r * 0.09)
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx, y - cy - 0.06 * r
            if dy <= 0:
                continue
            d = (dx * dx + dy * dy) ** 0.5
            if abs(d - mr) <= tk and dy > 0.30 * mr:
                px[y * w + x] = INK
    return px


def sprite_set(w, h):
    """One frame, full canvas, flags=0 (row-major, no alpha)."""
    out = bytearray()
    out.append(0)                                   # flags
    out.extend(happy_face(w, h))                    # index[w*h]
    for rgb in PALETTE:                             # palette, (P-1) * u24
        out.extend(rgb.to_bytes(3, "big"))
    out.extend(struct.pack(">HHB", w, h, len(PALETTE)))
    out.extend(struct.pack(">H", 0))                # offsetX[0]
    out.extend(struct.pack(">H", 0))                # offsetY[0]
    out.extend(struct.pack(">H", w))                # width[0]
    out.extend(struct.pack(">H", h))                # height[0]
    out.extend(struct.pack(">H", 1))                # spriteCount
    return bytes(out)


# file ids 0..3 must correspond to borders, logo, price, screenshots
FILES = [("borders", 64, 64), ("logo", 128, 64), ("price", 96, 48), ("screenshots", 160, 100)]
blobs = [sprite_set(w, h) for _, w, h in FILES]

# --- group: stripeCount = 1, trailer is per-file size deltas then the count ---
payload = b"".join(blobs)
trailer = bytearray()
prev = 0
for b in blobs:
    trailer.extend(struct.pack(">i", len(b) - prev))
    prev = len(b)
trailer.append(1)                                   # stripeCount
group = payload + bytes(trailer)

# --- container: compression 0, u32 length, payload ---
container = bytes([0]) + struct.pack(">I", len(group)) + group

(OUT / "archive6_group1.bin").write_bytes(container)
for (name, w, h), b in zip(FILES, blobs):
    print(f"  {name:12s} {w}x{h}  {len(b)} bytes")
print(f"group={len(group)}  container={len(container)}  crc={zlib.crc32(container) & 0xFFFFFFFF}")
print("wrote", OUT / "archive6_group1.bin")
