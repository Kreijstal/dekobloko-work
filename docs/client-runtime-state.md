# Client runtime state: how to inspect a live client

How to attach to a running Dekobloko client and read its actual state, and what
each state variable means.

Verified against both the original gamepack and a freshly built decompiled one;
they agree.

## The state variables

### `ph.field_xb` — the game state (this is the real one)

Holds one of eleven state constants, all of type `um`. Enumerated live from a
running client:

| constant |
|---|
| `ba.field_f` |
| `bh.field_l` |
| `kb.field_c` |
| `kk.field_p` |
| `kl.field_B` |
| `ll.field_a` |
| `nn.field_c` |
| `of.field_a` |
| `rb.field_f` |
| `wf.field_p` |
| `wf.field_u` |

The constants are singleton objects, not ints, so comparing them means
comparing identity. To name the current state, resolve the identity hash of
`ph.field_xb` against every static `um` field in the program — see
*Resolving a state* below.

Assignment sites are in `sn.java` (the packet reader), e.g. `sn.java:591`
`ph.field_xb = bh.field_l;` and `sn.java:596` `ph.field_xb = kk.field_p;`.

### `bh.field_k` — NOT the game state

**This is the inbound packet opcode register.** `sn.java:590` reads a byte off
the network buffer (`var6_int = de.field_V.d(...)`) and the next line stores it
in `bh.field_k`.

It is easy to mistake for a state machine because `client.java` contains a long
if/else chain testing it against 9, 10, 14, 15, and 58–77 — but those are
exactly the opcodes in `SERVER_PACKET_LENGTHS` in the server's `packets.py`.
The chain is packet dispatch, not state transition.

Concretely: observing `bh.field_k == 9` after login does **not** mean "stuck in
state 9". It means the last packet processed was opcode 9, a server message —
expected when the server's final send was a chat/system line.

### Loader stage guards

`client.n(int)` loads resources across five ticks, one stage per call, each
gated on a field that it nulls when that stage is done:

| stage | guard | work |
|---|---|---|
| 1 | `jj.field_c` | sound effects |
| 2 | `wg.field_h` | music |
| 3 | `ph.field_Db` | graphics + lobby UI construction (`mf.a` → `gf.field_c`) |
| 4 | `cl.field_y` | huffman |
| 5 | — | fonts installed (`wf.field_q`), returns 1 |

All four guards null, plus `wf.field_q` and `gf.field_c` non-null, means the
five stages finished. The caller then sets `sh.field_j = true`
(`client.java:529`), which is the authoritative "loading is done" signal.

`vb.field_S` (4), `ii.field_t` (6) and `eg.field_e` (11) stay non-null
regardless — they have no null-assignment site and are read on demand for the
client's whole run. They say nothing about progress. Only `cl.field_y` (3),
`ph.field_Db` (7), `jj.field_c` (8), `ah.field_d` (9) and `wg.field_h` (10) are
nulled on completion.

### `v.field_d` — the menu gate

A completed load does not mean a visible UI. `v.field_d` gates whether the
client renders its real screen or keeps painting the loading screen at 100%; it
is written only by `bd.a()`. Details in
[`loading-and-menu-investigation.md`](loading-and-menu-investigation.md#the-gate-vfield_d).

## Attaching to a live client

JDWP is available but `jdb` proved unreliable here (`-connect
com.sun.jdi.SocketAttachingConnector` is rejected outright; `-attach` connects
but `print` on the obfuscated statics returned nothing). The dependable route
is a JVMTI attach agent that reads statics reflectively.

Launch the client with JDWP anyway — it costs nothing and lets you set
breakpoints if you need them:

```sh
-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:5005
```

### Field names differ between builds

The two builds are ABI-compatible in methods but **not in field names**:

- original gamepack: raw obfuscated names — `bh.k`, `gf.c`, `wf.q`
- decompiled build: renamed with a prefix — `bh.field_k`, `gf.field_c`, `wf.field_q`

Methods are identical in both (same names, parameter types, return types,
modifiers; no synthetic or bridge methods). So an agent that looks up fields by
name works against only one build. Dump *all* static fields by name rather than
requesting specific ones, and you sidestep the mismatch entirely.

### The agent

Two agents are used, both attaching via `com.sun.tools.attach.VirtualMachine`:

1. **State dump** — for a fixed list of interesting classes, print every static
   field as `class.field : Type = value`. Arrays print length and, for
   reference arrays, how many slots are non-null.
2. **State resolution** — scan *every* loaded class for static fields of type
   `um` and print `class.field = um@<identityHash>`, optionally flagging one
   target hash. This is what turns `ph.field_xb = um@1fd67a99` into a name.

Attach with a three-arg helper (`pid`, `agent.jar`, agent args), built against
`$JAVA_HOME/lib/tools.jar`. Working copies live outside the repo under the
session scratch dir; they are ~60 lines each and quicker to rewrite than to
locate. Sketch:

```java
public static void agentmain(String args, Instrumentation inst) throws Exception {
    for (Class<?> c : inst.getAllLoadedClasses()) {
        for (Field f : c.getDeclaredFields()) {
            if (!Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            // ... read f.get(null), print class/field/value
        }
    }
}
```

Manifest needs `Agent-Class:` (not `Premain-Class:`) since this attaches to an
already-running VM.

Find the pid with `jps -l | grep DekoblokoLauncher` — note that the pid printed
by a backgrounded shell launch is the wrapper, not the JVM.

### Resolving a state

```
ph.field_xb = um@1fd67a99      # meaningless on its own
wf.field_u  = um@1fd67a99      # <-- same identity: the state is wf.field_u
```

## Building a decompiled gamepack to run

Compile against the stubs, package with `jar cfM` (no manifest), and patch the
RSA modulus to the server key. Each has a failure mode that looks like something
else — see [`troubleshooting.md`](troubleshooting.md) for the symptoms and the
verification commands.

## Reference observation

Decompiled build against the local server, after login. Note the cache is always
`~/.alterorb/caches/dekobloko/` — the launcher ignores `HOME`, so a client run
with `HOME` pointed elsewhere is still using the real cache:

```
bh.field_k   = 9                 # last opcode = server message (NOT a state)
ph.field_xb  = um@1fd67a99  ==  wf.field_u      # actual state
gf.field_c   = nm@6875bfcc       # lobby object built (stage 3 ran)
wf.field_q   = ni@14920749       # font installed (stage 5 ran)
jj.field_c / wg.field_h / ph.field_Db / cl.field_y = null   # all stages done
```

The five `client.n(int)` stages complete and the client parks in `wf.field_u`,
the normal terminal state of the login handshake. Only two sites gate on it —
`si.java:323` and `wj.java:318`, both `if (ph.field_xb != wf.field_u)`.

`sh.field_j` is true at this point, so loading is complete. The client is
nonetheless on the loading screen, gated on `v.field_d` — see
[`loading-and-menu-investigation.md`](loading-and-menu-investigation.md) for the
outstanding stall.

## Related

- Bootstrap timing and the NPE it used to cause: see the lobby-bootstrap
  section of the local server README (`.work/multiplayer/server-src/README.md`).
- Field renaming matters for differential testing: a harness that reads fields
  by name throws against the original jar, which reads as a behavioural
  divergence.
