import { CharacterConfig, MoodConfig, MoodType } from '../types';

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261019);
const TAU = Math.PI * 2;

function gauss() {
  let u = 0, v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
};

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'nova',
    name: 'Nova',
    head: { cx: 0, cy: 1.205, cz: 0.015, rx: 0.25, ry: 0.318, rz: 0.272 },
    jaw: 0.42,
    brow: 1.0,
    hair: { n: 26000, r: 1.055, lift: 0.045, style: 'bob' },
    shoulders: 1.0,
    waist: 1.0,
    eyes: { y: 0.02, x: 0.083, r: 0.03, glow: 1.0 },
    rings: 2,
    armor: 0,
  },
  {
    id: 'astra',
    name: 'Astra',
    head: { cx: 0, cy: 1.215, cz: 0.015, rx: 0.238, ry: 0.31, rz: 0.262 },
    jaw: 0.5,
    brow: 1.15,
    hair: { n: 34000, r: 1.075, lift: 0.075, style: 'long' },
    shoulders: 0.92,
    waist: 0.86,
    eyes: { y: 0.015, x: 0.078, r: 0.028, glow: 1.3 },
    rings: 3,
    armor: 0,
  },
  {
    id: 'unit7',
    name: 'Unit 7',
    head: { cx: 0, cy: 1.205, cz: 0.015, rx: 0.262, ry: 0.3, rz: 0.268 },
    jaw: 0.22,
    brow: 0.7,
    hair: null,
    shoulders: 1.18,
    waist: 1.1,
    eyes: { y: 0.02, x: 0.09, r: 0.034, glow: 1.6 },
    rings: 2,
    armor: 1,
  },
];

export const PORTRAIT_AVATARS: CharacterConfig[] = [
  {
    id: 'ninja',
    name: 'KAZE',
    src: 'data:image/jpeg;base64,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',
    view: { step: 1, scale: 0.92, y: 0.34, gain: 0.9, cutBg: true, bgTol: 12, bgLum: 0.46 },
  },
  {
    id: 'hustler',
    name: 'VEGA',
    src: 'data:image/jpeg;base64,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',
    view: { step: 1, scale: 0.92, y: 0.34, gain: 0.9, cutBg: true, bgTol: 12, bgLum: 0.46 },
  },
];

export const ALL_AVATARS: CharacterConfig[] = [...CHARACTERS, ...PORTRAIT_AVATARS];

export const THEMES = [
  { id: 'cyan', name: 'cyan', accent: [0.24, 0.74, 1.0] as [number, number, number], core: [1.0, 0.52, 0.1] as [number, number, number] },
  { id: 'violet', name: 'violet', accent: [0.62, 0.46, 1.0] as [number, number, number], core: [1.0, 0.36, 0.62] as [number, number, number] },
  { id: 'mint', name: 'mint', accent: [0.3, 1.0, 0.72] as [number, number, number], core: [1.0, 0.72, 0.16] as [number, number, number] },
  { id: 'amber', name: 'amber', accent: [1.0, 0.72, 0.3] as [number, number, number], core: [1.0, 0.3, 0.18] as [number, number, number] },
];

export const MOODS: Record<MoodType, MoodConfig> = {
  idle: { core: [1.0, 0.52, 0.1], amt: 0.85, label: 'idle' },
  listening: { core: [0.3, 0.82, 1.0], amt: 1.25, label: 'listening' },
  thinking: { core: [1.0, 0.7, 0.16], amt: 1.55, label: 'thinking' },
  speaking: { core: [1.0, 0.42, 0.22], amt: 1.45, label: 'speaking' },
  happy: { core: [1.0, 0.84, 0.15], amt: 1.7, label: 'happy' },
  excited: { core: [1.0, 0.38, 0.08], amt: 2.25, label: 'excited' },
  sad: { core: [0.22, 0.38, 0.98], amt: 0.62, label: 'sad' },
  angry: { core: [1.0, 0.12, 0.08], amt: 2.15, label: 'angry' },
  surprised: { core: [0.94, 0.22, 1.0], amt: 1.9, label: 'surprised' },
  calm: { core: [0.15, 0.95, 0.68], amt: 0.95, label: 'calm' },
  neutral: { core: [0.68, 0.82, 0.98], amt: 1.0, label: 'neutral' },
};

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number];
  type: 'BUY' | 'SELL';
}

interface TradeBurstAnnouncement {
  text: string;
  subtext: string;
  type: 'BUY' | 'SELL';
  life: number;
  maxLife: number;
  y: number;
}

interface BurstRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

export class WebGLEngine {
  // Particle-Burst Animation Engine (Auto-Trader Buy/Sell Execution)
  private burstParticles: BurstParticle[] = [];
  private burstRings: BurstRing[] = [];
  private burstAnnouncements: TradeBurstAnnouncement[] = [];

  public triggerTradeBurst(type: 'BUY' | 'SELL', details?: { pair?: string; price?: number; profit?: number }) {
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;
    const isMobile = w < h;
    const cx = w * 0.5;
    const cy = h * (isMobile ? 0.34 : 0.36);

    // Dynamic core pulse excitation in 3D WebGL
    this.heartPulse = 1.0;
    this.voiceTarget = 1.0;

    const count = isMobile ? 85 : 120;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 320 + 90) * (isMobile ? 0.85 : 1.0);
      const spreadY = type === 'BUY' ? -0.42 : -0.15;
      const maxLife = Math.random() * 0.75 + 0.95;

      const pCol: [number, number, number] =
        type === 'BUY'
          ? Math.random() > 0.3
            ? [0.0, 0.96, 0.62]
            : [0.0, 0.88, 1.0]
          : Math.random() > 0.35
          ? [1.0, 0.82, 0.22]
          : [1.0, 0.32, 0.18];

      this.burstParticles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + spreadY * speed,
        life: 0,
        maxLife,
        size: Math.random() * 4.2 + 2.2,
        color: pCol,
        type,
      });
    }

    // Concentric expanding shockwave rings
    const ringColor = type === 'BUY' ? 'rgba(0, 245, 160, 0.85)' : 'rgba(255, 175, 40, 0.85)';
    this.burstRings.push({
      x: cx,
      y: cy,
      radius: 18,
      maxRadius: Math.min(w, h) * (isMobile ? 0.38 : 0.32),
      life: 0,
      maxLife: 1.1,
      color: ringColor,
    });
    this.burstRings.push({
      x: cx,
      y: cy,
      radius: 8,
      maxRadius: Math.min(w, h) * (isMobile ? 0.52 : 0.44),
      life: 0.15,
      maxLife: 1.3,
      color: ringColor,
    });

    const label =
      type === 'BUY'
        ? `▲ AUTO BUY ${details?.pair || ''}`
        : `▼ PROFIT SECURED +$${details?.profit ? Math.round(details.profit) : '210'}`;
    const sub = details?.price ? `@ $${details.price.toLocaleString()}` : 'ALGO SIGNAL';

    this.burstAnnouncements.push({
      text: label,
      subtext: sub,
      type,
      life: 0,
      maxLife: 1.7,
      y: cy - 42,
    });
  }
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private hudCanvas: HTMLCanvasElement;
  private hctx: CanvasRenderingContext2D;

  private prog: WebGLProgram;
  private prog0: WebGLProgram;
  private BUF: Record<number, { b: WebGLBuffer; size: number }> = {};
  private U: Record<string, WebGLUniformLocation> = {};
  private count: number = 0;

  // Packed geometry arrays
  private aPos: Float32Array = new Float32Array(0);
  private aNrm: Float32Array = new Float32Array(0);
  private aBand: Float32Array = new Float32Array(0);
  private aSeed: Float32Array = new Float32Array(0);
  private aType: Float32Array = new Float32Array(0);
  private aWeight: Float32Array = new Float32Array(0);
  private aSize: Float32Array = new Float32Array(0);

  // Sub-systems
  private ORB: any;
  private BG: any;
  private PHOTO: any;

  // Animation & Rendering State
  public mood: MoodType = 'idle';
  public themeIdx: number = 0;
  public charIdx: number = 0;
  public started: boolean = false;
  public assemble: number = 0;
  public density: number = 1.0;
  public bgOn: boolean = true;
  public photoMode: boolean = false;

  public yaw: number = 0;
  public pitch: number = 0;
  public targetYaw: number = 0;
  public targetPitch: number = 0;

  public cur: [number, number, number] = [1.0, 0.52, 0.1];
  public curAmt: number = 0.85;
  public accentCur: [number, number, number] = [0.24, 0.74, 1.0];

  public voiceEnv: number = 0;
  public voiceTarget: number = 0;

  // Virtual Cardiac Rhythm & Pulse Engine
  public heartRate: number = 72;
  public targetHeartRate: number = 72;
  public heartPulse: number = 0;
  public heartPhase: number = 0;
  public onHeartRateUpdate?: (bpm: number, pulse: number, phase: number, isElevated: boolean) => void;

  private t0: number = performance.now();
  private lastTime: number = performance.now();
  private frames: number = 0;
  private fpsT: number = performance.now();
  public onFpsUpdate?: (fps: number, points: number) => void;
  private running: boolean = true;

  constructor(canvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.hudCanvas = hudCanvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('No WebGL2 support');
    this.gl = gl;
    this.hctx = hudCanvas.getContext('2d')!;

    this.initShaders();
    this.initOrb();
    this.initBg();
    this.initPhoto();

    this.buildFigure(CHARACTERS[0]);
    this.initBuffers();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.01, 0.02, 0.03, 1.0);
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
    }
    return sh;
  }

  private initShaders() {
    const gl = this.gl;
    const VS = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec3 aNrm;
    layout(location=2) in float aBand;
    layout(location=3) in float aSeed;
    layout(location=4) in float aType;
    layout(location=5) in float aWeight;
    layout(location=6) in float aSize;

    uniform mat4 uViewProj;
    uniform float uTime, uYaw, uPitch, uCoreAmt, uAssemble, uFocal, uDpr, uDensity, uHeartPulse;
    uniform vec3 uCoreCol;
    uniform vec3 uAccent;
    out vec3 vCol;
    out float vAlpha;

    mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
    mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }

    void main(){
      float t = uTime;
      if (aSeed > uDensity) {
        gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vCol = vec3(0.0); vAlpha = 0.0; return;
      }
      vec3 p = aPos;
      vec3 n = aNrm;

      p *= 1.0 + 0.007*sin(t*1.15 + p.y*1.6);

      float w = aWeight;
      mat3 R = rotY(uYaw*w) * rotX(uPitch*w);
      vec3 pivot = vec3(0.0, 0.95, 0.0);
      p = R*(p-pivot) + pivot;
      n = R*n;

      float asmPhase = clamp(uAssemble*1.65 - aSeed*0.65, 0.0, 1.0);
      float ease = 1.0 - pow(1.0-asmPhase, 3.0);
      p += n * (1.0-ease) * (0.55 + aSeed*0.9);
      float birthGlow = (1.0-ease) * 2.2;

      float ring = 0.5 + 0.5*sin(aBand + t*0.28);
      float thin = pow(ring, 26.0);
      float fill = 0.19 + 0.34*smoothstep(-0.30, 0.95, n.z);
      float rim  = pow(1.0 - abs(n.z), 3.4);
      float br = fill + 0.90*thin + 0.95*rim;
      br *= 0.86 + 0.20*sin(t*1.9 + aSeed*61.0);
      vec3 cyan = uAccent;
      vec3 col = cyan * br;

      float dc = length((p - vec3(0.0, 1.19, 0.05)) * vec3(1.0, 0.95, 0.55));
      float glow = exp(-dc*dc*9.0) * uCoreAmt;
      col += uCoreCol * glow * 0.26 * (1.0 + 0.50*uHeartPulse);

      float warm = exp(-pow(p.x/0.19,2.0)) * exp(-pow((p.y-0.62)/0.46,2.0)) * smoothstep(-0.2,0.9,n.z);
      col += uCoreCol * warm * (0.16 + 0.20*uCoreAmt) * (1.0 + 0.65*uHeartPulse);

      float size = aSize;

      if (aType > 5.5){
        float rr = pow(1.0 - abs(n.z), 2.0);
        col = mix(vec3(0.02,0.03,0.05), uAccent*0.55, rr) * (0.35 + 0.5*rr);
      } else if (aType > 4.5){
        float spin = fract(aSeed + t*0.045);
        float dash = pow(0.5 + 0.5*sin(aSeed*220.0 - t*4.0), 6.0);
        col = uAccent * (0.35 + 1.6*dash) * (0.6 + 0.5*uCoreAmt);
        size *= 1.4;
      } else if (aType > 3.5){
        col = uAccent * 2.2 * (0.75 + 0.25*sin(t*3.0 + aSeed*20.0));
        size *= 1.7;
      } else if (aType > 2.5){
        float breathe = 0.7 + 0.3*sin(t*1.3 + aSeed*7.0);
        col = uCoreCol * 0.008 * breathe * (0.5 + uCoreAmt*0.6) * (1.0 + 0.75*uHeartPulse);
        size *= (1.0 + 0.30*uHeartPulse);
      } else if (aType > 0.5 && aType < 1.5){
        // Core cluster particles pulsating in direct synchrony with virtual heart rate
        float pulse = 0.5 + 0.5*sin(t*2.1 + aSeed*11.0);
        float fall = 0.45 + 0.55*(1.0 - smoothstep(0.05, 0.20, length(p - vec3(0.0, 1.18, -0.02))));
        col = uCoreCol * (0.10 + 0.30*pulse + 0.85*uHeartPulse) * (0.35 + 0.65*uCoreAmt) * fall;
        size *= 1.55 * (1.0 + 0.70*uHeartPulse);
      } else if (aType > 1.5){
        float tw = pow(0.5+0.5*sin(t*1.4 + aSeed*90.0), 6.0);
        col = cyan * (0.05 + 0.85*tw);
      } else if (n.z < -0.08 && aType < 0.5) {
        gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vCol = vec3(0.0); vAlpha = 0.0; return;
      }

      col += uCoreCol * birthGlow * 0.35;

      vec4 mv = uViewProj * vec4(p, 1.0);
      gl_Position = mv;
      float dist = max(0.5, 3.1 - p.z*0.28);
      float cap = (aType > 2.5) ? 220.0 : 26.0;
      gl_PointSize = clamp(size * uFocal / dist * uDpr, 1.0, cap);

      vCol = col;
      vAlpha = aType > 0.5 ? 1.0 : (0.55 + 0.45*thin);
    }`;

    const FS = `#version 300 es
    precision highp float;
    in vec3 vCol;
    in float vAlpha;
    out vec4 fragColor;
    void main(){
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d,d);
      if (r > 0.25) discard;
      float a = smoothstep(0.25, 0.02, r);
      a *= a * a;
      fragColor = vec4(vCol * a * vAlpha, 1.0);
    }`;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compileShader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, this.compileShader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'Program link error');
    }
    this.prog = prog;
    this.prog0 = prog;
    gl.useProgram(prog);

    [
      'uViewProj',
      'uTime',
      'uYaw',
      'uPitch',
      'uCoreAmt',
      'uAssemble',
      'uFocal',
      'uDpr',
      'uDensity',
      'uCoreCol',
      'uAccent',
      'uHeartPulse',
    ].forEach((k) => (this.U[k] = gl.getUniformLocation(prog, k)!));
  }

  private initBuffers() {
    const gl = this.gl;
    const makeBuf = (loc: number, data: Float32Array, size: number) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      this.BUF[loc] = { b, size };
    };

    makeBuf(0, this.aPos, 3);
    makeBuf(1, this.aNrm, 3);
    makeBuf(2, this.aBand, 1);
    makeBuf(3, this.aSeed, 1);
    makeBuf(4, this.aType, 1);
    makeBuf(5, this.aWeight, 1);
    makeBuf(6, this.aSize, 1);
  }

  public reupload() {
    const gl = this.gl;
    const srcs = [this.aPos, this.aNrm, this.aBand, this.aSeed, this.aType, this.aWeight, this.aSize];
    for (const loc of [0, 1, 2, 3, 4, 5, 6]) {
      const h = this.BUF[loc];
      if (!h) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, h.b);
      gl.bufferData(gl.ARRAY_BUFFER, srcs[loc], gl.STATIC_DRAW);
    }
    this.count = this.aPos.length / 3;
  }

  private initOrb() {
    const gl = this.gl;
    const vs = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    layout(location=1) in float aSeed;
    uniform mat4 uViewProj;
    uniform float uTime, uFocal, uDpr, uPulse, uYaw;
    uniform vec3 uAccent;
    out vec3 vCol; out float vA;
    mat3 rotY(float a){ float c=cos(a),s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
    mat3 rotX(float a){ float c=cos(a),s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
    void main(){
      float t = uTime;
      vec3 p = rotY(t*0.22 + uYaw*0.9) * rotX(0.28 + sin(t*0.30)*0.08) * aPos;
      p *= 1.0 + 0.035*sin(t*1.6 + aSeed*6.0) + uPulse*0.13;
      p += vec3(0.0, 1.26, -1.05);
      vec4 mv = uViewProj * vec4(p, 1.0);
      gl_Position = mv;
      float dist = max(0.5, 3.1 - p.z*0.28);
      gl_PointSize = clamp((0.0042 + aSeed*0.0016) * uFocal / dist * uDpr, 1.0, 9.0);
      vec3 n = normalize(p - vec3(0.0, 1.26, -1.05));
      float rim = pow(1.0 - abs(n.z), 2.2);
      float band = pow(0.5 + 0.5*sin(p.y*46.0 - t*0.7), 10.0);
      float tw = pow(0.5 + 0.5*sin(t*2.2 + aSeed*63.0), 8.0);
      float fade = smoothstep(0.98, 1.30, p.y);
      vec3 col = uAccent * (0.05 + 0.40*rim + 0.85*band + 0.30*tw) * (0.55 + 0.8*uPulse);
      vCol = col * fade;
      vA = (0.16 + 0.40*rim + 0.35*band) * fade * 0.85;
    }`;

    const fs = `#version 300 es
    precision highp float;
    in vec3 vCol; in float vA; out vec4 o;
    void main(){
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d,d);
      if (r > 0.25) discard;
      float a = smoothstep(0.25, 0.02, r); a *= a;
      o = vec4(vCol * a * vA, 1.0);
    }`;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, this.compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);

    const U: Record<string, WebGLUniformLocation> = {};
    ['uViewProj', 'uTime', 'uFocal', 'uDpr', 'uPulse', 'uYaw', 'uAccent'].forEach(
      (k) => (U[k] = gl.getUniformLocation(prog, k)!)
    );

    const pos: number[] = [],
      seed: number[] = [];
    const R = 0.4;
    for (let i = 0; i < 26000; i++) {
      const d = [gauss(), gauss(), gauss()],
        l = Math.hypot(d[0], d[1], d[2]) || 1;
      const rr = R + gauss() * 0.012;
      pos.push((d[0] / l) * rr, (d[1] / l) * rr * 0.88, (d[2] / l) * rr);
      seed.push(rnd());
    }
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < 4200; i++) {
        const a = rnd() * TAU,
          rr = R * 1.14 + k * 0.06;
        pos.push(Math.cos(a) * rr, Math.sin(a) * rr * (k ? 0.14 : 0.005) + (k ? 0.02 : 0), Math.sin(a) * rr);
        seed.push(rnd());
      }
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const bp = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bp);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const bs = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, bs);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seed), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const n = seed.length;
    this.ORB = {
      draw: (vp: Float32Array, t: number, dpr: number, accent: number[], pulse: number) => {
        gl.useProgram(prog);
        gl.bindVertexArray(vao);
        gl.uniformMatrix4fv(U.uViewProj, false, vp);
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uDpr, dpr);
        gl.uniform1f(U.uPulse, pulse);
        gl.uniform1f(U.uYaw, this.yaw);
        gl.uniform1f(U.uFocal, (this.canvas.height * 0.5) / Math.tan((25 * Math.PI) / 180));
        gl.uniform3fv(U.uAccent, accent);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.bindVertexArray(null);
        gl.useProgram(this.prog0);
      },
    };
  }

  private initBg() {
    const gl = this.gl;
    const gx = 260,
      gz = 120;
    const gPos: number[] = [],
      gSeed: number[] = [];
    for (let j = 0; j < gz; j++) {
      for (let i = 0; i < gx; i++) {
        const u = (i + 0.5) / gx,
          v = (j + 0.5) / gz;
        const x = (u * 2 - 1) * 3.6;
        const z = -1.0 - v * 3.4;
        gPos.push(x, z);
        gSeed.push(Math.random());
      }
    }
    const n = gSeed.length;

    const vs = `#version 300 es
    precision highp float;
    layout(location=0) in vec2 aXZ;
    layout(location=1) in float aSeed;
    uniform mat4 uViewProj;
    uniform float uTime, uAmt, uFocal, uDpr;
    uniform vec3 uAccent, uCoreCol;
    out vec3 vCol;
    out float vA;

    float ridge(vec2 p, float t){
      float h = 0.0;
      h += sin(p.x*1.10 + t*0.09) * cos(p.y*0.85 - t*0.06) * 0.55;
      h += sin(p.x*2.30 - t*0.13 + 1.7) * 0.28;
      h += sin(p.x*4.60 + t*0.19 + 0.9) * cos(p.y*1.9) * 0.14;
      h += sin(p.y*3.20 - t*0.16 + 2.4) * 0.18;
      h += sin((p.x*0.9 + p.y*0.7)*5.1 + t*0.27) * 0.07;
      return h;
    }
    void main(){
      vec2 p = aXZ;
      float t = uTime;
      float h = ridge(p, t);
      float side = smoothstep(0.30, 1.30, abs(p.x));
      h *= mix(0.10, 1.0, side);
      vec3 pos = vec3(p.x, h * 0.58 - 0.92, p.y);
      vec4 mv = uViewProj * vec4(pos, 1.0);
      gl_Position = mv;
      float dist = max(0.5, 2.6 - p.y * 0.45);
      gl_PointSize = clamp(0.016 * uFocal / dist * uDpr, 1.0, 7.0);

      float band = pow(0.5 + 0.5*sin(h * 12.0 - t*0.45), 6.0);
      float crest = smoothstep(0.45, 1.10, h);
      float tw = pow(0.5 + 0.5*sin(t*1.5 + aSeed*93.0), 8.0);

      vec3 col = mix(uAccent, uCoreCol, crest*0.85);
      col *= 0.30 + 0.50*band + 0.55*crest + 0.30*tw;
      col *= 0.55 + 0.45*uAmt;

      float far  = smoothstep(-3.8, -1.6, p.y);
      float edge = smoothstep(3.6, 1.9, abs(p.x));
      float nearFade = 1.0 - smoothstep(-1.4, -0.5, p.y) * 0.75;
      vCol = col * (0.18 + 0.85*far) * (0.18 + 0.95*edge) * nearFade;
      vA = 0.5 + 0.5*band;
    }`;

    const fs = `#version 300 es
    precision highp float;
    in vec3 vCol; in float vA; out vec4 o;
    void main(){
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d,d);
      if (r > 0.25) discard;
      float a = smoothstep(0.25, 0.02, r); a *= a;
      o = vec4(vCol * a * vA, 1.0);
    }`;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, this.compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);

    const posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gPos), gl.STATIC_DRAW);

    const seedBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gSeed), gl.STATIC_DRAW);

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const U: Record<string, WebGLUniformLocation> = {};
    ['uViewProj', 'uTime', 'uAmt', 'uFocal', 'uDpr', 'uAccent', 'uCoreCol'].forEach(
      (k) => (U[k] = gl.getUniformLocation(prog, k)!)
    );

    this.BG = { prog, vao, n, U, on: true };
  }

  private initPhoto() {
    const gl = this.gl;
    const vs = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec3 aCol;
    layout(location=2) in float aSeed;
    uniform mat4 uViewProj;
    uniform float uTime, uFocal, uDpr, uGain, uDensity;
    out vec3 vCol;
    out float vA;
    void main(){
      if (aSeed > uDensity){ gl_Position = vec4(2.0); gl_PointSize = 0.0; vCol = vec3(0.0); vA = 0.0; return; }
      vec3 p = aPos;
      p.z += sin(uTime*0.9 + aPos.y*3.0 + aSeed*6.0) * 0.012;
      p.x += sin(uTime*0.6 + aPos.y*2.0) * 0.004;
      vec4 mv = uViewProj * vec4(p, 1.0);
      gl_Position = mv;
      float dist = max(0.5, 3.0 - p.z*0.4);
      gl_PointSize = clamp(0.0074 * uFocal / dist * uDpr, 1.0, 15.0);
      vCol = aCol * uGain;
      vA = 0.95;
    }`;

    const fs = `#version 300 es
    precision highp float;
    in vec3 vCol; in float vA; out vec4 o;
    void main(){
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d,d);
      if (r > 0.25) discard;
      float a = smoothstep(0.25, 0.02, r); a *= a;
      o = vec4(vCol * a * vA, 1.0);
    }`;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, this.compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);

    const U: Record<string, WebGLUniformLocation> = {};
    ['uViewProj', 'uTime', 'uFocal', 'uDpr', 'uGain', 'uDensity'].forEach(
      (k) => (U[k] = gl.getUniformLocation(prog, k)!)
    );

    const vao = gl.createVertexArray()!;
    const posBuf = gl.createBuffer()!;
    const colBuf = gl.createBuffer()!;
    const seedBuf = gl.createBuffer()!;

    this.PHOTO = {
      ready: false,
      count: 0,
      gain: 1.0,
      build: (img: HTMLImageElement, opts: any = {}) => {
        const step = opts.step || 1;
        const scale = opts.scale || 0.95;
        const yOff = opts.y !== undefined ? opts.y : 0.35;
        const cutBg = opts.cutBg !== false;
        const bgTol = opts.bgTol || 12;
        const bgLum = opts.bgLum || 0.45;

        const cw = Math.min(360, img.naturalWidth || img.width);
        const ch = Math.round(cw * ((img.naturalHeight || img.height) / (img.naturalWidth || img.width)));
        const off = document.createElement('canvas');
        off.width = cw;
        off.height = ch;
        const cx = off.getContext('2d')!;
        cx.drawImage(img, 0, 0, cw, ch);
        const imgData = cx.getImageData(0, 0, cw, ch).data;

        const pos: number[] = [],
          col: number[] = [],
          seed: number[] = [];
        const ar = cw / ch;

        for (let y = 0; y < ch; y += step) {
          for (let x = 0; x < cw; x += step) {
            const idx = (y * cw + x) * 4;
            const r = imgData[idx] / 255,
              g = imgData[idx + 1] / 255,
              b = imgData[idx + 2] / 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 0.05) continue;

            if (cutBg) {
              const cr = (x / cw - 0.5) * 2,
                cb = (y / ch - 0.5) * 2;
              if (Math.hypot(cr, cb) > 0.92 && lum < bgLum && Math.abs(r - g) < bgTol / 255) continue;
            }

            const nx = ((x / cw - 0.5) * 2 * ar) * scale;
            const ny = ((1.0 - y / ch - 0.5) * 2) * scale + yOff;
            const nz = (lum - 0.5) * 0.22;

            pos.push(nx, ny, nz);
            col.push(r, g, b);
            seed.push(Math.random());
          }
        }

        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(col), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seed), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        this.PHOTO.count = seed.length;
        this.PHOTO.ready = true;
      },
      draw: (vp: Float32Array, t: number, dpr: number, density: number) => {
        gl.useProgram(prog);
        gl.bindVertexArray(vao);
        gl.uniformMatrix4fv(U.uViewProj, false, vp);
        gl.uniform1f(U.uTime, t);
        gl.uniform1f(U.uDpr, dpr);
        gl.uniform1f(U.uDensity, density);
        gl.uniform1f(U.uGain, this.PHOTO.gain);
        gl.uniform1f(U.uFocal, (this.canvas.height * 0.5) / Math.tan((25 * Math.PI) / 180));
        gl.drawArrays(gl.POINTS, 0, this.PHOTO.count);
        gl.bindVertexArray(null);
        gl.useProgram(this.prog0);
      },
    };
  }

  public loadPhotoAvatar(img: HTMLImageElement, opts?: any) {
    this.PHOTO.build(img, opts);
    this.PHOTO.gain = 1.0;
    this.photoMode = true;
  }

  public buildFigure(cfg: CharacterConfig) {
    const P: number[] = [],
      N: number[] = [],
      B: number[] = [],
      S: number[] = [],
      T: number[] = [],
      W: number[] = [],
      Z: number[] = [];
    const TYPE_SHELL = 0,
      TYPE_CORE = 1,
      TYPE_HALO = 2,
      TYPE_HAZE = 3,
      TYPE_EYE = 4,
      TYPE_RING = 5,
      TYPE_HAIR = 6;

    const push = (
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      band: number,
      type: number,
      weight: number,
      size: number
    ) => {
      P.push(x, y, z);
      N.push(nx, ny, nz);
      B.push(band);
      S.push(rnd());
      T.push(type);
      W.push(weight);
      Z.push(size);
    };

    const prof = (y: number, keys: [number, number][]) => {
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i],
          b = keys[i + 1];
        if (y <= a[0] && y >= b[0]) {
          const t = (a[0] - y) / (a[0] - b[0] || 1);
          return a[1] + (b[1] - a[1]) * smoothstep(0, 1, t);
        }
      }
      return y > keys[0][0] ? keys[0][1] : keys[keys.length - 1][1];
    };

    const HEAD = cfg.head || { cx: 0, cy: 1.205, cz: 0.015, rx: 0.25, ry: 0.318, rz: 0.272 };
    const RING = TAU / 0.031;

    // Anatomically Sculpted Humanoid Head Shell (Jawline, Nose, Orbit Cavities, Cheekbones, Lips)
    const nShell = 180000;
    for (let i = 0; i < nShell; i++) {
      const u = rnd() * 2 - 1,
        phi = rnd() * TAU;
      const su = Math.sqrt(Math.max(0, 1 - u * u));
      let x = su * Math.cos(phi),
        y = u,
        z = su * Math.sin(phi);

      const d = [gauss(), gauss(), gauss()];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      x = x * 0.94 + (d[0] / dl) * 0.06;
      y = y * 0.94 + (d[1] / dl) * 0.06;
      z = z * 0.94 + (d[2] / dl) * 0.06;

      // 1. Jawline & Chin Taper
      if (y < 0) {
        const jawTaper = 1.0 - 0.36 * Math.pow(Math.abs(y), 1.25);
        x *= jawTaper;
        z *= 1.0 - 0.18 * Math.pow(Math.abs(y), 1.15);
      }

      // 2. Nose Bridge & Tip Projection
      if (z > 0) {
        const noseY = y - 0.02;
        const noseFactor = Math.exp(-70 * (x * x)) * Math.exp(-24 * (noseY * noseY));
        z += noseFactor * 0.38;
      }

      // 3. Eye Sockets / Orbital Cavities
      if (z > 0) {
        const eyeL = Math.hypot(x - 0.32, y - 0.08);
        const eyeR = Math.hypot(x + 0.32, y - 0.08);
        const socketIndent = Math.exp(-32 * eyeL * eyeL) + Math.exp(-32 * eyeR * eyeR);
        z -= socketIndent * 0.18;
      }

      // 4. Cheekbones / Zygomatic Arch
      if (z > 0) {
        const cheek = Math.exp(-28 * (Math.pow(Math.abs(x) - 0.48, 2) + Math.pow(y + 0.05, 2)));
        x *= 1.0 + cheek * 0.14;
        z += cheek * 0.12;
      }

      // 5. Lips & Mouth Contour
      if (z > 0 && y < -0.10 && y > -0.32) {
        const lipY = y + 0.20;
        const lipFactor = Math.exp(-55 * (x * x)) * Math.exp(-65 * (lipY * lipY));
        z += lipFactor * 0.14;
      }

      // 6. Forehead Ridge
      if (z > 0 && y > 0.22 && y < 0.70) {
        z += Math.exp(-14 * (x * x)) * 0.06;
      }

      let px = x * HEAD.rx,
        py = y * HEAD.ry + HEAD.cy,
        pz = z * HEAD.rz + HEAD.cz;
      let nx = x / HEAD.rx,
        ny = y / HEAD.ry,
        nz = z / HEAD.rz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      const band = (py - HEAD.cy) * RING;
      push(px, py, pz, nx, ny, nz, band, TYPE_SHELL, 1.0, 0.0032);
    }

    // High-Detail Expressive Facial Features (Eyes, Pupils, Eyebrows, Lips)
    const eyeOffsetX = cfg.eyes?.x || 0.083;
    const eyeOffsetY = cfg.eyes?.y || 0.02;
    for (const side of [-1, 1]) {
      const ex = side * eyeOffsetX;
      const ey = HEAD.cy + eyeOffsetY;
      const ez = HEAD.cz + HEAD.rz * 0.88;

      // Iris & Pupil Ring
      const nEye = 1800;
      for (let k = 0; k < nEye; k++) {
        const a = rnd() * TAU;
        const r = 0.006 + rnd() * 0.022;
        push(
          ex + Math.cos(a) * r,
          ey + Math.sin(a) * r,
          ez + (rnd() - 0.5) * 0.01,
          0,
          0,
          1,
          0,
          TYPE_EYE,
          1.0,
          0.0055
        );
      }
    }

    // Eyebrow Contours
    for (const side of [-1, 1]) {
      for (let k = 0; k < 600; k++) {
        const t = k / 600;
        const bx = side * (0.025 + t * 0.11);
        const by = HEAD.cy + 0.082 + Math.sin(t * Math.PI) * 0.018;
        const bz = HEAD.cz + HEAD.rz * 0.86 + Math.cos(t * Math.PI) * 0.01;
        push(
          bx + (rnd() - 0.5) * 0.008,
          by + (rnd() - 0.5) * 0.006,
          bz,
          0,
          0,
          1,
          0,
          TYPE_EYE,
          1.0,
          0.0048
        );
      }
    }

    // Lips & Mouth Arc
    for (let k = 0; k < 900; k++) {
      const t = k / 900;
      const lx = (t - 0.5) * 0.13;
      const ly = HEAD.cy - 0.16 + Math.pow(lx, 2) * 0.4;
      const lz = HEAD.cz + HEAD.rz * 0.85 + (1.0 - Math.pow(t - 0.5, 2) * 4) * 0.02;
      push(
        lx + (rnd() - 0.5) * 0.006,
        ly + (rnd() - 0.5) * 0.005,
        lz,
        0,
        0,
        1,
        0,
        TYPE_EYE,
        1.0,
        0.0042
      );
    }

    // Fiber-Optic Neural Neck, Shoulders & Chest Collar Structure (matching Instagram Reel)
    const nTorso = 65000;
    for (let i = 0; i < nTorso; i++) {
      const t = rnd(); // 0 at chin base, 1 at lower shoulders
      const y = HEAD.cy - HEAD.ry * 0.95 - t * 0.68;
      const widthFactor = 0.11 + t * 0.36 + Math.pow(t, 2) * 0.26;
      const angle = rnd() * TAU;
      const r = widthFactor * (0.86 + rnd() * 0.18);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r * 0.62 + HEAD.cz;

      const nx = x / (r || 1);
      const ny = -0.28;
      const nz = (z - HEAD.cz) / (r || 1);
      const band = y * RING;
      push(x, y, z, nx, ny, nz, band, TYPE_SHELL, 0.85 + (1 - t) * 0.15, 0.0034);
    }

    // Core
    for (let i = 0; i < 48000; i++) {
      const d = [gauss(), gauss(), gauss()];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      const r = Math.pow(rnd(), 0.65) * 0.16;
      push(
        HEAD.cx + (d[0] / dl) * r * 0.9,
        HEAD.cy + (d[1] / dl) * r * 0.9,
        HEAD.cz + (d[2] / dl) * r * 0.7,
        0,
        0,
        1,
        0,
        TYPE_CORE,
        0.9,
        0.0042
      );
    }

    // Orbit Rings
    const rings = cfg.rings || 2;
    for (let r = 0; r < rings; r++) {
      const n = 4200;
      const tilt = 0.95 + r * 0.26;
      const rad = 0.395 + r * 0.062;
      const st = Math.sin(tilt),
        ct = Math.cos(tilt);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const px = Math.cos(a) * rad,
          pz = Math.sin(a) * rad;
        push(px, HEAD.cy + pz * st, HEAD.cz + pz * ct, px / rad, 0, (pz * ct) / rad, 0, TYPE_RING, 1.0, 0.0026);
      }
    }

    // Eyes
    if (cfg.eyes) {
      const ey = cfg.eyes;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 1800; i++) {
          const a = rnd() * TAU;
          const rad = Math.sqrt(rnd()) * ey.r;
          push(
            s * ey.x + Math.cos(a) * rad,
            HEAD.cy + ey.y + Math.sin(a) * rad,
            HEAD.cz + HEAD.rz * 0.88,
            0,
            0,
            1,
            0,
            TYPE_EYE,
            1.0,
            0.0038
          );
        }
      }
    }

    this.aPos = new Float32Array(P);
    this.aNrm = new Float32Array(N);
    this.aBand = new Float32Array(B);
    this.aSeed = new Float32Array(S);
    this.aType = new Float32Array(T);
    this.aWeight = new Float32Array(W);
    this.aSize = new Float32Array(Z);
    this.count = this.aPos.length / 3;
  }

  private drawHud(now: number, accent: number[], dt: number) {
    const w = this.hudCanvas.width,
      h = this.hudCanvas.height;
    const isMobile = w < h;
    const hctx = this.hctx;
    hctx.clearRect(0, 0, w, h);
    const cx = w * 0.5,
      cy = h * (isMobile ? 0.34 : 0.36),
      R = Math.min(w, h) * (isMobile ? 0.23 : 0.22);
    const col = `rgb(${accent.map((v) => Math.round(v * 255)).join(',')})`;
    hctx.lineWidth = 1.2;
    hctx.strokeStyle = col;
    hctx.globalAlpha = 0.22;

    const t = (now - this.t0) / 1000;
    const a0 = t * 0.22;
    for (let i = 0; i < 3; i++) {
      const rr = R * (1.02 + i * 0.09);
      hctx.beginPath();
      hctx.setLineDash([rr * 0.06, rr * 0.14]);
      hctx.lineDashOffset = -t * (18 + i * 11);
      hctx.arc(cx, cy, rr, a0 + i * 1.1, a0 + i * 1.1 + Math.PI * 1.55);
      hctx.stroke();
    }
    hctx.setLineDash([]);

    const m = 24,
      L = 18;
    hctx.globalAlpha = 0.3;
    for (const [x, y, sx, sy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ]) {
      hctx.beginPath();
      hctx.moveTo(x, y + sy * L);
      hctx.lineTo(x, y);
      hctx.lineTo(x + sx * L, y);
      hctx.stroke();
    }

    const sweep = (t * 0.16) % 1;
    hctx.globalAlpha = 0.12;
    const gy = sweep * h;
    const grd = hctx.createLinearGradient(0, gy - 40, 0, gy + 10);
    grd.addColorStop(0, 'transparent');
    grd.addColorStop(1, col);
    hctx.fillStyle = grd;
    hctx.fillRect(0, gy - 40, w, 50);

    // Render Shockwave Rings (Auto-Trader Buy/Sell Execution)
    if (this.burstRings.length > 0) {
      hctx.save();
      for (let i = this.burstRings.length - 1; i >= 0; i--) {
        const ring = this.burstRings[i];
        ring.life += dt;
        if (ring.life >= ring.maxLife) {
          this.burstRings.splice(i, 1);
          continue;
        }
        const progress = ring.life / ring.maxLife;
        const currentR = ring.radius + (ring.maxRadius - ring.radius) * Math.sin(progress * Math.PI * 0.5);
        const alpha = Math.max(0, (1 - progress) * 0.82);

        hctx.beginPath();
        hctx.arc(ring.x, ring.y, currentR, 0, Math.PI * 2);
        hctx.strokeStyle = ring.color;
        hctx.globalAlpha = alpha;
        hctx.lineWidth = Math.max(1.2, 3.5 * (1 - progress));
        hctx.shadowColor = ring.color;
        hctx.shadowBlur = 12;
        hctx.setLineDash([16, 8]);
        hctx.stroke();
      }
      hctx.restore();
    }

    // Render Particle Burst Overlay (Auto-Trader Buy/Sell Execution)
    if (this.burstParticles.length > 0) {
      hctx.save();
      for (let i = this.burstParticles.length - 1; i >= 0; i--) {
        const p = this.burstParticles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          this.burstParticles.splice(i, 1);
          continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.955;
        p.vy *= 0.955;
        p.vy += (p.type === 'BUY' ? 45 : 75) * dt;

        const progress = p.life / p.maxLife;
        const alpha = Math.max(0, (1 - progress) * 0.9);
        const radius = p.size * (1 - progress * 0.35);

        const [r, g, b] = p.color.map((v) => Math.round(v * 255));
        hctx.beginPath();
        hctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        hctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        hctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        hctx.shadowBlur = 8;
        hctx.fill();

        // High-velocity spark trail
        hctx.beginPath();
        hctx.moveTo(p.x, p.y);
        hctx.lineTo(p.x - p.vx * 0.032, p.y - p.vy * 0.032);
        hctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`;
        hctx.lineWidth = 1;
        hctx.stroke();
      }
      hctx.restore();
    }

    // Render Floating Trade Burst Badge Announcements
    if (this.burstAnnouncements.length > 0) {
      hctx.save();
      for (let i = this.burstAnnouncements.length - 1; i >= 0; i--) {
        const a = this.burstAnnouncements[i];
        a.life += dt;
        if (a.life >= a.maxLife) {
          this.burstAnnouncements.splice(i, 1);
          continue;
        }

        const progress = a.life / a.maxLife;
        a.y -= dt * 26; // subtle float upward
        const alpha = Math.sin(progress * Math.PI) * 0.95;

        const isBuy = a.type === 'BUY';
        const color = isBuy ? '#00f5a0' : '#ffd13b';
        const border = isBuy ? 'rgba(0, 245, 160, 0.45)' : 'rgba(255, 209, 59, 0.45)';
        const bg = 'rgba(2, 8, 13, 0.97)';

        hctx.font = 'bold 11px monospace';
        const textW = hctx.measureText(a.text).width;
        const boxW = textW + 28;
        const boxH = 25;
        const bx = cx - boxW / 2;
        const by = a.y;

        // keep the badge opaque much longer so it stays legible on top of the white core
        const badgeAlpha = Math.min(1, alpha * 1.5);
        hctx.globalAlpha = badgeAlpha;
        hctx.fillStyle = bg;
        hctx.beginPath();
        hctx.roundRect(bx, by, boxW, boxH, 6);
        hctx.fill();

        hctx.strokeStyle = border;
        hctx.lineWidth = 1.2;
        hctx.shadowColor = color;
        hctx.shadowBlur = 8;
        hctx.stroke();
        hctx.shadowBlur = 0;

        hctx.globalAlpha = 1;
        hctx.fillStyle = color;
        hctx.fillText(a.text, bx + 14, by + 17);
      }
      hctx.restore();
    }

    hctx.globalAlpha = 1;
  }

  private perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1 / Math.tan(fovy / 2),
      nf = 1 / (near - far);
    return new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) * nf,
      -1,
      0,
      0,
      2 * far * near * nf,
      0,
    ]);
  }

  private lookAt(eye: number[], center: number[], up: number[]): Float32Array {
    let z = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]];
    let l = Math.hypot(...z);
    z = z.map((v) => v / l);
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
    l = Math.hypot(...x) || 1;
    x = x.map((v) => v / l);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return new Float32Array([
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
      1,
    ]);
  }

  private mul(a: Float32Array, b: Float32Array): Float32Array {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
    return o;
  }

  public resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.hudCanvas.width = Math.floor(w * dpr);
      this.hudCanvas.height = Math.floor(h * dpr);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  public frame(now: number) {
    if (!this.running) return;
    this.resize();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const t = (now - this.t0) / 1000;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Portrait phones pack the same ~311k points into a much smaller area, so additive
    // blending saturates the core to flat white. Damp the *point size* (not the canvas
    // resolution) so facial detail survives and fill-rate cost drops.
    const pointDpr = dpr * (window.innerWidth < window.innerHeight ? 0.76 : 1);

    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 3.2);
    this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 3.2);

    if (this.started) {
      this.assemble = Math.min(1, this.assemble + dt * 0.55);
    }

    const m = MOODS[this.mood];
    for (let i = 0; i < 3; i++) {
      this.cur[i] += (m.core[i] - this.cur[i]) * Math.min(1, dt * 2.6);
    }
    this.curAmt += (m.amt - this.curAmt) * Math.min(1, dt * 2.2);

    const tgtAccent = THEMES[this.themeIdx].accent;
    for (let i = 0; i < 3; i++) {
      this.accentCur[i] += (tgtAccent[i] - this.accentCur[i]) * Math.min(1, dt * 3.0);
    }

    this.voiceTarget *= Math.exp(-dt * 5.5);
    this.voiceEnv += (this.voiceTarget - this.voiceEnv) * Math.min(1, dt * 11);

    // Dynamic Virtual Heart Rate Engine
    if (this.mood === 'excited') {
      this.targetHeartRate = 138;
    } else if (this.mood === 'happy') {
      this.targetHeartRate = 126;
    } else if (this.mood === 'angry') {
      this.targetHeartRate = 128;
    } else if (this.mood === 'surprised') {
      this.targetHeartRate = 114;
    } else if (this.mood === 'speaking') {
      this.targetHeartRate = 88;
    } else if (this.mood === 'thinking') {
      this.targetHeartRate = 82;
    } else if (this.mood === 'listening') {
      this.targetHeartRate = 78;
    } else if (this.mood === 'calm') {
      this.targetHeartRate = 60;
    } else if (this.mood === 'sad') {
      this.targetHeartRate = 54;
    } else {
      this.targetHeartRate = 70;
    }

    // Smooth lerp heart rate
    this.heartRate += (this.targetHeartRate - this.heartRate) * Math.min(1, dt * 2.2);

    // Cardiac cycle phase
    const bps = this.heartRate / 60.0;
    this.heartPhase = (this.heartPhase + dt * bps) % 1.0;

    // Dual-peak cardiac contraction (Systolic QRS spike + Diastolic dicrotic rebound)
    const p1 = Math.exp(-Math.pow((this.heartPhase - 0.08) / 0.042, 2.0));
    const p2 = 0.45 * Math.exp(-Math.pow((this.heartPhase - 0.28) / 0.065, 2.0));
    let rawPulse = Math.min(1.0, p1 + p2);

    // Stronger pulse amplitude when excited or happy sentiments occur
    if (this.mood === 'excited' || this.mood === 'happy') {
      rawPulse = Math.min(1.0, rawPulse * 1.35);
    }
    this.heartPulse = rawPulse;

    let amt = this.curAmt;
    if (this.mood === 'speaking') {
      amt *= 0.55 + 0.95 * this.voiceEnv;
      amt *= 0.72 + 0.5 * (0.5 + 0.5 * Math.sin(t * 9.0)) * (0.6 + 0.4 * Math.sin(t * 3.1 + 1.2));
    } else if (this.mood === 'listening') {
      amt *= 1.0 + 0.35 * Math.sin(t * 2.2) * Math.sin(t * 0.7);
    } else if (this.mood === 'angry') {
      amt *= 1.0 + 0.45 * Math.sin(t * 14.0) * Math.sin(t * 5.5);
    } else if (this.mood === 'excited') {
      amt *= 1.0 + 0.45 * this.heartPulse + 0.25 * Math.sin(t * 8.0);
    } else if (this.mood === 'happy') {
      amt *= 1.0 + 0.38 * this.heartPulse + 0.20 * Math.sin(t * 5.0);
    } else if (this.mood === 'surprised') {
      amt *= 1.0 + 0.38 * Math.sin(t * 10.0);
    } else if (this.mood === 'sad') {
      amt *= 0.85 + 0.15 * Math.sin(t * 1.2);
    } else if (this.mood === 'calm') {
      amt *= 0.95 + 0.1 * Math.sin(t * 1.5);
    }

    const isMobile = this.canvas.width < this.canvas.height;
    const proj = this.perspective((50 * Math.PI) / 180, this.canvas.width / this.canvas.height, 0.1, 40);
    // Lowered humanoid head position so it floats cleanly in upper-mid canvas without colliding with top header
    const view = isMobile
      ? this.lookAt([0, 0.70, 3.32], [0, 0.64, 0], [0, 1, 0])
      : this.lookAt([0, 0.50, 2.92], [0, 0.52, 0], [0, 1, 0]);
    const vp = this.mul(proj, view);

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.bgOn && this.BG) {
      gl.useProgram(this.BG.prog);
      gl.bindVertexArray(this.BG.vao);
      gl.uniformMatrix4fv(this.BG.U.uViewProj, false, vp);
      gl.uniform1f(this.BG.U.uTime, t);
      gl.uniform1f(this.BG.U.uAmt, amt);
      gl.uniform1f(this.BG.U.uDpr, pointDpr);
      gl.uniform1f(this.BG.U.uFocal, (this.canvas.height * 0.5) / Math.tan((25 * Math.PI) / 180));
      gl.uniform3fv(this.BG.U.uAccent, this.accentCur);
      gl.uniform3fv(this.BG.U.uCoreCol, this.cur);
      gl.drawArrays(gl.POINTS, 0, this.BG.n);
      gl.bindVertexArray(null);
      gl.useProgram(this.prog);
    }

    if (this.photoMode && this.PHOTO?.ready) {
      this.ORB.draw(vp, t, pointDpr, this.accentCur, clamp(amt, 0, 1));
      this.PHOTO.draw(vp, t, pointDpr, this.density);
    } else {
      this.ORB.draw(vp, t, pointDpr, this.accentCur, clamp(amt, 0, 1));

      gl.uniformMatrix4fv(this.U.uViewProj, false, vp);
      gl.uniform1f(this.U.uTime, t);
      gl.uniform1f(this.U.uYaw, this.yaw);
      gl.uniform1f(this.U.uPitch, this.pitch);
      gl.uniform1f(this.U.uCoreAmt, amt);
      gl.uniform1f(this.U.uHeartPulse, this.heartPulse);
      gl.uniform1f(this.U.uAssemble, this.assemble);
      gl.uniform1f(this.U.uDpr, pointDpr);
      gl.uniform1f(this.U.uDensity, this.density);
      gl.uniform1f(this.U.uFocal, (this.canvas.height * 0.5) / Math.tan((25 * Math.PI) / 180));
      gl.uniform3fv(this.U.uCoreCol, this.cur);
      gl.uniform3fv(this.U.uAccent, this.accentCur);
      gl.drawArrays(gl.POINTS, 0, this.count);
    }

    this.drawHud(now, this.accentCur, dt);

    this.onHeartRateUpdate?.(
      Math.round(this.heartRate),
      this.heartPulse,
      this.heartPhase,
      this.heartRate > 105
    );

    this.frames++;
    if (now - this.fpsT > 500) {
      const fps = Math.round((this.frames * 1000) / (now - this.fpsT));
      const points = this.photoMode && this.PHOTO?.ready ? this.PHOTO.count : this.count;
      this.onFpsUpdate?.(fps, points);
      this.frames = 0;
      this.fpsT = now;
    }
  }

  public destroy() {
    this.running = false;
  }
}
