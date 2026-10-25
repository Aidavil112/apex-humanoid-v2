import { CharacterConfig, MoodConfig, MoodType } from '../types';
import { isSmoothMode } from './perfMode';

/** ⚡ v6.6.10 — Smooth mode me glow off: 2D canvas ka shadowBlur mobile par sabse
 *    mehnga op hai (live hologram ke upar per-particle = fps drop → "atak" feeling).
 *    400ms ka cache isliye ki per-frame localStorage na padhna pade. */
let __smoothCache: boolean | null = null;
let __smoothAt = 0;
function smoothNow(): boolean {
  const t = Date.now();
  if (__smoothCache === null || t - __smoothAt > 400) {
    __smoothAt = t;
    try { __smoothCache = isSmoothMode(); } catch { __smoothCache = false; }
  }
  return __smoothCache;
}


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
const mixVal = (a: number, b: number, t: number) => a + (b - a) * t;

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'nova',
    name: 'APEX Prime',
    head: { cx: 0, cy: 1.205, cz: 0.015, rx: 0.235, ry: 0.305, rz: 0.268 },
    jaw: 0.44,
    brow: 1.0,
    hair: { n: 26000, r: 1.06, lift: 0.055, style: 'bob' },
    shoulders: 1.06,
    waist: 0.94,
    eyes: { y: 0.025, x: 0.082, r: 0.026, glow: 1.2 },
    rings: 2,
    armor: 1,
  },
  {
    id: 'astra',
    name: 'ARIA 3D',
    head: { cx: 0, cy: 1.212, cz: 0.015, rx: 0.222, ry: 0.298, rz: 0.258 },
    jaw: 0.52,
    brow: 1.15,
    hair: { n: 34000, r: 1.08, lift: 0.075, style: 'long' },
    shoulders: 0.90,
    waist: 0.80,
    eyes: { y: 0.022, x: 0.078, r: 0.027, glow: 1.35 },
    rings: 2,
    armor: 0,
  },
  {
    id: 'unit7',
    name: 'ATLAS 3D',
    head: { cx: 0, cy: 1.205, cz: 0.015, rx: 0.248, ry: 0.296, rz: 0.266 },
    jaw: 0.28,
    brow: 0.85,
    hair: { n: 18000, r: 1.045, lift: 0.035, style: 'bob' },
    shoulders: 1.18,
    waist: 1.02,
    eyes: { y: 0.024, x: 0.086, r: 0.028, glow: 1.5 },
    rings: 2,
    armor: 1,
  },
];

export const PORTRAIT_AVATARS: CharacterConfig[] = [];

export const ALL_AVATARS: CharacterConfig[] = [...CHARACTERS];

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
  /** Master power: when paused, frame() returns immediately and the canvas is blacked out. */
  public paused: boolean = false;

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
    uniform float uTime, uYaw, uPitch, uCoreAmt, uAssemble, uFocal, uDpr, uDensity, uHeartPulse, uTalk;
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

      // Natural living chest breathing + subtle organic human motion
      float breath = sin(t * 1.35);
      if (p.y < 0.92 && p.y > 0.20) {
        p.z += breath * 0.008 * smoothstep(0.20, 0.75, p.y);
        p.y += breath * 0.004;
      }

      // Real-time lip-sync jaw & lower-lip opening when speaking!
      float jawAmt = uTalk * (0.62 + 0.38 * sin(t * 17.5 + aSeed * 1.4));
      if (aType > 6.5) {
        p.y -= jawAmt * 0.030;
        p.z -= jawAmt * 0.006;
      } else if (p.y > 0.90 && p.y < 1.07 && p.z > 0.04) {
        float jawMask = smoothstep(1.07, 0.94, p.y) * smoothstep(0.04, 0.16, p.z);
        p.y -= jawAmt * 0.022 * jawMask;
      }

      // Natural human periodic blinking every ~4.2 seconds
      float bPhase = fract(t * 0.238 + 0.31);
      float blink = smoothstep(0.955, 0.985, bPhase) * smoothstep(1.0, 0.985, bPhase);
      if (aType > 3.5 && aType < 4.5 && abs(p.y - 1.228) < 0.045) {
        p.y = mix(p.y, 1.224, blink * 0.88);
      }

      // Subtle living 3D idle head & body perspective sway so depth pops continuously
      float liveYaw = uYaw + 0.095 * sin(t * 0.58) + 0.028 * sin(t * 1.31);
      float livePitch = uPitch + 0.032 * sin(t * 0.79);

      float w = aWeight;
      mat3 R = rotY(liveYaw * w) * rotX(livePitch * w);
      vec3 pivot = vec3(0.0, 0.95, 0.0);
      p = R*(p-pivot) + pivot;
      n = R*n;

      float asmPhase = clamp(uAssemble*1.65 - aSeed*0.65, 0.0, 1.0);
      float ease = 1.0 - pow(1.0-asmPhase, 3.0);
      p += n * (1.0-ease) * (0.55 + aSeed*0.9);
      float birthGlow = (1.0-ease) * 2.2;

      // Cinema-grade 3D directional studio key + warm contour + crisp rim shading (zero flat washout!)
      vec3 keyDir = normalize(vec3(0.38, 0.45, 0.81));
      float keyLight = max(0.0, dot(n, keyDir));
      float ring = 0.5 + 0.5*sin(aBand + t*0.30);
      float thin = pow(ring, 30.0);
      float fill = 0.14 + 0.48 * keyLight;
      float rim  = pow(1.0 - abs(n.z), 2.8);
      float br = fill + 0.55*thin + 0.88*rim;
      br *= 0.88 + 0.14*sin(t*1.9 + aSeed*61.0);
      vec3 skinHolo = mix(uAccent, vec3(0.94, 0.88, 0.84), 0.34 * keyLight);
      vec3 col = skinHolo * br;

      // Subtle warm glow centered strictly at the CHEST cardiac core (y = 0.70), keeping the 3D human face razor-sharp!
      float dc = length((p - vec3(0.0, 0.70, 0.06)) * vec3(1.1, 1.0, 0.7));
      float glow = exp(-dc*dc*12.0) * uCoreAmt;
      col += uCoreCol * glow * 0.34 * (1.0 + 0.65*uHeartPulse);

      float size = aSize;

      if (aType > 6.5){
        // Expressive animated lower lip contour
        col = mix(uAccent, vec3(1.0, 0.74, 0.72), 0.45) * 1.65;
        size *= 1.35;
      } else if (aType > 5.5){
        // 3D Sculpted Human Hair strands
        float sheen = pow(max(0.0, dot(n, normalize(vec3(-0.3, 0.75, 0.6)))), 3.0);
        col = mix(vec3(0.03,0.05,0.09), uAccent*0.85, 0.30 + 0.70*sheen);
        size *= 1.15;
      } else if (aType > 4.5){
        float dash = pow(0.5 + 0.5*sin(aSeed*220.0 - t*4.0), 6.0);
        col = uAccent * (0.30 + 1.3*dash) * (0.55 + 0.45*uCoreAmt);
        size *= 1.25;
      } else if (aType > 3.5){
        // Crisp 3D Eyes, Brows & Upper Lip
        col = mix(uAccent, vec3(0.96, 0.98, 1.0), 0.42) * 1.9 * (0.85 + 0.15*sin(t*2.6 + aSeed*14.0));
        size *= 1.5;
      } else if (aType > 2.5){
        float breathe = 0.7 + 0.3*sin(t*1.3 + aSeed*7.0);
        col = uCoreCol * 0.008 * breathe * (0.5 + uCoreAmt*0.6) * (1.0 + 0.75*uHeartPulse);
        size *= (1.0 + 0.30*uHeartPulse);
      } else if (aType > 0.5 && aType < 1.5){
        // Chest Heart Core pulsating cleanly at cardiac BPM inside sternum (y = 0.70)
        float pulse = 0.5 + 0.5*sin(t*2.4 + aSeed*11.0);
        float fall = 0.45 + 0.55*(1.0 - smoothstep(0.03, 0.15, length(p - vec3(0.0, 0.70, 0.04))));
        col = uCoreCol * (0.14 + 0.28*pulse + 0.90*uHeartPulse) * (0.35 + 0.55*uCoreAmt) * fall;
        size *= 1.45 * (1.0 + 0.65*uHeartPulse);
      } else if (aType > 1.5){
        float tw = pow(0.5+0.5*sin(t*1.4 + aSeed*90.0), 6.0);
        col = uAccent * (0.05 + 0.75*tw);
      } else if (n.z < -0.14 && aType < 0.5) {
        gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vCol = vec3(0.0); vAlpha = 0.0; return;
      }

      col += uCoreCol * birthGlow * 0.30;

      vec4 mv = uViewProj * vec4(p, 1.0);
      gl_Position = mv;
      float dist = max(0.5, 3.1 - p.z*0.28);
      float cap = (aType > 2.5 && aType < 3.5) ? 180.0 : 22.0;
      gl_PointSize = clamp(size * uFocal / dist * uDpr, 1.0, cap);

      vCol = col;
      vAlpha = aType > 0.5 ? 0.95 : (0.48 + 0.42*thin);
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
      'uTalk',
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

    const HEAD = cfg.head || { cx: 0, cy: 1.205, cz: 0.015, rx: 0.235, ry: 0.305, rz: 0.268 };
    const RING = TAU / 0.031;
    const TYPE_LIPS = 7;
    const shoulderScale = cfg.shoulders || 1.0;
    const waistScale = cfg.waist || 0.92;

    // 1. Sculpted High-Precision 3D Human Head & Facial Anatomy (Zero White Washout!)
    const nShell = 108000;
    for (let i = 0; i < nShell; i++) {
      const u = rnd() * 2 - 1,
        phi = rnd() * TAU;
      const su = Math.sqrt(Math.max(0, 1 - u * u));
      let x = su * Math.cos(phi),
        y = u,
        z = su * Math.sin(phi);

      const d = [gauss(), gauss(), gauss()];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      x = x * 0.965 + (d[0] / dl) * 0.035;
      y = y * 0.965 + (d[1] / dl) * 0.035;
      z = z * 0.965 + (d[2] / dl) * 0.035;

      // Sculpted human jawline & chin projection
      if (y < 0) {
        const jawTaper = 1.0 - (0.40 - (cfg.jaw || 0.4) * 0.14) * Math.pow(Math.abs(y), 1.22);
        x *= jawTaper;
        z *= 1.0 - 0.16 * Math.pow(Math.abs(y), 1.15);
        // Distinct human chin dimple/projection
        if (z > 0 && y < -0.58) {
          z += Math.exp(-32 * x * x) * Math.exp(-26 * Math.pow(y + 0.78, 2)) * 0.14;
        }
      }

      // Defined human nose bridge, tip & nostrils
      if (z > 0) {
        const noseBridge = Math.exp(-95 * x * x) * Math.exp(-16 * Math.pow(y - 0.04, 2));
        const noseTip = Math.exp(-120 * x * x) * Math.exp(-90 * Math.pow(y + 0.08, 2));
        const nostrils =
          Math.exp(-220 * Math.pow(Math.abs(x) - 0.085, 2)) *
          Math.exp(-130 * Math.pow(y + 0.10, 2));
        z += noseBridge * 0.28 + noseTip * 0.22 + nostrils * 0.09;
      }

      // Deep realistic orbital eye sockets & brow ridge
      if (z > 0) {
        const eyeL = Math.hypot(x - 0.34, y - 0.085);
        const eyeR = Math.hypot(x + 0.34, y - 0.085);
        const socketIndent = Math.exp(-36 * eyeL * eyeL) + Math.exp(-36 * eyeR * eyeR);
        z -= socketIndent * 0.20;
        // Brow ridge above eyes
        const browRidge =
          Math.exp(-14 * x * x) * Math.exp(-85 * Math.pow(y - 0.23, 2)) * (cfg.brow || 1.0);
        z += browRidge * 0.10;
      }

      // Sculpted human cheekbones & philtrum
      if (z > 0) {
        const cheek = Math.exp(-30 * (Math.pow(Math.abs(x) - 0.50, 2) + Math.pow(y + 0.04, 2)));
        x *= 1.0 + cheek * 0.13;
        z += cheek * 0.13;
      }

      // Anatomical left & right human ears
      const earDist = Math.hypot(z + 0.05, (y - 0.02) * 0.65);
      if (Math.abs(x) > 0.88 && earDist < 0.24) {
        x += Math.sign(x) * (1.0 - earDist / 0.24) * 0.11;
      }

      const px = x * HEAD.rx,
        py = y * HEAD.ry + HEAD.cy,
        pz = z * HEAD.rz + HEAD.cz;
      let nx = x / HEAD.rx,
        ny = y / HEAD.ry,
        nz = z / HEAD.rz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      push(px, py, pz, nx, ny, nz, (py - HEAD.cy) * RING, TYPE_SHELL, 1.0, 0.0024);
    }

    // 2. Sculpted 3D Human Hair Strands (Zero Flat Helmet Look!)
    if (cfg.hair) {
      const hCount = cfg.hair.n;
      const isLong = cfg.hair.style === 'long';
      for (let i = 0; i < hCount; i++) {
        const u = isLong ? rnd() * 1.65 - 0.55 : rnd() * 1.15 - 0.12;
        const phi = rnd() * TAU;
        const clampedU = Math.min(1, Math.max(-1, u));
        const su = Math.sqrt(Math.max(0, 1 - clampedU * clampedU));
        const cx = su * Math.cos(phi);
        const cz = su * Math.sin(phi);
        // Leave face front open from hairline down
        if (cz > 0.22 && u < 0.42 && Math.abs(cx) < 0.72) continue;
        const wave = 1.0 + 0.035 * Math.sin(phi * 11 + u * 8);
        const radScale = cfg.hair.r * wave;
        const px = cx * HEAD.rx * radScale;
        const py = u * HEAD.ry * 1.02 + HEAD.cy + cfg.hair.lift * (u > 0 ? u : 0);
        const pz = cz * HEAD.rz * radScale + HEAD.cz - 0.012;
        push(px, py, pz, cx, Math.max(0.1, clampedU), cz, py * RING, TYPE_HAIR, 1.0, 0.0031);
      }
    }

    // 3. Expressive Living Human Eyes (Sclera Outline + Iris Ring + Bright Corneal Catchlight)
    const eyeOffsetX = cfg.eyes?.x || 0.082;
    const eyeOffsetY = cfg.eyes?.y || 0.024;
    for (const side of [-1, 1]) {
      const ex = side * eyeOffsetX;
      const ey = HEAD.cy + eyeOffsetY;
      const ez = HEAD.cz + HEAD.rz * 0.875;

      // Almond eyelid contour
      for (let k = 0; k < 520; k++) {
        const t = (k / 520) * TAU;
        const lidX = Math.cos(t) * 0.034;
        const lidY = Math.sin(t) * 0.015;
        push(ex + lidX, ey + lidY, ez - 0.004, 0, 0, 1, 0, TYPE_EYE, 1.0, 0.0034);
      }

      // Detailed Iris Ring + Corneal Highlight (leaves dark natural pupil center!)
      for (let k = 0; k < 1300; k++) {
        const a = rnd() * TAU;
        const r = 0.0075 + rnd() * 0.0125;
        push(
          ex + Math.cos(a) * r,
          ey + Math.sin(a) * r,
          ez + 0.004,
          0,
          0,
          1,
          0,
          TYPE_EYE,
          1.0,
          0.0042
        );
      }
      // Crisp bright eye catchlight glint
      for (let k = 0; k < 90; k++) {
        push(
          ex + 0.006 + (rnd() - 0.5) * 0.004,
          ey + 0.006 + (rnd() - 0.5) * 0.004,
          ez + 0.008,
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

    // 4. Sculpted Human Eyebrows
    for (const side of [-1, 1]) {
      for (let k = 0; k < 650; k++) {
        const t = k / 650;
        const bx = side * (0.032 + t * 0.098);
        const by = HEAD.cy + 0.078 + Math.sin(t * Math.PI * 0.85) * 0.017;
        const bz = HEAD.cz + HEAD.rz * 0.885 - t * 0.022;
        push(
          bx + (rnd() - 0.5) * 0.006,
          by + (rnd() - 0.5) * 0.005,
          bz,
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

    // 5. Realistic Upper Lip (Cupid's Bow) + Animated Lip-Sync Lower Lip (TYPE_LIPS = 7)
    for (let k = 0; k < 700; k++) {
      const t = k / 700;
      const lx = (t - 0.5) * 0.108;
      const cupid = -Math.abs(Math.abs(t - 0.5) - 0.14) * 0.018;
      const ly = HEAD.cy - 0.132 + cupid;
      const lz = HEAD.cz + HEAD.rz * 0.905 - Math.pow(lx * 5.2, 2) * 0.012;
      push(lx, ly + (rnd() - 0.5) * 0.004, lz, 0, 0.2, 1, 0, TYPE_EYE, 1.0, 0.0036);
    }
    for (let k = 0; k < 750; k++) {
      const t = k / 750;
      const lx = (t - 0.5) * 0.102;
      const ly = HEAD.cy - 0.146 + Math.pow(lx * 4.5, 2) * 0.014;
      const lz = HEAD.cz + HEAD.rz * 0.902 - Math.pow(lx * 5.2, 2) * 0.012;
      push(lx, ly + (rnd() - 0.5) * 0.005, lz, 0, -0.2, 1, 0, TYPE_LIPS, 1.0, 0.0039);
    }

    // 6. Anatomical 3D Human Neck, Clavicles, Chest, Ribcage & Waist (Full Upper Body!)
    const nTorso = 76000;
    for (let i = 0; i < nTorso; i++) {
      const t = rnd(); // 0 = upper neck (y=0.95), 1 = sculpted waist (y=0.12)
      const y = 0.95 - t * 0.83;
      const a = rnd() * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      // True human anatomical width & depth profile from neck -> traps -> chest -> waist
      let halfW: number;
      let halfD: number;
      if (t < 0.16) {
        // Cylindrical human neck with sternocleidomastoid taper
        const nt = t / 0.16;
        halfW = (0.082 + nt * 0.026) * shoulderScale;
        halfD = 0.078 + nt * 0.018;
      } else if (t < 0.30) {
        // Trapezius & clavicle slope out to broad human shoulders
        const st = smoothstep(0.16, 0.30, t);
        halfW = (0.108 + st * 0.275) * shoulderScale;
        halfD = 0.096 + st * 0.068;
      } else {
        // Sculpted human chest/pectorals tapering cleanly into athletic waist
        const bt = (t - 0.30) / 0.70;
        halfW = (0.383 * (1 - bt * 0.36) + 0.03 * Math.sin(bt * Math.PI)) * mixVal(shoulderScale, waistScale, bt);
        halfD = 0.164 * (1 - bt * 0.26);
      }

      let x = ca * halfW;
      let z = sa * halfD + HEAD.cz * 0.5;

      // Sculpted pectoral muscles + sternum groove + collarbone ridge on front torso!
      if (sa > 0 && t > 0.24 && t < 0.62) {
        const pecY = Math.exp(-38 * Math.pow(t - 0.40, 2));
        const pecX = Math.exp(-26 * Math.pow(Math.abs(x) - 0.145 * shoulderScale, 2));
        z += pecY * pecX * 0.042;
        // Center sternum channel
        z -= pecY * Math.exp(-180 * x * x) * 0.018;
      }
      // Collarbone ridge
      if (sa > 0.2 && Math.abs(t - 0.27) < 0.035 && Math.abs(x) > 0.04) {
        z += 0.016 * Math.exp(-900 * Math.pow(t - 0.27, 2));
      }

      const nl = Math.hypot(x / halfW, 0.15, z / halfD) || 1;
      const weight = t < 0.20 ? 0.85 : 0.42 * (1 - (t - 0.20) * 0.7);
      push(
        x,
        y,
        z,
        x / halfW / nl,
        0.15 / nl,
        z / halfD / nl,
        y * RING,
        TYPE_SHELL,
        Math.max(0.12, weight),
        0.0028
      );
    }

    // 7. Left & Right Sculpted 3D Human Arms (Deltoids, Biceps, Elbows & Forearms!)
    const nArms = 28000;
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const t = rnd(); // 0 = shoulder cap (y=0.73), 1 = forearm/wrist (y=0.10)
      const a = rnd() * TAU;
      // Natural human arm pose: hangs slightly outward & bends slightly forward below elbow
      const shoulderX = side * 0.395 * shoulderScale;
      const elbowBend = Math.max(0, t - 0.48) * 1.15;
      const cx = shoulderX + side * Math.sin(t * 1.2) * 0.038;
      const cy = 0.735 - t * 0.63;
      const cz = HEAD.cz * 0.4 - Math.sin(t * Math.PI) * 0.02 + elbowBend * 0.11;

      // Deltoid bulge -> bicep -> forearm taper
      const armRad =
        t < 0.25
          ? 0.088 - t * 0.055
          : t < 0.55
          ? 0.074 - (t - 0.25) * 0.035
          : 0.063 - (t - 0.55) * 0.038;

      const lx = Math.cos(a) * armRad;
      const lz = Math.sin(a) * armRad * 0.92;
      push(
        cx + lx,
        cy,
        cz + lz,
        Math.cos(a),
        0.08,
        Math.sin(a),
        cy * RING,
        TYPE_SHELL,
        0.25,
        0.0027
      );
    }

    // 8. Cardiac Energy Heart Core Positioned Inside Human Chest Sternum (y = 0.70 — keeps Face 100% Clear!)
    for (let i = 0; i < 16000; i++) {
      const d = [gauss(), gauss(), gauss()];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      const r = Math.pow(rnd(), 0.62) * 0.095;
      push(
        (d[0] / dl) * r,
        0.70 + (d[1] / dl) * r,
        0.05 + (d[2] / dl) * r * 0.65,
        0,
        0,
        1,
        0,
        TYPE_CORE,
        0.38,
        0.0038
      );
    }

    // 9. Subtle Floating Neural Halo Arc Behind Shoulders/Head
    const rings = cfg.rings || 2;
    for (let r = 0; r < rings; r++) {
      const n = 2600;
      const tilt = 1.05 + r * 0.24;
      const rad = 0.44 + r * 0.07;
      const st = Math.sin(tilt),
        ct = Math.cos(tilt);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const px = Math.cos(a) * rad,
          pz = Math.sin(a) * rad;
        push(px, HEAD.cy + pz * st, HEAD.cz - 0.08 + pz * ct, px / rad, 0, (pz * ct) / rad, 0, TYPE_RING, 0.75, 0.0022);
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
        hctx.shadowBlur = smoothNow() ? 0 : 12;
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
        hctx.shadowBlur = smoothNow() ? 0 : 8;
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
        hctx.shadowBlur = smoothNow() ? 0 : 8;
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
    if (!this.running || this.paused) return;
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
    const proj = this.perspective((46 * Math.PI) / 180, this.canvas.width / this.canvas.height, 0.1, 40);
    // Cleanly frames full upper-body 3D Humanoid (head, face, neck, shoulders, chest core & arms)
    const view = isMobile
      ? this.lookAt([0, 0.84, 2.52], [0, 0.80, 0], [0, 1, 0])
      : this.lookAt([0, 0.82, 2.24], [0, 0.80, 0], [0, 1, 0]);
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

    const talkAmt = this.mood === 'speaking' ? Math.max(0.28, this.voiceEnv) : 0.0;
    this.ORB.draw(vp, t, pointDpr, this.accentCur, clamp(amt * 0.65, 0, 0.85));

    gl.uniformMatrix4fv(this.U.uViewProj, false, vp);
    gl.uniform1f(this.U.uTime, t);
    gl.uniform1f(this.U.uYaw, this.yaw);
    gl.uniform1f(this.U.uPitch, this.pitch);
    gl.uniform1f(this.U.uCoreAmt, amt);
    gl.uniform1f(this.U.uHeartPulse, this.heartPulse);
    gl.uniform1f(this.U.uTalk, talkAmt);
    gl.uniform1f(this.U.uAssemble, this.assemble);
    gl.uniform1f(this.U.uDpr, pointDpr);
    gl.uniform1f(this.U.uDensity, this.density);
    gl.uniform1f(this.U.uFocal, (this.canvas.height * 0.5) / Math.tan((25 * Math.PI) / 180));
    gl.uniform3fv(this.U.uCoreCol, this.cur);
    gl.uniform3fv(this.U.uAccent, this.accentCur);
    gl.drawArrays(gl.POINTS, 0, this.count);

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

  /** Master power switch. Pausing stops GPU work and blackens both canvases;
      resuming rewinds the clock so animations don't jump. */
  public setPaused(on: boolean) {
    if (this.paused === on) return;
    this.paused = on;
    if (on) {
      this.blackout();
    } else {
      this.lastTime = performance.now();
      this.blackout(false);
    }
  }

  /** Clear the WebGL + HUD canvases to solid black (or restore the clear colour). */
  private blackout(black: boolean = true) {
    try {
      const gl = this.gl;
      // remember the scene's own clear colour and restore it on resume
      if (black) gl.clearColor(0, 0, 0, 1);
      else gl.clearColor(0.01, 0.02, 0.03, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.hctx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
      if (black) {
        this.hctx.fillStyle = '#000';
        this.hctx.fillRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
      }
    } catch {
      /* context may already be lost — nothing to do */
    }
  }

  public destroy() {
    this.running = false;
  }
}
