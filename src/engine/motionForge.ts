/**
 * 🎬 MOTION FORGE — ek LINE se cinematic animation (Higgsfield KATANA wala idea, par ₹0)
 *
 * KATANA paid tool hai (After Effects ke bina prompt → motion design). APEX me wahi kaam
 * browser ke andar hota hai: Canvas 2D + MediaRecorder se 1080×1920 reel, jisme
 *   • kinetic typography  (word-by-word pop, tracking, accent highlight, underline wipe)
 *   • morphing shapes       (harmonic blob jo live morph karte hain)
 *   • camera moves          (push-in / pull-out / pan / orbit — eased)
 *   • transitions           (flash / whip / glitch / zoom-blur / slice)
 *   • stat count-up + grain + vignette + watermark
 *
 * Na AI API ka kharcha, na server — sab kuch device par. Video seedha Vault me jaata hai
 * (Save-First rule), wahan se 📸 Instagram / 📘 Facebook / ▶️ YouTube share ho jaata hai.
 *
 * Math ke saare helpers PURE hain (frame index se deterministic — koi Math.random nahi),
 * isliye Node me mock-2D-context se test kiye ja sakte hain.
 */

export type MotionStyle = 'neon-pulse' | 'kino-glass' | 'brutal-flash';
export type CameraKind = 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'orbit' | 'tilt';
export type TransitionKind = 'flash' | 'whip' | 'glitch' | 'zoom-blur' | 'slice';
export type BeatKind = 'hook' | 'line' | 'stat' | 'cta';

export interface MotionBeat {
  text: string;
  /** second, jab beat shuru hota hai */
  at: number;
  dur: number;
  kind: BeatKind;
  /** 0..1 — kitna zor (font size + motion amplitude) */
  emphasis: number;
  /** stat beat me numeric value (count-up ke liye) + prefix/suffix */
  num?: { from: number; to: number; prefix: string; suffix: string };
}

export interface MotionBrief {
  prompt: string;
  title: string;
  caption: string;
  style: MotionStyle;
  palette: { bg: string; bg2: string; ink: string; accent: string; accent2: string };
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  beats: MotionBeat[];
  camera: Array<{ at: number; dur: number; kind: CameraKind; power: number }>;
  transitions: Array<{ at: number; kind: TransitionKind; strength: number }>;
  shapes: number;
  grain: number;
  seed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧮 pure helpers (testable)
// ─────────────────────────────────────────────────────────────────────────────

export function hashStr(s: string): number {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** deterministic 0..1 — frame index par, taaki render reproduce ho sake */
export function rand01(seed: number, n: number): number {
  let x = (Math.imul(seed ^ Math.imul(n + 1, 2654435761), 1597334677) >>> 8) & 0xffffff;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 100000) / 100000;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function easeOut(p: number): number {
  const t = clamp(p, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOut(p: number): number {
  const t = clamp(p, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** beat #n at time t (t second) — koi bhi second ek beat ke andar hi ho */
export function beatAt(brief: MotionBrief, t: number): { beat: MotionBeat; index: number; local: number } {
  const beats = brief.beats;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (t >= b.at && t < b.at + b.dur) return { beat: b, index: i, local: clamp((t - b.at) / Math.max(0.001, b.dur), 0, 1) };
  }
  const last = beats[beats.length - 1] || { text: '', at: 0, dur: 1, kind: 'line' as BeatKind, emphasis: 0.5 };
  return { beat: last, index: Math.max(0, beats.length - 1), local: 1 };
}

export function cameraAt(brief: MotionBrief, t: number): { scale: number; dx: number; dy: number; rot: number } {
  let scale = 1;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  for (const c of brief.camera) {
    if (t < c.at || t > c.at + c.dur) continue;
    const p = easeInOut((t - c.at) / Math.max(0.001, c.dur));
    const swing = Math.sin(p * Math.PI); // jaate-aaate smooth
    switch (c.kind) {
      case 'push-in':
        scale = 1 + c.power * p;
        break;
      case 'pull-out':
        scale = 1 + c.power - c.power * p;
        break;
      case 'pan-left':
        dx = -c.power * 0.5 * swing * brief.width;
        scale = 1 + c.power * 0.35;
        break;
      case 'pan-right':
        dx = c.power * 0.5 * swing * brief.width;
        scale = 1 + c.power * 0.35;
        break;
      case 'tilt':
        dy = c.power * 0.35 * swing * brief.height;
        scale = 1 + c.power * 0.25;
        break;
      case 'orbit':
        rot = c.power * 0.28 * Math.sin(p * Math.PI * 2);
        dx = c.power * 0.22 * swing * brief.width;
        scale = 1 + c.power * 0.4;
        break;
    }
  }
  return { scale, dx, dy, rot };
}

/** us second par chal rahi transition (local 0..1) ya null */
export function transitionAt(brief: MotionBrief, t: number): { kind: TransitionKind; local: number; strength: number } | null {
  for (const tr of brief.transitions) {
    const span = 0.42;
    if (t >= tr.at - 0.06 && t <= tr.at + span) {
      return { kind: tr.kind, local: clamp((t - (tr.at - 0.06)) / (span + 0.06), 0, 1), strength: tr.strength };
    }
  }
  return null;
}

/** stat beat ka count-up value (0 → to), easeOut ke saath */
export function countUpValue(beat: MotionBeat, local: number): number | null {
  if (!beat.num) return null;
  const v = beat.num.from + (beat.num.to - beat.num.from) * easeOut(clamp((local - 0.18) / 0.5, 0, 1));
  return v;
}

/** word-by-word kinetic state: kaunsa word kab pop hoga */
export function kineticWordState(words: number, i: number, local: number, lead = 0.1): Array<{ p: number; alpha: number; scale: number; dy: number }> {
  const span = Math.max(0.12, (1 - lead * 2) / Math.max(1, words));
  return Array.from({ length: words }, (_, w) => {
    const start = lead + w * span;
    const p = clamp((local - start) / Math.max(0.06, span * 0.85), 0, 1);
    const e = easeOut(p);
    return { p, alpha: e, scale: 1.42 - 0.42 * e, dy: (1 - e) * 26 };
  });
}

/** morphing blob — radial harmonics, deterministic (seed fixed ho to same shape) */
export function blobPoints(t: number, seed: number, spokes = 14): Array<{ a: number; r: number }> {
  const out: Array<{ a: number; r: number }> = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const h1 = Math.sin(a * 3 + t * 0.9 + seed * 0.001) * 0.14;
    const h2 = Math.sin(a * 5 - t * 1.4 + seed * 0.013) * 0.08;
    const h3 = Math.sin(a * 2 + t * 0.5 + seed * 0.031) * 0.06;
    out.push({ a, r: 1 + h1 + h2 + h3 });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📝 prompt → brief
// ─────────────────────────────────────────────────────────────────────────────

const PALETTES: Record<string, MotionBrief['palette']> = {
  cyan: { bg: '#04070f', bg2: '#0b1b33', ink: '#eaf6ff', accent: '#22d3ee', accent2: '#8b5cf6' },
  gold: { bg: '#0b0703', bg2: '#241505', ink: '#fff6e2', accent: '#fbbf24', accent2: '#f97316' },
  red: { bg: '#0c0205', bg2: '#2a0710', ink: '#ffe9ee', accent: '#fb7185', accent2: '#ef4444' },
  green: { bg: '#02100a', bg2: '#052a1c', ink: '#e6fff3', accent: '#34d399', accent2: '#22d3ee' },
  violet: { bg: '#070311', bg2: '#180a2e', ink: '#f3ecff', accent: '#a78bfa', accent2: '#22d3ee' },
};

const CTA_WORDS = /\b(follow|subscribe|comment|link in bio|share|save karo|dekhho|dekho|jara|try karo|use karo|abhi|now|today)\b/i;
const STAT_HINT = /([₹$]|%|crore|lakh|hajar|thousand|million|billion|\d{2,})/i;

function styleOf(prompt: string, seed: number): MotionStyle {
  const p = prompt.toLowerCase();
  if (/(neon|cyber|hacker|matrix|glow|tech)/.test(p)) return 'neon-pulse';
  if (/(cinema|cinematic|film|kino|glass|luxury|premium|documentary|apple|serif)/.test(p)) return 'kino-glass';
  if (/(brutal|flash|hype|sports|gym|energy|alert|urgent|cricket)/.test(p)) return 'brutal-flash';
  return (['neon-pulse', 'kino-glass', 'brutal-flash'] as MotionStyle[])[seed % 3];
}

function paletteOf(prompt: string, style: MotionStyle): MotionBrief['palette'] {
  const p = prompt.toLowerCase();
  if (/(₹|₨|paisa|rupay|rs\s?\d|money|cash|profit|earning|income|salary|emi|sip|budget|business|growth|stock|trade)/.test(p)) return PALETTES.gold;
  if (/(loss|crash|warning|danger|alert|risk|scam|error|down)/.test(p)) return PALETTES.red;
  if (/(ai|tech|code|robot|cyber|data|app|startup|future|space)/.test(p)) return style === 'kino-glass' ? PALETTES.violet : PALETTES.cyan;
  if (/(health|fit|gym|green|farm|sustain|save)/.test(p)) return PALETTES.green;
  return style === 'brutal-flash' ? PALETTES.red : style === 'kino-glass' ? PALETTES.violet : PALETTES.cyan;
}

/** Prompt ko beats me todta hai (English + Hinglish, dono). Koi AI API nahi chahiye. */
export function parseMotionBrief(prompt: string, opts: { style?: MotionStyle; durationSec?: number; width?: number; height?: number; fps?: number } = {}): MotionBrief {
  const raw = String(prompt || '').replace(/\s+/g, ' ').trim();
  const seed = hashStr(raw || 'apex');
  const style = opts.style && opts.style !== ('auto' as MotionStyle) ? opts.style : styleOf(raw, seed);
  const palette = paletteOf(raw, style);

  const parts = raw
    .split(/(?<=[.!?।])\s+|\s+[|•—]\s+|\n+/)
    .map((x) => x.trim().replace(/^[-:]+\s*/, ''))
    .filter((x) => x.length > 1);
  const words = raw.split(/\s+/).filter(Boolean).length;

  let beats: Array<{ text: string; kind: BeatKind; emphasis: number; num?: MotionBeat['num'] }> = [];
  const src = parts.length >= 2 ? parts : raw.split(/,\s+/).filter((x) => x.trim().length > 2);
  const pool = (src.length ? src : [raw || 'APEX']).slice(0, 7);
  pool.forEach((text, i) => {
    const first = i === 0;
    const last = i === pool.length - 1 && pool.length > 1;
    const m = text.match(/([₹$]?)\s*(\d+(?:\.\d+)?)\s*(%|x|×|k|K|L|lakh|crore|cr)?/);
    const isStat = !!m && STAT_HINT.test(text);
    const num = isStat && m ? { from: 0, to: Number(m[2]) * (/crore|cr/i.test(m[3] || '') ? 100 : /lakh|L|K|k/i.test(m[3] || '') ? 1 : 1), prefix: m[1] || '', suffix: m[3] || '%' } : undefined;
    beats.push({
      text: text.slice(0, 120),
      kind: last && CTA_WORDS.test(text) ? 'cta' : isStat ? 'stat' : first ? 'hook' : 'line',
      emphasis: clamp((first ? 0.95 : 0.6) + (isStat ? 0.2 : 0) + (last && CTA_WORDS.test(text) ? 0.15 : 0), 0, 1),
      num,
    });
  });
  if (!beats.length) beats = [{ text: 'APEX', kind: 'hook', emphasis: 1 }];

  // duration: ~2.6 word/sec, 6–22 sec; har beat ≥ 1.35 sec
  const wanted = clamp((words || 6) / 2.6 + 2.2, 6, 22);
  const durationSec = clamp(opts.durationSec || wanted, Math.max(3, beats.length * 1.35), 30);
  const per = durationSec / beats.length;
  const out: MotionBeat[] = beats.map((b, i) => ({ ...b, at: +(i * per).toFixed(3), dur: +per.toFixed(3) }));

  const cameraKinds: CameraKind[] = style === 'kino-glass' ? ['push-in', 'pan-right', 'tilt', 'pull-out'] : style === 'brutal-flash' ? ['push-in', 'orbit', 'pan-left', 'push-in'] : ['orbit', 'push-in', 'pan-right', 'tilt'];
  const camera: MotionBrief['camera'] = [];
  const camCount = Math.max(2, Math.round(durationSec / 3.2));
  for (let i = 0; i < camCount; i++) {
    const at = +((i * durationSec) / camCount).toFixed(3);
    camera.push({
      at,
      dur: +(durationSec / camCount + 0.4).toFixed(3),
      kind: cameraKinds[(seed + i) % cameraKinds.length],
      power: +(0.06 + rand01(seed, i + 7) * (style === 'brutal-flash' ? 0.16 : 0.1)).toFixed(3),
    });
  }

  const kinds: TransitionKind[] = style === 'brutal-flash' ? ['flash', 'glitch', 'slice'] : style === 'kino-glass' ? ['zoom-blur', 'slice', 'whip'] : ['whip', 'glitch', 'flash', 'zoom-blur'];
  const transitions: MotionBrief['transitions'] = out.slice(1).map((b, i) => ({ at: b.at, kind: kinds[(seed + i * 3) % kinds.length], strength: +(0.5 + rand01(seed, i + 21) * 0.5).toFixed(2) }));

  const title = (pool[0] || raw).slice(0, 46);
  const caption = [
    raw.slice(0, 160),
    '',
    `Banaya: APEX Motion Forge (₹0 — no After Effects) 🎬`,
    style === 'neon-pulse' ? '⚡ neon kinetic type' : style === 'kino-glass' ? '🎥 kino glass look' : '🔥 brutal flash cut',
    '#APEX #MotionForge #AIVideo #Reels',
  ].join('\n');

  return {
    prompt: raw,
    title,
    caption,
    style,
    palette,
    width: opts.width || 1080,
    height: opts.height || 1920,
    fps: opts.fps || 30,
    durationSec: +durationSec.toFixed(2),
    beats: out,
    camera,
    transitions,
    shapes: 3 + (seed % 5),
    grain: style === 'kino-glass' ? 0.5 : style === 'brutal-flash' ? 0.32 : 0.24,
    seed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🖌️ drawing (ctx inject kiya jaata hai → Node me mock se testable)
// ─────────────────────────────────────────────────────────────────────────────

type Ctx2D = any;

function fitText(ctx: Ctx2D, text: string, maxW: number, size: number, weight = '900'): { size: number; lines: string[] } {
  let s = size;
  let lines: string[] = [];
  for (let guard = 0; guard < 22; guard++) {
    ctx.font = `${weight} ${Math.round(s)}px system-ui, "Segoe UI", Roboto, sans-serif`;
    const words = text.split(/\s+/);
    lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.every((l) => ctx.measureText(l).width <= maxW)) break;
    s *= 0.9;
  }
  return { size: Math.round(s), lines };
}

function drawBackdrop(ctx: Ctx2D, brief: MotionBrief, t: number) {
  const { width: W, height: H, palette } = brief;
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
  g.addColorStop(0, palette.bg);
  g.addColorStop(1, palette.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(-W, -H, W * 3, H * 3);

  if (brief.style === 'neon-pulse') {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    const gap = 74;
    const off = (t * 46) % gap;
    for (let y = -gap + off; y < H * 1.6; y += gap) {
      ctx.beginPath();
      ctx.moveTo(-W * 0.3, y);
      ctx.lineTo(W * 1.3, y);
      ctx.stroke();
    }
  }
  if (brief.style === 'brutal-flash') {
    const step = 240;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = -step; y < H + step; y += step) for (let x = -step; x < W + step; x += step) ctx.fillRect(x, y, step / 2, step / 2);
  }
}

function drawBlobs(ctx: Ctx2D, brief: MotionBrief, t: number, energy: number) {
  const { width: W, height: H, palette } = brief;
  for (let i = 0; i < brief.shapes; i++) {
    const ph = rand01(brief.seed, i * 5 + 3);
    const cx = W * (0.18 + 0.66 * rand01(brief.seed, i * 7 + 1)) + Math.sin(t * (0.25 + ph * 0.4) + i) * W * 0.08;
    const cy = H * (0.12 + 0.72 * rand01(brief.seed, i * 11 + 2)) + Math.cos(t * (0.2 + ph * 0.3) + i * 1.7) * H * 0.06;
    const base = Math.min(W, H) * (0.16 + 0.16 * ph) * (1 + energy * 0.16);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * (0.1 + ph * 0.22) * (i % 2 ? -1 : 1));
    ctx.beginPath();
    const pts = blobPoints(t * (0.7 + ph) + i, brief.seed + i * 13, 14);
    pts.forEach((p, k) => {
      const x = Math.cos(p.a) * base * p.r;
      const y = Math.sin(p.a) * base * p.r * 1.15;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const grd = ctx.createLinearGradient(-base, -base, base, base);
    grd.addColorStop(0, i % 2 ? palette.accent : palette.accent2);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = brief.style === 'kino-glass' ? 0.24 : 0.32;
    ctx.fillStyle = grd;
    ctx.fill();
    if (brief.style === 'neon-pulse') {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 3;
      ctx.strokeStyle = palette.accent;
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawText(ctx: Ctx2D, brief: MotionBrief, beat: MotionBeat, local: number, index: number) {
  const { width: W, height: H, palette } = brief;
  const maxW = W * 0.86;
  const baseSize = Math.round(H * (beat.kind === 'hook' ? 0.062 : 0.052) * (0.82 + beat.emphasis * 0.5));
  const text = beat.text;
  const words = text.split(/\s+/);
  const sizing = fitText(ctx, text.length > 46 ? text : text, maxW, baseSize);
  const size = sizing.size;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = size * 1.16;
  const startY = H * 0.44 - ((sizing.lines.length - 1) * lineH) / 2;
  const wStates = kineticWordState(words.length, 0, local);
  const perWord = words.length > 1 && sizing.lines.join(' ') === text;

  let wIdx = 0;
  sizing.lines.forEach((line, li) => {
    const lineWords = line.split(/\s+/);
    const widths = lineWords.map((w) => {
      ctx.font = `900 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
      return ctx.measureText(w).width;
    });
    const tracking = (1 - easeOut(clamp(local / 0.5, 0, 1))) * size * 0.16;
    const totalW = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, lineWords.length - 1);
    let x = W / 2 - totalW / 2;
    lineWords.forEach((w, wi) => {
      const gi = perWord ? wIdx : 0;
      const st = wStates[Math.min(gi, wStates.length - 1)] || { p: 1, alpha: 1, scale: 1, dy: 0 };
      const isAccent = /(\d|₹|%|\bai\b|\bkaro\b|\bnow\b|\babhi\b)/i.test(w) || wi === lineWords.length - 1;
      const pop = 1 + Math.max(0, 0.16 - st.p * 0.16) + (beat.kind === 'cta' ? Math.sin(local * Math.PI * 6) * 0.02 : 0);
      ctx.save();
      ctx.translate(x + widths[wi] / 2, startY + li * lineH + st.dy);
      ctx.scale(st.scale * pop, st.scale * pop);
      ctx.globalAlpha = 0.15 + 0.85 * st.alpha;
      ctx.font = `900 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
      if (brief.style === 'kino-glass') {
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = size * 0.22;
        ctx.shadowOffsetY = size * 0.06;
      } else {
        ctx.shadowColor = isAccent ? palette.accent : 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = size * (isAccent ? 0.5 : 0.2);
      }
      ctx.fillStyle = isAccent ? palette.accent : palette.ink;
      ctx.fillText(w, 0, 0);
      if (beat.kind === 'hook' && local > 0.32 && wi === 0 && li === 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = palette.accent2;
        ctx.fillRect(-widths[wi] / 2, size * 0.62, widths[wi] * easeOut(clamp((local - 0.32) / 0.3, 0, 1)), Math.max(3, size * 0.07));
      }
      ctx.restore();
      x += widths[wi] + tracking;
      wIdx += 1;
    });
  });

  if (beat.kind === 'stat' && beat.num) {
    const v = countUpValue(beat, local);
    if (v !== null) {
      const shown = beat.num.suffix && /%|x|×/.test(beat.num.suffix) ? `${beat.num.prefix}${v.toFixed(v < 10 ? 1 : 0)}${beat.num.suffix}` : `${beat.num.prefix}${Math.round(v).toLocaleString('en-IN')}${beat.num.suffix || ''}`;
      ctx.save();
      ctx.globalAlpha = easeOut(clamp((local - 0.1) / 0.4, 0, 1));
      ctx.font = `900 ${Math.round(size * 1.55)}px system-ui, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = palette.accent;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = size * 0.7;
      ctx.fillText(shown, W / 2, H * 0.28);
      ctx.restore();
    }
  }
}

function drawTransition(ctx: Ctx2D, brief: MotionBrief, tr: { kind: TransitionKind; local: number; strength: number }) {
  const { width: W, height: H, palette } = brief;
  const p = tr.local;
  const fade = Math.sin(p * Math.PI);
  ctx.save();
  switch (tr.kind) {
    case 'flash':
      ctx.globalAlpha = fade * (0.55 + tr.strength * 0.45);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      break;
    case 'whip': {
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = palette.ink;
      const bw = W * (0.12 + 0.5 * p);
      for (let i = 0; i < 6; i++) ctx.fillRect(((i * W) / 6) * 1 - bw / 2 + p * W * 0.9, 0, bw, H);
      break;
    }
    case 'glitch': {
      const band = Math.round(H / 26);
      ctx.globalAlpha = 0.85 * fade;
      for (let i = 0; i < 26; i++) {
        const j = (rand01(brief.seed + i, Math.floor(p * 20)) - 0.5) * W * 0.28 * tr.strength;
        ctx.fillStyle = i % 3 === 0 ? palette.accent : i % 3 === 1 ? palette.accent2 : 'rgba(255,255,255,0.5)';
        ctx.fillRect(j, i * band, W, band * (0.4 + rand01(brief.seed, i) * 0.6));
      }
      break;
    }
    case 'zoom-blur': {
      ctx.globalAlpha = 0.22 * fade;
      ctx.fillStyle = palette.bg2;
      for (let k = 1; k <= 6; k++) {
        const s = 1 + (k / 6) * 0.16 * fade;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(s, s);
        ctx.translate(-W / 2, -H / 2);
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      break;
    }
    case 'slice': {
      const n = 4;
      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = palette.accent;
      for (let i = 0; i < n; i++) {
        const dir = i % 2 ? -1 : 1;
        ctx.fillRect(0, (i * H) / n + dir * (1 - p) * H * 0.14, W, (H / n) * 0.1);
      }
      break;
    }
  }
  ctx.restore();
}

function drawFinish(ctx: Ctx2D, brief: MotionBrief, t: number) {
  const { width: W, height: H, palette } = brief;
  // grain (deterministic)
  const dots = Math.round(1400 * brief.grain);
  ctx.save();
  ctx.globalAlpha = 0.05 + brief.grain * 0.05;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < dots; i++) {
    const x = rand01(brief.seed, i * 3 + Math.floor(t * brief.fps)) * W;
    const y = rand01(brief.seed + 7, i * 5 + Math.floor(t * brief.fps)) * H;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // progress bar + watermark
  const prog = clamp(t / brief.durationSec, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(W * 0.08, H * 0.9, W * 0.84, 6);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(W * 0.08, H * 0.9, W * 0.84 * prog, 6);
  ctx.globalAlpha = 0.62;
  ctx.font = `700 ${Math.round(H * 0.017)}px system-ui, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.ink;
  ctx.fillText('APEX · MOTION FORGE', W * 0.08, H * 0.94);
  ctx.globalAlpha = 1;
}

/** Ek frame bana do (t second). Node me mock ctx se call karke test kiya gaya hai. */
export function drawMotionFrame(ctx: Ctx2D, brief: MotionBrief, t: number, frameIndex = Math.round(t * brief.fps)) {
  const { width: W, height: H } = brief;
  const { beat, local, index } = beatAt(brief, t);
  const energy = beat.emphasis * (1 - local * 0.35);
  drawBackdrop(ctx, brief, t);

  const cam = cameraAt(brief, t);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.scale, cam.scale);
  ctx.rotate(cam.rot);
  ctx.translate(-W / 2 + cam.dx, -H / 2 + cam.dy);
  drawBlobs(ctx, brief, t, energy);
  drawText(ctx, brief, beat, local, index);
  ctx.restore();

  const tr = transitionAt(brief, t);
  if (tr) drawTransition(ctx, brief, tr);
  drawFinish(ctx, brief, t);
  return { frameIndex, beatIndex: index, local, camera: cam, transition: tr ? tr.kind : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎥 record
// ─────────────────────────────────────────────────────────────────────────────

export interface MotionForgeResult {
  ok: boolean;
  error?: string;
  blob?: Blob;
  url?: string;
  fileName?: string;
  title?: string;
  caption?: string;
  mimeType?: string;
  durationSec?: number;
  vaultId?: string;
  brief?: MotionBrief;
  frames?: number;
}

export function motionForgeSupported(): { ok: boolean; reason?: string; mimes: string[] } {
  // 🍎 iOS Safari: webm nahi banata — video/mp4 (H.264) hi ek rasta hai (iOS 14.5+).
  //    Isliye iPhone/iPad par mp4 variants pehle probe hote hain, Android/Chrome par webm (chhota) pehle.
  const isAppleTouch =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      ((navigator as any).platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));
  const mp4 = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];
  const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimes = isAppleTouch ? [...mp4, ...webm] : [...webm, ...mp4];
  if (typeof document === 'undefined' || typeof (globalThis as any).MediaRecorder === 'undefined') {
    return { ok: false, reason: 'Is browser me MediaRecorder nahi hai (WebView 5+ me hota hai)', mimes };
  }
  const MR: any = (globalThis as any).MediaRecorder;
  const supported = mimes.filter((m) => {
    try {
      return MR.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  return { ok: supported.length > 0, reason: supported.length ? undefined : 'Koi video codec supported nahi', mimes: supported };
}

/**
 * Canvas → MediaRecorder se real MP4/WebM. `saveToVault` true (default) se video
 * Vault + phone gallery ke raste share-ready ho jaata hai (Save-First rule).
 */
export async function renderMotionForgeVideo(
  prompt: string,
  opts: {
    style?: MotionStyle;
    durationSec?: number;
    width?: number;
    height?: number;
    fps?: number;
    saveToVault?: boolean;
    onProgress?: (p: number, note: string) => void;
  } = {}
): Promise<MotionForgeResult> {
  const brief = parseMotionBrief(prompt, opts);
  const support = motionForgeSupported();
  if (!support.ok) return { ok: false, error: support.reason || 'MediaRecorder unavailable', brief };
  if (typeof document === 'undefined') return { ok: false, error: 'document nahi mila (browser context chahiye)', brief };

  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = brief.width;
  canvas.height = brief.height;
  const ctx: Ctx2D = canvas.getContext('2d', { alpha: false });
  if (!ctx) return { ok: false, error: '2D context nahi bana', brief };

  const anyCanvas = canvas as any;
  if (typeof anyCanvas.captureStream !== 'function') return { ok: false, error: 'canvas.captureStream() support nahi', brief };

  opts.onProgress?.(0.05, '🎬 Frames render ho rahe hain…');
  const stream: MediaStream = anyCanvas.captureStream(brief.fps);
  const MR: any = (globalThis as any).MediaRecorder;
  let recorder: any = null;
  let chosen = 'video/webm';
  for (const m of support.mimes.length ? support.mimes : ['video/webm']) {
    try {
      recorder = new MR(stream, { mimeType: m, videoBitsPerSecond: 6_000_000 });
      chosen = m;
      break;
    } catch {}
  }
  if (!recorder) {
    try {
      recorder = new MR(stream);
      chosen = recorder.mimeType || 'video/webm';
    } catch (e: any) {
      return { ok: false, error: `Recorder fail: ${String(e?.message || e).slice(0, 120)}`, brief };
    }
  }

  const chunks: BlobPart[] = [];
  const done = new Promise<void>((resolve) => {
    recorder.ondataavailable = (ev: any) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onstop = () => resolve();
  });

  drawMotionFrame(ctx, brief, 0, 0);
  recorder.start(200);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const total = brief.durationSec + 0.2;
  await new Promise<void>((resolve) => {
    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const t = (now - t0) / 1000;
      if (t >= total) {
        resolve();
        return;
      }
      drawMotionFrame(ctx, brief, t);
      opts.onProgress?.(0.05 + 0.9 * (t / total), `🎬 ${t.toFixed(1)}s / ${brief.durationSec}s · beat ${beatAt(brief, t).index + 1}/${brief.beats.length}`);
      setTimeout(tick, Math.max(8, 1000 / brief.fps - 4));
    };
    tick();
  });
  try {
    recorder.stop();
  } catch {
    /* already stopped */
  }
  await done;
  const blob = new Blob(chunks, { type: chosen.split(';')[0] });
  opts.onProgress?.(0.97, '💾 Blob taiyaar…');
  if (!blob || blob.size < 2048) return { ok: false, error: `Video khali bana (${blob?.size ?? 0} B) — codec issue`, brief };

  const ext = chosen.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `apex-motion-${brief.seed.toString(36)}-${Date.now()}.${ext}`;
  const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : '';
  const result: MotionForgeResult = {
    ok: true,
    blob,
    url,
    fileName,
    title: brief.title,
    caption: brief.caption,
    mimeType: blob.type || chosen,
    durationSec: brief.durationSec,
    brief,
    frames: Math.round(brief.durationSec * brief.fps),
  };

  if (opts.saveToVault !== false) {
    try {
      const { saveVideoToVault } = await import('./videoVaultDb');
      const vaultId = `motion_${brief.seed.toString(36)}_${Date.now()}`;
      await saveVideoToVault({
        id: vaultId,
        createdAt: Date.now(),
        title: brief.title,
        caption: brief.caption,
        fileName,
        mimeType: result.mimeType as string,
        durationSec: brief.durationSec,
        sizeBytes: blob.size,
        blob,
        scheduledAt: null,
      } as any);
      result.vaultId = vaultId;
      opts.onProgress?.(1, '✅ Vault me save ho gaya');
    } catch (e: any) {
      opts.onProgress?.(1, '⚠️ Vault save fail — video phir bhi ready hai');
    }
  }
  return result;
}

/** Panel me dikhane ke liye ek-line ka summary. */
export function describeMotionBrief(brief: MotionBrief): string {
  return `${brief.style} · ${brief.beats.length} beats · ${brief.durationSec}s · ${brief.camera.length} camera moves · ${brief.transitions.length} transitions · ${Math.round((brief.width * brief.height) / 1000)}k px`;
}
