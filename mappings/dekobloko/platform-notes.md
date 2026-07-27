# DekoBloko platform mapping notes

## Scope and method

This fragment maps the shared FunOrb platform layer in the generated
DekoBloko source. The primary evidence is `games/dekobloko/*.java`.
Shattered Plans was read through the GitHub CLI from
`lexi-lambda/shattered-plans` at `master`; it was not cloned.

Matches were made from inheritance, implemented JDK interfaces, field and
method descriptors, distinctive constants, and method behavior. Names were
accepted only where the DekoBloko class has a direct structural counterpart.
The reference implementation has refactored parts of JS5 and platform task
handling, so ambiguous worker/source/task classes are intentionally absent.

The descriptor keys retain DekoBloko's dummy parameters. For example,
`ag.a(Ljava/awt/Component;I)V` is named `attach` even though its trailing
integer guard is not present in the cleaned Shattered Plans API.

## AWT, canvas, and input

| DekoBloko | Name | Evidence | Shattered Plans path |
| --- | --- | --- | --- |
| `hn` | `JagexBaseApplet` | Extends `Applet`, implements `Runnable`, `FocusListener`, and `WindowListener`; owns the lifecycle, canvas initialization, render synchronization, and shutdown flow. | `src/main/java/funorb/client/JagexBaseApplet.java` |
| `dk` | `ComponentCanvas` | Extends `Canvas`, stores one wrapped `Component`, and forwards `paint` and `update`. | `src/main/java/funorb/awt/ComponentCanvas.java` |
| `ql` | `FullScreenCanvas` | Extends `Canvas`, implements `FocusListener`, stores a `Frame`, and has the repeated full-screen exit operation. | `src/main/java/funorb/awt/FullScreenCanvas.java` |
| `n` | `KeyState` | Implements `KeyListener` and `FocusListener`; its callbacks contain the same key-code translation and focus reset behavior. | `src/main/java/funorb/awt/KeyState.java` |
| `wg` | `MouseState` | Implements `MouseListener`, `MouseMotionListener`, and `FocusListener`; all mouse and focus callbacks correspond. | `src/main/java/funorb/awt/MouseState.java` |
| `ag` | `MouseWheelState` | Implements `MouseWheelListener`; one accumulator is changed by `mouseWheelMoved`, returned and reset by `poll`, and registered by `attach`/`detach`. | `src/main/java/funorb/awt/MouseWheelState.java` |
| `il` | `MouseControlBackend` | Wraps `Robot`; exposes cursor visibility, mouse movement, and custom-cursor operations. | `src/main/java/funorb/awt/MouseControlBackend.java` |
| `vc` | `GraphicsBackend` | Wraps `GraphicsDevice` and `DisplayMode`; enumerates modes and enters/exits full-screen mode. | `src/main/java/funorb/awt/GraphicsBackend.java` |

These identities are high confidence. The listener classes also contain
unrelated static members introduced by the original obfuscation; those members
were not assigned input-oriented names.

## Screen buffers and software graphics

| DekoBloko | Name | Evidence | Shattered Plans path |
| --- | --- | --- | --- |
| `eh` | `ScreenBuffer` | Abstract owner of the pixel array, dimensions, and backing `Image`; `makeGlobal` installs the pixel array into the global drawing context. | `src/main/java/funorb/awt/ScreenBuffer.java` |
| `rj` | `CanvasScreenBuffer` | Concrete `ScreenBuffer` backed by a `DataBufferInt`, `DirectColorModel`, and writable raster. | `src/main/java/funorb/awt/CanvasScreenBuffer.java` |
| `wf` | `ImageProducerScreenBuffer` | Concrete `ScreenBuffer` implementing `ImageProducer` and `ImageObserver`; stores a consumer and color model and pushes full frames. | `src/main/java/funorb/awt/ImageProducerScreenBuffer.java` |
| `hk` | `Drawing` | Large static rasterizer over a global integer pixel array, with clipping bounds and line, rectangle, circle, gradient, blend, and clear operations. | `src/main/java/funorb/graphics/Drawing.java` |
| `ck` | `Sprite` | Integer-pixel sprite with clipping, scaling, rotation, tinting, alpha blending, flipping, and copy operations. | `src/main/java/funorb/graphics/Sprite.java` |
| `ld` | `ArgbSprite` | Final subclass of `ck` whose compositing preserves per-pixel alpha. | `src/main/java/funorb/graphics/ArgbSprite.java` |
| `mm` | `Font` | Abstract font with metrics parsing, kerning, markup, line breaking, measurement, alignment, and abstract glyph drawing. | `src/main/java/funorb/graphics/Font.java` |
| `lm` | `SpriteFont` | Concrete `mm` using monochrome byte glyph masks. | `src/main/java/funorb/graphics/SpriteFont.java` |
| `nj` | `PalettedSpriteFont` | Concrete `mm` using paletted glyph data. | `src/main/java/funorb/graphics/PalettedSpriteFont.java` |
| `lc` | `Symbol` | Abstract symbol type stored by `mm`; `pi` is its paletted implementation. | `src/main/java/funorb/graphics/Symbol.java` |
| `pi` | `PalettedSymbol` | `lc` subclass with a byte index plane and integer palette. | `src/main/java/funorb/graphics/PalettedSymbol.java` |

`hk.a([III)V` is the exact global drawing-buffer initializer. Most other
rasterizer and sprite methods remain unmapped because their dummy parameters
and many same-shaped integer descriptors make a name unsafe without
method-body-level annotation.

## Cache, JS5, containers, and decompression

| DekoBloko | Name | Evidence | Shattered Plans path |
| --- | --- | --- | --- |
| `hf` | `CacheFile` | Wraps `RandomAccessFile`, tracks a maximum length and position, and implements read, write, seek, length, close, and finalization. | `src/main/java/funorb/cache/CacheFile.java` |
| `nh` | `BufferedCacheFile` | Wraps `hf` with logical/physical positions and byte buffers; implements buffered read/write/seek/close. | `src/main/java/funorb/cache/BufferedCacheFile.java` |
| `kh` | `BufferedPageCache` | Owns two `nh` files and implements sector-indexed cache page reads and writes. | `src/main/java/funorb/cache/BufferedPageCache.java` |
| `ad` | `PageIndex` | Parsed JS5 reference table containing group/item indexes, CRCs, Whirlpool hashes, sizes, and resource directories. | `src/main/java/funorb/cache/PageIndex.java` |
| `oc` | `ResourceDirectory` | Integer hash-table representation used by `ad` for group and item name lookup. | `src/main/java/funorb/cache/ResourceDirectory.java` |
| `ji` | `ResourceLoader` | Owns a page loader, `PageIndex`, loaded group objects, and loaded item matrices and exposes named/numeric resource loading. | `src/main/java/funorb/cache/ResourceLoader.java` |
| `mk` | `ByteContainer` | Abstract byte-container base; `fn` provides the direct-buffer implementation. | `src/main/java/funorb/io/ByteContainer.java` |
| `fn` | `DirectByteContainer` | Stores bytes in an allocated direct `ByteBuffer`, with `put` and `toByteArray`. | `src/main/java/funorb/io/DirectByteContainer.java` |
| `wl` | `Buffer` | Mutable byte buffer used throughout JS5 and protocol parsing. | `src/main/java/funorb/io/Buffer.java` |
| `uf` | `CipheredBuffer` | `wl` subclass coupled to `ee` for ISAAC-ciphered protocol bytes. | `src/main/java/funorb/io/CipheredBuffer.java` |
| `ee` | `IsaacCipher` | ISAAC state arrays, accumulator/counter state, generation pass, and next-value operation. | `src/main/java/funorb/util/IsaacCipher.java` |
| `qk` | `DuplexStream` | Runnable socket wrapper with buffered asynchronous output and synchronized input/output/close operations. | `src/main/java/funorb/io/DuplexStream.java` |
| `lf` | `Inflater` | Owns a raw `java.util.zip.Inflater(true)` and inflates from `wl` into a destination byte array. | `src/main/java/funorb/io/Inflater.java` |
| `td` | `Bzip2` | Bzip2 block/Huffman decoder; the constants and 100,000-entry block workspace match. | `src/main/java/funorb/io/Bzip2.java` |
| `vl` | `Bzip2State` | DekoBloko keeps Bzip2's mutable decoder workspace in a separate state object, including the 18,002-entry selector arrays. | `src/main/java/funorb/io/Bzip2.java` |

`Bzip2State` is a DekoBloko structural name rather than a separate Shattered
Plans class: Shattered Plans stores the equivalent fields statically inside
`Bzip2`.

## Timing

| DekoBloko | Name | Evidence | Shattered Plans path |
| --- | --- | --- | --- |
| `ik` | `PseudoMonotonicClock` | Its synchronized `long` method reads `System.currentTimeMillis` and compensates when the wall clock moves backwards. | `src/main/java/funorb/util/PseudoMonotonicClock.java` |

The nano/millisecond frame-clock implementations and the platform task queue
were not mapped in this fragment. Shattered Plans refactored those areas enough
that a name based only on broad `Thread`, `Runnable`, or `nanoTime` usage would
not meet the confidence threshold.

## Intentionally deferred

- JS5 page sources, workers, and master-index orchestration beyond `PageIndex`,
  `ResourceDirectory`, and `ResourceLoader`.
- Platform service/task records around socket, URL, reflection, native library,
  and thread creation.
- Sprite-resource factory methods that the obfuscator distributed among
  otherwise unrelated classes.
- Individual keyboard and mouse global-state fields distributed outside their
  listener classes.
- Dense rasterizer, sprite, and font methods with colliding all-integer
  descriptors.

These should be mapped from complete call families and descriptor-safe
method-body evidence, not from proximity to an already identified class.
