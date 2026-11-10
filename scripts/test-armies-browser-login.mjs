import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {patchGameCompatibility} from '../apps/launcher/browser-loader/game-source-patches.mjs';
import {createBrowserGameServer} from '../apps/launcher/browser-loader/browser-game-server.mjs';

test('AOG preferences complete loading and persist with checked CRC acknowledgements', () => {
  const records = new Map();
  const storage = {getItem: key => records.get(key), setItem: (key, value) => records.set(key, value)};
  const server = createBrowserGameServer({game: {internalName: 'armiesofgielinor'}, storage});
  const state = server.createSocket(); state.accountName = 'Alice'; state.outboundIsaac = {next: () => 0};
  const drain = () => {
    const wire = Buffer.concat(state.chunks.map(chunk => Buffer.from(chunk)));
    state.chunks = []; state.size = 0; return wire.toString('hex');
  };
  server.handleAccountPacket(state, 6, Uint8Array.of(0));
  assert.equal(drain(), '0506000041d912ff');
  // CRC fixtures independently generated with zlib.crc32.
  server.handleAccountPacket(state, 6, Buffer.from('010225809f373fd0', 'hex'));
  assert.equal(drain(), '0505019f373fd0');
  server.handleAccountPacket(state, 6, Uint8Array.of(0));
  assert.equal(drain(), '050800022580278b58b5');
  server.handleAccountPacket(state, 6, Buffer.from('010225809f373fd1', 'hex'));
  assert.equal(drain(), '');
  state.accountName = 'Bob';
  server.handleAccountPacket(state, 6, Uint8Array.of(0));
  assert.equal(drain(), '0506000041d912ff');
});

test('fragmented AOG startup requests return correctly framed coat, profile and quicksave data', () => {
  const records = new Map();
  const storage = {getItem: key => records.get(key), setItem: (key, value) => records.set(key, value)};
  const server = createBrowserGameServer({game: {internalName: 'armiesofgielinor'}, storage});
  const state = server.createSocket();
  state.accountName = 'Alice'; state.outboundIsaac = {next: () => 0};
  const seed = [1, 2, 3, 4];
  state.inboundIsaac = new server.Isaac(seed);
  const client = new server.Isaac(seed);
  // Adjacent zero-length opcodes must each consume one cipher value, without
  // interpreting the next encrypted opcode as a payload length.
  for (const opcode of [69, 75]) {
    state.outgoing.push((opcode + client.next()) & 255);
    server.processAccountPackets(state);
  }
  assert.equal(state.outgoing.length, 0);
  assert.equal(state.pendingAccountPacket, null);
  const wire = Buffer.concat(state.chunks.map(chunk => Buffer.from(chunk)));
  assert.equal(wire[0], 75);
  assert.deepEqual([...wire.subarray(1, 13)], [0, 0, 255, 0, 255, 0, 0, 0, 255, 0, 0, 0]);
  assert.equal(wire[13], 80);
  const size = wire.readUInt16BE(14);
  assert.equal(size, 174);
  const profile = wire.subarray(16, 16 + size);
  assert.equal(profile[0], 9);
  assert.ok(profile.subarray(1, 136).every(value => value === 0));
  assert.ok(profile.subarray(136, 146).every(value => value === 255));
  assert.ok(profile.subarray(146).every(value => value === 0));
  assert.deepEqual([...wire.subarray(16 + size)], [81, 1, 0]);
  // Player edits remain scoped to the local game/profile key.
  const coat = Uint8Array.from([1, 2, 2, 3, 3, 4, 4, 5, 255, 0, 255, 0]);
  const slots = Uint8Array.from([0, 2, 0, 3, 255, 255, 255, 255, 255, 255]);
  server.handleAccountPacket(state, 71, coat);
  server.handleAccountPacket(state, 76, slots);
  state.chunks = []; state.size = 0;
  server.handleAccountPacket(state, 69, new Uint8Array());
  server.handleAccountPacket(state, 75, new Uint8Array());
  const restored = Buffer.concat(state.chunks.map(chunk => Buffer.from(chunk)));
  assert.deepEqual([...restored.subarray(1, 13)], [...coat]);
  assert.deepEqual([...restored.subarray(16 + 136, 16 + 146)], [...slots]);
  state.accountName = 'Bob'; state.chunks = []; state.size = 0;
  server.handleAccountPacket(state, 69, new Uint8Array());
  assert.notDeepEqual([...state.chunks[0].subarray(1)], [...coat]);
});

test('AOG connection initializes its session, sends the preamble and preserves failure states', t => {
  const repository = process.env.FUNORB_DECOMPILED_DIR || fileURLToPath(new URL('../../funorb-decompiled/', import.meta.url));
  const file = path.join(repository, 'games/armiesofgielinor/EffectPresentation.java');
  if (!existsSync(file)) return t.skip('Readable AOG checkout unavailable');
  if (spawnSync('javac', ['-version']).error) return t.skip('JDK unavailable');
  const source = readFileSync(file, 'utf8');
  const patched = patchGameCompatibility(source, 'games/armiesofgielinor/EffectPresentation.java');
  assert.notEqual(patched, source);
  assert.equal(patchGameCompatibility(patched, 'games/armiesofgielinor/EffectPresentation.java'), patched);
  assert.equal(patchGameCompatibility(source, 'games/other/EffectPresentation.java'), source);
  const start = patched.indexOf('    final static boolean a(boolean param0, int param1) {');
  const end = patched.indexOf('\n    public final void advanceFrame', start);
  assert.ok(start >= 0 && end > start);
  const method = patched.slice(start, end);
  const directory = mkdtempSync(path.join(os.tmpdir(), 'aog-connection-probe-'));
  const run = (command, args) => {
    const result = spawnSync(command, args, {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return result.stdout.trim();
  };
  try {
    writeFileSync(path.join(directory, 'AogConnectionProbe.java'), `
import java.net.Socket;
import java.io.IOException;
class EffectPresentation { ${method} }
class PlatformTask { int status; Object result = new Socket(); }
class PlatformTaskService {
  PlatformTask task = new PlatformTask();
  PlatformTask openSocketAsync(int port, byte guard, String host) { return task; }
}
class AccountRegistrationForm { static PlatformTask field_J; }
class wj { static PlatformTaskService field_n = new PlatformTaskService(); }
class ProceduralMapSupport { static int field_d = 43594; }
class AccountNameNormalizer { static String field_c = "localhost"; }
class MonotonicClockSupport { static long monotonicMillis(int guard) { return 123L; } }
class SummonEvent { static long field_G; }
class CampaignMenuButton { static long lastPacketReadMillis; }
class BufferedSocket {
  static boolean fail; final Socket socket;
  BufferedSocket(Socket socket, PlatformTaskService service) throws IOException {
    if (fail) throw new IOException(); this.socket = socket;
  }
}
class MoveAttackRequest { static BufferedSocket sessionSocket; }
class CipherPacketBuffer { int position = 99; }
class ByteStorage { static CipherPacketBuffer incomingPacket = new CipherPacketBuffer(); }
class EmailValidator { static CipherPacketBuffer outgoingPacket = new CipherPacketBuffer(); }
class SpectateRoomRequestSupport { static Object connectionState; }
class sg { static Object field_a = new Object(); }
class DirectByteStorage { static Object field_o = new Object(); }
class QuickChatCommandDefinition { static int thirdPreviousOpcode; }
class PrintCoatConsoleCommand { static int secondPreviousOpcode; }
class TurnTimerDial { static int previousOpcode; }
class MusicPatch { static int field_t = 68; }
class CampaignRewardPreview { static int field_d = 123; }
class SpriteDropdownMenu { static int field_v = 456; }
class ChatMessageWriteSupport {
  static int writes;
  static void a(int game, boolean ignored, int first, CipherPacketBuffer packet, int second) {
    if (game != 68 || ignored || first != 123 || second != 456 || packet.position != 0) throw new AssertionError("preamble arguments");
    writes++; packet.position = 8;
  }
}
class hb {
  static int flushes;
  static void $cfr$intArgs$a$e9dea5688aa5(int guard, int opcode) {
    if (guard != 83 || opcode != -1 || EmailValidator.outgoingPacket.position != 8) throw new AssertionError("flush");
    flushes++;
  }
}
class ArmiesOfGielinor { static boolean obfuscationControl; }
public class AogConnectionProbe {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  static void reset(int status) {
    AccountRegistrationForm.field_J = null;
    wj.field_n.task.status = status;
    MoveAttackRequest.sessionSocket = null;
    SpectateRoomRequestSupport.connectionState = null;
    BufferedSocket.fail = false;
    EmailValidator.outgoingPacket.position = ByteStorage.incomingPacket.position = 99;
    ChatMessageWriteSupport.writes = hb.flushes = 0;
  }
  public static void main(String[] args) {
    reset(0); check(!EffectPresentation.a(false, 0)); check(AccountRegistrationForm.field_J == wj.field_n.task);
    check(MoveAttackRequest.sessionSocket == null && hb.flushes == 0);
    for (boolean reconnect : new boolean[]{false, true}) {
      reset(1); check(EffectPresentation.a(reconnect, 0));
      check(AccountRegistrationForm.field_J == null && MoveAttackRequest.sessionSocket.socket == wj.field_n.task.result);
      check(SpectateRoomRequestSupport.connectionState == sg.field_a);
      check(ByteStorage.incomingPacket.position == 0 && ChatMessageWriteSupport.writes == 1 && hb.flushes == 1);
      int expected = reconnect ? -2 : -1;
      check(QuickChatCommandDefinition.thirdPreviousOpcode == expected && PrintCoatConsoleCommand.secondPreviousOpcode == expected && TurnTimerDial.previousOpcode == expected);
      check(SummonEvent.field_G == 123 && CampaignMenuButton.lastPacketReadMillis == 123);
    }
    reset(2); check(EffectPresentation.a(false, 0)); check(SpectateRoomRequestSupport.connectionState == DirectByteStorage.field_o);
    check(MoveAttackRequest.sessionSocket == null && AccountRegistrationForm.field_J == null && hb.flushes == 0);
    reset(1); BufferedSocket.fail = true; check(EffectPresentation.a(false, 0));
    check(SpectateRoomRequestSupport.connectionState == DirectByteStorage.field_o && AccountRegistrationForm.field_J == null && hb.flushes == 0);
    System.out.println("pending, fresh login, reconnect, failed task and failed socket: passed");
  }
}`);
    run('javac', ['--release', '8', '-d', directory, path.join(directory, 'AogConnectionProbe.java')]);
    assert.match(run('java', ['-Xverify:all', '-cp', directory, 'AogConnectionProbe']), /passed$/);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
