// Escape Vector's local profile services. Packet layouts are checked against
// the original client's writers/decoders by EscapeProtocolProbe.java.
// No passwords or network endpoint: these are profiles on this browser origin.
const prefix = 'funorb.account.escapevector.';
const playersKey = 'funorb.players.escapevector';
const normalize = name => name.trim().toLowerCase();
const u16 = (bytes, offset) => bytes[offset] * 256 + bytes[offset + 1];
const u32 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
const intBytes = value => [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255];
const longBytes = value => Array.from({length: 8}, (_, i) => Number(BigInt(value) >> BigInt(56 - i * 8) & 255n));
const nameBytes = name => Array.from(name, char => char.charCodeAt(0) <= 255 ? char.charCodeAt(0) : 63);

export function accountRecordCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function record(payload, length) {
  if (payload.length < 5 || (length !== undefined && payload.length !== length) || payload[0] !== 1)
    throw new Error('Invalid Escape Vector account record');
  if (accountRecordCrc(payload.subarray(0, -4)) !== u32(payload, payload.length - 4))
    throw new Error('Escape Vector account record CRC mismatch');
  return payload.subarray(0, -4);
}

function playerId(name) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(normalize(name)))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return (hash & 0x3fffffffffffffffn) | 0x4000000000000000n;
}

export function createEscapeAccountService({storage, send, close}) {
  const read = (key, fallback) => {
    try { return JSON.parse(storage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const load = name => read(prefix + normalize(name), {});
  const save = (name, data) => storage.setItem(prefix + normalize(name), JSON.stringify(data));
  const players = () => read(playersKey, []);

  function login(login, previousName, opcode) {
    let name = players().find(name => playerId(name) === login.usernameRaw);
    // Migrate the old shim's constant reconnect ID only on the reconnect path.
    name ??= opcode === 18 && login.usernameRaw === 1n && previousName ? previousName : login.username;
    name = (name || previousName || 'Browser Player').trim();
    const names = players();
    if (!names.some(known => normalize(known) === normalize(name))) {
      names.push(name);
      storage.setItem(playersKey, JSON.stringify(names));
    }
    const data = load(name);
    data.displayName ??= name;
    save(name, data);
    return {name: data.displayName, playerId: playerId(name)};
  }

  function handle(state, opcode, payload) {
    if (opcode === 0) { send(state, 0, []); return; }
    if (opcode === 1 || opcode === 17) { close(state); return; }
    const name = state.accountName;
    const data = load(name);
    if (opcode === 2) { send(state, 1, new Uint8Array(16)); return; }
    if (opcode === 4) {
      if (payload.length === 1 && payload[0] === 2) {
        const masks = new Uint32Array(8);
        for (const index of data.achievements || []) if (index >= 0 && index < 256)
          masks[index >>> 5] |= 1 << (index & 31);
        send(state, 3, [0, 8, ...Array.from(masks).flatMap(intBytes)]);
      } else {
        const body = record(payload, 23);
        data.achievements = [...new Set([...(data.achievements || []), body[1]])].sort((a, b) => a - b);
        save(name, data);
        send(state, 3, [1]); // cg.c unlinks the pending achievement record
      }
      return;
    }
    if (opcode === 5) {
      if (payload.length === 3 && payload[0] === 2 && payload[1] === 0) {
        const mode = payload[2];
        if (mode > 2) throw new Error('Invalid Escape Vector campaign');
        const next = data.campaignProgress?.[mode] || 0;
        send(state, 4, [0, mode, next, 0, 0, 0]);
      } else {
        const body = record(payload);
        if (body.length < 19) throw new Error('Invalid Escape Vector progress record');
        const size = body[2] < 128 ? 1 : 2;
        const level = size === 1 ? body[2] - 64 : u16(body, 2) - 49152;
        const mode = body[1];
        if (body.length !== 18 + size || mode > 2 || level < 0 || level >= 16)
          throw new Error('Invalid Escape Vector progress record');
        // Legacy data.progress collapsed campaigns together; keep it intact,
        // but do not copy it into unrelated campaigns.
        data.campaignProgress ??= {};
        data.campaignProgress[mode] = Math.max(data.campaignProgress[mode] || 0, Math.min(level + 1, 15));
        save(name, data);
        send(state, 4, [1, mode, level + 64]); // dk.e matches mode + cleared level
      }
      return;
    }
    if (opcode === 6) {
      if (payload.length === 1 && payload[0] === 0) {
        const blob = data.savedGame || [];
        const reply = [0, blob.length, ...blob];
        send(state, 5, [...reply, ...intBytes(accountRecordCrc(reply))]);
      } else {
        const body = record(payload);
        if (body.length < 2 || body[1] > 249 || body.length !== body[1] + 2)
          throw new Error('Invalid Escape Vector saved game');
        data.savedGame = Array.from(body.subarray(2));
        save(name, data);
        send(state, 5, [1, ...payload.subarray(-4)]);
      }
      return;
    }
    if (opcode === 3) {
      if (payload.length === 6 && payload[0] === 5 && payload[1] === 0) {
        const board = u16(payload, 2), rows = payload[4], columns = payload[5];
        if (board > 3 || rows > 100 || columns !== 1) throw new Error('Invalid Escape Vector highscore query');
        const leaders = players().map(player => {
          const profile = load(player);
          const scores = (profile.scores || []).filter(score => score.variant === board);
          const best = scores.reduce((best, score) => !best || score.score > best.score ? score : best, null);
          return best && {name: profile.displayName || player, account: player, ...best};
        }).filter(Boolean).sort((a, b) => b.score - a.score || normalize(a.account).localeCompare(normalize(b.account))).slice(0, rows);
        const names = [], entries = [];
        let count = 1;
        for (const leader of leaders) {
          let column = 0;
          if (normalize(leader.account) !== normalize(name)) {
            names.push(...nameBytes(leader.name), 0, 0);
            column = count++;
          }
          entries.push([column, ...longBytes(leader.score), ...intBytes(leader.raw ?? leader.score)]);
        }
        send(state, 2, [0, board >>> 8, board & 255, count, ...names, entries.length, ...entries.flat()]);
      } else {
        const body = record(payload);
        if (body.length !== 28 || body[23] !== 1) throw new Error('Invalid Escape Vector highscore record');
        const key = u16(body, 1), board = u16(body, 3), variant = u16(body, 5), score = u32(body, 24);
        if (board > 3 || variant !== (board ^ 65535) || score > 0x7fffffff)
          throw new Error('Invalid Escape Vector highscore record');
        const previous = (data.scores || []).filter(entry => entry.variant === board);
        const best = Math.max(score, ...previous.map(entry => entry.score));
        data.scores = (data.scores || []).filter(entry => entry.variant !== board);
        data.scores.push({key, variant: board, score: best, raw: best, values: [best]});
        save(name, data);
        send(state, 2, [1, key >>> 8, key & 255, ...longBytes(best)]);
      }
      return;
    }
    if (opcode === 7) { send(state, 6, [payload[0], 0]); return; }
    if (opcode === 8 || opcode === 16) return; // reflection reply / client status
    throw new Error(`Unsupported Escape Vector account opcode ${opcode}`);
  }

  return {login, handle};
}
