# Reflective screenshot and click probe

Drives a running FunOrb gamepack without X11: screenshots come from the game's
own pixel array, and a button's action is invoked directly instead of
synthesizing mouse input. The same probe runs against the **original** jar and
a recompiled build, which makes it usable as an A/B oracle.

## Why not X11 / `applet.update()`

* `xdotool` and `import` need a desktop session and capture whatever happens to
  be on screen, including other windows.
* The launcher's `--offscreen` mode calls `applet.update(graphics)`, which
  returns a **blank** frame for these games: the game does not paint through
  the applet, it blits its own back buffer.

## Where the pixels actually are

`ma` (`extends lk`, `implements ImageProducer`) hands the raster to AWT via

```java
field_l.setPixels(0, 0, field_i, field_d, field_j, field_e, 0, field_i);
```

so on `lk`: `field_e` = `int[]` pixels, `field_i` = width, `field_d` = height.

The *live* surface, however, is a static on `bi` — `bi.field_l` in vertigo2.
`ro.field_g` also holds an `lk`, but it reads back all black. Rather than
hard-code either, `dump()` walks every static `int[]` on `bi` and writes the
ones whose pixels actually vary, so the live surface identifies itself.

Field lookup accepts both `field_x` and bare `x` and walks superclasses, so the
same code works on obfuscated original classes and on pipeline output.

## Wrapper.java — the one to use

Runs the real launcher in a thread, finds the live `Applet` through
`Frame.getFrames()`, and borrows its class loader. This matters: booting the
applet standalone (see `ReflectProbe.java`) reaches a raster but never renders,
while the launcher's environment does.

```bash
JDK8=/usr/lib/jvm/java-8-openjdk
LJ=.work/launcher/dekobloko-launcher.jar
$JDK8/bin/javac -cp "$LJ" tools/reflect-probe/Wrapper.java -d /tmp/probe-classes

$JDK8/bin/java -Djava.awt.headless=false -cp "/tmp/probe-classes:$LJ" Wrapper \
  <outDir> <settleMs> <click|noclick> -- \
  --awt real --gamepack <gamepack.jar> --main-class Vertigo2 \
  --trace-file <trace.log>
```

`settleMs` is how long to wait after the applet appears for the game to load
its cache and draw; 45000 was enough for vertigo2. Writes
`before-<field>.png` and, with `click`, `after-<field>.png`.

JDK 8 only — these are applets, and the Applet API is gone from JDK 26. See the
"Applet toolchain caveats" section in the top-level README.

## Finding the live screen — read this before trusting a screen pointer

Three pointers were tried; only the third is reliable.

* `eb.field_d` is declared **`static ob`**, so it can only ever hold the login
  screen. Reading it to identify the current screen reports `ob` forever, which
  silently turns a two-screen probe into one that presses the first screen
  twice. It is still the right handle for pressing the *login* screen's button.
* `n.field_b.field_Z` (the screen manager's `Z`, assigned by `rl.a`) is **null
  at startup** and only populated after a navigation. Reading it before the
  first press yields null and looks like failure.
* Driving the *action* instead of the button avoids the problem entirely:
  `qm`'s "Just play" is exactly `wq.i(0)`, invocable as a static with no screen
  object at all. This is what `callJustPlayAction()` does.

Also note `press()` returning success only means the handler did not throw — it
does **not** mean the visible screen changed. `wrapper.moved1`/`moved2` compare
pixels before and after and are the only evidence that anything happened.

## Driving the button

`invokeJustPlay()` reaches the live screen through `eb.d` (an `ob`), takes the
button from `ob.G`, and invokes `ob`'s `ij` handler
`a(int, d, byte, int, int)` directly. `param2` must keep `(param2 + 63) / 51`
non-zero — `-123` is what the real click path passes. It also reports `ob`'s
`field_N` / `field_R`, which select the action:

```
field_N ? rk.h(-128) : (field_R ? sg.b(81) : oq.a(true))
```

`sg.b(81)` is `n.b.a(false, new qm())` — it navigates to the Jagex account
prompt, which itself carries a "Just play" button. So reaching that prompt is
not on its own proof of the wrong-button bug; compare the original and the
recompiled build with the same probe before concluding anything.

## ReflectProbe.java — standalone, incomplete

Boots the applet itself with a minimal `AppletStub`. Kept because the stub
documents what the game needs at init: the full launcher parameter set
(a missing int parameter fails with `NumberFormatException: null` from `kd.a`)
and `net.alterorb.launcher.Hook` on the classpath, which the patched gamepack
calls for cache redirection. It reaches a raster but never renders a frame, so
prefer `Wrapper.java`.

## Trace.java.instrumentation + instrumentation.patch

Source-level tracer for a recompiled build (it needs recompiling, so it cannot
run against the original). Logs to a file as well as stderr, because the
launcher does not reliably surface the applet's stderr.

To reproduce the instrumented build:

```bash
cp -r /path/to/funorb-decompiled/games/vertigo2 src
cp tools/reflect-probe/Trace.java.instrumentation src/Trace.java
patch -p1 -d src < tools/reflect-probe/instrumentation.patch
```

then compile `src` with JDK 8 and repack over the gamepack. The patch touches
`cr fo ho nd ql` (coordinate reads), `iq qg` (arming and dispatch), and
`d ob` (the two sites that actually mattered).

Instrumentation points that produced useful signal:

* `sa.mousePressed` / `mouseReleased` / `mouseClicked` — the AWT entry, which
  cannot be bypassed; use it to prove the harness works before trusting any
  negative result
* `d.a(int, int, byte, int)` at the `instanceof ij` branch — the real button
  action dispatch, and the only one that names buttons via `iq.field_w`
* `qg` arming and the five `iq` `sh` dispatch sites — **dead code** for menu
  buttons: `ih`/`ij` extend `uf` but never `sh`, so `instanceof sh` is always
  false there. Recorded so the next person does not re-derive it.
