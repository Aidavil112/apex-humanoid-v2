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
  public analyser: AnalyserNode | null = null;
  public audioEl: HTMLAudioElement | null = null;
  public rmsBuf: Float32Array = new Float32Array(512);

  // Mic stream source node for user voice visualization
  private micSource: MediaStreamAudioSourceNode | null = null;
  private synthVoiceOsc: OscillatorNode | null = null;
  private synthVoiceGain: GainNode | null = null;

  public ensureCtx(): AudioContext | null {
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
      const micSource = this.actx.createMediaStreamSource(stream);
      // Connect to analyser only (NOT to destination) to avoid feedback howl!
      micSource.connect(this.analyser);
      this.micSource = micSource;
    } catch (e) {
      console.warn('Could not connect mic to audio analyzer', e);
    }
  }

  public disconnectMicStream() {
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {}
      this.micSource = null;
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

  public theme() {
    [523, 659, 784].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.13, gain: 0.055, delay: i * 0.06 })
    );
  }

  public analyserRms(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.rmsBuf as any);
    let s = 0;
    for (let i = 0; i < this.rmsBuf.length; i++) s += this.rmsBuf[i] * this.rmsBuf[i];
    return Math.min(1, Math.sqrt(s / this.rmsBuf.length) * 9);
  }
}

export const audio = new AudioEngine();
