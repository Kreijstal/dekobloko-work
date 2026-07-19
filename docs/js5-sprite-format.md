# JS5 sprite format (archive 6)

Status: **format fully decoded and visually verified.** Every field below was
read out of real cache bytes and cross-checked against the decompiled client.
Confidence is called out per section; the only genuinely open items are five
unresolved file names (see "Name hashes").

Scratch scripts and rendered PNGs live outside the repo, under
`/home/kreijstal/.claude/jobs/720d2707/tmp/sprite/`.

---

## 1. Scope

Archive 6 (`ii.field_t`, loader type `ng.field_l`) holds the UI sprites and the
`tinybloko` bitmap font. It has two groups:

| group | name | files | state |
| --- | --- | --- | --- |
| 0 | *(unnamed, hash 0)* | 128 | present, healthy — 203,987 bytes on disk, 1,240,630 decompressed |
| 1 | `benefits` | 4 | **missing** from every cache we have |

Group 1's four files are named `borders`, `logo`, `price`, `screenshots` — the
FunOrb members/subscription upsell screen. See "Name hashes" for how these were
recovered.

---

## 2. Container framing (verified)

Standard JS5. The server's own `CacheStore.read(archive, group)`
(`dekobloko_server/cache.py`) handles sector chasing; what it returns is the
*container*:

```
u8   compression   0 = none, 1 = bzip2, 2 = gzip
u32  compressedLength
     if compression == 0: <compressedLength> bytes of payload
     else:                u32 uncompressedLength, then the stream
```

For compression 1 the `BZh1` header is stripped and must be prepended before
decompressing. Archive 6 group 0 is compression 2 (gzip).

**CRC check:** the CRC32 in the archive-255 index is computed over the container
*including* the 5-byte header. Verified: computed `0x6c451246` == indexed
`0x6c451246` for archive 6 group 0. This is a good integrity assertion to keep
in any tooling.

### Archive 255 index (verified)

Decompressed, `read(255, 6)` is 832 bytes:

```
u8   protocol        = 6
i32  version         = 14          (present only when protocol >= 6)
u8   flags           = 1           (bit 0 = names present)
u16  groupCount      = 2
u16  groupIdDelta[groupCount]      cumulative -> group ids 0, 1
i32  groupNameHash[groupCount]     (flags & 1)
i32  groupCrc[groupCount]
i32  groupVersion[groupCount]
u16  fileCount[groupCount]         = 128, 4
u16  fileIdDelta[g][fileCount[g]]  cumulative -> 0..127 and 0..3
i32  fileNameHash[g][fileCount[g]] (flags & 1)
```

The parser consumes exactly 832 bytes with no slack, which is itself a decent
correctness signal. Implemented in `parse_idx.py`.

Note the asymmetry: **group 0's own name hash is 0
(unnamed). The resource names are attached to the *files*, not the group.**

---

## 3. Group → files (verified)

A multi-file group carries a trailer describing per-file sizes, possibly split
across several "stripes" (interleaved chunks):

```
... file payload bytes ...
i32  delta[stripe][file]     stripeCount * fileCount entries
u8   stripeCount             very last byte of the group
```

Sizes are **deltas**: within each stripe, `size[s][f] = size[s][f-1] + delta`,
with the running accumulator reset at the start of each stripe. Payload is laid
out stripe-major: all of stripe 0's files in file order, then stripe 1, etc. A
file's content is the concatenation of its slice from every stripe.

Archive 6 group 0: `stripeCount = 3`, `fileCount = 128`, trailer =
`1 + 3*128*4 = 1537` bytes, payload = `1,240,630 - 1,537 = 1,239,093` bytes,
which matches the sum of all 128 reconstructed file sizes exactly.

Implemented in `split.py`. File sizes range from 36 bytes to 459,786.

---

## 4. Sprite-set format (verified)

Implemented by **`eh.a(byte, byte[])`** in the decompiled client. The call chain
from a resource name is:

```
bj.a(112, archive, groupName, fileName)
  -> ji.b(name)              group id by name hash
  -> ji.a(group, name)       file id by name hash
  -> we.a(archive, -126, fileId, groupId)
       -> gb.a(...)          fetches file bytes, calls eh.a
            -> eh.a(b, bytes)    parses into static arrays
       -> de.c(false)        collects them into a ck[]
```

`ck` is the sprite/raster type. `eh.a` is the parser; it writes its results into
static fields on scattered classes (`ec.field_g` = count, `tm.field_a` = widths,
`hc.field_c` = heights, `mb.field_d` = palette, `tc.field_Nb` = indices,
`pd.field_e` = alpha) — an obfuscation artifact, not meaningful structure.

A file is a **sprite *set***: N frames sharing one palette and one canvas size.
Metadata is a trailer at the end; pixel data starts at offset 0.

### Layout

```
offset 0                       pixel blocks, one per sprite, in order
len - 7 - N*8 - (P-1)*3        palette: (P-1) * u24 RGB
len - 7 - N*8                  u16 canvasWidth
                               u16 canvasHeight
                               u8  paletteCount - 1      -> P = value + 1
                               u16 offsetX[N]
                               u16 offsetY[N]
                               u16 width[N]
                               u16 height[N]
len - 2                        u16 spriteCount           -> N
```

Read order at parse time is: `N` from the last 2 bytes first, since every other
trailer offset depends on it.

Each pixel block is:

```
u8   flags
     bit 0: 0 = row-major, 1 = column-major
     bit 1: an 8-bit alpha plane follows, in the same scan order
byte index[width*height]        palette indices
byte alpha[width*height]        only if flags & 2
```

Column-major means the loop is `for x: for y:` while still storing to
`index[y*width + x]`.

### Palette semantics (verified)

- Palette entry **0 is never stored** and is the transparency key. Index 0 in
  the pixel data means "fully transparent"; the stored palette holds `P-1`
  colours for indices `1..P-1`.
- A stored colour of `0x000000` is remapped to **`0x000001`**, so that pure
  black remains drawable and does not collide with the transparency key. This is
  explicit in the client (`if (0 == mb.field_d[i]) mb.field_d[i] = 1;`) and is
  observable in real data: `wildcard` (file 51) has `0x000001` as palette
  entry 1.

### `canvasWidth`/`canvasHeight` vs per-sprite `width`/`height`

Frames are trimmed to their bounding box; `offsetX`/`offsetY` place the trimmed
frame inside the shared canvas. `ui_menu_title` (file 50) is a 395x58 frame at
offset (7,4) on a 409x67 canvas. Zero-sized frames (`0x0`) are legal and appear
as padding in slot-indexed sets — `ui_button_up` has 9 slots of which the first
three are empty.

### Byte-level example: file 29, `explode`, 1743 bytes

Trailer at `1743 - 7 - 6*8 = 1688`:

```
00 12                     canvasWidth  = 18
00 12                     canvasHeight = 18
03                        paletteCount - 1 = 3  -> P = 4
00 04 00 01 00 00 00 00 00 00 00 00    offsetX = 4, 1, 0, 0, 0, 0
00 03 00 01 00 00 00 00 00 00 00 00    offsetY = 3, 1, 0, 0, 0, 0
00 0b 00 10 00 12 00 12 00 12 00 12    width   = 11, 16, 18, 18, 18, 18
00 0b 00 10 00 12 00 12 00 12 00 12    height  = 11, 16, 18, 18, 18, 18
00 06                     spriteCount = 6
```

Palette at `1743 - 7 - 48 - 9 = 1679`, `(4-1)*3 = 9` bytes:

```
b8 3c 16   -> palette[1] = 0xb83c16   dark red
ff b1 35   -> palette[2] = 0xffb135   orange
ff ff ff   -> palette[3] = 0xffffff   white
```

Pixel data from offset 0: `00 00 00 00 01 01 01 01 01 00 ...` — `flags = 0`
(row-major, no alpha plane), then indices: transparent margin, a run of dark
red, and so on.

### Structural validation across the whole archive

For every one of the 128 files:

```
bytesConsumedByPixelBlocks + (P-1)*3 + 7 + N*8 == fileLength
```

**128/128 exact, zero slack.** Since `N`, `P`, and every frame dimension are
read from independent places in the file and the pixel consumption is derived
from the dimensions and per-frame flags, an incorrect format would essentially
never balance this equation 128 times.

### Visual verification

Not just structural — decoded and looked at. Rendered PNGs are in
`/home/kreijstal/.claude/jobs/720d2707/tmp/sprite/png/` (all 128 files, one
contact sheet per file, frames composited on their canvas), plus these
verification montages:

- `verify_main.png` — `ui_lobby_logo` and `ui_menu_title` render as a legible
  "DEKO BLOKO" wordmark; `ui_button_up` as a rounded button.
- `verify_explode.png` — `explode` is a coherent 6-frame explosion, a bright
  core expanding into a burst ring.
- `verify_font.png` — the full `tinybloko` glyph set, legible.

Rendering gotcha worth recording: several sets (`tinybloko`, `pop`) have palette
`[transparent, 0xffffff]`, i.e. pure white on transparent. Composite them onto a
**dark** background or they look like empty images and you will think the
decoder is broken. It cost a cycle here.

---

## 5. The font: `tinybloko` (file 2) — verified

**Same format, no glyph-specific container.** It is an ordinary sprite set that
happens to be indexed by character code:

- 256 slots; 193 non-empty; 94 of the 95 printable ASCII codes 32..126 are
  present (space, code 32, is legitimately `0x0` — an empty frame).
- Canvas 8x15, palette `[transparent, 0xffffff]` — monochrome, recoloured by the
  client at draw time.
- Per-glyph `width`/`height` are the trimmed glyph box; `offsetY` carries the
  baseline placement (e.g. `A` is 4x6 at oy=6, `B` is 4x5 at oy=7). Advance
  width is *not* stored in the sprite set — the client derives it from `width`
  plus its own spacing, so anything reimplementing text layout needs to check
  `t.java` rather than assume.

So: `t.a("tinybloko", ii.field_t, false, "")` wraps a plain sprite set. Any
metrics beyond the frame boxes live in the font class, not in archive 6.

---

## 6. Name hashes

**The hash is the plain Java `String.hashCode`:** `h = h*31 + c`, over the
lowercase name, as a signed 32-bit int.

### What does not work

A previous attempt used `h = h*61 + (c - 32)` and resolved nothing. Two separate
faults, both worth recording:

1. **Wrong algorithm.** `h*61 + (c-32)` matches **0** of the 128 file hashes.
   `h*31 + c` matches 107 of 128 directly from source literals.
2. **Wrong table.** It was applied to the *group* name hashes. Group 0's name
   hash is `0`, so every "hit" was the empty/`" "` string trivially hashing to
   0. The names are on the **file** hash table. Even the correct algorithm would
   have looked like a failure applied there.

### Result

Harvesting all string literals from the decompiled sources and hashing them
resolves 107/128 immediately. The theme sprite blocks have a regular layout
(`<theme>_buckettop` at index *i*, unknowns at *i-1* and *i+1*), which lets the
remaining suffixes be recovered algebraically rather than guessed:

```
h(A + S) = h(A) * 31^len(S) + h(S)   (mod 2^32)
```

Given the same unknown suffix `S` under five known theme prefixes, solving for
`h(S)` at each candidate length and demanding all five agree pins `len(S)`
uniquely — then a meet-in-the-middle search over `[a-z0-9_]^len` recovers the
string. This yielded `tiles` (length 5, searched) and `bucketback` (length 10,
hash known, matched from a short wordlist).

**123/128 file names recovered.** Still unresolved: files **0, 1, 3, 45, 46**
(hashes `0x69b8ee9e`, `0x8332eda3`, `0xa7c6ad97`, `0xfe707cb6`, `0xcd1bb2a4`).
These are isolated — no adjacent regular block to pivot off — so the algebraic
trick does not apply and they would need either a wordlist hit or a longer
search. The full mapping is in `names.json`.

The same method applied to group 1 gives the **four lost files**: `borders`,
`logo`, `price`, `screenshots`, in a group named `benefits`. That naming is a
strong hint about what the placeholder art needs to be — a subscription/upsell
panel, not gameplay assets.

---

## 7. Decoding a named resource end to end

1. `store.read(255, archiveId)` → decompress → parse index → name-hash tables.
2. `h31(name)` → locate group id, then file id within that group.
3. `store.read(archiveId, groupId)` → decompress → container payload.
4. Split by the stripe trailer → per-file bytes.
5. Parse the sprite trailer → `N`, canvas, palette, per-frame boxes.
6. Walk pixel blocks from offset 0, honouring each frame's flags byte.
7. Map index 0 → transparent, index *k* → `palette[k]`, applying the alpha plane
   if `flags & 2`.

`sprite.py` does steps 3–7; `load_archive6()` is the one-call entry point.

---

## 8. Synthesising a valid sprite (for the group 1 placeholders)

Writing the format is meaningfully easier than reading it, because the awkward
parts (stripes, deltas, trimming) all have trivial valid degenerate cases:

- **Sprite set.** Emit `flags = 0` (row-major, no alpha plane) and full-canvas
  frames with `offsetX = offsetY = 0`, `width = canvasWidth`,
  `height = canvasHeight`. Build the palette from the distinct colours used,
  reserving index 0 for transparency and remapping `0x000000` to `0x000001`.
  Then append palette, trailer, and the `u16` count. Cap the palette at 256
  entries — `paletteCount - 1` is a single byte.
- **Group.** Use `stripeCount = 1`. The trailer is then just `fileCount` deltas
  followed by the byte `01`. With one stripe, delta encoding is simply each
  file's size minus the previous file's size.
- **Container.** Compression 0 (uncompressed) is legal and simplest: `00`,
  `u32 length`, payload. The client accepts it; no gzip round-trip needed.
- **Index.** The archive-255 entry for archive 6 must be rewritten: group 1's
  CRC (over the container *including* the 5-byte header) and its version.
  Whether the client validates the CRC on load has **not** been checked here —
  verify before assuming a stale CRC is tolerated. Group 1's file *count* (4) and
  the four file name hashes are already correct in the existing index and should
  be left alone, so the placeholder must contain exactly four files in id order
  0..3 corresponding to `borders`, `logo`, `price`, `screenshots`.

Unverified assumption worth flagging: nothing here has been tested by feeding a
synthesised group back to a running client. The write path above is inferred
from the read path, which is solid, but "the parser accepts it" is not the same
as "the client renders it".

---

## 9. Confidence summary

| Item | Confidence |
| --- | --- |
| Container framing, CRC scope | Verified — CRC reproduces |
| Index layout | Verified — parser consumes exactly 832 bytes |
| Group stripe/delta trailer | Verified — sizes sum exactly, 128 files |
| Sprite trailer fields | Verified — exact byte accounting 128/128 |
| Palette, index 0 transparency, black→`0x000001` | Verified — in client source and in real data |
| Row/column-major flag, alpha plane flag | Verified — client source; images coherent |
| Images decode correctly | Verified — rendered and inspected |
| `tinybloko` uses the same format | Verified — glyph sheet legible |
| Name hash = `h*31 + c` | Verified — 123/128 resolve |
| Group 1 file names | High — 4/4 clean hash matches against real words |
| Font advance-width metrics | **Not established** — not in archive 6 |
| Whether client validates group CRC | **Not checked** |
| Synthesis write path | **Inferred, untested** |
