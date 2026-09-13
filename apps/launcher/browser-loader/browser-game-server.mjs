// Browser-local FunOrb JS5 and account server. Wire layouts follow
// dekobloko-work/docs/protocol.md; no external game socket is opened.
const GEOBLOX_LOGIN_MODULUS =
  "11973412243201758229960950560686127507773492912549650743509000901608172722598946199955197779881834924802077886527584849063419486935491686535661281977348827";
const GEOBLOX_LOGIN_PRIVATE_EXPONENT =
  8109553727684203492859097509616488820285484587366737830582381433702848327062763166760854493136782393824062638162497760964400970638269465352157742135950977n;

export { GEOBLOX_LOGIN_MODULUS as LOGIN_MODULUS };
export function createBrowserGameServer({ game, storage = globalThis.localStorage, fetchAsset = globalThis.fetch, diagnostics = {} }) {
function wakeSocketReaders(state) {
  for (const wake of state.waiters.splice(0)) wake();
}

function queueSocketBytes(state, bytes) {
  if (state.closed) return;
  state.chunks.push(bytes);
  state.size += bytes.length;
  wakeSocketReaders(state);
}

function readSocketBytes(state, target, offset, length) {
  let copied = 0;
  while (copied < length && state.size > 0) {
    const chunk = state.chunks[0];
    const take = Math.min(chunk.length, length - copied);
    for (let index = 0; index < take; index += 1) {
      target[offset + copied + index] = (chunk[index] << 24) >> 24;
    }
    state.chunks[0] = chunk.subarray(take);
    if (state.chunks[0].length === 0) state.chunks.shift();
    state.size -= take;
    copied += take;
  }
  return copied;
}

async function waitForSocketBytes(state) {
  while (state.size === 0 && !state.closed && !state.error) {
    await new Promise((resolve) => state.waiters.push(resolve));
  }
  if (state.error) throw state.error;
}

function frameJs5Response(archive, group, container, priority) {
  const unframed = new Uint8Array(5 + container.length);
  unframed[0] = archive;
  unframed[1] = group >>> 24;
  unframed[2] = group >>> 16;
  unframed[3] = group >>> 8;
  unframed[4] = group;
  unframed.set(container, 5);
  if (priority) unframed[5] |= 0x80;
  if (unframed.length <= 512) return unframed;

  const separators = Math.ceil((unframed.length - 512) / 511);
  const framed = new Uint8Array(unframed.length + separators);
  let sourceOffset = 0;
  let targetOffset = 0;
  let blockRemaining = 512;
  while (sourceOffset < unframed.length) {
    const take = Math.min(blockRemaining, unframed.length - sourceOffset);
    framed.set(unframed.subarray(sourceOffset, sourceOffset + take), targetOffset);
    sourceOffset += take;
    targetOffset += take;
    blockRemaining -= take;
    if (blockRemaining === 0 && sourceOffset < unframed.length) {
      framed[targetOffset++] = 0xff;
      blockRemaining = 511;
    }
  }
  return framed;
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte & 0xff);
  return value;
}

function bigIntToBytes(value) {
  if (value === 0n) return new Uint8Array([0]);
  const bytes = [];
  while (value > 0n) {
    bytes.push(Number(value & 255n));
    value >>= 8n;
  }
  return Uint8Array.from(bytes.reverse());
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % modulus;
    base = (base * base) % modulus;
    exponent >>= 1n;
  }
  return result;
}

function readU16(bytes, offset) {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

function readU32(bytes, offset) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  ) >>> 0;
}

function readU64(bytes, offset) {
  return (BigInt(readU32(bytes, offset)) << 32n) |
    BigInt(readU32(bytes, offset + 4));
}

function decodeBase37(value) {
  const alphabet = "_abcdefghijklmnopqrstuvwxyz0123456789";
  const characters = [];
  while (value > 0n) {
    characters.push(alphabet[Number(value % 37n)]);
    value /= 37n;
  }
  return characters.reverse().join("").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function decryptGeobloxXtea(bytes, keys) {
  const output = Uint8Array.from(bytes);
  for (let offset = 0; offset + 7 < output.length; offset += 8) {
    let v0 = readU32(output, offset);
    let v1 = readU32(output, offset + 4);
    let sum = 0xc6ef3720;
    for (let round = 0; round < 32; round += 1) {
      v1 = (v1 - (((sum + keys[(sum & 0x1bc4) >>> 11]) >>> 0) ^
        ((v0 + (((v0 << 4) ^ (v0 >>> 5)) >>> 0)) >>> 0))) >>> 0;
      sum = (sum - 0x9e3779b9) >>> 0;
      v0 = (v0 - (((sum + keys[sum & 3]) >>> 0) ^
        (((((v1 >>> 5) ^ (v1 << 4)) >>> 0) + v1) >>> 0))) >>> 0;
    }
    for (let index = 0; index < 4; index += 1) {
      output[offset + index] = v0 >>> (24 - index * 8);
      output[offset + 4 + index] = v1 >>> (24 - index * 8);
    }
  }
  return output;
}

class GeobloxIsaac {
  constructor(seed) {
    this.mem = new Uint32Array(256);
    this.results = new Uint32Array(256);
    this.a = 0;
    this.b = 0;
    this.c = 0;
    this.count = 0;
    this.results.set(seed.slice(0, 256));
    this.initialize();
  }

  mix(values) {
    let [a, b, c, d, e, f, g, h] = values;
    a ^= b << 11; d = (d + a) >>> 0; b = (b + c) >>> 0;
    b ^= c >>> 2; e = (e + b) >>> 0; c = (c + d) >>> 0;
    c ^= d << 8; f = (f + c) >>> 0; d = (d + e) >>> 0;
    d ^= e >>> 16; g = (g + d) >>> 0; e = (e + f) >>> 0;
    e ^= f << 10; h = (h + e) >>> 0; f = (f + g) >>> 0;
    f ^= g >>> 4; a = (a + f) >>> 0; g = (g + h) >>> 0;
    g ^= h << 8; b = (b + g) >>> 0; h = (h + a) >>> 0;
    h ^= a >>> 9; c = (c + h) >>> 0; a = (a + b) >>> 0;
    return [a >>> 0, b >>> 0, c >>> 0, d >>> 0, e >>> 0, f >>> 0, g >>> 0, h >>> 0];
  }

  initialize() {
    let values = Array(8).fill(0x9e3779b9);
    for (let round = 0; round < 4; round += 1) values = this.mix(values);
    for (let offset = 0; offset < 256; offset += 8) {
      values = values.map((value, index) => (value + this.results[offset + index]) >>> 0);
      values = this.mix(values);
      this.mem.set(values, offset);
    }
    for (let offset = 0; offset < 256; offset += 8) {
      values = values.map((value, index) => (value + this.mem[offset + index]) >>> 0);
      values = this.mix(values);
      this.mem.set(values, offset);
    }
    this.generate();
    this.count = 256;
  }

  generate() {
    this.c = (this.c + 1) >>> 0;
    this.b = (this.b + this.c) >>> 0;
    for (let index = 0; index < 256; index += 1) {
      const x = this.mem[index];
      if ((index & 2) === 0) this.a ^= (index & 1) === 0 ? this.a << 13 : this.a >>> 6;
      else this.a ^= (index & 1) === 0 ? this.a << 2 : this.a >>> 16;
      this.a = (this.a + this.mem[(index + 128) & 255]) >>> 0;
      const y = (this.mem[(x & 0x3fc) >>> 2] + this.a + this.b) >>> 0;
      this.mem[index] = y;
      this.b = (x + this.mem[(y >>> 10) & 255]) >>> 0;
      this.results[index] = this.b;
    }
  }

  next() {
    if (this.count === 0) {
      this.generate();
      this.count = 256;
    }
    return this.results[--this.count] >>> 0;
  }
}

function frameAccountPacket(state, opcode, payload) {
  const lengths = { 0: 0, 1: 16, 2: -2, 3: -1, 4: -1, 5: -1, 6: -2, 7: -1, 8: -2, 9: -1, 10: -1, 11: -1, 12: -1, 13: -1, 14: 0, 15: 0, 16: -1, 17: -1, 18: 1 };
  const framing = lengths[opcode] ?? (payload.length ? -1 : 0);
  const bytes = [(opcode + state.outboundIsaac.next()) & 255];
  if (framing === -1) bytes.push(payload.length & 255);
  if (framing === -2) bytes.push(payload.length >>> 8, payload.length & 255);
  bytes.push(...payload);
  queueSocketBytes(state, Uint8Array.from(bytes));
}

function embeddedAccountData(state) {
  const account = state.accountName || "Browser Player";
  const key = `funorb.account.${game.internalName}.${account.toLowerCase()}`;
  try {
    return JSON.parse(storage.getItem(key) || (game.internalName === "geoblox" ? storage.getItem(`geoblox.account.data.${account.toLowerCase()}`) : null)) || {};
  } catch {
    return {};
  }
}

function saveEmbeddedAccountData(state, data) {
  const account = state.accountName || "Browser Player";
  storage.setItem(
    `funorb.account.${game.internalName}.${account.toLowerCase()}`,
    JSON.stringify(data),
  );
}

function handleEmbeddedAccountPacket(state, opcode, payload) {
  if (opcode === 0) { frameAccountPacket(state, 0, []); return; }
  const data = embeddedAccountData(state);
  data.achievements ??= [];
  data.scores ??= [];
  if (opcode === 4) {
    if (payload.length === 23 && payload[0] === 1) {
      if (!data.achievements.includes(payload[1])) data.achievements.push(payload[1]);
      data.achievements.sort((a, b) => a - b);
      saveEmbeddedAccountData(state, data);
      return;
    }
    saveEmbeddedAccountData(state, data);
    const masks = new Int32Array(Math.max(1, Math.ceil((Math.min(255, Math.max(-1, ...data.achievements)) + 1) / 32)));
    for (const index of data.achievements) if (index >= 0 && index < 256) masks[index >>> 5] |= 1 << (index & 31);
    const reply = [0, masks.length];
    for (const mask of masks) reply.push(mask >>> 24, mask >>> 16, mask >>> 8, mask);
    frameAccountPacket(state, 3, reply);
    return;
  }
  if (opcode === 3 && payload[0] === 5 && payload.length >= 6) {
    const key = readU16(payload, 2);
    const rows = payload[4];
    const valueColumns = payload[5];
    const result = [0, key >>> 8, key, 1];
    // Submission ids acknowledge a record; they are not leaderboard keys.
    const scores = data.scores.slice().sort((a, b) => b.score - a.score).slice(0, rows);
    result.push(scores.length);
    for (const entry of scores) {
      const score = Math.max(0, Number(entry.score) || 0);
      result.push(0);
      let bigScore = BigInt(score);
      for (let shift = 56n; shift >= 0n; shift -= 8n) result.push(Number(bigScore >> shift) & 255);
      for (let column = 0; column < valueColumns; column += 1) {
        const raw = Number(entry.values?.[column] ?? (column === 0 ? entry.raw : 0)) || 0;
        result.push(raw >>> 24, raw >>> 16, raw >>> 8, raw);
      }
    }
    frameAccountPacket(state, 2, result);
    return;
  }
  if (opcode === 3 && payload[0] === 1 && payload.length >= 3) {
    const key = readU16(payload, 1);
    const variant = readU16(payload, 3);
    const count = payload[23];
    if (count > 0 && payload.length >= 28 + count * 4) {
      const raw = readU32(payload, 24);
      const score = variant === 1 ? raw >>> 8 : variant === 0 ? Math.floor(raw / 8) : 0;
      if (score >= 0) {
        const values = [];
        for (let i = 0; i < count && 28 + i * 4 <= payload.length; i++) values.push(readU32(payload, 24 + i * 4));
        data.scores.unshift({ key, variant, score: ["geoblox", "dekobloko"].includes(game.internalName) ? score : raw, raw, values, savedAt: Date.now() });
        data.scores = data.scores.slice(0, 100);
        saveEmbeddedAccountData(state, data);
      }
    }
    frameAccountPacket(state, 2, [1, key >>> 8, key, 0, 0, 0, 0, 0, 0, 0, 0]);
    return;
  }
  if (opcode === 5 && payload[0] === 1 && payload.length >= 3) {
    const tag = payload[2];
    const stage = (tag & 0xc0) === 0x40 ? tag & 63
      : (tag & 0xc0) === 0xc0 && payload.length >= 4 ? ((tag & 63) << 8) | payload[3] : null;
    if (stage !== null) { data.progress = Math.max(Number(data.progress) || 0, stage); saveEmbeddedAccountData(state, data); }
    return;
  }
  if (opcode === 5 && payload[0] === 2) {
    const progress = Number(data.progress) || 0;
    const discriminator = payload[2] || 0;
    frameAccountPacket(state, 4, [discriminator, 0, progress, 0, 0, 0]);
  }
}

function processEmbeddedAccountPackets(state) {
  const fixedLengths = new Map([[0, 0], [1, 0], [7, 2], [9, 0], [10, 0], [17, 0], [58, 0], [59, 1], [61, 0], [62, 0], [63, 0]]);
  while (state.outgoing.length > 0) {
    const pending = state.pendingAccountPacket;
    const decodedOpcode = pending?.decodedOpcode ??
      ((state.outgoing[0] - (state.inboundIsaac.next() & 255)) & 255);
    let header = 1;
    let length;
    if (decodedOpcode === 3) {
      if (state.outgoing.length < 2) {
        state.pendingAccountPacket = { decodedOpcode };
        return;
      }
      length = state.outgoing[1] === 5 ? 6 : state.outgoing[1];
      header = state.outgoing[1] === 5 ? 1 : 2;
    } else if (decodedOpcode === 5) {
      if (state.outgoing.length < 2) {
        state.pendingAccountPacket = { decodedOpcode };
        return;
      }
      length = state.outgoing[1] === 2 ? 3 : state.outgoing[1];
      header = state.outgoing[1] === 2 ? 1 : 2;
    } else if (fixedLengths.has(decodedOpcode)) {
      length = fixedLengths.get(decodedOpcode);
    } else {
      if (state.outgoing.length < 2) {
        state.pendingAccountPacket = { decodedOpcode };
        return;
      }
      length = state.outgoing[1];
      header = 2;
    }
    if (state.outgoing.length < header + length) {
      state.pendingAccountPacket = { decodedOpcode, header, length };
      return;
    }
    state.pendingAccountPacket = null;
    state.outgoing.shift();
    if (header === 2) state.outgoing.shift();
    const payload = Uint8Array.from(state.outgoing.splice(0, length));
    handleEmbeddedAccountPacket(state, decodedOpcode, payload);
  }
}

function parseEmbeddedLogin(body) {
  if (body.length < 16) throw new Error("Truncated login prefix");
  let offset = 13;
  while (offset < body.length && body[offset++] !== 0) {}
  if (body[12] & 0x10) {
    if (body[offset++] !== 0) throw new Error("Invalid login token marker");
    while (offset < body.length && body[offset++] !== 0) {}
  }
  const rsaLength = readU16(body, offset);
  offset += 2;
  const cipher = body.slice(offset, offset + rsaLength);
  offset += rsaLength;
  if (!rsaLength || offset > body.length) throw new Error("Truncated RSA login block");
  const modulus = BigInt(GEOBLOX_LOGIN_MODULUS);
  const plain = bigIntToBytes(
    modPow(bytesToBigInt(cipher), GEOBLOX_LOGIN_PRIVATE_EXPONENT, modulus),
  );
  if (plain[0] !== 10) throw new Error(`Invalid embedded login RSA marker ${plain[0]}`);
  const keys = [1, 5, 9, 13].map((position) => readU32(plain, position));
  const decrypted = decryptGeobloxXtea(body.slice(offset), keys);
  const declaredLength = readU16(plain, 17);
  if (plain.length < 19 || declaredLength > decrypted.length) throw new Error("Truncated login payload");
  const inner = decrypted.slice(0, declaredLength);
  if (inner.length < 42 || readU16(plain, 17) > inner.length) throw new Error("Truncated login payload");
  const clientSeed = [0, 4, 8, 12].map((position) => readU32(inner, position));
  let username = "Browser Player";
  let usernameRaw = null;
  const credentialsOffset = 42;
  let stringName = null;
  if (inner[credentialsOffset] === 0) {
    const end = inner.indexOf(0, credentialsOffset + 1);
    if (end > credentialsOffset + 1 && inner.length - end - 1 >= 14) {
      const candidate = new TextDecoder("windows-1252").decode(inner.slice(credentialsOffset + 1, end));
      if ([...candidate].every(char => char.charCodeAt(0) >= 32)) stringName = candidate;
    }
  }
  if (stringName) username = stringName;
  else if (inner.length >= credentialsOffset + 22) {
    usernameRaw = readU64(inner, credentialsOffset);
    username = decodeBase37(usernameRaw) || username;
  } else throw new Error("Truncated login credentials");
  return { keys, clientSeed, inner, username, usernameRaw };
}

function createBrowserJs5Socket() {
  const state = {
    chunks: [],
    size: 0,
    waiters: [],
    closed: false,
    error: null,
    handshakeComplete: false,
    outgoing: [],
    requestChain: Promise.resolve(),
    protocol: null,
    challenge: 0x47454f424c4f5801n,
    login: null,
  };
  diagnostics.sockets ??= [];
  diagnostics.sockets.push(state);
  return state;
}

function processBrowserJs5Writes(state) {
  if (state.closed) throw new Error("Socket is closed");
  if (!state.handshakeComplete) {
    const hasPreamble = state.outgoing[0] === 12;
    const opcodeOffset = hasPreamble ? 8 : 0;
    if (state.outgoing.length <= opcodeOffset) return;
    const opcode = state.outgoing[opcodeOffset];
    if (hasPreamble && game.js5GameId !== undefined && readU16(state.outgoing, 3) !== game.js5GameId) {
      throw new Error(`Game handshake id mismatch for ${game.internalName}`);
    }
    if (opcode === 15) {
      if (state.outgoing.length < opcodeOffset + 5) return;
      const crc = readU32(state.outgoing, opcodeOffset + 1);
      if (crc !== (game.gamecrc >>> 0)) throw new Error(`JS5 game CRC mismatch for ${game.internalName}`);
      state.outgoing.splice(0, opcodeOffset + 5);
      state.protocol = "js5";
      state.handshakeComplete = true;
      queueSocketBytes(state, new Uint8Array([0]));
    } else if (opcode === 17 && !hasPreamble) {
      state.outgoing.shift();
      state.protocol = "jaggrab";
      state.handshakeComplete = true;
    } else if (opcode === 14) {
      if (state.outgoing.length < opcodeOffset + 2) return;
      state.outgoing.splice(0, opcodeOffset + 2);
      state.protocol = "account";
      state.handshakeComplete = true;
      const challenge = bigIntToBytes(state.challenge);
      queueSocketBytes(state, Uint8Array.from([0, ...challenge]));
    } else {
      throw new Error(`Unexpected embedded server handshake opcode ${opcode}`);
    }
  }

  if (state.protocol === "jaggrab") {
    if (state.outgoing.length > 2048) throw new Error("Oversized JAGGRAB request");
    const request = new TextDecoder().decode(Uint8Array.from(state.outgoing));
    if (!request.endsWith("\n\n")) return;
    const path = /^JAGGRAB ([^\r\n]+)\n\n$/.exec(request)?.[1]?.split("?")[0];
    if (path !== "/countrylist.ws" && path !== "/motd") throw new Error(`Unsupported local JAGGRAB resource ${path}`);
    // Offline profiles have no country routing or server announcements. EOF
    // is a valid empty document, and avoids a background native exception.
    state.outgoing.length = 0;
    state.closed = true;
    wakeSocketReaders(state);
    return;
  }

  if (state.protocol === "account") {
    while (state.outgoing.length >= 3 && !state.login) {
      const opcode = state.outgoing[0];
      if (opcode !== 16 && opcode !== 18) {
        throw new Error(`Unexpected GeoBlox login opcode ${opcode}`);
      }
      const length = readU16(state.outgoing, 1);
      if (state.outgoing.length < length + 3) return;
      state.outgoing.splice(0, 3);
      const body = Uint8Array.from(state.outgoing.splice(0, length));
      state.login = parseEmbeddedLogin(body);
      state.inboundIsaac = new GeobloxIsaac(state.login.clientSeed);
      state.outboundIsaac = new GeobloxIsaac(
        state.login.clientSeed.map((value) => (value + 50) >>> 0),
      );
      const previousName = storage.getItem("funorb.account.name") || storage.getItem("geoblox.account.name");
      const reconnectId = state.login.usernameRaw;
      const name = opcode === 18 && previousName && reconnectId !== null && reconnectId <= 0xffffn
        ? previousName
        : state.login.username || previousName || "Browser Player";
      state.accountName = name;
      storage.setItem("funorb.account.name", name);
      const nameBytes = encodeCp1252(name);
      const payload = Uint8Array.from([
        0, 0, 0, 0, 0, 0, 0, 1,
        0, 0, 1, 109,
        0, 0,
        ...nameBytes, 0,
        0,
      ]);
      queueSocketBytes(state, Uint8Array.from([0, payload.length, ...payload]));
      diagnostics.account = { name, connected: true, game: game.internalName };
      state.keepalive = setInterval(() => {
        if (!state.closed && !state.error) frameAccountPacket(state, 0, []);
      }, 10000);
      state.keepalive.unref?.();
    }
    // Packet decoding is installed next; retaining bytes here is important
    // because the client can send its first ISAAC packet in the same write.
    if (state.login && state.outgoing.length) processEmbeddedAccountPackets(state);
    return;
  }

  while (state.outgoing.length >= 6) {
    const request = state.outgoing.splice(0, 6);
    const opcode = request[0];
    if (opcode === 4) { state.xorKey = request[1]; continue; }
    if (opcode === 7) { state.closed = true; wakeSocketReaders(state); return; }
    if (opcode === 2 || opcode === 3 || opcode === 6) continue;
    if (opcode !== 0 && opcode !== 1) {
      throw new Error(`Unexpected JS5 request opcode ${opcode}`);
    }
    const archive = request[1];
    const group = (
      request[2] * 0x1000000 +
      (request[3] << 16) +
      (request[4] << 8) +
      request[5]
    ) >>> 0;
    diagnostics.requests ??= [];
    diagnostics.requests.push(`${archive}/${group}`);
    if (diagnostics.requests.length > 200) diagnostics.requests.shift();
    state.requestChain = state.requestChain.then(async () => {
      if (state.closed) return;
      const response = await fetchAsset(`${game.assetRoot}/${archive}-${group}.bin${game.assetVersion ? `?v=${game.assetVersion}` : ""}`);
      if (!response.ok) {
        throw new Error(`Missing ${game.name} JS5 archive ${archive}:${group}`);
      }
      let container = new Uint8Array(await response.arrayBuffer());
      if (archive !== 255 && container.length >= 5) {
        const view = new DataView(
          container.buffer,
          container.byteOffset,
          container.byteLength,
        );
        const compressedLength = view.getUint32(1);
        const containerLength = (container[0] === 0 ? 5 : 9) + compressedLength;
        if (container.length < containerLength) {
          throw new Error(
            `Truncated ${game.name} JS5 archive ${archive}:${group}`,
          );
        }
        container = container.subarray(0, containerLength);
      }
      queueSocketBytes(
        state,
        frameJs5Response(archive, group, container, opcode === 0).map(byte => byte ^ (state.xorKey || 0)),
      );
    });
    state.requestChain.catch((error) => {
      state.error = error;
      wakeSocketReaders(state);
    });
  }
}

function install(jvm) {
  const handleException = jvm.handleException.bind(jvm);
  jvm.handleException = (error, pc, thread) => {
    diagnostics.exceptions ??= [];
    const entry = {type: error?.type, message: String(error?.message || ""), pc,
      stack: thread?.callStack?.items?.slice(-5).map(frame => ({class: frame.className, method: frame.method?.name, pc: frame.pc}))};
    const previous = diagnostics.exceptions.at(-1);
    if (previous && previous.type === entry.type && previous.message === entry.message && previous.pc === entry.pc && JSON.stringify(previous.stack) === JSON.stringify(entry.stack)) {
      previous.count = (previous.count || 1) + 1;
    } else {
      diagnostics.exceptions.push(entry);
      if (diagnostics.exceptions.length > 100) diagnostics.exceptions.shift();
    }
    return handleException(error, pc, thread);
  };
  const inetAddressMethods = jvm.jre["java/net/InetAddress"].staticMethods;
  const socketMethods = jvm.jre["java/net/Socket"].methods;
  const inputMethods = jvm.jre["java/net/SocketInputStream"].methods;
  const outputMethods = jvm.jre["java/net/SocketOutputStream"].methods;
  inetAddressMethods["getByName(Ljava/lang/String;)Ljava/net/InetAddress;"] = (
    _jvm,
    _object,
    args,
  ) => {
    const address = [127, 0, 0, 1];
    address.type = "[B";
    address.elementType = "byte";
    return {
      type: "java/net/InetAddress",
      hostName: args[0],
      address,
    };
  };
  const initializeSocket = (_jvm, object) => {
    object.browserSocket = createBrowserJs5Socket();
    object.isClosed = false;
  };
  socketMethods["<init>(Ljava/net/InetAddress;I)V"] = initializeSocket;
  socketMethods["<init>(Ljava/lang/String;I)V"] = initializeSocket;
  socketMethods["connect(Ljava/net/SocketAddress;)V"] = (_jvm, object) => {
    object.browserSocket ??= createBrowserJs5Socket();
  };
  socketMethods["setSoTimeout(I)V"] = () => {};
  socketMethods["setTcpNoDelay(Z)V"] = () => {};
  socketMethods["close()V"] = (_jvm, object) => {
    object.isClosed = true;
    if (!object.browserSocket) return;
    object.browserSocket.closed = true;
    clearInterval(object.browserSocket.keepalive);
    wakeSocketReaders(object.browserSocket);
  };
  socketMethods["getOutputStream()Ljava/io/OutputStream;"] = (_jvm, object) => {
    return {
      type: "java/net/SocketOutputStream",
      browserSocket: object.browserSocket,
    };
  };
  socketMethods["getInputStream()Ljava/io/InputStream;"] = (_jvm, object) => {
    return {
      type: "java/net/SocketInputStream",
      browserSocket: object.browserSocket,
    };
  };

  inputMethods["available()I"] = (_jvm, object) => object.browserSocket.size;
  inputMethods["read()I"] = (_jvm, object) => {
    const state = object.browserSocket;
    return waitForSocketBytes(state).then(() => {
      if (state.size === 0) return -1;
      const byte = state.chunks[0][0];
      readSocketBytes(state, [0], 0, 1);
      return byte;
    });
  };
  const readArray = (_jvm, object, args) => {
    const state = object.browserSocket;
    const target = args[0] || [];
    const offset = args.length > 1 ? args[1] | 0 : 0;
    const requestedLength = args.length > 2 ? args[2] | 0 : target.length;
    // Preserve the update protocol's 512-byte framing. Returning a larger
    // coalesced browser buffer makes the guest consume a continuation marker
    // as payload and reject an otherwise valid reference table.
    const length = Math.min(requestedLength, 512);
    if (length === 0) return 0;
    const readAvailable = () => {
      if (state.error) throw state.error;
      if (length === 0) return 0;
      if (state.size === 0) return -1;
      const copied = readSocketBytes(state, target, offset, length);
      return copied;
    };
    if (state.size > 0 || state.closed || state.error) return readAvailable();
    return waitForSocketBytes(state).then(readAvailable);
  };
  inputMethods["read([B)I"] = readArray;
  inputMethods["read([BII)I"] = readArray;
  inputMethods["close()V"] = () => {};

  const writeArray = (object, bytes) => {
    const state = object.browserSocket;
    for (const byte of bytes) state.outgoing.push(byte & 0xff);
    try {
      processBrowserJs5Writes(state);
    } catch (error) {
      state.error = error;
      console.error("Embedded GeoBlox server error:", error);
      wakeSocketReaders(state);
    }
  };
  outputMethods["write(I)V"] = (_jvm, object, args) => {
    writeArray(object, [args[0]]);
  };
  outputMethods["write([B)V"] = (_jvm, object, args) => {
    writeArray(object, args[0] || []);
  };
  outputMethods["write([BII)V"] = (_jvm, object, args) => {
    const source = args[0] || [];
    writeArray(object, source.slice(args[1] | 0, (args[1] | 0) + (args[2] | 0)));
  };
  outputMethods["flush()V"] = () => {};
  outputMethods["close()V"] = () => {};
}


return { install, createSocket: createBrowserJs5Socket, processWrites: processBrowserJs5Writes, frameJs5Response, parseLogin: parseEmbeddedLogin, Isaac: GeobloxIsaac, handleAccountPacket: handleEmbeddedAccountPacket, processAccountPackets: processEmbeddedAccountPackets };
}

function encodeCp1252(text) {
  const decoder = new TextDecoder("windows-1252");
  const map = new Map(Array.from({length: 256}, (_, byte) => [decoder.decode(Uint8Array.of(byte)), byte]));
  return Array.from(text, char => map.get(char) ?? 63);
}
