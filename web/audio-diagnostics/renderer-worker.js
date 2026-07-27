import { hydrateSampleBank, renderTrack } from "../music-visualizer/audio.js";

let bank = null;
let bankLoadMs = 0;

self.addEventListener("message", async event => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const startedAt = performance.now();
      const response = await fetch(message.bankUrl);
      if (!response.ok) throw new Error(`sample bank request failed: HTTP ${response.status}`);
      bank = hydrateSampleBank(await response.json());
      bankLoadMs = performance.now() - startedAt;
      self.postMessage({
        type: "ready",
        bankLoadMs,
        sampleRate: bank.sampleRate,
        sampleCount: bank.samples.size,
      });
      return;
    }

    if (message.type !== "render") return;
    if (!bank) throw new Error("PCM worker has not loaded its sample bank");

    const requestId = message.requestId;
    const fetchStartedAt = performance.now();
    const response = await fetch(message.trackUrl);
    if (!response.ok) throw new Error(`track request failed: HTTP ${response.status}`);
    const track = await response.json();
    const fetchMs = performance.now() - fetchStartedAt;
    const renderStartedAt = performance.now();
    const pcm = await renderTrack(track, bank, progress => {
      self.postMessage({ type: "progress", requestId, progress });
    });
    const renderMs = performance.now() - renderStartedAt;
    const stats = inspectPcm(pcm);
    self.postMessage({
      type: "rendered",
      requestId,
      pcm: pcm.buffer,
      renderMs,
      fetchMs,
      bankLoadMs,
      sampleRate: bank.sampleRate,
      stats,
    }, [pcm.buffer]);
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: event.data && event.data.requestId,
      message: String(error && (error.stack || error.message) || error),
    });
  }
});

function inspectPcm(pcm) {
  let peak = 0;
  let squares = 0;
  let nonZero = 0;
  let checksum = 0x811c9dc5;
  const bits = new Uint32Array(pcm.buffer, pcm.byteOffset, pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i];
    const magnitude = Math.abs(sample);
    if (magnitude > peak) peak = magnitude;
    squares += sample * sample;
    if (magnitude > 1e-7) nonZero++;
    checksum ^= bits[i];
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return {
    peak,
    rms: pcm.length ? Math.sqrt(squares / pcm.length) : 0,
    nonZero,
    checksum: checksum.toString(16).padStart(8, "0"),
  };
}
