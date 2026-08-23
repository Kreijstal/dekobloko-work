# dekobloko_server: Python -> JavaScript port

Source of truth: `apps/server/dekobloko_server/*.py` (do not modify).
Target: this directory, CommonJS, **zero npm dependencies**, Node >= 20.

## Non-negotiable conventions

- Binary data is `Buffer`; multi-byte fields big-endian unless the Python code says otherwise.
- 32-bit wraparound (XTEA/ISAAC/CRC): use `Math.imul`, `| 0`, `>>> 0`. Never let doubles silently round.
- Negative/signed handling: mirror Python's struct semantics explicitly (`buf.readInt32BE` etc).
- Threads do not exist. Shared mutable state is fine; ordering follows arrival order of network events plus explicit timers.
- Every module keeps the Python module's public names (camelCased only where both sides agree in tests); when in doubt keep snake_case so diffs against Python are mechanical.
- Every nontrivial function gets a golden-vector test whose expected bytes were produced BY RUNNING THE PYTHON CODE (scripts under test/gen-vectors.py may import dekobloko_server directly).

## Module map (Python -> src/)

io.py->src/io.js, config.py->src/config.js, crypto.py->src/crypto.js,
huffman.py (+huffman-codes.csv)->src/huffman.js, accounts.py->src/accounts.js,
tcp.py->src/tcp.js, cache.py->src/cache.js, js5.py->src/js5.js,
http.py->src/httpServer.js, login.py->src/login.js, packets.py->src/packets.js,
lobby.py->src/lobby.js, engine.py->src/engine.js, game.py->src/game.js,
bots.py->src/bots.js, api.py->src/api.js, __main__.py->src/main.js

## Verification ladder

1. Function-level golden vectors (crypto, huffman, packets encode/decode).
2. Byte-level protocol playback: feed recorded client streams to both servers, diff responses.
3. Ported assertions from apps/server/tests/*.py (engine geometry, clear rule, garbage, tick rate).
4. Live smoke: boot JS server on alternate ports, connect jvm.js guest, reach lobby.
