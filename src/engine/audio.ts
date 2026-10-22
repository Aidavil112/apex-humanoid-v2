// Synthesized audio engine: ambient drone + live procedural sound effects (SFX) + dual mic/voice waveform analyzer
class AudioEngine {
  public actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private noiseBuf: AudioBuffer | null = null;
  private lastTick: number = 0;
  public soundOn: boolean = false;
  public sfxOn: boolean = true;
  public powered: boolean = true;
  public analyser: AnalyserNode | null = null;
  public micAnalyser: AnalyserNode | null = null;
  public audioEl: HTMLAudioElement | null = null;
  public rmsBuf: Float32Array = new Float32Array(512);
  public micRmsBuf: Float32Array = new Float32Array(512);

  // Mic stream source node for user voice visualization + pure 16kHz PCM WAV live capture
  private micSource: MediaStreamAudioSourceNode | null = null;
  private pcmNode: ScriptProcessorNode | null = null;
  private pcmSilentGain: GainNode | null = null;
  private synthVoiceOsc: OscillatorNode | null = null;
  private synthVoiceGain: GainNode | null = null;
  private activeVoiceSource: AudioBufferSourceNode | null = null;

  public ensureCtx(): AudioContext | null {
    if (!this.powered) return null;
    if (this.actx) {
      if (this.actx.state === 'suspended') {
        this.actx.resume().catch(() => {});
      }
      return this.actx;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    this.actx = new AC();

    this.analyser = this.actx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.82;

    this.master = this.actx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.actx.destination);
    this.master.connect(this.analyser);

    this.sfxBus = this.actx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.85 : 0.0;
    this.sfxBus.connect(this.actx.destination);
    this.sfxBus.connect(this.analyser);

    // Subtle silent sub-carrier to feed synthesizer voice activity envelope into analyser
    try {
      this.synthVoiceGain = this.actx.createGain();
      this.synthVoiceGain.gain.value = 0.0;
      this.synthVoiceOsc = this.actx.createOscillator();
      this.synthVoiceOsc.type = 'triangle';
      this.synthVoiceOsc.frequency.value = 160;
      this.synthVoiceOsc.connect(this.synthVoiceGain);
      // Connect to analyser only (not destination) so it generates waveform data without speaker audio
      this.synthVoiceGain.connect(this.analyser);
      this.synthVoiceOsc.start();
    } catch (e) {}

    return this.actx;
  }

  public connectMicStream(stream: MediaStream) {
    this.ensureCtx();
    if (!this.actx || !this.analyser) return;

    try {
      if (this.micSource) {
        this.micSource.disconnect();
      }
      if (!this.micAnalyser) {
        this.micAnalyser = this.actx.createAnalyser();
        this.micAnalyser.fftSize = 512;
        this.micAnalyser.smoothingTimeConstant = 0.35;
      }
      const micSource = this.actx.createMediaStreamSource(stream);
      // Connect to dedicated micAnalyser (pure mic level) + visual analyser (NEVER destination)
      micSource.connect(this.micAnalyser);
      micSource.connect(this.analyser);
      this.micSource = micSource;
    } catch (e) {
      console.warn('Could not connect mic to audio analyzer', e);
    }
  }

  public disconnectMicStream() {
    if (this.pcmNode) {
      try {
        this.pcmNode.onaudioprocess = null;
        this.pcmNode.disconnect();
      } catch (e) {}
      this.pcmNode = null;
    }
    if (this.pcmSilentGain) {
      try {
        this.pcmSilentGain.disconnect();
      } catch (e) {}
      this.pcmSilentGain = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {}
      this.micSource = null;
    }
  }

  /** Encode 16kHz Float32 mono PCM chunks into a universally valid 16-bit RIFF WAV ArrayBuffer. */
  public static encodeWav16k(chunks: Float32Array[]): ArrayBuffer {
    let totalSamples = 0;
    for (const c of chunks) totalSamples += c.length;
    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, 16000, true); // 16 kHz
    view.setUint32(28, 32000, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeStr(36, 'data');
    view.setUint32(40, totalSamples * 2, true);
    let offset = 44;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return buffer;
  }

  /**
   * Bulletproof hardware-direct 16kHz PCM voice capture with adaptive room-noise floor.
   * Works identically in Android APK WebView, Chrome Mobile, iOS Safari, and Desktop!
   */
  public async startLivePcmCapture(
    stream: MediaStream,
    opts: {
      isMutedGate: () => boolean;
      onLevel: (lvl: number) => void;
      onUtteranceWav: (wavBuf: ArrayBuffer) => void;
    }
  ): Promise<() => void> {
    const ctx = this.ensureCtx();
    if (!ctx) return () => {};
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    this.disconnectMicStream();
    this.connectMicStream(stream);
    if (!this.micSource) return () => {};

    const inRate = ctx.sampleRate || 48000;
    const ratio = inRate / 16000;

    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const zeroGain = ctx.createGain();
    zeroGain.gain.value = 0.0; // Required on Chrome/Android so onaudioprocess ticks continuously with ZERO speaker output!
    this.micSource.connect(proc);
    proc.connect(zeroGain);
    zeroGain.connect(ctx.destination);
    this.pcmNode = proc;
    this.pcmSilentGain = zeroGain;

    let preRoll: Float32Array[] = [];
    let speechChunks: Float32Array[] = [];
    let inSpeech = false;
    let speechFrames = 0;
    let silenceFrames = 0;
    let noiseFloor = 0.012;

    const downsample16k = (input: Float32Array): Float32Array => {
      if (Math.abs(ratio - 1) < 0.02) return new Float32Array(input);
      const outLen = Math.max(1, Math.floor(input.length / ratio));
      const out = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(input.length, Math.floor((i + 1) * ratio));
        let acc = 0;
        let cnt = 0;
        for (let j = start; j < end; j++) {
          acc += input[j];
          cnt++;
        }
        out[i] = cnt > 0 ? acc / cnt : input[start] || 0;
      }
      return out;
    };

    const flushNow = () => {
      if (speechChunks.length < 3) {
        speechChunks = [];
        inSpeech = false;
        speechFrames = 0;
        silenceFrames = 0;
        return;
      }
      const wav = AudioEngine.encodeWav16k(speechChunks);
      speechChunks = [];
      inSpeech = false;
      speechFrames = 0;
      silenceFrames = 0;
      opts.onUtteranceWav(wav);
    };

    proc.onaudioprocess = (ev) => {
      if (!this.powered) return;
      const ch = ev.inputBuffer.getChannelData(0);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < ch.length; i++) {
        const a = Math.abs(ch[i]);
        sum += a * a;
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / ch.length);
      const uiLevel = Math.min(1, Math.max(rms * 16, peak * 5));
      opts.onLevel(uiLevel);

      if (opts.isMutedGate()) {
        inSpeech = false;
        speechFrames = 0;
        silenceFrames = 0;
        speechChunks = [];
        return;
      }

      const pcm16 = downsample16k(ch);
      const threshold = Math.max(0.012, Math.min(0.06, noiseFloor * 2.25));

      if (rms > threshold) {
        if (!inSpeech) {
          inSpeech = true;
          speechChunks = [...preRoll];
        }
        speechChunks.push(pcm16);
        speechFrames++;
        silenceFrames = 0;
        // Max ~7s per turn so user never waits long
        if (speechFrames >= 165) {
          flushNow();
        }
      } else {
        // Slowly adapt room/fan baseline when not actively speaking
        if (!inSpeech) {
          noiseFloor = noiseFloor * 0.94 + rms * 0.06;
          preRoll.push(pcm16);
          if (preRoll.length > 8) preRoll.shift(); // ~340ms pre-speech buffer!
        } else {
          speechChunks.push(pcm16);
          silenceFrames++;
          // ~560ms pause after real speech (>= 4 frames ~= 170ms) -> send immediately!
          if (silenceFrames >= 13) {
            if (speechFrames >= 4) {
              flushNow();
            } else {
              inSpeech = false;
              speechFrames = 0;
              silenceFrames = 0;
              speechChunks = [];
            }
          }
        }
      }
    };

    return flushNow;
  }

  public stopVoiceBuffer() {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.onended = null;
        this.activeVoiceSource.stop();
        this.activeVoiceSource.disconnect();
      } catch (e) {}
      this.activeVoiceSource = null;
    }
  }

  public async playVoiceArrayBuffer(
    rawBuf: ArrayBuffer,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<boolean> {
    if (!this.powered) return false;
    const ctx = this.ensureCtx();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      this.stopVoiceBuffer();
      const decoded = await ctx.decodeAudioData(rawBuf.slice(0));
      if (!this.powered) return false;
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 1.0;
      src.connect(voiceGain);
      voiceGain.connect(ctx.destination);
      if (this.analyser) {
        voiceGain.connect(this.analyser);
      }
      this.activeVoiceSource = src;
      src.onended = () => {
        if (this.activeVoiceSource === src) {
          this.activeVoiceSource = null;
        }
        onEnd?.();
      };
      onStart?.();
      src.start(0);
      return true;
    } catch (e) {
      console.warn('WebAudio decode/play failed:', e);
      return false;
    }
  }

  public triggerVoicePulse(amplitude: number = 0.8) {
    if (!this.actx || !this.synthVoiceGain) return;
    try {
      const t = this.actx.currentTime;
      this.synthVoiceGain.gain.cancelScheduledValues(t);
      this.synthVoiceGain.gain.setValueAtTime(amplitude * 0.7, t);
      this.synthVoiceGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    } catch (e) {}
  }

  public buildAmbient() {
    if (!this.ensureCtx() || !this.actx || !this.master) return;
    if (this.nodes.length > 0) return;

    try {
      const filt = this.actx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 520;
      filt.Q.value = 0.9;
      filt.connect(this.master);

      const drone = this.actx.createOscillator();
      drone.type = 'sawtooth';
      drone.frequency.value = 55;
      const dg = this.actx.createGain();
      dg.gain.value = 0.055;
      drone.connect(dg).connect(filt);
      drone.start();

      const fifth = this.actx.createOscillator();
      fifth.type = 'sine';
      fifth.frequency.value = 82.4;
      const fg = this.actx.createGain();
      fg.gain.value = 0.05;
      fifth.connect(fg).connect(filt);
      fifth.start();

      const lfo = this.actx.createOscillator();
      lfo.frequency.value = 0.07;
      const lg = this.actx.createGain();
      lg.gain.value = 220;
      lfo.connect(lg).connect(filt.frequency);
      lfo.start();

      const len = this.actx.sampleRate * 4;
      const buf = this.actx.createBuffer(1, len, this.actx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.35;
      const noise = this.actx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const nf = this.actx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 1400;
      nf.Q.value = 0.55;
      const ng = this.actx.createGain();
      ng.gain.value = 0.022;
      noise.connect(nf).connect(ng).connect(this.master);
      noise.start();

      this.nodes = [drone, fifth, lfo, noise];
    } catch (e) {
      console.warn('Audio ambient init error', e);
    }
  }

  public setSound(on: boolean) {
    this.ensureCtx();
    this.buildAmbient();
    this.soundOn = on;
    if (this.master && this.actx) {
      this.master.gain.cancelScheduledValues(this.actx.currentTime);
      this.master.gain.linearRampToValueAtTime(on ? 0.5 : 0.0, this.actx.currentTime + 1.0);
    }
  }

  public setSfx(on: boolean) {
    this.ensureCtx();
    this.sfxOn = on;
    if (this.sfxBus) {
      this.sfxBus.gain.value = on ? 0.85 : 0.0;
    }
  }

  private getNoise(): AudioBufferSourceNode | null {
    if (!this.actx) return null;
    if (!this.noiseBuf) {
      const n = Math.floor(this.actx.sampleRate * 1.2);
      this.noiseBuf = this.actx.createBuffer(1, n, this.actx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = this.actx.createBufferSource();
    src.buffer = this.noiseBuf;
    return src;
  }

  public tone({
    freq = 440,
    to = null as number | null,
    dur = 0.12,
    type = 'sine' as OscillatorType,
    gain = 0.12,
    delay = 0,
  }) {
    if (!this.actx || !this.sfxOn || !this.sfxBus) return;
    const t0 = this.actx.currentTime + delay;
    const o = this.actx.createOscillator();
    const g = this.actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  public sweep({ from = 300, to = 2400, dur = 0.5, q = 1.4, gain = 0.1, delay = 0 }) {
    if (!this.actx || !this.sfxOn || !this.sfxBus) return;
    const src = this.getNoise();
    if (!src) return;
    const t0 = this.actx.currentTime + delay;
    const bp = this.actx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this.actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  public tick(v = 0.5) {
    const now = performance.now();
    if (now - this.lastTick < 55) return;
    this.lastTick = now;
    this.tone({ freq: 1500 + v * 900, to: 700 + v * 500, dur: 0.045, type: 'square', gain: 0.035 });
  }

  public hover() {
    this.tone({ freq: 2200, dur: 0.03, type: 'sine', gain: 0.018 });
  }

  public acquire() {
    this.tone({ freq: 520, to: 1040, dur: 0.13, type: 'triangle', gain: 0.1 });
    this.tone({ freq: 780, to: 1560, dur: 0.16, type: 'sine', gain: 0.05, delay: 0.05 });
  }

  public release() {
    this.tone({ freq: 640, to: 260, dur: 0.22, type: 'triangle', gain: 0.075 });
  }

  public mood(m: string) {
    if (m === 'listening') {
      this.tone({ freq: 740, to: 1180, dur: 0.16, gain: 0.09 });
      this.tone({ freq: 1480, dur: 0.12, gain: 0.04, delay: 0.09 });
    } else if (m === 'thinking') {
      this.tone({ freq: 330, to: 495, dur: 0.22, type: 'triangle', gain: 0.085 });
      this.tone({ freq: 660, dur: 0.18, gain: 0.045, delay: 0.1 });
    } else if (m === 'speaking') {
      this.tone({ freq: 220, to: 440, dur: 0.18, type: 'sawtooth', gain: 0.055 });
      this.tone({ freq: 880, to: 1320, dur: 0.16, gain: 0.05, delay: 0.06 });
    } else if (m === 'happy') {
      this.tone({ freq: 523, to: 659, dur: 0.14, type: 'sine', gain: 0.08 });
      this.tone({ freq: 784, to: 1046, dur: 0.18, type: 'triangle', gain: 0.06, delay: 0.08 });
    } else if (m === 'excited') {
      this.tone({ freq: 587, to: 880, dur: 0.12, type: 'sine', gain: 0.085 });
      this.tone({ freq: 880, to: 1320, dur: 0.14, type: 'triangle', gain: 0.07, delay: 0.06 });
      this.tone({ freq: 1760, dur: 0.16, type: 'sine', gain: 0.045, delay: 0.12 });
    } else if (m === 'angry') {
      this.tone({ freq: 180, to: 110, dur: 0.22, type: 'sawtooth', gain: 0.09 });
      this.tone({ freq: 360, to: 180, dur: 0.16, type: 'square', gain: 0.04, delay: 0.04 });
    } else if (m === 'sad') {
      this.tone({ freq: 440, to: 349, dur: 0.32, type: 'sine', gain: 0.07 });
      this.tone({ freq: 261, dur: 0.28, type: 'triangle', gain: 0.05, delay: 0.1 });
    } else if (m === 'surprised') {
      this.tone({ freq: 660, to: 1320, dur: 0.15, type: 'sine', gain: 0.09 });
      this.tone({ freq: 1760, dur: 0.1, type: 'triangle', gain: 0.05, delay: 0.08 });
    } else if (m === 'calm') {
      this.tone({ freq: 432, dur: 0.38, type: 'sine', gain: 0.06 });
      this.tone({ freq: 648, dur: 0.32, type: 'sine', gain: 0.035, delay: 0.1 });
    } else if (m === 'neutral') {
      this.tone({ freq: 520, to: 480, dur: 0.18, type: 'sine', gain: 0.05 });
    } else {
      this.tone({ freq: 560, to: 300, dur: 0.2, gain: 0.07 });
    }
  }

  public heartThump(elevated = false) {
    if (!this.actx) return;
    const gain = elevated ? 0.075 : 0.04;
    // Systolic S1 "lub"
    this.tone({ freq: elevated ? 68 : 52, to: 40, dur: 0.07, type: 'sine', gain });
    // Diastolic S2 "dub"
    this.tone({ freq: elevated ? 76 : 58, to: 45, dur: 0.05, type: 'sine', gain: gain * 0.75, delay: 0.1 });
  }

  public whoosh() {
    this.sweep({ from: 220, to: 3200, dur: 0.75, q: 1.1, gain: 0.11 });
  }

  public assemble() {
    this.sweep({ from: 180, to: 5200, dur: 1.5, q: 0.9, gain: 0.1 });
    this.tone({ freq: 110, to: 55, dur: 1.4, type: 'sine', gain: 0.09 });
  }

  public powerUp() {
    this.tone({ freq: 140, to: 700, dur: 0.35, type: 'sawtooth', gain: 0.06 });
    this.sweep({ from: 600, to: 2600, dur: 0.4, gain: 0.05 });
  }

  /** Hard master shutdown: silences all buses immediately, tears down ambient oscillators, and suspends hardware AudioContext. */
  public powerOff() {
    this.powered = false;
    this.disconnectMicStream();
    for (const n of this.nodes) {
      try {
        n.stop();
        n.disconnect();
      } catch (e) {}
    }
    this.nodes = [];
    if (this.actx) {
      const t = this.actx.currentTime;
      if (this.master) {
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.value = 0;
      }
      if (this.sfxBus) {
        this.sfxBus.gain.cancelScheduledValues(t);
        this.sfxBus.gain.value = 0;
      }
      if (this.synthVoiceGain) {
        this.synthVoiceGain.gain.cancelScheduledValues(t);
        this.synthVoiceGain.gain.value = 0;
      }
      this.stopVoiceBuffer();
      if (this.actx.state !== 'closed') {
        this.actx.suspend().catch(() => {});
      }
    }
  }

  /** Restore master audio engine after powerOff(). */
  public powerOn(soundEnabled: boolean, sfxEnabled: boolean) {
    this.powered = true;
    this.sfxOn = sfxEnabled;
    this.soundOn = soundEnabled;
    const ctx = this.ensureCtx();
    if (ctx && this.sfxBus) {
      this.sfxBus.gain.cancelScheduledValues(ctx.currentTime);
      this.sfxBus.gain.value = sfxEnabled ? 0.85 : 0.0;
    }
    if (soundEnabled) {
      this.setSound(true);
    }
    this.powerUp();
  }

  public theme() {
    [523, 659, 784].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.13, gain: 0.055, delay: i * 0.06 })
    );
  }

  public analyserRms(): number {
    if (!this.powered || !this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.rmsBuf as any);
    let s = 0;
    for (let i = 0; i < this.rmsBuf.length; i++) s += this.rmsBuf[i] * this.rmsBuf[i];
    return Math.min(1, Math.sqrt(s / this.rmsBuf.length) * 9);
  }

  /** Pure isolated microphone level (0..1) unaffected by speaker/ambient buses. */
  public micRms(): number {
    if (!this.powered || !this.micAnalyser || !this.micSource) return 0;
    this.micAnalyser.getFloatTimeDomainData(this.micRmsBuf as any);
    let s = 0;
    let peak = 0;
    for (let i = 0; i < this.micRmsBuf.length; i++) {
      const v = Math.abs(this.micRmsBuf[i]);
      s += v * v;
      if (v > peak) peak = v;
    }
    const rms = Math.sqrt(s / this.micRmsBuf.length);
    return Math.min(1, Math.max(rms * 18, peak * 6));
  }
}

export const audio = new AudioEngine();
