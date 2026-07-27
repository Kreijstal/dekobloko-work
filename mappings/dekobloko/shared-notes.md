# DekoBloko shared infrastructure mapping notes

This fragment covers reusable FunOrb infrastructure that is not specific to
DekoBloko's rules. Local generated Java remains the primary evidence.
Shattered Plans was fetched through `gh api` and used only as a semantic
cross-reference where structure and behavior also match.

## Cross-reference policy

- `funorb.data.NodeList`, `funorb.io.Buffer`,
  `funorb.audio.RawSampleS8`, `funorb.audio.AudioSource`,
  `funorb.audio.SampledAudioChannelS16`,
  `funorb.audio.MidiInstrument`, `funorb.util.PseudoMonotonicClock`, and
  `funorb.commonui.Component` provide named structural references.
- These are not assumed to share obfuscated owner names with DekoBloko.
  Correlation requires matching field types, constructor behavior, method
  effects, and call roles.
- Names are not imported where Shattered Plans has substantially refactored the
  subsystem. This is why most MIDI arrays, audio scheduler counters, packet
  transforms, and component event methods remain unmapped.
- Every included mapping is high confidence.

## Classes

| JVM class | Semantic name | Evidence |
| --- | --- | --- |
| `bh` | `Node` | Owns `prev`, `next`, and a long key; `unlink` splices itself out and nulls both links. This exactly matches the node embedded in Shattered Plans' `NodeList`. |
| `ce` | `Component` | Stores text, tooltip, x/y/width/height, renderer, listener, text layout, and hover state. Its constructors and `pack` behavior match `funorb.commonui.Component`. |
| `dn` | `NanoClock` | Extends the clock abstraction, samples `System.nanoTime`, averages recent deltas, computes sleep time, and advances a fixed tick deadline. |
| `ee` | `IsaacCipher` | Its 256-word state/result arrays and mixing/refill algorithm are ISAAC; `PacketBuffer` subtracts its outputs while reading ciphered bytes. |
| `en` | `AudioChannel` | Owns the integer sample buffer and root `AudioSource`, schedules sources, fills blocks, tracks line capacity, and exposes abstract device open/write/flush/close operations. |
| `jn` | `JavaSoundAudioChannel` | Implements `AudioChannel` with `AudioFormat`, `SourceDataLine`, signed 16-bit conversion, line availability, open, write, flush, and close. |
| `nn` | `MusicController` | Its principal entry point stops the current music stream, creates a new stream from a `ui`, applies volume/fade, attaches it to the mixer, and records the current track. The less specific `Controller` suffix avoids conflating it with Shattered Plans' refactored audio-source `MusicManager`. |
| `ol` | `AudioSource` | Intrusive node with enabled state, raw sample, scheduler priority, next-source link, child traversal, write, and discard operations. This matches Shattered Plans' `AudioSource` contract. |
| `ud` | `RawSampleS8` | Stores sample rate, signed 8-bit PCM bytes, loop start/end, and ping-pong flag. Its resampling method updates precisely those values. |
| `uf` | `PacketBuffer` | Extends `Buffer` with ISAAC-ciphered byte access and bit-positioned reads/writes; it is the inbound and outbound game protocol buffer. |
| `ui` | `MidiInstrument` | Parses per-note tables, owns one `RawSampleS8` reference per note, and lazily resolves samples through a loader. This matches the main structure of Shattered Plans' `MidiInstrument`, though the older format contains additional tables. |
| `vj` | `NodeList` | Sentinel-based intrusive doubly linked list with add-first, add-last, clear, size, removal, and stateful traversal. |
| `wl` | `Buffer` | Owns a byte array and cursor and implements primitive integer, long, byte-array, string, CRC, RSA, and XTEA serialization. It structurally matches `funorb.io.Buffer`. |

## Core collection fields and methods

| JVM symbol | Semantic name | Evidence |
| --- | --- | --- |
| `bh.a:Lbh;` | `prev` | `unlink` assigns `prev.next = next`. |
| `bh.b:Lbh;` | `next` | `unlink` assigns `next.prev = prev`. |
| `bh.i:J` | `key` | Long identity carried by nodes and used by keyed collection/cache users. |
| `bh.a(B)Z` | `isLinked` | Returns whether `prev` is non-null. |
| `bh.b(B)V` | `unlink` | Splices the node out of its list and clears both links. |
| `vj.c:Lbh;` | `sentinel` | Constructor creates this node and points both links back to it; all empty/end checks compare against it. |
| `vj.b:Lbh;` | `iteratorCursor` | Stateful traversal methods update it to the following or preceding node. |
| `vj.a(Lbh;I)V` | `addLast` | Inserts immediately before the sentinel, after the old tail. |
| `vj.b(Lbh;I)V` | `addFirst` | Inserts immediately after the sentinel, before the old head. |
| `vj.a(I)Lbh;` | `removeFirst` | Unlinks and returns `sentinel.next`, or null when empty. |
| `vj.a(B)I` | `size` | Counts links from `sentinel.next` until the sentinel. |
| `vj.b(I)Z` | `isEmpty` | Tests `sentinel.next == sentinel`. |
| `vj.c(I)V` | `clear` | Repeatedly unlinks the first node and clears traversal state. |

The stateful first/next/last/previous traversal overloads remain unnamed because
their obfuscated boolean and byte arguments obscure direction at several call
sites. The underlying list direction is already explicit through `prev` and
`next`.

## Buffer and packet symbols

| JVM symbol | Semantic name | Evidence |
| --- | --- | --- |
| `wl.r:[B` | `data` | Both constructors assign or allocate it; every serializer reads or writes it at the cursor. |
| `wl.n:I` | `position` | Initialized to zero and advanced by every read/write operation. |
| `wl.a(ZI)V` | `writeByte` | Stores one cast byte at `data[position++]`. |
| `wl.d(B)I` | `readUByte` | Returns `data[position++] & 255`. |
| `wl.g(B)B` | `readByte` | Returns the signed byte at `data[position++]`. |
| `wl.e(I)I` | `readUShort` | Advances two bytes and combines them big-endian without sign extension. |
| `wl.i(I)I` | `readInt` | Advances four bytes and combines them big-endian. |
| `wl.f(B)J` | `readLong` | Reads two unsigned 32-bit halves with `readInt` and combines them. |
| `wl.c(B)Ljava/lang/String;` | `readNullTerminatedString` | Scans from the cursor to zero and decodes the intervening CP-1252 bytes. |
| `ee.a(Z)I` | `nextInt` | Refills the ISAAC result array when exhausted and returns the next cipher word. |

Only the base buffer is given primitive method names here. `PacketBuffer`
contains many byte-order/additive transforms and bit-access operations; those
need call-site-specific protocol evidence before renaming.

## Component fields and methods

| JVM symbol | Semantic name | Evidence |
| --- | --- | --- |
| `ce.E:Ljava/lang/String;` | `text` | Text constructor parameter and debug/render content. |
| `ce.B:Ljava/lang/String;` | `tooltip` | Returned only when the pointer is over the component. |
| `ce.u:I` | `left` | First geometry constructor argument and horizontal hit-test/render offset. |
| `ce.D:I` | `top` | Second geometry constructor argument and vertical hit-test/render offset. |
| `ce.t:I` | `width` | Third geometry constructor argument and horizontal bounds. |
| `ce.y:I` | `height` | Fourth geometry constructor argument and vertical bounds. |
| `ce.p:Lgl;` | `renderer` | Constructor-provided strategy queried for preferred width/height and used to draw. |
| `ce.v:Lkg;` | `listener` | Constructor-provided callback/listener object used by component actions. |
| `ce.n:Lcf;` | `textLayout` | Layout/cache object consulted by text and geometry changes. |
| `ce.q:Z` | `mouseOver` | Controls whether `getCurrentTooltip` returns the tooltip and is updated by pointer hit testing. |
| `ce.c(B)Ljava/lang/String;` | `getCurrentTooltip` | Returns `tooltip` when `mouseOver`, otherwise null. |
| `ce.f(I)V` | `pack` | Reapplies bounds using renderer-derived/current preferred geometry, matching the shared component's pack role. |

Component event-dispatch overloads remain unmapped because their decompiled
parameter order contains obfuscation guards and requires a separate UI-focused
call-graph pass.

## Clock symbols

| JVM symbol | Semantic name | Evidence |
| --- | --- | --- |
| `ik.a(I)J` | `currentTimeMillis` | Synchronized wrapper around `System.currentTimeMillis`; accumulates backwards clock movement and returns a nondecreasing adjusted value, exactly like Shattered Plans' `PseudoMonotonicClock.currentTimeMillis`. |
| `dn.a(I)J` | `getSleepMillis` | Updates the averaged nanosecond clock and returns remaining time to the next deadline in milliseconds. |
| `dn.a(BJ)I` | `advance` | Advances the deadline by a fixed nanosecond tick and returns how many ticks, capped at ten, should run to catch up. |
| `dn.b(I)V` | `reset` | Clears accumulated skew and prevents the next deadline from remaining behind the current sample. |

## Audio fields

| JVM symbol | Semantic name | Evidence |
| --- | --- | --- |
| `ud.p:I` | `sampleRate` | Passed as the first sample constructor value and transformed by the resampler's rate conversion. |
| `ud.o:[B` | `samples` | Signed PCM byte array transformed by the resampler. |
| `ud.q:I` | `loopStart` | First loop point; transformed independently unless equal to the end. |
| `ud.s:I` | `loopEnd` | Second loop point; equality and post-resample collision handling match loop boundaries. |
| `ud.r:Z` | `pingPongLoop` | Optional constructor flag retained without numeric transformation. |
| `ui.g:[Lud;` | `noteSamples` | One raw sample slot per parsed MIDI note, filled lazily by the sample loader. |
| `ol.q:Lti;` | `rawSample` | Optional raw-sample metadata used by the audio scheduler. |
| `ol.o:Lol;` | `nextSource` | Temporary scheduler-chain link between audio sources. |
| `ol.n:I` | `lastPriority` | Integer scheduler weight inherited/combined while children are queued. |
| `ol.p:Z` | `enabled` | Selects between processing/writing and discard-only advancement. |
| `en.k:[I` | `sampleBuffer` | Mixed signed fixed-point output block passed to the device writer. |
| `en.o:I` | `sampleRate` | Used to convert 256-sample blocks to elapsed time; Java Sound initializes its `AudioFormat` from it. |
| `en.u:Z` | `stereo` | Selects one or two channels and doubles sample/byte counts. |
| `en.b:Lol;` | `source` | Root source reset, scheduled, and mixed into every output block. |
| `jn.v:Ljavax/sound/sampled/AudioFormat;` | `format` | Constructed from sample rate, 16-bit size, and mono/stereo channel count. |
| `jn.w:Ljavax/sound/sampled/SourceDataLine;` | `line` | Opened through `AudioSystem`, queried for availability, written, flushed, and closed. |
| `jn.y:[B` | `byteBuffer` | Receives clipped 16-bit little-endian samples before `line.write`. |
| `jn.z:I` | `lineBufferSize` | Stores the opened line capacity and is reduced by available samples to compute occupancy. |
| `jn.x:Z` | `reopenAfterFlush` | Set for the SoundMAX workaround; causes flush to close and reopen the line. |

## Audio methods and DekoBloko music assets

| JVM symbol | Semantic name | Evidence |
| --- | --- | --- |
| `ol.a([III)V` | `process` | Dispatches to write or discard depending on `enabled`. |
| `ol.b([III)V` | `processAndWrite` | Abstract source mixing contract. |
| `ol.a(I)V` | `processAndDiscard` | Abstract time-advance-without-output contract. |
| `en.a(Lfd;Ljava/awt/Component;II)Len;` | `create` | Creates a Java Sound channel, initializes its component/format, allocates the sample buffer, and opens the requested capacity. |
| `en.b(Lol;)V` | `setSource` | Synchronized assignment of the root audio source. |
| `en.g()V` | `update` | Main synchronized fill/schedule/write/latency maintenance loop. |
| `en.e()V` | `flush` | Flushes the device and resets latency tracking. |
| `en.a()V` | `shutdown` | Removes the channel from the audio thread and closes/releases its buffers. |
| `jn.a(Ljava/awt/Component;)V` | `initializeFormat` | Detects the SoundMAX workaround, constructs `AudioFormat`, and allocates the byte buffer. |
| `jn.a(I)V` | `openLine` | Opens and starts a `SourceDataLine`, retrying with a power-of-two size where needed. |
| `jn.b()V` | `write` | Clips fixed-point samples, converts them to 16-bit bytes, and writes the line. |
| `jn.c()I` | `bufferedSamples` | Computes capacity minus currently available line samples. |
| `jn.d()V` | `closeLine` | Closes and clears the line. |
| `jn.h()V` | `flushLine` | Flushes the line and optionally reopens it for the SoundMAX workaround. |
| `ge.a(IIBLud;)V` | `playSound` | Delegates a raw PCM sample plus pan/volume-style integer parameters to the sound playback mixer. DekoBloko calls it for drops, matches, powerups, glass, and UI effects. |
| `nn.a(ILui;Z)V` | `playMusic` | Stops the old stream, wraps and attaches the requested music data, applies the requested level, and records the current selection. |
| `sb.u:[[Lui;` | `themeMusic` | Loaded as eight themes by four intensity variants and indexed directly by game theme/intensity. |
| `jg.a:Lui;` | `titleMusic` | Loaded from `music/Deko Bloko Titlescreen` and passed to `playMusic` on title transitions. |
| `hb.Ub:Lui;` | `winMusic` | Loaded from `music/Deko Bloko Game Win`. |
| `rm.b:Lui;` | `loseMusic` | Loaded from `music/Deko Bloko Game Lose`. |
| `rc.d:Lui;` | `currentMusic` | Updated to the requested track after the music-controller swap completes. |

The `ui` type is named from its per-note instrument/sample structure. The exact
older-client relationship between this object, the `ia` playback stream, and
the later Shattered Plans `SongData`/`MidiInstrument` split remains a worthwhile
follow-up; no additional `ui` fields are named until that boundary is traced.
