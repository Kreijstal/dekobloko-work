const SAMPLE_RATE = 22050;
const PITCH_TABLE = Array.from({ length: 8000 }, (_, i) =>
  Math.trunc(8363.0 * Math.pow(2.0, (4608 - i) / 768.0))
);

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function decodePcm8(base64) {
  const text = atob(base64);
  const out = new Int8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const byte = text.charCodeAt(i);
    out[i] = byte > 127 ? byte - 256 : byte;
  }
  return out;
}

export function hydrateSampleBank(rawBank) {
  const samples = new Map();
  for (const [key, value] of Object.entries(rawBank.samples)) {
    samples.set(key, {
      bank: value.bank,
      id: value.id,
      rate: value.rate,
      loopStart: value.loopStart,
      loopEnd: value.loopEnd,
      pingPong: Boolean(value.pingPong),
      pcm: decodePcm8(value.pcm8)
    });
  }
  return { sampleRate: rawBank.sampleRate || SAMPLE_RATE, samples };
}

export async function renderTrack(track, bank, onProgress = () => {}) {
  const renderer = new Ia(track, bank);
  return renderer.render(onProgress);
}

class Mi {
  constructor() {
    this.voices = [];
  }

  add(voice) {
    if (voice) this.voices.push(voice);
  }

  removeChannel(channel) {
    for (const voice of this.voices) {
      if (voice.channel === channel) voice.release(172);
    }
  }

  releaseAll(samples) {
    for (const voice of this.voices) voice.release(samples);
  }

  mix(target, offset, length) {
    const live = [];
    for (const voice of this.voices) {
      voice.mix(target, offset, length);
      if (!voice.done) live.push(voice);
    }
    this.voices = live;
  }
}

class Ei {
  constructor(sample, step, volume, pan, channel, instrument) {
    this.sample = sample;
    this.step = step;
    this.volume = volume / 128;
    this.pan = pan;
    this.channel = channel;
    this.instrument = instrument;
    this.pos = 0;
    this.direction = 1;
    this.loops = instrument.M !== 0 ? -1 : 0;
    this.pingPong = instrument.M === 2 || sample.pingPong;
    this.loopStart = sample.loopStart || 0;
    this.loopEnd = sample.loopEnd > this.loopStart ? sample.loopEnd : sample.pcm.length;
    this.fade = 1;
    this.fadeStep = 0;
    this.done = false;
  }

  setPitch(step) {
    this.step = step;
  }

  setVolume(volume, pan) {
    this.volume = clamp(volume, 0, 256) / 128;
    this.pan = clamp(pan, 0, 255);
  }

  release(samples) {
    if (samples <= 0) {
      this.done = true;
      return;
    }
    this.fadeStep = -this.fade / samples;
  }

  mix(target, offset, length) {
    if (this.done) return;
    const pcm = this.sample.pcm;
    const loopStart = this.loopStart;
    const loopEnd = this.loopEnd;
    const end = pcm.length;
    for (let i = 0; i < length; i++) {
      const idx = Math.trunc(this.pos);
      if (idx < 0 || idx >= end) {
        this.done = true;
        break;
      }
      const frac = this.pos - idx;
      const a = pcm[idx] || 0;
      const b = pcm[idx + this.direction] ?? a;
      target[offset + i] += ((a + (b - a) * frac) / 128) * this.volume * this.fade;
      this.pos += this.step * this.direction;

      if (this.fadeStep !== 0) {
        this.fade += this.fadeStep;
        if (this.fade <= 0) {
          this.done = true;
          break;
        }
      }

      if (this.direction > 0 && this.pos >= loopEnd) {
        if (this.loops === 0) {
          this.done = true;
          break;
        }
        if (this.loops > 0) this.loops--;
        if (this.pingPong) {
          this.pos = loopEnd - (this.pos - loopEnd) - 1;
          this.direction = -1;
        } else {
          this.pos = loopStart + (this.pos - loopEnd);
        }
      } else if (this.direction < 0 && this.pos < loopStart) {
        if (this.loops === 0) {
          this.done = true;
          break;
        }
        if (this.loops > 0) this.loops--;
        if (this.pingPong) {
          this.pos = loopStart + (loopStart - this.pos);
          this.direction = 1;
        } else {
          this.pos = loopEnd - (loopStart - this.pos);
        }
      }
    }
  }
}

class Ia {
  constructor(track, bank) {
    this.track = track;
    this.bank = bank;
    this.mixer = new Mi();
    this.channels = Array.from({ length: track.H }, () => ({
      instrument: 0,
      volume: 64,
      pan: 128,
      pitchIndex: 0,
      voice: null
    }));
    this.masterVolume = 100;
    this.globalVolume = 64;
    this.rows = groupByRow(track.events);
    this.rowSamples = Math.max(1, Math.trunc((SAMPLE_RATE * 640) / ((track.m || 144) * 256)));
    this.ticksPerRow = Math.max(1, track.k || 1);
    this.samplesPerRow = this.rowSamples * this.ticksPerRow;
    this.totalRows = (track.maxRow ?? Math.max(...track.events.map((event) => event.absoluteRow), 0)) + 1;
  }

  async render(onProgress) {
    const extraTail = SAMPLE_RATE * 2;
    const out = new Float32Array(this.totalRows * this.samplesPerRow + extraTail);
    for (let row = 0; row < this.totalRows; row++) {
      this.processRow(row);
      const base = row * this.samplesPerRow;
      for (let tick = 0; tick < this.ticksPerRow; tick++) {
        this.applyTickEffects();
        this.mixer.mix(out, base + tick * this.rowSamples, this.rowSamples);
      }
      if ((row & 31) === 0) {
        onProgress(row / this.totalRows);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    this.mixer.releaseAll(Math.trunc(SAMPLE_RATE / 8));
    this.mixer.mix(out, this.totalRows * this.samplesPerRow, extraTail);
    onProgress(1);
    return normalize(trimSilence(out));
  }

  processRow(row) {
    const events = this.rows.get(row) || [];
    for (const event of events) {
      const channel = this.channels[event.channel];
      let instrument = event.instrument;
      let volume = event.pitch;
      let pan = -1;
      let effect = event.effect;
      let param = event.param;

      if (effect === 14) {
        effect = effect * 16 + Math.trunc(param / 16);
        param &= 15;
      }
      if (volume >= 176 && volume < 192) {
        pan = (volume - 176) * 17;
        volume = -1;
      }
      if (volume > 64) volume = -1;
      if (effect === 12) volume = param;
      if (effect === 8) pan = param;
      if (effect === 16) this.globalVolume = param;
      if (effect === 20) event.note = 97;

      if (event.note >= 0 && event.note <= 96) {
        if (instrument < 0) {
          instrument = channel.instrument;
        } else {
          channel.instrument = instrument;
          instrument = event.note < 96 ? this.track.p[instrument][event.note] : this.track.p[instrument][95];
        }
        if (volume < 0) volume = channel.volume;
        if (pan < 0) pan = channel.pan;
        this.startVoice(event.channel, instrument, event.note, volume, pan, effect, param);
      } else if (event.note > 96) {
        this.mixer.removeChannel(event.channel);
        channel.voice = null;
      } else {
        if (volume >= 0) channel.volume = volume;
        if (pan >= 0) channel.pan = pan;
        if (channel.voice) channel.voice.setVolume(channel.volume * this.globalVolume * this.masterVolume / 4096, channel.pan);
      }
    }
  }

  applyTickEffects() {
    for (const channel of this.channels) {
      if (!channel.voice) continue;
      channel.voice.setVolume(channel.volume * this.globalVolume * this.masterVolume / 4096, channel.pan);
    }
  }

  startVoice(channelIndex, instrumentIndex, note, volume, pan, effect, param) {
    const instrument = this.instrument(instrumentIndex);
    const sample = this.bank.samples.get(`${instrument.bank}:${instrument.sampleId}`);
    if (!sample) return;
    const pitchIndex = clamp(7680 - (note + instrument.b) * 64 - Math.trunc(instrument.l / 2), 0, 7999);
    const step = (PITCH_TABLE[pitchIndex] * 256 / SAMPLE_RATE) / 256;
    const voice = new Ei(
      sample,
      step,
      volume * this.globalVolume * this.masterVolume / 4096,
      pan,
      channelIndex,
      instrument
    );
    if (effect === 9) {
      voice.pos = Math.min(sample.pcm.length - 1, param * 256);
    }
    this.mixer.removeChannel(channelIndex);
    this.mixer.add(voice);
    this.channels[channelIndex].instrument = instrumentIndex;
    this.channels[channelIndex].volume = volume;
    this.channels[channelIndex].pan = pan;
    this.channels[channelIndex].pitchIndex = pitchIndex;
    this.channels[channelIndex].voice = voice;
  }

  instrument(index) {
    const M = this.track.M[index] || 0;
    return {
      index,
      M: M & 15,
      bank: (M >> 4) !== 0 ? "vorbis" : "synth",
      sampleId: this.track.y[index],
      b: this.track.b[index] || 0,
      l: this.track.l[index] || 0,
      G: this.track.G[index] ?? 64,
      n: this.track.n[index] ?? 128
    };
  }
}

function groupByRow(events) {
  const rows = new Map();
  for (const event of events) {
    if (!rows.has(event.absoluteRow)) rows.set(event.absoluteRow, []);
    rows.get(event.absoluteRow).push({ ...event });
  }
  return rows;
}

function trimSilence(samples) {
  let end = samples.length - 1;
  while (end > 0 && Math.abs(samples[end]) < 0.0005) end--;
  return samples.slice(0, Math.min(samples.length, end + Math.trunc(SAMPLE_RATE / 5)));
}

function normalize(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak <= 0.98) return samples;
  const gain = 0.98 / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}
